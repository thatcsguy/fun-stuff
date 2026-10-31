// =====================================================================
// 01_core.js (REGICIDE; forked from perihelion): imports, G namespace, params, math, seeded rand, events,
// renderer/scene/camera, layers, post chain (bloom + grade), safe levels,
// black-screen watchdog, quality tiers, camera rig, state, loop.
// =====================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const G = window.G = { THREE };

(() => {
  // ------------------------------------------------------------------
  // URL params
  // ------------------------------------------------------------------
  const qs = new URLSearchParams(location.search);
  const intOr = (k, d) => { const v = qs.get(k); if (v === null || v === '') return d; const n = parseInt(v, 10); return isNaN(n) ? d : n; };
  const flag = (k) => { const v = qs.get(k); return v !== null && v !== '0' && v !== 'false'; };
  G.params = {
    boss: intOr('boss', null),             // 1-indexed as in the URL (null = menu)
    practice: flag('practice'),
    debug: flag('debug'),
    bot: intOr('bot', 0),
    quality: (qs.get('quality') || 'auto').toLowerCase(),
    safe: intOr('safe', null),
    seed: intOr('seed', null),
    mute: flag('mute'),
    phase: intOr('phase', null),           // 1-indexed phase to start at (debug)
    run: flag('run'),                      // start a new run straight away
    edicts: (qs.get('edicts') || '').split(',').filter(Boolean),
    skipintro: flag('skipintro'),
    testboss: (qs.get('testboss') || '') === 'all' ? 'all' : flag('testboss'),
  };

  G.isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  G.isTouch = (matchMedia && matchMedia('(pointer:coarse)').matches) || G.isIOS || ('ontouchstart' in window && navigator.maxTouchPoints > 0);

  // ------------------------------------------------------------------
  // Constants + math helpers
  // ------------------------------------------------------------------
  G.RINGS = [5.5, 9.0, 12.5];   // legacy (fx.ringFlash); the arena is a free disc
  G.ARENA_R = 13;                // playable disc radius (see G.world.arenaR for the live, shrinkable value)
  G.OMEGA = 0.6;
  G.TRACK_W = 1.3;
  const PI = Math.PI, TAU = PI * 2;
  G.PI = PI; G.TAU = TAU;
  G.polar = (r, theta, y = 0, out) => (out || new THREE.Vector3()).set(r * Math.cos(theta), y, -r * Math.sin(theta));
  G.thetaOf = (v) => Math.atan2(-v.z, v.x);                               // inverse of polar (angle of a point)
  G.wrap = (a) => { a = (a + PI) % TAU; if (a <= 0) a += TAU; return a - PI; };   // to (-PI, PI]
  G.angDiff = (a, b) => G.wrap(a - b);
  G.inArc = (a, center, halfWidth) => Math.abs(G.angDiff(a, center)) <= halfWidth;
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  G.smooth = (t) => { t = G.clamp(t); return t * t * (3 - 2 * t); };
  G.smoother = (t) => { t = G.clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  G.easeOutCubic = (t) => { t = G.clamp(t); return 1 - Math.pow(1 - t, 3); };
  G.easeInCubic = (t) => { t = G.clamp(t); return t * t * t; };
  G.easeInOutCubic = (t) => { t = G.clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  G.easeOutBack = (t) => { t = G.clamp(t); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  G.easeOutElastic = (t) => { t = G.clamp(t); return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1; };
  G.remap = (x, a, b, c, d) => c + (d - c) * G.clamp((x - a) / (b - a));
  G.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));     // frame-rate independent approach
  G.lerpAngle = (a, b, t) => a + G.angDiff(b, a) * t;
  G.deg = (d) => d * PI / 180;

  // ------------------------------------------------------------------
  // Seeded rand (mulberry32). Gameplay uses G.rand; visuals may use Math.random.
  // ------------------------------------------------------------------
  let rs = 1;
  G.reseed = (n) => { rs = (n >>> 0) || 1; G.seed = rs; };
  G.rand = () => {
    rs |= 0; rs = (rs + 0x6D2B79F5) | 0;
    let t = Math.imul(rs ^ (rs >>> 15), 1 | rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  G.randRange = (a, b) => a + (b - a) * G.rand();
  G.randInt = (a, b) => Math.floor(a + (b - a + 1) * G.rand());   // inclusive
  G.randPick = (arr) => arr[Math.floor(G.rand() * arr.length)];
  G.reseed(G.params.seed != null ? G.params.seed : 12345);

  // ------------------------------------------------------------------
  // Log
  // ------------------------------------------------------------------
  const seenWhere = {};
  G.log = {
    count: 0, errors: [],
    error(where, e) {
      G.log.count++;
      const msg = String((e && (e.stack || e.message)) || e);
      if (G.log.errors.length < 60) G.log.errors.push({ where, msg: msg.slice(0, 400), t: G.t });
      seenWhere[where] = (seenWhere[where] || 0) + 1;
      if (seenWhere[where] <= 3) console.error('[' + where + ']', e);
    },
    warn(...a) { if (G.params.debug) console.warn('[rg]', ...a); },
    info(...a) { if (G.params.debug) console.log('[rg]', ...a); },
  };

  // ------------------------------------------------------------------
  // Event bus
  // ------------------------------------------------------------------
  const listeners = {};
  G.eventLog = [];
  G.on = (evt, fn) => { (listeners[evt] || (listeners[evt] = [])).push(fn); return fn; };
  G.off = (evt, fn) => { const l = listeners[evt]; if (!l) return; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
  G.once = (evt, fn) => { const w = (d) => { G.off(evt, w); fn(d); }; return G.on(evt, w); };
  G.emit = (evt, data) => {
    G.eventLog.push({ t: +(G.t || 0).toFixed(3), evt });
    if (G.eventLog.length > 300) G.eventLog.shift();
    const l = listeners[evt]; if (!l) return;
    const copy = l.slice();
    for (let i = 0; i < copy.length; i++) { try { copy[i](data, evt); } catch (e) { G.log.error('on:' + evt, e); } }
  };

  // ------------------------------------------------------------------
  // Shared state fields
  // ------------------------------------------------------------------
  G.bosses = G.bosses || [];
  G.colors = { gold: '#ffc94d', goldHot: '#fff1c2', indigo: '#0b0a24', void: '#04030c', brass: '#b8893a', accent: '#5fe3ff' };
  G.t = 0;           // fight time
  G.now = 0;         // real clock (s since start)
  G.rdt = 1 / 60;
  G.dt = 1 / 60;
  G.timeScale = 1;
  G.baseTimeScale = 1;   // extra: test hook multiplier
  G.frame = 0;
  let state = 'boot';
  Object.defineProperty(G, 'state', {
    get() { return state; },
    set(s) { if (s === state) return; const from = state; state = s; G.emit('stateChange', { from, to: s }); },
    enumerable: true,
  });
  G.setState = (s) => { G.state = s; };
  const T_STATES = { fight: 1, cinematic: 1, practice: 1 };

  // ------------------------------------------------------------------
  // Textures + materials (generated, cached)
  // ------------------------------------------------------------------
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
    return t;
  };
  G.canvasTex = canvasTex;
  const texCache = {};
  const texMakers = {
    glow: () => canvasTex(128, 128, (x, w) => {
      const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.22)'); g.addColorStop(0.75, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, w);
    }),
    star: () => canvasTex(128, 128, (x, w) => {
      const c = w / 2;
      const g = x.createRadialGradient(c, c, 0, c, c, c * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, w);
      x.globalCompositeOperation = 'lighter';
      for (const [len, wid, rot] of [[c * 0.98, 3.2, 0], [c * 0.98, 3.2, PI / 2], [c * 0.5, 1.6, PI / 4], [c * 0.5, 1.6, -PI / 4]]) {
        x.save(); x.translate(c, c); x.rotate(rot);
        const lg = x.createLinearGradient(-len, 0, len, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = lg; x.beginPath(); x.ellipse(0, 0, len, wid, 0, 0, TAU); x.fill(); x.restore();
      }
    }),
    ring: () => canvasTex(128, 128, (x, w) => {
      const c = w / 2;
      const g = x.createRadialGradient(c, c, c * 0.62, c, c, c);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,1)'); g.addColorStop(0.75, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, w);
    }),
    dot: () => canvasTex(32, 32, (x, w) => {
      const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, w);
    }),
  };
  G.tex = {};
  for (const k of Object.keys(texMakers)) Object.defineProperty(G.tex, k, { get() { return texCache[k] || (texCache[k] = texMakers[k]()); }, enumerable: true });

  const matCache = {};
  const col = (c) => (c && c.isColor) ? c.clone() : new THREE.Color(c == null ? 0xffffff : c);
  G.mat = {
    // brass metal; shared instance when called without options
    brass(opts) {
      if (!opts && matCache.brass) return matCache.brass;
      const o = opts || {};
      const m = new THREE.MeshStandardMaterial({
        color: col(o.color || '#c9963f'), metalness: o.metalness ?? 0.9, roughness: o.roughness ?? 0.35,
        emissive: col(o.emissive || '#000000'), emissiveIntensity: o.emissiveIntensity ?? 1,
        map: o.map || null, roughnessMap: o.roughnessMap || null, emissiveMap: o.emissiveMap || null,
        envMapIntensity: o.envMapIntensity ?? 1.0, side: o.side ?? THREE.FrontSide,
        transparent: !!o.transparent, opacity: o.opacity ?? 1, flatShading: !!o.flatShading,
      });
      if (!opts) { matCache.brass = m; m.userData.shared = true; }   // teardown (combat removeObj) skips shared materials
      return m;
    },
    // HDR-bright unlit material (color * intensity) so it blooms
    emissive(color, intensity = 1.5, opts = {}) {
      const c = col(color).multiplyScalar(intensity);
      return new THREE.MeshBasicMaterial({ color: c, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide, toneMapped: false, depthWrite: opts.depthWrite ?? true, fog: false });
    },
    additive(color, opacity = 1, opts = {}) {
      return new THREE.MeshBasicMaterial({ color: col(color).multiplyScalar(opts.intensity ?? 1), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: opts.side ?? THREE.DoubleSide, map: opts.map || null, toneMapped: false, fog: false });
    },
    glowSprite(color = '#ffffff', size = 1, opts = {}) {
      const m = new THREE.SpriteMaterial({ map: opts.map || G.tex.glow, color: col(color).multiplyScalar(opts.intensity ?? 1), transparent: true, opacity: opts.opacity ?? 1, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: opts.depthTest ?? true, toneMapped: false, fog: false });
      const s = new THREE.Sprite(m); s.scale.setScalar(size); s.renderOrder = opts.renderOrder ?? 5;
      return s;
    },
  };

  // ------------------------------------------------------------------
  // Quality + safe level definitions
  // ------------------------------------------------------------------
  const TIERS = {
    high: { name: 'high', dprCap: 2, bloomScale: 0.5, particleBudget: 2600, stars: 5000, msaa: 4, skyDetail: 2 },
    med: { name: 'med', dprCap: 1.5, bloomScale: 0.5, particleBudget: 1500, stars: 3200, msaa: 4, skyDetail: 1 },
    low: { name: 'low', dprCap: 1, bloomScale: 0.35, particleBudget: 700, stars: 1800, msaa: 0, skyDetail: 0 },
  };
  let gfxSafe = G.isIOS ? 1 : 0;
  try { gfxSafe = Math.max(gfxSafe, +localStorage.getItem('rg_gfx_safe') || 0); } catch (e) { /* storage blocked */ }
  if (G.params.safe != null) gfxSafe = G.params.safe;
  gfxSafe = Math.max(0, Math.min(4, gfxSafe | 0));

  G.quality = {
    tier: 'high', auto: true, particleBudget: TIERS.high.particleBudget, settings: TIERS.high, tiers: TIERS,
    level: 2,
    set(tier) {
      if (tier === 'auto') { G.quality.auto = true; tier = G.isTouch ? 'med' : 'high'; }
      else G.quality.auto = false;
      if (!TIERS[tier]) return;
      applyTier(tier);
    },
  };
  function applyTier(tier) {
    const q = G.quality, s = TIERS[tier];
    const changed = q.tier !== tier;
    q.tier = tier; q.settings = s; q.particleBudget = s.particleBudget; q.level = tier === 'high' ? 2 : tier === 'med' ? 1 : 0;
    if (renderer) { setMSAA(); resize(); }
    if (changed && inited) G.emit('quality', { tier });
  }

  G.gfx = {
    get safe() { return gfxSafe; },
    set(n) { gfxSafe = Math.max(0, Math.min(4, n | 0)); if (renderer) applySafe(); G.emit('gfxSafe', { safe: gfxSafe }); },
    hdr: false,
  };

  // ------------------------------------------------------------------
  // Renderer, scene, camera, layers, post (built in G.core.init)
  // ------------------------------------------------------------------
  let renderer = null, scene, camera, composer, renderPass, bloom, gradePass, rtMain, inited = false;
  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpC = new THREE.Color();

  const GradeShader = {
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0 }, uExposure: { value: 1.0 }, uVignette: { value: 0.32 },
      uGrain: { value: 0.035 }, uFlash: { value: new THREE.Vector4(1, 1, 1, 0) }, uFade: { value: new THREE.Vector4(0, 0, 0, 0) },
      uShadow: { value: new THREE.Vector3(0.80, 0.84, 1.18) }, uHigh: { value: new THREE.Vector3(1.10, 1.02, 0.86) },
      uSat: { value: 1.06 }, uAspect: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uDesat: { value: 0 },
      uPulse: { value: new THREE.Vector4(0.5, 0.5, -1, 0) },
      tAvg: { value: null }, uAvgK: { value: 0 }, uAvgT: { value: 0.18 },
      tBloom: { value: null }, uBloomOn: { value: 0 }, tAdapt: { value: null }, uAEOn: { value: 0 }, uAET: { value: 0.2 }, uAEMin: { value: 0.5 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse, tAvg, tAdapt, tBloom; uniform float uBloomOn, uTime, uExposure, uVignette, uGrain, uSat, uAspect, uDesat, uAvgK, uAvgT, uAEOn, uAET, uAEMin;
      uniform vec4 uFlash, uFade, uPulse; uniform vec3 uShadow, uHigh, uTint; varying vec2 vUv;
      vec3 rrt(vec3 v){ vec3 a = v * (v + .0245786) - .000090537; vec3 b = v * (.983729 * v + .4329510) + .238081; return a / b; }
      vec3 aces(vec3 c){
        const mat3 I = mat3(vec3(.59719,.07600,.02840), vec3(.35458,.90834,.13383), vec3(.04823,.01566,.83777));
        const mat3 O = mat3(vec3(1.60475,-.11530,-.07367), vec3(-.53108,1.10813,-.00605), vec3(-.07369,-.00327,1.07602));
        c *= uExposure / .6; c = I * c; c = rrt(c); c = O * c; return clamp(c, 0., 1.);
      }
      vec3 toSRGB(vec3 c){ return mix(pow(c, vec3(.41666)) * 1.055 - .055, c * 12.92, vec3(lessThanEqual(c, vec3(.0031308)))); }
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec2 uv = vUv;
        // radial distortion pulse (shock ripple), off when uPulse.z < 0
        if (uPulse.z > 0.) {
          vec2 dv = (uv - uPulse.xy) * vec2(uAspect, 1.); float r = length(dv);
          float w = smoothstep(.08, 0., abs(r - uPulse.z)) * uPulse.w;
          uv -= normalize(dv + 1e-6) / vec2(uAspect, 1.) * w * .02;
        }
        vec3 col = texture2D(tDiffuse, uv).rgb * uTint;
        // anti-whiteout: a coarse bloom mip is a local average of the over-bright parts of the frame; where a big area
        // is blown out (a model near the camera, stacked additive fx), compress it so the frame stays readable
        if (uAvgK > 0.) { float al = dot(texture2D(tAvg, vUv).rgb, vec3(.2126, .7152, .0722)); col *= 1. / (1. + uAvgK * max(0., al - uAvgT)); }
        // auto exposure (darken only): the adapted average scene luminance is held at or under a per-state target,
        // so a pale sky, a bright model filling a close-up or stacked fx never wash the whole frame out
        if (uAEOn > 0.) {
          float m = texture2D(tAdapt, vec2(.5)).r; float av = m / max(.002, 1. - m);
          // a hugely over-bright frame (a star filling a close-up) also sheds most of its bloom, which would otherwise
          // stay as a flat milky haze however far the exposure comes down
          if (uBloomOn > 0.) col = max(col - texture2D(tBloom, vUv).rgb * smoothstep(.35, 2.5, av) * .8, vec3(0.));
          col *= max(uAEMin, pow(min(1., uAET / max(av, 1e-4)), .8));
        }
        col = aces(col);
        // split tone: indigo shadows, warm-gold highlights (display-referred)
        float l = dot(col, vec3(.2126, .7152, .0722));
        col *= mix(uShadow, uHigh, smoothstep(.04, .7, l));
        float l2 = dot(col, vec3(.2126, .7152, .0722));
        col = mix(vec3(l2), col, uSat * (1. - uDesat));
        col = toSRGB(clamp(col, 0., 1.));
        col += .08 * (col * col * (3. - 2. * col) - col);
        vec2 cd = (vUv - .5) * vec2(uAspect, 1.);
        float vig = smoothstep(.45, 1.25, length(cd));
        col *= 1. - vig * uVignette;
        // multiplicative grain (keeps pure black black so the watchdog still sees a dead frame)
        float g = hash(vUv * 1024. + fract(uTime * 7.31) * 91.7) - .5;
        col *= 1. + g * uGrain;
        col = mix(col, uFlash.rgb, clamp(uFlash.a, 0., .85));
        col = mix(col, uFade.rgb, clamp(uFade.a, 0., 1.));
        // triangular dither (+-1 LSB) against 8-bit banding of dark gradients (aurora/nebula skies on phones);
        // pure black stays black so the watchdog still sees a dead frame
        vec2 fc = gl_FragCoord.xy + fract(uTime * 7.13) * 41.;
        float dn = fract(52.9829189 * fract(dot(fc, vec2(.06711056, .00583715)))) + fract(52.9829189 * fract(dot(fc.yx + 17.3, vec2(.06711056, .00583715)))) - 1.;
        col += dn * (1. / 255.) * step(.003, col.r + col.g + col.b);
        gl_FragColor = vec4(col, 1.);
      }`,
  };

  // post API (transient flash/pulses decay on real time, in every tick: fast-forward steps decay them too, so a
  // screenshot after __game.fastForward shows what a player would see)
  const pulse = { flash: 0, flashDecay: 3, bloomAdd: 0, bloomDecay: 2, shockT: -1, shockDur: 0.8, shockAmt: 1, fade: 0, fadeTarget: 0, fadeRate: 2 };
  const shockPos = new THREE.Vector2();
  G.post = {
    base: { bloom: 0.85, bloomRadius: 0.55, exposure: 1.0, vignette: 0.32, grain: 0.035 },
    FLASH_MAX: 0.55,
    get uniforms() { return gradePass ? gradePass.uniforms : GradeShader.uniforms; },
    // in normal play ('fight' / 'practice') a bright flash is capped so it never whites the screen out: at most
    // PLAY_FLASH_MAX, and above 0.2 for at most ~0.3 s (cinematics keep the full FLASH_MAX)
    PLAY_FLASH_MAX: 0.4, PLAY_BLOOM_MAX: 0.45, PLAY_BLOOM_DUR: 0.9,
    CINE_BLOOM_MAX: 0.6, CINE_BLOOM_DUR: 1.2,
    antiWhite: { play: 1.6, cine: 1.0, t: 0.16 },
    flash(color = '#ffffff', amt = 0.5, dur = 0.3) {
      amt = Math.min(G.post.FLASH_MAX, Math.max(0, amt));
      const u = G.post.uniforms.uFlash.value; tmpC.set(color);
      if ((state === 'fight' || state === 'practice') && (0.2126 * tmpC.r + 0.7152 * tmpC.g + 0.0722 * tmpC.b) > 0.3) {
        amt = Math.min(amt, G.post.PLAY_FLASH_MAX);
        if (amt > 0.2) dur = Math.min(dur, 0.3 * amt / (amt - 0.2));
      } else if ((0.2126 * tmpC.r + 0.7152 * tmpC.g + 0.0722 * tmpC.b) > 0.3 && amt > 0.3) {
        dur = Math.min(dur, 0.45 * amt / (amt - 0.3));   // cinematic whiteouts: a brief beat (above 0.3 for <= 0.45 s)
      }
      if (amt >= pulse.flash * 0.7) u.set(tmpC.r, tmpC.g, tmpC.b, 0);
      pulse.flash = Math.max(pulse.flash, amt); pulse.flashDecay = pulse.flash / Math.max(0.05, dur);
    },
    bloomPulse(add = 0.6, dur = 0.6) {
      if (state === 'fight' || state === 'practice') { add = Math.min(add, G.post.PLAY_BLOOM_MAX); dur = Math.min(dur, G.post.PLAY_BLOOM_DUR); }
      else { add = Math.min(add, G.post.CINE_BLOOM_MAX); dur = Math.min(dur, G.post.CINE_BLOOM_DUR); }
      pulse.bloomAdd = Math.max(pulse.bloomAdd, add); pulse.bloomDecay = pulse.bloomAdd / Math.max(0.05, dur);
    },
    get pulses() { return { flash: pulse.flash, bloomAdd: pulse.bloomAdd, fade: pulse.fade }; },
    // auto exposure settings / test hooks: G.post.ae.snap = true adapts instantly on the next rendered frame
    get ae() { return AE; },
    aeRead() { try { if (!AE.last) return null; const b = G.gfx.hdr ? new Uint16Array(4) : new Uint8Array(4); renderer.readRenderTargetPixels(AE.last, 0, 0, 1, 1, b); const m = G.gfx.hdr ? THREE.DataUtils.fromHalfFloat(b[0]) : b[0] / 255; return { m, avg: m / Math.max(0.002, 1 - m) }; } catch (e) { return String(e); } },
    shock(worldPos, amt = 1, dur = 0.8) {
      if (!camera) return; tmpV.copy(worldPos).project(camera); if (tmpV.z > 1) return;
      shockPos.set(tmpV.x * 0.5 + 0.5, tmpV.y * 0.5 + 0.5); pulse.shockT = 0; pulse.shockDur = dur; pulse.shockAmt = amt;
    },
    fade(amount, color = '#000000', dur = 0.5) { tmpC.set(color); G.post.uniforms.uFade.value.set(tmpC.r, tmpC.g, tmpC.b, pulse.fade); pulse.fadeTarget = G.clamp(amount); pulse.fadeRate = 1 / Math.max(0.01, dur); },
    setExposure(v) { G.post.base.exposure = v; },
    setBloom(strength, radius) { if (strength != null) G.post.base.bloom = strength; if (radius != null) G.post.base.bloomRadius = radius; },
    setVignette(v) { G.post.base.vignette = v; },
    setTint(r, g, b) { G.post.uniforms.uTint.value.set(r, g, b); },
    setDesat(v) { G.post.uniforms.uDesat.value = v; },
    setGrade(shadow, high) { if (shadow) G.post.uniforms.uShadow.value.set(...shadow); if (high) G.post.uniforms.uHigh.value.set(...high); },
    // restore what bosses may change (tint, desat, grade, vignette, fade); combat.reset calls it on every fight start/quit
    reset() {
      const U = G.post.uniforms;
      U.uTint.value.set(1, 1, 1); U.uDesat.value = 0; U.uShadow.value.set(0.80, 0.84, 1.18); U.uHigh.value.set(1.10, 1.02, 0.86);
      G.post.base.vignette = 0.32; pulse.fadeTarget = 0; pulse.fade = 0; pulse.flash = 0; pulse.bloomAdd = 0;
    },
  };
  // decay of the transient pulses: runs every tick (rendered or not)
  function stepPost(rdt) {
    pulse.flash = Math.max(0, pulse.flash - pulse.flashDecay * rdt);
    pulse.bloomAdd = Math.max(0, pulse.bloomAdd - pulse.bloomDecay * rdt);
    if (pulse.fade !== pulse.fadeTarget) { const d = pulse.fadeRate * rdt; pulse.fade = Math.abs(pulse.fadeTarget - pulse.fade) <= d ? pulse.fadeTarget : pulse.fade + Math.sign(pulse.fadeTarget - pulse.fade) * d; }
    if (pulse.shockT >= 0) { pulse.shockT += rdt; if (pulse.shockT >= pulse.shockDur) pulse.shockT = -2; }
  }
  // uniform writes: rendered frames only
  function updatePost() {
    const U = G.post.uniforms, b = G.post.base;
    U.uFlash.value.w = pulse.flash;
    if (bloom) { bloom.strength = Math.min(2.2, b.bloom + pulse.bloomAdd); bloom.radius = b.bloomRadius; }
    U.uFade.value.w = pulse.fade;
    if (pulse.shockT === -2) { pulse.shockT = -1; U.uPulse.value.z = -1; }
    else if (pulse.shockT >= 0) { const u = pulse.shockT / pulse.shockDur; U.uPulse.value.set(shockPos.x, shockPos.y, u * 0.9, (1 - u) * pulse.shockAmt); }
    U.uExposure.value = b.exposure; U.uVignette.value = b.vignette; U.uGrain.value = b.grain;
    // anti-whiteout strength per state (menu off; play strongest; cinematics allow more spectacle)
    const aw = G.post.antiWhite;
    U.uBloomOn.value = bloom && bloom.enabled ? 1 : 0; if (bloom) U.tBloom.value = bloom.renderTargetsHorizontal[0].texture;
    if (bloom && bloom.enabled && bloom.renderTargetsVertical[3]) { U.tAvg.value = bloom.renderTargetsVertical[3].texture; U.uAvgK.value = state === 'fight' || state === 'practice' ? aw.play : (state === 'menu' || state === 'boot') ? 0 : aw.cine; U.uAvgT.value = aw.t; }
    else U.uAvgK.value = 0;
    // auto exposure: target per state (play darkest), smoothing on real time (at least one 60 Hz step per rendered frame)
    AE.K = AE.snap ? 1 : Math.max(G.gfx.hdr ? 0 : 0.12, 1 - Math.exp(-Math.max(G.rdt || 0, 1 / 60) * AE.rate)); AE.snap = false;   // 8-bit: a floor so smoothing never stalls
    U.uAEOn.value = AE.on && G.aePass && G.aePass.enabled && U.tAdapt.value ? 1 : 0;
    U.uAET.value = state === 'fight' || state === 'practice' || state === 'intro' || state === 'dead' ? AE.play : (state === 'menu' || state === 'boot') ? AE.menu : AE.cine;
    U.uAEMin.value = AE.min;
    U.uTime.value = G.now; U.uAspect.value = camera ? camera.aspect : 1;
    if (renderer) renderer.toneMappingExposure = b.exposure;
    // safe level 4 (no post): DOM fallback for flash/fade
    if (gfxSafe >= 4) {
      const el = domFlash(); const a = Math.max(pulse.flash, pulse.fade);
      if (a > 0.004) { const v = pulse.fade > pulse.flash ? U.uFade.value : U.uFlash.value; el.style.background = `rgb(${v.x * 255 | 0},${v.y * 255 | 0},${v.z * 255 | 0})`; el.style.opacity = a.toFixed(3); el.style.display = 'block'; }
      else if (el.style.display !== 'none') el.style.display = 'none';
    }
  }
  let flashEl = null;
  const domFlash = () => {
    if (flashEl) return flashEl;
    flashEl = document.createElement('div');
    flashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;display:none;opacity:0';
    document.body.appendChild(flashEl); return flashEl;
  };

  // ------------------------------------------------------------------
  // Auto-exposure measurement: the frame (after bloom) is reduced to a 64x64 luminance map, then to one adapted value
  // (1x1 ping-pong, exponential smoothing). Values are stored as l/(1+l) so tiny HDR hot spots cannot dominate.
  // ------------------------------------------------------------------
  const AE = { on: true, rate: 2.2, snap: true, i: 0, K: 1, play: 0.12, cine: 0.15, menu: 0.3, min: 0.08, last: null };
  function makeAEPass() {
    const type = G.gfx.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const mk = (w, h) => new THREE.WebGLRenderTarget(w, h, { type, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const lumaRT = mk(64, 64), adapt = [mk(1, 1), mk(1, 1)];
    const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), qScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; qScene.add(quad);
    const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
    const lumaMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tDiffuse: { value: null } }, vertexShader: VS,
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ float l = dot(texture2D(tDiffuse, vUv).rgb, vec3(.2126, .7152, .0722)); l = l < 6e4 ? max(l, 0.) : 0.; gl_FragColor = vec4(vec3(l / (1. + l)), 1.); }' });
    const adaptMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tLuma: { value: null }, tPrev: { value: null }, uK: { value: 1 } }, vertexShader: VS,
      fragmentShader: `uniform sampler2D tLuma, tPrev; uniform float uK; varying vec2 vUv;
        void main(){ float s = 0.; for (int j = 0; j < 32; j++) for (int i = 0; i < 32; i++) s += texture2D(tLuma, (vec2(float(i), float(j)) * 2. + 1.) / 64.).r;
          float cur = s / 1024.; float prev = texture2D(tPrev, vec2(.5)).r; gl_FragColor = vec4(vec3(mix(prev, cur, uK)), 1.); }` });
    return {
      enabled: true, needsSwap: false, clear: false, renderToScreen: false, isAE: true,
      setSize() {}, dispose() { lumaRT.dispose(); adapt[0].dispose(); adapt[1].dispose(); },
      render(r, writeBuffer, readBuffer) {
        lumaMat.uniforms.tDiffuse.value = readBuffer.texture; quad.material = lumaMat;
        r.setRenderTarget(lumaRT); r.render(qScene, qCam);
        const src = adapt[AE.i], dst = adapt[1 - AE.i];
        adaptMat.uniforms.tLuma.value = lumaRT.texture; adaptMat.uniforms.tPrev.value = src.texture; adaptMat.uniforms.uK.value = AE.K;
        quad.material = adaptMat; r.setRenderTarget(dst); r.render(qScene, qCam);
        AE.i = 1 - AE.i; AE.last = dst;
        if (gradePass) gradePass.uniforms.tAdapt.value = dst.texture;
      },
    };
  }

  function setMSAA() {
    if (!composer) return;
    const want = (gfxSafe >= 1 || G.isIOS) ? 0 : G.quality.settings.msaa;
    const sm = renderer.capabilities.isWebGL2 ? Math.min(want, renderer.capabilities.maxSamples || 0) : 0;
    const rb = composer.readBuffer, wb = composer.writeBuffer;
    if (rb.samples !== sm) { rb.samples = sm; rb.dispose(); }
    if (wb.samples !== 0) { wb.samples = 0; wb.dispose(); }
    G.gfx.msaa = sm;
  }
  function applySafe() {
    setMSAA();
    if (gfxSafe >= 2 && G.gfx.hdr) {
      const rts = [composer.renderTarget1, composer.renderTarget2, bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical];
      for (const rt of rts) if (rt && rt.texture.type !== THREE.UnsignedByteType) { rt.texture.type = THREE.UnsignedByteType; rt.dispose(); }
      G.gfx.hdr = false; bloom.threshold = 0.72;
    }
    bloom.enabled = gfxSafe < 3;
    G.emit('gfxSafe', { safe: gfxSafe });
  }

  function resize() {
    if (!renderer) return;
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, G.quality.settings.dprCap, G.isTouch ? 1.5 : 2) * dprScale;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    G.viewW = w; G.viewH = h; G.dpr = dpr;
    cam.fit();
    G.emit('resize', { w, h });
  }
  let dprScale = 1;

  // ------------------------------------------------------------------
  // Camera rig
  // ------------------------------------------------------------------
  const PITCH = G.deg(56), FIT_R = 14;
  const camDir = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
  const play = { pos: new THREE.Vector3(0, 20, 16), look: new THREE.Vector3(0, 0.5, 0), dist: 25, shiftX: 0, shiftY: 0 };
  const menuPose = { pos: new THREE.Vector3(0, 9.5, 33), look: new THREE.Vector3(0, 3.2, 0) };
  const shakes = [];
  const scalers = [];   // {scale, left}
  const cv = { pos: new THREE.Vector3(), look: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), menuW: 0 };
  let cin = null;       // active cinematic
  let lastTiltKey = '';
  const nh = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const vnoise = (x, s) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (nh(i + s * 57) * (1 - u) + nh(i + 1 + s * 57) * u) * 2 - 1; };

  const fitMargins = () => {
    const w = innerWidth, h = innerHeight, portrait = h > w;
    const m = G.cam.margins;
    if (m) return m;
    if (G.isTouch && !portrait) return { top: 64, bottom: 70, left: Math.max(16, w * 0.16), right: Math.max(16, w * 0.16) };
    if (G.isTouch && portrait) return { top: 104, bottom: 236, left: 8, right: 8 };
    return { top: 104, bottom: 118, left: 24, right: 24 };   // top clears the boss frame; bottom clears the skill bar
  };

  const cam = G.cam = {
    shakeEnabled: true, idle: true, margins: null, menuPose, playPose: play, fov: 42, mode: 'auto',
    shake(amount = 0.3, dur = 0.35) {
      if (!cam.shakeEnabled || !(amount > 0)) return;
      if (shakes.length > 8) shakes.shift();
      shakes.push({ a: Math.min(1.2, amount), dur: Math.max(0.05, dur), t: 0, seed: Math.random() * 100 });
    },
    hitStop(dur = 0.06, scale = 0.05) { scalers.push({ scale, left: Math.min(0.5, dur) }); },
    slowMo(scale = 0.3, dur = 1) { scalers.push({ scale, left: dur }); },
    clearTime() { scalers.length = 0; },
    // keys: [{t, pos:[x,y,z], look:[x,y,z], fov?}] times in seconds from now (real time). Returns to the play cam after.
    cinematic(keys, opts = {}) {
      if (cin) cin.resolve('replaced');
      const norm = (k) => ({ t: k.t, pos: toV(k.pos), look: toV(k.look || [0, 0.5, 0]), fov: k.fov });
      const ks = (keys || []).map(norm).sort((a, b) => a.t - b.t);
      if (!ks.length) return Promise.resolve('empty');
      // start from the current camera if the first key is later than 0
      if (ks[0].t > 0) ks.unshift({ t: 0, pos: camera.position.clone(), look: cv.look.clone(), fov: camera.fov });
      return new Promise((resolve) => {
        cin = { keys: ks, t: 0, end: ks[ks.length - 1].t, ret: opts.returnDur ?? 0.9, resolve, done: false, hold: !!opts.hold, relative: opts.relativeTo || null };
      });
    },
    endCinematic() { if (cin) { cin.t = Math.max(cin.t, cin.end); cin.hold = false; } },
    get inCinematic() { return !!cin; },
    fit() {
      if (!camera) return;
      const w = innerWidth, h = innerHeight, m = fitMargins();
      const xlo = -1 + 2 * m.left / w, xhi = 1 - 2 * m.right / w, ylo = -1 + 2 * m.bottom / h, yhi = 1 - 2 * m.top / h;
      const playGroup = G.layers && G.layers.play;
      if (playGroup) playGroup.updateMatrixWorld(true);
      const pts = [];
      for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; const p = G.polar(FIT_R, a, 0); if (playGroup) p.applyMatrix4(playGroup.matrixWorld); pts.push(p); }
      // also a few points slightly above the plane (boss/hero height) near the rim
      const look = play.look;
      const saveShift = [cam._sx, cam._sy]; cam._sx = 0; cam._sy = 0;
      const ext = (d) => {
        camera.position.copy(look).addScaledVector(camDir, d); camera.lookAt(look); camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();
        let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
        for (const p of pts) { tmpV.copy(p).project(camera); if (tmpV.x < x0) x0 = tmpV.x; if (tmpV.x > x1) x1 = tmpV.x; if (tmpV.y < y0) y0 = tmpV.y; if (tmpV.y > y1) y1 = tmpV.y; }
        return { x0, x1, y0, y1 };
      };
      let lo = 8, hi = 400, e;
      for (let i = 0; i < 26; i++) {
        const mid = (lo + hi) / 2; e = ext(mid);
        if (e.x1 - e.x0 <= xhi - xlo && e.y1 - e.y0 <= yhi - ylo) hi = mid; else lo = mid;
      }
      e = ext(hi);
      play.dist = hi;
      play.pos.copy(look).addScaledVector(camDir, hi);
      cam._sx = ((xlo + xhi) / 2) - (e.x0 + e.x1) / 2;
      cam._sy = ((ylo + yhi) / 2) - (e.y0 + e.y1) / 2;
      if (!isFinite(cam._sx)) cam._sx = saveShift[0] || 0;
      if (!isFinite(cam._sy)) cam._sy = saveShift[1] || 0;
      camera.updateProjectionMatrix();
      // menu pose: pull back for portrait screens
      const asp = w / h;
      menuPose.pos.set(0, 9.5, 33).multiplyScalar(asp < 1 ? Math.min(2.1, 1 / asp * 0.95) : 1);
      return play;
    },
    // project a world (or play-plane local) point to CSS pixels
    toScreen(v, out = {}) {
      if (!camera) { out.x = 0; out.y = 0; out.visible = false; return out; }
      tmpV2.copy(v).project(camera);
      out.x = (tmpV2.x * 0.5 + 0.5) * innerWidth; out.y = (-tmpV2.y * 0.5 + 0.5) * innerHeight; out.visible = tmpV2.z < 1;
      return out;
    },
    _sx: 0, _sy: 0,
    update(rdt) {
      if (!camera) return;
      // refit while the play plane is tilted / tilting
      const pg = G.layers && G.layers.play;
      if (pg) { const k = pg.rotation.x.toFixed(3) + ',' + pg.rotation.z.toFixed(3); if (k !== lastTiltKey) { lastTiltKey = k; cam.fit(); } }
      // base pose: menu or play
      const menuish = cam.mode === 'menu' || (cam.mode === 'auto' && (state === 'menu' || state === 'boot'));
      cv.menuW = G.damp(cv.menuW, menuish ? 1 : 0, 2.2, rdt);
      if (Math.abs(cv.menuW - (menuish ? 1 : 0)) < 0.001) cv.menuW = menuish ? 1 : 0;
      const mw = G.smooth(cv.menuW);
      cv.pos.lerpVectors(play.pos, menuPose.pos, mw);
      cv.look.lerpVectors(play.look, menuPose.look, mw);
      let fov = cam.fov;
      // idle drift (< 0.15 units)
      if (cam.idle) { const t = G.now; cv.pos.x += Math.sin(t * 0.21) * 0.11; cv.pos.y += Math.sin(t * 0.17 + 1.3) * 0.07; cv.pos.z += Math.sin(t * 0.13 + 2.1) * 0.06; }
      // cinematic
      if (cin) {
        if (state !== 'paused') cin.t += rdt;   // a paused cinematic holds its pose
        const ks = cin.keys, t = Math.min(cin.t, cin.end);
        let i = 0; while (i < ks.length - 2 && t > ks[i + 1].t) i++;
        const pA = hermite(ks, i, t, 'pos', cv.a), lA = hermite(ks, i, t, 'look', cv.b);
        const k0 = ks[i], k1 = ks[Math.min(ks.length - 1, i + 1)];
        const fA = (k0.fov || cam.fov) + ((k1.fov || cam.fov) - (k0.fov || cam.fov)) * G.smooth((t - k0.t) / Math.max(1e-3, k1.t - k0.t));
        let w = 1;
        if (cin.t > cin.end && !cin.hold) w = 1 - G.smooth((cin.t - cin.end) / Math.max(0.01, cin.ret));
        cv.pos.lerp(pA, w); cv.look.lerp(lA, w); fov = fov + (fA - fov) * w;
        if (cin.t >= cin.end + cin.ret && !cin.hold) { const r = cin.resolve; cin = null; r('done'); }
      }
      camera.position.copy(cv.pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(cv.look);
      // shake (real time)
      let amp = 0;
      for (let i = shakes.length - 1; i >= 0; i--) {
        const s = shakes[i]; s.t += rdt; const u = s.t / s.dur;
        if (u >= 1) { shakes.splice(i, 1); continue; }
        amp += s.a * (1 - u) * (1 - u);
      }
      if (amp > 1e-4 && cam.shakeEnabled) {
        amp = Math.min(1.2, amp); const t = G.now * 22;
        cv.a.set(vnoise(t, 1), vnoise(t, 2), vnoise(t, 3) * 0.5).multiplyScalar(amp * 0.55).applyQuaternion(camera.quaternion);
        camera.position.add(cv.a);
        camera.rotateZ(vnoise(t, 4) * 0.012 * amp);
      }
      // lens shift only applies in the pure play pose (fades with menu/cinematic weight)
      const shiftW = (1 - mw) * (cin ? 0 : 1);
      cam._w = shiftW;
      if (Math.abs(camera.fov - fov) > 0.01 || cam._lastW !== shiftW) { camera.fov = fov; camera.updateProjectionMatrix(); cam._lastW = shiftW; }
    },
  };
  const toV = (a) => a && a.isVector3 ? a.clone() : new THREE.Vector3(a ? a[0] : 0, a ? a[1] : 0, a ? a[2] : 0);
  // cubic hermite through keys with Catmull-Rom tangents (time-aware), zero tangent at ends
  const hA = new THREE.Vector3(), hB = new THREE.Vector3();
  function hermite(ks, i, t, key, out) {
    const k0 = ks[i], k1 = ks[Math.min(ks.length - 1, i + 1)];
    const h = Math.max(1e-4, k1.t - k0.t), u = G.clamp((t - k0.t) / h);
    const tan = (j, o) => {
      if (j <= 0 || j >= ks.length - 1) return o.set(0, 0, 0);
      return o.copy(ks[j + 1][key]).sub(ks[j - 1][key]).multiplyScalar(1 / Math.max(1e-4, ks[j + 1].t - ks[j - 1].t));
    };
    tan(i, hA); tan(Math.min(ks.length - 1, i + 1), hB);
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    out.copy(k0[key]).multiplyScalar(h00).addScaledVector(hA, h10 * h).addScaledVector(k1[key], h01).addScaledVector(hB, h11 * h);
    return out;
  }

  // ------------------------------------------------------------------
  // Black-screen watchdog (kart-raid approach): sample 9 pixels after the frame; ~1.5 s of black -> step up a safe level
  // ------------------------------------------------------------------
  let watchLeft = 48, blackRun = 0, lastCheck = 0;
  const px = new Uint8Array(4);
  function gfxWatch() {
    const now = performance.now();
    if (watchLeft <= 0 || gfxSafe >= 4 || now - lastCheck < 250) return;
    lastCheck = now;
    // a deliberate fade / dark flash to black (cinematics) is not a dead pipeline
    { const fl = G.post.uniforms.uFlash.value; if (pulse.fade > 0.3 || (pulse.flash > 0.3 && fl.x + fl.y + fl.z < 0.3)) { blackRun = 0; return; } }
    let zeros = 0;
    try {
      const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      renderer.setRenderTarget(null);
      for (let i = 0; i < 9; i++) {
        gl.readPixels((w * (0.3 + 0.2 * (i % 3))) | 0, (h * (0.3 + 0.2 * ((i / 3) | 0))) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        if (!(px[0] || px[1] || px[2])) zeros++;
      }
    } catch (e) { watchLeft = 0; return; }
    if (zeros < 7) { blackRun = 0; watchLeft--; return; }
    if (++blackRun < 6) return;
    blackRun = 0; watchLeft = 48; gfxSafe = Math.min(4, gfxSafe + 1);
    console.warn('[gfx] black frames detected, safe level ->', gfxSafe);
    try { localStorage.setItem('rg_gfx_safe', String(gfxSafe)); } catch (e) { /* ignore */ }
    applySafe();
  }

  // ------------------------------------------------------------------
  // Perf: frame-time tracking + auto tier drop + dpr scale
  // ------------------------------------------------------------------
  G.perf = { fps: 60, frameMs: 16.7, calls: 0, tris: 0 };
  const ft = new Float32Array(60); let ftI = 0, ftN = 0, badSince = -1, goodSince = -1, perfStart = 0;
  function adapt(rdt) {
    // > 1 s is a hitch (tab switch, GC, debugger): skip it; slower-than-4 fps frames still count (as 250 ms) so a
    // device that renders a few frames a second does step down instead of being ignored
    if (rdt <= 0 || rdt > 1) return;
    ft[ftI] = Math.min(250, rdt * 1000); ftI = (ftI + 1) % 60; ftN = Math.min(60, ftN + 1);
    let s = 0; for (let i = 0; i < ftN; i++) s += ft[i];
    const avg = s / ftN; G.perf.frameMs = avg; G.perf.fps = 1000 / avg;
    if (!G.quality.auto || ftN < 60 || G.now - perfStart < 4 || document.hidden) return;
    const t = G.now;
    if (avg > 24) {   // < ~42 fps sustained
      goodSince = -1;
      if (badSince < 0) badSince = t;
      if (t - badSince > 3) {
        badSince = -1; ftN = 0;
        if (G.quality.tier === 'high') applyTier('med');
        else if (G.quality.tier === 'med') applyTier('low');
        else if (dprScale > 0.7) { dprScale = Math.max(0.7, dprScale - 0.15); resize(); }
        G.log.info('auto quality ->', G.quality.tier, dprScale);
      }
    } else badSince = -1;
  }

  // ------------------------------------------------------------------
  // Loop
  // ------------------------------------------------------------------
  const ORDER = ['input', 'combat', 'player', 'fx', 'world', 'ui', 'bot'];
  function tick(rdtIn, render) {
    const rdt = Math.max(0, Math.min(0.1, rdtIn));
    G.rdt = rdt; G.now += rdt; G.frame++;
    // time scalers run on real time
    let sc = 1;
    for (let i = scalers.length - 1; i >= 0; i--) { const s = scalers[i]; s.left -= rdt; if (s.left <= 0) { scalers.splice(i, 1); continue; } if (s.scale < sc) sc = s.scale; }
    G.timeScale = sc * G.baseTimeScale;
    const paused = state === 'paused';
    const dt = paused ? 0 : Math.min(rdt, 1 / 20) * G.timeScale;
    G.dt = dt;
    if (T_STATES[state]) G.t += dt;
    for (let i = 0; i < ORDER.length; i++) {
      const m = G[ORDER[i]];
      if (m && typeof m.update === 'function') { try { m.update(dt); } catch (e) { G.log.error(ORDER[i] + '.update', e); } }
    }
    try { cam.update(rdt); } catch (e) { G.log.error('cam.update', e); }
    try { stepPost(rdt); } catch (e) { G.log.error('post.step', e); }
    if (!render) return;
    try {
      updatePost();
      renderer.info.reset();
      if (gfxSafe >= 4) { renderer.setRenderTarget(null); renderer.render(scene, camera); }
      else composer.render(rdt);
      G.perf.calls = renderer.info.render.calls; G.perf.tris = renderer.info.render.triangles;
      gfxWatch();
    } catch (e) { G.log.error('render', e); }
    if (frameWaiters.length) { const w = frameWaiters.splice(0); for (const f of w) { try { f(); } catch (e) { /* ignore */ } } }
  }
  const frameWaiters = [];
  G.nextFrame = () => new Promise(r => frameWaiters.push(r));

  let running = false, last = 0, firstFrame = true;
  function frame(nowMs) {
    if (!running) return;
    requestAnimationFrame(frame);
    const rdt = last ? (nowMs - last) / 1000 : 1 / 60; last = nowMs;
    adapt(rdt);
    tick(rdt, true);
    if (firstFrame) {
      firstFrame = false;
      const v = document.getElementById('veil'); if (v) { v.classList.add('gone'); setTimeout(() => v.remove(), 1200); }
      G.emit('firstFrame', {});
    }
  }

  let pausedFrom = null;
  G.core = {
    init() {
      const canvas = document.getElementById('c') || (() => { const c = document.createElement('canvas'); c.id = 'c'; document.body.prepend(c); return c; })();
      renderer = G.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false, preserveDrawingBuffer: false });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;   // used only at safe level 4 (no post); the grade pass does ACES otherwise
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(new THREE.Color(G.colors.void), 1);
      renderer.info.autoReset = false;
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); G.log.warn('context lost'); running = false; }, false);
      canvas.addEventListener('webglcontextrestored', () => { G.log.warn('context restored'); running = false; G.core.start(); }, false);

      scene = G.scene = new THREE.Scene();
      scene.background = new THREE.Color(G.colors.void);
      camera = G.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 3000);
      // lens shift (NDC) applied after every projection update, weighted by cam._w (play pose only)
      const upm = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
      camera.updateProjectionMatrix = function () {
        upm.call(this);
        const w = cam._w ?? 1;
        if (cam._sx || cam._sy) {
          const e = this.projectionMatrix.elements; e[8] -= cam._sx * w; e[9] -= cam._sy * w;
          this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
        }
      };
      camera.position.copy(menuPose.pos); camera.lookAt(menuPose.look);
      scene.add(camera);

      // layers: play (tiltable plane) holds arena/fx/boss/player/ui3d; sky stays untilted
      const mk = (name, parent) => { const g = new THREE.Group(); g.name = name; parent.add(g); return g; };
      const sky = mk('sky', scene);
      const playG = mk('play', scene);
      G.layers = { sky, play: playG, arena: mk('arena', playG), boss: mk('boss', playG), player: mk('player', playG), fx: mk('fx', playG), ui3d: mk('ui3d', playG) };

      // lights (world may retint)
      G.lights = {
        hemi: new THREE.HemisphereLight(0x8d8cff, 0x1a0f08, 0.55),
        key: new THREE.DirectionalLight(0xffe3b0, 2.2),
        rim: new THREE.DirectionalLight(0x7fa8ff, 1.1),
      };
      G.lights.key.position.set(-14, 26, 18); G.lights.rim.position.set(16, 10, -22);
      scene.add(G.lights.hemi, G.lights.key, G.lights.rim);

      // post chain
      G.gfx.hdr = gfxSafe < 2 && renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
      rtMain = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: G.gfx.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 0 });
      composer = G.composer = new EffectComposer(renderer, rtMain);
      renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      bloom = G.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), G.post.base.bloom, G.post.base.bloomRadius, G.gfx.hdr ? 0.92 : 0.72);
      // guard the bloom input: a single NaN/Inf (or >65k half-float) scene pixel otherwise spreads through the
      // separable blur into a hard glowing square; clamp extreme HDR so one hot pixel cannot dominate either
      { const hm = bloom.materialHighPassFilter, k = 'vec4 texel = texture2D( tDiffuse, vUv );';
        if (hm && hm.fragmentShader.includes(k)) { hm.fragmentShader = hm.fragmentShader.replace(k, k + ' texel.rgb = all(lessThan(abs(texel.rgb), vec3(6e4))) ? min(max(texel.rgb, vec3(0.)), vec3(40.)) : vec3(0.);'); hm.needsUpdate = true; } }
      const bss = bloom.setSize.bind(bloom);
      bloom.setSize = (w, h) => { const s = G.quality.settings.bloomScale; bss(Math.max(8, Math.round(w * s)), Math.max(8, Math.round(h * s))); };
      composer.addPass(bloom);
      G.aePass = makeAEPass(); composer.addPass(G.aePass);
      gradePass = G.gradePass = new ShaderPass(GradeShader);
      gradePass.needsSwap = false;
      composer.addPass(gradePass);

      // quality tier
      const qp = G.params.quality;
      if (qp === 'high' || qp === 'med' || qp === 'low') { G.quality.auto = false; applyTier(qp); }
      else { G.quality.auto = true; applyTier(G.isTouch ? 'med' : 'high'); }
      applySafe();
      addEventListener('resize', resize);
      addEventListener('orientationchange', () => setTimeout(resize, 250));
      if (window.visualViewport) visualViewport.addEventListener('resize', () => setTimeout(resize, 50));
      resize();
      inited = true;
      state = 'menu';
    },
    start() {
      if (running) return; running = true; last = 0; perfStart = G.now;
      requestAnimationFrame(frame);
    },
    // one full update without rendering (fast-forward for tests)
    step(dt = 1 / 30) { tick(dt, false); },
    render() { tick(0, true); },
    pause(on = true) {
      if (on) {
        if (state === 'paused' || state === 'menu' || state === 'boot' || state === 'dead' || state === 'victory' || state === 'draft' || state === 'results') return false;
        pausedFrom = state; G.state = 'paused'; return true;
      }
      if (state !== 'paused') return false;
      G.state = pausedFrom || 'fight'; pausedFrom = null; return true;
    },
    get pausedFrom() { return pausedFrom; },
    get running() { return running; },
    resize,
  };
})();
