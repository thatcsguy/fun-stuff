   5  WORLD — floor, starfield, nebula
   ===================================================================== */
const floorU = {
  uTime: { value: 0 }, uArena: { value: 0 }, uArenaR: { value: 15 }, uEdgeGlow: { value: 1 },
  uPalFrom: { value: 0 }, uPalTo: { value: 0 }, uPalRadius: { value: 0 }, uPalCenter: { value: new THREE.Vector2() },
  uPlayerPos: { value: new THREE.Vector2(0, 7) }, uPlayerColor: { value: new THREE.Color(1, 1, 1) }, uPlayerGlow: { value: 0.6 },
  uBossPos: { value: new THREE.Vector2(0, 0) }, uBossShadow: { value: 1 },
  uWave: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] },
  uLights: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  uLightCol: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] },
  uRipples: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0)) },
  uVoid: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uSwirl: { value: 1 }, uTint: { value: new THREE.Color(0.4, 1.0, 0.6) }, uTint2: { value: new THREE.Color(0.6, 0.3, 1.0) },
  uLatPos: { value: new THREE.Vector3(0, 0, 0) },
  // Event Horizon (boss 3): temperature ramp (outer/mid/inner), ignition radius, dawn reef blend, blackout dim
  uRampA: { value: new THREE.Color(0.22, 0.015, 0.02) }, uRampB: { value: new THREE.Color(1.0, 0.38, 0.07) }, uRampC: { value: new THREE.Color(1.0, 0.93, 0.82) },
  uIgnite: { value: 99 }, uDawn: { value: 0 }, uFloorDim: { value: 0 }, uBeat: { value: 0 },
};
const floorMat = new THREE.ShaderMaterial({
  uniforms: floorU, defines: fbmDefines(), transparent: true, depthWrite: true,
  vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: GLSL_LIB + /* glsl */`
    uniform float uTime,uArena,uArenaR,uEdgeGlow,uPalFrom,uPalTo,uPalRadius,uPlayerGlow,uSwirl,uBossShadow,uIgnite,uDawn,uFloorDim,uBeat;
    uniform vec2 uPalCenter,uPlayerPos,uBossPos; uniform vec3 uPlayerColor,uTint,uTint2,uLatPos,uRampA,uRampB,uRampC;
    uniform vec4 uWave[3]; uniform vec4 uLights[4]; uniform vec3 uLightCol[4]; uniform vec4 uRipples[8]; uniform vec4 uVoid[6];
    varying vec3 vW;
    float waterH(vec2 p){ return noise2(p*1.1+vec2(uTime*0.25,uTime*0.1))*0.5 + noise2(p*2.7-vec2(uTime*0.12,-uTime*0.2))*0.25; }
    void main(){
      vec2 p = vW.xz; float r = length(p);
      vec3 V = normalize(cameraPosition - vW);
      vec4 hx = hexCoords(p*0.9);
      float he = 0.5 - hexD(hx.xy); vec2 cid = hx.zw;
      float hexLine = smoothstep(0.035, 0.0, he);
      float hexSoft = smoothstep(0.16, 0.0, he);
      vec3 col = vec3(0.0);
      vec2 grad = vec2(0.0);
      float ang = atan(p.y, p.x);
      if (uArena < 0.5) {
        // ---------------- EMBER POND ----------------
        float e = 0.15; float h0 = waterH(p);
        grad = vec2(waterH(p+vec2(e,0.0))-h0, waterH(p+vec2(0.0,e))-h0)/e*0.32;
        for(int i=0;i<8;i++){ vec4 rp=uRipples[i]; float age=uTime-rp.z; if(age<0.0||age>3.2) continue;
          vec2 dp=p-rp.xy; float d=length(dp)+1e-3; float k=d-age*3.6; float amp=rp.w*exp(-age*1.1)*exp(-k*k*1.4);
          grad += dp/d*cos(k*7.0)*amp*1.5; }
        vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
        vec3 Rf = reflect(-V, N);
        float fres = 0.03 + 0.97*pow(1.0-max(dot(N,V),0.0), 5.0);
        float up = clamp(Rf.y, 0.0, 1.0);
        vec3 sky = mix(vec3(0.06,0.04,0.11), vec3(0.006,0.008,0.02), sqrt(up));
        sky += vec3(0.07,0.045,0.12)*fbm(Rf.xz/(Rf.y+0.35)*1.4 + uTime*0.01);
        col = vec3(0.01,0.012,0.02) + sky*fres*1.25;
        for(int i=0;i<4;i++){ vec4 L=uLights[i]; if(L.w<=0.0) continue;
          vec2 lp=L.xz; float hgt=L.y; vec2 toCam=cameraPosition.xz-lp; float tl=length(toCam)+1e-3; vec2 dir=toCam/tl;
          vec2 rp = lp + toCam*(hgt/(cameraPosition.y+hgt));
          vec2 d = p - rp + grad*1.6; float along=dot(d,dir); float across=d.x*dir.y-d.y*dir.x;
          float s = exp(-across*across/0.28 - along*along/(2.5+hgt*1.6));
          float dl = length(p-lp);
          col += uLightCol[i]*L.w*(s*1.25*fres*3.0 + 0.32*exp(-dl*dl/(5.0+hgt*2.5)));
        }
        // molten palette shockwave (Phase 2)
        float pd = length(p-uPalCenter);
        float palM = mix(uPalFrom, uPalTo, smoothstep(uPalRadius, uPalRadius-3.0, pd));
        if (palM > 0.001) {
          vec2 fp = p*0.3 + vec2(uTime*0.05, -uTime*0.035) + grad*0.7;
          float f = fbm(fp + fbm(fp*1.7 - uTime*0.06)*0.9);
          // mostly cooled dark crust; thin glowing cracks, hottest near the heart, pulsing with its beat
          float vein = smoothstep(0.012, 0.0, abs(f-0.56)) + 0.45*smoothstep(0.008, 0.0, abs(f-0.47));
          float hot = smoothstep(8.5, 2.2, r);
          float beat = 0.7 + 0.75*uBeat;
          vec3 crust = vec3(0.05,0.01,0.005)*(0.55 + 0.9*smoothstep(0.35,0.75,f));
          vec3 lava = crust + vec3(1.0,0.26,0.035)*vein*(0.16 + 1.25*hot)*beat
                    + vec3(0.8,0.12,0.015)*smoothstep(0.72,0.86,f)*0.22*hot*beat
                    + vec3(0.35,0.05,0.0)*exp(-r*r/10.0)*beat*0.35;
          col = mix(col, col*0.4 + lava, palM*smoothstep(uArenaR+6.0, uArenaR-1.0, r));
        }
        float front = exp(-pow((pd-uPalRadius)*1.1,2.0))*step(0.01,uPalRadius)*(1.0-smoothstep(22.0,30.0,uPalRadius));
        col += vec3(1.0,0.5,0.15)*front*1.4;
        col += vec3(0.55,0.6,0.8)*hexLine*0.035;
      } else if (uArena < 1.5) {
        // ---------------- ORCHARD: the violet void far beneath the glass columns ----------------
        float n = fbm(p*0.09 + vec2(uTime*0.012, -uTime*0.017));
        float n2 = noise2(p*0.35 - uTime*0.05);
        col = vec3(0.01,0.005,0.024) + uTint2*0.07*pow(n,2.2) + uTint*0.025*n2;
        vec4 hx2 = hexCoords(p*0.25); float he2 = 0.5 - hexD(hx2.xy);
        col += uTint*smoothstep(0.03,0.0,he2)*0.07*smoothstep(0.35,0.75,n);
        col += vec3(0.75,0.6,1.0)*pow(noise2(p*1.3+uTime*0.18),18.0)*1.3;
      } else {
        // ---------------- EVENT HORIZON (accretion disk) ----------------
        float a2 = (uTime*0.15 + 3.0/(r+0.5))*uSwirl;
        float c=cos(a2), s=sin(a2); vec2 q = mat2(c,-s,s,c)*p;
        float f = fbm(q*vec2(0.42,0.42) + vec2(0.0, r*0.25));
        float f2 = fbm(q*1.1 - vec2(uTime*0.05, 0.0));
        float t = smoothstep(16.5, 2.6, r);
        vec3 ramp = mix(uRampA, uRampB, smoothstep(0.0, 0.8, t)); ramp = mix(ramp, uRampC, smoothstep(0.82, 1.0, t));
        float lanes = pow(f, 2.4);
        col = ramp*(lanes*(0.22 + 1.15*t) + f2*f2*0.1*t);
        col *= smoothstep(2.45, 3.15, r);
        col += mix(uRampB, uRampC, 0.65)*exp(-pow((r-2.9)*6.5,2.0))*1.25;
        // ignition front (intro): the disk lights outward from the horizon
        float ign = smoothstep(uIgnite, uIgnite-2.5, r);
        col = col*ign + uRampC*exp(-pow((r-uIgnite)*1.4,2.0))*1.6*step(uIgnite, 30.0)*step(2.6, r);
        for(int i=0;i<6;i++){ vec4 vd=uVoid[i]; if(vd.w<=0.0) continue; float dv=length(p-vd.xy); float rr=vd.z*vd.w;
          col = mix(col, vec3(0.0), smoothstep(rr, rr-0.25, dv));
          float sw = 0.6+0.4*sin(atan(p.y-vd.y, p.x-vd.x)*5.0 - uTime*6.0 + dv*4.0);
          col += mix(uRampB, uRampC, 0.4)*exp(-pow((dv-rr)*6.0,2.0))*2.0*vd.w + uRampB*exp(-pow((dv-rr-0.6)*2.5,2.0))*0.5*vd.w*sw; }
        col += vec3(0.6,0.65,0.9)*hexLine*0.02*t;
        // dawn reef (finale): calm iridescent mirror
        if (uDawn > 0.0) {
          vec3 Nd = normalize(vec3(sin(p.x*0.6+uTime*0.5)*0.025, 1.0, cos(p.y*0.55+uTime*0.45)*0.025));
          vec3 Rd = reflect(-V, Nd); float fd = 0.04 + 0.96*pow(1.0-max(dot(Nd,V),0.0), 5.0);
          vec3 skyd = mix(vec3(0.16,0.09,0.24), vec3(0.03,0.06,0.16), clamp(Rd.y*1.4, 0.0, 1.0));
          skyd += vec3(0.25,0.5,0.4)*pow(fbm(Rd.xz/(Rd.y+0.3)*0.9 + uTime*0.02), 3.0)*0.6;
          vec3 irid = palette(r*0.05 - uTime*0.05 + dot(cid, vec2(0.05,0.031)));
          vec3 dawn = skyd*(0.35 + fd*1.4) + irid*(0.035 + hexLine*0.32 + hexSoft*0.05) + irid*fd*0.18;
          col = mix(col, dawn, uDawn);
        }
        col *= 1.0 - uFloorDim;
      }
      // rainbow hex glyph waves
      for(int i=0;i<3;i++){ vec4 w=uWave[i]; if(w.w<=0.0) continue; float d=length(p-w.xy);
        float band = smoothstep(2.5,0.0,abs(d-w.z));
        vec3 pc = palette(dot(cid,vec2(0.13,0.071)) + uTime*0.2 + d*0.03);
        col += pc*(hexSoft*1.1 + hexLine*2.4 + 0.08)*band*w.w*3.0; }
      // arena boundary
      float edge = exp(-pow((r-uArenaR)*4.0,2.0)) + 0.45*exp(-pow((r-uArenaR-0.45)*9.0,2.0));
      float ticks = smoothstep(0.82, 1.0, sin(ang*36.0 + uTime*0.6))*exp(-pow((r-uArenaR+0.35)*6.0,2.0));
      col += vec3(0.72,0.78,1.0)*(edge*0.09 + ticks*0.16)*uEdgeGlow;
      // lantern pool + blob shadows
      vec2 dpp = p-uPlayerPos; float dp2 = dot(dpp,dpp);
      vec2 dbp = p-uBossPos; float db2 = dot(dbp,dbp);
      float sh = (1.0-0.6*exp(-dp2/0.32))*(1.0-0.55*uBossShadow*exp(-db2/3.2));
      col *= sh;
      col += uPlayerColor*uPlayerGlow*exp(-dp2/9.0)*(0.85+0.15*sin(uTime*3.0));
      // lattice field glow on floor
      if (uLatPos.z > 0.0) { float dl = length(p-uLatPos.xy); col += vec3(0.1,1.0,0.35)*0.12*smoothstep(4.8,0.0,dl)*uLatPos.z; }
      float alpha = smoothstep(24.0, 19.5, r);
      gl_FragColor = vec4(col, alpha);
    }`,
});
const floor = new THREE.Mesh(new THREE.CircleGeometry(24, 96).rotateX(-Math.PI / 2), floorMat);
floor.renderOrder = -10; floor.frustumCulled = false;
scene.add(floor);
let rippleIdx = 0;
function addRipple(x, z, strength) {
  const r = floorU.uRipples.value[rippleIdx]; r.set(x, z, floorU.uTime.value, strength); rippleIdx = (rippleIdx + 1) & 7;
}
const waves = [{ t: 0, x: 0, z: 0, speed: 18, life: 0, str: 0 }, { t: 0, x: 0, z: 0, speed: 18, life: 0, str: 0 }, { t: 0, x: 0, z: 0, speed: 18, life: 0, str: 0 }];
let waveIdx = 0;
function rainbowWave(x, z, strength = 1, speed = 18) {
  const w = waves[waveIdx]; waveIdx = (waveIdx + 1) % 3; w.t = 0; w.x = x; w.z = z; w.str = strength; w.speed = speed; w.life = 2.2;
}
function updateWaves(dt) {
  for (let i = 0; i < 3; i++) {
    const w = waves[i], u = floorU.uWave.value[i];
    if (w.life <= 0) { u.w = 0; continue; }
    w.t += dt; const k = w.t / w.life; if (k >= 1) { w.life = 0; u.w = 0; continue; }
    u.set(w.x, w.z, w.t * w.speed, w.str * (1 - k) * (1 - k));
  }
}

// ---- starfield ----
const STAR_MAX = 3000;
const starGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(STAR_MAX * 3), seed = new Float32Array(STAR_MAX);
  for (let i = 0; i < STAR_MAX; i++) {
    const u = frand() * 2 - 1, th = frand() * TAU, s = Math.sqrt(1 - u * u), rr = 120 + frand() * 80;
    pos[i * 3] = s * Math.cos(th) * rr; pos[i * 3 + 1] = u * rr; pos[i * 3 + 2] = s * Math.sin(th) * rr; seed[i] = frand();
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
}
const starU = { uTime: { value: 0 }, uStreak: { value: 0 }, uPx: { value: 1 }, uBright: { value: 1 }, uSpin: { value: 0 }, uColorful: { value: 0 } };
const stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({
  uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    attribute float aSeed; uniform float uTime,uStreak,uPx,uBright,uSpin,uColorful; varying vec3 vC; varying float vS;
    void main(){
      vec3 p = position; float a = uSpin*(1.0+ (1.0-smoothstep(0.0,1.0,abs(p.y)/200.0))*2.0);
      float c=cos(a), s=sin(a); p.xz = mat2(c,-s,s,c)*p.xz;
      vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
      float tw = 0.55+0.45*sin(uTime*(0.7+aSeed*3.0)+aSeed*40.0);
      float sz = (1.0+aSeed*aSeed*aSeed*3.5)*uPx;
      vS = uStreak; gl_PointSize = sz*(1.0+uStreak*14.0);
      vec3 warm = vec3(1.0,0.78,0.6), cool = vec3(0.65,0.78,1.0);
      vec3 base = mix(cool, warm, fract(aSeed*7.31));
      vec3 rainbow = 0.5+0.5*cos(6.28318*(aSeed*3.0+vec3(0.0,0.33,0.67)));
      vC = mix(base, rainbow*1.4, uColorful)*tw*uBright*(0.6+aSeed*1.2);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vC; varying float vS;
    void main(){ vec2 c = gl_PointCoord-0.5; c.x *= 1.0+vS*14.0; float a = exp(-dot(c,c)*18.0); gl_FragColor = vec4(vC*a, 1.0); }`,
}));
stars.frustumCulled = false; stars.renderOrder = -20;
scene.add(stars);

// ---- nebula dome ----
const nebU = { uTime: { value: 0 }, uA: { value: new THREE.Color(0.35, 0.12, 0.5) }, uB: { value: new THREE.Color(0.1, 0.25, 0.6) }, uOp: { value: 0.25 } };
const nebula = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
  uniforms: nebU, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, defines: fbmDefines(),
  vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: GLSL_LIB + /* glsl */`
    uniform float uTime,uOp; uniform vec3 uA,uB; varying vec3 vD;
    void main(){ vec3 d = normalize(vD); vec2 uv = d.xz/(abs(d.y)+0.65)*1.6;
      float f = fbm(uv + vec2(uTime*0.004, 0.0)); float g = fbm(uv*2.3 - 3.1 + f);
      float band = exp(-d.y*d.y*3.0);
      vec3 c = mix(uA, uB, g)*pow(f,2.2)*2.4*(0.35+band);
      c += vec3(1.0,0.9,0.95)*pow(g,8.0)*0.6;
      gl_FragColor = vec4(c*uOp, 1.0); }`,
}));
nebula.renderOrder = -30; nebula.frustumCulled = false;
scene.add(nebula);

/* =====================================================================
   6  FX — particles (GPU-analytic ring buffer), rings, beams, shards, damage numbers, ghosts
   ===================================================================== */
const PCAP = 4000;
const fx = { simTime: 0, head: 0, dMin: -1, dMax: -1, full: false };
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PCAP * 3), pVel = new Float32Array(PCAP * 4), pCol = new Float32Array(PCAP * 4), pT0 = new Float32Array(PCAP).fill(-1e4);
const pPosA = new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage);
const pVelA = new THREE.BufferAttribute(pVel, 4).setUsage(THREE.DynamicDrawUsage);
const pColA = new THREE.BufferAttribute(pCol, 4).setUsage(THREE.DynamicDrawUsage);
const pT0A = new THREE.BufferAttribute(pT0, 1).setUsage(THREE.DynamicDrawUsage);
pGeo.setAttribute('position', pPosA); pGeo.setAttribute('aVel', pVelA); pGeo.setAttribute('aCol', pColA); pGeo.setAttribute('aT0', pT0A);
const partU = { uTime: { value: 0 }, uProj: { value: 500 }, uAttract: { value: new THREE.Vector3() } };
const particles = new THREE.Points(pGeo, new THREE.ShaderMaterial({
  uniforms: partU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    attribute vec4 aVel; attribute vec4 aCol; attribute float aT0;
    uniform float uTime, uProj; uniform vec3 uAttract; varying vec3 vC; varying float vA;
    void main(){
      float age = uTime - aT0; float life = aVel.w;
      if (age < 0.0 || age > life) { gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; vC=vec3(0.0); vA=0.0; return; }
      float mode = floor(aCol.w/100.0); float size = mod(aCol.w, 100.0);
      float k = 2.2; float dr = (1.0-exp(-k*age))/k; vec3 p;
      if (mode < 0.5) { p = position + aVel.xyz*dr + vec3(0.0,-2.0,0.0)*age*age; }
      else if (mode < 1.5) { vec3 b = position + aVel.xyz*dr*0.7; float u = age/life; u = u*u*(3.0-2.0*u); p = mix(b, uAttract + vec3(0.0,1.0,0.0), u*u); }
      else if (mode < 2.5) { float ang = aVel.x + aVel.y*age; float rad = aVel.z*(1.0+age*0.1); p = position + vec3(cos(ang)*rad, age*0.9, sin(ang)*rad); }
      else if (mode < 3.5) { p = position + aVel.xyz*dr + vec3(sin(age*2.0+aT0*13.0)*0.3, 0.35*age*age, cos(age*1.7+aT0*7.0)*0.3); }
      else { p = position + aVel.xyz*age; }
      vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
      float f = 1.0-age/life;
      gl_PointSize = clamp(size*uProj/max(-mv.z,0.1)*sqrt(f), 0.0, 96.0);
      vC = aCol.rgb; vA = f*min(1.0, age*30.0+0.3);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vC; varying float vA;
    void main(){ vec2 c = gl_PointCoord*2.0-1.0; float r2 = dot(c,c); if (r2>1.0) discard;
      float a = exp(-r2*5.0)*0.8 + 0.35*exp(-r2*28.0); gl_FragColor = vec4(vC*a*vA, 1.0); }`,
}));
particles.frustumCulled = false; particles.renderOrder = 20;
scene.add(particles);

function emitP(x, y, z, vx, vy, vz, r, g, b, life, size, mode) {
  const i = fx.head; fx.head++; if (fx.head >= Q.cfg.particles) fx.head = 0;
  const i3 = i * 3, i4 = i * 4;
  pPos[i3] = x; pPos[i3 + 1] = y; pPos[i3 + 2] = z;
  pVel[i4] = vx; pVel[i4 + 1] = vy; pVel[i4 + 2] = vz; pVel[i4 + 3] = life;
  pCol[i4] = r; pCol[i4 + 1] = g; pCol[i4 + 2] = b; pCol[i4 + 3] = Math.min(size, 99.9) + (mode | 0) * 100;
  pT0[i] = fx.simTime;
  if (fx.dMin < 0) { fx.dMin = fx.dMax = i; } else { if (i < fx.dMin) fx.full = true; if (i > fx.dMax) fx.dMax = i; }
}
function flushParticles() {
  if (fx.dMin < 0 && !fx.full) return;
  const attrs = [pPosA, pVelA, pColA, pT0A];
  for (let k = 0; k < 4; k++) {
    const a = attrs[k]; a.clearUpdateRanges();
    if (!fx.full) a.addUpdateRange(fx.dMin * a.itemSize, (fx.dMax - fx.dMin + 1) * a.itemSize);
    a.needsUpdate = true;
  }
  fx.dMin = -1; fx.dMax = -1; fx.full = false;
}
// emitter API (numbers only, no allocation)
function burst(x, y, z, count, r, g, b, speed, life, size, spread = 1, mode = 0, up = 0.3) {
  count = Math.round(count * (Q.cfg.low ? 0.5 : Q.name === 'med' ? 0.75 : 1) * (settings.reduceFx ? 0.6 : 1));
  for (let i = 0; i < count; i++) {
    const u = frand() * 2 - 1, th = frand() * TAU, s = Math.sqrt(1 - u * u), sp = speed * (0.35 + frand() * 0.65);
    const vy = (u * spread + up) * sp;
    const j = 0.7 + frand() * 0.6;
    emitP(x, y, z, s * Math.cos(th) * sp, vy, s * Math.sin(th) * sp, r * j, g * j, b * j, life * (0.5 + frand() * 0.5), size * (0.6 + frand() * 0.6), mode);
  }
}
function burstRainbow(x, y, z, count, speed, life, size, mode = 0) {
  count = Math.round(count * (Q.cfg.low ? 0.5 : 1));
  for (let i = 0; i < count; i++) {
    const u = frand() * 2 - 1, th = frand() * TAU, s = Math.sqrt(1 - u * u), sp = speed * (0.4 + frand() * 0.6);
    const h = frand(); _col.setHSL(h, 1, 0.6);
    emitP(x, y, z, s * Math.cos(th) * sp, (u * 0.6 + 0.4) * sp, s * Math.sin(th) * sp, _col.r * 2, _col.g * 2, _col.b * 2, life * (0.5 + frand() * 0.5), size * (0.6 + frand() * 0.7), mode);
  }
}
function streakToPlayer(x, y, z, c, n) {
  const col = PCOL[c];
  for (let i = 0; i < n; i++) emitP(x, y, z, (frand() - 0.5) * 4, frand() * 3, (frand() - 0.5) * 4, col[0] * 2.5, col[1] * 2.5, col[2] * 2.5, 0.45 + frand() * 0.2, 0.14, 1);
}
function ringBurst(x, y, z, count, r, g, b, speed, life, size) { // flat radial burst
  for (let i = 0; i < count; i++) { const a = i / count * TAU + frand() * 0.2; const sp = speed * (0.7 + frand() * 0.3); emitP(x, y, z, Math.cos(a) * sp, frand() * 0.5, Math.sin(a) * sp, r, g, b, life, size, 4); }
}

// ---- Rings pool (flat shockwaves) ----
const RING_N = 24;
const ringGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
const ringMatBase = new THREE.ShaderMaterial({
  uniforms: { uR: { value: 1 }, uTh: { value: 0.2 }, uOuter: { value: 1.2 }, uCol: { value: new THREE.Color() }, uA: { value: 1 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform float uR,uTh,uOuter,uA; uniform vec3 uCol; varying vec2 vUv;
    void main(){ float d = length(vUv*2.0-1.0)*uOuter; float k=(d-uR)/uTh; float a = exp(-k*k*2.5) + 0.25*exp(-k*k*0.3)*step(d,uR);
      gl_FragColor = vec4(uCol*a*uA, 1.0); }`,
});
const rings = [];
for (let i = 0; i < RING_N; i++) {
  const m = new THREE.Mesh(ringGeo, ringMatBase.clone()); m.visible = false; m.renderOrder = 15; m.frustumCulled = false; scene.add(m);
  rings.push({ m, u: m.material.uniforms, life: 0, t: 0, r0: 0, r1: 1, th: 0.2, inten: 1 });
}
let ringIdx = 0;
function ring(x, y, z, r0, r1, life, th, r, g, b, inten = 1) {
  const o = rings[ringIdx]; ringIdx = (ringIdx + 1) % RING_N;
  o.m.position.set(x, y, z); o.life = life; o.t = 0; o.r0 = r0; o.r1 = r1; o.th = th; o.inten = inten;
  o.u.uCol.value.setRGB(r, g, b); o.m.visible = true; return o;
}
function updateRings(dt) {
  for (let i = 0; i < RING_N; i++) {
    const o = rings[i]; if (!o.m.visible) continue;
    o.t += dt; const k = o.t / o.life; if (k >= 1) { o.m.visible = false; continue; }
    const rr = lerp(o.r0, o.r1, easeOut(k)); const outer = rr + o.th * 3;
    o.u.uR.value = rr; o.u.uTh.value = o.th; o.u.uOuter.value = outer; o.u.uA.value = o.inten * Math.pow(1 - k, 1.4);
    o.m.scale.setScalar(outer);
  }
}

// ---- Beams pool ----
const BEAM_N = 16;
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const beamMatBase = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color() }, uA: { value: 1 }, uLen: { value: 10 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: GLSL_LIB + `uniform float uTime,uA,uLen; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ float f = abs(dot(normalize(vN), normalize(vV)));
      float core = pow(f, 7.0), body = pow(f, 1.7);
      float n = noise2(vec2(vUv.x*6.0, vUv.y*uLen*0.8 - uTime*22.0));
      float n2 = noise2(vec2(vUv.x*3.0+5.0, vUv.y*uLen*0.3 - uTime*8.0));
      float cap0 = min(0.45, 0.5/max(uLen,0.01)), cap1 = min(0.45, 1.0/max(uLen,0.01));
      float tip = smoothstep(0.0, cap0, vUv.y)*smoothstep(1.0, 1.0-cap1, vUv.y);
      vec3 c = uCol*body*(0.4+0.6*n)*(0.65+0.55*n2)*1.25 + vec3(1.15,1.1,1.05)*core*(0.7+0.3*n);
      gl_FragColor = vec4(c*uA*tip, 1.0); }`,
});
const beams = [];
for (let i = 0; i < BEAM_N; i++) {
  const m = new THREE.Mesh(beamGeo, beamMatBase.clone()); m.visible = false; m.renderOrder = 16; m.frustumCulled = false; scene.add(m);
  beams.push({ m, u: m.material.uniforms, life: 0, t: 0, w: 0.5, mode: 0, inten: 1 });
}
let beamIdx = 0;
function beamSet(o, x0, y0, z0, x1, y1, z1, w) {
  o.m.position.set(x0, y0, z0); _v1.set(x1, y1, z1); o.m.lookAt(_v1);
  const len = Math.max(0.01, Math.hypot(x1 - x0, y1 - y0, z1 - z0)); o.len = len; o.w = w;
  o.m.scale.set(w, w, len); o.u.uLen.value = len;
}
// mode 0: pulse-out (lance), 1: steady with fade-in/out (boss beams)
function beam(x0, y0, z0, x1, y1, z1, w, life, r, g, b, mode = 0, inten = 1) {
  const o = beams[beamIdx]; beamIdx = (beamIdx + 1) % BEAM_N;
  beamSet(o, x0, y0, z0, x1, y1, z1, w); o.baseW = w; o.life = life; o.t = 0; o.mode = mode; o.inten = inten;
  o.u.uCol.value.setRGB(r, g, b); o.m.visible = true; return o;
}
function updateBeams(dt) {
  for (let i = 0; i < BEAM_N; i++) {
    const o = beams[i]; if (!o.m.visible) continue;
    o.t += dt; const k = o.t / o.life; if (k >= 1) { o.m.visible = false; continue; }
    o.u.uTime.value = fx.simTime;
    if (o.mode === 0) { const s = o.baseW * lerp(1.4, 0, easeOut(k)); o.m.scale.x = o.m.scale.y = Math.max(0.001, s); o.u.uA.value = o.inten * (1 - k * 0.5); }
    else { const a = smooth(o.t / 0.08) * smooth((o.life - o.t) / 0.12); o.u.uA.value = o.inten * a; const s = o.baseW * (0.85 + 0.15 * Math.sin(o.t * 50)); o.m.scale.x = o.m.scale.y = s; }
  }
}
function killBeam(o) { if (o) o.m.visible = false; }

// ---- Shards (InstancedMesh, CPU sim) ----
const SHARD_N = 220;
const shardMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vC; varying vec3 vV; void main(){ vC = instanceColor; vec4 mv = modelViewMatrix*instanceMatrix*vec4(position,1.0); vV = mv.xyz; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying vec3 vV; void main(){ vec3 n = normalize(cross(dFdx(vV), dFdy(vV))); float l = 0.3+0.7*max(dot(n, normalize(vec3(0.3,0.8,0.5))),0.0);
    float fr = pow(1.0-abs(dot(n, normalize(-vV))),2.0); gl_FragColor = vec4(vC*(l*0.55+0.25) + vC*fr*0.9 + vec3(fr*0.25), 1.0); }`,
});
const shardMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.35), shardMat, SHARD_N);
shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); shardMesh.frustumCulled = false; shardMesh.renderOrder = 12;
for (let i = 0; i < SHARD_N; i++) { shardMesh.setColorAt(i, _col.setRGB(1, 1, 1)); _m4.makeScale(0, 0, 0); shardMesh.setMatrixAt(i, _m4); }
scene.add(shardMesh);
const SH = {
  x: new Float32Array(SHARD_N), y: new Float32Array(SHARD_N), z: new Float32Array(SHARD_N), vx: new Float32Array(SHARD_N), vy: new Float32Array(SHARD_N), vz: new Float32Array(SHARD_N),
  rx: new Float32Array(SHARD_N), ry: new Float32Array(SHARD_N), sx: new Float32Array(SHARD_N), sy: new Float32Array(SHARD_N), sc: new Float32Array(SHARD_N),
  life: new Float32Array(SHARD_N), t: new Float32Array(SHARD_N), mode: new Uint8Array(SHARD_N), grav: new Float32Array(SHARD_N),
  ox: new Float32Array(SHARD_N), oy: new Float32Array(SHARD_N), oz: new Float32Array(SHARD_N), tx: new Float32Array(SHARD_N), ty: new Float32Array(SHARD_N), tz: new Float32Array(SHARD_N),
  head: 0, colorDirty: false,
};
// colorMode: -1 rainbow, else rgb
function shatter(cx, cy, cz, radius, count, r, g, b, speed = 8, life = 2.0, grav = 9, rainbow = false) {
  for (let n = 0; n < count; n++) {
    const i = SH.head; SH.head = (SH.head + 1) % SHARD_N;
    const u = frand() * 2 - 1, th = frand() * TAU, s = Math.sqrt(1 - u * u);
    const dx = s * Math.cos(th), dy = u, dz = s * Math.sin(th);
    SH.x[i] = cx + dx * radius; SH.y[i] = cy + dy * radius; SH.z[i] = cz + dz * radius;
    const sp = speed * (0.4 + frand() * 0.8);
    SH.vx[i] = dx * sp; SH.vy[i] = dy * sp * 0.7 + speed * 0.35 * frand(); SH.vz[i] = dz * sp;
    SH.rx[i] = frand() * TAU; SH.ry[i] = frand() * TAU; SH.sx[i] = (frand() - 0.5) * 14; SH.sy[i] = (frand() - 0.5) * 14;
    SH.sc[i] = 0.35 + frand() * 0.6; SH.life[i] = life * (0.6 + frand() * 0.6); SH.t[i] = 0; SH.mode[i] = 1; SH.grav[i] = grav;
    if (rainbow) _col.setHSL(frand(), 1, 0.6).multiplyScalar(2.2); else _col.setRGB(r, g, b).multiplyScalar(0.8 + frand() * 0.5);
    shardMesh.setColorAt(i, _col);
  }
  SH.colorDirty = true;
}
function reform(tx, ty, tz, count, dur, r, g, b, fromR = 7) {
  for (let n = 0; n < count; n++) {
    const i = SH.head; SH.head = (SH.head + 1) % SHARD_N;
    const u = frand() * 2 - 1, th = frand() * TAU, s = Math.sqrt(1 - u * u), rr = fromR * (0.5 + frand() * 0.6);
    SH.ox[i] = tx + s * Math.cos(th) * rr; SH.oy[i] = ty + Math.abs(u) * rr * 0.8 + 0.5; SH.oz[i] = tz + s * Math.sin(th) * rr;
    SH.tx[i] = tx + (frand() - 0.5) * 0.5; SH.ty[i] = ty + (frand() - 0.5) * 0.6; SH.tz[i] = tz + (frand() - 0.5) * 0.5;
    SH.rx[i] = frand() * TAU; SH.ry[i] = frand() * TAU; SH.sx[i] = (frand() - 0.5) * 10; SH.sy[i] = (frand() - 0.5) * 10;
    SH.sc[i] = 0.5 + frand() * 0.8; SH.life[i] = dur * (0.75 + frand() * 0.25); SH.t[i] = 0; SH.mode[i] = 2;
    _col.setRGB(r, g, b).multiplyScalar(0.8 + frand() * 0.6); shardMesh.setColorAt(i, _col);
  }
  SH.colorDirty = true;
}
function updateShards(dt) {
  const arr = shardMesh.instanceMatrix.array;
  for (let i = 0; i < SHARD_N; i++) {
    const m = SH.mode[i]; const o = i * 16;
    if (m === 0) { if (arr[o] !== 0 || arr[o + 5] !== 0) { for (let k = 0; k < 16; k++) arr[o + k] = 0; } continue; }
    SH.t[i] += dt; const k = SH.t[i] / SH.life[i];
    if (k >= 1) { SH.mode[i] = 0; for (let q = 0; q < 16; q++) arr[o + q] = 0; continue; }
    let sc = SH.sc[i];
    if (m === 1) {
      SH.vy[i] -= SH.grav[i] * dt; const dr = Math.exp(-0.9 * dt); SH.vx[i] *= dr; SH.vz[i] *= dr;
      SH.x[i] += SH.vx[i] * dt; SH.y[i] += SH.vy[i] * dt; SH.z[i] += SH.vz[i] * dt;
      if (SH.y[i] < 0.1 && SH.grav[i] > 0) { SH.y[i] = 0.1; SH.vy[i] *= -0.35; SH.vx[i] *= 0.6; SH.vz[i] *= 0.6; SH.sx[i] *= 0.6; SH.sy[i] *= 0.6; }
      sc *= k > 0.7 ? (1 - k) / 0.3 : 1;
    } else {
      const e = easeIn(k);
      SH.x[i] = lerp(SH.ox[i], SH.tx[i], e); SH.y[i] = lerp(SH.oy[i], SH.ty[i], e); SH.z[i] = lerp(SH.oz[i], SH.tz[i], e);
      sc *= k > 0.85 ? (1 - k) / 0.15 : Math.min(1, k * 5);
    }
    SH.rx[i] += SH.sx[i] * dt; SH.ry[i] += SH.sy[i] * dt;
    _e.set(SH.rx[i], SH.ry[i], 0); _q.setFromEuler(_e); _v1.set(SH.x[i], SH.y[i], SH.z[i]); _s.set(sc, sc * 1.6, sc);
    _m4.compose(_v1, _q, _s); _m4.toArray(arr, o);
  }
  shardMesh.instanceMatrix.needsUpdate = true;
  if (SH.colorDirty) { shardMesh.instanceColor.needsUpdate = true; SH.colorDirty = false; }
}

// ---- Damage numbers (sprite pool) ----
// Sized in screen pixels (not world units), heavy sans with a dark outline + glow, kept below the top HUD.
const DN_N = 40;
const DN_FONT = 'px system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
let hudTopPx = 96;                     // bottom edge of the top HUD band (measured by the UI)
const dmgNums = [];
function dnMake() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sp = new THREE.Sprite(mat); sp.visible = false; sp.renderOrder = 999; sp.scale.set(1.6, 0.6, 1); scene.add(sp);
  return { sp, cv, ctx: cv.getContext('2d'), tex, mat, t: 0, life: 0.8, x: 0, y: 0, z: 0, size: 1 };
}
for (let i = 0; i < DN_N; i++) dmgNums.push(dnMake());
let dnIdx = 0;
function dnDraw(d, text, kind, color) {
  const c = d.ctx; c.clearRect(0, 0, 256, 96);
  const big = kind === 1 ? 62 : kind === 5 ? 46 : kind === 4 ? 40 : 54;
  c.font = (kind === 4 || kind === 5 ? 'italic 700 ' : '800 ') + big + DN_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
  let fill = '#ffffff', glow = 'rgba(255,255,255,0.55)';
  if (kind === 1) { const gr = c.createLinearGradient(0, 22, 0, 78); gr.addColorStop(0, '#fff8d6'); gr.addColorStop(1, '#ffae22'); fill = gr; glow = 'rgba(255,170,40,0.9)'; }
  else if (kind === 2) { fill = '#ff5a6e'; glow = 'rgba(255,40,70,0.8)'; } else if (kind === 3) { fill = '#6bffa0'; glow = 'rgba(60,255,140,0.7)'; }
  else if (kind === 5) { const gr = c.createLinearGradient(30, 0, 226, 0); gr.addColorStop(0, '#ff8aa8'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#8ad8ff'); fill = gr; glow = 'rgba(200,220,255,0.8)'; }
  if (color) { fill = color; glow = color; }
  c.lineJoin = 'round';
  c.shadowColor = glow; c.shadowBlur = 14; c.lineWidth = 9; c.strokeStyle = 'rgba(6,4,12,0.92)'; c.strokeText(text, 128, 50);
  c.shadowBlur = 0; c.fillStyle = fill; c.fillText(text, 128, 50);
  d.tex.needsUpdate = true;
}
// kind: 0 normal, 1 crit, 2 player hurt, 3 heal, 4 text white, 5 perfect
function dmgNumber(x, y, z, text, kind = 0, color) {
  const d = dmgNums[dnIdx]; dnIdx = (dnIdx + 1) % DN_N;
  dnDraw(d, text, kind, color);
  d.x = x + (frand() - 0.5) * 0.6; d.y = y; d.z = z + (frand() - 0.5) * 0.4; d.t = 0; d.life = kind === 1 ? 1.0 : 0.85;
  d.size = kind === 1 ? 1.45 : kind === 5 ? 1.15 : kind === 4 ? 1.0 : kind === 2 ? 1.05 : 0.95; d.sp.visible = true;
}
// rolling per-boss total: every non-crit hit ticks one number up instead of spawning new sprites
const dnRoll = Object.assign(dnMake(), { val: 0, shown: -1, idle: 0, pop: 0, redraw: 0, ox: 1.3 });
function dmgRollAdd(n, refl) {
  const d = dnRoll;
  if (!d.sp.visible) { d.val = 0; d.shown = -1; d.t = 0; d.ox = frand() < 0.5 ? -1.4 : 1.4; d.sp.visible = true; }
  d.val += n; d.idle = 0; d.pop = Math.min(1, d.pop + (n > 40 ? 1 : 0.45)); d.refl = !!refl;
}
function dmgNumsClear() { for (let i = 0; i < DN_N; i++) dmgNums[i].sp.visible = false; dnRoll.sp.visible = false; dnRoll.val = 0; }
function dnPlace(sp, x, y, z, sizePx) {
  // keep it below the HUD band, size it in screen pixels
  _v1.set(x, y, z).project(camera);
  const lim = 1 - 2 * (hudTopPx + 14 + sizePx * 0.35) / VH;
  if (_v1.y > lim && _v1.z < 1) { _v1.y = lim; _v1.unproject(camera); sp.position.copy(_v1); } else sp.position.set(x, y, z);
  const dist = Math.max(0.5, sp.position.distanceTo(camera.position));
  const worldPerPx = 2 * dist * Math.tan(camera.fov * Math.PI / 360) / VH;
  const h = sizePx * worldPerPx; sp.scale.set(h * 256 / 96, h, 1);
}
function updateDmgNums(dt) {
  const short = Math.min(VW, VH), basePx = clamp(short * 0.075, 34, 54);
  for (let i = 0; i < DN_N; i++) {
    const d = dmgNums[i]; if (!d.sp.visible) continue;
    d.t += dt; const k = d.t / d.life; if (k >= 1) { d.sp.visible = false; continue; }
    const pop = k < 0.12 ? lerp(1.3, 1.0, k / 0.12) : 1;
    dnPlace(d.sp, d.x, d.y + easeOut(k) * 1.0, d.z, basePx * d.size * pop);
    d.mat.opacity = k > 0.6 ? (1 - k) / 0.4 : 1;
  }
  const r = dnRoll;
  if (r.sp.visible) {
    r.idle += dt; r.t += dt; r.redraw -= dt; r.pop = Math.max(0, r.pop - dt * 5);
    const v = Math.round(r.val);
    if (v !== r.shown && r.redraw <= 0) { r.shown = v; r.redraw = 0.05; dnDraw(r, String(v), 0, r.refl ? '#bcd6ff' : null); }
    const fade = r.idle > 0.75 ? 1 - (r.idle - 0.75) / 0.3 : 1;
    if (fade <= 0) { r.sp.visible = false; r.val = 0; }
    else {
      dnPlace(r.sp, bossTarget.x + r.ox, bossTarget.y + 1.3 + Math.min(0.6, r.t * 0.25), bossTarget.z + 0.8, basePx * (1.05 + 0.25 * r.pop) * (v >= 1000 ? 1.1 : 1));
      r.mat.opacity = fade;
    }
  }
}

/* =====================================================================
   7  TELEGRAPHS (decal pool)
   ===================================================================== */
const TELE_N = 40;
const teleGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const teleHC = { value: 0 };   // shared: 1 = high-contrast telegraphs (white rim, dark fill) on red/gold floors
const teleMatBase = new THREE.ShaderMaterial({
  uniforms: { uHC: teleHC, uShape: { value: 0 }, uFill: { value: 0 }, uColor: { value: new THREE.Color(1, 0.18, 0.25) }, uTint: { value: new THREE.Color(1, 0.2, 0.3) },
    uInner: { value: 0 }, uAngle: { value: 0.5 }, uTime: { value: 0 }, uAlpha: { value: 1 }, uSize: { value: new THREE.Vector2(1, 1) }, uFlash: { value: 0 } },
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform float uShape,uFill,uInner,uAngle,uTime,uAlpha,uFlash,uHC; uniform vec3 uColor,uTint; uniform vec2 uSize; varying vec2 vUv;
    void main(){
      vec2 p = (vUv-0.5)*uSize; // world units, local; +y = forward
      p.y = -p.y;
      float inside = 0.0, edge = 1e3, e = 0.0, d = length(p);
      float R = uSize.x*0.5;
      if (uShape < 0.5 || uShape > 3.5) { inside = step(d, R); edge = R-d; e = 1.0-d/R; }
      else if (uShape < 1.5) { float ri = R*uInner; inside = step(d,R)*step(ri,d); edge = min(R-d, d-ri); e = (R-d)/max(R-ri,0.01); }
      else if (uShape < 2.5) { float a = abs(atan(p.x, p.y)); inside = step(d,R)*step(a,uAngle); edge = min(R-d, sin(max(uAngle-a,0.0))*d); e = d/R; }
      else { vec2 hs = uSize*0.5; inside = step(abs(p.x),hs.x)*step(abs(p.y),hs.y); edge = min(hs.x-abs(p.x), hs.y-abs(p.y)); e = (hs.x-abs(p.x))/hs.x; }
      if (inside < 0.5) discard;
      vec3 col = uColor;
      float pulseF = mix(1.5, 8.0, uFill*uFill);
      float pulse = 0.72+0.28*sin(uTime*pulseF*6.283);
      float line = smoothstep(0.2, 0.06, edge); float halo = smoothstep(0.6, 0.0, edge);
      float filled = step(e, uFill);
      float a; vec3 c;
      if (uShape > 4.5) { // safe zone (cyan), soft pulsing
        float ring = smoothstep(0.14,0.03,edge); float wav = 0.5+0.5*sin(d*5.0-uTime*5.0);
        c = col*(ring*2.4 + 0.25 + wav*0.12); a = (ring*0.95 + 0.18 + wav*0.06);
      } else if (uShape > 3.5) { // soak tower: dashed white outline
        float ang = atan(p.y,p.x); float dash = step(0.0, sin(ang*14.0 + uTime*2.0));
        float ring = smoothstep(0.16,0.04,edge)*dash;
        c = vec3(1.0)*ring*2.6 + col*(0.18 + filled*0.35); a = ring + 0.14 + filled*0.3;
      } else {
        vec3 inner = mix(col, uTint, smoothstep(0.0, 1.0, uShape>1.5&&uShape<2.5 ? 1.0-e : e)*0.75);
        float leading = filled*smoothstep(0.12, 0.0, abs(e - uFill))*step(uFill,0.99);
        float stripes = step(0.55, fract((p.x - p.y)*0.8 + uTime*0.6));
        vec3 lineC = mix(col, vec3(1.0,0.96,0.92), uHC*0.75);
        inner = mix(inner, vec3(0.03,0.0,0.01), uHC*0.75);
        c = lineC*line*2.6*pulse + lineC*halo*0.35*pulse + inner*(0.12 + filled*0.35 + stripes*0.08*(1.0-filled)) + vec3(1.0,0.85,0.8)*leading*0.7;
        a = line*0.95 + halo*0.2 + 0.12 + filled*(0.33 + uHC*0.12) + leading*0.3 + stripes*0.04*(1.0-filled);
      }
      c = mix(c, vec3(2.4), uFlash); a = mix(a, 0.9, uFlash);
      gl_FragColor = vec4(c, a*uAlpha);
    }`,
});
const tele = [];
for (let i = 0; i < TELE_N; i++) {
  const m = new THREE.Mesh(teleGeo, teleMatBase.clone()); m.visible = false; m.renderOrder = 5; m.frustumCulled = false; m.position.y = 0.03; scene.add(m);
  tele.push({ m, u: m.material.uniforms, active: false, shape: 0, t: 0, windup: 1, x: 0, z: 0, x1: 0, z1: 0, r: 1, rIn: 0, ang: 0, half: 0, len: 0, w: 0,
    dmg: 0, col: 0, follow: null, lockAt: 0.6, locked: false, resolved: false, post: 0, onResolve: null, tellPlayed: false, grazed: false, noHit: false, dur: 0, tag: 0, hidden: false, holdAfter: 0 });
}
const TCOL_DMG = [1.0, 0.18, 0.25], TCOL_SAFE = [0.2, 1.0, 0.95];
function teleAlloc() {
  for (let i = 0; i < TELE_N; i++) if (!tele[i].active) return tele[i];
  let o = tele[0]; for (let i = 1; i < TELE_N; i++) if (tele[i].t > o.t) o = tele[i]; return o; // reuse oldest
}
function teleBase(shape, windup, dmg, col, opts) {
  const o = teleAlloc(); o.active = true; o.shape = shape; o.t = 0; o.windup = windup; o.dmg = dmg; o.col = col;
  o.follow = opts && opts.follow || null; o.lockAt = opts && opts.lockAt != null ? opts.lockAt : 0.6; o.locked = false; o.resolved = false; o.post = 0;
  o.onResolve = opts && opts.onResolve || null; o.onLock = opts && opts.onLock || null; o.tellPlayed = false; o.grazed = false; o.noHit = !!(opts && opts.noHit); o.dur = opts && opts.dur || 0;
  o.tag = opts && opts.tag || 0; o.holdAfter = 0;
  const u = o.u; u.uShape.value = shape; u.uFill.value = 0; u.uAlpha.value = 0; u.uFlash.value = 0;
  const c = shape === 5 ? TCOL_SAFE : shape === 4 ? [1, 1, 1] : TCOL_DMG; u.uColor.value.setRGB(c[0], c[1], c[2]);
  const tc = col >= 0 && col < 4 ? PCOL[col] : c; u.uTint.value.setRGB(tc[0], tc[1], tc[2]);
  o.m.rotation.set(0, 0, 0); o.m.visible = true;
  return o;
}
function teleCircle(x, z, r, windup, dmg, col, opts) { const o = teleBase(0, windup, dmg, col, opts); o.x = x; o.z = z; o.r = r; o.m.position.set(x, 0.03, z); o.m.scale.set(r * 2, 1, r * 2); o.u.uSize.value.set(r * 2, r * 2); return o; }
function teleRing(x, z, rIn, rOut, windup, dmg, col, opts) { const o = teleBase(1, windup, dmg, col, opts); o.x = x; o.z = z; o.r = rOut; o.rIn = rIn; o.u.uInner.value = rIn / rOut; o.m.position.set(x, 0.03, z); o.m.scale.set(rOut * 2, 1, rOut * 2); o.u.uSize.value.set(rOut * 2, rOut * 2); return o; }
function teleSetCone(o, x, z, ang, half, len) { o.x = x; o.z = z; o.ang = ang; o.half = half; o.len = len; o.m.position.set(x, 0.03, z); o.m.scale.set(len * 2, 1, len * 2); o.m.rotation.y = -ang + Math.PI / 2; o.u.uSize.value.set(len * 2, len * 2); o.u.uAngle.value = half; }
function teleCone(x, z, ang, half, len, windup, dmg, col, opts) { const o = teleBase(2, windup, dmg, col, opts); teleSetCone(o, x, z, ang, half, len); return o; }
function teleSetLine(o, x0, z0, x1, z1, w) {
  o.x = x0; o.z = z0; o.x1 = x1; o.z1 = z1; o.w = w; const len = Math.hypot(x1 - x0, z1 - z0); o.len = len;
  o.m.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2); o.m.scale.set(w, 1, len); o.m.rotation.y = -Math.atan2(z1 - z0, x1 - x0) + Math.PI / 2; o.u.uSize.value.set(w, len);
}
function teleLine(x0, z0, x1, z1, w, windup, dmg, col, opts) { const o = teleBase(3, windup, dmg, col, opts); teleSetLine(o, x0, z0, x1, z1, w); return o; }
function teleSoak(x, z, r, windup, onSuccess, onFail) { const o = teleCircle(x, z, r, windup, 0, W, { noHit: true }); o.shape = 4; o.u.uShape.value = 4; o.u.uColor.value.setRGB(1, 1, 1); o.onSuccess = onSuccess; o.onFail = onFail; return o; }
function teleSafe(x, z, r, dur) { const o = teleCircle(x, z, r, dur, 0, -1, { noHit: true }); o.shape = 5; o.u.uShape.value = 5; o.u.uColor.value.setRGB(TCOL_SAFE[0], TCOL_SAFE[1], TCOL_SAFE[2]); o.dur = dur; return o; }
function teleCancel(o) { if (o && o.active) { o.resolved = true; o.post = 0.18; o.noHit = true; o.onResolve = null; } }
function teleClearAll() { for (let i = 0; i < TELE_N; i++) { const o = tele[i]; if (o.active) { o.active = false; o.m.visible = false; } } }
// signed distance from player center to shape boundary (negative = inside), xz
function teleSD(o, px, pz) {
  if (o.shape === 0 || o.shape >= 4) return Math.hypot(px - o.x, pz - o.z) - o.r;
  if (o.shape === 1) { const d = Math.hypot(px - o.x, pz - o.z); return Math.max(d - o.r, o.rIn - d); }
  if (o.shape === 2) {
    const dx = px - o.x, dz = pz - o.z, d = Math.hypot(dx, dz);
    const a = Math.abs(wrapA(Math.atan2(dz, dx) - o.ang));
    const sa = a > o.half ? d * Math.sin(Math.min(a - o.half, Math.PI / 2)) : -d * Math.sin(Math.min(o.half - a, Math.PI / 2));
    return Math.max(d - o.len, sa);
  }
  // line
  const sd = segDist(px, pz, o.x, o.z, o.x1, o.z1); return sd - o.w / 2;
}
function updateTele(dt) {
  for (let i = 0; i < TELE_N; i++) {
    const o = tele[i]; if (!o.active) continue;
    o.u.uTime.value = fx.simTime;
    if (!o.resolved) {
      o.t += dt; const k = o.t / o.windup;
      if (o.follow && !o.locked) { o.follow(o, k); }
      if (!o.locked && k >= o.lockAt) { o.locked = true; if (o.onLock) o.onLock(o); }
      o.u.uFill.value = o.shape === 5 ? 0 : clamp(k, 0, 1);
      o.u.uAlpha.value = Math.min(1, o.t / 0.15);
      if (!o.tellPlayed && o.windup - o.t <= 0.3 && o.shape < 4) { o.tellPlayed = true; sfx.tell(o.shape); }
      if (k >= 1) {
        o.resolved = true; o.post = o.shape === 5 ? 0.25 : 0.32;
        if (o.shape === 4) { // soak
          const inside = teleSD(o, player.x, player.z) < 0 && player.alive;
          if (inside) { o.onSuccess && o.onSuccess(o); } else { o.onFail && o.onFail(o); }
          ring(o.x, 0.05, o.z, o.r * 0.6, o.r * 1.2, 0.4, 0.25, 2, 2, 2, 1);
        } else if (o.shape < 4) {
          if (!o.noHit) {
            const d = teleSD(o, player.x, player.z) - PLAYER.hurtR; hitSrc = 'tele' + o.shape;
            const res = resolveHazard(d, 0.8, o.col, o.dmg, !o.grazed);
            if (res === HZ_GRAZE) o.grazed = true;
          }
          const rr = o.shape === 2 ? o.len : o.shape === 3 ? o.w : o.r;
          if (o.shape <= 1) ring(o.x, 0.05, o.z, rr * 0.85, rr * 1.12, 0.45, 0.18, 2.2, 1.0, 0.9, 1.2);
          sfx.resolve(Math.hypot(player.x - o.x, player.z - o.z));
          if (o.onResolve) o.onResolve(o);
        }
      }
    } else {
      o.post -= dt; const f = o.shape === 5 ? 0 : clamp((o.post - 0.22) / 0.1, 0, 1);
      o.u.uFlash.value = f; o.u.uFill.value = 1; o.u.uAlpha.value = clamp(o.post / 0.22, 0, 1);
      if (o.post <= 0) { o.active = false; o.m.visible = false; }
    }
  }
}

/* =====================================================================
   8  PROJECTILES — enemy (InstancedMesh 700, SoA) + player bolts (60)
   ===================================================================== */
const PJ_N = 700;
const PJ = {
  x: new Float32Array(PJ_N), z: new Float32Array(PJ_N), ox: new Float32Array(PJ_N), oz: new Float32Array(PJ_N),
  vx: new Float32Array(PJ_N), vz: new Float32Array(PJ_N), r: new Float32Array(PJ_N), c: new Uint8Array(PJ_N), life: new Float32Array(PJ_N),
  dmg: new Float32Array(PJ_N), fl: new Uint16Array(PJ_N), acc: new Float32Array(PJ_N), av: new Float32Array(PJ_N), age: new Float32Array(PJ_N),
  orR: new Float32Array(PJ_N), orA: new Float32Array(PJ_N), orW: new Float32Array(PJ_N), y: new Float32Array(PJ_N), turn: new Float32Array(PJ_N),
  alive: new Uint8Array(PJ_N), hi: -1, count: 0, cursor: 0, colorDirty: false, onLand: new Array(PJ_N).fill(null),
};
const F_GRAZED = 1, F_REFL = 2, F_HOME = 4, F_LAT = 8, F_ORBIT = 16, F_HARMLESS = 32, F_LAND = 64, F_NOTRAIL = 128, F_SLOWED = 256, F_NOHIT = 512;
const pjMat = new THREE.ShaderMaterial({
  vertexShader: /* glsl */`varying vec3 vC; varying vec3 vN; varying vec3 vV;
    void main(){ vC = instanceColor; vec4 mv = modelViewMatrix*instanceMatrix*vec4(position,1.0); vV = -mv.xyz; vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: /* glsl */`varying vec3 vC; varying vec3 vN; varying vec3 vV;
    void main(){ float f = abs(dot(normalize(vN), normalize(vV)));
      vec3 c = mix(vC*0.03, vC*1.15, smoothstep(0.12, 0.55, f)); c += (vC*0.6+0.4)*pow(f, 10.0)*0.55;
      gl_FragColor = vec4(c, 1.0); }`,
});
const pjMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), pjMat, PJ_N);
pjMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pjMesh.frustumCulled = false; pjMesh.renderOrder = 10;
for (let i = 0; i < PJ_N; i++) { pjMesh.setColorAt(i, _col.setRGB(1, 1, 1)); }
{ const a = pjMesh.instanceMatrix.array; for (let i = 0; i < PJ_N; i++) { const o = i * 16; for (let k = 0; k < 16; k++) a[o + k] = 0; a[o + 15] = 1; } }
pjMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
pjMesh.count = 0;
scene.add(pjMesh);
function pjSetColor(i, c, dim = 1) { const col = PCOL[c]; const a = pjMesh.instanceColor.array; a[i * 3] = col[0] * dim; a[i * 3 + 1] = col[1] * dim; a[i * 3 + 2] = col[2] * dim; PJ.colorDirty = true; }
function pjAlloc() {
  for (let n = 0; n < PJ_N; n++) { const i = (PJ.cursor + n) % PJ_N; if (!PJ.alive[i]) { PJ.cursor = (i + 1) % PJ_N; return i; } }
  const i = PJ.cursor; PJ.cursor = (i + 1) % PJ_N; return i; // pool full: reuse
}
// spawn enemy projectile
function shoot(x, z, ang, speed, c, r, dmg, life = 9, flags = 0) {
  const i = pjAlloc();
  if (!PJ.alive[i]) PJ.count++;
  PJ.alive[i] = 1; PJ.x[i] = PJ.ox[i] = x; PJ.z[i] = PJ.oz[i] = z; PJ.vx[i] = Math.cos(ang) * speed; PJ.vz[i] = Math.sin(ang) * speed;
  PJ.r[i] = r; PJ.c[i] = c; PJ.life[i] = life; PJ.dmg[i] = dmg; PJ.fl[i] = flags; PJ.acc[i] = 0; PJ.av[i] = 0; PJ.age[i] = 0; PJ.y[i] = 0.9; PJ.turn[i] = 0;
  PJ.onLand[i] = null;
  if (i > PJ.hi) PJ.hi = i;
  pjSetColor(i, c, flags & F_HARMLESS ? 0.35 : 1);
  return i;
}
function pjKill(i, sparkle = true) {
  if (!PJ.alive[i]) return; PJ.alive[i] = 0; PJ.count--;
  const o = i * 16, a = pjMesh.instanceMatrix.array; a[o] = a[o + 5] = a[o + 10] = 0;
  if (sparkle) { tryRipple(PJ.x[i], PJ.z[i], 0.35); const c = PCOL[PJ.c[i]]; burst(PJ.x[i], PJ.y[i], PJ.z[i], 5, c[0] * 2, c[1] * 2, c[2] * 2, 3, 0.35, 0.12, 1, 4); }
  PJ.onLand[i] = null;
}
function pjClearAll(sparkle = true, refundToPlayer = false) {
  for (let i = 0; i <= PJ.hi; i++) if (PJ.alive[i]) {
    if (refundToPlayer) streakToPlayer(PJ.x[i], PJ.y[i], PJ.z[i], PJ.c[i], 1);
    pjKill(i, sparkle && (i % 2 === 0));
  }
  PJ.hi = -1; PJ.count = 0;
}

// player bolts
const PB_N = 60;
const PB = { x: new Float32Array(PB_N), y: new Float32Array(PB_N), z: new Float32Array(PB_N), vx: new Float32Array(PB_N), vy: new Float32Array(PB_N), vz: new Float32Array(PB_N),
  dist: new Float32Array(PB_N), alive: new Uint8Array(PB_N), crit: new Uint8Array(PB_N), dmg: new Float32Array(PB_N), cursor: 0 };
const pbMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.6, 3.0) }), PB_N);
pbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pbMesh.frustumCulled = false; pbMesh.renderOrder = 11;
{ const a = pbMesh.instanceMatrix.array; for (let i = 0; i < PB_N * 16; i++) a[i] = 0; }
scene.add(pbMesh);
function writeBoltMatrix(i) {
  const a = pbMesh.instanceMatrix.array, o = i * 16;
  if (!PB.alive[i]) { for (let k = 0; k < 16; k++) a[o + k] = 0; return; }
  let fx_ = PB.vx[i], fy = PB.vy[i], fz = PB.vz[i]; const l = Math.hypot(fx_, fy, fz) || 1; fx_ /= l; fy /= l; fz /= l;
  let rx = fz, rz = -fx_; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;      // right = up x f
  const ux = fy * rz, uy = fz * rx - fx_ * rz, uz = -fy * rx;                        // up' = f x right
  const w = 0.075, Lz = 0.5;
  a[o] = rx * w; a[o + 1] = 0; a[o + 2] = rz * w; a[o + 3] = 0;
  a[o + 4] = ux * w; a[o + 5] = uy * w; a[o + 6] = uz * w; a[o + 7] = 0;
  a[o + 8] = fx_ * Lz; a[o + 9] = fy * Lz; a[o + 10] = fz * Lz; a[o + 11] = 0;
  a[o + 12] = PB.x[i]; a[o + 13] = PB.y[i]; a[o + 14] = PB.z[i]; a[o + 15] = 1;
}

/* =====================================================================
