// =============================================================================
//  §4  Renderer & Post — WebGLRenderer, EffectComposer
//      (RenderPass → UnrealBloomPass → FinalPass → OutputPass), the player
//      "stay saturated" mask, global shader uniforms and the quality manager.
// =============================================================================

/** Uniforms shared by reference across many shaders (skies, floors, arcane, particles…). */
const GLOBAL_U = {
  uTime: { value: 0 },        // sim time (slows with hit-stop / slow-mo)
  uRealTime: { value: 0 },    // wall time
  uOccP: { value: new THREE.Vector3(0, -100, 0) },  // player chest (world) — arcane {occluder:true} meshes dither out between camera and player
  uOccNear: { value: 4 },     // occluder fragments closer than this to the camera dither out too (raised during cinematic rails)
  uStreak: { value: 0 },      // 0..1 star streak (Zero Hour, intros) — every sky shader should read it
  uOctaves: { value: 4 },     // FBM octave budget from the quality tier
  uArenaClip: { value: 1e4 }, // telegraphs/hazards are clipped to this world radius (arena edge); 1e4 = off
};

function showFatal(msg) { try { (window.__raidFail || console.error)(msg); } catch (e) { console.error(msg); } }

const canvas = $('c');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false, depth: true });
} catch (e) {
  showFatal('WebGL is not available: ' + (e && e.message));
  throw e;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x04060b, 1);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 16 / 9, 0.1, 2400);
camera.position.set(0, 10, 14);
camera.layers.enable(1);          // layer 1 = the player + Echo (used for the saturation mask)
scene.add(camera);

// webgl context loss → "Tap to reload"
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  $('ctxlost').classList.remove('hidden');
  Game.paused = true;
}, false);

// ---------------------------------------------------------------- viewport
const View = { w: 1280, h: 720, dpr: 1, portrait: false, compact: false, touch: false };
function readViewport() {
  const vv = window.visualViewport;
  View.w = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
  View.h = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
  View.dpr = window.devicePixelRatio || 1;
  View.portrait = View.h > View.w * 1.05;
  View.compact = Math.min(View.w, View.h) < 500;
}
readViewport();

// ---------------------------------------------------------------- FinalPass shader
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, tMask: { value: null }, uMaskOn: { value: 0 },
    uRes: { value: new THREE.Vector2(1280, 720) }, uTime: GLOBAL_U.uRealTime,
    uCA: { value: CONFIG.post.ca }, uVig: { value: CONFIG.post.vignette }, uHurt: { value: 0 }, uBeat: { value: 0 },
    uGrain: { value: CONFIG.post.grain }, uDesat: { value: 0 },
    uZoom: { value: 0 }, uZoomC: { value: new THREE.Vector2(0.5, 0.5) },
    uBH: { value: new THREE.Vector2(0.5, 0.8) }, uBHStr: { value: 0 }, uBHCore: { value: 0 },
    uHaze: { value: 0 },
    uLift: { value: new THREE.Vector3(0, 0, 0) }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSat: { value: 1 }, uSatKeep: { value: 0 },
    uWhite: { value: 0 }, uTunnel: { value: 0 }, uSepia: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform sampler2D tMask; uniform float uMaskOn;
    uniform vec2 uRes; uniform float uTime;
    uniform float uCA, uVig, uHurt, uBeat, uGrain, uDesat, uZoom; uniform vec2 uZoomC;
    uniform vec2 uBH; uniform float uBHStr, uBHCore, uHaze;
    uniform vec3 uLift, uGamma, uGain; uniform float uSat, uSatKeep, uWhite, uTunnel, uSepia;
    varying vec2 vUv;
    ${GLSL_NOISE}
    vec3 sampleCA(vec2 uv, vec2 d){
      return vec3(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b);
    }
    float hue(vec3 c){
      float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), d = mx - mn + 1e-5;
      float h = mx == c.r ? (c.g - c.b) / d : (mx == c.g ? 2.0 + (c.b - c.r) / d : 4.0 + (c.r - c.g) / d);
      return fract(h / 6.0);
    }
    void main(){
      vec2 uv = vUv;
      float aspect = uRes.x / uRes.y;
      float core = 0.0;
      // ---- black-hole lensing (Boss 3, Medium/High)
      if (uBHStr > 0.00001){
        vec2 d = uv - uBH; d.x *= aspect; float r = length(d);
        vec2 dir = d / max(r, 1e-4);
        float off = min(uBHStr / max(r, 0.02), 0.3);
        vec2 o = dir * off; o.x /= aspect;
        uv -= o;
        core = 1.0 - smoothstep(uBHCore * 0.82, uBHCore, r);
      }
      // ---- heat haze (bottom 25%)
      if (uHaze > 0.001){
        float m = smoothstep(0.3, 0.0, vUv.y) * uHaze;
        uv.x += (vnoise(vec2(vUv.y * 38.0, uTime * 3.1)) - 0.5) * 0.007 * m;
        uv.y += (vnoise(vec2(vUv.x * 30.0 + 7.0, uTime * 2.4)) - 0.5) * 0.004 * m;
      }
      vec2 c = uv - 0.5;
      vec2 caDir = c * uCA * 2.0;
      vec3 col;
      // ---- radial zoom blur (8 taps) + chromatic aberration
      if (uZoom > 0.001){
        vec2 zc = uv - uZoomC; col = vec3(0.0);
        for (int i = 0; i < 8; i++){ float k = 1.0 - uZoom * 0.3 * float(i) / 7.0; col += sampleCA(uZoomC + zc * k, caDir); }
        col /= 8.0;
      } else col = sampleCA(uv, caDir);
      const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
      float lum = dot(col, LW);
      float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
      float sat = (mx - mn) / (mx + 1e-4);
      float h = hue(col);
      float gold = smoothstep(0.25, 0.5, sat) * (1.0 - smoothstep(0.035, 0.07, abs(h - 0.115)));
      float magenta = smoothstep(0.25, 0.5, sat) * (1.0 - smoothstep(0.04, 0.08, abs(h - 0.87)));
      // ---- desaturation with gold-preserve + player mask
      float keep = uMaskOn > 0.5 ? texture2D(tMask, vUv).r : 0.0;
      col = mix(col, vec3(lum), uDesat * (1.0 - max(gold, keep)));
      // ---- lift / gamma / gain grade
      col = col * uGain + uLift * (1.0 - clamp(lum, 0.0, 1.0));
      col = pow(max(col, 0.0), 1.0 / uGamma);
      float l2 = dot(col, LW);
      col = mix(vec3(l2), col, mix(uSat, 1.0, uSatKeep * max(gold, magenta)));
      col = mix(col, vec3(l2) * vec3(1.25, 1.0, 0.72), uSepia);
      col *= 1.0 - core;
      // ---- vignette, tunnel, hurt pulse
      float rr = length(vec2(c.x * mix(1.0, aspect, 0.5), c.y)) * 1.35;
      col *= 1.0 - smoothstep(0.35, 1.05, rr) * uVig;
      col *= 1.0 - smoothstep(0.15, 0.95, rr) * uTunnel;
      float edge = smoothstep(0.45, 1.05, rr);
      col = mix(col, vec3(0.45, 0.015, 0.0), edge * clamp(uHurt + uBeat, 0.0, 1.0) * 0.85);
      // ---- grain
      float g = hash12(vUv * uRes + fract(uTime * 13.17) * 197.0) - 0.5;
      col += g * uGrain * (0.2 + sqrt(max(l2, 0.0)));
      // ---- whiteout (enrage / heat death)
      col = mix(col, vec3(6.0), uWhite);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// ---------------------------------------------------------------- Post
const Post = {
  enabled: URLP.get('nofx') !== '1',
  composer: null, renderPass: null, bloom: null, final: null, output: null,
  maskRT: null, maskMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  bloomBase: CONFIG.post.bloom.strength, bloomKick: 0,
  caKick: 0, hurt: 0, beat: 0,
  desatPulseV: 0, desatPulseT: 0, desatPulseDur: 0, desatHold: 0, desatCur: 0,
  zoomBlur: 0, zoomC: new THREE.Vector2(0.5, 0.5), whiteout: 0, tunnel: 0, sepia: 0,
  lensStr: 0, lensCore: 0, haze: 0,
  gradeFrom: { lift: new THREE.Vector3(), gamma: new THREE.Vector3(1, 1, 1), gain: new THREE.Vector3(1, 1, 1), sat: 1, satKeep: 0 },
  gradeTo: { lift: new THREE.Vector3(), gamma: new THREE.Vector3(1, 1, 1), gain: new THREE.Vector3(1, 1, 1), sat: 1, satKeep: 0 },
  gradeT: 1, gradeDur: CONFIG.post.gradeLerp,
  exposureFrom: 1, exposureTo: 1,

  init() {
    if (!this.enabled) return;
    const c = new EffectComposer(renderer);
    c.setPixelRatio(renderer.getPixelRatio());
    this.composer = c;
    this.renderPass = new RenderPass(scene, camera);
    c.addPass(this.renderPass);
    const b = new UnrealBloomPass(new THREE.Vector2(View.w, View.h), CONFIG.post.bloom.strength, CONFIG.post.bloom.radius, CONFIG.post.bloom.threshold);
    // half-resolution bloom on Medium/Low: wrap setSize
    const origSet = b.setSize.bind(b);
    b.setSize = (w, h) => {
      const k = Quality.tier && Quality.tier.bloomHalf ? 0.5 : 1;
      origSet(Math.max(2, Math.round(w * k)), Math.max(2, Math.round(h * k)));
      // resolution-aware mip weights: the blur kernels are fixed in *pixels*, so on a small bloom target (phones,
      // half-res tiers) the widest mips cover the whole screen and veil the frame in a milky wash. Attenuate the
      // wide mips (and the radius) as the target shrinks so the glow keeps the same on-screen footprint.
      const res = Math.sqrt(Math.max(4, w * k * h * k));
      const s = clamp((res - 260) / (1500 - 260), 0, 1);
      this.bloomRadiusK = lerp(0.25, 1, s);
      this.bloomBaseK = lerp(0.85, 1, s); this.bloomKickK = lerp(0.3, 1, s);   // flash kicks flood small targets
      const wide = [1, 1, lerp(0.7, 1, s), lerp(0.42, 1, s), lerp(0.22, 1, s)];
      for (let i = 0; i < b.bloomTintColors.length; i++) b.bloomTintColors[i].setScalar(wide[i]);
    };
    // NaN/Inf guard: one bad pixel would otherwise smear across every bloom mip and black out the frame
    const hpf = b.materialHighPassFilter;
    hpf.fragmentShader = hpf.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );',
      'vec4 texel = texture2D( tDiffuse, vUv ); if (any(isnan(texel)) || any(isinf(texel))) texel = vec4(0.0); texel = min(texel, vec4(64.0));');
    hpf.needsUpdate = true;
    this.bloom = b; c.addPass(b);
    this.final = new ShaderPass(new THREE.ShaderMaterial(FinalShader));
    c.addPass(this.final);
    this.output = new OutputPass();
    c.addPass(this.output);
    this.maskRT = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true });
    this.final.uniforms.tMask.value = this.maskRT.texture;
  },
  get U() { return this.final ? this.final.uniforms : FinalShader.uniforms; },

  // ---- kick / pulse API (all real-time)
  kickCA(v) { this.caKick = Math.max(this.caKick, v); },
  kickBloom(v, dur) { this.bloomKick = Math.max(this.bloomKick, v); this.bloomKickDecay = v / Math.max(0.05, dur || 0.25); },
  hurtPulse(v) { this.hurt = Math.min(1, Math.max(this.hurt, v)); },
  /** brief desaturation (SLIPSTREAM etc.) */
  desatPulse(v, dur) { this.desatPulseV = Math.max(this.desatPulseV * (this.desatPulseT > 0 ? 1 : 0), v); this.desatPulseT = dur; this.desatPulseDur = dur; },
  /** held desaturation 0..1 (Zero Hour, death) — set back to 0 to release */
  setDesatHold(v) { this.desatHold = v; },
  zoomPulse(v, cx = 0.5, cy = 0.5) { this.zoomBlur = Math.max(this.zoomBlur, v); this.zoomC.set(cx, cy); },
  /** grade = {lift:[r,g,b], gain:[r,g,b], gamma:[r,g,b], sat, satKeep} lerped over dur (default 1.5 s) */
  setGrade(g, dur) {
    const U = this.U;
    this.gradeFrom.lift.copy(U.uLift.value); this.gradeFrom.gamma.copy(U.uGamma.value); this.gradeFrom.gain.copy(U.uGain.value);
    this.gradeFrom.sat = U.uSat.value; this.gradeFrom.satKeep = U.uSatKeep.value;
    const T = this.gradeTo;
    T.lift.fromArray(g.lift || [0, 0, 0]); T.gamma.fromArray(g.gamma || [1, 1, 1]); T.gain.fromArray(g.gain || [1, 1, 1]);
    T.sat = g.sat != null ? g.sat : 1; T.satKeep = g.satKeep != null ? g.satKeep : (T.sat < 1 ? 1 : 0);
    this.gradeDur = dur != null ? dur : CONFIG.post.gradeLerp; this.gradeT = this.gradeDur > 0 ? 0 : 1;
    if (this.gradeDur <= 0) this._applyGrade(1);
  },
  _applyGrade(k) {
    const U = this.U, F = this.gradeFrom, T = this.gradeTo;
    U.uLift.value.lerpVectors(F.lift, T.lift, k); U.uGamma.value.lerpVectors(F.gamma, T.gamma, k); U.uGain.value.lerpVectors(F.gain, T.gain, k);
    U.uSat.value = lerp(F.sat, T.sat, k); U.uSatKeep.value = lerp(F.satKeep, T.satKeep, k);
  },
  setExposure(v, dur) { this.exposureFrom = renderer.toneMappingExposure; this.exposureTo = v; this.expT = 0; this.expDur = dur || 0.001; },
  setBloomBase(v) { this.bloomBase = v; },

  update(dt) {
    const U = this.U;
    // CA spike decays over ~0.25 s
    this.caKick = Math.max(0, this.caKick - dt * (0.006 / CONFIG.post.caDecay));
    U.uCA.value = CONFIG.post.ca + this.caKick;
    // bloom kick
    if (this.bloomKick > 0) this.bloomKick = Math.max(0, this.bloomKick - dt * (this.bloomKickDecay || 3));
    if (this.bloom) { this.bloom.strength = this.bloomBase * (this.bloomBaseK != null ? this.bloomBaseK : 1) + this.bloomKick * (this.bloomKickK != null ? this.bloomKickK : 1); this.bloom.radius = CONFIG.post.bloom.radius * (this.bloomRadiusK != null ? this.bloomRadiusK : 1); }
    // hurt + low-HP heartbeat
    this.hurt = Math.max(0, this.hurt - dt * 2.2);
    U.uHurt.value = this.hurt;
    const p = Game.player;
    let beat = 0;
    if (p && p.alive && p.hp < p.maxHp * 0.3 && (Game.state === 'fight' || Game.state === 'transition')) {
      const ph = (Game.realTime * 1.25) % 1;           // ~75 bpm
      beat = (Math.exp(-ph * 14) + 0.6 * Math.exp(-Math.max(0, ph - 0.22) * 14) * (ph > 0.22 ? 1 : 0)) * 0.55 * (1 - p.hp / (p.maxHp * 0.3) * 0.6);
      if (ph < this._lastBeatPh) Audio.sfx('heartbeat');
      this._lastBeatPh = ph;
    }
    U.uBeat.value = beat;
    // desaturation
    if (this.desatPulseT > 0) this.desatPulseT -= dt;
    const pulse = this.desatPulseT > 0 ? this.desatPulseV * Math.min(1, this.desatPulseT / Math.max(0.05, this.desatPulseDur * 0.35)) : 0;
    const target = Math.max(pulse, this.desatHold);
    this.desatCur = damp(this.desatCur, target, target > this.desatCur ? 30 : 8, dt);
    if (this.desatCur < 0.003) this.desatCur = 0;
    U.uDesat.value = this.desatCur;
    // zoom blur
    this.zoomBlur = Math.max(0, this.zoomBlur - dt * 2.5);
    U.uZoom.value = this.zoomBlur; U.uZoomC.value.copy(this.zoomC);
    U.uWhite.value = this.whiteout; U.uTunnel.value = this.tunnel; U.uSepia.value = this.sepia;
    U.uBHStr.value = Quality.tier.lensing ? this.lensStr : 0; U.uBHCore.value = this.lensCore;
    U.uHaze.value = Quality.tier.haze ? this.haze : 0;
    // grade lerp
    if (this.gradeT < 1) { this.gradeT = Math.min(1, this.gradeT + dt / this.gradeDur); this._applyGrade(smooth01(this.gradeT)); }
    if (this.expDur && this.expT < this.expDur) { this.expT += dt; renderer.toneMappingExposure = lerp(this.exposureFrom, this.exposureTo, smooth01(this.expT / this.expDur)); }
  },

  /** compile every material in the scene for the variant the frame really uses: the RenderPass draws into the
   *  composer's linear, un-tonemapped target, so compiling against the canvas (sRGB + ACES) would build the wrong programs */
  compileScene() {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.composer ? this.composer.readBuffer : null);
    try { renderer.compile(scene, camera); } finally { renderer.setRenderTarget(prev); }
  },

  render(dt) {
    if (!this.composer) { renderer.render(scene, camera); return; }
    const U = this.U;
    // player stays saturated while the world desaturates (§8.1.3): render a layer-1 mask
    if (this.desatCur > 0.01) {
      const prevMask = camera.layers.mask;
      camera.layers.set(1);
      scene.overrideMaterial = this.maskMat;
      renderer.setRenderTarget(this.maskRT);
      renderer.setClearColor(0x000000, 1); renderer.clear(true, true, false);
      renderer.render(scene, camera);
      scene.overrideMaterial = null;
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x04060b, 1);
      camera.layers.mask = prevMask;
      U.uMaskOn.value = 1;
    } else U.uMaskOn.value = 0;
    this.composer.render(dt);
  },

  resize() {
    const pr = renderer.getPixelRatio();
    this.U.uRes.value.set(View.w * pr, View.h * pr);
    if (!this.composer) return;
    this.composer.setPixelRatio(pr);
    this.composer.setSize(View.w, View.h);
    this.maskRT.setSize(Math.max(2, Math.round(View.w * pr * 0.5)), Math.max(2, Math.round(View.h * pr * 0.5)));
  },
};

// ---------------------------------------------------------------- Quality manager (§12)
const Quality = {
  mode: 'auto', tier: CONFIG.quality.high, pr: 1,
  samples: 0, accMs: 0, windowT: 0, fastT: 0, lastChange: -10,
  listeners: [],
  onChange(fn) { this.listeners.push(fn); },
  startTier() {
    const touch = View.touch || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const shortSide = Math.min(screen.width || View.w, screen.height || View.h);
    return (touch && shortSide < 900) ? 'medium' : 'high';
  },
  init() {
    const q = URLP.get('quality');
    this.mode = (q && (q === 'auto' || CONFIG.quality[q])) ? q : (Save.data.quality || 'auto');
    this.setTier(this.mode === 'auto' ? this.startTier() : this.mode, true);
  },
  setMode(m) {
    this.mode = m; Save.data.quality = m; Save.save();
    this.setTier(m === 'auto' ? this.startTier() : m, true);
  },
  cycle() { const order = ['auto', 'low', 'medium', 'high']; this.setMode(order[(order.indexOf(this.mode) + 1) % order.length]); return this.mode; },
  /** live = an automatic change during a fight: a shadow on/off flip recompiles every lit program (a multi-second
   *  freeze on the device that is already struggling), so it keeps the current shadow state until applyPending() */
  setTier(id, resetPr, live) {
    const prevShadows = this.tier && this.tier.shadows;
    let t = CONFIG.quality[id];
    if (live && prevShadows != null && t.shadows !== prevShadows) t = Object.assign({}, t, { shadows: prevShadows, shadowsPending: true });
    this.tier = t;
    if (resetPr) this.pr = Math.min(View.dpr, this.tier.prMax);
    this.pr = clamp(this.pr, Math.min(this.tier.prMin, View.dpr), Math.min(View.dpr, this.tier.prMax));
    GLOBAL_U.uOctaves.value = this.tier.octaves;
    if (prevShadows !== this.tier.shadows) {
      renderer.shadowMap.enabled = this.tier.shadows;
      scene.traverse((o) => { if (o.material) { const m = o.material; if (Array.isArray(m)) m.forEach((x) => x.needsUpdate = true); else m.needsUpdate = true; } });
    }
    this.lastChange = performance.now() / 1000;
    applyResize();
    for (const fn of this.listeners) fn(this.tier);
  },
  /** apply a deferred shadow flip (called on fight setup / teardown, behind a transition) */
  applyPending() { if (this.tier && this.tier.shadowsPending) this.setTier(this.tier.id, false); },
  /** called every frame with the real frame time (ms) */
  sample(ms) {
    if (this.mode !== 'auto' || Game.paused || Game.hidden) return;
    const wall = ms; ms = Math.min(ms, 100);                       // wall-clock window, clamped average
    this.accMs += ms; this.samples++; this.windowT += wall / 1000;
    if (this.windowT < CONFIG.quality.sampleWindow) return;
    const avg = this.accMs / this.samples; this.accMs = 0; this.samples = 0; this.windowT = 0;
    this.lastAvg = avg;
    const now = performance.now() / 1000;
    if (now - this.lastChange < CONFIG.quality.minChangeGap) return;
    const order = ['low', 'medium', 'high'], i = order.indexOf(this.tier.id);
    if (avg > CONFIG.quality.slowMs) {
      this.fastT = 0;
      if (this.pr - CONFIG.quality.prStep >= this.tier.prMin - 1e-3) { this.pr -= CONFIG.quality.prStep; this.lastChange = now; applyResize(); }
      else if (i > 0) { this.setTier(order[i - 1], false, Game.state !== 'title'); this.lastChange = now; }
    } else if (avg < CONFIG.quality.fastMs) {
      this.fastT += CONFIG.quality.sampleWindow;
      if (this.fastT >= CONFIG.quality.fastHold) {
        this.fastT = 0;
        const cap = Math.min(View.dpr, this.tier.prMax);
        if (this.pr + CONFIG.quality.prStep <= cap + 1e-3) { this.pr += CONFIG.quality.prStep; this.lastChange = now; applyResize(); }
        else if (i < 2) { this.setTier(order[i + 1], false, Game.state !== 'title'); this.lastChange = now; }
      }
    } else this.fastT = 0;
  },
  get label() { return (this.mode === 'auto' ? 'AUTO·' : '') + this.tier.id.toUpperCase(); },
};

// ---------------------------------------------------------------- resize
const resizeListeners = [];
function applyResize() {
  readViewport();
  document.body.classList.toggle('portrait', View.portrait);
  document.body.classList.toggle('compact', View.compact);
  // portrait: ×0.85, shrinking a little more on short screens (Safari with toolbars, 390×664) so the thumb cluster
  // pulls toward the corner and away from the player; floor 0.75 keeps the smallest button ≥ 44 px
  document.documentElement.style.setProperty('--ui-scale', View.portrait ? (0.85 * clamp(View.h / 844, 0.88, 1)).toFixed(3) : (View.h < 420 ? '0.92' : '1'));
  renderer.setPixelRatio(Quality.pr || 1);
  renderer.setSize(View.w, View.h, true);
  camera.aspect = View.w / View.h;
  camera.updateProjectionMatrix();
  Post.resize();
  for (const fn of resizeListeners) fn();
}
window.addEventListener('resize', applyResize);
window.addEventListener('orientationchange', () => setTimeout(applyResize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', applyResize);

/** Enable layer 1 on every light so layer-1 renders stay lit (call after building an arena). */
function syncLightLayers(root) { (root || scene).traverse((o) => { if (o.isLight) o.layers.enable(1); }); }
/** Put an object tree on layer 1 only (player / Echo). */
function setLayer1(obj) { obj.traverse((o) => o.layers.set(1)); }

/** Project a world position to CSS pixels. Returns false when behind the camera. */
function worldToScreen(v, out) {
  _v8.copy(v).project(camera);
  out.x = (_v8.x * 0.5 + 0.5) * View.w;
  out.y = (-_v8.y * 0.5 + 0.5) * View.h;
  out.z = _v8.z;
  return _v8.z < 1;
}
