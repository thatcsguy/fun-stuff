// DOOR III: ISSEN, the Last Petal. One swordsman on a lake at dusk. Fast, precise, and he remembers every cut.
(() => {
  const R = 15, ROSE = 0xff4a6a, PALE = 0xffd8e0;
  const edgeLen = (x, z, a) => { let d = 0; while (d < 40) { const nx = x + Math.sin(a) * (d + 0.5), nz = z + Math.cos(a) * (d + 0.5); if (nx * nx + nz * nz > 14.2 * 14.2) break; d += 0.5; } return d; };

  // ---------------------------------------------------------------- local look helpers (cosmetic only)
  const GN = `float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
    float fb(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*n2(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
    float eFar(vec2 d){ return 0.012+0.2*pow(clamp(fb(d*2.0+vec2(3.1,1.7)),0.0,1.0),2.2); }
    float eNear(vec2 d){ return 0.004+0.11*pow(clamp(fb(d*4.0+vec2(7.3,2.9)),0.0,1.0),2.6); }`;
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
        float ink=smoothstep(edge-0.2,edge-0.04,v);
        float streak=step(0.6,n2(vec2(u*6.0+uSeed,vUv.y*26.0)))*0.28*(1.0-ink);
        float line=exp(-v*v*500.0);
        float tip=1.0-smoothstep(0.0,0.03,head-u);
        vec3 col=mix(uCol,vec3(0.06,0.0,0.03),ink)+uHot*line;
        float a=max(max(ink*0.7,streak),max(line*0.9,tip*0.5))*(1.0-fade);
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

  function build(b) {
    const g = G.world, S = b.state;
    const sunDir = [-0.28, 0.13, -0.95];
    const sky = W.sky({ top: 0x26306e, horizon: 0xff9a6a, bottom: 0x3a2030, exp: 0.42, clouds: 0.5, cloudColor: 0xffb8a0, cloudDark: 0x70507a, cloudScale: 0.9, cloudSpeed: 0.006, sunDir, sunColor: 0xffd0a0, sunSize: 0.12, sunGlow: 1.05, stars: 0 }); g.add(sky); S.sky = sky; W.env(sky, 0.55);
    scene.fog = new THREE.FogExp2(0xc88a88, 0.004);
    S.hemi = W.hemi(g, 0x9a9ad8, 0x5a4038, 0.95);
    S.sun = W.sun(g, { dir: [-0.3, 0.32, -0.9], color: 0xffc090, intensity: 2.6, size: 22 });
    S.fill = new THREE.DirectionalLight(0x9a90e8, 0.55); S.fill.position.set(18, 30, 40); g.add(S.fill);
    // ---- shared environment uniforms (lake, mountains, mist) ----
    const EU = S.EU = { uTime: { value: 0 }, uTop: { value: new THREE.Color(0x3a3c78) }, uHor: { value: new THREE.Color(0xf09070) }, uSunDir: { value: new V3(...sunDir).normalize() }, uSunCol: { value: new THREE.Color(0xffc890) },
      uFogC: { value: new THREE.Color(0xd8907c) }, uMtnF: { value: new THREE.Color(0x6a5688) }, uMtnN: { value: new THREE.Color(0x2e2238) }, uDeep: { value: new THREE.Color(0x1a1426) }, uPet: { value: new THREE.Color(0xf0a0b4) }, uMist: { value: new THREE.Color(0xf0b0a0) }, uGlowK: { value: 1.0 }, uStreak: { value: 0.0 } };
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1).rotateX(-PI / 2), new THREE.ShaderMaterial({ uniforms: EU, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }',
      fragmentShader: `uniform float uTime,uGlowK,uStreak; uniform vec3 uTop,uHor,uSunDir,uSunCol,uFogC,uMtnF,uMtnN,uDeep,uPet; varying vec3 vW;
        ${GN}
        vec3 skyCol(vec3 r){ float h=clamp(r.y,0.0,1.0); vec3 c=mix(uHor,uTop,pow(h,0.42)); float sd=max(dot(r,uSunDir),0.0); c+=uSunCol*uGlowK*(pow(sd,180.0)*1.2+pow(sd,14.0)*0.3); return c; }
        void main(){
          vec3 toC=cameraPosition-vW; float dist=length(toC); vec3 v=toC/max(dist,1e-3);
          vec2 q=vW.xz; float t=uTime; float att=1.0/(1.0+dist*0.02);
          float e=0.35; vec2 o1=vec2(t*0.22,t*0.1), o2=vec2(-t*0.27,t*0.18);
          float a0=n2(q*0.55+o1)+0.5*n2(q*1.6+o2);
          float ax=n2((q+vec2(e,0.0))*0.55+o1)+0.5*n2((q+vec2(e,0.0))*1.6+o2);
          float az=n2((q+vec2(0.0,e))*0.55+o1)+0.5*n2((q+vec2(0.0,e))*1.6+o2);
          vec2 gr=vec2(a0-ax,a0-az)*0.45*att;
          vec2 cq=q/6.0; vec2 ci=floor(cq); vec2 cf=fract(cq)-0.5; float hh=h21(ci+3.7); vec2 cc=vec2(h21(ci+1.3),h21(ci+8.1))-0.5; vec2 dv=cf-cc*0.6;
          float dd=length(dv)*6.0; float ph=fract(t*0.16+hh); float rr=ph*2.6; float ring=exp(-pow((dd-rr)*4.0,2.0))*(1.0-ph)*step(0.4,hh);
          gr+=dv/max(length(dv),1e-3)*ring*0.3*att*cos((dd-rr)*12.0);
          vec3 n=normalize(vec3(gr.x,1.0,gr.y));
          vec3 r=reflect(-v,n); r.y=abs(r.y)+1e-3; r=normalize(r);
          float lxz=max(length(r.xz),1e-3); vec2 rd=r.xz/lxz; float el=r.y/lxz;
          vec3 refl=skyCol(r);
          float ef=eFar(rd), en=eNear(rd);
          if(el<ef) refl=mix(uHor,uMtnF,0.5+0.3*clamp(el/max(ef,1e-3),0.0,1.0));
          if(el<en) refl=mix(uHor,uMtnN,0.72+0.2*clamp(el/max(en,1e-3),0.0,1.0));
          float sd=max(dot(r,uSunDir),0.0); refl+=uSunCol*(min(pow(sd,600.0)*2.2,2.2)+pow(sd,70.0)*uStreak);
          float fr=0.04+0.96*pow(clamp(1.0-max(dot(n,v),0.0),0.0,1.0),5.0);
          vec3 col=mix(uDeep,refl,fr);
          vec2 pq=q*1.3+vec2(t*0.05,t*0.03); vec2 pi=floor(pq); vec2 pf=fract(pq)-0.5-(vec2(h21(pi+2.0),h21(pi+5.0))-0.5)*0.6;
          float pd=length(pf*vec2(1.0,1.6)); float pk=step(0.91,h21(pi))*(1.0-smoothstep(0.06,0.1,pd))*(1.0-smoothstep(25.0,50.0,dist));
          col=mix(col,uPet,pk*0.8);
          col+=ring*0.06*uHor*att;
          col*=mix(0.45,1.0,smoothstep(15.2,19.0,length(q)))*mix(0.8,1.0,smoothstep(18.0,40.0,length(q)));
          col=mix(col,uFogC,clamp(1.0-exp(-dist*0.0016),0.0,1.0));
          gl_FragColor=vec4(max(col,vec3(0.0)),1.0);
        }` }));
    lake.position.y = -0.3; lake.receiveShadow = false; lake.onBeforeRender = () => { EU.uTime.value = G.now; }; g.add(lake);
    // distant mountain silhouettes (the lake reflects the same profile)
    for (const [rad, hgt, layer] of [[900, 200, 0], [750, 120, 2], [600, 75, 1]]) {
      const mm = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, hgt, 180, 1, true), new THREE.ShaderMaterial({ uniforms: Object.assign({ uLayer: { value: layer }, uR: { value: rad } }, EU), side: THREE.DoubleSide, fog: false,
        vertexShader: 'varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }',
        fragmentShader: `uniform vec3 uHor,uMtnF,uMtnN,uSunDir,uSunCol,uFogC; uniform float uLayer,uR; varying vec3 vW;
          ${GN}
          void main(){ vec2 d=vW.xz/max(length(vW.xz),1e-3); float el=(vW.y+0.3)/uR; float e=uLayer>1.5?(0.008+0.13*pow(clamp(fb(d*3.0+vec2(11.0,5.0)),0.0,1.0),2.4)):(uLayer>0.5?eNear(d):eFar(d)); if(el>e) discard;
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
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.3, R + 0.15, 0.6, 72), new THREE.MeshStandardMaterial({ map: deckT.map, normalMap: deckT.normalMap, roughnessMap: deckT.roughnessMap, roughness: 1, metalness: 0, envMapIntensity: 0.3 })); stage.position.y = -0.3; stage.receiveShadow = true; g.add(stage);
    const paint = new THREE.MeshStandardMaterial({ color: 0xe8dccb, roughness: 0.7, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const [a0, a1] of [[6.75, 7.05], [7.35, 7.45], [2.0, 2.12]]) { const pr = new THREE.Mesh(new THREE.RingGeometry(a0, a1, 128), paint); pr.rotation.x = -PI / 2; pr.position.y = 0.011; g.add(pr); }
    const crimP = new THREE.MeshStandardMaterial({ color: 0x9a1a28, roughness: 0.7, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let i = 0; i < 0; i++) { const a = i / 8 * TAU; const tk = new THREE.Mesh(new THREE.RingGeometry(7.6, 8.4, 6, 1, a - 0.035, 0.07), crimP); tk.rotation.x = -PI / 2; tk.position.y = 0.011; g.add(tk); }
    const slT = W.surface('slabs', { n: 4, dark: 0x3a3634, light: 0x8a8278, strength: 2.5, size: 256 }); for (const k in slT) slT[k].repeat.set(24, 1);
    const band = new THREE.Mesh(new THREE.RingGeometry(R - 1.1, R + 0.3, 120, 1), new THREE.MeshStandardMaterial({ map: slT.map, normalMap: slT.normalMap, roughnessMap: slT.roughnessMap, roughness: 1, envMapIntensity: 0.4 }));
    { const P = band.geometry.attributes.position, UV = band.geometry.attributes.uv; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); UV.setXY(i, (Math.atan2(y, x) / TAU + 0.5), (Math.hypot(x, y) - (R - 1.1)) / 1.4); } }
    band.rotation.x = -PI / 2; band.position.y = 0.006; band.receiveShadow = true; g.add(band);
    { const pr = mulberry(55), L = []; for (let i = 0; i < 700; i++) { const a = pr() * TAU, rim = pr() < 0.45, d = rim ? R - 0.15 - Math.pow(pr(), 2.5) * 2.2 : Math.sqrt(pr()) * (R - 0.4); const sz = (rim ? 0.05 : 0.04) + pr() * pr() * 0.11; L.push([Math.sin(a) * d, 0.014, Math.cos(a) * d, 0, sz, sz * (0.6 + pr() * 0.3), 1, -PI / 2, pr() * TAU]); }
      const fpm = 0; const fp = inst(g, new THREE.CircleGeometry(1, 6), new THREE.MeshStandardMaterial({ color: 0xffd0dc, roughness: 0.8, emissive: 0xff8aa8, emissiveIntensity: 0.08, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 }), L); { const c = new THREE.Color(); for (let i = 0; i < L.length; i++) { const w = pr(); c.setRGB(1, lerp(0.62, 1, w), lerp(0.7, 1, w)).multiplyScalar(0.75 + pr() * 0.25); fp.setColorAt(i, c); } } S.fallen = fp.material; }
    S.poolMat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0xffa850).multiplyScalar(0.35) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vU; void main(){ vU=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; varying vec2 vU; void main(){ float d=clamp(1.0-length(vU),0.0,1.0); gl_FragColor=vec4(uC*d*d,1.0); }' });
    { const L = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.39; L.push([Math.sin(a) * (R + 0.4), 0.02, Math.cos(a) * (R + 0.4), 0, 7, 7, 1, -PI / 2]); } inst(g, new THREE.PlaneGeometry(1, 1), S.poolMat, L).renderOrder = 3; }
    const inl = new THREE.Mesh(new THREE.RingGeometry(6.88, 6.9, 8), W.mat({ color: 0x0e0806, roughness: 0.7 })); inl.visible = false; inl.rotation.x = -PI / 2; inl.position.y = 0.012; g.add(inl);
    // shimenawa: twisted straw rope round the edge with paper shide
    const ropeT = W.bake(128, (u, v) => { const s = 0.5 + 0.5 * Math.sin(TAU * (3 * u + v)), f = 0.5 + 0.5 * Math.sin(TAU * (24 * u + 8 * v)), n = W.fbm(u * 8, v * 8, 4, 3, 8); return [s * 0.6 + f * 0.25 + n * 0.15, 0.45 + s * 0.3 + f * 0.1 + n * 0.15, 0.9]; }, { dark: 0x5a4220, light: 0xd0b884, strength: 2.2 });
    for (const k in ropeT) ropeT[k].repeat.set(260, 1);
    S.rope = new THREE.MeshStandardMaterial({ map: ropeT.map, normalMap: ropeT.normalMap, roughness: 0.95, emissive: 0xff2040, emissiveIntensity: 0 });
    const rope = new THREE.Mesh(new THREE.TorusGeometry(R + 0.3, 0.13, 10, 240), S.rope); rope.rotation.x = PI / 2; rope.position.y = 0.06; rope.castShadow = true; g.add(rope);
    const shG = new THREE.PlaneGeometry(0.16, 0.56, 1, 4); { const P = shG.attributes.position; for (let i = 0; i < P.count; i++) { const row = Math.round((0.28 - P.getY(i)) / 0.14); P.setX(i, P.getX(i) + (row % 2 ? 0.06 : -0.02)); } shG.computeVertexNormals(); }
    const shL = []; for (let i = 0; i < 44; i++) { const a = i / 44 * TAU + 0.07; shL.push([Math.sin(a) * (R + 0.5), -0.22, Math.cos(a) * (R + 0.5), a + PI / 2, 1, 1, 1, 0.12]); }
    inst(g, shG, new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.8, side: THREE.DoubleSide, emissive: 0xffe8e0, emissiveIntensity: 0.12 }), shL);
    // stone tōrō lanterns on rock footings
    const stone = W.mat({ color: 0x6e6862, roughness: 0.92, flatShading: true }), rockM = W.mat({ color: 0x3a3230, roughness: 1 }); S.lampMat = W.glow(0xffc070, 2.6);
    const L8 = [...Array(8)].map((_, i) => { const a = i / 8 * TAU + 0.39; return [Math.sin(a) * (R + 1.8), Math.cos(a) * (R + 1.8), a]; });
    const lp = (y, sx, sy, sz, ry = 0) => L8.map(([x, z, a]) => [x, y, z, a + ry, sx, sy, sz]);
    inst(g, new THREE.DodecahedronGeometry(0.8, 0), rockM, lp(-0.4, 1.2, 0.55, 1.1, 0.5));
    inst(g, new THREE.CylinderGeometry(0.42, 0.52, 0.26, 6), stone, lp(0.12, 1, 1, 1), true);
    inst(g, new THREE.CylinderGeometry(0.13, 0.17, 1.3, 6), stone, lp(0.9, 1, 1, 1), true);
    inst(g, new THREE.CylinderGeometry(0.44, 0.36, 0.16, 6), stone, lp(1.62, 1, 1, 1), true);
    inst(g, new THREE.BoxGeometry(0.4, 0.4, 0.4), S.lampMat, lp(1.9, 1, 1, 1, PI / 4));
    inst(g, new THREE.BoxGeometry(0.08, 0.44, 0.08), stone, L8.flatMap(([x, z, a]) => [0, 1, 2, 3].map((k) => { const q = a + k * PI / 2 + PI / 4; return [x + Math.sin(q) * 0.27, 1.9, z + Math.cos(q) * 0.27, q]; })));
    inst(g, new THREE.LatheGeometry([[0.78, -0.16], [0.7, -0.1], [0.45, 0.02], [0.22, 0.14], [0.08, 0.24], [0.0, 0.26]].map(([x, y]) => new THREE.Vector2(x, y)), 6), stone, lp(2.26, 1, 1, 1, PI / 6), true);
    inst(g, new THREE.LatheGeometry([[0.0, -0.17], [0.78, -0.17], [0.78, -0.15]].map(([x, y]) => new THREE.Vector2(x, y)), 6), W.mat({ color: 0x2a2624, roughness: 1, side: THREE.DoubleSide }), lp(2.26, 1, 1, 1, PI / 6));
    inst(g, new THREE.SphereGeometry(0.1, 8, 6), stone, lp(2.56, 1, 1.3, 1));
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
    S.blossom = new THREE.MeshStandardMaterial({ map: blossomTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, emissive: 0xff90b0, emissiveIntensity: 0.22 }); S.blossom.emissiveMap = S.blossom.map;
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
      const isle = new THREE.Mesh(new THREE.DodecahedronGeometry(5 * sc, 1), W.mat({ color: 0x2e3624, roughness: 1, flatShading: true })); isle.scale.set(1, 0.16, 1); isle.position.set(tx, -0.55, tz); g.add(isle);
    };
    tree(-21, -31, 1.35, 4); tree(23, -28, 1.1, 9); tree(-35, 5, 1.0, 14); tree(34, 15, 0.95, 21);
    const bark = new THREE.Mesh(mergeGeos(barkGeos), barkM); bark.castShadow = true; bark.userData.fadeOcclude = true; g.add(bark);
    // drifting petals: rotating petal sprites, not glowing dots
    { const n = Math.round(800 * G.q.part), box = [64, 18, 64], pos = new Float32Array(n * 3), sd = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos[i * 3] = vrand() * box[0]; pos[i * 3 + 1] = vrand() * box[1]; pos[i * 3 + 2] = vrand() * box[2]; sd[i] = vrand(); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
      const PU = { uTime: { value: 0 }, uScale: { value: 500 }, uBox: { value: new V3(...box) }, uVel: { value: new V3(0.8, -0.7, 0.35) }, uA: { value: new THREE.Color(1.0, 0.62, 0.72) }, uB: { value: new THREE.Color(1.0, 0.9, 0.92) }, uAlpha: { value: 0.9 } };
      S.petals = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: PU, transparent: true, depthWrite: false,
        vertexShader: `uniform float uTime,uScale; uniform vec3 uBox,uVel; attribute float aSeed; varying float vS; varying float vA;
          void main(){ vec3 p=position+uVel*uTime*(0.6+aSeed*0.8); p.x+=sin(uTime*(0.5+aSeed)+aSeed*40.0)*1.3; p.z+=cos(uTime*(0.4+aSeed*0.7)+aSeed*70.0)*1.3;
            p=mod(p,uBox)-uBox*0.5+vec3(0.0,8.0,0.0); vS=aSeed; vA=uTime*(1.0+aSeed*2.0)+aSeed*30.0; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=min(0.17*(0.6+aSeed*0.8)*uScale/max(0.1,-mv.z),64.0); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 uA,uB; uniform float uAlpha; varying float vS; varying float vA;
          void main(){ vec2 c=gl_PointCoord-0.5; float cs=cos(vA),sn=sin(vA); c=vec2(cs*c.x-sn*c.y,sn*c.x+cs*c.y); float fl=0.45+0.55*abs(sin(vA*1.3)); c.x/=max(fl,0.1);
            vec2 q=c*vec2(2.4,2.0); float d=length(q); if(d>1.0||length(c-vec2(0.0,0.3))<0.09) discard;
            vec3 col=mix(uA,uB,clamp(c.y+0.5,0.0,1.0)*(0.5+0.5*vS)); gl_FragColor=vec4(col,uAlpha*(1.0-smoothstep(0.75,1.0,d))); }` }));
      S.petals.frustumCulled = false; S.petals.renderOrder = 15; S.petals.onBeforeRender = () => { PU.uTime.value = G.now; PU.uScale.value = renderer.domElement.height * 0.5; }; S.PU = PU; g.add(S.petals); }

    // ---------------------------------------------------------------- Issen
    const M2 = buildHero({ id: 'duskblade', look: { armor: 0x17151f, cloth: 0x3a3450, glow: ROSE, hood: false } }); S.model = M2; M2.group.scale.setScalar(1.45); b.group.add(M2.group);
    const hips = M2.body.children[0], torso = hips.children[0], head = torso.children.find((o) => o.isGroup && Math.abs(o.position.y - 0.8) < 0.01);
    const shs = torso.children.filter((o) => o.isGroup && Math.abs(Math.abs(o.position.x) - 0.31) < 0.01); S.shs = shs;
    for (let i = 1; i < head.children.length; i++) head.children[i].visible = false;
    const pale = W.mat({ color: 0xffffff, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), indigo = W.mat({ color: 0x1e1a2e, roughness: 0.85, side: THREE.DoubleSide }), crim = W.mat({ color: 0x8a1424, roughness: 0.7, side: THREE.DoubleSide });
    // hakama: wide pleated flare to the ground
    const hk = new THREE.LatheGeometry([[0.25, 0.08], [0.29, -0.15], [0.42, -0.5], [0.62, -0.82], [0.76, -0.93]].map(([x, y]) => new THREE.Vector2(x, y)), 40); { const P = hk.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = P.getY(i), a = Math.atan2(x, z), k = 1 + 0.07 * Math.sin(a * 14) * sat(-y * 1.2); P.setX(i, x * k); P.setZ(i, z * k); } hk.computeVertexNormals(); }
    const hak = new THREE.Mesh(hk, indigo); hak.castShadow = true; hips.add(hak); S.hak = hak;
    const hk2 = new THREE.LatheGeometry([[0.27, 0.06], [0.33, -0.2], [0.5, -0.52], [0.66, -0.74]].map(([x, y]) => new THREE.Vector2(x, y)), 36, 0.25, TAU - 0.5); { const P = hk2.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = P.getY(i), a = Math.atan2(x, z), k = 1 + 0.09 * Math.sin(a * 10 + 0.8) * sat(-y * 1.4); P.setX(i, x * k); P.setZ(i, z * k); } hk2.computeVertexNormals(); }
    const hakO = new THREE.Mesh(hk2, W.mat({ color: 0x2e2a44, roughness: 0.85, side: THREE.DoubleSide })); hakO.castShadow = true; hak.add(hakO);
    const lac = W.mat({ color: 0x120a0c, roughness: 0.25, metalness: 0.2 }), saya = new THREE.Group(); saya.position.set(0.3, 0.02, 0.05); saya.rotation.set(1.27, -0.3, 0.12); hips.add(saya);
    const sy = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 1.75, 8), lac); sy.position.y = -0.55; saya.add(sy); const kj = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), W.mat({ color: 0xb08a3a, roughness: 0.4, metalness: 0.8 })); kj.position.y = -1.42; saya.add(kj);
    const so = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 10), crim); so.position.y = 0.2; saya.add(so);
    // haori: open-front coat over the torso, wide sleeves
    const hb = new THREE.Mesh(new THREE.LatheGeometry([[0.14, 0.76], [0.3, 0.66], [0.33, 0.42], [0.31, 0.15], [0.35, -0.15], [0.43, -0.42]].map(([x, y]) => new THREE.Vector2(x, y)), 28, 0.3, TAU - 0.6), pale); gradY(hb.geometry, 0.35, -0.4, 0xece4d8, 0x24203a); hb.castShadow = true; torso.add(hb);
    const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.31, 0.15, 20), crim); ob.position.y = 0.06; torso.add(ob);
    S.sleeves = [];
    const glove = W.mat({ color: 0x18141c, roughness: 0.7 }); for (const sh of shs) { const hd = sh.children.find((o) => o.isGroup), hn = hd && hd.children.find((o) => o.isGroup); if (hn) { const hm = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), glove); hm.scale.set(1, 1.2, 0.9); hm.castShadow = true; hn.add(hm); } }
    for (const sh of shs) { const sl = new THREE.Mesh(gradY(new THREE.CylinderGeometry(0.15, 0.34, 0.66, 10, 1, true), 0.25, -0.33, 0xece4d8, 0x5a1a2a), pale); sl.position.y = -0.3; sl.scale.z = 1.5; sl.castShadow = true; sh.add(sl); S.sleeves.push(sl); }
    // torn haori tails (shown from phase 2 on)
    S.cloak = []; let cp = torso.children.find((o) => o.isGroup && Math.abs(o.position.z + 0.17) < 0.01);
    while (cp) { const pm = cp.children.find((o) => o.isMesh); if (!pm) break; const tg = new THREE.PlaneGeometry(pm.geometry.parameters.width, 0.31, 8, 1), P = tg.attributes.position, rr = mulberry(S.cloak.length + 3); for (let i = 0; i < P.count; i++) if (P.getY(i) < 0) P.setY(i, P.getY(i) + rr() * 0.22); tg.computeVertexNormals(); const tm = new THREE.Mesh(tg, pm.material); tm.position.copy(pm.position); tm.visible = false; tm.castShadow = true; cp.add(tm); S.cloak.push([pm, tm]); cp = cp.children.find((o) => o.isGroup); }
    // kasa, mask, eyes
    const kasT = W.bake(128, (u, v) => { const s = 0.5 + 0.5 * Math.sin(TAU * u * 48), rg = 0.5 + 0.5 * Math.sin(TAU * v * 10), n = W.fbm(u * 8, v * 8, 2, 3, 8); return [s * 0.6 + rg * 0.3 + n * 0.1, 0.35 + s * 0.35 + n * 0.3, 0.9]; }, { dark: 0x4a3820, light: 0xa88a58, strength: 2 });
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.88, 0.32, 32), new THREE.MeshStandardMaterial({ map: kasT.map, normalMap: kasT.normalMap, roughness: 0.9 })); hat.position.set(0, 0.27, 0); { const un = new THREE.Mesh(new THREE.ConeGeometry(0.86, 0.22, 32, 1, true), W.mat({ color: 0x0c0a10, roughness: 1, side: THREE.BackSide })); un.position.y = -0.06; hat.add(un); } hat.castShadow = true; head.add(hat);
    S.maskMat = new THREE.MeshStandardMaterial({ color: 0x15111a, roughness: 0.45, emissive: 0xff2030, emissiveMap: crackTex(), emissiveIntensity: 0 });
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.158, 18, 12, PI / 2 - 0.95, 1.9, 0.55, 1.55), S.maskMat); mask.position.y = 0.06; head.add(mask);
    S.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALE).multiplyScalar(2) });
    for (const sx of [1]) { const ey = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.014, 0.01), S.eyeMat); ey.position.set(sx * 0.052, 0.085, 0.152); ey.rotation.z = sx * 0.18; head.add(ey); }
    // scarf + sash tails (cloth ribbons)
    S.scarfMat = new THREE.MeshStandardMaterial({ color: 0xd83a5a, emissive: ROSE, emissiveIntensity: 0.2, roughness: 0.8, side: THREE.DoubleSide });
    const nk = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 6, 16), S.scarfMat); nk.rotation.x = PI / 2; nk.position.y = 0.73; torso.add(nk);
    S.ribbons = [
      ribbon(torso, S.scarfMat, { n: 14, x: 0.05, y: 0.72, z: -0.14, len: 2.0, w: 0.17, drop: 0.45, trail: 1, amp: 0.22, f: 3.2, k: 5, ph: 0, taper: 0.35, speedK: 0.15 }),
      ribbon(torso, S.scarfMat, { n: 12, x: -0.05, y: 0.7, z: -0.14, len: 1.45, w: 0.14, drop: 0.5, trail: 1, amp: 0.2, f: 3.0, k: 4.5, ph: 1.4, taper: 0.4, speedK: 0.15 }),
      ribbon(torso, crim, { n: 10, x: 0.09, y: 0.04, z: -0.3, len: 1.05, w: 0.13, drop: 1, trail: 0.25, amp: 0.07, f: 2.2, k: 3, ph: 0.5, speedK: 0.12 }),
      ribbon(torso, crim, { n: 10, x: -0.06, y: 0.04, z: -0.3, len: 0.85, w: 0.12, drop: 1, trail: 0.3, amp: 0.07, f: 2.0, k: 3, ph: 2.1, speedK: 0.12 }),
    ];
    // nodachi: long curved blade with a glowing edge
    const weapon = M2.wtip.parent; for (let i = 1; i < weapon.children.length; i++) if (weapon.children[i].isMesh) weapon.children[i].visible = false;
    weapon.children[0].scale.y = 1.7; weapon.children[0].position.z = -0.06;
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.022, 16), W.mat({ color: 0x2a2018, roughness: 0.5, metalness: 0.7 })); tsuba.rotation.x = PI / 2; tsuba.position.z = 0.2; weapon.add(tsuba);
    const BL = 1.95, cv = (a) => 0.1 * (a / BL) * (a / BL), wd = (a) => 0.074 * (1 - 0.3 * a / BL);
    const shp = new THREE.Shape(); shp.moveTo(0, cv(0) - wd(0) / 2); for (let i = 1; i <= 20; i++) { const a = i / 20 * BL * 0.94; shp.lineTo(a, cv(a) - wd(a) / 2); } shp.lineTo(BL, cv(BL) + wd(BL) * 0.3); for (let i = 20; i >= 0; i--) { const a = i / 20 * BL * 0.94; shp.lineTo(a, cv(a) + wd(a) / 2); }
    const bg = new THREE.ExtrudeGeometry(shp, { depth: 0.016, bevelEnabled: false }); bg.translate(0, 0, -0.008); bg.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0.22, 0, 0, 0, 1));
    const blade = new THREE.Mesh(bg, W.mat({ color: 0xc0c4d0, roughness: 0.16, metalness: 1, envMapIntensity: 1.3 })); blade.castShadow = true; weapon.add(blade);
    S.edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ROSE).multiplyScalar(2.4), side: THREE.DoubleSide });
    const eg = stripGeo(24, (u, s) => { const a = u * BL * 0.97; return [cv(a) - wd(a) / 2 - 0.003, s * 0.011, 0.22 + a]; }); weapon.add(new THREE.Mesh(eg, S.edgeMat));
    M2.wtip.position.set(0, 0, 0.22 + BL);
    // cool lavender fresnel rim on every lit boss material, so he separates from the warm deck
    S.rimU = { value: new THREE.Color(0x9c8cff).multiplyScalar(0.6) }; S.rimW = { value: new THREE.Color(0xffb070).multiplyScalar(1.6) }; S.sunV = { value: new V3(0, 0, -1) };
    const done = new Set(); M2.group.traverse((o) => { const m = o.material; if (!o.isMesh || !m || !m.isMeshStandardMaterial || done.has(m)) return; done.add(m);
      m.onBeforeCompile = (sh) => { sh.uniforms.uRimC = S.rimU; sh.uniforms.uRimW = S.rimW; sh.uniforms.uSunV = S.sunV; sh.fragmentShader = 'uniform vec3 uRimC,uRimW,uSunV;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv=vViewPosition/max(length(vViewPosition),1e-4); float fr=1.0-clamp(abs(dot(normal,vv)),0.0,1.0); totalEmissiveRadiance+=uRimC*(fr*fr*fr)+uRimW*(fr*fr)*pow(max(dot(normal,uSunV),0.0),2.0); }'); };
      m.customProgramCacheKey = () => 'duelRim'; m.needsUpdate = true; });
    S.fake = { moveSpeed: 0, grounded: true, casting: null, parryT: 0, flashT: 0 };
    S.aura = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); S.aura.rotation.x = -PI / 2; S.aura.position.y = 0.06; b.group.add(S.aura);
    // ghosts: spectral silhouettes of Issen mid follow-through
    S.ghostMat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(ROSE).multiplyScalar(1.25) }, uA: { value: 0.4 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4), v=vV/max(length(vV),1e-4); float f=1.0-abs(dot(n,v)); float a=(0.1+f*f*0.95)*uA; gl_FragColor=vec4(uC*a,a); }' });
    const gGeo = [[new THREE.ConeGeometry(1.05, 1.35, 16, 1, true), 0, 0.68, 0], [new THREE.CapsuleGeometry(0.34, 0.6, 4, 10), 0, 1.75, 0], [new THREE.ConeGeometry(1.25, 0.45, 20), 0, 2.95, 0], [new THREE.SphereGeometry(0.22, 10, 8), 0, 2.6, 0]];
    S.ghosts = [];
    for (let i = 0; i < 6; i++) {
      const gm = S.ghostMat.clone(); const gg = new THREE.Group(); gg.userData.mat = gm; for (const [geo, x, y, z] of gGeo) { const m = new THREE.Mesh(geo, gm); m.position.set(x, y, z); gg.add(m); }
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 2.8), gm); sw.position.set(0.55, 1.5, 1.2); sw.rotation.set(0.35, -0.5, 0); gg.add(sw);
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 0.9, 8, 1, true), gm); sl.position.set(0.5, 1.8, 0.35); sl.rotation.x = -1.1; gg.add(sl);
      gg.visible = false; g.add(gg); S.ghosts.push({ g: gg, cut: null, mark: null });
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
    S.cuts = []; S.haste = 0; S.still = false; S.walk = false; S.kneel = 0; S.night = 0; S.open = 0; S.torn = false; S.tv = new V3();
    b.onDamaged = (amt, info) => { if (S.still && !S.countered && info.src === 'player') { S.countered = true; Co.start(counter(b), 'phase'); } };
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
    vStart(it, x, 1.0, z, dir, { dur: 0.42 + len * 0.006, sweep: 0.26, col: col === PALE ? 0xff6aa0 : 0xe8306a, mult: 1.0 }); it.m.scale.set(1.15, 1, Math.max(0.5, len));
    for (let d = 0; d < len; d += 1.4) FX.burst(x + Math.sin(dir) * d, 0.9, z + Math.cos(dir) * d, { n: 2, smoke: true, color: 0x1a0610, color2: 0x050104, alpha: 0.75, speed: [1.5, 4], dir: [Math.cos(dir), 0.4, -Math.sin(dir)], spread: 0.5, life: [0.3, 0.6], size: [0.12, 0.3], grav: 4, drag: 2 });
  }
  // tapered ink-brush stroke with a white-hot core drawn along a line telegraph while it fills
  function vTele(b, x, z, dir, len, t) {
    if (G.headless) return; const V = b.state.vfx, it = V.tel[V.ti = (V.ti + 1) % V.tel.length], tail = 0.3;
    vStart(it, x, 0.035, z, dir, { dur: t + tail, sweep: t / (t + tail), col: 0xff6a88, mult: 0.7 }); it.m.scale.set(2.75, 1, Math.max(0.5, len));
  }
  function vArcs(b, key, x, z, dir = 0) {
    if (G.headless) return; b.state.vfx.arcs[key].forEach((it, i) => { vStart(it, x, 0.85 + i * 0.12, z, dir, { delay: i * 0.05, dur: 1.0, sweep: 0.16, col: i % 2 ? 0xff5a86 : 0xe82a5a, mult: 1.5 }); });
    const rs = { c: [3.6, 6.1, 8.5], o: [5.7, 9, 12.4], n: [2.8, 5.5] }[key], span = key === 'c' ? 3.5 : TAU;
    for (const r of rs) for (let k = 0; k < 7; k++) { const a = dir + (key === 'c' ? -1.75 : 0) + span * (k + 0.5) / 7; FX.burst(x + Math.sin(a) * r, 1.0, z + Math.cos(a) * r, { n: 3, color: PALE, color2: ROSE, speed: [0.5, 2.5], life: [0.6, 1.3], size: [0.1, 0.22], grav: 1.5, drag: 1.2 }); }
  }

  const tele = (b, t) => t * Math.pow(0.86, b.state.haste);
  function petals(x, z, n = 30, c = PALE) { FX.burst(x, 1.2, z, { n, color: c, color2: ROSE, speed: [1, 7], life: [0.5, 1.3], size: [0.1, 0.28], grav: 2, drag: 1.5 }); }
  function cutFx(b, x, z, dir, len, col = 0xffffff) {
    vCut(b, x, z, dir, len, col); Sound.sfx('sword', 0.9, 0.8 + vrand() * 0.3); Sound.sfx('slash', 0.8);
    if (!G.headless) for (let d = 0; d < len; d += 1.6) FX.burst(x + Math.sin(dir) * d, 0.9, z + Math.cos(dir) * d, { n: 3, color: PALE, color2: ROSE, speed: [0.5, 3], life: [0.4, 1.0], size: [0.1, 0.25], up: 1 });
    FX.shake(0.2);
  }
  function addGhost(b, cut) {
    const S = b.state, gh = S.ghosts.find((q) => !q.cut); if (!gh) return; gh.cut = cut; gh.g.visible = true; gh.g.position.set(cut.x, 0, cut.z); gh.g.rotation.y = cut.dir;
    gh.mark = Hz.mark({ type: 'rect', x: cut.x, z: cut.z, dir: cut.dir, len: cut.len, w: 0.35 }, 60, { color: ROSE, alpha: 0.45 });
  }
  function* drawCut(b, n) {
    const S = b.state, p = G.player; S.walk = false;
    for (let i = 0; i < n; i++) {
      const a = b.angToPlayer(); b.facing = a; const len = Math.max(6, edgeLen(b.pos.x, b.pos.z, a)), cut = { x: b.pos.x, z: b.pos.z, dir: a, len };
      S.fake.parryT = 1; const t = tele(b, i === 0 ? 0.95 : 0.72);
      Hz.rect(cut.x, cut.z, a, len, 2.3, t, 310, { name: 'Draw Cut', color: ROSE, quiet: true, silent: i > 0 }); vTele(b, cut.x, cut.z, a, len, t);
      yield t; S.fake.parryT = 0; S.model.swing(1, 0.25); cutFx(b, cut.x, cut.z, a, len); addGhost(b, cut);
      b.pos.x += Math.sin(a) * len; b.pos.z += Math.cos(a) * len; petals(b.pos.x, b.pos.z, 14); yield 0.3;
    }
    b.facing = b.angToPlayer(); yield 0.5;
  }
  // mode 0: one at a time. 1: in pairs. 2: all at once.
  function* echo(b, mode) {
    const S = b.state, list = S.ghosts.filter((q) => q.cut); if (!list.length) return;
    yield* b.cast({ name: 'Echo', time: 0.9 });
    const t = tele(b, mode === 2 ? 1.3 : 0.8);
    for (let i = 0; i < list.length; i++) {
      const gh = list[i], c = gh.cut; Hz.cancel(gh.mark);
      vTele(b, c.x, c.z, c.dir, c.len, t); Hz.rect(c.x, c.z, c.dir, c.len, 2.3, t, 270, { name: 'Echo', color: ROSE, quiet: true, silent: i > 0, onFire: () => { cutFx(b, c.x, c.z, c.dir, c.len, PALE); gh.g.visible = false; gh.cut = null; } });
      if (mode === 0 || (mode === 1 && i % 2 === 1)) yield tele(b, 0.55);
    }
    yield t + 0.5;
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
  function* stillness(b, dur = 2.3) {
    const S = b.state; S.walk = false; S.still = true; S.countered = false; S.kneel = 1; Sound.sfx('bell', 0.45, 3); b.facing = b.angToPlayer();
    yield* b.cast({ name: 'Stillness', time: dur });
    S.still = false; S.kneel = 0;
    if (!S.countered) { S.open = 3.2; b.dmgTaken = 1.6; petals(b.pos.x, b.pos.z, 24); yield 3.2; b.dmgTaken = 1; } else yield 1.0;
  }
  function* counter(b) {
    const S = b.state, p = G.player; FX.flash(0xffffff, 0.3, 4); Sound.sfx('parry', 0.8, 0.7); petals(b.pos.x, b.pos.z, 30);
    const a = p.facing + PI, ox = b.pos.x, oz = b.pos.z; let tx = p.pos.x + Math.sin(a) * 2.2, tz = p.pos.z + Math.cos(a) * 2.2; const d = Math.hypot(tx, tz); if (d > 14) { tx *= 14 / d; tz *= 14 / d; }
    yield 0.22; b.pos.x = tx; b.pos.z = tz; b.facing = b.angToPlayer(); S.model.swing(1, 0.2);
    const cl = Math.hypot(tx - ox, tz - oz); if (cl > 0.5) vCut(b, ox, oz, Math.atan2(tx - ox, tz - oz), cl, 0xffffff); Sound.sfx('crit'); FX.slash(p.pos.x, 1.2, p.pos.z, b.facing, { r: 3.5, color: 0xffffff, dur: 0.3, mult: 1.6 });
    p.hurt(520, { blockable: true, src: { name: 'Counter' } });
  }
  function* focus(b) {
    const S = b.state; S.walk = false; S.kneel = 0.4;
    const r = yield* b.cast({ name: 'Thousand-Petal Focus', time: 3.0, interruptible: true, onTick: () => { if (!G.headless && vrand() < 0.5) { const a = vrand() * TAU; FX.burst(b.pos.x + Math.sin(a) * 4, 0.3 + vrand() * 2, b.pos.z + Math.cos(a) * 4, { n: 1, color: ROSE, dir: [-Math.sin(a), 0.1, -Math.cos(a)], spread: 0.1, speed: [5, 8], life: [0.4, 0.6] }); } } });
    S.kneel = 0;
    if (r === 'interrupted' && !G.headless) { FX.ring(b.pos.x, b.pos.z, { r0: 0.5, r1: 7, color: PALE, dur: 0.5, width: 0.22, mult: 1.6 }); FX.ring(b.pos.x, b.pos.z, { r0: 0.3, r1: 4, color: ROSE, dur: 0.35, width: 0.3, mult: 1.4 }); petals(b.pos.x, b.pos.z, 60); FX.shake(0.25); }
    if (r === 'done') { S.haste = Math.min(3, S.haste + 1); FX.dome(b.pos.x, 1, b.pos.z, { r: 6, color: ROSE, dur: 0.6 }); Sound.sfx('roar', 0.6, 2.2); FX.flash(ROSE, 0.25, 3); }
    yield 0.8;
  }
  function* petalStorm(b, dur = 6.5, arms = 4) {
    const S = b.state; S.walk = false; petals(b.pos.x, b.pos.z, 20); b.pos.set(0, 0, 0); petals(0, 0, 40);
    yield* b.cast({ name: 'Petal Storm', time: 1.2 });
    let t = 0, a0 = rnd(TAU); const dirSign = rnd() < 0.5 ? 1 : -1;
    while (t < dur) { for (let k = 0; k < arms; k++) { const a = a0 + k / arms * TAU; Bul.fire({ x: Math.sin(a) * 1.2, z: Math.cos(a) * 1.2, dir: a, speed: 6.2, dmg: 85, color: 0xff90b0, r: 0.36, life: 3.6 }); Bul.fire({ x: Math.sin(a + 0.16) * 1.2, z: Math.cos(a + 0.16) * 1.2, dir: a + 0.16, speed: 6.2, dmg: 85, color: 0xff90b0, r: 0.36, life: 3.6 }); } a0 += dirSign * 0.105; b.facing += dirSign * 0.9; if (Math.floor(t / 0.36) !== Math.floor((t - 0.12) / 0.36)) S.model.swing(1, 0.3); t += 0.12; yield 0.12; }
    b.facing = b.angToPlayer(); yield 0.7;
  }
  function* finalVerse(b, n = 9) {
    const S = b.state; S.walk = false; yield* b.cast({ name: 'Final Verse', time: 1.1 });
    petals(b.pos.x, b.pos.z, 40); b.targetable = false; b.group.visible = false; Co.start(Post.lerpTo({ sat: 0.75, vig: 1.05 }, 0.4), 'fight');
    for (let i = 0; i < n; i++) {
      const qa = rnd(TAU), qr = i % 3 === 0 ? 0 : rnd(2, 10), p = G.player, qx = i % 3 === 0 ? p.pos.x : Math.sin(qa) * qr, qz = i % 3 === 0 ? p.pos.z : Math.cos(qa) * qr, dir = rnd(TAU), ox = qx - Math.sin(dir) * 20, oz = qz - Math.cos(dir) * 20;
      vTele(b, ox, oz, dir, 40, tele(b, 1.2)); Hz.rect(ox, oz, dir, 40, 2.1, tele(b, 1.2), 300, { name: 'Final Verse', color: ROSE, quiet: true, silent: true, onFire: () => cutFx(b, ox, oz, dir, 40, i % 2 ? PALE : 0xffffff) }); Sound.sfx('tick', 1, 1 + i * 0.08);
      yield tele(b, 0.27);
    }
    yield tele(b, 1.2); Co.start(Post.lerpTo({ sat: 1.08, vig: 0.9 }, 0.5), 'fight');
    const p = G.player, a = rnd(TAU); let tx = p.pos.x + Math.sin(a) * 4, tz = p.pos.z + Math.cos(a) * 4; const d = Math.hypot(tx, tz); if (d > 13) { tx *= 13 / d; tz *= 13 / d; }
    b.pos.set(tx, 0, tz); b.group.visible = true; b.targetable = true; petals(tx, tz, 40); b.facing = b.angToPlayer(); yield 0.4;
  }
  // phase 2 mood: the sun sinks lower and redder, more petals
  function* deepen(b) { yield* W.tween(3, deepenFn(b)); }
  function deepenFn(b) {
    const S = b.state, U = S.sky.material.uniforms, E = S.EU, C = (h) => new THREE.Color(h);
    const hor0 = U.uHor.value.clone(), cc0 = U.uCloudCol.value.clone(), d0 = U.uSunDir.value.clone(), d1 = new V3(-0.28, 0.09, -0.95).normalize(), eh0 = E.uHor.value.clone(), ef0 = E.uFogC.value.clone(), sc0 = S.sun.color.clone();
    return (k) => {
      W.colorLerp(U.uHor.value, hor0, C(0xff7a50), k); W.colorLerp(U.uCloudCol.value, cc0, C(0xff9a80), k); U.uSunDir.value.lerpVectors(d0, d1, k).normalize(); E.uSunDir.value.copy(U.uSunDir.value);
      W.colorLerp(E.uHor.value, eh0, C(0xf07a58), k); W.colorLerp(E.uFogC.value, ef0, C(0xd07a68), k); W.colorLerp(S.sun.color, sc0, C(0xffa070), k); S.PU.uAlpha.value = lerp(0.9, 1.0, k);
    };
  }
  // phase 3: night-dusk blue with a blood moon; deck kept near neutral so telegraphs read
  function* nightfall(b) {
    const S = b.state, U = S.sky.material.uniforms, E = S.EU, C = (h) => new THREE.Color(h);
    const snap = (o) => o.clone(), top0 = snap(U.uTop.value), hor0 = snap(U.uHor.value), bot0 = snap(U.uBot.value), sc0 = snap(U.uSunCol.value), d0 = snap(U.uSunDir.value), d1 = new V3(-0.36, 0.13, -0.93).normalize(), cc0 = snap(U.uCloudCol.value), cd0 = snap(U.uCloudDark.value);
    const e0 = {}; for (const k of ['uTop', 'uHor', 'uSunCol', 'uFogC', 'uMtnF', 'uMtnN', 'uDeep', 'uPet', 'uMist']) e0[k] = snap(E[k].value);
    const e1 = { uTop: C(0x0a0c26), uHor: C(0x2a2040), uSunCol: C(0xff3020), uFogC: C(0x161830), uMtnF: C(0x1c1c34), uMtnN: C(0x08080f), uDeep: C(0x05070f), uPet: C(0xb02040), uMist: C(0x3a3660) };
    const sun0 = snap(S.sun.color), hs0 = snap(S.hemi.color), hg0 = snap(S.hemi.groundColor), fog0 = snap(scene.fog.color), bl0 = snap(S.blossom.color), be0 = snap(S.blossom.emissive), la0 = snap(S.lampMat.color), pa0 = snap(S.PU.uA.value), pb0 = snap(S.PU.uB.value), pl0 = snap(S.pls[0].color), rim0 = snap(S.rimU.value), rw0 = snap(S.rimW.value), fa0 = snap(S.fallen.color), po0 = snap(S.poolMat.uniforms.uC.value), fi0 = snap(S.fill.color);
    yield* W.tween(4.5, (k) => {
      W.colorLerp(U.uTop.value, top0, C(0x03040e), k); W.colorLerp(U.uHor.value, hor0, C(0x2a1a3a), k); W.colorLerp(U.uBot.value, bot0, C(0x05040a), k); W.colorLerp(U.uSunCol.value, sc0, C(0xff2418), k);
      U.uSunDir.value.lerpVectors(d0, d1, k).normalize(); U.uSunSize.value = lerp(0.12, 0.65, k); U.uStars.value = k * 1.4; U.uSunGlow.value = lerp(1.05, 0.9, k);
      W.colorLerp(U.uCloudCol.value, cc0, C(0x2a2040), k); W.colorLerp(U.uCloudDark.value, cd0, C(0x06040c), k); U.uCloud.value = lerp(0.5, 0.38, k);
      for (const key in e1) W.colorLerp(E[key].value, e0[key], e1[key], k); E.uSunDir.value.copy(U.uSunDir.value); E.uGlowK.value = lerp(1, 0.8, k); E.uStreak.value = k * 1.6; W.colorLerp(S.rimW.value, rw0, new THREE.Color(0xff3040).multiplyScalar(1.4), k);
      W.colorLerp(S.sun.color, sun0, C(0x9aa8e0), k); S.sun.intensity = lerp(2.6, 1.7, k); W.colorLerp(S.hemi.color, hs0, C(0x3a4a80), k); W.colorLerp(S.hemi.groundColor, hg0, C(0x141420), k); S.hemi.intensity = lerp(0.95, 1.1, k);
      W.colorLerp(S.fill.color, fi0, C(0x8090ff), k); W.colorLerp(scene.fog.color, fog0, C(0x10122a), k);
      W.colorLerp(S.blossom.color, bl0, C(0xd8a0b8), k); W.colorLerp(S.blossom.emissive, be0, C(0xa01838), k); S.blossom.emissiveIntensity = lerp(0.22, 0.1, k);
      W.colorLerp(S.lampMat.color, la0, new THREE.Color(0xffb070).multiplyScalar(1.6), k); for (const L of S.pls) W.colorLerp(L.color, pl0, C(0xffa060), k);
      W.colorLerp(S.PU.uA.value, pa0, C(0xc01838), k); W.colorLerp(S.PU.uB.value, pb0, C(0xff6070), k);
      W.colorLerp(S.rimU.value, rim0, new THREE.Color(0x8aa0ff).multiplyScalar(0.8), k); S.rope.emissiveIntensity = 0; W.colorLerp(S.fallen.color, fa0, C(0xd04058), k); W.colorLerp(S.poolMat.uniforms.uC.value, po0, new THREE.Color(0xffa060).multiplyScalar(0.22), k); S.night = k;
    });
  }

  G.bosses.push({
    id: 'duelist', name: 'ISSEN', title: 'The Last Petal', hint: 'A duel', color: '#ff7a9a', telegraph: ROSE,
    hp: 23000, radius: 0.9, aimY: 1.6, enrage: 420,
    post: { bloom: 0.42, threshold: 1.0, radius: 0.55, exposure: 0.92, vig: 0.85, sat: 1.1, tint: [1.04, 1.0, 0.98] },
    music: { bpm: 92, root: 45, scale: [0, 2, 3, 7, 8], prog: [0, 0, 3, 2, 0, 0, 4, 2],
      layers: [
        { v: 'koto', pat: ['0...2...4..3....', '0...4...3..2....'], oct: 1, len: 4, vol: 0.14 }, { v: 'flute', pat: ['........4.......', '7.......5.......'], oct: 2, len: 7, vol: 0.07 },
        { v: 'sub', pat: '0...............', oct: -1, len: 14, vol: 0.2 },
        { v: 'taiko', from: 1, pat: 'x.....x.x.......', vol: 0.3 }, { v: 'koto', from: 1, pat: '0.2.4.2.0.2.4.5.', oct: 2, len: 2, vol: 0.07 }, { v: 'clap', from: 1, pat: '....x.......x...', vol: 0.1 },
        { v: 'taiko', from: 2, pat: 'x..x..x.x..x.xx.', vol: 0.34 }, { v: 'koto', from: 2, pat: '0245420245754202', oct: 2, len: 1, vol: 0.07 }, { v: 'flute', from: 2, pat: ['0.....2.4.......', '5.....4.2.......'], oct: 3, len: 5, vol: 0.08 }, { v: 'hat', from: 2, pat: '..x...x...x...x.', vol: 0.1 },
      ] },
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
        *run(b) {
          const S = b.state;
          while (true) {
            yield* focus(b); yield* drawCut(b, 4); yield* echo(b, 1); S.walk = true; yield 1.0;
            yield* petalStorm(b); yield* moon(b, ['c', 'n', 'o']); S.walk = true; yield 0.8;
            yield* stillness(b); yield* drawCut(b, 4); yield* moon(b, ['o', 'c']); yield* echo(b, 1); S.walk = true; yield 1.0;
          }
        } },
      { at: 0.33, *enter(b) { const S = b.state; clearGhosts(S); S.walk = false; b.pos.set(0, 0, 0); b.facing = 0; S.kneel = 1; Sound.sfx('bell', 0.9, 0.6); Co.start(Post.lerpTo({ bloom: 0.5, threshold: 1.0, tint: [0.96, 0.98, 1.06], exposure: 1.1, sat: 1.05, vig: 0.9, lift: [0.012, 0.012, 0.024] }, 4), 'fight'); yield* nightfall(b); S.kneel = 0; Sound.sfx('sword'); petals(0, 0, 80, 0xff3050); yield 0.6; },
        *run(b) {
          const S = b.state;
          while (true) {
            yield* finalVerse(b, 9); yield* moon(b, ['c', 'o']); yield* drawCut(b, 5); yield* echo(b, 2); S.walk = true; yield 0.8;
            yield* focus(b); yield* stillness(b, 3.0); yield* petalStorm(b, 6, 5); yield* moon(b, ['n', 'o', 'c', 'n']); S.walk = true; yield 0.6;
          }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, ox = b.pos.x, oz = b.pos.z;
      if (S.walk && b.alive && G.state === 'fight' && !b.castState) { const d = b.distToPlayer(); b.facing = dampAng(b.facing, b.angToPlayer(), 8, dt); if (d > 3.2) { const s = Math.min(d - 3.2, 4.6 * dt); b.pos.x += Math.sin(b.facing) * s; b.pos.z += Math.cos(b.facing) * s; } }
      if (S.open > 0) S.open -= dt;
      if (G.headless) return;
      S.fake.moveSpeed = Math.hypot(b.pos.x - ox, b.pos.z - oz) / Math.max(dt, 1e-4) > 20 ? 0 : Math.hypot(b.pos.x - ox, b.pos.z - oz) / Math.max(dt, 1e-4);
      S.fake.casting = b.castState && b.castState.name === 'Thousand-Petal Focus' ? 1 : null;
      S.model.update(dt, S.fake); S.model.group.position.y = damp(S.model.group.position.y, -S.kneel * 0.55, 8, dt); S.model.body.rotation.x += S.kneel * 0.35;
      for (const r of S.ribbons) ribbonUpdate(r, G.now, S.fake.moveSpeed);
      S.sunV.value.copy(S.EU.uSunDir.value).transformDirection(camera.matrixWorldInverse);
      for (let i = 0; i < S.sleeves.length; i++) { const sl = S.sleeves[i]; sl.rotation.x = Math.sin(G.now * 2.1 + i * 1.7) * 0.1 + Math.min(S.fake.moveSpeed, 6) * 0.05; sl.rotation.z = Math.sin(G.now * 1.6 + i) * 0.06; }
      S.hak.rotation.x = -Math.min(S.fake.moveSpeed, 6) * 0.025; S.hak.scale.y = 1 - S.kneel * 0.25;
      // phase marks: torn haori + shoulder petal embers from phase 2, cracked glowing mask in phase 3
      const ph = Math.max(0, b.phase);
      if (ph >= 1 && !S.torn) { S.torn = true; for (const [a, c] of S.cloak) { a.visible = false; c.visible = true; } S.sleeves[1].scale.y = 0.75; S.sleeves[1].position.y = -0.24; }
      if (ph >= 1 && b.group.visible && vrand() < dt * (ph >= 2 ? 26 : 16)) { const sh = S.shs[vrand() < 0.5 ? 0 : 1]; sh.getWorldPosition(S.tv); FX.burst(S.tv.x, S.tv.y + 0.1, S.tv.z, { n: 1, color: ph >= 2 ? 0xff3048 : 0xffb0c4, color2: ph >= 2 ? 0x400010 : ROSE, speed: [0.4, 1.4], up: 1.6, life: [0.6, 1.2], size: [0.1, 0.2], radius: 0.25 }); }
      const mk = ph >= 2 ? S.night : 0; S.edgeMat.color.setRGB(lerp(2.4, 4.2, mk), lerp(0.7, 0.35, mk), lerp(1.0, 0.45, mk));
      if (mk > 0.5 && b.group.visible && vrand() < dt * 40) { const a = G.now * 2.4 + vrand() * 0.6 + (vrand() < 0.5 ? PI : 0), r = 1.4 + vrand() * 0.5; FX.burst(b.pos.x + Math.sin(a) * r, 0.3 + vrand() * 2.2, b.pos.z + Math.cos(a) * r, { n: 1, color: 0xff2a40, color2: 0x600010, dir: [Math.cos(a), 0.25, -Math.sin(a)], spread: 0.15, speed: [2.5, 4], life: [0.5, 0.9], size: [0.1, 0.2], drag: 0.5 }); } S.maskMat.emissiveIntensity = mk * (2.2 + 0.8 * Math.sin(G.now * 3)); S.eyeMat.color.setRGB(lerp(2, 5, mk), lerp(1.7, 0.4, mk), lerp(1.75, 0.5, mk));
      S.aura.material.opacity = S.still ? 0.5 + 0.4 * Math.sin(G.now * 12) : S.open > 0 ? 0.25 : 0; S.aura.material.color.setHex(S.still ? 0xffffff : 0x70ff90); S.aura.scale.setScalar(S.still ? 1 + 0.15 * Math.sin(G.now * 6) : 1.2);
      for (const gh of S.ghosts) if (gh.g.visible) gh.g.position.y = Math.sin(G.now * 2 + gh.g.position.x) * 0.06;
      { const ga = 0.32 + 0.14 * Math.sin(G.now * 5); for (const gh of S.ghosts) if (gh.g.visible) { const d = camera.position.distanceTo(gh.g.position); gh.g.userData.mat.uniforms.uA.value = ga * smooth((d - 4) / 6); } }
      for (const it of S.vfx.list) { if (!it.m.visible) continue; it.t += dt; const k = it.t / it.dur; if (k >= 1) { it.m.visible = false; continue; } it.m.material.uniforms.uT.value = Math.max(0, k); }
      if (S.haste && vrand() < dt * 12 * S.haste) FX.burst(b.pos.x, 0.2 + vrand() * 2, b.pos.z, { n: 1, color: 0xff2040, speed: [0.3, 1.2], up: 1.5, life: [0.4, 0.8], radius: 0.5 });
    },
    bot(b) { return { holdFire: b.state.still }; },
  });
})();
