// DOOR VII: THE IMPRESARIO, the Paper Theatre. You have an understudy. It goes where you go, on the other side of the stage.
(() => {
  const HX = 15, HZ = 9, LIME = 0xfff2c8, ROSE = 0xff3d6e, VIO = 0xc86bff, MID = 1.6, PIT = 2.3;
  const _a = new V3(), _b2 = new V3(), _m = new THREE.Object3D();
  const ROWZ = [-6, 0, 6];

  // ---- the understudies ----
  const dolls = (S) => S.dolls.filter((d) => d.on);
  const mir = (d, x, z, out) => { if (d.mode === 'x') { out.x = -x; out.z = z; } else { out.x = x; out.z = -z; } return out; };
  const dpos = (d, out) => mir(d, G.player.pos.x, G.player.pos.z, out);
  function dollHurt(b, d, dmg, o = {}) {
    const p = G.player, q = dpos(d, _a); q.y = 1.2;
    FX.impact(q.x, 1.2, q.z, ROSE, 0.9); if (!G.headless) FX.beam(new V3(q.x, 1.3, q.z), p.aim(new V3()), { color: ROSE, width: 0.12, dur: 0.35 });
    b.state.twang = 1; p.hurt(dmg, { blockable: o.blockable !== false, dot: o.dot, src: { name: 'Understudy' } });
  }

  // ---- paper art ----
  function paper(w, h, draw, o = {}) {
    const c = document.createElement('canvas'); c.width = o.cw || 512; c.height = o.ch || 256; const x = c.getContext('2d'); draw(x, c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, transparent: false, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: o.em === undefined ? 0.12 : o.em }));
    return m;
  }
  const grain = (x, w, h, a = 0.07) => { const r = mulberry(w + h); x.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 200},${a * r()})`; x.fillRect(r() * w, r() * h, 2 + r() * 14, 1 + r() * 2); } x.globalCompositeOperation = 'source-over'; };
  const ART = {
    hills: (c1, c2) => (x, w, h) => { x.fillStyle = c1; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 40; i++) x.lineTo(i / 40 * w, h * (0.45 - 0.22 * Math.sin(i * 0.37) - 0.12 * Math.sin(i * 0.93 + 1))); x.lineTo(w, h); x.fill(); x.strokeStyle = c2; x.lineWidth = 6; x.stroke(); grain(x, w, h); },
    waves: (c1, c2) => (x, w, h) => { x.fillStyle = c1; x.beginPath(); x.moveTo(0, h); x.lineTo(0, h * 0.5); for (let i = 0; i < 12; i++) { const x0 = i / 12 * w, x1 = (i + 1) / 12 * w; x.quadraticCurveTo((x0 + x1) / 2, h * 0.05, x1, h * 0.5); } x.lineTo(w, h); x.fill(); x.strokeStyle = c2; x.lineWidth = 7; for (let i = 0; i < 12; i++) { x.beginPath(); x.arc((i + 0.5) / 12 * w, h * 0.62, w / 30, PI, TAU); x.stroke(); } grain(x, w, h); },
    trees: (c1, c2) => (x, w, h) => { for (let i = 0; i < 7; i++) { const cx = (i + 0.5) / 7 * w, th = h * (0.7 + 0.28 * Math.sin(i * 2.1)); x.fillStyle = c2; x.fillRect(cx - 6, h - th * 0.3, 12, th * 0.3); x.fillStyle = c1; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(cx, h - th + k * th * 0.2); x.lineTo(cx - w / 18 - k * 6, h - th * 0.28 + (k - 2) * th * 0.16); x.lineTo(cx + w / 18 + k * 6, h - th * 0.28 + (k - 2) * th * 0.16); x.fill(); } } grain(x, w, h); },
    town: (c1, c2) => (x, w, h) => { const r = mulberry(5); for (let i = 0; i < 9; i++) { const x0 = i / 9 * w, bh = h * (0.45 + r() * 0.5); x.fillStyle = c1; x.fillRect(x0 + 2, h - bh, w / 9 - 4, bh); x.beginPath(); x.moveTo(x0, h - bh); x.lineTo(x0 + w / 18, h - bh - h * 0.14); x.lineTo(x0 + w / 9, h - bh); x.fill(); x.fillStyle = c2; for (let k = 0; k < 3; k++) if (r() < 0.7) x.fillRect(x0 + w / 30, h - bh + 12 + k * 30, 14, 18); } grain(x, w, h); },
    sky: () => (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1030'); g.addColorStop(0.6, '#2a2a6a'); g.addColorStop(1, '#7a3a6a'); x.fillStyle = g; x.fillRect(0, 0, w, h); const r = mulberry(8); x.fillStyle = '#fff6d8'; for (let i = 0; i < 90; i++) { const s = 1 + r() * 3; x.save(); x.translate(r() * w, r() * h * 0.7); x.rotate(0.78); x.fillRect(-s, -s, s * 2, s * 2); x.restore(); } grain(x, w, h, 0.05); },
  };

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x0a0406, horizon: 0x341a14, bottom: 0x050203, sunGlow: 0, sunSize: 0 }); g.add(sky); W.env(sky, 0.5);
    scene.fog = new THREE.FogExp2(0x0a0406, 0.009);
    S.hemi = W.hemi(g, 0x9a7a6a, 0x2a1810, 0.85);
    S.key = W.sun(g, { dir: [0.18, 0.85, 0.55], color: 0xffe2b8, intensity: 3.0, size: 24 });
    S.foot = new THREE.PointLight(0xffb060, 150, 46, 1.6); S.foot.position.set(0, 1.6, 11.5); g.add(S.foot);
    S.back = new THREE.PointLight(0x7090ff, 120, 50, 1.6); S.back.position.set(7, 9, -9.5); g.add(S.back);
    // stage floor in three pieces so the middle can drop away
    const wd = W.surface('wood', { n: 8, dark: 0x3a2010, light: 0xc89052, strength: 2.2, seed: 4 });
    const plank = (w, x) => { const t = {}; for (const k in wd) { t[k] = wd[k].clone(); t[k].repeat.set(w / 7, 2.6); t[k].offset.x = (x + 15) / 7; t[k].needsUpdate = true; } const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, HZ * 2 + 1.6), [0, 1, 2, 3, 4, 5].map((i) => i === 2 ? new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 0.55, metalness: 0.05, envMapIntensity: 1.3 }) : W.mat({ color: 0x120a06, roughness: 0.9 }))); m.position.set(x, -0.6, 0.4); m.receiveShadow = true; g.add(m); return m; };
    plank(HX + 1.5 - PIT, -(HX + 1.5 + PIT) / 2); plank(HX + 1.5 - PIT, (HX + 1.5 + PIT) / 2); S.centre = plank(PIT * 2, 0);
    for (const k in wd) wd[k].dispose();
    const pitGlow = new THREE.Mesh(new THREE.PlaneGeometry(PIT * 2, HZ * 2 + 1.6), W.glow(0xff2a1a, 1.2)); pitGlow.rotation.x = -PI / 2; pitGlow.position.set(0, -7, 0.4); g.add(pitGlow);
    S.pitWaves = []; for (let i = 0; i < 4; i++) { const w = paper(HZ * 2 + 2, 2.6, ART.waves('#7a1420', '#ffb0a0'), { em: 0.5 }); w.rotation.y = PI / 2; w.position.set(-1.5 + i, -4.2 - i * 0.2, 0.4); g.add(w); S.pitWaves.push(w); }
    const front = new THREE.Mesh(new THREE.BoxGeometry(36, 4, 0.6), W.mat({ color: 0x2a0a10, roughness: 0.7 })); front.position.set(0, -2, HZ + 1.5); g.add(front);
    const goldM = W.mat({ color: 0xc9a050, roughness: 0.25, metalness: 1, envMapIntensity: 2 });
    const trimF = new THREE.Mesh(new THREE.BoxGeometry(36, 0.25, 0.75), goldM); trimF.position.set(0, 0.02, HZ + 1.5); g.add(trimF);
    S.footGlow = W.glow(0xffc070, 3.2); for (let i = 0; i < 15; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, TAU, 0, PI / 2), S.footGlow); s.position.set(-14 + i * 2, 0.1, HZ + 1.35); s.rotation.x = -0.9; g.add(s); }
    // proscenium, curtains
    const velvet = W.mat({ color: 0x8a0e1c, roughness: 0.8, side: THREE.DoubleSide, envMapIntensity: 0.6 });
    const folds = (w, h, n, amp) => { const geo = new THREE.PlaneGeometry(w, h, n * 6, 6), P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); P.setZ(i, Math.sin(x / w * n * TAU) * amp * (0.5 + 0.5 * (0.5 - y / h))); } geo.computeVertexNormals(); return geo; };
    for (const sx of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(2.2, 17, 2.2), goldM); col.position.set(sx * 18.2, 7.5, HZ + 1.6); g.add(col);
      const cur = new THREE.Mesh(folds(5.5, 16, 5, 0.42), velvet); cur.position.set(sx * 15.4, 7.6, HZ + 1.1); cur.castShadow = true; g.add(cur);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.14, 6, 18), goldM); tie.position.set(sx * 15.6, 5.2, HZ + 1.2); tie.rotation.x = PI / 2; tie.scale.set(1.6, 0.6, 1); g.add(tie);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1, 20, 24), W.mat({ color: 0x06040a, roughness: 1 })); wing.position.set(sx * 20.5, 9, -2); g.add(wing);
      for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(folds(4, 16, 3, 0.3), W.mat({ color: 0x1c0a2a, roughness: 0.9, side: THREE.DoubleSide })); leg.position.set(sx * 17.3, 7.6, -6.5 + k * 6); g.add(leg); }
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(39, 2.2, 2.2), goldM); beam.position.set(0, 16, HZ + 1.6); g.add(beam);
    const val = new THREE.Mesh(folds(34.5, 3.6, 16, 0.35), velvet); val.position.set(0, 13.4, HZ + 1.2); g.add(val);
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.5, 6), goldM); crest.rotation.x = PI / 2; crest.position.set(0, 16.4, HZ + 2.7); g.add(crest);
    S.mask0 = W.glow(0xfff0c0, 1.5); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), S.mask0); e.scale.set(1.4, 0.7, 0.4); e.position.set(sx * 0.7, 16.7, HZ + 3.0); g.add(e); }
    // painted backdrop
    S.drop = new THREE.Group(); g.add(S.drop);
    const skyP = paper(42, 20, ART.sky(), { cw: 512, ch: 256, em: 0.5 }); skyP.position.set(0, 9, -15); S.drop.add(skyP);
    S.moonM = W.glow(0xfff4d0, 2.6); const moon = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), S.moonM); moon.position.set(7, 11.5, -14.6); S.drop.add(moon); const stick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 12, 0.05), W.mat({ color: 0x2a1a10 })); stick.position.set(7, 5, -14.65); S.drop.add(stick);
    S.layers = [];
    const lay = (art, w, h, y, z, amp, sp) => { const m = paper(w, h, art); m.position.set(0, y, z); S.drop.add(m); S.layers.push({ m, amp, sp }); };
    lay(ART.hills('#3a2a6a', '#8a70c0'), 46, 9, 4.2, -13.8, 0.6, 0.23); lay(ART.town('#1c1a3a', '#ffd070'), 40, 6.5, 3.0, -12.9, 0, 0); lay(ART.trees('#14302a', '#0a1814'), 44, 6, 2.6, -11.9, 0.35, 0.5);
    lay(ART.waves('#2a5a8a', '#c0e0ff'), 40, 2.6, 0.9, -11.0, 1.6, 0.9); lay(ART.waves('#1c406a', '#a0c8f0'), 40, 2.4, 0.7, -10.4, 1.6, -0.7);
    // rafters, hanging lamps, pooled spotlight cones
    const dark = W.mat({ color: 0x0a0808, roughness: 0.9 });
    for (const z of [-6, 0, 6]) { const r = new THREE.Mesh(new THREE.BoxGeometry(38, 0.3, 0.3), dark); r.position.set(0, 14, z); g.add(r); }
    S.cones = [];
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 3.1, 14, 28, 1, true), new THREE.ShaderMaterial({
        uniforms: { uC: { value: new THREE.Color(LIME) }, uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=abs(dot(normalize(vN),normalize(vV))); float a=(0.12+0.5*clamp(vUv.y,0.0,1.0))*(0.2+0.8*f*f)*uA; gl_FragColor=vec4(uC*a,a); }',
      }));
      c.position.y = 7; c.visible = false; c.renderOrder = 14; g.add(c); S.cones.push(c);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.9, 10), dark); lamp.position.set(-13.5 + i * 4.5, 13.6, 6); lamp.rotation.x = 0.5; g.add(lamp);
    }
    // sliding flats for the scene changes
    S.flats = [];
    const arts = [ART.trees('#1f5a3a', '#0f2a1c'), ART.town('#5a2a4a', '#ffd070'), ART.hills('#8a5a2a', '#ffd9a0')];
    for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) { const f = paper(20, 7.5, arts[r], { em: 0.25 }); f.position.set(sx * 30, 3.7, ROWZ[r]); f.castShadow = true; g.add(f); S.flats.push({ m: f, row: r, sx, x: sx * 30, tx: sx * 30 }); }
    // the house
    const NA = 150, heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6), W.mat({ color: 0x0c0810, roughness: 0.7 }), NA), ar = mulberry(31);
    for (let i = 0; i < NA; i++) { const row = Math.floor(i / 25), k = i % 25; _m.position.set((k - 12) * 1.5 + (row % 2) * 0.7 + (ar() - 0.5) * 0.3, -1.6 + row * 0.5 + ar() * 0.15, 15 + row * 1.9); _m.scale.set(1, 1.15, 1); _m.rotation.set(0, 0, 0); _m.updateMatrix(); heads.setMatrixAt(i, _m.matrix); }
    g.add(heads);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(70, 44, 90), W.mat({ color: 0x0a0508, roughness: 1, side: THREE.BackSide })); hall.position.set(0, 16, 12); g.add(hall);
    const lampsFar = W.glow(0xffb060, 2); for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lampsFar); s.position.set(-27 + i * 6, 7 + (i % 2) * 5, 44); g.add(s); }
    g.add(W.motes({ n: 260, box: [34, 14, 22], color: 0xffe0b0, size: 0.06, vel: [0.03, -0.04, 0.02], sway: 0.5, center: [0, 7, 2], mult: 0.9 }));

    // ---- understudies ----
    const cls = UI.selectedClass() || G.classes[0]; S.dolls = [];
    for (const mode of ['x', 'z']) {
      const M = buildHero({ id: cls.id, look: { armor: 0xd9c9a4, cloth: mode === 'x' ? 0x7a1028 : 0x1c2a7a, glow: mode === 'x' ? ROSE : 0x5a9cff, hood: cls.look.hood, hat: cls.look.hat, weapon: cls.look.weapon || (cls.id === 'duskblade' ? 'blade' : 'staff') } });
      g.add(M.group);
      const bar = new THREE.Group(); for (const r of [0, PI / 2]) { const q = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.1), W.mat({ color: 0x3a2412 })); q.rotation.y = r; bar.add(q); } g.add(bar);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24), 3));
      const ln = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(mode === 'x' ? ROSE : 0x5a9cff).multiplyScalar(1.6), transparent: true, opacity: 0.8 })); ln.frustumCulled = false; g.add(ln);
      S.dolls.push({ mode, on: mode === 'x', M, bar, ln, fake: { moveSpeed: 0, grounded: true, casting: null, parryT: 0, flashT: 0 } });
    }
    S.dolls[1].M.group.visible = S.dolls[1].bar.visible = S.dolls[1].ln.visible = false;

    // ---- the Impresario ----
    const bg = b.group, coatM = W.mat({ color: 0x2a0f3c, roughness: 0.6, side: THREE.DoubleSide }), white = W.mat({ color: 0xf2ece0, roughness: 0.3 }), black = W.mat({ color: 0x08060a, roughness: 0.35, metalness: 0.3 });
    S.rig = new THREE.Group(); bg.add(S.rig);
    const coat = new THREE.Mesh(new THREE.LatheGeometry([[0.05, 0.2], [0.5, 0.5], [1.15, 1.2], [0.85, 2.4], [0.55, 3.3], [0.62, 3.9], [0.3, 4.15]].map((p) => new THREE.Vector2(p[0], p[1])), 20), coatM); coat.castShadow = true; S.rig.add(coat);
    S.trim = new THREE.MeshStandardMaterial({ color: 0x221a08, emissive: 0xffc24a, emissiveIntensity: 1.4, metalness: 1, roughness: 0.3 });
    for (const [r, y] of [[1.15, 1.2], [0.63, 3.9]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 6, 30), S.trim); t.rotation.x = PI / 2; t.position.y = y; S.rig.add(t); }
    for (let i = 0; i < 4; i++) { const bt = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), S.trim); bt.position.set(0, 3.6 - i * 0.32, 0.6 - i * 0.02 + (i > 1 ? 0.1 * (i - 1) : 0)); S.rig.add(bt); }
    S.head = new THREE.Group(); S.head.position.y = 4.55; S.rig.add(S.head);
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), white); mask.scale.set(0.82, 1.1, 0.8); mask.castShadow = true; S.head.add(mask);
    S.eyeM = W.glow(VIO, 3); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 5, 12, PI), S.eyeM); e.position.set(sx * 0.15, 0.08, 0.31); S.head.add(e); }
    const grin = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 5, 14, PI), black); grin.rotation.z = PI; grin.position.set(0, -0.1, 0.31); S.head.add(grin);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 20), black); brim.position.y = 0.38; S.head.add(brim);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 1.0, 20), black); hat.position.y = 0.9; hat.castShadow = true; S.head.add(hat);
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.37, 0.14, 20), S.trim); hb.position.y = 0.5; S.head.add(hb);
    S.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.62, 3.75, 0); S.rig.add(sh);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 1.5, 8), coatM); up.position.y = -0.75; up.castShadow = true; sh.add(up);
      const el = new THREE.Group(); el.position.y = -1.5; sh.add(el);
      const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 1.5, 8), coatM); lo.position.y = -0.75; lo.castShadow = true; el.add(lo);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), white); glove.position.y = -1.6; el.add(glove);
      S.arms.push({ sh, el, sx, glove });
    }
    const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 8), black); cane.position.set(0, -1.6, 0.9); cane.rotation.x = PI / 2 - 0.3; S.arms[1].el.add(cane);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), S.trim); knob.position.set(0, -1.25, -0.3); S.arms[1].el.add(knob);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
    S.bossStr = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.25 })); S.bossStr.frustumCulled = false; g.add(S.bossStr);

    // ---- what holds his strings (revealed in the finale) ----
    S.giant = new THREE.Group(); S.giant.visible = false; g.add(S.giant);
    const gm = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 24), W.mat({ color: 0xe8e0d0, roughness: 0.35 })); gm.scale.set(0.85, 1.12, 0.5); gm.position.set(0, 15, -23); S.giant.add(gm);
    S.gEye = W.glow(VIO, 0.1); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.4, 8, 20, PI), S.gEye); e.position.set(sx * 2.5, 16.5, -19.7); S.giant.add(e); }
    const gGrin = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.28, 8, 24, PI), black); gGrin.rotation.z = PI; gGrin.position.set(0, 13.6, -19.8); S.giant.add(gGrin);
    S.gL = new THREE.PointLight(VIO, 0, 70, 1.5); S.gL.position.set(0, 15, -14); g.add(S.gL);
    S.hands = [];
    for (const sx of [-1, 1]) {
      const h = new THREE.Group(), palm = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.3, 5), white); palm.castShadow = true; h.add(palm);
      for (let f = 0; f < 4; f++) { const fg = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 3.2, 4, 10), white); fg.rotation.x = PI / 2; fg.position.set(-1.7 + f * 1.13, 0, 4.2); fg.castShadow = true; h.add(fg); }
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.2, 4, 10), white); th.rotation.z = PI / 2 - 0.5; th.position.set(sx * 3.2, 0, 0.8); h.add(th);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 1.6, 16), coatM); cuff.rotation.x = PI / 2; cuff.position.z = -3.2; h.add(cuff);
      h.position.set(sx * 9, 30, -8); S.giant.add(h); S.hands.push({ g: h, sx, home: new V3(sx * 9, 13.5, -9), tgt: new V3(sx * 9, 13.5, -9), fast: 0 });
    }
    S.split = false; S.dark = 0; S.black = null; S.twang = 0; S.dz = 0; S.act = 0; S.gesture = 0; S.pitY = 0;
    b.distTo = function (x, z) { if (S.split) x = -x; return Math.max(0, Math.hypot(x - this.pos.x, z - this.pos.z) - this.radius); };
    return {
      edge: 'wall', spawn: { x: -5, z: 5 }, bossStart: { x: 0, z: -5, face: 0 }, camDist: 16,
      contains: (x, z) => Math.abs(x) <= HX - 0.4 && Math.abs(z) <= HZ - 0.4 && (!S.split || x <= -PIT - 0.3),
      clamp(p) { p.x = clamp(p.x, -HX + 0.5, S.split ? -PIT - 0.4 : HX - 0.5); p.z = clamp(p.z, -HZ + 0.5, HZ - 0.5); },
      bulletBounds: (x, z) => Math.abs(x) < 17.5 && Math.abs(z) < 11,
      camLimit(x, y, z) { return { x: clamp(x, -14.3, 14.3), y: Math.min(y, 12.5), z: clamp(z, -9.5, 30) }; },
    };
  }

  // ---- stagecraft ----
  const tgtOf = (S, k) => { const dl = dolls(S); if (k % (dl.length + 1) === 0) return { x: G.player.pos.x, z: G.player.pos.z }; return dpos(dl[(k % (dl.length + 1)) - 1], {}); };
  function* knives(b, n, gap = 0.72) {
    const S = b.state; yield* b.cast({ name: 'Knife Act', time: 0.6 });
    for (let i = 0; i < n; i++) {
      const q = tgtOf(S, i); S.gesture = 1;
      FX.missile(new V3(b.pos.x, 3.4, b.pos.z), new V3(q.x, 0.3, q.z), { speed: 30, color: 0xffffff, size: 0.18 }); Sound.sfx('sword', 0.6, 1.3);
      Hz.circle(q.x, q.z, 2.6, 1.0, 260, { name: 'Knife Act', onFire() { FX.burst(q.x, 0.4, q.z, { n: 14, color: 0xffffff, color2: VIO, speed: [2, 8], up: 2, life: [0.2, 0.6] }); Sound.sfx('hit', 0.9, 1.4); } });
      yield gap;
    }
    yield 0.6;
  }
  function* flood(b, sides, delay = 1.7) {
    const S = b.state; S.gesture = 1; Sound.sfx('charge', 0.7, 1.4);
    for (const side of sides) {
      const o = { name: 'Limelight', color: LIME, quiet: true, onFire(h) { const s = h.shape; for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6; FX.pillar(s.x + Math.sin(s.dir) * s.len * 0.5 + Math.cos(s.dir) * s.w * (t - 0.5), s.z + Math.cos(s.dir) * s.len * 0.5 - Math.sin(s.dir) * s.w * (t - 0.5), { r: 3.2, h: 15, color: LIME, dur: 0.6 }); } Sound.sfx('boom', 0.8, 1.3); FX.flash(LIME, 0.25, 3); FX.shake(0.3); } };
      if (side === 'L') Hz.rect(-HX, 0, PI / 2, HX - MID, HZ * 2, delay, 380, o); else if (side === 'R') Hz.rect(HX, 0, -PI / 2, HX - MID, HZ * 2, delay, 380, o);
      else if (side === 'F') Hz.rect(0, HZ, PI, HZ - MID, HX * 2, delay, 380, o); else Hz.rect(0, -HZ, 0, HZ - MID, HX * 2, delay, 380, o);
    }
    yield* b.cast({ name: 'Limelight', time: delay }); yield 0.3;
  }
  function* trapdoor(b, delay = 1.25) {
    const S = b.state, o = { name: 'Trapdoor', color: ROSE, onFire() { FX.burst(0, 0.2, 0, { n: 50, color: ROSE, color2: 0x400010, speed: [2, 9], up: 5, life: [0.4, 1], radius: 3 }); Sound.sfx('boom', 1, 0.7); FX.shake(0.4); } };
    if (dolls(S).length > 1) Hz.circle(0, 0, 4.6, delay, 360, o); else Hz.rect(0, -HZ, 0, HZ * 2, 4.8, delay, 360, o);
    yield delay + 0.35;
  }
  function* scenery(b, n) {
    const S = b.state; yield* b.cast({ name: 'Scene Change', time: 0.7 }); Sound.sfx('steam', 0.7, 0.5);
    const rows = shuffle([0, 1, 2]).slice(0, n);
    for (const r of rows) {
      const sx = rnd() < 0.5 ? -1 : 1, len = rnd() < 0.5 ? rnd(9, 12.5) : rnd(17.5, 21), f = S.flats.find((q) => q.row === r && q.sx === sx);
      Hz.rect(sx * HX, ROWZ[r], sx < 0 ? PI / 2 : -PI / 2, len, 5.8, 1.7, 330, { name: 'Scene Change', color: 0xffb060, quiet: true, onFire() { f.tx = sx * (HX - len + 10); f.hold = 1.3; Sound.sfx('boom', 0.6, 1.5); FX.shake(0.2); } });
      yield 0.35;
    }
    yield 2.0;
  }
  function* birds(b, side, waves = 3) {
    yield* b.cast({ name: 'Paper Birds', time: 0.8 });
    let g0 = rndi(0, 6);
    for (let w = 0; w < waves; w++) {
      for (let i = 0; i < 9; i++) { if (i === g0 || i === g0 + 1 || i === (g0 + 5) % 9) continue; Bul.fire({ x: side * -16.5, z: -8 + i * 2, dir: side * PI / 2, speed: 8.5, r: 0.42, dmg: 120, color: 0xfff4e0, life: 4.2 }); }
      Sound.sfx('dash', 0.5, 1.6); g0 = (g0 + rndi(2, 4)) % 8; yield 1.15;
    }
    yield 1.6;
  }
  function* blackout(b, decoys, time = 4.4) {
    const S = b.state, p = G.player, dl = dolls(S), R0 = 3.1;
    let q = { x: -8, z: 3 };
    for (let k = 0; k < 40; k++) { q = { x: rnd(S.split ? -12.5 : -12, S.split ? -5 : 12), z: rnd(-6, 6) }; if (Math.abs(q.x) > 4.2 && (dl.length < 2 || Math.abs(q.z) > 3.6)) break; }
    const spots = [q]; for (const d of dl) { const m = mir(d, q.x, q.z, {}); spots.push({ x: m.x + rnd(-0.6, 0.6), z: m.z + rnd(-0.6, 0.6) }); }
    const lit = (x, z, L, r = R0) => L.some((s) => Math.hypot(s.x - x, s.z - z) <= r);
    for (let k = 0, tries = 0; k < decoys && tries < 200; tries++) {
      const c = { x: rnd(-12.5, 12.5), z: rnd(-6.5, 6.5) }; if (S.split && Math.abs(c.x) < 4.5) continue;
      if (spots.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < 6.4)) continue;
      if (dl.every((d) => { const m = mir(d, c.x, c.z, {}); return lit(m.x, m.z, spots, R0 + 1.2); })) continue;
      spots.push(c); k++;
    }
    S.black = { spots, at: G.now + time, r: R0, q }; Sound.sfx('bell', 0.7, 0.6);
    const marks = spots.map((s) => Hz.mark({ type: 'circle', x: s.x, z: s.z, r: R0 }, time + 0.2, { color: LIME, alpha: 0.9 }));
    if (!G.headless) spots.forEach((s, i) => { const c = S.cones[i]; if (c) { c.visible = true; c.position.set(s.x, 7, s.z); } });
    const r = yield* b.cast({ name: 'Blackout', time, onTick: (k) => { S.dark = Math.min(1, k * 5); } });
    for (const m of marks) Hz.cancel(m); for (const c of S.cones) c.visible = false; S.black = null; S.dark = 0;
    if (r !== 'done') return;
    FX.flash(0xffffff, 0.35, 2.5); Sound.sfx('boom', 1, 0.5);
    const ok = lit(p.pos.x, p.pos.z, spots) && dl.every((d) => { const m = dpos(d, {}); return lit(m.x, m.z, spots); });
    if (!ok) { p.hurt(430, { blockable: false, src: { name: 'Blackout' } }); FX.shake(0.6); } else for (const s of spots.slice(0, 1 + dl.length)) FX.ring(s.x, s.z, { r1: 5, color: LIME, dur: 0.5 });
    yield 0.6;
  }
  function* encore(b) {
    const S = b.state, r = yield* b.cast({ name: 'Encore', time: 3.0, interruptible: true, onTick: () => { S.gesture = 1; } });
    if (r !== 'done') { yield 1.2; return; }
    Sound.sfx('clap', 1); FX.flash(ROSE, 0.2, 3);
    for (let i = 0; i < 12; i++) { const q = i % 3 === 2 ? { x: rnd(-13, S.split ? -3 : 13), z: rnd(-7, 7) } : tgtOf(S, i); const x = q.x + rnd(-1.2, 1.2), z = q.z + rnd(-1.2, 1.2); Hz.circle(x, z, 2.3, 1.15, 230, { name: 'Bouquet', color: ROSE, onFire() { FX.burst(x, 0.3, z, { n: 14, color: ROSE, color2: 0xffd0e0, speed: [1, 6], up: 4, grav: 6, life: [0.5, 1.1] }); } }); yield 0.42; }
    yield 1.0;
  }
  // act two: he works the far half of the stage
  function* flourish(b) {
    const S = b.state, q = dpos(S.dolls[0], {}), dir = angTo(b.pos.x, b.pos.z, q.x, q.z); b.autoFace = false; yield* b.turnTo(dir, 0.25); S.gesture = 1;
    Hz.cone(b.pos.x, b.pos.z, dir, 2.0, 8.5, 1.25, 300, { name: 'Flourish', onFire() { FX.slash(b.pos.x, 1.4, b.pos.z, dir, { r: 8.5, color: VIO, dur: 0.3 }); Sound.sfx('slash', 1, 0.7); } });
    yield 1.6; b.autoFace = true;
  }
  function* pirouette(b) { const S = b.state; S.spin = 1; Hz.circle(b.pos.x, b.pos.z, 6.6, 1.5, 320, { name: 'Pirouette', onFire() { FX.ring(b.pos.x, b.pos.z, { r1: 7, color: VIO, dur: 0.4 }); } }); yield* b.cast({ name: 'Pirouette', time: 1.5 }); S.spin = 0; yield 0.4; }
  function* sandbags(b, n) {
    yield* b.cast({ name: 'Sandbags', time: 0.5 });
    for (let i = 0; i < n; i++) { const p = G.player, x = p.pos.x, z = p.pos.z; Hz.circle(x, z, 2.8, 1.1, 260, { name: 'Sandbag', color: 0xffb060, onFire() { FX.burst(x, 0.3, z, { n: 16, smoke: true, color: 0x8a7a5a, color2: 0x2a2418, speed: [1, 5], life: [0.5, 1.1], size: [0.6, 1.4], alpha: 0.5 }); Sound.sfx('boom', 0.7, 0.9); } }); yield 0.85; }
    yield 0.4;
  }
  function* stroll(b) { const S = b.state; if (S.split) yield* b.moveTo(rnd(6.5, 11.5), rnd(-5, 5), 6); else { const p = G.player, a = angTo(p.pos.x, p.pos.z, 0, -2); yield* b.moveTo(clamp(p.pos.x + Math.sin(a) * 6, -9, 9), clamp(p.pos.z + Math.cos(a) * 6, -6, 4), 7); } }
  // finale: the hands
  function* slam(b, n) {
    const S = b.state;
    for (let i = 0; i < n; i++) {
      const H = S.hands[i % 2], q = tgtOf(S, i), x = clamp(q.x, -11, 11), z = clamp(q.z, -5, 5);
      H.tgt.set(x, 11, z); H.fast = 0;
      Hz.circle(x, z, 5.2, 1.6, 380, { name: 'The Hand', kb: { dist: 4 }, onFire() { H.tgt.set(x, 0.7, z); H.fast = 1; FX.explode(x, 0.5, z, 0xfff0e0, 6, VIO); Sound.sfx('bigboom', 0.7); Co.start(function* () { yield 0.7; H.fast = 0; H.tgt.copy(H.home); }, 'fight'); } });
      yield 1.25;
    }
    yield 1.2;
  }
  function setAct(b, n) {
    const S = b.state, p = G.player; S.act = n; S.split = n === 1;
    S.black = null; S.dark = 0; S.spin = 0; for (const c of S.cones) c.visible = false;
    const d1 = S.dolls[1]; d1.on = n === 2; d1.M.group.visible = d1.bar.visible = d1.ln.visible = d1.on;
    S.giant.visible = n === 2;
    if (S.split && p.pos.x > -PIT - 0.6) { FX.burst(p.pos.x, 1, p.pos.z, { n: 20, color: VIO, speed: [1, 5] }); p.pos.x = -6; }
    if (S.split && b.pos.x < 5) b.pos.set(8, 0, -1);
    if (!S.split && n === 2 && Math.abs(b.pos.x) > 6) b.pos.set(0, 0, -4);
  }

  G.bosses.push({
    id: 'theatre', name: 'THE IMPRESARIO', title: 'The Paper Theatre', hint: 'A performance', color: '#c86bff', telegraph: 0xd070ff,
    hp: 27500, radius: 1.5, aimY: 3.3, enrage: 450,
    post: { bloom: 0.62, threshold: 0.84, radius: 0.65, exposure: 1.08, vig: 1.15, sat: 1.12, tint: [1.05, 0.99, 0.95] },
    music: { bpm: 132, root: 45, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 0, 3, 4, 0, 0, 5, 4],
      layers: [
        { v: 'bass', pat: '0.....4.....0...', oct: -1, len: 2, vol: 0.13 }, { v: 'pulse', pat: '....24......24..', oct: 1, len: 1, vol: 0.05 }, { v: 'flute', pat: ['4.....7.6.5.4...', '2.....4.3.2.0...'], oct: 2, len: 3, vol: 0.06 },
        { v: 'snare', from: 1, pat: '....x.......x..x', vol: 0.14 }, { v: 'organ', from: 1, pat: ['0.2.4.7.4.2.0.2.', '0.3.5.7.5.3.0.3.'], oct: 1, len: 1, vol: 0.06 }, { v: 'kick', from: 1, pat: 'x.....x.x.......', vol: 0.3 },
        { v: 'brass', from: 2, pat: ['0.......4.......', '5.......4.......'], oct: 1, len: 7, vol: 0.1 }, { v: 'taiko', from: 2, pat: 'x..x..x.x..x..x.', vol: 0.28 }, { v: 'bell', from: 2, pat: '0...............', oct: 2, len: 8, vol: 0.08 }, { v: 'lead', from: 2, pat: ['7.6.5.4.5.6.7.9.', '7.9.b.9.7.6.5.4.'], oct: 2, len: 1, vol: 0.045 },
      ] },
    build,
    *intro(b) { yield* Cam.shot([0, 5, 34], [0, 6, 0], [-3, 3.4, 9], [0, 4, -5], 4.8, 44); },
    phases: [
      { at: 1, *run(b) {
        b.autoFace = true; setAct(b, 0); yield 1.2;
        while (true) {
          yield* knives(b, 4); yield* flood(b, [rnd() < 0.5 ? 'L' : 'R']); yield* trapdoor(b); yield 0.4;
          yield* scenery(b, 1); yield* stroll(b);
          yield* blackout(b, 1); yield* birds(b, rnd() < 0.5 ? -1 : 1, 3);
          yield* flood(b, ['L']); yield* flood(b, ['R'], 1.5); yield* trapdoor(b); yield* stroll(b);
          yield* encore(b); yield* scenery(b, 2); yield* knives(b, 5);
        }
      } },
      { at: 0.67, *enter(b) {
        const S = b.state, p = G.player; Sound.sfx('bell', 1, 0.7); S.gesture = 1; b.autoFace = false;
        Hz.rect(0, -HZ, 0, HZ * 2, PIT * 2 + 0.6, 2.2, 0, { color: ROSE, tag: 'fight' });
        Co.start(function* () { yield* b.turnTo(PI / 2, 0.3); yield* b.moveTo(8, -1, 9); b.autoFace = true; }, 'fight');
        yield 2.2; Sound.sfx('bigboom', 0.8); FX.shake(0.9); FX.flash(ROSE, 0.3, 2);
        setAct(b, 1); Co.start(Post.lerpTo({ tint: [1.08, 0.94, 0.98], bloom: 0.72 }, 2.5), 'fight'); S.back.color.set(0xff5070);
        yield* W.tween(1.5, (k) => { S.pitY = k; }); yield 0.4;
      }, *run(b) {
        const S = b.state; setAct(b, 1); S.pitY = 1; b.autoFace = true;
        while (true) {
          yield* flourish(b); yield* knives(b, 4); yield* stroll(b);
          yield* pirouette(b); yield* sandbags(b, 3); yield* flourish(b);
          yield* blackout(b, 2, 4.2); yield* stroll(b);
          yield* flood(b, [rnd() < 0.5 ? 'F' : 'B']); yield* birds(b, -1, 3); yield* pirouette(b);
          yield* encore(b); yield* scenery(b, 2); yield* stroll(b);
        }
      } },
      { at: 0.34, *enter(b) {
        const S = b.state; b.autoFace = false; S.gesture = 1;
        yield* b.cast({ name: 'Curtain', time: 2.2, onTick: (k) => { FX.shake(k * 0.4); S.pitY = 1 - k; } }); S.pitY = 0;
        setAct(b, 2); Sound.sfx('shatter'); Sound.sfx('roar', 0.8, 0.5); FX.flash(VIO, 0.6, 1.2); FX.shake(1.2);
        for (const L of S.layers) FX.burst(L.m.position.x + rnd(-12, 12), L.m.position.y, L.m.position.z, { n: 40, color: 0xffb060, color2: 0xff3010, speed: [2, 10], up: 4, grav: 5, life: [0.8, 1.8], size: [0.2, 0.6], radius: 8 });
        Co.start(Post.lerpTo({ tint: [1.02, 0.94, 1.08], bloom: 0.8, exposure: 1.14 }, 2), 'fight'); S.back.color.set(VIO); S.back.intensity = 200;
        const d1 = S.dolls[1]; d1.drop = 1; yield* W.tween(1.8, (k) => { S.burn = k; d1.drop = 1 - k; for (const H of S.hands) H.g.position.y = lerp(30, H.home.y, k); }); b.autoFace = true; yield 0.4;
      }, *run(b) {
        const S = b.state; setAct(b, 2); S.burn = 1; S.pitY = 0; b.autoFace = true; for (const H of S.hands) if (H.g.position.y > 20) H.g.position.copy(H.home);
        while (true) {
          yield* slam(b, 3); yield* flood(b, [rnd() < 0.5 ? 'L' : 'R', rnd() < 0.5 ? 'F' : 'B'], 1.9); yield* trapdoor(b, 1.1);
          yield* knives(b, 6, 0.6); yield* stroll(b);
          yield* blackout(b, 2, 4.4); yield* slam(b, 2);
          yield* scenery(b, 2); yield* birds(b, rnd() < 0.5 ? -1 : 1, 3);
          yield* encore(b); yield* flood(b, ['L']); yield* flood(b, ['F'], 1.4); yield* slam(b, 3); yield* stroll(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, dl = dolls(S);
      // anything that lands on an understudy lands on you
      if (p.alive && G.state === 'fight') {
        for (const h of Hz.list) if (h.state === 'fired' && !h._d && h.dmg) { h._d = 1; if (p.lastHurt === G.now) continue; for (const d of dl) { const q = dpos(d, _b2); if (Hz.inShape(h.shape, q.x, q.z) !== !!h.invert) { dollHurt(b, d, h.dmg, { blockable: h.blockable }); break; } } }
        S.dz -= dt; if (S.dz <= 0) { S.dz = 0.5; for (const d of dl) { const q = dpos(d, _b2); for (const h of Hz.list) if (h.state === 'zone' && h.dmg && Hz.inShape(h.shape, q.x, q.z)) { dollHurt(b, d, h.dmg, { dot: true, blockable: false }); break; } } }
        for (const bl of Bul.list) { if (bl.t < 0.08 || bl.dead) continue; for (const d of dl) { const q = dpos(d, _b2); if (Math.hypot(q.x - bl.x, q.z - bl.z) < bl.r + 0.4) { bl.dead = true; dollHurt(b, d, bl.dmg); break; } } }
      }
      for (const f of S.flats) { if (f.hold > 0) { f.hold -= dt; if (f.hold <= 0) f.tx = f.sx * 30; } f.x = damp(f.x, f.tx, f.hold > 0 ? 14 : 3, dt); }
      if (G.headless) return;
      for (const f of S.flats) f.m.position.x = f.x;
      S.twang = Math.max(0, S.twang - dt * 3); S.gesture = Math.max(0, S.gesture - dt * 1.2);
      // understudies copy the player's body
      const pm = p.model;
      for (const d of S.dolls) {
        if (!d.on) continue; const q = dpos(d, _b2), M = d.M, drop = (d.drop || 0) * 16;
        M.group.position.set(q.x, p.pos.y + drop, q.z); M.group.rotation.y = d.mode === 'x' ? -p.facing : PI - p.facing; M.group.scale.x = -1;
        d.fake.moveSpeed = p.moveSpeed; d.fake.grounded = p.grounded; d.fake.casting = p.casting; d.fake.parryT = p.parryT; d.fake.rollT = p.rollT; d.fake.aimT = p.aimT; d.fake.loadT = p.loadT; d.fake.flashT = p.flashT;
        M.anim.swing = pm.anim.swing; M.anim.swingDur = pm.anim.swingDur; M.anim.swingKind = pm.anim.swingKind; M.update(dt, d.fake); if (pm.anim.swing > 0) M.anim.swing = pm.anim.swing;
        d.bar.position.set(q.x, 8.5 + drop + Math.sin(t * 2 + q.x) * 0.1, q.z); d.bar.rotation.y = M.group.rotation.y;
        const A = d.ln.geometry.attributes.position.array, tw = S.twang * 0.15; let k = 0;
        for (const [ox, oy, oz] of [[0.35, 1.5, 0], [-0.35, 1.5, 0], [0, 2.05, 0], [0, 1.0, -0.2]]) { const c = Math.cos(M.group.rotation.y), s = Math.sin(M.group.rotation.y), wx = q.x + ox * c + oz * s, wz = q.z - ox * s + oz * c; A[k++] = wx + (vrand() - 0.5) * tw; A[k++] = p.pos.y + oy + drop; A[k++] = wz; A[k++] = q.x + ox * c * 1.6; A[k++] = 8.5 + drop; A[k++] = q.z - ox * s * 1.6; }
        d.ln.geometry.attributes.position.needsUpdate = true; d.ln.material.opacity = 0.55 + S.twang * 0.45;
      }
      // the boss
      const cast = b.castState ? 1 : 0, ges = Math.max(S.gesture, cast * 0.7);
      S.rig.position.y = 0.35 + Math.sin(t * 1.5) * 0.14; S.rig.rotation.z = Math.sin(t * 0.8) * 0.04; if (S.spin) S.rig.rotation.y += dt * 14; else S.rig.rotation.y = damp(S.rig.rotation.y % TAU, 0, 8, dt);
      S.head.rotation.z = Math.sin(t * 1.1) * 0.12 + ges * 0.15; S.head.rotation.x = -ges * 0.2;
      for (const A of S.arms) { A.sh.rotation.set(-0.4 - ges * (A.sx > 0 ? 2.2 : 0.9) + Math.sin(t * 1.7 + A.sx) * 0.1, 0, A.sx * (0.4 + ges * 0.5)); A.el.rotation.x = -0.8 + ges * 0.5 + Math.sin(t * 2.3 + A.sx * 2) * 0.1; }
      S.trim.emissiveIntensity = 1.4 + cast * 2 + Math.sin(t * 3) * 0.2; S.eyeM.color.setHex(VIO).multiplyScalar(3 + cast * 4);
      { const A = S.bossStr.geometry.attributes.position.array; let k = 0; const top = S.act === 2 ? S.hands[0].g.position : null; for (const [ox, oy] of [[0.5, 3.8], [-0.5, 3.8], [0, 5.9]]) { A[k++] = b.pos.x + ox; A[k++] = oy + S.rig.position.y; A[k++] = b.pos.z; A[k++] = top ? lerp(b.pos.x, 0, 0.5) + ox * 3 : b.pos.x + ox * 1.5; A[k++] = top ? 22 : 15; A[k++] = top ? -12 : b.pos.z; } S.bossStr.geometry.attributes.position.needsUpdate = true; S.bossStr.material.opacity = S.act === 2 ? 0.7 : 0.25; }
      // light
      const dk = S.darkK = damp(S.darkK || 0, S.dark, 6, dt);
      S.key.intensity = 3.0 * (1 - dk * 0.9); S.hemi.intensity = 0.85 * (1 - dk * 0.8); S.foot.intensity = 150 * (1 - dk * 0.9) * (0.95 + Math.sin(t * 11) * 0.03); S.footGlow.color.setHex(0xffc070).multiplyScalar(3.2 * (1 - dk * 0.85));
      for (const c of S.cones) if (c.visible) c.material.uniforms.uA.value = 0.3 + dk * 0.5 + Math.sin(t * 5 + c.position.x) * 0.04;
      // scenery
      for (const L of S.layers) { if (L.amp) L.m.position.x = Math.sin(t * L.sp) * L.amp; if (S.burn) { L.m.position.y -= dt * S.burn * 3; L.m.visible = L.m.position.y > -8; } }
      if (S.burn) { for (let i = 0; i < 3; i++) S.drop.children[i].visible = S.burn < 0.7; S.drop.children[0].material.emissiveIntensity = 0.5 * (1 - S.burn); S.drop.children[0].material.color.setScalar(1 - S.burn * 0.95); S.moonM.color.setHex(0xfff4d0).multiplyScalar(2.6 * (1 - S.burn)); S.gEye.color.setHex(VIO).multiplyScalar(0.1 + S.burn * (5 + Math.sin(t * 2) * 1.5)); S.gL.intensity = S.burn * 260; }
      S.centre.position.y = -0.6 - S.pitY * 9; for (let i = 0; i < S.pitWaves.length; i++) S.pitWaves[i].position.z = 0.4 + Math.sin(t * (0.8 + i * 0.2) + i * 2) * 1.2;
      for (const H of S.hands) { if (!S.giant.visible) break; H.g.position.lerp(H.tgt, 1 - Math.exp(-(H.fast ? 30 : 2.5) * dt)); H.g.position.y += Math.sin(t * 1.2 + H.sx) * 0.01; H.g.rotation.x = H.fast ? 0 : 0.25 + Math.sin(t * 0.9 + H.sx) * 0.08; }
    },
    danger(b, x, z) {
      const S = b.state; let best = Infinity;
      for (const d of dolls(S)) { const m = mir(d, x, z, _a); best = Math.min(best, Hz.threat(m.x, m.z)); if (Hz.persist(m.x, m.z)) best = 0; if (Bul.threat(m.x, m.z, 0.7)) best = Math.min(best, 0.5); }
      if (S.black) { const B = S.black; if (Math.hypot(x - B.q.x, z - B.q.z) > B.r - 1.0) best = Math.min(best, Math.max(0, B.at - G.now)); }
      return best;
    },
    bot(b, p) {
      const S = b.state, h = {};
      if (S.black) return { x: S.black.q.x, z: S.black.q.z, w: 3 };
      if (S.split) { const side = p.pos.z >= b.pos.z ? 1 : -1, off = p.cls.melee ? b.radius + 1.7 : 6; let tz = b.pos.z + side * off; if (Math.abs(tz) > HZ - 1) tz = b.pos.z - side * off; h.x = -b.pos.x; h.z = tz; h.w = 1.5; }
      return h;
    },
  });
})();
