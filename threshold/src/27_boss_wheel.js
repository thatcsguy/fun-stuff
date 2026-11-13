// DOOR VIII: LADY FORTUNA, the Gilded Wheel. The floor turns under you, the ball picks a colour, and every card means something.
(() => {
  const R = 17, HUB = 3.9, SPLIT = 10.4, NP = 12, PA = TAU / NP, GOLD = 0xffd24a, RED = 0xa81028, INK = 0x4a56c0, MAG = 0xff3ab0;
  const SUITC = [0x3a2aa8, 0xc8142a, 0xa83a08, 0xa87a20], SUITN = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
  const _w = {}, _a = new V3(), _b2 = new V3(), _m = new THREE.Object3D(), _c = new THREE.Color();
  const ringA = (S, r) => r < SPLIT ? S.ai : S.ao;
  const wpos = (S, la, r, out) => { const a = la + ringA(S, r); out.x = Math.sin(a) * r; out.z = Math.cos(a) * r; out.a = a; return out; };
  // per phase: sky (top, horizon, nebula A/B), boss rim light, bulb colour
  const SKYP = [[0x05010a, 0x2c0a2c, 0x8a1a6a, 0x8a5a10, 0x000000], [0x0a0216, 0x2a0620, 0x7a1060, 0x2a1478, 0xff3aa0], [0x020418, 0x6a4008, 0x14125a, 0x0a0c30, 0x5048c8]].map((q) => q.map((h) => new THREE.Color(h)));
  const RIMP = [0x4a2a70, 0xb0207a, 0x9a6a28].map((h) => new THREE.Color(h)), BULBP = [GOLD, MAG, 0xfff0b0], STARP = [0.5, 0.9, 1.6], AURP = [0, 0.08, 0.14], EXPP = [0.6, 0.6, 0.22], LAMPP = [[0xffc878, 520], [0xffa0c0, 440], [0xffd088, 560]], RIML = [[0x6a50ff, 140], [MAG, 160], [0x7a50ff, 140]];

  // ---------- local geometry helpers ----------
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3();
  function T(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { geo.applyMatrix4(_m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); return geo; }
  function merge(list) {
    let n = 0; const gs = list.map((g) => { const q = g.index ? g.toNonIndexed() : g; if (q !== g) g.dispose(); if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return q; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
    for (const q of gs) { const c = q.attributes.position.count; P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); if (q.attributes.uv) U.set(q.attributes.uv.array, o * 2); o += c; q.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.computeBoundingSphere(); return g;
  }
  const v2 = (a) => a.map((p) => new THREE.Vector2(p[0], p[1]));
  // fresnel rim added to a standard material's emissive (phase-coloured, so the dark lacquer separates from the night)
  function withRim(mat, colorObj, power = 2.4) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: colorObj };
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim;\nvoid main() {').replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRim * pow(max(fr, 0.0), ' + power.toFixed(2) + '); }');
    };
    mat.customProgramCacheKey = () => 'wheelrim' + power; return mat;
  }
  const ctex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const css = (h) => '#' + h.toString(16).padStart(6, '0');
  const VS_UV = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';

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
    const t = ctex(c); t.anisotropy = 4; return t;
  }
  function pipTex(n) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#f2ead8'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#b89040'; x.lineWidth = 6; x.strokeRect(3, 3, 122, 122);
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
    x.fillStyle = '#b0101c'; for (const [px, py] of P) { x.beginPath(); x.arc(64 + px * 32, 64 + py * 32, 13, 0, TAU); x.fill(); }
    return ctex(c);
  }
  function wheelTex() {
    const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), k = N / 2 / R; x.translate(N / 2, N / 2);
    const NO = [32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13], NI = [36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20];
    for (const [r0, r1] of [[HUB - 0.8, SPLIT], [SPLIT, R]]) for (let i = 0; i < NP; i++) {
      // canvas angle: world angle a maps to (sin a, cos a) -> canvas (x, -z flipped by the plane rotation); draw in the same (sin, cos) frame
      const a0 = i * PA, a1 = (i + 1) * PA; x.beginPath();
      for (let s = 0; s <= 8; s++) { const a = lerp(a0, a1, s / 8); x.lineTo(Math.sin(a) * r1 * k, Math.cos(a) * r1 * k); } for (let s = 8; s >= 0; s--) { const a = lerp(a0, a1, s / 8); x.lineTo(Math.sin(a) * r0 * k, Math.cos(a) * r0 * k); }
      x.closePath(); const g = x.createRadialGradient(0, 0, r0 * k, 0, 0, r1 * k);
      if (i % 2 === 0) { g.addColorStop(0, '#7a0a16'); g.addColorStop(1, '#c0182a'); } else { g.addColorStop(0, '#0c0c14'); g.addColorStop(1, '#22222e'); }
      x.fillStyle = g; x.fill(); x.strokeStyle = '#e8c060'; x.lineWidth = 5; x.stroke();
      const am = (a0 + a1) / 2, rm = r1 - 1.5; x.save(); x.translate(Math.sin(am) * rm * k, Math.cos(am) * rm * k); x.rotate(-am); x.fillStyle = '#f0d890'; x.font = 'bold 34px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String((r0 > 5 ? NO : NI)[i]), 0, 0); x.restore();
    }
    for (const r of [SPLIT, R - 0.15, HUB - 0.4]) { x.beginPath(); x.arc(0, 0, r * k, 0, TAU); x.strokeStyle = '#f0c860'; x.lineWidth = 9; x.stroke(); }
    return ctex(c);
  }
  // the gown: sixteen lacquer panels (red / black, a roulette wheel seen from the side) with gold piping; map + orm (G rough, B metal) + emissive piping
  function gownTex(bodice) {
    const W2 = 1024, H = 512, mk = () => { const c = document.createElement('canvas'); c.width = W2; c.height = H; return c; }, cm = mk(), co = mk(), ce = mk();
    const x = cm.getContext('2d'), y = co.getContext('2d'), e = ce.getContext('2d'), pw = W2 / 16;
    y.fillStyle = 'rgb(0,56,40)'; y.fillRect(0, 0, W2, H); e.fillStyle = '#000'; e.fillRect(0, 0, W2, H);
    for (let i = 0; i < 16; i++) {
      const red = bodice ? i % 4 === 0 : i % 2 === 0, g = x.createLinearGradient(0, 0, 0, H);
      if (red) { g.addColorStop(0, '#5a0612'); g.addColorStop(0.5, '#8a0c1c'); g.addColorStop(1, '#3a040c'); } else { g.addColorStop(0, '#22202c'); g.addColorStop(0.6, '#0e0c14'); g.addColorStop(1, '#050408'); }
      x.fillStyle = g; x.fillRect(i * pw, 0, pw, H);
      const s = x.createLinearGradient(i * pw, 0, (i + 1) * pw, 0); s.addColorStop(0, 'rgba(255,240,220,0)'); s.addColorStop(0.3, 'rgba(255,235,210,0.09)'); s.addColorStop(0.45, 'rgba(255,240,220,0)'); x.fillStyle = s; x.fillRect(i * pw, 0, pw, H);
    }
    const both = (f) => { for (const [k, st] of [[x, '#e6b850'], [y, 'rgb(0,60,255)'], [e, '#7a5418']]) { k.fillStyle = k.strokeStyle = st; f(k); } };
    both((k) => {
      for (let i = 0; i <= 16; i++) k.fillRect(i * pw - 3, 0, 6, H);
      k.fillRect(0, 0, W2, 10);
      if (bodice) { k.lineWidth = 6; k.beginPath(); k.moveTo(W2 * 0.5 - 90, 0); k.lineTo(W2 * 0.5, H * 0.75); k.lineTo(W2 * 0.5 + 90, 0); k.stroke(); return; }
      k.fillRect(0, H - 44, W2, 9); k.fillRect(0, H - 20, W2, 6);
      for (let i = 0; i < 16; i++) { const cx = (i + 0.5) * pw; k.beginPath(); k.moveTo(cx, H - 120); k.lineTo(cx + 15, H - 88); k.lineTo(cx, H - 56); k.lineTo(cx - 15, H - 88); k.closePath(); k.fill(); k.beginPath(); k.arc(cx, 40, 6, 0, TAU); k.fill(); }
    });
    if (!bodice) { const nums = [32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8]; x.fillStyle = '#f0d890'; x.font = 'bold 44px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; for (let i = 0; i < 16; i++) x.fillText(String(nums[i]), (i + 0.5) * pw, H * 0.6); }
    const t = ctex(cm), o = ctex(co, false), em = ctex(ce); return { map: t, orm: o, em };
  }
  function haloTex() {
    const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), k = N / 2 / 1.8, n = 24; x.translate(N / 2, N / 2);
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU, a1 = (i + 1) / n * TAU; x.beginPath();
      for (let s = 0; s <= 6; s++) { const a = lerp(a0, a1, s / 6); x.lineTo(Math.cos(a) * 1.79 * k, -Math.sin(a) * 1.79 * k); } for (let s = 6; s >= 0; s--) { const a = lerp(a0, a1, s / 6); x.lineTo(Math.cos(a) * 1.08 * k, -Math.sin(a) * 1.08 * k); }
      x.closePath(); x.fillStyle = i === 0 ? '#0a6a34' : i % 2 ? '#141018' : '#b0142a'; x.fill(); x.strokeStyle = '#e8c060'; x.lineWidth = 4; x.stroke();
      const am = (a0 + a1) / 2; x.save(); x.translate(Math.cos(am) * 1.56 * k, -Math.sin(am) * 1.56 * k); x.rotate(PI / 2 - am); x.fillStyle = '#f0d890'; x.font = 'bold 22px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i === 0 ? 0 : (i * 7) % 36 || 36), 0, 0); x.restore();
    }
    return ctex(c);
  }
  function chipTex(col, face) {
    const c = document.createElement('canvas'), x = c.getContext('2d');
    if (!face) {
      c.width = 256; c.height = 32; x.fillStyle = css(col); x.fillRect(0, 0, 256, 32); x.fillStyle = '#f2ead8'; for (let i = 0; i < 6; i++) x.fillRect(i * 42.7 + 16, 4, 11, 24);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0, 4, 256, 2); x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(0, 0, 256, 3); x.fillRect(0, 29, 256, 3);
    } else {
      c.width = c.height = 128; x.fillStyle = css(col); x.fillRect(0, 0, 128, 128); x.fillStyle = '#f2ead8';
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; x.save(); x.translate(64, 64); x.rotate(a); x.fillRect(-7, 50, 14, 14); x.restore(); }
      x.strokeStyle = '#e0b050'; x.lineWidth = 4; x.beginPath(); x.arc(64, 64, 38, 0, TAU); x.stroke(); x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.arc(64, 64, 34, 0, TAU); x.fill();
    }
    const t = ctex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function baizeTex() {
    const N = 2048, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), k = N / 2 / 110, r = mulberry(31); x.fillStyle = '#0c3a20'; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 26000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(80,140,90,0.07)'; x.fillRect(r() * N, r() * N, 2, 2); }
    x.translate(N / 2, N / 2); x.strokeStyle = 'rgba(225,185,95,0.5)'; x.lineWidth = 3;
    for (const rr of [31, 37, 44, 52]) { x.beginPath(); x.arc(0, 0, rr * k, 0, TAU); x.stroke(); }
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; x.beginPath(); x.moveTo(Math.cos(a) * 31 * k, Math.sin(a) * 31 * k); x.lineTo(Math.cos(a) * (i % 3 ? 44 : 52) * k, Math.sin(a) * (i % 3 ? 44 : 52) * k); x.stroke(); }
    x.fillStyle = 'rgba(225,185,95,0.42)'; x.font = 'bold 30px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 36; i++) { const a = (i + 0.5) / 36 * TAU; x.save(); x.translate(Math.cos(a) * 40.5 * k, Math.sin(a) * 40.5 * k); x.rotate(a + PI / 2); x.fillText(String(i + 1), 0, 0); x.restore(); }
    const g = x.createRadialGradient(0, 0, 27 * k, 0, 0, 108 * k); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.04, 'rgba(0,0,0,0)'); g.addColorStop(0.35, 'rgba(0,0,0,0.15)'); g.addColorStop(0.75, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = g; x.fillRect(-N / 2, -N / 2, N, N);
    return ctex(c);
  }
  function mahoganyTex() {
    const W2 = 2048, H = 256, c = document.createElement('canvas'); c.width = W2; c.height = H; const x = c.getContext('2d'), r = mulberry(77);
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2c1210'); g.addColorStop(0.5, '#3a1814'); g.addColorStop(1, '#1a0908'); x.fillStyle = g; x.fillRect(0, 0, W2, H);
    for (let i = 0; i < 420; i++) {
      const y0 = r() * H, a = 0.04 + r() * 0.1, ph = r() * TAU, amp = 0.3 + r() * 1.4; x.strokeStyle = r() < 0.5 ? `rgba(120,64,48,${a})` : `rgba(8,2,2,${a * 1.5})`; x.lineWidth = 0.4 + r() * 1.0; x.beginPath();
      for (let s = 0; s <= 64; s++) { const px = s / 64 * W2; x.lineTo(px, y0 + Math.sin(px / W2 * TAU * 3 + ph) * amp + Math.sin(px / W2 * TAU * 11 + ph * 2) * amp * 0.3); } x.stroke();
    }
    // ball track: a darker polished band with brass-diamond marquetry, and a gold inlay line
    x.fillStyle = 'rgba(10,2,1,0.55)'; x.fillRect(0, H * 0.18, W2, H * 0.16);
    x.fillStyle = 'rgba(200,160,90,0.55)'; for (let i = 0; i < 32; i++) { const cx = (i + 0.5) / 32 * W2, cy = H * 0.26; x.beginPath(); x.moveTo(cx - 14, cy); x.lineTo(cx, cy - 6); x.lineTo(cx + 14, cy); x.lineTo(cx, cy + 6); x.closePath(); x.fill(); }
    x.fillStyle = '#d8a848'; x.fillRect(0, H * 0.18, W2, 2); x.fillRect(0, H * 0.34, W2, 2); x.fillRect(0, H * 0.62, W2, 3);
    const t = ctex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 1); return t;
  }
  function glowCardTex() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 176; const x = c.getContext('2d');
    x.strokeStyle = 'rgba(255,190,80,0.18)'; x.lineWidth = 4; x.strokeRect(5, 5, 118, 166); x.strokeStyle = 'rgba(255,200,100,0.7)'; x.lineWidth = 1.5; x.strokeRect(5, 5, 118, 166);
    return ctex(c);
  }

  function build(b) {
    const g = G.world, S = b.state, vr = mulberry(808);
    const sky = W.sky({ top: 0x05010a, horizon: 0x2c0a2c, bottom: 0x030104, stars: 0.5, nebula: 0.55, nebulaA: 0x8a1a6a, nebulaB: 0x8a5a10, sunGlow: 0, sunSize: 0 }); g.add(sky); S.sky = sky; W.env(sky, 0.9);
    scene.fog = new THREE.FogExp2(0x0c0410, 0.006);
    S.hemi = W.hemi(g, 0x6a5ab8, 0x140a18, 0.8);
    S.key = W.sun(g, { dir: [0.25, 1, 0.35], color: 0xfff0d0, intensity: 2.0, size: 24 });
    S.lampL = new THREE.PointLight(0xffc878, 520, 80, 1.6); S.lampL.position.set(0, 22, 0); g.add(S.lampL);
    S.rimL = new THREE.PointLight(0x6a50ff, 140, 60, 1.6); S.rimL.position.set(0, 9, -22); g.add(S.rimL);
    S.rimC = RIMP[0].clone();
    // the wheel: two rings that can turn against each other
    const tex = wheelTex(), tin = tex.clone(); tin.repeat.set(SPLIT / R, SPLIT / R); tin.offset.set((1 - SPLIT / R) / 2, (1 - SPLIT / R) / 2); tin.needsUpdate = true;
    const lac = (t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.1, envMapIntensity: 1.2 });
    const goldM = W.mat({ color: 0xd9aa4a, roughness: 0.22, metalness: 1, envMapIntensity: 2.2 }), goldD = goldM.clone(); goldD.side = THREE.DoubleSide; const goldR = W.mat({ color: 0xa8803a, roughness: 0.45, metalness: 1, envMapIntensity: 1.4 });
    const rimB = W.mat({ color: 0x6a4a22, roughness: 0.4, metalness: 1, envMapIntensity: 0.9 });
    const brass = W.mat({ color: 0xa07828, roughness: 0.45, metalness: 0.6, envMapIntensity: 0.6, emissive: 0x5a3a0a, emissiveIntensity: 0.9 }), goldB = W.mat({ color: 0xc89a48, roughness: 0.4, metalness: 1, envMapIntensity: 1.6 });
    S.inlayM = W.mat({ color: 0xd9aa4a, roughness: 0.3, metalness: 1, envMapIntensity: 1.8, emissive: MAG, emissiveIntensity: 0 });
    S.sepM = W.mat({ color: 0xd9aa4a, roughness: 0.3, metalness: 1, envMapIntensity: 2.0, emissive: GOLD, emissiveIntensity: 0 }); S.sepT = { value: 0 }; S.sepP = { value: 0 };
    S.sepM.onBeforeCompile = (sh) => { sh.uniforms.uT = S.sepT; sh.uniforms.uP = S.sepP; sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vWP;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uT, uP; varying vec3 vWP;\nvoid main() {').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float rr = length(vWP.xz); float pl = pow(clamp(0.5 + 0.5 * sin(rr * 0.75 - uT * 7.0), 0.0, 1.0), 8.0); totalEmissiveRadiance *= mix(1.0, (0.12 + 1.4 * pl) * smoothstep(4.5, 7.5, rr), clamp(uP, 0.0, 1.0)); }'); };
    S.sepM.customProgramCacheKey = () => 'wheelsep';
    S.inner = new THREE.Group(); S.outer = new THREE.Group(); g.add(S.inner); g.add(S.outer);
    const mi = new THREE.Mesh(new THREE.RingGeometry(HUB - 0.8, SPLIT, 96, 1), lac(tin)); mi.rotation.x = -PI / 2; mi.rotation.z = PI; mi.receiveShadow = true; S.inner.add(mi);
    const mo = new THREE.Mesh(new THREE.RingGeometry(SPLIT, R, 128, 1), lac(tex)); mo.rotation.x = -PI / 2; mo.rotation.z = PI; mo.receiveShadow = true; S.outer.add(mo);
    for (const [grp, r0, r1] of [[S.inner, HUB - 0.6, SPLIT - 0.1], [S.outer, SPLIT + 0.1, R - 0.1]]) { const L = []; for (let i = 0; i < NP; i++) { const a = i * PA; L.push(T(new THREE.BoxGeometry(0.14, 0.1, r1 - r0), Math.sin(a) * (r0 + r1) / 2, 0.03, Math.cos(a) * (r0 + r1) / 2, 0, a, 0)); } grp.add(new THREE.Mesh(merge(L), S.sepM)); }
    const div = new THREE.Mesh(new THREE.TorusGeometry(SPLIT, 0.13, 6, 96), S.sepM); div.rotation.x = PI / 2; div.position.y = 0.02; g.add(div);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.35, 0.45, 10, 96), goldR); rim.rotation.x = PI / 2; rim.position.y = 0.2; g.add(rim);
    // the bowl: polished mahogany with a ball track, brass deflectors and gold inlay
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(27, R + 0.6, 4.2, 128, 1, true), new THREE.MeshPhysicalMaterial({ map: mahoganyTex(), roughness: 0.5, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.BackSide, envMapIntensity: 1.1 })); bowl.position.y = 2.2; g.add(bowl);
    const bt = (k) => [0.1 + 4.2 * k, R + 0.6 + (27 - R - 0.6) * k];
    for (const k of [0.16, 0.86]) { const [y, r] = bt(k); const t = new THREE.Mesh(new THREE.TorusGeometry(r - 0.05, 0.07, 6, 128), S.inlayM); t.rotation.x = PI / 2; t.position.y = y; g.add(t); }
    { const NDF = 16, [y, r] = bt(0.47), df = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.5, 0), brass, NDF); for (let i = 0; i < NDF; i++) { const a = (i + 0.5) / NDF * TAU; _m.position.set(Math.sin(a) * (r - 0.2), y + 0.1, Math.cos(a) * (r - 0.2)); _m.rotation.set(-0.42, a, 0, 'YXZ'); _m.scale.set(1.6, 0.55, 0.75); _m.updateMatrix(); df.setMatrixAt(i, _m.matrix); } _m.rotation.set(0, 0, 0, 'XYZ'); _m.scale.setScalar(1); g.add(df); }
    const lip = new THREE.Mesh(new THREE.TorusGeometry(27, 0.6, 10, 128), rimB); lip.rotation.x = PI / 2; lip.position.y = 4.3; g.add(lip);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(27.9, 0.16, 8, 128), rimB); rail.rotation.x = PI / 2; rail.position.y = 5.7; g.add(rail);
    { const NP2 = 48, posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 1.1, 6), goldR, NP2); for (let i = 0; i < NP2; i++) { const a = (i + 0.5) / NP2 * TAU; _m.position.set(Math.sin(a) * 27.9, 5.15, Math.cos(a) * 27.9); _m.updateMatrix(); posts.setMatrixAt(i, _m.matrix); } g.add(posts); }
    const under = new THREE.Mesh(new THREE.CircleGeometry(R + 1, 48), W.mat({ color: 0x0a0406 })); under.rotation.x = -PI / 2; under.position.y = -0.05; g.add(under);
    const baize = new THREE.Mesh(new THREE.RingGeometry(27.3, 112, 128, 1), new THREE.MeshStandardMaterial({ map: baizeTex(), roughness: 0.95, metalness: 0 })); baize.rotation.x = -PI / 2; baize.position.y = 4.32; g.add(baize);
    S.bulbs = W.glow(0xffffff, 2.4); const NB = 48, bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 10, 8), S.bulbs, NB); for (let i = 0; i < NB; i++) { const a = i / NB * TAU; _m.position.set(Math.sin(a) * 27, 5, Math.cos(a) * 27); _m.updateMatrix(); bl.setMatrixAt(i, _m.matrix); bl.setColorAt(i, _c.setHex(GOLD)); } g.add(bl); S.bl = bl; S.NB = NB; S.bulbCol = new THREE.Color(GOLD);
    S.bulbs2 = W.glow(GOLD, 2.4);
    // the hall: chip towers (two tiers), drifting cards, chandeliers
    const chipC = [0xc0182a, 0x1a1a24, 0x1a7a4a, 0xd9aa4a, 0x2a3aa0], sideT = chipC.map((c) => chipTex(c)), faceT = chipC.map((c) => chipTex(c, true));
    S.stacks = [];
    const stack = (x, z, n, ci, rad, dim) => {
      const h = n * 0.5, sm = sideT[ci].clone(); sm.needsUpdate = true; sm.repeat.set(1, n);
      const tint = dim ? 0x6a6a6a : 0xffffff, mats = [new THREE.MeshStandardMaterial({ map: sm, color: tint, roughness: 0.45, metalness: 0.1 }), new THREE.MeshStandardMaterial({ map: faceT[ci], color: tint, roughness: 0.4 }), W.mat({ color: 0x0a0406 })];
      const st = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 28), mats); st.position.set(x, 4.32 + h / 2, z); st.rotation.set((vr() - 0.5) * 0.06, vr() * TAU, (vr() - 0.5) * 0.08); g.add(st);
      if (!dim) S.stacks.push({ x, z, top: 4.32 + h, ci });
    };
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + vr() * 0.2, rr = 34 + vr() * 24; stack(Math.sin(a) * rr, Math.cos(a) * rr, 12 + Math.floor(vr() * 30), i % 5, 2.6, false); }
    for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU + vr() * 0.2, rr = 82 + vr() * 18; stack(Math.sin(a) * rr, Math.cos(a) * rr, 30 + Math.floor(vr() * 40), (i + 2) % 5, 4.2, true); }
    const shc2 = document.createElement('canvas'); shc2.width = 256; shc2.height = 16; { const x = shc2.getContext('2d'); x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, 256, 16); x.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) x.fillRect(i * 32 + 8, 0, 16, 16); }
    const shSide = W.mat({ map: ctex(shc2), color: 0xffffff, roughness: 0.3, metalness: 0.2, emissive: MAG, emissiveIntensity: 0.35 }), shFace = W.mat({ color: 0xffffff, roughness: 0.3, metalness: 0.2, map: faceT[3] });
    S.shed = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 0.75, 0.18, 20), [shSide, shFace, shFace], 48); S.shed.frustumCulled = false; S.shed.count = 0;
    S.shedP = []; for (let i = 0; i < 48; i++) { const st = S.stacks[i % S.stacks.length]; S.shed.setColorAt(i, _c.setHex(chipC[st.ci])); S.shedP.push({ st, ph: vr(), sp: 0.07 + vr() * 0.05, ca: Math.floor(i / 6) / 8 * TAU + 0.3, cr: 23 + vr() * 6, dx: vr() - 0.5, dz: vr() - 0.5, rx: vr() * 3, rz: vr() * 3 }); } g.add(S.shed);
    S.float = [];
    for (let i = 0; i < 22; i++) {
      const far = i >= 14, m = new THREE.Mesh(new THREE.PlaneGeometry(5, 7.2), new THREE.MeshBasicMaterial({ map: cardTex(i % 5 - 1), side: THREE.DoubleSide, color: far ? 0x303030 : 0x8a8a8a })); const a = vr() * TAU, rr = far ? 62 + vr() * 25 : 38 + vr() * 18;
      m.position.set(Math.sin(a) * rr, far ? 22 + vr() * 26 : 8 + vr() * 16, Math.cos(a) * rr); m.rotation.set(vr() * 3, vr() * 3, vr() * 3); g.add(m);
      S.float.push({ m, s: 0.1 + vr() * 0.25, far, home: m.position.clone(), a0: vr() * TAU, vr: 5 + vr() * 7, vy: 16 + vr() * 6, w: 0.5 + vr() * 0.4 });
    }
    for (const [x, y, z, r] of [[0, 21, 0, 6], [-18, 24, -16, 3.5], [19, 25, 14, 3.5]]) {
      const ch = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 40), goldM); ch.rotation.x = PI / 2; ch.position.set(x, y, z); g.add(ch);
      const ch2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, 0.14, 8, 32), goldM); ch2.rotation.x = PI / 2; ch2.position.set(x, y + 1.6, z); g.add(ch2);
      const n = Math.round(r * 5), cb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), S.bulbs2, n * 2); for (let i = 0; i < n * 2; i++) { const a = i / n * TAU, q = i < n ? 1 : 0.55; _m.position.set(x + Math.sin(a) * r * q, y - 0.35 + (i < n ? 0 : 1.6), z + Math.cos(a) * r * q); _m.updateMatrix(); cb.setMatrixAt(i, _m.matrix); } g.add(cb);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 30, 6), goldM); rod.position.set(x, y + 15, z); g.add(rod);
    }
    // a soft cone of light from the great chandelier down onto the table (bright only at its silhouette, fades before the floor)
    S.cone = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 16, 19, 48, 1, true), new THREE.ShaderMaterial({
      uniforms: { uC: { value: new THREE.Color(0xffd890).multiplyScalar(0.5) }, uA: { value: 0.32 }, uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; vN=normalMatrix*normal; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uC; uniform float uA,uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float ln=max(length(vN),1e-4), lv=max(length(vV),1e-4); float f=1.0-clamp(abs(dot(vN/ln,vV/lv)),0.0,1.0); float y=clamp(vUv.y,0.0,1.0); float a=smoothstep(0.35,0.8,f)*(1.0-smoothstep(0.8,0.98,f))*uA*smoothstep(0.0,0.45,y)*smoothstep(1.0,0.5,y)*smoothstep(5.0,14.0,lv)*(0.75+0.25*sin(vUv.x*56.5+uT*0.4)); gl_FragColor=vec4(max(uC*a,vec3(0.0)),a); }',
    })); S.cone.visible = false; g.add(S.cone);
    S.motes = W.motes({ n: 300, box: [60, 24, 60], color: GOLD, size: 0.07, vel: [0, -0.12, 0], sway: 0.6, center: [0, 11, 0], mult: 1.1 }); g.add(S.motes);
    const coinF = W.mat({ color: 0xc89848, roughness: 0.3, metalness: 1, envMapIntensity: 2, emissive: 0x8a6020, emissiveIntensity: 0.8 }); S.coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 16), [W.mat({ color: 0xffe8a0, roughness: 0.15, metalness: 1, emissive: 0xffd060, emissiveIntensity: 1.6 }), coinF, coinF], 130); S.coins.frustumCulled = false; S.coins.count = 0; g.add(S.coins);
    S.coinP = []; for (let i = 0; i < 130; i++) S.coinP.push({ a: vr() * TAU, r: 11.5 + Math.sqrt(vr()) * 15, sp: 5 + vr() * 3, ph: vr(), fx: vr() * TAU, fs: 5 + vr() * 6 });
    // cards, dice, hurdles, balls
    const back = cardTex(-1), fronts = [0, 1, 2, 3].map(cardTex), edge = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 0.8, roughness: 0.3 }), gct = glowCardTex();
    S.cards = []; for (let i = 0; i < 6; i++) {
      const grp = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.05, 4.7), [edge, edge, new THREE.MeshBasicMaterial({ map: back, color: 0xd0d0d0 }), new THREE.MeshBasicMaterial({ map: fronts[0], color: 0xd8d8d8 }), edge, edge]); m.castShadow = true; grp.add(m); grp.visible = false; g.add(grp);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 5.9), new THREE.MeshBasicMaterial({ map: gct, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); gl.rotation.x = -PI / 2; gl.visible = false; g.add(gl);
      S.cards.push({ g: grp, m, gl, on: false, flip: 0, la: 0, r: 0, suit: 0, y: 0 });
    }
    S.fronts = fronts;
    const pm = [2, 5, 1, 6, 3, 4].map((n) => new THREE.MeshStandardMaterial({ map: pipTex(n), roughness: 0.3, emissive: 0xffffff, emissiveMap: pipTex(n), emissiveIntensity: 0.3 }));
    S.dice = []; for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 1.9), pm); m.castShadow = true; m.visible = false; g.add(m); S.dice.push({ m, state: 'off', la: 0, r: 0, v: 1, t: 0, left: 0, next: 0, x: 0, z: 0 }); }
    S.waves = []; S.wavePool = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(GOLD).multiplyScalar(2.2) }, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: VS_UV, fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float y=clamp(vUv.y,0.0,1.0); float a=((1.0-y)*(1.0-y)*0.8+step(0.9,y)*0.9+step(y,0.08)*0.9)*uA; gl_FragColor=vec4(uC*a,a); }' })); m.visible = false; m.renderOrder = 13; g.add(m); S.wavePool.push(m); }
    const ballM = withRim(new THREE.MeshPhysicalMaterial({ color: 0xe6dac2, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 3 }), new THREE.Color(0xa06a20), 1.8), trailM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb060).multiplyScalar(0.7), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
    const shc = document.createElement('canvas'); shc.width = shc.height = 64; { const x = shc.getContext('2d'), gg = x.createRadialGradient(32, 32, 0, 32, 32, 32); gg.addColorStop(0, 'rgba(0,0,0,0.85)'); gg.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(0, 0, 64, 64); }
    const shM = new THREE.MeshBasicMaterial({ map: ctex(shc), transparent: true, depthWrite: false }), sphG = new THREE.SphereGeometry(1.05, 32, 24);
    S.balls = []; for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(sphG, ballM); m.visible = false; g.add(m); const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), shM); sh.rotation.x = -PI / 2; sh.visible = false; g.add(sh); const tr = []; for (let k = 0; k < 5; k++) { const q = new THREE.Mesh(sphG, trailM); q.visible = false; q.scale.setScalar(0.7 - k * 0.13); g.add(q); tr.push(q); } S.balls.push({ m, sh, tr, state: 'off', a: 0, r: 0, w: 0, ring: i, t: 0, cd: 0 }); }

    // ---- Lady Fortuna: a gilded croupier-goddess whose gown is a wheel ----
    const bg = b.group, porcelain = withRim(W.mat({ color: 0xe2d8cc, roughness: 0.4, metalness: 0.02, emissive: 0x2a241e }), S.rimP = new THREE.Color(), 3.2);
    const gt = gownTex(false), bt2 = gownTex(true);
    S.gownE = []; const gownM = (q, rf = 1) => { const m = withRim(new THREE.MeshStandardMaterial({ map: q.map, roughnessMap: q.orm, metalnessMap: q.orm, roughness: rf, metalness: 1, emissive: 0xffffff, emissiveMap: q.em, emissiveIntensity: 0.25, envMapIntensity: 1.5, side: THREE.DoubleSide }), S.rimC, 2.2); S.gownE.push(m); return m; };
    const glove = withRim(W.mat({ color: 0x2a040c, roughness: 0.2, metalness: 0.3, envMapIntensity: 1.8 }), S.rimC, 2.0);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(HUB - 0.5, HUB - 0.2, 0.9, 48), goldR); hub.position.y = 0.45; hub.castShadow = true; bg.add(hub);
    S.rig = new THREE.Group(); bg.add(S.rig);
    // skirt: pleated lathe, sixteen panels, scalloped hem; it turns slowly on its own like the wheel
    const sg = new THREE.LatheGeometry(v2([[3.2, 0.82], [3.05, 1.3], [2.55, 2.1], [1.95, 2.95], [1.4, 3.7], [0.95, 4.35], [0.68, 4.78]]), 64);
    { const pa = sg.attributes.position; for (let i = 0; i < pa.count; i++) { const px = pa.getX(i), py = pa.getY(i), pz = pa.getZ(i), a = Math.atan2(px, pz), f = 1 + 0.06 * Math.cos(a * 16) * sat((4.6 - py) / 3); pa.setX(i, px * f); pa.setZ(i, pz * f); if (py < 0.9) pa.setY(i, py + 0.26 * Math.abs(Math.sin(a * 8))); } sg.computeVertexNormals(); }
    S.skirt = new THREE.Mesh(sg, gownM(gt)); S.skirt.castShadow = true; S.rig.add(S.skirt);
    const bodM = gownM(bt2, 1.7), bod = new THREE.Mesh(new THREE.LatheGeometry(v2([[0.66, 4.7], [0.74, 5.0], [0.98, 5.42], [1.03, 5.68], [0.9, 5.96], [0.56, 6.16], [0.2, 6.3]]), 32), bodM); bod.castShadow = true; S.rig.add(bod);
    S.trim = new THREE.MeshStandardMaterial({ color: 0x241a08, emissive: GOLD, emissiveIntensity: 0.7, metalness: 1, roughness: 0.3 });
    const hemF = new THREE.Mesh(new THREE.TorusGeometry(3.42, 0.028, 4, 96), S.trim); hemF.rotation.x = PI / 2; hemF.position.y = 0.86; S.rig.add(hemF);
    // gold: belt, choker, collar fan, pauldrons with flared spikes
    const gl = [T(new THREE.TorusGeometry(0.72, 0.08, 8, 32), 0, 4.74, 0, PI / 2), T(new THREE.TorusGeometry(0.2, 0.04, 6, 20), 0, 6.48, 0, PI / 2)];
    for (const sx of [-1, 1]) {
      gl.push(T(new THREE.SphereGeometry(0.52, 16, 8, 0, TAU, 0, PI / 2), sx * 1.08, 5.88, 0, 0, 0, -sx * 0.45, 1, 0.5, 1));
      for (let k = 0; k < 3; k++) { const tz = -sx * (0.5 + k * 0.35); gl.push(T(new THREE.ConeGeometry(0.08, 0.8 - k * 0.12, 5), sx * (1.3 + k * 0.1) + Math.sin(-tz) * 0.3, 6.1 + Math.cos(tz) * 0.3, (k - 1) * 0.2, 0, 0, tz)); }
    }
    const gilt = W.mat({ color: 0x8a6428, roughness: 0.55, metalness: 1, envMapIntensity: 1.1 }); S.rig.add(new THREE.Mesh(merge(gl), gilt));
    const collar = new THREE.Mesh(new THREE.LatheGeometry(v2([[0.28, 6.15], [0.42, 6.45], [0.75, 7.05], [1.05, 7.55], [1.16, 7.74]]), 20, PI * 0.6, PI * 0.8), bodM); S.rig.add(collar);
    const colF = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.022, 4, 40, PI * 0.8), S.trim); colF.rotation.set(PI / 2, 0, -PI * 0.9); colF.position.y = 7.74; S.rig.add(colF);
    // head: porcelain mask face, gold masquerade band, glowing eye slits, tall coiffure and crown
    S.head = new THREE.Group(); S.head.position.y = 7.12; S.head.scale.setScalar(1.4); S.rig.add(S.head);
    const face = new THREE.Mesh(merge([T(new THREE.SphereGeometry(0.5, 28, 20), 0, 0, 0, 0, 0, 0, 0.85, 1.12, 0.9), T(new THREE.BoxGeometry(0.05, 0.2, 0.07), 0, -0.06, 0.445, -0.12)]), porcelain); face.castShadow = true; S.head.add(face);
    const mask = new THREE.Mesh(T(new THREE.SphereGeometry(0.515, 30, 6, PI / 2 - 1.45, 2.9, 1.12, 0.48), 0, 0, 0, 0, 0, 0, 0.86, 1.12, 0.92), goldD); S.head.add(mask);
    const slitM = new THREE.MeshBasicMaterial({ color: 0x050205 }); S.eyeM = W.glow(GOLD, 2.4);
    for (const sx of [-1, 1]) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.04), slitM); sl.position.set(sx * 0.16, 0.06, 0.43); sl.rotation.set(0, sx * 0.38, sx * -0.14); S.head.add(sl); const ey = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.024, 0.01), S.eyeM); ey.position.set(sx * 0.16, 0.06, 0.452); ey.rotation.copy(sl.rotation); S.head.add(ey); }
    const lips = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), W.mat({ color: 0xb0101c, roughness: 0.3 })); lips.scale.set(1.5, 0.6, 0.6); lips.position.set(0, -0.24, 0.4); S.head.add(lips);
    const hair = new THREE.Mesh(new THREE.LatheGeometry(v2([[0, 0.24], [0.36, 0.28], [0.47, 0.44], [0.45, 0.62], [0.31, 0.8], [0.22, 0.95], [0.33, 1.15], [0.34, 1.35], [0.24, 1.58], [0.12, 1.74], [0, 1.78]]), 22), withRim(W.mat({ color: 0x1c0610, roughness: 0.28, metalness: 0.35, envMapIntensity: 1.6 }), S.rimC, 2.4)); hair.position.z = -0.1; S.head.add(hair);
    S.head.add(new THREE.Mesh(T(new THREE.SphereGeometry(0.535, 28, 16, PI / 2 + 1.3, TAU - 2.6, 0, PI * 0.66), 0, 0.02, -0.02, 0, 0, 0, 0.88, 1.12, 0.94), hair.material));
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), hair.material); bun.position.set(0, 0.12, -0.5); bun.scale.set(1, 0.9, 0.8); S.head.add(bun);
    const cl = [T(new THREE.TorusGeometry(0.505, 0.035, 6, 40), 0, 0.47, -0.1, PI / 2), T(new THREE.TorusGeometry(0.3, 0.03, 6, 28), 0, 0.12, -0.5, 0, 0, 0, 1, 0.9, 1)];
    for (let i = 0; i < 9; i++) { const a = (i - 4) * 0.3, hh = 0.62 - Math.abs(i - 4) * 0.08; cl.push(T(new THREE.ConeGeometry(0.05, hh, 5), Math.sin(a) * 0.47, 0.5 + hh / 2, -0.1 + Math.cos(a) * 0.47, Math.cos(a) * 0.22, 0, -Math.sin(a) * 0.22)); }
    S.head.add(new THREE.Mesh(merge(cl), goldB));
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), W.glow(0xff2040, 1.6)); gem.position.set(0, 0.6, 0.39); gem.scale.set(1, 1.4, 0.6); S.head.add(gem);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 12), porcelain); neck.position.y = 6.45; S.rig.add(neck);
    // the halo is a fortune wheel: pocket ring, spokes, a riding ball, a filament; a sunburst flares behind it in the jackpot
    S.halo = new THREE.Group(); S.halo.position.set(0, 7.62, -1.65); S.rig.add(S.halo);
    S.hSpin = new THREE.Group(); S.halo.add(S.hSpin);
    const htx = haloTex(); S.hSpin.add(new THREE.Mesh(new THREE.RingGeometry(1.08, 1.8, 48, 1), new THREE.MeshStandardMaterial({ map: htx, emissive: 0xffffff, emissiveMap: htx, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide })));
    const hg = [T(new THREE.TorusGeometry(1.86, 0.09, 8, 72)), T(new THREE.TorusGeometry(1.08, 0.05, 6, 48)), T(new THREE.SphereGeometry(0.27, 14, 10), 0, 0, 0, 0, 0, 0, 1, 1, 0.55)];
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; hg.push(T(new THREE.BoxGeometry(0.07, 0.84, 0.05), Math.sin(a) * 0.66, Math.cos(a) * 0.66, 0, 0, 0, -a)); }
    for (let i = 0; i < 24; i++) { const a = (i + 0.5) / 24 * TAU; hg.push(T(new THREE.ConeGeometry(0.05, 0.22, 5), Math.sin(a) * 2.02, Math.cos(a) * 2.02, 0, 0, 0, -a)); }
    S.hSpin.add(new THREE.Mesh(merge(hg), goldD));
    S.hSpin.add(new THREE.Mesh(new THREE.TorusGeometry(2.16, 0.022, 4, 96), S.trim));
    S.hBall = new THREE.Group(); S.halo.add(S.hBall); const hb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), W.mat({ color: 0xf6f0e0, roughness: 0.07, envMapIntensity: 2.5 })); hb.position.set(0, 1.44, 0.1); S.hBall.add(hb);
    S.burst = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.ShaderMaterial({
      uniforms: { uC: { value: new THREE.Color(0xffc860).multiplyScalar(1.2) }, uA: { value: 0 }, uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, vertexShader: VS_UV,
      fragmentShader: 'uniform vec3 uC; uniform float uA,uT; varying vec2 vUv; void main(){ vec2 p=vUv*2.0-1.0; float r=length(p); float an=atan(p.y,p.x+1e-5); float ray=pow(clamp(0.5+0.5*sin(an*16.0+uT*1.6),0.0,1.0),6.0)*0.8+pow(clamp(0.5+0.5*sin(an*7.0-uT*0.9),0.0,1.0),12.0)*0.6; float fall=smoothstep(1.0,0.3,r)*smoothstep(0.18,0.42,r)*smoothstep(-0.6,0.2,p.y); float a=clamp(ray*fall*uA,0.0,1.0); gl_FragColor=vec4(max(uC*a,vec3(0.0)),a); }',
    })); S.burst.position.z = -0.2; S.burst.visible = false; S.halo.add(S.burst);
    // four arms: tapered porcelain, gold armbands and bracelets, real hands
    const uaG = new THREE.LatheGeometry(v2([[0, -1.84], [0.15, -1.78], [0.17, -1.2], [0.2, -0.5], [0.2, -0.1], [0, 0.02]]), 16), faG = new THREE.LatheGeometry(v2([[0, -1.74], [0.11, -1.68], [0.13, -1.2], [0.17, -0.35], [0.2, 0.1], [0.23, 0.34], [0, 0.36]]), 16);
    const puffG = T(new THREE.SphereGeometry(0.36, 16, 12), 0, -0.22, 0, 0, 0, 0, 1, 1.15, 1), puffM = bodM;
    const ugG = merge([T(new THREE.TorusGeometry(0.205, 0.03, 6, 24), 0, -0.75, 0, PI / 2)]);
    const fgG = merge([T(new THREE.TorusGeometry(0.13, 0.035, 6, 20), 0, -1.5, 0, PI / 2), T(new THREE.TorusGeometry(0.23, 0.028, 6, 24), 0, 0.33, 0, PI / 2), T(new THREE.TorusGeometry(0.2, 0.02, 6, 24), 0, 0.18, 0, PI / 2)]);
    const hl = [T(new THREE.BoxGeometry(0.17, 0.2, 0.065), 0, -0.1, 0)]; for (const [fx, l] of [[-0.06, 0.15], [-0.02, 0.18], [0.02, 0.17], [0.06, 0.14]]) hl.push(T(new THREE.CylinderGeometry(0.021, 0.016, l, 6), fx, -0.2 - l / 2, 0.02, 0.28)); hl.push(T(new THREE.CylinderGeometry(0.023, 0.018, 0.14, 6), 0.1, -0.1, 0.035, 0, 0, 0.7));
    const handG = merge(hl);
    S.arms = [];
    for (const [sx, y, up, ox] of [[1, 5.75, 1, 1.15], [-1, 5.75, 1, 1.15], [1, 5.1, 0, 0.88], [-1, 5.1, 0, 0.88]]) {
      const sh = new THREE.Group(); sh.position.set(sx * ox, y, 0); S.rig.add(sh);
      const ua = new THREE.Mesh(uaG, glove); ua.castShadow = true; sh.add(ua); sh.add(new THREE.Mesh(ugG, gilt)); if (up) sh.add(new THREE.Mesh(puffG, puffM));
      const el = new THREE.Group(); el.position.y = -1.8; sh.add(el);
      const la = new THREE.Mesh(faG, glove); la.castShadow = true; el.add(la); el.add(new THREE.Mesh(fgG, gilt));
      const hand = new THREE.Group(); hand.position.y = -1.7; hand.scale.setScalar(1.5); el.add(hand); hand.add(new THREE.Mesh(handG, glove));
      S.arms.push({ sh, el, hand, sx, up });
    }
    const fanG = new THREE.BoxGeometry(0.85, 1.2, 0.025); fanG.translate(0, -0.6, 0); const fanE = W.mat({ color: 0xd9aa4a, roughness: 0.35, metalness: 1, emissive: 0x4a3008 });
    for (let i = 0; i < 5; i++) { const fm = new THREE.MeshBasicMaterial({ map: i % 2 ? fronts[(i >> 1) % 4 === 0 ? 1 : 3] : fronts[[0, 2, 1][i >> 1]], color: 0xc8c8c8 }), c = new THREE.Mesh(fanG, [fanE, fanE, fanE, fanE, fm, new THREE.MeshBasicMaterial({ map: back, color: 0xc0c0c0 })]); c.position.set(0, -0.22, 0.06 + i * 0.012); c.rotation.z = (i - 2) * -0.36; S.arms[0].hand.add(c); }
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.55, 14, 1, true), W.mat({ color: 0x3a1408, roughness: 0.35, side: THREE.DoubleSide })); cup.position.y = -0.36; S.arms[1].hand.add(cup);
    const cupR = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 20), goldM); cupR.rotation.x = PI / 2; cupR.position.y = -0.64; S.arms[1].hand.add(cupR);
    S.rake = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, R - 2), goldM); shaft.position.z = (R - 2) / 2 + 2; S.rake.add(shaft); const head2 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 0.25), goldM); head2.position.z = R - 0.3; S.rake.add(head2); S.rake.position.y = 0.6; S.rake.visible = false; g.add(S.rake);
    Object.assign(S, { ao: 0, ai: 0, wo: 0.2, wi: 0.2, wT: 0.2, counter: false, frenzy: 0, gest: 0, rakeOn: 0, lvl: 0, vort: 0, burstA: 0, camW: 0, riders: [] });
    return {
      edge: 'wall', spawn: { x: 0, z: 13 }, bossStart: { x: 0, z: 0, face: 0 }, camDist: 16,
      contains: (x, z) => { const d = Math.hypot(x, z); return d <= R - 0.5 && d >= HUB; },
      clamp(p) { const d = Math.hypot(p.x, p.z) || 1; if (d > R - 0.6) { p.x *= (R - 0.6) / d; p.z *= (R - 0.6) / d; } else if (d < HUB + 0.1) { p.x *= (HUB + 0.1) / d; p.z *= (HUB + 0.1) / d; } },
      bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
      camLimit(x, y, z) { const d = Math.hypot(x, z); if (d > 25.5) { x *= 25.5 / d; z *= 25.5 / d; } return { x, y: Math.max(y, d > R ? 0.5 + (d - R) * 0.45 : 0.35), z }; },
    };
  }

  // a short-lived FX mesh that turns with the ring at radius r, so it holds still under the locked camera
  function ride(S, m, r) { if (m) S.riders.push({ m, r, t: m.userData.dur || 0.5 }); }
  // ---- the house games ----
  function erupt(b, col, ring, delay) {
    const S = b.state, c = col ? INK : RED;
    const rs = ring === 0 ? [[HUB - 0.3, SPLIT]] : ring === 1 ? [[SPLIT, R]] : [[HUB - 0.3, R]];
    Sound.sfx('warn', 1.6, col ? 0.7 : 1.3);
    for (let k = col; k < NP; k += 2) for (const [r0, r1] of rs) {
      Hz.cone(0, 0, 0, PA - 0.03, r1, delay, 400, { r0, name: col ? 'Noir' : 'Rouge', color: c, quiet: true, lock: 0, trackFired: true, track: (s) => { s.dir = (k + 0.5) * PA + ringA(S, (r0 + r1) / 2); },
        onFire(h) { const a = h.shape.dir; for (const rr of [r0 + 2, (r0 + r1) / 2, r1 - 1.5]) ride(S, FX.pillar(Math.sin(a) * rr, Math.cos(a) * rr, { r: 1.8, h: 12, color: c, dur: 0.5 }), rr); FX.burst(Math.sin(a) * (r0 + r1) / 2, 0.3, Math.cos(a) * (r0 + r1) / 2, { n: 14, color: c, color2: GOLD, speed: [2, 8], up: 6, life: [0.4, 0.9], radius: 2 }); } });
    }
    Co.start(function* () { yield delay; Sound.sfx('bigboom', 0.5); FX.shake(0.5); }, 'phase');
  }
  function* spin(b, n = 1) {
    const S = b.state; S.gest = 1; yield* b.cast({ name: 'No More Bets', time: 0.9 });
    for (let i = 0; i < n; i++) { const bl = S.balls[n === 1 ? 1 : i]; bl.ring = n === 1 ? 2 : i; bl.state = 'roll'; bl.r = bl.ring === 0 ? SPLIT : R - 1.0; bl.a = rnd(TAU); bl.w = -(Math.sign(S.wo) || 1) * (5.2 + i * 0.9) * (bl.ring === 0 ? -1 : 1); bl.t = 0; bl.m.visible = true; }
    Sound.sfx('dash', 1, 0.5); yield 1.2;
  }
  function suitHz(b, c, delay) {
    const S = b.state, o = (track) => ({ name: SUITN[c.suit], color: SUITC[c.suit], lock: 0, trackFired: true, track });
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
      Co.start(function* () {
        yield delay; const w = wpos(S, c.la, c.r, {}), sc = SUITC[c.suit];
        if (!G.headless) { FX.burst(w.x, 0.5, w.z, { n: 40, color: sc, color2: GOLD, speed: [4, 12], life: [0.35, 0.9], size: [0.25, 0.6], drag: 2.2 }); ride(S, FX.ring(w.x, w.z, { r0: 0.3, r1: 5.2, color: sc, dur: 0.5, width: 0.16 }), c.r); FX.light(w.x, 1.5, w.z, sc, 60, 0.45, 18); }
        FX.shake(0.44); Sound.sfx('boom', 0.9, 0.9 + c.suit * 0.15); c.on = false; c.g.visible = false; c.gl.visible = false;
      }, 'phase');
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
    for (let i = 0; i < n; i++) { const ga = b.angToPlayer() + rnd(-0.5, 0.5); for (let k = 0; k < 18; k++) { const a = off + k / 18 * TAU; if (Math.abs(angDiff(a, ga)) < 0.42) continue; Bul.fire({ x: Math.sin(a) * 3.2, z: Math.cos(a) * 3.2, dir: a, speed: 6.6, r: 0.4, dmg: 110, color: 0xd06a08, life: 2.3 }); } off += 0.17; Sound.sfx('bell', 0.3, 3); FX.ring(0, 0, { r1: 6, color: GOLD, dur: 0.4 }); yield gap; }
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
    for (let i = 0; i < 26; i++) { const a = i * 0.55; for (const o of [0, PI]) Bul.fire({ x: Math.sin(a + o) * 3.2, z: Math.cos(a + o) * 3.2, dir: a + o, speed: 6, r: 0.4, dmg: 110, color: 0xd06a08, life: 2.5 }); if (i % 4 === 0) Sound.sfx('tick', 1.5, 2); yield 0.26; }
    yield 1.0;
  }
  const turn = (S) => { S.wT = -S.wT; Sound.sfx('steam', 0.8, 0.5); };
  function setLvl(b, n) {
    const S = b.state, sp = [0.2, 0.3, 0.3][n]; S.lvl = n; S.wT = (Math.sign(S.wT) || 1) * sp; S.counter = n === 2; S.coins.count = n === 2 ? 130 : 0; S.rimL.color.setHex(RIML[n][0]); S.rimL.intensity = RIML[n][1]; S.rakeOn = 0; b.autoFace = true;
    for (const c of S.cards) { c.on = false; c.g.visible = false; c.gl.visible = false; } for (const d of S.dice) { d.state = 'off'; d.m.visible = false; } for (const bl of S.balls) { bl.state = 'off'; bl.m.visible = false; }
    S.bulbCol.setHex(BULBP[n]); S.bulbs2.color.setHex(BULBP[n]).multiplyScalar(2.4); S.shed.count = [0, 48, 0][n]; S.inlayM.emissiveIntensity = n === 1 ? 0.85 : 0; S.lampL.color.setHex(LAMPP[n][0]); S.sepP.value = n === 2 ? 1 : 0;
  }

  G.bosses.push({
    id: 'wheel', name: 'LADY FORTUNA', title: 'The Gilded Wheel', hint: 'A wager', color: '#ffd24a', telegraph: 0xffc040,
    hp: 28000, radius: 3.0, aimY: 4.6, enrage: 450,
    post: { bloom: 0.5, threshold: 1.0, radius: 0.55, exposure: 1.05, vig: 1.0, sat: 1.12, contrast: 1.05, tint: [1.04, 1.0, 0.95] },
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
        const S = b.state; S.gest = 1; Sound.sfx('bell', 1, 1.2); FX.flash(MAG, 0.3, 1.5); FX.shake(0.7);
        Co.start(Post.lerpTo({ tint: [1.05, 0.97, 1.02], bloom: 0.54 }, 2.5), 'fight');
        setLvl(b, 1); turn(S); yield 2.4;
      }, *run(b) {
        const S = b.state; setLvl(b, 1);
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
        Sound.sfx('bigboom'); Sound.sfx('bell', 1, 2); FX.flash(GOLD, 0.6, 1.1); FX.shake(1.2);
        Co.start(Post.lerpTo({ tint: [1.03, 1.0, 0.99], bloom: 0.52, exposure: 1.04 }, 2), 'fight'); S.lampL.intensity = 560;
        for (let i = 0; i < 8; i++) FX.burst(rnd(-14, 14), 16, rnd(-14, 14), { n: 30, color: GOLD, speed: [1, 5], grav: 12, life: [1, 2.2], size: [0.15, 0.4] });
        setLvl(b, 2); yield 1.6;
      }, *run(b) {
        const S = b.state; setLvl(b, 2); S.lampL.intensity = 560;
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
      // carry the player (also while airborne, not while dashing), and turn the camera and facing with the ring underfoot so the floor holds still on screen
      const wHere = Math.hypot(p.pos.x, p.pos.z) < SPLIT ? S.wi : S.wo;
      if (p.alive && !p.dash && G.state === 'fight' && dt > 0) { const c = Math.cos(wHere * dt) - 1, sn = Math.sin(wHere * dt); p.push.x += (p.pos.x * c + p.pos.z * sn) / dt; p.push.z += (p.pos.z * c - p.pos.x * sn) / dt; } // exact rotation, so standing still does not creep outward
      for (let i = S.riders.length - 1; i >= 0; i--) { const q = S.riders[i], a = (q.r < SPLIT ? S.wi : S.wo) * dt, c = Math.cos(a), sn = Math.sin(a), x = q.m.position.x, z = q.m.position.z; q.m.position.x = x * c + z * sn; q.m.position.z = z * c - x * sn; if ((q.t -= dt) <= 0) S.riders.splice(i, 1); }
      if (p.alive && G.state === 'fight' && !Cam.cine) { S.camW = damp(S.camW, wHere, 9, dt); const dy = S.camW * dt; Cam.yaw = wrapPi(Cam.yaw + dy); p.facing = wrapPi(p.facing + dy); }
      else S.camW = 0;
      // balls
      for (const bl of S.balls) {
        if (bl.state === 'off') continue; bl.t += dt; if (bl.cd > 0) bl.cd -= dt;
        const rw = bl.ring === 0 ? S.wi : S.wo, rest = bl.ring === 0 ? 7.2 : 13.8;
        if (bl.state === 'roll') { bl.w -= Math.sign(bl.w) * 0.95 * dt; if (Math.abs(bl.w) < 1.5) { bl.state = 'drop'; bl.t = 0; bl.r0 = bl.r; bl.w0 = bl.w; } if (((bl.tick = (bl.tick || 0) + Math.abs(bl.w) * dt)) > 0.5) { bl.tick = 0; Sound.sfx('tick', 0.8, 1.6); } }
        else if (bl.state === 'drop') { const k = sat(bl.t / 0.9); bl.r = lerp(bl.r0, rest, smooth(k)); bl.w = lerp(bl.w0, rw, k); if (k >= 1) { bl.state = 'rest'; bl.t = 0; const ra = bl.ring === 0 ? S.ai : S.ao, la = ((bl.a - ra) % TAU + TAU) % TAU, k2 = Math.floor(la / PA); bl.la = (k2 + 0.5) * PA; Sound.sfx('hit', 1.2, 2); Sound.sfx('tick', 3, 0.6); erupt(b, k2 % 2, bl.ring, S.lvl === 2 ? 1.05 : 1.2); } }
        else if (bl.state === 'rest') { bl.a = bl.la + (bl.ring === 0 ? S.ai : S.ao); bl.w = 0; if (bl.t > (S.lvl === 2 ? 1.05 : 1.2)) { bl.state = 'off'; bl.m.visible = false; FX.burst(Math.sin(bl.a) * bl.r, 1, Math.cos(bl.a) * bl.r, { n: 30, color: 0xfff4dc, speed: [3, 10], life: [0.3, 0.8] }); } }
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
      for (const bl of S.balls) { const on = bl.state !== 'off', mv = on && bl.state !== 'rest'; bl.sh.visible = on; for (let k = 0; k < bl.tr.length; k++) bl.tr[k].visible = mv; if (!on) continue;
        const by = 1.05 + (bl.state === 'roll' ? 0.5 : bl.state === 'drop' ? 0.5 * (1 - sat(bl.t / 0.9)) + Math.abs(Math.sin(bl.t * 14)) * 0.25 * (1 - sat(bl.t / 0.9)) : 0); bl.m.position.set(bl.x, by, bl.z); bl.m.rotation.x += bl.w * dt * 3; bl.m.rotation.z += dt * 2;
        bl.sh.position.set(bl.x, 0.05, bl.z); bl.sh.scale.setScalar(1 - (by - 1.05) * 0.4);
        if (mv) for (let k = 0; k < bl.tr.length; k++) { const aa = bl.a - bl.w * (k + 1) * 0.011; bl.tr[k].position.set(Math.sin(aa) * bl.r, by, Math.cos(aa) * bl.r); } }
      for (const c of S.cards) {
        if (!c.on) continue; const w = wpos(S, c.la, c.r, _w); c.y = damp(c.y, 0.12, 15, dt); if (c.flipT > 0) c.flipT = Math.min(1, c.flipT + dt / 0.3);
        c.g.position.set(w.x, c.y + Math.sin(c.flipT * PI) * 0.6, w.z); c.g.rotation.y = w.a; c.m.rotation.z = smooth(c.flipT) * PI;
        c.gl.visible = true; c.gl.position.set(w.x, 0.06, w.z); c.gl.rotation.z = w.a; c.gl.material.opacity = sat(1.4 - c.y * 0.4) * (0.4 + 0.15 * Math.sin(t * 6));
      }
      for (const d of S.dice) {
        if (d.state === 'off') continue;
        if (d.state === 'air') { const k = d.t / 0.85; d.m.position.set(lerp(0, d.x, k), 6 * (1 - k) + Math.sin(k * PI) * 5 + 0.95, lerp(0, d.z, k)); d.m.rotation.set(d.t * 11, d.t * 7, d.t * 9); }
        else { d.m.position.set(d.x, 0.95, d.z); const rr = { 1: [0, 0], 2: [0, PI / 2], 5: [0, -PI / 2], 6: [PI, 0], 3: [-PI / 2, 0], 4: [PI / 2, 0] }[d.v]; d.m.rotation.set(rr[0], ringA(S, d.r), rr[1]); }
      }
      for (const wv of S.waves) { if (!wv.m) { wv.m = S.wavePool.pop() || null; if (!wv.m) continue; wv.m.visible = true; } wv.m.position.set(wv.d.x, 0.25, wv.d.z); wv.m.scale.set(wv.r, 0.5, wv.r); wv.m.material.uniforms.uA.value = sat((36 - wv.r) / 8); }
      // Fortuna
      const cast = b.castState ? 1 : 0, ges = Math.max(S.gest, cast * 0.6), L = S.lvl, fr = S.frenzy > 0 ? 1 : 0;
      S.rig.position.y = Math.sin(t * 1.2) * 0.08; S.head.rotation.z = Math.sin(t * 0.9) * 0.08; S.head.rotation.x = -ges * 0.15;
      S.skirt.rotation.y += dt * [0.22, 0.6, 1.3][L] * (1 + fr);
      const hs = [0.5, 1.4, 2.6][L] + cast * 1.5 + fr * 2; S.hSpin.rotation.z -= dt * hs; S.hBall.rotation.z += dt * hs * 1.7;
      for (const A of S.arms) { const k = A.up ? ges : 0.3 + S.rakeOn * 0.7; A.sh.rotation.set(-0.5 - k * (A.up ? 1.6 : 0.9) + Math.sin(t * 1.5 + A.sx + A.up) * 0.08, 0, A.sx * (0.5 + k * 0.6)); A.el.rotation.x = -0.9 + k * 0.4 + Math.sin(t * 2.1 + A.sx * 2 + A.up) * 0.1; }
      S.trim.emissiveIntensity = 0.7 + cast * 0.4 + fr * 0.5 + Math.sin(t * 3) * 0.1; S.eyeM.color.setHex(L === 1 ? MAG : GOLD).multiplyScalar(2.4 + cast * 1.2);
      for (const m of S.gownE) m.emissiveIntensity = (L === 2 ? 0.4 : 0.25) + cast * 0.15 + Math.max(0, Math.sin(t * 2.2)) * (L === 2 ? 0.25 : 0.05);
      S.rake.visible = S.rakeOn > 0;
      // phase dressing: sky, rim light, bulbs, sunburst, cracks of light, shed chips, the card vortex
      const kk = 1 - Math.exp(-dt * 1.2), U = S.sky.material.uniforms, P = SKYP[L];
      U.uTop.value.lerp(P[0], kk); U.uHor.value.lerp(P[1], kk); U.uNebA.value.lerp(P[2], kk); U.uNebB.value.lerp(P[3], kk); U.uAurCol.value.lerp(P[4], kk); U.uAurora.value = damp(U.uAurora.value, AURP[L], 1.2, dt); U.uStars.value = damp(U.uStars.value, STARP[L], 1.2, dt); U.uExp.value = damp(U.uExp.value, EXPP[L], 1.2, dt); S.rimC.lerp(RIMP[L], kk); S.rimP.copy(S.rimC).multiplyScalar(0.4);
      for (let i = 0; i < S.NB; i++) { const q = i / S.NB; const k = L === 2 ? (((i - Math.floor(t * 14)) % 8 + 8) % 8 < 3 ? 1.7 : 0.12) : L === 1 ? ((i + Math.floor(t * 3)) % 2 ? 1 : 0.3) : 0.8 + 0.2 * Math.sin(t * 2 + i * 1.7); S.bl.setColorAt(i, _c.copy(S.bulbCol).multiplyScalar(k)); }
      S.bl.instanceColor.needsUpdate = true;
      S.burstA = damp(S.burstA, L === 2 ? 0.8 + 0.15 * Math.sin(t * 2.5) + fr * 0.2 : 0, 1.5, dt); S.burst.visible = S.burstA > 0.01; S.burst.material.uniforms.uA.value = S.burstA; S.burst.material.uniforms.uT.value = t;
      S.sepM.emissiveIntensity = L === 2 ? 0.8 : L === 1 ? 0.1 : 0; S.sepT.value = t;
      if (S.shed.count) {
        for (let i = 0; i < S.shed.count; i++) { const c = S.shedP[i], ph = (t * c.sp + c.ph) % 1, sc = sat(ph * 8) * (1 - smooth(sat((ph - 0.75) * 4)));
          const ca = c.ca + Math.sin(t * 0.4 + c.ph * 9) * 0.05; _m.position.set(Math.sin(ca) * c.cr + c.dx * ph * 3, 2.5 + ph * 14, Math.cos(ca) * c.cr + c.dz * ph * 3); _m.rotation.set(c.rx + t * 0.7, 0, c.rz + t * 0.5); _m.scale.setScalar(Math.max(sc * sat((_m.position.distanceTo(camera.position) - 8) / 8), 0.001)); _m.updateMatrix(); S.shed.setMatrixAt(i, _m.matrix); }
        S.shed.instanceMatrix.needsUpdate = true; _m.rotation.set(0, 0, 0); _m.scale.setScalar(1);
      }
      if (S.coins.count) {
        for (let i = 0; i < S.coins.count; i++) { const c = S.coinP[i], y = 15 - ((t * c.sp + c.ph * 15) % 15); _m.position.set(Math.sin(c.a + t * 0.05) * c.r, y, Math.cos(c.a + t * 0.05) * c.r); _m.rotation.set(c.fx + t * c.fs, c.a, 0.6); _m.scale.setScalar(sat(y * 2) * sat((_m.position.distanceTo(camera.position) - 6) / 6)); _m.updateMatrix(); S.coins.setMatrixAt(i, _m.matrix); }
        S.coins.instanceMatrix.needsUpdate = true; _m.rotation.set(0, 0, 0); _m.scale.setScalar(1);
      }
      S.vort = damp(S.vort, L === 2 ? 1 : 0, 0.7, dt);
      for (const f of S.float) {
        f.m.rotation.y += dt * f.s * (1 + S.vort * 4); f.m.rotation.x += dt * f.s * 0.6;
        if (!f.far) { const oa = f.a0 + t * f.w, vk = smooth(S.vort); f.m.position.set(lerp(f.home.x, Math.sin(oa) * f.vr, vk), lerp(f.home.y, f.vy + Math.sin(t * 0.8 + f.a0) * 1.2, vk), lerp(f.home.z, Math.cos(oa) * f.vr, vk)); f.m.scale.setScalar(1 - vk * 0.6); }
      }
      S.lampL.intensity = LAMPP[L][1] * (0.95 + Math.sin(t * 6) * 0.03);
    },
    danger(b, x, z) { let best = Infinity; for (const bl of b.state.balls) if (bl.state === 'roll' || bl.state === 'drop') { if (Math.hypot(x - bl.x, z - bl.z) < 2.6) best = 0.2; } return best; },
    bot(b, p) {
      const S = b.state; for (const wv of S.waves) { const dd = Math.hypot(p.pos.x - wv.d.x, p.pos.z - wv.d.z), tt = (dd - wv.r) / 10.5; if (tt > 0 && tt < 0.2) p.jump(); }
      const rolling = S.balls.filter((q) => q.state === 'roll' || q.state === 'drop');
      return { avoid: (x, z) => { const d = Math.hypot(x, z); return rolling.some((q) => Math.abs(d - q.r) < 1.9) || (!p.cls.melee && d < 6); } };
    },
  });
})();
