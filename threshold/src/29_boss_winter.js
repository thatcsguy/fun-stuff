// DOOR X: THE HUNTSMAN, the Long Night. A frozen lake in deep snow. You leave footprints; things follow them.
(() => {
  const R = 20, COLD = 0x9fe8ff, SCENT = 0xff5040, SPEED = 7, STEP = 0.9, TEL = 0x5cc6ff;
  const POND = [[45, 11.2, 4.4], [135, 11.2, 4.0], [225, 11.2, 4.4], [315, 11.2, 4.0], [0, 0, 3.2]];
  const MOON = new V3(-0.28, 0.085, -1).normalize(), MOONAZ = Math.atan2(MOON.x, MOON.z);
  const _m = new THREE.Object3D(), _c = new THREE.Color(), _v = new V3(), _w = new V3();
  const iceAt = (S, x, z) => { for (const q of S.ponds) if (Math.hypot(x - q.x, z - q.z) < q.r) return q; return null; };
  const hsh = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };

  // ---- shared sky function: the dome and the pond ice both evaluate it, so the ponds reflect the sky they sit under ----
  const NZ = `
    float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float h31(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
    float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*n2(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }`;
  // noise is sampled on the unit circle of the view direction (never on the raw azimuth), so the sky has no wrap seam
  const SKYF = `
    uniform float uTime,uAur,uFlash,uMoonR,uAurH,uMoonEdge,uAurGap; uniform vec3 uTop,uHor,uBot,uAurA,uAurB,uMoon,uMoonCol,uHorGlow,uHaze;` + NZ + `
    vec3 aurora(vec3 d, float soft){
      float h=d.y; if(h<=0.0) return vec3(0.0);
      vec2 cq=d.xz/max(length(d.xz),1e-4); vec3 c=vec3(0.0);
      for(int i=0;i<2;i++){ float fi=float(i), t=uTime*0.01*(1.0+fi*0.4)+fi*2.1; vec2 dr=vec2(cos(t),sin(t))*0.6;
        float fold=fbm(cq*(1.2+fi*0.4)+dr+fi*7.3);
        float base=0.035+fi*0.045+fold*0.12, ht=(0.12+0.22*fbm(cq*1.6+fi*4.1-dr))*uAurH, v=(h-base)/ht;
        float mask=smoothstep(0.47-uAurGap,0.62-uAurGap,fbm(cq*0.9+vec2(fi*11.0,fi*5.0)-dr*0.5));
        float r1=n2(cq*55.0+vec2(fold*4.0,fi*7.0)), r2=n2(cq*170.0+vec2(fi*3.0,uTime*0.05));
        float rays=pow(r1,2.5)*1.6+pow(r2,3.0)*0.9+0.08, sw=soft*0.2;
        float body=smoothstep(-0.02-sw,sw,v)*exp(-max(v,0.0)*2.2)*mix(rays,0.45,soft);
        float hem=exp(-v*v*350.0)*(0.7+0.3*r1)*(1.0-soft);
        c+=mix(uAurA,uAurB,clamp(v*0.9,0.0,1.0))*(body+hem*0.8)*mask*(1.0-fi*0.3);
      }
      return c*uAur*smoothstep(0.0,0.03,h);
    }
    vec3 skyCol(vec3 d, float stars, float soft){
      float h=d.y, md=dot(d,uMoon), mp=max(md,0.0);
      vec3 col = h>0.0 ? mix(uHor,uTop,pow(clamp(h*1.6,0.0,1.0),0.5)) : mix(uHor,uBot,pow(clamp(-h*3.0,0.0,1.0),0.6));
      col+=uHorGlow*(pow(mp,8.0)*exp(-abs(h)*5.0)+pow(mp,40.0)*0.6);
      if(stars>0.0 && h>0.0){ vec3 gp=d*150.0; vec3 g=floor(gp); vec3 fp=fract(gp)-0.5; float s=h31(g); float tw=0.7+0.3*sin(uTime*2.3+s*90.0); float disc=smoothstep(0.45,0.0,length(fp));
        col+=stars*step(0.955,s)*disc*disc*tw*mix(vec3(1.0,0.88,0.75),vec3(0.75,0.86,1.0),h31(g+3.0))*(0.6+h31(g+7.0)*2.6)*smoothstep(0.03,0.15,h); }
      col+=aurora(d,soft);
      if(soft>0.5) col+=uMoonCol*(pow(mp,260.0)*0.7+pow(mp,40.0)*0.06);
      else {
        col+=uMoonCol*(pow(mp,1400.0)*0.5+pow(mp,90.0)*0.1+pow(mp,12.0)*0.02);
        float r2=uMoonR*uMoonR, a2=max(0.0,2.0*(1.0-md));
        if(md>0.0 && a2<r2*1.3){ vec3 rt=normalize(cross(vec3(0.0,1.0,0.0),uMoon)); vec3 uq=cross(uMoon,rt); vec2 uv=vec2(dot(d,rt),dot(d,uq))/max(uMoonR,1e-4); float rr=dot(uv,uv);
          float disc=1.0-smoothstep(0.9,1.0,rr), lim=sqrt(max(0.0,1.0-min(rr,1.0)));
          float mare=fbm(uv*2.2+3.0)*0.6+fbm(uv*6.0-2.0)*0.4, alb=0.45+0.6*smoothstep(0.3,0.72,mare);
          col=mix(col,uMoonCol*alb*(0.4+0.6*lim)*1.25,disc)+vec3(1.0,0.42,0.18)*smoothstep(0.72,0.97,rr)*disc*uMoonEdge*1.6; }
        float ang=sqrt(a2), hr=(ang-0.38)/0.03; col+=uMoonCol*0.03*exp(-hr*hr)*smoothstep(-0.02,0.1,h);
      }
      col=mix(col,uHaze,exp(-max(h,0.0)*20.0)*0.85);
      return col+uFlash*vec3(0.25,0.3,0.4);
    }`;
  const VSKY = 'varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }';

  // dark hide/fur: hoarfrost settles on what faces up, a thin icy rim keeps the shape against the dark
  const MRIM = new THREE.Color(0); // moon-side rim on everything the Huntsman wears: cold, then red under the blood moon
  function hunterMat(color, rough, rim, frost, o = {}) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, o)), rc = new THREE.Color(rim);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: rc }; sh.uniforms.uMRim = { value: MRIM }; sh.uniforms.uMoonD = { value: MOON };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUpW; varying float vMoonF; uniform vec3 uMoonD;').replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n{ vec3 wn=objectNormal;\n#ifdef USE_INSTANCING\n wn=mat3(instanceMatrix)*wn;\n#endif\n wn=mat3(modelMatrix)*wn; wn/=max(length(wn),1e-4); vUpW=wn.y; vMoonF=smoothstep(-0.5,0.4,dot(wn,uMoonD)); }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vUpW; varying float vMoonF; uniform vec3 uRim,uMRim,uMoonD;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.8,0.85,0.92),smoothstep(0.5,0.9,vUpW)*' + frost.toFixed(2) + ');')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv=vViewPosition/max(length(vViewPosition),1e-4); float fr=clamp(1.0-abs(dot(normal,vv)),0.0,1.0); vec3 md=(viewMatrix*vec4(uMoonD,0.0)).xyz; float bl=max(dot(-vv,md/max(length(md),1e-4)),0.0); totalEmissiveRadiance+=uRim*pow(fr,3.0)+uMRim*(pow(fr,1.8)*vMoonF+pow(fr,2.5)*bl*bl*1.3)+vec3(0.05,0.06,0.075)*smoothstep(0.5,0.9,vUpW)*' + frost.toFixed(2) + '; }');
    };
    m.customProgramCacheKey = () => 'hunt' + frost; return m;
  }
  // torn cloth: an open cylinder with folds and a hem of uneven hanging strips
  function rag(rt, rb, h, seg, seed, hem, t0 = 0, tl = TAU, pinch = 0) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 12, true, t0, tl), p = g.attributes.position, C = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), v = (y + h / 2) / h, col = Math.round((a + PI) / TAU * seg);
      const ph = a * 6 + seed + 0.9 * Math.sin(a * 2 + seed * 1.7) + 0.5 * Math.sin(a * 5 - seed), ridge = Math.abs(Math.sin(ph)), amp = 0.07 + 0.11 * hsh(Math.floor(ph / PI), seed, 7);
      const fold = 1 - amp * (1 - ridge) + 0.03 * Math.sin(a * 13 + seed * 2) + (1 - v) * 0.06 * Math.sin(a * 23 + seed);
      const prof = pinch ? 1 - 0.24 * Math.exp(-(((v - 0.62) / 0.1) ** 2)) - 0.14 * Math.exp(-(((v - 0.3) / 0.12) ** 2)) + 0.12 * smooth((0.2 - v) / 0.2) : 1;
      const strip = hsh(col, seed, 3), drop = (1 - v) * (1 - v) * hem * (strip < 0.3 ? -0.7 - strip * 1.6 : strip > 0.78 ? strip * 0.9 : 0) * (v < 0.35 ? 1 : 0);
      p.setXYZ(i, x * fold * prof * (1 + (1 - v) * 0.05 * strip), y - drop - (v < 0.02 ? hem * strip * 0.6 : 0), z * fold * prof);
      const k = (0.35 + 0.6 * Math.pow(ridge, 0.7)) * (0.8 + 0.2 * v); C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeVertexNormals(); return g;
  }
  // merge [geometry, snow, rgb] parts into one non-indexed geometry with per-vertex colour and a snow-load attribute
  function merge(list) {
    let n = 0; const gs = list.map(([g0, s, c]) => { const g = g0.index ? g0.toNonIndexed() : g0; if (g !== g0) g0.dispose(); n += g.attributes.position.count; return [g, s, c]; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), Sn = new Float32Array(n), C = new Float32Array(n * 3); let o = 0;
    for (const [g, s, c] of gs) { const p = g.attributes.position, sa = g.attributes.aSnow; P.set(p.array, o * 3); N.set(g.attributes.normal.array, o * 3); for (let i = 0; i < p.count; i++) { Sn[o + i] = sa ? sa.getX(i) : s; C.set(c, (o + i) * 3); } o += p.count; g.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('aSnow', new THREE.BufferAttribute(Sn, 1)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); return g;
  }
  function pineGeo() {
    const parts = [], tr = new THREE.CylinderGeometry(0.1, 0.38, 5.2, 8, 1, true); tr.translate(0, 2.6, 0); parts.push([tr, 0, [0.1, 0.07, 0.05]]);
    for (let k = 0; k < 4; k++) {
      const r = 2.6 - k * 0.55, h = 2.4 - k * 0.2, c = new THREE.ConeGeometry(r, h, 14, 2), p = c.attributes.position, sn = new Float32Array(p.count);
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const rr = Math.hypot(x, z), a = Math.atan2(x, z);
        if (y < -h / 2 + 1e-3) { if (rr > 0.01) { const j = Math.round((a + PI) / TAU * 14) % 2 ? 0.8 : 1.1; x *= j; z *= j; y -= j > 1 ? 0.5 : 0.18; } sn[i] = 0; }
        else { if (Math.abs(y) < 1e-3) { const j = 0.94 + hsh(Math.round(a * 10), k, 1) * 0.12; x *= j; z *= j; } sn[i] = (y + h / 2) / h; }
        p.setXYZ(i, x, y, z);
      }
      c.setAttribute('aSnow', new THREE.BufferAttribute(sn, 1)); c.computeVertexNormals(); c.translate(0, 2.2 + k * 1.75 + h / 2, 0); parts.push([c, 0, [0.04, 0.095, 0.08]]);
    }
    return merge(parts);
  }
  // spectral hound: dark translucent body, bright frost outline
  const wolfMat = (stag) => new THREE.ShaderMaterial({
    uniforms: { uA: { value: 1 }, uRim: { value: new THREE.Color(stag ? 0x9fd8ff : COLD).multiplyScalar(stag ? 0.8 : 1.5) }, uBody: { value: new THREE.Color(stag ? 0x5a7088 : 0x060d1a) } }, transparent: true,
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vUp; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; vN=normalMatrix*normal; vec3 wn=mat3(modelMatrix)*normal; vUp=wn.y/max(length(wn),1e-4); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform float uA; uniform vec3 uRim,uBody; varying vec3 vN; varying vec3 vV; varying float vUp; void main(){ vec3 n=vN/max(length(vN),1e-4), v=vV/max(length(vV),1e-4); float fr=clamp(1.0-abs(dot(n,v)),0.0,1.0); float top=clamp(n.y*0.5+0.5,0.0,1.0); vec3 c=uBody*(0.6+0.7*top)+uRim*(pow(fr,3.5)*1.1+pow(fr,9.0)*1.1)*(0.4+0.6*top)+uRim*smoothstep(0.8,0.98,vUp)*0.45; gl_FragColor=vec4(c,uA*clamp(0.86+0.14*fr,0.0,1.0)); }',
  });
  const mistMat = () => new THREE.ShaderMaterial({
    uniforms: { uA: { value: 1 }, uC: { value: new THREE.Color(COLD).multiplyScalar(0.5) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY=position.y; vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; vN=normalMatrix*normal; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform float uA; uniform vec3 uC; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4), v=vV/max(length(vV),1e-4); float a=uA*clamp(0.5-vY,0.0,1.0)*abs(dot(n,v))*0.8; gl_FragColor=vec4(uC*a,a); }',
  });
  let BG = null; // hound geometry, built once and shared by every hound (never disposed)
  const bgeo = () => {
    if (BG) return BG;
    const L = (pts, seg) => new THREE.LatheGeometry(pts.map(([y, r]) => new THREE.Vector2(r, y)), seg);
    const body = L([[0, 0], [0.05, 0.12], [0.2, 0.19], [0.42, 0.16], [0.66, 0.19], [0.92, 0.27], [1.12, 0.3], [1.28, 0.25], [1.4, 0.13], [1.44, 0]], 14); body.rotateX(PI / 2); body.translate(0, 0, -0.74); body.scale(0.78, 1.15, 1);
    const tail = L([[0, 0.05], [-0.15, 0.09], [-0.45, 0.13], [-0.75, 0.09], [-1.0, 0]], 8);
    const head = new THREE.SphereGeometry(1, 10, 8); head.scale(0.15, 0.14, 0.19);
    const snout = new THREE.CylinderGeometry(0.035, 0.1, 0.34, 6); snout.rotateX(PI / 2); snout.scale(1, 0.75, 1);
    BG = { body, tail, head, snout, neck: new THREE.CylinderGeometry(0.12, 0.19, 0.5, 9), spike: new THREE.ConeGeometry(0.07, 0.42, 4), ear: new THREE.ConeGeometry(0.06, 0.24, 4),
      up: new THREE.CylinderGeometry(0.1, 0.055, 0.48, 7), lo: new THREE.CylinderGeometry(0.052, 0.032, 0.42, 6), paw: new THREE.SphereGeometry(0.055, 6, 4), eye: new THREE.SphereGeometry(0.04, 6, 5) };
    for (const k in BG) BG[k].userData.shared = true; return BG;
  };

  function antler(parent, mat, sx, tipM) {
    const root = new THREE.Group(); root.position.set(sx * 0.32, 0.5, -0.1); root.rotation.z = -sx * 0.55; root.rotation.x = -0.2; parent.add(root);
    const tip = (m, y) => { if (!tipM) return; const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), tipM); s.position.y = y; m.add(s); };
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 2.2, 6), mat); beam.position.y = 1.1; root.add(beam); tip(beam, 1.1);
    for (let i = 0; i < 4; i++) { const L = 0.9 - i * 0.1, t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, L, 5), mat); t.position.set(sx * 0.02, 0.55 + i * 0.5, 0.3); t.rotation.x = 0.9; t.rotation.z = sx * 0.25 * (i - 1); root.add(t); tip(t, L / 2); }
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 0.8, 5), mat); crown.position.set(-sx * 0.2, 2.3, -0.1); crown.rotation.z = sx * 0.7; root.add(crown); tip(crown, 0.4);
    root.userData.crown = crown; return root;
  }
  function beast(stag) {
    const B = bgeo(), g = new THREE.Group(), legs = [], m = wolfMat(stag), mist = mistMat();
    const add = (geo, x, y, z, rx, sx, sy, sz, par = g, mat = m) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.x = rx; o.scale.set(sx, sy, sz); par.add(o); return o; };
    add(B.body, 0, 0.92, 0, 0, stag ? 1.3 : 1, stag ? 1.2 : 1, stag ? 1.05 : 1);
    add(B.neck, 0, 1.12, 0.62, -0.95, 1, 1, 1.15);
    for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.4; add(B.spike, Math.sin(a) * 0.2, 1.2 + Math.cos(a) * 0.08, 0.5, -2.0, 0.7, 0.6 + (i % 2) * 0.3, 0.7).rotation.z = -a * 0.6; }
    if (!stag) for (let i = 0; i < 4; i++) add(B.spike, 0, 1.17 - i * 0.03, 0.22 - i * 0.26, -1.85, 0.5, 0.4, 0.5);
    const neck = new THREE.Group(); neck.position.set(0, 1.3, 0.8); g.add(neck);
    add(B.head, 0, 0, 0.04, 0, 1, 1, 1, neck); add(B.snout, 0, -0.05, 0.27, 0.12, 1, 1, 1, neck);
    for (const sx of [-1, 1]) { add(B.ear, sx * 0.08, 0.17, -0.04, -0.35, 1, 1, 1, neck).rotation.z = -sx * 0.25; const e = new THREE.Mesh(B.eye, W.glow(SCENT, 3)); e.position.set(sx * 0.075, 0.05, 0.16); e.scale.setScalar(0.55); neck.add(e); }
    for (const [x, z] of [[-0.13, 0.42], [0.13, 0.42], [-0.12, -0.5], [0.12, -0.5]]) {
      const hip = new THREE.Group(); hip.position.set(x, 0.88, z); g.add(hip); add(B.up, 0, -0.22, 0, 0, 1, 1, 1, hip);
      const knee = new THREE.Group(); knee.position.y = -0.44; knee.rotation.x = z > 0 ? 0.2 : -0.35; hip.add(knee); add(B.lo, 0, -0.2, 0, 0, 1, 1, 1, knee); add(B.paw, 0, -0.42, 0.03, 0, 1, 0.7, 1.4, knee); legs.push(hip);
    }
    const tail = add(B.tail, 0, 1.02, -0.72, -2.1, 1, 1, 1); add(B.tail, 0, 1.02, -0.72, -2.1, 2.2, 1.3, 2.2, g, mist);
    if (stag) { const am = W.glow(0x9fd8ff, 0.75); for (const sx of [-1, 1]) antler(neck, am, sx).scale.setScalar(0.5); g.scale.setScalar(1.7); }
    return { g, legs, neck, mat: m, mist, tail };
  }

  function build(b) {
    const g = G.world, S = b.state;
    // ---- sky: low moon behind the Huntsman, aurora curtains over the treeline ----
    const SU = { uTime: { value: 0 }, uAur: { value: 1.0 }, uFlash: { value: 0 }, uMoonR: { value: 0.062 }, uAurH: { value: 1 }, uMoonEdge: { value: 0 }, uAurGap: { value: 0 }, uTop: { value: new THREE.Color(0x01030a) }, uHor: { value: new THREE.Color(0x0e1a2a) }, uBot: { value: new THREE.Color(0x04070c) },
      uAurA: { value: new THREE.Color(0x2affa0) }, uAurB: { value: new THREE.Color(0x3050ff) }, uMoon: { value: MOON.clone() }, uMoonCol: { value: new THREE.Color(0xe4eeff) }, uHorGlow: { value: new THREE.Color(0x10223a) }, uHaze: { value: new THREE.Color(0x0c1826) } };
    S.SU = SU;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 32), new THREE.ShaderMaterial({ uniforms: SU, side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: VSKY,
      fragmentShader: SKYF + 'varying vec3 vD; void main(){ vec3 d=vD/max(length(vD),1e-4); gl_FragColor=vec4(skyCol(d,1.6,0.0),1.0); }' }));
    sky.renderOrder = -100; sky.frustumCulled = false; sky.onBeforeRender = () => { SU.uTime.value = G.now; sky.position.copy(camera.position); };
    g.add(sky); S.sky = sky; W.env(sky, 0.9);
    scene.fog = new THREE.FogExp2(0x0c1826, 0.011); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x6c8cc0, 0x2a3040, 1.0);
    S.sun = W.sun(g, { dir: [MOON.x, 0.42, MOON.z], color: 0xbcd4ff, intensity: 2.8, size: 30 });
    // palette per act: cold night / aurora swell / blood moon
    const C = (h) => new THREE.Color(h);
    S.pal = [
      { aurA: C(0x2affa0), aurB: C(0x5040ff), moon: C(0xe4eeff), hg: C(0x10223a), top: C(0x01030a), hor: C(0x0e1a2a), hemi: C(0x6c8cc0), rim: C(0x000000), mrim: C(0x9cc8f0), aur: 1.35, aurH: 1, medge: 0, hemiI: 1, crack: 0, ant: 1 },
      { aurA: C(0x30ffa0), aurB: C(0xe040ff), moon: C(0xe8f0ff), hg: C(0x123a40), top: C(0x020610), hor: C(0x0e2430), hemi: C(0x58c0b0), rim: C(0x000000), mrim: C(0xa0e0f0), aur: 1.05, aurH: 1.6, medge: 0, hemiI: 1.02, gap: 0.0, crack: 1.25, ant: 1.22 },
      { aurA: C(0x901828), aurB: C(0x3a0a40), moon: C(0xc83a22), hg: C(0x5a1408), top: C(0x0e0208), hor: C(0x24080e), hemi: C(0x6680b0), rim: C(0xff2030).multiplyScalar(0.45), mrim: C(0xff3020).multiplyScalar(0.75), aur: 0.6, aurH: 1.2, medge: 1, hemiI: 1, crack: 0.8, ant: 1.32 },
    ];
    // snow: glitter and shallow wind ripples
    const sn = W.surface('rock', { seed: 31, dark: 0xb8c6dc, light: 0xffffff, strength: 1.1 }); for (const k in sn) sn[k].repeat.set(14, 14);
    const snowM = new THREE.MeshStandardMaterial({ map: sn.map, normalMap: sn.normalMap, roughness: 0.92, color: 0xd6e0f0 }); snowM.normalScale.set(0.5, 0.5);
    S.snowT = { value: 0 };
    snowM.onBeforeCompile = (sh) => {
      sh.uniforms.uT = S.snowT;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWp=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform float uT;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float rip=sin(dot(vWp.xz,vec2(0.55,0.83))*2.2+sin(vWp.x*0.31+vWp.z*0.17)*2.5); vec2 gc=floor(vWp.xz*40.0); float hs=fract(sin(dot(gc,vec2(12.9898,78.233)))*43758.5453); float tw=0.5+0.5*sin(uT*(3.0+hs*5.0)+hs*80.0+dot(cameraPosition.xz,vec2(0.6,0.5))); totalEmissiveRadiance+=vec3(0.7,0.85,1.1)*step(0.994,hs)*smoothstep(0.3,0.9,rip)*pow(tw,6.0)*1.1;\n diffuseColor.rgb*=0.93+0.07*rip; }');
    };
    snowM.customProgramCacheKey = () => 'wsnow';
    const ground = new THREE.Mesh(new THREE.CircleGeometry(140, 64), snowM); ground.rotation.x = -PI / 2; ground.receiveShadow = true; g.add(ground);
    const bank = new THREE.Mesh(new THREE.TorusGeometry(R + 2.4, 2.4, 10, 64), snowM); bank.rotation.x = PI / 2; bank.scale.z = 0.5; bank.position.y = -0.2; g.add(bank);
    // ice: unlit, reflects the sky function; frost rim, white cracks, glowing fractures from the second act
    const iceU = Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), SU, { uCrack: { value: 0 }, uCrackCol: { value: new THREE.Color(0x30c8ff) } }); S.iceU = iceU;
    const iceM = new THREE.ShaderMaterial({ uniforms: iceU, fog: true,
      vertexShader: 'varying vec3 vW; varying vec2 vL;\n#include <fog_pars_vertex>\nvoid main(){ vL=position.xy; vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; vec4 mvPosition=viewMatrix*wp; gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: SKYF + `uniform float uCrack; uniform vec3 uCrackCol; varying vec3 vW; varying vec2 vL;
        #include <fog_pars_fragment>
        float crk(vec2 p){ vec2 i=floor(p),f=fract(p); float d1=8.0,d2=8.0; for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y)); vec2 o=g+vec2(h21(i+g),h21(i+g+17.3))-f; float d=dot(o,o); if(d<d1){ d2=d1; d1=d; } else if(d<d2) d2=d; } return sqrt(max(d2,0.0))-sqrt(max(d1,0.0)); }
        void main(){
          vec3 v=cameraPosition-vW; v/=max(length(v),1e-4); vec2 q=vW.xz; float lr=length(vL);
          vec2 wq=q+vec2(fbm(q*0.7),fbm(q*0.7+4.0))*1.6; float c1=crk(wq*0.42), c2=crk(wq*1.3+5.0), line=(1.0-smoothstep(0.0,0.035,c1))*smoothstep(0.38,0.62,fbm(q*0.9+2.0)), fine=(1.0-smoothstep(0.0,0.025,c2))*smoothstep(0.45,0.7,fbm(q*1.4-3.0));
          vec3 n=normalize(vec3((n2(q*0.6)-0.5)*0.02,1.0,(n2(q*0.6+9.0)-0.5)*0.02));
          vec3 r=reflect(-v,n); r=normalize(vec3(r.x,abs(r.y)*0.32+0.01,r.z));
          float fr=0.1+0.9*pow(clamp(1.0-max(dot(n,v),0.0),0.0,1.0),4.0), dp=fbm(q*0.35);
          vec2 cd=vW.xz-cameraPosition.xz; cd/=max(length(cd),1e-4); float far=smoothstep(-0.7,0.95,dot(vec2(vL.x,-vL.y),cd));
          vec3 rc=skyCol(r,0.0,1.0); rc=mix(vec3(dot(rc,vec3(0.3,0.5,0.2))),rc,0.5);
          vec3 col=mix(vec3(0.004,0.018,0.04),vec3(0.02,0.07,0.11),dp)*(1.0-lr*0.3)+rc*fr*far*0.9;
          col+=vec3(0.35,0.5,0.6)*fine*0.08+vec3(0.5,0.65,0.75)*line*0.14*(1.0-uCrack*0.5);
          float glow=(1.0-smoothstep(0.0,0.16,c1))*smoothstep(0.3,0.62,fbm(q*0.9+2.0));
          col+=uCrackCol*uCrack*(line*(1.2+0.6*sin(uTime*2.0+dp*12.0))+glow*0.22+fine*0.25)*(0.5+0.5*smoothstep(0.1,0.9,lr));
          col=mix(col,vec3(0.48,0.58,0.72),smoothstep(0.8,1.0,lr+(fbm(q*2.5)-0.5)*0.22)*0.85);
          gl_FragColor=vec4(col,1.0);
          #include <fog_fragment>
        }` });
    const rimM = new THREE.MeshBasicMaterial({ color: new THREE.Color(COLD).multiplyScalar(0.55), transparent: true, opacity: 0.6 });
    S.ponds = POND.map(([a, d, r]) => {
      const x = Math.sin(a * PI / 180) * d, z = Math.cos(a * PI / 180) * d;
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), iceM); m.rotation.x = -PI / 2; m.position.set(x, 0.035, z); g.add(m);
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.03, 48), rimM); rim.rotation.x = -PI / 2; rim.position.set(x, 0.045, z); g.add(rim);
      return { x, z, r, r0: r, rT: r, m, rim };
    });
    // forest: snow-loaded spruce, thinned toward the moon so the sky shows; near trees dark, far ones bluer
    const vr = mulberry(77), NT = 190, pineM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95 });
    S.treeRim = { value: new THREE.Color(0) };
    pineM.onBeforeCompile = (sh) => {
      sh.uniforms.uRimC = S.treeRim; sh.uniforms.uMoonD = { value: MOON };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSnow; varying float vSnow; varying vec3 vWp; varying float vMoonF; uniform vec3 uMoonD;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 wq=vec4(transformed,1.0); vec3 wn=objectNormal;\n#ifdef USE_INSTANCING\n wq=instanceMatrix*wq; wn=mat3(instanceMatrix)*wn;\n#endif\n vWp=(modelMatrix*wq).xyz; wn=mat3(modelMatrix)*wn; wn/=max(length(wn),1e-4); vMoonF=max(dot(wn,uMoonD),0.0); vSnow=aSnow*smoothstep(-0.2,0.5,wn.y); }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSnow; varying vec3 vWp; varying float vMoonF; uniform vec3 uRimC;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n{ float nz=0.5+0.25*sin(vWp.x*3.1+vWp.y*2.3+sin(vWp.z*2.7))+0.25*sin(vWp.z*4.3-vWp.y*3.7+sin(vWp.x*1.9)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.74,0.8,0.92),smoothstep(0.42,0.62,vSnow+(nz-0.5)*0.35)); }')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv=vViewPosition/max(length(vViewPosition),1e-4); float fr=clamp(1.0-abs(dot(normal,vv)),0.0,1.0); totalEmissiveRadiance+=uRimC*(fr*fr*0.8+0.15)*vMoonF; }');
    };
    pineM.customProgramCacheKey = () => 'wpine';
    const trees = new THREE.InstancedMesh(pineGeo(), pineM, NT); trees.castShadow = false;
    for (let i = 0; i < NT; i++) {
      let a, d; for (let tries = 0; tries < 12; tries++) { a = vr() * TAU; d = R + 9 + Math.pow(vr(), 1.25) * 78; if (!(Math.abs(angDiff(a, MOONAZ)) < 0.32 && d < R + 70 && vr() < 0.85)) break; }
      const sc = (d < R + 22 ? 0.55 + vr() * 0.3 : 0.7 + vr() * 0.5) * (1 + (d - R) * 0.003), far = clamp((d - R - 9) / 70, 0, 1);
      _m.rotation.set(0, vr() * 7, 0); _m.scale.set(sc, sc * (0.9 + vr() * 0.3), sc); _m.position.set(Math.sin(a) * d, -0.1, Math.cos(a) * d); _m.updateMatrix(); trees.setMatrixAt(i, _m.matrix);
      trees.setColorAt(i, _c.setRGB(0.6 + far * 0.5, 0.65 + far * 0.6, 0.7 + far * 0.9));
    }
    g.add(trees);
    // far ridge: moonlit snow edge on the moon side, misty base (unfogged so it does not turn into a flat black cut-out)
    const ridgeM = new THREE.ShaderMaterial({ uniforms: { uHaze: SU.uHaze, uMoonD: { value: MOON } },
      vertexShader: 'varying vec3 vW; varying float vV; void main(){ vV=uv.y; vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }',
      fragmentShader: 'uniform vec3 uHaze,uMoonD; varying vec3 vW; varying float vV;' + NZ + 'void main(){ vec3 n=cross(dFdx(vW),dFdy(vW)); n/=max(length(n),1e-6); vec3 v=cameraPosition-vW; if(dot(n,v)<0.0) n=-n; float lit=max(dot(n,normalize(vec3(uMoonD.x,0.6,uMoonD.z))),0.0); float sn=smoothstep(0.58,0.7,vV+0.06*sin(vW.x*0.3+vW.z*0.2)); float sk=smoothstep(0.55,0.8,n2(vec2((vW.x+vW.z)*0.22,vW.y*0.07))); float st=smoothstep(0.62,0.8,n2(vec2((vW.x-vW.z)*0.6,vW.y*0.03)))*smoothstep(0.2,0.5,vV)*lit; vec3 col=mix(vec3(0.012,0.02,0.035)+vec3(0.06,0.08,0.12)*pow(lit,3.0),vec3(0.08,0.1,0.15)*(0.25+lit),clamp(sn*(1.0-sk*0.85)*smoothstep(0.1,0.5,lit+0.15)+st*0.8,0.0,1.0)); col=mix(col,uHaze*1.5,(1.0-smoothstep(0.0,0.5,vV))*0.9); gl_FragColor=vec4(col,1.0); }' });
    for (const [D, HS, ph] of [[240, 1.35, 2.1], [185, 1, 0.4]]) { // two jagged ridgelines, low where the moon sets
      const NC = 300, NR = 7, P = [], UV = [], I = [];
      for (let c = 0; c <= NC; c++) { const an = c / NC * TAU; let H = 0; [[3, 9], [7, 7], [17, 4.5], [41, 2], [97, 0.8]].forEach(([fq, am], k) => { H += am * Math.pow(1 - Math.abs(Math.sin(an * fq + ph * (k + 1) * 1.7)), 2); });
        H = (H * 1.6 + 4) * HS * (0.3 + 0.7 * smooth((Math.abs(angDiff(an, MOONAZ)) - 0.12) / 0.35));
        for (let r = 0; r <= NR; r++) { const t = r / NR, rad = D + (1 - t) * 34 + (hsh(c, r, ph) - 0.5) * 6 * (1 - t), y = -4 + (H + 4) * t + (hsh(r, c, 3) - 0.5) * 3 * t * (1 - t); P.push(Math.sin(an) * rad, y, Math.cos(an) * rad); UV.push(c / NC, t); } }
      for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) { const i0 = c * (NR + 1) + r, i1 = i0 + NR + 1; I.push(i0, i0 + 1, i1, i1, i0 + 1, i1 + 1); }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); rg.setIndex(I);
      const mt = new THREE.Mesh(rg, ridgeM); mt.frustumCulled = false; g.add(mt); }
    // standing stones: rune-cut, snow-capped, drifted on the outer side, a cold flame floating above
    S.fireM = W.glow(COLD, 3); S.runeC = new THREE.Color(COLD);
    const stoneM = hunterMat(0x262c36, 0.9, 0x0c1828, 1.0, { flatShading: true }), sOnB = stoneM.onBeforeCompile;
    stoneM.onBeforeCompile = (sh) => { sOnB(sh); sh.uniforms.uRune = { value: S.runeC };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP=position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; uniform vec3 uRune;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec2 rq=vec2(atan(vOP.x,vOP.z)*1.3,vOP.y*2.6); vec2 ci=floor(rq), cf=fract(rq)-0.5; float hh=fract(sin(dot(ci,vec2(12.99,78.23)))*43758.5);\n float d=abs(cf.x+(hh-0.5)*0.2); if(hh>0.35) d=min(d,abs(cf.y-cf.x*sign(hh-0.6))); if(hh>0.7) d=min(d,abs(cf.y+0.18)); if(fract(hh*7.0)>0.5) d=min(d,abs(length(cf-vec2(0.0,0.2))-0.12));\n float rn=(1.0-smoothstep(0.025,0.06,d))*step(max(abs(cf.x),abs(cf.y)),0.36)*step(0.2,hh)*smoothstep(-1.5,-1.1,vOP.y)*smoothstep(1.3,0.9,vOP.y); totalEmissiveRadiance+=uRune*rn*0.55; }');
    };
    stoneM.customProgramCacheKey = () => 'wstone';
    const stG = new THREE.CylinderGeometry(0.42, 0.7, 4.2, 7, 5); { const p = stG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), j = 1 + (hsh(x, y, z) - 0.5) * 0.22, top = y > 2 ? 0.75 : 1; p.setXYZ(i, x * j * top, y + (y > 2 ? x * 0.35 : 0), z * j * top); } stG.computeVertexNormals(); }
    const drM = W.mat({ color: 0xdfe8f6, roughness: 0.95 }), halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    S.haloM = new THREE.SpriteMaterial({ map: halo, color: new THREE.Color(COLD).multiplyScalar(0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + PI / 6, x = Math.sin(a) * (R + 1.6), z = Math.cos(a) * (R + 1.6);
      const st = new THREE.Mesh(stG, stoneM); st.position.set(x, 1.9, z); st.rotation.y = a + PI; st.castShadow = true; g.add(st);
      const dr = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), drM); dr.scale.set(1.3, 0.55, 0.9); dr.position.set(x + Math.sin(a) * 0.7, 0.1, z + Math.cos(a) * 0.7); dr.rotation.y = a; g.add(dr);
      const sk = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), S.fireM); sk.position.set(x, 4.6, z); sk.scale.y = 1.6; g.add(sk);
      const hs = new THREE.Sprite(S.haloM); hs.scale.setScalar(2.4); hs.position.set(x, 4.6, z); g.add(hs);
      if (i % 2 === 0) { const L = new THREE.PointLight(COLD, 22, 22, 1.7); L.position.set(x, 4, z); g.add(L); }
    }
    S.snow = W.motes({ n: 1100, box: [64, 26, 64], color: 0xffffff, size: 0.3, vel: [0.5, -2.4, 0.2], sway: 0.6, center: [0, 13, 0], alpha: 0.75 }); g.add(S.snow);
    // wind: spindrift hugging the ground (second act on), driving diagonal streaks (blizzard)
    const streaks = (n, box, ctr, len) => {
      const P = new Float32Array(n * 6), sd = new Float32Array(n * 2), e = new Float32Array(n * 2), r = mulberry(n);
      for (let i = 0; i < n; i++) { const x = r() * box[0], y = r() * box[1], z = r() * box[2], s = r(); for (let k = 0; k < 2; k++) { P.set([x, y, z], (i * 2 + k) * 3); sd[i * 2 + k] = s; e[i * 2 + k] = k; } }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(P, 3)); gg.setAttribute('aS', new THREE.BufferAttribute(sd, 1)); gg.setAttribute('aE', new THREE.BufferAttribute(e, 1)); gg.boundingSphere = new THREE.Sphere(new V3(), 1e6);
      const U = { uTime: { value: 0 }, uBox: { value: new V3(...box) }, uC: { value: new V3(...ctr) }, uVel: { value: new V3(10, -1, 0) }, uLen: { value: len }, uAmt: { value: 0 } };
      const L = new THREE.LineSegments(gg, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'uniform float uTime,uLen,uAmt; uniform vec3 uBox,uC,uVel; attribute float aS,aE; varying float vA; void main(){ float sp=0.7+aS*0.6; vec3 p=mod(position+uVel*uTime*sp,uBox)-uBox*0.5+uC; p-=uVel*uLen*sp*aE; vec4 mv=modelViewMatrix*vec4(p,1.0); vA=uAmt*(0.35+0.65*aS)*(1.0-aE)*smoothstep(1.5,6.0,-mv.z); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'varying float vA; void main(){ gl_FragColor=vec4(vec3(0.8,0.9,1.0)*vA,vA); }' }));
      L.frustumCulled = false; L.renderOrder = 14; L.onBeforeRender = () => { U.uTime.value = G.now; }; g.add(L); return U;
    };
    S.drift = streaks(900, [60, 1.4, 60], [0, 0.6, 0], 0.12);
    // frost plume: CPU particles blown downwind off the antlers (act 2 on), off the cape (blizzard) and out of the horn (howl)
    { const N = 300, P = new Float32Array(N * 3), A = new Float32Array(N), Z = new Float32Array(N), pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(P, 3)); pg.setAttribute('aA', new THREE.BufferAttribute(A, 1)); pg.setAttribute('aS', new THREE.BufferAttribute(Z, 1)); pg.boundingSphere = new THREE.Sphere(new V3(), 1e6);
      const pm = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 500 }, uC: { value: new THREE.Color(0xdcf2ff) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'uniform float uScale; attribute float aA,aS; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vA=aA*smoothstep(0.8,3.0,-mv.z); gl_PointSize=aS*uScale/max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uC; varying float vA; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c)*2.0; if(d>1.0) discard; float a=vA*(1.0-d)*(1.0-d); gl_FragColor=vec4(uC*a,a); }' });
      const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; pts.renderOrder = 15; pts.onBeforeRender = () => { pm.uniforms.uScale.value = renderer.domElement.height * 0.5; }; g.add(pts);
      S.pl = { P, A, Z, v: new Float32Array(N * 3), age: new Float32Array(N).fill(9), life: new Float32Array(N).fill(1), sz: new Float32Array(N), n: N, i: 0, geo: pg }; }
    // howl shockwave: thin frost-white leading edge, short crimson trailing band
    S.hr = [0, 1].map(() => { const U = { uR: { value: 1 }, uA: { value: 0 } }, m = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vU; void main(){ vU=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float uR,uA; varying vec2 vU; void main(){ float e=(1.0-length(vU))*uR; if(e<0.0) discard; float lead=exp(-e*e*60.0), tr=exp(-e*1.6)*smoothstep(0.0,0.12,e); vec3 c=vec3(0.95,0.98,1.0)*lead*1.6+vec3(0.55,0.03,0.06)*tr*0.9; float a=(lead+tr*0.6)*uA; gl_FragColor=vec4(c*uA,a); }' }));
      m.rotation.x = -PI / 2; m.position.y = 0.07; m.renderOrder = 11; m.scale.setScalar(0.01); m.frustumCulled = false; g.add(m); return { m, U, t: -9, x: 0, z: 0, k: 0 }; });
    // frost creeping in from the edge of the big telegraphs during the wind-up (drawn under them), cosmetic only
    S.tf = []; S.tfPool = [];
    { const tfG = new THREE.PlaneGeometry(1, 1); tfG.rotateX(-PI / 2);
      const src = { vertexShader: 'varying vec2 vQ; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vQ=wp.xz; gl_Position=projectionMatrix*viewMatrix*wp; }',
        fragmentShader: 'uniform vec2 uO,uF; uniform float uT,uK,uA; uniform vec3 uP; varying vec2 vQ;' + NZ + 'void main(){ vec2 rel=vQ-uO; float len=length(rel), d; if(uT<0.5) d=len-uP.x; else if(uT<1.5){ float an=acos(clamp(dot(rel/max(len,1e-4),uF),-1.0,1.0)); d=max(len-uP.x,(an-uP.y*0.5)*max(len,0.3)); } else { float al=dot(rel,uF), sd=dot(rel,vec2(uF.y,-uF.x)); d=max(abs(sd)-uP.y*0.5,max(-al,al-uP.x)); } if(d>0.0) discard; float e=-d, fr=uK*uP.z; float dens=exp(-e/1.1)*(1.0-smoothstep(fr-0.5,fr,e)); float n=fbm(vQ*2.0); float l1=1.0-smoothstep(0.0,0.1,abs(sin(vQ.x*9.0+vQ.y*5.0+n*7.0))), l2=1.0-smoothstep(0.0,0.1,abs(sin(-vQ.x*4.0+vQ.y*10.0+n*6.0))), l3=1.0-smoothstep(0.0,0.08,abs(sin(vQ.x*13.0-vQ.y*7.0+n*9.0))); float nd=max(max(l1,l2),l3*0.7)*smoothstep(0.35,0.62,n2(vQ*3.0+n*2.0)); float a=clamp((nd*0.42+0.05)*dens*uA,0.0,1.0); gl_FragColor=vec4(vec3(0.86,0.95,1.0),a); }' };
      for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(tfG, new THREE.ShaderMaterial(Object.assign({ uniforms: { uO: { value: new THREE.Vector2() }, uF: { value: new THREE.Vector2(0, 1) }, uT: { value: 0 }, uP: { value: new V3() }, uK: { value: 0 }, uA: { value: 0 } }, transparent: true, depthWrite: false }, src)));
        m.position.y = 0.043; m.scale.setScalar(0.01); m.renderOrder = 9; m.frustumCulled = false; g.add(m); S.tfPool.push(m); } }
    // spindrift ribbons: long soft bands of blown snow skimming the field along the wind (drawn under the telegraphs)
    S.ribU = { uTime: { value: 0 }, uW: { value: new THREE.Vector2(1, 0) }, uAmt: { value: 0 } };
    { const rb = new THREE.Mesh(new THREE.CircleGeometry(R + 4, 48), new THREE.ShaderMaterial({ uniforms: S.ribU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vQ; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vQ=wp.xz; gl_Position=projectionMatrix*viewMatrix*wp; }',
      fragmentShader: 'uniform float uTime,uAmt; uniform vec2 uW; varying vec2 vQ;' + NZ + 'void main(){ vec2 w=uW; vec2 p=vec2(dot(vQ,w),dot(vQ,vec2(-w.y,w.x))); float n=fbm(vec2(p.x*0.07-uTime*2.6,p.y*0.45)); float s=n2(vec2(p.x*0.5-uTime*8.0,p.y*6.0)); float a=smoothstep(0.55,0.82,n)*(0.4+0.6*s)*uAmt*smoothstep(24.0,18.0,length(vQ)); gl_FragColor=vec4(vec3(0.75,0.85,1.0)*a,a); }' }));
      rb.rotation.x = -PI / 2; rb.position.y = 0.12; rb.renderOrder = 5; g.add(rb); } S.storm = streaks(1500, [70, 26, 70], [0, 11, 0], 0.075);
    // footprints + rime spikes (faceted ice, dark blue heart, bright edges)
    const NP = 180; S.NP = NP;
    S.printI = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), NP); S.printI.frustumCulled = false; S.printI.count = 0; g.add(S.printI);
    const spikeM = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog), fog: true, transparent: true,
      vertexShader: 'varying vec3 vW; varying float vY;\n#include <fog_pars_vertex>\nvoid main(){ mat4 mm=modelMatrix;\n#ifdef USE_INSTANCING\n mm=modelMatrix*instanceMatrix;\n#endif\n vec4 wp=mm*vec4(position,1.0); vW=wp.xyz; vY=position.y; vec4 mvPosition=viewMatrix*wp; gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: 'varying vec3 vW; varying float vY;\n#include <fog_pars_fragment>\nvoid main(){ vec3 n=cross(dFdx(vW),dFdy(vW)); n/=max(length(n),1e-6); vec3 v=cameraPosition-vW; v/=max(length(v),1e-4); if(dot(n,v)<0.0) n=-n; float nd=clamp(dot(n,v),0.0,1.0), fr=pow(1.0-nd,2.2); float h=clamp(vY/2.6+0.5,0.0,1.0); float l=max(dot(n,normalize(vec3(-0.3,0.8,-0.5))),0.0);\n vec3 col=vec3(0.02,0.1,0.26)*(0.7+0.8*h)+vec3(0.3,0.55,0.8)*l*0.35+vec3(0.6,0.85,1.1)*fr*0.85+vec3(0.6,0.9,1.1)*smoothstep(0.85,1.0,h)*0.45;\n gl_FragColor=vec4(col,0.82+fr*0.18);\n#include <fog_fragment>\n}' });
    S.spikeI = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 2.6, 5), spikeM, 240); S.spikeI.frustumCulled = false; S.spikeI.count = 0; g.add(S.spikeI);
    S.spikes = [];
    S.stags = [0, 1, 2, 3].map(() => { const s = beast(true); s.g.visible = false; g.add(s.g); return { m: s, t: -1 }; });
    // javelins: a long ice shard with a white core and a short cold trail
    const shG = new THREE.OctahedronGeometry(0.17, 0); shG.scale(1, 9, 0.8); shG.rotateX(PI / 2); const coG = new THREE.OctahedronGeometry(0.07, 0); coG.scale(1, 15, 1); coG.rotateX(PI / 2);
    const trG = new THREE.ConeGeometry(0.16, 2.6, 8, 1, true); trG.rotateX(-PI / 2); trG.translate(0, 0, -2.2);
    const shardM = new THREE.MeshStandardMaterial({ color: 0x9ad8ff, emissive: 0x2a7ab0, emissiveIntensity: 1, roughness: 0.35, transparent: true, opacity: 0.75 }), coreM = W.glow(0xeaffff, 3.5);
    const trailM = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(COLD) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying float vZ; void main(){ vZ=position.z; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; varying float vZ; void main(){ float a=clamp((vZ+3.5)/2.6,0.0,1.0); a=a*a*0.7; gl_FragColor=vec4(uC*a,a); }' });
    S.javs = [0, 1, 2].map(() => { const j = new THREE.Group(); j.add(new THREE.Mesh(shG, shardM), new THREE.Mesh(coG, coreM), new THREE.Mesh(trG, trailM)); j.visible = false; g.add(j); return { g: j, t: -1, a: new V3(), b: new V3(), dur: 1 }; });
    // soft contact shadows
    const blobM = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0x06122c) }, uA: { value: 0.5 } }, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vU; void main(){ vU=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vU; void main(){ float r=clamp(dot(vU,vU),0.0,1.0); float a=uA*(1.0-r)*(1.0-r); gl_FragColor=vec4(uC,a); }' });
    const blobG = new THREE.PlaneGeometry(2, 2); blobG.rotateX(-PI / 2);
    S.pBlob = new THREE.Mesh(blobG, blobM); S.pBlob.scale.setScalar(0.95); S.pBlob.renderOrder = 2; g.add(S.pBlob);

    // ---- the Huntsman ----
    const bg = b.group; S.rig = new THREE.Group(); bg.add(S.rig);
    const bb = new THREE.Mesh(blobG, blobM); bb.scale.setScalar(2.6); bb.position.y = 0.048; bb.renderOrder = 2; bg.add(bb);
    const rimC = new THREE.Color(0x4a88b8).multiplyScalar(0.55);
    const hide = hunterMat(0x1e232d, 0.95, rimC, 0.25, { side: THREE.DoubleSide }), fur = hunterMat(0x272b34, 1, rimC, 0.85, { side: THREE.DoubleSide }), leather = hunterMat(0x2e241c, 0.85, rimC, 0.2);
    const bone = hunterMat(0xd2cab6, 0.75, new THREE.Color(0x3a5a78).multiplyScalar(0.4), 0.15, { emissive: 0x4a4740 }), dark = new THREE.MeshBasicMaterial({ color: 0x010203 });
    const antM = hunterMat(0xc8d8e4, 0.55, new THREE.Color(COLD).multiplyScalar(0.7), 0, { emissive: new THREE.Color(COLD).multiplyScalar(0.28) });
    const barkM = hunterMat(0x8a7660, 0.85, rimC, 0.3, { emissive: 0x2e261c }), spIce = new THREE.MeshStandardMaterial({ color: 0x6ab8ef, emissive: 0x2a80c0, emissiveIntensity: 0.9, roughness: 0.35, transparent: true, opacity: 0.88 }), iceM2 = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x1a4a70, emissiveIntensity: 0.5, roughness: 0.4, transparent: true, opacity: 0.85 });
    const add = (par, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.castShadow = true; par.add(o); return o; };
    // robe cinched at the waist and narrowing to the knees, open fur cape, shaggy mantle: shoulders are the widest point
    const hideR = hunterMat(0x1e232d, 0.95, rimC, 0.25, { side: THREE.DoubleSide, vertexColors: true }), furR = hunterMat(0x272b34, 1, rimC, 0.85, { side: THREE.DoubleSide, vertexColors: true });
    add(S.rig, rag(0.5, 1.15, 4.9, 48, 1, 1.0, 0, TAU, 1), hideR, 0, 2.58, 0);
    add(S.rig, new THREE.CapsuleGeometry(0.62, 1.2, 4, 12), hide, 0, 4.35, 0, 0, 0, 0, 0.8, 1.15, 0.6);
    add(S.rig, rag(0.85, 1.35, 3.4, 38, 7, 1.0, 1.0, TAU - 2.0), furR, 0, 3.55, -0.05);
    for (const sx of [-1, 1]) { add(S.rig, new THREE.CylinderGeometry(0.15, 0.11, 1.7, 7), leather, sx * 0.27, 0.85, 0.05, 0, 0, sx * 0.04); add(S.rig, new THREE.SphereGeometry(1, 8, 6), hide, sx * 0.28, 0.1, 0.12, 0, 0, 0, 0.16, 0.12, 0.26); }
    // the back: a grey-white wolf pelt hung down the cape, a quiver of spare javelins
    { const pelt = hunterMat(0xb4bac4, 1, rimC, 0.4, { emissive: 0x50545c }), pd = hunterMat(0x2a2d33, 1, rimC, 0.3), P = new THREE.Group(); P.position.set(-0.55, 4.0, -1.3); P.rotation.set(0.1, 0, -0.3); S.rig.add(P);
      for (const sx of [-1, 1]) add(S.rig, new THREE.ConeGeometry(0.08, 0.7, 5), pelt, -0.95 + sx * 0.22, 4.75, 0.55, 0.3, 0, PI + sx * 0.1);
      add(P, new THREE.ConeGeometry(0.42, 2.0, 8), pelt, 0, -0.35, 0, PI, 0, 0, 1, 1, 0.22); add(P, new THREE.SphereGeometry(0.2, 8, 6), pd, 0, 0.72, -0.04, 0, 0, 0, 1, 0.8, 0.9); add(P, new THREE.ConeGeometry(0.09, 0.3, 4), pd, 0, 0.6, -0.2, -PI / 2 - 0.4);
      for (const sx of [-1, 1]) { add(P, new THREE.ConeGeometry(0.06, 0.55, 4), pelt, sx * 0.36, 0.3, 0, PI, 0, -sx * 0.9); add(P, new THREE.ConeGeometry(0.05, 0.18, 4), pd, sx * 0.1, 0.9, -0.02, 0, 0, sx * 0.2); } }
    { const Q = new THREE.Group(); Q.position.set(0.35, 4.55, -1.14); Q.rotation.set(-0.18, 0, -0.4); S.rig.add(Q); add(Q, new THREE.CylinderGeometry(0.17, 0.13, 1.3, 9), leather, 0, 0, 0);
      for (let k = 0; k < 3; k++) { add(Q, new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), barkM, (k - 1) * 0.07, 0.95, (k % 2) * 0.05); add(Q, new THREE.OctahedronGeometry(0.08, 0), spIce, (k - 1) * 0.07, 1.5, (k % 2) * 0.05, 0, 0, 0, 0.8, 3.2, 0.6); } }
    const mg = new THREE.SphereGeometry(1, 22, 10, 0, TAU, 0, PI * 0.55); { const p = mg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), j = 1 + (hsh(Math.round(x * 9), Math.round(y * 9), Math.round(z * 9)) - 0.5) * 0.18; p.setXYZ(i, x * j, y * j, z * j); } mg.computeVertexNormals(); }
    add(S.rig, mg, fur, 0, 4.95, -0.05, 0, 0, 0, 1.5, 0.62, 1.08);
    { const tf = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 0.75, 4), fur, 34); tf.castShadow = true;
      for (let i = 0; i < 34; i++) { const a = i / 34 * TAU, ln = 0.7 + hsh(i, 2, 3) * 0.7; _m.position.set(Math.sin(a) * 1.45, 4.9 - ln * 0.3, Math.cos(a) * 1.05 - 0.05); _m.rotation.set(Math.cos(a) * 0.5 + PI, 0, -Math.sin(a) * 0.5); _m.scale.set(1, ln, 1); _m.updateMatrix(); tf.setMatrixAt(i, _m.matrix); }
      S.rig.add(tf); }
    { const ic = new THREE.InstancedMesh(new THREE.ConeGeometry(0.04, 0.6, 5).rotateX(PI), iceM2, 15);
      for (let i = 0; i < 15; i++) { const a = i / 15 * TAU + hsh(i, 9, 2) * 0.35, ln = 0.25 + Math.pow(hsh(i, 5, 1), 2) * 1.2; _m.position.set(Math.sin(a) * 1.4, 4.76 - ln * 0.3 - hsh(i, 3, 3) * 0.12, Math.cos(a) * 1.0 - 0.05); _m.rotation.set(0, 0, 0); _m.scale.set(1, ln, 1); _m.updateMatrix(); ic.setMatrixAt(i, _m.matrix); }
      S.rig.add(ic); }
    // belt cinch and trophies
    add(S.rig, new THREE.TorusGeometry(0.62, 0.085, 6, 28), leather, 0, 3.17, 0, PI / 2, 0, 0, 1, 0.95, 1);
    add(S.rig, new THREE.BoxGeometry(0.22, 0.2, 0.08), bone, 0, 3.17, 0.64);
    for (const [a, k] of [[0.55, 0], [-0.6, 1], [1.2, 2], [-1.25, 0]]) {
      const t = new THREE.Group(); t.position.set(Math.sin(a) * 0.66, 3.12, Math.cos(a) * 0.66); t.rotation.y = a; S.rig.add(t);
      add(t, new THREE.CylinderGeometry(0.012, 0.012, 0.5, 3), leather, 0, -0.25, 0.04);
      if (k === 0) { add(t, new THREE.SphereGeometry(0.13, 8, 6), bone, 0, -0.55, 0.06, 0, 0, 0, 0.85, 0.9, 1); add(t, new THREE.ConeGeometry(0.07, 0.24, 5), bone, 0, -0.66, 0.16, 2.2); }
      else if (k === 1) add(t, new THREE.CapsuleGeometry(0.11, 0.42, 3, 6), fur, 0, -0.75, 0.08);
      else for (let f = 0; f < 3; f++) add(t, new THREE.ConeGeometry(0.035, 0.42, 3), bone, (f - 1) * 0.06, -0.62, 0.05, PI, 0, (f - 1) * 0.25);
    }
    // peaked draped hood, a long deer skull pushed out of it
    S.head = new THREE.Group(); S.head.position.set(0, 6.05, 0.2); S.rig.add(S.head);
    { const hg = new THREE.SphereGeometry(0.6, 20, 12, PI / 2 + 0.8, TAU - 1.6, 0, PI * 0.8), p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = Math.max(0, y) * Math.max(0, -z - 0.1); p.setXYZ(i, x * (1 - k * 0.7), y + k * 1.9 - Math.max(0, -y) * 0.5, z - k * 0.8 - Math.max(0, -y) * 0.1); } hg.computeVertexNormals(); add(S.head, hg, fur, 0, 0.05, -0.12, 0.1, 0, 0, 0.92, 1.05, 1.1); }
    add(S.head, new THREE.SphereGeometry(0.5, 14, 10, 0, TAU, 0, PI * 0.75), dark, 0, 0.05, -0.2, 0.2, 0, 0, 0.9, 1.1, 0.9);
    // the skull hangs muzzle-down out of the hood: its brow faces the viewer, the muzzle runs down to the collar
    { const sg = new THREE.BoxGeometry(1, 1, 1, 4, 3, 8), p = sg.attributes.position, VC = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = z + 0.5, w = 0.34 * (1 - 0.74 * smooth((t - 0.15) / 0.85)) * (1 + 0.15 * Math.exp(-(((t - 0.12) / 0.1) ** 2))), hh = 0.34 * (1 - 0.6 * smooth((t - 0.1) / 0.9)) * (1 + 0.3 * (1 - smooth(t / 0.3)));
        p.setXYZ(i, x * w, y * hh + (y > 0 ? 0 : 0.02 * t), z * 1.25); const k = (1 - 0.45 * smooth((t - 0.35) / 0.65)) * (1 - 0.35 * smooth((Math.abs(x) - 0.3) / 0.2) * smooth((t - 0.2) / 0.3)) * (y < 0 ? 0.8 : 1); VC[i * 3] = VC[i * 3 + 1] = VC[i * 3 + 2] = k; }
      sg.setAttribute('color', new THREE.BufferAttribute(VC, 3)); sg.computeVertexNormals();
      const boneV = hunterMat(0xd8d0bc, 0.75, new THREE.Color(0x3a5a78).multiplyScalar(0.4), 0.15, { emissive: 0x302e2a, vertexColors: true });
      const K = new THREE.Group(); K.position.set(0, -0.32, 0.32); K.rotation.x = 1.22; S.head.add(K); add(K, sg, boneV, 0, 0, 0);
      add(K, new THREE.BoxGeometry(0.15, 0.05, 0.72), bone, 0, -0.14, 0.12, -0.08);
      add(K, new THREE.BoxGeometry(0.34, 0.06, 0.08), bone, 0, 0.17, -0.43, 0.25);
      for (const sx of [-1, 1]) add(K, new THREE.BoxGeometry(0.03, 0.03, 0.2), dark, sx * 0.022, 0.07, 0.45, 0, sx * 0.12);
      S.eyeM = W.glow(COLD, 4);
      for (const sx of [-1, 1]) { add(K, new THREE.SphereGeometry(1, 8, 6), dark, sx * 0.105, 0.1, -0.33, 0, 0, 0, 0.09, 0.075, 0.1); add(K, new THREE.SphereGeometry(0.026, 8, 6), S.eyeM, sx * 0.105, 0.18, -0.33); } }
    S.antTipM = W.glow(COLD, 3); S.ants = [-1, 1].map((sx) => antler(S.head, antM, sx, S.antTipM));
    { const ic = new THREE.InstancedMesh(new THREE.ConeGeometry(0.03, 0.4, 4).rotateX(PI), iceM2, 8); for (let i = 0; i < 8; i++) { const sx = i < 4 ? -1 : 1, k = i % 4; _m.position.set(sx * (0.25 + k * 0.05), 0.42 - k * 0.04, -0.1 + (k - 1.5) * 0.08); _m.rotation.set(0, 0, 0); _m.scale.set(1, 0.6 + hsh(i, 1, 1) * 0.8, 1); _m.updateMatrix(); ic.setMatrixAt(i, _m.matrix); } S.head.add(ic); }
    // arms: upper arm, bracer'd forearm, hand on the spear
    const arm = (sx) => {
      const A = new THREE.Group(); A.position.set(sx * 1.25, 5.05, 0); S.rig.add(A);
      add(A, new THREE.CapsuleGeometry(0.17, 0.75, 3, 8), hide, 0, -0.5, 0);
      add(A, new THREE.CylinderGeometry(0.1, 0.13, 0.8, 7), hide, 0, -1.38, 0.1, -0.26); add(A, new THREE.CylinderGeometry(0.145, 0.15, 0.42, 7), leather, 0, -1.3, 0.08, -0.26);
      add(A, new THREE.SphereGeometry(1, 8, 6), hide, 0, -1.8, 0.2, 0, 0, 0, 0.13, 0.16, 0.14);
      add(A, new THREE.SphereGeometry(1, 10, 6, 0, TAU, 0, PI * 0.5), fur, 0, -0.08, 0, 0, 0, sx * -0.3, 0.42, 0.3, 0.38);
      return A;
    };
    S.armR = arm(1);
    S.spear = new THREE.Group(); S.spear.position.set(0, -1.8, 0.2); S.spear.rotation.x = PI / 2 - 0.25; S.armR.add(S.spear);
    add(S.spear, new THREE.CylinderGeometry(0.075, 0.088, 6.4, 8), barkM, 0, 0, 0);
    for (const y of [-0.06, 0.07]) add(S.spear, new THREE.TorusGeometry(0.1, 0.045, 5, 10), hide, 0, y, 0, PI / 2);
    for (const y of [2.75, 2.9, 3.05]) add(S.spear, new THREE.TorusGeometry(0.11, 0.03, 4, 10), leather, 0, y, 0, PI / 2);
    add(S.spear, new THREE.OctahedronGeometry(0.22, 0), spIce, 0, 3.9, 0, 0, 0.4, 0, 1.1, 5.2, 0.6);
    S.tipM = W.glow(COLD, 2.6); add(S.spear, new THREE.OctahedronGeometry(0.09, 0), S.tipM, 0, 3.85, 0, 0, 0.4, 0, 1, 9, 0.6);
    S.armL = arm(-1);
    { // horn: unlit dark horn with pale banding and a rim, so no coloured light can turn it pink
      const hornM = new THREE.ShaderMaterial({ uniforms: { uRimC: { value: MRIM } }, side: THREE.DoubleSide,
        vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY=uv.y; vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; vN=normalMatrix*normal; gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uRimC; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4), v=vV/max(length(vV),1e-4); float fr=pow(clamp(1.0-abs(dot(n,v)),0.0,1.0),2.5); float bd=smoothstep(0.93,0.99,0.5+0.5*sin(vY*15.0+1.0))+smoothstep(0.06,0.0,vY); vec3 c=mix(vec3(0.02,0.016,0.012),vec3(0.13,0.12,0.1),clamp(bd,0.0,1.0))+vec3(0.3,0.4,0.5)*fr*0.55+uRimC*fr*0.25; gl_FragColor=vec4(c,1.0); }' });
      S.horn = add(S.armL, new THREE.ConeGeometry(0.26, 1.3, 10, 1, true), hornM, 0, -1.9, 0.35, -PI / 2 - 0.5); }
    S.light = new THREE.PointLight(COLD, 6, 10, 1.6); S.light.position.set(0, 2.4, 1.6); bg.add(S.light);
    Object.assign(S, { trail: [], nid: 1, lastX: 1e9, lastZ: 0, foot: 1, brk: false, vx: 0, vz: 0, ice: false, hounds: [], stalk: false, blizz: 0, blizzK: 0, windA: 0, windT: 0, life: 14, hSpeed: 8.6, rage: 0, raise: 0, hornUp: 0, lvl: 0, look: 0, botIce: false, antK: 1 });
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 14.5 }, bossStart: { x: 0, z: -9, face: 0 }, camDist: 15, camPitch: 0.32,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
      camLimit(x, y, z) { const d = Math.hypot(x, z); if (d > 26) { x *= 26 / d; z *= 26 / d; } return { x, y: Math.max(y, d > R ? 0.6 + (d - R) * 0.5 : 0.4), z }; },
    };
  }
  // type 0 circle (a=r), 1 cone (a=r, b=arc), 2 rect (a=len, b=w); h is the shared hazard, only read for its timing
  function frostTele(S, h, type, x, z, dir, a, b) {
    if (G.headless || !h) return; const m = S.tfPool.pop(); if (!m) return; const u = m.material.uniforms, fx = Math.sin(dir), fz = Math.cos(dir);
    u.uT.value = type; u.uO.value.set(x, z); u.uF.value.set(fx, fz); u.uP.value.set(a, b || 0, type === 2 ? b * 0.5 : type === 1 ? a * 0.75 : a); u.uK.value = 0; u.uA.value = 0;
    if (type === 2) { m.position.set(x + fx * a / 2, 0.043, z + fz * a / 2); m.scale.setScalar(Math.max(a, b) + 1); } else { m.position.set(x, 0.043, z); m.scale.setScalar(a * 2 + 1); }
    S.tf.push({ m, h, type, x, z, fx, fz, a, b: b || 0, t: 0, dur: Math.max(0.2, h.delay), done: false });
  }
  function powder(e) { // snow thrown up across the shape the moment it fires
    for (let i = 0; i < 14; i++) { let px, pz; const k = vrand(), j = vrand() - 0.5;
      if (e.type === 2) { px = e.x + e.fx * e.a * k + e.fz * j * e.b; pz = e.z + e.fz * e.a * k - e.fx * j * e.b; }
      else if (e.type === 1) { const an = Math.atan2(e.fx, e.fz) + j * e.b, r = e.a * (0.35 + 0.65 * Math.sqrt(k)); px = e.x + Math.sin(an) * r; pz = e.z + Math.cos(an) * r; }
      else { const an = vrand() * TAU, r = e.a * Math.sqrt(k); px = e.x + Math.sin(an) * r; pz = e.z + Math.cos(an) * r; }
      FX.burst(px, 0.15, pz, { n: 3, color: 0xf2f8ff, color2: 0xbfe4ff, speed: [1, 4], up: 2.5, life: [0.4, 0.9], size: [0.18, 0.45], grav: 4, flat: true }); }
  }
  function emit(S, x, y, z, vx, vy, vz, life, size) { const q = S.pl, k = q.i++ % q.n; q.P[k * 3] = x; q.P[k * 3 + 1] = y; q.P[k * 3 + 2] = z; q.v[k * 3] = vx; q.v[k * 3 + 1] = vy; q.v[k * 3 + 2] = vz; q.age[k] = 0; q.life[k] = life; q.sz[k] = size; }
  function throwJav(S, from, to) {
    const j = S.javs.find((q) => q.t < 0) || S.javs[0]; j.a.copy(from); j.b.copy(to); j.t = 0; j.dur = Math.max(0.05, from.distanceTo(to) / 30); j.g.visible = true; j.g.position.copy(from);
  }

  // ---- the pack ----
  function loose(b, n) {
    const S = b.state, p = G.player;
    for (let k = 0; k < n; k++) {
      const first = S.trail[0], a0 = first ? Math.atan2(first.x, first.z) : Math.atan2(-p.pos.x, -p.pos.z), a = a0 + (k - (n - 1) / 2) * 0.5, hm = beast(false);
      const e = b.spawnAdd({
        name: 'Hound', hp: 280, x: Math.sin(a) * (R - 1), z: Math.cos(a) * (R - 1), radius: 0.7, aimY: 0.9, mesh: hm.g, color: COLD,
        update(e, dt) {
          const pl = G.player; if (!pl.alive || G.state !== 'fight') return;
          e.run = (e.run || 0) + dt * (e.moving ? 16 : 3); hm.legs.forEach((h, i) => { h.rotation.x = e.moving ? Math.sin(e.run + (i % 2 ? PI : 0) + (i > 1 ? 1 : 0)) * 0.9 : 0; }); hm.neck.rotation.x = e.moving ? 0.5 : -0.5 + Math.sin(e.run) * 0.25; hm.tail.rotation.y = Math.sin(e.run * 0.5) * 0.3; e.moving = false;
          if (b.transitioning) return;
          if (e.pause > 0) { e.pause -= dt; return; }
          const dp = Math.hypot(pl.pos.x - e.pos.x, pl.pos.z - e.pos.z);
          if (dp < 1.9) { e.pause = 1.5; e.facing = angTo(e.pos.x, e.pos.z, pl.pos.x, pl.pos.z); Sound.sfx('roar', 0.5, 2.2); Hz.circle(e.pos.x + Math.sin(e.facing) * 0.9, e.pos.z + Math.cos(e.facing) * 0.9, 2.2, 0.6, 230, { name: 'Bite', color: SCENT, quiet: true, tag: 'fight' }); return; }
          let nx = null; for (const q of S.trail) if (q.id > e.last) { nx = q; break; }
          if (nx && nx.gap && !e.fresh && Math.hypot(nx.x - e.pos.x, nx.z - e.pos.z) > 6.5) nx = null;
          if (nx) {
            const dx = nx.x - e.pos.x, dz = nx.z - e.pos.z, d = Math.hypot(dx, dz) || 1, s = S.hSpeed * (S.rage > 0 ? 1.25 : 1) * dt; e.lost = 0; e.moving = true;
            if (d <= s + 0.3) { e.last = nx.id; e.fresh = false; }
            e.pos.x += dx / d * Math.min(d, s); e.pos.z += dz / d * Math.min(d, s); e.facing = dampAng(e.facing, Math.atan2(dx, dz), 14, dt);
          } else {
            // the scent ends here
            e.lost = (e.lost || 0) + dt; e.facing += Math.sin(e.lost * 3) * dt * 3;
            hm.mat.uniforms.uA.value = hm.mist.uniforms.uA.value = clamp(1 - (e.lost - 2.5) / 2, 0.15, 1);
            if (e.lost > 4.5) e.die();
          }
        },
        onDeath(e) { const i = S.hounds.indexOf(e); if (i >= 0) S.hounds.splice(i, 1); },
      });
      e.last = first ? first.id - 1 : 0; e.fresh = true; e.pause = 0.9 + k * 0.5; e.mat = hm.mat; S.hounds.push(e);
      if (!G.headless) FX.burst(e.pos.x, 1, e.pos.z, { n: 20, color: COLD, speed: [1, 5], life: [0.4, 0.9], size: [0.2, 0.5] });
    }
  }
  function* hounds(b, n) {
    const S = b.state; S.hornUp = 1;
    yield* b.cast({ name: 'Loose the Hounds', time: 1.5 }); Sound.sfx('roar', 0.8, 1.6); S.hornUp = 0; loose(b, n); yield 0.8;
  }
  function* howl(b) {
    const S = b.state; S.hornUp = 1; S.howl = 1;
    const r = yield* b.cast({ name: 'The Long Howl', time: 2.8, interruptible: true }); S.hornUp = 0; S.howl = 0;
    if (r === 'done') { Sound.sfx('roar', 1, 0.7); FX.flash(SCENT, 0.12, 2.5); S.rage = 12; loose(b, 2); if (!G.headless) { S.hr.forEach((h, i) => { h.t = -i * 0.22; h.x = b.pos.x; h.z = b.pos.z; h.k = 0; }); } }
    yield 0.8;
  }
  // ---- the Huntsman's own hands ----
  function* javelin(b, n) {
    const S = b.state, p = G.player;
    for (let i = 0; i < n; i++) {
      S.raise = 1; yield* b.cast({ name: 'Javelin', time: 0.55 });
      const x = p.pos.x + (i ? S.vx * 0.5 : 0), z = p.pos.z + (i ? S.vz * 0.5 : 0); S.raise = 0;
      if (!G.headless) throwJav(S, _v.set(b.pos.x, 6, b.pos.z), _w.set(x, 0.2, z)); Sound.sfx('dash', 0.8, 0.6);
      frostTele(S, Hz.circle(x, z, 3.0, 1.2, 300, { name: 'Javelin', onFire() { FX.explode(x, 0.4, z, COLD, 3, 0xffffff); Sound.sfx('shatter', 0.8); FX.shake(0.4); } }), 0, x, z, 0, 3.0);
      yield 0.5;
    }
    yield 0.9;
  }
  function* sweep(b) {
    const S = b.state, dir = b.angToPlayer(); b.autoFace = false; S.stalk = false; S.raise = 0.6;
    frostTele(S, Hz.cone(b.pos.x, b.pos.z, dir, 2.5, 8, 1.15, 330, { name: 'Reaping Sweep', onFire() { FX.shake(0.5); Sound.sfx('sword', 1, 0.6); } }), 1, b.pos.x, b.pos.z, dir, 8, 2.5);
    yield* b.cast({ name: 'Reaping Sweep', time: 1.15 }); S.raise = 0; S.swing = 1; yield 0.6; b.autoFace = true; S.stalk = true;
  }
  function* hoarfrost(b) {
    const S = b.state; S.raise = 1;
    yield* b.cast({ name: 'Hoarfrost', time: 1.7 }); S.raise = 0; Sound.sfx('shatter', 1, 0.5); FX.flash(COLD, 0.2, 0.6);
    const now = G.now, pr = S.trail.filter((q) => now - q.t < 9).slice(-52);
    for (let k = pr.length % 2 ? 0 : 1, j = 0; k < pr.length; k += 2, j++) {
      const q = pr[k];
      Hz.circle(q.x, q.z, 1.45, 0.95 + j * 0.05, 250, { name: 'Hoarfrost', color: TEL, quiet: true, onFire() {
        S.spikes.push({ x: q.x, z: q.z, t: 0, life: 6.2, rot: q.id }); if (j % 3 === 0) Sound.sfx('shatter', 0.35, 1.4 + j * 0.02);
        FX.burst(q.x, 0.2, q.z, { n: 5, color: 0xeef8ff, color2: COLD, speed: [1, 4], up: 2, life: [0.3, 0.7], size: [0.1, 0.28], radius: 0.6 });
        Hz.zone({ type: 'circle', x: q.x, z: q.z, r: 1.05 }, 6, 70, { name: 'Rime', color: TEL, delay: 0.25 });
      } });
    }
    yield 1.6;
  }
  function* icebreaker(b) {
    const S = b.state; S.raise = 1; S.stalk = false;
    for (const q of S.ponds) Hz.circle(q.x, q.z, q.r, 2.1, 310, { name: 'Icebreaker', color: 0x60c0ff, quiet: true });
    yield* b.cast({ name: 'Icebreaker', time: 2.1 }); S.raise = 0; S.swing = 1; Sound.sfx('bigboom', 0.9); Sound.sfx('shatter', 1, 0.4); FX.shake(0.9);
    if (!G.headless) for (const q of S.ponds) { FX.ring(q.x, q.z, { r0: 0.5, r1: q.r, color: COLD, dur: 0.5 }); FX.burst(q.x, 0.3, q.z, { n: 40, color: 0xdff4ff, color2: COLD, speed: [3, 12], life: [0.4, 1.0], size: [0.15, 0.5], radius: q.r * 0.7 }); }
    S.crackK = 2.5; yield 0.8; S.stalk = true;
  }
  function* charge(b) {
    const S = b.state; S.stalk = false; b.autoFace = false; yield* b.turnTo(b.angToPlayer(), 0.35);
    const dir = b.facing, sx = Math.sin(dir), cz = Math.cos(dir);
    // run until the far bank
    const bq = b.pos.x * sx + b.pos.z * cz, len = Math.max(8, -bq + Math.sqrt(Math.max(0, bq * bq - (b.pos.x * b.pos.x + b.pos.z * b.pos.z) + (R - 2.5) * (R - 2.5))));
    frostTele(S, Hz.rect(b.pos.x, b.pos.z, dir, len + 2, 4.4, 1.35, 360, { name: 'Wild Charge', kb: { dir: dir + PI / 2, dist: 3 } }), 2, b.pos.x, b.pos.z, dir, len + 2, 4.4);
    S.raise = 0.5; yield* b.cast({ name: 'Wild Charge', time: 1.35 }); S.raise = 0; Sound.sfx('dash', 1, 0.4); FX.shake(0.5);
    yield* b.moveTo(b.pos.x + sx * len, b.pos.z + cz * len, 46, { face: false });
    yield 0.7; b.autoFace = true; S.stalk = true;
  }
  function* stampede(b, waves = 2) {
    const S = b.state, a = rnd(0, TAU), sx = Math.sin(a), cz = Math.cos(a), W2 = 5.6, off = rnd(-1.5, 1.5); S.hornUp = 1;
    yield* b.cast({ name: 'The Wild Hunt', time: 1.0 }); S.hornUp = 0; Sound.sfx('roar', 0.7, 1.2);
    for (let w = 0; w < waves; w++) {
      let si = 0;
      for (let l = -4; l <= 4; l++) { if ((l + w) & 1) continue; const lx = cz * (l * W2 + off), lz = -sx * (l * W2 + off), x0 = lx - sx * (R + 4), z0 = lz - cz * (R + 4), st = S.stags[si++ % S.stags.length];
        frostTele(S, Hz.rect(x0, z0, a, 2 * R + 8, W2 - 0.2, 1.7, 300, { name: 'The Wild Hunt', color: TEL, quiet: true, onFire() { Sound.sfx('wave', 0.5, 1.4); if (Math.abs(l) < 3) { st.t = 0; st.x = x0; st.z = z0; st.a = a; } } }), 2, x0, z0, a, 2 * R + 8, W2 - 0.2); }
      yield 1.75;
    }
    yield 0.6;
  }
  const GRADE = [null, { tint: [0.9, 1.02, 1.12], bloom: 0.45, sat: 1.05, contrast: 1.1, vig: 0.95, lift: [0.003, 0.009, 0.012] }, { tint: [1.0, 0.97, 1.05], bloom: 0.5, sat: 1.0, vig: 1.12, contrast: 1.1, lift: [0.004, 0.007, 0.016] }];
  function setLvl(b, n) {
    const S = b.state; S.lvl = n; S.look = n; S.raise = 0; S.hornUp = 0; S.swing = 0; b.autoFace = true; S.stalk = true;
    S.ponds.forEach((q, i) => { q.rT = q.r0 * (n >= 1 ? (i === 4 ? 1.5 : 1.25) : 1); });
    S.blizz = n >= 2 ? 1 : 0; S.life = n >= 2 ? 9 : 14; S.hSpeed = n >= 2 ? 9.3 : n ? 8.9 : 8.6;
    if (GRADE[n]) Co.start(Post.lerpTo(GRADE[n], 1.5), 'fight');
  }

  G.bosses.push({
    id: 'winter', name: 'THE HUNTSMAN', title: 'The Long Night', hint: 'A pursuit', color: '#bfeaff', telegraph: 0x7fd8ff,
    hp: 27500, radius: 1.5, aimY: 3.4, enrage: 450,
    post: { bloom: 0.42, threshold: 1.05, radius: 0.65, exposure: 1.0, vig: 1.1, sat: 1.0, contrast: 1.08, tint: [0.92, 1.0, 1.12] },
    music: { bpm: 104, root: 38, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 3, 0, 0, 6, 4],
      layers: [
        { v: 'pad', pat: '0...............', len: 16, vol: 0.1 }, { v: 'bell', pat: ['0.....4...2.....', '7.....4...3.....'], oct: 2, len: 4, vol: 0.06 }, { v: 'taiko', pat: 'x.......x.....x.', vol: 0.24 },
        { v: 'bass', from: 1, pat: '0..0..0.0..0..3.', oct: -1, len: 1, vol: 0.12 }, { v: 'tom', from: 1, pat: '..x...x...x..xx.', vol: 0.16 }, { v: 'flute', from: 1, pat: ['0...2.3...5.3.2.', '7...5.3...2.3.0.'], oct: 1, len: 3, vol: 0.07 },
        { v: 'brass', from: 2, pat: ['0.......4.......', '5.......3...4...'], oct: 0, len: 7, vol: 0.12 }, { v: 'taiko', from: 2, pat: 'x.xx..x.x.xx..xx', vol: 0.22 }, { v: 'choir', from: 2, pat: '0.......2.......', oct: 1, len: 8, vol: 0.07 },
      ] },
    build,
    *intro(b) { Sound.sfx('roar', 0.6, 0.5); yield* Cam.shot([9, 1.2, 8], [0, 4.5, -9], [3.5, 3.2, -1], [0, 4.6, -9], 5.0, 46); },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setLvl(b, 0); yield 1.2;
        while (true) {
          yield* javelin(b, 1); yield* sweep(b); yield* hounds(b, 2); yield* javelin(b, 1); yield* hoarfrost(b);
          yield* sweep(b); yield* icebreaker(b); yield* hounds(b, 2); yield* javelin(b, 2); yield* hoarfrost(b); yield* sweep(b); yield 0.8;
        }
      } },
      { at: 0.67, *enter(b) {
        const S = b.state; S.stalk = false; S.hornUp = 1; b.autoFace = true;
        yield* b.cast({ name: 'Deep Cold', time: 3.0, onTick: (k) => { FX.shake(k * 0.3); } });
        S.hornUp = 0; Sound.sfx('shatter', 1, 0.3); Sound.sfx('bigboom', 0.7); FX.flash(COLD, 0.35, 1.2);
        S.ponds.forEach((q, i) => { q.rT = q.r0 * (i === 4 ? 1.5 : 1.25); }); S.look = 1; S.crackK = 3;
        Co.start(Post.lerpTo(GRADE[1], 3), 'fight'); yield 1.6;
      }, *run(b) {
        const S = b.state; setLvl(b, 1);
        while (true) {
          yield* hounds(b, 3); yield* charge(b); yield* stampede(b, 2); yield* hoarfrost(b); yield* javelin(b, 2);
          yield* icebreaker(b); yield* sweep(b); yield* hounds(b, 2); yield* charge(b); yield* hoarfrost(b); yield* stampede(b, 3); yield* sweep(b);
        }
      } },
      { at: 0.34, *enter(b) {
        const S = b.state; S.stalk = false; S.hornUp = 1; b.autoFace = true;
        yield* b.cast({ name: 'Whiteout', time: 3.0, onTick: (k) => { S.blizz = k; } });
        S.hornUp = 0; Sound.sfx('roar', 1, 0.5); Sound.sfx('wave', 1, 0.5); FX.flash(0xffffff, 0.5, 1.4); S.look = 2;
        Co.start(Post.lerpTo(GRADE[2], 3), 'fight'); yield 1.4;
      }, *run(b) {
        const S = b.state; setLvl(b, 2);
        while (true) {
          yield* howl(b); yield* hounds(b, 3); yield* charge(b); yield* hoarfrost(b); yield* stampede(b, 3);
          yield* javelin(b, 3); yield* icebreaker(b); yield* sweep(b); yield* charge(b); yield* hounds(b, 2); yield* hoarfrost(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight' && p && p.alive;
      for (const q of S.ponds) { q.r = damp(q.r, q.rT, 1.2, dt); q.m.scale.setScalar(q.r); q.rim.scale.setScalar(q.r); }
      S.blizzK = damp(S.blizzK, S.blizz, 0.9, dt); if (S.rage > 0) S.rage -= dt;
      S.windT -= dt; if (S.windT <= 0) { S.windT = 9; S.windGoal = rnd(0, TAU); } S.windA = dampAng(S.windA, S.windGoal || 0, 0.7, dt);
      if (fight) {
        const ice = !!iceAt(S, p.pos.x, p.pos.z), ix = p.intentX || 0, iz = p.intentZ || 0, free = !p.dash && !p.kb;
        S.ice = ice;
        if (ice) {
          // no grip: you keep what speed you had
          if (free) { const k = p.moving ? 1.25 : 0.5; S.vx = damp(S.vx, ix * SPEED, k, dt); S.vz = damp(S.vz, iz * SPEED, k, dt); p.push.x += S.vx - ix * SPEED * p.speedMul; p.push.z += S.vz - iz * SPEED * p.speedMul; }
          else if (p.dash) { const d = Math.hypot(p.dash.vx, p.dash.vz) || 1; S.vx = p.dash.vx / d * 8; S.vz = p.dash.vz / d * 8; }
          S.brk = true;
          if (!G.headless && p.grounded && Math.hypot(S.vx, S.vz) > 3 && vrand() < dt * 30) FX.burst(p.pos.x, 0.1, p.pos.z, { n: 1, color: 0xdff4ff, speed: [0.5, 2], life: [0.2, 0.5], size: [0.08, 0.2] });
        } else { S.vx = ix * SPEED; S.vz = iz * SPEED; }
        if (S.blizzK > 0.05) { const wv = S.blizzK * (ice ? 2.4 : 1.3); if (p.grounded) { p.push.x += Math.sin(S.windA) * wv; p.push.z += Math.cos(S.windA) * wv; } }
        // footprints
        if (p.grounded && !ice) {
          const d = Math.hypot(p.pos.x - S.lastX, p.pos.z - S.lastZ);
          if (d > STEP) {
            const a = d < 50 ? Math.atan2(p.pos.x - S.lastX, p.pos.z - S.lastZ) : p.facing; S.foot = -S.foot;
            S.trail.push({ id: S.nid++, x: p.pos.x, z: p.pos.z, t, a, f: S.foot, gap: S.brk }); S.brk = false; S.lastX = p.pos.x; S.lastZ = p.pos.z; if (S.trail.length > S.NP) S.trail.shift();
          } else if (S.trail.length) S.trail[S.trail.length - 1].t = t;
        }
        // the Huntsman never runs. He does not need to.
        if (S.stalk && !b.castState && !b.transitioning) { const d = b.distToPlayer(); if (d > 4.6) { const a = b.angToPlayer(), s = (S.lvl >= 2 ? 3.0 : 2.3) * dt; b.pos.x += Math.sin(a) * s; b.pos.z += Math.cos(a) * s; const r = Math.hypot(b.pos.x, b.pos.z); if (r > R - 3) { b.pos.x *= (R - 3) / r; b.pos.z *= (R - 3) / r; } S.walk = (S.walk || 0) + dt * 5; } }
      }
      while (S.trail.length && t - S.trail[0].t > S.life) S.trail.shift();
      for (let i = S.spikes.length - 1; i >= 0; i--) { const s = S.spikes[i]; s.t += dt; if (s.t > s.life) S.spikes.splice(i, 1); }
      // ---- cosmetics ----
      if (G.headless) return;
      const I = S.printI; let n = 0; const lo = S.hounds.length ? Math.min(...S.hounds.map((h) => h.last)) : 1e9, hi = S.hounds.length ? Math.max(...S.hounds.map((h) => h.last)) + 7 : -1;
      for (const q of S.trail) {
        const age = (t - q.t) / S.life, k = 1 - smooth(clamp((age - 0.75) / 0.25, 0, 1));
        _m.position.set(q.x + Math.cos(q.a) * 0.17 * q.f, 0.025, q.z - Math.sin(q.a) * 0.17 * q.f); _m.rotation.set(-PI / 2, 0, q.a, 'YXZ'); _m.scale.set(0.15 * k + 0.01, 0.27 * k + 0.01, 1); _m.updateMatrix(); I.setMatrixAt(n, _m.matrix);
        const hot = q.id > lo && q.id <= hi; if (hot) _c.setHex(SCENT).multiplyScalar(1.6 + Math.sin(t * 10 + q.id) * 0.5); else _c.setHex(0x5a7096); I.setColorAt(n, _c); n++;
      }
      I.count = n; I.instanceMatrix.needsUpdate = true; if (I.instanceColor) I.instanceColor.needsUpdate = true;
      const K = S.spikeI; n = 0;
      for (const s of S.spikes) { if (n >= 233) break; const up = smooth(clamp(s.t / 0.18, 0, 1)) * (1 - smooth(clamp((s.t - s.life + 0.6) / 0.6, 0, 1))); for (let j = 0; j < 2; j++) { _m.position.set(s.x + (j ? Math.sin(s.rot) * 0.5 : 0), 1.3 * up * (j ? 0.6 : 1) - 0.05, s.z + (j ? Math.cos(s.rot) * 0.5 : 0)); _m.rotation.set(j ? 0.3 : 0.08 * Math.sin(s.rot), s.rot, j ? -0.25 : 0); _m.scale.set(j ? 0.7 : 1, Math.max(0.01, up) * (j ? 0.6 : 1), j ? 0.7 : 1); _m.updateMatrix(); K.setMatrixAt(n++, _m.matrix); }
        for (let j = 0; j < 5; j++) { const an = s.rot * 1.7 + j * 1.26 + hsh(s.rot, j, 1) * 0.6, r = 1.15 + hsh(j, s.rot, 2) * 0.25, sc = 0.16 + hsh(s.rot, j, 3) * 0.14; _m.position.set(s.x + Math.sin(an) * r, 0.18 * up * sc * 5 - 0.05, s.z + Math.cos(an) * r); _m.rotation.set(Math.cos(an) * 0.6, an, -Math.sin(an) * 0.6); _m.scale.set(sc, Math.max(0.01, up) * sc, sc); _m.updateMatrix(); K.setMatrixAt(n++, _m.matrix); } }
      K.count = n; K.instanceMatrix.needsUpdate = true;
      for (const st of S.stags) { if (st.t < 0) { st.m.g.visible = false; continue; } st.t += dt; const d = st.t * 66; if (d > 2 * R + 12) { st.t = -1; continue; } st.m.g.visible = true; st.m.g.position.set(st.x + Math.sin(st.a) * d, 0, st.z + Math.cos(st.a) * d); st.m.g.rotation.y = st.a; st.m.legs.forEach((h, i) => { h.rotation.x = Math.sin(t * 22 + (i % 2 ? PI : 0) + (i > 1 ? 1 : 0)) * 1.0; }); for (let k = 0; k < 2; k++) emit(S, st.m.g.position.x + (vrand() - 0.5) * 0.8, 0.3 + vrand() * 0.8, st.m.g.position.z + (vrand() - 0.5) * 0.8, (vrand() - 0.5) * 1.5, 0.6 + vrand(), (vrand() - 0.5) * 1.5, 0.6 + vrand() * 0.5, 0.35 + vrand() * 0.3); }
      for (const j of S.javs) { if (j.t < 0) continue; j.t += dt; const k = j.t / j.dur; if (k >= 1) { j.t = -1; j.g.visible = false; continue; } _v.lerpVectors(j.a, j.b, k); _v.y += Math.sin(k * PI) * 5; _w.lerpVectors(j.a, j.b, Math.min(1, k + 0.02)); _w.y += Math.sin(Math.min(1, k + 0.02) * PI) * 5; j.g.position.copy(_v); j.g.lookAt(_w); }
      // the night turns: aurora swell, then a blood moon
      const wx0 = Math.sin(S.windA), wz0 = Math.cos(S.windA), P = S.pal[S.look] || S.pal[0], kk = 1 - Math.exp(-dt * 1.1), SU = S.SU;
      SU.uAurA.value.lerp(P.aurA, kk); SU.uAurB.value.lerp(P.aurB, kk); SU.uMoonCol.value.lerp(P.moon, kk); SU.uHorGlow.value.lerp(P.hg, kk); SU.uTop.value.lerp(P.top, kk); SU.uHor.value.lerp(P.hor, kk);
      MRIM.lerp(P.mrim, kk); SU.uHaze.value.copy(S.fog.color); S.snowT.value = t; S.ribU.uTime.value = t; S.ribU.uW.value.set(wx0, wz0); S.ribU.uAmt.value = damp(S.ribU.uAmt.value, S.look >= 1 ? 0.45 + S.blizzK * 0.1 : 0, 1, dt);
      SU.uAur.value = damp(SU.uAur.value, P.aur * (S.rage > 0 ? 1.3 : 1), 1.1, dt); S.hemi.color.lerp(P.hemi, kk); S.hemi.intensity = damp(S.hemi.intensity, P.hemiI, 1.1, dt); SU.uAurH.value = damp(SU.uAurH.value, P.aurH, 1.1, dt); SU.uAurGap.value = damp(SU.uAurGap.value, P.gap || 0, 1.1, dt); SU.uMoonEdge.value = damp(SU.uMoonEdge.value, P.medge, 1.1, dt); S.treeRim.value.lerp(P.rim, kk);
      S.crackK = Math.max(0, (S.crackK || 0) - dt); S.iceU.uCrackCol.value.lerp(_c.setHex(S.look ? 0x30c8ff : 0xbfe4ff), kk); S.iceU.uCrack.value = damp(S.iceU.uCrack.value, Math.min(1.6, P.crack + S.crackK * (S.look ? 0.4 : 0)), 2, dt);
      const bz = S.blizzK, wx = Math.sin(S.windA), wz = Math.cos(S.windA);
      const SN = S.snow.material.uniforms; SN.uVel.value.set(0.5 + wx * bz * 9, -2.4 - bz * 2, 0.2 + wz * bz * 9); if (SN.uAlpha) SN.uAlpha.value = 0.75 - bz * 0.25;
      S.drift.uVel.value.set(wx * 13, 0, wz * 13); S.drift.uAmt.value = damp(S.drift.uAmt.value, S.look >= 1 ? 0.35 + bz * 0.25 : 0, 1, dt);
      S.storm.uVel.value.set(wx * 26, -9, wz * 26); S.storm.uAmt.value = bz * 0.55;
      S.fog.density = 0.011 + bz * 0.007; S.fog.color.setHex(0x0c1826).lerp(_c.setHex(0x182232), bz);
      S.pBlob.position.set(p.pos.x, 0.048, p.pos.z); S.pBlob.visible = !!p.grounded;
      const cast = b.castState ? 1 : 0; S.raiseK = damp(S.raiseK || 0, S.raise, 7, dt); S.hornK = damp(S.hornK || 0, S.hornUp, 6, dt); S.swing = Math.max(0, (S.swing || 0) - dt * 2.5);
      S.rig.position.y = Math.abs(Math.sin(S.walk || 0)) * 0.08; S.rig.rotation.z = Math.sin(S.walk || 0) * 0.025; S.head.rotation.y = Math.sin(t * 0.6) * 0.15; S.head.rotation.x = -S.hornK * 0.5;
      S.armR.rotation.x = -S.raiseK * 2.3 + S.swing * 1.7; S.armR.rotation.z = S.raiseK * 0.3 - S.swing * 0.9; S.armL.rotation.x = -S.hornK * 2.4; S.armL.rotation.z = -S.hornK * 0.5;
      S.antK = damp(S.antK, P.ant, 1.2, dt); for (const a of S.ants) a.scale.setScalar(S.antK);
      S.antTipM.color.setHex(S.look >= 2 ? 0xffb0a0 : COLD).multiplyScalar(2.2 + S.look * 0.9 + Math.sin(t * 3) * 0.3);
      { const pr = S.look >= 1 ? 120 + S.look * 30 : 0; for (let k = Math.floor(pr * dt + vrand()); k > 0; k--) { const an = S.ants[vrand() < 0.5 ? 0 : 1].userData.crown; an.getWorldPosition(_v); emit(S, _v.x + (vrand() - 0.5) * 0.4, _v.y + (vrand() - 0.5) * 0.4, _v.z + (vrand() - 0.5) * 0.4, wx0 * (2.2 + vrand() * 1.6) + (vrand() - 0.5) * 0.5, 0.2 + vrand() * 0.4, wz0 * (2.2 + vrand() * 1.6) + (vrand() - 0.5) * 0.5, 1.4 + vrand() * 0.9, 0.08 + vrand() * 0.07); }
        if (S.look >= 2) for (let k = Math.floor(50 * dt + vrand()); k > 0; k--) { const an = vrand() * TAU, hy = 0.6 + vrand() * 4.2, rr = 0.75 + hy * 0.12; emit(S, b.pos.x + Math.sin(an) * rr, hy, b.pos.z + Math.cos(an) * rr, wx0 * (4 + vrand() * 3), 0.1, wz0 * (4 + vrand() * 3), 0.9 + vrand() * 0.6, 0.12 + vrand() * 0.12); }
        if (S.howl) { S.horn.getWorldPosition(_v); const fx = Math.sin(b.facing), fz = Math.cos(b.facing); for (let k = Math.floor(70 * dt + vrand()); k > 0; k--) emit(S, _v.x, _v.y, _v.z, fx * (3 + vrand() * 2) + (vrand() - 0.5), 1.2 + vrand(), fz * (3 + vrand() * 2) + (vrand() - 0.5), 1.0 + vrand() * 0.6, 0.25 + vrand() * 0.2); }
        const q = S.pl, dr = Math.exp(-dt * 0.7); for (let k = 0; k < q.n; k++) { if (q.age[k] >= q.life[k]) { q.A[k] = 0; continue; } q.age[k] += dt; const j = k * 3; q.P[j] += q.v[j] * dt; q.P[j + 1] += q.v[j + 1] * dt; q.P[j + 2] += q.v[j + 2] * dt; q.v[j] *= dr; q.v[j + 2] *= dr; const u = q.age[k] / q.life[k]; q.A[k] = Math.sin(Math.min(1, u) * PI) * 0.75 * (q.sz[k] < 0.16 ? 0.5 * (1 - u) : 1); q.Z[k] = q.sz[k] * (1 + u * 1.5); }
        q.geo.attributes.position.needsUpdate = q.geo.attributes.aA.needsUpdate = q.geo.attributes.aS.needsUpdate = true; }
      for (const h of S.hr) { if (h.t < -1) continue; h.t += dt; if (h.t < 0) continue; const k = h.t / 1.1, r = 1.5 + 17 * smooth(Math.min(1, k) * 0.9 + 0.1 * Math.min(1, k)); if (k >= 1) { h.t = -9; h.m.scale.setScalar(0.01); h.U.uA.value = 0; continue; }
        h.m.position.set(h.x, 0.07, h.z); h.m.scale.setScalar(r); h.U.uR.value = r; h.U.uA.value = 1 - smooth((k - 0.55) / 0.45);
        if (vrand() < dt * 40) { const an = vrand() * TAU; FX.burst(h.x + Math.sin(an) * r, 0.15, h.z + Math.cos(an) * r, { n: 3, color: 0xf2f8ff, speed: [1, 3], up: 1.5, life: [0.3, 0.6], size: [0.15, 0.35], flat: true }); } }
      for (let i = S.tf.length - 1; i >= 0; i--) { const e = S.tf[i], u = e.m.material.uniforms; e.t += dt; const k = e.t / e.dur;
        if (!e.done && k >= 1) { e.done = true; powder(e); }
        u.uK.value = Math.min(1, k); u.uA.value = k < 1 ? smooth(k * 4) : 1 - smooth((e.t - e.dur) / 0.35);
        if (e.t > e.dur + 0.35) { u.uP.value.set(0, 0, 0); e.m.scale.setScalar(0.01); S.tfPool.push(e.m); S.tf.splice(i, 1); } }
      S.tipM.color.setHex(COLD).multiplyScalar(2.6 + cast * (2 + Math.sin(t * 14))); S.eyeM.color.setHex(S.rage > 0 || S.lvl >= 2 ? 0xff6050 : COLD).multiplyScalar(4); S.light.intensity = 6 + cast * 8;
      S.fireM.color.setHex(S.look >= 2 ? 0xff5060 : S.look ? 0xa080ff : COLD).multiplyScalar(2.6 + Math.sin(t * 7) * 0.6); S.runeC.copy(S.fireM.color).multiplyScalar(0.3); S.haloM.color.copy(S.fireM.color).multiplyScalar(0.18);
    },
    danger(b, x, z) { for (const h of b.state.hounds) if (h.alive && !(h.pause > 0) && Math.hypot(x - h.pos.x, z - h.pos.z) < 1.6) return 0.5; return Infinity; },
    bot(b, p) {
      const S = b.state; let best = null, bd = 6.5;
      for (const h of S.hounds) { if (!h.alive) continue; const d = Math.hypot(h.pos.x - p.pos.x, h.pos.z - p.pos.z); if (d < bd) { bd = d; best = h; } }
      return { target: best || b, avoid: (x, z) => !!iceAt(S, x, z) };
    },
  });
})();
