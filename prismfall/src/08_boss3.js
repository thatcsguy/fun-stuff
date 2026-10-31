// ------------------------------------------------------------------
// BOSS 3 — THE NULL SUN, ECLIPSE SOVEREIGN (Event Horizon)
// black sun + fbm corona billboard, gravitational lens, prism moons, gravity, corona pulse walls,
// solar chain tether, singularity voids, eclipse, Supernova countdown, Last Light, dawn finale
// ------------------------------------------------------------------
const B3PAL = {
  corona:  { a: [0.22, 0.015, 0.02], b: [1.0, 0.36, 0.06], c: [1.0, 0.9, 0.75], cor: [0.3, 0.55, 1.0], cor2: [0.8, 0.92, 1.0], ring: [0.45, 0.65, 1.0] },
  white:   { a: [0.035, 0.02, 0.11], b: [0.32, 0.45, 1.0], c: [0.9, 0.95, 1.0], cor: [0.7, 0.92, 1.0], cor2: [1.0, 1.0, 1.0], ring: [0.75, 0.9, 1.0] },
  eclipse: { a: [0.09, 0.0, 0.006], b: [0.95, 0.06, 0.04], c: [1.0, 0.8, 0.72], cor: [1.0, 0.2, 0.08], cor2: [1.0, 0.85, 0.7], ring: [1.0, 0.25, 0.12] },
};
const B3 = {
  group: new THREE.Group(), precomp: [], fbmMats: [],
  sun: null, sunU: null, rim: null, rimU: null, corona: null, coronaU: null, ecl: null, rays: null, raysU: null, halos: [], aurora: [], auroraU: null,
  moons: [], pulses: [], voids: [],
  tether: { active: false, t: 0, dur: 6, tick: 0, red: false, m: null, u: null },
  well: { active: false, t: 0, cast: 2, pull: 3, str: 6, n: 0, px: new Float32Array(4), pz: new Float32Array(4), tele: null },
  ll: { active: false, done: false, t: 0, dur: 10, spT: 0, spA: 0 },
  sunY: 4.5, scaleBase: 1, collapseK: 1, cint: 1, darkK: 0, ringK: 0, diamond: 0.0, eclK: 0, eclSlide: 0, pal: 'corona', warp: 0.18, shake: 0,
  dawn: 0, auroraA: 0, spin: 0, infallAcc: 0, checkpoint: false, hudN: -1, hudCrit: false, firstPulse: true, firstWell: true, firstChain: true, firstCrack: true, moonsDown: false,
  hud: null, hudN_el: null, prompt: null, deathT: -1, gapA: 0, gapW: 0, gapT: 0,
};
const B3_NOVA_T = 120;
function b3GapRingMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uR: { value: 1 }, uTh: { value: 0.2 }, uOuter: { value: 1.2 }, uCol: { value: new THREE.Color() }, uA: { value: 1 }, uGapA: { value: 0 }, uGapW: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: ringMatBase.vertexShader,
    fragmentShader: `uniform float uR,uTh,uOuter,uA,uGapA,uGapW; uniform vec3 uCol; varying vec2 vUv;
      void main(){ vec2 p = vUv*2.0-1.0; float d = length(p)*uOuter; float k=(d-uR)/uTh; float a = exp(-k*k*2.5) + 0.25*exp(-k*k*0.3)*step(d,uR);
        float da = abs(mod(atan(-p.y, p.x) - uGapA + 3.14159265, 6.2831853) - 3.14159265);
        float gap = uGapW > 0.0 ? smoothstep(uGapW - 0.02, uGapW + 0.05, da) : 1.0;
        gl_FragColor = vec4(uCol*a*uA*gap, 1.0); }`,
  });
}
function b3Windup() { return bossRT.phase === 2 ? 0.7 : DIFF[2].windup; }
function b3InArena(o, rmin, rmax) { const r = Math.hypot(o.x, o.y) || 1; const c = clamp(r, rmin, rmax); o.x *= c / r; o.y *= c / r; return o; }
function buildBoss3() {
  const g = B3.group; scene.add(g);
  // ================= THE SUN: black sphere, fresnel rim shell, corona billboard =================
  B3.sunU = { uTime: { value: 0 }, uFlash: { value: 0 }, uCrack: { value: 0 }, uFracture: { value: 0 }, uGlow: { value: 0 }, uEdge: { value: new THREE.Color(0.4, 0.6, 1.0) }, uAlpha: { value: 0.9 } };
  B3.sun = new THREE.Mesh(new THREE.SphereGeometry(2.4, 64, 32), new THREE.ShaderMaterial({
    uniforms: B3.sunU, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vO; void main(){ vO = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: GLSL_LIB + /* glsl */`
      uniform float uTime,uFlash,uCrack,uFracture,uGlow,uAlpha; uniform vec3 uEdge; varying vec3 vN; varying vec3 vV; varying vec3 vO;
      vec2 vor(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8.0, d2=8.0; for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=vec2(hash12(i+g), hash12(i+g+17.0)); vec2 r=g+o-f; float d=dot(r,r); if(d<d1){d2=d1; d1=d;} else if(d<d2) d2=d; } return vec2(sqrt(d1), sqrt(d2)); }
      void main(){ vec3 n = normalize(vN), v = normalize(vV); float fr = 1.0-abs(dot(n,v));
        float gran = noise3(vO*1.6 + vec3(0.0, uTime*0.15, 0.0))*0.6 + noise3(vO*4.0 - uTime*0.2)*0.4;
        vec3 c = vec3(0.004,0.004,0.008) + uEdge*pow(fr, 4.0)*0.55 + uEdge*gran*0.012;
        // supernova swelling: the surface itself starts to burn
        vec3 hot = mix(vec3(1.0,0.18,0.04), vec3(1.0,0.75,0.4), smoothstep(0.55, 0.85, gran));
        c += hot*uGlow*(0.15 + 0.85*smoothstep(0.35, 0.8, gran))*(0.4 + 0.6*pow(fr,0.6));
        vec2 vr = vor(vO.xy*1.1 + vO.z*0.8); float ce = smoothstep(0.07, 0.0, vr.y-vr.x);
        c += vec3(2.4,2.5,2.8)*ce*max(uCrack, uFracture*0.35*(0.5+0.5*sin(uTime*9.0)));
        c = mix(c, vec3(2.4,2.6,3.0)*(0.2+fr), uFlash*0.55);
        float a = max(uAlpha, max(uFlash*0.6, ce*max(uCrack,0.0)));
        gl_FragColor = vec4(c/max(a,0.01)*min(a,1.0), a); }`,
  }));
  B3.sun.renderOrder = 18; g.add(B3.sun);
  B3.rimU = { uCol: { value: new THREE.Color(0.5, 0.7, 1.0) }, uA: { value: 1 } };
  B3.rim = new THREE.Mesh(new THREE.SphereGeometry(2.52, 48, 24), new THREE.ShaderMaterial({
    uniforms: B3.rimU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float fr = 1.0-abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uCol*pow(fr,5.0)*2.2*uA, 1.0); }`,
  }));
  B3.rim.renderOrder = 3; g.add(B3.rim);
  // corona: camera-facing fbm flame billboard (in sun radii; scaled with the sun)
  B3.coronaU = { uTime: { value: 0 }, uCol: { value: new THREE.Color(0.3, 0.55, 1.0) }, uCol2: { value: new THREE.Color(0.8, 0.92, 1.0) }, uInt: { value: 1 }, uRing: { value: 0 }, uFlash: { value: 0 }, uDiamond: { value: 0 }, uDiaAng: { value: 0.75 }, uGather: { value: 0 } };
  const cmat = new THREE.ShaderMaterial({
    uniforms: B3.coronaU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, defines: fbmDefines(),
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: GLSL_LIB + /* glsl */`uniform float uTime,uInt,uRing,uFlash,uDiamond,uDiaAng,uGather; uniform vec3 uCol,uCol2; varying vec2 vUv;
      void main(){ vec2 p = (vUv-0.5)*8.0; float r = length(p); if (r < 0.96) discard; float a = atan(p.y,p.x); vec2 cs = vec2(cos(a), sin(a));
        float e = r - 1.0;
        float f = fbm(cs*2.2 + vec2(e*1.5 - uTime*0.45, e*0.8 + uTime*0.12));
        float g2 = fbm(cs*4.5 - vec2(uTime*0.3, e*2.2 - uTime*0.6));
        float rays = pow(noise2(cs*7.0 + vec2(uTime*0.04, 0.0)), 3.0) + 0.5*pow(noise2(cs*15.0 - uTime*0.03), 6.0);
        float rim = exp(-pow((r-1.02)*mix(14.0, 34.0, uRing), 2.0))*mix(1.6, 3.2, uRing);
        float halo = exp(-e*3.2)*(0.12 + 0.95*f*f);
        float flare = smoothstep(0.55, 0.9, f + g2*0.25)*exp(-e*1.4)*0.95;
        float stream = rays*exp(-e*mix(1.2, 0.6, uRing))*mix(0.3, 0.75, uRing);
        float body = (halo + flare)*(1.0 - 0.82*uRing) + stream;
        vec3 c = uCol*body + mix(uCol, uCol2, 0.6)*rim + uCol2*exp(-e*9.0)*0.45*(1.0-uRing*0.6);
        // last light: everything streams inward
        c += uCol2*uGather*pow(noise2(cs*9.0 + vec2(0.0, e*3.0 + uTime*4.0)), 2.0)*exp(-e*0.8)*1.4;
        // diamond-ring flare
        vec2 dp = p - vec2(cos(uDiaAng), sin(uDiaAng))*1.03; float dl = length(dp);
        vec2 rq = vec2(dp.x+dp.y, dp.x-dp.y)*0.7071;
        float star = exp(-abs(dp.x)*30.0)*exp(-abs(dp.y)*0.9) + exp(-abs(dp.y)*30.0)*exp(-abs(dp.x)*0.9) + 0.35*(exp(-abs(rq.x)*40.0)*exp(-abs(rq.y)*2.5) + exp(-abs(rq.y)*40.0)*exp(-abs(rq.x)*2.5));
        c += vec3(1.0,0.97,0.92)*uDiamond*(star*1.4 + exp(-dl*7.0)*3.0);
        c += vec3(1.0)*uFlash*exp(-e*3.0)*0.8;
        float edge = smoothstep(4.0, 3.2, r);
        gl_FragColor = vec4(c*uInt*edge*smoothstep(0.96, 1.0, r), 1.0); }`,
  });
  B3.corona = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 19.2), cmat); B3.corona.renderOrder = 2; g.add(B3.corona); B3.fbmMats.push(cmat);
  // eclipse moon (phase 3) — a black disc that slides in front of the sun
  B3.ecl = new THREE.Mesh(new THREE.SphereGeometry(2.5, 48, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.9, depthWrite: false })); B3.ecl.renderOrder = 19; B3.ecl.visible = false; g.add(B3.ecl);
  // orbital halo rings (armillary)
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.035, 160, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.7, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.scale.setScalar(i ? 4.6 : 3.7); m.renderOrder = 3; g.add(m); B3.halos.push({ m, tilt: i ? 0.42 : -0.3, sp: i ? -0.25 : 0.33, a: i * 1.7 });
  }
  // god rays (death) — 12 radiating light blades on one billboard
  B3.raysU = { uA: { value: 0 }, uLen: { value: 0.3 }, uTime: { value: 0 } };
  B3.rays = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShaderMaterial({
    uniforms: B3.raysU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`uniform float uA,uLen,uTime; varying vec2 vUv;
      void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); float a = atan(p.y,p.x);
        float ray = pow(abs(cos(a*6.0 + 0.2*sin(a*3.0 + uTime))), 60.0) + 0.6*pow(abs(cos(a*6.0 + 0.2618)), 160.0);
        float len = smoothstep(uLen, uLen*0.15, r);
        vec3 c = vec3(1.0,0.97,0.9)*(ray*len*1.8 + exp(-r*14.0/max(uLen,0.05))*2.2);
        gl_FragColor = vec4(c*uA, 1.0); }`,
  }));
  B3.rays.renderOrder = 30; B3.rays.visible = false; g.add(B3.rays);
  // ================= PRISM MOONS (R, G, B) =================
  const octa = new THREE.OctahedronGeometry(0.7, 0); octa.scale(1, 1.35, 1);
  const haloGeo = new THREE.PlaneGeometry(1, 1);
  const haloSh = {
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying vec2 vUv; void main(){ vec2 p=vUv*2.0-1.0; float r=length(p); float a=atan(p.y,p.x);
      float g = exp(-r*r*10.0)*1.2 + exp(-r*4.5)*0.3 + pow(abs(cos(a*2.0)),40.0)*exp(-r*3.0)*0.6; gl_FragColor = vec4(uCol*g*uA*smoothstep(1.0,0.7,r), 1.0); }`,
  };
  for (let i = 0; i < 3; i++) {
    const c = [R, G, Bc][i], pc = PCOL[c];
    const u = { uTime: B3.sunU.uTime, uCol: { value: new THREE.Color(pc[0], pc[1], pc[2]) }, uCore: { value: new THREE.Color(pc[0] * 2, pc[1] * 2, pc[2] * 2) }, uFlash: { value: 0 }, uCrack: { value: 0 }, uFracture: { value: 0 }, uWhite: { value: 0 }, uDark: { value: 0 } };
    const mg = new THREE.Group(); const body = new THREE.Mesh(octa, b2CrystalMat(u)); mg.add(body);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(pc[0] * 3, pc[1] * 3, pc[2] * 3) })); mg.add(core);
    const hu = { uCol: { value: new THREE.Color(pc[0], pc[1], pc[2]) }, uA: { value: 1 } };
    const halo = new THREE.Mesh(haloGeo, new THREE.ShaderMaterial({ uniforms: hu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...haloSh })); halo.scale.setScalar(3.2); halo.renderOrder = 17; mg.add(halo);
    g.add(mg);
    const bm = new THREE.Mesh(beamGeo, beamMatBase.clone()); bm.visible = false; bm.renderOrder = 16; bm.frustumCulled = false; g.add(bm); bm.material.uniforms.uCol.value.setRGB(pc[0], pc[1], pc[2]);
    const m = { i, c, g: mg, body, core, halo, u, hu, hp: 1400, alive: false, mode: 0, ang: i * TAU / 3, x: 0, y: 4.5, z: 0, streamT: 0, streamA: i * 1.1, dir: i === 1 ? -1 : 1, from: new THREE.Vector3(), flyT: 0, glow: 1, beam: { m: bm, u: bm.material.uniforms }, vis: true };
    m.tgt = { x: 0, y: 1.5, z: 0, r: 0.95, hy: 1.5, alive: false, priority: true, isBoss: false, lanceMul: 1, hit: (d, cr, src) => b3MoonHit(m, d, cr, src) };
    B3.moons.push(m); B3.precomp.push(bm);
  }
  // ================= CORONA PULSE WALLS (6) =================
  const wallGeo = new THREE.CylinderGeometry(1, 1, 1, 128, 1, true).translate(0, 0.5, 0);
  for (let i = 0; i < 6; i++) {
    const wu = { uCol: { value: new THREE.Color(0.25, 0.5, 1.2) }, uA: { value: 0 }, uTime: B3.sunU.uTime, uGapA: { value: 0 }, uGapW: { value: 0 } };
    const wall = new THREE.Mesh(wallGeo, new THREE.ShaderMaterial({
      uniforms: wu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying vec2 vP; void main(){ vUv=uv; vP=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uA,uTime,uGapA,uGapW; varying vec2 vUv; varying vec2 vP;
        void main(){ float h = vUv.y; float g = pow(1.0-h, 2.0); float s = 0.7+0.3*sin(vUv.x*6.2832*40.0 - uTime*5.0 + h*6.0);
          float top = exp(-pow((h-0.92)*30.0,2.0))*0.6;
          float da = abs(mod(atan(vP.y, vP.x) - uGapA + 3.14159265, 6.2831853) - 3.14159265);
          float gap = uGapW > 0.0 ? smoothstep(uGapW - 0.02, uGapW + 0.05, da) : 1.0;
          float lip = uGapW > 0.0 ? exp(-pow((da - uGapW - 0.05)*40.0, 2.0))*1.4*(1.0-h) : 0.0;
          gl_FragColor = vec4(((uCol*(g*s*0.75 + top*0.6) + vec3(0.6,0.7,1.0)*exp(-h*22.0)*0.35)*gap + vec3(0.6,1.0,1.0)*lip)*uA, 1.0); }`,
    }));
    wall.visible = false; wall.renderOrder = 15; wall.frustumCulled = false; g.add(wall);
    const flat = new THREE.Mesh(ringGeo, b3GapRingMat()); flat.visible = false; flat.renderOrder = 15; flat.frustumCulled = false; g.add(flat);
    flat.material.uniforms.uCol.value.setRGB(0.5, 0.8, 2.2);
    B3.pulses.push({ active: false, r: 0, speed: 6, col: Bc, done: false, near: false, gapA: 0, gapW: 0, wall, wu, flat, fu: flat.material.uniforms });
    B3.precomp.push(wall, flat);
  }
  // ================= SINGULARITY VOIDS (floor uniforms) =================
  for (let i = 0; i < 6; i++) B3.voids.push({ active: false, x: 0, z: 0, r: 2, t: 0, life: 12, open: 0, born: 0 });
  // ================= SOLAR CHAIN (tether) =================
  { const bm = new THREE.Mesh(beamGeo, beamMatBase.clone()); bm.visible = false; bm.renderOrder = 16; bm.frustumCulled = false; g.add(bm); B3.tether.m = bm; B3.tether.u = bm.material.uniforms; B3.tether.o = { m: bm, u: bm.material.uniforms }; B3.precomp.push(bm); }
  // ================= AURORA (dawn finale) =================
  B3.auroraU = { uTime: { value: 0 }, uA: { value: 0 } };
  const amat = new THREE.ShaderMaterial({
    uniforms: B3.auroraU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, defines: fbmDefines(),
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: GLSL_LIB + /* glsl */`uniform float uTime,uA; varying vec2 vUv;
      void main(){ float x = vUv.x*7.0; float n = fbm(vec2(x*0.9 + uTime*0.04, uTime*0.07));
        float cur = pow(noise2(vec2(x*5.0 + n*4.0, uTime*0.25)), 2.2)*0.9 + n*0.35;
        float h = vUv.y; float base = smoothstep(0.0, 0.1, h - (n-0.5)*0.25)*pow(max(1.0-h,0.0), 1.6);
        vec3 c = mix(vec3(0.15,1.0,0.55), vec3(0.2,0.75,1.0), smoothstep(0.15, 0.5, h)); c = mix(c, vec3(0.75,0.3,1.0), smoothstep(0.45, 0.95, h));
        float edge = smoothstep(0.0,0.12,vUv.x)*smoothstep(1.0,0.88,vUv.x);
        gl_FragColor = vec4(c*cur*base*edge*uA*1.25, 1.0); }`,
  });
  B3.fbmMats.push(amat);
  const arcs = [[70, 34, -2.1, 1.7], [86, 42, -0.6, 1.5], [78, 38, 1.0, 1.9]];
  for (const [rad, h, th, len] of arcs) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 48, 1, true, th, len).translate(0, h / 2 - 4, 0), amat); m.visible = false; m.renderOrder = -15; m.frustumCulled = false; g.add(m); B3.aurora.push(m); B3.precomp.push(m); }
  B3.precomp.push(B3.ecl, B3.rays);
  // HUD refs
  B3.hud = document.getElementById('snova'); B3.hudN_el = document.getElementById('snovaN'); B3.prompt = document.getElementById('novaPrompt');
  document.getElementById('novaPromptK').textContent = IS_TOUCH ? '' : '[ 4 / R ]';
  g.visible = false;
}

// ---- palette ----
function b3SetPal(name, instant) {
  B3.pal = name; if (!instant) return; const P = B3PAL[name];
  floorU.uRampA.value.setRGB(P.a[0], P.a[1], P.a[2]); floorU.uRampB.value.setRGB(P.b[0], P.b[1], P.b[2]); floorU.uRampC.value.setRGB(P.c[0], P.c[1], P.c[2]);
  B3.coronaU.uCol.value.setRGB(P.cor[0], P.cor[1], P.cor[2]); B3.coronaU.uCol2.value.setRGB(P.cor2[0], P.cor2[1], P.cor2[2]);
}
function b3PalStep(dt) {
  const P = B3PAL[B3.pal], k = 1 - Math.exp(-2.5 * dt);
  b2DampCol(floorU.uRampA.value, P.a, k); b2DampCol(floorU.uRampB.value, P.b, k); b2DampCol(floorU.uRampC.value, P.c, k);
  b2DampCol(B3.coronaU.uCol.value, P.cor, k); b2DampCol(B3.coronaU.uCol2.value, P.cor2, k);
}

// ---- prism moons ----
function b3MoonHit(m, d, crit, src) {
  if (!m.alive || game.state !== 'fight') return;
  m.hp -= d; m.u.uFlash.value = 0.5; m.u.uCrack.value = clamp(1 - m.hp / 1400, 0, 1);
  if (src !== 'bolt') dmgNumber(m.x, m.y + 1.4, m.z, String(Math.round(d)), crit ? 1 : 0, CSSCOL[m.c]);
  if (m.hp <= 0) {
    b3KillMoon(m, true); addRadiance(10); streakToPlayer(m.x, m.y, m.z, m.c, 10);
    if (!B3.moons.some((o) => o.alive) && !B3.moonsDown) {
      B3.moonsDown = true; bossRT.shieldMul = 1; bossRT.stagger = 4; bossRT.staggerMul = 1.5; bossAddFracture(50);
      ui.toast('THE COURT FALLS — SUN STUNNED', 2.2, true); hitstop(0.12); sfx.boom(); bloomSpike(1.2); addTrauma(0.5); B3.sunU.uFlash.value = 1;
      burstRainbow(0, B3.sunY, 0, 160, 12, 1.4, 0.25, 0);
    }
  }
}
function b3KillMoon(m, withFx) {
  if (!m.alive && !m.vis) return; m.alive = false; m.tgt.alive = false; m.vis = false; m.g.visible = false; m.beam.m.visible = false;
  if (withFx) { const pc = PCOL[m.c]; shatter(m.x, m.y, m.z, 0.8, 36, pc[0] * 1.6, pc[1] * 1.6, pc[2] * 1.6, 9, 1.8, 9); burst(m.x, m.y, m.z, 70, pc[0] * 2.4, pc[1] * 2.4, pc[2] * 2.4, 10, 0.9, 0.24, 1, 0); ring(m.x, 0.1, m.z, 0.3, 4, 0.5, 0.3, pc[0] * 2, pc[1] * 2, pc[2] * 2, 1.4); sfx.shatter(0.9); addTrauma(0.3); }
}
function b3MoonsDetach(instant) {
  B3.moonsDown = false;
  for (const m of B3.moons) {
    m.alive = true; m.vis = true; m.g.visible = true; m.hp = 1400; m.tgt.alive = true; m.u.uCrack.value = 0; m.u.uFlash.value = 1; m.streamT = 1.6 + m.i * 0.3;
    m.ang = Math.atan2(m.z, m.x); m.beam.m.visible = true;
    if (instant) { m.mode = 1; m.flyT = 1; } else { m.mode = 2; m.flyT = 0; m.from.set(m.x, m.y, m.z); }
  }
  bossRT.shieldMul = 0.5;
  if (!instant) ui.tutorial('moons', 'The Prism Moons shield the sun (×0.5) — shatter them!');
}
function b3MoonPos(m, out) { // orbit around the sun (phase 1)
  const a = m.ang; return out.set(Math.cos(a) * 4.3, B3.sunY - 0.4 + Math.sin(a * 2 + m.i) * 0.9, Math.sin(a) * 4.3);
}
function b3UpdateMoons(dt, fighting) {
  const t = fx.simTime;
  for (const m of B3.moons) {
    if (!m.vis) continue;
    if (m.mode === 0) { m.ang += dt * 0.6; b3MoonPos(m, _v1); m.x = _v1.x; m.y = _v1.y; m.z = _v1.z; }
    else if (m.mode === 3) { // intro fly-in
      m.flyT = Math.min(1, m.flyT + dt / 0.8); m.ang += dt * 0.6; b3MoonPos(m, _v1); const e = easeOut(m.flyT);
      m.x = lerp(m.from.x, _v1.x, e); m.y = lerp(m.from.y, _v1.y, e); m.z = lerp(m.from.z, _v1.z, e);
      if (frand() < 0.8) { const pc = PCOL[m.c]; emitP(m.x, m.y, m.z, 0, 0, 0, pc[0] * 2, pc[1] * 2, pc[2] * 2, 0.5, 0.35, 4); }
      if (m.flyT >= 1) m.mode = 0;
    } else {
      m.ang += dt * 0.4 * (m.mode === 2 ? 0.5 : 1);
      const tx = Math.cos(m.ang) * 9, tz = Math.sin(m.ang) * 9, ty = 1.5 + Math.sin(t * 1.3 + m.i * 2) * 0.25;
      if (m.mode === 2) { m.flyT = Math.min(1, m.flyT + dt / 1.5); const e = smooth(m.flyT); m.x = lerp(m.from.x, tx, e); m.z = lerp(m.from.z, tz, e); m.y = lerp(m.from.y, ty, e) + Math.sin(Math.PI * m.flyT) * 1.5; if (m.flyT >= 1) m.mode = 1; }
      else { m.x = tx; m.y = ty; m.z = tz; }
      // prism court stream: rotating 3-way, 4 volleys/s
      if (fighting && m.alive && m.mode === 1 && bossRT.vuln <= 0) {
        m.streamA += dt * 1.15 * m.dir; m.streamT -= dt;
        if (m.streamT <= 0) { m.streamT += 0.25; for (let k = 0; k < 3; k++) { const a = m.streamA + k * TAU / 3; shoot(m.x + Math.cos(a) * 0.7, m.z + Math.sin(a) * 0.7, a, 6 * DIFF[2].spd, m.c, 0.28, 14, 4.2); } if (m.i === 0) sfx.shot(m.c); }
      }
    }
    m.g.position.set(m.x, m.y, m.z); m.g.rotation.set(Math.sin(t * 0.7 + m.i) * 0.3, t * (1.2 + m.i * 0.2), 0);
    m.halo.quaternion.copy(camera.quaternion).premultiply(_q.copy(m.g.quaternion).invert());
    m.tgt.x = m.x; m.tgt.y = m.y; m.tgt.z = m.z;
    if (m.u.uFlash.value > 0) m.u.uFlash.value = Math.max(0, m.u.uFlash.value - dt * 3);
    const pulse = 0.85 + 0.15 * Math.sin(t * 3 + m.i * 2);
    m.hu.uA.value = pulse * (1 - B3.darkK) * m.glow; m.u.uDark.value = B3.darkK;
    m.core.scale.setScalar(pulse);
    // shield link to the sun
    if (m.beam.m.visible) { beamSet(m.beam, m.x, m.y, m.z, 0, B3.sunY, 0, 0.06 + 0.03 * Math.sin(t * 6 + m.i)); m.beam.u.uTime.value = t; m.beam.u.uA.value = 0.55 * (1 - B3.darkK); }
  }
}

// ---- corona pulse (expanding ring walls: dash through) ----
function b3Pulse(speed, col = Bc, gapA = 0, gapW = 0) {
  let q = null; for (const o of B3.pulses) if (!o.active) { q = o; break; } if (!q) q = B3.pulses[0];
  q.active = true; q.r = 2.8; q.speed = speed; q.col = col; q.done = false; q.near = false; q.wall.visible = true; q.flat.visible = true;
  q.gapA = gapA; q.gapW = gapW; q.wu.uGapA.value = q.fu.uGapA.value = gapA; q.wu.uGapW.value = q.fu.uGapW.value = gapW;
  const pc = PCOL[col]; q.wu.uCol.value.setRGB(pc[0], pc[1], pc[2]); q.fu.uCol.value.setRGB(pc[0] * 1.3, pc[1] * 1.3, pc[2] * 1.3);
  sfx.swoop(); sfx.tell(1); B3.coronaU.uFlash.value = 0.8; ring(0, 0.2, 0, 2.6, 5, 0.4, 0.4, pc[0] * 2, pc[1] * 2, pc[2] * 2, 1.2);
}
function b3UpdatePulses(dt, fighting) {
  for (const q of B3.pulses) {
    if (!q.active) continue;
    q.r += q.speed * dt;
    const fade = clamp((16.5 - q.r) / 1.5, 0, 1);
    if (q.r > 16.5) { q.active = false; q.wall.visible = q.flat.visible = false; continue; }
    q.wall.scale.set(q.r, 1.7, q.r); q.wu.uA.value = fade * Math.min(1, (q.r - 2.8) / 0.8);
    q.flat.position.set(0, 0.06, 0); const outer = q.r + 1.4; q.flat.scale.setScalar(outer); q.fu.uR.value = q.r; q.fu.uTh.value = 0.45; q.fu.uOuter.value = outer; q.fu.uA.value = fade;
    if (fighting && player.alive && !q.done) {
      const pr = Math.hypot(player.x, player.z) || 0.001;
      const inGap = q.gapW > 0 && Math.abs(wrapA(Math.atan2(player.z, player.x) - q.gapA)) < q.gapW - PLAYER.hurtR / pr;
      const d = inGap ? 9 : Math.abs(pr - q.r) - 0.45 - PLAYER.hurtR;
      if (d < 0) { hitSrc = 'pulse'; const res = resolveHazard(d, 0.8, q.col, bossRT.phase === 2 ? 16 : 14, true); if (res === HZ_HIT || res === HZ_PERFECT) q.done = true; }
      else if (d < 0.8) q.near = true;
    }
  }
}

// ---- singularity voids ----
function b3OpenVoid(x, z, r, life) {
  let v = null, oldest = null; for (const o of B3.voids) { if (!o.active) { v = o; break; } if (!oldest || o.born < oldest.born) oldest = o; }
  if (!v) v = oldest;
  v.active = true; v.x = x; v.z = z; v.r = r; v.t = 0; v.life = life; v.open = 0; v.born = fx.simTime;
  burst(x, 0.3, z, 60, 2.6, 0.8, 0.3, 9, 0.8, 0.22, 0.8, 0); ring(x, 0.08, z, 0.3, r * 1.8, 0.5, 0.3, 2.6, 0.6, 0.3, 1.4); addTrauma(0.25); sfx.boom();
}
function b3CloseVoids() { for (const v of B3.voids) if (v.active && v.t < v.life - 0.6) v.t = v.life - 0.6; }
function b3UpdateVoids(dt, fighting) {
  const U = floorU.uVoid.value;
  for (let i = 0; i < 6; i++) {
    const v = B3.voids[i];
    if (!v.active) { U[i].w = 0; continue; }
    v.t += dt; if (v.t >= v.life) { v.active = false; U[i].w = 0; continue; }
    v.open = Math.min(1, v.t / 0.45) * Math.min(1, (v.life - v.t) / 0.6);
    U[i].set(v.x, v.z, v.r, v.open);
    if (frand() < 0.5) { const a = frand() * TAU; emitP(v.x, 0.05, v.z, a, 2.2, v.r * v.open * 0.95, 2.4, 0.7, 0.25, 1.2, 0.14, 2); }
    if (fighting && player.alive && player.dashT < 0 && v.open > 0.5) {
      const dx = player.x - v.x, dz = player.z - v.z, d = Math.hypot(dx, dz) || 0.001, rr = v.r * v.open;
      if (d < rr - 0.2) {
        const k = (rr + 0.4) / d; player.x = v.x + dx * k; player.z = v.z + dz * k;
        burst(player.x, 0.5, player.z, 24, 2.6, 0.6, 0.3, 6, 0.5, 0.18, 1, 0);
        if (player.hurtI <= 0 && player.invuln <= 0 && !debug.god) { hitSrc = 'void'; damagePlayer(15, R); player.stunT = 0.5; dmgNumber(player.x, 2.8, player.z, 'VOID', 4, '#ff9a6a'); }
      }
    }
  }
}

// ---- solar chain (tether) ----
function b3UpdateTether(dt, fighting) {
  const T = B3.tether;
  if (!T.active) { if (T.m.visible) T.m.visible = false; return; }
  T.t += dt;
  const d = Math.hypot(player.x, player.z), red = d < 8;
  if (red !== T.red) { T.red = red; if (red) sfx.deny(); }
  const tc = red ? [2.2, 0.25, 0.3] : [0.4, 0.8, 2.4];
  T.u.uCol.value.setRGB(tc[0], tc[1], tc[2]); T.u.uTime.value = fx.simTime;
  T.u.uA.value = Math.min(1, T.t / 0.2) * (T.t > T.dur - 0.3 ? (T.dur - T.t) / 0.3 : 1) * (red ? 1.2 : 0.8);
  beamSet(T.o, player.x, 1.15 + player.y, player.z, 0, B3.sunY, 0, red ? 0.16 + 0.05 * Math.sin(fx.simTime * 30) : 0.1); T.m.visible = player.alive;
  if (frand() < 0.5) { const u = frand(); emitP(lerp(player.x, 0, u), lerp(1.15, B3.sunY, u), lerp(player.z, 0, u), (frand() - 0.5), (frand() - 0.5), (frand() - 0.5), tc[0], tc[1], tc[2], 0.4, 0.12, 4); }
  if (fighting && player.alive) {
    // the Mirror cuts the chain
    if (mirror.active && Math.abs(wrapA(Math.atan2(-player.z, -player.x) - mirror.ang)) < Math.PI / 3) {
      T.active = false; T.m.visible = false; bossAddFracture(20); mirU.uFlash.value = 1.2; sfx.tink(8); sfx.shatter(0.6);
      ring(mirror.x, 1.15, mirror.z, 0.2, 2.6, 0.35, 0.2, 0.6, 1.2, 2.6, 1.5); burst(mirror.x, 1.2, mirror.z, 40, 0.6, 1.2, 2.6, 8, 0.6, 0.18, 1, 0);
      dmgNumber(player.x, 2.7, player.z, 'CHAIN CUT', 4, '#9cc8ff'); if (bossRT.cast.name === 'Solar Chain') bossRT.cast.active = false; return;
    }
    T.tick -= dt;
    if (red && T.tick <= 0) { T.tick = 0.5; hitSrc = 'chain'; resolveHazard(-0.1, 0, Bc, 6, false); }
  }
  if (T.t >= T.dur) { T.active = false; T.m.visible = false; }
}

// ---- gravity well ----
function b3UpdateWell(dt) {
  const W_ = B3.well; if (!W_.active) return 0;
  W_.t += dt; const pulling = W_.t >= W_.cast && W_.t < W_.cast + W_.pull;
  if (W_.t >= W_.cast + W_.pull + 0.1) { W_.active = false; return 0; }
  // infall streams
  const n = pulling ? (Q.cfg.low ? 2 : 5) : 1;
  for (let k = 0; k < n; k++) { const a = frand() * TAU, r = 6 + frand() * 10; emitP(Math.cos(a) * r, 0.2 + frand() * 2, Math.sin(a) * r, -Math.cos(a) * r * 0.8, -0.2, -Math.sin(a) * r * 0.8, 1.6, 0.5, 0.6, 1.1, 0.16, 4); }
  if (!pulling) return 0;
  for (let i = 0; i < W_.n; i++) if (Math.hypot(player.x - W_.px[i], player.z - W_.pz[i]) < 1.8) return -1; // sheltered in a pocket
  return W_.str;
}

// ---- last light ----
function b3LastLight() {
  const ll = B3.ll; if (ll.active || ll.done) return;
  const b = bossRT; ll.active = true; ll.done = true; ll.t = 0; ll.spT = 0.6; ll.spA = rng() * TAU;
  bossInterrupt(); b.invuln = true; b.lastLight = true; b.novaInLastLight = false; b.vuln = 0; b.stagger = 0; b.fracture = 100;
  pjClearAll(true); b3CloseVoids();
  if (player.rad < 60 && player.novaT < 0) { player.rad = 60; streakToPlayer(0, B3.sunY, 0, W, 20); } // insurance: the sun's light pours into you
  castBar('LAST LIGHT', ll.dur); ui.el.bigCastName.textContent = 'LAST LIGHT'; ui.el.bigCast.classList.add('on'); B3.prompt.classList.add('on');
  ui.toast('LAST LIGHT — every hit now surges your Radiance. NOVA it!', 3.0, true);
  bloomSpike(1.8); addTrauma(0.6); shockAt(0, B3.sunY, 0, 0.07); sfx.riser(); sfx.choir(3); sfx.boom(); B3.sunU.uFlash.value = 1;
  burst(0, B3.sunY, 0, 160, 2, 2, 2.4, 12, 1.2, 0.25, 1, 0);
}
function b3LastLightEnd() {
  const ll = B3.ll; ll.active = false; bossRT.lastLight = false; ui.el.bigCast.classList.remove('on'); B3.prompt.classList.remove('on');
  if (bossRT.cast.name === 'LAST LIGHT') bossRT.cast.active = false;
}
function b3UpdateLastLight(dt) {
  const ll = B3.ll; if (!ll.active) return;
  const b = bossRT; ll.t += dt; b.fracture = 100;
  ui.set('bigcf', ui.el.bigCastFill, 'tf', `scaleX(${clamp(ll.t / ll.dur, 0, 1).toFixed(3)})`);
  // slow white spiral to dodge while your Radiance surges (two arms, 5 shots/s)
  ll.spT -= dt; while (ll.spT <= 0) { ll.spT += 0.4; ll.spA += 0.5; for (let k = 0; k < 2; k++) { const a = ll.spA + k * Math.PI; shoot(Math.cos(a) * 2.9, Math.sin(a) * 2.9, a, 3.0, W, 0.32, 12, 9); } sfx.shot(W); }
  // sun gathers light inward
  if (frand() < 0.9) { const a = frand() * TAU, r = 9 + frand() * 6, y = 1 + frand() * 6; emitP(Math.cos(a) * r, y, Math.sin(a) * r, -Math.cos(a) * r * 0.9, (B3.sunY - y) * 0.9, -Math.sin(a) * r * 0.9, 2, 2, 2.3, 1.0, 0.18, 4); }
  if (b.novaInLastLight && (player.novaT < 0 || player.novaT >= 0.4)) { b3LastLightEnd(); b.invuln = false; bossDie(); return; }
  if (ll.t >= ll.dur && !b.novaInLastLight) {
    b3LastLightEnd(); b.invuln = false; bossInterrupt();
    LU.uWhite.value = 0.6; b.wipeT = 0; bloomSpike(1.6); addTrauma(1); shockAt(0, B3.sunY, 0, 0.1); sfx.boom(); sfx.shatter(1.5);
    ring(0, 0.3, 0, 2, 32, 1.0, 1.0, 2.4, 2.4, 2.6, 1.6); burstRainbow(0, B3.sunY, 0, 200, 18, 1.5, 0.3, 0);
    ui.toast('THE LAST LIGHT CONSUMES ALL', 2.4, true);
    if (!debug.god) { player.hurtI = 0; player.invuln = 0; hitSrc = 'lastlight'; damagePlayer(999, W); }
  }
}

function b3HudOff() { if (B3.hud) { B3.hud.classList.remove('on'); B3.prompt.classList.remove('on'); } ui.el.bigCast.classList.remove('on'); }
function b3Reset() {
  B3.sunY = 4.5; B3.scaleBase = 1; B3.collapseK = 1; B3.cint = 1; B3.ringK = 0; B3.diamond = 0; B3.eclK = 0; B3.eclSlide = 0; B3.darkK = 0; B3.shake = 0;
  B3.dawn = 0; B3.auroraA = 0; B3.deathT = -1; B3.firstPulse = true; B3.firstWell = true; B3.firstChain = true; B3.firstCrack = true; B3.moonsDown = false; B3.checkpoint = false;
  B3.sun.visible = B3.rim.visible = B3.corona.visible = true; B3.ecl.visible = false; B3.rays.visible = false; B3.raysU.uA.value = 0;
  for (const h of B3.halos) h.m.visible = true; for (const a of B3.aurora) a.visible = false; B3.auroraU.uA.value = 0;
  const su = B3.sunU; su.uCrack.value = 0; su.uFlash.value = 0; su.uGlow.value = 0;
  const cu = B3.coronaU; cu.uRing.value = 0; cu.uDiamond.value = 0; cu.uInt.value = 1; cu.uGather.value = 0;
  b3SetPal('corona', true); floorU.uSwirl.value = 1; floorU.uIgnite.value = 99; floorU.uDawn.value = 0; floorU.uFloorDim.value = 0;
  for (const m of B3.moons) { m.alive = false; m.tgt.alive = false; m.vis = true; m.g.visible = true; m.mode = 0; m.ang = m.i * TAU / 3; m.glow = 1; m.beam.m.visible = false; m.u.uCrack.value = 0; m.hp = 1400; targets.push(m.tgt); }
  for (const q of B3.pulses) { q.active = false; q.wall.visible = q.flat.visible = false; }
  for (const v of B3.voids) v.active = false; for (let i = 0; i < 6; i++) floorU.uVoid.value[i].w = 0;
  B3.tether.active = false; B3.tether.m.visible = false; B3.well.active = false;
  B3.ll.active = false; B3.ll.done = false; b3HudOff();
  SECTIONS.b3p3.bpm = 128; starU.uSpin.value = 0;
}
function b3ClearMechanics() {
  for (const q of B3.pulses) { q.active = false; q.wall.visible = q.flat.visible = false; }
  B3.tether.active = false; B3.tether.m.visible = false; B3.well.active = false;
}
function b3GravityWell(mode) {
  const cast = mode ? 1.2 : 2.0, pull = mode ? 2.0 : 3.0, str = mode ? 5 : 6, n = mode ? 3 : 4;
  castBar('Gravity Well', cast); sfx.growl(); sfx.riser(); B3.coronaU.uFlash.value = 0.6;
  const W_ = B3.well; W_.active = true; W_.t = 0; W_.cast = cast; W_.pull = pull; W_.str = str; W_.n = n;
  const a0 = rng() * TAU;
  for (let k = 0; k < n; k++) { const a = a0 + k * TAU / n + (rng() - 0.5) * 0.4, r = 8.2 + rng() * 2; W_.px[k] = Math.cos(a) * r; W_.pz[k] = Math.sin(a) * r; teleSafe(W_.px[k], W_.pz[k], 1.8, cast + pull); }
  W_.tele = teleCircle(0, 0, 5, cast + pull, 30, Bc, { onResolve: () => { ring(0, 0.2, 0, 6, 0.5, 0.5, 0.6, 1.0, 1.4, 2.6, 1.6); burst(0, 0.8, 0, 120, 0.8, 1.2, 2.6, 12, 0.9, 0.25, 0.6, 0); addTrauma(0.5); bloomSpike(1); shockAt(0, 0.5, 0, 0.06); sfx.boom(); } });
  if (B3.firstWell) { B3.firstWell = false; ui.toast('GRAVITY WELL — shelter in a cyan pocket', 3, true); }
}
function b3Sunspot(n) {
  castBar('Sunspot', 0.3 * n + 0.5);
  every(0.3, n, () => {
    _v2a.set(player.x + player.vx * 0.8, player.z + player.vz * 0.8); b3InArena(_v2a, 3.4, 13.4);
    teleCircle(_v2a.x, _v2a.y, 2.4, b3Windup(), 18, Bc, { onResolve: (o) => {
      beam(o.x, 18, o.z, o.x, 0, o.z, 1.3, 0.32, 0.35, 0.6, 1.8, 1, 1.4); burst(o.x, 0.4, o.z, 30, 0.6, 1.0, 2.6, 8, 0.6, 0.2, 0.7, 0);
      ring(o.x, 0.1, o.z, 0.3, 3.4, 0.45, 0.25, 0.6, 1.0, 2.6, 1.3); addTrauma(0.14);
    } });
  });
}
function b3SolarFlare(mode) { // mode 0: blue wall ×2 · mode 1: eclipse flare (R/B mixed, faster)
  castBar(mode ? 'Eclipse Flare' : 'Solar Flare', 1.0); B3.coronaU.uFlash.value = 1; sfx.choir(mode ? 2 : 0); B3.sunU.uFlash.value = 0.25;
  const sp = (mode ? 8 : 7) * DIFF[2].spd;
  for (let w = 0; w < 2; w++) after(1.0 + w * 2.5, () => {
    const dir = w ? -1 : 1, a0 = aimAt(0, 0) - dir * TAU / 6;
    every(1 / 16, 32, (i) => {
      const a = a0 + dir * (i / 31) * (TAU / 3), c = mode ? (i % 2 ? R : Bc) : Bc;
      shoot(Math.cos(a) * 2.8, Math.sin(a) * 2.8, a, sp, c, 0.3, 15, 4);
      if (i % 2 === 0) shoot(Math.cos(a) * 2.8, Math.sin(a) * 2.8, a, sp * 0.74, c, 0.24, 12, 5);
      if (i % 4 === 0) sfx.shot(c);
      if (i % 3 === 0) { const pc = PCOL[c]; emitP(Math.cos(a) * 2.6, B3.sunY - 1, Math.sin(a) * 2.6, Math.cos(a) * 6, -3, Math.sin(a) * 6, pc[0] * 2, pc[1] * 2, pc[2] * 2, 0.5, 0.3, 4); }
    });
  });
}

const BOSS3 = {
  id: 3, name: 'THE NULL SUN', subtitle: 'Eclipse Sovereign', deathTitle: 'THE NULL SUN', deathSub: 'DAWN',
  arena: 2, arenaR: 15, maxHp: 36000, enrage: 300, hit: { x: 0, y: 4.5, z: 0, r: 2.6, hy: 4.6 },
  barGrad: 'linear-gradient(90deg,#ff4a2a,#ffb070 18%,#ffffff 45%,#9fb8ff 70%,#3a52ff)', music: ['b3p1', 'b3p2', 'b3p3'],
  phases: [
    { name: 'Corona', until: 0.7, loop: 14, steps: [[0, 'SolarFlare', 0], [5.5, 'CoronaPulse', 0], [9, 'Sunspot', 5], [11.5, 'PrismShards']] },
    { name: 'Prism Court', until: 0.4, loop: 18, steps: [[3, 'GravityWell', 0], [8, 'Tether'], [12, 'Sunspot', 6], [15, 'CoronaPulse', 1]] },
    { name: 'Supernova', until: 0, loop: 16, steps: [[0, 'Cracks'], [2, 'SolarFlare', 1], [6, 'CoronaPulse', 2], [8.5, 'WhiteHalo'], [11, 'FrontalEclipse'], [13, 'GravityWell', 1]] },
  ],
  camBias: 0.22,
  hue: [0.6, 0.8, 1.0],
  camTop() { return B3.sunY + 2.55 * Math.max(0.3, B3.scaleBase * B3.collapseK); },
  build: buildBoss3,
  show(on) { B3.group.visible = on; if (!on) b3HudOff(); },
  reset() { b3Reset(); },
  transitionInstant(n) {
    b3ClearMechanics();
    if (n === 1) { b3SetPal('white', true); floorU.uSwirl.value = -1; B3.coronaU.uFlash.value = 0; }
    if (n === 2) { for (const m of B3.moons) b3KillMoon(m, false); bossRT.shieldMul = 1; b3SetPal('eclipse', true); B3.eclK = 1; B3.eclSlide = 0; B3.ringK = 1; B3.diamond = 0.5; }
  },
  onPhase(n) {
    if (n === 1) b3MoonsDetach(false);
    if (n === 2) {
      B3.checkpoint = true; B3.cpTime = game.fightTime; bossRT.enrageLeft = B3_NOVA_T; bossRT.enrageWarned = false; B3.hud.classList.add('on');
      ui.tutorial('supernova', 'SUPERNOVA in ' + B3_NOVA_T + ' s — burn it down before it ignites');
    }
  },
  onInterrupt() { b3ClearMechanics(); },
  hpCheck() { const b = bossRT; if (b.phase === 2 && !B3.ll.done && b.hp <= 0.1 * b.maxHp) { b.hp = 0.1 * b.maxHp; b3LastLight(); return true; } return false; },
  enrageName() { return bossRT.phase === 2 ? 'SUPERNOVA' : 'ENRAGE'; },
  onEnrage() { B3.sunU.uFlash.value = 1; B3.collapseK = 1.6; bloomSpike(1.6); shockAt(0, B3.sunY, 0, 0.12); ring(0, 0.3, 0, 2, 34, 1.2, 1.2, 2.6, 1.2, 0.6, 1.8); burstRainbow(0, B3.sunY, 0, 170, 22, 1.4, 0.35, 0); sfx.shatter(1.5); },
  apPenalty(cx, cz) {
    let p = 0; const r = Math.hypot(cx, cz);
    if (B3.pulses.some((q) => q.active && !q.done)) p += Math.max(0, Math.abs(wrapA(Math.atan2(cz, cx) - B3.gapA)) - B3.gapW * 0.6) * 8;
    if (r < 4.4) p += 30;
    for (const v of B3.voids) if (v.active && Math.hypot(cx - v.x, cz - v.z) < v.r + 1.2) p += 30;
    if (B3.tether.active && r < 9.2) p += (9.2 - r) * 6;
    const W_ = B3.well; if (W_.active) { let best = 1e9; for (let i = 0; i < W_.n; i++) best = Math.min(best, Math.hypot(cx - W_.px[i], cz - W_.pz[i])); p += best * 2.5; }
    return p;
  },
  apHook() {
    const p = player, r = Math.hypot(p.x, p.z) || 1;
    if (p.dashT < 0 && p.dashCharges > 0) for (const q of B3.pulses) { if (!q.active || q.done || (q.gapW > 0 && Math.abs(wrapA(Math.atan2(p.z, p.x) - q.gapA)) < q.gapW - 0.1)) continue; const d = r - q.r; if (d > 0.1 && d < 1.0 + q.speed * 0.06) { input.mx = -p.x / r; input.mz = -p.z / r; useAbility('dash'); break; } }
    if (B3.tether.active && r < 7.5 && abilityReady('mirror')) useAbility('mirror');
    if (bossRT.lastLight && abilityReady('nova')) useAbility('nova');
  },
  casts: {
    SolarFlare(mode = 0) { b3SolarFlare(mode); },
    EclipseFlare() { b3SolarFlare(1); },
    CoronaPulse(mode = 0) {
      const n = mode === 1 ? 2 : 3, sp = [6, 7.5, 8][mode] || 6;
      castBar('Corona Pulse', 1.0 + 0.6 * n); B3.coronaU.uFlash.value = 0.5;
      teleRing(0, 0, 2.8, 15.2, 1.0, 0, Bc, { noHit: true });
      // one gap (a calm lane) per cast, opened to the player's side: run for it, or dash through the walls
      const gw = [0.4, 0.36, 0.3][mode] || 0.36, off = [1.0, 1.15, 1.3][mode] || 1.1;
      const ga = wrapA(Math.atan2(player.z, player.x) + (rng() < 0.5 ? -1 : 1) * (off + rng() * 0.45));
      const laneT = 1.0 + 0.6 * (n - 1) + 12.5 / sp;
      const lane = teleCone(0, 0, ga, gw - 0.04, 15.2, laneT, 0, -1, { noHit: true, tag: 7 });
      lane.u.uColor.value.setRGB(TCOL_SAFE[0], TCOL_SAFE[1], TCOL_SAFE[2]); lane.u.uTint.value.setRGB(TCOL_SAFE[0], TCOL_SAFE[1], TCOL_SAFE[2]);
      B3.gapA = ga; B3.gapW = gw; B3.gapT = laneT;
      every(0.6, n, () => b3Pulse(sp, Bc, ga, gw), 1.0);
      if (B3.firstPulse) { B3.firstPulse = false; ui.tutorial('pulse', 'Corona rings: run for the cyan lane, or DASH through the walls'); }
    },
    Sunspot(n = 5) { b3Sunspot(n); },
    PrismShards() {
      castBar('Prism Shards', 1.4);
      for (const m of B3.moons) {
        if (!m.vis || m.mode !== 0) continue;
        after(m.i * 0.25, () => {
          const ox = m.x, oz = m.z; const a = aimAt(ox, oz); m.u.uFlash.value = 1;
          const o = teleLine(ox, oz, ox + Math.cos(a) * 26, oz + Math.sin(a) * 26, 0.7, 0.55, 0, m.c, { noHit: true, follow: (o) => { const aa = aimAt(m.x, m.z); teleSetLine(o, m.x, m.z, m.x + Math.cos(aa) * 26, m.z + Math.sin(aa) * 26, 0.7); }, lockAt: 0.85 });
          after(0.55, () => {
            const sx = o.x, sz = o.z, aa = Math.atan2(o.z1 - o.z, o.x1 - o.x);
            every(0.08, 5, () => { shoot(sx, sz, aa, 9 * DIFF[2].spd, m.c, 0.3, 15, 4); }); sfx.shot(m.c);
            const pc = PCOL[m.c]; beam(m.x, m.y, m.z, sx, 0.9, sz, 0.12, 0.3, pc[0], pc[1], pc[2], 1, 1.2); burst(m.x, m.y, m.z, 16, pc[0] * 2, pc[1] * 2, pc[2] * 2, 4, 0.4, 0.16, 1, 0);
          });
        });
      }
    },
    MoonsDetach() { b3MoonsDetach(false); },
    GravityWell(mode = 0) { b3GravityWell(mode); },
    Tether() {
      const T = B3.tether; T.active = true; T.t = 0; T.dur = 6; T.tick = 0.4; T.red = false;
      castBar('Solar Chain', 6, true); sfx.laser(); B3.coronaU.uFlash.value = 0.6;
      if (B3.firstChain) { B3.firstChain = false; ui.toast('SOLAR CHAIN — stay 8 m from the sun, or cut it with your Mirror', 3.4, true); }
    },
    Cracks() {
      castBar('Singularity', 1.0); sfx.growl();
      for (let k = 0; k < 3; k++) {
        if (k === 0) _v2a.set(player.x + (rng() - 0.5) * 2, player.z + (rng() - 0.5) * 2); else { const p = randInArena(12); _v2a.set(p.x, p.y); }
        b3InArena(_v2a, 5, 12); const mx = _v2a.x, mz = _v2a.y, a = rng() * Math.PI, c = Math.cos(a) * 4.5, s = Math.sin(a) * 4.5;
        teleLine(mx - c, mz - s, mx + c, mz + s, 1.2, 1.0, 16, R, { onResolve: (o) => { b3OpenVoid((o.x + o.x1) / 2, (o.z + o.z1) / 2, 2.0, 12); } });
      }
      if (B3.firstCrack) { B3.firstCrack = false; ui.tutorial('voids', 'Singularity cracks tear the floor open — stay out of the voids'); }
    },
    WhiteHalo() {
      castBar('White Halo', 1.8); B3.coronaU.uFlash.value = 1;
      const a0 = rng() * TAU;
      every(0.6, 3, (i) => { patRing(0, 0, 36, 3.2 * DIFF[2].spd, W, 0.3, 15, a0 + i * 5 * Math.PI / 180, null, 0, 0, 9); sfx.shot(W); ring(0, 1, 0, 2.6, 6, 0.4, 0.3, 2, 2, 2, 1.2); });
      ui.tutorial('white', 'White Halo: slip through the gaps, or DASH through a wave for a PERFECT');
    },
    FrontalEclipse() {
      const w = b3Windup(), half = 40 * Math.PI / 180;
      castBar('Frontal Eclipse', w + 0.9); sfx.growl();
      const first = teleCone(0, 0, aimAt(0, 0), half, 16, w, 25, R, {
        lockAt: 0.45, follow: (o) => { teleSetCone(o, 0, 0, aimAt(0, 0), half, 16); if (second) teleSetCone(second, 0, 0, o.ang + Math.PI, half, 16); },
        onResolve: (o) => { addTrauma(0.4); bloomSpike(0.8); sfx.boom(); shockAt(0, 1, 0, 0.04); for (let k = 0; k < 50; k++) { const a = o.ang + (frand() - 0.5) * 2 * half, sp = 8 + frand() * 12; emitP(Math.cos(a) * 2.8, 1 + frand(), Math.sin(a) * 2.8, Math.cos(a) * sp, frand() * 2, Math.sin(a) * sp, 2.6, 0.5, 0.2, 0.8, 0.26, 0); } },
      });
      const second = teleCone(0, 0, first.ang + Math.PI, half, 16, w + 0.8, 25, R, {
        lockAt: 1.0, onResolve: (o) => { addTrauma(0.4); bloomSpike(0.8); sfx.boom(); for (let k = 0; k < 50; k++) { const a = o.ang + (frand() - 0.5) * 2 * half, sp = 8 + frand() * 12; emitP(Math.cos(a) * 2.8, 1 + frand(), Math.sin(a) * 2.8, Math.cos(a) * sp, frand() * 2, Math.sin(a) * sp, 2.6, 0.5, 0.2, 0.8, 0.26, 0); } },
      });
    },
    LastLight() { const b = bossRT; if (b.phase !== 2) bossStartTransition(2, true); b.hp = Math.min(b.hp, 0.1 * b.maxHp); b3LastLight(); },
  },
  update(dt) {
    const t = fx.simTime, b = bossRT, fighting = game.state === 'fight' && !b.dead && !b.transitioning;
    B3.sunU.uTime.value = t; B3.coronaU.uTime.value = t; B3.raysU.uTime.value = t; B3.auroraU.uTime.value = t;
    b3PalStep(dt);
    // supernova growth (phase 3)
    if (b.phase === 2 && !b.dead && !B3.ll.active) {
      const k = clamp(1 - b.enrageLeft / B3_NOVA_T, 0, 1);
      B3.scaleBase = 1 + 0.8 * k; B3.sunU.uGlow.value = k * 0.9;
      SECTIONS.b3p3.bpm = 128 + Math.round(k * 34);
      const n = Math.max(0, Math.ceil(b.enrageLeft));
      if (n !== B3.hudN) { B3.hudN = n; B3.hudN_el.textContent = String(n); B3.hud.style.setProperty('--k', (clamp(b.enrageLeft / B3_NOVA_T, 0, 1) * 100).toFixed(1) + '%'); const crit = n <= 20; if (crit !== B3.hudCrit) { B3.hudCrit = crit; B3.hud.classList.toggle('crit', crit); } }
    } else if (b.phase < 2) { B3.scaleBase = damp(B3.scaleBase, 1, 3, dt); }
    if (B3.ll.active) B3.scaleBase = damp(B3.scaleBase, 0.8, 1.5, dt);
    // sun body
    B3.sunY = 4.5 + Math.sin(t * 0.6) * 0.12;
    const sc = Math.max(0.02, B3.scaleBase * B3.collapseK);
    if (B3.collapseK > 1) B3.collapseK = damp(B3.collapseK, 1, 2, dt);
    const shx = B3.shake > 0 ? (frand() - 0.5) * B3.shake : 0, shz = B3.shake > 0 ? (frand() - 0.5) * B3.shake : 0;
    B3.sun.position.set(shx, B3.sunY, shz); B3.sun.scale.setScalar(sc); B3.rim.position.copy(B3.sun.position); B3.rim.scale.setScalar(sc);
    B3.corona.position.copy(B3.sun.position); B3.corona.scale.setScalar(sc); B3.corona.quaternion.copy(camera.quaternion);
    B3.rays.position.copy(B3.sun.position); B3.rays.quaternion.copy(camera.quaternion);
    const cu = B3.coronaU, su = B3.sunU;
    if (cu.uFlash.value > 0) cu.uFlash.value = Math.max(0, cu.uFlash.value - dt * 2.5);
    if (b.flash > 0) cu.uFlash.value = Math.max(cu.uFlash.value, 0.12);
    const stun = b.stagger > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 9)) : 1;
    cu.uInt.value = B3.cint * stun * (1 - B3.darkK) * (B3.ll.active ? 1.3 + 0.3 * Math.sin(t * 8) : 1) * (1 - 0.5 * (B3.glass || 0));
    if (b.lanceFlash > 0) su.uFlash.value = Math.max(su.uFlash.value, 0.45);
    if (game.state === 'fight') teleHC.value = b.phase === 2 ? 1 : 0;
    cu.uRing.value = B3.ringK; cu.uDiamond.value = B3.diamond * (1 - B3.darkK); cu.uGather.value = damp(cu.uGather.value, B3.ll.active ? 1 : 0, 3, dt);
    su.uCrack.value = Math.max(su.uCrack.value * (B3.deathT >= 0 ? 1 : 0), damp(su.uCrack.value, b.vuln > 0 ? 1 : 0, 6, dt)); su.uFracture.value = b.fracture >= 100 ? 1 : 0;
    if (su.uFlash.value > 0) su.uFlash.value = Math.max(0, su.uFlash.value - dt * 3);
    su.uEdge.value.copy(cu.uCol.value); B3.rimU.uCol.value.copy(cu.uCol2.value).lerp(cu.uCol.value, 0.5); B3.rimU.uA.value = (1 - B3.darkK) * B3.cint;
    // the sun turns glassy when the player stands behind it on screen (keeps bullets readable)
    { _v1.set(0, B3.sunY, 0).project(camera); _v2.set(player.x, 1, player.z).project(camera); const asp = VW / VH;
      const dsx = (_v2.x - _v1.x) * asp, dsy = _v2.y - _v1.y; _v3.set(2.4 * sc, B3.sunY, 0).project(camera); const rs = Math.abs(_v3.x - _v1.x) * asp + 0.05;
      const behind = player.z < 1.5 && Math.hypot(dsx, dsy) < rs * 1.15 ? 1 : 0; B3.glass = damp(B3.glass || 0, behind, 6, dt);
      su.uAlpha.value = (B3.deathT >= 0 ? 1 : 0.9 - 0.55 * B3.glass); B3.ecl.material.opacity = 0.92 - 0.55 * B3.glass; }
    // eclipse moon in front of the sun (toward the camera)
    B3.ecl.visible = B3.eclK > 0.01 && B3.sun.visible;
    if (B3.ecl.visible) {
      _v1.copy(camera.position).sub(B3.sun.position).normalize(); _v2.set(-_v1.z, 0, _v1.x).normalize();
      B3.ecl.position.copy(B3.sun.position).addScaledVector(_v1, 1.6).addScaledVector(_v2, B3.eclSlide * 6.5);
    }
    // halo rings
    const P = B3PAL[B3.pal];
    for (const h of B3.halos) { h.a += dt * h.sp; h.m.position.copy(B3.sun.position); h.m.rotation.set(Math.PI / 2 + h.tilt, 0, h.a); h.m.scale.setScalar((h === B3.halos[0] ? 3.7 : 4.6) * Math.max(1, sc)); h.m.material.color.setRGB(P.ring[0], P.ring[1], P.ring[2]).multiplyScalar(1.2 * (1 - B3.darkK) * B3.cint); }
    // gravitational lens
    let warp = 0;
    if (B3.sun.visible && B3.cint > 0.05) { _v1.set(0, B3.sunY, 0).project(camera); if (_v1.z < 1 && Math.abs(_v1.x) < 1.6 && Math.abs(_v1.y) < 1.6) { LU.uWarpCenter.value.set(_v1.x * 0.5 + 0.5, _v1.y * 0.5 + 0.5); warp = B3.warp * (1 + b.phase * 0.25) * B3.cint * Math.max(1, sc) * (B3.well.active ? 1.6 : 1); } }
    LU.uWarpStrength.value = warp; LU.uWarpRadius.value = 0.16 * Math.max(1, sc * 0.8);
    // gravity & the lethal horizon
    let grav = 0;
    if (fighting) {
      grav = [0.8, 1.4, 2.0][b.phase] || 0; if (B3.ll.active) grav = 1.0;
      const wg = b3UpdateWell(dt); if (wg > 0) grav = wg; else if (wg < 0) grav = 0;
      if (player.alive) {
        const r = Math.hypot(player.x, player.z) || 0.001;
        if (r < 2.6 && player.dashT < 0) {
          const k = 3.0 / r; player.x *= k; player.z *= k; player.stunT = Math.max(player.stunT, 0.15);
          hitSrc = 'horizon'; resolveHazard(-0.1, 0, W, 20, false);
          burst(player.x, 0.6, player.z, 20, 2.4, 1.6, 1.2, 6, 0.5, 0.16, 1, 0);
        }
      }
    } else { B3.well.active = false; }
    game.gravity = grav;
    b3UpdateMoons(dt, fighting);
    b3UpdatePulses(dt, fighting);
    b3UpdateVoids(dt, fighting);
    b3UpdateTether(dt, fighting);
    if (fighting || B3.ll.active) b3UpdateLastLight(dt);
    // starfield swirl & infalling matter
    B3.spin += dt * (0.012 + b.phase * 0.008) * (floorU.uSwirl.value < 0 ? -1 : 1) * (1 - B3.dawn); starU.uSpin.value = B3.spin;
    if (B3.sun.visible && B3.dawn < 0.5) {
      B3.infallAcc += dt * (Q.cfg.low ? 12 : 30) * B3.cint;
      while (B3.infallAcc >= 1) {
        B3.infallAcc -= 1; const a = frand() * TAU, r = 12 + frand() * 6, sw = floorU.uSwirl.value; const ca = Math.cos(a), sa = Math.sin(a);
        const vx = -ca * 3.2 - sa * 3.4 * sw, vz = -sa * 3.2 + ca * 3.4 * sw; const rc = floorU.uRampB.value;
        emitP(ca * r, 0.06 + frand() * 0.25, sa * r, vx, 0, vz, rc.r * 1.6, rc.g * 1.6, rc.b * 1.6, 2.6, 0.09 + frand() * 0.08, 4);
      }
    }
    // dawn finale state
    floorU.uDawn.value = B3.dawn; B3.auroraU.uA.value = B3.auroraA; for (const a of B3.aurora) a.visible = B3.auroraA > 0.001;
    if (B3.dawn > 0.2 && frand() < 0.5 * B3.dawn) { const a = frand() * TAU, r = Math.sqrt(frand()) * 17; _col.setHSL(frand(), 0.9, 0.7); emitP(Math.cos(a) * r, 0.1, Math.sin(a) * r, 0, 0.5 + frand() * 0.8, 0, _col.r * 1.4, _col.g * 1.4, _col.b * 1.4, 3.5, 0.1, 3); }
    // floor light blobs: the corona + prism moons
    const Lv = floorU.uLights.value, Lc = floorU.uLightCol.value;
    Lv[0].set(0, B3.sunY, 0, B3.sun.visible ? 0.75 * B3.cint * (1 - B3.darkK) * sc : 0); Lc[0].copy(cu.uCol.value);
    for (let k = 0; k < 3; k++) { const m = B3.moons[k]; if (m.vis && m.g.visible) { Lv[k + 1].set(m.x, m.y, m.z, 0.8 * (1 - B3.darkK)); const pc = PCOL[m.c]; Lc[k + 1].setRGB(pc[0], pc[1], pc[2]); } else Lv[k + 1].w = 0; }
    floorU.uBossPos.value.set(0, 0); floorU.uBossShadow.value = 0;
  },
  // ---- cinematics ----
  introCine() {
    const keys = [[0, 0, 30, 26, 0, 0, 1, 60], [1.1, 0, 19, 21, 0, 0, 3, 48], [2.4, 8, 6.5, 14, 0, 4.0, 0, 50], [3.4, -4.8, 1.6, 12.0, 0, 5.0, 0, 58], [4.7, -4.2, 2.4, 13.2, 0, 5.2, 0, 55], [5.8, 0, 17.5, 19.5, 0, 0, 6, 50]];
    return {
      dur: 5.8, skippable: 0.6, skipTo: 5.4,
      start() {
        ui.hud(false); player.x = 0; player.z = 7; playerG.visible = false; floorU.uIgnite.value = 0; B3.cint = 0; sfx.fall();
        for (const m of B3.moons) { m.vis = false; m.g.visible = false; }
      },
      update(t) {
        camKeys(t, keys);
        floorU.uIgnite.value = t < 1.2 ? 0 : t > 3.2 ? 99 : (t - 1.2) / 1.7 * 30;
        B3.cint = smooth((t - 1.9) / 0.5) * (1 + 0.6 * Math.exp(-Math.max(0, t - 2.0) * 3));
      },
      ev: [
        [0.5, () => { reform(0, 1.15, 7, 60, 0.45, 1.4, 1.6, 2.2, 6); }],
        [0.95, () => { playerG.visible = true; ring(0, 0.06, 7, 0.3, 5, 0.7, 0.3, 2, 2.2, 2.6, 1.4); bloomSpike(0.8); addTrauma(0.3); sfx.boom(); }],
        [1.2, () => { sfx.riser(); ring(0, 0.1, 0, 2.6, 18, 1.6, 0.8, 2.6, 1.2, 0.5, 1.4); }],
        [1.95, () => { bloomSpike(2.2); shockAt(0, 4.5, 0, 0.09); addTrauma(0.6); sfx.boom(); sfx.shatter(0.6); burst(0, 4.5, 0, 180, 0.8, 1.3, 2.6, 16, 1.2, 0.3, 1, 0); aberrSpike(0.012); }],
        ...[0, 1, 2].map((i) => [2.5 + i * 0.3, () => {
          const m = B3.moons[i]; m.vis = true; m.g.visible = true; m.mode = 3; m.flyT = 0; const a = -Math.PI / 2 + (i - 1) * 1.2;
          m.from.set(Math.cos(a) * 30, 14, Math.sin(a) * 30); m.x = m.from.x; m.y = m.from.y; m.z = m.from.z; m.u.uFlash.value = 1; sfx.chime(4 + i * 2);
        }]),
        [3.4, () => { ui.letterbox(true); ui.titleCard('THE NULL SUN', 'Eclipse Sovereign · Final Refraction', 2.6); music.setSection('b3p1'); rainbowWave(0, 0, 0.8, 14); }],
      ],
      end() { floorU.uIgnite.value = 99; B3.cint = 1; playerG.visible = true; for (const m of B3.moons) { m.vis = true; m.g.visible = true; if (m.mode === 3) m.mode = 0; } },
    };
  },
  transitionCine(n) {
    const c0 = new THREE.Vector3(), l0 = new THREE.Vector3();
    if (n === 1) return { // COLLAPSE
      dur: 2.6,
      start() { c0.copy(cam.pos); l0.copy(cam.look); director.timeScale = 0.5; ui.titleCard('COLLAPSE', '', 2.0); sfx.riser(); b3ClearMechanics(); },
      update(t) {
        const k = smooth(t / 0.7); director.camPos.set(lerp(c0.x, 6.5, k), lerp(c0.y, 5.5, k), lerp(c0.z, 13.5, k)); director.camLook.set(lerp(l0.x, 0, k), lerp(l0.y, 3.8, k), lerp(l0.z, 0, k)); director.fov = lerp(50, 56, smooth(t / 2.6));
        if (t < 0.5) { B3.collapseK = lerp(1, 0.05, easeIn(t / 0.5)); B3.cint = 1 + t * 2; }
        else if (t < 1.1) { B3.collapseK = 0.05; B3.cint = 0.05; B3.darkK = smooth((t - 0.5) / 0.12); LU.uDark.value = 0.7 * B3.darkK; floorU.uFloorDim.value = B3.darkK; starU.uBright.value = 1 - 0.9 * B3.darkK; nebU.uOp.value = 0.25 * (1 - B3.darkK); }
        else { const k2 = (t - 1.1) / 0.6; B3.collapseK = k2 < 1 ? lerp(0.05, 1.0, easeOut(k2)) * (1 + 0.25 * Math.sin(Math.min(1, k2) * Math.PI)) : 1; B3.cint = 1.6 - 0.6 * smooth((t - 1.1) / 1.2);
          B3.darkK = Math.max(0, 1 - (t - 1.1) / 0.3); LU.uDark.value = 0.7 * B3.darkK; floorU.uFloorDim.value = B3.darkK; starU.uBright.value = 1 - 0.9 * B3.darkK; nebU.uOp.value = 0.25 * (1 - B3.darkK); }
        if (t > 2.0) director.timeScale = lerp(0.5, 1, (t - 2.0) / 0.6);
      },
      ev: [
        [0.0, () => { B3.coronaU.uFlash.value = 1; bloomSpike(1.0); for (const m of B3.moons) m.u.uFlash.value = 1; }],
        [0.5, () => { sfx.boom(); addTrauma(0.3); }],
        [1.1, () => { b3SetPal('white', true); floorU.uSwirl.value = -1; bloomSpike(2.5); aberrSpike(0.015); shockAt(0, 4.5, 0, 0.09); addTrauma(0.8); sfx.boom(); sfx.shatter(1.2);
          burst(0, 4.5, 0, 240, 2.2, 2.4, 2.8, 18, 1.3, 0.3, 1, 0); rainbowWave(0, 0, 1.2, 18); ring(0, 0.2, 0, 2.6, 22, 1.0, 0.9, 1.6, 2.0, 2.6, 1.4); game.satTarget = Math.min(1, game.sat + 0.08); }],
      ],
      end() { director.timeScale = 1; B3.collapseK = 1; B3.cint = 1; B3.darkK = 0; LU.uDark.value = 0; floorU.uFloorDim.value = 0; starU.uBright.value = 1; nebU.uOp.value = 0.25; b3SetPal('white', true); floorU.uSwirl.value = -1; },
    };
    return { // ECLIPSE
      dur: 3.0,
      start() { c0.copy(cam.pos); l0.copy(cam.look); director.timeScale = 0.5; ui.titleCard('ECLIPSE', '', 2.4); sfx.riser(); b3ClearMechanics(); B3.eclK = 1; B3.eclSlide = 1; B3.diamond = 0;
        playerG.visible = false; // the low-angle shot sits right behind the player
        for (const m of B3.moons) if (m.vis) b3KillMoon(m, true); bossRT.shieldMul = 1; music.setSection('silence'); },
      update(t) {
        const k = smooth(t / 1.1); director.camPos.set(lerp(c0.x, 0, k), lerp(c0.y, 1.5, k), lerp(c0.z, 11, k)); director.camLook.set(lerp(l0.x, 0, k), lerp(l0.y, 4.5, k), lerp(l0.z, 0, k)); director.fov = lerp(50, 60, k);
        B3.eclSlide = 1 - smooth((t - 0.3) / 1.45); B3.ringK = smooth((t - 1.1) / 0.65);
        B3.diamond = t < 1.6 ? 0 : t < 1.8 ? (t - 1.6) / 0.2 * 3.2 : Math.max(0.5, 3.2 * Math.exp(-(t - 1.8) * 2.2));
        if (t > 2.4) director.timeScale = lerp(0.5, 1, (t - 2.4) / 0.6);
      },
      ev: [
        [1.75, () => { bloomSpike(2.6); aberrSpike(0.014); sfx.chime(9, 1.2); sfx.chime(12, 0.8); }],
        [1.95, () => { b3SetPal('eclipse', false); game.sat = 1.0; addTrauma(0.7); shockAt(0, 4.5, 0, 0.08); sfx.boom(); rainbowWave(0, 0, 1.0, 16); ring(0, 0.2, 0, 2.6, 24, 1.1, 0.9, 2.6, 0.4, 0.3, 1.5); music.setSection('b3p3'); }],
      ],
      end() { director.timeScale = 1; B3.eclK = 1; B3.eclSlide = 0; B3.ringK = 1; B3.diamond = 0.5; b3SetPal('eclipse', true); playerG.visible = player.alive; },
    };
  },
  deathCine() {
    const c0 = new THREE.Vector3(), l0 = new THREE.Vector3(); const s0 = game.sat; let waveT = 0;
    return {
      dur: 8.4,
      start() {
        c0.copy(cam.pos); l0.copy(cam.look); ui.hud(false); music.setSection('silence'); b3LastLightEnd(); b3HudOff(); b3ClearMechanics(); b3CloseVoids();
        player.novaT = -1; player.y = 0; crystalU.uFlash.value = 0; player.invuln = 99; game.gravity = 0; B3.deathT = 0;
        LU.uWhite.value = 0.5; director.timeScale = 0.15; B3.sunU.uCrack.value = 1; B3.rays.visible = true; B3.raysU.uA.value = 0; B3.raysU.uLen.value = 0.25; B3.shake = 0.25;
        sfx.choir(3); bloomSpike(2); sfx.riser();
      },
      update(t, dt) {
        B3.deathT = t;
        const k1 = smooth(t / 1.0), k2 = smooth((t - 1.4) / 5.0);
        _v1.set(lerp(c0.x, 0, k1), lerp(c0.y, 3.2, k1), lerp(c0.z, 13.5, k1)); _v2.set(lerp(l0.x, 0, k1), lerp(l0.y, 4.6, k1), lerp(l0.z, 0, k1));
        director.camPos.set(_v1.x + Math.sin(k2 * 1.2) * 7 * k2, lerp(_v1.y, 13, k2), lerp(_v1.z, 19, k2)); director.camLook.set(0, lerp(_v2.y, 1.6, k2), 0); director.fov = lerp(52, 50, k2);
        if (t < 1.4) {
          LU.uWhite.value = t < 0.08 ? 0.5 : Math.max(0.0, 0.25 * (1 - (t - 0.08) / 0.5));
          B3.raysU.uA.value = smooth(t / 0.7) * 1.4; B3.raysU.uLen.value = 0.25 + t * 0.35; B3.shake = 0.1 + t * 0.35;
          director.timeScale = t < 1.0 ? 0.15 : lerp(0.15, 1, (t - 1.0) / 0.4);
        } else {
          const u = t - 1.4; LU.uWhite.value = u < 0.08 ? 0.55 : Math.max(0, 0.3 * (1 - (u - 0.08) / 0.45)); director.timeScale = 1; B3.shake = 0;
          B3.raysU.uLen.value = 0.74 + u * 0.9; B3.raysU.uA.value = Math.max(0, 1.4 * (1 - u / 2.2)); if (B3.raysU.uA.value <= 0) B3.rays.visible = false;
          B3.dawn = smooth((t - 1.7) / 2.6); B3.auroraA = smooth((t - 2.4) / 3.0);
          game.sat = lerp(s0, 1.0, smooth((t - 1.6) / 2.0)); starU.uColorful.value = smooth((t - 2.0) / 2.5); starU.uBright.value = 1 + 0.8 * smooth((t - 2.0) / 2.5);
          nebU.uA.value.setRGB(lerp(0.1, 0.55, B3.dawn), lerp(0.2, 0.25, B3.dawn), lerp(0.6, 0.5, B3.dawn)); nebU.uB.value.setRGB(lerp(0.6, 0.1, B3.dawn), lerp(0.2, 0.45, B3.dawn), lerp(0.1, 0.55, B3.dawn)); nebU.uOp.value = 0.25 + 0.15 * B3.dawn;
          waveT -= dt; if (t > 2.0 && waveT <= 0) { waveT = 1.1; rainbowWave(0, 0, 1.0 + 0.4 * B3.dawn, 13); }
        }
      },
      ev: [
        [1.4, () => {
          const sc = B3.sun.scale.x; B3.sun.visible = false; B3.rim.visible = false; B3.corona.visible = false; B3.ecl.visible = false; B3.eclK = 0; for (const h of B3.halos) h.m.visible = false;
          for (const m of B3.moons) if (m.vis) b3KillMoon(m, true);
          shatter(0, B3.sunY, 0, 2.4 * sc, 220, 2, 2, 2, 15, 3.6, 4, true); burstRainbow(0, B3.sunY, 0, 240, 20, 1.8, 0.36, 0);
          ring(0, 0.3, 0, 2, 34, 1.6, 1.2, 2.4, 2.4, 2.6, 1.6); ring(0, B3.sunY, 0, 1, 18, 1.0, 0.6, 2.6, 2.4, 2.0, 1.4);
          rainbowWave(0, 0, 2.0, 16); bloomSpike(1.8); addTrauma(1); aberrSpike(0.02); shockAt(0, B3.sunY, 0, 0.12); sfx.shatter(1.8); sfx.boom(); LU.uWhite.value = 0.55;
          game.satTarget = 1;
        }],
        [2.1, () => { music.setSection('victory'); sfx.victoryStab(); }],
        [3.8, () => { ui.letterbox(true); ui.titleCard('THE NULL SUN', 'DAWN', 3.6); }],
        [5.0, () => { sfx.victoryStab(); for (let i = 0; i < 5; i++) setTimeout(() => sfx.chime(5 + i * 2, 0.7), i * 140); }],
      ],
      end() { game.sat = game.satTarget = 1; ui.letterbox(false); B3.dawn = 1; B3.auroraA = 1; starU.uColorful.value = 1; LU.uWhite.value = 0; B3.rays.visible = false; },
    };
  },
};

/* ---- BOSS REGISTRY. Each def implements:
   build(), show(on), reset(), update(dt), casts{Name(arg)}, phases[{until,loop,steps:[[t,'Cast',arg]]}],
   introCine(), transitionCine(n), deathCine(), optional transitionInstant(n), onPhase(n), onInterrupt(), hpCheck(), enrageName(), onEnrage() */
const BOSSES = [BOSS1, BOSS2, BOSS3];

/* =====================================================================
