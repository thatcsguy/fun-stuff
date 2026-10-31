/* =====================================================================
   0  CONFIG
   ===================================================================== */
const IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
document.body.classList.add(IS_TOUCH ? 'touch' : 'desk');
const URLP = new URLSearchParams(location.search);
const DEBUG = URLP.get('debug') === '1';

const QUALITY = {
  high: { name: 'high', pr: 2.0, bloomScale: 1.0, bloomStr: 0.7, particles: 4000, trail: 3, candles: 250, stars: 3000, low: false, fbm: 4 },
  med:  { name: 'med',  pr: 1.5, bloomScale: 0.6, bloomStr: 0.7, particles: 2500, trail: 4, candles: 200, stars: 2000, low: false, fbm: 4 },
  low:  { name: 'low',  pr: 1.0, bloomScale: 0.5, bloomStr: 0.55, particles: 1200, trail: 6, candles: 120, stars: 1200, low: true,  fbm: 3 },
};
const TIERS = ['low', 'med', 'high'];

// Per-boss difficulty knobs (index = boss index)
const DIFF = [
  { windup: 1.5, spd: 0.8, enrage: 240 },
  { windup: 1.1, spd: 1.0, enrage: 270 },
  { windup: 0.8, spd: 1.2, enrage: 300 },
];

// Gameplay colors (over-saturated so they read through world desaturation). index: 0 R, 1 G, 2 B, 3 W
const PCOL = [[1.0, 0.09, 0.2], [0.18, 1.0, 0.3], [0.2, 0.45, 1.0], [1.0, 1.0, 1.0]];
const CSSCOL = ['#ff2a48', '#3dff6a', '#4a86ff', '#ffffff'];
const R = 0, G = 1, Bc = 2, W = 3;
const SAT_TITLE = 0.42, SAT_BOSS = [0.5, 0.7, 0.85]; // world saturation arc: color returns as you win

const PLAYER = {
  hp: 100, speed: 7.5, accel: 14, hurtR: 0.45, grazeR: 1.6, hurtI: 0.6,
  boltInterval: 0.18, boltDmg: 10, boltSpeed: 38, boltRange: 20, crit: 0.1,
  dashCharges: 2, dashCd: 3.5, dashDist: 6.5, dashTime: 0.16, dashI: 0.35,
  lanceCost: 35, lanceCd: 1.5, lanceDmg: 140, lanceLen: 24, lanceW: 0.9,
  latCost: 35, latCd: 8, latR: 4.5, latDur: 6, latHeal: 4,
  mirCost: 35, mirCd: 10, mirDur: 2.5, mirR: 2.2, mirDmg: 25,
  novaReq: 60,
};

const FACETS = [
  { id: 'echo', name: 'PRISM ECHO', glyph: '✦', color: '#ff5a7a', desc: 'Crimson Lance fires a second beam (50%) at a 12° offset.' },
  { id: 'living', name: 'LIVING LATTICE', glyph: '⬡', color: '#5aff8a', desc: 'Lattice radius +30% and heals 6 HP/s.' },
  { id: 'polished', name: 'POLISHED MIRROR', glyph: '◈', color: '#6aa8ff', desc: 'Mirror lasts 4 s and reflected shots deal 40.' },
  { id: 'greed', name: 'SPECTRAL GREED', glyph: '◎', color: '#ffd76a', desc: 'Graze radius +0.4 m and every graze grants +2 more charge.' },
  { id: 'third', name: 'THIRD REFRACTION', glyph: '»', color: '#bfe4ff', desc: 'Refract Dash gains a third charge.' },
  { id: 'core', name: 'BRIGHT CORE', glyph: '♦', color: '#fff3c0', desc: '+30 max HP (130) and heal to full now.' },
  { id: 'afterglow', name: 'AFTERGLOW', glyph: '☀', color: '#ffb36a', desc: 'After a White Nova, all ability costs are halved for 5 s.' },
  { id: 'splinter', name: 'SPLINTER BOLTS', glyph: '⁂', color: '#e0b0ff', desc: 'Prism Bolt fires twin bolts in a 6° spread (+20% DPS).' },
];

/* =====================================================================
   1  UTIL
   ===================================================================== */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rng = mulberry32(1337);            // gameplay RNG, reseeded per boss attempt (deterministic patterns)
const frand = Math.random;             // cosmetic randomness
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t) => { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t) * (1 - t); };
const easeIn = (t) => { t = clamp(t, 0, 1); return t * t * t; };
const TAU = Math.PI * 2;
const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _col = new THREE.Color(), _e = new THREE.Euler(), _s = new THREE.Vector3();
const _v2a = new THREE.Vector2();
// distance from point (px,pz) to segment (ax,az)-(bx,bz)
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz;
  let t = l2 > 1e-8 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + dx * t - px, ez = az + dz * t - pz; return Math.sqrt(ex * ex + ez * ez);
}
function fmtTime(s) { s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }
function fmtTimeMs(s) { if (s == null) return '—'; const m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); }

/* =====================================================================
   2  QUALITY (tier state; apply() defined after render setup)
   ===================================================================== */
const Q = { name: IS_TOUCH ? 'med' : 'high', auto: true, cfg: null, emergency: false, maxAuto: IS_TOUCH ? 'med' : 'high' };
Q.cfg = QUALITY[Q.name];

/* =====================================================================
   3  RENDER
   ===================================================================== */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH, powerPreference: 'high-performance', alpha: false, stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 1);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 17, 20);
const hemi = new THREE.HemisphereLight(0x8899ff, 0x110814, 0.35);
const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(5, 10, 3);
scene.add(hemi, sun);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.42, 0.82);
const _bloomSetSize = bloom.setSize.bind(bloom);
bloom.setSize = (w, h) => _bloomSetSize(Math.max(64, Math.round(w * Q.cfg.bloomScale)), Math.max(64, Math.round(h * Q.cfg.bloomScale)));

const LensFX = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uAberr: { value: 0.0015 }, uWarpCenter: { value: new THREE.Vector2(0.5, 0.5) }, uWarpStrength: { value: 0 }, uWarpRadius: { value: 0.18 },
    uShockCenter: { value: new THREE.Vector2(0.5, 0.5) }, uShockRadius: { value: 0 }, uShockStrength: { value: 0 },
    uSat: { value: 0.42 }, uWhite: { value: 0 }, uVignette: { value: 0.35 }, uLowHp: { value: 0 }, uGrain: { value: 0.04 }, uDark: { value: 0 },
    uHurt: { value: 0 },
    uNovaC: { value: new THREE.Vector2(0.5, 0.5) }, uNovaR: { value: 0 }, uNovaA: { value: 0 }, uNovaNeg: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime,uAberr,uWarpStrength,uWarpRadius,uShockRadius,uShockStrength,uSat,uWhite,uVignette,uLowHp,uGrain,uDark,uHurt;
    uniform float uNovaR,uNovaA,uNovaNeg; uniform vec2 uNovaC;
    uniform vec2 uRes,uWarpCenter,uShockCenter; varying vec2 vUv;
    float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    void main(){
      vec2 uv = vUv; float asp = uRes.x/uRes.y;
      #ifndef LOW
      if(uWarpStrength>0.0){ vec2 d=uv-uWarpCenter; d.x*=asp; float l=length(d)+1e-4; float k=uWarpStrength*exp(-l*l/(uWarpRadius*uWarpRadius))*uWarpRadius/l; vec2 off=d*k; off.x/=asp; uv-=off; }
      if(uShockStrength>0.0){ vec2 s=uv-uShockCenter; s.x*=asp; float sl=length(s)+1e-4; float band=exp(-pow((sl-uShockRadius)*12.0,2.0)); vec2 off=(s/sl)*band*uShockStrength; off.x/=asp; uv-=off; }
      #endif
      // White Nova: radial shock (white core + expanding ring with a chromatic edge; world outside goes to dark silhouettes)
      float nEdge = 0.0, nIn = 0.0, nCore = 0.0;
      if (uNovaA > 0.0) { vec2 nq = vUv-uNovaC; nq.x *= asp; float nd = length(nq);
        nEdge = exp(-pow((nd-uNovaR)*20.0,2.0))*step(0.001,uNovaR); nIn = smoothstep(uNovaR+0.02, uNovaR-0.08, nd); nCore = exp(-nd*nd*38.0); }
      vec2 cd = uv-0.5; float ab = uAberr*(0.6+length(cd)*1.6) + nEdge*uNovaA*0.045;
      vec3 col;
      #ifdef LOW
      col = texture2D(tDiffuse, uv).rgb;
      #else
      col.r = texture2D(tDiffuse, uv+cd*ab).r; col.g = texture2D(tDiffuse, uv).g; col.b = texture2D(tDiffuse, uv-cd*ab).b;
      #endif
      float luma = dot(col, vec3(0.2126,0.7152,0.0722));
      float mx = max(col.r, max(col.g, col.b)); float s = mix(uSat, 1.0, smoothstep(0.3, 0.95, mx)*0.92);
      col = mix(vec3(luma), col, s);
      float wl = smoothstep(0.03, 0.35, luma);
      col = mix(col, vec3(wl*2.6) + col*0.25, uWhite);
      if (uNovaA > 0.0) {
        vec3 sil = vec3(luma*0.1, luma*0.09, luma*0.14);
        col = mix(col, sil, uNovaNeg*(1.0-nIn)*0.92);
        col += col*nIn*uNovaA*0.35;
        col += vec3(1.0,0.96,0.9)*nEdge*uNovaA*0.9 + vec3(1.0,0.98,0.95)*nCore*uNovaA*0.85;
      }
      col *= 1.0-uDark;
      vec2 vv = vUv-0.5; vv.x *= mix(1.0, asp, 0.55);
      float vig = smoothstep(0.32, 0.95, length(vv)*1.25);
      col *= 1.0 - vig*uVignette*1.5;
      float hp = uLowHp*(0.65+0.35*sin(uTime*6.5)) + uHurt;
      col += vec3(0.55,0.0,0.04)*vig*hp*1.2;
      #ifndef LOW
      col += (h12(vUv*uRes + fract(uTime*7.13)*157.0)-0.5)*uGrain*(0.4+luma);
      #endif
      gl_FragColor = vec4(max(col,vec3(0.0)), 1.0);
    }`,
});
const lensPass = new ShaderPass(LensFX);
const outputPass = new OutputPass();
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(lensPass); composer.addPass(outputPass);
const LU = LensFX.uniforms;

let VW = innerWidth, VH = innerHeight, ASPECT = VW / VH;
function resize() {
  VW = Math.max(1, (window.visualViewport ? Math.round(visualViewport.width) : innerWidth) || innerWidth);
  VH = Math.max(1, (window.visualViewport ? Math.round(visualViewport.height) : innerHeight) || innerHeight);
  if (VW < 50 || VH < 50) { VW = innerWidth; VH = innerHeight; }
  ASPECT = VW / VH;
  const pr = Q.prOverride || Math.min(window.devicePixelRatio || 1, Q.cfg.pr) * (Q.emergency ? 0.75 : 1);
  renderer.setPixelRatio(pr);
  renderer.setSize(VW, VH, false);
  composer.setPixelRatio(pr);
  composer.setSize(VW, VH);
  camera.aspect = ASPECT; camera.updateProjectionMatrix();
  LU.uRes.value.set(VW * pr, VH * pr);
  cam.baseFovTarget = ASPECT < 1 ? Math.min(68, 50 + (1 - ASPECT) * 22) : 50;
  cam.offScaleTarget = ASPECT < 1 ? 1.25 : 1.0;
  const short = Math.min(VW, VH);
  // ability cluster scale: short landscape phones get a tighter cluster so it doesn't eat the arena
  if (IS_TOUCH) document.documentElement.style.setProperty('--s', String((ASPECT < 1 ? Math.min(1, short / 400) * 0.9 : clamp(short / 480, 0.66, 1)).toFixed(3)));
  if (typeof joy !== 'undefined') joy.R = clamp(short * 0.14, 48, 80);
  measureHud();
}
let resizeTO = 0;
function queueResize() { clearTimeout(resizeTO); resizeTO = setTimeout(resize, 100); }
addEventListener('resize', queueResize);
addEventListener('orientationchange', queueResize);
if (window.visualViewport) visualViewport.addEventListener('resize', queueResize);

// camera rig state (used by resize as well)
const cam = {
  pos: new THREE.Vector3(0, 17, 20), look: new THREE.Vector3(0, 0, 7), target: new THREE.Vector3(0, 0, 7),
  lookAhead: new THREE.Vector3(), fov: 50, baseFov: 50, baseFovTarget: 50, offScale: 1, offScaleTarget: 1,
  lock: null, // debug lock {pos, look}
};

/* =====================================================================
   4  SHADERLIB
   ===================================================================== */
const GLSL_LIB = /* glsl */`
  float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  float hash13(vec3 p3){ p3=fract(p3*.1031); p3+=dot(p3,p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
  float noise2(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
  float noise3(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*(3.0-2.0*f);
    float a=hash13(i), b=hash13(i+vec3(1,0,0)), c=hash13(i+vec3(0,1,0)), d=hash13(i+vec3(1,1,0));
    float e=hash13(i+vec3(0,0,1)), f1=hash13(i+vec3(1,0,1)), g=hash13(i+vec3(0,1,1)), h=hash13(i+vec3(1,1,1));
    return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y), mix(mix(e,f1,u.x),mix(g,h,u.x),u.y), u.z); }
  #ifndef FBM_OCT
  #define FBM_OCT 4
  #endif
  float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<FBM_OCT;i++){ v+=a*noise2(p); p=p*2.03+vec2(17.1,9.2); a*=0.5; } return v; }
  vec3 palette(float t){ return 0.5+0.5*cos(6.28318*(t+vec3(0.0,0.33,0.67))); }
  float hexD(vec2 p){ p=abs(p); return max(dot(p, normalize(vec2(1.0,1.7320508))), p.x); }
  vec4 hexCoords(vec2 uv){ vec2 r=vec2(1.0,1.7320508); vec2 h=r*0.5; vec2 a=mod(uv,r)-h; vec2 b=mod(uv-h,r)-h; vec2 gv=dot(a,a)<dot(b,b)?a:b; return vec4(gv, uv-gv); }
  float fresnelF(vec3 n, vec3 v, float p){ return pow(1.0-clamp(abs(dot(n,v)),0.0,1.0), p); }
`;
const fbmDefines = () => ({ FBM_OCT: Q.cfg.fbm });

/* =====================================================================
