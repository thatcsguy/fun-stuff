// DOOR XX: GARYO, the Final Stroke. A mountain scroll in mist and a dragon painted without eyes. Ink is alive while it is wet; a dry brush leaves gaps.
(() => {
  const R = 21, VERM = 0xe63a1e, GOLD = 0xe9c46a, EXPO = 2.0, DRY_AT = 0.45;
  const COST = { rake: 0.08, bamboo: 0.28, drops: 0.14, seal: 0.10, thunder: 0.25, branch: 0.28, enso: 0.30, carved: 0.10 };
  // Phase grades. The world is painted for a tone-mapped exposure of EXPO (see outc below), so the plan's exposures are scaled by it.
  const PG = [{ bloom: 0.18, threshold: 1.0, radius: 0.5, exposure: EXPO, vig: 0.55, sat: 0.95, contrast: 1.04, tint: [1.0, 1.0, 1.0] }];
  PG[1] = Object.assign({}, PG[0], { bloom: 0.22, exposure: EXPO * 0.9, vig: 0.8, sat: 0.8, contrast: 1.12, tint: [0.97, 0.99, 1.03] });
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
const vec3 VER = ${vc(VERM)}, PK = ${vc(0xf2a6b8)}, PK2 = ${vc(0xd9728c)}, GLD = ${vc(0xf3dca0)}, SILK = ${vc(0x2e3a34)}, SILK2 = ${vc(0x48574c)}, OCH = ${vc(0xb8955a)};
const mat3 MINI = ${g3(MIN)}, MOUTI = ${g3(MOUT)};
float hh(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return s * 1.0667; }
vec3 tone(float s, float n){ s = clamp(s + (n - 0.5) * 0.08, 0.0, 1.0); vec3 c = mix(I0, I1, smoothstep(0.13, 0.18, s)); c = mix(c, I2, smoothstep(0.33, 0.38, s)); c = mix(c, I3, smoothstep(0.53, 0.58, s)); c = mix(c, I4, smoothstep(0.72, 0.77, s)); return mix(c, PAPER, smoothstep(0.89, 0.94, s)); }
float kas(vec2 uv, float amt){ float n = vn(vec2(uv.x * 2.0, uv.y * 40.0)) * 0.6 + vn(vec2(uv.x * 5.0, uv.y * 110.0)) * 0.4; return smoothstep(amt - 0.1, amt + 0.1, n); }
vec3 outc(vec3 y){ y = clamp(MOUTI * clamp(y, 0.0, 1.0), 0.0, 0.985); vec3 A = 0.983729 * y - 1.0, B = 0.432951 * y - 0.0245786, C = 0.238081 * y + 0.000090537;
  vec3 x = (-B - sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A); return max(MINI * x, 0.0) * ${(0.6 / EXPO).toFixed(5)}; }
float bayer(vec2 p){ vec2 q = mod(floor(p), 4.0); const float BM[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0); return (BM[int(q.y) * 4 + int(q.x)] + 0.5) / 16.0; }
`;
  const VH = 'uniform float uTime, uReveal, uStorm, uSun, uBloom, uPetal, uGale, uCut; uniform vec2 uWind;\n';
  const VW = 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
  // bamboo: world position at height h along a leaning, swaying stalk (shared by culms and leaves)
  const STALK = `vec3 stalkAt(float h, float H, vec2 lean, float ph, vec2 base){
    float k = clamp(h / max(H, 0.1), 0.0, 1.0);
    vec2 sway = uWind * (0.75 + 0.25 * sin(uTime * 1.3 + ph * 6.283)) + vec2(sin(uTime * 0.7 + ph * 9.0), cos(uTime * 0.6 + ph * 7.0)) * 0.06;
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
    g.setAttribute('aS', new THREE.BufferAttribute(S, 1)); g.setAttribute('aK', new THREE.BufferAttribute(K, 1)); g.setAttribute('aSc', new THREE.BufferAttribute(SC, 2)); g.setAttribute('aBelly', new THREE.BufferAttribute(BE, 1));
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
  function buildSky(S, g) {
    S.skyU = { uSunD: { value: new V3(0, -0.12, -1).normalize() }, uBolt: { value: 0 }, uBoltA: { value: 0.5 } };
    const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), smat(S.U, 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }', `
      varying vec3 vD; uniform vec3 uSunD; uniform float uBolt, uBoltA;
      void main(){
        vec3 d = vD / max(length(vD), 1e-4); float h = d.y; float hz = length(d.xz); vec2 cs = d.xz / max(hz, 1e-4); float az = atan(d.x, -d.z);
        float n = vn(cs * 3.0 + vec2(h * 4.0, 0.0)), n2 = vn(cs * 9.0 + vec2(0.0, h * 9.0));
        vec3 col = mix(PAPER, PSH, clamp(smoothstep(0.05, 0.9, h) * 0.3 + (n - 0.5) * 0.18 + (n2 - 0.5) * 0.05, 0.0, 1.0));
        if (uStorm > 0.002) {
          vec2 q = cs * 1.7 + vec2(h * 2.2, -h * 1.4) + vec2(uTime * 0.012, uTime * 0.005);
          float c = fbm(q * 1.5 + 4.0);
          float desc = smoothstep(1.05 - uStorm * 1.15, 1.25 - uStorm * 1.15, h + (c - 0.5) * 0.6);
          float cov = smoothstep(0.3, 0.55, c + (1.0 - smoothstep(-0.05, 0.3, h)) * 0.25) * desc;
          float wet = smoothstep(0.38, 0.42, c) - smoothstep(0.42, 0.5, c);
          col = mix(col, mix(I3, I1, smoothstep(0.5, 0.85, c)), cov * 0.92);
          col = mix(col, I2, wet * desc * 0.5);
          float X = az * 160.0 + h * 60.0 * (0.4 + uGale), hc = hh(vec2(floor(X), 7.0));
          float seg = fract(h * (3.0 + hc * 3.0) + uTime * (1.5 + hc));
          float rain = step(0.93, hc) * smoothstep(0.0, 0.1, seg) * (1.0 - smoothstep(0.25, 0.4, seg)) * (1.0 - smoothstep(0.1, 0.45, abs(fract(X) - 0.5))) * smoothstep(-0.1, 0.25, h);
          col = mix(col, I3, rain * 0.6 * uStorm);
          if (uBolt > 0.002) { float bx = uBoltA + (vn(vec2(h * 14.0, 3.0)) - 0.5) * 0.08 + (vn(vec2(h * 45.0, 9.0)) - 0.5) * 0.025; float bw = 0.004 + 0.004 * (1.0 - h);
            float bolt = (1.0 - smoothstep(bw * 0.5, bw, abs(az - bx))) * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.75, 0.95, h)); col = mix(col, I0, bolt * uBolt); col = mix(col, PAPER, uBolt * 0.25 * (1.0 - bolt)); }
        }
        float disc = 0.0;
        if (uSun > 0.002) {
          float cd = clamp(dot(d, uSunD), -1.0, 1.0), ang = acos(cd);
          col = mix(col, GLD, uSun * (exp(-ang * 2.2) * 0.75 + (1.0 - smoothstep(-0.05, 0.5, h)) * 0.2));
          float edge = 0.072 + (vn(d.xy * 90.0 + d.z * 40.0) - 0.5) * 0.006;
          disc = (1.0 - smoothstep(edge - 0.003, edge + 0.004, ang)) * uSun;
          col = mix(col, VER, disc);
        }
        gl_FragColor = vec4(outc(col) + vec3(0.9, 0.02, 0.0) * disc, 1.0);
      }`, S.skyU, { side: THREE.BackSide, depthWrite: false }));
    m.renderOrder = -100; m.frustumCulled = false; m.onBeforeRender = () => { m.position.copy(camera.position); }; g.add(m); S.sky = m;
  }

  function buildGround(S, g) {
    S.gU = { uPP: { value: new V3() }, uBP: { value: new V3() }, uRip: { value: new THREE.Vector4(0, 0, -100, 0) } };
    const m = new THREE.Mesh(new THREE.CircleGeometry(27, 128), smat(S.U, VW, `
      varying vec3 vW; uniform vec3 uPP, uBP; uniform vec4 uRip;
      void main(){
        vec2 p = vW.xz; float r = length(p); vec2 cs = p / max(r, 1e-3); float az = atan(p.x, -p.y);
        float n1 = fbm(p * 0.07 + 3.0), n2 = vn(p * 0.45), n3 = vn(p * 1.9 + 7.0);
        float rvW = clamp((uReveal - 0.3) / 0.35, 0.0, 1.0), rvR = clamp((uReveal - 0.38) / 0.22, 0.0, 1.0);
        vec3 base = mix(mix(PAPER, PSH, smoothstep(0.45, 0.9, n1) * 0.5), mix(PSH, I4, 0.35), uStorm * 0.55);
        float ink = 0.0;
        float inner = 1.0 - smoothstep(${(R - 1).toFixed(1)}, ${(R + 0.5).toFixed(1)}, r);
        // pale washes with darker wet edges
        float w = fbm(vec2(p.x * 0.055 + p.y * 0.012, p.y * 0.11 - p.x * 0.01) + 11.0) + (n3 - 0.5) * 0.04;
        float wash = smoothstep(0.62, 0.66, w), wedge = smoothstep(0.62, 0.64, w) - smoothstep(0.64, 0.7, w);
        ink = max(ink, (wash * 0.11 + wedge * 0.16) * inner * rvW);
        // concentric dry-brush arcs: the terrace swept with a dry brush
        float st = vn(vec2(r * 3.2, az * r * 0.06 + 40.0)) * 0.7 + vn(vec2(r * 9.0, az * r * 0.2)) * 0.3;
        float arcs = smoothstep(0.66, 0.74, st) * smoothstep(0.42, 0.62, n1) * smoothstep(2.5, 5.0, r);
        ink = max(ink, arcs * 0.2 * inner * rvW);
        // moss dots crowding the rim
        vec2 cg = p / 0.9, ci = floor(cg), cf = fract(cg); vec2 off = vec2(hh(ci + 1.7), hh(ci + 9.1)) * 0.6 + 0.2;
        float dens = smoothstep(${(R - 5).toFixed(1)}, ${(R - 0.8).toFixed(1)}, r) * (1.0 - smoothstep(${(R + 1.5).toFixed(1)}, ${(R + 4).toFixed(1)}, r)) * smoothstep(0.3, 0.6, n2);
        float dt = (1.0 - smoothstep(0.07, 0.15 + 0.1 * hh(ci + 3.3), length((cf - off) * vec2(1.0, 1.6)))) * step(hh(ci + 5.3), dens * 0.75);
        ink = max(ink, dt * 0.88 * rvR);
        // the terrace rim: one wobbling contour stroke, broken by a dry brush
        float rimR = ${R.toFixed(1)} + (vn(cs * 3.0) - 0.5) * 0.8 + (vn(cs * 26.0) - 0.5) * 0.12;
        float wid = 0.2 + 0.2 * vn(cs * 6.0 + 2.0), dr = r - rimR;
        float rimL = (1.0 - smoothstep(wid * 0.55, wid, abs(dr))) * mix(1.0, kas(vec2(az * r * 0.05, dr * 1.2), 0.32), 0.85);
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
          float sw = vn(vec2(p.x * 0.05 + p.y * 0.02, p.y * 1.1 - p.x * 0.3) + 4.0) * 0.7 + vn(p * 0.3) * 0.3;
          ink = max(ink, smoothstep(0.66, 0.8, sw) * 0.2 * uStorm * inner);
          vec2 rg = p / 1.6, ri = floor(rg), rf = fract(rg) - 0.5; float ph = fract(uTime * 1.1 + hh(ri) * 7.0);
          float rl = abs(length(rf - (vec2(hh(ri + 2.0), hh(ri + 4.0)) - 0.5) * 0.4) - ph * 0.42);
          ink = max(ink, (1.0 - smoothstep(0.0, 0.025, rl)) * (1.0 - ph) * 0.42 * uStorm * step(hh(ri + 6.0), 0.4));
        }
        // gale: pale streaks racing downwind
        if (uGale > 0.002) { vec2 wd = uWind / max(length(uWind), 1e-3); float a1 = dot(p, wd), a2 = dot(p, vec2(-wd.y, wd.x));
          ink = max(ink, smoothstep(0.78, 0.9, vn(vec2(a2 * 4.0, a1 * 0.08 - uTime * 2.2))) * 0.2 * uGale * inner); }
        // the dragon diving into the paper: rings spreading from where he went in
        if (uRip.w > 0.002) { float d = length(p - uRip.xy), ph = d - (uTime - uRip.z) * 6.0;
          ink = max(ink, smoothstep(0.86, 0.98, cos(ph * 2.0)) * step(ph, 0.0) * exp(ph * 0.12) * uRip.w * (1.0 - smoothstep(12.0, 24.0, d)) * 0.7); }
        vec3 c = mix(base, tone(1.0 - ink, n3), smoothstep(0.02, 0.07, ink));
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
    const L = [[55, 30, 1.0, 3.1], [80, 23, 0.82, 11.7], [110, 17, 0.66, 23.3], [150, 13, 0.5, 37.9], [210, 11, 0.38, 51.1]];
    const mat0 = smat(S.U, VW, `
      varying vec3 vW; uniform vec4 uL; uniform vec2 uRW; uniform float uFall;
      float ridge(vec2 cs){ float s = 0.0, a = 0.5, f = 1.0; for (int i = 0; i < 4; i++){ float n = vn(cs * (2.4 * f) + uL.w + float(i) * 7.3); s += a * (1.0 - abs(n * 2.0 - 1.0)); f *= 2.3; a *= 0.5; } return s / 0.9375; }
      void main(){
        float r = length(vW.xz); vec2 cs = vW.xz / max(r, 1e-3); float az = atan(vW.x, -vW.z);
        float rg = clamp(ridge(cs), 0.0, 1.0);
        float mass = 0.35 + 0.65 * vn(cs * 1.3 + uL.w + 50.0);
        float valley = mix(uL.x < 60.0 ? 0.22 : 0.8, 1.0, smoothstep(0.08, 0.5, abs(az)));
        float H = uL.y * pow(rg, 1.5) * mass * valley * 1.8 - 2.0;
        float y = vW.y, dy = H - y, aa = max(fwidth(y), 1e-3) * 1.2;
        float sil = smoothstep(-aa, aa, dy);
        if (sil < 0.004) discard;
        float lw = (0.35 + r * 0.006) * (1.0 + uStorm * 1.4);
        float line = 1.0 - smoothstep(lw * 0.4, lw * 1.5, dy + (vn(cs * 70.0 + y * 0.3) - 0.5) * lw * 1.2);
        float fade = exp(-max(dy, 0.0) / (5.0 + uL.y * 0.2 + uStorm * 6.0));
        float cun = kas(vec2(y * 0.05, az * r * 0.035 + uL.w), 0.5);
        float dark = max(line * 0.95, fade * (0.42 + 0.4 * cun) * (0.55 + 0.45 * vn(cs * 18.0 + y * 0.06)));
        dark *= uL.z * (1.0 - uStorm * 0.3);
        dark *= smoothstep(-4.0, uL.y * 0.5, y + (fbm(cs * 7.0 + vec2(y * 0.04, 0.0)) - 0.5) * uL.y * 0.35);
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
      mt.uniforms.uL = { value: new THREE.Vector4(r, h, k, seed) }; mt.uniforms.uRW = { value: new THREE.Vector2(0.02 + (4 - i) * 0.07, 0.3 + (4 - i) * 0.07) }; mt.uniforms.uFall = { value: i === 0 ? 1 : 0 };
      const geo = new THREE.CylinderGeometry(r, r, h * 2 + 30, 160, 1, true); geo.translate(0, h - 3, 0);
      const m = new THREE.Mesh(geo, mt); m.renderOrder = -90 + (4 - i) * 2; m.frustumCulled = false; g.add(m); return m;
    });
    mat0.dispose();
  }

  function buildMist(S, g, low) {
    const bands = low ? [[34, 0, 7, 0.75], [95, 2, 18, 0.6]] : [[31, -1, 6.5, 0.7], [50, 0, 10, 0.75], [72, 1, 15, 0.6], [100, 3, 20, 0.55], [135, 4, 26, 0.5]];
    const mat0 = smat(S.U, VW, `
      varying vec3 vW; uniform vec4 uM;
      void main(){
        float r = length(vW.xz); vec2 cs = vW.xz / max(r, 1e-3); float y = vW.y;
        float n = vn(cs * 5.0 + vec2(y * 0.12, uTime * 0.025 + uM.x)) * 0.65 + vn(cs * 13.0 + vec2(-uTime * 0.04, y * 0.25)) * 0.35;
        float a = (1.0 - smoothstep(uM.y, uM.z, y + (n - 0.5) * (uM.z - uM.y) * 1.1)) * uM.w * (0.75 + 0.25 * n);
        vec3 c = mix(PAPER, I4, uStorm * 0.35 * n);
        gl_FragColor = vec4(outc(c), clamp(a, 0.0, 1.0));
      }`, {}, { transparent: true, depthWrite: false, side: THREE.BackSide });
    S.mist = bands.map(([r, y0, y1, a]) => {
      const mt = mat0.clone(); for (const key in S.U) mt.uniforms[key] = S.U[key]; mt.uniforms.uM = { value: new THREE.Vector4(r, y0, y1, a) };
      const geo = new THREE.CylinderGeometry(r, r, y1 - y0 + 12, 96, 1, true); geo.translate(0, (y0 + y1) / 2, 0);
      const m = new THREE.Mesh(geo, mt); m.renderOrder = -90 + (r < 60 ? 12 : r < 85 ? 9 : r < 115 ? 7 : r < 150 ? 5 : 3); m.frustumCulled = false; g.add(m); return m;
    });
    mat0.dispose();
  }

  function buildBamboo(S, g, low) {
    const rng = mulberry(91), stalks = [], groves = [[0.3, 1.95, 34], [-1.95, -0.3, 32], [2.2, 2.62, 8]];
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
        vec3 wp = c + vec3(rt.x, 0.0, rt.y) * position.x * aP.x * 1.8;
        vUv = vec2(position.x + 0.5, position.y); vTone = aP.y; vSegL = (aS.w - aS.z) * grow; vSeed = aP.z; vNear = smoothstep(2.0, 6.0, length(wp - cameraPosition));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`, `varying vec2 vUv; varying float vTone, vSegL, vSeed, vNear;
      void main(){
        if (bayer(gl_FragCoord.xy) > vNear) discard;
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
        vec3 wp = base + dir * position.y * aD.w * grow + side * position.x * aQ.x * grow * 2.0;
        vUv = vec2(position.x + 0.5, position.y); vTone = aQ.y; vSeed = aQ.z; vNear = smoothstep(2.0, 6.0, length(wp - cameraPosition));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`, `varying vec2 vUv; varying float vTone, vNear, vSeed;
      void main(){
        if (bayer(gl_FragCoord.xy) > vNear) discard;
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
  const TREE = [-18.7, -14.3];
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
    const tm = smat(S.U, `attribute float aT; varying vec3 vN, vW; varying vec2 vUv; varying float vT;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = mat3(modelMatrix) * normal; vUv = uv; vT = aT; gl_Position = projectionMatrix * viewMatrix * wp; }`, `
      varying vec3 vN, vW; varying vec2 vUv; varying float vT;
      void main(){
        if (vT > (uReveal - 0.6) / 0.3) discard;
        if (bayer(gl_FragCoord.xy) > smoothstep(2.5, 7.0, length(vW - cameraPosition))) discard;
        vec3 n = vN / max(length(vN), 1e-4), vd = cameraPosition - vW; vd /= max(length(vd), 1e-4);
        float fr = 1.0 - clamp(abs(dot(n, vd)), 0.0, 1.0), ndl = dot(n, normalize(vec3(-0.4, 0.75, 0.5))) * 0.5 + 0.5;
        float k = kas(vec2(vUv.y * 0.6, vUv.x * 1.5), 0.42);
        float bark = smoothstep(0.7, 0.8, vn(vec2(vUv.x * 5.0, vUv.y * 9.0)));
        float dark = max(smoothstep(0.45, 0.85, fr), (0.35 + 0.45 * (1.0 - ndl)) * (0.45 + 0.55 * k) + bark * 0.3);
        gl_FragColor = vec4(outc(tone(1.0 - clamp(dark, 0.0, 1.0), vn(vUv * 9.0))), 1.0);
      }`);
    const tree = new THREE.Mesh(tg, tm); g.add(tree);
    // blossoms
    const nB = low ? 600 : 1200, bg = new THREE.PlaneGeometry(1, 1), aB = iattr(nB, 4), aC = iattr(nB, 4);
    for (let i = 0; i < nB; i++) { const [bp, bt, dep] = buds[Math.floor(rng() * buds.length)], rr = 0.35 + rng() * (dep >= 4 ? 1.1 : 0.7); const a = rng() * TAU, e = (rng() - 0.3) * 1.6;
      aB.setXYZW(i, bp.x + Math.cos(e) * Math.sin(a) * rr, bp.y + Math.sin(e) * rr * 0.7, bp.z + Math.cos(e) * Math.cos(a) * rr, 0.22 + rng() * 0.16); aC.setXYZW(i, bt / tmax * 0.85 + rng() * 0.12, rng() * TAU, rng(), 0); }
    bg.setAttribute('aB', aB); bg.setAttribute('aC', aC);
    const bm = smat(S.U, `attribute vec4 aB, aC; varying vec2 vUv; varying float vRot, vSeed, vNear;
      void main(){
        float sc = aB.w * smoothstep(aC.x, aC.x + 0.04, uBloom);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 wp = aB.xyz + (right * position.x + up * position.y) * sc * 2.0;
        vUv = position.xy * 2.0; vRot = aC.y; vSeed = aC.z; vNear = smoothstep(2.0, 5.0, length(aB.xyz - cameraPosition));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`, `varying vec2 vUv; varying float vRot, vSeed, vNear;
      void main(){
        if (bayer(gl_FragCoord.xy) > vNear) discard;
        float r = length(vUv), a = atan(vUv.y, vUv.x) + vRot;
        float pet = 0.62 + 0.38 * pow(abs(cos(a * 2.5)), 0.6);
        float m = 1.0 - smoothstep(pet * 0.95 - 0.12, pet * 0.95, r);
        if (m < uCut) discard;
        vec3 c = mix(PK, mix(PAPER, PK, 0.55), smoothstep(0.15, 0.75, r) * (0.6 + 0.4 * vSeed));
        c = mix(c, PK2, (1.0 - smoothstep(0.1, 0.22, r)) * 0.9);
        c = mix(c, I1, (1.0 - smoothstep(0.03, 0.06, abs(r - 0.32))) * step(0.85, abs(cos(a * 2.5 + 1.57))) * 0.8);
        c = mix(c, PK2, smoothstep(pet * 0.75, pet * 0.95, r) * 0.45);
        gl_FragColor = vec4(outc(c), m);
      }`, {}, { side: THREE.DoubleSide, alphaToCoverage: A2C() });
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
      void main(){ vec3 c = vec3(mix(-120.0, 120.0, uBirdT), 36.0 + sin(uBirdT * 6.0) * 3.0, -95.0) + aB.xyz;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vUv = position.xy; vPh = aB.w; gl_Position = projectionMatrix * viewMatrix * vec4(c + (right * position.x + up * position.y) * 3.4, 1.0); }`,
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
        float u = clamp(vL.y, 0.0, 1.0), v = clamp(vL.x, 0.0, 1.0), a = 0.0; vec3 col = I0;
        if (kind < 0.5 || (kind > 2.5 && kind < 3.5)) {
          float xm = u * len, nA = vn(vec2(xm * 0.35, seed * 7.0));
          float hw = 0.5 * (0.55 + 0.4 * (1.0 - u) + 0.15 * nA) * smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.9, 1.0, u) * 0.6) + 0.02;
          float body = 1.0 - smoothstep(hw - 0.08, hw, abs(v - 0.5 - sin(u * 3.14159) * 0.06 * (nA - 0.4)) + (vn(vec2(xm * 2.0, seed)) - 0.5) * 0.14);
          body *= smoothstep(0.0, 0.03 + 0.03 * nA, u) * (1.0 - smoothstep(0.96 - 0.04 * nA, 1.0, u));
          body *= step(u, prog * 1.04 - (vn(vec2(v * 9.0, seed)) - 0.5) * 0.04);
          body *= kas(vec2(xm * 0.08, v * w * 1.6 + seed), mix(0.18, 0.55, smoothstep(0.4, 1.0, u)) + dry * 0.12);
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
          body *= kas(vec2(rel * 2.0, (d - rm) * 0.4), 0.1 + 0.55 * smoothstep(3.5, 5.3, rel) + dry * 0.1);
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
    g.add(m); S.bq = { mesh: m, n };
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

  // full-screen paper: fibre grain and deckle multiplied over everything, plus the wet washes, the roar's spatter, rain, and the scroll mounting
  function buildOverlay(S, g) {
    S.ovU = { uRes: { value: new THREE.Vector2(1280, 720) }, uWash: { value: 0 }, uWashK: { value: 0 }, uSplat: { value: 0 }, uSplatSeed: { value: 0 }, uFrame: { value: 0 }, uSeal: { value: 0 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), smat(S.U, 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', `
      uniform vec2 uRes; uniform float uWash, uWashK, uSplat, uSplatSeed, uFrame, uSeal;
      vec3 Cc = vec3(0.0); float Tt = 1.0;
      void lay(vec3 col, float k){ k = clamp(k, 0.0, 1.0); Cc = Cc * (1.0 - k) + outc(col) * k; Tt *= 1.0 - k; }
      void main(){
        vec2 fc = gl_FragCoord.xy, uv = fc / max(uRes, vec2(1.0)); float asp = uRes.x / max(uRes.y, 1.0); vec2 sp = vec2(uv.x * asp, uv.y);
        if (uStorm > 0.01) { float X = uv.x * asp * 95.0 + uv.y * 30.0 * (0.35 + uGale), hc = hh(vec2(floor(X), 7.0)), seg = fract(uv.y * (1.2 + hc * 1.5) + uTime * (1.4 + hc));
          lay(I2, step(0.93, hc) * smoothstep(0.0, 0.05, seg) * (1.0 - smoothstep(0.2, 0.34, seg)) * (1.0 - smoothstep(0.08, 0.42, abs(fract(X) - 0.5))) * 0.5 * uStorm); }
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
  const CP0 = [[0, 2.35, 0.9], [0, 2.0, -0.8], [0.8, 2.1, -2.6], [3.0, 3.6, -3.6], [4.6, 6.4, -4.6], [3.6, 9.2, -5.6], [0.4, 9.8, -6.2], [-3.0, 8.0, -6.4], [-4.8, 4.2, -7.2], [-5.4, 2.4, -9.6], [-6.8, 4.4, -11.6], [-6.4, 7.8, -13.0]];
  const NB = 44, NCARD = 52;
  const bodyR = (s) => s < 0.08 ? lerp(0.55, 0.8, s / 0.08) : s < 0.25 ? lerp(0.8, 0.86, (s - 0.08) / 0.17) : Math.pow(1 - (s - 0.25) / 0.75, 0.8) * 0.86 + 0.02;
  function buildDragon(S, b) {
    const D = S.D = {}, root = D.root = new THREE.Group(); b.group.add(root);
    D.U = { uInk: { value: 1 }, uDraw: { value: 1.2 }, uGrind: { value: 0 }, uFade: { value: 1 }, uFadeH: { value: 1.01 }, uFlat: { value: 0 }, uWetG: { value: 0 }, uLd: { value: new V3(-0.4, 0.8, 0.45).normalize() }, uOut: { value: 0.075 } };
    const SKV = `attribute float aS, aK, aBelly; attribute vec2 aSc; varying vec3 vN, vW; varying float vS, vK, vBelly; varying vec2 vSc;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = mat3(modelMatrix) * normal; vS = aS; vK = aK; vBelly = aBelly; vSc = aSc; gl_Position = projectionMatrix * viewMatrix * wp; }`;
    const skin = smat(S.U, SKV, `
      uniform float uInk, uDraw, uGrind, uFade, uFadeH, uFlat, uWetG; uniform vec3 uLd;
      varying vec3 vN, vW; varying float vS, vK, vBelly; varying vec2 vSc;
      void main(){
        float s = vS; if (s < 1.0 - uDraw) discard;
        if (bayer(gl_FragCoord.xy) > (s > 0.1 ? uFade : uFadeH)) discard;
        vec3 n = vN / max(length(vN), 1e-4), vd = cameraPosition - vW; vd /= max(length(vd), 1e-4);
        float ndl = dot(n, uLd) * 0.5 + 0.5, fr = 1.0 - clamp(abs(dot(n, vd)), 0.0, 1.0), nz = vn(vSc * 1.3);
        vec2 sc = vSc + vec2(0.0, mod(floor(vSc.x), 2.0) * 0.5); vec2 cf = fract(sc) - 0.5;
        float scale = (1.0 - smoothstep(0.34, 0.46, length(cf * vec2(1.0, 1.3)))) - (1.0 - smoothstep(0.24, 0.36, length((cf - vec2(0.14, 0.0)) * vec2(1.0, 1.3))));
        float streak = vn(vec2(vSc.x * 0.07, vSc.y * 2.2)), patch_ = smoothstep(0.5, 0.7, vn(vSc * vec2(0.18, 0.5) + 7.0));
        float dark = mix(0.4, 0.88, uInk) * (1.0 - 0.6 * ndl) + 0.2 + (streak - 0.5) * 0.3 + scale * 0.16 * patch_ * (1.0 - vBelly);
        float bp = smoothstep(0.45, 0.85, vBelly) * step(vK, 0.5);
        float plate = 1.0 - smoothstep(0.0, 0.1, abs(fract(vSc.x * 0.5) - 0.5) - 0.38);
        dark = mix(dark, 0.14 + plate * 0.42 * mix(0.6, 1.0, uInk), bp);
        float dbr = (1.0 - kas(vec2(vSc.x * 0.012 + vSc.y * 0.01, vSc.y * 0.11), 0.6)) * smoothstep(0.45, 0.7, vn(vec2(vSc.x * 0.09, vSc.y * 0.4) + 3.0)) * step(0.0, s);
        dark -= dbr * 0.22 * smoothstep(0.35, 0.75, dark) * (1.0 - smoothstep(0.95, 1.15, dark)) * step(vK, 0.5) * (1.0 - bp);
        dark = max(dark, smoothstep(0.55, 0.92, fr) * 0.95);
        float k = kas(vec2(vSc.x * 0.04, vSc.y * 0.12), smoothstep(0.45, 1.0, s) * 0.55 + (1.0 - uInk) * 0.35);
        if (s > 0.0) dark *= mix(1.0, 0.3, 1.0 - k);
        if (s > 0.8 && k < smoothstep(0.8, 1.0, s) * 0.9) discard;
        if (s > 0.0) dark = mix(dark, 1.0, smoothstep(1.0 - uGrind, 1.04 - uGrind, s) * step(0.001, uGrind) * 0.92);
        dark = mix(dark, 1.0, (1.0 - smoothstep(0.0, 0.05, s - (1.0 - uDraw))) * step(uDraw, 1.04) * 0.9);
        if (vK > 0.5 && vK < 1.5) dark = 0.2 + 0.4 * (1.0 - ndl) + smoothstep(0.6, 0.9, fr) * 0.5 + (1.0 - smoothstep(0.0, 0.1, abs(fract(vSc.x * 0.8) - 0.5))) * 0.15;
        if (vK > 1.5 && vK < 2.5) dark = 0.12 + smoothstep(0.62, 0.92, fr) * 0.85;
        if (vK > 2.5) dark = 0.96;
        dark = mix(dark, 0.42 + (1.0 - k) * -0.2 + smoothstep(0.6, 0.9, fr) * 0.3, uFlat);
        vec3 c = tone(1.0 - clamp(dark, 0.0, 1.0), nz);
        vec3 rf = reflect(-vd, n); c = mix(c, I3, smoothstep(0.9, 0.97, dot(rf, uLd)) * uWetG * step(vK, 0.5) * (1.0 - uFlat));
        if (uPetal > 0.002) { vec2 pq = vSc * vec2(0.7, 1.2), pi = floor(pq), pf = fract(pq) - 0.5; c = mix(c, mix(PK, PK2, hh(pi)), step(hh(pi + 3.7), uPetal * 0.22) * (1.0 - smoothstep(0.12, 0.2, length(pf))) * step(vK, 0.5) * step(0.0, s)); }
        gl_FragColor = vec4(outc(c), 1.0);
      }`, D.U);
    const outl = smat(S.U, `attribute float aS, aK; attribute vec2 aSc; uniform float uOut; varying float vS; varying vec2 vSc;
      ${'float hh2(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }'}
      void main(){ float w = uOut * (0.6 + 0.4 * sin(aSc.x * 0.37 + aSc.y * 0.9) + 0.35 * sin(aSc.x * 1.3)) * (1.0 - clamp(aS, 0.0, 1.0) * 0.75) * (aK > 1.5 && aK < 2.5 ? 0.4 : 1.0);
        vS = aS; vSc = aSc; vec4 wp = modelMatrix * vec4(position + normal * w, 1.0); gl_Position = projectionMatrix * viewMatrix * wp; }`, `
      uniform float uDraw, uFade, uFadeH, uFlat; varying float vS; varying vec2 vSc;
      void main(){ if (vS < 1.0 - uDraw) discard; if (bayer(gl_FragCoord.xy) > (vS > 0.1 ? uFade : uFadeH)) discard;
        float k = kas(vec2(vSc.x * 0.04, vSc.y * 0.12), smoothstep(0.45, 1.0, vS) * 0.6); if (vS > 0.8 && k < smoothstep(0.8, 1.0, vS) * 0.9) discard;
        gl_FragColor = vec4(outc(mix(I0, I2, uFlat)), 1.0); }`, D.U, { side: THREE.BackSide });
    D.skin = skin; D.outl = outl;
    // body tube
    const tb = D.tube = new TubeBuf(NB, 8), vcount = NB * 9, aS = new Float32Array(vcount), aK = new Float32Array(vcount), aSc = new Float32Array(vcount * 2), aBe = new Float32Array(vcount);
    for (let i = 0; i < NB; i++) for (let j = 0; j <= 8; j++) { const v = i * 9 + j, s = i / (NB - 1), f = j / 8 * TAU; aS[v] = s; aSc[v * 2] = s * 78; aSc[v * 2 + 1] = j / 8 * 9; aBe[v] = sat(-Math.cos(f)); }
    tb.geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1)); tb.geo.setAttribute('aK', new THREE.BufferAttribute(aK, 1)); tb.geo.setAttribute('aSc', new THREE.BufferAttribute(aSc, 2)); tb.geo.setAttribute('aBelly', new THREE.BufferAttribute(aBe, 1));
    D.cp = CP0.map((c) => new V3(...c)); D.C = []; for (let i = 0; i < NB; i++) D.C.push(new V3()); D.W = D.C.map(() => new V3());
    const body = new THREE.Mesh(tb.geo, skin), bodyO = new THREE.Mesh(tb.geo, outl); body.frustumCulled = bodyO.frustumCulled = false; root.add(body, bodyO);
    // head (neck joint at the origin, +Z forward)
    const H = []; const add = (geo, k) => H.push([geo, k]);
    add(T(new THREE.SphereGeometry(0.72, 18, 12), 0, 0.28, 0.35, 0, 0, 0, 0.95, 0.78, 1.15), 0);
    add(T(new THREE.CylinderGeometry(0.4, 0.56, 1.55, 14, 2), 0, 0.14, 1.45, PI / 2, 0, 0, 1, 1, 0.72), 0);
    add(T(new THREE.SphereGeometry(0.46, 14, 10), 0, 0.2, 2.2, 0, 0, 0, 1.05, 0.62, 0.62), 0);
    for (const sx of [-1, 1]) {
      add(T(new THREE.SphereGeometry(0.1, 8, 6), sx * 0.2, 0.36, 2.44), 3);
      add(T(new THREE.SphereGeometry(0.3, 12, 8), sx * 0.36, 0.56, 0.95, 0, sx * 0.25, 0, 1.1, 0.5, 1.5), 0);
      add(T(new THREE.SphereGeometry(0.17, 12, 10), sx * 0.43, 0.4, 1.12, 0, 0, 0, 0.8, 0.85, 1.2), 2);
      add(T(new THREE.ConeGeometry(0.075, 0.46, 6), sx * 0.3, -0.26, 2.0, PI, 0, 0), 2);
      for (let i = 0; i < 4; i++) add(T(new THREE.ConeGeometry(0.045, 0.17, 5), sx * (0.36 - i * 0.02), -0.12, 1.8 - i * 0.24, PI, 0, 0), 2);
      add(orient(new THREE.ConeGeometry(0.24, 1.2, 7), sx * 0.75, 0.05, 0.0, sx * 0.55, 0.15, -1, 1, 1, 0.45), 0);
      add(taper([[sx * 0.3, 0.72, 0.35], [sx * 0.5, 1.15, -0.2], [sx * 0.72, 1.55, -0.9], [sx * 0.8, 1.85, -1.65]], 0.14, 0.025, 7), 1);
      add(taper([[sx * 0.55, 1.25, -0.35], [sx * 0.92, 1.7, -0.15], [sx * 1.08, 2.05, 0.25]], 0.075, 0.02, 6, 7), 1);
    }
    const head = D.head = new THREE.Group(); head.scale.setScalar(1.3); root.add(head);
    const hg = mergeParts(H), hm = new THREE.Mesh(hg, skin), ho = new THREE.Mesh(hg, outl); head.add(hm, ho);
    const J = []; const addJ = (geo, k) => J.push([geo, k]);
    addJ(T(new THREE.CylinderGeometry(0.28, 0.4, 1.5, 12, 2), 0, -0.1, 0.75, PI / 2, 0, 0, 1, 1, 0.55), 0);
    addJ(T(new THREE.SphereGeometry(0.3, 10, 8), 0, -0.08, 1.5, 0, 0, 0, 1, 0.5, 0.8), 0);
    addJ(T(new THREE.BoxGeometry(0.36, 0.05, 1.15), 0, 0.06, 0.8), 3);
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) addJ(T(new THREE.ConeGeometry(0.045, 0.17, 5), sx * (0.25 - i * 0.015), 0.08, 1.35 - i * 0.24), 2);
    const jaw = D.jaw = new THREE.Group(); jaw.position.set(0, -0.12, 0.55); head.add(jaw);
    const jg = mergeParts(J); jaw.add(new THREE.Mesh(jg, skin), new THREE.Mesh(jg, outl));
    // eyes: blank until the dot; then the only saturated thing on him
    const pm = new THREE.MeshBasicMaterial({ color: hdr(VERM, new THREE.Color()).multiplyScalar(1.7), fog: false }); D.pupils = [];
    for (const sx of [-1, 1]) { const pu = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), pm); pu.position.set(sx * 0.555, 0.43, 1.15); pu.scale.set(0.5, 1, 0.7); head.add(pu); D.pupils.push(pu); }
    // whiskers: thin tubes rebuilt each frame
    D.wh = [-1, 1].map((sx) => { const t = new TubeBuf(12, 4), n = 12 * 5; const s2 = new Float32Array(n).fill(-0.05), k2 = new Float32Array(n).fill(3), sc2 = new Float32Array(n * 2), be = new Float32Array(n);
      t.geo.setAttribute('aS', new THREE.BufferAttribute(s2, 1)); t.geo.setAttribute('aK', new THREE.BufferAttribute(k2, 1)); t.geo.setAttribute('aSc', new THREE.BufferAttribute(sc2, 2)); t.geo.setAttribute('aBelly', new THREE.BufferAttribute(be, 1));
      const m = new THREE.Mesh(t.geo, skin); m.frustumCulled = false; head.add(m); return { t, sx, P: Array.from({ length: 12 }, () => new V3()) }; });
    // legs
    const leg = (sx, fore) => { const L = [], k = fore ? 1 : 0.8;
      L.push([taper([[0, 0, 0], [sx * 0.1, -0.55 * k, 0.32], [sx * 0.12, -1.05 * k, 0.55]], 0.36 * k, 0.24 * k, 8, 8), 0]);
      L.push([taper([[sx * 0.12, -1.05 * k, 0.55], [sx * 0.1, -1.5 * k, 0.6], [sx * 0.08, -1.82 * k, 0.75]], 0.24 * k, 0.17 * k, 8, 8), 0]);
      L.push([T(new THREE.SphereGeometry(0.27 * k, 10, 8), sx * 0.08, -1.84 * k, 0.86, 0, 0, 0, 1.1, 0.6, 1.3), 0]);
      for (let c = 0; c < 4; c++) { const a = (c - 1.5) * 0.35; L.push([orient(new THREE.ConeGeometry(0.06 * k, 0.42 * k, 5), sx * 0.08 + Math.sin(a) * 0.22, -1.9 * k, 0.95 + Math.cos(a) * 0.18, Math.sin(a) * 0.6, -0.5, 1), 1]); }
      const g2 = mergeParts(L, 0.03), grp = new THREE.Group(); grp.add(new THREE.Mesh(g2, skin), new THREE.Mesh(g2, outl)); root.add(grp); return grp; };
    D.fore = [leg(-1, true), leg(1, true)]; D.hind = [leg(-1, false), leg(1, false)];
    // stroke cards: spines down the back, tail tuft, mane and beard
    const cg = new THREE.PlaneGeometry(1, 1); cg.translate(0, 0.5, 0); const aCd = iattr(NCARD, 4), rng = mulberry(17);
    for (let i = 0; i < NCARD; i++) aCd.setXYZW(i, rng(), rng() * 10, i < 34 ? 0.04 + i / 33 * 0.92 : i < 38 ? 0.97 : -0.05, 0);
    cg.setAttribute('aCd', aCd);
    const cm = smat(S.U, `attribute vec4 aCd; varying vec2 vUv; varying vec4 vCd; void main(){ vUv = vec2(position.x + 0.5, position.y); vCd = aCd; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`, `
      uniform float uDraw, uFlat, uInk, uFade, uFadeH; varying vec2 vUv; varying vec4 vCd;
      void main(){ if (vCd.z < 1.0 - uDraw) discard; if (bayer(gl_FragCoord.xy) > (vCd.z > 0.1 ? uFade : uFadeH)) discard;
        float v = clamp(vUv.y, 0.0, 1.0), bend = sin(v * 2.6 + vCd.y) * 0.13 * v, hw = 0.5 * pow(1.0 - v, 0.7) * (0.75 + 0.25 * sin(v * 3.14159));
        float a = 1.0 - smoothstep(hw - 0.08, hw, abs(vUv.x - 0.5 - bend)); a *= kas(vec2(v * 0.6 + vCd.y, vUv.x * 0.7), 0.1 + 0.5 * v);
        if (a < uCut) discard;
        float dark = mix(mix(0.55, 0.98, uInk), 0.45, uFlat) * (0.85 + 0.15 * vCd.x) - v * 0.15;
        gl_FragColor = vec4(outc(tone(1.0 - dark, vCd.x)), a); }`, D.U, { side: THREE.DoubleSide, alphaToCoverage: A2C() });
    D.cards = new THREE.InstancedMesh(cg, cm, NCARD); D.cards.frustumCulled = false; root.add(D.cards);
    // head cards in head space: mane (10) and beard (4)
    D.hc = []; for (let i = 0; i < 14; i++) { const o = new THREE.Object3D();
      if (i < 10) { const sx = i % 2 ? 1 : -1, k = Math.floor(i / 2); o.position.set(sx * (0.25 + k * 0.05), 0.55 - k * 0.12, 0.1 - k * 0.32); o.rotation.set(-1.9 + k * 0.08, sx * (0.5 + k * 0.08), sx * 0.3); o.scale.set(0.42, 1.4 + (k % 3) * 0.35, 1); }
      else { const k = i - 10, sx = k % 2 ? 1 : -1; o.position.set(sx * (0.12 + k * 0.05), -0.35, 1.2 - k * 0.2); o.rotation.set(PI - 0.35, 0, sx * 0.2); o.scale.set(0.24, 0.9 + k * 0.1, 1); }
      o.updateMatrix(); D.hc.push(o.matrix.clone()); }
    D.pose = { rear: 0, rake: 0, whip: 0, whipS: 1, slump: 0, sweep: 0, sweepA: 0, roar: 0, dive: 0 };
    D.t = 0; D.fadeA = 1;
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
      if (j < 4) { y += P.rear * [3.0, 2.0, 0.9, 0.3][j]; z += P.rear * [-0.7, -0.9, -0.5, -0.1][j]; } else y -= P.rear * 0.6 * s;
      if (j < 3) { z += P.rake * [0.9, 0.6, 0.25][j]; y -= P.rake * [0.35, 0.2, 0][j]; }
      if (j >= 5) { const w = (j - 5) / 6; x += P.whip * P.whipS * w * w * 6.0 * Math.sin(t * 9 - j * 0.8 + 1.5); }
      y = lerp(y, Math.max(0.7, y * 0.35 + 0.6), P.slump); if (j === 0) y -= P.slump * 0.5;
      const sw = P.sweep * smooth((j - 1.5) / 2); if (sw > 0.001) { const a = P.sweepA + j * 0.66; x = lerp(x, Math.sin(a) * 7.2, sw); y = lerp(y, 9 + Math.sin(a * 2) * 0.5 + (j - 6) * 0.15, sw); z = lerp(z, Math.cos(a) * 7.2, sw); }
      cp[j].set(x, y, z);
    }
    for (let i = 0; i < NB; i++) { const u = i / (NB - 1) * (n - 1), k = Math.min(n - 2, Math.floor(u)), f = u - k; _cr(cp[Math.max(0, k - 1)], cp[k], cp[k + 1], cp[Math.min(n - 1, k + 2)], f, D.C[i]); }
    D.tube.build(D.C, (i) => bodyR(i / (NB - 1)) * (1 + P.roar * 0.04 * Math.sin(t * 30 + i)));
    // head on the neck, looking along the forebody; lower it toward the player when rearing
    const C = D.C, Tn = D.tube.T; D.head.position.copy(C[0]);
    _d.copy(Tn[0]).multiplyScalar(-1); _d.y -= P.rear * 0.55 - P.roar * 0.35 + P.slump * 0.4; _d.normalize(); D.head.quaternion.setFromUnitVectors(_Z, _d);
    D.jaw.rotation.x = 0.1 + P.roar * 0.6 + Math.max(0, Math.sin(t * 0.7)) * 0.05;
    // forelegs at the chest, hind legs on the first coil
    const ci = 3, hi = 15;
    D.fore.forEach((L, k) => { const sx = k ? 1 : -1; L.position.set(C[ci].x + sx * 0.72, C[ci].y - 0.35, C[ci].z + 0.2); L.rotation.set(-(k === (P.whipS > 0 ? 1 : 0) ? P.rake * 1.25 : P.rake * 0.3) - P.rear * 0.7 + P.slump * 0.5, 0, sx * (0.05 + P.slump * 0.4)); });
    D.hind.forEach((L, k) => { const sx = k ? 1 : -1, Ni = D.tube.N[hi], Bi = D.tube.B[hi]; L.position.copy(C[hi]).addScaledVector(Bi, sx * 0.7).addScaledVector(Ni, -0.5); L.rotation.set(0.5 + Math.sin(t * 1.3 + k) * 0.15, 0, sx * 0.2); });
    // whiskers: from the snout, trailing back and waving
    for (const w of D.wh) { const P2 = w.P; for (let k = 0; k < 12; k++) { const u = k / 11; P2[k].set(w.sx * (0.32 + u * 1.3 + Math.sin(t * 2.2 - k * 0.6) * 0.1 * u), 0.15 - u * 0.5 - u * u * 0.6 + Math.sin(t * 1.7 - k * 0.5) * 0.15 * u, 2.25 - u * 2.6); } w.t.build(P2, (i) => 0.045 * (1 - i / 12) + 0.008); }
    // cards
    const I = D.cards, N = D.tube.N, B = D.tube.B;
    for (let i = 0; i < 34; i++) { const bi = Math.min(NB - 2, 2 + Math.round(i / 33 * 39)), r = bodyR(bi / (NB - 1)); _a.copy(N[bi]).addScaledVector(Tn[bi], -0.7).normalize(); _b.copy(Tn[bi]).multiplyScalar(-1); _d.crossVectors(_b, _a).normalize(); _b.crossVectors(_a, _d);
      _m4.makeBasis(_b, _a, _d); _m4.scale(_s.set(0.35 + r * 0.35, 0.3 + r * 0.75, 1)); _m4.setPosition(_p.copy(C[bi]).addScaledVector(N[bi], r * 0.85)); I.setMatrixAt(i, _m4); }
    for (let i = 0; i < 4; i++) { const bi = NB - 1, a = (i - 1.5) * 0.5; _a.copy(Tn[bi]).addScaledVector(B[bi], Math.sin(a)).addScaledVector(N[bi], Math.cos(a) * 0.5).normalize(); _d.crossVectors(_a, N[bi]); if (_d.lengthSq() < 1e-6) _d.set(1, 0, 0); _d.normalize(); _b.crossVectors(_a, _d);
      _m4.makeBasis(_b, _a, _d); _m4.scale(_s.set(0.5, 1.5 + (i % 2) * 0.5, 1)); _m4.setPosition(C[bi]); I.setMatrixAt(34 + i, _m4); }
    D.head.updateMatrix(); for (let i = 0; i < 14; i++) { _m42.multiplyMatrices(D.head.matrix, D.hc[i]); I.setMatrixAt(38 + i, _m42); }
    I.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------------------------------------------------
  function build(b) {
    const g = G.world, S = b.state, low = G.q.part < 0.5;
    { const cu = Post.final && Post.final.uniforms.uChroma; if (cu) { const was = cu.value; cu.value = 0; g.addEventListener('removed', () => { cu.value = was; }); } }
    S.U = { uTime: { value: 0 }, uReveal: { value: 1 }, uStorm: { value: 0 }, uSun: { value: 0 }, uBloom: { value: 0 }, uPetal: { value: 0 }, uGale: { value: 0 }, uCut: { value: A2C() ? 0.04 : 0.5 }, uWind: { value: new THREE.Vector2(0.25, 0.08) } };
    scene.fog = new THREE.FogExp2(hdr(0xefe7d3, new THREE.Color()), 0.004); S.fog = scene.fog;
    { const sk = W.sky({ top: 0xe8dfc8, horizon: 0xefe7d3, bottom: 0xa89f8a, sunGlow: 0, sunSize: 0 }); W.env(sk, 0.35); sk.geometry.dispose(); sk.material.dispose(); }
    S.hemi = W.hemi(g, 0xfff4e2, 0x9a907c, 1.25);
    S.sun = W.sun(g, { dir: [-0.5, 0.8, 0.45], color: 0xfff0dc, intensity: 1.3, shadow: false });
    buildSky(S, g); buildGround(S, g); buildMountains(S, g); buildMist(S, g, low); buildBamboo(S, g, low); buildTree(S, g, low); buildBirds(S, g);
    buildDecals(S, g); buildBulletQuads(S, g); buildSealBlock(S, g); if (!G.headless) buildOverlay(S, g);
    buildDragon(S, b);
    Object.assign(S, { ink: 1, forceDry: false, dry: false, lk: Object.assign({}, LOOK[0]), lkT: Object.assign({}, LOOK[0]), reveal: 1, draw: 1.2, eye: 1, descend: 0, introOn: false,
      seen: {}, leafPred: [], bleed: [], ensoN: 0, enso: null, carved: null, galeOn: 0, galeTell: 0, gwx: 0, gwz: 1, wind: new THREE.Vector2(0.25, 0.08), wash: -1, washK: 0, washDur: 2, splat: 0, frame: 0, seal: -1,
      sealH: null, sealHitT: -1, grind: 0, slump: 0, rear: 0, rake: 0, whip: 0, roar: 0, sweep: 0, dive: 0, rip: -100, bolt: 0, boltA: 0.4, sunRise: 0, birdT: 2, birdNext: 30, dead: false, flat: 0, wetG: 0, lvl: 0 });
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 13 }, bossStart: { x: 0, z: -6, face: 0 }, camDist: 16,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.6,
      clamp(p) { const d = Math.hypot(p.x, p.z), m = R - 0.6; if (d > m) { p.x *= m / d; p.z *= m / d; } },
      bulletBounds: (x, z) => Math.hypot(x, z) < 26,
      camLimit(x, y, z) { const d = Math.hypot(x, z), m = R + 4.5; if (d > m) { x *= m / d; z *= m / d; } return { x, y: Math.max(y, 0.6), z }; },
    };
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // look, resets
  function applyLook(b, i, instant) { const S = b.state; S.lkT = Object.assign({}, LOOK[i]); S.lvl = i; if (instant) { S.lk = Object.assign({}, LOOK[i]); S.sunRise = i === 2 ? 1 : 0; } }
  // every per-mechanic visual and sim state goes back to rest: called by each phase's enter and run, and by skipTo
  function resetMech(b, i) {
    const S = b.state; if (!S.D) return;
    S.ink = 1; S.forceDry = false; S.dry = false; b.dmgTaken = 1; b.targetable = true; b.autoFace = true;
    S.galeOn = 0; S.galeTell = 0; S.bleed.length = 0; S.leafPred.length = 0; S.enso = null; S.carved = null; S.sealH = null; S.sealHitT = -1; if (S.sealBlock) S.sealBlock.visible = false;
    S.grind = 0; S.slump = 0; S.rear = 0; S.rake = 0; S.whip = 0; S.roar = 0; S.sweep = 0; S.dive = 0; S.rip = -100; S.wash = -1; S.splat = 0; S.bolt = 0; S.seen = {}; S.wetG = i === 1 ? 1 : 0;
    const P = S.D.pose; Object.assign(P, { rear: 0, rake: 0, whip: 0, slump: 0, sweep: 0, roar: 0, dive: 0 });
    hideDecals(S); if (S.bq) S.bq.mesh.count = 0;
    applyLook(b, i, false);
  }
  const isDry = (b) => !b.enraged && (b.state.forceDry || b.state.ink < DRY_AT);
  const sp = (b) => b.enraged ? 0.77 : 1;
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
      Hz.rect(x0 + dx * a, z0 + dz * a, dir, l, w, d0 + 0.12 * (dry ? k * n : i), dmg, { name, silent: i > 0, onFire(h) {
        if (!G.headless) { const s = h.shape; decal(S, kind, s.x + dx * l / 2, s.z + dz * l / 2, dir, l, w * (kind === 3 ? 0.62 : 0.55), 0.12, 1.2, 7, kind === 3 ? ((a - nodeOff) % 7 + 7) % 7 : undefined); pluck(i + (dry ? 3 : 0), 0.1); Sound.sfx('slash', 0.45, 0.55); spat(s.x + dx * l / 2, s.z + dz * l / 2, 1.2, 8); FX.shake(0.15); }
        if (onSec) onSec(h, a, l); } });
    });
  }

  // ---- strokes ----
  function* rake(b) {
    const S = b.state; useInk(b, COST.rake); const f = first(b, 'rake'), dir = b.angToPlayer(); b.autoFace = false; yield* b.turnTo(dir, 0.25);
    const T2 = (1.1 + f) * sp(b); S.rake = 1;
    Hz.cone(b.pos.x, b.pos.z, dir, 2.2, 9, T2, 320, { name: 'Claw Rake', onFire() {
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
    for (const st of stalks) paint(b, st.x0, st.z0, st.dir, st.len, 2.6, 3, d0, 300, 'Bamboo Stroke', dry, 3, st.nodeOff, dry ? null : (h, a, l) => {
      for (const nd of st.nodes) if (nd.a >= a && nd.a < a + l) Hz.cone(nd.x, nd.z, nd.dir, 1.0, 4.2, 1.0 * sp(b), 220, { name: 'Bamboo Leaves', silent: true, onFire() {
        if (G.headless) return; for (let q = -1; q <= 1; q++) { const d2 = nd.dir + q * 0.3, L = 3.2 - Math.abs(q) * 0.6; decal(S, 0, nd.x + Math.sin(d2) * L / 2, nd.z + Math.cos(d2) * L / 2, d2, L, 0.8, 0.1, 0.8, 6); } pluck(5 + (nd.side > 0 ? 1 : 0), 0.08); } });
    });
    yield* b.cast({ name: 'Bamboo Stroke', time: 1.3 * sp(b) + f }); S.whip = 0;
    yield dry ? 0.5 : 1.5; S.leafPred.length = 0;
  }

  function bleedZone(b, x, z) {
    const S = b.state; for (let i = S.bleed.length - 1; i >= 0; i--) if (S.bleed[i].state === 'done') S.bleed.splice(i, 1);
    const h = Hz.zone({ type: 'circle', x, z, r: 3 }, 6, 70, { name: 'Wet Ink', every: 0.5, delay: 0.3, color: 0x101010, track(s, hz) { s.r = Math.min(4.2, 3 + (hz.zt || 0) * 0.4); } });
    S.bleed.push(h); while (S.bleed.length > 5) Hz.cancel(S.bleed.shift());
    decal(S, 1, x, z, 0, 8.8, 8.8, 3.0, 5.5, 7.5);
  }

  function* drops(b, n) {
    const S = b.state, p = G.player; useInk(b, COST.drops); const f = first(b, 'drops');
    for (let i = 0; i < n; i++) {
      Hz.circle(p.pos.x, p.pos.z, 3.0, (1.2 + f) * sp(b), 260, { name: 'Ink Drop', lock: 0.8, track(s) { s.x = p.pos.x; s.z = p.pos.z; }, onFire(h) {
        const s = h.shape; if (!G.headless) { decal(S, 1, s.x, s.z, vrand() * TAU, 6.6, 6.6, 0.15, 0.8, 6); spat(s.x, s.z, 2.5, 16); Sound.sfx('boom', 0.35, 1.6); pluck(i * 2, 0.1); }
        if (S.lvl === 1) bleedZone(b, s.x, s.z); } });
      yield 0.5;
    }
    yield 0.8;
  }

  function habokuPts() { const p = G.player, pts = [[p.pos.x, p.pos.z]]; let tries = 0; while (pts.length < 6 && tries++ < 300) { const a = rnd(TAU), r = Math.sqrt(rnd()) * (R - 2.5), x = Math.sin(a) * r, z = Math.cos(a) * r; if (pts.every(([qx, qz]) => Math.hypot(qx - x, qz - z) >= 5)) pts.push([x, z]); } return pts; }
  function* haboku(b) {
    const S = b.state, pts = habokuPts(); Sound.sfx('roar', 0.5, 1.2); S.roar = 1;
    pts.forEach(([x, z], i) => Hz.circle(x, z, 3.4, (1.3 + 0.15 * i) * sp(b), 300, { name: 'Haboku', silent: i > 0, onFire() {
      if (!G.headless) { decal(S, 1, x, z, vrand() * TAU, 7.6, 7.6, 0.12, 1.0, 6.5); spat(x, z, 3, 20); Sound.sfx('boom', 0.5, 1.2); FX.shake(0.25); pluck(i + 2, 0.11); }
      if (S.lvl === 1) bleedZone(b, x, z);
      if (S.lvl === 2 && i === 0) Bul.ring(b.pos.x, b.pos.z, 12, 6, { r: 0.4, dmg: 90, color: VERM, life: 5, kind: 'petal', name: 'Petal' }, rnd(TAU), rnd(TAU), 70 * PI / 180);
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
      if (b.enraged) yield* haboku(b);
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
        Bul.fire({ x: -wx * 18 + px * o, z: -wz * 18 + pz * o, dir: Math.atan2(wx, wz), speed: 10, r: 0.4, dmg: 120, life: 4.2, color: VERM, kind: petal ? 'petal' : 'leaf', name: petal ? 'Petal' : 'Gale' }); }
      if (!G.headless) { pluck(w * 2 + 1, 0.09); Sound.sfx('dash', 0.4, 0.8); }
      yield 1.5;
      const sh = () => rnd(3, 6) * (rnd() < 0.5 ? -1 : 1); let t2 = 0, n1 = g1, n2 = g2; do { n1 = clamp(g1 + sh(), -14, 14); n2 = clamp(g2 + sh(), -14, 14); } while (Math.abs(n1 - n2) < 8 && ++t2 < 20);
      g1 = n1; g2 = n2;
    }
  }

  function* seal(b) {
    const S = b.state, p = G.player; useInk(b, COST.seal); const f = first(b, 'seal'), dir = rnd(TAU), dx = Math.sin(dir), dz = Math.cos(dir), T2 = (1.5 + f) * sp(b);
    S.rear = 1; Sound.sfx('charge', 0.5, 0.6);
    const h = Hz.rect(p.pos.x - dx * 4, p.pos.z - dz * 4, dir, 8, 8, T2, 380, { name: 'Seal', lock: 0.9, track(s) { s.x = p.pos.x - dx * 4; s.z = p.pos.z - dz * 4; }, onFire(hz) {
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
      paint(b, x0, z0, Z.ang[i], lens[i], 2.4, 1, (1.2 + f + 0.12 * i) * sp(b), 340, 'Thunder Stroke', dry, 0, 0, i === 0 ? () => { if (!G.headless && !flashed) { flashed = true; Sound.sfx('thunder', 0.7); FX.flash(0xefe7d3, 0.22, 2.5); S.bolt = 1; S.boltA = vrand() * 1.2 - 0.6; } } : null); }
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
      paint(b, x0, z0, Z.ang[i], lens[i], 2.2, 1, (1.3 + f + 0.12 * i) * sp(b), 300, 'Blossom Branch', dry, 0, 0, dry ? null : () => {
        Hz.circle(end[0], end[1], 3.2, 0.9 * sp(b), 240, { name: 'Blossom', silent: true, onFire() {
          if (!G.headless) { decal(S, 1, end[0], end[1], 0, 3.2, 3.2, 0.1, 0.6, 5); FX.burst(end[0], 1, end[1], { n: 18, smoke: true, color: 0xf2a6b8, color2: 0xd9728c, speed: [1, 4], life: [0.5, 1.1], size: [0.2, 0.45], alpha: 0.9, up: 1 }); pluck(4 + i, 0.1); }
          Bul.ring(end[0], end[1], 5, 5, { r: 0.4, dmg: 90, color: VERM, life: 3, kind: 'petal', name: 'Petal' }, rnd(TAU)); } });
      }); }
    yield* b.cast({ name: 'Blossom Branch', time: 1.3 * sp(b) + f }); S.whip = 0; yield dry ? 0.5 : 1.6;
  }

  function* enso(b) {
    const S = b.state; useInk(b, COST.enso); S.ensoN++; const inside = S.ensoN % 2 === 1, f = first(b, 'enso');
    b.autoFace = true; yield* b.moveTo(0, 0, 7);
    const pp = G.player.pos, gapA = Math.atan2(pp.x, pp.z) + rnd(-0.7, 0.7), GAP = 55 * PI / 180, arc = (TAU - GAP) / 10, T2 = (4.0 + f) * sp(b), t0 = G.now;
    S.enso = { gapA, inside, walls: [], t0, gap: GAP, arc, fire0: (1.2 + f) * sp(b), step: 0.12 * sp(b) }; S.sweep = 1; if (!G.headless) Sound.sfx('charge', 0.6, 0.5);
    Hz[inside ? 'circle' : 'donut'](0, 0, ...(inside ? [12.5] : [9.5, 22]), T2, 450, { name: 'Flood', blockable: false, onFire() {
      if (!G.headless) { Sound.sfx('wave', 0.8, 0.8); Sound.sfx('bigboom', 0.5); FX.shake(0.5); FX.flash(0xefe7d3, 0.2, 2); if (inside) decal(S, 1, 0, 0, 0, 26, 26, 0.3, 0.5, 4); } } });
    for (let i = 0; i < 10; i++) { const ca = gapA + GAP / 2 + arc * (i + 0.5);
      Hz.cone(0, 0, ca, arc, 12.5, (1.2 + f + 0.12 * i) * sp(b), 150, { name: 'Enso', r0: 9.5, silent: i > 0, onFire() {
        const left = T2 - (G.now - t0) + 0.25; if (S.enso && left > 0.1) S.enso.walls.push(Hz.zone({ type: 'cone', x: 0, z: 0, dir: ca, arc, r: 12.5, r0: 9.5 }, left, 120, { name: 'Enso', every: 0.4, delay: 0.05, color: 0x101010 }));
        if (!G.headless) { pluck(i, 0.1); Sound.sfx('slash', 0.4, 0.5); if (i === 0) decal(S, 5, 0, 0, 0, 9.5, 12.5, 1.2 * sp(b), T2 - (G.now - t0) + 0.2, T2 - (G.now - t0) + 2.5, gapA); } } }); }
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
      else Hz.rect(sx, sz, dir, 5, 5, T2, 400, { name: 'Carved Seal', silent: c !== printer, onFire: c === printer ? () => {
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
    yield 1.3; if (!G.headless) { Sound.sfx('thunder', 1); FX.flash(0xefe7d3, 0.35, 2); S.bolt = 1; S.boltA = 0.15; }
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
  function finishIntro(S) { S.introOn = false; S.reveal = 1; S.draw = 1.2; S.eye = 1; S.descend = 0; }

  G.bosses.push({
    id: 'sumi', name: 'GARYO', title: 'The Final Stroke', hint: 'One breath', color: '#e0452c', telegraph: 0xe63a1e,
    hp: 29000, radius: 2.0, aimY: 2.6, enrage: 450, botSaveInterrupt: true,
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
          yield* rake(b); yield 0.8; yield* bamboo(b, false); yield 2.0; yield* grind(b); yield* drift(b);
        }
      } },
      { at: 0.66, skipTo(b) { resetMech(b, 1); applyLook(b, 1, true); b.state.wetG = 1; Post.set(PG[1]); }, *enter(b) { yield* toStorm(b); }, *run(b) {
        resetMech(b, 1); yield 0.6;
        while (true) {
          yield* rake(b); yield 0.6; yield* bamboo(b, true); yield 1.0; yield* drops(b, 4); yield 2.0;
          yield* gale(b, 3, false); yield 0.6; yield* seal(b); yield* thunder(b); yield 2.0; yield* grind(b); yield* drift(b);
        }
      } },
      { at: 0.33, skipTo(b) { resetMech(b, 2); applyLook(b, 2, true); Post.set(PG[2]); }, *enter(b) { yield* toDawn(b); }, *run(b) {
        resetMech(b, 2); yield 0.6;
        while (true) {
          yield* rake(b); yield 0.6; yield* branch(b); yield 2.0; yield* enso(b); yield* carved(b);
          yield* gale(b, 4, true); yield 0.6; yield* branch(b); yield 2.0; yield* grind(b); yield* drift(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, fight = G.state === 'fight' && p && p.alive;
      if (!S.D) return;
      // ---- sim ----
      S.dry = isDry(b);
      if (G.state === 'fight' && !b.transitioning) b.dmgTaken = S.dry ? 1.25 : 1;
      if (S.galeOn > 0) { S.galeOn -= dt; if (fight) { p.push.x += S.gwx * 3.2; p.push.z += S.gwz * 3.2; } }
      if (G.state === 'fight' && S.introOn) finishIntro(S);
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
      S.sunRise = damp(S.sunRise, lt.sun, 0.5, dt); S.skyU.uSunD.value.set(0.05, lerp(-0.12, 0.09, S.sunRise), -1).normalize();
      S.bolt = Math.max(0, S.bolt - dt * 2.2); S.skyU.uBolt.value = S.bolt > 0.6 || (S.bolt > 0.2 && Math.sin(t * 60) > 0) ? S.bolt : 0; S.skyU.uBoltA.value = S.boltA;
      // lights and fog follow the mood; the hero stays in colour
      S.hemi.intensity = 1.25 - lk.storm * 0.35 + lk.sun * 0.1; S.sun.intensity = 1.3 - lk.storm * 0.6 + lk.sun * 0.35; S.sun.color.setHex(0xfff0dc).lerp(_c.setHex(0xffc890), lk.sun * 0.5);
      hdr(0xefe7d3, S.fog.color).lerp(hdr(0xb8b2a4, _c), lk.storm * 0.6);
      // birds
      if (S.birdT < 1) { S.birdT += dt / 16; } else if (lk.storm < 0.1 && G.state === 'fight' && (S.birdNext -= dt) <= 0) { S.birdNext = 50 + vrand() * 30; S.birdT = 0; }
      S.birds.visible = S.birdT < 1; S.birdU.uBirdT.value = S.birdT; S.birdU.uBirdA.value = sat(S.birdT * 8) * sat((1 - S.birdT) * 8) * (1 - lk.storm);
      S.tree.pet.visible = lk.petal > 0.01; S.tree.bl.visible = lk.bloom > 0.001;
      // the dragon
      if (!S.dead) D.t += dt * (1 + S.galeOn * 0.1);
      P.rear = damp(P.rear, Math.max(S.rear, S.grind > 0 ? 1 : 0), 6, dt); P.rake = S.rake ? Math.min(1, P.rake + dt * 4) : damp(P.rake, 0, 8, dt);
      P.whip = damp(P.whip, S.whip, 7, dt); P.whipS = S.whipS || 1; P.slump = damp(P.slump, S.slump, 5, dt); P.roar = damp(P.roar, S.roar, 10, dt);
      P.sweep = damp(P.sweep, S.sweep, 2.5, dt); P.sweepA += dt * (0.6 + P.sweep * 1.4); P.dive = damp(P.dive, S.dive, S.dive ? 2.2 : 3.5, dt);
      if (!S.dead) poseDragon(S, b, dt);
      D.root.position.y = -P.dive * 15 + S.descend * 9; D.root.rotation.y = S.descend * 2.6;
      const inkV = b.enraged ? 1 : sat((S.ink - 0.15) / 0.8) * (S.dry ? 0.45 : 1);
      D.U.uInk.value = damp(D.U.uInk.value, inkV, 2, dt); D.U.uGrind.value = S.grind; D.U.uDraw.value = S.draw; D.U.uFlat.value = S.flat;
      S.wetG = damp(S.wetG, S.lvl === 1 ? 1 : 0, 0.4, dt); D.U.uWetG.value = S.wetG;
      for (const pu of D.pupils) { pu.visible = S.eye > 0.01; pu.scale.set(0.5 * S.eye, S.eye, 0.7 * S.eye); }
      // see-through when the coils sit between the camera and the player
      if (p) { const c = camera.position, sx = p.pos.x - c.x, sy = p.pos.y + 1.2 - c.y, sz = p.pos.z - c.z, l2 = Math.max(sx * sx + sy * sy + sz * sz, 1e-6), cf = Math.cos(b.facing), sf = Math.sin(b.facing); let hit = false;
        for (let i = 4; i < NB && !hit; i += 2) { const q = D.C[i], wx = b.pos.x + q.x * cf + q.z * sf, wy = q.y + D.root.position.y, wz = b.pos.z - q.x * sf + q.z * cf, rr = bodyR(i / (NB - 1)) + 0.6;
          const k = clamp(((wx - c.x) * sx + (wy - c.y) * sy + (wz - c.z) * sz) / l2, 0, 1), dx = c.x + sx * k - wx, dy = c.y + sy * k - wy, dz = c.z + sz * k - wz;
          if ((k > 0.02 && k < 0.92 && dx * dx + dy * dy + dz * dz < rr * rr) || (wx - c.x) ** 2 + (wy - c.y) ** 2 + (wz - c.z) ** 2 < (rr + 1.5) ** 2) hit = true; }
        D.fadeA = damp(D.fadeA, hit && !Cam.cine ? 0.5 : 1, 8, dt); D.U.uFade.value = D.fadeA > 0.98 ? 1.01 : D.fadeA;
        // the head too, when it crowds the lens or hides the player
        D.head.getWorldPosition(_a); _a.addScaledVector(_b.set(Math.sin(b.facing), 0, Math.cos(b.facing)), 1.2); const hk = clamp(((_a.x - c.x) * sx + (_a.y - c.y) * sy + (_a.z - c.z) * sz) / l2, 0, 1), hx = c.x + sx * hk - _a.x, hy = c.y + sy * hk - _a.y, hz = c.z + sz * hk - _a.z;
        const hhit = !Cam.cine && (_a.distanceToSquared(c) < 20 || (hk > 0.05 && hk < 0.85 && hx * hx + hy * hy + hz * hz < 2.2));
        D.fadeH = damp(D.fadeH || 1, hhit ? (_a.distanceToSquared(c) < 12 ? 0.15 : 0.45) : 1, 8, dt); D.U.uFadeH.value = D.fadeH > 0.98 ? 1.01 : D.fadeH; }
      // seal block falling onto the player
      const SB = S.sealBlock;
      if (S.sealH && S.sealH.state === 'tele') { const h = S.sealH, k = sat(h.t / h.delay), s = h.shape; SB.visible = true; SB.position.set(s.x + Math.sin(s.dir) * 4, lerp(26, 1.1, k * k * k), s.z + Math.cos(s.dir) * 4); SB.rotation.set(0, s.dir, 0); }
      else if (S.sealHitT > 0 && t - S.sealHitT < 1.2) { SB.visible = true; SB.position.y = 1.1 - sat((t - S.sealHitT - 0.3) / 0.9) * 2.6; }
      else { SB.visible = false; if (S.sealH && S.sealH.state !== 'tele') S.sealH = null; }
      // leaf and petal shapes on their bullets
      { const BQ = S.bq, M = BQ.mesh; let n = 0;
        for (const q of Bul.list) { if (!q.kind || n >= BQ.n) continue; const pet = q.kind === 'petal'; _m.position.set(q.x, q.y + 0.45, q.z); _m.rotation.set(Math.sin(t * 5 + q.t * 7) * 0.25, q.dir + Math.sin(t * 6 + q.t * 3) * 0.4, 0); _m.scale.set(pet ? 1.5 : 1.25, 1, pet ? 1.5 : 2.7); _m.updateMatrix(); M.setMatrixAt(n, _m.matrix); M.setColorAt(n, _c.setRGB(pet ? 1 : 0, 0, 0)); n++; }
        M.count = n; if (n) { M.instanceMatrix.needsUpdate = true; M.instanceColor.needsUpdate = true; } }
      // screen washes, the roar's spatter, the scroll mounting and seal
      if (S.ovU) { const O = S.ovU; renderer.getDrawingBufferSize(O.uRes.value);
        O.uWash.value = S.wash > 0 ? sat((t - S.wash) / S.washDur) : 0; O.uWashK.value = S.washK;
        S.splat = Math.max(0, S.splat - dt / 2.6); O.uSplat.value = smooth(S.splat); O.uFrame.value = S.frame; O.uSeal.value = S.seal > 0 ? sat((t - S.seal) / 0.6) : 0; }
    },
    danger(b, x, z) {
      const S = b.state; if (!S.enso) return Infinity; const r = Math.hypot(x, z);
      if (r > 9.3 && r < 12.7 && Math.abs(angDiff(S.enso.gapA, Math.atan2(x, z))) > 27.5 * PI / 180 && S.enso.walls.length) return 0.3;
      return Infinity;
    },
    bot(b, p) {
      const S = b.state, out = {};
      if (S.enso) { const E = S.enso, r = Math.hypot(p.pos.x, p.pos.z), pa = Math.atan2(p.pos.x, p.pos.z), gd = angDiff(pa, E.gapA), gx = Math.sin(E.gapA), gz = Math.cos(E.gapA);
        // straight across the ring while the stretch in front is still unpainted, otherwise out through the gap where the brush lifted
        const rel = (((pa - E.gapA - E.gap / 2) % TAU) + TAU) % TAU, si = rel < TAU - E.gap ? Math.floor(rel / E.arc) : -1, left = si < 0 ? 99 : E.t0 + E.fire0 + E.step * si - G.now;
        if (E.inside && r < 13.2) { if (left > (13.8 - r) / 7 + 0.35) { out.x = Math.sin(pa) * 15; out.z = Math.cos(pa) * 15; } else if (r < 9.5 && Math.abs(gd) > 0.22) { out.x = gx * 7.5; out.z = gz * 7.5; } else { out.x = gx * 15.5; out.z = gz * 15.5; } out.w = 3; }
        else if (!E.inside && r > 8.8) { if (left > (r - 8.2) / 7 + 0.35) { out.x = Math.sin(pa) * 6.5; out.z = Math.cos(pa) * 6.5; } else if (r > 12.5 && Math.abs(gd) > 0.22) { const a = pa + clamp(gd, -0.6, 0.6); out.x = Math.sin(a) * 15.5; out.z = Math.cos(a) * 15.5; } else { out.x = gx * 6; out.z = gz * 6; } out.w = 3; }
        return out; }
      if (S.carved) { let best = null, bd = 1e9; for (const c of S.carved.cells) { const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z); if (d < bd) { bd = d; best = c; } } if (best) { out.x = best.x; out.z = best.z; out.w = 3; } return out; }
      // a player who knows the fight keeps clear of where wet pools will have spread to, and of leaves that have not grown yet
      const lp = S.leafPred, bl = S.bleed.filter((h) => h.state !== 'done');
      if (lp.length || bl.length) out.avoid = (x, z) => lp.some((c) => Hz.inShape(c, x, z)) || bl.some((h) => Math.hypot(x - h.shape.x, z - h.shape.z) < 4.7);
      return out;
    },
  });
})();
