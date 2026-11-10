// DOOR V: MOLTHAR, the Kiln-Titan. A ring of basalt around a lake of fire, and something very large standing in it.
(() => {
  const R0 = 12, R1 = 21, MID = 16.5, SEG = PI / 4, FIRE = 0xff6a1a, TELE = 0xfff0c8, ZONE = 0xffd890, ICE = 0x5ab8ff, ARM = 17.5;
  const segOf = (x, z) => { let a = Math.atan2(x, z); if (a < 0) a += TAU; return Math.floor(a / SEG) % 8; };
  const pt = (a, r, y, out) => (out || new V3()).set(Math.sin(a) * r, y, Math.cos(a) * r);
  const playerAng = () => Math.atan2(G.player.pos.x, G.player.pos.z);

  // ---- local look helpers (titan only) ----
  // World-position varying shared by the injected materials below.
  const VTW = '#include <project_vertex>\n{ vec4 tw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n tw = instanceMatrix * tw;\n#endif\n vTW = (modelMatrix * tw).xyz; }';
  const RIM = 'vec3 nV_ = normal * inversesqrt(max(dot(normal, normal), 1e-8)); vec3 vV_ = vViewPosition * inversesqrt(max(dot(vViewPosition, vViewPosition), 1e-8)); float fr_ = 1.0 - clamp(dot(nV_, vV_), 0.0, 1.0);';
  // The titan's hide: big plates, thick crust, cracks that pulse and widen, heat rising toward the chest core, a hot fresnel rim.
  function hideMaker(S) {
    const tx = W.bake(512, (u, v) => {
      // few, large plates: domed crust slabs with deep wide seams between them
      const c = W.cell(u * 2, v * 2, 41, 2), n = W.fbm(u * 16, v * 16, 44, 4, 16), n2 = W.fbm(u * 5, v * 5, 45, 3, 5);
      const seam = smooth(sat(c[1] * 2.6)), dome = sat(1 - c[0] * 0.7);
      return [seam * (0.5 + dome * 0.4) + n * 0.1, 0.15 + n * 0.45 + n2 * 0.3 + dome * 0.15, 0.7 + n * 0.3];
    }, { dark: 0x0b0909, light: 0x4a403c, strength: 7 });
    const em = W.bake(512, (u, v) => { const c = W.cell(u * 2, v * 2, 41, 2), n = W.fbm(u * 8, v * 8, 47, 3, 8); const e = Math.pow(1 - sat(c[1] * 3.4), 1.8) * (0.75 + n * 0.5); return [0, sat(e), 1]; }, { dark: 0x000000, light: 0xffffff });
    for (const t of [tx.map, tx.normalMap, tx.roughnessMap, em.map]) t.repeat.set(2, 2);
    S.HU = { uT: { value: 0 }, uCore: { value: new V3(0, 7, 5) }, uCrack: { value: 0 }, uHeatB: { value: 0 } };
    return (o = {}) => {
      const m = new THREE.MeshStandardMaterial({ map: tx.map, normalMap: tx.normalMap, roughnessMap: tx.roughnessMap, color: o.color || 0xffffff, roughness: o.rough || 0.9, metalness: o.metal || 0.05,
        emissive: o.emi || 0xff5a14, emissiveMap: em.map, emissiveIntensity: o.ei === undefined ? 1.6 : o.ei, flatShading: o.flat !== false, envMapIntensity: 0.6 });
      const rim = o.rim === undefined ? 1 : o.rim;
      m.onBeforeCompile = (s) => {
        Object.assign(s.uniforms, S.HU); s.uniforms.uRim = { value: rim };
        s.vertexShader = 'varying vec3 vTW;\n' + s.vertexShader.replace('#include <project_vertex>', VTW);
        s.fragmentShader = 'uniform float uT, uCrack, uHeatB, uRim; uniform vec3 uCore; varying vec3 vTW;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', `
          float hC_ = clamp(1.0 - length(vTW - uCore) / 12.0, 0.0, 1.0); hC_ *= hC_;
          #ifdef USE_EMISSIVEMAP
            float em_ = clamp(texture2D(emissiveMap, vEmissiveMapUv).g, 0.0, 1.0);
            em_ = pow(max(em_, 0.0), 1.0 / (1.0 + uCrack * 1.3 + hC_ * 0.9));
            // seam colour: white-yellow at the core of the seam, red at its edges
            float eI_ = max(max(totalEmissiveRadiance.r, totalEmissiveRadiance.g), totalEmissiveRadiance.b);
            totalEmissiveRadiance = eI_ * em_ * mix(vec3(0.8, 0.08, 0.015), vec3(1.4, 0.75, 0.25), pow(max(em_, 0.0), 3.0));
          #endif
          float pul_ = 0.7 + 0.3 * sin(uT * 2.1 - vTW.y * 0.45 + hC_ * 3.0);
          totalEmissiveRadiance *= pul_ * (0.5 + hC_ * 2.0 + uHeatB);
          ${RIM}
          // cool blue-grey rim away from the core separates the silhouette from the orange world; hot near the core
          totalEmissiveRadiance += mix(vec3(0.3, 0.4, 0.55), vec3(1.0, 0.42, 0.12), clamp(hC_ * 1.5 + uHeatB, 0.0, 1.0)) * pow(max(fr_, 0.0), 3.5) * uRim * 0.35;
          totalEmissiveRadiance = min(totalEmissiveRadiance, vec3(30.0));`);
      };
      m.customProgramCacheKey = () => 'titanHide'; m.userData.hideOpts = o;
      return m;
    };
  }
  // Basalt that glows from below where it meets the lava (walls, boulders, columns).
  function hotRock(rk, o = {}) {
    const m = new THREE.MeshStandardMaterial({ map: rk.map, normalMap: rk.normalMap, roughnessMap: rk.roughnessMap, color: o.color || 0xffffff, roughness: 0.9, metalness: 0.05, flatShading: true, side: o.side || THREE.FrontSide, envMapIntensity: 0.4 });
    const U = { uLY: { value: o.y === undefined ? -1.2 : o.y }, uFall: { value: o.fall || 0.9 }, uGlow: { value: o.glow === undefined ? 2.2 : o.glow }, uRimR: { value: o.rim === undefined ? 0.35 : o.rim } };
    m.userData.U = U;
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, U);
      s.vertexShader = 'varying vec3 vTW;\n' + s.vertexShader.replace('#include <project_vertex>', VTW);
      s.fragmentShader = 'uniform float uLY, uFall, uGlow, uRimR; varying vec3 vTW;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float hb_ = exp(-max(vTW.y - uLY, 0.0) * uFall);
        ${RIM}
        totalEmissiveRadiance += vec3(1.0, 0.32, 0.06) * hb_ * uGlow + mix(vec3(0.22, 0.3, 0.4), vec3(1.0, 0.32, 0.06), hb_) * pow(max(fr_, 0.0), 4.0) * uRimR;`);
    };
    m.customProgramCacheKey = () => 'titanHot';
    return m;
  }
  // Lava with drifting cooled-crust plates, bright seams, molten pools and a hot band hugging the platform edges. Output capped.
  function lava(o = {}) {
    const geo = o.geo || (() => { const g = new THREE.PlaneGeometry(o.size || 400, o.size || 400, o.seg || 1, o.seg || 1); g.rotateX(-PI / 2); return g; })();
    const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uHot: { value: new THREE.Color(0xffb040) }, uMid: { value: new THREE.Color(0xff4a08) }, uCool: { value: new THREE.Color(0x140605) },
      uScale: { value: o.scale || 0.09 }, uSpeed: { value: o.speed || 0.05 }, uHeat: { value: o.heat === undefined ? 0.6 : o.heat }, uSwell: { value: o.swell || 0 }, uEdge: { value: o.edge === undefined ? 1 : o.edge } }]);
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: U, fog: true,
      vertexShader: `uniform float uTime, uSwell; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vec4 wp = modelMatrix * vec4(position, 1.0);
          wp.y += uSwell * (sin(wp.x * 0.21 + uTime * 0.7) * 0.6 + sin(wp.z * 0.17 - uTime * 0.55) * 0.4 + sin((wp.x + wp.z) * 0.37 + uTime * 1.1) * 0.25);
          vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime, uScale, uSpeed, uHeat, uEdge; uniform vec3 uHot, uMid, uCool; varying vec3 vW;
        #include <fog_pars_fragment>
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        vec2 h22(vec2 p){ return vec2(h21(p), h21(p + 17.31)); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * n2(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
        void main(){
          // swirl slowly around the titan: flow coordinates are (angle-ish, radius) so streaks wrap the arena
          float r = length(vW.xz), t = uTime * uSpeed;
          vec2 q = vW.xz * uScale;
          vec2 w = vec2(fbm(q * 0.7 + vec2(t, -t * 0.6)), fbm(q * 0.7 + vec2(5.2, 1.3) - t));
          vec2 fq = q + w * 1.6 + vec2(t * 1.4, t * 0.5);
          float flow = fbm(vec2(fq.x * 2.2, fq.y * 0.7));            // stretched: reads as streaks of moving lava
          float isl = fbm(q * 1.3 + w * 0.9 - vec2(t * 0.9, t * 0.3)); // drifting crust islands
          float edge = (exp(-abs(r - 21.0) * 0.6) + exp(-abs(r - 12.0) * 0.8)) * uEdge;
          float island = smoothstep(0.45, 0.5, isl) * (1.0 - clamp(edge * 0.8, 0.0, 1.0));
          float rim = smoothstep(0.41, 0.46, isl) - island;               // bright glowing island edges
          vec3 hot = mix(uMid * 0.75, uHot * 1.3, clamp(pow(max(flow, 0.0), 2.0) * 1.6 + edge * 0.3, 0.0, 1.0)) * (0.55 + uHeat * 0.6);
          vec3 crustC = uCool * (0.45 + fbm(q * 6.0) * 0.9);
          vec3 col = mix(hot, crustC, island) + uHot * clamp(rim, 0.0, 1.0) * 0.9 * (0.6 + uHeat * 0.5);
          col *= 0.93 + 0.07 * sin(uTime * 1.3 + flow * 12.0);
          gl_FragColor = vec4(clamp(col, 0.0, 3.0), 1.0);
          #include <fog_fragment>
        }`,
    }));
    m.position.y = o.y || 0; m.onBeforeRender = () => { U.uTime.value = G.now; };
    return m;
  }
  // Soft additive glow card for eyes, mouth and core.
  let glowTex = null;
  function glowSprite(color, size, op = 1) {
    if (!glowTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.material.map.userData.shared = true; s.geometry.userData.shared = true; s.scale.setScalar(size); return s;
  }

  function build(b) {
    const g = G.world, S = b.state; glowTex = null;
    const sky = W.sky({ top: 0x070103, horizon: 0x2e0c06, bottom: 0x0e0302, exp: 0.4, clouds: 0.9, cloudColor: 0x3a2826, cloudDark: 0x050404, cloudScale: 1.1, cloudSpeed: 0.025, sunDir: [-0.26, 0.12, -0.95], sunColor: 0xff5018, sunSize: 0, sunGlow: 0.7, stars: 0 }); g.add(sky); S.sky = sky; W.env(sky, 0.7);
    scene.fog = new THREE.FogExp2(0x120706, 0.0085); S.fogC = scene.fog.color;
    S.hemi = W.hemi(g, 0x2a3a48, 0x8a3a10, 1.1); // cool teal-grey from above, lava from below
    S.sun = W.sun(g, { dir: [0.5, 0.9, 0.5], color: 0xffb890, intensity: 1.4, size: 30 });
    // lava bounce: an unshadowed fill from below so undersides never go pure black
    S.bounce = new THREE.DirectionalLight(0xff6a24, 1.5); S.bounce.position.set(0, -80, 12); g.add(S.bounce); g.add(S.bounce.target);
    S.lavaL = new THREE.PointLight(0xff5a10, 60, 90, 1.5); S.lavaL.position.set(0, -0.6, 0); g.add(S.lavaL); // low: it used to sit inside the chest and blow it out
    // cool back light, re-aimed every frame from behind the titan toward the camera, to cut its silhouette out of the orange
    S.rimL = new THREE.DirectionalLight(0x8aa4c8, 0.9); S.rimL.position.set(0, 40, -80); g.add(S.rimL); g.add(S.rimL.target);
    S.lake = lava({ size: 400, seg: 100, scale: 0.09, speed: 0.05, y: -1.2, heat: 0.6, swell: 0.1 }); g.add(S.lake);
    // ring floor: cooler, darker basalt with thin cracks
    const fl = W.bake(512, (u, v) => { const n = W.fbm(u * 14, v * 14, 3, 5, 14), c = W.cell(u * 12, v * 12, 5, 12), crack = smooth(sat(c[1] * 16)); return [n * 0.45 + crack * 0.55, 0.2 + n * 0.55 + (1 - c[0]) * 0.15, 0.95 - n * 0.3]; }, { dark: 0x0a0909, light: 0x3c3836, strength: 3.5 });
    const em = W.bake(512, (u, v) => { const c = W.cell(u * 12, v * 12, 5, 12), n = W.fbm(u * 4, v * 4, 9, 3, 4); const e = Math.pow(1 - sat(c[1] * 18), 3) * sat(n * 1.8 - 0.4); return [0, e, 1]; }, { dark: 0x000000, light: 0xffffff });
    for (const t of [fl.map, fl.normalMap, fl.roughnessMap, em.map]) t.repeat.set(5, 5);
    const ringG = new THREE.RingGeometry(R0, R1, 128, 4); ringG.rotateX(-PI / 2); const ruv = ringG.attributes.uv, rp = ringG.attributes.position; for (let i = 0; i < ruv.count; i++) ruv.setXY(i, rp.getX(i) / 42 + 0.5, rp.getZ(i) / 42 + 0.5);
    S.floorMat = new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, roughnessMap: fl.roughnessMap, roughness: 0.85, metalness: 0.15, emissive: 0xff4a10, emissiveMap: em.map, emissiveIntensity: 1.5 });
    S.FU = { uEW: { value: 2.6 }, uFl: { value: 0.1 } };
    S.floorMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, S.FU); sh.vertexShader = 'varying vec3 vTW;\n' + sh.vertexShader.replace('#include <project_vertex>', VTW);
      sh.fragmentShader = 'uniform float uEW, uFl; varying vec3 vTW;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rr_ = length(vTW.xz), ed_ = max(smoothstep(${R0}.0 + uEW, ${R0}.0, rr_), smoothstep(${R1}.0 - uEW, ${R1}.0, rr_));
        totalEmissiveRadiance *= uFl + ed_ * 1.3;`); };
    S.floorMat.customProgramCacheKey = () => 'titanFloor';
    const floor = new THREE.Mesh(ringG, S.floorMat); floor.receiveShadow = true; g.add(floor);
    const rk = W.surface('rock', { size: 256, dark: 0x0a0808, light: 0x4a4040, strength: 5 }); for (const k in rk) rk[k].repeat.set(2, 2);
    const rkW = W.surface('rock', { size: 256, seed: 7, dark: 0x080606, light: 0x3a3230, strength: 6 }); for (const k in rkW) rkW[k].repeat.set(14, 3);
    S.hot = hotRock(rk, { fall: 1.2, glow: 1.2 }); S.hotIn = hotRock(rk, { side: THREE.BackSide, fall: 0.5, glow: 1.6 });
    const under = new THREE.Mesh(new THREE.CylinderGeometry(R1, R1 + 3, 6, 64, 1, true), S.hot); under.position.y = -3; g.add(under);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0 - 1.5, 5, 64, 1, true), S.hotIn); inner.position.y = -2.5; g.add(inner);
    S.makeHide = hideMaker(S);
    S.lipMat = S.makeHide({ ei: 2.4, rim: 0.5 }); const lip = new THREE.Mesh(new THREE.TorusGeometry(R0 + 0.05, 0.22, 6, 96), S.lipMat); lip.rotation.x = PI / 2; lip.position.y = 0.05; g.add(lip);
    S.groove = new THREE.MeshStandardMaterial({ color: 0x050303, emissive: FIRE, emissiveIntensity: 0.55 });
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, R1 - R0), S.groove); const a = i * SEG; m.position.set(Math.sin(a) * MID, 0.016, Math.cos(a) * MID); m.rotation.y = a; g.add(m); }
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SC = new V3(), P = new V3(), h2 = W.hash2;
    // boulders along the outer lip, and cooled crust rafts drifting further out
    const nB = 20, nR = 9, bould = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), hotRock(rk, { fall: 2.2, glow: 1.0, rim: 0.5, color: 0x8a8080 }), nB + nR);
    for (let i = 0; i < nB + nR; i++) {
      const raft = i >= nB, a = (raft ? (i - nB) / nR : i / nB) * TAU + h2(i, 2, 3) * 0.12, r = raft ? 27 + h2(i, 5, 3) * 12 : R1 + 1.8 + h2(i, 5, 3) * 2.6;
      const sx = raft ? 2 + h2(i, 1, 3) * 3 : 1.6 + h2(i, 1, 3) * 3.2, sy = raft ? 0.35 + h2(i, 4, 3) * 0.4 : 0.8 + h2(i, 6, 3) * 2.4;
      P.set(Math.sin(a) * r, raft ? -1.15 : -1.3 + sy * 0.45, Math.cos(a) * r); E.set((h2(i, 7, 3) - 0.5) * 0.4, h2(i, 8, 3) * 6, (h2(i, 9, 3) - 0.5) * 0.4); Q.setFromEuler(E);
      SC.set(sx, sy, sx * (0.7 + h2(i, 10, 3) * 0.5)); M.compose(P, Q, SC); bould.setMatrixAt(i, M);
    }
    g.add(bould);
    // jagged basalt-column cliffs in two depth layers (one instanced draw each), with the far ridged wall behind
    const cliff = (n, r0, r1, h0, h1, wid, seed, mat, arcs) => {
      const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), mat, n); let k = 0;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + (h2(i, 1, seed) - 0.5) * (TAU / n) * 0.9; if (arcs && Math.sin(a * arcs + seed) < -0.35) continue;
        const ridge = W.fbm((a / TAU + 0.5) * 12, 0.5, seed, 4, 12), r = r0 + h2(i, 2, seed) * (r1 - r0) + ridge * 3;
        const h = h0 + (h1 - h0) * Math.pow(ridge, 1.4) * (0.75 + h2(i, 3, seed) * 0.5), w = wid * (0.7 + h2(i, 4, seed) * 0.6);
        P.set(Math.sin(a) * r, -2 + h / 2, Math.cos(a) * r); E.set((h2(i, 5, seed) - 0.5) * 0.08, h2(i, 6, seed) * 3, (h2(i, 7, seed) - 0.5) * 0.08); Q.setFromEuler(E); SC.set(w, h, w); M.compose(P, Q, SC); im.setMatrixAt(k++, M);
      }
      im.count = k; g.add(im); return im;
    };
    cliff(150, 46, 52, 4, 26, 1.7, 21, hotRock(rk, { fall: 0.3, glow: 0.9, rim: 0.6, color: 0xb0a8a8 }), 3);
    cliff(240, 62, 70, 12, 44, 2.2, 23, hotRock(rk, { fall: 0.12, glow: 0.7, rim: 0.4, color: 0x9a9090 }), 0);
    // lava falls pouring from the outer cliffs into the lake
    const fallU = { uTime: { value: 0 } }, fallMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, fallU]), fog: true, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        #include <fog_pars_fragment>
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          float s = n2(vec2(vUv.x * 9.0, vUv.y * 2.0 + uTime * 1.6)) * 0.6 + n2(vec2(vUv.x * 23.0, vUv.y * 5.0 + uTime * 2.7)) * 0.4;
          float side = smoothstep(0.0, 0.25 + s * 0.15, vUv.x) * smoothstep(1.0, 0.75 - s * 0.15, vUv.x);
          if (side < 0.35) discard;
          vec3 col = mix(vec3(0.9, 0.16, 0.02), vec3(1.5, 0.85, 0.3), clamp(s * s * 1.6 * side, 0.0, 1.0)) * (0.5 + 0.5 * vUv.y + 0.3 * (1.0 - vUv.y));
          gl_FragColor = vec4(clamp(col, 0.0, 2.5), 1.0);
          #include <fog_fragment>
        }`,
    });
    for (const [fa, fw, fh] of [[0.6, 4, 30], [2.3, 3, 36], [3.5, 5, 28], [4.6, 3, 34], [5.6, 4, 26]]) {
      const geo = new THREE.PlaneGeometry(fw, fh, 1, 1), m = new THREE.Mesh(geo, fallMat), fr = 61;
      m.position.set(Math.sin(fa) * fr, -1.2 + fh / 2, Math.cos(fa) * fr); m.rotation.y = fa + PI; m.onBeforeRender = () => { fallMat.uniforms.uTime.value = G.now; }; g.add(m);
      const sp = glowSprite(0xff5a14, fw * 3.2, 0.55); sp.position.set(Math.sin(fa) * (fr - 2), 0, Math.cos(fa) * (fr - 2)); g.add(sp);
    }
    const wallRing = (r, h, y, seed, mat) => {
      const geo = new THREE.CylinderGeometry(r, r * 1.06, h, 120, 12, true), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), yy = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), u = (a / TAU + 0.5) * 24, k = yy / h + 0.5;
        const n = W.fbm(u, k * 4, seed, 4, 24), ridge = Math.abs(Math.sin(a * 38 + n * 4)), d = 1 + (n - 0.5) * 0.16 - ridge * 0.025 - k * 0.04;
        p.setXYZ(i, x * d, yy + (k > 0.9 ? (n - 0.4) * h * 0.45 : 0), z * d);
      }
      geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m); return m;
    };
    wallRing(96, 84, 34, 13, hotRock(rkW, { side: THREE.BackSide, fall: 0.06, glow: 0.5, rim: 0.3, color: 0x7a6a68 }));
    // far volcano and its plume
    const volc = new THREE.Mesh(new THREE.ConeGeometry(150, 170, 14, 1, true), hotRock(rk, { y: 120, fall: 0.03, glow: 1.0 })); volc.position.set(-90, 60, -330); g.add(volc);
    S.plume = new THREE.Mesh(new THREE.ConeGeometry(34, 150, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a10).multiplyScalar(1.2), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); S.plume.position.set(-90, 215, -330); S.plume.rotation.x = PI; g.add(S.plume);
    S.embers = W.motes({ n: 900, box: [80, 34, 80], color: 0xff8030, size: 0.11, vel: [0.4, 1.7, 0.2], sway: 1.1, center: [0, 15, 0], mult: 1.4 }); g.add(S.embers);
    S.ash = W.motes({ n: 700, box: [80, 30, 80], color: 0x9a8e8c, size: 0.075, vel: [0.6, -1.2, 0.3], sway: 0.8, center: [0, 14, 0], additive: false, alpha: 0.3 }); g.add(S.ash);
    // rising-lava overlays per segment
    S.seg = [];
    for (let i = 0; i < 8; i++) { const sg = new THREE.RingGeometry(R0 + 0.1, R1 - 0.05, 20, 1, i * SEG - PI / 2 + 0.008, SEG - 0.016); sg.rotateX(-PI / 2); const m = lava({ geo: sg, scale: 0.16, speed: 0.12, y: -0.5, heat: 0.75, edge: 0 }); m.visible = false; g.add(m); S.seg.push({ m, lvl: 0, on: false, gone: false }); }

    // ---- the titan ----
    // Hunched, waist-deep in the lake: barrel chest with a furnace core, a hump of basalt spires, heavy pauldrons,
    // a low head with a glowing jaw, long arms tapering to slag fists.
    const bg = b.group; S.body = new THREE.Group(); bg.add(S.body);
    const H = S.makeHide, skin = H({ ei: 1.7 }), crust = H({ ei: 0.45, color: 0x9a8c86, rim: 1.2 }), obs = H({ ei: 0.25, color: 0x4a4040, rough: 0.4, metal: 0.25, rim: 1.8 });
    const SPH = new THREE.SphereGeometry(1, 14, 10), DOD = new THREE.DodecahedronGeometry(1, 0), DOD1 = new THREE.DodecahedronGeometry(1, 1);
    const add = (parent, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; };
    const spire = (h, r) => { const geo = new THREE.ConeGeometry(r, h, 5); geo.translate(0, h / 2, 0); return geo; };
    S.torso = new THREE.Group(); S.body.add(S.torso);
    add(S.torso, new THREE.CylinderGeometry(4.4, 5.4, 9, 11, 2), skin, 0, 3.0, 0.2);
    add(S.torso, SPH, skin, 0, 10.0, 0.9, 7.4, 5.8, 5.3, 0.22);
    add(S.torso, SPH, skin, 0, 12.6, -2.4, 6.4, 4.6, 5.0, -0.35);
    for (let i = 0; i < 10; i++) { const a = i * 2.4, y = 6 + (i % 5) * 2.0, r = 6.2 - Math.max(0, y - 10) * 0.2; add(S.torso, DOD, crust, Math.sin(a) * r, y, Math.cos(a) * r * 0.85, 1.6 + h2(i, 1, 6) * 1.2, 1.0 + h2(i, 2, 6) * 0.6, 1.4 + h2(i, 3, 6), i, i * 2, i * 3); }
    // hump spires
    for (let i = 0; i < 13; i++) { const a = (i - 6) / 6, back = i % 2, h = 2.6 + (1 - Math.abs(a)) * 3.4 + h2(i, 4, 7) * 1.4 - back * 1.2; add(S.torso, spire(h, 0.55 + (1 - Math.abs(a)) * 0.35), obs, a * 5.2, 14.6 + (1 - Math.abs(a)) * 1.6 - back * 0.9, -3.0 - back * 1.6 - Math.abs(a) * 0.4, 1, 1, 1, -0.5 - back * 0.25 - h2(i, 5, 7) * 0.2, 0, -a * 0.55); }
    // pauldrons
    for (const sx of [-1, 1]) {
      add(S.torso, DOD, crust, sx * 8.6, 15.6, 0.2, 5.8, 4.0, 5.4, 0.2, sx * 0.5, sx * -0.3);
      add(S.torso, DOD, skin, sx * 7.6, 13.4, 0.8, 4.2, 2.4, 4.2, 0, 0.4, 0);
      for (let k = 0; k < 5; k++) add(S.torso, spire(3.4 + (k % 3) * 1.3, 0.75), obs, sx * (7.6 + k * 1.1), 18.6 - k * 0.45, -2.2 + k * 1.15, 1, 1, 1, -0.25 + k * 0.08, 0, -sx * (0.35 + k * 0.22));
    }
    // chest core, behind four plates that peel open when it is staggered
    S.coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: W.bake(128, (u, v) => { const n = W.fbm(u * 6, v * 6, 61, 4, 6), c = W.cell(u * 5, v * 5, 62, 5); return [0, sat(n * 1.3 - 0.15) * (0.55 + 0.45 * smooth(sat(c[1] * 4))), 1]; }, { dark: 0x3a0a02, light: 0xffe6b0 }).map }); S.core = add(S.torso, new THREE.IcosahedronGeometry(2.2, 2), S.coreMat, 0, 9.6, 5.3); S.core.castShadow = false;
    S.coreGlow = glowSprite(0xff7a2a, 6, 0.3); S.coreGlow.position.set(0, 9.6, 7.6); S.torso.add(S.coreGlow);
    S.coreL = new THREE.PointLight(0xffa040, 0, 50, 1.6); S.coreL.position.set(0, 9.6, 8.5); S.torso.add(S.coreL);
    S.HU.uCore.value.set(0, 6.6, 5.5);
    S.plates = []; for (let i = 0; i < 4; i++) { const sx = i % 2 ? 1 : -1, sy = i < 2 ? 1 : -1, pv = new THREE.Group(); pv.position.set(sx * 2.9, 9.6 + sy * 2.9, 6.3); S.torso.add(pv); const pl = add(pv, DOD, crust, -sx * 1.15, -sy * 1.15, 0.5, 1.55, 1.55, 0.9, 0, 0, i * 0.6); void pl; S.plates.push({ pv, sx, sy }); }
    // head: low and forward between the pauldrons
    S.head = new THREE.Group(); S.head.position.set(0, 13.4, 5.6); S.torso.add(S.head);
    add(S.head, DOD, crust, 0, 1.3, -0.2, 2.9, 1.8, 2.7, 0.15);
    add(S.head, new THREE.BoxGeometry(5.4, 0.9, 1.6), crust, 0, 0.9, 1.9, 1, 1, 1, 0.3);
    for (let i = 0; i < 7; i++) { const a = (i - 3) / 3; add(S.head, spire(2.2 + (1 - Math.abs(a)) * 2.6, 0.42), obs, a * 2.3, 2.5 - Math.abs(a) * 0.4, -0.4 - Math.abs(a) * 0.5, 1, 1, 1, -0.35, 0, -a * 0.45); }
    S.eyes = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd070).multiplyScalar(5) });
    S.eyeGlow = [];
    for (const sx of [-1, 1]) { add(S.head, SPH, S.eyes, sx * 1.2, 0.3, 2.25, 0.45, 0.24, 0.3, 0, 0, -sx * 0.3).castShadow = false; const gs = glowSprite(0xffb050, 2.6, 0.8); gs.position.set(sx * 1.2, 0.3, 2.7); S.head.add(gs); S.eyeGlow.push(gs); }
    S.jaw = new THREE.Group(); S.jaw.position.set(0, -0.4, -0.2); S.head.add(S.jaw);
    add(S.jaw, DOD, skin, 0, -0.9, 1.0, 2.5, 0.9, 2.3, 0.1);
    for (let i = 0; i < 4; i++) add(S.jaw, spire(0.7, 0.18), obs, (i - 1.5) * 0.9, -0.3, 2.9, 1, 1, 1, 0, 0, 0);
    S.mouth = new THREE.MeshBasicMaterial({ color: new THREE.Color(FIRE).multiplyScalar(2) });
    add(S.head, SPH, S.mouth, 0, -0.35, 1.3, 1.7, 0.45, 1.3).castShadow = false;
    S.mouthGlow = glowSprite(0xff7020, 3.2, 0.3); S.mouthGlow.position.set(0, -0.4, 3.0); S.head.add(S.mouthGlow);
    // arms: each mesh has its own material so the camera fade can thin a limb without touching the rest
    S.arms = [];
    for (const sx of [-1, 1]) {
      const ag = new THREE.Group(); ag.position.set(sx * 7.6, 14.2, 0.5); S.torso.add(ag);
      const limb = (geo, o, x, y, z, s1, s2, s3, rx = 0, ry = 0, rz = 0) => { const m = add(ag, geo, H(o), x, y, z, s1, s2, s3, rx, ry, rz); m.userData.fadeOcclude = true; m.userData.fadeMin = 0.15; return m; };
      const up = new THREE.CylinderGeometry(1.75, 2.4, 8.6, 9); up.rotateX(PI / 2); limb(up, { ei: 1.6 }, 0, 0, 4.2, 1, 1, 1);
      limb(DOD, { ei: 0.45, color: 0x9a8c86, rim: 1.2 }, 0, 0.3, 8.4, 2.3, 2.1, 2.3);
      const fo = new THREE.CylinderGeometry(1.35, 1.9, 7.6, 9); fo.rotateX(PI / 2); limb(fo, { ei: 1.9 }, 0, 0, 12.3, 1, 1, 1);
      limb(DOD1, { ei: 2.6, rim: 1.4 }, 0, 0, 16.6, 3.1, 2.6, 3.3, 0.3, 0.2, 0);
      limb(DOD, { ei: 0.5, color: 0x9a8c86, rim: 1.2 }, 0, 1.6, 15.6, 2.4, 1.2, 2.0, 0.2, 0, 0);
      for (let k = 0; k < 3; k++) limb(DOD, { ei: 0.6, color: 0x9a8c86, rim: 1.2 }, (k - 1) * 1.6, -0.3, 19.1, 1.0, 0.9, 1.1, k, k, 0);
      for (let k = 0; k < 3; k++) {
        const z0 = 10.5 + k * 2.3, x0 = (k - 1) * 0.9, len = 3.2 + h2(k, sx + 3, 9) * 3.5;
        const curve = new THREE.CatmullRomCurve3([new V3(x0, -1.3, z0), new V3(x0 + 0.2, -1.3 - len * 0.5, z0 + 0.3), new V3(x0 - 0.1, -1.3 - len, z0 + 0.1)]);
        const tg = new THREE.TubeGeometry(curve, 10, 0.13, 5, false), tp = tg.attributes.position, cols = new Float32Array(tp.count * 3);
        for (let q = 0; q < tp.count; q++) { const kk = sat((-1.3 - tp.getY(q)) / len), c = new THREE.Color().setRGB(lerp(0.9, 1.6, kk), lerp(0.12, 0.55, kk), lerp(0.02, 0.1, kk)); cols[q * 3] = c.r; cols[q * 3 + 1] = c.g; cols[q * 3 + 2] = c.b; }
        tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        const st = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true })); st.userData.fadeOcclude = true; st.userData.fadeMin = 0.15; ag.add(st);
        const drop = new THREE.Mesh(SPH, st.material.clone()); drop.material.vertexColors = false; drop.material.color.setRGB(1.8, 0.7, 0.15); drop.scale.set(0.22, 0.32, 0.22); drop.position.set(x0 - 0.1, -1.4 - len, z0 + 0.1); drop.userData.fadeOcclude = true; ag.add(drop);
      }
      S.arms.push({ g: ag, sx, cur: new V3(sx * 11, 1, 6), tgt: new V3(), mode: 'rest', hold: 0, ang: 0 });
    }
    // every body part gets its own material so the camera fade can thin whatever sits between camera and player
    b.group.traverse((o) => { if (!o.isMesh || !o.material.userData.hideOpts || o.userData.fadeOcclude) return; o.material = H(o.material.userData.hideOpts); o.userData.fadeOcclude = true; o.userData.fadeMin = 0.22; });
    b.ringY = -1.1; // the target ring sits down on the lava, not glaring over the platform
    S.geodes = []; S.geoGeo = new THREE.CylinderGeometry(0.0, 0.55, 3.0, 6, 1); S.geoGeo.translate(0, 0.6, 0); { const p = S.geoGeo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) - 0.5 * (1 + Math.sin(i * 1.7))); S.geoGeo.computeVertexNormals(); }
    S.geoMat = new THREE.MeshStandardMaterial({ color: 0x1a4a6a, emissive: 0x30c8ff, emissiveIntensity: 0.8, roughness: 0.08, metalness: 0.35, flatShading: true, envMapIntensity: 2.0 });
    // facets: inner glow where a face looks at the camera, a pale cyan edge at grazing angles
    S.geoMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      ${RIM}
      totalEmissiveRadiance *= 0.15 + pow(max(1.0 - fr_, 0.0), 3.0) * 0.9;
      totalEmissiveRadiance += vec3(0.5, 0.9, 1.2) * pow(max(fr_, 0.0), 2.5) * 0.9;`); };
    S.geoMat.customProgramCacheKey = () => 'titanGeode';
    S.open = 0; S.stag = 0; S.armor = 0.6; S.lvl = 0; S.rise = 0; S.pend = null; S.swp = null; S.breath = 0; S.stoke = 0;
    b.dmgTaken = S.armor;
    return {
      edge: 'wall', camDist: 19, camPitch: 0.2, spawn: { x: 0, z: 17.5 }, bossStart: { x: 0, z: 0, face: 0 }, ringY: 0,
      contains: (x, z) => { const r = Math.hypot(x, z); return r >= R0 + 0.3 && r <= R1 - 0.3; },
      clamp(p) { const r = Math.hypot(p.x, p.z) || 1, c = clamp(r, R0 + 0.45, R1 - 0.45); if (c !== r) { p.x *= c / r; p.z *= c / r; } },
      // Far out over the lava the camera stays low so the whole titan fits above the player instead of being cut at the chest.
      camLimit(x, y, z) { let r = Math.hypot(x, z); if (r > 38) { x *= 38 / r; z *= 38 / r; r = 38; } else if (r < R0 + 0.8 && y < 26) { const k = (R0 + 0.8) / (r || 1); x *= k; z *= k; } const cap = r > 27 ? lerp(17, 6, smooth(sat((r - 27) / 8))) : 99; return { x, y: clamp(y, r > R1 ? 2.8 : 0.5, cap), z }; },
      bulletBounds: (x, z) => x * x + z * z < 30 * 30,
    };
  }

  // ---- mechanics ----
  const wedge = (a, arc, delay, dmg, o) => Hz.cone(0, 0, a, arc, R1 + 0.4, delay, dmg, Object.assign({ r0: R0 - 0.3, color: TELE }, o));
  function spawnGeode(b) {
    const S = b.state; if (S.geodes.filter((q) => q.alive).length >= 2) return;
    let a, tries = 0; do { a = rnd(TAU); tries++; } while (tries < 30 && (S.seg[Math.floor(((a % TAU) + TAU) % TAU / SEG)].on || S.seg[Math.floor(((a % TAU) + TAU) % TAU / SEG)].gone || Math.abs(angDiff(a, playerAng())) < 0.5 || S.geodes.some((q) => q.alive && Math.abs(angDiff(a, q.a)) < 0.9)));
    const grp = new THREE.Group(); grp.position.set(Math.sin(a) * MID, 0, Math.cos(a) * MID);
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(S.geoGeo, S.geoMat); const k = i === 0 ? 0 : 0.7; c.position.set(Math.sin(i * 1.3) * k, 1.0 + (i === 0 ? 0.5 : 0), Math.cos(i * 1.3) * k); c.rotation.set(Math.cos(i * 1.3) * 0.5 * k, i, -Math.sin(i * 1.3) * 0.5 * k); c.scale.setScalar(i === 0 ? 1.25 : 0.55 + W.hash2(i, 2, 4) * 0.5); c.castShadow = true; grp.add(c); }
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3, c = new THREE.Mesh(S.geoGeo, S.geoMat); c.position.set(Math.sin(a) * 1.5, 0.05, Math.cos(a) * 1.5); c.rotation.set(Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1); c.scale.setScalar(0.22 + W.hash2(i, 5, 4) * 0.18); grp.add(c); }
    const L = new THREE.PointLight(0x40d0ff, 32, 14, 1.6); L.position.y = 2; grp.add(L); grp.scale.setScalar(0.01); G.world.add(grp);
    S.geodes.push({ a, grp, alive: true, t: 0 }); Sound.sfx('shatter', 0.4, 0.6); FX.pillar(grp.position.x, grp.position.z, { r: 1, h: 10, color: ICE, dur: 0.6 });
  }
  function stagger(b, q) {
    const S = b.state; q.alive = false; q.grp.visible = false; const x = q.grp.position.x, z = q.grp.position.z;
    FX.explode(x, 1.5, z, ICE, 8, 0xffffff); FX.lightning(new V3(x, 2, z), new V3(0, 10, 0), { color: ICE, width: 0.6, jag: 2.5, dur: 0.5 }); FX.flash(ICE, 0.35, 2.5); Sound.sfx('shatter'); Sound.sfx('roar', 1, 0.7); FX.shake(1);
    S.stag = 9; b.dmgTaken = 2.0; b.castState = null; FX.num(b.aim(new V3()), 'STAGGERED', 'note');
  }
  function* reel(b) { const S = b.state; while (S.stag > 0) yield; yield 0.8; }
  function* slam(b, o = {}) {
    const S = b.state, arc = 0.72, t = o.time || 1.9, extra = o.extra || [];
    const arm = S.arms[angDiff(b.facing, playerAng()) > 0 ? 1 : 0], other = S.arms[arm === S.arms[0] ? 1 : 0];
    let a = playerAng(); S.pend = { t, lock: 0.85 };
    const h = wedge(a, arc, t, 430, { name: 'Slam', lock: 0.85, track: (s) => { s.dir = dampAng(s.dir, playerAng(), 10, G.dt); a = s.dir; }, kb: { dist: 4 }, quiet: true, onFire: () => {
      FX.shake(1); Sound.sfx('bigboom', 0.9); pt(a, MID, 0.5, _v); FX.explode(_v.x, 0.5, _v.z, FIRE, 7, 0xffd080); for (let k = 0; k < 3; k++) { pt(a + (k - 1) * 0.25, R0 + 2 + k * 3, 0.3, _v); FX.burst(_v.x, 0.3, _v.z, { n: 16, smoke: true, color: 0x3a2a24, color2: 0x0a0808, speed: [2, 8], up: 5, grav: 12, life: [0.8, 1.6], size: [0.5, 1.4] }); }
      Hz.zone({ type: 'cone', x: 0, z: 0, dir: a, arc, r: R1 + 0.4, r0: R0 - 0.3 }, o.burn || 6, 80, { name: 'Scorch', color: ZONE, delay: 0.5 });
      for (const q of S.geodes) if (q.alive && Math.abs(angDiff(a, q.a)) < arc / 2 + 0.12) stagger(b, q);
    } });
    arm.mode = 'raise'; arm.ang = a;
    for (const e of extra) { const a2 = a + e; wedge(a2, arc, t, 430, { name: 'Slam', kb: { dist: 4 }, quiet: true, silent: true, track: (s) => { s.dir = a + e; }, lock: 0.85, onFire: (hh) => { const d = hh.shape.dir; pt(d, MID, 0.5, _v); FX.explode(_v.x, 0.5, _v.z, FIRE, 7, 0xffd080); for (const q of S.geodes) if (q.alive && Math.abs(angDiff(d, q.a)) < arc / 2 + 0.12) stagger(b, q); } }); other.mode = 'raise'; other.ang = a2; other.follow = e; }
    let el = 0; while (el < t) { el += G.dt; S.pend.t = t - el; arm.ang = a; if (extra.length) other.ang = a + extra[0]; yield; }
    S.pend = null; arm.mode = 'slam'; arm.hold = 1.3; if (extra.length) { other.mode = 'slam'; other.hold = 1.3; }
    void h; yield 0.3; if (S.stag > 0) { yield* reel(b); return; } yield o.rest === undefined ? 1.2 : o.rest;
  }
  function* sweepArm(b) {
    const S = b.state, s = rnd() < 0.5 ? 1 : -1, pa = playerAng(), gap = pa + s * rnd(1.75, 2.15), gArc = 1.05, t = 3.4;
    yield* b.cast({ name: 'Sunder the Ring', time: 0.6 });
    S.swp = { gap, t }; const arm = S.arms[s > 0 ? 1 : 0]; arm.mode = 'sweep'; arm.ang = gap + s * gArc / 2; arm.hold = 99;
    Hz.mark({ type: 'cone', x: 0, z: 0, dir: gap, arc: gArc - 0.1, r: R1, r0: R0 }, t, { color: 0x80ffd0, alpha: 0.8 });
    wedge(gap + PI, TAU - gArc, t, 480, { name: 'Sunder the Ring', kb: { dist: 5 }, quiet: true, onFire: () => { Sound.sfx('bigboom'); FX.shake(1.1); FX.flash(FIRE, 0.25, 3); for (let k = 0; k < 10; k++) { pt(gap + gArc / 2 + (k + 0.5) / 10 * (TAU - gArc), MID, 0.5, _v); FX.explode(_v.x, 0.5, _v.z, FIRE, 5); } } });
    let el = 0; while (el < t - 0.45) { el += G.dt; S.swp.t = t - el; yield; }
    const a0 = arm.ang; el = 0; while (el < 0.5) { el += G.dt; arm.ang = a0 + s * (TAU - gArc) * smooth(el / 0.5); yield; }
    S.swp = null; arm.hold = 0.6; arm.mode = 'slam'; yield 1.6;
  }
  function* surge(b, list, o = {}) {
    const S = b.state; yield* b.cast({ name: 'Lava Surge', time: 0.8 }); const warn = o.warn || 2.6, dur = o.dur || 6;
    for (const i of list) { const sg = S.seg[i]; if (sg.gone) continue; sg.on = true; sg.until = warn + dur; sg.warn = warn; Hz.zone({ type: 'cone', x: 0, z: 0, dir: (i + 0.5) * SEG, arc: SEG + 0.004, r: R1 + 0.3, r0: R0 - 0.3 }, dur, 110, { name: 'Lava', color: ZONE, delay: warn, every: 0.5 }); }
    Sound.sfx('steam'); yield o.wait === undefined ? warn + 0.6 : o.wait;
  }
  const pickSegs = (S, n) => {
    // always the player's segment, never both of its neighbours: one side stays walkable
    const p = segOf(G.player.pos.x, G.player.pos.z), bad = (i) => S.seg[i].gone || S.seg[i].on, L = (p + 7) % 8, Rt = (p + 1) % 8;
    const keep = bad(L) ? Rt : bad(Rt) ? L : rnd() < 0.5 ? L : Rt;
    const all = shuffle([0, 1, 2, 3, 4, 5, 6, 7].filter((i) => !S.seg[i].gone && i !== p && i !== keep)), out = [p];
    for (const i of all) { if (out.length >= n) break; out.push(i); } return out;
  };
  function* breath(b) {
    const S = b.state, a = playerAng(); S.breath = 1;
    wedge(a, 0.5, 1.5, 400, { name: 'Magma Breath', quiet: true, onFire: () => { Sound.sfx('roar', 0.8, 1.4); FX.shake(0.6); S.breath = 2; for (let k = 0; k < 9; k++) { pt(a + (vrand() - 0.5) * 0.4, R0 + k, 0.4, _v); FX.burst(_v.x, 0.5, _v.z, { n: 10, color: FIRE, color2: 0xffe0a0, speed: [2, 8], up: 5, life: [0.4, 1], size: [0.3, 0.8] }); } } });
    yield 1.5; yield 0.6; S.breath = 0; yield 0.6;
  }
  function meteor(x, z, burn) {
    Hz.circle(x, z, 3.1, 1.7, 300, { name: 'Meteor', color: TELE, quiet: true, onFire: () => { FX.explode(x, 0.5, z, FIRE, 4.5, 0xffe0a0); Sound.sfx('boom', 0.8); FX.shake(0.4); if (burn) Hz.zone({ type: 'circle', x, z, r: 2.4 }, 5, 70, { name: 'Cinders', color: ZONE, delay: 0.3 }); } });
    if (!G.headless) FX.missile(new V3(x - 30, 70, z - 50), new V3(x, 0.5, z), { speed: 52, color: 0xffa040, size: 0.9 });
  }
  function* meteors(b, n, burn) { yield* b.cast({ name: 'Cinderfall', time: 0.7 }); for (let i = 0; i < n; i++) { const p = G.player; if (i % 2 === 0) meteor(p.pos.x, p.pos.z, burn); else { const a = playerAng() + rnd(-1.4, 1.4), r = rnd(R0 + 2, R1 - 2); meteor(Math.sin(a) * r, Math.cos(a) * r, burn); } yield 0.55; } yield 1.0; }
  function* stoke(b) {
    const S = b.state; const r = yield* b.cast({ name: 'Stoke the Kiln', time: 3.4, interruptible: true, onTick: (k) => { S.stoke = k; } }); S.stoke = 0;
    if (r !== 'done') { yield 1.2; return; }
    Sound.sfx('bigboom'); FX.flash(FIRE, 0.45, 2); FX.shake(1); FX.ring(0, 0, { r0: R0, r1: R1 + 4, color: FIRE, dur: 0.8, width: 0.3 }); G.player.hurt(300, { blockable: false, src: { name: 'Eruption' } });
    for (let i = 0; i < 5; i++) { const a = rnd(TAU), rr = rnd(R0 + 2, R1 - 2); meteor(Math.sin(a) * rr, Math.cos(a) * rr, true); } yield 1.4;
  }
  function* erupt(b, lvl) {
    // escalate with contrast, not brightness: darker smoke, denser ash, wider cracks, an ember storm
    const S = b.state, U = S.sky.material.uniforms, EU = S.embers.material.uniforms; S.lvl = lvl;
    const h0 = U.uHor.value.clone(), h1 = new THREE.Color([0x2e0c06, 0x3a0c06, 0x560a04][lvl]), c0 = U.uCloudCol.value.clone(), c1 = new THREE.Color([0x3a2826, 0x40221e, 0x4a1a14][lvl]), f0 = S.fogC.clone(), f1 = new THREE.Color([0x120706, 0x140606, 0x1a0604][lvl]);
    const t0 = U.uTop.value.clone(), t1 = new THREE.Color([0x070103, 0x0c0204, 0x1a0306][lvl]), d0 = scene.fog.density, d1 = [0.0085, 0.0095, 0.0108][lvl];
    const e0 = S.floorMat.emissiveIntensity, e1 = [1.2, 1.4, 1.65][lvl], hb0 = S.HU.uHeatB.value, cr0 = S.HU.uCrack.value, r0 = S.rise, r1 = [0, 1.0, 2.0][lvl], ec0 = EU.uCol.value.clone(), ec1 = new THREE.Color(0xff8030).multiplyScalar([1.4, 2.0, 2.8][lvl]), v0 = EU.uVel.value.clone(), v1 = new V3(...[[0.4, 1.7, 0.2], [0.9, 2.6, 0.5], [1.8, 3.8, 1.0]][lvl]), a0 = S.ash.material.uniforms.uAlpha.value, lh0 = S.lake.material.uniforms.uHeat.value;
    const ew0 = S.FU.uEW.value, fl0 = S.FU.uFl.value, cb0 = S.coreBase || 0;
    yield* W.tween(3.2, (k) => { S.FU.uEW.value = lerp(ew0, [2.6, 4, 6][lvl], k); S.FU.uFl.value = lerp(fl0, [0.1, 0.16, 0.26][lvl], k); S.coreBase = lerp(cb0, [0, 0.6, 1.3][lvl], k); W.colorLerp(U.uHor.value, h0, h1, k); W.colorLerp(U.uCloudCol.value, c0, c1, k); W.colorLerp(U.uTop.value, t0, t1, k); W.colorLerp(S.fogC, f0, f1, k); scene.fog.density = lerp(d0, d1, k);
      S.floorMat.emissiveIntensity = lerp(e0, e1, k); S.HU.uHeatB.value = lerp(hb0, [0, 0.1, 0.22][lvl], k); S.HU.uCrack.value = lerp(cr0, [0, 0.35, 0.7][lvl], k); S.rise = lerp(r0, r1, k); S.lavaL.intensity = 60 + lvl * 20 * k;
      W.colorLerp(EU.uCol.value, ec0, ec1, k); EU.uVel.value.lerpVectors(v0, v1, k); S.ash.material.uniforms.uAlpha.value = lerp(a0, [0.45, 0.65, 0.9][lvl], k); S.groove.emissiveIntensity = 0.55 + lvl * 0.45 * k; S.lake.material.uniforms.uHeat.value = lerp(lh0, 0.6 + lvl * 0.14, k); });
  }

  G.bosses.push({
    id: 'titan', name: 'MOLTHAR', title: 'The Kiln-Titan', hint: 'A mountain', color: '#ff6a1a', telegraph: TELE,
    hp: 30000, radius: 11, aimY: 10, enrage: 430,
    post: { bloom: 0.5, threshold: 1.0, radius: 0.65, exposure: 1.05, vig: 1.0, sat: 1.08, contrast: 1.14, tint: [1.02, 0.98, 0.97], lift: [0, 0.006, 0.011] },
    music: { bpm: 96, root: 36, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 0, 1, 0, 0, 0, 5, 4],
      layers: [
        { v: 'taiko', pat: 'x.......x...x...', vol: 0.36 }, { v: 'sub', pat: '0...............', oct: 0, len: 14, vol: 0.24 }, { v: 'brass', pat: ['0...............', '........1.......'], oct: 1, len: 12, vol: 0.09 },
        { v: 'taiko', from: 1, pat: 'x..x..x.x..x..x.', vol: 0.3 }, { v: 'bass', from: 1, pat: '0..0..0.0..0.0..', oct: 0, len: 2, vol: 0.14 }, { v: 'choir', from: 1, pat: '0.......4.......', oct: 2, len: 9, vol: 0.08 },
        { v: 'brass', from: 2, pat: ['0.....0.2...1...', '4.....4.5...4...'], oct: 2, len: 4, vol: 0.1 }, { v: 'snare', from: 2, pat: '....x..x....x.xx', vol: 0.18 }, { v: 'tom', from: 2, pat: '..x...x...x...x.', vol: 0.2 }, { v: 'choir', from: 2, pat: '7.......8.......', oct: 2, len: 9, vol: 0.07 },
      ] },
    build,
    *intro(b) { Sound.sfx('roar', 1, 0.6); yield* Cam.shot([0, 2, 30], [0, 4, 0], [9, 5, 23], [0, 15, 0], 4.6, 58); },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; b.autoFace = true; b.turnRate = 1.6; yield 1.2;
        while (true) {
          spawnGeode(b); yield 1.0; yield* slam(b); yield* slam(b);
          yield* surge(b, pickSegs(S, 3)); yield* breath(b); yield* sweepArm(b);
          spawnGeode(b); yield* stoke(b); yield* slam(b); yield* breath(b); yield* slam(b); yield* surge(b, pickSegs(S, 3)); yield* sweepArm(b);
        }
      } },
      { at: 0.67, *enter(b) { Sound.sfx('roar', 1, 0.7); FX.shake(1.2); FX.flash(FIRE, 0.4, 1.5); Co.start(erupt(b, 1), 'fight'); Co.start(Post.lerpTo({ bloom: 0.52, contrast: 1.16, tint: [1.04, 0.97, 0.95] }, 3), 'fight'); yield 3.2; },
        *run(b) {
          const S = b.state;
          while (true) {
            spawnGeode(b); yield* meteors(b, 5, false); yield* slam(b, { extra: [PI] }); yield* slam(b);
            yield* surge(b, [0, 2, 4, 6], { wait: 4.2, dur: 5 }); yield* surge(b, [1, 3, 5, 7], { dur: 5, wait: 1.5 }); yield* breath(b); yield 2.5;
            spawnGeode(b); yield* sweepArm(b); yield* stoke(b); yield* slam(b, { extra: [PI / 2, -PI / 2] }); yield* meteors(b, 4, true); yield* slam(b); yield* breath(b);
          }
        } },
      { at: 0.34, *enter(b) {
        const S = b.state; yield* b.cast({ name: 'Cataclysm', time: 2.6, onTick: (k) => { S.stoke = k; FX.shake(k * 0.6); } }); S.stoke = 0;
        Sound.sfx('bigboom'); Sound.sfx('roar', 1, 0.5); FX.flash(0xffa040, 0.7, 1); FX.shake(1.4); Co.start(erupt(b, 2), 'fight'); Co.start(Post.lerpTo({ bloom: 0.54, threshold: 1.05, exposure: 0.98, contrast: 1.18, tint: [1.06, 0.96, 0.93] }, 3), 'fight');
        const p = segOf(G.player.pos.x, G.player.pos.z), a = (p + 4) % 8, c = (p + 5) % 8;
        for (const i of [a, c]) { const sg = S.seg[i]; sg.gone = true; sg.on = true; sg.until = 1e9; sg.warn = 3; Hz.zone({ type: 'cone', x: 0, z: 0, dir: (i + 0.5) * SEG, arc: SEG + 0.004, r: R1 + 0.3, r0: R0 - 0.3 }, 99999, 200, { name: 'Lava', tag: 'fight', color: ZONE, delay: 3, every: 0.5 }); for (const q of S.geodes) if (q.alive && Math.floor((((q.a % TAU) + TAU) % TAU) / SEG) === i) { q.alive = false; q.grp.visible = false; } }
        yield 3.4;
      }, *run(b) {
        const S = b.state;
        while (true) {
          spawnGeode(b); yield* slam(b, { extra: [PI], time: 1.7 }); yield* meteors(b, 6, true); yield* slam(b, { time: 1.7 });
          yield* surge(b, pickSegs(S, 3), { wait: 1.2 }); yield* breath(b); yield* sweepArm(b);
          spawnGeode(b); yield* stoke(b); yield* slam(b, { extra: [PI / 2, -PI / 2], time: 1.7 }); yield* surge(b, pickSegs(S, 3), { wait: 0.5 }); yield* meteors(b, 5, true); yield* slam(b, { time: 1.7 }); yield* breath(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, t = G.now;
      if (S.stag > 0) { S.stag -= dt; if (S.stag <= 0) { b.dmgTaken = S.armor; Sound.sfx('boom', 0.6, 0.6); } }
      for (const sg of S.seg) { if (!sg.on) continue; sg.until -= dt; sg.warn -= dt; if (sg.until <= 0) sg.on = false; }
      for (const q of S.geodes) if (q.alive) q.t += dt;
      if (G.headless) return;
      for (const sg of S.seg) { const tgt = sg.on ? (sg.warn > 0 ? 0.35 : 1) : 0; sg.lvl = damp(sg.lvl, tgt, sg.on ? 2.5 : 1.5, dt); sg.m.visible = sg.lvl > 0.02; sg.m.position.y = -0.5 + sg.lvl * 0.56; }
      for (const q of S.geodes) if (q.alive) { q.grp.scale.setScalar(Math.min(1, q.t / 0.6)); q.grp.rotation.y += dt * 0.3; if (vrand() < dt * 6) FX.burst(q.grp.position.x, 1.5, q.grp.position.z, { n: 1, color: ICE, speed: [0.5, 2], up: 2, life: [0.4, 0.9], size: [0.1, 0.25], radius: 0.8 }); }
      S.geoMat.emissiveIntensity = 0.8 + Math.sin(t * 4) * 0.25; S.HU.uT.value = t; { const cx = camera.position.x, cz = camera.position.z, cl = Math.hypot(cx, cz) || 1; S.rimL.position.set(-cx / cl * 70, 45, -cz / cl * 70); } S.core.getWorldPosition(S.HU.uCore.value);
      // body
      S.open = damp(S.open, S.stag > 0 ? 1 : 0, 4, dt);
      S.body.position.y = -4.2 + S.rise + Math.sin(t * 0.7) * 0.25 - S.open * 1.2; S.torso.rotation.x = S.open * 0.2 + Math.sin(t * 0.5) * 0.02 + (S.breath === 1 ? -0.08 : S.breath === 2 ? 0.14 : 0);
      S.head.rotation.x = damp(S.head.rotation.x, S.open * 0.5 + (S.stoke > 0 ? -0.5 : 0) + (S.breath ? 0.25 : 0.12), 5, dt);
      for (const p of S.plates) { p.pv.rotation.y = p.sx * S.open * 1.3; p.pv.rotation.x = -p.sy * S.open * 0.9; }
      const heat = 0.9 + (S.coreBase || 0) + S.open * 3 + S.stoke * 2 + Math.sin(t * 2.4) * 0.15; const hk = Math.min(heat, 3); S.coreMat.color.setRGB(0.8 * hk + 0.25, 0.34 * hk + 0.06, 0.07 * hk); S.coreL.intensity = S.open * 500 + S.stoke * 200;
      S.mouth.color.setHex(FIRE).multiplyScalar(0.8 + S.stoke * 6 + (S.breath ? 6 : 0)); S.eyes.color.setHex(S.stag > 0 ? 0x404040 : 0xffd070).multiplyScalar(S.stag > 0 ? 1 : 5);
      S.jaw.rotation.x = damp(S.jaw.rotation.x, S.breath ? 0.45 : S.stoke > 0 ? 0.25 : 0.06, 6, dt);
      S.mouthGlow.material.opacity = Math.min(1, 0.22 + S.stoke * 0.6 + (S.breath ? 0.6 : 0)); S.coreGlow.material.opacity = Math.min(1, 0.12 + S.open * 0.8 + S.stoke * 0.5);
      for (const gs of S.eyeGlow) gs.material.opacity = S.stag > 0 ? 0.1 : 0.8;
      if (S.lvl >= 1 && vrand() < dt * S.lvl * 2.5) { _v.set((vrand() - 0.5) * 12, 4 + vrand() * 11, (vrand() - 0.5) * 8); S.torso.localToWorld(_v); FX.burst(_v.x, _v.y, _v.z, { n: 3, color: 0xffb050, color2: 0xa02008, speed: [1, 4], up: 2, grav: 14, life: [0.8, 1.5], size: [0.25, 0.6] }); }
      if (S.breath === 2 && vrand() < dt * 60) { S.head.getWorldPosition(_v); const a = b.facing; FX.burst(_v.x + Math.sin(a) * 3, _v.y - 1, _v.z + Math.cos(a) * 3, { n: 3, color: FIRE, color2: 0xffe0a0, dir: [Math.sin(a), -0.75, Math.cos(a)], spread: 0.18, speed: [16, 26], life: [0.4, 0.8], size: [0.5, 1.4] }); }
      if (S.stag > 0 && vrand() < dt * 30) { S.core.getWorldPosition(_v); FX.burst(_v.x, _v.y, _v.z, { n: 1, color: 0xffd080, speed: [2, 8], life: [0.4, 0.9], size: [0.2, 0.5] }); }
      // arms: rest on the lip, raise, slam, sweep
      for (const A of S.arms) {
        const restA = b.facing + A.sx * -1.05;
        if (A.mode === 'rest') pt(restA, R0 + 0.6, 1.6 + Math.sin(t * 0.8 + A.sx) * 0.3, A.tgt);
        else if (A.mode === 'raise') pt(A.ang, MID - 3, 19, A.tgt);
        else if (A.mode === 'sweep') pt(A.ang, MID, 3.2, A.tgt);
        else { pt(A.ang, MID, 1.8, A.tgt); A.hold -= dt; if (A.hold <= 0) A.mode = 'rest'; }
        A.cur.lerp(A.tgt, 1 - Math.exp(-(A.mode === 'slam' ? 26 : A.mode === 'sweep' ? 30 : 3.2) * dt));
        A.g.lookAt(A.cur); A.g.getWorldPosition(_v); A.g.scale.z = clamp(_v.distanceTo(A.cur) / ARM, 0.5, 1.8);
      }
      S.plume.material.opacity = 0.35 + S.lvl * 0.2 + Math.sin(t * 3) * 0.05; S.plume.scale.x = S.plume.scale.z = 1 + S.lvl * 0.4 + Math.sin(t * 1.3) * 0.05;
      if (S.lvl >= 1 && vrand() < dt * S.lvl * 2) { const a = vrand() * TAU, r = vrand() < 0.5 ? R0 - 1.2 : R1 + 1.5 + vrand() * 2; FX.burst(Math.sin(a) * r, -1, Math.cos(a) * r, { n: 12, color: 0xffc060, color2: 0xa02008, speed: [1, 3], up: 8 + S.lvl * 3, grav: 10, life: [0.8, 1.5], size: [0.25, 0.7] }); }
      if (S.lvl >= 1 && vrand() < dt * (S.lvl * 3)) { const a = vrand() * TAU, r = vrand() * 9; FX.burst(Math.sin(a) * r, -1, Math.cos(a) * r, { n: 10, color: FIRE, color2: 0xffe0a0, speed: [1, 4], up: 9 + S.lvl * 4, grav: 10, life: [0.8, 1.6], size: [0.3, 0.8] }); }
    },
    bot(b, p) {
      const S = b.state, melee = p.cls.id === 'duskblade', r = melee ? 12.9 : 14.5;
      if (S.swp) return { x: Math.sin(S.swp.gap) * r, z: Math.cos(S.swp.gap) * r, w: 4 };
      const q = S.geodes.find((c) => c.alive && c.t > 0.8 && Hz.threat(Math.sin(c.a) * r, Math.cos(c.a) * r) > 2.5);
      if (q && S.stag <= 0 && (!S.pend || S.pend.t > S.pend.lock + 0.1)) return { x: Math.sin(q.a) * r, z: Math.cos(q.a) * r, w: 1.2 };
      return {};
    },
  });
  const _v = new V3();
})();
