// DOOR XX: ATROX, the Pit. A sunlit arena, a war-beast on a chain. The chain is real: it wraps around posts, and where it ends, he ends.
(() => {
  const R = 22, PR = 0.85, FL = 12, FLV = 26, BLOOD = 0xff3020, TEL = 0xff7a30, DUST = 0xe8cf9a;
  const POSTS = [[45, 10], [135, 10], [225, 10], [315, 10], [90, 15.5], [270, 15.5]];
  const BANDS = [[3, 8.2], [8.2, 14.6], [14.6, R]];
  const _m = new THREE.Object3D(), _c = new THREE.Color(), _a = new V3(), _b = new V3(), _q = new THREE.Quaternion(), _z = new V3(0, 0, 1);
  const cross = (ax, az, bx, bz) => ax * bz - az * bx;
  const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz || 1e-6, k = clamp(((px - ax) * dx + (pz - az) * dz) / l, 0, 1); return Math.hypot(px - ax - dx * k, pz - az - dz * k); };
  // phase grades (also applied by skipTo so a fight started mid-way looks right)
  const PG = [{ bloom: 0.3, threshold: 0.9, radius: 0.6, exposure: 1.0, vig: 0.92, sat: 1.0, contrast: 1.12, tint: [1.02, 1.0, 0.97] }];
  PG[1] = Object.assign({}, PG[0], { bloom: 0.34, sat: 1.03, tint: [1.04, 0.98, 0.95] }); PG[2] = Object.assign({}, PG[0], { bloom: 0.4, exposure: 1.06, sat: 0.98, contrast: 1.14, tint: [1.0, 0.97, 1.02] });

  // ---- geometry and shader helpers ----
  const _m4 = new THREE.Matrix4(), _e = new THREE.Euler(), _s = new V3(), _p = new V3();
  function T(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { geo.applyMatrix4(_m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); return geo; }
  function merge(list) {
    let n = 0; const gs = list.map((g) => { const q = g.index ? g.toNonIndexed() : g; if (q !== g) g.dispose(); if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return q; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
    for (const q of gs) { const c = q.attributes.position.count; P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); if (q.attributes.uv) U.set(q.attributes.uv.array, o * 2); o += c; q.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.computeBoundingSphere(); return g;
  }
  const canvas = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const NZ = `float h31(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float vn3(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
    float vn2(vec2 p){ return vn3(vec3(p,0.5)); }
    float iso(float n, float w){ return 1.0-smoothstep(0.0,w,abs(n-0.5)); }
  `;
  // inject into a standard material: vh/v = vertex header/after begin_vertex, fh/c/e = fragment header/after colour/after emissive
  function inj(mat, key, U, o) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = (o.vh || '') + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (o.v || ''));
      sh.fragmentShader = (o.fh || '') + '\n' + NZ + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + (o.c || '')).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (o.e || ''));
    };
    mat.customProgramCacheKey = () => 'pit_' + key; return mat;
  }
  const RIM = '{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRim * fr * fr * fr * RIMK; }';
  const SRIM = '{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uSR * fr * fr; }';
  const SKIN = {
    hide: { c: `{ vec3 wn = vWN / max(length(vWN), 1e-4); float n = vn3(vOP * 2.5), n2 = vn3(vOP * 9.0 + 3.0);
        float dors = smoothstep(-0.5, 0.65, wn.y); diffuseColor.rgb *= mix(1.15, 0.5, dors) * (0.85 + 0.25 * n + 0.08 * n2); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.085, 0.055), (1.0 - dors) * 0.5);
        float sc = iso(vn3(vOP * vec3(1.4, 7.0, 1.4) + 11.0), 0.03) * smoothstep(0.68, 0.76, vn3(vOP * vec3(4.0, 0.8, 4.0) + 5.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.95, 0.7, 0.7), sc * 0.8); }`,
      e: `{ float cw = 0.022 + 0.045 * vn3(vOP * 9.0 + 4.0); float cr = iso(vn3(vOP * 2.2 + 1.7) + (vn3(vOP * 11.0) - 0.5) * 0.08, cw) * smoothstep(0.36, 0.52, vn3(vOP * 0.7 + 9.0)); totalEmissiveRadiance += uCrackC * cr * uCrack * 3.2; }` },
    fur: { c: 'diffuseColor.rgb *= (0.6 + 0.5 * vn3(vOP * vec3(16.0, 3.0, 16.0))) * (1.0 + 0.9 * smoothstep(0.2, 0.5, vOP.y));' },
    iron: { c: `{ float n = vn3(vOP * 6.0), s = iso(vn3(vOP * vec3(18.0, 2.0, 18.0) + 4.0), 0.02); diffuseColor.rgb *= 0.72 + 0.45 * n + 0.0 * s; }` },
    helm: { c: `float ck = (1.0 - smoothstep(0.015, 0.045, abs(vOP.x - 0.2 - abs(fract(vOP.z * 3.5) - 0.5) * 0.22))) * step(0.12, vOP.y) * uDmg;
        { float n = vn3(vOP * 6.0), s = iso(vn3(vOP * vec3(18.0, 2.0, 18.0) + 4.0), 0.02); diffuseColor.rgb *= (0.72 + 0.45 * n + 0.0 * s) * (1.0 - ck * 0.85); }`,
      e: 'totalEmissiveRadiance += uCrackC * ck * (0.35 + 1.6 * uHeat);' },
    horn: { c: `{ float t = clamp(vT, 0.0, 1.0); vec3 c = mix(vec3(0.95, 0.9, 0.78), vec3(0.14, 0.1, 0.08), smoothstep(0.5, 1.0, t));
        c *= 1.0 - 0.22 * smoothstep(0.55, 0.95, sin(t * 70.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.0, 0.6, t)); diffuseColor.rgb *= c; }` },
    plain: {},
  };
  function skin(mat, U, kind) {
    const k = SKIN[kind];
    return inj(mat, kind, U, { vh: 'varying vec3 vOP; varying vec3 vWN;' + (kind === 'horn' ? ' attribute float aT; varying float vT;' : ''), v: 'vOP = position; vWN = mat3(modelMatrix) * objectNormal;' + (kind === 'horn' ? ' vT = aT;' : ''),
      fh: 'uniform vec3 uRim, uCrackC; uniform float uCrack, uHeat, uDmg; varying vec3 vOP; varying vec3 vWN;' + (kind === 'horn' ? ' varying float vT;' : ''), c: k.c || '', e: (k.e || '') + RIM.replace('RIMK', { horn: '0.15', iron: '0.45', helm: '0.35', plain: '0.5', fur: '0.2' }[kind] || '1.0') });
  }
  // a tapered, curving horn with aT running base (0) to tip (1)
  function hornGeo(sx, tmax) {
    const S = 18, Rn = 8, P = (t) => new V3(sx * (0.62 + 1.45 * Math.sin(t * 1.35) / Math.sin(1.35)), 0.42 + 0.1 * t + 1.25 * t * t, 0.32 + 0.55 * t - 0.25 * t * t), pos = [], at = [], idx = [];
    for (let i = 0; i <= S; i++) {
      const t = i / S * tmax, c = P(t), tg = P(Math.min(t + 0.01, 1.2)).sub(P(Math.max(t - 0.01, 0))).normalize(), n1 = new V3().crossVectors(tg, new V3(0, 0, 1)); if (n1.lengthSq() < 1e-6) n1.set(1, 0, 0); n1.normalize(); const n2 = new V3().crossVectors(tg, n1).normalize(), r = 0.27 * Math.pow(1 - t, 0.85) + 0.02;
      for (let j = 0; j < Rn; j++) { const a = j / Rn * TAU; pos.push(c.x + (n1.x * Math.cos(a) + n2.x * Math.sin(a)) * r, c.y + (n1.y * Math.cos(a) + n2.y * Math.sin(a)) * r, c.z + (n1.z * Math.cos(a) + n2.z * Math.sin(a)) * r); at.push(t); }
    }
    for (let i = 0; i < S; i++) for (let j = 0; j < Rn; j++) { const a = i * Rn + j, b2 = i * Rn + (j + 1) % Rn, c = a + Rn, d = b2 + Rn; idx.push(a, c, b2, b2, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(at, 1)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const glowTex = () => canvas(64, 64, (x) => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); });

  // ---- the chain: it runs stake -> each wrapped post -> collar ----
  const lastA = (S) => S.wraps.length ? S.wraps[S.wraps.length - 1].q : S.stake;
  function fixedLen(S) { let L = 0, a = S.stake; for (const w of S.wraps) { L += Math.hypot(w.q.x - a.x, w.q.z - a.z); a = w.q; } return L; }
  const reach = (S) => Math.max(0.5, S.L - fixedLen(S));
  function chainStep(S, b) {
    S.taut = 0; if (S.loose) { S.px = b.pos.x; S.pz = b.pos.z; return; }
    for (let it = 0; it < 4; it++) {
      const A = lastA(S), bx = b.pos.x - A.x, bz = b.pos.z - A.z, ox = S.px - A.x, oz = S.pz - A.z, bl = Math.hypot(bx, bz);
      if (S.wraps.length) { // has he come back around the last post?
        const w = S.wraps[S.wraps.length - 1], P = S.wraps.length > 1 ? S.wraps[S.wraps.length - 2].q : S.stake;
        if (cross(w.q.x - P.x, w.q.z - P.z, b.pos.x - w.q.x, b.pos.z - w.q.z) * w.s < 0) { S.wraps.pop(); continue; }
      }
      let hit = null;
      for (const q of S.posts) {
        if (!q.alive || q === A) continue;
        const qx = q.x - A.x, qz = q.z - A.z, ql = Math.hypot(qx, qz); if (ql >= bl || qx * bx + qz * bz <= 0) continue;
        const s0 = cross(ox, oz, qx, qz), s1 = cross(bx, bz, qx, qz);
        if (s0 * s1 < 0 && (!hit || ql < hit.ql)) hit = { q, ql, s: s1 < 0 ? 1 : -1 };
      }
      if (!hit) break;
      S.wraps.push({ q: hit.q, s: hit.s }); if (!G.headless) { Sound.sfx('parry', 0.25, 0.4); FX.burst(hit.q.x, 1.3, hit.q.z, { n: 8, color: 0xffd9a0, speed: [1, 5], life: [0.2, 0.5], size: [0.1, 0.25] }); }
    }
    const A = lastA(S), r = reach(S), dx = b.pos.x - A.x, dz = b.pos.z - A.z, d = Math.hypot(dx, dz);
    if (d > r) { S.taut = d - r; b.pos.x = A.x + dx / d * r; b.pos.z = A.z + dz / d * r; }
    S.px = b.pos.x; S.pz = b.pos.z;
  }
  function dropPost(b, q) {
    const S = b.state; if (!q.alive) return; q.alive = false; q.mesh.visible = false; q.stub.visible = true;
    const i = S.wraps.findIndex((w) => w.q === q); if (i >= 0) S.wraps.length = i;
    FX.explode(q.x, 2, q.z, DUST, 4, 0x8a7a60); Sound.sfx('shatter', 0.9, 0.5); Sound.sfx('boom', 0.8); S.cheer = 1;
  }

  // ---- the beast ----
  function buildBeast(U) {
    const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig); const mats = [], vr = mulberry(77);
    const M = (kind, o) => { const m = skin(W.mat(Object.assign({ transparent: true }, o)), U, kind); mats.push(m); return m; };
    const dents = W.surface('rock', { seed: 31, size: 256, strength: 1.2 }); dents.normalMap.repeat.set(1, 1);
    const hide = M('hide', { color: 0x5a3620, roughness: 0.82 }), fur = M('fur', { color: 0x34241a, roughness: 1, envMapIntensity: 0 }), leather = M('plain', { color: 0x3a2416, roughness: 0.72 }),
      iron = M('iron', { color: 0x46403a, roughness: 0.5, metalness: 0.55, envMapIntensity: 0.55 }), helmM = M('helm', { color: 0x3a3632, roughness: 0.55, metalness: 0.45, envMapIntensity: 0.55, normalMap: dents.normalMap }),
      brass = M('plain', { color: 0xa8782c, roughness: 0.38, metalness: 0.8, envMapIntensity: 0.6 }), horn = M('horn', { color: 0xffffff, roughness: 0.5 }), keratin = M('plain', { color: 0x221814, roughness: 0.5 }), muzzle = M('plain', { color: 0x4a2c24, roughness: 0.55 }),
      bone = M('plain', { color: 0xe6dcc0, roughness: 0.55 }), mouth = M('plain', { color: 0x2a0e0a, roughness: 0.6 }), frothM = M('plain', { color: 0xf4f0ea, roughness: 0.4, emissive: 0x302c28 });
    helmM.normalScale.set(0.25, 0.25); const hn = W.surface('wood', { seed: 44, size: 256, strength: 2.4, n: 3 }); hn.normalMap.repeat.set(3, 2); hn.normalMap.dispose();
    const add = (geo, mat, x, y, z, par = rig) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; par.add(m); return m; };
    // mass: deep chest and a towering shoulder hump in front, lighter haunches behind
    const body = add(new THREE.CapsuleGeometry(1.0, 2.2, 5, 14), hide, 0, 2.3, -0.1); body.rotation.x = PI / 2; body.scale.set(1.05, 1, 1);
    add(new THREE.SphereGeometry(1.45, 16, 12), hide, 0, 2.75, 1.1).scale.set(1.08, 1, 1.1);
    add(new THREE.SphereGeometry(0.95, 14, 10), hide, 0, 3.35, 0.85).scale.set(0.95, 0.8, 1.25);
    add(new THREE.SphereGeometry(1.1, 14, 10), hide, 0, 2.0, 1.9);
    add(new THREE.SphereGeometry(0.98, 14, 10), hide, 0, 2.4, -1.4).scale.set(1.08, 1, 1);
    add(new THREE.SphereGeometry(1.12, 16, 12), hide, 0, 2.28, 0.25).scale.set(1.06, 1.0, 1.35);
    for (const sx of [-1, 1]) { add(new THREE.SphereGeometry(0.78, 12, 9), hide, sx * 0.5, 2.5, -1.3).scale.set(0.8, 1.05, 1.1); add(new THREE.SphereGeometry(0.85, 12, 9), hide, sx * 0.62, 2.45, 1.45).scale.set(0.75, 1.1, 1.0); }
    // shaggy mane over hump and neck
    { const n = 110, im = new THREE.InstancedMesh(T(new THREE.SphereGeometry(0.17, 8, 6), 0, 0.3, 0, 0, 0, 0, 1, 2.6, 0.75), fur, n), c = new V3(0, 2.8, 1.25), d = new V3(), up = new V3(0, 1, 0);
      for (let i = 0; i < n; i++) {
        let nx, ny, nz; do { nx = vr() * 2 - 1; ny = vr() * 2 - 1; nz = vr() * 2 - 1; } while (nx * nx + ny * ny + nz * nz > 1 || nx * nx + ny * ny + nz * nz < 0.05);
        d.set(nx, ny, nz).normalize(); if (d.y < 0.25) d.y = 0.25 + Math.abs(d.y) * 0.5; if (d.z < -0.35) d.z = -d.z * 0.5; d.normalize();
        _m.position.copy(c).addScaledVector(d, 1.28 + vr() * 0.14); _m.position.z += 0.2; d.multiplyScalar(0.5).add(_a.set((vr() - 0.5) * 0.4, -0.35 - vr() * 0.3, -1)).normalize(); _m.quaternion.setFromUnitVectors(up, d); _m.scale.set(1, 0.7 + vr() * 0.7, 1); _m.updateMatrix(); im.setMatrixAt(i, _m.matrix);
      }
      im.castShadow = true; rig.add(im); }
    // armour plates down the spine: scratched iron with brass edges, leather straps round the barrel
    const plates = [];
    for (let i = 0; i < 3; i++) {
      const pg = new THREE.Group(); pg.position.set(0, 3.28 - i * 0.1, 0.05 - i * 0.78); pg.rotation.x = -0.06 + i * 0.07; rig.add(pg); plates.push(pg);
      const w = 1.45 - i * 0.12; add(new THREE.BoxGeometry(w, 0.16, 0.72), iron, 0, 0, 0, pg);
      for (const s of [-1, 1]) { add(new THREE.BoxGeometry(w + 0.04, 0.07, 0.07), brass, 0, 0.02, s * 0.37, pg); add(new THREE.BoxGeometry(0.07, 0.07, 0.76), brass, s * w / 2, 0.02, 0, pg); }
      const sp = add(new THREE.ConeGeometry(0.12, 0.62, 4), iron, 0, 0.38, 0, pg); sp.rotation.x = -0.25;
    }
    for (const z of [0.15, -1.05]) { const st = add(new THREE.TorusGeometry(1.03, 0.065, 6, 28), leather, 0, 2.32, z); st.scale.set(1.06, 1, 1); }
    // head
    const neck = new THREE.Group(); neck.position.set(0, 2.85, 2.2); rig.add(neck);
    add(new THREE.SphereGeometry(0.88, 12, 10), hide, 0, -0.08, -0.4, neck);
    const collar = add(new THREE.TorusGeometry(1.0, 0.16, 8, 22), iron, 0, -0.15, -0.55, neck); collar.rotation.x = 0.15;
    const skull = add(new THREE.SphereGeometry(0.78, 14, 10), hide, 0, 0.1, 0.45, neck); skull.scale.set(1, 0.92, 1.15);
    const helm = add(new THREE.SphereGeometry(0.85, 16, 9, 0, TAU, 0, PI * 0.5), helmM, 0, 0.14, 0.45, neck); helm.scale.set(1.04, 0.98, 1.2);
    const band = add(new THREE.TorusGeometry(0.86, 0.07, 6, 28), brass, 0, 0.16, 0.45, neck); band.rotation.x = PI / 2; band.scale.set(1.04, 1.2, 1);
    { const rv = []; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; rv.push(T(new THREE.SphereGeometry(0.055, 5, 4), Math.sin(a) * 0.86 * 1.06, 0.2, Math.cos(a) * 0.86 * 1.22)); } add(merge(rv), brass, 0, 0, 0.45, neck); }
    add(new THREE.BoxGeometry(0.1, 0.12, 1.5), helmM, 0, 0.98, 0.42, neck).rotation.x = 0.05;
    const nasal = add(new THREE.BoxGeometry(0.2, 0.62, 0.08), helmM, 0, -0.02, 1.43, neck); nasal.rotation.x = -0.32;
    const snout = add(new THREE.CylinderGeometry(0.36, 0.52, 0.9, 10), hide, 0, -0.1, 1.25, neck); snout.rotation.x = PI / 2;
    add(new THREE.SphereGeometry(0.33, 10, 8), muzzle, 0, -0.12, 1.66, neck).scale.set(1, 0.75, 0.45);
    const nose = add(new THREE.TorusGeometry(0.2, 0.045, 6, 14), iron, 0, -0.42, 1.74, neck); nose.rotation.y = PI / 2;
    const jaw = new THREE.Group(); jaw.position.set(0, -0.34, 0.75); neck.add(jaw);
    add(new THREE.BoxGeometry(0.62, 0.2, 0.95), mouth, 0, -0.06, 0.42, jaw);
    const froth = new THREE.Group(); froth.visible = false; neck.add(froth);
    for (const sx of [-1, 1]) {
      const fang = add(new THREE.ConeGeometry(0.08, 0.42, 5), bone, sx * 0.24, -0.5, 1.5, neck); fang.rotation.x = PI;
      add(new THREE.ConeGeometry(0.07, 0.34, 5), bone, sx * 0.22, 0.2, 0.8, jaw);
      const hb = add(new THREE.CylinderGeometry(0.22, 0.3, 0.42, 8), keratin, sx * 0.62, 0.42, 0.34, neck); hb.rotation.z = -sx * 1.1;
      add(hornGeo(sx, sx < 0 ? 0.84 : 1), horn, 0, 0, 0, neck);
      for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.04 + (k % 2) * 0.02, 7, 5), frothM, sx * (0.3 + k * 0.03), -0.52 - k * 0.07, 1.58 - k * 0.06, froth);
    }
    const eyeM = W.glow(0xffc040, 3, { transparent: true }), eyes = [], eyeSM = new THREE.SpriteMaterial({ map: glowTex(), color: 0xff9030, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }); mats.push(eyeM, eyeSM);
    for (const sx of [-1, 1]) { eyes.push(add(new THREE.SphereGeometry(0.13, 8, 6), eyeM, sx * 0.42, 0.17, 1.1, neck)); const sp = new THREE.Sprite(eyeSM); sp.position.set(sx * 0.44, 0.13, 1.3); sp.scale.setScalar(0.35); neck.add(sp); }
    // legs: heavy forearms, fetlock fur, cloven hooves, iron shackles
    const legs = []; let snap = null;
    for (const [x, z, fr] of [[-0.82, 1.4, 1], [0.82, 1.4, 1], [-0.75, -1.45, 0], [0.75, -1.45, 0]]) {
      const hip = new THREE.Group(); hip.position.set(x, 2.1, z); rig.add(hip);
      add(new THREE.CapsuleGeometry(fr ? 0.44 : 0.38, 0.85, 4, 10), hide, 0, -0.55, 0, hip); add(new THREE.CapsuleGeometry(0.25, 0.7, 4, 8), hide, 0, -1.45, 0.08, hip);
      add(new THREE.ConeGeometry(0.36, 0.5, 7), fur, 0, -1.7, 0.1, hip).rotation.x = PI;
      for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.13, 0.2, 0.3, 6), keratin, s * 0.1, -1.95, 0.2, hip);
      const cuff = add(new THREE.TorusGeometry(0.3, 0.095, 6, 14), iron, 0, -1.25, 0.06, hip); cuff.rotation.x = PI / 2;
      const lk = add(new THREE.TorusGeometry(0.12, 0.04, 5, 9), iron, 0, -1.42, 0.36, hip); lk.rotation.y = PI / 2;
      if (x < 0 && !fr) { snap = new THREE.Group(); snap.visible = false; hip.add(snap); for (let k = 0; k < 5; k++) { const l = add(new THREE.TorusGeometry(0.2, 0.065, 5, 9), iron, 0, -1.55 - Math.min(k, 3) * 0.22, 0.4 + Math.max(0, k - 3) * 0.3, snap); l.rotation.set(k > 3 ? PI / 2 : 0, k % 2 ? PI / 2 : 0, 0); } }
      legs.push(hip);
    }
    const tail = new THREE.Group(); tail.position.set(0, 2.5, -2.3); rig.add(tail);
    const tl = add(new THREE.CylinderGeometry(0.07, 0.15, 2.1, 6), hide, 0, 0.3, -0.9, tail); tl.rotation.x = -PI / 2 + 0.45; const tf = add(new THREE.ConeGeometry(0.22, 0.75, 6), fur, 0, 0.85, -2.05, tail); tf.rotation.x = PI / 2 + 0.45;
    for (const m of [horn, helmM, brass, eyeM, eyeSM]) m.userData.solid = true;
    return { g, rig, neck, jaw, legs, tail, eyeM, eyeSM, body, mats, plates, froth, snap, nose };
  }

  function build(b) {
    const g = G.world, S = b.state, vr = mulberry(41);
    const sky = W.sky({ top: 0x4a7ab8, horizon: 0xe8d4b0, bottom: 0xc8b090, sunDir: [0.6, 0.62, -0.5], sunColor: 0x8a7a60, sunSize: 0.03, sunGlow: 1.6, cloudScale: 2.6, clouds: 0.26, cloudColor: 0xfff0dc, cloudDark: 0x9a8a80, cloudSpeed: 0.004, exp: 0.8 });
    g.add(sky); S.sky = sky; W.env(sky, 0.6);
    scene.fog = new THREE.FogExp2(0xd8c0a0, 0.005); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x8088c8, 0x8a6a48, 0.9);
    S.sun = W.sun(g, { dir: [0.6, 0.62, -0.5], color: 0xffd8a0, intensity: 3.6, size: 34 });
    const WU = { uScorch: { value: 0 }, uDesat: { value: 0 }, uNight: { value: 0 }, uFlat: { value: 0.35 }, uSR: { value: new THREE.Color(0) } }; S.WU = WU;
    const wpV = { vh: 'varying vec3 vWP;', v: 'vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;' }, wpF = 'uniform float uScorch, uDesat, uNight, uFlat; varying vec3 vWP;';
    // sand: raked rings, scuffs, damp dark sand toward the wall, old blood, scorched patches at night
    const sd = W.surface('rock', { seed: 9, dark: 0xd6c39c, light: 0xf0e2c4, strength: 0.6 }); for (const k in sd) sd[k].repeat.set(15, 15);
    const sandM = inj(new THREE.MeshStandardMaterial({ map: sd.map, normalMap: sd.normalMap, roughness: 1, color: 0xf2e4c8 }), 'sand', WU, Object.assign({ fh: wpF, c: `diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * vec3(0.78, 0.64, 0.43), uFlat);
        { float r = length(vWP.xz), n1 = vn2(vWP.xz * 0.3), n2 = vn2(vWP.xz * 1.6 + 3.1), n3 = vn2(vWP.xz * 5.0 + 1.3);
        float rk = sin(r * 6.5 + n1 * 5.0) * 0.5 + 0.5; rk = rk * rk * smoothstep(2.0, 5.0, r) * (1.0 - smoothstep(17.0, 20.0, r)) * smoothstep(0.35, 0.65, n1);
        diffuseColor.rgb *= 1.0 - rk * (0.12 + uFlat * 0.08) + (n2 - 0.5) * 0.14 * (1.0 - uFlat * 0.7) + (n3 - 0.5) * 0.07;
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.6, 0.55, 0.52), smoothstep(${(R - 5).toFixed(1)}, ${(R + 0.6).toFixed(1)}, r));
        float sc = smoothstep(0.8, 0.88, vn2(vWP.xz * vec2(2.4, 1.3) + 7.0)); diffuseColor.rgb *= 1.0 - sc * 0.16;
        float bl = smoothstep(0.78, 0.8, vn2(vWP.xz * 0.21 + 11.0)) * smoothstep(0.45, 0.75, n2); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.52, 0.3, 0.25), bl * 0.6);
        float baz = atan(vWP.x, vWP.z) - 0.2618, bq = abs(fract(baz / 0.5236 + 0.5) - 0.5) * 0.5236 * r;
        float scr = (smoothstep(0.7, 0.74, vn2(vWP.xz * 0.17 + 23.0) + (n2 - 0.5) * 0.3) * 0.7 + (1.0 - smoothstep(2.4, 3.4 + n3 * 0.8, r)) + (1.0 - smoothstep(0.9, 1.6 + n3 * 0.6, bq)) * smoothstep(19.4, 20.8, r)) * uScorch; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.06, 0.05), scr * 0.7);
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(0.8, 0.9, 1.0), uDesat); }` }, wpV));
    sandM.normalScale.set(0.5, 0.5); S.sandM = sandM;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 0.8, 96), sandM); floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
    for (let i = 0; i < 3; i++) { const rk = new THREE.Mesh(new THREE.RingGeometry(BANDS[i][0] - 0.06, BANDS[i][0] + 0.06, 72), new THREE.MeshBasicMaterial({ color: 0x6a5230, transparent: true, opacity: 0.35 })); rk.rotation.x = -PI / 2; rk.position.y = 0.012; g.add(rk); }
    // the pit wall: dark timber planks, stained and gouged low down, posts with iron straps, a rope-bound rail
    const rimS = (m, key) => inj(m, key, WU, { fh: 'uniform vec3 uSR;', e: SRIM }), ironMat = () => rimS(W.mat({ color: 0x5e4c40, roughness: 0.55, metalness: 0.35, envMapIntensity: 0.6 }), 'ironS'), ironM = ironMat();
    const wd = W.surface('wood', { seed: 3, dark: 0x4e3c2a, light: 0xa48c6c, n: 8 }); for (const k in wd) wd[k].repeat.set(24, 1);
    const wallM = inj(new THREE.MeshStandardMaterial({ map: wd.map, normalMap: wd.normalMap, roughness: 0.85, color: 0xf0e0c8, side: THREE.DoubleSide }), 'wall', WU, Object.assign({ fh: wpF, c: `{ float az = atan(vWP.x, vWP.z), lo = 1.0 - smoothstep(0.2, 2.6, vWP.y), n = vn2(vec2(az * 30.0, vWP.y * 1.5));
        diffuseColor.rgb *= mix(1.0, 0.62 + n * 0.15, lo);
        float bl = smoothstep(0.66, 0.78, vn2(vec2(az * 14.0, vWP.y * 2.2) + 5.0)) * (1.0 - smoothstep(0.5, 3.2, vWP.y)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.05, 0.03), bl * 0.7);
        float gg = iso(vn2(vec2(az * 60.0 + vWP.y * 3.0, vWP.y * 0.8) + 9.0), 0.008) * smoothstep(0.62, 0.72, vn2(vec2(az * 8.0, vWP.y * 0.6) + 2.0)) * (1.0 - smoothstep(2.0, 4.5, vWP.y));
        diffuseColor.rgb *= 1.0 - gg * 0.3; }` }, wpV));
    const wall = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(R + 0.6, -0.1), new THREE.Vector2(R + 0.6, 6.5)], 120, PI + 0.15, TAU - 0.3), wallM); wall.receiveShadow = wall.castShadow = true; g.add(wall);
    const st = W.surface('slabs', { seed: 4, dark: 0x6a5c48, light: 0xb8a88c, n: 6 }); for (const k in st) st[k].repeat.set(16, 2);
    const stoneM = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: 0.92, color: 0xc8b8a0, side: THREE.DoubleSide });
    const prof = [[R + 0.6, 6.5], [R + 3.2, 6.5], [R + 3.2, 8.6], [R + 5.8, 8.6], [R + 5.8, 10.7], [R + 8.4, 10.7], [R + 8.4, 12.8], [R + 11, 12.8], [R + 11, 14.2]].map(([x, y]) => new THREE.Vector2(x, y));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), stoneM); bowl.receiveShadow = true; g.add(bowl);
    const GA = 0.2, atGate = (a) => Math.abs(angDiff(a, PI)) < GA + 0.06;
    { const tim = [], irn = []; for (let i = 0; i < 28; i++) { const a = i / 28 * TAU + 0.05; if (atGate(a)) continue; const x = Math.sin(a), z = Math.cos(a);
        tim.push(T(new THREE.BoxGeometry(0.7, 6.6, 0.5), x * (R + 0.4), 3.25, z * (R + 0.4), 0, a));
        for (const y of [1.1, 4.9]) { irn.push(T(new THREE.BoxGeometry(0.8, 0.22, 0.56), x * (R + 0.38), y, z * (R + 0.38), 0, a)); for (const s of [-1, 1]) irn.push(T(new THREE.SphereGeometry(0.06, 5, 4), x * (R + 0.09) + z * s * 0.26, y, z * (R + 0.09) - x * s * 0.26)); } }
      const tm = new THREE.Mesh(merge(tim), W.mat({ color: 0x6a4a2e, roughness: 0.85 })); tm.castShadow = tm.receiveShadow = true; g.add(tm); const imm = new THREE.Mesh(merge(irn), ironM); imm.castShadow = true; g.add(imm); }
    const ropeT = canvas(32, 32, (x) => { x.fillStyle = '#6a5434'; x.fillRect(0, 0, 32, 32); x.strokeStyle = '#3a2a18'; x.lineWidth = 5; for (let i = -2; i < 4; i++) { x.beginPath(); x.moveTo(i * 12, 0); x.lineTo(i * 12 + 32, 32); x.stroke(); } }); ropeT.wrapS = ropeT.wrapT = THREE.RepeatWrapping; ropeT.repeat.set(420, 2);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(R + 0.55, 0.3, 8, 160), W.mat({ map: ropeT, roughness: 0.9 })); rail.rotation.x = PI / 2; rail.position.y = 6.55; rail.castShadow = true; g.add(rail);
    // banners in Atrox's colours: crimson, ochre border, the black bull skull, tattered hems
    { const bt = canvas(128, 256, (x) => { x.fillStyle = '#5e1410'; x.fillRect(0, 0, 128, 256); x.fillStyle = '#a07a34'; x.fillRect(0, 0, 128, 14); x.fillRect(0, 0, 9, 256); x.fillRect(119, 0, 9, 256);
        x.fillStyle = '#140806'; x.beginPath(); x.ellipse(64, 104, 22, 28, 0, 0, TAU); x.fill(); x.beginPath(); x.moveTo(44, 92); x.quadraticCurveTo(14, 84, 18, 50); x.quadraticCurveTo(28, 78, 50, 80); x.fill(); x.beginPath(); x.moveTo(84, 92); x.quadraticCurveTo(114, 84, 110, 50); x.quadraticCurveTo(100, 78, 78, 80); x.fill();
        x.fillStyle = '#a07a34'; x.beginPath(); x.arc(55, 100, 4, 0, TAU); x.arc(73, 100, 4, 0, TAU); x.fill(); x.strokeStyle = '#a07a34'; x.lineWidth = 3; x.beginPath(); x.arc(64, 134, 7, 0, TAU); x.stroke();
        x.globalCompositeOperation = 'destination-out'; const r = mulberry(8); for (let i = 0; i < 12; i++) { const px = i * 11 + r() * 6; x.beginPath(); x.moveTo(px - 6, 256); x.lineTo(px, 200 + r() * 40); x.lineTo(px + 7, 256); x.fill(); } for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(r() * 128, 150 + r() * 80, 2 + r() * 4, 0, TAU); x.fill(); } });
      const bl = []; for (let i = 0; i < 14; i++) { const a = (i + 0.5) / 14 * TAU + 0.05; if (atGate(a)) continue; bl.push(T(new THREE.PlaneGeometry(1.5, 3.0), Math.sin(a) * (R + 0.08), 4.75, Math.cos(a) * (R + 0.08), 0, a + PI, (i % 3 - 1) * 0.03)); }
      const bn = new THREE.Mesh(merge(bl), W.mat({ map: bt, roughness: 0.95, alphaTest: 0.5, side: THREE.DoubleSide })); bn.castShadow = true; g.add(bn); }
    // the gate: stone jambs and lintel, thick bars with crossbands, a red-lit tunnel behind
    { const gz = -(R + 0.2), gs = W.surface('stone', { seed: 21, dark: 0x4a4036, light: 0x8a7c68 }), gm = new THREE.MeshStandardMaterial({ map: gs.map, normalMap: gs.normalMap, roughness: 0.9 });
      const jg = merge([T(new THREE.BoxGeometry(1.1, 6.4, 1.3), -3.6, 3.2, 0), T(new THREE.BoxGeometry(1.1, 6.4, 1.3), 3.6, 3.2, 0), T(new THREE.BoxGeometry(8.4, 1.1, 1.4), 0, 5.95, 0), T(new THREE.BoxGeometry(1.0, 1.3, 1.5), 0, 5.95, -0.05)]);
      const jm = new THREE.Mesh(jg, gm); jm.position.z = gz; jm.castShadow = jm.receiveShadow = true; g.add(jm);
      S.gateU = { uI: { value: 1 } };
      const back = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 5.4), new THREE.ShaderMaterial({ uniforms: S.gateU, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform float uI; varying vec2 vUv; void main(){ float c=1.0-abs(vUv.x-0.5)*1.7; float d=pow(clamp(c,0.0,1.0),1.6)*pow(clamp(1.0-vUv.y,0.0,1.0),1.4); vec3 col=vec3(0.02,0.012,0.01)+vec3(0.42,0.07,0.025)*d*uI; gl_FragColor=vec4(col,1.0); }' }));
      back.position.set(0, 2.7, -(R + 5.4)); g.add(back);
      const tun = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5.6, 4.9), new THREE.MeshStandardMaterial({ map: gs.map, normalMap: gs.normalMap, roughness: 0.95, color: 0x8a7a6a, side: THREE.BackSide })); tun.position.set(0, 2.8, -(R + 0.55 + 2.45)); tun.receiveShadow = true; g.add(tun);
      const bars = []; for (let i = -3; i <= 3; i++) { bars.push(T(new THREE.CylinderGeometry(0.15, 0.15, 5.4, 6), i * 0.85, 2.7, 0)); bars.push(T(new THREE.ConeGeometry(0.2, 0.4, 6), i * 0.85, -0.05, 0, PI)); }
      for (const y of [1.5, 3.6]) bars.push(T(new THREE.BoxGeometry(6.3, 0.34, 0.22), 0, y, 0.14));
      const bm = new THREE.Mesh(merge(bars), W.mat({ color: 0x1e1a18, roughness: 0.6, metalness: 0.4 })); bm.position.set(0, 0.2, gz - 0.45); bm.castShadow = true; g.add(bm);
      S.gateFloor = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.ShaderMaterial({ uniforms: S.gateU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform float uI; varying vec2 vUv; void main(){ float a=(1.0-smoothstep(0.0,1.0,vUv.y))*(1.0-smoothstep(0.2,0.5,abs(vUv.x-0.5))); gl_FragColor=vec4(vec3(0.24,0.035,0.014)*a*uI,1.0); }' }));
      S.gateFloor.rotation.x = -PI / 2; S.gateFloor.position.set(0, 0.02, gz + 1.6); g.add(S.gateFloor); }
    // junk of old fights at the wall foot: shields, broken spears, bones
    { const wdG = [], irG = [], bnG = [];
      for (let i = 0; i < 26; i++) { const a = vr() * TAU; if (atGate(a)) continue; const x = Math.sin(a), z = Math.cos(a), k = i % 3;
        if (k === 0) { const sh = T(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 12), 0, 0, 0, PI / 2 - 0.35, 0, 0); T(sh, x * (R + 0.2), 0.45, z * (R + 0.2), 0, a); wdG.push(sh); irG.push(T(T(new THREE.SphereGeometry(0.12, 6, 4), 0, 0, 0.06, -0.35), x * (R + 0.15), 0.45, z * (R + 0.15), 0, a)); }
        else if (k === 1) { const da = 0.06 + vr() * 0.05; wdG.push(T(T(new THREE.CylinderGeometry(0.04, 0.04, 2.0 + vr(), 5), 0, 0, 0, PI / 2 - 0.2), Math.sin(a + da) * (R + 0.3), 0.15 + vr() * 0.5, Math.cos(a + da) * (R + 0.3), 0, a + PI / 2 + 0.08)); if (vr() < 0.6) irG.push(T(T(new THREE.ConeGeometry(0.08, 0.4, 4), 0, 0, 0, PI / 2), Math.sin(a) * (R + 0.3), 0.1, Math.cos(a) * (R + 0.3), 0, a + PI / 2)); }
        else { bnG.push(T(new THREE.SphereGeometry(0.2, 8, 6), x * (R + 0.15), 0.16, z * (R + 0.15), 0, 0, 0, 1, 0.85, 1.15)); bnG.push(T(T(new THREE.CylinderGeometry(0.04, 0.05, 0.8, 5), 0, 0, 0, PI / 2), x * (R + 0.05), 0.05, z * (R + 0.05), 0, a + 0.6)); } }
      for (const [gl, m] of [[wdG, W.mat({ color: 0x5a3e24, roughness: 0.85 })], [irG, ironM], [bnG, W.mat({ color: 0xcfc2a0, roughness: 0.7 })]]) { const mm = new THREE.Mesh(merge(gl), m); mm.castShadow = true; mm.receiveShadow = true; g.add(mm); } }
    // the crowd: head-and-shoulders figures, muted cloth, darker toward the back; two variants (one with a fist up)
    S.CU = { uT: { value: 0 }, uAmp: { value: 0 }, uJump: { value: 0 }, uStand: { value: 0 }, uFire: { value: 0 } };
    const crowdGeo = (arm) => { const l = [T(new THREE.CylinderGeometry(0.3, 0.2, 0.78, 7), 0, 0.39, 0, 0, 0, 0, 1.3, 1, 0.7), T(new THREE.SphereGeometry(0.12, 6, 4), 0, 0.76, 0, 0, 0, 0, 3.2, 0.7, 1.6), T(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 6), 0, 0.85, 0.02), T(new THREE.SphereGeometry(0.17, 8, 6), 0, 1.02, 0.04, 0, 0, 0, 0.95, 1.1, 1), T(new THREE.CylinderGeometry(0.07, 0.06, 0.55, 5), -0.42, 0.5, 0.04, 0, 0, 0.15)];
      if (!arm) l.push(T(new THREE.CylinderGeometry(0.07, 0.06, 0.55, 5), 0.42, 0.5, 0.04, 0, 0, -0.15));
      if (arm) { l.push(T(new THREE.CylinderGeometry(0.06, 0.07, 0.62, 5), 0.42, 1.02, 0, 0, 0, -0.3)); l.push(T(new THREE.SphereGeometry(0.09, 6, 4), 0.52, 1.32, 0)); } return merge(l); };
    const cloth = [0x8a6a3a, 0x7a3e26, 0x5e2a2c, 0x3e5654, 0x76685a, 0x4e3a2a, 0x46464a, 0x6a5a3a, 0x5a4a3a];
    S.crowd = [0, 1].map((h) => { const n = 460, geo = crowdGeo(h), ph = new Float32Array(n); for (let i = 0; i < n; i++) ph[i] = vr(); geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
      const mt = inj(new THREE.MeshStandardMaterial({ roughness: 1 }), 'crowd', S.CU, { vh: 'uniform float uT, uAmp, uJump, uStand; attribute float aPh; varying float vFl;', v: `{ float ph = aPh * 6.2831; float bob = abs(sin(uT * (3.2 + aPh * 2.4) + ph)) * uAmp * 0.45; float jp = smoothstep(0.86, 1.0, sin(uT * (0.6 + aPh * 0.9) + ph * 3.0)) * uJump * 0.55;
          transformed.y += bob + jp + uStand * 0.22 * aPh; transformed.x += sin(uT * (1.1 + aPh) + ph) * 0.1 * transformed.y * (0.4 + uAmp); vFl = 0.6 + 0.4 * sin(uT * (5.0 + aPh * 4.0) + ph); }`,
        fh: 'uniform float uFire; varying float vFl;', e: 'totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.45, 0.16) * uFire * vFl;' });
      const im = new THREE.InstancedMesh(geo, mt, n); im.frustumCulled = false; g.add(im); return im; });
    const cn = [0, 0];
    for (let t = 0; t < 3; t++) { const rr0 = R + 1.75 + t * 2.6, n = Math.floor(rr0 * TAU / 0.6); for (let i = 0; i < n; i++) { const h = vr() < 0.3 ? 1 : 0; if (cn[h] >= 460 || vr() < 0.12) continue; const a = (i + (vr() - 0.5) * 0.8 + t * 0.5) / n * TAU, rr = rr0 + (vr() - 0.5) * 0.7; if (Math.abs(angDiff(a, PI)) < 0.2 && t === 0) continue; _m.position.set(Math.sin(a) * rr, 6.5 + t * 2.1 + vr() * 0.1, Math.cos(a) * rr); _m.rotation.set(0, a + PI + (vr() - 0.5) * 0.4, (vr() - 0.5) * 0.12); _m.rotation.x = (vr() - 0.3) * 0.25; _m.scale.set(0.8 + vr() * 0.45, 0.75 + vr() * 0.5, 0.95); _m.updateMatrix(); S.crowd[h].setMatrixAt(cn[h], _m.matrix); S.crowd[h].setColorAt(cn[h], _c.setHex(cloth[Math.floor(vr() * cloth.length)]).multiplyScalar([0.8, 0.6, 0.44][t] * (0.7 + vr() * 0.3))); cn[h]++; } }
    S.crowd.forEach((im, h) => { im.count = cn[h]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; });
    // velarium: canvas awnings on tall masts, ropes running out over the pit
    S.VU = { uThru: { value: 0.35 }, uT: { value: 0 } }; { const ropes = [], pen = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.13, a2 = a + TAU / 12, P = [], UV = [], I = [], NA = 18, NR = 5; for (let j = 0; j <= NA; j++) for (let k = 0; k <= NR; k++) { const u = j / NA, v = k / NR, aa = lerp(a, a2, u), rr = lerp(R + 11, R + 1, v), sg = Math.sin(u * PI) * (0.4 + v * 1.2) + Math.sin(v * PI) * 0.5; P.push(Math.sin(aa) * rr, lerp(28.6, 29.8, v) - sg, Math.cos(aa) * rr); UV.push(u, v); }
        for (let j = 0; j < NA; j++) for (let k = 0; k < NR; k++) { const q = j * (NR + 1) + k, q2 = q + NR + 1; I.push(q, q2, q + 1, q + 1, q2, q2 + 1); }
        const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); ag.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); ag.setIndex(I); ag.computeVertexNormals();
        const aw = new THREE.Mesh(ag, inj(W.mat({ color: i % 2 ? 0x8a3020 : 0xd0c0a0, roughness: 0.95, side: THREE.DoubleSide }), 'canvas', S.VU, { vh: 'varying vec2 vCv;', v: 'vCv = uv;', fh: 'uniform float uThru; varying vec2 vCv;',
          c: '{ if (vCv.y > 0.9 + 0.08 * abs(sin(vCv.x * 3.14159 * 5.0))) discard; float seam = 1.0 - smoothstep(0.0, 0.03, abs(fract(vCv.x * 3.0 + 0.5) - 0.5)); float fold = 0.85 + 0.15 * sin(vCv.x * 3.14159 * 18.0); diffuseColor.rgb *= fold * (1.0 - seam * 0.45); }',
          e: 'totalEmissiveRadiance += diffuseColor.rgb * uThru * (1.0 - smoothstep(0.0, 1.0, vCv.y) * 0.4);' })); aw.castShadow = true; g.add(aw);
        pen.push(T(new THREE.PlaneGeometry(2.2, 0.7), Math.sin(a) * (R + 11) + Math.cos(a) * 1.1, 28.4, Math.cos(a) * (R + 11) - Math.sin(a) * 1.1, 0, a + PI / 2));
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 16, 8), W.mat({ color: 0x4a3420, roughness: 0.9, map: wd.map })); pole.position.set(Math.sin(a) * (R + 11), 21, Math.cos(a) * (R + 11)); pole.castShadow = true; g.add(pole);
        ropes.push(Math.sin(a) * (R + 11), 29, Math.cos(a) * (R + 11), Math.sin(a) * 5, 31, Math.cos(a) * 5, Math.sin(a) * (R + 11), 29, Math.cos(a) * (R + 11), Math.sin(a + 0.26) * (R + 8), 20, Math.cos(a + 0.26) * (R + 8)); }
      const pg = merge(pen); g.add(new THREE.Mesh(pg, inj(W.mat({ color: 0x8a1c14, roughness: 0.9, side: THREE.DoubleSide }), 'pennant', S.VU, { vh: 'uniform float uT;', v: 'transformed.y += sin(uT * 4.0 + uv.x * 6.0 + position.x * 0.3) * uv.x * 0.35; transformed.x += cos(uT * 3.0 + uv.x * 5.0) * uv.x * 0.15;' })));
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(ropes, 3)); g.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x2a2018 })));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.18, 6, 40), ironM); ring.rotation.x = PI / 2; ring.position.y = 31; g.add(ring); }
    const box = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 3), W.mat({ color: 0x5a1e18, roughness: 0.8 })); box.position.set(0, 7.0, -(R + 1.8)); g.add(box);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, 4.5), W.mat({ color: 0x6a1614, roughness: 0.9 })); canopy.position.set(0, 11.2, -(R + 2)); canopy.rotation.x = -0.15; g.add(canopy);
    const hand = new THREE.Group(); hand.position.set(0, 7.6, -(R + 1.6)); g.add(hand); S.handler = hand;
    const hb = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.2, 4, 8), W.mat({ color: 0x5a1a1a, roughness: 0.8 })); hb.position.y = 1.0; hand.add(hb); const hh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), W.mat({ color: 0xc89a6a })); hh.position.y = 2.1; hand.add(hh);
    S.harm = new THREE.Group(); S.harm.position.set(0.5, 1.7, 0); hand.add(S.harm); const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), ironM); sp.position.y = 0.9; S.harm.add(sp);
    // braziers for the last act (built now: light counts must never change mid-fight)
    S.FU = { uT: { value: 0 }, uI: { value: 0 } };
    const flameM = new THREE.ShaderMaterial({ uniforms: S.FU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float uT, uI; varying vec2 vUv;\n' + NZ + 'void main(){ vec2 p=vUv; float n=vn3(vec3(p.x*5.0, p.y*3.0-uT*3.2, uT*0.6)), n2=vn3(vec3(p.x*9.0+3.0, p.y*6.0-uT*5.0, 1.0)); float w=(1.0-p.y)*0.46*(0.55+0.7*n)+0.04; float d=abs(p.x-0.5+(n2-0.5)*0.12*p.y); float sh=(1.0-smoothstep(w*0.3,w,d))*(1.0-smoothstep(0.15,1.0,p.y+n*0.35)); float core=(1.0-smoothstep(0.0,w*0.55,d))*(1.0-smoothstep(0.0,0.55,p.y)); vec3 c=vec3(1.0,0.3,0.05)*sh+vec3(1.0,0.75,0.3)*core; gl_FragColor=vec4(c*uI*1.6,1.0); }' });
    const haloM = new THREE.SpriteMaterial({ map: glowTex(), color: 0x000000, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), poolM = new THREE.MeshBasicMaterial({ map: haloM.map, color: 0x000000, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }); S.haloM = haloM; S.poolM = poolM;
    S.torches = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + PI / 12, x = Math.sin(a) * (R + 0.2), z = Math.cos(a) * (R + 0.2);
      const br = new THREE.Mesh(merge([T(new THREE.CylinderGeometry(0.55, 0.3, 0.6, 8), 0, 0, 0), T(new THREE.TorusGeometry(0.55, 0.06, 5, 12), 0, 0.3, 0, PI / 2), T(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 5), 0, -0.85, 0)]), ironM); br.position.set(x, 6.9, z); g.add(br);
      const fl = new THREE.Mesh(merge([T(new THREE.PlaneGeometry(1.7, 2.6), 0, 1.2, 0), T(new THREE.PlaneGeometry(1.7, 2.6), 0, 1.2, 0, 0, PI / 2), T(new THREE.PlaneGeometry(1.3, 2.0), 0, 0.95, 0, 0, PI / 4), T(new THREE.PlaneGeometry(1.3, 2.0), 0, 0.95, 0, 0, -PI / 4)]), flameM); fl.position.set(x, 7.1, z); fl.visible = false; g.add(fl);
      const ha = new THREE.Sprite(haloM); ha.position.set(x, 8.0, z); ha.scale.setScalar(5); ha.visible = false; g.add(ha);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), poolM); pl.position.set(Math.sin(a) * (R + 0.02), 4.6, Math.cos(a) * (R + 0.02)); pl.rotation.y = a + PI; pl.visible = false; g.add(pl);
      const L = i % 4 ? null : new THREE.PointLight(0xff7a30, 0, 22, 2); if (L) { L.position.set(Math.sin(a) * (R - 1.2), 8.2, Math.cos(a) * (R - 1.2)); g.add(L); } S.torches.push({ L, fl, ha, pl }); }
    S.pfill = new THREE.PointLight(0xb8c4d8, 0, 7, 2); g.add(S.pfill);
    S.dust = W.motes({ n: 320, box: [56, 14, 56], color: 0xf6e2b4, size: 0.2, vel: [0.35, 0.05, 0.15], sway: 0.5, center: [0, 7, 0], alpha: 0.4 }); g.add(S.dust);
    S.embers = W.motes({ n: 260, box: [50, 18, 50], color: 0xff7a30, size: 0.13, vel: [0.15, 1.4, 0.05], sway: 0.9, center: [0, 8, 0], alpha: 0, mult: 2 }); g.add(S.embers);
    // shafts of hot light falling into the pit (afternoon and dusk only)
    S.shaftU = { uA: { value: 0.07 }, uC: { value: new THREE.Color(0xffe0a8) } };
    { const sm = new THREE.ShaderMaterial({ uniforms: S.shaftU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; varying vec3 vN; varying float vZ; void main(){ vUv=uv; vN=normalMatrix*normal; vec4 mv=modelViewMatrix*vec4(position,1.0); vZ=-mv.z; gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform float uA; uniform vec3 uC; varying vec2 vUv; varying vec3 vN; varying float vZ; void main(){ vec3 n=vN/max(length(vN),1e-4); float f=abs(n.z); float a=f*f*smoothstep(0.0,0.4,vUv.y)*(1.0-smoothstep(0.8,1.0,vUv.y))*smoothstep(3.0,10.0,vZ)*uA; gl_FragColor=vec4(uC*a,1.0); }' });
      S.shafts = []; const sd2 = new V3(0.6, 0.62, -0.5).normalize();
      for (const [x, z, r] of [[-6, 7, 2.6], [5, -4, 2.0], [-11, -6, 1.7], [9, 10, 2.2]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, 44, 16, 1, true), sm); m.position.set(x + sd2.x * 22, sd2.y * 22, z + sd2.z * 22); m.quaternion.setFromUnitVectors(_a.set(0, 1, 0), sd2); m.renderOrder = 14; g.add(m); S.shafts.push(m); } }
    // stake: iron-banded anvil post, mooring ring, chain-worn drum
    S.stake = { x: 0, z: 0 };
    S.stakeG = new THREE.Group(); g.add(S.stakeG);
    const fo = (m) => { m.material = m.material.isMeshStandardMaterial && m.material.color.getHex() === 0x5e4c40 ? ironMat() : m.material.clone(); m.material.transparent = true; m.userData.fadeOcclude = true; m.userData.fadeMin = 0.2; return m; };
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, 1.7, 12), ironM); sk.position.y = 0.85; sk.castShadow = true; S.stakeG.add(sk);
    const skb = new THREE.Mesh(merge([T(new THREE.TorusGeometry(0.72, 0.07, 6, 18), 0, 0.3, 0, PI / 2), T(new THREE.TorusGeometry(0.62, 0.06, 6, 18), 0, 1.0, 0, PI / 2), T(new THREE.TorusGeometry(0.34, 0.07, 6, 14), 0.68, 0.55, 0, 0, PI / 2), T(new THREE.TorusGeometry(0.34, 0.07, 6, 14), -0.68, 0.55, 0, 0, PI / 2), T(new THREE.CylinderGeometry(1.0, 1.15, 0.12, 14), 0, 0.06, 0)]), W.mat({ color: 0x4a3c34, roughness: 0.55, metalness: 0.35 })); skb.castShadow = true; S.stakeG.add(skb);
    const dt = W.surface('wood', { seed: 17, dark: 0x4e3420, light: 0x9a7650, n: 10 });
    S.drum = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.7, 16), W.mat({ map: dt.map, roughness: 0.8 })); S.drum.position.y = 1.25; S.stakeG.add(S.drum); for (const m of [sk, skb, S.drum]) fo(m);
    const cap = new THREE.Mesh(merge([T(new THREE.TorusGeometry(0.62, 0.14, 6, 14), 0, 0, 0, PI / 2), T(new THREE.TorusGeometry(0.97, 0.05, 5, 18), 0, -0.2, 0, PI / 2), T(new THREE.TorusGeometry(0.97, 0.05, 5, 18), 0, -0.78, 0, PI / 2)]), ironM); cap.position.y = 1.72; S.stakeG.add(fo(cap));
    // the hole he tears the stake out of: a dark throat with a broken rim
    S.hole = new THREE.Group(); S.hole.visible = false; g.add(S.hole);
    { const hm = new THREE.Mesh(new THREE.CircleGeometry(1.9, 28), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec2 vP; void main(){ float r=length(vP)/1.9; float a=1.0-smoothstep(0.82,1.0,r); vec3 c=mix(vec3(0.0),vec3(0.16,0.11,0.07),smoothstep(0.25,0.85,r)); gl_FragColor=vec4(c,a); }' }));
      hm.rotation.x = -PI / 2; hm.position.y = 0.025; S.hole.add(hm);
      const ch = [], hr = mulberry(19); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + hr() * 0.3, d = 1.6 + hr() * 0.5; ch.push(T(new THREE.DodecahedronGeometry(0.22 + hr() * 0.25, 0), Math.sin(a) * d, 0.08, Math.cos(a) * d, hr() * 3, hr() * 3, 0, 1, 0.55, 1)); }
      const cm = new THREE.Mesh(merge(ch), W.mat({ color: 0x8a7458, roughness: 1, flatShading: true })); cm.castShadow = cm.receiveShadow = true; S.hole.add(cm); }
    S.block = new THREE.Group(); S.block.visible = false; g.add(S.block);
    const bk = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 1.7, 12), ironM); bk.rotation.x = PI / 2; bk.castShadow = true; S.block.add(bk); const bd = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.7, 16), rimS(W.mat({ map: dt.map, roughness: 0.8 }), 'woodS')); bd.rotation.x = PI / 2; S.block.add(bd);
    const bkr = new THREE.Mesh(merge([T(new THREE.TorusGeometry(1.0, 0.07, 5, 18), 0, 0, 0.36), T(new THREE.TorusGeometry(1.0, 0.07, 5, 18), 0, 0, -0.36), T(new THREE.DodecahedronGeometry(0.45, 0), 0.5, 0.75, 0.5), T(new THREE.DodecahedronGeometry(0.35, 0), -0.6, -0.4, 0.75)]), rimS(W.mat({ color: 0x6a5e54, roughness: 0.8, flatShading: true }), 'rockS')); S.block.add(bkr);
    // posts: cracked stone columns; each has its own (always transparent) materials so it can fade when it hides the player
    const pst = W.surface('stone', { seed: 12, dark: 0x8a7a60, light: 0xd4c6a4 });
    const postGeo = (() => { const a = merge([T(new THREE.CylinderGeometry(0.72, 0.85, 4.4, 12), 0, 2.2, 0), T(new THREE.CylinderGeometry(1.0, 0.75, 0.5, 12), 0, 4.6, 0), T(new THREE.CylinderGeometry(0.95, 1.0, 0.3, 12), 0, 0.15, 0)]), b2 = merge([T(new THREE.TorusGeometry(0.84, 0.1, 6, 16), 0, 1.3, 0, PI / 2), T(new THREE.TorusGeometry(0.76, 0.07, 6, 16), 0, 3.7, 0, PI / 2)]), g2 = merge([a, b2]);
      g2.addGroup(0, a.attributes.position.count, 0); g2.addGroup(a.attributes.position.count, b2.attributes.position.count, 1); return g2; })();
    const pdm = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true });
    S.posts = POSTS.map(([a, d], i) => {
      const x = Math.sin(a * PI / 180) * d, z = Math.cos(a * PI / 180) * d, m = new THREE.Group(); m.position.set(x, 0, z); g.add(m);
      const im2 = ironMat(); im2.transparent = true; const col = new THREE.Mesh(postGeo, [rimS(new THREE.MeshStandardMaterial({ map: pst.map, normalMap: pst.normalMap, roughness: 0.9, color: 0xe0d2b0, transparent: true }), 'postS'), im2]); col.rotation.y = i * 1.3; col.castShadow = col.receiveShadow = true; col.userData.fadeOcclude = true; col.userData.fadeMin = 0.16; m.add(col);
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 0.5, 7), col.material[0].clone()); stub.material.transparent = false; stub.position.set(x, 0.22, z); stub.rotation.y = i; stub.visible = false; g.add(stub);
      const pd = new THREE.Mesh(postGeo, pdm); pd.visible = false; pd.renderOrder = 10; col.add(pd); return { x, z, alive: true, mesh: m, stub, col, pd };
    });
    // reach line on the sand, chain links, shock rings, spike grates
    S.reachM = new THREE.MeshBasicMaterial({ color: 0x5a2a10, transparent: true, opacity: 0.4, depthWrite: false });
    S.reach = new THREE.Mesh(new THREE.RingGeometry(0.992, 1, 96), S.reachM); S.reach.rotation.x = -PI / 2; S.reach.position.y = 0.03; S.reach.renderOrder = 3; g.add(S.reach);
    S.links = new THREE.InstancedMesh(new THREE.TorusGeometry(0.2, 0.065, 5, 9), ironM, 170); S.links.frustumCulled = false; S.links.castShadow = true; S.links.count = 0; g.add(S.links);
    S.ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(DUST).multiplyScalar(1.5), transparent: true, opacity: 0.8, depthWrite: false });
    const skirtV = 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
    S.rings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 72), S.ringM); m.rotation.x = PI / 2; m.visible = false; g.add(m);
      const U = { uR: { value: 1 }, uA: { value: 0 } }, dm = new THREE.Mesh(new THREE.CircleGeometry(1, 72), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, vertexShader: skirtV,
        fragmentShader: 'uniform float uR, uA; varying vec2 vP;\n' + NZ + 'void main(){ float d=length(vP)*(uR+0.5); float stk=0.35+0.9*smoothstep(0.3,0.75,vn2(vP/max(length(vP),1e-3)*7.0+vec2(uR*0.15,0.0))); float a=smoothstep(uR-2.4,uR,d)*(1.0-smoothstep(uR,uR+0.45,d))*uA; gl_FragColor=vec4(vec3(0.72,0.6,0.44),a*0.55*stk); }' }));
      dm.rotation.x = -PI / 2; dm.visible = false; dm.renderOrder = 2; g.add(dm); return { m, dm, U, on: false, x: 0, z: 0, r: 0, v: 13, max: 30, dmg: 230, hit: false }; });
    S.drings = [0, 1, 2, 3, 4, 5].map(() => { const U = { uK: { value: 0 }, uF: { value: 1 }, uS: { value: 0 } }, m = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, vertexShader: skirtV,
        fragmentShader: 'uniform float uK, uF, uS; varying vec2 vP;\n' + NZ + 'void main(){ float rr=length(vP); vec2 dr=vP/max(rr,1e-3); float d=rr-uK; float band=smoothstep(-0.5,0.0,d)*(1.0-smoothstep(0.0,0.07,d)); float st=smoothstep(0.3,0.75,vn2(dr*7.0+vec2(uS,0.0)))*(0.6+0.4*vn2(vP*9.0+uS)); float a=band*st*(1.0-uF)*0.6; gl_FragColor=vec4(vec3(0.74,0.62,0.46),a); }' }));
      m.rotation.x = -PI / 2; m.visible = false; m.renderOrder = 2; g.add(m); return { m, U, t: 1, dur: 1 }; });
    S.dustRing = (x, z, rad, dur = 0.9) => { if (G.headless) return; const d = S.drings.find((q) => q.t >= 1) || S.drings[0]; d.t = 0; d.dur = dur; d.m.position.set(x, 0.05, z); d.m.scale.setScalar(rad); d.U.uS.value = vrand() * 50; d.m.visible = true; };
    const gritM = (U) => new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, vertexShader: 'varying vec2 vUv; varying vec2 vC; void main(){ vUv=uv; vC=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xz; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float uG; varying vec2 vUv; varying vec2 vC;\n' + NZ + 'void main(){ vec2 q=(vUv-0.5)*2.0; float rr=length(q); vec2 dr=q/max(rr,1e-3); float fr=0.25+uG*0.7; float band=smoothstep(fr-0.35,fr,rr)*(1.0-smoothstep(fr,fr+0.06,rr)); float st=smoothstep(0.35,0.7,vn2(dr*6.0+vC*1.7)); float a=band*st*(1.0-uG)*0.75; gl_FragColor=vec4(vec3(0.6,0.5,0.36),a); }' }), gritG = new THREE.PlaneGeometry(2.4, 2.4); gritG.rotateX(-PI / 2);
    const spikeM = inj(W.mat({ color: 0x2a2624, roughness: 0.22, metalness: 0.85, flatShading: true, envMapIntensity: 1.2 }), 'spike', WU, { vh: 'varying float vY;', v: 'vY = position.y;', fh: 'varying float vY;', e: 'totalEmissiveRadiance += vec3(1.0, 0.3, 0.05) * (1.0 - smoothstep(0.05, 0.5, vY)) * 0.55;' }), spikeG = merge([T(new THREE.CylinderGeometry(0, 0.24, 1.45, 4), 0, 0.98, 0), T(new THREE.CylinderGeometry(0.26, 0.3, 0.26, 4), 0, 0.13, 0), T(new THREE.BoxGeometry(0.56, 0.07, 0.1), 0, 0.3, 0)]);
    const grT = canvas(64, 64, (x) => { x.fillStyle = '#8a7a62'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#3a3026'; for (let i = 0; i < 4; i++) x.fillRect(10 + i * 12, 10, 7, 44); x.fillStyle = '#a89878'; x.fillRect(0, 0, 64, 4); x.fillRect(0, 60, 64, 4); x.fillRect(0, 0, 4, 64); x.fillRect(60, 0, 4, 64); });
    const grE = canvas(64, 64, (x) => { x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; for (let i = 0; i < 4; i++) x.fillRect(11 + i * 12, 12, 5, 40); });
    S.grateM = new THREE.MeshStandardMaterial({ map: grT, emissiveMap: grE, emissive: 0x000000, roughness: 0.9, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    const grateG = new THREE.PlaneGeometry(0.42, 0.42); grateG.rotateX(-PI / 2);
    const glowV = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }', glowG = new THREE.PlaneGeometry(1.5, 1.5); glowG.rotateX(-PI / 2);
    let gi = 0; const grates = new THREE.InstancedMesh(grateG, S.grateM, 34 + 64 + 94); grates.receiveShadow = true; grates.frustumCulled = false; g.add(grates);
    const frG = merge([T(new THREE.BoxGeometry(0.54, 0.05, 0.07), 0, 0.025, 0.235), T(new THREE.BoxGeometry(0.54, 0.05, 0.07), 0, 0.025, -0.235), T(new THREE.BoxGeometry(0.07, 0.05, 0.4), 0.235, 0.025, 0), T(new THREE.BoxGeometry(0.07, 0.05, 0.4), -0.235, 0.025, 0), T(new THREE.BoxGeometry(0.52, 0.02, 0.52), 0, 0.0, 0)]);
    const frames = new THREE.InstancedMesh(frG, W.mat({ color: 0x8a7c66, roughness: 0.9, metalness: 0.1 }), 34 + 64 + 94); frames.castShadow = frames.receiveShadow = true; frames.frustumCulled = false; g.add(frames);
    S.spikes = BANDS.map(([r0, r1], k) => { const n = 34 + k * 30, im = new THREE.InstancedMesh(spikeG, spikeM, n), sr = mulberry(5 + k), U = { uA: { value: 0 } }, pos = [];
      const gl = new THREE.InstancedMesh(glowG, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: glowV, fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float d=length(vUv-0.5)*2.0; float a=pow(clamp(1.0-d,0.0,1.0),2.0)*uA; gl_FragColor=vec4(vec3(1.0,0.35,0.08)*a,1.0); }' }), n);
      for (let i = 0; i < n; i++) { const a = sr() * TAU, d = r0 + 0.5 + sr() * (r1 - r0 - 1), ry = sr() * PI; _m.position.set(Math.sin(a) * d, 0, Math.cos(a) * d); _m.rotation.set((sr() - 0.5) * 0.14, ry, (sr() - 0.5) * 0.14); _m.scale.setScalar(0.9 + sr() * 0.3); _m.updateMatrix(); im.setMatrixAt(i, _m.matrix); pos.push(_m.position.x, _m.position.z);
        _m.position.y = 0.035; _m.rotation.set(0, ry, 0); _m.scale.setScalar(1); _m.updateMatrix(); grates.setMatrixAt(gi, _m.matrix); _m.position.y = -0.005; _m.updateMatrix(); frames.setMatrixAt(gi++, _m.matrix); _m.position.y = 0.05; _m.updateMatrix(); gl.setMatrixAt(i, _m.matrix); }
      im.frustumCulled = false; im.castShadow = true; im.position.y = -1.8; g.add(im); gl.frustumCulled = false; gl.visible = false; gl.renderOrder = 4; g.add(gl);
      const GU = { uG: { value: 1 } }, gr = new THREE.InstancedMesh(gritG, gritM(GU), n); gr.instanceMatrix = gl.instanceMatrix; gr.frustumCulled = false; gr.visible = false; gr.renderOrder = 3; g.add(gr);
      return { im, up: 0, gl, U, pos, was: 0, gr, GU, gt: 1 }; });
    grates.instanceMatrix.needsUpdate = frames.instanceMatrix.needsUpdate = true;
    // flail motion arc (a fan trailing the swing)
    { const N = 20, P = [], K = [], I = []; for (let i = 0; i <= N; i++) { const an = -i / N * 0.75; for (const [r, w] of [[FL - 0.35, 0], [FL + 0.35, 1]]) { P.push(Math.sin(an) * r, 0, Math.cos(an) * r); K.push(1 - i / N, w); } } for (let i = 0; i < N; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); fg.setAttribute('aK', new THREE.Float32BufferAttribute(K, 2)); fg.setIndex(I);
      S.arcU = { uA: { value: 0 } }; S.arc = new THREE.Mesh(fg, new THREE.ShaderMaterial({ uniforms: S.arcU, transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexShader: 'attribute vec2 aK; varying vec2 vK; void main(){ vK=aK; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform float uA; varying vec2 vK; void main(){ float a=vK.x*vK.x*(1.0-abs(vK.y*2.0-1.0))*uA; gl_FragColor=vec4(vec3(1.0,0.93,0.8),a*0.6); }' }));
      S.arc.visible = false; S.arc.position.y = 0.6; S.arc.renderOrder = 5; S.arc.frustumCulled = false; g.add(S.arc); }
    // ---- Atrox ----
    S.BU = { uRim: { value: new THREE.Color(0x40507a) }, uCrackC: { value: new THREE.Color(0xff5a14) }, uCrack: { value: 0 }, uHeat: { value: 0 }, uDmg: { value: 0 } };
    S.B = buildBeast(S.BU); b.group.add(S.B.g);
    { const dm = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true }), cp = []; S.B.depth = []; S.B.fadeMeshes = [];
      S.B.g.traverse((o) => { if (!o.isMesh || o.userData.depthCopy) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; if (ms[0].userData.solid) return; S.B.fadeMeshes.push(o); cp.push(o); });
      for (const o of cp) { const d = o.isInstancedMesh ? new THREE.InstancedMesh(o.geometry, dm, o.count) : new THREE.Mesh(o.geometry, dm); if (o.isInstancedMesh) d.instanceMatrix = o.instanceMatrix; d.userData.depthCopy = true; d.visible = false; d.renderOrder = 10; d.frustumCulled = false; o.add(d); S.B.depth.push(d); } }
    S.eyeL = new THREE.PointLight(BLOOD, 0, 12, 2); S.eyeL.position.set(0, 2.4, 5.2); b.group.add(S.eyeL);
    Object.assign(S, { wraps: [], L: 24, Lgoal: 24, loose: false, px: 0, pz: -7, taut: 0, chase: false, speed: 6.2, down: 0, downK: 0, frenzy: 0, strain: 0, chant: 0, chantB: 0, out: 0, jav: 0, cheer: 0, cheerK: 0, crouch: 0, rear: 0, lunge: 0, hop: 0, runT: 0, moving: 0, lvl: 0, look: 0, lookT: 0, tip: { x: 0, z: 0 }, fl: { on: false, wind: 0, a: 0, dir: 1, t: 0, hitT: 0, jam: null }, fadeA: 1, puff: 1, hoofT: 0 });
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 17 }, bossStart: { x: 0, z: -7, face: 0 }, camDist: 16,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
      solid(p) {
        for (const q of S.posts) { if (!q.alive) continue; const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz); if (d < PR + 0.45 && d > 1e-3) { p.x = q.x + dx / d * (PR + 0.45); p.z = q.z + dz / d * (PR + 0.45); } }
        if (!S.loose) { const d = Math.hypot(p.x, p.z); if (d < 1.5 && d > 1e-3) { p.x *= 1.5 / d; p.z *= 1.5 / d; } }
      },
      camLimit(x, y, z) { const d = Math.hypot(x, z); if (d > R - 0.2) { x *= (R - 0.2) / d; z *= (R - 0.2) / d; } return { x, y: Math.max(y, 0.5), z }; },
    };
  }

  // ---- what he does ----
  function ring(b, v = 11.5, dmg = 230) { const S = b.state, g = S.rings.find((q) => !q.on) || S.rings[0]; Object.assign(g, { on: true, x: b.pos.x, z: b.pos.z, r: 0.2, v, max: 2 * R, dmg, hit: false }); }
  function* down(b, dur, mul) {
    const S = b.state; S.chase = false; b.autoFace = false; S.down = dur; b.exposed = dur; b.dmgTaken = mul; S.cheer = 1; S.crouch = S.rear = 0;
    Sound.sfx('interrupt', 0.8, 0.6); FX.burst(b.pos.x, 0.4, b.pos.z, { n: 40, smoke: true, color: DUST, color2: 0xa89068, speed: [1, 6], life: [0.6, 1.4], size: [0.8, 2.2], alpha: 0.5, radius: 2 }); FX.shake(0.6);
    yield () => S.down <= 0; b.dmgTaken = 1; yield 0.5;
  }
  function* melee(b) {
    const S = b.state; let t = 0; S.chase = true; b.autoFace = true;
    while (b.distToPlayer() > 6 && t < 2.4) { t += G.dt; yield; }
    if (b.distToPlayer() > 8) return false;
    S.chase = false; b.autoFace = false; const dir = b.angToPlayer(); yield* b.turnTo(dir, 0.14);
    if (rnd() < 0.55) { Hz.cone(b.pos.x, b.pos.z, dir, 1.25, 7, 0.62, 260, { name: 'Bite', quiet: true }); yield* b.cast({ name: 'Bite', time: 0.62 }); Sound.sfx('slash', 0.9, 0.5); }
    else { Hz.cone(b.pos.x, b.pos.z, dir, 2.7, 7.6, 0.85, 240, { name: 'Rake', quiet: true }); yield* b.cast({ name: 'Rake', time: 0.85 }); Sound.sfx('slash', 1, 0.7); FX.slash(b.pos.x + Math.sin(dir) * 2, 1.6, b.pos.z + Math.cos(dir) * 2, dir, { r: 6, color: 0xffe0b0, dur: 0.25 }); }
    S.lunge = 1; yield 0.5; b.autoFace = true; S.chase = true; return true;
  }
  function* pounce(b) {
    const S = b.state, p = G.player; S.chase = false; b.autoFace = true; S.crouch = 1;
    const h = Hz.circle(p.pos.x, p.pos.z, 3.7, 1.05, 320, { name: 'Pounce', lock: 0.72, track(s) { s.x = p.pos.x; s.z = p.pos.z; }, onFire() { FX.shake(0.7); Sound.sfx('boom', 0.9, 0.8); S.dustRing(h.shape.x, h.shape.z, 6, 0.9); FX.burst(h.shape.x, 0.15, h.shape.z, { n: 24, smoke: true, flat: true, color: DUST, color2: 0x8a7050, speed: [3, 8], life: [0.5, 1.0], size: [0.5, 1.0], alpha: 0.3, radius: 1.5 }); FX.burst(h.shape.x, 0.3, h.shape.z, { n: 40, smoke: true, color: DUST, color2: 0xa89068, speed: [2, 9], life: [0.5, 1.2], size: [0.8, 2], alpha: 0.5, radius: 2.5 }); } });
    yield* b.cast({ name: 'Pounce', time: 0.7 }); S.crouch = 0; b.autoFace = false;
    const sx = b.pos.x, sz = b.pos.z, ang = angTo(sx, sz, h.shape.x, h.shape.z), d = Math.max(0, Math.hypot(h.shape.x - sx, h.shape.z - sz) - 1.2), tx = sx + Math.sin(ang) * d, tz = sz + Math.cos(ang) * d;
    b.facing = ang; Sound.sfx('dash', 1, 0.45); let t = 0, choke = false;
    while (t < 0.33) { t += G.dt; const k = Math.min(1, t / 0.33); b.pos.x = lerp(sx, tx, k); b.pos.z = lerp(sz, tz, k); S.hop = Math.sin(k * PI) * 2.4; yield; if (S.taut > 0.35) { choke = true; break; } }
    S.hop = 0;
    if (choke) { Hz.cancel(h); Sound.sfx('parry', 0.8, 0.3); yield* down(b, 3, 1.15); } else yield 0.65;
    b.autoFace = true; S.chase = true;
  }
  function* roar(b, n = 1) {
    const S = b.state; S.chase = false; S.rear = 1; yield* b.cast({ name: 'Roar', time: 1.0 });
    for (let i = 0; i < n; i++) { ring(b); Sound.sfx('roar', 0.9, 0.8); FX.shake(0.5); FX.ring(b.pos.x, b.pos.z, { r0: 2, r1: 9, color: DUST, dur: 0.4 }); yield 0.75; }
    S.rear = 0; yield 0.4; S.chase = true;
  }
  function* hurl(b, n = 3) {
    const S = b.state, p = G.player; S.chase = false;
    for (let i = 0; i < n; i++) {
      S.crouch = 0.6; yield* b.cast({ name: 'Hurl', time: 0.5 }); S.crouch = 0; S.lunge = 0.6;
      const x = p.pos.x, z = p.pos.z; if (!G.headless) FX.missile(new V3(b.pos.x, 3.5, b.pos.z), new V3(x, 0.2, z), { speed: 26, arc: 7, color: 0xc8a878, size: 0.55 }); Sound.sfx('dash', 0.7, 0.5);
      Hz.circle(x, z, 3.1, 1.1, 260, { name: 'Rubble', onFire() { FX.explode(x, 0.4, z, DUST, 3, 0x8a7a60); Sound.sfx('boom', 0.6, 1.2); S.dustRing(x, z, 4.2, 0.8); } });
      yield 0.3;
    }
    yield 0.7; S.chase = true;
  }
  function* frenzy(b) {
    const S = b.state; yield () => S.chant <= 0; S.chase = false; S.rear = 1; b.autoFace = true;
    yield* b.cast({ name: 'Bloodlust', time: 2.5 }); S.rear = 0; S.frenzy = 7; S.strain = 0; Sound.sfx('roar', 1, 0.6); FX.flash(BLOOD, 0.3, 1.2); FX.shake(0.6);
    S.chase = true; let bt = 0.3;
    while (S.frenzy > 0) {
      bt -= G.dt;
      if (bt <= 0 && b.distToPlayer() < 7.2) { const dir = b.angToPlayer(); b.facing = dir; Hz.cone(b.pos.x, b.pos.z, dir, 1.8, 7.4, 0.35, 280, { name: 'Frenzied Bite', quiet: true, silent: true }); S.lunge = 1; bt = 0.72; Sound.sfx('slash', 0.8, 0.55); }
      yield;
    }
    if (S.strain >= 3.2) { yield* down(b, 6, 1.5); const w = S.wraps[S.wraps.length - 1]; if (w) { S.rear = 1; yield* b.cast({ name: 'Tear Free', time: 1.1 }); S.rear = 0; const q = w.q; Hz.circle(q.x, q.z, 4.5, 0.01, 0, { quiet: true, silent: true }); dropPost(b, q); yield 0.5; } }
    else yield 0.8;
    b.autoFace = true; S.chase = true;
  }
  function* grates(b) {
    const S = b.state; S.chase = false; S.rear = 0.6; const first = rnd() < 0.5 ? [0, 2] : [1];
    const pop = (k, delay) => Hz.donut(0, 0, BANDS[k][0], BANDS[k][1], delay, 240, { name: 'Spike Grate', color: 0xc8ccd8, quiet: true, onFire() { S.spikes[k].up = 1; Sound.sfx('shatter', 0.5, 0.6); Sound.sfx('hit', 0.9, 0.5); } });
    for (const k of first) pop(k, 1.6); for (const k of [0, 1, 2]) if (!first.includes(k)) pop(k, 3.0);
    yield* b.cast({ name: 'Open the Grates', time: 1.6 }); S.rear = 0; S.chase = true; yield 1.5;
  }
  function* whip(b) {
    const S = b.state, A = lastA(S); S.chase = false; b.autoFace = false; S.rear = 0.8;
    const dir = angTo(A.x, A.z, b.pos.x, b.pos.z), len = Math.hypot(b.pos.x - A.x, b.pos.z - A.z) + 9;
    Hz.rect(A.x, A.z, dir, len, 3.4, 1.05, 300, { name: 'Whip-crack', onFire() { Sound.sfx('zap', 0.7, 0.5); FX.shake(0.5); if (!G.headless) FX.beam(new V3(A.x, 1.2, A.z), new V3(A.x + Math.sin(dir) * len, 1.2, A.z + Math.cos(dir) * len), { color: 0xfff0d0, width: 0.5, dur: 0.25 }); } });
    yield* b.cast({ name: 'Whip-crack', time: 1.05 }); S.rear = 0; S.whipK = 1; yield 0.6; b.autoFace = true; S.chase = true;
  }
  function* flail(b) {
    const S = b.state, F = S.fl; S.chase = false; b.autoFace = false; F.wind = 1; F.jam = null;
    Hz.circle(b.pos.x, b.pos.z, FL + 0.9, 1.9, 0, { name: 'Flail', quiet: true });
    yield* b.cast({ name: 'Flail', time: 1.9 });
    Object.assign(F, { on: true, wind: 0, a: angTo(b.pos.x, b.pos.z, S.tip.x, S.tip.z), dir: rnd() < 0.5 ? 1 : -1, t: 0, hitT: 0 }); Sound.sfx('roar', 0.7, 1.1);
    yield () => !F.on || F.t > 5.2; F.on = false;
    if (F.jam) { const q = F.jam; Sound.sfx('parry', 1, 0.3); yield* down(b, 5, 1.5); F.jam = null; dropPost(b, q); yield 0.4; } else yield 0.8;
    b.autoFace = true; S.chase = true;
  }
  function* slam(b) {
    const S = b.state; S.chase = false; b.autoFace = false; const dir = b.angToPlayer(); yield* b.turnTo(dir, 0.2); S.rear = 1;
    Hz.rect(b.pos.x, b.pos.z, dir, 19, 4.6, 1.05, 320, { name: 'Slam', onFire() { FX.shake(0.8); Sound.sfx('bigboom', 0.6); } });
    yield* b.cast({ name: 'Slam', time: 1.05 }); S.rear = 0; S.lunge = 1; ring(b, 11.5, 220); yield 0.8; b.autoFace = true; S.chase = true;
  }
  function setLvl(b, n) {
    const S = b.state; S.lvl = n; S.lookT = n; S.Lgoal = n >= 1 ? 30 : 24; S.speed = n >= 2 ? 7.0 : n ? 6.5 : 6.2;
    Object.assign(S, { crouch: 0, rear: 0, hop: 0, frenzy: 0, chant: 0, down: 0, chase: true }); S.fl.on = false; S.fl.wind = 0; b.autoFace = true; b.dmgTaken = 1;
    if (n >= 2 && !S.loose) { S.loose = true; S.wraps.length = 0; S.stakeG.visible = false; S.hole.visible = true; S.block.visible = true; S.reach.visible = false; S.tip.x = 0; S.tip.z = 0; }
  }
  const chantFor = (b, t) => { b.state.chant = t; };

  G.bosses.push({
    id: 'pit', name: 'ATROX', title: 'The Pit', hint: 'Short leash', color: '#f0c070', telegraph: TEL,
    hp: 27000, radius: 2.0, aimY: 2.6, enrage: 450,
    post: PG[0],
    music: { bpm: 108, root: 38, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 0, 1, 0, 0, 0, 4, 1],
      layers: [
        { v: 'taiko', pat: 'x...x...x...x.x.', vol: 0.26 }, { v: 'tom', pat: '..x...x...x...xx', vol: 0.14 }, { v: 'bass', pat: '0.......0.....1.', oct: -1, len: 2, vol: 0.12 },
        { v: 'brass', from: 1, pat: ['0.......4.......', '1.......0...4...'], oct: 0, len: 6, vol: 0.11 }, { v: 'clap', from: 1, pat: '....x.......x...', vol: 0.12 }, { v: 'hat', from: 1, pat: 'x.x.x.x.x.x.x.x.', vol: 0.05 },
        { v: 'choir', from: 2, pat: '0.......1.......', oct: 1, len: 8, vol: 0.08 }, { v: 'taiko', from: 2, pat: 'x.xx.xx.x.xx.xxx', vol: 0.22 }, { v: 'lead', from: 2, pat: ['0..1..4.5..4..1.', '7..5..4.1..0....'], oct: 1, len: 2, vol: 0.06 },
      ] },
    build,
    *intro(b) { const S = b.state; S.cheer = 1; Sound.sfx('roar', 0.7, 0.6); yield* Cam.shot([10, 2.0, 4], [0, 2.8, -7], [4.5, 3.4, 0.5], [0, 2.9, -7], 5.0, 44); },
    phases: [
      { at: 1, *run(b) {
        setLvl(b, 0); yield 1.0;
        while (true) {
          yield* melee(b); yield* melee(b); yield* pounce(b); yield* roar(b); yield* melee(b); yield* hurl(b);
          chantFor(b, 9); yield* melee(b); yield* pounce(b); yield* melee(b); yield* melee(b); yield* frenzy(b);
          yield* pounce(b); yield* melee(b); yield* roar(b, 2); yield* hurl(b);
        }
      } },
      { at: 0.66, skipTo(b) { b.state.look = b.state.lookT = 1; Post.set(PG[1]); }, *enter(b) {
        const S = b.state; S.chase = false; S.rear = 1; S.frenzy = 0; S.chant = 0; S.fl.on = false; S.Lgoal = 30; S.cheer = 1; S.winch = 3;
        yield* b.cast({ name: 'More Chain', time: 3.0, onTick: (k) => { if (!G.headless && Math.floor(k * 14) !== S.wk) { S.wk = Math.floor(k * 14); Sound.sfx('tick', 1, 0.5); } } });
        S.rear = 0; Sound.sfx('roar', 0.9, 0.7); S.lookT = 1; Co.start(Post.lerpTo(PG[1], 3), 'fight'); yield 0.8;
      }, *run(b) {
        setLvl(b, 1);
        while (true) {
          yield* melee(b); yield* grates(b); yield* pounce(b); yield* melee(b); yield* whip(b); yield* hurl(b);
          chantFor(b, 9); yield* melee(b); yield* roar(b, 2); yield* melee(b); yield* pounce(b); yield* frenzy(b);
          yield* whip(b); yield* grates(b); yield* melee(b); yield* pounce(b);
        }
      } },
      { at: 0.33, skipTo(b) { b.state.look = b.state.lookT = 2; Post.set(PG[2]); }, *enter(b) {
        const S = b.state; S.chase = false; S.frenzy = 0; S.chant = 0; S.cheer = 0; S.hush = 3.4; b.autoFace = false;
        yield* b.moveTo(0, -3.2, 14); yield* b.turnTo(0, 0.2); S.rear = 1;
        yield* b.cast({ name: 'Unchained', time: 2.6, onTick: (k) => { FX.shake(k * 0.5); } });
        S.rear = 0; setLvl(b, 2); S.chase = false; FX.explode(0, 0.5, 0, DUST, 6, 0x6a5a40); Sound.sfx('bigboom', 0.9); Sound.sfx('roar', 1, 0.5); FX.flash(0xfff0d0, 0.4, 1.4); S.cheer = 1;
        Co.start(Post.lerpTo(PG[2], 3), 'fight'); yield 1.4;
      }, *run(b) {
        setLvl(b, 2);
        while (true) {
          yield* melee(b); yield* flail(b); yield* slam(b); yield* melee(b); yield* pounce(b); yield* roar(b, 2);
          yield* melee(b); yield* hurl(b, 4); yield* flail(b); yield* pounce(b); yield* slam(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, F = S.fl, fight = G.state === 'fight' && p && p.alive, B = S.B;
      S.L = damp(S.L, S.Lgoal, 1.2, dt); if (S.down > 0) S.down -= dt; if (S.frenzy > 0) S.frenzy -= dt;
      const moved0x = b.pos.x, moved0z = b.pos.z;
      if (fight && S.chase && !b.castState && !b.transitioning && S.down <= 0) {
        const d = b.distToPlayer(), stop = 3.4;
        if (d > stop) { const a = b.angToPlayer(), s = Math.min(d - stop, (S.frenzy > 0 ? 11 : S.speed) * dt); b.pos.x += Math.sin(a) * s; b.pos.z += Math.cos(a) * s; }
      }
      // he cannot walk through stone either
      for (const q of S.posts) { if (!q.alive) continue; const dx = b.pos.x - q.x, dz = b.pos.z - q.z, d = Math.hypot(dx, dz), m = PR + 1.5; if (d < m && d > 1e-3) { b.pos.x = q.x + dx / d * m; b.pos.z = q.z + dz / d * m; } }
      if (!S.loose) { const d = Math.hypot(b.pos.x, b.pos.z); if (d < 2.4 && d > 1e-3) { b.pos.x *= 2.4 / d; b.pos.z *= 2.4 / d; } }
      { const d = Math.hypot(b.pos.x, b.pos.z); if (d > R - 2.4) { b.pos.x *= (R - 2.4) / d; b.pos.z *= (R - 2.4) / d; } }
      chainStep(S, b);
      if (S.frenzy > 0 && fight && S.taut > 0.002) S.strain += dt;
      S.moving = damp(S.moving, Math.hypot(b.pos.x - moved0x, b.pos.z - moved0z) > 0.4 * dt || S.taut > 0.002 ? 1 : 0, 10, dt);
      // the crowd's count before the blood
      if (S.chant > 0 && fight) { S.chant -= dt; S.chantB -= dt; if (S.chantB <= 0) { S.chantB = lerp(0.32, 0.62, sat(S.chant / 9)); Sound.sfx('boom', 0.3 + (1 - sat(S.chant / 9)) * 0.4, 0.55); S.stomp = 1; } }
      // cowards get javelins
      if (fight && !S.loose && S.frenzy <= 0 && S.down <= 0 && !b.transitioning && !(b.castState && b.castState.name === 'Bloodlust')) {
        const A = lastA(S), far = Math.hypot(p.pos.x - A.x, p.pos.z - A.z) > reach(S) + 3.2;
        S.out = far ? S.out + dt : Math.max(0, S.out - dt * 2);
        if (S.out > 6) { S.jav -= dt; if (S.jav <= 0) { S.jav = 1.25; const a = rnd(0, TAU), x0 = p.pos.x - Math.sin(a) * 30, z0 = p.pos.z - Math.cos(a) * 30; Hz.rect(x0, z0, a, 60, 2.4, 1.0, 230, { name: 'Javelin', color: 0xffe9b0, tag: 'fight', quiet: true, onFire() { Sound.sfx('slash', 0.7, 1.4); } }); S.harmK = 1; Sound.sfx('wave', 0.25, 0.5); } }
      } else S.out = 0;
      // shock rings
      for (const g of S.rings) {
        if (!g.on) continue; g.r += g.v * dt; if (g.r > g.max) { g.on = false; g.m.visible = false; continue; }
        if (fight && !g.hit) { const d = Math.hypot(p.pos.x - g.x, p.pos.z - g.z); if (Math.abs(d - g.r) < 0.6) { if (p.pos.y < 0.45) { g.hit = true; p.hurt(g.dmg, { blockable: true, src: { name: 'Shockwave' } }); } } }
      }
      // the flail
      if (S.loose) {
        const cx = b.pos.x + Math.sin(b.facing) * 1.7, cz = b.pos.z + Math.cos(b.facing) * 1.7;
        if (F.on) {
          F.t += dt; const a0 = F.a; F.a += FLV / FL * F.dir * dt; S.tip.x = b.pos.x + Math.sin(F.a) * FL; S.tip.z = b.pos.z + Math.cos(F.a) * FL;
          for (const q of S.posts) { if (!q.alive) continue; const d = Math.hypot(q.x - b.pos.x, q.z - b.pos.z); if (d < 2.5 || d > FL - 0.4) continue; const aq = angTo(b.pos.x, b.pos.z, q.x, q.z), d0 = angDiff(a0, aq) * F.dir, d1 = angDiff(F.a, aq) * F.dir; if (d0 >= 0 && d1 < 0 && d0 < 1) { F.on = false; F.jam = q; S.tip.x = q.x + Math.sin(F.a + F.dir * 1.2) * 1.6; S.tip.z = q.z + Math.cos(F.a + F.dir * 1.2) * 1.6; break; } }
          F.hitT -= dt;
          if (F.on && fight && F.hitT <= 0 && p.pos.y < 1.7 && segDist(p.pos.x, p.pos.z, b.pos.x, b.pos.z, S.tip.x, S.tip.z) < 1.05) { F.hitT = 0.9; p.hurt(300, { blockable: true, kb: { dir: angTo(b.pos.x, b.pos.z, p.pos.x, p.pos.z), dist: 4 }, src: { name: 'Flail' } }); }
          if (!G.headless && vrand() < dt * 60) FX.burst(S.tip.x + (vrand() - 0.5), 0.2, S.tip.z + (vrand() - 0.5), { n: 1, smoke: true, flat: true, color: DUST, color2: 0xa89068, speed: [0.3, 1.5], life: [0.5, 1.0], size: [0.4, 0.9], alpha: 0.2 });
        } else { const dx = S.tip.x - cx, dz = S.tip.z - cz, d = Math.hypot(dx, dz), m = F.wind ? 3 : FL - 1; if (d > m) { const k = F.wind ? damp(d, m, 3, dt) / d : m / d; S.tip.x = cx + dx * k; S.tip.z = cz + dz * k; } }
      }
      // ---- cosmetics ----
      if (G.headless) return;
      S.look = damp(S.look, S.lookT, 0.5, dt); const k1 = sat(S.look), k2 = sat(S.look - 1), U = S.sky.material.uniforms, fk = Math.sin(t * 13) * 0.1 + Math.sin(t * 7.3) * 0.08;
      // hazy afternoon -> bruised dusk -> night under a cold moon, torches holding the warm half
      U.uTop.value.setHex(0x4a78b0).lerp(_c.setHex(0x3a3a6a), k1).lerp(_c.setHex(0x060818), k2); U.uHor.value.setHex(0xd8b880).lerp(_c.setHex(0xe07a48), k1).lerp(_c.setHex(0x3a1a2c), k2); U.uBot.value.setHex(0xc8b090).lerp(_c.setHex(0x5a3040), k1).lerp(_c.setHex(0x140a10), k2);
      U.uSunCol.value.setHex(0x9a8058).lerp(_c.setHex(0x8a4020), k1).lerp(_c.setHex(0x3a4660), k2); U.uSunDir.value.set(0.6 + k1 * 0.15 - k2 * 1.15, 0.62 - k1 * 0.3 + k2 * 0.28, -0.5 + k2 * 1.0).normalize();
      U.uStars.value = k2 * 1.2; U.uCloud.value = 0.32 + k1 * 0.06 - k2 * 0.1; U.uCloudCol.value.setHex(0xfff0dc).lerp(_c.setHex(0xe09070), k1).lerp(_c.setHex(0x2a2030), k2); U.uCloudDark.value.setHex(0x9a8a80).lerp(_c.setHex(0x5a3040), k1).lerp(_c.setHex(0x0a0810), k2);
      S.sun.color.setHex(0xffd8a0).lerp(_c.setHex(0xffa060), k1).lerp(_c.setHex(0x8aa8e8), k2); S.sun.intensity = 3.6 - k1 * 0.5 - k2 * 1.1; S.sun.position.set(0.6 + k1 * 0.15 - k2 * 1.15, 0.62 - k1 * 0.2 + k2 * 0.33, -0.5 + k2 * 1.0).normalize().multiplyScalar(80);
      S.hemi.intensity = 0.95 + k1 * 0.2 + k2 * 0.15; S.hemi.color.setHex(0x8088c8).lerp(_c.setHex(0x7a6aa8), k1).lerp(_c.setHex(0x4a6aa0), k2); S.hemi.groundColor.setHex(0x8a6a48).lerp(_c.setHex(0x7a5038), k1).lerp(_c.setHex(0x3a3040), k2);
      S.fog.color.setHex(0xd8c0a0).lerp(_c.setHex(0x9a6a60), k1).lerp(_c.setHex(0x101828), k2); S.fog.density = 0.005 + k2 * 0.004; scene.environmentIntensity = 0.6 - k2 * 0.2;
      S.WU.uScorch.value = k2; S.WU.uDesat.value = k1 * 0.08 + k2 * 0.25; S.WU.uFlat.value = 0.35 + k2 * 0.6; S.sandM.normalScale.setScalar(0.5 - k2 * 0.38); S.WU.uSR.value.setRGB(0.22, 0.32, 0.52).multiplyScalar(k2); S.gateU.uI.value = (0.6 + k1 * 0.4 + k2 * 0.2) * (1 + fk);
      S.shaftU.uA.value = 0.045 * (1 - k1 * 0.3) * (1 - k2); S.shaftU.uC.value.setHex(0xffe0a8).lerp(_c.setHex(0xff9a60), k1); for (const m of S.shafts) m.visible = k2 < 0.98;
      S.dust.material.uniforms.uAlpha.value = 0.4 * (1 - k2 * 0.7); S.embers.material.uniforms.uAlpha.value = k1 * 0.12 + k2 * 0.85;
      S.grateM.emissive.setHex(0x000000).lerp(_c.setHex(0x601404), k1).lerp(_c.setHex(0x3a0c02), k2).multiplyScalar(1 + fk * 2);
      const tk = k2 * (0.85 + fk); S.FU.uT.value = t % 100; S.FU.uI.value = tk; S.haloM.color.setRGB(1, 0.42, 0.14).multiplyScalar(tk * 0.55); S.poolM.color.setRGB(1, 0.45, 0.16).multiplyScalar(tk * 0.3);
        for (const q of S.torches) { if (q.L) q.L.intensity = tk * 95; q.fl.visible = q.ha.visible = q.pl.visible = k2 > 0.02; q.fl.scale.set(1, 0.9 + Math.sin(t * 9 + q.fl.position.x) * 0.12, 1); }
      // crowd
      if (S.hush > 0) S.hush -= dt; S.cheer = Math.max(0, S.cheer - dt * 0.4); S.stomp = Math.max(0, (S.stomp || 0) - dt * 5);
      S.cheerK = damp(S.cheerK, S.hush > 0 ? 0 : 0.18 + k1 * 0.12 + S.cheer * 0.8 + (S.frenzy > 0 ? 0.5 : 0) + (S.out > 6 ? 0.3 : 0), 4, dt);
      S.CU.uT.value = t % 1000; S.CU.uAmp.value = S.cheerK; S.CU.uJump.value = sat(S.cheerK * 1.3 - 0.25) + k2 * 0.35; S.CU.uStand.value = k2; S.CU.uFire.value = k1 * 0.22 + k2 * 0.45; S.VU.uT.value = t % 1000; S.VU.uThru.value = 0.35 * (1 - k2 * 0.85) - k1 * 0.1;
      if (p) { const c = camera.position, dx = c.x - p.pos.x, dz = c.z - p.pos.z, dl = Math.hypot(dx, dz) || 1; S.pfill.position.set(p.pos.x + dx / dl * 1.6, p.pos.y + 2.6, p.pos.z + dz / dl * 1.6); S.pfill.intensity = k1 * 7 + k2 * 6; } S.crowd.forEach((im) => { im.position.y = (S.stomp || 0) * 0.22; });
      S.harmK = Math.max(0, (S.harmK || 0) - dt * 2); S.harm.rotation.x = -S.harmK * 1.6; S.handler.rotation.y = p ? angTo(0, -(R + 1.6), p.pos.x, p.pos.z) : 0;
      if (S.winch > 0) { S.winch -= dt; S.drum.rotation.y += dt * 6; }
      // reach line
      if (!S.loose) { const A = lastA(S), r = reach(S) + 2.6; S.reach.position.x = A.x; S.reach.position.z = A.z; S.reach.scale.setScalar(r); S.reachM.opacity = 0.28 + (S.chant > 0 || S.frenzy > 0 ? 0.3 + Math.sin(t * 9) * 0.12 : 0); S.reachM.color.setHex(S.frenzy > 0 || S.chant > 0 ? 0xc02010 : 0x5a2a10); }
      // spikes: forged stakes punch up through the grates, throw grit, glow hot at the root
      for (const q of S.spikes) { q.up = Math.max(0, q.up - dt * 1.1); q.im.position.y = -1.8 + smooth(sat(q.up * 3)) * 1.8; q.gl.visible = q.up > 0.01; q.U.uA.value = sat(q.up * 3) * 0.9;
        if (q.up > q.was + 0.3) q.gt = 0; q.gt = Math.min(1, q.gt + dt / 0.75); q.gr.visible = q.gt < 1; q.GU.uG.value = q.gt;
        if (q.up > q.was + 0.3) for (let i = 0; i < 9; i++) { const j = Math.floor(vrand() * q.pos.length / 2) * 2; FX.burst(q.pos[j], 0.2, q.pos[j + 1], { n: 4, smoke: true, color: DUST, color2: 0x9a8060, speed: [1, 3.5], dir: [0, 1, 0], spread: 0.8, life: [0.4, 0.8], size: [0.35, 0.8], alpha: 0.35 }); }
        q.was = q.up; }
      // rings, each with a low dust skirt trailing inside it
      for (const g of S.rings) { g.dm.visible = g.on; if (g.on && !g.w0) { FX.burst(g.x, 0.15, g.z, { n: 26, smoke: true, flat: true, color: DUST, color2: 0x8a7050, speed: [3, 8], life: [0.5, 1.0], size: [0.5, 1.1], alpha: 0.32, radius: 1.5 }); FX.burst(g.x, 0.3, g.z, { n: 14, smoke: true, color: 0x5a4430, color2: 0x3a2c20, speed: [3, 7], dir: [0, 1, 0], spread: 0.9, grav: 14, life: [0.4, 0.8], size: [0.15, 0.3], alpha: 0.9, radius: 1.2 }); } if (g.on && !g.w0) S.dustRing(g.x, g.z, 7, 1.1); g.w0 = g.on; if (!g.on) continue; g.m.visible = true; g.m.position.set(g.x, 0.22, g.z); g.m.scale.set(g.r, g.r, 6); g.dm.position.set(g.x, 0.04, g.z); g.dm.scale.setScalar(g.r + 0.5); g.U.uR.value = g.r; g.U.uA.value = 1 - sat((g.r - g.max * 0.55) / (g.max * 0.45)); }
      for (const d of S.drings) if (d.t < 1) { d.t = Math.min(1, d.t + dt / d.dur); d.U.uK.value = 1 - (1 - d.t) * (1 - d.t); d.U.uF.value = d.t * d.t; d.m.visible = d.t < 1; }
      for (const q of S.posts) { const fd = q.alive && (q.col.userData.fadeA === undefined ? 1 : q.col.userData.fadeA) < 0.99; if (fd !== q.pf) { q.pf = fd; q.pd.visible = fd; q.col.renderOrder = fd ? 11 : 0; } }
      // beast pose
      S.downK = damp(S.downK, S.down > 0 ? 1 : 0, 7, dt); S.crouchK = damp(S.crouchK || 0, S.crouch, 10, dt); S.rearK = damp(S.rearK || 0, S.rear, 8, dt); S.lunge = Math.max(0, S.lunge - dt * 3.2); S.whipK = Math.max(0, (S.whipK || 0) - dt * 3);
      const fr = S.frenzy > 0 ? 1 : 0, run = S.moving * (1 - S.downK); S.runT += dt * (6 + run * (9 + fr * 6));
      B.rig.position.y = -S.crouchK * 0.55 + S.hop + Math.abs(Math.sin(S.runT)) * 0.14 * run - S.downK * 1.0; B.rig.rotation.x = -S.rearK * 0.42 + S.crouchK * 0.12 + S.lunge * 0.16; B.rig.rotation.z = S.downK * 1.25; B.rig.position.x = S.downK * 1.2;
      B.legs.forEach((h, i) => { h.rotation.x = Math.sin(S.runT + (i % 2 ? PI : 0) + (i > 1 ? 1.2 : 0)) * 0.75 * run + (i < 2 ? -S.rearK * 0.9 - S.lunge * 0.5 : S.rearK * 0.3) + S.downK * (i % 2 ? 0.5 : -0.3); });
      B.neck.rotation.x = -S.rearK * 0.5 + S.crouchK * 0.3 - S.lunge * 0.35 + Math.sin(t * 1.7) * 0.05 + S.downK * 0.4; B.neck.rotation.y = Math.sin(t * 0.9) * 0.12 * (1 - run) + (fr ? Math.sin(t * 19) * 0.12 : 0);
      B.jaw.rotation.x = 0.12 + S.rearK * 0.6 + S.lunge * 0.7 + (b.castState ? 0.25 : 0) + fr * (0.3 + Math.sin(t * 15) * 0.2); B.tail.rotation.y = Math.sin(t * (2 + fr * 7)) * (0.4 + fr * 0.3); B.tail.rotation.x = S.rearK * 0.4;
      const red = Math.max(fr, S.chant > 0 ? 1 - sat(S.chant / 9) * 0.8 : 0, S.lvl >= 2 ? 0.7 : S.lvl >= 1 ? 0.35 : 0) * (1 - S.downK);
      B.eyeM.color.setHex(0xffc040).lerp(_c.setHex(BLOOD), red).multiplyScalar((3 + red * 5) * (1 - S.downK * 0.85)); S.eyeL.intensity = red * 6; B.eyeSM.color.copy(B.eyeM.color).multiplyScalar(0.22);
      // wear and fury by phase: dented, cracked helmet and a sprung plate, froth, a snapped chain; then heat in the cracks
      S.BU.uRim.value.setRGB(0.1, 0.13, 0.22).lerp(_c.setRGB(0.16, 0.1, 0.1), k1).lerp(_c.setRGB(0.22, 0.09, 0.04), k2); S.BU.uDmg.value = k1; S.BU.uHeat.value = k2 * (0.85 + fk); S.BU.uCrack.value = k2 * (0.75 + fk);
      B.plates[1].rotation.set(0.01 + k1 * 0.4, k1 * 0.15, k1 * 0.6); B.plates[1].position.x = k1 * 0.32; B.plates[1].position.y = 3.18 - k1 * 0.15; B.snap.rotation.set(Math.sin(t * 3.1) * 0.35, 0, Math.sin(t * 2.3) * 0.2); B.froth.visible = B.snap.visible = S.lvl >= 1;
      if ((S.puff -= dt) <= 0) { S.puff = 1.7 - k1 * 0.5 - k2 * 0.5; B.nose.getWorldPosition(_a); FX.burst(_a.x, _a.y, _a.z, { n: 5, smoke: true, color: 0xd8d0c8, color2: 0x8a8078, speed: [0.6, 1.8], dir: [Math.sin(b.facing), -0.25, Math.cos(b.facing)], spread: 0.45, life: [0.5, 1.0], size: [0.3, 0.75], alpha: 0.22 }); }
      if (run > 0.5 && (S.hoofT -= dt) <= 0) { S.hoofT = 0.08; const bx = b.pos.x - Math.sin(b.facing) * 1.4 + (vrand() - 0.5) * 1.6, bz = b.pos.z - Math.cos(b.facing) * 1.4 + (vrand() - 0.5) * 1.6; FX.burst(bx, 0.15, bz, { n: 2, smoke: true, color: DUST, color2: 0xa89068, speed: [0.3, 1.5], dir: [0, 1, 0], spread: 1, life: [0.5, 1.0], size: [0.5, 1.1], alpha: 0.3 }); }
      // see-through when he stands between the camera and the player
      if (p) { const c = camera.position, sx = p.pos.x - c.x, sy = p.pos.y + 1.2 - c.y, sz = p.pos.z - c.z, l2 = Math.max(sx * sx + sy * sy + sz * sz, 1e-6); let hit = false;
        for (const o of [3.0, 0.8, -1.4]) { const bx = b.pos.x + Math.sin(b.facing) * o, by = 2.5 + B.rig.position.y, bz = b.pos.z + Math.cos(b.facing) * o, k = clamp(((bx - c.x) * sx + (by - c.y) * sy + (bz - c.z) * sz) / l2, 0, 1), dx = c.x + sx * k - bx, dy = c.y + sy * k - by, dz = c.z + sz * k - bz; if ((k > 0.05 && k < 0.88 && dx * dx + dy * dy + dz * dz < 2.6) || (bx - c.x) ** 2 + (by - c.y) ** 2 + (bz - c.z) ** 2 < 9) hit = true; }
        S.fadeA = damp(S.fadeA, hit && !Cam.cine ? 0.5 : 1, 8, dt); const fading = S.fadeA < 0.995;
        if (fading !== S.fadeWas) { for (const d of B.depth) d.visible = fading; for (const o of B.fadeMeshes) o.renderOrder = fading ? 11 : 0; if (!fading) for (const m of B.mats) m.opacity = 1; }
        if (fading) for (const m of B.mats) m.opacity = m.userData.solid ? 1 : S.fadeA; S.fadeWas = fading; }
      // chain links along the polyline, sagging where there is slack
      const I = S.links; let n = 0; const cy = 2.75 + B.rig.position.y * 0.8, cx = b.pos.x + Math.sin(b.facing) * 1.7, cz = b.pos.z + Math.cos(b.facing) * 1.7;
      const lay = (ax, ay, az, bx, by, bz, sag) => {
        const len = Math.hypot(bx - ax, by - ay, bz - az), cnt = Math.max(1, Math.round(len / 0.36));
        for (let i = 0; i < cnt && n < 168; i++) {
          const k = (i + 0.5) / cnt, k2 = (i + 1.5) / cnt, y = (kk) => Math.max(0.12, lerp(ay, by, kk) - 4 * sag * kk * (1 - kk));
          _a.set(lerp(ax, bx, k), y(k), lerp(az, bz, k)); _b.set(lerp(ax, bx, k2), y(k2), lerp(az, bz, k2)).sub(_a); if (_b.lengthSq() < 1e-8) _b.set(0, 0, 1); _b.normalize();
          _m.position.copy(_a); _m.quaternion.setFromUnitVectors(_z, _b); _q.setFromAxisAngle(_z, n % 2 ? PI / 2 : 0); _m.quaternion.multiply(_q); _q.setFromAxisAngle(_a.set(0, 1, 0), PI / 2); _m.quaternion.multiply(_q); _m.scale.set(1, 1, 1.25); _m.updateMatrix(); I.setMatrixAt(n++, _m.matrix);
        }
      };
      if (!S.loose) {
        let ax = 0, ay = 1.45, az = 0;
        for (const w of S.wraps) { lay(ax, ay, az, w.q.x, 1.3, w.q.z, 0.05); ax = w.q.x; ay = 1.3; az = w.q.z; }
        const d = Math.hypot(cx - ax, cz - az), slack = Math.max(0, reach(S) + 1.7 - d); lay(ax, ay, az, cx, cy, cz, Math.min(1.9, slack * 0.45) + S.whipK * -0.6);
      } else {
        const lift = F.on ? 1 : F.wind ? 0.6 : 0, ty = 0.5 + lift * 0.9; lay(cx, cy, cz, S.tip.x, ty, S.tip.z, F.on ? 0 : 1.6 * (1 - lift * 0.6));
        S.block.position.set(S.tip.x, ty, S.tip.z); S.block.rotation.y = angTo(cx, cz, S.tip.x, S.tip.z);
      }
      I.count = n; I.instanceMatrix.needsUpdate = true;
      if (S.loose && F.on) { S.arc.visible = true; S.arc.position.set(b.pos.x, 0.6, b.pos.z); S.arc.rotation.y = F.a; S.arc.scale.set(F.dir, 1, 1); S.arcU.uA.value = sat(F.t * 3);
        if (vrand() < dt * 40) { const k = 0.35 + vrand() * 0.6; FX.burst(lerp(cx, S.tip.x, k), 0.25, lerp(cz, S.tip.z, k), { n: 5, color: 0xffc060, speed: [2, 7], dir: [0, 1, 0], spread: 0.9, life: [0.2, 0.45], size: [0.08, 0.18] }); }
        if (vrand() < dt * 30) FX.burst(S.tip.x, 0.15, S.tip.z, { n: 4, color: 0xffd080, speed: [3, 8], dir: [0, 0.6, 0], spread: 1, life: [0.15, 0.35], size: [0.07, 0.15], grav: 9 }); } else S.arc.visible = false;
    },
    danger(b, x, z) {
      const S = b.state, F = S.fl; let best = Infinity;
      for (const g of S.rings) if (g.on) { const d = Math.hypot(x - g.x, z - g.z); if (d > g.r && d - g.r < 2) best = Math.min(best, (d - g.r) / g.v + 0.6); }
      if (S.loose) { if (F.on && Math.hypot(x - b.pos.x, z - b.pos.z) < FL + 1.4) best = Math.min(best, 0.3); return best; }
      if (S.frenzy > 0 || (b.castState && b.castState.name === 'Bloodlust')) { const A = lastA(S); if (Math.hypot(x - A.x, z - A.z) < reach(S) + 3.4) best = Math.min(best, 0.5 + Math.hypot(x - b.pos.x, z - b.pos.z) * 0.05); }
      return best;
    },
    bot(b, p) {
      const S = b.state, out = {};
      for (const g of S.rings) if (g.on && !g.hit) { const tt = (Math.hypot(p.pos.x - g.x, p.pos.z - g.z) - g.r) / g.v; if (tt > 0 && tt < 0.2) p.jump(); }
      if (S.loose) { const cs = b.castState; if (S.fl.on || (cs && cs.name === 'Flail')) { const a = angTo(b.pos.x, b.pos.z, p.pos.x, p.pos.z); let x = b.pos.x + Math.sin(a) * (FL + 3.5), z = b.pos.z + Math.cos(a) * (FL + 3.5); if (Math.hypot(x, z) > R - 1.5) { const a2 = angTo(b.pos.x, b.pos.z, 0, 0); x = b.pos.x + Math.sin(a2) * (FL + 3.5); z = b.pos.z + Math.cos(a2) * (FL + 3.5); } out.x = x; out.z = z; out.w = 3; out.holdFire = false; } return out; }
      const hot = S.chant > 0 || S.frenzy > 0 || (b.castState && b.castState.name === 'Bloodlust');
      if (hot) {
        const A = lastA(S), r = reach(S) + 4.2;
        if (S.wraps.length) { let bx = null, bz = 0, bd = 1e9; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, x = Math.sin(a) * (R - 1.6), z = Math.cos(a) * (R - 1.6); if (Math.hypot(x - A.x, z - A.z) < r) continue; const d = Math.hypot(x - p.pos.x, z - p.pos.z); if (d < bd) { bd = d; bx = x; bz = z; } } if (bx !== null) { out.x = bx; out.z = bz; out.w = 3; return out; } }
        let q = null, qd = 1e9; for (const s of S.posts) { if (!s.alive || S.wraps.some((w) => w.q === s)) continue; const d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z) + Math.hypot(s.x, s.z) * 0.3; if (d < qd) { qd = d; q = s; } }
        if (q) { // stand beyond the post, on the other side of the stake-post line from him, so the chain has to cross it
          const ql = Math.hypot(q.x, q.z) || 1, ox = q.x / ql, oz = q.z / ql, side = cross(q.x, q.z, b.pos.x, b.pos.z) >= 0 ? 1 : -1;
          out.x = q.x + ox * 3.2 + oz * side * 5.5; out.z = q.z + oz * 3.2 - ox * side * 5.5; const d = Math.hypot(out.x, out.z); if (d > R - 1.2) { out.x *= (R - 1.2) / d; out.z *= (R - 1.2) / d; } out.w = 3; }
      }
      return out;
    },
  });
})();
