// DOOR XX: GARYO, the Final Stroke. A mountain scroll in mist and a dragon painted without eyes. Ink is alive while it is wet; a dry brush leaves gaps.
(() => {
  const R = 21, VERM = 0xe63a1e, BINK = 0x14130f, GOLD = 0xe9c46a, EXPO = 2.0, DRY_AT = 0.45;
  const COST = { rake: 0.08, bamboo: 0.28, drops: 0.14, seal: 0.10, thunder: 0.25, branch: 0.28, enso: 0.30, carved: 0.10 };
  // Phase grades. The world is painted for a tone-mapped exposure of EXPO (see outc below), so the plan's exposures are scaled by it.
  const PG = [{ bloom: 0.18, threshold: 1.0, radius: 0.5, exposure: EXPO, vig: 0.55, sat: 0.95, contrast: 1.04, tint: [1.0, 1.0, 1.0] }];
  PG[1] = Object.assign({}, PG[0], { bloom: 0.22, exposure: EXPO * 0.88, vig: 1.1, sat: 0.78, contrast: 1.14, tint: [0.97, 0.99, 1.03] });
  PG[2] = Object.assign({}, PG[0], { bloom: 0.32, threshold: 0.92, exposure: EXPO * 1.03, vig: 0.6, sat: 1.08, contrast: 1.06, tint: [1.03, 1.0, 0.96] });
  // look per phase: storm, sun, cherry bloom, falling petals
  const LOOK = [{ storm: 0, sun: 0, bloom: 0, petal: 0 }, { storm: 1, sun: 0, bloom: 0, petal: 0 }, { storm: 0, sun: 1, bloom: 1, petal: 1 }];

  const _m = new THREE.Object3D(), _c = new THREE.Color(), _a = new V3(), _b = new V3(), _d = new V3(), _q = new THREE.Quaternion(), _Y = new V3(0, 1, 0), _Z = new V3(0, 0, 1);
  const _m4 = new THREE.Matrix4(), _m42 = new THREE.Matrix4(), _e = new THREE.Euler(), _s = new V3(), _p = new V3();

  // ---- colour: palette in display-linear, converted to the pre-tonemap HDR the scene renders in ----
  // OutputPass applies ACES at exposure EXPO. outc() inverts that (both ACES matrices and the RRT/ODT curve), so a shader can
  // say "this pixel is paper #efe7d3" and get exactly that on screen, with only the phase grade and bloom on top.
  const m3 = (a) => new THREE.Matrix3().fromArray(a);
  const MIN = m3([0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777]).invert();
  const MOUT = m3([1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602]).invert();
  const g3 = (m) => 'mat3(' + Array.from(m.elements, (v) => v.toFixed(6)).join(', ') + ')';
  const vc = (hex) => { _c.setHex(hex); return `vec3(${_c.r.toFixed(4)}, ${_c.g.toFixed(4)}, ${_c.b.toFixed(4)})`; };
  function hdr(hex, out) { // JS twin of outc(), for fog colour
    _c.setHex(hex); const y = new V3(_c.r, _c.g, _c.b).applyMatrix3(MOUT); const f = (v) => { v = clamp(v, 0, 0.985); const A = 0.983729 * v - 1, B = 0.432951 * v - 0.0245786, C = 0.238081 * v + 0.000090537; return (-B - Math.sqrt(Math.max(B * B - 4 * A * C, 0))) / (2 * A); };
    y.set(f(y.x), f(y.y), f(y.z)).applyMatrix3(MIN).multiplyScalar(0.6 / EXPO); return out.setRGB(Math.max(0, y.x), Math.max(0, y.y), Math.max(0, y.z));
  }
  const INK = `uniform float uTime, uReveal, uStorm, uSun, uBloom, uPetal, uGale, uCut; uniform vec2 uWind;
const vec3 PAPER = ${vc(0xefe7d3)}, PSH = ${vc(0xd8cdb4)}, I0 = ${vc(0x14130f)}, I1 = ${vc(0x34322c)}, I2 = ${vc(0x6b675d)}, I3 = ${vc(0xa39e90)}, I4 = ${vc(0xcfc8b6)};
const vec3 VER = ${vc(VERM)}, PK = ${vc(0xf2a6b8)}, PK2 = ${vc(0xd9728c)}, GLD = ${vc(0xf3dca0)}, SILK = ${vc(0x2e3a34)}, SILK2 = ${vc(0x48574c)}, OCH = ${vc(0xb8955a)}, CRM = ${vc(0xb0203a)};
const mat3 MINI = ${g3(MIN)}, MOUTI = ${g3(MOUT)};
float hh(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return s * 1.0667; }
vec3 tone(float s, float n){ s = clamp(s + (n - 0.5) * 0.08, 0.0, 1.0); vec3 c = mix(I0, I1, smoothstep(0.13, 0.18, s)); c = mix(c, I2, smoothstep(0.33, 0.38, s)); c = mix(c, I3, smoothstep(0.53, 0.58, s)); c = mix(c, I4, smoothstep(0.72, 0.77, s)); return mix(c, PAPER, smoothstep(0.89, 0.94, s)); }
float kas(vec2 uv, float amt){ float n = vn(vec2(uv.x * 2.0, uv.y * 40.0)) * 0.6 + vn(vec2(uv.x * 5.0, uv.y * 110.0)) * 0.4; return smoothstep(amt - 0.1, amt + 0.1, n); }
// dry-brush streaks that never get thinner than about two pixels: an octave fades to its mean (and the edge widens) before it can alias
float kasA(vec2 uv, float amt){ float px = max(fwidth(uv.y), 1e-5), o1 = 1.0 - smoothstep(0.1, 0.25, px * 40.0), o2 = 1.0 - smoothstep(0.1, 0.25, px * 110.0);
  float n = mix(0.5, vn(vec2(uv.x * 2.0, uv.y * 40.0)), o1) * 0.6 + mix(0.5, vn(vec2(uv.x * 5.0, uv.y * 110.0)), o2) * 0.4, wd = 0.1 + 0.3 * (1.0 - o1);
  return smoothstep(amt - wd, amt + wd, n); }
// dragon body hair noise in body space (x along, y around): long thin streaks, fine octave faded before it aliases
float hairN(vec2 q){ float px = max(fwidth(q.y), 1e-5), o1 = 1.0 - smoothstep(0.15, 0.4, px * 12.0), o2 = 1.0 - smoothstep(0.1, 0.3, px * 28.0);
  return mix(0.5, vn(vec2(q.x * 0.25, q.y * 12.0)), o1) * 0.65 + mix(0.5, vn(vec2(q.x * 0.6, q.y * 28.0 + 7.0)), o2) * 0.35; }
float sq1(float x){ return exp(-x * x); } // a gaussian bump (no pow of a negative base)
float tailEr(vec2 q){ return vn(vec2(q.x * 0.9, q.y * 2.2)) * 0.55 + vn(vec2(q.x * 2.4, q.y * 6.0 + 3.0)) * 0.45; }
vec3 outc(vec3 y){ y = clamp(MOUTI * clamp(y, 0.0, 1.0), 0.0, 0.985); vec3 A = 0.983729 * y - 1.0, B = 0.432951 * y - 0.0245786, C = 0.238081 * y + 0.000090537;
  vec3 x = (-B - sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A); return max(MINI * x, 0.0) * ${(0.6 / EXPO).toFixed(5)}; }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float bayer(vec2 p){ vec2 q = mod(floor(p), 4.0); const float BM[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0); return (BM[int(q.y) * 4 + int(q.x)] + 0.5) / 16.0; }
`;
  const VH = 'uniform float uTime, uReveal, uStorm, uSun, uBloom, uPetal, uGale, uCut; uniform vec2 uWind;\n';
  const VW = 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
  // bamboo: world position at height h along a leaning, swaying stalk (shared by culms and leaves)
  const STALK = `vec3 stalkAt(float h, float H, vec2 lean, float ph, vec2 base){
    float k = clamp(h / max(H, 0.1), 0.0, 1.0);
    float gust = 1.0 + uStorm * (1.1 + 0.7 * sin(uTime * 1.9 + ph * 5.0) + 0.3 * sin(uTime * 4.3 + ph * 11.0));
    vec2 sway = uWind * (0.75 + 0.25 * sin(uTime * 1.3 + ph * 6.283)) * gust + vec2(sin(uTime * 0.7 + ph * 9.0), cos(uTime * 0.6 + ph * 7.0)) * 0.06;
    sway *= min(1.0, 1.9 / max(length(sway), 1e-3));
    vec2 off = (lean + sway * H * 0.2) * k * k; return vec3(base.x + off.x, h - dot(off, off) / max(H, 1.0) * 0.5, base.y + off.y); }`;

  // ---- geometry helpers ----
  function T(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { geo.applyMatrix4(_m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); return geo; }
  // scale, turn +Y toward (dx,dy,dz), then move to (x,y,z)
  function orient(geo, x, y, z, dx, dy, dz, sx = 1, sy = sx, sz = sx) { _d.set(dx, dy, dz).normalize(); geo.applyMatrix4(_m4.compose(_p.set(x, y, z), _q.setFromUnitVectors(_Y, _d), _s.set(sx, sy, sz))); return geo; }
  // A tube along a polyline with parallel-transport frames. Reused every frame for the dragon's body and whiskers.
  class TubeBuf {
    constructor(n, sides) {
      this.n = n; this.sides = sides; const vc2 = n * (sides + 1); this.T = []; this.N = []; this.B = [];
      for (let i = 0; i < n; i++) { this.T.push(new V3()); this.N.push(new V3()); this.B.push(new V3()); }
      this.geo = new THREE.BufferGeometry();
      this.pos = new THREE.BufferAttribute(new Float32Array(vc2 * 3), 3).setUsage(THREE.DynamicDrawUsage); this.nor = new THREE.BufferAttribute(new Float32Array(vc2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute('position', this.pos); this.geo.setAttribute('normal', this.nor);
      const idx = []; for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) { const a = i * (sides + 1) + j, b2 = a + 1, c = a + sides + 1, d = c + 1; idx.push(a, b2, c, b2, d, c); }
      this.geo.setIndex(idx); this.geo.boundingSphere = new THREE.Sphere(new V3(), 1e4);
    }
    build(P, rad) {
      const n = this.n, T2 = this.T, N = this.N, B = this.B;
      for (let i = 0; i < n; i++) { T2[i].subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]); const l = T2[i].length(); if (l > 1e-6) T2[i].multiplyScalar(1 / l); else if (i) T2[i].copy(T2[i - 1]); else T2[i].set(0, 0, 1); }
      N[0].set(0, 1, 0).addScaledVector(T2[0], -T2[0].y); if (N[0].lengthSq() < 1e-6) N[0].set(1, 0, 0).addScaledVector(T2[0], -T2[0].x); N[0].normalize();
      for (let i = 1; i < n; i++) { N[i].copy(N[i - 1]).addScaledVector(T2[i], -N[i - 1].dot(T2[i])); const l = N[i].length(); if (l > 1e-6) N[i].multiplyScalar(1 / l); else N[i].copy(N[i - 1]); }
      for (let i = 0; i < n; i++) B[i].crossVectors(T2[i], N[i]);
      const p = this.pos.array, q = this.nor.array, S = this.sides; let o = 0;
      for (let i = 0; i < n; i++) {
        const r = rad(i), Ni = N[i], Bi = B[i], Pi = P[i];
        for (let j = 0; j <= S; j++) { const f = j / S * TAU, cs = Math.cos(f), sn = Math.sin(f), nx = Ni.x * cs + Bi.x * sn, ny = Ni.y * cs + Bi.y * sn, nz = Ni.z * cs + Bi.z * sn; p[o] = Pi.x + nx * r; p[o + 1] = Pi.y + ny * r; p[o + 2] = Pi.z + nz * r; q[o] = nx; q[o + 1] = ny; q[o + 2] = nz; o += 3; }
      }
      this.pos.needsUpdate = this.nor.needsUpdate = true;
    }
  }
  function taper(pts, r0, r1, sides = 7, n = 10) { const P = new THREE.CatmullRomCurve3(pts.map((a) => new V3(...a))).getPoints(n - 1), tb = new TubeBuf(n, sides); tb.build(P, (i) => lerp(r0, r1, i / (n - 1))); return tb.geo; }
  // merge parts into one skin geometry: aS (body position, -0.05 = head), aK (0 skin, 1 horn/claw, 2 paper white, 3 deep ink), aSc (scale-pattern space), aBelly
  function mergeParts(list, sVal = -0.05) {
    let n = 0; const gs = list.map(([g, k]) => { const q = g.index ? g.toNonIndexed() : g; if (q !== g) g.dispose(); if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return [q, k]; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), S = new Float32Array(n), K = new Float32Array(n), SC = new Float32Array(n * 2), BE = new Float32Array(n); let o = 0;
    for (const [q, k] of gs) {
      const c = q.attributes.position.count, pa = q.attributes.position.array, na = q.attributes.normal.array; P.set(pa, o * 3); N.set(na, o * 3);
      for (let i = 0; i < c; i++) { const j = o + i; S[j] = sVal; K[j] = k; SC[j * 2] = pa[i * 3 + 2] * 3.4; SC[j * 2 + 1] = (pa[i * 3] + pa[i * 3 + 1]) * 3.4; BE[j] = k === 0 ? sat(-na[i * 3 + 1] * 1.4 - 0.25) : 0; }
      o += c; q.dispose();
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('aS', new THREE.BufferAttribute(S, 1)); g.setAttribute('aK', new THREE.BufferAttribute(K, 1)); g.setAttribute('aSc', new THREE.BufferAttribute(SC, 2)); g.setAttribute('aBelly', new THREE.BufferAttribute(BE, 1)); g.setAttribute('aFd', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.computeBoundingSphere(); return g;
  }
  const iattr = (n, k) => new THREE.InstancedBufferAttribute(new Float32Array(n * k), k);

  // ---- materials ----
  function smat(U, vs, fs, extra = {}, o = {}) {
    return new THREE.ShaderMaterial(Object.assign({ uniforms: Object.assign({}, U, extra), vertexShader: VH + vs, fragmentShader: INK + fs, fog: false }, o));
  }
  const A2C = () => G.q.msaa > 0;

  // ---------------------------------------------------------------------------------------------------------------------
  // the painted world
  // (r3) the sky inscription, drawn once into a canvas: R = ink of a vertical column (画竜点睛, "paint the dragon, dot the eyes"),
  // G = a small vermilion seal under it with one carved character. Without a CJK font the column falls back to abstract brush glyphs.
  function makeCal() {
    const W2 = 128, H2 = 512, cv = document.createElement('canvas'); cv.width = W2; cv.height = H2; const x = cv.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, W2, H2);
    const FONT = '"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "MS Mincho", "Noto Serif CJK JP", "Noto Serif JP", "Source Han Serif", serif';
    // tofu test: two different characters that render identically mean there is no font for them
    const probe = (ch) => { const c2 = document.createElement('canvas'); c2.width = c2.height = 40; const q = c2.getContext('2d'); q.fillStyle = '#fff'; q.font = '32px ' + FONT; q.textBaseline = 'top'; q.fillText(ch, 4, 4); return q.getImageData(0, 0, 40, 40).data; };
    let hasCJK = false; try { const a = probe('画'), b2 = probe('竜'); let diff = 0, ink = 0; for (let i = 0; i < a.length; i += 4) { diff += Math.abs(a[i] - b2[i]); ink += a[i]; } hasCJK = diff > 2000 && ink > 2000; } catch (e) { hasCJK = false; }
    const rng = mulberry(77); x.fillStyle = 'rgb(255,0,0)'; x.strokeStyle = 'rgb(255,0,0)'; x.lineCap = 'round';
    const chars = ['画', '竜', '点', '睛'];
    for (let i = 0; i < 4; i++) { const cy = 22 + i * 98, cx = W2 / 2;
      if (hasCJK) { x.font = '700 92px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'top'; x.lineWidth = 7; x.lineJoin = 'round'; const ox = cx + (rng() - 0.5) * 6; x.fillText(chars[i], ox, cy); x.strokeText(chars[i], ox, cy); }
      else for (let k = 0; k < 4 + Math.floor(rng() * 3); k++) { x.lineWidth = 6 + rng() * 10; x.beginPath(); const x0 = cx + (rng() - 0.5) * 70, y0 = cy + 8 + rng() * 70; x.moveTo(x0, y0);
        x.quadraticCurveTo(x0 + (rng() - 0.5) * 50, y0 + (rng() - 0.5) * 50, x0 + (rng() - 0.5) * 80, y0 + (rng() - 0.3) * 40); x.stroke(); } }
    // the seal: a slightly rough square, one character carved out of it
    x.fillStyle = 'rgb(0,255,0)'; x.beginPath(); x.moveTo(40, 432); x.lineTo(90, 430); x.lineTo(91, 482); x.lineTo(39, 481); x.closePath(); x.fill();
    x.fillStyle = 'rgb(0,0,0)';
    if (hasCJK) { x.font = '700 40px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('竜', 65, 457); }
    else { x.fillRect(50, 442, 30, 5); x.fillRect(50, 455, 30, 5); x.fillRect(62, 442, 6, 30); x.fillRect(50, 468, 30, 5); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return t;
  }
  function buildSky(S, g) {
    S.skyU = { uSunD: { value: new V3(0, -0.12, -1).normalize() }, uBolt: { value: 0 }, uBoltA: { value: 0.5 }, uCal: { value: makeCal() } };
    const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), smat(S.U, 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }', `
      varying vec3 vD; uniform vec3 uSunD; uniform float uBolt, uBoltA; uniform sampler2D uCal;
      void main(){
        vec3 d = vD / max(length(vD), 1e-4); float h = d.y; float hz = length(d.xz); vec2 cs = d.xz / max(hz, 1e-4); float az = atan(d.x, -d.z);
        float n = vn(cs * 3.0 + vec2(h * 4.0, 0.0)), n2 = vn(cs * 9.0 + vec2(0.0, h * 9.0));
        // (r3) bokashi: one tone darker at the top of the sky, palest at the horizon
        vec3 col = mix(PAPER, mix(PSH, I4, 0.25), clamp(smoothstep(-0.02, 0.3, h) * 0.85 + (n - 0.5) * 0.14 + (n2 - 0.5) * 0.04, 0.0, 1.0));
        // three very pale horizontal haze washes, each with a slightly darker wet lower edge, broken along their length
        for (int i = 0; i < 3; i++) { float fi = float(i), y0 = 0.032 + fi * 0.05 + fi * fi * 0.012 + (vn(vec2(az * 3.0 + fi * 3.1, fi)) - 0.5) * 0.018, w = 0.011 + fi * 0.006;
          float on = smoothstep(0.3, 0.55, vn(vec2(az * 2.2 + fi * 5.0, fi * 2.0 + 1.0))) * (0.7 + 0.3 * vn(vec2(az * 9.0, h * 40.0 + fi)));
          float ws = smoothstep(y0 - w, y0 - w * 0.4, h) * (1.0 - smoothstep(y0 + w * 0.2, y0 + w * 1.2, h)) * on;
          float we = (1.0 - smoothstep(0.0, w * 0.35, abs(h - y0 + w * 0.75))) * on;
          col = mix(col, mix(PSH, I4, 0.4), ws * 0.32 + we * 0.18); }
        if (uStorm > 0.002) {
          // the whole sky drops to a grey wash, then haboku clouds (broken, wet-in-wet ink) own the upper sky
          col = mix(col, mix(I4, I3, 0.55 + (n - 0.5) * 0.4), uStorm * 0.8);
          vec2 q = cs * 1.3 + vec2(h * 1.8, -h) + vec2(uTime * 0.011, uTime * 0.004);
          vec2 qw = q + vec2(fbm(q * 1.7 + 2.0), fbm(q * 1.7 + 6.0)) * 0.9;
          float c = fbm(qw * 1.7 + 4.0) + smoothstep(0.02, 0.26, h) * 0.3 - 0.08 + (vn(cs * 34.0 + h * 20.0) - 0.5) * 0.06;
          float low = smoothstep(-0.03, 0.08, h), desc = smoothstep(0.0, 0.6, uStorm);
          float cov = smoothstep(0.38, 0.56, c) * low * desc;
          float wet = (smoothstep(0.38, 0.41, c) - smoothstep(0.41, 0.49, c)) * low * desc;
          float core = smoothstep(0.48, 0.68, c);
          col = mix(col, mix(mix(I2, I1, core), I0, smoothstep(0.7, 0.86, c) * (0.5 + 0.5 * n2)), cov * 0.97);
          col = mix(col, I1, wet * 0.7);
          float X = az * 160.0 + h * 60.0 * (0.4 + uGale), hc = hh(vec2(floor(X), 7.0));
          float seg = fract(h * (3.0 + hc * 3.0) + uTime * (1.5 + hc));
          float rain = step(0.82, hc) * smoothstep(0.0, 0.1, seg) * (1.0 - smoothstep(0.3, 0.5, seg)) * (1.0 - smoothstep(0.1, 0.45, abs(fract(X) - 0.5))) * smoothstep(-0.1, 0.25, h);
          col = mix(col, I2, rain * 0.55 * uStorm);
          if (uBolt > 0.002) { float bx = uBoltA + (vn(vec2(h * 14.0, 3.0)) - 0.5) * 0.08 + (vn(vec2(h * 45.0, 9.0)) - 0.5) * 0.025; float bw = 0.004 + 0.004 * (1.0 - h);
            float bolt = (1.0 - smoothstep(bw * 0.5, bw, abs(az - bx))) * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.75, 0.95, h)); col = mix(col, PAPER, uBolt * 0.6 * (1.0 - bolt)); col = mix(col, I0, bolt * uBolt); }
        }
        // (r3) the inscription: a vertical column of brush calligraphy and a small vermilion seal, fixed on the sky right of the valley
        { float e = asin(clamp(h, -1.0, 1.0)); vec2 cu = vec2((az - 0.6) / 0.035 + 0.5, (e - 0.046) / 0.13);
          if (cu.x > 0.0 && cu.x < 1.0 && cu.y > 0.0 && cu.y < 1.0) { vec4 tx = texture2D(uCal, cu); float vis = 1.0 - uStorm;
            float ik = tx.r * (0.55 + 0.45 * kas(vec2(cu.y * 3.0, cu.x * 0.6), 0.18));
            col = mix(col, mix(I1, I0, 0.5), ik * 0.95 * vis); col = mix(col, mix(VER, I1, 0.08), tx.g * 0.9 * (0.88 + 0.12 * vn(cu * 90.0)) * vis); } }
        float disc = 0.0;
        if (uSun > 0.002) {
          float cd = clamp(dot(d, uSunD), -1.0, 1.0), ang = acos(cd);
          // dawn grade: warm gold at the horizon to a pale rose above, a pale halo wash round the sun
          col = mix(col, mix(mix(GLD, PAPER, 0.15), mix(PAPER, PK, 0.3), smoothstep(0.02, 0.26, h)), uSun * 0.6);
          col = mix(col, mix(GLD, PAPER, 0.3), uSun * (1.0 - smoothstep(0.07, 0.34, ang)) * 0.6);
          col = mix(col, GLD, uSun * exp(-ang * 3.0) * 0.35);
          // a flat vermilion disc ~8.6 deg wide with a soft wet edge (pigment pooled at the rim), no bands
          vec3 sr = normalize(cross(uSunD, vec3(0.0, 1.0, 0.0)) + vec3(1e-5)), su = cross(sr, uSunD); float sa = atan(dot(d, su), dot(d, sr));
          float edge = 0.075 * (1.0 + (vn(vec2(sa * 2.2, 3.0)) - 0.5) * 0.05 + (vn(vec2(sa * 8.0, 7.0)) - 0.5) * 0.018);
          disc = (1.0 - smoothstep(edge - 0.0025, edge + 0.0015, ang)) * uSun;
          float rim = smoothstep(edge - 0.012, edge - 0.002, ang);
          vec3 sc = mix(mix(VER, GLD, 0.06 + 0.06 * fbm(vec2(sa * 1.5, ang * 30.0))), mix(VER, I1, 0.16), rim * 0.65);
          col = mix(col, sc, disc);
        }
        gl_FragColor = vec4(outc(col) + vec3(0.55, 0.03, 0.0) * disc, 1.0);
      }`, S.skyU, { side: THREE.BackSide, depthWrite: false }));
    m.renderOrder = -100; m.frustumCulled = false; m.onBeforeRender = () => { m.position.copy(camera.position); }; g.add(m); S.sky = m;
  }

  function buildGround(S, g) {
    S.gU = { uPP: { value: new V3() }, uBP: { value: new V3() }, uRip: { value: new THREE.Vector4(0, 0, -100, 0) }, uRf: { value: [new THREE.Vector4(0, 0, 0, 1), new THREE.Vector4(0, 0, 0, 1), new THREE.Vector4(0, 0, 0, 1)] } };
    const m = new THREE.Mesh(new THREE.CircleGeometry(27, 128), smat(S.U, VW, `
      varying vec3 vW; uniform vec3 uPP, uBP; uniform vec4 uRip; uniform vec4 uRf[3];
      void main(){
        vec2 p = vW.xz; float r = length(p); vec2 cs = p / max(r, 1e-3); float az = atan(p.x, -p.y);
        float n1 = fbm(p * 0.07 + 3.0), n2 = vn(p * 0.45), n3 = vn(p * 1.9 + 7.0);
        float rvW = clamp((uReveal - 0.3) / 0.35, 0.0, 1.0), rvR = clamp((uReveal - 0.38) / 0.22, 0.0, 1.0);
        vec3 base = mix(mix(PAPER, PSH, smoothstep(0.45, 0.9, n1) * 0.5), mix(I4, I3, 0.45 + (n1 - 0.5) * 0.5), uStorm * 0.8);
        float ink = 0.0;
        float inner = 1.0 - smoothstep(${(R - 1).toFixed(1)}, ${(R + 0.5).toFixed(1)}, r);
        // pale washes: a few large domain-warped pools, a hard darker wet edge where the pigment dried, granulation inside
        vec2 wq = p * 0.045 + 11.0; wq += vec2(fbm(wq * 1.3 + 3.1), fbm(wq * 1.3 + 7.7)) * 1.5;
        float w = fbm(wq) + (n3 - 0.5) * 0.025;
        float gran = vn(p * 0.55 + 2.0) * 0.6 + vn(p * 1.3 + 5.0) * 0.4;
        float wash = smoothstep(0.7, 0.705, w), wedge = wash * (1.0 - smoothstep(0.705, 0.735, w));
        ink = max(ink, (wash * 0.075 * (0.92 + 0.15 * (gran - 0.5)) + wedge * 0.15) * inner * rvW);
        // concentric dry-brush arcs: the terrace swept with a dry brush
        float st = vn(vec2(r * 3.2, az * r * 0.06 + 40.0)) * 0.7 + vn(vec2(r * 9.0, az * r * 0.2)) * 0.3;
        float arcs = smoothstep(0.66, 0.74, st) * smoothstep(0.42, 0.62, n1) * smoothstep(2.5, 5.0, r);
        ink = max(ink, arcs * 0.13 * inner * rvW);
        // moss dots crowding the rim, in irregular clusters of three to seven of different sizes
        vec2 cg = p / 2.3, ci = floor(cg), cf = fract(cg);
        float dens = smoothstep(${(R - 5).toFixed(1)}, ${(R - 0.8).toFixed(1)}, r) * (1.0 - smoothstep(${(R + 1.5).toFixed(1)}, ${(R + 4).toFixed(1)}, r)) * smoothstep(0.3, 0.6, n2);
        float dt = 0.0;
        if (hh(ci + 5.3) < dens * 0.85) { vec2 c0 = vec2(hh(ci + 1.7), hh(ci + 9.1)) * 0.3 + 0.35; float nd = 3.0 + floor(hh(ci + 4.2) * 5.0);
          for (int k = 0; k < 7; k++) { float fk = float(k); if (fk >= nd) break;
            vec2 o = c0 + (vec2(hh(ci + fk * 3.1 + 0.4), hh(ci + fk * 5.7 + 2.9)) - 0.5) * vec2(0.42, 0.3); float hs = hh(ci + fk * 7.3 + 0.8), sz = 0.018 + 0.07 * hs * hs;
            dt = max(dt, 1.0 - smoothstep(sz * 0.55, sz, length((cf - o) * vec2(1.0, 1.5)) + (vn(cf * 60.0 + fk) - 0.5) * sz * 0.3)); } }
        ink = max(ink, dt * 0.9 * rvR);
        // the terrace rim: one brush circle whose width swells and thins (0.2x to 2x) and lifts off the paper in places
        float rimR = ${R.toFixed(1)} + (vn(cs * 3.0) - 0.5) * 0.8 + (vn(cs * 26.0) - 0.5) * 0.12;
        float wm = mix(0.2, 2.0, smoothstep(0.25, 0.75, vn(cs * 4.2 + 2.0) * 0.75 + vn(cs * 11.0 + 5.0) * 0.25));
        float wid = 0.22 * wm + 0.03, dr = r - rimR, brk = smoothstep(0.2, 0.27, vn(cs * 7.0 + 9.0));
        float raa = max(fwidth(dr), 1e-4); // (r3) antialiased: never thinner than a pixel, streaks fade before they alias
        float rimL = (1.0 - smoothstep(wid * 0.55 - raa * 0.5, wid + raa, abs(dr))) * mix(1.0, kasA(vec2(az * r * 0.05, dr / max(wid, 0.05) * 0.3), 0.2 + 0.4 * (1.0 - smoothstep(0.3, 1.2, wm))), 0.85) * brk;
        float af = abs(az) / 3.14159;
        rimL *= step(af, rvR * 1.03);
        ink = max(ink, rimL * 0.96);
        // rocks just outside: contour strokes, dark faces, axe-cut texture strokes, all dissolving into mist
        float outer = smoothstep(${(R - 0.3).toFixed(1)}, ${(R + 0.5).toFixed(1)}, r) * (1.0 - smoothstep(${(R + 1.5).toFixed(1)}, ${(R + 5).toFixed(1)}, r + (n2 - 0.5) * 3.0));
        float rock = fbm(p * 0.32 + 21.0);
        float iso = 1.0 - smoothstep(0.0, 0.03, abs(rock - 0.58));
        float face = smoothstep(0.6, 0.78, rock) * kas(vec2(r * 0.4, az * r * 0.04), 0.4);
        ink = max(ink, max(iso * 0.85, face * 0.55) * outer * rvR);
        // ink blob shadows under the player and the dragon
        ink = max(ink, (1.0 - smoothstep(0.25, 0.9, length(p - uPP.xz))) * 0.3 * (1.0 - smoothstep(0.5, 4.0, uPP.y)));
        ink = max(ink, (1.0 - smoothstep(0.8, 3.4, length(p - uBP.xz) + (n3 - 0.5) * 0.8)) * 0.32 * uBP.y);
        // storm: wet streaks and rain rings
        if (uStorm > 0.002) {
          vec2 pr = mat2(0.8, -0.6, 0.6, 0.8) * p, rg = pr / 1.6, ri = floor(rg), rf = fract(rg) - 0.5; float ph = fract(uTime * 1.1 + hh(ri) * 7.0);
          float rl = abs(length(rf - (vec2(hh(ri + 2.0), hh(ri + 4.0)) - 0.5) * 0.4) - ph * 0.42), near = 1.0 - smoothstep(7.0, 11.0, length(p - cameraPosition.xz));
          ink = max(ink, (1.0 - smoothstep(0.0, 0.03, rl)) * (1.0 - ph) * 0.5 * uStorm * step(hh(ri + 6.0), 0.3) * near);
          // the wet floor mirrors the dragon: dark smears running from him toward the eye, broken by ripples
          for (int i = 0; i < 3; i++) { vec4 q = uRf[i]; vec2 dv = cameraPosition.xz - q.xy; float dl = max(length(dv), 1e-3); vec2 dn = dv / dl;
            float al = dot(p - q.xy, dn), sd = abs(dot(p - q.xy, vec2(-dn.y, dn.x))), L = q.z * dl / max(cameraPosition.y + q.z, 1.0);
            float sm = smoothstep(-0.8, 0.8, al) * (1.0 - smoothstep(L * 0.3, L * 1.1, al)) * (1.0 - smoothstep(q.w * 0.2, q.w * 0.8, sd + (fbm(vec2(al * 0.35, q.x) + uTime * 0.05) - 0.5) * q.w * 0.6));
            float rp = 0.55 + 0.45 * fbm(vec2(sd * 0.9 + q.x, al * 0.22 - uTime * 0.12));
            ink = max(ink, sm * rp * 0.35 * uStorm * inner); }
          // bamboo reflected at the foot of the groves
          float gb = smoothstep(0.25, 0.4, abs(sin(atan(p.x, p.y)))) * smoothstep(${(R - 4).toFixed(1)}, ${(R - 0.5).toFixed(1)}, r);
          ink = max(ink, gb * smoothstep(0.82, 0.92, vn(vec2(atan(p.x, p.y) * 70.0, 1.0))) * smoothstep(0.3, 0.6, vn(vec2(az * 30.0, r * 3.0 - uTime))) * 0.45 * uStorm * inner);
        }
        // gale: pale streaks racing downwind
        if (uGale > 0.002) { vec2 wd = uWind / max(length(uWind), 1e-3); float a1 = dot(p, wd), a2 = dot(p, vec2(-wd.y, wd.x));
          ink = max(ink, smoothstep(0.78, 0.9, vn(vec2(a2 * 4.0, a1 * 0.08 - uTime * 2.2))) * 0.2 * uGale * inner); }
        // the dragon diving into the paper: rings spreading from where he went in
        if (uRip.w > 0.002) { float d = length(p - uRip.xy), ph = d - (uTime - uRip.z) * 6.0;
          ink = max(ink, smoothstep(0.86, 0.98, cos(ph * 2.0)) * step(ph, 0.0) * exp(ph * 0.12) * uRip.w * (1.0 - smoothstep(12.0, 24.0, d)) * 0.7); }
        vec3 cw = mix(base, mix(mix(I3, I2, 0.35), mix(OCH, I2, 0.4), uSun * 0.7), clamp(ink * 2.4, 0.0, 1.0)); // (r3) warm washes under the dawn
        vec3 c = min(mix(cw, tone(1.0 - ink, n3), smoothstep(0.3, 0.42, ink)), base);
        // fallen petals
        if (uPetal > 0.002) { vec2 pg = p / 0.8, pi = floor(pg), pf = fract(pg) - 0.5 - (vec2(hh(pi + 1.1), hh(pi + 2.2)) - 0.5) * 0.5;
          float pet = (1.0 - smoothstep(0.06, 0.1, length(pf * vec2(1.0, 1.7)))) * step(hh(pi + 8.8), uPetal * 0.28); c = mix(c, mix(PK, PK2, hh(pi + 4.4) * 0.6), pet * 0.9); }
        c = mix(c, PAPER, smoothstep(${(R + 3.5).toFixed(1)}, ${(R + 6).toFixed(1)}, r));
        gl_FragColor = vec4(outc(c), 1.0);
      }`, S.gU));
    m.rotation.x = -PI / 2; g.add(m); S.ground = m;
  }

  function buildMountains(S, g) {
    // radius, peak height, ink strength, seed, base fade
    const L = [[58, 44, 1.3, 3.1], [84, 33, 0.92, 11.7], [112, 19, 0.62, 23.3], [150, 16, 0.5, 37.9], [210, 16, 0.38, 51.1]];
    // crest elevation range (deg) per layer, seen from the fight eye (about 7 m up, 12 m behind the terrace centre)
    // (r3) [low, crest cap in the centre of the default view (the sun's valley, under the HP bar), crest cap on the flanks, near?] in degrees.
    // From the fight eye the horizon sits at y~176 (720p); +5 deg is y~110 and +10 deg is y~40. The far layers rise highest so three
    // ridgelines stack behind one another; the near layers sink into a valley at the centre.
    const EL = [[-5.5, -2.2, 4.2, 1], [-3.6, -1.2, 6.6, 1], [-2.4, -0.4, 8.6, 1], [-1.6, 0.1, 9.8, 0], [-1.1, -0.2, 7.6, 0]];
    const mat0 = smat(S.U, VW, `
      varying vec3 vW; uniform vec4 uL, uL2; uniform vec2 uRW; uniform float uFall;
      // two octaves of sharp ridged noise: pointed crests, concave flanks
      float ridge(vec2 cs){ float n1 = 1.0 - abs(vn(cs * 2.6 + uL.w) * 2.0 - 1.0), n2 = 1.0 - abs(vn(cs * 6.1 + uL.w + 7.3) * 2.0 - 1.0);
        return clamp(pow(max(n1, 0.0), 2.2) * 0.72 + n2 * n2 * 0.28, 0.0, 1.0); }
      void main(){
        float r = length(vW.xz); vec2 cs = vW.xz / max(r, 1e-3); float az = atan(vW.x, -vW.z), aaz = abs(az);
        float rg = ridge(cs), mass = 0.5 + 0.5 * vn(cs * 1.2 + uL.w + 50.0);
        float cap = mix(uL2.y, uL2.z, smoothstep(0.34, 0.68, aaz));
        cap = mix(cap, min(cap, 2.2), sq1((az - 0.6) / 0.12)); // room under the sky inscription
        float e = mix(uL2.x, cap, clamp(rg * mass * 1.25, 0.0, 1.0));
        // the near ridges dip to a valley at the centre; every layer leaves a notch for the sun
        float hill = uL2.x - 0.5 + rg * mass * 1.7; // the valley still rolls (no flat strip)
        e = mix(hill, e, mix(1.0, smoothstep(0.06, 0.36, aaz), uL2.w));
        e = mix(e, min(e, uL2.x + 0.3 + rg * 1.4), sq1(az / 0.12));
        float H = 7.0 + tan(e * 0.017453) * (r + 12.0), yb = 7.0 + tan((uL2.x - 1.5) * 0.017453) * (r + 12.0);
        float y = vW.y, dy = H - y, aa = max(fwidth(y), 1e-3) * 1.2;
        float sil = smoothstep(-aa, aa, dy);
        if (sil < 0.004) discard;
        float lw = (0.35 + r * 0.006) * (1.0 + uStorm * 1.4);
        float line = 1.0 - smoothstep(lw * 0.4, lw * 1.5, dy + (vn(cs * 70.0 + y * 0.3) - 0.5) * lw * 1.2);
        // darkest at the crest, dissolving to paper by ~40% of the height of the peak
        float hgt = max(H - yb, 2.0), fade = 1.0 - smoothstep(0.0, hgt * 0.4, max(dy, 0.0) + (fbm(cs * 9.0 + vec2(y * 0.05, uL.w)) - 0.5) * hgt * 0.18);
        float cun = kas(vec2(y * 0.05, az * r * 0.035 + uL.w), 0.5);
        float dark = max(line * 0.95, fade * (0.5 + 0.4 * cun) * (0.6 + 0.4 * vn(cs * 18.0 + y * 0.06)));
        dark *= uL.z * (1.0 - uStorm * 0.3);
        if (uFall > 0.5) { float fa = abs(az - 0.42) + (vn(vec2(y * 0.15, 1.0)) - 0.5) * 0.004;
          float band = 1.0 - smoothstep(0.011, 0.018, fa); dark *= 1.0 - band;
          float ln = band * step(0.82, hh(vec2(floor((az - 0.42) * 1500.0), 3.0))) * step(0.45, fract(y * 0.08 + uTime * (0.5 + uStorm) + hh(vec2(floor((az - 0.42) * 1500.0), 5.0))));
          dark = max(dark, ln * 0.35); }
        float rv = clamp((uReveal - uRW.x) / max(uRW.y - uRW.x, 1e-3), 0.0, 1.0), afr = abs(az) / 3.14159;
        float shown = 1.0 - smoothstep(rv * 1.08 - 0.04, rv * 1.08, afr);
        float front = (1.0 - smoothstep(0.0, 0.05, abs(afr - rv * 1.08 + 0.025))) * step(0.001, rv) * step(rv, 0.999);
        dark = max(dark, front * sil * 0.6 * uL.z);
        vec3 c = tone(1.0 - clamp(dark, 0.0, 1.0), vn(cs * 40.0));
        c = mix(c, GLD, uSun * 0.3 * (1.0 - dark) * (1.0 - uL.z * 0.6));
        gl_FragColor = vec4(outc(c), sil * shown);
      }`, {}, { transparent: true, depthWrite: false, side: THREE.BackSide });
    S.mtn = L.map(([r, h, k, seed], i) => {
      const mt = mat0.clone(); // clone() copies uniforms: re-link the shared block
      for (const key in S.U) mt.uniforms[key] = S.U[key];
      mt.uniforms.uL = { value: new THREE.Vector4(r, 9 + Math.tan(EL[i][2] * PI / 180) * (r + 12), k, seed) }; mt.uniforms.uL2 = { value: new THREE.Vector4(...EL[i]) }; mt.uniforms.uRW = { value: new THREE.Vector2(0.02 + (4 - i) * 0.07, 0.3 + (4 - i) * 0.07) }; mt.uniforms.uFall = { value: i === 0 ? 1 : 0 };
      const geo = new THREE.CylinderGeometry(r, r, h * 2 + 30, 160, 1, true); geo.translate(0, h - 3, 0);
      const m = new THREE.Mesh(geo, mt); m.renderOrder = -90 + (4 - i) * 2; m.frustumCulled = false; g.add(m); return m;
    });
    mat0.dispose();
  }

  function buildMist(S, g, low) {
    const bands = low ? [[34, -1, 4.5, 0.7], [95, 0, 6, 0.5]] : [[31, -1, 4, 0.7], [50, -1, 5, 0.7], [72, 0, 5.5, 0.6], [100, 0, 6.5, 0.5], [135, 0, 7.5, 0.45]];
    const mat0 = smat(S.U, VW, `
      varying vec3 vW; uniform vec4 uM;
      void main(){
        float r = length(vW.xz); vec2 cs = vW.xz / max(r, 1e-3); float y = vW.y;
        float n = vn(cs * 5.0 + vec2(y * 0.12, uTime * 0.025 + uM.x)) * 0.65 + vn(cs * 13.0 + vec2(-uTime * 0.04, y * 0.25)) * 0.35;
        float a = (1.0 - smoothstep(uM.y, uM.z, y + (n - 0.5) * (uM.z - uM.y) * 1.1)) * uM.w * (0.75 + 0.25 * n);
        a *= 1.0 - uSun * 0.8 * sq1(atan(vW.x, -vW.z) / 0.16) ; // no streaks of mist across the rising sun or its glitter path
        vec3 c = mix(PAPER, I4, uStorm * 0.35 * n);
        gl_FragColor = vec4(outc(c), clamp(a, 0.0, 1.0));
      }`, {}, { transparent: true, depthWrite: false, side: THREE.BackSide });
    S.mist = bands.map(([r, y0, y1, a]) => {
      const mt = mat0.clone(); for (const key in S.U) mt.uniforms[key] = S.U[key]; mt.uniforms.uM = { value: new THREE.Vector4(r, y0, y1, a) };
      const geo = new THREE.CylinderGeometry(r, r, y1 - y0 + 12, 96, 1, true); geo.translate(0, (y0 + y1) / 2, 0);
      const m = new THREE.Mesh(geo, mt); m.renderOrder = r < 40 ? -70 : r < 60 ? -81 : r < 85 ? -83 : r < 115 ? -85 : -87; m.frustumCulled = false; g.add(m); return m;
    });
    mat0.dispose();
  }

  // the middle ground between the terrace and the far ridges: axe-cut rock stacks, gnarled pines, a strip of still water, low mist
  // [angle from -z, radius, width, height, kind 0 rock / 1 pine / 2 mist, base y, ink strength]
  const MID = [[-1.05, 36, 7, 10, 0, -2, 0.95], [-0.62, 45, 8, 11.5, 0, -2, 0.8], [-0.3, 31, 4.6, 7, 0, -2, 1.0], [0.4, 33, 5.2, 8.5, 0, -2, 1.0], [0.72, 47, 8, 11.5, 0, -2, 0.78], [1.12, 37, 6.5, 10, 0, -2, 0.92], [1.55, 43, 5.5, 8.5, 0, -2, 0.85],
    [-0.98, 35.5, 7, 7.5, 1, 4.6, 1.0], [-0.42, 39, 7, 8, 1, -1.5, 0.9], [0.52, 32.5, 6.5, 7.5, 1, -1.5, 1.0], [1.08, 36.5, 7, 7.5, 1, 5.6, 0.95],
    [-0.85, 33, 22, 5, 2, -1, 0.75], [-0.15, 38, 26, 4.5, 2, -0.5, 0.7], [0.55, 35, 22, 5, 2, -1, 0.75], [1.3, 40, 24, 5, 2, -0.5, 0.7], [-1.45, 41, 20, 5, 2, 0, 0.7]];
  function buildMid(S, g) {
    const n = MID.length, qg = new THREE.PlaneGeometry(1, 1); qg.translate(0, 0.5, 0); const aM = iattr(n, 4), aN = iattr(n, 4);
    MID.forEach(([t, r, w, h, k, y0, ink], i) => { aM.setXYZW(i, Math.sin(t) * r, -Math.cos(t) * r, w, h); aN.setXYZW(i, k, i * 7.31 + 1.7, ink, y0); });
    qg.setAttribute('aM', aM); qg.setAttribute('aN', aN);
    const mm = smat(S.U, `attribute vec4 aM, aN; varying vec2 vUv, vXZ; varying vec4 vN; varying float vY;
      void main(){ vec3 c = vec3(aM.x, aN.w, aM.y); vec2 d = c.xz - cameraPosition.xz; float l = length(d); vec2 rt = l > 1e-3 ? vec2(-d.y, d.x) / l : vec2(1.0, 0.0);
        vec3 wp = c + vec3(rt.x, 0.0, rt.y) * position.x * aM.z + vec3(0.0, position.y * aM.w, 0.0);
        vUv = vec2(position.x + 0.5, position.y); vN = aN; vY = wp.y; vXZ = wp.xz; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`, `
      varying vec2 vUv, vXZ; varying vec4 vN; varying float vY;
      float xcAt(float y, float s){ return 0.13 * sin(y * 4.2 + s) + 0.05 * sin(y * 9.7 + s * 2.0) - 0.06 * y; }
      void main(){
        float s = vN.y, x = vUv.x - 0.5, y = vUv.y, a = 0.0, dark = 0.0; vec3 col;
        float rv = clamp((uReveal - 0.25) / 0.4, 0.0, 1.0); if (rv < 0.001) discard;
        if (vN.x < 0.5) {
          // a rock stack: ragged top, leaning sides, a dark contour, axe-cut strokes on the shadow side, the foot lost in mist
          float lean = sin(y * 2.6 + s) * 0.07, xs = x + lean;
          float hw = 0.43 - 0.15 * y + (vn(vec2(y * 5.0, s * 9.0)) - 0.5) * 0.12 + (vn(vec2(y * 17.0, s)) - 0.5) * 0.03;
          float topy = 0.8 + (vn(vec2(xs * 4.0, s * 3.0)) - 0.5) * 0.34 + (vn(vec2(xs * 15.0, s)) - 0.5) * 0.05;
          float ins = min(hw - abs(xs), (topy - y) * 0.6); if (ins < 0.0) discard;
          float aa = max(fwidth(ins), 1e-4) * 1.5, sil = smoothstep(0.0, aa, ins);
          float contour = 1.0 - smoothstep(0.01, 0.028, ins + (vn(vUv * 40.0 + s) - 0.5) * 0.012);
          float side = xs / max(hw, 0.05), shade = smoothstep(-0.25, 0.7, side + (vn(vec2(y * 3.0, s)) - 0.5) * 0.6);
          float cun = 1.0 - kas(vec2(y * 0.5 + s, (xs + y * 0.35) * 0.7), 0.42);
          float strata = (1.0 - smoothstep(0.006, 0.016, abs(fract(y * 3.2 + vn(vec2(xs * 3.0, s)) * 0.7) - 0.5))) * smoothstep(0.1, 0.6, shade) * step(0.5, vn(vec2(xs * 6.0, y * 3.0 + s)));
          float dots = (1.0 - smoothstep(0.012, 0.022, length(vec2(fract(xs * 9.0 + s) - 0.5, (topy - y) * 9.0 - 0.25) * vec2(1.0, 1.3)))) * step(0.45, hh(vec2(floor(xs * 9.0 + s), s)));
          dark = max(max(contour * 0.95, shade * (0.3 + 0.5 * cun)), max(strata * 0.6, dots * 0.9)) * vN.z;
          a = sil * smoothstep(0.0, 0.32, y + (fbm(vec2(xs * 4.0, s)) - 0.5) * 0.3);
        } else if (vN.x < 1.5) {
          // a gnarled pine: a wandering trunk and flat needle pads, darker underneath
          float xc = xcAt(y, s), tw = 0.026 * (1.3 - y) + 0.005;
          float trunk = (1.0 - smoothstep(tw * 0.65, tw, abs(x - xc) + (vn(vec2(y * 30.0, s)) - 0.5) * 0.008)) * step(y, 0.9);
          float bark = kas(vec2(y * 0.8 + s, (x - xc) / tw * 0.12), 0.35);
          a = trunk; dark = trunk * mix(0.55, 0.95, bark);
          for (int k = 0; k < 5; k++) { float fk = float(k), py = 0.4 + fk * 0.12 + (hh(vec2(fk, s)) - 0.5) * 0.05, sd = mod(fk + floor(s), 2.0) * 2.0 - 1.0;
            float bx = xcAt(py - 0.04, s), px = bx + sd * (0.12 + 0.13 * hh(vec2(fk + 3.0, s))) * (1.0 - fk * 0.1);
            vec2 rr = vec2(0.19 - fk * 0.022, 0.05 - fk * 0.004), q = (vec2(x, y) - vec2(px, py)) / rr;
            float e = length(vec2(q.x, q.y > 0.0 ? q.y : q.y * 2.4)) + (vn(vec2(q.x * 3.0, fk + s)) - 0.5) * 0.3;
            float pad = 1.0 - smoothstep(0.86, 1.0, e), ang = atan(q.y, q.x);
            float need = smoothstep(0.35, 0.75, vn(vec2(ang * 9.0 + fk, e * 4.0 + s)));
            float pd = pad * (0.8 + 0.2 * need), pdk = mix(0.95, 0.55, smoothstep(-0.6, 0.8, q.y)) * (0.75 + 0.25 * need);
            float tt = clamp((x - bx) / (px - bx + (px > bx ? 1e-4 : -1e-4)), 0.0, 1.0), by = mix(py - 0.04, py - 0.01, tt);
            float br = (1.0 - smoothstep(0.003, 0.008, abs(y - by))) * step(min(bx, px), x) * step(x, max(bx, px));
            a = max(a, max(pd, br)); dark = max(dark, max(pd * pdk, br * 0.9)); }
          dark *= vN.z; a *= smoothstep(0.0, 0.08, y);
        } else {
          // a low bank of mist drifting across the foot of the rocks
          vec2 q = (vUv - 0.5) * vec2(2.0, 2.0); float m = length(q * vec2(1.0, 1.6)) + (fbm(vUv * vec2(5.0, 2.0) + s + vec2(uTime * 0.02, 0.0)) - 0.5) * 0.7;
          a = (1.0 - smoothstep(0.35, 1.0, m)) * vN.z * (1.0 - uSun * 0.7 * sq1(atan(vXZ.x, -vXZ.y) / 0.14)); dark = 0.04 + uStorm * 0.25;
        }
        if (a < 0.01) discard;
        col = tone(1.0 - clamp(dark, 0.0, 1.0), vn(vUv * 30.0 + s));
        col = mix(col, mix(PAPER, I4, uStorm * 0.5), (1.0 - smoothstep(-2.0, 3.0, vY)) * 0.55 * step(vN.x, 1.5));
        col = mix(col, GLD, uSun * 0.12 * (1.0 - dark));
        gl_FragColor = vec4(outc(col), a * rv);
      }`, {}, { transparent: true, depthWrite: false });
    const m = new THREE.InstancedMesh(qg, mm, n); m.frustumCulled = false; m.renderOrder = -80; g.add(m); S.mid = m;
    // still water below the terrace, catching dark reflections of the rocks
    const wg = new THREE.RingGeometry(26.5, 52, 120, 1, PI * 0.5 - 1.75, 3.5); wg.rotateX(-PI / 2);
    S.wU = { uRk: { value: MID.filter((q) => q[4] < 1).map(([t, r, w, h]) => new THREE.Vector4(Math.sin(t) * r, -Math.cos(t) * r, h, w)) }, uSunD: S.skyU.uSunD };
    const wm = smat(S.U, VW, `
      varying vec3 vW; uniform vec4 uRk[7]; uniform vec3 uSunD;
      void main(){
        vec2 p = vW.xz; float r = length(p), az = atan(p.x, -p.y);
        float rv = clamp((uReveal - 0.3) / 0.4, 0.0, 1.0); if (rv < 0.001) discard;
        float ink = smoothstep(0.56, 0.8, fbm(vec2(az * r * 0.1, r * 0.75) + vec2(uTime * 0.02, 0.0))) * 0.22;
        for (int i = 0; i < 7; i++) { vec4 q = uRk[i]; vec2 dv = cameraPosition.xz - q.xy; float dl = max(length(dv), 1e-3); vec2 dn = dv / dl;
          float al = dot(p - q.xy, dn), sd = abs(dot(p - q.xy, vec2(-dn.y, dn.x)));
          float sm = smoothstep(-1.0, 0.5, al) * (1.0 - smoothstep(q.z * 0.25, q.z * 0.55, al)) * (1.0 - smoothstep(q.w * 0.2, q.w * 0.42, sd));
          ink = max(ink, sm * smoothstep(0.3, 0.6, vn(vec2(sd * 1.5 + q.x, al * 2.5 - uTime * 0.3))) * 0.5); }
        vec3 c = min(mix(mix(PAPER, I4, 0.35 + uStorm * 0.4), tone(1.0 - ink, 0.5), smoothstep(0.02, 0.1, ink)), mix(PAPER, I4, 0.35 + uStorm * 0.4)); float glit = 0.0;
        if (uSun > 0.002) { vec2 sd2 = normalize(uSunD.xz + vec2(1e-5)), rel = p - cameraPosition.xz; float al = dot(rel, sd2), sd = abs(rel.x * sd2.y - rel.y * sd2.x);
          // (r3) the glitter path: three times wider, brighter, broken into flickering horizontal dabs
          float st = (1.0 - smoothstep(0.9, 3.6 + al * 0.075, sd + (vn(vec2(al * 0.5, 3.0)) - 0.5) * 2.0)) * smoothstep(0.28, 0.55, vn(vec2(sd * 0.6, al * 1.1 + uTime * 0.25)));
          c = mix(c, mix(VER, GLD, 0.3 + 0.3 * smoothstep(0.6, 0.9, vn(vec2(sd * 2.0, al * 3.0 - uTime * 0.6)))), st * uSun * 0.95); glit = st * uSun; }
        float a = smoothstep(26.5, 29.0, r) * (1.0 - smoothstep(42.0, 52.0, r));
        gl_FragColor = vec4(outc(c) + vec3(0.35, 0.08, 0.0) * glit, a * rv);
      }`, S.wU, { transparent: true, depthWrite: false });
    const wmsh = new THREE.Mesh(wg, wm); wmsh.position.y = -1.2; wmsh.renderOrder = -80.5; g.add(wmsh); S.water = wmsh;
  }

  function buildBamboo(S, g, low) {
    const rng = mulberry(91), stalks = [], groves = [[0.3, 1.95, 34], [-1.95, -0.3, 32]]; // (r3) the small back-right grove is gone: that sky holds the inscription
    for (const [a0, a1, n0] of groves) { const n = low ? Math.ceil(n0 / 2) : n0; for (let i = 0; i < n; i++) {
      const a = lerp(a0, a1, rng()), r = 23 + Math.pow(rng(), 1.6) * 17, x = Math.sin(a) * r, z = Math.cos(a) * r, H = 9 + rng() * 9 + (40 - r) * 0.18, la = rng() * TAU, lean = rng() * 0.1 * H;
      stalks.push({ x, z, H, lx: Math.sin(la) * lean + x / r * H * 0.04, lz: Math.cos(la) * lean + z / r * H * 0.04, w: 0.17 + rng() * 0.13 + (40 - r) * 0.004, tone: sat((r - 23) / 17 * 0.8 + rng() * 0.2), ph: rng(), ord: rng() });
    } }
    const NS = 6, nC = stalks.length * NS, cg = new THREE.PlaneGeometry(1, 1); cg.translate(0, 0.5, 0);
    const aS = iattr(nC, 4), aP = iattr(nC, 4), aL = iattr(nC, 4); let k = 0;
    const leaves = [];
    for (const s of stalks) {
      let h = 0; const segs = []; for (let j = 0; j < NS; j++) segs.push(0.8 + rng() * 0.4); const tot = segs.reduce((x, y) => x + y, 0);
      for (let j = 0; j < NS; j++) { const h1 = h + segs[j] / tot * s.H; aS.setXYZW(k, s.x, s.z, h, h1); aP.setXYZW(k, s.w, s.tone, s.ph, s.ord); aL.setXYZW(k, s.H, s.lx, s.lz, j); k++;
        if (j >= 2) for (let f2 = 0; f2 < 2; f2++) { const nl = 3 + Math.floor(rng() * 3), fa = rng() * TAU; for (let q = 0; q < nl; q++) { const la = fa + (q - (nl - 1) / 2) * 0.38 + (rng() - 0.5) * 0.15, el = -0.15 - (q % 2) * 0.35 - rng() * 0.3; leaves.push([s, h1 - f2 * 0.3, Math.cos(el) * Math.sin(la), Math.sin(el), Math.cos(el) * Math.cos(la), 1.3 + rng() * 0.9, 0.12 + rng() * 0.06, j]); } }
        h = h1; }
    }
    const cm = smat(S.U, `attribute vec4 aS, aP, aL; varying vec2 vUv; varying float vTone, vSegL, vSeed, vNear;
      ${STALK}
      void main(){
        float grow = clamp((uReveal - 0.55) / 0.4 * 10.0 - aL.w - aP.w * 3.0, 0.0, 1.0);
        float h = mix(aS.z, aS.w, position.y * grow); vec3 c = stalkAt(h, aL.x, aL.yz, aP.z, aS.xy);
        vec2 d = c.xz - cameraPosition.xz; float l = length(d); vec2 rt = l > 1e-3 ? vec2(d.y, -d.x) / l : vec2(1.0, 0.0);
        vNear = smoothstep(6.0, 9.0, length(aS.xy - cameraPosition.xz)); // (r3) a stalk near the lens thins away whole
        vec3 wp = c + vec3(rt.x, 0.0, rt.y) * position.x * aP.x * 1.8 * vNear;
        vUv = vec2(position.x + 0.5, position.y); vTone = aP.y; vSegL = (aS.w - aS.z) * grow; vSeed = aP.z;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`, `varying vec2 vUv; varying float vTone, vSegL, vSeed, vNear;
      void main(){
        if (vNear < 0.004) discard;
        float u = vUv.x, v = clamp(vUv.y, 0.0, 1.0), x = abs(u - 0.5) * 1.8, ym = v * vSegL;
        float body = 1.0 - smoothstep(0.42, 0.5, x + (vn(vec2(ym * 3.0, vSeed * 50.0)) - 0.5) * 0.08);
        float gap = smoothstep(0.05, 0.12, ym) * (1.0 - smoothstep(vSegL - 0.12, vSegL - 0.06, ym));
        float node = (1.0 - smoothstep(0.025, 0.05, abs(ym - vSegL + 0.03))) * (1.0 - smoothstep(0.62, 0.8, x + (vn(vec2(u * 9.0, vSeed * 9.0)) - 0.5) * 0.2)) * step(0.5, vSegL);
        float k = kas(vec2(ym * 0.2, u * 1.2 + vSeed), 0.15 + 0.3 * smoothstep(0.3, 1.0, v));
        float a = max(body * gap * k, node);
        if (a < uCut) discard;
        float dark = mix(0.5, 0.95, smoothstep(0.08, 0.46, x)) + 0.18 * (1.0 - smoothstep(0.1, 0.6, ym));
        dark = max(dark, node * 1.0) * mix(1.0, 0.36, vTone);
        gl_FragColor = vec4(outc(tone(1.0 - clamp(dark, 0.0, 1.0), vn(vec2(u * 3.0, ym)))), a);
      }`, {}, { side: THREE.DoubleSide, alphaToCoverage: A2C() });
    const culm = new THREE.InstancedMesh(cg, cm, nC); cg.setAttribute('aS', aS); cg.setAttribute('aP', aP); cg.setAttribute('aL', aL); culm.frustumCulled = false; g.add(culm);
    const nL = leaves.length, lg = new THREE.PlaneGeometry(1, 1); lg.translate(0, 0.5, 0);
    const aN = iattr(nL, 4), aD = iattr(nL, 4), aQ = iattr(nL, 4), aLn = iattr(nL, 2);
    leaves.forEach(([s, h, dx, dy, dz, len, w, j], i) => { aN.setXYZW(i, s.x, s.z, h, s.H); aD.setXYZW(i, dx, dy, dz, len); aQ.setXYZW(i, w, s.tone, rng(), j + s.ord * 3); aLn.setXY(i, s.lx, s.lz); });
    lg.setAttribute('aN', aN); lg.setAttribute('aD', aD); lg.setAttribute('aQ', aQ); lg.setAttribute('aLn', aLn);
    const lm = smat(S.U, `attribute vec4 aN, aD, aQ; attribute vec2 aLn; varying vec2 vUv; varying float vTone, vNear, vSeed;
      ${STALK}
      void main(){
        float grow = clamp((uReveal - 0.55) / 0.4 * 10.0 - aQ.w - 1.0, 0.0, 1.0);
        vec3 base = stalkAt(aN.z, aN.w, aLn, aQ.z, aN.xy);
        vec3 dir = aD.xyz + vec3(uWind.x, 0.0, uWind.y) * 0.45 + vec3(sin(uTime * 2.3 + aQ.z * 40.0), sin(uTime * 3.1 + aQ.z * 20.0) * 0.5, cos(uTime * 2.1 + aQ.z * 30.0)) * (0.1 + length(uWind) * 0.06);
        dir /= max(length(dir), 1e-3);
        vec3 side = cross(dir, cameraPosition - base); float sl = length(side); side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);
        vNear = smoothstep(6.0, 9.0, length(aN.xy - cameraPosition.xz));
        vec3 wp = base + (dir * position.y * aD.w + side * position.x * aQ.x * 2.0) * grow * vNear;
        vUv = vec2(position.x + 0.5, position.y); vTone = aQ.y; vSeed = aQ.z;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`, `varying vec2 vUv; varying float vTone, vNear, vSeed;
      void main(){
        if (vNear < 0.004) discard;
        float t = clamp(vUv.y, 0.0, 1.0); float hw = 0.5 * sin(3.14159 * pow(t, 0.55)) * (0.85 + 0.15 * vn(vec2(t * 6.0, vSeed * 20.0)));
        float a = 1.0 - smoothstep(hw - 0.08, hw, abs(vUv.x - 0.5));
        a *= kas(vec2(t * 0.5 + vSeed, vUv.x * 0.6), 0.1 + 0.4 * smoothstep(0.55, 1.0, t));
        if (a < uCut) discard;
        float dark = (0.95 - 0.25 * t) * mix(1.0, 0.36, vTone);
        gl_FragColor = vec4(outc(tone(1.0 - dark, vSeed)), a);
      }`, {}, { side: THREE.DoubleSide, alphaToCoverage: A2C() });
    const leaf = new THREE.InstancedMesh(lg, lm, nL); leaf.frustumCulled = false; g.add(leaf);
    S.bamboo = { culm, leaf };
  }

  // a gnarled cherry: tapered branch tubes merged into one mesh, blossoms as instanced dabs that open in order along each branch
  const TREE = [-18.7, -14.3], TREE_C = [-15.4, -10.8]; // trunk foot, canopy centre (it leans over the terrace)
  function buildTree(S, g, low) {
    const rng = mulberry(7), tubes = [], buds = [];
    const rec = (p, dir, len, r, depth, t) => {
      const pts = [p.clone()]; let q = p.clone(); const d = dir.clone();
      for (let i = 0; i < 3; i++) { d.x += (rng() - 0.5) * 0.55; d.y += (rng() - 0.5) * 0.35; d.z += (rng() - 0.5) * 0.55; d.normalize(); q = q.clone().addScaledVector(d, len / 3); pts.push(q); }
      const r1 = r * 0.6; tubes.push({ pts, r0: r, r1, t0: t, t1: t + len });
      if (depth >= 2) for (let i = 1; i < pts.length; i++) buds.push([pts[i], t + len * i / 3, depth]);
      if (depth >= 4) return;
      const nc = depth === 0 ? 3 : (rng() < 0.55 ? 2 : 3);
      for (let c = 0; c < nc; c++) {
        const nd = d.clone(); nd.x += (rng() - 0.5) * 1.5; nd.z += (rng() - 0.5) * 1.5; nd.y += 0.1 + (rng() - 0.4) * 0.6 - depth * 0.14; nd.normalize();
        const at = c === 0 ? 3 : 1 + Math.floor(rng() * 2);
        rec(pts[at], nd, len * (0.6 + rng() * 0.22), r1 * (c === 0 ? 1 : 0.8), depth + 1, t + len * at / 3);
      }
    };
    const base = new V3(TREE[0], -0.3, TREE[1]), lean = new V3(-TREE[0], 0, -TREE[1]).normalize().multiplyScalar(0.55); lean.y = 1; lean.normalize();
    rec(base, lean, 5.2, 0.6, 0, 0);
    const tmax = Math.max(...tubes.map((u) => u.t1));
    const P = [], N = [], UV = [], AT = [], I = [];
    for (const u of tubes) {
      const n = 8, sides = 7, pts = new THREE.CatmullRomCurve3(u.pts).getPoints(n - 1), tb = new TubeBuf(n, sides); tb.build(pts, (i) => lerp(u.r0, u.r1, i / (n - 1)) * (1 + (i === 0 ? 0.2 : 0)));
      const o = P.length / 3; P.push(...tb.pos.array); N.push(...tb.nor.array);
      for (let i = 0; i < n; i++) for (let j = 0; j <= sides; j++) { UV.push(j / sides, lerp(u.t0, u.t1, i / (n - 1))); AT.push(lerp(u.t0, u.t1, i / (n - 1)) / tmax); }
      for (const ix of tb.geo.index.array) I.push(ix + o); tb.geo.dispose();
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); tg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); tg.setAttribute('aT', new THREE.Float32BufferAttribute(AT, 1)); tg.setIndex(I); tg.computeBoundingSphere();
    S.trU = { uTreeA: { value: 1 } }; S.treePts = tubes.flatMap((u) => u.pts); S.treeHide = 0;
    const tm = smat(S.U, `attribute float aT; varying vec3 vN, vW; varying vec2 vUv; varying float vT;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = mat3(modelMatrix) * normal; vUv = uv; vT = aT; gl_Position = projectionMatrix * viewMatrix * wp; }`, `
      uniform float uTreeA; varying vec3 vN, vW; varying vec2 vUv; varying float vT;
      void main(){
        if (vT > (uReveal - 0.6) / 0.3) discard;
        // (r3) never cut piecewise by distance (that left floating branch bars): the whole tree fades out briefly when the lens is inside it
        if (uTreeA < 0.999 && ign(gl_FragCoord.xy) > uTreeA) discard;
        vec3 n = vN / max(length(vN), 1e-4), vd = cameraPosition - vW; vd /= max(length(vd), 1e-4);
        float fr = 1.0 - clamp(abs(dot(n, vd)), 0.0, 1.0), ndl = dot(n, normalize(vec3(-0.4, 0.75, 0.5))) * 0.5 + 0.5;
        float k = kas(vec2(vUv.y * 0.6, vUv.x * 1.5), 0.42);
        float bark = smoothstep(0.7, 0.8, vn(vec2(vUv.x * 5.0, vUv.y * 9.0)));
        float dark = max(smoothstep(0.45, 0.85, fr), (0.35 + 0.45 * (1.0 - ndl)) * (0.45 + 0.55 * k) + bark * 0.3);
        gl_FragColor = vec4(outc(tone(1.0 - clamp(dark, 0.0, 1.0), vn(vUv * 9.0))), 1.0);
      }`, S.trU);
    const tree = new THREE.Mesh(tg, tm); g.add(tree);
    // blossoms
    const nB = low ? 600 : 1200, bg = new THREE.PlaneGeometry(1, 1), aB = iattr(nB, 4), aC = iattr(nB, 4);
    // the first nW are soft pink wash clouds behind the crisp flowers; flowers vary in size and from white to deep pink
    const nW = low ? 36 : 70;
    for (let i = 0; i < nB; i++) { const [bp, bt, dep] = buds[Math.floor(rng() * buds.length)], rr = 0.35 + rng() * (dep >= 4 ? 1.1 : 0.7); const a = rng() * TAU, e = (rng() - 0.3) * 1.6, wsh = i < nW, sz = rng();
      aB.setXYZW(i, bp.x + Math.cos(e) * Math.sin(a) * rr * (wsh ? 0.6 : 1), bp.y + Math.sin(e) * rr * 0.7 - (wsh ? 0.15 : 0), bp.z + Math.cos(e) * Math.cos(a) * rr * (wsh ? 0.6 : 1), wsh ? 0.9 + sz * 0.8 : 0.1 + sz * sz * 0.36); aC.setXYZW(i, bt / tmax * 0.85 + rng() * 0.12, rng() * TAU, rng(), wsh ? 1 : 0); }
    bg.setAttribute('aB', aB); bg.setAttribute('aC', aC);
    // (r3) near the lens a blossom shrinks to nothing between 7 and 4 m (no dithering, no halftone)
    const bm = smat(S.U, `attribute vec4 aB, aC; uniform float uTreeA; varying vec2 vUv; varying float vRot, vSeed, vWash;
      void main(){
        float sc = aB.w * smoothstep(aC.x, aC.x + (aC.w > 0.5 ? 0.15 : 0.04), uBloom) * smoothstep(4.0, 7.0, length(aB.xyz - cameraPosition)) * uTreeA;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 wp = aB.xyz + (right * position.x + up * position.y) * sc * 2.0;
        vUv = position.xy * 2.0; vRot = aC.y; vSeed = aC.z; vWash = aC.w;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`, `varying vec2 vUv; varying float vRot, vSeed, vWash;
      void main(){
        float r = length(vUv), a = atan(vUv.y, vUv.x) + vRot;
        if (vWash > 0.5) {
          // a soft wash of pink laid in first, wet edge slightly darker
          float e = r + (fbm(vUv * 2.2 + vSeed * 9.0) - 0.5) * 0.55, m = (1.0 - smoothstep(0.55, 0.95, e)) * 0.42;
          if (uCut > 0.3 ? m < ign(gl_FragCoord.xy + 17.0) : m < 0.02) discard;
          vec3 c = mix(mix(PAPER, PK, 0.45 + 0.3 * vSeed), PK2, smoothstep(0.7, 0.92, e) * 0.35);
          gl_FragColor = vec4(outc(c), m); return;
        }
        float pet = 0.62 + 0.38 * pow(abs(cos(a * 2.5)), 0.6);
        float m = 1.0 - smoothstep(pet * 0.95 - 0.12, pet * 0.95, r);
        if (m < uCut) discard;
        float tn = vSeed * vSeed;
        vec3 pk = mix(mix(PAPER, PK, 0.35), mix(PK, PK2, 0.55), tn);
        vec3 c = mix(pk, mix(PAPER, pk, 0.5), smoothstep(0.15, 0.75, r) * (0.5 + 0.5 * fract(vSeed * 7.3)));
        c = mix(c, mix(PK2, VER, 0.25), (1.0 - smoothstep(0.1, 0.26, r)) * 0.95);
        c = mix(c, I1, (1.0 - smoothstep(0.03, 0.06, abs(r - 0.32))) * step(0.85, abs(cos(a * 2.5 + 1.57))) * 0.8);
        c = mix(c, PK2, smoothstep(pet * 0.75, pet * 0.95, r) * (0.25 + 0.35 * tn));
        gl_FragColor = vec4(outc(c), m);
      }`, S.trU, { side: THREE.DoubleSide, alphaToCoverage: A2C() });
    const bl = new THREE.InstancedMesh(bg, bm, nB); bl.frustumCulled = false; g.add(bl);
    // falling petals: one looping cloud over the whole terrace, densest around the tree
    const nP = low ? 400 : 800, pg = new THREE.PlaneGeometry(0.16, 0.12), aP = iattr(nP, 4);
    for (let i = 0; i < nP; i++) { const near = i % 3 === 0, a = rng() * TAU, r = near ? rng() * 7 : Math.sqrt(rng()) * 30; aP.setXYZW(i, (near ? TREE[0] : 0) + Math.sin(a) * r, (near ? TREE[1] : 0) + Math.cos(a) * r, rng(), 0.8 + rng() * 0.6); }
    pg.setAttribute('aP', aP);
    const pm = smat(S.U, `attribute vec4 aP; varying vec2 vUv; varying float vA;
      void main(){
        float H = 20.0, t = uTime * (0.45 + 0.3 * fract(aP.z * 7.31)) + aP.z * H, el = mod(t, H), y = H - el - 0.5;
        vec3 c = vec3(aP.x, y, aP.y) + vec3(uWind.x, 0.0, uWind.y) * el * 0.45 + vec3(sin(t * 1.7 + aP.z * 20.0), 0.0, cos(t * 1.3 + aP.z * 11.0)) * 0.6;
        float sp = t * 3.0 + aP.z * 30.0; vec2 q = position.xy * vec2(cos(sp), 1.0) * aP.w;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vUv = position.xy / vec2(0.16, 0.12) + 0.5; vA = uPetal * smoothstep(0.0, 1.5, el) * smoothstep(-0.4, 0.4, y);
        gl_Position = projectionMatrix * viewMatrix * vec4(c + right * q.x + up * q.y, 1.0);
      }`, `varying vec2 vUv; varying float vA;
      void main(){ vec2 q = vUv - 0.5; float m = (1.0 - smoothstep(0.38, 0.5, length(q * vec2(1.0, 1.3)))) * vA; if (m < uCut) discard; gl_FragColor = vec4(outc(mix(PK, PK2, smoothstep(0.0, 0.5, q.x + 0.25))), m); }`, {}, { side: THREE.DoubleSide, alphaToCoverage: A2C() });
    const pet = new THREE.InstancedMesh(pg, pm, nP); pet.frustumCulled = false; g.add(pet);
    S.tree = { tree, bl, pet };
  }

  function buildBirds(S, g) {
    const n = 12, bg = new THREE.PlaneGeometry(1, 1), aB = iattr(n, 4), rng = mulberry(5);
    for (let i = 0; i < n; i++) { const k = i - 5.5; aB.setXYZW(i, -Math.abs(k) * 3.2 + rng() * 1.5, (rng() - 0.5) * 3, k * 3.0, rng()); }
    bg.setAttribute('aB', aB); S.birdU = { uBirdT: { value: 0 }, uBirdA: { value: 0 } };
    const bm = smat(S.U, `attribute vec4 aB; uniform float uBirdT; varying vec2 vUv; varying float vPh;
      void main(){ vec3 c = vec3(mix(-120.0, 120.0, uBirdT), 15.5 + sin(uBirdT * 6.0) * 1.6, -95.0) + aB.xyz * vec3(1.3, 0.6, 1.0);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vUv = position.xy; vPh = aB.w; gl_Position = projectionMatrix * viewMatrix * vec4(c + (right * position.x + up * position.y) * (4.4 + aB.w * 1.6), 1.0); }`,
    `uniform float uBirdA; varying vec2 vUv; varying float vPh;
      void main(){ float fl = sin(uTime * 6.0 + vPh * 6.283), x = abs(vUv.x); if (x > 0.48) discard;
        float f = x * (0.45 + 0.4 * fl) - x * x * 0.7 * fl - 0.05, w = 0.055 * (1.0 - x * 1.5);
        float a = (1.0 - smoothstep(w * 0.5, w, abs(vUv.y - f))) * uBirdA; if (a < uCut) discard; gl_FragColor = vec4(outc(I1), a); }`, S.birdU, { side: THREE.DoubleSide, alphaToCoverage: A2C() });
    const m = new THREE.InstancedMesh(bg, bm, n); m.frustumCulled = false; m.visible = false; g.add(m); S.birds = m;
  }

  // ground stroke decals: one instanced mesh. kinds 0 stroke, 1 blot, 2 seal print, 3 bamboo stalk, 4 carved seal, 5 enso arc
  function buildDecals(S, g) {
    const n = 40, dg = new THREE.PlaneGeometry(1, 1); dg.rotateX(-PI / 2);
    const A = iattr(n, 4), B = iattr(n, 4); A.setUsage(THREE.DynamicDrawUsage); B.setUsage(THREE.DynamicDrawUsage); for (let i = 0; i < n; i++) A.setXYZW(i, -1e4, 1, 0, 0);
    dg.setAttribute('aA', A); dg.setAttribute('aB', B);
    const dm = smat(S.U, `attribute vec4 aA, aB; varying vec2 vL; varying vec4 vA, vB;
      void main(){ vL = vec2(position.x + 0.5, position.z + 0.5); vA = aA; vB = aB; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`, `
      varying vec2 vL; varying vec4 vA, vB;
      void main(){
        float age = uTime - vA.x; if (age < 0.0) age += 3600.0;
        float kind = vA.z, seed = vA.w, len = vB.x, w = vB.y;
        float fade = 1.0 - smoothstep(vB.w - 2.0, vB.w, age);
        if (fade <= 0.001) discard;
        float dry = smoothstep(vB.z, vB.z + 3.0, age), prog = clamp(age / max(vA.y, 0.01), 0.0, 1.0);
        if (kind < 1.5 || (kind > 2.5 && kind < 3.5)) fade *= 1.0 - smoothstep(vB.z + 1.2, vB.z + 3.2, age); // (r3) dried strokes leave no compass rings or rulers
        if (fade <= 0.001) discard;
        float u = clamp(vL.y, 0.0, 1.0), v = clamp(vL.x, 0.0, 1.0), a = 0.0; vec3 col = I0;
        if (kind < 0.5 || (kind > 2.5 && kind < 3.5)) {
          float xm = u * len, nA = vn(vec2(xm * 0.35, seed * 7.0));
          float hw = 0.5 * (0.55 + 0.4 * (1.0 - u) + 0.15 * nA) * smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.9, 1.0, u) * 0.6) + 0.02;
          float body = 1.0 - smoothstep(hw - 0.08, hw, abs(v - 0.5 - sin(u * 3.14159) * 0.06 * (nA - 0.4)) + (vn(vec2(xm * 2.0, seed)) - 0.5) * 0.14);
          body *= smoothstep(0.0, 0.03 + 0.03 * nA, u) * (1.0 - smoothstep(0.96 - 0.04 * nA, 1.0, u));
          body *= step(u, prog * 1.04 - (vn(vec2(v * 9.0, seed)) - 0.5) * 0.04);
          body *= kasA(vec2(xm * 0.08, v * w * 0.6 + seed), mix(0.18, 0.55, smoothstep(0.4, 1.0, u)) + dry * 0.12);
          if (kind > 2.5) { float m = mod(xm + seed, 7.0); body *= smoothstep(0.1, 0.22, m) * (1.0 - smoothstep(6.8, 6.92, m));
            body = max(body, (1.0 - smoothstep(0.05, 0.1, abs(m - 6.96))) * (1.0 - smoothstep(0.55, 0.62, abs(v - 0.5))) * step(xm, prog * len)); }
          a = body;
          float gls = (1.0 - smoothstep(0.0, 0.07, abs(v - 0.36))) * (1.0 - dry);
          col = mix(mix(I0, I3, gls * 0.5), mix(I3, I4, 0.35), dry);
        } else if (kind < 1.5) {
          vec2 q = (vec2(v, u) - 0.5) * 2.0; float d = length(q);
          float grow = mix(0.5, 1.0, smoothstep(0.0, max(vA.y, 0.01), age)), edge = grow * (0.86 + 0.14 * vn(q * 4.0 + seed * 10.0));
          float body = 1.0 - smoothstep(edge - 0.05, edge, d);
          vec2 sg = q * 7.0, si = floor(sg), sf = fract(sg) - 0.5; float sp = (1.0 - smoothstep(0.08, 0.16, length(sf))) * step(hh(si + seed), 0.18) * step(edge, d) * (1.0 - smoothstep(edge, edge + 0.35, d));
          float rim = smoothstep(edge - 0.12, edge - 0.03, d) * body;
          a = max(body * (0.8 + 0.2 * rim), sp);
          col = mix(mix(I0, I1, (1.0 - rim) * 0.4), mix(I2, I3, 0.6 - rim * 0.4), dry);
        } else if (kind < 2.5 || kind > 3.5 && kind < 4.5) {
          vec2 q = vec2(v, u); float ed = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)) + (vn(q * 30.0 + seed) - 0.5) * 0.02;
          float body = smoothstep(0.0, 0.01, ed), carve = 0.0;
          if (kind < 2.5) {
            float fr = smoothstep(0.06, 0.07, ed) * (1.0 - smoothstep(0.1, 0.11, ed));
            vec2 c = q - 0.5; float l1 = 1.0 - smoothstep(0.02, 0.035, abs(c.y - 0.16)), l2 = 1.0 - smoothstep(0.02, 0.035, abs(c.y + 0.02)), l3 = 1.0 - smoothstep(0.02, 0.035, abs(c.y + 0.2));
            float v1 = (1.0 - smoothstep(0.02, 0.035, abs(c.x + 0.12))) * step(abs(c.y), 0.3), v2 = (1.0 - smoothstep(0.02, 0.035, abs(c.x - 0.14))) * step(-0.2, c.y) * step(c.y, 0.3);
            carve = max(fr, max(max(l1 * step(abs(c.x), 0.28), l2 * step(abs(c.x), 0.22)), max(l3 * step(abs(c.x + 0.05), 0.3), max(v1, v2))));
          } else {
            vec2 cell = floor(q * 3.0); float idx = cell.x + cell.y * 3.0; float safe = mod(floor(seed / exp2(idx) + 0.001), 2.0);
            vec2 cf = fract(q * 3.0); float ce = min(min(cf.x, 1.0 - cf.x), min(cf.y, 1.0 - cf.y));
            carve = max(safe * smoothstep(0.03, 0.06, ce), (1.0 - smoothstep(0.008, 0.016, ce)) * 0.8);
          }
          a = body * (1.0 - carve * 0.92) * (0.82 + 0.18 * vn(q * 60.0 + seed));
          col = VER;
        } else {
          vec2 q = (vec2(v, u) - 0.5) * 2.0 * 13.0; float d = length(q), an = atan(q.x, q.y), rel = mod(an - seed - 0.48, 6.28318);
          float rm = 0.5 * (vB.x + vB.y), hwr = 0.5 * (vB.y - vB.x) * (0.85 + 0.25 * vn(vec2(rel * 3.0, 1.0)));
          float body = (1.0 - smoothstep(hwr - 0.15, hwr, abs(d - rm))) * step(rel, prog * 5.32);
          body *= kasA(vec2(rel * 2.0, (d - rm) * 0.4), 0.1 + 0.55 * smoothstep(3.5, 5.3, rel) + dry * 0.1);
          a = body; col = mix(I0, mix(I2, I3, 0.5), dry);
        }
        a *= fade; if (a < 0.01) discard;
        gl_FragColor = vec4(outc(col), a);
      }`, {}, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const m = new THREE.InstancedMesh(dg, dm, n); m.frustumCulled = false; m.renderOrder = 5; g.add(m);
    for (let i = 0; i < n; i++) { _m.position.set(0, -50, 0); _m.rotation.set(0, 0, 0); _m.scale.set(0.001, 1, 0.001); _m.updateMatrix(); m.setMatrixAt(i, _m.matrix); }
    S.dec = { mesh: m, a: A, b: B, n, i: 0 };
  }
  function decal(S, kind, cx, cz, dir, len, w, draw = 0.25, wet = 1, life = 7, seed) {
    if (G.headless || !S.dec) return; const D = S.dec, i = D.i; D.i = (D.i + 1) % D.n;
    _m.position.set(cx, 0.03 + i * 0.0006, cz); _m.rotation.set(0, dir, 0); if (kind === 5) _m.scale.set(26, 1, 26); else _m.scale.set(w, 1, len); _m.updateMatrix(); D.mesh.setMatrixAt(i, _m.matrix);
    D.a.setXYZW(i, G.now % 3600, draw, kind, seed === undefined ? vrand() * 50 : seed); D.b.setXYZW(i, len, w, wet, life);
    D.mesh.instanceMatrix.needsUpdate = true; D.a.needsUpdate = true; D.b.needsUpdate = true;
  }
  function dryPrints(S) { if (!S.dec) return; const D = S.dec, now = G.now % 3600; let ch = false;
    for (let i = 0; i < D.n; i++) { const k = D.a.getZ(i); if (k < 1.5 || (k > 2.5 && k < 3.5) || k > 4.5) continue; let age = now - D.a.getX(i); if (age < 0) age += 3600; if (age < D.b.getW(i)) { D.b.setW(i, Math.min(D.b.getW(i), age + 1.6)); ch = true; } }
    if (ch) D.b.needsUpdate = true; }
  function hideDecals(S) { if (!S.dec) return; for (let i = 0; i < S.dec.n; i++) S.dec.a.setX(i, -1e4); S.dec.a.needsUpdate = true; }

  // leaf and petal shapes drawn over gale/blossom bullets (the bullet's vermilion core stays inside)
  function buildBulletQuads(S, g) {
    const n = 140, qg = new THREE.PlaneGeometry(1, 1); qg.rotateX(-PI / 2);
    const qm = smat(S.U, `varying vec2 vL; varying float vK; void main(){ vL = vec2(position.x + 0.5, position.z + 0.5); vK = instanceColor.r; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`, `
      varying vec2 vL; varying float vK;
      void main(){
        float t = clamp(vL.y, 0.0, 1.0), a; vec3 c;
        if (vK < 0.5) { float hw = 0.5 * sin(3.14159 * pow(t, 0.6)), ax = abs(vL.x - 0.5); a = 1.0 - smoothstep(hw - 0.1, hw, ax); a *= kas(vec2(t * 0.5, vL.x * 0.5), 0.1 + 0.25 * t); c = mix(I0, I1, t);
          c = mix(c, VER, max(smoothstep(hw - 0.16, hw - 0.06, ax), (1.0 - smoothstep(0.015, 0.035, ax)) * step(0.12, t) * step(t, 0.85))); }
        else { vec2 q = vL - 0.5; float d = length(q * vec2(1.0, 0.8)); a = 1.0 - smoothstep(0.38, 0.48, d + (step(0.3, q.y) * max(0.12 - abs(q.x), 0.0) * 1.2)); c = mix(PK, PK2, smoothstep(0.0, 0.4, d)); c = mix(c, VER, smoothstep(0.3, 0.4, d)); }
        if (a < uCut) discard; gl_FragColor = vec4(outc(c), a);
      }`, {}, { side: THREE.DoubleSide, alphaToCoverage: A2C() });
    const m = new THREE.InstancedMesh(qg, qm, n); m.frustumCulled = false; m.renderOrder = 13;
    for (let i = 0; i < n; i++) { _m.position.set(0, -50, 0); _m.scale.setScalar(0.001); _m.updateMatrix(); m.setMatrixAt(i, _m.matrix); m.setColorAt(i, _c.setRGB(i % 2, 0, 0)); }
    g.add(m);
    // the bullets themselves: a wet ink globe with a vermilion rim (petals: a pink globe), wrapped around the stock core, which is drawn
    // in ink colour so its additive tail and floor disc vanish. Under each, an ink blot that spreads on the paper as it flies.
    // (r2) no longer a glossy globe: a flat ink blot (petals: pink) with a ragged edge and a short dry-brush trail, turned to the eye about
    // its line of flight, with vermilion only as a thin broken crescent on the leading side
    const gm = smat(S.U, `varying vec2 vL; varying float vK, vSd;
      void main(){ vK = instanceColor.r; vSd = instanceColor.g * 37.0; vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float s = length((instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz); vec3 f = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz; f /= max(length(f), 1e-4);
        vec3 v = cameraPosition - c; v /= max(length(v), 1e-4); vec3 rt = cross(v, f); float rl = length(rt); rt = rl > 1e-3 ? rt / rl : vec3(1.0, 0.0, 0.0);
        vec3 fw = cross(rt, v); vL = vec2(position.x, position.y * 1.7 - 0.7);
        gl_Position = projectionMatrix * viewMatrix * vec4(c + v * s * 1.1 + rt * vL.x * s + fw * vL.y * s, 1.0); }`, `
      varying vec2 vL; varying float vK, vSd;
      void main(){ vec2 q = vL; float d = length(q) + (fbm(q * 1.7 + vSd) - 0.5) * 0.5, ang = atan(q.x, q.y);
        float blob = 1.0 - smoothstep(0.74, 0.84, d);
        float tw = 0.72 * (1.0 + q.y / 2.4), tr = (1.0 - smoothstep(tw - 0.12, tw, abs(q.x + sin(q.y * 1.7 + vSd) * 0.08))) * step(q.y, 0.0) * kas(vec2(q.y * 0.35 + vSd, q.x * 0.45), 0.2 + 0.55 * (-q.y / 2.4));
        float a = max(blob, tr * 0.9);
        float cres = (smoothstep(0.5, 0.62, d) - smoothstep(0.72, 0.84, d)) * smoothstep(0.15, 0.6, q.y / max(length(q), 0.05)) * step(0.42, vn(vec2(ang * 3.0 + vSd, 1.0)));
        vec3 c = vK < 0.5 ? mix(I0, I1, (1.0 - blob) * 0.6) : mix(mix(PAPER, PK, 0.75), PK2, smoothstep(0.2, 0.8, d) * 0.7 + (1.0 - blob) * 0.3);
        c = mix(c, VER, cres * 0.95);
        if (a < uCut) discard; gl_FragColor = vec4(outc(c), a); }`, {}, { side: THREE.DoubleSide, alphaToCoverage: A2C() });
    const glb = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), gm, n); glb.frustumCulled = false; glb.renderOrder = 12;
    const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-PI / 2);
    const sm = smat(S.U, `varying vec2 vL; varying float vK, vS; void main(){ vL = position.xz * 2.0; vK = instanceColor.r; vS = instanceColor.g; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`, `
      varying vec2 vL; varying float vK, vS;
      void main(){ float d = length(vL) + (vn(vL * 3.0 + vS * 13.0) - 0.5) * 0.35; float a = (1.0 - smoothstep(0.55, 0.95, d)) * 0.5 + (smoothstep(0.7, 0.85, d) - smoothstep(0.85, 0.97, d)) * 0.25;
        if (a < 0.01) discard; gl_FragColor = vec4(outc(vK < 0.5 ? I1 : mix(PK2, I2, 0.4)), a); }`, {}, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const sh = new THREE.InstancedMesh(sg, sm, n); sh.frustumCulled = false; sh.renderOrder = 6;
    for (let i = 0; i < n; i++) { _m.position.set(0, -50, 0); _m.scale.setScalar(0.001); _m.updateMatrix(); glb.setMatrixAt(i, _m.matrix); sh.setMatrixAt(i, _m.matrix); glb.setColorAt(i, _c.setRGB(i % 2, 0, 0)); sh.setColorAt(i, _c.setRGB(i % 2, 0, 0)); }
    g.add(glb, sh);
    S.bq = { mesh: m, glb, sh, n };
  }

  // painted telegraphs: every hazard on the floor drawn as part of the picture (a diluted vermilion wash filling in along the stroke,
  // a darker wet edge, a wobbling brushed outline). The stock decals are hidden while this fight runs; shapes and timing are the same.
  function buildTele(S, g) {
    const n = 72, tg = new THREE.PlaneGeometry(2, 2); tg.rotateX(-PI / 2);
    const T0 = iattr(n, 4), T1 = iattr(n, 4), T2 = iattr(n, 4); for (const a of [T0, T1, T2]) a.setUsage(THREE.DynamicDrawUsage);
    tg.setAttribute('aT0', T0); tg.setAttribute('aT1', T1); tg.setAttribute('aT2', T2);
    const tm = smat(S.U, `attribute vec4 aT0, aT1, aT2; varying vec2 vP; varying vec3 vW; varying vec4 vT0, vT1, vT2;
      void main(){ vP = position.xz * aT2.x; vT0 = aT0; vT1 = aT1; vT2 = aT2; vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`, `
      varying vec2 vP; varying vec3 vW; varying vec4 vT0, vT1, vT2;
      void main(){
        float len = length(vP), d, f, ty = vT0.x;
        if (ty < 0.5) { d = len - vT0.y; f = len / max(vT0.y, 1e-3); }
        else if (ty < 1.5) { d = max(len - vT0.y, vT0.z - len); f = (len - vT0.z) / max(vT0.y - vT0.z, 1e-3); }
        else if (ty < 2.5) { float an = abs(atan(vP.x, vP.y + 1e-5)); d = max(max(len - vT0.y, vT0.z - len), (an - vT0.w * 0.5) * max(len, 0.3)); f = (len - vT0.z) / max(vT0.y - vT0.z, 1e-3); }
        else { d = max(abs(vP.x) - vT0.z * 0.5, max(-vP.y, vP.y - vT0.y)); f = vP.y / max(vT0.y, 1e-3); }
        vec2 wq = vW.xz; float seed = vT2.y, kind = vT2.z, prog = vT1.x, fire = vT1.y, mode = vT1.z;
        float big = smoothstep(6.0, 16.0, vT2.x);
        d += (fbm(wq * 0.6 + seed) - 0.5) * 0.34 + (vn(wq * 3.3 + seed) - 0.5) * 0.05 * (1.0 - uStorm);
        if (d > 0.3) discard;
        float inside = 1.0 - smoothstep(-0.03, 0.03, d);
        float ew = (0.13 + 0.12 * fbm(wq * 0.9 + seed + 4.0)) * (1.0 - 0.5 * uStorm), edge = 1.0 - smoothstep(ew * 0.45, ew, abs(d + ew * 0.5));
        float g = fbm(wq * 0.45 + seed), gr = vn(wq * 9.0) * 0.5 + vn(wq * 23.0 + 3.0) * 0.5;
        float ff = f + (vn(wq * 1.2 + seed) - 0.5) * 0.1, filled = mode > 0.5 ? 1.0 : 1.0 - smoothstep(prog - 0.05, prog, ff);
        float front = mode > 0.5 ? 0.0 : (smoothstep(prog - 0.14, prog - 0.02, ff) - smoothstep(prog - 0.02, prog + 0.005, ff)) * step(prog, 0.995);
        float pulse = smoothstep(0.78, 1.0, prog) * (0.5 + 0.5 * sin(uTime * 14.0)) * step(mode, 0.5);
        // a readable wash: ~0.4 when the cast starts, ~0.6 when it lands, and a darker band 0.5 m inside the edge (the wet edge pulls
        // pigment inward) so the deadly side of every line is plain. The storm floor is grey, so the wash is stronger there.
        float narrow = max(step(2.5, ty) * (1.0 - step(3.0, vT0.z)), step(1.5, ty) * step(ty, 2.5)); // (r3) lanes under 3 m and cones start half full
        float base = mode > 0.5 ? 0.42 : mix(mix(0.38, 0.5, narrow), 0.6, prog), stormK = 1.0 + 0.4 * uStorm;
        float band = inside * smoothstep(-0.6, -0.12, d);
        float wa = (inside * (base * (mix(0.55, 0.8, narrow) + mix(0.45, 0.2, narrow) * filled) + 0.07 * pulse) * (0.8 + 0.35 * g) * (0.88 + 0.24 * gr) * (1.0 - 0.3 * big) + band * 0.2) * stormK;
        float fa = inside * front * 0.35, ea = edge * (0.8 + 0.15 * vn(wq * 2.0 + seed)) * min(stormK, 1.25);
        vec3 wc, ec, fc;
        if (kind < 0.5) { wc = mix(mix(VER, PAPER, 0.16), mix(VER, I0, 0.25), band * 0.6); ec = mix(VER, I0, 0.3); fc = mix(VER, I0, 0.22);
          wc = mix(wc, mix(CRM, I0, band * 0.3), uSun * 0.75); ec = mix(ec, mix(CRM, I0, 0.3), uSun * 0.6); } // crimson on the gold dawn floor
        else if (kind < 1.5) { wc = I1; ec = I0; fc = I1; wa *= 1.3; ea *= 0.9; ea = max(ea, (1.0 - smoothstep(0.02, 0.06, abs(d + ew + 0.05))) * inside * 0.75); }
        else { wc = mix(PAPER, GLD, 0.35); ec = mix(OCH, VER, 0.15); fc = wc; wa = inside * 0.5; }
        vec3 col = wc; float a = wa;
        col = mix(col, fc, clamp(fa / max(a + fa, 1e-3), 0.0, 1.0)); a = max(a, fa);
        float ek = clamp(ea * 1.4, 0.0, 1.0);
        if (kind > 0.5 && kind < 1.5) col = mix(col, mix(ec, VER, step(0.0, -d - ew - 0.01) * 0.8), ek); else col = mix(col, ec, ek);
        a = max(a, ea);
        col = mix(col, I0, fire * inside * 0.7); a = max(a, fire * inside * 0.6);
        a *= vT1.w; if (a < 0.01) discard;
        gl_FragColor = vec4(outc(col), clamp(a, 0.0, 1.0));
      }`, {}, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new THREE.InstancedMesh(tg, tm, n); m.frustumCulled = false; m.renderOrder = 10; g.add(m);
    for (let i = 0; i < n; i++) { _m.position.set(0, -50, 0); _m.rotation.set(0, 0, 0); _m.scale.set(0.001, 1, 0.001); _m.updateMatrix(); m.setMatrixAt(i, _m.matrix); T2.setX(i, 1); }
    S.tele = { mesh: m, n, T0, T1, T2 };
  }
  function syncTele(S) {
    const TL = S.tele, M = TL.mesh; let k = 0;
    for (const h of Hz.list) {
      if (h.mesh) h.mesh.visible = false; // the stock decal stays hidden; it is painted below
      if (h.state === 'done' || k >= TL.n || h.name === 'Enso') continue; // the Enso ring is painted as one stroke (buildEnso)
      const s = h.shape; let ty = 0, a = 0, b2 = 0, c = 0, bound = 1;
      if (s.type === 'circle') { a = s.r; bound = s.r; } else if (s.type === 'donut') { ty = 1; a = s.r1; b2 = s.r0; bound = s.r1; }
      else if (s.type === 'cone') { ty = 2; a = s.r; b2 = s.r0 || 0; c = s.arc; bound = s.r; } else { ty = 3; a = s.len; b2 = s.w; bound = Math.max(s.len, s.w); }
      bound += 0.6;
      const col = h.color, kind = col === GOLD ? 2 : (col & 0xf0f0f0) === 0x101010 ? 1 : 0;
      let prog = 1, fire = 0, mode = 0, al = 1;
      if (h.state === 'tele') prog = sat(h.t / Math.max(h.delay, 1e-3));
      else if (h.state === 'fired') { fire = sat(h.fireT / 0.28); al = sat(h.fireT / 0.2); }
      else { mode = 1; al = Math.min(1, (h.dur - h.zt) * 2); }
      if (h.style === 1) mode = 1;
      _m.position.set(s.x, 0.05 + k * 0.0004, s.z); _m.rotation.set(0, s.dir || 0, 0); _m.scale.set(bound, 1, bound); _m.updateMatrix(); M.setMatrixAt(k, _m.matrix);
      if (h.paintSeed === undefined) h.paintSeed = vrand() * 40;
      TL.T0.setXYZW(k, ty, a, b2, c); TL.T1.setXYZW(k, prog, fire, mode, al); TL.T2.setXYZW(k, bound, h.paintSeed, kind, 0); k++;
    }
    M.count = k; if (k) { M.instanceMatrix.needsUpdate = true; TL.T0.needsUpdate = TL.T1.needsUpdate = TL.T2.needsUpdate = true; }
  }

  // The Enso: the whole ring is one brush stroke on one quad, painted in polar coordinates. Before the brush arrives the band is a
  // vermilion-tinted wet wash between two thin vermilion danger lines; then the brush sweeps round (in step with the wall hazards),
  // loaded black at the start, thinning to dry-brush kasure toward the gap, which is simply where it ran dry: bare paper and an ochre tick.
  // uE: start angle, stroke length (rad), drawn length (rad), alpha. uE2.x: telegraph progress, uE2.y: drying after the cast.
  function buildEnso(S, g) {
    S.eU = { uE: { value: new THREE.Vector4(0, 5.32, 0, 0) }, uE2: { value: new THREE.Vector4(0, 0, 0, 0) } };
    const geo = new THREE.PlaneGeometry(28, 28); geo.rotateX(-PI / 2);
    const m = new THREE.Mesh(geo, smat(S.U, VW, `
      varying vec3 vW; uniform vec4 uE, uE2;
      void main(){
        vec2 p = vW.xz; float r = length(p); if (r < 8.6 || r > 13.4) discard;
        float a = atan(p.x, p.y), rel = mod(a - uE.x, 6.28318), L = max(uE.y, 1e-3), u = clamp(rel / L, 0.0, 1.0), on = step(rel, L);
        vec2 cs = p / max(r, 1e-3);
        float r0 = 9.5 + (fbm(cs * 1.6 + 3.0) - 0.5) * 0.6, r1 = 12.5 + (fbm(cs * 1.6 + 9.0) - 0.5) * 0.6;
        float inb = smoothstep(r0 - 0.07, r0 + 0.07, r) * (1.0 - smoothstep(r1 - 0.07, r1 + 0.07, r)) * on;
        // (r3) the stroke starts in a round, slightly ragged blob where the brush landed (no straight radial cut)
        float rmid = 0.5 * (r0 + r1), hwb = 0.5 * (r1 - r0), sl0 = rel * r;
        float capD = length(vec2(max(hwb - sl0, 0.0), r - rmid)) - hwb * (0.97 + (fbm(p * 1.3 + 2.0) - 0.5) * 0.3);
        inb *= mix(1.0, 1.0 - smoothstep(-0.07, 0.07, capD), step(sl0, hwb));
        float v = clamp((r - r0) / max(r1 - r0, 0.5), 0.0, 1.0), sl = rel * 11.0;
        // the brush: drawn up to uE.z with a soft wet head; loaded at the start, kasure growing toward the dry end
        float drawn = 1.0 - smoothstep(uE.z - 0.04, uE.z, rel), head = (1.0 - smoothstep(0.0, 0.16, abs(rel - uE.z + 0.06))) * step(uE.z, L - 0.02) * step(0.01, uE.z);
        float k = kasA(vec2(sl * 0.06, v * 0.34), smoothstep(0.55, 1.0, u) * 0.58 + uE2.y * 0.12 + (1.0 - smoothstep(0.0, hwb * 2.2, sl0)) * 0.16);
        float wetE = 1.0 - smoothstep(0.0, 0.22, min(r - r0, r1 - r));
        float gr = fbm(p * 0.7 + 4.0);
        vec3 ink = mix(I0, I1, clamp(smoothstep(0.2, 0.85, u) * 0.75 + (gr - 0.5) * 0.3, 0.0, 1.0));
        ink = mix(ink, I2, smoothstep(0.8, 1.0, u) * 0.35 + uE2.y * 0.35);
        ink = mix(ink, I0, max(wetE * 0.75, head));
        ink = mix(ink, ink * vec3(0.9, 0.97, 1.12), uSun); // (r3) cancel the warm dawn grade so the stroke stays ink, not brown
        float ia = inb * drawn * k * (0.95 - 0.15 * u) * (1.0 - 0.4 * uE2.y);
        // the wet wash ahead of the brush: the band that will be painted
        float wa = inb * (1.0 - drawn) * mix(0.36, 0.58, uE2.x) * (0.85 + 0.3 * gr);
        vec3 col = mix(mix(VER, PAPER, 0.18), mix(VER, I0, 0.25), wetE * 0.6); float al = wa;
        col = mix(col, ink, clamp(ia / max(ia + wa * (1.0 - ia), 1e-3), 0.0, 1.0)); al = ia + al * (1.0 - ia);
        // one thin vermilion line on each true edge of the danger band, broken here and there like a quick brush line
        float le = min(abs(r - 9.5 - (vn(cs * 30.0) - 0.5) * 0.08), abs(r - 12.5 - (vn(cs * 30.0 + 4.0) - 0.5) * 0.08));
        float ln = (1.0 - smoothstep(0.035, 0.075, le)) * on * smoothstep(0.25, 0.4, vn(vec2(sl * 0.4, 2.0)) + 0.2) * (1.0 - uE2.y);
        col = mix(col, VER, ln * 0.95); al = max(al, ln * 0.95);
        // the gap: bare paper, one ochre tick across the band at its middle
        float gm = L + (6.28318 - L) * 0.5, tk = (1.0 - smoothstep(0.06, 0.12, abs(rel - gm) * r)) * step(9.8, r) * step(r, 12.2) * (1.0 - on) * (1.0 - uE2.y);
        col = mix(col, OCH, tk); al = max(al, tk * 0.9);
        al *= uE.w; if (al < 0.01) discard;
        gl_FragColor = vec4(outc(col), clamp(al, 0.0, 1.0));
      }`, S.eU, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.position.y = 0.06; m.renderOrder = 11; m.visible = false; g.add(m); S.ensoM = m;
  }

  // One Breath: the figure on the floor. One instanced mesh (8 line quads, 9 joint quads, the seal's square border), drawn between the
  // stroke decals and the telegraphs. Per instance: aG0 kind (0 line, 1 joint, 2 border), length, width, seed; aG1 sketch, ink (line: drawn
  // fraction; joint: visited / eye dotted), from (line: inked from its b end), one-way (joint: eye); aG2 vermilion, alpha, dry, blot.
  // Pale wash with a thin darker edge = sketch (harmless); glossy black = the player's stroke; vermilion = the eye and the finished seal.
  const FIG_N = 18;
  function buildFigure(S, g) {
    const fg = new THREE.PlaneGeometry(1, 1); fg.rotateX(-PI / 2);
    const A = iattr(FIG_N, 4), B = iattr(FIG_N, 4), C = iattr(FIG_N, 4); for (const a of [A, B, C]) a.setUsage(THREE.DynamicDrawUsage);
    fg.setAttribute('aG0', A); fg.setAttribute('aG1', B); fg.setAttribute('aG2', C);
    const fm = smat(S.U, `attribute vec4 aG0, aG1, aG2; varying vec2 vL; varying vec4 vA, vB, vC;
      void main(){ vL = vec2(position.x + 0.5, position.z + 0.5); vA = aG0; vB = aG1; vC = aG2; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`, `
      varying vec2 vL; varying vec4 vA, vB, vC;
      void main(){
        float kind = vA.x, len = vA.y, w = vA.z, seed = vA.w, sk = vB.x, ink = vB.y, from = vB.z, ow = vB.w, verm = vC.x, al = vC.y, dry = vC.z, blot = vC.w;
        if (al < 0.003) discard;
        vec3 pale = mix(I4, PAPER, uStorm * 0.85), edgeC = mix(I2, I1, uStorm * 0.4), blk = mix(I0, I0 * vec3(0.9, 0.97, 1.12), uSun);
        vec3 col = pale; float a = 0.0;
        if (kind < 0.5) {
          float u = clamp(vL.y, 0.0, 1.0), xm = u * len, vv = (vL.x - 0.5) * w, wob = (vn(vec2(xm * 0.5, seed)) - 0.5) * 0.08;
          // the sketch, drawn on head to tail; a one-way line is pressed thick at its head and flicked thin at its tail
          float sw = ow > 0.5 ? mix(0.66, 0.14, u) : 0.4, dv = abs(vv + wob) - sw, pax = max(fwidth(vv), 1e-4);
          float shown = 1.0 - smoothstep(sk * len - 0.35, sk * len, xm);
          float body = (1.0 - smoothstep(-pax, pax, dv)) * shown, rim = (1.0 - smoothstep(0.03, 0.03 + max(0.04, pax * 1.5), abs(dv + 0.04))) * shown;
          if (ow > 0.5) { rim *= 1.0 - smoothstep(0.8, 1.0, u) * 0.6; body *= mix(1.0, kas(vec2(xm * 0.2, vv * 0.5 + seed), 0.45), smoothstep(0.55, 1.0, u)); }
          vec3 sc = ow > 0.5 ? mix(pale, I3, 0.55) : pale;
          // the storm wind's wet glint, running head to tail along a one-way line
          float gl = ow > 0.5 ? smoothstep(0.72, 0.96, fract(xm / 3.2 - uTime * 0.85)) * (1.0 - smoothstep(0.0, sw * 0.7, abs(vv + wob))) * body : 0.0;
          sc = mix(sc, PAPER, gl * 0.9);
          float sa = body * (ow > 0.5 ? 0.75 : 0.5) + rim * 0.75;
          col = mix(sc, edgeC, clamp(rim / max(sa, 1e-3), 0.0, 1.0) * 0.85); a = clamp(sa, 0.0, 1.0);
          // the player's stroke: glossy black from the end they set out from, dry-brush toward its end; rain bleeds it a little wider
          float s = from > 0.5 ? 1.0 - u : u, sm = s * len, nA = vn(vec2(sm * 0.35, seed * 7.0));
          float hw = (0.5 + 0.14 * (1.0 - s) + 0.08 * nA) * (1.0 + 0.22 * uStorm) * (1.0 + 0.3 * verm);
          float ib = 1.0 - smoothstep(hw - 0.07 - 0.12 * uStorm, hw, abs(vv + wob * 0.6) + (vn(vec2(sm * 2.0, seed)) - 0.5) * 0.12);
          ib *= 1.0 - smoothstep(ink * len - 0.25, ink * len + 0.02, sm + (vn(vec2(vv * 3.0, seed)) - 0.5) * 0.25);
          ib *= kasA(vec2(sm * 0.08, vv * 0.6 + seed), mix(mix(0.1, 0.5, smoothstep(0.55, 1.0, s)) + dry * 0.12, 0.2, verm)) * step(0.001, ink);
          // a wet sheen, broken along the stroke, only while it is fresh; the seal print is vermilion with the paper's grain in it
          float gls = (1.0 - smoothstep(0.0, 0.1, abs(vv / max(hw, 0.1) + 0.32))) * smoothstep(0.45, 0.7, vn(vec2(sm * 0.6, seed + 3.0))) * (1.0 - dry);
          vec3 vmc = mix(mix(VER, I1, 0.06), mix(VER, PAPER, 0.3), smoothstep(0.5, 0.85, vn(vec2(sm * 1.7, vv * 4.0 + seed))) * 0.7);
          vec3 ic = mix(mix(blk, I3, gls * 0.3), mix(I3, I4, 0.35), dry); ic = mix(ic, vmc, verm);
          col = mix(col, ic, ib); a = max(a * (1.0 - ib), ib);
        } else if (kind < 1.5) {
          vec2 q = (vL - 0.5) * w; float d = length(q), ang = atan(q.x, q.y), e = (vn(vec2(ang * 2.0, seed)) - 0.5) * 0.1;
          float px2 = max(fwidth(d), 1e-4);
          // pale ring and wash where the lines will meet
          float ring = (1.0 - smoothstep(0.035, 0.035 + max(0.035, px2 * 1.5), abs(d - 0.56 - e))) * sk, fill = (1.0 - smoothstep(0.5, 0.56, d + e)) * sk;
          float hide = 1.0 - ink * (1.0 - ow); ring *= hide; fill *= hide; // once the stroke has turned here the sketch ring is gone
          col = mix(pale, edgeC, clamp(ring * 0.75 / max(ring * 0.75 + fill * 0.4, 1e-3), 0.0, 1.0)); a = max(ring * 0.75, fill * 0.4);
          // the eye: a vermilion ring, empty until the stroke ends on it
          if (ow > 0.5) { float er = (1.0 - smoothstep(0.07, 0.07 + max(0.04, px2 * 1.5), abs(d - 0.8 - e))) * sk, dot = (1.0 - smoothstep(0.64 * ink - 0.05, 0.64 * ink, d + e)) * step(0.01, ink);
            col = mix(col, VER, max(er, dot)); a = max(a, max(er, dot) * 0.95); }
          // a corner the stroke has turned (visited), and the glossy blot where the brush is resting
          float vd = (1.0 - smoothstep(0.54, 0.64, d + e * 1.5 + (vn(q * 5.0 + seed) - 0.5) * 0.08)) * ink * (1.0 - ow);
          vec3 vc = mix(mix(blk, mix(I3, I4, 0.35), dry), mix(VER, I1, 0.06), verm); col = mix(col, vc, vd); a = max(a, vd);
          float br = 0.86 + 0.06 * sin(uTime * 5.0), bf = (1.0 - smoothstep(br - 0.08, br, d + (fbm(q * 2.6 + seed) - 0.5) * 0.22)) * blot;
          float gl = 1.0 - smoothstep(0.06, 0.2, length(q - vec2(-0.24, 0.26)) + (vn(q * 9.0 + seed) - 0.5) * 0.06); // one wet glint, not a ring
          col = mix(col, mix(blk, I3, gl * 0.55), bf); a = max(a, bf);
        } else {
          // the seal's border: a rough vermilion square round the figure
          vec2 q = vL; float ed = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)) * len + (vn(q * 22.0 + seed) - 0.5) * 0.22;
          float bd = smoothstep(0.0, 0.06, ed) * (1.0 - smoothstep(0.62, 0.7, ed));
          col = mix(VER, I1, 0.06); a = bd * verm * (0.85 + 0.15 * vn(q * 70.0));
        }
        a *= al; if (a < 0.01) discard;
        gl_FragColor = vec4(outc(col), clamp(a, 0.0, 1.0));
      }`, {}, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5 });
    const m = new THREE.InstancedMesh(fg, fm, FIG_N); m.frustumCulled = false; m.renderOrder = 7; m.visible = false; g.add(m);
    for (let i = 0; i < FIG_N; i++) { _m.position.set(0, -50, 0); _m.rotation.set(0, 0, 0); _m.scale.set(0.001, 1, 0.001); _m.updateMatrix(); m.setMatrixAt(i, _m.matrix); }
    S.figM = { mesh: m, A, B, C };
  }
  function syncFigure(S, b, t, dt) {
    const FM = S.figM, F = S.fig, M = FM.mesh, p = G.player;
    if (!F) { M.visible = false; return; }
    M.visible = true; const n = F.L.length, el = t - F.t0, dl = (FIG_SK - 0.1) / n, A = FM.A, B = FM.B, C = FM.C, done = F.state === 'done', dR = done ? t - F.tR : 0;
    if (!F.vIni) { F.vIni = true; const sd = vrand() * 40;
      for (let i = 0; i < FIG_NL; i++) { if (i < n) { const l = F.L[i], P = F.J[l.a]; _m.position.set(P.x + Math.sin(l.dir) * l.len / 2, 0.035, P.z + Math.cos(l.dir) * l.len / 2); _m.rotation.set(0, l.dir, 0); _m.scale.set(2.2, 1, l.len); A.setXYZW(i, 0, l.len, 2.2, sd + i * 3.7); }
        else { _m.position.set(0, -50, 0); _m.scale.set(0.001, 1, 0.001); A.setXYZW(i, 0, 1, 1, 0); } _m.updateMatrix(); M.setMatrixAt(i, _m.matrix); }
      for (let j = 0; j < FIG_NJ; j++) { const k = FIG_NL + j, P = F.J[j], on = F.used.includes(j); _m.position.set(on ? P.x : 0, on ? 0.037 : -50, on ? P.z : 0); _m.rotation.set(0, 0, 0); _m.scale.set(on ? 2.6 : 0.001, 1, on ? 2.6 : 0.001); _m.updateMatrix(); M.setMatrixAt(k, _m.matrix); A.setXYZW(k, 1, 0, 2.6, sd + j * 5.1); }
      const sq = F.ext * 2 + 3.4; _m.position.set(F.cx, 0.036, F.cz); _m.rotation.set(0, F.th, 0); _m.scale.set(sq, 1, sq); _m.updateMatrix(); M.setMatrixAt(FIG_N - 1, _m.matrix); A.setXYZW(FIG_N - 1, 2, sq, sq, sd);
      M.instanceMatrix.needsUpdate = true; A.needsUpdate = true; }
    // the sketch, one koto pluck per line
    const si = Math.min(n - 1, Math.floor(el / dl)); if (el >= 0 && si > F.vPk) { F.vPk = si; pluck(si + 1, 0.09); }
    // the live line: from the blot toward the player's projection on a line they can ink, shrinking back if they turn round
    let li = -1, lk = 0;
    if (F.state === 'live' && F.cur >= 0 && p) for (const [i, j] of figMoves(F, F.cur, F.mask)) {
      const P = F.J[F.cur], Q = F.J[j], dx = Q.x - P.x, dz = Q.z - P.z, l2 = dx * dx + dz * dz, k = ((p.pos.x - P.x) * dx + (p.pos.z - P.z) * dz) / l2;
      if (k > 0 && k < 1.05 && figSegD(p.pos.x, p.pos.z, P, Q) < 2.4 && k > lk) { lk = k; li = i; } }
    const verm = F.res === 'seal' ? sat(dR / 0.12) : 0, sealA = F.res === 'seal' ? 1 - sat((dR - 1.0) / 5) : 1, dry = done ? sat((dR - 0.6) / 1.8) : 0;
    const fadeA = F.res === 'seal' ? sealA : done ? 1 - sat((dR - 2.2) / 2.2) : 1;
    for (let i = 0; i < FIG_NL; i++) {
      if (i >= n) { C.setXYZW(i, 0, 0, 0, 0); continue; }
      const l = F.L[i]; let ink = 0, from = 0;
      if (l.by) { ink = 1; from = l.from === l.b ? 1 : 0; F.vk[i] = 0; }
      else { F.vk[i] = i === li ? Math.max(F.vk[i], 0) + (Math.min(lk, 0.97) - F.vk[i]) * Math.min(1, dt * 16) : Math.max(0, F.vk[i] - dt * 4); ink = F.vk[i]; from = F.cur === l.b ? 1 : 0; }
      const lineA = l.fT > 0 ? 1 - sat((t - l.fT) / 0.25) : !l.by && done && F.res !== 'fail' ? 1 - sat(dR / 1.2) : 1;
      B.setXYZW(i, sat((el - i * dl) / dl), ink, from, l.ow); C.setXYZW(i, l.by ? verm : 0, fadeA * lineA, l.by ? dry : 0, 0);
    }
    for (let j = 0; j < FIG_NJ; j++) {
      const k = FIG_NL + j; if (!F.used.includes(j)) { C.setXYZW(k, 0, 0, 0, 0); continue; }
      let f0 = n; F.L.forEach((l, i) => { if (l.a === j || l.b === j) f0 = Math.min(f0, i); });
      const visited = F.L.some((l) => l.by && (l.a === j || l.b === j)) ? 1 : 0, eye = j === F.eye ? 1 : 0;
      F.vb[j] = damp(F.vb[j], !done && F.cur === j ? 1 : 0, 10, dt);
      const ink = eye ? (done && F.res === 'seal' ? sat(dR / 0.3) : 0) : visited, eyeA = eye && F.res === 'eyeless' ? 1 - sat(dR / 1.5) : 1;
      B.setXYZW(k, sat((el - f0 * dl) / 0.25), ink, 0, eye); C.setXYZW(k, eye ? 0 : visited ? verm : 0, fadeA * eyeA, dry, F.vb[j]);
    }
    C.setXYZW(FIG_N - 1, F.res === 'seal' ? sat((dR - 0.15) / 0.12) : 0, sealA, 0, 0);
    B.needsUpdate = true; C.needsUpdate = true;
    // the hero drips ink while the brush is down
    if (F.state === 'live' && F.cur >= 0 && p && vrand() < dt * 9) FX.burst(p.pos.x, 0.9, p.pos.z, { n: 1, color: 0x14130f, speed: [0, 0.6], life: [0.3, 0.5], size: [0.08, 0.14], grav: 16, radius: 0.3 });
  }

  // the seal stone that drops on the player in phase two
  function buildSealBlock(S, g) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(7.4, 2.2, 7.4), smat(S.U, `varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, `
      varying vec2 vUv; varying vec3 vN;
      void main(){ float ed = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)); vec3 n = vN / max(length(vN), 1e-4);
        vec3 c = mix(VER * (0.55 + 0.45 * max(n.y, 0.0) + 0.2 * abs(n.x)), I1, 1.0 - smoothstep(0.012, 0.03, ed + (vn(vUv * 40.0) - 0.5) * 0.015));
        c = mix(c, I1, smoothstep(0.62, 0.8, vn(vUv * 12.0)) * 0.25); gl_FragColor = vec4(outc(c), 1.0); }`));
    m.visible = false; g.add(m); S.sealBlock = m;
  }

  // storm rain in depth: three camera-facing sheets of slanted streaks at 4.5, 11 and 26 m, the near one darker and fatter
  function buildRain(S, g) {
    const rg = new THREE.PlaneGeometry(2, 2), aR = iattr(3, 4);
    [[4.5, 0.45, 0.2, 1.3], [11, 0.62, 0.24, 2.9], [26, 0.8, 0.22, 5.1]].forEach(([d, den, al, sd], i) => aR.setXYZW(i, d, den, al, sd));
    rg.setAttribute('aR', aR);
    const rm = smat(S.U, `attribute vec4 aR; varying vec2 vQ; varying vec4 vR;
      void main(){ vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]), fw = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
        float d = aR.x, tx = 1.0 / max(abs(projectionMatrix[0][0]), 1e-3), ty = 1.0 / max(abs(projectionMatrix[1][1]), 1e-3);
        vec3 wp = cameraPosition + fw * d + right * position.x * tx * d * 1.25 + up * position.y * ty * d * 1.7;
        vQ = vec2(position.x * tx * d * 1.25 + atan(fw.x, fw.z + 1e-5) * d, wp.y); vR = aR; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`, `
      varying vec2 vQ; varying vec4 vR;
      void main(){
        if (uStorm < 0.01) discard;
        float d = vR.x, cw = 0.03 + d * 0.011, x = vQ.x + vQ.y * (0.25 + uWind.x * 0.1), X = x / cw, hc = hh(vec2(floor(X), vR.w));
        float sl = 0.8 + d * 0.07, seg = fract(vQ.y / sl * (0.9 + hc * 0.4) + uTime * (2.4 + hc) * (3.0 / sl) + hc * 7.0);
        float r = step(1.0 - vR.y * 0.35, hc) * smoothstep(0.0, 0.06, seg) * (1.0 - smoothstep(0.25, 0.45, seg)) * (1.0 - smoothstep(0.1, 0.42, abs(fract(X) - 0.5)));
        float a = r * vR.z * uStorm; if (a < 0.01) discard;
        gl_FragColor = vec4(outc(mix(I1, I3, smoothstep(5.0, 25.0, d))), a);
      }`, {}, { transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.InstancedMesh(rg, rm, 3); m.frustumCulled = false; m.renderOrder = 60; for (let i = 0; i < 3; i++) m.setMatrixAt(i, _m4.identity()); g.add(m); S.rain = m;
  }

  // full-screen paper: fibre grain and deckle multiplied over everything, plus the wet washes, the roar's spatter, rain, and the scroll mounting
  function buildOverlay(S, g) {
    S.ovU = { uRes: { value: new THREE.Vector2(1280, 720) }, uWash: { value: 0 }, uWashK: { value: 0 }, uSplat: { value: 0 }, uSplatSeed: { value: 0 }, uFrame: { value: 0 }, uSeal: { value: 0 }, uBoltF: { value: 0 }, uBoltX: { value: 0.5 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), smat(S.U, 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', `
      uniform vec2 uRes; uniform float uWash, uWashK, uSplat, uSplatSeed, uFrame, uSeal, uBoltF, uBoltX;
      vec3 Cc = vec3(0.0); float Tt = 1.0;
      void lay(vec3 col, float k){ k = clamp(k, 0.0, 1.0); Cc = Cc * (1.0 - k) + outc(col) * k; Tt *= 1.0 - k; }
      void main(){
        vec2 fc = gl_FragCoord.xy, uv = fc / max(uRes, vec2(1.0)); float asp = uRes.x / max(uRes.y, 1.0); vec2 sp = vec2(uv.x * asp, uv.y);
        if (uStorm > 0.01) { float X = uv.x * asp * 95.0 + uv.y * 30.0 * (0.35 + uGale), hc = hh(vec2(floor(X), 7.0)), seg = fract(uv.y * (1.2 + hc * 1.5) + uTime * (1.4 + hc));
          lay(I2, step(0.93, hc) * smoothstep(0.0, 0.05, seg) * (1.0 - smoothstep(0.2, 0.34, seg)) * (1.0 - smoothstep(0.08, 0.42, abs(fract(X) - 0.5))) * 0.5 * uStorm); }
        // lightning: for a breath the page inverts to bare white paper and the bolt is one black stroke
        if (uBoltF > 0.001) { lay(PAPER, uBoltF * 0.82);
          float by = 1.0 - uv.y, bx = uBoltX * asp + (vn(vec2(by * 7.0, uBoltX * 30.0)) - 0.5) * 0.22 + (vn(vec2(by * 31.0, 5.0)) - 0.5) * 0.045, bw = 0.0035 + 0.005 * uv.y;
          float bolt = (1.0 - smoothstep(bw * 0.5, bw, abs(sp.x - bx))) * smoothstep(0.3, 0.42, uv.y);
          float fx = bx + by * 0.25 - 0.05, fork = (1.0 - smoothstep(bw * 0.3, bw * 0.7, abs(sp.x - fx - (vn(vec2(by * 25.0, 2.0)) - 0.5) * 0.03))) * smoothstep(0.55, 0.62, uv.y) * (1.0 - smoothstep(0.75, 0.8, uv.y));
          lay(I0, max(bolt, fork) * uBoltF); }
        if (uWash > 0.001 && uWash < 0.999) { float x = uv.x + (vn(sp * vec2(2.0, 5.0)) - 0.5) * 0.24 + (vn(sp * 16.0) - 0.5) * 0.04, f = uWash * 2.7 - 0.85;
          float band = (1.0 - smoothstep(f - 0.05, f, x)) * smoothstep(f - 1.05, f - 0.55, x);
          lay(mix(I1, PAPER, uWashK), mix(sqrt(band) * 0.985, band * 0.94, uWashK)); }
        if (uSplat > 0.001) { float s = 0.0;
          for (int i = 0; i < 4; i++) { float fi = float(i); vec2 c = vec2(hh(vec2(fi, uSplatSeed)) * asp, hh(vec2(fi + 5.0, uSplatSeed)) * 0.8 + 0.1); float rr = 0.04 + hh(vec2(fi + 9.0, uSplatSeed)) * 0.07;
            s = max(s, 1.0 - smoothstep(rr - 0.01, rr, length(sp - c) + (vn(sp * 18.0 + fi) - 0.5) * 0.05)); }
          vec2 dg = sp * vec2(22.0, 22.0), di = floor(dg), df = fract(dg) - 0.5; s = max(s, (1.0 - smoothstep(0.1, 0.1 + 0.25 * hh(di + 2.0), length(df))) * step(hh(di + uSplatSeed), 0.12));
          lay(I0, s * uSplat); }
        if (uFrame > 0.001) { float bw = 0.085 * uFrame, dx = min(uv.x, 1.0 - uv.x), dy = min(uv.y, 1.0 - uv.y) * 1.2;
          float pat = smoothstep(0.55, 0.62, vn(sp * vec2(60.0, 60.0))) * 0.5 + smoothstep(0.7, 0.75, vn(sp * 18.0 + 3.0)) * 0.5;
          float side = 1.0 - smoothstep(bw - 0.0015, bw, dx), top = 1.0 - smoothstep(bw * 0.6 - 0.0015, bw * 0.6, dy);
          float m = max(side, top); lay(mix(SILK, SILK2, pat), m); lay(OCH, (1.0 - smoothstep(0.0015, 0.004, abs(min(dx - bw, dy - bw * 0.6)))) * step(0.001, uFrame)); }
        if (uSeal > 0.001) { float sc = 1.0 + (1.0 - smoothstep(0.0, 0.35, uSeal)) * 0.7; vec2 q = (sp - vec2(asp * (1.0 - 0.085 * uFrame) - 0.1, 0.13)) / (0.055 * sc);
          float ed = 1.0 - max(abs(q.x), abs(q.y)) + (vn(q * 9.0) - 0.5) * 0.06; float body = smoothstep(0.0, 0.03, ed);
          float cv = max((1.0 - smoothstep(0.05, 0.1, abs(q.y - 0.35))) * step(abs(q.x), 0.6), max((1.0 - smoothstep(0.05, 0.1, abs(q.x + 0.25))) * step(abs(q.y), 0.65), (1.0 - smoothstep(0.05, 0.1, abs(q.y + 0.25))) * step(-0.2, q.x) * step(q.x, 0.65)));
          cv = max(cv, (1.0 - smoothstep(0.05, 0.1, abs(q.x - 0.4))) * step(-0.25, q.y) * step(q.y, 0.35));
          lay(VER * 1.05, body * (1.0 - cv * 0.9) * smoothstep(0.0, 0.25, uSeal) * (0.85 + 0.15 * vn(q * 25.0))); }
        float fib = vn(fc * vec2(0.9, 0.12)) * 0.55 + vn(fc * vec2(0.13, 0.75) + 31.0) * 0.45, mot = vn(sp * 7.0 + 5.0);
        float gr = (1.0 - 0.06 * smoothstep(0.35, 1.0, fib) - 0.05 * mot) * (1.0 - 0.1 * smoothstep(0.3, 0.75, length((uv - 0.5) * vec2(1.0, 1.25))));
        gl_FragColor = vec4(Cc * gr, clamp(1.0 - Tt * gr, 0.0, 1.0));
      }`, S.ovU, { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }));
    m.frustumCulled = false; m.renderOrder = 9999; g.add(m); S.overlay = m;
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // GARYO: the dragon. The body is one tube rebuilt every frame from 12 posed control points; head, legs and cards ride on it.
  // He is the blackest thing on the page: three tone bands of a loaded brush, wet edges where the stroke turns away, a black spine
  // line, a pale belly wash, and dryness shown as kasure (paper through the stroke), never as a grey body.
  const CP0 = [[0, 2.3, 0.9], [0, 1.95, -0.8], [0.8, 2.0, -2.6], [2.9, 3.1, -3.6], [4.4, 5.0, -4.6], [3.5, 6.6, -5.6], [0.4, 7.0, -6.2], [-2.9, 5.8, -6.6], [-4.7, 3.3, -7.4], [-5.4, 1.7, -9.6], [-6.8, 2.9, -11.6], [-6.6, 5.2, -13.2]];
  const NB = 48, NSP = 96, NTT = 12, NHC = 52, NCARD = NSP + NTT + NHC, NPUFF = 5;
  // a strong belly swell at the shoulders, then a long taper to a thin whip of a tail
  // (r3) the last three rings taper to a point (no flat pipe-end cap)
  const TIP = 3 / (NB - 1);
  const bodyR = (s) => 1.2 * (s < 0.06 ? lerp(0.55, 0.8, s / 0.06) : s < 0.2 ? lerp(0.8, 1.05, smooth((s - 0.06) / 0.14)) : 1.05 * Math.pow(Math.max(0, 1 - (s - 0.2) / 0.8), 1.35) + 0.03) * (s > 1 - TIP ? Math.pow(Math.max(0, (1 - s) / TIP), 0.6) : 1);
  function buildDragon(S, b) {
    const D = S.D = {}, root = D.root = new THREE.Group(); b.group.add(root);
    D.U = { uInk: { value: 1 }, uDraw: { value: 1.2 }, uGrind: { value: 0 }, uFade: { value: 1 }, uFadeH: { value: 1.01 }, uFlat: { value: 0 }, uWetG: { value: 0 }, uNear: { value: 0 }, uLd: { value: new V3(-0.4, 0.8, 0.45).normalize() }, uOut: { value: 0.085 } };
    // aFd: per body ring, 0..1 washed out because it lies on the line to the hero, > 1.5 cut away because it is at the lens
    const SKV = `attribute float aS, aK, aBelly, aFd; attribute vec2 aSc; varying vec3 vN, vW; varying float vS, vK, vBelly, vFd; varying vec2 vSc;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = mat3(modelMatrix) * normal; vS = aS; vK = aK; vBelly = aBelly; vFd = aFd; vSc = aSc; gl_Position = projectionMatrix * viewMatrix * wp; }`;
    const skin = smat(S.U, SKV, `
      uniform float uInk, uDraw, uGrind, uFade, uFadeH, uFlat, uWetG, uNear; uniform vec3 uLd;
      varying vec3 vN, vW; varying float vS, vK, vBelly, vFd; varying vec2 vSc;
      void main(){
        float s = vS; if (s < 1.0 - uDraw || vFd > 1.5) discard;
        // washed out (not dithered) when he hides the hero: the colour runs to pale paper and the stroke turns see-through
        // (r3) the head (and legs) wash to a flat grey I3 at half strength with the silhouette line kept, never a beige ghost
        // near the lens (6-11 m) body, legs and cards wash out the same way, and the washed silhouette softens so no facets show
        float hw = s > 0.1 ? 0.0 : clamp((1.0 - uFadeH) * 1.6, 0.0, 1.0), bw = s > 0.1 ? clamp(vFd, 0.0, 1.0) : 0.0;
        float ww = max(bw, (1.0 - smoothstep(6.0, 11.0, length(cameraPosition - vW))) * uNear * step(0.0, s)), wo = max(ww, hw);
        vec3 n = vN / max(length(vN), 1e-4), vd = cameraPosition - vW; vd /= max(length(vd), 1e-4);
        float ndl = dot(n, uLd) * 0.5 + 0.5, fr = 1.0 - clamp(abs(dot(n, vd)), 0.0, 1.0), nz = vn(vSc * 1.3);
        float al = (1.0 - max(smoothstep(0.0, 0.7, ww) * 0.96, hw * 0.55)) * (1.0 - ww * smoothstep(0.45, 0.95, fr)); // see-through before it greys: diluted ink, not a grey tube
        if (uCut > 0.3 && al < 0.999 && al < ign(gl_FragCoord.xy)) discard;
        // (r3) scales: jittered size and offset, 40% of the cells dropped, so they never read as a tiled chain of rings
        vec2 sc = vSc + vec2(0.0, mod(floor(vSc.x), 2.0) * 0.5), ci = floor(sc); vec2 cf = fract(sc) - 0.5 - (vec2(hh(ci + 3.1), hh(ci + 8.3)) - 0.5) * 0.12;
        float rs = 0.62 + 0.4 * hh(ci + 5.7), keep = step(0.4, hh(ci + 1.9));
        float scale = keep * ((1.0 - smoothstep(0.34 * rs, 0.46 * rs, length(cf * vec2(1.0, 1.3)))) - (1.0 - smoothstep(0.24 * rs, 0.36 * rs, length((cf - vec2(0.14 * rs, 0.0)) * vec2(1.0, 1.3)))));
        float streak = vn(vec2(vSc.x * 0.07, vSc.y * 2.2)), patch_ = smoothstep(0.5, 0.7, vn(vSc * vec2(0.18, 0.5) + 7.0));
        // three bands: black in shadow, charcoal, and a lit band that is still dark ink
        float lit = ndl + (nz - 0.5) * 0.14 + (streak - 0.5) * 0.12;
        float dark = mix(0.98, 0.84, smoothstep(0.46, 0.6, lit)); dark = mix(dark, 0.7, smoothstep(0.7, 0.84, lit) * (0.5 + 0.5 * uWetG));
        dark += scale * 0.08 * patch_ * smoothstep(0.55, 0.8, lit) * (1.0 - vBelly);
        // the belly: a mid-grey wash with plate strokes (never a pale stripe when a coil arches overhead)
        float bp = smoothstep(0.45, 0.9, vBelly) * step(vK, 0.5);
        float plate = 1.0 - smoothstep(0.0, 0.12, abs(fract(vSc.x * 0.5) - 0.5) - 0.36);
        dark = mix(dark, 0.52 + plate * 0.3, bp);
        // wet edge: pigment pools where the stroke turns away from the eye
        dark = max(dark, smoothstep(0.4, 0.78, fr) * 0.99);
        // the spine line stays black at every ink level
        float spine = (1.0 - smoothstep(0.45, 0.9, min(vSc.y, 9.0 - vSc.y))) * step(0.0, s) * step(vK, 0.5);
        dark = max(dark, spine * 0.99);
        // dry brush: paper shows through in streaks along the body, more as the ink runs low and toward the tail
        // (r3) hair streaks stretched ~20:1 along the body (vSc.x is ~2.8 per metre) and cut by a low-frequency mask so none runs much past
        // 2 m. At full ink they only lift to I2; paper shows only when the ink is low (< ~0.45) or in the last quarter of the tail.
        float flank = (1.0 - spine) * (1.0 - smoothstep(0.7, 0.92, fr)) * step(0.0, s) * step(vK, 0.5);
        float hn = hairN(vSc), sm = smoothstep(0.42, 0.62, vn(vec2(vSc.x * 0.42 + 5.0, vSc.y * 1.1 + 2.0)));
        float hairM = smoothstep(0.62, 0.72, hn) * sm;
        float amt = smoothstep(0.55, 1.0, s) * 0.42 + (1.0 - uInk) * 0.42;
        float kasM = (1.0 - smoothstep(amt - 0.06, amt + 0.06, hn)) * mix(sm, 1.0, smoothstep(0.88, 1.0, s) * 0.7);
        float paperOK = max(1.0 - smoothstep(0.35, 0.5, uInk), smoothstep(0.72, 0.8, s));
        dark = mix(dark, min(dark, 0.56), hairM * flank * 0.85);
        dark = mix(dark, min(dark, mix(0.56, 0.14 + dark * 0.2, paperOK)), kasM * flank);
        // the tail tip frays away in ragged dry hairs (no clean ring cut)
        if (s > 0.8 && tailEr(vSc) < smoothstep(0.8, 1.0, s) * 0.85) discard;
        if (s > 0.0) dark = mix(dark, 1.0, smoothstep(1.0 - uGrind, 1.04 - uGrind, s) * step(0.001, uGrind) * 0.92);
        dark = mix(dark, 1.0, (1.0 - smoothstep(0.0, 0.05, s - (1.0 - uDraw))) * step(uDraw, 1.04) * 0.9);
        if (vK > 0.5 && vK < 1.5) dark = 0.62 + 0.3 * (1.0 - ndl) + smoothstep(0.5, 0.85, fr) * 0.4 - (1.0 - smoothstep(0.0, 0.1, abs(fract(vSc.x * 0.8) - 0.5))) * 0.25;
        if (vK > 1.5 && vK < 2.5) dark = 0.08 + smoothstep(0.62, 0.92, fr) * 0.85;
        if (vK > 2.5) dark = 0.98;
        dark = mix(dark, 0.42 - kasM * 0.2 + smoothstep(0.6, 0.9, fr) * 0.3, uFlat);
        vec3 c = tone(1.0 - clamp(dark, 0.0, 1.0), nz);
        vec3 rf = reflect(-vd, n); c = mix(c, I3, smoothstep(0.9, 0.97, dot(rf, uLd)) * uWetG * step(vK, 0.5) * (1.0 - uFlat));
        // the finale: a warm rim on the lit side and flecks of gold leaf
        if (uSun > 0.002) { float sk = uSun * step(vK, 0.5) * (1.0 - uFlat);
          // neutral ink under the warm dawn grade, and the warm light only as a thin rim on the silhouette
          c = mix(c, vec3(dot(c, vec3(0.3333))) * vec3(0.97, 0.99, 1.04), 0.75 * uSun);
          c = mix(c, GLD, smoothstep(0.8, 0.9, fr) * (1.0 - smoothstep(0.95, 1.0, fr)) * smoothstep(0.5, 0.8, ndl) * 0.55 * sk);
          vec2 gq = vSc * vec2(1.6, 2.4), gi = floor(gq), gf = fract(gq) - 0.5 + (vec2(hh(gi + 1.3), hh(gi + 2.9)) - 0.5) * 0.4;
          float fl = step(hh(gi + 7.7), 0.04) * (1.0 - smoothstep(0.06, 0.13 + 0.05 * hh(gi), length(gf * vec2(1.0, 1.7))));
          c = mix(c, mix(GLD, OCH, hh(gi + 2.0) * 0.5), fl * sk * (1.0 - bp)); }
        // fallen petals settle only on what faces up
        if (uPetal > 0.002) { vec2 pq = vSc * vec2(0.55, 0.9), pi = floor(pq), pf = fract(pq) - 0.5 - (vec2(hh(pi + 1.1), hh(pi + 2.2)) - 0.5) * 0.4;
          float ro = hh(pi + 5.5) * 3.14159; pf = mat2(cos(ro), -sin(ro), sin(ro), cos(ro)) * pf;
          float pet = step(hh(pi + 3.7), 0.3 * uPetal) * (1.0 - smoothstep(0.2, 0.27, length(pf * vec2(1.0, 1.8)))) * smoothstep(0.35, 0.7, n.y) * step(vK, 0.5) * step(0.0, s);
          c = mix(c, mix(mix(PAPER, PK, 0.6), PK2, hh(pi) * 0.7 + pf.x), pet); }
        c = mix(c, I3, hw); c = mix(c, mix(I4, PAPER, 0.5), ww * ww * 0.85);
        gl_FragColor = vec4(outc(c), al);
      }`, D.U, { alphaToCoverage: A2C() });
    const outl = smat(S.U, `attribute float aS, aK, aFd; attribute vec2 aSc; uniform float uOut; varying float vS, vFd; varying vec2 vSc; varying vec3 vN2, vW2;
      void main(){ float w = uOut * (0.6 + 0.4 * sin(aSc.x * 0.37 + aSc.y * 0.9) + 0.35 * sin(aSc.x * 1.3)) * (1.0 - clamp(aS, 0.0, 1.0) * 0.75) * (aK > 1.5 && aK < 2.5 ? 0.4 : 1.0);
        vS = aS; vFd = aFd; vSc = aSc; vN2 = mat3(modelMatrix) * normal; vec4 wp = modelMatrix * vec4(position + normal * w, 1.0); vW2 = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`, `
      uniform float uDraw, uFade, uFadeH, uFlat, uNear; varying float vS, vFd; varying vec2 vSc; varying vec3 vN2, vW2;
      void main(){ if (vS < 1.0 - uDraw || vFd > 1.5) discard;
        // faded: only the rim of the hull is left, a faint drawn contour
        // (r3) near the lens (6-11 m) a coil washes out smoothly instead of standing as a black wall in the foreground; the pale head keeps its line
        float hw = vS > 0.1 ? 0.0 : clamp((1.0 - uFadeH) * 1.6, 0.0, 1.0), ww = max(vS > 0.1 ? clamp(vFd, 0.0, 1.0) : 0.0, (1.0 - smoothstep(6.0, 11.0, length(cameraPosition - vW2))) * uNear * step(0.0, vS));
        vec3 n = vN2 / max(length(vN2), 1e-4), v = cameraPosition - vW2; v /= max(length(v), 1e-4);
        float rimO = 1.0 - smoothstep(0.25, 0.6, abs(dot(n, v)));
        float al = min(mix(1.0, 0.22 * rimO, ww), mix(1.0, 0.9 * rimO, hw));
        if (al < 0.01 || (uCut > 0.3 && al < 0.999 && al < ign(gl_FragCoord.xy + 3.0))) discard;
        if (vS > 0.8 && tailEr(vSc) < smoothstep(0.8, 1.0, vS) * 0.85) discard;
        gl_FragColor = vec4(outc(mix(I0, I2, uFlat)), al); }`, D.U, { side: THREE.BackSide, alphaToCoverage: A2C() });
    D.skin = skin; D.outl = outl;
    // body tube
    const TS = 16, tb = D.tube = new TubeBuf(NB, TS), vcount = NB * (TS + 1), aS = new Float32Array(vcount), aK = new Float32Array(vcount), aSc = new Float32Array(vcount * 2), aBe = new Float32Array(vcount);
    for (let i = 0; i < NB; i++) for (let j = 0; j <= TS; j++) { const v = i * (TS + 1) + j, s = i / (NB - 1), f = j / TS * TAU; aS[v] = s; aSc[v * 2] = s * 78; aSc[v * 2 + 1] = j / TS * 9; aBe[v] = sat(-Math.cos(f)); }
    tb.geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1)); tb.geo.setAttribute('aK', new THREE.BufferAttribute(aK, 1)); tb.geo.setAttribute('aSc', new THREE.BufferAttribute(aSc, 2)); tb.geo.setAttribute('aBelly', new THREE.BufferAttribute(aBe, 1));
    D.fd = new THREE.BufferAttribute(new Float32Array(vcount), 1).setUsage(THREE.DynamicDrawUsage); tb.geo.setAttribute('aFd', D.fd); D.fdV = new Float32Array(NB); D.fdT = new Float32Array(NB); D.ts = TS;
    D.cp = CP0.map((c) => new V3(...c)); D.cpRaw = CP0.map((c) => new V3(...c)); D.C = []; for (let i = 0; i < NB; i++) D.C.push(new V3());
    D.duck = new Float32Array(12); D.duckT = new Float32Array(12);
    const body = new THREE.Mesh(tb.geo, skin), bodyO = new THREE.Mesh(tb.geo, outl); body.frustumCulled = bodyO.frustumCulled = false; root.add(body, bodyO);
    // head (neck joint at the origin, +Z forward)
    const H = []; const add = (geo, k) => H.push([geo, k]);
    add(T(new THREE.SphereGeometry(0.72, 26, 18), 0, 0.28, 0.35, 0, 0, 0, 0.95, 0.78, 1.15), 0);
    // a long, narrow muzzle (a dragon, not an ox), a raised brow ridge over the eyes
    add(T(new THREE.CylinderGeometry(0.3, 0.52, 2.0, 22, 4), 0, 0.1, 1.62, PI / 2 + 0.07, 0, 0, 0.7, 1, 0.66), 0);
    add(T(new THREE.SphereGeometry(0.46, 18, 12), 0, 0.15, 2.62, 0, 0, 0, 0.76, 0.56, 0.7), 0);
    add(T(new THREE.SphereGeometry(0.4, 16, 10), 0, 0.76, 0.6, 0.3, 0, 0, 0.75, 0.5, 1.25), 0); // forehead ridge
    for (const sx of [-1, 1]) {
      add(T(new THREE.SphereGeometry(0.1, 8, 6), sx * 0.15, 0.3, 2.9), 3);
      add(T(new THREE.SphereGeometry(0.3, 14, 10), sx * 0.36, 0.66, 0.98, 0, sx * 0.25, 0, 1.1, 0.6, 1.5), 0);
      add(T(new THREE.SphereGeometry(0.17, 12, 10), sx * 0.43, 0.4, 1.12, 0, 0, 0, 0.8, 0.85, 1.2), 2);
      add(T(new THREE.SphereGeometry(0.16, 10, 8), sx * 0.42, 0.74, 1.22, 0, sx * 0.3, sx * 0.4, 1.5, 0.5, 0.95), 3); // brow: a black stroke over the eye
      add(T(new THREE.ConeGeometry(0.075, 0.46, 6), sx * 0.22, -0.26, 2.32, PI, 0, 0), 2);
      // (r3) separate, uneven fangs (no zigzag), an upper lip line that curls up at the corner, a nostril stroke
      const FU = sx < 0 ? [[1.95, 0.24, 0.05, 0.1], [1.52, 0.33, 0.062, -0.18], [1.2, 0.13, 0.04, 0.05]] : [[1.88, 0.18, 0.045, -0.08], [1.58, 0.36, 0.065, -0.22], [1.24, 0.16, 0.042, 0.12]];
      for (const [z, l, r, tl] of FU) add(T(new THREE.ConeGeometry(r, l, 6), sx * (0.255 - (2.1 - z) * 0.03), -0.1 - l * 0.35, z, PI + tl, 0, sx * 0.08), 2);
      add(taper([[sx * 0.22, -0.08, 2.82], [sx * 0.33, -0.15, 2.25], [sx * 0.37, -0.13, 1.6], [sx * 0.39, 0.0, 1.22], [sx * 0.34, 0.16, 1.12]], 0.05, 0.018, 6, 12), 3);
      add(taper([[sx * 0.08, 0.35, 2.86], [sx * 0.2, 0.39, 2.73], [sx * 0.28, 0.35, 2.58]], 0.042, 0.014, 5, 6), 3);
      add(orient(new THREE.ConeGeometry(0.26, 1.4, 8), sx * 0.75, 0.0, -0.05, sx * 0.6, 0.1, -1, 1, 1, 0.42), 0); // cheek frill
      add(taper([[sx * 0.3, 0.72, 0.35], [sx * 0.5, 1.15, -0.2], [sx * 0.72, 1.55, -0.9], [sx * 0.8, 1.85, -1.65]], 0.14, 0.025, 7), 1);
      add(taper([[sx * 0.55, 1.25, -0.35], [sx * 0.92, 1.7, -0.15], [sx * 1.08, 2.05, 0.25]], 0.075, 0.02, 6, 7), 1);
    }
    const head = D.head = new THREE.Group(); head.scale.setScalar(1.3); root.add(head);
    const hg = mergeParts(H), hm = new THREE.Mesh(hg, skin), ho = new THREE.Mesh(hg, outl); head.add(hm, ho);
    const J = []; const addJ = (geo, k) => J.push([geo, k]);
    addJ(T(new THREE.CylinderGeometry(0.24, 0.38, 1.8, 16, 2), 0, -0.1, 0.9, PI / 2, 0, 0, 0.72, 1, 0.55), 0);
    addJ(T(new THREE.SphereGeometry(0.3, 12, 8), 0, -0.08, 1.8, 0, 0, 0, 0.72, 0.5, 0.8), 0);
    addJ(T(new THREE.BoxGeometry(0.26, 0.05, 1.4), 0, 0.06, 0.95), 3);
    for (const sx of [-1, 1]) for (const [z, l, r] of (sx < 0 ? [[1.72, 0.3, 0.058], [1.22, 0.15, 0.042]] : [[1.66, 0.26, 0.052], [1.3, 0.12, 0.038]])) addJ(T(new THREE.ConeGeometry(r, l, 6), sx * 0.17, 0.04 + l * 0.4, z, -0.12, 0, -sx * 0.06), 2);
    const jaw = D.jaw = new THREE.Group(); jaw.position.set(0, -0.12, 0.55); head.add(jaw);
    const jg = mergeParts(J); jaw.add(new THREE.Mesh(jg, skin), new THREE.Mesh(jg, outl));
    // eyes: blank until the dot; then the only saturated thing on him
    const pm = new THREE.MeshBasicMaterial({ color: hdr(VERM, new THREE.Color()).multiplyScalar(1.7), fog: false }); D.pupils = [];
    for (const sx of [-1, 1]) { const pu = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), pm); pu.position.set(sx * 0.555, 0.43, 1.15); pu.scale.set(0.5, 1, 0.7); head.add(pu); D.pupils.push(pu); }
    // whiskers: two long S-curved strokes, rebuilt each frame
    const NW = 22;
    D.wh = [-1, 1].map((sx) => { const t = new TubeBuf(NW, 5), n = NW * 6; const s2 = new Float32Array(n).fill(-0.05), k2 = new Float32Array(n).fill(3), sc2 = new Float32Array(n * 2), be = new Float32Array(n);
      t.geo.setAttribute('aS', new THREE.BufferAttribute(s2, 1)); t.geo.setAttribute('aK', new THREE.BufferAttribute(k2, 1)); t.geo.setAttribute('aSc', new THREE.BufferAttribute(sc2, 2)); t.geo.setAttribute('aBelly', new THREE.BufferAttribute(be, 1)); t.geo.setAttribute('aFd', new THREE.BufferAttribute(new Float32Array(n), 1));
      const m = new THREE.Mesh(t.geo, skin); m.frustumCulled = false; head.add(m); return { t, sx, P: Array.from({ length: NW }, () => new V3()) }; });
    // legs in a bent Z (upper limb back, forearm forward), three splayed black claws
    const leg = (sx, fore) => { const L = [], k = fore ? 1.3 : 1.05;
      L.push([taper([[0, 0, 0], [sx * 0.12, -0.45 * k, -0.28 * k], [sx * 0.16, -0.86 * k, -0.42 * k]], 0.42 * k, 0.27 * k, 8, 8), 0]);
      L.push([taper([[sx * 0.16, -0.86 * k, -0.42 * k], [sx * 0.15, -1.18 * k, -0.02 * k], [sx * 0.12, -1.42 * k, 0.36 * k]], 0.27 * k, 0.17 * k, 8, 8), 0]);
      L.push([T(new THREE.SphereGeometry(0.2 * k, 10, 8), sx * 0.12, -1.48 * k, 0.44 * k, 0, 0, 0, 1.15, 0.7, 1.3), 0]);
      for (let c = 0; c < 3; c++) { const a = (c - 1) * 0.62 + sx * 0.1, dx = Math.sin(a), dz = Math.cos(a), x0 = sx * 0.12, y0 = -1.5 * k, z0 = 0.5 * k;
        L.push([taper([[x0, y0, z0], [x0 + dx * 0.32 * k, y0 - 0.06 * k, z0 + dz * 0.32 * k], [x0 + dx * 0.58 * k, y0 - 0.38 * k, z0 + dz * 0.5 * k]], 0.075 * k, 0.012, 5, 6), 3]); }
      L.push([orient(new THREE.ConeGeometry(0.16 * k, 0.75 * k, 6), sx * 0.2, -0.86 * k, -0.62 * k, sx * 0.3, 0.25, -1, 1, 1, 0.35), 3]); // elbow tuft
      const g2 = mergeParts(L, 0.03), grp = new THREE.Group(); grp.add(new THREE.Mesh(g2, skin), new THREE.Mesh(g2, outl)); root.add(grp); return grp; };
    D.fore = [leg(-1, true), leg(1, true)]; D.hind = [leg(-1, false), leg(1, false)];
    // stroke cards: 96 spines flying back along the ridge, a 12-stroke tail tuft, and in head space a 40-stroke mane and a 12-stroke beard
    const cg = new THREE.PlaneGeometry(1, 1); cg.translate(0, 0.5, 0); const aCd = iattr(NCARD, 4), rng = mulberry(17);
    for (let i = 0; i < NCARD; i++) aCd.setXYZW(i, rng(), rng() * 10, i < NSP ? 0.03 + i / (NSP - 1) * 0.92 : i < NSP + NTT ? 0.97 : -0.05, 0);
    cg.setAttribute('aCd', aCd); aCd.setUsage(THREE.DynamicDrawUsage); D.aCd = aCd;
    const cm = smat(S.U, `attribute vec4 aCd; varying vec2 vUv; varying vec4 vCd; varying vec3 vWc; void main(){ vUv = vec2(position.x + 0.5, position.y); vCd = aCd; vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vWc = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`, `
      uniform float uDraw, uFlat, uInk, uFade, uFadeH, uNear; varying vec2 vUv; varying vec4 vCd; varying vec3 vWc;
      void main(){ if (vCd.z < 1.0 - uDraw || vCd.w > 1.5) discard;
        float wo = vCd.z > 0.1 ? max(clamp(vCd.w, 0.0, 1.0), (1.0 - smoothstep(6.0, 11.0, length(cameraPosition - vWc))) * uNear) : clamp((1.0 - uFadeH) * 1.6, 0.0, 1.0);
        float v = clamp(vUv.y, 0.0, 1.0), bend = sin(v * 2.6 + vCd.y) * 0.13 * v, hw = 0.5 * pow(1.0 - v, 0.7) * (0.75 + 0.25 * sin(v * 3.14159));
        float a = 1.0 - smoothstep(hw - 0.08, hw, abs(vUv.x - 0.5 - bend)); a *= kas(vec2(v * 0.6 + vCd.y, vUv.x * 0.7), 0.1 + 0.45 * v + (1.0 - uInk) * 0.2);
        float al = 1.0 - wo * 0.96; if (a < uCut || (uCut > 0.3 && al < 0.999 && al < ign(gl_FragCoord.xy + 5.0))) discard; a *= al;
        float dark = mix(0.98, 0.45, uFlat) * (0.92 + 0.08 * vCd.x) - v * 0.12;
        gl_FragColor = vec4(outc(mix(tone(1.0 - dark, vCd.x), mix(I4, PAPER, 0.5), wo * 0.85)), a); }`, D.U, { side: THREE.DoubleSide, alphaToCoverage: A2C() });
    D.cards = new THREE.InstancedMesh(cg, cm, NCARD); D.cards.frustumCulled = false; root.add(D.cards);
    // head cards in head space: base position, euler, scale
    D.hc = []; const r2 = mulberry(23);
    for (let i = 0; i < NHC; i++) {
      if (i < 40) { const sx = i % 2 ? 1 : -1, k = Math.floor(i / 2), u = k / 19;
        D.hc.push({ p: new V3(sx * (0.2 + u * 0.22 + r2() * 0.08), 0.62 - u * 1.1 + r2() * 0.1, 0.25 - u * 2.7), e: new THREE.Euler(-1.45 - u * 0.15 + (r2() - 0.5) * 0.3, sx * (0.35 + r2() * 0.55), sx * (0.25 + r2() * 0.3)), s: new V3(0.32 + r2() * 0.2, 1.7 + r2() * 1.8 - u * 0.3, 1), ph: r2() * TAU }); } // (r3) the mane runs further back over the neck
      else { const k = i - 40, sx = k % 2 ? 1 : -1;
        D.hc.push({ p: new V3(sx * (0.08 + (k >> 1) * 0.04), -0.38, 1.35 - (k >> 1) * 0.13), e: new THREE.Euler(PI + 0.45 + r2() * 0.35, 0, sx * (0.15 + r2() * 0.2)), s: new V3(0.2 + r2() * 0.08, 0.8 + r2() * 0.9, 1), ph: r2() * TAU }); }
    }
    // ink mist: pale cloud puffs with a grey wet edge that the coils pass in and out of, as in a dragon scroll
    const pg = new THREE.PlaneGeometry(2, 2), aPf = iattr(NPUFF, 4), rp = mulberry(31);
    D.puff = []; for (let i = 0; i < NPUFF; i++) { const bi = 12 + Math.round(i / (NPUFF - 1) * 31); D.puff.push({ bi, side: i % 2 ? 1 : -1, up: (rp() - 0.5) * 1.6, sz: 2.0 + rp() * 1.6 }); aPf.setXYZW(i, rp() * 30, bi / (NB - 1), 0, 0); }
    pg.setAttribute('aPf', aPf);
    const pfm = smat(S.U, `attribute vec4 aPf; varying vec2 vUv; varying vec4 vPf; varying float vNear;
      void main(){ vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float sz = length(instanceMatrix[0].xyz);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 wp = c.xyz + (right * position.x + up * position.y * 0.62) * sz; vUv = position.xy; vPf = aPf; vNear = smoothstep(9.0, 13.0, length(c.xyz - cameraPosition));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`, `
      uniform float uDraw, uFade, uFlat; varying vec2 vUv; varying vec4 vPf; varying float vNear;
      void main(){ if (vPf.y < 1.0 - uDraw + 0.05 || vNear < 0.004) discard;
        // (r3) a soft two-tone wash, no linework: pale on top, a tone darker below, one wet edge along the lower side only
        float e = length(vUv * vec2(1.0, 1.15)) + (fbm(vUv * 1.4 + vPf.x) - 0.5) * 0.6;
        float body = 1.0 - smoothstep(0.42, 0.82, e), low = smoothstep(0.15, -0.55, vUv.y + (vn(vec2(vUv.x * 2.0, vPf.x)) - 0.5) * 0.3);
        float wet = (smoothstep(0.55, 0.66, e) - smoothstep(0.68, 0.8, e)) * low;
        float a = (body * 0.72 + wet * 0.2) * vNear * clamp(uFade, 0.0, 1.0) * (1.0 - uFlat);
        if (a < 0.01) discard;
        vec3 c = mix(mix(PAPER, I4, uStorm * 0.6), mix(I4, I3, 0.35 + uStorm * 0.3), low * 0.7);
        c = mix(c, I3, wet * 0.6);
        gl_FragColor = vec4(outc(c), a); }`, D.U, { transparent: true, depthWrite: false });
    D.puffs = new THREE.InstancedMesh(pg, pfm, NPUFF); D.puffs.frustumCulled = false; D.puffs.renderOrder = 4; root.add(D.puffs);
    D.pose = { rear: 0, rake: 0, whip: 0, whipS: 1, slump: 0, sweep: 0, sweepA: 0, roar: 0, dive: 0 };
    D.t = 0; D.fadeA = 1; D.fadeH = 1;
  }

  // pose the 12 control points, sample the body, rebuild the tube, place head, legs, whiskers, cards
  const _cr = (p0, p1, p2, p3, t, out) => { const t2 = t * t, t3 = t2 * t; return out.set(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)); };
  function poseDragon(S, b, dt) {
    const D = S.D, P = D.pose, t = D.t, cp = D.cp, n = cp.length;
    for (let j = 0; j < n; j++) {
      const s = j / (n - 1), c = CP0[j]; let x = c[0], y = c[1], z = c[2];
      x += Math.sin(t * 1.05 + j * 0.85) * 0.45 * s; y += Math.sin(t * 0.8 + j * 0.7 + 1.0) * 0.35 * s + Math.sin(t * 1.6) * 0.05;
      if (j < 4) { y += P.rear * [2.6, 1.8, 0.8, 0.3][j]; z += P.rear * [-0.7, -0.9, -0.5, -0.1][j]; } else y -= P.rear * 0.6 * s;
      if (j < 3) { z += P.rake * [0.9, 0.6, 0.25][j]; y -= P.rake * [0.35, 0.2, 0][j]; }
      if (j >= 5) { const w = (j - 5) / 6; x += P.whip * P.whipS * w * w * 6.0 * Math.sin(t * 9 - j * 0.8 + 1.5); }
      y = lerp(y, Math.max(0.7, y * 0.35 + 0.6), P.slump); if (j === 0) y -= P.slump * 0.5;
      const sw = P.sweep * smooth((j - 1.5) / 2); if (sw > 0.001) { const a = P.sweepA + j * 0.66; x = lerp(x, Math.sin(a) * 7.2, sw); y = lerp(y, 8.5 + Math.sin(a * 2) * 0.5 + (j - 6) * 0.15, sw); z = lerp(z, Math.cos(a) * 7.2, sw); }
      D.cpRaw[j].set(x, y, z);
      // a coil that would hide the hero, or crowd the lens, sinks low and flat out of the way
      const dk = D.duck[j]; if (dk > 0.001) y = lerp(y, 0.4, dk);
      cp[j].set(x, y, z);
    }
    for (let i = 0; i < NB; i++) { const u = i / (NB - 1) * (n - 1), k = Math.min(n - 2, Math.floor(u)), f = u - k; _cr(cp[Math.max(0, k - 1)], cp[k], cp[k + 1], cp[Math.min(n - 1, k + 2)], f, D.C[i]); }
    D.tube.build(D.C, (i) => bodyR(i / (NB - 1)) * (1 + P.roar * 0.04 * Math.sin(t * 30 + i)));
    // head on the neck, looking along the forebody; lower it toward the player when rearing
    const C = D.C, Tn = D.tube.T, N = D.tube.N, B = D.tube.B; D.head.position.copy(C[0]);
    _d.copy(Tn[0]).multiplyScalar(-1); _d.y -= P.rear * 0.55 - P.roar * 0.35 + P.slump * 0.4; _d.normalize(); D.head.quaternion.setFromUnitVectors(_Z, _d);
    D.jaw.rotation.x = 0.1 + P.roar * 0.6 + Math.max(0, Math.sin(t * 0.7)) * 0.05;
    // forelegs at the chest, hind legs on the first coil
    const ci = 4, hi = 17;
    D.fore.forEach((L, k) => { const sx = k ? 1 : -1; L.position.set(C[ci].x + sx * 0.78, C[ci].y - 0.4, C[ci].z + 0.2); L.rotation.set(-(k === (P.whipS > 0 ? 1 : 0) ? P.rake * 1.25 : P.rake * 0.3) - P.rear * 0.7 + P.slump * 0.5 + Math.sin(t * 1.1 + k * 2) * 0.08, 0, sx * (0.12 + P.slump * 0.4)); });
    D.hind.forEach((L, k) => { const sx = k ? 1 : -1, Ni = N[hi], Bi = B[hi], r = bodyR(hi / (NB - 1)); L.position.copy(C[hi]).addScaledVector(Bi, sx * r * 0.8).addScaledVector(Ni, -r * 0.5); L.rotation.set(0.5 + Math.sin(t * 1.3 + k) * 0.15, 0, sx * 0.25); });
    // whiskers: from the snout, two long S-curves trailing back and waving
    for (const w of D.wh) { const P2 = w.P, m = P2.length; for (let k = 0; k < m; k++) { const u = k / (m - 1);
      P2[k].set(w.sx * (0.22 + u * 1.7 + Math.sin(u * 4.4 - t * 2.1) * 0.45 * u), 0.1 - u * 0.9 + Math.sin(u * 6.0 - t * 1.6) * 0.45 * u, 2.7 - u * 5.4 + Math.sin(u * 3.0 - t * 1.3) * 0.2 * u); }
      w.t.build(P2, (i) => 0.1 * Math.pow(1 - i / m, 0.8) + 0.012); }
    // cards: spines flying back along the ridge, alternating sides, fluttering
    const I = D.cards;
    for (let i = 0; i < NSP; i++) { const u = i / (NSP - 1), bi = Math.min(NB - 3, 1 + Math.round(u * (NB - 5))), r = bodyR(bi / (NB - 1)), sd = i % 2 ? 1 : -1, fl = Math.sin(t * 3.4 + i * 0.7) * 0.22;
      _a.copy(N[bi]).multiplyScalar(Math.cos(0.42)).addScaledVector(B[bi], sd * Math.sin(0.42)); // up and a little to one side
      _p.copy(C[bi]).addScaledVector(_a, r * 0.82);
      _a.multiplyScalar(0.6).addScaledVector(Tn[bi], 0.9).addScaledVector(B[bi], sd * 0.18 + fl).normalize();
      _d.crossVectors(Tn[bi], _a); if (_d.lengthSq() < 1e-6) _d.set(1, 0, 0); _d.normalize(); _b.crossVectors(_a, _d);
      _m4.makeBasis(_d, _a, _b); _m4.scale(_s.set(0.28 + r * 0.32, (0.55 + r * 1.75) * (0.75 + 0.5 * fract1(i * 0.618)), 1)); _m4.setPosition(_p); I.setMatrixAt(i, _m4); }
    for (let i = 0; i < NTT; i++) { const bi = NB - 1, a = (i - (NTT - 1) / 2) * 0.24, fl = Math.sin(t * 4.1 + i) * 0.2;
      _a.copy(Tn[bi]).addScaledVector(B[bi], Math.sin(a) * 1.3 + fl).addScaledVector(N[bi], Math.cos(a) * 0.35).normalize(); _d.crossVectors(_a, N[bi]); if (_d.lengthSq() < 1e-6) _d.set(1, 0, 0); _d.normalize(); _b.crossVectors(_d, _a);
      _m4.makeBasis(_d, _a, _b); _m4.scale(_s.set(0.5, 1.6 + (i % 3) * 0.5, 1)); _m4.setPosition(C[bi]); I.setMatrixAt(NSP + i, _m4); }
    D.head.updateMatrix();
    for (let i = 0; i < NHC; i++) { const h = D.hc[i]; _m.position.copy(h.p); _m.rotation.set(h.e.x + Math.sin(t * 2.6 + h.ph) * 0.1, h.e.y + Math.sin(t * 1.9 + h.ph) * 0.08, h.e.z); _m.scale.copy(h.s); _m.updateMatrix();
      _m42.multiplyMatrices(D.head.matrix, _m.matrix); I.setMatrixAt(NSP + NTT + i, _m42); }
    I.instanceMatrix.needsUpdate = true;
    // mist puffs beside the coils
    for (let i = 0; i < NPUFF; i++) { const q = D.puff[i], bi = q.bi, r = bodyR(bi / (NB - 1)); _p.copy(C[bi]).addScaledVector(B[bi], q.side * (r + 0.5)).addScaledVector(N[bi], q.up * r);
      _p.y = Math.max(_p.y, 0.6); _m4.makeScale(q.sz, q.sz, q.sz); _m4.setPosition(_p); D.puffs.setMatrixAt(i, _m4); }
    D.puffs.instanceMatrix.needsUpdate = true;
  }
  const fract1 = (x) => x - Math.floor(x);

  // ---------------------------------------------------------------------------------------------------------------------
  const MELEE_PTS = [[0, 2.6, 1.4], [1.8, -3.0, 1.4]];
  function build(b) {
    const g = G.world, S = b.state, low = G.q.part < 0.5;
    { const cu = Post.final && Post.final.uniforms.uChroma; if (cu) { const was = cu.value; cu.value = 0; g.addEventListener('removed', () => { cu.value = was; }); } }
    S.U = { uTime: { value: 0 }, uReveal: { value: 1 }, uStorm: { value: 0 }, uSun: { value: 0 }, uBloom: { value: 0 }, uPetal: { value: 0 }, uGale: { value: 0 }, uCut: { value: A2C() ? 0.04 : 0.5 }, uWind: { value: new THREE.Vector2(0.25, 0.08) } };
    scene.fog = new THREE.FogExp2(hdr(0xefe7d3, new THREE.Color()), 0.004); S.fog = scene.fog;
    { const sk = W.sky({ top: 0xe8dfc8, horizon: 0xefe7d3, bottom: 0xa89f8a, sunGlow: 0, sunSize: 0 }); W.env(sk, 0.35); sk.geometry.dispose(); sk.material.dispose(); }
    S.hemi = W.hemi(g, 0xfff4e2, 0x9a907c, 1.25);
    S.sun = W.sun(g, { dir: [-0.5, 0.8, 0.45], color: 0xfff0dc, intensity: 1.3, shadow: false });
    buildSky(S, g); buildGround(S, g); buildMountains(S, g); buildMist(S, g, low); buildMid(S, g); buildBamboo(S, g, low); buildTree(S, g, low); buildBirds(S, g);
    buildDecals(S, g); buildFigure(S, g); buildBulletQuads(S, g); buildTele(S, g); buildEnso(S, g); buildRain(S, g); buildSealBlock(S, g); if (!G.headless) buildOverlay(S, g);
    buildDragon(S, b);
    // melee range is measured to the nearest of his body centre, his head and his shoulder coil (dragon space x, z, radius), so a
    // blade under his head is in range. Same in headless sims (fixed rest-pose points, not the animated mesh).
    b.distTo = function (x, z) { const cf = Math.cos(this.facing), sf = Math.sin(this.facing); let d = Math.hypot(x - this.pos.x, z - this.pos.z) - this.radius;
      for (const q of MELEE_PTS) { const wx = this.pos.x + q[0] * cf + q[1] * sf, wz = this.pos.z - q[0] * sf + q[1] * cf; d = Math.min(d, Math.hypot(x - wx, z - wz) - q[2]); }
      return Math.max(0, d); };
    Object.assign(S, { ink: 1, forceDry: false, dry: false, lk: Object.assign({}, LOOK[0]), lkT: Object.assign({}, LOOK[0]), reveal: 1, draw: 1.2, eye: 1, descend: 0, introOn: false,
      seen: {}, hitAt: {}, leafPred: [], bleed: [], ensoN: 0, enso: null, carved: null, galeOn: 0, galeTell: 0, gwx: 0, gwz: 1, wind: new THREE.Vector2(0.25, 0.08), wash: -1, washK: 0, washDur: 2, splat: 0, frame: 0, seal: -1,
      sealH: null, sealHitT: -1, grind: 0, slump: 0, rear: 0, rake: 0, whip: 0, roar: 0, sweep: 0, dive: 0, rip: -100, bolt: 0, boltA: 0.4, boltT: -10, boltX: 0.5, boltNext: 4, headW: new V3(0, 3, -6), fig: null, figN: 0, figPrev: -1, sunRise: 0, birdT: 2, birdNext: 3, dead: false, flat: 0, wetG: 0, lvl: 0 });
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 13 }, bossStart: { x: 0, z: -6, face: 0 }, camDist: 16,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.6,
      clamp(p) { const d = Math.hypot(p.x, p.z), m = R - 0.6; if (d > m) { p.x *= m / d; p.z *= m / d; } },
      bulletBounds: (x, z) => Math.hypot(x, z) < 26,
      camLimit(x, y, z, f) { const S = b.state, hw = S.headW;
        // while his head is close over the hero the orbit tilts up ~6 deg (camera lower, looking more level) so the head clears the hero
        if (f && S.camUp > 0.001 && !S.introOn) { const ox = x - f.x, oy = y - f.y, oz = z - f.z, hl = Math.hypot(ox, oz), L = Math.hypot(hl, oy);
          if (hl > 1e-3) { const e = Math.atan2(oy, hl) - 0.105 * S.camUp, ch = Math.cos(e) * L / hl; x = f.x + ox * ch; z = f.z + oz * ch; y = f.y + Math.sin(e) * L; } }
        // the lens never sits in his head: slide it out to 5.5 m from the skull
        if (hw && S.D && !S.dead && !S.introOn) { const hx = x - hw.x, hy = y - hw.y, hz = z - hw.z, hd = Math.hypot(hx, hy, hz); if (hd < 5.5 && hd > 1e-3) { x = hw.x + hx * 5.5 / hd; y = hw.y + hy * 5.5 / hd; z = hw.z + hz * 5.5 / hd; } }
        // (r3) a cinematic orbit stays inside the terrace and out of the cherry's canopy, so no grove or branch crosses the lens
        if (Cam.cine) for (let it = 0; it < 2; it++) { const r = Math.hypot(x, z); if (r > R) { x *= R / r; z *= R / r; }
          const tx = x - TREE_C[0], tz = z - TREE_C[1], td = Math.hypot(tx, tz); if (td < 11 && td > 1e-3) { x = TREE_C[0] + tx * 11 / td; z = TREE_C[1] + tz * 11 / td; } }
        const d = Math.hypot(x, z), m = R + 4.5; if (d > m) { x *= m / d; z *= m / d; } return { x, y: Math.max(y, 0.6), z }; },
    };
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // look, resets
  function applyLook(b, i, instant) { const S = b.state; S.lkT = Object.assign({}, LOOK[i]); S.lvl = i; if (instant) { S.lk = Object.assign({}, LOOK[i]); S.sunRise = i === 2 ? 1 : 0; } }
  // every per-mechanic visual and sim state goes back to rest: called by each phase's enter and run, and by skipTo
  function resetMech(b, i) {
    const S = b.state; if (!S.D) return;
    S.ink = 1; S.forceDry = false; S.dry = false; b.dmgTaken = 1; b.targetable = true; b.autoFace = true;
    S.galeOn = 0; S.galeTell = 0; S.bleed.length = 0; S.leafPred.length = 0; S.enso = null; S.ensoV = null; if (S.ensoM) S.ensoM.visible = false; S.camUp = 0;
    S.D.duck.fill(0); S.D.fdV.fill(0); S.fig = null; if (S.figM) S.figM.mesh.visible = false; S.carved = null; S.sealH = null; S.sealHitT = -1; if (S.sealBlock) S.sealBlock.visible = false;
    S.grind = 0; S.slump = 0; S.rear = 0; S.rake = 0; S.whip = 0; S.roar = 0; S.sweep = 0; S.dive = 0; S.rip = -100; S.wash = -1; S.splat = 0; S.bolt = 0; S.boltT = -10; S.seen = {}; S.hitAt = {}; S.wetG = i === 1 ? 1 : 0; S.grindN = 0;
    const P = S.D.pose; Object.assign(P, { rear: 0, rake: 0, whip: 0, slump: 0, sweep: 0, roar: 0, dive: 0 });
    hideDecals(S); if (S.bq) S.bq.mesh.count = S.bq.glb.count = S.bq.sh.count = 0;
    applyLook(b, i, false);
  }
  const isDry = (b) => !b.enraged && (b.state.forceDry || b.state.ink < DRY_AT);
  const sp = (b) => b.enraged ? 0.77 : b.state.lvl === 2 ? 0.77 : b.state.lvl === 1 ? 0.88 : 1;
  function useInk(b, cost) { const S = b.state, dry = isDry(b); if (!b.enraged) S.ink = Math.max(0.05, S.ink - cost); return dry; }
  function first(b, key) { const S = b.state; if (S.seen[key]) return 0; S.seen[key] = 1; return 0.3; }
  const KOTO = [0, 2, 3, 7, 9, 12, 14, 15];
  const pluck = (i, v = 0.12) => { if (!G.headless) Sound.note(62 + KOTO[((i % 8) + 8) % 8], 'koto', 0.7, v); };
  const taiko = (v = 0.5) => { if (!G.headless && Sound.ok()) Music.voice('taiko', 0, Sound.ctx.currentTime, 0, v, Sound.sfxBus); };
  const spat = (x, z, r = 1, n = 14) => FX.burst(x, 0.3, z, { n, smoke: true, color: 0x14130f, color2: 0x34322c, speed: [2, 6 + r], life: [0.35, 0.8], size: [0.12, 0.35], grav: 14, alpha: 0.9, radius: r * 0.5, up: 2 });
  function chord(px, pz, dx, dz, rr) { const bq = px * dx + pz * dz, c = px * px + pz * pz - rr * rr, disc = bq * bq - c; if (disc <= 0) return null; const s = Math.sqrt(disc); return [-bq - s, -bq + s]; }

  // paint a stroke as hazards: wet = sections base to tip; dry = 5 m dashes with 3 m of bare paper between
  function paint(b, x0, z0, dir, len, w, n, d0, dmg, name, dry, kind, nodeOff, onSec) {
    const S = b.state, dx = Math.sin(dir), dz = Math.cos(dir), parts = [];
    if (!dry) for (let i = 0; i < n; i++) parts.push([len * i / n, len / n]); else for (let a = 0; a < len - 0.5; a += 8) parts.push([a, Math.min(5, len - a)]);
    parts.forEach(([a, l], i) => {
      const k = a / Math.max(len, 1e-3);
      Hz.rect(x0 + dx * a, z0 + dz * a, dir, l, w, d0 + 0.12 * (dry ? k * n : i), dmg, { name, silent: i > 0, onHit() { S.hitAt[name] = G.now; }, onFire(h) {
        if (G.now - (S.hitAt[name] === undefined ? -9 : S.hitAt[name]) < 0.6) h.dmg = 0;
        if (!G.headless) { const s = h.shape; decal(S, kind, s.x + dx * l / 2, s.z + dz * l / 2, dir, l, w * (kind === 3 ? 0.62 : 0.55), 0.12, 1.2, 7, kind === 3 ? ((a - nodeOff) % 7 + 7) % 7 : undefined); pluck(i + (dry ? 3 : 0), 0.1); Sound.sfx('slash', 0.45, 0.55); spat(s.x + dx * l / 2, s.z + dz * l / 2, 1.2, 8); FX.shake(0.15); }
        if (onSec) onSec(h, a, l); } });
    });
  }

  // <figure> One Breath: one-stroke figures. Pure (no game state): tools/figfuzz.js loads this block on its own.
  // Joints sit on a 3 x 3 lattice 5.5 m apart (0 1 2 / 3 4 5 / 6 7 8). Lines join neighbours or two corners of one cell, so a joint is
  // never closer than 3.9 m to a line it is not on and no two lines overlap (the two diagonals of a cell may cross, away from any joint).
  // A one-way line (ow) can only be inked from a to b.
  const FIG_SP = 5.5, FIG_RMAX = 17.5, FIG_NEAR = 4;
  const FIG_SHAPES = [
    // 3-line paths, only for the fight's first figure: start at an end and it completes, start in the middle and it dead-ends
    { e: [[3, 0], [0, 4], [4, 1]], path: 1 }, { e: [[0, 1], [1, 3], [3, 4]], path: 1 }, { e: [[6, 3], [3, 4], [4, 2]], path: 1 },
    // two odd joints: start on one of them
    { e: [[0, 1], [1, 4], [4, 0], [4, 7]] },                         // triangle with a tail
    { e: [[0, 1], [1, 2], [2, 4], [4, 1]] },                         // hook
    { e: [[0, 1], [1, 4], [4, 3], [3, 0], [0, 4]] },                 // square with one diagonal
    { e: [[1, 3], [3, 7], [7, 5], [5, 1], [3, 4]] },                 // kite with a spur
    { e: [[1, 4], [4, 7], [1, 2], [2, 5], [5, 4]] },                 // flag
    { e: [[0, 3], [3, 4], [4, 1], [1, 0], [3, 6]] },                 // chair
    { e: [[3, 4], [4, 6], [6, 3], [4, 5], [5, 8]] },                 // pennant
    { e: [[6, 4], [4, 8], [6, 7], [7, 8], [7, 4]] },                 // tent
    { e: [[0, 1], [1, 4], [4, 3], [3, 0], [1, 2]] },                 // square with a tail
    { e: [[3, 4], [4, 7], [7, 6], [6, 3], [3, 1], [1, 4]] },         // house
    { e: [[1, 3], [3, 7], [7, 5], [5, 1], [1, 4], [4, 7]] },         // diamond with a spine
    { e: [[0, 1], [1, 4], [4, 3], [3, 0], [0, 4], [4, 8]] },         // square, diagonal and tail
    { e: [[1, 3], [3, 7], [7, 5], [5, 1], [3, 4], [4, 5]] },         // diamond with a bar
    { e: [[0, 1], [1, 5], [5, 8], [8, 7], [7, 3], [3, 0], [3, 4]] }, // ring with a spoke
    { e: [[0, 1], [1, 4], [4, 0], [4, 8], [8, 7], [7, 4], [1, 2]] }, // bow tie with a tail
    { e: [[3, 4], [4, 7], [7, 6], [6, 3], [3, 1], [1, 4], [4, 5]] }, // house with a porch
    { e: [[3, 4], [4, 0], [0, 3], [4, 5], [5, 8], [8, 4], [1, 4]] }, // two triangles and a post
    // no odd joints: every start works with plain lines, so these need one-way lines or the eye
    { e: [[0, 1], [1, 4], [4, 0], [4, 8], [8, 7], [7, 4]] },         // bow tie
    { e: [[3, 4], [4, 0], [0, 3], [4, 5], [5, 8], [8, 4]] },         // two triangles
    { e: [[0, 1], [1, 5], [5, 8], [8, 7], [7, 3], [3, 0]] },         // ring
  ];
  const figUsed = (L) => [...new Set(L.flatMap((l) => [l.a, l.b]))];
  const figOddN = (e) => { const d = new Array(9).fill(0); for (const [a, b] of e) { d[a]++; d[b]++; } return d.filter((v) => v & 1).length; };
  function figSegD(x, z, A, B) { const dx = B.x - A.x, dz = B.z - A.z, l2 = dx * dx + dz * dz || 1, k = Math.max(0, Math.min(1, ((x - A.x) * dx + (z - A.z) * dz) / l2)); return Math.hypot(x - A.x - dx * k, z - A.z - dz * k); }
  // the lines that can be inked next from joint c (mask m = lines already inked), as pairs [line, joint it leads to]
  function figMoves(F, c, m) { const o = []; for (let i = 0; i < F.L.length; i++) { if (m >> i & 1) continue; const l = F.L[i]; if (l.a === c) o.push([i, l.b]); else if (l.b === c && !l.ow) o.push([i, l.a]); } return o; }
  // the rest of a one-stroke route from joint c with mask m inked (ending on the eye if eye >= 0), as the list of joints to visit, or null
  function figSolve(F, c, m, eye) {
    if (m === (1 << F.L.length) - 1) return eye < 0 || c === eye ? [] : null;
    for (const [i, j] of figMoves(F, c, m)) { const r = figSolve(F, j, m | 1 << i, eye); if (r) { r.unshift(j); return r; } }
    return null;
  }
  const figStarts = (F, eye) => figUsed(F.L).filter((j) => figSolve(F, j, 0, eye));
  // lay the figure out on the floor: about 9 m from the player toward the middle, no joint within 4 m of them, every joint inside r 17.5,
  // and a spot beyond it, clear of every joint and line, where the dragon holds still
  function figPlace(F, r, px, pz) {
    const used = figUsed(F.L); let ux = -px, uz = -pz; const ul = Math.hypot(ux, uz);
    if (ul < 1) { const a = r() * Math.PI * 2; ux = Math.sin(a); uz = Math.cos(a); } else { ux /= ul; uz /= ul; }
    const a0 = Math.atan2(ux, uz);
    for (let t = 0; t < 200; t++) {
      const d = 9 + Math.floor(t / 20) * 0.6, a = a0 + (t < 40 ? 0 : (r() - 0.5) * Math.min(2.6, t / 40)), cx = px + Math.sin(a) * d, cz = pz + Math.cos(a) * d;
      const th = r() * Math.PI * 2, mir = r() < 0.5 ? -1 : 1, cs = Math.cos(th), sn = Math.sin(th), J = [];
      for (let j = 0; j < 9; j++) { const gx = ((j % 3) - 1) * FIG_SP * mir, gz = (Math.floor(j / 3) - 1) * FIG_SP; J.push({ x: cx + gx * cs + gz * sn, z: cz - gx * sn + gz * cs }); }
      if (!used.every((j) => Math.hypot(J[j].x, J[j].z) < FIG_RMAX && Math.hypot(J[j].x - px, J[j].z - pz) >= FIG_NEAR)) continue;
      let ext = 0; for (const j of used) ext = Math.max(ext, Math.hypot(J[j].x - cx, J[j].z - cz));
      let bx = 0, bz = 0, ok = false;
      for (let q = 0; q < 11 && !ok; q++) { const ba = a + (q % 2 ? 1 : -1) * Math.ceil(q / 2) * 0.42;
        for (const rr of [ext + 4.5, ext + 3.2]) { bx = cx + Math.sin(ba) * rr; bz = cz + Math.cos(ba) * rr; const br = Math.hypot(bx, bz); if (br > 16.5) { bx *= 16.5 / br; bz *= 16.5 / br; }
          if (Math.hypot(bx - px, bz - pz) >= 6 && used.every((j) => Math.hypot(J[j].x - bx, J[j].z - bz) >= 4.5) && F.L.every((l) => figSegD(bx, bz, J[l.a], J[l.b]) >= 3.5)) { ok = true; break; } } }
      if (!ok) continue;
      Object.assign(F, { J, used, cx, cz, th, mir, ext, bx, bz }); return true;
    }
    return false;
  }
  // a figure for phase lvl (0..2) for a player at (px, pz). r() is the fight's seeded stream, prev the last shape, first the fight's first figure.
  // Phase 1: plain lines, two odd joints. Phase 2: one or two one-way lines that change which starts work. Phase 3: the stroke must end on the eye.
  function figMake(lvl, r, px, pz, prev, first) {
    const pool = []; FIG_SHAPES.forEach((s, k) => { const n = s.e.length;
      if (first ? s.path : !s.path && k !== prev && (lvl === 0 ? n <= 5 && figOddN(s.e) === 2 : lvl === 1 ? n >= 5 && n <= 6 : n >= 6 && n <= 7)) pool.push(k); });
    for (let att = 0; att < 100; att++) {
      const k = pool[Math.floor(r() * pool.length)], L = FIG_SHAPES[k].e.map(([a, b]) => ({ a, b, ow: 0 })), F = { shape: k, L, eye: -1, lvl };
      if (lvl === 1 || (lvl === 2 && r() < 0.5)) { const idx = L.map((l, i) => i), nOw = lvl === 1 && r() < 0.45 ? 2 : 1;
        for (let q = 0; q < nOw; q++) { const l = L[idx.splice(Math.floor(r() * idx.length), 1)[0]]; l.ow = 1; if (r() < 0.5) { const t = l.a; l.a = l.b; l.b = t; } } }
      const used = figUsed(L), deg = new Array(9).fill(0); for (const l of L) { deg[l.a]++; deg[l.b]++; } const odd = used.filter((j) => deg[j] & 1);
      if (lvl === 2) F.eye = odd.length === 2 ? odd[Math.floor(r() * 2)] : used[Math.floor(r() * used.length)];
      const starts = figStarts(F, F.eye);
      if (!starts.length || starts.length === used.length) continue;
      if (lvl === 1 && figStarts({ L: L.map((l) => ({ a: l.a, b: l.b, ow: 0 })) }, -1).every((j) => starts.includes(j))) continue;
      if (!figPlace(F, r, px, pz)) continue;
      let len = 0; for (const l of L) { l.len = Math.hypot(F.J[l.b].x - F.J[l.a].x, F.J[l.b].z - F.J[l.a].z); l.dir = Math.atan2(F.J[l.b].x - F.J[l.a].x, F.J[l.b].z - F.J[l.a].z); len += l.len; }
      let near = 1e9; for (const s of starts) near = Math.min(near, Math.hypot(F.J[s].x - px, F.J[s].z - pz));
      F.starts = starts; F.len = len; F.Lmin = near + len; F.T = 1.2 + (lvl === 2 ? 0.9 : 1) * (2.8 + 1.35 * F.Lmin / 7);
      return F;
    }
    return null;
  }
  // </figure>

  // ---- One Breath: the dragon sketches a figure and holds his breath; the player is the brush ----
  const FIG_NL = 8, FIG_NJ = 9, FIG_ARR = 1.4, FIG_SK = 1.2, FIG_REW = [0.015, 0.025], FIG_HOLD = 0.3; // reward: share of max health for a seal, for a seal with the eye dotted; damage he takes while a figure is open
  function* oneBreath(b) {
    const S = b.state, p = G.player, lvl = S.lvl;
    for (const h of S.bleed) Hz.cancel(h); S.bleed.length = 0; S.leafPred.length = 0; // no pool sits on a joint
    const F = figMake(lvl, () => rnd(), p.pos.x, p.pos.z, S.figPrev, S.figN === 0 && lvl === 0);
    if (!F) return;
    S.figPrev = F.shape; S.figN++;
    Object.assign(F, { t0: G.now, state: 'sketch', cur: -1, at: -1, n: 0, mask: 0, tR: -1, res: '', refT: -9, vk: new Float32Array(FIG_NL), vb: new Float32Array(FIG_NJ), vPk: -1, vIni: false });
    for (const l of F.L) { l.by = 0; l.from = -1; l.t = -1; l.fT = -1; }
    S.fig = F; S.rear = 0; b.autoFace = true;
    if (!G.headless) { dryPrints(S); Sound.sfx('wave', 0.3, 1.6); Sound.note(69, 'flute', 1.4, 0.06); }
    Co.start((function* () { yield* b.moveTo(F.bx, F.bz, 11); if (S.fig === F && F.state !== 'done') S.rear = 1; })(), 'phase');
    yield* b.cast({ name: 'One Breath', time: F.T, onTick: (k, cs) => { if (S.fig !== F || F.state === 'done') cs.result = 'done'; } });
    if (S.fig !== F) return;
    if (F.state !== 'done') figResolve(b, F, 'fail');
    S.rear = 0; yield 0.25;
    if (F.res === 'seal') {
      // his ink is spent: the seal pulls him down onto the print and binds him, and everything he paints until the next Grind lands dry
      const big = F.eye >= 0; b.damage(Math.round(b.maxHp * (big ? FIG_REW[1] : FIG_REW[0])), { src: 'player', crit: true });
      S.ink = 0.05; S.slump = 1; b.autoFace = false; if (!G.headless) { spat(b.pos.x, b.pos.z, 3, 24); Sound.sfx('roar', 0.5, 1.3); }
      Co.start(b.moveTo(F.cx, F.cz, 13, { face: false }), 'phase');
      yield big ? 6 : 4.5; S.slump = 0; b.autoFace = true; yield 0.4;
    } else if (F.res === 'fail') {
      // he finishes every line you left, then drinks the ink back
      const left = F.L.filter((l) => !l.by), f = first(b, 'fig'), done = new Set(); if (!G.headless) Sound.sfx('charge', 0.5, 0.7);
      left.forEach((l, i) => { const A = F.J[l.a], mx = A.x + Math.sin(l.dir) * l.len / 2, mz = A.z + Math.cos(l.dir) * l.len / 2;
        Hz.rect(A.x, A.z, l.dir, l.len, 2.4, 1.0 + f + 0.12 * i, 380, { name: 'Final Stroke', silent: i > 0, onHit() { S.hitAt['Final Stroke'] = G.now; }, onFire(h) {
          if (G.now - (S.hitAt['Final Stroke'] === undefined ? -9 : S.hitAt['Final Stroke']) < 0.6) h.dmg = 0;
          l.fT = G.now;
          if (!G.headless) { decal(S, 0, mx, mz, l.dir, l.len, 2.4 * 0.55, 0.12, 1.2, 7); pluck(i, 0.1); Sound.sfx('slash', 0.45, 0.55); spat(mx, mz, 1.2, 8); FX.shake(0.15); }
          for (const j of [l.a, l.b]) { if (done.has(j)) continue; done.add(j); const q = F.J[j];
            if (lvl === 1) bleedZone(b, q.x, q.z);
            else if (lvl === 2) Hz.circle(q.x, q.z, 3.2, 0.9 * sp(b), 265, { name: 'Blossom', silent: true, onFire() {
              if (!G.headless) { decal(S, 1, q.x, q.z, 0, 3.2, 3.2, 0.1, 0.6, 5); FX.burst(q.x, 1, q.z, { n: 18, smoke: true, color: 0xf2a6b8, color2: 0xd9728c, speed: [1, 4], life: [0.5, 1.1], size: [0.2, 0.45], alpha: 0.9, up: 1 }); pluck(4 + j, 0.1); }
              Bul.ring(q.x, q.z, 5, 5, { r: 0.4, dmg: 90, color: BINK, life: 3, kind: 'petal', name: 'Petal' }, rnd(TAU)); } }); } } }); });
      S.ink = 1; S.forceDry = false;
      yield 1.0 + f + 0.12 * left.length + 0.3;
    } else yield 0.4;
  }
  function figResolve(b, F, res) {
    const S = b.state; F.state = 'done'; F.res = res; F.tR = G.now; S.rear = 0;
    if (G.headless) return;
    if (res === 'seal') { taiko(0.85); Sound.sfx('boom', 0.4, 0.8); FX.flash(VERM, 0.1, 4); FX.shake(0.35);
      if (F.eye >= 0) for (const j of F.used) FX.burst(F.J[j].x, 0.5, F.J[j].z, { n: 22, smoke: true, color: 0xf2a6b8, color2: 0xd9728c, speed: [1, 4.5], life: [0.6, 1.3], size: [0.2, 0.5], alpha: 0.9, up: 2 }); }
    else if (res === 'eyeless') Sound.note(50, 'flute', 1.8, 0.09);
    else Sound.sfx('roar', 0.45, 1.15);
  }
  // the brush: arrivals at joints (within 1.4 m) ink lines; how the player got there does not matter
  function figStep(b) {
    const S = b.state, F = S.fig, p = G.player; if (!F) return;
    if (F.state === 'done') { if (G.now - F.tR > 8) S.fig = null; return; }
    if (F.state === 'sketch') { if (G.now - F.t0 < FIG_SK) return; F.state = 'live'; }
    if (!p || !p.alive) return;
    let at = -1; for (const j of F.used) if (Math.hypot(p.pos.x - F.J[j].x, p.pos.z - F.J[j].z) < FIG_ARR) { at = j; break; }
    if (at === F.at) return; F.at = at; if (at < 0 || at === F.cur) return;
    if (F.cur < 0) { F.cur = at; if (!G.headless) { pluck(0, 0.12); Sound.sfx('slash', 0.2, 0.35); } return; }
    const mv = figMoves(F, F.cur, F.mask).find(([, j]) => j === at);
    if (!mv) { // the brush never lifts: a dry scratch, and the blot waits where it was
      F.refT = G.now; if (!G.headless) { if (Sound.ok()) Sound.noise({ dur: 0.22, vol: 0.12, f: 3400, fEnd: 1300, q: 0.7 }); decal(S, 0, p.pos.x, p.pos.z, p.facing + PI / 2 + vrand() - 0.5, 1.8, 0.5, 0.04, 0.2, 1.4); }
      return; }
    const l = F.L[mv[0]]; l.by = 1; l.from = F.cur; l.t = G.now; F.mask |= 1 << mv[0]; F.n++; F.cur = at;
    if (!G.headless) { pluck(F.n, 0.13); Sound.sfx('slash', 0.25, 0.45); }
    if (F.mask === (1 << F.L.length) - 1) figResolve(b, F, F.eye < 0 || at === F.eye ? 'seal' : 'eyeless');
    else if (!figMoves(F, at, F.mask).length) figResolve(b, F, 'fail');
  }

  // ---- strokes ----
  function* rake(b) {
    const S = b.state; useInk(b, COST.rake); const f = first(b, 'rake'), face = b.angToPlayer(), side = rnd() < 0.5 ? -1 : 1, dir = face + side * 0.4; b.autoFace = false; yield* b.turnTo(face, 0.25);
    const T2 = (1.1 + f) * sp(b); S.rake = 1; S.whipS = side;
    Hz.cone(b.pos.x, b.pos.z, dir, 1.75, 9, T2, 340, { name: 'Claw Rake', onFire() {
      if (G.headless) return; Sound.sfx('slash', 1, 0.6); Sound.sfx('hit', 0.6, 0.6); FX.shake(0.3); const px = Math.cos(dir), pz = -Math.sin(dir);
      for (let i = -1; i <= 1; i++) { const x0 = b.pos.x + Math.sin(dir) * 2.4 + px * i * 1.0, z0 = b.pos.z + Math.cos(dir) * 2.4 + pz * i * 1.0, d2 = dir + i * 0.12; decal(S, 0, x0 + Math.sin(d2) * 3.2, z0 + Math.cos(d2) * 3.2, d2, 6.4, 0.75, 0.08, 0.8, 6); spat(x0 + Math.sin(d2) * 5, z0 + Math.cos(d2) * 5, 1, 6); }
    } });
    yield* b.cast({ name: 'Claw Rake', time: T2 }); S.rake = 0; yield 0.35; b.autoFace = true;
  }

  function* bamboo(b, fan) {
    const S = b.state, p = G.player, dry = useInk(b, COST.bamboo), f = first(b, fan ? 'fan' : 'bamboo'), d0 = (1.3 + f) * sp(b);
    S.whip = 1; S.whipS = rnd() < 0.5 ? -1 : 1; Sound.sfx('dash', 0.7, 0.6);
    const stalks = [];
    if (!fan) {
      const dir = b.angToPlayer() + PI / 2 + rnd(-0.45, 0.45), dx = Math.sin(dir), dz = Math.cos(dir), nx = dz, nz = -dx;
      for (const k of [-1, 0, 1]) {
        const px = p.pos.x + nx * k * 6.5, pz = p.pos.z + nz * k * 6.5, ch = chord(px, pz, dx, dz, R + 0.5); if (!ch || ch[1] - ch[0] < 4) continue;
        const nodes = []; for (let m = Math.ceil((ch[0] - 3.5) / 7); 7 * m + 3.5 < ch[1] - 0.5; m++) { const ar = 7 * m + 3.5; if (ar > ch[0] + 0.5) nodes.push({ a: ar - ch[0], side: ((m + k) & 1) ? 1 : -1 }); }
        stalks.push({ x0: px + dx * ch[0], z0: pz + dz * ch[0], dir, len: ch[1] - ch[0], nodes, nodeOff: nodes.length ? nodes[0].a : 0 });
      }
    } else {
      const a = angTo(p.pos.x, p.pos.z, b.pos.x, b.pos.z), ch = chord(b.pos.x, b.pos.z, Math.sin(a), Math.cos(a), R) || [0, 0];
      const ox = b.pos.x + Math.sin(a) * ch[1], oz = b.pos.z + Math.cos(a) * ch[1], aim = angTo(ox, oz, p.pos.x, p.pos.z);
      for (let i = 0; i < 4; i++) { const dir = aim + (i - 1.5) * 0.314, dx = Math.sin(dir), dz = Math.cos(dir), c2 = chord(ox - dx * 0.5, oz - dz * 0.5, dx, dz, R + 0.5); if (!c2) continue;
        const len = c2[1] - 0.5, nodes = []; for (let j = 1; 7 * j < len - 0.5; j++) nodes.push({ a: 7 * j, side: ((j + i) & 1) ? 1 : -1 });
        stalks.push({ x0: ox, z0: oz, dir, len, nodes, nodeOff: 7 }); }
    }
    for (const st of stalks) for (const nd of st.nodes) { const ld = st.dir + nd.side * 1.05; nd.x = st.x0 + Math.sin(st.dir) * nd.a; nd.z = st.z0 + Math.cos(st.dir) * nd.a; nd.dir = ld; if (!dry) S.leafPred.push({ type: 'cone', x: nd.x, z: nd.z, dir: ld, arc: 1.0, r: 4.2 }); }
    for (const st of stalks) paint(b, st.x0, st.z0, st.dir, st.len, 2.6, 3, d0, 385, 'Bamboo Stroke', dry, 3, st.nodeOff, dry ? null : (h, a, l) => {
      for (const nd of st.nodes) if (nd.a >= a && nd.a < a + l) Hz.cone(nd.x, nd.z, nd.dir, 1.0, 4.2, 1.0 * sp(b), 285, { name: 'Bamboo Leaves', silent: true, onFire() {
        if (G.headless) return; for (let q = -1; q <= 1; q++) { const d2 = nd.dir + q * 0.3, L = 3.2 - Math.abs(q) * 0.6; decal(S, 0, nd.x + Math.sin(d2) * L / 2, nd.z + Math.cos(d2) * L / 2, d2, L, 0.8, 0.1, 0.8, 6); } pluck(5 + (nd.side > 0 ? 1 : 0), 0.08); } });
    });
    yield* b.cast({ name: 'Bamboo Stroke', time: 1.3 * sp(b) + f }); S.whip = 0;
    yield dry ? 0.5 : 1.5; S.leafPred.length = 0;
  }

  // wet ink left on the paper: in the storm a 6 s pool to 4.2 m; in the finale Haboku's blots stay 16 s and spread to 5 m, so they
  // are still wet under Enso and the Carved Seal
  function bleedZone(b, x, z, long) {
    const S = b.state; for (let i = S.bleed.length - 1; i >= 0; i--) if (S.bleed[i].state === 'done') S.bleed.splice(i, 1);
    const rmax = long ? 5 : 4.2, dur = long ? 16 : 6;
    const h = Hz.zone({ type: 'circle', x, z, r: 3 }, dur, 120, { name: 'Wet Ink', every: 0.5, delay: 0.3, color: 0x101010, rmax, track(s, hz) { s.r = Math.min(rmax, 3 + (hz.zt || 0) * 0.4); } });
    S.bleed.push(h); while (S.bleed.length > 5) Hz.cancel(S.bleed.shift());
    decal(S, 1, x, z, 0, rmax * 2.1, rmax * 2.1, 3.0, dur - 0.5, dur + 1.5);
  }

  function* drops(b, n) {
    const S = b.state, p = G.player; useInk(b, COST.drops); const f = first(b, 'drops');
    for (let i = 0; i < n; i++) {
      Hz.circle(p.pos.x, p.pos.z, 3.0, (1.2 + f) * sp(b), 360, { name: 'Ink Drop', lock: 0.8, track(s) { s.x = p.pos.x; s.z = p.pos.z; }, onFire(h) {
        const s = h.shape; if (!G.headless) { decal(S, 1, s.x, s.z, vrand() * TAU, 6.6, 6.6, 0.15, 0.8, 6); spat(s.x, s.z, 2.5, 16); Sound.sfx('boom', 0.35, 1.6); pluck(i * 2, 0.1); }
        if (S.lvl === 1) bleedZone(b, s.x, s.z); } });
      yield 0.5;
    }
    yield 0.8;
  }

  function habokuPts() { const p = G.player, pts = [[p.pos.x, p.pos.z]]; let tries = 0; while (pts.length < 6 && tries++ < 300) { const a = rnd(TAU), r = Math.sqrt(rnd()) * (R - 2.5), x = Math.sin(a) * r, z = Math.cos(a) * r; if (pts.every(([qx, qz]) => Math.hypot(qx - x, qz - z) >= 5)) pts.push([x, z]); } return pts; }
  function* haboku(b) {
    const S = b.state, pts = habokuPts(); Sound.sfx('roar', 0.5, 1.2); S.roar = 1;
    pts.forEach(([x, z], i) => Hz.circle(x, z, 3.4, (1.3 + 0.15 * i) * sp(b), 440, { name: 'Haboku', silent: i > 0, onFire() {
      if (!G.headless) { decal(S, 1, x, z, vrand() * TAU, 7.6, 7.6, 0.12, 1.0, 6.5); spat(x, z, 3, 20); Sound.sfx('boom', 0.5, 1.2); FX.shake(0.25); pluck(i + 2, 0.11); }
      if (S.lvl >= 1) bleedZone(b, x, z, S.lvl === 2);
      if (S.lvl === 2 && i === 0) Bul.ring(b.pos.x, b.pos.z, 9, 6, { r: 0.4, dmg: 90, color: BINK, life: 5, kind: 'petal', name: 'Petal' }, rnd(TAU), rnd(TAU), 70 * PI / 180);
    } }));
    yield 0.6; S.roar = 0; yield 1.3 + 0.75 - 0.6 + 0.3;
  }

  function* grind(b) {
    const S = b.state; S.forceDry = false; S.rear = 1; S.grind = 0; b.autoFace = true;
    const r = yield* b.cast({ name: 'Grind Ink', time: 3.0, interruptible: true, onTick: (k) => { S.grind = k; if (!G.headless && Math.floor(k * 8) !== S.gk) { S.gk = Math.floor(k * 8); Sound.sfx('tick', 0.6, 0.5); } } });
    S.rear = 0;
    if (r === 'dead') return;
    if (r === 'interrupted') {
      S.grind = 0; S.slump = 1; S.forceDry = true; b.autoFace = false; if (!G.headless) { spat(b.pos.x, b.pos.z, 3, 24); FX.shake(0.4); }
      yield 2.5; S.slump = 0; b.autoFace = true; yield 0.4;
      S.grindN = (S.grindN || 0) + 1; if (b.enraged || (S.lvl === 2 && S.grindN % 2 === 0)) yield* haboku(b);
      return;
    }
    S.ink = 1; S.grind = 0; S.wetG = Math.max(S.wetG, 0.6); if (!G.headless) taiko(0.45);
    yield* haboku(b);
  }

  function* drift(b) {
    const p = G.player; let tx = lerp(b.pos.x, p.pos.x, 0.35), tz = lerp(b.pos.z, p.pos.z, 0.35);
    const rr = Math.hypot(tx, tz); if (rr > 9) { tx *= 9 / rr; tz *= 9 / rr; }
    const d = Math.hypot(tx - b.pos.x, tz - b.pos.z); if (d > 10) { tx = b.pos.x + (tx - b.pos.x) * 10 / d; tz = b.pos.z + (tz - b.pos.z) * 10 / d; }
    if (d > 1) yield* b.moveTo(tx, tz, 3.5);
  }

  function* gale(b, waves, petal) {
    const S = b.state, wa = rnd(TAU), wx = Math.sin(wa), wz = Math.cos(wa), f = first(b, 'gale');
    S.gwx = wx; S.gwz = wz; S.galeTell = 1;
    if (!G.headless) { Sound.note(74, 'flute', 1.2, 0.08); setTimeout(() => Sound.note(81, 'flute', 1.4, 0.07), 400); Sound.sfx('wave', 0.4, 1); }
    yield* b.cast({ name: 'Gale', time: (2.0 + f) * sp(b) });
    S.galeOn = 5.0; S.galeTell = 0;
    Co.start(galeWaves(b, waves, petal, wx, wz), 'phase');
    yield 1.4; yield* rake(b); yield () => S.galeOn <= 0; yield 0.4;
  }
  function* galeWaves(b, n, petal, wx, wz) {
    const px = wz, pz = -wx; let g1 = rnd(-12, 12), g2 = 0; do { g2 = rnd(-13, 13); } while (Math.abs(g2 - g1) < 9);
    for (let w = 0; w < n; w++) {
      for (let o = -17.6; o <= 17.7; o += 2.2) { if (Math.abs(o - g1) < 2.5 || Math.abs(o - g2) < 2.5) continue;
        Bul.fire({ x: -wx * 18 + px * o, z: -wz * 18 + pz * o, dir: Math.atan2(wx, wz), speed: 10, r: 0.4, dmg: petal ? 120 : 150, life: 4.2, color: BINK, kind: petal ? 'petal' : 'leaf', name: petal ? 'Petal' : 'Gale' }); }
      if (!G.headless) { pluck(w * 2 + 1, 0.09); Sound.sfx('dash', 0.4, 0.8); }
      yield 1.5;
      const sh = () => rnd(3, 6) * (rnd() < 0.5 ? -1 : 1); let t2 = 0, n1 = g1, n2 = g2; do { n1 = clamp(g1 + sh(), -14, 14); n2 = clamp(g2 + sh(), -14, 14); } while (Math.abs(n1 - n2) < 8 && ++t2 < 20);
      g1 = n1; g2 = n2;
    }
  }

  function* seal(b) {
    const S = b.state, p = G.player; useInk(b, COST.seal); const f = first(b, 'seal'), dir = rnd(TAU), dx = Math.sin(dir), dz = Math.cos(dir), T2 = (1.5 + f) * sp(b);
    S.rear = 1; Sound.sfx('charge', 0.5, 0.6);
    const h = Hz.rect(p.pos.x - dx * 4, p.pos.z - dz * 4, dir, 8, 8, T2, 440, { name: 'Seal', lock: 0.9, track(s) { s.x = p.pos.x - dx * 4; s.z = p.pos.z - dz * 4; }, onFire(hz) {
      S.sealHitT = G.now; if (G.headless) return; const s = hz.shape; taiko(0.7); Sound.sfx('bigboom', 0.5); FX.shake(0.6); decal(S, 2, s.x + dx * 4, s.z + dz * 4, dir, 7.6, 7.6, 0.05, 2.5, 7, vrand() * 9); spat(s.x + dx * 4, s.z + dz * 4, 4, 22); } });
    S.sealH = h; S.sealDir = dir;
    yield* b.cast({ name: 'Seal', time: T2 }); S.rear = 0; yield 0.7;
  }

  // a zigzag of rects through the player: v2 sits on the player
  function zigzag(px, pz, a0, turns, lens) {
    const ang = [a0 + turns[0], a0 + turns[1], a0 + turns[2], a0 + turns[3]], V = [[px, pz]];
    let x = px, z = pz; for (let i = 1; i >= 0; i--) { x -= Math.sin(ang[i]) * lens[i]; z -= Math.cos(ang[i]) * lens[i]; V.unshift([x, z]); }
    x = px; z = pz; for (let i = 2; i < 4; i++) { x += Math.sin(ang[i]) * lens[i]; z += Math.cos(ang[i]) * lens[i]; V.push([x, z]); }
    return { V, ang };
  }
  function* thunder(b) {
    const S = b.state, p = G.player, dry = useInk(b, COST.thunder), f = first(b, 'thunder'), a0 = rnd(TAU), tw = 0.6;
    const lens = [rnd(10, 12), rnd(10, 12), rnd(10, 12), rnd(10, 12)], Z = zigzag(p.pos.x, p.pos.z, a0, [-tw, tw, -tw, tw], lens);
    S.rear = 0.6; if (!G.headless) Sound.sfx('charge', 0.5, 1.4); let flashed = false;
    for (let i = 0; i < 4; i++) { const [x0, z0] = Z.V[i];
      paint(b, x0, z0, Z.ang[i], lens[i], 2.4, 1, (1.2 + f + 0.12 * i) * sp(b), 400, 'Thunder Stroke', dry, 0, 0, i === 0 ? () => { if (!G.headless && !flashed) { flashed = true; Sound.sfx('thunder', 0.7); strike(S, vrand() * 1.2 - 0.6); } } : null); }
    yield* b.cast({ name: 'Thunder Stroke', time: (1.2 + f) * sp(b) }); S.rear = 0; yield 0.9;
  }

  function* branch(b) {
    const S = b.state, p = G.player, dry = useInk(b, COST.branch), f = first(b, 'branch'), a0 = rnd(TAU), sg = rnd() < 0.5 ? 1 : -1;
    const tw = [0, rnd(0.52, 0.87) * sg, 0, 0]; tw[2] = tw[1] - rnd(0.52, 0.87) * sg; tw[3] = tw[2] + rnd(0.52, 0.87) * sg; tw[0] = -rnd(0.52, 0.87) * sg;
    const lens = [rnd(8, 10), rnd(8, 10), rnd(8, 10), rnd(8, 10)];
    // the branch passes through the player at the joint v2
    const Z = zigzag(p.pos.x, p.pos.z, a0, tw, lens);
    S.whip = 1; S.whipS = sg; Sound.sfx('dash', 0.6, 0.7);
    for (let i = 0; i < 4; i++) { const [x0, z0] = Z.V[i], end = Z.V[i + 1];
      paint(b, x0, z0, Z.ang[i], lens[i], 2.2, 1, (1.3 + f + 0.12 * i) * sp(b), 385, 'Blossom Branch', dry, 0, 0, dry ? null : () => {
        Hz.circle(end[0], end[1], 3.2, 0.9 * sp(b), 265, { name: 'Blossom', silent: true, onFire() {
          if (!G.headless) { decal(S, 1, end[0], end[1], 0, 3.2, 3.2, 0.1, 0.6, 5); FX.burst(end[0], 1, end[1], { n: 18, smoke: true, color: 0xf2a6b8, color2: 0xd9728c, speed: [1, 4], life: [0.5, 1.1], size: [0.2, 0.45], alpha: 0.9, up: 1 }); pluck(4 + i, 0.1); }
          Bul.ring(end[0], end[1], 5, 5, { r: 0.4, dmg: 90, color: BINK, life: 3, kind: 'petal', name: 'Petal' }, rnd(TAU)); } });
      }); }
    yield* b.cast({ name: 'Blossom Branch', time: 1.3 * sp(b) + f }); S.whip = 0; yield dry ? 0.5 : 1.6;
  }

  function* enso(b) {
    const S = b.state; useInk(b, COST.enso); S.ensoN++; const inside = S.ensoN % 2 === 1, f = first(b, 'enso');
    b.autoFace = true; yield* b.moveTo(0, 0, 7);
    const pp = G.player.pos, gapA = Math.atan2(pp.x, pp.z) + rnd(-0.7, 0.7), GAP = 55 * PI / 180, arc = (TAU - GAP) / 10, T2 = (4.0 + f) * sp(b), t0 = G.now;
    S.enso = { gapA, inside, walls: [], t0, gap: GAP, arc, fire0: (1.2 + f) * sp(b), step: 0.12 * sp(b) }; S.sweep = 1;
    S.ensoV = { a0: gapA + GAP / 2, L: TAU - GAP, t0, fire0: S.enso.fire0, step: S.enso.step, arc, al: 0, dry: 0 }; if (!G.headless) Sound.sfx('charge', 0.6, 0.5);
    Hz[inside ? 'circle' : 'donut'](0, 0, ...(inside ? [12.5] : [9.5, 22]), T2, 495, { name: 'Flood', blockable: false, onFire() {
      if (!G.headless) { Sound.sfx('wave', 0.8, 0.8); Sound.sfx('bigboom', 0.5); FX.shake(0.5); FX.flash(0xefe7d3, 0.2, 2); if (inside) decal(S, 1, 0, 0, 0, 26, 26, 0.3, 0.5, 4); } } });
    for (let i = 0; i < 10; i++) { const ca = gapA + GAP / 2 + arc * (i + 0.5);
      Hz.cone(0, 0, ca, arc, 12.5, (1.2 + f + 0.12 * i) * sp(b), 165, { name: 'Enso', r0: 9.5, silent: i > 0, onFire() {
        const left = T2 - (G.now - t0) + 0.25; if (S.enso && left > 0.1) S.enso.walls.push(Hz.zone({ type: 'cone', x: 0, z: 0, dir: ca, arc, r: 12.5, r0: 9.5 }, left, 130, { name: 'Enso', every: 0.4, delay: 0.05, color: 0x101010 }));
        if (!G.headless) { pluck(i, 0.1); Sound.sfx('slash', 0.4, 0.5); } } }); }
    yield* b.cast({ name: 'Enso', time: T2 });
    yield 0.2; if (S.enso) for (const h of S.enso.walls) Hz.cancel(h); S.enso = null; S.sweep = 0; yield 0.8;
  }

  function* carved(b) {
    const S = b.state, p = G.player; useInk(b, COST.carved); const f = first(b, 'carved'), dir = rnd(TAU), ex = Math.cos(dir), ez = -Math.sin(dir), fx = Math.sin(dir), fz = Math.cos(dir), T2 = (1.8 + f) * sp(b);
    let cx = p.pos.x + rnd(-2, 2), cz = p.pos.z + rnd(-2, 2); const cr = Math.hypot(cx, cz); if (cr > 13) { cx *= 13 / cr; cz *= 13 / cr; }
    const cells = []; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const x = cx + ex * (i - 1) * 5 + fx * (j - 1) * 5, z = cz + ez * (i - 1) * 5 + fz * (j - 1) * 5; cells.push({ i, j, x, z, ok: Math.hypot(x, z) < R - 2.5, d: Math.hypot(x - p.pos.x, z - p.pos.z) }); }
    const okc = cells.filter((c) => c.ok).sort((a, c) => a.d - c.d), safe = new Set([okc[0]]);
    const rest = shuffle(okc.slice(1)); while (safe.size < 3 && rest.length) safe.add(rest.pop());
    let mask = 0; S.carved = { cells: [...safe] }; const printer = cells.find((q) => !safe.has(q));
    for (const c of cells) {
      const sx = c.x - fx * 2.5, sz = c.z - fz * 2.5;
      if (safe.has(c)) { mask += Math.pow(2, c.i + c.j * 3); Hz.mark({ type: 'rect', x: sx, z: sz, dir, len: 5, w: 5 }, T2 + 0.2, { color: GOLD }); }
      else Hz.rect(sx, sz, dir, 5, 5, T2, 505, { name: 'Carved Seal', silent: c !== printer, onFire: c === printer ? () => {
        if (!G.headless) { taiko(0.7); Sound.sfx('bigboom', 0.5); FX.shake(0.5); decal(S, 4, cx, cz, dir, 15, 15, 0.05, 2.5, 6.5, mask); } } : null });
    }
    S.rear = 1; Sound.sfx('charge', 0.5, 0.8);
    yield* b.cast({ name: 'Carved Seal', time: T2 }); S.rear = 0; yield 0.3; S.carved = null; yield 0.6;
  }

  // ---- phase transitions ----
  function* toStorm(b) {
    const S = b.state; resetMech(b, 1); S.lkT.storm = 0; b.autoFace = false;
    Sound.sfx('roar', 0.8, 0.8); S.rear = 1; yield 0.6;
    S.dive = 1; S.rip = G.now; S.ripX = b.pos.x; S.ripZ = b.pos.z; if (!G.headless) { Sound.sfx('wave', 0.8, 0.6); spat(b.pos.x, b.pos.z, 4, 30); }
    S.rear = 0; yield 0.5;
    S.wash = G.now; S.washK = 0; S.washDur = 2.4; S.lkT.storm = 1; Co.start(Post.lerpTo(PG[1], 3), 'fight'); Music.intensity(1);
    yield 1.3; if (!G.headless) { Sound.sfx('thunder', 1); strike(S, 0.15); }
    yield 1.2; S.dive = 0; S.wetG = 1; if (!G.headless) { Sound.sfx('roar', 1, 0.7); spat(b.pos.x, b.pos.z, 5, 40); FX.shake(0.6); taiko(0.7); }
    S.roar = 1; yield 0.9; S.roar = 0; b.autoFace = true; yield 0.4;
  }
  function* toDawn(b) {
    const S = b.state; resetMech(b, 2); S.lkT = Object.assign({}, LOOK[1]); b.autoFace = false; Music.intensity(-1);
    S.wash = G.now; S.washK = 1; S.washDur = 2.6; yield 1.0;
    S.lkT.storm = 0; yield 0.6; S.lkT.sun = 1; Co.start(Post.lerpTo(PG[2], 4), 'fight'); S.birdT = 0;
    yield 1.0; S.lkT.bloom = 1; S.lkT.petal = 1;
    if (!G.headless) for (let i = 0; i < 10; i++) setTimeout(() => pluck(i, 0.11), i * 230);
    yield 2.4; if (!G.headless) { Sound.sfx('roar', 0.7, 0.9); taiko(0.5); } S.roar = 1; yield 0.8; S.roar = 0; b.autoFace = true; yield 0.3;
  }

  // ---- intro and death ----
  function* camPath(p0, l0, p1, l1, dur, fov, fn) {
    const c = { pos: new V3(...p0), look: new V3(...l0), fov }; Cam.cine = c; let t = 0;
    while (t < dur) { t += G.dt; const k = smooth(t / dur); c.pos.set(lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k), lerp(p0[2], p1[2], k)); c.look.set(lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k), lerp(l0[2], l1[2], k)); if (fn) fn(sat(t / dur), t); if (Cam.cine !== c) return; yield; }
  }
  // lightning: the sky bolt, and for 80 ms the whole page turns to white paper with one black stroke
  function strike(S, a) { S.bolt = 1; S.boltA = a; S.boltT = G.now; S.boltX = clamp(0.5 + a * 0.3, 0.2, 0.8); }
  function finishIntro(S) { S.introOn = false; S.reveal = 1; S.draw = 1.2; S.eye = 1; S.descend = 0; }

  G.bosses.push({
    id: 'sumi', name: 'GARYO', title: 'The Final Stroke', hint: 'One breath', color: '#e0452c', telegraph: 0xe63a1e,
    hp: 34000, radius: 2.0, aimY: 2.6, enrage: 345, botSaveInterrupt: true,
    post: PG[0],
    music: { bpm: 84, root: 38, scale: [0, 2, 3, 7, 9], prog: [0, 0, 3, 0, 0, 0, 4, 2],
      layers: [
        { v: 'koto', pat: ['0...2.....4.....', '3.....2...0.....'], oct: 1, len: 4, vol: 0.12 },
        { v: 'flute', pat: ['0...............', '4.......3.......'], oct: 2, len: 12, vol: 0.06, to: 1 },
        { v: 'sub', pat: '0...............', oct: -1, len: 16, vol: 0.16 },
        { v: 'bell', pat: '........0.......', vol: 0.04 },
        { v: 'taiko', from: 1, to: 1, pat: 'x.....x.x.....x.', vol: 0.28 },
        { v: 'tom', from: 1, pat: '....x.......x.xx', vol: 0.12 },
        { v: 'bass', from: 1, pat: '0.....0...3.....', oct: -1, vol: 0.12 },
        { v: 'koto', from: 1, to: 1, pat: '0.2.4.2.3.2.0.2.', oct: 2, len: 1, vol: 0.06 },
        { v: 'choir', from: 2, pat: '0.......4.......', oct: 1, len: 8, vol: 0.07 },
        { v: 'brass', from: 2, pat: ['0.......3.......', '4.......2.......'], len: 7, vol: 0.1 },
        { v: 'taiko', from: 2, pat: 'x.xx..x.x.xx.xx.', vol: 0.24 },
        { v: 'koto', from: 2, pat: ['0242302402423024', '3424202434243020'], oct: 2, len: 1, vol: 0.05 },
        { v: 'bell', from: 2, pat: '0...4...2...4...', vol: 0.05 },
        { v: 'flute', from: -1, to: -1, pat: ['0.......2.......', '4...............'], oct: 2, len: 10, vol: 0.08 },
      ] },
    build,
    *intro(b) {
      const S = b.state; S.introOn = true; S.reveal = 0; S.draw = 0; S.eye = 0; S.descend = 1; S.U.uReveal.value = 0; S.birdT = 0.05;
      let pk = 0;
      // 1: the world is painted around you
      yield* camPath([0, 3.2, 25.5], [0, 8.5, -40], [0, 4.6, 21.5], [0, 6.5, -40], 3.6, 52, (k) => { S.reveal = k * 1.02; const q = Math.floor(k * 12); if (q > pk) { pk = q; pluck(q, 0.1); } });
      S.reveal = 1;
      // 2: the dragon drawn in one stroke, tail to head, spiralling down out of the sky
      pk = 0; Sound.sfx('wave', 0.4, 1.4); UI.hideCard();
      yield* camPath([7.0, 1.0, 5.0], [-2, 13, -13], [4.8, 0.9, 2.8], [0, 4.6, -7], 3.5, 54, (k) => { S.draw = k * 1.12; S.descend = 1 - smooth(k * 1.1); const q = Math.floor(k * 9); if (q > pk) { pk = q; pluck(q + 3, 0.09); } });
      S.draw = 1.2; S.descend = 0;
      // 3: the eye is dotted
      let dotted = false, roared = false;
      yield* camPath([4.6, 3.3, 1.8], [0, 3.4, -4.6], [3.6, 3.1, 0.6], [0, 3.3, -4.6], 2.6, 40, (k, t) => {
        if (!dotted && t > 0.7) { dotted = true; S.eye = 1; taiko(0.7); Post.flash(VERM, 0.12, 4); }
        if (!roared && t > 1.25) { roared = true; S.roar = 1; Sound.sfx('roar', 1, 0.75); S.splat = 1; if (S.ovU) S.ovU.uSplatSeed.value = vrand() * 50; FX.shake(0.5); }
      });
      S.roar = 0; finishIntro(S);
    },
    *death(b) {
      const S = b.state; S.dead = true; S.roar = 0; S.sweep = 0; S.galeOn = 0; Sound.sfx('bell', 0.8, 0.5);
      const c0 = camera.position.clone(), l0 = new V3(b.pos.x, 4, b.pos.z), c1 = new V3(b.pos.x * 0.4 + 2, 17, b.pos.z + 30), l1 = new V3(b.pos.x * 0.6, 5.5, b.pos.z - 6);
      const cine = { pos: c0.clone(), look: l0.clone(), fov: 50 }; Cam.cine = cine; let t = 0, stamped = false;
      while (t < 5.0) {
        const rdt = G.dt / Math.max(G.timeScale, 0.05); t += rdt; if (t > 0.5) G.timeScale = 1;
        const k = smooth(t / 4.2); cine.pos.lerpVectors(c0, c1, k); cine.look.lerpVectors(l0, l1, k);
        S.flat = sat(t / 1.6); S.eye = 1 - sat(t / 1.3); S.frame = smooth((t - 1.4) / 1.6);
        if (!stamped && t > 3.2) { stamped = true; S.seal = G.now; taiko(0.8); Sound.sfx('boom', 0.6, 0.7); }
        yield;
      }
    },
    phases: [
      { at: 1, *run(b) {
        resetMech(b, 0); yield 1.0;
        while (true) {
          yield* rake(b); yield 0.8; yield* bamboo(b, false); yield 2.0; yield* drops(b, 3); yield 1.2;
          if (!b.enraged) { yield* oneBreath(b); yield 0.8; } yield* bamboo(b, false); yield 2.0; yield* grind(b); yield* drift(b);
        }
      } },
      { at: 0.66, skipTo(b) { resetMech(b, 1); applyLook(b, 1, true); b.state.wetG = 1; Post.set(PG[1]); }, *enter(b) { yield* toStorm(b); }, *run(b) {
        resetMech(b, 1); yield 0.6;
        while (true) {
          yield* bamboo(b, true); yield 0.6; yield* drops(b, 4); yield 1.2;
          if (!b.enraged) { yield* oneBreath(b); yield 0.6; } yield* gale(b, 3, false); yield 0.3; yield* seal(b); yield* thunder(b); yield 1.2; yield* grind(b); yield* drift(b);
        }
      } },
      { at: 0.33, skipTo(b) { resetMech(b, 2); applyLook(b, 2, true); Post.set(PG[2]); }, *enter(b) { yield* toDawn(b); }, *run(b) {
        resetMech(b, 2); yield 0.6;
        while (true) {
          yield* branch(b); yield 1.2; yield* enso(b); yield* carved(b);
          if (!b.enraged) { yield* oneBreath(b); yield 0.6; } yield* gale(b, 4, true); yield 0.6; yield* branch(b); yield 1.2; yield* grind(b); yield* drift(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, fight = G.state === 'fight' && p && p.alive;
      if (!S.D) return;
      // ---- sim ----
      S.dry = isDry(b);
      if (G.state === 'fight' && !b.transitioning) b.dmgTaken = (S.dry && S.lvl < 2 ? 1.25 : 1) * (S.fig && S.fig.state !== 'done' ? FIG_HOLD : 1); // holding his breath over a figure he is guarded
      if (S.galeOn > 0) { S.galeOn -= dt; if (fight) { p.push.x += S.gwx * 3.2; p.push.z += S.gwz * 3.2; } }
      if (G.state === 'fight' && S.introOn) finishIntro(S);
      figStep(b);
      if (G.headless) return;
      // ---- cosmetics ----
      const U = S.U, t = G.now, D = S.D, P = D.pose, lk = S.lk, lt = S.lkT;
      U.uTime.value = t % 3600;
      lk.storm = damp(lk.storm, lt.storm, lt.storm > lk.storm ? 1.1 : 1.6, dt); lk.sun = damp(lk.sun, lt.sun, 0.9, dt); lk.bloom = lt.bloom > lk.bloom ? Math.min(lt.bloom, lk.bloom + dt / 3.2) : damp(lk.bloom, lt.bloom, 3, dt); lk.petal = damp(lk.petal, lt.petal, 0.8, dt);
      U.uStorm.value = lk.storm; U.uSun.value = lk.sun; U.uBloom.value = lk.bloom; U.uPetal.value = lk.petal; U.uReveal.value = S.reveal;
      // wind: ambient drift, stronger in the storm, one hard direction during a gale
      const gk = S.galeOn > 0 ? 1 : S.galeTell ? 0.55 : 0, amb = 0.22 + lk.storm * 0.5;
      S.wind.x = damp(S.wind.x, gk ? S.gwx * 2.6 * gk : Math.sin(t * 0.13) * amb + amb * 0.6, gk ? 2.5 : 1, dt); S.wind.y = damp(S.wind.y, gk ? S.gwz * 2.6 * gk : Math.cos(t * 0.11) * amb * 0.6, gk ? 2.5 : 1, dt);
      U.uWind.value.copy(S.wind); U.uGale.value = damp(U.uGale.value, gk, 3, dt);
      if (p) S.gU.uPP.value.set(p.pos.x, Math.max(0, p.pos.y), p.pos.z);
      S.gU.uBP.value.set(b.pos.x, sat(S.draw - 1) * 5 * (1 - P.dive), b.pos.z);
      S.gU.uRip.value.set(S.ripX || 0, S.ripZ || 0, S.rip % 3600, sat(1 - (t - S.rip) / 3.5));
      // sky: sun rising, lightning
      S.sunRise = damp(S.sunRise, lt.sun, 0.5, dt); S.skyU.uSunD.value.set(0.0, lerp(-0.12, -0.012, S.sunRise), -1).normalize();
      S.bolt = Math.max(0, S.bolt - dt * 2.2); S.skyU.uBolt.value = S.bolt > 0.6 || (S.bolt > 0.2 && Math.sin(t * 60) > 0) ? S.bolt : 0; S.skyU.uBoltA.value = S.boltA;
      if (S.lvl === 1 && lk.storm > 0.7 && G.state === 'fight' && (S.boltNext -= dt) <= 0) { S.boltNext = 6 + vrand() * 7; strike(S, vrand() * 1.6 - 0.8); Sound.sfx('thunder', 0.35); }
      if (S.rain) S.rain.visible = lk.storm > 0.01;
      // lights and fog follow the mood; the hero stays in colour
      S.hemi.intensity = 1.25 - lk.storm * 0.35 + lk.sun * 0.1; S.sun.intensity = 1.3 - lk.storm * 0.6 + lk.sun * 0.35; S.sun.color.setHex(0xfff0dc).lerp(_c.setHex(0xffc890), lk.sun * 0.5);
      hdr(0xefe7d3, S.fog.color).lerp(hdr(0xb8b2a4, _c), lk.storm * 0.6);
      // birds
      if (S.birdT < 1) { S.birdT += dt / 16; } else if (lk.storm < 0.1 && G.state === 'fight' && (S.birdNext -= dt) <= 0) { S.birdNext = 28 + vrand() * 14; S.birdT = 0; }
      S.birds.visible = S.birdT < 1; S.birdU.uBirdT.value = S.birdT; S.birdU.uBirdA.value = sat(S.birdT * 8) * sat((1 - S.birdT) * 8) * (1 - lk.storm);
      // (r3) the cherry is never cut piecewise near the lens: within 6 m of any branch the whole tree (and its blossoms) fades out quickly
      { const c = camera.position; let md = 1e9; for (const q of S.treePts) { const d = (q.x - c.x) ** 2 + (q.y - c.y) ** 2 + (q.z - c.z) ** 2; if (d < md) md = d; }
        md = Math.sqrt(md); S.treeHide = md < 6 ? 1 : md > 7 ? 0 : S.treeHide; const ta = S.trU.uTreeA; ta.value = S.treeHide ? Math.max(0, ta.value - dt * 6) : Math.min(1, ta.value + dt * 6); }
      S.tree.tree.visible = S.trU.uTreeA.value > 0.001;
      S.tree.pet.visible = lk.petal > 0.01; S.tree.bl.visible = lk.bloom > 0.001 && S.tree.tree.visible;
      // the dragon
      if (!S.dead) D.t += dt * (1 + S.galeOn * 0.1);
      P.rear = damp(P.rear, Math.max(S.rear, S.grind > 0 ? 1 : 0), 6, dt); P.rake = S.rake ? Math.min(1, P.rake + dt * 4) : damp(P.rake, 0, 8, dt);
      P.whip = damp(P.whip, S.whip, 7, dt); P.whipS = S.whipS || 1; P.slump = damp(P.slump, S.slump, 5, dt); P.roar = damp(P.roar, S.roar, 10, dt);
      P.sweep = damp(P.sweep, S.sweep, 2.5, dt); P.sweepA += dt * (0.6 + P.sweep * 1.4); P.dive = damp(P.dive, S.dive, S.dive ? 2.2 : 3.5, dt);
      if (!S.dead) poseDragon(S, b, dt);
      D.root.position.y = -P.dive * 15 + S.descend * 9; D.root.rotation.y = S.descend * 2.6;
      const inkV = b.enraged ? 1 : sat((S.ink - 0.15) / 0.8) * (S.dry ? 0.45 : 1);
      D.U.uInk.value = damp(D.U.uInk.value, inkV, 2, dt); D.U.uGrind.value = S.grind; D.U.uDraw.value = S.draw; D.U.uFlat.value = S.flat; D.U.uNear.value = damp(D.U.uNear.value, !Cam.cine && !S.dead && !S.introOn ? 1 : 0, 4, dt);
      S.wetG = damp(S.wetG, S.lvl === 1 ? 1 : 0, 0.4, dt); D.U.uWetG.value = S.wetG;
      for (const pu of D.pupils) { pu.visible = S.eye > 0.01; pu.scale.set(0.5 * S.eye, S.eye, 0.7 * S.eye); }
      // which coils get out of the way: tested on the un-ducked pose so a coil that has sunk does not bob straight back up
      if (p) { const c = camera.position, sx = p.pos.x - c.x, sy = p.pos.y + 1.0 - c.y, sz = p.pos.z - c.z, l2 = Math.max(sx * sx + sy * sy + sz * sz, 1e-6), cf = Math.cos(b.facing), sf = Math.sin(b.facing), ry = D.root.position.y, live = !Cam.cine && !S.dead;
        // squared distance from a body point (dragon space) to the lens-hero sightline, with the lens-to-point distance in _lens
        let _lens = 0, _k = 0; const sd2 = (qx, qy, qz) => { const wx = b.pos.x + qx * cf + qz * sf, wy = qy + ry, wz = b.pos.z - qx * sf + qz * cf;
          _k = clamp(((wx - c.x) * sx + (wy - c.y) * sy + (wz - c.z) * sz) / l2, 0, 1); const dx = c.x + sx * _k - wx, dy = c.y + sy * _k - wy, dz = c.z + sz * _k - wz;
          _lens = Math.sqrt((wx - c.x) ** 2 + (wy - c.y) ** 2 + (wz - c.z) ** 2); return dx * dx + dy * dy + dz * dz; };
        // which coils get out of the way: anything inside a 2.5 m capsule from the lens to the hero sinks flat to the floor. Tested on the
        // un-ducked pose so a coil that has sunk does not bob straight back up.
        const R0 = D.cpRaw, dk = D.duckT; dk.fill(0);
        const blocks = (qx, qy, qz, r) => { const d2 = sd2(qx, qy, qz), rr = 2.5 + r; return (_k > 0.02 && _k < 0.97 && d2 < rr * rr) || _lens < r + 3.5; };
        if (live) for (let j = 4; j < 12; j++) { const r = bodyR(j / 11);
          if (blocks(R0[j].x, R0[j].y, R0[j].z, r)) dk[j] = 1;
          if (j < 11 && blocks((R0[j].x + R0[j + 1].x) / 2, (R0[j].y + R0[j + 1].y) / 2, (R0[j].z + R0[j + 1].z) / 2, r)) dk[j] = dk[j + 1] = 1; }
        for (let j = 0; j < 12; j++) D.duck[j] = damp(D.duck[j], dk[j], dk[j] ? 3.6 : 1.3, dt);
        // per body ring, on the posed (ducked) body: a ring still on the sightline washes out (with its spine cards); a ring at the lens is cut away
        const fv = D.fdV, fa = D.fd.array, TS1 = D.ts + 1; let hit = false;
        for (let i = 0; i < NB; i++) { const q = D.C[i], r = bodyR(i / (NB - 1)), d2 = sd2(q.x, q.y, q.z), bl = live && _k > 0.03 && _k < 0.97 && d2 < (r + 1.0) ** 2, cut = live && _lens < r + 6.5;
          fv[i] = damp(fv[i], bl ? 1 : 0, bl ? 9 : 3, dt); if (bl) hit = true; const v = cut ? 2 : fv[i] < 0.01 ? 0 : fv[i];
          if (fa[i * TS1] !== v) fa.fill(v, i * TS1, (i + 1) * TS1); D.fdT[i] = v; }
        D.fd.needsUpdate = true;
        const ac = D.aCd.array; for (let i = 0; i < NSP; i++) ac[i * 4 + 3] = D.fdT[Math.min(NB - 3, 1 + Math.round(i / (NSP - 1) * (NB - 5)))]; for (let i = 0; i < NTT; i++) ac[(NSP + i) * 4 + 3] = D.fdT[NB - 1]; D.aCd.needsUpdate = true;
        D.fadeA = damp(D.fadeA, hit ? 0.45 : 1, 8, dt); D.U.uFade.value = D.fadeA > 0.98 ? 1.01 : D.fadeA; // the mist puffs
        // the head only pales to a grey I3 wash with its line kept (r3: also while casting, so it never hides the hero); the camera keeps clear of it,
        // and tilts up a little while the head is close over the hero
        D.head.getWorldPosition(_a); S.headW.copy(_a); S.camUp = damp(S.camUp || 0, live && Math.hypot(_a.x - p.pos.x, _a.z - p.pos.z) < 6 ? 1 : 0, 2, dt);
        _a.addScaledVector(_b.set(Math.sin(b.facing), 0, Math.cos(b.facing)), 1.2); const hk = clamp(((_a.x - c.x) * sx + (_a.y - c.y) * sy + (_a.z - c.z) * sz) / l2, 0, 1), hx = c.x + sx * hk - _a.x, hy = c.y + sy * hk - _a.y, hz = c.z + sz * hk - _a.z;
        const hhit = !Cam.cine && hk > 0.05 && hk < 0.85 && hx * hx + hy * hy + hz * hz < 2.2;
        D.fadeH = damp(D.fadeH, hhit ? 0.55 : 1, 6, dt); D.U.uFadeH.value = D.fadeH > 0.98 ? 1.01 : D.fadeH; }
      // the wet floor reflects the body, the head and the far coil
      if (lk.storm > 0.002) { const cf = Math.cos(b.facing), sf = Math.sin(b.facing), ry = D.root.position.y, R = S.gU.uRf.value, put = (v, q, h, w) => v.set(b.pos.x + q.x * cf + q.z * sf, b.pos.z - q.x * sf + q.z * cf, Math.max(0, h), w);
        put(R[0], D.C[14], D.C[14].y + ry + 1.5, 4.5); put(R[1], D.head.position, D.head.position.y + ry + 1.0, 3.0); put(R[2], D.C[34], D.C[34].y + ry + 1.0, 3.2); }
      // seal block falling onto the player
      const SB = S.sealBlock;
      if (S.sealH && S.sealH.state === 'tele') { const h = S.sealH, k = sat(h.t / h.delay), s = h.shape; SB.visible = true; SB.position.set(s.x + Math.sin(s.dir) * 4, lerp(26, 1.1, k * k * k), s.z + Math.cos(s.dir) * 4); SB.rotation.set(0, s.dir, 0); }
      else if (S.sealHitT > 0 && t - S.sealHitT < 1.2) { SB.visible = true; SB.position.y = 1.1 - sat((t - S.sealHitT - 0.3) / 0.9) * 2.6; }
      else { SB.visible = false; if (S.sealH && S.sealH.state !== 'tele') S.sealH = null; }
      // leaf and petal shapes on their bullets
      { const BQ = S.bq, M = BQ.mesh, GB = BQ.glb, SH = BQ.sh; let n = 0;
        for (const q of Bul.list) { if (!q.kind || n >= BQ.n) continue; const pet = q.kind === 'petal', s = q.r * (q.t < 0.15 ? q.t / 0.15 : 1);
          _m.position.set(q.x, q.y + 0.05, q.z); _m.rotation.set(Math.sin(t * 5 + q.t * 7) * 0.25, q.dir + Math.sin(t * 6 + q.t * 3) * 0.4, 0); _m.scale.set(pet ? 1.2 : 0.95, 1, pet ? 1.2 : 1.9); _m.updateMatrix(); M.setMatrixAt(n, _m.matrix); M.setColorAt(n, _c.setRGB(pet ? 1 : 0, 0, 0));
          _m.position.set(q.x, q.y, q.z); _m.rotation.set(0, q.dir, 0); _m.scale.set(s * 1.3, s * 1.3, s * 1.5); _m.updateMatrix(); GB.setMatrixAt(n, _m.matrix); GB.setColorAt(n, _c.setRGB(pet ? 1 : 0, (n * 0.37) % 1, 0));
          const bs = 0.9 + Math.min(1.2, q.t * 0.5); _m.position.set(q.x, 0.04, q.z); _m.rotation.set(0, q.dir, 0); _m.scale.set(bs, 1, bs * 1.25); _m.updateMatrix(); SH.setMatrixAt(n, _m.matrix); SH.setColorAt(n, _c.setRGB(pet ? 1 : 0, (n * 0.37) % 1, 0)); n++; }
        M.count = GB.count = SH.count = n; if (n) for (const X of [M, GB, SH]) { X.instanceMatrix.needsUpdate = true; X.instanceColor.needsUpdate = true; } }
      syncTele(S); syncFigure(S, b, t, dt);
      // the Enso stroke: telegraph wash, the brush sweeping round with the walls, then drying and fading after the cast
      if (S.ensoV) { const E = S.ensoV, el = t - E.t0, u = S.eU.uE.value;
        if (S.enso) E.al = Math.min(1, E.al + dt * 4); else { E.al -= dt * 1.4; E.dry = Math.min(1, E.dry + dt * 2); }
        if (E.al <= 0) { S.ensoV = null; S.ensoM.visible = false; }
        else { S.ensoM.visible = true; u.set(E.a0, E.L, clamp((el - E.fire0 + E.step) / E.step * E.arc, 0, E.L + 0.05), E.al); S.eU.uE2.value.set(sat(el / Math.max(E.fire0, 0.1)), E.dry, 0, 0); } }
      // screen washes, the roar's spatter, the scroll mounting and seal
      if (S.ovU) { const O = S.ovU; renderer.getDrawingBufferSize(O.uRes.value);
        O.uWash.value = S.wash > 0 ? sat((t - S.wash) / S.washDur) : 0; O.uWashK.value = S.washK;
        S.splat = Math.max(0, S.splat - dt / 2.6); O.uSplat.value = smooth(S.splat); O.uFrame.value = S.frame; O.uSeal.value = S.seal > 0 ? sat((t - S.seal) / 0.6) : 0;
        const bt = t - S.boltT; O.uBoltF.value = bt < 0 || bt > 0.3 ? 0 : bt < 0.08 ? 1 : Math.max(0, 1 - (bt - 0.08) / 0.16); O.uBoltX.value = S.boltX; }
    },
    danger(b, x, z) {
      const S = b.state; if (!S.enso) return Infinity; const r = Math.hypot(x, z);
      if (r > 9.3 && r < 12.7 && Math.abs(angDiff(S.enso.gapA, Math.atan2(x, z))) > 27.5 * PI / 180 && S.enso.walls.length) return 0.3;
      return Infinity;
    },
    bot(b, p) {
      const S = b.state, out = {};
      // One Breath: level 3 starts on a joint that works and follows a full route; lower levels start at the nearest joint and take the
      // nearest line they can ink, so they sometimes paint themselves into a corner
      if (S.fig && S.fig.state !== 'done') { const F = S.fig, J = F.J, near = (js) => { let bj = -1, bd = 1e9; for (const j of js) { const d = Math.hypot(J[j].x - p.pos.x, J[j].z - p.pos.z); if (d < bd) { bd = d; bj = j; } } return bj; };
        let tj = -1;
        if (F.cur < 0) tj = near(Bot.level >= 3 ? F.starts : F.used);
        else { if (Bot.level >= 3) { if (F.botKey !== F.cur * 1024 + F.mask) { F.botKey = F.cur * 1024 + F.mask; F.botR = figSolve(F, F.cur, F.mask, F.eye); } if (F.botR && F.botR.length) tj = F.botR[0]; }
          if (tj < 0) tj = near(figMoves(F, F.cur, F.mask).map(([, j]) => j)); } // no full route left: ink what it still can
        if (tj >= 0) { let x = J[tj].x, z = J[tj].z;
          // level 3 walks round any other joint on the way, so the brush goes down (and lines are inked) only where it means to
          if (Bot.level >= 3) for (const j of F.used) { if (j === tj || j === F.cur || figSegD(J[j].x, J[j].z, p.pos, J[tj]) > 2.2) continue;
            const dx = x - p.pos.x, dz = z - p.pos.z, dl = Math.hypot(dx, dz) || 1, nx = -dz / dl, nz = dx / dl, sg = (p.pos.x - J[j].x) * nx + (p.pos.z - J[j].z) * nz < 0 ? -1 : 1;
            x = J[j].x + nx * sg * 2.9; z = J[j].z + nz * sg * 2.9; break; }
          out.x = x; out.z = z; out.w = 3; }
        out.holdFire = !!p.cls.melee; // a blade cannot reach him from the figure; no gap-closer drags the brush off its line
        return out; }
      if (S.enso) { const E = S.enso, r = Math.hypot(p.pos.x, p.pos.z), pa = Math.atan2(p.pos.x, p.pos.z), gd = angDiff(pa, E.gapA), gx = Math.sin(E.gapA), gz = Math.cos(E.gapA);
        // straight across the ring while the stretch in front is still unpainted, otherwise out through the gap where the brush lifted
        const rel = (((pa - E.gapA - E.gap / 2) % TAU) + TAU) % TAU, si = rel < TAU - E.gap ? Math.floor(rel / E.arc) : -1, left = si < 0 ? 99 : E.t0 + E.fire0 + E.step * si - G.now;
        if (E.inside && r < 13.2) { if (left > (13.8 - r) / 7 + 0.35) { out.x = Math.sin(pa) * 15; out.z = Math.cos(pa) * 15; } else if (r < 9.5 && Math.abs(gd) > 0.22) { out.x = gx * 7.5; out.z = gz * 7.5; } else { out.x = gx * 15.5; out.z = gz * 15.5; } out.w = 3; }
        else if (!E.inside && r > 8.8) { if (left > (r - 8.2) / 7 + 0.35) { out.x = Math.sin(pa) * 6.5; out.z = Math.cos(pa) * 6.5; } else if (r > 12.5 && Math.abs(gd) > 0.22) { const a = pa + clamp(gd, -0.6, 0.6); out.x = Math.sin(a) * 15.5; out.z = Math.cos(a) * 15.5; } else { out.x = gx * 6; out.z = gz * 6; } out.w = 3; }
        return out; }
      if (S.carved) { let best = null, bd = 1e9; for (const c of S.carved.cells) { const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z); if (d < bd) { bd = d; best = c; } } if (best) { out.x = best.x; out.z = best.z; out.w = 3; } return out; }
      // a player who knows the fight keeps clear of where wet pools will have spread to, and of leaves that have not grown yet
      const lp = S.leafPred, bl = S.bleed.filter((h) => h.state !== 'done');
      if (lp.length || bl.length) out.avoid = (x, z) => lp.some((c) => Hz.inShape(c, x, z)) || bl.some((h) => Math.hypot(x - h.shape.x, z - h.shape.z) < (h.rmax || 4.2) + 0.5);
      return out;
    },
  });
})();
