// DOOR V: MOLTHAR, the Kiln-Titan. A ring of basalt around a lake of fire, and something very large standing in it.
(() => {
  const R0 = 12, R1 = 21, MID = 16.5, SEG = PI / 4, FIRE = 0xff6a1a, TELE = 0xfff4d6, ZONE = 0xff2a4a, ICE = 0x5ab8ff, ARM = 17.5;
  const segOf = (x, z) => { let a = Math.atan2(x, z); if (a < 0) a += TAU; return Math.floor(a / SEG) % 8; };
  const pt = (a, r, y, out) => (out || new V3()).set(Math.sin(a) * r, y, Math.cos(a) * r);
  const playerAng = () => Math.atan2(G.player.pos.x, G.player.pos.z);

  // ---- local look helpers (titan only) ----
  // World-position varying shared by the injected materials below.
  const VTW = '#include <project_vertex>\n{ vec4 tw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n tw = instanceMatrix * tw;\n#endif\n vTW = (modelMatrix * tw).xyz; }';
  const DN3 = 'float dh3_(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\nfloat dn3_(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(dh3_(i), dh3_(i + vec3(1, 0, 0)), f.x), mix(dh3_(i + vec3(0, 1, 0)), dh3_(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(dh3_(i + vec3(0, 0, 1)), dh3_(i + vec3(1, 0, 1)), f.x), mix(dh3_(i + vec3(0, 1, 1)), dh3_(i + vec3(1, 1, 1)), f.x), f.y), f.z); }\n';
  const RIM = 'vec3 nV_ = normal * inversesqrt(max(dot(normal, normal), 1e-8)); vec3 vV_ = vViewPosition * inversesqrt(max(dot(vViewPosition, vViewPosition), 1e-8)); float fr_ = 1.0 - clamp(dot(nV_, vV_), 0.0, 1.0);';
  // The titan's hide: big plates, thick crust, cracks that pulse and widen, heat rising toward the chest core, a hot fresnel rim.
  function hideMaker(S) {
    const tx = W.bake(512, (u, v) => {
      // few, large plates: domed crust slabs with deep wide seams between them
      const c = W.cell(u * 2, v * 2, 41, 2), n = W.fbm(u * 16, v * 16, 44, 4, 16), n2 = W.fbm(u * 5, v * 5, 45, 3, 5);
      const seam = smooth(sat(c[1] * 2.6)), dome = sat(1 - c[0] * 0.7);
      return [seam * (0.5 + dome * 0.4) + n * 0.1, 0.15 + n * 0.45 + n2 * 0.3 + dome * 0.15, 0.7 + n * 0.3];
    }, { dark: 0x100d0c, light: 0x7e706a, strength: 7 });
    // seams of varying width (thin hairlines that swell into wide rifts), a hot core and a faint red bleed onto the bevels
    const em = W.bake(512, (u, v) => { const c = W.cell(u * 2, v * 2, 41, 2), n = W.fbm(u * 8, v * 8, 47, 3, 8), wv = W.fbm(u * 3, v * 3, 48, 3, 3), w = 2.2 + Math.pow(1 - wv, 2) * 7;
      const core = Math.pow(1 - sat(c[1] * w), 1.8) * (0.7 + n * 0.55), halo = Math.pow(1 - sat(c[1] * w * 0.32), 2.4) * 0.2; return [0, sat(Math.max(core, halo)), 1]; }, { dark: 0x000000, light: 0xffffff });
    for (const t of [tx.map, tx.normalMap, tx.roughnessMap, em.map]) t.repeat.set(2, 2);
    S.HU = { uT: { value: 0 }, uCore: { value: new V3(0, 7, 5) }, uCrack: { value: 0 }, uHeatB: { value: 0 }, uRootH: { value: 1 } };
    return (o = {}) => {
      const m = new THREE.MeshStandardMaterial({ map: tx.map, normalMap: tx.normalMap, roughnessMap: tx.roughnessMap, color: o.color || 0xffffff, roughness: o.rough || 1.0, metalness: o.metal || 0.0,
        emissive: o.emi || 0xff5a14, emissiveMap: o.molten ? null : em.map, emissiveIntensity: o.ei === undefined ? 1.6 : o.ei, flatShading: o.flat !== false, envMapIntensity: 0.2 });
      const rim = o.rim === undefined ? 1 : o.rim;
      m.onBeforeCompile = (s) => {
        Object.assign(s.uniforms, S.HU); s.uniforms.uRim = { value: rim }; s.uniforms.uDis = { value: o.dis === undefined ? 1 : o.dis }; s.uniforms.uRoot = { value: o.root || 0 };
        s.vertexShader = 'varying vec3 vTW; varying float vRY;\n' + s.vertexShader.replace('#include <project_vertex>', VTW + '\nvRY = position.y;');
        s.fragmentShader = 'uniform float uT, uCrack, uHeatB, uRim, uDis, uRoot, uRootH; uniform vec3 uCore; varying vec3 vTW; varying float vRY;\n' + DN3 + s.fragmentShader.replace('#include <emissivemap_fragment>', `
          float hC_ = clamp(1.0 - length(vTW - uCore) / 12.0, 0.0, 1.0); hC_ *= hC_;
          #ifdef USE_EMISSIVEMAP
            float em_ = clamp(texture2D(emissiveMap, vEmissiveMapUv).g, 0.0, 1.0);
            em_ = pow(max(em_, 0.0), 1.0 / (1.0 + uCrack * 0.9 + hC_ * 0.35));
            // seam colour: yellow at the core of the seam, deep red at its edges and in the bleed
            float eI_ = max(max(totalEmissiveRadiance.r, totalEmissiveRadiance.g), totalEmissiveRadiance.b);
            totalEmissiveRadiance = eI_ * em_ * mix(vec3(0.7, 0.06, 0.012), mix(vec3(1.4, 0.72, 0.22), vec3(1.5, 1.0, 0.45), clamp(uHeatB * 1.1, 0.0, 1.0)), pow(max(em_, 0.0), 2.5));
          #endif
          float bt_ = uT * 2.4 - length(vTW - uCore) * 0.12; float pul_ = 0.62 + 0.55 * (pow(max(sin(bt_), 0.0), 8.0) + 0.6 * pow(max(sin(bt_ - 0.8), 0.0), 8.0)); // heartbeat from the core outward
          totalEmissiveRadiance *= pul_ * (0.55 + hC_ * 0.35 + uHeatB * 1.2);
          ${RIM}
          vec3 nW_ = (vec4(nV_, 0.0) * viewMatrix).xyz;
          // lava bounce on the stone itself: lower faces lit orange, fading with height; a dim brick rim on top edges against the sky
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.36, 0.1) * (clamp(-nW_.y * 0.8 + 0.25, 0.0, 1.0) * exp(-max(vTW.y, 0.0) * 0.07) * 3.0 + 0.7);
          totalEmissiveRadiance += vec3(0.5, 0.14, 0.07) * pow(max(fr_, 0.0), 2.5) * clamp(nW_.y * 0.7 + 0.45, 0.0, 1.0) * uRim * 0.6;
          totalEmissiveRadiance += vec3(0.8, 0.3, 0.08) * pow(max(fr_, 0.0), 3.5) * uRim * (hC_ * 0.5 + uHeatB * 0.3);
          // near the lens, and while the engine fades an occluding limb, the hide burns away in large holes with a thin dim ember edge;
          // what is left stays opaque, so a faded limb leaves no glowing ghost outline or stretched crack lines
          float cd_ = length(vTW - cameraPosition), kp_ = min(mix(1.0, smoothstep(5.0, 15.0, cd_), uDis), smoothstep(0.1, 0.92, opacity));
          if (kp_ < 1.0) { float dn_ = clamp(dn3_(vTW * 0.34) * 0.75 + dn3_(vTW * 1.1) * 0.25, 0.0, 1.0) * 0.96 + 0.02;
            if (dn_ > kp_ || kp_ < 0.05) discard; totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(0.5, 0.07, 0.012), smoothstep(kp_ - 0.016, kp_, dn_) * 0.9); totalEmissiveRadiance *= 0.35 + 0.65 * kp_; } // and dims, so a joint next to the lens never blows out
          diffuseColor.a = 1.0;
          totalEmissiveRadiance += vec3(1.0, 0.3, 0.06) * exp(-max(vRY, 0.0) * 1.6) * uRoot * uRootH; // hot seams at the roots of spines and crown
          totalEmissiveRadiance *= min(1.0, 4.5 / max(max(max(totalEmissiveRadiance.r, totalEmissiveRadiance.g), totalEmissiveRadiance.b), 1e-4)); // cap keeping the hue: a per-channel clip turns orange into flat mustard`);
      };
      m.customProgramCacheKey = () => 'titanHide'; m.userData.hideOpts = o;
      return m;
    };
  }
  // Basalt that glows from below where it meets the lava (walls, boulders, columns).
  function hotRock(rk, o = {}) {
    const m = new THREE.MeshStandardMaterial({ map: o.noMap ? null : rk.map, normalMap: o.noMap ? null : rk.normalMap, roughnessMap: o.noMap ? null : rk.roughnessMap, color: o.color || 0xffffff, roughness: o.noMap ? 0.8 : 0.9, metalness: 0.05, flatShading: true, side: o.side || THREE.FrontSide, envMapIntensity: 0.4 });
    const U = { uStreak: { value: o.streak || 0 }, uLY: { value: o.y === undefined ? -1.2 : o.y }, uFall: { value: o.fall || 0.9 }, uGlow: { value: o.glow === undefined ? 2.2 : o.glow }, uRimR: { value: o.rim === undefined ? 0.35 : o.rim } };
    m.userData.U = U;
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, U);
      s.vertexShader = 'varying vec3 vTW;\n' + s.vertexShader.replace('#include <project_vertex>', VTW);
      s.fragmentShader = 'uniform float uLY, uFall, uGlow, uRimR, uStreak; varying vec3 vTW;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float hb_ = exp(-max(vTW.y - uLY, 0.0) * uFall);
        if (uStreak > 0.0) { float an_ = atan(vTW.x, vTW.z + 1e-4) * 40.0; float st_ = pow(max(sin(an_ + sin(an_ * 0.37) * 2.0), 0.0), 18.0) * smoothstep(-1.4, 0.0, vTW.y); hb_ += st_ * uStreak * 1.5; }
        ${RIM}
        totalEmissiveRadiance += vec3(1.0, 0.32, 0.06) * hb_ * uGlow + mix(vec3(0.32, 0.08, 0.035), vec3(1.0, 0.32, 0.06), hb_) * pow(max(fr_, 0.0), 4.0) * uRimR;`);
    };
    m.customProgramCacheKey = () => 'titanHot';
    return m;
  }
  // Lava with drifting cooled-crust plates, bright seams, molten pools and a hot band hugging the platform edges. Output capped.
  function lava(o = {}) {
    const geo = o.geo || (() => { const g = new THREE.PlaneGeometry(o.size || 400, o.size || 400, o.seg || 1, o.seg || 1); g.rotateX(-PI / 2); return g; })();
    const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uHot: { value: new THREE.Color(0xffb040) }, uMid: { value: new THREE.Color(0xff4a08) }, uCool: { value: new THREE.Color(0x140605) },
      uScale: { value: o.scale || 0.09 }, uSpeed: { value: o.speed || 0.05 }, uHeat: { value: o.heat === undefined ? 0.6 : o.heat }, uSwell: { value: o.swell || 0 }, uEdge: { value: o.edge === undefined ? 1 : o.edge }, uBreak: { value: 0 } }]);
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: U, fog: true,
      vertexShader: `uniform float uTime, uSwell; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vec4 wp = modelMatrix * vec4(position, 1.0);
          wp.y += uSwell * (sin(wp.x * 0.21 + uTime * 0.7) * 0.6 + sin(wp.z * 0.17 - uTime * 0.55) * 0.4 + sin((wp.x + wp.z) * 0.37 + uTime * 1.1) * 0.25);
          vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime, uScale, uSpeed, uHeat, uEdge, uBreak; uniform vec3 uHot, uMid, uCool; varying vec3 vW;
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
          float flow = fbm(vec2(fq.x * 2.0, fq.y * 0.8));                  // slow streaky flow field
          float isl = fbm(q * 1.6 + w * 1.1 - vec2(t * 0.9, t * 0.3));      // cooled crust that breaks up
          float edge = (exp(-abs(r - 21.0) * 0.6) + exp(-abs(r - 12.0) * 0.8)) * uEdge;
          float crust = smoothstep(0.27 + uBreak, 0.38 + uBreak, isl) * (1.0 - clamp(edge * 0.9, 0.0, 1.0));
          float seam = exp(-abs(isl - 0.28 - uBreak) * 55.0) * (1.0 - clamp(edge, 0.0, 1.0));  // thin hot line where crust meets melt
          float cracks = 1.0 - smoothstep(0.0, 0.06, abs(fbm(q * 5.0 + w * 2.0) - 0.5));  // hairline cracks across the crust
          vec3 melt = mix(uMid * 0.55, uMid * 1.05, clamp(flow * 1.4, 0.0, 1.0));      // open lava stays red-orange
          vec3 hotC = uHot * 1.35 * (0.6 + uHeat * 0.6);
          vec3 crustC = uCool * (0.35 + fbm(q * 7.0) * 0.8);
          vec3 col = mix(melt * (0.6 + uHeat * 0.6), crustC, crust);
          col += hotC * clamp(seam + edge * 0.45 + cracks * crust * 0.12, 0.0, 1.0);
          // occasional bubbles in open melt
          vec2 bc = floor(q * 6.0); float bt = fract(uTime * 0.25 + h21(bc) * 7.0); vec2 bf = fract(q * 6.0) - 0.5;
          col += hotC * (1.0 - crust) * step(0.82, h21(bc + 3.1)) * (1.0 - smoothstep(0.0, 0.22, length(bf))) * smoothstep(0.0, 0.2, bt) * (1.0 - smoothstep(0.3, 0.6, bt)) * 0.8;
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
    S.hemi = W.hemi(g, 0x3a3e66, 0x7a3410, 1.25); // cool blue-violet from above, lava from below
    S.sun = W.sun(g, { dir: [0.5, 0.9, 0.5], color: 0xffb890, intensity: 1.4, size: 30 });
    // lava bounce: an unshadowed fill from below so undersides never go pure black
    S.bounce = new THREE.DirectionalLight(0xff6a24, 1.5); S.bounce.position.set(0, -80, 12); g.add(S.bounce); g.add(S.bounce.target);
    S.lavaL = new THREE.PointLight(0xff5a10, 60, 90, 1.5); S.lavaL.position.set(0, -0.6, 0); g.add(S.lavaL); // low: it used to sit inside the chest and blow it out
    // cool back light, re-aimed every frame from behind the titan toward the camera, to cut its silhouette out of the orange
    S.rimL = new THREE.DirectionalLight(0xff8a4a, 1.6); // warm back light from the far lava S.rimL.position.set(0, 40, -80); g.add(S.rimL); g.add(S.rimL.target);
    S.lake = lava({ size: 400, seg: 100, scale: 0.09, speed: 0.05, y: -1.2, heat: 0.6, swell: 0.1 }); g.add(S.lake);
    // ring floor: cooler, darker basalt with thin cracks
    const fl = W.bake(512, (u, v) => { const n = W.fbm(u * 14, v * 14, 3, 5, 14), c = W.cell(u * 12, v * 12, 5, 12), crack = smooth(sat(c[1] * 16)); return [n * 0.45 + crack * 0.55, 0.2 + n * 0.55 + (1 - c[0]) * 0.15, 0.95 - n * 0.3]; }, { dark: 0x0a0909, light: 0x3c3836, strength: 3.5 });
    const em = W.bake(512, (u, v) => { const c = W.cell(u * 12, v * 12, 5, 12), n = W.fbm(u * 4, v * 4, 9, 3, 4); const e = Math.pow(1 - sat(c[1] * 18), 3) * sat(n * 1.8 - 0.4); return [0, e, 1]; }, { dark: 0x000000, light: 0xffffff });
    for (const t of [fl.map, fl.normalMap, fl.roughnessMap, em.map]) t.repeat.set(5, 5);
    const ringG = new THREE.RingGeometry(R0, R1, 128, 4); ringG.rotateX(-PI / 2); const ruv = ringG.attributes.uv, rp = ringG.attributes.position; for (let i = 0; i < ruv.count; i++) ruv.setXY(i, rp.getX(i) / 42 + 0.5, rp.getZ(i) / 42 + 0.5);
    S.floorMat = new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, roughnessMap: fl.roughnessMap, roughness: 0.85, metalness: 0.15, emissive: 0xff4a10, emissiveMap: em.map, emissiveIntensity: 1.5 });
    S.FU = { uEW: { value: 2.6 }, uFl: { value: 0.1 }, uT: { value: 0 } };
    S.floorMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, S.FU); sh.vertexShader = 'varying vec3 vTW;\n' + sh.vertexShader.replace('#include <project_vertex>', VTW);
      sh.fragmentShader = 'uniform float uEW, uFl, uT; varying vec3 vTW;\nfloat fh_(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }\nfloat fn_(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh_(i), fh_(i + vec2(1, 0)), f.x), mix(fh_(i + vec2(0, 1)), fh_(i + vec2(1, 1)), f.x), f.y); }\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rr_ = length(vTW.xz), ed_ = max((1.0 - smoothstep(${R0}.0, ${R0}.0 + uEW, rr_)), smoothstep(${R1}.0 - uEW, ${R1}.0, rr_));
        totalEmissiveRadiance *= uFl + ed_ * 1.3;
        // a few long winding fissures across the floor, and darker cooled patches
        float fz_ = fn_(vTW.xz * 0.11) * 0.65 + fn_(vTW.xz * 0.27 + 7.0) * 0.35;
        float fd_ = abs(fz_ - 0.5), fw_ = (0.014 + uEW * 0.0018) * (0.6 + 0.8 * fn_(vTW.xz * 0.19 + 11.0));
        float fc_ = 1.0 - smoothstep(0.0, fw_ * 0.4, fd_), fb_ = 1.0 - smoothstep(fw_ * 0.3, fw_ * 1.3, fd_), lip_ = (1.0 - smoothstep(fw_ * 1.2, fw_ * 2.4, fd_)) * (1.0 - fb_);
        float fl_ = 0.7 + 0.5 * fn_(vec2(fz_ * 40.0 - uT * 0.6, vTW.x * 0.3 + vTW.z * 0.3));
        totalEmissiveRadiance += (vec3(1.1, 0.5, 0.12) * fc_ * fl_ + vec3(0.55, 0.07, 0.015) * fb_) * (0.75 + uEW * 0.08);
        diffuseColor.rgb *= (0.75 + 0.5 * fn_(vTW.xz * 0.07 + 3.0)) * (1.0 - lip_ * 0.7);`); };
    S.floorMat.customProgramCacheKey = () => 'titanFloor';
    const floor = new THREE.Mesh(ringG, S.floorMat); floor.receiveShadow = true; g.add(floor);
    const rk = W.surface('rock', { size: 256, dark: 0x0a0808, light: 0x4a4040, strength: 5 }); for (const k in rk) rk[k].repeat.set(2, 2);
    const rkW = W.surface('rock', { size: 256, seed: 7, dark: 0x080606, light: 0x3a3230, strength: 6 }); for (const k in rkW) rkW[k].repeat.set(14, 3);
    S.hot = hotRock(rk, { fall: 1.2, glow: 1.2, streak: 1 }); S.hotIn = hotRock(rk, { side: THREE.BackSide, fall: 0.5, glow: 1.6 });
    const under = new THREE.Mesh(new THREE.CylinderGeometry(R1, R1 + 3, 6, 64, 1, true), S.hot); under.position.y = -3; g.add(under);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0 - 1.5, 5, 64, 1, true), S.hotIn); inner.position.y = -2.5; g.add(inner);
    S.makeHide = hideMaker(S);
    S.lipMat = S.makeHide({ molten: true, ei: 1.6, rim: 0.3, color: 0x3a2018, flat: false, dis: 0 }); for (const [lr, lw] of [[R0 + 0.05, 0.24], [R1 + 0.05, 0.18]]) { const lip = new THREE.Mesh(new THREE.TorusGeometry(lr, lw, 6, 128), S.lipMat); lip.rotation.x = PI / 2; lip.position.y = 0.02; g.add(lip); }
    S.groove = new THREE.MeshStandardMaterial({ color: 0x050303, emissive: FIRE, emissiveIntensity: 0.55 });
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, R1 - R0), S.groove); const a = i * SEG; m.position.set(Math.sin(a) * MID, 0.016, Math.cos(a) * MID); m.rotation.y = a; g.add(m); }
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SC = new V3(), P = new V3(), h2 = W.hash2;
    // basalt: bevelled hex columns (a lathe with 6 sides and a chamfered top), no texture so nothing stretches
    const hexG = new THREE.LatheGeometry([[0.01, 0], [1, 0], [1, 0.94], [0.8, 1], [0.01, 1]].map(([x, y]) => new THREE.Vector2(x, y)), 6);
    const basalt = (o) => hotRock(rk, Object.assign({ noMap: true, color: 0x2c2826 }, o));
    // broken basalt lip on the outer edge: chipped short columns just outside the walkable ring, glowing seams between
    { const n = 150, im = new THREE.InstancedMesh(hexG, S.lipCol = basalt({ fall: 3.5, glow: 1.2, rim: 0.6, color: 0x34302c }), n);
      for (let i = 0; i < n; i++) { const a = i / n * TAU + (h2(i, 1, 71) - 0.5) * 0.02, rr = R1 + 0.55 + h2(i, 2, 71) * 0.5, w = 0.42 + h2(i, 3, 71) * 0.2, chip = h2(i, 4, 71);
        P.set(Math.sin(a) * rr, -1.6, Math.cos(a) * rr); E.set((h2(i, 5, 71) - 0.5) * 0.25, h2(i, 6, 71) * 1.05, (h2(i, 7, 71) - 0.5) * 0.25); Q.setFromEuler(E); SC.set(w, 1.65 + (chip < 0.25 ? -0.3 : chip * 0.6), w); M.compose(P, Q, SC); im.setMatrixAt(i, M); }
      g.add(im); }
    // column clusters packed on a hex grid, stepped heights (organ pipes); `count` grows with each cluster
    const clusters = (list, mat, cap) => {
      const im = new THREE.InstancedMesh(hexG, mat, cap); let k = 0;
      for (const [ca, cr, rad, hMin, hMax, w, seed] of list) {
        const cx = Math.sin(ca) * cr, cz = Math.cos(ca) * cr, step = w * 1.75, lx = (h2(seed, 1, 97) - 0.5) * 0.22, lz = (h2(seed, 2, 97) - 0.5) * 0.22;
        for (let gx = -6; gx <= 6; gx++) for (let gz = -6; gz <= 6; gz++) {
          const x = (gx + (gz & 1) * 0.5) * step, z = gz * step * 0.866, d = Math.hypot(x, z); if (d > rad || k >= cap) continue;
          const n = W.fbm(x * 0.15 + seed, z * 0.15, seed, 3), h = lerp(hMin, hMax, sat(n * 1.2 - 0.1) * (1 - (d / rad) * 0.6)) * (0.85 + h2(gx + 20, gz + 20, seed) * 0.3);
          P.set(cx + x, -2.2, cz + z); E.set(lx + (h2(gx, gz, seed + 1) - 0.5) * 0.16, h2(gx, gz, seed + 2) * 1.05, lz + (h2(gx, gz, seed + 3) - 0.5) * 0.16); Q.setFromEuler(E); SC.set(w * 0.98, h + 1, w * 0.98); M.compose(P, Q, SC); im.setMatrixAt(k++, M);
        }
      }
      im.count = k; g.add(im); return im;
    };
    // low stubs breaking the lava just past the ring, a few drifting crust rafts
    const stubs = []; for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + h2(i, 1, 31) * 0.4; stubs.push([a, R1 + 2.6 + h2(i, 2, 31) * 2, 1.6 + h2(i, 3, 31) * 1.6, 0.6, 2.6 + h2(i, 4, 31) * 1.5, 0.75, i + 3]); }
    clusters(stubs, S.stubMat = basalt({ fall: 2.2, glow: 0.9, rim: 0.5 }), 220);
    const rafts = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 1), basalt({ y: -1.5, fall: 7, glow: 2.4, rim: 0.5, color: 0x221e1c }), 7);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.4, r = 28 + h2(i, 5, 3) * 10, sx = 2 + h2(i, 1, 3) * 2.5; P.set(Math.sin(a) * r, -1.25, Math.cos(a) * r); E.set(0, h2(i, 8, 3) * 6, 0); Q.setFromEuler(E); SC.set(sx, 0.35, sx * 0.7); M.compose(P, Q, SC); rafts.setMatrixAt(i, M); }
    g.add(rafts);
    // cliffs: a broken near layer of clusters and a continuous far layer, both fading into the smoke
    const near = [], far = [];
    for (let i = 0; i < 9; i++) near.push([i / 9 * TAU + 0.35 + h2(i, 1, 41) * 0.3, 51 + h2(i, 2, 41) * 5, 5 + h2(i, 3, 41) * 3, 3, 12 + h2(i, 4, 41) * 14, 1.25, 50 + i]);
    for (let i = 0; i < 22; i++) far.push([i / 22 * TAU + h2(i, 1, 43) * 0.15, 66 + h2(i, 2, 43) * 5, 9, 14, 30 + h2(i, 4, 43) * 18, 1.9, 80 + i]);
    clusters(near, basalt({ fall: 0.45, glow: 0.6, rim: 0.7 }), 700);
    clusters(far, basalt({ fall: 0.2, glow: 0.45, rim: 0.4, color: 0x26221f }), 1400);
    const deep = []; for (let i = 0; i < 12; i++) deep.push([i / 12 * TAU + 0.13 + h2(i, 1, 47) * 0.2, 84 + h2(i, 2, 47) * 8, 8, 30, 58 + h2(i, 4, 47) * 20, 2.4, 120 + i]);
    clusters(deep, basalt({ fall: 0.08, glow: 0.35, rim: 0.3, color: 0x1e1a18 }), 500);
    // lava falls pouring from the outer cliffs into the lake
    const fallU = { uTime: { value: 0 } }, fallMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, fallU]), fog: true, side: THREE.DoubleSide, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        #include <fog_pars_fragment>
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          // streaks pour downward; ragged soft sides; the sheet thins out where it leaves the cliff lip
          float s = n2(vec2(vUv.x * 9.0, vUv.y * 2.0 + uTime * 1.6)) * 0.6 + n2(vec2(vUv.x * 23.0, vUv.y * 5.0 + uTime * 2.7)) * 0.4;
          float st = n2(vec2(vUv.x * 38.0, vUv.y * 1.2 + uTime * 2.2)), wob = (n2(vec2(vUv.y * 3.0 + uTime * 0.8, 3.1)) - 0.5) * 0.18;
          float rg = (n2(vec2(vUv.y * 7.0 - uTime * 0.9, 1.7)) - 0.5) * 0.22 + (n2(vec2(vUv.y * 19.0 + uTime * 1.3, 5.3)) - 0.5) * 0.1; // ragged, changing width
          float x = vUv.x + wob, side = smoothstep(0.06 - rg, 0.36 + s * 0.12 - rg, x) * (1.0 - smoothstep(0.64 - s * 0.12 + rg, 0.94 + rg, x));
          float sp = smoothstep(0.12, 0.0, vUv.y); side = max(side, sp * smoothstep(0.0, 0.3, x) * smoothstep(1.0, 0.7, x)); // the foot splashes wider
          float dk = smoothstep(0.35, 0.65, st), a = side * smoothstep(1.0, 0.88, vUv.y) * (0.55 + 0.45 * dk);
          if (a < 0.01) discard;
          float core = exp(-abs(x - 0.5 + (s - 0.5) * 0.15) * 22.0);
          vec3 col = mix(vec3(0.6, 0.07, 0.01), vec3(1.35, 0.4, 0.05), clamp(side * (0.35 + s * 0.7) * (0.45 + dk * 0.8), 0.0, 1.0));
          col += vec3(1.2, 0.75, 0.25) * core * (0.25 + 0.4 * dk) + vec3(1.4, 0.7, 0.2) * sp * side * (0.6 + 0.4 * s);
          gl_FragColor = vec4(clamp(col, 0.0, 2.5), clamp(a, 0.0, 1.0));
          #include <fog_fragment>
        }`,
    });
    S.falls = [];
    for (const [fa, fw, fh] of [[0.6, 4, 30], [3.5, 5, 28], [2.3, 3, 36], [5.6, 4, 26], [4.6, 3, 34], [1.5, 3, 32], [6.2, 4, 30]]) {
      const geo = new THREE.PlaneGeometry(fw, fh, 1, 1), m = new THREE.Mesh(geo, fallMat), fr = 61;
      m.position.set(Math.sin(fa) * fr, -1.2 + fh / 2, Math.cos(fa) * fr); m.rotation.y = fa + PI; m.onBeforeRender = () => { fallMat.uniforms.uTime.value = G.now; }; g.add(m);
      const sp = glowSprite(0xff7a20, fw * 4, 0.85); sp.position.set(Math.sin(fa) * (fr - 2), 0, Math.cos(fa) * (fr - 2)); g.add(sp);
      S.falls.push({ m, sp, x: Math.sin(fa) * (fr - 2.5), z: Math.cos(fa) * (fr - 2.5), w: fw }); m.visible = sp.visible = S.falls.length <= 3;
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
    // a smoke ceiling: drifting plumes, dark grey, lit orange from below over the lake
    S.smokeU = { uTime: { value: 0 }, uGlow: { value: 0.6 } };
    { const sg = new THREE.PlaneGeometry(1000, 1000, 1, 1); sg.rotateX(PI / 2);
      S.smoke = new THREE.Mesh(sg, new THREE.ShaderMaterial({ uniforms: S.smokeU, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
        vertexShader: 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
        fragmentShader: `uniform float uTime, uGlow; varying vec3 vW;
          float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
          float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n2(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
          void main(){
            vec2 q = vW.xz * 0.012; float t = uTime * 0.015;
            vec2 w = vec2(fbm(q + vec2(t, 0.0)), fbm(q + vec2(3.1, 7.7) - t));
            float d = fbm(q * 1.4 + w * 1.8 + vec2(t * 2.0, t));
            float dens = smoothstep(0.32, 0.72, d);
            float r = length(vW.xz), under = exp(-r / 110.0);
            vec3 col = mix(vec3(0.03, 0.022, 0.02), vec3(0.6, 0.17, 0.04) * uGlow, clamp(under * (1.2 - d) * 1.5, 0.0, 1.0));
            float a = dens * 0.9 * (1.0 - smoothstep(320.0, 480.0, r));
            gl_FragColor = vec4(clamp(col, 0.0, 2.0), clamp(a, 0.0, 1.0));
          }` }));
      S.smoke.position.y = 40; S.smoke.renderOrder = -50; S.smoke.frustumCulled = false; S.smoke.onBeforeRender = () => { S.smokeU.uTime.value = G.now; }; g.add(S.smoke); }
    S.plume = new THREE.Mesh(new THREE.ConeGeometry(34, 150, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a10).multiplyScalar(1.2), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); S.plume.position.set(-90, 215, -330); S.plume.rotation.x = PI; g.add(S.plume);
    // smoke cards drifting between the ring and the cliffs, and a heat glow kept behind the titan from the camera's view
    { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), im = x.createImageData(128, 128);
      for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) { const u = i / 128 - 0.5, v = j / 128 - 0.5, d = Math.hypot(u, v) * 2, n = W.fbm(i / 128 * 4, j / 128 * 4, 77, 5, 4), a = sat((1 - d) * 1.6) * sat(n * 1.8 - 0.35), k = (j * 128 + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = 255 * a; }
      x.putImageData(im, 0, 0); S.smokeTex = new THREE.CanvasTexture(c);
      S.cards = [];
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + h2(i, 1, 13) * 0.4, rr = 32 + h2(i, 2, 13) * 24, sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: S.smokeTex, color: new THREE.Color(0x4a2a20), transparent: true, opacity: 0.55, depthWrite: false, fog: true }));
        sp.position.set(Math.sin(a) * rr, 10 + h2(i, 3, 13) * 22, Math.cos(a) * rr); sp.scale.setScalar(26 + h2(i, 4, 13) * 26); sp.material.rotation = h2(i, 5, 13) * TAU; g.add(sp); S.cards.push(sp); } }
    // high smoke banks under the ceiling, lit from below by the lake: dark tops, ember-brown bellies
    { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), im = x.createImageData(128, 128);
      for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) { const u = i / 128 - 0.5, v = j / 128 - 0.5, d = Math.hypot(u, v * 1.6) * 2, n = W.fbm(i / 128 * 5, j / 128 * 5, 79, 5, 5), a = sat((1 - d) * 1.4) * sat(n * 1.9 - 0.4), lit = Math.pow(j / 128, 2.2), k = (j * 128 + i) * 4;
        im.data[k] = 255 * (0.16 + lit * 0.84); im.data[k + 1] = 255 * (0.12 + lit * 0.34); im.data[k + 2] = 255 * (0.1 + lit * 0.12); im.data[k + 3] = 255 * a; }
      x.putImageData(im, 0, 0); S.bankTex = new THREE.CanvasTexture(c); S.banks = [];
      for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + h2(i, 1, 17) * 0.4, rr = 66 + h2(i, 2, 17) * 22, sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: S.bankTex, color: new THREE.Color(0x8a4a30), transparent: true, opacity: 0.6, depthWrite: false, fog: true }));
        sp.position.set(Math.sin(a) * rr, 44 + h2(i, 3, 17) * 26, Math.cos(a) * rr); sp.scale.set(70 + h2(i, 4, 17) * 40, 30 + h2(i, 5, 17) * 16, 1); g.add(sp); S.banks.push(sp); } }
    S.farEmbers = W.motes({ n: 500, box: [170, 60, 170], color: 0xff7a28, size: 0.26, vel: [0.5, 2.2, 0.3], sway: 1.5, center: [0, 34, 0], mult: 1.2 }); g.add(S.farEmbers);
    S.heatGlow = glowSprite(0xff4a10, 60, 0.28); g.add(S.heatGlow);
    S.embers = W.motes({ n: 1300, box: [80, 34, 80], color: 0xff8030, size: 0.11, vel: [0.4, 1.7, 0.2], sway: 1.1, center: [0, 15, 0], mult: 1.4 }); g.add(S.embers);
    S.ash = W.motes({ n: 700, box: [80, 30, 80], color: 0x9a8e8c, size: 0.075, vel: [0.6, -1.2, 0.3], sway: 0.8, center: [0, 14, 0], additive: false, alpha: 0.3 }); g.add(S.ash);
    // rising-lava overlays per segment
    S.seg = [];
    for (let i = 0; i < 8; i++) { const sg = new THREE.RingGeometry(R0 + 0.1, R1 - 0.05, 20, 1, i * SEG - PI / 2 + 0.008, SEG - 0.016); sg.rotateX(-PI / 2); const m = lava({ geo: sg, scale: 0.16, speed: 0.12, y: -0.5, heat: 0.75, edge: 0 }); m.visible = false; g.add(m); S.seg.push({ m, lvl: 0, on: false, gone: false }); }

    // ---- the titan ----
    // One giant shape: a hunched trapezoid torso under a broad shoulder yoke, a heavy brow and jaw set low and forward,
    // tapering limbs ending in fists bigger than the head. Every part is a bevelled, noise-pushed solid (no straight edges),
    // box-projected UVs at a per-part scale (big plates on the torso, small cells at the joints), molten only at joints and core.
    const bg = b.group; S.body = new THREE.Group(); bg.add(S.body);
    const H = S.makeHide, crust = H({ ei: 0.16, color: 0xc4b6ac, rim: 1.1 }), skin = H({ ei: 1.5 }), cap = H({ ei: 0.03, color: 0xa89a92, rim: 0.9 }), hotSkin = H({ ei: 2.6, rim: 0.4 }), fistM = H({ ei: 0.8, color: 0xc4b6ac, rim: 1.0 }),
      molten = H({ molten: true, ei: 1.7, color: 0x3a2018, rim: 0.3, flat: false }), horn = H({ ei: 0.3, color: 0xa89c94, rough: 0.7, metal: 0.1, rim: 2.4, root: 0.9 });
    const n3 = (x, y, z, sd) => (W.fbm(x + z * 0.37 + 11, y - z * 0.21 + 7, sd, 3) + W.fbm(y + 5.3, z + x * 0.29 + 3, sd + 7, 3)) * 0.5;
    let seedK = 1;
    // shape(geo, size, opts): bevel (rounded box, geometry in [-.5,.5]), taper (top width factor), noise amp/freq, uv cell density
    const shape = (geo, sx, sy, sz, o = {}) => {
      const p = geo.attributes.position, sd = seedK++, amp = o.amp === undefined ? 0.3 : o.amp, fq = o.fq || 0.35, bv = o.bevel || 0;
      geo.computeBoundingBox(); const y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y, v = new V3(), q = new V3(), d = new V3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        if (bv > 0) { const e = 0.5 - bv; q.set(clamp(v.x, -e, e), clamp(v.y, -e, e), clamp(v.z, -e, e)); d.subVectors(v, q); const l = d.length(); if (l > 1e-6) v.copy(q).addScaledVector(d, bv / l); }
        const ky = (v.y - y0) / Math.max(y1 - y0, 1e-4), tp = o.taper === undefined ? 1 : lerp(1, o.taper, ky); v.x *= tp; v.z *= tp;
        v.set(v.x * sx, v.y * sy, v.z * sz);
        const l = v.length(); if (l > 1e-4 && amp > 0) v.multiplyScalar(1 + amp * (n3(v.x * fq, v.y * fq, v.z * fq, sd) - 0.5) * 2 / Math.max(l, 1));
        p.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      const n = geo.attributes.normal, uv = geo.attributes.uv, c = o.cell || 0.08;
      if (uv) for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i) * c, y = p.getY(i) * c, z = p.getZ(i) * c; if (ay >= ax && ay >= az) uv.setXY(i, x + 0.37, z); else if (ax >= az) uv.setXY(i, z + 0.71, y); else uv.setXY(i, x, y + 0.13); }
      return geo;
    };
    const slab = (w, h, d, o = {}) => shape(new THREE.BoxGeometry(1, 1, 1, 5, 5, 5), w, h, d, Object.assign({ bevel: 0.22, amp: 0.25, fq: 0.4 }, o));
    const ball = (sx, sy, sz, o = {}) => shape(new THREE.SphereGeometry(1, 14, 10), sx, sy, sz, Object.assign({ amp: 0.35, fq: 0.4 }, o));
    const tube = (r0, r1, len, o = {}) => { const gq = new THREE.CylinderGeometry(r1, r0, len, 14, 6); shape(gq, 1, 1, 1, Object.assign({ amp: 0.2, fq: 0.45, cell: 0.12 }, o)); gq.rotateX(PI / 2); return gq; };
    const add = (parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; };
    const hornG = (h, r) => { const geo = new THREE.ConeGeometry(r, h, 7, 5); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const k = p.getY(i) / h + 0.5; p.setZ(i, p.getZ(i) + k * k * h * 0.35); } geo.translate(0, h / 2, 0); geo.computeVertexNormals(); return geo; };
    S.torso = new THREE.Group(); S.body.add(S.torso);
    // hunched trapezoid torso: narrow waist, deep chest, wide at the shoulders
    const prof = [[0.01, 0], [4.6, 0], [4.1, 3.5], [3.8, 6.5], [5.2, 9], [6.8, 11.5], [7.2, 13.6], [6.0, 15.6], [3.2, 17], [0.01, 17.4]].map(([x, y]) => new THREE.Vector2(x, y));
    add(S.torso, shape(new THREE.LatheGeometry(prof, 20), 1, 1, 0.72, { amp: 0.35, fq: 0.22, cell: 0.07 }), skin, 0, 0, 0);
    // shoulder yoke, pauldrons, horns
    { const yk = shape(new THREE.CapsuleGeometry(2.8, 12, 6, 16), 1, 1, 0.9, { amp: 0.3, fq: 0.3, cell: 0.07 }); yk.rotateZ(PI / 2); add(S.torso, yk, crust, 0, 15.4, -0.8); }
    for (const sx of [-1, 1]) {
      // angular shoulder plates with sharp edges, stacked like a rock shelf
      add(S.torso, shape(new THREE.DodecahedronGeometry(1, 0), 5.6, 3.0, 5.2, { amp: 0.08, cell: 0.07 }), cap, sx * 9.4, 16.4, -0.3, 0.15, sx * 0.35, sx * -0.3);
      add(S.torso, slab(6.6, 1.4, 6.2, { bevel: 0.04, taper: 0.75, amp: 0.12, cell: 0.08 }), crust, sx * 10.2, 14.4, 0.5, 0.1, sx * 0.2, sx * -0.42);
      add(S.torso, slab(5.4, 1.2, 5.4, { bevel: 0.04, taper: 0.7, amp: 0.12, cell: 0.08 }), crust, sx * 10.9, 12.9, 0.9, 0.05, sx * -0.15, sx * -0.6);
      add(S.torso, ball(2.8, 2.6, 2.8, { amp: 0.4, fq: 0.6, cell: 0.2 }), hotSkin, sx * 8.0, 14.4, 0.4);
      // broken basalt columns standing out of the shoulders
      for (let k = 0; k < 4; k++) add(S.torso, shape(hexG.clone(), 0.75 + h2(k, sx + 5, 3) * 0.4, 3 + h2(k, sx + 6, 3) * 3.5, 0.75 + h2(k, sx + 5, 3) * 0.4, { amp: 0.06, cell: 0.2 }), horn, sx * (8.4 + k * 1.2), 17.2 - k * 0.3, -1.6 + (k % 2) * 1.4, -0.25 + h2(k, sx, 4) * 0.2, 0, -sx * (0.25 + k * 0.12));
      S['vent' + sx] = new V3(sx * 10.5, 18.4, -1.6);   // flame jets in later phases
    }
    // a crown of thick broken basalt columns along the back of the yoke
    for (let i = 0; i < 7; i++) { const a = (i - 3) / 3; add(S.torso, shape(hexG.clone(), 1.0 + h2(i, 1, 5) * 0.5, 3 + (1 - Math.abs(a)) * 4 + h2(i, 2, 5) * 2, 1.0 + h2(i, 1, 5) * 0.5, { amp: 0.06, cell: 0.2 }), horn, a * 5.0, 16.6 + (1 - Math.abs(a)) * 0.6, -3.0 - h2(i, 3, 5) * 0.8, -0.45 + h2(i, 4, 5) * 0.3, 0, -a * 0.35 + (h2(i, 5, 5) - 0.5) * 0.3); }
    // waist: stacked rock chunks with lava showing between them
    for (let ring = 0; ring < 3; ring++) for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + ring * 0.45, rr = 4.0 + ring * 0.2, y = 3.6 + ring * 2.1; add(S.torso, slab(2.8, 1.7, 1.6, { bevel: 0.12, amp: 0.25, cell: 0.12 }), crust, Math.sin(a) * rr, y, Math.cos(a) * rr * 0.75, (h2(k, ring, 9) - 0.5) * 0.3, a, (h2(k, ring + 3, 9) - 0.5) * 0.3); }
    // armour: tapered pectorals flanking the core, stacked abdominals, a humped back plate, flank plates
    S.pecs = []; for (const sx of [-1, 1]) S.pecs.push(add(S.torso, slab(4.9, 4.7, 2.0, { taper: 0.82, bevel: 0.1, amp: 0.3, cell: 0.08 }), crust, sx * 3.8, 12.3, 4.0, -0.18, sx * 0.45, sx * 0.1));
    for (let k = 0; k < 3; k++) add(S.torso, slab(4.7 - k * 0.2 + (k === 2 ? 1 : 0), 1.6, 1.4, { taper: 1.08, cell: 0.12 }), crust, 0, 5.4 + k * 1.95, 2.5 + k * 0.4, -0.12);
    add(S.torso, slab(9.8, 7.2, 2.6, { taper: 1.15, bevel: 0.35, amp: 0.4, fq: 0.25, cell: 0.07 }), crust, 0, 11.6, -3.7, 0.25);
    for (const sx of [-1, 1]) add(S.torso, slab(1.6, 4.6, 4.4, { taper: 1.2, cell: 0.1 }), crust, sx * 4.3, 7.4, 0, 0, 0, sx * 0.12);
    // molten core in the chest, behind four plates that peel open when it is staggered
    // the core: white-yellow where it faces you, an orange limb, slow convection cells drifting across it
    S.coreU = { uT: { value: 0 }, uHeat: { value: 1 } };
    S.coreMat = new THREE.ShaderMaterial({ uniforms: S.coreU,
      vertexShader: 'varying vec3 vN, vV, vP; void main(){ vP = position; vN = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float uT, uHeat; varying vec3 vN, vV, vP;
        float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
        void main(){
          vec3 n = vN * inversesqrt(max(dot(vN, vN), 1e-8)), v = vV * inversesqrt(max(dot(vV, vV), 1e-8)); float fc = clamp(dot(n, v), 0.0, 1.0);
          vec3 q = vP * 1.3 + vec3(0.0, uT * 0.25, uT * 0.12); float m = n3(q) * 0.6 + n3(q * 2.3 - uT * 0.2) * 0.4;
          float cell = smoothstep(0.35, 0.75, m);
          vec3 col = mix(vec3(0.8, 0.11, 0.015), vec3(1.0, 0.4, 0.06), smoothstep(0.0, 0.55, fc));
          col = mix(col, vec3(1.0, 0.62, 0.2), smoothstep(0.45, 1.0, fc) * (0.3 + 0.5 * cell) * smoothstep(0.7, 1.3, uHeat)); // only a hot core goes yellow
          col *= (0.45 + 0.65 * cell) * uHeat;
          gl_FragColor = vec4(clamp(col, 0.0, 1.6), 1.0); }` });
    S.core = add(S.torso, new THREE.IcosahedronGeometry(2.2, 3), S.coreMat, 0, 11.4, 4.0); S.core.castShadow = false;
    S.coreGlow = glowSprite(0xff6a20, 5.5, 0.3); S.coreGlow.position.set(0, 11.4, 6.6); S.torso.add(S.coreGlow);
    S.coreL = new THREE.PointLight(0xffa040, 0, 40, 1.8); S.coreL.position.set(0, 11.4, 8.5); S.torso.add(S.coreL);
    S.plates = []; for (let i = 0; i < 4; i++) { const sx = i % 2 ? 1 : -1, sy = i < 2 ? 1 : -1, pv = new THREE.Group(); pv.position.set(sx * 2.5, 11.4 + sy * 2.5, 5.3); S.torso.add(pv); add(pv, slab(2.0, 2.0, 1.0, { bevel: 0.3, amp: 0.15, cell: 0.2 }), crust, -sx * 1.25, -sy * 1.25, 0.3, 0, 0, i * 0.3); S.plates.push({ pv, sx, sy }); }
    // head: heavy brow overhang and jaw, low and forward under the yoke; eyes and furnace mouth stay visible
    S.head = new THREE.Group(); S.head.position.set(0, 16.8, 5.6); S.head.scale.setScalar(1.25); S.torso.add(S.head);
    add(S.head, ball(2.5, 2.1, 2.5, { amp: 0.25, cell: 0.15 }), crust, 0, 1.0, -0.5);
    add(S.head, slab(5.8, 1.7, 2.9, { taper: 0.75, bevel: 0.08, amp: 0.25, cell: 0.15 }), cap, 0, 1.35, 1.7, 0.2);
    for (const sx of [-1, 1]) add(S.head, slab(1.4, 1.8, 2.0, { taper: 0.7, cell: 0.2 }), crust, sx * 2.2, 0.0, 1.0, 0, sx * 0.3, sx * 0.15); // cheekbones
    for (let i = 0; i < 5; i++) { const a = (i - 2) / 2; add(S.head, shape(hexG.clone(), 0.5 + h2(i, 7, 5) * 0.25, 1.4 + (1 - Math.abs(a)) * 1.6 + h2(i, 8, 5), 0.5 + h2(i, 7, 5) * 0.25, { amp: 0.04, cell: 0.3 }), horn, a * 1.7, 2.3 - Math.abs(a) * 0.3, -0.4, -0.3 + h2(i, 9, 5) * 0.2, 0, -a * 0.4); }
    S.eyes = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb060).multiplyScalar(3) });
    S.eyeGlow = [];
    for (const sx of [-1, 1]) { add(S.head, new THREE.SphereGeometry(1, 10, 8).scale(0.6, 0.26, 0.35), S.eyes, sx * 1.2, 0.4, 2.35, 0, 0, -sx * 0.3).castShadow = false; const gs = glowSprite(0xff7a28, 1.5, 0.7); gs.position.set(sx * 1.2, 0.4, 2.8); S.head.add(gs); S.eyeGlow.push(gs); }
    S.jaw = new THREE.Group(); S.jaw.position.set(0, -0.3, -0.2); S.head.add(S.jaw);
    add(S.jaw, slab(5.0, 1.9, 3.9, { taper: 0.8, bevel: 0.08, amp: 0.25, cell: 0.15 }), crust, 0, -1.15, 1.4, 0.08);
    for (let i = 0; i < 5; i++) add(S.jaw, new THREE.ConeGeometry(0.26, 0.85, 4), horn, (i - 2) * 0.85, -0.1, 3.1);
    S.mouth = new THREE.MeshBasicMaterial({ color: new THREE.Color(FIRE).multiplyScalar(2) });
    add(S.head, new THREE.SphereGeometry(1, 12, 8).scale(1.8, 0.48, 1.4), S.mouth, 0, -0.4, 1.3).castShadow = false;
    S.mouthGlow = glowSprite(0xff5a18, 2.4, 0.35); S.mouthGlow.position.set(0, -0.45, 3.0); S.head.add(S.mouthGlow);
    // arms: tapered sleeves, molten elbow and wrist seams, frustum forearms widening into fists bigger than the head
    S.arms = [];
    for (const sx of [-1, 1]) {
      const ag = new THREE.Group(); ag.position.set(sx * 8.2, 14.4, 0.4); S.torso.add(ag);
      const limb = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = add(ag, geo, H(mat.userData.hideOpts), x, y, z, rx, ry, rz); m.userData.fadeOcclude = true; m.userData.fadeMin = 0.05; return m; };
      limb(tube(2.4, 1.8, 7.4, { cell: 0.1 }), crust, 0, 0, 4.4);
      limb(ball(2.0, 2.0, 2.0, { amp: 0.4, fq: 0.7, cell: 0.25 }), hotSkin, 0, 0, 8.6);
      limb(tube(1.9, 2.8, 6.6, { cell: 0.1, amp: 0.25 }), crust, 0, 0, 12.2);
      limb(slab(2.8, 1.0, 5.6, { taper: 0.8, cell: 0.12 }), crust, 0, 2.1, 12.4, 0.05);
      limb(tube(2.7, 2.6, 1.6, { amp: 0.35, fq: 0.8, cell: 0.25 }), hotSkin, 0, 0, 15.5);
      limb(ball(4.4, 3.6, 4.6, { amp: 0.45, fq: 0.45, cell: 0.12 }), fistM, 0, 0, 18.0, 0.2, 0.2, 0);
      for (let k = 0; k < 4; k++) limb(slab(1.7, 1.8, 1.8, { taper: 0.85, cell: 0.25 }), crust, (k - 1.5) * 1.9, 0.6, 21.3, 0.25, 0, (k - 1.5) * 0.08);
      for (let k = 0; k < 3; k++) limb(ball(0.6, 0.8, 0.7, { amp: 0.2, cell: 0.3 }), hotSkin, (k - 1) * 1.9, 0.5, 21.0);
      S.arms.push({ g: ag, sx, cur: new V3(sx * 11, 1, 6), tgt: new V3(), mode: 'rest', hold: 0, ang: 0 });
    }
    b.group.traverse((o) => { if (!o.isMesh || !o.material.userData.hideOpts || o.userData.fadeOcclude) return; o.material = H(o.material.userData.hideOpts); o.userData.fadeOcclude = true; o.userData.fadeMin = 0.05; });
    b.ringY = -1.1; // the target ring sits down on the lava, not glaring over the platform
    S.geodes = []; S.geoGeo = new THREE.LatheGeometry([[0.01, -0.6], [0.5, -0.6], [0.5, 1.2], [0.42, 1.5], [0.01, 2.3]].map(([x, y]) => new THREE.Vector2(x, y)), 6);
    S.geoMat = new THREE.MeshStandardMaterial({ color: 0x1a4a6a, emissive: 0x30c8ff, emissiveIntensity: 0.8, roughness: 0.08, metalness: 0.35, flatShading: true, envMapIntensity: 2.0 });
    // facets: inner glow where a face looks at the camera, a pale cyan edge at grazing angles
    S.geoMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      ${RIM}
      totalEmissiveRadiance *= (0.12 + pow(max(1.0 - fr_, 0.0), 3.0) * 0.7) * (0.3 + 0.7 * abs(dot(nV_, vec3(0.42, 0.72, 0.55))));
      totalEmissiveRadiance += vec3(0.5, 0.9, 1.2) * pow(max(fr_, 0.0), 2.5) * 0.9;`); };
    S.geoMat.customProgramCacheKey = () => 'titanGeode';
    S.cupGeo = new THREE.DodecahedronGeometry(1, 0); S.cupMat = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.95, metalness: 0, flatShading: true });
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
    // a broken rock cup around the cluster, and two mid-size crystals leaning out of it
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + W.hash2(i, 3, 9) * 0.4, c = new THREE.Mesh(S.cupGeo, S.cupMat); c.position.set(Math.sin(a) * 1.55, 0.1, Math.cos(a) * 1.55); c.rotation.set(W.hash2(i, 1, 9) * 3, a, W.hash2(i, 2, 9) * 3); c.scale.set(0.5 + W.hash2(i, 4, 9) * 0.4, 0.35 + W.hash2(i, 5, 9) * 0.45, 0.5 + W.hash2(i, 6, 9) * 0.3); grp.add(c); }
    for (let i = 0; i < 2; i++) { const a = i * 2.6 + 0.8, c = new THREE.Mesh(S.geoGeo, S.geoMat); c.position.set(Math.sin(a) * 0.9, 0.3, Math.cos(a) * 0.9); c.rotation.set(Math.cos(a) * 0.6, i, -Math.sin(a) * 0.6); c.scale.setScalar(0.9 - i * 0.15); grp.add(c); }
    const gg = glowSprite(0x3ac8ff, 6, 0.35); gg.position.y = 0.4; grp.add(gg);
    const L = new THREE.PointLight(0x40d0ff, 60, 26, 1.6); L.position.y = 2; grp.add(L); grp.scale.setScalar(0.01); G.world.add(grp);
    S.geodes.push({ a, grp, alive: true, t: 0 }); Sound.sfx('shatter', 0.4, 0.6); FX.pillar(grp.position.x, grp.position.z, { r: 1, h: 10, color: ICE, dur: 0.6 });
  }
  function stagger(b, q) {
    const S = b.state; q.alive = false; q.grp.visible = false; const x = q.grp.position.x, z = q.grp.position.z;
    FX.explode(x, 1.5, z, ICE, 8, 0xffffff); FX.lightning(new V3(x, 2, z), new V3(0, 10, 0), { color: ICE, width: 0.6, jag: 2.5, dur: 0.5 }); FX.flash(ICE, 0.1, 7); Sound.sfx('shatter'); Sound.sfx('roar', 1, 0.7); FX.shake(1);
    S.stag = 9; b.dmgTaken = 2.0; b.castState = null; FX.num(b.aim(new V3()), 'STAGGERED', 'note');
  }
  function* reel(b) { const S = b.state; while (S.stag > 0) yield; yield 0.8; }
  function* slam(b, o = {}) {
    const S = b.state, arc = 0.72, t = o.time || 1.9, extra = o.extra || [];
    const arm = S.arms[angDiff(b.facing, playerAng()) > 0 ? 1 : 0], other = S.arms[arm === S.arms[0] ? 1 : 0];
    let a = playerAng(); S.pend = { t, lock: 0.85 };
    const h = wedge(a, arc, t, 430, { name: 'Slam', lock: 0.85, track: (s) => { s.dir = dampAng(s.dir, playerAng(), 10, G.dt); a = s.dir; }, kb: { dist: 4 }, quiet: true, onFire: () => {
      FX.shake(1); Sound.sfx('bigboom', 0.9); pt(a, MID, 0.5, _v); FX.explode(_v.x, 0.5, _v.z, FIRE, 7, 0xffd080); for (let k = 0; k < 3; k++) { pt(a + (k - 1) * 0.25, R0 + 2 + k * 3, 0.3, _v); FX.burst(_v.x, 0.3, _v.z, { n: 16, smoke: true, color: 0x6a3a26, color2: 0x2a1610, speed: [2, 8], up: 5, grav: 12, life: [0.8, 1.6], size: [0.5, 1.4] }); }
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
    if (lvl === 2 && !G.headless) { S.core.getWorldPosition(_v); FX.explode(_v.x, _v.y, _v.z, FIRE, 6, 0xffe0a0); FX.burst(_v.x, _v.y, _v.z, { n: 30, color: 0x6a3a26, color2: 0x2a1610, smoke: true, speed: [4, 12], up: 4, grav: 16, life: [1, 2], size: [0.6, 1.4] }); }
    const h0 = U.uHor.value.clone(), h1 = new THREE.Color([0x2e0c06, 0x3a0c06, 0x560a04][lvl]), c0 = U.uCloudCol.value.clone(), c1 = new THREE.Color([0x3a2826, 0x40221e, 0x4a1a14][lvl]), f0 = S.fogC.clone(), f1 = new THREE.Color([0x120706, 0x140606, 0x1a0604][lvl]);
    const t0 = U.uTop.value.clone(), t1 = new THREE.Color([0x070103, 0x0c0204, 0x1a0306][lvl]), d0 = scene.fog.density, d1 = [0.0085, 0.0095, 0.0108][lvl];
    const e0 = S.floorMat.emissiveIntensity, e1 = [1.2, 1.4, 1.65][lvl], hb0 = S.HU.uHeatB.value, cr0 = S.HU.uCrack.value, r0 = S.rise, r1 = [0, 1.0, 2.0][lvl], ec0 = EU.uCol.value.clone(), ec1 = new THREE.Color(0xff8030).multiplyScalar([1.4, 2.0, 2.8][lvl]), v0 = EU.uVel.value.clone(), v1 = new V3(...[[0.4, 1.7, 0.2], [0.9, 2.6, 0.5], [1.8, 3.8, 1.0]][lvl]), a0 = S.ash.material.uniforms.uAlpha.value, lh0 = S.lake.material.uniforms.uHeat.value;
    for (let i = 0; i < S.falls.length; i++) S.falls[i].m.visible = S.falls[i].sp.visible = i < [3, 5, 7][lvl];
    const ly0 = S.lake.position.y, sw0 = S.lake.material.uniforms.uSwell.value, sg0 = S.smokeU.uGlow.value, ew0 = S.FU.uEW.value, fl0 = S.FU.uFl.value, cb0 = S.coreBase || 0;
    const rh0 = S.HU.uRootH.value, br0 = S.lake.material.uniforms.uBreak.value, lg0 = S.lipCol.userData.U.uGlow.value, sgl0 = S.stubMat.userData.U.uGlow.value, hs0 = S.heatGlow.scale.x, hc0 = S.heatGlow.material.color.clone(), hc1 = new THREE.Color([0xff4a10, 0xff5a14, 0xff8a28][lvl]), bc0 = S.banks[0].material.color.clone(), bc1 = new THREE.Color([0x8a4a30, 0xa04a28, 0xc05a26][lvl]);
    yield* W.tween(3.2, (k) => { S.lake.material.uniforms.uBreak.value = lerp(br0, [0, 0.045, 0.09][lvl], k); S.lipCol.userData.U.uGlow.value = lerp(lg0, [1.2, 2.5, 3.0][lvl], k); S.stubMat.userData.U.uGlow.value = lerp(sgl0, [0.9, 1.9, 2.3][lvl], k); S.HU.uRootH.value = lerp(rh0, [1, 2.6, 3.2][lvl], k); S.heatGlow.scale.setScalar(lerp(hs0, [60, 74, 96][lvl], k)); W.colorLerp(S.heatGlow.material.color, hc0, hc1, k); for (const bk of S.banks) W.colorLerp(bk.material.color, bc0, bc1, k); S.FU.uEW.value = lerp(ew0, [2.6, 4, 6][lvl], k); S.smokeU.uGlow.value = lerp(sg0, [0.6, 0.95, 1.4][lvl], k); S.lake.position.y = lerp(ly0, [-1.2, -1.07, -0.94][lvl], k); S.lake.material.uniforms.uSwell.value = lerp(sw0, [0.1, 0.18, 0.28][lvl], k); S.FU.uFl.value = lerp(fl0, [0.1, 0.16, 0.26][lvl], k); S.coreBase = lerp(cb0, [0, 0.6, 1.3][lvl], k); W.colorLerp(U.uHor.value, h0, h1, k); W.colorLerp(U.uCloudCol.value, c0, c1, k); W.colorLerp(U.uTop.value, t0, t1, k); W.colorLerp(S.fogC, f0, f1, k); scene.fog.density = lerp(d0, d1, k);
      S.floorMat.emissiveIntensity = lerp(e0, e1, k); S.HU.uHeatB.value = lerp(hb0, [0, 0.2, 0.45][lvl], k); S.HU.uCrack.value = lerp(cr0, [0, 0.35, 0.7][lvl], k); S.rise = lerp(r0, r1, k); S.lavaL.intensity = 60 + lvl * 20 * k;
      W.colorLerp(EU.uCol.value, ec0, ec1, k); EU.uVel.value.lerpVectors(v0, v1, k); S.ash.material.uniforms.uAlpha.value = lerp(a0, [0.45, 0.65, 0.9][lvl], k); S.groove.emissiveIntensity = 0.55 + lvl * 0.45 * k; S.lake.material.uniforms.uHeat.value = lerp(lh0, 0.6 + lvl * 0.25, k); });
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
      S.geoMat.emissiveIntensity = 0.8 + Math.sin(t * 4) * 0.25; S.HU.uT.value = t; S.FU.uT.value = t; { const cx = camera.position.x, cz = camera.position.z, cl = Math.hypot(cx, cz) || 1; S.rimL.position.set(-cx / cl * 70, 45, -cz / cl * 70); S.heatGlow.position.set(-cx / cl * 14, 11 + S.rise, -cz / cl * 14); S.heatGlow.material.opacity = 0.24 + S.lvl * 0.1; }
      for (let i = 0; i < S.cards.length; i++) S.cards[i].material.rotation += dt * (i % 2 ? 0.02 : -0.02);
      if (S.lvl >= 2 && vrand() < dt * 0.3) { const a = vrand() * TAU, r = 40 + vrand() * 40; FX.lightning(new V3(Math.sin(a) * r, 41, Math.cos(a) * r), new V3(Math.sin(a + 0.4) * (r + 10), 39, Math.cos(a + 0.4) * (r + 10)), { color: 0xffc080, width: 0.9, jag: 6, dur: 0.3 }); } S.core.getWorldPosition(S.HU.uCore.value);
      for (const fl of S.falls) if (fl.m.visible && vrand() < dt * 2.5) FX.burst(fl.x, -0.6, fl.z, { n: 4, smoke: true, color: 0x8a7e7a, color2: 0x2a2422, speed: [0.5, 2], up: 3, grav: -0.5, life: [1.5, 3], size: [1.5, 3], radius: fl.w * 0.5 });
      if (S.lvl >= 1 && vrand() < dt * S.lvl * 10) for (const sx of [-1, 1]) { _v.copy(S['vent' + sx]); S.torso.localToWorld(_v); FX.burst(_v.x, _v.y, _v.z, { n: 2, color: 0xffc060, color2: 0xff3008, dir: [sx * 0.2, 1, -0.2], spread: 0.22, speed: [6, 11], life: [0.35, 0.7], size: [0.6, 1.3] }); }
      if (S.lvl >= 2 && vrand() < dt * 1.6) { const a = vrand() * TAU, r = 25 + vrand() * 16; FX.burst(Math.sin(a) * r, 34, Math.cos(a) * r, { n: 2, color: 0xff7a30, color2: 0x2a1a14, dir: [0, -1, 0], spread: 0.05, speed: [16, 22], grav: 12, life: [1.4, 1.7], size: [0.4, 0.8] }); }
      // body
      S.open = damp(S.open, S.stag > 0 ? 1 : 0, 4, dt);
      S.body.position.y = -4.2 + S.rise + Math.sin(t * 0.7) * 0.25 - S.open * 1.2; S.torso.rotation.x = S.open * 0.2 + Math.sin(t * 0.5) * 0.02 + (S.breath === 1 ? -0.08 : S.breath === 2 ? 0.14 : 0);
      S.head.rotation.x = damp(S.head.rotation.x, S.open * 0.5 + (S.stoke > 0 ? -0.5 : 0) + (S.breath ? 0.25 : 0.12), 5, dt);
      for (const m of S.pecs) m.visible = S.lvl < 2;
      for (const p of S.plates) { p.pv.visible = S.lvl < 2; p.pv.rotation.y = p.sx * S.open * 1.3; p.pv.rotation.x = -p.sy * S.open * 0.9; }
      const heat = 0.9 + (S.coreBase || 0) + S.open * 3 + S.stoke * 2 + Math.sin(t * 2.4) * 0.15; S.coreU.uT.value = t; S.coreU.uHeat.value = 0.5 + Math.min(heat - 0.9, 2.2) * 0.3 + (S.lvl >= 2 ? 0.4 : 0); S.coreL.intensity = S.open * 160 + S.stoke * 70;
      S.mouth.color.setHex(FIRE).multiplyScalar(0.8 + S.stoke * 6 + (S.breath ? 6 : 0)); S.eyes.color.setHex(S.stag > 0 ? 0x404040 : 0xffb060).multiplyScalar(S.stag > 0 ? 1 : 3);
      S.jaw.rotation.x = damp(S.jaw.rotation.x, S.breath ? 0.45 : S.stoke > 0 ? 0.25 : 0.06, 6, dt);
      S.mouthGlow.material.opacity = Math.min(1, 0.22 + S.stoke * 0.6 + (S.breath ? 0.6 : 0)); S.coreGlow.material.opacity = Math.min(0.4, 0.06 + S.open * 0.3 + S.stoke * 0.2 + (S.lvl >= 2 ? 0.12 : 0));
      for (const gs of S.eyeGlow) gs.material.opacity = S.stag > 0 ? 0.1 : 0.6;
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
      const S = b.state, melee = p.cls.melee, r = melee ? 12.9 : 14.5;
      if (S.swp) return { x: Math.sin(S.swp.gap) * r, z: Math.cos(S.swp.gap) * r, w: 4 };
      const q = S.geodes.find((c) => c.alive && c.t > 0.8 && Hz.threat(Math.sin(c.a) * r, Math.cos(c.a) * r) > 2.5);
      if (q && S.stag <= 0 && (!S.pend || S.pend.t > S.pend.lock + 0.1)) return { x: Math.sin(q.a) * r, z: Math.cos(q.a) * r, w: 1.2 };
      return {};
    },
  });
  const _v = new V3();
})();
