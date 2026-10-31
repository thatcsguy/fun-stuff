// =====================================================================
// 10_boss2.js — QUICKSILVER LEVIATHAN + STRATOS RIBBON arena (§8).
// Banked sky loop with the Sky Gap jump, storm-sky scenery (floating
// islands, halo rings, chrome shards), an 18-segment chrome serpent
// (one InstancedMesh, procedural storm-env chrome shader), head with a
// lifting visor + four-way split jaw, 3 phases, 9 attacks, death. (BOSS2)
// =====================================================================
{
  const { THREE } = G;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const sfx = (n, o) => { try { G.audio?.sfx?.(n, o); } catch (e) { } };
  const callout = (t, s) => { try { if (G.ui && G.ui.callout) G.ui.callout(t, s); else G.emit('ui:callout', { text: t, style: s }); } catch (e) { } };
  const K = () => G.kart, T = () => G.track;
  const merge = (a) => G.addons.BufferGeometryUtils.mergeGeometries(a);

  // ---- arena layout (s values measured on this spline; L ≈ 761) ----
  const LAP0 = 30;                                  // lap gate on the long straight
  const PAD_S = 96, RAMP_S = 112, RAMP_LEN = 10, GAP0 = 124, GAP1 = 138;   // Sky Gap
  const APPROACH0 = RAMP_S - 60;                    // pincer approach band [52, 112]
  const SHOW_S = 104;                               // briefing showcase coil centre
  const W = 16;                                     // track width

  // ---- serpent constants ----
  const NSEG = 18, SP = 6.2, HMASK = 255, DEL = 7, SPLIT = 9;
  const NODE0 = 12;                                 // nodes on segments 12..17
  const RANGE = 150;
  const CHEV = 40;                                  // hazard chevron pool

  // scratch
  const V = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(),
    x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), m: new THREE.Matrix4(), m2: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
  const F = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), n: new THREE.Vector3(), w: 0, bank: 0, kappa: 0 };
  const UPV = new THREE.Vector3(0, 1, 0);
  const tsp = { s: 0, d: 0, h: 0 };               // track-space scratch

  // =================================================================
  // SHADERS
  // =================================================================
  const NOISE = /* glsl */`
    float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(mix(h13(i), h13(i+vec3(1,0,0)), f.x), mix(h13(i+vec3(0,1,0)), h13(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(h13(i+vec3(0,0,1)), h13(i+vec3(1,0,1)), f.x), mix(h13(i+vec3(0,1,1)), h13(i+vec3(1,1,1)), f.x), f.y), f.z); }`;
  // procedural storm environment for chrome (matches the storm sky, brighter so metal pops)
  const ENV = /* glsl */`
    uniform float uTime, uFlash, uDawn, uEnrage;
    vec3 envStorm(vec3 r){
      float y = r.y, az = atan(r.z, r.x);
      vec3 hor = vec3(.13, .52, .64), mid = vec3(.16, .07, .30), zen = vec3(.02, .015, .06);
      vec3 c = mix(mix(hor, mid, smoothstep(0., .28, y)), zen, smoothstep(.28, .95, y));
      if (y < 0.) c = mix(hor * .4, vec3(.012, .01, .03), smoothstep(0., -.25, y));
      c += vec3(.34, .8, 1.0) * exp(-abs(y) * 40.);                             // horizon glare line
      float band = smoothstep(.72, 1., sin(az * 3. + 1.3)) * smoothstep(.04, .3, y) * smoothstep(.85, .35, y);
      c += vec3(.75, .6, 1.25) * band * .6;                                         // lit cloud walls (studio strips)
      c += vec3(.25, .9, 1.) * smoothstep(.8, 1., sin(az * 5. - 2.)) * exp(-abs(y + .08) * 9.) * .5;
      c += vec3(1.3) * pow(max(0., dot(r, normalize(vec3(.35, .7, -.45)))), 70.) * 2.5;   // key glint
      c += vec3(.75, .8, 1.5) * uFlash * (.6 + .6 * max(y, 0.));
      vec3 dawn = mix(vec3(1.5, .72, .42), vec3(.45, .55, .95), smoothstep(-.05, .6, y)) + vec3(2., 1.2, .6) * exp(-abs(y) * 20.);
      c = mix(c, dawn, uDawn * .85);
      return c;
    }`;

  // chrome material (segments / petals / hoops / mines are instanced; head parts are not).
  // aPart: 0 chrome, 1 glow line (colour by mode), 2 gold node crystal (hidden unless data.x > 0)
  // data: x node state (0 none, 1 alive, 2 dead), y hit flash, z glow dim, w glow mode (0 blue,1 red,2 gold,3 white)
  function chromeMat(uniforms) {
    return new THREE.ShaderMaterial({
      uniforms, fog: true, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute float aPart;
        #ifdef USE_INSTANCING
        attribute vec4 iData; attribute float iSeg;
        #endif
        uniform vec4 uData;
        varying vec3 vN, vW, vL; varying float vPart, vSeg; varying vec4 vData;
        #include <fog_pars_vertex>
        void main(){
          vec4 dat = uData; float seg = 0.;
          #ifdef USE_INSTANCING
          dat = iData; seg = iSeg;
          #endif
          vec3 p = position;
          if ((aPart > 1.5 && dat.x < .5) || (aPart > 2.5 && dat.x > 1.5)) p = vec3(0.);
          mat4 m = modelMatrix;
          #ifdef USE_INSTANCING
          m = m * instanceMatrix;
          #endif
          vec4 wp = m * vec4(p, 1.);
          vN = normalize(mat3(m) * normal); vW = wp.xyz; vL = position; vPart = aPart; vSeg = seg; vData = dat;
          vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        ${ENV}
        varying vec3 vN, vW, vL; varying float vPart, vSeg; varying vec4 vData;
        #include <fog_pars_fragment>
        void main(){
          float cd = distance(vW, cameraPosition);
          if (cd < 9.) { float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))); if (ign > smoothstep(2.5, 9., cd)) discard; }
          vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
          vec3 Vd = normalize(vW - cameraPosition);
          vec3 R = reflect(Vd, N);
          float fres = pow(1. - clamp(dot(-Vd, N), 0., 1.), 3.);
          float md = vData.w;
          vec3 gc = md < .5 ? vec3(.25, .66, 1.) : md < 1.5 ? vec3(1., .14, .2) : md < 2.5 ? vec3(1., .74, .2) : vec3(.85, .92, 1.);
          vec3 col;
          if (vPart < .5) {
            vec3 e = envStorm(R);
            col = e * mix(vec3(.5, .56, .7), vec3(1.1), fres);
            col *= .86 + .14 * step(.5, fract(vL.z * .9));                 // scale rows
            col += gc * fres * .25 * (1. - vData.z);                         // inner light bleeding on the rim
          } else if (vPart < 1.5) {
            float pulse = .5 + .5 * sin(uTime * 5. - vSeg * .55 + vL.z * .3);
            float tp = pow(.5 + .5 * sin(uTime * 2.2 - vSeg * .42), 8.);           // bright wave travelling head -> tail
            col = gc * (.85 + 1.0 * pulse * pulse * pulse + 1.1 * tp) * (1. - vData.z * .92);
          } else if (vPart > 2.5) {
            float up = clamp((vL.y - 3.9) / 9., 0., 1.);
            col = vec3(1., .72, .2) * (1.3 - up) * (.75 + .25 * sin(uTime * 8. + vSeg * 2. - vL.y * .8));
          } else {
            vec3 e = envStorm(R);
            col = vData.x < 1.5 ? vec3(1., .68, .16) * (1.15 + .3 * sin(uTime * 6. + vSeg)) + e * .25 + vec3(1., .85, .45) * fres * .9
                                : e * .12 + vec3(.04, .035, .03);
          }
          col = mix(col, vec3(1., .95, .9) * 1.15, vData.y * .3) + vec3(.5, .55, .6) * vData.y * fres * .5;   // hit flash: a tint + rim, not a white-out
          col += vec3(.7, .04, .06) * uEnrage * .4 * fres;
          gl_FragColor = vec4(col, 1.);
          #include <fog_fragment>
        }`,
    });
  }
  // part geometry helpers: non-indexed (flat facets), no uv, aPart attribute
  function part(g, p) {
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv'); g.deleteAttribute('normal'); g.computeVertexNormals();
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(p), 1));
    return g;
  }
  const alongZ = (g) => g.rotateX(Math.PI / 2);    // cylinder axis y -> z

  // =================================================================
  // RIG
  // =================================================================
  let R = null;      // serpent rig + state (module scope; one boss 2 at a time)

  function buildRig(group, track) {
    const fogU = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
    const sk = G.sky?.uniforms;
    const U = { ...fogU, uTime: track.uniforms.uTime, uEnrage: track.uniforms.uEnrage, uFlash: sk?.uFlash || { value: 0 }, uDawn: sk?.uDawn || { value: 0 }, uData: { value: new THREE.Vector4(0, 0, 0, 0) } };
    const matI = chromeMat(U);                                         // instanced users
    const matH = chromeMat({ ...U, uData: { value: new THREE.Vector4(0, 0, 0, 0) } });  // head (own uData)

    // ---- segment geometry (radius 1, z = forward, absolute length) ----
    const segParts = [
      part(alongZ(new THREE.CylinderGeometry(1, 1, 4.2, 6, 1, true)), 0),
      part(alongZ(new THREE.CylinderGeometry(1.16, 1.16, 0.45, 6)).translate(0, 0, 2.0), 0),
      part(alongZ(new THREE.CylinderGeometry(1.16, 1.16, 0.45, 6)).translate(0, 0, -2.0), 0),
      part(alongZ(new THREE.CylinderGeometry(0.7, 1.05, 0.7, 6)).translate(0, 0, 2.55), 0),
      part(new THREE.BoxGeometry(0.16, 1.5, 2.8).rotateX(-0.45).translate(0, 1.55, -0.4), 0),               // dorsal blade
      part(new THREE.BoxGeometry(0.12, 0.9, 1.8).rotateX(-0.5).rotateZ(1.9).translate(1.05, -0.55, -0.6), 0),  // side fins
      part(new THREE.BoxGeometry(0.12, 0.9, 1.8).rotateX(-0.5).rotateZ(-1.9).translate(-1.05, -0.55, -0.6), 0),
      part(alongZ(new THREE.CylinderGeometry(0.52, 0.52, 6.6, 8, 1, true)), 1),                              // spine light
      part(alongZ(new THREE.TorusGeometry(1.17, 0.06, 4, 6)).rotateX(-Math.PI / 2).translate(0, 0, 2.24), 1),     // rim glow
      part(new THREE.OctahedronGeometry(1.15, 0).scale(1, 1.8, 1).translate(0, 2.7, 0.9), 2),                // node crystal
      part(new THREE.CylinderGeometry(0.1, 0.32, 9, 5, 1, true).translate(0, 8.4, 0.9), 3),                   // node beacon beam
    ];
    const segGeo = merge(segParts);
    const segs = new THREE.InstancedMesh(segGeo, matI, NSEG);
    const iData = new THREE.InstancedBufferAttribute(new Float32Array(NSEG * 4), 4); iData.setUsage(THREE.DynamicDrawUsage);
    const iSeg = new THREE.InstancedBufferAttribute(new Float32Array(NSEG), 1);
    for (let k = 0; k < NSEG; k++) iSeg.array[k] = k;
    segGeo.setAttribute('iData', iData); segGeo.setAttribute('iSeg', iSeg);
    segs.frustumCulled = false; group.add(segs);

    // ---- head (local: +z forward / mouth, +y up) ----
    const head = new THREE.Group(); head.name = 'leviathan-head'; group.add(head);
    const skull = merge([
      part(alongZ(new THREE.CylinderGeometry(2.0, 3.1, 5.2, 6)).translate(0, 0, -1.2), 0),
      part(alongZ(new THREE.CylinderGeometry(3.1, 2.4, 1.6, 6)).translate(0, 0, -4.4), 0),
      part(alongZ(new THREE.CylinderGeometry(3.35, 3.35, 0.5, 6)).translate(0, 0, -3.5), 0),
      part(new THREE.BoxGeometry(0.2, 2.6, 4.6).rotateX(-0.55).translate(0, 3.0, -3.4), 0),                  // crest
      part(new THREE.BoxGeometry(0.18, 1.8, 3.6).rotateX(-0.7).rotateZ(0.9).translate(2.4, 2.0, -3.6), 0),
      part(new THREE.BoxGeometry(0.18, 1.8, 3.6).rotateX(-0.7).rotateZ(-0.9).translate(-2.4, 2.0, -3.6), 0),
      part(alongZ(new THREE.TorusGeometry(3.38, 0.08, 4, 6)).rotateX(-Math.PI / 2).translate(0, 0, -3.2), 1),
      part(alongZ(new THREE.CylinderGeometry(0.9, 1.6, 3.4, 8, 1, true)).translate(0, 0, -1.0), 1),     // throat glow
    ]);
    head.add(new THREE.Mesh(skull, matH));
    // jagged visor: armour arc on top + spikes + glowing eye slits; hinged at the back
    const visorHinge = new THREE.Group(); visorHinge.position.set(0, 1.6, -2.6); head.add(visorHinge);
    const vparts = [part(alongZ(new THREE.CylinderGeometry(2.45, 3.25, 4.8, 6, 1, true, -Math.PI * 0.42, Math.PI * 0.84)).rotateZ(Math.PI).translate(0, -1.75, 2.2), 0)];
    for (let i = -2; i <= 2; i++) vparts.push(part(new THREE.ConeGeometry(0.32, 2.6 - Math.abs(i) * 0.35, 4).rotateX(-1.25).translate(i * 0.95, 0.9 - Math.abs(i) * 0.25, 0.5 + Math.abs(i) * 0.3), 0));
    for (const sx of [-1, 1]) vparts.push(part(new THREE.BoxGeometry(1.5, 0.22, 0.3).rotateZ(sx * 0.35).rotateY(sx * 0.5).translate(sx * 1.45, -0.3, 4.2), 1));
    vparts.push(part(new THREE.BoxGeometry(0.2, 0.2, 3.6).translate(0, 0.62, 2.6), 1));
    const visor = new THREE.Mesh(merge(vparts), matH); visorHinge.add(visor);
    // gold core inside the jaw
    const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.9, 0.25) });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), coreMat); core.position.set(0, 0, 1.6); head.add(core);
    const coreNode = new THREE.Object3D(); coreNode.position.set(0, 0, 2.2); head.add(coreNode);
    // four-way split jaw petals (instanced; each a quarter cone hinged at z=1)
    const petalGeo = merge([
      part(alongZ(new THREE.CylinderGeometry(0.25, 2.05, 4.6, 3, 1, true, Math.PI * 0.75, Math.PI * 0.5)).translate(0, 0, 2.3), 0),
      part(new THREE.BoxGeometry(0.12, 0.12, 4.2).translate(0, 1.15, 2.2).rotateX(0.38), 1),
      part(new THREE.ConeGeometry(0.22, 1.2, 3).rotateX(Math.PI / 2 + 0.6).translate(0, 0.7, 3.5), 0),       // fang
    ]);
    const petals = new THREE.InstancedMesh(petalGeo, matI, 4);
    const pData = new THREE.InstancedBufferAttribute(new Float32Array(16), 4); pData.setUsage(THREE.DynamicDrawUsage);
    petalGeo.setAttribute('iData', pData); petalGeo.setAttribute('iSeg', new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 2, 3]), 1));
    petals.frustumCulled = false; group.add(petals);

    // ---- tail crystal (P3 Tail Coil target) ----
    const tailCrystal = new THREE.Mesh(merge([part(new THREE.OctahedronGeometry(1.4, 0).scale(1, 1, 2.6), 2), part(alongZ(new THREE.TorusGeometry(1.5, 0.1, 4, 12)), 1)]), matH.clone());
    tailCrystal.material.uniforms = { ...U, uData: { value: new THREE.Vector4(1, 0, 0, 2) } };
    tailCrystal.visible = false; group.add(tailCrystal);

    // ---- mines (shed chrome scales) ----
    const mineGeo = merge([part(alongZ(new THREE.CylinderGeometry(1.7, 1.7, 0.32, 6)).rotateX(Math.PI / 2), 0),
      part(new THREE.CylinderGeometry(0.75, 0.75, 0.42, 6), 1), part(new THREE.TorusGeometry(1.55, 0.07, 4, 6).rotateX(Math.PI / 2).translate(0, 0.2, 0), 1)]);
    const mines = new THREE.InstancedMesh(mineGeo, matI, 14);
    const mData = new THREE.InstancedBufferAttribute(new Float32Array(14 * 4), 4); mData.setUsage(THREE.DynamicDrawUsage);
    mineGeo.setAttribute('iData', mData); mineGeo.setAttribute('iSeg', new THREE.InstancedBufferAttribute(new Float32Array(14), 1));
    mines.frustumCulled = false; mines.count = 14; group.add(mines);

    // ---- coil gate hoops (chrome torus + energy line, colour per instance) ----
    const hoopGeo = merge([part(new THREE.TorusGeometry(1, 0.11, 6, 6), 0), part(new THREE.TorusGeometry(0.9, 0.05, 4, 24), 1),
      part(new THREE.TorusGeometry(1.12, 0.035, 4, 24), 1)]);
    const hoops = new THREE.InstancedMesh(hoopGeo, matI, 4);
    const hData = new THREE.InstancedBufferAttribute(new Float32Array(16), 4); hData.setUsage(THREE.DynamicDrawUsage);
    hoopGeo.setAttribute('iData', hData); hoopGeo.setAttribute('iSeg', new THREE.InstancedBufferAttribute(new Float32Array([0, 3, 6, 9]), 1));
    hoops.frustumCulled = false; group.add(hoops);

    // ---- conductor's brand sigil over the kart ----
    const sigilMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 0.6, 3.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const sg = [new THREE.TorusGeometry(1.1, 0.06, 4, 32)];
    for (let i = 0; i < 3; i++) sg.push(new THREE.BoxGeometry(1.9, 0.07, 0.07).rotateZ(i * Math.PI / 3));
    sg.push(new THREE.TorusGeometry(0.55, 0.05, 4, 3));
    for (const g of sg) g.deleteAttribute('uv');
    const sigil = new THREE.Mesh(merge(sg).rotateX(-Math.PI / 2), sigilMat); sigil.visible = false; group.add(sigil);

    // lightning pylon (own mesh: positioned here, see renderPylon)
    const pylon = new THREE.Mesh(merge([part(new THREE.CylinderGeometry(0.45, 0.75, 6, 6).translate(0, 3, 0), 0), part(new THREE.OctahedronGeometry(1.1, 0).translate(0, 7.2, 0), 0),
      part(new THREE.TorusGeometry(1.5, 0.08, 4, 24).rotateX(Math.PI / 2).translate(0, 6.2, 0), 0), part(new THREE.TorusGeometry(2.2, 0.06, 4, 24).rotateX(Math.PI / 2).translate(0, 4.2, 0), 0)]),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.5, 0.35) }));
    pylon.visible = false; group.add(pylon);
    // raised hazard chevrons: ram-lane fences (0..27) + whip sweep arrows (28..39); additive, colour per instance
    const chevArm = (rz) => { const g = new THREE.BoxGeometry(1.15, 0.2, 0.06).translate(-0.575, 0, 0).rotateZ(rz); g.deleteAttribute('uv'); return g; };
    const chevs = new THREE.InstancedMesh(merge([chevArm(0.7), chevArm(-0.7)]), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }), CHEV);
    for (let i = 0; i < CHEV; i++) { chevs.setMatrixAt(i, V.m.makeScale(0, 0, 0)); chevs.setColorAt(i, new THREE.Color(0, 0, 0)); }
    chevs.frustumCulled = false; group.add(chevs);
    // bolt target nodes
    const nodeObjs = []; for (let i = 0; i < 6; i++) { const o = new THREE.Object3D(); group.add(o); nodeObjs.push(o); }
    const bodyNode = new THREE.Object3D(); group.add(bodyNode);
    const tailNode = new THREE.Object3D(); group.add(tailNode);

    const chain = (first, last) => ({ s: 0, d: 0, h: 7, dir: 1, v: 30, dT: 0, hT: 7, hd: new Float32Array(256), hh: new Float32Array(256), hi: 0, first, last, ramK: 0, on: true });
    return {
      group, pylon, chevs, segs, iData, head, visorHinge, core, coreMat, coreNode, petals, pData, tailCrystal, mines, mData, hoops, hData, sigil, nodeObjs, bodyNode, tailNode, matI, matH,
      headC: chain(0, NSEG - 1), tailC: chain(SPLIT, NSEG - 1),
      // track-space layout (sim) + world positions (prev/cur for render interpolation); index NSEG = head
      ls: new Float32Array(NSEG + 1), ld: new Float32Array(NSEG + 1), lh: new Float32Array(NSEG + 1),
      prv: new Float32Array((NSEG + 1) * 3), cur: new Float32Array((NSEG + 1) * 3),
      segScale: Float32Array.from({ length: NSEG }, (_, k) => lerp(2.8, 1.2, k / (NSEG - 1))),
      segFlash: new Float32Array(NSEG), segHidden: new Uint8Array(NSEG), nodeState: new Uint8Array(6),
      coilK: 1, coilTarget: 1, coilC: SHOW_S, coilPhase: 0, coilSpin: 0.35,
      visorK: 0, mouthK: 0, flash: 0, split: false, deathK: 0, loopC: 0, pincerK: 0, whipK: 0, whipD: 0,
      mineSlots: Array.from({ length: 14 }, () => ({ on: false, ob: null, fly: 0, s: 0, d: 0, from: new THREE.Vector3(), spin: new THREE.Vector3(), armed: false })),
      hoopSlots: Array.from({ length: 4 }, () => ({ on: false, g: null, s: 0, d: 0, gold: true, revealed: false, tele: null, t: 0 })),
    };
  }

  // =================================================================
  // SCENERY: floating islands, chrome sky shards, halo rings, gap beacons
  // =================================================================
  function rockMat(fogU, TU) {
    return new THREE.ShaderMaterial({
      uniforms: { ...fogU, uTime: TU.uTime, uFlash: G.sky?.uniforms?.uFlash || { value: 0 }, uDawn: G.sky?.uniforms?.uDawn || { value: 0 } }, fog: true,
      vertexShader: /* glsl */`
        varying vec3 vN, vW, vO;
        #include <fog_pars_vertex>
        void main(){ mat4 m = modelMatrix;
          #ifdef USE_INSTANCING
          m = m * instanceMatrix;
          #endif
          vec4 wp = m * vec4(position, 1.); vW = wp.xyz; vO = position; vN = normalize(mat3(m) * normal);
          vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uFlash, uDawn; varying vec3 vN, vW, vO;
        #include <fog_pars_fragment>
        ${NOISE}
        void main(){ vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
          float g = vn3(vO * 3.1) * .6 + vn3(vO * 7.3) * .4;
          vec3 rock = mix(vec3(.03, .03, .05), vec3(.11, .09, .15), g);
          float top = smoothstep(.2, .8, n.y);
          rock = mix(rock, vec3(.08, .13, .16) * (.7 + g * .6), top * .7);                    // mossy teal tops
          rock *= .45 + .55 * clamp(dot(n, normalize(vec3(.3, .8, -.4))), 0., 1.);
          float rim = pow(1. - clamp(dot(n, v), 0., 1.), 3.);
          rock += mix(vec3(.1, .45, .55), vec3(.45, .25, .7), clamp(n.y * .5 + .5, 0., 1.)) * rim * .6;   // storm rim light
          float vein = 1. - smoothstep(.0, .045, abs(vn3(vO * 2.2 + vec3(0., uTime * .03, 0.)) - .5));
          rock += vec3(.2, .65, 1.) * vein * (1. - top) * (.75 + .35 * sin(uTime * 2. + vO.y * 3.));          // glowing crystal veins
          rock += vec3(.6, .65, 1.) * uFlash * .25 * (n.y * .5 + .5);
          rock = mix(rock, rock * vec3(1.7, 1.25, 1.05) + vec3(.06, .03, .02), uDawn);
          gl_FragColor = vec4(rock, 1.);
          #include <fog_fragment>
        }`,
    });
  }
  const hash = (x) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function islandGeo(seed, detail) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + (hash(x * 3.1 + y * 5.7 + z * 2.3 + seed) - 0.5) * 0.35;
      if (y > 0) y *= 0.28; else { const k = -y; y = -k * k * 2.4 - k * 0.4; x *= 1 - k * 0.55; z *= 1 - k * 0.55; }
      p.setXYZ(i, x * n, y * n, z * n);
    }
    g.deleteAttribute('uv'); g.computeVertexNormals(); return g;
  }
  function buildScenery(group, track) {
    const fogU = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
    const TU = track.uniforms;
    const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3(), ee = new THREE.Euler();
    // ---- floating rock islands (one InstancedMesh) ----
    const ig = islandGeo(1, 2);
    const NI = 26;
    const islands = new THREE.InstancedMesh(ig, rockMat(fogU, TU), NI);
    for (let i = 0; i < NI; i++) {
      const s = (i / NI + hash(i * 1.7) * 0.02) * track.L;
      const f = track.frame(s, F);
      const side = i % 3 === 0 ? -1 : 1;                           // most outside the loop, some inside
      const off = 95 + hash(i * 3.3) * 300, sc = 9 + hash(i * 5.1) * 34;
      pp.copy(f.p).addScaledVector(f.r, side * (off + sc)); pp.y += (hash(i * 7.7) - 0.6) * 140;
      if (i % 5 === 0) { pp.y = f.p.y - 55 - hash(i) * 50; pp.addScaledVector(f.r, -side * off * 0.5); }  // a few close, under the track
      qq.setFromEuler(ee.set((hash(i * 2.2) - 0.5) * 0.25, hash(i * 9.1) * 6.3, (hash(i * 4.4) - 0.5) * 0.25));
      islands.setMatrixAt(i, mm.compose(pp, qq, ss.set(sc * (0.8 + hash(i) * 0.5), sc * (0.7 + hash(i * 6) * 0.6), sc * (0.8 + hash(i * 8) * 0.5))));
    }
    group.add(islands);
    // ---- drifting chrome sky shards near the track (parallax) ----
    const shardGeo = merge([part(new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.6, 0.5), 0), part(new THREE.OctahedronGeometry(0.35, 0).scale(0.5, 1.6, 0.5), 1)]);
    const shards = new THREE.InstancedMesh(shardGeo, R.matI, 40);
    const sd = new THREE.InstancedBufferAttribute(new Float32Array(160), 4), sI = new THREE.InstancedBufferAttribute(new Float32Array(40), 1);
    for (let i = 0; i < 40; i++) {
      const s = hash(i * 13.1) * track.L, f = track.frame(s, F), side = hash(i * 2.9) < 0.5 ? -1 : 1;
      pp.copy(f.p).addScaledVector(f.r, side * (16 + hash(i * 4.1) * 50)); pp.y += -12 + hash(i * 6.3) * 40;
      qq.setFromEuler(ee.set(hash(i) * 3, hash(i * 2) * 6, hash(i * 3) * 3));
      const k = 1.2 + hash(i * 8.8) * 3.5;
      shards.setMatrixAt(i, mm.compose(pp, qq, ss.set(k, k, k)));
      sd.array[i * 4 + 3] = i % 4 === 0 ? 2 : 0; sI.array[i] = i;
    }
    shardGeo.setAttribute('iData', sd); shardGeo.setAttribute('iSeg', sI);
    group.add(shards);
    // ---- giant broken halo rings the ribbon threads through (merged, chrome + glow) ----
    const rings = [];
    for (const [s, rad, tilt, arc] of [[205, 21, 0.15, 5.2], [372, 24, -0.25, 5.6], [588, 22, 0.3, 4.9], [700, 26, -0.1, 5.4]]) {
      const f = track.frame(s, F);
      V.m.makeBasis(f.r, f.n, f.t); V.m2.makeRotationZ(tilt); V.m.multiply(V.m2);
      V.m.setPosition(V.a.copy(f.p).addScaledVector(f.n, 4));
      for (const [g, p] of [[new THREE.TorusGeometry(rad, 0.9, 6, 48, arc), 0], [new THREE.TorusGeometry(rad - 0.95, 0.16, 4, 48, arc), 1], [new THREE.TorusGeometry(rad + 0.95, 0.12, 4, 48, arc), 1]]) {
        g.rotateZ(-arc / 2 - Math.PI / 2 + Math.PI); g.applyMatrix4(V.m); rings.push(part(g, p));
      }
    }
    const ringMesh = new THREE.Mesh(merge(rings), R.matH);
    group.add(ringMesh);
    // ---- Sky Gap: gold arrow chevrons on lane 0 before the pad + 2 beacon pylons at the gap edge ----
    const gold = [];
    for (let i = 0; i < 4; i++) {
      const s = PAD_S - 26 + i * 6, f = track.frame(s, F);
      V.m.makeBasis(f.r, f.n, f.t).setPosition(V.a.copy(f.p).addScaledVector(f.n, 0.09));
      for (const sx of [-1, 1]) { const g = part(new THREE.BoxGeometry(2.6, 0.05, 0.55).rotateY(sx * 0.62).translate(sx * 1.0, 0, -0.75), 0); g.applyMatrix4(V.m); gold.push(g); }
    }
    for (const sx of [-1, 1]) {
      const f = track.frame(GAP0 - 1, F);
      V.m.makeBasis(f.r, f.n, f.t).setPosition(V.a.copy(f.p).addScaledVector(f.r, sx * (W / 2 + 1.4)));
      for (const g0 of [new THREE.CylinderGeometry(0.22, 0.32, 7, 6).translate(0, 3.5, 0), new THREE.OctahedronGeometry(0.75, 0).translate(0, 7.6, 0)]) { const g = part(g0, 0); g.applyMatrix4(V.m); gold.push(g); }
    }
    const goldMesh = new THREE.Mesh(merge(gold), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.15, 0.28), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    group.add(goldMesh);
  }

  // =================================================================
  // SERPENT SIMULATION (track space)
  // =================================================================
  function pushHist(c) { c.hd[c.hi] = c.d; c.hh[c.hi] = c.h; c.hi = (c.hi + 1) & HMASK; }
  function fillHist(c) { c.hd.fill(c.d); c.hh.fill(c.h); }
  // helix coil around the track (k = 0..17, head side at the low-s end)
  function helix(k, out) {
    const th = R.coilPhase + k * 0.496;
    out.s = R.coilC - 22 + k * 2.55; out.d = 12.5 * Math.sin(th); out.h = 6 + 12.5 * Math.cos(th);
    return out;
  }
  // vertical death loop in the (s, h) plane
  function loopPos(k, out) {
    const a = (k + 1) / (NSEG + 1) * Math.PI * 2 + R.deathK * 0.6;
    out.s = R.loopC + Math.sin(a) * 19; out.d = 0; out.h = 22 - Math.cos(a) * 19; return out;
  }
  function blendTo(i, o, k) {
    if (k <= 0) return;
    const Tr = T(); R.ls[i] = Tr.wrap(R.ls[i] + Tr.ds(R.ls[i], o.s) * k); R.ld[i] = lerp(R.ld[i], o.d, k); R.lh[i] = lerp(R.lh[i], o.h, k);
  }
  // control one chain for this tick
  function steerChain(b, c, dt, isTail) {
    const Tr = T(), k = K(), m = b.mem;
    const mode = isTail ? 'chase' : m.mode;
    if (mode === 'chase' || mode === 'idle') {
      const back = isTail ? SP * (c.last - c.first) : SP * (c.last + 1);
      const gap = isTail ? 40 : 45;
      const target = Tr.wrap(k.s + gap + back);
      const err = Tr.ds(c.s, target);
      let v = k.sdot + clamp(err * 1.2, -15, 15);
      if (b.staggered) v = Math.max(8, k.sdot - 10);
      c.v = clamp(v, b.staggered ? 6 : 26, m.catchup ? 85 : 48);
      if (Math.abs(err) < 12) m.catchup = false;
      c.dT = Math.sin(b.clk * 0.45 + (isTail ? 2 : 0)) * 4.5;
      c.hT = (b.staggered ? 4 : 9.5) + Math.sin(b.clk * 0.8) * 1.8;
      c.dir = 1;
    } else if (mode === 'headon') {
      c.dir = -1;
      c.v = b.staggered ? 7 : 40 * (m.tailDead ? 1.2 : 1) * (b.enrage >= 1 ? 1.1 : 1);
      if (c.ramK <= 0) c.dT = Math.sin(b.clk * 0.35) * 4;
      c.hT = lerp(b.staggered ? 4 : 7 + Math.sin(b.clk * 0.7) * 1.5, 1.5, c.ramK);
    } else if (mode === 'rise') { c.hT = 48; c.v = 30; }
    c.s = Tr.wrap(c.s + c.dir * c.v * dt);
    const dRate = c.ramK > 0 ? 14 : 5;
    c.d += clamp(c.dT - c.d, -dRate * dt, dRate * dt);
    c.h += (c.hT - c.h) * Math.min(1, dt * (mode === 'rise' ? 1.6 : 2.2));
    pushHist(c);
  }
  // compute the track-space layout of all segments + head, then world positions
  const CAM_CLR = 6.4;                              // camera sits ~2.4 m above the track; keep segments 3+ m over it
  function layout(b) {
    const Tr = T(), t = b.clk, hc = R.headC, tc = R.tailC, kS = Tr.wrap(K().s - 3);
    for (let k = 0; k < NSEG; k++) {
      const c = R.split && k >= SPLIT ? tc : hc;
      const j = c === tc ? k - SPLIT : k + 1;            // head chain: seg k is k+1 spacings behind the head
      const idx = (c.hi - 1 - DEL * Math.max(1, j)) & HMASK;
      R.ls[k] = Tr.wrap(c.s - c.dir * SP * j);
      R.ld[k] = c.hd[idx];
      let h = c.hh[idx] + Math.sin(t * 2 + k * 0.5) * 1.2;
      if (c === hc && hc.ramK > 0) h = Math.max(h, lerp(h, Math.min(1.5 + j * 2.6, 14), hc.ramK));   // body arches up behind a diving head
      // the body bridges over the kart + camera (head-on passes, rise, catching a staggered tail): never through the lens; only the head dives
      if (R.deathK < 0.01 && b.mem.mode !== 'idle') {
        const dk = Math.abs(Tr.ds(kS, R.ls[k]));
        if (dk < 26) { const need = CAM_CLR + R.segScale[k] * 1.25; h += Math.max(0, need - h) * (1 - sm((dk - 13) / 13)); }
      }
      R.lh[k] = h;
      // tail whip: last segments of the tail-bearing chain lash toward the strip
      if (R.whipK > 0 && k >= NSEG - 5) { const w = R.whipK * (k - (NSEG - 6)) / 5; R.ld[k] = lerp(R.ld[k], R.whipD, w); R.lh[k] = lerp(R.lh[k], 1.4, w); }
    }
    R.ls[NSEG] = hc.s; R.ld[NSEG] = hc.d; R.lh[NSEG] = hc.h;
    // once the head is past the kart it swoops up over the chase camera instead of through it
    if (hc.dir < 0 && R.deathK < 0.01) { const rel = Tr.ds(K().s, hc.s); if (rel < 0 && rel > -40) R.lh[NSEG] += Math.max(0, CAM_CLR + 2.5 - hc.h) * sm(-rel / 6) * (1 - sm((-rel - 25) / 15)); }
    // coil (helix) override for the head chain
    if (R.coilK > 0.001) {
      const kk = sm(R.coilK), n = R.split ? SPLIT : NSEG;
      for (let k = 0; k < n; k++) blendTo(k, helix(k, tsp), kk);
      tsp.s = R.coilC - 27; tsp.d = 0; tsp.h = 9.5; blendTo(NSEG, tsp, kk);
    }
    // pincer: head hovers over the far side of the gap, mouth open
    if (R.pincerK > 0.001) { tsp.s = GAP1 + 26; tsp.d = 0; tsp.h = 11; blendTo(NSEG, tsp, sm(R.pincerK)); for (let k = 0; k < 4; k++) { tsp.s = GAP1 + 26 + (k + 1) * SP * 0.8; tsp.d = 0; tsp.h = 11 + (k + 1) * 2.2; blendTo(k, tsp, sm(R.pincerK) * (1 - k * 0.22)); } }
    // death loop
    if (R.deathK > 0.001) { const kk = sm(R.deathK); for (let k = 0; k < NSEG; k++) blendTo(k, loopPos(k, tsp), kk); tsp.s = R.loopC + 4; tsp.d = 0; tsp.h = 3.6; blendTo(NSEG, tsp, kk); }
    // world positions
    R.prv.set(R.cur);
    for (let i = 0; i <= NSEG; i++) {
      Tr.toWorld(R.ls[i], R.ld[i], R.lh[i], V.a);
      R.cur[i * 3] = V.a.x; R.cur[i * 3 + 1] = V.a.y; R.cur[i * 3 + 2] = V.a.z;
    }
    if (R.snap) { R.prv.set(R.cur); R.snap = false; }
  }
  // teleport a chain through a "portal" (fx at both ends)
  function portal(c, s, dir, h) {
    const Tr = T();
    if (c === R.headC) { V.a.fromArray(R.cur, NSEG * 3); portalFx(V.a); }
    c.s = Tr.wrap(s); c.dir = dir; c.h = c.hT = h; c.d = c.dT = 0; c.ramK = 0; fillHist(c); R.snap = true;
    Tr.toWorld(c.s, 0, h, V.b); portalFx(V.b);
  }
  function portalFx(p) {
    G.fx?.shockwave?.(p, { color: 0x3fa9ff, radius: 20, dur: 0.7, normal: V.e.copy(G.camera.position).sub(p).normalize(), thick: 0.08 });
    G.fx?.shockwave?.(p, { color: 0xc04bff, radius: 12, dur: 0.5, normal: V.e });
    G.fx?.burst?.('lightning', p, { count: 50, scale: 2.5 }); G.fx?.burst?.('chrome', p, { count: 30 });
    sfx('thunder', { vol: 0.6 });
  }

  // =================================================================
  // RENDER (interpolated world transforms -> instance matrices)
  // =================================================================
  function segWorld(i, alpha, out) { const a = i * 3; return out.set(lerp(R.prv[a], R.cur[a], alpha), lerp(R.prv[a + 1], R.cur[a + 1], alpha), lerp(R.prv[a + 2], R.cur[a + 2], alpha)); }
  function orient(pos, fwdTo, fwdFrom, s, out) {
    // z = forward, side hint = track R blended toward T while coiled (helix tangents run across R)
    V.z.copy(fwdTo).sub(fwdFrom); if (V.z.lengthSq() < 1e-6) V.z.set(0, 0, 1); V.z.normalize();
    const f = T().frame(s, F);
    V.x.copy(f.r).multiplyScalar(1 - R.coilK).addScaledVector(f.t, R.coilK + R.deathK * 0);
    V.y.crossVectors(V.x, V.z); if (V.y.lengthSq() < 1e-4) V.y.copy(f.n); V.y.normalize();
    if (V.y.dot(f.n) < -0.2 && R.coilK < 0.5) V.y.negate();
    V.x.crossVectors(V.y, V.z).normalize();
    return out.makeBasis(V.x, V.y, V.z).setPosition(pos);
  }
  function render(b, rdt, alpha) {
    if (!R) return;
    const t = G.time.now, ia = R.iData.array;
    for (let k = 0; k < NSEG; k++) {
      segWorld(k, alpha, V.a);
      segWorld(k === 0 ? NSEG : k - 1, alpha, V.b); segWorld(k === NSEG - 1 ? k : k + 1, alpha, V.c);
      if (k === NSEG - 1) V.c.copy(V.a).multiplyScalar(2).sub(V.b);
      if (R.split && k === SPLIT - 1) V.c.copy(V.a).multiplyScalar(2).sub(V.b);   // torn end
      if (R.split && k === SPLIT) { segWorld(k + 1, alpha, V.c); V.b.copy(V.a).multiplyScalar(2).sub(V.c); }
      orient(V.a, V.b, V.c, R.ls[k], V.m);
      const sc = R.segHidden[k] ? 0 : R.segScale[k];
      V.m.scale(V.s.set(sc, sc, sc > 0 ? 1 : 0));
      R.segs.setMatrixAt(k, V.m);
      const ni = k - NODE0;
      ia[k * 4] = ni >= 0 ? (R.nodeState[ni] === 1 ? 1 : 2) : 0;
      ia[k * 4 + 1] = Math.max(R.segFlash[k], R.flash * 0.35);
      ia[k * 4 + 2] = (ni >= 0 && R.nodeState[ni] === 2) ? 0.85 : b.staggered ? 0.5 + 0.5 * Math.sin(t * 30 + k) : 0;
      ia[k * 4 + 3] = b.enrage >= 1 ? 1 : 0;
      // bolt nodes ride on top of their segment
      if (ni >= 0) R.nodeObjs[ni].position.copy(V.a).addScaledVector(V.y, 2.7 * R.segScale[k]);
      if (k === NSEG - 1) { R.tailNode.position.copy(V.a).addScaledVector(V.z, -3.2); R.tailCrystal.position.copy(R.tailNode.position); R.tailCrystal.quaternion.setFromRotationMatrix(V.m); R.tailCrystal.rotateZ(t * 2); }
    }
    R.segs.instanceMatrix.needsUpdate = true; R.iData.needsUpdate = true;
    // body bolt node: segment nearest to the kart
    let best = 1e9, bi = 6; const kp = K().worldPos;
    for (let k = 0; k < NSEG; k++) { if (R.segHidden[k]) continue; const dx = R.cur[k * 3] - kp.x, dy = R.cur[k * 3 + 1] - kp.y, dz = R.cur[k * 3 + 2] - kp.z, q = dx * dx + dy * dy + dz * dz; if (q < best) { best = q; bi = k; } }
    R.bodyNode.position.fromArray(R.cur, bi * 3);
    // head
    segWorld(NSEG, alpha, V.a); segWorld(0, alpha, V.c);
    if (R.deathK > 0.5) V.c.copy(V.a).add(V.d.set(0, 1, 0));
    orient(V.a, V.a, V.c, R.ls[NSEG], V.m);
    R.head.position.copy(V.a); R.head.quaternion.setFromRotationMatrix(V.m);
    const hs = R.headHidden ? 0.0001 : 1; R.head.scale.setScalar(hs);
    R.visorHinge.rotation.x = -R.visorK * 0.62;
    R.head.updateMatrixWorld(true);
    // jaw petals: hinge at z=1, opened by mouthK
    const pd = R.pData.array;
    for (let i = 0; i < 4; i++) {
      V.m2.makeRotationZ(i * Math.PI / 2); V.m.makeRotationX(-(0.12 + R.mouthK * 0.75)); V.m2.multiply(V.m);
      V.m.makeTranslation(0, 0, 0.6); V.m.multiply(V.m2);
      V.m2.multiplyMatrices(R.head.matrixWorld, V.m);
      R.petals.setMatrixAt(i, V.m2);
      pd[i * 4] = 0; pd[i * 4 + 1] = R.flash * 0.6; pd[i * 4 + 2] = 0.5; pd[i * 4 + 3] = b.enrage >= 1 ? 1 : 2 - (R.mouthK > 0.3 ? 0 : 2);
    }
    R.petals.instanceMatrix.needsUpdate = true; R.pData.needsUpdate = true;
    // ramming: head glow turns red and dims (the gold core/throat no longer blooms into a white blob)
    const ramming = !!(b.mem.ram && R.headC.ramK > 0.2);
    R.matH.uniforms.uData.value.set(0, R.flash * 0.6, ramming ? 0.6 : 0.35, (b.enrage >= 1 || ramming) ? 1 : 0);
    if (ramming) R.coreMat.color.setRGB(1.2, 0.18, 0.1);
    else { const cg = (0.7 + R.mouthK * 0.5 + R.flash * 0.6) * (b.staggered ? 1.4 : 1); R.coreMat.color.setRGB(1.4 * cg, 0.9 * cg, 0.25 * cg); }
    R.core.getWorldPosition(V.d);
    R.core.scale.setScalar((0.8 + R.mouthK * 0.5 + Math.sin(t * 12) * 0.05) * Math.max(0.0001, sm((V.d.distanceTo(G.camera.position) - 4) / 6)));
    renderMines(alpha); renderHoops(); renderSigil(b); renderChevs(b);
  }

  // ---- raised hazard chevrons: ram-lane fences (point at the kart, scroll toward it) + whip sweep arrows ----
  const chevCol = new THREE.Color();
  function chevAt(i, s, d, h, dirX, sc, r, g, bl) {
    const f = T().frame(s, F);
    T().toWorld(s, d, h, V.a);
    const cd = V.a.distanceTo(G.camera.position);
    const k = sc * sm((cd - 5) / 9) * (1 + clamp((cd - 40) / 80, 0, 1));   // grow with range so the lane reads far out                                     // never fill the lens
    if (k <= 0.01) { R.chevs.setMatrixAt(i, V.m.makeScale(0, 0, 0)); return; }
    if (dirX) V.x.copy(f.r).multiplyScalar(dirX); else V.x.copy(f.t).negate();
    V.z.crossVectors(V.x, f.n);
    V.m.makeBasis(V.x, f.n, V.z).setPosition(V.a); V.m.scale(V.s.set(k, k, k));
    R.chevs.setMatrixAt(i, V.m); R.chevs.setColorAt(i, chevCol.setRGB(r * Math.min(k, 1.2), g * Math.min(k, 1.2), bl * Math.min(k, 1.2)));
  }
  function renderChevs(b) {
    const m = b.mem, t = G.time.now, Tr = T();
    for (let i = 0; i < CHEV; i++) R.chevs.setMatrixAt(i, V.m.makeScale(0, 0, 0));
    const r = m && m.ram, c = R.headC;
    if (r && !r.done && b.state === 'fight') {
      const hw = laneW() / 2, fin = sm(r.t / 0.35), pul = 0.8 + 0.2 * Math.sin(t * 18);
      for (let e = 0; e < 2; e++) for (let i = 0; i < 14; i++) {
        const u = (i * 4.6 + t * 16) % 64.4;
        const fade = fin * (1 - sm((u - 52) / 12)) * pul;
        chevAt(e * 14 + i, Tr.wrap(c.s - 2 - u), r.d + (e ? hw : -hw), 1.7, 0, fade * 1.7, 1.25, 0.03, 0.07);
      }
    }
    const h = R.whipH;
    if (h && (h.state === 'fill' || h.state === 'flash' || h.state === 'live')) {
      const fin = h.state === 'live' ? 1 - h.liveT / h.active : sm(h.t / 0.3);
      for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
        const u = ((i + (t * 1.6) % 1) / 6);                              // 0..1 across, scrolling in the sweep direction
        const d = R.whipDir * lerp(-W / 2 + 0.8, W / 2 - 0.8, u);
        chevAt(28 + row * 6 + i, Tr.wrap(h.s0 + 1.5 + row * 11), d, 1.1, R.whipDir, fin * (0.6 + 0.4 * Math.sin(u * Math.PI)), 1.3, 0.4, 1.9);
      }
    } else if (h && h.state !== 'fade') R.whipH = null;
    R.chevs.instanceMatrix.needsUpdate = true; if (R.chevs.instanceColor) R.chevs.instanceColor.needsUpdate = true;
  }

  // ---- mines (shed scales) ----
  function renderMines() {
    const Tr = T(), md = R.mData.array, t = G.time.now;
    for (let i = 0; i < R.mineSlots.length; i++) {
      const m = R.mineSlots[i];
      if (m.on && m.ob && !m.ob.alive) { m.on = false; m.ob = null; }
      if (!m.on) { V.m.makeScale(0, 0, 0); R.mines.setMatrixAt(i, V.m); continue; }
      const f = Tr.frame(m.ob ? m.ob.s : m.s, F);
      V.b.copy(f.p).addScaledVector(f.r, m.ob ? m.ob.d : m.d).addScaledVector(f.n, 0.35);
      if (m.fly < 1) {   // tumbling flight from the body to the landing spot
        const u = Math.max(0, m.fly); V.a.lerpVectors(m.from, V.b, u); V.a.y += Math.sin(u * Math.PI) * 14;
        V.m.makeRotationFromEuler(eul.set(m.spin.x * t * 4, m.spin.y * t * 4, m.spin.z * t * 4)).setPosition(V.a);
      } else {
        V.m.makeBasis(f.r, f.n, f.t); V.m2.makeRotationY(t * 1.5 + i); V.m.multiply(V.m2); V.m.setPosition(V.b);
      }
      R.mines.setMatrixAt(i, V.m);
      md[i * 4] = 0; md[i * 4 + 1] = m.armed ? (Math.sin(t * 16) > 0.3 ? 0.35 : 0) : 0; md[i * 4 + 2] = 0; md[i * 4 + 3] = m.armed ? 1 : 0;
    }
    R.mines.instanceMatrix.needsUpdate = true; R.mData.needsUpdate = true;
  }
  const eul = new THREE.Euler();
  function updateMines(dt) {
    for (const m of R.mineSlots) if (m.on && m.fly < 1) {
      m.fly = Math.min(1, m.fly + dt / 0.9);
      if (m.fly >= 1) landMine(m);
    }
  }
  function landMine(m) {
    const Tr = T();
    Tr.toWorld(m.s, m.d, 0.3, V.a); G.fx?.burst?.('chrome', V.a, { count: 16 });
    m.ob = G.obstacles.add({ s: m.s, d: m.d, h: 0, r: 2.5, dmg: -1, dashable: true, src: 'mine',
      update: (dt2, ob) => {
        if (ob.t >= 1.2 && !m.armed) { m.armed = true; ob.dmg = 20; }
        if (ob.t >= 8) { Tr.toWorld(ob.s, ob.d, 0.5, V.a); G.fx?.burst?.('explosion', V.a, { count: 30, scale: 0.6, color: 0x9fd8ff }); G.obstacles.remove(ob); }
      },
      onHit: (ob) => { Tr.toWorld(ob.s, ob.d, 0.5, V.a); G.fx?.burst?.('explosion', V.a, { count: 40, scale: 0.7 }); G.obstacles.remove(ob); },
      onDestroyed: (ob) => { Tr.toWorld(ob.s, ob.d, 0.5, V.a); G.fx?.shards?.(V.a, 16, 0xd8ecff, { speed: 1, size: 0.6 }); } });
    m.armed = false;
    G.tele.spawn({ shape: 'circle', kind: 'damage', r: 2.5, s: m.s, d: m.d, windup: 1.2, exact: true, visualOnly: true, src: 'mineFuse' });
  }

  // ---- coil-gate hoops ----
  function renderHoops() {
    const Tr = T(), hd = R.hData.array, t = G.time.now, gl = G.gates.list();
    for (let i = 0; i < 4; i++) {
      const h = R.hoopSlots[i];
      if (h.on && !gl.includes(h.g)) h.on = false;
      if (!h.on) { V.m.makeScale(0, 0, 0); R.hoops.setMatrixAt(i, V.m); continue; }
      const f = Tr.frame(h.s, F);
      V.m.makeBasis(f.r, f.n, f.t).setPosition(V.a.copy(f.p).addScaledVector(f.r, h.d).addScaledVector(f.n, 3.3));
      V.m2.makeRotationZ(t * (h.gold ? 0.8 : -1.5)); V.m.multiply(V.m2);
      const sc = 3.3 * (h.revealed ? 1 + 0.05 * Math.sin(t * 10) : 0.85 + 0.15 * sm(h.t / 0.5));
      V.m.scale(V.s.set(sc, sc, sc)); R.hoops.setMatrixAt(i, V.m);
      hd[i * 4] = 0; hd[i * 4 + 1] = 0; hd[i * 4 + 2] = 0; hd[i * 4 + 3] = !h.revealed ? 3 : h.gold ? 2 : 1;
    }
    R.hoops.instanceMatrix.needsUpdate = true; R.hData.needsUpdate = true;
  }
  function renderSigil(b) {
    // gold lightning pylon for the brand cleanse
    const g = b.mem.brand && b.mem.brand.on ? b.mem.brand.pylon : null;
    R.pylon.visible = !!g && G.gates.list().includes(g);
    if (R.pylon.visible) {
      const f = T().frame(g.s, F);
      R.pylon.position.copy(f.p).addScaledVector(f.r, g.d); R.pylon.quaternion.setFromAxisAngle(f.n, G.time.now * 2);
      const p = 1 + 0.06 * Math.sin(G.time.now * 9); R.pylon.scale.set(p, p, p);
      if (Math.random() < 0.08) { V.a.copy(R.pylon.position).addScaledVector(f.n, 7.2); V.b.copy(V.a).add(V.c.set(Math.random() * 8 - 4, 6 + Math.random() * 6, Math.random() * 8 - 4)); G.fx?.lightning?.(V.a, V.b, { color: 0xffe9a0, width: 0.6, life: 0.12 }); }
    }
    const k = K(); R.sigil.visible = k.brand > 0 && !k.wrecked;
    if (!R.sigil.visible) return;
    R.sigil.position.copy(k.renderPos || k.worldPos).addScaledVector(k.renderUp || UPV, 2.6);
    R.sigil.rotation.y = G.time.real * 2.5;
    const p = 1 + 0.12 * Math.sin(G.time.real * (k.brand < 4 ? 22 : 8)); R.sigil.scale.setScalar(p);
  }

  // =================================================================
  // ATTACK HELPERS
  // =================================================================
  const tele = (o) => G.tele.spawn(o);
  const laneW = () => W / 3;
  const kartLane = () => clamp(Math.round(K().d / laneW()), -1, 1);
  const tailChain = () => R.split ? R.tailC : R.headC;
  const tailS = () => R.ls[NSEG - 1];
  const headPos = (out) => out.fromArray(R.cur, NSEG * 3);
  function visorOpen(b) { const m = b.mem; return b.staggered || m.visorT > 0 || m.tailDead || (b.phase === 0 && m.nodesLeft === 0); }
  function boltFrom(seg, out) { return out.fromArray(R.cur, seg * 3); }

  // =================================================================
  // ATTACKS
  // =================================================================
  const attacks = {
    // ---- Tail Whip: purple knock band at the tail's s, sweeping one side to the other ----
    whip(b) {
      if (b.mem.tailDead && b.phase === 2) return;
      const Tr = T(), k = K();
      const c = Tr.wrap(Math.min(Tr.ds(k.s, tailS()), 70) > 20 ? tailS() - 10 : k.s + 45);
      const from = G.rng() < 0.5 ? -1 : 1, hw = W / 2;
      R.whipDir = -from;
      R.whipK = 0; R.whipD = from * hw;
      sfx('roar', { pitch: 1.6, vol: 0.5 });
      R.whipH = tele({ shape: 'band', kind: 'knock', s0: c - 12.5, s1: c + 12.5, d0: from * hw - 2.8, d1: from * hw + 2.8, windup: 1.4, active: 0.5, tick: 0.6, dmg: 20, knock: 8, src: 'whip',
        follow: (dt, tt, h) => {
          R.whipK = Math.min(1, tt / 1.0);
          // windup + resolve: only the start strip (the sweep's first 5.6 m); the arrows show where it goes
          if (h.state !== 'live') { h.d0 = from * hw - 2.8; h.d1 = from * hw + 2.8; return; }
          const u = clamp(h.liveT / 0.5, 0, 1), dc = lerp(from * hw, -from * hw, u);
          h.d0 = dc - 2.8; h.d1 = dc + 2.8; R.whipD = dc;
        },
        onHit: () => { const k = K(), dir = -from, room = Math.max(0, W / 2 - 1.5 - dir * k.d); k.knockV = dir * Math.min(26, room * 6); },
        onEnd: () => { b.mem.whipFade = 1; } });
    },

    // ---- Chrome Scales: mirror plates shed from the body, land as mines ahead ----
    scales(b) {
      if (b.mem.tailDead && b.phase === 2) return;
      const k = K(), Tr = T(), n = 4 + (b.phase === 0 ? b.mem.nodesLeft : 2);
      sfx('chime', { pitch: 1.5 });
      let placed = 0;
      for (const m of R.mineSlots) {
        if (placed >= n) break; if (m.on) continue;
        m.on = true; m.ob = null; m.fly = -placed * 0.06; m.armed = false;
        const lane = ((placed % 3) - 1) * (G.rng() < 0.5 ? 1 : -1);
        m.s = Tr.wrap(k.s + 40 + (80 * (placed + G.rng() * 0.6)) / n); m.d = clamp(lane * laneW() + (G.rng() - 0.5) * 2.5, -6.5, 6.5);
        boltFrom(NSEG - 1 - (placed % 8), m.from);
        m.spin.set(G.rng() * 2 - 1, G.rng() * 2 - 1, G.rng() * 2 - 1);
        placed++;
      }
    },

    // ---- Lightning Lanes: one lane crackles 60 m ahead ----
    lanes(b, p = {}) {
      const k = K(), Tr = T();
      let lane = p.lane ?? (G.rng() < 0.6 ? kartLane() : [-1, 0, 1][(G.rng() * 3) | 0]);
      const d0 = lane * laneW() - laneW() / 2, d1 = d0 + laneW();
      const s0 = k.s + 30 + (p.off || 0), s1 = s0 + 60;
      sfx('laser', { pitch: 0.7 });
      let zap = 0;
      tele({ shape: 'band', kind: 'damage', visKind: 'electric', s0, s1, d0: lane === -1 ? -99 : d0, d1: lane === 1 ? 99 : d1, windup: 1.4, active: 3, tick: 0.5, dmg: 15, src: 'lanes',
        onResolve: () => { Tr.toWorld(Tr.wrap(s0 + 30), (d0 + d1) / 2, 0.3, V.a); G.fx?.burst?.('lightning', V.a, { count: 40, scale: 2 }); sfx('thunder', { vol: 0.5 }); },
        onLive: (dt) => {
          zap -= dt; if (zap > 0) return; zap = 0.3;
          Tr.toWorld(Tr.wrap(s0 + G.rng() * 60), lerp(d0, d1, Math.random()), 0.2, V.a);
          boltFrom((Math.random() * NSEG) | 0, V.b);
          G.fx?.lightning?.(V.b, V.a, { color: 0x9fd8ff, width: 0.7, life: 0.16, branches: 2 });
          G.fx?.burst?.('lightning', V.a, { count: 10 });
        } });
    },

    // ---- COIL: the serpent coils around the track; head hangs over a gold Breach Gate (scripted stagger) ----
    coil(b) {
      const k = K(), Tr = T(), m = b.mem;
      if (m.coil) return;
      let sC = Tr.wrap(k.s + Math.max(28, k.speed) * 2.6 + 30);
      if (Tr.inRange(sC - 30, RAMP_S - 12, GAP1 + 14) || Tr.inRange(sC + 25, RAMP_S - 12, GAP1 + 14)) sC = Tr.wrap(GAP1 + 46);   // keep the gate/tunnel off the Sky Gap
      R.coilC = sC; R.coilPhase = 0; R.coilSpin = 0;
      m.coil = { t: 0, sC, released: false, passed: false };
      m.visorT = 7;
      callout('COIL!', 'danger'); sfx('roar', { pitch: 0.8 });
      b.startCast('COIL', 1.2, { interruptible: false });
      m.coil.gate = G.gates.add({ kind: 'breach', s: sC - 30, d: 0, r: 4.6, needBoost: true, life: 9,
        onPass: (boosting) => {
          m.coil && (m.coil.passed = true);
          const dmg = boosting ? 250 : 80;
          headPos(V.a);
          G.combat.damageBoss(dmg, { source: 'breach', pos: V.a, force: true });
          if (boosting) { b.addStagger(0.15); callout('BREACH!', 'break'); G.cam.shake(0.45); G.post?.bloomPulse?.(0.6, 2); }
          else callout('BOOST THROUGH FOR MORE!', 'graze');
          G.fx?.burst?.('gold', K().worldPos, { count: 80 }); sfx('break');
        } });
    },

    // ---- Ram Charge: forced head-on pass (also runs automatically on every meeting in P2/P3) ----
    ram(b) {
      const k = K(), m = b.mem;
      if (m.coil) return;
      if (m.mode !== 'headon') { m.forcedHeadon = true; m.modeBack = m.mode; m.mode = 'headon'; }
      if (m.ram) return;
      // bring the head in from 170 m ahead
      portal(R.headC, k.s + 250, -1, 7);
    },

    // ---- Coil Gates: 4 hoops ahead; colours revealed 2 s out; gold = boost, red = electrified ----
    gates(b) {
      const k = K(), Tr = T();
      const lanes = [0, G.rng() < 0.5 ? -1 : 1]; lanes.push(0, -lanes[1]);
      const reds = [false, false, false, false];
      const r1 = (G.rng() * 4) | 0; reds[r1] = true; if (G.rng() < 0.5) reds[(r1 + 2) % 4] = true;
      let i = 0;
      for (const h of R.hoopSlots) {
        if (i >= 4) break;
        if (h.on) { G.gates.remove(h.g); h.on = false; }
        h.on = true; h.s = Tr.wrap(k.s + 90 + 40 * i); h.d = lanes[i] * laneW(); h.gold = !reds[i]; h.revealed = false; h.t = 0; h.tele = null;
        const slot = h;
        h.g = G.gates.add({ kind: h.gold ? 'gold' : 'red', s: h.s, d: h.d, r: 3.0, life: 14, mesh: new THREE.Object3D(),
          onPass: (boosting) => {
            if (!slot.gold) return;
            K().boost(12, 0.8, 'gate'); K().addFlux(8, 'gate'); b.addStagger(0.06 * (boosting ? 2 : 1));
            callout(boosting ? 'GOLD x2!' : 'GOLD GATE', 'perfect');
          } });
        boltFrom((i * 4) % NSEG, V.b); Tr.toWorld(h.s, h.d, 3.3, V.a);
        G.fx?.lightning?.(V.b, V.a, { color: 0xbfe3ff, width: 0.8, life: 0.3 });
        i++;
      }
      sfx('chime', { pitch: 0.8 });
    },

    // ---- Conductor's Brand: debuff + gold pylon ~0.6 lap ahead ----
    brand(b) {
      const m = b.mem;
      b.startCast("CONDUCTOR'S BRAND", 1.0, { interruptible: false,
        onComplete: () => {
          const k = K(), Tr = T();
          k.brand = 16.5; m.brand = { on: true };
          const lane = [-1, 0, 1][(G.rng() * 3) | 0];
          if (!R.pylon.parent) R.group.add(R.pylon);
          let ps = Tr.wrap(k.s + 390);
          if (Tr.inRange(ps, RAMP_S - 6, GAP1 + 8)) ps = Tr.wrap(GAP1 + 12);     // never over the void
          m.brand.pylon = G.gates.add({ kind: 'pylon', s: ps, d: lane * laneW(), r: 3.5, life: 17.5, mesh: R.pylon,
            onPass: () => cleanse(b) });
          callout('BRANDED! REACH THE PYLON', 'danger'); sfx('cast', { pitch: 0.7 });
          G.fx?.lightning?.(headPos(V.b), k.worldPos, { color: 0xc04bff, width: 1.2, life: 0.35, branches: 3 });
          G.post?.flash?.('#c04bff', 0.25, 3);
        } });
    },

    // ---- Acid Spit: 3 lobbed globs -> slow puddles ----
    acid(b) {
      const k = K(), Tr = T();
      const base = k.s + Math.max(20, k.speed) * 1.62;
      const offs = [-10, 12, 34];
      for (let i = 0; i < 3; i++) {
        const s = Tr.wrap(base + offs[i]), d = i === 0 ? clamp(k.d, -6, 6) : ((G.rng() * 3) | 0) * laneW() - laneW();
        const tgt = Tr.toWorld(s, d, 0.3, new THREE.Vector3());            // event-time allocation
        G.fx?.bolt?.(headPos(V.a), () => tgt, { color: '#7dff5a', tier: 2, width: 1.3, speed: 45, arc: 2.6,
          onHit: () => G.fx?.burst?.('lavaSplash', tgt, { count: 30, color: 0x7dff5a, scale: 1.3 }) });
        tele({ shape: 'circle', kind: 'damage', r: 5, s, d, windup: 1.5, dmg: 12, src: 'acid',
          onResolve: () => {
            G.zones.add({ type: 'slow', s0: s - 5, s1: s + 5, d0: d - 5, d1: d + 5, dur: 4, slow: 0.7, dps: 5, visual: false, phaseClear: true, src: 'acid' });
            tele({ shape: 'circle', kind: 'lava', r: 5, s, d, windup: 0.01, exact: true, active: 4, dmg: 0, visualOnly: true, src: 'acidPool' });
          } });
      }
      sfx('roar', { pitch: 1.9, vol: 0.4 });
    },

    // ---- Pincer (P3): head + tail converge on the Sky Gap; only lane 0 (pad + ramp) is safe ----
    pincer(b) {
      const m = b.mem; if (m.pincer) return;
      m.pincer = { state: 'wait', t: 0, hit: false };
      callout('PINCER INCOMING', 'danger');
    },
  };

  function startPincerBands(b) {
    const m = b.mem, p = m.pincer;
    p.state = 'live'; p.t = 0;
    const o = { shape: 'band', kind: 'damage', visKind: 'electric', s0: APPROACH0, s1: RAMP_S + 2, windup: 1.5, active: 1.6, tick: 0.5, dmg: 30, src: 'pincer', onHit: () => { p.hit = true; } };
    tele({ ...o, d0: -99, d1: -laneW() / 2 }); tele({ ...o, d0: laneW() / 2, d1: 99 });
    tele({ shape: 'band', kind: 'gold', s0: APPROACH0, s1: RAMP_S, d0: -laneW() / 2 + 0.6, d1: laneW() / 2 - 0.6, windup: 1.5, active: 1.6, dmg: 0, visualOnly: true, src: 'pincerSafe' });
    sfx('roar', { pitch: 0.9 }); G.cam.lookAtBoss?.(0.35, 1.5);
  }
  function updatePincer(b, dt) {
    const m = b.mem, p = m.pincer; if (!p) return;
    const k = K(), Tr = T();
    p.t += dt;
    if (p.state === 'wait') {
      R.pincerK = Math.max(0, R.pincerK - dt);
      const dist = Tr.ds(k.s, APPROACH0);
      if (dist > 0 && dist < Math.max(20, k.speed) * 1.75) startPincerBands(b);
      else if (p.t > 26) m.pincer = null;
    } else if (p.state === 'live') {
      R.pincerK = Math.min(1, R.pincerK + dt * 1.2);
      if (k.h < -1.5 || k.wrecked) p.hit = true;                 // fell into the Sky Gap (fall() teleports past it)
      const past = Tr.ds(GAP1, k.s);
      if ((past > 2 && past < 60 && !k.airborne) || p.t > 6) {
        m.pincer = null;
        if (!p.hit && past > 0) {
          K().addFlux(15, 'pincer'); callout('CLEARED!', 'perfect');
          m.pincerClears = (m.pincerClears || 0) + 1;
          if (m.pincerClears % 2 === 0 && !b.staggered) collision(b);
        }
      }
    }
  }
  function collision(b) {
    const Tr = T();
    Tr.toWorld((GAP0 + GAP1) / 2, 0, 9, V.a);
    G.fx?.burst?.('explosion', V.a, { count: 140, scale: 2, color: 0x9fd8ff }); G.fx?.burst?.('lightning', V.a, { count: 80, scale: 3 });
    G.fx?.shards?.(V.a, 60, 0xd8ecff, { speed: 1.4, size: 1 });
    G.fx?.shockwave?.(V.a, { color: 0x3fa9ff, radius: 50, dur: 0.8, normal: V.e.copy(G.camera.position).sub(V.a).normalize() });
    G.post?.shockAt?.(V.a, 1); G.cam.shake(0.7); sfx('explosion', { big: true });
    callout('COLLISION!', 'break'); b.startStagger(6, true);
  }

  // brand cleanse: thunderbolt from the pylon into the head
  function cleanse(b) {
    const m = b.mem, k = K();
    if (!m.brand || !m.brand.on) return;
    m.brand.on = false; k.brand = 0;
    T().toWorld(k.s, k.d, 7, V.a); headPos(V.b);
    for (let i = 0; i < 3; i++) G.fx?.lightning?.(V.a, V.b, { color: 0xffe9a0, width: 3.2 - i, life: 0.5 + i * 0.1, branches: 4, glow: 3 });
    G.fx?.burst?.('lightningStrike', V.b, { color: 0xffe9a0 }); G.fx?.burst?.('gold', V.b, { count: 120 });
    G.combat.damageBoss(900, { source: 'pylon', pos: V.b, force: true });
    b.addStagger(0.15);
    G.cam.shake(0.5); sfx('thunder'); G.post?.flash?.('#ffe9a0', 0.4, 3); G.post?.bloomPulse?.(0.8, 1.5);
    callout('THUNDERSTRUCK!', 'break');
    if (!b.staggered && b.state === 'fight') b.after(0.3, () => { if (!b.staggered) { callout('OVERLOADED!', 'break'); b.startStagger(5, true); } }, true);
  }
  function updateBrand(b) {
    const m = b.mem, k = K();
    if (!m.brand || !m.brand.on) return;
    if (k.brand <= 0) {
      m.brand.on = false;
      if (m.brand.pylon) G.gates.remove(m.brand.pylon);
      T().toWorld(k.s, k.d, 0, V.a); G.fx?.burst?.('lightningStrike', V.a, { color: 0xc04bff });
      G.combat.hitPlayer(35, { src: 'brand', unblockable: true }); k.addFlux(-30);
      callout('BRAND DETONATED', 'danger'); sfx('thunder');
    }
  }

  // ---- head-on meetings: ram band, headshot, mega graze ----
  function updateRam(b, dt) {
    const m = b.mem, k = K(), Tr = T(), c = R.headC;
    if (m.mode !== 'headon' || R.coilK > 0.05 || R.pincerK > 0.05) { c.ramK = Math.max(0, c.ramK - dt * 2); return; }
    const rel = Tr.ds(k.s, c.s);                     // >0 head ahead of the kart
    const close = Math.max(10, k.sdot + c.v);
    if (!m.ram) {
      c.ramK = Math.max(0, c.ramK - dt * 1.5);
      const eta = rel / close;
      if (rel > 0 && eta < 3.0 && eta > 2.52 && !b.staggered && b.state === 'fight' && (m.ramCD || 0) <= 0) startRam(b, eta);
    } else {
      const r = m.ram;
      r.t += dt;
      c.ramK = Math.min(1, c.ramK + dt * 2.2);
      c.dT = r.d;
      if (Math.abs(rel) < 4.5 && Math.abs(k.d - c.d) < 3.4 && k.h < 4 && !r.shot && !k.cometActive && !b.staggered) {
        if (k.dashT > 0) headshot(b);
        else if (!r.hit) { const res = G.combat.hitPlayer(30, { src: 'ram', spin: true }); if (res === 'hit') r.hit = true; }
      }
      if (Math.abs(rel) < 8) r.minD = Math.min(r.minD, Math.abs(k.d - c.d));
      if (rel < -6 && !r.done) {
        r.done = true;
        if (!r.hit && !r.shot && r.minD < 6.5 && k.h < 3 && !k.cometActive && !k.wrecked) {
          k.addFlux(30, 'megaGraze'); G.time.slowmo(0.3, 0.6); G.cam.lookAtBoss?.(0.55, 0.9);
          G.emit('kart:graze', { amount: 30, mega: true, src: 'ram' }); if (G.combat.stats) G.combat.stats.grazes++;
          callout('MEGA GRAZE!', 'perfect'); sfx('megaGraze');
        }
      }
      if (rel < -40 || r.t > 6) {
        m.ram = null; m.ramCD = 2;
        if (m.forcedHeadon) { m.forcedHeadon = false; m.mode = m.modeBack || 'chase'; portal(c, k.s + 160, 1, 7); m.catchup = true; }
      }
    }
    if (m.ramCD > 0) m.ramCD -= dt;
  }
  function startRam(b, eta) {
    const m = b.mem, k = K(), Tr = T(), c = R.headC;
    const pd = k.predict(eta).d;
    const lane = clamp(Math.round(pd / laneW()), -1, 1);
    m.ram = { t: 0, d: lane * laneW(), hit: false, shot: false, done: false, minD: 99 };
    m.visorT = 3.5;
    const w = Math.max(1.2, eta - 1.32), hw = laneW() / 2;
    tele({ shape: 'band', kind: 'damage', s0: c.s - 60, s1: c.s + 2, d0: m.ram.d - hw, d1: m.ram.d + hw, windup: w, exact: true, active: 2.4, tick: 0.7, dmg: 30, spin: true, src: 'ram',
      follow: (dt, tt, h) => { h.s1 = Tr.wrap(R.headC.s + 2); h.s0 = Tr.wrap(R.headC.s - 60); },
      onHit: () => { if (m.ram) m.ram.hit = true; } });
    sfx('roar', { pitch: 1.2 }); callout(lane < 0 ? 'HEAD-ON! GO RIGHT >>' : lane > 0 ? '<< GO LEFT  HEAD-ON!' : '<< HEAD-ON! CHANGE LANE >>', 'danger');
  }
  function headshot(b) {
    const m = b.mem, r = m.ram; r.shot = true;
    headPos(V.a);
    G.combat.damageBoss(150, { source: 'dash', targetId: 'core', pos: V.a, force: true });
    b.addStagger(0.25); if (b.cast) b.interrupt('dash', true);
    callout('HEADSHOT!', 'break'); G.time.hitstop(90); G.cam.shake(0.5);
    G.fx?.burst?.('gold', V.a, { count: 100 }); G.fx?.shards?.(V.a, 30, 0xd8ecff, { speed: 1.2 }); sfx('break');
    if (!b.staggered && (m.loopStaggers || 0) === 0) b.after(0.2, () => { if (!b.staggered && b.state === 'fight') { callout('OVERLOADED!', 'break'); b.startStagger(5, true); } }, true);
  }

  // ---- slipstream behind the tail (P1 chain / P3 Tail Coil) ----
  function updateSlip(b, dt) {
    const k = K(), Tr = T();
    const chaseTail = (b.phase === 0 && b.mem.mode === 'chase') || (R.split && !b.mem.tailDead);
    if (!chaseTail || R.coilK > 0.2 || k.airborne || k.wrecked) { b.mem.slip = false; return; }
    const ts = R.ls[NSEG - 1], td = R.ld[NSEG - 1];
    const rel = Tr.ds(k.s, ts);
    const on = rel > 0 && rel < 25 && Math.abs(k.d - td) < 3;
    if (on) {
      if (k.boostT < 0.12) k.boostAdd = Math.max(k.boostT > 0 ? k.boostAdd : 0, 4);
      k.boostT = Math.max(k.boostT, 0.12);
      k.addFlux(8 * dt);
      if (k.drifting && !k.airborne) k.driftCharge += dt * 0.1;
      if (Math.random() < 0.2) { V.a.copy(k.worldPos).addScaledVector(k.camFwd || V.z.set(0, 0, 1), 6 + Math.random() * 10); V.a.x += (Math.random() - 0.5) * 4; V.a.y += 0.5 + Math.random() * 2; V.b.copy(k.camFwd || UPV).negate(); G.fx?.emit?.('dashTrail', V.a, V.b, 1, slipOpts); }
      if (!b.mem.slip) callout('SLIPSTREAM', 'graze');
    }
    b.mem.slip = on;
  }
  const slipOpts = { color: '#7fc8ff', speed: 3, scale: 0.5, key: 'b2slip' };

  // ---- best target (§6.3 + §8.3) with RANGE fizzle ----
  const rangeTgt = { id: 'range', pos: new THREE.Vector3() };
  function inRange(node) { node.getWorldPosition(V.d); return V.d.distanceTo(K().worldPos) <= RANGE; }
  function bestTarget(b) {
    if (!R || b.state !== 'fight') return undefined;
    const m = b.mem, tg = m.tg;
    let pick = null;
    const headIn = !R.headHidden && inRange(R.coreNode);
    if (b.staggered && headIn) pick = tg.head;
    else if (b.phase === 0) {
      // rearmost living node, else the (now open) head
      for (let i = 5; i >= 0; i--) if (tg.nodes[i].hp > 0) { if (inRange(tg.nodes[i].node)) pick = tg.nodes[i]; break; }
      if (!pick && headIn) pick = tg.head;
    } else {
      if (visorOpen(b) && headIn) pick = tg.head;
      if (!pick && b.phase === 2 && !m.tailDead && inRange(R.tailNode)) pick = tg.tail;
      if (!pick && headIn) pick = tg.head;
    }
    if (!pick && inRange(R.bodyNode)) pick = tg.body;
    b.outOfRange = !pick;
    if (pick) return pick;
    const k = K(); rangeTgt.pos.copy(k.worldPos).addScaledVector(k.camFwd || V.z.set(0, 0, 1), RANGE).addScaledVector(UPV, 10);
    return rangeTgt;
  }

  // =================================================================
  // PER-TICK
  // =================================================================
  function update(b, dt) {
    if (!R) return;
    const m = b.mem, k = K();
    R.flash = Math.max(b.hitFlash || 0, R.flash - dt * 4);
    for (let i = 0; i < NSEG; i++) if (R.segFlash[i] > 0) R.segFlash[i] = Math.max(0, R.segFlash[i] - dt * 5);
    if (b.state === 'dead') { R.headHidden = true; for (let i = 0; i < NSEG; i++) R.segHidden[i] = 1; return; }
    // coil animation
    R.coilK += clamp(R.coilTarget - R.coilK, -dt / 1.2, dt / 1.3);
    R.coilPhase += R.coilSpin * dt;
    if (m.coil) {
      const c = m.coil; c.t += dt;
      R.coilTarget = c.released ? 0 : 1;
      if (c.t > 1.2 && !c.stag) { c.stag = true; if (b.state === 'fight') b.startStagger(5.5, true); }
      const past = T().ds(c.sC + 26, k.s);
      if (!c.released && ((c.passed && past > 0) || c.t > 7.5 || (c.stag && !b.staggered))) { c.released = true; m.catchup = true; }
      if (c.released && R.coilK <= 0.01) { m.coil = null; if (c.gate) G.gates.remove(c.gate); }
    } else if (m.mode !== 'idle') R.coilTarget = 0;
    // phase-2 transition: rise into the sky, portal, reappear racing against you
    if (m.mode === 'rise') { m.riseT += dt; if (m.riseT > 1.4) { portal(R.headC, k.s + 380, -1, 34); R.headC.hT = 7; m.mode = 'headon'; } }
    steerChain(b, R.headC, dt, false);
    if (R.split) steerChain(b, R.tailC, dt, true);
    if (m.visorT > 0) m.visorT -= dt;
    const vo = visorOpen(b) || (m.ram && R.headC.ramK > 0.3) || R.pincerK > 0.5;
    R.visorK += ((vo ? 1 : 0) - R.visorK) * Math.min(1, dt * 5);
    R.mouthK += (((vo ? 1 : 0.08) + (b.staggered ? Math.sin(b.clk * 9) * 0.15 : 0)) - R.mouthK) * Math.min(1, dt * 6);
    if (m.whipFade) { R.whipK = Math.max(0, R.whipK - dt * 2); if (R.whipK <= 0) m.whipFade = 0; }
    layout(b);
    updateMines(dt);
    for (const h of R.hoopSlots) if (h.on) {
      h.t += dt;
      const eta = T().ds(k.s, h.s) / Math.max(15, k.speed);
      if (!h.revealed && eta < 2.0) {
        h.revealed = true; sfx(h.gold ? 'chime' : 'laser');
        if (!h.gold) h.tele = tele({ shape: 'band', kind: 'damage', visKind: 'electric', s0: h.s - 4, s1: h.s + 4, d0: h.d - laneW() / 2, d1: h.d + laneW() / 2, windup: 1.3, active: 1.8, dmg: 25, src: 'redGate' });
      }
      if (T().ds(k.s, h.s) < -15) { G.gates.remove(h.g); h.on = false; }
    }
    if (b.state !== 'fight') { b.outOfRange = false; return; }
    updateRam(b, dt); updatePincer(b, dt); updateBrand(b); updateSlip(b, dt);
    if (!m.pincer) R.pincerK = Math.max(0, R.pincerK - dt);
    // staggered: sparks + short-circuit arcs along the body
    if (b.staggered && Math.random() < dt * 8) { const i = (Math.random() * NSEG) | 0; boltFrom(i, V.a); boltFrom(Math.min(NSEG - 1, i + 1 + ((Math.random() * 2) | 0)), V.b); G.fx?.lightning?.(V.a, V.b, { color: 0xffe9a0, width: 0.6, life: 0.12, branches: 1 }); G.fx?.burst?.('chrome', V.a, { count: 6 }); }
    // ambient: spine sparks
    if (Math.random() < dt * 3) { boltFrom((Math.random() * NSEG) | 0, V.a); G.fx?.burst?.('lightning', V.a, { count: 6 }); }
    // soft enrage: lightning strikes on the predicted position every 0.8 s
    if (b.enrage === 1 && !b.staggered && b.invulnT <= 0) {
      m.strikeT -= dt;
      if (m.strikeT <= 0) {
        m.strikeT = 0.8;
        const p = k.predict(0.9 + 0.12);
        tele({ shape: 'circle', kind: 'damage', r: 3.5, s: p.s, d: p.d, windup: 0.9, exact: true, dmg: 20, src: 'strike',
          onResolve: (hit, gz, h) => { T().toWorld(h.s, h.d, 0, V.a); G.fx?.burst?.('lightningStrike', V.a, { color: 0xbfe3ff }); sfx('thunder', { vol: 0.4 }); } });
      }
    }
    if (m.storm > 0) { m.storm += dt; if (Math.random() < dt * 20) { T().toWorld(T().wrap(k.s + (Math.random() - 0.3) * 160), (Math.random() - 0.5) * W, 0, V.a); G.fx?.burst?.('lightningStrike', V.a, { color: 0xbfe3ff }); } }
  }

  // =================================================================
  // DEATH: seize, arch into a loop, unravel segment by segment, dawn
  // =================================================================
  function death(b, t, rdt) {
    if (!R) return;
    const m = b.mem, Tr = T();
    R.deathK = Math.min(1, t / 1.1);
    R.coilTarget = 0; R.coilK = Math.max(0, R.coilK - rdt * 2); R.pincerK = 0; R.whipK = 0;
    R.flash = 0.4 + 0.4 * Math.sin(t * 40);
    R.mouthK = 1; R.visorK = 1;
    // seizure jitter in track space via the chain histories is skipped; jitter world positions instead
    layout(b);
    if (t < 1.4) for (let i = 0; i < NSEG * 3; i++) R.cur[i] += (Math.random() - 0.5) * 0.8;
    if (Math.random() < 0.6) { const i = (Math.random() * (NSEG - 1)) | 0; boltFrom(i, V.a); boltFrom(i + 1, V.b); G.fx?.lightning?.(V.a, V.b, { color: 0xbfe3ff, width: 0.8, life: 0.12 }); }
    // unravel from the tail toward the head
    const n = clamp(Math.floor((t - 1.3) / 0.13), -1, NSEG - 1);
    while (m.unravel < n) {
      m.unravel++;
      const k = NSEG - 1 - m.unravel;
      if (k < 0) break;
      R.segHidden[k] = 1; boltFrom(k, V.a);
      G.fx?.shards?.(V.a, 22, 0xd8ecff, { speed: 1.2, size: 0.9 * R.segScale[k] * 0.6, life: 2.4 });
      G.fx?.burst?.('chrome', V.a, { count: 30, scale: 1.4 }); G.fx?.burst?.('lightning', V.a, { count: 20, scale: 1.5 });
      if (k > 0) { boltFrom(k - 1, V.b); G.fx?.lightning?.(V.a, V.b, { color: 0x9fd8ff, width: 1.2, life: 0.2, branches: 2 }); }
      G.cam.shake(0.15); sfx('explosion', { vol: 0.5 });
    }
    if (t > 1.3 + NSEG * 0.13 + 0.15 && !m.headBlown) {
      m.headBlown = true; R.headHidden = true; headPos(V.a);
      G.fx?.shards?.(V.a, 140, 0xd8ecff, { speed: 1.8, size: 1.2, life: 3 });
      G.fx?.burst?.('comet', V.a, { count: 180, color: 0xffd060, scale: 1.4 }); G.fx?.burst?.('explosion', V.a, { count: 160, scale: 2.2, color: 0x9fd8ff });
      G.fx?.shockwave?.(V.a, { color: 0xbfe3ff, radius: 110, dur: 1.2, thick: 0.04 });
      G.fx?.flash?.(0xfff4e0, 0.9, 0.7); G.post?.bloomPulse?.(1.6, 0.7); G.post?.shockAt?.(V.a, 1.2);
      G.cam.shake(1.0); sfx('explosion', { big: true }); sfx('thunder');
    }
    const dawn = sm((t - 1.0) / 3.2);
    G.sky?.setDawn?.(dawn);
    if (G.scene.fog) G.scene.fog.color.setRGB(lerp(0.078, 0.42, dawn), lerp(0.10, 0.32, dawn), lerp(0.21, 0.36, dawn));
    const TU = Tr.uniforms; if (TU) TU.uEnrage.value *= 0.95;
  }

  // =================================================================
  // TARGETS / STATE RESET
  // =================================================================
  function makeTargets(b) {
    const m = b.mem;
    const head = { id: 'core', node: R.coreNode, weak: true, always: true, isExposed: () => true, getMult: (bb) => visorOpen(bb) ? 1.5 : 1.0 };
    const body = { id: 'body', node: R.bodyNode, weak: false, getMult: () => 0.5 };
    const nodes = [];
    for (let i = 0; i < 6; i++) {
      const id = 'node' + (i + 1);
      nodes.push({ id, node: R.nodeObjs[i], hp: 450, maxHp: 450, weak: true, mult: 1.5, isExposed: () => true,
        onDestroyed: (bb) => {
          R.nodeState[i] = 2; m.nodesLeft = Math.max(0, m.nodesLeft - 1);
          R.nodeObjs[i].getWorldPosition(V.a);
          G.fx?.burst?.('gold', V.a, { count: 70 }); G.fx?.shards?.(V.a, 24, 0xffc93a, { speed: 1.2, size: 0.8 });
          G.fx?.lightning?.(V.a, headPos(V.b), { color: 0xffe9a0, width: 1, life: 0.25 });
          sfx('break', { vol: 0.6 });
          bb.damage(300, { source: 'node', force: true, pos: V.a });
          bb.addStagger(0.10);
          callout(m.nodesLeft ? 'NODE DOWN! ' + m.nodesLeft + ' LEFT' : 'ALL NODES DOWN - VISOR OPEN!', 'break');
        } });
    }
    const tail = { id: 'tail_coil', node: R.tailNode, hp: 1500, maxHp: 1500, weak: true, mult: 1.0, isExposed: () => true,
      onDestroyed: (bb) => {
        m.tailDead = true; R.tailCrystal.visible = false;
        R.tailNode.getWorldPosition(V.a);
        G.fx?.burst?.('gold', V.a, { count: 120 }); G.fx?.burst?.('explosion', V.a, { count: 100, scale: 1.4, color: 0x9fd8ff });
        for (let k = SPLIT; k < NSEG; k++) { R.segHidden[k] = 1; boltFrom(k, V.b); G.fx?.shards?.(V.b, 14, 0xd8ecff, { speed: 1, size: 0.7 }); }
        G.cam.shake(0.6); sfx('explosion', { big: true });
        bb.damage(600, { source: 'tail', force: true, pos: V.a });
        callout('TAIL SEVERED! VISOR LOCKED OPEN', 'break');
      } };
    m.tg = { head, body, nodes, tail };
    return [head, body, ...nodes];
  }
  function resetRig(b) {
    R.segHidden.fill(0); R.headHidden = false; R.whipH = null; R.deathK = 0; R.pincerK = 0; R.whipK = 0; R.split = false; R.tailCrystal.visible = false;
    for (const ms of R.mineSlots) { ms.on = false; ms.ob = null; }
    for (const h of R.hoopSlots) h.on = false;
    const m = b.mem; m.ram = null; m.coil = null; m.pincer = null; m.brand = null; m.forcedHeadon = false; m.slip = false; m.storm = 0;
    K().brand = 0;
  }
  function setChase(b, fromShow) {
    const k = K(), c = R.headC, m = b.mem;
    m.mode = 'chase';
    if (!fromShow) { portal(c, k.s + 45 + SP * NSEG, 1, 7); }
    else { c.s = T().wrap(R.coilC - 27); c.dir = 1; c.d = 0; c.h = 9; fillHist(c); m.catchup = true; }
  }

  // =================================================================
  // DEFINITION
  // =================================================================
  const def = {
    id: 2, name: 'QUICKSILVER LEVIATHAN', title: 'the Storm Serpent', music: 'boss2', accent: '#3fa9ff', targetTime: 180,
    tips: [
      'Stay in <b>RANGE</b>. Bolts lock onto the gold tail nodes.',
      'Head-on: switch lanes for a <b>MEGA GRAZE</b>, or <b>DASH</b> through the visor.',
      'Branded? Race to the <b>GOLD PYLON</b> before the timer ends.',
    ],
    briefCam: { target: [0, 10, 0], r: 58, h: 12 },
    arena: {
      name: 'STRATOS RIBBON', sky: 'storm', palette: { base: '#050a18', line: '#2c6cc8', edge: '#3fa9ff', accent: '#ffc93a' },
      // a single banked sky loop (CCW, s = 0 at the corner before the long straight); bank follows curvature
      shape: { type: 'spline', targetL: 760, points: [
        [140, 4, -140, W, 15], [70, 2, -147, W, 0], [0, 0, -150, W, 0], [-50, 1, -150, W, 1], [-95, 2, -142, W, 6], [-170, 6, -70, W, 8],
        [-190, 0, 60, W, 12], [-120, -4, 145, W, 15], [-30, 2, 140, W, -6], [80, 8, 130, W, 7], [170, 14, 70, W, 11], [200, 10, -40, W, 12]] },
      width: W, lapGateS: LAP0, rail: 'energy', surface: 'glass',
      pads: [{ s: PAD_S, lane: 0, len: 8 }, { s: 240, lane: -1, len: 8 }, { s: 270, lane: 1, len: 8 }, { s: 470, lane: 1, len: 8 }, { s: 500, lane: 0, len: 8 }, { s: 640, lane: -1, len: 8 }, { s: 670, lane: 1, len: 8 }],
      ramps: [{ s: RAMP_S, len: RAMP_LEN, kick: 10 }], gaps: [{ s0: GAP0, s1: GAP1 }],
      driftZones: [{ s0: 300, s1: 415, mult: 1.25 }], itemRows: [178, 560],
      fog: { color: '#141a36', near: 150, far: 980 }, envTop: '#2a1850', hemiSky: '#9fd8ff', sunDir: [0.35, 0.7, -0.45],
    },
    buildScenery(group, track) {
      R = buildRig(group, track);
      buildScenery(group, track);
      track.toWorld(SHOW_S, 0, 6, V.a); def.briefCam.target = [V.a.x, V.a.y, V.a.z];
    },
    boss: {
      hp: 10500, minWindup: 1.2, softEnrage: 255, hardEnrage: 300, staggerDur: 6, staggerDecayMult: 0.85, deathDur: 4.6, range: RANGE, height: 16,
      attackNames: ['whip', 'scales', 'lanes', 'coil', 'ram', 'gates', 'brand', 'acid', 'pincer'],
      attacks,
      bestTarget,
      create(b) {
        if (!R) return;
        b.root = R.head; b.rig = R;
        b.mem = { mode: 'idle', nodesLeft: 6, visorT: 0, strikeT: 1, unravel: -1, riseT: 0, pincerClears: 0, loopStaggers: 0 };
        // the RANGE fizzle target never deals damage
        const dmg = b.damage.bind(b);
        b.damage = (amount, o = {}) => (o.targetId === 'range' ? 0 : dmg(amount, o));
        // showcase: coiled around the ribbon ahead of the start line
        R.coilC = SHOW_S; R.coilK = R.coilTarget = 1; R.coilSpin = 0.35;
        const c = R.headC; c.s = T().wrap(SHOW_S - 27); c.d = 0; c.h = 9; c.dir = 1; fillHist(c); R.snap = true;
        resetRig(b);
      },
      targets: (b) => (R ? makeTargets(b) : []),
      onStart(b) { resetRig(b); b.mem.nodesLeft = 6; b.mem.tailDead = false; b.mem.pincerClears = 0; b.mem.unravel = -1; b.mem.headBlown = false; G.sky?.setDawn?.(0); G.scene.fog?.color?.set(def.arena.fog.color); },
      onDamaged(b, dealt, o, t) {
        if (t && t.id && t.id.startsWith('node')) R.segFlash[NODE0 + (+t.id.slice(4) - 1)] = 1;
        if (t && t.id === 'tail_coil') R.segFlash[NSEG - 1] = 1;
      },
      onStagger(b) { b.mem.loopStaggers = (b.mem.loopStaggers || 0) + 1; sfx('roar', { pitch: 0.6 }); },
      onStaggerEnd(b) { },
      onSoftEnrage(b) { b.mem.strikeT = 1; callout('THE STORM BREAKS', 'enrage'); },
      onHardEnrage(b) {
        G.tele.clear();
        b.startCast('WORLD-STORM', 4, { final: true, blocking: true, onComplete: () => G.combat.wipe('WORLD-STORM') });
        tele({ shape: 'band', kind: 'damage', visKind: 'electric', s0: 0, s1: T().L - 0.05, windup: 4, exact: true, visualOnly: true, src: 'worldstorm' });
        b.mem.storm = 0.001; callout('WORLD-STORM', 'enrage'); sfx('enrage');
      },
      onWipe(b) { },
      onDeath(b) {
        const k = K();
        R.loopC = T().wrap(k.s + 70); b.mem.unravel = -1; b.mem.headBlown = false;
        R.split = false; R.coilTarget = 0; k.brand = 0;
        G.cam.lookAtBoss?.(0.7, 4.2); sfx('roar', { pitch: 0.5 });
      },
      death,
      update(b, dt) { update(b, dt); },
      render(b, rdt, alpha) { render(b, rdt, alpha); },
      phases: [
        { name: 'THE CHASE', at: 1.0, loop: 22, jitter: 0.5,
          rotation: [{ t: 0, a: 'whip' }, { t: 4, a: 'scales' }, { t: 8, a: 'lanes' }, { t: 11, a: 'whip' }, { t: 15, a: 'coil' }, { t: 18, a: 'lanes' }],
          enter(b, o) {
            const m = b.mem;
            resetRig(b); b.targets = makeTargets(b);
            m.nodesLeft = 6; for (let i = 0; i < 6; i++) R.nodeState[i] = 1;
            R.coilTarget = 0;
            setChase(b, m.mode === 'idle');
          },
          onLoop(b) { b.mem.loopStaggers = 0; } },
        { name: 'HEAD-ON', at: 0.65, loop: 26, jitter: 0.6,
          rotation: [{ t: 4, a: 'gates' }, { t: 12, a: 'brand', cast: true }, { t: 20, a: 'acid' }],
          enter(b, o) {
            const m = b.mem; resetRig(b);
            const tg = m.tg || (makeTargets(b), m.tg); b.targets = [tg.head, tg.body];
            m.nodesLeft = 0; R.coilTarget = 0;
            if (o && o.retry) { m.mode = 'headon'; portal(R.headC, K().s + 380, -1, 7); }
            else { m.mode = 'rise'; m.riseT = 0; sfx('roar', { pitch: 1.4 }); callout('IT PHASES INTO THE STORM...', 'danger'); G.sky?.lightning?.(); }
          },
          onLoop(b) { b.mem.loopStaggers = 0; } },
        { name: 'SPLIT SERPENT', at: 0.30, loop: 24, jitter: 0.5,
          rotation: [{ t: 2, a: 'lanes' }, { t: 4, a: 'whip' }, { t: 7, a: 'scales' }, { t: 10, a: 'pincer' }, { t: 10.5, a: 'lanes' }, { t: 16, a: 'acid' }, { t: 18, a: 'lanes' }, { t: 20, a: 'whip' }],
          enter(b, o) {
            const m = b.mem, k = K(); resetRig(b);
            const tg = m.tg || (makeTargets(b), m.tg);
            tg.tail.hp = tg.tail.maxHp; m.tailDead = false;
            b.targets = [tg.head, tg.body, tg.tail];
            // tear in two: the head keeps racing against you, the Tail Coil races with you
            boltFrom(SPLIT, V.a);
            if (!o || !o.retry) { G.fx?.burst?.('explosion', V.a, { count: 120, scale: 1.6, color: 0x9fd8ff }); G.fx?.burst?.('lightning', V.a, { count: 70, scale: 2.5 }); G.cam.shake(0.6); sfx('roar', { pitch: 0.7 }); callout('THE SERPENT SPLITS!', 'danger'); }
            R.split = true; R.tailCrystal.visible = true;
            m.mode = 'headon';
            if (R.headC.dir !== -1 || (o && o.retry)) portal(R.headC, k.s + 380, -1, 7);
            portal(R.tailC, k.s + 40 + SP * (NSEG - 1 - SPLIT), 1, 7);
          },
          onLoop(b) { b.mem.loopStaggers = 0; } },
      ],
      idle(b, dt) { },
      dispose(b) { if (R) resetRig(b); },
    },
  };
  G.bosses[1] = def;
}
