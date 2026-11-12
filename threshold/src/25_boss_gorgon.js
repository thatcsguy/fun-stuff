// DOOR VI: EURYALE, the Stone Garden. A moonlit terrace full of her victims. The fight is decided by which way your character is facing.
(() => {
  const R = 18, VEN = 0x8dff7a, PALE = 0xd8ffd0, PED_R = 16.4, NPED = 10, MIR_R = 16.5;
  const _v = new V3(), _a = new V3(), _b2 = new V3(), _m = new THREE.Object3D(), _q = new THREE.Quaternion(), _c = new THREE.Color(), _c2 = new THREE.Color();
  const _Y = new V3(0, 1, 0), _d = new V3(), _s = new V3(), _u = new V3(), _w = new V3(), _M = new THREE.Matrix4();
  const MOON_DIR = new V3(-0.499, 0.061, -0.864).normalize();

  // What the player can see: a 90 degree horizontal cone from the way the CHARACTER faces. The camera, the window shape
  // and height play no part. Hold right mouse to face where the camera looks, or just move: you face the way you run.
  // The autopilot cannot steer, so it keeps a virtual gaze (S.botYaw) with the same cone.
  const VIS_HALF = PI / 4, VIS_NEAR = 1.5;
  function seen(S, x, y, z) {
    const p = G.player, bot = G.headless || Bot.level;
    if (!bot && Cam.cineW > 0.5) return true;
    if (Math.hypot(x - p.pos.x, z - p.pos.z) < VIS_NEAR) return true;
    return Math.abs(angDiff(bot ? S.botYaw : p.facing, angTo(p.pos.x, p.pos.z, x, z))) < VIS_HALF;
  }
  // A faint wedge on the floor at the player's feet showing exactly that cone.
  function visionWedge() {
    const N = 24, RAD = 9, pos = [0, 0, 0], col = [1, 1, 1], idx = [];
    for (let i = 0; i <= N; i++) { const a = -VIS_HALF + i / N * VIS_HALF * 2; pos.push(Math.sin(a) * RAD, 0, Math.cos(a) * RAD); col.push(0, 0, 0); if (i) idx.push(0, i, i + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: PALE, vertexColors: true, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute([Math.sin(-VIS_HALF) * RAD, 0, Math.cos(-VIS_HALF) * RAD, 0, 0, 0, 0, 0, 0, Math.sin(VIS_HALF) * RAD, 0, Math.cos(VIS_HALF) * RAD], 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0], 3));
    const edge = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: PALE, vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    const g = new THREE.Group(); g.add(fill, edge); fill.renderOrder = edge.renderOrder = 8; fill.frustumCulled = edge.frustumCulled = false; g.visible = false;
    return { g, fill, edge, k: 0 };
  }

  // ---------- helpers ----------
  function withRim(mat, U, power = 2.6) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = U;
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim;\nvoid main() {').replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRim * pow(max(fr, 0.0), ' + power.toFixed(2) + '); }');
    };
    mat.customProgramCacheKey = () => 'gorRim' + power; return mat;
  }
  function merge(list) {
    let n = 0; const parts = list.map(([g, m]) => { const q = g.index ? g.toNonIndexed() : g.clone(); g.dispose(); q.applyMatrix4(m); n += q.attributes.position.count; return q; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    for (const q of parts) { const c = q.attributes.position.count; pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3); if (q.attributes.uv) uv.set(q.attributes.uv.array, o * 2); o += c; q.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeBoundingSphere(); return g;
  }
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const ctex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  // emissive mask that lights the voronoi cracks of SURF.stone(seed, 6), texel-aligned with it
  // sparse: only a few fracture zones light up. tall=true maps one texture over a whole column (cells x4 vertically to stay
  // aligned with the stone map at repeat (2,4)) and makes the light bleed strongest at the base.
  function crackMask(seed, tall) {
    return W.bake(tall ? 512 : 256, (u, v) => { const c = W.cell(u * 6, v * (tall ? 24 : 6), seed, 6), line = 1 - smooth(sat(c[1] * 12));
      const fr = smooth(sat((W.fbm(u * 4, v * (tall ? 3 : 4), seed + 5, 3, 4) - 0.5) * 7)), base = tall ? sat(Math.pow(v, 1.6) * 1.6 + 0.05) : 1;
      return [0, line * line * sat(fr * base * 1.3), 1]; }, { dark: 0x000001, light: 0xffffff }).map;
  }

  // ---------- the petrified: one merged mesh per pose ----------
  // joint positions of a figure facing +z; shield [x,y,z, nx,ny,nz]; spear [ax,ay,az, bx,by,bz]
  const POSES = [
    { hip: [0, 1.0, 0], kL: [-0.17, 0.52, 0.06], fL: [-0.2, 0.06, 0.12], kR: [0.17, 0.5, -0.16], fR: [0.2, 0.06, -0.36], chest: [0, 1.5, 0.03], neck: [0, 1.9, 0.05], head: [0, 2.08, 0.07],
      elL: [-0.47, 1.62, 0.3], haL: [-0.3, 1.95, 0.46], shield: [-0.3, 1.86, 0.56, 0.15, 0.15, 1], elR: [0.52, 1.45, -0.08], haR: [0.56, 1.24, 0.14], spear: [0.56, 0.25, -0.12, 0.58, 3.0, 0.5] },
    { hip: [0, 0.62, -0.05], kL: [-0.18, 0.62, 0.42], fL: [-0.19, 0.06, 0.45], kR: [0.18, 0.08, 0.22], fR: [0.19, 0.08, -0.36], chest: [0, 1.05, 0.2], neck: [0, 1.36, 0.36], head: [0, 1.5, 0.47],
      elL: [-0.38, 1.55, 0.52], haL: [0.04, 1.74, 0.56], elR: [0.38, 1.58, 0.48], haR: [-0.05, 1.77, 0.5], shield: [0.5, 0.45, 0.6, 0.35, 0.5, 1], spear: [-0.9, 0.06, -0.5, 0.7, 0.06, 0.6] },
    { hip: [0, 1.0, 0], kL: [-0.16, 0.53, 0.14], fL: [-0.18, 0.06, 0.28], kR: [0.16, 0.5, -0.1], fR: [0.18, 0.06, -0.32], chest: [0, 1.5, -0.08], neck: [0, 1.86, -0.15], head: [0, 2.03, -0.17],
      elR: [0.4, 1.86, 0.28], haR: [0.43, 1.98, 0.72], elL: [-0.5, 1.45, -0.26], haL: [-0.62, 1.13, -0.08], shield: [-0.68, 1.05, 0.0, -1, 0, 0.3], spear: null },
  ];
  function figureGeo(P, broken, lo) {
    const L = [], A = new V3(), B = new V3(), cs = lo ? 5 : 7, ss = lo ? [6, 4] : [9, 6];
    const put = (geo, p, q, s) => L.push([geo, new THREE.Matrix4().compose(p, q || new THREE.Quaternion(), s || new V3(1, 1, 1))]);
    const qd = (d) => new THREE.Quaternion().setFromUnitVectors(_Y, d.clone().normalize());
    const seg = (a, b, r0, r1) => { A.set(...a); B.set(...b); const d = B.clone().sub(A), l = Math.max(d.length(), 1e-3); put(new THREE.CylinderGeometry(r1, r0, l, cs), A.clone().add(B).multiplyScalar(0.5), qd(d)); };
    const ball = (p, r, sx = 1, sy = 1, sz = 1) => put(new THREE.SphereGeometry(r, ss[0], ss[1]), new V3(...p), null, new V3(sx, sy, sz));
    const mid = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k), hp = P.hip, nk = P.neck, ch = P.chest;
    const sL = [ch[0] - 0.3, nk[1] - 0.13, (ch[2] + nk[2]) / 2], sR = [ch[0] + 0.3, nk[1] - 0.13, (ch[2] + nk[2]) / 2];
    seg([hp[0] - 0.15, hp[1], hp[2]], P.kL, 0.13, 0.1); seg(P.kL, P.fL, 0.1, 0.07); seg([hp[0] + 0.15, hp[1], hp[2]], P.kR, 0.13, 0.1); seg(P.kR, P.fR, 0.1, 0.07);
    ball(P.kL, 0.105); ball(P.kR, 0.105);
    for (const f of [P.fL, P.fR]) put(new THREE.BoxGeometry(0.15, 0.09, 0.3), new V3(f[0], Math.max(0.045, f[1] - 0.02), f[2] + 0.08));
    ball(hp, 0.27, 1.1, 0.75, 0.85); seg([hp[0], hp[1] + 0.05, hp[2]], [hp[0], hp[1] - 0.32, hp[2]], 0.27, 0.36);
    seg(hp, nk, 0.24, 0.32); ball(ch, 0.3, 1.18, 1.0, 0.8); ball(sL, 0.13); ball(sR, 0.13);
    if (!broken) {
      seg(nk, P.head, 0.085, 0.08); ball(P.head, 0.165, 0.92, 1.05, 1);
      put(new THREE.SphereGeometry(0.195, ss[0], ss[1], 0, TAU, 0, PI * 0.56), new V3(P.head[0], P.head[1] + 0.03, P.head[2] - 0.01));
      put(new THREE.BoxGeometry(0.05, 0.2, 0.46), new V3(P.head[0], P.head[1] + 0.25, P.head[2] - 0.04));
    } else seg(nk, mid(nk, P.head, 0.5), 0.09, 0.085);
    seg(sL, P.elL, 0.085, 0.075); seg(P.elL, P.haL, 0.075, 0.058); ball(P.haL, 0.07);
    if (!broken) { seg(sR, P.elR, 0.085, 0.075); seg(P.elR, P.haR, 0.075, 0.058); ball(P.haR, 0.07); } else seg(sR, mid(sR, P.elR, 0.5), 0.085, 0.08);
    if (P.shield) { const s = P.shield, n = new V3(s[3], s[4], s[5]).normalize(); put(new THREE.CylinderGeometry(0.5, 0.5, 0.06, lo ? 10 : 16), new V3(s[0], s[1], s[2]), qd(n)); put(new THREE.SphereGeometry(0.11, 8, 5), new V3(s[0], s[1], s[2]).addScaledVector(n, 0.05), null, new V3(1, 1, 1)); }
    if (P.spear && !broken) { const s = P.spear; seg([s[0], s[1], s[2]], [s[3], s[4], s[5]], 0.026, 0.024); const d = new V3(s[3] - s[0], s[4] - s[1], s[5] - s[2]).normalize(); put(new THREE.ConeGeometry(0.065, 0.3, 6), new V3(s[3], s[4], s[5]).addScaledVector(d, 0.15), qd(d)); }
    return merge(L);
  }

  // ---------- textures ----------
  // fissures along the mosaic's ring joints with a few radial breaks; width swells and pinches along each one
  let CRK = null;
  function crackPaths() {
    if (CRK) return CRK; const r = mulberry(47), P = [];
    for (const R0 of [58, 102, 148, 194, 226, 250]) for (let n = 0; n < 2 + (R0 > 100 ? 1 : 0); n++) {
      const a0 = r() * TAU, span = 0.35 + r() * 0.8, w0 = 1.5 + r() * 2.5, pts = [];
      for (let a = 0; a <= span; a += 0.05) { const k = a / span; pts.push([Math.sin(a0 + a) * (R0 + (r() - 0.5) * 3), Math.cos(a0 + a) * (R0 + (r() - 0.5) * 3), w0 * Math.pow(Math.sin(PI * k), 0.6) * (0.6 + r() * 0.6)]); }
      P.push(pts);
    }
    for (let n = 0; n < 7; n++) { const a = Math.floor(r() * 28) / 28 * TAU, r0 = 20 + r() * 60, r1 = Math.min(250, r0 + 70 + r() * 120), w0 = 1.5 + r() * 2.5, pts = [];
      for (let q = r0; q <= r1; q += 9) { const k = (q - r0) / (r1 - r0), aa = a + (r() - 0.5) * 0.05; pts.push([Math.sin(aa) * q, Math.cos(aa) * q, w0 * Math.pow(Math.sin(PI * k), 0.6) * (0.6 + r() * 0.6)]); } P.push(pts); }
    return (CRK = P);
  }
  function drawCracks(x, mode) {
    x.lineCap = x.lineJoin = 'round';
    const pass = (col, wm, blur) => { x.strokeStyle = col; x.shadowBlur = blur; x.shadowColor = col; for (const pts of crackPaths()) for (let i = 1; i < pts.length; i++) { x.lineWidth = Math.max(0.4, (pts[i][2] + pts[i - 1][2]) * 0.5 * wm); x.beginPath(); x.moveTo(pts[i - 1][0], pts[i - 1][1]); x.lineTo(pts[i][0], pts[i][1]); x.stroke(); } x.shadowBlur = 0; };
    if (mode === 'dark') pass('#070605', 1.15, 0); else { pass('rgba(110,0,0,1)', 2.2, 10); pass('#ff0000', 0.45, 0); }
  }
  function mosaicTex() {
    const c = canvas(512, 512), x = c.getContext('2d'), r = mulberry(41);
    x.fillStyle = '#222824'; x.fillRect(0, 0, 512, 512); x.translate(256, 256);
    const ring = (r0, r1, n, cols) => { for (let i = 0; i < n; i++) { x.fillStyle = cols[i % cols.length]; x.globalAlpha = 0.75 + r() * 0.25; x.beginPath(); x.arc(0, 0, r1, i / n * TAU, (i + 1) / n * TAU); x.arc(0, 0, r0, (i + 1) / n * TAU, i / n * TAU, true); x.closePath(); x.fill(); x.globalAlpha = 1; x.strokeStyle = '#121414'; x.lineWidth = 2; x.stroke(); } };
    ring(228, 250, 64, ['#8a9488', '#34503f']); ring(196, 226, 40, ['#b2b8a8', '#5c7a68', '#b2b8a8', '#284236']); ring(150, 194, 28, ['#4a6654', '#a2ab9a']);
    ring(104, 148, 18, ['#c0c4b2', '#2a4636', '#7a947e']); ring(60, 102, 12, ['#34523f', '#aab4a0']); ring(0, 58, 9, ['#96a48e', '#213c2e', '#c6cab8']);
    drawCracks(x, 'dark');
    // a ring of open eyes
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; x.save(); x.rotate(a); x.translate(0, -172); x.fillStyle = '#e0e2d0'; x.beginPath(); x.ellipse(0, 0, 20, 10, 0, 0, TAU); x.fill(); x.fillStyle = '#1c3a2a'; x.beginPath(); x.arc(0, 0, 8, 0, TAU); x.fill(); x.fillStyle = '#050806'; x.beginPath(); x.ellipse(0, 0, 2.2, 7, 0, 0, TAU); x.fill(); x.restore(); }
    return ctex(c);
  }
  // R = cracks through the mosaic (lit in phase 2), G = the eyes (lit in phase 3)
  function mosaicGlow() {
    const c = canvas(512, 512), x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); x.translate(256, 256); drawCracks(x, 'glow');
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; x.save(); x.rotate(a); x.translate(0, -172); x.fillStyle = '#005a00'; x.beginPath(); x.ellipse(0, 0, 20, 10, 0, 0, TAU); x.fill(); x.fillStyle = '#00ff00'; x.beginPath(); x.arc(0, 0, 8, 0, TAU); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.ellipse(0, 0, 2.2, 7, 0, 0, TAU); x.fill(); x.restore(); }
    const t = ctex(c, false); return t;
  }
  function starTex() {
    const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 22); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    for (const [w, a] of [[3, 0], [3, PI / 2], [1.6, PI / 4], [1.6, -PI / 4]]) { x.save(); x.translate(64, 64); x.rotate(a); const l = x.createLinearGradient(-64, 0, 64, 0); l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(0.5, 'rgba(255,255,255,0.9)'); l.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = l; x.fillRect(-64, -w / 2, 128, w); x.restore(); }
    return new THREE.CanvasTexture(c);
  }
  function flareTex() {
    const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(200,255,190,0.6)'); g.addColorStop(0.4, 'rgba(90,255,120,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }
  // serpent eye: gold-green iris, black slit, soft almond edge
  function eyeTex() {
    const c = canvas(128, 64), x = c.getContext('2d'); x.save(); x.beginPath(); x.ellipse(64, 32, 60, 26, 0, 0, TAU); x.clip();
    const g = x.createRadialGradient(64, 32, 2, 64, 32, 60); g.addColorStop(0, '#fffbd0'); g.addColorStop(0.35, '#d8ff60'); g.addColorStop(0.75, '#5ad040'); g.addColorStop(1, '#0a3010');
    x.fillStyle = g; x.fillRect(0, 0, 128, 64); x.fillStyle = '#000'; x.beginPath(); x.ellipse(64, 32, 6, 25, 0, 0, TAU); x.fill(); x.restore();
    return ctex(c);
  }
  // distant hills with ruined temples and cypress spires, white on transparent (tinted by the material)
  function hillsTex(seed, temples, base) {
    const c = canvas(2048, 256), x = c.getContext('2d'), r = mulberry(seed), ph = [r() * 6, r() * 6, r() * 6];
    const hgt = (u) => base + Math.sin(u * TAU * 2 + ph[0]) * 26 + Math.sin(u * TAU * 5 + ph[1]) * 13 + Math.sin(u * TAU * 13 + ph[2]) * 5;
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, 256); for (let i = 0; i <= 256; i++) x.lineTo(i / 256 * 2048, 256 - hgt(i / 256)); x.lineTo(2048, 256); x.closePath(); x.fill();
    for (let k = 0; k < 70; k++) { const u = r(), w = 3 + r() * 5, h = 16 + r() * 30, X = u * 2048, Y = 258 - hgt(u); x.beginPath(); x.moveTo(X - w, Y); x.quadraticCurveTo(X - w * 0.9, Y - h * 0.55, X, Y - h); x.quadraticCurveTo(X + w * 0.9, Y - h * 0.55, X + w, Y); x.fill(); }
    for (let k = 0; k < temples; k++) {
      const u = (k + 0.2 + r() * 0.5) / temples, X = u * 2048, Y = 256 - hgt(u) + 3, W2 = 50 + r() * 30, ruin = k % 2 === 1, n = 8;
      x.fillRect(X - W2, Y - 7, W2 * 2, 7);
      for (let j = 0; j < n; j++) { const h = ruin && (j === 2 || j === 5) ? 10 + r() * 10 : ruin && j === 6 ? 0 : 36; x.fillRect(X - W2 + 5 + j * (W2 * 2 - 14) / (n - 1), Y - 7 - h, 5, h); }
      if (!ruin) { x.fillRect(X - W2 - 2, Y - 50, W2 * 2 + 4, 7); x.beginPath(); x.moveTo(X - W2 - 4, Y - 50); x.lineTo(X, Y - 66); x.lineTo(X + W2 + 4, Y - 50); x.fill(); }
      else { x.fillRect(X - W2 - 2, Y - 50, W2 * 0.9, 7); x.beginPath(); x.moveTo(X - W2 - 4, Y - 50); x.lineTo(X - W2 * 0.3, Y - 60); x.lineTo(X - W2 * 0.15, Y - 50); x.fill(); }
    }
    const t = ctex(c); t.wrapS = THREE.RepeatWrapping; t.repeat.x = 2; return t;
  }

  // ---------- custom shader materials ----------
  const moonMat = () => new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(0xdce6f4) }, uHalo: { value: new THREE.Color(0x5a7090) }, uCor: { value: new THREE.Color(0xd8e8e0) }, uE: { value: 0 }, uT: { value: 0 } },
    transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uCol,uHalo,uCor; uniform float uE,uT; varying vec2 vUv;
      float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      void main(){ vec2 p=(vUv-0.5)*8.0; float d=length(p);
        float disc=1.0-smoothstep(0.975,1.0,d);
        float mar=n2(p*1.8+3.1)*0.55+n2(p*4.3+1.7)*0.3+n2(p*11.0)*0.15; float limb=sqrt(max(1.0-d*d,0.0));
        vec3 surf=uCol*(0.5+0.5*smoothstep(0.3,0.75,mar))*(0.45+0.55*limb)*mix(1.0,0.05,uE);
        float o=max(d-1.0,0.0), fade=1.0-smoothstep(2.4,4.0,d);
        vec3 halo=(uHalo*(exp(-o*2.2)*0.55+exp(-o*0.6)*0.16)+uCor*uE*exp(-o*10.0)*1.4)*(1.0-disc)*fade;
        float sx=p.x*0.22+uT*0.003, cl=n2(vec2(sx*3.0,p.y*2.2+1.3))*0.6+n2(vec2(sx*7.0,p.y*5.0))*0.4;
        float band=smoothstep(0.55,0.82,cl)*(1.0-smoothstep(0.9,3.2,abs(p.y+0.35)))*(1.0-smoothstep(2.0,3.9,abs(p.x)));
        vec3 stk=(uHalo*1.5+uCol*0.12*(1.0-uE)+uCor*uE*0.25)*(0.2+exp(-max(d-0.7,0.0)*1.2))*band;
        gl_FragColor=vec4((surf*disc+halo)*(1.0-band*0.7)+stk,clamp(disc+band*(1.0-disc)*0.8,0.0,1.0)); }`,
  });
  const mistMat = (col, a, r0, r1) => new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(col) }, uA: { value: a }, uT: { value: 0 }, uR: { value: new THREE.Vector2(r0, r1) } }, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform vec3 uCol; uniform float uA,uT; uniform vec2 uR; varying vec3 vW;
      float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      void main(){ vec2 q=vW.xz*0.07; float n=n2(q+vec2(uT*0.03,uT*0.017))*0.6+n2(q*2.3-vec2(uT*0.05,0.0))*0.4;
        float r=length(vW.xz); float a=uA*smoothstep(uR.x,uR.x+3.0,r)*(1.0-smoothstep(uR.y-12.0,uR.y,r))*smoothstep(0.42,0.82,n);
        gl_FragColor=vec4(uCol*(0.7+0.5*n),clamp(a,0.0,1.0)); }`,
  });
  // petrification frost creeping in from the arena edge (phase 3). Sits under telegraphs (renderOrder) and never writes depth.
  const frostMat = () => new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uIn: { value: R + 2 }, uT: { value: 0 } }, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uA,uIn,uT; varying vec3 vW;
      float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      void main(){ float r=length(vW.xz); vec2 tc=(vW.xz/20.4*0.5+0.5)*28.0, id=floor(tc), fp=fract(tc);
        float rc=length(((id+0.5)/28.0*2.0-1.0)*20.4), hh=h21(id*1.37+3.1), front=uIn+(n2(id*0.35)-0.5)*3.0;
        float e=min(min(fp.x,1.0-fp.x),min(fp.y,1.0-fp.y));
        float frozen=clamp(step(front,rc)+step(0.93,hh)*step(front-3.5,rc),0.0,1.0); frozen=max(frozen, step(front-0.9,rc)*smoothstep(0.35,0.65,n2(vW.xz*1.4+id*3.1)));
        float ax=step(abs(fp.y-0.5),abs(fp.x-0.5)); vec2 nb=id+vec2(sign(fp.x-0.5)*ax,sign(fp.y-0.5)*(1.0-ax)); float rn=length(((nb+0.5)/28.0*2.0-1.0)*20.4); float spill=step(front,rn)*(1.0-smoothstep(0.0,0.1,e))*(1.0-frozen);
        float joint=1.0-smoothstep(0.02,0.07,e);
        float finger=joint*step(front-1.8,rc)*step(0.45,n2(id*0.9+7.0));
        float n=n2(vW.xz*2.3)*0.6+n2(vW.xz*7.0)*0.4, vein=1.0-smoothstep(0.0,0.05,abs(n2(vW.xz*1.3+id)-0.5));
        vec3 col=vec3(0.095,0.105,0.102)*(0.85+0.3*hh+0.2*n)*(1.0-vein*0.35)*(1.0-joint*0.3)+vec3(0.015,0.14,0.12)*(joint*0.8+vein*0.25)*frozen;
        float a=uA*max(max(frozen*(0.55-joint*0.15),finger*0.4),spill*0.35)*step(r,20.4); gl_FragColor=vec4(col,clamp(a,0.0,0.95)); }`,
  });
  // mirror charge: light floods in from the rim toward the centre as the stare builds, plus a slow travelling sheen
  const chargeMat = () => new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uT: { value: 0 }, uCol: { value: new THREE.Color(VEN) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uK,uT; uniform vec3 uCol; varying vec2 vUv;
      void main(){ vec2 p=vUv*2.0-1.0; float r=length(p); if(r>1.0) discard;
        float front=1.0-uK; float band=smoothstep(front-0.12,front,r)*(1.0-smoothstep(0.96,1.0,r));
        float a=band*uK*smoothstep(0.82,1.0,0.5+0.5*sin(r*26.0-uT*7.0))*(0.25+0.75*r)*0.5;
        float sx=(p.x+p.y)*0.7-sin(uT*0.5)*1.5; float sh=exp(-sx*sx*14.0)*0.07*(1.0-r*r);
        gl_FragColor=vec4(uCol*a+vec3(1.0,0.85,0.6)*sh,1.0); }`,
  });

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x020611, horizon: 0x16303c, bottom: 0x020403, stars: 0.6, nebula: 0.25, nebulaA: 0x0a4a40, nebulaB: 0x1a2a6a, sunDir: MOON_DIR.toArray(), sunColor: 0xb0c4e8, sunSize: 0.002, sunGlow: 0.6, clouds: 0.4, cloudColor: 0x6a8090, cloudDark: 0x05090c, cloudSpeed: 0.004 });
    g.add(sky); S.sky = sky; { const U = sky.material.uniforms, gl = U.uSunGlow.value; U.uSunGlow.value = 0.12; W.env(sky, 0.7); U.uSunGlow.value = gl; }
    scene.fog = new THREE.FogExp2(0x0a1512, 0.014);
    S.hemi = W.hemi(g, 0x52707a, 0x0a0d08, 0.6);
    S.moon = W.sun(g, { dir: [-0.42, 0.62, -0.66], color: 0xb4ccff, intensity: 2.6, size: 30 });
    // the moon itself: big and low behind the colonnade; it reddens in phase 2 and is eclipsed in phase 3
    S.moonM = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), moonMat()); S.moonM.scale.setScalar(980); S.moonM.renderOrder = -90; S.moonM.frustumCulled = false;
    S.moonM.onBeforeRender = () => { S.moonM.position.copy(camera.position).addScaledVector(MOON_DIR, 1500); S.moonM.quaternion.copy(camera.quaternion); S.moonM.updateMatrixWorld(); };
    g.add(S.moonM);
    { const c = canvas(1024, 256), x = c.getContext('2d'), r = mulberry(17); x.fillStyle = '#fff';
      const mu = ((Math.atan2(MOON_DIR.x, MOON_DIR.z) / TAU) + 1) % 1; x.shadowBlur = 10; x.shadowColor = '#fff';
      for (let k = 0; k < 13; k++) { const X0 = r() * 1024, Y = 95 + Math.pow(r(), 0.8) * 110, L = 120 + r() * 380, th = 1.5 + r() * 6, du = Math.min(Math.abs(X0 / 1024 - mu), 1 - Math.abs(X0 / 1024 - mu)), lit = 0.25 + 0.75 * Math.exp(-(du / 0.1) * (du / 0.1));
        for (let q = 0; q < 18; q++) { const f = q / 17, X = X0 + (f - 0.5) * L, wsp = Math.sin(PI * f); if (r() < 0.2) continue; x.globalAlpha = (0.08 + r() * 0.22) * wsp * lit; for (const o of [-1024, 0, 1024]) { x.beginPath(); x.ellipse(X + o, Y + Math.sin(f * 5 + k) * 3, L / 14 + r() * 20, th * (0.4 + wsp * 0.8), 0, 0, TAU); x.fill(); } } }
      const t = ctex(c); t.wrapS = THREE.RepeatWrapping;
      const cm = new THREE.Mesh(new THREE.CylinderGeometry(700, 700, 200, 64, 1, true), new THREE.MeshBasicMaterial({ map: t, color: 0x4a5a6c, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide }));
      cm.position.y = 90; cm.renderOrder = -85; g.add(cm); S.cloudM = cm.material; }
    // two hazy layers of hills and ruined temples
    S.hills = [];
    for (const [rad, h, col, op, seed, tp, base] of [[900, 170, 0x1c2c34, 0.85, 3, 3, 80], [520, 90, 0x0c171a, 1, 7, 2, 62]]) {
      const hm = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 64, 1, true), new THREE.MeshBasicMaterial({ map: hillsTex(seed, tp, base), color: col, transparent: true, opacity: op, depthWrite: false, fog: false, side: THREE.BackSide }));
      hm.position.y = h / 2 - 12; hm.renderOrder = -80; g.add(hm); S.hills.push(hm.material);
    }
    // terrace
    const fl = W.surface('slabs', { n: 4, dark: 0x343834, light: 0xa2a79c, strength: 2.4, seed: 5 }); for (const k in fl) fl[k].repeat.set(7, 7);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 2.4, 72), new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, roughnessMap: fl.roughnessMap, roughness: 0.7, metalness: 0.05, envMapIntensity: 1.2 }));
    floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
    S.mosU = { crk: { value: new THREE.Color(0, 0, 0) }, eye: { value: new THREE.Color(0, 0, 0) } };
    const mosM = new THREE.MeshStandardMaterial({ map: mosaicTex(), emissiveMap: mosaicGlow(), emissive: 0xffffff, roughness: 0.55, metalness: 0.05, envMapIntensity: 1.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    mosM.onBeforeCompile = (sh) => { sh.uniforms.uCrk = S.mosU.crk; sh.uniforms.uEye = S.mosU.eye; sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uCrk; uniform vec3 uEye;\nvoid main() {').replace('#include <emissivemap_fragment>', '#ifdef USE_EMISSIVEMAP\n{ vec4 emT = texture2D( emissiveMap, vEmissiveMapUv ); totalEmissiveRadiance = uCrk * emT.r + uEye * emT.g; }\n#endif'); };
    mosM.customProgramCacheKey = () => 'gorMosaic';
    const mos = new THREE.Mesh(new THREE.CircleGeometry(7.5, 64), mosM); mos.rotation.x = -PI / 2; mos.position.y = 0.012; mos.receiveShadow = true; g.add(mos);
    const band = new THREE.Mesh(new THREE.RingGeometry(R - 0.5, R + 0.1, 96), W.mat({ color: 0x1c2a24, roughness: 0.85, metalness: 0.1 })); band.rotation.x = -PI / 2; band.position.y = 0.015; g.add(band);
    S.frost = new THREE.Mesh(new THREE.RingGeometry(R - 4, R + 2.4, 96, 6), frostMat()); S.frost.rotation.x = -PI / 2; S.frost.position.y = 0.02; S.frost.renderOrder = 2; g.add(S.frost);
    // weathered stone shared by statues, wall and plinths: grey with moss in the creases
    const lich = W.bake(256, (u, v) => { const n = W.fbm(u * 8, v * 8, 13, 5, 8), c = W.cell(u * 6, v * 6, 13, 6), crack = smooth(sat(c[1] * 9)), moss = smooth(sat((W.fbm(u * 4, v * 4, 31, 4, 4) - 0.5) * 4)); return [n * 0.5 + crack * 0.5 - moss * 0.1, (n * 0.55 + crack * 0.45) * (1 - moss * 0.7), 0.95 - n * 0.2]; }, { dark: 0x1e2a1a, light: 0xb0b4a8, strength: 3 });
    const lichCrk = crackMask(13, false); S.envRim = { value: new THREE.Color(0x203040) }; S.crowdRim = { value: new THREE.Color(0x2a4050) };
    S.stoneMat = withRim(new THREE.MeshStandardMaterial({ map: lich.map, normalMap: lich.normalMap, roughnessMap: lich.roughnessMap, roughness: 1, emissiveMap: lichCrk, emissive: 0x2a9c96, emissiveIntensity: 0 }), S.envRim, 2.4);
    const crowdMat = withRim(new THREE.MeshStandardMaterial({ map: lich.map, normalMap: lich.normalMap, roughness: 1, color: 0xb4b8ac, emissiveMap: lichCrk, emissive: 0x2a9c96, emissiveIntensity: 0 }), S.crowdRim, 2.0); S.crowdMat = crowdMat;
    // outer path, low garden wall and the terraces of the garden beyond (the gaze cone lies on stone, never over a void)
    const rk = W.surface('rock', { size: 256, dark: 0x16181a, light: 0x52564e, seed: 4 }); for (const k in rk) rk[k].repeat.set(16, 16);
    const path = new THREE.Mesh(new THREE.RingGeometry(R + 2.4, 24.8, 96, 2), new THREE.MeshStandardMaterial({ map: rk.map, normalMap: rk.normalMap, roughness: 0.95 })); path.rotation.x = -PI / 2; path.position.y = -0.02; path.receiveShadow = true; g.add(path);
    const curb = new THREE.Mesh(new THREE.TorusGeometry(R + 2.42, 0.13, 6, 120), W.mat({ color: 0x4a524e, roughness: 1 })); curb.rotation.x = PI / 2; curb.scale.z = 0.6; g.add(curb);
    const wt = lich.map.clone(); wt.needsUpdate = true; wt.repeat.set(60, 1.2); const wn = lich.normalMap.clone(); wn.needsUpdate = true; wn.repeat.copy(wt.repeat);
    const wallM = withRim(new THREE.MeshStandardMaterial({ map: wt, normalMap: wn, roughness: 0.95, color: 0x9a9e94, side: THREE.DoubleSide }), S.envRim, 2.4);
    const rt = lich.map.clone(); rt.needsUpdate = true; rt.repeat.set(90, 0.5); const riserM = new THREE.MeshStandardMaterial({ map: rt, roughness: 1, color: 0x56664a, side: THREE.DoubleSide });
    const tt = {}; for (const k of ['map', 'normalMap']) { tt[k] = fl[k].clone(); tt[k].needsUpdate = true; tt[k].repeat.set(46, 46); }
    const terM = new THREE.MeshStandardMaterial({ map: tt.map, normalMap: tt.normalMap, roughness: 0.95, color: 0x5a6058 });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(24.8, 24.8, 1.3, 120, 1, true), wallM); wall.position.y = 0.5; wall.receiveShadow = true; g.add(wall);
    const cope = new THREE.Mesh(new THREE.RingGeometry(24.65, 25.35, 120), W.mat({ color: 0x5c6058, roughness: 0.9 })); cope.rotation.x = -PI / 2; cope.position.y = 1.15; g.add(cope);
    const earth = W.mat({ color: 0x0b140e, roughness: 1 }), TR = (k) => 25.35 + k * 9, TY = (k) => 0.3 + k * 0.5;
    for (let k = 0; k < 6; k++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(TR(k), TR(k + 1), 96), k < 4 ? terM : earth); ring.rotation.x = -PI / 2; ring.position.y = TY(k); g.add(ring);
      const ris = new THREE.Mesh(new THREE.CylinderGeometry(TR(k + 1), TR(k + 1), 0.5, 96, 1, true), riserM); ris.position.y = TY(k) + 0.25; g.add(ris);
    }
    const ground = new THREE.Mesh(new THREE.RingGeometry(TR(6), 1300, 48), earth); ground.rotation.x = -PI / 2; ground.position.y = TY(6); g.add(ground);
    // colonnade: some standing, most broken, a few strangled by vines
    const st = W.surface('stone', { size: 256, dark: 0x4c504a, light: 0xc4c8bc, seed: 9 }); for (const k in st) st[k].repeat.set(2, 4);
    const stCrk = crackMask(9, true); stCrk.repeat.set(2, 1);
    S.marble = withRim(new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: 0.75, envMapIntensity: 1.1, color: 0xdfe6e0, emissiveMap: stCrk, emissive: 0x2a9c96, emissiveIntensity: 0 }), S.envRim, 2.4);
    const dt0 = {}; for (const k of ['map', 'normalMap']) { dt0[k] = st[k].clone(); dt0[k].needsUpdate = true; dt0[k].repeat.set(2, 1); }
    const drumM = withRim(new THREE.MeshStandardMaterial({ map: dt0.map, normalMap: dt0.normalMap, roughness: 0.85, color: 0x98a0a6 }), S.envRim, 2.4);
    const capC = canvas(128, 128), cx = capC.getContext('2d'), cq = mulberry(5); cx.fillStyle = '#7c8286'; cx.fillRect(0, 0, 128, 128); cx.fillStyle = '#a2a8aa'; cx.beginPath(); for (let k = 0; k <= 24; k++) { const an = k / 24 * TAU, rr = 50 + cq() * 12; cx.lineTo(64 + Math.cos(an) * rr, 64 + Math.sin(an) * rr); } cx.fill();
    for (let k = 0; k < 40; k++) { cx.fillStyle = cq() < 0.5 ? 'rgba(40,44,46,0.35)' : 'rgba(200,204,200,0.25)'; cx.beginPath(); cx.arc(cq() * 128, cq() * 128, 1 + cq() * 4, 0, TAU); cx.fill(); } cx.fillStyle = '#1c1e1e'; cx.fillRect(56, 56, 16, 16);
    const capM = withRim(new THREE.MeshStandardMaterial({ map: ctex(capC), roughness: 0.95, color: 0xb0b6ba }), S.envRim, 2.4), drumMs = [drumM, capM, capM];
    const flute = (r0, r1, h, n, dep = 0.06) => { const q = new THREE.CylinderGeometry(r0, r1, h, n * 4, 1), P = q.attributes.position, N = q.attributes.normal; for (let i = 0; i < P.count; i++) { if (Math.abs(N.getY(i)) > 0.5) continue; const x = P.getX(i), z = P.getZ(i), an = Math.atan2(x, z), k = 1 - dep * Math.pow(Math.max(0, Math.cos(an * n)), 0.5); P.setX(i, x * k); P.setZ(i, z * k); } q.computeVertexNormals(); return q; };
    const scaleUV = (q, k) => { const U = q.attributes.uv; for (let i = 0; i < U.count; i++) U.setY(i, U.getY(i) * k); return q; };
    const jag = (q, h, rr) => { const P = q.attributes.position; for (let i = 0; i < P.count; i++) if (P.getY(i) > h / 2 - 1e-3) { const an = Math.atan2(P.getX(i), P.getZ(i)); P.setY(i, P.getY(i) - (0.15 + 0.5 * Math.abs(Math.sin(an * 2.3 + rr * 9)) * (0.6 + 0.4 * Math.sin(an * 7 + rr * 3)))); } q.computeVertexNormals(); return q; };
    const moulding = new THREE.TorusGeometry(0.93, 0.13, 6, 28); moulding.rotateX(PI / 2);
    const marble = S.marble;
    const cr = mulberry(77); let prevTall = false; const tallList = [];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + 0.1, x = Math.sin(a) * 20.6, z = Math.cos(a) * 20.6, tall = cr() < 0.45, h = tall ? 10 : 2 + cr() * 5;
      const col = new THREE.Mesh(tall ? flute(0.78, 0.9, h, 12) : jag(scaleUV(flute(0.8, 0.9, h, 12), h / 10), h, i * 0.37), marble); col.position.set(x, h / 2 - 0.2, z); col.castShadow = true; g.add(col);
      const mo = new THREE.Mesh(moulding, marble); mo.position.set(x, 0.42, z); g.add(mo);
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 2.3), marble); base.position.set(x, 0.1, z); base.rotation.y = a; g.add(base);
      if (tall) { tallList.push([x, z, h]); const cap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 2.3), marble); cap.position.set(x, h + 0.05, z); cap.rotation.y = a; g.add(cap);
        if (prevTall) { const a0 = (i - 0.5) / 16 * TAU + 0.1; const lin = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.1, 1.9), marble); lin.position.set(Math.sin(a0) * 20.4, h + 0.9, Math.cos(a0) * 20.4); lin.rotation.y = a0; g.add(lin); } }
      else { cr(); cr();
        for (let q = 0; q < 2; q++) { const aa = a + 0.06 + q * 0.12 * (cr() < 0.5 ? -1 : 1), rr2 = 22.4 + cr() * 1.6, dh = 1.2 + cr() * 0.9; if ([0.94, 2.83, 4.08, 5.97].some((fa) => Math.abs(angDiff(fa, aa)) < 0.3)) { cr(); continue; } const drum = new THREE.Mesh(flute(0.8, 0.8, dh, 12, 0.03), drumMs); drum.position.set(Math.sin(aa) * rr2, 0.78, Math.cos(aa) * rr2); drum.rotation.set(PI / 2, cr() * 3, 0); drum.rotation.order = 'YXZ'; drum.castShadow = true; g.add(drum); } }
      prevTall = tall;
    }
    { const vineM = W.mat({ color: 0x1a3418, roughness: 0.9 }), leafM = W.mat({ color: 0x2e5426, roughness: 0.8, side: THREE.DoubleSide }), vr0 = mulberry(55), leaves = [];
      for (const [x, z, h] of tallList.filter((_, k) => k % 2 === 0)) {
        const pts = [], ph = vr0() * TAU, turns = 2 + vr0() * 1.5, top = h * (0.55 + vr0() * 0.35);
        for (let k = 0; k <= 40; k++) { const f = k / 40, an = ph + f * turns * TAU, rr = 0.86 + Math.sin(f * 30) * 0.03; pts.push(new V3(x + Math.sin(an) * rr, f * top, z + Math.cos(an) * rr)); if (k % 2) leaves.push([pts[k], an]); }
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.05, 4), vineM));
      }
      const lm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.18), leafM, leaves.length * 2);
      leaves.forEach(([p, an], k) => { for (let s2 = 0; s2 < 2; s2++) { _m.position.set(p.x + Math.sin(an) * 0.08, p.y + (vr0() - 0.5) * 0.3, p.z + Math.cos(an) * 0.08); _m.rotation.set(vr0() * 3, an + (vr0() - 0.5) * 1.5, vr0() * 3); _m.scale.setScalar(0.7 + vr0() * 0.6); _m.updateMatrix(); lm.setMatrixAt(k * 2 + s2, _m.matrix); } });
      g.add(lm); }
    // the petrified: one geometry per pose, shared by the plinth statues, the awakened and (low-poly) the garden crowd
    S.figGeo = POSES.map((P) => figureGeo(P, false, false));
    const crowdGeo = [figureGeo(POSES[0], false, true), figureGeo(POSES[1], false, true), figureGeo(POSES[2], false, true), figureGeo(POSES[0], true, true)];
    S.ped = []; const pedM = S.stoneMat;
    for (let i = 0; i < NPED; i++) {
      const a = i / NPED * TAU + 0.31, x = Math.sin(a) * PED_R, z = Math.cos(a) * PED_R;
      const pd = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), marble); pd.position.set(x, 0.25, z); pd.rotation.y = a; pd.castShadow = true; pd.receiveShadow = true; g.add(pd);
      const pd2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 1.8), pedM); pd2.position.set(x, 0.07, z); pd2.rotation.set((cr() - 0.5) * 0.04, a + 0.2, (cr() - 0.5) * 0.04); g.add(pd2);
      const sm = new THREE.Group(), body = new THREE.Mesh(S.figGeo[i % 3], pedM); body.castShadow = true; sm.add(body); sm.position.set(x, 0.5, z); sm.rotation.y = a + PI + (cr() - 0.5); g.add(sm);
      S.ped.push({ a, x, z, mesh: sm, has: true, regrow: 0 });
    }
    S.pool = []; for (let k = 0; k < 6; k++) S.pool.push(awakeMesh(S, k));
    // the garden of victims, terraced away into the dark: mixed poses, some broken, some toppled, with rubble between them
    const NV = 210, vr = mulberry(1234), per = [0, 0, 0, 0], plan = [];
    for (let i = 0; i < NV; i++) { const a = vr() * TAU, rr = 26.2 + Math.pow(vr(), 1.7) * 48, v = Math.floor(vr() * 4); plan.push([a, rr, v, vr() < 0.18]); per[v]++; }
    const crowd = crowdGeo.map((geo, v) => { const im = new THREE.InstancedMesh(geo, crowdMat, Math.max(1, per[v])); im.count = 0; g.add(im); return im; });
    const eyeArr = [];
    for (const [a, rr, v, topple] of plan) {
      const k = Math.min(5, Math.floor((rr - TR(0)) / 9)), y = TY(Math.max(0, k)), im = crowd[v], sc = 1.1 + vr() * 0.4;
      _m.position.set(Math.sin(a) * rr, y + (topple ? 0.3 * sc : 0), Math.cos(a) * rr); _m.rotation.set(topple ? 0 : (vr() - 0.5) * 0.2, a + PI + (vr() - 0.5) * 1.6, topple ? (vr() < 0.5 ? 1.45 : -1.45) : (vr() - 0.5) * 0.2); _m.rotation.order = 'YXZ'; _m.scale.setScalar(sc); _m.updateMatrix();
      im.setMatrixAt(im.count++, _m.matrix); _m.rotation.order = 'XYZ';
      if (v < 3 && !topple) { const hd = POSES[v].head; _v.set(hd[0], hd[1], hd[2] + 0.17).applyMatrix4(_m.matrix); eyeArr.push(_v.x, _v.y, _v.z); }
    }
    for (const im of crowd) im.instanceMatrix.needsUpdate = true;
    const rub = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), crowdMat, 150);
    for (let i = 0; i < 150; i++) { const a = vr() * TAU, rr = i < 30 ? 21.6 + vr() * 2.8 : i < 90 ? TR(1 + Math.floor(vr() * 4)) - 0.3 - vr() * 0.8 : 26 + vr() * 45, k = Math.min(5, Math.floor((rr - TR(0)) / 9)), y = rr < 25 ? 0 : TY(Math.max(0, k)); _m.position.set(Math.sin(a) * rr, y + 0.1, Math.cos(a) * rr); _m.rotation.set(vr() * 3, vr() * 3, vr() * 3); _m.scale.set(0.4 + vr() * 0.8, 0.25 + vr() * 0.4, 0.4 + vr() * 0.8); _m.updateMatrix(); rub.setMatrixAt(i, _m.matrix); }
    rub.castShadow = true; g.add(rub);
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(eyeArr), 3));
    S.eyesFar = new THREE.Points(eg, new THREE.PointsMaterial({ color: new THREE.Color(VEN).multiplyScalar(2.2), size: 0.9, map: flareTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); S.eyesFar.frustumCulled = false; g.add(S.eyesFar);
    // cypresses: layered flame-shaped silhouettes with a faint cold rim from the moon
    S.cypRim = { value: new THREE.Color(0x24384a) };
    const cyGeo = new THREE.LatheGeometry([[0, 0], [0.55, 0.4], [1.05, 1.6], [1.2, 3.4], [1.05, 6], [0.7, 8.8], [0.3, 11.2], [0, 12.8]].map((p) => new THREE.Vector2(p[0], p[1])), 9);
    const NC = 52, cyp = new THREE.InstancedMesh(cyGeo, withRim(W.mat({ color: 0x0e2216, roughness: 0.95 }), S.cypRim, 3), NC);
    for (let i = 0; i < NC; i++) { const a = vr() * TAU, rr = 28 + vr() * 60, k = Math.min(5, Math.floor((rr - TR(0)) / 9)); _m.position.set(Math.sin(a) * rr, TY(k) - 0.2, Math.cos(a) * rr); _m.rotation.set((vr() - 0.5) * 0.06, vr() * 6, 0); _m.scale.set(0.7 + vr() * 0.6, 0.75 + vr() * 0.8, 0.7 + vr() * 0.6); _m.updateMatrix(); cyp.setMatrixAt(i, _m.matrix); cyp.setColorAt(i, _c.setHSL(0.36 + vr() * 0.06, 0.4, 0.5 + vr() * 0.5)); }
    g.add(cyp);
    // ground mist between the pillars and over the garden, kept outside the fighting ring
    S.mist = [mistMat(0x8aa0a8, 0.4, R + 1.5, 36), mistMat(0x8aa0a8, 0.6, 26, 95)];
    { const m1 = new THREE.Mesh(new THREE.RingGeometry(R + 1.5, 36, 64, 2), S.mist[0]); m1.rotation.x = -PI / 2; m1.position.y = 0.55; m1.renderOrder = 3; g.add(m1);
      for (const [r0, r1, y] of [[26, 52, 1.9], [52, 95, 3.7]]) { const m2 = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 64, 2), S.mist[1]); m2.rotation.x = -PI / 2; m2.position.y = y; m2.renderOrder = 3; g.add(m2); } }
    // braziers
    S.fires = [];
    const bronze = W.mat({ color: 0x5a4020, metalness: 0.85, roughness: 0.4 });
    for (const a of [0.94, 2.83, 4.08, 5.97]) {
      const x = Math.sin(a) * 19.2, z = Math.cos(a) * 19.2;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.35, 0.6, 12), bronze); bowl.position.set(x, 1.6, z); g.add(bowl);
      const lip2 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 6, 20), bronze); lip2.position.set(x, 1.9, z); lip2.rotation.x = PI / 2; g.add(lip2);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 1.4, 8), bronze); leg.position.set(x, 0.7, z); g.add(leg);
      const fm = W.glow(0xffa040, 2.2); const fl2 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), fm); fl2.position.set(x, 2.0, z); g.add(fl2); S.fires.push({ x, z, m: fl2, mat: fm });
    }
    S.fireL = [new THREE.PointLight(0xff9a40, 45, 9, 2), new THREE.PointLight(0xff9a40, 45, 9, 2)];
    S.fireL[0].position.set(Math.sin(0.94) * 18.5, 3, Math.cos(0.94) * 18.5); S.fireL[1].position.set(Math.sin(4.08) * 18.5, 3, Math.cos(4.08) * 18.5); g.add(S.fireL[0]); g.add(S.fireL[1]);
    S.motes = W.motes({ n: 300, box: [56, 9, 56], color: 0xb8c8d0, size: 0.075, vel: [0.04, 0.03, 0.02], sway: 1.4, center: [0, 4.5, 0], mult: 0.9 }); g.add(S.motes);
    S.dust = W.motes({ n: 110, box: [50, 10, 50], color: 0xd8e4dc, size: 0.2, vel: [0.05, -0.02, 0.03], sway: 2.5, center: [0, 4, 0], mult: 0.55, alpha: 0 }); g.add(S.dust);
    // mirrors: domed bronze shields embossed with her own face, which carry her stare
    S.mir = [];
    const relief = W.bake(256, (u, v) => { const x = u * 2 - 1, y = v * 2 - 1, r = Math.hypot(x, y), a = Math.atan2(y, x);
      const face = r < 0.34 ? Math.sqrt(Math.max(0, 1 - (r / 0.34) * (r / 0.34))) : 0, eyes = Math.max(0, 1 - Math.hypot(Math.abs(x) - 0.12, y + 0.08) / 0.06);
      const snake = r > 0.3 && r < 0.8 ? Math.pow(Math.max(0, Math.cos(a * 9 + Math.sin(r * 16) * 1.4)), 5) * Math.sin((r - 0.3) / 0.5 * PI) : 0;
      const ring = Math.max(0, 1 - Math.abs(r - 0.9) / 0.05) * (0.6 + 0.4 * Math.max(0, Math.cos(a * 36))), h = Math.min(1, face * 0.8 - eyes * 0.4 + snake * 0.6 + ring * 0.7);
      return [h, 0.3 + Math.max(0, h) * 0.6 + W.fbm(u * 10, v * 10, 7, 3) * 0.15, 0.2 + (1 - Math.max(0, h)) * 0.35]; }, { dark: 0x3a2812, light: 0xe8c078, strength: 5 });
    const eyeT = eyeTex(), shellGeo = new THREE.LatheGeometry([[0.01, -0.3], [1.0, -0.22], [1.6, -0.06], [1.8, 0.04], [1.76, 0.13], [1.62, 0.09]].map((p) => new THREE.Vector2(p[0], p[1])), 48); shellGeo.rotateX(PI / 2);
    S.mirRim = { value: new THREE.Color(0x4a3010) };
    for (let k = 0; k < 2; k++) {
      const mg = new THREE.Group(); mg.visible = false;
      const face = new THREE.Mesh(new THREE.CircleGeometry(1.62, 48), withRim(new THREE.MeshStandardMaterial({ map: relief.map, normalMap: relief.normalMap, roughnessMap: relief.roughnessMap, color: 0xffffff, metalness: 0.7, roughness: 1, envMapIntensity: 2.6 }), S.mirRim, 2.2)); face.position.z = 0.07; face.userData.fadeOcclude = true; face.userData.fadeMin = 0.3; mg.add(face);
      const shell = new THREE.Mesh(shellGeo, withRim(W.mat({ color: 0x7a5426, metalness: 0.85, roughness: 0.35, envMapIntensity: 2 }), S.mirRim, 2.2)); shell.userData.fadeOcclude = true; shell.userData.fadeMin = 0.3; mg.add(shell);
      const chg = new THREE.Mesh(new THREE.CircleGeometry(1.64, 48), chargeMat()); chg.position.z = 0.1; chg.renderOrder = 12; mg.add(chg);
      const em = new THREE.MeshBasicMaterial({ map: eyeT, transparent: true, depthWrite: false, color: new THREE.Color(1, 1, 1).multiplyScalar(0.4) });
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.17), em); e.position.set(sx * 0.19, 0.13, 0.13); e.rotation.z = -sx * 0.12; e.renderOrder = 13; mg.add(e); }
      const fl3 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: flareTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false })); fl3.position.set(0, 0.13, 0.3); mg.add(fl3);
      g.add(mg); S.mir.push({ g: mg, a: 0, on: false, eyes: em, flare: fl3, chg: chg.material.uniforms, y: 5.2 });
    }

    // ---- Euryale ----
    const bg = b.group;
    S.rim = { value: new THREE.Color(0x6a4a22) };
    const scB = W.bake(256, (u, v) => { const c = W.cell(u * 8, v * 8, 3, 8), h = 1 - sat(c[0] * 1.45); return [h, 0.22 + h * 0.78, 0.25 + (1 - h) * 0.45]; }, { dark: 0x1a1a1a, light: 0xffffff, strength: 4 });
    const scales = withRim(new THREE.MeshStandardMaterial({ map: scB.map, normalMap: scB.normalMap, roughnessMap: scB.roughnessMap, vertexColors: true, roughness: 1, metalness: 0.35, envMapIntensity: 1.6, emissive: 0x05140c, emissiveIntensity: 1 }), S.rim, 2.4);
    const scB2 = {}; for (const k in scB) { scB2[k] = scB[k].clone(); scB2[k].needsUpdate = true; scB2[k].repeat.set(3, 3); }
    const scalesB = withRim(new THREE.MeshStandardMaterial({ map: scB2.map, normalMap: scB2.normalMap, roughnessMap: scB2.roughnessMap, color: 0x3a9a68, roughness: 1, metalness: 0.35, envMapIntensity: 1.6, emissive: 0x05140c, emissiveIntensity: 1 }), S.rim, 2.4);
    const sk = W.bake(256, (u, v) => { const n = W.fbm(u * 6, v * 6, 21, 5, 6), p = W.fbm(u * 18, v * 18, 23, 3, 18), c = W.cell(u * 20, v * 20, 27, 20), sc = smooth(sat(c[1] * 5)), pat = smooth(sat((n - 0.5) * 2.4)); return [sc * 0.1 + p * 0.2, 0.22 + (1 - pat) * 0.58 + p * 0.12 + sc * 0.04, 0.4 + pat * 0.35]; }, { dark: 0x2e5446, light: 0xb4c4ac, strength: 1.6 });
    for (const k in sk) sk[k].repeat.set(2, 2);
    S.skinRim = { value: new THREE.Color(0x5a7a90) }; S.fill = { value: new THREE.Color(0.3, 0.36, 0.4) };
    const skin = new THREE.MeshStandardMaterial({ map: sk.map, normalMap: sk.normalMap, roughnessMap: sk.roughnessMap, roughness: 1, metalness: 0.05, envMapIntensity: 0.9 });
    // soft fill from below-front (in view space, so her face always reads) plus a cool rim
    skin.onBeforeCompile = (sh) => { sh.uniforms.uRim = S.skinRim; sh.uniforms.uFill = S.fill; sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim; uniform vec3 uFill;\nvoid main() {').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRim * pow(max(fr, 0.0), 2.2); float fl = clamp(dot(normal, vec3(0.0, -0.33, 0.944)), 0.0, 1.0); totalEmissiveRadiance += uFill * diffuseColor.rgb * (0.2 + 0.8 * fl * fl); }'); }; skin.customProgramCacheKey = () => 'gorSkin';
    const gold = withRim(W.mat({ color: 0xa87a32, roughness: 0.52, metalness: 1, envMapIntensity: 1.4 }), S.rim, 2.6), dark = W.mat({ color: 0x0a0806, roughness: 0.6 });
    const claw = W.mat({ color: 0x241a0c, roughness: 0.3, metalness: 0.8 }), ivory = W.mat({ color: 0xe6dcc0, roughness: 0.4 });
    // serpent body: one continuous tube, emerald back, pale gold belly plates, rebuilt from the spine every frame
    { const NL = 58, NR = 12, n = NL * (NR + 1), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), idx = [];
      const back = new THREE.Color(0x2a7a50), belly = new THREE.Color(0xd8b060), stripe = new THREE.Color(0x0c2c1c);
      for (let i = 0; i < NL; i++) for (let j = 0; j <= NR; j++) {
        const k = i * (NR + 1) + j, th = j / NR * TAU, sn = Math.sin(th), bf = smooth(sat((-sn - 0.25) / 0.45)), dk = smooth(sat((sn - 0.55) / 0.35)) * (0.55 + 0.45 * Math.sin(i * 0.9));
        uv[k * 2] = i / (NL - 1) * 15; uv[k * 2 + 1] = j / NR * 3;
        _c.copy(back).lerp(stripe, dk).lerp(belly, bf).multiplyScalar(bf > 0.5 ? (i % 2 ? 0.82 : 1.0) : 1); col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b;
        if (i < NL - 1 && j < NR) { const a0 = k, b0 = k + NR + 1; idx.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
      geo.attributes.position.setUsage(THREE.DynamicDrawUsage); geo.attributes.normal.setUsage(THREE.DynamicDrawUsage);
      S.tail = new THREE.Mesh(geo, scales); S.tail.castShadow = true; S.tail.frustumCulled = false; bg.add(S.tail);
      geo.boundingSphere = new THREE.Sphere(new V3(0, 2.3, -0.9), 2.4); S.tail.userData.fadeOcclude = true; S.tail.userData.fadeMin = 0.2;
      S.tailT = { NL, NR, geo, pos, nor, P: Array.from({ length: NL }, () => new V3()), R: new Float32Array(NL) };
    }
    S.up = new THREE.Group(); bg.add(S.up);
    const addU = (geo, mat, x, y, z, par = S.up) => { const q = new THREE.Mesh(geo, mat); q.position.set(x, y, z); q.castShadow = true; par.add(q); return q; };
    const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);
    // torso: broad shoulders, narrow waist; scales climb from the coil up over the hips and ribs
    S.torso = addU(lathe([[0.02, 2.5], [0.56, 2.56], [0.52, 3.05], [0.54, 3.35], [0.66, 3.8], [0.78, 4.15], [0.84, 4.34], [0.76, 4.5], [0.55, 4.66], [0.32, 4.8], [0.2, 4.92], [0.18, 5.25], [0.02, 5.3]]), skin, 0, 0, 0); S.torso.scale.set(1.12, 1, 0.74); S.torso.userData.fadeOcclude = true; S.torso.userData.fadeMin = 0.15;
    { const sl = addU(lathe([[0.58, 2.4], [0.57, 2.6], [0.55, 3.0], [0.54, 3.3], [0.555, 3.45], [0.52, 3.52]]), scalesB, 0, 0, 0); sl.scale.set(1.12, 1, 0.76); sl.userData.fadeOcclude = true; sl.userData.fadeMin = 0.15; sl.geometry.computeBoundingSphere(); sl.geometry.boundingSphere.radius *= 1.6; }
    { const sp = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), scalesB, 46), rr = mulberry(91), prof = (y) => y < 3.35 ? 0.55 : y < 3.8 ? lerp(0.54, 0.66, (y - 3.35) / 0.45) : 0.7;
      for (let i = 0; i < 46; i++) { const y = 3.35 + Math.pow(rr(), 1.6) * 0.75, ph = (rr() - 0.5) * TAU, r0 = prof(y) + 0.02; _m.position.set(Math.sin(ph) * r0 * 1.12, y, Math.cos(ph) * r0 * 0.74); _m.lookAt(_m.position.x * 2, y, _m.position.z * 2); _m.scale.set(0.09 - (y - 3.35) * 0.05, 0.065, 0.025); _m.updateMatrix(); sp.setMatrixAt(i, _m.matrix); }
      sp.castShadow = true; S.up.add(sp); }
    addU(new THREE.TorusGeometry(0.58, 0.055, 6, 32), gold, 0, 2.62, 0).scale.set(1.12, 0.76, 1); S.up.children[S.up.children.length - 1].rotation.x = PI / 2;
    const collar = addU(lathe([[0.22, 4.97], [0.38, 4.9], [0.56, 4.76], [0.64, 4.68], [0.58, 4.66], [0.38, 4.8], [0.22, 4.88]], 28), gold, 0, 0, 0); collar.scale.set(1.12, 1, 0.8); collar.userData.fadeOcclude = true; collar.userData.fadeMin = 0.12; collar.geometry.boundingSphere = new THREE.Sphere(new V3(0, 3.8, 0), 1.9);
    for (const sx of [-1, 1]) { const cup = addU(new THREE.SphereGeometry(0.22, 14, 10, 0, TAU, 0, PI * 0.5), gold, sx * 0.29, 4.02, 0.4); cup.rotation.x = PI / 2 - 0.15; cup.scale.set(1, 1, 0.25); }
    addU(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16), gold, 0, 3.86, 0.52).rotation.x = PI / 2 - 0.1;
    S.gemMat = W.glow(VEN, 0.9); addU(new THREE.SphereGeometry(0.07, 8, 6), S.gemMat, 0, 3.86, 0.56);
    // deltoids blend the shoulder into the torso
    for (const sx of [-1, 1]) { const d2 = addU(new THREE.SphereGeometry(0.42, 14, 10), skin, sx * 0.8, 4.3, 0); d2.scale.set(0.82, 0.62, 0.74); d2.rotation.z = sx * 0.5; }
    // hood: own darker material (the backdrop to the pale face), fades when it blocks the view of the player
    const hoodM = scalesB.clone(); hoodM.color.setHex(0x1a4a32); withRim(hoodM, S.rim, 2.4);
    const hood = addU(new THREE.SphereGeometry(1, 22, 16), hoodM, 0, 4.95, -0.55); hood.scale.set(1.4, 1.65, 0.2); hood.rotation.x = 0.12; hood.userData.fadeOcclude = true; hood.userData.fadeMin = 0.12;
    { const hc = canvas(256, 256), hx = hc.getContext('2d'); hx.fillStyle = '#0a1c12'; hx.fillRect(0, 0, 256, 256);
      for (let j = 0; j < 15; j++) for (let i = -1; i < 13; i++) { const X = i * 22 + (j % 2) * 11, Y = j * 18; hx.fillStyle = (i + j) % 3 ? '#15361f' : '#1a3f26'; hx.beginPath(); hx.moveTo(X, Y - 10); hx.lineTo(X + 10, Y); hx.lineTo(X, Y + 10); hx.lineTo(X - 10, Y); hx.closePath(); hx.fill(); hx.strokeStyle = '#04100a'; hx.lineWidth = 2; hx.stroke(); hx.strokeStyle = '#2c5a3a'; hx.lineWidth = 1.5; hx.beginPath(); hx.moveTo(X, Y - 7); hx.lineTo(X, Y + 7); hx.stroke(); }
      hx.strokeStyle = '#7a5a24'; hx.lineWidth = 8; for (const cx2 of [104, 152]) { hx.beginPath(); hx.arc(cx2, 84, 20, 0, TAU); hx.stroke(); } hx.beginPath(); hx.arc(128, 96, 40, 0.15 * PI, 0.85 * PI); hx.stroke(); hx.fillStyle = '#05120a'; for (const cx2 of [104, 152]) { hx.beginPath(); hx.arc(cx2, 84, 8, 0, TAU); hx.fill(); }
      hx.fillStyle = '#06140c'; hx.fillRect(122, 0, 12, 256); hx.fillStyle = '#356a46'; hx.fillRect(127, 0, 2, 256);
      const hbT = ctex(hc), hbM = withRim(new THREE.MeshStandardMaterial({ map: hbT, emissiveMap: hbT, emissive: 0x5a7a70, emissiveIntensity: 0.55, normalMap: scB2.normalMap, roughness: 0.85, metalness: 0.1, envMapIntensity: 0.8 }), S.skinRim, 2.4);
      const hb = addU(new THREE.SphereGeometry(1, 22, 16, PI, PI), hbM, 0, 4.95, -0.55); hb.scale.set(1.41, 1.66, 0.21); hb.rotation.x = 0.12; hb.userData.fadeOcclude = true; hb.userData.fadeMin = 0.12; hb.geometry.boundingSphere = new THREE.Sphere(new V3(), 1.5);
      const sp2 = addU(new THREE.SphereGeometry(1, 8, 12), hbM, 0, 4.95, -0.78); sp2.scale.set(0.07, 1.55, 0.06); sp2.rotation.x = 0.12; }
    hood.geometry.boundingSphere = new THREE.Sphere(new V3(), 1.5); S.torso.geometry.computeBoundingSphere(); S.torso.geometry.boundingSphere.radius *= 1.35;
    for (const sx of [-1, 1]) { const rib = addU(new THREE.TorusGeometry(1.2, 0.045, 6, 20, 1.5), gold, sx * 0.1, 4.8, -0.43); rib.rotation.z = sx > 0 ? -0.4 : PI - 1.1; }
    // head: an oversized sculpted mask (deep sockets, heavy brow, open fanged mouth) under a crown of serpents
    S.head = new THREE.Group(); S.head.position.set(0, 5.56, 0.08); S.head.scale.setScalar(1.28); S.up.add(S.head);
    const addH = (geo, mat, x, y, z) => addU(geo, mat, x, y, z, S.head);
    addH(new THREE.SphereGeometry(0.42, 20, 16), skin, 0, 0.06, -0.05).scale.set(0.86, 1.0, 0.96);
    addH(new THREE.BoxGeometry(0.66, 0.11, 0.2), skin, 0, 0.15, 0.31).rotation.x = -0.4;
    for (const sx of [-1, 1]) { addH(new THREE.SphereGeometry(0.1, 10, 8), dark, sx * 0.15, 0.04, 0.315).scale.set(1.45, 0.85, 0.55); addH(new THREE.SphereGeometry(0.14, 10, 8), skin, sx * 0.19, -0.08, 0.26).scale.set(1, 0.7, 0.9); }
    addH(new THREE.ConeGeometry(0.22, 0.34, 8), skin, 0, -0.26, 0.15).rotation.x = PI; S.head.children[S.head.children.length - 1].scale.z = 0.8;
    addH(new THREE.BoxGeometry(0.07, 0.16, 0.1), skin, 0, -0.02, 0.41).rotation.x = 0.3;
    addH(new THREE.BoxGeometry(0.22, 0.08, 0.08), dark, 0, -0.19, 0.32);
    for (const sx of [-1, 1]) { addH(new THREE.ConeGeometry(0.026, 0.13, 5), ivory, sx * 0.07, -0.19, 0.36).rotation.x = PI; addH(new THREE.ConeGeometry(0.018, 0.07, 5), ivory, sx * 0.04, -0.22, 0.355); }
    addH(new THREE.TorusGeometry(0.4, 0.04, 6, 20, PI), gold, 0, 0.24, 0.04).rotation.x = -0.25;
    const tarn = withRim(W.mat({ color: 0x6a5222, roughness: 0.5, metalness: 0.9, envMapIntensity: 1.2 }), S.rim, 2.6); for (const sx of [-1, 1]) { const fin = addH(new THREE.ConeGeometry(0.1, 0.6, 4), tarn, sx * 0.36, 0.16, -0.14); fin.rotation.set(-1.15, 0, sx * -0.65); fin.scale.set(0.35, 1, 0.12); }
    S.eyeMat = W.glow(VEN, 1.2); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), S.eyeMat); e.scale.set(1.5, 0.55, 0.5); e.position.set(sx * 0.15, 0.04, 0.345); e.rotation.z = sx * 0.22; S.head.add(e); }
    S.flare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: flareTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false })); S.flare.position.set(0, 0.1, -0.3); S.head.add(S.flare);
    S.star = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: starTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false, color: new THREE.Color(0xd8ffd0) })); S.star.position.set(0, 7.15, 0.4); S.up.add(S.star);
    // the serpent crown: fewer, thick, S-curved snakes of mixed length with wedge heads and small eye glints
    S.NH = 8; S.HS = 8;
    const segG = new THREE.CylinderGeometry(0.75, 1, 1, 7, 1); segG.translate(0, 0.5, 0);
    S.hairSeg = new THREE.InstancedMesh(segG, scalesB, S.NH * S.HS); S.hairHead = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), scalesB, S.NH);
    S.hairEyeMat = W.glow(0xd8ff60, 0.6); S.hairEye = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), S.hairEyeMat, S.NH * 2);
    for (const im of [S.hairSeg, S.hairHead, S.hairEye]) { im.frustumCulled = false; S.head.add(im); } S.hairSeg.castShadow = S.hairHead.castShadow = true;
    S.hairDir = []; S.hairRoot = []; S.hairLen = [];
    for (let k = 0; k < S.NH; k++) { const a = (k / (S.NH - 1) - 0.5) * 3.9 + (k % 2 ? 0.12 : -0.12), e = 0.3 + (k % 3) * 0.3; const d = new V3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e) * 0.9 + 0.12).normalize(); S.hairDir.push(d); S.hairRoot.push(d.clone().multiplyScalar(0.32).add(new V3(0, 0.1, -0.06))); S.hairLen.push(0.15 + ((k * 5) % 3) * 0.035); }
    // arms: heavy upper arm tapering into the forearm, gold bands, long splayed claws
    const cuff = (r, h, r2 = r) => { const q = new THREE.CylinderGeometry(r2, r, h, 16, 3, true), P = q.attributes.position; for (let i = 0; i < P.count; i++) { const e = Math.abs(P.getY(i)) > h * 0.45 ? 1.04 : 1; P.setX(i, P.getX(i) * e); P.setZ(i, P.getZ(i) * e); } q.computeVertexNormals(); return q; };
    const clawG = new THREE.ConeGeometry(0.05, 0.62, 6, 5); { const P = clawG.attributes.position; for (let i = 0; i < P.count; i++) { const k = (P.getY(i) + 0.31) / 0.62; P.setZ(i, P.getZ(i) - k * k * 0.2); } clawG.computeVertexNormals(); }
    S.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.92, 4.38, 0); S.up.add(sh);
      addU(lathe([[0.3, 0.1], [0.34, -0.15], [0.35, -0.45], [0.3, -0.85], [0.235, -1.15], [0.22, -1.28]], 14), skin, 0, 0, 0, sh);
      addU(cuff(0.325, 0.22), gold, 0, -0.62, 0, sh);
      const el = new THREE.Group(); el.position.y = -1.22; sh.add(el);
      addU(new THREE.SphereGeometry(0.235, 12, 10), skin, 0, 0.02, -0.02, el).scale.set(0.95, 0.8, 0.95);
      addU(lathe([[0.23, 0.06], [0.265, -0.2], [0.245, -0.45], [0.18, -0.8], [0.14, -1.08], [0.15, -1.16]], 14), skin, 0, 0, 0, el);
      addU(cuff(0.19, 0.26, 0.13), gold, 0, -0.86, 0, el);
      const hand = new THREE.Group(); hand.position.y = -1.12; el.add(hand);
      addU(new THREE.SphereGeometry(0.2, 12, 8), skin, 0, -0.12, 0.02, hand).scale.set(1.0, 0.9, 0.45);
      for (let c = 0; c < 4; c++) { const cl = addU(clawG, claw, (c - 1.5) * 0.09, -0.48, 0.05, hand); cl.rotation.set(PI + 0.45, 0, (c - 1.5) * 0.3); }
      const th = addU(clawG, claw, -sx * 0.18, -0.24, 0.1, hand); th.rotation.set(PI + 0.7, 0, -sx * 0.9); th.scale.setScalar(0.7);
      S.arms.push({ sh, el, hand, sx });
    }
    S.headL = new THREE.PointLight(VEN, 0, 6, 2); S.headL.position.set(0, 5.35, 1.3); S.up.add(S.headL);
    S.vis = visionWedge(); g.add(S.vis.g);
    S.gaze = 0; S.stoneT = 0; S.statSpeed = 2.7; S.botYaw = PI; S.nMir = 0; S.rear = 0; S.slashT = 0; S.grind = 0; S.seedN = 20; S.mode = 0; S.pk = 0; S.frostT = 0;
    tailUpd(S, 0, 0, 0, 0);
    return {
      edge: 'wall', spawn: { x: 0, z: 13 }, bossStart: { x: 0, z: -3, face: 0 },
      contains: (x, z) => Math.hypot(x, z) <= R - 0.3,
      clamp(p) { const d = Math.hypot(p.x, p.z), m = R - 0.5; if (d > m) { p.x *= m / d; p.z *= m / d; } },
    };
  }

  // awakened statue: shared pose geometry and stone, its own eyes; it goes back to the pool when it crumbles
  function awakeMesh(S, k) {
    const g = new THREE.Group(), v = k % 3, P = POSES[v], body = new THREE.Mesh(S.figGeo[v], S.stoneMat); body.castShadow = true; g.add(body);
    const eyes = W.glow(VEN, 4); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.04), eyes); e.position.set(P.head[0] + sx * 0.075, P.head[1], P.head[2] + 0.16); g.add(e); }
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.7, 0.03), eyes); crack.position.set(P.chest[0] + 0.06, P.chest[1] - 0.1, P.chest[2] + 0.27); crack.rotation.z = 0.3; g.add(crack);
    g.visible = false; G.world.add(g); return { g, eyes };
  }

  // ---- statues ----
  const awake = () => G.ents.filter((e) => e.isAdd && e.alive);
  function wake(b, n = 1) {
    const S = b.state, p = G.player;
    const free = S.ped.filter((q) => q.has).sort((u, w) => dist2(w.x, w.z, p.pos.x, p.pos.z) - dist2(u.x, u.z, p.pos.x, p.pos.z));
    for (let k = 0; k < n && free.length; k++) {
      const q = free.splice(Math.floor(rnd(0, Math.min(free.length, 4))), 1)[0]; q.has = false; q.mesh.visible = false; q.regrow = 26;
      const sm = S.pool.length ? S.pool.splice(Math.floor(vrand() * S.pool.length), 1)[0] : awakeMesh(S, S.seedN++); sm.g.visible = true; sm.g.position.set(0, 0, 0); sm.g.rotation.set(0, 0, 0);
      const a = b.spawnAdd({
        name: 'Petrified', hp: 520, x: q.x, z: q.z, radius: 0.8, aimY: 1.5, mesh: sm.g, color: 0xb8c0b4, facing: angTo(q.x, q.z, p.pos.x, p.pos.z),
        onDeath() { sm.g.visible = false; G.world.add(sm.g); S.pool.push(sm); },
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
    FX.flash(0xb8c4bc, 0.1, 5); Sound.sfx('shatter', 0.9, 0.4); FX.burst(p.pos.x, 1, p.pos.z, { n: 30, color: 0xc0c8c0, speed: [1, 4], life: [0.5, 1.2] }); FX.ring(p.pos.x, p.pos.z, { r1: 3, color: 0xc0c8c0, dur: 0.5 });
  }
  function* behold(b, o = {}) {
    const S = b.state, time = o.time || 2.5; S.locked = false;
    Sound.sfx('charge', 1, 0.45); Sound.sfx('bell', 0.5, 2.2);
    if (!G.headless) { const hp = headPos(b, new V3()); hp.y += 1.6; for (const m of S.mir) if (m.on) FX.beam(hp, mirPos(m, new V3()), { color: VEN, width: 0.045, dur: 0.4, hold: time }); }
    const resolve = (h) => {
      const hit = sources(b).some((q) => seen(S, q.x, q.y, q.z));
      FX.ring(b.pos.x, b.pos.z, { r1: 30, color: 0x8ac8a8, dur: 0.7, width: 0.08 }); Sound.sfx('laser', 0.8, 0.5); if (!G.headless) { headPos(b, _a); FX.light(_a.x, _a.y, _a.z, VEN, 20, 0.35, 20); for (const m of S.mir) if (m.on) { mirPos(m, _a); FX.burst(_a.x, _a.y, _a.z, { n: 20, color: VEN, speed: [2, 8], life: [0.3, 0.7] }); } }
      for (const e of awake()) if (Hz.inShape(h.shape, e.pos.x, e.pos.z)) crumble(e);
      if (hit) petrify(b); else FX.flash(VEN, 0.06, 4);
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
    Hz.cone(b.pos.x, b.pos.z, dir, 2.3, 10.5, 1.25, 300, { name: 'Serpent Lash', kb: { dist: 4 }, onFire() { FX.slash(b.pos.x, 0.8, b.pos.z, dir, { r: 10.5, color: 0x3c9a58, dur: 0.35 }); Sound.sfx('slash', 1, 0.5); FX.shake(0.35); } });
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
      for (let i = 0; i < 7; i++) { const d = off + (i + k * 0.5) / 7 * TAU; Hz.rect(b.pos.x, b.pos.z, d, 30, 2.7, 1.2, 280, { name: 'Nest of Vipers', quiet: true, onFire() { if (!G.headless) FX.beam(_a.set(b.pos.x, 1.2, b.pos.z), _b2.set(b.pos.x + Math.sin(d) * 30, 1.2, b.pos.z + Math.cos(d) * 30), { color: 0x4aa862, width: 0.35, dur: 0.3 }); } }); }
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

  // serpent body: rebuild the tube around the spine (same spine the old ball chain used)
  function tailUpd(S, t, rear, sweep, upY) {
    const T = S.tailT, NL = T.NL, NR = T.NR, P = T.P, Rr = T.R, pos = T.pos, nor = T.nor;
    P[0].set(0, 3.05 + upY, 0.02); Rr[0] = 0.5;
    for (let i = 1; i < NL; i++) {
      const s = (i - 1) / (NL - 2), k = s * 25, r = lerp(0.92, 0.16, Math.pow(s, 0.85)) * Math.min(1, (1 - s) * 7 + 0.14) * lerp(0.56, 1, smooth(s / 0.2));
      const w = Math.sin(k * 0.55 - t * 2.2) * (0.2 + s * 1.9) + sweep * s * 4, lift = Math.max(0, 1 - s * 5.5);
      P[i].set(w + Math.sin(lift * PI) * 0.45, r * 0.68 + lift * lift * (1.9 + rear * 0.7), -s * 12.5 + lift * 0.4 + Math.sin(lift * PI * 2) * 0.35); Rr[i] = r;
    }
    let sx = -1, sz = 0;
    for (let i = 0; i < NL; i++) {
      const a = P[Math.max(0, i - 1)], c = P[Math.min(NL - 1, i + 1)];
      let tx = c.x - a.x, ty = c.y - a.y, tz = c.z - a.z; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const ql = Math.hypot(tz, tx); if (ql > 0.08) { sx = tz / ql; sz = -tx / ql; }
      const ux = ty * sz, uy = tz * sx - tx * sz, uz = -ty * sx;
      const r = Rr[i], rx = r * 1.12, ry0 = r * 0.88, p = P[i];
      for (let j = 0; j <= NR; j++) {
        const th = j / NR * TAU, cs = Math.cos(th), sn = Math.sin(th), ry = sn < 0 ? ry0 * 0.75 : ry0, o = (i * (NR + 1) + j) * 3;
        pos[o] = p.x + sx * cs * rx + ux * sn * ry; pos[o + 1] = p.y + uy * sn * ry; pos[o + 2] = p.z + sz * cs * rx + uz * sn * ry;
        const nx = sx * cs / rx + ux * sn / ry, ny = uy * sn / ry, nz = sz * cs / rx + uz * sn / ry, nl = Math.hypot(nx, ny, nz) || 1;
        nor[o] = nx / nl; nor[o + 1] = ny / nl; nor[o + 2] = nz / nl;
      }
    }
    T.geo.attributes.position.needsUpdate = true; T.geo.attributes.normal.needsUpdate = true;
  }

  // per-phase environment palettes, blended by the damped phase value S.pk
  const PAL = {
    fog: [0x0a1512, 0x160c0c, 0x050b0c], fogD: [0.014, 0.014, 0.016], hemi: [0x52707a, 0x8a4450, 0x34525a], hemiG: [0x0a0d08, 0x100606, 0x040606], hemiI: [0.6, 0.95, 0.55],
    moonL: [0xb4ccff, 0xf09a80, 0xc4d6d2], moonI: [2.6, 2.9, 1.7], moonC: [0xdce6f4, 0xff6a40, 0xc8d8d0], halo: [0x5a7090, 0x902418, 0x24343a], ecl: [0, 0.3, 1],
    hill0: [0x1c2c34, 0x3a1416, 0x0e1c1e], hill1: [0x0c171a, 0x1c0a0c, 0x060e10], mist: [0x6a7e8c, 0x8a3a30, 0x3e6460], cloud: [0x5a6a7c, 0xc04a28, 0x203436],
    mote: [0xb8c8d0, 0xff8a40, 0xc8d4cc], moteM: [0.9, 1.5, 1.0], mirE: [0.5, 0.8, 1.7], skinRim: [0x4a6a80, 0x6a2016, 0x2e6a62], fill: [0x4a5a6c, 0x626470, 0x4c5654],
    envRim: [0x182838, 0x701c12, 0x1c6460], crowdRim: [0x3a5470, 0x701e16, 0x2a6a66], mirRim: [0x4a3010, 0x6a2a10, 0x5a9484], rim: [0x6a4a22, 0x8a2a14, 0x3a6458], cyp: [0x24384a, 0x4a1c18, 0x1a3034],
  };
  const palC = (arr, pk, out) => { const i = clamp(Math.floor(pk), 0, 1), f = sat(pk - i); return out.setHex(arr[i]).lerp(_c2.setHex(arr[i + 1]), f); };
  const palN = (arr, pk) => { const i = clamp(Math.floor(pk), 0, 1); return lerp(arr[i], arr[i + 1], sat(pk - i)); };

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
        const S = b.state; S.gaze = 0; S.mode = 0; S.locked = false; b.autoFace = true; S.rear = 1; Sound.sfx('roar', 0.9, 1.7); FX.shake(0.8); FX.flash(0xff4030, 0.25, 2);
        Co.start(skyTo(b, { uSunCol: 0xff5a3a, uHor: 0x3a1418, uTop: 0x0a0408, uCloudCol: 0x9a4430, uStars: 0.3 }, 3), 'fight'); Co.start(Post.lerpTo({ tint: [1.06, 0.98, 0.95], bloom: 0.66 }, 3), 'fight');
        S.statSpeed = 3.3;
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
        Sound.sfx('roar', 1, 2); Sound.sfx('bigboom', 0.7); FX.flash(0xa8c8b8, 0.26, 2.5); FX.shake(1.1);
        Co.start(skyTo(b, { uSunCol: 0x1a2a26, uSunGlow: 0.3, uHor: 0x0a181a, uTop: 0x010304, uStars: 0.25, uCloud: 0.5, uCloudCol: 0x2a3c3e }, 2.5), 'fight'); Co.start(Post.lerpTo({ tint: [0.96, 1.0, 1.03], bloom: 0.62, vig: 1.12, sat: 0.95 }, 2.5), 'fight');
        S.statSpeed = 3.9;
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
      S.pk = damp(S.pk, Math.max(0, b.phase), 0.9, dt); if (b.phase >= 2) S.frostT = Math.min(1, S.frostT + dt / 40);
      if (G.headless) return;
      Post.final.uniforms.uSat.value = Post.cur.sat * (1 - 0.4 * sat(S.stoneT / 0.5));
      for (const q of S.ped) if (q.rise > 0) { q.rise = Math.max(0, q.rise - dt * 0.6); q.mesh.position.y = 0.5 - q.rise * 2.6; }
      // vision wedge: follows the character's facing, brightens during a stare and turns venom green while a face is inside it
      { const V = S.vis, show = p.alive && G.state === 'fight' && Cam.cineW < 0.5; V.g.visible = show;
        if (show) { V.g.position.set(p.pos.x, p.pos.y + 0.06, p.pos.z); V.g.rotation.y = p.facing;
          const danger = S.gaze > 0 && sources(b).some((q) => seen(S, q.x, q.y, q.z)); V.k = damp(V.k, danger ? 1 : 0, 14, dt);
          const c = V.fill.material.color.setHex(PALE).lerp(_c.setHex(VEN), V.k).multiplyScalar(1 + V.k * 1.5); V.edge.material.color.copy(c);
          V.fill.material.opacity = 0.1 + S.gaze * 0.1 + V.k * 0.12; V.edge.material.opacity = 0.35 + S.gaze * 0.25 + V.k * 0.3; } }
      // environment: blend the phase palettes
      const pk = S.pk, p2 = sat(pk - 1), p1 = sat(pk);
      palC(PAL.fog, pk, scene.fog.color); scene.fog.density = palN(PAL.fogD, pk);
      palC(PAL.hemi, pk, S.hemi.color); palC(PAL.hemiG, pk, S.hemi.groundColor); S.hemi.intensity = palN(PAL.hemiI, pk);
      palC(PAL.moonL, pk, S.moon.color); S.moon.intensity = palN(PAL.moonI, pk);
      { const U = S.moonM.material.uniforms; palC(PAL.moonC, pk, U.uCol.value); palC(PAL.halo, pk, U.uHalo.value); U.uE.value = palN(PAL.ecl, pk); S.moonM.scale.setScalar(530 * (1 + p1 * 0.12)); U.uT.value = t; }
      palC(PAL.cloud, pk, S.cloudM.color); palC(PAL.hill0, pk, S.hills[0].color); palC(PAL.hill1, pk, S.hills[1].color);
      for (const m of S.mist) { palC(PAL.mist, pk, m.uniforms.uCol.value); m.uniforms.uT.value = t; }
      { const U = S.motes.material.uniforms; palC(PAL.mote, pk, U.uCol.value).multiplyScalar(palN(PAL.moteM, pk)); U.uVel.value.y = 0.03 + p1 * 0.25 - p2 * 0.2; }
      palC(PAL.rim, pk, S.rim.value).multiplyScalar(0.55); palC(PAL.skinRim, pk, S.skinRim.value); palC(PAL.fill, pk, S.fill.value); palC(PAL.envRim, pk, S.envRim.value); palC(PAL.crowdRim, pk, S.crowdRim.value); palC(PAL.mirRim, pk, S.mirRim.value);
      S.dust.material.uniforms.uAlpha.value = p2 * 0.85; S.crowdMat.emissiveIntensity = S.marble.emissiveIntensity; palC(PAL.cyp, pk, S.cypRim.value);
      // escalation: cracks in the mosaic smoulder in phase 2; in phase 3 its eyes open, stone splits with light and frost creeps in
      const fl = 0.72 + 0.28 * Math.sin(t * 1.1) * (0.8 + 0.2 * Math.sin(t * 5.3 + 1));
      S.mosU.crk.value.setRGB(1.0, 0.3, 0.06).lerp(_c.setRGB(0.1, 0.5, 0.34), p2).multiplyScalar(p1 * (0.55 - p2 * 0.15) * fl);
      S.mosU.eye.value.setRGB(0.5, 1.0, 0.45).multiplyScalar(p2 * (0.6 + S.gaze * 1.2));
      S.marble.emissiveIntensity = S.stoneMat.emissiveIntensity = p2 * 1.6 * (0.75 + 0.25 * Math.sin(t * 7.1) * Math.sin(t * 2.9));
      S.frost.material.uniforms.uA.value = p2; S.frost.material.uniforms.uIn.value = R + 0.5 - S.frostT * 3.2; S.frost.material.uniforms.uT.value = t;
      // body
      const gz = S.gaze, rear = damp(S.rearK || 0, Math.max(S.rear, gz > 0 ? 1 : 0), 5, dt); S.rearK = rear;
      S.up.position.y = Math.sin(t * 1.3) * 0.12 + rear * 0.7; S.up.rotation.x = -rear * 0.12 + Math.sin(t * 0.9) * 0.03; S.up.rotation.z = Math.sin(t * 0.7) * 0.05;
      const sweep = S.slashT > 0 ? Math.sin((1 - S.slashT / 0.4) * PI) * 2.4 : 0; if (S.slashT > 0) S.slashT -= dt;
      tailUpd(S, t, rear, sweep, S.up.position.y);
      // serpent crown: thick snakes that arc out in an S and curl back toward you; droop in phase 1, fan in phase 2+, flare in a stare
      S.hairK = damp(S.hairK || 0, gz > 0 ? 1 : 0, 6, dt); const fan = Math.min(1, 0.1 + p1 * 0.45 + p2 * 0.25 + S.hairK * 0.6);
      { let si = 0, ei = 0;
        for (let k = 0; k < S.NH; k++) {
          const d0 = S.hairDir[k], ph = k * 2.3, droop = 0.75 * (1 - fan), L = S.hairLen[k] * (1 + fan * 0.15); _a.copy(S.hairRoot[k]);
          _u.crossVectors(d0, _Y); if (_u.lengthSq() < 1e-4) _u.set(1, 0, 0); _u.normalize(); _w.crossVectors(_u, d0);
          for (let j = 0; j < S.HS; j++) {
            const f = j / S.HS, wv = Math.sin(j * 0.85 + ph - t * 2.2) * 0.6 * (1 - S.hairK * 0.4), wv2 = Math.cos(j * 0.7 + ph * 1.3 - t * 1.7) * 0.25;
            _d.copy(d0).multiplyScalar(1 - f * droop).addScaledVector(_Y, -f * droop + fan * f * 0.3 + f * f * 0.15).addScaledVector(_u, wv).addScaledVector(_w, wv2); _d.z += f * f * 0.9;
            const l = _d.length() || 1; _d.divideScalar(l); const r = 0.2 * (1 - f * 0.62);
            _q.setFromUnitVectors(_Y, _d); _M.compose(_a, _q, _s.set(r, L * 1.1, r)); S.hairSeg.setMatrixAt(si++, _M); _a.addScaledVector(_d, L);
          }
          _d.set(_d.x * 0.5, _d.y * 0.5 + 0.45, _d.z * 0.5 + 0.45); _d.normalize();
          _q.setFromUnitVectors(_Y, _d); _w.copy(_a).addScaledVector(_d, 0.12); _M.compose(_w, _q, _s.set(0.165, 0.3, 0.11)); S.hairHead.setMatrixAt(k, _M);
          _u.crossVectors(_d, _Y); if (_u.lengthSq() < 1e-4) _u.set(1, 0, 0); _u.normalize(); _v.crossVectors(_u, _d);
          for (const sx of [-1, 1]) { _w.copy(_a).addScaledVector(_d, 0.2).addScaledVector(_v, 0.055).addScaledVector(_u, sx * 0.07); _M.compose(_w, _q.identity(), _s.setScalar(0.026)); S.hairEye.setMatrixAt(ei++, _M); }
        }
        S.hairSeg.instanceMatrix.needsUpdate = S.hairHead.instanceMatrix.needsUpdate = S.hairEye.instanceMatrix.needsUpdate = true; }
      // arms: one claw raised, one reaching, both swaying slowly; a stare lifts both
      for (const A of S.arms) { const sw = Math.sin(t * 0.8 + A.sx * 1.3), sw2 = Math.sin(t * 0.55 + A.sx);
        if (A.sx < 0) { A.sh.rotation.set(-0.25 - rear * 0.25 + sw * 0.08, 0, -2.35 - rear * 0.2 + sw2 * 0.1); A.el.rotation.x = -0.95 + sw2 * 0.15; A.hand.rotation.x = -0.7; }
        else { A.sh.rotation.set(-0.55 - rear * 0.35 + sw * 0.1, 0, 0.22 + sw2 * 0.06); A.el.rotation.x = -1.05 - rear * 0.2 + sw2 * 0.1; A.hand.rotation.x = -0.35; } }
      S.up.rotation.y = 0.42 + Math.sin(t * 0.45) * 0.1; S.up.rotation.x += 0.16; S.head.rotation.z = 0.2 + Math.sin(t * 0.6) * 0.05; S.head.rotation.y = -0.3;
      S.head.rotation.x = -gz * 0.25 + Math.sin(t * 1.1) * 0.04;
      const eb = 1.4 + pk * 0.8;
      S.eyeMat.color.setHex(VEN).lerp(_c2.setHex(0xf0ffe0), gz * 0.5).multiplyScalar(eb + gz * gz * 3.5); S.hairEyeMat.color.setHex(0xd8ff60).multiplyScalar(eb * 0.3 + gz * 1.2); S.gemMat.color.setHex(VEN).multiplyScalar(0.6 + gz * 0.8);
      S.flare.material.opacity = gz * gz * 0.4; S.flare.scale.setScalar(0.6 + gz * gz * 1.3); S.star.visible = S.nMir > 0; S.star.material.opacity = gz * 0.9; S.star.scale.setScalar(0.4 + gz * 1.0); S.star.quaternion.copy(camera.quaternion); S.up.getWorldQuaternion(_q); S.star.quaternion.premultiply(_q.invert()); S.star.rotateZ(t * 0.6); S.flare.quaternion.copy(camera.quaternion); S.head.getWorldQuaternion(_q); S.flare.quaternion.premultiply(_q.invert());
      S.headL.intensity = gz * gz * 6;
      for (const m of S.mir) {
        if (!m.on) continue; mirPos(m, _a); m.g.position.set(_a.x, m.y + Math.sin(t * 1.3 + m.a) * 0.25, _a.z); m.g.lookAt(p.pos.x, 1.6, p.pos.z);
        m.eyes.color.setRGB(1, 1, 1).multiplyScalar(palN(PAL.mirE, pk) + gz * gz * 3.5); m.flare.material.opacity = p2 * 0.2 + gz * gz * 0.6; m.flare.scale.setScalar(0.4 + gz * gz * 2.4);
        m.chg.uK.value = gz; m.chg.uT.value = t;
      }
      const fk = 1 + p1 * 0.5 - p2 * 0.75; _c.setHex(0xffa040).lerp(_c2.setHex(0xd8c050), p2).multiplyScalar(2.2 - p2 * 0.8); for (const f2 of S.fires) f2.mat.color.copy(_c); S.fireL[0].color.setHex(0xff9a40).lerp(_c2.setHex(0xd8b850), p2); S.fireL[1].color.copy(S.fireL[0].color);
      for (const f of S.fires) { f.m.scale.set(0.9, (1.5 + Math.sin(t * 9 + f.x) * 0.25) * fk, 0.9); f.m.position.y = 2.05 + (fk - 1) * 0.25; if (vrand() < dt * 14 * fk) FX.burst(f.x, 2.1, f.z, { n: 1, color: 0xffa040, color2: 0xff3010, speed: [0.2, 0.8], up: 2.6 * fk, life: [0.4, 0.9], size: [0.3, 0.7] }); }
      S.fireL[0].intensity = 45 * fk * (0.9 + Math.sin(t * 8) * 0.06 + Math.sin(t * 13) * 0.04); S.fireL[1].intensity = 45 * fk * (0.9 + Math.sin(t * 9 + 2) * 0.06);
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
})();
