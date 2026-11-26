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
  const RIM_COL = [0x2f6cff, 0x3a6ae8, 0x5a5cf0, 0x5a74ff], HAZE_COL = [0x070c22, 0x140812, 0x0e0820, 0x040410], CORE_COL = [0x80c0ff, 0xff9040, 0x8a48ff];

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
  // per tile: uRot turns the layout by 90deg steps (16 looks from 4 bakes), uPh seeds scorch + pulse phase,
  // uPol picks the charge pattern (1 = cyan chevrons, 2 = magenta rings) with a crackling seam, independent of light tint
  function tileMat(T, tex, ph, rot) {
    const U = { uK: { value: new V3(1, 0.25, 0.5) }, uPh: { value: ph }, uRot: { value: rot }, uPol: { value: 0 }, uPat: { value: 0 } };
    const m = new THREE.MeshStandardMaterial({ color: 0x9aa4b8, map: tex.surf.map, normalMap: tex.surf.normalMap, roughnessMap: tex.surf.roughnessMap, metalness: 0.55, roughness: 1, emissive: IDLE, emissiveMap: tex.em, emissiveIntensity: 1.3, envMapIntensity: 0.45 });
    m.normalScale.set(1.2, 1.2);
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uT: T, uK: U.uK, uPh: U.uPh, uRot: U.uRot, uPol: U.uPol, uPat: U.uPat });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uRot;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          { vec2 c = uv - 0.5; vec2 r = uRot < 0.5 ? c : (uRot < 1.5 ? vec2(-c.y, c.x) : (uRot < 2.5 ? -c : vec2(c.y, -c.x))); vec3 ru = vec3(r + 0.5, 1.0);
            vMapUv = (mapTransform * ru).xy; vNormalMapUv = (normalMapTransform * ru).xy; vRoughnessMapUv = (roughnessMapTransform * ru).xy; vEmissiveMapUv = (emissiveMapTransform * ru).xy; }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uT, uPh, uPol, uPat; uniform vec3 uK;
        float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(th(i), th(i + vec2(1.0, 0.0)), f.x), mix(th(i + vec2(0.0, 1.0)), th(i + vec2(1.0, 1.0)), f.x), f.y); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          { vec2 sp = vMapUv * 3.0 + vec2(uPh * 17.0, uPh * 9.0); float sc = tn(sp) * 0.65 + tn(sp * 2.7) * 0.35; float scorch = smoothstep(0.62, 0.86, sc);
            float scuff = smoothstep(0.78, 0.95, tn(vMapUv * vec2(40.0, 4.0) + uPh * 31.0)) * 0.35; diffuseColor.rgb *= (1.0 - 0.7 * scorch) * (1.0 + scuff); }`)
        .replace('#include <emissivemap_fragment>', `{ vec4 em = texture2D(emissiveMap, vEmissiveMapUv); vec2 q = vEmissiveMapUv - 0.5; float per = atan(q.y, q.x + 1e-5) / 6.2831853;
          float run = 0.55 + 1.1 * pow(max(0.5 + 0.5 * sin((per * 2.0 - uT * 0.35 - uPh) * 6.2831853), 0.0), 8.0);
          float e = min(min(vEmissiveMapUv.x, 1.0 - vEmissiveMapUv.x), min(vEmissiveMapUv.y, 1.0 - vEmissiveMapUv.y)); float inset = smoothstep(0.11, 0.13, e) * (1.0 - smoothstep(0.42, 0.45, e) * 0.0);
          float pat = 0.0;
          if (uPol > 0.5 && uPol < 1.5) { float ch = fract((abs(q.x) + q.y) * 5.0 - uT * 1.2); pat = smoothstep(0.0, 0.06, ch) * (1.0 - smoothstep(0.22, 0.3, ch)); }
          else if (uPol > 1.5) { float ri = fract(length(q) * 9.0 - uT * 1.0); pat = smoothstep(0.0, 0.06, ri) * (1.0 - smoothstep(0.22, 0.3, ri)); }
          float crk = uPol > 0.5 ? step(0.72, th(vec2(floor(per * 90.0), floor(uT * 18.0) + uPh * 50.0))) * 1.6 : 0.0;
          totalEmissiveRadiance *= max(em.r * (run + crk) * uK.x + em.g * uK.y + em.b * uK.z + pat * inset * uPat, 0.0); }`);
    };
    m.customProgramCacheKey = () => 'eng-tile2';
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
  function planetMat(sunDir, tint = 0xffffff, atm = 0xff9a6a) {
    return new THREE.ShaderMaterial({
      uniforms: { uTex: { value: planetTex() }, uSun: { value: sunDir.clone() }, uAtm: { value: new THREE.Color(atm) }, uTint: { value: new THREE.Color(tint) }, uT: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; varying vec2 vUv; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uSun, uAtm, uTint; uniform float uT; varying vec3 vN; varying vec3 vW; varying vec2 vUv;
        float ph(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float pn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ph(i), ph(i + vec2(1.0, 0.0)), f.x), mix(ph(i + vec2(0.0, 1.0)), ph(i + vec2(1.0, 1.0)), f.x), f.y); }
        void main(){ vec3 N = vN / max(length(vN), 1e-4); vec3 Vd = cameraPosition - vW; vec3 V = Vd / max(length(Vd), 1e-3);
          vec2 uv = vUv; uv.y += 0.006 * sin(uv.x * 6.2831853 * 3.0 + uv.y * 60.0 + uT) + 0.003 * sin(uv.x * 6.2831853 * 7.0 - uv.y * 140.0);
          vec3 base = texture2D(uTex, uv).rgb * uTint; float ndl = dot(N, uSun);
          float day = smoothstep(-0.12, 0.45, ndl); vec3 col = base * (0.012 + 1.05 * day * max(ndl + 0.12, 0.0));
          vec3 on = N; float cl = pn(on.xy * 9.0 + on.z * 4.0) * 0.6 + pn(on.yz * 21.0 - on.x * 7.0) * 0.4; col += vec3(1.0, 0.36, 0.12) * base * exp(-ndl * ndl * 110.0) * (0.06 + 0.34 * smoothstep(0.35, 0.85, cl));
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
        void main(){ vec3 N = vN / max(length(vN), 1e-4); vec3 Vd = cameraPosition - vW; vec3 V = Vd / max(length(Vd), 1e-3); float d = clamp(abs(dot(N, V)) / max(uLim, 1e-3), 0.0, 1.0);
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
      const A = ring(0.56, 0), B = ring(0.64, -0.06), C = ring(0.64, -0.2), D = ring(0.48, -0.2);
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
    const body = new THREE.ExtrudeGeometry(shp(0.86), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2 }); body.center();
    const rim = shp(1.0); const hole = new THREE.Path(); pts.slice().reverse().forEach(([px, py], i) => (i ? hole.lineTo(px * 0.94, py * 0.94) : hole.moveTo(px * 0.94, py * 0.94))); hole.closePath(); rim.holes.push(hole);
    const edge = new THREE.ExtrudeGeometry(rim, { depth: 0.08, bevelEnabled: false }); edge.center();
    return { body, edge };
  }
  let toothG = null;
  const TOOTH = () => { if (toothG) return toothG; const sh = new THREE.Shape(); sh.moveTo(-0.08, -0.085); sh.lineTo(0.08, -0.045); sh.lineTo(0.08, 0.045); sh.lineTo(-0.08, 0.085); sh.closePath();
    toothG = new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 1 }); toothG.center(); return toothG; };
  // emissive ticker strip: dashes that scroll around a ring in the trim colour
  const TICKU = { uC: { value: new THREE.Color(CY) }, uT: { value: 0 } }; let tickM = null;
  const LAMPU = { uC: { value: new THREE.Color(CY) } }; let lampM = null;
  const LAMPH = () => lampM || (lampM = new THREE.ShaderMaterial({ uniforms: LAMPU, vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }', fragmentShader: 'uniform vec3 uC; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4); vec3 v=vV/max(length(vV),1e-4); float f=clamp(abs(dot(n,v)),0.0,1.0); float a=pow(f,3.0)*0.5; gl_FragColor=vec4(max(uC*a,vec3(0.0)),1.0); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const TICK = () => tickM || (tickM = new THREE.ShaderMaterial({ uniforms: TICKU, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uC; uniform float uT; varying vec2 vUv; void main(){ float d=fract(vUv.x*48.0-uT*0.6); float k=0.25+0.9*smoothstep(0.0,0.1,d)*(1.0-smoothstep(0.4,0.5,d)); float bl=pow(max(0.5+0.5*sin(vUv.x*6.2831853*3.0-uT*1.5),0.0),6.0); gl_FragColor=vec4(max(uC*(k*0.9+bl*0.8),vec3(0.0)),1.0); }' }));
  function gimbal(r, steel, trim, teethMat, tube = 0.17, teethOn = true, ns = 1) {
    const gr = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 4, 120), steel); band.castShadow = true; gr.add(band);
    const line = new THREE.Mesh(new THREE.TorusGeometry(r - tube, 0.022, 4, 160), TICK()); gr.add(line); gr.userData.band = band;
    const nT = teethOn ? Math.round(r * 16) : 0, teeth = new THREE.InstancedMesh(TOOTH(), teethMat, nT), d = new THREE.Object3D(); let k = 0;
    for (let i = 0; i < nT; i++) { if (i % 9 === 0) continue; const a = i / nT * TAU; d.position.set(Math.cos(a) * (r + tube + 0.04), Math.sin(a) * (r + tube + 0.04), 0); d.rotation.set(0, 0, a); d.updateMatrix(); teeth.setMatrixAt(k++, d.matrix); }
    teeth.count = k; if (k) gr.add(teeth);
    for (let q = 0; q < 4; q++) {
      const a = q * PI / 2 + PI / 4, nd = new THREE.Group(); nd.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); nd.rotation.z = a; nd.scale.setScalar(ns);
      const blk = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.56), steel); nd.add(blk);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.66, 8), steel); cap.rotation.x = PI / 2; nd.add(cap);
      const lfr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.66), steel); lfr.position.x = 0.215; nd.add(lfr); const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.44), trim); lamp.position.x = 0.25; nd.add(lamp); const lh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), LAMPH()); lh.position.x = 0.3; nd.add(lh);
      gr.add(nd);
    }
    return gr;
  }

  function build(b) {
    const g = G.world, S = b.state; tickM = null; toothG = null; lampM = null;
    const sunDir = new V3(-0.55, 0.3, -0.78).normalize();
    const sky = W.sky({ top: 0x010207, horizon: 0x050720, bottom: 0x010106, stars: 1.6, nebula: 1.15, nebulaA: 0x340c48, nebulaB: 0x03344a, sunDir: sunDir.toArray(), sunColor: 0xfff0d8, sunSize: 0.06, sunGlow: 0.9 }); g.add(sky); S.sky = sky; W.env(sky, 0.6);
    S.hemi = W.hemi(g, 0x34448a, 0x1c1834, 0.72);
    S.sun = W.sun(g, { dir: sunDir.toArray(), color: 0xfff0e0, intensity: 2.2, size: 24 });
    // two shadowless fills: warm bounce from the planet below, and a constant cool counter-light from the starfield side so silhouettes separate every phase
    S.planetFill = new THREE.DirectionalLight(0xff8a50, 0.95); S.planetFill.position.set(380, -560, -620).normalize().multiplyScalar(80); g.add(S.planetFill);
    S.cool = new THREE.DirectionalLight(0x4aa8ff, 1.15); S.cool.position.set(0.62, 0.38, 0.69).multiplyScalar(80); g.add(S.cool);
    // planet: lit shader with terminator + limb glow, an additive atmosphere shell, and a thin ring band with gaps
    const PR = 520, ppos = new V3(380, -560, -620);
    S.planetG = new THREE.Group(); S.planetG.position.copy(ppos); g.add(S.planetG); S.ppos = ppos.clone();
    const planet = new THREE.Mesh(new THREE.SphereGeometry(PR, 96, 48), planetMat(sunDir)); planet.rotation.set(0.3, 0.4, 0.25); S.planetG.add(planet); S.planet = planet;
    // a distant second body: small icy moon high on the far side
    const moon = new THREE.Mesh(new THREE.SphereGeometry(46, 48, 24), planetMat(sunDir, 0x9ab4d8, 0x88b8ff)); moon.position.set(-520, 230, -980); moon.rotation.set(0.2, 1.3, 0.1); g.add(moon);
    const moonAtm = new THREE.Mesh(new THREE.SphereGeometry(46 * 1.06, 32, 16), haloMat(sunDir, 0x88b8ff, 1.06)); moonAtm.position.copy(moon.position); g.add(moonAtm);
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
    const twm = dress(new THREE.MeshStandardMaterial({ color: 0x46505f, metalness: 0.8, roughness: 0.42, envMapIntensity: 1.0 }), { rim: 1.6, haze: 0.7 });
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
    // hero structure behind the boss: a great ring gate with docking modules and a spire, far enough to sit in the haze
    { const hg = new THREE.Group(); hg.position.set(-34, 13, -92); hg.rotation.y = 0.5; g.add(hg); S.gate = hg;
      const twm = dress(new THREE.MeshStandardMaterial({ color: 0x6a7690, metalness: 0.7, roughness: 0.45, emissive: 0x16223e, emissiveIntensity: 1, envMapIntensity: 1 }), { rim: 2.2, haze: 0.3 }); // its own hazed, rim-lit steel
      const gr = new THREE.Mesh(new THREE.TorusGeometry(17, 0.9, 8, 120), twm); hg.add(gr);
      const wn = 64, win = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), wn), wd = new THREE.Object3D(), wc = new THREE.Color();
      for (let i = 0; i < wn; i++) { const a = i / wn * TAU + 0.03, rr = 17 + (i % 2 ? 1.0 : -1.0); wd.position.set(Math.cos(a) * rr, Math.sin(a) * rr, i % 3 ? 0.9 : -0.9); wd.updateMatrix(); win.setMatrixAt(i, wd.matrix); win.setColorAt(i, wc.setHex(i % 7 === 0 ? 0xff6040 : 0x8ac8ff).multiplyScalar(i % 7 === 0 ? 1.8 : 1.1 + (i % 3) * 0.25)); }
      win.frustumCulled = false; hg.add(win);
      const gr2 = new THREE.Mesh(new THREE.TorusGeometry(15.4, 0.25, 4, 120), twm); hg.add(gr2);
      const gl = new THREE.Mesh(new THREE.TorusGeometry(16.2, 0.07, 4, 160), S.conduit); hg.add(gl);
      const gm = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 1.8, 2.2), twm, 12), gd = new THREE.Object3D();
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; gd.position.set(Math.cos(a) * 17, Math.sin(a) * 17, 0); gd.rotation.set(0, 0, a); gd.scale.set(1, i % 3 === 0 ? 1.8 : 1, 1); gd.updateMatrix(); gm.setMatrixAt(i, gd.matrix); }
      gm.frustumCulled = false; hg.add(gm);
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.6, 22, 8), twm); spire.position.y = -26; hg.add(spire);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 9, 6), twm); ant.position.y = 21.5; hg.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), W.glow(0xff3020, 3, { fog: false })); tip.position.y = 26.2; hg.add(tip); S.beacons.push(tip); }
    // solar vanes: framed cell arrays on a truss boom
    const pc = document.createElement('canvas'); pc.width = 256; pc.height = 128; const px = pc.getContext('2d'); px.fillStyle = '#0b1530'; px.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 6; j++) { const gr = px.createLinearGradient(i * 16, j * 21, i * 16 + 14, j * 21 + 19); gr.addColorStop(0, `rgb(${30 + (i * 7 + j * 3) % 12},${44 + (i * 5 + j) % 14},${92 + (i * 3 + j * 7) % 24})`); gr.addColorStop(1, '#0a1228'); px.fillStyle = gr; px.fillRect(i * 16 + 1, j * 21 + 1, 14, 19); }
    const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
    const pec = document.createElement('canvas'); pec.width = 256; pec.height = 128; const pex = pec.getContext('2d'); pex.fillStyle = '#000'; pex.fillRect(0, 0, 256, 128); pex.fillStyle = '#304880'; for (let i = 0; i <= 16; i++) pex.fillRect(i * 16 - 1, 0, 1, 128); for (let j = 0; j <= 6; j++) pex.fillRect(0, j * 21 - 1, 256, 1);
    const pmat = dress(new THREE.MeshStandardMaterial({ map: ptex, color: 0xc8d4ff, metalness: 0.75, roughness: 0.22, emissive: 0x4070d0, emissiveMap: new THREE.CanvasTexture(pec), emissiveIntensity: 1.1, envMapIntensity: 1.4 }), { rim: 0.5, haze: 0.8 });
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
      const { m: mat, U } = tileMat(S.tileT, texs[vi], (ix * 0.37 + iz * 0.61) % 1, Math.floor(W.hash2(ix, iz, 29) * 4) % 4);
      mat.color.setHSL(0.6 + (hsh - 0.5) * 0.06, 0.12 + hsh * 0.1, 0.55 + (W.hash2(ix, iz, 5) - 0.5) * 0.18); mat.roughness = 0.85 + W.hash2(ix, iz, 9) * 0.3;
      const sideMat = new THREE.MeshStandardMaterial({ color: 0x0c1018, metalness: 0.8, roughness: 0.5, emissive: IDLE, emissiveMap: stex, emissiveIntensity: 1, envMapIntensity: 0.6 });
      const m = new THREE.Mesh(tgeo, [mat, sideMat]); m.position.set(-HALF + TS * (ix + 0.5), TY, -HALF + TS * (iz + 0.5)); m.receiveShadow = true; g.add(m);
      S.tiles.push({ m, mat, sideMat, U, ix, iz, x: m.position.x, z: m.position.z, present: true, col: 0, dead: false, drain: 0, warn: 0, back: 0, y: TY, flash: 0, cur: new THREE.Color(IDLE), rx: 0, rz: 0, sx: 0, sz: 0 });
    }
    // under the grid: a beam lattice the tiles sit on (one instanced draw), glowing seams in the gaps, and a soft haze far below for depth
    { const lm = dress(new THREE.MeshStandardMaterial({ color: 0x2c2650, metalness: 0.85, roughness: 0.66, envMapIntensity: 0.45 }), { rim: 0.45, haze: 0.5 });
      const list = [], L = N * TS + 1.2, yB = -TH - 0.3;
      for (let k = 0; k <= N; k++) { const c = -HALF + k * TS; list.push([c, yB, 0, 0.36, 0.5, L], [0, yB, c, L, 0.5, 0.36]); }
      for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) { const cx = -HALF + TS * (ix + 0.5), cz = -HALF + TS * (iz + 0.5); list.push([cx, yB - 0.55, cz, 0.18, 0.18, TS * 1.3, PI / 4], [cx, yB - 0.55, cz, 0.18, 0.18, TS * 1.3, -PI / 4], [cx, yB - 1.1, cz, 0.5, 0.8, 0.5, 0]); }
      for (let k = 0; k <= N; k++) for (let j = 0; j <= N; j++) list.push([-HALF + k * TS, yB - 0.2, -HALF + j * TS, 0.6, 0.9, 0.6, PI / 4]);
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lm, list.length), d = new THREE.Object3D();
      list.forEach(([x, y, z, sx, sy, sz, ry], i) => { d.position.set(x, y, z); d.rotation.set(0, ry || 0, 0); d.scale.set(sx, sy, sz); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
      im.frustumCulled = false; g.add(im);
      const sg = new THREE.PlaneGeometry(0.5, N * TS); sg.rotateX(-PI / 2); const smat = fadeMat(S.conduitU, 0.42);
      for (let k = 1; k < N; k++) { const c = -HALF + k * TS; const a = new THREE.Mesh(sg, smat); a.position.set(c, -0.16, 0); g.add(a); const bb = new THREE.Mesh(sg, smat); bb.position.set(0, -0.16, c); bb.rotation.y = PI / 2; g.add(bb); }
      S.hazeU = { uC: { value: new THREE.Color(0x101a40) }, uA: { value: 1 } };
      const hz = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShaderMaterial({ uniforms: S.hazeU, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ vec2 q=(vUv-0.5)*2.0; float a=exp(-dot(q,q)*3.0)*uA; gl_FragColor=vec4(max(uC*a,vec3(0.0)),1.0); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      hz.rotation.x = -PI / 2; hz.position.y = -22; g.add(hz);
      // pulsing node lights along the underframe, visible through gaps and dropped tiles (one instanced draw)
      const nl = []; for (let k = 0; k <= N; k++) for (let j = 0; j <= N; j++) if ((k + j) % 2 === 0) nl.push([-HALF + k * TS, yB - 0.75, -HALF + j * TS]);
      S.nodeL = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), nl.length);
      S.nodeHU = { uC: { value: new THREE.Color(CY) } }; S.nodeH = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.ShaderMaterial({ uniforms: S.nodeHU, vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.0); vN=normalMatrix*mat3(instanceMatrix)*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uC; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4); vec3 v=vV/max(length(vV),1e-4); float f=clamp(abs(dot(n,v)),0.0,1.0); float a=pow(f,2.5)*0.55; gl_FragColor=vec4(max(uC*a,vec3(0.0)),1.0); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), nl.length);
      nl.forEach(([x, y, z], i) => { d.position.set(x, y, z); d.rotation.set(0, PI / 4, 0); d.scale.setScalar(1); d.updateMatrix(); S.nodeL.setMatrixAt(i, d.matrix); S.nodeH.setMatrixAt(i, d.matrix); }); S.nodeL.frustumCulled = S.nodeH.frustumCulled = false; g.add(S.nodeL, S.nodeH);
      // energy lip: an additive curtain around the outer edge, brightest at the rim and fading down into the void
      S.lipU = { uC: { value: new THREE.Color(CY) }, uA: { value: 0.55 } };
      const lipM = new THREE.ShaderMaterial({ uniforms: S.lipU, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float y=clamp(vUv.y,0.0,1.0); float a=(pow(y,7.0)*0.5+exp(-(1.0-y)*(1.0-y)*1600.0)*1.1)*uA*(0.35+0.65*smoothstep(0.0,0.08,vUv.x)*smoothstep(1.0,0.92,vUv.x)); gl_FragColor=vec4(max(uC*a,vec3(0.0)),1.0); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      const lg = new THREE.PlaneGeometry(N * TS, 2.2); lg.translate(0, -1.1, 0);
      for (let k = 0; k < 4; k++) { const a = k * PI / 2, lp = new THREE.Mesh(lg, lipM); lp.position.set(Math.sin(a) * (HALF + 0.05), -0.02, Math.cos(a) * (HALF + 0.05)); lp.rotation.y = a; g.add(lp); } }
    S.motes = W.motes({ n: 400, box: [70, 40, 70], color: 0x9fd0ff, size: 0.08, vel: [0.1, 0.06, 0.05], sway: 0.4, center: [0, 8, 0] }); g.add(S.motes);
    // ---- the core ----
    const bg = b.group; S.rig = new THREE.Group(); S.rig.position.y = 4.2; bg.add(S.rig);
    // heart: faceted crystal + a three-axis star of light + two thin orbit lines, all kept under ~3x so bloom shapes rather than clips
    S.heart = new THREE.Group(); S.rig.add(S.heart);
    // crystal: flat-faceted icosahedron, dark-ish facet centres with bright fresnel edges so the faceting reads through the glow
    const cU = { uC: { value: new THREE.Color(0x80c0ff) }, uHot: { value: 1.2 } }; S.crystalU = cU; S.coreMat = { color: cU.uC.value };
    const cg = new THREE.IcosahedronGeometry(0.85, 0); cg.computeVertexNormals();
    S.core = new THREE.Mesh(cg, new THREE.ShaderMaterial({ uniforms: cU, vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP=position; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uC; uniform float uHot; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec3 n=vN/max(length(vN),1e-4); vec3 v=vV/max(length(vV),1e-4); float fa=clamp(abs(dot(n,v)),0.0,1.0); float rim=pow(max(1.0-fa,0.0),1.8); vec3 c=uC*(0.05+1.35*rim); float a=clamp(0.1+0.75*rim,0.0,1.0); gl_FragColor=vec4(clamp(c,vec3(0.0),vec3(1.8)),a); }', transparent: true, depthWrite: false }));
    S.core.renderOrder = 2;
    S.innerU = { uC: { value: new THREE.Color(0x80c0ff) }, uHot: { value: 1 } };
    const ig = new THREE.IcosahedronGeometry(0.42, 0); ig.computeVertexNormals();
    S.inner = new THREE.Mesh(ig, new THREE.ShaderMaterial({ uniforms: S.innerU, vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uC; uniform float uHot; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4); vec3 v=vV/max(length(vV),1e-4); float fa=clamp(abs(dot(n,v)),0.0,1.0); vec3 c=uC*(0.55+0.75*pow(max(1.0-fa,0.0),1.5))+uC*pow(fa,6.0)*uHot*0.35; gl_FragColor=vec4(clamp(c,vec3(0.0),vec3(1.7)),1.0); }' }));
    S.heart.add(S.inner); S.hotM = new THREE.MeshBasicMaterial({ color: 0xffffff }); S.hot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), S.hotM); S.heart.add(S.hot);
    S.heart.add(S.core);
    // inner volume: three layered additive shells breathing out of phase
    S.shellU = []; for (let i = 0; i < 3; i++) { const U = { uC: { value: new THREE.Color(0x80c0ff) }, uA: { value: 0.3 } }; S.shellU.push(U);
      const sm = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 + i * 0.25, 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4); vec3 v=vV/max(length(vV),1e-4); float f=clamp(abs(dot(n,v)),0.0,1.0); float a=pow(f,2.5)*uA; gl_FragColor=vec4(max(uC*a,vec3(0.0)),a); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); S.heart.add(sm); }
    S.spikeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const spG = new THREE.OctahedronGeometry(1, 0); for (const r of [[0, 0, 0], [PI / 2, 0, 0], [0, 0, PI / 2]]) { const sp = new THREE.Mesh(spG, S.spikeMat); sp.scale.set(0.09, 1.25, 0.09); sp.rotation.set(...r); S.heart.add(sp); }
    S.orbitL = []; for (let i = 0; i < 2; i++) { const o = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.02, 4, 48), S.spikeMat); o.rotation.set(i ? 1.1 : -0.4, i ? 0.5 : 0.9, 0); S.heart.add(o); S.orbitL.push(o); }
    S.haloMat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0x80c0ff) }, uA: { value: 1 } }, vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }', fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4); vec3 v=vV/max(length(vV),1e-4); float f=clamp(abs(dot(n,v)),0.0,1.0); float a=pow(f,4.0)*uA*0.45; gl_FragColor=vec4(uC*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    S.halo = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), S.haloMat); S.rig.add(S.halo);
    S.coreL = new THREE.PointLight(0x80c0ff, 60, 40, 1.8); S.coreL.castShadow = false; S.rig.add(S.coreL);
    const rv = W.bake(256, (u, v) => { const fu = (u * 8) % 1, fv = (v * 2) % 1, e = Math.min(fu, 1 - fu, fv, 1 - fv), seam = smooth(sat(e * 30)), rx = Math.abs(fu - 0.12), ry = (v * 10) % 1, riv = Math.hypot(rx, Math.abs(ry - 0.5) / 4) < 0.03 ? 1 : 0, n = W.fbm(u * 32, v * 8, 4, 3, 8), id = W.hash2(Math.floor(u * 8), Math.floor(v * 2), 3);
      return [seam * 0.8 + riv * 0.25 + n * 0.08, (0.45 + id * 0.35) * (0.5 + 0.5 * seam) + riv * 0.3, 0.18 + id * 0.35 + n * 0.2 + (1 - seam) * 0.3]; }, { dark: 0x1c222c, light: 0x7a8496, strength: 4 });
    for (const k in rv) rv[k].repeat.set(6, 1);
    const steelMat = (tr) => dress(new THREE.MeshStandardMaterial({ color: 0xb0b8c8, map: rv.map, normalMap: rv.normalMap, roughnessMap: rv.roughnessMap, metalness: 1.0, roughness: 1.0, envMapIntensity: 1.5, transparent: !!tr }), { rim: 1.0 });
    const steel = steelMat();
    const bm = W.surface('metal', { size: 128, dark: 0x1a1f28, light: 0x4a5464, strength: 3 }); for (const k in bm) bm[k].repeat.set(1.2, 1.2);
    S.trim = new THREE.MeshStandardMaterial({ color: 0x05070a, emissive: CY, emissiveIntensity: 1.3 });
    S.gapMat = new THREE.MeshStandardMaterial({ color: 0x020306, metalness: 0.2, roughness: 0.9, emissive: 0x80c0ff, emissiveIntensity: 0.6, transparent: true });
    // armour plates: dark brushed metal; the bevel heats toward the seams in the core's colour, the plate centre carries a faint warmth
    S.plateU = { uHC: { value: new THREE.Color(0x80c0ff) }, uHK: { value: 1 } };
    const plateMat = () => { const m = dress(new THREE.MeshStandardMaterial({ color: 0x3c4452, map: bm.map, normalMap: bm.normalMap, metalness: 0.9, roughness: 0.42, envMapIntensity: 0.9, transparent: true }), { rim: 0.7 }), ob = m.onBeforeCompile;
      m.onBeforeCompile = (sh) => { ob(sh); sh.uniforms.uHC = S.plateU.uHC; sh.uniforms.uHK = S.plateU.uHK;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP; uniform vec3 uHC; uniform float uHK;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float pr = length(vLP); float seam = smoothstep(0.47, 0.6, pr); float ctr = pow(max(1.0 - pr / 0.6, 0.0), 2.0); totalEmissiveRadiance = uHC * uHK * (seam * 0.9 + ctr * 0.12); }'); };
      m.customProgramCacheKey = () => 'eng-plate'; return m; }; S.gapClones = [];
    // seam walls under each plate: emission only along the plate edge, fading to dark toward the inner cap so the interior never reads as flat paper
    const gapMatF = () => { const m = new THREE.MeshStandardMaterial({ color: 0x020306, metalness: 0.2, roughness: 0.9, emissive: 0x80c0ff, emissiveIntensity: 0.6, transparent: true });
      m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(0.52, 0.63, length(vLP));'); };
      m.customProgramCacheKey = () => 'eng-gap'; return m; };
    S.panels = []; for (const p of shellPanels(1.6)) { const gm = gapMatF(); S.gapClones.push(gm); const m = new THREE.Mesh(p.geo, [plateMat(), gm]); m.userData.fadeOcclude = true; m.userData.fadeMin = 0.12; m.geometry.computeBoundingSphere(); m.geometry.boundingSphere.radius = Math.max(m.geometry.boundingSphere.radius, 1.6); m.position.copy(p.cen); m.castShadow = true; S.rig.add(m); S.panels.push({ m, cen: p.cen, n: p.n, ph: vrand() * TAU }); }
    // three clear nested gimbals: thin inner, medium middle, heavy toothed outer
    S.GR = [2.7, 3.45, 4.3]; S.gyro = []; S.trimClones = [];
    for (let i = 0; i < 3; i++) { let sm = steel, tm = S.trim; if (i >= 1) { sm = steelMat(true); tm = S.trim.clone(); S.trimClones.push(tm); }
      const gr = gimbal(S.GR[i], sm, tm, sm, [0.08, 0.15, 0.27][i], i === 2, [0.6, 0.85, 1.15][i]); if (i >= 1) { gr.userData.band.userData.fadeOcclude = true; gr.userData.band.userData.fadeMin = 0.15; } S.rig.add(gr); S.gyro.push(gr); }
    S.arcV = [new V3(), new V3()];
    // fins: bevelled blades with an emissive edge inlay (two instanced draws for all twelve)
    // fins are solar vanes: glossy dark-blue cells on a silver grid, each its own mesh so only the one in front of the player fades
    const fc = document.createElement('canvas'); fc.width = fc.height = 128; const fx2 = fc.getContext('2d'); fx2.fillStyle = '#28324c'; fx2.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const gr = fx2.createLinearGradient(i * 32, j * 32, i * 32 + 30, j * 32 + 30); gr.addColorStop(0, `rgb(${34 + (i * 7 + j * 3) % 10},${52 + (i * 5 + j) % 12},${118 + (i * 3 + j * 7) % 22})`); gr.addColorStop(1, '#0c1634'); fx2.fillStyle = gr; fx2.fillRect(i * 32 + 2, j * 32 + 2, 28, 28); fx2.fillStyle = 'rgba(120,150,230,0.07)'; fx2.fillRect(i * 32 + 15, j * 32 + 2, 1, 28); }
    const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace; ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(1.6, 1.6); ftex.anisotropy = 8;
    const fec = document.createElement('canvas'); fec.width = fec.height = 128; const fe2 = fec.getContext('2d'); fe2.fillStyle = '#000'; fe2.fillRect(0, 0, 128, 128); fe2.fillStyle = '#1e1e1e'; for (let i = 0; i < 4; i++) { fe2.fillRect(i * 32, 0, 2, 128); fe2.fillRect(0, i * 32, 128, 2); }
    const fetex = new THREE.CanvasTexture(fec); fetex.wrapS = fetex.wrapT = THREE.RepeatWrapping; fetex.repeat.copy(ftex.repeat);
    const bl = bladeGeos(); S.fins = []; S.finTrims = [];
    const camFade = (m, key) => { const ob = m.onBeforeCompile; m.onBeforeCompile = (sh) => { if (ob) ob(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= mix(0.06, 1.0, smoothstep(4.0, 10.5, length(vViewPosition)));'); }; m.customProgramCacheKey = () => key; return m; };
    for (let i = 0; i < 6; i++) {
      const fb = new THREE.Mesh(bl.body, camFade(dress(new THREE.MeshStandardMaterial({ color: 0xffffff, map: ftex, metalness: 0.6, roughness: 0.46, emissive: CY, emissiveMap: fetex, emissiveIntensity: 0.3, envMapIntensity: 0.9, transparent: true }), { rim: 0.6 }), 'eng-finb'));
      const fe = new THREE.Mesh(bl.edge, camFade(new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.9, metalness: 0, emissive: CY, emissiveIntensity: 0.6, transparent: true }), 'eng-fine')); S.finTrims.push(fe.material, fb.material);
      for (const m of [fb, fe]) { m.userData.fadeOcclude = true; m.userData.fadeMin = 0.12; m.matrixAutoUpdate = false; S.rig.add(m); } fb.castShadow = true; S.fins.push([fb, fe]);
    }
    S.shards = []; for (let i = 0; i < 6; i++) S.shards.push({ a: i / 6 * TAU, e: (i % 2 ? 0.3 : -0.3), sp: 0.35 }); S.dummy = new THREE.Object3D();
    // light pool: a soft additive disc on the floor in the core's colour, so the arena picks up the boss
    S.poolU = { uC: { value: new THREE.Color(0x80c0ff) }, uA: { value: 0.22 } };
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.ShaderMaterial({ uniforms: S.poolU, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ vec2 q=(vUv-0.5)*2.0; float r2=dot(q,q); float a=(exp(-r2*5.0)*0.8+exp(-r2*1.6)*0.35)*(1.0-smoothstep(0.85,1.0,sqrt(min(r2,1.0))))*uA; gl_FragColor=vec4(max(uC*a,vec3(0.0)),1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pool.rotation.x = -PI / 2; pool.position.y = 0.025; pool.renderOrder = 1; g.add(pool);
    // pedestal
    // tapered spindle base with a glowing coupling, an open gap, and an energy tether up to the core
    const sp = new THREE.LatheGeometry([[0, 0], [1.5, 0], [1.45, 0.18], [0.75, 0.42], [0.42, 0.95], [0.3, 1.3], [0.42, 1.42], [0.42, 1.55], [0, 1.55]].map(([x, y]) => new THREE.Vector2(x, y)), 10);
    const ped = new THREE.Mesh(sp, steel); bg.add(ped);
    const cpl = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.06, 6, 32), S.trim); cpl.rotation.x = PI / 2; cpl.position.y = 1.48; bg.add(cpl);
    const cpl2 = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.035, 4, 40), S.trim); cpl2.rotation.x = PI / 2; cpl2.position.y = 0.3; bg.add(cpl2);
    S.tetherU = { uC: { value: new THREE.Color(0x80c0ff) }, uT: { value: 0 } };
    const tg = new THREE.CylinderGeometry(0.22, 0.32, 1.9, 12, 1, true); tg.translate(0, 0.95, 0);
    const teth = new THREE.Mesh(tg, new THREE.ShaderMaterial({ uniforms: S.tetherU, vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uC; uniform float uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4); vec3 v=vV/max(length(vV),1e-4); float f=pow(clamp(abs(dot(n,v)),0.0,1.0),2.0); float fl=0.6+0.4*sin(vUv.y*30.0-uT*9.0); float e=smoothstep(0.0,0.15,vUv.y)*smoothstep(1.0,0.75,vUv.y); float a=f*fl*e*0.9; gl_FragColor=vec4(max(uC*a,vec3(0.0)),1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    teth.position.y = 1.55; bg.add(teth);
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
    S.bshU = new THREE.ShaderMaterial({ vertexShader: 'varying vec3 vC; varying float vF; void main(){ vC = instanceColor; mat4 mw = modelMatrix * instanceMatrix; vec4 wp = mw * vec4(position, 1.0); vec3 n = mat3(mw) * normal; n /= max(length(n), 1e-5); vec3 v = cameraPosition - wp.xyz; v /= max(length(v), 1e-5); vF = clamp(dot(n, v), 0.0, 1.0); gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: 'varying vec3 vC; varying float vF; void main(){ float f = clamp(vF, 0.0, 1.0); float a = smoothstep(0.0, 0.4, f) * (1.0 - 0.75 * smoothstep(0.8, 0.98, f)) * 0.78; gl_FragColor = vec4(max(vC * 1.25, vec3(0.0)), a); }', transparent: true, depthWrite: false });
    S.bsh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), S.bshU, 400); S.bsh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(400 * 3), 3); S.bsh.count = 0; S.bsh.frustumCulled = false; S.bsh.renderOrder = 11; g.add(S.bsh);
    S.sweep = null; S.pol = null; S.coreCol = 0; S.open = 0; S.spin = 1; S.tethers = []; S.dangerCol = 0; S.heat = 0;
    S.sunDir = sunDir.clone(); S.PR = PR; if (G.nightmare) nmBuild(b, S, g);
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
  function setCore(b, c, snap) { const S = b.state; S.dangerCol = c; if (snap) Sound.sfx('tick', 1.5, c === 1 ? 1.4 : 0.7); FX.dome(0, 4.2, 0, { r: 4.5, color: c === 1 ? CY : c === 2 ? MG : 0x80c0ff, dur: 0.35, mult: 0.7 }); }
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
      const h = Hz.rect(0, 0, b.angToPlayer(), 26, 2.3, 1.75, 400, { name: 'Lance', color: 0xffe0a0, lock: 0.55, quiet: true, track: (s) => { s.dir = dampAng(s.dir, angTo(0, 0, G.player.pos.x, G.player.pos.z), 9, G.dt); }, onFire: (hh) => { const d = hh.shape.dir; FX.beam(new V3(0, 4.2, 0), new V3(Math.sin(d) * 26, 1, Math.cos(d) * 26), { color: 0xffb060, width: 0.55, dur: 0.4, mult: 1.1 }); FX.beam(new V3(0, 4.2, 0), new V3(Math.sin(d) * 26, 1, Math.cos(d) * 26), { color: 0xfff0d8, width: 0.12, dur: 0.3, mult: 0.9 }); Sound.sfx('laser', 1, 0.7); FX.shake(0.45); for (let k = 3; k < 26; k += 3) FX.burst(Math.sin(d) * k, 0.4, Math.cos(d) * k, { n: 5, color: 0xffe0a0, speed: [1, 5], up: 3, life: [0.3, 0.7] }); } });
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
  function droneMesh(nm) {
    const g = new THREE.Group(), st = dress(new THREE.MeshStandardMaterial({ color: 0x3a4252, metalness: 0.9, roughness: 0.32, flatShading: true, envMapIntensity: 1.2 }), { rim: 1.1 });
    const amber = new THREE.MeshStandardMaterial({ color: 0x0a0604, emissive: nm ? 0xc060ff : 0xffb030, emissiveIntensity: 1.6, side: THREE.DoubleSide });
    // spindle hull
    const hullPts = [[0, -0.95], [0.22, -0.78], [0.4, -0.38], [0.46, 0], [0.4, 0.34], [0.24, 0.66], [0.08, 0.86], [0, 0.9]].map(([x, y]) => new THREE.Vector2(x, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(hullPts, 8), st); body.position.y = 1.5; g.add(body);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.035, 4, 24), amber); band.rotation.x = PI / 2; band.position.y = 1.5; g.add(band);
    if (nm) { band.visible = false; for (const [c, y] of [[CY, 1.56], [MG, 1.44]]) { const bb = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.035, 4, 24), new THREE.MeshStandardMaterial({ color: 0x0a0604, emissive: c, emissiveIntensity: 1.9 })); bb.rotation.x = PI / 2; bb.position.y = y; g.add(bb); } } // Siphon Drone: a cyan and a magenta band
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10), new THREE.MeshStandardMaterial({ color: 0x05070a, metalness: 0.2, roughness: 0.05, envMapIntensity: 2 })); lens.position.set(0, 1.62, 0.36); g.add(lens);
    const iris = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 20), W.glow(0xffc050, 2.2)); iris.position.set(0, 1.62, 0.55); g.add(iris);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.04, 10), W.glow(0xfff0c0, 2.4)); pupil.position.set(0, 1.62, 0.56); g.add(pupil);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 4, 20), st); bez.position.set(0, 1.62, 0.42); g.add(bez);
    // thruster: additive flame cone under the hull
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 12, 1, true), new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float uT; varying vec2 vUv; void main(){ float a=pow(clamp(1.0-vUv.y,0.0,1.0),1.6)*(0.75+0.25*sin(uT*40.0+vUv.y*20.0)); gl_FragColor=vec4(vec3(1.0,0.55,0.15)*a*1.4,1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    flame.rotation.x = PI; flame.position.y = 0.05; g.add(flame); g.userData.flame = flame.material.uniforms.uT;
    const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.25, 8), st); nz.position.y = 0.6; g.add(nz);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7, 4), st); fin.position.y = 2.55; g.add(fin);
    // a small gimbal ring with two fin vanes, spinning around the hull (the boss's language at drone scale)
    const petals = new THREE.Group(); petals.position.y = 1.5; g.add(petals);
    const dr = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 4, 40), st); dr.rotation.x = PI / 2; petals.add(dr);
    const dl = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.018, 4, 40), amber); dl.rotation.x = PI / 2; dl.position.y = 0.075; petals.add(dl);
    const vb = bladeGeos();
    for (const sx of [-1, 1]) { const v = new THREE.Group(); v.position.x = sx * 0.95; v.rotation.z = sx * 0.25; petals.add(v);
      const vb1 = new THREE.Mesh(vb.body, st); vb1.scale.setScalar(0.45); vb1.rotation.y = PI / 2; v.add(vb1);
      const ve = new THREE.Mesh(vb.edge, amber); ve.scale.setScalar(0.45); ve.rotation.y = PI / 2; v.add(ve); }
    g.userData.ring = petals;
    const L = new THREE.PointLight(nm ? 0xc060ff : 0xffb030, 6, 8, 1.6); L.position.y = 1.6; g.add(L); return g;
  }
  function spawnDrones(b, n) {
    n -= G.ents.filter((q) => q.isAdd && q.alive && q.name === 'Aegis Drone').length; if (n <= 0) return; // never stack past the intended count
    const S = b.state, spots = shuffle(S.tiles.filter((t) => t.present && t.warn <= 0 && Math.max(Math.abs(t.ix - 3), Math.abs(t.iz - 3)) === 2)).slice(0, n);
    b.immune = true; Sound.sfx('shield', 1, 0.5);
    for (const t of spots) {
      FX.pillar(t.x, t.z, { r: 1.2, h: 14, color: 0xffb030, dur: 0.7 });
      const a = b.spawnAdd({ name: 'Aegis Drone', hp: 600, x: t.x, z: t.z, radius: 0.9, aimY: 1.5, mesh: droneMesh(), color: 0xffb030,
        update(e) { e.pos.y = 0.3 + Math.sin(G.now * 3 + e.pos.x) * 0.15; const dg = e.group.children[0].userData; dg.ring.rotation.y += G.dt * 1.4; dg.flame.value = G.now; },
        *run(e) { yield 2; while (e.alive) { const p = G.player; Bul.fire({ x: e.pos.x, z: e.pos.z, y: 1.5, dir: angTo(e.pos.x, e.pos.z, p.pos.x, p.pos.z), speed: 5.5, turn: 0.55, dmg: 110, color: 0xe07a10, shell: 0xff6408, r: 0.45, life: 6, tag: 'fight' }); Sound.sfx('bolt', 0.4, 0.5); yield 4.6; } },
        onDeath() { if (!G.ents.some((q) => q.isAdd && q.alive && q.name === 'Aegis Drone')) { b.immune = false; Sound.sfx('shatter'); FX.dome(0, 4.2, 0, { r: 7, color: 0xffb030, dur: 0.6 }); } } });
      S.tethers.push(a);
    }
  }
  const dronesAlive = () => G.ents.some((q) => q.isAdd && q.alive);
  function* overclock(b, arms = 3, dur = 7) {
    const S = b.state; const r = yield* b.cast({ name: 'Overclock', time: 3.0, onTick: (k) => { S.heat = k; } });
    if (r !== 'done') { S.heat = 0; yield 1.5; return; }
    Sound.sfx('roar', 0.7, 2.4); let t = 0, a0 = rnd(TAU); const sg = rnd() < 0.5 ? 1 : -1;
    while (t < dur) { for (let k = 0; k < arms; k++) { const a = a0 + k / arms * TAU; Bul.fire({ x: Math.sin(a) * 2.4, z: Math.cos(a) * 2.4, dir: a, speed: 7, dmg: 95, color: b.phase >= 2 ? 0x8a3ae0 : 0xe07a10, shell: b.phase >= 2 ? 0x7428ff : 0xff6000, r: 0.4, life: 4.5 }); } a0 += sg * 0.21; t += 0.13; S.heat = 1; yield 0.13; }
    S.heat = 0; yield 0.6;
  }
  function* supernova(b, waves = 4) {
    const S = b.state; yield* b.cast({ name: 'Supernova', time: 1.4, onTick: (k) => { S.heat = k; } });
    for (let w = 0; w < waves; w++) { const gap = b.angToPlayer() + rnd(-1.6, 1.6), gap2 = gap + PI + rnd(-0.6, 0.6); for (let i = 0; i < 44; i++) { const a = i / 44 * TAU; if (Math.abs(angDiff(a, gap)) < 0.3 || Math.abs(angDiff(a, gap2)) < 0.3) continue; Bul.fire({ x: Math.sin(a) * 2.4, z: Math.cos(a) * 2.4, dir: a, speed: 6.4, dmg: 100, color: w % 2 ? 0xd02090 : 0x10a0d8, shell: w % 2 ? MG : CY, r: 0.4, life: 5 }); } FX.ring(0, 0, { r1: 9, color: w % 2 ? MG : CY, dur: 0.4, mult: 0.6, width: 0.06 }); Sound.sfx('zap', 0.7, 0.6 + w * 0.1); FX.shake(0.3); yield 1.25; }
    S.heat = 0; yield 0.6;
  }
  function* eclipse(b, lvl, dur = 3) {
    const S = b.state, U = S.sky.material.uniforms; const i0 = S.sun.intensity, i1 = [2.2, 1.0, 1.3, ECL3.sun][lvl], n0 = U.uNeb.value, n1 = [1.15, 1.15, 1.25, 1.35][lvl], h0 = S.hemi.intensity, h1 = [0.72, 0.52, 0.62, ECL3.hemi][lvl], g0 = U.uSunGlow.value, g1 = [0.9, 0.3, 0.6, 0.08][lvl], c0 = U.uSunCol.value.clone(), c1 = new THREE.Color([0xfff0d8, 0xffa070, 0xc8b0ff, 0xffc8a0][lvl]);
    const hs0 = S.hemi.color.clone(), hs1 = new THREE.Color([0x34448a, 0x5a3438, 0x34306a, 0x3a4c98][lvl]), f0 = S.fog.color.clone(), f1 = new THREE.Color([0x070b1e, 0x120810, 0x08061a, 0x030310][lvl]), fd0 = S.fog.density, fd1 = [0.0065, 0.006, 0.0042, 0.0036][lvl], pz0 = S.planetG.position.clone(), pz1 = lvl === 3 ? S.sunDir.clone().multiplyScalar(ECL3.dist) : S.ppos.clone().multiplyScalar([1, 0.96, 0.86][lvl]), sc0 = S.planetG.scale.x, sc1 = [1, 1.03, 1.1, 1.1][lvl];
    // totality (nightmare): the planet swings across the sun along an arc at its own distance, not through the arena; and back at the kill
    const arc = lvl === 3 || (S.eclLvl === 3), d0 = pz0.length(), d1 = pz1.length(), u0 = pz0.clone().normalize(), u1 = pz1.clone().normalize(), ca0 = S.coronaU ? S.coronaU.uA.value : 0, ca1 = lvl === 3 ? 1 : 0; S.eclLvl = lvl;
    const r0 = RIM.uRim.value.clone(), r1 = new THREE.Color(RIM_COL[lvl]), z0 = RIM.uHazeC.value.clone(), z1 = new THREE.Color(HAZE_COL[lvl]);
    const apply = (k) => { S.sun.intensity = lerp(i0, i1, k); U.uNeb.value = lerp(n0, n1, k); S.hemi.intensity = lerp(h0, h1, k); U.uSunGlow.value = lerp(g0, g1, k); W.colorLerp(U.uSunCol.value, c0, c1, k); S.sun.color.copy(U.uSunCol.value); W.colorLerp(RIM.uRim.value, r0, r1, k); W.colorLerp(RIM.uHazeC.value, z0, z1, k); W.colorLerp(S.hemi.color, hs0, hs1, k); W.colorLerp(S.fog.color, f0, f1, k); S.fog.density = lerp(fd0, fd1, k); if (arc) S.planetG.position.copy(u0).lerp(u1, k).normalize().multiplyScalar(lerp(d0, d1, k)); else S.planetG.position.lerpVectors(pz0, pz1, k); if (S.coronaU) S.coronaU.uA.value = lerp(ca0, ca1, k * k); S.planetG.scale.setScalar(lerp(sc0, sc1, k)); S.open = lerp(S.open, Math.min(1, lvl * 0.5), k * 0.2); };
    if (dur > 0) yield* W.tween(dur, apply); else apply(1);
    S.open = Math.min(1, lvl * 0.5);
  }
  // a phase started directly (skipping earlier enters) still shows the full escalation of the phases before it
  function skipLook(b, lvl) {
    const S = b.state, it = eclipse(b, lvl, 0); while (!it.next().done);
    S.conduitU.uC.value.setHex([CY, 0xff6030, 0x8a40ff][lvl]); S.trim.emissive.setHex([CY, 0xff7a30, 0x9a50ff][lvl]);
    Post.set(Object.assign({}, b.def.post, [{}, { bloom: 0.58, tint: [1.04, 0.98, 1.0] }, { bloom: 0.62, threshold: 0.9, tint: [1.0, 0.97, 1.07], exposure: 1.0 }][lvl]));
  }
  // a phase change kills Polarize mid-cast; without this its colours stay painted on the grid until the next Polarize
  const clearPol = (b) => { const S = b.state; S.pol = null; for (const t of S.tiles) t.col = 0; if (S.dangerCol) setCore(b, 0); };
  const dropNow = (S, list) => { for (const i of list) { const q = S.tiles[i]; if (!q.present) continue; q.present = false; q.warn = 0; q.col = 0; q.y = -60; q.backT = 0; } };


  // ======================== NIGHTMARE: "Totality" (threshold-design/parallax-nightmare-plan.md) ========================
  // The charge stays: after a Polarize the colour that lived stays lit and the one that died burns out, and your hits only
  // count from a lit tile (live: present, painted, and not the colour the core shows). Slow always-on Meridian beams go out
  // during each Polarize cast, Siphon Drones drink lit tiles, and the floor shrinks on a fixed script from 24 tiles to the
  // 3 by 3 ring while the eclipse goes total. Every piece below is a nightmare-only path: Normal's functions and their random
  // calls are untouched. Levers:
  const NM_HP = 20000, NM_AT = [1, 0.86, 0.70];
  const GATE = { off: 0.15 }; // damage off a live tile (the core and the drones)
  const POL = { time: [4.2, 4.2, 4.2, 4.0, 4.0, 3.8], flips: [[1, 2], [1, 2], [1, 3], [1, 3], [1, 3], [1, 3]], lastWindow: 1.0, firstAt: 0.9, gap: 0.9, teachTime: [3.8, 4.0] };
  const SWEEP = { w: 0.17, arms: [2, 2, 2, 3, 3, 3], dmg: 330, outFrom: 0.8, relight: 0.4, armT: 1.3, creep: 0.3 };
  const DRONE = { innerBias: 6, hp: 450, speed: 2.6, drink: 1.6, fromStep: 2, cap: [0, 0, 1, 1, 1, 1], blastKills: true };
  const CYCLE = { perStep: 2, breath: 3.5, novaWaves: 2, novaFrom: 1, clockFrom: 6, clockDur: 4 }; // (cast-budget levers pulled: Supernova 3 to 2 waves, Overclock dropped from Totality; it stays in phase II)
  const FINALE = 0.10; // below this health the breath in each Totality cycle is dropped
  const ECL3 = { sun: 0.25, hemi: 0.4, dist: 1700 }; // totality: sun light, hemisphere floor (the hero still reads), planet distance
  const EMBER = 0x5a1608, CTR = 24;
  const tileAt = (dx, dz) => (3 + dz) * N + (3 + dx);
  const ring = (i) => Math.max(Math.abs((i % N) - 3), Math.abs(Math.floor(i / N) - 3));
  const P2_DROP = [0, 6, 42, 48, 3, 21, 27, 45];
  // Swallow: four tiles at a time, always a symmetric set, removed on entering Totality steps 1 to 4
  const SWALLOW = [null, [[2, 2], [-2, 2], [2, -2], [-2, -2]], [[2, 0], [-2, 0], [0, 2], [0, -2]], [[2, 1], [-2, -1], [-1, 2], [1, -2]], [[2, -1], [-2, 1], [1, 2], [-1, -2]]].map((l) => l && l.map(([dx, dz]) => tileAt(dx, dz)));
  // the boards the fight can have (sets of present tile indices), for the tools
  const BOARDS = (() => {
    const all = [...Array(N * N).keys()], o = { 'full 7x7': all, 'phase II': all.filter((i) => !P2_DROP.includes(i)) };
    let cur = all.filter((i) => ring(i) <= 2); o['5x5 (step 0)'] = cur;
    for (let st = 1; st <= 4; st++) { cur = cur.filter((i) => !SWALLOW[st].includes(i)); o[['', 'no corners (step 1)', 'no edge middles (step 2)', 'pinwheel (step 3)', '3x3 ring (steps 4-5)'][st]] = cur; }
    return o;
  })();
  const live = (S, i) => { const q = S.tiles[i]; return !!q && q.present && q.col > 0 && !q.dead && q.col !== S.dangerCol; };
  // a pattern is fair on a board when each colour has at least 2 present tiles (3 on boards of 12 or more) and every painted tile
  // has a tile of the other colour among its 8 neighbours (a flip leaves 1.0 s: about 5 m at run speed). isP(i): tile i is present.
  function patOk(isP, pat, inv = 0) {
    const col = (i) => (i === CTR || !isP(i)) ? 0 : ((pat(i % N, Math.floor(i / N)) ^ inv) ? 1 : 2); let n = 0; const c = [0, 0, 0];
    for (let i = 0; i < N * N; i++) { const k = col(i); if (!k) continue; n++; c[k]++; }
    const min = n >= 12 ? 3 : 2; if (c[1] < min || c[2] < min) return false;
    for (let i = 0; i < N * N; i++) { const k = col(i); if (!k) continue; const ix = i % N, iz = Math.floor(i / N); let ok = false;
      for (let dz = -1; dz <= 1 && !ok; dz++) for (let dx = -1; dx <= 1 && !ok; dx++) { const x = ix + dx, z = iz + dz; if ((dx || dz) && x >= 0 && z >= 0 && x < N && z < N && col(z * N + x) === 3 - k) ok = true; }
      if (!ok) return false; }
    return true;
  }
  const deckOf = (isP) => PATTERNS.map((p, k) => k).filter((k) => patOk(isP, PATTERNS[k], 0) && patOk(isP, PATTERNS[k], 1));
  const deckCache = {};
  function deckFor(S) {
    const isP = (i) => S.tiles[i].present && S.tiles[i].warn <= 0, key = S.tiles.map((q, i) => isP(i) ? 1 : 0).join('');
    const d = deckCache[key] || (deckCache[key] = deckOf(isP)); return d.length ? d : [2]; // (the checkerboard, if a board ever had no fair pattern)
  }
  // flip times for one cast: n in [lo, hi], the first no earlier than POL.firstAt, at least POL.gap apart, the last leaving lastWindow
  function flipSchedule(time, lo, hi, r) {
    let n = lo + Math.floor(r() * (hi - lo + 1)); const a = POL.firstAt, e = time - POL.lastWindow;
    while (n > 0 && e - a < (n - 1) * POL.gap) n--; if (n <= 0 || e < a) return [];
    const slack = e - a - (n - 1) * POL.gap, pts = []; for (let i = 0; i < n; i++) pts.push(r() * slack); pts.sort((x, y) => x - y);
    return pts.map((x, i) => a + x + i * POL.gap);
  }
  const nmRnd = () => rnd();
  const OFFS = [-1.5, 0, 1.5], OFFS_M = [-1.7, -0.85, 0, 0.85, 1.7]; // sample spots on a tile (the autopilot; melee looks closer to the core)

  // ---- everything nightmare shows is built here, hidden (nothing is made mid-fight but the drones, like Normal's)
  function nmBuild(b, S, g) {
    Object.assign(S, { nm: true, siphons: [], cyc: 0, step: -1, stepAt: [], swallowed: [], holdStep: undefined, onLive: false, onT: null, ecl3: false, shellK: 1, shellHit: 0, blowK: 0, cine: false });
    // Aegis shell: a translucent amber hex shell around the core, up whenever the player is not on a live tile
    S.aegisU = { uA: { value: 1 }, uHit: { value: 0 }, uT: S.tileT || { value: 0 }, uC: { value: new THREE.Color(0xffb030) } };
    S.aegis = new THREE.Mesh(new THREE.IcosahedronGeometry(2.75, 4), new THREE.ShaderMaterial({ uniforms: S.aegisU,
      vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP=position; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
      fragmentShader: `uniform vec3 uC; uniform float uA, uHit, uT; varying vec3 vP; varying vec3 vN; varying vec3 vV;
        float hx(vec2 p){ const float ry = 1.7320508; vec2 h = vec2(0.5, ry * 0.5); vec2 a = mod(p, vec2(1.0, ry)) - h; vec2 c = mod(p - h, vec2(1.0, ry)) - h; vec2 u = abs(dot(a, a) < dot(c, c) ? a : c); return 0.5 - max(u.x, u.x * 0.5 + u.y * 0.866); }
        void main(){ vec3 n = vN / max(length(vN), 1e-4), v = vV / max(length(vV), 1e-4); float f = 1.0 - clamp(abs(dot(n, v)), 0.0, 1.0);
          vec3 on = vP / max(length(vP), 1e-4), w = pow(abs(on), vec3(4.0)); w /= max(w.x + w.y + w.z, 1e-4); vec3 q = vP * 1.7;
          float d = hx(q.yz) * w.x + hx(q.xz) * w.y + hx(q.xy) * w.z; float line = 1.0 - smoothstep(0.0, 0.045, d);
          float run = 0.7 + 0.3 * sin(vP.y * 3.0 - uT * 2.0);
          float a = uA * (0.06 + 0.5 * pow(max(f, 0.0), 2.5) + line * (0.22 + 0.45 * f) * run + uHit * (0.25 + 0.6 * line));
          gl_FragColor = vec4(max(uC * a, vec3(0.0)), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    S.aegis.renderOrder = 3; S.aegis.visible = false; S.rig.add(S.aegis);
    // conduit: while you stand on a live tile, a thin steady arc in its colour from the tile to the core
    S.condU = { uC: { value: new THREE.Color(CY) }, uA: { value: 0 }, uT: S.tileT || { value: 0 } };
    const cg = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); cg.translate(0, 0.5, 0);
    S.cond = new THREE.Group(); S.cond.visible = false; g.add(S.cond);
    S.condCore = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); S.condCore.scale.set(0.035, 1, 0.035); S.cond.add(S.condCore);
    S.condGlow = new THREE.Mesh(cg, new THREE.ShaderMaterial({ uniforms: S.condU, vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uC; uniform float uA, uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4); vec3 v=vV/max(length(vV),1e-4); float f=pow(clamp(abs(dot(n,v)),0.0,1.0),2.0); float e=smoothstep(0.0,0.08,vUv.y)*smoothstep(1.0,0.85,vUv.y); float pu=0.75+0.25*sin(vUv.y*30.0-uT*6.0); float a=f*e*pu*uA*0.8; gl_FragColor=vec4(max(uC*a,vec3(0.0)),1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); S.condGlow.scale.set(0.2, 1, 0.2); S.cond.add(S.condGlow);
    // corona: a bright ring around the planet's dark disc once it covers the sun (a camera-facing plane through the planet's centre)
    S.coronaU = { uA: { value: 0 }, uRp: { value: 0.45 }, uT: S.tileT || { value: 0 } };
    S.corona = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: S.coronaU, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uA, uRp, uT; varying vec2 vUv;
        void main(){ vec2 q = (vUv - 0.5) * 2.0; float r = length(q), ang = atan(q.y, q.x + 1e-5); float d = r - uRp;
          float st = 0.7 + 0.3 * sin(ang * 13.0 + uT * 0.05) * sin(ang * 7.0 - uT * 0.03);
          float a = d < -0.004 ? 0.0 : (exp(-max(d, 0.0) * 7.0 / max(st, 0.2)) * 0.55 + exp(-(d / 0.012) * (d / 0.012)) * 1.4) * (1.0 - smoothstep(0.85, 1.0, r));
          vec3 c = mix(vec3(1.0, 0.86, 0.66), vec3(0.75, 0.82, 1.0), clamp(d * 4.0, 0.0, 1.0)); gl_FragColor = vec4(max(c * a * uA, vec3(0.0)), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    S.corona.scale.setScalar(S.PR * 2.3); S.corona.renderOrder = -1; S.corona.visible = false; S.planetG.add(S.corona);
    // hits on the shell (off the lit floor) play the shield sound
    b.onDamaged = (amt) => { if (b.dmgTaken < 1) shieldHit(S); };
  }
  function shieldHit(S) { S.shellHit = 1; if (G.headless || G.now - (S.shT || 0) < 0.22) return; S.shT = G.now; Sound.sfx('shield', 0.35, 1.6); }

  // ---- the gate: every frame, from the tile the player stands on
  function nmUpdate(b, dt) {
    const S = b.state, p = G.player, i = p ? tIdx(p.pos.x, p.pos.z) : -1, on = !!p && p.alive && i >= 0 && live(S, i);
    S.onLive = on; S.onT = on ? S.tiles[i] : null;
    const k = on ? 1 : GATE.off; b.dmgTaken = k;
    for (let j = S.siphons.length - 1; j >= 0; j--) { const e = S.siphons[j]; if (!e.alive) { S.siphons.splice(j, 1); continue; } e.dmgTaken = k; }
    S.shellHit = Math.max(0, S.shellHit - dt * 4);
  }
  // ---- Meridian: one slow, always-on set of beams; out (harmless tracers, still) from 0.8 s into each Polarize until 0.4 s after
  // its blast, then a 1.3 s arm-up at the angle where they stopped, creeping the way they will turn (direction re-rolled each relight)
  function ensureSweep(b) {
    const S = b.state; if (S.sweep && S.sweep.nm) return S.sweep;
    const n = 2; S.sweep = { nm: true, n, a: b.angToPlayer() + PI / n, w: 0, tw: SWEEP.w, arm: 0, t: Infinity, len: 24, rev: -1, warn: 0, out: true, relightT: 0, nextDir: 1 };
    return S.sweep;
  }
  const armsNow = (S) => S.step >= 0 ? SWEEP.arms[Math.min(5, S.step)] : 2;
  function relight(b) {
    const S = b.state, sw = ensureSweep(b); sw.out = false; sw.relightT = 0; sw.arm = SWEEP.armT; sw.n = armsNow(S); sw.tw = SWEEP.w * (sw.nextDir || 1);
    for (let i = 0; i < 4; i++) S.lasers[i].grp.visible = i < sw.n; Sound.sfx('charge', 0.7, 0.8);
  }
  function beamsOut(S) { const sw = S.sweep; if (sw && sw.nm && !sw.out) { sw.out = true; sw.relightT = 0; Sound.sfx('warn', 0.5, 0.6); } }
  function nmSweep(b, sw, dt) {
    const S = b.state, p = G.player;
    if (G.state === 'win') { S.sweep = null; for (const L of S.lasers) L.grp.visible = false; return; }
    if (sw.out) { sw.w = damp(sw.w, 0, 6, dt); if (sw.relightT > 0) { sw.relightT -= dt; if (sw.relightT <= 0) relight(b); } }
    else if (sw.arm > 0) { sw.arm -= dt; sw.w = sw.tw * SWEEP.creep; if (sw.arm <= 0) Sound.sfx('laser'); }
    else sw.w = damp(sw.w, sw.tw, 3, dt);
    sw.a += sw.w * dt;
    if (!sw.out && sw.arm <= 0 && p && p.alive && p.pos.y < 1.6) { const pr = Math.hypot(p.pos.x, p.pos.z), pa = Math.atan2(p.pos.x, p.pos.z); for (let i = 0; i < sw.n; i++) { const L = S.lasers[i]; L.cd -= dt; const da = angDiff(sw.a + i / sw.n * TAU, pa); if (pr < sw.len && Math.abs(Math.sin(da) * pr) < 0.75 && Math.cos(da) > 0 && L.cd <= 0) { L.cd = 1.0; p.hurt(SWEEP.dmg, { blockable: true, src: { name: 'Meridian' } }); FX.impact(p.pos.x, 1.2, p.pos.z, 0xff5030, 1); } } }
  }
  // seconds until a beam reaches (x, z) (0 when one is on it). Out: after the relight, in either direction.
  function beamT(S, x, z) {
    const sw = S.sweep; if (!sw || !sw.nm) return Infinity;
    const pr = Math.max(Math.hypot(x, z), 1), pa = Math.atan2(x, z), m = 0.9 / pr, w = SWEEP.w + 0.02;
    const one = (sg, extra) => { let best = Infinity; for (let k = 0; k < sw.n; k++) { let gap = angDiff(sw.a + k / sw.n * TAU, pa) * sg; if (gap < -0.12 - m) gap += TAU; const tt = Math.max(0, gap - m) / w + extra; if (tt < best) best = tt; } return best; };
    if (sw.out) { const base = (S.pol ? S.pol.t + SWEEP.relight : Math.max(0, sw.relightT)) + SWEEP.armT; return Math.min(one(1, base), one(-1, base)); }
    return one(Math.sign(sw.tw) || 1, Math.max(0, sw.arm));
  }
  // which wedge between the beams a point is in (-1 when the beams are out or arming: free to cross)
  function wedge(S, x, z) { const sw = S.sweep; if (!sw || !sw.nm || sw.out || sw.arm > 0.9) return -1; const pa = Math.atan2(x, z), rel = ((pa - sw.a) % TAU + TAU) % TAU; return Math.floor(rel / (TAU / sw.n)); }

  // ---- Polarize, nightmare: survivors keep their colour, the dying colour burns out; flips random per cast; beams out
  function* polarizeNM(b, time, fl) {
    const S = b.state, pat = PATTERNS[pick(deckFor(S))], inv = rnd() < 0.5 ? 1 : 0;
    for (const t of S.tiles) { t.dead = false; t.drain = 0; t.col = t.present && t.warn <= 0 && !(t.ix === 3 && t.iz === 3) ? ((pat(t.ix, t.iz) ^ inv) ? 1 : 2) : 0; }
    let col = rndi(1, 2); setCore(b, col, true); Sound.sfx('charge', 0.8);
    const flipAt = flipSchedule(time, fl[0], fl[1], nmRnd); S.pol = { t: time, nm: true, flips: flipAt.length };
    const sw = S.sweep; if (sw && sw.nm) sw.nextDir = rnd() < 0.5 ? 1 : -1;
    yield* b.cast({ name: 'Polarize', time, onTick: (k, cs) => { S.pol.t = time - cs.t; if (cs.t >= SWEEP.outFrom) beamsOut(S); if (flipAt.length && cs.t >= flipAt[0]) { flipAt.shift(); col = 3 - col; setCore(b, col, true); FX.flash(col === 1 ? CY : MG, 0.08, 6); } } });
    S.pol = null; const p = G.player, hex = col === 1 ? CY : MG; let n = 0;
    if (DRONE.blastKills) for (const e of S.siphons) { if (!e.alive) continue; const j = tIdx(e.pos.x, e.pos.z); if (j >= 0 && S.tiles[j].col === col) { FX.pillar(e.pos.x, e.pos.z, { r: 1.3, h: 10, color: hex, dur: 0.5 }); e.die(); } }
    for (const t of S.tiles) { if (t.col === col) { t.flash = 1; if (!G.headless && (n++ % 2 === 0 || Math.hypot(t.x - p.pos.x, t.z - p.pos.z) < 7)) FX.pillar(t.x, t.z, { r: 1.9, h: 9, color: hex, dur: 0.45, mult: 1.2 }); FX.burst(t.x, 0.2, t.z, { n: 5, color: hex, speed: [1, 4], up: 6, life: [0.3, 0.8], radius: 1.8 }); } }
    Sound.sfx('zap'); Sound.sfx('boom', 0.8); FX.shake(0.5); FX.flash(hex, 0.1, 5);
    const ti = tIdx(p.pos.x, p.pos.z); if (p.alive && ti >= 0 && S.tiles[ti].col === col) p.hurt(380, { blockable: true, src: { name: 'Polarize' } });
    for (const t of S.tiles) if (t.col === col) { t.col = 0; t.dead = true; }
    setCore(b, 0); if (S.sweep && S.sweep.nm && S.sweep.out) S.sweep.relightT = SWEEP.relight;
    yield 0.9;
  }
  // a phase change or the last blow in mid-cast: the condemned colour goes dark, the rest stay lit, no damage
  function clearPolNM(b) { const S = b.state; if (!S.pol && !S.dangerCol) return; const c = S.dangerCol; S.pol = null; if (c) for (const t of S.tiles) if (t.col === c) { t.col = 0; t.dead = true; } if (S.dangerCol) setCore(b, 0); }
  // every per-mechanic state a cut-off coroutine can leave behind (Co.stopTag('phase') skips cleanup) is reset here
  function nmReset(b) {
    const S = b.state; clearPolNM(b); beamsOut(S); if (S.sweep) S.sweep.relightT = 0;
    for (const e of S.siphons.slice()) if (e.alive) e.die(); S.siphons = []; for (const t of S.tiles) t.drain = 0;
    S.heat = 0; if (S.cine) { S.cine = false; Cam.release(); }
  }

  // ---- Siphon Drone: rises from a dead tile away from you, drifts to your tile (or the nearest live one) and drinks it dark
  function siphon(b, near) {
    const S = b.state, p = G.player, idx = (t) => t.iz * N + t.ix;
    const pool = S.tiles.filter((t) => t.present && t.warn <= 0 && idx(t) !== CTR && !live(S, idx(t))), far = (t) => Math.hypot(t.x - p.pos.x, t.z - p.pos.z);
    let cand = pool.filter((t) => near ? far(t) > 7 && far(t) < 15 : far(t) > 9); if (!cand.length) cand = pool.length ? pool : S.tiles.filter((t) => t.present && idx(t) !== CTR);
    cand.sort((a, c) => (near ? far(a) - far(c) : far(c) - far(a))); const t = pick(cand.slice(0, Math.max(1, Math.ceil(cand.length / 2)))); if (!t) return null;
    FX.pillar(t.x, t.z, { r: 1.2, h: 14, color: 0xc060ff, dur: 0.7 }); Sound.sfx('shield', 0.8, 0.6);
    const e = b.spawnAdd({ name: 'Siphon Drone', hp: DRONE.hp, x: t.x, z: t.z, y: -2.5, radius: 0.9, aimY: 1.5, mesh: droneMesh(true), color: 0xc060ff,
      onDamaged(amt, info, ent) { if (ent.dmgTaken < 1) shieldHit(S); },
      update(e) { e.rise = Math.min(1, (e.rise || 0) + G.dt * 1.25); e.pos.y = lerp(-2.5, 0.3, smooth(e.rise)) + Math.sin(G.now * 3 + e.pos.x) * 0.15; if (G.headless) return; const dg = e.group.children[0].userData; dg.ring.rotation.y += G.dt * (e.drink ? 4 : 1.4); dg.flame.value = G.now;
        if (e.drink && vrand() < G.dt * 40) { const k = vrand(), q = e.drink; FX.burst(lerp(q.x, e.pos.x, k), lerp(0.1, e.pos.y + 1.5, k), lerp(q.z, e.pos.z, k), { n: 1, color: 0xffb030, speed: [0, 0.6], life: [0.2, 0.4], size: [0.15, 0.3] }); } },
      *run(e) {
        yield 0.9;
        while (e.alive) {
          const pp = G.player, pi = tIdx(pp.pos.x, pp.pos.z), pt = pi >= 0 ? S.tiles[pi] : null; let tgt = null;
          // the tile you stand on while it is painted (a condemned one too: lead it there and step off late), else the nearest live tile to you
          // the tile you stand on, unless it is next to the core and an outer live tile is left (melee lives on that ring)
          const inner = (q) => Math.abs(q.ix - 3) <= 1 && Math.abs(q.iz - 3) <= 1;
          if (pt && pt.present && pt.col && !pt.dead && pt.warn <= 0 && pi !== CTR && !inner(pt)) tgt = pt;
          else { let bd = 1e9; for (let i = 0; i < S.tiles.length; i++) { if (!live(S, i) || S.tiles[i].warn > 0 || i === CTR) continue; const q = S.tiles[i], d = Math.hypot(q.x - pp.pos.x, q.z - pp.pos.z) + (inner(q) ? DRONE.innerBias : 0); if (d < bd) { bd = d; tgt = q; } } }
          if (!tgt) { yield 0.2; continue; }
          const dx = tgt.x - e.pos.x, dz = tgt.z - e.pos.z, d = Math.hypot(dx, dz);
          if (d > 0.35) { const s = Math.min(d, DRONE.speed * G.dt); e.pos.x += dx / d * s; e.pos.z += dz / d * s; e.facing = dampAng(e.facing, Math.atan2(dx, dz), 6, G.dt); yield; continue; }
          if (!live(S, tgt.iz * N + tgt.ix)) { yield; continue; } // hovering over a condemned tile: it waits for you
          e.drink = tgt; let k = 0; Sound.sfx('charge', 0.5, 1.6);
          while (e.alive && k < DRONE.drink && live(S, tgt.iz * N + tgt.ix)) { k += G.dt; tgt.drain = k / DRONE.drink; yield; }
          tgt.drain = 0; e.drink = null;
          if (e.alive && k >= DRONE.drink) { tgt.col = 0; tgt.dead = true; tgt.flash = 0.6; Sound.sfx('shatter', 0.5, 1.4); if (!G.headless) FX.burst(tgt.x, 0.3, tgt.z, { n: 18, color: 0xffb030, color2: 0xc060ff, speed: [1, 5], up: 4, life: [0.3, 0.7], radius: 1.6 }); yield 0.4; }
        }
      } });
    e.drink = null; S.siphons.push(e); return e;
  }
  const siphonsAlive = (S) => S.siphons.filter((e) => e.alive).length;

  // ---- the phases
  function* chargeRun(b) {
    const S = b.state; nmReset(b); yield 1;
    yield* polarizeNM(b, POL.teachTime[0], [0, 0]); // the teaching beat: the survivors stay lit, the shell is up until you stand on one
    ensureSweep(b).relightT = 0.01; // Meridian lights (2 arms) and stays on
    while (true) { yield* lance(b); yield* polarizeNM(b, POL.teachTime[0], [1, 1]); yield* lance(b, 2); yield* polarizeNM(b, POL.teachTime[0], [1, 2]); }
  }
  function* siphonEnter(b) {
    const S = b.state; nmReset(b); Sound.sfx('roar', 0.8, 2); FX.flash(0xff6030, 0.3, 1.5); FX.shake(0.7); Co.start(eclipse(b, 1), 'fight'); Co.start(Post.lerpTo({ bloom: 0.58, tint: [1.04, 0.98, 1.0] }, 3), 'fight');
    dropTiles(b, P2_DROP, { warn: 3.2 }); S.conduitU.uC.value.setHex(0xff6030); S.trim.emissive.setHex(0xff7a30); yield 3.6;
    ensureSweep(b); relight(b);
  }
  function* siphonRun(b) {
    const S = b.state; siphon(b, true); let k = 0; // straight away, in view
    // then a drone on every other loop if none is alive (one per loop kept a caster on drones half the phase: 75-90 s)
    while (true) { yield* polarizeNM(b, POL.teachTime[1], [1, 2]); if (k++ % 2 === 1 && !siphonsAlive(S)) siphon(b); yield* lance(b, 2); yield* overclock(b, 3, CYCLE.clockDur); }
  }
  // Totality: Critical Mass, then the planet slides fully across the sun (eclipse level 3) in one shot from the near side of the
  // board; the outer ring falls away in silhouette and the lit tiles become the light in the scene
  function* totalityEnter(b) {
    const S = b.state; nmReset(b); b.immune = true;
    const outer = []; for (const t of S.tiles) if (t.present && ring(t.iz * N + t.ix) === 3) outer.push(t.iz * N + t.ix); dropTiles(b, outer, { warn: 3.8 });
    yield* b.cast({ name: 'Critical Mass', time: 2.6, onTick: (k) => { S.heat = k; FX.shake(k * 0.5); } });
    Sound.sfx('bigboom'); Sound.sfx('shatter'); FX.flash(0xd8c8ff, 0.4, 1.6); FX.shake(1.3); FX.explode(0, 4.2, 0, 0xb080ff, 9, 0xe0d0ff);
    Co.start(eclipse(b, 3, 3.4), 'fight'); Co.start(Post.lerpTo({ bloom: 0.66, threshold: 0.88, tint: [1.0, 0.97, 1.08], exposure: 1.06 }, 3), 'fight');
    S.conduitU.uC.value.setHex(0x8a40ff); S.trim.emissive.setHex(0x9a50ff);
    const sx = -S.sunDir.x, sz = -S.sunDir.z, sl = Math.hypot(sx, sz) || 1, ux = sx / sl, uz = sz / sl, lk = [S.sunDir.x * 40, 4 + S.sunDir.y * 40, S.sunDir.z * 40];
    S.cine = true; Co.start(Cam.shot([ux * 24 + uz * 6, 6.5, uz * 24 - ux * 6], [0, 4.5, 0], [ux * 19 - uz * 3, 3.2, uz * 19 + ux * 3], lk, 4.4, 50), 'phase');
    yield 4.4; S.cine = false; Cam.release(); S.ecl3 = true; S.cyc = 0; S.step = 0;
    relight(b);
  }
  function* totalityRun(b) {
    const S = b.state;
    while (true) {
      const st = S.holdStep !== undefined ? S.holdStep : Math.min(5, Math.floor(S.cyc / CYCLE.perStep)); S.step = st;
      if (S.stepAt[st] === undefined) S.stepAt[st] = Math.round(G.ft * 10) / 10;
      if (st >= 3) Music.intensity(3);
      if (st >= 1 && st <= 4 && !S.swallowed[st]) { // Swallow: the red warning with one Lance during it, then the tiles fall
        S.swallowed[st] = true; dropTiles(b, SWALLOW[st], { warn: 3.2 }); yield* lance(b, 1);
        let w = 0; while (w < 2 && SWALLOW[st].some((i) => S.tiles[i].present)) { w += G.dt; yield; }
      }
      yield* polarizeNM(b, POL.time[st], POL.flips[st]);
      if (st >= DRONE.fromStep) { const want = DRONE.cap[st] - siphonsAlive(S); for (let i = 0; i < want; i++) siphon(b); }
      yield* lance(b, 2);
      const odd = S.cyc % 2 === 1;
      if (st >= CYCLE.novaFrom && odd) yield* supernova(b, CYCLE.novaWaves);
      else if (st >= CYCLE.clockFrom && !odd) yield* overclock(b, 3, CYCLE.clockDur);
      if (b.hp > b.maxHp * FINALE) yield CYCLE.breath; // the guaranteed cast pocket: only the beams run
      S.cyc++;
    }
  }
  // Blackout (the last blow, 24 s into the enrage): every remaining tile gets the red warning, the lights go out from the
  // outside in, the floor drops, and the blow lands as your tile goes. He can still be killed until then.
  function* blackout(b) {
    const S = b.state; nmReset(b); S.sweep = null; for (const L of S.lasers) L.grp.visible = false; Music.stop(0.3);
    yield* b.cast({ name: 'Blackout', time: 1.6, onTick: (k) => { S.heat = k; } });
    Sound.sfx('roar', 0.8, 0.6); FX.flash(0x100018, 0.5, 1.2);
    const pres = S.tiles.map((t, i) => i).filter((i) => S.tiles[i].present), top = Math.max(0, ...pres.map(ring));
    for (const i of pres) { const t = S.tiles[i]; t.col = 0; t.dead = false; t.warn = 3.4 + (top - ring(i)) * 0.45; t.back = 0; } Sound.sfx('warn', 1.5, 0.5);
    let w = 0; const p = G.player;
    while (w < 8) { w += G.dt; const i = tIdx(p.pos.x, p.pos.z); if (!p.alive) break; if (w > 3.4 && (i < 0 || !S.tiles[i].present)) { FX.flash(0x000000, 0.7, 1.5); Sound.sfx('bigboom', 0.8); p.hurt(9999, { blockable: false, src: 'enrage', pierce: true }); break; } yield; }
    while (true) yield 1;
  }
  // the kill: the core's panels blow off, the planet slides away and sunlight floods back, every tile flashes white and settles
  function* nmDeath(b) {
    const S = b.state; nmReset(b); S.sweep = null; for (const L of S.lasers) L.grp.visible = false; S.onT = null; S.onLive = false;
    for (const t of S.tiles) if (t.present) { t.col = 0; t.dead = false; t.flash = 1.2; t.warn = 0; }
    const a = Cam.yaw + 0.6, r = 16; Cam.cine = { pos: new V3(-Math.sin(a) * r, 7, -Math.cos(a) * r), look: new V3(0, 4.2, 0), fov: 46 };
    for (let i = 0; i < 6; i++) { FX.explode((vrand() - 0.5) * 3, 4.2 + (vrand() - 0.5) * 2, (vrand() - 0.5) * 3, 0xb080ff, 3 + i * 0.5, 0xffffff); yield 0.1; }
    G.timeScale = 1; Sound.sfx('shatter'); Sound.sfx('bigboom', 0.9);
    Co.start(eclipse(b, 0, 2.0), 'sys'); Co.start(Post.lerpTo(Object.assign({}, b.def.post), 2.0), 'sys');
    let t = 0; while (t < 1.2) { t += G.dt; S.blowK = 9 * smooth(t / 1.2); yield; }
    FX.explode(0, 4.2, 0, 0xffffff, 12, 0xffe8c8); FX.flash(0xfff0d8, 0.6, 1); S.rig.visible = false; yield 0.8;
  }
  // music: the base layers by phase, and from Totality step 3 a driving bass and snare on top
  function nmMusic(base) {
    return Object.assign({}, base, { layers: base.layers.concat([{ v: 'bass', from: 3, pat: '0.0.0.0.0.0.3.5.', oct: 0, len: 1, vol: 0.1 }, { v: 'snare', from: 3, pat: '....x..x....x.xx', vol: 0.17 }, { v: 'lead', from: 3, pat: ['7...5...4..2.0..', '9...7...5..4.2..'], oct: 2, len: 3, vol: 0.05 }]) });
  }

  // ---- what the nightmare looks like each frame (shell, conduit, corona)
  function nmLook(b, dt) {
    const S = b.state, p = G.player;
    S.shellK = damp(S.shellK, S.onLive || b.transitioning || !b.alive ? 0 : 1, 14, dt);
    S.aegis.visible = S.shellK > 0.01 && S.rig.visible; S.aegisU.uA.value = S.shellK; S.aegisU.uHit.value = S.shellHit;
    const on = S.onT && p && b.alive; S.cond.visible = !!on;
    if (on) { const t = S.onT, hex = t.col === 1 ? CY : MG; S.condU.uC.value.setHex(hex); S.condU.uA.value = 1; S.condCore.material.color.setHex(hex).multiplyScalar(1.6);
      _v.set(0, S.rig.position.y, 0).sub(_cv.set(t.x, 0.06, t.z)); const L = _v.length(); S.cond.position.copy(_cv); S.cond.quaternion.setFromUnitVectors(_up, _v.normalize()); S.cond.scale.set(1, L, 1); }
    const cv = S.corona.material.uniforms.uA.value; S.corona.visible = cv > 0.002;
    if (S.corona.visible) { S.corona.lookAt(camera.position); const D = camera.position.distanceTo(S.planetG.position), R = S.PR * S.planetG.scale.x, k = Math.min(0.98, R / Math.max(D, 1)); S.coronaU.uRp.value = R / Math.sqrt(1 - k * k) / (S.PR * 2.3 * S.planetG.scale.x); }
  }

  // ---- the autopilot's view of the nightmare
  function nmDanger(b, x, z) {
    const S = b.state; let best = Infinity; const i = tIdx(x, z);
    // (the condemned colour reads as about to fire: a cast started on it is not worth finishing at a sixth of the damage)
    if (i >= 0) { const q = S.tiles[i]; if (q.warn > 0) best = Math.max(0, q.warn - 0.5); if (S.pol && q.col === S.dangerCol) best = Math.min(best, S.pol.t, 0.6); }
    return Math.min(best, beamT(S, x, z));
  }
  // the bot stands on the best live tile it can reach without crossing a beam (near, far from the next beam, not being drunk),
  // targets a drone first, and does not start a planted cast it cannot finish before a beam, a Lance or a flip reaches it.
  // Bot.sideBlind: ignores the lit floor (plays it like Normal: near the core, in the middle of its wedge). Must fail.
  function nmBot(b, p) {
    const S = b.state, melee = !!p.cls.melee, pw = wedge(S, p.pos.x, p.pos.z), sw = S.sweep;
    const h = { avoid: (x, z) => { const i = tIdx(x, z); if (i < 0 || !S.tiles[i].present) return 5000; const wq = wedge(S, x, z); if (pw >= 0 && wq >= 0 && wq !== pw) return true; if (beamT(S, x, z) < 0.15) return true;
      // the arena's edge test forgives half a metre, so a straight walk can cut a corner over a fallen tile: check the line itself
      const d = Math.hypot(x - p.pos.x, z - p.pos.z), n = Math.ceil(d / 0.4); for (let k = 1; k < n; k++) { const j = tIdx(lerp(p.pos.x, x, k / n), lerp(p.pos.z, z, k / n)); if (j < 0 || !S.tiles[j].present) return 5000; } return false; } };
    const ds = S.siphons.filter((e) => e.alive); let drone = null, dd = 1e9;
    for (const e of ds) { const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) - (e.drink ? 6 : 0); if (d < dd) { dd = d; drone = e; } }
    h.target = drone && (!melee || Math.hypot(drone.pos.x - p.pos.x, drone.pos.z - p.pos.z) < 5.5) ? drone : b;
    const here = tIdx(p.pos.x, p.pos.z); let goal = null;
    if (!Bot.sideBlind) {
      let bs = 1e9;
      // while the beams are out you may cross: prefer a wedge (between the beams where they stopped) that holds more lit tiles
      const wc = []; if (sw && sw.nm && (sw.out || sw.arm > 0.9)) for (let i = 0; i < S.tiles.length; i++) if (i !== CTR && live(S, i) && S.tiles[i].warn <= 0) { const q = S.tiles[i], pa = Math.atan2(q.x, q.z), k = Math.floor((((pa - sw.a) % TAU) + TAU) % TAU / (TAU / sw.n)); wc[k] = (wc[k] || 0) + 1; }
      for (let i = 0; i < S.tiles.length; i++) {
        const q = S.tiles[i]; if (i === CTR || !live(S, i) || q.warn > 0 || ds.some((e) => e.drink === q)) continue;
        // the spot on the tile with the most time before the trailing beam reaches it (you can ride a tile as the wedge turns)
        if (melee && ring(i) > 1) continue; const OF = melee ? OFFS_M : OFFS;
        for (const ox of OF) for (const oz of OF) {
          let ax = q.x + ox, az = q.z + oz; const r = Math.hypot(ax, az) || 1; if (r < 3.2) continue;
          if (melee && r > b.radius + MELEE - 0.5) continue;
          if (pw >= 0 && wedge(S, ax, az) !== pw) continue;
          const tt = Math.hypot(ax - p.pos.x, az - p.pos.z) / 7, bt = beamT(S, ax, az);
          if (bt < tt + 1.0) continue;
          let s = tt * 1.6 - Math.min(bt, 7) * 0.45 + (i === here ? -1.2 : 0) + (melee ? r * 0.15 : 0);
          if (!melee && r > 24) s += 8;
          if (wc.length) { const pa = Math.atan2(ax, az), k = Math.floor((((pa - sw.a) % TAU) + TAU) % TAU / (TAU / sw.n)); s -= 0.8 * Math.min(3, wc[k] || 0); }
          if (s < bs) { bs = s; goal = [ax, az]; }
        }
      }
    }
    if (goal) { h.x = goal[0]; h.z = goal[1]; h.w = 3; }
    else if (sw && sw.nm && !sw.out && sw.n) { // no live tile to reach: the middle of the wedge, near the core
      const cx = p.pos.x, cz = p.pos.z, pa = Math.atan2(cx, cz); let best = 0, bd = 9;
      for (let k = 0; k < sw.n; k++) { const m = sw.a + (k + 0.5) / sw.n * TAU, d = Math.abs(angDiff(m, pa)); if (d < bd) { bd = d; best = m; } }
      const sg = Math.sign(sw.tw) || 1, lead = best + sg * 0.25 * TAU / sw.n, r = melee ? 4.3 : 7.5; h.x = Math.sin(lead) * r; h.z = Math.cos(lead) * r; h.w = 1.5;
    }
    // planted casts: none while walking to a lit tile, none that a beam, a Lance or a flip would cut off
    const onLive = here >= 0 && live(S, here), far = goal ? Math.hypot(goal[0] - p.pos.x, goal[1] - p.pos.z) : 0;
    // (a Lance locks 0.55 s before it fires, so it needs a margin to step out of; bullets close by cut any cast)
    // hits from a dark tile land at GATE.off: hold every attack (a Discharge above all) until standing on the lit tile it walks to
    if ((goal && !onLive) || b.immune) h.holdFire = true; // (and nothing into Critical Mass, when he is immune)
    h.noCast = (goal && far > (onLive ? 1.2 : 0.8)) || Bul.threat(p.pos.x, p.pos.z, 1.8) ? 0 : Math.max(0, Math.min(nmDanger(b, p.pos.x, p.pos.z) - 0.3, Hz.threat(p.pos.x, p.pos.z) - 0.75));
    return h;
  }
  // test hooks for the tools (polfuzz, engcast, nmshots, nmphase)
  const nmTest = {
    BOARDS, PATTERNS, POL, SWEEP, DRONE, CYCLE, GATE, N, TS, HALF, CTR, SWALLOW, P2_DROP, patOk, deckOf, flipSchedule, live, tIdx, beamT, wedge,
    deckFor: (b) => deckFor(b.state),
    // jump the Totality ramp to step n (the board of that step at once); hold: stay at that step (engcast)
    setStep(b, n, hold) { const S = b.state; S.cyc = Math.max(S.cyc, n * CYCLE.perStep); for (let st = 1; st <= Math.min(4, n); st++) if (!S.swallowed[st]) { S.swallowed[st] = true; dropNow(S, SWALLOW[st]); } if (hold) S.holdStep = n; },
  };

  const MUSIC = { bpm: 122, root: 41, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 3, 5, 0, 0, 6, 4],
      layers: [
        { v: 'pulse', pat: '0.0.0.0.0.0.0.0.', oct: 0, len: 1, vol: 0.09 }, { v: 'pad', pat: '0...............', oct: 2, len: 16, vol: 0.09 }, { v: 'kick', pat: 'x...x...x...x...', vol: 0.3 },
        { v: 'hat', from: 1, pat: '..x...x...x...x.', vol: 0.14 }, { v: 'arp', from: 1, pat: '0.4.7.4.0.4.7.9.', oct: 2, len: 1, vol: 0.07 }, { v: 'snare', from: 1, pat: '....x.......x...', vol: 0.2 },
        { v: 'bass', from: 1, pat: '0..0..0.0..0..0.', oct: 0, len: 2, vol: 0.14 },
        { v: 'lead', from: 2, pat: ['0...4...7..6.4..', '2...4...9..7.4..'], oct: 2, len: 3, vol: 0.06 }, { v: 'hat', from: 2, pat: 'xxxxxxxxxxxxxxxx', vol: 0.07 }, { v: 'arp', from: 2, pat: '0479047904790479', oct: 3, len: 1, vol: 0.05 },
      ] };
  G.bosses.push({
    id: 'engine', name: 'PARALLAX', title: 'The Astral Engine', hint: 'A machine', color: '#20d8ff', telegraph: 0xffb030,
    hp: 22000, radius: 2.2, aimY: 4.2, enrage: 420,
    post: { bloom: 0.5, threshold: 0.92, radius: 0.45, exposure: 1.0, vig: 1.05, sat: 1.12, contrast: 1.12, tint: [0.97, 1.0, 1.06] },
    music: MUSIC,
    build,
    *intro(b) { yield* Cam.shot([26, 14, 26], [0, 2, 0], [10, 5, 15], [0, 4, 0], 4.4, 50); },
    phases: [
      { at: 1, *run(b) {
        yield 1;
        while (true) { yield* polarize(b); yield* lance(b); yield* sweep(b, 2, 10, 0.5); yield* overclock(b); yield* polarize(b); yield* lance(b, 2); yield* sweep(b, 2, 9, 0.55, { reverse: true }); }
      } },
      { at: 0.68, skipTo(b) { skipLook(b, 1); }, *enter(b) {
        const S = b.state; S.sweep = null; clearPol(b); Sound.sfx('roar', 0.8, 2); FX.flash(0xff6030, 0.3, 1.5); FX.shake(0.7); Co.start(eclipse(b, 1), 'fight'); Co.start(Post.lerpTo({ bloom: 0.58, tint: [1.04, 0.98, 1.0] }, 3), 'fight');
        dropTiles(b, [0, 6, 42, 48, 3, 21, 27, 45], { warn: 3.2 }); S.conduitU.uC.value.setHex(0xff6030); S.trim.emissive.setHex(0xff7a30); yield 3.6;
      }, *run(b) {
        while (true) {
          spawnDrones(b, 2); Co.start(sweep(b, 2, 14, 0.42, { wait: false }), 'phase'); { let w = 0; while (dronesAlive() && w < 26) { w += G.dt; yield; } } yield 0.8;
          yield* polarize(b, { flips: 1 }); yield* purge(b, 3); yield* lance(b, 2); yield* overclock(b, 3);
          Co.start(sweep(b, 3, 12, 0.5, { wait: false, reverse: true }), 'phase'); yield 2.5; yield* polarize(b, { flips: 1, time: 4 }); yield 4.5; yield* purge(b, 3); yield* lance(b);
        }
      } },
      { at: 0.35, skipTo(b) { skipLook(b, 2); dropNow(b.state, [0, 6, 42, 48, 3, 21, 27, 45]); }, *enter(b) {
        const S = b.state; S.sweep = null; clearPol(b); for (const e of G.ents) if (e.isAdd) e.die(); b.immune = true;
        yield* b.cast({ name: 'Critical Mass', time: 2.6, onTick: (k) => { S.heat = k; FX.shake(k * 0.5); } });
        Sound.sfx('bigboom'); Sound.sfx('shatter'); FX.flash(0xd8c8ff, 0.4, 1.6); FX.shake(1.3); FX.explode(0, 4.2, 0, 0xb080ff, 9, 0xe0d0ff); Co.start(eclipse(b, 2), 'fight'); Co.start(Post.lerpTo({ bloom: 0.62, threshold: 0.9, tint: [1.0, 0.97, 1.07], exposure: 1.0 }, 2), 'fight');
        const outer = []; for (const t of S.tiles) if (t.present && Math.max(Math.abs(t.ix - 3), Math.abs(t.iz - 3)) === 3) outer.push(t.iz * N + t.ix); dropTiles(b, outer, { warn: 3.4 });
        S.conduitU.uC.value.setHex(0x8a40ff); S.trim.emissive.setHex(0x9a50ff); yield 3.8;
      }, *run(b) {
        while (true) {
          yield* supernova(b, 4);
          Co.start(sweep(b, 4, 11, 0.46, { wait: false, reverse: true }), 'phase'); yield 2.2; yield* polarize(b, { flips: 2, time: 4.2 }); yield 4.6;
          spawnDrones(b, 2); yield* lance(b, 2); { let w = 0; while (dronesAlive() && w < 22) { w += G.dt; yield; } }
          yield* purge(b, 3, 10); yield* overclock(b, 4, 7); yield* polarize(b, { flips: 2, time: 3.6 }); yield* lance(b);
        }
      } },
    ],
    // ---- Nightmare ("Totality"): the charge stays and only lit tiles let you hurt it. Two short teaching phases, then Totality
    // (70% of his health) on a floor that only shrinks, ramping every two Polarize cycles. One creeping enrage and Blackout 24 s into it.
    nightmare: {
      hp: NM_HP, enrage: 345, enrageBase: 40, enrageGrow: 4,
      music: nmMusic(MUSIC),
      lastBlow: blackout, death: nmDeath,
      phases: [
        { at: NM_AT[0], music: 0, run: chargeRun },
        { at: NM_AT[1], music: 1, skipTo(b) { skipLook(b, 1); dropNow(b.state, P2_DROP); }, enter: siphonEnter, run: siphonRun },
        { at: NM_AT[2], music: 2, skipTo(b) { skipLook(b, 2); }, enter: totalityEnter, run: totalityRun },
      ],
      danger: nmDanger, bot: nmBot,
    },
    nmTest,
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      if (S.nm) nmUpdate(b, dt);
      // tiles: warning, dropping, returning
      for (const q of S.tiles) {
        if (q.warn > 0) { q.warn -= dt; if (q.warn <= 0) { q.present = false; q.col = 0; if (q.back) q.backT = q.back; Sound.sfx('boom', 0.25, 1.8); q.sx = (vrand() - 0.5) * 2.4; q.sz = (vrand() - 0.5) * 2.4; q.lost = 1; if (!G.headless) FX.burst(q.x, 0, q.z, { n: 14, color: 0xff5020, speed: [2, 6], up: 3, life: [0.3, 0.8], size: [0.1, 0.25], radius: TS * 0.45 }); } }
        if (!q.present && q.backT > 0) { q.backT -= dt; if (q.backT <= 0) { q.present = true; q.backT = 0; q.rx = q.rz = 0; } }
      }
      // lasers
      const sw = S.sweep;
      if (sw && sw.nm) nmSweep(b, sw, dt);
      else if (sw) {
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
        const fall = !q.present, hex = fall ? WARN : q.warn > 0 ? WARN : q.dead ? EMBER : COLS[q.col]; _c.setHex(hex);
        const wave = 0.5 + 0.5 * Math.sin(t * 0.9 - Math.hypot(q.x, q.z) * 0.28); const idle = !fall && !q.warn && !q.col && !q.dead, ov = idle && b.phase >= 2 && !S.pol ? 0.9 * Math.pow(Math.max(0, Math.sin(t * 3.0 - Math.hypot(q.x, q.z) * 0.55)), 2) : 0; if (idle) _c.lerp(_c2.setHex(IDLE2), wave * 0.7 * (1 - ov)).lerp(_c2.setHex(0x8a46ff), ov * 0.85); q.cur.lerp(_c, Math.min(1, dt * 10));
        let k; const K = q.U.uK.value;
        if (fall) { k = 2.2 * Math.max(0, 1 + (q.y - TY) / 14); K.set(1, 0.6, 0.2); }
        else if (q.warn > 0) { k = 2.0 + 1.8 * (0.5 + 0.5 * Math.sin(t * 16)); K.set(1, 0.55, 1); }
        else if (q.dead) { k = (0.34 + 0.1 * Math.sin(t * 1.7 + q.x * 0.7)) * (S.ecl3 ? 0.7 : 1); K.set(0.9, 0.03, 0.06); } // nightmare: a burnt-out tile, a faint ember seam
        else if (q.col) { k = 1.05 + (S.dangerCol === q.col ? 0.55 * (0.5 + 0.5 * Math.sin(t * 10)) : 0); K.set(1, 0.12, 0.8);
          if (S.nm) { if (q.col !== S.dangerCol) k *= S.ecl3 ? 1.35 : 1.12; if (q === S.onT) k += 0.9; if (q.drain > 0) k *= 1 - 0.6 * q.drain * (Math.sin(t * 38) > 0 ? 1 : 0.15); } }
        else { k = (1.2 + 0.6 * wave) * (1 + ov * 0.3); K.set(1.1 + ov * 0.8, 0.22 + 0.15 * wave + ov * 0.1, 0.6); }
        k += q.flash * 5; const pol = !fall && !q.warn && q.col ? q.col : 0; q.U.uPol.value = pol; q.U.uPat.value = pol ? 1.1 : 0;
        q.mat.emissive.copy(q.cur); q.mat.emissiveIntensity = k; q.sideMat.emissive.copy(q.cur); q.sideMat.emissiveIntensity = k * 0.75;
      }
      if (b.phase >= 2 && !S.pol && !S.nm && vrand() < dt * 6) { const c = -HALF + TS * (1 + Math.floor(vrand() * (N - 1))), s0 = -HALF + TS * (1 + Math.floor(vrand() * (N - 2))), A = S.arcV[0], B = S.arcV[1]; if (vrand() < 0.5) { A.set(c, 0.06, s0); B.set(c, 0.06, s0 + TS); } else { A.set(s0, 0.06, c); B.set(s0 + TS, 0.06, c); } FX.lightning(A, B, { color: 0xa070ff, width: 0.065, jag: 0.25, dur: 0.3, mult: 1.6, sparks: false }); }
      if (sw) { const armed = sw.arm <= 0 && sw.t > 0 && !sw.out, fl = sw.warn > 0 ? (Math.sin(t * 40) > 0 ? 1 : 0.25) : 1; for (let i = 0; i < sw.n; i++) { const L = S.lasers[i]; L.grp.rotation.y = sw.a + i / sw.n * TAU; L.mat.color.setHex(sw.warn > 0 ? 0xfff0e0 : 0xffb080).multiplyScalar(armed ? 1.5 * fl : 0.5); L.gU.uA.value = armed ? 0.5 * fl : 0.2; L.gU.uK.value = armed ? 9 : 30; L.fU.uA.value = armed ? 0.28 : 0.12; L.beam.scale.set(armed ? 1 : 0.4, armed ? 1 : 0.4, 1); if (armed && vrand() < dt * 30) { const r = 3 + vrand() * 16, a = L.grp.rotation.y; FX.burst(Math.sin(a) * r, 0.05, Math.cos(a) * r, { n: 1, color: 0xff6030, speed: [0.5, 2.5], up: 2, life: [0.2, 0.5], size: [0.08, 0.2] }); } } }
      { const sh = S.bsh; let n = 0; for (const bb of Bul.list) { if (!bb.shell || n >= 400) continue; const s2 = bb.r * 1.3 * (bb.t < 0.15 ? bb.t / 0.15 : 1); _m4.makeScale(s2, s2, s2); _m4.setPosition(bb.x, bb.y, bb.z); sh.setMatrixAt(n, _m4); sh.setColorAt(n, _c3.setHex(bb.shell)); n++; }
        sh.count = n; if (n) { sh.instanceMatrix.needsUpdate = true; sh.instanceColor.needsUpdate = true; } }
      // core
      S.heat = Math.max(0, S.heat - dt * 0.6); const dc = S.dangerCol, ch = dc === 1 ? CY : dc === 2 ? MG : CORE_COL[Math.min(2, Math.max(0, b.phase))];
      _c.setHex(ch); const hc = S.haloMat.uniforms.uC.value; hc.lerp(_c, Math.min(1, dt * 12)); S.coreL.color.copy(hc);
      const hk = Math.min(2.2, 1.3 + S.heat * 0.6 + (dc ? 0.4 : 0));
      S.coreMat.color.copy(hc).multiplyScalar(0.9 + S.heat * 0.25); S.innerU.uC.value.copy(hc).multiplyScalar(1.0 + S.heat * 0.2); S.innerU.uHot.value = (dc ? 1.3 : 0.9) * (0.8 + 0.2 * Math.sin(t * 2.4)) + S.heat * 0.3 + b.phase * 0.1; S.hotM.color.copy(hc).lerp(_c2.setRGB(1, 1, 1), 0.55).multiplyScalar(1.5 + S.heat * 0.4); S.inner.rotation.y -= dt * 2.6; S.inner.rotation.z += dt * 1.1; for (let i = 0; i < 3; i++) { const U = S.shellU[i]; U.uC.value.copy(hc).multiplyScalar(hk * 0.45); U.uA.value = (0.14 + 0.1 * Math.sin(t * 2.6 + i * 2.1)) * (1 + S.heat * 0.4) * (1 - i * 0.25); } S.spikeMat.color.copy(hc).multiplyScalar(hk * 0.5); S.gapMat.emissive.copy(hc); S.gapMat.emissiveIntensity = Math.min(1.5, 0.7 + b.phase * 0.25 + S.heat * 0.5 + (dc ? 0.3 : 0)); S.plateU.uHC.value.copy(hc); S.plateU.uHK.value = 0.5 + b.phase * 0.3 + S.heat * 0.6 + (dc ? 0.3 : 0); for (const gc of S.gapClones) { gc.emissive.copy(hc); gc.emissiveIntensity = S.gapMat.emissiveIntensity; }
      S.poolU.uC.value.copy(hc); S.tetherU.uC.value.copy(hc).multiplyScalar(1.4); S.tetherU.uT.value = t % 100; S.poolU.uA.value = 0.2 + S.heat * 0.1 + (dc ? 0.08 : 0);
      S.haloMat.uniforms.uA.value = 0.32 + S.heat * 0.2;
      S.coreL.intensity = 40 + S.heat * 50 + (dc ? 40 : 0) + b.phase * 10; S.halo.scale.setScalar(1 + S.heat * 0.3 + Math.sin(t * 3) * 0.04 + S.open * 0.35);
      S.heart.rotation.y += dt * 1.2; S.heart.rotation.x += dt * 0.5; S.core.rotation.z += dt * 2; S.heart.scale.setScalar(1 + S.open * 0.25 + S.heat * 0.15 + Math.sin(t * 5) * 0.03);
      for (const o of S.orbitL) o.rotation.z += dt * 2.5;
      for (let pi = 0; pi < S.panels.length; pi++) { const pn = S.panels[pi]; const off = 0.25 + (S.blowK || 0) + S.open * 0.3 + S.heat * 0.1 + (b.phase >= 2 && pi % 3 === 0 ? 0.9 + 0.3 * Math.sin(t * 0.7 + pi) : 0) + Math.max(0, Math.sin(t * 1.3 + pn.ph)) * 0.05; pn.m.position.copy(pn.cen).addScaledVector(pn.n, off); }
      S.rig.position.y = 4.2 + Math.sin(t * 0.9) * 0.25;
      const sp = 0.5 + b.phase * 0.5 + S.heat * 3; S.gyro[0].rotation.x += dt * sp; S.gyro[0].rotation.y += dt * sp * 0.3; S.gyro[1].rotation.y += dt * sp * 0.8; S.gyro[1].rotation.z += dt * sp * 0.4; S.gyro[2].rotation.x -= dt * sp * 0.6; S.gyro[2].rotation.z += dt * sp * 0.7;
      for (let i = 0; i < S.finTrims.length; i++) { const fm = S.finTrims[i]; fm.emissive.copy(S.trim.emissive); fm.emissiveIntensity = i % 2 ? 0.22 + 0.06 * b.phase + S.heat * 0.15 : 0.6 + S.heat * 0.15; } TICKU.uC.value.copy(S.trim.emissive); LAMPU.uC.value.copy(S.trim.emissive).multiplyScalar(0.9); TICKU.uT.value = t % 1000; for (const tm of S.trimClones) tm.emissive.copy(S.trim.emissive);
      // phase 2+: arcs jump between the gimbal rings
      if (b.phase >= 1 && vrand() < dt * (b.phase * 1.6)) { const i = Math.floor(vrand() * 2), j = i + 1, A = S.arcV[0], B = S.arcV[1], a1 = vrand() * TAU, a2 = a1 + (vrand() - 0.5) * 0.8;
        A.set(Math.cos(a1) * S.GR[i], Math.sin(a1) * S.GR[i], 0); S.gyro[i].localToWorld(A); B.set(Math.cos(a2) * S.GR[j], Math.sin(a2) * S.GR[j], 0); S.gyro[j].localToWorld(B); FX.lightning(A, B, { color: b.phase >= 2 ? 0xb890ff : 0xff9a50, width: 0.05, jag: 0.35, dur: 0.14, mult: 1.6, sparks: false }); }
      // phase debris under the arena
      { const want = [0, 18, 40][Math.min(2, b.phase)], dm = S.dummy; S.debris.count = want;
        for (let i = 0; i < want; i++) { const q = S.deb[i]; if (q.y < -45) { const tt = S.tiles[Math.floor(vrand() * S.tiles.length)]; q.x = tt.x + (vrand() - 0.5) * 4; q.z = tt.z + (vrand() - 0.5) * 4; q.y = -1.5 - vrand() * 30; q.vy = 0.6 + vrand() * 1.6; q.rx = vrand() * TAU; q.ry = vrand() * TAU; q.sr = (vrand() - 0.5) * 2; q.s = 0.5 + vrand() * 0.9; }
          q.y -= q.vy * dt; q.rx += q.sr * dt; q.ry += q.sr * 0.7 * dt; dm.position.set(q.x, q.y, q.z); dm.rotation.set(q.rx, q.ry, 0); dm.scale.setScalar(q.s); dm.updateMatrix(); S.debris.setMatrixAt(i, dm.matrix); }
        S.debris.instanceMatrix.needsUpdate = true; S.debris.material.emissive.copy(S.trim.emissive).multiplyScalar(0.25); }
      S.orbit.rotation.y += dt * 0.02; S.gate.rotation.z += dt * 0.015; S.lipU.uC.value.copy(S.conduitU.uC.value); S.nodeL.material.color.copy(S.trim.emissive).multiplyScalar(0.75 + 0.45 * Math.max(0, Math.sin(t * 3))); S.nodeHU.uC.value.copy(S.nodeL.material.color); S.hazeU.uC.value.copy(S.fog.color).multiplyScalar(3.2);
      const d = S.dummy;
      for (let i = 0; i < S.shards.length; i++) { const u = S.shards[i]; u.a += dt * u.sp * (1 + b.phase * 0.6); const r = 5.6 + b.phase * 0.3 + S.heat * 0.4, ce = Math.cos(u.e * (1 - S.open * 0.5)); d.position.set(Math.sin(u.a) * r * ce, Math.sin(u.e) * r * (0.55 - S.open * 0.2), Math.cos(u.a) * r * ce); d.lookAt(0, 0, 0); d.rotateX(PI / 2); d.rotateY(0.95); d.scale.set(1.15, 1.15 * (1 + b.phase * 0.18), 1.15); d.updateMatrix(); for (const m of S.fins[i]) m.matrix.copy(d.matrix); }
      // drone tethers
      for (let i = S.tethers.length - 1; i >= 0; i--) { const a = S.tethers[i]; if (!a.alive) { S.tethers.splice(i, 1); continue; } if (vrand() < dt * 30) { const k = vrand(); FX.burst(lerp(a.pos.x, 0, k), lerp(1.6, 4.2, k), lerp(a.pos.z, 0, k), { n: 1, color: 0xffb030, speed: [0, 0.6], life: [0.2, 0.45], size: [0.15, 0.3] }); } }
      S.planet.rotation.y += dt * 0.004; S.planet.material.uniforms.uT.value = t * 0.02 % 100;
      const bl = 0.6 + 0.4 * Math.max(0, Math.sin(t * 2.2)); for (const bc of S.beacons) bc.material.color.setRGB(3 * bl, 0.35 * bl, 0.2 * bl);
      if (S.nm) nmLook(b, dt);
    },
    danger(b, x, z) {
      const S = b.state; let best = Infinity; const i = tIdx(x, z);
      if (i >= 0) { const q = S.tiles[i]; if (q.warn > 0) best = Math.max(0, q.warn - 0.5); if (S.pol && q.col === S.dangerCol) best = Math.min(best, S.pol.t); }
      const sw = S.sweep; if (sw && sw.t > 0) { const pr = Math.hypot(x, z), pa = Math.atan2(x, z), w = Math.abs(sw.arm > 0 ? sw.tw : sw.w) + 0.02, sg = Math.sign(sw.arm > 0 ? sw.tw : sw.w) || 1; for (let k = 0; k < sw.n; k++) { let gap = angDiff(sw.a + k / sw.n * TAU, pa) * sg; if (gap < -0.12 - 0.9 / Math.max(pr, 1)) gap += TAU; const tt = Math.max(0, gap - 0.9 / Math.max(pr, 1)) / w + Math.max(0, sw.arm); if (tt < best) best = tt; } }
      return best;
    },
    bot(b, p) {
      const S = b.state, add = G.ents.find((e) => e.isAdd && e.alive), h = { avoid: (x, z) => { const i = tIdx(x, z); return i < 0 || !S.tiles[i].present; } };
      if (add) { h.target = add; if (p.cls.melee) { const d = Math.hypot(p.pos.x - add.pos.x, p.pos.z - add.pos.z) || 1; h.x = add.pos.x + (p.pos.x - add.pos.x) / d * 2.2; h.z = add.pos.z + (p.pos.z - add.pos.z) / d * 2.2; } } else h.target = b;
      const sw = S.sweep; if (sw && sw.t > 0 && (p.cls.melee || b.def.danger(b, p.pos.x, p.pos.z) < 1.6)) {
        const cx = h.x === undefined ? p.pos.x : h.x, cz = h.z === undefined ? p.pos.z : h.z, pa = Math.atan2(cx, cz); let best = 0, bd = 9;
        for (let k = 0; k < sw.n; k++) { const m = sw.a + (k + 0.5) / sw.n * TAU, d = Math.abs(angDiff(m, pa)); if (d < bd) { bd = d; best = m; } }
        const r = add ? Math.max(3.2, Math.hypot(cx, cz)) : p.cls.melee ? 4.3 : 7.5; if (!add || bd > 0.5) { h.x = Math.sin(best) * r; h.z = Math.cos(best) * r; h.w = 1.5; }
      }
      return h;
    },
  });
  const _c = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color(), _m4 = new THREE.Matrix4(), _v = new V3();
  const _cv = new V3(), _up = new V3(0, 1, 0);
})();
