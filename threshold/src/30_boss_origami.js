// DOOR XI: ORIKO, the Thousandth Fold. A sheet of paper over a painted void. The sheet folds, and wet ink prints.
(() => {
  const H = 15, RED = 0xe8402a, INK = 0x0b0d1c, NB = 20, CELL = (H * 2) / NB;
  const _a = new V3(), _s = new V3(), _c = new THREE.Color(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m4 = new THREE.Matrix4(), _m4b = new THREE.Matrix4(), _m4c = new THREE.Matrix4();
  const vr = (a = 1, b) => b === undefined ? vrand() * a : a + vrand() * (b - a), vpick = (arr) => arr[Math.floor(vrand() * arr.length)];
  const inSq = (x, z, m = 0) => Math.abs(x) <= H - m && Math.abs(z) <= H - m;
  const side = (f, x, z) => (x - f.cx) * f.nx + (z - f.cz) * f.nz;            // > 0: the part that stays, < 0: the flap
  const refl = (f, x, z) => { const d = side(f, x, z); return [x - 2 * d * f.nx, z - 2 * d * f.nz]; };
  const reflDir = (f, a) => { const dx = Math.sin(a), dz = Math.cos(a), k = dx * f.nx + dz * f.nz; return Math.atan2(dx - 2 * k * f.nx, dz - 2 * k * f.nz); };
  const inBlot = (q, x, z) => { if (q.bar) { const fx = Math.sin(q.dir), fz = Math.cos(q.dir), dx = x - q.x, dz = z - q.z; return Math.abs(dx * fx + dz * fz) <= q.len / 2 && Math.abs(dx * fz - dz * fx) <= q.w / 2; } return Math.hypot(x - q.x, z - q.z) <= q.r; };
  const mirror = (f, q) => { const [x, z] = refl(f, q.x, q.z); return q.bar ? { bar: true, x, z, dir: reflDir(f, q.dir), len: q.len, w: q.w } : { x, z, r: q.r }; };
  const burnIdx = (x, z) => { const i = Math.floor((x + H) / CELL), j = Math.floor((z + H) / CELL); return i < 0 || j < 0 || i >= NB || j >= NB ? -1 : j * NB + i; };

  // convex polygon helpers (the sheet is always convex)
  function clipPoly(P, f, keepBase) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const A = P[i], B = P[(i + 1) % P.length], da = side(f, A[0], A[1]) * (keepBase ? 1 : -1), db = side(f, B[0], B[1]) * (keepBase ? 1 : -1);
      if (da >= 0) out.push(A);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
    }
    return out;
  }
  const suv = (q) => [(q[0] + H) / (2 * H), (q[1] + H) / (2 * H)];
  function polyGeo(P, map, sub = 0) {
    const pos = [], uv = [], nor = [], mid = (p, q) => ({ w: [(p.w[0] + q.w[0]) / 2, (p.w[1] + q.w[1]) / 2], l: [(p.l[0] + q.l[0]) / 2, (p.l[1] + q.l[1]) / 2] });
    const emit = (T, s) => { if (s > 0) { const [a, b, c] = T, ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); for (const t of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) emit(t, s - 1); return; } for (const q of T) { pos.push(q.l[0], 0, q.l[1]); nor.push(0, 1, 0); uv.push(...suv(q.w)); } };
    for (let i = 1; i + 1 < P.length; i++) {
      let T = [P[0], P[i], P[i + 1]].map((q) => ({ w: q, l: map ? map(q[0], q[1]) : [q[0], q[1]] }));
      const a = T[0].l, b = T[1].l, c = T[2].l; if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) < 0) T = [T[0], T[2], T[1]];
      emit(T, sub);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
  }
  // the paper's cut edge: a thin wall showing its thickness (and its reverse colour)
  function edgeGeo(P, map, d = 0.14, keep) {
    const pos = [], uv = [], col = [];
    for (let i = 0; i < P.length; i++) {
      if (keep && !keep(P[i], P[(i + 1) % P.length])) continue;
      const A = P[i], B = P[(i + 1) % P.length], a = map ? map(A[0], A[1]) : A, c = map ? map(B[0], B[1]) : B, ua = suv(A), ub = suv(B);
      pos.push(a[0], 0, a[1], c[0], 0, c[1], c[0], -d, c[1], a[0], 0, a[1], c[0], -d, c[1], a[0], -d, a[1]); uv.push(...ua, ...ub, ...ub, ...ua, ...ub, ...ua);
      col.push(1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 0.22, 0.22, 0.22, 1.6, 1.6, 1.6, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22); // lit cut edge on top, falling into shadow underneath
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  }
  const SQUARE = () => [[-H, -H], [H, -H], [H, H], [-H, H]];

  // ---------- folded-paper geometry: flat facets, barycentrics for crease lines, a random tone per facet ----------
  const rT = mulberry(77);
  function tg(T, O, hint) {
    const pos = [], bar = [];
    for (let [A, B, C] of T) {
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], wx = C[0] - A[0], wy = C[1] - A[1], wz = C[2] - A[2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const d = hint || [(A[0] + B[0] + C[0]) / 3 - O[0], (A[1] + B[1] + C[1]) / 3 - O[1], (A[2] + B[2] + C[2]) / 3 - O[2]];
      if (nx * d[0] + ny * d[1] + nz * d[2] < 0) [B, C] = [C, B];
      pos.push(...A, ...B, ...C); const w = rT(); bar.push(1, 0, 0, w, 0, 1, 0, w, 0, 0, 1, w);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('bary', new THREE.Float32BufferAttribute(bar, 4)); g.computeVertexNormals(); return g;
  }
  const solid = (P, F, O) => tg(F.map((f) => f.map((i) => P[i])), O);
  function spike(A, B, r, n = 3) {
    const ax = B[0] - A[0], ay = B[1] - A[1], az = B[2] - A[2], L = Math.hypot(ax, ay, az) || 1, a = new V3(ax / L, ay / L, az / L);
    const u = new V3().crossVectors(a, Math.abs(a.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0)).normalize(), v = new V3().crossVectors(a, u), ring = [];
    for (let i = 0; i < n; i++) { const t = i / n * TAU + 0.3; ring.push([A[0] + (u.x * Math.cos(t) + v.x * Math.sin(t)) * r, A[1] + (u.y * Math.cos(t) + v.y * Math.sin(t)) * r, A[2] + (u.z * Math.cos(t) + v.z * Math.sin(t)) * r]); }
    const T = []; for (let i = 0; i < n; i++) T.push([ring[i], ring[(i + 1) % n], B]); for (let i = 1; i + 1 < n; i++) T.push([ring[0], ring[i], ring[i + 1]]);
    return tg(T, [A[0] + ax * 0.25, A[1] + ay * 0.25, A[2] + az * 0.25]);
  }
  const flat = (T, hint = [0, 1, 0]) => tg(T, null, hint);
  function mergeG(gs) { const pos = [], bar = []; for (const g of gs) { pos.push(...g.attributes.position.array); bar.push(...g.attributes.bary.array); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('bary', new THREE.Float32BufferAttribute(bar, 4)); g.computeVertexNormals(); return g; }
  function pz(g) { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, bar = new Float32Array(n * 4); for (let i = 0; i < n; i += 3) { const w = rT(); for (let k = 0; k < 3; k++) bar.set([k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0, w], (i + k) * 4); } g.setAttribute('bary', new THREE.BufferAttribute(bar, 4)); return g; }
  const lp = (A, B, t) => [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];

  // ---------- shaders ----------
  const NZ = 'float oh21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }\nfloat on2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(oh21(i),oh21(i+vec2(1.0,0.0)),f.x),mix(oh21(i+vec2(0.0,1.0)),oh21(i+vec2(1.0,1.0)),f.x),f.y); }\n';
  // the sheet: fibre map + a crane crease pattern (valley grid, mountain diagonals), washi seigaiha print, fibrous burnt holes with an ember rim
  const SHEET = NZ + `uniform sampler2D uBurn; uniform float uPatF,uPatB,uTime,uPin; uniform vec3 uWashi,uMotif,uGold,uEmber;
    float oSeig(vec2 p){ p*=0.28; float j0=floor(p.y*2.0), hit=0.0, r=0.0;
      for(int k=0;k<3;k++){ float j=j0-1.0+float(k); float off=mod(j,2.0)*0.5; vec2 c=vec2(floor(p.x-off+0.5)+off, j*0.5); float d=length(p-c)*2.0; if(hit<0.5 && d<1.0){ hit=1.0; r=d; } }
      float f=fract(r*2.5); float aa=1.0-smoothstep(0.08,0.2,fwidth(r*3.0)); return hit*smoothstep(0.36,0.45,abs(f-0.5))*aa; }
    vec3 oCrease(vec2 sp, vec3 col){
      float fw=max(fwidth(sp.x)+fwidth(sp.y),1e-4)*0.5;
      vec2 q=abs(fract(sp/3.75+0.5)-0.5)*3.75; float dg=min(q.x,q.y);
      float a=abs(fract((sp.x+sp.y)/7.5+0.5)-0.5)*5.3033, b=abs(fract((sp.x-sp.y)/7.5+0.5)-0.5)*5.3033, dd=min(a,b);
      float lv=1.0-smoothstep(0.022,0.022+fw*1.5,dg), lm=1.0-smoothstep(0.018,0.018+fw*1.5,dd), sh=1.0-smoothstep(0.02,0.14+fw,dd);
      float tri=step(0.5,fract((sp.x+sp.y)/7.5))+2.0*step(0.5,fract((sp.x-sp.y)/7.5));
      float tone=0.965+0.06*oh21(floor(sp/3.75)*1.7+tri*3.1);
      return col*tone*(1.0-0.17*lv)*(1.0-0.07*sh*(1.0-lm))*(1.0+0.14*lm);
    }\n`;
  const sheetBody = (front, edge) => `#include <map_fragment>
    vec3 oEm=vec3(0.0);
    { vec2 sp=vMapUv*30.0-15.0; float pk=${edge ? '0.0' : front ? 'uPatF' : 'uPatB'};
      float sg=oSeig(sp)*pk; diffuseColor.rgb=mix(diffuseColor.rgb, ${front ? 'uWashi' : 'uMotif'}, sg*0.28);
      float gf=step(0.9985,oh21(floor(sp*12.0+on2(sp*0.7)*3.0)))*pk; diffuseColor.rgb=mix(diffuseColor.rgb,uGold,gf);
      diffuseColor.rgb=oCrease(sp,diffuseColor.rgb);
      vec2 bu=vMapUv+(vec2(on2(sp*1.3),on2(sp*1.3+17.0))-0.5)*0.022+(vec2(on2(sp*7.0+3.0),on2(sp*7.0-5.0))-0.5)*0.007;
      vec4 bt=texture2D(uBurn,bu);
      if(bt.r<0.5) discard;
      float fib=on2(sp*16.0), er=1.0-smoothstep(0.5,0.535,bt.r), eg=1.0-smoothstep(0.52,0.6,bt.r), sc=1.0-smoothstep(0.55,0.85,bt.r);
      diffuseColor.rgb*=mix(1.0,0.45,sc*(1.0-eg));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.86,0.78,0.66),eg*(0.55+0.45*fib));
      float pr=bt.g, nz=on2(sp*0.9)*0.7+on2(sp*3.1)*0.3, fr=pr*1.3-nz, act=step(0.004,pr);
      float ch=smoothstep(-0.04,0.08,fr)*act; diffuseColor.rgb*=mix(1.0,0.14,ch)*mix(1.0,0.3,smoothstep(-0.45,-0.06,fr)*act*(0.7+0.3*on2(sp*5.0)));
      float ln=exp(-(fr/0.05)*(fr/0.05))*act;
      oEm+=uEmber*(er*0.9+ln*1.15+ch*0.18*(0.6+0.4*sin(uTime*6.0+nz*25.0)));
      ${front ? '' : 'oEm+=uEmber*uPin*step(0.9965,oh21(floor(sp*3.5)))*(0.7+0.3*sin(uTime*3.0+sp.x*2.0)); diffuseColor.rgb*=1.0+uPin*0.5*smoothstep(0.55,1.0,on2(sp*0.6)); { vec2 q=abs(fract(sp/3.75+0.5)-0.5)*3.75; float lw=max(fwidth(sp.x),1e-4)*1.5; float a2=abs(fract((sp.x+sp.y)/7.5+0.5)-0.5)*5.3033, b2=abs(fract((sp.x-sp.y)/7.5+0.5)-0.5)*5.3033; float l2=1.0-smoothstep(0.03,0.03+lw,min(min(q.x,q.y),min(a2,b2))); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.06,0.045,0.04),uPin*0.8*l2); }'}
    }`;

  function build(b) {
    const g = G.world, S = b.state;
    S.discDir = new V3(-0.3, -0.004, -0.95).normalize();
    const sky = W.sky({ top: 0xa9b4c0, horizon: 0xe8e2d4, bottom: 0x8c96a2, stars: 0, sunDir: S.discDir.toArray(), sunColor: 0xf6efe0, sunSize: 0.001, sunGlow: 0.25, clouds: 0.22, cloudColor: 0xf2eee6, cloudDark: 0x8a929c, cloudSpeed: 0.004 });
    g.add(sky); S.sky = sky; W.env(sky, 0.7);
    scene.fog = new THREE.FogExp2(0xc2c8ce, 0.007); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0xd8e2f0, 0x8a7c66, 0.72);
    S.sun = W.sun(g, { dir: [-0.35, 0.9, -0.35], color: 0xffeed8, intensity: 2.4, size: 26 });
    S.fire = new THREE.DirectionalLight(0xff4a18, 0); S.fire.position.set(0, -20, 30); g.add(S.fire); g.add(S.fire.target);
    S.sunV = { value: new V3(0, 1, 0) }; S.glowC = { value: new THREE.Color(0xffc890).multiplyScalar(0.3) }; S.rimC = { value: new THREE.Color() };

    // ---- the painted world: folded-paper mountain ranges in atmospheric bands, a paper sun, cranes ----
    const mr = mulberry(19), sunAz = Math.atan2(S.discDir.x, S.discDir.z); S.mtnU = [];
    const MTV = 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }';
    const MTF = `uniform vec3 uLit,uShade,uHaze,uRim,uSunD,uRimD; uniform float uK,uRimK; varying vec3 vW;
      void main(){ vec3 n=cross(dFdx(vW),dFdy(vW)); float ln=length(n); n=ln>1e-8?n/ln:vec3(0.0,1.0,0.0); if(dot(n,cameraPosition-vW)<0.0) n=-n;
        float l=clamp(dot(n,uSunD)*0.5+0.5,0.0,1.0); l=clamp(floor(l*3.0)/2.0,0.0,1.0);
        float hz=fract(sin(dot(floor(n*6.0+0.5),vec3(12.9898,78.233,37.719)))*43758.5453); vec3 c=mix(uShade,uLit,l)*(0.86+0.28*hz);
        float r=clamp(dot(n,uRimD),0.0,1.0); r*=r; c+=uRim*r*r*r*uRimK*(0.4+0.6*clamp((vW.y+40.0)/120.0,0.0,1.0));
        float mb=1.0-smoothstep(-62.0,-34.0,vW.y); c=mix(c,uHaze,clamp(uK+mb*mb*(1.0-uK)*0.9,0.0,1.0));
        gl_FragColor=vec4(c,1.0); }`;
    [[175, 40, 22, 60, 10], [270, 50, 38, 80, 14], [410, 80, 64, 108, 19]].forEach(([d0, dj, rb, hh, cnt], ri) => {
      const pos = [];
      for (let k = 0; k < cnt; k++) {
        const a = k / cnt * TAU + mr() * 0.28, d = d0 + mr() * dj, near = smooth(clamp(Math.abs(angDiff(a, sunAz)) / 0.55, 0, 1)), h = hh * (0.6 + mr() * 0.5) * (0.45 + 0.55 * near), r0 = rb * (0.7 + mr() * 0.6);
        for (let q = 0; q < 3; q++) { // a main peak and two lower shoulders beside it
          const off = q === 0 ? 0 : (q === 1 ? -1 : 1) * r0 * (0.75 + mr() * 0.4), ca = Math.cos(a), sa = Math.sin(a), hq = q ? h * (0.45 + mr() * 0.25) : h, rq = q ? r0 * (0.55 + mr() * 0.2) : r0;
          const x = sa * d + ca * off, z = ca * d - sa * off, base = -78, n = 5 + Math.floor(mr() * 3), ro = mr() * TAU, ap = [x + (mr() - 0.5) * rq * 0.4, base + hq, z + (mr() - 0.5) * rq * 0.4], B = [], M = [];
          for (let i = 0; i < n; i++) { const t = ro + i / n * TAU, rr = rq * (0.75 + mr() * 0.4); B.push([x + Math.sin(t) * rr, base, z + Math.cos(t) * rr]); const t2 = t + PI / n, rm = rq * (0.3 + mr() * 0.22); M.push([lerp(x, ap[0], 0.5) + Math.sin(t2) * rm, base + hq * (0.42 + mr() * 0.2), lerp(z, ap[2], 0.5) + Math.cos(t2) * rm]); }
          for (let i = 0; i < n; i++) { const j = (i + 1) % n; pos.push(...B[i], ...B[j], ...M[i], ...M[i], ...B[j], ...M[j], ...M[i], ...M[j], ...ap); }
        }
      }
      { // a continuous folded ridgeline joining the peaks of this range at their feet
        const N = 70 + ri * 20, R = d0 + dj * 0.55, T = [];
        for (let i = 0; i < N; i++) { const a = i / N * TAU, near = smooth(clamp(Math.abs(angDiff(a, sunAz)) / 0.5, 0, 1)), up = i % 2 ? 0.55 + mr() * 0.3 : 0.25 + mr() * 0.15, rr = R + (mr() - 0.5) * dj * 0.5; T.push([Math.sin(a) * rr, -78 + hh * up * (0.35 + 0.65 * near), Math.cos(a) * rr, a]); }
        for (let i = 0; i < N; i++) { const A = T[i], B = T[(i + 1) % N], f = (q, dr) => [Math.sin(q[3]) * (Math.hypot(q[0], q[2]) + dr), -80, Math.cos(q[3]) * (Math.hypot(q[0], q[2]) + dr)];
          const At = [A[0], A[1], A[2]], Bt = [B[0], B[1], B[2]], Af = f(A, -rb * 1.4), Bf = f(B, -rb * 1.4), Ab = f(A, rb * 1.4), Bb = f(B, rb * 1.4);
          pos.push(...Af, ...Bf, ...Bt, ...Af, ...Bt, ...At, ...At, ...Bt, ...Bb, ...At, ...Bb, ...Ab); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const U = { uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uK: { value: 0 }, uRimK: { value: 0 }, uSunD: { value: new V3(-0.3, 0.55, -0.8).normalize() }, uRimD: { value: new V3(-0.3, 0.35, -0.9).normalize() } };
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: MTV, fragmentShader: MTF, fog: false })); m.frustumCulled = false; m.renderOrder = -60; g.add(m); S.mtnU.push(U);
    });
    // the sun: a cut paper disc (pale, then a huge low orange sun, then eclipsed red)
    S.discU = { uC: { value: new THREE.Color(0xf6efe0) }, uEcl: { value: 0 }, uGlow: { value: 0.35 }, uRimC: { value: new THREE.Color(0x9aa6b6) }, uCr: { value: 0 } }; S.discSize = 0.055;
    S.disc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: S.discU, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: NZ + `uniform vec3 uC,uRimC; uniform float uEcl,uGlow,uCr; varying vec2 vUv;
        void main(){ vec2 c=(vUv*2.0-1.0)*2.4; float d=length(c); float edge=0.975+0.025*on2(c*7.0);
          float disc=1.0-smoothstep(edge-0.012,edge,d); vec3 col=uC*(0.97+0.03*on2(c*10.0)); col=mix(col,uRimC,smoothstep(edge-0.09,edge-0.05,d)*(1.0-uEcl));
          float cr=max(1.0-smoothstep(0.0,0.012,abs(dot(c,vec2(0.93,0.37))-0.12)),1.0-smoothstep(0.0,0.012,abs(dot(c,vec2(-0.5,0.87))+0.2))); col*=1.0-cr*0.12*uCr;
          float st=uCr*max(smoothstep(0.07,0.04,abs(c.y+0.32+(on2(vec2(c.x*9.0,1.0))-0.5)*0.05)),smoothstep(0.045,0.02,abs(c.y-0.22+(on2(vec2(c.x*11.0,5.0))-0.5)*0.04)))*smoothstep(1.6,1.1,abs(c.x));
          float ec=uEcl*(1.0-smoothstep(0.84,0.87,length(c-vec2(0.07,0.04)))); col=mix(col,vec3(0.012,0.004,0.004),ec);
          float ring=uEcl*exp(-((d-0.93)/0.07)*((d-0.93)/0.07))*1.6;
          float gl=uGlow*exp(-max(d-1.0,0.0)*2.6)*(1.0-disc)*0.55;
          vec3 sc=vec3(0.55,0.22,0.3); vec3 o=col*disc+uC*(gl+ring); float al=clamp(disc+gl+ring*0.6,0.0,1.0); o=mix(o,sc,st); al=max(al,st);
          gl_FragColor=vec4(o,al); }` }));
    S.disc.renderOrder = -90; S.disc.frustumCulled = false; g.add(S.disc);
    // a sea of mist under the sheet: soft drifting bands, darker in the sheet's shadow, fading into the horizon
    S.mistU = { uC: { value: new THREE.Color(0xa8b0ba) }, uH: sky.material.uniforms.uHor, uT: { value: 0 }, uB: { value: 0.2 }, uDk: { value: 0.72 }, uHz: { value: 150 } };
    const mist = new THREE.Mesh(new THREE.CircleGeometry(600, 48), new THREE.ShaderMaterial({ uniforms: S.mistU, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: NZ + `uniform vec3 uC,uH; uniform float uT,uB,uDk,uHz; varying vec3 vW;
        void main(){ float r=length(vW.xz); vec2 q=vW.xz+vec2(uT*1.5,uT*0.6);
          float band=on2(vec2(q.x*0.004,q.y*0.035))*0.6+on2(vec2(q.x*0.01,q.y*0.09))*0.4;
          vec3 c=uC*(1.0-uB*0.6+uB*band)*mix(uDk,1.0,smoothstep(12.0,90.0,r));
          c=mix(c,uH,smoothstep(uHz,560.0,r)*0.85);
          gl_FragColor=vec4(c,1.0); }` })); mist.rotation.x = -PI / 2; mist.position.y = -60; g.add(mist); S.mist = mist;
    S.motes = W.motes({ n: 160, box: [70, 30, 70], color: 0xffffff, size: 0.22, vel: [0.5, -0.25, 0.2], sway: 1.2, center: [0, 8, 0], alpha: 0.55 }); g.add(S.motes);

    // ---- the sheet. One burn map (R: paper left, G: burn progress) drives holes, char and embers on every piece of paper. ----
    S.burn = new Float32Array(NB * NB); S.burnD = new Uint8Array(NB * NB * 4); for (let c = 0; c < NB * NB; c++) { S.burnD[c * 4] = 255; S.burnD[c * 4 + 3] = 255; }
    S.burnT = new THREE.DataTexture(S.burnD, NB, NB); S.burnT.magFilter = S.burnT.minFilter = THREE.LinearFilter; S.burnT.needsUpdate = true;
    S.SU = { uBurn: { value: S.burnT }, uPatF: { value: 0 }, uPatB: { value: 1 }, uTime: { value: 0 }, uPin: { value: 0 }, uWashi: { value: new THREE.Color(0x6a7ab8) }, uMotif: { value: new THREE.Color(0x8c9cd4) }, uGold: { value: new THREE.Color(0xd8b060) }, uEmber: { value: new THREE.Color(0xff6a20).multiplyScalar(1.4) } }; S.mistU.uT = S.SU.uTime;
    const fib = W.bake(512, (u, v) => { const n = W.fbm(u * 6, v * 6, 5, 4, 6), s = W.fbm(u * 240, v * 60, 9, 2, 60), f = W.fbm(u * 120, v * 120, 3, 2, 120); return [n * 0.3 + f * 0.15 + (s > 0.72 ? 0.08 : 0), sat(0.86 + n * 0.1 + (s > 0.72 ? 0.08 : 0) + (f - 0.5) * 0.08), 0.9]; }, { dark: 0xd0c8ba, light: 0xffffff, strength: 1.2 });
    const sheetMat = (front, color, edge) => { const m = new THREE.MeshStandardMaterial({ map: fib.map, normalMap: fib.normalMap, color, roughness: 0.93, side: THREE.DoubleSide }); m.normalScale.set(0.28, 0.28);
      m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, S.SU); sh.uniforms.uSunV = S.sunV; sh.fragmentShader = sh.fragmentShader.replace('void main() {', SHEET + 'uniform vec3 uSunV; void main() {').replace('#include <map_fragment>', sheetBody(front, edge)).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=oEm+vec3(1.0,0.72,0.45)*0.45*diffuseColor.rgb*clamp(-dot(normal,uSunV),0.0,1.0);'); };
      m.customProgramCacheKey = () => 'orisheet' + front + (edge ? 'e' : ''); return m; };
    S.paperM = sheetMat(1, 0xd6c9ae); S.underM = sheetMat(0, 0x2e3e7c); S.edgeM = sheetMat(0, 0x2e3e7c, true); S.edgeM.vertexColors = true;
    S.poly = SQUARE(); S.folds = [];
    S.base = new THREE.Mesh(polyGeo(S.poly), S.paperM); S.base.receiveShadow = true; g.add(S.base);
    S.baseUnder = new THREE.Mesh(S.base.geometry, S.underM); S.baseUnder.position.y = -0.03; g.add(S.baseUnder);
    { // seen through the holes: a dark depth with ember glow just inside each torn rim
      const hg = new THREE.PlaneGeometry(2 * H, 2 * H); hg.rotateX(-PI / 2);
      const hm = new THREE.Mesh(hg, new THREE.ShaderMaterial({ uniforms: S.SU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
        fragmentShader: NZ + `uniform sampler2D uBurn; uniform vec3 uEmber; uniform float uTime; varying vec3 vW;
          void main(){ vec2 sp=vW.xz, uv=(sp+15.0)/30.0; vec2 bu=uv+(vec2(on2(sp*1.3),on2(sp*1.3+17.0))-0.5)*0.022+(vec2(on2(sp*7.0+3.0),on2(sp*7.0-5.0))-0.5)*0.007;
            float r=texture2D(uBurn,bu).r; float gl=smoothstep(0.26,0.44,r)*(1.0-smoothstep(0.44,0.5,r))*(0.75+0.25*sin(uTime*4.0+on2(sp*2.0)*12.0));
            vec3 c=uEmber*gl*0.7; gl_FragColor=vec4(c,gl); }` }));
      hm.position.y = -0.25; hm.renderOrder = 2; g.add(hm);
    }
    S.baseEdge = new THREE.Mesh(edgeGeo(S.poly, null, 0.4), S.edgeM); S.baseEdge.receiveShadow = true; g.add(S.baseEdge);
    S.land = [null, null];
    S.flaps = [0, 1].map(() => { const grp = new THREE.Group(), piv = new THREE.Group(); grp.add(piv); const top = new THREE.Mesh(polyGeo(SQUARE()), S.paperM), un = new THREE.Mesh(top.geometry, S.underM), ed = new THREE.Mesh(edgeGeo(SQUARE()), S.edgeM); top.receiveShadow = true; top.castShadow = true; un.receiveShadow = true; un.castShadow = true; un.position.y = -0.03; piv.add(top); piv.add(un); piv.add(ed); grp.visible = false; g.add(grp); return { grp, piv, top, un, ed, phi: 0, f: null, blots: [] }; });
    // ink: blots that ride the flap, and the prints they leave (feathered, pooled at the rim)
    S.inkU = { uIA: { value: new THREE.Color(0.03, 0.035, 0.08) }, uIB: { value: new THREE.Color(0.006, 0.008, 0.02) }, uIE: { value: new THREE.Color(0, 0, 0) }, uSh: { value: 0 } };
    const inkMat = (bar) => new THREE.ShaderMaterial({ uniforms: Object.assign({ uOp: { value: 0.94 } }, S.inkU), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: NZ + `uniform float uOp,uSh; uniform vec3 uIA,uIB,uIE; varying vec2 vUv; varying vec3 vW;
        void main(){ vec2 c=vUv-0.5; float d=${bar ? 'max(abs(c.x),abs(c.y))*2.0' : 'length(c)*2.0'};
          float n=on2(vW.xz*1.6)*0.6+on2(vW.xz*5.5)*0.4, lim=0.93+0.07*n;
          float a=1.0-smoothstep(lim-0.035,lim,d), rim=smoothstep(lim-0.2,lim-0.05,d);
          vec3 col=mix(uIA,uIB,rim)+uIA*(1.0-smoothstep(0.0,0.5,abs(d-0.42)))*(0.5+0.5*on2(vW.xz*3.0))+uIE*smoothstep(lim-0.3,lim-0.02,d)*(0.7+0.3*on2(vW.xz*4.0));
          float sw=dot(c,vec2(0.6,0.8))*2.0; col+=vec3(0.06,0.073,0.107)*uSh*exp(-((sw-0.25)/0.08)*((sw-0.25)/0.08))*(1.0-rim)*(0.6+0.4*on2(vW.xz*2.0));
          gl_FragColor=vec4(col,a*uOp); }` });
    S.inkC = inkMat(0); S.inkB = inkMat(1);
    const cg = new THREE.CircleGeometry(1, 40); cg.rotateX(-PI / 2); const bg = new THREE.PlaneGeometry(1, 1); bg.rotateX(-PI / 2);
    S.blotPool = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(cg, S.inkC); m.visible = false; m.renderOrder = 6; g.add(m); return m; });
    S.barPool = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(bg, S.inkB); m.visible = false; m.renderOrder = 6; g.add(m); return m; });
    S.prints = [];
    // crease marks: dashes along the crease, chevrons drifting across the flap toward it, a bright crease flash when it lifts
    S.dashM = [1.6, 0.5].map((k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(RED).multiplyScalar(k), transparent: true, opacity: k > 1 ? 0.95 : 0.55, depthWrite: false }));
    const dg = new THREE.PlaneGeometry(0.22, 1); dg.rotateX(-PI / 2); const chev = new THREE.CircleGeometry(0.55, 3); chev.rotateX(-PI / 2);
    S.dashes = [0, 1].map((k) => { const m = new THREE.InstancedMesh(dg, S.dashM[k], 40); m.count = 0; m.frustumCulled = false; m.renderOrder = 7; g.add(m); return m; });
    S.chevs = [0, 1].map((k) => { const m = new THREE.InstancedMesh(chev, S.dashM[k], 30); m.count = 0; m.frustumCulled = false; m.renderOrder = 7; g.add(m); return m; });
    const flg = new THREE.PlaneGeometry(1, 1); flg.rotateX(-PI / 2);
    S.cflash = [0, 1].map(() => { const m = new THREE.Mesh(flg, new THREE.ShaderMaterial({ uniforms: { opacity: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform float opacity; varying vec2 vUv; void main(){ float x=(vUv.x-0.5)*2.0; float e=smoothstep(0.0,0.06,vUv.y)*smoothstep(1.0,0.94,vUv.y); float a=(exp(-x*x*40.0)*2.2+exp(-x*x*5.0)*0.5)*e*opacity; gl_FragColor=vec4(vec3(1.0,0.9,0.62)*a,a); }' })); m.visible = false; m.renderOrder = 8; m.k = 0; g.add(m); return m; });
    S.ripM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    S.ripMesh = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64), S.ripM); m.rotation.x = -PI / 2; m.visible = false; m.renderOrder = 7; g.add(m); return m; }); S.ripples = [];

    // ---- Oriko: three folded forms ----
    const paperMat = (color, back, thin, o = {}, lf = -0.45, lb = -0.45) => {
      const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.82, metalness: 0, flatShading: true, side: THREE.DoubleSide }, o)), ub = { value: new THREE.Color(back) }, ut = { value: thin };
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uBack = ub; sh.uniforms.uThin = ut; sh.uniforms.uLF = { value: lf }; sh.uniforms.uLB = { value: lb }; sh.uniforms.uRimC = S.rimC; sh.uniforms.uSunV = S.sunV; sh.uniforms.uGlowC = S.glowC;
        sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute vec4 bary; varying vec4 vBary; varying vec3 vOP;\nvoid main() {\n vBary = bary; vOP = position;');
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', NZ + 'uniform vec3 uBack,uSunV,uGlowC,uRimC; uniform float uThin,uLF,uLB; varying vec4 vBary; varying vec3 vOP;\nvoid main() {')
          .replace('#include <color_fragment>', `#include <color_fragment>
            { if (!gl_FrontFacing) diffuseColor.rgb = uBack * (0.82 + 0.3 * step(0.62, on2(vOP.xz * 6.0 + vOP.y * 3.0)));
              float tw = vBary.w; diffuseColor.rgb *= (0.88 + 0.18 * tw) * mix(vec3(0.95, 0.98, 1.05), vec3(1.04, 1.0, 0.93), tw);
              float e = min(min(vBary.x, vBary.y), vBary.z), fw = max(fwidth(e), 1e-4), ln = 1.0 - smoothstep(fw * 0.5, fw * 1.7, e);
              diffuseColor.rgb *= (1.0 + (gl_FrontFacing ? uLF : uLB) * ln) * (0.94 + 0.06 * on2(vOP.xy * 11.0 + vOP.z * 7.0)); }`)
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float bl = clamp(-dot(normal, uSunV), 0.0, 1.0); totalEmissiveRadiance += uGlowC * uThin * bl * diffuseColor.rgb; vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRimC * fr * fr * fr; }');
      };
      m.customProgramCacheKey = () => 'oripaper'; return m;
    };
    const paper = paperMat(0xece6d8, 0xa82416, 0.55), red = paperMat(0xc82818, 0x5a0a06, 0.3), belly = paperMat(0x4a0806, 0x2a0404, 0.1), finM = paperMat(0xb82818, 0x8a1c10, 0.3, {}, 0.55, 0.55), ink = paperMat(0x22263a, 0x8a1a10, 0.1);
    S.paperMats = [paper, red];
    const part = (parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); q.rotation.set(rx, ry, rz); q.scale.setScalar(s); q.castShadow = true; parent.add(q); return q; };
    const bg2 = b.group; S.rigs = {};
    { // crane
      const r0 = new THREE.Group(), r = new THREE.Group(); bg2.add(r0); r0.add(r); r.scale.setScalar(1.2); S.rigs.crane = r0;
      part(r, solid([[0, 2.75, 1.05], [0, 2.75, -1.15], [-0.72, 2.66, 0], [0.72, 2.66, 0], [0, 3.22, -0.05], [0, 1.85, 0]], [[4, 0, 3], [4, 3, 1], [4, 1, 2], [4, 2, 0], [5, 3, 0], [5, 1, 3], [5, 2, 1], [5, 0, 2]], [0, 2.6, 0]), paper);
      part(r, spike([0, 2.65, 0.85], [0, 4.95, 2.3], 0.18), paper); part(r, spike([0, 4.86, 2.2], [0, 4.5, 3.2], 0.12), red);
      part(r, spike([0, 2.65, -0.95], [0, 4.4, -3.0], 0.18), paper);
      r.wings = [-1, 1].map((sx) => { const w = new THREE.Group(); w.position.set(sx * 0.3, 2.92, 0); r.add(w);
        const A = [0, 0, 0.9], Bk = [0, 0, -0.95], C = [sx * 2.3, 0.3, 0.35], T = [sx * 4.8, 0.55, -1.0], P1 = lp(T, C, 0.27), P2 = lp(T, Bk, 0.2);
        part(w, flat([[A, C, Bk], [C, P1, P2], [C, P2, Bk]]), paper); part(w, flat([[P1, T, P2]]), red); return w; }); r0.wings = r.wings;
      for (const sx of [-1, 1]) { // folded paper legs: thigh and shin strips with a knee fold, three-toed feet
        const Hh = [sx * 0.26, 2.1, 0.05], Kn = [sx * 0.42, 1.05, -0.22], Fo = [sx * 0.46, 0.04, 0.22], w = 0.075, st = (A, B) => flat([[[A[0] - w, A[1], A[2]], [A[0] + w, A[1], A[2]], [B[0] + w * 0.7, B[1], B[2]]], [[A[0] - w, A[1], A[2]], [B[0] + w * 0.7, B[1], B[2]], [B[0] - w * 0.7, B[1], B[2]]]], [0, 0, 1]);
        part(r, st(Hh, Kn), paper); part(r, st(Kn, Fo), paper); part(r, spike([Kn[0], Kn[1] + 0.08, Kn[2]], [Kn[0], Kn[1] - 0.12, Kn[2] - 0.1], 0.09), red);
        part(r, flat([[0, 0.42], [0.3, 0.26], [-0.3, 0.26], [0, -0.25]].map(([dx, dz]) => [[Fo[0] - 0.04, 0.03, Fo[2]], [Fo[0] + 0.04, 0.03, Fo[2]], [Fo[0] + dx, 0.03, Fo[2] + dz]])), paper);
      }
    }
    { // frog: an origami jumping frog
      const r = new THREE.Group(); bg2.add(r); S.rigs.frog = r; r.visible = false; const f = new THREE.Group(); f.scale.setScalar(1.5); r.add(f);
      const fp = paperMat(0xefe8d8, 0x3a4c94, 0.5, {}, -0.45, 0.9), cc = paperMat(0xefe8d8, 0xe4dccb, 0.5), indigo = paperMat(0x3e52a0, 0x1e2a5a, 0.2, {}, 0.9, 0.9), eyeB = paperMat(0x0c0c14, 0x0c0c14, 0);
      // body: a triangular head at the front, a peaked back with one centre ridge, steep sides, an indigo belly strip under the overhang
      const RG = [[0, 0.55, 2.05], [0.95, 0.55, 1.0], [1.08, 0.58, 0.3], [0.95, 0.58, -1.05], [0, 0.56, -1.55], [-0.95, 0.58, -1.05], [-1.08, 0.58, 0.3], [-0.95, 0.55, 1.0]];
      const FP = RG.concat([[0, 1.2, 0.65], [0, 1.3, -0.55]], RG.map((q) => [q[0] * 0.7, 0.3, q[2] * 0.7]), [[0, 0.28, 0]]), FO = [0, 0.6, 0];
      part(f, solid(FP, [[0, 1, 8], [1, 2, 8], [2, 3, 9], [2, 9, 8], [5, 6, 9], [6, 8, 9], [6, 7, 8], [7, 0, 8]], FO), fp); part(f, solid(FP, [[3, 4, 9], [4, 5, 9]], FO), indigo);
      part(f, solid(FP, RG.flatMap((_, i) => { const j = (i + 1) % 8; return [[i, j, 10 + j], [i, 10 + j, 10 + i], [10 + i, 10 + j, 18]]; }), FO), indigo);
      const mo = (e, t) => { const q = FP[e], n = FP[10 + e]; return [lerp(q[0], n[0], t) * 1.015, lerp(q[1], n[1], t), lerp(q[2], n[2], t) * 1.015]; };
      part(f, tg([[mo(0, 0.08), mo(1, 0.08), mo(1, 0.32)], [mo(0, 0.08), mo(1, 0.32), mo(0, 0.32)], [mo(0, 0.08), mo(7, 0.32), mo(7, 0.08)], [mo(0, 0.08), mo(0, 0.32), mo(7, 0.32)]], FO), eyeB); // wide ink mouth
      r.legs = [];
      for (const sx of [-1, 1]) {
        part(f, pz(new THREE.IcosahedronGeometry(0.26, 0)), fp, sx * 0.42, 0.95, 1.05).scale.set(1, 0.7, 1);
        part(f, pz(new THREE.IcosahedronGeometry(0.17, 1)), red, sx * 0.46, 1.12, 1.12);
        part(f, pz(new THREE.IcosahedronGeometry(0.08, 1)), eyeB, sx * 0.52, 1.18, 1.25);
        part(f, flat([[[sx * 0.95, 0.55, 0.75], [sx * 0.75, 0.5, 1.15], [sx * 2.0, 0.02, 2.3]]], [sx * 0.3, 1, 0]), cc); part(f, flat([[[sx * 0.95, 0.55, 0.75], [sx * 2.0, 0.02, 2.3], [sx * 2.35, 0.02, 1.5]]], [0, -1, 0]), cc);
        const lg = new THREE.Group(); lg.position.set(sx * 0.9, 0.45, -0.95); f.add(lg); r.legs.push(lg);
        const H1 = [0, 0.12, 0.35], H2 = [0, -0.1, -0.4], K = [sx * 0.95, 0.95, 0.25], A = [sx * 1.45, -0.43, -0.75], Ft = [sx * 2.2, -0.43, -1.45], Fs = [sx * 1.25, -0.43, -1.55];
        part(lg, flat([[H1, K, H2]], [sx, 0.3, 0]), cc); part(lg, flat([[K, A, H2]], [-sx, -0.3, 0]), fp); part(lg, flat([[A, Ft, Fs]]), red);
      }
    }
    { // dragon: a reared head on the boss, a coil of folded segments behind it in the world
      const r = new THREE.Group(); bg2.add(r); S.rigs.dragon = r; r.visible = false;
      const hd = new THREE.Group(); hd.position.set(0, 3.9, 0.9); hd.scale.setScalar(1.2); r.add(hd); r.head = hd;
      const HP = [[0, 0.05, 2.3], [0, 0.55, 1.35], [0, 0.85, 0.3], [0, 0.6, -0.75], [-0.68, 0.28, 0.25], [0.68, 0.28, 0.25], [-0.38, 0.0, 1.55], [0.38, 0.0, 1.55], [-0.5, -0.05, -0.45], [0.5, -0.05, -0.45]], HO = [0, 0.35, 0.5];
      part(hd, solid(HP, [[0, 7, 1], [0, 1, 6], [1, 7, 5], [1, 5, 2], [1, 2, 4], [1, 4, 6], [2, 5, 3], [2, 3, 4], [5, 9, 3], [4, 3, 8], [7, 9, 5], [6, 4, 8]], HO), paper);
      part(hd, solid(HP, [[0, 6, 7], [6, 8, 9], [6, 9, 7], [8, 3, 9]], HO), red);
      const jw = new THREE.Group(); jw.position.set(0, -0.05, -0.4); hd.add(jw); r.jaw = jw;
      const JP = [[0, -0.1, 2.5], [-0.4, 0, 1.8], [0.4, 0, 1.8], [-0.5, 0, 0], [0.5, 0, 0], [0, -0.45, 1.0]], JO = [0, -0.15, 1.0];
      part(jw, solid(JP, [[0, 1, 5], [0, 5, 2], [1, 3, 5], [2, 5, 4], [3, 4, 5]], JO), paper); part(jw, solid(JP, [[0, 2, 1], [1, 2, 4], [1, 4, 3]], JO), red);
      for (const sx of [-1, 1]) {
        for (const z of [1.25, 1.5]) part(hd, spike([sx * 0.33, 0.02, z], [sx * 0.31, -0.2, z + 0.04], 0.05), paper);
        part(hd, spike([sx * 0.3, 0.02, 1.8], [sx * 0.27, -0.36, 1.86], 0.07), paper);
        for (const z of [0.9, 1.3]) part(jw, spike([sx * 0.36, -0.02, z], [sx * 0.34, 0.2, z + 0.04], 0.05), paper);
        part(hd, spike([sx * 0.28, 0.75, 0.05], [sx * 0.85, 1.8, -1.65], 0.15), red); part(hd, spike([sx * 0.6, 0.35, -0.25], [sx * 1.3, 0.62, -1.4], 0.1), paper);
        part(hd, new THREE.TetrahedronGeometry(0.13, 0), W.glow(0xffb040, 2.2), sx * 0.43, 0.56, 0.78).castShadow = false;
      }
      part(hd, flat([[[0, 0.62, -0.5], [0, 1.45, -1.25], [0, 0.42, -1.4]], [[0, 0.4, -1.3], [0, 1.1, -2.1], [0, 0.2, -2.0]]], [1, 0, 0]), red);
      // whiskers: two long paper strips that stream back from the snout
      S.whN = 10; const wg = new THREE.BufferGeometry(), wi = [], wb = new Float32Array(2 * S.whN * 2 * 4).fill(0.33);
      for (let k = 0; k < 2; k++) for (let i = 0; i + 1 < S.whN; i++) { const o = (k * S.whN + i) * 2; wi.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
      wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * S.whN * 2 * 3), 3)); wg.setAttribute('bary', new THREE.BufferAttribute(wb, 4)); wg.setIndex(wi);
      S.whisk = new THREE.Mesh(wg, red); S.whisk.frustumCulled = false; hd.add(S.whisk);
      // accordion spine: a tapered six-sided tube per segment, each tucked into the next; red ridge on top, dark red belly
      const XS = [[0, 0.7], [0.75, 0.25], [0.6, -0.4], [0, -0.6], [-0.6, -0.4], [-0.75, 0.25]], RF = XS.map(([x, y]) => [x, y, 1.0]), RB = XS.map(([x, y]) => [x * 0.78, y * 0.78, -1.0]), qd = (i) => { const j = (i + 1) % 6; return [[RF[i], RF[j], RB[j]], [RF[i], RB[j], RB[i]]]; };
      const segG = tg([0, 1, 4, 5].flatMap(qd).concat([1, 2, 3, 4].map((i) => [RF[0], RF[i], RF[i + 1]])), [0, 0, 0]), bellyG = tg([2, 3].flatMap(qd), [0, 0, 0]);
      const finG = flat([[[0, 0.62, 0.5], [0.05, 0.86, -0.25], [0, 1.28, -0.95]], [[0.05, 0.86, -0.25], [0, 0.56, -0.55], [0, 1.28, -0.95]]], [1, 0, 0]), clawG = [-1, 1].map((sx) => mergeG([spike([sx * 0.55, -0.25, 0.2], [sx * 1.25, -1.05, 0.55], 0.13), spike([sx * 1.2, -1.0, 0.5], [sx * 1.35, -1.15, 1.0], 0.07)]));
      S.segs = Array.from({ length: 11 }, (_, k) => { const s = new THREE.Group(), sc = 1.55 * (1 - k * 0.068); s.rotation.order = 'YXZ'; const inr = new THREE.Group(); inr.scale.setScalar(sc); s.add(inr); part(inr, segG, paper); part(inr, bellyG, belly); part(inr, finG, finM).scale.y = 1.2 - k * 0.075;
        if (k === 10) for (const sx of [-1, 1]) { part(inr, flat([[[0, 0.1, -0.8], [sx * 1.6, 0.9, -3.4], [sx * 0.35, 0.15, -2.2]]], [0, 1, 0]), paper); part(inr, flat([[[sx * 1.6, 0.9, -3.4], [sx * 1.1, 0.62, -2.8], [sx * 0.9, 0.5, -3.0]]], [0, 1, 0]), red); } // forked paper tail-fin
        if (k === 1 || k === 6) for (const cgx of clawG) part(inr, cgx, paper); s.traverse((o) => { o.castShadow = false; }); s.visible = false; g.add(s); return s; });
      S.hist = [];
    }
    S.seal = part(bg2, new THREE.BoxGeometry(0.5, 0.5, 0.06), W.glow(RED, 2.5), 0, 2.6, 0); S.seal.castShadow = false; S.seal.visible = false;
    S.light = new THREE.PointLight(0xff8040, 0, 16, 1.6); S.light.position.set(0, 4.0, 3.4); bg2.add(S.light);
    S.sheet = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 0.9, side: THREE.DoubleSide })); S.sheet.visible = false; g.add(S.sheet);
    // soft contact shadow under the boss
    { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c), bgeo = new THREE.PlaneGeometry(1, 1); bgeo.rotateX(-PI / 2);
      S.blob = new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ map: t, color: 0x1a1420, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); S.blob.renderOrder = 5; g.add(S.blob); }

    // ---- paper life: a flock of cranes, hanging strings of cranes far out, drifting scraps, particles ----
    const mBody = solid([[0, 0, 0.36], [0, 0, -0.36], [-0.17, 0, 0], [0.17, 0, 0], [0, 0.16, 0], [0, -0.22, 0]], [[4, 0, 3], [4, 3, 1], [4, 1, 2], [4, 2, 0], [5, 3, 0], [5, 1, 3], [5, 2, 1], [5, 0, 2]], [0, 0, 0]);
    const mNT = mergeG([mBody, spike([0, 0, 0.25], [0, 0.5, 0.62], 0.05), spike([0, 0.45, 0.58], [0, 0.4, 0.75], 0.03), spike([0, 0, -0.25], [0, 0.42, -0.66], 0.05)]);
    const wingG = (sx, up) => flat([[[sx * 0.04, 0.04, 0.26], [sx * 0.04, 0.04, -0.26], [sx * 1.0, up, -0.28]]]);
    const mini = mergeG([mNT, wingG(-1, 0.32), wingG(1, 0.32)]), miniMat = paperMat(0xf0ebe0, 0xb02818, 0.4);
    const inst = (geo, mat, n, shadow) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); m.frustumCulled = false; m.castShadow = !!shadow; g.add(m); return m; };
    const PAL = [0xf2ede2, 0xf2ede2, 0xc8301c, 0x34468a, 0xd8a840, 0xe8a0a0];
    S.flock = { body: inst(mNT, miniMat, 44), wl: inst(wingG(-1, 0), miniMat, 44), wr: inst(wingG(1, 0), miniMat, 44), D: [] };
    for (let i = 0; i < 44; i++) { const d = { R: 30 + vr() * 42, y: -8 + vr() * 24, w: (0.08 + vr() * 0.1) * (i % 3 ? 1 : -1), ph: vr(TAU), s: 0.7 + vr() * 0.6, f: vr(TAU), grp: i % 4 }; d.R += d.grp * 3; S.flock.D.push(d); _c.set(i % 5 ? 0xf2ede2 : vpick(PAL)); for (const k of ['body', 'wl', 'wr']) S.flock[k].setColorAt(i, _c); }
    { const nS = 6, per = 12, m = inst(mini, miniMat, nS * per), lp2 = []; let n = 0;
      for (let s = 0; s < nS; s++) { const a = s / nS * TAU + 0.31, R = 47 + (s % 3) * 4, x = Math.sin(a) * R, z = Math.cos(a) * R; lp2.push(x, 40, z, x, 22 - per * 1.6, z);
        for (let k = 0; k < per; k++) { _e.set(0, a + k * 0.9, 0); _q.setFromEuler(_e); _a.set(x, 22 - (k + 1) * 1.6, z); _s.setScalar(1.7); _m4.compose(_a, _q, _s); m.setMatrixAt(n, _m4); m.setColorAt(n, _c.set(PAL[(s + k) % PAL.length])); n++; } }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp2, 3)); g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3a3236 }))); S.strings = m; }
    S.scrap = { m: inst(pz(new THREE.PlaneGeometry(0.42, 0.42)), miniMat, 70), D: Array.from({ length: 70 }, () => ({ x: vr(-36, 36), y: vr(-4, 26), z: vr(-36, 36), v: vr(0.4, 0.9), ph: vr(TAU), w: vr(0.6, 2), s: vr(0.3, 0.75) })), lvl: -1 };
    // riders for bullets: paper darts and paper cranes
    S.dartI = inst(mergeG([flat([[[0, 0, 0.62], [-0.34, 0.03, -0.5], [0, 0.0, -0.5]], [[0, 0, 0.62], [0, 0.0, -0.5], [0.34, 0.03, -0.5]]]), flat([[[0, 0, 0.62], [0, 0, -0.5], [0, -0.16, -0.42]]], [1, 0, 0])]), paperMat(0xc8b89c, 0xc02a18, 0.1), 60);
    S.craneI = inst(mini, paperMat(0xc4b498, 0xb02818, 0.1), 80); S.riders = new Set();
    S.dartT = inst(mergeG([flat([[[0, 0.012, 0.62], [-0.13, 0.03, 0.2], [0.13, 0.03, 0.2]]]), flat([[[0, -0.01, 0.62], [0, -0.04, 0.25], [0, -0.13, -0.35]]], [1, 0, 0])]), red, 60);
    S.craneT = inst(mergeG([-1, 1].map((sx) => flat([[[sx * 1.0, 0.33, -0.28], [sx * 0.72, 0.255, -0.275], [sx * 0.76, 0.25, -0.12]]]))), red, 80);
    // particles: lit paper flakes (confetti, shards, ink drops, ash) and additive sparks/embers
    const mkPool = (geo, mat, N) => { const m = inst(geo, mat, N); m.count = 0; return { m, N, P: Array.from({ length: N }, () => ({ life: 0, c: new THREE.Color() })), i: 0 }; };
    S.pp = mkPool(pz(new THREE.CircleGeometry(1, 3)), paperMat(0xffffff, 0xd0c8b8, 0.2), 420);
    S.gp = mkPool(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 320);
    // loose paper strips that whip around the dragon
    { const rg = new THREE.PlaneGeometry(0.16, 2.6, 1, 12), p = rg.attributes.position; // thin twisting ribbons, tapering to nothing at both ends
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), w = Math.max(0.05, 1 - Math.pow(Math.abs(y) / 1.3, 2)), tw = y * 1.8; p.setXYZ(i, x * w * Math.cos(tw), y, x * w * Math.sin(tw) + Math.sin(y * 2.2) * 0.3); }
      S.strips = inst(pz(rg), paperMat(0xf0e9da, 0xc02818, 0.5), 12); S.strips.visible = false; }

    Object.assign(S, { form: 'crane', lvl: 0, pend: null, safe: null, foldN: 0, fly: 0, hopY: 0, wing: 0, orbit: 0, creepT: 0, skyT: null, burning: false, dying: 0, emT: 0 });
    S.skyT = MOOD[0]; moodStep(S, 1e3);
    return {
      edge: 'fall', spawn: { x: 0, z: 10 }, bossStart: { x: 0, z: -6, face: 0 }, camDist: 16,
      contains(x, z) { if (!inSq(x, z)) return false; for (const f of S.folds) if (side(f, x, z) < 0) return false; const c = burnIdx(x, z); return c < 0 || S.burn[c] < 1; },
      bulletBounds: (x, z) => inSq(x, z, -6),
      camLimit(x, y, z) { return { x: clamp(x, -40, 40), y: Math.max(y, 0.5), z: clamp(z, -40, 40) }; },
    };
  }

  // ---------- particles ----------
  function spray(pl, x, y, z, o) {
    if (G.headless || !pl) return;
    for (let k = 0; k < o.n; k++) {
      const q = pl.P[pl.i]; pl.i = (pl.i + 1) % pl.N; const a = vr(TAU), sp = vr(o.speed[0], o.speed[1]), rr = o.rad ? Math.sqrt(vrand()) * o.rad : 0;
      if (o.line) { const u = vrand(); q.x = lerp(o.line[0], o.line[2], u); q.z = lerp(o.line[1], o.line[3], u); } else { q.x = x + Math.sin(a) * rr; q.z = z + Math.cos(a) * rr; }
      q.y = y + vr(0, o.h || 0); q.vx = Math.sin(a) * sp; q.vz = Math.cos(a) * sp; q.vy = vr(o.up[0], o.up[1]);
      q.life = q.max = vr(o.life[0], o.life[1]); q.s = vr(o.size[0], o.size[1]); q.g = o.grav === undefined ? 5 : o.grav; q.dr = o.drag === undefined ? 1.5 : o.drag; q.fl = o.flut || 0;
      q.rx = vr(TAU); q.ry = vr(TAU); q.rz = vr(TAU); q.wx = vr(-9, 9); q.wy = vr(-9, 9); q.wz = vr(-9, 9); q.land = !!o.land; q.down = false; q.c.set(vpick(o.cols)); q.ph = vr(TAU);
    }
  }
  function stepPool(pl, dt, t) {
    let n = 0; const m = pl.m;
    for (const q of pl.P) {
      if (q.life <= 0) continue; q.life -= dt; if (q.life <= 0) continue;
      if (!q.down) {
        const dk = Math.exp(-q.dr * dt); q.vx *= dk; q.vz *= dk; q.vy = q.vy * dk - q.g * dt;
        if (q.fl) { q.vx += Math.sin(t * 5 + q.ph) * q.fl * dt; q.vz += Math.cos(t * 4.3 + q.ph) * q.fl * dt; }
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.rx += q.wx * dt; q.ry += q.wy * dt; q.rz += q.wz * dt;
        if (q.land && q.vy < 0 && q.y < 0.05 && q.y > -0.5 && G.arena && G.arena.contains(q.x, q.z)) { q.down = true; q.y = 0.03 + vrand() * 0.02; q.rx = -PI / 2; q.rz = 0; q.life = Math.min(q.life, 0.9); q.max = Math.max(q.max, 1); }
      }
      const s = q.s * Math.min(1, q.life / Math.min(0.4, q.max * 0.5));
      _e.set(q.rx, q.ry, q.rz, 'YXZ'); _q.setFromEuler(_e); _s.set(s, s, s); _a.set(q.x, q.y, q.z); _m4.compose(_a, _q, _s); m.setMatrixAt(n, _m4); m.setColorAt(n, q.c); n++;
    }
    m.count = n; if (n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
  const paperCols = (S) => [S.paperM.color.getHex(), S.lvl === 0 ? 0xe8dcc4 : S.underM.color.getHex(), 0xf2ede2, RED];

  // ---------- burning ----------
  function ignite(S, x, z) { const c = burnIdx(x, z); if (c >= 0 && S.burn[c] === 0 && Math.max(Math.abs(x), Math.abs(z)) > 5.5) S.burn[c] = 0.001; }
  function burnStep(S, dt) {
    let dirty = false;
    for (let c = 0; c < S.burn.length; c++) { const v = S.burn[c]; if (v > 0 && v < 1) { const n = Math.min(1, v + dt / 2.8); S.burn[c] = n; dirty = true; S.burnD[c * 4] = n >= 1 ? 0 : 255; S.burnD[c * 4 + 1] = n >= 1 ? 0 : Math.round(255 * n);
      if (n >= 1 && !G.headless) { const x = -H + (c % NB + 0.5) * CELL, z = -H + (Math.floor(c / NB) + 0.5) * CELL;
        spray(S.gp, x, 0.1, z, { n: 10, rad: 0.8, cols: [0xff8030, 0xffb050, 0xff4010], speed: [0.4, 2.5], up: [1.5, 4], grav: 1.5, drag: 1.2, life: [0.5, 1.4], size: [0.04, 0.1] });
        spray(S.pp, x, 0.1, z, { n: 6, rad: 0.7, cols: [0x1a1410, 0x2a1e18, 0x3a2a20], speed: [0.3, 1.5], up: [1, 3], grav: -0.6, drag: 1.5, flut: 3, life: [1.5, 3], size: [0.08, 0.18] }); } } }
    if (dirty) S.burnT.needsUpdate = true;
  }
  function creep(S, n) {
    const cand = []; for (let j = 0; j < NB; j++) for (let i = 0; i < NB; i++) { if (S.burn[j * NB + i] > 0) continue; let edge = i === 0 || j === 0 || i === NB - 1 || j === NB - 1; if (!edge) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (S.burn[(j + dz) * NB + i + dx] >= 1) edge = true; if (edge) cand.push([i, j]); }
    for (let k = 0; k < n && cand.length; k++) { const q = cand.splice(Math.floor(rnd(cand.length)), 1)[0]; ignite(S, -H + (q[0] + 0.5) * CELL, -H + (q[1] + 0.5) * CELL); }
  }

  // ---------- the fold ----------
  // Plan creases and ink. o: {mode: 0 straight/diagonal, 1 any angle, 2 double; T}
  function planFold(b, o) {
    const S = b.state, p = G.player, reach = Math.max(7, (o.T - 1.2) * 7 * 0.7), pts = [];
    for (let x = -H + 0.75; x < H; x += 1.5) for (let z = -H + 0.75; z < H; z += 1.5) { const c = burnIdx(x, z); if (c < 0 || S.burn[c] === 0) pts.push([x, z]); }
    const mk = (ang, off, flip) => { const nx = Math.sin(ang) * flip, nz = Math.cos(ang) * flip; return { cx: Math.sin(ang) * off, cz: Math.cos(ang) * off, nx, nz }; };
    for (let attempt = 0; attempt < 120; attempt++) {
      const n = o.mode === 2 ? 2 : 1, creases = [], blots = [[], []]; let live = pts, ok = true, a0 = 0;
      for (let k = 0; k < n && ok; k++) {
        const ang = o.mode === 0 ? pick([0, PI / 2, PI / 4, -PI / 4]) : (k ? a0 + pick([PI / 4, PI / 2, -PI / 4, 3 * PI / 8, -3 * PI / 8]) : rndi(0, 7) * PI / 8); a0 = ang;
        let f = mk(ang, rnd(-5.5, 5.5), 1); const pos = live.filter((q) => side(f, q[0], q[1]) > 0).length, frac = pos / Math.max(1, live.length);
        if (o.mode === 0 ? frac < 0.5 : (o.mode === 1 && rnd() < 0.5)) f = mk(ang, -(f.cx * Math.sin(ang) + f.cz * Math.cos(ang)), -1), f.cx = -f.cx, f.cz = -f.cz;
        const base = live.filter((q) => side(f, q[0], q[1]) > 0.4), flap = live.filter((q) => side(f, q[0], q[1]) < -0.4);
        if (base.length < live.length * (n === 2 ? 0.5 : 0.36) || flap.length < live.length * 0.2) { ok = false; break; }
        const want = o.mode === 0 ? rndi(2, 3) : o.mode === 1 ? rndi(4, 5) : (k ? 2 : 3);
        for (let t = 0; t < 60 && blots[k].length < want; t++) {
          const q = pick(flap), bar = o.mode > 0 && rnd() < 0.35, bl = bar ? { bar: true, x: q[0], z: q[1], dir: rnd(PI), len: rnd(9, 14), w: 2.6 } : { x: q[0], z: q[1], r: rnd(3.0, 4.6) };
          const m = mirror(f, bl); if (!inSq(m.x, m.z, 1) || side(f, bl.x, bl.z) > -(bar ? 1.4 : Math.min(bl.r, 2.2))) continue;
          if (blots[k].some((e) => Math.hypot(e.x - bl.x, e.z - bl.z) < 3.2)) continue;
          blots[k].push(bl);
        }
        if (blots[k].length < Math.min(2, want)) { ok = false; break; }
        creases.push(f); live = base;
      }
      if (!ok) continue;
      // prints of fold 1; the ones that land on flap 2 are still wet and print again
      const prints = [blots[0].map((q) => mirror(creases[0], q)), []];
      if (n === 2) { const wet = prints[0].filter((q) => side(creases[1], q.x, q.z) < 0); prints[1] = blots[1].concat(wet).map((q) => mirror(creases[1], q)); }
      const safe = live.filter((q) => !prints[0].some((e) => inBlot(e, q[0], q[1])) && !prints[1].some((e) => inBlot(e, q[0], q[1])));
      let near = 1e9; for (const q of safe) { const d = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z); if (d < near) near = d; }
      if (safe.length < 12 || safe.length > live.length * 0.7 || near > reach) continue;
      let mx = 0, mz = 0; for (const q of live) { mx += q[0]; mz += q[1]; }
      return { creases, blots, prints, safe, home: [mx / live.length, mz / live.length] };
    }
    return null;
  }
  function setupFlap(S, k, f, poly) {
    const F = S.flaps[k], th = Math.atan2(-f.nx, -f.nz), X = [Math.cos(th), -Math.sin(th)], fp = clipPoly(poly, f, false);
    F.f = f; F.fp = fp; F.th = th; F.phi = 0; F.grp.position.set(f.cx, 0.012 * (k + 1), f.cz); F.grp.rotation.y = th; F.piv.rotation.x = 0; F.grp.visible = fp.length >= 3;
    F.toLocal = (x, z) => [(x - f.cx) * X[0] + (z - f.cz) * X[1], -side(f, x, z)];
    F.top.geometry.dispose(); F.top.geometry = F.un.geometry = polyGeo(fp, F.toLocal, 3); F.ed.geometry.dispose(); F.ed.geometry = edgeGeo(fp, F.toLocal); F.curl = 0;
    F.p0 = [F.top.geometry, F.ed.geometry].map((q) => q.attributes.position.array.slice()); F.zMax = 1; for (let i = 2; i < F.p0[0].length; i += 3) F.zMax = Math.max(F.zMax, F.p0[0][i]);
    // dashes along the crease inside the sheet
    const seg = clipPoly(poly, f, true).filter((q) => Math.abs(side(f, q[0], q[1])) < 1e-4), D = S.dashes[k], Cv = S.chevs[k], M = new THREE.Object3D(); let n = 0;
    if (seg.length >= 2) { const [A, B] = seg, len = Math.hypot(B[0] - A[0], B[1] - A[1]), cnt = Math.min(40, Math.floor(len / 1.5)); for (let i = 0; i < cnt; i++) { const t = (i + 0.5) / cnt; M.position.set(lerp(A[0], B[0], t), 0.06, lerp(A[1], B[1], t)); M.rotation.set(0, Math.atan2(B[0] - A[0], B[1] - A[1]), 0); M.scale.set(1, 1, 0.9); M.updateMatrix(); D.setMatrixAt(n++, M.matrix); } F.seg = [A, B]; }
    D.count = n; D.instanceMatrix.needsUpdate = true; Cv.count = 0; F.chevK = 0;
  }
  function putBlot(S, F, q, k) {
    const m = (q.bar ? S.barPool : S.blotPool).find((e) => !e.visible); if (!m) return null;
    m.visible = true; m.material = q.bar ? S.inkB : S.inkC; if (F) { const l = F.toLocal(q.x, q.z); F.piv.add(m); m.position.set(l[0], 0.03, l[1]); m.rotation.y = q.bar ? q.dir - F.th : 0; } else { G.world.add(m); m.position.set(q.x, 0.035, q.z); m.rotation.y = q.bar ? q.dir : 0; }
    if (q.bar) m.scale.set(q.w, 1, q.len); else m.scale.set(q.r, 1, q.r);
    return m;
  }
  function clearInk(S) { for (const m of S.blotPool.concat(S.barPool)) { m.visible = false; if (m.parent !== G.world) G.world.add(m); } S.prints.length = 0; for (const F of S.flaps) F.blots = []; }
  function baseGeo(S, P) { S.base.geometry.dispose(); S.base.geometry = S.baseUnder.geometry = polyGeo(P); S.baseEdge.geometry.dispose(); S.baseEdge.geometry = edgeGeo(P, null, 0.4); }
  function setFloor(S, folds) { S.folds = folds; let P = SQUARE(); for (const f of folds) P = clipPoly(P, f, true); S.poly = P; baseGeo(S, P); }
  // ---------- landed paper: once a flap is down it is redrawn where it really lies (world UVs, so the real holes show through),
  // and whatever hangs past the floor's edge drapes down over it like a tablecloth, so what looks like floor is floor ----------
  const DROOP = 1.4;
  function clearLand(S, k) { const L = S.land[k]; if (!L) return; L.grp.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); L.grp.removeFromParent(); S.land[k] = null; }
  function edgeLines(P) { // a convex polygon's edges as half-planes, side > 0 inside
    let cx = 0, cz = 0; for (const q of P) { cx += q[0]; cz += q[1]; } cx /= P.length; cz /= P.length; const out = [];
    for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length], dx = B[0] - A[0], dz = B[1] - A[1], len = Math.hypot(dx, dz); if (len < 1e-3) continue;
      let nx = -dz / len, nz = dx / len; if ((cx - A[0]) * nx + (cz - A[1]) * nz < 0) { nx = -nx; nz = -nz; } out.push({ cx: A[0], cz: A[1], nx, nz }); }
    return out;
  }
  // floor: the walkable polygon to drape over; cut: a later crease whose flap has carried part of this paper away
  function buildLand(S, k, floor, cut, settled) {
    clearLand(S, k); const F = S.flaps[k]; if (G.headless || !F.fp || F.fp.length < 3) return false;
    let R = F.fp.map((q) => refl(F.f, q[0], q[1])); if (cut) R = clipPoly(R, cut, true); if (R.length < 3) return false;
    const grp = new THREE.Group(), y = 0.012 * (k + 1) + 0.03, L = { grp, drapes: [], rise: -1 }, hinges = []; grp.position.y = y; G.world.add(grp); S.land[k] = L;
    for (const e of edgeLines(floor)) {
      const out = clipPoly(R, e, false); R = clipPoly(R, e, true); if (out.length < 3) continue;
      let deep = 0; for (const q of out) deep = Math.max(deep, -side(e, q[0], q[1])); if (deep < 0.3) continue; hinges.push(e);
      const th = Math.atan2(-e.nx, -e.nz), X = [Math.cos(th), -Math.sin(th)], toL = (x, z) => [(x - e.cx) * X[0] + (z - e.cz) * X[1], -side(e, x, z)];
      const dg = new THREE.Group(), piv = new THREE.Group(); dg.position.set(e.cx - e.nx * 0.02 * k, 0, e.cz - e.nz * 0.02 * k); dg.rotation.y = th; dg.add(piv); grp.add(dg);
      const top = new THREE.Mesh(polyGeo(out, toL, 1), S.underM), ed = new THREE.Mesh(edgeGeo(out, toL), S.edgeM); top.castShadow = true; top.receiveShadow = true; piv.add(top); piv.add(ed);
      L.drapes.push({ piv, t: settled ? 1 : 0 }); piv.rotation.x = settled ? DROOP : 0;
    }
    if (R.length >= 3) {
      const on = (e, q) => Math.abs(side(e, q[0], q[1])) < 1e-3, keep = (A, B) => !hinges.some((e) => on(e, A) && on(e, B));
      const m = new THREE.Mesh(polyGeo(R), S.underM), ed = new THREE.Mesh(edgeGeo(R, null, 0.14, keep), S.edgeM); m.receiveShadow = true; grp.add(m); grp.add(ed); L.flat = [m, ed];
    }
    return true;
  }
  function landStep(S, dt) {
    for (let k = 0; k < 2; k++) { const L = S.land[k]; if (!L) continue;
      if (L.rise >= 0) { L.rise += dt; const q = 1 - smooth(clamp(L.rise / 0.12, 0, 1)); for (const d of L.drapes) d.piv.rotation.x = Math.min(d.piv.rotation.x, DROOP * q); if (L.rise >= 0.12) clearLand(S, k); continue; }
      for (const d of L.drapes) if (d.t < 1) { d.t = Math.min(1, d.t + dt / 0.25); const u = d.t - 1, c = 1.2; d.piv.rotation.x = DROOP * (1 + (c + 1) * u * u * u + c * u * u); } // ease out with a little overshoot
    }
  }
  function resetSheet(S) { clearLand(S, 0); clearLand(S, 1); setFloor(S, []); for (const F of S.flaps) { F.grp.visible = false; F.phi = 0; F.anim = null; } for (const d of S.dashes.concat(S.chevs)) d.count = 0; clearInk(S); S.pend = null; S.safe = null; }
  function creaseFx(S, k, lift) {
    const F = S.flaps[k]; if (G.headless || !F.seg) return; const [A, B] = F.seg, len = Math.hypot(B[0] - A[0], B[1] - A[1]), m = S.cflash[k];
    if (lift) { m.visible = true; m.k = 1; m.position.set((A[0] + B[0]) / 2, 0.08, (A[1] + B[1]) / 2); m.rotation.y = Math.atan2(B[0] - A[0], B[1] - A[1]); m.scale.set(1.4, 1, len); }
    spray(S.pp, 0, 0.15, 0, { line: [A[0], A[1], B[0], B[1]], n: lift ? 50 : 70, cols: paperCols(S), speed: [1.5, lift ? 4 : 7], up: [2.5, lift ? 6 : 8], grav: 4.5, drag: 1.6, flut: 4, life: [1.4, 2.6], size: [0.1, 0.24], land: true });
  }

  function* fold(b, o) {
    const S = b.state, p = G.player, pl = planFold(b, o); if (!pl) { yield 0.6; return; }
    const n = pl.creases.length, T = o.T, teach = S.foldN < 2; S.foldN++;
    S.inFold = true; b.autoFace = true;
    yield* jumpTo(b, pl.home[0], pl.home[1], 0.7);
    let poly = S.poly;
    for (let k = 0; k < n; k++) { setupFlap(S, k, pl.creases[k], poly); poly = clipPoly(poly, pl.creases[k], true); S.flaps[k].blots = pl.blots[k].map((q) => putBlot(S, S.flaps[k], q)); S.flaps[k].lit = k === 0; }
    Sound.sfx('charge', 0.5, 0.6);
    const t0 = G.now, ev = [];
    for (let k = 0; k < n; k++) { const at = t0 + T + k * 1.5, f = pl.creases[k]; ev.push({ at, test: (x, z) => side(f, x, z) < 0 }); ev.push({ at: at + 0.5, test: (x, z) => pl.prints[k].some((e) => inBlot(e, x, z)) }); }
    S.pend = ev; S.safe = pl.safe;
    if (teach) for (const q of pl.prints[0]) Hz.mark(q.bar ? { type: 'rect', x: q.x - Math.sin(q.dir) * q.len / 2, z: q.z - Math.cos(q.dir) * q.len / 2, dir: q.dir, len: q.len, w: q.w } : { type: 'circle', x: q.x, z: q.z, r: q.r }, T + 0.5, { color: 0x30407a });
    let r = yield* b.cast({ name: n === 2 ? 'Thousandth Fold' : 'Fold', time: T }); if (r === 'dead') return;
    for (let k = 0; k < n; k++) {
      const f = pl.creases[k], F = S.flaps[k]; F.lit = true;
      // the flap lifts: anyone still on it is thrown onto the rest of the sheet
      Sound.sfx('wave', 0.9, 1.6); Sound.sfx('slash', 0.7, 0.5);
      if (p.alive && side(f, p.pos.x, p.pos.z) < 0 && G.arena.contains(p.pos.x, p.pos.z)) { const dist = -side(f, p.pos.x, p.pos.z) + 3; p.hurt(300, { blockable: false, src: { name: 'The Fold' } }); if (p.alive) { p.kb = { vx: f.nx * dist / 0.38, vz: f.nz * dist / 0.38, t: 0.38 }; p.casting = null; p.dash = null; } }
      F.anim = { t: 0, from: 0, to: -PI, dur: 0.5 }; S.dashes[k].count = 0; S.chevs[k].count = 0;
      if (!G.headless) { let P = SQUARE(); for (const c of pl.creases.slice(0, k + 1)) P = clipPoly(P, c, true); baseGeo(S, P); creaseFx(S, k, true); for (let j = 0; j < k; j++) if (S.land[j]) buildLand(S, j, P, f, true); } // the lifted flap leaves the void behind it (visual only)
      yield 0.5;
      // slam: wet ink prints at its mirror image
      setFloor(S, pl.creases.slice(0, k + 1)); Sound.sfx('bigboom', 0.9, 1.3); FX.shake(0.7); creaseFx(S, k, false);
      if (!G.headless) { buildLand(S, k, S.poly, null, false); F.grp.visible = false; F.piv.rotation.x = -PI; F.anim = null; }
      for (const m of F.blots) if (m) { m.visible = false; G.world.add(m); }
      const stay = [];
      pl.prints[k].forEach((q) => {
        const wet = k + 1 < n && side(pl.creases[k + 1], q.x, q.z) < 0, m = putBlot(S, wet ? S.flaps[k + 1] : null, q);
        if (m) { if (wet) stay.push(m); else S.prints.push({ m, t: 2.6 }); }
        spray(S.pp, q.x, 0.15, q.z, { n: 22, rad: q.bar ? 2.5 : q.r * 0.75, cols: [INK, 0x141a3a, 0x05060c], speed: [2, 7], up: [1.5, 5], grav: 16, drag: 1.5, life: [0.4, 0.9], size: [0.08, 0.2], land: true });
      });
      if (k + 1 < n) S.flaps[k + 1].blots = S.flaps[k + 1].blots.concat(stay);
      if (p.alive && pl.prints[k].some((e) => inBlot(e, p.pos.x, p.pos.z))) p.hurt(380, { blockable: true, src: { name: 'Wet Ink' } });
      F.fade = 0.6;
      if (k + 1 < n) yield 1.0;
    }
    S.pend = null; S.safe = null; S.inFold = false;
    Co.start(function* () { yield o.hold || 3; yield* unfold(b); }, 'phase');
    yield 0.7;
  }
  function* unfold(b) {
    const S = b.state; if (!S.folds.length) return;
    for (const L of S.land) if (L) { L.rise = 0; if (L.flat) for (const m of L.flat) m.visible = false; }
    for (const F of S.flaps) if (F.f && S.folds.includes(F.f)) { F.grp.visible = true; F.piv.rotation.x = -PI; F.anim = { t: 0, from: -PI, to: 0, dur: 0.6 }; for (const m of F.blots) if (m) { m.visible = false; G.world.add(m); } F.blots = []; }
    Sound.sfx('wave', 0.6, 1.2); yield 0.6;
    clearLand(S, 0); clearLand(S, 1); setFloor(S, []); for (const F of S.flaps) F.grp.visible = false;
  }

  // ---------- forms ----------
  function* refold(b, to) {
    const S = b.state; if (S.form === to) return; const cur = S.rigs[S.form], nx = S.rigs[to];
    Sound.sfx('slash', 0.8, 1.6); for (let t = 0; t < 0.3; t += G.dt) { const k = 1 - t / 0.3; cur.scale.set(k, Math.max(0.03, k * k), k); cur.rotation.y += G.dt * 14; yield; }
    cur.visible = false; cur.scale.setScalar(1); cur.rotation.y = 0; nx.visible = true; S.form = to; S.seal.visible = false;
    spray(S.pp, b.pos.x, 2.5, b.pos.z, { n: 90, rad: 1.2, h: 1.5, cols: [0xf2ede2, 0xe8e0d0, RED, S.underM.color.getHex()], speed: [3, 10], up: [2, 8], grav: 4, drag: 1.4, flut: 5, life: [1.2, 2.6], size: [0.12, 0.3], land: true });
    if (to === 'dragon') spray(S.gp, b.pos.x, 2, b.pos.z, { n: 60, rad: 1.5, h: 2, cols: [0xff7020, 0xffb050, 0xff3010], speed: [2, 7], up: [2, 7], grav: 1, drag: 1.2, life: [0.6, 1.6], size: [0.05, 0.14] });
    for (const s of S.segs) s.visible = to === 'dragon'; if (to === 'dragon') S.hist.length = 0;
    for (let t = 0; t < 0.3; t += G.dt) { const k = t / 0.3; nx.scale.set(k, k * k, k); nx.rotation.y = (1 - k) * 4; yield; }
    nx.scale.setScalar(1); nx.rotation.y = 0; Sound.sfx('clap', 0.8);
  }
  function* jumpTo(b, x, z, dur = 0.6) {
    const S = b.state, x0 = b.pos.x, z0 = b.pos.z; if (Math.hypot(x - x0, z - z0) < 1.5) return;
    for (let t = 0; t < dur; t += G.dt) { const k = smooth(t / dur); b.pos.x = lerp(x0, x, k); b.pos.z = lerp(z0, z, k); S.hopY = Math.sin(k * PI) * 3.5; yield; }
    b.pos.x = x; b.pos.z = z; S.hopY = 0;
  }
  function* darts(b, n = 3) {
    const S = b.state; yield* b.cast({ name: 'Paper Darts', time: 0.7 });
    for (let k = 0; k < n; k++) { const a = b.angToPlayer(), sp = Math.max(0.2, 1.8 / Math.max(1, b.distToPlayer())); S.wing = 1; for (let i = -2; i <= 2; i++) { const q = Bul.fire({ x: b.pos.x + Math.sin(a) * 0.6, z: b.pos.z + Math.cos(a) * 0.6, dir: a + (i + (k % 2 ? 0.5 : 0)) * sp, speed: 13, r: 0.34, dmg: 90, color: RED, life: 3 }); if (q) q.pf = 1; } Sound.sfx('slash', 0.6, 1.5); yield 0.5; }
    yield 0.5;
  }
  function* wingcut(b) {
    const S = b.state, dir = b.angToPlayer(); b.autoFace = false; S.wing = -1;
    Hz.cone(b.pos.x, b.pos.z, dir, 2.2, 9.5, 1.2, 320, { name: 'Wingcut', onFire() { Sound.sfx('sword', 1, 0.8); FX.shake(0.4); S.wing = 1;
      for (let i = 0; i < 5; i++) { const a = dir + (i - 2) * 0.42, d = 3 + i % 2 * 3; spray(S.pp, b.pos.x + Math.sin(a) * d, 0.6, b.pos.z + Math.cos(a) * d, { n: 8, rad: 1.2, cols: paperCols(S), speed: [2, 6], up: [1, 4], grav: 5, drag: 1.8, flut: 3, life: [0.8, 1.6], size: [0.08, 0.2], land: true }); } } });
    yield* b.cast({ name: 'Wingcut', time: 1.2 }); yield 0.6; b.autoFace = true;
  }
  function* glide(b, n = 1) {
    const S = b.state, p = G.player; yield* b.cast({ name: 'Glide', time: 0.6 }); b.targetable = false; b.autoFace = false; S.fly = 1;
    for (let k = 0; k < n; k++) {
      const a = rnd(TAU), sx = Math.sin(a), sz = Math.cos(a), x0 = p.pos.x - sx * 24, z0 = p.pos.z - sz * 24; b.facing = a;
      Hz.rect(x0, z0, a, 48, 4.6, 1.5, 340, { name: 'Glide', onFire() { Sound.sfx('dash', 1, 0.6); } });
      for (let t = 0; t < 1.5; t += G.dt) { b.pos.x = damp(b.pos.x, x0 - sx * 6, 4, G.dt); b.pos.z = damp(b.pos.z, z0 - sz * 6, 4, G.dt); yield; }
      for (let t = 0; t < 0.55; t += G.dt) { const q = t / 0.55; b.pos.x = x0 + sx * (q * 54 - 6); b.pos.z = z0 + sz * (q * 54 - 6); if (!G.headless && inSq(b.pos.x, b.pos.z)) spray(S.pp, b.pos.x, 1.5, b.pos.z, { n: 2, rad: 2, cols: paperCols(S), speed: [1, 4], up: [0.5, 3], grav: 4, drag: 1.5, flut: 4, life: [1, 2], size: [0.08, 0.18], land: true }); yield; }
    }
    // land back on the paper
    let hx = 0, hz = 0; for (let t = 0; t < 30; t++) { hx = rnd(-8, 8); hz = rnd(-8, 8); if (G.arena.contains(hx, hz) && Math.hypot(hx - p.pos.x, hz - p.pos.z) > 4) break; }
    for (let t = 0; t < 0.6; t += G.dt) { b.pos.x = damp(b.pos.x, hx, 7, G.dt); b.pos.z = damp(b.pos.z, hz, 7, G.dt); yield; }
    b.pos.x = hx; b.pos.z = hz; S.fly = 0; b.targetable = true; b.autoFace = true; yield 0.5;
  }
  function* leaps(b, n = 3) {
    const S = b.state, p = G.player;
    for (let k = 0; k < n; k++) {
      const h = Hz.circle(p.pos.x, p.pos.z, 4.2, 1.3, 330, { name: 'Leap', lock: 0.85, track(s) { s.x = p.pos.x; s.z = p.pos.z; }, onFire(hh) { Sound.sfx('boom', 0.9, 0.8); FX.shake(0.5); S.ripples.push({ x: hh.shape.x, z: hh.shape.z, r: 4.4, hit: false });
        spray(S.pp, hh.shape.x, 0.3, hh.shape.z, { n: 40, rad: 3.5, cols: paperCols(S), speed: [3, 8], up: [2, 6], grav: 6, drag: 1.6, flut: 3, life: [0.8, 1.8], size: [0.1, 0.26], land: true }); } });
      yield 0.7; const x0 = b.pos.x, z0 = b.pos.z;
      for (let t = 0; t < 0.55; t += G.dt) { const q = smooth(t / 0.55); b.pos.x = lerp(x0, h.shape.x, q); b.pos.z = lerp(z0, h.shape.z, q); S.hopY = Math.sin(q * PI) * 6; yield; }
      S.hopY = 0; yield 0.75;
    }
    yield 0.4;
  }
  function* cranes(b) {
    const S = b.state; S.wing = -1;
    const r = yield* b.cast({ name: 'Thousand Cranes', time: 2.6, interruptible: true }); S.wing = 0;
    if (r === 'done') { for (let w = 0; w < 3; w++) { const a = rnd(TAU), sx = Math.sin(a), sz = Math.cos(a), gap = rndi(-3, 3), gap2 = gap + pick([-4, 4, 5]); for (let i = -8; i <= 8; i++) { if (Math.abs(i - gap) <= 1 || i === gap2) continue; const q = Bul.fire({ x: -sx * 22 + sz * i * 1.9, z: -sz * 22 - sx * i * 1.9, dir: a, speed: 10.5, r: 0.42, dmg: 150, color: 0xffffff, life: 4.6 }); if (q) q.pf = 2; } Sound.sfx('wave', 0.6, 2); yield 1.1; } }
    yield 0.6;
  }
  function* scorch(b) {
    const S = b.state, dir = b.angToPlayer(); b.autoFace = false; S.breath = 0.3;
    Hz.cone(b.pos.x, b.pos.z, dir, 1.05, 19, 1.5, 360, { name: 'Scorch', color: 0xff7020, onFire() {
      Sound.sfx('roar', 0.9, 1.3); Sound.sfx('steam', 0.8); FX.shake(0.5); S.breath = 1;
      for (let k = 0; k < 16; k++) { const d = rnd(5, 19), a = dir + rnd(-0.5, 0.5), x = b.pos.x + Math.sin(a) * d, z = b.pos.z + Math.cos(a) * d; ignite(S, x, z);
        if (!G.headless && k % 2) { spray(S.gp, x, 0.4, z, { n: 12, rad: 1, cols: [0xff9030, 0xff5010, 0xffc060], speed: [1, 5], up: [2, 5], grav: 1.5, drag: 1.4, life: [0.4, 1.0], size: [0.06, 0.16] }); spray(S.pp, x, 0.3, z, { n: 5, rad: 1, cols: [0x1a1410, 0x2a1e18], speed: [0.5, 2], up: [1, 3], grav: -0.5, drag: 1.5, flut: 3, life: [1.2, 2.4], size: [0.08, 0.16] }); } }
      if (!G.headless) for (let k = 0; k < 6; k++) { const d = 2 + k * 2.8; spray(S.gp, b.pos.x + Math.sin(dir) * d, 2.5 - k * 0.3, b.pos.z + Math.cos(dir) * d, { n: 10, rad: 0.4 + k * 0.45, cols: [0xffb050, 0xff7020, 0xff4010], speed: [1, 4], up: [0, 3], grav: 0.5, drag: 1.5, life: [0.3, 0.8], size: [0.08, 0.22] }); }
    } });
    yield* b.cast({ name: 'Scorch', time: 1.5 }); yield 0.7; S.breath = 0; b.autoFace = true;
  }
  function* embers(b, n = 5) {
    const S = b.state, p = G.player; yield* b.cast({ name: 'Ember Rain', time: 0.8 });
    for (let k = 0; k < n; k++) { let x = p.pos.x, z = p.pos.z; if (k) for (let t = 0; t < 20; t++) { x = rnd(-13, 13); z = rnd(-13, 13); if (G.arena.contains(x, z)) break; } Hz.circle(x, z, 3.1, 1.3, 280, { name: 'Ember', color: 0xff7020, onFire() { ignite(S, x, z); spray(S.gp, x, 0.3, z, { n: 16, rad: 2, cols: [0xff9030, 0xff5010, 0xffc060], speed: [1, 4], up: [2, 5], grav: 1.5, drag: 1.4, life: [0.4, 1.0], size: [0.06, 0.15] }); } }); yield 0.28; }
    yield 1.0;
  }

  // ---------- mood: sky, mountains, sun disc, light, paper colours per act ----------
  const MOOD = [
    { top: 0x9eaab8, hor: 0xdcd8ce, bot: 0x8a94a0, exp: 0.55, cloud: 0xf2eee6, cdark: 0x8a929c, sglow: 0.25, fog: 0xc2c8ce, mist: 0xa4acb8,
      sun: 2.4, sunC: 0xffeed8, hemi: 0.72, hs: 0xd8e2f0, hg: 0x8a7c66, fire: 0, env: 0.7, paper: 0xd6c9ae, back: 0x2e3e7c, edge: 0x40465c, washi: 0x6a7ab8, motif: 0x8c9cd4, patF: 0, patB: 1, inkA: 0x3a3e52, inkB: 0x0c0e18, inkE: 0x000000, inkEK: 0, drim: 0x9aa6b6, dcr: 0,
      mtn: [[0x5a6676, 0x3e4a58, 0xa8b2bc, 0.06], [0x64707e, 0x46505e, 0xb0b8c0, 0.3], [0x949ea8, 0x7e8894, 0xc4c8cc, 0.5]], rim: 0x000000, rimK: 0, rimB: 0xfff0e0, rimBK: 0.12,
      disc: 0xfffaf2, dglow: 0.5, ecl: 0, dsize: 0.055, glow: 0xffc890, glowK: 0.3 },
    { top: 0x3a1a5a, hor: 0xf08a50, bot: 0x3a2440, exp: 0.62, cloud: 0xf0a080, cdark: 0x5a3050, sglow: 0.7, fog: 0x8a6a70, mist: 0x3e2850,
      sun: 1.9, sunC: 0xffc89a, hemi: 0.55, hs: 0xffb890, hg: 0x3a3050, fire: 0.3, env: 0.45, paper: 0x44529a, back: 0xd8ccb4, washi: 0x7686cc, motif: 0xffffff, patF: 1, patB: 0, band: 0.5, mdk: 0.45, mhz: 60, inkA: 0x3a3e52, inkB: 0x0c0e18, inkE: 0x000000, inkEK: 0, drim: 0xe06a28, dcr: 1,
      mtn: [[0x5a3048, 0x2e1a32, 0x6a3a58, 0.05], [0x9a5a68, 0x6a3a58, 0xc07868, 0.25], [0xe8a888, 0xc88878, 0xf0b088, 0.55]], rim: 0xff9050, rimK: 0.6, rimB: 0xffa060, rimBK: 0.3,
      disc: 0xfff2b8, dglow: 0.5, ecl: 0, dsize: 0.1, glow: 0xffa060, glowK: 0.35 },
    { top: 0x060204, hor: 0x8e220c, bot: 0x140404, exp: 0.38, cloud: 0x3a0c08, cdark: 0x160406, sglow: 0.6, fog: 0x200c0a, mist: 0x2e0a08,
      sun: 1.3, sunC: 0xffd2c4, hemi: 0.35, hs: 0x60282a, hg: 0x200808, fire: 1.0, env: 0.3, paper: 0x7a7470, back: 0x6a524a, pin: 1, washi: 0x908680, motif: 0xffffff, patF: 0, patB: 0, inkA: 0x1c2438, inkB: 0x070a14, inkE: 0x6a1a10, inkEK: 0.6, sh: 1, band: 0.22, cl: 0.1, mdk: 0.5, mhz: 120, drim: 0xd01a08, dcr: 0,
      mtn: [[0x120a0c, 0x060306, 0x3a0c08, 0.06], [0x1a0c0c, 0x0a0406, 0x501208, 0.28], [0x261010, 0x140608, 0x6a1a0c, 0.5]], rim: 0xff4a18, rimK: 0.75, rimB: 0xff4a18, rimBK: 0.45,
      disc: 0xd01a08, dglow: 0.9, ecl: 1, dsize: 0.085, glow: 0xff6020, glowK: 0.55 },
  ];
  function mood(b, n, instant) { const S = b.state; S.skyT = MOOD[n]; if (instant) moodStep(S, 1e3); }
  function moodStep(S, dt) {
    const T = S.skyT; if (!T) return; const k = 1 - Math.exp(-0.9 * dt), U = S.sky.material.uniforms, L = (col, hex) => col.lerp(_c.setHex(hex), k), F = (o, key, v) => { o[key] = lerp(o[key], v, k); };
    L(U.uTop.value, T.top); L(U.uHor.value, T.hor); L(U.uBot.value, T.bot); L(U.uCloudCol.value, T.cloud); L(U.uCloudDark.value, T.cdark); L(U.uSunCol.value, T.disc); F(U.uExp, 'value', T.exp); F(U.uSunGlow, 'value', T.sglow);
    L(S.fog.color, T.fog); L(S.mistU.uC.value, T.mist); L(S.paperM.color, T.paper); L(S.underM.color, T.back); L(S.edgeM.color, T.edge || T.back); F(S.SU.uPin, 'value', T.pin || 0);
    const SU = S.SU; L(S.inkU.uIA.value, T.inkA); F(S.inkU.uSh, 'value', T.sh || 0); F(S.mistU.uB, 'value', T.band || 0.2); F(S.mistU.uDk, 'value', T.mdk || 0.72); F(S.mistU.uHz, 'value', T.mhz || 150); F(U.uCloud, 'value', T.cl === undefined ? 0.22 : T.cl); L(S.inkU.uIB.value, T.inkB); S.inkU.uIE.value.lerp(_c.setHex(T.inkE).multiplyScalar(T.inkEK), k); L(S.discU.uRimC.value, T.drim); F(S.discU.uCr, 'value', T.dcr); L(SU.uWashi.value, T.washi); L(SU.uMotif.value, T.motif); F(SU.uPatF, 'value', T.patF); F(SU.uPatB, 'value', T.patB);
    S.mtnU.forEach((M, i) => { const m = T.mtn[i]; L(M.uLit.value, m[0]); L(M.uShade.value, m[1]); L(M.uHaze.value, m[2]); F(M.uK, 'value', m[3]); L(M.uRim.value, T.rim); F(M.uRimK, 'value', T.rimK); });
    L(S.discU.uC.value, T.disc); F(S.discU.uEcl, 'value', T.ecl); F(S.discU.uGlow, 'value', T.dglow); F(S, 'discSize', T.dsize);
    F(S.sun, 'intensity', T.sun); L(S.sun.color, T.sunC); F(S.hemi, 'intensity', T.hemi); L(S.hemi.color, T.hs); L(S.hemi.groundColor, T.hg); F(S.fire, 'intensity', T.fire); F(scene, 'environmentIntensity', T.env);
    S.glowC.value.lerp(_c.setHex(T.glow).multiplyScalar(T.glowK), k); S.rimC.value.lerp(_c.setHex(T.rimB).multiplyScalar(T.rimBK), k);
  }
  function setAct(b, n) {
    const S = b.state; S.lvl = n; resetSheet(S); S.inFold = false; S.fly = 0; S.hopY = 0; S.wing = 0; S.breath = 0; b.targetable = true; b.autoFace = true; S.ripples.length = 0; mood(b, n, false);
    if (!G.arena.contains(b.pos.x, b.pos.z)) { b.pos.x = 0; b.pos.z = -4; }
  }
  function setForm(b, to) { const S = b.state; for (const k in S.rigs) { S.rigs[k].visible = k === to; S.rigs[k].scale.setScalar(1); } S.form = to; for (const s of S.segs) s.visible = to === 'dragon'; }

  // ---------- per-frame cosmetics (never touches the sim) ----------
  function cosmetic(b, dt) {
    const S = b.state, t = G.now;
    S.SU.uTime.value = t;
    S.sunV.value.copy(S.sun.position).normalize().transformDirection(camera.matrixWorldInverse);
    const ds = 1400 * Math.tan(S.discSize) * 2 * 2.4; S.disc.position.copy(camera.position).addScaledVector(S.discDir, 1400); S.disc.lookAt(camera.position); S.disc.scale.set(ds, ds, 1);
    S.motes.visible = S.lvl === 0;
    for (const m of S.cflash) if (m.visible) { m.k -= dt * 1.1; m.material.uniforms.opacity.value = Math.max(0, m.k); if (m.k <= 0) m.visible = false; }
    // flock
    const FL = S.flock; FL.D.forEach((d, i) => {
      const a = d.ph + t * d.w, x = Math.sin(a) * d.R, z = Math.cos(a) * d.R, y = d.y + Math.sin(t * 0.6 + d.f) * 1.5, yaw = a + (d.w > 0 ? PI / 2 : -PI / 2);
      _e.set(Math.sin(t * 1.3 + d.f) * 0.1, yaw, d.w > 0 ? -0.25 : 0.25, 'YXZ'); _q.setFromEuler(_e); _s.setScalar(d.s); _a.set(x, y, z); _m4.compose(_a, _q, _s); FL.body.setMatrixAt(i, _m4);
      const fl = Math.sin(t * 7 + d.f * 3) * 0.7; _m4b.makeRotationZ(-0.1 - fl); _m4c.multiplyMatrices(_m4, _m4b); FL.wl.setMatrixAt(i, _m4c); _m4b.makeRotationZ(0.1 + fl); _m4c.multiplyMatrices(_m4, _m4b); FL.wr.setMatrixAt(i, _m4c);
    });
    FL.body.instanceMatrix.needsUpdate = FL.wl.instanceMatrix.needsUpdate = FL.wr.instanceMatrix.needsUpdate = true;
    // drifting scraps (ash rising in the last act)
    const SC = S.scrap, up = S.lvl === 2;
    if (SC.lvl !== S.lvl) { SC.lvl = S.lvl; const pal = S.lvl === 0 ? [0xf2ede2, 0xf2ede2, 0xc8301c, 0x34468a] : S.lvl === 1 ? [0xf2ede2, 0x44529a, 0xd8a840, 0xe8a0a0] : [0x1a1410, 0x2a201a, 0x3a2a20, 0x5a2010]; SC.D.forEach((d, i) => SC.m.setColorAt(i, _c.set(pal[i % pal.length]))); SC.m.instanceColor.needsUpdate = true; }
    SC.D.forEach((d, i) => { d.y += (up ? 0.6 : -1) * d.v * dt; d.x += Math.sin(t * 0.5 + d.ph) * dt * 0.6 + 0.25 * dt; d.z += Math.cos(t * 0.4 + d.ph) * dt * 0.5; if (d.y < -6) d.y = 26; if (d.y > 26) d.y = -4; if (d.x > 36) d.x = -36;
      _e.set(t * d.w + d.ph, t * d.w * 0.7, Math.sin(t + d.ph)); _q.setFromEuler(_e); _s.setScalar(d.s); _a.set(d.x, d.y, d.z); _m4.compose(_a, _q, _s); SC.m.setMatrixAt(i, _m4); });
    SC.m.instanceMatrix.needsUpdate = true;
    // bullets: paper darts and Thousand Cranes ride their bullets
    let nd = 0, nc = 0; const live = new Set(), trail = (q, k) => { live.add(q); q.lx = q.x; q.lz = q.z; if (vrand() < dt * 9) spray(S.pp, q.x - Math.sin(q.dir) * 0.9, q.y, q.z - Math.cos(q.dir) * 0.9, { n: 1, cols: k ? [0xf2ede2, 0xc8301c] : [0xf4efe6, RED], speed: [0.2, 0.8], up: [0, 0.6], grav: 1.5, drag: 2, flut: 2, life: [0.3, 0.6], size: [0.08, 0.14] }); };
    for (const q of Bul.list) {
      if (q.pf === 1 && nd < 60) { const s = 2.7 * Math.min(1, q.t / 0.12); _e.set(0, q.dir, Math.sin(q.t * 9 + q.x) * 0.25, 'YXZ'); _q.setFromEuler(_e); _s.setScalar(s); _a.set(q.x, q.y + 0.05, q.z); _m4.compose(_a, _q, _s); S.dartI.setMatrixAt(nd, _m4); S.dartT.setMatrixAt(nd++, _m4); trail(q, 0); }
      else if (q.pf === 2 && nc < 80) { const s = 2.6 * Math.min(1, q.t / 0.2); _e.set(0, q.dir, Math.sin(q.t * 4 + q.x) * 0.2, 'YXZ'); _q.setFromEuler(_e); _s.setScalar(s); _a.set(q.x, q.y + Math.sin(q.t * 6 + q.z) * 0.12 - 0.1, q.z); _m4.compose(_a, _q, _s); S.craneI.setMatrixAt(nc, _m4); S.craneT.setMatrixAt(nc++, _m4); trail(q, 1); }
    }
    S.dartI.count = S.dartT.count = nd; S.craneI.count = S.craneT.count = nc; if (nd) S.dartI.instanceMatrix.needsUpdate = S.dartT.instanceMatrix.needsUpdate = true; if (nc) S.craneI.instanceMatrix.needsUpdate = S.craneT.instanceMatrix.needsUpdate = true;
    for (const q of S.riders) if (!live.has(q) && inSq(q.lx, q.lz)) spray(S.pp, q.lx, 0.9, q.lz, { n: 12, rad: 0.4, cols: q.pf === 2 ? [0xf2ede2, 0xc8301c, 0xd8a840] : [0xf4efe6, RED], speed: [1.5, 4], up: [1, 4], grav: 5, drag: 1.6, flut: 3, life: [0.6, 1.2], size: [0.08, 0.18], land: true });
    S.riders = live;
    // contact shadow
    const air = S.form === 'crane' ? (S.flyK || 0) * 4.5 + (S.hopY || 0) : (S.hopY || 0), onS = G.arena && G.arena.contains(b.pos.x, b.pos.z) && b.group.visible !== false && !S.dying;
    S.blob.visible = onS; if (onS) { const sz = (S.form === 'frog' ? 8 : S.form === 'dragon' ? 5 : 4.5) * (1 + air * 0.08); S.blob.position.set(b.pos.x, 0.025, b.pos.z); S.blob.scale.set(sz, 1, sz); S.blob.material.opacity = 0.5 / (1 + air * 0.35); }
    // dragon: whiskers, strips, embers from the burning sheet
    const dr = S.form === 'dragon' && !S.dying; S.strips.visible = dr;
    if (dr) {
      const wp = S.whisk.geometry.attributes.position.array; let o = 0;
      for (const sx of [-1, 1]) for (let i = 0; i < S.whN; i++) { const u = i / (S.whN - 1), x = sx * (0.3 + u * 1.5 + Math.sin(t * 2.6 + u * 5 + sx) * 0.22 * u), y = -0.02 - u * 0.55 + Math.sin(t * 3.1 + u * 6 + sx) * 0.22 * u, z = 1.9 - u * 2.6, w = 0.05 * (1 - u * 0.7);
        wp[o++] = x; wp[o++] = y + w; wp[o++] = z; wp[o++] = x; wp[o++] = y - w; wp[o++] = z; }
      S.whisk.geometry.attributes.position.needsUpdate = true;
      for (let i = 0; i < 12; i++) { const ang = t * (0.8 + (i % 4) * 0.15) * (i % 2 ? 1 : -1) + i * 0.52, R = 3.4 + 1.3 * Math.sin(t * 0.7 + i), y = 1.2 + (i % 4) * 1.2 + Math.sin(t * 1.7 + i) * 0.6;
        _e.set(Math.sin(t * 6 + i) * 0.9, ang + PI / 2 * (i % 2 ? 1 : -1), 0.5 + Math.sin(t * 4 + i * 2) * 0.5, 'YXZ'); _q.setFromEuler(_e); _s.setScalar(1); _a.set(b.pos.x + Math.sin(ang) * R, y, b.pos.z + Math.cos(ang) * R); _m4.compose(_a, _q, _s); S.strips.setMatrixAt(i, _m4); }
      S.strips.instanceMatrix.needsUpdate = true;
    }
    if (S.lvl === 2) { S.emT += dt * 45; while (S.emT > 1) { S.emT -= 1; const c = Math.floor(vrand() * NB * NB); if (S.burn[c] > 0) { const x = -H + (c % NB + vrand()) * CELL, z = -H + (Math.floor(c / NB) + vrand()) * CELL; spray(S.gp, x, -0.2, z, { n: 1, cols: [0xff7020, 0xffa040, 0xff4010, 0xffc060], speed: [0.1, 0.6], up: [1.5, 3.5], grav: -0.4, drag: 0.6, life: [1.2, 2.6], size: [0.04, 0.1] }); } } }
    stepPool(S.pp, dt, t); stepPool(S.gp, dt, t);
  }

  G.bosses.push({
    id: 'origami', name: 'ORIKO', title: 'The Thousandth Fold', hint: 'Paper remembers', color: '#f2e9d8', telegraph: RED,
    hp: 25000, radius: 1.6, aimY: 2.6, enrage: 440,
    post: { bloom: 0.3, threshold: 0.92, radius: 0.6, exposure: 0.92, vig: 0.9, sat: 1.0, contrast: 1.08, tint: [1.03, 1.0, 0.96] },
    music: { bpm: 96, root: 38, scale: [0, 1, 5, 7, 10], prog: [0, 0, 3, 2, 0, 4, 3, 1],
      layers: [
        { v: 'koto', pat: ['0..2..4.....3...', '4..3..2.....0...'], oct: 1, len: 2, vol: 0.09 }, { v: 'flute', pat: ['0.......2.......', '4.......3.......'], oct: 1, len: 7, vol: 0.05 }, { v: 'tom', pat: 'x.......x.......', vol: 0.12 },
        { v: 'taiko', from: 1, pat: 'x.....x...x.....', vol: 0.22 }, { v: 'bass', from: 1, pat: '0.....0...0..0..', oct: -1, len: 2, vol: 0.12 }, { v: 'koto', from: 1, pat: '0.2.4.2.3.2.0.2.', oct: 2, len: 1, vol: 0.05 },
        { v: 'brass', from: 2, pat: ['0.......3.......', '4.......2...1...'], oct: 0, len: 7, vol: 0.11 }, { v: 'taiko', from: 2, pat: 'x.xx..x.x.x..xx.', vol: 0.22 }, { v: 'choir', from: 2, pat: '0.......4.......', oct: 1, len: 8, vol: 0.06 },
      ] },
    build,
    *intro(b) { Sound.sfx('wave', 0.6, 1.5); yield* Cam.shot([14, 9, 20], [0, 2, -4], [5, 3.4, 4], [0, 3, -6], 5.0, 44); },
    *death(b) {
      const S = b.state, a = Cam.yaw + 0.5; Cam.cine = { pos: new V3(b.pos.x - Math.sin(a) * 13, 6, b.pos.z - Math.cos(a) * 13), look: new V3(b.pos.x, 2.5, b.pos.z), fov: 42 };
      const cur = S.rigs[S.form]; Sound.sfx('slash', 1, 0.5);
      for (let t = 0; t < 0.45; t += G.dt) { const k = 1 - t / 0.45; cur.scale.set(Math.max(0.05, k), Math.max(0.02, k * k), Math.max(0.05, k)); cur.rotation.y += G.dt * 10; yield; }
      cur.visible = false; for (const s of S.segs) s.visible = false; S.sheet.visible = true; S.sheet.position.set(b.pos.x, 3, b.pos.z); S.dying = 0.001; FX.flash(0xffffff, 0.3, 1);
      spray(S.pp, b.pos.x, 3, b.pos.z, { n: 120, rad: 1.5, h: 2, cols: [0xf2ede2, 0xe8e0d0, RED, 0x34468a], speed: [2, 9], up: [1, 7], grav: 3, drag: 1.3, flut: 5, life: [1.5, 3], size: [0.12, 0.3], land: true }); yield 0.8;
    },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setAct(b, 0); yield 1.0; let n = 0;
        while (true) {
          yield* darts(b, n ? 3 : 2); yield* fold(b, { mode: 0, T: 4.5, hold: 3 }); yield* wingcut(b); yield* glide(b, 1);
          yield* fold(b, { mode: 0, T: 4.5, hold: 3 }); yield* wingcut(b); n++;
        }
      } },
      { at: 0.68, skipTo(b) { mood(b, 1, true); },
        *enter(b) {
          const S = b.state; setAct(b, 1); yield* jumpTo(b, 0, 0, 0.6);
          yield* b.cast({ name: 'Turn the Page', time: 1.6, onTick: (k) => FX.shake(k * 0.25) }); FX.flash(0xffffff, 0.5, 0.9); Sound.sfx('wave', 1, 0.7); Sound.sfx('bigboom', 0.6);
          spray(S.pp, 0, 0.2, 0, { n: 160, rad: 14, cols: [0x44529a, 0x6a7ab8, 0xe8dcc4, 0xd8b060], speed: [0.5, 3], up: [3, 9], grav: 3.5, drag: 1.4, flut: 5, life: [1.5, 3], size: [0.12, 0.3], land: true });
          Co.start(Post.lerpTo({ exposure: 1.0, bloom: 0.4, tint: [1.05, 0.98, 1.02] }, 3), 'fight'); yield* refold(b, 'frog'); yield 0.8;
        },
        *run(b) {
          const S = b.state; setAct(b, 1); setForm(b, S.form === 'crane' ? 'frog' : S.form); yield 0.5;
          while (true) {
            yield* refold(b, 'frog'); yield* leaps(b, 3); yield* fold(b, { mode: 1, T: 4.0, hold: 5 }); yield* leaps(b, 2);
            yield* refold(b, 'crane'); yield* glide(b, 2); yield* cranes(b); yield* fold(b, { mode: 1, T: 4.0, hold: 5 }); yield* darts(b, 3); yield* wingcut(b);
          }
        } },
      { at: 0.36, skipTo(b) { mood(b, 2, true); },
        *enter(b) {
          const S = b.state; setAct(b, 2); yield* jumpTo(b, 0, 0, 0.6);
          yield* b.cast({ name: 'Last Fold', time: 1.8, onTick: (k) => FX.shake(k * 0.35) }); Sound.sfx('roar', 1, 0.6); FX.flash(0xff6020, 0.4, 1.2);
          Co.start(Post.lerpTo({ exposure: 1.0, bloom: 0.45, threshold: 0.9, tint: [1.08, 0.97, 0.92] }, 3), 'fight');
          yield* refold(b, 'dragon'); for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) { ignite(S, x, z); ignite(S, x * 0.9, z); ignite(S, x, z * 0.9); } S.burning = true; yield 1.0;
        },
        *run(b) {
          const S = b.state; setAct(b, 2); setForm(b, 'dragon'); S.burning = true; yield 0.5;
          while (true) {
            yield* scorch(b); yield* fold(b, { mode: 2, T: 6.0, hold: 4 }); yield* embers(b, 5); yield* scorch(b);
            yield* cranes(b); yield* fold(b, { mode: 2, T: 6.0, hold: 4 }); yield* embers(b, 4);
          }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      moodStep(S, dt); burnStep(S, dt); if (!G.headless) landStep(S, dt);
      if (S.burning && G.state === 'fight') { S.creepT -= dt; if (S.creepT <= 0) { S.creepT = 5.5; creep(S, 4); } }
      // flaps: think-time flutter, then the swing
      for (let k = 0; k < 2; k++) {
        const F = S.flaps[k]; if (!F.grp.visible) continue;
        if (F.anim) { F.anim.t += dt / F.anim.dur; const q = smooth(F.anim.t); F.piv.rotation.x = lerp(F.anim.from, F.anim.to, q); if (F.anim.t >= 1) { F.piv.rotation.x = F.anim.to; F.anim = null; } }
        if (!G.headless && F.p0) { const c = F.anim ? Math.sin(clamp(F.anim.t, 0, 1) * PI) * 0.32 * Math.sign(F.anim.to - F.anim.from) : 0; if (c || F.curl) { F.curl = c; // the free edge lags behind the hinge: a curl
          [F.top.geometry, F.ed.geometry].forEach((q, gi) => { const a = q.attributes.position.array, b = F.p0[gi]; for (let i = 0; i < a.length; i += 3) { const z = Math.max(0, b[i + 2]); a[i + 1] = b[i + 1] + c * z * z / F.zMax; } q.attributes.position.needsUpdate = true; }); } }
        else if (S.pend && !S.folds.includes(F.f)) {
          F.piv.rotation.x = F.lit ? -0.035 - Math.sin(t * 5 + k) * 0.02 : 0;
          // chevrons drift across the flap toward the crease
          if (F.seg && !G.headless) { const Cv = S.chevs[k], [A, B] = F.seg, f = F.f, M = _obj; let n = 0; const len = Math.hypot(B[0] - A[0], B[1] - A[1]), cnt = Math.min(10, Math.max(2, Math.floor(len / 4)));
            for (let i = 0; i < cnt; i++) for (let r = 0; r < 3; r++) { const u = (i + 0.5) / cnt, d = 1.2 + ((r + 3 - (t * 0.9) % 1 * 1) % 3) * 1.5, x = lerp(A[0], B[0], u) - f.nx * d, z = lerp(A[1], B[1], u) - f.nz * d; if (!inSq(x, z, 0.5)) continue; M.position.set(x, 0.07, z); M.rotation.set(0, Math.atan2(f.nx, f.nz), 0); M.scale.setScalar(F.lit ? 1 : 0.7); M.updateMatrix(); Cv.setMatrixAt(n++, M.matrix); }
            Cv.count = n; Cv.instanceMatrix.needsUpdate = true; }
        }
        if (F.fade > 0 && !F.anim) { F.fade -= dt; }
      }
      for (let i = S.prints.length - 1; i >= 0; i--) { const q = S.prints[i]; q.t -= dt; if (q.t <= 0) { q.m.visible = false; S.prints.splice(i, 1); } }
      // frog ripples: jump them
      for (let i = S.ripples.length - 1; i >= 0; i--) {
        const q = S.ripples[i]; q.r += 9.5 * dt;
        if (p && p.alive && !q.hit && G.state === 'fight') { const d = Math.hypot(p.pos.x - q.x, p.pos.z - q.z); if (Math.abs(d - q.r) < 0.55 && p.pos.y < 0.3) { q.hit = true; p.hurt(160, { blockable: true, src: { name: 'Ripple' } }); } }
        if (q.r > 30) { S.ripples.splice(i, 1); continue; }
      }
      S.ripMesh.forEach((m, i) => { const q = S.ripples[i]; m.visible = !!q; if (q) { m.position.set(q.x, 0.09, q.z); m.scale.setScalar(q.r); S.ripM.opacity = 0.9; } });
      // the body
      const rig = S.rigs[S.form]; S.wingK = damp(S.wingK || 0, S.wing || 0, 10, dt); if (Math.abs(S.wing) > 0 && Math.abs(S.wingK - S.wing) < 0.05) S.wing = 0; S.flyK = damp(S.flyK || 0, S.fly, 5, dt);
      if (S.form === 'crane') { const fl = S.flyK > 0.1 ? Math.sin(t * 12) * 0.6 : Math.sin(t * 2) * 0.08; rig.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (0.25 + fl + S.wingK * 0.9); }); rig.position.y = S.flyK * 4.5 + (S.hopY || 0); rig.rotation.x = S.flyK * 0.35; }
      else if (S.form === 'frog') { const hy = S.hopY || 0; rig.position.y = hy; rig.rotation.x = -hy * 0.05; rig.scale.y = 1 + Math.sin(t * 3) * 0.03; rig.legs.forEach((l) => { l.rotation.x = -Math.min(1, hy * 0.35) * 0.9; }); }
      else {
        if (!b.castState && !S.inFold && G.state === 'fight' && !b.transitioning && p) { // prowl slowly round the middle of what is left of the sheet
          S.orbit += dt * 0.35; const tx = Math.sin(S.orbit) * 4.5, tz = Math.cos(S.orbit) * 4.5; if (G.arena.contains(tx, tz)) { b.pos.x = damp(b.pos.x, tx, 0.8, dt); b.pos.z = damp(b.pos.z, tz, 0.8, dt); } }
        S.breathK = damp(S.breathK || 0, S.breath || 0, 8, dt);
        rig.position.y = Math.sin(t * 2.2) * 0.25 + (S.hopY || 0); rig.head.rotation.x = -0.12 + Math.sin(t * 1.7) * 0.06 - S.breathK * 0.12; rig.jaw.rotation.x = 0.14 + S.breathK * 0.5 + Math.sin(t * 3) * 0.04;
        const hx = b.pos.x - Math.sin(b.facing) * 1.2, hz = b.pos.z - Math.cos(b.facing) * 1.2, last = S.hist[0];
        if (!last || Math.hypot(hx - last[0], hz - last[1]) > 0.3) { S.hist.unshift([hx, hz]); if (S.hist.length > 90) S.hist.length = 90; }
        let px = hx, pz = hz, py = 3.6 + rig.position.y; S.segs.forEach((s, k) => { // a reared neck that drops into a coil behind the head
          const a = b.facing + PI + Math.sin(t * 1.3 + k * 0.7) * 0.4 + k * 0.36, d = 1.45 * (1 - k * 0.05), tx = px + Math.sin(a) * d, tz = pz + Math.cos(a) * d;
          const ty = (k < 4 ? lerp(3.4, 1.5, smooth(k / 3)) : 1.5 + Math.sin((k - 3) / 7 * PI) * 2.2 + Math.sin(t * 2.2 - k * 0.6) * 0.25) + (S.hopY || 0);
          s.position.set(damp(s.position.x, tx, 6, dt), damp(s.position.y, ty, 6, dt), damp(s.position.z, tz, 6, dt));
          const dx = px - s.position.x, dz = pz - s.position.z, dy = py - s.position.y; s.rotation.set(-Math.atan2(dy, Math.max(0.2, Math.hypot(dx, dz))), Math.atan2(dx, dz), 0); px = s.position.x; pz = s.position.z; py = s.position.y; });
      }
      S.light.intensity = damp(S.light.intensity, S.form === 'dragon' ? 2 + (S.breath || 0) * 12 : 0, 5, dt);
      if (S.dying) { S.dying += dt; S.sheet.position.y = 3 - S.dying * 1.2; S.sheet.position.x += Math.sin(S.dying * 3) * dt * 1.5; S.sheet.rotation.set(-PI / 2 + Math.sin(S.dying * 3) * 0.5, 0, S.dying * 0.8); }
      if (!G.headless) cosmetic(b, dt);
    },
    danger(b, x, z) { const S = b.state; let best = Infinity; if (S.pend) for (const e of S.pend) { const d = e.at - G.now; if (d > -0.05 && d < best && e.test(x, z)) best = Math.max(0, d); } const c = burnIdx(x, z); if (c >= 0 && S.burn[c] > 0.3) best = Math.min(best, 0.3); return best; },
    bot(b, p) {
      const S = b.state; for (const q of S.ripples) { const d = Math.hypot(p.pos.x - q.x, p.pos.z - q.z); if (!q.hit && d - q.r > 0 && d - q.r < 2.0) p.jump(); }
      const avoid = (x, z) => { const c = burnIdx(x, z); return c >= 0 && S.burn[c] > 0; };
      if (S.safe && S.safe.length) { let best = null, bd = 1e9; for (const q of S.safe) { const d = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z); if (d < bd) { bd = d; best = q; } } return { x: best[0], z: best[1], w: 3, avoid }; }
      return { avoid };
    },
  });
  const _obj = new THREE.Object3D();
})();
