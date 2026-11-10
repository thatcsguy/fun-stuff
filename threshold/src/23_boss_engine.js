// DOOR IV: PARALLAX, the Astral Engine. A grid of charged tiles in orbit. The core shows you which colour dies.
(() => {
  const N = 7, TS = 4.4, HALF = N * TS / 2, CY = 0x20d8ff, MG = 0xff30c0, IDLE = 0x2c48b8, WARN = 0xff2a18;
  const TH = 0.8, TY = -TH / 2; // tile slab thickness; the walkable top stays at y = 0
  const COLS = [IDLE, CY, MG], IDLE2 = 0x1a6a9a;
  const tIdx = (x, z) => { const ix = Math.floor((x + HALF) / TS), iz = Math.floor((z + HALF) / TS); return ix < 0 || iz < 0 || ix >= N || iz >= N ? -1 : iz * N + ix; };
  const PATTERNS = [
    (ix, iz) => ix % 2, (ix, iz) => iz % 2, (ix, iz) => (ix + iz) % 2, (ix, iz) => (ix < 3 || (ix === 3 && iz < 3)) === (iz < 3 || (iz === 3 && ix > 3)) ? 0 : 1,
    (ix, iz) => Math.max(Math.abs(ix - 3), Math.abs(iz - 3)) % 2, (ix, iz) => (Math.floor(ix / 2) + Math.floor(iz / 2)) % 2, (ix, iz) => (ix + iz * 2) % 3 === 0 ? 1 : 0,
  ];
  // per-phase accents: rim light on the machinery, distance haze, the core's resting colour
  const RIM_COL = [0x2f6cff, 0xc04a18, 0x7448d8], HAZE_COL = [0x070c22, 0x140812, 0x0e0820], CORE_COL = [0x80c0ff, 0xff9040, 0xa478ff];

  // ---------- shared shader dressing: fresnel rim + distance haze on standard materials ----------
  const RIM = { uRim: { value: new THREE.Color(RIM_COL[0]) }, uRimS: { value: 0.4 }, uHazeC: { value: new THREE.Color(HAZE_COL[0]) }, uHazeD: { value: new THREE.Vector2(26, 90) } };
  function dress(mat, o = {}) {
    const rk = { value: o.rim === undefined ? 1 : o.rim }, hk = { value: o.haze || 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = RIM.uRim; sh.uniforms.uRimS = RIM.uRimS; sh.uniforms.uHazeC = RIM.uHazeC; sh.uniforms.uHazeD = RIM.uHazeD; sh.uniforms.uRimK = rk; sh.uniforms.uHazeK = hk;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uRim, uHazeC; uniform float uRimS, uRimK, uHazeK; uniform vec2 uHazeD;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vd = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vd)), 0.0, 1.0); totalEmissiveRadiance += uRim * (uRimS * uRimK * pow(max(fr, 0.0), 3.0)); }')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n{ float hd = clamp((length(vViewPosition) - uHazeD.x) / max(uHazeD.y, 1e-3), 0.0, 1.0) * uHazeK; gl_FragColor.rgb = mix(max(gl_FragColor.rgb, vec3(0.0)), uHazeC, hd); }');
    };
    mat.customProgramCacheKey = () => 'eng-dress';
    return mat;
  }

  // ---------- tiles ----------
  const hexD = (x, y) => { const ry = 1.7320508, m = (v, d) => ((v % d) + d) % d; const ax = m(x, 1) - 0.5, ay = m(y, ry) - ry / 2, bx = m(x - 0.5, 1) - 0.5, by = m(y - ry / 2, ry) - ry / 2; const a = ax * ax + ay * ay < bx * bx + by * by, ux = Math.abs(a ? ax : bx), uy = Math.abs(a ? ay : by); return 0.5 - Math.max(ux, ux * 0.5 + uy * 0.866); };
  // four sub-panel layouts (picked per tile by hash): 0 hex grate, 1 quartered plates, 2 vent slats, 3 ring port
  function tileTex(V) {
    const inner = (u, v, n) => { // -> [height, tone, rough] for the recessed inset
      const cx = Math.abs(u - 0.5), cz = Math.abs(v - 0.5), dm = cx + cz, rr = Math.hypot(u - 0.5, v - 0.5);
      if (V === 0) { const g = smooth(sat(hexD(u * 9, v * 9) / 0.07)), boss = 1 - smooth(sat((dm - 0.1) / 0.03)); return [0.25 + (1 - g) * 0.12 + boss * 0.35, 0.22 + (1 - g) * 0.25 + boss * 0.4, 0.7 + n * 0.15]; }
      if (V === 1) { const sm = Math.min(cx, cz), seam = smooth(sat((sm - 0.012) / 0.02)), q = W.hash2(u > 0.5 ? 1 : 0, v > 0.5 ? 1 : 0, 7); const bolt = [0.18, 0.32].some((o) => Math.hypot(cx - o, cz - o) < 0.012) ? 1 : 0; return [0.3 + seam * 0.3 - bolt * 0.1, (0.25 + q * 0.3) * seam + bolt * 0.5, 0.55 + q * 0.2 + n * 0.1]; }
      if (V === 2) { const inR = Math.max(cx, cz * 1.15) < 0.3, sl = (u * 22) % 1, slat = smooth(sat(Math.abs(sl - 0.5) * 4 - 0.6)); return inR ? [0.22 + (1 - slat) * 0.25, 0.2 + (1 - slat) * 0.35, 0.6 + n * 0.1] : [0.42, 0.32 + n * 0.1, 0.65 + n * 0.1]; }
      const ring = Math.exp(-Math.pow((rr - 0.26) / 0.02, 2)), ring2 = Math.exp(-Math.pow((rr - 0.33) / 0.012, 2)), spoke = rr > 0.1 && rr < 0.24 && Math.abs(Math.sin(Math.atan2(v - 0.5, u - 0.5) * 4)) < 0.12 ? 1 : 0;
      return [0.34 - ring * 0.18 + ring2 * 0.12 + spoke * 0.15 + (rr < 0.09 ? 0.3 : 0), 0.28 + ring2 * 0.35 + spoke * 0.25 + (rr < 0.09 ? 0.35 : 0), 0.6 + n * 0.12];
    };
    const surf = W.bake(256, (u, v) => {
      const e = Math.min(u, 1 - u, v, 1 - v), n = W.fbm(u * 24, v * 24, 3 + V, 3, 24), wn = W.fbm(u * 60, v * 60, 11 + V, 2, 60);
      const bev = smooth(sat(e / 0.03)), drop = 1 - smooth(sat((e - 0.085) / 0.018)), frame = bev * drop, inset = 1 - drop;
      const wear = e < 0.045 && wn > 0.55 ? (wn - 0.55) * 2.5 : 0; // scuffed bare metal on the outer bevel
      const ins = inner(u, v, n);
      return [frame * 0.9 + inset * ins[0] + n * 0.03 - wear * 0.04, frame * (0.7 + n * 0.2 + wear * 0.6) + inset * ins[1], frame * (0.5 + n * 0.2 - wear * 0.25) + inset * ins[2]];
    }, { dark: 0x0a0d14, light: 0x5a6578, strength: 5 });
    // emissive channels: R = seam line around the frame (carries the running light), G = inset detail, B = centre glyph
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), im = x.createImageData(256, 256);
    for (let py = 0; py < 256; py++) for (let px = 0; px < 256; px++) {
      const u = (px + 0.5) / 256, v = (py + 0.5) / 256, e = Math.min(u, 1 - u, v, 1 - v), cx = Math.abs(u - 0.5), cz = Math.abs(v - 0.5), dm = cx + cz, rr = Math.hypot(u - 0.5, v - 0.5);
      const seam = Math.exp(-Math.pow((e - 0.096) / 0.007, 2)) + 0.35 * Math.exp(-Math.pow((e - 0.018) / 0.005, 2));
      const corner = (Math.min(cx, cz) > 0.34 && e < 0.1 && e > 0.05) ? 0.6 : 0, inset = e > 0.105 ? 1 : 0;
      let G2 = 0, B2 = 0;
      if (V === 0) { G2 = 0.12 + 0.6 * Math.exp(-Math.pow(hexD(u * 9, v * 9) / 0.035, 2)) + ((cz < 0.006 && cx > 0.14) || (cx < 0.006 && cz > 0.14) ? 0.8 : 0); B2 = (dm < 0.06 ? 1 : 0) + Math.exp(-Math.pow((dm - 0.1) / 0.008, 2)) * 0.8; }
      else if (V === 1) { G2 = 0.08 + Math.exp(-Math.pow(Math.min(cx, cz) / 0.008, 2)) * 0.9; B2 = Math.exp(-Math.pow((Math.max(cx, cz) - 0.05) / 0.008, 2)) * (Math.max(cx, cz) < 0.07 ? 1 : 0); }
      else if (V === 2) { const inR = Math.max(cx, cz * 1.15) < 0.3; G2 = inR ? 0.1 + 0.6 * Math.exp(-Math.pow(((u * 22) % 1 - 0.5) / 0.08, 2)) : 0.05; B2 = Math.abs(Math.max(cx, cz * 1.15) - 0.31) < 0.006 ? 0.9 : 0; }
      else { G2 = 0.06 + Math.exp(-Math.pow((rr - 0.26) / 0.01, 2)) * 1.0 + Math.exp(-Math.pow((rr - 0.33) / 0.005, 2)) * 0.5; B2 = rr < 0.07 ? 1 : 0; }
      const k = (py * 256 + px) * 4; im.data[k] = 255 * Math.min(1, seam + corner); im.data[k + 1] = 255 * Math.min(1, G2 * inset); im.data[k + 2] = 255 * Math.min(1, B2 * inset); im.data[k + 3] = 255;
    }
    x.putImageData(im, 0, 0); const em = new THREE.CanvasTexture(c); em.anisotropy = 8;
    return { surf, em };
  }
  function sideTex() {
    // side strip: dark slab with a bright underside band and a thin lip under the top edge
    const sc = document.createElement('canvas'); sc.width = 128; sc.height = 64; const sx = sc.getContext('2d'); sx.fillStyle = '#000'; sx.fillRect(0, 0, 128, 64);
    sx.fillStyle = '#3a3a3a'; sx.fillRect(0, 5, 128, 2); sx.fillStyle = '#ffffff'; sx.fillRect(0, 50, 128, 5); sx.fillStyle = '#555'; sx.fillRect(0, 57, 128, 7);
    sx.fillStyle = '#1a1a1a'; for (let i = 0; i < 8; i++) sx.fillRect(8 + i * 16, 16, 2, 26);
    return new THREE.CanvasTexture(sc);
  }
  // box with the top face as group 0 and everything else as group 1 (2 draws per tile instead of 6)
  function tileGeo() {
    const g = new THREE.BoxGeometry(TS - 0.24, TH, TS - 0.24), idx = Array.from(g.index.array), top = idx.slice(12, 18), rest = idx.slice(0, 12).concat(idx.slice(18));
    g.setIndex(top.concat(rest)); g.clearGroups(); g.addGroup(0, 6, 0); g.addGroup(6, rest.length, 1); return g;
  }
  function tileMat(T, tex, ph) {
    const U = { uK: { value: new V3(1, 0.25, 0.5) }, uPh: { value: ph } };
    const m = new THREE.MeshStandardMaterial({ color: 0x9aa4b8, map: tex.surf.map, normalMap: tex.surf.normalMap, roughnessMap: tex.surf.roughnessMap, metalness: 0.55, roughness: 1, emissive: IDLE, emissiveMap: tex.em, emissiveIntensity: 1.3, envMapIntensity: 0.45 });
    m.normalScale.set(1.2, 1.2);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uT = T; sh.uniforms.uK = U.uK; sh.uniforms.uPh = U.uPh;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT, uPh; uniform vec3 uK;')
        .replace('#include <emissivemap_fragment>', `{ vec4 em = texture2D(emissiveMap, vEmissiveMapUv); vec2 q = vEmissiveMapUv - 0.5; float per = atan(q.y, q.x + 1e-5) / 6.2831853;
          float run = 0.55 + 1.1 * pow(max(0.5 + 0.5 * sin((per * 2.0 - uT * 0.35 - uPh) * 6.2831853), 0.0), 8.0);
          totalEmissiveRadiance *= max(em.r * run * uK.x + em.g * uK.y + em.b * uK.z, 0.0); }`);
    };
    m.customProgramCacheKey = () => 'eng-tile';
    return { m, U };
  }

  // ---------- sky dressing ----------
  function planetTex() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
    for (let y = 0; y < 256; y++) { const n = W.fbm(y * 0.045, 1.3, 5, 4), m = W.fbm(y * 0.2, 7.1, 9, 3); const r = 140 + n * 95 + m * 25, g2 = 82 + n * 70 + m * 10, b2 = 64 + (1 - n) * 60; x.fillStyle = `rgb(${r | 0},${g2 | 0},${b2 | 0})`; x.fillRect(0, y, 512, 1); }
    x.globalAlpha = 0.22; for (let i = 0; i < 320; i++) { const y = Math.random() * 256, w = 30 + Math.random() * 160; x.fillStyle = Math.random() < 0.5 ? '#ffe8c8' : '#4a2418'; x.fillRect(Math.random() * 512, y, w, 1 + Math.random() * 2); }
    x.globalAlpha = 0.5; for (let i = 0; i < 4; i++) { const px = Math.random() * 512, py = 70 + Math.random() * 120, rr = 6 + Math.random() * 10; const gr = x.createRadialGradient(px, py, 0, px, py, rr * 2); gr.addColorStop(0, '#fff2dc'); gr.addColorStop(0.4, '#c07048'); gr.addColorStop(1, 'rgba(120,60,40,0)'); x.fillStyle = gr; x.beginPath(); x.ellipse(px, py, rr * 2.2, rr, 0, 0, TAU); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
  }
  function planetMat(sunDir) {
    return new THREE.ShaderMaterial({
      uniforms: { uTex: { value: planetTex() }, uSun: { value: sunDir.clone() }, uAtm: { value: new THREE.Color(0xff9a6a) }, uT: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; varying vec2 vUv; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uSun, uAtm; uniform float uT; varying vec3 vN; varying vec3 vW; varying vec2 vUv;
        void main(){ vec3 N = normalize(vN); vec3 Vd = cameraPosition - vW; vec3 V = Vd / max(length(Vd), 1e-3);
          vec2 uv = vUv; uv.y += 0.006 * sin(uv.x * 6.2831853 * 3.0 + uv.y * 60.0 + uT) + 0.003 * sin(uv.x * 6.2831853 * 7.0 - uv.y * 140.0);
          vec3 base = texture2D(uTex, uv).rgb; float ndl = dot(N, uSun);
          float day = smoothstep(-0.12, 0.45, ndl); vec3 col = base * (0.012 + 1.05 * day * max(ndl + 0.12, 0.0));
          col += vec3(1.0, 0.36, 0.12) * base * exp(-ndl * ndl * 60.0) * 0.35;
          float fr = 1.0 - clamp(dot(N, V), 0.0, 1.0); col += uAtm * pow(max(fr, 0.0), 3.0) * smoothstep(-0.35, 0.5, ndl) * 0.9;
          gl_FragColor = vec4(max(col, vec3(0.0)), 1.0); }`,
    });
  }
  function haloMat(sunDir, col, ratio) {
    const lim = Math.sqrt(Math.max(1e-4, 1 - 1 / (ratio * ratio)));
    return new THREE.ShaderMaterial({
      uniforms: { uSun: { value: sunDir.clone() }, uC: { value: new THREE.Color(col) }, uLim: { value: lim } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform vec3 uSun, uC; uniform float uLim; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 N = normalize(vN); vec3 Vd = cameraPosition - vW; vec3 V = Vd / max(length(Vd), 1e-3); float d = clamp(abs(dot(N, V)) / max(uLim, 1e-3), 0.0, 1.0);
          float a = pow(d, 2.6) * smoothstep(-0.45, 0.55, dot(N, uSun)) * 0.75; gl_FragColor = vec4(uC * a, a); }`,
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
  }

  // ---------- the machine core ----------
  // dodecahedral shell split into 12 bevelled pentagon panels (each its own mesh, centred on its face)
  function shellPanels(R) {
    const src = new THREE.DodecahedronGeometry(R, 0), P = src.attributes.position, faces = new Map();
    const a = new V3(), b = new V3(), c = new V3(), n = new V3();
    for (let i = 0; i < P.count; i += 3) {
      a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2); n.subVectors(c, b).cross(new V3().subVectors(a, b)).normalize();
      if (n.dot(a) < 0) n.negate(); const key = n.toArray().map((v) => Math.round(v * 100)).join(',');
      if (!faces.has(key)) faces.set(key, { n: n.clone(), pts: [] }); const f = faces.get(key);
      for (const p of [a, b, c]) if (!f.pts.some((q) => q.distanceToSquared(p) < 1e-6)) f.pts.push(p.clone());
    }
    src.dispose(); const out = [];
    for (const f of faces.values()) {
      const cen = new V3(); f.pts.forEach((p) => cen.add(p)); cen.divideScalar(f.pts.length);
      const u = f.pts[0].clone().sub(cen).normalize(), w = new V3().crossVectors(f.n, u);
      f.pts.sort((p, q) => Math.atan2(p.clone().sub(cen).dot(w), p.clone().sub(cen).dot(u)) - Math.atan2(q.clone().sub(cen).dot(w), q.clone().sub(cen).dot(u)));
      const ring = (k, off) => f.pts.map((p) => p.clone().sub(cen).multiplyScalar(k).addScaledVector(f.n, off));
      const A = ring(0.72, 0), B = ring(0.8, -0.07), C = ring(0.8, -0.22), D = ring(0.62, -0.22);
      const outer = [], inner = [], inC = f.n.clone().multiplyScalar(-0.11);
      const tri = (arr, p, q, r, ref) => { const nn = new V3().subVectors(q, p).cross(new V3().subVectors(r, p)); if (nn.dot(ref) < 0) arr.push(p, r, q); else arr.push(p, q, r); };
      const ctr = new V3(), ctrIn = f.n.clone().multiplyScalar(-0.22), L = f.pts.length;
      for (let i = 0; i < L; i++) {
        const j = (i + 1) % L, mid = (p, q) => p.clone().add(q).multiplyScalar(0.5);
        tri(outer, ctr, A[i], A[j], f.n);
        const r1 = mid(A[i], B[j]).sub(inC); tri(outer, A[i], B[i], B[j], r1); tri(outer, A[i], B[j], A[j], r1);
        const r2 = mid(B[i], C[j]).sub(inC); tri(inner, B[i], C[i], C[j], r2); tri(inner, B[i], C[j], B[j], r2);
        tri(inner, C[i], D[i], D[j], f.n.clone().negate()); tri(inner, C[i], D[j], C[j], f.n.clone().negate()); tri(inner, ctrIn, D[j], D[i], f.n.clone().negate());
      }
      const g = new THREE.BufferGeometry(), all = outer.concat(inner), arr = new Float32Array(all.length * 3); all.forEach((p, i) => p.toArray(arr, i * 3));
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); g.computeVertexNormals(); g.addGroup(0, outer.length, 0); g.addGroup(outer.length, inner.length, 1);
      out.push({ geo: g, cen, n: f.n.clone() });
    }
    return out;
  }
  function bladeGeos() {
    const pts = [[0, -1.55], [0.4, -0.55], [0.34, 0.7], [0.1, 1.35], [0, 1.62], [-0.1, 1.35], [-0.34, 0.7], [-0.4, -0.55]];
    const shp = (k) => { const s = new THREE.Shape(); pts.forEach(([px, py], i) => (i ? s.lineTo(px * k, py * k) : s.moveTo(px * k, py * k))); s.closePath(); return s; };
    const body = new THREE.ExtrudeGeometry(shp(0.86), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1 }); body.center();
    const rim = shp(1.0); const hole = new THREE.Path(); pts.slice().reverse().forEach(([px, py], i) => (i ? hole.lineTo(px * 0.88, py * 0.88) : hole.moveTo(px * 0.88, py * 0.88))); hole.closePath(); rim.holes.push(hole);
    const edge = new THREE.ExtrudeGeometry(rim, { depth: 0.08, bevelEnabled: false }); edge.center();
    return { body, edge };
  }
  function gimbal(r, steel, trim, teethMat) {
    const gr = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.17, 4, 120), steel); band.castShadow = true; gr.add(band);
    const line = new THREE.Mesh(new THREE.TorusGeometry(r - 0.19, 0.03, 4, 120), trim); gr.add(line);
    const nT = Math.round(r * 18), teeth = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.14, 0.2), teethMat, nT), d = new THREE.Object3D(); let k = 0;
    for (let i = 0; i < nT; i++) { if (i % 9 === 0) continue; const a = i / nT * TAU; d.position.set(Math.cos(a) * (r + 0.2), Math.sin(a) * (r + 0.2), 0); d.rotation.set(0, 0, a); d.updateMatrix(); teeth.setMatrixAt(k++, d.matrix); }
    teeth.count = k; gr.add(teeth);
    for (let q = 0; q < 4; q++) {
      const a = q * PI / 2 + PI / 4, nd = new THREE.Group(); nd.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); nd.rotation.z = a;
      const blk = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.56), steel); nd.add(blk);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.66, 8), steel); cap.rotation.x = PI / 2; nd.add(cap);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.6), trim); lamp.position.x = 0.22; nd.add(lamp);
      gr.add(nd);
    }
    return gr;
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sunDir = new V3(-0.55, 0.3, -0.78).normalize();
    const sky = W.sky({ top: 0x010207, horizon: 0x050720, bottom: 0x010106, stars: 1.5, nebula: 0.6, nebulaA: 0x3a0e4c, nebulaB: 0x04364c, sunDir: sunDir.toArray(), sunColor: 0xfff0d8, sunSize: 0.06, sunGlow: 0.9 }); g.add(sky); S.sky = sky; W.env(sky, 0.6);
    S.hemi = W.hemi(g, 0x34448a, 0x0c0614, 0.5);
    S.sun = W.sun(g, { dir: sunDir.toArray(), color: 0xfff0e0, intensity: 2.2, size: 24 });
    // planet: lit shader with terminator + limb glow, an additive atmosphere shell, and a thin ring band with gaps
    const PR = 520, ppos = new V3(380, -560, -620);
    S.planetG = new THREE.Group(); S.planetG.position.copy(ppos); g.add(S.planetG); S.ppos = ppos.clone();
    const planet = new THREE.Mesh(new THREE.SphereGeometry(PR, 96, 48), planetMat(sunDir)); planet.rotation.set(0.3, 0.4, 0.25); S.planetG.add(planet); S.planet = planet;
    const atm = new THREE.Mesh(new THREE.SphereGeometry(PR * 1.045, 64, 32), haloMat(sunDir, 0xff9468, 1.045)); S.planetG.add(atm); S.atm = atm;
    const rc = document.createElement('canvas'); rc.width = 512; rc.height = 4; const rx = rc.getContext('2d');
    for (let i = 0; i < 512; i++) { const u = i / 512, a = W.fbm(u * 40, 2.2, 3, 4), fine = W.fbm(u * 160, 5.1, 7, 2), gap = (u > 0.36 && u < 0.41) || (u > 0.72 && u < 0.735) || u < 0.02 || u > 0.97 ? 0 : 1, edge = Math.min(1, u / 0.06, (1 - u) / 0.08); rx.fillStyle = `rgba(${190 + a * 55 | 0},${170 + a * 45 | 0},${145 + a * 40 | 0},${(0.06 + a * 0.38 + fine * 0.18) * gap * edge})`; rx.fillRect(i, 0, 1, 4); }
    const ringG = new THREE.RingGeometry(660, 1020, 160, 1); const uv = ringG.attributes.uv, pos = ringG.attributes.position; for (let i = 0; i < uv.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (r - 660) / 360, 0.5); }
    const rtex = new THREE.CanvasTexture(rc); rtex.colorSpace = THREE.SRGBColorSpace;
    const rings = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ map: rtex, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0xa8a2a0 })); rings.rotation.set(-PI / 2 + 0.38, 0.1, 0.2); S.planetG.add(rings);
    // gentle exponential fog in the phase hue (planet/sky shaders ignore it, so space stays deep)
    scene.fog = new THREE.FogExp2(0x070b1e, 0.0065); S.fog = scene.fog;
    // station under-structure: a hub under the arena, eight spokes out to a separate orbital ring that slowly turns; open space shows between
    const hull = W.surface('metal', { size: 256, dark: 0x07090e, light: 0x2c3440, strength: 2 }); for (const k in hull) hull[k].repeat.set(4, 4);
    const hm = dress(new THREE.MeshStandardMaterial({ map: hull.map, normalMap: hull.normalMap, metalness: 0.6, roughness: 0.6, envMapIntensity: 0.7 }), { rim: 0.8, haze: 0.6 });
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 7, 12), hm); spine.position.y = -4.3; g.add(spine);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 1.4, 4, 12), hm); hub.position.y = -9.5; g.add(hub);
    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.12, 4, 48), null); // material set below (conduit)
    S.conduitU = { uC: { value: new THREE.Color(CY) }, uA: { value: 0.9 } };
    // additive strips that fade toward both ends (u across, v along)
    const fadeMat = (U, k = 1) => new THREE.ShaderMaterial({ uniforms: { uC: U.uC, uA: U.uA, uK: { value: k } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uA, uK; varying vec2 vUv; void main(){ float x=(vUv.x-0.5)*2.0; float a=exp(-x*x*4.0); float t=pow(clamp(sin(vUv.y*3.14159),0.0,1.0),0.7); float c=exp(-x*x*40.0); gl_FragColor=vec4(max(uC*(a*0.5+c)*t*uA*uK,vec3(0.0)),1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const arcMat = (U) => new THREE.ShaderMaterial({ uniforms: { uC: U.uC, uA: U.uA }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float t=pow(clamp(sin(vUv.x*3.14159),0.0,1.0),1.5); gl_FragColor=vec4(max(uC*t*uA*0.8,vec3(0.0)),1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    S.conduit = arcMat(S.conduitU); hubRing.material = S.conduit; hubRing.rotation.x = PI / 2; hubRing.position.y = -7.6; g.add(hubRing);
    const stripG = new THREE.PlaneGeometry(0.9, 22); stripG.rotateX(-PI / 2); const stripM = fadeMat(S.conduitU);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + PI / 8, arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 26), hm); arm.position.set(Math.sin(a) * 16.8, -8.4, Math.cos(a) * 16.8); arm.rotation.y = a; g.add(arm);
      const st = new THREE.Mesh(stripG, stripM); st.position.set(Math.sin(a) * 15.5, -8.06, Math.cos(a) * 15.5); st.rotation.y = a; g.add(st);
    }
    S.orbit = new THREE.Group(); S.orbit.position.y = -9; g.add(S.orbit);
    const oring = new THREE.Mesh(new THREE.TorusGeometry(29.7, 0.75, 8, 180), hm); oring.rotation.x = PI / 2; S.orbit.add(oring);
    const modN = 28, mods = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 1.6, 1.9), hm, modN), dm = new THREE.Object3D();
    for (let i = 0; i < modN; i++) { const a = i / modN * TAU; dm.position.set(Math.sin(a) * 29.7, (i % 2) * 0.3, Math.cos(a) * 29.7); dm.rotation.set(0, a, 0); dm.scale.set(1, 1, i % 3 === 0 ? 1.6 : 1); dm.updateMatrix(); mods.setMatrixAt(i, dm.matrix); }
    mods.frustumCulled = false; S.orbit.add(mods);
    for (let i = 0; i < 7; i++) { const arc = new THREE.Mesh(new THREE.TorusGeometry(33 + (i % 3) * 1.6, 0.09, 4, 40, 0.5 + (i % 3) * 0.25), S.conduit); arc.rotation.set(PI / 2, 0, i / 7 * TAU); arc.position.y = (i % 2) * 0.6 - 0.4; S.orbit.add(arc); }
    // towers: open lattice masts (one instanced draw for every strut) with running lights
    const twm = dress(new THREE.MeshStandardMaterial({ color: 0x3a4250, metalness: 0.85, roughness: 0.4, envMapIntensity: 0.9 }), { rim: 1.0, haze: 0.8 });
    const struts = [], strut = (ax, ay, az, bx, by, bz, w) => struts.push([ax, ay, az, bx, by, bz, w]);
    const lightsN = 4 * 2 * 8, runL = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), lightsN), dd = new THREE.Object3D(), lc = new THREE.Color(); let li = 0;
    S.beacons = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = sx * 21, tz = sz * 21, hw = 0.8, y0 = -10, lv = 10, dy = 2.6, C4 = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
      for (const [cx, cz] of C4) strut(tx + cx, y0, tz + cz, tx + cx, y0 + lv * dy, tz + cz, 0.2);
      for (let l = 0; l < lv; l++) for (let k = 0; k < 4; k++) { const [ax, az] = C4[k], [bx, bz] = C4[(k + 1) % 4], y = y0 + l * dy; strut(tx + ax, y, tz + az, tx + bx, y, tz + bz, 0.1); strut(tx + ax, y, tz + az, tx + bx, y + dy, tz + bz, 0.07); }
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.5, lv * dy, 0.5), twm); core.position.set(tx, y0 + lv * dy / 2, tz); g.add(core);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.3, 1.2, 6), twm); cap.position.set(tx, 16.6, tz); g.add(cap);
      const bc = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), W.glow(0xff3020, 3, { fog: false })); bc.position.set(tx, 17.5, tz); g.add(bc); S.beacons.push(bc);
      for (let s = 0; s < 2; s++) for (let k = 0; k < 8; k++) { const [cx, cz] = C4[s * 2]; dd.position.set(tx + cx * 1.15, -6 + k * 2.6, tz + cz * 1.15); dd.updateMatrix(); runL.setMatrixAt(li, dd.matrix); runL.setColorAt(li, lc.setHex(k % 3 === 2 ? 0xff4028 : 0x40c8ff).multiplyScalar(k % 3 === 2 ? 2.2 : 1.6)); li++; }
    }
    // solar vanes: framed cell arrays on a truss boom
    const pc = document.createElement('canvas'); pc.width = 256; pc.height = 128; const px = pc.getContext('2d'); px.fillStyle = '#0b1530'; px.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 6; j++) { const gr = px.createLinearGradient(i * 16, j * 21, i * 16 + 14, j * 21 + 19); gr.addColorStop(0, `rgb(${30 + (i * 7 + j * 3) % 12},${44 + (i * 5 + j) % 14},${92 + (i * 3 + j * 7) % 24})`); gr.addColorStop(1, '#0a1228'); px.fillStyle = gr; px.fillRect(i * 16 + 1, j * 21 + 1, 14, 19); }
    const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
    const pec = document.createElement('canvas'); pec.width = 256; pec.height = 128; const pex = pec.getContext('2d'); pex.fillStyle = '#000'; pex.fillRect(0, 0, 256, 128); pex.fillStyle = '#304880'; for (let i = 0; i <= 16; i++) pex.fillRect(i * 16 - 1, 0, 1, 128); for (let j = 0; j <= 6; j++) pex.fillRect(0, j * 21 - 1, 256, 1);
    const pmat = dress(new THREE.MeshStandardMaterial({ map: ptex, metalness: 0.9, roughness: 0.18, emissive: 0x3060c0, emissiveMap: new THREE.CanvasTexture(pec), emissiveIntensity: 0.6, envMapIntensity: 1.4 }), { rim: 0.5, haze: 0.8 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const vg = new THREE.Group(); vg.position.set(sx * 32, 4, sz * 21); vg.rotation.z = sx * 0.4; g.add(vg);
      for (const oz of [-1.65, 1.65]) { const pan = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 3.0), [twm, twm, pmat, twm, twm, twm]); pan.position.z = oz; vg.add(pan); }
      for (const [w, h, d, x, y, z] of [[14.2, 0.2, 0.2, 0, 0, -3.2], [14.2, 0.2, 0.2, 0, 0, 3.2], [14.2, 0.2, 0.26, 0, 0, 0], [0.2, 0.2, 6.6, -7.1, 0, 0], [0.2, 0.2, 6.6, 7.1, 0, 0]]) { const fr = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), twm); fr.position.set(x, y, z); vg.add(fr); }
      const p0 = new V3(sx * 25, 3.0, sz * 21), p1 = new V3(sx * 21, 2.0, sz * 21);
      for (const dzz of [-0.3, 0.3]) strut(p1.x, p1.y + 0.6, p1.z + dzz, p0.x, p0.y + 0.6, p0.z + dzz, 0.12);
      for (let k = 0; k < 4; k++) { const t0 = k / 4, t1 = (k + 1) / 4; strut(lerp(p1.x, p0.x, t0), p1.y + 0.6, p1.z - 0.3, lerp(p1.x, p0.x, t1), p1.y + 0.6, p1.z + 0.3, 0.06); }
    }
    { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), twm, struts.length), d = new THREE.Object3D(), A = new V3(), B = new V3();
      struts.forEach(([ax, ay, az, bx, by, bz, w], i) => { A.set(ax, ay, az); B.set(bx, by, bz); d.position.copy(A).add(B).multiplyScalar(0.5); d.scale.set(w, w, Math.max(0.01, A.distanceTo(B))); d.lookAt(B); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
      im.frustumCulled = false; g.add(im); }
    runL.frustumCulled = false; g.add(runL);
    // phase debris: tile fragments tumbling away under the arena (count grows with the phase)
    S.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.16, 0.7), new THREE.MeshStandardMaterial({ color: 0x1a1f2a, metalness: 0.8, roughness: 0.5, emissive: 0x2a3a80, emissiveIntensity: 0.6 }), 40);
    S.debris.frustumCulled = false; S.debris.count = 0; g.add(S.debris); S.deb = []; for (let i = 0; i < 40; i++) S.deb.push({ x: 0, y: -200, z: 0, vy: 0, rx: 0, ry: 0, sr: 0, s: 1 });
    // tiles
    const texs = [0, 1, 2, 3].map(tileTex), stex = sideTex(), tgeo = tileGeo(); S.tiles = []; S.tileT = { value: 0 };
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const hsh = W.hash2(ix, iz, 41), vi = ix === 3 && iz === 3 ? 3 : Math.floor(W.hash2(ix, iz, 17) * 4) % 4;
      const { m: mat, U } = tileMat(S.tileT, texs[vi], (ix * 0.37 + iz * 0.61) % 1);
      mat.color.setHSL(0.6 + (hsh - 0.5) * 0.06, 0.12 + hsh * 0.1, 0.55 + (W.hash2(ix, iz, 5) - 0.5) * 0.18); mat.roughness = 0.85 + W.hash2(ix, iz, 9) * 0.3;
      const sideMat = new THREE.MeshStandardMaterial({ color: 0x0c1018, metalness: 0.8, roughness: 0.5, emissive: IDLE, emissiveMap: stex, emissiveIntensity: 1, envMapIntensity: 0.6 });
      const m = new THREE.Mesh(tgeo, [mat, sideMat]); m.position.set(-HALF + TS * (ix + 0.5), TY, -HALF + TS * (iz + 0.5)); m.receiveShadow = true; g.add(m);
      S.tiles.push({ m, mat, sideMat, U, ix, iz, x: m.position.x, z: m.position.z, present: true, col: 0, warn: 0, back: 0, y: TY, flash: 0, cur: new THREE.Color(IDLE), rx: 0, rz: 0, sx: 0, sz: 0 });
    }
    S.motes = W.motes({ n: 400, box: [70, 40, 70], color: 0x9fd0ff, size: 0.08, vel: [0.1, 0.06, 0.05], sway: 0.4, center: [0, 8, 0] }); g.add(S.motes);
    // ---- the core ----
    const bg = b.group; S.rig = new THREE.Group(); S.rig.position.y = 4.2; bg.add(S.rig);
    // heart: faceted crystal + a three-axis star of light + two thin orbit lines, all kept under ~3x so bloom shapes rather than clips
    S.coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); S.heart = new THREE.Group(); S.rig.add(S.heart);
    S.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), S.coreMat); S.heart.add(S.core);
    S.spikeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const spG = new THREE.OctahedronGeometry(1, 0); for (const r of [[0, 0, 0], [PI / 2, 0, 0], [0, 0, PI / 2]]) { const sp = new THREE.Mesh(spG, S.spikeMat); sp.scale.set(0.09, 1.25, 0.09); sp.rotation.set(...r); S.heart.add(sp); }
    S.orbitL = []; for (let i = 0; i < 2; i++) { const o = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.02, 4, 48), S.spikeMat); o.rotation.set(i ? 1.1 : -0.4, i ? 0.5 : 0.9, 0); S.heart.add(o); S.orbitL.push(o); }
    S.haloMat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0x80c0ff) }, uA: { value: 1 } }, vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }', fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4); vec3 v=vV/max(length(vV),1e-4); float f=clamp(abs(dot(n,v)),0.0,1.0); float a=pow(f,4.0)*uA*0.45; gl_FragColor=vec4(uC*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    S.halo = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), S.haloMat); S.rig.add(S.halo);
    S.coreL = new THREE.PointLight(0x80c0ff, 60, 40, 1.8); S.coreL.castShadow = false; S.rig.add(S.coreL);
    const steel = dress(new THREE.MeshStandardMaterial({ color: 0x3a4456, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.2, flatShading: true }), { rim: 0.9 });
    S.trim = new THREE.MeshStandardMaterial({ color: 0x05070a, emissive: CY, emissiveIntensity: 2.2 });
    S.gapMat = new THREE.MeshStandardMaterial({ color: 0x080a10, metalness: 0.5, roughness: 0.5, emissive: 0x80c0ff, emissiveIntensity: 0.9 });
    S.panels = []; for (const p of shellPanels(1.6)) { const m = new THREE.Mesh(p.geo, [steel, S.gapMat]); m.position.copy(p.cen); m.castShadow = true; S.rig.add(m); S.panels.push({ m, cen: p.cen, n: p.n, ph: vrand() * TAU }); }
    S.gyro = []; for (let i = 0; i < 5; i++) { const gr = gimbal(2.5 + i * 0.6, steel, S.trim, steel); S.rig.add(gr); S.gyro.push(gr); if (i >= 3) gr.scale.setScalar(0.001); }
    S.arcV = [new V3(), new V3()];
    // fins: bevelled blades with an emissive edge inlay (two instanced draws for all twelve)
    const bl = bladeGeos(); S.finBody = new THREE.InstancedMesh(bl.body, dress(new THREE.MeshStandardMaterial({ color: 0x2c3442, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.2, flatShading: true }), { rim: 0.9 }), 12); S.finEdge = new THREE.InstancedMesh(bl.edge, S.trim.clone(), 12); S.finTrim = S.finEdge.material;
    for (const fm of [S.finBody, S.finEdge]) { fm.geometry.boundingSphere = new THREE.Sphere(new V3(), 6.5); fm.userData.fadeOcclude = true; fm.userData.fadeMin = 0.1; } S.finBody.castShadow = true; S.finBody.frustumCulled = S.finEdge.frustumCulled = false; S.rig.add(S.finBody, S.finEdge);
    S.shards = []; for (let i = 0; i < 12; i++) S.shards.push({ a: i / 12 * TAU, e: (i % 3 - 1) * 0.75, sp: 0.4 + (i % 4) * 0.12 }); S.dummy = new THREE.Object3D();
    // light pool: a soft additive disc on the floor in the core's colour, so the arena picks up the boss
    S.poolU = { uC: { value: new THREE.Color(0x80c0ff) }, uA: { value: 0.22 } };
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.ShaderMaterial({ uniforms: S.poolU, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ vec2 q=(vUv-0.5)*2.0; float r2=dot(q,q); float a=(exp(-r2*5.0)*0.8+exp(-r2*1.6)*0.35)*(1.0-smoothstep(0.85,1.0,sqrt(min(r2,1.0))))*uA; gl_FragColor=vec4(max(uC*a,vec3(0.0)),1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pool.rotation.x = -PI / 2; pool.position.y = 0.025; pool.renderOrder = 1; g.add(pool);
    // pedestal
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.7, 1.4, 8), steel); ped.position.y = 0.4; bg.add(ped);
    const pedR = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 4, 32), S.trim); pedR.rotation.x = PI / 2; pedR.position.y = 1.12; bg.add(pedR);
    // lasers: a hot thin core inside crossed gaussian glow sheets, plus a scorch line on the floor
    S.laserG = new THREE.Group(); S.laserG.position.y = 1.15; g.add(S.laserG); S.lasers = [];
    const glowVS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
    const glowFS = 'uniform vec3 uC; uniform float uA, uK; varying vec2 vUv; void main(){ float x=(vUv.x-0.5)*2.0; float t=smoothstep(0.0,0.05,vUv.y)*smoothstep(1.0,0.8,vUv.y); float a=exp(-x*x*uK)*uA*t; float c=exp(-x*x*180.0)*uA*t; gl_FragColor=vec4(max(uC*a+vec3(1.0,0.85,0.7)*c*0.9,vec3(0.0)),1.0); }';
    const sheetV = new THREE.PlaneGeometry(1.6, 26), sheetH = new THREE.PlaneGeometry(1.6, 26), floorG = new THREE.PlaneGeometry(1.9, 26);
    sheetV.rotateX(-PI / 2); sheetV.rotateZ(PI / 2); sheetH.rotateX(-PI / 2); floorG.rotateX(-PI / 2);
    for (let i = 0; i < 4; i++) {
      const grp = new THREE.Group(), beam = new THREE.Group(); grp.add(beam);
      const gU = { uC: { value: new THREE.Color(0xff4020) }, uA: { value: 1 }, uK: { value: 9 } }, fU = { uC: { value: new THREE.Color(0xff4020) }, uA: { value: 0.4 }, uK: { value: 5 } };
      const gm = new THREE.ShaderMaterial({ uniforms: gU, vertexShader: glowVS, fragmentShader: glowFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const fm = new THREE.ShaderMaterial({ uniforms: fU, vertexShader: glowVS, fragmentShader: glowFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      for (const sg of [sheetV, sheetH]) { const s = new THREE.Mesh(sg, gm); s.position.z = 15; beam.add(s); }
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); const core = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 26), mat); core.position.z = 15; beam.add(core);
      const fl = new THREE.Mesh(floorG, fm); fl.position.set(0, -1.13, 15); grp.add(fl);
      grp.visible = false; S.laserG.add(grp); S.lasers.push({ grp, beam, mat, gU, fU, cd: 0 });
    }
    S.sweep = null; S.pol = null; S.coreCol = 0; S.open = 0; S.spin = 1; S.tethers = []; S.dangerCol = 0; S.heat = 0;
    const present = (x, z) => { const i = tIdx(x, z); return i >= 0 && S.tiles[i].present; };
    return {
      edge: 'fall', spawn: { x: 0, z: 11 }, bossStart: { x: 0, z: 0, face: 0 },
      contains: (x, z) => present(x, z) || present(x + 0.45, z) || present(x - 0.45, z) || present(x, z + 0.45) || present(x, z - 0.45),
      solid(p) { const d = Math.hypot(p.x, p.z); if (d < 2.3 && d > 0.001) { p.x *= 2.3 / d; p.z *= 2.3 / d; } },
      bulletBounds: (x, z) => Math.abs(x) < 30 && Math.abs(z) < 30,
    };
  }

  // ---- mechanics ----
  const colOfCore = (S) => S.dangerCol;
  function setCore(b, c, snap) { const S = b.state; S.dangerCol = c; if (snap) Sound.sfx('tick', 1.5, c === 1 ? 1.4 : 0.7); FX.dome(0, 4.2, 0, { r: 4.5, color: c === 1 ? CY : c === 2 ? MG : 0x80c0ff, dur: 0.35 }); }
  function* polarize(b, o = {}) {
    const S = b.state, pat = pick(PATTERNS), inv = rnd() < 0.5 ? 1 : 0, time = o.time || 3.6, flips = o.flips || 0;
    for (const t of S.tiles) t.col = t.present && !(t.ix === 3 && t.iz === 3) ? ((pat(t.ix, t.iz) ^ inv) ? 1 : 2) : 0;
    let col = rndi(1, 2); setCore(b, col, true); Sound.sfx('charge', 0.8);
    const flipAt = []; for (let i = 0; i < flips; i++) flipAt.push(time * (0.45 + 0.28 * i) + rnd(-0.1, 0.1));
    S.pol = { t: time };
    yield* b.cast({ name: 'Polarize', time, onTick: (k, cs) => { S.pol.t = time - cs.t; if (flipAt.length && cs.t >= flipAt[0]) { flipAt.shift(); col = 3 - col; setCore(b, col, true); FX.flash(col === 1 ? CY : MG, 0.08, 6); } } });
    S.pol = null; const p = G.player, hex = col === 1 ? CY : MG; let n = 0;
    for (const t of S.tiles) { if (t.col === col) { t.flash = 1; if (!G.headless && (n++ % 2 === 0 || Math.hypot(t.x - p.pos.x, t.z - p.pos.z) < 7)) FX.pillar(t.x, t.z, { r: 1.9, h: 9, color: hex, dur: 0.45, mult: 1.2 }); FX.burst(t.x, 0.2, t.z, { n: 5, color: hex, speed: [1, 4], up: 6, life: [0.3, 0.8], radius: 1.8 }); } }
    Sound.sfx('zap'); Sound.sfx('boom', 0.8); FX.shake(0.5); FX.flash(hex, 0.1, 5);
    const ti = tIdx(p.pos.x, p.pos.z); if (p.alive && ti >= 0 && S.tiles[ti].col === col) p.hurt(380, { blockable: true, src: { name: 'Polarize' } });
    for (const t of S.tiles) t.col = 0; setCore(b, 0); yield 0.9;
  }
  function* sweep(b, n, dur, w, o = {}) {
    const S = b.state, a0 = b.angToPlayer() + PI / n + rnd(-0.2, 0.2), dir = rnd() < 0.5 ? 1 : -1;
    const sw = S.sweep = { n, a: a0, w: 0, tw: w * dir, arm: 1.3, t: dur, len: 24, rev: o.reverse ? dur * rnd(0.4, 0.6) : -1, warn: 0 };
    for (let i = 0; i < 4; i++) S.lasers[i].grp.visible = i < n;
    Sound.sfx('charge'); yield 1.3; Sound.sfx('laser'); sw.w = sw.tw;
    if (o.wait === false) return; yield dur + 0.3;
  }
  function* lance(b, n = 1) {
    for (let i = 0; i < n; i++) {
      const h = Hz.rect(0, 0, b.angToPlayer(), 26, 2.3, 1.75, 400, { name: 'Lance', color: 0xffe0a0, lock: 0.55, quiet: true, track: (s) => { s.dir = dampAng(s.dir, angTo(0, 0, G.player.pos.x, G.player.pos.z), 9, G.dt); }, onFire: (hh) => { const d = hh.shape.dir; FX.beam(new V3(0, 4.2, 0), new V3(Math.sin(d) * 26, 1, Math.cos(d) * 26), { color: 0xffc070, width: 0.6, dur: 0.4, mult: 1.6 }); FX.beam(new V3(0, 4.2, 0), new V3(Math.sin(d) * 26, 1, Math.cos(d) * 26), { color: 0xfff0d8, width: 0.14, dur: 0.3, mult: 1.4 }); Sound.sfx('laser', 1, 0.7); FX.shake(0.45); for (let k = 3; k < 26; k += 3) FX.burst(Math.sin(d) * k, 0.4, Math.cos(d) * k, { n: 5, color: 0xffe0a0, speed: [1, 5], up: 3, life: [0.3, 0.7] }); } });
      b.state.heat = 1; yield 1.75 + 0.45; void h;
    }
    yield 0.4;
  }
  function dropTiles(b, list, o = {}) { const S = b.state; for (const i of list) { const t = S.tiles[i]; if (!t.present || t.warn > 0) continue; t.warn = o.warn || 2.6; t.back = o.back || 0; } Sound.sfx('warn', 1.5, 0.5); }
  function* purge(b, n, back = 12) {
    const S = b.state, p = G.player; yield* b.cast({ name: 'Purge', time: 0.8 });
    const cand = S.tiles.filter((t) => t.present && t.warn <= 0 && !(t.ix === 3 && t.iz === 3)); const pi = tIdx(p.pos.x, p.pos.z); const list = [];
    if (pi >= 0 && S.tiles[pi].present && pi !== 24) list.push(pi);
    for (const t of shuffle(cand)) { if (list.length >= n) break; const i = t.iz * N + t.ix; if (!list.includes(i)) list.push(i); }
    dropTiles(b, list, { back }); yield 1.2;
  }
  function droneMesh() {
    const g = new THREE.Group(), st = dress(new THREE.MeshStandardMaterial({ color: 0x3a4252, metalness: 0.9, roughness: 0.32, flatShading: true, envMapIntensity: 1.2 }), { rim: 1.1 });
    const amber = new THREE.MeshStandardMaterial({ color: 0x0a0604, emissive: 0xffb030, emissiveIntensity: 1.6, side: THREE.DoubleSide });
    // spindle hull
    const hullPts = [[0, -0.95], [0.22, -0.78], [0.4, -0.38], [0.46, 0], [0.4, 0.34], [0.24, 0.66], [0.08, 0.86], [0, 0.9]].map(([x, y]) => new THREE.Vector2(x, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(hullPts, 8), st); body.position.y = 1.5; g.add(body);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.035, 4, 24), amber); band.rotation.x = PI / 2; band.position.y = 1.5; g.add(band);
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), W.glow(0xffc050, 2.4)); eye.position.set(0, 1.62, 0.42); g.add(eye);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7, 4), st); fin.position.y = 2.55; g.add(fin);
    // shield petals: four curved plates on a sphere shell with an amber lip, spinning slowly around the hull
    const petals = new THREE.Group(); petals.position.y = 1.5; g.add(petals);
    const pg = new THREE.SphereGeometry(1.0, 8, 6, 0, PI / 2 * 0.72, PI * 0.28, PI * 0.44), lip = new THREE.TorusGeometry(1.0, 0.035, 4, 10, PI / 2 * 0.72);
    for (let k = 0; k < 4; k++) {
      const pe = new THREE.Group(); pe.rotation.y = k * PI / 2; petals.add(pe);
      const plate = new THREE.Mesh(pg, st); plate.material.side = THREE.DoubleSide; pe.add(plate);
      for (const yy of [-0.637, 0.637]) { const l = new THREE.Mesh(lip, amber); l.rotation.x = PI / 2; l.position.y = yy; l.scale.set(-0.77, 0.77, 0.77); pe.add(l); }
    }
    g.userData.ring = petals;
    const L = new THREE.PointLight(0xffb030, 6, 8, 1.6); L.position.y = 1.6; g.add(L); return g;
  }
  function spawnDrones(b, n) {
    n -= G.ents.filter((q) => q.isAdd && q.alive && q.name === 'Aegis Drone').length; if (n <= 0) return; // never stack past the intended count
    const S = b.state, spots = shuffle(S.tiles.filter((t) => t.present && t.warn <= 0 && Math.max(Math.abs(t.ix - 3), Math.abs(t.iz - 3)) === 2)).slice(0, n);
    b.immune = true; Sound.sfx('shield', 1, 0.5);
    for (const t of spots) {
      FX.pillar(t.x, t.z, { r: 1.2, h: 14, color: 0xffb030, dur: 0.7 });
      const a = b.spawnAdd({ name: 'Aegis Drone', hp: 600, x: t.x, z: t.z, radius: 0.9, aimY: 1.5, mesh: droneMesh(), color: 0xffb030,
        update(e) { e.pos.y = 0.3 + Math.sin(G.now * 3 + e.pos.x) * 0.15; e.group.children[0].userData.ring.rotation.y += G.dt * 1.4; },
        *run(e) { yield 2; while (e.alive) { const p = G.player; Bul.fire({ x: e.pos.x, z: e.pos.z, y: 1.5, dir: angTo(e.pos.x, e.pos.z, p.pos.x, p.pos.z), speed: 5.5, turn: 0.55, dmg: 110, color: 0xffb030, r: 0.45, life: 6, tag: 'fight' }); Sound.sfx('bolt', 0.4, 0.5); yield 4.6; } },
        onDeath() { if (!G.ents.some((q) => q.isAdd && q.alive && q.name === 'Aegis Drone')) { b.immune = false; Sound.sfx('shatter'); FX.dome(0, 4.2, 0, { r: 7, color: 0xffb030, dur: 0.6 }); } } });
      S.tethers.push(a);
    }
  }
  const dronesAlive = () => G.ents.some((q) => q.isAdd && q.alive);
  function* overclock(b, arms = 3, dur = 7) {
    const S = b.state; const r = yield* b.cast({ name: 'Overclock', time: 3.0, interruptible: true, onTick: (k) => { S.heat = k; } });
    if (r !== 'done') { S.heat = 0; yield 1.5; return; }
    Sound.sfx('roar', 0.7, 2.4); let t = 0, a0 = rnd(TAU); const sg = rnd() < 0.5 ? 1 : -1;
    while (t < dur) { for (let k = 0; k < arms; k++) { const a = a0 + k / arms * TAU; Bul.fire({ x: Math.sin(a) * 2.4, z: Math.cos(a) * 2.4, dir: a, speed: 7, dmg: 95, color: 0xffb030, r: 0.4, life: 4.5 }); } a0 += sg * 0.21; t += 0.13; S.heat = 1; yield 0.13; }
    S.heat = 0; yield 0.6;
  }
  function* supernova(b, waves = 4) {
    const S = b.state; yield* b.cast({ name: 'Supernova', time: 1.4, onTick: (k) => { S.heat = k; } });
    for (let w = 0; w < waves; w++) { const gap = b.angToPlayer() + rnd(-1.6, 1.6), gap2 = gap + PI + rnd(-0.6, 0.6); for (let i = 0; i < 44; i++) { const a = i / 44 * TAU; if (Math.abs(angDiff(a, gap)) < 0.3 || Math.abs(angDiff(a, gap2)) < 0.3) continue; Bul.fire({ x: Math.sin(a) * 2.4, z: Math.cos(a) * 2.4, dir: a, speed: 6.4, dmg: 100, color: w % 2 ? MG : CY, r: 0.4, life: 5 }); } FX.ring(0, 0, { r1: 9, color: w % 2 ? MG : CY, dur: 0.4, mult: 0.6, width: 0.06 }); Sound.sfx('zap', 0.7, 0.6 + w * 0.1); FX.shake(0.3); yield 1.25; }
    S.heat = 0; yield 0.6;
  }
  function* eclipse(b, lvl, dur = 3) {
    const S = b.state, U = S.sky.material.uniforms; const i0 = S.sun.intensity, i1 = [2.2, 1.0, 1.3][lvl], n0 = U.uNeb.value, n1 = [0.6, 0.72, 0.9][lvl], h0 = S.hemi.intensity, h1 = [0.5, 0.32, 0.42][lvl], g0 = U.uSunGlow.value, g1 = [0.9, 0.3, 0.6][lvl], c0 = U.uSunCol.value.clone(), c1 = new THREE.Color([0xfff0d8, 0xff7038, 0xc8b0ff][lvl]);
    const hs0 = S.hemi.color.clone(), hs1 = new THREE.Color([0x34448a, 0x6a3a40, 0x4a3a90][lvl]), f0 = S.fog.color.clone(), f1 = new THREE.Color([0x070b1e, 0x140810, 0x0e0a24][lvl]), pz0 = S.planetG.position.clone(), pz1 = S.ppos.clone().multiplyScalar([1, 0.96, 0.86][lvl]), sc0 = S.planetG.scale.x, sc1 = [1, 1.03, 1.1][lvl];
    const r0 = RIM.uRim.value.clone(), r1 = new THREE.Color(RIM_COL[lvl]), z0 = RIM.uHazeC.value.clone(), z1 = new THREE.Color(HAZE_COL[lvl]);
    const apply = (k) => { S.sun.intensity = lerp(i0, i1, k); U.uNeb.value = lerp(n0, n1, k); S.hemi.intensity = lerp(h0, h1, k); U.uSunGlow.value = lerp(g0, g1, k); W.colorLerp(U.uSunCol.value, c0, c1, k); S.sun.color.copy(U.uSunCol.value); W.colorLerp(RIM.uRim.value, r0, r1, k); W.colorLerp(RIM.uHazeC.value, z0, z1, k); W.colorLerp(S.hemi.color, hs0, hs1, k); W.colorLerp(S.fog.color, f0, f1, k); S.planetG.position.lerpVectors(pz0, pz1, k); S.planetG.scale.setScalar(lerp(sc0, sc1, k)); S.open = lerp(S.open, lvl * 0.5, k * 0.2); };
    if (dur > 0) yield* W.tween(dur, apply); else apply(1);
    S.open = lvl * 0.5;
  }
  // a phase started directly (skipping earlier enters) still shows the full escalation of the phases before it
  function skipLook(b, lvl) {
    const S = b.state, it = eclipse(b, lvl, 0); while (!it.next().done);
    S.conduitU.uC.value.setHex([CY, 0xff6030, 0xb080ff][lvl]); S.trim.emissive.setHex([CY, 0xff7a30, 0xd0a0ff][lvl]);
    Post.set(Object.assign({}, b.def.post, [{}, { bloom: 0.58, tint: [1.04, 0.98, 1.0] }, { bloom: 0.62, threshold: 0.9, tint: [1.0, 0.97, 1.07], exposure: 1.0 }][lvl]));
  }
  const dropNow = (S, list) => { for (const i of list) { const q = S.tiles[i]; if (!q.present) continue; q.present = false; q.warn = 0; q.col = 0; q.y = -60; q.backT = 0; } };

  G.bosses.push({
    id: 'engine', name: 'PARALLAX', title: 'The Astral Engine', hint: 'A machine', color: '#20d8ff', telegraph: 0xffb030,
    hp: 22000, radius: 2.2, aimY: 4.2, enrage: 420,
    post: { bloom: 0.5, threshold: 0.92, radius: 0.45, exposure: 1.0, vig: 1.05, sat: 1.12, contrast: 1.12, tint: [0.97, 1.0, 1.06] },
    music: { bpm: 122, root: 41, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 3, 5, 0, 0, 6, 4],
      layers: [
        { v: 'pulse', pat: '0.0.0.0.0.0.0.0.', oct: 0, len: 1, vol: 0.09 }, { v: 'pad', pat: '0...............', oct: 2, len: 16, vol: 0.09 }, { v: 'kick', pat: 'x...x...x...x...', vol: 0.3 },
        { v: 'hat', from: 1, pat: '..x...x...x...x.', vol: 0.14 }, { v: 'arp', from: 1, pat: '0.4.7.4.0.4.7.9.', oct: 2, len: 1, vol: 0.07 }, { v: 'snare', from: 1, pat: '....x.......x...', vol: 0.2 },
        { v: 'bass', from: 1, pat: '0..0..0.0..0..0.', oct: 0, len: 2, vol: 0.14 },
        { v: 'lead', from: 2, pat: ['0...4...7..6.4..', '2...4...9..7.4..'], oct: 2, len: 3, vol: 0.06 }, { v: 'hat', from: 2, pat: 'xxxxxxxxxxxxxxxx', vol: 0.07 }, { v: 'arp', from: 2, pat: '0479047904790479', oct: 3, len: 1, vol: 0.05 },
      ] },
    build,
    *intro(b) { yield* Cam.shot([26, 14, 26], [0, 2, 0], [10, 5, 15], [0, 4, 0], 4.4, 50); },
    phases: [
      { at: 1, *run(b) {
        yield 1;
        while (true) { yield* polarize(b); yield* lance(b); yield* sweep(b, 2, 10, 0.5); yield* overclock(b); yield* polarize(b); yield* lance(b, 2); yield* sweep(b, 2, 9, 0.55, { reverse: true }); }
      } },
      { at: 0.68, skipTo(b) { skipLook(b, 1); }, *enter(b) {
        const S = b.state; S.sweep = null; Sound.sfx('roar', 0.8, 2); FX.flash(0xff6030, 0.3, 1.5); FX.shake(0.7); Co.start(eclipse(b, 1), 'fight'); Co.start(Post.lerpTo({ bloom: 0.58, tint: [1.04, 0.98, 1.0] }, 3), 'fight');
        dropTiles(b, [0, 6, 42, 48, 3, 21, 27, 45], { warn: 3.2 }); S.conduitU.uC.value.setHex(0xff6030); S.trim.emissive.setHex(0xff7a30); yield 3.6;
      }, *run(b) {
        while (true) {
          spawnDrones(b, 2); Co.start(sweep(b, 2, 14, 0.42, { wait: false }), 'phase'); { let w = 0; while (dronesAlive() && w < 26) { w += G.dt; yield; } } yield 0.8;
          yield* polarize(b, { flips: 1 }); yield* purge(b, 3); yield* lance(b, 2); yield* overclock(b, 3);
          Co.start(sweep(b, 3, 12, 0.5, { wait: false, reverse: true }), 'phase'); yield 2.5; yield* polarize(b, { flips: 1, time: 4 }); yield 4.5; yield* purge(b, 3); yield* lance(b);
        }
      } },
      { at: 0.35, skipTo(b) { skipLook(b, 2); dropNow(b.state, [0, 6, 42, 48, 3, 21, 27, 45]); }, *enter(b) {
        const S = b.state; S.sweep = null; for (const e of G.ents) if (e.isAdd) e.die(); b.immune = true;
        yield* b.cast({ name: 'Critical Mass', time: 2.6, onTick: (k) => { S.heat = k; FX.shake(k * 0.5); } });
        Sound.sfx('bigboom'); Sound.sfx('shatter'); FX.flash(0xd8c8ff, 0.4, 1.6); FX.shake(1.3); FX.explode(0, 4.2, 0, 0xb080ff, 9, 0xe0d0ff); Co.start(eclipse(b, 2), 'fight'); Co.start(Post.lerpTo({ bloom: 0.62, threshold: 0.9, tint: [1.0, 0.97, 1.07], exposure: 1.0 }, 2), 'fight');
        const outer = []; for (const t of S.tiles) if (t.present && Math.max(Math.abs(t.ix - 3), Math.abs(t.iz - 3)) === 3) outer.push(t.iz * N + t.ix); dropTiles(b, outer, { warn: 3.4 });
        S.conduitU.uC.value.setHex(0xb080ff); S.trim.emissive.setHex(0xd0a0ff); yield 3.8;
      }, *run(b) {
        while (true) {
          yield* supernova(b, 4);
          Co.start(sweep(b, 4, 11, 0.46, { wait: false, reverse: true }), 'phase'); yield 2.2; yield* polarize(b, { flips: 2, time: 4.2 }); yield 4.6;
          spawnDrones(b, 2); yield* lance(b, 2); { let w = 0; while (dronesAlive() && w < 22) { w += G.dt; yield; } }
          yield* purge(b, 3, 10); yield* overclock(b, 4, 7); yield* polarize(b, { flips: 2, time: 3.6 }); yield* lance(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      // tiles: warning, dropping, returning
      for (const q of S.tiles) {
        if (q.warn > 0) { q.warn -= dt; if (q.warn <= 0) { q.present = false; q.col = 0; if (q.back) q.backT = q.back; Sound.sfx('boom', 0.25, 1.8); q.sx = (vrand() - 0.5) * 2.4; q.sz = (vrand() - 0.5) * 2.4; q.lost = 1; if (!G.headless) FX.burst(q.x, 0, q.z, { n: 14, color: 0xff5020, speed: [2, 6], up: 3, life: [0.3, 0.8], size: [0.1, 0.25], radius: TS * 0.45 }); } }
        if (!q.present && q.backT > 0) { q.backT -= dt; if (q.backT <= 0) { q.present = true; q.backT = 0; q.rx = q.rz = 0; } }
      }
      // lasers
      const sw = S.sweep;
      if (sw) {
        sw.arm -= dt; sw.t -= dt; if (sw.arm <= 0) { if (sw.rev > 0 && sw.t < sw.rev) { sw.rev = -1; sw.warn = 0.9; sw.tw = -sw.tw; Sound.sfx('warn', 2, 1.6); } if (sw.warn > 0) { sw.warn -= dt; sw.w = damp(sw.w, 0, 6, dt); } else sw.w = damp(sw.w, sw.tw, 3, dt); }
        sw.a += sw.w * dt;
        if (sw.arm <= 0 && sw.t > 0 && p.alive && p.pos.y < 1.6) { const pr = Math.hypot(p.pos.x, p.pos.z), pa = Math.atan2(p.pos.x, p.pos.z); for (let i = 0; i < sw.n; i++) { const L = S.lasers[i]; L.cd -= dt; const da = angDiff(sw.a + i / sw.n * TAU, pa); if (pr < sw.len && Math.abs(Math.sin(da) * pr) < 0.75 && Math.cos(da) > 0 && L.cd <= 0) { L.cd = 1.0; p.hurt(270, { blockable: true, src: { name: 'Sweep' } }); FX.impact(p.pos.x, 1.2, p.pos.z, 0xff5030, 1); } } }
        if (sw.t <= -0.3 || G.state === 'win') { S.sweep = null; for (const L of S.lasers) L.grp.visible = false; }
      }
      if (G.headless) return;
      if (!S.sweep) for (const L of S.lasers) L.grp.visible = false;
      S.tileT.value = t % 1000;
      for (const q of S.tiles) {
        if (q.present) { q.y = damp(q.y, TY, 5, dt); q.lost = Math.max(0, (q.lost || 0) - dt * 2); }
        else { q.y = q.y + (-60 - q.y) * Math.min(1, dt * 0.9) - dt * 6; q.rx += q.sx * dt; q.rz += q.sz * dt; }
        const jit = q.warn > 0 && q.warn < 1.4 ? (1.4 - q.warn) * 0.05 : 0;
        q.m.position.set(q.x + (jit ? (vrand() - 0.5) * jit : 0), Math.max(-60, q.y) + (jit ? (vrand() - 0.5) * jit * 0.6 : 0), q.z + (jit ? (vrand() - 0.5) * jit : 0)); q.m.rotation.set(q.rx, 0, q.rz); q.m.visible = q.y > -55;
        q.flash = Math.max(0, q.flash - dt * 2.2);
        const fall = !q.present, hex = fall ? WARN : q.warn > 0 ? WARN : COLS[q.col]; _c.setHex(hex);
        const wave = 0.5 + 0.5 * Math.sin(t * 0.9 - Math.hypot(q.x, q.z) * 0.28); if (!fall && !q.warn && !q.col) _c.lerp(_c2.setHex(IDLE2), wave * 0.7); q.cur.lerp(_c, Math.min(1, dt * 10));
        let k; const K = q.U.uK.value;
        if (fall) { k = 2.2 * Math.max(0, 1 + (q.y - TY) / 14); K.set(1, 0.6, 0.2); }
        else if (q.warn > 0) { k = 2.0 + 1.8 * (0.5 + 0.5 * Math.sin(t * 16)); K.set(1, 0.55, 1); }
        else if (q.col) { k = 2.0 + (S.dangerCol === q.col ? 1.3 * (0.5 + 0.5 * Math.sin(t * 10)) : 0); K.set(1, 0.55, 0.9); }
        else { k = 1.2 + 0.6 * wave; K.set(1.1, 0.22 + 0.15 * wave, 0.6); }
        k += q.flash * 5;
        q.mat.emissive.copy(q.cur); q.mat.emissiveIntensity = k; q.sideMat.emissive.copy(q.cur); q.sideMat.emissiveIntensity = k * 0.75;
      }
      if (sw) { const armed = sw.arm <= 0 && sw.t > 0, fl = sw.warn > 0 ? (Math.sin(t * 40) > 0 ? 1 : 0.25) : 1; for (let i = 0; i < sw.n; i++) { const L = S.lasers[i]; L.grp.rotation.y = sw.a + i / sw.n * TAU; L.mat.color.setHex(sw.warn > 0 ? 0xfff0e0 : 0xffb080).multiplyScalar(armed ? 2.2 * fl : 0.6); L.gU.uA.value = armed ? 0.75 * fl : 0.22; L.gU.uK.value = armed ? 9 : 30; L.fU.uA.value = armed ? 0.4 : 0.14; L.beam.scale.set(armed ? 1 : 0.4, armed ? 1 : 0.4, 1); if (armed && vrand() < dt * 30) { const r = 3 + vrand() * 16, a = L.grp.rotation.y; FX.burst(Math.sin(a) * r, 0.05, Math.cos(a) * r, { n: 1, color: 0xff6030, speed: [0.5, 2.5], up: 2, life: [0.2, 0.5], size: [0.08, 0.2] }); } } }
      // core
      S.heat = Math.max(0, S.heat - dt * 0.6); const dc = S.dangerCol, ch = dc === 1 ? CY : dc === 2 ? MG : CORE_COL[Math.min(2, Math.max(0, b.phase))];
      _c.setHex(ch); const hc = S.haloMat.uniforms.uC.value; hc.lerp(_c, Math.min(1, dt * 12)); S.coreL.color.copy(hc);
      const hk = Math.min(2.2, 1.3 + S.heat * 0.6 + (dc ? 0.4 : 0));
      S.coreMat.color.copy(hc).multiplyScalar(hk).addScalar(0.1); S.spikeMat.color.copy(hc).multiplyScalar(hk * 0.5); S.gapMat.emissive.copy(hc); S.gapMat.emissiveIntensity = Math.min(1, 0.5 + S.heat * 0.4 + (dc ? 0.3 : 0));
      S.poolU.uC.value.copy(hc); S.poolU.uA.value = 0.2 + S.heat * 0.1 + (dc ? 0.08 : 0);
      S.haloMat.uniforms.uA.value = 0.5 + S.heat * 0.25;
      S.coreL.intensity = 40 + S.heat * 50 + (dc ? 40 : 0) + b.phase * 10; S.halo.scale.setScalar(1 + S.heat * 0.3 + Math.sin(t * 3) * 0.04 + S.open * 0.35);
      S.heart.rotation.y += dt * 1.2; S.heart.rotation.x += dt * 0.5; S.core.rotation.z += dt * 2; S.heart.scale.setScalar(1 + S.open * 0.25 + S.heat * 0.15 + Math.sin(t * 5) * 0.03);
      for (const o of S.orbitL) o.rotation.z += dt * 2.5;
      for (const pn of S.panels) { const off = S.open * 0.75 + S.heat * 0.12 + Math.max(0, Math.sin(t * 1.3 + pn.ph)) * 0.05; pn.m.position.copy(pn.cen).addScaledVector(pn.n, off); }
      S.rig.position.y = 4.2 + Math.sin(t * 0.9) * 0.25;
      const sp = 0.5 + b.phase * 0.5 + S.heat * 3; S.gyro[0].rotation.x += dt * sp; S.gyro[0].rotation.y += dt * sp * 0.3; S.gyro[1].rotation.y += dt * sp * 0.8; S.gyro[1].rotation.z += dt * sp * 0.4; S.gyro[2].rotation.x -= dt * sp * 0.6; S.gyro[2].rotation.z += dt * sp * 0.7;
      for (let i = 3; i < 5; i++) { const gr = S.gyro[i], on = b.phase >= i - 2 ? 1 : 0.001; gr.scale.setScalar(damp(gr.scale.x, on, 2, dt)); gr.visible = gr.scale.x > 0.01; gr.rotation.y += dt * sp * (i === 3 ? -0.9 : 0.6); gr.rotation.x += dt * sp * (i === 3 ? 0.35 : -0.5); }
      S.finTrim.emissive.copy(S.trim.emissive);
      // phase 2+: arcs jump between the gimbal rings
      if (b.phase >= 1 && vrand() < dt * (b.phase * 1.6)) { const i = Math.floor(vrand() * 3), j = i + 1 + Math.floor(vrand() * (b.phase >= 2 ? 2 : 1)), A = S.arcV[0], B = S.arcV[1], ra = 2.5 + i * 0.6, rb = 2.5 + Math.min(j, 4) * 0.6, a1 = vrand() * TAU, a2 = a1 + (vrand() - 0.5) * 0.8;
        if (S.gyro[Math.min(j, 4)].visible) { A.set(Math.cos(a1) * ra, Math.sin(a1) * ra, 0); S.gyro[i].localToWorld(A); B.set(Math.cos(a2) * rb, Math.sin(a2) * rb, 0); S.gyro[Math.min(j, 4)].localToWorld(B); FX.lightning(A, B, { color: b.phase >= 2 ? 0xb890ff : 0xff9a50, width: 0.05, jag: 0.35, dur: 0.14, mult: 1.6, sparks: false }); } }
      // phase debris under the arena
      { const want = [0, 18, 40][Math.min(2, b.phase)], dm = S.dummy; S.debris.count = want;
        for (let i = 0; i < want; i++) { const q = S.deb[i]; if (q.y < -45) { const tt = S.tiles[Math.floor(vrand() * S.tiles.length)]; q.x = tt.x + (vrand() - 0.5) * 4; q.z = tt.z + (vrand() - 0.5) * 4; q.y = -1.5 - vrand() * 30; q.vy = 0.6 + vrand() * 1.6; q.rx = vrand() * TAU; q.ry = vrand() * TAU; q.sr = (vrand() - 0.5) * 2; q.s = 0.5 + vrand() * 0.9; }
          q.y -= q.vy * dt; q.rx += q.sr * dt; q.ry += q.sr * 0.7 * dt; dm.position.set(q.x, q.y, q.z); dm.rotation.set(q.rx, q.ry, 0); dm.scale.setScalar(q.s); dm.updateMatrix(); S.debris.setMatrixAt(i, dm.matrix); }
        S.debris.instanceMatrix.needsUpdate = true; S.debris.material.emissive.copy(S.trim.emissive).multiplyScalar(0.25); }
      S.orbit.rotation.y += dt * 0.02;
      const d = S.dummy;
      for (let i = 0; i < S.shards.length; i++) { const u = S.shards[i]; u.a += dt * u.sp * (1 + b.phase * 0.6); const r = 3.9 + b.phase * 0.9 + S.heat * 0.4, ce = Math.cos(u.e * (1 - S.open * 0.5)); d.position.set(Math.sin(u.a) * r * ce, Math.sin(u.e) * r * (0.55 - S.open * 0.2), Math.cos(u.a) * r * ce); d.lookAt(0, 0, 0); d.rotateX(PI / 2); d.rotateY(0.95); d.scale.setScalar(0.85); d.updateMatrix(); S.finBody.setMatrixAt(i, d.matrix); S.finEdge.setMatrixAt(i, d.matrix); }
      S.finBody.instanceMatrix.needsUpdate = true; S.finEdge.instanceMatrix.needsUpdate = true;
      // drone tethers
      for (let i = S.tethers.length - 1; i >= 0; i--) { const a = S.tethers[i]; if (!a.alive) { S.tethers.splice(i, 1); continue; } if (vrand() < dt * 30) { const k = vrand(); FX.burst(lerp(a.pos.x, 0, k), lerp(1.6, 4.2, k), lerp(a.pos.z, 0, k), { n: 1, color: 0xffb030, speed: [0, 0.6], life: [0.2, 0.45], size: [0.15, 0.3] }); } }
      S.planet.rotation.y += dt * 0.004; S.planet.material.uniforms.uT.value = t * 0.02 % 100;
      const bl = 0.6 + 0.4 * Math.max(0, Math.sin(t * 2.2)); for (const bc of S.beacons) bc.material.color.setRGB(3 * bl, 0.35 * bl, 0.2 * bl);
    },
    danger(b, x, z) {
      const S = b.state; let best = Infinity; const i = tIdx(x, z);
      if (i >= 0) { const q = S.tiles[i]; if (q.warn > 0) best = Math.max(0, q.warn - 0.5); if (S.pol && q.col === S.dangerCol) best = Math.min(best, S.pol.t); }
      const sw = S.sweep; if (sw && sw.t > 0) { const pr = Math.hypot(x, z), pa = Math.atan2(x, z), w = Math.abs(sw.arm > 0 ? sw.tw : sw.w) + 0.02, sg = Math.sign(sw.arm > 0 ? sw.tw : sw.w) || 1; for (let k = 0; k < sw.n; k++) { let gap = angDiff(sw.a + k / sw.n * TAU, pa) * sg; if (gap < -0.12 - 0.9 / Math.max(pr, 1)) gap += TAU; const tt = Math.max(0, gap - 0.9 / Math.max(pr, 1)) / w + Math.max(0, sw.arm); if (tt < best) best = tt; } }
      return best;
    },
    bot(b, p) {
      const S = b.state, add = G.ents.find((e) => e.isAdd && e.alive), h = { avoid: (x, z) => { const i = tIdx(x, z); return i < 0 || !S.tiles[i].present; } };
      if (add) { h.target = add; if (p.cls.id === 'duskblade') { const d = Math.hypot(p.pos.x - add.pos.x, p.pos.z - add.pos.z) || 1; h.x = add.pos.x + (p.pos.x - add.pos.x) / d * 2.2; h.z = add.pos.z + (p.pos.z - add.pos.z) / d * 2.2; } } else h.target = b;
      const sw = S.sweep; if (sw && sw.t > 0 && (p.cls.id === 'duskblade' || b.def.danger(b, p.pos.x, p.pos.z) < 1.6)) {
        const cx = h.x === undefined ? p.pos.x : h.x, cz = h.z === undefined ? p.pos.z : h.z, pa = Math.atan2(cx, cz); let best = 0, bd = 9;
        for (let k = 0; k < sw.n; k++) { const m = sw.a + (k + 0.5) / sw.n * TAU, d = Math.abs(angDiff(m, pa)); if (d < bd) { bd = d; best = m; } }
        const r = add ? Math.max(3.2, Math.hypot(cx, cz)) : p.cls.id === 'duskblade' ? 4.3 : 7.5; if (!add || bd > 0.5) { h.x = Math.sin(best) * r; h.z = Math.cos(best) * r; h.w = 1.5; }
      }
      return h;
    },
  });
  const _c = new THREE.Color(), _c2 = new THREE.Color(), _v = new V3();
})();
