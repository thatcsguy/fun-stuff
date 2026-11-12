// DOOR XVII: THE HOROLOGIST, the Thirteenth Hour. You fight on the face of a colossal clock. The hands are real,
// and they strike where they WILL be when the bell tolls, not where they are. Time here is his to wind, reverse and stop.
(() => {
  const R = 20, GOLD = 0xffc860, BLUE = 0x7fc4ff, RED = 0xff4a3a, TEL = 0xffb040;
  const HANDS = { min: { len: 19.4, hw: 0.55, w: 0.2094, r0: 2.8, arc: 0.5236, dmg: 420 }, hour: { len: 11.2, hw: 0.9, w: 0.0349, r0: 2.8, arc: 0.7854, dmg: 380 }, sec: { len: 19.4, hw: 0.28, w: 1.0472, r0: 2.8 } };
  // outline of each floor hand from tail to tip as [distance from the hub, half width], plus [distance, radius] holes
  const HPROF = {
    hour: { p: [[0.9, 0], [1.0, 0.42], [1.35, 0.62], [1.9, 0.6], [2.35, 0.4], [2.8, 0.9], [6.3, 0.9], [6.75, 1.3], [7.15, 1.42], [7.55, 1.3], [8.0, 0.9], [9.35, 0.9], [9.5, 1.6], [9.95, 1.35], [11.2, 0]], h: [] },
    min: { p: [[0.9, 0], [1.0, 0.36], [1.4, 0.52], [1.9, 0.5], [2.35, 0.32], [2.8, 0.55], [12.9, 0.55], [13.3, 0.95], [13.6, 1.05], [13.9, 0.95], [14.3, 0.55], [17.6, 0.55], [17.75, 1.05], [18.2, 0.85], [19.4, 0]], h: [[13.6, 0.5], [1.45, 0.22]] },
    sec: { p: [[0.3, 0], [0.4, 0.45], [0.9, 0.62], [1.5, 0.45], [2.2, 0.18], [2.8, 0.28], [17.9, 0.28], [18.05, 0.5], [19.4, 0]], h: [[0.95, 0.3]] },
  };
  const c2a = (c) => PI - c, a2c = (a) => PI - a; // clock angle (clockwise from XII, which is north = -Z) <-> world angle
  const _c = new THREE.Color(), _v = new V3(), _w = new V3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), YUP = new V3(0, 1, 0), ZAX = new V3(0, 0, 1);
  const eff = (S) => S.stop ? 0 : S.flow * S.base * S.ff;

  // fresnel rim added to a standard material's emissive, so dark forms turn against the sky
  function withRim(mat, colorObj, power = 2.6) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: colorObj };
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim;\nvoid main() {').replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRim * pow(max(fr, 0.0), ' + power.toFixed(2) + '); }');
    };
    mat.customProgramCacheKey = () => 'rim' + power; return mat;
  }
  // floor hand: darker inset channel down the middle, bevelled edges stay bright, a hot core that can glow, cool rim
  function handMat(o, rimObj, hotObj, hw, cwObj) {
    const m = new THREE.MeshStandardMaterial(o); m.userData.ed = { value: 0 };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: rimObj }; sh.uniforms.uHot = { value: hotObj }; sh.uniforms.uHw = { value: hw }; sh.uniforms.uCw = cwObj; sh.uniforms.uEd = m.userData.ed;
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vLp; varying float vBv;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp = position; vBv = 1.0 - abs(objectNormal.y);');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying vec3 vLp; varying float vBv; uniform vec3 uRim, uHot; uniform float uHw, uCw, uEd;\nvoid main() {')
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat hx = abs(vLp.x) / max(uHw, 1e-3); diffuseColor.rgb *= mix(mix(0.5, 1.0, smoothstep(0.25, 0.7, hx)), 0.34 + 0.3 * smoothstep(0.12, 0.32, hx) + 1.1 * smoothstep(0.08, 0.45, clamp(vBv, 0.0, 1.0)), uEd);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float core = 1.0 - smoothstep(0.0, max(uCw, 0.05), clamp(abs(vLp.x) / max(uHw, 1e-3), 0.0, 1.0)); vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uHot * core * core + uRim * pow(max(fr, 0.0), 3.0); }');
    };
    m.customProgramCacheKey = () => 'clockhand'; return m;
  }
  function handShape(k, pad) {
    const P = HPROF[k].p, pts = [];
    for (const [z, w] of P) pts.push(new THREE.Vector2(w > 0 ? w + pad : 0, -z));
    for (let i = P.length - 1; i >= 0; i--) if (P[i][1] > 0) pts.push(new THREE.Vector2(-(P[i][1] + pad), -P[i][0]));
    const sh = new THREE.Shape(pts);
    for (const [z, r] of HPROF[k].h) { const ho = new THREE.Path(); ho.absarc(0, -z, Math.max(0.05, r - pad), 0, TAU, true); sh.holes.push(ho); }
    return sh;
  }
  function gearShape(r, teeth, hr) {
    const sh = new THREE.Shape(), n = teeth * 4;
    for (let i = 0; i <= n; i++) { const a = i / n * TAU, rr = (i % 4 < 2) ? r : r * 0.86; if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const hole = new THREE.Path(); hole.absarc(0, 0, hr, 0, TAU, true); sh.holes.push(hole); return sh;
  }
  function gearMesh(r, teeth, mat, thick, bev) {
    const sh = gearShape(r, teeth, r * 0.62);
    const g = new THREE.Group(), m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: bev ? bev : thick * 0.12, bevelSize: bev ? bev : Math.min(0.25, r * 0.012), bevelSegments: bev ? 2 : 1, curveSegments: 20 }), mat); m.position.z = -thick / 2; g.add(m);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.3, r * 0.1, thick * 0.6), mat); sp.rotation.z = i / 3 * PI; g.add(sp); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, thick * 1.4, 14), mat); hub.rotation.x = PI / 2; g.add(hub);
    return g;
  }
  // the dial: colour (ivory enamel, aged and crazed, darker toward the rim), engraved relief as a normal map, brass inlay in the rose
  function faceTexture() {
    const N = 1024, h = N / 2, u = N / (2 * R), rr = mulberry(41), mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
    const cv = mk(), x = cv.getContext('2d'), hc = mk(), y = hc.getContext('2d'), mc = mk(), z = mc.getContext('2d');
    const gr = x.createRadialGradient(h, h, 0, h, h, h); gr.addColorStop(0, '#f4ecd6'); gr.addColorStop(0.6, '#ebe0c2'); gr.addColorStop(0.86, '#dccca4'); gr.addColorStop(0.97, '#b8a478'); gr.addColorStop(1, '#8a7650'); x.fillStyle = gr; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 260; i++) { const px = rr() * N, py = rr() * N, s = 10 + rr() * 60, g2 = x.createRadialGradient(px, py, 0, px, py, s); g2.addColorStop(0, 'rgba(130,95,45,' + (0.03 + rr() * 0.05).toFixed(3) + ')'); g2.addColorStop(1, 'rgba(130,95,45,0)'); x.fillStyle = g2; x.fillRect(px - s, py - s, s * 2, s * 2); }
    y.fillStyle = '#fff'; y.fillRect(0, 0, N, N); z.fillStyle = 'rgb(0,80,0)'; z.fillRect(0, 0, N, N);
    // crazing: a fine network of hairline cracks in the enamel
    for (let i = 0; i < 700; i++) { let px = rr() * N, py = rr() * N, a = rr() * TAU; x.beginPath(); y.beginPath(); x.moveTo(px, py); y.moveTo(px, py); for (let j = 0; j < 6; j++) { a += (rr() - 0.5) * 1.6; px += Math.cos(a) * (6 + rr() * 10); py += Math.sin(a) * (6 + rr() * 10); x.lineTo(px, py); y.lineTo(px, py); }
      x.strokeStyle = 'rgba(95,72,40,0.13)'; x.lineWidth = 0.8; x.stroke(); y.strokeStyle = 'rgba(0,0,0,0.25)'; y.lineWidth = 0.8; y.stroke(); }
    const ring = (r, w, a) => { for (const c of [x, y]) { c.beginPath(); c.arc(h, h, r * u, 0, TAU); c.lineWidth = w; c.strokeStyle = c === x ? 'rgba(106,74,28,' + a + ')' : '#000'; c.stroke(); } x.beginPath(); x.arc(h, h, r * u + w * 0.5 + 1, 0, TAU); x.lineWidth = 1.4; x.strokeStyle = 'rgba(255,250,236,0.55)'; x.stroke(); };
    for (const r of [19.3, 14.2, 3.4]) ring(r, 5, 1); for (const r of [8.8, 11.6]) ring(r, 1.5, 0.45);
    for (let i = 0; i < 60; i++) { const c = i / 60 * TAU; for (const q of [x, y]) { q.save(); q.translate(h, h); q.rotate(c); q.fillStyle = q === x ? '#3a2a14' : '#000'; if (i % 5 === 0) q.fillRect(-4, -19.3 * u, 8, 1.5 * u); else q.fillRect(-1.5, -19.3 * u, 3, 0.7 * u); q.restore(); } }
    for (let i = 0; i < 12; i++) { x.save(); x.translate(h, h); x.rotate(i / 12 * TAU + PI / 12); x.fillStyle = 'rgba(106,74,28,0.22)'; x.fillRect(-1, -14.2 * u, 2, 10.8 * u); x.restore(); }
    const NUM = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (const q of [x, y]) { q.fillStyle = q === x ? '#2a1c0c' : '#000'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.font = 'bold 62px Georgia, "Times New Roman", serif'; for (let i = 0; i < 12; i++) { q.save(); q.translate(h, h); q.rotate(i / 12 * TAU); q.fillText(NUM[i], 0, -16.6 * u); q.restore(); } }
    // a compass rose of brass filigree inlaid at the hub
    for (let i = 0; i < 24; i++) { for (const q of [x, z]) { q.save(); q.translate(h, h); q.rotate(i / 24 * TAU); q.fillStyle = q === z ? 'rgb(0,70,190)' : i % 2 ? '#c09040' : '#7a5422'; q.beginPath(); q.moveTo(0, -8.6 * u); q.lineTo(0.5 * u, -3.6 * u); q.lineTo(-0.5 * u, -3.6 * u); q.fill(); q.restore(); } }
    for (let i = 0; i < 24; i++) { x.save(); x.translate(h, h); x.rotate(i / 24 * TAU); x.strokeStyle = 'rgba(60,40,16,0.7)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, -8.6 * u); x.lineTo(0.5 * u, -3.6 * u); x.lineTo(-0.5 * u, -3.6 * u); x.closePath(); x.stroke(); x.restore(); }
    // relief -> normal map (soften the height first so engraved lines read as bevelled grooves)
    const hb = mk(), hbx = hb.getContext('2d'); hbx.filter = 'blur(1.3px)'; hbx.drawImage(hc, 0, 0); const H = hbx.getImageData(0, 0, N, N).data, nc = mk(), nx = nc.getContext('2d'), im = nx.createImageData(N, N), st = 2.4 / 255;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = (j * N + i) * 4, l = H[(j * N + Math.max(0, i - 1)) * 4], r2 = H[(j * N + Math.min(N - 1, i + 1)) * 4], t2 = H[(Math.max(0, j - 1) * N + i) * 4], b2 = H[(Math.min(N - 1, j + 1) * N + i) * 4];
      let a = (l - r2) * st, b = (t2 - b2) * st; const L = Math.hypot(a, b, 1); im.data[k] = (a / L * 0.5 + 0.5) * 255; im.data[k + 1] = (-b / L * 0.5 + 0.5) * 255; im.data[k + 2] = (1 / L * 0.5 + 0.5) * 255; im.data[k + 3] = 255; }
    nx.putImageData(im, 0, 0);
    const t = (c, srgb) => { const q = new THREE.CanvasTexture(c); if (srgb) q.colorSpace = THREE.SRGBColorSpace; q.anisotropy = 8; return q; };
    return { map: t(cv, true), nrm: t(nc), mr: t(mc) };
  }
  function textTexture(str, color, edge) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 96px Georgia, "Times New Roman", serif'; if (edge) { x.lineWidth = 9; x.strokeStyle = edge; x.lineJoin = 'round'; x.strokeText(str, 128, 68); } x.fillText(str, 128, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function canvasTex(n, fn, srgb = true) { const cv = document.createElement('canvas'); cv.width = cv.height = n; fn(cv.getContext('2d'), n); const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
  const radial = (stops) => canvasTex(128, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); for (const [o, c] of stops) g.addColorStop(o, c); x.fillStyle = g; x.fillRect(0, 0, n, n); });
  const crackLines = (x, n, seed, cx, cy, count, len, w) => { const r = mulberry(seed); for (let i = 0; i < count; i++) { let px = cx(r), py = cy(r), a = r() * TAU; x.beginPath(); x.moveTo(px, py); const m = 3 + Math.floor(r() * len); for (let j = 0; j < m; j++) { a += (r() - 0.5) * 1.1; px += Math.cos(a) * n * 0.03 * (0.5 + r()); py += Math.sin(a) * n * 0.03 * (0.5 + r()); x.lineTo(px, py); } x.lineWidth = w * (0.6 + r() * 0.8); x.stroke(); } };

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x04050e, horizon: 0x1a2244, bottom: 0x02030a, stars: 1.7, nebula: 0.7, nebulaA: 0x40308a, nebulaB: 0x105088, sunSize: 0, sunGlow: 0, exp: 0.7 });
    g.add(sky); S.sky = sky; W.env(sky, 1.0);
    scene.fog = new THREE.FogExp2(0x070a18, 0.004); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x8c9cd0, 0x7a6040, 0.95);
    S.sun = W.sun(g, { dir: [0.25, 1, 0.35], color: 0xffe4b8, intensity: 2.5, size: 30 });
    const ft = faceTexture();
    S.faceM = new THREE.MeshPhysicalMaterial({ map: ft.map, normalMap: ft.nrm, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: ft.mr, metalnessMap: ft.mr, roughness: 1, metalness: 1, clearcoat: 0.55, clearcoatRoughness: 0.28, envMapIntensity: 0.7, color: 0xd6cfc0 });
    const face = new THREE.Mesh(new THREE.CircleGeometry(R, 96), S.faceM); face.rotation.x = -PI / 2; face.receiveShadow = true; g.add(face);
    S.rimC = new THREE.Color(0x3a5a9a); S.gearRim = new THREE.Color(0xd08a30);
    const brass = W.mat({ color: 0xb8893c, roughness: 0.38, metalness: 0.95 }), dkbrass = W.mat({ color: 0x6a4a20, roughness: 0.45, metalness: 0.9 }), steel = W.mat({ color: 0x2a3348, roughness: 0.4, metalness: 0.9 });
    const bbrass = withRim(W.mat({ color: 0xb8893c, roughness: 0.38, metalness: 0.95 }), S.rimC, 2.6), bdk = withRim(W.mat({ color: 0x6a4a20, roughness: 0.45, metalness: 0.9 }), S.rimC, 2.6);
    S.rimM = W.mat({ color: 0xb8893c, roughness: 0.36, metalness: 0.95, emissive: 0xff3010, emissiveIntensity: 0 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.3, 0.55, 10, 96), S.rimM); rim.rotation.x = PI / 2; rim.position.y = 0.2; rim.castShadow = true; g.add(rim);
    S.lipM = W.glow(0xff6a20, 0); S.lip = new THREE.Mesh(new THREE.TorusGeometry(R - 0.2, 0.09, 6, 120), S.lipM); S.lip.rotation.x = PI / 2; S.lip.position.y = 0.12; S.lip.visible = false; g.add(S.lip);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.8, R - 2, 9, 64, 1, true), dkbrass); skirt.position.y = -4.6; g.add(skirt);
    // the movement: gears turning all around, at the speed and in the direction time is flowing (rim-lit so they read as machinery)
    const gBr = withRim(W.mat({ color: 0x8a6a3a, roughness: 0.55, metalness: 0.45 }), S.gearRim, 3.2), gDk = withRim(W.mat({ color: 0x3a2c1c, roughness: 0.6, metalness: 0.4 }), S.gearRim, 3.2), gSt = withRim(W.mat({ color: 0x2e3440, roughness: 0.55, metalness: 0.45 }), S.gearRim, 3.2);
    { const mt = W.surface('metal', { size: 256, seed: 4 }); for (const tx of [mt.map, mt.normalMap, mt.roughnessMap]) tx.repeat.set(0.09, 0.09); S.outerM = W.mat({ map: mt.map, normalMap: mt.normalMap, roughnessMap: mt.roughnessMap, color: 0x4a3a28, roughness: 0.75, metalness: 0.4 }); S.outerRim = new THREE.Color(0x804818);
      S.outerM.onBeforeCompile = (sh) => { sh.uniforms.uRim = { value: S.outerRim }; sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim;\nvoid main() {')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 nW = (vec4(normal, 0.0) * viewMatrix).xyz; nW /= max(length(nW), 1e-4); float sd = 1.0 - abs(nW.y); float bev = smoothstep(0.08, 0.25, sd) * (1.0 - smoothstep(0.55, 0.8, sd)); vec2 hz = nW.xz / max(length(nW.xz), 1e-4); float sun = 0.35 + 0.65 * max(dot(hz, vec2(0.58, 0.81)), 0.0); totalEmissiveRadiance += uRim * (bev * sun * 1.1 + (1.0 - smoothstep(0.0, 0.1, sd)) * 0.1); diffuseColor.rgb *= mix(1.35, 0.5, smoothstep(0.7, 0.95, sd)); }'); };
      S.outerM.customProgramCacheKey = () => 'clockouter'; }
    S.gears = []; const gr = mulberry(17);
    for (const [r, x, y, z, t] of [[31, 10, -3.2, 6, 30], [22, -30, -5, -22, 24]]) { const m = gearMesh(r, t, S.outerM, 1.6, 0.45); m.rotation.x = PI / 2; m.position.set(x, y, z); g.add(m); S.gears.push({ m, k: 0.22 * (S.gears.length % 2 ? -1 : 1), flat: true }); }
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.4, d = 30 + gr() * 16, r = 5 + gr() * 11, m = gearMesh(r, Math.round(r * 2.2), i % 3 ? gBr : gSt, 0.9 + r * 0.06); m.position.set(Math.sin(a) * d, 2 + gr() * 22, Math.cos(a) * d); m.rotation.y = a + (gr() - 0.5) * 0.5; g.add(m); S.gears.push({ m, k: (i % 2 ? 1 : -1) * 4.4 / r }); }
    S.pend = new THREE.Group(); S.pend.position.set(0, 44, -6); g.add(S.pend);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 34, 8), gBr); rod.position.y = -17; S.pend.add(rod);
    { const rk = W.surface('rock', { size: 256, seed: 9 }); S.bobRim = new THREE.Color(0x5a3a14); S.bobM = withRim(W.mat({ color: 0xb8893c, roughness: 0.5, metalness: 0.95, roughnessMap: rk.roughnessMap, normalMap: rk.normalMap, normalScale: new THREE.Vector2(0.7, 0.7) }), S.bobRim, 3.0); }
    const bob = new THREE.Mesh(new THREE.SphereGeometry(4.2, 40, 24), S.bobM); bob.position.y = -34; S.pend.add(bob);
    // thirteenth hour: the bob becomes an eclipse, a burning ring around a dark disc
    S.eclM = new THREE.MeshBasicMaterial({ color: 0xff5020, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: radial([[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0)'], [0.7, 'rgba(255,170,90,1)'], [0.76, 'rgba(255,90,40,0.7)'], [1, 'rgba(0,0,0,0)']]) });
    S.eclM.side = THREE.DoubleSide; S.ecl = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), S.eclM); S.ecl.position.set(0, -34, 0); S.pend.add(S.ecl);
    S.bhM = new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, map: radial([[0, 'rgba(0,0,0,0)'], [0.56, 'rgba(0,0,0,0)'], [0.6, 'rgba(255,255,255,0.5)'], [0.72, 'rgba(255,255,255,0.12)'], [1, 'rgba(0,0,0,0)']]) }); const bh = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), S.bhM); bh.position.set(0, -34, -0.05); S.pend.add(bh);
    S.motes = W.motes({ n: 260, box: [60, 26, 60], color: 0xffe0a0, size: 0.16, vel: [0.1, 0.25, 0.05], sway: 0.6, center: [0, 12, 0], alpha: 0.5 }); g.add(S.motes);
    // phase two: stopped droplets hanging in the air; phase three: embers rising off the heated rim
    S.drops = W.motes({ n: 320, box: [40, 3.2, 40], color: 0xdff0ff, mult: 1.6, size: 0.24, vel: [0, 0, 0], sway: 0, center: [0, 2.3, 0], alpha: 1 }); S.drops.visible = false; g.add(S.drops);
    S.embers2 = W.motes({ n: 160, box: [10, 12, 10], color: 0xffb060, mult: 2.2, size: 0.18, vel: [0.1, 1.5, 0.05], sway: 0.6, center: [0, 10, 0], alpha: 1 }); S.embers2.visible = false; g.add(S.embers2);
    S.embers = W.motes({ n: 900, box: [44, 12, 44], color: 0xffa050, mult: 2.4, size: 0.16, vel: [0.15, 1.3, 0.1], sway: 0.9, center: [0, 10, 0], alpha: 1 }); S.embers.visible = false; g.add(S.embers);
    S.flakes = W.motes({ n: 110, box: [40, 10, 40], color: 0xffb870, mult: 2.0, size: 0.4, vel: [0.1, 2.2, 0.05], sway: 0.4, center: [0, 10, 0], alpha: 0.9, streak: true }); S.flakes.visible = false; g.add(S.flakes);
    S.embersBig = W.motes({ n: 60, box: [40, 6, 40], color: 0xff8040, mult: 1.0, size: 0.55, vel: [0.1, 0.6, 0.05], sway: 1.2, center: [0, 13, 0], alpha: 0.45 }); S.embersBig.visible = false; g.add(S.embersBig);
    S.heatM = new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform float uA; varying vec2 vP; void main(){ float r=length(vP); float a=pow(clamp((r-16.6)/3.2,0.0,1.0),2.2)*uA; gl_FragColor=vec4(vec3(1.0,0.4,0.12)*a,a); }' });
    S.heat = new THREE.Mesh(new THREE.RingGeometry(16.5, R - 0.1, 96, 1), S.heatM); S.heat.rotation.x = -PI / 2; S.heat.position.y = 0.05; S.heat.renderOrder = 3; S.heat.visible = false; g.add(S.heat);
    { const cg = new THREE.ExtrudeGeometry(gearShape(0.22, 9, 0.08), { depth: 0.05, bevelEnabled: false, curveSegments: 6 }); cg.translate(0, 0, -0.025); const r = mulberry(29); S.cogs = new THREE.InstancedMesh(cg, W.mat({ color: 0xb08638, roughness: 0.5, metalness: 0.7, emissive: 0x8ab8ff, emissiveIntensity: 0.12 }), 44);
      for (let i = 0; i < 44; i++) { const a = r() * TAU, d = 3 + Math.sqrt(r()) * 15, q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * TAU, r() * TAU, 0)); _m.compose(new V3(Math.sin(a) * d, 1.4 + r() * 2.2, Math.cos(a) * d), q, new V3(1, 1, 1).multiplyScalar(0.7 + r() * 0.9)); S.cogs.setMatrixAt(i, _m); } S.cogs.visible = false; g.add(S.cogs); }
    // the hands
    S.handRim = new THREE.Color(0x30487a); S.hand = {}; const shadM = new THREE.MeshBasicMaterial({ color: 0x0a0604, transparent: true, opacity: 0.42, depthWrite: false });
    for (const k of ['hour', 'min', 'sec']) {
      const H = HANDS[k], gp = new THREE.Group(), hot = new THREE.Color(0, 0, 0), cw = { value: 1 };
      const mat = handMat({ color: k === 'sec' ? 0x7a1a12 : 0x8a6228, roughness: 0.34, metalness: 0.85, emissive: 0x000000 }, S.handRim, hot, H.hw, cw);
      const y = k === 'hour' ? 0.26 : k === 'min' ? 0.34 : 0.42;
      const hg = new THREE.ExtrudeGeometry(handShape(k, -0.05), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 14 }); hg.rotateX(-PI / 2); hg.translate(0, y - 0.06, 0);
      const hm = new THREE.Mesh(hg, mat); hm.castShadow = true; gp.add(hm);
      const sg = new THREE.ShapeGeometry(handShape(k, 0.13), 14); sg.rotateX(-PI / 2); const sm = new THREE.Mesh(sg, shadM); sm.position.y = 0.022 + (k === 'min' ? 0.002 : 0); sm.renderOrder = 2; gp.add(sm);
      gp.visible = k !== 'sec'; g.add(gp); S.hand[k] = { H, g: gp, mat, hot, cw, c: k === 'min' ? 2.3 : k === 'hour' ? 5.1 : 0.4, cd: 0, on: k !== 'sec' };
    }
    // chime counter: glass lamps set in brass grommets along the hour hand (dark glass until lit)
    S.gromM = W.mat({ color: 0xc8963c, roughness: 0.35, metalness: 0.8, emissive: 0x6a4010, emissiveIntensity: 0.25 }); const grom = new THREE.TorusGeometry(0.34, 0.08, 6, 18), dome = new THREE.SphereGeometry(0.26, 14, 8, 0, TAU, 0, PI / 2);
    S.pipM = [0, 1, 2, 3, 4, 5].map((i) => { const m = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.08, metalness: 0.1, emissive: GOLD, emissiveIntensity: 0 }), s = new THREE.Mesh(dome, m); s.scale.y = 0.75; s.position.set(0, 0.36, 4.0 + i * 1.05); S.hand.hour.g.add(s); const gm = new THREE.Mesh(grom, S.gromM); gm.rotation.x = PI / 2; gm.position.set(0, 0.37, 4.0 + i * 1.05); S.hand.hour.g.add(gm); return m; });
    S.xiii = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.7), new THREE.MeshBasicMaterial({ map: textTexture('XIII', '#ffe6a8', '#3a0c04'), transparent: true, depthWrite: false, color: 0xffffff, fog: false }));
    { const c = PI / 12, a = c2a(c), px = Math.sin(a) * 12.9, pz = Math.cos(a) * 12.9; S.xiii.position.set(px, 0.06, pz); S.xiii.rotation.order = 'YXZ'; S.xiii.rotation.set(-PI / 2, -c, 0); S.xiii.visible = false; S.xiii.renderOrder = 4; g.add(S.xiii);
      // ceremony for the hour that should not exist: a pulsing halo on the dial, a column of light and rising motes
      S.xHaloM = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: radial([[0, 'rgba(255,255,255,0.7)'], [0.6, 'rgba(255,255,255,0.35)'], [0.78, 'rgba(255,255,255,0.8)'], [0.9, 'rgba(0,0,0,0)']]) });
      S.xHalo = new THREE.Mesh(new THREE.CircleGeometry(2.7, 40), S.xHaloM); S.xHalo.rotation.x = -PI / 2; S.xHalo.position.set(px, 0.055, pz); S.xHalo.renderOrder = 3; S.xHalo.visible = false; g.add(S.xHalo);
      S.beamM = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0xffa860) }, uA: { value: 0 }, uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; varying float vE; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vec3 n=normalize(normalMatrix*normal); vec3 v=-mv.xyz/max(length(mv.xyz),1e-4); vE=abs(dot(n,v)); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uA,uT; varying vec2 vUv; varying float vE; void main(){ float y=clamp(vUv.y,0.0,1.0); float e=clamp(vE,0.0,1.0); float a=(pow(max(1.0-y,0.0),2.6)+pow(max(1.0-y,0.0),12.0)*1.5)*smoothstep(0.0,0.03,y)*pow(e,1.8)*uA*(0.75+0.25*sin(vUv.x*31.4159+uT*2.0+y*9.0)); gl_FragColor=vec4(uC*a,a); }' });
      S.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.5, 22, 28, 1, true), S.beamM); S.beam.position.set(px, 11, pz); S.beam.visible = false; S.beam.renderOrder = 14; g.add(S.beam);
      S.xMotes = W.motes({ n: 90, box: [2.2, 12, 2.2], color: 0xffc080, mult: 1.8, size: 0.2, vel: [0, 0.9, 0], sway: 0.3, center: [px, 6, pz], alpha: 0.9 }); S.xMotes.visible = false; g.add(S.xMotes); }
    const crackT = canvasTex(1024, (x, n) => { x.fillStyle = '#000'; x.fillRect(0, 0, n, n); x.strokeStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 6; x.lineCap = 'round';
      crackLines(x, n, 7, (r) => n / 2 + Math.cos(r() * TAU) * n * (0.08 + r() * 0.38), (r) => n / 2 + Math.sin(r() * TAU) * n * (0.08 + r() * 0.38), 90, 7, 2.2);
      x.lineWidth = 2; for (const rr of [0.17, 0.44]) { const r = mulberry(3); for (let i = 0; i < 36; i++) { const a0 = i / 36 * TAU, a1 = a0 + TAU / 72; if (r() < 0.6) { x.beginPath(); x.arc(n / 2, n / 2, n * rr, a0, a1); x.stroke(); } } } }, false);
    S.crack = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshBasicMaterial({ color: 0xff5a30, transparent: true, opacity: 0, depthWrite: false, alphaMap: crackT }));
    S.crack.rotation.x = -PI / 2; S.crack.position.y = 0.045; S.crack.renderOrder = 3; g.add(S.crack);
    // hourglass over the player's head and the anchor they will be pulled back to
    S.glassM = new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(1.6), transparent: true, opacity: 0.85, depthWrite: false });
    const edgeM = new THREE.MeshBasicMaterial({ color: 0x2a1804, side: THREE.BackSide }), capM = W.mat({ color: 0xc8963c, roughness: 0.35, metalness: 0.8, emissive: 0x6a4010, emissiveIntensity: 0.5 });
    S.glass = new THREE.Group(); for (const s of [1, -1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.45, 10), S.glassM); c.position.y = s * 0.22; c.rotation.x = s > 0 ? PI : 0; S.glass.add(c); const o = new THREE.Mesh(c.geometry, edgeM); o.position.copy(c.position); o.rotation.copy(c.rotation); o.scale.setScalar(1.16); S.glass.add(o); const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 14), capM); cp.position.y = s * 0.47; S.glass.add(cp); } S.glass.visible = false; g.add(S.glass);
    S.anchorG = new THREE.Group(); const ar = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.1, 40), S.glassM); ar.rotation.x = -PI / 2; ar.position.y = 0.07; S.anchorG.add(ar); const ag = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.0, 4, 8), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.3, depthWrite: false })); ag.position.y = 1.0; S.anchorG.add(ag); const ao = new THREE.Mesh(ag.geometry, new THREE.MeshBasicMaterial({ color: 0x3a2404, transparent: true, opacity: 0.55, side: THREE.BackSide, depthWrite: false })); ao.position.y = 1.0; ao.scale.setScalar(1.08); ao.material.opacity = 0.8; S.anchorG.add(ao); for (const y of [0.5, 1.5]) { const rr = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 24), S.glassM); rr.rotation.x = PI / 2; rr.position.y = y; S.anchorG.add(rr); } S.anchorG.visible = false; g.add(S.anchorG);
    // a thin cold outline on every bullet so pale orbs separate from the pale dial
    S.bo = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 9), new THREE.MeshBasicMaterial({ color: 0x0c1a36, side: THREE.BackSide }), 256); S.bo.count = 0; S.bo.frustumCulled = false; g.add(S.bo);
    { const bz = new THREE.TorusGeometry(0.93, 0.15, 6, 28), cr = new THREE.CylinderGeometry(0.22, 0.22, 0.34, 10); cr.translate(0, 1.2, 0); const hd = new THREE.BoxGeometry(0.13, 0.64, 0.02); hd.translate(0, 0.27, 1.04); const hm = new THREE.BoxGeometry(0.17, 0.44, 0.02); hm.translate(0, 0.17, 1.045);
      S.wBezM = new THREE.MeshBasicMaterial({ color: 0x8a6428 }); S.wBez = new THREE.InstancedMesh(bz, S.wBezM, 256); S.wCr = new THREE.InstancedMesh(cr, S.wBezM, 256); S.wH1 = new THREE.InstancedMesh(hd, new THREE.MeshBasicMaterial({ color: 0x1a1408 }), 256); S.wH2 = new THREE.InstancedMesh(hm, S.wH1.material, 256);
      S.wat = [S.wBez, S.wCr, S.wH1, S.wH2]; for (const m of S.wat) { m.count = 0; m.frustumCulled = false; g.add(m); } }
    // ---- the Horologist: a long-case clock in a frock coat ----
    const bg = b.group;
    S.rig = new THREE.Group(); bg.add(S.rig);
    const ct = W.bake(256, (u, v) => { const pu = (u * 8 + 0.5) % 1, e = Math.min(pu, 1 - pu), seam = smooth(sat(e * 14)), n = W.fbm(u * 24, v * 24, 5, 4, 24), nap = W.fbm(u * 64, v * 4, 9, 2, 64); return [seam * 0.8 + n * 0.2, (0.45 + n * 0.35 + nap * 0.2) * (0.55 + 0.45 * seam), 0.82 - n * 0.15]; }, { dark: 0x240710, light: 0x962838, strength: 2 });
    const seamMap = W.bake(128, (u) => { const pu = (u * 8 + 0.5) % 1, e = Math.min(pu, 1 - pu); return [0, 1 - smooth(sat(e * 30)), 0]; }, { dark: 0x000000, light: 0xffffff }).map;
    S.coatM = new THREE.MeshStandardMaterial({ map: ct.map, normalMap: ct.normalMap, roughnessMap: ct.roughnessMap, roughness: 1, metalness: 0.05, emissive: RED, emissiveMap: seamMap, emissiveIntensity: 0, transparent: true }); S.coatT = { value: 0 };
    S.coatM.onBeforeCompile = (sh) => { sh.uniforms.uRim = { value: S.rimC }; sh.uniforms.uT = S.coatT;
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vHy;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHy = position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim; uniform float uT; varying float vHy;\nvoid main() {').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat seamA = 0.0;\n#ifdef USE_EMISSIVEMAP\nseamA = emissiveColor.g;\n#endif\n{ float hk = clamp(1.25 - abs(vHy - 1.7) / 2.6, 0.08, 1.0); totalEmissiveRadiance *= hk * hk * (0.75 + 0.25 * sin(uT * 2.2 - vHy * 1.7)); vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRim * pow(max(fr, 0.0), 2.2); }').replace('#include <opaque_fragment>', '{ vec3 vv2 = vViewPosition / max(length(vViewPosition), 1e-4); float fr2 = 1.0 - clamp(abs(dot(normal, vv2)), 0.0, 1.0); diffuseColor.a = mix(diffuseColor.a, 1.0, clamp(fr2 * fr2 * 1.5 + seamA, 0.0, 1.0)); }\n#include <opaque_fragment>'); };
    S.coatM.customProgramCacheKey = () => 'clockcoat';
    const prof = [[1.6, 0], [1.62, 0.12], [1.52, 0.42], [1.34, 1.0], [1.16, 1.8], [1.0, 2.6], [0.86, 3.12], [0.8, 3.32], [0.88, 3.7], [1.0, 4.2], [1.08, 4.7], [1.12, 5.0], [1.04, 5.24], [0.8, 5.44], [0.42, 5.6], [0.3, 5.72]];
    const rAt = (y) => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return lerp(r0, r1, (y - y0) / (y1 - y0)); } return 0.3; };
    S.rAt = rAt; const body = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40), S.coatM); body.castShadow = true; S.rig.add(body);
    for (const [y, tr] of [[0.06, 0.09], [3.32, 0.06], [5.0, 0.05]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(rAt(y) + 0.02, tr, 6, 40), bbrass); t.rotation.x = PI / 2; t.position.y = y; S.rig.add(t); }
    for (const s of [1, -1]) { const ph = s * TAU / 16, pts = prof.filter((q) => q[1] <= 5.0).map(([r, y]) => new V3(Math.sin(ph) * (r + 0.02), y, Math.cos(ph) * (r + 0.02))); S.rig.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 5, false), bbrass)); }
    { const pts = prof.filter((q) => q[1] <= 3.3).map(([r, y]) => new V3(0, y, -(r + 0.015))); S.rig.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.045, 5, false), new THREE.MeshStandardMaterial({ color: 0x050203, roughness: 0.9 })));
      for (const s2 of [1, -1]) { const ph = PI + s2 * 0.32, bt = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), bbrass); bt.position.set(Math.sin(ph) * (rAt(3.4) + 0.03), 3.4, Math.cos(ph) * (rAt(3.4) + 0.03)); S.rig.add(bt); }
      const kw = new THREE.Group(); kw.position.set(0, 4.85, -rAt(4.85) - 0.05); S.rig.add(kw); const ks = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), bbrass); ks.rotation.x = PI / 2; ks.position.z = -0.12; kw.add(ks); S.backKey = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.06), bbrass); S.backKey.position.z = -0.28; kw.add(S.backKey); }
    // the case window: a swinging pendulum (frozen once the glass cracks), a glowing mainspring at the thirteenth hour
    const arch = (w, h0, h1) => { const s = new THREE.Shape(); s.moveTo(-w, h0); s.lineTo(w, h0); s.lineTo(w, h1 - w); s.absarc(0, h1 - w, w, 0, PI, false); s.lineTo(-w, h0); return s; };
    S.win = new THREE.Group(); S.win.position.set(0, 1.7, rAt(1.7) + 0.045); S.win.rotation.x = -0.21; S.rig.add(S.win);
    S.winM = new THREE.MeshStandardMaterial({ color: 0x0c0708, roughness: 0.18, metalness: 0.3, emissive: 0xff3010, emissiveIntensity: 0.0 });
    S.win.add(new THREE.Mesh(new THREE.ShapeGeometry(arch(0.28, -0.65, 0.65), 12), S.winM));
    S.win.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arch(0.29, -0.66, 0.66).getPoints(10).map((p) => new V3(p.x, p.y, 0.01)), true), 48, 0.04, 5, true), bbrass));
    S.bpend = new THREE.Group(); S.bpend.position.set(0, 0.5, 0.025); S.win.add(S.bpend);
    { const r2 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.8, 6), brass); r2.position.y = -0.4; S.bpend.add(r2); const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 20), brass); bb.rotation.x = PI / 2; bb.position.y = -0.85; S.bpend.add(bb); }
    { const pts = []; for (let i = 0; i <= 140; i++) { const a = i / 140 * TAU * 4.5, r = 0.03 + i / 140 * 0.21; pts.push(new V3(Math.cos(a) * r, Math.sin(a) * r, 0)); } S.springM = W.glow(0xff6a30, 2.4); S.spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.014, 4, false), S.springM); S.spring.position.set(0, -0.1, 0.03); S.spring.visible = false; S.win.add(S.spring); }
    const crackG = canvasTex(256, (x, n) => { x.clearRect(0, 0, n, n); x.strokeStyle = 'rgba(235,245,255,0.95)'; x.lineCap = 'round'; crackLines(x, n, 11, () => n * 0.38, () => n * 0.42, 14, 6, 1.6); crackLines(x, n, 13, (r) => n * (0.3 + r() * 0.4), (r) => n * (0.3 + r() * 0.4), 10, 3, 1); });
    S.crackGM = new THREE.MeshBasicMaterial({ map: crackG, transparent: true, depthWrite: false, opacity: 0.8 });
    S.winCrack = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.3), S.crackGM); S.winCrack.position.z = 0.05; S.winCrack.visible = false; S.win.add(S.winCrack);
    for (const y of [3.5, 3.78]) { const bt = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), bbrass); bt.position.set(0, y, rAt(y) + 0.03); S.rig.add(bt); }
    // the chest clock: ivory enamel face, brass bezel, dark hands, soft halo
    const chestT = canvasTex(256, (x, n) => { const h = n / 2, gg = x.createRadialGradient(h, h, 0, h, h, h); gg.addColorStop(0, '#f3ead2'); gg.addColorStop(0.85, '#e4d6b4'); gg.addColorStop(1, '#a8925e'); x.fillStyle = gg; x.fillRect(0, 0, n, n);
      x.translate(h, h); for (let i = 0; i < 60; i++) { x.save(); x.rotate(i / 60 * TAU); x.fillStyle = '#2a1c0c'; if (i % 5 === 0) { x.beginPath(); x.moveTo(0, -h * 0.94); x.lineTo(7, -h * 0.8); x.lineTo(0, -h * 0.66); x.lineTo(-7, -h * 0.8); x.fill(); } else x.fillRect(-1.2, -h * 0.94, 2.4, h * 0.07); x.restore(); }
      x.strokeStyle = '#6a4a1c'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, h * 0.6, 0, TAU); x.stroke(); x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, h * 0.97, 0, TAU); x.stroke(); });
    S.cd = new THREE.Group(); S.cd.position.set(0, 4.55, rAt(4.55) + 0.04); S.cd.rotation.x = 0.15; S.rig.add(S.cd);
    S.dialM = new THREE.MeshStandardMaterial({ map: chestT, emissiveMap: chestT, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0 });
    S.cd.add(new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), S.dialM));
    { const bz = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.065, 8, 32), bbrass); bz.position.z = 0.01; S.cd.add(bz); const hub = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), brass); hub.position.z = 0.04; S.cd.add(hub); }
    S.dh = [0.4, 0.27].map((l, i) => { const p = new THREE.Group(); p.position.z = 0.03; const m = new THREE.Mesh(new THREE.BoxGeometry(i ? 0.06 : 0.04, l, 0.02), new THREE.MeshBasicMaterial({ color: 0x100804 })); m.position.y = l / 2; p.add(m); S.cd.add(p); return p; });
    S.cdHaloM = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, map: radial([[0, 'rgba(0,0,0,0)'], [0.42, 'rgba(0,0,0,0)'], [0.5, 'rgba(255,255,255,0.8)'], [1, 'rgba(0,0,0,0)']]) });
    { const hl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), S.cdHaloM); hl.position.z = -0.01; S.cd.add(hl); }
    S.cdCrack = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: 0xeaf6ff, map: canvasTex(256, (x, n) => { x.clearRect(0, 0, n, n); x.strokeStyle = '#fff'; x.lineCap = 'round'; const r = mulberry(5); for (let i = 0; i < 9; i++) { let px = n * 0.62, py = n * 0.36, a = i / 9 * TAU + r() * 0.4; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 5; j++) { a += (r() - 0.5) * 0.7; px += Math.cos(a) * n * 0.09; py += Math.sin(a) * n * 0.09; x.lineTo(px, py); } x.lineWidth = 5 - i * 0.25; x.stroke(); } x.beginPath(); x.arc(n * 0.62, n * 0.36, n * 0.07, 0, TAU); x.lineWidth = 4; x.stroke(); }) })); S.cdCrack.position.z = 0.045; S.cdCrack.visible = false; S.cd.add(S.cdCrack);
    // collar and bow tie
    const ivory = W.mat({ color: 0xb4aa94, roughness: 0.75 }), silk = withRim(W.mat({ color: 0x1c1a26, roughness: 0.28, metalness: 0.35 }), S.hatRim = new THREE.Color(0x6a7aa8), 2.0);
    S.maskM = withRim(W.mat({ color: 0xe0b060, roughness: 0.3, metalness: 0.65 }), S.rimC, 2.6); S.bandM = W.mat({ color: 0xb8893c, roughness: 0.35, metalness: 0.9, emissive: 0xff5020, emissiveIntensity: 0 });
    { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.6, 0.34, 20, 1, true), ivory); col.position.y = 5.56; col.material.side = THREE.DoubleSide; S.rig.add(col);
      for (const s of [1, -1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 4), silk); w.rotation.z = s * PI / 2; w.position.set(s * 0.12, 5.47, rAt(5.47) + 0.05); S.rig.add(w); } const kn = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), silk); kn.position.set(0, 5.47, rAt(5.47) + 0.07); S.rig.add(kn);
      const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.45, 12), bdk); nk.position.y = 5.8; S.rig.add(nk); }
    // head: brass mask, monocle lamp, top hat with a brass band and a tucked gear
    S.head = new THREE.Group(); S.head.position.y = 6.25; S.head.scale.setScalar(1.35); S.rig.add(S.head);
    { const sk = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), bdk); sk.scale.y = 1.12; S.head.add(sk);
      const mk = new THREE.Mesh(new THREE.SphereGeometry(0.45, 28, 16, PI / 2 - 1.55, 3.1, 0.45, 1.85), S.maskM); mk.scale.set(1, 1.12, 1.06); S.head.add(mk);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.12), S.maskM); brow.position.set(0, 0.2, 0.4); brow.rotation.x = -0.3; S.head.add(brow);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.2), S.maskM); jaw.position.set(0, -0.36, 0.28); S.head.add(jaw);
      for (const sx of [1, -1]) { const rv = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), bbrass); rv.rotation.z = PI / 2; rv.position.set(sx * 0.47, 0.0, 0.02); S.head.add(rv); }
      const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20), S.maskM); bp.rotation.x = PI / 2; bp.position.set(0, 0.02, -0.44); S.head.add(bp); const bk = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.04), bbrass); bk.position.set(0, 0.02, -0.56); S.head.add(bk); const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), bbrass); bs.rotation.x = PI / 2; bs.position.set(0, 0.02, -0.5); S.head.add(bs);
      const hs = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.24, 18), bdk); hs.scale.y = 1.6; hs.rotation.x = PI / 2; hs.position.set(0.16, 0.06, 0.52); S.head.add(hs);
      const bz = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 20), bbrass); bz.position.set(0.16, 0.06, 0.71); S.head.add(bz);
      S.lensM = new THREE.MeshStandardMaterial({ color: 0x140804, roughness: 0.08, metalness: 0.2, emissive: GOLD, emissiveIntensity: 0.4 }); const ln = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), S.lensM); ln.position.set(0.16, 0.06, 0.713); S.head.add(ln);
      S.eyeM = W.glow(GOLD, 2.5); const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), S.eyeM); core.position.set(0.16, 0.06, 0.72); S.head.add(core);
      S.eyeHaloM = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, map: radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.35)'], [1, 'rgba(0,0,0,0)']]) });
      const eh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), S.eyeHaloM); eh.position.set(0.16, 0.06, 0.73); S.head.add(eh);
      const le = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 14), bbrass); le.position.set(-0.16, 0.08, 0.42); S.head.add(le); const lg = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), new THREE.MeshStandardMaterial({ color: 0x050304, roughness: 0.1 })); lg.position.set(-0.16, 0.08, 0.425); S.head.add(lg);
      for (let i = 0; i < 3; i++) { const gl = new THREE.Mesh(new THREE.BoxGeometry(0.24 - i * 0.04, 0.03, 0.04), S.grilleM || (S.grilleM = new THREE.MeshStandardMaterial({ color: 0x0a0604, roughness: 0.5 }))); gl.position.set(0, -0.16 - i * 0.06, 0.43 - i * 0.03); S.head.add(gl); }
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 28), silk); brim.position.y = 0.42; S.head.add(brim); const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.95, 24), silk); hat.position.y = 0.92; S.head.add(hat);
      const edgeM = S.hatEdgeM = W.mat({ color: 0xa8a8bc, roughness: 0.3, metalness: 0.6, emissive: 0x8a8aa0, emissiveIntensity: 0.3 }); const be = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.025, 6, 32), edgeM); be.rotation.x = PI / 2; be.position.y = 0.42; S.head.add(be); const ce = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 28), edgeM); ce.rotation.x = PI / 2; ce.position.y = 1.395; S.head.add(ce);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.447, 0.452, 0.13, 24), S.bandM); band.position.y = 0.53; S.head.add(band);
      const hw = new THREE.Group(); hw.position.set(0.43, 0.62, 0.1); hw.rotation.y = PI / 2 - 0.2; S.head.add(hw); S.hatGear = gearMesh(0.17, 10, bbrass, 0.04); hw.add(S.hatGear); }
    // four arms with elbows, cuffs and tools: bell, hammer, winding key, loupe
    S.arms = [];
    for (const [sx, y, l, tool] of [[1, 5.0, 1, 'bell'], [-1, 5.0, 1, 'ham'], [1, 4.3, 0.85, 'key'], [-1, 4.3, 0.85, 'loupe']]) {
      const p = new THREE.Group(); p.position.set(sx * (rAt(y) - 0.05), y, 0); S.rig.add(p);
      p.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), bbrass)); const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, l * 0.8, 3, 8), bdk); up.position.y = -l * 0.47; p.add(up);
      const fo = new THREE.Group(); fo.position.y = -l * 0.95; p.add(fo); fo.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bbrass));
      const fa = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, l * 0.7, 3, 8), bdk); fa.position.y = -l * 0.42; fo.add(fa);
      const cf = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.12, 0.13, 12), ivory); cf.position.y = -l * 0.8; fo.add(cf);
      const tg = new THREE.Group(); tg.position.y = -l * 0.9; fo.add(tg);
      if (tool === 'bell') { const bl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.4, 0.5, 16, 1, true), bbrass); bl.material = bbrass; bl.position.y = -0.32; tg.add(bl); const in2 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.38, 0.48, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2810, roughness: 0.5, metalness: 0.8, side: THREE.BackSide })); in2.position.y = -0.32; tg.add(in2); const lip = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 6, 24), bbrass); lip.rotation.x = PI / 2; lip.position.y = -0.57; tg.add(lip); const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), bdk); hd.position.y = -0.02; tg.add(hd); }
      else if (tool === 'ham') { const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), W.mat({ color: 0x3a2010, roughness: 0.6 })); hd.position.y = -0.27; tg.add(hd); const hh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.44, 14), steel); hh.rotation.z = PI / 2; hh.position.y = -0.56; tg.add(hh); for (const s of [1, -1]) { const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 14), bbrass); bd.rotation.z = PI / 2; bd.position.set(s * 0.15, -0.56, 0); tg.add(bd); } }
      else if (tool === 'key') { const wg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.045), bbrass); wg.position.y = -0.04; tg.add(wg); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.45, 8), bbrass); sh.position.y = -0.3; tg.add(sh); const bt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), bdk); bt.position.y = -0.55; tg.add(bt); }
      else { const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), bdk); hd.position.y = -0.15; tg.add(hd); const rg = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 22), bbrass); rg.position.y = -0.46; tg.add(rg); const lz = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), new THREE.MeshStandardMaterial({ color: 0x9ac0e0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); lz.position.y = -0.46; tg.add(lz); }
      p.rotation.z = sx * 0.5; S.arms.push({ p, fo, sx });
    }
    S.halo = new THREE.Group(); S.halo.position.y = 3.2; bg.add(S.halo); const hr = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.04, 6, 60), brass); hr.rotation.x = PI / 2; S.halo.add(hr);
    for (let i = 0; i < 12; i++) { const tk = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3 + (i % 3 ? 0 : 0.2), 0.07), brass); const a = i / 12 * TAU; tk.position.set(Math.sin(a) * 2.3, 0, Math.cos(a) * 2.3); S.halo.add(tk); }
    S.light = new THREE.PointLight(GOLD, 10, 30, 1.6); S.light.position.set(0, 6.5, 0); bg.add(S.light);
    Object.assign(S, { flow: 1, flowT: 1, base: 1, ff: 1, stop: false, stopLeft: 0, pred: null, tollIn: 0, pips: 0, snap: null, anchor: null, glassOn: 0, armUp: 0, lvl: 0, look: 0, lookT: 0, pendA: 0, tickT: 0, crackK: 0, faceK: 0 });
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
    Co.start(Post.lerpTo({ sat: on ? 0.1 : 1.0, contrast: on ? 1.18 : 1.05 }, 0.25), 'fight'); Sound.sfx(on ? 'interrupt' : 'charge', 0.8, on ? 0.35 : 1.2); FX.flash(on ? 0xffffff : GOLD, 0.1, 7);
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
        S.armUp = 0; S.flowT = 1; Sound.sfx('shatter', 1, 0.5); Sound.sfx('bigboom', 0.6); FX.flash(BLUE, 0.22, 3.5);
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
        S.armUp = 0; setLvl(b, 2); for (let i = 0; i < 13; i++) Sound.sfx('parry', 0.5, 0.3 + i * 0.02); Sound.sfx('bigboom', 0.9); FX.flash(RED, 0.28, 2.6);
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
      S.look = damp(S.look, S.lookT, 0.6, dt); const k1 = sat(S.look), k2 = sat(S.look - 1), U = S.sky.material.uniforms, cast = b.castState ? 1 : 0;
      const hotHex = S.stop ? BLUE : e < -0.2 ? RED : GOLD;
      for (const k in S.hand) { const h = S.hand[k]; h.g.rotation.y = c2a(h.c); const hh = k === 'sec' && !S.stop ? RED : hotHex, I = 0.06 + Math.min(0.5, Math.abs(e - 1) * 0.22) + (S.pred && k !== 'sec' ? 0.22 + Math.sin(t * 16) * 0.12 : 0);
        if (k === 'sec') h.mat.color.setHex(0x7a1a12).lerp(_c.setHex(0xa80c06), k2); else h.mat.color.setHex(0x8a6228).lerp(_c.setHex(S.stop ? 0x121822 : 0x34405a), k1 * (1 - k2) + (S.stop ? 1 : 0) * (1 - k1)).lerp(_c.setHex(0xa80c06), k2); h.cw.value = 1 - Math.max(k1 * (S.stop ? 0.7 : 0.5), k2 * 0.62); h.mat.userData.ed.value = k2; h.mat.metalness = 0.85 - k1 * (1 - k2) * (S.stop ? 0.4 : 0.3) - k2 * 0.55; h.mat.roughness = 0.34 - k1 * (1 - k2) * 0.08 + k2 * 0.12;
        h.mat.emissive.setHex(hh).multiplyScalar(I * 0.3 * (1 - k2)).lerp(_c.setHex(0x3a0302), k2); h.hot.setHex(hh).multiplyScalar(I * 2.2 * (1 - k2 * 0.4)).lerp(_c.setHex(0xff9a60).multiplyScalar(2.4 + Math.sin(t * 2.4 + h.c) * 0.4), k2); }
      S.pipM.forEach((m, i) => { m.emissiveIntensity = i < S.pips ? 3.5 : 0.06 + k1 * (1 - k2) * 0.12; });
      let nb = 0; for (const q of Bul.list) { if (q.v0 === undefined || nb >= 256) continue; const s = q.r * (q.t < 0.15 ? q.t / 0.15 : 1) * 1.22; _m.makeScale(s, s, s); _m.setPosition(q.x, q.y, q.z); S.bo.setMatrixAt(nb++, _m); } S.bo.count = nb; S.bo.instanceMatrix.needsUpdate = true; S.wBezM.color.setHex(S.stop ? 0x6a7280 : 0x8a6428);
      { let i = 0; const cp = camera.position; for (const q of Bul.list) { if (q.v0 === undefined || i >= 256) continue; const s = q.r * (q.t < 0.15 ? q.t / 0.15 : 1); _v.set(q.x, q.y, q.z); _m.lookAt(cp, _v, YUP); _q.setFromRotationMatrix(_m); _w.set(s, s, s); _m.compose(_v, _q, _w); S.wBez.setMatrixAt(i, _m); S.wCr.setMatrixAt(i, _m);
          const tk = Math.floor((q.t + (q.x * 7.3 % 1)) * 2) * (TAU / 12); _q2.setFromAxisAngle(ZAX, -tk); _q3.copy(_q).multiply(_q2); _m.compose(_v, _q3, _w); S.wH1.setMatrixAt(i, _m); _q2.setFromAxisAngle(ZAX, -tk / 12 - 1.1); _q3.copy(_q).multiply(_q2); _m.compose(_v, _q3, _w); S.wH2.setMatrixAt(i, _m); i++; }
        for (const m of S.wat) { m.count = i; m.instanceMatrix.needsUpdate = true; } }
      for (const q of S.gears) q.m.rotation.z += q.k * e * dt;
      S.pendA += dt * 1.7 * e; S.pend.rotation.z = Math.sin(S.pendA) * 0.42;
      S.tickT -= dt * Math.abs(e); if (S.tickT <= 0 && G.state === 'fight') { S.tickT = 0.5; Sound.sfx('tick', 0.9, e < 0 ? 0.7 : 1); }
      U.uNebA.value.setHex(0x40308a).lerp(_c.setHex(0x2a50a8), k1).lerp(_c.setHex(0xa02a30), k2); U.uNebB.value.setHex(0x105088).lerp(_c.setHex(0x1a80a0), k1).lerp(_c.setHex(0x80301a), k2); U.uHor.value.setHex(0x1a2244).lerp(_c.setHex(0x402028), k2);
      S.crackK = damp(S.crackK, k2 > 0.3 ? 1 : k1 * 0.35, 2, dt); S.crack.material.opacity = S.crackK * (0.2 + (S.lvl >= 2 ? 0.2 + Math.sin(t * 2.2) * 0.07 : 0)); S.crack.material.color.setHex(S.lvl >= 2 ? 0x8a1606 : 0x6a9ad0);
      // the dial: warm ivory, a cold mid silver once the glass cracks (darker still while time is stopped), rose-tinted at the thirteenth hour
      S.faceK = damp(S.faceK, S.stop ? 1 : 0, 6, dt); S.faceM.color.setHex(0xd6cfc0).lerp(_c.setHex(0xa4a8b0), k1 * (1 - k2)).lerp(_c.setHex(0xe0d2bc), k2).lerp(_c.setHex(0x9ca0a8), S.faceK);
      const x3 = S.lvl >= 2, pu = 0.5 + Math.sin(t * 3) * 0.5; S.xiii.material.color.setScalar(2.3 + Math.sin(t * 3) * 0.6);
      S.xHalo.visible = S.beam.visible = S.xMotes.visible = x3; S.xHaloM.opacity = 0.18 + pu * 0.3; S.beamM.uniforms.uA.value = 0.6 + pu * 0.3; S.beamM.uniforms.uT.value = t;
      S.embers.visible = S.embers2.visible = S.flakes.visible = S.embersBig.visible = S.lip.visible = S.heat.visible = x3; S.heatM.uniforms.uA.value = 0.32 + Math.sin(t * 1.1) * 0.06; S.drops.visible = S.cogs.visible = S.lvl === 1; S.lipM.color.setHex(0xff6a20).multiplyScalar(1.6 + Math.sin(t * 1.3) * 0.4); S.winCrack.visible = S.cdCrack.visible = S.lvl >= 1;
      S.eclM.opacity = k2 * (0.85 + Math.sin(t * 1.7) * 0.15); S.bobM.color.setHex(0xb8893c).lerp(_c.setHex(0x7c8698), k1 * (1 - k2)).lerp(_c.setHex(0x1a0806), k2 * 0.9); S.bobM.metalness = 0.95 - k1 * (1 - k2) * 0.6; S.bobM.roughness = 0.5 + k1 * (1 - k2) * 0.3; S.bobRim.setHex(0x5a3a14).lerp(_c.setHex(0x7aa0e0), k1 * (1 - k2)).lerp(_c.setHex(0x000000), k2); S.bhM.color.setHex(0xffd8a0).lerp(_c.setHex(0xc8dcff), k1); S.bhM.opacity = 0.3 * (1 - k2); S.outerRim.setHex(0x804818).lerp(_c.setHex(0x506070), k1 * (1 - k2)).lerp(_c.setHex(0x9a3008), k2); S.outerM.color.setHex(0x4a3a28).lerp(_c.setHex(0x5a6070), k1 * (1 - k2)).lerp(_c.setHex(0x2a2220), k2); S.rimM.emissiveIntensity = k2 * 0.12; S.rimM.color.setHex(0xb8893c).lerp(_c.setHex(0x5a3a18), k2);
      S.sun.color.setHex(0xffe4b8).lerp(_c.setHex(0xd8e4ff), k1).lerp(_c.setHex(0xffc0a0), k2); S.hemi.color.setHex(0x8c9cd0).lerp(_c.setHex(0xb08090), k2);
      S.rimC.setHex(0x30487a).lerp(_c.setHex(0x7088a8), k1).lerp(_c.setHex(0xb0200a), k2); S.handRim.setHex(0x30487a).multiplyScalar(0.5).lerp(_c.setHex(0x182030), k1 * (1 - k2)).lerp(_c.setHex(0xb01006), k2); S.hatRim.setHex(0x6a7aa8).lerp(_c.setHex(0xa03018), k2); S.bandM.emissiveIntensity = k2 * (0.8 + Math.sin(t * 2.6) * 0.25); S.gearRim.setHex(0xd08a30).lerp(_c.setHex(0x5a6478), k1 * (1 - k2)).lerp(_c.setHex(0xa02a10), k2);
      S.coatM.emissiveIntensity = k2 * 1.6; S.coatT.value = t; S.coatM.color.setScalar((1 - k2 * 0.5) * (1 - (S.occK || 0) * 0.55));
      if (p) { const P0 = p.pos, C = camera.position, dx = P0.x - C.x, dz = P0.z - C.z, L2 = Math.max(dx * dx + dz * dz, 1e-4), k = clamp(((b.pos.x - C.x) * dx + (b.pos.z - C.z) * dz) / L2, 0, 1), yk = lerp(C.y, P0.y + 1.2, k), d = Math.hypot(C.x + dx * k - b.pos.x, C.z + dz * k - b.pos.z); S.occK = damp(S.occK || 0, k < 0.97 && yk < 5.9 && d < S.rAt(Math.max(0, yk - 0.25)) * 0.95 ? 1 : 0, 8, dt); S.coatM.opacity = 1 - S.occK * 0.55; } // see the player through his coat when he stands in the way
      const pl = p && p.pos; S.glass.visible = S.glassOn > 0 && !!pl; if (S.glass.visible) { S.glass.position.set(pl.x, pl.y + 2.9, pl.z); S.glass.rotation.z = S.anchor ? t * 2.5 : 0; S.glass.rotation.y = t; }
      S.anchorG.visible = !!S.anchor; if (S.anchor) { S.anchorG.position.set(S.anchor.x, 0, S.anchor.z); S.anchorG.rotation.y = t * 1.5; }
      S.armK = damp(S.armK || 0, S.armUp, 6, dt); S.bellK = Math.max(0, (S.bellK || 0) - dt * 4);
      S.arms.forEach((q, i) => { q.p.rotation.z = q.sx * (0.5 + S.armK * (i < 2 ? 2.0 : 0.7) + k2 * (i < 2 ? 0.3 : 0.55) + Math.sin(t * 1.3 + i) * 0.06); q.p.rotation.x = i === 1 ? -S.bellK * 0.9 : Math.sin(t * 0.9 + i * 2) * 0.1; q.fo.rotation.x = -(0.45 + S.armK * 0.2); q.fo.rotation.z = -q.sx * 0.3 * (1 - S.armK); });
      S.rig.position.y = 0.25 + Math.sin(t * 1.4) * 0.12; S.head.rotation.y = Math.sin(t * 0.7) * 0.25; S.halo.rotation.y += dt * 0.5 * e; S.halo.position.y = 3.2 + Math.sin(t * 1.1) * 0.15;
      if (p) S.rig.rotation.y = dampAng(S.rig.rotation.y, wrapPi(b.angToPlayer() - b.facing), 5, dt); // he turns to watch you; cosmetic only
      S.hatGear.rotation.z += dt * 1.5 * e; S.backKey.rotation.z += dt * 0.8 * e; S.hatEdgeM.emissive.setHex(0x8a8070).lerp(_c.setHex(0x8aa0c8), k1 * (1 - k2)).lerp(_c.setHex(0xff5020), k2);
      S.dh[0].rotation.z = -S.hand.min.c; S.dh[1].rotation.z = -S.hand.hour.c;
      S.bpend.rotation.z = S.lvl === 1 ? 0.27 : Math.sin(S.pendA * 2) * 0.3; S.bpend.visible = !x3; S.spring.visible = x3; S.spring.rotation.z -= dt * 1.2 * e; S.winM.emissiveIntensity = x3 ? 0.5 + pu * 0.3 : 0;
      const eyeHex = S.stop ? BLUE : (e < -0.2 || x3) ? RED : GOLD;
      S.eyeM.color.setHex(eyeHex).multiplyScalar(2.5 + cast * 1.5); S.lensM.emissive.setHex(eyeHex); S.lensM.emissiveIntensity = 0.35 + cast * 0.3; S.eyeHaloM.color.setHex(eyeHex); S.eyeHaloM.opacity = 0.35 + cast * 0.25;
      S.dialM.emissive.setHex(S.stop ? 0xc8dcff : x3 ? 0xffd0c0 : 0xffffff); S.dialM.emissiveIntensity = 0.28 + cast * 0.22; S.cdHaloM.color.setHex(S.stop ? BLUE : x3 ? RED : GOLD); S.cdHaloM.opacity = 0.22 + cast * 0.25;
      S.light.intensity = 10 + cast * 8; S.light.color.setHex(S.stop ? BLUE : S.lvl >= 2 ? 0xff9a70 : GOLD);
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
