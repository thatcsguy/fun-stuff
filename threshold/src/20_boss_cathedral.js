// DOOR I: MAESTRA OSSIA, the Glass Cathedral. A nave of five lanes; she plays them, then they answer.
(() => {
  const HX = 11, HZ = 17, LW = 4.4, GOLD = 0xffc24a, RIM = 0x8a78ff;
  const LX = (i) => -8.8 + LW * i, laneOf = (x) => clamp(Math.floor((x + HX) / LW), 0, 4);
  const NOTES = [50, 53, 57, 60, 62];
  const COLZ = (k) => -HZ + k * 6.8; // pillar z positions, k = 0..5; bays sit between them
  // window brightness / tint per phase (the jewel colours live in the textures, so they carry through every phase)
  const WIN_TINT = [[1.0, 1.0, 1.12, 1.25], [1.3, 0.82, 0.82, 1.35], [1.2, 1.05, 0.95, 1.55]];
  const RAY_COLS = [0x3a58ff, 0xff2a48, 0x8a44ff, 0xff2a48, 0x3a58ff];

  // ---------- local geometry helpers ----------
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3();
  function T(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { geo.applyMatrix4(_m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); return geo; }
  function merge(list) {
    let n = 0; const gs = list.map((g) => { const q = g.index ? g.toNonIndexed() : g; if (q !== g) g.dispose(); if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return q; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
    for (const q of gs) { const c = q.attributes.position.count; P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); if (q.attributes.uv) U.set(q.attributes.uv.array, o * 2); o += c; q.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.computeBoundingSphere(); return g;
  }
  // pointed (two-centred) arch between plan points A and B, springing at ys, apex ys+H. Returns V3 points.
  function archPts(ax, az, bx, bz, ys, H, n = 24) {
    const span = Math.hypot(bx - ax, bz - az), h = span / 2, Hc = Math.max(H, h + 0.01), R = (Hc * Hc + h * h) / (2 * h), pts = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n, d = Math.abs(s * span - h), y = ys + Math.sqrt(Math.max(0, R * R - (R - h + d) * (R - h + d))) ;
      pts.push(new V3(lerp(ax, bx, s), y, lerp(az, bz, s)));
    }
    return pts;
  }
  const tube = (pts, r, seg = 32, rad = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg, r, rad, false);
  // fresnel rim added to a standard material's emissive (cold counter-colour so the dark body reads against the gold organ)
  function withRim(mat, colorObj, power = 2.6) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: colorObj };
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim;\nvoid main() {').replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRim * pow(max(fr, 0.0), ' + power.toFixed(2) + '); }');
    };
    mat.customProgramCacheKey = () => 'rim' + power; return mat;
  }
  const canvasTex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

  // ---------- baked surfaces ----------
  // ashlar: coursed stone blocks with chamfered mortar joints (dark joints act as AO)
  const ashlar = (rows, cols, seed) => (u, v) => {
    const r = Math.floor(v * rows), fv = v * rows - r, uu = u * cols + (r % 2) * 0.5, c = Math.floor(uu), fu = uu - c;
    const e = Math.min(Math.min(fu, 1 - fu) / cols, Math.min(fv, 1 - fv) / rows), seam = smooth(sat((e - 0.003) / 0.012));
    const id = W.hash2(((c % cols) + cols) % cols, r, seed), n = W.fbm(u * 16, v * 16, seed, 4, 16), pit = W.fbm(u * 48, v * 48, seed + 9, 2, 48);
    return [seam * (0.75 + n * 0.25) - pit * 0.08, (0.32 + id * 0.4 + n * 0.28) * (0.25 + 0.75 * seam), 0.92 - n * 0.2];
  };
  // polished marble slabs, alternating dark / grey, with warped veins
  const marble = (seed) => (u, v) => {
    const n = 4, fu = (u * n) % 1, fv = (v * n) % 1, e = Math.min(fu, 1 - fu, fv, 1 - fv), seam = smooth(sat(e * 40));
    const chk = (Math.floor(u * n) + Math.floor(v * n)) % 2, w = W.fbm(u * 6, v * 6, seed + chk * 5, 5, 6);
    const vein = Math.pow(1 - Math.abs(Math.sin(TAU * (2 * u + 3 * v) + w * 9)), 14), id = W.hash2(Math.floor(u * n), Math.floor(v * n), seed);
    const tone = chk ? 0.14 + w * 0.14 + vein * 0.45 : 0.42 + id * 0.08 + w * 0.18 + vein * 0.35;
    return [seam * 0.8 + w * 0.08, tone * (0.45 + 0.55 * seam), 0.16 + w * 0.12 + (1 - seam) * 0.5 - vein * 0.06];
  };

  // ---------- stained glass ----------
  const JEWEL = { crimson: ['#c0102a', '#e8203c', '#8a0a22', '#ff4a50'], cobalt: ['#1030c8', '#2850ff', '#0a1a80', '#4a7aff'], gold: ['#ffb020', '#ffd060', '#e08a10'], violet: ['#6a20c0', '#8a40ff'], green: ['#108a50'] };
  function glassTex(seed, theme) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d'), r = mulberry(seed);
    const main = JEWEL[theme], acc = theme === 'cobalt' ? JEWEL.crimson : JEWEL.cobalt, pick = (a) => a[Math.floor(r() * a.length)];
    x.fillStyle = '#000'; x.fillRect(0, 0, 256, 512); x.save(); x.beginPath();
    x.moveTo(10, 512); x.lineTo(10, 170); x.quadraticCurveTo(10, 40, 128, 6); x.quadraticCurveTo(246, 40, 246, 170); x.lineTo(246, 512); x.closePath(); x.clip();
    // field of small irregular quarries in the dominant jewel tone, with accent and gold sparks
    for (let j = 0; j < 22; j++) for (let i = 0; i < 8; i++) {
      const px = i * 32 + (j % 2) * 16 - 16, py = j * 24, roll = r();
      x.fillStyle = roll < 0.62 ? pick(main) : roll < 0.84 ? pick(acc) : roll < 0.95 ? pick(JEWEL.gold) : pick(JEWEL.violet);
      x.globalAlpha = 0.75 + r() * 0.25; x.beginPath(); x.moveTo(px + r() * 5, py + r() * 5); x.lineTo(px + 32 + r() * 5, py + r() * 5); x.lineTo(px + 32 + r() * 5, py + 24 + r() * 5); x.lineTo(px + r() * 5, py + 24 + r() * 5); x.closePath(); x.fill();
      x.globalAlpha = 1; x.strokeStyle = '#050208'; x.lineWidth = 2.5; x.stroke();
    }
    // border strip of alternating gold / accent
    for (let j = 0; j < 26; j++) for (const bx of [10, 228]) { x.fillStyle = j % 2 ? pick(JEWEL.gold) : pick(acc); x.fillRect(bx, 150 + j * 14, 18, 14); x.strokeStyle = '#050208'; x.lineWidth = 2; x.strokeRect(bx, 150 + j * 14, 18, 14); }
    // central figure: gold halo, robed body in the accent colour, a medallion below
    x.fillStyle = '#ffd468'; x.beginPath(); x.arc(128, 150, 40, 0, TAU); x.fill(); x.strokeStyle = '#050208'; x.lineWidth = 5; x.stroke();
    x.fillStyle = '#f0e0c8'; x.beginPath(); x.arc(128, 152, 18, 0, TAU); x.fill(); x.stroke();
    x.fillStyle = pick(acc); x.beginPath(); x.moveTo(128, 178); x.lineTo(80, 380); x.lineTo(176, 380); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = pick(JEWEL.gold); x.beginPath(); x.moveTo(128, 196); x.lineTo(110, 380); x.lineTo(146, 380); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = pick(JEWEL.gold); x.beginPath(); x.arc(128, 440, 30, 0, TAU); x.fill(); x.stroke();
    x.fillStyle = pick(main); x.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, rr = k % 2 ? 10 : 24; x.lineTo(128 + Math.sin(a) * rr, 440 + Math.cos(a) * rr); } x.closePath(); x.fill(); x.stroke();
    // lead saddle bars
    x.strokeStyle = '#050208'; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(0, 110 + k * 110); x.lineTo(256, 110 + k * 110); x.lineWidth = 5; x.stroke(); }
    x.restore(); return canvasTex(c);
  }
  function roseTex(seed) {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = mulberry(seed), cx = S / 2, P = (a) => a[Math.floor(r() * a.length)];
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S); x.lineJoin = 'round';
    const lead = (w) => { x.strokeStyle = '#050208'; x.lineWidth = w; x.stroke(); };
    // outer ring: 24 roundels alternating cobalt / crimson with gold cores
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, px = cx + Math.sin(a) * 220, py = cx + Math.cos(a) * 220; x.fillStyle = i % 2 ? P(JEWEL.cobalt) : P(JEWEL.crimson); x.beginPath(); x.arc(px, py, 26, 0, TAU); x.fill(); lead(5); x.fillStyle = P(JEWEL.gold); x.beginPath(); x.arc(px, py, 9, 0, TAU); x.fill(); lead(3); }
    // ring band
    for (let i = 0; i < 48; i++) { x.fillStyle = i % 3 === 0 ? P(JEWEL.gold) : P(JEWEL.violet); x.beginPath(); x.moveTo(cx, cx); x.arc(cx, cx, 190, i / 48 * TAU, (i + 1) / 48 * TAU); x.closePath(); x.fill(); lead(2.5); }
    // 12 lancet petals
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU, ca = Math.sin(a), sa = Math.cos(a); x.fillStyle = i % 2 ? P(JEWEL.crimson) : P(JEWEL.cobalt);
      x.beginPath(); x.moveTo(cx + ca * 50, cx + sa * 50); x.quadraticCurveTo(cx + Math.sin(a - 0.26) * 150, cx + Math.cos(a - 0.26) * 150, cx + ca * 182, cx + sa * 182); x.quadraticCurveTo(cx + Math.sin(a + 0.26) * 150, cx + Math.cos(a + 0.26) * 150, cx + ca * 50, cx + sa * 50); x.fill(); lead(6);
      x.fillStyle = P(JEWEL.gold); x.beginPath(); x.arc(cx + ca * 130, cx + sa * 130, 12, 0, TAU); x.fill(); lead(3);
    }
    // centre medallion
    x.fillStyle = '#ffd060'; x.beginPath(); x.arc(cx, cx, 50, 0, TAU); x.fill(); lead(8);
    x.fillStyle = P(JEWEL.crimson); x.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = k % 2 ? 16 : 38; x.lineTo(cx + Math.sin(a) * rr, cx + Math.cos(a) * rr); } x.closePath(); x.fill(); lead(4);
    // stone tracery rings
    for (const rr of [50, 190, 250]) { x.beginPath(); x.arc(cx, cx, rr, 0, TAU); lead(rr === 250 ? 14 : 9); }
    return canvasTex(c);
  }
  // brass lane border: engraved staff (5 lines) with scattered note heads; emissive map lights the engraving
  function staffTex() {
    const mk = () => { const c = document.createElement('canvas'); c.width = 64; c.height = 1024; return c; };
    const a = mk(), e = mk(), xa = a.getContext('2d'), xe = e.getContext('2d'), r = mulberry(5);
    const gr = xa.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, '#5a3e18'); gr.addColorStop(0.5, '#b08a44'); gr.addColorStop(1, '#5a3e18'); xa.fillStyle = gr; xa.fillRect(0, 0, 64, 1024);
    xe.fillStyle = '#000'; xe.fillRect(0, 0, 64, 1024);
    for (const [x, col, al] of [[xa, '#21140a', 1], [xe, '#ffffff', 1]]) {
      x.globalAlpha = al; x.fillStyle = col; x.strokeStyle = col;
      for (let k = 0; k < 5; k++) x.fillRect(10 + k * 10.5, 0, 1.6, 1024);
      x.fillRect(0, 0, 3, 1024); x.fillRect(61, 0, 3, 1024);
    }
    for (let y = 30; y < 1000; y += 52 + Math.floor(r() * 50)) {
      const ln = 10.8 + Math.floor(r() * 9) * 5.25, two = r() < 0.4;
      for (const x of [xa, xe]) { x.fillStyle = x === xa ? '#21140a' : '#ffffff'; x.beginPath(); x.ellipse(ln, y, 4.5, 3.2, 0.4, 0, TAU); x.fill(); x.fillRect(ln + 3.4, y - 22, 1.5, 22); if (two) { x.beginPath(); x.ellipse(ln, y + 18, 4.5, 3.2, 0.4, 0, TAU); x.fill(); x.fillRect(ln + 3.4, y - 4, 1.5, 22); x.fillRect(ln + 3.4, y - 22, 1.5, 3); } }
    }
    const ta = canvasTex(a), te = canvasTex(e); for (const t of [ta, te]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); } return { map: ta, emissiveMap: te };
  }
  function crackTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = mulberry(31);
    x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256); x.lineCap = 'round';
    for (let k = 0; k < 14; k++) {
      let px = r() * 256, py = 256; const pts = [[px, py]], top = 256 - 60 - r() * 190;
      while (py > top) { py -= 8 + r() * 12; px += (r() - 0.5) * 18; pts.push([px, py]); }
      for (const [w, a] of [[9, 0.22], [4, 0.6], [1.6, 1]]) { x.globalAlpha = a; x.strokeStyle = '#fff'; x.lineWidth = w; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); }
    }
    x.globalAlpha = 1; const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
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
  // soft coloured light pool on the floor where a shaft lands
  const poolMat = (color, a) => new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: a } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ vec2 d=(vUv-0.5)*2.0; float r=clamp(dot(d,d),0.0,1.0); float a=uA*pow(max(1.0-r,0.0),2.0); gl_FragColor=vec4(uC*a,a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  // ---------- the cathedral ----------
  function buildNave(g, S) {
    // stone: ashlar walls, finer ashlar on piers and ribs
    const wa = W.bake(512, ashlar(8, 4, 3), { dark: 0x0b0a10, light: 0x5c5866, strength: 2.6 });
    for (const k in wa) wa[k].repeat.set(5, 4);
    const wallMat = new THREE.MeshStandardMaterial({ map: wa.map, normalMap: wa.normalMap, roughnessMap: wa.roughnessMap, roughness: 0.9 });
    const pa = W.bake(256, ashlar(6, 3, 7), { dark: 0x15131a, light: 0x6a6574, strength: 2 });
    for (const k in pa) pa[k].repeat.set(2, 10);
    const pierMat = new THREE.MeshStandardMaterial({ map: pa.map, normalMap: pa.normalMap, roughnessMap: pa.roughnessMap, roughness: 0.8 });
    const ribMat = W.mat({ color: 0x5a5664, roughness: 0.7 });
    S.stone = pierMat;

    for (const sx of [-1, 1]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 34, 46), wallMat); wall.position.set(sx * 14.6, 17, 0); wall.receiveShadow = true; g.add(wall); }
    const endWall = new THREE.Mesh(new THREE.BoxGeometry(30, 44, 1), wallMat); endWall.position.set(0, 22, 22); g.add(endWall);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 44, 1), wallMat); backWall.position.set(0, 22, -22.5); g.add(backWall);

    // pointed barrel vault (webbing) over the nave
    { const prof = archPts(-14.6, 0, 14.6, 0, 21, 15.5, 40), nz = 12, pos = [], uv = [], idx = [];
      for (let j = 0; j <= nz; j++) for (let i = 0; i < prof.length; i++) { const p = prof[i]; pos.push(p.x, p.y, -22.5 + j / nz * 44.5); uv.push(i / (prof.length - 1) * 4, j / nz * 6); }
      for (let j = 0; j < nz; j++) for (let i = 0; i < prof.length - 1; i++) { const a = j * prof.length + i, b2 = a + prof.length; idx.push(a, b2, a + 1, a + 1, b2, b2 + 1); }
      const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); vg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); vg.setIndex(idx); vg.computeVertexNormals();
      const vm = wallMat.clone(); vm.side = THREE.DoubleSide; vm.color = new THREE.Color(0.55, 0.55, 0.62); g.add(new THREE.Mesh(vg, vm)); }

    // clustered piers, capitals, plinths
    const pier = [], ribs = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) {
      const x = sx * 12.7, z = COLZ(k);
      pier.push(T(new THREE.CylinderGeometry(0.72, 0.78, 20, 14), x, 10.6, z));
      for (const [ox, oz] of [[-sx * 0.75, 0], [0, 0.75], [0, -0.75], [sx * 0.6, 0]]) pier.push(T(new THREE.CylinderGeometry(0.26, 0.26, 20, 8), x + ox, 10.6, z + oz));
      pier.push(T(new THREE.CylinderGeometry(1.35, 1.45, 1.1, 8), x, 0.55, z), T(new THREE.CylinderGeometry(1.12, 1.35, 0.4, 8), x, 1.3, z));
      pier.push(T(new THREE.TorusGeometry(1.0, 0.12, 6, 16), x, 1.55, z, PI / 2));
      pier.push(T(new THREE.CylinderGeometry(1.3, 0.85, 1.0, 8), x, 21.0, z), T(new THREE.BoxGeometry(2.5, 0.35, 2.5), x, 21.65, z));
      // a ring of small mouldings halfway up (the shaft band)
      pier.push(T(new THREE.TorusGeometry(0.86, 0.09, 5, 16), x, 11, z, PI / 2));
      // wall arcade arch (formeret) over each bay, springing from the capitals
      if (k < 5) { ribs.push(tube(archPts(x, z, x, COLZ(k + 1), 21.8, 5.2, 20), 0.28, 24)); ribs.push(tube(archPts(x * 1.06, z, x * 1.06, COLZ(k + 1), 19.2, 4.6, 20), 0.18, 24)); }
    }
    // transverse and diagonal vault ribs + ridge rib
    for (let k = 0; k < 6; k++) {
      ribs.push(tube(archPts(-12.7, COLZ(k), 12.7, COLZ(k), 21.8, 13.0, 40), 0.36, 48, 7));
      if (k < 5) { ribs.push(tube(archPts(-12.7, COLZ(k), 12.7, COLZ(k + 1), 21.8, 13.2, 40), 0.24, 48)); ribs.push(tube(archPts(12.7, COLZ(k), -12.7, COLZ(k + 1), 21.8, 13.2, 40), 0.24, 48)); }
    }
    ribs.push(T(new THREE.CylinderGeometry(0.28, 0.28, 44, 8), 0, 34.85, 0, PI / 2));
    // bosses (carved keystones) where diagonals cross
    for (let k = 0; k < 5; k++) ribs.push(T(new THREE.SphereGeometry(0.6, 10, 8), 0, 34.8, (COLZ(k) + COLZ(k + 1)) / 2));
    const pm = new THREE.Mesh(merge(pier), pierMat); pm.castShadow = true; pm.receiveShadow = true; g.add(pm);
    g.add(new THREE.Mesh(merge(ribs), ribMat));

    // lancet windows with stone frames and tracery, jewel-toned glass
    S.windows = []; S.rays = []; S.pools = [];
    const frame = [], themes = ['cobalt', 'crimson', 'gold', 'crimson', 'cobalt'];
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
      const z = COLZ(k) + 3.4, th = themes[(k + (sx > 0 ? 1 : 0)) % 5], tex = glassTex(11 + k + (sx > 0 ? 7 : 0), th);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 15), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1, 1, 1), fog: false }));
      m.position.set(sx * 14.05, 11, z); m.rotation.y = -sx * PI / 2; g.add(m); S.windows.push(m);
      const fx = sx * 13.95, half = 1.98;
      // jambs, pointed head, central mullion, sill, tracery roundel and cusps
      frame.push(tube([new V3(fx, 3.4, z - half), new V3(fx, 13.6, z - half)], 0.2, 2, 6), tube([new V3(fx, 3.4, z + half), new V3(fx, 13.6, z + half)], 0.2, 2, 6));
      frame.push(tube(archPts(fx, z - half, fx, z + half, 13.6, 4.9, 20), 0.22, 24));
      frame.push(tube([new V3(fx, 3.4, z), new V3(fx, 11.2, z)], 0.09, 2, 5));
      frame.push(tube(archPts(fx, z - half, fx, z, 11.2, 1.6, 12), 0.08, 14, 5), tube(archPts(fx, z, fx, z + half, 11.2, 1.6, 12), 0.08, 14, 5));
      frame.push(T(new THREE.TorusGeometry(0.72, 0.08, 5, 20), fx, 14.4, z, 0, PI / 2));
      for (let q = 0; q < 4; q++) { const a = q / 4 * TAU + PI / 4; frame.push(T(new THREE.TorusGeometry(0.26, 0.05, 4, 10), fx, 14.4 + Math.cos(a) * 0.4, z + Math.sin(a) * 0.4, 0, PI / 2)); }
      frame.push(T(new THREE.BoxGeometry(0.6, 0.3, 4.6), sx * 13.85, 3.3, z));
      for (const by of [6.0, 8.7]) frame.push(T(new THREE.BoxGeometry(0.06, 0.06, 3.9), fx, by, z));
      if (sx === 1) {
        const rc = RAY_COLS[k], pv = new THREE.Group(); pv.position.set(4.6, 5.6, z); pv.rotation.z = -1.05;
        const ray = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 21), rayMat(rc, 0.08)); ray.rotation.y = PI / 2; ray.userData.base = new THREE.Color(rc); pv.add(ray); g.add(pv); S.rays.push(ray);
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 4.2), poolMat(rc, 0.1)); pool.rotation.x = -PI / 2; pool.position.set(-4.2, 0.03, z); g.add(pool); S.pools.push(pool);
      }
    }
    const fm = new THREE.Mesh(merge(frame), ribMat); g.add(fm);
    // rose windows: one over the organ (seen through the pipes), one in the west wall
    for (const [z, y, rad, ry] of [[-21.95, 27, 6.2, 0], [21.45, 21, 6.5, PI]]) {
      const rose = new THREE.Mesh(new THREE.CircleGeometry(rad, 64), new THREE.MeshBasicMaterial({ map: roseTex(99 + z), fog: false })); rose.position.set(0, y, z); rose.rotation.y = ry; g.add(rose); S.windows.push(rose);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad + 0.25, 0.45, 8, 48), ribMat); ring.position.set(0, y, z + (ry ? -0.2 : 0.2)); g.add(ring);
    }

    // choir stalls in each bay, facing the nave
    const wd = W.surface('wood', { size: 256, dark: 0x120805, light: 0x4a2a16, n: 5 }); for (const k in wd) wd[k].repeat.set(2, 1);
    const woodMat = new THREE.MeshStandardMaterial({ map: wd.map, normalMap: wd.normalMap, roughness: 0.55 });
    const stall = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
      const zc = COLZ(k) + 3.4, L = 4.2;
      stall.push(T(new THREE.BoxGeometry(0.75, 0.5, L), sx * 12.0, 0.25, zc), T(new THREE.BoxGeometry(0.85, 0.08, L + 0.1), sx * 11.98, 0.54, zc));
      stall.push(T(new THREE.BoxGeometry(0.14, 2.7, L), sx * 12.45, 1.35, zc), T(new THREE.BoxGeometry(0.3, 0.14, L + 0.2), sx * 12.42, 2.75, zc));
      stall.push(T(new THREE.BoxGeometry(0.35, 0.75, L), sx * 11.42, 0.38, zc), T(new THREE.BoxGeometry(0.45, 0.07, L + 0.1), sx * 11.42, 0.78, zc));
      for (let q = 0; q <= 4; q++) {
        const zz = zc - L / 2 + q * (L / 4);
        stall.push(T(new THREE.BoxGeometry(0.75, 1.2, 0.08), sx * 12.05, 0.95, zz));
        stall.push(T(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), sx * 12.45, 3.3, zz), T(new THREE.ConeGeometry(0.12, 0.5, 4), sx * 12.45, 4.05, zz));
        if (q < 4) stall.push(tube(archPts(sx * 12.36, zz + 0.06, sx * 12.36, zz + L / 4 - 0.06, 2.0, 0.65, 10), 0.04, 12, 4));
      }
    }
    g.add(new THREE.Mesh(merge(stall), woodMat));

    // candelabra clusters at the foot of each pier
    const brass = W.mat({ color: 0x8a6a30, roughness: 0.35, metalness: 1 }), wax = W.mat({ color: 0xe8dcc0, roughness: 0.6, emissive: 0x402810, emissiveIntensity: 0.4 });
    const stands = [], candles = [], flames = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) {
      const x = sx * 11.55, z = COLZ(k) + (k === 0 ? 0.9 : k === 5 ? -0.9 : 0);
      stands.push(T(new THREE.CylinderGeometry(0.03, 0.05, 1.9, 6), x, 0.95, z), T(new THREE.ConeGeometry(0.28, 0.25, 6), x, 0.12, z));
      stands.push(T(new THREE.BoxGeometry(0.04, 0.04, 1.1), x, 1.75, z), T(new THREE.TorusGeometry(0.26, 0.02, 4, 12, PI), x, 1.75, z, 0, PI / 2, PI));
      for (let q = 0; q < 5; q++) {
        const zz = z + (q - 2) * 0.27, yy = 1.85 + (2 - Math.abs(q - 2)) * 0.22 - (q === 2 ? 0 : 0.1), h = 0.22 + (q % 2) * 0.08;
        stands.push(T(new THREE.CylinderGeometry(0.05, 0.03, 0.06, 6), x, yy - 0.02, zz));
        candles.push(T(new THREE.CylinderGeometry(0.03, 0.03, h, 6), x, yy + h / 2, zz)); flames.push([x, yy + h + 0.07, zz]);
        if (q !== 2 && q % 2 === 0) stands.push(T(new THREE.CylinderGeometry(0.015, 0.015, yy - 1.75, 4), x, (yy + 1.75) / 2, zz));
      }
      // pricket of votives on the floor
      for (let q = 0; q < 4; q++) { const vz = z + 0.9 + q * 0.18, vx = x - sx * 0.15 * (q % 2); candles.push(T(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 6), vx, 0.06, vz)); flames.push([vx, 0.16, vz]); }
    }
    g.add(new THREE.Mesh(merge(stands), brass)); g.add(new THREE.Mesh(merge(candles), wax));
    const fl = new THREE.InstancedMesh(T(new THREE.SphereGeometry(0.045, 6, 5), 0, 0, 0, 0, 0, 0, 1, 1.9, 1), W.glow(0xffa848, 3.2), flames.length), dm = new THREE.Object3D();
    flames.forEach((f, i) => { dm.position.set(f[0], f[1], f[2]); dm.updateMatrix(); fl.setMatrixAt(i, dm.matrix); }); g.add(fl);
    S.candleL = [];
    for (const [sx, k] of [[-1, 1], [1, 2], [-1, 4], [1, 4]]) { const L = new THREE.PointLight(0xff9a48, 10, 9, 2); L.position.set(sx * 11.3, 2.3, COLZ(k)); g.add(L); S.candleL.push(L); }

    // organ: pipes + wood case with a carved cornice
    const gold = W.mat({ color: 0xc9a050, roughness: 0.22, metalness: 1, envMapIntensity: 2 });
    const wc = W.surface('wood', { size: 256, dark: 0x0e0604, light: 0x3a1e10, n: 8 }); for (const k in wc) wc[k].repeat.set(4, 1);
    const wood = new THREE.MeshStandardMaterial({ map: wc.map, normalMap: wc.normalMap, roughness: 0.5 });
    const caseG = [T(new THREE.BoxGeometry(26, 7, 3), 0, 3.5, -20.6), T(new THREE.BoxGeometry(27, 0.5, 3.6), 0, 7.1, -20.5), T(new THREE.BoxGeometry(27, 0.4, 3.6), 0, 0.2, -20.5)];
    for (let i = 0; i < 6; i++) { const x = -11 + i * 4.4; caseG.push(T(new THREE.BoxGeometry(0.5, 6.4, 0.3), x, 3.5, -19.05)); }
    for (let i = 0; i < 5; i++) { caseG.push(tube(archPts(LX(i) - 1.8, -19.0, LX(i) + 1.8, -19.0, 4.2, 2.3, 14), 0.1, 16, 5)); caseG.push(T(new THREE.ConeGeometry(0.5, 4, 6), LX(i) - 2.2, 9, -19.6)); }
    g.add(new THREE.Mesh(merge(caseG), wood));
    S.pipeGlow = []; const pipes = [];
    for (let i = 0; i < 5; i++) {
      const gm = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: GOLD, emissiveIntensity: 0.3 }); S.pipeGlow.push(gm); const glowG = [];
      for (let j = 0; j < 7; j++) {
        const r = 0.2 + (3 - Math.abs(j - 3)) * 0.07, h = 9 + (3 - Math.abs(j - 3)) * 2.6 + (2 - Math.abs(i - 2)) * 2.2;
        const px = LX(i) + (j - 3) * 0.58, pz = -19.4 - (3 - Math.abs(j - 3)) * 0.12;
        pipes.push(T(new THREE.CylinderGeometry(r, r, h, 12), px, 7 + h / 2, pz), T(new THREE.ConeGeometry(r, 0.7, 12), px, 7 - 0.35, pz, PI));
        glowG.push(T(new THREE.BoxGeometry(r * 1.5, 0.5, 0.1), px, 8.2, pz + r), T(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.12, 10), px, 7 + h + 0.05, pz));
      }
      glowG.push(T(new THREE.BoxGeometry(4.2, 0.25, 0.25), LX(i), 7.05, -19.0));
      g.add(new THREE.Mesh(merge(glowG), gm));
    }
    const pm2 = new THREE.Mesh(merge(pipes), gold); pm2.castShadow = true; g.add(pm2);
    S.pipeTop = (i) => _tv.set(LX(i), 7 + 9 + 7.8 + (2 - Math.abs(i - 2)) * 2.2, -19.4);
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 0.5, 32), pierMat); dais.position.set(0, 0.0, -17.2); g.add(dais);
    const step2 = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.7, 32), pierMat); step2.position.set(0, 0.05, -17.2); g.add(step2);
  }

  // ---------- Maestra Ossia ----------
  function buildMaestra(b) {
    const S = b.state, bg = b.group;
    S.rimC = new THREE.Color(RIM).multiplyScalar(0.42);
    S.gownMat = withRim(new THREE.MeshStandardMaterial({ color: 0x170710, roughness: 0.82, metalness: 0.05, emissive: 0xff7a28, emissiveMap: crackTex(), emissiveIntensity: 0.15, side: THREE.DoubleSide }), S.rimC, 3.0);
    S.gownMat.emissiveMap.repeat.set(3, 1);
    const bone = withRim(W.mat({ color: 0x9c907c, roughness: 0.55 }), S.rimC, 3.4), dark = withRim(W.mat({ color: 0x0c060a, roughness: 0.7 }), S.rimC, 2.2);
    const brass = W.mat({ color: 0x9a7a3a, roughness: 0.3, metalness: 1 });
    S.trim = new THREE.MeshStandardMaterial({ color: 0x6a5020, emissive: GOLD, emissiveIntensity: 0.3, metalness: 1, roughness: 0.3 });
    S.core = new THREE.Group(); S.core.scale.setScalar(1.3); bg.add(S.core);
    // layered gown: five ribbed bell tiers with scalloped hems
    const tiers = [[2.35, 1.6, 0.15, 1.35, 9], [1.95, 1.25, 0.95, 1.2, 8], [1.6, 0.95, 1.7, 1.1, 7], [1.25, 0.7, 2.4, 1.0, 6], [0.92, 0.48, 3.05, 0.75, 6]], gown = [], bands = [];
    for (const [rb, rt, y0, h, sc] of tiers) {
      const geo = new THREE.CylinderGeometry(rt, rb, h, 72, 6, true), P = geo.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i), th = Math.atan2(x, z), yy = y / h + 0.5;
        const k = (1 + 0.1 * Math.sin(yy * PI)) * (1 + 0.04 * Math.cos(th * 24)) * (1 + 0.05 * (1 - yy) * Math.cos(th * sc));
        const drop = yy < 0.2 ? (1 - yy / 0.2) * 0.2 * Math.pow(Math.abs(Math.sin(th * sc * 0.5)), 0.6) : 0;
        P.setXYZ(i, x * k, y - drop, z * k);
      }
      geo.computeVertexNormals(); T(geo, 0, y0 + h / 2, 0); gown.push(geo);
      bands.push(T(new THREE.TorusGeometry(rt * 1.02, 0.035, 5, 48), 0, y0 + h, 0, PI / 2));
    }
    const gm = new THREE.Mesh(merge(gown), S.gownMat); gm.castShadow = true; S.core.add(gm);
    S.core.add(new THREE.Mesh(merge(bands), S.trim));
    // bodice: dark torso under a bone ribcage, spine, sternum, glowing heart inside
    const torso = new THREE.Mesh(new THREE.LatheGeometry([[0.01, 3.7], [0.46, 3.72], [0.4, 4.05], [0.5, 4.6], [0.6, 5.05], [0.5, 5.4], [0.22, 5.6], [0.01, 5.62]].map((p) => new THREE.Vector2(p[0], p[1])), 24), dark);
    torso.castShadow = true; S.core.add(torso);
    const bones = [];
    [[5.2, 0.62], [5.0, 0.7], [4.8, 0.74], [4.6, 0.72], [4.4, 0.66], [4.2, 0.58]].forEach(([y0, R]) => {
      for (const sx of [-1, 1]) { const pts = []; for (let s = 0; s <= 10; s++) { const t = s / 10, a = -PI / 2 + t * (PI - 0.5); pts.push(new V3(sx * R * Math.cos(a), y0 - t * t * 0.3, R * Math.sin(a) * 0.85)); } bones.push(tube(pts, 0.045, 14, 5)); }
    });
    for (let v = 0; v < 12; v++) bones.push(T(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8), 0, 3.95 + v * 0.16, -0.55 + Math.sin(v / 11 * PI) * -0.08));
    bones.push(T(new THREE.BoxGeometry(0.1, 0.95, 0.06), 0, 4.75, 0.66, -0.12));
    for (const sx of [-1, 1]) { bones.push(tube([new V3(0, 5.42, 0.4), new V3(sx * 0.4, 5.48, 0.25), new V3(sx * 0.75, 5.38, 0)], 0.05, 8, 5)); bones.push(T(new THREE.SphereGeometry(0.2, 10, 8), sx * 0.78, 5.32, 0)); }
    for (let v = 0; v < 4; v++) bones.push(T(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 8), 0, 5.66 + v * 0.13, -0.02));
    const bm = new THREE.Mesh(merge(bones), bone); bm.castShadow = true; S.core.add(bm);
    S.heartMat = W.glow(0xffa040, 1.2); const heart = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), S.heartMat); heart.position.set(0, 4.75, 0.3); S.core.add(heart); S.heart = heart;
    // head: porcelain skull mask with dark sockets and ember pupils
    const head = new THREE.Group(); head.position.set(0, 6.3, 0.02); S.core.add(head); S.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 16), bone); skull.scale.set(0.82, 1.08, 0.92); skull.castShadow = true; head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), bone); jaw.scale.set(0.95, 0.75, 0.95); jaw.position.set(0, -0.3, 0.1); head.add(jaw);
    const blk = W.mat({ color: 0x020102, roughness: 1 });
    for (const sx of [-1, 1]) { const so = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), blk); so.scale.set(1, 0.8, 0.5); so.position.set(sx * 0.14, 0.04, 0.34); head.add(so); }
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), blk); mouth.scale.set(1, 0.5, 0.5); mouth.position.set(0, -0.3, 0.33); head.add(mouth);
    S.eyes = W.glow(0xffd890, 3); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), S.eyes); e.position.set(sx * 0.14, 0.04, 0.39); head.add(e); }
    // hood / cowl behind the skull for a stronger silhouette
    const cowl = new THREE.Mesh(new THREE.SphereGeometry(0.58, 18, 12, 0, TAU, 0, PI * 0.62), S.gownMat); cowl.scale.set(0.95, 1.15, 0.9); cowl.position.set(0, 6.35, -0.12); cowl.rotation.x = -0.25; S.core.add(cowl);
    // halo crown of radiating organ pipes
    const crown = new THREE.Group(); crown.position.set(0, 6.45, -0.42); S.core.add(crown); S.crown = crown; const cg = [], tips = [];
    cg.push(new THREE.TorusGeometry(0.95, 0.045, 6, 48), new THREE.TorusGeometry(0.62, 0.025, 5, 40));
    for (let i = 0; i < 15; i++) {
      const a = (i - 7) / 7 * 1.9, L = 0.55 + 1.15 * (1 - Math.abs(i - 7) / 7) + (i % 2) * 0.2, r = 0.05 + (1 - Math.abs(i - 7) / 7) * 0.03, d = 0.95 + L / 2;
      cg.push(T(new THREE.CylinderGeometry(r, r, L, 8), Math.sin(a) * d, Math.cos(a) * d, 0, 0, 0, -a));
      cg.push(T(new THREE.BoxGeometry(r * 2.4, 0.06, r * 2.4), Math.sin(a) * 1.0, Math.cos(a) * 1.0, 0, 0, 0, -a));
      tips.push(T(new THREE.ConeGeometry(r * 1.3, 0.22, 8), Math.sin(a) * (d + L / 2 + 0.1), Math.cos(a) * (d + L / 2 + 0.1), 0, 0, 0, -a));
    }
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; cg.push(T(new THREE.CylinderGeometry(0.018, 0.018, 0.33, 4), Math.sin(a) * 0.78, Math.cos(a) * 0.78, 0, 0, 0, -a)); }
    crown.add(new THREE.Mesh(merge(cg), brass)); S.crownTip = new THREE.MeshStandardMaterial({ color: 0x2a1a08, emissive: GOLD, emissiveIntensity: 0.8, metalness: 1, roughness: 0.3 }); crown.add(new THREE.Mesh(merge(tips), S.crownTip));
    // jointed, tapered arms; extra pairs unfold in later phases
    S.batonTip = W.glow(0xfff0d0, 3.5); S.arms = [];
    const mkArm = (sx, sy, ph, tier, baton, sc) => {
      const sh = new THREE.Group(); sh.position.set(sx * 0.78, sy, 0); S.core.add(sh);
      const ag = [T(new THREE.CylinderGeometry(0.1, 0.075, 1.5, 9), 0, -0.75, 0), T(new THREE.SphereGeometry(0.095, 8, 6), 0, -1.5, 0)];
      sh.add(new THREE.Mesh(merge(ag), bone));
      const el = new THREE.Group(); el.position.y = -1.5; sh.add(el);
      const fg = [T(new THREE.CylinderGeometry(0.075, 0.045, 1.45, 9), 0, -0.72, 0), T(new THREE.SphereGeometry(0.055, 6, 5), 0, -1.45, 0), T(new THREE.BoxGeometry(0.14, 0.2, 0.05), 0, -1.6, 0)];
      for (let f = 0; f < 4; f++) fg.push(T(new THREE.ConeGeometry(0.018, 0.32, 4), (f - 1.5) * 0.04, -1.84, 0.02, 0.25 * (f - 1.5) * 0.2, 0, (f - 1.5) * 0.12));
      el.add(new THREE.Mesh(merge(fg), bone));
      if (baton) {
        const bt = new THREE.Group(); bt.position.set(0, -1.62, 0.04); bt.rotation.x = 1.25; el.add(bt);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 1.7, 6), brass); rod.position.y = -0.85; bt.add(rod);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), S.batonTip); tip.position.y = -1.72; bt.add(tip);
      }
      sh.scale.setScalar(tier ? 0.001 : sc); sh.visible = !tier;
      S.arms.push({ sh, el, sx, ph, tier, sc, k: tier ? 0 : 1 });
    };
    mkArm(1, 5.3, 0, 0, true, 1); mkArm(-1, 5.3, 1.6, 0, false, 1);
    mkArm(1, 4.9, 3.1, 1, true, 0.9); mkArm(-1, 4.9, 4.4, 1, true, 0.9);
    mkArm(1, 4.5, 2.2, 2, false, 0.78); mkArm(-1, 4.5, 5.3, 2, true, 0.78);
    // the staff: a ring of five glass staff lines with glass keys riding it; splits into two counter-rotating rings late
    S.staffMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb8b0ff).multiplyScalar(0.9), transparent: true, opacity: 0.55, depthWrite: false });
    S.staffA = new THREE.Group(); S.staffB = new THREE.Group(); S.core.add(S.staffA); S.core.add(S.staffB); S.staffB.visible = false;
    for (const [grp, r] of [[S.staffA, 2.9], [S.staffB, 3.5]]) { const lines = []; for (let k = 0; k < 5; k++) lines.push(T(new THREE.TorusGeometry(r, 0.012, 3, 96), 0, (k - 2) * 0.09, 0, PI / 2)); grp.add(new THREE.Mesh(merge(lines), S.staffMat)); }
    const glassKey = new THREE.MeshStandardMaterial({ color: 0xe6ecff, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.78, emissive: 0x7a80ff, emissiveIntensity: 0.35, envMapIntensity: 2.5 });
    const ebony = new THREE.MeshStandardMaterial({ color: 0x07060c, roughness: 0.15, metalness: 0.6, emissive: RIM, emissiveIntensity: 0.12 });
    S.keyW = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.05, 0.72), glassKey, 20); S.keyB = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.08, 0.48), ebony, 12);
    for (const m of [S.keyW, S.keyB]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; S.core.add(m); }
    S.keyDummy = new THREE.Object3D(); S.split = 0; S.ringA = 0; S.ringB = 0;
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x04071a, horizon: 0x18204c, bottom: 0x020308, stars: 1.0, sunDir: [0.75, 0.55, 0.1], sunColor: 0xa8b8ff, sunSize: 0.05, sunGlow: 0.5 }); g.add(sky); S.sky = sky; W.env(sky, 0.5);
    scene.fog = new THREE.FogExp2(0x080a16, 0.012);
    S.hemi = W.hemi(g, 0x4a5a9a, 0x1a1210, 0.62);
    S.sun = W.sun(g, { dir: [0.8, 0.75, 0.12], color: 0x9fb2ff, intensity: 2.4, size: 26 });
    S.organLight = new THREE.PointLight(0xffb060, 150, 60, 1.7); S.organLight.position.set(0, 9, -12); g.add(S.organLight);
    S.backLight = new THREE.PointLight(0x8090ff, 170, 50, 1.7); S.backLight.position.set(0, 10, 12); g.add(S.backLight);
    // floor: polished dark marble, brass staff borders between lanes
    const fl = W.bake(512, marble(4), { dark: 0x09080e, light: 0x8a86a0, strength: 1.4 }); for (const k in fl) fl[k].repeat.set(3, 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 44), new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, roughnessMap: fl.roughnessMap, roughness: 0.35, metalness: 0.2, envMapIntensity: 1.8 })); floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
    const st = staffTex(); S.borders = [];
    for (let i = 0; i <= 5; i++) {
      const m = new THREE.MeshStandardMaterial({ map: st.map, emissiveMap: st.emissiveMap, emissive: GOLD, emissiveIntensity: 0.35, metalness: 0.9, roughness: 0.3 });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, HZ * 2), m); p.rotation.x = -PI / 2; p.position.set(-HX + LW * i, 0.014, 0); g.add(p); S.borders.push(m);
    }
    S.inlay = new THREE.MeshStandardMaterial({ color: 0x5a4020, emissive: GOLD, emissiveIntensity: 0.35, metalness: 1, roughness: 0.3 });
    for (const z of [-HZ, HZ]) { const m = new THREE.Mesh(new THREE.BoxGeometry(22.4, 0.02, 0.16), S.inlay); m.position.set(0, 0.012, z); g.add(m); }
    buildNave(g, S);
    S.motes = W.motes({ n: 450, box: [26, 22, 40], color: 0xbfc8ff, size: 0.06, vel: [0.05, -0.08, 0.03], sway: 0.5, center: [0, 11, 0], mult: 0.7 }); g.add(S.motes);
    buildMaestra(b);
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
    for (let k = 0; k < 4; k++) FX.pillar(LX(i), -13 + k * 8.5, { r: 1.8, h: 13, color: GOLD, dur: 0.5 });
    FX.burst(LX(i), 0.3, 0, { n: 30, color: GOLD, color2: 0xfff4d0, speed: [1, 5], up: 7, life: [0.4, 1], size: [0.2, 0.45], radius: 2 }); FX.burst(LX(i), 0.3, -10, { n: 16, color: GOLD, speed: [1, 5], up: 7, life: [0.4, 1], radius: 2 }); FX.burst(LX(i), 0.3, 10, { n: 16, color: GOLD, speed: [1, 5], up: 7, life: [0.4, 1], radius: 2 });
    FX.light(LX(i), 3, G.player.pos.z, GOLD, 40, 0.4, 20); playLane(b, i, true); FX.shake(0.22);
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
  // chorister: hooded ivory robe, porcelain mask with an open singing mouth, sound rings pulsing from it
  function choristerMesh() {
    const g = new THREE.Group(), rimC = new THREE.Color(0xffd890).multiplyScalar(0.6);
    const robeM = withRim(new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.75, emissive: 0x3a2a10, emissiveIntensity: 0.6, side: THREE.DoubleSide }), rimC, 2.5);
    const geo = new THREE.CylinderGeometry(0.22, 0.8, 2.3, 32, 4, true), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), th = Math.atan2(x, z), k = 1 + 0.06 * Math.cos(th * 10) * (0.5 - y / 2.3); P.setXYZ(i, x * k, y, z * k); }
    geo.computeVertexNormals(); const robe = new THREE.Mesh(geo, robeM); robe.position.y = 1.2; g.add(robe);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12, 0, TAU, 0, PI * 0.7), robeM); hood.scale.set(0.9, 1.2, 1); hood.position.set(0, 2.5, -0.05); hood.rotation.x = -0.35; g.add(hood);
    const shadow = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), W.mat({ color: 0x050307, roughness: 1 })); shadow.position.set(0, 2.45, 0.02); g.add(shadow);
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, -PI / 2, PI), W.mat({ color: 0xf2ece0, roughness: 0.3, emissive: 0x403020, emissiveIntensity: 0.5 })); mask.scale.set(0.85, 1.2, 0.5); mask.position.set(0, 2.42, 0.17); g.add(mask);
    const blk = W.mat({ color: 0x000000, roughness: 1 });
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), blk); e.scale.set(1.4, 0.7, 0.6); e.position.set(sx * 0.07, 2.5, 0.27); g.add(e); }
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), W.glow(0xffd890, 2.2)); mouth.scale.set(0.8, 1.25, 0.4); mouth.position.set(0, 2.3, 0.26); g.add(mouth);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 6, 32), W.glow(GOLD, 2.4)); halo.position.set(0, 2.72, -0.28); g.add(halo);
    const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe0a0).multiplyScalar(1.6), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const rings = []; for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 4, 24), ringM.clone()); r.position.set(0, 2.3, 0.35); g.add(r); rings.push(r); }
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.36), W.mat({ color: 0x5a1020, roughness: 0.6 })); book.position.set(0, 1.55, 0.5); book.rotation.x = 0.5; g.add(book);
    const page = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.32), W.glow(0xfff0d0, 1.1)); page.position.set(0, 1.585, 0.49); page.rotation.x = 0.5; g.add(page);
    const L = new THREE.PointLight(0xffd080, 10, 8, 1.6); L.position.set(0, 2, 0.6); g.add(L);
    g.userData.rings = rings; return g;
  }
  function spawnChorister(b, x, z) {
    FX.pillar(x, z, { r: 1.2, h: 16, color: 0xffe0a0, dur: 0.9 }); Sound.sfx('bell', 0.5, 2);
    const mesh = choristerMesh();
    return b.spawnAdd({
      name: 'Chorister', hp: 680, x, z, radius: 0.85, aimY: 1.7, mesh, color: 0xffe0a0, facing: angTo(x, z, 0, 0),
      update(a) {
        a.pos.y = 0.25 + Math.sin(G.now * 2 + x) * 0.12; if (G.headless) return;
        const sing = a.castState ? 1 : 0.35; mesh.userData.rings.forEach((r, k) => { const ph = (G.now * (0.8 + sing) + k / 3) % 1; r.scale.setScalar(1 + ph * 5 * sing); r.position.z = 0.35 + ph * 0.9 * sing; r.material.opacity = (1 - ph) * 0.55 * sing; });
        if (a.castState && vrand() < 0.4) { FX.burst(a.pos.x, 2.6, a.pos.z, { n: 1, color: 0xffe0a0, dir: [-a.pos.x * 0.06, 0.5, (-15.6 - a.pos.z) * 0.06], spread: 0.2, speed: [5, 9], life: [0.5, 0.9], size: [0.15, 0.3] }); }
      },
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
    const S = b.state, tn = WIN_TINT[idx]; S.winPhase = idx;
    const from = S.windows.map((w) => w.material.color.clone()), to = new THREE.Color(tn[0], tn[1], tn[2]).multiplyScalar(tn[3]);
    const a0 = S.rays[0].material.uniforms.uA.value, a1 = [0.08, 0.1, 0.12][idx], p0 = S.pools[0].material.uniforms.uA.value, p1 = [0.1, 0.12, 0.15][idx];
    yield* W.tween(dur, (k) => { S.windows.forEach((w, i) => W.colorLerp(w.material.color, from[i], to, k)); for (const r of S.rays) r.material.uniforms.uA.value = lerp(a0, a1, k); for (const p of S.pools) p.material.uniforms.uA.value = lerp(p0, p1, k); });
  }

  G.bosses.push({
    id: 'cathedral', name: 'MAESTRA OSSIA', title: 'The Glass Cathedral', hint: 'A hymn', color: '#8f7bff', telegraph: GOLD,
    hp: 26000, radius: 2.5, aimY: 5.4, enrage: 420,
    post: { bloom: 0.55, threshold: 1.0, radius: 0.6, exposure: 1.0, vig: 1.0, sat: 1.1, contrast: 1.06, tint: [0.96, 0.98, 1.06] },
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
        const S = b.state; Sound.sfx('roar', 0.7, 1.6); S.strike = 1; S.intensity = 1; Co.start(setWindows(b, 1), 'fight'); Co.start(Post.lerpTo({ tint: [1.06, 0.95, 0.97], bloom: 0.6, contrast: 1.1 }, 2.5), 'fight');
        S.organLight.color.set(0xff6040); S.rimC.set(0xa070ff).multiplyScalar(0.55); FX.flash(0xff4030, 0.3, 1.5); FX.shake(0.6);
        for (let i = 0; i < 5; i++) { playLane(b, i, true); yield 0.22; } yield 1.2;
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
        const S = b.state; for (const e of G.ents) if (e.isAdd) e.die(); S.intensity = 2;
        yield* b.cast({ name: 'Crescendo', time: 2.4, onTick: (k) => { FX.shake(k * 0.5); for (let i = 0; i < 5; i++) S.pipeHeat[i] = k; } });
        Sound.sfx('shatter'); Sound.sfx('bigboom'); FX.flash(0xfff0d0, 0.5, 1.4); FX.shake(1.2);
        for (const w of S.windows) FX.burst(w.position.x * 0.96, w.position.y, w.position.z, { n: 50, color: 0xffd090, color2: 0xc03060, dir: [-Math.sign(w.position.x), -0.1, w.position.x === 0 ? -Math.sign(w.position.z) : 0], spread: 0.7, speed: [4, 18], grav: 9, life: [0.8, 2], size: [0.12, 0.35] });
        // escalate with colour and contrast, not brightness: cold violet counter-light against the gold lanes, dark floor
        Co.start(setWindows(b, 2, 1.2), 'fight'); Co.start(Post.lerpTo({ tint: [1.04, 0.97, 1.04], bloom: 0.6, threshold: 1.1, exposure: 0.97, contrast: 1.14, sat: 1.18 }, 1.5), 'fight');
        S.inlay.emissiveIntensity = 0.6; S.organLight.color.set(0xff9a40); S.hemi.color.set(0x4a36a0); S.hemi.groundColor.set(0x0a0610); S.hemi.intensity = 0.6;
        S.backLight.color.set(0x7048ff); S.backLight.intensity = 220; S.rimC.set(0xb080ff).multiplyScalar(0.75); S.flame = 1; scene.fog.color.set(0x0a0716); scene.fog.density = 0.010;
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
      const casting = b.castState ? 1 : 0, I = S.intensity; S.strike = Math.max(0, (S.strike || 0) - dt * 1.5);
      S.core.position.y = 0.5 + Math.sin(t * 1.1) * 0.18;
      S.head.rotation.set(-0.12 + Math.sin(t * 0.9) * 0.05 - S.strike * 0.15, Math.sin(t * 0.6) * 0.12, Math.sin(t * 0.7) * 0.05);
      S.crown.rotation.z = Math.sin(t * 0.5) * 0.04;
      for (const a of S.arms) {
        a.k = Math.min(1, Math.max(0, a.k + (a.tier <= I ? dt * 0.8 : -dt * 2))); a.sh.visible = a.k > 0.01; if (!a.sh.visible) continue;
        const u = smooth(a.k), sw = Math.sin(t * (1.6 + I * 0.7) + a.ph), up = casting * 0.9 + S.strike * 1.2;
        a.sh.scale.setScalar(Math.max(0.001, a.sc * u));
        a.sh.rotation.set(lerp(0.3, -0.5 - up * 0.9 + sw * 0.25, u), 0, a.sx * (lerp(0.05, 0.5 + up * 0.5 + Math.cos(t * 1.3 + a.ph) * 0.2, u) + a.tier * 0.25));
        a.el.rotation.set(lerp(-2.4, -0.9 + sw * 0.4 - S.strike * 0.5, u), 0, 0);
      }
      // key ring: speeds up each phase; in the last phase half the keys peel off into a second, counter-rotating ring
      S.split = Math.min(1, Math.max(0, S.split + (I >= 2 ? dt * 0.6 : -dt))); S.staffB.visible = S.split > 0.01;
      S.ringA += dt * (0.25 + I * 0.22); S.ringB -= dt * (0.4 + I * 0.2);
      const sp = smooth(S.split), dmy = S.keyDummy; let wi = 0, bi = 0;
      for (let i = 0; i < 32; i++) {
        const black = i % 8 === 1 || i % 8 === 3 || i % 8 === 6, onB = i % 2 === 1, aA = i / 32 * TAU + S.ringA, wv = Math.max(0, Math.sin(t * 5 - i * 0.7)) * 0.1 * (1 + I);
        let x = Math.sin(aA) * 2.9, y = 3.3 + Math.sin(aA * 2 + t) * 0.12 - wv, z = Math.cos(aA) * 2.9, ry = aA;
        if (onB && sp > 0) { const aB = i / 32 * TAU + S.ringB; x = lerp(x, Math.sin(aB) * 3.5, sp); y = lerp(y, 1.7 + Math.sin(aB * 3 - t) * 0.12 + wv, sp); z = lerp(z, Math.cos(aB) * 3.5, sp); ry = lerp(ry, aB, sp); }
        dmy.position.set(x, y + (black ? 0.03 : 0), z); dmy.rotation.set(0, ry, 0); dmy.updateMatrix();
        if (black) { if (bi < 12) S.keyB.setMatrixAt(bi++, dmy.matrix); } else if (wi < 20) S.keyW.setMatrixAt(wi++, dmy.matrix);
      }
      S.keyW.count = wi; S.keyB.count = bi; S.keyW.instanceMatrix.needsUpdate = true; S.keyB.instanceMatrix.needsUpdate = true;
      S.staffA.rotation.y = S.ringA * 0.2; S.staffA.position.y = 3.3; S.staffB.position.y = 1.7; S.staffB.scale.setScalar(Math.max(0.001, sp));
      S.staffMat.opacity = 0.35 + casting * 0.3 + Math.max(0, Math.sin(t * 4)) * 0.1;
      // gown cracks open as she weakens; heart and crown follow
      const crack = [0.12, 1.3, 2.6][I] * (0.85 + 0.15 * Math.sin(t * 2.3)) + casting * 0.4;
      S.gownMat.emissiveIntensity = crack; S.gownMat.emissive.setHex(I >= 2 ? 0xffb050 : 0xff6a20);
      S.heartMat.color.setHex(0xffa040).multiplyScalar(0.8 + I * 0.7 + casting * 0.8 + Math.sin(t * 4) * 0.2);
      S.crownTip.emissiveIntensity = 0.6 + I * 0.5 + casting * 1.2;
      S.batonTip.color.setHex(0xfff0d0).multiplyScalar(2 + casting * 2 + S.strike * 3);
      for (let i = 0; i < 5; i++) { S.pipeHeat[i] = Math.max(0, S.pipeHeat[i] - dt * 1.6); S.pipeGlow[i].emissiveIntensity = 0.3 + I * 0.35 + S.pipeHeat[i] * 6; }
      // brass lane borders pulse with the lanes she plays
      for (let i = 0; i <= 5; i++) { const h = Math.max(i > 0 ? S.pipeHeat[i - 1] : 0, i < 5 ? S.pipeHeat[i] : 0); S.borders[i].emissiveIntensity = 0.3 + I * 0.12 + h * 2.2 + Math.max(0, Math.sin(t * 2.1 - i * 0.6)) * 0.12; }
      S.trim.emissiveIntensity = 0.3 + I * 0.2 + casting * 1.0;
      S.organLight.intensity = (I === 2 ? 230 : 150) * (0.9 + Math.sin(t * 7) * 0.04 + Math.sin(t * 13.3) * 0.03);
      for (let i = 0; i < S.candleL.length; i++) S.candleL[i].intensity = 10 * (0.85 + Math.sin(t * 11 + i * 2) * 0.08 + Math.sin(t * 23 + i) * 0.07);
      if (S.flame && vrand() < dt * 16) { const i = Math.floor(vrand() * 5), tp = S.pipeTop(i); FX.burst(tp.x + (vrand() - 0.5) * 3, tp.y - vrand() * 4, tp.z, { n: 2, color: 0xffa030, color2: 0xff3010, speed: [0.5, 2], up: 6, life: [0.5, 1.2], size: [0.25, 0.6] }); }
      if (S.flame && vrand() < dt * 10) FX.burst((vrand() - 0.5) * 22, 16 + vrand() * 6, (vrand() - 0.5) * 34, { n: 1, color: vrand() < 0.5 ? 0xff4060 : 0x6080ff, speed: [0, 0.5], grav: 2.5, life: [2, 4], size: [0.08, 0.18] });
    },
    danger(b, x, z) { let best = Infinity; for (const w of b.state.walls) { if (laneOf(x) === w.gap) continue; const tt = (z - w.z) / w.v; if (tt > -0.1 && tt < best) best = Math.max(0, tt); } return best; },
    bot(b, p) {
      const add = G.ents.find((e) => e.isAdd && e.alive); const h = {};
      if (add) { h.target = add; h.saveInterrupt = true; if (p.cls.id === 'duskblade') { const d = Math.hypot(p.pos.x - add.pos.x, p.pos.z - add.pos.z) || 1; h.x = add.pos.x + (p.pos.x - add.pos.x) / d * 2.2; h.z = add.pos.z + (p.pos.z - add.pos.z) / d * 2.2; } } else h.target = b;
      return h;
    },
  });
})();
