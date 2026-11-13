// DOOR XV: ANZU, the Storm Roc. The whole fight is a fall through the sky; what rises from below is the danger, the ground is the clock.
(() => {
  const R = 17, GOLD = 0xffb648, STORM = 0x9fc8ff, SAFE = 0x5cff8c, LIFT = 5, RISE = 42;
  const _a = new V3(), _b = new V3(), _m = new THREE.Object3D(), _c = new THREE.Color(), _x = new V3(), _y = new V3(), _z = new V3(), _w = new V3(), _M = new THREE.Matrix4();
  const HOLE_D = [5.5, 9.5, 12.5];
  const holeAt = (d, a) => [-d * Math.sin(a), -d * Math.cos(a)];
  // act 1 above the storm in sunlight, act 2 inside it, act 3 under the thunderhead
  const LOOKS = [
    { top: 0x174598, hor: 0x4f7cc0, fog: 0x7e9cc4, dens: 0.00028, hemi: 0.4, sun: 1.6, env: 0.35, cloud: 0xe2e2e2, shade: 0x52648a, cop: 0.62, streak: 0xa8bcd8, mote: 0.06, wisp: 0.12, cwL: 0xf2ebde, cwS: 0x6c84b2, cwR: 0xd8ccb8, cov: 0.56, farL: 0x000000, farD: 0x000000, farA: 0, bloom: 0, pulse: 0, dLit: 0x3a4466, dDark: 0x0c0f1c, low: -1.5, disc: 0x101a32, discA: 0.36, rain: 0, vein: 0.12, veinC: 0x8aa0c0, rim: 0xa8c8ff, eye: 0xfff8d0, deckC: 0xd8d8da, deckD: 0x46567c, ter: 0x9aaccc, trail: 0.3, shim: 0 },
    { top: 0x0a0e1c, hor: 0x1e2640, fog: 0x161c2e, dens: 0.012, hemi: 0.4, sun: 0.25, env: 0.2, cloud: 0x404a66, shade: 0x121626, cop: 0.6, streak: 0x7a90c0, mote: 0.08, wisp: 0.1, cwL: 0x56669a, cwS: 0x1a2440, cwR: 0x9aaee0, cov: 0.4, farL: 0x3a4a78, farD: 0x222e52, farA: 1, bloom: 0, pulse: 0, dLit: 0x3e4a72, dDark: 0x0b0f1e, low: -1.5, disc: 0x060a14, discA: 0.32, rain: 0.22, vein: 0.22, veinC: 0x6a7c9c, rim: 0x6a8cff, eye: 0xfff8d0, deckC: 0xd8d8da, deckD: 0x46567c, ter: 0xffffff, trail: 0.4, shim: 0 },
    { top: 0x0c0618, hor: 0x2c2048, fog: 0x22183a, dens: 0.0016, hemi: 0.38, sun: 0.3, env: 0.16, cloud: 0x382a50, shade: 0x0c0816, cop: 0.55, streak: 0x9a88d0, mote: 0.07, wisp: 0.1, cwL: 0x403a6a, cwS: 0x0e1228, cwR: 0xa8b4ff, cov: 0.4, farL: 0x262c50, farD: 0x161a34, farA: 1, bloom: 1, pulse: 1, dLit: 0x4c3a80, dDark: 0x110a22, low: -0.3, disc: 0x0a0614, discA: 0.32, rain: 1.6, vein: 1.7, veinC: 0x9ff8ff, rim: 0x80b8ff, eye: 0xc0fcff, deckC: 0x3c2e58, deckD: 0x0e0a18, ter: 0x3a3050, trail: 0.5, shim: 1 },
  ];
  const POST = [null, { bloom: 0.55, exposure: 1.06, sat: 0.95, contrast: 1.1, vig: 0.6 }, { bloom: 0.55, vig: 0.65, exposure: 0.96, sat: 1.06, contrast: 1.12, tint: [1.03, 0.96, 1.08] }];
  const NOISE2 = 'float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }';
  // a tapered, pointed feather: root at the origin, extends along -z, unit length and width; aF = (root..tip, across)
  function featherGeo() {
    const N = 10, pos = [], fa = [], idx = [];
    for (let i = 0; i <= N; i++) { const s = i / N, w = 0.5 * (s < 0.15 ? 0.15 + 0.85 * smooth(s / 0.15) : s < 0.6 ? 1 : Math.pow(Math.max(0, 1 - ((s - 0.6) / 0.4) ** 2), 0.6)), y = -0.12 * s * s; pos.push(-w * 0.85, y - 0.06 * w, -s, 0, y + 0.04 * w, -s, w, y - 0.06 * w, -s); fa.push(s, 0, s, 0.5, s, 1); }
    for (let i = 0; i < N; i++) { const a = i * 3; idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aF', new THREE.Float32BufferAttribute(fa, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const withF = (g, fn) => { const P = g.attributes.position, a = new Float32Array(P.count * 2); for (let i = 0; i < P.count; i++) a[i * 2] = fn ? fn(P.getX(i), P.getY(i), P.getZ(i)) : 0.15; g.setAttribute('aF', new THREE.BufferAttribute(a, 2)); return g; };
  // one feather instance on a surface: normal n, pointing along d (projected onto the surface)
  function place(im, i, px, py, pz, nx, ny, nz, dx, dy, dz, W, L, th = 0.4) {
    _y.set(nx, ny, nz).normalize(); _z.set(dx, dy, dz); _z.addScaledVector(_y, -_z.dot(_y)); if (_z.lengthSq() < 1e-6) _z.set(0, 0, -1); _z.normalize().negate();
    _x.crossVectors(_y, _z).normalize(); _w.copy(_y); _M.makeBasis(_x.multiplyScalar(W), _w.multiplyScalar(L * th), _z.multiplyScalar(L)); _M.setPosition(px + _y.x * 0.03, py + _y.y * 0.03, pz + _y.z * 0.03); im.setMatrixAt(i, _M);
  }

  function build(b) {
    const g = G.world, S = b.state, L0 = LOOKS[0];
    const sky = W.sky({ top: L0.top, horizon: L0.hor, bottom: L0.fog, stars: 0, sunDir: [0.5, 0.45, -0.7], sunColor: 0xa89c88, sunSize: 0.03, sunGlow: 0.6, clouds: 0.35, cloudColor: 0xeeeeee, cloudDark: 0x5a6e94, cloudSpeed: 0.02 });
    g.add(sky); S.sky = sky; W.env(sky, L0.env);
    scene.fog = new THREE.FogExp2(L0.fog, L0.dens); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0xcfe0ff, 0x6a6a70, L0.hemi);
    S.sun = W.sun(g, { dir: [0.5, 0.8, -0.3], color: 0xfff0d8, intensity: L0.sun, size: 30 });
    S.sheet = 0; S.sheet2 = 0; S.flashDir = new V3(0, 1, 0);

    // storm backdrop: a dome of billowing cloud, lit from inside by sheet lightning (acts 2 and 3)
    S.domeM = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uLow: { value: -1.5 }, uLit: { value: new THREE.Color(L0.dLit) }, uDark: { value: new THREE.Color(L0.dDark) }, uFog: { value: new THREE.Color(L0.fog) }, uFlashDir: { value: S.flashDir }, uFlashC: { value: new THREE.Color(0xb8c4ff) } },
      vertexShader: 'varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
      fragmentShader: `uniform float uTime,uFlash,uLow; uniform vec3 uLit,uDark,uFog,uFlashDir,uFlashC; varying vec3 vD;
        float h3(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
        float fb(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*n3(p); p=p*2.07+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
        void main(){ vec3 d=vD/max(length(vD),1e-4); float hh=d.y; vec3 p=d*2.6; p.y-=uTime*0.05;
          float bl=fb(p+vec3(fb(p*0.8+5.0))*0.9), b2=fb(p*3.1+2.0); float v=smoothstep(0.3,0.78,bl)*(0.7+0.6*b2);
          float fd=max(dot(d,uFlashDir),0.0); float fl=uFlash*(pow(fd,5.0)*1.8+0.1);
          vec3 col=mix(uDark,uLit,clamp(v,0.0,1.2))+uFlashC*fl*(0.2+v*v*1.6);
          col=mix(uFog,col,smoothstep(uLow,uLow+0.3,hh)); gl_FragColor=vec4(col,1.0); }` });
    S.dome = new THREE.Mesh(new THREE.SphereGeometry(1700, 40, 24), S.domeM); S.dome.renderOrder = -99; S.dome.frustumCulled = false; S.dome.visible = false; S.dome.onBeforeRender = () => { S.dome.position.copy(camera.position); }; g.add(S.dome);

    // cloud walls around the shaft: crisp billows with lit tops and shaded bellies, rushing upward, lit from inside by lightning
    S.cwM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, fog: false, uniforms: { uTime: { value: 0 }, uLit: { value: new THREE.Color(L0.cwL) }, uShade: { value: new THREE.Color(L0.cwS) }, uRimC: { value: new THREE.Color(L0.cwR) }, uFog: { value: new THREE.Color(L0.fog) }, uCov: { value: L0.cov }, uFlash: { value: 0 }, uFlashDir: { value: S.flashDir }, uFlashC: { value: new THREE.Color(0xc0b8ff) }, uFarL: { value: new THREE.Color() }, uFarD: { value: new THREE.Color() }, uFarA: { value: 0 }, uBloom: { value: 0 } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform float uTime,uCov,uFlash,uFarA,uBloom; uniform vec3 uLit,uShade,uRimC,uFog,uFlashDir,uFlashC,uFarL,uFarD; varying vec3 vW;
        float h3(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
        float fb(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*n3(p); p=p*2.1+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
        float bg(vec3 q){ return n3(q)*0.65+n3(q*2.1+3.0)*0.35; }
        void main(){ vec2 dh=vW.xz/max(length(vW.xz),1e-3); vec3 p=vec3(dh.x*3.0,(vW.y-uTime*38.0)*0.035,dh.y*3.0);
          vec3 q=p+vec3(n3(p*0.5+2.0),n3(p*0.5+7.0),n3(p*0.5+4.0))*0.8; float big=bg(q), bu=bg(q+vec3(0.0,0.2,0.0));
          float det=n3(q*4.3+1.0)*0.6+n3(q*9.1+5.0)*0.4; float dn=big+(det-0.5)*0.22*(1.0-smoothstep(uCov,uCov+0.25,big));
          float al=smoothstep(uCov-0.08,uCov+0.12,dn); float top=clamp((big-bu)*8.0+0.5,0.0,1.0); float body=smoothstep(uCov,uCov+0.3,dn);
          vec3 col=mix(uShade,uLit,smoothstep(0.25,0.85,top)); col=mix(col,uShade*0.7,body*(1.0-top)*0.5); col+=uRimC*smoothstep(0.6,0.92,top)*(1.0-body*0.7)*0.55;
          vec3 pf=vec3(dh.x*1.6,(vW.y-uTime*14.0)*0.02,dh.y*1.6)+9.0; float fdn=n3(pf)*0.6+n3(pf*2.3)*0.4; vec3 far=mix(uFarD,uFarL,smoothstep(0.35,0.75,fdn));
          vec2 fd2=uFlashDir.xz/max(length(uFlashDir.xz),1e-3); float fd=max(dot(dh,fd2),0.0);
          float pat=smoothstep(0.68,0.9,n3(vec3(dh*1.4,vW.y*0.006-uTime*0.2)+11.0))*(0.65+0.35*sin(uTime*5.0+dh.x*9.0));
          vec3 fl=uFlashC*(uFlash*pow(fd,7.0)*(0.4+1.2*big)+uBloom*pat*0.5*(0.3+big));
          col+=fl*(0.5+top); far+=fl*0.45; vec3 oc=mix(far,col,al); float a=max(al,uFarA); if(a<0.02) discard;
          oc=mix(oc,uFog,smoothstep(-200.0,-420.0,vW.y)); gl_FragColor=vec4(oc,a); }` });
    S.cw = new THREE.Mesh(new THREE.CylinderGeometry(78, 78, 640, 72, 1, true), S.cwM); S.cw.position.y = -110; S.cw.renderOrder = -50; S.cw.frustumCulled = false; g.add(S.cw);

    // the play plane: a dark glassy disc (so the player and telegraphs read) and the bright boundary ring
    S.discM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(L0.disc) }, uA: { value: L0.discA }, uShim: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uTime,uA,uShim; uniform vec3 uCol; varying vec2 vP; ${NOISE2} void main(){ float r=length(vP)/${R.toFixed(1)}; float rings=0.5+0.5*sin(r*48.0-uTime*2.0);
        float cr=abs(n(vP*0.16+vec2(uTime*0.6,-uTime*0.4))-0.5)+abs(n(vP*0.37-vec2(uTime*0.9,0.0))-0.5)*0.5; float ln=(1.0-smoothstep(0.0,0.035,cr))*uShim*(0.4+0.6*step(0.45,fract(sin(floor(uTime*14.0)*7.13)*43.7)));
        float e=smoothstep(1.0,0.975,r); float a=uA*(0.6+0.4*smoothstep(0.1,1.0,r))*(0.88+0.12*rings)*e; gl_FragColor=vec4(uCol*(1.0+1.2*smoothstep(0.75,1.0,r))+vec3(0.55,0.6,1.0)*ln*1.4,min(1.0,a+ln*0.45*e)); }` });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 64), S.discM); disc.rotation.x = -PI / 2; disc.position.y = -0.02; disc.renderOrder = 1; g.add(disc);
    S.rimM = W.glow(0xdcecff, 1.4); const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 5, 96), S.rimM); rim.rotation.x = PI / 2; g.add(rim);
    // rushing air: soft, long, feathered wisps on the shaft wall (periodic noise, no hard strip edges), faded near the camera
    S.wallM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uA: { value: L0.wisp }, uFlash: { value: 0 }, uCol: { value: new THREE.Color(L0.streak) } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform float uTime,uA,uFlash; uniform vec3 uCol; varying vec2 vUv; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p,float K){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float i0=mod(i.x,K), i1=mod(i.x+1.0,K); return mix(mix(h(vec2(i0,i.y)),h(vec2(i1,i.y)),f.x),mix(h(vec2(i0,i.y+1.0)),h(vec2(i1,i.y+1.0)),f.x),f.y); }
        void main(){ float y=vW.y; float w1=n(vec2(vUv.x*240.0,y*0.14-uTime*6.5),240.0), w3=n(vec2(vUv.x*14.0+7.0,y*0.03-uTime*0.9),14.0);
          float a=pow(smoothstep(0.74,1.0,w1),2.0)*smoothstep(0.35,0.8,w3);
          a*=smoothstep(-44.0,-12.0,y)*smoothstep(44.0,10.0,y)*smoothstep(12.0,30.0,length(vW-cameraPosition));
          gl_FragColor=vec4(uCol*a*uA*(1.0+uFlash*1.5),1.0); }` });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.4, R + 0.4, 90, 96, 1, true), S.wallM); wall.renderOrder = 4; g.add(wall);
    S.streaks = W.motes({ n: 420, box: [70, 70, 70], color: 0xffffff, size: 0.26, vel: [0, 48, 0], sway: 0.2, center: [0, 0, 0], streak: true, alpha: L0.mote }); S.streaks.visible = false; g.add(S.streaks);
    // heavy diagonal rain streaks (act 3), one draw call, wrapped around the camera
    { const NR = Math.round(3600 * Math.max(0.4, G.q.part)), P = new Float32Array(NR * 12), Q = new Float32Array(NR * 8), SD = new Float32Array(NR * 4), ix = [];
      for (let i = 0; i < NR; i++) { const x = vrand() * 80, y = vrand() * 80, z = vrand() * 80, s = vrand(); for (let k = 0; k < 4; k++) { P.set([x, y, z], i * 12 + k * 3); SD[i * 4 + k] = s; } Q.set([-1, 0, 1, 0, 1, 1, -1, 1], i * 8); const a = i * 4; ix.push(a, a + 1, a + 2, a, a + 2, a + 3); }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(P, 3)); rg.setAttribute('aQ', new THREE.BufferAttribute(Q, 2)); rg.setAttribute('aS', new THREE.BufferAttribute(SD, 1)); rg.setIndex(ix); rg.boundingSphere = new THREE.Sphere(new V3(), 1e6);
      S.rainM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uA: { value: 0 }, uCol: { value: new THREE.Color(0xd8ecff) }, uVel: { value: new V3(30, 40, 14) } },
        vertexShader: `uniform float uTime; uniform vec3 uVel; attribute vec2 aQ; attribute float aS; varying vec2 vQ; varying float vN;
          void main(){ vec3 box=vec3(80.0); vec3 vel=uVel*(0.8+aS*0.4); vec3 p=mod(position+vel*uTime-cameraPosition+box*0.5,box)-box*0.5+cameraPosition;
            vec3 D=vel/max(length(vel),1e-4); p+=D*(aQ.y-0.5)*(2.0+aS*2.5); vec3 vd=p-cameraPosition; vec3 sd=cross(D,vd); sd/=max(length(sd),1e-4); p+=sd*aQ.x*0.075*(1.0+aS);
            vQ=aQ; vN=smoothstep(2.0,9.0,length(vd)); gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0); }`,
        fragmentShader: 'uniform float uA; uniform vec3 uCol; varying vec2 vQ; varying float vN; void main(){ float a=(1.0-abs(vQ.x))*sin(clamp(vQ.y,0.0,1.0)*3.14159)*vN*uA; gl_FragColor=vec4(uCol*a*1.6,1.0); }' });
      S.rain = new THREE.Mesh(rg, S.rainM); S.rain.frustumCulled = false; S.rain.renderOrder = 41; g.add(S.rain); }

    // soft cloud masses pouring upward past the shaft: lumpy edges, shaded undersides, lit tops
    S.puffM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uLit: { value: new THREE.Color(L0.cloud) }, uShade: { value: new THREE.Color(L0.shade) }, uFog: { value: new THREE.Color(L0.fog) }, uA: { value: L0.cop }, uFogD: { value: L0.dens }, uFlash: { value: 0 }, uFlashC: { value: new THREE.Color(0x9aa8e8) } },
      vertexShader: 'varying vec2 vUv; varying float vS, vD; void main(){ vUv=uv; vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.0); vS=fract(instanceMatrix[3].x*0.137+instanceMatrix[3].z*0.071); vec4 mv=viewMatrix*wp; vD=-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: `uniform vec3 uLit,uShade,uFog,uFlashC; uniform float uA,uFogD,uFlash; varying vec2 vUv; varying float vS, vD; ${NOISE2}
        void main(){ vec2 c=vUv-0.5; float bn=n(c*3.0+vS*17.0)*0.6+n(c*7.0+vS*5.0)*0.4; float r=length(c*vec2(1.0,0.85))*2.0+(bn-0.5)*0.45; float a=smoothstep(1.0,0.8,r)*smoothstep(0.5,0.38,length(c)+(bn-0.5)*0.12);
          float lit=smoothstep(-0.1,0.3,c.y+(bn-0.5)*0.5); vec3 col=mix(uShade,uLit,lit)+uLit*0.25*smoothstep(0.45,0.9,r)*lit+uFlashC*uFlash*(0.2+0.8*bn);
          float fg=1.0-exp(-pow(max(uFogD*vD,0.0),2.0)); col=mix(col,uFog,clamp(fg,0.0,1.0)); gl_FragColor=vec4(col,a*uA); }` });
    const vr = mulberry(77); S.NC = Math.round(90 * Math.max(0.5, G.q.part)); S.puffI = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), S.puffM, S.NC); S.puffI.frustumCulled = false; S.puffI.renderOrder = 3; g.add(S.puffI);
    S.puffs = Array.from({ length: S.NC }, () => ({ a: vr() * TAU, d: 54 + vr() * 20, y: vr() * 320 - 160, v: 38 + vr() * 26, s: 14 + vr() * 30 }));

    // cloud deck: the top of the storm below (act 1), the ceiling above (act 3)
    S.deckM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(L0.deckC) }, uDark: { value: new THREE.Color(L0.deckD) }, uA: { value: 1 }, uFlash: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uTime,uA,uFlash; uniform vec3 uCol,uDark; varying vec2 vP; ${NOISE2}
        void main(){ vec2 q=vP*0.006+uTime*0.01; float v=n(q)*0.5+n(q*2.3+4.0)*0.3+n(q*5.1+9.0)*0.2; float e=1.0-smoothstep(500.0,1100.0,length(vP));
          float a=smoothstep(0.25,0.62,v)*e*uA*(1.0-smoothstep(45.0,76.0,length(vP))); vec3 col=mix(uDark,uCol,smoothstep(0.38,0.85,v))+vec3(0.6,0.62,0.9)*uFlash*v*v; gl_FragColor=vec4(col,a); }` });
    S.deck = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), S.deckM); S.deck.rotation.x = -PI / 2; S.deck.position.y = -260; S.deck.renderOrder = 2; g.add(S.deck);

    // the ground: a coast of islands, far below, and the rocks that stand in its sea
    const tc = document.createElement('canvas'); tc.width = tc.height = 1024; const tx = tc.getContext('2d'); tx.fillStyle = '#1c4c6c'; tx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 260; i++) { tx.fillStyle = `rgba(${40 + vr() * 30 | 0},${100 + vr() * 40 | 0},${130 + vr() * 40 | 0},0.25)`; tx.beginPath(); tx.ellipse(vr() * 1024, vr() * 1024, 20 + vr() * 90, 6 + vr() * 20, vr() * PI, 0, TAU); tx.fill(); }
    for (let i = 0; i < 46; i++) { const x = vr() * 1024, y = vr() * 1024, r = 8 + vr() * vr() * 90; if (Math.hypot(x - 512, y - 512) < 40) continue; for (const [k, col] of [[1.25, '#7ac0c8'], [1.1, '#d8c890'], [1, '#4a7a3a'], [0.6, '#3a6430'], [0.3, '#6a6a58']]) { tx.fillStyle = col; tx.beginPath(); for (let j = 0; j <= 14; j++) { const a = j / 14 * TAU, rr = r * k * (0.75 + 0.3 * Math.sin(a * 3 + i) + 0.15 * Math.sin(a * 7 + i * 2)); tx[j ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } tx.fill(); } }
    const terT = new THREE.CanvasTexture(tc); terT.colorSpace = THREE.SRGBColorSpace; terT.anisotropy = 4;
    S.ground = new THREE.Group(); S.ground.position.y = -2430; g.add(S.ground);
    const ac = document.createElement('canvas'); ac.width = ac.height = 256; const ax = ac.getContext('2d'), agr = ax.createRadialGradient(128, 128, 30, 128, 128, 128); agr.addColorStop(0, '#fff'); agr.addColorStop(1, '#000'); ax.fillStyle = agr; ax.fillRect(0, 0, 256, 256);
    S.terM = new THREE.MeshBasicMaterial({ map: terT, color: 0xffffff, alphaMap: new THREE.CanvasTexture(ac), transparent: true }); const ter = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), S.terM); ter.rotation.x = -PI / 2; ter.renderOrder = -60; S.ground.add(ter);
    const rockM = W.mat({ color: 0x5a564e, roughness: 0.95 }); S.gRockM = W.mat({ color: 0x5a564e, roughness: 0.95 }); const NS = 36, spI = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), S.gRockM, NS);
    for (let i = 0; i < NS; i++) { const a = vr() * TAU, d = 30 + vr() * 380, h = 40 + vr() * 150; _m.position.set(Math.sin(a) * d, h / 2, Math.cos(a) * d); _m.scale.set(8 + vr() * 16, h, 8 + vr() * 16); _m.rotation.set((vr() - 0.5) * 0.15, vr() * 6, (vr() - 0.5) * 0.15); _m.updateMatrix(); spI.setMatrixAt(i, _m.matrix); } spI.frustumCulled = false; S.ground.add(spI);

    // slabs that rise from below, each with one hole
    S.rockRim = new THREE.Color(0x000000); const rimRock = (m) => { m.onBeforeCompile = (sh) => { sh.uniforms.uRR = { value: S.rockRim }; sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRR;\nvoid main() {').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRR * pow(max(fr, 0.0), 2.5); }'); }; m.customProgramCacheKey = () => 'anzuRock'; return m; };
    const slabM = rimRock(W.mat({ color: 0x77706a, roughness: 0.9 })), mossM = rimRock(W.mat({ color: 0x5c7a48, roughness: 1 })); S.slabM = slabM; S.mossM = mossM;
    S.slabs = HOLE_D.map((d, i) => { const sh = new THREE.Shape(); sh.absarc(0, 0, 27, 0, TAU, false); const ho = new THREE.Path(); ho.absarc(0, d, 3.7, 0, TAU, true); sh.holes.push(ho);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 4, bevelEnabled: false, curveSegments: 40 }); geo.rotateX(-PI / 2); const m = new THREE.Mesh(geo, [mossM, slabM]); m.visible = false; m.frustumCulled = false; g.add(m);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.16, 6, 36), W.glow(GOLD, 2.0)); lip.rotation.x = PI / 2; lip.position.set(0, 4.05, -d); m.add(lip);
      for (let k = 0; k < 9; k++) { const a = vr() * TAU, r = 19 + vr() * 6, rk = new THREE.Mesh(new THREE.ConeGeometry(1.5 + vr() * 2, 5 + vr() * 9, 6), slabM); rk.position.set(Math.sin(a) * r, -2 - vr() * 3, Math.cos(a) * r); rk.rotation.x = PI; m.add(rk); }
      return { m, d, on: false, fire: 0, a0: 0, w: 0 }; });
    // spires (act 3) and thermals
    const spM = rimRock(W.mat({ color: 0x4a4458, roughness: 0.85 })); S.spM = spM; S.spires = Array.from({ length: 7 }, () => { const m = new THREE.Mesh(new THREE.ConeGeometry(2.6, 34, 7), spM); m.visible = false; g.add(m); return { m, on: false, fire: 0, x: 0, z: 0 }; });
    // thermal: a bright rim at the ring, rising filaments inside, soft silhouette and top, nearly clear fill
    S.thermM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(GOLD) } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW, vN; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=mat3(modelMatrix)*normal; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec2 vUv; varying vec3 vW, vN;
        float h(float x){ return fract(sin(x*12.9898)*43758.5453); }
        void main(){ vec3 v=cameraPosition-vW; float dl=length(v); v/=max(dl,1e-3); vec3 nn=vN/max(length(vN),1e-4); float nv=abs(dot(nn,v)); float y=vW.y;
          float col=floor(vUv.x*28.0), fx=fract(vUv.x*28.0), s=h(col); float line=pow(max(sin(fx*3.14159),0.0),18.0);
          float dash=fract(y*(0.08+s*0.2)-uTime*(1.2+s*1.3)+s*9.0), dl2=0.3+0.5*h(col+3.0); float fil=line*smoothstep(0.0,0.2,dash)*smoothstep(dl2+0.2,dl2,dash)*step(0.5,s);
          float c2=floor(vUv.x*44.0), s2=h(c2+11.0), sk=fract(y*0.05-uTime*(0.9+s2)+s2*5.0); float spark=pow(max(sin(fract(vUv.x*44.0)*3.14159),0.0),30.0)*smoothstep(0.95,0.99,sk)*step(0.6,s2)*3.0;
          float base=exp(-abs(y-0.05)*2.2)*1.1+exp(-abs(y-${LIFT.toFixed(1)})*2.0)*0.3;
          float up=smoothstep(-3.5,-0.3,y)*(1.0-smoothstep(3.0,20.0,y));
          float a=(0.03+(fil*0.4+spark)*smoothstep(5.0,15.0,dl)+base*0.55)*up*smoothstep(0.0,0.5,nv)*smoothstep(2.5,9.0,dl); gl_FragColor=vec4(uCol*a,1.0); }` });
    S.therm = [0, 1].map((i) => { const grp = new THREE.Group(); g.add(grp); const col = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.3, 44, 40, 1, true), S.thermM); col.position.y = 2; col.renderOrder = 5; grp.add(col);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.09, 5, 40), W.glow(GOLD, 1.8)); ring.rotation.x = PI / 2; ring.position.y = 0.05; grp.add(ring); const ring2 = ring.clone(); ring2.position.y = LIFT; ring2.scale.setScalar(0.8); grp.add(ring2);
      return { grp, a: i * PI + 0.6, r: i ? 9.5 : 7, x: 0, z: 0, k: 1 }; });
    S.charge = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 10), W.glow(0xe8f2ff, 4)); S.charge.position.set(0, 24, 0); S.charge.visible = false; g.add(S.charge);
    S.chargeL = new THREE.PointLight(0xcfe0ff, 0, 80, 1.4); S.chargeL.position.set(0, 20, 0); g.add(S.chargeL);
    // lightning: camera-facing ribbons with a white-hot core and a blue-violet halo, plus a soft ground flash where they land
    const NBS = 24, boltVS = 'attribute vec2 aQ; varying vec2 vQ; void main(){ vQ=aQ; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
    S.bolts = Array.from({ length: 22 }, () => { const bgm = new THREE.BufferGeometry(), nv = (NBS + 1) * 2, q = new Float32Array(nv * 2), ix = []; for (let i = 0; i <= NBS; i++) q.set([i / NBS, -1, i / NBS, 1], i * 4); for (let i = 0; i < NBS; i++) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      bgm.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3)); bgm.setAttribute('aQ', new THREE.BufferAttribute(q, 2)); bgm.setIndex(ix); bgm.boundingSphere = new THREE.Sphere(new V3(), 1e6);
      const mt = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 0 }, uCore: { value: new THREE.Color() }, uHalo: { value: new THREE.Color() } }, vertexShader: boltVS,
        fragmentShader: 'uniform float uA; uniform vec3 uCore,uHalo; varying vec2 vQ; void main(){ float x=abs(vQ.y); float core=1.0-smoothstep(0.05,0.2,x); float halo=pow(max(1.0-x,0.0),2.5); gl_FragColor=vec4((uCore*core*2.6+uHalo*halo*0.7)*uA,1.0); }' });
      const m = new THREE.Mesh(bgm, mt); m.visible = false; m.frustumCulled = false; m.renderOrder = 40; g.add(m); return { m, t0: -9, dur: 0.2, s: 0 }; });
    const gfG = new THREE.PlaneGeometry(1, 1); gfG.rotateX(-PI / 2);
    S.gfl = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(gfG, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 0 }, uCol: { value: new THREE.Color(0xb0c0ff) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform float uA; uniform vec3 uCol; varying vec2 vUv; void main(){ float r=length(vUv-0.5)*2.0; float a=pow(max(1.0-r,0.0),2.2)*uA; gl_FragColor=vec4(uCol*a*1.6,1.0); }' }));
      m.visible = false; m.frustumCulled = false; m.renderOrder = 39; g.add(m); return { m, t0: -9, s: 4 }; });
    // the door that falls at the end
    S.door = new THREE.Group(); S.door.visible = false; g.add(S.door); const fr = new THREE.Mesh(new THREE.BoxGeometry(3.2, 6.4, 0.4), W.mat({ color: 0x15161e, roughness: 0.4, metalness: 0.7 })); S.door.add(fr); const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 5.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c0).multiplyScalar(2.2) })); pane.position.z = 0.21; S.door.add(pane);

    // Anzu: storm-slate plumage, dark root to pale tip, iridescent sheen, hot rim, electric veins along the shafts
    const bg = b.group; S.rig = new THREE.Group(); bg.add(S.rig);
    S.pU = { uTipC: { value: new THREE.Color(0x3c4c6e) }, uVeinC: { value: new THREE.Color(L0.veinC) }, uRimC: { value: new THREE.Color(L0.rim).multiplyScalar(0.8) }, uIri: { value: new THREE.Color(0x4a2a9a).multiplyScalar(0.45) }, uVein: { value: L0.vein }, uTime: { value: 0 }, uFadeC: { value: new THREE.Color(0x070a14) }, uPulse: { value: 0 } };
    const plume = (color) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05, transparent: true, side: THREE.DoubleSide, envMapIntensity: 0.4 }); const fade = { value: 0 }; m.userData.fade = fade;
      m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, S.pU); sh.uniforms.uFade = fade;
        sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute vec2 aF; varying vec2 vF; varying float vId, vLen;\nvoid main() { vF = aF;\n#ifdef USE_INSTANCING\n vId = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453); vLen = length(instanceMatrix[2].xyz);\n#else\n vId = 0.5; vLen = 0.0;\n#endif\n');
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uTipC, uVeinC, uRimC, uIri, uFadeC; uniform float uVein, uFade, uTime, uPulse; varying vec2 vF; varying float vId, vLen;\nvoid main() {')
          .replace('#include <color_fragment>', '#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb *= 0.55;\n diffuseColor.rgb = mix(diffuseColor.rgb, uTipC * (diffuseColor.rgb / max(diffuse, vec3(1e-3))), smoothstep(0.15, 1.0, vF.x));')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            { vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float nv = clamp(abs(dot(normal, vv)), 0.0, 1.0), fr = 1.0 - nv;
              float shaft = 1.0 - smoothstep(0.0, 0.045, abs(vF.y - 0.5)); float fl = 0.65 + 0.35 * sin(uTime * 23.0 + vF.x * 31.0); float tr = fract(uTime * 0.9 + vId * 7.0), wv = exp(-((vF.x - tr) * 5.0) * ((vF.x - tr) * 5.0)), on = step(0.7, fract(vId * 13.7 + floor(uTime * 1.7 + vId * 3.0) * 0.618)); float lw = smoothstep(2.5, 5.5, vLen), hot = wv * on;
              float pz = mix(1.0, (0.06 + hot * 1.8) * (0.25 + 0.75 * lw), uPulse); vec3 vc = mix(uVeinC, mix(vec3(0.3, 0.5, 1.0), uVeinC, hot), uPulse);
              totalEmissiveRadiance += (1.0 - smoothstep(0.0, 0.5, uFade)) * (uRimC * pow(max(fr, 0.0), 3.0) + uIri * pow(max(fr, 0.0), 1.5) * (0.5 + 0.5 * sin(nv * 9.0 + vF.x * 4.0)) + vc * pz * uVein * shaft * smoothstep(0.08, 0.5, vF.x) * (1.0 - smoothstep(0.85, 1.0, vF.x)) * fl); }`)
          .replace('#include <opaque_fragment>', '{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); outgoingLight = mix(outgoingLight, uFadeC + uRimC * 0.5 * pow(max(fr, 0.0), 4.0), smoothstep(0.0, 0.6, uFade)); diffuseColor.a = mix(1.0, 0.4, uFade); }\n#include <opaque_fragment>'); };
      m.customProgramCacheKey = () => 'anzuPlume'; return m; };
    const mB = plume(0x1a2034), mW = [plume(0x161d30), plume(0x161d30)]; S.fadeM = [mW[0], mW[1], mB];
    const goldM = W.mat({ color: 0xc89040, roughness: 0.58, metalness: 0.4 }), clawM = W.mat({ color: 0x15120e, roughness: 0.4 }), trim = W.glow(STORM, 2.6); S.eyeM = W.glow(0xfff8d0, 4);
    const FG = featherGeo(), fcol = (im, i) => { const v = 0.82 + vr() * 0.32; im.setColorAt(i, _c.setRGB(v, v, v * (0.95 + vr() * 0.1))); };
    const body = new THREE.Mesh(withF(new THREE.SphereGeometry(1, 22, 16), (x, y) => clamp(0.35 - y * 0.45, 0, 0.8)), mB); body.scale.set(1.5, 1.28, 2.8); body.position.y = 2; S.rig.add(body);
    // breast feathers layered over the chest and belly, and a ruff around the neck
    const brI = new THREE.InstancedMesh(FG, mB, 35 + 16 + 30 + 12); let bi = 0;
    for (let r = 0; r < 3; r++) for (let c = -1; c <= 2; c++) { const zz = 0.4 - r * 0.8, sc = Math.sqrt(Math.max(0.05, 1 - (zz / 2.8) ** 2)), an = PI + (c - 0.5) * 0.3; const px = Math.sin(an) * 1.5 * sc, py = 2 - Math.cos(an) * 1.28 * sc;
      place(brI, bi, px, py + 0.05, zz, px / 2.25, (py - 2) / 1.64, zz / 7.84, 0, 0.1, -1, 1.1, 1.6); fcol(brI, bi++); }
    for (let r = 0; r < 5; r++) for (let c = -3; c <= 3; c++) { const zz = 2.25 - r * 0.55 + (c & 1) * 0.12, sc = Math.sqrt(Math.max(0.05, 1 - (zz / 2.8) ** 2)), an = c * 0.42; const px = Math.sin(an) * 1.5 * sc, py = 2 - Math.cos(an) * 1.28 * sc;
      place(brI, bi, px, py, zz, px / 2.25, (py - 2) / 1.64, zz / 7.84, 0, -0.3, -1, 0.8, 1.05); fcol(brI, bi++); }
    for (let r = 0; r < 5; r++) for (let c = -3; c <= 2; c++) { const zz = 1.7 - r * 0.75 + (c & 1) * 0.15, sc = Math.sqrt(Math.max(0.05, 1 - (zz / 2.8) ** 2)), an = PI + (c + 0.5) * 0.4; const px = Math.sin(an) * 1.5 * sc, py = 2 - Math.cos(an) * 1.28 * sc;
      place(brI, bi, px, py, zz, px / 2.25, (py - 2) / 1.64, zz / 7.84, 0, 0.1, -1, 0.95, 1.3); fcol(brI, bi++); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, ca = Math.cos(a), sa = Math.sin(a); place(brI, bi, ca * 0.95, 2.75 + sa * 0.85, 2.15, ca, sa, 0.4, ca * 0.5, sa * 0.5, -1, 0.7, 1.45); fcol(brI, bi++); }
    S.rig.add(brI);
    S.neck = new THREE.Group(); S.neck.position.set(0, 2.5, 2.1); S.rig.add(S.neck);
    const head = new THREE.Mesh(withF(new THREE.SphereGeometry(0.85, 16, 12), (x, y) => clamp(0.3 - y * 0.3, 0, 0.6)), mB); head.scale.set(1, 0.95, 1.3); head.position.set(0, 0.5, 0.7); S.neck.add(head);
    { const hI = new THREE.InstancedMesh(FG, mB, 30); let hi = 0; for (let r = 0; r < 5; r++) for (let c = -2; c <= 3; c++) { const zz = 0.7 + 0.9 - r * 0.42, an = PI + (c - 0.5) * 0.5 + (r & 1) * 0.25, rz = (zz - 0.7) / 1.1, sc = Math.sqrt(Math.max(0.08, 1 - rz * rz)), px = Math.sin(an) * 0.85 * sc, py = 0.5 - Math.cos(an) * 0.81 * sc;
        place(hI, hi, px, py, zz, px / 0.72, (py - 0.5) / 0.65, (zz - 0.7) / 1.21, 0, 0.15, -1, 0.42 + r * 0.04, 0.55 + r * 0.08); fcol(hI, hi++); } S.neck.add(hI); }
    for (const sx of [-1, 1]) { const ck = new THREE.Mesh(withF(new THREE.SphereGeometry(0.4, 10, 8), () => 0.45), mB); ck.scale.set(0.7, 0.8, 1.3); ck.position.set(sx * 0.62, 0.32, 1.15); S.neck.add(ck); }
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.7, 6), goldM); beak.rotation.x = PI / 2 + 0.25; beak.position.set(0, 0.3, 2.0); S.neck.add(beak);
    for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), S.eyeM); eye.position.set(sx * 0.6, 0.7, 1.25); S.neck.add(eye);
      const brow = new THREE.Mesh(withF(new THREE.ConeGeometry(0.22, 1.1, 5)), mB); brow.scale.set(1.3, 1, 0.6); brow.position.set(sx * 0.5, 0.98, 1.12); brow.rotation.set(-1.35, 0, sx * 0.3); S.neck.add(brow);
      const cr = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.6, 5), trim); cr.position.set(sx * 0.3, 1.4, 0.1); cr.rotation.x = -0.7; S.neck.add(cr);
      const cr2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.1, 5), trim); cr2.position.set(sx * 0.55, 1.1, -0.25); cr2.rotation.set(-1.1, 0, -sx * 0.3); S.neck.add(cr2); }
    S.crest = new THREE.Object3D(); S.crest.position.set(0, 2.0, -0.3); S.neck.add(S.crest); S.bodyP = new THREE.Object3D(); S.bodyP.position.set(0, 2, -0.3); S.rig.add(S.bodyP); S.headP = new THREE.Object3D(); S.headP.position.set(0, 0.6, 0.8); S.neck.add(S.headP);
    // wings: a sculpted arm with a shoulder, lesser coverts over the leading edge, coverts over long primaries/secondaries
    S.wings = [-1, 1].map((sx, wi) => { const mt = mW[wi], sh = new THREE.Group(); sh.position.set(sx * 1.15, 2.7, 0.6); S.rig.add(sh); const el = new THREE.Group(); el.position.x = sx * 4.6; sh.add(el);
      const shoulder = new THREE.Mesh(withF(new THREE.SphereGeometry(0.85, 12, 10)), mt); shoulder.scale.set(1.3, 0.8, 1.15); shoulder.position.x = sx * 0.3; sh.add(shoulder);
      const arm = new THREE.Mesh(withF(new THREE.CylinderGeometry(0.4, 0.62, 4.8, 12)), mt); arm.rotation.z = -sx * PI / 2; arm.scale.set(0.62, 1, 1); arm.position.x = sx * 2.4; sh.add(arm);
      const fore = new THREE.Mesh(withF(new THREE.CylinderGeometry(0.2, 0.4, 4.9, 10)), mt); fore.rotation.z = -sx * PI / 2; fore.scale.set(0.6, 1, 1); fore.position.x = sx * 2.4; el.add(fore);
      const wrap = (par, x0, x1, r0, r1, n) => { const im = new THREE.InstancedMesh(FG, mt, n * 4 + 1); let k = 0; for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const t = (i + (j & 1) * 0.5) / n, x = lerp(x0, x1, t), rr = lerp(r0, r1, t), th = -0.25 + j * 0.4, ny = Math.cos(th), nz = Math.sin(th);
          place(im, k, sx * x, ny * rr * 0.62, nz * rr, 0, ny * 0.62, nz, sx * 0.3, 0, -1, 0.5 + rr * 0.4, 0.8 + rr * 0.9, 0.12); fcol(im, k++); } im.count = k; par.add(im); };
      wrap(sh, 0.4, 4.8, 0.66, 0.44, 12); wrap(el, 0.0, 4.9, 0.44, 0.24, 12);
      { const im = new THREE.InstancedMesh(FG, mt, 12); for (let i = 0; i < 12; i++) { const a = i / 11 * PI, ny = Math.sin(a), nz = Math.cos(a); place(im, i, sx * (0.2 + 0.25 * ny), 0.6 * ny + 0.1, 0.95 * nz, sx * 0.3, ny, nz, sx * 0.7, 0, -1, 1.0, 1.5); fcol(im, i); } sh.add(im); }
      
      const row = (par, n, rows) => { const im = new THREE.InstancedMesh(FG, mt, n); let k = 0; for (const [cnt, f] of rows) for (let i = 0; i < cnt; i++) { const t = cnt > 1 ? i / (cnt - 1) : 0, o = f(t, i); _m.position.set(sx * o.x, o.y, o.z); _m.rotation.order = 'YXZ'; _m.rotation.set(-o.d, -sx * o.yaw, 0); _m.scale.set(o.w, o.l * 0.4, o.l); _m.updateMatrix(); im.setMatrixAt(k, _m.matrix); fcol(im, k++); } par.add(im); return im; };
      row(sh, 11 + 11 + 14, [[11, (t, i) => ({ x: 0.7 + t * 3.9, y: -0.2 + (i & 1) * 0.035, z: -0.15, yaw: 0.02 + t * 0.08, d: 0.06, w: 1.4, l: 3.6 + 0.35 * Math.sin(t * PI) })],
        [11, (t, i) => ({ x: 0.5 + t * 4.1, y: 0.06 + (i & 1) * 0.02, z: -0.05, yaw: 0.03 + t * 0.08, d: 0.1, w: 1.2, l: 2.0 })], [14, (t, i) => ({ x: 0.2 + t * 4.4, y: 0.3 + (i & 1) * 0.02, z: 0.6, yaw: 0.05, d: 0.28, w: 0.95, l: 1.35 })]]);
      row(el, 11 + 10 + 10, [[11, (t, i) => ({ x: 0.3 + t * 4.7, y: -0.18 + (i & 1) * 0.035, z: -0.1, yaw: 0.1 + t * 0.78, d: 0.04, w: 1.35 - t * 0.3, l: 3.9 + 2.8 * t - (i === 10 ? 0.6 : 0) })],
        [10, (t, i) => ({ x: 0.2 + t * 4.6, y: 0.07 + (i & 1) * 0.02, z: -0.02, yaw: 0.08 + t * 0.55, d: 0.08, w: 1.15, l: 2.1 })], [10, (t, i) => ({ x: 0.0 + t * 4.8, y: 0.24 + (i & 1) * 0.02, z: 0.42, yaw: 0.06 + t * 0.2, d: 0.26, w: 0.8, l: 1.1 })]]);
      const tip = new THREE.Object3D(); tip.position.set(sx * 9.4, 0, -4.6); el.add(tip); const mid = new THREE.Object3D(); mid.position.set(sx * 2.5, 0, -1.8); sh.add(mid); const hand = new THREE.Object3D(); hand.position.set(sx * 3.2, 0, -2.6); el.add(hand);
      return { sh, el, sx, tip, mid, hand, m: mt }; });
    S.tail = new THREE.Group(); S.tail.position.set(0, 2, -2.4); S.rig.add(S.tail);
    { const im = new THREE.InstancedMesh(FG, mB, 9 + 7); for (let i = 0; i < 16; i++) { const cov = i >= 9, t = cov ? (i - 9) / 6 : i / 8, L = cov ? 2.0 : 4.6 - Math.abs(t - 0.5) * 1.8; _m.position.set((t - 0.5) * (cov ? 1.2 : 1.6), cov ? 0.14 : (i & 1) * 0.035, cov ? 0.3 : 0); _m.rotation.order = 'YXZ'; _m.rotation.set(0.05, (t - 0.5) * (cov ? 0.7 : 1.0), 0); _m.scale.set(cov ? 0.85 : 1.0, L * 0.4, L); _m.updateMatrix(); im.setMatrixAt(i, _m.matrix); fcol(im, i); } S.tail.add(im); }
    // feathered thighs, gold shanks and hooked talons tucked under
    for (const sx of [-1, 1]) { const th = new THREE.Mesh(withF(new THREE.SphereGeometry(0.5, 10, 8), () => 0.5), mB); th.scale.set(1, 1.3, 1.1); th.position.set(sx * 0.75, 1.0, -0.4); S.rig.add(th);
      const shk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.0, 6), goldM); shk.position.set(sx * 0.78, 0.4, -0.7); shk.rotation.x = 0.7; S.rig.add(shk);
      for (const j of [-1, 0, 1]) { const cl = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.055, 4, 8, PI * 0.9), clawM); cl.position.set(sx * 0.78 + j * 0.16, 0.05, -0.95); cl.rotation.set(0, PI / 2 + j * 0.35, 0); S.rig.add(cl); } }
    S.rig.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 30; } });
    S.aura = new THREE.PointLight(STORM, 8, 26, 1.6); S.aura.position.set(0, 6.5, 0); bg.add(S.aura);
    // wind trails off the wing tips, streaming upward as we fall
    S.trailM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uA: { value: L0.trail }, uCol: { value: new THREE.Color(0xd8e6ff) } }, vertexShader: boltVS,
      fragmentShader: 'uniform float uA; uniform vec3 uCol; varying vec2 vQ; void main(){ float a=pow(max(1.0-vQ.x,0.0),1.6)*smoothstep(0.0,0.08,vQ.x)*(1.0-vQ.y*vQ.y)*uA; gl_FragColor=vec4(uCol*a,1.0); }' });
    S.trails = S.wings.map(() => { const NT = 22, tg = new THREE.BufferGeometry(), q = new Float32Array(NT * 4), ix = []; for (let i = 0; i < NT; i++) q.set([i / (NT - 1), -1, i / (NT - 1), 1], i * 4); for (let i = 0; i < NT - 1; i++) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 6), 3)); tg.setAttribute('aQ', new THREE.BufferAttribute(q, 2)); tg.setIndex(ix); tg.boundingSphere = new THREE.Sphere(new V3(), 1e6);
      const m = new THREE.Mesh(tg, S.trailM); m.frustumCulled = false; m.renderOrder = 38; g.add(m); return { m, h: new Float32Array(NT * 4), NT, init: false }; });

    Object.assign(S, { lvl: 0, lookN: 0, lookK: 1, lift: 0, alt: 0, altT: 0, shut: 0, flap: 0, flapAmp: 1, thunder: 0, shear: 0, deckV: 0, landed: false, flashT: 3, holes: [], tilt: 0, vein: L0.vein, arcT: 0, rimT: 0 });
    return {
      edge: 'wall', spawn: { x: 0, z: 9 }, bossStart: { x: 0, z: -7, face: 0 }, camDist: 19, camPitch: 0.78,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 3,
      clamp(p) { const d = Math.hypot(p.x, p.z); if (d > R - 0.5) { p.x *= (R - 0.5) / d; p.z *= (R - 0.5) / d; } },
      camLimit(x, y, z) { return { x, y: Math.max(y, 1.2), z }; },
    };
  }

  // ---------- lightning ----------
  function zap(S, a, b, o = {}, depth = 0) {
    if (G.headless) return; let B = null, old = null; for (const q of S.bolts) { if (G.now > q.t0 + q.dur) { B = q; break; } if (!old || q.t0 < old.t0) old = q; } B = B || old;
    const arr = B.m.geometry.attributes.position.array, N = 24, w = Math.max(0.42, o.w || 0.5), cp = camera.position, pts = [];
    _w.set(b.x - a.x, b.y - a.y, b.z - a.z); const len = Math.max(_w.length(), 1e-3), jag = Math.min(o.jag === undefined ? 0.9 : o.jag, len * 0.09); _w.multiplyScalar(1 / len);
    _x.set(0, 1, 0); if (Math.abs(_w.y) > 0.9) _x.set(1, 0, 0); _x.cross(_w).normalize(); _y.crossVectors(_w, _x);
    let o1 = 0, o2 = 0; for (let i = 0; i <= N; i++) { const t = i / N, e = Math.pow(Math.sin(t * PI), 0.6); o1 = o1 * 0.55 + (vrand() - 0.5) * 2.2; o2 = o2 * 0.55 + (vrand() - 0.5) * 2.2; const k1 = (o1 + (vrand() - 0.5) * 0.5) * jag * e, k2 = (o2 + (vrand() - 0.5) * 0.5) * jag * e * 0.6;
      pts.push(lerp(a.x, b.x, t) + _x.x * k1 + _y.x * k2, lerp(a.y, b.y, t) + _x.y * k1 + _y.y * k2, lerp(a.z, b.z, t) + _x.z * k1 + _y.z * k2); }
    for (let i = 0; i <= N; i++) { const i0 = Math.max(0, i - 1) * 3, i1 = Math.min(N, i + 1) * 3, j = i * 3; _x.set(pts[i1] - pts[i0], pts[i1 + 1] - pts[i0 + 1], pts[i1 + 2] - pts[i0 + 2]); _y.set(pts[j] - cp.x, pts[j + 1] - cp.y, pts[j + 2] - cp.z); _z.crossVectors(_x, _y); const l = _z.length(), ww = w * (0.06 + 0.94 * Math.pow(1 - i / N, 0.7)); if (l < 1e-5) _z.set(ww, 0, 0); else _z.multiplyScalar(ww / l);
      arr.set([pts[j] - _z.x, pts[j + 1] - _z.y, pts[j + 2] - _z.z, pts[j] + _z.x, pts[j + 1] + _z.y, pts[j + 2] + _z.z], i * 6); }
    B.m.geometry.attributes.position.needsUpdate = true; B.t0 = G.now; B.dur = o.dur || 0.25; B.s = vrand(); B.m.visible = true; B.m.material.uniforms.uCore.value.set(o.core || 0xffffff); B.m.material.uniforms.uHalo.value.set(o.halo || 0x7a70ff); B.m.material.uniforms.uA.value = 1;
    if (o.flash) { let F = S.gfl[0]; for (const q of S.gfl) if (q.t0 < F.t0) F = q; F.t0 = G.now; F.s = o.flash; F.m.position.set(b.x, Math.max(0.03, b.y - 0.5), b.z); F.m.visible = true; }
    if (depth === 0 && o.fork !== 0 && len > 4) { const nf = o.fork || 1 + (vrand() < 0.5 ? 1 : 0); for (let f = 0; f < nf; f++) { const i = 5 + Math.floor(vrand() * 12), j = i * 3, fl = len * (0.18 + vrand() * 0.2); const sa = new V3(pts[j], pts[j + 1], pts[j + 2]), dx = pts[j + 3] - pts[j], dy = pts[j + 4] - pts[j + 1], dz = pts[j + 5] - pts[j + 2], dl = Math.max(Math.hypot(dx, dy, dz), 1e-3);
      const eb = new V3(dx / dl + (vrand() - 0.5) * 1.4, dy / dl + (vrand() - 0.5) * 1.4, dz / dl + (vrand() - 0.5) * 1.4).normalize().multiplyScalar(fl).add(sa); zap(S, sa, eb, { w: w * 0.7, jag: jag * 0.6, dur: (o.dur || 0.25) * 0.8, core: o.core, halo: o.halo }, 1); } }
  }

  // ---------- things from below ----------
  function sendSlab(b, i, a0, T, w = 0) {
    const S = b.state, sl = S.slabs[i]; sl.on = true; sl.fire = G.now + T; sl.a0 = a0; sl.w = w; sl.m.visible = true; sl.hit = false;
    const [x, z] = holeAt(sl.d, a0);
    Hz.circle(x, z, 3.2, T, 450, { name: 'Skyfall', color: SAFE, invert: true, blockable: false, lock: 0.02, tag: 'fight', quiet: i > 0 && false,
      track(s) { const q = holeAt(sl.d, sl.a0 + sl.w * Math.min(0, G.now - sl.fire)); s.x = q[0]; s.z = q[1]; }, onFire() { Sound.sfx('boom', 1, 0.5); FX.shake(0.9); } });
    Sound.sfx('charge', 0.6, 0.5);
  }
  function* slab(b, o = {}) {
    const S = b.state, p = G.player, n = o.n || 1, T = o.T || 3.5; let last = null;
    const order = shuffle([0, 1, 2]);
    for (let k = 0; k < n; k++) { const i = order[k]; let a = rnd(TAU);
      for (let t = 0; t < 30; t++) { a = rnd(TAU); const q = holeAt(S.slabs[i].d, a), dp = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z); if (last) { const dl = Math.hypot(q[0] - last[0], q[1] - last[1]); if (dl > 7 && dl < 10.5) break; } else if (dp > 6 && dp < 15) break; }
      last = holeAt(S.slabs[i].d, a); sendSlab(b, i, a, T + k * (o.gap || 1.6), o.spin ? pick([-1, 1]) * o.spin : 0); }
    yield 0;
  }
  function* waitSlabs(b, extra = 0.3) { const S = b.state; while (S.slabs.some((s) => s.on && G.now < s.fire + extra)) yield; }
  function* flock(b, n = 4) {
    const p = G.player; const r = yield* b.cast({ name: 'Flock', time: 0.7 }); if (r !== 'done') return;
    for (let k = 0; k < n; k++) { const a = rnd(TAU), d = k % 2 ? rnd(3, 9) : 0; let x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; const dd = Math.hypot(x, z); if (dd > R - 2) { x *= (R - 2) / dd; z *= (R - 2) / dd; }
      Hz.circle(x, z, 3.3, 1.3, 250, { name: 'Flock', color: 0xffffff, quiet: k > 0, onFire() { if (!G.headless) { FX.pillar(x, z, { r: 3, h: 22, color: 0xffffff, dur: 0.45 }); FX.burst(x, 1, z, { n: 26, color: 0xffffff, color2: 0xc8d8f0, speed: [4, 12], up: 22, life: [0.4, 0.9], size: [0.25, 0.6] }); } Sound.sfx('dash', 0.6, 1.6); } }); yield 0.45; }
    yield 0.9;
  }
  function* hail(b, waves = 2) {
    const r = yield* b.cast({ name: 'Hail', time: 0.7 }); if (r !== 'done') return;
    for (let w = 0; w < waves; w++) { const dir = rnd(PI), off = rnd(-4, 4), sx = Math.sin(dir), sz = Math.cos(dir);
      for (const o of [-16, -8, 0, 8, 16]) { const cx = (o + off) * sz, cz = -(o + off) * sx; Hz.rect(cx - sx * 22, cz - sz * 22, dir, 44, 4.4, 1.4, 260, { name: 'Hail', color: 0xd8ecff, quiet: o !== 0, onFire() { if (!G.headless) for (let k = -3; k <= 3; k++) FX.burst(cx + sx * k * 5, 0.5, cz + sz * k * 5, { n: 10, color: 0xe8f4ff, speed: [2, 8], up: 18, life: [0.25, 0.6], size: [0.2, 0.45] }); Sound.sfx('shatter', 0.5, 1.5); } }); }
      yield 1.9; }
  }
  function* spires(b, n = 5) {
    const S = b.state, p = G.player; const r = yield* b.cast({ name: 'Spires', time: 0.6 }); if (r !== 'done') return;
    for (let k = 0; k < n; k++) { const sp = S.spires.find((q) => !q.on); if (!sp) break; const a = rnd(TAU), d = k % 2 ? rnd(4, 10) : rnd(0, 1.5); let x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; const dd = Math.hypot(x, z); if (dd > R - 2) { x *= (R - 2) / dd; z *= (R - 2) / dd; }
      sp.on = true; sp.fire = G.now + 1.25; sp.x = x; sp.z = z; sp.m.visible = true; sp.m.rotation.y = rnd(TAU);
      Hz.circle(x, z, 3.0, 1.25, 280, { name: 'Spire', color: 0xc8b8a0, quiet: k > 0, onFire() { Sound.sfx('boom', 0.6, 1.3); FX.shake(0.3); } }); yield 0.4; }
    yield 0.9;
  }

  // ---------- Anzu's kit ----------
  function* wingbeat(b) {
    const S = b.state, p = G.player; S.flapAmp = 2.2; const r = yield* b.cast({ name: 'Wingbeat', time: 1.0 }); S.flapAmp = 1; if (r !== 'done') return;
    Sound.sfx('wave', 1, 0.7); FX.shake(0.5); if (!G.headless) FX.ring(b.pos.x, b.pos.z, { r0: 2, r1: 26, color: 0xffffff, dur: 0.5 });
    if (p.alive) { const dir = b.angToPlayer(); const got = p.hurt(60, { kb: { dir, dist: 9 }, src: { name: 'Wingbeat' } }); if (!got && !p.kb) p.kb = { vx: Math.sin(dir) * 9 / 0.38, vz: Math.cos(dir) * 9 / 0.38, t: 0.38 }; }
    yield 0.3;
  }
  function* fan(b, waves = 2) {
    const r = yield* b.cast({ name: 'Featherfall', time: 0.7 }); if (r !== 'done') return;
    for (let w = 0; w < waves; w++) { const p = G.player, sp = Math.max(0.22, 1.7 / Math.max(1, Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z))), dir = b.angToPlayer() + (w % 2 ? sp / 2 : 0); for (let i = -4; i <= 4; i++) Bul.fire({ x: b.pos.x, z: b.pos.z, dir: dir + i * sp, speed: 12.5, r: 0.34, dmg: 95, color: 0xcfe0ff, life: 4 }); Sound.sfx('slash', 0.6, 1.5); yield 0.7; }
    yield 0.3;
  }
  function* dive(b) {
    const S = b.state, p = G.player; b.targetable = false; S.altT = 30; Sound.sfx('dash', 0.8, 0.6);
    const h = Hz.circle(p.pos.x, p.pos.z, 4.3, 1.8, 340, { name: 'Dive', color: STORM, lock: 0.95, track(s) { s.x = p.pos.x; s.z = p.pos.z; }, onFire() { Sound.sfx('boom', 1, 0.7); FX.shake(0.8); } });
    yield 1.6; b.pos.x = h.shape.x; b.pos.z = h.shape.z; S.altT = 0; S.alt = Math.min(S.alt, 26); S.diving = true; yield 0.22; S.alt = 0; S.diving = false;
    if (!G.headless) { FX.ring(b.pos.x, b.pos.z, { r0: 1, r1: 9, color: STORM, dur: 0.4 }); FX.burst(b.pos.x, 1, b.pos.z, { n: 30, color: 0xffffff, speed: [4, 12], life: [0.3, 0.8], size: [0.2, 0.5] }); }
    b.targetable = true; yield 0.8;
  }
  function* strafe(b, n = 1) {
    const S = b.state, p = G.player; b.autoFace = false;
    for (let k = 0; k < n; k++) { const a = angTo(0, 0, p.pos.x, p.pos.z) + PI + rnd(-0.7, 0.7), sx = Math.sin(a) * (R - 1), sz = Math.cos(a) * (R - 1); yield* b.moveTo(sx, sz, 30);
      const dir = angTo(sx, sz, p.pos.x, p.pos.z), len = 2 * R + 2; b.facing = dir;
      Hz.rect(sx, sz, dir, len, 5.6, 1.25, 320, { name: 'Strafe', color: STORM, onFire() { Sound.sfx('dash', 1, 0.5); } }); S.flapAmp = 0.3;
      const r = yield* b.cast({ name: 'Strafe', time: 1.25 }); if (r !== 'done') break;
      const tx = clamp(sx + Math.sin(dir) * len, -99, 99), tz = sz + Math.cos(dir) * len, d = Math.hypot(tx, tz), ex = tx * Math.min(1, (R - 1) / d), ez = tz * Math.min(1, (R - 1) / d);
      for (let t = 0; t < 0.4; t += G.dt) { const q = t / 0.4; b.pos.x = lerp(sx, ex, q); b.pos.z = lerp(sz, ez, q); S.tilt = 0.5; yield; } b.pos.x = ex; b.pos.z = ez; S.tilt = 0; S.flapAmp = 1; yield 0.25; }
    S.flapAmp = 1; b.autoFace = true; yield* b.moveTo(b.pos.x * 0.45, b.pos.z * 0.45, 12); yield 0.3;
  }
  // The Shear: a sheet of lightning across the whole plane. Only being lifted clear of the plane saves you.
  function* shear(b, time = 3.6) {
    const S = b.state, p = G.player; S.shear = 1;
    const h = Hz.circle(0, 0, R + 0.5, time, 0, { name: 'Shear', color: 0x7aa8ff, alpha: 0.22, tag: 'fight' });
    const r = yield* b.cast({ name: 'Shear', time, onTick: (k) => { S.shear = k; } }); S.shear = 0; if (r !== 'done') { Hz.cancel(h); return; }
    Sound.sfx('thunder', 1, 1.2); Sound.sfx('zap', 0.9, 0.6); FX.flash(STORM, 0.05, 2.5); FX.shake(0.7); S.sheet = 1;
    if (!G.headless) for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + rnd(0.5); zap(S, _a.set(Math.sin(a) * R, 0.4, Math.cos(a) * R), _b.set(Math.sin(a + 0.35) * R * 0.3, 0.4, Math.cos(a + 0.35) * R * 0.3), { w: 0.8, jag: 1.8, dur: 0.35, core: 0xdce4ff, halo: 0x5a68e8, flash: 4, fork: 2 }); }
    if (p.alive && S.lift < 0.5) p.hurt(480, { blockable: false, src: { name: 'Shear' } });
    yield 0.7;
  }
  // Thunderhead: the bolt takes whoever is highest.
  function* thunder(b, time = 2.3) {
    const S = b.state, p = G.player; S.thunder = 0.01; Sound.sfx('charge', 0.8, 1.6);
    const r = yield* b.cast({ name: 'Thunderhead', time, onTick: (k) => { S.thunder = Math.max(0.01, k); } }); S.thunder = 0; if (r !== 'done') return;
    Sound.sfx('thunder', 1, 0.9); FX.flash(0xe8e0ff, 0.06, 3); S.sheet = 0.8; if (!G.headless) { S.flashDir.set(p.pos.x - camera.position.x, 0.4, p.pos.z - camera.position.z); if (S.flashDir.lengthSq() < 1e-4) S.flashDir.set(0, 1, 0); S.flashDir.normalize(); }
    if (p.alive && S.lift > 0.3) { zap(S, _a.set(p.pos.x, 30, p.pos.z), _b.set(p.pos.x, p.pos.y + 1, p.pos.z), { w: 1.3, jag: 2.2, dur: 0.5, flash: 6 }); p.hurt(400, { blockable: false, src: { name: 'Thunderhead' } }); }
    else if (b.alive) { if (!G.headless) { zap(S, _a.set(b.pos.x, 30, b.pos.z), _b.set(b.pos.x, 3, b.pos.z), { w: 1.5, jag: 2.2, dur: 0.5, flash: 8 }); FX.burst(b.pos.x, 3, b.pos.z, { n: 30, color: 0xffffff, color2: STORM, speed: [4, 12], life: [0.3, 0.8], size: [0.2, 0.5] }); } b.hp = Math.max(1, b.hp - b.maxHp * 0.012); b.stagger = 2; b.exposed = Math.max(b.exposed, 2.5); Sound.sfx('crit', 0.8); yield 1.6; }
    yield 0.5;
  }
  function* tempest(b) {
    const S = b.state; S.flapAmp = 1.8; const r = yield* b.cast({ name: 'Tempest Call', time: 2.6, interruptible: true }); S.flapAmp = 1;
    if (r === 'done') { S.shut = 10; Sound.sfx('roar', 1, 1.4); FX.flash(0x8090b0, 0.25, 2); }
    yield 0.4;
  }

  function setAct(b, n) { const S = b.state; S.lvl = n; b.targetable = true; b.autoFace = true; S.altT = 0; S.diving = false; S.flapAmp = 1; S.thunder = 0; S.shear = 0; S.tilt = 0; }
  function look(b, n, instant) { const S = b.state; S.lookN = n; if (instant) { S.lookK = 1e3; if (n === 2) { S.deck.position.y = 220; S.deckV = 0; } Object.assign(Post.cur, POST[n]); Post.apply(); } }
  function* whiteout(b, n) {
    const S = b.state; Sound.sfx('wave', 1, 0.4); if (n === 1) { S.deckV = 120; yield 0.9; FX.flash(0xffffff, 1, 0.9); look(b, 1); S.lookK = 1e3; yield 0.2; S.deck.visible = false; }
    else { FX.flash(0x8a94a0, 0.9, 0.9); yield 0.25; look(b, 2); S.lookK = 1e3; S.deck.visible = true; S.deck.position.y = 12; S.deckV = 46; Sound.sfx('thunder', 0.8, 0.6); }
  }

  G.bosses.push({
    id: 'fall', name: 'ANZU', title: 'The Storm Roc', hint: "Don't look down", color: '#9fc8ff', telegraph: 0xff8a3a,
    hp: 23000, radius: 2.2, aimY: 2.4, enrage: 330,
    post: { bloom: 0.42, threshold: 0.9, radius: 0.6, exposure: 0.86, vig: 0.95, sat: 1.16, contrast: 1.16, tint: [1.0, 1.0, 1.02] },
    music: { bpm: 150, root: 38, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 0, 5, 3, 0, 6, 4, 4],
      layers: [
        { v: 'pulse', pat: 'x.x.x.x.x.x.x.x.', oct: 0, len: 1, vol: 0.07 }, { v: 'arp', pat: '0247024702470247', oct: 2, len: 1, vol: 0.04 }, { v: 'kick', pat: 'x...x...x...x.x.', vol: 0.2 }, { v: 'hat', pat: '..x...x...x...xx', vol: 0.05 }, { v: 'lead', pat: ['0.....2.4.......', '7.....4.2.......'], oct: 2, len: 5, vol: 0.05 },
        { v: 'choir', from: 1, pat: '0.......3.......', oct: 1, len: 8, vol: 0.07 }, { v: 'taiko', from: 1, pat: 'x..x..x.x..x.xx.', vol: 0.2 }, { v: 'bass', from: 1, pat: '0.0.0.0.0.0.2.0.', oct: -1, len: 1, vol: 0.12 },
        { v: 'brass', from: 2, pat: ['0.......4.......', '6.......2.......'], oct: 0, len: 7, vol: 0.12 }, { v: 'snare', from: 2, pat: '....x.......x..x', vol: 0.1 },
      ] },
    build,
    *intro(b) { Sound.sfx('wave', 0.8, 0.5); yield* Cam.shot([0, 34, 12], [0, 0, 8], [7, 9, 22], [0, 2, -4], 5.0, 56); },
    *death(b) {
      const S = b.state, p = G.player; S.dead = true; Sound.sfx('roar', 1, 0.6); b.aim(_a);
      for (let k = 0; k < 5; k++) { if (!G.headless) FX.burst(_a.x + rnd(-3, 3), _a.y + rnd(-1, 2), _a.z + rnd(-3, 3), { n: 50, color: 0x9ab0d8, color2: 0xffffff, speed: [3, 14], up: 16, life: [0.6, 1.6], size: [0.3, 0.8] }); S.rig.scale.setScalar(1 - (k + 1) * 0.2); Sound.sfx('slash', 0.5, 0.6 + k * 0.2); yield 0.18; }
      S.rig.visible = false; for (const T of S.trails) T.m.visible = false; S.door.visible = true; const dx = p.pos.x + 3.2, dz = p.pos.z; S.door.rotation.y = -PI / 2;
      Cam.cine = { pos: new V3(p.pos.x - 6, 4, p.pos.z + 9), look: new V3(p.pos.x + 1.5, 2.5, p.pos.z), fov: 50 };
      for (let t = 0; t < 1.6; t += G.dt) { const q = smooth(t / 1.6); S.door.position.set(dx, lerp(46, 3.2, q), dz); S.door.rotation.x = (1 - q) * 2.4; yield; }
      Sound.sfx('bell', 0.8, 0.8); FX.flash(0xfff0c0, 0.4, 1.5); yield 0.5;
    },
    phases: [
      { at: 1, *run(b) {
        setAct(b, 0); yield 1.2; let n = 0;
        while (true) {
          yield* flock(b, 3 + Math.min(2, n)); yield* fan(b, 2);
          yield* wingbeat(b); yield* slab(b, { T: n ? 3.3 : 3.8 }); yield* fan(b, 1); yield* waitSlabs(b);
          yield* dive(b); yield* shear(b, n ? 3.6 : 4.2); yield* strafe(b, 1); n++;
        }
      } },
      { at: 0.66, skipTo(b) { look(b, 1, true); b.state.deck.visible = false; },
        *enter(b) { const S = b.state; setAct(b, 1); S.flapAmp = 2; yield* b.moveTo(0, 0, 14); yield* b.cast({ name: 'Plunge', time: 1.4, onTick: (k) => FX.shake(k * 0.3) }); yield* whiteout(b, 1); S.flapAmp = 1; Co.start(Post.lerpTo(POST[1], 2), 'fight'); yield 1.0; },
        *run(b) {
          setAct(b, 1); yield 0.5; let n = 0;
          while (true) {
            yield* thunder(b); yield* hail(b, 2);
            yield* wingbeat(b); yield* slab(b, { T: 3.6, spin: 0.38 }); yield* fan(b, 2); yield* waitSlabs(b);
            if (n % 2 === 0) { yield* shear(b, 3.4); yield* thunder(b, 2.0); } else { yield* thunder(b, 2.0); yield* shear(b, 3.4); }
            yield* dive(b); yield* tempest(b); yield* shear(b, 3.4); yield* strafe(b, 1); n++;
          }
        } },
      { at: 0.33, skipTo(b) { look(b, 2, true); },
        *enter(b) { const S = b.state; setAct(b, 2); S.flapAmp = 2; yield* b.moveTo(0, 0, 14); yield* b.cast({ name: 'Cloudbreak', time: 1.4, onTick: (k) => FX.shake(k * 0.3) }); yield* whiteout(b, 2); S.flapAmp = 1; Co.start(Post.lerpTo(POST[2], 2), 'fight'); yield 1.0; },
        *run(b) {
          setAct(b, 2); yield 0.4; let n = 0;
          while (true) {
            yield* slab(b, { n: 3, T: 3.4, gap: 1.7, spin: n % 2 ? 0.3 : 0 }); yield* fan(b, 2); yield* waitSlabs(b);
            yield* spires(b, 5); yield* strafe(b, 2);
            if (n % 2 === 0) { yield* tempest(b); yield* shear(b, 3.2); yield* thunder(b, 1.9); } else { yield* thunder(b, 1.9); yield* wingbeat(b); yield* shear(b, 3.4); }
            yield* dive(b); yield* spires(b, 4); n++;
          }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight', HL = G.headless;
      if (p) p.pose = 'fall';
      // look
      const L = LOOKS[S.lookN], k = Math.min(1, S.lookK * dt), U = S.sky.material.uniforms; S.lookK = 1.2;
      const lc = (c, hex, s = 1) => c.lerp(_c.setHex(hex).multiplyScalar(s), k);
      lc(U.uTop.value, L.top); lc(U.uHor.value, L.hor); lc(U.uBot.value, L.fog); U.uCloud.value = lerp(U.uCloud.value, S.lookN ? 0 : 0.35, k); U.uSunGlow.value = lerp(U.uSunGlow.value, S.lookN ? 0 : 0.6, k);
      lc(S.fog.color, L.fog); S.fog.density = lerp(S.fog.density, L.dens, k); S.hemi.intensity = lerp(S.hemi.intensity, L.hemi, k); S.sun.intensity = lerp(S.sun.intensity, L.sun, k); scene.environmentIntensity = lerp(scene.environmentIntensity, L.env, k);
      const PU = S.puffM.uniforms; lc(PU.uLit.value, L.cloud); lc(PU.uShade.value, L.shade); lc(PU.uFog.value, L.fog); PU.uA.value = lerp(PU.uA.value, L.cop, k); PU.uFogD.value = S.fog.density * 0.5; PU.uFlash.value = S.sheet * 0.2; lc(S.pU.uIri.value, S.lookN === 2 ? 0x2a4a9a : 0x4a2a9a, 0.42);
      const MU = S.streaks.material.uniforms; lc(MU.uCol.value, L.streak); MU.uAlpha.value = lerp(MU.uAlpha.value, L.mote, k);
      const WU = S.wallM.uniforms; lc(WU.uCol.value, L.streak); WU.uA.value = lerp(WU.uA.value, L.wisp, k); WU.uFlash.value = S.sheet; WU.uTime.value = S.thermM.uniforms.uTime.value = S.deckM.uniforms.uTime.value = S.domeM.uniforms.uTime.value = S.discM.uniforms.uTime.value = S.rainM.uniforms.uTime.value = S.pU.uTime.value = t;
      const CU = S.cwM.uniforms; lc(CU.uLit.value, L.cwL); lc(CU.uShade.value, L.cwS); lc(CU.uRimC.value, L.cwR); lc(CU.uFog.value, L.fog); CU.uCov.value = lerp(CU.uCov.value, L.cov, k); lc(CU.uFarL.value, L.farL); lc(CU.uFarD.value, L.farD); CU.uFarA.value = lerp(CU.uFarA.value, L.farA, k); CU.uBloom.value = lerp(CU.uBloom.value, L.bloom, k); S.pU.uPulse.value = lerp(S.pU.uPulse.value, L.pulse, k); CU.uFlash.value = S.sheet * (S.lookN === 2 ? 0.8 : 1); CU.uTime.value = t;
      S.discM.uniforms.uShim.value = lerp(S.discM.uniforms.uShim.value, L.shim, k);
      const DU = S.domeM.uniforms; lc(DU.uLit.value, L.dLit); lc(DU.uDark.value, L.dDark); lc(DU.uFog.value, L.fog); DU.uLow.value = lerp(DU.uLow.value, L.low, k); DU.uFlash.value = S.sheet; S.dome.visible = S.lookN > 0;
      lc(S.discM.uniforms.uCol.value, L.disc); S.discM.uniforms.uA.value = lerp(S.discM.uniforms.uA.value, L.discA, k); S.rainM.uniforms.uA.value = lerp(S.rainM.uniforms.uA.value, L.rain, k); S.rain.visible = S.rainM.uniforms.uA.value > 0.01;
      lc(S.terM.color, L.ter); lc(S.mossM.color, [0x5c7a48, 0x3e4a5c, 0x3a3050][S.lookN]); lc(S.slabM.color, [0x77706a, 0x50546a, 0x4c4660][S.lookN]); const em = [0x000000, 0x222a44, 0x302c50][S.lookN]; lc(S.slabM.emissive, em); lc(S.mossM.emissive, em); lc(S.spM.emissive, em); lc(S.rockRim, [0x303848, 0x5a70a8, 0x7a8cd8][S.lookN], 0.8); lc(S.gRockM.color, L.ter === 0xffffff ? 0x5a564e : L.ter, 0.6); S.ground.visible = S.lookN !== 1 && S.ground.position.y > -1500; S.trailM.uniforms.uA.value = lerp(S.trailM.uniforms.uA.value, L.trail, k);
      const charged = S.lookN === 2 && !S.dead; S.vein = lerp(S.vein, L.vein, k); S.pU.uVein.value = S.vein * (charged ? 0.7 + 0.6 * vrand() : 1); lc(S.pU.uVeinC.value, L.veinC); lc(S.pU.uRimC.value, L.rim, 0.8); lc(S.eyeM.color, L.eye, charged ? 4 + 2 * vrand() : 4);
      // sheet lightning inside the cloud: rarer in act 2, frequent and doubled in act 3
      S.sheet = Math.max(0, S.sheet - dt * (S.lookN === 2 ? 3.5 : 6));
      if (S.lookN && !HL) { S.flashT -= dt; const two = S.lookN === 2;
        if (S.flashT <= 0) { S.flashT = two ? 0.35 + vrand() * 0.6 : 1.6 + vrand() * 2.9; S.sheet = 1; S.sheet2 = vrand() < (two ? 0.7 : 0.4) ? t + 0.08 + vrand() * 0.12 : 0; S.flashDir.set(vrand() - 0.5, two ? 0.15 + vrand() * 0.6 : vrand() * 1.4 - 0.5, vrand() - 0.5).normalize(); S.hemi.intensity = two ? 0.85 : 2.0;
          if (vrand() < (two ? 0.3 : 1)) FX.flash(0xcfe0ff, two ? 0.07 : 0.1, 5); if (vrand() < 0.5) Sound.sfx('thunder', 0.3, 0.7 + vrand() * 0.5);
          if (two && vrand() < 0.6) { const fh = Math.hypot(S.flashDir.x, S.flashDir.z) || 1; _a.set(S.flashDir.x / fh * 72, camera.position.y + 20 + vrand() * 40, S.flashDir.z / fh * 72); _b.copy(_a); _b.x *= 0.9; _b.z *= 0.9; _b.y -= 40 + vrand() * 50; zap(S, _a, _b, { w: 1.6, jag: 9, dur: 0.3, halo: 0x6a50e0, fork: 2 }); } }
        if (S.sheet2 && t > S.sheet2) { S.sheet = Math.max(S.sheet, 0.8); S.sheet2 = 0; } }
      S.deckM.uniforms.uFlash.value = S.sheet * 0.6;
      // the ground comes up on the clock
      const E = b.def.enrage, ft = fight || G.state === 'win' ? G.ft : 0, f = Math.min(1, ft / E);
      S.ground.position.y = ft > E ? lerp(-30, -1.5, Math.min(1, (ft - E) / 6)) : -30 - 2400 * Math.pow(1 - f, 1.5);
      if (fight && ft > E + 6 && !S.landed && p && p.alive) { S.landed = true; S.ground.visible = true; FX.shake(1.5); Sound.sfx('bigboom', 1, 0.4); p.invuln = 0; p.hurt(99999, { blockable: false, src: 'enrage' }); }
      if (S.landed) S.ground.visible = true;
      // cloud deck
      if (S.lookN === 0 && S.deckV === 0) S.deck.position.y = lerp(-260, -26, sat((1 - b.hp / b.maxHp) / 0.34)); else if (S.deckV) { S.deck.position.y += S.deckV * dt; if (S.deck.position.y > 220) { S.deck.position.y = 220; S.deckV = 0; } }
      lc(S.deckM.uniforms.uCol.value, L.deckC); lc(S.deckM.uniforms.uDark.value, L.deckD);
      if (!HL) { const cq = camera.quaternion; for (let i = 0; i < S.NC; i++) { const c = S.puffs[i]; c.y += c.v * dt; if (c.y > 170) c.y -= 340; _m.position.set(Math.sin(c.a) * c.d, c.y, Math.cos(c.a) * c.d); _m.quaternion.copy(cq); _m.scale.set(c.s, c.s * 1.5, 1); _m.updateMatrix(); S.puffI.setMatrixAt(i, _m.matrix); } S.puffI.instanceMatrix.needsUpdate = true; }
      // slabs and spires
      S.holes.length = 0;
      for (const sl of S.slabs) { if (!sl.on) continue; const dtf = t - sl.fire; sl.m.position.y = dtf * RISE - 4.6; sl.m.rotation.y = sl.a0 + sl.w * Math.min(0, dtf); if (dtf < 0) { const q = holeAt(sl.d, sl.a0); S.holes.push({ x: q[0], z: q[1], t: -dtf }); } if (dtf > 3) { sl.on = false; sl.m.visible = false; } }
      S.holes.sort((x, y) => x.t - y.t);
      for (const sp of S.spires) { if (!sp.on) continue; const dtf = t - sp.fire; sp.m.position.set(sp.x, dtf * 30 - 15, sp.z); if (dtf > 2.2) { sp.on = false; sp.m.visible = false; } }
      // thermals
      if (S.shut > 0) S.shut -= dt; let inT = false;
      for (const T of S.therm) { T.a += dt * 0.1; T.x = Math.sin(T.a) * T.r; T.z = Math.cos(T.a) * T.r; T.k = damp(T.k, S.shut > 0 ? 0 : 1, 5, dt); T.grp.position.set(T.x, 0, T.z); T.grp.scale.set(Math.max(0.01, T.k), 1, Math.max(0.01, T.k)); T.grp.visible = T.k > 0.03; if (p && S.shut <= 0 && Math.hypot(p.pos.x - T.x, p.pos.z - T.z) < 2.7) inT = true; }
      S.lift = damp(S.lift, inT && p.alive ? 1 : 0, inT ? 4.5 : 3, dt);
      if (p && p.alive && p.grounded) p.pos.y = S.lift * LIFT;
      // signals
      S.charge.visible = S.thunder > 0; if (S.thunder > 0) { S.charge.scale.setScalar(0.4 + S.thunder * 1.4 + Math.sin(t * 40) * 0.1); S.chargeL.intensity = 110 + S.thunder * 420 * (0.6 + 0.4 * Math.sin(t * 30)); } else S.chargeL.intensity = 0;
      if (S.shear > 0 && !HL && vrand() < dt * (3 + S.shear * 12)) { const a = vrand() * TAU, r1 = 4 + vrand() * (R - 4), a2 = a + (0.25 + vrand() * 0.35) * (vrand() < 0.5 ? -1 : 1), r2 = clamp(r1 + (vrand() - 0.5) * 6, 3, R); zap(S, _a.set(Math.sin(a) * r1, 0.3, Math.cos(a) * r1), _b.set(Math.sin(a2) * r2, 0.3, Math.cos(a2) * r2), { w: 0.45 + S.shear * 0.3, jag: 1.4, dur: 0.2, core: 0xdde8ff, halo: 0x5a70ff }); }
      // Anzu
      S.alt = damp(S.alt, S.altT, S.diving ? 30 : 3.5, dt); if (S.diving) S.alt = Math.max(0, S.alt - 130 * dt);
      S.flap += dt * (3.2 + S.flapAmp * 1.6); const fl = Math.sin(S.flap) * 0.45 * Math.min(1.6, S.flapAmp + 0.2), gl = S.flapAmp < 0.5 ? 0.15 : 0;
      for (const w of S.wings) { w.sh.rotation.z = w.sx * (fl + gl + 0.1); w.el.rotation.z = w.sx * (Math.sin(S.flap - 0.8) * 0.5 * Math.min(1.4, S.flapAmp) - 0.2); }
      S.rig.position.y = S.alt + Math.cos(S.flap) * 0.25 - 0.4; S.rig.rotation.x = damp(S.rig.rotation.x, S.diving ? 1.2 : S.tilt ? 0.35 : b.castState ? -0.12 : 0.05, 8, dt); S.rig.rotation.z = Math.sin(t * 0.9) * 0.05;
      S.neck.rotation.x = Math.sin(t * 1.3) * 0.08 - (b.castState ? 0.25 : 0); S.tail.rotation.x = Math.sin(S.flap - 1.5) * 0.15; S.aura.intensity = 8 + (b.castState ? 12 : 0);
      if (HL) return;
      // bolts and ground flashes
      for (const B of S.bolts) { if (!B.m.visible) continue; const q = (t - B.t0) / B.dur; if (q >= 1) { B.m.visible = false; continue; } if (q > 0.7) { B.m.visible = false; continue; } B.m.material.uniforms.uA.value = (q < 0.45 ? 1 : 0.7) * (Math.sin((t - B.t0) * 90 + B.s * 20) > -0.3 ? 1 : 0.35); }
      for (const F of S.gfl) { if (!F.m.visible) continue; const q = (t - F.t0) / 0.4; if (q >= 1) { F.m.visible = false; continue; } F.m.material.uniforms.uA.value = (1 - q) * (1 - q); F.m.scale.setScalar(F.s * (0.7 + q * 0.6)); }
      // the bird fades to a rim outline where it stands between the camera and the player
      const cp = camera.position;
      if (p) { _a.copy(p.pos); _a.y += 1.2; const vx = _a.x - cp.x, vy = _a.y - cp.y, vz = _a.z - cp.z, L2 = Math.max(vx * vx + vy * vy + vz * vz, 1e-6);
        const near = false, occ = (o, r) => { o.getWorldPosition(_b); const dc = _b.distanceTo(cp); if (near && dc < r * 1.4) return true; const kk = ((_b.x - cp.x) * vx + (_b.y - cp.y) * vy + (_b.z - cp.z) * vz) / L2; if (kk < 0 || kk > 0.97) return false; const dx = cp.x + vx * kk - _b.x, dy = cp.y + vy * kk - _b.y, dz = cp.z + vz * kk - _b.z; return dx * dx + dy * dy + dz * dz < r * r; };
        const bodyHit = occ(S.bodyP, 2.6) || occ(S.headP, 1.6) || occ(S.tail, 2.2);
        for (const w of S.wings) { const u = w.m.userData.fade; u.value = damp(u.value, !S.dead && (occ(w.mid, 2.8) || occ(w.hand, 3.0) || occ(w.tip, 2.6)) ? 0.85 : 0, 5, dt); }
        const ub = S.fadeM[2].userData.fade; ub.value = damp(ub.value, !S.dead && bodyHit ? 0.75 : 0, 5, dt); }
      // wing-tip wind trails
      S.wings.forEach((w, wi) => { const T = S.trails[wi], h = T.h, N = T.NT; w.tip.getWorldPosition(_b);
        if (!T.init) { for (let i = 0; i < N; i++) h.set([_b.x, _b.y, _b.z, t], i * 4); T.init = true; }
        h.copyWithin(4, 0, (N - 1) * 4); h.set([_b.x, _b.y, _b.z, t], 0); const arr = T.m.geometry.attributes.position.array;
        for (let i = 0; i < N; i++) { const j = i * 4, i0 = Math.max(0, i - 1) * 4, i1 = Math.min(N - 1, i + 1) * 4, up = (t - h[j + 3]) * 9, wd = 0.3 * Math.pow(1 - i / (N - 1), 0.7) + 0.02;
          _x.set(h[i1] - h[i0], h[i1 + 1] - h[i0 + 1] + ((h[i0 + 3] - h[i1 + 3]) * 9), h[i1 + 2] - h[i0 + 2]); _y.set(h[j] - cp.x, h[j + 1] + up - cp.y, h[j + 2] - cp.z); _z.crossVectors(_x, _y); const l = _z.length(); if (l < 1e-5) _z.set(wd, 0, 0); else _z.multiplyScalar(wd / l);
          arr.set([h[j] - _z.x, h[j + 1] + up - _z.y, h[j + 2] - _z.z, h[j] + _z.x, h[j + 1] + up + _z.y, h[j + 2] + _z.z], i * 6); }
        T.m.geometry.attributes.position.needsUpdate = true; T.m.visible = S.rig.visible; });
      // act 3: the bird is charged (arcs between wing tips and crest) and the boundary ring crackles
      S.rimM.color.setHex(0xdcecff).multiplyScalar(charged ? 1.2 + 0.6 * vrand() : 1.4);
      if (charged && !S.dead && S.rig.visible) { if ((S.arcT -= dt) <= 0 && S.fadeM[2].userData.fade.value < 0.3 && S.fadeM[0].userData.fade.value < 0.3 && S.fadeM[1].userData.fade.value < 0.3) { S.arcT = 0.06 + vrand() * 0.1; const r = vrand(); if (r < 0.2) { S.wings[0].tip.getWorldPosition(_a); S.wings[1].tip.getWorldPosition(_b); } else { S.wings[r < 0.67 ? 0 : 1].tip.getWorldPosition(_a); S.crest.getWorldPosition(_b); } zap(S, _a, _b, { w: 0.5, jag: 2.4, dur: 0.3, core: 0xf0ffff, halo: 0x6aa0ff, fork: 2 }); }
        if ((S.rimT -= dt) <= 0) { S.rimT = 0.08 + vrand() * 0.2; let a = vrand() * TAU; for (let q = 0; q < 2; q++) { const a2 = a + 0.18 + vrand() * 0.2; zap(S, _a.set(Math.sin(a) * R, 0.15, Math.cos(a) * R), _b.set(Math.sin(a2) * R, 0.15, Math.cos(a2) * R), { w: 0.45, jag: 1.0, dur: 0.22, core: 0xffffff, halo: 0x7a60ff, fork: 1 }); a = a2; } } }
    },
    danger(b, x, z) { const S = b.state; if (S.thunder > 0) for (const T of S.therm) if (Math.hypot(x - T.x, z - T.z) < 3.4) return 0.6; return Infinity; },
    bot(b, p) {
      const S = b.state;
      if (S.holes.length) { const h = S.holes[0]; return { x: h.x, z: h.z, w: 7 }; }
      if (S.shear > 0 && S.shut <= 0) { let best = null, bd = 1e9; for (const T of S.therm) { const d = Math.hypot(T.x - p.pos.x, T.z - p.pos.z); if (d < bd) { bd = d; best = T; } } if (best) return { x: best.x + Math.cos(best.a) * 0.6, z: best.z - Math.sin(best.a) * 0.6, w: 7 }; }
      return {};
    },
  });
})();
