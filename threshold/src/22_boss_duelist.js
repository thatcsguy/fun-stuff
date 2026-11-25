// DOOR III: ISSEN, the Last Petal. One swordsman on a lake at dusk. Fast, precise, and he remembers every cut.
(() => {
  const R = 15, ROSE = 0xff4a6a, PALE = 0xffd8e0, BLUE = 0x8ab4ff, BLUE_T = 0x7aa8ff, ICE = 0xd8ecff; // BLUE: the reflection (nightmare only)
  const edgeLen = (x, z, a) => { let d = 0; while (d < 40) { const nx = x + Math.sin(a) * (d + 0.5), nz = z + Math.cos(a) * (d + 0.5); if (nx * nx + nz * nz > 14.2 * 14.2) break; d += 0.5; } return d; };

  // ---------------------------------------------------------------- local look helpers (cosmetic only)
  const GN = `float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
    float fb(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*n2(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
    uniform vec2 uGap; float gapK(vec2 d){ return 1.0-0.88*smoothstep(0.9,0.995,dot(d,uGap)); }
    float eFar(vec2 d){ return gapK(d)*0.012+gapK(d)*0.2*pow(clamp(fb(d*2.0+vec2(3.1,1.7)),0.0,1.0),2.2); }
    float eNear(vec2 d){ return gapK(d)*0.004+gapK(d)*0.11*pow(clamp(fb(d*4.0+vec2(7.3,2.9)),0.0,1.0),2.6); }`;
  // indexed-geometry merge (position/normal/uv)
  function mergeGeos(list) {
    let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = new Uint32Array(ni); let ov = 0, oi = 0;
    for (const g of list) {
      const c = g.attributes.position.count; P.set(g.attributes.position.array, ov * 3); N.set(g.attributes.normal.array, ov * 3); U.set(g.attributes.uv.array, ov * 2);
      if (g.index) { const ia = g.index.array; for (let k = 0; k < ia.length; k++) I[oi + k] = ia[k] + ov; oi += ia.length; } else { for (let k = 0; k < c; k++) I[oi + k] = ov + k; oi += c; }
      ov += c; g.dispose();
    }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(P, 3)); m.setAttribute('normal', new THREE.BufferAttribute(N, 3)); m.setAttribute('uv', new THREE.BufferAttribute(U, 2)); m.setIndex(new THREE.BufferAttribute(I, 1)); return m;
  }
  // tapering, gently twisted tube along a point list (bark)
  function taperTube(pts, r0, r1, seg, rad, ph) {
    const curve = new THREE.CatmullRomCurve3(pts), g = new THREE.TubeGeometry(curve, seg, 1, rad, false), P = g.attributes.position, c = new V3();
    for (let i = 0; i <= seg; i++) {
      const u = i / seg; curve.getPointAt(u, c); const rr = lerp(r0, r1, Math.pow(u, 0.8)) * (u < 0.1 ? 1 + (0.1 - u) * 4 : 1);
      for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j, a = j / rad * TAU, m = rr * (1 + 0.1 * Math.sin(a * 3 + u * 9 + ph)); P.setXYZ(k, c.x + (P.getX(k) - c.x) * m, c.y + (P.getY(k) - c.y) * m, c.z + (P.getZ(k) - c.z) * m); }
    }
    g.computeVertexNormals(); return g;
  }
  // a strip of quads: f(u in 0..1 along, s in -1..1 across) -> [x,y,z]; uv = (u, (s+1)/2)
  function stripGeo(n, f) {
    const pos = new Float32Array((n + 1) * 6), uv = new Float32Array((n + 1) * 4), idx = [];
    for (let i = 0; i <= n; i++) { const u = i / n; for (let k = 0; k < 2; k++) { const p = f(u, k ? 1 : -1), o = (i * 2 + k); pos[o * 3] = p[0]; pos[o * 3 + 1] = p[1]; pos[o * 3 + 2] = p[2]; uv[o * 2] = u; uv[o * 2 + 1] = k; } }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // vertex-colour gradient along y (robe pale at the shoulders, charcoal-indigo toward the hem)
  function gradY(geo, y0, y1, c0, c1) { const P = geo.attributes.position, A = new Float32Array(P.count * 3), a = new THREE.Color(c0), b = new THREE.Color(c1), c = new THREE.Color(); for (let i = 0; i < P.count; i++) { const k = smooth(sat((P.getY(i) - y0) / (y1 - y0))); c.copy(a).lerp(b, k); A[i * 3] = c.r; A[i * 3 + 1] = c.g; A[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(A, 3)); return geo; }
  function inst(parent, geo, mat, list, shadow = false) { // list of [x,y,z,ry,sx,sy,sz]
    const m = new THREE.InstancedMesh(geo, mat, list.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3(), p = new V3();
    list.forEach((o, i) => { e.set(o[7] || 0, o[3] || 0, o[8] || 0); q.setFromEuler(e); s.set(o[4] || 1, o[5] || o[4] || 1, o[6] || o[4] || 1); p.set(o[0], o[1], o[2]); M.compose(p, q, s); m.setMatrixAt(i, M); });
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  }
  // a cloth ribbon whose verts are rebuilt every frame in its parent's space
  function ribbon(parent, mat, o) {
    const n = o.n || 12, g = stripGeo(n, () => [0, 0, 0]), m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.castShadow = true; parent.add(m);
    return Object.assign({ m, g, n, pos: g.attributes.position.array }, o);
  }
  function ribbonUpdate(r, t, speed) {
    const tr = r.trail + Math.min(speed, 8) * (r.speedK || 0), L = Math.hypot(r.drop, tr) || 1, cy = r.drop / L, cz = tr / L, P = r.pos;
    for (let i = 0; i <= r.n; i++) {
      const s = i / r.n, d = s * r.len, wv = Math.sin(t * r.f - s * r.k + r.ph) * r.amp * s, wi = r.w * (1 - s * (r.taper || 0)) * 0.5;
      const x = r.x + wv, y = r.y - d * cy + Math.sin(t * r.f * 1.3 - s * r.k * 0.7 + r.ph) * r.amp * 0.4 * s, z = r.z - d * cz;
      const o = i * 6; P[o] = x - wi; P[o + 1] = y; P[o + 2] = z; P[o + 3] = x + wi; P[o + 4] = y; P[o + 5] = z;
    }
    r.g.attributes.position.needsUpdate = true; r.g.computeVertexNormals();
  }
  function blossomTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), rr = mulberry(77);
    for (let i = 0; i < 95; i++) {
      const a = rr() * TAU, d = Math.sqrt(rr()) * 100, cx = 128 + Math.cos(a) * d, cy = 128 + Math.sin(a) * d * 0.85, s = 7 + rr() * 10, w = rr();
      if (d > 70 + 30 * Math.sin(a * 5 + 1.3)) continue;
      const col = `rgb(255,${Math.round(150 + w * 95)},${Math.round(180 + w * 65)})`, rot = rr() * TAU;
      for (let k = 0; k < 5; k++) { const pa = rot + k / 5 * TAU; x.fillStyle = col; x.beginPath(); x.ellipse(cx + Math.cos(pa) * s * 0.55, cy + Math.sin(pa) * s * 0.55, s * 0.55, s * 0.36, pa, 0, TAU); x.fill(); }
      x.fillStyle = 'rgb(205,70,110)'; x.beginPath(); x.arc(cx, cy, s * 0.2, 0, TAU); x.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function crackTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), rr = mulberry(31); x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#fff'; x.lineWidth = 2.2; x.lineCap = 'round';
    for (const sx of [44, 84]) for (let k = 0; k < 3; k++) { let px = sx, py = 58; x.beginPath(); x.moveTo(px, py); const a0 = (k - 1) * 0.9 + (sx < 64 ? PI : 0) * 0 + (k === 1 ? -PI / 2 : PI / 2) * (rr() < 0.5 ? 1 : 1); for (let j = 0; j < 6; j++) { const a = a0 + (rr() - 0.5) * 1.4; px += Math.cos(a) * 7; py += Math.sin(a) * 7; x.lineTo(px, py); } x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // sword-cut ribbon shader: hot core, rose falloff, ink lead edge while sweeping, noise dissolve after
  const CUT_VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
  const CUT_FS = `uniform float uT,uSeed,uSweep,uMode; uniform vec3 uCol,uHot,uLead; varying vec2 vUv;
    float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
    void main(){
      float u=vUv.x, v=abs(vUv.y*2.0-1.0);
      float head=clamp(uT/max(uSweep,1e-3),0.0,1.0); if(u>head) discard;
      float fade=clamp((uT-uSweep)/max(1.0-uSweep,1e-3),0.0,1.0);
      float rag=n2(vec2(u*70.0+uSeed,vUv.y*2.0+uSeed))*0.55+n2(vec2(u*240.0+uSeed,uSeed))*0.45;
      if(uMode>0.5){
        float edge=0.97-rag*0.22-(1.0-smoothstep(0.0,0.012,u))*0.6; if(v>edge) discard;
        float ink=smoothstep(edge-0.1,edge-0.03,v);
        float streak=0.0;
        float line=exp(-v*v*500.0);
        float tip=1.0-smoothstep(0.0,0.03,head-u);
        vec3 col=mix(uCol,vec3(0.06,0.0,0.03),ink)+uHot*line;
        float a=max(max(ink*0.32,streak),max(line*0.7,tip*0.3))*(1.0-fade);
        gl_FragColor=vec4(max(col,vec3(0.0)),clamp(a,0.0,1.0)); return;
      }
      float tw=pow(clamp(sin(3.14159*u),0.0,1.0),0.5)*(0.55+0.45*clamp(u*1.6,0.0,1.0));
      float av=v/max(tw,0.03); if(av>1.0-rag*0.3) discard;
      float n=n2(vec2(u*36.0+uSeed-uT*5.0,vUv.y*3.0))*0.65+n2(vec2(u*120.0+uSeed*3.0,vUv.y*7.0))*0.35;
      float keep=n+(1.0-av)*0.55-fade*1.55; if(keep<0.0) discard;
      float age=clamp((head-u)*2.5,0.0,1.0);
      float core=exp(-av*av*45.0)*(1.0-fade*0.85)*(1.0-age*0.5);
      vec3 col=mix(uCol*(0.3+0.7*(1.0-av))*(1.0-age*0.3),uHot,core);
      float lead=(1.0-smoothstep(0.0,0.05,head-u))*(1.0-step(0.999,head));
      col=mix(col,uLead,lead);
      float crack=step(0.9,n2(vec2(u*55.0+uSeed,vUv.y*1.5)))*fade; col*=1.0-crack*0.85;
      float a=clamp((1.0-av)*1.5,0.0,1.0)*(0.4+0.6*core)*clamp(keep*5.0,0.0,1.0);
      gl_FragColor=vec4(max(col,vec3(0.0)),clamp(max(a,lead*(1.0-av)),0.0,1.0));
    }`;
  const cutMat = () => new THREE.ShaderMaterial({ uniforms: { uT: { value: 2 }, uSeed: { value: 0 }, uSweep: { value: 0.25 }, uCol: { value: new THREE.Color(ROSE).multiplyScalar(1.4) }, uHot: { value: new THREE.Color(1.3, 1.2, 1.25) }, uLead: { value: new THREE.Color(1.6, 1.5, 1.45) }, uMode: { value: 0 } }, vertexShader: CUT_VS, fragmentShader: CUT_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });

  // ---------------------------------------------------------------- the duelist's costume on the generic hero rig (look.generic skips the
  // Duskblade model): haori, kasa, mask, ribbons, sleeves, hakama, nodachi. Called once for Issen and, on Nightmare, once more for
  // his reflection in moon-blue. Returns the handles update() animates. No G.rng calls in here (seeded sims must not shift).
  const ISSEN_LOOK = { armor: 0x17151f, cloth: 0x3a3450, glow: ROSE, haori: [0x262236, 0x0c0a12], sleeveHem: 0x5a1220, crim: 0x8a1424, trim: 0xa8182a, trimE: 0x400008,
    scarf: 0xd83a5a, scarfE: ROSE, edge: ROSE, maskE: 0xff2030, eye: PALE, indigo: 0x1e1a2e, hakO: 0x2e2a44, wing: 0x3a3454, inner: 0x9a8a7e, obi: 0xc8b898 };
  const REFL_LOOK = { armor: 0x121a2c, cloth: 0x2c3f66, glow: BLUE, haori: [0x1e2a48, 0x080c18], sleeveHem: 0x12305e, crim: 0x1a3a7a, trim: 0x2a5ab8, trimE: 0x061a44,
    scarf: 0x5a8ad8, scarfE: BLUE, edge: 0xa8d0ff, maskE: 0x3a7aff, eye: 0xd8ecff, indigo: 0x121a30, hakO: 0x1a2640, wing: 0x24345a, inner: 0x7a8aa0, obi: 0xa8b8c8 };
  function dressDuelist(L) {
    const D = {};
    const M2 = D.model = buildHero({ id: 'duskblade', look: { armor: L.armor, cloth: L.cloth, glow: L.glow, hood: false, generic: true } }); M2.group.scale.setScalar(1.72);
    const hips = M2.body.children[0], torso = hips.children[0], head = torso.children.find((o) => o.isGroup && Math.abs(o.position.y - 0.8) < 0.01);
    const shs = D.shs = torso.children.filter((o) => o.isGroup && Math.abs(Math.abs(o.position.x) - 0.31) < 0.01);
    for (let i = 1; i < head.children.length; i++) head.children[i].visible = false;
    const pale = W.mat({ color: 0xffffff, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), indigo = W.mat({ color: L.indigo, roughness: 0.85, side: THREE.DoubleSide }), crim = W.mat({ color: L.crim, roughness: 0.7, side: THREE.DoubleSide });
    // hakama: wide pleated flare to the ground
    const hk = mergeGeos([-1, 1].map((sx) => { const lg = new THREE.LatheGeometry([[0.17, 0.1], [0.19, -0.15], [0.21, -0.5], [0.24, -0.82], [0.25, -0.93]].map(([x, y]) => new THREE.Vector2(x, y)), 24); const P = lg.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = P.getY(i), a = Math.atan2(x, z), k = 1 + 0.1 * Math.abs(Math.sin(a * 6)) * sat(-y * 1.2) - 0.04; P.setX(i, x * k); P.setZ(i, z * k); } lg.computeVertexNormals(); lg.rotateZ(sx * 0.15); lg.translate(sx * 0.14, 0, 0); return lg; }));
    const hak = D.hak = new THREE.Mesh(hk, indigo); hak.castShadow = true; hips.add(hak);
    const hk2 = new THREE.LatheGeometry([[0.3, 0.08], [0.34, -0.2], [0.42, -0.6]].map(([x, y]) => new THREE.Vector2(x, y)), 20, PI - 1.15, 2.3); { const P = hk2.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = P.getY(i), a = Math.atan2(x, z), k = 1 + 0.09 * Math.sin(a * 10 + 0.8) * sat(-y * 1.4); P.setX(i, x * k); P.setZ(i, z * k); } hk2.computeVertexNormals(); }
    const hakO = new THREE.Mesh(hk2, W.mat({ color: L.hakO, roughness: 0.85, side: THREE.DoubleSide })); hakO.castShadow = true; hak.add(hakO);
    const lac = W.mat({ color: 0x120a0c, roughness: 0.25, metalness: 0.2 }), saya = new THREE.Group(); saya.position.set(0.3, 0.02, 0.05); saya.rotation.set(1.27, -0.3, 0.12); hips.add(saya);
    const sy = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 1.75, 8), lac); sy.position.y = -0.55; saya.add(sy); const kj = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), W.mat({ color: 0xb08a3a, roughness: 0.4, metalness: 0.8 })); kj.position.y = -1.42; saya.add(kj);
    const so = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 10), crim); so.position.y = 0.2; saya.add(so);
    // haori: open-front coat over the torso, wide sleeves
    const hb = new THREE.Mesh(new THREE.LatheGeometry([[0.14, 0.76], [0.3, 0.66], [0.33, 0.42], [0.3, 0.15], [0.31, -0.12], [0.36, -0.36]].map(([x, y]) => new THREE.Vector2(x, y)), 28, 0.3, TAU - 0.6), pale); gradY(hb.geometry, 0.5, -0.36, L.haori[0], L.haori[1]); hb.castShadow = true; torso.add(hb);
    const inner = new THREE.Mesh(new THREE.LatheGeometry([[0.12, 0.74], [0.27, 0.64], [0.3, 0.4], [0.28, 0.15], [0.31, -0.1]].map(([x, y]) => new THREE.Vector2(x, y)), 24), W.mat({ color: L.inner, roughness: 0.9 })); inner.castShadow = true; torso.add(inner);
    const trimM = D.trimM = W.mat({ color: L.trim, roughness: 0.6, emissive: L.trimE, emissiveIntensity: 0.4 }), creamM = W.mat({ color: 0xd8c6a0, roughness: 0.75 });
    for (const sx of [-1, 1]) { const tr = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.2, 0.03), trimM); const ph = 0.3 * sx; tr.position.set(Math.sin(ph) * 0.335, 0.17, Math.cos(ph) * 0.335); tr.rotation.set(-0.08, ph, sx * -0.06); torso.add(tr); }
    const lacP = W.mat({ color: 0x14111c, roughness: 0.3, metalness: 0.3 });
    for (const sh of shs) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.34), lacP); pl.position.set(Math.sign(sh.position.x) * 0.06, 0.1, 0); pl.rotation.z = Math.sign(sh.position.x) * -0.35; pl.castShadow = true; sh.add(pl); const cd = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.02, 0.02), trimM); cd.position.set(Math.sign(sh.position.x) * 0.06, 0.07, 0.17); cd.rotation.z = pl.rotation.z; sh.add(cd); }
    const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.16, 24), W.mat({ color: L.obi, roughness: 0.8 })); ob.position.y = 0.06; torso.add(ob);
    { const cord = new THREE.Mesh(new THREE.TorusGeometry(0.338, 0.016, 5, 28), crim); cord.rotation.x = PI / 2; cord.position.y = 0.03; torso.add(cord); }
    // kataginu: stiff broad shoulder wings with a pale edge, so the silhouette reads as a swordsman, not a pile of capes
    { const wm = W.mat({ color: L.wing, roughness: 0.8 }), wg = new THREE.BoxGeometry(0.56, 0.04, 0.42, 4, 1, 1); { const P = wg.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i) / 0.28; P.setZ(i, P.getZ(i) * (1 + 0.25 * Math.max(x, 0))); } wg.computeVertexNormals(); }
      for (const sx of [-1, 1]) { const w = new THREE.Mesh(wg, wm); w.position.set(sx * 0.42, 0.71, -0.01); w.rotation.z = sx * 0.1; w.scale.x = sx; w.castShadow = true; torso.add(w);
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.56), creamM); e.position.set(0.28, 0, 0); w.add(e); const e2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.022), creamM); e2.position.set(0, 0, 0.23); w.add(e2);
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.03), creamM); const ph = 0.18 * sx; col.position.set(Math.sin(ph) * 0.3, 0.46, Math.cos(ph) * 0.3); col.rotation.set(-0.12, ph, sx * 0.32); torso.add(col); } }
    D.sleeves = [];
    const glove = W.mat({ color: 0x18141c, roughness: 0.7 }); for (const sh of shs) { const hd = sh.children.find((o) => o.isGroup), hn = hd && hd.children.find((o) => o.isGroup); if (hn) { const hm = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), glove); hm.scale.set(1, 1.2, 0.9); hm.castShadow = true; hn.add(hm); } }
    const slG = new THREE.CylinderGeometry(0.15, 0.3, 0.66, 14, 3, true); { const P = slG.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i), z = P.getZ(i), d = sat(0.25 - y) / 0.58; P.setY(i, y - d * d * (0.06 + 0.26 * sat(0.5 - z / 0.6))); P.setZ(i, z - d * d * 0.08); } slG.computeVertexNormals(); } gradY(slG, 0.25, -0.5, L.haori[0], L.sleeveHem);
    const paleF = W.mat({ color: 0xffffff, vertexColors: true, roughness: 0.9 }), slIn = W.mat({ color: 0x0a080e, roughness: 1, side: THREE.BackSide });
    for (const sh of shs) { const sl = new THREE.Mesh(slG, paleF); sl.position.y = -0.3; sl.scale.z = 1.4; sl.castShadow = true; sl.userData.sx = Math.sign(sh.position.x); sh.add(sl); sl.add(new THREE.Mesh(slG, slIn)); D.sleeves.push(sl); }
    // torn haori tails (shown from phase 2 on)
    D.cloak = []; let cp = torso.children.find((o) => o.isGroup && Math.abs(o.position.z + 0.17) < 0.01);
    while (cp) { const pm = cp.children.find((o) => o.isMesh); if (!pm) break; const tg = new THREE.PlaneGeometry(pm.geometry.parameters.width, 0.31, 8, 1), P = tg.attributes.position, rr = mulberry(D.cloak.length + 3); for (let i = 0; i < P.count; i++) if (P.getY(i) < 0) P.setY(i, P.getY(i) + rr() * 0.22); tg.computeVertexNormals(); const tm = new THREE.Mesh(tg, pm.material); tm.position.copy(pm.position); tm.visible = false; tm.castShadow = true; cp.add(tm); D.cloak.push([pm, tm]); cp = cp.children.find((o) => o.isGroup); }
    // kasa, mask, eyes
    const kasT = W.bake(128, (u, v) => { const s = 0.5 + 0.5 * Math.sin(TAU * u * 48), rg = 0.5 + 0.5 * Math.sin(TAU * v * 10), n = W.fbm(u * 8, v * 8, 2, 3, 8); return [s * 0.6 + rg * 0.3 + n * 0.1, 0.35 + s * 0.35 + n * 0.3, 0.9]; }, { dark: 0x4a3820, light: 0xa88a58, strength: 2 });
    const hat = D.hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.26, 32), new THREE.MeshStandardMaterial({ map: kasT.map, normalMap: kasT.normalMap, roughness: 0.9 })); hat.position.set(0, 0.27, 0); { const un = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.18, 32, 1, true), W.mat({ color: 0x0c0a10, roughness: 1, side: THREE.BackSide })); un.position.y = -0.06; hat.add(un); } hat.castShadow = true; head.add(hat);
    D.maskMat = new THREE.MeshStandardMaterial({ color: 0x15111a, roughness: 0.45, emissive: L.maskE, emissiveMap: crackTex(), emissiveIntensity: 0 });
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.158, 18, 12, PI / 2 - 0.95, 1.9, 0.55, 1.55), D.maskMat); mask.position.y = 0.06; head.add(mask);
    D.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(L.eye).multiplyScalar(2) });
    for (const sx of [1]) { const ey = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.014, 0.01), D.eyeMat); ey.position.set(sx * 0.052, 0.085, 0.152); ey.rotation.z = sx * 0.18; head.add(ey); }
    // scarf + sash tails (cloth ribbons)
    D.scarfMat = new THREE.MeshStandardMaterial({ color: L.scarf, emissive: L.scarfE, emissiveIntensity: 0.2, roughness: 0.8, side: THREE.DoubleSide });
    const nk = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 6, 16), D.scarfMat); nk.rotation.x = PI / 2; nk.position.y = 0.73; torso.add(nk);
    D.ribbons = [
      ribbon(torso, D.scarfMat, { n: 14, x: 0.05, y: 0.72, z: -0.14, len: 2.0, w: 0.17, drop: 0.45, trail: 1, amp: 0.22, f: 3.2, k: 5, ph: 0, taper: 0.35, speedK: 0.15 }),
      ribbon(torso, D.scarfMat, { n: 12, x: -0.05, y: 0.7, z: -0.14, len: 1.45, w: 0.14, drop: 0.5, trail: 1, amp: 0.2, f: 3.0, k: 4.5, ph: 1.4, taper: 0.4, speedK: 0.15 }),
      ribbon(torso, crim, { n: 10, x: 0.09, y: 0.04, z: -0.3, len: 1.05, w: 0.13, drop: 1, trail: 0.25, amp: 0.07, f: 2.2, k: 3, ph: 0.5, speedK: 0.12 }),
      ribbon(torso, crim, { n: 10, x: -0.06, y: 0.04, z: -0.3, len: 0.85, w: 0.12, drop: 1, trail: 0.3, amp: 0.07, f: 2.0, k: 3, ph: 2.1, speedK: 0.12 }),
    ];
    // nodachi: long curved blade with a glowing edge
    const weapon = D.weapon = M2.wtip.parent; for (let i = 1; i < weapon.children.length; i++) if (weapon.children[i].isMesh) weapon.children[i].visible = false;
    weapon.children[0].scale.y = 1.7; weapon.children[0].position.z = -0.06;
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.022, 16), W.mat({ color: 0x2a2018, roughness: 0.5, metalness: 0.7 })); tsuba.rotation.x = PI / 2; tsuba.position.z = 0.2; weapon.add(tsuba);
    const BL = 2.35, cv = (a) => 0.1 * (a / BL) * (a / BL), wd = (a) => 0.088 * (1 - 0.3 * a / BL);
    const shp = new THREE.Shape(); shp.moveTo(0, cv(0) - wd(0) / 2); for (let i = 1; i <= 20; i++) { const a = i / 20 * BL * 0.94; shp.lineTo(a, cv(a) - wd(a) / 2); } shp.lineTo(BL, cv(BL) + wd(BL) * 0.3); for (let i = 20; i >= 0; i--) { const a = i / 20 * BL * 0.94; shp.lineTo(a, cv(a) + wd(a) / 2); }
    const bg = new THREE.ExtrudeGeometry(shp, { depth: 0.026, bevelEnabled: false }); bg.translate(0, 0, -0.013); bg.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0.22, 0, 0, 0, 1));
    const blade = new THREE.Mesh(bg, W.mat({ color: 0xc4c8d4, roughness: 0.3, metalness: 0.9, envMapIntensity: 1.2 })); blade.castShadow = true; weapon.add(blade);
    D.edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(L.edge).multiplyScalar(2.0), side: THREE.DoubleSide });
    const eg = stripGeo(24, (u, s) => { const a = u * BL * 0.97; return [cv(a) - wd(a) / 2 - 0.004, s * 0.019, 0.22 + a]; }); weapon.add(new THREE.Mesh(eg, D.edgeMat));
    M2.wtip.position.set(0, 0, 0.22 + BL);
    return D;
  }
  // cool fresnel rim on every lit duelist material, so he separates from the warm deck; plus the occluder fade (dithered), and
  // for the nightmare twins a per-body drain (the still look: grey-blue, dim) and a water-line clip (the image in the lake).
  // One program for all ('duelRim'); each material gets its own body's uniforms through onBeforeCompile.
  function rimify(group, hatMat, U) {
    const done = new Set(); group.traverse((o) => { const m = o.material; if (!o.isMesh || !m || !m.isMeshStandardMaterial || done.has(m)) return; done.add(m); U.mats.push(m);
      m.onBeforeCompile = (sh) => { sh.uniforms.uRimC = U.rimU; sh.uniforms.uRimW = U.rimW; sh.uniforms.uSunV = U.sunV; sh.uniforms.uFadeD = m === hatMat ? U.fadeZ : U.fadeU; sh.uniforms.uDrain = U.drain; sh.uniforms.uClip = U.clip;
        sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWY=(modelMatrix*vec4(transformed,1.0)).y;');
        sh.fragmentShader = 'uniform vec3 uRimC,uRimW,uSunV; uniform float uFadeD,uDrain; uniform vec2 uClip; varying float vWY;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(uClip.y!=0.0&&(vWY-uClip.x)*uClip.y>0.0) discard;\nif(uFadeD>0.001){ vec2 bq=mod(floor(gl_FragCoord.xy),4.0); vec2 b2=mod(bq,2.0), b4=floor(bq*0.5); float by=4.0*(2.0*abs(b2.x-b2.y)+b2.y)+2.0*abs(b4.x-b4.y)+b4.y; if((by+0.5)/16.0<uFadeD) discard; }').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv=vViewPosition/max(length(vViewPosition),1e-4); float fr=1.0-clamp(abs(dot(normal,vv)),0.0,1.0); totalEmissiveRadiance+=(uRimC*(fr*fr*fr)+uRimW*(fr*fr)*pow(max(dot(normal,uSunV),0.0),2.0))*(1.0-0.7*uFadeD); totalEmissiveRadiance*=1.0-0.75*uDrain; }').replace('#include <opaque_fragment>', 'outgoingLight*=1.0-0.45*uFadeD;\noutgoingLight=mix(outgoingLight,vec3(dot(outgoingLight,vec3(0.3,0.5,0.2)))*vec3(0.62,0.78,1.0)*0.38+vec3(0.006,0.01,0.02),uDrain);\n#include <opaque_fragment>'); };
      m.customProgramCacheKey = () => 'duelRim'; m.needsUpdate = true; });
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sunDir = [-0.28, 0.13, -0.95];
    const sky = W.sky({ top: 0x26306e, horizon: 0xff9a6a, bottom: 0x3a2030, exp: 0.42, clouds: 0.5, cloudColor: 0xffb8a0, cloudDark: 0x70507a, cloudScale: 0.9, cloudSpeed: 0.006, sunDir, sunColor: 0xffd0a0, sunSize: 0.12, sunGlow: 1.05, stars: 0 }); g.add(sky); S.sky = sky; W.env(sky, 0.55);
    sky.material.uniforms.uSunCol.value.setRGB(0.23, 0.15, 0.065); sky.material.uniforms.uSunGlow.value = 1.35; // disc is drawn at 6x: hold it as a crisp orange-gold disc, not a white smear
    scene.fog = new THREE.FogExp2(0xc88a88, 0.004);
    S.hemi = W.hemi(g, 0x7a9cc8, 0x4a3a3a, 0.95);
    S.sun = W.sun(g, { dir: [-0.3, 0.32, -0.9], color: 0xffc090, intensity: 2.6, size: 22 });
    S.fill = new THREE.DirectionalLight(0x9a90e8, 0.55); S.fill.position.set(18, 30, 40); g.add(S.fill);
    // ---- shared environment uniforms (lake, mountains, mist) ----
    const EU = S.EU = { uTime: { value: 0 }, uTop: { value: new THREE.Color(0x3a3c78) }, uHor: { value: new THREE.Color(0xf09070) }, uSunDir: { value: new V3(...sunDir).normalize() }, uSunCol: { value: new THREE.Color(0xffc890) },
      uFogC: { value: new THREE.Color(0xd8907c) }, uMtnF: { value: new THREE.Color(0x6a5688) }, uMtnN: { value: new THREE.Color(0x2e2238) }, uDeep: { value: new THREE.Color(0x102029) }, uPet: { value: new THREE.Color(0xf0a0b4) }, uMist: { value: new THREE.Color(0xf0b0a0) }, uGlowK: { value: 1.0 }, uStreak: { value: 0.0 }, uRedG: { value: 0.0 }, uCalm: { value: 0 }, uRip: { value: new V3(0, 0, -100) }, uGap: { value: new THREE.Vector2(-0.25, -0.97).normalize() } };
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1).rotateX(-PI / 2), new THREE.ShaderMaterial({ uniforms: EU, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }',
      fragmentShader: `uniform float uTime,uGlowK,uStreak,uRedG,uCalm; uniform vec3 uTop,uHor,uSunDir,uSunCol,uFogC,uMtnF,uMtnN,uDeep,uPet,uRip; varying vec3 vW;
        ${GN}
        vec3 skyCol(vec3 r){ float h=clamp(r.y,0.0,1.0); vec3 c=mix(uHor,uTop,pow(h,0.42)); float sd=max(dot(r,uSunDir),0.0); c+=uSunCol*uGlowK*(pow(sd,180.0)*1.2+pow(sd,14.0)*0.3); return c; }
        void main(){
          vec3 toC=cameraPosition-vW; float dist=length(toC); vec3 v=toC/max(dist,1e-3);
          vec2 q=vW.xz; float t=uTime; float att=1.0/(1.0+dist*0.02);
          float e=0.35; vec2 o1=vec2(t*0.22,t*0.1), o2=vec2(-t*0.27,t*0.18);
          float a0=n2(q*0.55+o1)+0.5*n2(q*1.6+o2);
          float ax=n2((q+vec2(e,0.0))*0.55+o1)+0.5*n2((q+vec2(e,0.0))*1.6+o2);
          float az=n2((q+vec2(0.0,e))*0.55+o1)+0.5*n2((q+vec2(0.0,e))*1.6+o2);
          vec2 gr=vec2(a0-ax,a0-az)*0.45*att*(1.0-uCalm*0.93);
          vec2 cq=q/6.0; vec2 ci=floor(cq); vec2 cf=fract(cq)-0.5; float hh=h21(ci+3.7); vec2 cc=vec2(h21(ci+1.3),h21(ci+8.1))-0.5; vec2 dv=cf-cc*0.6;
          float dd=length(dv)*6.0; float ph=fract(t*0.16+hh); float rr=ph*2.6; float ring=exp(-((dd-rr)*4.0)*((dd-rr)*4.0))*(1.0-ph)*step(0.4,hh);
          gr+=dv/max(length(dv),1e-3)*ring*0.3*att*cos((dd-rr)*12.0)*(1.0-uCalm*0.85);
          { float rt=uTime-uRip.z; vec2 rq=q-uRip.xy; float rd=length(rq); for(int k=0;k<3;k++){ float rr2=rt*2.4-float(k)*1.3; float rk=exp(-(rd-rr2)*(rd-rr2)*2.5)*exp(-rt*0.45)*step(0.0,rt)*step(rt,14.0)*step(0.0,rr2); gr+=rq/max(rd,1e-3)*rk*0.32*cos((rd-rr2)*8.0); } }
          vec3 n=normalize(vec3(gr.x,1.0,gr.y));
          vec3 r=reflect(-v,n); r.y=abs(r.y)+1e-3; r=normalize(r);
          float lxz=max(length(r.xz),1e-3); vec2 rd=r.xz/lxz; float el=r.y/lxz;
          vec3 refl=skyCol(r);
          float ef=eFar(rd), en=eNear(rd);
          if(el<ef) refl=mix(uHor,uMtnF,0.5+0.3*clamp(el/max(ef,1e-3),0.0,1.0));
          if(el<en) refl=mix(uHor,uMtnN,0.72+0.2*clamp(el/max(en,1e-3),0.0,1.0));
          float sd=max(dot(r,uSunDir),0.0); float gn=0.3+0.7*n2(q*vec2(0.9,2.6)+vec2(t*0.3,-t*0.2)); refl+=uSunCol*(min(pow(sd,600.0)*1.3,1.3)+pow(sd,70.0)*uStreak*gn+pow(sd,16.0)*uStreak*0.12);
          float fr=0.04+0.96*pow(clamp(1.0-max(dot(n,v),0.0),0.0,1.0),5.0);
          vec3 col=mix(uDeep,refl,fr);
          vec2 pq=q*1.3+vec2(t*0.05,t*0.03); vec2 pi=floor(pq); vec2 pf=fract(pq)-0.5-(vec2(h21(pi+2.0),h21(pi+5.0))-0.5)*0.6;
          float pd=length(pf*vec2(1.0,1.2)); float pk=step(0.91,h21(pi))*(1.0-smoothstep(0.06,0.1,pd))*(1.0-smoothstep(25.0,50.0,dist));
          col=mix(col,uPet,pk*0.8);
          col+=ring*0.06*uHor*att;
          col*=mix(0.45,1.0,smoothstep(15.2,19.0,length(q)))*mix(0.8,1.0,smoothstep(18.0,40.0,length(q)));
          float gl=step(0.965,n2(q*2.2+vec2(t*0.7,-t*0.4)))*clamp(fr*3.0+0.15,0.0,1.0)*(1.0-smoothstep(20.0,120.0,dist)); col+=uSunCol*gl*uRedG*smoothstep(0.55,0.97,sd);
          col=mix(col,uFogC,clamp(1.0-exp(-dist*0.0016),0.0,1.0));
          gl_FragColor=vec4(clamp(col,vec3(0.0),vec3(1.25)),1.0);
        }` }));
    lake.position.y = -0.3; lake.receiveShadow = false; lake.onBeforeRender = () => { EU.uTime.value = G.now; }; g.add(lake);
    // distant mountain silhouettes (the lake reflects the same profile)
    for (const [rad, hgt, layer] of [[900, 200, 0], [750, 120, 2], [600, 75, 1]]) {
      const mm = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, hgt, 180, 1, true), new THREE.ShaderMaterial({ uniforms: Object.assign({ uLayer: { value: layer }, uR: { value: rad } }, EU), side: THREE.DoubleSide, fog: false,
        vertexShader: 'varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }',
        fragmentShader: `uniform vec3 uHor,uMtnF,uMtnN,uSunDir,uSunCol,uFogC; uniform float uLayer,uR; varying vec3 vW;
          ${GN}
          void main(){ vec2 d=vW.xz/max(length(vW.xz),1e-3); float el=(vW.y+0.3)/uR; float e=uLayer>1.5?gapK(d)*(0.008+0.13*pow(clamp(fb(d*3.0+vec2(11.0,5.0)),0.0,1.0),2.4)):(uLayer>0.5?eNear(d):eFar(d)); if(el>e) discard;
            float k=clamp(el/max(e,1e-4),0.0,1.0);
            vec3 c=uLayer>1.5?mix(uHor,mix(uMtnF,uMtnN,0.5),0.55+0.3*k):(uLayer>0.5?mix(uFogC,uMtnN,0.62+0.3*k):mix(uHor,uMtnF,0.36+0.34*k));
            if(uLayer<0.5){ float snow=smoothstep(0.1,0.13,e)*smoothstep(0.78+0.1*n2(d*60.0),0.9,k); c=mix(c,mix(uHor,vec3(1.0,0.97,1.0),0.6)*(0.55+0.45*length(uMtnF)),snow*0.8); }
            vec2 sx=uSunDir.xz; sx/=max(length(sx),1e-4); c+=uSunCol*pow(max(dot(d,sx),0.0),6.0)*smoothstep(0.8,1.0,k)*0.15;
            gl_FragColor=vec4(max(c,vec3(0.0)),1.0); }` }));
      mm.position.y = -0.3 + hgt / 2; mm.frustumCulled = false; g.add(mm);
    }
    // low mist banks on the water, kept away from the deck
    for (const [y, a, sp] of [[-0.05, 0.55, 1], [1.3, 0.3, -1.4]]) {
      const mist = new THREE.Mesh(new THREE.RingGeometry(15.6, 260, 96, 3).rotateX(-PI / 2), new THREE.ShaderMaterial({ uniforms: Object.assign({ uA: { value: a }, uSp: { value: sp } }, EU), transparent: true, depthWrite: false, fog: false,
        vertexShader: 'varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }',
        fragmentShader: `uniform float uTime,uA,uSp; uniform vec3 uMist; varying vec3 vW;
          ${GN}
          void main(){ float r=length(vW.xz); vec2 q=vW.xz*0.03; float n=fb(q+vec2(uTime*0.012,uTime*0.007)*uSp)*0.7+fb(q*2.3-vec2(uTime*0.02*uSp,0.0))*0.3;
            float a=smoothstep(0.4,0.78,n)*(smoothstep(15.6,18.0,r)*0.55+0.45*smoothstep(19.0,42.0,r))*(1.0-smoothstep(150.0,250.0,r))*uA; gl_FragColor=vec4(uMist,clamp(a,0.0,1.0)); }` }));
      mist.position.y = y; mist.renderOrder = 4; g.add(mist);
    }
    // ---- stage: worn planks with seams and staggered butt joints ----
    const NP = 16, deckT = W.bake(512, (u, v) => {
      const id = Math.floor(u * NP), fu = (u * NP) % 1, seam = smooth(sat(Math.min(fu, 1 - fu) * 18)), hs = W.hash2(id, 3, 7);
      const fv = (v * 2 + hs) % 1, butt = smooth(sat(Math.min(fv, 1 - fv) * 70)), m = W.fbm(u * 8, v * 8, 5, 4, 8);
      const grain = 0.5 + 0.5 * Math.sin(TAU * u * NP * 5 + m * 7 + hs * 20), wear = W.fbm(u * 4, v * 4, 9, 3, 4);
      const tone = (0.32 + grain * 0.18 + hs * 0.22 + wear * 0.25) * (0.35 + 0.65 * seam * butt);
      const wet = smooth(sat((W.fbm(u * 2, v * 2, 13, 3, 2) - 0.45) * 4)); return [seam * butt * 0.75 + grain * 0.12 + m * 0.1, tone * (1 - wet * 0.15), lerp(0.85 + wear * 0.12, 0.42, wet) + (1 - seam * butt) * 0.1];
    }, { dark: 0x2e1c14, light: 0xb48a66, strength: 2.4 });
    for (const k in deckT) deckT[k].repeat.set(4, 4);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.3, R + 0.15, 0.6, 72), new THREE.MeshStandardMaterial({ map: deckT.map, normalMap: deckT.normalMap, roughnessMap: deckT.roughnessMap, roughness: 1, metalness: 0, envMapIntensity: 0.3 })); stage.position.y = -0.3; stage.receiveShadow = true; g.add(stage); S.deckM = stage.material;
    const paint = S.inlay = new THREE.MeshStandardMaterial({ color: 0xa89a78, roughness: 0.8, metalness: 0.1, envMapIntensity: 0.35, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const [a0, a1] of [[6.84, 6.96], [7.37, 7.43], [2.03, 2.09]]) { const pr = new THREE.Mesh(new THREE.RingGeometry(a0, a1, 128), paint); pr.rotation.x = -PI / 2; pr.position.y = 0.011; g.add(pr); }
    const crimP = new THREE.MeshStandardMaterial({ color: 0x9a1a28, roughness: 0.7, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let i = 0; i < 0; i++) { const a = i / 8 * TAU; const tk = new THREE.Mesh(new THREE.RingGeometry(7.6, 8.4, 6, 1, a - 0.035, 0.07), crimP); tk.rotation.x = -PI / 2; tk.position.y = 0.011; g.add(tk); }
    const slT = W.surface('slabs', { n: 4, dark: 0x3a3634, light: 0x8a8278, strength: 2.5, size: 256 }); for (const k in slT) slT[k].repeat.set(24, 1);
    const band = new THREE.Mesh(new THREE.RingGeometry(R - 1.1, R + 0.3, 120, 1), new THREE.MeshStandardMaterial({ map: slT.map, normalMap: slT.normalMap, roughnessMap: slT.roughnessMap, roughness: 1, envMapIntensity: 0.4 }));
    { const P = band.geometry.attributes.position, UV = band.geometry.attributes.uv; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); UV.setXY(i, (Math.atan2(y, x) / TAU + 0.5), (Math.hypot(x, y) - (R - 1.1)) / 1.4); } }
    band.rotation.x = -PI / 2; band.position.y = 0.006; band.receiveShadow = true; g.add(band);
    { const pr = mulberry(55), L = []; for (let i = 0; i < 700; i++) { const a = pr() * TAU, rim = pr() < 0.45, d = rim ? R - 0.15 - Math.pow(pr(), 2.5) * 2.2 : Math.sqrt(pr()) * (R - 0.4); const sz = (rim ? 0.045 : 0.03) + pr() * pr() * 0.06; L.push([Math.sin(a) * d, 0.014, Math.cos(a) * d, 0, sz, sz * (0.6 + pr() * 0.3), 1, -PI / 2, pr() * TAU]); }
      const psh = new THREE.Shape(); psh.moveTo(0, -1); psh.quadraticCurveTo(0.9, -0.3, 0.55, 0.65); psh.lineTo(0, 0.4); psh.lineTo(-0.55, 0.65); psh.quadraticCurveTo(-0.9, -0.3, 0, -1);
      const fp = inst(g, new THREE.ShapeGeometry(psh, 4), new THREE.MeshStandardMaterial({ color: 0xffd0dc, roughness: 0.8, emissive: 0xff8aa8, emissiveIntensity: 0.08, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 }), L); { const c = new THREE.Color(); for (let i = 0; i < L.length; i++) { const w = pr(); c.setRGB(1, lerp(0.62, 1, w), lerp(0.7, 1, w)).multiplyScalar(0.75 + pr() * 0.25); fp.setColorAt(i, c); } } S.fallen = fp.material; }
    S.poolMat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0xffa850).multiplyScalar(0.35) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vU; void main(){ vU=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; varying vec2 vU; void main(){ float d=clamp(1.0-length(vU),0.0,1.0); gl_FragColor=vec4(uC*d*d,1.0); }' });
    { const L = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.39; L.push([Math.sin(a) * (R + 0.2), 0.02, Math.cos(a) * (R + 0.2), 0, 9, 9, 1, -PI / 2]); } inst(g, new THREE.PlaneGeometry(1, 1), S.poolMat, L).renderOrder = 3; }
    const inl = new THREE.Mesh(new THREE.RingGeometry(6.88, 6.9, 8), W.mat({ color: 0x0e0806, roughness: 0.7 })); inl.visible = false; inl.rotation.x = -PI / 2; inl.position.y = 0.012; g.add(inl);
    // shimenawa: twisted straw rope round the edge with paper shide
    const ropeT = W.bake(128, (u, v) => { const s = 0.5 + 0.5 * Math.sin(TAU * (3 * u + v)), f = 0.5 + 0.5 * Math.sin(TAU * (24 * u + 8 * v)), n = W.fbm(u * 8, v * 8, 4, 3, 8); return [s * 0.6 + f * 0.25 + n * 0.15, 0.45 + s * 0.3 + f * 0.1 + n * 0.15, 0.9]; }, { dark: 0x5a4220, light: 0xd0b884, strength: 2.2 });
    for (const k in ropeT) ropeT[k].repeat.set(260, 1);
    S.rope = new THREE.MeshStandardMaterial({ map: ropeT.map, normalMap: ropeT.normalMap, roughness: 0.95, emissive: 0xff2040, emissiveIntensity: 0 });
    const rope = new THREE.Mesh(new THREE.TorusGeometry(R + 0.3, 0.13, 10, 240), S.rope); rope.rotation.x = PI / 2; rope.position.y = 0.06; rope.castShadow = true; g.add(rope);
    const shG = new THREE.PlaneGeometry(0.16, 0.56, 1, 4); { const P = shG.attributes.position; for (let i = 0; i < P.count; i++) { const row = Math.round((0.28 - P.getY(i)) / 0.14); P.setX(i, P.getX(i) + (row % 2 ? 0.06 : -0.02)); } shG.computeVertexNormals(); }
    const shL = []; for (let i = 0; i < 44; i++) { const a = i / 44 * TAU + 0.07; shL.push([Math.sin(a) * (R + 0.5), -0.22, Math.cos(a) * (R + 0.5), a + PI / 2, 1, 1, 1, 0.12]); }
    S.shide = new THREE.MeshStandardMaterial({ color: 0xc8b8a0, roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.3 }); inst(g, shG, S.shide, shL);
    // stone tōrō lanterns on rock footings
    // lit paper (soft falloff to the rims and rib lines, kept under bloom clipping) and billboard halos, instead of flat glowing boxes
    const IMW = 'mat4 mw=modelMatrix;\n#ifdef USE_INSTANCING\nmw=mw*instanceMatrix;\n#endif\n';
    const paperMat = (c, k, ribs) => new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(c) }, uK: { value: k } },
      vertexShader: 'varying vec2 vU; varying float vF; void main(){ vU=uv; ' + IMW + 'vec4 wp=mw*vec4(position,1.0); vec3 n=mat3(mw)*normal; n/=max(length(n),1e-5); vec3 v=cameraPosition-wp.xyz; v/=max(length(v),1e-5); vF=abs(dot(n,v)); gl_Position=projectionMatrix*viewMatrix*wp; }',
      fragmentShader: `uniform vec3 uC; uniform float uK; varying vec2 vU; varying float vF; void main(){ float f=clamp(vF,0.0,1.0), y=abs(vU.y*2.0-1.0); float fr=fract(vU.y*${ribs.toFixed(1)}); float rib=mix(0.6,1.0,smoothstep(0.0,0.09,min(fr,1.0-fr)));
        vec3 c=uC*uK*(0.4+0.6*f*f)*(1.0-0.5*y*y)*rib; c=mix(c,c*vec3(1.0,0.75,0.55),y*0.6); gl_FragColor=vec4(clamp(c,vec3(0.0),vec3(1.5)),1.0); }` });
    const haloMat = (c) => new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(c) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy*2.0; ' + IMW + 'vec4 c=viewMatrix*mw*vec4(0.0,0.0,0.0,1.0); float s=length(mw[0].xyz); c.xy+=position.xy*s; gl_Position=projectionMatrix*c; }',
      fragmentShader: 'uniform vec3 uC; varying vec2 vP; void main(){ float d=clamp(length(vP),0.0,1.0); float a=(exp(-d*d*9.0)*0.7+exp(-d*d*2.5)*0.3)*(1.0-smoothstep(0.6,1.0,d)); gl_FragColor=vec4(uC*a,1.0); }' });
    const stone = W.mat({ color: 0x6e6862, roughness: 0.92, flatShading: true }), rockM = W.mat({ color: 0x3a3230, roughness: 1 }); S.lampMat = paperMat(0xffb868, 1.25, 1); S.lampHalo = haloMat(new THREE.Color(0xffa050).multiplyScalar(0.3));
    const L8 = [...Array(8)].map((_, i) => { const a = i / 8 * TAU + 0.39; return [Math.sin(a) * (R + 1.8), Math.cos(a) * (R + 1.8), a]; });
    const lp = (y, sx, sy, sz, ry = 0) => L8.map(([x, z, a]) => [x, y, z, a + ry, sx, sy, sz]);
    inst(g, new THREE.DodecahedronGeometry(0.8, 0), rockM, lp(-0.4, 1.2, 0.55, 1.1, 0.5));
    inst(g, new THREE.CylinderGeometry(0.42, 0.52, 0.26, 6), stone, lp(0.12, 1, 1, 1), true);
    inst(g, new THREE.CylinderGeometry(0.13, 0.17, 1.3, 6), stone, lp(0.9, 1, 1, 1), true);
    inst(g, new THREE.CylinderGeometry(0.44, 0.36, 0.16, 6), stone, lp(1.62, 1, 1, 1), true);
    inst(g, new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8, 1, false), S.lampMat, lp(1.9, 1, 1, 1, PI / 4)); inst(g, new THREE.PlaneGeometry(1, 1), S.lampHalo, lp(1.92, 2.2, 2.2, 2.2)).renderOrder = 14;
    inst(g, new THREE.BoxGeometry(0.08, 0.44, 0.08), stone, L8.flatMap(([x, z, a]) => [0, 1, 2, 3].map((k) => { const q = a + k * PI / 2 + PI / 4; return [x + Math.sin(q) * 0.27, 1.9, z + Math.cos(q) * 0.27, q]; })));
    inst(g, new THREE.LatheGeometry([[0.78, -0.16], [0.7, -0.1], [0.45, 0.02], [0.22, 0.14], [0.08, 0.24], [0.0, 0.26]].map(([x, y]) => new THREE.Vector2(x, y)), 6), stone, lp(2.26, 1, 1, 1, PI / 6), true);
    inst(g, new THREE.LatheGeometry([[0.0, -0.17], [0.78, -0.17], [0.78, -0.15]].map(([x, y]) => new THREE.Vector2(x, y)), 6), W.mat({ color: 0x2a2624, roughness: 1, side: THREE.DoubleSide }), lp(2.26, 1, 1, 1, PI / 6));
    inst(g, new THREE.SphereGeometry(0.1, 8, 6), stone, lp(2.56, 1, 1.3, 1));
    // reeds at the deck edge, a far ring of floating paper lanterns
    { const rg = new THREE.PlaneGeometry(0.07, 1, 1, 3); rg.translate(0, 0.5, 0); const P = rg.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setX(i, P.getX(i) * (1 - y * 0.9)); P.setZ(i, y * y * 0.18); } rg.computeVertexNormals();
      const rr = mulberry(91), L = []; for (let c = 0; c < 26; c++) { const ca = rr() * TAU, cd = R + 0.9 + rr() * 1.6; for (let k = 0; k < 11; k++) { const a = ca + (rr() - 0.5) * 0.09, d = cd + (rr() - 0.5) * 0.7, h = 0.5 + rr() * 1.0; L.push([Math.sin(a) * d, -0.32, Math.cos(a) * d, rr() * TAU, 1, h, 1, (rr() - 0.5) * 0.4, (rr() - 0.5) * 0.4]); } }
      const reedM = W.mat({ color: 0x4a5a32, roughness: 0.9, side: THREE.DoubleSide });
      reedM.onBeforeCompile = (sh) => { sh.uniforms.uWind = S.windU; sh.uniforms.uTimeW = S.timeU; sh.vertexShader = 'uniform float uWind,uTimeW;\n' + sh.vertexShader.replace('#include <project_vertex>', 'vec4 mvPosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nmvPosition=instanceMatrix*mvPosition;\n#endif\nfloat hw=max(mvPosition.y+0.3,0.0); hw*=hw; float gs=sin(uTimeW*2.3+mvPosition.x*0.4+mvPosition.z*0.3); mvPosition.x+=(gs*0.6+0.5)*uWind*hw*0.22; mvPosition.z+=sin(uTimeW*1.7+mvPosition.x*0.5)*uWind*hw*0.08;\nmvPosition=modelViewMatrix*mvPosition; gl_Position=projectionMatrix*mvPosition;'); };
      reedM.customProgramCacheKey = () => 'duelReed'; inst(g, rg, reedM, L); }
    { const rr = mulberry(17), L = [], B = [], H = [], RF = [], CP = []; for (let i = 0; i < 40; i++) { const a = rr() * TAU, d = 28 + rr() * 50; const x = Math.sin(a) * d, z = Math.cos(a) * d, s = 0.75 + rr() * 0.4;
        L.push([x, 0.12 * s, z, rr() * TAU, 0.55 * s, 0.62 * s, 0.55 * s]); CP.push([x, 0.43 * s, z, 0, 0.55 * s, 0.6, 0.55 * s], [x, -0.19 * s, z, 0, 0.55 * s, 0.6, 0.55 * s]); B.push([x, -0.25, z, 0, 0.5 * s, 0.07, 0.5 * s]); H.push([x, 0.14 * s, z, 0, 2.6 * s]); RF.push([x - Math.sin(a) * 2.2 * s, -0.27, z - Math.cos(a) * 2.2 * s, a, 0.75 * s, 1, 4 * s]); }
      S.floatMat = paperMat(0xffa858, 1.1, 4); inst(g, new THREE.LatheGeometry([[0.36, -0.5], [0.47, -0.32], [0.52, 0], [0.47, 0.32], [0.36, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 12), S.floatMat, L);
      const dk = W.mat({ color: 0x1a120e, roughness: 0.8 }); inst(g, new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), dk, CP); inst(g, new THREE.CylinderGeometry(1, 1, 1, 12), dk, B);
      S.floatHalo = haloMat(new THREE.Color(0xff9a48).multiplyScalar(0.32)); inst(g, new THREE.PlaneGeometry(1, 1), S.floatHalo, H).renderOrder = 14;
      S.reflMat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0xff9040).multiplyScalar(0.3) }, uTime: EU.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        vertexShader: 'varying vec2 vU; void main(){ vU=uv; ' + IMW + 'gl_Position=projectionMatrix*viewMatrix*mw*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 uC; uniform float uTime; varying vec2 vU; void main(){ float x=abs(vU.x*2.0-1.0), y=vU.y; float w=0.25+0.75*(1.0-y)*(1.0-y); float br=0.55+0.45*sin(y*38.0-uTime*3.0+vU.x*4.0); float a=(1.0-smoothstep(0.0,w,x))*smoothstep(0.0,0.12,y)*(1.0-y)*br; gl_FragColor=vec4(uC*clamp(a,0.0,1.0),1.0); }' });
      inst(g, new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2), S.reflMat, RF).renderOrder = 3; }
    S.pls = []; for (const [x, z] of [[-11, -12], [12, 10]]) { const L = new THREE.PointLight(0xffb060, 50, 30, 1.7); L.position.set(x, 2.5, z); g.add(L); S.pls.push(L); }
    // torii
    const red = W.mat({ color: 0xa01a1c, roughness: 0.6 }), blk = W.mat({ color: 0x0c0a0a, roughness: 0.6 });
    const tor = new THREE.Group(); tor.position.set(0, -0.3, -27); g.add(tor);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 13, 16), red); p.position.set(sx * 6.5, 6.5, 0); p.rotation.z = -sx * 0.04; p.castShadow = true; tor.add(p); const ft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.9, 16), blk); ft.position.set(sx * 6.5, 0.35, 0); tor.add(ft); }
    const kas = new THREE.Mesh(new THREE.BoxGeometry(18, 0.9, 1.2, 24, 1, 1), blk); { const P = kas.geometry.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i) / 9; P.setY(i, P.getY(i) + x * x * x * x * 0.9); } kas.geometry.computeVertexNormals(); } kas.position.y = 13.4; tor.add(kas);
    const k2 = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.7, 0.9), red); k2.position.y = 12.5; tor.add(k2); const k3 = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.6, 0.7), red); k3.position.y = 10.4; tor.add(k3);
    const gak = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.9, 0.75), blk); gak.position.y = 11.45; tor.add(gak);
    // ---- cherry trees: twisted bark tubes + canopies of blossom cards ----
    const barkT = W.bake(256, (u, v) => {
      const m = W.fbm(u * 8, v * 8, 3, 4, 8), s = Math.sin(TAU * u * 24 + m * 5), len = smooth(sat((s - 0.8) * 6)) * (W.fbm(u * 8 + 3, v * 8, 7, 3, 8) > 0.47 ? 1 : 0.15);
      return [0.6 - len * 0.45 + m * 0.3, sat(0.25 + m * 0.6 - len * 0.3), 0.88];
    }, { dark: 0x160e0c, light: 0x6a524c, strength: 2.6 });
    for (const k in barkT) barkT[k].repeat.set(3, 1);
    const barkM = new THREE.MeshStandardMaterial({ map: barkT.map, normalMap: barkT.normalMap, roughness: 0.95 });
    S.blossom = new THREE.MeshStandardMaterial({ map: blossomTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, emissive: 0xff90b0, emissiveIntensity: 0.22 }); S.blossom.emissiveMap = S.blossom.map; S.windU = { value: 0.35 }; S.timeU = { value: 0 };
    S.blossom.onBeforeCompile = (sh) => { sh.uniforms.uWind = S.windU; sh.uniforms.uTimeW = S.timeU; sh.vertexShader = 'uniform float uWind,uTimeW;\n' + sh.vertexShader.replace('#include <project_vertex>', 'vec4 mvPosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nmvPosition=instanceMatrix*mvPosition;\n#endif\nfloat hw=max(mvPosition.y-2.0,0.0); mvPosition.x+=(sin(uTimeW*1.4+mvPosition.z*0.15)*0.5+0.6)*uWind*hw*0.06; mvPosition.z+=sin(uTimeW*1.1+mvPosition.x*0.17)*uWind*hw*0.025;\nmvPosition=modelViewMatrix*mvPosition; gl_Position=projectionMatrix*mvPosition;'); };
    const barkGeos = [], cardG = new THREE.PlaneGeometry(1, 1), MM = new THREE.Matrix4(), QQ = new THREE.Quaternion(), EE = new THREE.Euler(), VV = new V3(), SS = new V3(), CC = new THREE.Color();
    const tree = (tx, tz, sc, seed) => {
      const r = mulberry(seed), pts = []; let x = tx, y = -0.9, z = tz, dx = (r() - 0.5) * 0.7, dz = (r() - 0.5) * 0.7;
      for (let i = 0; i < 6; i++) { pts.push(new V3(x, y, z)); y += 1.35 * sc; x += dx * sc; z += dz * sc; dx += (r() - 0.5) * 0.6; dz += (r() - 0.5) * 0.6; }
      barkGeos.push(taperTube(pts, 0.7 * sc, 0.3 * sc, 26, 10, r() * 10));
      const clumps = [], nb = 5 + Math.floor(r() * 3);
      for (let k = 0; k < nb; k++) {
        const st = pts[3 + Math.floor(r() * 2.99)], az = k / nb * TAU + r() * 0.7, ln = (3.2 + r() * 2.6) * sc, el = 0.25 + r() * 0.45, ca = Math.sin(az), cz = Math.cos(az);
        const b1 = new V3(st.x + ca * ln * 0.35, st.y + ln * el * 0.6, st.z + cz * ln * 0.35), b2 = new V3(st.x + ca * ln * 0.7 + (r() - 0.5), st.y + ln * el * 0.9, st.z + cz * ln * 0.7 + (r() - 0.5)), b3 = new V3(st.x + ca * ln, st.y + ln * el * 0.85 - 0.3 * sc, st.z + cz * ln);
        barkGeos.push(taperTube([st.clone(), b1, b2, b3], 0.3 * sc, 0.06 * sc, 12, 6, r() * 10)); clumps.push([b3, 2.3], [b2, 2.0], [b1, 1.4]);
      }
      clumps.push([pts[5], 2.6]);
      const N = clumps.length * 20, im = new THREE.InstancedMesh(cardG, S.blossom, N); let i = 0;
      for (const [c, cr] of clumps) for (let k = 0; k < 20; k++) {
        const a = r() * TAU, e = Math.acos(r() * 2 - 1), d = Math.cbrt(r()) * cr * sc; VV.set(c.x + Math.sin(e) * Math.sin(a) * d, c.y + Math.cos(e) * d * 0.6 + 0.4 * sc, c.z + Math.sin(e) * Math.cos(a) * d);
        EE.set(r() * TAU, r() * TAU, r() * TAU); QQ.setFromEuler(EE); const s = (1.2 + r() * 1.3) * sc; SS.set(s, s, s); MM.compose(VV, QQ, SS); im.setMatrixAt(i, MM);
        const w = r(); CC.setRGB(1, lerp(0.78, 1, w), lerp(0.84, 1, w)); im.setColorAt(i, CC); i++;
      }
      im.userData.fadeOcclude = true; g.add(im);
      const ig = new THREE.IcosahedronGeometry(5 * sc, 3), IP = ig.attributes.position, IC = new Float32Array(IP.count * 3), cm = new THREE.Color(0x3a4a26), cr = new THREE.Color(0x4a4440), cc = new THREE.Color();
      for (let i = 0; i < IP.count; i++) { const x = IP.getX(i), y = IP.getY(i), z = IP.getZ(i), n = W.vnoise(x * 0.5 + seed, z * 0.5, seed) * 0.5 + W.vnoise(x * 1.3, z * 1.3 + seed, 3) * 0.3, k = 0.75 + n * 0.6; IP.setXYZ(i, x * k, y * (0.55 + n * 0.9), z * k); cc.copy(cr).lerp(cm, smooth(sat(y / (5 * sc) * 2.2 + n - 0.4))); IC[i * 3] = cc.r; IC[i * 3 + 1] = cc.g; IC[i * 3 + 2] = cc.b; }
      ig.setAttribute('color', new THREE.BufferAttribute(IC, 3)); ig.computeVertexNormals();
      const isle = new THREE.Mesh(ig, W.mat({ color: 0xffffff, vertexColors: true, roughness: 1, flatShading: true })); isle.scale.set(1, 0.22, 1); isle.position.set(tx, -0.75, tz); isle.receiveShadow = true; g.add(isle);
      for (let k = 0; k < 4; k++) { const a = r() * TAU, d = (4.5 + r() * 2.5) * sc, rk = new THREE.Mesh(new THREE.DodecahedronGeometry((0.5 + r() * 0.9) * sc, 0), W.mat({ color: 0x46403c, roughness: 1, flatShading: true })); rk.position.set(tx + Math.sin(a) * d, -0.35, tz + Math.cos(a) * d); rk.rotation.set(r() * 3, r() * 3, r() * 3); rk.scale.y = 0.6; g.add(rk); }
    };
    tree(-21, -31, 1.35, 4); tree(23, -28, 1.1, 9); tree(-35, 5, 1.0, 14); tree(34, 15, 0.95, 21);
    const bark = new THREE.Mesh(mergeGeos(barkGeos), barkM); bark.castShadow = true; g.add(bark);
    // drifting petals: rotating petal sprites, not glowing dots
    { const n = Math.round(1500 * G.q.part), box = [64, 18, 64], pos = new Float32Array(n * 3), sd = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos[i * 3] = vrand() * box[0]; pos[i * 3 + 1] = vrand() * box[1]; pos[i * 3 + 2] = vrand() * box[2]; sd[i] = vrand(); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
      const PU = { uTime: { value: 0 }, uScale: { value: 500 }, uBox: { value: new V3(...box) }, uVel: { value: new V3(0.8, -0.7, 0.35) }, uA: { value: new THREE.Color(1.0, 0.62, 0.72) }, uB: { value: new THREE.Color(1.0, 0.9, 0.92) }, uAlpha: { value: 0.9 }, uDen: { value: 0.45 } };
      S.petals = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: PU, transparent: true, depthWrite: false,
        vertexShader: `uniform float uTime,uScale,uDen; uniform vec3 uBox,uVel; attribute float aSeed; varying float vS; varying float vA;
          void main(){ vec3 p=position+uVel*uTime*(0.6+aSeed*0.8); p.x+=sin(uTime*(0.5+aSeed)+aSeed*40.0)*1.3; p.z+=cos(uTime*(0.4+aSeed*0.7)+aSeed*70.0)*1.3;
            p=mod(p,uBox)-uBox*0.5+vec3(0.0,8.0,0.0); vS=aSeed; vA=uTime*(1.0+aSeed*2.0)+aSeed*30.0; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=min(0.13*(0.45+aSeed*aSeed*1.1)*uScale/max(0.1,-mv.z),30.0); gl_Position=projectionMatrix*mv; if(fract(aSeed*7.31)>uDen||-mv.z<3.0) gl_Position=vec4(2.0,2.0,2.0,1.0); }`,
        fragmentShader: `uniform vec3 uA,uB; uniform float uAlpha; varying float vS; varying float vA;
          void main(){ vec2 c=gl_PointCoord-0.5; float cs=cos(vA),sn=sin(vA); c=vec2(cs*c.x-sn*c.y,sn*c.x+cs*c.y); float fl=0.74+0.26*abs(sin(vA*1.3)); c.x/=max(fl,0.1);
            vec2 q=c*vec2(2.4,2.0); float d=length(q); if(d>1.0||length(c-vec2(0.0,0.3))<0.09) discard;
            vec3 col=mix(uA,uB,clamp(c.y+0.5,0.0,1.0)*(0.5+0.5*vS))*(0.8+0.2*fl)*(1.0-0.25*exp(-c.x*c.x*300.0)); gl_FragColor=vec4(col,uAlpha*(0.55+0.45*vS)*(1.0-smoothstep(0.6,1.0,d))); }` }));
      S.petals.frustumCulled = false; S.petals.renderOrder = 15; S.petals.onBeforeRender = () => { PU.uTime.value = G.now; PU.uScale.value = renderer.domElement.height * 0.5; }; S.PU = PU; g.add(S.petals); }

    // ---------------------------------------------------------------- Issen
    const D = dressDuelist(ISSEN_LOOK), M2 = S.model = D.model; b.group.add(M2.group);
    S.shs = D.shs; S.hak = D.hak; S.sleeves = D.sleeves; S.cloak = D.cloak; S.maskMat = D.maskMat; S.eyeMat = D.eyeMat; S.scarfMat = D.scarfMat; S.ribbons = D.ribbons; S.trimM = D.trimM; S.edgeMat = D.edgeMat; S.weapon = D.weapon;
    S.rimU = { value: new THREE.Color(0xa8a0ff).multiplyScalar(0.8) }; S.rimW = { value: new THREE.Color(0xffb070).multiplyScalar(0.55) }; S.sunV = { value: new V3(0, 0, -1) }; S.fadeU = { value: 0 }; S.fadeZ = { value: 0 };
    S.drainA = { value: 0 }; S.clipA = { value: new THREE.Vector2() }; S.matsA = [];
    rimify(M2.group, D.hat.material, { rimU: S.rimU, rimW: S.rimW, sunV: S.sunV, fadeU: S.fadeU, fadeZ: S.fadeZ, drain: S.drainA, clip: S.clipA, mats: S.matsA });
    S.fake = { moveSpeed: 0, grounded: true, casting: null, parryT: 0, flashT: 0 };
    S.aura = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); S.aura.rotation.x = -PI / 2; S.aura.position.y = 0.06; b.group.add(S.aura);
    // ghosts: spectral silhouettes of Issen mid follow-through
    S.ghostMat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(ROSE).multiplyScalar(1.1) }, uA: { value: 0.4 }, uTg: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vY=wp.y; vec4 mv=viewMatrix*wp; vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uC; uniform float uA,uTg; varying vec3 vN; varying vec3 vV; varying float vY; float h(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); } void main(){ vec3 n=vN/max(length(vN),1e-4), v=vV/max(length(vV),1e-4); float f=clamp(1.0-abs(dot(n,v)),0.0,1.0); float dz=h(floor(vec2(gl_FragCoord.x*0.25,vY*14.0-uTg*3.0))); if(dz<0.12) discard; float a=(0.28+pow(f,2.0)*1.0)*uA*smoothstep(0.0,1.6,vY)*(0.7+0.3*dz); vec3 c=mix(uC,vec3(1.6,1.4,1.5),pow(f,6.0)); gl_FragColor=vec4(c*a,a); }' });
    const gGeo = [[new THREE.ConeGeometry(1.05, 1.35, 16, 1, true), 0, 0.68, 0], [new THREE.CapsuleGeometry(0.34, 0.6, 4, 10), 0, 1.75, 0], [new THREE.ConeGeometry(1.25, 0.45, 20), 0, 2.95, 0], [new THREE.SphereGeometry(0.22, 10, 8), 0, 2.6, 0]];
    S.ghosts = [];
    for (let i = 0; i < (G.nightmare ? 10 : 6); i++) {
      const gm = S.ghostMat.clone(); const gg = new THREE.Group(); gg.userData.mat = gm; for (const [geo, x, y, z] of gGeo) { const m = new THREE.Mesh(geo, gm); m.position.set(x, y, z); gg.add(m); }
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 2.8), gm); sw.position.set(0.55, 1.5, 1.2); sw.rotation.set(0.35, -0.5, 0); gg.add(sw);
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 0.9, 8, 1, true), gm); sl.position.set(0.5, 1.8, 0.35); sl.rotation.x = -1.1; gg.add(sl);
      gg.scale.setScalar(1.12); gg.visible = false; g.add(gg); S.ghosts.push({ g: gg, cut: null, mark: null });
    }
    // slash ribbon pools
    const cutG = stripGeo(48, (u, s) => [s * 0.5 * Math.cos(0.3) + Math.sin(PI * u) * 0.08, s * 0.5 * Math.sin(0.3) + Math.sin(PI * u) * 0.35, u]);
    S.vfx = { cut: [], ci: 0, arcs: {}, list: [] };
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(cutG, cutMat()); m.visible = false; m.frustumCulled = false; m.renderOrder = 13; g.add(m); const it = { m, t: 9, dur: 0.5 }; S.vfx.cut.push(it); S.vfx.list.push(it); }
    const telG = stripGeo(48, (u, s) => [s * 0.5, 0, u]); S.vfx.tel = []; S.vfx.ti = 0;
    for (let i = 0; i < 12; i++) { const mt = cutMat(); mt.uniforms.uHot.value.setRGB(1.1, 0.95, 1.0); mt.uniforms.uMode.value = 1; const m = new THREE.Mesh(telG, mt); m.visible = false; m.frustumCulled = false; m.renderOrder = 11; g.add(m); const it = { m, t: 9, dur: 0.5 }; S.vfx.tel.push(it); S.vfx.list.push(it); }
    const arcGeo = (r, w, a0, a1, n) => stripGeo(n, (u, s) => { const t = lerp(a0, a1, u), rr = r + s * w * 0.5; return [Math.sin(t) * rr, s * 0.14 + Math.sin(PI * u) * 0.25, Math.cos(t) * rr]; });
    const arcSet = (key, specs) => { S.vfx.arcs[key] = specs.map(([r, w, a0, a1, n]) => { const m = new THREE.Mesh(arcGeo(r, w, a0, a1, n), cutMat()); m.visible = false; m.frustumCulled = false; m.renderOrder = 13; g.add(m); const it = { m, t: 9, dur: 0.5 }; S.vfx.list.push(it); return it; }); };
    arcSet('c', [[3.6, 1.4, -1.75, 1.75, 48], [6.1, 1.8, 1.75, -1.75, 56], [8.5, 1.6, -1.75, 1.75, 64]]);
    arcSet('o', [[5.7, 1.6, 0, TAU, 96], [9.0, 2.0, TAU, 0, 112], [12.4, 2.1, 0, TAU, 128]]);
    arcSet('n', [[2.8, 1.4, 0, TAU, 64], [5.5, 1.9, TAU, 0, 96]]);
    // petal-storm bullets: own blossom orb drawn just over the shared white-hot core (saturated pink body, small pale core, tight halo)
    S.orb = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.ShaderMaterial({ uniforms: { uTime: EU.uTime },
      vertexShader: 'uniform float uTime; varying float vF; varying vec3 vL; void main(){ vL=position; ' + IMW + 'vec4 wp=mw*vec4(position,1.0); vec3 n=mat3(mw)*normal; n/=max(length(n),1e-5); vec3 v=cameraPosition-wp.xyz; v/=max(length(v),1e-5); vF=clamp(dot(n,v),0.0,1.0); gl_Position=projectionMatrix*viewMatrix*wp; }',
      fragmentShader: 'uniform float uTime; varying float vF; varying vec3 vL; void main(){ float k=clamp(vF,0.0,1.0); float lob=0.5+0.5*cos(atan(vL.z,vL.x+1e-4)*5.0+uTime*2.0); vec3 rim=vec3(1.0,0.34,0.58), body=vec3(0.82,0.1,0.3)*(0.85+0.15*lob), core=vec3(1.15,0.78,0.88);\n vec3 c=mix(rim,body,smoothstep(0.0,0.5,k)); c=mix(c,core,smoothstep(0.955,0.995,k)); gl_FragColor=vec4(clamp(c,vec3(0.0),vec3(1.3)),1.0); }' }), 320);
    S.orb.count = 0; S.orb.frustumCulled = false; g.add(S.orb); S.M4 = new THREE.Matrix4();
    S.orbHalo = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), haloMat(new THREE.Color(0xff3a78).multiplyScalar(0.22)), 320); S.orbHalo.count = 0; S.orbHalo.frustumCulled = false; S.orbHalo.renderOrder = 14; g.add(S.orbHalo);
    S.lanes = []; S.eye = null; S.stormUntil = 0;
    S.cuts = []; S.haste = 0; S.nitenT = 0; S.nitenStep = 0; S.stepAt = []; S.tellT = 1.2; S.still = false; S.warn = 0; S.graceT = 0; S.walk = false; S.kneel = 0; S.night = 0; S.open = 0; S.torn = false; S.tv = new V3();
    // ---------------------------------------------------------------- nightmare: everything is built here and hidden (nothing is made mid-fight)
    S.A = { name: 'A', ent: b, root: b.group, model: S.model, D, fake: S.fake, aura: S.aura, col: ROSE, ice: PALE, drainU: S.drainA, clipU: S.clipA, mats: S.matsA, drain: 0, still: false, warn: 0, open: 0, graceT: 0, hold: false,
      get kneel() { return S.kneel; }, set kneel(v) { S.kneel = v; } };
    if (G.nightmare) {
      const veilMat = (c) => new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(c) }, uA: { value: 0 }, uT: EU.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ vU=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uA,uT; varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4), v=vV/max(length(vV),1e-4); float f=1.0-clamp(abs(dot(n,v)),0.0,1.0); float w=0.5+0.5*sin(vU.y*34.0-uT*2.6+sin(vU.x*31.4+uT*0.7)*2.0); float a=uA*(0.02+0.3*f*f*f)*(0.5+0.5*w)*smoothstep(0.0,0.2,vU.y)*(1.0-smoothstep(0.55,0.95,vU.y)); gl_FragColor=vec4(uC*a,1.0); }' });
      const veil = (parent, c) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 3.6, 28, 1, true), veilMat(c)); m.position.y = 1.8; m.visible = false; m.renderOrder = 12; parent.add(m); return m; };
      S.A.veil = veil(b.group, 0x9ab8ff);
      // his reflection: the same costume in moon-blue, mirrored (sword in the left hand), already torn
      const RD = dressDuelist(REFL_LOOK), root = new THREE.Group(); root.rotation.order = 'YXZ'; RD.model.group.scale.set(-1.72, 1.72, 1.72); root.add(RD.model.group); root.visible = false; g.add(root);
      for (const [a, c] of RD.cloak) { a.visible = false; c.visible = true; } RD.sleeves[1].scale.y = 0.75; RD.sleeves[1].position.y = -0.24; for (const r of RD.ribbons.slice(0, 2)) { r.len *= 1.4; r.amp *= 1.35; r.trail += 0.8; r.f *= 1.25; }
      const Rr = S.R = { name: 'R', root, model: RD.model, D: RD, fake: { moveSpeed: 0, grounded: true, casting: null, parryT: 0, flashT: 0 }, col: BLUE, ice: ICE, drainU: { value: 0 }, clipU: { value: new THREE.Vector2() }, mats: [], fadeU: { value: 0 },
        kneel: 0, drain: 0, still: false, warn: 0, open: 0, graceT: 0, hold: false, ox: 0, oz: 0, img: 0 };
      Rr.rimU = { value: new THREE.Color(0x5a8cff).multiplyScalar(1.25) }; Rr.rimW = { value: new THREE.Color(0xa8c8ff).multiplyScalar(0.75) };
      rimify(RD.model.group, RD.hat.material, { rimU: Rr.rimU, rimW: Rr.rimW, sunV: S.sunV, fadeU: Rr.fadeU, fadeZ: Rr.fadeU, drain: Rr.drainU, clip: Rr.clipU, mats: Rr.mats });
      Rr.aura = new THREE.Mesh(S.aura.geometry, S.aura.material.clone()); Rr.aura.rotation.x = -PI / 2; Rr.aura.position.y = 0.06; root.add(Rr.aura); Rr.veil = veil(root, 0x9ab8ff);
      // its body for the fight: shares Issen's health (hits land on him), joins the fight in phase IV
      const e = Rr.ent = new Ent({ name: 'ISSEN, REFLECTED', hp: 1, radius: 0.9, aimY: 1.6 }); e.isAdd = true; e.def = { name: e.name }; e.hpOwner = b; e.immune = true; e.targetable = false; e.onDeath = () => {}; e.pos.set(0, 0, -16);
      // the seam: a pale line drawn along x = 0 in phase III, kept for the rest of the fight
      S.seamP = { value: 0 };
      S.seam = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2 * (R - 0.25), 1, 1).rotateX(-PI / 2), new THREE.ShaderMaterial({ uniforms: { uP: S.seamP, uT: EU.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4,
        vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform float uP,uT; varying vec2 vU; void main(){ float al=1.0-vU.y; if(al>uP) discard; float x=abs(vU.x*2.0-1.0); float core=exp(-x*x*14.0); float tip=1.0-smoothstep(0.0,0.05,uP-al); float sh=0.75+0.25*sin(al*90.0+uT*1.7); vec3 c=vec3(0.75,0.8,1.0)*core*0.55*sh+vec3(1.0,0.92,0.96)*tip*core*1.4; c*=smoothstep(0.0,0.015,al)*(1.0-smoothstep(0.985,1.0,al)); gl_FragColor=vec4(c,1.0); }' }));
      S.seam.position.y = 0.016; S.seam.visible = false; S.seam.renderOrder = 4; g.add(S.seam);
      // the two-coloured deck of phase IV: rose over x < 0, moon blue over x > 0
      S.duoL = [[-7.5, ROSE], [7.5, BLUE]].map(([x, c]) => { const L = new THREE.PointLight(c, 0, 21, 1.2); L.position.set(x, 3.8, -1); g.add(L); return L; });
      // blue petal-storm orbs (one instance kept so the warm-up frame compiles them)
      const ob = S.orb.material.clone(); ob.uniforms.uTime = EU.uTime; ob.fragmentShader = ob.fragmentShader.replace('vec3 rim=vec3(1.0,0.34,0.58), body=vec3(0.82,0.1,0.3)', 'vec3 rim=vec3(0.5,0.68,1.0), body=vec3(0.1,0.24,0.78)').replace('core=vec3(1.15,0.78,0.88)', 'core=vec3(0.86,0.96,1.2)');
      S.orbB = new THREE.InstancedMesh(S.orb.geometry, ob, 200); S.orbB.frustumCulled = false; S.orbB.setMatrixAt(0, new THREE.Matrix4().makeScale(0, 0, 0)); S.orbB.count = 1; g.add(S.orbB);
      S.orbHaloB = new THREE.InstancedMesh(S.orbHalo.geometry, haloMat(new THREE.Color(0x3a78ff).multiplyScalar(0.22)), 200); S.orbHaloB.frustumCulled = false; S.orbHaloB.renderOrder = 14; S.orbHaloB.setMatrixAt(0, new THREE.Matrix4().makeScale(0, 0, 0)); S.orbHaloB.count = 1; g.add(S.orbHaloB);
      // a hit on the still body: no damage, a ripple instead of IMMUNE, and (once per cycle, after the grace) the Counter
      const still = (act) => (info, ent) => { if (!S.niten || !act.still) return false; if (!G.headless) { FX.ring(ent.pos.x, ent.pos.z, { r0: 0.6, r1: 2.4, color: ICE, dur: 0.45, width: 0.12, mult: 1.2 }); }
        // only a hit on the still one while he is the selected target counters (a cleave or a stray bolt that catches him does not)
        if (info.src === 'player' && G.now >= act.graceT && !S.countered && G.player && G.player.target === ent) { S.countered = true; S.cycleClean = false; Co.start(counterN(b, act), 'phase'); } return true; };
      b.onImmuneHit = still(S.A); e.onImmuneHit = still(Rr);
      // the calm places: a pale streak of still air on the deck for each cut lane, a pale disc for the Eye of the Moon
      const calmMat = (disc) => new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 }, uLen: { value: 10 }, uC: { value: new THREE.Color(0xffe0ea) }, uT: EU.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3,
        vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: disc
          ? 'uniform float uA,uT; uniform vec3 uC; varying vec2 vU; void main(){ float r=clamp(length(vU*2.0-1.0),0.0,1.0); float rim=smoothstep(0.84,0.95,r)*(1.0-smoothstep(0.95,1.0,r)); float fill=0.16*(1.0-smoothstep(0.7,1.0,r))*(0.85+0.15*sin(r*26.0-uT*3.0)); gl_FragColor=vec4(uC*uA*(fill+0.75*rim),1.0); }'
          : 'uniform float uA,uLen,uT; uniform vec3 uC; varying vec2 vU; void main(){ float x=abs(vU.x*2.0-1.0); float ends=smoothstep(0.0,0.05,vU.y)*(1.0-smoothstep(0.95,1.0,vU.y)); float edge=smoothstep(0.8,0.94,x)*(1.0-smoothstep(0.94,1.0,x)); float core=0.2*(1.0-smoothstep(0.55,0.95,x)); float sh=0.8+0.2*sin(vU.y*uLen*2.2+uT*3.5); gl_FragColor=vec4(uC*uA*ends*(core*sh+0.7*edge),1.0); }' });
      S.laneM = []; S.laneI = 0;
      for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2), calmMat(false)); m.visible = false; m.renderOrder = 5; m.frustumCulled = false; g.add(m); S.laneM.push(m); }
      S.eyeM = new THREE.Mesh(new THREE.PlaneGeometry(2 * CALM.eyeR, 2 * CALM.eyeR).rotateX(-PI / 2), calmMat(true)); S.eyeM.visible = false; S.eyeM.renderOrder = 5; S.eyeM.frustumCulled = false; g.add(S.eyeM);
    }
    b.onDamaged = (amt, info) => { if (S.still && !S.countered && G.now >= S.graceT && info.src === 'player') { S.countered = true; Co.start(counter(b), 'phase'); } };
    if (G.nightmare) deepenFn(b)(1); // nightmare opens at sunset (its grade comes through nightmare.post), torn haori from the first frame
    return { edge: 'wall', radius: R, spawn: { x: 0, z: 10 }, bossStart: { x: 0, z: -5, face: 0 }, contains: (x, z) => x * x + z * z <= R * R,
      camLimit(x, y, z) { const r = Math.hypot(x, z); if (r > 25) { x *= 25 / r; z *= 25 / r; } return { x, y: Math.min(y, 15), z }; } };
  }

  // ---------------------------------------------------------------- cut visuals
  function vStart(it, x, y, z, dir, o = {}) {
    const m = it.m, u = m.material.uniforms; m.position.set(x, y, z); m.rotation.set(0, dir, 0); m.visible = true;
    it.t = o.delay ? -o.delay : 0; it.dur = o.dur || 0.5; u.uT.value = 0; u.uSeed.value = vrand() * 50; u.uSweep.value = o.sweep || 0.25;
    u.uCol.value.set(o.col || ROSE).multiplyScalar(o.mult || 1.4);
  }
  function vCut(b, x, z, dir, len, col) {
    if (G.headless) return; const V = b.state.vfx, it = V.cut[V.ci = (V.ci + 1) % V.cut.length];
    vStart(it, x, 1.0, z, dir, { dur: 0.42 + len * 0.006, sweep: 0.26, col: col === PALE ? 0xff6aa0 : col === BLUE || col === ICE ? 0x5a8cff : 0xe8306a, mult: col === BLUE || col === ICE ? 1.15 : 1.0 }); it.m.scale.set(1.15, 1, Math.max(0.5, len));
    for (let d = 0; d < len; d += 1.4) FX.burst(x + Math.sin(dir) * d, 0.9, z + Math.cos(dir) * d, { n: 2, smoke: true, color: col === BLUE || col === ICE ? 0x060c1a : 0x1a0610, color2: 0x050104, alpha: 0.75, speed: [1.5, 4], dir: [Math.cos(dir), 0.4, -Math.sin(dir)], spread: 0.5, life: [0.3, 0.6], size: [0.12, 0.3], grav: 4, drag: 2 });
  }
  // tapered ink-brush stroke with a white-hot core drawn along a line telegraph while it fills
  function vTele(b, x, z, dir, len, t, col = 0xff6a88) {
    if (G.headless) return; const V = b.state.vfx, it = V.tel[V.ti = (V.ti + 1) % V.tel.length], tail = 0.3;
    vStart(it, x, 0.035, z, dir, { dur: t + tail, sweep: t / (t + tail), col, mult: 0.7 }); it.m.scale.set(2.75, 1, Math.max(0.5, len));
  }
  function vArcs(b, key, x, z, dir = 0, blue = false) {
    if (G.headless) return; b.state.vfx.arcs[key].forEach((it, i) => { vStart(it, x, 0.85 + i * 0.12, z, dir, { delay: i * 0.05, dur: 1.0, sweep: 0.16, col: blue ? (i % 2 ? 0x7aa0ff : 0x3a6ae8) : i % 2 ? 0xff5a86 : 0xe82a5a, mult: 1.5 }); });
    const rs = { c: [3.6, 6.1, 8.5], o: [5.7, 9, 12.4], n: [2.8, 5.5] }[key], span = key === 'c' ? 3.5 : TAU;
    for (const r of rs) for (let k = 0; k < 7; k++) { const a = dir + (key === 'c' ? -1.75 : 0) + span * (k + 0.5) / 7; FX.burst(x + Math.sin(a) * r, 1.0, z + Math.cos(a) * r, { n: 3, color: blue ? ICE : PALE, color2: blue ? BLUE : ROSE, speed: [0.5, 2.5], life: [0.6, 1.3], size: [0.1, 0.22], grav: 1.5, drag: 1.2 }); }
  }

  const tele = (b, t) => t * Math.pow(0.86, b.state.haste);
  function petals(x, z, n = 30, c = PALE) { FX.burst(x, 1.2, z, { n, color: c, color2: c === ICE ? BLUE : ROSE, speed: [1, 7], life: [0.5, 1.3], size: [0.1, 0.28], grav: 2, drag: 1.5 }); }
  function cutFx(b, x, z, dir, len, col = 0xffffff) {
    vCut(b, x, z, dir, len, col); Sound.sfx('sword', 0.9, 0.8 + vrand() * 0.3); Sound.sfx('slash', 0.8);
    if (!G.headless) for (let d = 0; d < len; d += 1.6) FX.burst(x + Math.sin(dir) * d, 0.9, z + Math.cos(dir) * d, { n: 3, color: col === BLUE ? ICE : PALE, color2: col === BLUE ? BLUE : ROSE, speed: [0.5, 3], life: [0.4, 1.0], size: [0.1, 0.25], up: 1 });
    FX.shake(0.2);
  }
  function addGhost(b, cut) {
    const S = b.state, gh = S.ghosts.find((q) => !q.cut); if (!gh) return; gh.cut = cut; gh.g.visible = true; gh.g.position.set(cut.x, 0, cut.z); gh.g.rotation.y = cut.dir;
    gh.g.userData.mat.uniforms.uC.value.set(cut.blue ? BLUE : ROSE).multiplyScalar(1.1);
    gh.mark = Hz.mark({ type: 'rect', x: cut.x, z: cut.z, dir: cut.dir, len: cut.len, w: 0.35 }, 60, { color: cut.blue ? BLUE : ROSE, alpha: 0.45 });
  }
  // phase III: the lake remembers the cut too. A pale blue ghost at the mirror image across the seam (x -> -x, angle -> -angle)
  function mirrorGhost(b, cut) { const mc = { x: -cut.x, z: cut.z, dir: -cut.dir, len: cut.len, blue: true, pair: cut }; cut.pair = mc; addGhost(b, mc); if (!G.headless) petals(mc.x, mc.z, 12, ICE); return mc; }
  function* drawCut(b, n) {
    const S = b.state, p = G.player; S.walk = false;
    for (let i = 0; i < n; i++) {
      const a = b.angToPlayer(); b.facing = a; const len = Math.max(6, edgeLen(b.pos.x, b.pos.z, a)), cut = { x: b.pos.x, z: b.pos.z, dir: a, len };
      S.fake.parryT = 1; const t = tele(b, i === 0 ? 0.95 : 0.72);
      Hz.rect(cut.x, cut.z, a, len, 2.3, t, 310, { name: 'Draw Cut', color: ROSE, quiet: true, silent: i > 0 }); vTele(b, cut.x, cut.z, a, len, t);
      yield t; S.fake.parryT = 0; S.model.swing(1, 0.25); cutFx(b, cut.x, cut.z, a, len); addGhost(b, cut); if (S.lake && i < 2) mirrorGhost(b, cut);
      b.pos.x += Math.sin(a) * len; b.pos.z += Math.cos(a) * len; petals(b.pos.x, b.pos.z, 14); yield 0.3;
    }
    b.facing = b.angToPlayer(); yield 0.5;
  }
  // mode 0: one at a time. 1: in pairs. 2: all at once.
  function* echo(b, mode, caster = b) {
    const S = b.state, list = S.ghosts.filter((q) => q.cut && !q.cut.blue), blues = S.ghosts.filter((q) => q.cut && q.cut.blue); if (!list.length && !blues.length) return;
    yield* caster.cast({ name: 'Echo', time: 0.9 });
    const t = tele(b, mode === 2 ? 1.3 : 0.8), late = blues.length ? 0.45 : 0;
    const fire = (gh, tt, silent) => { const c = gh.cut; Hz.cancel(gh.mark); laneLeave(S, c, tt);
      if (c.blue) vTele(b, c.x, c.z, c.dir, c.len, tt, BLUE_T); else vTele(b, c.x, c.z, c.dir, c.len, tt);
      Hz.rect(c.x, c.z, c.dir, c.len, 2.3, tt, 270, { name: 'Echo', color: c.blue ? BLUE : ROSE, quiet: true, silent, onFire: () => { cutFx(b, c.x, c.z, c.dir, c.len, c.blue ? BLUE : PALE); gh.g.visible = false; gh.cut = null; } }); };
    for (let i = 0; i < list.length; i++) {
      const gh = list[i]; fire(gh, t, i > 0);
      const pr = gh.cut.pair && blues.find((q) => q.cut === gh.cut.pair); if (pr) { blues.splice(blues.indexOf(pr), 1); fire(pr, t + 0.45, true); }
      if (mode === 0 || (mode === 1 && i % 2 === 1)) yield tele(b, 0.55);
    }
    for (const gh of blues) fire(gh, t + 0.45, true);
    yield t + 0.5 + late;
  }
  function clearGhosts(S) { for (const gh of S.ghosts) { if (gh.mark) Hz.cancel(gh.mark); gh.cut = null; gh.g.visible = false; } }
  function* moon(b, kinds) {
    const S = b.state; S.walk = false;
    for (const k of kinds) {
      const t = tele(b, 0.95), x = b.pos.x, z = b.pos.z, a = b.angToPlayer(); b.facing = a; S.fake.parryT = 1;
      const fx = () => { S.model.swing(k === 'c' ? 1 : 0, 0.3); Sound.sfx('sword'); Sound.sfx('boom', 0.5); FX.shake(0.3); };
      if (k === 'c') Hz.cone(x, z, a, 3.5, 9.5, t, 320, { name: 'Crescent', color: ROSE, quiet: true, onFire: () => { fx(); vArcs(b, 'c', x, z, a); petals(x + Math.sin(a) * 4, z + Math.cos(a) * 4, 20); } });
      else if (k === 'o') Hz.donut(x, z, 4.2, 14, t, 320, { name: 'Full Moon', color: ROSE, quiet: true, onFire: () => { fx(); vArcs(b, 'o', x, z, vrand() * TAU); petals(x, z, 40); } });
      else Hz.circle(x, z, 6.6, t, 320, { name: 'New Moon', color: ROSE, quiet: true, onFire: () => { fx(); FX.dome(x, 0.5, z, { r: 6.6, color: ROSE, dur: 0.4, mult: 1.1 }); vArcs(b, 'n', x, z, vrand() * TAU); } });
      yield t * 0.72;
    }
    yield 0.5; S.fake.parryT = 0; yield 0.4;
  }
  // tell before Stillness: 1.2 s of blade glint, a closing pale ring and a rising chime, then a short grace when he kneels,
  // so a 1.5 s Bolt started on the tell still lands safely and in-flight hits are not punished
  const STILL_TELL = 1.2, STILL_GRACE = 0.35;
  function* stillness(b, dur = 2.3) {
    const S = b.state; S.walk = false; b.facing = b.angToPlayer(); S.warn = 0.001;
    Sound.sfx('glint', 0.9); FX.flash(0xfff4e0, 0.16, 2.2);
    if (!G.headless) { FX.ring(b.pos.x, b.pos.z, { r0: 7.5, r1: 1.3, color: 0xfff4e0, dur: STILL_TELL, width: 0.24, mult: 1.7 }); FX.light(b.pos.x, 3, b.pos.z, 0xfff0d0, 45, STILL_TELL, 18); }
    yield STILL_TELL;
    S.warn = 0; S.still = true; S.graceT = G.now + STILL_GRACE; S.countered = false; S.kneel = 1; Sound.sfx('bell', 0.45, 3); b.facing = b.angToPlayer();
    yield* b.cast({ name: 'Stillness', time: dur });
    S.still = false; S.kneel = 0;
    if (!S.countered) { S.open = 3.2; b.dmgTaken = 1.6; petals(b.pos.x, b.pos.z, 24); yield 3.2; b.dmgTaken = 1; } else yield 1.0;
  }
  function* counter(b) {
    const S = b.state, p = G.player; FX.flash(0xffffff, 0.3, 4); Sound.sfx('parry', 0.8, 0.7); petals(b.pos.x, b.pos.z, 30);
    const a = p.facing + PI, ox = b.pos.x, oz = b.pos.z; let tx = p.pos.x + Math.sin(a) * 2.2, tz = p.pos.z + Math.cos(a) * 2.2; const d = Math.hypot(tx, tz); if (d > 14) { tx *= 14 / d; tz *= 14 / d; }
    yield 0.22; b.pos.x = tx; b.pos.z = tz; b.facing = b.angToPlayer(); S.model.swing(1, 0.2);
    const cl = Math.hypot(tx - ox, tz - oz); if (cl > 0.5) vCut(b, ox, oz, Math.atan2(tx - ox, tz - oz), cl, 0xffffff); Sound.sfx('crit'); FX.slash(p.pos.x, 1.2, p.pos.z, b.facing, { r: 3.5, color: 0xffffff, dur: 0.3, mult: 1.6 });
    p.hurt(NM(520, 380), { blockable: true, src: { name: 'Counter' } });
  }
  // Haste is tied to the phase (no Focus cast to stop): Normal phases 1-3 give 0, 1, 2 stacks; Nightmare gives 1, 1, 2, 2, and
  // the third stack comes with Niten's last ramp step. Each stack shortens his telegraphs by 14% (see tele). Focus is where a new stack shows.
  const hasteFor = (b) => G.nightmare ? [1, 1, 2, 2][Math.max(0, Math.min(3, b.phase))] + (b.state.nitenStep >= 5 ? 1 : 0) : Math.min(3, Math.max(0, b.phase));
  function* focus(b) {
    const S = b.state, h = hasteFor(b);
    if (h > S.haste) { S.haste = h; FX.dome(b.pos.x, 1, b.pos.z, { r: 6, color: ROSE, dur: 0.6 }); Sound.sfx('roar', 0.6, 2.2); FX.flash(ROSE, 0.25, 3); petals(b.pos.x, b.pos.z, 30); }
    yield 0.3;
  }
  function* petalStorm(b, dur = 6.5, arms = 4) {
    const S = b.state; S.walk = false; petals(b.pos.x, b.pos.z, 20); b.pos.set(0, 0, 0); petals(0, 0, 40);
    yield* b.cast({ name: 'Petal Storm', time: 1.2 });
    let t = 0, a0 = rnd(TAU); const dirSign = rnd() < 0.5 ? 1 : -1;
    while (t < dur) { for (let k = 0; k < arms; k++) { const a = a0 + k / arms * TAU; Bul.fire({ x: Math.sin(a) * 1.2, z: Math.cos(a) * 1.2, dir: a, speed: 6.2, dmg: 85, color: 0xd8467a, r: 0.36, life: 3.6, petal: 1 }); Bul.fire({ x: Math.sin(a + 0.16) * 1.2, z: Math.cos(a + 0.16) * 1.2, dir: a + 0.16, speed: 6.2, dmg: 85, color: 0xd8467a, r: 0.36, life: 3.6, petal: 1 }); } a0 += dirSign * 0.105; b.facing += dirSign * 0.9; if (Math.floor(t / 0.36) !== Math.floor((t - 0.12) / 0.36)) S.model.swing(1, 0.3); t += 0.12; yield 0.12; }
    b.facing = b.angToPlayer(); yield 0.7;
  }
  function* finalVerse(b, n = 9, mirror = false) {
    const S = b.state; S.walk = false; yield* b.cast({ name: 'Final Verse', time: 1.1 });
    petals(b.pos.x, b.pos.z, 40); b.targetable = false; b.group.visible = false; S.verse = true; Co.start(Post.lerpTo({ sat: 0.75, vig: 1.05 }, 0.4), 'fight');
    for (let i = 0; i < n; i++) {
      const qa = rnd(TAU), qr = i % 3 === 0 ? 0 : rnd(2, 10), p = G.player, qx = i % 3 === 0 ? p.pos.x : Math.sin(qa) * qr, qz = i % 3 === 0 ? p.pos.z : Math.cos(qa) * qr, dir = rnd(TAU), ox = qx - Math.sin(dir) * 20, oz = qz - Math.cos(dir) * 20;
      vTele(b, ox, oz, dir, 40, tele(b, 1.2)); Hz.rect(ox, oz, dir, 40, 2.1, tele(b, 1.2), 300, { name: 'Final Verse', color: ROSE, quiet: true, silent: true, onFire: () => cutFx(b, ox, oz, dir, 40, i % 2 ? PALE : 0xffffff) }); Sound.sfx('tick', 1, 1 + i * 0.08);
      if (mirror && i % 3 === 2) verseLine(b, -ox, oz, -dir, tele(b, 1.2) + 0.45, true);
      yield tele(b, 0.27);
    }
    yield tele(b, 1.2) + (mirror ? 0.45 : 0); S.verse = false; Co.start(Post.lerpTo({ sat: 1.08, vig: 0.9 }, 0.5), 'fight');
    const p = G.player, a = rnd(TAU); let tx = p.pos.x + Math.sin(a) * 4, tz = p.pos.z + Math.cos(a) * 4; const d = Math.hypot(tx, tz); if (d > 13) { tx *= 13 / d; tz *= 13 / d; }
    b.pos.set(tx, 0, tz); b.group.visible = true; b.targetable = true; petals(tx, tz, 40); b.facing = b.angToPlayer(); yield 0.4;
  }
  function verseLine(b, ox, oz, dir, t, blue) {
    vTele(b, ox, oz, dir, 40, t, blue ? BLUE_T : 0xff6a88); Hz.rect(ox, oz, dir, 40, 2.1, t, 300, { name: 'Final Verse', color: blue ? BLUE : ROSE, quiet: true, silent: true, onFire: () => cutFx(b, ox, oz, dir, 40, blue ? BLUE : 0xffffff) });
  }
  // phase 2 mood: the sun sinks lower and redder, more petals
  function* deepen(b) { yield* W.tween(3, deepenFn(b)); }
  function deepenFn(b) {
    const S = b.state, U = S.sky.material.uniforms, E = S.EU, C = (h) => new THREE.Color(h);
    const hor0 = U.uHor.value.clone(), cc0 = U.uCloudCol.value.clone(), d0 = U.uSunDir.value.clone(), d1 = new V3(-0.27, 0.032, -0.96).normalize(), suc0 = U.uSunCol.value.clone(), pc0 = S.poolMat.uniforms.uC.value.clone(), eh0 = E.uHor.value.clone(), ef0 = E.uFogC.value.clone(), sc0 = S.sun.color.clone(), top0 = U.uTop.value.clone(), et0 = E.uTop.value.clone(), mf0 = E.uMtnF.value.clone(), hs0 = S.hemi.color.clone(), sg0 = U.uSunGlow.value, si0 = S.sun.intensity, dk0 = S.deckM.color.clone(), rp0 = S.rope.color.clone();
    return (k) => {
      W.colorLerp(U.uHor.value, hor0, C(0xff5a24), k); W.colorLerp(U.uCloudCol.value, cc0, C(0xff7a48), k); W.colorLerp(U.uTop.value, top0, C(0x2a1e5a), k); W.colorLerp(E.uTop.value, et0, C(0x5a3a70), k); W.colorLerp(E.uMtnF.value, mf0, C(0x5a3a6a), k); U.uSunGlow.value = lerp(sg0, 2.2, k); W.colorLerp(U.uSunCol.value, suc0, new THREE.Color(0.28, 0.085, 0.018), k); S.lampMat.uniforms.uK.value = lerp(1.25, 1.65, k); S.floatMat.uniforms.uK.value = lerp(1.1, 1.5, k); S.lampHalo.uniforms.uC.value.setRGB(1, 0.36, 0.08).multiplyScalar(lerp(0.3, 0.5, k)); S.floatHalo.uniforms.uC.value.setRGB(1, 0.32, 0.06).multiplyScalar(lerp(0.32, 0.5, k)); W.colorLerp(S.poolMat.uniforms.uC.value, pc0, new THREE.Color(0xff9a40).multiplyScalar(0.6), k); for (const L of S.pls) L.intensity = lerp(50, 85, k); S.PU.uDen.value = lerp(0.45, 1, k); S.sun.intensity = lerp(si0, 3.0, k); W.colorLerp(S.hemi.color, hs0, C(0x6a8cb8), k); U.uSunDir.value.lerpVectors(d0, d1, k).normalize(); E.uSunDir.value.copy(U.uSunDir.value);
      W.colorLerp(E.uHor.value, eh0, C(0xb04a3a), k); W.colorLerp(E.uFogC.value, ef0, C(0xa04a44), k); W.colorLerp(S.deckM.color, dk0, new THREE.Color(0.74, 0.6, 0.66), k); W.colorLerp(S.rope.color, rp0, new THREE.Color(0.42, 0.33, 0.32), k); W.colorLerp(S.sun.color, sc0, C(0xff8a48), k); S.PU.uAlpha.value = lerp(0.9, 1.0, k); S.PU.uVel.value.set(lerp(0.8, 2.6, k), lerp(-0.7, -0.9, k), lerp(0.35, 0.9, k)); S.windU.value = lerp(0.35, 1.6, k);
    };
  }
  // phase 3: night-dusk blue with a blood moon; deck kept near neutral so telegraphs read
  function* nightfall(b) { yield* W.tween(4.5, nightfallFn(b)); }
  function nightfallFn(b) {
    const S = b.state, U = S.sky.material.uniforms, E = S.EU, C = (h) => new THREE.Color(h);
    const snap = (o) => o.clone(), top0 = snap(U.uTop.value), hor0 = snap(U.uHor.value), bot0 = snap(U.uBot.value), sc0 = snap(U.uSunCol.value), d0 = snap(U.uSunDir.value), d1 = new V3(-0.25, 0.055, -0.97).normalize(), cc0 = snap(U.uCloudCol.value), cd0 = snap(U.uCloudDark.value);
    const e0 = {}; for (const k of ['uTop', 'uHor', 'uSunCol', 'uFogC', 'uMtnF', 'uMtnN', 'uDeep', 'uPet', 'uMist']) e0[k] = snap(E[k].value);
    const e1 = { uTop: C(0x1c1a48), uHor: C(0x5a1828), uSunCol: C(0xff3020), uFogC: C(0x3a1424), uMtnF: C(0x1c1c34), uMtnN: C(0x08080f), uDeep: C(0x0e0b20), uPet: C(0x6a1830), uMist: C(0x3a3660) };
    const sI0 = S.sun.intensity, sun0 = snap(S.sun.color), hs0 = snap(S.hemi.color), hg0 = snap(S.hemi.groundColor), fog0 = snap(scene.fog.color), bl0 = snap(S.blossom.color), be0 = snap(S.blossom.emissive), la0 = snap(S.lampMat.uniforms.uC.value), sh0 = snap(S.shide.color), sg1 = U.uSunGlow.value, dc0 = snap(S.deckM.color), pa0 = snap(S.PU.uA.value), pb0 = snap(S.PU.uB.value), pl0 = snap(S.pls[0].color), rim0 = snap(S.rimU.value), rw0 = snap(S.rimW.value), fa0 = snap(S.fallen.color), po0 = snap(S.poolMat.uniforms.uC.value), fi0 = snap(S.fill.color);
    return (k) => {
      W.colorLerp(U.uTop.value, top0, C(0x020208), k); W.colorLerp(U.uHor.value, hor0, C(0x5a1224), k); W.colorLerp(U.uBot.value, bot0, C(0x05040a), k); W.colorLerp(U.uSunCol.value, sc0, C(0x9a1610), k);
      U.uSunDir.value.lerpVectors(d0, d1, k).normalize(); U.uSunSize.value = lerp(0.12, 0.8, k); U.uStars.value = k * 0.8; U.uSunGlow.value = lerp(sg1, 1.1, k);
      W.colorLerp(U.uCloudCol.value, cc0, C(0x2a2040), k); W.colorLerp(U.uCloudDark.value, cd0, C(0x06040c), k); U.uCloud.value = lerp(0.5, 0.38, k);
      for (const key in e1) W.colorLerp(E[key].value, e0[key], e1[key], k); E.uSunDir.value.copy(U.uSunDir.value); E.uGlowK.value = lerp(1, 0.8, k); E.uStreak.value = k * 0.75; E.uRedG.value = k * 1.4; W.colorLerp(S.rimW.value, rw0, new THREE.Color(0xff3040).multiplyScalar(1.4), k);
      W.colorLerp(S.sun.color, sun0, C(0xd04a5a), k); S.sun.intensity = lerp(sI0, 1.8, k); W.colorLerp(S.hemi.color, hs0, C(0x3a4a80), k); W.colorLerp(S.hemi.groundColor, hg0, C(0x4a1420), k); S.hemi.intensity = lerp(0.95, 1.05, k);
      W.colorLerp(S.fill.color, fi0, C(0x6a5cc0), k); W.colorLerp(scene.fog.color, fog0, C(0x26101c), k); S.windU.value = lerp(S.windU.value, 0.6, k * 0.05); S.deckM.envMapIntensity = lerp(0.3, 0.4, k); S.deckM.roughness = lerp(1, 0.72, k); W.colorLerp(S.deckM.color, dc0, new THREE.Color(1.15, 0.92, 0.92), k); S.fill.intensity = lerp(0.55, 0.3, k); W.colorLerp(S.shide.color, sh0, C(0x6a6078), k);
      W.colorLerp(S.blossom.color, bl0, C(0x9a2a44), k); W.colorLerp(S.blossom.emissive, be0, C(0xc01838), k); S.blossom.emissiveIntensity = lerp(0.22, 0.32, k);
      W.colorLerp(S.lampMat.uniforms.uC.value, la0, C(0xffb070), k); S.lampMat.uniforms.uK.value = Math.max(S.lampMat.uniforms.uK.value, lerp(1.25, 1.8, k)); for (const L of S.pls) W.colorLerp(L.color, pl0, C(0xffa060), k);
      W.colorLerp(S.PU.uA.value, pa0, C(0xc01838), k); W.colorLerp(S.PU.uB.value, pb0, C(0xff6070), k);
      W.colorLerp(S.rimU.value, rim0, new THREE.Color(0x8aa0ff).multiplyScalar(0.8), k); S.rope.emissiveIntensity = 0; W.colorLerp(S.fallen.color, fa0, C(0xd04058), k); W.colorLerp(S.poolMat.uniforms.uC.value, po0, new THREE.Color(0xffa060).multiplyScalar(1.05), k); S.night = k;
    };
  }

  // ---------------------------------------------------------------- phase bodies shared by Normal and Nightmare
  function* sunsetRun(b) {
    const S = b.state;
    while (true) {
      yield* focus(b); yield* drawCut(b, 4); yield* echo(b, 1); S.walk = true; yield 1.0;
      yield* petalStorm(b); yield* moon(b, ['c', 'n', 'o']); S.walk = true; yield 0.8;
      yield* stillness(b); yield* drawCut(b, 4); yield* moon(b, ['o', 'c']); yield* echo(b, 1); S.walk = true; yield 1.0;
    }
  }
  function* nightEnter(b) { const S = b.state; clearGhosts(S); S.walk = false; b.pos.set(0, 0, 0); b.facing = 0; S.kneel = 1; Sound.sfx('bell', 0.9, 0.6); Co.start(Post.lerpTo({ bloom: 0.5, threshold: 1.0, tint: [0.96, 0.98, 1.06], exposure: 1.1, sat: 1.05, vig: 0.78, lift: [0.012, 0.012, 0.024] }, 4), 'fight'); yield* nightfall(b); S.kneel = 0; Sound.sfx('sword'); petals(0, 0, 80, 0xff3050); yield 0.6; }
  function* nightRun(b) {
    const S = b.state;
    while (true) {
      yield* finalVerse(b, 9); yield* moon(b, ['c', 'o']); yield* drawCut(b, 5); yield* echo(b, 2); S.walk = true; yield 0.8;
      yield* focus(b); yield* stillness(b, 3.0); yield* petalStorm(b, 6, 5); yield* moon(b, ['n', 'o', 'c', 'n']); S.walk = true; yield 0.6;
    }
  }
  // ================================================================ NIGHTMARE ("Niten")
  // Co.stopTag('phase') skips a coroutine's cleanup, so every per-mechanic state a cut-off mechanic can leave behind (kneel,
  // stillness ring, hidden or untargetable body, verse grade, sheathed blade, slow time, a held mirror, a cinematic camera) is
  // reset here: in every nightmare phase's enter and in the last blow. Who is awake and who is still is not per-mechanic: it stays.
  const other = (S, act) => act === S.A ? S.R : S.A;
  function resetMech(b) {
    const S = b.state; S.walk = false; S.warn = 0; S.still = false; S.kneel = 0; S.open = 0; S.countered = false; b.dmgTaken = 1; S.fake.parryT = 0; S.tellT = STILL_TELL;
    b.group.visible = true; b.targetable = true; if (S.weapon) S.weapon.visible = true; G.timeScale = 1;
    S.lanes = []; S.eye = null; S.calmHint = null; S.storm = null; S.stormHold = false; S.unison = false; S.echoing = false; S.moonK = null; S.stormUntil = 0; S.waking = null; S.cycleCuts = 0; S.cycleMirror = false;
    if (S.verse) { S.verse = false; Co.start(Post.lerpTo({ sat: 1.08, vig: 0.9 }, 0.4), 'fight'); }
    if (S.cine) { S.cine = false; Cam.release(); UI.hud(true); }
    const Rr = S.R; if (!Rr) return;
    for (const act of [S.A, Rr]) { act.warn = 0; act.hold = false; act.open = 0; act.ent.dmgTaken = 1; act.fake.parryT = 0; }
    Rr.kneel = 0; Rr.D.weapon.visible = true; Rr.root.visible = !!S.niten; Rr.ent.targetable = !!S.niten; Rr.root.rotation.x = 0; Rr.ent.castState = null;
  }
  // Out of time (the last blow, 24 s into the enrage, in whatever phase): the music stops dead, he sheathes the sword (in phase IV both do), one petal falls past
  // the camera in silence, the whole deck fills, and a single white cut crosses it (two crossing cuts in phase IV).
  // He can still be cut down while it winds up.
  function* lastPetal(b) {
    const S = b.state, twin = !!S.niten; resetMech(b); clearGhosts(S); b.facing = b.angToPlayer();
    Music.stop(0.08); G.timeScale = 0.6; S.model.swing(0, 0.6); if (twin) S.R.model.swing(0, 0.6); Sound.sfx('sword', 0.5, 0.45);
    yield 0.55; if (S.weapon) S.weapon.visible = false; if (twin) S.R.D.weapon.visible = false; Sound.sfx('parry', 0.5, 0.5); S.kneel = 0.25; if (twin) S.R.kneel = 0.25;
    if (!G.headless) { const c = camera.position, f = camera.getWorldDirection(S.tv); FX.burst(c.x + f.x * 2.4, c.y + 0.9, c.z + f.z * 2.4, { n: 1, color: PALE, color2: ROSE, speed: [0.05, 0.2], life: [3.2, 3.4], size: [0.16, 0.18], grav: 0.35, drag: 2.5 }); }
    yield 0.75; G.timeScale = 1;
    const T = 5.5;
    Hz.circle(0, 0, R + 0.5, T, 0, { blockable: false, name: 'The Last Petal', color: PALE, quiet: true, onFire: () => {
      const p = G.player, a = p ? Math.atan2(p.pos.x, p.pos.z) + PI / 2 : 0;
      FX.flash(0xffffff, 0.7, 2.2); cutFx(b, -Math.sin(a) * R, -Math.cos(a) * R, a, R * 2, 0xffffff); if (twin) { const a2 = a + PI / 2; cutFx(b, -Math.sin(a2) * R, -Math.cos(a2) * R, a2, R * 2, BLUE); } FX.shake(0.6); Sound.sfx('crit');
      if (p && p.alive) p.hurt(9999, { blockable: false, src: 'enrage', pierce: true });
    } });
    yield T + 0.4; S.kneel = 0; if (twin) S.R.kneel = 0;
    while (true) yield 1;
  }

  // ---------------------------------------------------------------- phase III, "the lake remembers": teaches the mirror before the second body exists
  function* lakeEnter(b) {
    const S = b.state; resetMech(b); clearGhosts(S); S.walk = false;
    petals(b.pos.x, b.pos.z, 30); b.pos.set(0, 0, -R + 1.3); b.facing = 0; petals(b.pos.x, b.pos.z, 30); Sound.sfx('sword', 0.8, 0.6); S.model.swing(2, 0.4); S.kneel = 0.3;
    yield 0.5;
    // the blade tip drawn along the deck, north to south through the centre: the seam stays, and the lake goes glass-flat
    S.seam.visible = true; const z0 = b.pos.z, z1 = R - 1.3, T = 2.4, w0 = S.windU.value; let t = 0; S.walk = false;
    while (t < T) { t += G.dt; const k = smooth(Math.min(1, t / T)); b.pos.z = lerp(z0, z1, k); b.facing = 0; S.seamP.value = Math.min(1, (b.pos.z + R) / (2 * R) + 0.02); S.EU.uCalm.value = k; S.windU.value = lerp(w0, 0.08, k);
      if (!G.headless && vrand() < 0.6) FX.burst(b.pos.x + 0.25, 0.05, b.pos.z + 1.4, { n: 1, color: ICE, color2: PALE, speed: [0.5, 2], up: 1.2, life: [0.3, 0.6], size: [0.06, 0.12] }); yield; }
    S.seamP.value = 1; S.EU.uCalm.value = 1; S.lake = true; S.kneel = 0;
    petals(b.pos.x, b.pos.z, 40, ICE); Sound.sfx('bell', 0.6, 0.9); yield 0.6;
    b.facing = b.angToPlayer(); yield 0.3;
  }
  function lakeSkip(b) { const S = b.state; S.seam.visible = true; S.seamP.value = 1; S.EU.uCalm.value = 1; S.lake = true; S.windU.value = 0.08; }
  function nightSkip(b) { nightfallFn(b)(1); Object.assign(Post.cur, { bloom: 0.5, threshold: 1.0, tint: [0.96, 0.98, 1.06], exposure: 1.1, sat: 1.05, vig: 0.78, lift: [0.012, 0.012, 0.024] }); Post.apply(); }
  // the mirrored cut and the blue echo come first, so the mirror is seen at least twice before the reflection exists
  function* lakeRun(b) {
    const S = b.state; yield 0.4;
    while (true) {
      yield* focus(b); yield* drawCut(b, 5); yield* echo(b, 1); S.walk = true; yield 0.8;
      yield* finalVerse(b, 7, true); yield* moon(b, ['n', 'o']); S.walk = true; yield 0.6;
      yield* stillness(b, 3.0); S.walk = true; yield 0.8;
    }
  }
  // Nightmare's teaching phases are about 30 s each with one idea each, so the idea comes early in a short loop.
  // Sunset: Stillness and its Counter (what Niten is built on) inside the first 10 s.
  function* sunsetNM(b) {
    const S = b.state; yield 0.8;
    while (true) {
      yield* focus(b); yield* drawCut(b, 4); S.walk = true; yield 0.5;
      yield* stillness(b); yield* echo(b, 1); S.walk = true; yield 0.8;
      yield* moon(b, ['c', 'n', 'o']); yield* petalStorm(b); S.walk = true; yield 1.0;
    }
  }
  // Nightfall: Final Verse first
  function* nightNM(b) {
    const S = b.state;
    while (true) {
      yield* focus(b); yield* finalVerse(b, 9); yield* moon(b, ['c', 'o']); S.walk = true; yield 0.6;
      yield* stillness(b, 3.0); yield* drawCut(b, 5); yield* echo(b, 2); S.walk = true; yield 0.8;
    }
  }

  // ---------------------------------------------------------------- phase IV, Niten: two bodies, one health, exactly one can be hurt
  // "Blade and Storm", made relentless (issen-intensity-ideas.md, options A + B). The awake one is the blade: Draw Cuts and Moons,
  // move to move with no walking. The still one is the storm: he kneels where he gave the swap tell (blinking in to KNEEL_R from the
  // centre if he was further out) and channels the Lighthouse Storm for as long as he is still. The swap (Stillness) flips the roles.
  // Every Draw Cut's ghost stays on the deck; the swap's Waking Cut sets them all off, and surviving it earns the opening. Each body
  // owns its position; the blade never ends a walk or a dash within KEEP of the still one. Calm places: a fresh Draw Cut leaves a
  // petal-free lane for CALM.laneLife s, a Full Moon's safe hole is petal-free (the Eye of the Moon), and in Twin Petal Storm every
  // standing ghost line is petal-free.
  // Levers (indexed by ramp step where it is an array): the storm, then the calm places. The plan's starting values were 3 arms from
  // step 3, rest 1.2 s (0 from step 4), lanes 3.0 s and two cuts everywhere; the cast-budget check in tools/nmpace.js (Stormcaller
  // must not lose planted-cast time to the old phase) pulled the levers in the plan's order: longer rest, 2 arms, 4 s lanes, one cut
  // at steps 3-5. row: seconds between an arm's 3-petal rows (0.4 leaves a gap you can step through as the arm passes).
  // "The storm never sleeps" (issen-intensity-ideas.md, option A): the Lighthouse Storm now runs the whole phase. It stops only for
  // the two unison set pieces (and a Counter); at a swap the old still one's petals fly out while the new one starts from his own
  // kneel spot after a short gather (swapTell). One arm at steps 0-1, two from step 2, three from step 4; turn speed per step
  // (rad/s); from step flipFrom it turns back once per breath.
  const STORM = { arms: [1, 1, 2, 2, 3, 3], turn: [0.7, 0.8, 0.9, 0.9, 1.0, 1.1], flipFrom: 3, width: 3, spread: 0.12, row: 0.4, speed: 5.0, dmg: 85, life: 3.6, tell: 1.2, swapTell: 0.5 };
  const CALM = { laneLife: 4.0, laneW: 2.6, eyeR: 3.8, eyeAfter: 1.5 };
  // "Standing cuts and the Waking Cut" (option B): every Draw Cut's ghost stays on the deck; the swap's Waking Cut sets them all off.
  //   cuts: Draw Cuts per swap cycle by step, laid in chains of at most `chain` with `breath` s between chains (a Bolt fits).
  //   tell: the Waking Cut's tell, started with the swap tell. From step `twoWaves` every other cut is claimed by the still one (his
  //   colour) and fires `wave2` s later. From step `mirror` the lake adds one mirrored ghost per cycle (the still one's colour, wave 2).
  //   openBreath: the blade's first chain waits this long after a swap (the opening is the waker's own burn).
  //   laneAfter: a fired Waking Cut line stays petal-free this long (the opening's calm place: the cut cleans the air).
  //   dmg: a Waking Cut hit (once per swap); a hit also costs the opening unless missOpen. unisonCuts: share of cuts in a set-piece bracket.
  const WAKE = { cuts: [2, 3, 4, 4, 5, 6], chain: 3, breath: 1.8, openBreath: 2.6, tell: 1.3, wave2: 0.6, twoWaves: 2, mirror: 4, dmg: 300, missOpen: false, unisonCuts: 0.5, laneAfter: 3.2 };
  // The two set-piece changes, separate levers: standing ghost lines stay petal-free through Twin Petal Storm (stormGhostCalm), and
  // Final Verse comes in beats (verseBeats lines each, verseRest s still moment between, the blade shows and can be hit; null = one run).
  const SET = { stormGhostCalm: true, verseBeats: [3, 2, 2], verseRest: 1.6 };
  const KEEP = 3, KNEEL_R = 9, STILL_KNEEL = 0.6;
  const lead = (S) => S.lead;
  const stillOf = (S) => other(S, S.lead);
  function wake(b, act, first) {
    const S = b.state, o = other(S, act); S.lead = act;
    act.still = false; act.ent.immune = false; o.still = true; o.ent.immune = true; act.kneel = 0;
    if (!first && !G.headless) { const e = act.ent; FX.ring(e.pos.x, e.pos.z, { r0: 0.8, r1: 5.5, color: act.col, dur: 0.6, width: 0.3, mult: 1.6 }); FX.light(e.pos.x, 2.5, e.pos.z, act.col, 40, 0.6, 14); petals(e.pos.x, e.pos.z, 26, act.ice); }
    if (!first) Sound.sfx('bell', 0.55, act === S.A ? 0.5 : 0.62);
  }
  // The swap. The storm keeps blowing through it (option A). The Waking Cut starts with the tell: every standing ghost telegraphs
  // at once (WAKE.tell; the still one's wave WAKE.wave2 later) and fires as he wakes. Survive it and the one who wakes is open
  // (3.2 s at 1.6x) from the moment the last wave lands; a hit costs WAKE.dmg and the opening. Then the board is clean.
  function* swap(b) {
    const S = b.state, A = S.lead, B = other(S, A), e = A.ent, p = G.player; S.walk = false;
    e.facing = angTo(e.pos.x, e.pos.z, p.pos.x, p.pos.z); A.warn = 0.001;
    Sound.sfx('glint', 0.9); FX.flash(0xfff4e0, 0.16, 2.2);
    const T = S.tellT || STILL_TELL; // 1.2 s, 0.9 s at Niten's last ramp step
    if (!G.headless) { FX.ring(e.pos.x, e.pos.z, { r0: 7.5, r1: 1.3, color: 0xfff4e0, dur: T, width: 0.24, mult: 1.7 }); FX.light(e.pos.x, 3, e.pos.z, 0xfff0d0, 45, T, 18); }
    const wk = S.waking = wakingCut(b, B);
    yield T;
    A.warn = 0; A.graceT = G.now + STILL_GRACE; A.kneel = 1;
    // he kneels where he gave the tell; from further out than KNEEL_R he petal-blinks in on the same bearing, so the storm has room
    { const d = Math.hypot(e.pos.x, e.pos.z); if (d > KNEEL_R) { petals(e.pos.x, e.pos.z, 18, A.ice); e.pos.x *= KNEEL_R / d; e.pos.z *= KNEEL_R / d; petals(e.pos.x, e.pos.z, 24, A.ice); } }
    wake(b, B); S.countered = false; const tk = G.now;
    while (G.now < wk.end) yield;
    // the opening is earned by the Waking Cut, not by the cycle (a Counter is its own punishment: 380, no lost opening)
    S.wakeLog = S.wakeLog || []; S.wakeLog.push({ n: wk.n, hit: wk.hit, t: G.ft });
    if (!wk.hit || WAKE.missOpen) { B.open = 3.2; B.ent.dmgTaken = 1.6; petals(B.ent.pos.x, B.ent.pos.z, 24); }
    S.waking = null; S.cycleCuts = 0; S.cycleMirror = false;
    yield Math.max(0, 1.0 - (G.now - tk)); if (A.still) A.kneel = STILL_KNEEL;
  }
  // the Waking Cut: every standing ghost (and the lake's mirror) telegraphs from now and fires; one hit at most per swap
  function wakingCut(b, W) {
    const S = b.state, res = { hit: false, end: G.now, n: 0, cuts: [] }, hs = [];
    for (const gh of S.ghosts) {
      const c = gh.cut; if (!c) continue; const tt = WAKE.tell + (c.wave === 2 ? WAKE.wave2 : 0); res.end = Math.max(res.end, G.now + tt); res.n++; res.cuts.push(c);
      if (gh.mark) Hz.cancel(gh.mark); gh.mark = null; laneLeave(S, c, tt);
      vTele(b, c.x, c.z, c.dir, c.len, tt, c.blue ? BLUE_T : 0xff6a88);
      hs.push(Hz.rect(c.x, c.z, c.dir, c.len, 2.3, tt, WAKE.dmg, { name: 'Waking Cut', color: c.blue ? BLUE : ROSE, quiet: true, silent: hs.length > 0,
        onFire: () => { cutFx(b, c.x, c.z, c.dir, c.len, c.blue ? BLUE : PALE); if (gh.cut === c) { gh.g.visible = false; gh.cut = null; } if (WAKE.laneAfter > 0) addLane(b, Object.assign({}, c), WAKE.laneAfter); },
        onHit: () => { res.hit = true; for (const h of hs) h.dmg = 0; } }));
    }
    if (res.n && !G.headless) { const e = W.ent; FX.ring(e.pos.x, e.pos.z, { r0: 0.6, r1: 3.2, color: W.col, dur: 0.5, width: 0.2, mult: 1.4 }); Sound.sfx('sword', 0.7, 0.6); }
    return res;
  }
  function* counterN(b, act) {
    const S = b.state, p = G.player, e = act.ent; act.hold = true; FX.flash(0xffffff, 0.3, 4); Sound.sfx('parry', 0.8, 0.7); petals(e.pos.x, e.pos.z, 30, act.ice);
    const a = p.facing + PI, ox = e.pos.x, oz = e.pos.z; let tx = p.pos.x + Math.sin(a) * 2.2, tz = p.pos.z + Math.cos(a) * 2.2; const d = Math.hypot(tx, tz); if (d > 14) { tx *= 14 / d; tz *= 14 / d; }
    yield 0.22; e.pos.x = tx; e.pos.z = tz; e.facing = angTo(tx, tz, p.pos.x, p.pos.z); act.model.swing(1, 0.2);
    const cl = Math.hypot(tx - ox, tz - oz); if (cl > 0.5) vCut(b, ox, oz, Math.atan2(tx - ox, tz - oz), cl, act === S.R ? ICE : 0xffffff); Sound.sfx('crit'); FX.slash(p.pos.x, 1.2, p.pos.z, e.facing, { r: 3.5, color: 0xffffff, dur: 0.3, mult: 1.6 });
    p.hurt(380, { blockable: true, src: { name: 'Counter' } });
    yield 0.55; petals(e.pos.x, e.pos.z, 18, act.ice); act.hold = false;
  }
  // ---- calm places: petal-free lanes (Draw Cut) and the Eye of the Moon (Full Moon). Only this boss's petals are removed.
  function inLane(L, x, z) { const dx = x - L.x, dz = z - L.z, s = Math.sin(L.dir), c = Math.cos(L.dir), u = dx * s + dz * c, v = dx * c - dz * s; return u > -0.6 && u < L.len + 0.6 && Math.abs(v) < L.w / 2; }
  function addLane(b, cut, life = CALM.laneLife) {
    const S = b.state, L = { x: cut.x, z: cut.z, dir: cut.dir, len: cut.len, w: CALM.laneW, t0: G.now, until: G.now + life, cut, leave: false };
    S.lanes.push(L); S.calmV = (S.calmV || 0) + 1; if (S.laneM) { const m = S.laneM[S.laneI = (S.laneI + 1) % S.laneM.length]; m.userData.L = L; m.position.set(L.x + Math.sin(L.dir) * L.len / 2, 0.022, L.z + Math.cos(L.dir) * L.len / 2); m.rotation.y = L.dir; m.scale.set(L.w, 1, L.len + 1.2); m.material.uniforms.uLen.value = L.len; m.material.uniforms.uC.value.set(cut.blue ? 0xb8ccff : 0xffe0ea); }
    return L;
  }
  // an Echo on a ghost turns its lane back into a blade: the lane stops being offered as calm and ends when the echo lands
  function laneLeave(S, cut, t) { if (S.lanes) for (const L of S.lanes) if (L.cut === cut) { L.leave = true; L.until = Math.min(L.until, G.now + t); S.calmV = (S.calmV || 0) + 1; } }
  // when (seconds from now) does a petal flying from (x, z) along dir at speed enter a live calm place? (it dies there; Infinity if never)
  function calmEntry(S, x, z, dir, speed) {
    let best = Infinity; const vx = Math.sin(dir) * speed, vz = Math.cos(dir) * speed;
    for (const L of S.lanes) { const s = Math.sin(L.dir), c = Math.cos(L.dir), dx = x - L.x, dz = z - L.z, u = dx * s + dz * c, v = dx * c - dz * s, du = vx * s + vz * c, dv = vx * c - vz * s;
      let t0 = 0, t1 = L.until - G.now; for (const [p0, d0, lo, hi] of [[u, du, -0.6, L.len + 0.6], [v, dv, -L.w / 2, L.w / 2]]) { if (Math.abs(d0) < 1e-6) { if (p0 <= lo || p0 >= hi) t1 = -1; } else { let a = (lo - p0) / d0, b2 = (hi - p0) / d0; if (a > b2) [a, b2] = [b2, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b2); } }
      if (t0 < t1 && t0 < best) best = t0; }
    const E = S.eye; if (E) { const dx = x - E.x, dz = z - E.z, bb = dx * vx + dz * vz, vv = vx * vx + vz * vz, cc = dx * dx + dz * dz - E.r * E.r, disc = bb * bb - vv * cc;
      if (disc >= 0 && vv > 1e-9) { const t = Math.max(0, (-bb - Math.sqrt(disc)) / vv); if ((-bb + Math.sqrt(disc)) / vv > 0 && t < E.until - G.now && t < best) best = t; } }
    return best;
  }
  function calmSim(b) {
    const S = b.state; if (S.lanes.length) { const n = S.lanes.length; S.lanes = S.lanes.filter((L) => G.now < L.until); if (S.lanes.length !== n) S.calmV = (S.calmV || 0) + 1; } if (S.eye && G.now >= S.eye.until) { S.eye = null; S.calmV = (S.calmV || 0) + 1; }
    // every petal knows where it will die (stopAt, its own clock): the autopilot's bullet forecast then sees a calm place as calm
    for (const q of Bul.list) if (q.petal && q.cv !== S.calmV) { q.cv = S.calmV; const t = calmEntry(S, q.x, q.z, q.dir, q.speed); if (t < Infinity) q.stopAt = q.t + t; else delete q.stopAt; }
    if (!S.lanes.length && !S.eye) return;
    let fx = 0;
    for (const q of Bul.list) { if (!q.petal || q.dead) continue; let kill = !!(S.eye && Math.hypot(q.x - S.eye.x, q.z - S.eye.z) < S.eye.r);
      if (!kill) for (const L of S.lanes) if (inLane(L, q.x, q.z)) { kill = true; break; }
      if (kill) { q.dead = true; if (!G.headless && fx++ < 6) FX.burst(q.x, q.y, q.z, { n: 4, color: 0xffffff, color2: q.petal === 2 ? ICE : PALE, speed: [0.5, 2.2], life: [0.25, 0.55], size: [0.08, 0.18], grav: 1.5, drag: 1.5 }); } }
  }
  // the calm spot the autopilot is told about (tests: a pocket-blind autopilot ignores it): next to the duelist inside the Eye, or
  // the nearest point of a live lane while the storm blows (ranged only; melee stays on the blade, who stands at the lane's end)
  function calmHintOf(b) {
    const S = b.state, p = G.player; if (!p) return null;
    if (S.eye) { const dx = p.pos.x - S.eye.x, dz = p.pos.z - S.eye.z, d = Math.hypot(dx, dz) || 1; return { x: S.eye.x + dx / d * 2.3, z: S.eye.z + dz / d * 2.3 }; }
    if ((S.storm !== 'on' && !S.unison) || p.cls.melee) return null;
    // a point on a live lane near the player, preferably 7 m or more from the blade (who stands at the lane's far end, Moons ready)
    let best = null, bs = S.unison ? 30 : 9; const e = S.lead.ent;
    for (const L of S.lanes) { if (L.leave || L.until - G.now < 0.8) continue; const s = Math.sin(L.dir), c = Math.cos(L.dir), lo = Math.min(1.5, L.len / 2);
      for (let u = lo; u <= L.len - lo + 1e-6; u += 1) { const x = L.x + s * u, z = L.z + c * u, de = Math.hypot(x - e.pos.x, z - e.pos.z), sc = Math.hypot(p.pos.x - x, p.pos.z - z) + Math.max(0, 7 - de) * 1.5; if (sc < bs) { bs = sc; best = { x, z }; } } }
    return best;
  }
  // is a storm petal about to pass the player within t seconds? (a Draw Cut tell waits for the arm to pass)
  function armSoon(p, t) { for (const q of Bul.list) { if (!q.storm) continue; const vx = Math.sin(q.dir) * q.speed, vz = Math.cos(q.dir) * q.speed, rx = p.pos.x - q.x, rz = p.pos.z - q.z, vv = vx * vx + vz * vz || 1e-6, k = clamp((rx * vx + rz * vz) / vv, 0, t); if (Math.hypot(rx - vx * k, rz - vz * k) < q.r + 1.1) return true; } return false; }
  // when will a storm arm next reach (x, z)? (autopilot only, through def.danger: a player reads the arm and plants just after it
  // has passed). Infinity in a calm place or with no storm; the pocket-blind autopilot does not know the calm places.
  function armAt(b, x, z) {
    const S = b.state; if (!S.niten || !S.storm || !S.lead) return Infinity;
    if (!Bot.pocketBlind) { if (S.eye && Math.hypot(x - S.eye.x, z - S.eye.z) < S.eye.r - 0.6) return Infinity; for (const L of S.lanes) if (!L.leave && inLane({ x: L.x, z: L.z, dir: L.dir, len: L.len - 0.8, w: L.w - 1.0 }, x, z)) return Infinity; }
    const F = stillOf(S), e = F.ent, dx = x - e.pos.x, dz = z - e.pos.z, d = Math.hypot(dx, dz), fly = Math.max(0, d - 1.1) / STORM.speed;
    // the arm points at stA when the breath starts (rem s from now during the tell) and turns stSg * STORM.turn; a petal reaches d after fly
    const cs = S.storm === 'tell' && e.castState, rem = cs ? Math.max(0, cs.time - cs.t) : 0;
    const n = STORM.arms[S.nitenStep], per = TAU / n, hw = (STORM.width - 1) / 2 * STORM.spread + 0.95 / Math.max(d, 1), w = STORM.turn[S.nitenStep];
    const rel = ((S.stSg * (Math.atan2(dx, dz) - S.stA)) % per + per) % per, x0 = cs ? 0 : -w * Math.min(fly, S.stT || 0);
    const m = Math.ceil((x0 - rel - hw) / per), v = Math.max(x0, rel + m * per - hw);
    return Math.max(0, rem + v / w + fly);
  }
  // ---- the Lighthouse Storm: the still one's channel, its own coroutine beside nitenRun, and it never sleeps (option A). A tell
  // (STORM.tell, STORM.swapTell right after a swap) each time it starts, then STORM.arms thick arms (STORM.width petals across)
  // turning from his kneel spot. Held only by the unison brackets (Final Verse, Twin Petal Storm) and his own Counter; at a swap
  // the old arms' petals fly out while the new still one gathers. From step flipFrom it turns back once per breath.
  const stormFree = (S) => S.niten && S.lead && !S.unison && G.now >= S.stormUntil && !stillOf(S).hold;
  function* stormLoop(b) {
    const S = b.state; let quick = false;
    while (true) {
      while (!stormFree(S)) { quick = false; yield 0.05; }
      const F = stillOf(S), e = F.ent, bl = F === S.R;
      // the tell: his cast bar and petals gathering; cancelled if a hold starts
      S.storm = 'tell'; petals(e.pos.x, e.pos.z, 20, F.ice); S.stA = rnd(TAU); S.stSg = rnd() < 0.5 ? 1 : -1; S.stT = 0; // the breath's start angle and turn are set at the tell
      const cs = e.castState = { name: 'Petal Storm', t: 0, time: quick ? STORM.swapTell : STORM.tell, int: false, result: null };
      while (cs.t < cs.time && stormFree(S) && stillOf(S) === F) { cs.t += G.dt; yield; }
      if (e.castState === cs) e.castState = null;
      if (cs.t < cs.time) { S.storm = null; quick = stormFree(S); continue; }
      S.storm = 'on'; let a0 = S.stA, sg = S.stSg, t = 0, rowT = 0, sw = 0; const flip = S.nitenStep >= STORM.flipFrom ? rnd(2.5, 5) : Infinity;
      while (stormFree(S) && stillOf(S) === F) {
        const dt = G.dt; t += dt; a0 += sg * STORM.turn[S.nitenStep] * dt; rowT -= dt; if (t > flip && t - dt <= flip) sg = -sg;
        S.stA = a0; S.stSg = sg; S.stT = t;
        if (rowT <= 0) { rowT += STORM.row; const n = STORM.arms[S.nitenStep], w = STORM.width, ex = e.pos.x, ez = e.pos.z;
          for (let k = 0; k < n; k++) for (let j = 0; j < w; j++) { const a = a0 + k / n * TAU + (j - (w - 1) / 2) * STORM.spread;
            Bul.fire({ x: ex + Math.sin(a) * 1.1, z: ez + Math.cos(a) * 1.1, dir: a, speed: STORM.speed, dmg: STORM.dmg, color: bl ? 0x4a7ae0 : 0xd8467a, r: 0.36, life: STORM.life, petal: bl ? 2 : 1, storm: 1 }); } }
        e.facing = a0; if ((sw -= dt) <= 0) { sw = 0.6; F.model.swing(1, 0.3); }
        yield;
      }
      S.storm = null; quick = stormFree(S); // still free: the swap handed the storm to the other body
    }
  }
  // Niten Draw Cut: the blade alone (no mirror cut). Each cut leaves a petal-free lane for CALM.laneLife s and a ghost that STAYS
  // until the swap's Waking Cut. From WAKE.twoWaves every other cut of the cycle is claimed by the still one (his colour, wave 2);
  // from WAKE.mirror the cycle's first cut also leaves the lake's mirrored ghost. A tell never starts just before a storm arm
  // reaches the player; the dash stops short rather than end within KEEP of the still one.
  function* nitenCut(b, n) {
    const S = b.state, p = G.player; S.walk = false;
    for (let i = 0; i < n; i++) {
      { let w = 0; while (w < 1.5 && S.storm === 'on' && armSoon(p, 0.4)) { w += 0.05; yield 0.05; } }
      const L = S.lead, F = other(S, L), e = L.ent, a = angTo(e.pos.x, e.pos.z, p.pos.x, p.pos.z); e.facing = a;
      const full = Math.max(6, edgeLen(e.pos.x, e.pos.z, a)); let len = full;
      for (let q = full; q >= 3; q -= 0.5) { if (Math.hypot(e.pos.x + Math.sin(a) * q - F.ent.pos.x, e.pos.z + Math.cos(a) * q - F.ent.pos.z) >= KEEP) { len = q; break; } }
      const idx = S.cycleCuts = (S.cycleCuts || 0) + 1, w2 = S.nitenStep >= WAKE.twoWaves && idx % 2 === 0;
      const cut = { x: e.pos.x, z: e.pos.z, dir: a, len, blue: L === S.R, wave: 1 };
      L.fake.parryT = 1; const t = tele(b, i === 0 ? 0.95 : 0.72);
      Hz.rect(cut.x, cut.z, a, len, 2.3, t, 310, { name: 'Draw Cut', color: L.col, quiet: true, silent: i > 0 }); vTele(b, cut.x, cut.z, a, len, t, cut.blue ? BLUE_T : 0xff6a88);
      yield t; L.fake.parryT = 0; L.model.swing(1, 0.25);
      cutFx(b, cut.x, cut.z, a, len, cut.blue ? BLUE : 0xffffff); addLane(b, cut);
      if (w2) { cut.wave = 2; cut.blue = F === S.R; } // the still one claims it: his colour, his (second) wave
      addGhost(b, cut);
      if (S.nitenStep >= WAKE.mirror && !S.cycleMirror) { S.cycleMirror = true; const mc = { x: -cut.x, z: cut.z, dir: -cut.dir, len: cut.len, blue: F === S.R, wave: 2 }; addGhost(b, mc); petals(mc.x, mc.z, 12, F.ice); }
      e.pos.x += Math.sin(a) * len; e.pos.z += Math.cos(a) * len; petals(e.pos.x, e.pos.z, 14, L.ice); yield 0.3;
    }
    const e = S.lead.ent; e.facing = angTo(e.pos.x, e.pos.z, p.pos.x, p.pos.z); yield 0.5;
  }
  // Twin Focus is Niten's ramp bell: it plays at the start of every ramp step (both bodies: dome, roar, flash, petals), the
  // wordless signal that something new is coming. A new haste stack (step 5) shows with it.
  function* twinFocus(b) {
    const S = b.state, L = S.lead, F = other(S, L); S.haste = Math.max(S.haste, hasteFor(b));
    for (const act of [L, F]) { FX.dome(act.ent.pos.x, 1, act.ent.pos.z, { r: 6, color: act.col, dur: 0.6 }); petals(act.ent.pos.x, act.ent.pos.z, 30, act.ice); }
    Sound.sfx('roar', 0.6, 2.2); FX.flash(ROSE, 0.25, 3); S.bells = (S.bells || 0) + 1;
    yield 0.6;
  }
  // Twin Final Verse (unison, storm held): both vanish; rose lines and their blue mirrors 0.45 s late. In beats (SET.verseBeats):
  // after each beat but the last the blade shows for SET.verseRest s near the player (a Bolt fits; he can be hit), then vanishes
  // again. They come back at their own spots: the blade near the player, the still one at least 6 m from him and within KNEEL_R.
  function showAct(S, act, on) { act.ent.targetable = on; if (act === S.A) act.ent.group.visible = on; else act.root.visible = on; }
  function nearPlayer(r) { const p = G.player, a = rnd(TAU); let tx = p.pos.x + Math.sin(a) * r, tz = p.pos.z + Math.cos(a) * r; const d = Math.hypot(tx, tz); if (d > 13) { tx *= 13 / d; tz *= 13 / d; } return [tx, tz]; }
  function* twinFinalVerse(b, n = 7) {
    const S = b.state, Rr = S.R; S.walk = false; yield* S.lead.ent.cast({ name: 'Final Verse', time: 1.1 });
    for (const act of [S.A, Rr]) petals(act.ent.pos.x, act.ent.pos.z, 40, act.ice);
    showAct(S, S.A, false); showAct(S, Rr, false); S.verse = true; Co.start(Post.lerpTo({ sat: 0.75, vig: 1.05 }, 0.4), 'fight');
    const beats = SET.verseBeats || [n];
    for (let bi = 0; bi < beats.length; bi++) {
      for (let i = 0; i < beats[bi]; i++) {
        const qa = rnd(TAU), qr = i % 3 === 0 ? 0 : rnd(2, 10), p = G.player, qx = i % 3 === 0 ? p.pos.x : Math.sin(qa) * qr, qz = i % 3 === 0 ? p.pos.z : Math.cos(qa) * qr, dir = rnd(TAU), ox = qx - Math.sin(dir) * 20, oz = qz - Math.cos(dir) * 20;
        verseLine(b, ox, oz, dir, tele(b, 1.2), false); verseLine(b, -ox, oz, -dir, tele(b, 1.2) + 0.45, true); Sound.sfx('tick', 1, 1 + i * 0.08);
        yield tele(b, 0.27);
      }
      yield tele(b, 1.2) + 0.45;
      if (bi < beats.length - 1) { // the still moment: the blade stands near the player, then is gone again
        const L = S.lead, [tx, tz] = nearPlayer(5); L.ent.pos.set(tx, 0, tz); L.ent.facing = angTo(tx, tz, G.player.pos.x, G.player.pos.z); showAct(S, L, true); petals(tx, tz, 30, L.ice); Sound.sfx('sword', 0.6, 0.8);
        yield SET.verseRest; petals(L.ent.pos.x, L.ent.pos.z, 30, L.ice); showAct(S, L, false);
      }
    }
    S.verse = false; Co.start(Post.lerpTo({ sat: 1.08, vig: 0.9 }, 0.5), 'fight');
    const p = G.player, L = S.lead, F = other(S, L), [tx, tz] = nearPlayer(4);
    L.ent.pos.set(tx, 0, tz);
    let fx = -tx, fz = -tz; for (let k = 0; k < 24; k++) { const fa = rnd(TAU), fr = rnd(3, KNEEL_R), x = Math.sin(fa) * fr, z = Math.cos(fa) * fr; if (Math.hypot(x - tx, z - tz) >= 6) { fx = x; fz = z; break; } }
    { const fd = Math.hypot(fx, fz); if (fd > KNEEL_R) { fx *= KNEEL_R / fd; fz *= KNEEL_R / fd; } } F.ent.pos.set(fx, 0, fz);
    showAct(S, S.A, true); showAct(S, Rr, true); for (const act of [S.A, Rr]) { petals(act.ent.pos.x, act.ent.pos.z, 40, act.ice); act.ent.facing = angTo(act.ent.pos.x, act.ent.pos.z, p.pos.x, p.pos.z); }
    yield 0.4;
  }
  function moonAt(b, act, k, t) {
    const e = act.ent, x = e.pos.x, z = e.pos.z, p = G.player, a = angTo(x, z, p.pos.x, p.pos.z), blue = act.col === BLUE; e.facing = a; act.fake.parryT = 1;
    const fx = () => { act.model.swing(k === 'c' ? 1 : 0, 0.3); Sound.sfx('sword'); Sound.sfx('boom', 0.5); FX.shake(0.3); act.fake.parryT = 0; };
    if (k === 'c') Hz.cone(x, z, a, 3.5, 9.5, t, 320, { name: 'Crescent', color: act.col, quiet: true, onFire: () => { fx(); vArcs(b, 'c', x, z, a, blue); petals(x + Math.sin(a) * 4, z + Math.cos(a) * 4, 20, act.ice); } });
    else if (k === 'o') Hz.donut(x, z, 4.2, 14, t, 320, { name: 'Full Moon', color: act.col, quiet: true, onFire: () => { fx(); vArcs(b, 'o', x, z, vrand() * TAU, blue); petals(x, z, 40, act.ice); } });
    else Hz.circle(x, z, 6.6, t, 320, { name: 'New Moon', color: act.col, quiet: true, onFire: () => { fx(); FX.dome(x, 0.5, z, { r: 6.6, color: act.col, dur: 0.4, mult: 1.1 }); vArcs(b, 'n', x, z, vrand() * TAU, blue); } });
  }
  // Moons from the blade, one at a time (step 2, Full Moon first so the Eye is taught) or in sets of two (step 3 on), 1.15 s tell
  // before haste (at 0.95 they caused most autopilot deaths in Niten). Full Moon: its safe hole is also petal-free, from the start of
  // the tell until CALM.eyeAfter s after it lands (the Eye of the Moon). New Moon pushes you out into the petals; Crescent is a sidestep.
  const MOON1 = ['o', 'n', 'c', 'o', 'c', 'n'], MOON2 = [['o', 'c'], ['n', 'o'], ['c', 'n'], ['o', 'n']];
  function* nitenMoons(b, kinds) {
    const S = b.state; S.walk = false;
    for (const k of kinds) {
      const L = S.lead, e = L.ent, t = tele(b, 1.15); S.moonK = k;
      if (k === 'o') { S.calmV = (S.calmV || 0) + 1; S.eye = { x: e.pos.x, z: e.pos.z, r: CALM.eyeR, t0: G.now, until: G.now + t + CALM.eyeAfter, blue: L === S.R }; if (S.eyeM) { S.eyeM.position.set(e.pos.x, 0.024, e.pos.z); S.eyeM.material.uniforms.uC.value.set(L === S.R ? 0xb8ccff : 0xffe0ea); } }
      moonAt(b, L, k, t); yield t + 0.3; S.moonK = null;
    }
    yield 0.4;
  }
  // Twin Petal Storm (unison, the lighthouse held): both stand at (-4, 0) and (4, 0), two 3-arm spirals turning opposite ways for 5 s.
  // Afterwards the still one kneels where he is and the lighthouse comes back.
  function* twinStorm(b, dur = 5, arms = 3) {
    const S = b.state, L = S.lead, F = other(S, L), e = L.ent; S.walk = false; const sx = e.pos.x < 0 ? -1 : 1;
    for (const act of [L, F]) petals(act.ent.pos.x, act.ent.pos.z, 20, act.ice);
    e.pos.set(sx * 4, 0, 0); F.ent.pos.set(-sx * 4, 0, 0); for (const act of [L, F]) petals(act.ent.pos.x, act.ent.pos.z, 40, act.ice);
    // the board you built: every standing ghost line stays petal-free from the cast until the spirals have flown out
    if (SET.stormGhostCalm) for (const gh of S.ghosts) if (gh.cut) addLane(b, gh.cut, 1.2 + dur + 1.0);
    yield* e.cast({ name: 'Petal Storm', time: 1.2 });
    let t = 0, a0 = rnd(TAU); const dirSign = rnd() < 0.5 ? 1 : -1;
    while (t < dur) {
      for (const act of [S.A, S.R]) { const m = act === S.lead ? 1 : -1, x0 = act.ent.pos.x, z0 = act.ent.pos.z, bl = act === S.R;
        for (let k = 0; k < arms; k++) { const a = m * (a0 + k / arms * TAU); Bul.fire({ x: x0 + Math.sin(a) * 1.2, z: z0 + Math.cos(a) * 1.2, dir: a, speed: 6.2, dmg: 85, color: bl ? 0x4a7ae0 : 0xd8467a, r: 0.36, life: 3.6, petal: bl ? 2 : 1 }); }
        act.ent.facing += m * dirSign * 0.9; }
      a0 += dirSign * 0.105; if (Math.floor(t / 0.36) !== Math.floor((t - 0.12) / 0.36)) { S.A.model.swing(1, 0.3); S.R.model.swing(1, 0.3); } t += 0.12; yield 0.12;
    }
    for (const act of [S.A, S.R]) act.ent.facing = angTo(act.ent.pos.x, act.ent.pos.z, G.player.pos.x, G.player.pos.z); yield 0.7;
  }
  // every frame, headless too: openings run out, the awake one walks and keeps KEEP from the still one, the calm places cull petals
  function nitenSim(b, dt) {
    const S = b.state, p = G.player, L = S.lead, F = other(S, L), e = L.ent;
    if (G.state === 'fight' && !b.transitioning) S.nitenT += dt;
    for (const act of [S.A, S.R]) if (act.open > 0) { act.open -= dt; if (act.open <= 0) act.ent.dmgTaken = 1; }
    if (S.walk && b.alive && G.state === 'fight' && !e.castState && p) { const d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z); e.facing = dampAng(e.facing, angTo(e.pos.x, e.pos.z, p.pos.x, p.pos.z), 8, dt); if (d > 3.2) { const st = Math.min(d - 3.2, 4.6 * dt); e.pos.x += Math.sin(e.facing) * st; e.pos.z += Math.cos(e.facing) * st; } }
    // steer around the still one: never closer than KEEP (slides round him), never off the deck
    if (S.niten && !S.verse && b.alive && !L.hold && !F.hold) { const dx = e.pos.x - F.ent.pos.x, dz = e.pos.z - F.ent.pos.z, d = Math.hypot(dx, dz);
      if (d < KEEP) { const ux = d > 1e-3 ? dx / d : 1, uz = d > 1e-3 ? dz / d : 0; e.pos.x = F.ent.pos.x + ux * KEEP; e.pos.z = F.ent.pos.z + uz * KEEP; }
      const r = Math.hypot(e.pos.x, e.pos.z); if (r > R - 0.8) { e.pos.x *= (R - 0.8) / r; e.pos.z *= (R - 0.8) / r; } }
    calmSim(b); S.calmHint = calmHintOf(b);
    b.group.position.copy(b.pos); b.group.rotation.y = b.facing;
  }
  // the reflection's body, and both bodies' still look (drained grey-blue, white ring, water veil) and rings
  function twinLook(b, dt) {
    const S = b.state, Rr = S.R, rt = Rr.root;
    if (Rr.live) { rt.position.copy(Rr.ent.pos); rt.rotation.y = Rr.ent.facing; }
    if (rt.visible) {
      const sp = Math.hypot(rt.position.x - Rr.ox, rt.position.z - Rr.oz) / Math.max(dt, 1e-4); Rr.fake.moveSpeed = sp > 20 ? 0 : sp;
      Rr.fake.casting = Rr.ent.castState && Rr.ent.castState.name === 'Thousand-Petal Focus' ? 1 : null;
      const M = Rr.model; M.update(dt, Rr.fake); M.group.position.y = damp(M.group.position.y, -Rr.kneel * 0.55, 8, dt); M.body.rotation.x += Rr.kneel * 0.35;
      for (const r of Rr.D.ribbons) ribbonUpdate(r, G.now + 1.7, Rr.fake.moveSpeed);
      for (let i = 0; i < Rr.D.sleeves.length; i++) { const sl = Rr.D.sleeves[i]; sl.rotation.x = Math.sin(G.now * 2.1 + i * 1.7 + 0.9) * 0.1 + Math.min(Rr.fake.moveSpeed, 6) * 0.05; sl.rotation.z = sl.userData.sx * 0.13 + Math.sin(G.now * 1.6 + i + 0.9) * 0.05; }
      Rr.D.hak.rotation.x = -Math.min(Rr.fake.moveSpeed, 6) * 0.025; Rr.D.hak.scale.y = 1 - Rr.kneel * 0.25;
      const eg = 1.3 + 0.15 * Math.sin(G.now * 4 + 1), dk = 1 - 0.8 * Rr.drain; Rr.D.edgeMat.color.setRGB(0.75 * eg * dk, 1.2 * eg * dk, 2.6 * eg * dk); Rr.D.trimM.emissiveIntensity = 1.6 * (1 - 0.7 * Rr.drain);
      Rr.D.maskMat.emissiveIntensity = (2.0 + 0.6 * Math.sin(G.now * 3 + 1)) * (1 - 0.7 * Rr.drain);
      if (Rr.live && b.group.visible && vrand() < dt * 18) { const sh = Rr.D.shs[vrand() < 0.5 ? 0 : 1]; sh.getWorldPosition(S.tv); FX.burst(S.tv.x, S.tv.y + 0.1, S.tv.z, { n: 1, color: 0x6a9aff, color2: 0x0a1840, speed: [0.4, 1.4], up: 1.6, life: [0.6, 1.2], size: [0.1, 0.2], radius: 0.25 }); }
    }
    Rr.ox = rt.position.x; Rr.oz = rt.position.z;
    for (const act of [S.A, Rr]) {
      const tgt = S.niten && act.still ? 1 : act === Rr ? Rr.img : 0; act.drain = damp(act.drain, tgt, 7, dt); act.drainU.value = act.drain;
      const shown = act === S.A ? b.group.visible : rt.visible; act.veil.visible = !!(shown && S.niten && act.drain > 0.02); act.veil.material.uniforms.uA.value = act.drain;
      if (S.niten) {
        if (act.warn > 0) act.warn = Math.min(1, act.warn + dt / (S.tellT || STILL_TELL));
        const au = act.aura; au.material.opacity = act.still ? 0.45 + 0.35 * Math.sin(G.now * 12) : act.warn > 0 ? 0.25 + 0.55 * act.warn : act.open > 0 ? 0.3 : 0;
        au.material.color.setHex(act.still ? 0xffffff : act.warn > 0 ? 0xffe6b0 : 0x70ff90); au.scale.setScalar(act.still ? 1 + 0.15 * Math.sin(G.now * 6) : act.warn > 0 ? 2.6 - 1.6 * act.warn : 1.2);
      }
    }
  }
  // the shot of the fight: he kneels at the water, his image in the lake stands up without him and climbs out
  function* nitenEnter(b) {
    const S = b.state, Rr = S.R, A = S.A, rt = Rr.root; resetMech(b); clearGhosts(S); S.walk = false; S.niten = false; Music.intensity(4); S.nitenT = 0; S.nitenStep = 0; S.stepAt = [];
    petals(b.pos.x, b.pos.z, 30); b.pos.set(0, 0, -12.6); b.facing = PI; b.group.position.copy(b.pos); petals(0, -12.6, 30); S.kneel = 1;
    if (!G.headless) { S.cine = true; UI.hud(false); Co.start(Cam.shot([1.5, 0.78, -27.8], [0, 0.05, -13.8], [-0.6, 0.98, -25.6], [0, 0.3, -14.0], 5.4, 42), 'phase'); }
    // the image: upside down under the surface (drawn over the water, clipped at the water line), kneeling with him
    rt.visible = true; rt.position.set(0, -0.3, -16.2); rt.scale.set(1, -1, 1); rt.rotation.set(0, PI, 0); Rr.kneel = 1; Rr.img = 0.5; Rr.clipU.value.set(-0.3, 1);
    for (const m of Rr.mats) m.depthTest = false; rt.traverse((o) => { if (o.isMesh) o.renderOrder = 2; });
    yield 1.5;
    // he stays down; the image stands
    { let t = 0; while (t < 1.1) { t += G.dt; Rr.kneel = 1 - smooth(t / 1.1); yield; } Rr.kneel = 0; }
    yield 0.35;
    // the reflection rises through the surface at the deck edge
    S.EU.uRip.value.set(0, -16.2, G.now); Sound.sfx('boom', 0.35, 0.45);
    Rr.img = 0; Rr.clipU.value.set(0, 0); for (const m of Rr.mats) m.depthTest = true; rt.traverse((o) => { if (o.isMesh) o.renderOrder = 0; }); Rr.aura.renderOrder = 0; Rr.veil.renderOrder = 12;
    rt.scale.set(1, 1, 1); rt.position.set(0, -3.6, -16.2);
    { let t = 0; while (t < 1.2) { t += G.dt; rt.position.y = lerp(-3.6, -0.12, smooth(t / 1.2)); yield; } }
    { let t = 0; while (t < 0.5) { t += G.dt; const k = smooth(t / 0.5); rt.position.set(0, lerp(-0.12, 0, k), lerp(-16.2, -14.4, k)); yield; } }
    // he draws left-handed. One bell.
    Rr.model.swing(1, 0.45); Sound.sfx('bell', 0.9, 0.5); if (!G.headless) FX.ring(0, -14.4, { r0: 0.5, r1: 4, color: BLUE, dur: 0.6, width: 0.2, mult: 1.4 });
    yield 0.55;
    // both walk to their marks; the deck splits into two colours on the seam
    if (S.cine) { S.cine = false; Cam.release(); UI.hud(true); }
    S.kneel = 0; const ra = Rr.ent.pos; ra.set(rt.position.x, 0, rt.position.z); Rr.ent.facing = rt.rotation.y; Rr.live = true;
    { const a0 = b.pos.clone(), r0 = ra.clone(); let t = 0; while (t < 1.3) { t += G.dt; const k = smooth(t / 1.3); b.pos.lerpVectors(a0, new V3(-4, 0, -6), k); ra.lerpVectors(r0, new V3(4, 0, -6), k); b.facing = dampAng(b.facing, angTo(b.pos.x, b.pos.z, -4, -6), 10, G.dt); Rr.ent.facing = dampAng(Rr.ent.facing, angTo(ra.x, ra.z, 4, -6), 10, G.dt); S.duoL[0].intensity = 46 * k; S.duoL[1].intensity = 70 * k; yield; } }
    const p = G.player; b.facing = b.angToPlayer(); Rr.ent.facing = -b.facing;
    if (!G.ents.includes(Rr.ent)) { G.ents.push(Rr.ent); G.world.add(Rr.ent.group); }
    Rr.ent.targetable = true; S.niten = true; wake(b, A, true); S.countered = false; Rr.kneel = STILL_KNEEL; S.cycleCuts = 0; S.cycleMirror = false; S.waking = null; S.wakeLog = [];
    S.low12 = false; S.lastStorm = false; S.moonN = S.moonN2 = 0; S.stormUntil = G.now + 1.5; Co.start(stormLoop(b), 'phase');
    yield 0.3;
  }
  // Niten ramps every RAMP seconds of live phase time (S.nitenT), six steps. A swap (with its Waking Cut) follows every bracket, about
  // every BRACKET s; the blade does not walk between moves any more. Every bracket lays the step's Draw Cuts (WAKE.cuts, in chains)
  // and adds what its list names (the A + B ramp in issen-intensity-ideas.md):
  //   0: 1 arm, 2 cuts                        1: 3 cuts, + one Moon every other bracket (Full Moon first: the Eye is taught)
  //   2: 2 arms, 4 cuts, a Moon every bracket, the Waking Cut in two waves; opens with [cuts, Twin Petal Storm] (the mid-fight one)
  //   3: 2 arms turning back once per breath; [cuts, two Moons] [Final Verse in beats, cuts]
  //   4: 3 arms, 5 cuts, the lake's mirrored ghost; + [cuts, Twin Petal Storm] every loop
  //   5: 3 arms faster, 6 cuts, swap tell 0.9 s, gaps 0.3 s, third haste stack
  // Set-piece brackets lay WAKE.unisonCuts of the cuts. The cuts come before Twin Petal Storm (their ghosts are its calm lines) and
  // after Final Verse. A step never starts mid-bracket: after the swap that follows the step's time, a fresh loop opens with the Focus
  // flare and the new mechanic's bracket, so a new layer first appears right after a swap.
  // The double storm at the end is guaranteed: the first time health drops below 12% the next bracket has Twin Petal Storm, and
  // from the soft enrage on every other bracket has it until The Last Petal.
  const RAMP = 35, BRACKET = 9;
  const nitenStepOf = (S) => Math.min(5, Math.floor(S.nitenT / RAMP));
  const NITEN_LOOP = [
    [[]],
    [['m1'], []],
    [['m1']],
    [['m2'], ['verse']],
    [['m2'], ['verse'], ['storm']],
    [['m2'], ['verse'], ['storm']],
  ];
  const NITEN_OPEN = [null, null, ['storm'], null, null, null]; // a one-off bracket that opens the step
  const NITEN_NEW = [0, 0, 0, 1, 2, 0]; // the bracket that holds each step's new mechanic
  // n cuts as chains of at most WAKE.chain, at least two chains from 2 cuts (6 -> 3 3, 5 -> 3 2, 4 -> 2 2, 3 -> 2 1, 2 -> 1 1)
  function chainsOf(n) { if (n <= 1) return n ? [1] : []; const k = Math.max(2, Math.ceil(n / WAKE.chain)), out = []; for (let i = 0; i < k; i++) out.push(Math.floor(n / k) + (i < n % k ? 1 : 0)); return out; }
  function* nitenMech(b, k) {
    const S = b.state;
    if (k === 'm1') { S.moonN = (S.moonN || 0) + 1; yield* nitenMoons(b, [MOON1[(S.moonN - 1) % MOON1.length]]); }
    else if (k === 'm2') { S.moonN2 = (S.moonN2 || 0) + 1; yield* nitenMoons(b, MOON2[(S.moonN2 - 1) % MOON2.length]); }
    else if (k === 'verse' || k === 'storm') { S.unison = true; S.storm = null; if (k === 'verse') yield* twinFinalVerse(b); else yield* twinStorm(b); S.unison = false; S.stormUntil = Math.max(S.stormUntil, G.now + 1.0); }
  }
  function* bracket(b, list, gap) {
    const S = b.state, t0 = G.ft, st = S.nitenStep, set = list.find((k) => k === 'verse' || k === 'storm'), moons = list.filter((k) => k !== set);
    S.lastStorm = set === 'storm';
    const chains = chainsOf(set ? Math.ceil(WAKE.cuts[st] * WAKE.unisonCuts) : WAKE.cuts[st]);
    // a breath (WAKE.breath, a Bolt fits) after the swap and between blocks: the opening is the waker's own, and no two blocks of
    // telegraphs run back to back
    const breath = function* (t = WAKE.breath) { S.walk = true; yield t; S.walk = false; };
    if (set === 'verse') { yield* nitenMech(b, set); yield gap; } else yield* breath(WAKE.openBreath);
    for (let i = 0; i < chains.length; i++) {
      yield* nitenCut(b, chains[i]);
      if (i === 0 && moons.length) { for (const k of moons) yield* nitenMech(b, k); }
      if (i < chains.length - 1 || (i === 0 && moons.length)) yield* breath();
    }
    if (set === 'storm') { yield gap; yield* nitenMech(b, set); }
    // keep the swap cadence: the blade closes in until the bracket has run BRACKET s less the swap itself
    while (G.ft - t0 < BRACKET - (S.tellT || STILL_TELL) - 1.0) { S.walk = true; yield 0.1; }
    S.walk = false; yield gap;
    yield* swap(b);
  }
  // a forced Twin Petal Storm: once when health first drops below 12%, then every other bracket from the soft enrage on
  function forcedStorm(b) {
    const S = b.state;
    if (b.enraged) return !S.lastStorm;
    if (!S.low12 && b.hp < b.maxHp * 0.12) { S.low12 = true; return !S.lastStorm; }
    return false;
  }
  function* nitenRun(b) {
    const S = b.state; yield 0.6;
    while (true) {
      const st = nitenStepOf(S); let order = NITEN_LOOP[st].map((_, i) => i), fresh = false;
      if (st > S.nitenStep || (st === 0 && !S.stepAt.length)) {
        S.nitenStep = st; S.stepAt[st] = Math.round(G.ft * 10) / 10; fresh = true;
        if (st >= 5) S.tellT = 0.9;
        if (st > 0) { yield* twinFocus(b); const f = NITEN_NEW[st]; order = [f, ...order.filter((i) => i !== f)]; }
      }
      const gap = st >= 5 ? 0.3 : 0.6;
      if (fresh && NITEN_OPEN[st]) { yield* bracket(b, NITEN_OPEN[st], gap); if (forcedStorm(b)) yield* bracket(b, ['storm'], gap); }
      for (const i of order) {
        yield* bracket(b, NITEN_LOOP[st][i], gap);
        if (forcedStorm(b)) yield* bracket(b, ['storm'], gap);
        if (nitenStepOf(S) > st) break; // a new step starts right after this swap, as a fresh loop
      }
    }
  }
  // the kill: time slows, the reflection is cut first and falls backward into the lake, the wind comes back, he kneels, the last petal drops
  function* nitenDeath(b) {
    const S = b.state, Rr = S.R, twin = !!(S.niten && Rr && Rr.root.visible); S.walk = false; S.warn = 0; S.still = false; S.open = 0;
    b.group.visible = true; if (S.weapon) S.weapon.visible = true;
    const mx = twin ? (b.pos.x + Rr.ent.pos.x) / 2 : b.pos.x, mz = twin ? (b.pos.z + Rr.ent.pos.z) / 2 : b.pos.z, ca = Cam.yaw + 0.5, cr = twin ? clamp(Math.hypot(b.pos.x - Rr.ent.pos.x, b.pos.z - Rr.ent.pos.z) * 1.15 + 5, 13, 22) : 9;
    Cam.cine = { pos: new V3(mx - Math.sin(ca) * cr, 3.4, mz - Math.cos(ca) * cr), look: new V3(mx, 1.4, mz), fov: 44 };
    if (twin) {
      const e = Rr.ent.pos; Rr.hold = true; Rr.live = false; Rr.root.visible = true; FX.slash(e.x, 1.4, e.z, Rr.ent.facing, { r: 3.5, color: 0xffffff, dur: 0.35, mult: 1.8 }); cutFx(b, e.x - 3, e.z, PI / 2, 6, BLUE); Sound.sfx('crit'); petals(e.x, e.z, 50, ICE);
      yield 0.25; G.timeScale = 0.5;
      const bx = -Math.sin(Rr.ent.facing), bz = -Math.cos(Rr.ent.facing), d = Math.hypot(e.x, e.z) || 1; S.EU.uRip.value.set(e.x / d * 16, e.z / d * 16, G.now + 0.5);
      let t = 0; while (t < 1.2) { t += G.dt; const k = smooth(t / 1.2); Rr.root.rotation.x = -k * 1.45; Rr.fadeU.value = sat(k * 1.3 - 0.25); Rr.drainU.value = Math.max(Rr.drainU.value, k); Rr.root.position.set(e.x + bx * k * 0.8, -k * 0.6, e.z + bz * k * 0.8);
        if (!G.headless && vrand() < 0.5) FX.burst(Rr.root.position.x, 0.6 + vrand(), Rr.root.position.z, { n: 2, color: ICE, color2: BLUE, speed: [0.5, 2], up: 1.5, life: [0.6, 1.2], size: [0.1, 0.22] }); yield; }
      Rr.root.visible = false;
    } else { yield 0.25; G.timeScale = 0.5; }
    // the wind comes back, he kneels, the last petal drops
    const w0 = S.windU.value, c0 = S.EU.uCalm.value; Sound.sfx('bell', 0.7, 0.45); S.kneel = 1;
    { let t = 0; while (t < 0.9) { t += G.dt; const k = smooth(t / 0.9); S.windU.value = lerp(w0, 1.2, k); S.EU.uCalm.value = lerp(c0, 0, k); yield; } }
    if (!G.headless) FX.burst(b.pos.x + 0.4, 3.6, b.pos.z + 0.3, { n: 1, color: PALE, color2: ROSE, speed: [0.05, 0.15], life: [2.4, 2.6], size: [0.2, 0.22], grav: 0.45, drag: 2.5 });
    yield 1.1;
  }
  // nightmare music: sunset (1), nightfall (2), the lake (3: a second, higher koto answers the first), the drop for the
  // reflection (4: sub and one flute), Niten (5: everything back)
  function nmMusic(base) {
    const keep = (L, i) => L.v === 'sub' || i === 1, layers = [];
    base.layers.forEach((L, i) => { if (keep(L, i)) layers.push(L); else { layers.push(Object.assign({}, L, { to: 3 })); layers.push(Object.assign({}, L, { from: 5 })); } });
    layers.push({ v: 'koto', from: 3, pat: ['......4.2.......', '......5.4...2...'], oct: 3, len: 2, vol: 0.06 }, { v: 'koto', from: 5, pat: '....4.2.....5.4.', oct: 3, len: 2, vol: 0.055 });
    return Object.assign({}, base, { layers });
  }
  // Nightmare health (the tuning lever; class numbers and the ramp stay). Tuned with tools/nmpace.js (god-mode level-3 autopilot,
  // whole fights from phase 1, six runs per class) at 28,000 and enrage 355 s, after the storm never sleeps + standing cuts build
  // (more movement, so Niten damage per second fell about a sixth; 30,500 gave Stormcaller 5:44 median):
  //   stormcaller 18/18 kills, medians 4:57 / 4:44 / 4:36 on seeds 7 / 8 / 9 (best 4:29, worst 5:47), Niten 61-68% of the time
  //   hexslinger  6/6 kills, 4:22-4:31 (the least affected by the storm)
  //   ashwarden   6/6 kills, median 5:40 (5:24-5:51)
  //   duskblade   6/6 kills, median 6:09 (5:46-6:22), inside the soft enrage: the slow melee outlier, not a target
  const NM_HP = 28000;
  const MUSIC = { bpm: 92, root: 45, scale: [0, 2, 3, 7, 8], prog: [0, 0, 3, 2, 0, 0, 4, 2],
    layers: [
      { v: 'koto', pat: ['0...2...4..3....', '0...4...3..2....'], oct: 1, len: 4, vol: 0.14 }, { v: 'flute', pat: ['........4.......', '7.......5.......'], oct: 2, len: 7, vol: 0.07 },
      { v: 'sub', pat: '0...............', oct: -1, len: 14, vol: 0.2 },
      { v: 'taiko', from: 1, pat: 'x.....x.x.......', vol: 0.3 }, { v: 'koto', from: 1, pat: '0.2.4.2.0.2.4.5.', oct: 2, len: 2, vol: 0.07 }, { v: 'clap', from: 1, pat: '....x.......x...', vol: 0.1 },
      { v: 'taiko', from: 2, pat: 'x..x..x.x..x.xx.', vol: 0.34 }, { v: 'koto', from: 2, pat: '0245420245754202', oct: 2, len: 1, vol: 0.07 }, { v: 'flute', from: 2, pat: ['0.....2.4.......', '5.....4.2.......'], oct: 3, len: 5, vol: 0.08 }, { v: 'hat', from: 2, pat: '..x...x...x...x.', vol: 0.1 },
    ] };
  const POST = { bloom: 0.42, threshold: 1.0, radius: 0.55, exposure: 0.92, vig: 0.72, sat: 1.1, tint: [1.04, 1.0, 0.98] };

  G.bosses.push({
    id: 'duelist', name: 'ISSEN', title: 'The Last Petal', hint: 'A duel', color: '#ff7a9a', telegraph: ROSE,
    hp: 23000, radius: 0.9, aimY: 1.6, enrage: 420,
    post: POST,
    music: MUSIC,
    build,
    *intro(b) { yield* Cam.shot([9, 1.2, 4], [0, 1.8, -5], [2.5, 1.7, -1], [0, 1.9, -5], 3.2, 40); b.state.model.swing(1, 0.4); Sound.sfx('sword'); petals(0, -5, 40); yield 1.0; },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; yield 0.8;
        while (true) {
          yield* drawCut(b, 3); yield* echo(b, 0); S.walk = true; yield 1.2;
          yield* moon(b, ['n', 'o']); S.walk = true; yield 1.0;
          yield* stillness(b); S.walk = true; yield 0.6;
          yield* moon(b, ['c']); yield* drawCut(b, 3); yield* moon(b, ['o', 'n']); yield* echo(b, 0); S.walk = true; yield 1.2;
        }
      } },
      { at: 0.66, *enter(b) { const S = b.state; clearGhosts(S); S.walk = false; petals(b.pos.x, b.pos.z, 60); b.pos.set(0, 0, 0); Sound.sfx('sword', 1, 0.5); FX.dome(0, 1, 0, { r: 9, color: ROSE, dur: 0.8 }); Co.start(Post.lerpTo({ bloom: 0.46, sat: 1.14 }, 2), 'fight'); Co.start(deepen(b), 'fight'); yield 1.6; },
        // started directly at a later phase: apply this phase's sunset deepening and grade instantly
        skipTo(b) { deepenFn(b)(1); Object.assign(Post.cur, { bloom: 0.46, sat: 1.14 }); Post.apply(); },
        run: sunsetRun },
      { at: 0.33, enter: nightEnter, run: nightRun },
    ],
    // ---- Nightmare ("Niten"). Short teaching phases, then Niten is two thirds of the fight and ramps every 35 s. One creeping
    // enrage (40 + 4 per second over, every 2 s) and The Last Petal 24 s into it. The look starts at sunset.
    nightmare: {
      hp: NM_HP, enrage: 355, enrageBase: 40, enrageGrow: 4,
      post: Object.assign({}, POST, { bloom: 0.46, sat: 1.14 }),
      music: nmMusic(MUSIC),
      lastBlow: lastPetal, death: nitenDeath,
      phases: [
        { at: 1, music: 1, run: sunsetNM },
        { at: 0.88, music: 2, *enter(b) { resetMech(b); yield* nightEnter(b); }, skipTo: nightSkip, run: nightNM },
        { at: 0.78, music: 3, enter: lakeEnter, skipTo: lakeSkip, run: lakeRun },
        { at: 0.66, music: 5, enter: nitenEnter, run: nitenRun },
      ],
      nmTest: { RAMP, stepOf: nitenStepOf, STORM, CALM, WAKE, SET, BRACKET },
      // the autopilot reads the Lighthouse Storm's arms like a telegraph (see armAt). Nightmare only: Normal's autopilot is untouched.
      danger(b, x, z) { return b.state.niten ? armAt(b, x, z) : Infinity; },
    },
    update(b, dt) {
      const S = b.state, p = G.player, ox = b.pos.x, oz = b.pos.z;
      if (S.niten) nitenSim(b, dt);
      else if (S.walk && b.alive && G.state === 'fight' && !b.castState) { const d = b.distToPlayer(); b.facing = dampAng(b.facing, b.angToPlayer(), 8, dt); if (d > 3.2) { const s = Math.min(d - 3.2, 4.6 * dt); b.pos.x += Math.sin(b.facing) * s; b.pos.z += Math.cos(b.facing) * s; } }
      if (S.open > 0) S.open -= dt;
      if (G.headless) return;
      S.fake.moveSpeed = Math.hypot(b.pos.x - ox, b.pos.z - oz) / Math.max(dt, 1e-4) > 20 ? 0 : Math.hypot(b.pos.x - ox, b.pos.z - oz) / Math.max(dt, 1e-4);
      S.fake.casting = b.castState && b.castState.name === 'Thousand-Petal Focus' ? 1 : null;
      S.model.update(dt, S.fake); S.model.group.position.y = damp(S.model.group.position.y, -S.kneel * 0.55, 8, dt); S.model.body.rotation.x += S.kneel * 0.35;
      for (const r of S.ribbons) ribbonUpdate(r, G.now, S.fake.moveSpeed); S.timeU.value = G.now % 1000;
      S.sunV.value.copy(S.EU.uSunDir.value).transformDirection(camera.matrixWorldInverse);
      for (let i = 0; i < S.sleeves.length; i++) { const sl = S.sleeves[i]; sl.rotation.x = Math.sin(G.now * 2.1 + i * 1.7) * 0.1 + Math.min(S.fake.moveSpeed, 6) * 0.05; sl.rotation.z = sl.userData.sx * 0.13 + Math.sin(G.now * 1.6 + i) * 0.05; }
      S.hak.rotation.x = -Math.min(S.fake.moveSpeed, 6) * 0.025; S.hak.scale.y = 1 - S.kneel * 0.25;
      // phase marks: torn haori + shoulder petal embers from phase 2, cracked glowing mask in phase 3
      const ph = G.nightmare ? Math.min(2, Math.max(0, b.phase) + 1) : Math.max(0, b.phase);
      if (ph >= 1 && !S.torn) { S.torn = true; for (const [a, c] of S.cloak) { a.visible = false; c.visible = true; } S.sleeves[1].scale.y = 0.75; S.sleeves[1].position.y = -0.24; for (const r of S.ribbons.slice(0, 2)) { r.len *= 1.4; r.amp *= 1.35; r.trail += 0.8; r.f *= 1.25; } }
      if (ph >= 1 && b.group.visible && vrand() < dt * (ph >= 2 ? 26 : 16)) { const sh = S.shs[vrand() < 0.5 ? 0 : 1]; sh.getWorldPosition(S.tv); FX.burst(S.tv.x, S.tv.y + 0.1, S.tv.z, { n: 1, color: ph >= 2 ? 0xff3048 : 0xffb0c4, color2: ph >= 2 ? 0x400010 : ROSE, speed: [0.4, 1.4], up: 1.6, life: [0.6, 1.2], size: [0.1, 0.2], radius: 0.25 }); }
      const mk = ph >= 2 ? S.night : 0; const eg = ph >= 1 ? 1.35 + 0.15 * Math.sin(G.now * 4) : 1; S.edgeMat.color.setRGB(lerp(2.4 * eg, 4.2, mk), lerp(0.7 * eg, 0.35, mk), lerp(1.0 * eg, 0.45, mk)); S.trimM.emissiveIntensity = ph >= 1 ? lerp(0.9, 2.2, mk) : 0.4;
      if (mk > 0.5 && b.group.visible && vrand() < dt * 40) { const a = G.now * 2.4 + vrand() * 0.6 + (vrand() < 0.5 ? PI : 0), r = 1.4 + vrand() * 0.5; FX.burst(b.pos.x + Math.sin(a) * r, 0.3 + vrand() * 2.2, b.pos.z + Math.cos(a) * r, { n: 1, color: 0xff2a40, color2: 0x600010, dir: [Math.cos(a), 0.25, -Math.sin(a)], spread: 0.15, speed: [2.5, 4], life: [0.5, 0.9], size: [0.1, 0.2], drag: 0.5 }); } S.maskMat.emissiveIntensity = mk * (2.2 + 0.8 * Math.sin(G.now * 3)); S.eyeMat.color.setRGB(lerp(2, 5, mk), lerp(1.7, 0.4, mk), lerp(1.75, 0.5, mk));
      if (S.R) S.edgeMat.color.multiplyScalar(1 - 0.8 * S.A.drain);
      if (S.R) twinLook(b, dt);
      if (!S.niten) { if (S.warn > 0) S.warn = Math.min(1, S.warn + dt / STILL_TELL);
      S.aura.material.opacity = S.still ? 0.5 + 0.4 * Math.sin(G.now * 12) : S.warn > 0 ? 0.25 + 0.55 * S.warn : S.open > 0 ? 0.25 : 0; S.aura.material.color.setHex(S.still ? 0xffffff : S.warn > 0 ? 0xffe6b0 : 0x70ff90); S.aura.scale.setScalar(S.still ? 1 + 0.15 * Math.sin(G.now * 6) : S.warn > 0 ? 2.6 - 1.6 * S.warn : 1.2); }
      { const c = camera.position, v = S.pv || (S.pv = new V3()); let near = false;
        if (!Cam.cine && b.distToPlayer() > 1.2 && Math.hypot(b.pos.x - c.x, b.pos.z - c.z) < Math.hypot(p.pos.x - c.x, p.pos.z - c.z) - 0.6) { v.set(p.pos.x, p.pos.y + 0.9, p.pos.z).project(camera); const px = v.x, py = v.y; v.set(b.pos.x, b.pos.y, b.pos.z).project(camera); const bx = v.x, y0 = v.y; v.set(b.pos.x, b.pos.y + 3.3, b.pos.z).project(camera); const y1 = v.y, hw = Math.abs(y1 - y0) * 0.26 / Math.max(camera.aspect, 0.3); near = Math.abs(px - bx) < hw && py > y0 && py < y1; }
        S.fadeU.value = damp(S.fadeU.value, near ? 0.5 : 0, 8, dt); }
      for (const gh of S.ghosts) if (gh.g.visible) gh.g.position.y = Math.sin(G.now * 2 + gh.g.position.x) * 0.06;
      { const ga = 0.32 + 0.14 * Math.sin(G.now * 5); for (const gh of S.ghosts) if (gh.g.visible) { const d = camera.position.distanceTo(gh.g.position); gh.g.userData.mat.uniforms.uA.value = ga * smooth((d - 4) / 6); gh.g.userData.mat.uniforms.uTg.value = G.now % 100; } }
      if (S.laneM) { for (const m of S.laneM) { const L = m.userData.L, on = !!(L && S.lanes.includes(L)); m.visible = on; if (on) m.material.uniforms.uA.value = Math.min(1, (G.now - L.t0) / 0.15) * Math.min(1, (L.until - G.now) / 0.5) * (L.leave ? 0.55 : 1); else m.userData.L = null; }
        const E = S.eye; S.eyeM.visible = !!E; if (E) S.eyeM.material.uniforms.uA.value = Math.min(1, (G.now - E.t0) / 0.25) * Math.min(1, (E.until - G.now) / 0.4); }
      for (const it of S.vfx.list) { if (!it.m.visible) continue; it.t += dt; const k = it.t / it.dur; if (k >= 1) { it.m.visible = false; continue; } it.m.material.uniforms.uT.value = Math.max(0, k); }
      { let n = 0, nb = 0; const M = S.M4; for (const q of Bul.list) { if (!q.petal) continue;
          if (q.petal === 2) { if (S.orbB && nb < 200) { const s = q.r * (q.t < 0.15 ? q.t / 0.15 : 1) * 1.08; M.makeScale(s, s, s); M.setPosition(q.x, q.y, q.z); S.orbB.setMatrixAt(nb, M); M.makeScale(s * 2.1, s * 2.1, s * 2.1); M.setPosition(q.x, q.y, q.z); S.orbHaloB.setMatrixAt(nb, M); nb++; } continue; }
          if (n >= 320) continue; const s = q.r * (q.t < 0.15 ? q.t / 0.15 : 1) * 1.08; M.makeScale(s, s, s); M.setPosition(q.x, q.y, q.z); S.orb.setMatrixAt(n, M); M.makeScale(s * 2.1, s * 2.1, s * 2.1); M.setPosition(q.x, q.y, q.z); S.orbHalo.setMatrixAt(n, M); n++; }
        S.orb.count = S.orbHalo.count = n; if (n) S.orb.instanceMatrix.needsUpdate = S.orbHalo.instanceMatrix.needsUpdate = true;
        if (S.orbB) { S.orbB.count = S.orbHaloB.count = nb; if (nb) S.orbB.instanceMatrix.needsUpdate = S.orbHaloB.instanceMatrix.needsUpdate = true; } }
      if (S.haste && vrand() < dt * 12 * S.haste) FX.burst(b.pos.x, 0.2 + vrand() * 2, b.pos.z, { n: 1, color: 0xff2040, speed: [0.3, 1.2], up: 1.5, life: [0.4, 0.8], radius: 0.5 });
    },
    bot(b) {
      const S = b.state;
      // Niten: attack the awake one, never the still one; hold during the tell and the grace; stand in the calm place when there is
      // one (a cut lane while the storm blows, the Eye of the Moon). Bot.pocketBlind (tests only) ignores the calm places.
      // Bot.swapBlind (tests only) ignores swaps and always attacks Issen: that autopilot must fail phase IV.
      if (S.niten && S.lead) { if (Bot.swapBlind) return { target: b }; const L = S.lead, Fo = other(S, L), h = { target: L.ent, holdFire: L.warn > 0 || G.now < Fo.graceT || !L.ent.targetable }; if (S.calmHint && !Bot.pocketBlind) Object.assign(h, S.calmHint);
        // a planted cast is only started when it will finish before the next storm arm arrives
        if (S.storm && G.player) { const t = armAt(b, G.player.pos.x, G.player.pos.z); if (t < 3) h.noCast = t - 0.25; } return h; }
      return { holdFire: S.still || S.warn > 0 };
    },
  });
})();
