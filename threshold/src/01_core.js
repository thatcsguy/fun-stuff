// THRESHOLD core: namespace, math, RNG, coroutines, renderer, post chain, main loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const QS = new URLSearchParams(location.search);
const TAU = Math.PI * 2, PI = Math.PI;
const V3 = THREE.Vector3;
const $ = (s) => document.querySelector(s);

const G = {
  now: 0,          // sim clock, never resets (seconds)
  ft: 0,           // fight clock (seconds since the pull)
  rt: 0,           // real clock
  state: 'boot',   // boot | menu | loading | intro | fight | dead | win
  paused: false,
  timeScale: 1,
  bosses: [],      // registered boss definitions, in door order
  classes: [],     // registered class definitions
  player: null, boss: null, arena: null, world: null,
  ents: [],        // hostile entities (boss + adds)
  errors: [],
  debug: QS.has('debug'),
  headless: false, // true while fastForward runs: skip purely cosmetic work
};

// ---------- math ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sat = (v) => clamp(v, 0, 1);
const smooth = (t) => { t = sat(t); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapPi = (a) => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
const angDiff = (a, b) => wrapPi(b - a);
const dampAng = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));
// Angle convention everywhere: angle a points along (sin a, cos a) on XZ. 0 = +Z, PI/2 = +X. Matches Object3D.rotation.y.
const angTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);
const dist2 = (x0, z0, x1, z1) => Math.hypot(x1 - x0, z1 - z0);
const dirX = (a) => Math.sin(a), dirZ = (a) => Math.cos(a);

function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
G.rng = mulberry(QS.has('seed') ? +QS.get('seed') : (Date.now() & 0xffffff));
const rnd = (a = 1, b) => b === undefined ? G.rng() * a : a + G.rng() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(G.rng() * arr.length)];
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(G.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const vrand = Math.random; // cosmetic-only randomness (never affects the sim)

// ---------- settings ----------
const Settings = Object.assign({ vol: 70, mus: 60, sens: 100, psens: 100, inv: false, q: 'high', cls: null },
  (() => { try { return JSON.parse(localStorage.getItem('th_settings') || '{}'); } catch (e) { return {}; } })());
function saveSettings() { try { localStorage.setItem('th_settings', JSON.stringify(Settings)); } catch (e) { /* private mode */ } }
if (QS.get('quality')) Settings.q = QS.get('quality');
const Save = (() => { try { return JSON.parse(localStorage.getItem('th_save') || '{}'); } catch (e) { return {}; } })();
function saveSave() { try { localStorage.setItem('th_save', JSON.stringify(Save)); } catch (e) { /* ignore */ } }

// ---------- coroutines ----------
// Boss scripts are generator functions. `yield 1.5` waits 1.5 sim seconds, `yield () => cond` waits until cond() is true,
// a bare `yield` waits one frame, and `yield* other(...)` calls another script inline.
const Co = {
  list: [],
  start(gen, tag = 'fight') { if (typeof gen === 'function') gen = gen(); const c = { gen, tag, wait: 0, cond: null, dead: false }; this.list.push(c); return c; },
  stop(c) { if (c && !c.dead) { c.dead = true; try { c.gen.return(); } catch (e) { /* ignore */ } } },
  stopTag(tag) { for (const c of this.list) if (c.tag === tag) this.stop(c); },
  clear() { for (const c of this.list) this.stop(c); this.list.length = 0; },
  update(dt) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const c = L[i]; if (c.dead) continue;
      if (c.cond) { let ok = false; try { ok = c.cond(); } catch (e) { reportError(e); ok = true; } if (!ok) continue; c.cond = null; c.wait = 0; }
      else if (c.wait > 0) { c.wait -= dt; if (c.wait > 0) continue; }
      let guard = 0;
      while (!c.dead && guard++ < 50) {
        let r; try { r = c.gen.next(); } catch (e) { reportError(e); c.dead = true; break; }
        if (r.done) { c.dead = true; break; }
        const v = r.value;
        if (typeof v === 'number') { c.wait += v; if (c.wait > 0) break; }
        else if (typeof v === 'function') { c.cond = v; break; }
        else { c.wait = 0; break; }
      }
    }
    for (let i = L.length - 1; i >= 0; i--) if (L[i].dead) L.splice(i, 1);
  },
};
function reportError(e) {
  const msg = (e && e.stack) ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e);
  if (G.errors.length < 30) G.errors.push(msg);
  console.error(e);
}

// ---------- renderer ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 3000);
camera.position.set(0, 6, 14);

const QUALITY = {
  high: { pr: 1.5, shadow: 2048, bloom: true, msaa: 4, part: 1 },
  med: { pr: 1.0, shadow: 1024, bloom: true, msaa: 2, part: 0.6 },
  low: { pr: 0.75, shadow: 512, bloom: false, msaa: 0, part: 0.35 },
};
G.q = QUALITY[Settings.q] || QUALITY.high;

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.9 }, uChroma: { value: 0.0015 }, uGrain: { value: 0.022 },
    uSat: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uLift: { value: new THREE.Color(0, 0, 0) },
    uFlash: { value: new THREE.Vector4(1, 1, 1, 0) }, uPulse: { value: 0 }, uContrast: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uVig,uChroma,uGrain,uSat,uPulse,uContrast; uniform vec3 uTint,uLift; uniform vec4 uFlash; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uTime*7.13)*43758.5453); }
    void main(){
      vec2 c = vUv-0.5; float r2 = dot(c,c);
      float ch = uChroma*(1.0+uPulse*6.0)*(0.4+r2*3.0);
      vec2 d = c*ch;
      vec3 col = vec3(texture2D(tDiffuse,vUv+d).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-d).b);
      float l = dot(col,vec3(0.2126,0.7152,0.0722));
      col = mix(vec3(l),col,uSat);
      col = (col-0.18)*uContrast+0.18;
      col = max(col,0.0)*uTint+uLift;
      col *= 1.0 - uVig*smoothstep(0.12,0.85,r2*1.6);
      col = mix(col, uFlash.rgb*1.6, uFlash.a);
      col += (h(gl_FragCoord.xy)-0.5)*uGrain*(0.4+l);
      gl_FragColor = vec4(max(col,0.0),1.0);
    }`,
};

const Post = {
  composer: null, bloom: null, final: null, flashA: 0, flashDecay: 3, pulse: 0,
  base: { bloom: 0.55, radius: 0.6, threshold: 0.9, exposure: 1.0, sat: 1.05, vig: 0.9, contrast: 1.04, tint: [1, 1, 1], lift: [0, 0, 0] },
  cur: null,
  init() {
    const w = innerWidth, h = innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: G.q.msaa });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.6, 0.9);
    this.bloom.enabled = G.q.bloom;
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
    this.cur = Object.assign({}, this.base);
    this.resize();
  },
  // Per-arena look. Any omitted key falls back to the base look. Call again mid-fight (optionally via lerpTo) to regrade a phase.
  set(o = {}) { this.cur = Object.assign({}, this.base, o); this.apply(); },
  apply() {
    const c = this.cur, u = this.final.uniforms;
    this.bloom.strength = c.bloom; this.bloom.radius = c.radius; this.bloom.threshold = c.threshold;
    renderer.toneMappingExposure = c.exposure;
    u.uSat.value = c.sat; u.uVig.value = c.vig; u.uContrast.value = c.contrast;
    u.uTint.value.setRGB(c.tint[0], c.tint[1], c.tint[2]); u.uLift.value.setRGB(c.lift[0], c.lift[1], c.lift[2]);
  },
  *lerpTo(o, dur = 2) {
    const a = Object.assign({}, this.cur), b = Object.assign({}, this.cur, o); let t = 0;
    while (t < dur) {
      t += G.dt; const k = smooth(t / dur);
      for (const key of Object.keys(b)) {
        if (Array.isArray(b[key])) this.cur[key] = b[key].map((v, i) => lerp(a[key][i], v, k));
        else this.cur[key] = lerp(a[key], b[key], k);
      }
      this.apply(); yield;
    }
  },
  flash(color = 0xffffff, amt = 0.5, decay = 3) { const c = new THREE.Color(color); this.final.uniforms.uFlash.value.set(c.r, c.g, c.b, this.flashA = Math.max(this.flashA, amt)); this.flashDecay = decay; },
  kick(amt = 1) { this.pulse = Math.max(this.pulse, amt); },
  update(rdt) {
    this.flashA = Math.max(0, this.flashA - rdt * this.flashDecay * Math.max(0.25, this.flashA));
    this.final.uniforms.uFlash.value.w = this.flashA;
    this.pulse = Math.max(0, this.pulse - rdt * 3);
    this.final.uniforms.uPulse.value = this.pulse;
    this.final.uniforms.uTime.value = G.rt % 100;
  },
  resize() {
    const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio || 1, G.q.pr);
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr); this.composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  },
  setQuality(name) {
    G.q = QUALITY[name] || QUALITY.high; this.bloom.enabled = G.q.bloom;
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: G.q.msaa });
    this.composer.reset(rt); this.resize();
  },
};
addEventListener('resize', () => Post.resize());

// ---------- world lifecycle helpers ----------
function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (m.userData && m.userData.shared) continue;
      for (const k in m) { const v = m[k]; if (v && v.isTexture && !v.userData.shared) v.dispose(); }
      if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k].value; if (v && v.isTexture && !v.userData.shared) v.dispose(); }
      m.dispose();
    }
  });
}

// ---------- main loop ----------
const Hooks = { step: [], frame: [] }; // modules push update functions here
G.step = function (dt) {
  G.dt = dt; G.now += dt;
  if (G.state === 'fight') G.ft += dt;
  Co.update(dt);
  for (const f of Hooks.step) f(dt);
};
let lastFrame = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min((now - lastFrame) / 1000, 0.05); lastFrame = now;
  if (rdt <= 0) return;
  G.rt += rdt; G.rdt = rdt;
  try {
    for (const f of Hooks.frame) f(rdt, 0);
    if (!G.paused && G.state !== 'boot') G.step(rdt * G.timeScale);
    for (const f of Hooks.frame) f(rdt, 1);
    Post.update(rdt);
    Post.composer.render();
  } catch (e) { reportError(e); }
}
