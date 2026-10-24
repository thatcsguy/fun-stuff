// =====================================================================
// 09_boss1.js: Boss 1, GNOMON the Brass Warden (SPEC 9 "Boss 1").
// A brass sundial-knight: a segmented obelisk with a slanted gnomon crest,
// three armillary hoops, floating gauntlets, a keyhole weak point on its
// back, a sun (later a moon) hanging behind it and the shadow-hand it casts
// on the floor, which points where the Warden faces.
// Phases: Noon (100-65) -> Dusk (65-30) -> Midnight (30-0).
// Owner: boss 1 author. Everything lives in this file.
// =====================================================================
(() => {
  const T3 = (typeof THREE !== 'undefined') ? THREE : G.THREE;
  const PI = Math.PI, TAU = PI * 2;
  const BODY_S = 1.6;           // the body is modelled at 1:1 and scaled up
  const ACC = '#5fe3ff', ICE = '#dff9ff', GOLD = '#ffc94d', GOLD_HOT = '#fff1c2', DUSK = '#ffa45a';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const angDiff = (a, b) => G.angDiff(a, b);
  const logE = (w, e) => { try { G.log.error('gnomon.' + w, e); } catch (_) { console.error(w, e); } };
  const fx = (name, ...a) => { try { const f = G.fx && G.fx[name]; return f ? f.apply(G.fx, a) : undefined; } catch (e) { logE('fx.' + name, e); } };
  const sfx = (name, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(name, o || {}); } catch (e) { logE('sfx.' + name, e); } };
  const world = (name, ...a) => { try { const f = G.world && G.world[name]; return f ? f.apply(G.world, a) : undefined; } catch (e) { logE('world.' + name, e); } };
  const cam = (name, ...a) => { try { const f = G.cam && G.cam[name]; return f ? f.apply(G.cam, a) : undefined; } catch (e) { logE('cam.' + name, e); } };
  const post = (name, ...a) => { try { const f = G.post && G.post[name]; return f ? f.apply(G.post, a) : undefined; } catch (e) { logE('post.' + name, e); } };
  const V3 = (x, y, z) => new T3.Vector3(x, y, z);
  const PS = () => (G.player && G.player.state) || null;
  const RING = (i) => G.RINGS[i];
  const cwait = (s) => G.combat.wait(s);                 // cinematic wait (combat clock, never rejects)
  const homeCam = () => (G.camera ? G.camera.position.toArray() : [0, 20, 16]);
  const homeLook = () => { try { const p = G.cam.playPose; return p && p.look ? p.look.toArray() : [0, 0.5, 0]; } catch (e) { return [0, 0.5, 0]; } };

  // ================================================================ TEXTURES (cached once, reused by every fight)
  const TEX = {};
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x, w, h);
    const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  // emissive glyph columns for the obelisk faces (4 faces side by side, u = 0..1 around)
  function glyphTex() {
    if (TEX.glyph) return TEX.glyph;
    TEX.glyph = canvasTex(256, 512, (x, w, h) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      for (let f = 0; f < 4; f++) {
        const x0 = f * 64;
        x.strokeStyle = 'rgba(160,240,255,0.55)'; x.lineWidth = 2;
        x.strokeRect(x0 + 6, 6, 52, h - 12);
        x.strokeStyle = 'rgba(160,240,255,0.25)'; x.lineWidth = 1;
        x.strokeRect(x0 + 11, 11, 42, h - 22);
        x.fillStyle = 'rgba(210,250,255,0.95)'; x.strokeStyle = 'rgba(210,250,255,0.95)';
        x.font = 'bold 15px Georgia, "Times New Roman", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        for (let k = 0; k < 7; k++) {
          const y = 34 + k * 70, cx = x0 + 32;
          x.fillText(ROMAN[(f * 7 + k) % 12], cx, y);
          // a little astronomical mark between numerals: sun dot, crescent, triangle, cross
          const m = (f + k) % 4, my = y + 34;
          x.lineWidth = 1.6; x.beginPath();
          if (m === 0) { x.arc(cx, my, 7, 0, TAU); x.stroke(); x.beginPath(); x.arc(cx, my, 2, 0, TAU); x.fill(); }
          else if (m === 1) { x.arc(cx, my, 7, PI * 0.25, PI * 1.75); x.stroke(); }
          else if (m === 2) { x.moveTo(cx, my - 8); x.lineTo(cx + 7, my + 6); x.lineTo(cx - 7, my + 6); x.closePath(); x.stroke(); }
          else { x.moveTo(cx - 8, my); x.lineTo(cx + 8, my); x.moveTo(cx, my - 8); x.lineTo(cx, my + 8); x.stroke(); }
        }
      }
    });
    return TEX.glyph;
  }
  // the dial face on the plinth: color map + emissive map
  function dialTex(emissive) {
    const key = emissive ? 'dialE' : 'dialC';
    if (TEX[key]) return TEX[key];
    TEX[key] = canvasTex(512, 512, (x, w) => {
      const c = w / 2;
      if (!emissive) {
        const g = x.createRadialGradient(c, c, 10, c, c, c);
        g.addColorStop(0, '#e2b660'); g.addColorStop(0.7, '#b48434'); g.addColorStop(1, '#6e4c1c');
        x.fillStyle = g; x.fillRect(0, 0, w, w);
      } else { x.fillStyle = '#000'; x.fillRect(0, 0, w, w); }
      const ink = emissive ? 'rgba(190,245,255,0.95)' : 'rgba(40,24,6,0.85)';
      x.strokeStyle = ink; x.fillStyle = ink;
      for (const [r, lw] of [[250, 3], [232, 1.5], [180, 2], [120, 1.5], [36, 2]]) { x.lineWidth = lw; x.beginPath(); x.arc(c, c, r, 0, TAU); x.stroke(); }
      for (let i = 0; i < 72; i++) {
        const a = i / 72 * TAU, r0 = i % 6 === 0 ? 182 : 214, r1 = 232;
        x.lineWidth = i % 6 === 0 ? 2.4 : 1.2; x.beginPath();
        x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); x.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); x.stroke();
      }
      x.font = 'bold 30px Georgia, "Times New Roman", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU;
        x.save(); x.translate(c + Math.cos(a) * 150, c + Math.sin(a) * 150); x.rotate(a + PI / 2); x.fillText(ROMAN[i], 0, 0); x.restore();
      }
      // hour lines (the sundial's fan)
      x.lineWidth = 1.2;
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; x.beginPath(); x.moveTo(c + Math.cos(a) * 40, c + Math.sin(a) * 40); x.lineTo(c + Math.cos(a) * 118, c + Math.sin(a) * 118); x.stroke(); }
    });
    return TEX[key];
  }
  // pointing shadow-hand silhouette (points toward +u)
  function handTex() {
    if (TEX.hand) return TEX.hand;
    TEX.hand = canvasTex(512, 256, (x, w, h) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      const shape = () => {
        x.beginPath();
        x.moveTo(0, 96); x.lineTo(110, 84); x.lineTo(110, 172); x.lineTo(0, 160); x.closePath(); x.fill();   // wrist / forearm
        x.beginPath(); x.ellipse(170, 128, 78, 64, 0, 0, TAU); x.fill();                                       // palm
        x.beginPath(); x.ellipse(330, 112, 170, 20, -0.03, 0, TAU); x.fill();                                  // index finger
        x.beginPath(); x.ellipse(232, 150, 46, 17, 0.25, 0, TAU); x.fill();                                    // curled fingers
        x.beginPath(); x.ellipse(226, 174, 40, 15, 0.35, 0, TAU); x.fill();
        x.beginPath(); x.ellipse(214, 194, 32, 13, 0.45, 0, TAU); x.fill();
        x.beginPath(); x.ellipse(206, 66, 62, 16, -0.55, 0, TAU); x.fill();                                    // thumb
      };
      x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 22; shape();
      x.shadowBlur = 0; shape();
    });
    TEX.hand.colorSpace = T3.NoColorSpace;
    return TEX.hand;
  }
  function rayTex() {
    if (TEX.ray) return TEX.ray;
    TEX.ray = canvasTex(256, 256, (x, w) => {
      const c = w / 2;
      x.translate(c, c);
      for (let i = 0; i < 16; i++) {
        x.rotate(TAU / 16);
        const g = x.createLinearGradient(0, 0, c, 0); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.beginPath(); x.moveTo(0, -(i % 2 ? 4 : 8)); x.lineTo(c * (i % 2 ? 0.7 : 1), 0); x.lineTo(0, i % 2 ? 4 : 8); x.closePath(); x.fill();
      }
    });
    return TEX.ray;
  }

  // ================================================================ MATERIALS / SHADERS
  // brass with an animated inlay: glyph glow pulsing up the body, a slow scan band, a cyan fresnel rim,
  // hit flash, and frost (P3) that whitens upward-facing surfaces with sparkles
  function brassMat(U, emap, o = {}) {
    const m = new T3.MeshStandardMaterial({
      color: new T3.Color(o.color || '#c8953c'), metalness: o.metal != null ? o.metal : 0.9, roughness: o.rough != null ? o.rough : 0.3,
      emissive: new T3.Color(ACC), emissiveIntensity: emap ? 1.0 : 0.0, emissiveMap: emap || null, envMapIntensity: o.env != null ? o.env : 1.1,
    });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { gT: U.uT, gGlow: U.uGlow, gScan: U.uScan, gFrost: U.uFrost, gAcc: U.uAcc, gRim: U.uRim, gHit: U.uHit });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 gWP; varying vec3 gWN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n gWP = (modelMatrix * vec4(transformed, 1.0)).xyz; gWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float gT, gGlow, gScan, gFrost, gRim, gHit; uniform vec3 gAcc; varying vec3 gWP; varying vec3 gWN;\nfloat gHash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float gUp = smoothstep(0.1, 0.9, normalize(gWN).y);
          float gN = gHash(floor(gWP * 7.0));
          float gFr = gFrost * clamp(0.25 + gUp * 0.75 + (gN - 0.5) * 0.5, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.84, 0.96), gFr * 0.55);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float gPulse = 0.62 + 0.38 * sin(gT * 2.3 - gWP.y * 2.4);
          totalEmissiveRadiance *= gPulse * gGlow;
          float gBandP = abs(fract(gWP.y * 0.17 - gT * 0.21) * 2.0 - 1.0);
          float gBand = smoothstep(0.9, 1.0, gBandP);
          vec3 gV = normalize(vViewPosition);
          float gF = pow(1.0 - clamp(abs(dot(normal, gV)), 0.0, 1.0), 3.0);
          totalEmissiveRadiance += gAcc * (gF * gRim + gBand * gScan * 0.55) + vec3(gHit * 0.32, gHit * 0.36, gHit * 0.4);
          totalEmissiveRadiance += vec3(0.7, 0.95, 1.0) * gFr * 0.16 * step(0.86, gN) * (0.5 + 0.5 * sin(gT * 4.0 + gN * 40.0));`);
    };
    m.customProgramCacheKey = () => 'gnomonBrass' + (emap ? 'E' : '');
    return m;
  }
  function handMaterial(U) {
    return new T3.ShaderMaterial({
      transparent: true, depthWrite: false, side: T3.DoubleSide,
      uniforms: { uMap: { value: handTex() }, uT: U.uT, uA: U.uHandA, uAcc: U.uHandCol, uFlow: U.uHandFlow },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D uMap; uniform float uT, uA, uFlow; uniform vec3 uAcc; varying vec2 vUv;
        void main(){
          float a = texture2D(uMap, vUv).r;
          float core = smoothstep(0.55, 0.9, a);
          float rim = smoothstep(0.04, 0.5, a) * (1.0 - core);
          float flow = 0.55 + 0.45 * sin(vUv.x * 34.0 - uT * (3.0 + uFlow * 6.0));
          float veins = smoothstep(0.82, 1.0, sin(vUv.x * 90.0 + sin(vUv.y * 20.0) * 2.0 - uT * 2.0)) * core * 0.35;
          vec3 hc = uAcc * 1.8 * flow; hc *= min(1.0, 0.9 / max(0.001, max(hc.r, max(hc.g, hc.b))));   // big floor quad: keep it under the bloom knee
          vec3 col = mix(hc, uAcc * 0.16, core) + uAcc * veins;
          float alpha = (core * 0.5 + rim * (0.55 + 0.35 * uFlow) * flow + veins) * uA;
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        }`,
    });
  }
  // a column of light (casts, death): open cylinder with scrolling bands, additive
  function columnMaterial(color) {
    return new T3.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide, toneMapped: false,
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uC: { value: new T3.Color(color) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT, uA; uniform vec3 uC; varying vec2 vUv;
        void main(){
          float fade = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
          float bands = 0.55 + 0.45 * sin(vUv.y * 40.0 - uT * 9.0);
          float streak = 0.6 + 0.4 * sin(vUv.x * 62.83 + uT * 2.0);
          gl_FragColor = vec4(uC * 1.6 * bands * streak, fade * uA * bands);
        }`,
    });
  }
  // the vertical frost blade of the Long Night (also used for the Meridian shadow)
  function bladeMaterial(color) {
    return new T3.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide, toneMapped: false,
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uC: { value: new T3.Color(color) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT, uA; uniform vec3 uC; varying vec2 vUv;
        void main(){
          float up = 1.0 - smoothstep(0.0, 1.0, vUv.y);
          float streak = 0.5 + 0.5 * sin(vUv.x * 46.0 - uT * 7.0 + vUv.y * 6.0);
          float ends = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));
          float a = up * up * ends * (0.35 + 0.65 * streak) * uA;
          gl_FragColor = vec4(mix(uC * 0.72, vec3(0.85), up * 0.3), a * 0.8); // kept below the bloom knee so the wall reads, not whites out
        }`,
    });
  }

  // pylon assets: shared across adds and fights (flagged shared so add teardown skips them)
  let PYL = null;
  function pylonAssets() {
    if (PYL) return PYL;
    const sh = (m) => { m.userData.shared = true; return m; };
    PYL = {
      brass: sh(new T3.MeshStandardMaterial({ color: 0xc49540, metalness: 0.9, roughness: 0.34, envMapIntensity: 1.3, emissive: 0x2a1a06, emissiveIntensity: 0.6 })),
      dark: sh(new T3.MeshStandardMaterial({ color: 0x141838, metalness: 0.7, roughness: 0.35 })),
      cyan: sh(G.mat.emissive(ACC, 2.4)),
      ice: sh(G.mat.emissive(ICE, 2.0)),
      base: new T3.CylinderGeometry(0.44, 0.54, 0.24, 8),
      shaft: new T3.CylinderGeometry(0.17, 0.32, 1.25, 4),
      collar: new T3.CylinderGeometry(0.24, 0.24, 0.08, 4),
      cap: new T3.CylinderGeometry(0.0, 0.2, 0.34, 4),
      crystal: new T3.OctahedronGeometry(0.2, 0),
      ring: new T3.TorusGeometry(0.46, 0.03, 6, 40),
      face: new T3.CircleGeometry(0.15, 20),
    };
    return PYL;
  }
  function pylonModel(group, add) {
    const A = pylonAssets();
    const mk = (geo, mat, x, y, z) => { const m = new T3.Mesh(geo, mat); m.position.set(x, y, z); m.userData.sharedGeo = true; group.add(m); return m; };
    mk(A.base, A.dark, 0, 0.12, 0);
    const s = mk(A.shaft, A.brass, 0, 0.86, 0); s.rotation.y = PI / 4;
    const c1 = mk(A.collar, A.brass, 0, 1.5, 0); c1.rotation.y = PI / 4;
    const cap = mk(A.cap, A.brass, 0, 1.7, 0); cap.rotation.y = PI / 4;
    const cr = mk(A.crystal, A.cyan, 0, 2.1, 0); cr.scale.set(1, 1.7, 1);
    const rg = mk(A.ring, A.cyan, 0, 0.9, 0); rg.rotation.x = PI / 2;
    const f1 = mk(A.face, A.cyan, 0.17, 0.9, 0); f1.rotation.y = PI / 2;
    const f2 = mk(A.face, A.cyan, -0.17, 0.9, 0); f2.rotation.y = -PI / 2;
    group.userData.spin = cr;
    add.data.ring = rg; add.data.crystal = cr;
  }

  // ================================================================ MODEL
  function build(b) {
    const D = b.data;
    const U = D.U = {
      uT: { value: 0 }, uGlow: { value: 1 }, uScan: { value: 0.5 }, uFrost: { value: 0 }, uAcc: { value: new T3.Color(ACC) },
      uRim: { value: 0.35 }, uHit: { value: 0 }, uHandA: { value: 1 }, uHandCol: { value: new T3.Color(ACC) }, uHandFlow: { value: 0 },
    };
    const mats = D.mats = {
      brass: brassMat(U, null),
      brassD: brassMat(U, null, { color: '#7c5524', rough: 0.42 }),
      obel: brassMat(U, glyphTex(), { color: '#3a2c22', metal: 0.75, rough: 0.3, env: 0.9 }),
      dark: new T3.MeshStandardMaterial({ color: 0x161a3c, metalness: 0.72, roughness: 0.3, emissive: 0x060c26, emissiveIntensity: 1 }),
      cyan: G.mat.emissive(ACC, 1.7),
      rail: G.mat.emissive(ACC, 0.9),
      white: G.mat.emissive('#e9fcff', 2.8),
      ice: new T3.MeshStandardMaterial({ color: 0xcff6ff, metalness: 0.05, roughness: 0.12, emissive: new T3.Color(ACC), emissiveIntensity: 0.55, transparent: true, opacity: 0.88 }),
    };
    const mk = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new T3.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    const root = b.root;

    // ---------- plinth + dial (under root: does not take part in the occlusion fade)
    const plinth = new T3.Group(); root.add(plinth); D.plinth = plinth;
    mk(new T3.CylinderGeometry(2.1, 2.35, 0.32, 12), mats.brassD, plinth, 0, 0.16, 0);
    mk(new T3.CylinderGeometry(1.78, 1.98, 0.22, 12), mats.brass, plinth, 0, 0.43, 0);
    const dial = mk(new T3.CircleGeometry(1.72, 72), new T3.MeshStandardMaterial({ map: dialTex(false), emissiveMap: dialTex(true), emissive: new T3.Color(ACC), emissiveIntensity: 0.55, metalness: 0.85, roughness: 0.38, envMapIntensity: 1.0 }), plinth, 0, 0.545, 0);
    dial.rotation.x = -PI / 2; D.dialMat = dial.material;
    const dialRing = mk(new T3.TorusGeometry(1.76, 0.035, 6, 96), mats.cyan, plinth, 0, 0.55, 0); dialRing.rotation.x = PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU, st = mk(new T3.BoxGeometry(0.12, 0.2, 0.12), i % 3 === 0 ? mats.cyan : mats.dark, plinth, Math.cos(a) * 2.2, 0.18, -Math.sin(a) * 2.2);
      st.rotation.y = a;
    }
    // noon marker (front of the dial)
    const nm = mk(new T3.ConeGeometry(0.12, 0.42, 4), mats.cyan, plinth, 1.95, 0.5, 0); nm.rotation.z = -PI / 2;

    // ---------- shadow hand (floor, points along +x = facing)
    const hg = new T3.PlaneGeometry(3.5, 2.1); hg.translate(1.75, 0, 0); hg.rotateX(-PI / 2);
    const hand = mk(hg, handMaterial(U), root, 1.3, 0.018, 0);
    hand.renderOrder = 1; hand.frustumCulled = false; D.hand = hand; D.handLen = 1; D.handLenT = 1;

    // ---------- sun / moon behind the Warden
    const sun = new T3.Group(); root.add(sun); D.sun = sun;
    D.sunCore = mk(new T3.SphereGeometry(0.34, 24, 16), G.mat.emissive(GOLD_HOT, 2.4), sun);
    D.sunGlow = G.mat.glowSprite(GOLD, 3.4, { opacity: 0.85 }); sun.add(D.sunGlow);
    D.sunRays = new T3.Sprite(new T3.SpriteMaterial({ map: rayTex(), color: new T3.Color(GOLD).multiplyScalar(1.4), transparent: true, opacity: 0.55, blending: T3.AdditiveBlending, depthWrite: false, toneMapped: false }));
    D.sunRays.scale.setScalar(4.2); sun.add(D.sunRays);
    D.moonRing = mk(new T3.TorusGeometry(0.62, 0.025, 6, 64), G.mat.emissive(ICE, 2.2, { transparent: true, opacity: 0 }), sun);
    D.sunPos = V3(-2.6, 10.6, 0); sun.position.copy(D.sunPos); D.sunCol = new T3.Color(GOLD);

    // ---------- body (b.model: the part that fades when the hero is hidden behind it)
    const body = new T3.Group(); body.name = 'gnomon'; body.scale.setScalar(BODY_S); b.model = body; D.body = body;
    const hover = mk(new T3.TorusGeometry(0.98, 0.04, 6, 64), mats.cyan, root, 0, 0.62, 0); hover.rotation.x = PI / 2; D.hover = hover;
    D.hoverGlow = G.mat.glowSprite(ACC, 2.2, { opacity: 0.3 }); D.hoverGlow.position.y = 0.7; root.add(D.hoverGlow);

    const lower = new T3.Group(); body.add(lower);
    mk(new T3.CylinderGeometry(0.72, 0.86, 0.3, 8), mats.brass, lower, 0, 0.82, 0);
    mk(new T3.TorusGeometry(0.8, 0.028, 6, 48), mats.cyan, lower, 0, 0.97, 0).rotation.x = PI / 2;
    // skirt plates (breathe)
    D.skirt = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + PI / 8, piv = new T3.Group();
      piv.position.set(Math.cos(a) * 0.66, 1.42, -Math.sin(a) * 0.66); piv.rotation.y = a; lower.add(piv);
      const pl = mk(new T3.BoxGeometry(0.06, 0.78, 0.46), i % 2 ? mats.brass : mats.brassD, piv, 0.05, -0.36, 0);
      mk(new T3.BoxGeometry(0.02, 0.5, 0.05), mats.cyan, pl, 0.04, 0, 0);
      D.skirt.push(piv);
    }

    // upper body pivots at the waist (bow / rear / twist)
    const upper = new T3.Group(); upper.position.y = 1.2; body.add(upper); D.upper = upper;
    const segs = D.segs = [];
    const SEG = [[0.0, 1.15, 0.66, 0.58], [1.25, 2.25, 0.58, 0.5], [2.35, 3.2, 0.5, 0.42]];
    for (let i = 0; i < SEG.length; i++) {
      const [y0, y1, rb, rt] = SEG[i];
      const sg = new T3.Group(); upper.add(sg); segs.push(sg); sg.userData.home = V3(0, 0, 0);
      const ob = mk(new T3.CylinderGeometry(rt, rb, y1 - y0, 4, 1), mats.obel, sg, 0, (y0 + y1) / 2, 0); ob.rotation.y = PI / 4;
      // collar above each segment
      const co = mk(new T3.CylinderGeometry(rt + 0.08, rt + 0.1, 0.1, 4), mats.brassD, sg, 0, y1 + 0.05, 0); co.rotation.y = PI / 4;
      // corner inlay rails (cyan)
      for (let k = 0; k < 4; k++) {
        const a = k * PI / 2, r = (rb + rt) / 2 + 0.005;
        const rail = mk(new T3.BoxGeometry(0.03, y1 - y0 - 0.12, 0.03), mats.rail, sg, Math.cos(a) * r, (y0 + y1) / 2, -Math.sin(a) * r);
        rail.rotation.y = a;
      }
    }
    const topY = SEG[2][1] + 0.1;
    // pyramidion
    const pyr = mk(new T3.CylinderGeometry(0.02, 0.44, 0.5, 4), mats.brass, segs[2], 0, topY + 0.25, 0); pyr.rotation.y = PI / 4;
    // gnomon crest blade (leans forward, its front edge glows)
    const cs = new T3.Shape();
    const CP = [[-0.5, 0], [0.38, 0], [1.2, 1.48], [0.55, 1.9]];
    cs.moveTo(CP[0][0], CP[0][1]); for (let i = 1; i < CP.length; i++) cs.lineTo(CP[i][0], CP[i][1]); cs.closePath();
    const cg = new T3.ExtrudeGeometry(cs, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }); cg.translate(0, 0, -0.05);
    const crest = new T3.Group(); crest.position.y = topY + 0.3; segs[2].add(crest); D.crest = crest;
    mk(cg, mats.brass, crest);
    const edge = (a, c, w = 0.05) => {
      const A = V3(a[0], a[1], 0), C = V3(c[0], c[1], 0), len = A.distanceTo(C);
      const m = mk(new T3.BoxGeometry(len, w, 0.16), mats.cyan, crest, (A.x + C.x) / 2, (A.y + C.y) / 2, 0);
      m.rotation.z = Math.atan2(C.y - A.y, C.x - A.x); return m;
    };
    edge(CP[1], CP[2]); edge(CP[2], CP[3], 0.035);
    D.tip = new T3.Object3D(); D.tip.position.set(CP[2][0], CP[2][1], 0); crest.add(D.tip);
    D.tipGlow = G.mat.glowSprite(ACC, 1.2, { opacity: 0.9 }); D.tipGlow.position.copy(D.tip.position); crest.add(D.tipGlow);
    // face: dark visor with a glowing slit on the front (+x) of the top segment
    const fy = SEG[2][0] + 0.55, fhw = 0.46 * Math.SQRT1_2;
    mk(new T3.BoxGeometry(0.06, 0.42, 0.58), mats.dark, segs[2], fhw + 0.02, fy, 0);
    D.eyeMat = G.mat.emissive(ACC, 3.0);
    D.eye = mk(new T3.BoxGeometry(0.05, 0.07, 0.46), D.eyeMat, segs[2], fhw + 0.06, fy + 0.04, 0);
    D.eyeGlow = G.mat.glowSprite(ACC, 1.3, { opacity: 0.8 }); D.eyeGlow.position.set(fhw + 0.15, fy + 0.04, 0); segs[2].add(D.eyeGlow);
    // keyhole weak point on the back (-x) of the middle segment
    const ky = 1.75, khw = 0.54 * Math.SQRT1_2;
    const kh = new T3.Group(); kh.position.set(-khw - 0.02, ky, 0); kh.rotation.y = -PI / 2; segs[1].add(kh); D.keyhole = kh;
    mk(new T3.CircleGeometry(0.36, 32), mats.dark, kh, 0, 0, -0.005);
    D.keyRingMat = G.mat.emissive(ACC, 2.2);
    mk(new T3.RingGeometry(0.3, 0.36, 40), D.keyRingMat, kh, 0, 0, 0.002);
    D.keyMat = G.mat.emissive('#eafcff', 2.4);
    mk(new T3.CircleGeometry(0.11, 24), D.keyMat, kh, 0, 0.08, 0.004);
    const ks = new T3.Shape(); ks.moveTo(-0.05, 0.06); ks.lineTo(-0.1, -0.2); ks.lineTo(0.1, -0.2); ks.lineTo(0.05, 0.06); ks.closePath();
    mk(new T3.ShapeGeometry(ks), D.keyMat, kh, 0, 0, 0.004);
    D.keyGlow = G.mat.glowSprite('#bff4ff', 1.6, { opacity: 0.7 }); D.keyGlow.position.set(0, 0, 0.1); kh.add(D.keyGlow);
    // pauldrons
    D.pauldrons = [];
    for (const s of [-1, 1]) {
      const pg = new T3.Group(); pg.position.set(0, SEG[2][0] - 0.02, s * 0.6); pg.rotation.x = s * 0.55; segs[1].add(pg);
      const dome = mk(new T3.SphereGeometry(0.46, 20, 10, 0, TAU, 0, PI / 2), mats.brass, pg); dome.scale.set(1.05, 0.62, 1.15);
      mk(new T3.TorusGeometry(0.46, 0.03, 6, 40), mats.cyan, pg, 0, 0.01, 0).rotation.x = PI / 2;
      const spike = mk(new T3.ConeGeometry(0.08, 0.42, 4), mats.brassD, pg, 0, 0.42, 0);
      D.pauldrons.push(pg); pg.userData.spike = spike;
    }
    // gauntlets (float free of the body)
    D.hands = [];
    for (const s of [-1, 1]) {
      const g = new T3.Group(); body.add(g);
      const cuff = mk(new T3.CylinderGeometry(0.19, 0.25, 0.36, 8), mats.dark, g, 0, -0.4, 0);
      mk(new T3.TorusGeometry(0.23, 0.028, 6, 24), mats.cyan, cuff, 0, 0.12, 0).rotation.x = PI / 2;
      mk(new T3.TorusGeometry(0.255, 0.035, 6, 24), mats.brass, cuff, 0, -0.16, 0).rotation.x = PI / 2;
      mk(new T3.BoxGeometry(0.42, 0.42, 0.22), mats.brass, g, 0, 0, 0);
      mk(new T3.BoxGeometry(0.3, 0.3, 0.24), mats.brassD, g, 0, -0.02, 0);
      for (let k = 0; k < 4; k++) {
        const f1 = new T3.Group(); f1.position.set(-0.15 + k * 0.1, 0.2, 0); f1.rotation.z = (k - 1.5) * 0.05; g.add(f1);
        mk(new T3.BoxGeometry(0.085, 0.2, 0.1), mats.brass, f1, 0, 0.1, 0);
        const f2 = new T3.Group(); f2.position.y = 0.21; f2.rotation.x = s * 0.35; f1.add(f2);
        mk(new T3.BoxGeometry(0.075, 0.17, 0.09), mats.brassD, f2, 0, 0.08, 0);
      }
      const th = mk(new T3.BoxGeometry(0.09, 0.22, 0.1), mats.brass, g, 0.24, 0.04, 0); th.rotation.z = -0.8;
      mk(new T3.OctahedronGeometry(0.075, 0), mats.cyan, g, 0, 0.02, s * 0.115);
      const gl = G.mat.glowSprite(ACC, 0.8, { opacity: 0.5 }); gl.position.set(0, 0.02, s * 0.14); g.add(gl);
      g.userData.s = s; D.hands.push(g);
    }
    // the gnomon sword, held point-down in the right gauntlet; raised for Hour Strikes, planted for back windows
    {
      const sw = new T3.Group(); D.hands[1].add(sw); D.sword = sw;
      mk(new T3.CylinderGeometry(0.05, 0.055, 0.42, 8), mats.dark, sw, 0, 0.08, 0);
      mk(new T3.SphereGeometry(0.085, 12, 8), mats.cyan, sw, 0, 0.32, 0);
      const guard = mk(new T3.BoxGeometry(0.66, 0.09, 0.16), mats.brass, sw, 0, -0.17, 0);
      mk(new T3.OctahedronGeometry(0.07, 0), mats.white, guard, 0, 0, 0.08);
      const bs = new T3.Shape();
      bs.moveTo(-0.14, 0); bs.lineTo(0.22, 0); bs.lineTo(0.04, -2.05); bs.lineTo(-0.05, -1.72); bs.closePath();
      const bgeo = new T3.ExtrudeGeometry(bs, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }); bgeo.translate(0, -0.2, -0.03);
      mk(bgeo, mats.brass, sw);
      const A = V3(0.22, -0.2, 0), C = V3(0.04, -2.25, 0), len = A.distanceTo(C);
      const e = mk(new T3.BoxGeometry(0.035, len, 0.1), mats.cyan, sw, (A.x + C.x) / 2, (A.y + C.y) / 2, 0); e.rotation.z = Math.atan2(C.x - A.x, -(C.y - A.y)) * -1;
      for (let k = 0; k < 5; k++) mk(new T3.BoxGeometry(0.12, 0.025, 0.1), mats.cyan, sw, 0.0 - k * 0.012, -0.45 - k * 0.3, 0);
      D.swordTip = new T3.Object3D(); D.swordTip.position.set(0.04, -2.25, 0); sw.add(D.swordTip);
      D.swordGlow = G.mat.glowSprite(ACC, 1.0, { opacity: 0.0 }); D.swordGlow.position.copy(D.swordTip.position); sw.add(D.swordGlow);
    }
    // armillary hoops (gimbal around the torso in P1; detached orbits in P2-P3)
    D.hoops = [];
    const HR = [1.42, 1.68, 1.94];
    for (let i = 0; i < 3; i++) {
      const orient = new T3.Group(); orient.rotation.order = 'YXZ'; orient.position.y = 2.75; body.add(orient);
      const spin = new T3.Group(); orient.add(spin);
      mk(new T3.TorusGeometry(HR[i], 0.055, 8, 120), mats.brass, spin);
      mk(new T3.TorusGeometry(HR[i] - 0.06, 0.016, 5, 120), mats.cyan, spin);
      // engraved ticks
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * TAU;
        const tk = mk(new T3.BoxGeometry(0.15, 0.035, 0.15), mats.brassD, spin, Math.cos(a) * HR[i], Math.sin(a) * HR[i], 0);
        tk.rotation.z = a;
      }
      const bead = mk(new T3.SphereGeometry(0.1, 12, 8), mats.white, spin, HR[i], 0, 0);
      const bg = G.mat.glowSprite(ACC, 0.8, { opacity: 0.8 }); bg.position.copy(bead.position); spin.add(bg);
      D.hoops.push({ orient, spin, R: HR[i], tilt: [[0.35, 0.0], [-0.4, 0.6], [0.95, -0.35]][i], yaw: i * 2.1, bead, bg, bgS: bg.scale.x, visible: 1 });
    }
    // ice crystals (grow in P3)
    D.ice = new T3.Group(); body.add(D.ice); D.iceK = 0;
    const iceGeo = new T3.ConeGeometry(0.09, 0.5, 5);
    const icePts = [[0, 4.95, 0.62, 0.9, 0.6], [0, 4.95, -0.62, -0.9, 0.6], [0.1, 5.05, 0.75, 0.5, 0.45], [0.1, 5.05, -0.75, -0.5, 0.45],
      [-0.3, 5.5, 0.1, 0.2, 0.7], [-0.25, 5.4, -0.12, -0.25, 0.55], [0.55, 3.55, 0.4, 0.6, 0.4], [0.55, 3.55, -0.4, -0.6, 0.4],
      [-0.5, 2.45, 0.45, 0.8, 0.5], [-0.5, 2.45, -0.45, -0.8, 0.5], [0.6, 2.45, 0.2, 0.3, 0.35], [0.0, 1.05, 0.85, 1.2, 0.4], [0.0, 1.05, -0.85, -1.2, 0.4], [-0.85, 1.05, 0, 0, 0.4]];
    for (const [x, y, z, rz, s] of icePts) {
      const c = mk(iceGeo, mats.ice, D.ice, x, y, z); c.rotation.set(rz * 0.3, 0, rz * 0.8); c.userData.s = s * 2.0; c.scale.setScalar(0.001);
    }
    // cast column (casts), hidden until used
    const colG = new T3.CylinderGeometry(0.9, 1.3, 16, 24, 1, true); colG.translate(0, 8, 0);
    D.column = mk(colG, columnMaterial(GOLD_HOT), root, 0, 0.5, 0); D.column.visible = false; D.column.frustumCulled = false; D.column.renderOrder = 9;

    // runtime state
    Object.assign(D, {
      t: 0, look: -1, hoopK: 0, hoopKT: 0, sunMode: 0, sunK: 0, iceKT: 0, introK: 0, frost: 0, frostT: 0,
      pose: { raise: 0, slam: 0, bow: 0, rear: 0, cast: 0, plant: 0 }, poseT: { raise: 0, slam: 0, bow: 0, rear: 0, cast: 0, plant: 0 }, twist: 0, twistT: 0,
      warnMul: 1, turn: 0.4, emp: 0, faceLock: false, faceFn: null, faceTarget: null, quickRate: 0, death: null, hoopFly: null, snow: null,
      shake: 0, said: {},
    });
    b.root.position.y = 0;
  }

  // ================================================================ ANIMATION (every frame, every state)
  const tmpV = new T3.Vector3(), tmpV2 = new T3.Vector3();
  const SUNS = [
    // pos = [distance behind the Warden (away from the play camera), height, sideways]: the sun always hangs
    // over the far side of the arena, never between the camera and the rings (on phones a sun parked in a fixed
    // direction ended up projected over the play field)
    { pos: [3.2, 10.6, 0], col: GOLD, core: GOLD_HOT, glow: 3.0, rays: 0.4, moon: 0 },
    { pos: [6.0, 6.4, -3.2], col: DUSK, core: '#ffd6a0', glow: 4.2, rays: 0.6, moon: 0 },
    { pos: [4.4, 9.8, 2.6], col: '#9fe9ff', core: ICE, glow: 2.8, rays: 0.12, moon: 1 },
    { pos: [2.0, 12.5, 0], col: GOLD, core: '#fff8e0', glow: 6.0, rays: 0.9, moon: 0 },   // dawn (death)
  ];
  // SUNS entry -> position in b.root's local space
  function sunTarget(b, S0, out, bob) {
    let cx = 0, cz = 1;
    try { const pp = G.cam.playPose.pos; const l = Math.hypot(pp.x, pp.z); if (l > 1e-3) { cx = pp.x / l; cz = pp.z / l; } } catch (e) { /* default */ }
    const back = S0.pos[0], side = S0.pos[2];
    return out.set(-cx * back + cz * side, S0.pos[1] + bob, -cz * back - cx * side);   // play-local
  }
  function playToRoot(b, v, out) {
    out.copy(v);
    const pl = G.layers && G.layers.play;
    if (pl) pl.localToWorld(out);
    b.root.updateMatrixWorld(); return b.root.worldToLocal(out);
  }
  const cA = new T3.Color(), cB = new T3.Color();
  function animate(b, dt) {
    const D = b.data; if (!D.U) return;
    D.t += dt;
    const t = D.t, U = D.U, ps = PS();
    U.uT.value = t;
    U.uHit.value = Math.max(U.uHit.value * Math.exp(-dt * 9), (b.hitFlash || 0) * 0.12);
    // intro: the Warden assembles
    if (G.state === 'intro') D.introK = Math.min(1, D.introK + dt / 2.2); else D.introK = Math.min(1, D.introK + dt * 2);
    const ik = sm(D.introK);
    // pose springs
    for (const k in D.pose) D.pose[k] = damp(D.pose[k], D.poseT[k], k === 'slam' || k === 'plant' ? 9 : k === 'bow' ? 5.5 : 6, dt);
    D.twist = damp(D.twist, D.twistT, 10, dt);
    const ps0 = D.pose, staggered = b.staggered;
    const bob = Math.sin(t * 1.3) * 0.07;
    D.body.position.y = -0.2 + bob - 0.35 * ps0.bow + (1 - ik) * -1.6;
    D.upper.rotation.z = -0.62 * ps0.bow + 0.22 * ps0.rear + (staggered ? Math.sin(t * 22) * 0.025 : 0);
    D.upper.rotation.y = D.twist;
    D.upper.rotation.x = Math.sin(t * 0.7) * 0.02;
    // skirt breathing
    D.skirt.forEach((p, i) => { p.rotation.z = 0.18 + 0.06 * Math.sin(t * 2.1 + i * 0.8) + 0.25 * ps0.rear; });
    // crest sway
    D.crest.rotation.z = Math.sin(t * 0.9) * 0.04 - 0.1 * ps0.cast;
    // gauntlets
    for (const g of D.hands) {
      const s = g.userData.s, ph = t * 1.6 + (s > 0 ? 0 : 1.7);
      const bx = 0.35, by = 2.3 + Math.sin(ph) * 0.12, bz = s * 2.3;
      const wr = ps0.raise, wsl = ps0.slam * (1 - ps0.plant), wpl = ps0.plant, wre = ps0.rear * (1 - wr) * (1 - wpl);
      let x, y, z, rx, rz;
      if (s > 0) {          // right gauntlet carries the sword
        x = bx + (0.3 - bx) * wr + (2.0 - bx) * wsl + (2.1 - bx) * wpl + (-0.4 - bx) * wre;
        y = by + (4.4 - by) * wr + (2.4 - by) * wsl + (2.05 - by) * wpl + (3.3 - by) * wre;
        z = bz + (1.6 - bz) * wr + (0.55 - bz) * wsl + (0.3 - bz) * wpl + (2.7 - bz) * wre;
        rx = 0.2 * wr; rz = PI * 0.94 * wr - 0.3 * wsl - 0.12 * wpl + 0.2 * wre;
      } else {
        x = bx + (0.15 - bx) * wr + (1.95 - bx) * wsl + (1.85 - bx) * wpl + (-0.4 - bx) * wre;
        y = by + (4.9 - by) * wr + (0.75 - by) * wsl + (2.45 - by) * wpl + (3.3 - by) * wre;
        z = bz + (-1.25 - bz) * wr + (-1.05 - bz) * wsl + (-0.25 - bz) * wpl + (-2.7 - bz) * wre;
        rx = -0.45 * wr; rz = 0.35 * wr - 1.25 * wsl - 0.4 * wpl;
      }
      g.position.set(x, y - 0.25 * ps0.bow + (1 - ik) * -2, z);
      g.rotation.set(rx, 0, rz + Math.sin(ph * 0.7) * 0.05 * (1 - wpl));
    }
    if (D.swordGlow) D.swordGlow.material.opacity = damp(D.swordGlow.material.opacity, 0.2 + 0.7 * Math.max(ps0.raise, ps0.plant), 6, dt);
    // hoops: gimbal (k=0) <-> detached orbit (k=1), plus the P1->P2 fly-out flourish
    D.hoopK = damp(D.hoopK, D.hoopKT, 2.2, dt);
    const hk = sm(D.hoopK), emp = D.emp > 0 ? 1 : 0;
    D.hoopEmp = damp(D.hoopEmp || 0, emp, 4, dt);
    let fly = 0, flyE = 0;
    if (D.hoopFly) { D.hoopFly.t += dt; fly = clamp(D.hoopFly.t / D.hoopFly.dur, 0, 1); flyE = Math.sin(PI * sm(fly)); if (fly >= 1) D.hoopFly = null; }
    D.hoops.forEach((h, i) => {
      h.yaw += dt * (0.35 + i * 0.12) * (1 + 2.5 * D.hoopEmp) * (1 - hk * 0.6);
      h.spin.rotation.z += dt * (0.8 + i * 0.35) * (i % 2 ? -1 : 1) * (1 + 2 * D.hoopEmp);
      const gx = h.tilt[0] + Math.sin(t * 0.5 + i) * 0.08, gz = h.tilt[1];
      const ox = PI / 2 + Math.sin(t * 0.6 + i * 2.1) * (0.1 + 0.05 * i), oz = Math.cos(t * 0.45 + i) * 0.08;
      h.orient.rotation.set(lerp(gx, ox, hk), h.yaw, lerp(gz, oz, hk));
      const orbitS = (2.0 + i * 0.36) / h.R;
      let sc = lerp(1, orbitS, hk), y = lerp(2.75, 1.4 + i * 0.35, hk);
      if (flyE > 0) {
        const ringS = (RING(i) + 0.05) / (h.R * BODY_S);
        sc = lerp(sc, ringS, flyE); y = lerp(y, 0.75, flyE);
        h.orient.rotation.x = lerp(h.orient.rotation.x, PI / 2, flyE); h.orient.rotation.z = lerp(h.orient.rotation.z, 0, flyE);
      }
      h.orient.scale.setScalar(sc * (0.2 + 0.8 * ik)); h.orient.position.y = y - (1 - ik) * 1.5;
      // keep the bead a bead when the hoop is scaled out to the rings (else it blooms into a white planet)
      const inv = 1 / Math.max(1, sc); h.bead.scale.setScalar(inv); h.bg.scale.setScalar(h.bgS * inv);
      h.orient.visible = h.visible > 0.01;
    });
    // glow / casting
    const casting = b.casting;
    const castP = casting ? casting.progress : 0;
    U.uGlow.value = damp(U.uGlow.value, (0.8 + 0.6 * ps0.cast + 0.5 * D.hoopEmp + 0.4 * castP) * (staggered ? 0.45 + 0.4 * Math.abs(Math.sin(t * 13)) : 1) * ik, 6, dt);
    U.uScan.value = 0.4 + castP * 1.4 + D.hoopEmp * 0.6;
    U.uRim.value = 0.28 + 0.2 * D.frost + 0.3 * castP;
    const eyeI = staggered ? (Math.sin(t * 30) > 0 ? 0.6 : 2.0) : 2.6 + 1.6 * castP + 1.2 * D.hoopEmp;
    D.eyeMat.color.set(D.frost > 0.5 ? ICE : ACC).multiplyScalar(eyeI * ik);
    D.eyeGlow.material.opacity = 0.5 + 0.4 * castP;
    // keyhole: brighter while the hero stands behind (and while staggered)
    const behind = !!(ps && ps.behind && b.alive);
    D.keyK = damp(D.keyK || 0, behind ? 1 : 0, 6, dt);
    D.keyMat.color.set('#eafcff').multiplyScalar(1.6 + 2.2 * D.keyK + (staggered ? 1.5 * Math.abs(Math.sin(t * 8)) : 0));
    D.keyGlow.material.opacity = 0.45 + 0.5 * D.keyK;
    D.keyGlow.scale.setScalar(1.4 + 0.9 * D.keyK + 0.15 * Math.sin(t * 5));
    // shadow hand
    D.handLen = damp(D.handLen, D.handLenT, 3.5, dt);
    D.hand.scale.set(D.handLen, 1, 0.9 + 0.12 * Math.min(2, D.handLen - 1));
    U.uHandA.value = (0.85 + 0.15 * Math.sin(t * 1.7)) * ik * (D.death ? 1 - clamp(D.death.t / 3, 0, 1) : 1);
    U.uHandFlow.value = damp(U.uHandFlow.value, clamp((D.handLen - 1) / 2.4, 0, 1) + castP * 0.4, 4, dt);
    // sun / moon
    const S0 = SUNS[clamp(D.sunMode | 0, 0, 3)];
    if (!D.sunW) D.sunW = sunTarget(b, S0, new T3.Vector3(), 0);
    D.sunW.lerp(sunTarget(b, S0, tmpV, Math.sin(t * 0.8) * 0.15), 1 - Math.exp(-dt * 1.6));
    playToRoot(b, D.sunW, D.sun.position);
    cA.set(S0.col); D.sunCol.lerp(cA, 1 - Math.exp(-dt * 1.4));
    D.sunGlow.material.color.copy(D.sunCol);
    D.sunRays.material.color.copy(D.sunCol).multiplyScalar(1.4);
    cB.set(S0.core); D.sunCore.material.color.lerp(cB.multiplyScalar(2.4), 1 - Math.exp(-dt * 1.4));
    D.sunGlow.scale.setScalar(damp(D.sunGlow.scale.x, S0.glow * (1 + 0.35 * castP), 2, dt));
    D.sunRays.material.opacity = damp(D.sunRays.material.opacity, S0.rays * (1 + castP), 2, dt);
    D.sunRays.material.rotation += dt * 0.15;
    D.moonRing.material.opacity = damp(D.moonRing.material.opacity, S0.moon * 0.9, 2, dt);
    D.moonRing.rotation.z += dt * 0.4;
    if (G.camera) { D.moonRing.lookAt(G.camera.position); }
    D.sun.visible = ik > 0.05;
    // hover ring
    D.hover.scale.setScalar(1 + 0.04 * Math.sin(t * 3));
    D.hoverGlow.material.opacity = (0.35 + 0.15 * Math.sin(t * 2.4)) * ik;
    // frost (P3) and ice crystals
    D.frost = damp(D.frost, D.frostT, 1.2, dt); U.uFrost.value = D.frost;
    D.iceK = damp(D.iceK, D.iceKT, 1.6, dt);
    D.ice.visible = D.iceK > 0.01;
    if (D.ice.visible) D.ice.children.forEach((c, i) => { const k = clamp(D.iceK * 1.4 - i * 0.03, 0, 1); c.scale.setScalar(Math.max(0.001, sm(k) * c.userData.s)); });
    U.uHandCol.value.set(D.frost > 0.5 ? '#9fefff' : ACC);
    // cast column
    const colOn = casting && !casting.interruptible ? 0 : castP;
    const cm = D.column.material.uniforms;
    cm.uT.value = t; cm.uA.value = damp(cm.uA.value, (casting ? 0.25 + 0.75 * castP : 0) + (D.colBoost || 0), 5, dt);
    D.colBoost = Math.max(0, (D.colBoost || 0) - dt * 0.8);
    D.column.visible = cm.uA.value > 0.01;
    if (casting) cm.uC.value.set(casting.name === 'Solstice' ? ICE : casting.name === 'Vesper Bell' ? DUSK : GOLD_HOT);
    D.column.scale.set(0.6 + 0.6 * colOn, 1, 0.6 + 0.6 * colOn);
    // snow
    if (D.snow) updateSnow(D, dt);
    // death choreography
    if (D.death) animateDeath(b, D, dt);
    // keep the fade-relevant "faded" materials of ShaderMaterials in sync (hand is outside b.model; nothing to do)
  }

  // snowfall in P3 (visual only, Math.random)
  function makeSnow(D) {
    if (D.snow) return;
    const N = (G.quality && G.quality.tier === 'low') ? 260 : 520;
    const pos = new Float32Array(N * 3), vel = new Float32Array(N);
    for (let i = 0; i < N; i++) { const r = Math.sqrt(Math.random()) * 15, a = Math.random() * TAU; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = Math.sin(a) * r; vel[i] = 0.6 + Math.random() * 0.9; }
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.BufferAttribute(pos, 3).setUsage(T3.DynamicDrawUsage));
    const m = new T3.PointsMaterial({ map: G.tex.dot, color: new T3.Color(ICE).multiplyScalar(1.4), size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0, blending: T3.AdditiveBlending, depthWrite: false, toneMapped: false });
    const pts = new T3.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 12; pts.name = 'gnomonSnow';
    ((G.layers && G.layers.fx) || G.scene).add(pts);
    D.snow = { pts, vel, N, a: 0, aT: 1 };
  }
  function removeSnow(D) {
    if (!D || !D.snow) return;
    const s = D.snow; D.snow = null;
    if (s.pts.parent) s.pts.parent.remove(s.pts);
    s.pts.geometry.dispose(); s.pts.material.dispose();
  }
  function updateSnow(D, dt) {
    const s = D.snow, p = s.pts.geometry.attributes.position.array;
    s.a = damp(s.a, s.aT, 1.2, dt); s.pts.material.opacity = s.a * 0.85;
    const t = D.t;
    for (let i = 0; i < s.N; i++) {
      p[i * 3 + 1] -= s.vel[i] * dt;
      p[i * 3] += Math.sin(t * 0.7 + i) * 0.3 * dt;
      p[i * 3 + 2] += Math.cos(t * 0.5 + i * 1.3) * 0.3 * dt;
      if (p[i * 3 + 1] < 0) { const r = Math.sqrt(Math.random()) * 15, a = Math.random() * TAU; p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = 10 + Math.random() * 3; p[i * 3 + 2] = Math.sin(a) * r; }
    }
    s.pts.geometry.attributes.position.needsUpdate = true;
    if (s.aT === 0 && s.a < 0.01) removeSnow(D);
  }

  // ================================================================ PHASE LOOKS (persistent visual state per phase)
  function applyLook(b, i, instant) {
    const D = b.data;
    D.look = i;
    D.hoopKT = i >= 1 ? 1 : 0;
    D.sunMode = i;
    D.iceKT = i >= 2 ? 1 : 0;
    D.frostT = i >= 2 ? 1 : 0;
    D.handLenT = i === 1 ? 1.3 : 1;
    D.hoops.forEach(h => { h.visible = 1; });
    if (instant) {
      D.hoopK = D.hoopKT; D.iceK = D.iceKT; D.frost = D.frostT; D.handLen = D.handLenT;
      D.sunW = sunTarget(b, SUNS[i], new T3.Vector3(), 0); D.sunCol.set(SUNS[i].col);
    }
    if (i >= 2) { makeSnow(D); D.snow.aT = 1; world('setRingRime', 1); }
    else if (D.snow) D.snow.aT = 0;
    // colour grade: dusk warms the highlights, midnight goes cold
    if (i === 1) post('setGrade', [0.82, 0.8, 1.12], [1.16, 1.0, 0.82]);
    if (i === 2) { post('setGrade', [0.62, 0.76, 1.06], [0.9, 0.97, 1.02]); post('setVignette', 0.46); }
  }

  // ================================================================ COMBAT HELPERS
  // warn/dur multipliers for the next attack; consumes one charge of the Zenith empower
  function takeK(b) {
    const D = b.data;
    let m = D.warnMul || 1;
    if (D.emp > 0) { m *= 0.7; D.emp--; }
    return {
      m,
      warn: (w) => Math.max(0.9, w * m),
      warnL: (w) => Math.max(2.6, w * m),        // lethal tier never drops below 2.6 s
      dur: (d) => Math.max(0.6 * d, d * (0.6 + 0.4 * m)),
    };
  }
  const adjRing = (b, r) => (r === 0 ? 1 : r === 2 ? 1 : (b.rand() < 0.5 ? 0 : 2));
  function lockFacing(b, fnOrTheta) {
    const D = b.data; D.faceLock = true;
    D.faceFn = typeof fnOrTheta === 'function' ? fnOrTheta : (fnOrTheta != null ? () => fnOrTheta : null);
  }
  function unlockFacing(b) { const D = b.data; D.faceLock = false; D.faceFn = null; D.faceTarget = null; D.quickRate = 0; }
  function quickTurn(b, theta, rate) { const D = b.data; D.faceLock = false; D.faceFn = null; D.faceTarget = theta; D.quickRate = rate; }
  function faceUpdate(b, dt) {
    const D = b.data;
    if (D.faceLock) {
      b.trackPlayer = false; b.facingTarget = null; b.turnRate = 0;
      if (D.faceFn) { try { b.setFacing(D.faceFn()); } catch (e) { logE('faceFn', e); D.faceFn = null; } }
      return;
    }
    b.trackPlayer = true;
    b.facingTarget = D.faceTarget;
    b.turnRate = D.faceTarget != null && D.quickRate ? D.quickRate : (b.staggered ? 0.06 : D.turn);
    if (D.faceTarget != null && Math.abs(angDiff(D.faceTarget, b.facing)) < 0.02) { /* reached: hold until released */ }
  }
  function swordTip(b) {
    const D = b.data;
    D.swordTip.getWorldPosition(tmpV2);
    const pl = G.layers && G.layers.play; if (pl) pl.worldToLocal(tmpV2);
    return tmpV2.clone();
  }
  function crestTip(b) {
    const D = b.data;
    D.tip.getWorldPosition(tmpV2);
    const pl = G.layers && G.layers.play; if (pl) pl.worldToLocal(tmpV2);
    return tmpV2.clone();
  }
  function phaseUpdate(b, dt) {
    faceUpdate(b, dt);
    const D = b.data;
    // tension: last 10% of HP pushes the music to the top layer
    if (b.phase === 2 && !D.said.low && b.hp / b.maxHp < 0.1) { D.said.low = 1; b.say('The dial... cannot... stop...', 2.6); }
  }

  // ================================================================ ATTACKS
  // Meridian Sweep: the shadow-hand sweeps 250-290 deg across two rings. The wedge left uncovered sits just
  // behind the hero (reverse into it), and the third ring is never swept (shift to it).
  async function meridian(b, o = {}) {
    const D = b.data, k = takeK(b);
    const hr = b.playerRing(), d = b.playerDir(), th = b.playerTheta();
    const rings = o.rings || [hr, adjRing(b, hr)];
    const span = b.randRange(4.35, 5.05), wedge = TAU - span;
    const U = th - d * b.randRange(0.85, 1.2);
    const s = b.rand() < 0.5 ? d : -d;
    const from = s === d ? U + d * wedge / 2 : U - d * wedge / 2;
    const to = from + s * span;
    const warn = k.warn(o.warn || 2.2), dur = k.dur(o.dur || 2.7);
    quickTurn(b, from, 4.0);
    D.handLenT = 2.4; D.poseT.rear = 0.5; D.twistT = -0.35 * s;
    const h = b.hz.sweep({ rings, from, to, warn, dur, width: 0.24, dmg: 26, label: 'Meridian Sweep' });
    await b.wait(Math.max(0.3, warn - 0.35));
    lockFacing(b, () => h.hazard.beamAt(h.hazard.lt));
    D.poseT.rear = 0; D.twistT = 0.25 * s;
    await h;
    D.twistT = 0; D.handLenT = D.look === 1 ? 1.3 : 1;
    unlockFacing(b);
  }

  // Hour Strike: bolts chime down on 3-4 spots of the hero's ring ahead of them, in the order the hero would
  // reach them. Then (optionally) the Warden plants its crest blade where the last bolt fell: a back window.
  async function hourStrike(b, o = {}) {
    const D = b.data, k = takeK(b);
    const volleys = o.volleys || 1;
    D.poseT.raise = 1; D.poseT.cast = 0.6;
    await b.wait(0.3);
    let last = b.playerTheta();
    for (let v = 0; v < volleys; v++) {
      const r = b.playerRing();
      const n = v === 0 ? (o.n || (3 + (b.rand() < 0.5 ? 1 : 0))) : 3;
      const from = o.sky ? null : swordTip(b);
      let maxW = 0;
      for (let i = 0; i < n; i++) {
        const w = k.warn((v === 0 ? 1.45 : 1.25) + i * 0.55);
        const th = b.playerAhead(w);
        last = th; maxW = Math.max(maxW, w);
        const src = from || G.polar(RING(r) * 0.4, th + 0.6, 22);
        b.hz.bolt({ from: src, ring: r, theta: th, warn: w, radius: 1.05, dmg: 22, label: 'Hour Strike' });
        if (o.sky) world('meteor', '#d8f6ff');
      }
      // the hour strikes twice: the echo volley aims at wherever the hero went
      await b.wait(v + 1 < volleys ? 1.35 : Math.max(0.4, maxW - 0.8));
    }
    D.poseT.raise = 0; D.poseT.cast = 0;
    await b.wait(0.85);
    if (o.plant !== false) await plant(b, last, o.plantDur || 3.2);
  }
  // Falling Hours (P2+): three radial lines of meteors land across every ring where the hero is heading.
  // Shifting does not help: reverse, halt, or reverse again.
  async function fallingHours(b, o = {}) {
    const D = b.data, k = takeK(b);
    D.poseT.raise = 1; D.poseT.cast = 0.8;
    if (!D.said.fall) { D.said.fall = 1; b.say('The hours fall across every ring: turn back!', 2.4); }
    const lines = o.lines || 3;
    for (let j = 0; j < lines; j++) {
      const w = k.warn(j === 0 ? 1.8 : 1.6);
      const th = b.playerAhead(w);
      for (let r = 0; r < 3; r++) b.hz.bolt({ from: G.polar(4, th + 0.5, 24), ring: r, theta: th, warn: w + r * 0.06, radius: 1.1, dmg: 22, label: 'Falling Hours' });
      world('meteor', '#d8f6ff');
      await b.wait(1.05);
    }
    D.poseT.raise = 0; D.poseT.cast = 0;
    await b.wait(1.2);
  }
  // filler: while the Warden is otherwise free, it cleaves whoever stands in front on the inner rings, or
  // ticks a single bolt onto the hero's path. Never during a lethal-tier attack or a locked pose.
  function fillerLoop(b, every) {
    const D = b.data;
    b.loop(async () => {
      await b.wait(b.randRange(every[0], every[1]));
      if (D.heavy || D.quiet || D.faceTarget != null || !b.alive) return;
      const ps = PS(); if (!ps || !ps.alive) return;
      const front = Math.abs(angDiff(ps.theta, b.facing)) < 0.75;
      if (front && ps.ring <= 1 && !D.faceLock && !D.cutting) { D.cutting = true; try { await shadowCut(b, { free: true }); } finally { D.cutting = false; } return; }
      const w = (b.phase >= 2 ? 1.1 : 1.2) * (D.warnMul || 1);
      const th = b.playerAhead(w), src = crestTip(b);
      b.hz.bolt({ from: src, ring: ps.ring, theta: th, warn: w, radius: 1.0, dmg: 15, label: 'Hour Tick' });
      // from Dusk on, the tick is doubled onto a neighbouring ring so a blind shift is punished too
      if (b.phase >= 1 && b.rand() < 0.6) b.hz.bolt({ from: src, ring: adjRing(b, ps.ring), theta: th, warn: w + 0.15, radius: 1.0, dmg: 15, label: 'Hour Tick' });
      // and at Midnight a frost orb sometimes runs at the hero
      if (b.phase >= 2 && b.rand() < 0.35) { const dd = b.playerDir(); b.hz.orb({ ring: ps.ring, theta: ps.theta + dd * 2.6, omega: -dd * 0.45, life: 7, radius: 0.55, dmg: 15, label: 'Frost Orb', color: '#9fefff' }); }
      fx('spark', src, ACC);
    });
  }

  // the crest blade stabs into the floor toward theta; facing stays locked: walk round to the keyhole
  async function plant(b, theta, dur) {
    const D = b.data;
    quickTurn(b, theta, 5.0);
    await b.wait(0.35);
    lockFacing(b, theta);
    if (b.phase === 0) D.quiet = true;
    D.poseT.bow = 0.4; D.poseT.plant = 1;
    await b.wait(0.4);
    const p = swordTip(b); p.y = 0.1;
    fx('shockwave', p, { color: ACC, radius: 3.2, life: 0.5 });
    fx('burst', p, { color: ACC, count: 26, speed: 6, size: 0.5, life: 0.7 });
    fx('shards', p, { color: '#ffd27a', count: 12, speed: 4 });
    cam('shake', 0.45, 0.3); sfx('crack', { vol: 0.9 });
    if (!D.said.plant) { D.said.plant = 1; b.say('The blade is planted: strike the keyhole on its back!', 2.6); }
    await b.wait(Math.max(0.5, dur - 0.4));
    D.poseT.bow = 0; D.poseT.plant = 0; D.quiet = false;
    await b.wait(0.35);
    unlockFacing(b);
  }

  // Gnomon Pylons: blocking pylons drop (bolt telegraph) ahead of and behind the hero on their ring
  async function pylons(b, o = {}) {
    const D = b.data, k = takeK(b);
    const r = b.playerRing(), d = b.playerDir();
    const w = k.warn(1.5);
    const spots = [[r, b.playerAhead(w)], [r, b.playerTheta() - d * 2.1]];
    if (o.three) spots.push([adjRing(b, r), b.playerAhead(w + 0.6)]);
    if (o.ring != null) { spots.length = 0; spots.push([o.ring, b.playerAhead(w)], [o.ring, b.playerTheta() - d * 2.1]); }
    D.poseT.slam = 1;
    for (const [ring, th] of spots) b.hz.bolt({ from: G.polar(2.0, th, 9), ring, theta: th, warn: w, radius: 0.95, dmg: 18, label: 'Pylon Drop' });
    await b.wait(w);
    D.poseT.slam = 0;
    for (const [ring, th] of spots) {
      b.adds.spawn({
        ring, theta: th, omega: 0, hp: o.hp || 150, radius: 0.6, contactDmg: 20, blocks: true, label: 'Gnomon Pylon', color: ACC, barY: 2.6,
        model: pylonModel,
        update: (add, dt) => {
          if (add.data.ring) { add.data.ring.rotation.z += dt * 2.5; add.data.ring.position.y = 0.9 + Math.sin(add.t * 3) * 0.12; }
          if (add.t > (o.life || 16)) G.adds.kill(add, 'expire');
        },
      });
    }
    await b.wait(1.0);
  }

  // Equinox: one ring detonates (3 s warn, 60): get off it
  async function equinox(b, o = {}) {
    const D = b.data, k = takeK(b);
    const r = o.ring != null ? o.ring : b.playerRing();
    D.heavy = (D.heavy || 0) + 1;
    D.poseT.raise = 0.7; D.poseT.cast = 1;
    const warn = k.warnL(o.warn || 3.0);
    const h = b.hz.ring({ ring: r, warn, active: 0.45, dmg: 60, lethal: true, label: 'Equinox' });
    await b.wait(warn);
    D.poseT.raise = 0; D.poseT.slam = 1; D.poseT.cast = 0;
    fx('flash', ACC, 0.2, 0.3);
    await b.wait(0.4);
    D.poseT.slam = 0;
    try { await h; } finally { D.heavy = Math.max(0, D.heavy - 1); }
  }

  // Twin Equinox (P2+): the hero's ring and a neighbour detonate a moment apart. Two of three rings blow: be on the third.
  async function twinEquinox(b) {
    const D = b.data, k = takeK(b);
    const r = b.playerRing(), o2 = adjRing(b, r);
    D.heavy = (D.heavy || 0) + 1;
    D.poseT.raise = 1; D.poseT.cast = 1;
    if (!D.said.twin) { D.said.twin = 1; b.say('Twin Equinox: two rings will burst. Find the third!', 2.6); }
    const w1 = k.warnL(3.0), w2 = w1 + 0.5;
    const h1 = b.hz.ring({ ring: r, warn: w1, active: 0.45, dmg: 60, lethal: true, label: 'Equinox' });
    const h2 = b.hz.ring({ ring: o2, warn: w2, active: 0.45, dmg: 60, lethal: true, label: 'Equinox' });
    try {
      await b.wait(w1);
      D.poseT.raise = 0; D.poseT.slam = 1; D.poseT.cast = 0;
      await b.wait(0.5);
      fx('flash', ACC, 0.2, 0.3);
      D.poseT.slam = 0;
      await h1; await h2;
    } finally { D.heavy = Math.max(0, D.heavy - 1); }
  }

  // Shadow Cut: a quick frontal cleave across the inner two rings (where the Warden faces)
  async function shadowCut(b, o = {}) {
    const D = b.data, k = takeK(b);
    const c = b.facing;
    if (!o.free) lockFacing(b, c);
    D.twistT = -0.55; D.handLenT = 1.6;
    const warn = k.warn(1.5);
    const h = b.hz.arc({ rings: [0, 1], center: c, width: 1.15, warn, active: 0.25, dmg: 24, label: 'Shadow Cut' });
    await b.wait(warn);
    D.twistT = 0.7;
    await b.wait(0.35);
    D.twistT = 0; D.handLenT = D.look === 1 ? 1.3 : 1;
    await h;
    if (!o.free) { await b.wait(0.4); unlockFacing(b); }
  }

  // Shadow Grasp: the hand reaches across every ring toward the densest cluster of anchors (or the hero's path)
  // and smashes the anchors under it. Marked anchors glow a warning first; pulsing them before the slam is the play.
  async function grasp(b) {
    const D = b.data, k = takeK(b);
    const A = (G.player.anchors && G.player.anchors.list) || [];
    let th = b.playerAhead(2.4), best = 0;
    for (const a of A) { let n = 0; for (const c of A) if (Math.abs(angDiff(c.theta, a.theta)) < 0.55) n++; if (n > best) { best = n; th = a.theta; } }
    const half = 0.46;
    quickTurn(b, th, 3.2);
    await b.wait(0.45);
    lockFacing(b, th);
    const pred = (a) => Math.abs(angDiff(a.theta, th)) < half + 0.35 / RING(a.ring);
    try { G.player.anchors.mark(pred, true); } catch (e) { logE('mark', e); }
    D.handLenT = 3.5; D.poseT.slam = 0.6;
    const warn = k.warn(2.4);
    const h = b.hz.arc({ rings: [0, 1, 2], center: th, width: half * 2, warn, active: 0.3, dmg: 24, label: 'Shadow Grasp' });
    if (!D.said.grasp && A.length) { D.said.grasp = 1; b.say('The shadow reaches for your anchors: pulse them first!', 2.6); }
    await b.wait(warn);
    try { G.player.anchors.smash(pred); } catch (e) { logE('smash', e); }
    D.poseT.slam = 1;
    for (let r = 0; r < 3; r++) fx('burst', G.polar(RING(r), th, 0.3), { color: ACC, count: 10, speed: 5, size: 0.42, life: 0.6, flareSize: 1.3 });
    cam('shake', 0.4, 0.3);
    await b.wait(0.5);
    D.poseT.slam = 0; D.handLenT = D.look === 1 ? 1.3 : 1;
    await h;
    await b.wait(0.4);
    unlockFacing(b);
  }

  // Armillary Spin: the hoops drop onto two rings as rotating barrier arcs (rotor slices). Match their
  // speed, wait in a gap (Eclipse halt) or shift to the free ring. Hour Strikes from the sky join in.
  function attachArcs(h, ringIdx, mats) {
    const hz = h.hazard; if (!hz) return;
    const R = RING(ringIdx), arcs = [];
    for (const s of hz.slices) {
      const g = new T3.Group();
      const geo = new T3.TorusGeometry(R, 0.13, 6, 24, s.width); geo.rotateX(-PI / 2); geo.rotateY(-s.width / 2);
      const m = new T3.Mesh(geo, mats.brass); g.add(m);
      const geo2 = new T3.TorusGeometry(R, 0.045, 5, 24, s.width * 0.96); geo2.rotateX(-PI / 2); geo2.rotateY(-s.width * 0.48);
      const m2 = new T3.Mesh(geo2, mats.cyan); m2.position.y = 0.12; g.add(m2);
      g.userData.s = s; hz.group.add(g); arcs.push(g);
    }
    const v0 = hz.visual;
    hz.visual = (lt, dt) => {
      if (v0) v0(lt, dt);
      const drop = lt < hz.warn ? 1 - sm(lt / Math.max(0.01, hz.warn)) : 0;
      for (const g of arcs) { g.rotation.y = hz.sliceAt(g.userData.s, lt); g.position.y = 0.5 + drop * 4; g.rotation.z = drop * 0.4; }
    };
  }
  function arcMats(b) {
    // per-attack materials (disposed with the hazard group); transparent so the hazard fade works
    return {
      brass: new T3.MeshStandardMaterial({ color: 0xc99a45, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.3, emissive: 0x2a1a06, transparent: true, opacity: 1 }),
      cyan: G.mat.emissive(ACC, 2.4, { transparent: true, opacity: 1 }),
    };
  }
  async function armillary(b, o = {}) {
    const D = b.data, k = takeK(b);
    const hr = b.playerRing();
    let rings = o.rings;
    if (!rings) {
      const free = b.rand() < 0.3 ? hr : [0, 1, 2].filter(r => r !== hr)[b.rand() < 0.5 ? 0 : 1];
      rings = [0, 1, 2].filter(r => r !== free);
    }
    const om = (o.omega || 0.42), sgn0 = b.rand() < 0.5 ? 1 : -1;
    const warn = k.warn(o.warn || 2.1), dur = o.dur || 10;
    const th = b.playerTheta();
    D.poseT.raise = 0.6;
    D.hoops.forEach(h => { h.visible = 0; });
    const hs = [];
    rings.forEach((r, j) => {
      const sg = (j % 2 ? -1 : 1) * sgn0, w = o.width || 0.52;
      // start with the hero in the middle of a gap when the slices go live
      const base = th - sg * om * warn + PI / 3;
      const slices = [0, 1, 2].map(i => ({ center: base + i * TAU / 3, width: w }));
      const h = b.hz.rotor({ rings: [r], slices, omega: sg * om, warn, dur, tick: 0.5, dmg: o.dmg || 8, label: 'Armillary Spin' });
      attachArcs(h, r, arcMats(b));
      hs.push(h);
    });
    fx('flash', ACC, 0.12, 0.3); sfx('rumble', { vol: 0.7 });
    if (!D.said.spin) { D.said.spin = 1; b.say('The hoops descend: ride with them, or wait in the gaps.', 2.6); }
    await b.wait(0.6);
    D.poseT.raise = 0;
    if (o.strikes !== false) {
      await b.wait(warn + 1.2);
      await hourStrike(b, { n: 3, plant: false, sky: true });
      await b.wait(1.4);
      await hourStrike(b, { n: 3, plant: false, sky: true });
    }
    await hs[0].done;
    D.hoops.forEach(h => { h.visible = 1; });
    if (b.data.look >= 1) for (let i = 0; i < 3; i++) fx('ringFlash', i, { color: ACC, life: 0.4 });
    await b.wait(0.2);
  }

  // Shadow Lengthens: the night collapses inward from the rim as a lethal wave with two gold gaps.
  // Be inside a gap when it crosses your ring (Eclipse halt to wait in it), or Aegis it for a huge reflect.
  async function lengthens(b, o = {}) {
    const D = b.data, k = takeK(b);
    const r = b.playerRing(), d = b.playerDir(), th = b.playerTheta();
    const warn = k.warnL(o.warn || 3.0), speed = 5.0, gw = o.gapW || 0.86;
    const cross = warn + (15.2 - RING(r)) / speed;
    const gA = b.playerAhead(cross) - d * b.randRange(o.offLo != null ? o.offLo : -0.1, o.offHi != null ? o.offHi : 0.15);
    let gB = th - d * b.randRange(1.4, 1.9);
    if (Math.abs(angDiff(gA, gB)) < 1.3) gB = gA + PI;
    D.heavy = (D.heavy || 0) + 1;
    D.poseT.rear = 1; D.handLenT = 3.6; D.poseT.cast = 1;
    if (!D.said.len) { D.said.len = 1; b.say('The shadows lengthen... find the light!', 2.6); }
    const h = b.hz.wave({ from: 'out', speed, thickness: 0.9, gaps: [{ center: gA, width: gw }, { center: gB, width: gw }], warn, dmg: 75, lethal: true, label: 'Shadow Lengthens' });
    await b.wait(warn);
    D.poseT.rear = 0; D.poseT.slam = 1; D.poseT.cast = 0;
    await b.wait(0.4);
    D.poseT.slam = 0; D.handLenT = D.look === 1 ? 1.3 : 1;
    try { await h; } finally { D.heavy = Math.max(0, D.heavy - 1); }
    // exhausted: it stays put for a moment (back window)
    lockFacing(b, b.facing); D.poseT.bow = 0.45;
    await b.wait(o.rest || 2.4);
    D.poseT.bow = 0;
    unlockFacing(b);
  }

  // Long Night (P3): the facing locks and turns slowly; a frost blade runs out from its front across every
  // ring. The back is a moving window: chase it with a Comet. Frost orbs run against the hero meanwhile.
  async function longNight(b, o = {}) {
    const D = b.data, k = takeK(b);
    const om = (b.rand() < 0.5 ? 1 : -1) * (o.omega || 0.3);
    const dur = o.dur || 12, warn = k.warn(2.2);
    const c0 = b.facing;
    D.poseT.cast = 1; D.handLenT = 3.7;
    if (!D.said.night) { D.said.night = 1; b.say('The Long Night turns. Chase the keyhole.', 2.6); }
    const h = b.hz.rotor({ rings: [0, 1, 2], slices: [{ center: c0, width: 0.42 }], omega: om, warn, dur, tick: 0.5, dmg: 16, label: 'Long Night' });
    const hz = h.hazard;
    // frost blade visual riding the slice
    const bl = new T3.Mesh((() => { const g = new T3.PlaneGeometry(10.2, 3.0, 1, 1); g.translate(4.0 + 5.1, 1.5, 0); return g; })(), bladeMaterial('#9fefff'));
    bl.frustumCulled = false; bl.renderOrder = 8; hz.group.add(bl);
    const v0 = hz.visual; let sparkT = 0;
    hz.visual = (lt, dt) => {
      if (v0) v0(lt, dt);
      bl.rotation.y = hz.sliceAt(hz.slices[0], lt);
      bl.material.uniforms.uT.value += dt;
      bl.material.uniforms.uA.value = lt < hz.warn ? 0.25 * (lt / hz.warn) : (hz.finished ? 0 : 0.85);
      sparkT -= dt;
      if (lt >= hz.warn && sparkT <= 0) { sparkT = 0.12; fx('burst', G.polar(4 + Math.random() * 10, bl.rotation.y, 0.3), { color: ICE, count: 4, speed: 2, size: 0.35, life: 0.6, gravity: -1 }); }
    };
    lockFacing(b, () => hz.sliceAt(hz.slices[0], hz.lt));
    await b.wait(warn);
    D.poseT.cast = 0.4;
    // frost orbs come against the hero on their ring, a few seconds apart
    const nOrbs = o.orbs != null ? o.orbs : 3;
    for (let i = 0; i < nOrbs; i++) {
      await b.wait(2.4);
      const r = b.playerRing(), dd = b.playerDir();
      b.hz.orb({ ring: r, theta: b.playerTheta() + dd * 2.5, omega: -dd * 0.5, life: 7, radius: 0.55, dmg: 15, label: 'Frost Orb', color: '#9fefff' });
    }
    await h;
    D.poseT.cast = 0; D.handLenT = 1;
    unlockFacing(b);
    await b.wait(0.4);
  }

  // ---------------- casts (only the main loop casts)
  async function zenith(b) {
    const D = b.data;
    D.poseT.raise = 1; D.poseT.cast = 1;
    if (!D.said.zen) { D.said.zen = 1; b.say('Zenith Hymn: ECLIPSE (E) interrupts it!', 2.6); }
    const res = await b.cast({
      name: 'Zenith Hymn', dur: 3.0, interruptible: true,
      onDone: () => {
        G.player.damage(15, 'Zenith Hymn'); D.emp = 2; D.colBoost = 1;
        fx('flash', GOLD_HOT, 0.3, 0.4); fx('shockwave', V3(0, 0.3, 0), { color: GOLD_HOT, radius: 15, life: 0.9 });
        cam('shake', 0.4, 0.4); b.say('The Warden blazes at zenith: its next strikes quicken!', 2.4);
      },
      onInterrupt: () => { D.poseT.rear = 1; },
    });
    D.poseT.raise = 0; D.poseT.cast = 0;
    if (res === 'interrupted') { await b.wait(1.0); D.poseT.rear = 0; await b.wait(1.2); }
    else await b.wait(0.6);
  }
  async function vesper(b) {
    const D = b.data;
    D.poseT.raise = 1; D.poseT.cast = 1;
    let rang = false;
    const res = await b.cast({
      name: 'Vesper Bell', dur: 3.5, interruptible: true,
      onDone: () => { rang = true; G.player.damage(15, 'Vesper Bell'); fx('shockwave', V3(0, 0.3, 0), { color: DUSK, radius: 15, life: 1.0 }); cam('shake', 0.35, 0.4); sfx('thunder', { vol: 0.5 }); },
      onInterrupt: () => { D.poseT.rear = 1; },
    });
    D.poseT.raise = 0; D.poseT.cast = 0;
    if (res === 'interrupted') { await b.wait(1.0); D.poseT.rear = 0; await b.wait(1.0); return; }
    if (rang) { b.say('The vesper bell calls the pylons.', 2.2); await pylons(b, { hp: 150 }); }
  }
  async function solstice(b) {
    const D = b.data;
    D.poseT.raise = 1; D.poseT.cast = 1;
    if (!D.said.sol) { D.said.sol = 1; b.say('SOLSTICE: save your Eclipse for this!', 2.8); }
    D.heavy = (D.heavy || 0) + 1;
    const castP = b.cast({
      name: 'Solstice', dur: 5.0, interruptible: true,
      onDone: () => {
        G.player.damage(45, 'Solstice'); D.colBoost = 1.4;
        fx('flash', ICE, 0.45, 0.6); fx('shockwave', V3(0, 0.3, 0), { color: ICE, radius: 17, life: 1.1 });
        for (let i = 0; i < 3; i++) fx('ringFlash', i, { color: ACC, life: 0.8, intensity: 2 });
        cam('shake', 0.8, 0.6); sfx('thunder', {});
      },
      onInterrupt: () => { D.poseT.rear = 1; b.say('The Solstice shatters!', 2.0); },
    });
    // the Solstice is not cast in silence: Hour Strikes keep the hero moving (an Eclipse spent on a halt
    // now means no interrupt)
    (async () => {
      try {
        await b.wait(1.0);
        if (b.casting && b.casting.name === 'Solstice') {
          const r = b.playerRing();
          for (let i = 0; i < 3; i++) { const w = 1.5 + i * 0.5; b.hz.bolt({ from: G.polar(2, b.playerAhead(w), 20), ring: r, theta: b.playerAhead(w), warn: w, radius: 1.0, dmg: 20, label: 'Hour Strike' }); }
        }
      } catch (e) { if (!G.combat.isAbort(e)) logE('solstice.side', e); }
    })();
    // ticking clock: the world beats faster as the cast nears completion
    (async () => {
      try {
        for (let i = 0; i < 20 && b.casting && b.casting.name === 'Solstice'; i++) { world('beat', 0.3 + b.casting.progress * 0.7); await b.wait(0.55 - b.casting.progress * 0.3); }
      } catch (e) { if (!G.combat.isAbort(e)) logE('solstice.beat', e); }
    })();
    let res;
    try { res = await castP; } finally { D.heavy = Math.max(0, D.heavy - 1); }
    D.poseT.raise = 0; D.poseT.cast = 0;
    if (res === 'interrupted') { await b.wait(1.0); D.poseT.rear = 0; await b.wait(1.4); }
    else await b.wait(0.8);
  }

  // ---------------- P3 combos
  async function sweepEquinox(b) {
    const hr = b.playerRing(), other = adjRing(b, hr);
    const k = takeK(b);                                   // the empower charge (if any) applies to both halves
    const D = b.data; const save = D.emp; D.emp = 0;
    const eq = b.hz.ring({ ring: other, warn: k.warnL(3.0), active: 0.45, dmg: 60, lethal: true, label: 'Equinox' });
    D.heavy = (D.heavy || 0) + 1; eq.done.then(() => { D.heavy = Math.max(0, D.heavy - 1); });
    D.warnMulSave = D.warnMul; D.warnMul = k.m;
    try { await meridian(b, { rings: [hr], warn: 2.4 }); } finally { D.warnMul = D.warnMulSave; D.emp = Math.max(D.emp, save); }
    await eq;
  }
  async function pylonSpin(b) {
    const hr = b.playerRing();
    await pylons(b, { ring: hr, life: 13 });
    await armillary(b, { rings: [0, 1, 2].filter(r => r !== hr), dur: 9, strikes: false });
  }

  // ---------------- the attack loop (the only place that casts)
  function shuffle(b, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(b.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function runCycle(b, list, gap) {
    const D = b.data;
    D.bag = []; D.lastAtk = null;
    b.loop(async () => {
      if (D.castFn && b.phaseT >= D.nextCast) {
        await D.castFn(b);
        D.nextCast = b.phaseT + D.castEvery + b.randRange(-2, 2);
        await b.wait(b.randRange(0.9, 1.3));
        return;
      }
      if (!D.bag.length) { D.bag = shuffle(b, list.slice()); if (D.bag[0] === D.lastAtk && D.bag.length > 1) D.bag.push(D.bag.shift()); }
      const atk = D.bag.shift(); D.lastAtk = atk;
      await atk(b);
      await b.wait(b.randRange(gap[0], gap[1]));
    });
  }

  // ================================================================ PHASES
  function enterPhase(b, i) {
    const D = b.data;
    D.warnMul = [1.0, 0.95, 0.85][i];
    D.turn = [0.4, 0.45, 0.5][i];
    D.emp = 0; D.heavy = 0; D.quiet = false; D.cutting = false; unlockFacing(b);
    for (const k in D.poseT) D.poseT[k] = 0;
    D.twistT = 0;
    D.castFn = [zenith, vesper, solstice][i];
    D.castEvery = [24, 26, 25][i];
    D.nextCast = [13, 11, 9][i];
    b.turnRate = D.turn; b.trackPlayer = true; b.facingTarget = null;
    try { G.player.anchors.mark(null, false); } catch (e) { /* */ }
    applyLook(b, i, D.look < 0 || D.look !== i);
    if (i === 2) { try { G.audio.setIntensity(3); } catch (e) { /* */ } }
  }

  const PHASES = [
    {
      name: 'Noon', hpStart: 1.0, sky: ['night', 0],
      enter(b) { enterPhase(b, 0); if (!b.data.said.open) { b.data.said.open = 1; b.say('GNOMON: Stand in my shadow, little star. It is always noon here.', 3.2); } },
      update: phaseUpdate,
      async script(b) {
        await b.wait(1.2);
        runCycle(b, [meridian, hourStrike, equinox, pylons, (bb) => hourStrike(bb, { volleys: 2 }), meridian, equinox, shadowCut], [0.5, 0.85]);
        fillerLoop(b, [2.8, 4.0]);
      },
    },
    {
      name: 'Dusk', hpStart: 0.65, sky: ['night', 1], skyDur: 3.0,
      enter(b) { enterPhase(b, 1); },
      update(b, dt) {
        phaseUpdate(b, dt);
        const D = b.data; D.metT = (D.metT || 0) - dt;
        if (D.metT <= 0) { D.metT = 1.5 + Math.random() * 3; world('meteor', Math.random() < 0.5 ? '#fff2d0' : '#ffd0a0'); }
      },
      async script(b) {
        await b.wait(0.8);
        runCycle(b, [armillary, fallingHours, lengthens, grasp, twinEquinox, (bb) => hourStrike(bb, { sky: true, volleys: 2, plantDur: 3.0 }), pylons, lengthens, equinox, meridian], [0.35, 0.7]);
        fillerLoop(b, [2.2, 3.1]);
      },
    },
    {
      name: 'Midnight', hpStart: 0.30, sky: ['night', 3], skyDur: 3.5,
      enter(b) { enterPhase(b, 2); },
      update: phaseUpdate,
      async script(b) {
        await b.wait(0.6);
        runCycle(b, [sweepEquinox, longNight, (bb) => hourStrike(bb, { plantDur: 2.6, n: 4, volleys: 2 }), pylonSpin,
          (bb) => lengthens(bb, { gapW: 0.76, offLo: 0.1, offHi: 0.4, rest: 2.0 }), fallingHours, twinEquinox, grasp], [0.3, 0.55]);
        fillerLoop(b, [1.8, 2.7]);
      },
    },
  ];

  // ================================================================ CINEMATICS
  function resetPoses(b) { const D = b.data; for (const k in D.poseT) D.poseT[k] = 0; D.twistT = 0; unlockFacing(b); }
  // close-up cinematic keys were framed for a 16:9 screen; on a portrait phone the horizontal field of view is
  // a third as wide, so pull those cameras back along their view line
  function fitKeys(keys, home) {
    const asp = (typeof innerWidth === 'number' && innerHeight) ? innerWidth / innerHeight : 1.78;
    const k = clamp(Math.pow(1.45 / asp, 0.75), 1, 2.1);
    if (k <= 1.001) return keys;
    return keys.map(key => {
      if (key.pos === home || !Array.isArray(key.pos) || !Array.isArray(key.look)) return key;
      const p = key.pos, l = key.look;
      return Object.assign({}, key, { pos: [l[0] + (p[0] - l[0]) * k, l[1] + (p[1] - l[1]) * k, l[2] + (p[2] - l[2]) * k] });
    });
  }
  function onTransition(b, from, to) {
    const D = b.data;
    resetPoses(b);
    b.setFacing(-PI / 2); b.trackPlayer = false; b.turnRate = 0;
    const home = homeCam(), look = homeLook();
    const events = (async () => {
      if (to === 1) {
        // ---- Noon -> Dusk: the hoops tear free, sweep out over the rings, and the sun sinks
        b.say('Noon wanes. The hours turn against you.', 3.0);
        fx('flash', ACC, 0.3, 0.5); cam('shake', 0.6, 0.8); post('bloomPulse', 0.6, 1.2);
        D.poseT.rear = 1; D.poseT.cast = 1;
        await cwait(0.5);
        D.hoopFly = { t: 0, dur: 3.0 }; D.hoopKT = 1;
        sfx('swell', {}); sfx('rumble', { vol: 0.8 });
        for (let i = 0; i < 6; i++) { world('meteor', '#fff2d0'); await cwait(0.18); }
        for (let i = 0; i < 3; i++) fx('ringFlash', i, { color: ACC, life: 0.9, intensity: 1.2 });
        fx('shockwave', V3(0, 0.3, 0), { color: ACC, radius: 15, life: 1.2 });
        D.sunMode = 1; D.handLenT = 2.6;
        post('setGrade', [0.82, 0.8, 1.12], [1.16, 1.0, 0.82]);
        await cwait(1.2);
        for (let i = 0; i < 4; i++) { world('meteor', '#ffd0a0'); await cwait(0.25); }
        D.poseT.rear = 0; D.poseT.raise = 1;
        await cwait(0.8);
        fx('flash', DUSK, 0.18, 0.4);
        D.poseT.raise = 0; D.poseT.cast = 0; D.handLenT = 1.3;
        await cwait(0.6);
      } else if (to === 2) {
        // ---- Dusk -> Midnight: frost. The sun sets, the moon rises, the rings rime over, snow falls
        b.say('Midnight. Every hour ends here.', 3.0);
        fx('flash', ICE, 0.25, 0.6); cam('shake', 0.5, 0.8); post('bloomPulse', 0.4, 1.4);
        D.poseT.raise = 1; D.poseT.cast = 1;
        D.sunMode = 2; D.frostT = 1; D.iceKT = 1; world('setRingRime', 1);
        makeSnow(D); D.snow.aT = 1;
        sfx('swell', {});
        post('setGrade', [0.62, 0.76, 1.06], [0.9, 0.97, 1.02]); post('setVignette', 0.46);
        for (let k = 0; k < 3; k++) {
          for (let i = 0; i < 12; i++) fx('burst', G.polar(RING(k), i / 12 * TAU + k * 0.2, 0.2), { color: ICE, count: 6, speed: 2.5, size: 0.4, life: 0.9, gravity: -0.5 });
          fx('ringFlash', k, { color: '#bff4ff', life: 1.0, intensity: 1.6 });
          sfx('crack', { vol: 0.6 });
          await cwait(0.45);
        }
        for (let i = 0; i < 8; i++) { world('meteor', '#d8f6ff'); await cwait(0.15); }
        D.poseT.raise = 0; D.poseT.slam = 1;
        await cwait(0.35);
        fx('shockwave', V3(0, 0.3, 0), { color: ICE, radius: 16, life: 1.2 }); fx('flash', ICE, 0.25, 0.4); cam('shake', 0.9, 0.6); sfx('thunder', {});
        await cwait(0.6);
        D.poseT.slam = 0; D.poseT.cast = 0;
        await cwait(0.8);
      }
    })().catch(e => logE('transition.events', e));
    const keys = to === 1 ? [
      { t: 0, pos: home, look },
      { t: 1.3, pos: [7.5, 2.3, 9.0], look: [0, 3.6, 0], fov: 46 },
      { t: 3.0, pos: [-9.5, 15, 13], look: [0, 1.0, 0], fov: 44 },
      { t: 4.6, pos: home, look },
    ] : [
      { t: 0, pos: home, look },
      { t: 1.4, pos: [0.5, 26, 4.5], look: [0, 0, 0], fov: 46 },
      { t: 3.1, pos: [-7.5, 3.0, 7.5], look: [0, 3.8, 0], fov: 44 },
      { t: 4.8, pos: home, look },
    ];
    const cin = Promise.resolve(cam('cinematic', fitKeys(keys, home), { returnDur: 0.8 }));
    return Promise.all([events, cin]);
  }

  async function onDeath(b) {
    const D = b.data;
    resetPoses(b);
    cam('slowMo', 0.35, 1.4);
    const home = homeCam(), look = homeLook();
    const f = b.facing;
    const side = (a, r, y) => G.polar(r, f + a, y).toArray();
    const cin = Promise.resolve(cam('cinematic', fitKeys([
      { t: 0, pos: home, look },
      { t: 1.3, pos: side(0.5, 8.0, 2.4), look: [0, 3.4, 0], fov: 44 },
      { t: 3.6, pos: side(-0.9, 8.5, 3.6), look: [0, 3.0, 0], fov: 46 },
      { t: 5.6, pos: [0, 10.5, 16], look: [0, 3.2, 0], fov: 44 },
      { t: 7.6, pos: home, look },
    ], home), { returnDur: 0.9 }));
    b.say('...so the dawn comes after all.', 3.5);
    D.death = { t: 0, stage: 0 };
    fx('flash', '#ffffff', 0.22, 0.5); cam('shake', 0.6, 0.6);
    // cracks
    for (let i = 0; i < 6; i++) {
      const p = V3((Math.random() - 0.5) * 1.2, 1.5 + Math.random() * 3.5, (Math.random() - 0.5) * 1.2);
      fx('burst', p, { color: i % 2 ? ACC : '#eafcff', count: 22, speed: 6, size: 0.6, life: 0.8 });
      sfx('crack', { vol: 0.7 }); cam('shake', 0.3, 0.25);
      await cwait(0.22);
    }
    // the hoops shatter one by one
    for (let i = 0; i < 3; i++) {
      const h = D.hoops[i]; h.visible = 0;
      h.orient.updateMatrixWorld(true);
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * TAU; tmpV.set(Math.cos(a) * h.R, Math.sin(a) * h.R, 0).applyMatrix4(h.spin.matrixWorld);
        const pl = G.layers && G.layers.play; if (pl) pl.worldToLocal(tmpV);
        fx('shards', tmpV.clone(), { color: '#ffd27a', count: 5, speed: 4, floor: 0 });
        if (k % 3 === 0) fx('burst', tmpV.clone(), { color: ACC, count: 6, speed: 3, size: 0.4, life: 0.6 });
      }
      sfx('crack', { vol: 0.9 }); cam('shake', 0.45, 0.3);
      await cwait(0.4);
    }
    // the crest snaps, the obelisk splits
    D.death.stage = 1; sfx('rumble', { vol: 1 });
    await cwait(0.9);
    D.death.stage = 2; post('bloomPulse', 0.7, 1.5);
    await cwait(1.1);
    // the keyhole opens: a column of dawn light, the night lifts
    D.death.stage = 3;
    D.colBoost = 1.6; D.column.material.uniforms.uC.value.set(GOLD_HOT);
    fx('flash', '#fff6dd', 0.3, 1.2);
    fx('shockwave', V3(0, 0.4, 0), { color: GOLD_HOT, radius: 22, life: 1.8 });
    fx('shockwave', V3(0, 0.4, 0), { color: ACC, radius: 14, life: 1.2 });
    fx('burst', V3(0, 2.8, 0), { color: GOLD_HOT, count: 70, speed: 12, size: 0.7, life: 1.4 });
    for (let i = 0; i < 4; i++) fx('starFall', G.polar(2 + i * 3, i * 1.7, 0.2), GOLD_HOT);
    cam('shake', 1.1, 1.0); sfx('thunder', {});
    D.body.visible = false; D.hover.visible = false; D.hoverGlow.visible = false;
    D.sunMode = 3; D.frostT = 0; world('setRingRime', 0);
    if (D.snow) D.snow.aT = 0;
    world('setSky', 'night', 0, 4);
    post('setGrade', [0.86, 0.84, 1.1], [1.14, 1.04, 0.86]); post('setVignette', 0.32);
    for (let i = 0; i < 3; i++) fx('ringFlash', i, { color: GOLD, life: 1.2, intensity: 1.0 });
    await cwait(2.4);
    return cin;
  }
  function animateDeath(b, D, dt) {
    const dd = D.death; dd.t += dt;
    const st = dd.stage;
    // shudder
    D.body.position.x = (st < 3 ? Math.sin(dd.t * 40) * 0.03 * (1 + st) : 0);
    D.eyeMat.color.set(ACC).multiplyScalar(Math.random() < 0.3 ? 0.3 : 2.4);
    if (st >= 1) {
      dd.cr = (dd.cr || 0) + dt;
      const k = sm(dd.cr / 0.9);
      D.crest.rotation.z = -1.6 * k; D.crest.position.x = 0.9 * k; D.crest.position.y = 3.6 - 2.2 * k * k;
    }
    if (st >= 2) {
      dd.sp = (dd.sp || 0) + dt;
      const k = sm(dd.sp / 1.1);
      D.segs.forEach((s, i) => { const a = i * 2.1 + 0.6; s.position.set(Math.cos(a) * 0.5 * k, i * 0.35 * k, Math.sin(a) * 0.5 * k); s.rotation.set(0.15 * k * (i - 1), 0, 0.2 * k * (i % 2 ? 1 : -1)); });
      D.hands.forEach((g) => { g.position.y -= dt * 1.5 * k; g.rotation.z += dt * 2; });
      D.U.uGlow.value = 1.5 + 2 * k;
    }
  }

  // ================================================================ TEARDOWN
  function teardown(b) {
    const D = b.data || {};
    removeSnow(D);
    world('setRingRime', 0);
    try { G.world && G.world.reset && G.world.reset(); } catch (e) { logE('teardown.world', e); }
  }

  // ================================================================ DEFINITION
  G.bosses = G.bosses || [];
  G.bosses[0] = {
    name: 'GNOMON', title: 'the Brass Warden', accent: ACC, sky: 'night', music: 0,
    maxHp: 18500, parTime: 200, hitRadius: 1.0, hitHeight: 4.6, fadeOpacity: 0.35,
    phases: PHASES,
    build, animate, onTransition, onDeath, teardown,
  };
  // exposed for tests / tuning only
  G.gnomon = { attacks: { meridian, hourStrike, pylons, equinox, shadowCut, grasp, armillary, lengthens, fallingHours, twinEquinox, longNight, sweepEquinox, pylonSpin, zenith, vesper, solstice } };
})();
