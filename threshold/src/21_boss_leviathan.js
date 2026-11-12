// DOOR II: THALASSOR, the Storm Tide. A stone platform in a black sea. The waves take whatever is not behind a rock.
(() => {
  const R = 16, TEAL = 0x35e0d0, SEA_Y = -2.6;
  const PIL = [0.785, 2.356, 3.927, 5.498].map((a) => ({ x: Math.sin(a) * 8.5, z: Math.cos(a) * 8.5, alive: true, mesh: null }));
  const along = (x, z, d) => x * Math.sin(d) + z * Math.cos(d), lat = (x, z, d) => x * Math.cos(d) - z * Math.sin(d);
  function sheltered(S, x, z, d) { for (const q of S.pil) { if (!q.alive) continue; const da = along(x, z, d) - along(q.x, q.z, d), dl = Math.abs(lat(x, z, d) - lat(q.x, q.z, d)); if (da > 0.2 && da < 6.2 && dl < 1.5) return true; } return false; }
  // danger palette: warm against the cold sea, so telegraphs never share the boss's teal
  const DANGER = 0xff7a3a, BOLT = 0xffd35a, CHARGED = 0xffaa3c, VORTEX = 0xff5c7c, COIL = 0xff4a30, SAFE = 0x8fe8ff;
  const MOON = new V3(-0.42, 0.36, -0.83).normalize(), BAND = new THREE.Color(), UNDER = new THREE.Color(), CDARK = new THREE.Color();

  // ---------- local geometry helpers ----------
  const n3 = (x, y, z, s = 1) => (W.vnoise(x + 31.7, y, s) + W.vnoise(y + 11.3, z, s + 1) + W.vnoise(z + 7.1, x, s + 2)) / 3;
  const f3 = (x, y, z, s = 1, oct = 4) => { let a = 0.5, f = 1, sum = 0, nn = 0; for (let i = 0; i < oct; i++) { sum += a * n3(x * f, y * f, z * f, s + i * 7); nn += a; a *= 0.5; f *= 2; } return sum / nn; };
  const lin = (hex) => new THREE.Color(hex);
  function remap(geo, fn) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const r = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, r[0], r[1], r[2]); } p.needsUpdate = true; geo.computeVertexNormals(); return geo; }
  function paint(geo, fn) { const p = geo.attributes.position, nn = geo.attributes.normal, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const r = fn(p.getX(i), p.getY(i), p.getZ(i), nn.getX(i), nn.getY(i), nn.getZ(i)); c[i * 3] = r[0]; c[i * 3 + 1] = r[1]; c[i * 3 + 2] = r[2]; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; }
  function merge(geos) {
    const parts = geos.map((g) => { const q = g.index ? g.toNonIndexed() : g; if (!q.attributes.normal) q.computeVertexNormals(); return q; });
    let n = 0; for (const q of parts) n += q.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = new Float32Array(n * 3); let o = 0;
    for (const q of parts) { const c = q.attributes.position.count; P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); if (q.attributes.uv) U.set(q.attributes.uv.array, o * 2); if (q.attributes.color) C.set(q.attributes.color.array, o * 3); else C.fill(1, o * 3, (o + c) * 3); o += c; }
    for (const g of geos) g.dispose(); for (const q of parts) q.dispose();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeBoundingSphere(); return g;
  }
  const _up0 = new V3(0, 1, 0), _e2 = new V3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _sv = new V3(), _pv = new V3();
  function place3(geo, x, y, z, rx, ry, rz, sx, sy, sz) { _e.set(rx, ry, rz); _q.setFromEuler(_e); _m4.compose(_pv.set(x, y, z), _q, _sv.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz)); geo.applyMatrix4(_m4); return geo; }
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  // fresnel rim on a standard/physical material so the silhouette reads against the black sea
  function hfogify(mat, U, HF) { mat.onBeforeCompile = (sh) => { sh.uniforms.uRim = U; sh.uniforms.uHF = HF;
      sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWY=(modelMatrix*vec4(transformed,1.0)).y;');
      sh.fragmentShader = 'uniform vec3 uRim; uniform vec3 uHF; varying float vWY;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float vl=max(length(vViewPosition),1e-4); float fr=1.0-clamp(abs(dot(normal, vViewPosition/vl)),0.0,1.0); totalEmissiveRadiance += uRim*(fr*fr*fr); }')
        .replace('#include <fog_fragment>', '#include <fog_fragment>\n#ifdef USE_FOG\n{ float hb=smoothstep(uHF.y,uHF.x,vWY)*uHF.z; float ht=smoothstep(uHF.y+6.0,uHF.y+34.0,vWY)*0.45; gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(max(hb,ht),0.0,1.0)); }\n#endif'); }; mat.customProgramCacheKey = () => 'levRimH'; return mat; }
  function bodify(mat, U, TU) { mat.onBeforeCompile = (sh) => { sh.uniforms.uRim = U; sh.uniforms.uBT = TU; sh.fragmentShader = 'uniform vec3 uRim; uniform float uBT;\n' + sh.fragmentShader
        // distant coils: blur the scale maps (mip bias) so the pattern fades into a sheen instead of moire
        .replace('void main() {', 'void main() {\n float levB=0.8*smoothstep(5.0,14.0,length(vViewPosition))+2.0*smoothstep(14.0,60.0,length(vViewPosition));').replace('texture2D( map, vMapUv )', 'texture2D( map, vMapUv, levB )').replace('texture2D( normalMap, vNormalMapUv )', 'texture2D( normalMap, vNormalMapUv, levB )').replace('texture2D( roughnessMap, vRoughnessMapUv )', 'texture2D( roughnessMap, vRoughnessMapUv, levB )').replace('texture2D( emissiveMap, vEmissiveMapUv )', 'texture2D( emissiveMap, vEmissiveMapUv, levB*0.6 )').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_EMISSIVEMAP\n{ float bp=0.5+0.5*sin(vEmissiveMapUv.y*2.4-uBT*2.6); totalEmissiveRadiance*=0.3+1.1*bp*bp; }\n#endif\n{ float vl=max(length(vViewPosition),1e-4); float fr=1.0-clamp(abs(dot(normal, vViewPosition/vl)),0.0,1.0); totalEmissiveRadiance += uRim*(fr*fr*fr); }')
        // brazier light on the wet body: keep only a little of its warm excess so the neck shows no rust-orange smear
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n{ vec3 x=reflectedLight.directDiffuse; float w=max(x.r-max(x.g,x.b),0.0); reflectedLight.directDiffuse-=vec3(w*0.75,w*0.3,0.0); x=reflectedLight.directSpecular; w=max(x.r-max(x.g,x.b),0.0); reflectedLight.directSpecular-=vec3(w*0.85,w*0.4,0.0); }'); }; mat.customProgramCacheKey = () => 'levBody'; return mat; }
  // basalt: fine vertical weathering streaks and wet darkening in world space, plus a soft broad wet sheen instead of a hard rim
  function stoneify(mat, U) { mat.onBeforeCompile = (sh) => { sh.uniforms.uRim = U;
      sh.vertexShader = 'varying vec3 vSW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvSW=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = 'uniform vec3 uRim; varying vec3 vSW;\nfloat sh21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }\nfloat sn2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(sh21(i),sh21(i+vec2(1,0)),f.x),mix(sh21(i+vec2(0,1)),sh21(i+vec2(1,1)),f.x),f.y); }\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n{ float sa=vSW.x*5.3+vSW.z*7.1; float st=sn2(vec2(sa*1.7,vSW.y*0.45))*0.55+sn2(vec2(sa*4.3,vSW.y*1.1))*0.3+sn2(vec2(sa*11.0,vSW.y*3.0))*0.15; diffuseColor.rgb*=0.7+0.6*st; }')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float vl=max(length(vViewPosition),1e-4); float fr=1.0-clamp(abs(dot(normal, vViewPosition/vl)),0.0,1.0); float wv=0.45+0.55*sn2(vec2((vSW.x+vSW.z)*0.9,vSW.y*0.7)); totalEmissiveRadiance += uRim*(fr*fr)*wv*smoothstep(-0.2,2.5,vSW.y+wv); }'); };
    mat.customProgramCacheKey = () => 'levStone'; return mat; }
  function rimify(mat, U) { mat.onBeforeCompile = (sh) => { sh.uniforms.uRim = U; sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float vl=max(length(vViewPosition),1e-4); float fr=1.0-clamp(abs(dot(normal, vViewPosition/vl)),0.0,1.0); totalEmissiveRadiance += uRim*(fr*fr*fr); }'); }; mat.customProgramCacheKey = () => 'levRim'; return mat; }

  // wet flagstones: puddles (low roughness in the map) get a sky-tinted sheen, a thin bright rim and rain rings instead of mirroring the black sky
  function puddlify(mat, S) { S.pudU = { uT: { value: 0 }, uPud: { value: BAND } }; mat.onBeforeCompile = (sh) => { sh.uniforms.uT = S.pudU.uT; sh.uniforms.uPud = S.pudU.uPud;
      sh.fragmentShader = 'uniform float uT; uniform vec3 uPud;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n reflectedLight.directSpecular *= 1.0/(1.0+dot(reflectedLight.directSpecular,vec3(0.333))*3.0);').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float rf=roughnessFactor; float pm=smoothstep(0.34,0.24,rf), rim=smoothstep(0.38,0.31,rf)*smoothstep(0.2,0.3,rf); float vl=max(length(vViewPosition),1e-4); float fr=1.0-clamp(abs(dot(normal,vViewPosition/vl)),0.0,1.0);
        vec2 g=vMapUv*26.0, id=floor(g), f=fract(g)-0.5; float hh=fract(sin(dot(id,vec2(12.9898,78.233)))*43758.5453); float ph=fract(uT*0.85+hh*7.0); float rr=length(f+vec2(hh-0.5,fract(hh*13.7)-0.5)*0.4);
        float ring=smoothstep(0.035,0.0,abs(rr-ph*0.42))*(1.0-ph)*step(0.35,hh);
        totalEmissiveRadiance += uPud*(pm*(0.3+1.1*fr*fr)+rim*0.9+pm*ring*1.6); }`); }; mat.customProgramCacheKey = () => 'levPud'; return mat; }
  // Dynamic tube along a spine of n points; rings of M verts. rad(u) radius profile, color(u, cos, sin) static vertex colour, optional dorsal fin strip.
  function Tube(n, M, rad, o = {}) {
    const R1 = M + 1, V = n * R1, pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = new Float32Array(V * 2), col = new Float32Array(V * 3), idx = [];
    const rr = [], cs = [], sn = []; for (let i = 0; i < n; i++) rr.push(rad(i / (n - 1))); for (let k = 0; k <= M; k++) { cs.push(Math.cos(k / M * TAU)); sn.push(Math.sin(k / M * TAU)); }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < M; k++) { const a = i * R1 + k, b2 = a + R1; idx.push(a, a + 1, b2, a + 1, b2 + 1, b2); }
    for (let i = 0; i < n; i++) for (let k = 0; k <= M; k++) { const j = i * R1 + k, u = i / (n - 1); uv[j * 2] = k / M; uv[j * 2 + 1] = u * (o.vLen || 1); const c = o.color ? o.color(u, cs[k], sn[k]) : [1, 1, 1]; col[j * 3] = c[0]; col[j * 3 + 1] = c[1]; col[j * 3 + 2] = c[2]; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx); geo.boundingSphere = new THREE.Sphere(new V3(), 1e5);
    const mesh = new THREE.Mesh(geo, o.mat); mesh.frustumCulled = false; mesh.castShadow = !!o.shadow; mesh.receiveShadow = true;
    let fin = null, fpos = null, fnor = null, f0 = 0, f1 = 0, fh = [];
    if (o.fin) {
      f0 = Math.round(o.fin.from * (n - 1)); f1 = Math.round(o.fin.to * (n - 1)); const fn2 = f1 - f0 + 1; fpos = new Float32Array(fn2 * 6); fnor = new Float32Array(fn2 * 6); const fuv = new Float32Array(fn2 * 4), fidx = [];
      for (let i = 0; i < fn2; i++) { const u = (f0 + i) / (n - 1), w = (i / Math.max(1, fn2 - 1)); fh.push(o.fin.h * Math.pow(Math.max(Math.sin(PI * w), 0), 0.5) * (0.84 + 0.16 * Math.cos(u * o.fin.rays * TAU))); fuv[i * 4] = u * o.fin.rays; fuv[i * 4 + 1] = 0; fuv[i * 4 + 2] = u * o.fin.rays; fuv[i * 4 + 3] = 1; if (i < fn2 - 1) { const a = i * 2; fidx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); fg.setAttribute('normal', new THREE.BufferAttribute(fnor, 3)); fg.setAttribute('uv', new THREE.BufferAttribute(fuv, 2)); fg.setIndex(fidx); fg.boundingSphere = new THREE.Sphere(new V3(), 1e5);
      fin = new THREE.Mesh(fg, o.fin.mat); fin.frustumCulled = false; mesh.add(fin);
    }
    const T = new V3(), N = new V3(), B = new V3(), pN = new V3(), tmp = new V3(), wx = o.wx || 1, wy = o.wy || 0.9;
    function update(P, ref) {
      for (let i = 0; i < n; i++) {
        T.subVectors(P[Math.min(i + 1, n - 1)], P[Math.max(i - 1, 0)]); const tl = T.length(); if (tl < 1e-5) T.set(0, 1, 0); else T.multiplyScalar(1 / tl);
        const rf = Array.isArray(ref) ? ref[i] : ref; N.copy(rf).addScaledVector(T, -rf.dot(T)); if (i > 0) { tmp.copy(pN).addScaledVector(T, -pN.dot(T)); N.addScaledVector(tmp, 0.35); }
        let nl = N.length(); if (nl < 1e-4) { N.set(1, 0, 0).addScaledVector(T, -T.x); nl = Math.max(N.length(), 1e-4); } N.multiplyScalar(1 / nl); pN.copy(N);
        B.crossVectors(T, N); const r = rr[i], ry = r * wy, rx = r * wx, p = P[i];
        for (let k = 0; k <= M; k++) { const j = (i * R1 + k) * 3, c = cs[k], s = sn[k];
          pos[j] = p.x + N.x * c * ry + B.x * s * rx; pos[j + 1] = p.y + N.y * c * ry + B.y * s * rx; pos[j + 2] = p.z + N.z * c * ry + B.z * s * rx;
          let ax = N.x * c * rx + B.x * s * ry, ay = N.y * c * rx + B.y * s * ry, az = N.z * c * rx + B.z * s * ry; const al = Math.max(Math.hypot(ax, ay, az), 1e-5); nor[j] = ax / al; nor[j + 1] = ay / al; nor[j + 2] = az / al; }
        if (fin && i >= f0 && i <= f1) { const j = (i - f0) * 6, h = fh[i - f0], bx = p.x + N.x * ry * 0.82, by = p.y + N.y * ry * 0.82, bz = p.z + N.z * ry * 0.82;
          fpos[j] = bx; fpos[j + 1] = by; fpos[j + 2] = bz; fpos[j + 3] = bx + N.x * h - T.x * h * 0.35; fpos[j + 4] = by + N.y * h - T.y * h * 0.35; fpos[j + 5] = bz + N.z * h - T.z * h * 0.35;
          fnor[j] = fnor[j + 3] = B.x; fnor[j + 1] = fnor[j + 4] = B.y; fnor[j + 2] = fnor[j + 5] = B.z; }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
      if (fin) { fin.geometry.attributes.position.needsUpdate = true; fin.geometry.attributes.normal.needsUpdate = true; }
    }
    return { mesh, update, n };
  }

  // ---------- textures ----------
  function scaleTex() { // overlapping fish scales, tileable
    const NS = 16;
    return W.bake(512, (u, v) => {
      let h = 0, e = 1;
      for (let L = 0; L < 2; L++) { const su = u * NS + L * 0.5, sv = v * NS + L * 0.5, fu = su - Math.floor(su) - 0.5, fv = sv - Math.floor(sv) - 0.5; const d = Math.hypot(fu, fv * 1.15); const s = sat(1 - d * 1.55) * (0.65 + 0.35 * (fv + 0.5)); if (s > h) h = s; e = Math.min(e, Math.abs(d - 0.5)); }
      const nz = W.fbm(u * 24, v * 24, 5, 3, 24); return [h * 0.85 + nz * 0.15, 0.3 + h * 0.55 + nz * 0.15, 0.22 + (1 - h) * 0.45 + nz * 0.1];
    }, { dark: 0x303030, light: 0xe8e8e8, strength: 5 });
  }
  function bodyTex() { // u = around (once), v = along: 14 scale columns, ventral plate band down the belly
    const NC = 14, NR = 24;
    return W.bake(512, (u, v) => {
      let h = 0; for (let L = 0; L < 2; L++) { const su = u * NC + L * 0.5, sv = v * NR + L * 0.5, fu = su - Math.floor(su) - 0.5, fv = sv - Math.floor(sv) - 0.5; const s = sat(1 - Math.hypot(fu, fv * 1.1) * 1.5) * (0.6 + 0.4 * (fv + 0.5)); if (s > h) h = s; }
      const nz = W.fbm(u * 32, v * 32, 5, 3, 32), bd = Math.abs(u - 0.5), band = smooth((0.15 - bd) / 0.04);
      const pv = v * NR * 0.34, pf = pv - Math.floor(pv), plate = (0.55 + 0.45 * smooth(sat(pf * 3)) * smooth(sat((1 - pf) * 1.6))) * (0.85 + 0.15 * Math.cos(bd * 18));
      const hh = lerp(h, plate, band) * 0.85 + nz * 0.15, tone = lerp(0.3 + h * 0.55, 0.3 + plate * 0.26, band) + nz * 0.12;
      return [hh, tone, lerp(0.22 + (1 - h) * 0.45, 0.6 + (1 - plate) * 0.25, band) + nz * 0.1];
    }, { dark: 0x303030, light: 0xe8e8e8, strength: 4 });
  }
  function cell2(x, y, s, period) { const xi = Math.floor(x), yi = Math.floor(y); let f1 = 9, f2 = 9, id = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cx = xi + i, cy = yi + j, wx = ((cx % period) + period) % period, wy = ((cy % period) + period) % period; const px = cx + 0.15 + 0.7 * W.hash2(wx, wy, s), py = cy + 0.15 + 0.7 * W.hash2(wx, wy, s + 5), d = Math.hypot(px - x, py - y); if (d < f1) { f2 = f1; f1 = d; id = W.hash2(wx, wy, s + 9); } else if (d < f2) f2 = d; } return [f1, f2 - f1, id]; }
  function floorTex() { // worn irregular flagstones, cracks, puddles
    return W.bake(1024, (u, v) => {
      const c = cell2(u * 7, v * 7, 3, 7), seam = smooth(sat((c[1] - 0.02) * 9)), nz = W.fbm(u * 28, v * 28, 4, 4, 28), big = W.fbm(u * 3, v * 3, 9, 4, 3);
      const cr = W.fbm(u * 10, v * 10, 13, 4, 10), crack = Math.pow(sat(1 - Math.abs(cr - 0.5) * 22), 2) * (c[2] > 0.45 ? 1 : 0);
      const puddle = smooth(sat((big - 0.58) * 14)), wear = smooth(sat(c[1] * 3));
      const h = (seam * (0.62 + c[2] * 0.25) + nz * 0.18 * wear - crack * 0.35) * (1 - puddle * 0.7) + puddle * 0.42;
      const tone = (0.3 + c[2] * 0.38 + nz * 0.25 + big * 0.12) * (0.45 + 0.55 * seam) * (1 - crack * 0.6) * (1 - puddle * 0.25);
      const rough = lerp(0.62 + nz * 0.3 - (1 - seam) * 0.25, 0.2, puddle);
      return [h, tone, rough];
    }, { dark: 0x0e1417, light: 0x8e9ca2, strength: 3.2 });
  }
  function lumTex() { // bioluminescent lateral lines + spot rows, u = around, v = along
    return canvasTex(64, 1024, (x, w, h) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      for (const cx of [16, 48]) { let y = 0; while (y < h) { const len = 6 + Math.random() * 26; x.fillStyle = `rgba(120,255,240,${0.55 + Math.random() * 0.45})`; x.fillRect(cx - 1, y, 2, len); x.fillStyle = 'rgba(60,200,190,0.25)'; x.fillRect(cx - 3, y, 6, len); y += len + 4 + Math.random() * 10; } }
      for (const cx of [9, 55]) for (let y = 8; y < h; y += 22 + Math.random() * 10) { x.fillStyle = `rgba(150,255,240,${0.4 + Math.random() * 0.5})`; x.beginPath(); x.arc(cx, y, 1.4 + Math.random() * 0.8, 0, TAU); x.fill(); }
      // belly plate seams, aligned with bodyTex's ventral plates (8.16 plates per tile, two tiles along v)
      for (let j = 0; j < 2; j++) for (let k = 0; k <= 8; k++) { const y = (1 - (j + 1 - k / 8.16) / 2) * h; x.fillStyle = 'rgba(60,210,190,0.12)'; x.fillRect(21, y - 4, 22, 8); x.fillStyle = 'rgba(110,240,225,0.42)'; x.fillRect(22, y - 1, 20, 2); }
    });
  }
  function rayTex() { // fin rays: bright line at u=0, brighter toward the tip
    return canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y++) { const k = y / h; x.fillStyle = `rgba(110,255,235,${0.15 + 0.85 * k * k})`; x.fillRect(0, y, 3, 1); x.fillRect(w - 3, y, 3, 1); x.fillStyle = `rgba(60,200,190,${0.12 * k})`; x.fillRect(3, y, w - 6, 1); } });
  }

  // ---------- sea ----------
  // Gerstner swell shared by the sea and the foam rings that sit on it
  const GW = `
      uniform float uTime,uAmp,uChop;
      void gw(vec2 p, vec2 d, float L, float A, float sp, float fade, inout vec3 o, inout vec3 n, inout float j){
        float k=6.2831/L, w=sqrt(9.8*k)*sp, f=k*dot(d,p)-w*uTime; float a=A*uAmp*fade, q=uChop/(k*max(a,1e-3)*7.0+1e-3); q=min(q,1.0);
        float c=cos(f), s=sin(f); o+=vec3(q*a*d.x*c, a*s, q*a*d.y*c); float wa=k*a; n.x-=d.x*wa*c; n.z-=d.y*wa*c; n.y-=q*wa*s; j-=q*wa*s; }
      void waves(vec2 p, float sp, out vec3 o, out vec3 n, out float j){
        o=vec3(0.0); n=vec3(0.0,1.0,0.0); j=1.0; float f1=clamp(1.6/sp,0.0,1.0), f2=clamp(0.9/sp,0.0,1.0), f3=clamp(0.45/sp,0.0,1.0);
        gw(p,normalize(vec2(1.0,0.32)),41.0,0.36,1.0,1.0,o,n,j); gw(p,normalize(vec2(0.7,-0.75)),24.0,0.25,1.0,1.0,o,n,j);
        gw(p,normalize(vec2(-0.25,1.0)),15.5,0.16,1.0,f1,o,n,j); gw(p,normalize(vec2(0.95,0.6)),9.7,0.1,1.0,f1,o,n,j);
        gw(p,normalize(vec2(-0.8,0.4)),6.1,0.06,1.0,f2,o,n,j); gw(p,normalize(vec2(0.2,-1.0)),3.8,0.04,1.0,f3,o,n,j); gw(p,normalize(vec2(1.0,-0.1)),2.4,0.025,1.0,f3,o,n,j); float sb=1.0+0.75*smoothstep(22.0,70.0,length(p)); o.y*=sb; n.xz*=sb; }`;
  function sea(sky) {
    const NR = 170, NA = 200, r0 = R + 0.1, pos = [], idx = [];
    for (let i = 0; i <= NR; i++) { const r = r0 + 1500 * Math.pow(i / NR, 2.3); for (let k = 0; k <= NA; k++) { const a = k / NA * TAU; pos.push(Math.sin(a) * r, 0, Math.cos(a) * r); } }
    for (let i = 0; i < NR; i++) for (let k = 0; k < NA; k++) { const a = i * (NA + 1) + k, b2 = a + NA + 1; idx.push(a, b2, a + 1, a + 1, b2, b2 + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new V3(), 2000);
    const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uAmp: { value: 1.3 }, uChop: { value: 0.75 }, uFoam: { value: 0.9 }, uGlow: { value: new THREE.Color(0) }, uFlash: { value: 0 },
      uDeep: { value: lin(0x03111a) }, uShallow: { value: lin(0x0b3a40) }, uTop: { value: lin(0x0c141c) }, uHor: { value: lin(0x34464f) }, uMoon: { value: MOON.clone() }, uMoonCol: { value: lin(0xcfe0ff) }, uBand: { value: BAND },
    }]);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: U, fog: true,
      vertexShader: GW + `
        varying vec3 vW; varying vec3 vN; varying float vH; varying float vJ;
        #include <fog_pars_vertex>
        void main(){
          vec4 wp=modelMatrix*vec4(position,1.0); float r=length(wp.xz); float sp=max(0.033*r, 19.0*pow(max((r-16.0)/1500.0,0.0),0.565)*1.2)+0.15;
          vec3 o,n; float j; waves(wp.xz, sp*0.25, o, n, j); float farK=1.0-smoothstep(120.0,500.0,r)*0.65; o.y*=farK; n.xz*=farK;
          float near=smoothstep(16.0,19.0,r); o.xz*=near; wp.xyz+=o; vW=wp.xyz; vN=n; vH=o.y; vJ=j;
          vec4 mvPosition=viewMatrix*wp; gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uTime,uAmp,uFoam,uFlash; uniform vec3 uDeep,uShallow,uTop,uHor,uMoon,uMoonCol,uGlow,uBand; varying vec3 vW; varying vec3 vN; varying float vH; varying float vJ;
        #include <fog_pars_fragment>
        float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
        float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
        float ripl(vec2 q, float t, float hf){ return n2(q*0.9+vec2(t*0.5,t*0.3))*0.5+n2(q*2.1-vec2(t*0.7,-t*0.4))*0.3*mix(1.0,0.5,hf)+n2(q*4.7+vec2(-t*0.9,t*1.1))*0.2*(1.0-hf); }
        void main(){
          vec2 q=vW.xz; float t=uTime; vec3 vd=cameraPosition-vW; float dist=max(length(vd),1e-3); vec3 v=vd/dist;
          float hf=smoothstep(14.0,45.0,dist), e=0.25, a=ripl(q,t,hf), ax=ripl(q+vec2(e,0.0),t,hf), az=ripl(q+vec2(0.0,e),t,hf); float dfade=1.0/(1.0+dist*0.03);
          vec3 n=vN+vec3(a-ax,0.0,a-az)*(1.15*dfade); n=n/max(length(n),1e-4);
          float ndv=clamp(dot(n,v),0.0,1.0); float fr=0.04+0.96*pow(1.0-ndv,5.0);
          vec3 rd=reflect(-v,n); float ry=clamp(rd.y,0.0,1.0);
          vec3 sky=mix(uHor*1.7+uBand*exp(-ry*ry*60.0),uTop*1.6+uHor*0.55,sqrt(ry))+uFlash*vec3(0.5,0.58,0.7)*(0.3+ry);
          float md=max(dot(rd,uMoon),0.0); vec3 refl=sky+uMoonCol*(pow(md,90.0)*0.42+pow(md,16.0)*0.16+pow(md,4.0)*0.05);
          float hN=clamp(vH/max(uAmp,0.05)*0.5+0.5,0.0,1.0);
          float sss=pow(hN,2.5)*(0.35+0.65*pow(1.0-ndv,2.0))*(0.6+0.4*clamp(dot(-v,uMoon)+0.5,0.0,1.0));
          vec3 body=uDeep+uShallow*sss*1.4;
          vec3 col=mix(body,refl,clamp(fr,0.0,1.0));
          float r=length(q);
          vec2 sd=normalize(vec2(1.0,0.32)); vec2 sq=vec2(dot(q,sd),dot(q,vec2(-sd.y,sd.x))); float fn=n2(vec2(sq.x*0.16-t*0.3,sq.y*1.1))*0.55+n2(vec2(sq.x*0.45,sq.y*2.2)+t*0.12)*0.3+n2(q*0.9-t*0.2)*0.15;
          float crest=smoothstep(0.78,0.35,vJ)*smoothstep(0.55,0.92,hN);
          float edge=(1.0-smoothstep(0.0,5.0,r-16.3))*(0.45+0.55*hN)*(0.6+0.4*sin(r*2.2-t*2.6+fn*4.0));
          float wsk=smoothstep(0.6,0.88,n2(vec2(sq.x*0.07-t*0.15,sq.y*2.4)))*smoothstep(0.35,0.8,n2(vec2(sq.x*0.3,sq.y*0.6)+t*0.05))*smoothstep(0.35,0.75,hN)*(uFoam-0.7)*0.55;
          float foam=clamp((crest*1.1+edge)*uFoam*smoothstep(0.3,0.72,fn+crest*0.25)+max(wsk,0.0),0.0,1.0)*(0.55+0.45*dfade);
          float lit=0.35+0.65*clamp(dot(n,uMoon)*0.5+0.5,0.0,1.0); float lace=0.55+0.45*smoothstep(0.3,0.7,n2(q*1.7+t*0.25));
          col=mix(col,vec3(0.36,0.43,0.47)*lit+uFlash*vec3(0.3,0.34,0.4),foam*0.6*lace);
          col+=uGlow*(0.35+0.65*a)*(0.3+0.7*hN)*(1.0-foam);
          float far=smoothstep(30.0,240.0,dist); col+=vec3(0.3,0.36,0.4)*smoothstep(0.72,0.95,n2(vec2(sq.x*0.012,sq.y*0.5)))*smoothstep(25.0,70.0,dist)*(1.0-far)*0.35;
          col=mix(col,uHor*1.45+uBand*0.5,far*0.7);
          gl_FragColor=vec4(max(col,vec3(0.0)),1.0);
          #include <fog_fragment>
          { float hv=v.y*25.0; gl_FragColor.rgb+=uBand*exp(-hv*hv)*0.85; }
        }`,
    }));
    m.position.y = SEA_Y; m.receiveShadow = false; m.onBeforeRender = () => { U.uTime.value = G.now % 3600; };
    return m;
  }

  // foam rings riding the swell where the serpent's body breaks the surface (one instanced draw)
  function foamRings(WU, n) {
    const base = new THREE.PlaneGeometry(1, 1, 18, 18); base.rotateX(-PI / 2);
    const g = new THREE.InstancedBufferGeometry(); g.setIndex(base.index); g.setAttribute('position', base.attributes.position); g.instanceCount = n;
    const C = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); C.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aC', C); g.boundingSphere = new THREE.Sphere(new V3(), 1e5);
    const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uAmp: { value: 1 }, uChop: { value: 0.75 } }]); U.uTime = WU.uTime; U.uAmp = WU.uAmp; U.uChop = WU.uChop;
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: GW + `
        attribute vec4 aC; varying vec2 vL; varying float vA; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vec2 lp=position.xz*aC.z*2.0; vec2 wp=aC.xy+lp; vec3 o,n; float j; waves(wp,0.3,o,n,j); vec4 w=vec4(wp.x+o.x,${SEA_Y.toFixed(2)}+o.y+0.08,wp.y+o.z,1.0); vL=lp/max(aC.z,1e-3); vA=aC.w; vW=w.xyz;
          vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime; varying vec2 vL; varying float vA; varying vec3 vW;
        #include <fog_pars_fragment>
        float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
        float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
        void main(){ float r=length(vL); if(r>1.0||vA<0.01) discard; float t=uTime;
          float band=0.5+0.5*sin(r*16.0-t*3.5+n2(vW.xz*0.8)*3.0); float nz=n2(vW.xz*1.5+vec2(t*0.4,-t*0.3))*0.7+n2(vW.xz*3.0-t*0.5)*0.3;
          float f=smoothstep(0.22,0.4,r)*(1.0-smoothstep(0.55,1.0,r))*(0.35+0.65*band)*smoothstep(0.3,0.65,nz+0.25*(1.0-r));
          float a=clamp(f*vA*0.7,0.0,0.45)*smoothstep(0.3,0.85,nz+0.2*band)*(0.7+0.3*smoothstep(0.2,0.8,n2(vW.xz*1.8+t*0.5))); gl_FragColor=vec4(vec3(0.42,0.5,0.54),a);
          #include <fog_fragment>
        }` }));
    m.frustumCulled = false; m.renderOrder = 7; return { mesh: m, attr: C };
  }
  // low storm cloud layer under the engine sky, with lightning glow and the P3 storm eye
  function cloudLayer() {
    const U = { uFogC: { value: new THREE.Color(0x24323d) }, uTime: { value: 0 }, uScroll: { value: 0 }, uCov: { value: 0.62 }, uEye: { value: 0 }, uFlash: { value: 0 }, uFlashDir: { value: new V3(0, 1, 0) }, uMoon: { value: MOON.clone() }, uCol: { value: lin(0x52627a) }, uDark: { value: CDARK }, uUnder: { value: UNDER }, uBand: { value: BAND }, uEyeCol: { value: lin(0x3fc8a8) }, uEyeDir: { value: new V3(0, 0.6, -0.8).normalize() } };
    const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), new THREE.ShaderMaterial({
      uniforms: U, side: THREE.BackSide, depthWrite: false, transparent: true, fog: false,
      vertexShader: 'varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
      fragmentShader: `
        uniform float uTime,uScroll,uCov,uEye,uFlash; uniform vec3 uFlashDir,uMoon,uCol,uDark,uEyeCol,uEyeDir,uFogC,uUnder,uBand; varying vec3 vD;
        float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
        float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*n2(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
        void main(){
          vec3 d=vD/max(length(vD),1e-4); float h=d.y; if(h<-0.04) discard;
          vec2 q=d.xz/(max(h,0.0)+0.16);
          vec2 ec=uEyeDir.xz/(uEyeDir.y+0.16); vec2 rv=q-ec; float rl=length(rv);
          float sw=uEye*(2.6/(rl+0.7)+uTime*0.08); float c=cos(sw), s=sin(sw); vec2 q2=ec+mat2(c,-s,s,c)*rv;
          vec2 p=q2*0.55+vec2(uScroll*0.022,uScroll*0.009);
          float n=fbm(p+fbm(p*0.7+uScroll*0.006)*1.5); float m=fbm(p*2.6-vec2(uScroll*0.04,0.0));
          float dens=smoothstep(1.0-uCov,1.0-uCov+0.38,n*0.78+m*0.32); float mdist=acos(clamp(dot(d,uMoon),-1.0,1.0)); dens*=smoothstep(0.05,0.32+0.12*m,mdist+(n-0.5)*0.12*(1.0-uEye));
          dens*=mix(1.0,smoothstep(0.35,1.25,rl),uEye);
          vec2 mo=normalize(uMoon.xz+vec2(1e-4))*0.18; float nl=fbm(p+mo+fbm(p*0.7+mo*0.7+uScroll*0.006)*1.5); float lit=clamp((n-nl)*6.0+0.5,0.0,1.0);
          vec2 p2=q2*1.1+vec2(uScroll*0.07,uScroll*0.03); float sc=fbm(p2*1.4+fbm(p2*0.8)*1.2); float dens2=smoothstep(1.05-uCov,1.35-uCov,sc)*0.85;
          float md=max(dot(d,uMoon),0.0);
          vec3 col=mix(uCol*(0.55+0.9*lit),uDark,smoothstep(0.25,0.95,dens)*(0.6+0.4*m)*(1.0-lit*0.5));
          col=mix(col,uDark*0.8+uCol*0.12*lit,dens2*(1.0-dens*0.5)); dens=max(dens,dens2);
          float low=smoothstep(0.45,0.02,h); col+=uUnder*(0.25+0.75*low)*(0.35+0.65*dens)*(0.5+0.7*m)*(0.6+0.4*n);
          col+=vec3(0.62,0.72,0.88)*(pow(md,10.0)*0.9+pow(md,60.0)*1.6*smoothstep(0.1,0.6,dens))*(1.0-dens*0.55);
          col+=vec3(0.7,0.8,1.0)*uFlash*(0.25+pow(max(dot(d,uFlashDir),0.0),3.0)*2.2)*(0.3+dens*0.7)*(0.55+0.9*m);
          float eg=uEye*smoothstep(1.6,0.2,rl); float sp=0.5+0.5*sin(atan(rv.y,rv.x+1e-5)*3.0+log(max(rl,0.05))*5.0-uTime*0.6+n*2.0); sp*=sp;
          col*=1.0-eg*(1.0-sp)*0.55;
          col+=uEyeCol*eg*(0.08+0.8*sp)*(0.25+0.55*(1.0-dens)+0.3*lit)+vec3(0.42,0.66,0.56)*uEye*exp(-rl*rl*5.0)*0.45;
          float hz=smoothstep(0.16,0.0,h), bnd=exp(-pow((h-0.03)/0.065,2.0))*(0.8+0.3*n); col=mix(col,uFogC*1.05+uBand*bnd+uFlash*vec3(0.12,0.14,0.18),hz*0.9); col+=uBand*bnd*0.3*(1.0-hz); float a=clamp(max(max(dens*0.96,eg*0.85)*smoothstep(-0.04,0.1,h),hz*0.97),0.0,1.0);
          gl_FragColor=vec4(max(col,vec3(0.0)),a);
        }`,
    }));
    m.renderOrder = -99; m.frustumCulled = false; m.onBeforeRender = () => { U.uTime.value = G.now % 3600; m.position.copy(camera.position); };
    return m;
  }

  // wind-tilted rain streaks in a box that follows the camera (drops stay world-fixed), and splash rings on the stones
  function rainLines(n) {
    n = Math.round(n * G.q.part); const box = [36, 26, 36], pos = new Float32Array(n * 6), seed = new Float32Array(n * 2), end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const x = vrand() * box[0], y = vrand() * box[1], z = vrand() * box[2], s = vrand(); for (let k = 0; k < 2; k++) { pos.set([x, y, z], i * 6 + k * 3); seed[i * 2 + k] = s; end[i * 2 + k] = k; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1)); g.boundingSphere = new THREE.Sphere(new V3(), 1e6);
    const U = { uTime: { value: 0 }, uVel: { value: new V3(-7, -30, -4.5) }, uBox: { value: new V3(...box) }, uCam: { value: new V3() }, uLen: { value: 0.028 }, uAlpha: { value: 0.3 }, uDens: { value: 0.6 }, uCol: { value: lin(0x7890a4) } };
    const m = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime,uLen,uDens; uniform vec3 uVel,uBox,uCam; attribute float aSeed; attribute float aEnd; varying float vA;
        void main(){ vec3 vel=uVel*(0.85+aSeed*0.3); vec3 p=position+vel*uTime; p=mod(p-uCam+uBox*0.5,uBox)-uBox*0.5+uCam;
          float fy=length(p.xz)<16.0?0.0:-2.6; vA=(1.0-aEnd*0.9)*smoothstep(fy,fy+0.3,p.y)*(0.45+aSeed*0.55)*step(fract(aSeed*7.31),uDens); p-=vel*uLen*aEnd*(0.4+aSeed*1.0);
          vec4 mv=modelViewMatrix*vec4(p,1.0); float dz=-mv.z; vA*=smoothstep(2.2,5.5,dz)*(1.0-smoothstep(8.0,17.0,dz)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: 'uniform vec3 uCol; uniform float uAlpha; varying float vA; void main(){ float a=clamp(vA*uAlpha,0.0,1.0); gl_FragColor=vec4(uCol*a,a); }',
    }));
    m.frustumCulled = false; m.renderOrder = 16; m.onBeforeRender = () => { U.uTime.value = G.now % 1000; U.uCam.value.copy(camera.position); };
    return m;
  }
  function splashes(n) {
    n = Math.round(n * G.q.part); const base = new THREE.PlaneGeometry(1, 1); base.rotateX(-PI / 2);
    const g = new THREE.InstancedBufferGeometry(); g.setIndex(base.index); g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv); g.instanceCount = n;
    const sd = new Float32Array(n); for (let i = 0; i < n; i++) sd[i] = vrand(); g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 1)); g.boundingSphere = new THREE.Sphere(new V3(), 1e5);
    const U = { uTime: { value: 0 }, uAmt: { value: 0.6 } };
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime; attribute float aSeed; varying vec2 vUv; varying float vA;
        float h(float x){ return fract(sin(x)*43758.5453); }
        void main(){ float per=0.4+aSeed*0.35; float t=uTime/per+aSeed*17.0; float cy=floor(t), ph=fract(t);
          float s1=h(cy*1.37+aSeed*78.233), s2=h(cy*2.91+aSeed*11.135); float r=sqrt(s1)*15.3, a=s2*6.2831;
          vec3 c=vec3(sin(a)*r,0.035,cos(a)*r); float sc=0.05+ph*0.42; vA=(1.0-ph)*(1.0-ph); vUv=uv;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(c+position*sc,1.0); }`,
      fragmentShader: 'uniform float uAmt; varying vec2 vUv; varying float vA; void main(){ float d=length(vUv-0.5)*2.0; float ring=smoothstep(0.62,0.85,d)*(1.0-smoothstep(0.85,1.0,d)); float a=ring*vA*uAmt; gl_FragColor=vec4(vec3(0.6,0.7,0.8)*a,a); }',
    }));
    m.frustumCulled = false; m.renderOrder = 9; m.onBeforeRender = () => { U.uTime.value = G.now % 1000; };
    return m;
  }

  // weathered sea-stack: noisy column, chipped top, darker wet base with algae, barnacle speckle
  function rockColumn(seed, h, r, o = {}) {
    const geo = new THREE.CylinderGeometry(r, r * 1.18, h, o.seg || 20, 16); geo.translate(0, h / 2, 0);
    const lean = o.carve ? 0.2 : 0.12, lx = (W.hash2(seed, 1, 3) - 0.5) * lean, lz = (W.hash2(seed, 2, 3) - 0.5) * lean;
    remap(geo, (x, y, z) => {
      const rr = Math.hypot(x, z), s = seed * 3.1, nn = f3(x * 0.9 + s, y * 0.42, z * 0.9, seed, 4), strata = Math.sin(y * 2.6 + n3(x, y * 0.3, z, seed + 4) * 5) * 0.035;
      let k = 1 + (nn - 0.5) * (o.carve ? 0.4 : 0.55) + strata; if (o.carve) k -= (Math.max(0, 1 - Math.abs(y - h * 0.3) / 0.16) + Math.max(0, 1 - Math.abs(y - h * 0.58) / 0.12)) * 0.07; const top = smooth((y - (h - 1.6)) / 1.6); k *= 1 - top * 0.1;
      let yy = y; if (y > h - 0.01) yy = h - n3(x * 1.6 + s, 0, z * 1.6, seed + 8) * 1.5 - (rr > 0.1 ? 0.25 : 0); else yy -= top * n3(x * 1.4 + s, 3, z * 1.4, seed + 8) * 0.9;
      return [x * k + yy * lx, yy, z * k + yy * lz];
    });
    const wet = lin(0x2c3639), alg = lin(0x2c3d24), dry = lin(0xaab3b0), barn = lin(0xb8b4a2), cap = lin(0xc4cbc6);
    return paint(geo, (x, y, z, nx, ny) => {
      const a = smooth((y - 0.2) / 2.6), sp = n3(x * 7, y * 7, z * 7, seed + 11), al = smooth(1 - Math.abs(y - 0.9) / 1.1) * smooth((n3(x * 2, y * 2, z * 2, seed + 13) - 0.35) * 4);
      const c = new THREE.Color().copy(wet).lerp(dry, 0.25 + a * 0.75); c.lerp(alg, al * 0.75); if (sp > 0.68 && y < 3) c.lerp(barn, smooth((sp - 0.68) * 9) * 0.8); if (ny > 0.45) c.lerp(cap, smooth((ny - 0.45) * 3) * 0.7); const strk = W.vnoise(Math.atan2(x, z) * 9 + seed, y * 0.25, seed + 30); if (strk > 0.62) c.multiplyScalar(1 - smooth((strk - 0.62) * 5) * 0.45); if (al < 0.3 && n3(x * 1.5, y * 0.6, z * 1.5, seed + 40) > 0.62 && y < 4) c.lerp(alg, 0.55); if (o.carve) { c.multiplyScalar(0.55 + 0.45 * smooth(y / 1.3)); if (ny > 0.4 && n3(x * 3, y, z * 3, seed + 50) > 0.45) c.lerp(lin(0x3e5a2a), 0.6); } return [c.r, c.g, c.b];
    });
  }
  // columnar basalt: a hex prism built from stacked drums (the gaps read as cross-joints), tilted and chipped at the top
  function basalt(seed, r, h, x0, z0) {
    const out = [], tx = (W.hash2(seed, 1, 7) - 0.5) * 0.55, tz = (W.hash2(seed, 2, 7) - 0.5) * 0.55, rot = W.hash2(seed, 3, 7) * 1.05;
    const wet = lin(0x3e484e), up = lin(0x6c787e), capC = lin(0x7c868a), alg = lin(0x2c3820);
    let y = 0, k = 0;
    while (y < h - 0.05) { const L = Math.min(h - y, 0.85 + W.hash2(seed, k, 9) * 0.9), last = y + L >= h - 0.05, y0 = y, seg = new THREE.CylinderGeometry(r, r * 1.03, L, 6, 4).toNonIndexed(); seg.translate(0, L / 2, 0);
      const jx = (W.hash2(seed, k, 11) - 0.5) * 0.03, jz = (W.hash2(seed, k, 12) - 0.5) * 0.03;
      remap(seg, (x, yy, z) => { const row = Math.round(yy / L * 4); let Y = row === 1 ? 0.07 : row === 3 ? L - 0.07 : yy, ins = row === 0 || row === 4 ? 0.95 : 1; if (row === 4 && last) Y = L + x * tx + z * tz - n3(x * 2.6 + seed, 0, z * 2.6, seed + 3) * 0.3 * smooth(Math.hypot(x, z) / r); const b = ins * (1 + (n3(x * 2 + seed, (yy + y0) * 0.7, z * 2, seed) - 0.5) * 0.07); return [x * b + jx, Y, z * b + jz]; });
      paint(seg, (x, yy, z, nx, ny) => { const Y = yy + y0, c = new THREE.Color().copy(wet).lerp(up, smooth((Y - 0.5) / 4.5) * 0.8); if (ny > 0.55) c.lerp(capC, 0.75); else if (ny < -0.55) c.multiplyScalar(0.35); else if (yy < 0.02 || (yy > L - 0.02 && !last)) c.multiplyScalar(0.4); const al = smooth(1 - Y / 1.4) * smooth((n3(x * 3, Y * 2, z * 3, seed + 5) - 0.4) * 5); c.lerp(alg, al * 0.7); c.multiplyScalar(0.8 + 0.35 * n3(x * 5, Y * 3, z * 5, seed + 9)); return [c.r, c.g, c.b]; });
      out.push(place3(seg, x0, y, z0, 0, rot + (W.hash2(seed, k, 13) - 0.5) * 0.06, 0, 1)); y += L; k++; }
    return out;
  }
  function boulder(seed, s) {
    const geo = new THREE.IcosahedronGeometry(1, 2); remap(geo, (x, y, z) => { const k = 0.7 + f3(x * 1.3 + seed, y * 1.3, z * 1.3, seed, 3) * 0.6; return [x * k, y * k * 0.7, z * k]; });
    const wet = lin(0x0a0f12), dry = lin(0x3a454c); return paint(geo, (x, y) => { const c = new THREE.Color().copy(wet).lerp(dry, sat(0.3 + y * 0.6)); return [c.r, c.g, c.b]; });
  }

  function build(b) {
    const g = G.world, S = b.state; S.pil = PIL.map((q) => Object.assign({}, q, { alive: true }));
    BAND.copy(STORM[0].band); UNDER.copy(STORM[0].under); CDARK.copy(STORM[0].cdark);
    const sky = W.sky({ top: 0x0b131b, horizon: 0x2a3a46, bottom: 0x020507, clouds: 0.7, cloudColor: 0x4e6070, cloudDark: 0x080d12, cloudScale: 1.0, cloudSpeed: 0.035, sunDir: MOON.toArray(), sunColor: 0xd8e6ff, sunSize: 0.075, sunGlow: 0.55, exp: 0.5 }); g.add(sky); S.sky = sky; W.env(sky, 0.75);
    S.clouds = cloudLayer(); g.add(S.clouds);
    scene.fog = new THREE.FogExp2(0x24323d, 0.0092); S.fog = scene.fog; S.clouds.material.uniforms.uFogC.value = S.fog.color;
    S.hemi = W.hemi(g, 0x6a88a0, 0x141e22, 1.7);
    S.sun = W.sun(g, { dir: [MOON.x, 0.85, MOON.z * 0.75], color: 0xb4cff0, intensity: 2.6, size: 26 });
    S.fillL = new THREE.DirectionalLight(0x8fb4dc, 0.9); S.fillL.position.set(15, 40, 42); g.add(S.fillL);
    S.rimL = new THREE.DirectionalLight(0xa8c8ff, 1.8); S.rimL.position.set(-10, 24, -60); g.add(S.rimL);
    S.flashL = new THREE.DirectionalLight(0xd6e6ff, 0); S.flashL.position.set(-30, 50, 20); g.add(S.flashL);
    S.water = sea(sky); g.add(S.water); S.glowBase = new THREE.Color(0);
    S.foam = foamRings(S.water.material.uniforms, 16); g.add(S.foam.mesh);
    // platform: old flagstones with puddles
    const st = floorTex(); for (const k in st) st[k].repeat.set(3, 3);
    const topG = new THREE.RingGeometry(0.001, R, 192, 12); remap(topG, (x, y, z) => { const r = Math.hypot(x, y), a = Math.atan2(x, y), e = smooth((r - (R - 0.9)) / 0.9); if (e <= 0) return [x, y, z]; const chip = Math.pow(n3(Math.sin(a) * 14, Math.cos(a) * 14, 3, 77), 1.5) * 0.75 * e, k = (r - chip) / Math.max(r, 1e-3); return [x * k, y * k, z - chip * 0.25]; });
    paint(topG, (x, y) => { const r = Math.hypot(x, y), e = smooth((r - (R - 2.4)) / 2.4), al = smooth((n3(x * 0.7, y * 0.7, 2, 91) - 0.45) * 4) * e; const c = new THREE.Color(1, 1, 1).multiplyScalar(1 - e * 0.5); c.lerp(lin(0x3a5a34), al * 0.45); return [c.r, c.g, c.b]; });
    const top = new THREE.Mesh(topG, new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(1.5, 1.55, 1.6), map: st.map, normalMap: st.normalMap, roughnessMap: st.roughnessMap, roughness: 1, metalness: 0.0, envMapIntensity: 1.6 })); puddlify(top.material, S); top.rotation.x = -PI / 2; top.receiveShadow = true; g.add(top);
    const rk = W.surface('rock', { size: 512, dark: 0x585858, light: 0xd8d8d8, strength: 4 }); for (const k in rk) rk[k].repeat.set(3, 3);
    const rock = new THREE.MeshStandardMaterial({ map: rk.map, normalMap: rk.normalMap, roughnessMap: rk.roughnessMap, vertexColors: true, roughness: 0.85, metalness: 0.0, envMapIntensity: 1.3, emissive: 0x111b21, emissiveIntensity: 1 });
    // drum: worn cliff under the platform, dark wet band and barnacles at the waterline
    const dg = new THREE.CylinderGeometry(R + 0.05, R + 2.8, 15, 128, 18, true); dg.translate(0, -7.5, 0);
    remap(dg, (x, y, z) => { const a = Math.atan2(x, z), rr = Math.hypot(x, z), nn = f3(Math.sin(a) * 6, y * 0.35, Math.cos(a) * 6, 21, 4); const k = (rr + (nn - 0.5) * 2.0 * smooth((-y) / 1.2) + Math.sin(y * 3 + nn * 6) * 0.08) / rr; const yy = y > -0.01 ? -0.04 - n3(Math.sin(a) * 9, 0, Math.cos(a) * 9, 5) * 0.28 : y; return [x * k, yy, z * k]; });
    paint(dg, (x, y, z) => { const wl = Math.abs(y - SEA_Y); const c = lin(0x6b777c).lerp(lin(0x0d1416), smooth(1 - (y + 0.6) / 2.4)); c.lerp(lin(0x1b281d), smooth(1 - wl / 1.3) * 0.6); if (n3(x * 3, y * 3, z * 3, 44) > 0.66 && wl < 2) c.lerp(lin(0xa7a493), 0.6); return [c.r, c.g, c.b]; });
    const drumRock = rock.clone(); drumRock.map = rk.map.clone(); drumRock.normalMap = rk.normalMap.clone(); drumRock.roughnessMap = rk.roughnessMap.clone(); for (const t of [drumRock.map, drumRock.normalMap, drumRock.roughnessMap]) { t.repeat.set(16, 2); t.needsUpdate = true; }
    const drum = new THREE.Mesh(dg, drumRock); drum.receiveShadow = true; g.add(drum);
    // carved runes, dim: they mark the edge but must never out-shine a telegraph
    S.rune = new THREE.MeshStandardMaterial({ color: 0x06100f, emissive: TEAL, emissiveIntensity: 0.45, roughness: 0.4 });
    for (const [r0, r1] of [[15.2, 15.38], [4.0, 4.12]]) { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 128), S.rune); m.rotation.x = -PI / 2; m.position.y = 0.015; g.add(m); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 2.0), S.rune); m.position.set(Math.sin(a) * 13.6, 0.012, Math.cos(a) * 13.6); m.rotation.y = a; g.add(m); }
    // four iron braziers on the rim: the one warm accent in the storm
    { const iron = [], fl = []; S.fireU = { uT: { value: 0 } }; S.fires = [];
      for (let i = 0; i < 4; i++) { const a = i * PI / 2, x = Math.sin(a) * 15.0, z = Math.cos(a) * 15.0;
        iron.push(place3(new THREE.LatheGeometry([new THREE.Vector2(0.05, 0), new THREE.Vector2(0.3, 0.02), new THREE.Vector2(0.44, 0.2), new THREE.Vector2(0.5, 0.36), new THREE.Vector2(0.44, 0.34), new THREE.Vector2(0.38, 0.22), new THREE.Vector2(0.05, 0.14)], 14), x, 0.95, z, 0, 0, 0, 1));
        for (let k = 0; k < 3; k++) { const la = k / 3 * TAU + a; iron.push(place3(new THREE.CylinderGeometry(0.035, 0.045, 1.05, 6), x + Math.sin(la) * 0.26, 0.5, z + Math.cos(la) * 0.26, Math.cos(la) * 0.25, 0, -Math.sin(la) * 0.25, 1)); }
        for (let k = 0; k < 2; k++) fl.push(place3(new THREE.PlaneGeometry(0.75, 1.15), x, 1.78, z, 0, a + k * PI / 2, 0, 1));
        const L = new THREE.PointLight(0xff8a3a, 8, 11, 2); L.position.set(x * 0.97, 1.9, z * 0.97); g.add(L); S.fires.push({ x, z, L, ph: i * 1.7 }); }
      const im = new THREE.Mesh(merge(iron), W.mat({ color: 0x2c2724, roughness: 0.5, metalness: 0.7 })); im.castShadow = true; g.add(im);
      const fm = new THREE.Mesh(merge(fl), new THREE.ShaderMaterial({ uniforms: S.fireU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; varying float vS; void main(){ vUv=uv; vS=position.x*0.37+position.z*0.53; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform float uT; varying vec2 vUv; varying float vS;
          float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); } float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
          void main(){ float y=vUv.y; float nz=n(vec2(vUv.x*5.0+vS,y*4.0-uT*4.0))*0.6+n(vec2(vUv.x*11.0-vS,y*8.0-uT*7.0))*0.4; float w=0.46*pow(max(1.0-y,0.0),0.8)+0.02;
            float d=abs(vUv.x-0.5+(nz-0.5)*0.25*y)/w; float a=clamp((1.0-d)*1.6-y*0.9+nz*0.5-0.25,0.0,1.0)*smoothstep(0.0,0.12,y);
            vec3 c=mix(vec3(0.9,0.22,0.04),vec3(1.0,0.72,0.32),smoothstep(0.3,0.9,a)); gl_FragColor=vec4(c*a*1.6,a); }` })); fm.renderOrder = 11; g.add(fm);
      for (const f of S.fires) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.36, 12), W.glow(0xff5a18, 1.4)); c.rotation.x = -PI / 2; c.position.set(f.x, 1.27, f.z); g.add(c); } }
    // worn rim: broken kerb stones and rubble where the platform meets the sea (one merged mesh)
    const rub = [];
    for (let i = 0; i < 70; i++) { const a = i / 70 * TAU + (W.hash2(i, 3, 1) - 0.5) * 0.08, rr = R + 0.35 + W.hash2(i, 5, 2) * 0.9, s = 0.35 + W.hash2(i, 7, 3) * 0.6; if (W.hash2(i, 9, 2) < 0.2) continue; rub.push(place3(boulder(i, s), Math.sin(a) * rr, -0.25 + W.hash2(i, 2, 8) * 0.25, Math.cos(a) * rr, 0, a, 0, s * 1.4, s, s)); }
    for (let i = 0; i < 26; i++) { const a = W.hash2(i, 11, 1) * TAU, rr = R + 1.6 + W.hash2(i, 12, 2) * 2.5, s = 0.6 + W.hash2(i, 13, 3) * 1.3; rub.push(place3(boulder(100 + i, s), Math.sin(a) * rr, SEA_Y - 0.2, Math.cos(a) * rr, 0, a, 0, s * 1.5, s * 1.4, s)); }
    const rubble = new THREE.Mesh(merge(rub), rock); rubble.castShadow = true; rubble.receiveShadow = true; g.add(rubble);
    // pillars: weathered sea stacks, each fades when it sits between camera and player
    const preMat = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true });
    const barnGeo = new THREE.CylinderGeometry(0.035, 0.085, 0.12, 7, 1, true); barnGeo.translate(0, 0.05, 0);
    const kelpCol = lin(0x141c0c), kelpTip = lin(0x2c3414);
    for (const [qi, q] of S.pil.entries()) {
      const grp = new THREE.Group(); grp.position.set(q.x, 0, q.z); const sd = qi * 17 + 3;
      const h = 6.6 + W.hash2(qi, 4, 4) * 1.6; q.h = h;
      const parts = basalt(sd, 0.6, h, 0, 0), a0 = W.hash2(qi, 0, 5) * TAU;
      for (let k = 0; k < 6; k++) { const a = a0 + k * TAU / 6 + (W.hash2(qi, k, 6) - 0.5) * 0.3, d = 1.0 + W.hash2(qi, k, 7) * 0.12, rr = 0.42 + W.hash2(qi, k, 8) * 0.12, hh = h * (k === 0 ? 0.88 : 0.22 + W.hash2(qi, k, 10) * 0.6); parts.push(...basalt(sd * 7 + k, rr, hh, Math.sin(a) * d, Math.cos(a) * d)); }
      for (let k = 0; k < 2; k++) { const a = a0 + 0.5 + k * 2.6, d = 1.5; parts.push(...basalt(sd * 13 + k, 0.36, 0.4 + W.hash2(qi, k, 14) * 0.8, Math.sin(a) * d, Math.cos(a) * d)); }
      parts.push(place3(boulder(sd + 9, 0.6), Math.sin(a0 + 3.6) * 1.55, 0.05, Math.cos(a0 + 3.6) * 1.55, 0, 1, 0, 0.6, 0.45, 0.55));
      // own camera fade: a depth-only prepass (after the telegraphs) then the colour pass at depthFunc LEQUAL, so a faded pillar is one clean silhouette
      const mat = stoneify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, envMapIntensity: 2.0, emissive: 0x0e171b, transparent: true, depthWrite: true }), { value: lin(0x4cb8c0).multiplyScalar(0.16) }); q.mat = mat;
      const cp0 = merge(parts), col = new THREE.Mesh(cp0, mat); col.castShadow = true; col.receiveShadow = true; col.renderOrder = 13; grp.add(col); q.fadeM = [col]; q.fa = 1;
      const pre = new THREE.Mesh(cp0, preMat); pre.renderOrder = 12; grp.add(pre); q.col = col; q.pre = pre;
      // barnacle clusters (small open cones) and kelp strands draped from the wet band
      const nb = 80, bm = new THREE.InstancedMesh(barnGeo.clone(), W.mat({ color: 0x3e3e38, roughness: 0.55, side: THREE.DoubleSide }), nb), M4 = new THREE.Matrix4(), cand = [], kelp = [];
      { const cp = cp0.attributes.position, cn = cp0.attributes.normal; for (let i = 0; i < cp.count; i++) if (cp.getY(i) < 1.8 && cp.getY(i) > 0.05 && Math.abs(cn.getY(i)) < 0.5 && Math.hypot(cp.getX(i), cp.getZ(i)) > 0.9) cand.push(i);
        let ci = 0; for (let c = 0; c < 18 && cand.length; c++) { const vi = cand[Math.floor(W.hash2(qi, c, 31) * cand.length)], nx = cn.getX(vi), ny = cn.getY(vi), nz = cn.getZ(vi), tx = -nz, tz = nx;
          for (let k = 0; k < 5 && ci < nb; k++, ci++) { const o1 = (W.hash2(qi * 9 + c, k, 34) - 0.5) * 0.32, o2 = (W.hash2(qi * 9 + c, k, 35) - 0.5) * 0.32, s = 0.3 + W.hash2(qi, ci, 33) * 0.45; _q.setFromUnitVectors(_e2.set(0, 1, 0), _sv.set(nx, ny, nz).normalize()); M4.compose(_pv.set(cp.getX(vi) + tx * o1 - nx * 0.03, cp.getY(vi) + o2, cp.getZ(vi) + tz * o1 - nz * 0.03), _q, _sv.set(s, s, s)); bm.setMatrixAt(ci, M4); } }
        bm.count = ci;
        for (let k = 0; k < 10 && cand.length; k++) { const vi = cand[Math.floor(W.hash2(qi, k, 41) * cand.length)], x0 = cp.getX(vi), y0 = Math.min(cp.getY(vi) + 0.6, 2.2), z0 = cp.getZ(vi), nx = cn.getX(vi), nz = cn.getZ(vi), L = 0.7 + W.hash2(qi, k, 42) * 1.1;
          const kg = new THREE.PlaneGeometry(0.13, L, 1, 6); kg.translate(0, -L / 2, 0);
          remap(kg, (x, y, z) => { const t = -y / L; return [x0 + nx * (0.05 + t * t * 0.35) + x * Math.abs(nz) + Math.sin(t * 5 + k) * 0.06, y0 + y, z0 + nz * (0.05 + t * t * 0.35) + x * Math.abs(nx) * (nz > 0 ? -1 : 1)]; });
          paint(kg, (x, y) => { const c = kelpCol.clone().lerp(kelpTip, sat((y0 - y) / L)); return [c.r, c.g, c.b]; }); kelp.push(kg); } }
      col.geometry.computeBoundingSphere(); bm.geometry.boundingSphere = col.geometry.boundingSphere.clone(); grp.add(bm); q.fadeM.push(bm);
      if (kelp.length) { const km = new THREE.Mesh(merge(kelp), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.6 })); km.geometry.boundingSphere = col.geometry.boundingSphere.clone(); grp.add(km); q.fadeM.push(km); }
      g.add(grp); q.mesh = grp;
    }
    // distant lighthouse + sea stacks
    const lh = new THREE.Group(); lh.position.set(-70, SEA_Y, -150); g.add(lh);
    const isle = new THREE.Mesh(paint(remap(new THREE.ConeGeometry(26, 22, 28, 6), (x, y, z) => { const k = 0.8 + f3(x * 0.08, y * 0.1, z * 0.08, 61, 4) * 0.45; return [x * k, y, z * k]; }), () => [0.25, 0.27, 0.28]), rock); isle.position.y = 4; lh.add(isle);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 5, 44, 16), W.mat({ color: 0x6a7076, roughness: 0.8 })); tower.position.y = 34; lh.add(tower);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 10), W.glow(0xfff0b0, 3.5)); lamp.position.y = 58; lh.add(lamp);
    S.beam = new THREE.Group(); S.beam.position.y = 58; lh.add(S.beam);
    const beamMat = new THREE.ShaderMaterial({ uniforms: { uC: { value: lin(0xffe8b0).multiplyScalar(0.08) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vL; void main(){ vL=uv.y; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uC; varying vec3 vN; varying vec3 vV; varying float vL; void main(){ float f=abs(dot(vN/max(length(vN),1e-4),vV/max(length(vV),1e-3))); float a=f*f*f*pow(clamp(vL,0.0,1.0),2.0)*smoothstep(0.0,0.12,1.0-vL+0.0); float fade=1.0-smoothstep(60.0,140.0,length(vV)); gl_FragColor=vec4(uC*a*(0.25+0.75*fade),1.0); }' });
    for (const sgn of [1, -1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(9, 150, 20, 1, true), beamMat); c.rotation.z = sgn * PI / 2; c.position.x = -sgn * 75; S.beam.add(c); }
    const stacks = [];
    for (let i = 0; i < 11; i++) { const a = i * 0.83 + 0.4, d = 80 + W.hash2(i, 2, 9) * 150, h = 10 + W.hash2(i, 5, 9) * 26, r = h * (0.16 + W.hash2(i, 6, 9) * 0.1);
      stacks.push(place3(rockColumn(300 + i, h / r, 1), Math.sin(a) * d, SEA_Y - 1.5, Math.cos(a) * d, 0.08 * Math.sin(i), i, 0.07 * Math.cos(i * 2), r));
      if (W.hash2(i, 8, 9) < 0.6) stacks.push(place3(rockColumn(320 + i, h * 0.5 / (r * 0.6), 1), Math.sin(a + 0.04) * (d + r * 2), SEA_Y - 1.5, Math.cos(a + 0.04) * (d + r * 2), 0.15, i * 2, -0.1, r * 0.6)); }
    const stackMat = hfogify(rock.clone(), { value: lin(0x9cb8d8).multiplyScalar(0.18) }, { value: new V3(SEA_Y, SEA_Y + 12, 0.85) }); g.add(new THREE.Mesh(merge(stacks), stackMat));
    // low sea mist drifting between the stacks (fog-coloured, so it thins them into layered silhouettes)
    S.mistU = { uT: { value: 0 }, uCol: { value: S.fog.color }, uAmt: { value: 0.5 } };
    for (const [y, sc] of [[SEA_Y + 2.5, 0.012], [SEA_Y + 8, 0.007]]) { const mg = new THREE.RingGeometry(34, 700, 96, 6); mg.rotateX(-PI / 2);
      const mm = new THREE.Mesh(mg, new THREE.ShaderMaterial({ uniforms: Object.assign({ uS: { value: sc } }, S.mistU), transparent: true, depthWrite: false, fog: false,
        vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
        fragmentShader: `uniform float uT,uS,uAmt; uniform vec3 uCol; varying vec3 vW;
          float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
          float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
          void main(){ vec2 q=vW.xz*uS+vec2(-uT*0.012,uT*0.004); float n=n2(q)*0.55+n2(q*2.3+3.1)*0.3+n2(q*5.1-uT*0.02)*0.15; float r=length(vW.xz);
            float a=smoothstep(0.42,0.8,n)*uAmt*smoothstep(34.0,70.0,r)*(1.0-smoothstep(450.0,700.0,r)); gl_FragColor=vec4(uCol*1.15,clamp(a,0.0,0.7)); }` }));
      mm.position.y = y; mm.renderOrder = 6; mm.frustumCulled = false; g.add(mm); }
    // weather: far rain field, near wind-tilted streaks, splash rings, spray
    S.rain = W.motes({ n: 2600, box: [70, 36, 70], color: 0x7088a0, size: 0.4, vel: [-7, -30, -4], streak: true, alpha: 0.2, center: [0, 16, 0], mult: 0.55 }); g.add(S.rain);
    S.rainN = rainLines(6800); g.add(S.rainN);
    S.splash = splashes(320); g.add(S.splash);
    S.spray = W.motes({ n: 900, box: [80, 5, 80], color: 0x8aa4b0, size: 0.14, vel: [-3.5, 0.3, -1.8], sway: 1.4, alpha: 0.25, center: [0, SEA_Y + 2.2, 0] }); g.add(S.spray); S.cloudSpd = 1;

    // ---- the serpent ----
    S.neckRoot = new THREE.Group(); g.add(S.neckRoot);
    const sc = bodyTex(); for (const k in sc) { sc[k].repeat.set(1, 2); sc[k].anisotropy = 4; }
    const lt = lumTex(); S.rimU = { value: lin(0xa8ccff).multiplyScalar(0.5) };
    S.bodyT = { value: 0 }; S.body = bodify(new THREE.MeshPhysicalMaterial({ map: sc.map, normalMap: sc.normalMap, roughnessMap: sc.roughnessMap, vertexColors: true, roughness: 0.55, metalness: 0.0, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.75, emissive: TEAL, emissiveMap: lt, emissiveIntensity: 1.1 }), S.rimU, S.bodyT);
    const hsc = scaleTex(); for (const k in hsc) hsc[k].repeat.set(1.4, 1.4);
    S.headMat = rimify(new THREE.MeshPhysicalMaterial({ map: hsc.map, normalMap: hsc.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), vertexColors: true, roughness: 0.55, metalness: 0.0, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.9 }), S.rimU);
    const rt = rayTex(); rt.repeat.set(1, 1);
    S.finMat = new THREE.MeshStandardMaterial({ color: 0x1a5258, roughness: 0.3, metalness: 0.05, side: THREE.DoubleSide, emissive: TEAL, emissiveMap: rt, emissiveIntensity: 0.9, transparent: true, opacity: 0.62, depthWrite: false });
    S.lum = S.finMat;
    const cD = lin(0x0a2628), cF = lin(0x14504c), cB = lin(0x56645e), cS = lin(0x8a8f84);
    const bodyCol = (u, c, s) => { const k = new THREE.Color().copy(cD).lerp(cF, smooth((1 - c) / 1.1)); k.lerp(cB, smooth((-c - 0.35) / 0.5)); const sc = n3(u * 40, c * 3, s * 3, 57); if (sc > 0.66) k.lerp(cS, smooth((sc - 0.66) * 7) * 0.7); return [k.r, k.g, k.b]; };
    const neckRad = (u) => lerp(2.8, 1.12, smooth(u / 0.82)) + 0.42 * Math.exp(-Math.pow((u - 0.9) / 0.06, 2)) ;
    S.neck = Tube(44, 22, neckRad, { mat: S.body, color: bodyCol, vLen: 1.1, shadow: true, wy: 0.92, fin: { from: 0.02, to: 0.97, h: 1.7, rays: 52, mat: S.finMat } }); S.neckRoot.add(S.neck.mesh);
    S.spine = []; for (let i = 0; i < S.neck.n; i++) S.spine.push(new V3());
    // head: sculpted skull with flaring cheeks, heavy jaw, two rows of teeth, gill frills, swept horns
    const head = S.head = new THREE.Group(); S.neckRoot.add(head);
    const skullF = (x, y, z) => { const zf = Math.max(z, 0), Z = z < 0 ? z * 1.8 : z * 3.4, w = z < 0 ? 1.42 - z * z * 0.3 : lerp(1.42, 0.62, Math.pow(zf, 1.3)), hy = y > 0 ? lerp(0.78, 0.34, Math.pow(zf, 0.8)) : lerp(0.48, 0.28, zf);
      let X = x * w, Y = y * hy; if (y > 0) { Y += 0.4 * Math.exp(-Math.pow(Math.abs(X) - 0.7, 2) * 10 - Math.pow(z - 0.12, 2) * 18) + 0.1 * Math.exp(-X * X * 8 - Math.pow(z + 0.3, 2) * 6); }
      Y += (f3(x * 3, y * 3, z * 3, 91, 3) - 0.5) * 0.08; return [X, Y, Z]; };
    const skullG = remap(new THREE.SphereGeometry(1, 40, 28), skullF);
    const hD = lin(0x0b2a2c), hB = lin(0x6f8a7c); paint(skullG, (x, y, z, nx, ny) => { const c = new THREE.Color().copy(hD).lerp(hB, smooth((-ny - 0.2) / 0.6)); return [c.r, c.g, c.b]; });
    const skull = new THREE.Mesh(skullG, S.headMat); skull.castShadow = true; head.add(skull);
    { const sp2 = skullG.attributes.position, sn = skullG.attributes.normal, nb = 70, im = new THREE.InstancedMesh(barnGeo, W.mat({ color: 0x8a8674, roughness: 0.45, side: THREE.DoubleSide }), nb), M4 = new THREE.Matrix4(), cand = [];
      for (let i = 0; i < sp2.count; i++) if (sp2.getZ(i) < -0.2 && sp2.getY(i) > -0.1) cand.push(i);
      let ci = 0; for (let c = 0; c < 14 && cand.length; c++) { const vi = cand[Math.floor(W.hash2(c, 3, 71) * cand.length)];
        for (let k = 0; k < 5 && ci < nb; k++, ci++) { const s = 0.9 + W.hash2(c, k, 72) * 1.1; _q.setFromUnitVectors(_e2.set(0, 1, 0), _sv.set(sn.getX(vi), sn.getY(vi), sn.getZ(vi)).normalize()); M4.compose(_pv.set(sp2.getX(vi) + (W.hash2(c, k, 73) - 0.5) * 0.3, sp2.getY(vi) + (W.hash2(c, k, 74) - 0.5) * 0.2, sp2.getZ(vi) + (W.hash2(c, k, 75) - 0.5) * 0.3), _q, _sv.set(s, s, s)); im.setMatrixAt(ci, M4); } }
      im.count = ci; head.add(im); }
    S.jaw = new THREE.Group(); S.jaw.position.set(0, -0.32, -0.55); head.add(S.jaw);
    const jawF = (x, y, z) => { const t = (z + 1) / 2, w = lerp(1.4, 0.6, Math.pow(t, 1.3)), Z = lerp(-0.4, 3.6, t), hy = y > 0 ? 0.16 : lerp(0.88, 0.42, t) * (1 + 0.25 * Math.exp(-Math.pow(t - 0.35, 2) * 20)); return [x * w, y * hy - 0.08, Z]; };
    const jawG = remap(new THREE.SphereGeometry(1, 32, 20), jawF);
    const mouth = lin(0x2a0c10); paint(jawG, (x, y, z, nx, ny) => { const c = ny > 0.55 ? mouth.clone() : new THREE.Color().copy(hD).lerp(hB, smooth((-ny + 0.2) / 0.6)); return [c.r, c.g, c.b]; });
    const jw = new THREE.Mesh(jawG, S.headMat); jw.castShadow = true; S.jaw.add(jw);
    const toothM = W.mat({ color: 0xd8d2bf, roughness: 0.32, metalness: 0.05 }), upT = [], loT = [];
    const tooth = (L, r) => new THREE.ConeGeometry(r, L, 6);
    for (const sx of [-1, 1]) for (let i = 0; i < 11; i++) {
      const z = 0.06 + i * 0.085, e = skullF(sx * Math.sqrt(Math.max(0, 1 - z * z - 0.01)) * 0.97, -0.1, z), fang = i === 7 || i === 3 ? 1.7 : 1;
      upT.push(place3(tooth(0.42 * fang * lerp(1, 0.7, z), 0.075 * fang), e[0] * 0.96, e[1] - 0.16 * fang, e[2], PI + 0.12, 0, -sx * 0.1, 1));
      upT.push(place3(tooth(0.26, 0.05), e[0] * 0.78, e[1] - 0.08, e[2] - 0.05, PI - 0.15, 0, sx * 0.1, 1));
      const t = i / 11, jz = lerp(-0.4, 3.6, 0.2 + t * 0.72), jwid = lerp(1.4, 0.6, Math.pow(0.2 + t * 0.72, 1.3)) * 0.93;
      loT.push(place3(tooth(0.36 * (i === 9 ? 1.8 : 1), 0.065 * (i === 9 ? 1.6 : 1)), sx * jwid, 0.12, jz, -0.12, 0, sx * 0.1, 1));
      loT.push(place3(tooth(0.22, 0.045), sx * jwid * 0.78, 0.08, jz - 0.05, 0.15, 0, -sx * 0.1, 1));
    }
    head.add(new THREE.Mesh(merge(upT), toothM)); S.jaw.add(new THREE.Mesh(merge(loT), toothM));
    S.maw = W.glow(TEAL, 0.2); const mw = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), S.maw); mw.scale.set(0.9, 0.3, 2.0); mw.position.set(0, -0.42, 1.2); head.add(mw);
    // eyes: amber iris with a vertical slit pupil and a wet glint, plus a small soft halo
    S.eyeU = { uG: { value: 1.3 }, uIris: { value: lin(0xffa828) } }; const browM = S.headMat, eyeG = new THREE.SphereGeometry(0.16, 24, 16);
    const haloTex = canvasTex(64, 64, (x, w, h) => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,190,90,0.9)'); gr.addColorStop(0.3, 'rgba(255,150,50,0.35)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
    S.haloMat = new THREE.SpriteMaterial({ map: haloTex, color: 0x8a6a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    for (const sx of [-1, 1]) { const em = new THREE.ShaderMaterial({ uniforms: { uS: { value: sx }, uG: S.eyeU.uG, uIris: S.eyeU.uIris },
        vertexShader: 'varying vec3 vP; varying vec3 vN; void main(){ vP=position/0.16; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform float uS,uG; uniform vec3 uIris; varying vec3 vP; varying vec3 vN;
          void main(){ vec3 ax=normalize(vec3(uS*0.8,0.12,0.6)), hz=normalize(cross(vec3(0.0,1.0,0.0),ax)); float fx=dot(vP,ax), px=dot(vP,hz), d=clamp(length(vec2(px,vP.y)),0.0,1.0); float front=smoothstep(-0.1,0.45,fx);
            vec3 c=mix(vec3(0.03,0.02,0.01),uIris*(0.35+0.9*d*d)+vec3(0.25,0.12,0.0)*(1.0-d),front);
            float pupil=smoothstep(0.2,0.1,abs(px)/max(1.0-0.75*vP.y*vP.y,0.05))*smoothstep(0.98,0.8,abs(vP.y))*front; c=mix(c,vec3(0.0),pupil*0.95);
            float ring=smoothstep(0.75,0.95,d)*front; c*=1.0-ring*0.5;
            vec3 n=vN/max(length(vN),1e-4); float gl=smoothstep(0.9,0.97,dot(n,normalize(vec3(-0.35,0.6,0.72)))); c=c*uG+vec3(0.85,0.9,1.0)*gl*0.7;
            gl_FragColor=vec4(max(c,vec3(0.0)),1.0); }` });
      const e = new THREE.Mesh(eyeG, em);
      const hs = new THREE.Sprite(S.haloMat); hs.scale.set(0.95, 0.95, 1); hs.position.set(sx * 1.2, 0.42, 0.55); head.add(hs); e.scale.set(0.7, 0.75, 1.4); e.position.set(sx * 1.12, 0.4, 0.5); head.add(e); const br = new THREE.Mesh(remap(new THREE.SphereGeometry(0.5, 12, 8), (x, y, z) => [x * 0.6, y * 0.35 + Math.max(0, z) * 0.2, z * 1.4]), browM); br.position.set(sx * 0.9, 0.72, 0.38); br.rotation.set(-0.25, sx * 0.25, sx * 0.3); head.add(br); }
    // horns and cheek spines: tapered static tubes
    const hornMat = W.mat({ color: 0x24302e, roughness: 0.45, metalness: 0.1 });
    const horn = (pts, r0) => { const t = Tube(pts.length, 10, (u) => r0 * (1 - u * 0.94), { mat: hornMat, vLen: 1 }); t.update(pts, new V3(0, 1, 0)); t.mesh.castShadow = true; t.mesh.frustumCulled = true; t.mesh.geometry.computeBoundingSphere(); return t.mesh; };
    const curve = (a, c, d, n) => { const out = []; for (let i = 0; i < n; i++) { const u = i / (n - 1), v = 1 - u; out.push(new V3(v * v * a[0] + 2 * v * u * c[0] + u * u * d[0], v * v * a[1] + 2 * v * u * c[1] + u * u * d[1], v * v * a[2] + 2 * v * u * c[2] + u * u * d[2])); } return out; };
    for (const sx of [-1, 1]) {
      head.add(horn(curve([sx * 0.6, 0.5, -0.2], [sx * 1.0, 0.85, -2.4], [sx * 1.45, 1.15, -4.4], 14), 0.3));
      head.add(horn(curve([sx * 0.95, 0.3, -0.7], [sx * 1.6, 0.4, -2.0], [sx * 2.1, 0.75, -3.1], 10), 0.17));
      head.add(horn(curve([sx * 0.5, -0.3, 2.5], [sx * 0.85, -1.1, 2.9], [sx * 1.1, -2.1, 2.3], 10), 0.06));
      for (let k = 0; k < 3; k++) head.add(horn(curve([sx * 1.05, -0.05 - k * 0.22, 0.6 - k * 0.45], [sx * 1.5, -0.1 - k * 0.2, -0.2 - k * 0.5], [sx * (1.8 - k * 0.1), 0.15 - k * 0.15, -0.9 - k * 0.5], 8), 0.09));
    }
    // gill frills: scalloped fans of glowing rays behind the jaw hinge
    const fanGeo = (nr, len, spread) => { const P = [], UV = [], I = []; P.push(0, 0, 0); UV.push(nr / 2, 0); for (let i = 0; i <= nr; i++) { const a = -spread / 2 + spread * i / nr, l = len * (0.75 + 0.25 * Math.sin(i / nr * PI)); P.push(0, Math.sin(a) * l, -Math.cos(a) * l); UV.push(i, 1); if (i < nr) { const am = a + spread / nr / 2, lm = l * 0.78; P.push(0, Math.sin(am) * lm, -Math.cos(am) * lm); UV.push(i + 0.5, 0.78); } }
      for (let i = 0; i < nr; i++) { const t0 = 1 + i * 2, m0 = t0 + 1, t1 = t0 + 2; I.push(0, t0, m0, 0, m0, t1); } const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); gg.setIndex(I); gg.computeVertexNormals(); return gg; };
    S.frills = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(fanGeo(7 - k, 2.4 - k * 0.55, 1.5 - k * 0.2), S.finMat); f.position.set(sx * (1.05 + k * 0.05), -0.1 - k * 0.32 + (k === 1 ? 0.62 : 0), -0.95 - k * 0.1); f.userData.base = [k === 1 ? -0.5 : 0.15 + k * 0.25, sx * (0.6 + k * 0.15), sx]; head.add(f); S.frills.push(f); }
    S.jaw.add(horn(curve([0, -0.75, 2.3], [0, -1.6, 2.5], [0.15, -2.4, 2.0], 10), 0.08));
    S.bioL = new THREE.PointLight(0x2ee0c0, 0, 22, 1.5); g.add(S.bioL);
    S.headL = new THREE.PointLight(TEAL, 8, 22, 1.6); S.headL.position.set(0, -0.4, 2); head.add(S.headL);
    // far coils of the body breaking the surface
    S.coils = new THREE.Group(); g.add(S.coils); S.coilFoam = []; S.coilInfo = [];
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + 0.7, d = 34 + (i % 3) * 15 + i * 2, rad = [6, 11, 8.5, 14, 7][i], th = [1.3, 2.1, 1.6, 2.4, 1.2][i], sink = [0.5, 2.5, 1.2, 4.5, 0][i], n = 24, pts = [], outs = [];
      for (let k = 0; k < n; k++) { const u = k / (n - 1), an = -0.15 + u * (PI + 0.3); pts.push(new V3(Math.cos(an) * rad, Math.sin(an) * rad * [1, 0.7, 1.15, 0.55, 1.3][i] - 1.2 - sink, Math.sin(u * PI * 2) * rad * 0.15)); outs.push(new V3(Math.cos(an), Math.sin(an), 0)); }
      const t = Tube(n, 16, (u) => th * (0.62 + 0.5 * Math.sin(u * PI)) * (1 + 0.08 * Math.sin(u * 23 + i)), { mat: S.body, color: bodyCol, vLen: rad * PI / 22, fin: { from: 0.1, to: 0.9, h: th * 0.6, rays: Math.round(rad * 1.5), mat: S.finMat } }); t.update(pts, outs);
      const holder = new THREE.Group(); holder.position.set(Math.sin(a) * d, SEA_Y - 0.6, Math.cos(a) * d); holder.rotation.y = a + 1.2; holder.add(t.mesh); S.coils.add(holder);
      holder.updateMatrixWorld(true); for (let k = 0; k < n - 1; k++) { const y0 = pts[k].y - 0.6, y1 = pts[k + 1].y - 0.6; if ((y0 < 0) !== (y1 < 0)) { const w = holder.localToWorld(pts[k].clone().lerp(pts[k + 1], sat(y0 / (y0 - y1)))); S.coilFoam.push([w.x, w.z, th * 2.0]); } }
      S.coilInfo.push({ holder, rad, th, pts });
    }
    // P3 coil around the platform: a closed tube rising out of the sea
    S.ring = new THREE.Group(); S.ring.position.y = -9; g.add(S.ring);
    S.ringTube = Tube(73, 16, () => 1.25, { mat: S.body, color: bodyCol, vLen: 5, shadow: false, fin: { from: 0, to: 1, h: 0.9, rays: 60, mat: S.finMat } }); S.ring.add(S.ringTube.mesh);
    S.ringPts = []; for (let i = 0; i < 73; i++) S.ringPts.push(new V3());
    S.ringUp = 0;
    // tidal wave meshes: leaning wall with a curling lip, translucent crest and foam streaks
    const WDISP = `uniform float uT,uH;
        vec3 disp(vec3 p, float y){ vec3 q=p; float c=smoothstep(0.6,1.0,y); q.z+=pow(max(y,0.0),2.2)*3.6+sin(p.x*0.35+uT*3.0)*0.5*y+c*2.4; float hv=0.66+0.24*sin(p.x*0.13+uT*1.3)+0.12*sin(p.x*0.41-uT*2.1); q.z+=(sin(p.x*0.9+uT*2.3)*0.3+sin(p.x*2.1-uT*3.1)*0.14)*y; q.z+=(hv-0.8)*3.0*y; q.y=p.y*uH*hv-c*c*3.4*uH*hv; return q; }`;
    const WNOISE = 'float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); } float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }\n float fb(vec2 p){ return n(p)*0.5+n(p*2.1+3.7)*0.3+n(p*4.3-1.3)*0.2; }';
    // tidal wave: a leaning wall of dark water, translucent near the curling lip, a ragged foam crest that shreds into spray, and a mist veil above
    S.waveMat = () => new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uH: { value: 1 }, uGlow: { value: new THREE.Color(0x000000) }, uL: { value: MOON.clone() }, uHor: { value: new THREE.Color() }, uTop: { value: new THREE.Color() } }]),
      vertexShader: WDISP + `
        varying vec2 vUv; varying vec3 vN; varying vec3 vWp;
        #include <fog_pars_vertex>
        void main(){ vUv=uv; vec3 p=disp(position,uv.y); vec3 px=disp(position+vec3(0.6,0.0,0.0),uv.y), py=disp(position+vec3(0.0,0.35,0.0),min(uv.y+0.04,1.0));
          vec3 n=cross(px-p,py-p); n=n/max(length(n),1e-4); vec3 wn=mat3(modelMatrix)*n; vN=wn/max(length(wn),1e-4); vec4 w=modelMatrix*vec4(p,1.0); vWp=w.xyz; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform vec3 uGlow,uL,uHor,uTop; varying vec2 vUv; varying vec3 vN; varying vec3 vWp;
        #include <fog_pars_fragment>
        ` + WNOISE + `
        void main(){ float y=vUv.y, t=uT;
          vec3 vd=cameraPosition-vWp; vec3 v=vd/max(length(vd),1e-3); vec3 nn=gl_FrontFacing?vN:-vN;
          vec2 sp=vec2(vUv.x*22.0,y*3.0-t*0.9); float e1=fb(sp), e2=fb(sp+vec2(0.15,0.0)), e3=fb(sp+vec2(0.0,0.15));
          vec2 rp=vec2(vUv.x*75.0,y*3.5+t*1.3); float r1=fb(rp), r2=fb(rp+vec2(0.25,0.0));
          nn=nn+vec3((e1-e2)*2.2+(r1-r2)*1.4,0.0,(e1-e3)*2.2); nn=nn/max(length(nn),1e-4);
          float ndv=clamp(abs(dot(nn,v)),0.0,1.0); float fr=0.04+0.96*pow(1.0-ndv,5.0); float lam=clamp(dot(nn,uL)*0.5+0.5,0.0,1.0);
          float lip=0.63+0.12*fb(vec2(vUv.x*9.0,t*0.5)); float thin=smoothstep(lip-0.45,lip-0.02,y);
          vec3 c=mix(vec3(0.006,0.04,0.05),vec3(0.03,0.16,0.165),smoothstep(0.05,0.8,y)*(0.75+0.5*e1))*(0.8+0.4*r1);
          float sss=thin*(0.4+0.6*(1.0-ndv)*(1.0-ndv))*(0.55+0.45*clamp(dot(-v,uL)+0.6,0.0,1.0));
          c+=vec3(0.05,0.36,0.32)*sss*(0.6+0.7*e1)*0.75;
          vec3 rd=reflect(-v,nn); float ry=clamp(rd.y,0.0,1.0); vec3 sky=mix(uHor*1.6,uTop*1.6+uHor*0.5,sqrt(ry)); c=mix(c,sky,clamp(fr,0.0,1.0)*0.7);
          float sl=max(dot(rd,uL),0.0); c+=vec3(0.75,0.85,1.0)*(pow(sl,60.0)*0.5+pow(sl,10.0)*0.06)*(0.4+0.6*lam); c+=uGlow*(0.4+e1*0.6);
          float fn=fb(vec2(vUv.x*26.0,y*5.0-t*1.5)), fn2=fb(vec2(vUv.x*63.0,y*9.0+t*0.8));
          float capE=lip+(fn-0.5)*0.22; float cap=smoothstep(capE-0.08,capE+0.03,y);
          float crestL=exp(-pow((y-capE+0.03)/0.05,2.0))*(0.8+0.2*fn2);
          float pour=fb(vec2(vUv.x*40.0,y*2.5+t*1.6)); float sheet=smoothstep(0.55,0.82,pour)*smoothstep(lip-0.38,lip,y)*(1.0-cap)*0.8;
          float streak=smoothstep(0.66,0.9,r1)*smoothstep(0.1,0.6,y)*0.45;
          float shred=smoothstep(0.3,0.6,fn2*0.7+fn*0.3+0.3-(y-capE)*2.4);
          float gr=length(vWp.xz)<16.3?0.0:${(SEA_Y + 0.15).toFixed(2)}; float foot=(1.0-smoothstep(0.02,0.16,abs(vWp.y-gr)))*(0.45+0.4*fn2);
          float capF=cap*shred*smoothstep(0.3,0.68,fn2*0.6+fn*0.4+0.15*(1.0-cap));
          float foam=clamp(max(max(capF,crestL),max(max(sheet,streak),foot)),0.0,1.0);
          c=mix(c,vec3(0.62,0.72,0.76)*(0.55+0.45*lam)+vec3(0.04,0.12,0.12)*sss,foam);
          float ex=smoothstep(0.0,0.06,vUv.x)*smoothstep(1.0,0.94,vUv.x);
          float a=max(smoothstep(0.0,0.16,y)*(mix(0.96,0.72,thin)*(1.0-cap)+cap*0.55*shred),foam*0.95*smoothstep(0.0,0.1,y))*ex;
          gl_FragColor=vec4(max(c,vec3(0.0)),clamp(a,0.0,1.0));
          #include <fog_fragment>
        }`,
      fog: true,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const mistMat = (WU) => new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: WU.uT, uH: WU.uH }]),
      vertexShader: WDISP + `
        varying vec2 vUv; varying vec3 vWp;
        #include <fog_pars_vertex>
        void main(){ vUv=uv; vec3 p=disp(vec3(position.x,8.5,0.0),0.97); p+=vec3(0.0,uv.y*5.5*uH,-1.2+uv.y*1.8); vec4 w=modelMatrix*vec4(p,1.0); vWp=w.xyz; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; varying vec2 vUv; varying vec3 vWp;
        #include <fog_pars_fragment>
        ` + WNOISE + `
        void main(){ float y=vUv.y; float m=fb(vec2(vUv.x*14.0-uT*0.4,y*2.0-uT*1.1))*0.65+fb(vec2(vUv.x*37.0,y*4.0-uT*1.8))*0.35;
          float ex=smoothstep(0.0,0.1,vUv.x)*smoothstep(1.0,0.9,vUv.x);
          float a=smoothstep(0.35,0.75,m+0.25*(1.0-y))*pow(max(1.0-y,0.0),1.6)*smoothstep(0.0,0.12,y)*ex*0.45;
          gl_FragColor=vec4(vec3(0.44,0.52,0.56),clamp(a,0.0,1.0));
          #include <fog_fragment>
        }`,
      fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    S.wavePool = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 8.5, 120, 28), S.waveMat()); m.geometry.translate(0, 4.25, 0); m.visible = false; m.renderOrder = 8; m.frustumCulled = false;
      const WU = m.material.uniforms; WU.uHor.value = S.water.material.uniforms.uHor.value; WU.uTop.value = S.sky.material.uniforms.uTop.value;
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(90, 1, 60, 4), mistMat(WU)); mist.geometry.translate(0, 0.5, 0); mist.material.uniforms.uT = WU.uT; mist.material.uniforms.uH = WU.uH; mist.renderOrder = 8; mist.frustumCulled = false; m.add(mist); g.add(m); S.wavePool.push(m); }
    // whirlpool water: a dark sinking eye with spiral foam arms, drawn under the zone telegraph (Hz renders at order 10)
    S.vort = []; for (let i = 0; i < 3; i++) { const vm = new THREE.Mesh(new THREE.CircleGeometry(3.4, 56), new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 0 } }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform float uT,uA; varying vec2 vP;
          float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); } float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
          void main(){ float r=length(vP), a=atan(vP.y,vP.x+1e-5); float sw=a*3.0+log(max(r,0.05))*4.2+uT*3.4; float sw2=a*5.0+log(max(r,0.05))*6.5+uT*4.6;
            float nz=n(vP*1.7+vec2(uT*0.3,-uT*0.2)); float arms=0.5+0.5*sin(sw+nz*2.2), fine=0.5+0.5*sin(sw2+nz*3.0);
            float edge=1.0-smoothstep(2.5,3.35,r), core=1.0-smoothstep(0.1,1.5,r);
            float foam=(smoothstep(0.62,0.92,arms)*0.8+smoothstep(0.75,0.95,fine)*0.35)*smoothstep(0.35,1.3,r)*edge*(0.6+0.4*nz);
            vec3 c=mix(vec3(0.0,0.01,0.014),vec3(0.62,0.72,0.75),clamp(foam,0.0,1.0))+vec3(0.01,0.05,0.05)*(1.0-core)*edge;
            float al=(edge*(0.42+0.5*core)+foam*0.75)*uA; gl_FragColor=vec4(c,clamp(al,0.0,0.9)); }` }));
      vm.rotation.x = -PI / 2; vm.position.y = 0.02; vm.renderOrder = 9; vm.visible = false; g.add(vm); S.vort.push(vm); }
    S.waves = []; S.ang = PI; S.sub = 0; S.subT = 0; S.headPos = new V3(0, 6, 4); S.headTgt = new V3(0, 6.2, 4.2); S.jawOpen = 0; S.lunge = 0; S.breach = null; S.boltT = 5; S.storm = 0; S.pulls = []; S.flash = 0; S.sprayT = 0;
    // tail for the pillar smash: tapered tube along y (base -9, tip +9) with a glowing fluke
    S.tail = new THREE.Group(); S.tail.visible = false; g.add(S.tail);
    { const pts = []; for (let i = 0; i < 26; i++) { const u = i / 25; pts.push(new V3(0, -9 + u * 18, Math.sin(u * PI) * 1.2)); } const t = Tube(26, 16, (u) => lerp(1.7, 0.25, Math.pow(u, 0.8)), { mat: S.body, color: bodyCol, vLen: 0.8, fin: { from: 0.2, to: 0.95, h: 0.7, rays: 18, mat: S.finMat } }); t.update(pts, new V3(0, 0, -1)); t.mesh.castShadow = true; S.tail.add(t.mesh);
      const fl = new THREE.Mesh(fanGeo(9, 3.2, 2.4), S.finMat); fl.position.set(0, 8.6, 0); fl.rotation.set(PI, 0, 0); S.tail.add(fl); }
    return {
      edge: 'fall', radius: R, spawn: { x: 0, z: 9 }, bossStart: { x: 0, z: -16.6, face: 0 },
      contains: (x, z) => x * x + z * z <= R * R,
      solid(p) { for (const q of S.pil) { if (!q.alive) continue; const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz); if (d < 2.0 && d > 0.001) { p.x = q.x + dx / d * 2.0; p.z = q.z + dz / d * 2.0; } } },
      bulletBounds(x, z) { if (x * x + z * z > 900) return false; for (const q of S.pil) if (q.alive && Math.hypot(x - q.x, z - q.z) < 1.7) return false; return true; },
    };
  }

  // ---- mechanics ----
  function place(b, ang) { const S = b.state; S.ang = ang; b.pos.set(Math.sin(ang) * 16.6, 0, Math.cos(ang) * 16.6); b.facing = ang + PI; }
  function spawnWave(b, dir, speed, dmg) {
    const S = b.state, m = S.wavePool.find((q) => !q.visible); if (!m) return;
    const w = { dir, s: -40, speed, mesh: m, dmg, hit: false }; m.visible = true; m.rotation.y = dir; S.waves.push(w); Sound.sfx('wave');
  }
  function marks(S, dir, dur) { for (const q of S.pil) if (q.alive) Hz.mark({ type: 'rect', x: q.x + Math.sin(dir) * 1.5, z: q.z + Math.cos(dir) * 1.5, dir, len: 4.7, w: 2.9 }, dur, { color: SAFE, alpha: 0.55 }); }
  function* tidal(b, o = {}) {
    const S = b.state, dir = wrapPi(S.ang + PI), time = o.time || 3.0, speed = o.speed || 15;
    S.pend = { dir, t: time, speed }; marks(S, dir, time + 2.4);
    yield* b.cast({ name: 'Tidal Wave', time, onTick: (k, cs) => { S.jawOpen = k; S.headTgt.set(0, 8 + k * 2, 2.5); if (S.pend) S.pend.t = time - cs.t; } });
    S.pend = null; S.headTgt.set(0, 6.2, 4.2); spawnWave(b, dir, speed, 360); Sound.sfx('roar', 0.9); roarSpray(S);
    if (o.second) { yield 1.5; const d2 = wrapPi(dir + (rnd() < 0.5 ? 1 : -1) * PI / 2); marks(S, d2, 3.6); S.pend = { dir: d2, t: 1.0, speed }; yield 1.0; S.pend = null; spawnWave(b, d2, speed, 360); }
    yield 2.6;
  }
  function* bite(b) {
    const S = b.state, a = b.angToPlayer(); b.autoFace = false; yield* b.turnTo(a, 0.25);
    S.headTgt.set(0, 7.5, 1.5); S.jawOpen = 1;
    Hz.cone(b.pos.x, b.pos.z, a, 1.15, 13.5, 1.25, 390, { name: 'Bite', kb: { dist: 5 }, onFire: () => { S.lunge = 1; Sound.sfx('crit', 1, 0.6); FX.shake(0.5); const x = b.pos.x + Math.sin(a) * 8, z = b.pos.z + Math.cos(a) * 8; FX.burst(x, 0.5, z, { n: 34, color: 0x8fd0dc, mult: 0.8, speed: [4, 12], life: [0.3, 0.8], size: [0.25, 0.7], up: 4, grav: 12 }); FX.ring(x, z, { r0: 0.3, r1: 5, color: 0x9fd8e0, dur: 0.45 }); } });
    yield 1.25; S.headTgt.set(0, 1.6, 9.5); yield 0.45; S.headTgt.set(0, 6.2, 4.2); S.jawOpen = 0; b.autoFace = true; yield 0.9;
  }
  // forked lightning: tapered main channel (thick core + thin overlay) with side branches
  const _ba = new V3(), _bb = new V3();
  function bolt(a, b, w, jag, mult) {
    if (G.headless) return; FX.lightning(a, b, { color: 0xbcd6ff, width: w * 2.4, jag, dur: 0.32, mult: mult * 0.22, sparks: false }); FX.lightning(a, b, { color: 0xeaf4ff, width: w, jag, dur: 0.3, mult, sparks: false });
    const L = a.distanceTo(b); for (let i = 0; i < 3; i++) { const t0 = 0.2 + i * 0.2 + vrand() * 0.1; _ba.lerpVectors(a, b, t0); _bb.set(_ba.x + (vrand() - 0.5) * L * 0.35, _ba.y - L * (0.12 + vrand() * 0.15), _ba.z + (vrand() - 0.5) * L * 0.35); FX.lightning(_ba.clone(), _bb.clone(), { color: 0xd6e8ff, width: w * (0.45 - i * 0.1), jag: jag * 0.5, dur: 0.22, mult: mult * 0.7, sparks: false }); }
  }
  function strike(x, z, puddle) {
    Hz.circle(x, z, 2.8, 1.0, 280, { name: 'Stormcall', color: BOLT, quiet: true, onFire: () => {
      bolt(new V3(x + (vrand() - 0.5) * 8, 60, z + (vrand() - 0.5) * 8), new V3(x, 0, z), 0.2, 3, 1.3); { const SB = G.boss && G.boss.state; if (SB) SB.flash = Math.max(SB.flash || 0, 0.7); } FX.burst(x, 0.2, z, { n: 14, smoke: true, color: 0x6a7378, color2: 0x2a3034, speed: [0.5, 2], life: [0.9, 1.8], size: [0.6, 1.4], up: 2.5, alpha: 0.4, drag: 1.5 }); FX.pillar(x, z, { r: 0.7, h: 30, color: 0xbfe0ff, dur: 0.25, mult: 0.45 });
      FX.burst(x, 0.3, z, { n: 20, color: 0xa8d4f0, mult: 0.9, speed: [3, 9], life: [0.2, 0.6], size: [0.15, 0.4], up: 3 }); FX.ring(x, z, { r0: 0.2, r1: 3.4, color: 0xbfe0ff, dur: 0.35 }); FX.light(x, 3, z, 0xa8c8ff, 7, 0.25, 9); Sound.sfx('thunder', 0.8); FX.flash(0xdff0ff, 0.07, 5);
      if (puddle) Hz.zone({ type: 'circle', x, z, r: 2.8 }, 7, 50, { name: 'Charged water', color: CHARGED, delay: 0.3, every: 0.5 });
    } });
  }
  function* lightning(b, n, puddle) { yield* b.cast({ name: 'Stormcall', time: 0.9 }); for (let i = 0; i < n; i++) { const p = G.player; strike(p.pos.x, p.pos.z, puddle && i % 2 === 0); yield 0.72; } yield 0.8; }
  function* deluge(b, dur = 6) {
    const S = b.state; S.headTgt.set(0, 7.5, 3); const r = yield* b.cast({ name: 'Deluge', time: 3.2, interruptible: true, onTick: (k) => { S.jawOpen = k; S.maw.color.setHex(TEAL).multiplyScalar(k * 2.5); } });
    S.maw.color.setHex(TEAL).multiplyScalar(0.2);
    if (r !== 'done') { S.jawOpen = 0; S.headTgt.set(0, 4.5, 4.2); yield 1.4; S.headTgt.set(0, 6.2, 4.2); return; }
    let t = 0, k = 0; S.maw.color.setHex(TEAL).multiplyScalar(2.2);
    while (t < dur) { const a = b.angToPlayer(), hx = b.pos.x + Math.sin(b.facing) * 4.5, hz = b.pos.z + Math.cos(b.facing) * 4.5; for (const off of (k % 2 ? [-0.36, 0, 0.36] : [-0.18, 0.18])) Bul.fire({ x: hx, z: hz, y: 1.2, dir: a + off, speed: 11.5, dmg: 95, color: 0x60e0ff, r: 0.42, life: 4 }); Sound.sfx('bolt', 0.4, 0.7); k++; t += 0.34; yield 0.34; }
    S.jawOpen = 0; S.maw.color.setHex(TEAL).multiplyScalar(0.2); S.headTgt.set(0, 6.2, 4.2); yield 0.8;
  }
  function whirlpool(b, dur = 13) {
    const S = b.state, a = rnd(TAU), r = rnd(2, 7), x = Math.sin(a) * r, z = Math.cos(a) * r;
    const pull = { x, z, t: dur + 1.2, arm: 1.2 }; S.pulls.push(pull); Sound.sfx('wave', 0.6, 1.5);
    Hz.zone({ type: 'circle', x, z, r: 2.6 }, dur, 90, { name: 'Whirlpool', color: VORTEX, delay: 1.2, every: 0.5 });
  }
  function* breach(b) {
    const S = b.state; S.headTgt.set(0, 3, 2); b.autoFace = false;
    yield* b.cast({ name: 'Sound', time: 0.9 }); S.subT = 1; b.targetable = false; Sound.sfx('wave', 0.8, 1.6); yield 1.6;
    const p = G.player, dir = rnd(TAU), ox = p.pos.x - Math.sin(dir) * 22, oz = p.pos.z - Math.cos(dir) * 22;
    Hz.rect(ox, oz, dir, 44, 6.4, 1.7, 460, { name: 'Breach', kb: { dir: dir + PI / 2 * (rnd() < 0.5 ? 1 : -1), dist: 5 }, quiet: true, onFire: () => { S.breach = { x: ox, z: oz, dir, t: 0 }; Sound.sfx('roar', 1, 1.2); Sound.sfx('bigboom', 0.8); FX.shake(0.9); for (let i = 0; i < 6; i++) FX.burst(ox + Math.sin(dir) * (8 + i * 6), 0.5, oz + Math.cos(dir) * (8 + i * 6), { n: 30, color: 0x9fd4de, color2: 0x3f8494, mult: 0.85, speed: [4, 13], life: [0.4, 1.1], size: [0.3, 0.9], up: 6, grav: 14 }); } });
    yield 1.7; yield 1.3;
    let na; do { na = rnd(TAU); } while (Math.abs(angDiff(na, S.ang)) < 1.3); place(b, na); S.breach = null; S.subT = 0; b.targetable = true; b.autoFace = true; S.headTgt.set(0, 6.2, 4.2);
    FX.burst(b.pos.x, 0, b.pos.z, { n: 60, color: 0x9fd4de, color2: 0x3f8494, mult: 0.85, speed: [5, 16], life: [0.5, 1.3], size: [0.4, 1.1], up: 10, grav: 14 }); Sound.sfx('roar', 0.8); yield 1.6;
  }
  function* smashPillar(b) {
    const S = b.state, p = G.player; let q = null, bd = -1; for (const c of S.pil) if (c.alive) { const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z); if (d > bd) { bd = d; q = c; } } if (!q) return;
    Hz.circle(q.x, q.z, 4.6, 2.3, 520, { name: 'Tail', tag: 'fight', kb: { dist: 6 }, onFire: () => { q.alive = false; q.mesh.visible = false; FX.explode(q.x, 2, q.z, 0x8a9aa0, 6, 0xd0d8dc); FX.burst(q.x, 3, q.z, { n: 50, smoke: true, color: 0x39434a, color2: 0x14181a, speed: [3, 12], grav: 14, life: [0.8, 1.8], size: [0.5, 1.4] }); FX.burst(q.x, 2, q.z, { n: 40, color: 0x4a565c, color2: 0x20282c, speed: [5, 14], grav: 22, life: [0.6, 1.4], size: [0.3, 0.8], up: 6 }); Sound.sfx('bigboom'); FX.shake(1.1); } });
    const T = S.tail, a = angTo(0, 0, q.x, q.z); T.visible = true; T.position.set(Math.sin(a) * 19, -6, Math.cos(a) * 19); T.rotation.set(0, a, 0);
    yield* W.tween(1.9, (k) => { T.position.y = -6 + k * 12; T.rotation.x = -0.25 * k; });
    yield* W.tween(0.38, (k) => { T.rotation.x = -0.25 - k * 1.5; T.position.y = 6 - k * 5; }); yield 0.8;
    yield* W.tween(1.2, (k) => { T.position.y = 1 - k * 16; }); T.visible = false;
  }
  const STORM = [
    { amp: 1.3, cloud: 0.7, glow: 0x000000, rune: 0.45, cov: 0.62, eye: 0, top: 0x0b131b, hor: 0x24323d, sun: 2.6, hemi: 0x6a88a0, rain: 0.4, dens: 0.55, far: 0.22, band: 0x2a3a44, under: 0x0a1a1e, cdark: 0x10181f, spl: 0.6, fog: 0.0092, fogC: 0x24323d, foam: 0.9, chop: 0.75, wind: -7, spd: 1, haze: 0.25 },
    { amp: 1.9, cloud: 0.8, glow: 0x011a18, rune: 0.65, cov: 0.72, eye: 0, top: 0x09111a, hor: 0x283842, sun: 2.7, hemi: 0x6a8aa6, rain: 0.44, dens: 0.8, far: 0.27, band: 0x3a5664, under: 0x0c2228, cdark: 0x0a1016, spl: 0.9, fog: 0.0102, fogC: 0x22303a, foam: 1.25, chop: 0.88, wind: -12, spd: 3.0, haze: 0.45 },
    { amp: 2.2, cloud: 0.85, glow: 0x03342c, rune: 0.9, cov: 0.82, eye: 1, top: 0x08120f, hor: 0x273c3c, sun: 2.6, hemi: 0x5e9088, rain: 0.58, dens: 1.0, far: 0.4, band: 0x22383a, under: 0x0b2824, cdark: 0x0c1716, spl: 1.45, fog: 0.0112, fogC: 0x1e302e, foam: 1.9, chop: 1.0, wind: -17, spd: 3.6, haze: 0.7 },
  ].map((o) => Object.assign({}, o, { glow: lin(o.glow), top: lin(o.top), hor: lin(o.hor), hemi: lin(o.hemi), fogC: lin(o.fogC), band: lin(o.band), under: lin(o.under), cdark: lin(o.cdark) }));
  const POST = [null, { bloom: 0.48, contrast: 1.14, exposure: 1.37, tint: [0.92, 1.0, 1.08], sat: 0.9, vig: 1.05 }, { bloom: 0.55, contrast: 1.16, exposure: 1.36, tint: [0.84, 1.08, 1.03], sat: 0.92, vig: 1.22 }];
  function stormSnap(S) { const U = S.sky.material.uniforms, WU = S.water.material.uniforms, CU = S.clouds.material.uniforms;
    return { amp: WU.uAmp.value, cloud: U.uCloud.value, glow: S.glowBase.clone(), rune: S.rune.emissiveIntensity, cov: CU.uCov.value, eye: CU.uEye.value, top: U.uTop.value.clone(), hor: U.uHor.value.clone(), sun: S.sun.intensity, hemi: S.hemi.color.clone(), rain: S.rainN.material.uniforms.uAlpha.value, far: S.rain.material.uniforms.uAlpha.value, spl: S.splash.material.uniforms.uAmt.value, fog: S.fog.density, fogC: S.fog.color.clone(), foam: WU.uFoam.value, chop: WU.uChop.value, wind: S.rainN.material.uniforms.uVel.value.x, spd: S.cloudSpd, haze: S.spray.material.uniforms.uAlpha.value, dens: S.rainN.material.uniforms.uDens.value, band: BAND.clone(), under: UNDER.clone(), cdark: CDARK.clone() }; }
  function stormSet(S, a, t, k) { const U = S.sky.material.uniforms, WU = S.water.material.uniforms, CU = S.clouds.material.uniforms;
    WU.uAmp.value = lerp(a.amp, t.amp, k); U.uCloud.value = lerp(a.cloud, t.cloud, k); W.colorLerp(S.glowBase, a.glow, t.glow, k); S.rune.emissiveIntensity = lerp(a.rune, t.rune, k); CU.uCov.value = lerp(a.cov, t.cov, k); CU.uEye.value = lerp(a.eye, t.eye, k);
    W.colorLerp(U.uTop.value, a.top, t.top, k); W.colorLerp(U.uHor.value, a.hor, t.hor, k); WU.uHor.value.copy(U.uHor.value); S.sun.intensity = lerp(a.sun, t.sun, k); W.colorLerp(S.hemi.color, a.hemi, t.hemi, k);
    S.rainN.material.uniforms.uAlpha.value = lerp(a.rain, t.rain, k); S.rain.material.uniforms.uAlpha.value = lerp(a.far, t.far, k); S.splash.material.uniforms.uAmt.value = lerp(a.spl, t.spl, k); S.fog.density = lerp(a.fog, t.fog, k); W.colorLerp(S.fog.color, a.fogC, t.fogC, k);
    WU.uFoam.value = lerp(a.foam, t.foam, k); WU.uChop.value = lerp(a.chop, t.chop, k); const wx = lerp(a.wind, t.wind, k); S.rainN.material.uniforms.uVel.value.x = wx; S.rain.material.uniforms.uVel.value.x = wx; S.spray.material.uniforms.uVel.value.x = wx * 0.5; S.cloudSpd = lerp(a.spd, t.spd, k); S.spray.material.uniforms.uAlpha.value = lerp(a.haze, t.haze, k); if (S.mistU) S.mistU.uAmt.value = 0.45 + lerp(a.haze, t.haze, k) * 0.6; S.rainN.material.uniforms.uDens.value = lerp(a.dens, t.dens, k); W.colorLerp(BAND, a.band, t.band, k); W.colorLerp(UNDER, a.under, t.under, k); W.colorLerp(CDARK, a.cdark, t.cdark, k); }
  function* storm(b, lvl) { const S = b.state; S.storm = lvl; const a = stormSnap(S), t = STORM[lvl]; yield* W.tween(3, (k) => stormSet(S, a, t, k)); }
  // instant cumulative state for ?phase=N starts (Game.start calls skipTo of each phase up to the start phase, before its enter)
  function skipStorm(b, lvl) { const S = b.state; S.storm = lvl; stormSet(S, stormSnap(S), STORM[lvl], 1); if (!G.headless) Post.set(Object.assign({}, b.def.post, POST[lvl])); }
  function roarSpray(S) { if (G.headless) return; S.head.getWorldDirection(_d); const h = S.head.position; for (let i = 0; i < 3; i++) FX.burst(h.x + _d.x * 3, h.y - 0.3, h.z + _d.z * 3, { n: 18, color: 0xa8d0dc, color2: 0x5f98a4, mult: 0.8, dir: [_d.x, _d.y - 0.15, _d.z], spread: 0.35, speed: [8, 18], grav: 9, life: [0.4, 1.0], size: [0.2, 0.6], alpha: 0.7 }); }


  G.bosses.push({
    id: 'leviathan', name: 'THALASSOR', title: 'The Storm Tide', hint: 'A drowning', color: '#35e0d0', telegraph: DANGER,
    hp: 24000, radius: 3.3, aimY: 5, enrage: 420,
    post: { bloom: 0.42, threshold: 0.92, radius: 0.55, exposure: 1.2, vig: 0.95, sat: 0.92, tint: [0.94, 1.0, 1.05], contrast: 1.08 },
    music: { bpm: 104, root: 40, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 3, 0, 0, 6, 4],
      layers: [
        { v: 'sub', pat: '0.......0.......', oct: -1, len: 8, vol: 0.22 }, { v: 'pad', pat: '0...............', oct: 1, len: 16, vol: 0.12 },
        { v: 'taiko', pat: 'x.....x...x.....', vol: 0.3 },
        { v: 'bass', from: 1, pat: '0.0.0.0.0.0.0.2.', oct: 0, len: 2, vol: 0.13 }, { v: 'taiko', from: 1, pat: '..x...x...x.x.x.', vol: 0.22 },
        { v: 'brass', from: 1, pat: ['0.......4.......', '2.......1.......'], oct: 1, len: 8, vol: 0.11 },
        { v: 'arp', from: 2, pat: '0247024702470247', oct: 2, len: 1, vol: 0.06 }, { v: 'snare', from: 2, pat: '....x.......x...', vol: 0.2 }, { v: 'hat', from: 2, pat: 'x.x.x.x.x.x.x.x.', vol: 0.1 },
        { v: 'brass', from: 2, pat: ['7.....6.4.......', '4.....2.0.......'], oct: 2, len: 4, vol: 0.09 },
      ] },
    build,
    *intro(b) { const S = b.state; S.subT = 1; S.sub = 1; yield* Cam.shot([14, 2.5, 20], [0, 3, -6], [6, 5, 16], [0, 5, -14], 2.2, 52); S.subT = 0; Sound.sfx('roar'); FX.burst(0, 0, -16.6, { n: 70, color: 0x9fd4de, color2: 0x3f8494, mult: 0.85, speed: [5, 16], life: [0.5, 1.3], size: [0.4, 1.1], up: 10, grav: 14 }); yield* Cam.shot([6, 5, 16], [0, 5, -14], [-5, 3.2, 6], [0, 7, -15], 2.8, 52); },
    phases: [
      { at: 1, *run(b) {
        b.autoFace = true; b.turnRate = 3.5; yield 1.5;
        while (true) {
          yield* tidal(b, { time: 3.2 }); yield* bite(b); yield* lightning(b, 3); yield* deluge(b, 5); yield* bite(b); yield* lightning(b, 3);
        }
      } },
      { at: 0.67, skipTo(b) { skipStorm(b, 1); if (b.hp < b.maxHp * 0.34) { const S = b.state; let q = null, bd = -1; for (const c of S.pil) if (c.alive) { const d = Math.hypot(c.x, c.z - 9); if (d > bd) { bd = d; q = c; } } if (q) { q.alive = false; q.mesh.visible = false; } } },
        *enter(b) { Sound.sfx('roar'); roarSpray(b.state); FX.shake(0.7); Co.start(storm(b, 1), 'fight'); Co.start(Post.lerpTo(POST[1], 3), 'fight'); yield* smashPillar(b); },
        *run(b) {
          while (true) {
            whirlpool(b); yield 1.5; yield* tidal(b, { time: 2.9, speed: 16 }); yield* bite(b);
            yield* breach(b); yield* lightning(b, 4, true); yield* deluge(b, 6);
            whirlpool(b); yield* bite(b); yield* tidal(b, { time: 2.9, speed: 16 }); yield* lightning(b, 3, true); yield* breach(b);
          }
        } },
      { at: 0.34, skipTo(b) { skipStorm(b, 2); }, *enter(b) {
        const S = b.state; Sound.sfx('roar', 1, 0.8); roarSpray(S); FX.shake(1); FX.flash(TEAL, 0.18, 1.2); Co.start(storm(b, 2), 'fight'); Co.start(Post.lerpTo(POST[2], 3), 'fight'); S.ringUp = 1;
        yield* smashPillar(b);
        Hz.zone({ type: 'donut', x: 0, z: 0, r0: 12.6, r1: 16.4 }, 99999, 130, { name: 'Coil', tag: 'fight', color: COIL, delay: 2.5, every: 0.6 }); yield 2.2;
      }, *run(b) {
        while (true) {
          yield* tidal(b, { time: 2.7, speed: 17, second: true }); yield* bite(b);
          whirlpool(b, 11); yield* lightning(b, 4, true); yield* deluge(b, 6);
          yield* breach(b); yield* tidal(b, { time: 2.7, speed: 17, second: true }); yield* bite(b); yield* lightning(b, 3, true);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      // waves
      for (let i = S.waves.length - 1; i >= 0; i--) {
        const w = S.waves[i], ps = w.s; w.s += w.speed * dt;
        const pa = along(p.pos.x, p.pos.z, w.dir);
        if (!w.hit && p.alive && ps <= pa && w.s > pa && Math.hypot(p.pos.x, p.pos.z) < R + 1) { w.hit = true; if (!sheltered(S, p.pos.x, p.pos.z, w.dir)) { p.hurt(w.dmg, { blockable: true, kb: { dir: w.dir, dist: 13 }, src: { name: 'Tidal Wave' } }); FX.burst(p.pos.x, 1, p.pos.z, { n: 50, color: 0xa8d8e4, mult: 0.85, speed: [3, 12], life: [0.4, 1], up: 3 }); } else FX.num(p.aim(), 'SHELTERED', 'note'); }
        const m = w.mesh, wh = smooth((w.s + 40) / 14) * (1 - smooth((w.s - 20) / 16)) * (1 + S.storm * 0.12); m.position.set(Math.sin(w.dir) * w.s, SEA_Y - 0.4, Math.cos(w.dir) * w.s); m.material.uniforms.uT.value = t; m.material.uniforms.uH.value = wh;
        if (!G.headless && Math.abs(w.s) < R + 8) { const sdx = Math.sin(w.dir), sdz = Math.cos(w.dir); for (let k = 0; k < 4; k++) { const l = (vrand() - 0.5) * 40, top = k < 2; FX.burst(sdx * (w.s + (top ? 4.5 : 0.5)) + sdz * l, top ? SEA_Y - 0.4 + 7.2 * wh : 0.4 + vrand() * 3, sdz * (w.s + (top ? 4.5 : 0.5)) - sdx * l, { n: top ? 2 : 1, color: 0xc4e0e8, mult: 1.0, dir: [sdx, top ? 0.25 : 0.5, sdz], spread: 0.6, speed: [4, 14], grav: 12, life: [0.4, 0.9], size: [0.2, 0.7] }); } }
        if (w.s > 38) { m.visible = false; S.waves.splice(i, 1); }
      }
      // whirlpool pull
      for (let i = S.pulls.length - 1; i >= 0; i--) { const q = S.pulls[i]; q.t -= dt; q.arm -= dt; if (q.t <= 0 || G.state !== 'fight') { S.pulls.splice(i, 1); continue; } if (q.arm > 0) continue; const dx = q.x - p.pos.x, dz = q.z - p.pos.z, d = Math.hypot(dx, dz); if (d > 0.3 && d < 15 && p.grounded) { const f = 2.7; p.push.x += dx / d * f; p.push.z += dz / d * f; } if (!G.headless && vrand() < dt * 50) { const a = vrand() * TAU, r = 2 + vrand() * 8; FX.burst(q.x + Math.sin(a) * r, 0.15, q.z + Math.cos(a) * r, { n: 1, color: 0x8fe0f0, dir: [Math.sin(a + 2.2), 0.05, Math.cos(a + 2.2)], spread: 0.1, speed: [5, 9], life: [0.4, 0.8], size: [0.12, 0.3] }); } }
      // submerge
      S.sub = damp(S.sub, S.subT, 3.5, dt);
      for (let i = 0; i < S.vort.length; i++) { const vm = S.vort[i], q = S.pulls[i]; vm.visible = !!q && !G.headless; if (!q) continue; vm.position.x = q.x; vm.position.z = q.z; vm.material.uniforms.uT.value = t % 1000; vm.material.uniforms.uA.value = sat(1 - q.arm / 1.2) * sat(q.t * 1.5); vm.rotation.z = 0; }
      if (G.headless) return;
      // ambient lightning lights the arena and the clouds
      S.boltT -= dt; if (S.boltT <= 0) { S.boltT = [rnd2(3.5, 7), rnd2(2.5, 5), rnd2(1.5, 3.5)][S.storm]; S.flash = 1; const a = vrand() * TAU, d = 60 + vrand() * 120; S.clouds.material.uniforms.uFlashDir.value.set(Math.sin(a) * d, 90, Math.cos(a) * d).normalize(); S.flashL.position.set(Math.sin(a) * 40, 60, Math.cos(a) * 40); if (S.storm > 0 || vrand() < 0.6) bolt(new V3(Math.sin(a) * d, 110, Math.cos(a) * d), new V3(Math.sin(a) * d + (vrand() - 0.5) * 30, SEA_Y, Math.cos(a) * d), 0.8, 9, 2.2); FX.flash(0xdfe8ff, 0.04 + S.storm * 0.03, 6); Sound.sfx('thunder', 0.35 + vrand() * 0.3, 0.8); }
      S.flash = Math.max(0, S.flash - dt * 4) * (vrand() > 0.2 ? 1 : 0.5); S.sky.material.uniforms.uFlash.value = S.flash * 0.6; S.clouds.material.uniforms.uFlash.value = S.flash; S.water.material.uniforms.uFlash.value = S.flash * 0.5; S.flashL.intensity = S.flash * [10, 13, 16][S.storm]; S.clouds.material.uniforms.uScroll.value += dt * S.cloudSpd; S.mistU.uT.value += dt * S.cloudSpd; S.hemi.intensity = 2.0 + S.flash * (0.8 + S.storm * 0.6);
      S.beam.rotation.y = t * 0.5; S.pudU.uT.value = t % 1000;
      { const ea = S.eyeA = S.eyeA === undefined ? S.ang : S.eyeA + angDiff(S.eyeA, S.ang) * Math.min(1, dt * 0.25); S.clouds.material.uniforms.uEyeDir.value.set(Math.sin(ea) * 0.985, 0.17, Math.cos(ea) * 0.985); }
      // p1+: distant sheet lightning flickering inside the low cloud mass, with a faint cold rim light
      if (S.storm > 0 && S.flash < 0.05 && vrand() < dt * 0.8 * S.storm) { const a = S.ang + (vrand() - 0.5) * 2.4, d = 140; S.flash = 0.3 + vrand() * 0.25; S.clouds.material.uniforms.uFlashDir.value.set(Math.sin(a) * d, 30, Math.cos(a) * d).normalize(); S.flashL.position.set(Math.sin(a) * 40, 30, Math.cos(a) * 40); }
      { const c = camera.position, sx = p.pos.x - c.x, sy = p.pos.y + 1.2 - c.y, sz = p.pos.z - c.z, sl2 = Math.max(sx * sx + sy * sy + sz * sz, 1e-6);
        for (const q of S.pil) { if (!q.fadeM) continue; const cy = q.h * 0.45, k = clamp(((q.x - c.x) * sx + (cy - c.y) * sy + (q.z - c.z) * sz) / sl2, 0, 0.97), dx = c.x + sx * k - q.x, dy = c.y + sy * k - cy, dz = c.z + sz * k - q.z;
          const hit = k < 0.96 && dx * dx + dz * dz < 2.6 * 2.6 && Math.abs(dy) < q.h * 0.6; q.fa = damp(q.fa, hit ? 0.16 : 1, 8, dt); q.mat.opacity = q.fa; for (let i = 1; i < q.fadeM.length; i++) q.fadeM[i].visible = q.fa > 0.9; q.cd = (q.x - c.x) ** 2 + (q.z - c.z) ** 2; }
        // far pillars first, each one's depth prepass right before its own colour pass, so a faded pillar never hides the pillars behind it
        const ord = S.pil.slice().sort((a, b2) => b2.cd - a.cd); ord.forEach((q, i) => { q.pre.renderOrder = 11 + i * 2; q.col.renderOrder = 12 + i * 2; }); }
      // braziers flicker, embers drift off in the wind
      S.fireU.uT.value = t % 1000; for (const f of S.fires) { f.L.intensity = 7.5 + Math.sin(t * 13 + f.ph) * 1.5 + Math.sin(t * 29 + f.ph * 2) * 1 + (vrand() < 0.04 ? -2 : 0); if (vrand() < dt * 6) FX.burst(f.x, 1.9, f.z, { n: 1, color: 0xffa040, dir: [-0.4, 1, -0.25], spread: 0.4, speed: [1.5, 3.5], grav: -1, life: [0.6, 1.2], size: [0.05, 0.1] }); }
      // water streaming off the far coils
      for (let k = 0; k < 3; k++) if (vrand() < dt * 9) { const ci = S.coilInfo[Math.floor(vrand() * S.coilInfo.length)], pp = ci.pts[1 + Math.floor(vrand() * (ci.pts.length - 2))]; if (pp.y < 0.6 + ci.th) continue; const w = ci.holder.localToWorld(_d.set(pp.x + (vrand() - 0.5) * ci.th, pp.y - ci.th * 0.8, pp.z + (vrand() - 0.5) * ci.th)); FX.burst(w.x, w.y, w.z, { n: 2, color: 0x9cbcc8, mult: 0.8, dir: [0, -1, 0], spread: 0.1, speed: [0.5, 2], grav: 14, life: [0.5, 0.9], size: [0.12, 0.3], alpha: 0.6 }); }
      // wind-driven spray sheets across the platform (P2+), splashes where the coils break the surface
      if (S.storm > 0 && vrand() < dt * (S.storm * 2.2)) { const z0 = (vrand() - 0.5) * 26, wx = S.rainN.material.uniforms.uVel.value.x; FX.burst(R + 1, 0.6 + vrand() * 1.5, z0, { n: 26, color: 0xcfe2ea, color2: 0x8fb0bc, dir: [-1, 0.08, -0.35], spread: 0.25, speed: [-wx * 0.6, -wx * 1.1], grav: 1.5, life: [1.2, 2.2], size: [0.2, 0.55], radius: 3, alpha: 0.3, drag: 0.3 }); }
      if (vrand() < dt * 3) { const c = S.coilFoam[Math.floor(vrand() * S.coilFoam.length)]; if (c) FX.burst(c[0], SEA_Y + 0.3, c[1], { n: 10, color: 0xb4d4dc, color2: 0x6f98a4, mult: 0.75, dir: [0, 1, 0], spread: 0.6, speed: [2, 6], grav: 10, life: [0.5, 1.0], size: [0.3, 0.8], radius: c[2] * 0.6, alpha: 0.6 }); }
      // waves breaking on the platform edge
      S.sprayT -= dt; while (S.sprayT <= 0) { S.sprayT += [0.13, 0.09, 0.06][S.storm]; const a = vrand() * TAU, rr = R + 0.7; FX.burst(Math.sin(a) * rr, SEA_Y + 1.2 + vrand() * 1.2, Math.cos(a) * rr, { n: 5 + S.storm * 2, color: 0xb4d4dc, color2: 0x6f98a4, mult: 0.75, dir: [Math.sin(a) * 0.35, 1, Math.cos(a) * 0.35], spread: 0.45, speed: [3, 7 + S.storm * 2], grav: 10, life: [0.5, 1.1], size: [0.25, 0.8], alpha: 0.7 }); }
      // neck: bezier from the sea to the head, in boss-local space
      const f = b.facing, sf = Math.sin(f), cf = Math.cos(f);
      S.lunge = Math.max(0, S.lunge - dt * 3); S.jaw.rotation.x = damp(S.jaw.rotation.x, 0.08 + S.jawOpen * 0.75 + Math.sin(t * 1.3) * 0.03, 8, dt);
      for (const fr of S.frills) { const u = fr.userData.base; fr.rotation.set(u[0] + Math.sin(t * 2.1 + u[2]) * 0.06, u[1] + u[2] * S.jawOpen * 0.35 + Math.sin(t * 1.7) * 0.05, 0); }
      const sway = Math.sin(t * 0.9) * 1.1, bob = Math.sin(t * 1.4) * 0.4;
      S.headPos.x = damp(S.headPos.x, S.headTgt.x + sway, 4, dt); S.headPos.y = damp(S.headPos.y, S.headTgt.y + bob, 5, dt); S.headPos.z = damp(S.headPos.z, S.headTgt.z, 6, dt);
      const subY = -S.sub * 16;
      const toW = (lx, ly, lz, out) => out.set(b.pos.x + sf * lz + cf * lx, ly + subY, b.pos.z + cf * lz - sf * lx);
      const P0 = toW(0, -9, -3.5, _a), P1 = toW(sway * -1.5, 9.5 + S.headPos.y * 0.35, -3.5, _b), P2 = toW(S.headPos.x, S.headPos.y, S.headPos.z, _c);
      const sp = S.spine, n = sp.length;
      if (S.breach) {
        const br = S.breach; br.t += dt; const k = br.t / 0.9, yA = (u) => Math.sin(clamp(u / 44, 0, 1) * PI) * 8 - 3.2;
        for (let i = 0; i < n; i++) { const u = k * 60 - 6 - (n - 1 - i) / (n - 1) * 40; sp[i].set(br.x + Math.sin(br.dir) * u, yA(u), br.z + Math.cos(br.dir) * u); }
        const u0 = k * 60 - 6; S.head.position.copy(sp[n - 1]); _d.set(br.x + Math.sin(br.dir) * (u0 + 1), yA(u0 + 1), br.z + Math.cos(br.dir) * (u0 + 1)); S.head.lookAt(_d);
        _ref.set(0, 1, 0);
      } else {
        for (let i = 0; i < n; i++) { const u = i / (n - 1), v = 1 - u; sp[i].set(v * v * P0.x + 2 * v * u * P1.x + u * u * P2.x, v * v * P0.y + 2 * v * u * P1.y + u * u * P2.y, v * v * P0.z + 2 * v * u * P1.z + u * u * P2.z); }
        S.head.position.copy(P2); const look = toW(S.headPos.x * 0.5, Math.max(0.5, S.headPos.y - 3.2 - S.jawOpen * 0.5), S.headPos.z + 8, _d); S.head.lookAt(look);
        _ref.set(-sf * 0.8, 0.6, -cf * 0.8);
      }
      S.neck.update(sp, _ref);
      if (vrand() < dt * 14) { const i = 2 + Math.floor(vrand() * (n - 6)), q = sp[i]; if (q.y > SEA_Y + 1 && q.y < SEA_Y + 9) FX.burst(q.x + (vrand() - 0.5) * 2, q.y - 1, q.z + (vrand() - 0.5) * 2, { n: 2, color: 0x9cbcc8, mult: 0.8, dir: [0, -1, 0], spread: 0.15, speed: [0.5, 2], grav: 14, life: [0.4, 0.8], size: [0.1, 0.25], alpha: 0.6 }); }
      // foam rings: neck crossings of the waterline, the coils, the tail
      { const A = S.foam.attr.array; A.fill(0); let fi = 0; for (let i = 0; i < n - 1 && fi < 2; i++) { const y0 = sp[i].y - SEA_Y, y1 = sp[i + 1].y - SEA_Y; if ((y0 < 0) !== (y1 < 0)) { const k = y0 / Math.min(-1e-4, y0 - y1) * -1, x = lerp(sp[i].x, sp[i + 1].x, sat(Math.abs(y0) / Math.max(Math.abs(y0 - y1), 1e-4))), z = lerp(sp[i].z, sp[i + 1].z, sat(Math.abs(y0) / Math.max(Math.abs(y0 - y1), 1e-4))); A.set([x, z, 6.5, 1], fi * 4); fi++; } }
        let o = 2; for (const c of S.coilFoam) { A.set([c[0], c[1], c[2], 0.8], o * 4); o++; }
        if (S.tail.visible && S.tail.position.y > -8) { A.set([S.tail.position.x, S.tail.position.z, 5, 1], o * 4); } S.foam.attr.needsUpdate = true;
        S.water.material.uniforms.uGlow.value.copy(S.glowBase).multiplyScalar(0.55 + 0.45 * Math.sin(t * 2.2)); S.bioL.position.set(b.pos.x * 0.85, SEA_Y + 2.5, b.pos.z * 0.85); S.bioL.intensity = S.storm === 2 ? 5 + 3 * Math.sin(t * 2.2) : S.storm === 1 ? 2 : 0; }
      S.headL.intensity = 6 + S.jawOpen * 14 + S.storm * 3; S.eyeU.uG.value = 1.25 + S.storm * 0.3 + S.jawOpen * 0.3;
      S.bodyT.value = t % 1000; S.body.emissiveIntensity = [0.85, 1.05, 1.35][S.storm]; S.finMat.emissiveIntensity = [0.7, 0.9, 1.15][S.storm] + Math.sin(t * 2.2 + 1) * 0.15;
      // P3 coil around the platform
      S.ring.position.y = damp(S.ring.position.y, S.ringUp ? 0 : -9, 0.8, dt);
      if (S.ringUp || S.ring.position.y > -8.5) { const rp = S.ringPts, m = rp.length - 1; for (let i = 0; i <= m; i++) { const a = (i % m) / m * TAU + t * 0.22, r = 18.4 + Math.sin(a * 3 + t) * 0.6; rp[i].set(Math.sin(a) * r, Math.sin(a * 4 - t * 1.6) * 1.3 - 0.6, Math.cos(a) * r); } S.ringTube.update(rp, _up); }
    },
    danger(b, x, z) {
      const S = b.state; let best = Infinity;
      for (const w of S.waves) { if (w.hit) continue; const tt = (along(x, z, w.dir) - w.s) / w.speed; if (tt > -0.05 && !sheltered(S, x, z, w.dir)) best = Math.min(best, Math.max(0, tt)); }
      for (const q of S.pulls) if (Math.hypot(x - q.x, z - q.z) < 5) best = Math.min(best, Math.max(0, q.arm));
      if (S.pend && !sheltered(S, x, z, S.pend.dir)) best = Math.min(best, S.pend.t + (along(x, z, S.pend.dir) + 40) / S.pend.speed);
      return best;
    },
    bot(b, p) {
      const S = b.state, w = S.waves.find((q) => !q.hit) || S.pend; if (!w) return {};
      let q = null, bd = 1e9; for (const c of S.pil) if (c.alive) { const sx = c.x + Math.sin(w.dir) * 3.2, sz = c.z + Math.cos(w.dir) * 3.2, d = Math.hypot(sx - p.pos.x, sz - p.pos.z) + (Hz.threat(sx, sz) < 4 ? 30 : 0); if (d < bd) { bd = d; q = { x: sx, z: sz }; } }
      return q ? { x: q.x, z: q.z, w: 6 } : {};
    },
  });
  const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _ref = new V3(), _up = new V3(0, 1, 0), rnd2 = (a, b) => a + vrand() * (b - a);
})();
