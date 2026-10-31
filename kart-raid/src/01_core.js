// =====================================================================
// 01_core.js — imports, G namespace, events, time, loop, renderer,
// post chain (bloom + FinalPass), adaptive quality, camera rig.   (CORE)
// =====================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
const G = window.G = { THREE, addons: { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass, BufferGeometryUtils } };

{
  G.DT = 1 / 60;
  G.errors = [];
  G.bosses = G.bosses || [];

  // ------------------------------------------------------------------
  // URL params
  // ------------------------------------------------------------------
  const qs = new URLSearchParams(location.search);
  const num = (k, def) => { const v = qs.get(k); if (v === null || v === '') return def; const n = Number(v); return isNaN(n) ? v : n; };
  G.params = {
    test: !!num('test', 0), boss: num('boss', 1) | 0 || 1, phase: num('phase', 1) | 0 || 1,
    god: !!num('god', 0), quality: qs.get('quality') || 'auto', seed: num('seed', null),
    debug: !!num('debug', 0), mute: !!num('mute', 0),
    dpr: num('dpr', null),          // extra: lock device pixel ratio (disables adaptive DPR)
    msaa: num('msaa', null),        // extra: override scene MSAA samples (0 = off)
    touch: num('touch', null),      // extra: force touch UI on (1) / off (0)
    safe: num('safe', null),        // extra: graphics safe level 0-4 (see gfxSafe)
  };
  if (G.params.seed === null) G.params.seed = G.params.test ? 1 : (Math.random() * 1e9) | 0;

  // ------------------------------------------------------------------
  // Seeded RNG (mulberry32)
  // ------------------------------------------------------------------
  let rs = 1;
  G.seed = (n) => { rs = (n >>> 0) || 1; };
  G.rng = () => {
    rs |= 0; rs = (rs + 0x6D2B79F5) | 0;
    let t = Math.imul(rs ^ (rs >>> 15), 1 | rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  G.seed(G.params.seed);

  // ------------------------------------------------------------------
  // Tuning constants (KART/COMBAT may override fields at init)
  // ------------------------------------------------------------------
  G.cfg = {
    vTop: 36, vBoostCap: 52, accel: 2.4, accelFloor: 2, boostDecay: 18, brake: 40, reverseMax: 8, coast: 3,
    yawLow: 2.1, yawHigh: 1.35, autoAlign: 1.5, gravity: 30,
    driftMinSpeed: 18, driftSteerMin: 0.25, driftYawBase: 0.85, driftYawRange: 0.6, driftSpeedMult: 0.94,
    tierT: [0.6, 1.4, 2.3], tierColor: ['#3fa9ff', '#ff8a1f', '#c04bff'],
    turboAdd: [10, 13, 16], turboDur: [0.5, 0.9, 1.4], bolts: [1, 3, 6], boltDmg: [40, 30, 25], critDmg: 60,
    releaseFlux: [3, 5, 8], volleyStagger: [0.02, 0.05, 0.12], hitstopMs: [40, 60, 90],
    hopV: 13, driftHopV: 4.2, padAdd: 14, padDur: 0.9, trickAdd: 8, trickDur: 0.6,
    dashCost: 25, dashCD: 1.2, dashFreeRegen: 10, dashDur: 0.45, dashAdd: 16, dashShift: 6.5, dashInvuln: 0.4,
    overclockCost: 50, overclockCD: 20, overclockDur: 6,
    cometDmg: 900, hull: 100, regenDelay: 5, regenRate: 3, regenCap: 0.6, credits: 3,
    hitIframes: 0.6, wobble: 0.4, grazeDist: 1.5,
  };

  // ------------------------------------------------------------------
  // Module registry
  // ------------------------------------------------------------------
  G.mods = {};
  const modList = [];
  G.register = (name, mod) => { mod.name = name; G.mods[name] = mod; modList.push(mod); return mod; };
  G.initAll = async () => {
    for (const m of modList) {
      if (!m.init) continue;
      try { await m.init(); } catch (e) { G.logError(m.name + '.init', e); }
    }
    G.inited = true;
    G.emit('init', {});
  };
  const errSeen = new Set();
  G.logError = (where, e) => {
    if (errSeen.has(where)) return;
    errSeen.add(where);
    G.errors.push({ where, msg: String(e && e.message || e), t: G.time.now });
    console.error('[' + where + ']', e);
  };

  // ------------------------------------------------------------------
  // Events + ring log
  // ------------------------------------------------------------------
  const listeners = {};
  G.eventLog = [];
  G.on = (name, fn) => { (listeners[name] || (listeners[name] = [])).push(fn); };
  G.off = (name, fn) => { const l = listeners[name]; if (!l) return; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
  G.emit = (name, data) => {
    G.eventLog.push({ t: +G.time.now.toFixed(3), name, data });
    if (G.eventLog.length > 200) G.eventLog.shift();
    const l = listeners[name]; if (!l) return;
    for (let i = 0; i < l.length; i++) { try { l[i](data, name); } catch (e) { G.logError('on:' + name, e); } }
  };

  // ------------------------------------------------------------------
  // Time: hitstop (sim frozen for real ms) and slow-mo slots (min wins)
  // ------------------------------------------------------------------
  const slow = [{ s: 1, until: 0 }, { s: 1, until: 0 }, { s: 1, until: 0 }, { s: 1, until: 0 }];
  let hitstopUntil = 0;
  G.time = {
    now: 0, real: 0, scale: 1, frame: 0, dt: G.DT, paused: false,
    hitstop(ms) { hitstopUntil = Math.max(hitstopUntil, G.time.real + Math.min(ms, 120) / 1000); },
    slowmo(scale, dur) {
      // reuse an expired slot, else replace the weakest one
      let pick = slow[0];
      for (const sl of slow) { if (sl.until <= G.time.real) { pick = sl; break; } if (sl.s > pick.s) pick = sl; }
      pick.s = scale; pick.until = G.time.real + dur;
    },
    effectiveScale() {
      if (G.time.real < hitstopUntil) return 0;
      let m = G.time.scale;
      for (const sl of slow) if (sl.until > G.time.real && sl.s < m) m = sl.s;
      return m;
    },
    clearSlow() { for (const sl of slow) sl.until = 0; hitstopUntil = 0; },
  };

  // ------------------------------------------------------------------
  // Renderer, scene, camera
  // ------------------------------------------------------------------
  const isCoarse = matchMedia('(pointer:coarse)').matches;
  G.isTouch = G.params.touch !== null ? !!G.params.touch : (isCoarse || 'ontouchstart' in window && navigator.maxTouchPoints > 0);
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;   // ACES runs in FinalShader (reads this every frame)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;
  renderer.setClearColor(0x0a0d1a, 1);
  (document.getElementById('app') || document.body).appendChild(renderer.domElement);
  G.renderer = renderer;

  const scene = G.scene = new THREE.Scene();
  const camera = G.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2000);
  camera.position.set(0, 6, 20);
  scene.add(camera);
  // camera.fov is authored as the vertical FOV at a 16:9 reference. On wider screens (phones at 19.5:9-20:9)
  // the horizontal FOV is held at the 16:9 value instead of growing to ~130 deg. Narrower screens keep the
  // authored vertical FOV. Use G.vfov(f) / camera.userData.vfov for the effective vertical FOV.
  const REF_ASPECT = 16 / 9;
  G.vfov = (f, aspect = camera.aspect) => {
    if (aspect <= REF_ASPECT) return f;
    const hf = 2 * Math.atan(Math.tan(f * Math.PI / 360) * REF_ASPECT);
    return 2 * Math.atan(Math.tan(hf / 2) / aspect) * 180 / Math.PI;
  };
  {
    const upm = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
    camera.updateProjectionMatrix = function () {
      const f = this.fov; const ef = G.vfov(f, this.aspect); this.userData.vfov = ef;
      this.fov = ef; upm.call(this); this.fov = f;
    };
    camera.updateProjectionMatrix();
  }

  // lights: hemisphere + one directional (no shadows). Track build may retint them.
  G.lights = {
    hemi: new THREE.HemisphereLight(0x9fc4ff, 0x2a1408, 0.9),
    sun: new THREE.DirectionalLight(0xffe2c0, 1.6),
  };
  G.lights.sun.position.set(-60, 120, 40);
  scene.add(G.lights.hemi, G.lights.sun);

  // Procedural env map from a 3-colour gradient (PMREM). Called per arena.
  let pmrem = null, envRT = null;
  G.makeEnv = (top = '#335577', horizon = '#ff8844', bottom = '#100808') => {
    try {
      pmrem = pmrem || new THREE.PMREMGenerator(renderer);
      const es = new THREE.Scene();
      const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { a: { value: new THREE.Color(top) }, b: { value: new THREE.Color(horizon) }, c: { value: new THREE.Color(bottom) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: `uniform vec3 a,b,c; varying vec3 vP; void main(){ float y = normalize(vP).y;
          vec3 col = y > 0. ? mix(b, a, pow(y, .6)) : mix(b, c, pow(-y, .4));
          col += b * 2.5 * pow(1. - abs(y), 18.);  // bright horizon band for chrome highlights
          gl_FragColor = vec4(col, 1.); }`,
      });
      es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), mat));
      if (envRT) envRT.dispose();
      envRT = pmrem.fromScene(es, 0.02);
      scene.environment = envRT.texture;
      mat.dispose();
    } catch (e) { G.logError('makeEnv', e); }
  };

  // ------------------------------------------------------------------
  // Post chain: RenderPass -> UnrealBloom (reduced res) -> FinalPass (grade + ACES + sRGB, to screen)
  // ------------------------------------------------------------------
  // Graphics safe level (black-screen fallbacks, see gfxWatch below): 0 full, 1 no MSAA, 2 + 8-bit targets,
  // 3 + no bloom, 4 no post chain (plain renderer.render). iOS WebKit starts at 1: multisampled half-float
  // scene targets resolve to black there. ?safe=N overrides; a level the watchdog reaches is remembered.
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let gfxSafe = isIOS ? 1 : 0;
  try { gfxSafe = Math.max(gfxSafe, +localStorage.getItem('db_gfx_safe') || 0); } catch (e) { /* ignore */ }
  if (G.params.safe != null) gfxSafe = +G.params.safe | 0;
  gfxSafe = Math.max(0, Math.min(4, gfxSafe));
  // HDR targets need EXT_color_buffer_(half_)float. Without it (some iOS builds) use 8-bit targets with a lower threshold.
  const hdrOK = gfxSafe < 2 && renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  G.post_hdr = hdrOK;
  const rtMain = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: hdrOK ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 0 });
  const composer = G.composer = new EffectComposer(renderer, rtMain);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = G.bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.6, 0.3, hdrOK ? 1.05 : 0.85);
  // threshold is on linear HDR (pre-exposure): only true emissives (>1.05) bloom; ordinary lit surfaces don't.
  G.bloomDefaults = { strength: 0.6, radius: 0.3, threshold: bloom.threshold };
  let bloomScale = 0.5;
  const bloomSetSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => bloomSetSize(Math.max(8, Math.round(w * bloomScale)), Math.max(8, Math.round(h * bloomScale)));
  composer.addPass(bloom);

  const FinalShader = {
    uniforms: {
      tDiffuse: { value: null }, uSpeed: { value: 0 }, uCA: { value: 0 }, uFlash: { value: new THREE.Vector4(1, 1, 1, 0) },
      uVignette: { value: 0.25 }, uDamage: { value: 0 }, uLensPos: { value: new THREE.Vector2(0.5, 0.5) }, uLensStr: { value: 0 },
      uMono: { value: 0 }, uShock: { value: new THREE.Vector3(0.5, 0.5, -1) }, uTint: { value: new THREE.Vector3(1, 1, 1) },
      uTime: { value: 0 }, uAspect: { value: 1 }, uTaps: { value: 6 }, uLines: { value: 1 }, uExposure: { value: 0.9 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uSpeed, uCA, uVignette, uDamage, uLensStr, uMono, uTime, uAspect, uTaps, uLines, uExposure;
      uniform vec4 uFlash; uniform vec2 uLensPos; uniform vec3 uShock, uTint; varying vec2 vUv;
      float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
      // ACES filmic (same fit as three r160 ACESFilmicToneMapping) + sRGB encode. Done here so OutputPass is not needed.
      vec3 pfRRTFit(vec3 v){ vec3 a = v * (v + .0245786) - .000090537; vec3 b = v * (.983729 * v + .4329510) + .238081; return a / b; }
      vec3 aces(vec3 c){
        const mat3 I = mat3(vec3(.59719, .07600, .02840), vec3(.35458, .90834, .13383), vec3(.04823, .01566, .83777));
        const mat3 O = mat3(vec3(1.60475, -.11530, -.07367), vec3(-.53108, 1.10813, -.00605), vec3(-.07369, -.00327, 1.07602));
        c *= uExposure / .6; c = I * c; c = pfRRTFit(c); c = O * c; return clamp(c, 0., 1.);
      }
      vec3 toSRGB(vec3 c){ return mix(pow(c, vec3(.41666)) * 1.055 - .055, c * 12.92, vec3(lessThanEqual(c, vec3(.0031308)))); }
      void main(){
        vec2 uv = vUv;
        vec2 asp = vec2(uAspect, 1.);
        // gravitational lens (Boss 3)
        if (uLensStr != 0.) {
          vec2 dv = (uv - uLensPos) * asp;
          uv += normalize(dv + 1e-6) / asp * uLensStr / max(dot(dv, dv) * 40., .4);
        }
        // shock ripple ring
        if (uShock.z > 0.) {
          vec2 dv = (uv - uShock.xy) * asp; float r = length(dv);
          float w = smoothstep(.07, 0., abs(r - uShock.z)) * (1. - smoothstep(.4, 1.1, uShock.z));
          uv -= normalize(dv + 1e-6) / asp * w * .025;
        }
        vec2 cdir = uv - .5; float rad = length(cdir * asp);
        // chromatic aberration (radial) + speed radial blur
        float ca = uCA * (.35 + rad * 1.3);
        vec3 col = vec3(texture2D(tDiffuse, uv + cdir * ca * 2.).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - cdir * ca * 2.).b);
        float bs = uSpeed * uSpeed * .024 * smoothstep(.28, .75, rad);   // edges only: keeps the boss / side threats readable at speed
        if (bs > .0005) {
          vec3 acc = col; float wsum = 1.;
          for (int i = 1; i <= 6; i++) { if (float(i) > uTaps) break; float k = float(i) / uTaps;
            acc += texture2D(tDiffuse, uv - cdir * bs * k * 2.).rgb * (1. - k * .5); wsum += 1. - k * .5; }
          col = acc / wsum;
        }
        // procedural speed lines
        if (uSpeed > .01 && uLines > .5) {
          float ang = atan(cdir.y * 1., cdir.x * uAspect);
          float cu = (ang / 6.2832 + .5) * 180.; float cell = floor(cu); float hh = h1(cell);
          float f = fract(rad * 1.6 - uTime * (2.2 + hh * 3.) + hh * 9.);
          float seg = smoothstep(0., .12, f) * smoothstep(.55, .12, f);
          float m = step(.82, hh) * smoothstep(.32, .78, rad) * smoothstep(.3, .0, abs(fract(cu) - .5));   // thin streak, not a wedge
          col += vec3(.7, .93, 1.) * m * seg * uSpeed * .22;
        }
        // eclipse mono (keep bright saturated emissives)
        if (uMono > 0.) {
          float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
          float keep = smoothstep(.55, .9, (mx - mn) / max(mx, 1e-3) ) * smoothstep(.5, 1.2, mx);
          float l = dot(col, vec3(.299, .587, .114));
          col = mix(col, vec3(l), uMono * (1. - keep));
        }
        // grade: arena tint (HDR), tone map, then a gentle S-curve on display values (no highlight expansion)
        col *= uTint;
        col = toSRGB(aces(col));
        col += .12 * (col * col * (3. - 2. * col) - col);
        // vignette, damage pulse, flash (display space; flash amount is clamped in G.post.flash)
        float vig = smoothstep(.35, 1.05, rad);
        col *= 1. - vig * uVignette * 1.6;
        col = mix(col, vec3(.9, .02, .05) * (.6 + .4 * sin(uTime * 7.)), vig * uDamage * .55);
        col = mix(col, uFlash.rgb, clamp(uFlash.a, 0., 1.));
        gl_FragColor = vec4(col, 1.);
      }`,
  };
  const finalPass = new ShaderPass(FinalShader);
  finalPass.needsSwap = false;   // last pass renders to screen; no swap keeps the (MSAA) scene target fixed
  composer.addPass(finalPass);   // FinalShader does ACES + sRGB itself (one fewer full-screen pass than OutputPass)
  const FU = finalPass.uniforms;

  // count scene-only draw calls (before the post passes)
  G.perf = { fps: 60, frameMs: 16.7, drawCalls: 0, sceneCalls: 0, triangles: 0 };
  const rpRender = renderPass.render.bind(renderPass);
  renderPass.render = (...a) => { rpRender(...a); G.perf.sceneCalls = renderer.info.render.calls; G.perf.triangles = renderer.info.render.triangles; };

  // Post API (spec §10.2). Transient pulses decay automatically on real time.
  const pulse = { flash: 0, flashDecay: 3, ca: 0, caDecay: 3, bloomAdd: 0, bloomDecay: 2, shockT: -1, shockDur: 0.7 };
  G.post = {
    uniforms: FU,
    base: { vignette: 0.25, ca: 0, bloom: 0.6, tint: new THREE.Vector3(1, 1, 1) },
    setSpeed(v) { FU.uSpeed.value = v; }, setCA(v) { G.post.base.ca = v; },
    setVignette(v) { G.post.base.vignette = v; }, setDamage(v) { FU.uDamage.value = v; },
    setLens(x, y, str) { FU.uLensPos.value.set(x, y); FU.uLensStr.value = str; },
    setMono(v) { FU.uMono.value = v; },
    setTint(r, g, b) { G.post.base.tint.set(r, g, b); },
    setShock(x, y, r) { FU.uShock.value.set(x, y, r); },
    // transient helpers
    // screen flash: amt is clamped to FLASH_MAX (readability + photosensitivity); decay is per second
    flash(color = '#ffffff', amt = 0.6, decay = 3) { amt = Math.min(G.post.FLASH_MAX, amt); const c = tmpC.set(color); FU.uFlash.value.set(c.r, c.g, c.b, Math.max(pulse.flash, amt)); pulse.flash = Math.max(pulse.flash, amt); pulse.flashDecay = decay; },
    FLASH_MAX: 0.45, BLOOM_MAX: 1.6,
    caPulse(amt = 0.006, decay = 3) { pulse.ca = Math.max(pulse.ca, amt); pulse.caDecay = decay; },
    bloomPulse(add = 0.8, decay = 2) { pulse.bloomAdd = Math.max(pulse.bloomAdd, add); pulse.bloomDecay = decay; },
    shockAt(worldV3, dur = 0.7) { tmpV.copy(worldV3).project(camera); if (tmpV.z > 1) return; shockPos.set(tmpV.x * .5 + .5, tmpV.y * .5 + .5); pulse.shockT = 0; pulse.shockDur = dur; },
    auto: true, // core drives uSpeed / boost CA from G.kart each frame
  };
  const tmpC = new THREE.Color(), tmpV = new THREE.Vector3(), shockPos = new THREE.Vector2();

  function updatePost(rdt) {
    const k = G.kart;
    if (G.post.auto && k) {
      const sp = Math.max(0, Math.min(1, ((k.speed || 0) - 30) / 22));
      FU.uSpeed.value += (sp - FU.uSpeed.value) * Math.min(1, rdt * 6);
    }
    const boostCA = k && k.boosting ? 0.0025 + FU.uSpeed.value * 0.003 : 0;
    pulse.ca = Math.max(0, pulse.ca - pulse.caDecay * 0.004 * rdt);
    FU.uCA.value = Math.min(0.008, G.post.base.ca + boostCA + pulse.ca);
    pulse.flash = Math.min(G.post.FLASH_MAX, Math.max(0, pulse.flash - pulse.flashDecay * rdt)); FU.uFlash.value.w = pulse.flash;
    pulse.bloomAdd = Math.max(0, pulse.bloomAdd - pulse.bloomDecay * rdt);
    bloom.strength = Math.min(G.post.BLOOM_MAX, G.post.base.bloom + pulse.bloomAdd);
    FU.uVignette.value = G.post.base.vignette + (k && k.boosting ? 0.08 : 0);
    FU.uTint.value.copy(G.post.base.tint);
    if (pulse.shockT >= 0) {
      pulse.shockT += rdt; const u = pulse.shockT / pulse.shockDur;
      if (u >= 1) { pulse.shockT = -1; FU.uShock.value.z = -1; } else FU.uShock.value.set(shockPos.x, shockPos.y, u * 0.9);
    }
    FU.uTime.value = G.time.real;
    FU.uAspect.value = camera.aspect;
    FU.uExposure.value = renderer.toneMappingExposure;
  }

  // ------------------------------------------------------------------
  // Quality + adaptive DPR
  // ------------------------------------------------------------------
  const dprMax = isCoarse ? Math.min(devicePixelRatio || 1, 1.5) : Math.min(devicePixelRatio || 1, 2);
  const DPR_FLOOR = 0.55;
  const TIERS = {
    high: { bloomScale: 0.5, particles: 3000, skyOct: 2, stars: 2000, lens: true, taps: 6, lines: 1, msaa: 4 },
    med: { bloomScale: 0.5, particles: 1600, skyOct: 1, stars: 1000, lens: true, taps: 6, lines: 1, msaa: 4 },
    low: { bloomScale: 0.25, particles: 800, skyOct: 1, stars: 500, lens: false, taps: 3, lines: 0, msaa: 0 },
  };
  // MSAA on the scene target (WebGL2; cheap on tile GPUs). ?msaa=N overrides. finalPass.needsSwap is false, so the
  // composer never ping-pongs: RenderPass + bloom always use readBuffer and only that target is multisampled.
  function setMSAA(n) {
    const want = G.params.msaa != null ? +G.params.msaa : gfxSafe >= 1 ? 0 : n;
    const max = renderer.capabilities.maxSamples || 0;
    const sm = renderer.capabilities.isWebGL2 ? Math.min(want || 0, max) : 0;
    const rb = composer.readBuffer, wb = composer.writeBuffer;
    if (rb.samples !== sm) { rb.samples = sm; rb.dispose(); }
    if (wb.samples !== 0) { wb.samples = 0; wb.dispose(); }
    G.perf.msaa = sm;
  }
  G.quality = {
    tier: 'high', dpr: G.params.dpr || dprMax, auto: G.params.quality === 'auto', settings: TIERS.high, tiers: TIERS,
    set(tier) {
      if (tier === 'auto') { G.quality.auto = true; tier = isCoarse ? 'med' : 'high'; }
      else if (tier !== G.quality.tier) G.quality.auto = G.quality.auto && false;
      if (!TIERS[tier]) return;
      G.quality.tier = tier; G.quality.settings = TIERS[tier];
      bloomScale = TIERS[tier].bloomScale; FU.uTaps.value = TIERS[tier].taps; FU.uLines.value = TIERS[tier].lines;
      setMSAA(TIERS[tier].msaa);
      resize();
      G.emit('quality', { tier });
    },
    setDpr(d) { G.quality.dpr = Math.max(DPR_FLOOR, Math.min(dprMax, d)); renderer.setPixelRatio(G.quality.dpr); composer.setPixelRatio(G.quality.dpr); resize(); },
  };
  const ftRing = new Float32Array(30); let ftI = 0, ftN = 0, lastDprStep = 0, fastSince = -1, floorSince = -1;
  function adapt(rdt) {
    ftRing[ftI] = rdt * 1000; ftI = (ftI + 1) % 30; ftN = Math.min(30, ftN + 1);
    let sum = 0; for (let i = 0; i < ftN; i++) sum += ftRing[i];
    const avg = sum / ftN; G.perf.frameMs = avg; G.perf.fps = 1000 / avg;
    if (G.params.dpr || ftN < 30) return;
    const t = G.time.real, q = G.quality;
    if (avg > 19 && t - lastDprStep > 1.5 && q.dpr > DPR_FLOOR) { q.setDpr(q.dpr - 0.1); lastDprStep = t; fastSince = -1; }
    else if (avg < 14) { if (fastSince < 0) fastSince = t; if (t - fastSince > 2 && q.dpr < dprMax) { q.setDpr(q.dpr + 0.05); fastSince = t; lastDprStep = t; } }
    else fastSince = -1;
    // drop a tier if DPR sits at the floor for 4 s (auto quality only)
    if (q.auto && q.dpr <= DPR_FLOOR + 0.001 && avg > 19) {
      if (floorSince < 0) floorSince = t;
      if (t - floorSince > 4 && q.tier !== 'low') { q.set(q.tier === 'high' ? 'med' : 'low'); q.auto = true; floorSince = -1; }
    } else floorSince = -1;
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(G.quality.dpr); composer.setPixelRatio(G.quality.dpr);
    renderer.setSize(w, h); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));

  // ------------------------------------------------------------------
  // Camera rig: chase / orbit / turntable / cinematic, shake, fov kick, punch
  // ------------------------------------------------------------------
  const UP = new THREE.Vector3(0, 1, 0);
  const cv = { fwd: new THREE.Vector3(1, 0, 0), pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0),
    a: new THREE.Vector3(), b: new THREE.Vector3(), punch: new THREE.Vector3(), punchV: new THREE.Vector3(), boss: new THREE.Vector3(),
    q: new THREE.Quaternion(), dl: new THREE.Vector3(), dk: new THREE.Vector3() };
  // 1D value noise for shake
  const nh = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const vnoise = (x, seed) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (nh(i + seed * 57) * (1 - u) + nh(i + 1 + seed * 57) * u) * 2 - 1; };
  const noise3 = (t, seed) => vnoise(t, seed) * 0.57 + vnoise(t * 2.1, seed + 7) * 0.29 + vnoise(t * 4.3, seed + 13) * 0.14;

  const cam = G.cam = {
    mode: 'chase', trauma: 0, shakeMult: 1, fovBase: 70, fov: 70,
    dist: 5.9, height: 2.15, lookAhead: 9,
    kick: { amt: 0, t: 0, dur: 0 }, pull: { amt: 0, t: 0, dur: 0 }, boss: { w: 0, t: 0, dur: 0 },
    cinematic: null, cinT: 0, swing: 0,
    // persistent boss framing in fights: the view yaws toward the boss (max bossYawMax rad, more during casts) and the
    // camera swings part of that to the outside so kart, road ahead and boss share the frame. 0 disables.
    bossFrame: 1, bossYawMax: 0.62, bossYawCast: 0.85, bossYaw: 0, bossLift: 0,
    orbit: { target: new THREE.Vector3(), radius: 40, height: 14, speed: 0.25, angle: 0 },
    shake(tr) { cam.trauma = Math.min(1, cam.trauma + tr * cam.shakeMult); },
    kickFov(deg, dur = 0.4) { cam.kick.amt = Math.max(cam.kick.amt * (1 - cam.kick.t / Math.max(cam.kick.dur, 1e-3)), deg); cam.kick.t = 0; cam.kick.dur = dur; },
    pullOut(m, dur = 2) { cam.pull.amt = m; cam.pull.t = 0; cam.pull.dur = dur; },
    lookAtBoss(w = 0.5, dur = 1.5) { cam.boss.w = w; cam.boss.t = 0; cam.boss.dur = dur; },
    setCinematic(fn) { cam.cinematic = fn || null; cam.cinT = 0; cam.mode = fn ? 'cinematic' : 'chase'; },
    setOrbit(target, radius = 40, height = 14, speed = 0.25) { cam.orbit.target.copy(target); cam.orbit.radius = radius; cam.orbit.height = height; cam.orbit.speed = speed; cam.mode = 'orbit'; },
    punch(dir, amt = 0.12) { cv.punchV.addScaledVector(dir, amt * 18); },
    snap() { cam._snap = true; },   // teleport camera to target next update (no smoothing)
    update(rdt) {
      const k = G.kart;
      const kh = cam.kick; kh.t += rdt; const kickNow = kh.t < kh.dur ? kh.amt * (1 - kh.t / kh.dur) * (1 - kh.t / kh.dur) : 0;
      if (cam.cinematic) {
        cam.cinT += rdt;
        try { cam.cinematic(cam.cinT, camera); } catch (e) { G.logError('cam.cinematic', e); cam.setCinematic(null); }
      } else if (cam.mode === 'orbit' || cam.mode === 'turntable') {
        const o = cam.orbit; o.angle += o.speed * rdt;
        if (cam.mode === 'turntable' && k && k.renderPos) o.target.copy(k.renderPos);
        camera.position.set(o.target.x + Math.cos(o.angle) * o.radius, o.target.y + o.height, o.target.z + Math.sin(o.angle) * o.radius);
        camera.up.copy(UP); camera.lookAt(o.target);
      } else if (k && k.renderPos) {
        // ---- chase ----
        const sm = cam._snap ? 1 : 1 - Math.exp(-8 * rdt);
        cv.fwd.lerp(k.camFwd, sm).normalize();
        cv.up.lerp(k.renderUp, cam._snap ? 1 : 1 - Math.exp(-5 * rdt)).normalize();
        // swing to the outside of a drift
        const swingT = k.drifting ? -k.driftDir * 0.105 : 0;
        cam.swing += (swingT - cam.swing) * Math.min(1, rdt * 3);
        // boss framing: signed horizontal angle from the kart's heading to the boss focus
        let yawT = 0, liftT = 0;
        const B = G.boss;
        if (cam.bossFrame > 0 && B && B.root && B.fighting && B.alive !== false) {
          if (B.camFocus && B.camFocus.isVector3) cv.boss.copy(B.camFocus); else { B.root.getWorldPosition(cv.boss); cv.boss.y += B.camFocusY ?? B.B?.camFocusY ?? (B.root === B.rig?.head ? 1 : 8); }
          cv.b.copy(cv.boss).sub(k.renderPos); const dist = cv.b.length();
          cv.b.addScaledVector(cv.up, -cv.b.dot(cv.up));
          const fx = cv.b.dot(cv.fwd);
          const side = cv.b.dot(cv.a.crossVectors(cv.up, cv.fwd));   // +: boss to the left
          const ang = Math.atan2(side, fx);
          const mx = (B.cast || B.staggered ? cam.bossYawCast : cam.bossYawMax) * cam.bossFrame;
          // fade out when the boss is behind (|ang| > 2.3 rad) or very close (it fills the view anyway)
          const behind = 1 - Math.min(1, Math.max(0, (Math.abs(ang) - 2.0) / 0.5));
          const near = Math.min(1, Math.max(0, (dist - 18) / 20));
          yawT = Math.max(-mx, Math.min(mx, ang * 0.7)) * behind * near;
          liftT = Math.min(1, Math.max(0, (cv.boss.y - k.renderPos.y) / Math.max(dist, 1))) * near * behind;
        }
        const yr = Math.min(1, rdt * (Math.abs(yawT) > Math.abs(cam.bossYaw) ? 1.6 : 2.4));
        cam.bossYaw += (yawT - cam.bossYaw) * (cam._snap ? 1 : yr); cam.bossLift += (liftT - cam.bossLift) * (cam._snap ? 1 : yr);
        cv.q.setFromAxisAngle(cv.up, cam.swing + cam.bossYaw * 0.45); cv.a.copy(cv.fwd).applyQuaternion(cv.q);
        const spd = Math.max(0, Math.min(1, (k.speed || 0) / 50));
        const pl = cam.pull; pl.t += rdt; const pullNow = pl.t < pl.dur ? pl.amt * Math.sin(Math.PI * Math.min(1, pl.t / pl.dur)) : 0;
        const dist = cam.dist + spd * 0.9 + (k.boosting ? 0.5 : 0) + pullNow;
        const ht = cam.height - spd * 0.25 + pullNow * 0.4;
        cv.pos.copy(k.renderPos).addScaledVector(cv.a, -dist).addScaledVector(cv.up, ht);
        cv.q.setFromAxisAngle(cv.up, cam.swing + cam.bossYaw); cv.b.copy(cv.fwd).applyQuaternion(cv.q);
        cv.look.copy(k.renderPos).addScaledVector(cv.b, cam.lookAhead).addScaledVector(cv.up, 0.9 + cam.bossLift * 2.2);
        // optional boss framing
        const bw = cam.boss; bw.t += rdt;
        if (bw.t < bw.dur && G.boss && G.boss.root) {
          const e = Math.sin(Math.PI * Math.min(1, bw.t / bw.dur));
          G.boss.root.getWorldPosition(cv.boss); cv.boss.y += 8;
          cv.look.lerp(cv.boss, bw.w * e);
        }
        // keep the kart in frame: boss framing + lookAtBoss may not swing the view more than KEEP rad off the kart
        {
          const KEEP = 0.5;
          cv.dl.copy(cv.look).sub(cv.pos); const ll = cv.dl.length(); cv.dk.copy(k.renderPos).sub(cv.pos);
          if (ll > 1e-3 && cv.dk.lengthSq() > 1e-6) {
            cv.dl.multiplyScalar(1 / ll); cv.dk.normalize(); const dt = cv.dl.dot(cv.dk);
            if (dt < Math.cos(KEEP)) {
              cv.dl.addScaledVector(cv.dk, -dt); const pl2 = cv.dl.length();
              if (pl2 > 1e-4) { cv.dl.multiplyScalar(Math.sin(KEEP) / pl2).addScaledVector(cv.dk, Math.cos(KEEP)); cv.look.copy(cv.pos).addScaledVector(cv.dl, ll); }
            }
          }
        }
        camera.position.copy(cv.pos);
        camera.up.copy(cv.up).lerp(UP, 0.55).normalize();
        camera.lookAt(cv.look);
        cam._snap = false;
      }
      // punch spring (k=140, damping 16)
      cv.punchV.addScaledVector(cv.punch, -140 * rdt).multiplyScalar(Math.max(0, 1 - 16 * rdt));
      cv.punch.addScaledVector(cv.punchV, rdt);
      camera.position.add(cv.punch);
      // trauma shake (real time)
      cam.trauma = Math.max(0, cam.trauma - 1.6 * rdt);
      const tr = cam.trauma * cam.trauma;
      if (tr > 1e-4) {
        const t = G.time.real * 25;
        cv.b.set(noise3(t, 1), noise3(t, 2), noise3(t, 3)).multiplyScalar(0.6 * tr);
        cv.b.applyQuaternion(camera.quaternion); camera.position.add(cv.b);
        camera.rotateZ(noise3(t, 4) * 0.0436 * tr);
      }
      // fov: base + boost/overclock + kick
      let ft = cam.fovBase;
      if (k && cam.mode === 'chase' && !cam.cinematic) {
        // boost kick as a multiplier (camera.fov is the 16:9-reference vertical FOV; see G.vfov)
        let m = 1 + Math.min(1, Math.max(0, (k.speed || 0) - 30) / 25) * 0.05;
        if (k.boosting) m += 0.12; if (k.overclockT > 0) m = Math.max(m, 1.2);
        ft *= m;
      }
      cam.fov += (ft - cam.fov) * Math.min(1, rdt * (ft > cam.fov ? 7 : 3));
      const f = cam.fov + kickNow;
      if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
    },
  };
  G.on('quality', () => {});

  // ------------------------------------------------------------------
  // Main loop (spec §2.4). Fixed 60 Hz sim, interpolated render.
  // ------------------------------------------------------------------
  const SIM_ORDER = ['input', 'kart', 'combat'];        // then any other modules, then:
  const SIM_LATE = ['track', 'fx', 'audio', 'ui'];
  const REALTIME = { input: 1, audio: 1, ui: 1 };       // these receive real DT, not scaled
  const RENDER_EARLY = ['kart', 'combat'];
  const RENDER_LATE = ['fx', 'ui', 'input'];           // after camera
  let simList = [], renderEarly = [], renderLate = [];
  function buildLists() {
    const named = new Set([...SIM_ORDER, ...SIM_LATE, 'core']);
    const others = modList.filter(m => !named.has(m.name));
    simList = [...SIM_ORDER.map(n => G.mods[n]), ...others, ...SIM_LATE.map(n => G.mods[n])].filter(m => m && m.update);
    const rnamed = new Set([...RENDER_EARLY, ...RENDER_LATE, 'core']);
    renderEarly = [...RENDER_EARLY.map(n => G.mods[n]), ...modList.filter(m => !rnamed.has(m.name))].filter(m => m && m.render);
    renderLate = RENDER_LATE.map(n => G.mods[n]).filter(m => m && m.render);
  }
  G.on('init', buildLists);

  function simStep() {
    const scale = G.time.effectiveScale();
    const simDt = G.DT * scale;
    G.time.dt = simDt;
    for (let i = 0; i < simList.length; i++) {
      const m = simList[i];
      try { m.update(REALTIME[m.name] ? G.DT : simDt, G.DT); } catch (e) { G.logError(m.name + '.update', e); }
    }
    G.time.now += simDt; G.time.frame++;
  }
  function renderFrame(rdt, alpha) {
    renderer.info.reset();
    for (let i = 0; i < renderEarly.length; i++) { const m = renderEarly[i]; try { m.render(alpha, rdt); } catch (e) { G.logError(m.name + '.render', e); } }
    cam.update(rdt);
    for (let i = 0; i < renderLate.length; i++) { const m = renderLate[i]; try { m.render(rdt, alpha); } catch (e) { G.logError(m.name + '.render', e); } }
    updatePost(rdt);
    if (gfxSafe >= 4) { renderer.setRenderTarget(null); renderer.render(scene, camera); G.perf.sceneCalls = renderer.info.render.calls; }
    else composer.render(rdt);
    gfxWatch();
    G.perf.drawCalls = renderer.info.render.calls;
    if (frameWaiters.length) flushWaiters();
  }
  const frameWaiters = [];
  function flushWaiters() { const w = frameWaiters.splice(0); for (const f of w) f(); }
  G.nextFrame = () => new Promise(r => frameWaiters.push(r));

  let acc = 0, last = 0, running = false, lastAlpha = 0;
  function frame(nowMs) {
    requestAnimationFrame(frame);
    let rdt = last ? (nowMs - last) / 1000 : G.DT; last = nowMs;
    rdt = Math.min(Math.max(rdt, 0), 0.1);
    G.time.real += rdt;
    adapt(rdt);
    if (!G.time.paused) {
      acc += rdt; let steps = 0;
      while (acc >= G.DT && steps < 4) { simStep(); acc -= G.DT; steps++; }
      if (steps >= 4) acc = Math.min(acc, G.DT);
    }
    lastAlpha = acc / G.DT;
    renderFrame(rdt, lastAlpha);
  }
  G.loop = {
    start() { if (running) return; running = true; buildLists(); requestAnimationFrame(frame); },
    // test hook: advance n fixed steps synchronously (works while paused), then render once
    step(n = 1) { for (let i = 0; i < n; i++) { G.time.real += G.DT; simStep(); } renderFrame(G.DT, 1); },
    simStep, renderFrame,
  };

  // Black-screen watchdog. For the first seconds of rendering, sample nine canvas pixels right after the frame is
  // drawn (no preserveDrawingBuffer needed). The clear colour and sky are never pure black, so ~1.5 s of all-zero
  // samples means the post chain is failing on this GPU: step down one safe level and remember it.
  function applyGfxSafe() {
    G.perf.gfxSafe = gfxSafe;
    setMSAA(G.quality.settings.msaa);
    if (gfxSafe >= 2) {
      const rts = [composer.renderTarget1, composer.renderTarget2, bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical];
      for (const rt of rts) if (rt && rt.texture.type !== THREE.UnsignedByteType) { rt.texture.type = THREE.UnsignedByteType; rt.dispose(); }
      if (G.post_hdr) { G.post_hdr = false; bloom.threshold = G.bloomDefaults.threshold = 0.85; }
    }
    bloom.enabled = gfxSafe < 3;
  }
  let watchLeft = 40, blackRun = 0, lastCheck = 0;
  const px = new Uint8Array(4);
  function gfxWatch() {
    const now = performance.now();
    if (watchLeft <= 0 || gfxSafe >= 4 || now - lastCheck < 250) return;
    lastCheck = now;
    // 3x3 grid; "black" = at least 7 exactly-zero samples (the final pass still draws speed lines over a dead scene)
    let zeros = 0;
    try {
      const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      renderer.setRenderTarget(null);
      for (let i = 0; i < 9; i++) {
        gl.readPixels((w * (0.3 + 0.2 * (i % 3))) | 0, (h * (0.3 + 0.2 * ((i / 3) | 0))) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        if (!(px[0] || px[1] || px[2])) zeros++;
      }
    } catch (e) { watchLeft = 0; return; }
    const black = zeros >= 7;
    if (!black) { blackRun = 0; watchLeft--; return; }
    if (++blackRun < 6) return;
    blackRun = 0; watchLeft = 40; gfxSafe++;
    console.warn('[gfx] black frames detected, safe level ->', gfxSafe);
    try { localStorage.setItem('db_gfx_safe', String(gfxSafe)); } catch (e) { /* ignore */ }
    applyGfxSafe();
  }
  G.gfx = { get safe() { return gfxSafe; }, set(n) { gfxSafe = Math.max(0, Math.min(4, n | 0)); applyGfxSafe(); } };

  G.quality.set(G.params.quality !== 'auto' && TIERS[G.params.quality] ? G.params.quality : (isCoarse ? 'med' : 'high'));
  G.quality.auto = G.params.quality === 'auto';
  applyGfxSafe();
  resize();

  G.register('core', {});
}
