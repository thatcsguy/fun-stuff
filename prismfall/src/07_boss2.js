// ------------------------------------------------------------------
// BOSS 2 — VEYRA, THE GLASS ORCHARD (hex-column arena, crystal tree, saplings, petals, soak, arena drop, thorn ring)
// ------------------------------------------------------------------
const B2PAL = {
  grove: { edge: [0.12, 0.85, 0.78], body: [0.2, 1.0, 0.7], core: [0.55, 1.9, 1.0], fog: [0.005, 0.014, 0.024], leaf: [0.3, 1.0, 0.65], void: [0.1, 0.5, 0.5] },
  bloom: { edge: [0.62, 0.32, 1.0], body: [0.6, 0.38, 1.0], core: [1.0, 0.6, 1.9], fog: [0.016, 0.007, 0.034], leaf: [0.75, 0.45, 1.0], void: [0.45, 0.2, 0.8] },
  thorn: { edge: [1.0, 0.18, 0.38], body: [1.0, 0.3, 0.45], core: [1.9, 0.45, 0.6], fog: [0.03, 0.005, 0.014], leaf: [1.0, 0.38, 0.52], void: [0.8, 0.1, 0.25] },
};
const B2 = {
  group: new THREE.Group(), precomp: [],
  NT: 0, tileMesh: null, tDyn: null, tDynA: null, tx: null, tz: null, td: null, ty0: null, tPlay: null, tSeed: null, tState: null, tErupt: null, tFallAt: null, tY: null, tVY: null, tAng: null, tAx: null, tAz: null, tW: null, matDirty: false,
  colU: null, brMesh: null, brData: [], brU: null, leafMesh: null, leafU: null,
  veyra: null, vU: null, hair: null, hairData: [], arms: [], core: null, halo: null, haloU: null, bud: null,
  vx: 0, vz: 0.25, hy: 3.4, yaw: 0, lift: 0, move: null, armRaise: 0, sc: 1.12,
  saps: [], seeds: [], petals: [], bloom: { active: false, t: 0, dur: 10, fade: 0 }, soak: { active: false, x: 0, z: 0, t: 0, inT: 0, fade: 0 }, tower: null, towerU: null, seedOrb: null,
  spikes: null, ringGlow: null, ringOn: false, ringR: 14, ringFrom: 14, ringReset: 0, ringGrazeCD: 0, ringA: 0, fracFlag: false, vulnPrev: false, kbT: 0, kbX: 0, kbZ: 0,
  vortex: 0, vortexTo: 0, rippleT: -1, introT: -1, palT: -1, pal: 'grove', white: 0, whiteTo: 0, collapse: 0, collapseTo: 0, scatter: 0, scatterOn: false,
  firstBloom: true, sparkAcc: 0, armT: 0, cut: { nx: 0, nz: 1, off: 1 }, brokeTree: false,
};
const S3 = Math.sqrt(3);
function b2InArena(x, z, m) {
  if (Math.hypot(x, z) > 14.4 - m) return false;
  const ac = game.arenaCut; if (ac.on && x * ac.nx + z * ac.nz > ac.off - m) return false;
  return true;
}
function b2Clamp(o) { // o: Vector2 in/out
  const r = Math.hypot(o.x, o.y), mr = 13.2; if (r > mr) { o.x *= mr / r; o.y *= mr / r; }
  const ac = game.arenaCut; if (ac.on) { const s = o.x * ac.nx + o.y * ac.nz - (ac.off - 1.6); if (s > 0) { o.x -= ac.nx * s; o.y -= ac.nz * s; } }
  return o;
}
// crystal shader shared by Veyra, saplings, hair (instancing-aware)
function b2CrystalMat(u) {
  return new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`varying vec3 vV; varying vec3 vO;
      void main(){ vO = position; vec4 lp = vec4(position,1.0);
        #ifdef USE_INSTANCING
        lp = instanceMatrix*lp;
        #endif
        vec4 mv = modelViewMatrix*lp; vV = mv.xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: GLSL_LIB + /* glsl */`
      uniform float uTime,uFlash,uCrack,uFracture,uWhite,uDark; uniform vec3 uCol,uCore; varying vec3 vV; varying vec3 vO;
      vec2 vor(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8.0, d2=8.0; for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=vec2(hash12(i+g), hash12(i+g+17.0)); vec2 r=g+o-f; float d=dot(r,r); if(d<d1){d2=d1; d1=d;} else if(d<d2) d2=d; } return vec2(sqrt(d1), sqrt(d2)); }
      void main(){
        vec3 n = normalize(cross(dFdx(vV), dFdy(vV))); vec3 v = normalize(-vV);
        float fr = 1.0-abs(dot(n,v));
        float fl = 0.8+0.2*noise2(vec2(uTime*3.0, vO.y*4.0));
        vec3 c = uCol*(0.05 + pow(fr,1.5)*1.25) + uCore*pow(1.0-fr,2.5)*0.22*fl + palette(fr*1.2 + uTime*0.06 + vO.y*0.3)*pow(fr,2.0)*0.4;
        vec3 L = normalize((viewMatrix*vec4(0.4,0.9,0.3,0.0)).xyz);
        c += vec3(pow(max(dot(reflect(-v,n),L),0.0), 24.0)*1.1);
        vec2 vr = vor(vO.xy*3.0 + vO.z*1.7); float ce = smoothstep(0.07, 0.0, vr.y-vr.x);
        c += vec3(2.2,2.4,2.6)*ce*max(uCrack, uFracture*0.35*(0.5+0.5*sin(uTime*9.0)));
        c = mix(c, vec3(1.7,1.85,2.1)*(0.35+fr*1.3) + vec3(ce)*1.6, uWhite);
        c *= 1.0-uDark*0.85;
        c = mix(c, vec3(3.0), uFlash);
        gl_FragColor = vec4(c, 1.0); }`,
  });
}
function buildBoss2() {
  const g = B2.group; scene.add(g);
  // ================= HEX COLUMNS =================
  const cells = [];
  for (let q = -14; q <= 14; q++) for (let r = -14; r <= 14; r++) { const x = S3 * (q + r / 2), z = 1.5 * r, d = Math.hypot(x, z); if (d < 22.5) cells.push([x, z, d]); }
  cells.sort((a, b) => a[2] - b[2]);
  const NT = B2.NT = cells.length;
  const colGeo = new THREE.CylinderGeometry(0.965, 0.965, 8, 6, 1).translate(0, -4, 0);
  const aTile = new Float32Array(NT * 4); B2.tDyn = new Float32Array(NT * 3);
  B2.tx = new Float32Array(NT); B2.tz = new Float32Array(NT); B2.td = new Float32Array(NT); B2.ty0 = new Float32Array(NT); B2.tPlay = new Uint8Array(NT); B2.tSeed = new Float32Array(NT);
  B2.tState = new Uint8Array(NT); B2.tErupt = new Float32Array(NT).fill(-1); B2.tFallAt = new Float32Array(NT); B2.tY = new Float32Array(NT); B2.tVY = new Float32Array(NT); B2.tAng = new Float32Array(NT);
  B2.tAx = new Float32Array(NT); B2.tAz = new Float32Array(NT); B2.tW = new Float32Array(NT); B2.tGlow = new Float32Array(NT);
  for (let i = 0; i < NT; i++) {
    const [x, z, d] = cells[i]; const play = d < 15.2; const sd = frand();
    B2.tx[i] = x; B2.tz[i] = z; B2.td[i] = d; B2.tPlay[i] = play ? 1 : 0; B2.tSeed[i] = sd;
    B2.ty0[i] = play ? -0.09 : -0.45 - (d - 15.2) * 0.5 - frand() * 0.7;
    aTile[i * 4] = x; aTile[i * 4 + 1] = z; aTile[i * 4 + 2] = sd; aTile[i * 4 + 3] = play ? 1 : 0;
    const a = frand() * TAU; B2.tAx[i] = Math.cos(a); B2.tAz[i] = Math.sin(a); B2.tW[i] = (1.2 + frand() * 2.5) * (frand() < 0.5 ? -1 : 1);
  }
  colGeo.setAttribute('aTile', new THREE.InstancedBufferAttribute(aTile, 4));
  B2.tDynA = new THREE.InstancedBufferAttribute(B2.tDyn, 3).setUsage(THREE.DynamicDrawUsage); colGeo.setAttribute('aDyn', B2.tDynA);
  B2.colU = {
    uTime: floorU.uTime, uPlayerPos: floorU.uPlayerPos, uPlayerColor: floorU.uPlayerColor, uPlayerGlow: floorU.uPlayerGlow, uBossPos: floorU.uBossPos, uBossShadow: floorU.uBossShadow,
    uWave: floorU.uWave, uLights: floorU.uLights, uLightCol: floorU.uLightCol, uLatPos: floorU.uLatPos,
    uEdgeA: { value: new THREE.Color(0.2, 1, 0.5) }, uEdgeB: { value: new THREE.Color(0.2, 1, 0.5) }, uPalR: { value: 0 }, uPalC: { value: new THREE.Vector2() },
    uRing: { value: new THREE.Vector4(0, 0, 14, 0) }, uFog: { value: new THREE.Color(0.006, 0.014, 0.024) },
  };
  const colMat = new THREE.ShaderMaterial({
    uniforms: B2.colU,
    vertexShader: /* glsl */`
      attribute vec4 aTile; attribute vec3 aDyn;
      varying vec3 vW; varying vec3 vL; varying vec3 vN; varying vec4 vTile; varying vec3 vDyn; varying float vTop;
      void main(){
        vL = position; vTile = aTile; vDyn = aDyn; vTop = normal.y > 0.5 ? 1.0 : 0.0;
        vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0); w.y += aDyn.x; vW = w.xyz;
        vN = normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
        gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: GLSL_LIB + /* glsl */`
      uniform float uTime,uPlayerGlow,uBossShadow,uPalR; uniform vec2 uPlayerPos,uBossPos,uPalC; uniform vec3 uPlayerColor,uEdgeA,uEdgeB,uLatPos,uFog;
      uniform vec4 uWave[3]; uniform vec4 uLights[4]; uniform vec3 uLightCol[4]; uniform vec4 uRing;
      varying vec3 vW; varying vec3 vL; varying vec3 vN; varying vec4 vTile; varying vec3 vDyn; varying float vTop;
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        vec2 c = vTile.xy; float seed = vTile.z; float play = vTile.w; float glow = vDyn.y;
        float pd = length(c - uPalC);
        vec3 edgeC = mix(uEdgeA, uEdgeB, smoothstep(uPalR, uPalR-3.0, pd));
        float front = exp(-pow((pd-uPalR)*0.7,2.0))*step(0.01,uPalR)*(1.0-smoothstep(26.0,34.0,uPalR));
        vec3 col;
        if (vTop > 0.5) {
          float e = 0.835 - hexD(vL.xz);
          float line = smoothstep(0.075, 0.0, e); float soft = exp(-max(e,0.0)*7.0);
          vec2 q = vW.xz - V.xz/max(V.y,0.25)*0.55;
          float n1 = noise2(q*1.4 + seed*31.0);
          vec2 gq = q*2.6 + seed*17.0; vec2 gi = floor(gq); vec2 gf = fract(gq)-0.5; float gh = hash12(gi);
          float spark = step(0.9, gh)*smoothstep(0.16, 0.0, length(gf + (vec2(hash12(gi+3.1), hash12(gi+7.7))-0.5)*0.6))*pow(0.5+0.5*sin(uTime*(0.8+gh*2.5)+gh*40.0), 3.0);
          float fres = pow(1.0-max(V.y,0.0), 3.0);
          float tv = hash12(c*1.37+0.5);
          col = vec3(0.006,0.005,0.016) + edgeC*0.022*(0.2+1.1*n1*n1)*(0.4+tv*1.2) + vec3(0.05,0.04,0.09)*fres;
          float vein = smoothstep(0.035, 0.0, abs(noise2(q*1.6 + seed*7.0) - 0.5));
          col += edgeC*vein*0.07*(0.4+play*0.6)*(0.5+0.5*sin(uTime*0.7 + seed*9.0));
          float bd = length(c - uBossPos);
          float sapw = pow(0.5+0.5*sin(bd*0.55 - uTime*2.2), 6.0)*exp(-bd*0.06);
          float pulse = 0.5+0.5*sin(uTime*1.1 + seed*6.28 + length(c)*0.35);
          float rim = play*smoothstep(13.4, 15.0, length(c));
          col += edgeC*(line*(0.16+0.22*pulse*tv + sapw*0.55 + rim*0.6)*mix(0.25,1.0,play) + soft*(0.04+sapw*0.08));
          col += mix(edgeC, vec3(1.0), 0.5)*spark*1.1;
          col += edgeC*glow*(0.35 + line*1.6 + soft*0.4);
          for(int i=0;i<3;i++){ vec4 w=uWave[i]; if(w.w<=0.0) continue; float d=length(c-w.xy);
            float band = smoothstep(2.4,0.0,abs(d-w.z)); vec3 pc = palette(seed*0.6 + uTime*0.2 + d*0.03);
            col += pc*(soft*0.9 + line*2.6 + 0.16)*band*w.w*2.4; }
          for(int i=0;i<4;i++){ vec4 Lt=uLights[i]; if(Lt.w<=0.0) continue; float dl=length(vW.xz-Lt.xz);
            col += uLightCol[i]*Lt.w*0.3*exp(-dl*dl/(4.0+Lt.y*2.0))*(0.45+line*1.8+spark*2.0); }
          vec2 dpp = vW.xz-uPlayerPos; float dp2 = dot(dpp,dpp);
          col += uPlayerColor*uPlayerGlow*exp(-dp2/9.0)*(0.6 + line*2.2);
          if (uLatPos.z > 0.0) { float dl = length(vW.xz-uLatPos.xy); col += vec3(0.1,1.0,0.35)*smoothstep(4.8,0.0,dl)*uLatPos.z*(0.06+line*0.4); }
          if (uRing.w > 0.0) { float rd = length(c-uRing.xy) - uRing.z; float o = smoothstep(-0.6,0.9,rd);
            col = mix(col, col*0.55, o*uRing.w); col += vec3(1.0,0.1,0.18)*o*uRing.w*(0.03 + line*0.45*(0.6+0.4*sin(uTime*4.0+seed*6.0))); }
          float db2 = dot(vW.xz-uBossPos, vW.xz-uBossPos);
          col *= (1.0-0.6*exp(-dp2/0.32))*(1.0-0.5*uBossShadow*exp(-db2/4.0));
        } else {
          float fr = pow(1.0-abs(dot(normalize(vN), V)), 2.0);
          float dep = clamp(-vL.y/8.0, 0.0, 1.0);
          float vein = smoothstep(0.9, 1.0, sin(vL.y*1.7 + seed*20.0 + atan(vL.x,vL.z)*3.0));
          col = vec3(0.006,0.005,0.016) + edgeC*(fr*0.32 + 0.035)*(1.0-dep)*(1.0-dep) + edgeC*vein*0.08*(1.0-dep);
          col += edgeC*smoothstep(-0.14, 0.0, vL.y)*0.55;
          col += edgeC*glow*(1.0-dep)*0.7;
        }
        col += edgeC*front*1.1;
        float dist = length(cameraPosition - vW);
        float f = 1.0 - exp(-pow(dist*0.016,2.0));
        float hf = smoothstep(-0.6, -10.0, vW.y);
        col = mix(col, uFog, clamp(max(f*0.8, hf*0.94), 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0); }`,
  });
  B2.tileMesh = new THREE.InstancedMesh(colGeo, colMat, NT);
  B2.tileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); B2.tileMesh.frustumCulled = false;
  g.add(B2.tileMesh); b2TilesReset();

  // ================= CRYSTAL TREE (L-system, depth 5) =================
  const rr = mulberry32(4242); const brs = [];
  const grow = (s, d, len, rad, depth) => {
    const e = s.clone().addScaledVector(d, len); brs.push({ s: s.clone(), e, d: d.clone(), len, rad, depth, seed: rr() });
    if (depth >= 5 || brs.length > 170) return;
    const n = depth === 0 ? 3 : (rr() < 0.42 ? 3 : 2); const az0 = rr() * TAU;
    for (let k = 0; k < n; k++) {
      const az = az0 + k * TAU / n + (rr() - 0.5) * 0.7; const tilt = depth === 0 ? 0.85 + rr() * 0.2 : 0.4 + rr() * 0.4;
      const h = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      const nd = d.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(h, Math.sin(tilt)).normalize();
      nd.y = Math.max(nd.y, depth >= 3 ? -0.35 : 0.12); nd.normalize();
      grow(e, nd, len * (0.68 + rr() * 0.12), rad * 0.62, depth + 1);
    }
  };
  grow(new THREE.Vector3(0, -0.3, -1.0), new THREE.Vector3(0, 1, -0.05).normalize(), 4.4, 0.6, 0);
  B2.brData = brs;
  const brGeo = new THREE.CylinderGeometry(0.62, 1, 1, 8, 4).translate(0, 0.5, 0);
  const aBr = new Float32Array(brs.length * 3); brs.forEach((b, i) => { aBr[i * 3] = b.depth; aBr[i * 3 + 1] = b.seed; });
  brGeo.setAttribute('aBr', new THREE.InstancedBufferAttribute(aBr, 3));
  B2.brU = { uTime: { value: 0 }, uCol: { value: new THREE.Color(0.22, 1, 0.55) }, uFlash: { value: 0 }, uDim: { value: 0 }, uWhite: { value: 0 } };
  B2.brMesh = new THREE.InstancedMesh(brGeo, new THREE.ShaderMaterial({
    uniforms: B2.brU,
    vertexShader: /* glsl */`attribute vec3 aBr; varying vec3 vV; varying float vY; varying vec3 vBr; varying vec3 vN; varying vec3 vO;
      void main(){ vY = position.y; vBr = aBr; vO = position; vec4 mv = modelViewMatrix*instanceMatrix*vec4(position,1.0); vV = mv.xyz;
        mat3 im = mat3(instanceMatrix); vec3 s2 = max(vec3(dot(im[0],im[0]), dot(im[1],im[1]), dot(im[2],im[2])), vec3(1e-6));
        vN = normalize(normalMatrix*(im*(normal/s2))); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: GLSL_LIB + /* glsl */`uniform float uTime,uFlash,uDim,uWhite; uniform vec3 uCol; varying vec3 vV; varying float vY; varying vec3 vBr; varying vec3 vN; varying vec3 vO;
      void main(){ vec3 v = normalize(-vV); float fr = 1.0-abs(dot(normalize(vN), v));
        float sp = fract((vBr.x + vY)*0.45 - uTime*0.38 + vBr.y*0.15); float sap = exp(-pow((sp-0.5)*9.0,2.0));
        // internal refraction: caustic bands sliding through the glass, brighter toward the core of the rod
        float ang = atan(vO.x, vO.z);
        float caus = pow(0.5+0.5*sin(vY*7.0 + ang*2.0 + fr*5.0 - uTime*1.3 + vBr.y*30.0), 6.0);
        vec3 c = uCol*(0.03 + pow(fr,1.6)*1.15) + uCol*sap*(0.35+0.9*(1.0-fr))*(0.7+0.5*vBr.y)
               + palette(fr*0.8 + vY*0.3 + uTime*0.05 + vBr.y)*pow(fr,2.5)*0.4 + mix(uCol, vec3(1.0), 0.4)*caus*(1.0-fr)*0.35;
        c *= 1.0-uDim*0.75;
        c = mix(c, vec3(1.3,1.5,1.8)*(0.12+pow(fr,1.4)*1.2) + palette(fr+vY*0.2+uTime*0.1)*pow(fr,2.0)*0.5, uWhite);
        c = mix(c, vec3(2.5), uFlash); gl_FragColor = vec4(c, 1.0); }`,
  }), brs.length);
  B2.brMesh.frustumCulled = false; g.add(B2.brMesh);
  // knuckles hide the hard joints between branch segments
  const jGeo = new THREE.IcosahedronGeometry(1, 1); jGeo.setAttribute('aBr', new THREE.InstancedBufferAttribute(aBr, 3));
  B2.brJoint = new THREE.InstancedMesh(jGeo, B2.brMesh.material, brs.length); B2.brJoint.frustumCulled = false; g.add(B2.brJoint);
  b2TreeReset();

  // ================= LEAVES (1500 shards, rest ↔ vortex in the vertex shader) =================
  const NL = 1500; const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.22, 0, 0.075, 0.02, 0, 0, -0.16, 0, -0.075, 0.02, 0]), 3)); lg.setIndex([0, 1, 2, 0, 2, 3]);
  const aRest = new Float32Array(NL * 3), aOrb = new Float32Array(NL * 3), aSeed = new Float32Array(NL * 2);
  const tips = brs.filter((b) => b.depth >= 4);
  for (let i = 0; i < NL; i++) {
    const b = tips[i % tips.length]; const u = frand();
    const px = lerp(b.s.x, b.e.x, 0.4 + u * 0.7), py = lerp(b.s.y, b.e.y, 0.4 + u * 0.7), pz = lerp(b.s.z, b.e.z, 0.4 + u * 0.7);
    const th = frand() * TAU, ph = Math.acos(frand() * 2 - 1), rad = 0.25 + Math.pow(frand(), 0.6) * 0.75;
    aRest[i * 3] = px + Math.sin(ph) * Math.cos(th) * rad; aRest[i * 3 + 1] = py + Math.cos(ph) * rad * 0.6 - 0.15; aRest[i * 3 + 2] = pz + Math.sin(ph) * Math.sin(th) * rad;
    aOrb[i * 3] = 6 + Math.pow(frand(), 0.8) * 8; aOrb[i * 3 + 1] = 0.6 + frand() * 3.2; aOrb[i * 3 + 2] = frand() * TAU;
    aSeed[i * 2] = frand(); aSeed[i * 2 + 1] = frand();
  }
  lg.setAttribute('aRest', new THREE.InstancedBufferAttribute(aRest, 3)); lg.setAttribute('aOrb', new THREE.InstancedBufferAttribute(aOrb, 3)); lg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 2));
  B2.leafU = { uTime: { value: 0 }, uVortex: { value: 0 }, uCollapse: { value: 0 }, uScatter: { value: 0 }, uHide: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uCore: { value: new THREE.Vector3(0, 3.4, 0) }, uCol: { value: new THREE.Color(0.3, 1, 0.55) } };
  B2.leafMesh = new THREE.InstancedMesh(lg, new THREE.ShaderMaterial({
    uniforms: B2.leafU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec3 aRest; attribute vec3 aOrb; attribute vec2 aSeed;
      uniform float uTime,uVortex,uCollapse,uScatter,uHide; uniform vec3 uCenter,uCore;
      varying float vSp; varying float vA; varying vec2 vP;
      void main(){
        float s = aSeed.x;
        float k = clamp(uVortex*1.7 - s*0.7, 0.0, 1.0); k = k*k*(3.0-2.0*k);
        vec3 rest = aRest + vec3(sin(uTime*1.3+s*40.0), 0.6*sin(uTime*1.7+s*23.0), cos(uTime*1.1+s*31.0))*0.05;
        float ang = aOrb.z + uTime*(0.22+0.3*aSeed.y)*(1.6-aOrb.x/13.0);
        vec3 orb = uCenter + vec3(cos(ang)*aOrb.x, aOrb.y + sin(uTime*0.8+s*12.0)*0.35, sin(ang)*aOrb.x);
        vec3 p = mix(rest, orb, k);
        float ck = clamp(uCollapse*1.5 - s*0.5, 0.0, 1.0); ck = ck*ck*(3.0-2.0*ck);
        p = mix(p, uCore + vec3(sin(s*70.0), cos(s*40.0), sin(s*33.0))*0.4*(1.0-ck), ck);
        vec3 dir = normalize(vec3(sin(s*91.7), cos(s*57.3)*0.8+0.3, cos(s*91.7)*0.9 + sin(s*13.1)*0.3) + 1e-3);
        p += dir*uScatter*(5.0+16.0*fract(s*13.7));
        float a1 = uTime*(0.6+aSeed.y*1.8)*(1.0+k*2.5)+s*50.0, a2 = s*80.0+uTime*(0.4+k);
        float c1=cos(a1), s1=sin(a1), c2=cos(a2), s2=sin(a2);
        vec3 lp = position*(1.0+k*0.35)*(1.0-uHide)*(1.0+uScatter*0.6);
        lp = vec3(lp.x*c1-lp.y*s1, lp.x*s1+lp.y*c1, lp.z);
        lp = vec3(lp.x*c2+lp.z*s2, lp.y, -lp.x*s2+lp.z*c2);
        vec3 nr = vec3(s2, 0.0, c2);
        vec4 mv = modelViewMatrix*vec4(p+lp,1.0);
        vec3 vn = normalize(mat3(modelViewMatrix)*nr);
        vSp = pow(abs(dot(vn, normalize(-mv.xyz))), 10.0);
        vA = (1.0-uScatter*uScatter)*(0.5+0.5*sin(uTime*2.0+s*30.0))*(1.0+uScatter*2.5*(1.0-uScatter)) * (1.0 + ck*1.5);
        vP = position.xy;
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */`uniform vec3 uCol; varying float vSp; varying float vA; varying vec2 vP;
      void main(){ float mid = 1.0-smoothstep(0.0,0.06,abs(vP.x));
        vec3 c = uCol*(0.3 + mid*0.35 + vSp*2.4) + vec3(1.0)*vSp*1.4;
        gl_FragColor = vec4(c*vA*0.75, 1.0); }`,
  }), NL);
  B2.leafMesh.frustumCulled = false; B2.leafMesh.renderOrder = 14; g.add(B2.leafMesh);

  // ================= VEYRA (crystalline dryad) =================
  B2.vU = { uTime: { value: 0 }, uCol: { value: new THREE.Color(0.22, 1, 0.55) }, uCore: { value: new THREE.Color(0.55, 1.8, 0.85) }, uFlash: { value: 0 }, uCrack: { value: 0 }, uFracture: { value: 0 }, uWhite: { value: 0 }, uDark: { value: 0 } };
  const vm = b2CrystalMat(B2.vU); B2.vMat = vm;
  const V = B2.veyra = new THREE.Group(); g.add(V);
  const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0, parent = V) => { const m = new THREE.Mesh(geo, vm); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
  add(new THREE.IcosahedronGeometry(0.5, 0).scale(0.9, 1.3, 0.75), 0, 2.35, 0);
  add(new THREE.IcosahedronGeometry(0.7, 0).scale(1.3, 0.95, 0.8), 0, 3.2, 0, 0, 0.3, 0);
  add(new THREE.OctahedronGeometry(0.2, 0).scale(1, 1.7, 1), 0, 3.95, 0);
  add(new THREE.IcosahedronGeometry(0.42, 0).scale(0.82, 1.2, 0.9), 0, 4.42, 0.04);
  const crownGeo = new THREE.ConeGeometry(0.06, 1, 4).translate(0, 0.5, 0);
  for (let k = 0; k < 7; k++) { const a = (k - 3) * 0.34; const m = add(crownGeo, Math.sin(a) * 0.28, 4.62, -0.08, -0.35, 0, -a * 1.35); m.scale.set(1, 0.7 + (1 - Math.abs(k - 3) / 3) * 0.8, 1); }
  // gown of roots
  const rootGeo = new THREE.ConeGeometry(0.2, 2.6, 5).rotateX(Math.PI).translate(0, -1.3, 0);
  for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; const m = add(rootGeo, Math.sin(a) * 0.3, 2.25, Math.cos(a) * 0.3); m.rotation.set(Math.cos(a) * 0.38, 0, -Math.sin(a) * 0.38); m.scale.set(1, 0.75 + (k % 3) * 0.15, 1); }
  // arms (shoulder → elbow → hand)
  const upGeo = new THREE.CylinderGeometry(0.075, 0.15, 1.15, 6).translate(0, -0.575, 0), foGeo = new THREE.CylinderGeometry(0.045, 0.1, 1.05, 6).translate(0, -0.525, 0), fingGeo = new THREE.OctahedronGeometry(1, 0).scale(0.05, 0.32, 0.03).translate(0, -0.3, 0);
  for (let side = -1; side <= 1; side += 2) {
    const sh = new THREE.Group(); sh.position.set(side * 0.85, 3.5, 0); V.add(sh); add(upGeo, 0, 0, 0, 0, 0, 0, sh);
    const el = new THREE.Group(); el.position.set(0, -1.15, 0); sh.add(el); add(foGeo, 0, 0, 0, 0, 0, 0, el);
    for (let f = -1; f <= 1; f++) add(fingGeo, 0, -1.05, 0, f * 0.15, 0, f * 0.35 * side, el);
    B2.arms.push({ sh, el, side });
  }
  // shard hair
  const NH = 40; const hairGeo = new THREE.OctahedronGeometry(1, 0).scale(0.075, 0.5, 0.035).translate(0, -0.5, 0);
  B2.hair = new THREE.InstancedMesh(hairGeo, vm, NH); B2.hair.instanceMatrix.setUsage(THREE.DynamicDrawUsage); B2.hair.frustumCulled = false; V.add(B2.hair);
  for (let i = 0; i < NH; i++) { const ph = (i / (NH - 1) - 0.5) * 2.9; B2.hairData.push({ ph, len: 1.5 + frand() * 1.5 + (1 - Math.abs(ph) / 1.45) * 0.8, tilt: 0.2 + frand() * 0.25, sp: frand() * 6 }); }
  // heart core + halo
  B2.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 1.3) })); B2.core.position.set(0, 3.2, 0.5); V.add(B2.core);
  B2.haloU = { uCol: { value: new THREE.Color(0.4, 1.6, 0.8) }, uA: { value: 1 }, uTime: { value: 0 } };
  B2.halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: B2.haloU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA,uTime; varying vec2 vUv; void main(){ vec2 p=vUv*2.0-1.0; float r=length(p); float a=atan(p.y,p.x);
      float rays = pow(abs(sin(a*4.0+uTime*0.4)),24.0)*exp(-r*2.2)*0.8 + pow(abs(sin(a*3.0-uTime*0.25)),40.0)*exp(-r*1.6)*0.5;
      float g = exp(-r*r*9.0)*1.3 + exp(-r*4.0)*0.35 + rays; gl_FragColor = vec4(uCol*g*uA*smoothstep(1.0,0.7,r), 1.0); }`,
  }));
  B2.halo.scale.setScalar(2.8); B2.halo.renderOrder = 17; g.add(B2.halo);
  V.scale.setScalar(B2.sc);

  // ================= SAPLINGS (pool 6) =================
  const spGeo = new THREE.ConeGeometry(0.2, 1.4, 5).translate(0, 0.7, 0);
  for (let i = 0; i < 6; i++) {
    const u = { uTime: B2.vU.uTime, uCol: { value: new THREE.Color(0.25, 1, 0.5) }, uCore: { value: new THREE.Color(0.6, 2, 0.9) }, uFlash: { value: 0 }, uCrack: { value: 0 }, uFracture: { value: 0 }, uWhite: { value: 0 }, uDark: { value: 0 } };
    const m = b2CrystalMat(u); const sg = new THREE.Group();
    const spec = [[0, 0, 0, 1.3, 0, 0], [0.28, 0, 0.1, 0.8, 0.35, 0.2], [-0.25, 0, 0.15, 0.9, -0.3, -0.15], [0.05, 0, -0.28, 0.7, 0.1, -0.4]];
    for (const [x, y, z, s, rz, rx] of spec) { const c = new THREE.Mesh(spGeo, m); c.position.set(x, y, z); c.scale.set(s, s, s); c.rotation.set(rx, 0, rz); sg.add(c); }
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 1.2) })); cr.position.y = 0.9; sg.add(cr);
    sg.visible = false; g.add(sg);
    const bm = new THREE.Mesh(beamGeo, beamMatBase.clone()); bm.visible = false; bm.renderOrder = 16; bm.frustumCulled = false; g.add(bm); bm.material.uniforms.uCol.value.setRGB(0.25, 1.0, 0.45);
    const s = { g: sg, u, alive: false, hp: 220, x: 0, z: 0, grow: 0, sporeT: 0, healT: 0, pulse: 0, beam: { m: bm, u: bm.material.uniforms } };
    s.tgt = { x: 0, y: 0.8, z: 0, r: 0.75, hy: 1.4, alive: false, priority: true, isBoss: false, lanceMul: 1.62, hit: (d, c, src) => b2SapHit(s, d, c, src) };
    B2.saps.push(s); B2.precomp.push(sg, bm);
  }
  // seeds (homing projectiles tracked here)
  for (let i = 0; i < 8; i++) { const s = { active: false, i: 0, t: 0, state: 0, k: 0, sx: 0, sz: 0, tx: 0, tz: 0, tele: null }; s.cb = () => { }; s.onRes = () => b2SeedLand(s); B2.seeds.push(s); }

  // ================= BLOOM SHIELD PETALS =================
  B2.bud = new THREE.Group(); g.add(B2.bud);
  const pp = []; for (let k = 0; k <= 16; k++) { const t = k / 16; pp.push(new THREE.Vector2(2.5 * Math.pow(Math.sin(Math.PI * (0.06 + 0.86 * t) + 0.04), 0.8) * (1 - 0.22 * t) + 0.12, t * 5.8)); }
  const r0 = pp[0].x;
  for (let i = 0; i < 3; i++) {
    const mid = i * TAU / 3 + Math.PI / 3, len = TAU / 3 - 0.14;
    const geo = new THREE.LatheGeometry(pp, 12, mid - len / 2, len).translate(-Math.sin(mid) * r0, 0, -Math.cos(mid) * r0);
    const u = { uTime: B2.vU.uTime, uCol: { value: new THREE.Color(0.7, 1.0, 0.85) }, uCrack: { value: 0 }, uFlash: { value: 0 }, uA: { value: 1 } };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vO; void main(){ vUv=uv; vO=position; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: GLSL_LIB + /* glsl */`uniform float uTime,uCrack,uFlash,uA; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vO;
        vec2 vor(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8.0, d2=8.0; for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=vec2(hash12(i+g), hash12(i+g+17.0)); vec2 r=g+o-f; float d=dot(r,r); if(d<d1){d2=d1; d1=d;} else if(d<d2) d2=d; } return vec2(sqrt(d1), sqrt(d2)); }
        void main(){ float fr = pow(1.0-abs(dot(normalize(vN), normalize(vV))), 1.6);
          float ex = min(vUv.x, 1.0-vUv.x); float dash = step(0.45, fract(vUv.y*9.0 - uTime*1.2));
          float edge = smoothstep(0.05, 0.0, ex)*dash + smoothstep(0.03,0.0,vUv.y)*0.6;
          float rib = smoothstep(0.025, 0.0, abs(vUv.x-0.5))*(1.0-vUv.y*0.6);
          float vein = smoothstep(0.02,0.0,abs(fract(vUv.x*6.0 + vUv.y*1.5)-0.5)-0.46)*0.4;
          vec2 vr = vor(vO.xy*1.6 + vO.z*0.9); float ce = smoothstep(0.08, 0.0, vr.y-vr.x)*step(vr.x, uCrack*1.2);
          vec3 c = uCol*(0.025 + fr*0.38 + rib*0.35 + vein*0.12) + mix(uCol, vec3(1.0), 0.6)*edge*0.9 + vec3(1.6,1.8,2.0)*ce*uCrack;
          c = mix(c, vec3(2.5), uFlash*0.6);
          gl_FragColor = vec4(c*uA, 1.0); }`,
    }));
    mesh.renderOrder = 13;
    const pivot = new THREE.Group(); pivot.position.set(Math.sin(mid) * r0, 0, Math.cos(mid) * r0); pivot.add(mesh); pivot.visible = false; B2.bud.add(pivot);
    const p = { pivot, mesh, u, mid, alive: false, hp: 300, open: 1.4, openT: 0.06, rise: 0, axis: new THREE.Vector3(Math.cos(mid), 0, -Math.sin(mid)) };
    p.tgt = { x: 0, y: 2.6, z: 0, r: 1.0, hy: 2.6, alive: false, priority: true, isBoss: false, lanceMul: 2.16, hit: (d, c, src) => b2PetalHit(p, d, c, src) };
    B2.petals.push(p); B2.precomp.push(pivot);
  }
  // ================= SOAK TOWER =================
  B2.towerU = { uTime: B2.vU.uTime, uA: { value: 0 }, uK: { value: 0 } };
  B2.tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0), new THREE.ShaderMaterial({
    uniforms: B2.towerU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime,uA,uK; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float fr = pow(1.0-abs(dot(normalize(vN),normalize(vV))), 2.0); float g = pow(1.0-vUv.y, 1.3)*(0.35+fr*1.6);
      float s = 0.6+0.4*sin(vUv.x*6.2832*7.0 + uTime*3.0 - vUv.y*9.0);
      float lvl = exp(-pow((vUv.y - uK*0.35)*18.0, 2.0));
      vec3 c = vec3(1.0,0.96,0.82)*(g*(0.3+0.8*uK)*s + lvl*1.2*uK);
      gl_FragColor = vec4(c*uA, 1.0); }`,
  }));
  B2.tower.scale.set(2, 10, 2); B2.tower.visible = false; B2.tower.renderOrder = 8; g.add(B2.tower);
  B2.seedOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.5, 1.8) })); B2.seedOrb.visible = false; g.add(B2.seedOrb);
  B2.precomp.push(B2.tower, B2.seedOrb);
  // ================= THORN RING =================
  B2.spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 1.7, 5).translate(0, 0.85, 0), pjMat, 60);
  for (let i = 0; i < 60; i++) B2.spikes.setColorAt(i, _col.setRGB(1.0, 0.12, 0.22).multiplyScalar(0.8 + frand() * 0.5));
  B2.spikes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); B2.spikes.frustumCulled = false; B2.spikes.visible = false; g.add(B2.spikes);
  B2.spikeH = new Float32Array(60).map(() => 0.6 + Math.random() * 0.9);
  B2.ringGlow = new THREE.Mesh(ringGeo, ringMatBase.clone()); B2.ringGlow.visible = false; B2.ringGlow.renderOrder = 15; B2.ringGlow.frustumCulled = false; g.add(B2.ringGlow);
  B2.ringGlow.material.uniforms.uCol.value.setRGB(1.3, 0.12, 0.25);
  B2.precomp.push(B2.spikes, B2.ringGlow);
  g.visible = false;
}
function b2TilesReset() {
  const arr = B2.tileMesh.instanceMatrix.array;
  for (let i = 0; i < B2.NT; i++) {
    B2.tState[i] = 0; B2.tErupt[i] = -1; B2.tY[i] = 0; B2.tVY[i] = 0; B2.tAng[i] = 0; B2.tGlow[i] = 0;
    const o = i * 16; for (let k = 0; k < 16; k++) arr[o + k] = 0; arr[o] = arr[o + 5] = arr[o + 10] = arr[o + 15] = 1; arr[o + 12] = B2.tx[i]; arr[o + 13] = B2.ty0[i]; arr[o + 14] = B2.tz[i];
  }
  B2.tileMesh.instanceMatrix.needsUpdate = true;
}
function b2TreeReset() {
  const arr = B2.brMesh.instanceMatrix.array;
  const ja = B2.brJoint.instanceMatrix.array;
  B2.brData.forEach((b, i) => { _q.setFromUnitVectors(_v1.set(0, 1, 0), b.d); _m4.compose(b.s, _q, _s.set(b.rad, b.len, b.rad)); _m4.toArray(arr, i * 16); b.gone = false;
    const jr = b.depth === 0 ? 0 : b.rad * 1.05; _m4.compose(b.s, _q, _s.set(jr, jr * 0.9, jr)); _m4.toArray(ja, i * 16); });
  B2.brMesh.instanceMatrix.needsUpdate = true; B2.brJoint.instanceMatrix.needsUpdate = true; B2.brokeTree = false;
}
function b2SplitTree(nx, nz, fxOn) {
  const arr = B2.brMesh.instanceMatrix.array; let n = 0;
  B2.brData.forEach((b, i) => {
    if (b.depth === 0) return; const mx = (b.s.x + b.e.x) / 2, mz = (b.s.z + b.e.z) / 2;
    if (mx * nx + mz * nz > 0.3) { b.gone = true; for (let k = 0; k < 16; k++) { arr[i * 16 + k] = 0; B2.brJoint.instanceMatrix.array[i * 16 + k] = 0; } B2.brJoint.instanceMatrix.needsUpdate = true; if (fxOn && n++ % 2 === 0) shatter((b.s.x + b.e.x) / 2, (b.s.y + b.e.y) / 2, (b.s.z + b.e.z) / 2, b.len * 0.3, 3, 0.7, 0.4, 1.4, 9, 2.2, 9); }
  });
  B2.brMesh.instanceMatrix.needsUpdate = true; B2.brokeTree = true;
}
function b2EruptLine(x0, z0, x1, z1, w) {
  const t = fx.simTime, dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1;
  for (let i = 0; i < B2.NT; i++) {
    if (!B2.tPlay[i] || B2.tState[i]) continue;
    const d = segDist(B2.tx[i], B2.tz[i], x0, z0, x1, z1);
    if (d < w * 0.5 + 0.45) { const along = ((B2.tx[i] - x0) * dx + (B2.tz[i] - z0) * dz) / L; B2.tErupt[i] = t + Math.max(0, along) / 38; }
  }
}
function b2DropHalf(nx, nz, off, instant) {
  const t = fx.simTime; const arr = B2.tileMesh.instanceMatrix.array;
  for (let i = 0; i < B2.NT; i++) {
    const s = B2.tx[i] * nx + B2.tz[i] * nz; if (s <= off) continue;
    if (instant) { B2.tState[i] = 3; for (let k = 0; k < 16; k++) arr[i * 16 + k] = 0; continue; }
    B2.tState[i] = 1; B2.tFallAt[i] = t + clamp((s - off) / 20, 0, 1) * 1.2 + frand() * 0.25; B2.tY[i] = 0; B2.tAng[i] = 0;
  }
  B2.tileMesh.instanceMatrix.needsUpdate = true;
}
function b2UpdateTiles(dt) {
  const t = fx.simTime, D = B2.tDyn, arr = B2.tileMesh.instanceMatrix.array; let mDirty = false;
  const rip = B2.rippleT, intro = B2.introT;
  for (let i = 0; i < B2.NT; i++) {
    const st = B2.tState[i];
    if (st === 3) { D[i * 3] = 0; D[i * 3 + 1] = 0; continue; }
    let y = Math.sin(t * 0.9 + B2.tSeed[i] * 6.28) * 0.03, glow = B2.tGlow[i];
    if (glow > 0) B2.tGlow[i] = Math.max(0, glow - dt * 1.5);
    const e = B2.tErupt[i];
    if (e >= 0) { const k = (t - e) / 0.6; if (k >= 1) B2.tErupt[i] = -1; else if (k > 0) { y += 2.2 * (k < 0.16 ? easeOut(k / 0.16) : 1 - smooth((k - 0.16) / 0.84)); glow += (1 - k) * 0.9; } }
    if (rip >= 0) { const d = B2.td[i]; const env = clamp(rip * 2, 0, 1) * Math.max(0, 1 - rip / 2.4); const w = Math.sin(d * 1.2 + Math.atan2(B2.tz[i], B2.tx[i]) * 2 - rip * 10); y += w * 0.6 * env; glow += Math.max(0, w) * env * 0.9; }
    if (intro >= 0) { const k = clamp((intro - 0.1 - B2.td[i] * 0.065) / 0.75, 0, 1); y -= 10 * (1 - easeOut(k)); if (k > 0 && k < 1) glow += (1 - k) * 1.6; }
    if (st === 1) {
      if (t >= B2.tFallAt[i]) { B2.tState[i] = 2; B2.tVY[i] = -0.5 - frand() * 2; }
      else { y += (frand() - 0.5) * 0.08; glow += 0.9; }
    }
    if (B2.tState[i] === 2) {
      B2.tVY[i] -= 24 * dt; B2.tY[i] += B2.tVY[i] * dt; B2.tAng[i] += B2.tW[i] * dt;
      const o = i * 16;
      if (B2.tY[i] < -45) { B2.tState[i] = 3; for (let k = 0; k < 16; k++) arr[o + k] = 0; }
      else { _q.setFromAxisAngle(_v1.set(B2.tAx[i], 0, B2.tAz[i]), B2.tAng[i]); _v2.set(B2.tx[i], B2.ty0[i] + B2.tY[i], B2.tz[i]); _m4.compose(_v2, _q, _s.set(1, 1, 1)); _m4.toArray(arr, o); }
      mDirty = true; y = 0; glow += 0.6;
    }
    D[i * 3] = y; D[i * 3 + 1] = glow;
  }
  B2.tDynA.needsUpdate = true; if (mDirty) B2.tileMesh.instanceMatrix.needsUpdate = true;
}
// ---- palette ----
function b2SetPal(name, sweep, cx = 0, cz = 0) {
  const P = B2PAL[name], U = B2.colU; B2.pal = name;
  if (sweep) { U.uEdgeB.value.setRGB(P.edge[0], P.edge[1], P.edge[2]); U.uPalR.value = 0.01; U.uPalC.value.set(cx, cz); B2.palT = 0; }
  else {
    U.uEdgeA.value.setRGB(P.edge[0], P.edge[1], P.edge[2]); U.uEdgeB.value.copy(U.uEdgeA.value); U.uPalR.value = 0; B2.palT = -1;
    B2.vU.uCol.value.setRGB(P.body[0], P.body[1], P.body[2]); B2.vU.uCore.value.setRGB(P.core[0], P.core[1], P.core[2]); B2.brU.uCol.value.copy(B2.vU.uCol.value);
    B2.leafU.uCol.value.setRGB(P.leaf[0], P.leaf[1], P.leaf[2]); U.uFog.value.setRGB(P.fog[0], P.fog[1], P.fog[2]);
    floorU.uTint.value.setRGB(P.void[0], P.void[1], P.void[2]); floorU.uTint2.value.setRGB(P.void[0], P.void[1], P.void[2]);
  }
}
function b2DampCol(c, a, k) { c.r += (a[0] - c.r) * k; c.g += (a[1] - c.g) * k; c.b += (a[2] - c.b) * k; }
// ---- seeds & saplings ----
function b2Seed(ang) {
  let s = null; for (let k = 0; k < B2.seeds.length; k++) if (!B2.seeds[k].active) { s = B2.seeds[k]; break; } if (!s) return;
  const x = B2.vx + Math.cos(ang) * 1.6, z = B2.vz + Math.sin(ang) * 1.6;
  const i = shoot(x, z, ang, 4.0 * DIFF[1].spd, G, 0.5, 12, 60, F_HOME); PJ.turn[i] = 1.2; PJ.y[i] = 1.3;
  PJ.onLand[i] = s.cb; s.i = i; s.t = 0; s.state = 0; s.k = 0; s.active = true; s.tele = null;
}
function b2SeedLand(s) {
  if (s.active && PJ.alive[s.i] && PJ.onLand[s.i] === s.cb) pjKill(s.i, false);
  s.active = false; s.tele = null;
  ring(s.tx, 0.08, s.tz, 0.2, 2.2, 0.45, 0.2, 0.4, 2.2, 0.9, 1.2); burst(s.tx, 0.4, s.tz, 24, 0.5, 2.4, 1.0, 6, 0.6, 0.18, 0.6, 0);
  b2SpawnSapling(s.tx, s.tz);
}
function b2UpdateSeeds(dt) {
  for (let k = 0; k < B2.seeds.length; k++) {
    const s = B2.seeds[k]; if (!s.active) continue; const i = s.i;
    if (!PJ.alive[i] || PJ.onLand[i] !== s.cb) { s.active = false; if (s.tele) { teleCancel(s.tele); s.tele = null; } continue; }
    s.t += dt;
    if (frand() < 0.5) emitP(PJ.x[i], PJ.y[i], PJ.z[i], (frand() - 0.5) * 0.6, frand() * 0.8, (frand() - 0.5) * 0.6, 0.6, 2.4, 1.0, 0.5, 0.2, 4);
    if (s.state === 0) {
      if (s.t >= 3.4) {
        s.state = 1; s.k = 0; const sp = Math.hypot(PJ.vx[i], PJ.vz[i]) || 1;
        _v2a.set(PJ.x[i] + PJ.vx[i] / sp * 1.6, PJ.z[i] + PJ.vz[i] / sp * 1.6); b2Clamp(_v2a); s.tx = _v2a.x; s.tz = _v2a.y;
        PJ.fl[i] = (PJ.fl[i] | F_NOHIT) & ~F_HOME; PJ.vx[i] = PJ.vz[i] = 0; s.sx = PJ.x[i]; s.sz = PJ.z[i];
        s.tele = teleCircle(s.tx, s.tz, 1.2, DIFF[1].windup, 12, G, { onResolve: s.onRes });
      }
    } else {
      s.k = Math.min(1, s.k + dt / DIFF[1].windup); const e = smooth(s.k);
      PJ.x[i] = lerp(s.sx, s.tx, e); PJ.z[i] = lerp(s.sz, s.tz, e); PJ.y[i] = 1.3 + Math.sin(Math.PI * s.k) * 2.4 - s.k * 1.1;
    }
  }
}
function b2SpawnSapling(x, z) {
  let alive = 0, s = null; for (const o of B2.saps) { if (o.alive) alive++; else if (!s) s = o; }
  if (alive >= 4 || !s) return;
  s.alive = true; s.hp = 220; s.x = x; s.z = z; s.grow = 0; s.sporeT = 1.6; s.healT = 4; s.u.uFlash.value = 1; s.u.uCrack.value = 0;
  s.g.position.set(x, -0.05, z); s.g.visible = true; s.beam.m.visible = true; s.tgt.alive = true; s.tgt.x = x; s.tgt.z = z;
  sfx.chime(4, 0.7);
  ui.tutorial('sapling', 'Saplings HEAL Veyra — destroy them!  (one Lance each)');
}
function b2SapHit(s, d, crit, src) {
  if (!s.alive || game.state !== 'fight') return;
  s.hp -= d; s.u.uFlash.value = 0.45; s.u.uCrack.value = clamp(1 - s.hp / 220, 0, 1);
  if (src !== 'bolt') dmgNumber(s.x, 1.9, s.z, String(Math.round(d)), crit ? 1 : 0); else if (frand() < 0.3) burst(s.x, 0.9, s.z, 3, 0.6, 2.2, 1, 3, 0.3, 0.12, 1, 0);
  if (s.hp <= 0) { b2KillSap(s, true); addRadiance(5); streakToPlayer(s.x, 0.9, s.z, W, 6); dmgNumber(s.x, 2.4, s.z, '+RADIANCE', 4, '#fff3c0'); }
}
function b2KillSap(s, withFx) {
  if (!s.alive) return; s.alive = false; s.tgt.alive = false; s.g.visible = false; s.beam.m.visible = false;
  if (withFx) { shatter(s.x, 0.8, s.z, 0.5, 18, 0.4, 2.2, 0.9, 6, 1.4, 9); burst(s.x, 0.8, s.z, 30, 0.5, 2.4, 1.0, 7, 0.7, 0.2, 1, 0); ring(s.x, 0.08, s.z, 0.2, 2.4, 0.4, 0.2, 0.5, 2.4, 1.0, 1.2); sfx.shatter(0.45); }
}
function b2UpdateSaps(dt, fighting) {
  const t = fx.simTime;
  for (const s of B2.saps) {
    if (!s.alive) continue;
    s.grow = Math.min(1, s.grow + dt / 0.8); const gs = easeOut(s.grow) * (1 + Math.sin(t * 3 + s.x) * 0.03);
    s.g.scale.setScalar(Math.max(0.01, gs)); s.g.rotation.y += dt * 0.4;
    if (s.u.uFlash.value > 0) s.u.uFlash.value = Math.max(0, s.u.uFlash.value - dt * 4);
    s.pulse = Math.max(0, s.pulse - dt * 1.5);
    if (fighting) {
      s.sporeT -= dt; if (s.sporeT <= 0) { s.sporeT = 3.5; patRing(s.x, s.z, 10, 4.5 * DIFF[1].spd, G, 0.3, 8, rng() * TAU); sfx.shot(G); ring(s.x, 0.1, s.z, 0.2, 1.8, 0.35, 0.15, 0.4, 2.2, 0.9, 1); }
      s.healT -= dt;
      if (s.healT <= 0) {
        s.healT = 4; s.pulse = 1;
        const b = bossRT; if (!b.dead && !b.transitioning) { const h = 0.01 * b.maxHp; b.hp = Math.min(b.maxHp, b.hp + h); dmgNumber(bossTarget.x, bossTarget.y + 1.6, bossTarget.z, '+' + Math.round(h), 3); }
        for (let k = 0; k < 10; k++) { const u = k / 10; emitP(lerp(s.x, B2.vx, u * 0.2), 1.2, lerp(s.z, B2.vz, u * 0.2), (B2.vx - s.x) / 0.7, (B2.hy - 1.2) / 0.7, (B2.vz - s.z) / 0.7, 0.6, 2.6, 1.0, 0.7, 0.25, 4); }
      }
    }
    beamSet(s.beam, s.x, 1.0 * gs + 0.1, s.z, B2.vx, B2.hy, B2.vz, 0.05 + s.pulse * 0.12);
    s.beam.u.uTime.value = t; s.beam.u.uA.value = (0.35 + s.pulse * 1.2) * s.grow;
  }
}
// ---- bloom shield ----
function b2BloomStart(dur) {
  const b = B2.bloom; if (b.active) return; b.active = true; b.t = 0; b.dur = dur; b.fade = 0;
  castBar('Shatterbloom', dur, true); bossRT.shieldMul = 0.25;
  B2.bud.position.set(B2.vx, 0, B2.vz);
  for (const p of B2.petals) { p.alive = true; p.hp = 300; p.open = 1.5; p.openT = 0.05; p.rise = 0; p.pivot.visible = true; p.tgt.alive = true; p.u.uCrack.value = 0; p.u.uA.value = 1; p.u.uFlash.value = 1; p.u.uCol.value.copy(B2.colU.uEdgeA.value).lerp(_col.setRGB(1, 1, 1), 0.3); }
  if (B2.firstBloom) { B2.firstBloom = false; ui.toast('BREAK THE PETALS (Lance) — or shelter in your Lattice', 3.6, true); }
  sfx.choir(1); bloomSpike(0.6); ring(B2.vx, 0.1, B2.vz, 0.5, 4, 0.6, 0.3, 1.6, 2.2, 2.0, 1.2);
}
function b2PetalHit(p, d, crit, src) {
  if (!p.alive || game.state !== 'fight') return;
  p.hp -= d; p.u.uFlash.value = 0.7; p.u.uCrack.value = clamp(1 - p.hp / 300, 0, 1);
  if (src !== 'bolt') dmgNumber(p.tgt.x, 3.2, p.tgt.z, String(Math.round(d)), crit ? 1 : 0, '#e8fff2');
  if (p.hp <= 0) b2BreakPetal(p, true);
}
function b2BreakPetal(p, withFx) {
  if (!p.alive) return; p.alive = false; p.tgt.alive = false; p.pivot.visible = false;
  if (withFx) { shatter(p.tgt.x, 2.4, p.tgt.z, 1.4, 40, 1.5, 2.2, 1.8, 8, 1.8, 9); burst(p.tgt.x, 2.4, p.tgt.z, 50, 1.8, 2.4, 2.0, 9, 0.8, 0.22, 1, 0); sfx.shatter(0.8); addTrauma(0.25); bloomSpike(0.5); }
}
function b2BloomEnd() { const b = B2.bloom; b.active = false; bossRT.shieldMul = 1; if (bossRT.cast.active && bossRT.cast.name === 'Shatterbloom') bossRT.cast.active = false; }
function b2BloomBroken() {
  b2BloomEnd(); for (const p of B2.petals) p.pivot.visible = false;
  bossRT.stagger = 3; bossRT.staggerMul = 1.5; bossAddFracture(30); b2RingReset();
  ui.toast('STAGGERED — ×1.5 DAMAGE', 1.8, true); hitstop(0.12); sfx.boom(); B2.vU.uFlash.value = 1; bloomSpike(1.0); addTrauma(0.4);
  burst(B2.vx, B2.hy, B2.vz, 80, 1.6, 2.4, 1.8, 12, 1.0, 0.25, 1, 0);
}
function b2BloomBlast() {
  const b = B2.bloom; b2BloomEnd(); b.fade = 0.7;
  for (const p of B2.petals) { if (p.alive) { p.openT = 2.0; p.u.uFlash.value = 1; } p.tgt.alive = false; }
  const x = B2.vx, z = B2.vz;
  ring(x, 0.25, z, 1, 32, 1.2, 1.0, 1.6, 2.4, 1.6, 1.5); ring(x, 1.5, z, 0.5, 18, 0.8, 0.5, 2.4, 2.4, 2.4, 1.2);
  burst(x, 2.5, z, 140, 1.4, 2.6, 1.6, 20, 1.4, 0.28, 1, 0); bloomSpike(1.3); addTrauma(0.8); shockAt(x, 2, z, 0.07); sfx.boom(); sfx.shatter(1.2); rainbowWave(x, z, 0.8, 22);
  if (player.alive && game.state === 'fight') {
    const inLat = lattice.active && Math.hypot(player.x - lattice.x, player.z - lattice.z) < lattice.r;
    if (inLat) { dmgNumber(player.x, 2.6, player.z, 'SHELTERED', 4, '#7dffa8'); ring(lattice.x, 0.2, lattice.z, lattice.r * 0.9, lattice.r * 1.1, 0.5, 0.3, 0.4, 2.6, 1.0, 1.6); }
    else if (!debug.god && player.invuln <= 0) { hitSrc = 'shatterbloom'; damagePlayer(45, G); }
  }
}
function b2UpdateBloom(dt, fighting) {
  const b = B2.bloom;
  if (b.active && fighting) {
    b.t += dt;
    let alive = 0; for (const p of B2.petals) if (p.alive) alive++;
    if (alive === 0) b2BloomBroken();
    else if (b.t >= b.dur) b2BloomBlast();
    else {
      const k = b.t / b.dur; B2.vU.uFlash.value = Math.max(B2.vU.uFlash.value, k > 0.75 ? 0.15 + 0.15 * Math.sin(fx.simTime * 30) : 0);
      if (frand() < 0.3 + k) { const a = frand() * TAU, r = 3 + frand() * 6; emitP(B2.vx + Math.cos(a) * r, 0.3 + frand() * 3, B2.vz + Math.sin(a) * r, -Math.cos(a) * r * 0.9, 1, -Math.sin(a) * r * 0.9, 1.4, 2.4, 1.6, 0.9, 0.16, 4); }
    }
  }
  if (b.fade > 0) { b.fade -= dt; for (const p of B2.petals) { p.u.uA.value = Math.max(0, b.fade / 0.7); if (b.fade <= 0) { p.alive = false; p.pivot.visible = false; } } }
  for (const p of B2.petals) {
    if (!p.pivot.visible) continue;
    p.rise = Math.min(1, p.rise + dt * 1.8); p.open = damp(p.open, p.openT, p.openT > 1 ? 9 : 3.5, dt);
    p.pivot.scale.set(1, Math.max(0.01, easeOut(p.rise)), 1); p.pivot.quaternion.setFromAxisAngle(p.axis, p.open + Math.sin(fx.simTime * 1.4 + p.mid) * 0.02);
    if (p.u.uFlash.value > 0) p.u.uFlash.value = Math.max(0, p.u.uFlash.value - dt * 3);
    p.tgt.x = B2.bud.position.x + Math.sin(p.mid) * 2.2; p.tgt.z = B2.bud.position.z + Math.cos(p.mid) * 2.2;
  }
}
// ---- soak tower ----
function b2SoakResolve(ok) {
  const s = B2.soak; s.active = false; s.fade = 0.8; B2.seedOrb.visible = false;
  if (ok && s.inT >= 0.75) {
    addRadiance(15); bossRT.stagger = Math.max(bossRT.stagger, 2.5); bossRT.staggerMul = Math.max(bossRT.staggerMul, 1.5); bossAddFracture(15);
    beam(s.x, 1.4, s.z, B2.vx, B2.hy, B2.vz, 0.35, 0.6, 1.4, 1.4, 1.1, 0, 1.4);
    burst(s.x, 1.4, s.z, 60, 2.4, 2.4, 1.8, 9, 0.9, 0.22, 1, 0); streakToPlayer(s.x, 1.4, s.z, G, 10); streakToPlayer(s.x, 1.4, s.z, R, 10);
    dmgNumber(player.x, 2.7, player.z, 'SEED CLAIMED', 4, '#fff3c0'); B2.vU.uFlash.value = 1; bloomSpike(1.0); sfx.victoryStab(); sfx.perfect(G, 4);
  } else {
    const h = 0.04 * bossRT.maxHp; bossRT.hp = Math.min(bossRT.maxHp, bossRT.hp + h); dmgNumber(bossTarget.x, bossTarget.y + 1.6, bossTarget.z, '+' + Math.round(h), 3);
    patRing(B2.vx, B2.vz, 32, 6 * DIFF[1].spd, G, 0.32, 10, rng() * TAU); sfx.shot(G); sfx.boom();
    beam(s.x, 1.4, s.z, B2.vx, B2.hy, B2.vz, 0.3, 0.6, 0.4, 2.4, 0.9, 0, 1.2); ring(B2.vx, 0.3, B2.vz, 0.5, 6, 0.6, 0.3, 0.4, 2.4, 1, 1.4);
    ui.toast('VEYRA DRINKS THE SEED', 1.6, true);
  }
}
function b2UpdateSoak(dt) {
  const s = B2.soak;
  if (s.active) {
    s.t += dt; const inside = player.alive && Math.hypot(player.x - s.x, player.z - s.z) < 2.0;
    if (s.t > 3.0 && inside) s.inT += dt;
    B2.towerU.uK.value = clamp(s.t / 4, 0, 1); B2.towerU.uA.value = Math.min(1, s.t / 0.3) * (inside ? 1.3 : 1);
    B2.seedOrb.position.set(s.x, 1.4 + Math.sin(fx.simTime * 2.5) * 0.15, s.z); B2.seedOrb.rotation.y += dt * 2; B2.seedOrb.rotation.x += dt * 0.7;
    if (frand() < 0.5) { const a = frand() * TAU; emitP(s.x + Math.cos(a) * 1.9, 0.1, s.z + Math.sin(a) * 1.9, 0, 1.5 + frand() * 2, 0, 1.6, 1.6, 1.3, 1.0, 0.13, 4); }
  } else if (s.fade > 0) { s.fade -= dt; B2.towerU.uA.value = Math.max(0, s.fade / 0.8) * 2; if (s.fade <= 0) B2.tower.visible = false; }
}
// ---- thorn ring ----
function b2RingReset() {
  if (!B2.ringOn) return; B2.ringReset = 0.8; B2.ringFrom = B2.ringR;
  ring(B2.vx, 0.3, B2.vz, B2.ringR, Math.min(16, B2.ringR + 5), 0.6, 0.4, 2.4, 0.4, 0.6, 1.4); sfx.shatter(0.5); ui.toast('THE THORNS RECEDE', 1.4);
}
function b2UpdateRing(dt, fighting) {
  if (!B2.ringOn) return;
  if (B2.ringReset > 0) { B2.ringReset -= dt; B2.ringR = lerp(B2.ringFrom, 14, easeOut(1 - B2.ringReset / 0.8)); }
  else if (fighting) B2.ringR = Math.max(7.5, B2.ringR - 0.22 * dt);
  if (bossRT.fracture >= 100 && !B2.fracFlag) { B2.fracFlag = true; b2RingReset(); } else if (bossRT.fracture < 100) B2.fracFlag = false;
  const vul = bossRT.vuln > 0; if (vul && !B2.vulnPrev) b2RingReset(); B2.vulnPrev = vul;
  const cx = B2.vx, cz = B2.vz, Rr = B2.ringR; B2.ringA += dt * 0.12;
  const arr = B2.spikes.instanceMatrix.array, ac = game.arenaCut;
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * TAU + B2.ringA, x = cx + Math.cos(a) * Rr, z = cz + Math.sin(a) * Rr, o = i * 16;
    const ok = Math.hypot(x, z) < 15.6 && (!ac.on || x * ac.nx + z * ac.nz < ac.off + 0.3);
    if (!ok) { for (let k = 0; k < 16; k++) arr[o + k] = 0; continue; }
    const h = B2.spikeH[i] * (0.9 + 0.1 * Math.sin(fx.simTime * 3 + i));
    _e.set(Math.sin(a) * 0.25 * (i % 2 ? 1 : -0.6), 0, -Math.cos(a) * 0.25 * (i % 2 ? 1 : -0.6)); _q.setFromEuler(_e);
    _m4.compose(_v1.set(x, -0.1, z), _q, _s.set(1, h, 1)); _m4.toArray(arr, o);
  }
  B2.spikes.instanceMatrix.needsUpdate = true;
  const gu = B2.ringGlow.material.uniforms; gu.uR.value = Rr; gu.uTh.value = 0.3; gu.uOuter.value = Rr + 1.2; gu.uA.value = 0.9 + 0.3 * Math.sin(fx.simTime * 5);
  B2.ringGlow.position.set(cx, 0.07, cz); B2.ringGlow.scale.setScalar(Rr + 1.2);
  B2.colU.uRing.value.set(cx, cz, Rr, 1);
  // hazard
  B2.ringGrazeCD -= dt;
  if (fighting && player.alive) {
    const dx = player.x - cx, dz = player.z - cz, d = Math.hypot(dx, dz) || 1;
    const s = Rr - 0.35 - PLAYER.hurtR - d;
    if (s < 0) {
      hitSrc = 'thorns'; const res = resolveHazard(s, 0.8, R, 10, B2.ringGrazeCD <= 0);
      if (res === HZ_PERFECT) B2.ringGrazeCD = 1.0;
      if (res === HZ_HIT || (player.dashI <= 0 && d > Rr - 0.3 && B2.kbT <= 0)) { B2.kbT = 0.25; B2.kbX = -dx / d; B2.kbZ = -dz / d; if (res === HZ_HIT) burst(player.x, 1, player.z, 20, 2.6, 0.4, 0.5, 6, 0.4, 0.15, 1, 0); }
    } else if (s < 0.8 && B2.ringGrazeCD <= 0) { B2.ringGrazeCD = 1.2; resolveHazard(s, 0.8, R, 0, true); }
  }
  if (B2.kbT > 0) { B2.kbT -= dt; player.x += B2.kbX * 13 * dt; player.z += B2.kbZ * 13 * dt; }
}
function b2RingOn(on) {
  B2.ringOn = on; B2.spikes.visible = on; B2.ringGlow.visible = on; if (!on) B2.colU.uRing.value.w = 0;
  B2.ringR = 14; B2.ringReset = 0; B2.kbT = 0; B2.fracFlag = false; B2.vulnPrev = false;
}
// ---- uprooting (phase 3 setup) ----
function b2Uproot(instant) {
  let nx = -player.x, nz = -player.z; const l = Math.hypot(nx, nz); if (l < 0.5) { nx = 0; nz = -1; } else { nx /= l; nz /= l; }
  const ac = game.arenaCut; ac.on = true; ac.nx = nx; ac.nz = nz; ac.off = 1.0;
  b2DropHalf(nx, nz, 1.0, instant); b2SplitTree(nx, nz, !instant);
  const tx = -nx * 6.2, tz = -nz * 6.2;
  if (instant) { B2.vx = tx; B2.vz = tz; B2.move = null; } else B2.move = { t: 0, dur: 0.9, fx: B2.vx, fz: B2.vz, tx, tz };
  B2.brU.uDim.value = 0.45;
}
function b2Reset() {
  B2.vx = 0; B2.vz = 0.25; B2.move = null; B2.yaw = 0; B2.lift = 0; B2.armRaise = 0;
  b2TilesReset(); b2TreeReset(); B2.brU.uDim.value = 0; B2.brU.uWhite.value = 0; B2.brU.uFlash.value = 0;
  B2.vortex = B2.vortexTo = 0; B2.rippleT = -1; B2.introT = -1; B2.white = B2.whiteTo = 0; B2.collapse = B2.collapseTo = 0; B2.scatter = 0; B2.scatterOn = false;
  const L = B2.leafU; L.uVortex.value = 0; L.uCollapse.value = 0; L.uScatter.value = 0; L.uHide.value = 0; L.uCenter.value.set(0, 0, 0);
  const vu = B2.vU; vu.uWhite.value = 0; vu.uDark.value = 0; vu.uCrack.value = 0; vu.uFlash.value = 0; B2.veyra.visible = true; B2.halo.visible = true;
  b2SetPal('grove', false);
  for (const s of B2.saps) { s.alive = false; s.tgt.alive = false; s.g.visible = false; s.beam.m.visible = false; }
  for (const s of B2.seeds) { s.active = false; s.tele = null; }
  for (const p of B2.petals) { p.alive = false; p.tgt.alive = false; p.pivot.visible = false; }
  B2.bloom.active = false; B2.bloom.fade = 0; B2.soak.active = false; B2.soak.fade = 0; B2.tower.visible = false; B2.seedOrb.visible = false;
  b2RingOn(false); game.arenaCut.on = false; B2.firstBloom = true;
  for (const s of B2.saps) targets.push(s.tgt); for (const p of B2.petals) targets.push(p.tgt);
}
function b2ClearAdds(withFx) {
  for (const s of B2.saps) b2KillSap(s, withFx);
  for (const s of B2.seeds) { if (s.active && PJ.alive[s.i] && PJ.onLand[s.i] === s.cb) pjKill(s.i, withFx); s.active = false; if (s.tele) teleCancel(s.tele); s.tele = null; }
  if (B2.bloom.active) { for (const p of B2.petals) b2BreakPetal(p, withFx); b2BloomEnd(); }
  if (B2.soak.active) { B2.soak.active = false; B2.soak.fade = 0.5; B2.seedOrb.visible = false; }
}
function b2LineAttack(mode) {
  const n = mode === 1 ? 1 : 3, w = mode === 3 ? 1.1 : DIFF[1].windup, step = (mode === 3 ? 27 : 20) * Math.PI / 180;
  const lw = mode === 3 ? 1.6 : 2.0, lock = mode === 3 ? 0.35 : 0.5;
  castBar('Root Lash', w); B2.armT = w; sfx.growl();
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * step;
    const set = (o) => { const a = aimAt(B2.vx, B2.vz) + off, c = Math.cos(a), s = Math.sin(a); teleSetLine(o, B2.vx + c * 1.4, B2.vz + s * 1.4, B2.vx + c * 18, B2.vz + s * 18, lw); };
    const o = teleLine(0, 0, 1, 0, lw, w, 16, G, { lockAt: lock, follow: set, onResolve: b2LashResolve }); set(o);
  }
}
function b2LashResolve(o) {
  b2EruptLine(o.x, o.z, o.x1, o.z1, o.w);
  for (let j = 1; j <= 7; j++) { const u = j / 7, px = lerp(o.x, o.x1, u), pz = lerp(o.z, o.z1, u); if (!b2InArena(px, pz, -1)) continue; burst(px, 0.4, pz, 7, 0.7, 2.4, 1.3, 7, 0.6, 0.2, 0.3, 0, 1.2); if (j % 2) shatter(px, 0.4, pz, 0.3, 2, 0.8, 2.2, 1.2, 7, 1.0, 14); }
  addTrauma(0.22); sfx.swoop();
}
function b2LeafWall(life) {
  for (let i = 0; i <= PJ.hi; i++) if (PJ.alive[i] && (PJ.fl[i] & F_ORBIT)) pjKill(i, true);
  const mk = (rad, w, col) => {
    const slots = 20, g1 = Math.floor(rng() * slots), g2 = (g1 + 10) % slots, a0 = rng() * TAU;
    for (let k = 0; k < slots; k++) {
      const d1 = Math.min((k - g1 + slots) % slots, (g1 - k + slots) % slots), d2 = Math.min((k - g2 + slots) % slots, (g2 - k + slots) % slots); if (d1 <= 1 || d2 <= 1) continue;
      const a = a0 + k / slots * TAU; const i = shoot(Math.cos(a) * rad, Math.sin(a) * rad, 0, 0, col, 0.35, 10, life, F_ORBIT | F_HARMLESS);
      PJ.orR[i] = rad; PJ.orA[i] = a; PJ.orW[i] = w;
    }
  };
  mk(9.5, 0.35, G); mk(6, -0.45, Bc); sfx.swoop(); ring(0, 0.2, 0, 5.5, 10, 0.7, 0.3, 0.4, 2.2, 0.9, 1);
}
const BOSS2 = {
  id: 2, name: 'VEYRA, THE GLASS ORCHARD', subtitle: 'Second Refraction', deathTitle: 'VEYRA', deathSub: 'UNBOUND',
  arena: 1, arenaR: 15, maxHp: 22000, enrage: 270, hit: { x: 0, y: 3.4, z: 0.25, r: 2.2, hy: 3 },
  barGrad: 'linear-gradient(90deg,#1fd16a,#7dffb0 45%,#b98cff 75%,#ff5a86)', music: ['b2p1', 'b2p2', 'b2p3'],
  phases: [
    { name: 'Grove', until: 0.7, loop: 15, steps: [[0, 'Seedfall', 3], [5, 'RootLash', 0], [9, 'ThornVolley', 0], [12, 'PetalStorm']] },
    { name: 'Bloom', until: 0.35, loop: 22, steps: [[0, 'LeafWall', 10.4], [2, 'Shatterbloom', 9], [6, 'RootLash', 1], [10, 'LeafWall', 12.4], [14, 'Soak'], [17, 'Seedfall', 2], [19.5, 'ThornVolley', 0]] },
    { name: 'Thornheart', until: 0, loop: 13.5, steps: [[0, 'RootLash', 3], [3.8, 'RootLash', 0], [6.5, 'Seedfall', 3], [9, 'ThornVolley', 3], [11, 'BloomAlt']] },
  ],
  hue: [0.3, 1.0, 0.6],
  camTop() { return B2.hy + 2.0 * B2.sc; },
  build: buildBoss2, show(on) { B2.group.visible = on; },
  reset() { b2Reset(); },
  transitionInstant(n) {
    b2ClearAdds(false);
    if (n === 1) { B2.vortex = B2.vortexTo = 1; B2.leafU.uVortex.value = 1; b2SetPal('bloom', false); }
    if (n === 2) { b2Uproot(true); b2SetPal('thorn', false); b2RingOn(true); B2.vortex = B2.vortexTo = 1; }
  },
  onPhase(n) {
    if (n === 1) { ui.tutorial('leafwall', 'The leaf walls are harmless while faint — slip through the gaps'); }
    if (n === 2) { b2RingOn(true); ui.tutorial('thorns', 'The thorns close in — fill FRACTURE or VULNERABLE to push them back'); }
  },
  onInterrupt() { b2ClearAdds(true); },
  apPenalty(cx, cz) { // debug autopilot helper
    let p = 0; const ac = game.arenaCut; if (ac.on && cx * ac.nx + cz * ac.nz > ac.off - 1.6) p += 25;
    if (B2.ringOn && Math.hypot(cx - B2.vx, cz - B2.vz) > B2.ringR - 1.6) p += 25;
    if (B2.soak.active && B2.soak.t > 1.5) p += Math.max(0, Math.hypot(cx - B2.soak.x, cz - B2.soak.z) - 1.2) * 3;
    if (B2.bloom.active && B2.bloom.t > B2.bloom.dur - 2.5 && lattice.active) p += Math.max(0, Math.hypot(cx - lattice.x, cz - lattice.z) - lattice.r + 1) * 4;
    return p;
  },
  apHook() { if (B2.bloom.active && B2.bloom.t > B2.bloom.dur - 2.8 && !lattice.active && abilityReady('lattice')) useAbility('lattice'); if (abilityReady('lance') && (B2.bloom.active || B2.saps.some((s) => s.alive))) useAbility('lance'); },
  casts: {
    Seedfall(n = 3) {
      castBar(n >= 4 ? 'Seed Volley' : 'Seedfall', 1.0); B2.armT = 1.1; sfx.choir(2); B2.vU.uFlash.value = 0.4;
      after(0.9, () => { const a0 = aimAt(B2.vx, B2.vz); for (let k = 0; k < n; k++) b2Seed(a0 + (k - (n - 1) / 2) * 0.75 + (rng() - 0.5) * 0.25); sfx.shot(G); burst(B2.vx, B2.hy, B2.vz, 30, 0.6, 2.4, 1, 6, 0.6, 0.2, 1, 0); });
    },
    RootLash(mode = 0) { b2LineAttack(mode); },
    ThornVolley(mode = 0) {
      const n = mode === 3 ? 4 : 3, cnt = mode === 3 ? 7 : 5, spread = (mode === 3 ? 55 : 40) * Math.PI / 180;
      castBar('Thorn Volley', 0.4 * n + 0.4); B2.armT = 0.4 * n + 0.4; let vi = 0;
      every(0.4, n, () => { const a = aimAt(B2.vx, B2.vz), c = (++vi === n) ? Bc : R; patFan(B2.vx + Math.cos(a) * 1.5, B2.vz + Math.sin(a) * 1.5, a, cnt, spread, 9 * DIFF[1].spd, c, 0.26, 10); sfx.shot(c); burst(B2.vx + Math.cos(a) * 1.5, 1, B2.vz + Math.sin(a) * 1.5, 10, 2.6, 0.4, 0.5, 4, 0.3, 0.14, 1, 0); }, 0.25);
    },
    PetalStorm() { castBar('Petal Storm', 2.5); B2.armT = 2.5; patSpiral(B2.vx, B2.vz, 3, 8, 2.5, 11, 5 * DIFF[1].spd, G, 0.3, 10, rng() * TAU); },
    LeafWall(life = 10.4) { b2LeafWall(life); },
    Shatterbloom(dur = 10) { b2BloomStart(dur); },
    BloomAlt() { if (bossRT.loops % 2 === 0) b2BloomStart(7); },
    Soak() {
      const a = rng() * TAU, r = 7 + rng() * 3; _v2a.set(B2.vx + Math.cos(a) * r, B2.vz + Math.sin(a) * r); b2Clamp(_v2a);
      const s = B2.soak; s.active = true; s.x = _v2a.x; s.z = _v2a.y; s.t = 0; s.inT = 0; s.fade = 0;
      castBar('Seed of Renewal', 4, true);
      teleSoak(s.x, s.z, 2, 4, () => b2SoakResolve(true), () => b2SoakResolve(false));
      B2.tower.position.set(s.x, 0, s.z); B2.tower.visible = true; B2.seedOrb.visible = true; B2.towerU.uA.value = 0;
      ring(s.x, 0.1, s.z, 0.3, 2.4, 0.5, 0.25, 2, 2, 1.7, 1.3); sfx.chime(6, 0.8);
      ui.tutorial('soak', 'A Seed of Renewal! Stand in the light as it completes to claim it');
    },
  },
  update(dt) {
    const t = fx.simTime, b = bossRT, fighting = game.state === 'fight' && !b.dead && !b.transitioning;
    B2.vU.uTime.value = t; B2.brU.uTime.value = t; B2.leafU.uTime.value = t; B2.haloU.uTime.value = t;
    // Veyra movement (uprooting) & float
    if (B2.move) { const m = B2.move; m.t += dt; const k = Math.min(1, m.t / m.dur), e = smooth(k); B2.vx = lerp(m.fx, m.tx, e); B2.vz = lerp(m.fz, m.tz, e); B2.lift = Math.sin(Math.PI * k) * 2.2 + e * 0.6; if (k >= 1) B2.move = null; }
    else B2.lift = damp(B2.lift, game.arenaCut.on ? 0.6 : 0, 3, dt);
    const fl = Math.sin(t * 0.9) * 0.12 + B2.lift;
    B2.veyra.position.set(B2.vx, fl, B2.vz);
    const want = Math.atan2(player.x - B2.vx, player.z - B2.vz); const lim = game.arenaCut.on ? 3.2 : 0.55;
    B2.yaw = damp(B2.yaw, clamp(wrapA(want), -lim, lim), 2.5, dt); B2.veyra.rotation.y = B2.yaw;
    B2.hy = (3.2 * B2.sc) + fl;
    bossTarget.x = B2.vx; bossTarget.z = B2.vz; bossTarget.y = B2.hy;
    // arms & hair
    if (B2.armT > 0) B2.armT -= dt; B2.armRaise = damp(B2.armRaise, B2.armT > 0 || B2.bloom.active ? 1 : 0, 4, dt);
    for (const a of B2.arms) { a.sh.rotation.set(-0.25 - B2.armRaise * 0.5, 0, a.side * (0.55 + B2.armRaise * 1.05 + Math.sin(t * 0.8 + a.side) * 0.08)); a.el.rotation.set(-0.2, 0, a.side * (0.5 + B2.armRaise * 0.4 + Math.sin(t * 1.1) * 0.1)); }
    const harr = B2.hair.instanceMatrix.array;
    for (let i = 0; i < B2.hairData.length; i++) {
      const h = B2.hairData[i]; const sway = Math.sin(t * 1.3 + h.sp) * 0.07 + (B2.move ? 0.6 : 0);
      _e.set(h.tilt + Math.abs(h.ph) * 0.12 + sway + 0.35, 0, -h.ph * 0.42 + Math.sin(t * 1.05 + h.sp * 2) * 0.05);
      _q.setFromEuler(_e); _m4.compose(_v1.set(Math.sin(h.ph) * 0.33, 4.55 - Math.abs(h.ph) * 0.12, Math.cos(h.ph) * 0.18 - 0.22), _q, _s.set(1, h.len, 1)); _m4.toArray(harr, i * 16);
    }
    B2.hair.instanceMatrix.needsUpdate = true;
    // shader state
    const vu = B2.vU; vu.uCrack.value = damp(vu.uCrack.value, b.vuln > 0 ? 1 : 0, 6, dt); vu.uFracture.value = b.fracture >= 100 ? 1 : 0;
    if (vu.uFlash.value > 0) vu.uFlash.value = Math.max(0, vu.uFlash.value - dt * 3); if (b.flash > 0) vu.uFlash.value = Math.max(vu.uFlash.value, 0.08);
    if (b.lanceFlash > 0) vu.uFlash.value = Math.max(vu.uFlash.value, 0.5);
    if (game.state === 'fight') teleHC.value = 0;
    B2.white = damp(B2.white, B2.whiteTo, 2.2, dt); vu.uWhite.value = B2.white; B2.brU.uWhite.value = B2.white * 0.45;
    const beat = Math.pow(Math.max(0, Math.sin(t * 1.6 * Math.PI)), 10);
    B2.core.scale.setScalar(1 + beat * 0.3); B2.core.material.color.copy(vu.uCore.value).multiplyScalar(1.6 + beat);
    B2.halo.position.set(B2.vx + Math.sin(B2.yaw) * 0.5 * B2.sc, B2.hy, B2.vz + Math.cos(B2.yaw) * 0.5 * B2.sc); B2.halo.quaternion.copy(camera.quaternion);
    B2.haloU.uCol.value.copy(vu.uCore.value).multiplyScalar(0.36 * (1 + beat * 0.6) * (1 - vu.uDark.value) * (1 + (b.stagger > 0 ? 0.8 : 0)));
    // palette sweep & colour drift
    if (B2.palT >= 0) { B2.palT += dt; B2.colU.uPalR.value = B2.palT * 22; if (B2.colU.uPalR.value > 36) { B2.colU.uEdgeA.value.copy(B2.colU.uEdgeB.value); B2.colU.uPalR.value = 0; B2.palT = -1; } }
    const P = B2PAL[B2.pal], kk = 1 - Math.exp(-1.6 * dt);
    b2DampCol(vu.uCol.value, P.body, kk); b2DampCol(vu.uCore.value, P.core, kk); B2.brU.uCol.value.copy(vu.uCol.value); b2DampCol(B2.leafU.uCol.value, P.leaf, kk); b2DampCol(B2.colU.uFog.value, P.fog, kk);
    b2DampCol(floorU.uTint.value, P.void, kk); floorU.uTint2.value.copy(floorU.uTint.value);
    // leaves
    B2.vortex = B2.vortexTo > B2.vortex ? Math.min(B2.vortexTo, B2.vortex + dt / 1.5) : Math.max(B2.vortexTo, B2.vortex - dt / 1.5);
    B2.leafU.uVortex.value = B2.vortex; B2.leafU.uCenter.value.set(game.arenaCut.on ? B2.vx * 0.6 : 0, 0, game.arenaCut.on ? B2.vz * 0.6 : 0);
    B2.collapse = Math.min(B2.collapseTo, B2.collapse + dt / 1.1); B2.leafU.uCollapse.value = B2.collapse; B2.leafU.uCore.value.set(B2.halo.position.x, B2.hy, B2.halo.position.z);
    if (B2.scatterOn) { B2.scatter = Math.min(1, B2.scatter + dt / 2.6); B2.leafU.uScatter.value = easeOut(B2.scatter); }
    B2.leafMesh.count = Q.cfg.low ? 600 : Q.name === 'med' ? 1200 : 1500;
    if (B2.rippleT >= 0) { B2.rippleT += dt; if (B2.rippleT > 2.6) B2.rippleT = -1; }
    b2UpdateTiles(dt);
    b2UpdateSeeds(dt);
    b2UpdateSaps(dt, fighting);
    b2UpdateBloom(dt, fighting);
    b2UpdateSoak(dt);
    b2UpdateRing(dt, fighting);
    if (B2.brU.uFlash.value > 0) B2.brU.uFlash.value = Math.max(0, B2.brU.uFlash.value - dt * 2);
    // ambient bioluminescent fog sparkle
    B2.sparkAcc += dt * (Q.cfg.low ? 14 : 34);
    while (B2.sparkAcc >= 1) { B2.sparkAcc -= 1; const a = frand() * TAU, r = Math.sqrt(frand()) * 17; const x = Math.cos(a) * r, z = Math.sin(a) * r; const c = B2.leafU.uCol.value; emitP(x, 0.15 + frand() * 1.6, z, (frand() - 0.5) * 0.25, 0.05 + frand() * 0.15, (frand() - 0.5) * 0.25, c.r * 0.9, c.g * 0.9, c.b * 0.9, 4 + frand() * 3, 0.07 + frand() * 0.06, 4); }
    // floor light blobs: heart + saplings / soak tower
    const Lv = floorU.uLights.value, Lc = floorU.uLightCol.value;
    Lv[0].set(B2.vx, 3, B2.vz, B2.veyra.visible ? 1.3 + beat * 0.5 : 0); Lc[0].copy(vu.uCore.value).multiplyScalar(0.6);
    let li = 1;
    if (B2.soak.active || B2.soak.fade > 0) { Lv[li].set(B2.soak.x, 2, B2.soak.z, 1.6 * B2.towerU.uA.value); Lc[li].setRGB(1, 0.95, 0.8); li++; }
    for (const s of B2.saps) { if (li > 3) break; if (s.alive) { Lv[li].set(s.x, 1, s.z, 0.9 * s.grow); Lc[li].setRGB(0.3, 1.0, 0.5); li++; } }
    for (; li < 4; li++) Lv[li].w = 0;
    floorU.uBossPos.value.set(B2.vx, B2.vz); floorU.uBossShadow.value = B2.veyra.visible ? 1 : 0;
  },
  // ---- cinematics ----
  introCine() {
    const keys = [[0, 0, 2.2, 19, 0, 3.2, 0, 58], [1.4, 1.5, 3.4, 15.5, 0, 3.6, 0, 52], [2.8, 3.2, 6.5, 12.5, 0, 3.6, 0, 48], [4.2, 0, 13, 15.5, 0, 1.6, 4, 50]];
    return {
      dur: 4.2, skippable: 0.6, skipTo: 3.9,
      start() { ui.hud(false); player.x = 0; player.z = 7; playerG.visible = false; B2.introT = 0; B2.leafU.uHide.value = 1; B2.vU.uDark.value = 1; B2.halo.visible = false; sfx.fall(); },
      update(t) { camKeys(t, keys); B2.introT = t; B2.leafU.uHide.value = 1 - smooth((t - 1.2) / 1.4); if (t > 1.5) B2.vU.uDark.value = Math.max(0, 1 - (t - 1.5) / 0.5); },
      ev: [
        [0.5, () => { reform(0, 1.15, 7, 60, 0.45, 1.4, 1.6, 2.2, 6); }],
        [0.95, () => { playerG.visible = true; ring(0, 0.06, 7, 0.3, 5, 0.7, 0.3, 2, 2.2, 2.6, 1.4); bloomSpike(0.8); addTrauma(0.3); sfx.boom(); }],
        [1.5, () => { B2.halo.visible = true; B2.vU.uFlash.value = 1; B2.brU.uFlash.value = 1; bloomSpike(1.6); rainbowWave(0, 0, 1.2, 16); sfx.chime(2); sfx.chime(4, 0.7); burst(0, 3.4, 0.3, 120, 0.6, 2.4, 1.2, 10, 1.2, 0.25, 1, 0); }],
        [2.3, () => { ui.letterbox(true); ui.titleCard('VEYRA, THE GLASS ORCHARD', 'Second Refraction'); music.setSection('b2p1'); }],
      ],
      end() { B2.introT = -1; B2.leafU.uHide.value = 0; B2.vU.uDark.value = 0; B2.halo.visible = true; playerG.visible = true; },
    };
  },
  transitionCine(n) {
    const c0 = new THREE.Vector3(), l0 = new THREE.Vector3();
    if (n === 1) return {
      dur: 2.4,
      start() { c0.copy(cam.pos); l0.copy(cam.look); director.timeScale = 0.35; ui.titleCard('AUTUMN OF GLASS', '', 2); sfx.riser(); b2ClearAdds(true); },
      update(t) { const k = smooth(t / 2.4); director.camPos.set(lerp(c0.x, 0, k), lerp(c0.y, 25, k), lerp(c0.z, 23, k)); director.camLook.set(lerp(l0.x, 0, k), lerp(l0.y, 2.5, k), lerp(l0.z, 0, k)); director.fov = 54; if (t > 1.8) director.timeScale = lerp(0.35, 1, (t - 1.8) / 0.6); },
      ev: [
        [0.15, () => { B2.vortexTo = 1; B2.rippleT = 0; B2.vU.uFlash.value = 1; B2.brU.uFlash.value = 1; bloomSpike(1.0); }],
        [0.7, () => { b2SetPal('bloom', true, B2.vx, B2.vz); bloomSpike(1.6); addTrauma(0.7); shockAt(0, 3, 0, 0.06); sfx.boom(); sfx.shatter(0.8); burst(0, 3.4, 0, 160, 1.4, 1.0, 2.6, 14, 1.2, 0.3, 1, 0); game.satTarget = Math.min(1, game.sat + 0.12); }],
      ],
      end() { director.timeScale = 1; b2SetPal('bloom', false); },
    };
    return {
      dur: 2.8,
      start() { c0.copy(cam.pos); l0.copy(cam.look); director.timeScale = 0.45; ui.titleCard('UPROOTING', '', 2); sfx.riser(); b2ClearAdds(true);
        B2.bud.position.set(B2.vx, 0, B2.vz); for (const p of B2.petals) { p.pivot.visible = true; p.rise = 0.4; p.open = 1.2; p.openT = 0.05; p.u.uA.value = 1; p.u.uCrack.value = 0.4; } },
      update(t) {
        const ac = game.arenaCut, nx = ac.on ? ac.nx : 0, nz = ac.on ? ac.nz : 1, k = smooth(t / 2.8);
        director.camPos.set(lerp(c0.x, -nx * 15, k), lerp(c0.y, 15, k), lerp(c0.z, -nz * 15 + 4, k)); director.camLook.set(lerp(l0.x, nx * 3, k), lerp(l0.y, 0.5, k), lerp(l0.z, nz * 3, k)); director.fov = 56;
        if (t > 2.2) director.timeScale = lerp(0.45, 1, (t - 2.2) / 0.6);
      },
      ev: [
        [0.6, () => { for (const p of B2.petals) { p.openT = 2.6; p.u.uFlash.value = 0.5; } B2.vU.uFlash.value = 1; sfx.growl(); }],
        [0.95, () => { for (const p of B2.petals) { shatter(B2.vx + Math.sin(p.mid) * 2.5, 1.5, B2.vz + Math.cos(p.mid) * 2.5, 1.2, 20, 1.4, 2.0, 1.8, 8, 1.6, 9); p.pivot.visible = false; } }],
        [1.0, () => { b2Uproot(false); addTrauma(0.9); bloomSpike(1.1); shockAt(0, 1, 0, 0.07); sfx.boom(); sfx.shatter(1.4); burst(0, 2, 0, 70, 2.0, 0.6, 1.4, 14, 1.2, 0.28, 1, 0); }],
        [1.3, () => { b2SetPal('thorn', true, B2.vx, B2.vz); bloomSpike(1.2); game.satTarget = Math.min(1, game.sat + 0.1); }],
        [2.0, () => { b2RingOn(true); B2.ringR = 18; B2.ringReset = 0.8; B2.ringFrom = 18; }],
      ],
      end() { director.timeScale = 1; b2SetPal('thorn', false); B2.move = null; if (game.arenaCut.on) { B2.vx = -game.arenaCut.nx * 6.2; B2.vz = -game.arenaCut.nz * 6.2; } },
    };
  },
  deathCine() {
    const s0 = game.sat; const c0 = new THREE.Vector3(); let ocx = 0, ocz = 0, oa0 = 0;
    return {
      dur: 6.6,
      start() { c0.copy(cam.pos); ocx = B2.vx * 0.5; ocz = (B2.vz - 1) * 0.5; oa0 = Math.atan2(c0.z - ocz, c0.x - ocx); ui.hud(false); music.setSection('silence'); director.timeScale = 0.55; B2.whiteTo = 1; B2.vU.uFlash.value = 1; sfx.choir(3); for (const s of B2.saps) b2KillSap(s, true); if (B2.ringOn) { ring(B2.vx, 0.3, B2.vz, B2.ringR, B2.ringR + 4, 0.7, 0.4, 2.4, 0.4, 0.6, 1.2); b2RingOn(false); } },
      update(t) {
        const k = smooth(t / 6.6), hx = B2.vx, hz = B2.vz, e = smooth(t / 1.6);
        const oa = oa0 + k * 0.85, orr = 18.5 - k * 2.5;
        director.camPos.set(lerp(c0.x, ocx + Math.cos(oa) * orr, e), lerp(c0.y, 9.5 - k * 1.5, e), lerp(c0.z, ocz + Math.sin(oa) * orr, e));
        const lk = smooth((t - 1.6) / 2.4); director.camLook.set(lerp(hx, ocx, lk), lerp(3.4, 4.6, lk), lerp(hz, ocz, lk)); director.fov = 50;
        if (t > 1.0) director.timeScale = 1;
        if (t > 2.0 && t < 4.0) game.sat = lerp(s0, SAT_BOSS[2], (t - 2) / 2);
        if (t < 1.7 && frand() < 0.6) { const a = frand() * TAU; emitP(hx + Math.cos(a) * 3, B2.hy + (frand() - 0.5) * 3, hz + Math.sin(a) * 3, -Math.cos(a) * 4, 0, -Math.sin(a) * 4, 2, 2.2, 2.4, 0.7, 0.18, 4); }
      },
      ev: [
        [0.3, () => { B2.collapseTo = 1; B2.vortexTo = 1; }],
        [1.7, () => {
          const hx = B2.halo.position.x, hz = B2.halo.position.z;
          B2.veyra.visible = false; B2.halo.visible = false; B2.scatterOn = true; B2.scatter = 0;
          shatter(hx, B2.hy, hz, 1.6, 180, 1.3, 1.3, 1.3, 12, 3.2, 6, true); burstRainbow(hx, B2.hy, hz, 170, 15, 1.6, 0.3, 0);
          rainbowWave(hx, hz, 1.1, 14); setTimeout(() => rainbowWave(hx, hz, 0.8, 12), 550); setTimeout(() => rainbowWave(hx, hz, 0.9, 11), 1150);
          bloomSpike(1.2); addTrauma(0.9); shockAt(hx, B2.hy, hz, 0.08); sfx.shatter(1.6); sfx.boom(); sfx.victoryStab(); B2.brU.uFlash.value = 1;
        }],
        [3.0, () => { ui.letterbox(true); ui.titleCard('VEYRA', 'UNBOUND', 3.2); }],
      ],
      end() { game.sat = game.satTarget = SAT_BOSS[2]; ui.letterbox(false); },
    };
  },
};
