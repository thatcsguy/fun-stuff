// ------------------------------------------------------------------
// BOSS 1 — THE LANTERN CHOIR (Ember Pond)
// ------------------------------------------------------------------
const B1 = { group: new THREE.Group(), lanterns: [], drops: [], heart: null, heartU: null, flame: null, flameU: null, candles: null, flames: null, flameMatU: null,
  orbitT: 0, fire: 0, mode: 'title', heartYaw: 0, heartYawTarget: 0, beat: 0, ignited: 0, chorusDir: 1, firstEmber: true, tut: {}, padCandles: 60, floatIdx: 0 };
function makeLanternTex() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const c = cv.getContext('2d');
  c.fillStyle = 'rgb(225,0,0)'; c.fillRect(0, 0, 256, 256);
  // paper fibres
  for (let i = 0; i < 900; i++) { const v = 190 + Math.random() * 60 | 0; c.fillStyle = `rgb(${v},0,0)`; c.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1); }
  // ribs (horizontal) and seams (vertical)
  for (let i = 1; i < 9; i++) { const y = i * 256 / 9; c.fillStyle = 'rgb(80,0,255)'; c.fillRect(0, y - 2, 256, 4); }
  for (let i = 0; i < 12; i++) { const x = i * 256 / 12; c.fillStyle = 'rgb(150,0,120)'; c.fillRect(x - 1, 0, 2, 256); }
  c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgb(0,255,0)'; c.fillStyle = 'rgb(0,255,0)'; c.lineCap = 'round';
  // serene closed eyes
  c.lineWidth = 7; c.beginPath(); c.arc(100, 102, 18, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  c.beginPath(); c.arc(156, 102, 18, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  // tear marks
  c.lineWidth = 3; c.beginPath(); c.moveTo(100, 126); c.lineTo(97, 150); c.stroke(); c.beginPath(); c.moveTo(156, 126); c.lineTo(159, 150); c.stroke();
  // forehead diamond
  c.beginPath(); c.moveTo(128, 56); c.lineTo(138, 70); c.lineTo(128, 84); c.lineTo(118, 70); c.closePath(); c.fill();
  // singing mouth
  c.beginPath(); c.ellipse(128, 168, 13, 18, 0, 0, TAU); c.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function buildBoss1() {
  const g = B1.group; scene.add(g);
  // lantern geometry (paper-lantern lathe profile)
  const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector2(0.07 + 0.4 * Math.pow(Math.sin(Math.PI * t), 0.75), -0.55 + t * 1.1)); }
  const lathe = new THREE.LatheGeometry(pts, 12, Math.PI, TAU);
  const capGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.07, 12);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1a0d08, roughness: 0.6, metalness: 0.2, emissive: 0x220a04 });
  const tex = makeLanternTex();
  const lanternMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex }, uGlow: { value: 1 }, uFire: { value: 0 }, uTime: { value: 0 }, uDark: { value: 0 }, uSeed: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: GLSL_LIB + /* glsl */`
      uniform sampler2D uMap; uniform float uGlow,uFire,uTime,uDark,uSeed,uFlash; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vec3 t = texture2D(uMap, vUv).rgb; vec3 n = normalize(vN), v = normalize(vV);
        float fr = fresnelF(n, v, 2.0);
        float flick = 0.82 + 0.18*noise2(vec2(uTime*5.0 + uSeed*10.0, uSeed));
        float glow = uGlow*flick*(1.0-uDark);
        vec3 warm = mix(vec3(1.0,0.3,0.09), vec3(1.0,0.42,0.06), uFire);
        float thru = 0.28 + 0.55*pow(1.0-fr, 1.5);
        vec3 c = warm*t.r*glow*thru*0.85;
        c *= 1.0 - t.b*0.85;
        c += vec3(1.0,0.75,0.4)*t.g*glow*2.6;
        c += vec3(1.0,0.2,0.1)*fr*0.22*glow;
        float fl = noise2(vec2(vUv.x*12.0, vUv.y*6.0 - uTime*3.0));
        c += vec3(1.0,0.4,0.08)*uFire*smoothstep(0.45,0.9,fl)*(0.6+fr)*1.6;
        c += vec3(0.05,0.045,0.04)*(0.4+0.6*max(n.y,0.0))*(1.0-glow*0.5);
        c += vec3(2.5,2.0,1.6)*uFlash;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const ribbonMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPhase: { value: 0 }, uBack: { value: new THREE.Vector3() }, uFire: { value: 0 }, uA: { value: 1 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime,uPhase; uniform vec3 uBack; varying float vK; varying vec2 vUv;
      void main(){ vec3 p = position; float k = clamp(-p.y/3.0,0.0,1.0); vK = k; vUv = uv;
        p.x += sin(uTime*2.6 + uPhase - k*4.0)*0.3*k; p.z += cos(uTime*2.1 + uPhase*1.3 - k*3.0)*0.2*k; p += uBack*k*k;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform float uFire,uA; varying float vK; varying vec2 vUv;
      void main(){ float edge = smoothstep(0.0,0.25,vUv.x)*smoothstep(1.0,0.75,vUv.x);
        vec3 c = mix(vec3(0.9,0.04,0.12), mix(vec3(1.0,0.3,0.08), vec3(1.0,0.55,0.15), uFire), vK)*(1.2-vK*0.8)*(0.75+uFire*0.6);
        gl_FragColor = vec4(c, (1.0-vK)*0.85*(0.6+0.4*edge)*uA); }`,
  });
  const ribbonGeo = new THREE.PlaneGeometry(0.22, 3, 1, 14).translate(0, -1.5, 0);
  for (let i = 0; i < 8; i++) {
    const lg = new THREE.Group();
    const mat = lanternMat.clone(); mat.uniforms.uMap.value = tex; mat.uniforms.uSeed.value = i * 1.37;
    const body = new THREE.Mesh(lathe, mat); lg.add(body);
    const top = new THREE.Mesh(capGeo, capMat); top.position.y = 0.58; lg.add(top);
    const bot = new THREE.Mesh(capGeo, capMat); bot.position.y = -0.58; lg.add(bot);
    g.add(lg);
    const ribbons = [];
    for (let k = 0; k < 2; k++) { const rm = ribbonMat.clone(); rm.uniforms.uPhase.value = i * 2.1 + k * 1.3; const m = new THREE.Mesh(ribbonGeo, rm); m.renderOrder = 8; g.add(m); ribbons.push(m); }
    B1.lanterns.push({ g: lg, body, mat, u: mat.uniforms, ribbons, pos: new THREE.Vector3(), last: new THREE.Vector3(), tgt: new THREE.Vector3(), baseA: i / 8 * TAU,
      mode: 0, t: 0, glow: 1, glowT: 1, ign: 0, from: new THREE.Vector3(), dir: new THREE.Vector2(), dark: 0, vis: true, fallV: 0 });
  }
  // falling paper lanterns (Paper Rain)
  const dropMat = lanternMat.clone(); dropMat.uniforms.uMap.value = tex; dropMat.uniforms.uGlow.value = 1.6;
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(lathe, dropMat); m.scale.setScalar(0.7); m.visible = false; g.add(m); B1.drops.push({ m, active: false, t: 0, dur: 1.5, x: 0, z: 0 }); }
  B1.dropMat = dropMat;
  // the paper heart
  const hs = new THREE.Shape(); const hp = [];
  for (let i = 0; i < 96; i++) { const t = i / 96 * TAU; const x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); hp.push(new THREE.Vector2(x * 0.05, y * 0.05)); }
  hs.setFromPoints(hp);
  const hgeo = new THREE.ExtrudeGeometry(hs, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.38, bevelSize: 0.22, bevelSegments: 6, curveSegments: 8 }); hgeo.center();
  B1.heartU = { uTime: { value: 0 }, uPulse: { value: 0 }, uFire: { value: 0 }, uFlash: { value: 0 }, uCrack: { value: 0 }, uDark: { value: 0 }, uFracture: { value: 0 } };
  B1.heart = new THREE.Mesh(hgeo, new THREE.ShaderMaterial({
    uniforms: B1.heartU,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vO; void main(){ vO = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: GLSL_LIB + /* glsl */`
      uniform float uTime,uPulse,uFire,uFlash,uCrack,uDark,uFracture; varying vec3 vN; varying vec3 vV; varying vec3 vO;
      vec2 vor(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8.0, d2=8.0; for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=vec2(hash12(i+g), hash12(i+g+17.0)); vec2 r=g+o-f; float d=dot(r,r); if(d<d1){d2=d1; d1=d;} else if(d<d2) d2=d; } return vec2(sqrt(d1), sqrt(d2)); }
      void main(){ vec3 n = normalize(vN), v = normalize(vV); float fr = fresnelF(n, v, 2.2);
        float veins = fbm(vO.xy*3.2 + vec2(0.0, uTime*0.25) + vO.z);
        float vl = smoothstep(0.035, 0.0, abs(veins-0.5));
        vec3 base = vec3(0.32,0.012,0.04)*(0.35+0.65*(1.0-fr));
        vec3 core = vec3(1.0,0.05,0.12)*pow(1.0-fr,3.0)*(0.45+uPulse*1.1);
        vec3 c = base + core + vl*vec3(1.0,0.25,0.2)*(0.35+uPulse*0.9) + fr*vec3(1.0,0.3,0.4)*0.7;
        // burning heart
        float fl = fbm(vO.xy*2.5 - vec2(0.0, uTime*1.4));
        vec3 fire = vec3(1.0,0.13,0.02)*(0.3+1.05*smoothstep(0.4,0.8,fl)) + vec3(1.0,0.34,0.05)*pow(1.0-fr,4.0)*0.55 + vec3(0.5,0.02,0.02)*fr*0.6;
        c = mix(c, fire + vl*vec3(1.0,0.42,0.08)*0.8, uFire*0.88);
        vec2 vr = vor(vO.xy*2.6 + vO.z*0.5); float ce = smoothstep(0.06, 0.0, vr.y-vr.x);
        c += vec3(2.2,2.3,2.6)*ce*max(uCrack, uFracture*0.35*(0.5+0.5*sin(uTime*9.0)));
        c *= 1.0-uDark*0.9;
        c = mix(c, vec3(3.0), uFlash);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  B1.heart.scale.setScalar(1.35); B1.heart.position.set(0, 2.1, 0); g.add(B1.heart);
  // fire billboard (phase 2)
  B1.flameU = { uTime: { value: 0 }, uA: { value: 0 } };
  B1.flame = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 7), new THREE.ShaderMaterial({
    uniforms: B1.flameU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, defines: fbmDefines(),
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: GLSL_LIB + `uniform float uTime,uA; varying vec2 vUv;
      void main(){ vec2 p = vUv*2.0-1.0; float n = fbm(vec2(p.x*2.2, p.y*1.6 - uTime*1.8)); float n2 = fbm(vec2(p.x*4.0+3.0, p.y*3.0 - uTime*3.1));
        float d = length(vec2(p.x*1.35, (p.y+0.2)*0.72)); float s = smoothstep(1.0, 0.0, d + (n-0.5)*0.9 + (n2-0.5)*0.35 + p.y*0.15);
        s *= smoothstep(1.0, 0.72, abs(p.x))*smoothstep(1.0, 0.68, abs(p.y));   // never reach the quad edges
        vec3 c = mix(vec3(0.6,0.03,0.01), vec3(1.0,0.3,0.04), smoothstep(0.1,0.5,s)); c = mix(c, vec3(1.0,0.58,0.16), smoothstep(0.65,0.95,s));
        gl_FragColor = vec4(c*s*0.85*uA, 1.0); }`,
  }));
  B1.flame.position.set(0, 2.6, -0.4); B1.flame.renderOrder = 3; g.add(B1.flame);
  // candles: 400 around the pond + 60 floating inside
  const NC = 400, NF = 60;
  const bodyGeo = new THREE.CylinderGeometry(0.07, 0.085, 0.32, 7).translate(0, 0.16, 0);
  B1.flameMatU = { uTime: { value: 0 }, uFlare: { value: 1 }, uIgnite: { value: 1 }, uIgR: { value: 99 } };
  // warm ivory wax: dark at the base, lit lip at the top, fading out beyond the pond rim
  const bodyMat = new THREE.ShaderMaterial({
    uniforms: B1.flameMatU,
    vertexShader: `varying float vH; varying float vR; void main(){ vH = position.y/0.32; vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0); vR = length(w.xz); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uFlare,uIgnite,uIgR; varying float vH; varying float vR;
      void main(){ float ig = uIgnite*smoothstep(uIgR+1.5, uIgR-1.5, vR);
        vec3 base = mix(vec3(0.07,0.035,0.02), vec3(0.62,0.48,0.32), smoothstep(0.0,1.0,vH));
        float lip = smoothstep(0.78,1.0,vH);
        vec3 c = base*(0.45+0.35*ig) + vec3(1.0,0.45,0.12)*lip*(0.55+0.25*min(uFlare,2.0))*ig;
        c *= mix(1.0, 0.35, smoothstep(17.0, 21.5, vR));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  B1.candles = new THREE.InstancedMesh(bodyGeo, bodyMat, NC + NF);
  B1.flames = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.42), new THREE.ShaderMaterial({
    uniforms: B1.flameMatU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime,uFlare,uIgR; varying vec2 vUv; varying float vF;
      void main(){ vec3 c = (modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz; float id = float(gl_InstanceID);
        float cr = length(c.xz);
        float fl = 0.78 + 0.22*sin(uTime*13.0+id*1.7)*sin(uTime*7.3+id*0.37); vF = fl*smoothstep(uIgR+1.5, uIgR-1.5, cr)*mix(1.0, 0.55, smoothstep(17.0, 21.5, cr));
        float s = sqrt(uFlare)*fl; vec4 mv = viewMatrix*vec4(c + vec3(0.0, 0.32, 0.0), 1.0);
        mv.xy += vec2(position.x + sin(uTime*3.0+id)*0.02*position.y*5.0, position.y + 0.21)*s; vUv = uv; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uFlare,uIgnite; varying vec2 vUv; varying float vF;
      void main(){ vec2 q = vUv*2.0-1.0; float w = 0.55*(1.0 - q.y*0.45); float d = length(vec2(q.x/w, (q.y+0.3)*0.85)); float a = smoothstep(1.0, 0.0, d);
        vec3 c = mix(vec3(1.0,0.3,0.04), vec3(1.0,0.88,0.6), a*a)*a*2.2*vF*uFlare*uIgnite; gl_FragColor = vec4(c, 1.0); }`,
  }), NC + NF);
  B1.flames.frustumCulled = false; B1.candles.frustumCulled = false;
  B1.floatData = new Float32Array(NF * 4);
  for (let i = 0; i < NC + NF; i++) {
    let x, z, y = 0, s = 0.7 + frand() * 0.8;
    if (i < NC) { const a = frand() * TAU, r = 15.6 + Math.pow(frand(), 0.8) * 5.6; x = Math.cos(a) * r; z = Math.sin(a) * r; y = -0.02; }
    else { const a = frand() * TAU, r = 7 + Math.sqrt(frand()) * 7.5; x = Math.cos(a) * r; z = Math.sin(a) * r; s = 0.6; const k = (i - NC) * 4; B1.floatData[k] = a; B1.floatData[k + 1] = r; B1.floatData[k + 2] = frand() * TAU; B1.floatData[k + 3] = (frand() - 0.5) * 0.04; }
    _m4.compose(_v1.set(x, y, z), _q.identity(), _s.set(s, s * (0.6 + frand() * 0.9), s)); B1.candles.setMatrixAt(i, _m4); B1.flames.setMatrixAt(i, _m4);
  }
  B1.candles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); B1.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  B1.NC = NC; B1.NF = NF;
  g.add(B1.candles, B1.flames);
  g.visible = false;
}
function b1LanternOrbitPos(i, out) {
  const L = B1.lanterns[i]; const a = L.baseA + B1.orbitT;
  return out.set(Math.cos(a) * 4.5, 2.6 + Math.sin(fx.simTime * 1.3 + i) * 0.28, Math.sin(a) * 4.5);
}
function b1PickLantern(modeFree = true) {
  for (let n = 0; n < 16; n++) { const i = Math.floor(rng() * 8); if (!modeFree || B1.lanterns[i].mode === 0) return i; }
  for (let i = 0; i < 8; i++) if (B1.lanterns[i].mode === 0) return i; return 0;
}
function b1Drop(x, z, dur) {
  let d = null; for (const o of B1.drops) if (!o.active) { d = o; break; } if (!d) d = B1.drops[0];
  d.active = true; d.t = 0; d.dur = dur; d.x = x; d.z = z; d.m.visible = true; d.m.position.set(x, 14, z);
}
const BOSS1 = {
  id: 1, name: 'THE LANTERN CHOIR', subtitle: 'First Refraction', deathTitle: 'THE LANTERN CHOIR', deathSub: 'SILENCED',
  arena: 0, arenaR: 15, maxHp: 11000, enrage: 240, hit: { x: 0, y: 2.1, z: 0, r: 1.6, hy: 2.2 },
  barGrad: 'linear-gradient(90deg,#ff2d55,#ff7a3d 60%,#ffd27a)', music: ['b1p1', 'b1p2'],
  phases: [
    { name: 'Vespers', until: 0.6, loop: 14, steps: [[0, 'SpiralHymn'], [4.5, 'LanternGaze'], [8, 'EmberRing'], [11, 'PaperRain']] },
    { name: 'Choir of Cinders', until: 0, loop: 16, steps: [[0, 'Swoop'], [5, 'Chorus'], [10.5, 'CandleRain'], [13.5, 'FrontalHymn']] },
  ],
  build: buildBoss1,
  show(on) { B1.group.visible = on; },
  hue: [1.0, 0.35, 0.12],
  camTop() { return 3.7; },
  setTitleMode() { B1.mode = 'title'; for (const L of B1.lanterns) { L.ign = 0.22; L.mode = 0; L.dark = 0; L.vis = true; } B1.heart.visible = false; B1.flameU.uA.value = 0; B1.fire = 0; B1.heartU.uFire.value = 0; B1.flameMatU.uFlare.value = 1; B1.flameMatU.uIgR.value = 99; floorU.uPalFrom.value = 0; floorU.uPalTo.value = 0; floorU.uPalRadius.value = 0; floorU.uBeat.value = 0; },
  reset() {
    B1.mode = 'fight'; B1.fire = 0; B1.heartU.uFire.value = 0; B1.heartU.uDark.value = 0; B1.heartU.uCrack.value = 0; B1.flameU.uA.value = 0; B1.flameMatU.uFlare.value = 1; B1.flameMatU.uIgR.value = 99;
    B1.heart.visible = true; B1.heartYaw = Math.PI / 2; B1.cleaving = false; B1.chorusDir = 1; B1.firstEmber = true; B1.tut = {};
    for (let i = 0; i < 8; i++) { const L = B1.lanterns[i]; L.mode = 0; L.ign = 1; L.dark = 0; L.glowT = 1; L.vis = true; L.g.visible = true; b1LanternOrbitPos(i, L.pos); L.last.copy(L.pos); }
    for (const d of B1.drops) { d.active = false; d.m.visible = false; }
    floorU.uPalFrom.value = 0; floorU.uPalTo.value = 0; floorU.uPalRadius.value = 0;
  },
  transitionInstant(n) { if (n === 1) { B1.fire = 1; B1.heartU.uFire.value = 1; B1.flameU.uA.value = 1; B1.flameMatU.uFlare.value = 1.6; floorU.uPalFrom.value = 0; floorU.uPalTo.value = 1; floorU.uPalRadius.value = 40; } },
  onPhase(n) { },
  onInterrupt() { for (const L of B1.lanterns) if (L.mode !== 0 && L.mode !== 4) { L.mode = 0; L.glowT = 1; } },
  casts: {
    SpiralHymn() {
      castBar('Spiral Hymn', 3); B1.heartU.uFlash.value = 0.3;
      patSpiral(0, 0, 2, 10, 3, 17, 6.5 * DIFF[0].spd, R, 0.3, 8, rng() * TAU);
      sfx.choir(0);
    },
    LanternGaze() {
      castBar('Lantern Gaze', 1.5);
      const used = [];
      for (let n = 0; n < 3; n++) {
        after(n * 0.7, () => {
          let i = b1PickLantern(); for (let q = 0; q < 6 && used.indexOf(i) >= 0; q++) i = b1PickLantern(); used.push(i);
          const L = B1.lanterns[i]; L.mode = 1; L.t = 0; L.glowT = 3;
          const o = teleLine(L.pos.x, L.pos.z, player.x, player.z, 1.6, DIFF[0].windup, 14, R, {
            noHit: true,
            follow: (o) => { const lx = L.pos.x, lz = L.pos.z; const a = Math.atan2(player.z - lz, player.x - lx); teleSetLine(o, lx, lz, lx + Math.cos(a) * 30, lz + Math.sin(a) * 30, 1.6); },
            onResolve: (o) => {
              hzBeam(o.x, 0.9, o.z, o.x1, 0.9, o.z1, 1.6, 0.4, 14, R, (hb) => { hb.x0 = L.pos.x; hb.z0 = L.pos.z; hb.sx = L.pos.x; hb.sz = L.pos.z; });
              beam(L.pos.x, L.pos.y, L.pos.z, o.x, 0.9, o.z, 0.18, 0.4, 1, 0.3, 0.2, 1, 0.9);
              sfx.laser(); addTrauma(0.15); tryRipple(o.x, o.z, 0.8);
              after(0.45, () => { L.mode = 0; L.glowT = 1; });
            },
          });
        });
      }
    },
    EmberRing() {
      castBar('Ember Ring', 1);
      if (B1.firstEmber) { B1.firstEmber = false; ui.tutorial('graze', 'Brush past shots to GRAZE their color'); }
      const fire = (rot) => { const ga = aimAt(0, 0); patRing(0, 0, 24, 5 * DIFF[0].spd, Bc, 0.3, 8, ga + rot, ga, 3); sfx.shot(Bc); ring(0, 1, 0, 0.5, 4, 0.4, 0.2, 0.5, 0.9, 2.5, 1.2); };
      fire(0); after(1, () => fire(TAU / 48));
    },
    PaperRain() {
      castBar('Paper Rain', DIFF[0].windup);
      const w = DIFF[0].windup;
      const spots = [[player.x, player.z]]; for (let i = 0; i < 3; i++) { const p = randInArena(8); spots.push([p.x, p.y]); }
      for (const [x, z] of spots) {
        teleCircle(x, z, 2.2, w, 12, R, { onResolve: (o) => { burst(o.x, 0.4, o.z, 30, 2.5, 1.0, 0.35, 7, 0.6, 0.18, 0.6, 0); ring(o.x, 0.1, o.z, 0.3, 3.2, 0.5, 0.25, 2.4, 1.1, 0.4, 1.3); tryRipple(o.x, o.z, 1.2); rippleCD = 0; addRipple(o.x, o.z, 1.2); addTrauma(0.12); } });
        b1Drop(x, z, w);
      }
    },
    Swoop() {
      castBar('Swoop', 3.1);
      for (let n = 0; n < 3; n++) after(n * 0.8, () => {
        const i = b1PickLantern(); const L = B1.lanterns[i]; L.mode = 2; L.t = 0; L.glowT = 2.6; L.from.copy(L.pos); L.from.y = 1.7;
        const w = DIFF[0].windup;
        const o = teleCone(L.pos.x, L.pos.z, aimAt(L.pos.x, L.pos.z), 25 * Math.PI / 180, 12, w, 14, R, {
          lockAt: 0.5,
          follow: (o) => { teleSetCone(o, L.pos.x, L.pos.z, aimAt(L.pos.x, L.pos.z), o.half, 12); L.dir.set(Math.cos(o.ang), Math.sin(o.ang)); },
          onResolve: () => { addTrauma(0.2); sfx.swoop(); },
        });
        after(w - 0.15, () => { L.mode = 3; L.t = 0; L.prevK = 0; L.from.copy(L.pos); });
      });
    },
    Chorus() {
      castBar('Chorus', 2); sfx.choir(1);
      const dir = B1.chorusDir; B1.chorusDir *= -1;
      const a0 = rng() * TAU;
      for (let i = 0; i < 8; i++) { const L = B1.lanterns[i]; if (L.mode === 0 || L.mode === 1) { L.mode = 5; L.t = 0; } }
      teleSafe(0, 0, 3, 2.1);
      for (let k = 0; k < 8; k++) { const a = a0 + k * TAU / 8; teleLine(Math.cos(a) * 3, Math.sin(a) * 3, Math.cos(a) * 16, Math.sin(a) * 16, 1.4, 2, 0, R, { noHit: true }); }
      ui.tutorial('chorus', 'Keep moving between the beams — the heart\'s shadow is safe');
      after(2, () => {
        sfx.laser(); addTrauma(0.3);
        for (let k = 0; k < 8; k++) {
          const base = a0 + k * TAU / 8;
          hzBeam(Math.cos(base) * 3, 1.0, Math.sin(base) * 3, Math.cos(base) * 16, 1.0, Math.sin(base) * 16, 1.4, 4, 10, R, (hb) => {
            const a = base + dir * hb.t * 22 * Math.PI / 180; B1.chorusAng = a - base;
            hb.x0 = Math.cos(a) * 3; hb.z0 = Math.sin(a) * 3; hb.x1 = Math.cos(a) * 16; hb.z1 = Math.sin(a) * 16; hb.sx = 0; hb.sz = 0;
          });
        }
        B1.chorusA0 = a0; B1.chorusDirNow = dir; B1.chorusT = 0;
        after(4, () => { for (const L of B1.lanterns) if (L.mode === 5) { L.mode = 0; } });
      });
    },
    CandleRain() {
      castBar('Candle Rain', 1.75);
      const w = DIFF[0].windup;
      every(0.25, 7, (i) => {
        let x, z; if (i === 0) { x = player.x; z = player.z; } else { const p = randInArena(13); x = p.x; z = p.y; }
        teleCircle(x, z, 1.8, w, 12, R, { onResolve: (o) => { burst(o.x, 0.3, o.z, 22, 2.6, 1.2, 0.3, 6, 0.6, 0.16, 0.7, 0); ring(o.x, 0.1, o.z, 0.2, 2.6, 0.45, 0.2, 2.6, 1.2, 0.4, 1.2); rippleCD = 0; addRipple(o.x, o.z, 1.0); } });
        for (let k = 0; k < 4; k++) emitP(x + (frand() - 0.5) * 0.5, 12 + k * 0.6, z + (frand() - 0.5) * 0.5, 0, -12 / w, 0, 2.6, 1.0, 0.25, w, 0.35 - k * 0.05, 4);
      });
    },
    FrontalHymn() {
      castBar('Frontal Hymn', 1.6); sfx.growl();
      B1.cleaving = true;
      teleCone(0, 0, aimAt(0, 0), 52 * Math.PI / 180, 14, 1.6, 18, R, {
        lockAt: 0.3,
        follow: (o) => { teleSetCone(o, 0, 0, aimAt(0, 0), o.half, 14); B1.heartYawTarget = o.ang; },
        onResolve: (o) => {
          B1.cleaving = false; addTrauma(0.4); bloomSpike(0.8); sfx.boom(); B1.heartU.uFlash.value = 1;
          for (let k = 0; k < 60; k++) { const a = o.ang + (frand() - 0.5) * 2 * o.half, sp = 6 + frand() * 12; emitP(Math.cos(a) * 1.5, 1 + frand(), Math.sin(a) * 1.5, Math.cos(a) * sp, frand() * 2, Math.sin(a) * sp, 2.6, 0.7, 0.2, 0.8, 0.25, 0); }
          shockAt(0, 1, 0, 0.04);
        },
      });
    },
  },
  update(dt) {
    const t = fx.simTime;
    B1.orbitT += dt * (bossRT.phase === 1 ? 0.42 : 0.3);
    const beatRate = bossRT.phase === 1 ? 1.8 : 1.2;
    B1.beat = Math.pow(Math.max(0, Math.sin(t * beatRate * Math.PI)), 12);
    const hu = B1.heartU; hu.uTime.value = t; hu.uPulse.value = B1.beat; hu.uCrack.value = damp(hu.uCrack.value, bossRT.vuln > 0 ? 1 : 0, 6, dt);
    hu.uFracture.value = bossRT.fracture >= 100 ? 1 : 0;
    if (hu.uFlash.value > 0) hu.uFlash.value = Math.max(0, hu.uFlash.value - dt * 4);
    if (bossRT.flash > 0) hu.uFlash.value = Math.max(hu.uFlash.value, 0.07);
    if (bossRT.lanceFlash > 0) hu.uFlash.value = Math.max(hu.uFlash.value, 0.55);
    floorU.uBeat.value = B1.beat;
    if (B1.mode === 'fight') teleHC.value = bossRT.phase === 1 ? 1 : 0;
    const hb = 1 + 0.08 * B1.beat; B1.heart.scale.set(1.35 * hb, 1.35 * hb, 1.35 * hb);
    B1.heart.position.y = 2.1 + Math.sin(t * 0.9) * 0.12;
    // heart faces the camera mostly; during cleave turn toward player
    const want = B1.cleaving ? B1.heartYawTarget : Math.PI / 2;
    B1.heartYaw = B1.heartYaw + wrapA(want - B1.heartYaw) * (1 - Math.exp(-5 * dt));
    B1.heart.rotation.set(0, Math.PI / 2 - B1.heartYaw + Math.sin(t * 0.5) * 0.15, Math.sin(t * 0.7) * 0.05);
    B1.flameU.uTime.value = t; B1.flame.quaternion.copy(camera.quaternion);
    B1.flame.position.set(Math.sin(t) * 0.05, 2.7 + B1.beat * 0.1, 0);
    B1.flameMatU.uTime.value = t;
    // floating candles drift
    const arr = B1.candles.instanceMatrix.array, arr2 = B1.flames.instanceMatrix.array;
    for (let k = 0; k < B1.NF; k++) {
      const j = k * 4; B1.floatData[j] += B1.floatData[j + 3] * dt; const a = B1.floatData[j], r = B1.floatData[j + 1];
      const o = (B1.NC + k) * 16; const x = Math.cos(a) * r, z = Math.sin(a) * r, y = Math.sin(t * 1.2 + B1.floatData[j + 2]) * 0.03 - 0.05;
      arr[o + 12] = arr2[o + 12] = x; arr[o + 13] = arr2[o + 13] = y; arr[o + 14] = arr2[o + 14] = z;
    }
    B1.candles.instanceMatrix.needsUpdate = true; B1.flames.instanceMatrix.needsUpdate = true;
    B1.candles.count = B1.flames.count = Math.min(B1.NC, Q.cfg.candles) + B1.NF;
    // lanterns
    for (let i = 0; i < 8; i++) {
      const L = B1.lanterns[i]; L.t += dt;
      L.last.copy(L.pos);
      if (L.mode === 0 || L.mode === 1) { b1LanternOrbitPos(i, _v1); if (L.mode === 1) _v1.y += 0.4; L.pos.lerp(_v1, 1 - Math.exp(-5 * dt)); }
      else if (L.mode === 2) { // aiming swoop: hover low, shiver
        _v1.copy(L.from); _v1.x += Math.sin(t * 40 + i) * 0.05; L.pos.lerp(_v1, 1 - Math.exp(-6 * dt));
      } else if (L.mode === 3) { // dive
        const k = Math.min(1, L.t / 0.38); const e = easeIn(k * 0.6 + 0.4 * k);
        const prev = Math.floor(L.prevK * 6); L.prevK = k;
        L.pos.set(L.from.x + L.dir.x * 12 * e, lerp(L.from.y, 0.9, k), L.from.z + L.dir.y * 12 * e);
        const now = Math.floor(k * 6);
        if (now > prev && now <= 6) { const side = (now % 2 ? 1 : -1); const pa = Math.atan2(L.dir.y, L.dir.x) + side * Math.PI / 2; shoot(L.pos.x, L.pos.z, pa, 1.2, R, 0.3, 10, 7); }
        for (let q = 0; q < 2; q++) emitP(L.pos.x, L.pos.y, L.pos.z, (frand() - 0.5) * 2, frand() * 2, (frand() - 0.5) * 2, 2.6, 0.9, 0.25, 0.6, 0.25, 3);
        if (k >= 1) { L.mode = 0; L.glowT = 1; tryRipple(L.pos.x, L.pos.z, 1.0); }
      } else if (L.mode === 5) { // chorus circle above heart
        const ca = (B1.chorusA0 || 0) + i * TAU / 8 + (B1.chorusDirNow || 1) * Math.max(0, L.t - 2) * 22 * Math.PI / 180;
        _v1.set(Math.cos(ca) * 2.8, 5.4, Math.sin(ca) * 2.8); L.pos.lerp(_v1, 1 - Math.exp(-6 * dt)); L.glowT = 2;
      } else if (L.mode === 4) { // dark, falling
        L.fallV += 6 * dt; L.pos.y = Math.max(0.15, L.pos.y - L.fallV * dt);
        if (L.pos.y <= 0.15 && !L.splashed) { L.splashed = true; addRipple(L.pos.x, L.pos.z, 1.2); burst(L.pos.x, 0.1, L.pos.z, 10, 0.4, 0.4, 0.5, 2, 0.6, 0.12, 1, 0); }
      }
      if (L.mode === 0 || L.mode === 1) L.mode0Ready = true;
      L.glow = damp(L.glow, L.glowT * L.ign * (1 - L.dark), 8, dt);
      L.u.uGlow.value = L.glow; L.u.uTime.value = t; L.u.uFire.value = damp(L.u.uFire.value, B1.fire, 3, dt); L.u.uDark.value = L.dark;
      if (L.u.uFlash.value > 0) L.u.uFlash.value = Math.max(0, L.u.uFlash.value - dt * 3);
      L.g.position.copy(L.pos);
      // face the player (face is on local +z)
      const fx_ = (B1.mode === 'fight' ? player.x : camera.position.x) - L.pos.x, fz = (B1.mode === 'fight' ? player.z : camera.position.z) - L.pos.z;
      L.g.rotation.set(Math.sin(t * 1.1 + i) * 0.08, Math.atan2(fx_, fz), Math.sin(t * 0.9 + i * 2) * 0.08);
      if (L.mode === 4) L.g.rotation.z = 0.6;
      const vx = (L.pos.x - L.last.x) / Math.max(dt, 1e-4), vz = (L.pos.z - L.last.z) / Math.max(dt, 1e-4), vy = (L.pos.y - L.last.y) / Math.max(dt, 1e-4);
      for (let k = 0; k < 2; k++) {
        const rb = L.ribbons[k]; rb.position.set(L.pos.x + (k ? 0.12 : -0.12), L.pos.y - 0.6, L.pos.z);
        const u = rb.material.uniforms; u.uTime.value = t; u.uFire.value = B1.fire; u.uA.value = L.ign * (1 - L.dark * 0.7);
        u.uBack.value.x = damp(u.uBack.value.x, clamp(-vx * 0.25, -2, 2), 4, dt); u.uBack.value.z = damp(u.uBack.value.z, clamp(-vz * 0.25, -2, 2), 4, dt); u.uBack.value.y = damp(u.uBack.value.y, clamp(-vy * 0.1, -1, 1), 4, dt);
        rb.visible = L.ign > 0.01;
      }
      // fire particles in phase 2
      if (B1.fire > 0.5 && L.dark < 0.5 && frand() < (Q.name === 'high' ? 0.25 : Q.name === 'med' ? 0.16 : 0.08)) emitP(L.pos.x + (frand() - 0.5) * 0.5, L.pos.y + 0.3, L.pos.z + (frand() - 0.5) * 0.5, (frand() - 0.5) * 0.6, 1.5 + frand() * 1.5, (frand() - 0.5) * 0.6, 2.6, 0.8, 0.2, 0.7, 0.28, 3);
    }
    if (B1.fire > 0.5 && frand() < 0.5) { const a = frand() * TAU; emitP(Math.cos(a) * 1.0, 1.8 + frand(), Math.sin(a) * 0.5, (frand() - 0.5), 2 + frand() * 2, (frand() - 0.5), 2.6, 0.7, 0.15, 0.9, 0.35, 3); }
    // falling paper lanterns
    for (const d of B1.drops) {
      if (!d.active) continue; d.t += dt; const k = d.t / d.dur;
      d.m.position.set(d.x, lerp(14, 0.3, easeIn(Math.min(1, k))), d.z); d.m.rotation.y += dt * 3; d.m.rotation.z = Math.sin(d.t * 5) * 0.2;
      if (k >= 1) { d.active = false; d.m.visible = false; }
    }
    B1.dropMat.uniforms.uTime.value = t;
    // floor light blobs: heart + 3 lanterns nearest the player
    const Lv = floorU.uLights.value, Lc = floorU.uLightCol.value;
    const heartI = B1.heart.visible ? (1.0 + B1.beat * 0.6) * (1 - hu.uDark.value) : 0;
    Lv[0].set(0, 2.1, 0, heartI * 0.9); if (B1.fire > 0.5) Lc[0].setRGB(1.0, 0.45, 0.1); else Lc[0].setRGB(1.0, 0.12, 0.18);
    let i1 = -1, i2 = -1, i3 = -1, d1 = 1e9, d2 = 1e9, d3 = 1e9;
    for (let i = 0; i < 8; i++) { const L = B1.lanterns[i]; const d = (L.pos.x - player.x) ** 2 + (L.pos.z - player.z) ** 2; if (d < d1) { d3 = d2; i3 = i2; d2 = d1; i2 = i1; d1 = d; i1 = i; } else if (d < d2) { d3 = d2; i3 = i2; d2 = d; i2 = i; } else if (d < d3) { d3 = d; i3 = i; } }
    const ids = [i1, i2, i3];
    for (let k = 0; k < 3; k++) { const L = B1.lanterns[ids[k]]; Lv[k + 1].set(L.pos.x, L.pos.y, L.pos.z, L.glow * 0.55); Lc[k + 1].setRGB(1.0, 0.5, 0.2); }
    floorU.uBossPos.value.set(0, 0); floorU.uBossShadow.value = B1.heart.visible ? 1 : 0;
    // tutorial prompts
    if (game.state === 'fight' && bossRT.phase === 0) {
      if (player.r >= 35) ui.tutorial('lance', IS_TOUCH ? 'Crimson Lance ready — spend RED' : 'Crimson Lance ready — spend RED  [1 / Q / Click]');
      else if (player.b >= 35 && game.fightTime > 12) ui.tutorial('mirror', IS_TOUCH ? 'Azure Mirror reflects shots' : 'Azure Mirror reflects shots  [3 / E]');
    }
  },
  // ---- cinematics ----
  introCine() {
    const keys = [[0, 0, 40, 25, 0, 0, 2, 64], [1.25, 0, 14, 18.5, 0, 0, 4, 46], [2.2, 0, 10, 16, 0, 1, 3.5, 47], [3.5, 0, 3.4, 10.8, 0, 2.7, 0, 44], [4.6, 0, 4.6, 11.8, 0, 2.5, 0, 45], [5.0, 0, 6, 13, 0, 2.2, 0, 48]];
    return {
      dur: 5.0, skippable: 0.8, skipTo: 4.7,
      start() {
        BOSS1.setTitleMode(); B1.mode = 'intro'; playerG.visible = false; player.x = 0; player.z = 7; starU.uStreak.value = 1; ui.hud(false);
        sfx.fall();
      },
      update(t) {
        camKeys(t, keys);
        starU.uStreak.value = Math.max(0, 1 - t / 1.25);
        B1.flameMatU.uIgR.value = t < 1.3 ? 0 : t > 2.9 ? 99 : (t - 1.3) / 1.4 * 23;
      },
      ev: [
        [0.95, () => { reform(0, 1.15, 7, 70, 0.4, 1.4, 1.6, 2.2, 6); }],
        [1.35, () => { playerG.visible = true; ring(0, 0.06, 7, 0.3, 6, 0.8, 0.35, 2, 2.2, 2.6, 1.6); rainbowWave(0, 7, 1.2); bloomSpike(1.5); addTrauma(0.5); sfx.boom(); addRipple(0, 7, 1.5); burstRainbow(0, 0.5, 7, 80, 7, 1.0, 0.18, 4); }],
        ...Array.from({ length: 8 }, (_, i) => [2.2 + i * 0.25, () => { const L = B1.lanterns[i]; L.ign = 1; L.u.uFlash.value = 1.2; burst(L.pos.x, L.pos.y, L.pos.z, 24, 2.6, 1.2, 0.4, 3, 0.8, 0.18, 1, 3); sfx.chime(i); }]),
        [2.3, () => { B1.heart.visible = true; B1.heartU.uFlash.value = 1; }],
        [3.5, () => { ui.letterbox(true); ui.titleCard('THE LANTERN CHOIR', 'First Refraction', 2.4); music.setSection('b1p1'); }],
      ],
      end() { B1.flameMatU.uIgR.value = 99; B1.mode = 'fight'; for (const L of B1.lanterns) L.ign = 1; B1.heart.visible = true; playerG.visible = true; starU.uStreak.value = 0; },
    };
  },
  transitionCine(n) {
    let a0 = 0;
    return {
      dur: 2.2,
      start() { a0 = Math.atan2(cam.pos.z, cam.pos.x); director.timeScale = 0.25; ui.titleCard('KINDLING', '', 1.8); sfx.riser(); },
      update(t, dt) {
        const k = smooth(t / 2.2); const a = a0 + k * (120 * Math.PI / 180); const r = lerp(14, 10, Math.sin(k * Math.PI));
        director.camPos.set(Math.cos(a) * r, lerp(9, 3.5, Math.sin(k * Math.PI)), Math.sin(a) * r); director.camLook.set(0, 2.2, 0); director.fov = 52;
        if (t > 0.9) floorU.uPalRadius.value = Math.min(40, (t - 0.9) / 1.2 * 26);
        if (t > 1.6) director.timeScale = lerp(0.25, 1, (t - 1.6) / 0.6);
      },
      ev: [
        [0.3, () => { B1.heart.visible = false; shatter(0, 2.1, 0, 1.2, 120, 1.6, 0.15, 0.2, 9, 1.6, 3); sfx.shatter(1); bloomSpike(1.2); addTrauma(0.5); }],
        [0.45, () => { reform(0, 2.1, 0, 100, 0.45, 1.6, 0.7, 0.15, 8); }],
        [0.9, () => {
          B1.heart.visible = true; B1.fire = 1; B1.heartU.uFire.value = 1; B1.heartU.uFlash.value = 1; B1.flameU.uA.value = 1; B1.flameMatU.uFlare.value = 1.6;
          floorU.uPalCenter.value.set(0, 0); floorU.uPalFrom.value = 0; floorU.uPalTo.value = 1; floorU.uPalRadius.value = 0.01;
          bloomSpike(1.6); addTrauma(0.8); shockAt(0, 2, 0, 0.06); sfx.boom(); burst(0, 2.1, 0, 120, 2.6, 0.9, 0.2, 14, 1.2, 0.3, 1, 0);
          for (const L of B1.lanterns) { L.u.uFlash.value = 1; burst(L.pos.x, L.pos.y, L.pos.z, 20, 2.6, 0.8, 0.2, 4, 0.8, 0.22, 1, 3); }
          game.satTarget = Math.min(1, game.sat + 0.25);
        }],
      ],
      end() { director.timeScale = 1; floorU.uPalRadius.value = 40; },
    };
  },
  deathCine() {
    return {
      dur: 6.0,
      start() { director.timeScale = 0.6; ui.hud(false); music.setSection('silence'); },
      update(t) {
        const k = smooth(t / 6);
        director.camPos.set(Math.sin(k * 0.8) * 5, lerp(13, 7, k), lerp(16, 12, k)); director.camLook.set(0, lerp(2, 1.5, k), 0); director.fov = 50;
        if (t < 0.5) B1.flameU.uA.value = Math.max(0, 1 - t / 0.4);
        if (t > 1.3 && t < 3.3) game.sat = lerp(SAT_BOSS[0], SAT_BOSS[1], (t - 1.3) / 2);
        if (t > 1.3) floorU.uPalTo.value = Math.max(0, 1 - smooth((t - 1.3) / 2.2));
        floorU.uBeat.value = 0;
        if (t > 1.0) director.timeScale = 1;
        if (t > 1.4 && t < 4.5 && frand() < 0.7) { const a = frand() * TAU, r = frand() * 14; emitP(Math.cos(a) * r, 0.1, Math.sin(a) * r, (frand() - 0.5) * 0.3, 0.6 + frand(), (frand() - 0.5) * 0.3, 0.8, 0.75, 0.7, 3.5, 0.12, 3); }
      },
      ev: [
        [0.0, () => { B1.heartU.uFlash.value = 1; bloomSpike(1.2); sfx.boom(); }],
        ...Array.from({ length: 8 }, (_, i) => [0.4 + i * 0.08, () => { const L = B1.lanterns[i]; L.dark = 1; L.mode = 4; L.fallV = 0; L.splashed = false; sfx.chime(7 - i, 0.6); burst(L.pos.x, L.pos.y, L.pos.z, 12, 1.5, 0.8, 0.5, 2, 0.6, 0.15, 1, 3); }]),
        [1.3, () => { B1.heart.visible = false; B1.heartU.uDark.value = 1; shatter(0, 2.1, 0, 1.4, 220, 2.4, 0.4, 0.5, 11, 3.0, 6, true); burstRainbow(0, 2, 0, 160, 14, 1.5, 0.3, 0); rainbowWave(0, 0, 1.2, 14); setTimeout(() => rainbowWave(0, 0, 1.0, 12), 500); bloomSpike(1.3); addTrauma(0.9); shockAt(0, 2, 0, 0.07); sfx.shatter(1.5); sfx.victoryStab(); B1.flameMatU.uFlare.value = 0.5; }],
        [2.4, () => { ui.letterbox(true); ui.titleCard(BOSS1.deathTitle, BOSS1.deathSub); }],
      ],
      end() { game.satTarget = game.sat = SAT_BOSS[1]; ui.letterbox(false); floorU.uPalTo.value = 0; },
    };
  },
};


