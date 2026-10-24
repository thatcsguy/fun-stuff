// =====================================================================
// 05_world.js: the orrery arena and the sky.
// - three engraved brass ring tracks (canvas textures, emissive inlay,
//   shader-driven gaps / arrows / rime / glow), drifting broken chunks,
//   aurora flood overlays, the faint star-chart disc, menu orrery props,
//   distant armillary rings and orrery arms with planets
// - generated PMREM env map for the brass
// - sky presets menu / night / aurora / collapse with intensity 0-3:
//   baked nebula cube (crossfaded), live stars, constellations, meteors,
//   aurora curtains, storm lightning, swollen sun + corona, black hole
//   with lensing + accretion disk. Smooth transitions between all.
// =====================================================================
(() => {
  const T = THREE;
  const V = T.Vector3, C = T.Color;
  const TAU = Math.PI * 2;
  let ready = false;
  const W = {};                 // internal state
  const tmpV = new V(), tmpV2 = new V(), tmpC = new C();
  const col = (c, d = '#ffffff') => { try { return c == null ? new C(d) : c.isColor ? c.clone() : new C(c); } catch (e) { return new C(d); } };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const SHADER_TAIL = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';
  const RING_HW = G.TRACK_W / 2;   // half track width (0.65)

  // shared GLSL noise
  const NOISE = /* glsl */`
    float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    vec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
    float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
    float fbm3(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
  `;

  // tileable 4-channel fbm noise texture (cheap stand-in for per-pixel fbm in big screen-area shaders)
  let noiseTex = null;
  function getNoiseTex() {
    if (noiseTex) return noiseTex;
    const N = 256, data = new Uint8Array(N * N * 4);
    const lat = (P, seed) => { const a = new Float32Array(P * P); for (let i = 0; i < a.length; i++) a[i] = hash(i * 1.37 + seed * 91.7); return a; };
    const chans = [[4, 8, 16, 32], [8, 16, 32, 64], [16, 32, 64, 128], [6 * 0 + 4, 16, 64, 128]].map((ps, ci) => ps.map((P, k) => ({ P, a: lat(P, ci * 10 + k), w: Math.pow(0.5, k) })));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      for (let c = 0; c < 4; c++) {
        let v = 0, ws = 0;
        for (const o of chans[c]) {
          const fx = x / N * o.P, fy = y / N * o.P, ix = Math.floor(fx), iy = Math.floor(fy);
          let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
          const P = o.P, A = o.a, x0 = ix % P, y0 = iy % P, x1 = (ix + 1) % P, y1 = (iy + 1) % P;
          const v0 = A[y0 * P + x0] * (1 - tx) + A[y0 * P + x1] * tx, v1 = A[y1 * P + x0] * (1 - tx) + A[y1 * P + x1] * tx;
          v += (v0 * (1 - ty) + v1 * ty) * o.w; ws += o.w;
        }
        data[(y * N + x) * 4 + c] = Math.round(G.clamp(v / ws) * 255);
      }
    }
    noiseTex = new T.DataTexture(data, N, N, T.RGBAFormat);
    noiseTex.wrapS = noiseTex.wrapT = T.RepeatWrapping; noiseTex.magFilter = T.LinearFilter; noiseTex.minFilter = T.LinearMipmapLinearFilter; noiseTex.generateMipmaps = true; noiseTex.needsUpdate = true;
    return noiseTex;
  }

  // ==================================================================
  // Canvas textures
  // ==================================================================
  function engraveTile(emissive) {
    // one tile along the track: u (x) = along the ring, v (y) = across (0 inner edge .. 1 outer edge)
    const w = 512, h = 256;
    return G.canvasTex(w, h, (x) => {
      if (!emissive) {
        // brushed brass
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#6e4e22'); g.addColorStop(0.07, '#b48a44'); g.addColorStop(0.5, '#caa05a'); g.addColorStop(0.93, '#b48a44'); g.addColorStop(1, '#6e4e22');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 700; i++) {
          const y = Math.random() * h, a = Math.random() * 0.08;
          x.fillStyle = Math.random() < 0.5 ? `rgba(255,236,190,${a})` : `rgba(60,35,10,${a})`;
          x.fillRect(Math.random() * w - 40, y, 40 + Math.random() * 260, 1);
        }
        // patina speckle
        for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(40,26,10,${Math.random() * 0.12})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, Math.random() * 3, 0, TAU); x.fill(); }
      } else { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); }
      const ink = emissive ? null : 'rgba(40,24,6,0.85)', hi = emissive ? null : 'rgba(255,240,200,0.35)';
      const line = (x0, y0, x1, y1, lw, glowA) => {
        if (emissive) { if (!glowA) return; x.strokeStyle = `rgba(255,214,140,${glowA})`; x.lineWidth = lw; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); return; }
        x.strokeStyle = hi; x.lineWidth = lw; x.beginPath(); x.moveTo(x0, y0 + 1.2); x.lineTo(x1, y1 + 1.2); x.stroke();
        x.strokeStyle = ink; x.lineWidth = lw; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
      };
      // border grooves
      for (const v of [0.075, 0.925]) line(0, v * h, w, v * h, 2.2, 0.5);
      for (const v of [0.11, 0.89]) line(0, v * h, w, v * h, 1, 0);
      // degree ticks on the outer band (v 0.70 .. 0.89)
      for (let i = 0; i <= 30; i++) {
        const u = i / 30 * w, major = i % 6 === 0, mid = i % 3 === 0;
        const len = major ? 0.17 : mid ? 0.11 : 0.06;
        line(u, 0.89 * h, u, (0.89 - len) * h, major ? 2.4 : 1.3, major ? 0.55 : 0.18);
      }
      // centre inlay channel (the emissive line)
      if (emissive) {
        const g2 = x.createLinearGradient(0, 0.44 * h, 0, 0.56 * h);
        g2.addColorStop(0, 'rgba(255,200,110,0)'); g2.addColorStop(0.35, 'rgba(255,225,160,0.85)'); g2.addColorStop(0.5, 'rgba(255,250,225,1)'); g2.addColorStop(0.65, 'rgba(255,225,160,0.85)'); g2.addColorStop(1, 'rgba(255,200,110,0)');
        x.fillStyle = g2; x.fillRect(0, 0.44 * h, w, 0.12 * h);
      } else {
        x.fillStyle = 'rgba(30,18,4,0.9)'; x.fillRect(0, 0.465 * h, w, 0.07 * h);
        x.fillStyle = 'rgba(255,240,200,0.3)'; x.fillRect(0, 0.535 * h, w, 2);
      }
      // glyph band on the inner side (v 0.14 .. 0.38): one zodiac-like glyph per tile + star dots
      const gy = 0.26 * h, gx = w / 2, R = 0.085 * h;
      x.save(); x.translate(gx, gy); x.lineCap = 'round';
      const st = (lw, a) => { if (emissive) { x.strokeStyle = `rgba(255,214,140,${a})`; x.lineWidth = lw; } else { x.strokeStyle = ink; x.lineWidth = lw; } };
      const kind = Math.floor(Math.random() * 6);
      st(2.6, 0.5); x.beginPath();
      if (kind === 0) { x.arc(0, 0, R, 0, TAU); x.moveTo(-R, 0); x.lineTo(R, 0); x.moveTo(0, -R); x.lineTo(0, R); }
      else if (kind === 1) { x.arc(0, 0, R, Math.PI * 0.3, Math.PI * 1.7); x.moveTo(R * 0.4, -R * 0.6); x.arc(R * 0.1, 0, R * 0.7, -Math.PI * 0.6, Math.PI * 0.6); }
      else if (kind === 2) { x.arc(-R * 0.5, 0, R * 0.5, 0, TAU); x.moveTo(0, 0); x.lineTo(R * 1.1, 0); x.lineTo(R * 0.7, -R * 0.35); x.moveTo(R * 1.1, 0); x.lineTo(R * 0.7, R * 0.35); }
      else if (kind === 3) { for (let k = -1; k <= 1; k += 2) { x.moveTo(-R, k * R * 0.35); for (let i = 0; i <= 8; i++) x.lineTo(-R + i * R / 4, k * R * 0.35 + (i % 2 ? -1 : 1) * R * 0.22); } }
      else if (kind === 4) { x.arc(0, -R * 0.3, R * 0.55, Math.PI, 0); x.moveTo(0, -R * 0.3); x.lineTo(0, R); x.moveTo(-R * 0.45, R * 0.45); x.lineTo(R * 0.45, R * 0.45); }
      else { x.moveTo(-R, R); x.lineTo(0, -R); x.lineTo(R, R); x.moveTo(-R * 0.55, R * 0.15); x.lineTo(R * 0.55, R * 0.15); x.arc(0, -R, R * 0.2, 0, TAU); }
      x.stroke(); x.restore();
      // tiny stars around the glyph band
      for (let i = 0; i < 10; i++) {
        const sx = (i + 0.5) / 10 * w + (Math.random() - 0.5) * 18, sy = (0.17 + Math.random() * 0.18) * h;
        if (Math.abs(sx - gx) < R * 2.2) continue;
        if (emissive) { x.fillStyle = `rgba(255,230,170,${0.25 + Math.random() * 0.3})`; } else x.fillStyle = ink;
        x.beginPath(); x.arc(sx, sy, 1.4 + Math.random() * 1.6, 0, TAU); x.fill();
      }
      // separators between glyph cells
      line(0, 0.15 * h, 0, 0.38 * h, 2, 0.3); line(w - 1, 0.15 * h, w - 1, 0.38 * h, 2, 0.3);
    });
  }

  function chartTexture(size) {
    return G.canvasTex(size, size, (x, w) => {
      const c = w / 2, S = w / 36;            // world units -> px (disc radius 18)
      x.clearRect(0, 0, w, w);
      x.translate(c, c);
      const ln = (a) => `rgba(255,220,160,${a})`;
      x.strokeStyle = ln(0.5); x.lineWidth = Math.max(1, w / 1400);
      // concentric circles
      for (const r of [2.2, 3.6, 7.25, 10.75, 14.2, 15.4, 16.6, 17.6]) { x.globalAlpha = r > 14 ? 0.9 : 0.55; x.beginPath(); x.arc(0, 0, r * S, 0, TAU); x.stroke(); }
      x.globalAlpha = 1;
      // degree ticks on the rim
      for (let i = 0; i < 360; i++) {
        const a = i / 360 * TAU, l = i % 10 === 0 ? 1.0 : i % 5 === 0 ? 0.6 : 0.3;
        x.strokeStyle = ln(i % 10 === 0 ? 0.85 : 0.45);
        x.beginPath(); x.moveTo(Math.cos(a) * 17.6 * S, Math.sin(a) * 17.6 * S); x.lineTo(Math.cos(a) * (17.6 - l) * S, Math.sin(a) * (17.6 - l) * S); x.stroke();
      }
      // numerals every 30 deg
      x.fillStyle = ln(0.8); x.font = `${Math.round(S * 0.65)}px "Palatino Linotype", Palatino, Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU; x.save(); x.rotate(a + Math.PI / 2); x.fillText(String(i * 30), 0, -16.0 * S); x.restore();
      }
      // radial spokes (hour lines)
      x.strokeStyle = ln(0.22);
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; x.beginPath(); x.moveTo(Math.cos(a) * 2.2 * S, Math.sin(a) * 2.2 * S); x.lineTo(Math.cos(a) * 14.2 * S, Math.sin(a) * 14.2 * S); x.stroke(); }
      // ecliptic (offset circle) + tropic arcs
      x.strokeStyle = ln(0.35); x.setLineDash([S * 0.25, S * 0.2]); x.beginPath(); x.arc(S * 1.6, -S * 1.1, 11.8 * S, 0, TAU); x.stroke(); x.setLineDash([]);
      // constellation figures
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 16; k++) {
        const a = rnd() * TAU, r = 3 + rnd() * 13.5, cx = Math.cos(a) * r * S, cy = Math.sin(a) * r * S;
        const n = 4 + Math.floor(rnd() * 4), pts = [];
        for (let i = 0; i < n; i++) pts.push([cx + (rnd() - 0.5) * 3.2 * S, cy + (rnd() - 0.5) * 3.2 * S]);
        x.strokeStyle = ln(0.38); x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) x.lineTo(pts[i][0], pts[i][1]); x.stroke();
        for (const p of pts) { x.fillStyle = ln(0.8); x.beginPath(); x.arc(p[0], p[1], S * (0.03 + rnd() * 0.05), 0, TAU); x.fill(); }
      }
      // scattered faint stars
      for (let i = 0; i < 900; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * 17.4 * S; x.fillStyle = ln(0.15 + rnd() * 0.45); x.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.4, 1.4); }
      // zodiac band glyph marks between 15.4 and 16.6 rings handled by numerals; small diamonds at 15 deg
      for (let i = 0; i < 24; i++) { const a = (i + 0.5) / 24 * TAU; x.save(); x.rotate(a); x.translate(0, -15.0 * S); x.fillStyle = ln(0.6); x.beginPath(); x.moveTo(0, -S * 0.18); x.lineTo(S * 0.12, 0); x.lineTo(0, S * 0.18); x.lineTo(-S * 0.12, 0); x.fill(); x.restore(); }
    });
  }

  function planetTexture(kind) {
    return G.canvasTex(256, 128, (x, w, h) => {
      if (kind === 'gas') {
        for (let y = 0; y < h; y++) { const t = y / h; const b = Math.sin(t * 22 + Math.sin(t * 7) * 2) * 0.5 + 0.5; x.fillStyle = `rgb(${150 + b * 70 | 0},${100 + b * 60 | 0},${60 + b * 30 | 0})`; x.fillRect(0, y, w, 1); }
        x.fillStyle = 'rgba(180,70,40,0.6)'; x.beginPath(); x.ellipse(w * 0.6, h * 0.62, 14, 7, 0, 0, TAU); x.fill();
      } else if (kind === 'ice') {
        const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#dff3ff'); g.addColorStop(0.5, '#6fa8c8'); g.addColorStop(1, '#dff3ff'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.3})`; x.fillRect(Math.random() * w, Math.random() * h, 30, 2); }
      } else {
        x.fillStyle = '#7a6a5a'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '40,30,25' : '200,180,150'},${Math.random() * 0.4})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 9, 0, TAU); x.fill(); }
      }
    });
  }

  // ==================================================================
  // Env map
  // ==================================================================
  let pmrem = null, envRT = null;
  function makeEnv(e) {
    try {
      pmrem = pmrem || new T.PMREMGenerator(G.renderer);
      const es = new T.Scene();
      const mat = new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false,
        uniforms: { a: { value: col(e.top) }, b: { value: col(e.mid) }, c: { value: col(e.bot) }, d: { value: col(e.panel) }, f: { value: col(e.panel2 || e.panel) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: `uniform vec3 a, b, c, d, f; varying vec3 vP; void main(){ vec3 n = normalize(vP); float y = n.y;
          vec3 col = y > 0. ? mix(b, a, pow(y, .5)) : mix(b, c, pow(-y, .35));
          col += b * 1.6 * pow(1. - abs(y), 12.);
          // broad warm lobe where the track tops reflect (upper far sky), plus a sharper sheen band
          float l = max(0., dot(n, normalize(vec3(0., .78, -.62))));
          col += d * (pow(l, 4.) * .32 + pow(l, 60.) * 1.4);
          float band = exp(-pow((y - .66) / .025, 2.)) * smoothstep(.2, -.6, n.z);
          col += f * band * 1.1;
          gl_FragColor = vec4(col, 1.); }`,
      });
      es.add(new T.Mesh(new T.SphereGeometry(10, 48, 24), mat));
      // soft-box panels for crisp highlights on bevels / boss metal
      const panels = [[e.panel, 2.6, [-5, 6, 4], 4, 1.4], [e.rim || '#8090ff', 1.4, [6, 2, 5], 3, 2.2], [e.rim || '#8090ff', 1.0, [0, -6, 6], 6, 1]];
      for (const [c, k, p, sw, sh] of panels) {
        const m = new T.Mesh(new T.PlaneGeometry(sw, sh), new T.MeshBasicMaterial({ color: col(c).multiplyScalar(k), side: T.DoubleSide }));
        m.position.set(...p); m.lookAt(0, 0, 0); es.add(m);
      }
      const rt = pmrem.fromScene(es, 0.025);
      if (envRT) envRT.dispose();
      envRT = rt; G.scene.environment = rt.texture;
      es.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    } catch (err) { G.log.error('world.makeEnv', err); }
  }

  // ==================================================================
  // Rings
  // ==================================================================
  const RING_PROFILE = (R) => {
    const r0 = R - RING_HW, r1 = R + RING_HW, top = 0.0, b = -0.24;
    const pts = [[r0 + 0.07, b], [r0, b + 0.07], [r0, top - 0.06], [r0 + 0.025, top - 0.015], [r0 + 0.07, top]];
    for (let i = 1; i < 9; i++) pts.push([r0 + 0.07 + (r1 - r0 - 0.14) * i / 9, top]);
    pts.push([r1 - 0.07, top], [r1 - 0.025, top - 0.015], [r1, top - 0.06], [r1, b + 0.07], [r1 - 0.07, b]);
    return pts.reverse().map(([x, y]) => new T.Vector2(x, y));
  };
  function ringGeometry(R, segs, phiStart = 0, phiLen = TAU) {
    const g = new T.LatheGeometry(RING_PROFILE(R), segs, phiStart, phiLen);
    // replace v with a radial coordinate so the engraving maps across the top surface
    const p = g.attributes.position, uv = g.attributes.uv;
    const r0 = R - RING_HW, r1 = R + RING_HW;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i));
      uv.setY(i, G.clamp((r - r0) / (r1 - r0)));
      uv.setX(i, (phiStart + uv.getX(i) * phiLen) / TAU);
    }
    uv.needsUpdate = true;
    return g;
  }
  const RING_UNIFORMS = () => ({
    uTime: { value: 0 }, uR: { value: 9 }, uHW: { value: RING_HW },
    uGaps: { value: Array.from({ length: 8 }, () => new V(0, 0, 0)) }, uGapN: { value: 0 },
    uInlayCol: { value: new C('#ffc070') }, uInlay: { value: 0.9 },
    uGlowCol: { value: new C('#ffffff') }, uGlow: { value: 0 },
    uArrowDir: { value: 1 }, uArrowShow: { value: 0 }, uArrowCol: { value: new C('#5fe3ff') },
    uRime: { value: 0 }, uFlood: { value: 0 }, uCrackCol: { value: new C('#ffb060') }, uBeat: { value: 0 },
  });
  function ringMaterial(map, emap, R, reps) {
    const m = new T.MeshStandardMaterial({ map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 1, metalness: 0.9, roughness: 0.33, envMapIntensity: 1.25, color: 0xffffff });
    const u = RING_UNIFORMS(); u.uR.value = R;
    m.userData.u = u;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRingPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRingPos = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vRingPos; uniform float uTime, uR, uHW, uInlay, uGlow, uArrowDir, uArrowShow, uRime, uFlood, uBeat; uniform int uGapN;
        uniform vec3 uGaps[8]; uniform vec3 uInlayCol, uGlowCol, uArrowCol, uCrackCol;
        float rh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float rn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(rh(i), rh(i + vec2(1, 0)), f.x), mix(rh(i + vec2(0, 1)), rh(i + vec2(1, 1)), f.x), f.y); }
        float gRing_th, gRing_cr, gRing_ac, gRing_frost;`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        gRing_th = atan(-vRingPos.z, vRingPos.x);
        float rr = length(vRingPos.xz); gRing_ac = (rr - uR) / uHW; gRing_cr = 0.;
        for (int i = 0; i < 8; i++) { if (i >= uGapN) break; vec3 g = uGaps[i];
          float d = abs(mod(gRing_th - g.x + 9.42477796, 6.28318531) - 3.14159265) * uR;   // arc distance from the gap centre
          float hw = g.y * uR * g.z;                                                         // half width (world units) * open
          float jag = (rn(vec2(rr * 7. + float(i) * 3.1, gRing_th * 3.)) - .5) * .5 * g.z + (rn(vec2(rr * 23., float(i))) - .5) * .18 * g.z;
          if (g.z > .001 && d < hw + jag) discard;
          gRing_cr = max(gRing_cr, smoothstep(.45, 0., d - hw - jag) * g.z); }
        gRing_frost = 0.;
        if (uRime > .001) {
          float n = rn(vRingPos.xz * 6.) * .55 + rn(vRingPos.xz * 23.) * .3 + rn(vRingPos.xz * 61.) * .15;
          gRing_frost = clamp((uRime * 1.05 - .42 + abs(gRing_ac) * .5 - vRingPos.y * 2. - n * .85) * 2.2, 0., 1.) * .46;   // capped: the brass must still read gold under the rime
        }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
        { float rr0 = length(vRingPos.xz);
          // patina: low-frequency tone variation + fine circumferential brushing
          float pat = rn(vRingPos.xz * .55) * .6 + rn(vRingPos.xz * 1.7) * .4;
          diffuseColor.rgb *= mix(vec3(.84, .8, .74), vec3(1.08, 1.04, .98), pat);
          diffuseColor.rgb *= .94 + .1 * rn(vec2(rr0 * 55., 1.7)); }
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.26, .36, .48), gRing_frost * .7);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor *= .78 + .44 * rn(vec2(length(vRingPos.xz) * 38., 3.1)) * (.6 + .4 * rn(vRingPos.xz * .9));
        roughnessFactor = mix(roughnessFactor, .5, gRing_frost);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, .55, gRing_frost);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 eTex = totalEmissiveRadiance;
          totalEmissiveRadiance = eTex * (uInlayCol * (uInlay + uBeat * .9) + uGlowCol * uGlow * 1.6) * (1. - gRing_frost * .5);
          totalEmissiveRadiance += uCrackCol * gRing_cr * 2.5;
          if (uArrowShow > .001) {
            float along = gRing_th * uR * uArrowDir;
            float s = fract((along - uTime * 2.2) / 1.7);
            float cx = s - .5 + abs(gRing_ac) * .3;
            float chev = smoothstep(.07, .015, abs(cx)) * smoothstep(.62, .5, abs(gRing_ac));
            totalEmissiveRadiance += uArrowCol * chev * uArrowShow * 2.6;
          }
          if (gRing_frost > .001) { float sp = step(.99, rh(floor(vRingPos.xz * 70.))) * gRing_frost; totalEmissiveRadiance += vec3(.6, .9, 1.) * sp * (.4 + .6 * sin(uTime * 3. + vRingPos.x * 40.)) * .8; }
          totalEmissiveRadiance += vec3(.1, .9, .55) * uFlood * .12;
        }`);
    };
    m.customProgramCacheKey = () => 'ph-ring-v1';
    return m;
  }

  function buildRings() {
    const arena = G.layers.arena;
    const tileMap = engraveTile(false), tileEm = engraveTile(true);
    W.rings = [];
    const aniso = Math.min(8, G.renderer.capabilities.getMaxAnisotropy ? G.renderer.capabilities.getMaxAnisotropy() : 4);
    G.RINGS.forEach((R, i) => {
      const reps = Math.round(R * TAU / 2.3);
      const map = tileMap.clone(); map.wrapS = T.RepeatWrapping; map.repeat.set(reps, 1); map.anisotropy = aniso; map.needsUpdate = true;
      const em = tileEm.clone(); em.wrapS = T.RepeatWrapping; em.repeat.set(reps, 1); em.anisotropy = aniso; em.needsUpdate = true;
      const mat = ringMaterial(map, em, R, reps);
      const geo = ringGeometry(R, G.quality.tier === 'low' ? 160 : 256);
      const mesh = new T.Mesh(geo, mat); mesh.name = 'ring' + i; mesh.renderOrder = 1;
      arena.add(mesh);
      // soft under-glow (additive halo under the track, sells the floating)
      const halo = new T.Mesh(new T.RingGeometry(R - RING_HW * 1.6, R + RING_HW * 1.6, 160, 1).rotateX(-Math.PI / 2),
        new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
          uniforms: { uR: { value: R }, uW: { value: RING_HW * 1.6 }, uCol: { value: new C('#ff9f3a') }, uA: { value: 0.14 } },
          vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
          fragmentShader: 'uniform float uR, uW, uA; uniform vec3 uCol; varying vec3 vP; void main(){ float d = abs(length(vP.xz) - uR) / uW; gl_FragColor = vec4(uCol * exp(-d * d * 3.) * uA, 1.); }' }));
      halo.position.y = -0.32; halo.renderOrder = 0; arena.add(halo);
      // flood overlay (boss 2 aurora liquid)
      const flood = new T.Mesh(new T.RingGeometry(R - RING_HW * 1.02, R + RING_HW * 1.02, 200, 2).rotateX(-Math.PI / 2),
        new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, side: T.DoubleSide,
          uniforms: { uR: { value: R }, uW: { value: RING_HW }, uA: { value: 0 }, uTime: { value: 0 }, uC1: { value: new C('#3dffa2') }, uC2: { value: new C('#2b7bff') }, uNoise: { value: getNoiseTex() } },
          vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
          fragmentShader: `uniform float uR, uW, uA, uTime; uniform vec3 uC1, uC2; uniform sampler2D uNoise; varying vec3 vP;
            void main(){ float th = atan(-vP.z, vP.x); float ac = (length(vP.xz) - uR) / uW; float k = floor(uR * 1.5);
              float n = texture2D(uNoise, vec2(th / 6.2831853 * k - uTime * .05, ac * .12 + uTime * .02)).r;
              float n2 = texture2D(uNoise, vec2(th / 6.2831853 * k * 2. + uTime * .09, ac * .25)).g;
              float edge = smoothstep(1., .8, abs(ac));
              float rim = smoothstep(.75, .98, abs(ac)) * edge;
              vec3 c = mix(uC2, uC1, n) * (.18 + .55 * n * n) + uC1 * pow(n2, 5.) * 1.1 + uC1 * rim * .5;
              gl_FragColor = vec4(c * edge * uA * .52, 1.); }` }));
      flood.position.y = 0.012; flood.visible = false; flood.renderOrder = 2; arena.add(flood);
      const rs = { i, R, mesh, mat, u: mat.userData.u, halo, flood, gaps: [], chunks: [], glow: { col: new C('#ffffff'), amt: 0, decay: 0, hold: 0 }, arrow: { dir: 1, show: 0, target: 0, flip: 0 }, floodAmt: 0, floodTarget: 0 };
      W.rings.push(rs);
      // read-only ring state on the exposed mesh (G.world.rings[i].flood etc.) for tests, the bot and bosses
      Object.defineProperties(mesh, {
        flood: { get: () => rs.floodAmt, configurable: true },          // current flood level 0..1
        floodTarget: { get: () => rs.floodTarget, configurable: true },
        flooded: { get: () => rs.floodTarget > 0.5, configurable: true },
        arrowDir: { get: () => (rs.arrow.pendingDir != null ? rs.arrow.pendingDir : rs.arrow.dir), configurable: true },   // the direction the chevrons point (+1 ccw)
        arrowShown: { get: () => rs.arrow.target > 0, configurable: true },
        broken: { get: () => rs.gaps.map(g => ({ center: g.center, width: g.width })), configurable: true },
        glowAmt: { get: () => rs.glow.amt, configurable: true },
      });
    });
  }

  // ==================================================================
  // Star-chart disc + menu props + distant decor
  // ==================================================================
  function buildChart() {
    const size = G.quality.tier === 'low' ? 1024 : 2048;
    const tex = chartTexture(size); tex.anisotropy = 4;
    const m = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, color: new C('#ffd9a0') });
    const disc = new T.Mesh(new T.CircleGeometry(18, 128).rotateX(-Math.PI / 2), m);
    disc.position.y = -1.6; disc.renderOrder = -1;
    G.layers.arena.add(disc);
    W.chart = disc;
    // a second, larger and fainter, counter-rotating graduated ring far below
    const m2 = m.clone(); m2.opacity = 0.16;
    const disc2 = new T.Mesh(new T.CircleGeometry(30, 96).rotateX(-Math.PI / 2), m2);
    disc2.position.y = -7; disc2.renderOrder = -2; G.layers.arena.add(disc2); W.chart2 = disc2;
  }

  function buildMenuProps() {
    const g = new T.Group(); g.name = 'menuOrrery'; G.layers.arena.add(g); W.menu = g;
    // central sun
    const sun = new T.Mesh(new T.SphereGeometry(1.5, 48, 24), new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uNoise: { value: getNoiseTex() } },
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uTime; uniform sampler2D uNoise; varying vec3 vN; varying vec3 vP;
        void main(){ float f = texture2D(uNoise, vec2(atan(vP.z, vP.x) / 6.2831853 * 2. + uTime * .01, vP.y * .25)).r; float rim = pow(1. - abs(vN.z), 2.);
          vec3 c = mix(vec3(2.4, 1.3, .45), vec3(3.2, 2.4, 1.3), f) * (.75 + .5 * f) + vec3(1.6, .7, .2) * rim;
          gl_FragColor = vec4(c, 1.); ${SHADER_TAIL} }`,
    }));
    sun.position.y = 2.6; g.add(sun); W.menuSun = sun;
    const glow = G.mat.glowSprite('#ffb44d', 9, { intensity: 1.6 }); glow.position.copy(sun.position); g.add(glow);
    const glow2 = G.mat.glowSprite('#ff7a2a', 22, { intensity: 0.5 }); glow2.position.copy(sun.position); g.add(glow2);
    // pillar / axis
    const axis = new T.Mesh(new T.CylinderGeometry(0.09, 0.14, 4.4, 12), G.mat.brass()); axis.position.y = 0.2; g.add(axis);
    const foot = new T.Mesh(new T.CylinderGeometry(0.9, 1.3, 0.35, 32), G.mat.brass()); foot.position.y = -0.15; g.add(foot);
    // planets riding the tracks on arms
    W.menuPlanets = [];
    const kinds = [['rock', 0.45, '#d9c3a0'], ['gas', 0.85, '#ffd2a0'], ['ice', 0.62, '#cfefff']];
    G.RINGS.forEach((R, i) => {
      const [k, rad] = kinds[i];
      const pm = new T.MeshStandardMaterial({ map: planetTexture(k), metalness: 0.1, roughness: 0.75, emissive: 0x221508, emissiveIntensity: 0.6 });
      const p = new T.Mesh(new T.SphereGeometry(rad, 32, 16), pm);
      const arm = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 1, 6), G.mat.brass()); arm.rotation.z = Math.PI / 2;
      const holder = new T.Group(); holder.add(arm); holder.add(p);
      p.position.set(R, 1.0 + rad, 0); arm.scale.y = R; arm.position.set(R / 2, 1.0 + rad + 0.05, 0);
      const stem = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.0 + rad, 6), G.mat.brass()); stem.position.set(R, (1.0 + rad) / 2, 0); holder.add(stem);
      if (k === 'gas') {
        const rg = new T.Mesh(new T.RingGeometry(rad * 1.35, rad * 2.1, 64), new T.MeshStandardMaterial({ color: 0xe8c890, metalness: 0.3, roughness: 0.6, side: T.DoubleSide, transparent: true, opacity: 0.8 }));
        rg.rotation.x = -Math.PI / 2 + 0.45; rg.position.copy(p.position); holder.add(rg);
      }
      g.add(holder);
      W.menuPlanets.push({ holder, speed: 0.22 / Math.sqrt(R / 5.5), phase: i * 2.1 });
    });
  }

  function buildDecor() {
    const g = new T.Group(); g.name = 'decor'; G.layers.sky.parent.add(g); W.decor = g;
    const brassDim = G.mat.brass({ color: '#a77d3a', roughness: 0.4 });
    W.armillary = [];
    const ringDefs = [
      { R: 56, tube: 0.3, y: -14, tx: 0.06, tz: 0.03, spin: 0.01, carrier: true },
      { R: 66, tube: 0.2, y: -24, tx: -0.1, tz: 0.08, spin: -0.006 },
      { R: 130, tube: 0.55, y: -85, tx: 0.03, tz: 0.02, spin: 0.003, dim: true },
    ];
    for (const d of ringDefs) {
      const grp = new T.Group(); grp.position.y = d.y; grp.rotation.set(d.tx, 0, d.tz);
      const spinG = new T.Group(); grp.add(spinG);
      const t = new T.Mesh(new T.TorusGeometry(d.R, d.tube, 8, 240).rotateX(Math.PI / 2), brassDim);
      spinG.add(t);
      const stud = new T.InstancedMesh(new T.BoxGeometry(d.tube * 1.4, d.tube * 3.2, d.tube * 1.4), brassDim, 72);
      const dm = new T.Object3D();
      for (let i = 0; i < 72; i++) { const a = i / 72 * TAU; dm.position.set(Math.cos(a) * d.R, 0, Math.sin(a) * d.R); dm.rotation.set(0, -a, 0); dm.scale.setScalar(i % 6 === 0 ? 1.6 : 1); dm.updateMatrix(); stud.setMatrixAt(i, dm.matrix); }
      spinG.add(stud);
      const inl = new T.Mesh(new T.TorusGeometry(d.R, d.tube * 0.35, 4, 240).rotateX(Math.PI / 2), G.mat.emissive('#ffb35a', d.dim ? 0.3 : 0.5));
      inl.position.y = d.tube * 0.8; spinG.add(inl);
      g.add(grp); W.armillary.push({ grp: spinG, spin: d.spin });
      if (d.carrier) W.carrier = { spinG, R: d.R };
    }
    // meridian arcs standing far left/right (vertical half rings)
    for (const sx of [-1, 1]) {
      const arc = new T.Mesh(new T.TorusGeometry(36, 0.24, 8, 140, Math.PI), brassDim);
      arc.position.set(sx * 70, -30, -26); arc.rotation.y = sx * 0.55; g.add(arc);
      W.armillary.push({ grp: arc, spin: 0, sway: sx });
    }
    // orrery planets on short arms carried by the big armillary ring: all outside the play area
    W.planets = [];
    const pdefs = [
      { r: 66, y: 3, size: 3.4, kind: 'gas', ring: true, a: 0.5 },
      { r: 63, y: -1, size: 2.0, kind: 'ice', a: 2.3 },
      { r: 61, y: 5, size: 1.3, kind: 'rock', a: 3.6 },
      { r: 70, y: -3, size: 2.5, kind: 'rock', a: 5.0 },
    ];
    const C0 = W.carrier;
    for (const d of pdefs) {
      const arm = new T.Group(); arm.rotation.y = d.a; C0.spinG.add(arm);
      const L = d.r - C0.R;
      const rod = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, L, 8), brassDim); rod.rotation.z = Math.PI / 2; rod.position.set(C0.R + L / 2, 0, 0); arm.add(rod);
      const post = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, Math.abs(d.y) + 0.01, 8), brassDim); post.position.set(d.r, d.y / 2, 0); arm.add(post);
      const pm = new T.MeshStandardMaterial({ map: planetTexture(d.kind), metalness: 0.05, roughness: 0.8, emissive: 0x0a0812 });
      const p = new T.Mesh(new T.SphereGeometry(d.size, 40, 20), pm); p.position.set(d.r, d.y, 0); arm.add(p);
      if (d.ring) {
        const rg = new T.Mesh(new T.RingGeometry(d.size * 1.4, d.size * 2.3, 96), new T.MeshStandardMaterial({ color: 0xd8b880, metalness: 0.4, roughness: 0.5, side: T.DoubleSide, transparent: true, opacity: 0.75 }));
        rg.rotation.x = -Math.PI / 2 + 0.38; rg.position.copy(p.position); arm.add(rg);
      }
      W.planets.push({ arm, p, speed: 0 });
    }
  }

  // ==================================================================
  // Sky
  // ==================================================================
  const SKY_R = 1000;
  function buildSky() {
    const sky = G.layers.sky;
    // ---- nebula bake (cube) ----
    const hdr = G.gfx.hdr;
    const cubeSize = G.quality.tier === 'low' ? 256 : 512;
    const mkCube = () => new T.WebGLCubeRenderTarget(cubeSize, { type: hdr ? T.HalfFloatType : T.UnsignedByteType, generateMipmaps: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    W.cubes = [mkCube(), mkCube()];
    W.cubeCam = new T.CubeCamera(0.5, 100, W.cubes[0]);
    W.bakeScene = new T.Scene();
    W.bakeMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: {
        uBaseA: { value: new C() }, uBaseB: { value: new C() }, uDownPow: { value: 2.5 },
        uMilky: { value: 0 }, uMilkyN: { value: new V(0, 0, 1) }, uMilkyCol: { value: new C() }, uMilkyCol2: { value: new C() },
        uNeb: { value: 0 }, uNebA: { value: new C() }, uNebB: { value: new C() }, uNebDir: { value: new V(0, -1, 0) }, uNebSpread: { value: 0.5 }, uNebSeed: { value: 0 },
        uNeb2: { value: 0 }, uNeb2A: { value: new C() }, uNeb2B: { value: new C() }, uNeb2Dir: { value: new V(0, -1, 0) },
        uDusk: { value: 0 }, uDuskCol: { value: new C() }, uDuskDir: { value: new V(0, 0, -1) },
        uStorm: { value: 0 }, uAur: { value: 0 }, uAurCol: { value: new C() }, uAurCol2: { value: new C() }, uGain: { value: 0.55 },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */`
        uniform vec3 uBaseA, uBaseB, uMilkyN, uMilkyCol, uMilkyCol2, uNebA, uNebB, uNebDir, uNeb2A, uNeb2B, uNeb2Dir, uDuskCol, uDuskDir, uAurCol, uAurCol2;
        uniform float uDownPow, uMilky, uNeb, uNebSpread, uNebSeed, uNeb2, uDusk, uStorm, uAur, uGain;
        varying vec3 vDir; ${NOISE}
        vec3 nebula(vec3 d, vec3 dir, float spread, float seed, vec3 a, vec3 b){
          float nd = dot(d, dir); float m = smoothstep(1. - spread, 1. - spread * .25, nd);
          float n1 = fbm(d * 2.4 + seed); float n2 = fbm(d * 5.3 - seed + n1 * 1.8);
          float dens = m * smoothstep(.38, .95, n1 * .55 + n2 * .65);
          vec3 c = mix(a, b, smoothstep(.35, .8, n2));
          float wisps = pow(smoothstep(.5, .9, fbm(d * 11. + seed * 2.)), 2.) * m;
          return c * dens * (.5 + 1.8 * pow(n2, 3.)) + b * wisps * .25;
        }
        void main(){
          vec3 d = normalize(vDir);
          float down = clamp(-d.y, 0., 1.);
          vec3 col = mix(uBaseB, uBaseA, pow(down, uDownPow));
          col += uBaseA * .25 * fbm3(d * 3. + 11.);
          // milky way band with dust lanes
          float bd = dot(d, uMilkyN); float band = exp(-bd * bd * 14.); float core = exp(-bd * bd * 70.);
          float n = fbm(d * 3.6 + 7.), dust = fbm(d * 8.5 + 3.), fine = fbm(d * 26. + 5.);
          vec3 mw = mix(uMilkyCol, uMilkyCol2, smoothstep(.35, .8, n)) * (band * (.12 + .7 * n * n) + core * .7 * n * n);
          mw *= 1. - smoothstep(.4, .62, dust) * .9 * band;
          mw += uMilkyCol2 * band * pow(fine, 5.) * 2.4 * (1. - smoothstep(.45, .6, dust));
          col += mw * uMilky;
          if (uNeb > .001) col += nebula(d, uNebDir, uNebSpread, uNebSeed, uNebA, uNebB) * uNeb;
          if (uNeb2 > .001) col += nebula(d, uNeb2Dir, uNebSpread * .8, uNebSeed + 13.7, uNeb2A, uNeb2B) * uNeb2;
          // dusk glow
          float dd = max(0., dot(d, uDuskDir)); col += uDuskCol * (pow(dd, 6.) * .9 + pow(dd, 2.) * .15) * uDusk;
          // aurora veil (diffuse sheets)
          if (uAur > .001) { float a1 = fbm(vec3(d.x * 3., d.z * 3., d.y * 1.5) + 4.); float v = smoothstep(.45, .8, a1) * smoothstep(.05, .7, down);
            col += mix(uAurCol, uAurCol2, smoothstep(.4, .9, fbm3(d * 5.))) * v * uAur * .5; }
          // storm clouds: heavy dark masses with lit edges
          if (uStorm > .001) { float cl = fbm(d * 2.6 + vec3(0., 0., 4.)); float m = smoothstep(.36, .56, cl);
            col = mix(col, col * .18 + vec3(.015, .02, .035), uStorm * m) + vec3(.15, .3, .3) * uStorm * smoothstep(.6, .62, cl) * (1. - smoothstep(.62, .7, cl)) * .3; }
          col *= uGain;
          { vec2 fc = gl_FragCoord.xy; col += (fract(52.9829189 * fract(dot(fc, vec2(.06711056, .00583715)))) - .5) * (1. / 255.); }   // 8-bit cubes: dither
          gl_FragColor = vec4(max(col, vec3(0.)), 1.);
        }`,
    });
    W.bakeScene.add(new T.Mesh(new T.SphereGeometry(50, 64, 32), W.bakeMat));

    // ---- live dome ----
    W.domeU = {
      uCubeA: { value: W.cubes[0].texture }, uCubeB: { value: W.cubes[1].texture }, uMix: { value: 0 },
      uTime: { value: 0 }, uStars: { value: 1 }, uPix: { value: 0.0008 }, uStarTint: { value: new C('#ffffff') },
      uHole: { value: 0 }, uHoleDir: { value: new V(0.3, -0.6, -0.7).normalize() }, uHoleR: { value: 0.11 },
      uFlash: { value: 0 }, uFlashCol: { value: new C('#cfe6ff') }, uDim: { value: 0 }, uTwinkle: { value: 1 },
      uDither: { value: 1 }, uCeil: { value: 10 },   // soft luminance ceiling of the baked sky (play readability; set per frame in update)
    };
    const dome = new T.Mesh(new T.SphereGeometry(SKY_R, 64, 32), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, depthTest: false, uniforms: W.domeU,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */`
        uniform samplerCube uCubeA, uCubeB; uniform float uMix, uTime, uStars, uPix, uHole, uHoleR, uFlash, uDim, uTwinkle, uCeil, uDither;
        uniform vec3 uHoleDir, uFlashCol, uStarTint; varying vec3 vDir;
        float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
        vec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
        vec3 starLayer(vec3 d, float scale, float dens, float sz, float bright){
          vec3 p = d * scale; vec3 c = floor(p); vec3 f = p - c;
          float h = h13(c); if (h > dens) return vec3(0.);
          vec3 o = h33(c) * .7 + .15; float dist = length(f - o) / scale;
          float sig = max(uPix * .75, sz);
          float b = (1. - h / dens); b = b * b * bright;
          float tw = 1. - uTwinkle * .35 * (.5 + .5 * sin(uTime * (1.5 + h * 7.) + h * 60.));
          float I = exp(-dist * dist / (2. * sig * sig)) * (sz * sz) / (sig * sig) * b * tw;
          vec3 tint = mix(vec3(1., .82, .62), vec3(.7, .82, 1.), h33(c + 7.).x);
          return tint * I;
        }
        vec3 rot(vec3 v, vec3 k, float a){ return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1. - cos(a)); }
        void main(){
          vec3 d = normalize(vDir); vec3 dl = d; float shadow = 0., pring = 0.;
          if (uHole > .001) {
            float ca = clamp(dot(d, uHoleDir), -1., 1.); float a = acos(ca);
            vec3 ax = cross(uHoleDir, d); float al = length(ax);
            if (al > 1e-5) { ax /= al; float R = uHoleR; float defl = uHole * R * R * 1.6 / max(a, R * .35); dl = rot(d, ax, -defl); }
            shadow = smoothstep(uHoleR * 1.04, uHoleR * .96, a) * uHole;
            pring = (exp(-pow((a - uHoleR * 1.12) / (uHoleR * .05), 2.)) * 1.2 + exp(-pow((a - uHoleR * 1.3) / (uHoleR * .25), 2.)) * .25) * uHole;
          }
          vec3 col = mix(textureCube(uCubeA, dl).rgb, textureCube(uCubeB, dl).rgb, uMix);
          // soft knee on the nebula/aurora luminance: bright skies keep their hue and structure but stay dark enough
          // behind the play area that gold rings, the knight and the accent telegraphs pop
          { float l = max(dot(col, vec3(.2126, .7152, .0722)), .5 * max(col.r, max(col.g, col.b))); col *= uCeil * (1. - exp(-l / uCeil)) / max(l, 1e-5); }
          vec3 st = starLayer(dl, 70., .16, .0008, 1.9) + starLayer(dl, 180., .22, .00058, 1.15) + starLayer(dl, 420., .3, .00045, .7);
          col += min(st * uStars * uStarTint, vec3(.8));
          col *= 1. + uFlash * 3.;
          col += uFlashCol * uFlash * .08;
          col = mix(col, vec3(0.), shadow);
          col += vec3(1.1, .9, .7) * pring * .6;
          col *= 1. - uDim;
          // triangular dither at the step of an 8-bit linear target (safe level 2+ / no float targets): no sky banding
          { vec2 fc = gl_FragCoord.xy + fract(uTime * 7.13) * 41.; float n = fract(52.9829189 * fract(dot(fc, vec2(.06711056, .00583715)))) + fract(52.9829189 * fract(dot(fc.yx + 17.3, vec2(.06711056, .00583715)))) - 1.;
            col += n * uDither * (.6 / 255.) * step(.0005, col.r + col.g + col.b); col = max(col, vec3(0.)); }
          gl_FragColor = vec4(col, 1.);
          ${SHADER_TAIL}
        }`,
    }));
    dome.renderOrder = -100; dome.frustumCulled = false;
    sky.add(dome); W.dome = dome;

    // ---- constellations (self-drawing) ----
    buildConstellations(sky);
    // ---- meteors / sky bolts (camera-facing streak quads) ----
    buildStreaks(sky);
    // ---- celestial bodies: sun, corona, black hole disk ----
    buildCelestial(sky);
    // ---- aurora curtains (world-placed, far below and around) ----
    buildCurtains();
  }

  function bake(cubeIdx, p) {
    const U = W.bakeMat.uniforms;
    for (const k of ['baseA', 'baseB', 'milkyCol', 'milkyCol2', 'nebA', 'nebB', 'neb2A', 'neb2B', 'duskCol', 'aurCol', 'aurCol2']) U['u' + k[0].toUpperCase() + k.slice(1)].value.set(p[k] || '#000000');
    for (const k of ['milky', 'neb', 'nebSpread', 'nebSeed', 'neb2', 'dusk', 'storm', 'aur', 'downPow']) if (p[k] != null) U['u' + k[0].toUpperCase() + k.slice(1)].value = p[k];
    for (const k of ['milkyN', 'nebDir', 'neb2Dir', 'duskDir']) if (p[k]) U['u' + k[0].toUpperCase() + k.slice(1)].value.set(...p[k]).normalize();
    try {
      W.cubeCam.renderTarget = W.cubes[cubeIdx];
      W.cubeCam.update(G.renderer, W.bakeScene);
    } catch (e) { G.log.error('world.bake', e); }
  }

  function buildConstellations(sky) {
    // procedurally laid out figures in the directions the play camera sees (below/ahead) + some for the menu view
    // play camera basis: forward 56 deg down toward -z; constellations sit around (not behind) the arena
    const P = G.deg(56), f = new V(0, -Math.sin(P), -Math.cos(P)), up = new V(0, Math.cos(P), -Math.sin(P)), rt = new V(1, 0, 0);
    const at = (a, b) => f.clone().addScaledVector(rt, a).addScaledVector(up, b).normalize().toArray();
    const centers = [at(-0.56, 0.05), at(0.58, -0.02), at(-0.42, 0.3), at(0.4, 0.31), at(-0.5, -0.3), at(0.52, -0.28), at(0.02, 0.36), at(-0.05, -0.36), at(-0.9, 0.2), at(0.92, 0.15)];
    const pos = [], aOrd = [], aAl = [], spos = [], sOrd = [];
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const R = 880;
    centers.forEach((c, ci) => {
      const cd = new V(...c).normalize();
      const t1 = new V().crossVectors(cd, new V(0, 1, 0.3)).normalize(), t2 = new V().crossVectors(cd, t1).normalize();
      const n = 5 + Math.floor(rnd() * 4), pts = [];
      let u = (rnd() - 0.5) * 0.05, v = (rnd() - 0.5) * 0.05;
      for (let i = 0; i < n; i++) {
        u += (rnd() - 0.5) * 0.16; v += (rnd() - 0.5) * 0.16;
        pts.push(cd.clone().addScaledVector(t1, u).addScaledVector(t2, v).normalize().multiplyScalar(R));
      }
      const order0 = ci * 0.6;
      for (let i = 0; i < n; i++) { spos.push(pts[i].x, pts[i].y, pts[i].z); sOrd.push(order0 + i); }
      for (let i = 1; i < n; i++) {
        const from = (i > 2 && rnd() < 0.3) ? Math.floor(rnd() * (i - 1)) : i - 1;
        pos.push(pts[from].x, pts[from].y, pts[from].z, pts[i].x, pts[i].y, pts[i].z);
        aOrd.push(order0 + i - 1, order0 + i - 1); aAl.push(0, 1);
      }
    });
    const lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); lg.setAttribute('aOrd', new T.Float32BufferAttribute(aOrd, 1)); lg.setAttribute('aAl', new T.Float32BufferAttribute(aAl, 1));
    W.conU = { uDraw: { value: 0 }, uA: { value: 0 }, uCol: { value: new C('#ffd89a') }, uTime: { value: 0 } };
    W.conU.uCol.value.set('#ffe2a8');
    const lines = new T.LineSegments(lg, new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, uniforms: W.conU,
      vertexShader: 'attribute float aOrd; attribute float aAl; varying float vO; varying float vAl; void main(){ vO = aOrd; vAl = aAl; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform float uDraw, uA; uniform vec3 uCol; varying float vO; varying float vAl; void main(){ float p = uDraw - vO; if (vAl > p) discard; float head = smoothstep(.25, 0., p - vAl); gl_FragColor = vec4(min(uCol * uA * (.62 + head * .9), vec3(.6)), 1.); }' }));
    lines.frustumCulled = false; lines.renderOrder = -90; sky.add(lines);
    const sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.Float32BufferAttribute(spos, 3)); sg.setAttribute('aOrd', new T.Float32BufferAttribute(sOrd, 1));
    const stars = new T.Points(sg, new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, uniforms: W.conU,
      vertexShader: 'attribute float aOrd; uniform float uDraw, uTime; varying float vK; void main(){ float p = clamp((uDraw - aOrd + .4) * 2., 0., 1.); vK = p; gl_PointSize = (5. + 9. * (1. - p) * p * 4. + sin(uTime * 2. + aOrd) * 1.) ; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform float uA; uniform vec3 uCol; varying float vK; void main(){ vec2 q = gl_PointCoord * 2. - 1.; float r = dot(q, q); if (r > 1.) discard; float s = exp(-r * 7.) + (exp(-abs(q.x) * 12.) + exp(-abs(q.y) * 12.)) * (1. - r) * .6; gl_FragColor = vec4(min(mix(uCol, vec3(1.), .5) * max(s, 0.) * uA * vK * 1.6, vec3(.62)), 1.); }' }));
    stars.frustumCulled = false; stars.renderOrder = -89; sky.add(stars);
    W.conLines = lines; W.conStars = stars; W.conMax = centers.length * 0.6 + 9;
  }

  function buildStreaks(sky) {
    W.streaks = [];
    const geo = new T.PlaneGeometry(1, 1).translate(0.5, 0, 0);
    for (let i = 0; i < 40; i++) {
      const m = new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, side: T.DoubleSide,
        uniforms: { uCol: { value: new C() }, uA: { value: 0 }, uHead: { value: 1 }, uTail: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: 'uniform vec3 uCol; uniform float uA, uHead, uTail; varying vec2 vUv; void main(){ float y = abs(vUv.y - .5) * 2.; float c = exp(-y * y * 9.); float t = smoothstep(uHead - uTail, uHead, vUv.x) * step(vUv.x, uHead); gl_FragColor = vec4((uCol * c + vec3(c * c * c)) * t * uA, 1.); }' });
      const mesh = new T.Mesh(geo, m); mesh.matrixAutoUpdate = false; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = -80;
      mesh.userData = { a: new V(), b: new V(), life: 0, max: 1, w: 2, kind: 'meteor' };
      sky.add(mesh); W.streaks.push(mesh);
    }
  }
  const bx = new V(), by = new V(), bz = new V(), bm = new T.Matrix4();
  function placeStreak(mesh, a, b, w) {
    bx.subVectors(b, a); const len = bx.length(); if (len < 1e-3) return;
    bx.multiplyScalar(1 / len); tmpV.addVectors(a, b).multiplyScalar(-0.5).normalize();   // toward the camera (sky origin)
    by.crossVectors(tmpV, bx).normalize(); bz.crossVectors(bx, by);
    bm.makeBasis(bx.multiplyScalar(len), by.multiplyScalar(w), bz); bm.setPosition(a); mesh.matrix.copy(bm); mesh.matrixWorldNeedsUpdate = true;
  }
  function takeStreak() { for (const s of W.streaks) if (!s.visible) return s; return null; }
  // directions the play camera / menu camera sees
  function randomSkyDir() {
    const menuish = W.cur && W.preset === 'menu';
    if (menuish) return new V((Math.random() - 0.5) * 1.6, -0.05 + Math.random() * 0.4, -1).normalize();
    return new V((Math.random() - 0.5) * 1.8, -0.4 - Math.random() * 0.55, -0.35 - Math.random() * 0.6).normalize();
  }
  function meteor(color = '#fff2d0') {
    const s = takeStreak(); if (!s) return;
    const u = s.userData, R = 800;
    const d0 = randomSkyDir(), dir = new V((Math.random() - 0.5), (Math.random() - 0.5) * 0.4, (Math.random() - 0.5)).normalize();
    u.a.copy(d0).multiplyScalar(R); u.b.copy(d0).addScaledVector(dir, 0.12 + Math.random() * 0.12).normalize().multiplyScalar(R);
    u.life = u.max = 0.5 + Math.random() * 0.6; u.w = 1.6 + Math.random() * 1.6; u.kind = 'meteor';
    s.material.uniforms.uCol.value.set(color).multiplyScalar(1.5); s.material.uniforms.uTail.value = 0.45;
    s.visible = true; placeStreak(s, u.a, u.b, u.w);
    if (Math.random() < 0.3) G.audio?.sfx?.('meteor', { vol: 0.5 });
  }
  function skyBolt(color = '#d6ecff') {
    const R = 780;
    const d0 = randomSkyDir(); const down = new V((Math.random() - 0.5) * 0.3, -1, (Math.random() - 0.5) * 0.3).normalize();
    let prev = d0.clone().multiplyScalar(R);
    const segs = 9, len = 0.28 + Math.random() * 0.2;
    let branchLeft = 2;
    const mk = (a, b, w, life) => { const s = takeStreak(); if (!s) return; const u = s.userData; u.a.copy(a); u.b.copy(b); u.life = u.max = life; u.w = w; u.kind = 'bolt'; s.material.uniforms.uCol.value.set(color).multiplyScalar(2.2); s.material.uniforms.uTail.value = 2; s.material.uniforms.uHead.value = 1; s.visible = true; placeStreak(s, a, b, w); };
    for (let i = 1; i <= segs; i++) {
      const p = d0.clone().addScaledVector(down, len * i / segs).add(new V((Math.random() - 0.5) * 0.045, 0, (Math.random() - 0.5) * 0.045)).normalize().multiplyScalar(R);
      mk(prev, p, 3.2, 0.28);
      if (branchLeft > 0 && Math.random() < 0.3) { branchLeft--; const q = p.clone().normalize().add(new V((Math.random() - 0.5) * 0.08, -0.05, (Math.random() - 0.5) * 0.08)).normalize().multiplyScalar(R); mk(p, q, 1.8, 0.22); }
      prev = p;
    }
    W.flash = Math.max(W.flash, 0.6 + Math.random() * 0.4);
    G.post?.bloomPulse?.(0.25, 0.4);
    G.audio?.sfx?.('thunder', { delay: 0.25 + Math.random() * 0.9, vol: 0.5 + Math.random() * 0.4 });
  }
  function updateStreaks(dt) {
    for (const s of W.streaks) {
      if (!s.visible) continue;
      const u = s.userData; u.life -= dt;
      if (u.life <= 0) { s.visible = false; continue; }
      const k = 1 - u.life / u.max, U = s.material.uniforms;
      if (u.kind === 'meteor') { U.uHead.value = Math.min(1, k * 1.4); U.uA.value = k < 0.7 ? 1 : (1 - k) / 0.3; }
      else { U.uA.value = (1 - k) * (0.5 + 0.5 * Math.random()); }
    }
  }

  function buildCelestial(sky) {
    const cel = new T.Group(); sky.add(cel); W.cel = cel;
    // sun billboard
    W.sunU = { uNoise: { value: getNoiseTex() }, uTime: { value: 0 }, uCol: { value: new C('#ff4a1c') }, uCorona: { value: 0 }, uCollapse: { value: 0 }, uA: { value: 0 }, uHot: { value: new C('#ffd27a') } };
    const sun = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, uniforms: W.sunU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */`uniform float uTime, uCorona, uCollapse, uA; uniform vec3 uCol, uHot; uniform sampler2D uNoise; varying vec2 vUv;
        float tn(vec2 q){ return texture2D(uNoise, q).r; }
        void main(){
          // the quad spans 2.6 sun radii
          vec2 p = vUv * 2.6; float r = length(p); float ang = atan(p.y, p.x);
          vec3 c = vec3(0.);
          if (r < 1.) {
            float mu = sqrt(1. - r * r);
            vec2 q = p / (.6 + .4 * mu);   // slight sphere warp
            float g = texture2D(uNoise, q * .45 + vec2(uTime * .004, 0.)).g; float g2 = texture2D(uNoise, q * 1.3 - vec2(0., uTime * .01)).b;
            float spots = smoothstep(.7, .78, texture2D(uNoise, q * .11 + .3).r);
            vec3 base = mix(uCol * .55, mix(uCol, uHot, .45), g) * (.35 + .75 * pow(mu, .55)) * (.85 + .3 * g2);
            base *= 1. - spots * .7;
            c = base * 1.15;
          }
          float edge = smoothstep(1.0, .985, r);
          c *= edge;
          // limb glow + corona streamers
          float halo = exp(-(r - 1.) * 4.) * step(1., r) * .7 + exp(-max(r - 1., 0.) * 1.4) * step(1., r) * .25;
          float au = ang / 6.2831853;
          float rays = texture2D(uNoise, vec2(au * 4., r * .1 - uTime * .02)).r; rays = pow(rays, 2.) * 2.4;
          float flares = pow(texture2D(uNoise, vec2(au * 3., uTime * .012)).g, 5.) * exp(-(r - 1.) * 2.2) * step(1., r) * 7.;
          c += uCol * halo * 1.1 + mix(uCol, uHot, .4) * (rays * exp(-(r - 1.) * 2.) * step(1., r) + flares) * uCorona * .7;
          // collapse: hot white-violet core
          c = mix(c, vec3(1.6, 1.4, 2.0) * (exp(-r * r * 3.) * 1.6 + halo * .6), uCollapse * .7);
          float fade = smoothstep(2.6, 1.9, r);
          gl_FragColor = vec4(c * fade * uA, 1.);
          ${SHADER_TAIL}
        }`,
    }));
    sun.frustumCulled = false; sun.renderOrder = -70; cel.add(sun); W.sun = sun;
    // accretion disk around the hole
    W.diskU = { uNoise: { value: getNoiseTex() }, uTime: { value: 0 }, uA: { value: 0 }, uHoleDir: { value: W.domeU.uHoleDir.value }, uHoleR: W.domeU.uHoleR, uIn: { value: 1.25 }, uOut: { value: 3.6 } };
    const diskGeo = new T.RingGeometry(1.25, 3.6, 160, 6);
    const disk = new T.Mesh(diskGeo, new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: W.diskU,
      vertexShader: 'varying vec2 vP; varying vec3 vW; void main(){ vP = position.xy; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */`uniform float uTime, uA, uIn, uOut; uniform vec3 uHoleDir; uniform float uHoleR; uniform sampler2D uNoise; varying vec2 vP; varying vec3 vW;
        void main(){
          float r = length(vP), a = atan(vP.y, vP.x);
          float u = (r - uIn) / (uOut - uIn);
          // far half (behind the hole) is hidden inside the shadow
          vec3 d = normalize(vW); float ang = acos(clamp(dot(d, uHoleDir), -1., 1.));
          float far = step(0., vP.y);
          if (far > .5 && ang < uHoleR * 1.02) discard;
          float swirl = texture2D(uNoise, vec2(a / 6.2831853 * 3. + r * .25 - uTime * .25 / r, r * .35)).r;
          float bands = .6 + .4 * sin(r * 22. - uTime * 3. + swirl * 4.);
          float dop = 1. + .75 * cos(a + .3);                 // doppler beaming: one side brighter
          float prof = smoothstep(0., .08, u) * pow(1. - u, 1.6);
          vec3 hot = vec3(3., 2.6, 2.2), mid = vec3(2.4, 1.1, .45), cool = vec3(.8, .3, 1.4);
          vec3 c = mix(hot, mix(mid, cool, smoothstep(.3, 1., u)), smoothstep(0., .4, u));
          gl_FragColor = vec4(c * prof * bands * (.4 + swirl) * dop * uA * .38, 1.);
          ${SHADER_TAIL}
        }`,
    }));
    disk.frustumCulled = false; disk.renderOrder = -60; cel.add(disk); W.disk = disk;
    // lensed upper image of the disk (halo arc facing the camera)
    const halo = new T.Mesh(new T.RingGeometry(1.08, 1.55, 128, 1), new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { uA: W.diskU.uA, uTime: W.diskU.uTime },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uA, uTime; varying vec2 vP; void main(){ float r = length(vP), a = atan(vP.y, vP.x); float u = (r - 1.08) / .47;
        float prof = smoothstep(0., .15, u) * pow(1. - u, 2.);
        float k = .55 + .45 * sin(a * 9. - uTime * 2.);
        float side = .6 + .4 * sin(a);   // brighter on top
        gl_FragColor = vec4(vec3(2.6, 1.6, .9) * prof * k * side * uA * .3, 1.); ${SHADER_TAIL} }`,
    }));
    halo.frustumCulled = false; halo.renderOrder = -59; cel.add(halo); W.diskHalo = halo;
    // infall streaks around a collapsing star (spiral sparks): a points cloud
    const N = 600, pp = new Float32Array(N * 3), seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) { seeds[i] = Math.random(); pp[i * 3] = Math.random(); pp[i * 3 + 1] = Math.random(); pp[i * 3 + 2] = 0; }
    const ig = new T.BufferGeometry(); ig.setAttribute('position', new T.BufferAttribute(pp, 3)); ig.setAttribute('aSeed', new T.BufferAttribute(seeds, 1));
    W.infallU = { uTime: { value: 0 }, uA: { value: 0 }, uScale: { value: 60 } };
    const inf = new T.Points(ig, new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, uniforms: W.infallU,
      vertexShader: `attribute float aSeed; uniform float uTime, uScale; varying float vK;
        void main(){ float t = fract(aSeed * 7.31 + uTime * (.08 + aSeed * .12)); float r = mix(5.5, .9, t * t); float a = aSeed * 6.2831 * 13. + t * 9. / (r * .3);
          vec3 p = vec3(cos(a) * r, sin(a) * r * .35, 0.) * uScale / 3.6; vK = t * (1. - t) * 4.;
          vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = 2. + 3. * vK; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform float uA; varying float vK; void main(){ vec2 q = gl_PointCoord * 2. - 1.; float s = exp(-dot(q, q) * 4.); gl_FragColor = vec4(vec3(1.6, 1.1, 2.) * s * vK * uA, 1.); }' }));
    inf.frustumCulled = false; inf.renderOrder = -58; cel.add(inf); W.infall = inf;
  }

  function placeCelestial(p) {
    // position the sun / hole along the configured direction at sky distance, facing the camera
    const dir = W.celDir, D = 860;
    const ang = Math.max(0.01, p.sunSize * 0.2);   // angular radius (rad)
    W.sun.position.copy(dir).multiplyScalar(D);
    W.sun.lookAt(G.camera.position);
    // portrait: horizontal FOV is narrow, so shrink the sun to keep the arena readable
    const asp = (G.camera && G.camera.aspect) || 1.6, aMul = asp >= 1.15 ? 1 : Math.pow(G.clamp(asp / 1.15, 0.4, 1), 0.7);
    W.sun.scale.setScalar(Math.tan(ang) * D * 2.6 * aMul);
    const hr = W.domeU.uHoleR.value;
    W.disk.position.copy(dir).multiplyScalar(D * 0.98);
    // disk plane: nearly edge-on, tilted toward the camera a little
    W.disk.lookAt(G.camera.position); W.disk.rotateX(-1.32); W.disk.rotateZ(0.25);
    W.disk.scale.setScalar(Math.tan(hr) * D);
    W.diskHalo.position.copy(dir).multiplyScalar(D * 0.985); W.diskHalo.lookAt(G.camera.position); W.diskHalo.rotateZ(0.25);
    W.diskHalo.scale.setScalar(Math.tan(hr) * D * 0.985);
    W.infall.position.copy(W.sun.position); W.infall.lookAt(G.camera.position); W.infall.rotateZ(0.25);
    W.infallU.uScale.value = Math.tan(0.2) * D * 0.5;
  }

  function buildCurtains() {
    W.curtains = [];
    W.curtU = { uNoise: { value: getNoiseTex() }, uTime: { value: 0 }, uA: { value: 0 }, uC1: { value: new C('#3dffa2') }, uC2: { value: new C('#ff5f9e') }, uC3: { value: new C('#7a5cff') }, uSpeed: { value: 1 }, uFlash: { value: 0 } };
    const g = new T.Group(); g.name = 'curtains'; G.layers.sky.parent.add(g); W.curtGroup = g;
    // snaking ribbons hanging far below the arena (seen from above, like aurora from orbit)
    const defs = [
      { pts: [[-190, -70], [-110, -130], [-20, -100], [60, -150], [170, -120]], y0: -150, h: 62, seed: 1 },
      { pts: [[-170, -210], [-60, -185], [40, -225], [150, -200]], y0: -175, h: 75, seed: 2 },
      { pts: [[-160, 10], [-140, -30], [-175, -90]], y0: -140, h: 55, seed: 3 },
      { pts: [[150, 20], [130, -40], [185, -90], [160, -140]], y0: -140, h: 58, seed: 4 },
    ];
    for (const d of defs) {
      const curve = new T.CatmullRomCurve3(d.pts.map(([x, z]) => new V(x, 0, z)), false, 'centripetal');
      const N = 220, len = curve.getLength();
      const pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), seedA = new Float32Array((N + 1) * 2), idx = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, q = curve.getPointAt(u);
        const topH = d.h * (0.65 + 0.35 * Math.sin(u * 17 + d.seed) * Math.sin(u * 5.3 + d.seed * 2));
        pos.set([q.x, 0, q.z, q.x, topH, q.z], i * 6);
        uv.set([u, 0, u, 1], i * 4); seedA[i * 2] = seedA[i * 2 + 1] = d.seed + len * 0.001;
        if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setAttribute('aSeed', new T.BufferAttribute(seedA, 1));
      geo.setIndex(idx); geo.computeBoundingSphere();
      const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: W.curtU,
        vertexShader: `attribute float aSeed; uniform float uTime, uSpeed; varying vec2 vUv; varying float vS; varying float vLen; varying vec3 vWp;
          void main(){ vUv = uv; vS = aSeed; vec3 p = position; float t = uTime * uSpeed;
            p.x += sin(uv.x * 31. + t * .45 + aSeed) * 3.5 * (.3 + uv.y);
            p.z += sin(uv.x * 23. - t * .35 + aSeed * 3.) * 4. * (.3 + uv.y) + sin(uv.x * 71. + t * .9) * .8;
            vWp = (modelMatrix * vec4(p, 1.)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
        fragmentShader: /* glsl */`uniform float uTime, uA, uSpeed, uFlash; uniform vec3 uC1, uC2, uC3; uniform sampler2D uNoise; varying vec2 vUv; varying float vS; varying vec3 vWp;
          void main(){ float t = uTime * uSpeed;
            // keep the area seen through the arena calm: project this fragment onto the play plane
            vec3 rd = vWp - cameraPosition; float hk = -cameraPosition.y / min(rd.y, -1e-3);
            float behind = mix(.22, 1., smoothstep(12., 21., length(cameraPosition.xz + rd.xz * hk)));
            float r1 = texture2D(uNoise, vec2(vUv.x * 9. + vS * .37 + t * .003, vS * .1 + t * .004)).a;
            float r2 = texture2D(uNoise, vec2(vUv.x * 3.1 - t * .002, vS * .23)).g;
            float rays = pow(r1 * .65 + r2 * .55, 3.) * 2.6;
            float bottom = smoothstep(0., .04, vUv.y) * (exp(-vUv.y * 9.) * 1.4 + exp(-vUv.y * 2.2) * .35);
            float top = pow(1. - vUv.y, 1.6);
            float ends = smoothstep(0., .08, vUv.x) * smoothstep(1., .92, vUv.x);
            float pulse = .8 + .2 * sin(vUv.x * 13. - t * .7 + vS);
            vec3 c = mix(uC1, uC2, smoothstep(.3, .9, vUv.y)); c = mix(c, uC3, smoothstep(.75, 1., vUv.y) * .5);
            float I = (bottom * (1.2 + rays * .6) + rays * top * .8) * ends * pulse;
            gl_FragColor = vec4(c * I * uA * behind * (1. + uFlash * 1.5), 1.); }` });
      const mesh = new T.Mesh(geo, mat);
      mesh.position.y = d.y0; mesh.renderOrder = -50; mesh.frustumCulled = false;
      g.add(mesh); W.curtains.push(mesh);
    }
  }

  // ==================================================================
  // Presets
  // ==================================================================
  const NIGHT_MW = [0.55, 0.25, -0.8];
  // a direction in the play view: a = right, b = up, in tan units from the view centre
  const VD = (a, b) => { const P = G.deg(56); return new V(a, -Math.sin(P) + b * Math.cos(P), -Math.cos(P) - b * Math.sin(P)).normalize().toArray(); };      // milky way band normal (band crosses the play view diagonally)
  const PRESETS = {
    menu: () => ({
      bake: { baseA: '#141238', baseB: '#05040d', downPow: 1.4, milky: 0.42, milkyN: [0.25, 0.95, 0.2], milkyCol: '#7d86b8', milkyCol2: '#e2cfa6',
        neb: 0.38, nebA: '#3a2a8a', nebB: '#d9a35a', nebDir: [-0.55, 0.08, -0.83], nebSpread: 0.5, nebSeed: 3.1, neb2: 0.25, neb2A: '#24306e', neb2B: '#8fb3ff', neb2Dir: [0.7, 0.2, -0.7],
        dusk: 0.22, duskCol: '#c88a3c', duskDir: [0, -0.12, -1], storm: 0, aur: 0 },
      stars: 1, starTint: '#fff4e0', constel: 0, meteor: 0.12, lightning: 0, curtains: 0, curtSpeed: 1,
      sun: 0, sunSize: 1, sunCol: '#ff6a2a', corona: 0, collapse: 0, hole: 0, infall: 0, dim: 0, twinkle: 1,
      key: '#ffe2b0', keyI: 2.2, rim: '#7f90ff', rimI: 1.1, hemiS: '#8d8cff', hemiG: '#1a0f08', hemiI: 0.5, exposure: 1.0, bloom: 0.8, inlay: 0.85, menu: 1,
      env: { top: '#2a2a6a', mid: '#c89550', bot: '#0a0612', panel: '#fff0d0', panel2: '#ffc070', rim: '#6a7aff' },
    }),
    night: (L) => ({
      bake: { baseA: L >= 2 ? '#0c1d38' : '#100f30', baseB: '#030309', downPow: 2.2, milky: L >= 1 ? 0.5 : 0.42, milkyN: NIGHT_MW, milkyCol: '#3e4a7e', milkyCol2: '#c8bca4',
        neb: L >= 2 ? (L >= 3 ? 1.5 : 1.0) : 0, nebA: '#1d7fa8', nebB: '#bdf4ff', nebDir: VD(-0.62, 0.12), nebSpread: L >= 3 ? 0.75 : 0.55, nebSeed: 1.7,
        neb2: L >= 3 ? 0.8 : 0, neb2A: '#1c3f8a', neb2B: '#7fe8ff', neb2Dir: VD(0.66, -0.12), dusk: 0, duskCol: '#000000', duskDir: [0, -1, 0], storm: 0, aur: L >= 3 ? 0.35 : 0, aurCol: '#5fe3ff', aurCol2: '#a8c8ff' },
      stars: L >= 2 ? 1.1 : 1, starTint: L >= 2 ? '#e8f6ff' : '#fff6e8', constel: L >= 1 ? 1 : 0, meteor: [0, 0.45, 0.6, 1.6][L], lightning: 0, curtains: 0, curtSpeed: 1,
      sun: 0, sunSize: 1, sunCol: '#ff6a2a', corona: 0, collapse: 0, hole: 0, infall: 0, dim: 0, twinkle: 1,
      key: L >= 2 ? '#e6f4ff' : '#fff0d6', keyI: 2.2, rim: '#6fb8ff', rimI: 1.2 + L * 0.15, hemiS: L >= 2 ? '#7fb6ff' : '#8a8cff', hemiG: '#0e0b16', hemiI: 0.5, exposure: 1.0 + L * 0.02, bloom: 0.85 + L * 0.06, inlay: 0.8 + L * 0.12, menu: 0,
      env: { top: '#1c2a5a', mid: '#b88f58', bot: '#060814', panel: '#fff4e0', panel2: '#cfe6ff', rim: '#5f8cff' },
    }),
    aurora: (L) => ({
      bake: { baseA: ['#2a1640', '#0f2a36', '#132b2a', '#0a1418'][L], baseB: ['#0b0614', '#040c10', '#05100c', '#020506'][L], downPow: 1.8, milky: [0.35, 0.3, 0.25, 0.1][L], milkyN: NIGHT_MW, milkyCol: '#5a6a8a', milkyCol2: '#c0d8c8',
        neb: L >= 2 ? (L === 3 ? 0.25 : 1.2) : 0, nebA: '#11b877', nebB: '#9cffd0', nebDir: VD(-0.62, -0.1), nebSpread: 0.7, nebSeed: 5.3,
        neb2: L >= 2 ? (L === 3 ? 0.2 : 1.0) : 0, neb2A: '#c23a7a', neb2B: '#ffb0d0', neb2Dir: VD(0.62, 0.18),
        dusk: [0.85, 0.35, 0.15, 0][L], duskCol: '#ff7a4a', duskDir: [0.1, -0.35, -0.93], storm: L === 3 ? 1 : 0, aur: [0.45, 0.8, 0.6, 0.2][L], aurCol: '#3dffa2', aurCol2: '#ff5f9e' },
      stars: [0.65, 0.8, 0.7, 0.35][L], starTint: '#f0fff6', constel: 0, meteor: L === 1 ? 0.15 : 0, lightning: L === 3 ? 0.45 : 0, curtains: [0.3, 1, 1.0, 0.8][L], curtSpeed: L === 3 ? 2.6 : 1,
      sun: 0, sunSize: 1, sunCol: '#ff6a2a', corona: 0, collapse: 0, hole: 0, infall: 0, dim: L === 3 ? 0.05 : 0, twinkle: 1,
      key: ['#ffd2b0', '#d8ffe8', '#e8fff0', '#d0e8ff'][L], keyI: L === 3 ? 1.8 : 2.1, rim: ['#ff8a6a', '#3dffa2', '#ff5f9e', '#7fd0ff'][L], rimI: 1.3, hemiS: '#6fd8b0', hemiG: '#120a14', hemiI: 0.5, exposure: 1.0, bloom: 0.9 + L * 0.05, inlay: 0.85 + L * 0.1, menu: 0,
      env: { top: '#123a3a', mid: '#a88a58', bot: '#06100c', panel: '#f0fff4', panel2: '#ffb0a0', rim: '#3dffa2' },
    }),
    collapse: (L) => ({
      bake: { baseA: ['#2a0a12', '#3a0c14', '#160a1e', '#0a0814'][L], baseB: ['#080306', '#0a0306', '#05030a', '#020206'][L], downPow: 1.6, milky: [0.3, 0.25, 0.2, 0.45][L], milkyN: NIGHT_MW, milkyCol: '#5a4a6a', milkyCol2: '#e0b8a0',
        neb: [0.35, 0.4, 0.55, 0.3][L], nebA: L >= 2 ? '#2a0c3a' : '#7a1a10', nebB: L >= 2 ? '#8a5ab0' : '#ff8a4a', nebDir: VD(-0.62, 0.05), nebSpread: 0.6, nebSeed: 8.2,
        neb2: L >= 1 ? 0.45 : 0, neb2A: L >= 2 ? '#3a0a18' : '#6a1030', neb2B: L >= 2 ? '#c05a40' : '#ff7a5a', neb2Dir: VD(0.1, -0.42), dusk: L <= 1 ? 0.6 : 0.2, duskCol: L <= 1 ? '#ff3a10' : '#8a4cff', duskDir: [0.38, -0.5, -0.78], storm: 0, aur: 0 },
      stars: [0.6, 0.55, 0.5, 1.0][L], starTint: L === 3 ? '#ffffff' : '#ffe8e0', constel: 0, meteor: 0, lightning: 0, curtains: 0, curtSpeed: 1,
      sun: L <= 2 ? 1 : 0, sunSize: [1.0, 1.08, 0.3, 0.05][L], sunCol: ['#ff3a12', '#ff5a1c', '#d8b8ff', '#ffffff'][L], corona: [0.15, 1.0, 1.6, 0][L], collapse: L >= 2 ? 1 : 0,
      hole: L === 3 ? 1 : 0, infall: L === 2 ? 1 : 0, dim: L === 2 ? 0.12 : 0, twinkle: L === 3 ? 0.4 : 1,
      key: ['#ff9a6a', '#ffb070', '#c8a8ff', '#b8a0ff'][L], keyI: 2.4, rim: ['#ff5a2a', '#ff7a3a', '#a77bff', '#a77bff'][L], rimI: 1.5, hemiS: L >= 2 ? '#7a6aff' : '#ff7a5a', hemiG: '#140608', hemiI: 0.55, exposure: 1.0, bloom: 0.95 + L * 0.07, inlay: 0.9 + L * 0.12, menu: 0,
      env: L >= 2 ? { top: '#2a1a5a', mid: '#a080d0', bot: '#08040c', panel: '#f0e8ff', panel2: '#b090ff', rim: '#a77bff' } : { top: '#4a1410', mid: '#e07a3a', bot: '#0c0404', panel: '#ffe0c0', panel2: '#ff7a3a', rim: '#ff4a2a' },
    }),
  };
  const LIVE_NUM = ['stars', 'constel', 'meteor', 'lightning', 'curtains', 'curtSpeed', 'sun', 'sunSize', 'corona', 'collapse', 'hole', 'infall', 'dim', 'twinkle', 'keyI', 'rimI', 'hemiI', 'exposure', 'bloom', 'inlay', 'menu'];
  const LIVE_COL = ['starTint', 'sunCol', 'key', 'rim', 'hemiS', 'hemiG'];
  // the sun / black hole sit in a free corner of the play view: upper right on landscape, top centre on portrait
  function updateCelDir() {
    const P = G.deg(56), f = new V(0, -Math.sin(P), -Math.cos(P)), up = new V(0, Math.cos(P), -Math.sin(P)), rt = new V(1, 0, 0);
    const halfH = Math.tan(G.deg(21)), asp = (G.camera && G.camera.aspect) || 1.6, halfW = halfH * asp;
    const a = asp >= 1.15 ? 0.74 * halfW : 0.12 * halfW, b = asp >= 1.15 ? 0.58 * halfH : 0.74 * halfH;
    W.celDir.copy(f).addScaledVector(rt, a).addScaledVector(up, b).normalize();
    if (W.domeU) W.domeU.uHoleDir.value.copy(W.celDir);
  }
  function paramsFor(preset, L) {
    const f = PRESETS[preset] || PRESETS.night;
    const p = f(G.clamp(L | 0, 0, 3));
    const o = { bake: p.bake, env: p.env };
    for (const k of LIVE_NUM) o[k] = p[k];
    for (const k of LIVE_COL) o[k] = new C(p[k]);
    return o;
  }
  function lerpParams(a, b, t, out) {
    for (const k of LIVE_NUM) out[k] = a[k] + (b[k] - a[k]) * t;
    for (const k of LIVE_COL) { out[k] = out[k] || new C(); out[k].copy(a[k]).lerp(b[k], t); }
    return out;
  }
  const cloneParams = (p) => { const o = { bake: p.bake, env: p.env }; for (const k of LIVE_NUM) o[k] = p[k]; for (const k of LIVE_COL) o[k] = p[k].clone(); return o; };

  function setSky(preset = 'night', intensity = 0, transitionSec = 1.5) {
    if (!ready) { W.pendingSky = [preset, intensity, transitionSec]; return; }
    if (!PRESETS[preset]) preset = 'night';
    const L = G.clamp(Math.round(+intensity || 0), 0, 3);
    if (W.preset === preset && W.level === L && W.to) return;
    const dur = Math.max(0, +transitionSec || 0);
    // finish an ongoing transition instantly before starting a new one
    if (W.tr && W.tr.t < 1) { lerpParams(W.tr.from, W.tr.to, 1, W.cur); W.domeU.uMix.value = W.front === 1 ? 1 : 0; }
    const target = paramsFor(preset, L);
    const back = W.front === 0 ? 1 : 0;
    bake(back, target.bake);
    if (W.preset !== preset || !W.envDone) { makeEnv(target.env); W.envDone = true; }
    W.tr = { from: cloneParams(W.cur), to: target, t: dur > 0 ? 0 : 1, dur, mixFrom: W.domeU.uMix.value, mixTo: back };
    W.front = back;
    const prevPreset = W.preset, prevLevel = W.level;
    W.preset = preset; W.level = L; W.to = target;
    if (dur === 0) { lerpParams(W.tr.from, target, 1, W.cur); W.domeU.uMix.value = back; }
    // set-piece moments
    if (prevPreset === preset && L > prevLevel) {
      if (preset === 'collapse' && L === 2) { W.collapseFlash = 1.0; G.post?.bloomPulse?.(1.0, 1.1); }   // short: the implosion must stay visible
      if (preset === 'collapse' && L === 3) { W.collapseFlash = 0.6; }
      if (preset === 'night' && L === 1) W.conDraw = 0;
    }
    if (preset === 'night' && L >= 1 && prevPreset !== 'night') W.conDraw = 0;
    G.emit('skyChange', { preset, intensity: L });
  }

  // ==================================================================
  // Ring state API
  // ==================================================================
  const ringsOf = (i) => { if (!W.rings) return []; if (i == null || i === 'all' || i < 0) return W.rings; const r = W.rings[i | 0]; return r ? [r] : []; };

  function ringGlow(i, hex = '#ffffff', amount = 1, dur = 0.6) {
    for (const r of ringsOf(i)) {
      r.glow.col.set(hex || '#ffffff'); r.glow.amt = Math.max(0, +amount || 0);
      r.glow.decay = dur > 0 ? r.glow.amt / dur : 0;   // 0 = hold until changed
    }
  }

  function chunkify(r, g) {
    // spawn 2-4 drifting brass chunks covering the removed arc
    const width = g.width, n = Math.max(1, Math.min(4, Math.round(width * r.R / 1.6)));
    const pieces = [];
    for (let k = 0; k < n; k++) {
      const a0 = g.center - width / 2 + (width * k) / n, a1 = g.center - width / 2 + (width * (k + 1)) / n;
      const th = (a0 + a1) / 2;
      const geo = ringGeometry(r.R, Math.max(4, Math.round((a1 - a0) * 60)), a0 + Math.PI / 2 + 0.01, (a1 - a0) - 0.02);
      const c = G.polar(r.R, th, -0.1);
      geo.translate(-c.x, -c.y, -c.z);
      const mesh = new T.Mesh(geo, r.chunkMat || (r.chunkMat = new T.MeshStandardMaterial({ map: r.mat.map, emissiveMap: r.mat.emissiveMap, emissive: 0xffa040, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.36, envMapIntensity: 1.2, transparent: true })));
      mesh.position.copy(c);
      G.layers.arena.add(mesh);
      const out = G.polar(1, th, 0);
      pieces.push({ mesh, home: c.clone(), vel: new V(out.x * (0.25 + Math.random() * 0.3), -0.35 - Math.random() * 0.3, out.z * (0.25 + Math.random() * 0.3)),
        spin: new V((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.5), t: 0, back: 0, gap: g });
    }
    r.chunks.push(...pieces);
  }
  function setRingBroken(i, gaps) {
    if (!ready) return;
    const list = Array.isArray(gaps) ? gaps.filter((g) => g && typeof g.center === 'number').slice(0, 8) : [];
    for (const r of ringsOf(i)) {
      const next = [];
      for (const g of list) {
        const w = Math.max(0.02, +g.width || 0.4);
        const old = r.gaps.find((o) => !o.closing && Math.abs(G.angDiff(o.center, g.center)) < 0.05 && Math.abs(o.width - w) < 0.05);
        if (old) { next.push(old); continue; }
        const ng = { center: G.wrap(g.center), width: w, open: 0, closing: false };
        next.push(ng);
        chunkify(r, ng);
        // crack fx
        try {
          G.fx?.ringFlash?.(r.i, { color: '#ffb060', a0: ng.center - w / 2 - 0.05, a1: ng.center + w / 2 + 0.05, life: 0.7, intensity: 2.2 });
          G.fx?.shards?.(G.polar(r.R, ng.center, 0.1), { color: '#ffcf7a', count: 16, speed: 4, floor: -3 });
          G.fx?.burst?.(G.polar(r.R, ng.center, 0.1), { color: '#ffb060', count: 26, speed: 5, size: 0.3, life: 0.8 });
          G.audio?.sfx?.('crack');
        } catch (e) { G.log.error('world.crackfx', e); }
      }
      // gaps that disappear close (refill) with a gold flash; their chunks fly home
      for (const o of r.gaps) if (!next.includes(o) && !o.closing) {
        o.closing = true; next.push(o);
        for (const c of r.chunks) if (c.gap === o) c.back = 0.0001;
        try { G.fx?.ringFlash?.(r.i, { color: '#ffd27a', a0: o.center - o.width / 2 - 0.08, a1: o.center + o.width / 2 + 0.08, life: 0.9, intensity: 2 }); } catch (e) { /* */ }
      }
      r.gaps = next;
    }
  }
  function ringArrows(i, dir = 1, show = true) {
    for (const r of ringsOf(i)) {
      const d = dir < 0 ? -1 : 1;
      if (r.arrow.show > 0.3 && d !== r.arrow.dir && show) { r.arrow.pendingDir = d; r.arrow.flip = 1; try { G.fx?.ringFlash?.(r.i, { color: W.accent.getStyle(), life: 0.4, intensity: 1.2 }); } catch (e) { /* */ } }
      else { r.arrow.dir = d; r.arrow.pendingDir = null; }
      r.arrow.target = show ? 1 : 0;
      r.u.uArrowCol.value.copy(W.accent).multiplyScalar(1.1);
    }
  }
  function setRingRime(amount = 0) { W.rimeTarget = G.clamp(+amount || 0); }
  function flood(ringIndex, amount = 1) {
    for (const r of ringsOf(ringIndex)) { r.floodTarget = G.clamp(+amount || 0); if (r.floodTarget > 0) r.flood.visible = true; }
  }
  function tilt(xRad = 0, zRad = 0, dur = 2, opts = {}) {
    W.tiltFrom = { x: W.tiltCur.x, z: W.tiltCur.z };
    W.tiltTo = { x: +xRad || 0, z: +zRad || 0 };
    W.tiltT = 0; W.tiltDur = Math.max(0, +dur || 0);
    W.tiltSpin = opts && typeof opts.spin === 'number' ? opts.spin : 0;
    if (W.tiltDur === 0) { W.tiltCur.x = W.tiltTo.x; W.tiltCur.z = W.tiltTo.z; W.tiltT = 1; }
  }
  function beat(strength = 1) { W.beat = Math.max(W.beat, G.clamp(+strength || 0.6, 0, 1.5)); }
  function setAccent(hex) {
    try { W.accent.set(hex || G.colors.accent); } catch (e) { return; }
    if (W.rings) for (const r of W.rings) r.u.uArrowCol.value.copy(W.accent).multiplyScalar(1.1);
  }
  function reset() {
    if (!ready) return;
    for (const r of W.rings) {
      r.gaps = []; r.u.uGapN.value = 0;
      for (const c of r.chunks) { G.layers.arena.remove(c.mesh); c.mesh.geometry.dispose(); }
      r.chunks = [];
      r.glow.amt = 0; r.arrow.show = 0; r.arrow.target = 0; r.arrow.flip = 0; r.arrow.pendingDir = null; r.u.uArrowShow.value = 0;
      r.floodAmt = r.floodTarget = 0; r.flood.visible = false; r.u.uFlood.value = 0;
    }
    W.rime = W.rimeTarget = 0;
    W.tiltCur.x = W.tiltCur.z = 0; W.tiltTo = { x: 0, z: 0 }; W.tiltT = 1; W.tiltSpin = 0;
    G.layers.play.rotation.set(0, 0, 0);
  }

  // ==================================================================
  // Update
  // ==================================================================
  function update(dt) {
    if (!ready) return;
    const t = (W.time += dt);
    const cam = G.camera;
    // sky follows the camera
    G.layers.sky.position.copy(cam.position);
    // transition
    const tr = W.tr;
    if (tr && tr.t < 1) {
      tr.t = tr.dur > 0 ? Math.min(1, tr.t + dt / tr.dur) : 1;
      const e = G.smooth(tr.t);
      lerpParams(tr.from, tr.to, e, W.cur);
      W.domeU.uMix.value = tr.mixFrom + (tr.mixTo - tr.mixFrom) * e;
    }
    const p = W.cur;
    // pixel angle for star AA
    W.domeU.uPix.value = (2 * Math.tan((cam.fov * Math.PI / 180) / 2)) / Math.max(200, G.renderer.domElement.height || 720);
    W.domeU.uTime.value = t; W.domeU.uStars.value = p.stars; W.domeU.uStarTint.value.copy(p.starTint); W.domeU.uTwinkle.value = p.twinkle;
    W.flash = Math.max(0, W.flash - dt * 3.2); W.domeU.uFlash.value = W.flash; W.curtU.uFlash.value = W.flash;
    W.collapseFlash = Math.max(0, (W.collapseFlash || 0) - dt * 0.6);
    W.domeU.uDim.value = G.clamp(p.dim - W.collapseFlash * 0.5);
    // constellations draw themselves
    if (p.constel > 0.01) W.conDraw = Math.min(W.conMax, (W.conDraw || 0) + dt * 1.8); else W.conDraw = Math.max(0, (W.conDraw || 0) - dt * 3);
    W.conU.uDraw.value = W.conDraw; W.conU.uA.value = p.constel * 0.9; W.conU.uTime.value = t;
    W.conLines.visible = W.conStars.visible = p.constel > 0.01;
    // meteors / lightning
    if (p.meteor > 0.01 && Math.random() < p.meteor * dt) meteor(W.preset === 'night' && W.level >= 2 ? '#d8f6ff' : '#fff2d0');
    if (p.lightning > 0.01 && Math.random() < p.lightning * dt) skyBolt('#d6ecff');
    updateStreaks(dt);
    // curtains
    W.curtU.uTime.value = t; W.curtU.uA.value = p.curtains * 0.55; W.curtU.uSpeed.value = p.curtSpeed;
    W.curtGroup.visible = p.curtains > 0.01;
    // celestial
    const sunOn = p.sun > 0.01, holeOn = p.hole > 0.01;
    W.sun.visible = sunOn; W.sunU.uA.value = p.sun; W.sunU.uTime.value = t; W.sunU.uCol.value.copy(p.sunCol); W.sunU.uCorona.value = p.corona; W.sunU.uCollapse.value = G.clamp(p.collapse + W.collapseFlash * 0.6);
    W.domeU.uHole.value = p.hole; W.diskU.uA.value = p.hole; W.diskU.uTime.value = t;
    W.disk.visible = W.diskHalo.visible = holeOn;
    W.infall.visible = p.infall > 0.01; W.infallU.uA.value = p.infall; W.infallU.uTime.value = t;
    if (sunOn || holeOn || W.infall.visible) placeCelestial(p);
    // lights / post
    const L = G.lights;
    if (L) {
      L.key.color.copy(p.key); L.key.intensity = p.keyI * (1 + W.flash * 0.6);
      L.rim.color.copy(p.rim).lerp(W.accent, 0.25); L.rim.intensity = p.rimI;
      L.hemi.color.copy(p.hemiS); L.hemi.groundColor.copy(p.hemiG); L.hemi.intensity = p.hemiI;
    }
    // readability caps: during play the sky is soft-capped and bloom/exposure are held down, so every in-fight frame
    // keeps a dark backdrop; cinematics (transitions, deaths) get looser caps for the spectacle; the menu is uncapped
    {
      const RD = G.world.readability, st = G.state;
      const play = st === 'fight' || st === 'practice' || st === 'intro' || st === 'dead' || st === 'paused';
      const cine = st === 'cinematic' || st === 'victory';
      const want = play ? RD.ceil : cine ? RD.ceilCine : 10;
      W.ceil = W.ceil == null ? want : W.ceil + (want - W.ceil) * Math.min(1, (G.rdt || dt) * 2.5);
      W.domeU.uCeil.value = W.ceil;
      let ex = p.exposure, bl = p.bloom;
      if (play) { ex = Math.min(ex, RD.expMax); bl = Math.min(bl, RD.bloomMax); }
      else if (cine) { ex = Math.min(ex, RD.expMaxCine); bl = Math.min(bl, RD.bloomMaxCine); }
      if (G.post) { G.post.base.exposure = ex; G.post.base.bloom = bl; }
    }
    // menu orrery
    const mw = p.menu;
    W.menu.visible = mw > 0.01; W.menu.scale.setScalar(Math.max(0.001, mw));
    if (W.menu.visible) {
      W.menuSun.material.uniforms.uTime.value = t; W.menuSun.rotation.y = t * 0.1;
      for (const mp of W.menuPlanets) mp.holder.rotation.y = mp.phase + t * mp.speed;
    }
    // star chart + decor motion
    W.chart.rotation.y = t * 0.012; W.chart2.rotation.y = -t * 0.006;
    for (const a of W.armillary) { if (a.spin) a.grp.rotation.y += a.spin * dt; if (a.sway) a.grp.rotation.z = Math.sin(t * 0.05) * 0.04 * a.sway; }
    for (const pl of W.planets) { pl.arm.rotation.y += pl.speed * dt; pl.p.rotation.y += dt * 0.12; }
    // rings
    W.beat = Math.max(0, W.beat - dt * 3.5);
    W.rime += (W.rimeTarget - W.rime) * Math.min(1, dt * 0.8);
    for (const r of W.rings) {
      const u = r.u;
      u.uTime.value = t; u.uInlay.value = p.inlay; u.uBeat.value = W.beat * 0.6; u.uRime.value = W.rime;
      // glow
      if (r.glow.decay > 0) r.glow.amt = Math.max(0, r.glow.amt - r.glow.decay * dt);
      u.uGlowCol.value.copy(r.glow.col); u.uGlow.value = r.glow.amt;
      // arrows (flip: fade out, swap dir, fade in)
      const ar = r.arrow;
      if (ar.flip > 0) { ar.show = Math.max(0, ar.show - dt * 6); if (ar.show <= 0.01) { ar.dir = ar.pendingDir ?? ar.dir; ar.pendingDir = null; ar.flip = 0; } }
      else ar.show += (ar.target - ar.show) * Math.min(1, dt * 6);
      u.uArrowDir.value = ar.dir; u.uArrowShow.value = ar.show;
      // flood
      r.floodAmt += (r.floodTarget - r.floodAmt) * Math.min(1, dt * 1.5);
      r.flood.material.uniforms.uA.value = r.floodAmt; r.flood.material.uniforms.uTime.value = t; u.uFlood.value = r.floodAmt;
      if (r.floodAmt < 0.003 && r.floodTarget === 0) r.flood.visible = false;
      // gaps
      let n = 0;
      for (let k = r.gaps.length - 1; k >= 0; k--) {
        const g = r.gaps[k];
        g.open = g.closing ? Math.max(0, g.open - dt * 1.4) : Math.min(1, g.open + dt * 3);
        if (g.closing && g.open <= 0) r.gaps.splice(k, 1);
      }
      for (const g of r.gaps) { if (n >= 8) break; u.uGaps.value[n].set(g.center, g.width / 2, G.easeOutCubic(g.open)); n++; }
      u.uGapN.value = n;
      // chunks
      for (let k = r.chunks.length - 1; k >= 0; k--) {
        const c = r.chunks[k]; c.t += dt;
        if (c.back > 0) {
          c.back = Math.min(1, c.back + dt * 1.6);
          c.mesh.position.lerp(c.home, Math.min(1, dt * 6));
          c.mesh.quaternion.slerp(new T.Quaternion(), Math.min(1, dt * 6));
          if (c.back >= 1) { G.layers.arena.remove(c.mesh); c.mesh.geometry.dispose(); r.chunks.splice(k, 1); }
          continue;
        }
        const slow = Math.min(1, c.t / 0.6);
        c.mesh.position.addScaledVector(c.vel, dt * (0.4 + 0.6 * slow) * (c.t < 6 ? 1 : 0.5));
        c.mesh.rotation.x += c.spin.x * dt; c.mesh.rotation.y += c.spin.y * dt; c.mesh.rotation.z += c.spin.z * dt;
        const fade = c.t > 14 ? Math.max(0, 1 - (c.t - 14) / 4) : 1;
        c.mesh.material.opacity = 1;   // shared material; fade via scale instead
        if (fade < 1) c.mesh.scale.setScalar(Math.max(0.001, fade));
        if (fade <= 0) { G.layers.arena.remove(c.mesh); c.mesh.geometry.dispose(); r.chunks.splice(k, 1); }
      }
    }
    // tilt of the play plane
    if (W.tiltT < 1) { W.tiltT = W.tiltDur > 0 ? Math.min(1, W.tiltT + dt / W.tiltDur) : 1; const e = G.easeInOutCubic(W.tiltT); W.tiltCur.x = W.tiltFrom.x + (W.tiltTo.x - W.tiltFrom.x) * e; W.tiltCur.z = W.tiltFrom.z + (W.tiltTo.z - W.tiltFrom.z) * e; }
    let tx = W.tiltCur.x, tz = W.tiltCur.z;
    if (W.tiltSpin) { W.tiltPhase = (W.tiltPhase || 0) + W.tiltSpin * dt; const m = Math.hypot(tx, tz), a0 = Math.atan2(tz, tx) + W.tiltPhase; tx = m * Math.cos(a0); tz = m * Math.sin(a0); }
    const pg = G.layers.play;
    if (pg.rotation.x !== tx || pg.rotation.z !== tz) { pg.rotation.x = tx; pg.rotation.z = tz; }
  }

  // ==================================================================
  // module
  // ==================================================================
  G.world = {
    init() {
      W.time = 0; W.beat = 0; W.flash = 0; W.rime = 0; W.rimeTarget = 0; W.front = 0; W.accent = new C(G.colors.accent || '#5fe3ff');
      W.tiltCur = { x: 0, z: 0 }; W.tiltFrom = { x: 0, z: 0 }; W.tiltTo = { x: 0, z: 0 }; W.tiltT = 1; W.tiltDur = 0;
      W.celDir = new V(0.4, -0.6, -0.7).normalize();
      buildRings(); buildChart(); buildMenuProps(); buildDecor(); buildSky();
      updateCelDir(); G.on('resize', updateCelDir);
      W.cur = paramsFor('menu', 0);
      ready = true;
      W.preset = null; W.level = -1;
      const ps = W.pendingSky; W.pendingSky = null;
      setSky(ps ? ps[0] : 'menu', ps ? ps[1] : 0, 0);
      G.on('quality', () => { /* cube + ring detail are fixed after init; nothing heavy to redo */ });
    },
    update, setSky, setAccent, ringGlow, setRingBroken, ringArrows, setRingRime, flood, tilt, beat, reset,
    meteor: (c) => ready && meteor(c), lightning: (c) => ready && skyBolt(c),
    get sky() { return { preset: W.preset, intensity: W.level, transitioning: !!(W.tr && W.tr.t < 1) }; },
    get rings() { return W.rings ? W.rings.map((r) => r.mesh) : []; },
    // plain snapshot of every ring's state: flood, inlay arrows, breaks, glow
    ringState(i) {
      const snap = (r) => ({ i: r.i, R: r.R, flood: r.floodAmt, floodTarget: r.floodTarget, flooded: r.floodTarget > 0.5,
        arrowDir: r.arrow.pendingDir != null ? r.arrow.pendingDir : r.arrow.dir, arrowShown: r.arrow.target > 0, arrowShow: r.arrow.show,
        broken: r.gaps.map(g => ({ center: g.center, width: g.width })), glow: r.glow.amt,
        glowLeft: r.glow.amt > 0.005 ? (r.glow.decay > 0 ? r.glow.amt / r.glow.decay : Infinity) : 0 });   // seconds until a timed glow fades
      if (!W.rings) return i == null ? [] : null;
      if (i == null) return W.rings.map(snap);
      const r = W.rings[i | 0]; return r ? snap(r) : null;
    },
    ringTopY: 0,
    // play readability caps (see update): sky luminance knee (linear, pre-grade), max exposure and bloom strength
    readability: { ceil: 0.05, ceilCine: 0.09, expMax: 1.0, bloomMax: 0.86, expMaxCine: 1.04, bloomMaxCine: 0.98 },
    _W: W,
  };
})();
