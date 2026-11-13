// DOOR XII: VESPER, the Lamp-Eater. A black rotunda and one swinging lamp. The dark bites; the light burns.
(() => {
  const R = 18, COLR = 0.95, COLH = 7, ANG = 1.25, WARM = 0xffd9a0, VIOLET = 0x8a50ff, PALE = 0xfff4dc;
  const _a = new V3(), _b = new V3(), _c = new THREE.Color(), _c2 = new THREE.Color(), _m = new THREE.Object3D();
  const COLS = [0, 1, 2, 3, 4, 5].map((k) => ({ x: Math.sin(k * PI / 3) * 10, z: Math.cos(k * PI / 3) * 10, alive: true, k }));
  // per-phase look: warm amber hall -> cooling, violet seeping -> one lamp in violet-black
  const PH = { tint: [[1.05, 1.0, 0.92], [1.0, 1.0, 1.05], [1.0, 0.97, 1.07]], vig: [1.2, 1.28, 1.62], sat: [0.86, 0.88, 0.84], contrast: [1.14, 1.2, 1.3], bloom: [0.42, 0.46, 0.6],
    lift: [[0, 0, 0.004], [0.003, 0, 0.012], [0.006, 0, 0.02]], fog: [0.011, 0.015, 0.019], lamp: [0xffc98a, 0xffe8b8, 0xffcc90], spot: [1, 1.3, 1] };
  const pv = (a, L) => L < 1 ? lerp(a[0], a[1], L) : lerp(a[1], a[2], Math.min(1, L - 1));
  const LU = { p: { value: new V3(0, 13, 0) }, c: { value: new THREE.Color(0) }, r0: { value: new THREE.Color(0) }, f: { value: new THREE.Color(0) } }; // fake lamp bounce on the hall (never on the floor: the floor's light is the fight)

  // ---------- geometry / material helpers ----------
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3();
  function T(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { geo.applyMatrix4(_m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); return geo; }
  function merge(list) {
    let n = 0; const gs = list.map((g) => { const q = g.index ? g.toNonIndexed() : g; if (q !== g) g.dispose(); if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return q; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
    for (const q of gs) { const c = q.attributes.position.count; P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); if (q.attributes.uv) U.set(q.attributes.uv.array, o * 2); o += c; q.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.computeBoundingSphere(); return g;
  }
  const V2 = (a) => a.map((p) => new THREE.Vector2(p[0], p[1]));
  const tube = (pts, r, seg = 32, rad = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(p[0], p[1], p[2])), false, 'centripetal'), seg, r, rad, false);
  // pleated robe: lathe from hem (y=0) to top, radial pleats that fade toward the top
  function robeGeo(h, r0, r1, pl, amp = 0.07, seg = 64, p0 = 0, pL = TAU) {
    const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push(new THREE.Vector2(Math.max(0.02, lerp(r1, r0, Math.pow(t, 0.62)) * (1 + 0.05 * Math.sin(t * PI))), t * h)); }
    const g = new THREE.LatheGeometry(pts, seg, p0, pL), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(x, z), k = 1 + amp * Math.sin(a * pl + Math.sin(a * 3) * 0.6) * (1 - (y / h) * 0.8); P.setX(i, x * k); P.setZ(i, z * k); }
    g.computeVertexNormals(); return g;
  }
  // coursed ashlar for the hall wall
  const ashlar = (rows, cols, seed) => (u, v) => {
    const r = Math.floor(v * rows), fv = v * rows - r, uu = u * cols + (r % 2) * 0.5, c = Math.floor(uu), fu = uu - c;
    const e = Math.min(Math.min(fu, 1 - fu) / cols, Math.min(fv, 1 - fv) / rows), seam = smooth(sat((e - 0.003) / 0.012));
    const id = W.hash2(((c % cols) + cols) % cols, r, seed), n = W.fbm(u * 16, v * 16, seed, 4, 16), pit = W.fbm(u * 48, v * 48, seed + 9, 2, 48);
    return [seam * (0.75 + n * 0.25) - pit * 0.08, (0.45 + id * 0.13 + n * 0.28) * (0.15 + 0.85 * seam), 0.92 - n * 0.2];
  };
  const VSRC = 'varying vec3 vLp;\nvoid main() {', VPOS = '#include <begin_vertex>\nvLp = position;';
  const RIMF = 'vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0);';
  // directional rim: o = { w, v, d } uniforms (warm colour, cold colour, lamp direction in view space)
  const DRIM = ' totalEmissiveRadiance += diffuseColor.rgb * uRimW * 0.55 * pow(max(dot(normal, uLd), 0.0), 3.0);' + ' float ld = dot(normal, uLd); float rp = pow(max(fr, 0.0), 2.2); totalEmissiveRadiance += (uRimW * max(ld + 0.15, 0.0) * 1.3 + uRimV * (max(-ld, 0.0) * 0.8 + 0.25)) * rp;';
  const VWP = '#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;';
  // robe cloth: torn hem (discard), soot toward the hem, rim from the lamp, veins of eaten light, glow of the swallowed heart
  function clothMat(o) {
    const m = W.mat({ color: o.color, roughness: 0.92, side: THREE.DoubleSide }), hem = { value: o.hem || 0 }, soot = { value: o.soot || 0.01 };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uRimW: o.rim.w, uRimV: o.rim.v, uLd: o.rim.d, uVC: { value: o.vc }, uVein: o.vein, uT: o.t, uHem: hem, uSoot: soot, uVH: o.vh, uHp: o.hp, uHc: o.hc });
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vWp;\n' + VSRC).replace('#include <begin_vertex>', VPOS).replace('#include <project_vertex>', VWP);
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRimW, uRimV, uLd, uVC, uHp, uHc; uniform float uVein, uHem, uSoot, uT, uVH; varying vec3 vLp, vWp;\nvoid main() {\n float ang = atan(vLp.x, vLp.z + 1e-5); float tear = uHem * (0.5 + 0.3 * sin(ang * 9.0 + 1.3) * sin(ang * 23.0 + 0.7) + 0.15 * sin(ang * 41.0)); if (vLp.y < tear) discard;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.1, 1.0, smoothstep(0.0, uSoot, vLp.y));')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ ' + RIMF + DRIM + ' vec3 hd = vWp - uHp; totalEmissiveRadiance += uHc * 0.5 / (1.0 + dot(hd, hd) * 5.0);\n' +
          ' float f = vLp.y * 1.7 + sin(ang * 3.0 + vLp.y * 2.0) * 0.6 + sin(ang * 7.0 - vLp.y * 3.1) * 0.25; float ln = 1.0 - smoothstep(0.0, 0.05, abs(fract(f) - 0.5));\n' +
          ' float mk = smoothstep(0.62, 0.95, (sin(ang * 4.0 + vLp.y * 1.3 + uT * 0.35) * 0.5 + 0.5) * 0.7 + uVein * 0.25); float pul = 0.7 + 0.3 * sin(uT * 2.2 - vLp.y * 2.5);\n' +
          ' totalEmissiveRadiance += uVC * ln * mk * uVein * pul * smoothstep(0.15, 1.0, vLp.y) * (1.0 - smoothstep(uVH - 0.9, uVH, vWp.y)); }');
    };
    m.customProgramCacheKey = () => 'lampcloth'; return m;
  }
  function rimMat(m, rim, key) {
    if (!rim.isColor) { m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, { uRimW: rim.w, uRimV: rim.v, uLd: rim.d }); sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRimW, uRimV, uLd;\nvoid main() {').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ ' + RIMF + DRIM + ' }'); }; m.customProgramCacheKey = () => key; return m; }
    m.onBeforeCompile = (sh) => { sh.uniforms.uRim = { value: rim }; sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim;\nvoid main() {').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ ' + RIMF + ' totalEmissiveRadiance += uRim * pow(max(fr, 0.0), 2.4); }'); };
    m.customProgramCacheKey = () => key; return m;
  }
  // hall stone: faint unshadowed lamp bounce (so the dome and wall keep form in the dark) and soot streaks above the niches
  function lampLit(m, key, soot, rim, far) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLp = LU.p; sh.uniforms.uLc = LU.c; sh.uniforms.uRc = rim || LU.r0; sh.uniforms.uFill = LU.f;
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vWp;\nvoid main() {').replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 wq = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n wq = instanceMatrix * wq;\n#endif\n vWp = (modelMatrix * wq).xyz; }');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uLp, uLc, uRc, uFill; varying vec3 vWp;\nvoid main() {')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (soot ? '{ float an = atan(vWp.x, vWp.z + 1e-5) / 0.5235988; float dn = abs(an - floor(an + 0.5)) * 11.0; float sv = 0.65 + 0.35 * sin(vWp.y * 1.7 + an * 5.0);\n float st = exp(-dn * dn * 1.3) * sv * (smoothstep(5.8, 6.8, vWp.y) * (1.0 - smoothstep(7.0, 12.5, vWp.y)) + smoothstep(21.0, 22.5, vWp.y) * (1.0 - smoothstep(22.5, 31.0, vWp.y)));\n diffuseColor.rgb *= 1.0 - 0.8 * clamp(st, 0.0, 1.0); diffuseColor.rgb *= mix(1.0, 0.35, smoothstep(9.0, 20.0, vWp.y)); }' : ''))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 dl = uLp - vWp; float d2 = dot(dl, dl);' + (far ? ' vec3 lv = (viewMatrix * vec4(uLp, 1.0)).xyz + vViewPosition; float ndl = max(dot(normal, lv / max(length(lv), 1e-4)), 0.0); diffuseColor.rgb *= mix(1.0, 0.12, smoothstep(39.0, 45.5, vWp.y)); diffuseColor.rgb *= smoothstep(34.0, 37.5, vWp.y) * 0.85 + 0.15; totalEmissiveRadiance += diffuseColor.rgb * uLc * 1.0 * (0.08 + 0.92 * ndl) / (1.0 + d2 * 0.0012);' : ' totalEmissiveRadiance += diffuseColor.rgb * uLc / (1.0 + d2 * 0.006);') + ' totalEmissiveRadiance += diffuseColor.rgb * uFill * 5.0 * mix(1.0, ' + (far ? '0.35' : '0.12') + ', smoothstep(1.5, 30.0, vWp.y));' + (rim ? ' ' + RIMF + ' totalEmissiveRadiance += uRc * pow(max(fr, 0.0), 2.5);' : '') + ' }');
    };
    m.customProgramCacheKey = () => key; return m;
  }
  // pillar stone: soot-dark tops, violet in shadow, and a dithered see-through state when it hides the player or boss
  function colMat(st, fade, all, vio) {
    const m = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughnessMap: st.roughnessMap, color: 0xeadfcc, roughness: 0.9 }); m.normalScale.set(0.7, 0.7);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uFade = fade; sh.uniforms.uAll = all; sh.uniforms.uVio = vio;
      sh.vertexShader = sh.vertexShader.replace('void main() {', VSRC).replace('#include <begin_vertex>', VPOS);
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uFade, uAll; uniform vec3 uVio; varying vec3 vLp;\nvoid main() {')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(1.0, 0.3, smoothstep(' + (COLH - 3).toFixed(1) + ', ' + COLH.toFixed(1) + ', vLp.y)) * mix(0.7, 1.0, smoothstep(0.0, 1.0, vLp.y));')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); vec3 gn = vNormal / max(length(vNormal), 1e-4); float fr = 1.0 - clamp(abs(dot(gn, vv)), 0.0, 1.0);\n totalEmissiveRadiance += uVio * (0.7 + 1.1 * fr) * (0.6 + 0.4 * diffuseColor.g);\n' +
          ' float pa = atan(vLp.x, vLp.z + 1e-5); float cut = 0.95 + 0.16 * sin(pa * 5.0 + 1.7) + 0.1 * sin(pa * 11.0) + 0.06 * sin(pa * 23.0 + 0.4); float keep = mix(1.0, uFade, max(step(cut, vLp.y), uAll)); float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));\n' +
          ' if (keep < 0.999 && ign > keep) discard; }');
    };
    m.customProgramCacheKey = () => 'lampcol'; return m;
  }
  const sm = (o) => new THREE.ShaderMaterial(Object.assign({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }, o));
  const IGN = 'float ign(){ return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); }';
  const NOISE = 'float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); } float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }';
  const VNV = 'varying vec3 vLp,vN,vV; void main(){ vLp=position; vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; vN=normalMatrix*normal; gl_Position=projectionMatrix*mv; }';
  const ND = 'float nl=length(vN), vl=length(vV); float nd=(nl>1e-5 && vl>1e-5) ? clamp(abs(dot(vN/nl, vV/vl)),0.0,1.0) : 0.0;';

  // Where the lamp is at sim time t (deterministic, so the autopilot and the casts can look ahead).
  function lampAt(S, t, out) {
    if (S.lvl >= 2 && S.carried) { out.x = S.bx; out.z = S.bz; out.h = 7.6; return out; }
    if (S.lvl >= 1) { const w = TAU / 8.5; out.x = Math.sin(t * w) * 8; out.z = Math.cos(t * w) * 8; out.h = 13 + Math.sin(t * TAU / 13) * 3; return out; }
    out.x = Math.sin(t * TAU / 7) * 9; out.z = 0; out.h = 13; return out;
  }
  // Is the floor at (x,z) lit by a lamp at L? Matches the shadow the renderer draws: column cylinders and rubble block the light.
  function litBy(S, L, x, z, pool) {
    const dx = x - L.x, dz = z - L.z, d2 = dx * dx + dz * dz, lim = pool || L.h * Math.tan(ANG) * 0.96;
    if (d2 > lim * lim) return false; if (S.out > 0) return false;
    for (const c of S.cols) {
      const r = c.alive ? COLR : c.rubble ? 1.5 : 0, h = c.alive ? COLH : 1.3; if (!r) continue;
      const fx = L.x - c.x, fz = L.z - c.z, A = d2, B = 2 * (fx * dx + fz * dz), Cq = fx * fx + fz * fz - r * r, disc = B * B - 4 * A * Cq;
      if (disc <= 0 || A < 1e-6) continue; const sq = Math.sqrt(disc), s1 = (-B - sq) / (2 * A), s2 = (-B + sq) / (2 * A);
      if (s2 < 0 || s1 > 1) continue; if (L.h * (1 - Math.max(0, s1)) < h || L.h * (1 - Math.min(1, s2)) < h) return false;
    }
    return true;
  }
  const LNOW = { x: 0, z: 0, h: 13 }, LFUT = { x: 0, z: 0, h: 13 };
  const lampFut = (S, at) => lampAt(S, S.lt + Math.max(0, at - G.now) * S.lrate, LFUT);
  // tuning: seconds in the dark before it bites, seconds for Snuff to shrink the light, and the small pool's radius
  const GRACE = 1.5, SHRINK = 3.0, POOL = 6;
  const lit = (S, x, z) => litBy(S, S.lamp, x, z, S.pool);

  function buildHall(g, S) {
    // floor: worn sandstone slabs, warm, a little sheen under the lamp; two brass inlay rings
    const st = W.bake(512, (u, v) => { const n = 4, fu = (u * n) % 1, fv = (v * n) % 1, e = Math.min(fu, 1 - fu, fv, 1 - fv), seam = smooth(sat(e * 28)), nz = W.fbm(u * 16, v * 16, 5, 5, 16), wear = W.fbm(u * 4, v * 4, 9, 3, 4), id = W.hash2(Math.floor(u * n), Math.floor(v * n), 5);
      return [seam * 0.7 + nz * 0.3, (0.6 + id * 0.12 + nz * 0.22 - wear * 0.12) * (0.55 + 0.45 * seam), 0.78 - nz * 0.3 - wear * 0.2 + (1 - seam) * 0.2]; }, { dark: 0x4a4034, light: 0xc8b496 }); for (const k in st) st[k].repeat.set(5, 5);
    const floorM = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughnessMap: st.roughnessMap, roughness: 0.85, color: 0xffffff, envMapIntensity: 0.25 }); floorM.normalScale.set(0.5, 0.5);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 3, 72), floorM); floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
    const brassIn = W.mat({ color: 0x8a6a3c, roughness: 0.5, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const [r0, r1] of [[R + 0.2, R + 0.55]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 128), brassIn); ring.rotation.x = -PI / 2; ring.position.y = 0.005; ring.receiveShadow = true; g.add(ring); }
    // wall: cool dark ashlar, darker than the floor so the arena edge reads
    const wa = W.bake(512, ashlar(8, 4, 3), { dark: 0x1a161e, light: 0x7a7282, strength: 2.4 }); for (const k in wa) wa[k].repeat.set(48, 8);
    const wallM = lampLit(new THREE.MeshStandardMaterial({ map: wa.map, normalMap: wa.normalMap, roughness: 0.92, color: 0xd8d0dc, side: THREE.BackSide }), 'lampwall', true);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 3, R + 3, 34, 96, 1, true), wallM); wall.position.y = 17; wall.receiveShadow = true; g.add(wall);
    const ta = W.bake(256, ashlar(2, 4, 7), { dark: 0x22242c, light: 0x8a909e, strength: 2.6 }), tp = { map: ta.map.clone(), normalMap: ta.normalMap.clone() }; for (const k in ta) ta[k].repeat.set(80, 1); for (const k in tp) tp[k].repeat.set(2, 34);
    S.hallRim = { value: new THREE.Color(0) };
    const trimM = lampLit(new THREE.MeshStandardMaterial({ map: ta.map, normalMap: ta.normalMap, color: 0xb8bac0, roughness: 0.88, side: THREE.DoubleSide }), 'lamptrim', false, S.hallRim), pilM = lampLit(new THREE.MeshStandardMaterial({ map: tp.map, normalMap: tp.normalMap, color: 0x9a9ca4, roughness: 0.9 }), 'lamppil', false, S.hallRim);
    const ironM = lampLit(W.mat({ color: 0x2a2420, roughness: 0.6, metalness: 0.5 }), 'lampiron');
    // plinth, two cornices, pilasters
    const ringAt = (pts, y) => { const m = new THREE.Mesh(new THREE.LatheGeometry(V2(pts), 128), trimM); m.position.y = y; m.receiveShadow = true; g.add(m); };
    ringAt([[R + 3, 0], [R + 2.2, 0], [R + 2.2, 0.8], [R + 2.45, 1.0], [R + 3, 1.05]], 0);
    for (const y of [10.2, 24]) ringAt([[R + 3, 0], [R + 2.55, 0.1], [R + 2.45, 0.35], [R + 2.25, 0.55], [R + 2.25, 0.8], [R + 2.6, 0.95], [R + 3, 1.0]], y);
    const pil = []; for (let k = 0; k < 12; k++) { const a = k * PI / 6 + PI / 12; pil.push(T(new THREE.BoxGeometry(1.6, 34, 1.2), Math.sin(a) * (R + 2.5), 17, Math.cos(a) * (R + 2.5), 0, a)); }
    const pm = new THREE.Mesh(merge(pil), pilM); pm.receiveShadow = true; g.add(pm);
    // arched niches (lower tier, each with a dead lamp) and tall shuttered windows (upper tier)
    const arch = (w, hs) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, hs); s.absarc(0, hs, w / 2, 0, PI, false); s.lineTo(-w / 2, 0); return new THREE.ShapeGeometry(s, 16); };
    const frame = (w, hs, r) => { const pts = [[-w / 2, 0, 0], [-w / 2, hs * 0.5, 0], [-w / 2, hs, 0]]; for (let i = 1; i < 12; i++) { const q = PI - i / 12 * PI; pts.push([Math.cos(q) * w / 2, hs + Math.sin(q) * w / 2, 0]); } pts.push([w / 2, hs, 0], [w / 2, hs * 0.5, 0], [w / 2, 0, 0]); return tube(pts, r, 64, 4); };
    const nicheBack = arch(2.8, 3.8), nicheFr = merge([frame(3.1, 3.8, 0.26), T(new THREE.BoxGeometry(3.5, 0.22, 0.6), 0, 0, 0.1)]);
    const winBack = arch(3.4, 6), winFr = merge([frame(3.7, 6, 0.24), T(new THREE.BoxGeometry(0.12, 7.6, 0.12), 0, 3.8, 0), T(new THREE.BoxGeometry(3.4, 0.12, 0.12), 0, 6, 0), T(new THREE.BoxGeometry(4.0, 0.26, 0.7), 0, 0, 0.15)]);
    const nb = new THREE.InstancedMesh(nicheBack, lampLit(W.mat({ color: 0x0b090e, roughness: 1 }), 'lampniche'), 12), nf = new THREE.InstancedMesh(nicheFr, trimM, 24);
    S.winM = new THREE.MeshBasicMaterial({ color: 0x000000 }); const wb = new THREE.InstancedMesh(winBack, S.winM, 12);
    S.niches = [];
    for (let k = 0; k < 12; k++) {
      const a = k * PI / 6; _m.rotation.set(0, a + PI, 0); _m.scale.set(1, 1, 1);
      _m.position.set(Math.sin(a) * (R + 2.92), 1.1, Math.cos(a) * (R + 2.92)); _m.updateMatrix(); nb.setMatrixAt(k, _m.matrix);
      _m.position.set(Math.sin(a) * (R + 2.85), 1.1, Math.cos(a) * (R + 2.85)); _m.updateMatrix(); nf.setMatrixAt(k, _m.matrix);
      _m.position.set(Math.sin(a) * (R + 2.92), 13.4, Math.cos(a) * (R + 2.92)); _m.updateMatrix(); wb.setMatrixAt(k, _m.matrix);
      _m.position.set(Math.sin(a) * (R + 2.85), 13.4, Math.cos(a) * (R + 2.85)); _m.scale.set(1.2, 1.25, 1); _m.updateMatrix(); nf.setMatrixAt(12 + k, _m.matrix);
      S.niches.push({ a, x: Math.sin(a) * (R + 2.6), z: Math.cos(a) * (R + 2.6), h: W.hash2(k, 3, 11) });
    }
    g.add(nb); g.add(nf); g.add(wb);
    // 24 dead lamps: one in each niche, one on each pilaster; a few still gutter in the first phase
    const lant = merge([T(new THREE.BoxGeometry(0.08, 0.08, 0.7), 0, 0, 0.35), T(new THREE.BoxGeometry(0.06, 0.06, 0.5), 0, -0.2, 0.2, 0.75), T(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 4), 0, -0.1, 0.68),
      T(new THREE.ConeGeometry(0.24, 0.22, 6), 0, -0.29, 0.68), ...[0, 1, 2, 3].map((k) => T(new THREE.BoxGeometry(0.025, 0.38, 0.025), Math.sin(k * PI / 2 + 0.6) * 0.16, -0.56, 0.68 + Math.cos(k * PI / 2 + 0.6) * 0.16)), T(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 6), 0, -0.75, 0.68), T(new THREE.ConeGeometry(0.06, 0.16, 6), 0, -0.85, 0.68, PI)]);
    const li = new THREE.InstancedMesh(lant, ironM, 24); S.flI = new THREE.InstancedMesh(T(new THREE.SphereGeometry(0.075, 8, 6), 0, 0, 0, 0, 0, 0, 1, 1.9, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), 24); S.flI.frustumCulled = false;
    S.flames = [];
    for (let i = 0; i < 24; i++) {
      const a = i < 12 ? i * PI / 6 : (i - 12) * PI / 6 + PI / 12, rr = i < 12 ? R + 2.9 : R + 1.9, y = i < 12 ? 4.6 : 8.2;
      _m.position.set(Math.sin(a) * rr, y, Math.cos(a) * rr); _m.rotation.set(0, a + PI, 0); _m.scale.set(1, 1, 1); _m.updateMatrix(); li.setMatrixAt(i, _m.matrix);
      _m.position.set(Math.sin(a) * (rr - 0.68), y - 0.56, Math.cos(a) * (rr - 0.68)); _m.updateMatrix(); S.flI.setMatrixAt(i, _m.matrix); S.flI.setColorAt(i, _c.setRGB(0, 0, 0));
      S.flames.push({ h: W.hash2(i, 7, 5), ph: W.hash2(i, 9, 2) * 40 });
    }
    g.add(li); g.add(S.flI);
    S.glowI = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.4, 3.4), sm({ vertexShader: 'varying vec2 vUv; varying vec3 vC; void main(){ vUv=uv; vC=vec3(0.0);\n#ifdef USE_INSTANCING_COLOR\n vC=instanceColor;\n#endif\n gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vUv; varying vec3 vC; void main(){ float d=clamp(length(vUv-0.5)*2.0,0.0,1.0); float a=pow(1.0-d,2.2); gl_FragColor=vec4(max(vC,vec3(0.0))*a,1.0); }' }), 24); S.glowI.frustumCulled = false;
    for (let i = 0; i < 24; i++) { const a = i < 12 ? i * PI / 6 : (i - 12) * PI / 6 + PI / 12, rr = i < 12 ? R + 2.86 : R + 1.87, y = i < 12 ? 4.1 : 7.7; _m.position.set(Math.sin(a) * rr, y, Math.cos(a) * rr); _m.rotation.set(0, a + PI, 0); _m.scale.set(1, 1, 1); _m.updateMatrix(); S.glowI.setMatrixAt(i, _m.matrix); S.glowI.setColorAt(i, _c.setRGB(0, 0, 0)); }
    g.add(S.glowI);
    // ribbed dome and an iron crown of dead candles around the chain
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R + 3, 64, 16, 0, TAU, 0, PI / 2), lampLit(W.mat({ color: 0x58544e, roughness: 0.95, side: THREE.BackSide }), 'lampdome', false, null, true)); dome.scale.y = 0.55; dome.position.y = 34; g.add(dome);
    const ribs = []; for (let k = 0; k < 12; k++) { const a = k * PI / 6 + PI / 12, pts = []; for (let i = 0; i <= 10; i++) { const f = i / 10 * PI / 2 * 0.96; pts.push([Math.sin(a) * (R + 2.6) * Math.cos(f), 34 + 11.3 * Math.sin(f), Math.cos(a) * (R + 2.6) * Math.cos(f)]); } ribs.push(tube(pts, 0.6, 20, 4)); }
    ribs.push(T(new THREE.TorusGeometry(2.2, 0.3, 6, 32), 0, 45.0, 0, PI / 2));
    g.add(new THREE.Mesh(merge(ribs), lampLit(new THREE.MeshStandardMaterial({ map: ta.map, normalMap: ta.normalMap, color: 0xd0c8bc, roughness: 0.85 }), 'lampribs', false, null, true)));
    const crown = [T(new THREE.TorusGeometry(2.7, 0.08, 6, 48), 0, 40, 0, PI / 2)]; for (let k = 0; k < 3; k++) { const a = k * TAU / 3; _a.set(Math.sin(a) * 2.7, 40, Math.cos(a) * 2.7); _b.set(0, 45, 0); const l = _a.distanceTo(_b); const cg = new THREE.CylinderGeometry(0.03, 0.03, l, 4); cg.applyMatrix4(_m4.compose(_p.copy(_a).lerp(_b, 0.5), _q.setFromUnitVectors(new V3(0, 1, 0), _s.copy(_b).sub(_a).normalize()), _s.set(1, 1, 1))); crown.push(cg); }
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12; crown.push(T(new THREE.CylinderGeometry(0.07, 0.08, 0.4 + W.hash2(k, 1, 1) * 0.3, 6), Math.sin(a) * 2.7, 40.25, Math.cos(a) * 2.7)); }
    g.add(new THREE.Mesh(merge(crown), lampLit(W.mat({ color: 0x7a6a56, roughness: 0.6, metalness: 0.3 }), 'lampcrown', false, null, true)));
    return { wallM, trimM, ironM };
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x000000, horizon: 0x020203, bottom: 0x000000, stars: 0, sunDir: [0, 1, 0], sunColor: 0x000000, sunSize: 0.001, sunGlow: 0, clouds: 0 });
    g.add(sky); S.sky = sky; W.env(sky, 0.05);
    scene.fog = new THREE.FogExp2(0x030208, 0.011); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x5a5488, 0x0c0a12, 0.11);
    S.rim = new THREE.DirectionalLight(0x6a6ab0, 0.1); S.rim.position.set(-20, 30, -40); g.add(S.rim); g.add(S.rim.target);
    S.day = new THREE.DirectionalLight(0xfff2dc, 0); S.day.position.set(30, 50, 20); g.add(S.day); g.add(S.day.target);
    // the lamp: one spot with a real shadow map
    S.spot = new THREE.SpotLight(WARM, 15, 90, ANG, 0.22, 0.6); S.spot.castShadow = true; S.spot.shadow.mapSize.set(G.q.shadow, G.q.shadow); S.spot.shadow.camera.near = 1.5; S.spot.shadow.camera.far = 70; S.spot.shadow.bias = -0.0006; S.spot.shadow.normalBias = 0.04; S.spot.shadow.radius = 2;
    g.add(S.spot); g.add(S.spot.target);
    const H = buildHall(g, S), ironM = H.ironM; S.uT = { value: 0 };
    // the hanging lantern: iron cage, warm panes that keep their shape, a small flame, a soft round halo
    S.lampG = new THREE.Group(); g.add(S.lampG); S.lampG.scale.setScalar(1.15);
    S.lampG.add(new THREE.Mesh(merge([T(new THREE.ConeGeometry(0.85, 0.6, 6), 0, 0.85, 0), T(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 6), 0, 0.56, 0), T(new THREE.TorusGeometry(0.16, 0.045, 6, 16), 0, 1.3, 0),
      T(new THREE.CylinderGeometry(0.56, 0.5, 0.1, 6), 0, -0.6, 0), T(new THREE.ConeGeometry(0.2, 0.4, 6), 0, -0.85, 0, PI),
      ...[0, 1, 2, 3, 4, 5].map((k) => T(new THREE.BoxGeometry(0.06, 1.2, 0.06), Math.sin(k * PI / 3 + PI / 6) * 0.57, 0, Math.cos(k * PI / 3 + PI / 6) * 0.57)),
      ...[0, 1, 2, 3, 4, 5].map((k) => T(new THREE.BoxGeometry(0.05, 0.05, 0.6), Math.sin(k * PI / 3) * 0.55, 0.15, Math.cos(k * PI / 3) * 0.55, 0, k * PI / 3 + PI / 2))]),
      rimMat(W.mat({ color: 0x2a221c, roughness: 0.55, metalness: 0.6, emissive: 0x2a1408, emissiveIntensity: 1 }), new THREE.Color(0x804818).multiplyScalar(0.4), 'lampcage')));
    S.paneU = { uC: { value: new THREE.Color(WARM) }, uI: { value: 1.3 } };
    S.lampG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 1.1, 6, 1, true), new THREE.ShaderMaterial({ uniforms: S.paneU, side: THREE.DoubleSide, vertexShader: VNV,
      fragmentShader: 'uniform vec3 uC; uniform float uI; varying vec3 vLp,vN,vV; void main(){ ' + ND + ' float y=clamp(vLp.y/1.1+0.5,0.0,1.0); float soot=mix(1.0,0.22,smoothstep(0.5,1.0,y)); float g=(0.3+0.85*nd*nd)*soot*(0.85+0.15*sin(vLp.y*31.0+vLp.x*13.0)); gl_FragColor=vec4(uC*uI*g,1.0); }' })));
    S.coreM = W.glow(0xffe8c0, 3); const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), S.coreM); core.scale.set(1, 1.9, 1); core.position.y = -0.12; S.lampG.add(core);
    S.haloU = { uC: { value: new THREE.Color(WARM) }, uA: { value: 0.4 } };
    S.halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sm({ uniforms: S.haloU, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float d=clamp(length(vUv-0.5)*2.0,0.0,1.0); float a=pow(1.0-d,2.6)*0.75+pow(1.0-d,9.0)*0.7; gl_FragColor=vec4(uC*a*uA,1.0); }' }));
    S.halo.scale.setScalar(7); S.halo.frustumCulled = false; g.add(S.halo);
    const chainM = rimMat(W.mat({ color: 0x241e1a, roughness: 0.6, metalness: 0.5 }), new THREE.Color(0xa06030).multiplyScalar(0.6), 'lampchain'); chainM.emissive.setHex(0x1a1008);
    S.chain = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 6), chainM); g.add(S.chain);
    S.chain2 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 6), chainM); S.chain2.visible = false; g.add(S.chain2);
    // the beam: soft-edged volumetric cone that fades before the floor, with dust inside it
    S.coneU = { uC: { value: new THREE.Color(WARM) }, uA: { value: 0.05 }, uT: S.uT, uEnd: { value: 0.72 } };
    S.cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 64, 12, true), sm({ uniforms: S.coneU, side: THREE.DoubleSide,
      vertexShader: 'varying float vH, vAng; varying vec3 vN, vV; void main(){ vH=-position.y; vAng=atan(position.x, position.z+1e-5); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; vN=normalMatrix*normal; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uC; uniform float uA,uT,uEnd; varying float vH, vAng; varying vec3 vN, vV; ' + IGN + ' void main(){ ' + ND + ' float edge=nd; float near=smoothstep(2.5,10.0,vl); float h=clamp(vH,0.0,1.0); float fall=pow(clamp(1.0-h/max(uEnd,0.05),0.0,1.0),1.5)*smoothstep(0.0,0.06,h); float shf=0.88+0.12*sin(vAng*9.0+uT*0.3+h*4.0)*sin(vAng*5.0-uT*0.21); float a0=uA*edge*fall*shf*near; float a=max(a0+(ign()-0.5)/255.0*step(0.004,a0),0.0); gl_FragColor=vec4(uC*a,a); }' }));
    S.cone.geometry.translate(0, -0.5, 0); S.cone.frustumCulled = false; g.add(S.cone);
    S.cmotes = W.motes({ n: 160, box: [7, 10, 7], color: 0xffe2b0, size: 0.07, vel: [0.03, -0.1, 0.02], sway: 0.35, center: [0, 6, 0], alpha: 0.9, mult: 1.3 }); g.add(S.cmotes);
    S.motes = W.motes({ n: 300, box: [44, 20, 44], color: 0xffd8a8, size: 0.09, vel: [0.1, -0.05, 0.06], sway: 0.6, center: [0, 9, 0], alpha: 0.45 }); g.add(S.motes);
    S.soot = W.motes({ n: 320, box: [40, 22, 40], color: 0x120e16, size: 0.1, vel: [0.03, -0.45, 0.02], sway: 0.5, center: [0, 11, 0], alpha: 0.0, additive: false }); g.add(S.soot);
    // floor sweep of warm light when the lamp roars back
    S.sweepU = { uC: { value: new THREE.Color(0xffd27a) }, uR: { value: 0 }, uA: { value: 0 } };
    S.sweep = new THREE.Mesh(new THREE.CircleGeometry(26, 96), sm({ uniforms: S.sweepU, vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uR,uA; varying vec2 vP; void main(){ float r=length(vP); float x=(r-uR)/0.32; float a=uA*exp(-x*x)*(1.0-smoothstep(' + (R - 3).toFixed(1) + ',' + (R - 0.8).toFixed(1) + ',r)); gl_FragColor=vec4(uC*a,1.0); }' }));
    S.sweep.rotation.x = -PI / 2; S.sweep.position.y = 0.05; S.sweep.visible = false; S.sweepT = -1; g.add(S.sweep);
    // pillars: fluted shaft (the shadow caster, same radius and height as the mechanic uses), base and capital that do not cast
    // limestone: soft mottling, a few fine dark veins and hairline cracks
    const cst = W.bake(256, (u, v) => { const n = W.fbm(u * 6, v * 6, 21, 5, 6), w = W.fbm(u * 3, v * 3, 23, 3, 3), vein = Math.pow(1 - Math.abs(Math.sin(TAU * (u * 2 + v) + w * 7)), 24), c = W.cell(u * 4, v * 4, 25, 4), crack = 1 - smooth(sat(c[1] * 70)), ck = crack * (W.fbm(u * 9, v * 9, 27, 2, 9) > 0.64 ? 0.6 : 0);
      return [n * 0.6 - ck * 0.4 - vein * 0.1, 0.55 + n * 0.35 - vein * 0.25 - ck * 0.45, 0.8 + n * 0.15]; }, { dark: 0x6a6052, light: 0xece2d0, strength: 1.6 }); for (const k in cst) cst[k].repeat.set(2, 2);
    S.vio = { value: new THREE.Color(0.012, 0.006, 0.036) };
    const rubM = W.mat({ map: cst.map, normalMap: cst.normalMap, color: 0xb8ac98, roughness: 0.95 });
    const shaftG = new THREE.CylinderGeometry(COLR, COLR, COLH, 48, 6, true); { const P = shaftG.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), a = Math.atan2(x, z), k = 1 - 0.05 * Math.pow(Math.abs(Math.cos(a * 8)), 0.6); P.setX(i, x * k); P.setZ(i, z * k); } shaftG.translate(0, COLH / 2, 0); shaftG.computeVertexNormals(); }
    const capG = T(new THREE.LatheGeometry(V2([[0.0, 0], [0.92, 0], [0.98, 0.08], [1.1, 0.22], [1.28, 0.38], [1.36, 0.4], [1.36, 0.62], [0.0, 0.62]]), 32), 0, COLH - 0.6, 0);
    const baseG = new THREE.LatheGeometry(V2([[1.32, 0], [1.32, 0.2], [1.2, 0.3], [1.22, 0.38], [1.06, 0.5], [0.96, 0.62]]), 32);
    const drum = (seed) => { const gg = new THREE.CylinderGeometry(COLR, COLR, 1.1, 16, 1, false), P = gg.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y > 0.3) P.setY(i, y + Math.sin(x * 7.1 + z * 3.3 + seed) * 0.12 + Math.sin(x * 2.3 - z * 5.7 + seed * 2) * 0.1 - 0.08); } gg.computeVertexNormals(); return gg; };
    S.cols = COLS.map((c) => {
      const q = Object.assign({}, c, { alive: true, rubble: false, fall: 0, fadeK: 1 }), grp = new THREE.Group(); grp.position.set(q.x, 0, q.z); g.add(grp);
      q.u = { value: 1 }; q.ua = { value: 0 }; const m = colMat(cst, q.u, q.ua, S.vio);
      const sh = new THREE.Mesh(shaftG, m); sh.castShadow = sh.receiveShadow = true; grp.add(sh);
      q.gu = { uA: { value: 0 } }; q.ghost = new THREE.Mesh(shaftG, new THREE.ShaderMaterial({ uniforms: q.gu, transparent: true, depthWrite: false, vertexShader: VNV, fragmentShader: 'uniform float uA; varying vec3 vLp,vN,vV; void main(){ ' + ND + ' float y=clamp(vLp.y/' + COLH.toFixed(1) + ',0.0,1.0); float a=uA*nd*nd*smoothstep(0.12,0.3,y)*(1.0-smoothstep(0.75,1.0,y)); gl_FragColor=vec4(vec3(0.5,0.56,0.68),a); }' })); q.ghost.renderOrder = 3; grp.add(q.ghost);
      const cap = new THREE.Mesh(capG, m); cap.receiveShadow = true; grp.add(cap);
      const base = new THREE.Mesh(baseG, m); base.receiveShadow = true; grp.add(base);
      const rub = new THREE.Group(); rub.position.set(q.x, 0, q.z); rub.visible = false; g.add(rub);
      for (let i = 0; i < 4; i++) { const mm = new THREE.Mesh(drum(i + q.k * 4), rubM); mm.position.set(Math.sin(i * 1.7) * 0.7, 0.55 + (i === 3 ? 0.6 : 0), Math.cos(i * 1.7) * 0.7); mm.rotation.set(i * 0.5, i, PI / 2 * (i % 2)); mm.castShadow = mm.receiveShadow = true; rub.add(mm); }
      const chips = []; for (let i = 0; i < 7; i++) chips.push(T(new THREE.DodecahedronGeometry(0.18 + W.hash2(i, q.k, 4) * 0.2, 0), Math.sin(i * 2.3) * (1.2 + i * 0.12), 0.08, Math.cos(i * 2.3) * (1.2 + i * 0.12), i, i * 2, 0, 1, 0.6, 1));
      rub.add(new THREE.Mesh(merge(chips), rubM)); q.grp = grp; q.rub = rub; return q;
    });
    // eyes that open in the dark: soft-falloff billboards (eyes + violet halo) and faint smoky bodies
    const eyeVS = (sz, off) => 'varying vec2 vUv; varying float vOpen; varying float vSeed; void main(){ vUv=uv; vec3 c=instanceMatrix[3].xyz; vOpen=length(instanceMatrix[1].xyz); vSeed=fract(c.x*0.37+c.z*0.71); float sz=length(instanceMatrix[0].xyz); vec4 mv=viewMatrix*vec4(c,1.0); mv.xy+=(position.xy*vec2(' + sz + ')+vec2(' + off + '))*sz; gl_Position=projectionMatrix*mv; }';
    S.eyeU = { uE: { value: new THREE.Color(0xd6e2ff).multiplyScalar(2.6) }, uG: { value: new THREE.Color(0x6a3ad0).multiplyScalar(0.3) }, uT: S.uT };
    S.eyeH = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), sm({ uniforms: S.eyeU, vertexShader: eyeVS('0.9, 0.9', '0.0, 0.0'),
      fragmentShader: 'uniform vec3 uE,uG; varying vec2 vUv; varying float vOpen; varying float vSeed; void main(){ vec2 p=(vUv-0.5)*2.0; float e=0.0; for(int i=0;i<2;i++){ vec2 q=p-vec2(i==0?-0.27:0.27,0.04); float r=length(vec2(q.x/0.13,q.y/max(0.075*clamp(vOpen,0.0,1.0),0.004))); e=max(e,1.0-smoothstep(0.55,1.0,r)); } float d=clamp(length(p*vec2(1.0,1.3)),0.0,1.0); float gl=pow(1.0-d,2.5); gl_FragColor=vec4(uE*e+uG*gl*clamp(vOpen,0.0,1.0),1.0); }' }), 32);
    S.eyeB = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: { uT: S.uT }, transparent: true, depthWrite: false, vertexShader: eyeVS('1.2, 2.6', '0.0, -0.85'),
      fragmentShader: 'uniform float uT; varying vec2 vUv; varying float vOpen; varying float vSeed; void main(){ vec2 p=(vUv-0.5)*2.0; float hd=length((p-vec2(0.0,0.6))*vec2(1.0,0.75)); float head=1.0-smoothstep(0.24,0.34,hd); float w=0.2+max(0.0,0.6-p.y)*0.42+0.06*sin(p.y*8.0+uT*2.3+vSeed*20.0); float body=(1.0-smoothstep(w-0.12,w,abs(p.x)))*step(p.y,0.62)*smoothstep(-1.0,-0.15,p.y); float s=clamp(max(head,body),0.0,1.0); float edge=clamp(s*(1.0-s)*4.0,0.0,1.0); vec3 col=mix(vec3(0.015,0.008,0.03),vec3(0.3,0.16,0.62),edge*0.6); gl_FragColor=vec4(col,s*0.34*clamp(vOpen*2.0,0.0,1.0)); }' }), 32);
    S.eyeB.instanceMatrix = S.eyeH.instanceMatrix; for (const m of [S.eyeH, S.eyeB]) { m.count = 0; m.frustumCulled = false; g.add(m); }
    S.eyeB.renderOrder = -1;
    // shade lances: blades of dark smoke rising off each strip's edges, a bright leading edge, a flare when they fire
    const lg = merge([T(new THREE.PlaneGeometry(16, 2.2, 32, 4), -1.25, 1.1, 8, 0, PI / 2), T(new THREE.PlaneGeometry(16, 2.2, 32, 4), 1.25, 1.1, 8, 0, PI / 2), T(new THREE.PlaneGeometry(2.5, 16, 4, 32), 0, 0.04, 8, -PI / 2)]);
    S.lfxM = COLS.map(() => {
      const u = { uK: { value: 0 }, uF: { value: 0 }, uS: { value: -1 }, uT: S.uT }, mm = new THREE.Mesh(lg, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: 'varying vec3 vLp; void main(){ vLp=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform float uK,uF,uS,uT; varying vec3 vLp; ' + NOISE + ' void main(){ float u=clamp(vLp.z/16.0,0.0,1.0), v=clamp(vLp.y/2.2,0.0,1.0); bool flat_=vLp.y<0.1; float sm_=n2(vec2(vLp.z*0.9+vLp.x, vLp.y*1.6-uT*1.8))*0.65+n2(vec2(vLp.z*2.1+3.0, vLp.y*3.2-uT*2.6+vLp.x))*0.35; float fill=1.0-smoothstep(uK-0.06,uK+0.02,u); float ends=smoothstep(0.0,0.04,u)*(1.0-smoothstep(0.94,1.0,u));' +
          ' float a; vec3 col; if(flat_){ float side=abs(vLp.x)/1.25; float inner=1.0-smoothstep(0.72,0.92,side); float st=0.6+0.4*n2(vec2(vLp.x*4.0, vLp.z*0.35-uT*1.2)); float dark=inner*fill*0.72*st*(1.0-uF); float lead=exp(-(u-uK)*(u-uK)*4000.0)*step(0.001,uK)*(1.0-uF)*0.6; float sx=exp(-(u-uS)*(u-uS)*9000.0)*step(-0.05,uS); float ef=0.0; float br=lead+sx+ef; a=(dark+br)*ends; col=mix(vec3(0.015,0.0,0.035),vec3(1.0,0.85,1.7),clamp(br/max(dark+br,1e-3),0.0,1.0)); }' +
          ' else { float hm=0.55+0.45*n2(vec2(vLp.z*0.35-uT*0.5, vLp.x)); float sw=n2(vec2(vLp.z*0.7-uT*0.9+vLp.x, vLp.y*1.3-uT*1.4)); float body=smoothstep(v/hm-0.3, v/hm+0.3, sw)*pow(1.0-v,1.6)*fill*(1.0-uF*0.7); float lead=exp(-(u-uK)*(u-uK)*6000.0)*(1.0-smoothstep(0.0,0.35,v))*step(0.001,uK)*(1.0-uF); a=(body*1.0+lead*0.35)*ends; col=mix(mix(vec3(0.05,0.018,0.1),vec3(0.3,0.15,0.55),v),vec3(0.9,0.7,1.7),clamp(lead,0.0,1.0)); }' +
          ' gl_FragColor=vec4(col,clamp(a,0.0,1.0)); }' }));
      mm.visible = false; mm.frustumCulled = false; mm.renderOrder = 11; g.add(mm); return { mesh: mm, u };
    });
    S.lfx = null;

    // ---- Vesper: a gaunt lamplighter in soot-black robes, a ribcage full of swallowed light ----
    const bg = b.group; S.rig = new THREE.Group(); bg.add(S.rig);
    S.rimC = new THREE.Color(0); S.RO = { w: { value: new THREE.Color(0) }, v: { value: new THREE.Color(0) }, d: { value: new V3(0, 1, 0) } }; S.veinC = new THREE.Color(VIOLET); S.vein = { value: 0.1 }; S.vh = { value: 1.4 }; S.hp = { value: new V3() }; S.hc = { value: new THREE.Color(0) };
    const CO = { rim: S.RO, vc: S.veinC, vein: S.vein, t: S.uT, vh: S.vh, hp: S.hp, hc: S.hc };
    const robe = clothMat(Object.assign({ color: 0x3a3638, hem: 0.6, soot: 1.6 }, CO)), cloth = clothMat(Object.assign({ color: 0x353131, hem: 0.28, soot: 0.4 }, CO)), hoodM = clothMat(Object.assign({ color: 0x2a2628, hem: 0, soot: 0.01 }, CO));
    const bone = rimMat(W.mat({ color: 0xebe2cf, roughness: 0.6, emissive: 0x241c14, emissiveIntensity: 1 }), S.RO, 'lampbone'), black = rimMat(W.mat({ color: 0x050407, roughness: 0.85 }), S.RO, 'lampblack');
    S.rig.add(new THREE.Mesh(robeGeo(4.5, 0.4, 1.7, 14), robe));
    const mantle = new THREE.Mesh(robeGeo(0.9, 0.3, 0.98, 10, 0.08, 48, PI * 0.3, PI * 1.4), cloth); mantle.position.y = 4.35; S.rig.add(mantle);
    S.rig.add(new THREE.Mesh(new THREE.LatheGeometry(V2([[0.28, 3.95], [0.42, 4.3], [0.5, 4.75], [0.46, 5.05], [0.24, 5.3]]), 20, PI * 0.3, PI * 1.4), hoodM));
    const ribs = []; for (let i = 0; i < 5; i++) { const r = 0.44 - Math.abs(i - 1.8) * 0.04, arc = PI * 1.15; ribs.push(T(new THREE.TorusGeometry(r, 0.032, 4, 18, arc), 0, 4.3 + i * 0.17, 0, PI / 2, 0, 0)); ribs[i].rotateY(arc / 2 - PI / 2); }
    ribs.push(T(new THREE.BoxGeometry(0.07, 0.8, 0.05), 0, 4.65, 0.45, -0.1), T(new THREE.CylinderGeometry(0.09, 0.11, 0.35, 8), 0, 5.35, 0.02));
    S.rig.add(new THREE.Mesh(merge(ribs), bone));
    S.heartM = W.glow(VIOLET, 1.2); const heart = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), S.heartM); heart.position.set(0, 4.62, 0.06); S.rig.add(heart);
    S.chestU = { uC: { value: new THREE.Color(VIOLET) }, uA: { value: 0.4 } }; S.chest = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sm({ uniforms: S.chestU, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float d=clamp(length(vUv-0.5)*2.0,0.0,1.0); gl_FragColor=vec4(uC*pow(1.0-d,2.4)*uA,1.0); }' })); S.chest.scale.setScalar(1.5); S.chest.frustumCulled = false; g.add(S.chest); S.heart = heart;
    S.throatM = W.glow(VIOLET, 0.8); const throat = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), S.throatM); throat.position.set(0, 5.28, 0.1); S.rig.add(throat);
    S.head = new THREE.Group(); S.head.position.set(0, 5.62, 0.06); S.rig.add(S.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), black); skull.scale.set(0.82, 1.08, 0.86); S.head.add(skull);
    const hood = new THREE.Mesh(T(new THREE.LatheGeometry(V2([[0.66, 0], [0.54, 0.25], [0.6, 0.55], [0.56, 0.85], [0.42, 1.08], [0.2, 1.24], [0.02, 1.3]]), 28, PI * 0.2, PI * 1.6), 0, 0, 0), hoodM); hood.position.set(0, -0.55, -0.06); hood.rotation.x = 0.1; S.head.add(hood);
    S.eyeM = W.glow(0xfff0d0, 3); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), S.eyeM); e.position.set(sx * 0.13, 0.05, 0.29); e.scale.set(1.7, 0.55, 0.6); S.head.add(e); }
    // a halo of dead lamp-glass behind the head
    const shards = []; for (let i = 0; i < 13; i++) { if (i === 3 || i === 9) continue; const a = i / 13 * TAU, l = 0.14 + W.hash2(i, 2, 9) * 0.26; shards.push(T(new THREE.ConeGeometry(0.06, l, 3), Math.sin(a) * (0.72 + l / 2), Math.cos(a) * (0.72 + l / 2), 0, 0, 0, -a, 1, 1, 0.35)); }
    S.glassM = W.mat({ color: 0x3a3028, roughness: 0.4, metalness: 0.3, emissive: 0xffa860, emissiveIntensity: 0.04, flatShading: true });
    const haloG = new THREE.Group(); haloG.position.set(0, 5.82, -0.4); S.rig.add(haloG); haloG.add(new THREE.Mesh(merge(shards), S.glassM)); haloG.add(new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.025, 5, 40), ironM)); S.haloG = haloG;
    // long jointed arms in torn sleeves, spindly fingers
    const hand = merge([T(new THREE.BoxGeometry(0.15, 0.22, 0.05), 0, -0.1, 0), ...[-1.5, -0.5, 0.5, 1.5].map((f) => T(new THREE.CylinderGeometry(0.018, 0.01, 0.52, 4), f * 0.045, -0.44, 0.03 + Math.abs(f) * 0.0, 0.25, 0, f * 0.07)), T(new THREE.CylinderGeometry(0.018, 0.01, 0.3, 4), 0.09, -0.2, 0.06, 0.5, 0, -0.7)]);
    S.elb = []; S.arms = [-1, 1].map((sx) => {
      const a = new THREE.Group(); a.position.set(sx * 0.66, 5.0, 0); S.rig.add(a);
      const sl = new THREE.Mesh(robeGeo(1.5, 0.16, 0.42, 7, 0.1, 32), cloth); sl.position.y = -1.6; a.add(sl);
      a.add(new THREE.Mesh(T(new THREE.CylinderGeometry(0.055, 0.045, 1.3, 6), 0, -0.65, 0), bone));
      const el = new THREE.Group(); el.position.y = -1.3; el.rotation.x = -0.35; a.add(el); S.elb.push(el);
      el.add(new THREE.Mesh(merge([T(new THREE.SphereGeometry(0.07, 8, 6)), T(new THREE.CylinderGeometry(0.045, 0.035, 1.2, 6), 0, -0.6, 0)]), bone));
      const hd = new THREE.Mesh(hand, bone); hd.position.y = -1.2; hd.scale.x = sx; el.add(hd); return a;
    });
    // her lamplighter's crook, strapped to her back; the lamp hangs from it once swallowed
    S.rig.add(new THREE.Mesh(merge([tube([[0.3, 0.8, -0.72], [0.25, 5, -0.7], [0.15, 9.3, -0.56], [0.06, 10.3, -0.28], [0, 10.5, 0.02], [0, 10.3, 0.16]], 0.055, 48, 6), T(new THREE.TorusGeometry(0.1, 0.03, 4, 10), 0, 10.25, 0.16)]), ironM));
    S.snuffer = new THREE.Mesh(merge([T(new THREE.ConeGeometry(0.18, 0.34, 8, 1, true), 0, 9.95, 0.16), T(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 4), 0, 10.15, 0.16)]), ironM); S.rig.add(S.snuffer);
    // shades: small versions of her (shared materials, prebuilt so nothing compiles mid-fight)
    S.shadeRim = { w: { value: new THREE.Color(0) }, v: { value: new THREE.Color(0x6a40d0).multiplyScalar(0.55) }, d: S.RO.d }; const SO = { rim: S.shadeRim, vc: S.veinC, vein: { value: 0 }, t: S.uT, vh: { value: 0 }, hp: S.hp, hc: { value: new THREE.Color(0) } };
    const shM = clothMat(Object.assign({ color: 0x0a080e, hem: 0.35, soot: 0.8 }, SO)), shHood = clothMat(Object.assign({ color: 0x08060a, hem: 0, soot: 0.01 }, SO));
    const shBlack = W.mat({ color: 0x020203, roughness: 1 }), shEye = W.glow(0xd6e2ff, 3);
    for (const m of [shM, shHood, shBlack, shEye]) m.userData.shared = true;
    S.shadeKit = { robe: robeGeo(1.8, 0.22, 0.78, 9, 0.1, 40), hood: new THREE.LatheGeometry(V2([[0.36, 0], [0.3, 0.15], [0.33, 0.32], [0.26, 0.5], [0.12, 0.62], [0.01, 0.66]]), 18, PI * 0.2, PI * 1.6), head: new THREE.SphereGeometry(0.2, 10, 8), eye: new THREE.SphereGeometry(0.045, 6, 5), shM, shHood, shBlack, shEye };
    // a hidden template so every shade material is compiled during the loading warm-up
    { const tpl = new THREE.Group(); tpl.position.set(0, -50, 0); g.add(tpl); for (const [geo, m] of [[S.shadeKit.robe, shM], [S.shadeKit.hood, shHood], [S.shadeKit.head, shBlack], [S.shadeKit.eye, shEye]]) tpl.add(new THREE.Mesh(geo.clone(), m)); }
    S.tint = [1, 1, 1]; S.lift = [0, 0, 0];
    Object.assign(S, { lvl: 0, lvV: 0, lamp: { x: 0, z: 0, h: 13 }, pool: 0, poolT: 0, out: 0, carried: false, bx: 0, bz: 0, darkT: 0, bites: 0, lt: 0, lrate: 1, biteT: 0, flareAt: 0, sunAt: 0, flareK: 0, sunK: 0, raise: 0, shades: [], dayK: 0, spotI: 15, litK: 0 });
    return {
      edge: 'wall', spawn: { x: 0, z: 6 }, bossStart: { x: 1, z: -14, face: 0 }, camDist: 16,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
      clamp(p) { const d = Math.hypot(p.x, p.z); if (d > R - 0.5) { p.x *= (R - 0.5) / d; p.z *= (R - 0.5) / d; } },
      solid(p) { for (const c of S.cols) { const r = c.alive ? 1.5 : c.rubble ? 1.9 : 0; if (!r) continue; const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz); if (d < r && d > 0.001) { p.x = c.x + dx / d * r; p.z = c.z + dz / d * r; } } },
      camLimit(x, y, z) { const d = Math.hypot(x, z); if (d > R + 2) { x *= (R + 2) / d; z *= (R + 2) / d; } return { x, y: Math.max(y, 0.5), z }; },
    };
  }

  // ---------- casts ----------
  function* flare(b, time = 3.0) {
    const S = b.state, p = G.player; S.flareAt = G.now + time; S.raise = 1; Sound.sfx('charge', 0.8, 1.4);
    const r = yield* b.cast({ name: 'Flare', time, onTick: (k) => { S.flareK = k; } }); S.flareK = 0; S.flareAt = 0; S.raise = 0; if (r === 'dead') return;
    Sound.sfx('bigboom', 1, 1.5); Sound.sfx('zap', 0.8); FX.flash(0xfff6e0, 0.75, 2.2); FX.shake(0.6); S.burst = 1; S.sweepT = 0; S.sweepX = S.lamp.x; S.sweepZ = S.lamp.z;
    if (p.alive && lit(S, p.pos.x, p.pos.z)) p.hurt(420, { blockable: true, src: { name: 'Flare' } });
    yield 0.5;
  }
  function* blackSun(b, time = 2.6) {
    const S = b.state, p = G.player; S.sunAt = G.now + time; S.raise = 1; Sound.sfx('charge', 0.8, 0.5);
    const r = yield* b.cast({ name: 'Black Sun', time, onTick: (k) => { S.sunK = k; } }); S.sunK = 0; S.sunAt = 0; S.raise = 0; if (r === 'dead') return;
    Sound.sfx('bigboom', 1, 0.5); Sound.sfx('roar', 0.6, 0.4); FX.flash(0x1a0830, 0.8, 2.5); FX.shake(0.6); S.dip = 1;
    if (p.alive && !lit(S, p.pos.x, p.pos.z)) p.hurt(420, { blockable: true, src: { name: 'Black Sun' } });
    if (!G.headless) for (const c of S.cols) if (c.alive) FX.ring(c.x, c.z, { r0: 1, r1: 6, color: VIOLET, dur: 0.5 });
    yield 0.5;
  }
  function* clutch(b, n = 3) {
    const p = G.player; yield* b.cast({ name: 'Clutch', time: 0.5 });
    for (let k = 0; k < n; k++) { Hz.circle(p.pos.x, p.pos.z, 2.7, 1.1, 240, { name: 'Clutch', color: VIOLET }); yield 0.55; }
    yield 0.6;
  }
  function* lances(b) {
    const S = b.state; S.raise = 0.6; const fx = [];
    for (const c of S.cols) if (c.alive) { const dir = Math.atan2(c.x - S.lamp.x, c.z - S.lamp.z); Hz.rect(c.x, c.z, dir, 16, 2.5, 1.35, 300, { name: 'Shade Lance', color: VIOLET, quiet: true }); fx.push({ i: c.k, x: c.x, z: c.z, dir }); }
    S.lfx = { t0: G.now, list: fx };
    const r = yield* b.cast({ name: 'Shade Lances', time: 1.35 }); S.raise = 0; if (r === 'done') { Sound.sfx('sword', 1, 0.5); FX.shake(0.4); } yield 0.7;
  }
  function* wing(b) {
    const S = b.state, dir = b.angToPlayer(); b.autoFace = false; S.raise = 0.8;
    Hz.cone(b.pos.x, b.pos.z, dir, 2.3, 8, 1.2, 300, { name: 'Eclipse Wing', color: VIOLET, onFire() { Sound.sfx('sword', 0.9, 0.7); FX.shake(0.4); } });
    yield* b.cast({ name: 'Eclipse Wing', time: 1.2 }); S.raise = 0; yield 0.6; b.autoFace = true;
  }
  function* snuff(b) {
    const S = b.state; S.raise = 1; const r = yield* b.cast({ name: 'Snuff', time: 1.6 }); S.raise = 0; if (r !== 'done') return;
    Sound.sfx('steam', 0.9, 0.6); S.poolT = 7.0; yield 1.0;
  }
  function* step(b) {
    const S = b.state, alive = S.cols.filter((c) => c.alive); let x, z;
    if (S.lvl === 0) { const o = shuffle([[1, 14], [-1, 14], [1, -14], [-1, -14]]).find((q) => Math.hypot(q[0] - b.pos.x, q[1] - b.pos.z) > 4); x = o[0]; z = o[1]; }
    else { const c = pick(alive), a = Math.atan2(c.x, c.z) + pick([-0.45, 0.45]); x = Math.sin(a) * 12.5; z = Math.cos(a) * 12.5; }
    const r = yield* b.cast({ name: 'Shadowstep', time: 0.7 }); if (r !== 'done') return;
    if (!G.headless) { FX.burst(b.pos.x, 2.5, b.pos.z, { n: 40, color: 0x0a0810, color2: 0x302840, speed: [1, 5], life: [0.5, 1.2], size: [0.4, 0.9], smoke: true }); FX.burst(x, 2.5, z, { n: 30, color: 0x0a0810, color2: 0x302840, speed: [1, 4], life: [0.4, 1.0], size: [0.4, 0.9], smoke: true }); }
    Sound.sfx('blink', 0.8, 0.5); b.pos.x = x; b.pos.z = z; yield 0.5;
  }
  function topple(b, c, delay = 1.7) {
    const S = b.state, dir = Math.atan2(-c.x, -c.z) + rnd(-0.5, 0.5);
    Hz.rect(c.x, c.z, dir, COLH + 1.5, 2.6, delay, 320, { name: 'Falling Column', tag: 'fight', onFire() { c.alive = false; c.rubble = true; c.fall = 0.001; c.dir = dir; Sound.sfx('bigboom', 1, 0.7); Sound.sfx('shatter', 0.8, 0.5); FX.shake(0.9); if (!G.headless) FX.burst(c.x + Math.sin(dir) * 4, 0.5, c.z + Math.cos(dir) * 4, { n: 40, color: 0xd8d0c4, speed: [2, 9], life: [0.4, 1.2], size: [0.2, 0.7], radius: 3, smoke: true }); } });
  }
  function spawnShade(b, c) {
    const S = b.state, K = S.shadeKit, grp = new THREE.Group();
    grp.add(new THREE.Mesh(K.robe.clone(), K.shM)); const hood = new THREE.Mesh(K.hood.clone(), K.shHood); hood.position.set(0, 1.55, -0.03); grp.add(hood);
    const head = new THREE.Mesh(K.head.clone(), K.shBlack); head.position.set(0, 1.82, 0.02); grp.add(head);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(K.eye.clone(), K.shEye); e.position.set(sx * 0.08, 1.84, 0.19); e.scale.set(1.6, 0.6, 0.6); grp.add(e); }
    const a = Math.atan2(c.x, c.z), e = b.spawnAdd({ name: 'Shade', hp: 650, x: c.x + Math.sin(a) * 2.5, z: c.z + Math.cos(a) * 2.5, radius: 0.8, aimY: 1.2, mesh: grp, color: VIOLET,
      update(e, dt) {
        const p = G.player; if (!p.alive || G.state !== 'fight' || b.transitioning) return;
        const L = lit(S, e.pos.x, e.pos.z); e.immune = !L; e.dmgTaken = 2; grp.scale.y = damp(grp.scale.y, L ? 0.75 : 1.15, 6, dt);
        if (L && !G.headless && vrand() < dt * 14) FX.burst(e.pos.x, 1.2, e.pos.z, { n: 2, color: 0xffe0a0, speed: [0.5, 2], up: 2, life: [0.3, 0.6], size: [0.15, 0.3] });
        if (!L && !G.headless && vrand() < dt * 5) FX.burst(e.pos.x, 0.4, e.pos.z, { n: 1, color: 0x08060c, color2: 0x241838, speed: [0.2, 0.8], up: 1.2, life: [0.6, 1.2], size: [0.35, 0.7], smoke: true });
        if (e.pause > 0) { e.pause -= dt; return; }
        const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1; e.facing = dampAng(e.facing, Math.atan2(dx, dz), 8, dt);
        if (d < 2.0) { e.pause = 1.6; Hz.circle(e.pos.x + dx / d, e.pos.z + dz / d, 2.2, 0.75, 150, { name: 'Shade', color: VIOLET, quiet: true, tag: 'fight' }); return; }
        const sp = (L ? 1.6 : 4.6) * dt; e.pos.x += dx / d * sp; e.pos.z += dz / d * sp;
      },
      onDeath(e) { const i = S.shades.indexOf(e); if (i >= 0) S.shades.splice(i, 1); } });
    e.pause = 0.8; S.shades.push(e);
  }
  function* shades(b, n = 2) {
    const S = b.state; const r = yield* b.cast({ name: 'What the Dark Keeps', time: 1.4 }); if (r !== 'done') return;
    Sound.sfx('roar', 0.6, 1.8); const alive = shuffle(S.cols.filter((c) => c.alive)); for (let k = 0; k < n && k < alive.length; k++) spawnShade(b, alive[k]); yield 0.6;
  }
  function* devour(b) {
    const S = b.state; S.raise = 1; const r = yield* b.cast({ name: 'Devour Light', time: 3.0, interruptible: true }); S.raise = 0;
    if (r === 'done') { Sound.sfx('roar', 1, 0.4); FX.flash(0x000000, 0.9, 1.2); S.out = 5.5; } yield 0.6;
  }
  function setAct(b, n) {
    const S = b.state; S.lvl = n; S.flareAt = S.sunAt = 0; S.flareK = S.sunK = 0; S.raise = 0; b.autoFace = true; S.walk = false;
    const want = n === 0 ? 6 : n === 1 ? 4 : 3; let live = S.cols.filter((c) => c.alive);
    while (live.length > want) { const c = live[(live.length * 2 + 1) % live.length]; c.alive = false; c.rubble = true; c.fall = 1; live = S.cols.filter((q) => q.alive); }
    S.carried = n >= 2;
  }

  G.bosses.push({
    id: 'lamp', name: 'VESPER', title: 'The Lamp-Eater', hint: 'Mind the dark', color: '#ffe2b0', telegraph: 0x9a60ff,
    hp: 19500, radius: 1.4, aimY: 3.6, enrage: 430,
    post: { bloom: 0.42, threshold: 0.88, radius: 0.7, exposure: 1.0, vig: 1.2, sat: 0.92, contrast: 1.14, tint: [1.06, 1.0, 0.9] },
    music: { bpm: 72, root: 36, scale: [0, 1, 3, 5, 6, 8, 10], prog: [0, 0, 1, 0, 0, 4, 1, 0],
      layers: [
        { v: 'sub', pat: '0...............', oct: -1, len: 14, vol: 0.2 }, { v: 'bell', pat: ['0.......4.......', '2.......1.......'], oct: 2, len: 6, vol: 0.05 }, { v: 'choir', pat: '0...............', oct: 1, len: 16, vol: 0.05 },
        { v: 'pulse', from: 1, pat: '0.0.0.0.0.0.0.0.', oct: 0, len: 1, vol: 0.04 }, { v: 'tom', from: 1, pat: 'x.....x.....x...', vol: 0.16 }, { v: 'bass', from: 1, pat: '0.......0...1...', oct: -1, len: 3, vol: 0.12 },
        { v: 'organ', from: 2, pat: ['0.......4.......', '1.......0.......'], oct: 0, len: 8, vol: 0.09 }, { v: 'taiko', from: 2, pat: 'x...x.x.x...x.xx', vol: 0.2 }, { v: 'choir', from: 2, pat: '4.......2.......', oct: 1, len: 8, vol: 0.07 },
      ] },
    build,
    *intro(b) { Sound.sfx('bell', 0.7, 0.4); yield* Cam.shot([0, 2, 16], [0, 9, 0], [5, 4, 2], [1, 4, -14], 5.5, 46); },
    *death(b) {
      const S = b.state, a = Cam.yaw + 0.4; Cam.cine = { pos: new V3(b.pos.x - Math.sin(a) * 15, 7, b.pos.z - Math.cos(a) * 15), look: new V3(b.pos.x, 4, b.pos.z), fov: 46 };
      Sound.sfx('bell', 1, 0.3); S.dying = 0.001; for (let i = 0; i < 6; i++) { b.aim(_a); FX.explode(_a.x + (vrand() - 0.5) * 2, _a.y + (vrand() - 0.5) * 3, _a.z, PALE, 3 + i, 0xffffff); yield 0.1; }
      FX.flash(0xffffff, 0.9, 0.7); S.rig.visible = false; yield 0.7;
    },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setAct(b, 0); yield 1.2; let n = 0;
        while (true) {
          yield* clutch(b, 2); yield* flare(b, n ? 3.0 : 3.6); yield* wing(b); yield* lances(b); yield* flare(b);
          yield* snuff(b); yield* clutch(b, 3); yield 2.2; yield* step(b); n++;
        }
      } },
      { at: 0.65, skipTo(b) { setAct(b, 1); for (const c of b.state.cols) if (!c.alive) c.fall = 1; },
        *enter(b) {
          const S = b.state; S.flareAt = S.sunAt = 0; S.flareK = S.sunK = 0; S.poolT = 0; S.raise = 1; b.autoFace = true;
          const live = S.cols.filter((c) => c.alive); if (live.length > 4) { topple(b, live[1]); topple(b, live[4], 2.3); }
          yield* b.cast({ name: 'Unmoor', time: 2.6, onTick: (k) => FX.shake(k * 0.25) }); S.raise = 0; S.lvl = 1; Sound.sfx('bell', 1, 0.6);
          yield 1.2;
        },
        *run(b) {
          const S = b.state; setAct(b, 1); yield 0.5; let n = 0;
          while (true) {
            yield* step(b); yield* shades(b, 2); yield* flare(b); yield* blackSun(b); yield* clutch(b, 3); yield* lances(b);
            if (n % 2) { yield* blackSun(b, 3.0); yield* flare(b, 2.6); } else { yield* wing(b); yield* snuff(b); yield* blackSun(b, 3.0); }
            yield 1.0; n++;
          }
        } },
      { at: 0.33, skipTo(b) { setAct(b, 2); for (const c of b.state.cols) if (!c.alive) c.fall = 1; },
        *enter(b) {
          const S = b.state; S.flareAt = S.sunAt = 0; S.flareK = S.sunK = 0; S.poolT = 0; b.autoFace = true;
          const live = S.cols.filter((c) => c.alive); if (live.length > 3) topple(b, live[0]);
          yield* b.moveTo(0, 0, 14); S.raise = 1; S.grab = 1;
          yield* b.cast({ name: 'Swallow the Lamp', time: 2.4, onTick: (k) => FX.shake(k * 0.3) });
          S.bx = b.pos.x; S.bz = b.pos.z; S.carried = true; S.lvl = 2; S.raise = 0; Sound.sfx('roar', 1, 0.5); FX.flash(0x000000, 0.8, 1.0);
          yield 1.4;
        },
        *run(b) {
          const S = b.state; setAct(b, 2); S.bx = b.pos.x; S.bz = b.pos.z; yield 0.4; let n = 0;
          while (true) {
            S.walk = true; yield 2.5; S.walk = false;
            yield* flare(b, 2.5); yield* blackSun(b, 2.4); yield* clutch(b, 3); S.walk = true; yield* lances(b); yield 1.5; S.walk = false;
            yield* (n % 2 ? devour(b) : wing(b)); yield* blackSun(b, 2.4); yield* flare(b, 2.4); yield* clutch(b, 2); n++;
          }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight';
      // the lamp
      // the lamp keeps its own clock so it can drift slower while Snuff holds it to a small pool
      S.slowK = damp(S.slowK || 0, S.poolT > 0 ? 1 : 0, 4, dt); S.lrate = 1 - 0.55 * S.slowK; S.lt += dt * S.lrate;
      S.bx = b.pos.x; S.bz = b.pos.z; lampAt(S, S.lt, LNOW);
      const k = 1 - Math.exp(-(S.carried ? 5 : 2.5) * dt); S.lamp.x = lerp(S.lamp.x, LNOW.x, k); S.lamp.z = lerp(S.lamp.z, LNOW.z, k); S.lamp.h = lerp(S.lamp.h, LNOW.h, k);
      if (S.poolT > 0) S.poolT -= dt; if (S.out > 0) S.out -= dt;
      // Snuff shrinks the light to its small pool over SHRINK seconds (the lit area shrinks with it), then lets it out quickly
      S.poolK = S.poolT > 0 ? Math.min(1, (S.poolK || 0) + dt / SHRINK) : Math.max(0, (S.poolK || 0) - dt / 0.8);
      // (the shrink starts from the arena's far wall, not the lamp's full reach, so all of SHRINK is felt)
      const pe = smooth(S.poolK), full = S.lamp.h * Math.tan(ANG), r0 = Math.min(full * 0.96, R + Math.hypot(S.lamp.x, S.lamp.z));
      S.pool = S.poolK > 0 ? lerp(r0, POOL, pe) : 0;
      const ang = Math.atan((S.poolK > 0 ? lerp(r0 / 0.96, POOL, pe) : full) / S.lamp.h); S.spot.angle = ang;
      S.spot.position.set(S.lamp.x, S.lamp.h, S.lamp.z); S.spot.target.position.set(S.lamp.x, 0, S.lamp.z);
      S.burst = Math.max(0, (S.burst || 0) - dt * 2.5); S.dip = Math.max(0, (S.dip || 0) - dt * 1.6); S.outK = damp(S.outK || 0, S.out > 0 ? 1 : 0, 6, dt);
      S.lvV = damp(S.lvV, S.lvl, 1.2, dt); const L = S.lvV; S.uT.value = t;
      const fk = S.flareK * S.flareK, sk = S.sunK, cs = b.castState;
      let flick = 1; if (cs && cs.name === 'Devour Light') { const q = sat(cs.t / (cs.time || 1)); flick = 1 - q * 0.75 * (0.5 + 0.5 * Math.sin(t * 37) * Math.sin(t * 13.3 + 1)); }
      const gut = 0.96 + 0.04 * Math.sin(t * 9.1) * Math.sin(t * 5.3); // the flame breathes
      S.spot.intensity = S.spotI * pv(PH.spot, L) * (1 + fk * 1.3 + S.burst * 3) * (1 - S.dip * 0.9) * (1 - S.outK * 0.97) * (1 - S.dayK * 0.6) * (0.82 + 0.18 * flick) * gut;
      _c2.setHex(PH.lamp[0]).lerp(_c.setHex(PH.lamp[1]), Math.min(1, L)).lerp(_c.setHex(PH.lamp[2]), Math.max(0, L - 1));
      S.spot.color.copy(_c2).lerp(_c.setHex(0xffffff), fk * 0.8).lerp(_c.setHex(VIOLET), sk * 0.85);
      const glow = (1 + fk * 2.5 + S.burst * 3.5) * (1 - S.outK * 0.94) * (1 - sk * 0.45) * flick * gut;
      S.paneU.uC.value.copy(S.spot.color).multiply(_c.setRGB(1, 0.72, 0.42)); const hot = 1 + sat(L - 1) * 0.45; S.paneU.uI.value = 1.25 * glow * hot;
      S.coreM.color.copy(S.spot.color).lerp(_c.setHex(0xffffff), 0.35).multiplyScalar(2.6 * glow * hot);
      S.haloU.uC.value.copy(S.spot.color); S.haloU.uA.value = 0.42 * glow * (1 - S.dayK);
      const lr = S.lamp.h * Math.tan(ang), vr = lerp(Math.min(lr, S.lamp.h * 0.4), lr, S.poolK);
      S.coneU.uC.value.copy(S.spot.color); S.coneU.uA.value = 0.5 * (1 + fk * 1.6) * (1 - S.poolK * 0.45) * (1 - S.outK) * flick; S.coneU.uEnd.value = lerp(0.7, 1.02, S.poolK);
      S.cone.position.set(S.lamp.x, S.lamp.h, S.lamp.z); S.cone.scale.set(vr, S.lamp.h, vr); S.cone.visible = !S.dying;
      LU.p.value.set(S.lamp.x, S.lamp.h + 1, S.lamp.z); LU.c.value.copy(S.spot.color).multiplyScalar(0.55 * (1 - S.outK) * (1 + fk + S.burst * 2) * flick * (1 - S.dayK));
      S.lampG.position.set(S.lamp.x, S.lamp.h + 0.9, S.lamp.z); S.lampG.visible = !S.dying; S.halo.visible = !S.dying;
      if (!G.headless) { S.halo.position.set(S.lamp.x, S.lamp.h + 0.85, S.lamp.z); S.halo.quaternion.copy(camera.quaternion);
        const cu = S.cmotes.material.uniforms; cu.uCenter.value.set(S.lamp.x, S.lamp.h * 0.5, S.lamp.z); cu.uAlpha.value = 0.9 * (1 - S.outK) * (1 + fk); cu.uCol.value.copy(S.spot.color).multiplyScalar(1.3);
        S.motes.material.uniforms.uAlpha.value = 0.45 * (1 - S.outK * 0.8) * (1 - L * 0.25); S.soot.material.uniforms.uAlpha.value = sat(L - 0.2) * 0.75; }
      if (S.carried) {
        S.chain.visible = false; S.snuffer.visible = false;
        _a.set(0, 10.25 + S.rig.position.y, 0.16).applyAxisAngle(_m.up, b.group.rotation.y).add(b.group.position); _b.set(S.lamp.x, S.lamp.h + 0.9 + 1.5, S.lamp.z);
        const len = Math.max(0.05, _a.distanceTo(_b)); S.chain2.visible = !S.dying; S.chain2.position.copy(_a).lerp(_b, 0.5); S.chain2.scale.set(1, len, 1); S.chain2.quaternion.setFromUnitVectors(_m.up, _b.sub(_a).multiplyScalar(-1 / len)); S.lampG.quaternion.copy(S.chain2.quaternion).multiply(_q.setFromEuler(_e.set(Math.sin(t * 1.1) * 0.12, 0, Math.sin(t * 0.83 + 1) * 0.12)));
      } else { S.chain2.visible = false; S.snuffer.visible = true; S.chain.visible = true; _a.set(0, 45, 0); _b.set(S.lamp.x, S.lamp.h + 2.4, S.lamp.z); const len = _a.distanceTo(_b); S.chain.position.copy(_a).lerp(_b, 0.5); S.chain.scale.set(1, len, 1); S.chain.quaternion.setFromUnitVectors(_m.up, _a.sub(_b).multiplyScalar(1 / Math.max(len, 1e-3))); S.lampG.quaternion.copy(S.chain.quaternion); }
      // floor sweep of light when the lamp returns
      if (S.out > 0) S.wasOut = true; else if (S.wasOut) { S.wasOut = false; S.sweepT = 0; S.sweepX = S.lamp.x; S.sweepZ = S.lamp.z; }
      if (S.sweepT >= 0) { S.sweepT += dt; const q = S.sweepT / 0.6; if (q >= 1 || G.headless) { S.sweepT = -1; S.sweep.visible = false; } else { S.sweep.visible = true; S.sweep.position.set(S.sweepX, 0.05, S.sweepZ); S.sweepU.uR.value = 1.5 + q * 20; S.sweepU.uA.value = 0.8 * (1 - q) * (1 - q); } }
      // columns falling
      for (const c of S.cols) { if (c.fall > 0 && c.fall < 1) { c.fall = Math.min(1, c.fall + dt * 2.6); c.grp.rotation.set(0, 0, 0); c.grp.rotateOnWorldAxis(_a.set(Math.cos(c.dir), 0, -Math.sin(c.dir)), c.fall * c.fall * PI / 2); } if (c.fall >= 1) { c.grp.visible = false; c.rub.visible = true; } }
      // death: daylight
      if (S.dying) { S.dying += dt; S.dayK = sat(S.dying / 1.2); S.day.intensity = S.dayK * 2.4; S.hemi.intensity = 0.1 + S.dayK * 0.9; S.winM.color.setHex(0xfff4e0).multiplyScalar(S.dayK * 3); S.fog.color.setHex(0x030208).lerp(_c.setHex(0x9a9488), S.dayK); }
      else { S.fog.density = pv(PH.fog, L); S.hemi.color.setHex(0x5a5488).lerp(_c.setHex(0x3a4ac0), Math.min(1, L)).lerp(_c.setHex(0x4a3aa8), sat(L - 1)); S.hemi.intensity = 0.11 + Math.min(L, 1.5) * 0.03; S.vio.value.setRGB(0.012, 0.006, 0.036).multiplyScalar(1 + L * 0.5);
        S.hallRim.value.setRGB(0, 0, 0); LU.f.value.setRGB(0.52, 0.46, 0.4).lerp(_c.setRGB(0.37, 0.4, 0.47), Math.min(1, L)).lerp(_c.setRGB(0.5, 0.36, 0.62), sat(L - 1)).multiplyScalar((1 - S.outK * 0.75) * (1 - S.poolK * 0.4) * (1 - S.dayK)); S.vio.value.multiplyScalar(1 - S.outK * 0.55); }
      // phase grade
      if (!G.headless && Post.cur && !S.dying) { const P = Post.cur; for (let i = 0; i < 3; i++) { S.tint[i] = L < 1 ? lerp(PH.tint[0][i], PH.tint[1][i], L) : lerp(PH.tint[1][i], PH.tint[2][i], Math.min(1, L - 1)); S.lift[i] = L < 1 ? lerp(PH.lift[0][i], PH.lift[1][i], L) : lerp(PH.lift[1][i], PH.lift[2][i], Math.min(1, L - 1)); }
        P.tint = S.tint; P.lift = S.lift; P.vig = pv(PH.vig, L); P.sat = pv(PH.sat, L); P.contrast = pv(PH.contrast, L); P.bloom = pv(PH.bloom, L); Post.apply(); }
      // wall lamps: a few gutter in the first phase, gone by the last
      if (!G.headless) { for (let i = 0; i < 24; i++) { const f = S.flames[i], on0 = f.h < 0.6 ? 1 : 0, on1 = f.h < 0.16 ? 0.55 : 0, v = (L < 1 ? lerp(on0, on1, L) : lerp(on1, 0, Math.min(1, L - 1))) * (1 - S.outK) * (1 - S.dayK) * (1 - S.poolK);
          const fl = 0.75 + 0.25 * Math.sin(t * 11 + f.ph) * Math.sin(t * 6.7 + f.ph * 2) + (Math.sin(t * 2.1 + f.ph) > 0.93 ? -0.5 : 0); S.flI.setColorAt(i, _c.setHex(0xffa850).multiplyScalar(Math.max(0, v * fl * 2.4))); S.glowI.setColorAt(i, _c.multiplyScalar(0.3)); }
        S.flI.instanceColor.needsUpdate = true; S.glowI.instanceColor.needsUpdate = true; }
      // Vesper
      S.raiseK = damp(S.raiseK || 0, S.raise || 0, 6, dt); S.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.15 + S.raiseK * 2.3); a.rotation.x = -S.raiseK * 0.3; S.elb[i].rotation.x = -(0.35 + S.raiseK * 0.45 + Math.sin(t * 1.3 + i) * 0.05); });
      S.rig.position.y = Math.sin(t * 1.4) * 0.08; S.head.rotation.z = Math.sin(t * 0.8) * 0.08; S.eyeM.color.setHex(S.sunK > 0 ? VIOLET : 0xfff0d0).multiplyScalar(3 + S.raiseK * 3);
      S.haloG.rotation.z = t * 0.05;
      if (S.walk && fight && p && p.alive && !b.castState) { const d = b.distToPlayer(); if (d > 4.5) { const a = b.angToPlayer(); b.pos.x += Math.sin(a) * 2.3 * dt; b.pos.z += Math.cos(a) * 2.3 * dt; G.arena.solid(b.pos); } }
      if (!p) return;
      const bl = S.carried || litBy(S, S.lamp, b.pos.x, b.pos.z, 0); b.dmgTaken = bl ? 1 : 0.5;
      // her look: warm lamp rim when lit, cold violet when in the dark; veins and heart fill with eaten light each phase
      S.litK = damp(S.litK, bl && S.out <= 0 ? 1 : 0, 5, dt);
      S.RO.w.value.setHex(0xffb060).multiplyScalar((0.5 + sat(L - 1) * 0.4) * S.litK * (1 - S.outK) * (1 - sk * 0.7)); S.RO.v.value.setHex(0x7a50e0).multiplyScalar(0.13 + L * 0.05);
      if (!G.headless) S.RO.d.value.set(S.lamp.x - b.pos.x, S.lamp.h - 4, S.lamp.z - b.pos.z).normalize().transformDirection(camera.matrixWorldInverse);
      const eat = 0.4 + L * 0.5 + S.raiseK * 0.25 + sk * 0.4; S.vein.value = eat; S.vh.value = L < 1 ? lerp(1.4, 3.0, L) : lerp(3.0, 7.0, Math.min(1, L - 1)); S.veinC.setHex(VIOLET).lerp(_c.setHex(0xff9850), sat(L - 1) * 0.45 + fk * 0.4).multiplyScalar(0.8 + sat(L - 1) * 0.25);
      S.heartM.color.setHex(VIOLET).lerp(_c.setHex(0xc090ff), sat(L - 1) * 0.3).multiplyScalar(0.65 + S.raiseK * 0.4 + Math.sin(t * 2.2) * 0.15); S.throatM.color.copy(S.heartM.color).multiplyScalar(0.7);
      if (!G.headless) { S.heart.getWorldPosition(S.hp.value); S.hc.value.copy(S.heartM.color).multiplyScalar(0.1); S.chest.visible = S.rig.visible; S.chest.position.copy(S.hp.value); S.chest.quaternion.copy(camera.quaternion); S.chestU.uC.value.copy(S.heartM.color); S.chestU.uA.value = 0.07; }
      S.glassM.emissiveIntensity = 0.03 + L * 0.12 + sat(L - 1) * (0.25 + 0.2 * Math.sin(t * 7) * Math.sin(t * 3.1)) + fk * 0.3;
      if (!bl && !G.headless && vrand() < dt * 10) FX.burst(b.pos.x, 2 + vrand() * 3, b.pos.z, { n: 1, color: 0x08070c, speed: [0.2, 1], up: 1.5, life: [0.5, 1.1], size: [0.5, 1.0], smoke: true });
      if (L > 0.5 && !G.headless && vrand() < dt * (2 + L * 5)) { const a = vrand() * TAU; FX.burst(b.pos.x + Math.sin(a) * 1.4, 0.3, b.pos.z + Math.cos(a) * 1.4, { n: 1, color: 0x07050a, color2: 0x3a2858, speed: [0.1, 0.5], up: 1.4, life: [0.9, 1.7], size: [0.4, 0.8], smoke: true }); }
      // the dark bites
      const Lp = lit(S, p.pos.x, p.pos.z);
      if (fight && p.alive && !Lp && !b.transitioning) {
        S.darkT += dt;
        if (S.darkT > GRACE) { p.speedMul = 0.75; S.biteT -= dt; if (S.biteT <= 0) { S.biteT = 0.5; p.hurt(Math.min(130, 45 + S.bites * 14), { blockable: false, dot: true, src: { name: 'The Dark' } }); S.bites++; if (!G.headless) FX.burst(p.pos.x, 0.3, p.pos.z, { n: 10, color: 0x06050a, color2: 0x282038, speed: [1, 4], up: 3, life: [0.3, 0.7], size: [0.3, 0.7], radius: 0.8, smoke: true }); } }
      } else { p.speedMul = 1; S.darkT = Math.max(0, S.darkT - dt * 2); if (S.darkT === 0) { S.bites = 0; S.biteT = 0; } }
      if (G.headless) return;
      // pillars that hide the player or the boss (or crowd the camera) dissolve to an outline
      const cp = camera.position;
      camera.getWorldDirection(_b);
      for (const c of S.cols) { let f = 1, al = 0;
        if (c.grp.visible) {
          const dx = c.x - cp.x, dz = c.z - cp.z, dc = Math.hypot(dx, dz), fw = (dx * _b.x + dz * _b.z) / Math.max(dc * Math.hypot(_b.x, _b.z), 1e-4), nk = fw > 0.2 ? sat((5.6 - dc) / 0.7) : sat((4.2 - dc) / 0.7);
          f = 1 - nk; al = nk;
          for (let j = 0; j < 2; j++) { const P = j ? b.pos : p.pos, ty = j ? 3 : 1.2, rr = j ? 2.4 : 1.6, sx = P.x - cp.x, sz = P.z - cp.z, L2 = sx * sx + sz * sz; if (L2 < 1) continue;
            const kk = ((c.x - cp.x) * sx + (c.z - cp.z) * sz) / L2; if (kk <= 0 || kk >= 1 || lerp(cp.y, ty, kk) > COLH + 0.6) continue;
            f = Math.min(f, sat((Math.hypot(cp.x + sx * kk - c.x, cp.z + sz * kk - c.z) - rr) / 0.4)); } }
        c.fadeK = (f < 0.5 ? 0 : 1); c.u.value = c.fadeK; c.gu.uA.value = (1 - c.fadeK) * (1 - (c.alK || 0)) * 0.08 * (1 - S.outK) * (1 - S.poolK * 0.7) * (1 - sat(L - 1) * 0.5); c.alK = damp(c.alK || 0, al, 8, dt); c.ua.value = c.alK; }
      // lance blades
      if (S.lfx) { const e = t - S.lfx.t0, kk = sat(e / 1.35), fire = e > 1.35 ? sat(1 - (e - 1.35) / 0.55) : 0; if (e > 1.9) { for (const q of S.lfxM) q.mesh.visible = false; S.lfx = null; }
        else for (const q of S.lfx.list) { const m = S.lfxM[q.i]; m.mesh.visible = true; m.mesh.position.set(q.x, 0, q.z); m.mesh.rotation.y = q.dir; m.u.uK.value = Math.min(1, kk * 1.02); m.u.uF.value = fire; m.u.uS.value = e > 1.35 ? (e - 1.35) / 0.2 : -1; } }
      // eyes open in the dark near you (cold: they are the dark's, not hers); in later phases they watch from the niches too
      { let n = 0; const slot = Math.floor(t / 1.7), bk = (t / 1.7) % 1, open = sat(Math.min((bk - 0.1) / 0.07, (0.92 - bk) / 0.06));
        if (open > 0) for (let i = 0; i < 12; i++) { const h1 = W.hash2(i, slot, 7), h2 = W.hash2(i, slot, 13), a = h1 * TAU, d = 3 + h2 * 7, x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; if (Math.hypot(x, z) > R - 0.5 || lit(S, x, z)) continue;
          _m.position.set(x, 0.9 + h1 * 0.9, z); _m.rotation.set(0, 0, 0); _m.scale.set(1, open, 1); _m.updateMatrix(); S.eyeH.setMatrixAt(n++, _m.matrix); }
        const nb = n, want = L < 1 ? L * 4 : 4 + (L - 1) * 8;
        for (let i = 0; i < 12 && n < 32; i++) { const ni = S.niches[i]; if (ni.h * 12 >= want) continue; const bb = (t / (2.3 + ni.h) + ni.h * 7) % 1, o = sat(Math.min((bb - 0.06) / 0.05, (0.97 - bb) / 0.05)) * (1 - S.dayK); if (o <= 0) continue;
          _m.position.set(ni.x, 3.4 + ni.h * 2.4, ni.z); _m.rotation.set(0, 0, 0); _m.scale.set(2.2, o, 1); _m.updateMatrix(); S.eyeH.setMatrixAt(n++, _m.matrix); }
        if (L > 1.3) for (let i = 0; i < 5 && n < 32; i++) { const a = W.hash2(i, 5, 3) * TAU, d = 14 + W.hash2(i, 6, 3) * 2.5, x = Math.sin(a) * d, z = Math.cos(a) * d, bb = (t / (1.9 + i * 0.37) + i * 0.31) % 1, o = sat(Math.min((bb - 0.08) / 0.05, (0.95 - bb) / 0.05)) * sat(L - 1.3) * (1 - S.dayK); if (o <= 0 || lit(S, x, z)) continue;
          _m.position.set(x, 1.3 + W.hash2(i, 7, 3) * 1.2, z); _m.rotation.set(0, 0, 0); _m.scale.set(1.4, o, 1); _m.updateMatrix(); S.eyeH.setMatrixAt(n++, _m.matrix); }
        S.eyeH.count = n; S.eyeB.count = nb; S.eyeH.instanceMatrix.needsUpdate = true; }
    },
    danger(b, x, z) {
      const S = b.state; let best = Infinity;
      if (S.flareAt) { lampFut(S, S.flareAt); if (litBy(S, LFUT, x, z, S.pool)) best = Math.max(0, S.flareAt - G.now); }
      if (S.sunAt) { lampFut(S, S.sunAt); if (!litBy(S, LFUT, x, z, S.pool)) best = Math.min(best, Math.max(0, S.sunAt - G.now)); }
      if (best === Infinity && !(S.flareAt && S.flareAt - G.now < 1.6) && !lit(S, x, z)) best = 0.4; // the dark itself
      return best;
    },
    bot(b, p) {
      const S = b.state, wantDark = S.flareAt && (!S.sunAt || S.flareAt < S.sunAt) && S.flareAt - G.now < 1.6, avoid = (x, z) => !wantDark && !lit(S, x, z);
      let target = b; for (const e of S.shades) if (e.alive && !e.immune) target = e;
      if (S.flareAt && (!S.sunAt || S.flareAt < S.sunAt)) { // head for where a shadow will be when the lamp flares
        lampFut(S, S.flareAt); let best = null, bd = 1e9;
        for (const c of S.cols) { if (!c.alive) continue; const a = Math.atan2(c.x - LFUT.x, c.z - LFUT.z); for (const d of [2.2, 3.4, 4.6]) { const x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d; if (Math.hypot(x, z) > R - 1 || litBy(S, LFUT, x, z, S.pool)) continue; const q = Math.hypot(x - p.pos.x, z - p.pos.z); if (q < bd) { bd = q; best = [x, z]; } } }
        if (best) { const tt = bd / 7, left = S.flareAt - G.now; if (left < tt + 0.9) return { x: best[0], z: best[1], w: 4, avoid, target }; const a = Math.atan2(p.pos.x - best[0], p.pos.z - best[1]); let wx = best[0] + Math.sin(a) * 2.4, wz = best[1] + Math.cos(a) * 2.4; if (!lit(S, wx, wz)) { wx = best[0] - Math.cos(a) * 2.6; wz = best[1] + Math.sin(a) * 2.6; } return { x: wx, z: wz, w: 2, avoid, target }; }
      }
      if (S.pool) return { x: S.lamp.x, z: S.lamp.z, w: 3, avoid, target };
      return { avoid, target };
    },
  });
})();
