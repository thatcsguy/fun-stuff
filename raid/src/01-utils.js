// =============================================================================
//  §2  Utils — math, seeded RNG, scratch objects, pools, timers, GLSL chunks,
//       the global Game object and the encounter registry.
// =============================================================================

// ---------------------------------------------------------------- math
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => clamp01((v - a) / (b - a));
const smooth01 = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
/** frame-rate independent exponential approach */
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInCubic = (t) => { t = clamp01(t); return t * t * t; };
const easeInOutCubic = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOutBack = (t) => { t = clamp01(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutExpo = (t) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
/** wrap angle to (-PI, PI] */
const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const angDiff = (a, b) => wrapAngle(b - a);
const angLerp = (a, b, t) => a + angDiff(a, b) * t;
const angDamp = (a, b, lambda, dt) => a + angDiff(a, b) * (1 - Math.exp(-lambda * dt));
/** Yaw convention used EVERYWHERE: direction(yaw) = (sin yaw, cos yaw) on XZ; mesh.rotation.y = yaw faces +Z→dir. */
const yawTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);
const dist2 = (x0, z0, x1, z1) => Math.hypot(x1 - x0, z1 - z0);

// ---------------------------------------------------------------- seeded RNG (§13.3)
function mulberry32(a) {
  a = a >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// gameplay RNG (seedable) vs. cosmetic RNG (never affects outcomes)
const rand = () => Game.rng();
const randRange = (a, b) => a + (b - a) * Game.rng();
const fxRand = Math.random;
const fxRange = (a, b) => a + (b - a) * Math.random();

// 1D value noise for camera shake (smooth, deterministic)
function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const h = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

// ---------------------------------------------------------------- scratch objects (never hold references to these)
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3(), _v7 = new THREE.Vector3(), _v8 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _e1 = new THREE.Euler();
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const _s1 = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3();

/** Accepts a THREE.Color, a hex number or a CSS string; writes into `out`. */
function toColor(c, out) {
  if (c && c.isColor) return out.copy(c);
  if (typeof c === 'number') return out.setHex(c);
  if (typeof c === 'string') return out.set(c);
  return out.setRGB(1, 1, 1);
}

// ---------------------------------------------------------------- Pool (free-list, preallocated)
class Pool {
  constructor(n, make) {
    this.items = new Array(n); this.free = [];
    for (let i = 0; i < n; i++) { this.items[i] = make(i); this.free.push(this.items[i]); }
  }
  get() { return this.free.length ? this.free.pop() : null; }
  release(it) { this.free.push(it); }
  get used() { return this.items.length - this.free.length; }
}

// ---------------------------------------------------------------- global game object (§13.1)
const SEED0 = URLP.has('seed') ? (parseInt(URLP.get('seed'), 10) || 1) : ((Math.random() * 2 ** 31) | 0);
const Game = {
  state: 'loading', prevState: null,
  time: 0,            // sim clock (monotonic, scaled by timeScale) — used by shaders/particles
  realTime: 0,        // wall clock seconds since boot
  fightTime: 0,       // seconds since FIGHT! (sim)
  timeScale: 1,       // effective sim scale this frame (hit-stop * slow-mo * baseScale)
  baseScale: 1,       // set by death/victory sequences
  paused: false, hidden: false,
  difficulty: 'normal', diff: CONFIG.difficulty.normal,
  player: null, boss: null, arena: null, encounter: null, encounterKey: null,
  adds: [], projectiles: [], telegraphs: [], hazards: [],
  inputLocked: false,  // player abilities/movement frozen (phase transitions, cinematics)
  cinematic: false,    // a skippable camera rail is playing
  god: URLP.get('god') === '1',
  seed: SEED0, rng: mulberry32(SEED0),
  events: [],
  stats: null,
  talents: [0, 0],
  forceWide: 0,        // >0 forces the camera auto-widen (intermissions etc.)
  debug: URLP.get('debug') === '1',
};
Game.diff = CONFIG.difficulty[Game.difficulty];

/** Encounter registry. Boss modules register ENCOUNTERS[0..2]; training lives at ENCOUNTERS.training.
 *  Contract (see 18-game.js startFight):
 *    { key, name, epithet, index, music,
 *      setup(ctx) -> { arena, boss }          // build scene content; ctx = { difficulty, diff, seed }
 *      intro?(ctx) -> railDef|null            // optional intro camera rail (skippable)
 *      onFightStart?(ctx), dispose?() }
 *  arena: { group, radius, colliders:[{x,z,r}], exposure, bloom, grade, update(dt), dispose(), sky? }
 *  boss : a BossEntity (11-combat.js) or compatible object. */
const ENCOUNTERS = [];

function resetStats() {
  Game.stats = {
    damageDealt: 0, damageTaken: 0, perfectDodges: 0, interrupts: 0, interruptChances: 0,
    grandShatters: 0, shatters: 0, fractureUptime: 0, recallHealing: 0, healing: 0, mechanicsFailed: 0,
    zeroHours: 0, deaths: 0, hitsTaken: 0,
  };
}
resetStats();

/** Event log for tests (§14): last 200 of 'damage','perfectDodge','interrupt','phase','death','victory','grandShatter',... */
function logEvent(type, data) {
  Game.events.push({ t: +Game.fightTime.toFixed(3), type, data: data || null });
  if (Game.events.length > 200) Game.events.splice(0, Game.events.length - 200);
}

// ---------------------------------------------------------------- timers (real or sim time)
// Allocation happens only at schedule time (never per frame).
const Timers = {
  list: [],
  /** fn after `sec`. opts.real=true uses wall time (unaffected by hit-stop/slow-mo). Returns handle. */
  after(sec, fn, opts) { const t = { t: sec, fn, real: !!(opts && opts.real), tag: opts && opts.tag, dead: false }; this.list.push(t); return t; },
  cancel(h) { if (h) h.dead = true; },
  cancelTag(tag) { for (const t of this.list) if (t.tag === tag) t.dead = true; },
  clear() { this.list.length = 0; },
  _tick(dt, real) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const t = L[i]; if (t.dead || t.real !== real) continue;
      t.t -= dt;
      if (t.t <= 0) { t.dead = true; try { t.fn(); } catch (e) { console.error(e); } }
    }
    // compact
    let w = 0; for (let i = 0; i < L.length; i++) if (!L[i].dead) L[w++] = L[i];
    L.length = w;
  },
  sim(dt) { this._tick(dt, false); },
  real(dt) { this._tick(dt, true); },
};

// ---------------------------------------------------------------- DOM helpers
const $ = (id) => document.getElementById(id);
function haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } }
function fmtTime(s) { s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }

// ---------------------------------------------------------------- GLSL chunks (shared by every custom shader)
// ---------------------------------------------------------------- draw-call reduction
/** Merge sibling meshes that share a material into one mesh per (parent, material, castShadow).
 *  Rigid-part hierarchies stay intact (only leaf meshes are merged, child transforms are baked).
 *  `keep`: Set of meshes that must stay separate (referenced elsewhere).
 *  Materials with userData.localSpace (vertex shaders reading local position) only merge identity-transform meshes. */
/** Set of every Object3D referenced by an object's own fields (directly or in arrays) — pass as `keep`. */
function collectRefs(obj, set) {
  set = set || new Set();
  for (const k in obj) {
    const v = obj[k];
    if (v && v.isObject3D) set.add(v);
    else if (Array.isArray(v)) for (const e of v) { if (e && e.isObject3D) set.add(e); }
  }
  return set;
}
function mergeStaticMeshes(root, keep) {
  const parents = [];
  root.traverse((o) => { if (o.children.length > 1) parents.push(o); });
  const ID = new THREE.Matrix4();
  for (const parent of parents) {
    const groups = new Map();
    for (const c of parent.children) {
      if (!c.isMesh || c.isInstancedMesh || c.isSkinnedMesh || c.children.length || (keep && keep.has(c)) || Array.isArray(c.material)) continue;
      c.updateMatrix();
      if (c.material.userData.localSpace && !c.matrix.equals(ID)) continue;
      const k = c.material.uuid + (c.castShadow ? 's' : '') + (c.receiveShadow ? 'r' : '') + c.renderOrder;
      let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(c);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      let total = 0;
      const geos = list.map((m) => { let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrix); total += g.attributes.position.count; return g; });
      const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
      let o = 0;
      for (const g of geos) {
        const n = g.attributes.position.count;
        pos.set(g.attributes.position.array, o * 3);
        if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
        o += n; g.dispose();
      }
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      mg.computeBoundingSphere();
      const first = list[0], mm = new THREE.Mesh(mg, first.material);
      mm.castShadow = first.castShadow; mm.receiveShadow = first.receiveShadow; mm.renderOrder = first.renderOrder; mm.name = 'merged';
      for (const m of list) { parent.remove(m); m.geometry.dispose(); }
      parent.add(mm);
    }
  }
  return root;
}

const GLSL_NOISE = /* glsl */`
float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2  hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float hash13(vec3 p3){ p3 = fract(p3*.1031); p3 += dot(p3, p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
vec3  hash33(vec3 p3){ p3 = fract(p3*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yxz+33.33); return fract((p3.xxy+p3.yxx)*p3.zyx); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float vnoise3(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f*f*(3.-2.*f);
  float a = mix(mix(hash13(i), hash13(i+vec3(1,0,0)), u.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), u.x), u.y);
  float b = mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), u.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), u.x), u.y);
  return mix(a, b, u.z); }
float fbm(vec2 p, int oct){ float a = .5, s = 0.; for (int i = 0; i < 6; i++){ if (i >= oct) break; s += a*vnoise(p); p = p*2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
float fbm3(vec3 p, int oct){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ if (i >= oct) break; s += a*vnoise3(p); p = p*2.01 + vec3(1.7, 9.2, 3.1); a *= .5; } return s; }
// 2D Voronoi: x = F1 distance, y = (F2-F1) edge distance, zw = cell id
vec4 voronoi2(vec2 x){ vec2 n = floor(x), f = fract(x); float f1 = 8., f2 = 8.; vec2 id = vec2(0);
  for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){ vec2 g = vec2(i,j); vec2 o = hash22(n+g); vec2 r = g + o - f; float d = dot(r,r);
    if (d < f1){ f2 = f1; f1 = d; id = n+g; } else if (d < f2) f2 = d; }
  f1 = sqrt(f1); f2 = sqrt(f2); return vec4(f1, f2-f1, id); }
// 3D Voronoi edge distance (F2-F1) + nearest cell id
float voronoiEdge3(vec3 x, out vec3 cid){ vec3 n = floor(x), f = fract(x); float f1 = 8., f2 = 8.; cid = n;
  for (int k=-1;k<=1;k++) for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){ vec3 g = vec3(i,j,k); vec3 o = hash33(n+g); vec3 r = g + o - f; float d = dot(r,r);
    if (d < f1){ f2 = f1; f1 = d; cid = n+g; } else if (d < f2) f2 = d; }
  return sqrt(f2) - sqrt(f1); }
`;
