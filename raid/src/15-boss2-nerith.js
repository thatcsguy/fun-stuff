// =============================================================================
//  §15  BOSS 2 — NERITH, THE DROWNED CHOIR  (spec §4.2)
//   Arena: a sunken cathedral floor (flagstones under shallow water: caustics,
//   a 16-entry ripple ring buffer, analytic moon / rose-window reflections,
//   current flow in P3, Hymn-of-Stone shadow wedges, serpent shadows), 6 coral
//   pillars (colliders + line-of-sight blockers with 2 gaze charges, per-instance
//   dissolve when they crumble), the rose window façade with 3 god-ray shafts,
//   a moonlit sky (stars, aurora, moon occlusion, new moon), bubbles + motes.
//   Backdrop: NYXARA, the moon-serpent (90 instanced iridescent segments + fins on a
//   precessing CatmullRom loop; overhead passes with moving shadows; coils on the
//   rim in P3; Coil Crush; lights go out tail→head when Nerith dies).
//   Boss: Nerith (floating siren-oracle: lathe body, water shell, 12 water-hair
//   ribbons, 7-light choir halo, forehead eye, mirrored water reflection).
// =============================================================================

// ---------------------------------------------------------------- tuning (Normal) — lives in CONFIG (spec §0.9)
Object.assign(CONFIG.bosses[1], {
  tapDmg: 20, tapEvery: 3,   // a singer, not a brawler: lighter, slower taps than the spec's 30 / 2 s (balance; see report)
  spawn: { x: 0, z: -6 }, playerSpawn: { x: 0, z: 9 },
  mech: {
    lash: { first: 4, every: 7, everyP3: 9, windup: 1.2, width: 3, len: 30, dmg: 300 },   // 350 → 300 (QA2 balance: two lashes + soak/tap chip ended most bot losses)
    towers: { first: 10, every: 20, everyP2: 22, everyP3: 20, r: 2.5, sep: 14, tA: 3.5, tB: 6.0, tC: 8.5, dmg: 450, soakDmg: 15, drown: 15, harmonized: 4 },   // soak 25 → 15 (QA2: the soak + tap tax alone ate ~85% of the HP bar over a 3.5 min fight)
    hymn: { first: 18, every: 30, cast: 3.0, dmg: 400, petrify: 2 },
    reflections: { cast: 4.0, sep: 16, dmg: 700, drown: 3, again: 0.45, rise: 1.0 },
    undertow: { first: 7, every: 18, mark: 5, r: 4, tick: 60, tickEvery: 0.5, pull: 1, life: 22 },   // life 30 → 22 s (balance: persistent pools clogged the arena; see QA2)
    current: 2.0,
    moonbeam: { first: 6, every: 16, tell: 1.5, width: 2.5, len: 20, speed: 30, dur: 6, dmg: 300, tick: 0.5 },
    coil: { first: 14, every: 16, windup: 1.8, width: 7, dmg: 500, trauma: 0.5 },
    abyssal: { rise: 4.5, level: 1.45, lethalAt: 0.8, dps: 1500 },
    pillars: { ring: 12, r: 1.0, charges: 2 },
    serpent: { segs: 90, loopSec: 20 },
  },
});
Object.assign(HINTS, {
  'Tidal Lash': 'Sidestep the red line, or dash through it as it fills for SLIPSTREAM.',
  'Choir Tower': 'Gold = STAND IN. Soak tower A, dash to tower B as A resolves. Soak both for HARMONIZED (+20% damage, she is stunned).',
  'Hymn of Stone': "Hide in a pillar's violet shadow wedge. Each pillar blocks two gazes, then crumbles.",
  'Requiem': 'Lance the REAL Siren: only she has a reflection in the water, a halo pulsing with her cast bar, and dripping hair.',
  'Whirlpool': 'Undertow Mark drops a whirlpool where you stand when its ring closes. Carry it to the edge.',
  'Moonbeam': 'The current carries you: walk against the flow, or dash through a beam for SLIPSTREAM.',
  'Coil Crush': "Leave the band under the serpent's shadow before it lands.",
  'Abyssal Hymn': 'The cathedral floods at 4:15. Use HARMONIZED windows, Grand Shatters and Zero Hour to finish sooner.',
});

const NER_TEAL = 0x5ff2ff, NER_DEEP = 0x0a3a50, NER_VIOLET = 0xb266ff, NER_GOLD = 0xffc845;
const NER_MOON_DIR = new THREE.Vector3(0.3, 0.72, -0.62).normalize();
const NER_MOON_SIZE = 0.085;                       // angular radius (rad)
const NER_WIN = { x: 0, y: 15, z: -27.0, r: 10.25 };  // rose window (world)
const NER_FLOAT = 1.5;                             // Nerith floats 1.5 m off the floor
const NER_MIRROR = new THREE.Matrix4().makeScale(1, -1, 1);
const NER_ONE = new THREE.Vector3(1, 1, 1);
const NER_CLIP = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.02)];   // sirens are cut at the water line (the floor writes no depth)
renderer.localClippingEnabled = true;     // never written (shared _s1 is scratch elsewhere)

// =============================================================================
//  SHADERS
// =============================================================================
/** stained-glass rose window: p in window units (|p| <= 1). Returns rgb emissive (pre-glow). */
const NER_ROSE_GLSL = /* glsl */`
  vec3 roseWindow(vec2 p, float t){
    float r = length(p);
    if (r > 1.0) return vec3(0.0);
    float a = atan(p.y, p.x);
    float sw = 6.2831853 / 12.0;
    float sa = mod(a + sw * 0.5, sw) - sw * 0.5;
    float sidx = floor((a + 3.14159265 + sw * 0.5) / sw);
    vec2 q = vec2(cos(sa), sin(sa)) * r;
    float lead = abs(r - 0.965);
    lead = min(lead, abs(r - 0.70));
    lead = min(lead, abs(r - 0.38));
    lead = min(lead, abs(r - 0.15));
    if (r > 0.38) lead = min(lead, r * abs(sin(sw * 0.5 - abs(sa))));
    lead = min(lead, abs(length(q - vec2(0.835, 0.0)) - 0.105));                       // outer foils
    vec2 lq = q - vec2(0.54, 0.0);
    lead = min(lead, abs(max(length(lq - vec2(0.0, -0.11)), length(lq - vec2(0.0, 0.11))) - 0.19));   // lancets
    float sw6 = 6.2831853 / 6.0; float sa6 = mod(a + sw6 * 0.5, sw6) - sw6 * 0.5;
    lead = min(lead, abs(length(vec2(cos(sa6), sin(sa6)) * r - vec2(0.265, 0.0)) - 0.07)); // inner trefoils
    float glass = smoothstep(0.014, 0.024, lead);
    float region = r < 0.15 ? 0.0 : r < 0.38 ? 1.0 : r < 0.70 ? 2.0 : 3.0;
    float h = hash12(vec2(region * 7.0 + 1.0, sidx + region * 13.0));
    vec3 pane = h < 0.3 ? vec3(0.05, 0.55, 0.72) : h < 0.55 ? vec3(0.10, 0.22, 0.85) : h < 0.8 ? vec3(0.42, 0.18, 0.85) : vec3(0.08, 0.72, 0.55);
    if (region == 0.0) pane = vec3(0.75, 0.9, 1.0);
    float inFoil = 1.0 - smoothstep(0.09, 0.105, length(q - vec2(0.835, 0.0)));
    pane = mix(pane, vec3(0.2, 0.85, 0.95), inFoil * 0.6);
    float mott = 0.62 + 0.45 * vnoise(p * 17.0) + 0.2 * vnoise(p * 43.0);
    float shim = 0.85 + 0.15 * sin(t * 1.3 + h * 20.0);
    vec3 col = pane * mott * shim * (1.05 - 0.35 * r) * glass;
    return col + vec3(0.006, 0.009, 0.012) * (1.0 - glass);
  }
`;

// ---- cathedral sky (indigo gradient, twinkling stars, huge pale moon, aurora curtains, moon occlusion, new moon)
const NER_SKY_FS = /* glsl */`
  uniform float uTime; uniform float uStreak; uniform vec3 uFocus; uniform float uOctaves;
  uniform vec3 uMoonDir; uniform float uMoonSize; uniform float uMoonOcc; uniform float uNewMoon; uniform float uAurora; uniform float uDark;
  varying vec3 vDir;
  ${GLSL_NOISE}
  float starL(vec3 d, float scale, float thr){
    vec3 q = d * scale; vec3 id = floor(q); float h = hash13(id);
    if (h < thr) return 0.0;
    vec3 sp = hash33(id + 3.7) * 0.8 + 0.1;
    float dist = length(fract(q) - sp);
    return smoothstep(0.1, 0.0, dist) * (0.45 + 0.55 * sin(uTime * (1.2 + h * 6.0) + h * 50.0));
  }
  void main(){
    vec3 d = normalize(vDir); float h = d.y;
    int oct = int(uOctaves + 0.5);
    vec3 zen = vec3(0.003, 0.005, 0.018), mid = vec3(0.010, 0.020, 0.055), hor = vec3(0.030, 0.068, 0.110);
    vec3 col = mix(hor, mid, smoothstep(-0.02, 0.22, h));
    col = mix(col, zen, smoothstep(0.22, 0.9, h));
    col = mix(col, vec3(0.008, 0.02, 0.032), smoothstep(0.0, -0.12, h));
    float ang = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));
    float occ = 1.0 - 0.8 * uMoonOcc;
    // moon halo
    col += vec3(0.42, 0.62, 0.95) * (exp(-ang * 10.0) * 0.20 + exp(-ang * 3.2) * 0.06 + exp(-ang * 34.0) * 0.30) * occ * (1.0 + uNewMoon * 1.2);
    // aurora curtains (sine-folded FBM)
    float az = atan(d.x, -d.z);
    float band = smoothstep(0.06, 0.26, h) * (1.0 - smoothstep(0.42, 0.78, h));
    if (band > 0.001) {
      float fold = sin(az * 4.0 + fbm(vec2(az * 1.6, uTime * 0.04), 2) * 4.0 + uTime * 0.12);
      float curtain = fbm(vec2(az * 7.0 + fold * 0.9, h * 1.5 - uTime * 0.06), oct);
      float rays = pow(vnoise(vec2(az * 70.0 + fold * 8.0, uTime * 0.25)), 2.5);
      float a = smoothstep(0.38, 0.78, curtain) * (0.45 + rays) * band;
      vec3 ac = mix(vec3(0.04, 0.55, 0.40), vec3(0.32, 0.12, 0.62), smoothstep(0.18, 0.6, h + fold * 0.05));
      col += ac * a * 0.32 * uAurora * (1.0 + uNewMoon);
    }
    // stars (fewer close to the moon)
    float s = starL(d, 110.0, 0.972) + starL(d, 230.0, 0.986) * 0.7;
    if (uStreak > 0.01) for (int i = 1; i < 6; i++) { vec3 dd = normalize(d + (d - uFocus) * float(i) * 0.04 * uStreak); s += starL(dd, 110.0, 0.972) * (1.0 - float(i) / 6.0) * uStreak; }
    col += vec3(0.75, 0.88, 1.0) * s * smoothstep(0.02, 0.22, h) * smoothstep(uMoonSize * 1.6, uMoonSize * 5.0, ang) * 1.3;
    // moon disc: maria, limb darkening; the new moon gains a pearlescent serpent sheen
    if (ang < uMoonSize * 1.04) {
      float mu = sqrt(max(1.0 - (ang * ang) / (uMoonSize * uMoonSize), 0.0));
      float maria = fbm3(d * 70.0, 4);
      float crat = smoothstep(0.62, 0.7, vnoise3(d * 260.0));
      vec3 disc = vec3(1.18, 1.26, 1.36) * (0.5 + 0.5 * mu) * (0.78 + 0.35 * maria - 0.12 * crat);
      vec3 film = 0.5 + 0.5 * cos(6.2831 * (mu * 0.8 + uTime * 0.05 + vec3(0.0, 0.33, 0.67)));
      disc = mix(disc, disc * 1.15 + film * 0.35 * (1.0 - mu), uNewMoon);
      disc *= 1.0 - 0.25 * uMoonOcc;
      col = mix(col, disc, smoothstep(uMoonSize * 1.04, uMoonSize * 0.98, ang));
    }
    col *= 1.0 - uDark * 0.65;
    gl_FragColor = vec4(col, 1.0);
  }`;

// ---- the cathedral water floor (MeshStandardMaterial + onBeforeCompile)
function makeCathedralFloorMaterial(R, U) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.0 });
  mat.depthWrite = false;          // the floor is the water surface: mirrored reflections below it must show through
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uTime: GLOBAL_U.uTime, uR: { value: R }, uOctaves: GLOBAL_U.uOctaves });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFloorW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloorW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFloorW; uniform float uTime; uniform float uR; uniform float uOctaves;\n' +
      'uniform vec3 uRipples[16]; uniform float uFlow; uniform float uFlowS; uniform float uHymn; uniform float uHymnPulse; uniform vec2 uEye; uniform vec4 uPillars[6];\n' +
      'uniform vec4 uShadow[8]; uniform vec4 uBoss; uniform vec3 uMoonDir; uniform float uMoonSize; uniform float uMoonOcc; uniform vec4 uRaySpots[3]; uniform float uGlow; uniform vec4 uWin; uniform float uWinGlow;\n' +
      GLSL_NOISE + NER_ROSE_GLSL + `
      vec3 gEm; vec3 gN; float gRough;
      vec3 nerSkyRefl(vec3 R){
        float h = max(R.y, 0.0);
        vec3 c = mix(vec3(0.030, 0.068, 0.11), vec3(0.010, 0.020, 0.055), smoothstep(0.0, 0.3, h));
        float ma = acos(clamp(dot(R, uMoonDir), -1.0, 1.0));
        float occ = 1.0 - 0.8 * uMoonOcc;
        c += vec3(0.42, 0.62, 0.95) * (exp(-ma * 10.0) * 0.25 + exp(-ma * 34.0) * 0.6) * occ;
        c += vec3(1.1, 1.2, 1.3) * smoothstep(uMoonSize * 1.1, uMoonSize * 0.85, ma) * occ;
        return c;
      }
    `).replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 fp = vFloorW.xz; float fr = length(fp);
        vec3 Vw = normalize(cameraPosition - vFloorW);
        // quality tier (uniform branch, no recompile): this floor covers most of the screen, so Medium/Low drop the
        // second wavelet octave, half the ripple slots, the second caustic layer and the rose-window reflection ray
        bool fHQ = uOctaves > 3.5;
        // ---- current flow frame (P3): the pattern rotates clockwise at 2 m/s (shears into streaks)
        float fang = uFlowS / max(fr, 1.5);
        float fc = cos(-fang), fs = sin(-fang);
        vec2 fq = vec2(fc * fp.x - fs * fp.y, fs * fp.x + fc * fp.y);
        // ---- flagstones: radial labyrinth paving in the centre, running bond outside
        float mortar, sid;
        if (fr < 7.2) {
          float rr = fr / 1.2; float ring = floor(rr); float ringF = fract(rr);
          float segs = 6.0 + ring * 6.0;
          float an = atan(fp.y, fp.x) / 6.2831853 + 0.5;
          float aa = an * segs + ring * 0.37; float fa = fract(aa);
          mortar = min(min(ringF, 1.0 - ringF) * 1.2, min(fa, 1.0 - fa) * (6.2831853 * max(fr, 0.3) / segs));
          sid = hash12(vec2(ring, floor(aa)));
          if (fr < 1.2) { mortar = abs(fr - 1.2); sid = 0.9; }
        } else {
          vec2 g = fp / vec2(1.75, 1.15);
          float row = floor(g.y); g.x += mod(row, 2.0) * 0.5;
          vec2 f = fract(g);
          mortar = min(min(f.x, 1.0 - f.x) * 1.75, min(f.y, 1.0 - f.y) * 1.15);
          sid = hash12(floor(g) + 13.0);
        }
        float mline = 1.0 - smoothstep(0.025, 0.07, mortar);
        float grain = vnoise(fp * 3.1) * 0.5 + vnoise(fp * 9.0) * 0.5;
        vec3 stone = vec3(0.060, 0.070, 0.082) * (0.5 + 0.9 * sid) * (0.8 + 0.4 * grain);
        float algae = smoothstep(0.5, 0.82, fbm(fp * 0.16 + 3.0, 3));
        stone = mix(stone, vec3(0.018, 0.06, 0.045), algae * 0.55);
        stone = mix(stone, vec3(0.010, 0.013, 0.018), mline);
        // centre medallion inlay + arena edge border
        float inlay = (1.0 - smoothstep(0.03, 0.07, abs(fr - 7.2))) + (1.0 - smoothstep(0.02, 0.05, abs(fr - 3.6)));
        stone = mix(stone, vec3(0.13, 0.15, 0.16), clamp(inlay, 0.0, 1.0) * 0.8);
        float edgeBand = smoothstep(uR - 0.8, uR - 0.65, fr) * (1.0 - smoothstep(uR + 0.55, uR + 0.7, fr));
        stone = mix(stone, vec3(0.10, 0.115, 0.125) * (0.7 + 0.5 * grain), edgeBand);
        float deep = smoothstep(uR + 0.7, uR + 10.0, fr);
        stone *= 1.0 - deep * 0.88;
        vec3 wcol = stone * vec3(0.55, 0.82, 0.92);
        // ---- water surface normal: flow-advected wavelets + ripple rings (ring buffer)
        vec2 wq = mix(fp, fq, uFlow);
        float e = 0.12;
        vec2 o1 = uTime * vec2(0.30, 0.20), o2 = -uTime * vec2(0.25, 0.40);
        float h0 = vnoise(wq * 1.3 + o1);
        float hx = vnoise((wq + vec2(e, 0.0)) * 1.3 + o1);
        float hz = vnoise((wq + vec2(0.0, e)) * 1.3 + o1);
        if (fHQ) {
          h0 += 0.5 * vnoise(wq * 3.1 + o2);
          hx += 0.5 * vnoise((wq + vec2(e, 0.0)) * 3.1 + o2);
          hz += 0.5 * vnoise((wq + vec2(0.0, e)) * 3.1 + o2);
        }
        vec2 g = vec2(hx - h0, hz - h0) / e * (0.045 + 0.04 * uFlow);
        float crest = 0.0;
        int nRip = fHQ ? 16 : 8;
        for (int i = 0; i < 16; i++) {
          if (i >= nRip) break;
          vec3 rp = uRipples[i]; float age = uTime - rp.z;
          if (age <= 0.0 || age > 2.4) continue;
          vec2 dv = fp - rp.xy; float dist = length(dv);
          float x = dist - age * 2.7;
          float fade = 1.0 - age / 2.4;
          float env = exp(-x * x * 2.2) * fade * fade;
          g += dv / max(dist, 1e-3) * cos(x * 8.0) * env * 0.32;
          crest += max(sin(x * 8.0), 0.0) * env;
        }
        vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
        // ---- caustics: two scrolling Voronoi layers, min-combined (flow along the current in P3)
        vec2 cp = wq * 0.42 + g * 1.4;
        vec4 v1 = voronoi2(cp + vec2(uTime * 0.11, uTime * 0.07));
        float ce = v1.y;
        if (fHQ) { vec4 v2 = voronoi2(cp * 1.37 + vec2(-uTime * 0.08, uTime * 0.10) + 4.7); ce = min(ce, v2.y); }
        float caust = pow(1.0 - smoothstep(0.0, 0.13, ce), 3.0) * (0.55 + 0.45 * vnoise(fp * 0.3 + uTime * 0.05)) * (1.0 - deep * 0.8);
        // god-ray light pools + glow under Nerith
        float pool = 0.0;
        for (int i = 0; i < 3; i++) { vec4 s = uRaySpots[i]; vec2 dd = fp - s.xy; pool += exp(-dot(dd, dd) / (s.z * s.z)) * s.w; }
        vec2 db = fp - uBoss.xy; float bg = exp(-dot(db, db) / 5.0) * uBoss.z;
        // ---- coil shadows (capsules along the low part of the serpent)
        float shade = 0.0;
        for (int i = 0; i < 7; i++) {
          vec4 a = uShadow[i], b = uShadow[i + 1];
          if (a.w <= 0.001 || b.w <= 0.001) continue;
          vec2 pa = fp - a.xy, ba = b.xy - a.xy;
          float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
          float dd = length(pa - ba * hh), rr = mix(a.z, b.z, hh);
          shade = max(shade, (1.0 - smoothstep(rr * 0.45, rr, dd)) * mix(a.w, b.w, hh));
        }
        // ---- reflection: analytic sky + moon + the rose window on the north wall
        vec3 Rr = reflect(-Vw, nW);
        vec3 refl = nerSkyRefl(Rr);
        if (fHQ && Rr.z < -0.01) {
          float tt = (uWin.z - vFloorW.z) / Rr.z;
          vec3 hit = vFloorW + Rr * tt;
          vec2 wuv = (hit.xy - uWin.xy) / uWin.w;
          if (dot(wuv, wuv) < 1.0) refl = roseWindow(wuv, uTime) * uWinGlow * 0.55 * (0.35 + 0.65 * smoothstep(0.12, 0.3, length(wuv)));
          else if (abs(hit.x) < 15.5 && hit.y < 22.0 + (15.5 - abs(hit.x)) * 0.8) refl = vec3(0.004, 0.007, 0.010);
        }
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(nW, Vw), 0.0), 5.0);
        vec3 reflC = refl * min(F * 1.8, 0.7) * (1.0 - shade * 0.8);
        // ---- assemble
        diffuseColor.rgb = wcol * (1.0 - 0.8 * shade);
        gEm = vec3(0.09, 0.40, 0.46) * caust * (0.16 + 0.9 * pool + bg * 1.0) * (1.0 - 0.75 * shade) * uGlow;
        gEm += vec3(0.05, 0.16, 0.18) * pool * 0.6 * (1.0 - deep);
        gEm += vec3(0.22, 0.6, 0.66) * crest * 0.22;
        gEm += vec3(0.08, 0.3, 0.34) * bg * 0.5;
        gEm += reflC;
        // current streaks (P3)
        if (uFlow > 0.001) {
          float st = 0.0;
          for (int k = 0; k < 3; k++) { float ak = float(k) * 0.035; vec2 q2 = vec2(cos(ak) * fq.x - sin(ak) * fq.y, sin(ak) * fq.x + cos(ak) * fq.y); st += vnoise(q2 * 1.7); }
          st = smoothstep(0.68, 0.9, st / 3.0) * (1.0 - deep);
          gEm += vec3(0.16, 0.45, 0.52) * st * uFlow * 0.22;
        }
        // arena edge runes (readable boundary)
        float rb = abs(fr - (uR + 0.08));
        if (rb < 0.22) {
          float an2 = atan(fp.y, fp.x) * uR / 0.85;
          float cell = floor(an2); float lx = fract(an2);
          float ly = (fr - (uR + 0.08)) / 0.22 * 0.5 + 0.5;
          vec2 gc = floor(vec2(lx * 3.0, ly * 3.0));
          float glyph = step(0.48, hash12(gc + cell * 7.1)) * step(0.15, lx) * step(lx, 0.85) * step(0.12, ly) * step(ly, 0.88);
          float pul = 0.65 + 0.35 * sin(uTime * 1.3 + cell * 0.7);
          gEm += vec3(0.18, 0.85, 1.0) * glyph * pul * 0.75 * (1.0 - shade * 0.6);
        }
        // ---- HYMN OF STONE: violet safe wedges behind every standing pillar; the exposed floor is bathed in the gaze
        if (uHymn > 0.001) {
          float wedge = 0.0, rim = 0.0;
          for (int i = 0; i < 6; i++) {
            vec4 P = uPillars[i];
            if (P.w < 0.5) continue;
            vec2 v = P.xy - uEye; float L = length(v); vec2 vd = v / max(L, 1e-3);
            vec2 rel = fp - uEye; float along = dot(rel, vd);
            if (along < L - P.z * 0.4) continue;
            float perp = abs(rel.x * vd.y - rel.y * vd.x);
            float halfW = along * P.z / sqrt(max(L * L - P.z * P.z, 0.01));
            float dE = perp - halfW;
            wedge = max(wedge, 1.0 - smoothstep(-0.06, 0.06, dE));
            float dots = step(0.42, fract(along * 1.1 - uTime * 1.2));
            rim = max(rim, (1.0 - smoothstep(0.0, 0.2, abs(dE))) * dots);
          }
          float inA = 1.0 - smoothstep(uR - 0.3, uR, fr);
          wedge *= inA; rim *= inA;
          float expo = (1.0 - wedge) * inA;
          float gz = smoothstep(0.82, 1.0, fract(length(fp - uEye) * 0.22 - uTime * 0.7));
          vec3 vio = vec3(0.70, 0.40, 1.0);
          diffuseColor.rgb *= 1.0 - wedge * 0.45 * uHymn;
          gEm *= 1.0 - wedge * 0.5 * uHymn;
          gEm += vio * wedge * 0.20 * uHymn;
          gEm += mix(vio * 1.6, vec3(1.35), uHymnPulse) * rim * uHymn;
          gEm += vec3(0.5, 0.42, 0.75) * expo * uHymn * (0.07 + 0.10 * gz);
        }
        gRough = mix(0.42, 0.7, mline) + shade * 0.2;
        gN = nW;
      }
    `).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize((viewMatrix * vec4(gN, 0.0)).xyz);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gRough;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEm;');
  };
  mat.customProgramCacheKey = () => 'cathedralFloor';
  return mat;
}

// ---- rose window (the disc in the north façade)
const NER_WINDOW_FS = /* glsl */`
  uniform float uTime; uniform float uGlow; uniform float uEye;
  varying vec2 vUv;
  ${GLSL_NOISE}
  ${NER_ROSE_GLSL}
  void main(){
    vec2 p = (vUv - 0.5) * 2.0;
    vec3 c = roseWindow(p, uTime) * uGlow;
    c += vec3(0.5, 0.3, 0.9) * uEye * smoothstep(0.4, 0.0, length(p)) * 0.8;
    gl_FragColor = vec4(c, 1.0);
  }`;

// ---- god-ray shafts (additive, noise-scrolled alpha, soft edges by view angle)
const NER_RAY_VS = /* glsl */`
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const NER_RAY_FS = /* glsl */`
  uniform float uTime; uniform float uK; uniform vec3 uColor;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
  ${GLSL_NOISE}
  void main(){
    float edge = abs(dot(normalize(vN), normalize(vV)));
    float n = vnoise(vec2(vUv.x * 9.0, vUv.y * 3.0 + uTime * 0.25)) * 0.6 + vnoise(vec2(vUv.x * 23.0, vUv.y * 7.0 - uTime * 0.4)) * 0.4;
    float motes = smoothstep(0.86, 0.97, vnoise(vec2(vUv.x * 60.0, vUv.y * 40.0 + uTime * 0.6)));
    float along = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
    float a = pow(edge, 2.2) * along * (0.45 + 0.75 * n) + motes * along * 0.5;
    a *= smoothstep(0.0, 1.2, vW.y);       // fade into the water
    gl_FragColor = vec4(uColor * a * uK, 1.0);
  }`;

// ---- water (hair ribbons, fresnel shell, the water column under her) — additive
const NER_WATER_VS = /* glsl */`
  uniform float uTime; uniform float uWave;
  #ifdef HAIR
  attribute float aT; attribute float aRib;
  #endif
  varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vT; varying float vWY;
  void main(){
    vec3 p = position; vUv = uv;
    #ifdef HAIR
      vT = aT;
      float k = pow(aT, 1.3);
      p.x += sin(uTime * 2.1 + aT * 6.0 + aRib * 1.7) * 0.24 * k * uWave;
      p.z += cos(uTime * 1.7 + aT * 5.0 + aRib * 2.3) * 0.18 * k * uWave;
      p.y += sin(uTime * 2.6 + aT * 7.0 + aRib) * 0.06 * k * uWave;
    #else
      vT = uv.y;
    #endif
    vec4 w = modelMatrix * vec4(p, 1.0); vWY = w.y;
    vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const NER_WATER_FS = /* glsl */`
  uniform vec3 uColor; uniform float uIntensity; uniform float uTime; uniform float uScroll; uniform float uUnfurl; uniform float uAlpha;
  varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vT; varying float vWY;
  ${GLSL_NOISE}
  void main(){
    #ifdef REFL
    if (vWY > 0.02) discard;
    #else
    if (vWY < -0.02) discard;
    #endif
    #ifdef HAIR
    if (vT > uUnfurl) discard;
    #endif
    float fres = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.0);
    float n = vnoise(vec2(vUv.x * 8.0, vT * 6.0 - uTime * uScroll));
    float hi = smoothstep(0.68, 0.95, vnoise(vec2(vUv.x * 14.0 + 3.0, vT * 12.0 - uTime * uScroll * 1.6)));
    vec3 c = uColor * (0.10 + 0.9 * fres) * (0.55 + 0.6 * n) + vec3(0.65, 0.95, 1.0) * hi * 0.55 * (0.3 + fres);
    #ifdef HAIR
    c *= (1.0 - vT * 0.45) * smoothstep(uUnfurl, uUnfurl - 0.08, vT);
    #endif
    gl_FragColor = vec4(c * uIntensity * uAlpha, 1.0);
  }`;
function makeNerWaterMaterial(o) {
  o = o || {};
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL_U.uTime, uColor: { value: new THREE.Color(o.color != null ? o.color : 0x46e0ff) }, uIntensity: { value: o.intensity != null ? o.intensity : 0.8 },
      uScroll: { value: o.scroll != null ? o.scroll : 1 }, uUnfurl: { value: 1.01 }, uWave: { value: 1 }, uAlpha: { value: 1 } },
    vertexShader: NER_WATER_VS, fragmentShader: NER_WATER_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  m.defines = {}; if (o.hair) m.defines.HAIR = 1; if (o.refl) m.defines.REFL = 1;
  return m;
}

// ---- mirrored reflection in the water (additive, fades with depth below the surface, wobbles)
const NER_REFL_VS = /* glsl */`
  uniform float uTime; varying float vY; varying vec3 vN; varying vec3 vV;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    w.x += sin(w.y * 5.0 + uTime * 2.3) * 0.05 * (-w.y); w.z += cos(w.y * 4.0 + uTime * 1.9) * 0.04 * (-w.y);
    vY = w.y; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const NER_REFL_FS = /* glsl */`
  uniform vec3 uColor; uniform float uAlpha; uniform float uFade; uniform float uTime;
  varying float vY; varying vec3 vN; varying vec3 vV;
  void main(){
    if (vY > 0.02) discard;
    float fres = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.5);
    float a = 1.0 - smoothstep(0.0, uFade, -vY);
    float band = 0.75 + 0.25 * sin(vY * 22.0 + uTime * 3.0);
    gl_FragColor = vec4(uColor * (0.25 + 0.75 * fres) * a * band * uAlpha, 1.0);
  }`;
function makeNerReflMaterial(color, alpha) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color != null ? color : 0x2a9ab8) }, uAlpha: { value: alpha != null ? alpha : 0.55 }, uFade: { value: 4.5 }, uTime: GLOBAL_U.uTime },
    vertexShader: NER_REFL_VS, fragmentShader: NER_REFL_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ---- Nyxara: iridescent thin-film scales + dorsal bioluminescent stripe with a pulse travelling head → tail
const NYX_SEG_VS = /* glsl */`
  attribute float aIdx;
  varying vec3 vN; varying vec3 vV; varying vec3 vO; varying float vIdx; varying vec3 vW;
  void main(){
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vO = position; vIdx = aIdx; vV = cameraPosition - w.xyz; vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
// the coil can sweep right past the chase camera (Coil Crush, rim): dither it out near the lens and on the
// camera→player sightline so the player and the floor telegraphs stay readable
const NYX_OCC_GLSL = /* glsl */`
  uniform vec3 uOccP; varying vec3 vW;
  void nyxOcc(){
    vec3 ab = uOccP - cameraPosition; float L = length(ab); vec3 dv = ab / max(L, 1e-3);
    vec3 rel = vW - cameraPosition; float tp = dot(rel, dv);
    float k = 1.0 - smoothstep(4.0, 8.5, length(rel));
    if (tp > 0.0 && tp < L - 0.5) k = max(k, (1.0 - smoothstep(1.8, 4.2, length(rel - dv * tp))) * 0.92);
    if (k > 0.0) {
      vec2 q = mod(floor(gl_FragCoord.xy), 4.0);
      float bay = mod(q.x * 2.0 + q.y * 3.0 + q.x * q.y, 4.0) * 0.25 + 0.125 * mod(q.x + q.y, 2.0);
      if (bay < k) discard;
    }
  }
`;
const NYX_SEG_FS = /* glsl */`
  uniform float uTime; uniform vec3 uMoonDir; uniform float uDark; uniform float uN; uniform float uGlow; uniform float uPulseSpeed;
  varying vec3 vN; varying vec3 vV; varying vec3 vO; varying float vIdx;
  ${NYX_OCC_GLSL}
  void main(){
    nyxOcc();
    vec3 n = normalize(vN), v = normalize(vV);
    float fres = 1.0 - clamp(dot(n, v), 0.0, 1.0);
    float lit = 1.0 - smoothstep(1.0 - uDark - 0.01, 1.0 - uDark + 0.01, vIdx / uN);
    float ang = atan(vO.x, vO.y);                       // 0 = dorsal
    vec2 sc = vec2(ang * 2.4, vO.z * 2.2 + vIdx * 1.31);
    sc.x += step(1.0, mod(floor(sc.y), 2.0)) * 0.5;
    vec2 sf = fract(sc) - 0.5;
    float scaleEdge = smoothstep(0.22, 0.5, length(sf * vec2(1.0, 1.35)));
    vec3 base = mix(vec3(0.020, 0.026, 0.050), vec3(0.11, 0.13, 0.16), smoothstep(0.1, -0.8, vO.y));
    base *= 1.0 - 0.5 * scaleEdge;
    float diff = max(dot(n, uMoonDir), 0.0);
    vec3 col = base * (0.35 + 1.4 * diff);
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (fres * 1.4 + vIdx * 0.013 + uTime * 0.03 + vec3(0.0, 0.33, 0.67)));
    col += mix(vec3(0.05, 0.45, 0.55), vec3(0.45, 0.25, 0.8), film.r) * mix(0.6, 1.0, film.g) * pow(fres, 3.0) * 0.3 * (0.35 + 0.65 * lit);
    vec3 hv = normalize(uMoonDir + v);
    col += vec3(0.6, 0.8, 1.0) * pow(max(dot(n, hv), 0.0), 36.0) * 0.5 * (1.0 - scaleEdge * 0.6);
    float dors = 1.0 - smoothstep(0.18, 0.34, abs(ang));
    float dots = 1.0 - smoothstep(0.12, 0.3, length(vec2(fract(vO.z * 1.4 + vIdx * 0.7) - 0.5, ang * 1.4)));
    float lateral = (1.0 - smoothstep(0.0, 0.12, abs(abs(ang) - 1.75))) * step(0.5, fract(vO.z * 2.0 + vIdx * 0.5));
    float dp = vIdx / uN - fract(uTime * uPulseSpeed); dp -= floor(dp + 0.5);
    float pulse = exp(-dp * dp * 220.0);
    vec3 bio = vec3(0.12, 0.92, 1.0);
    col += bio * (dors * 0.22 + dots * 0.85 + lateral * 0.35) * (0.45 + 2.6 * pulse) * uGlow * lit;
    gl_FragColor = vec4(col, 1.0);
  }`;
const NYX_FIN_FS = /* glsl */`
  uniform float uTime; uniform float uDark; uniform float uN; uniform float uGlow; uniform float uPulseSpeed;
  varying vec3 vN; varying vec3 vV; varying vec3 vO; varying float vIdx;
  ${NYX_OCC_GLSL}
  void main(){
    nyxOcc();
    float lit = 1.0 - smoothstep(1.0 - uDark - 0.01, 1.0 - uDark + 0.01, vIdx / uN);
    vec2 p = vO.zy;                                       // fin plane: z along body, y up (0..1)
    float edge = smoothstep(0.0, 0.25, 1.0 - p.y);
    float rays = smoothstep(0.75, 1.0, sin(p.x * 14.0 + p.y * 3.0) * 0.5 + 0.5);
    float fres = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (p.y * 0.9 + vIdx * 0.02 + uTime * 0.05 + vec3(0.0, 0.33, 0.67)));
    float dp = vIdx / uN - fract(uTime * uPulseSpeed); dp -= floor(dp + 0.5);
    float pulse = exp(-dp * dp * 220.0);
    vec3 c = mix(vec3(0.05, 0.4, 0.5), vec3(0.4, 0.2, 0.75), film.r) * (0.04 + 0.08 * rays + 0.08 * fres) + vec3(0.15, 0.9, 1.0) * (1.0 - edge) * 0.35 * (0.4 + 2.0 * pulse) * uGlow;
    gl_FragColor = vec4(c * (0.25 + 0.75 * lit) * smoothstep(0.0, 0.08, p.y), 1.0);
  }`;

// ---- whirlpool swirl decal (premultiplied: darkens the floor, foam adds light)
const NER_SWIRL_FS = /* glsl */`
  uniform float uTime; uniform float uA; uniform float uSeed;
  varying vec2 vUv;
  void main(){
    vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
    if (r > 1.0) discard;
    float a = atan(p.y, p.x);
    float sw = sin(a * 3.0 + log(r + 0.04) * 7.0 + uTime * 4.5 + uSeed);
    float arms = smoothstep(0.2, 1.0, sw);
    float foam = smoothstep(0.86, 0.99, sw) * smoothstep(1.0, 0.45, r);
    float rimF = smoothstep(1.0, 0.92, r);
    float dark = smoothstep(0.8, 0.0, r) * 0.8;
    vec3 c = vec3(0.10, 0.32, 0.46) * arms * 0.45 + vec3(0.55, 0.9, 1.0) * foam * 0.55;
    float al = (dark + arms * 0.22) * rimF;
    gl_FragColor = vec4(c * rimF, al) * uA;
  }`;

// ---- choir tower light column (gold, ringed)
const NER_TOWER_FS = /* glsl */`
  uniform float uTime; uniform float uK; uniform vec3 uColor;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
  ${GLSL_NOISE}
  void main(){
    float y = vUv.y;
    float fres = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float streak = vnoise(vec2(vUv.x * 26.0, y * 3.0 - uTime * 1.4));
    float rings = smoothstep(0.82, 1.0, fract(y * 3.5 - uTime * 0.8)) * (1.0 - y);
    float fade = (1.0 - y) * (1.0 - y) * smoothstep(0.0, 0.04, y);
    vec3 c = uColor * (0.12 + 0.45 * streak + 1.1 * rings) * fade * (0.35 + 0.65 * fres) * uK;
    gl_FragColor = vec4(c, 1.0);
  }`;

// ---- Tidal Lash: a wall of water racing down the line
const NER_LASH_VS = /* glsl */`
  uniform float uFront; uniform float uAmp; uniform float uTime;
  varying vec2 vUv; varying float vH; varying vec3 vN; varying vec3 vV;
  void main(){
    vec3 p = position;
    float s = p.z;
    float k = exp(-pow((s - uFront) / 2.6, 2.0));
    float trail = step(s, uFront) * smoothstep(uFront - 14.0, uFront, s) * 0.22;
    float H = uAmp * max(k, trail) * (1.0 + 0.25 * sin(s * 1.3 + uTime * 9.0));
    p.y *= H;
    p.x += sin(s * 0.8 + uTime * 7.0) * 0.3 * k + (position.y) * 0.45 * k;
    vH = H; vUv = uv;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const NER_LASH_FS = /* glsl */`
  uniform float uTime; uniform float uAlpha;
  varying vec2 vUv; varying float vH; varying vec3 vN; varying vec3 vV;
  ${GLSL_NOISE}
  void main(){
    if (vH < 0.03) discard;
    float n = vnoise(vec2(vUv.x * 40.0 - uTime * 6.0, vUv.y * 5.0));
    float foam = smoothstep(0.6, 1.0, vUv.y) * (0.6 + 0.6 * n);
    vec3 c = mix(vec3(0.05, 0.35, 0.5), vec3(0.85, 0.98, 1.0), foam) * (0.5 + 0.5 * n);
    gl_FragColor = vec4(c * uAlpha * 0.9, 1.0);
  }`;

// ---- the Abyssal Hymn flood (enrage) — a dark teal surface rising over everything
const NER_FLOOD_VS = /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const NER_FLOOD_FS = /* glsl */`
  uniform float uTime; uniform float uA; uniform vec3 uMoonDir;
  varying vec3 vW;
  ${GLSL_NOISE}
  void main(){
    vec2 p = vW.xz;
    vec4 v1 = voronoi2(p * 0.35 + vec2(uTime * 0.2, uTime * 0.13));
    vec4 v2 = voronoi2(p * 0.5 + vec2(-uTime * 0.16, uTime * 0.18) + 3.0);
    float c = pow(1.0 - smoothstep(0.0, 0.07, min(v1.y, v2.y)), 3.0);
    vec3 V = normalize(cameraPosition - vW);
    float F = 0.04 + 0.96 * pow(1.0 - max(V.y, 0.0), 5.0);
    float foam = smoothstep(0.7, 0.95, vnoise(p * 1.5 + uTime * vec2(0.6, -0.4)));
    float swell = vnoise(p * 0.12 + uTime * 0.05);
    vec3 col = vec3(0.008, 0.03, 0.05) * (0.7 + 0.6 * swell) + vec3(0.1, 0.42, 0.5) * c * 0.12 + vec3(0.3, 0.45, 0.75) * F * 0.35 + vec3(0.5, 0.8, 0.9) * foam * 0.06;
    col += vec3(0.25, 0.1, 0.4) * (0.5 + 0.5 * sin(length(p) * 0.8 - uTime * 2.0)) * 0.05;   // the hymn's slow violet swell
    gl_FragColor = vec4(col * uA, 0.82 * uA);
  }`;

// ---- underwater lens overlay (intro: looking up through the water at the moon)
const NER_UNDER_FS = /* glsl */`
  uniform float uTime; uniform float uA;
  varying vec2 vUv;
  ${GLSL_NOISE}
  void main(){
    vec2 p = vUv * vec2(3.0, 1.8);
    vec4 v1 = voronoi2(p * 2.2 + vec2(uTime * 0.3, uTime * 0.2));
    vec4 v2 = voronoi2(p * 2.9 + vec2(-uTime * 0.25, uTime * 0.31) + 5.0);
    float c = pow(1.0 - smoothstep(0.0, 0.035, min(v1.y, v2.y)), 3.0);
    float vig = smoothstep(0.2, 0.9, length(vUv - 0.5) * 1.6);
    float top = smoothstep(0.35, 1.0, vUv.y);
    vec3 col = vec3(0.1, 0.55, 0.65) * c * (0.006 + 0.014 * top);
    float a = (0.38 + vig * 0.45) * uA;
    gl_FragColor = vec4(col * uA + vec3(0.0, 0.03, 0.05) * a, a);
  }`;

// ---- the water surface seen from below (intro): Snell's window — the sky shows through a disc overhead,
//      outside it the surface is a dark mirror of the deep (hides the cathedral seen edge-on from under the floor)
const NER_SURF_FS = /* glsl */`
  uniform float uTime; uniform float uA;
  varying vec3 vW;
  ${GLSL_NOISE}
  void main(){
    vec3 V = normalize(vW - cameraPosition);
    vec2 p = vW.xz;
    float n = vnoise(p * 0.6 + uTime * 0.3) * 0.5 + vnoise(p * 1.7 - uTime * 0.45) * 0.5;
    float cosT = V.y + (n - 0.5) * 0.07;
    float win = smoothstep(0.6, 0.7, cosT);
    vec4 v1 = voronoi2(p * 0.8 + vec2(uTime * 0.25, uTime * 0.18));
    vec4 v2 = voronoi2(p * 1.25 + vec2(-uTime * 0.2, uTime * 0.22) + 3.0);
    float c = pow(1.0 - smoothstep(0.0, 0.09, min(v1.y, v2.y)), 2.0);
    float rim = exp(-pow((cosT - 0.65) / 0.03, 2.0));
    vec3 deep = vec3(0.004, 0.02, 0.032) * (0.8 + 0.4 * n) + vec3(0.04, 0.16, 0.2) * c * 0.3;
    vec3 col = deep * (1.0 - win) + vec3(0.22, 0.55, 0.65) * rim * 0.3 + vec3(0.25, 0.6, 0.7) * c * 0.08 * win;
    col += vec3(0.012, 0.05, 0.065) * win;                 // the water column blurs what lies above
    float a = mix(1.0, 0.32 + c * 0.25, win);
    gl_FragColor = vec4(col, a) * uA;
  }`;

// =============================================================================
//  NYXARA — the moon-serpent (instanced segments on a precessing CatmullRom loop)
// =============================================================================
class Nyxara {
  constructor(parent) {
    const N = this.N = CONFIG.bosses[1].mech.serpent.segs;
    this.parent = parent;
    this.ctrl = []; this.tgt = [];
    for (let k = 0; k < 8; k++) { this.ctrl.push(new THREE.Vector3()); this.tgt.push(new THREE.Vector3()); }
    this.curve = new THREE.CatmullRomCurve3(this.ctrl, true, 'catmullrom', 0.5);
    this.curve.arcLengthDivisions = 160;
    this.mode = 'orbit'; this.t = 0; this.prec = 0.6; this.u0 = 0.62; this.f = 0.5; this.speed = 1 / CONFIG.bosses[1].mech.serpent.loopSec;
    this.rate = 1.2; this.pass = 0; this.passForce = -1; this.lower = 0; this.crush = null; this.deathRise = 0;
    this.dark = 0; this.dissolve = 0; this.glow = 1; this.scaleK = 1; this.moonOcc = 0; this.lastDarkIdx = N; this.lastDisIdx = N;
    this.px = new Float32Array(N * 3); this.tx = new Float32Array(N * 3); this.rad = new Float32Array(N);
    this.shadow = []; for (let i = 0; i < 8; i++) this.shadow.push(new THREE.Vector4(0, 0, 1, 0));
    this.onPass = null;
    this.build();
    this.targets(0); for (let k = 0; k < 8; k++) this.ctrl[k].copy(this.tgt[k]);
  }
  build() {
    const N = this.N;
    const idx = new Float32Array(N); for (let i = 0; i < N; i++) idx[i] = i;
    const segG = new THREE.SphereGeometry(1, 16, 10);
    segG.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1));
    const U = { uTime: GLOBAL_U.uTime, uOccP: GLOBAL_U.uOccP, uMoonDir: { value: NER_MOON_DIR }, uDark: { value: 0 }, uN: { value: N }, uGlow: { value: 1 }, uPulseSpeed: { value: 0.28 } };
    this.U = U;
    this.segMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: NYX_SEG_VS, fragmentShader: NYX_SEG_FS });
    this.segMesh = new THREE.InstancedMesh(segG, this.segMat, N);
    const finG = new THREE.PlaneGeometry(1, 1, 4, 4); finG.rotateY(Math.PI / 2); finG.translate(0, 0.5, 0);
    { const pa = finG.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setZ(i, pa.getZ(i) * (1 - y * 0.55) - y * 0.35); } finG.computeVertexNormals(); }
    finG.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx.slice(), 1));
    this.finMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: NYX_SEG_VS, fragmentShader: NYX_FIN_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.finMesh = new THREE.InstancedMesh(finG, this.finMat, N);
    for (const m of [this.segMesh, this.finMesh]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.parent.add(m); }
    this.finMesh.renderOrder = 6;
    // head: skull, snout, jaw, swept horns, glowing eyes, crest spikes
    const g = this.head = new THREE.Group(); g.matrixAutoUpdate = false; this.parent.add(g);
    this.headMat = makeArcane({ color: 0x0e1622, roughness: 0.32, metalness: 0.65 }, { rim: 1.3, rimColor: 0x46d8ff, key: 'nyxHead', occluder: true });
    this.hornMat = makeArcane({ color: 0x1c2430, roughness: 0.5, metalness: 0.4 }, { rim: 0.8, rimColor: 0xb8a0ff, key: 'nyxHorn', occluder: true });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 3.4, 3.8) });
    const m = (geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0); if (sx) o.scale.set(sx, sy, sz); g.add(o); return o; };
    m(new THREE.SphereGeometry(1, 18, 12), this.headMat, 0, 0.1, 1.2, 0, 0, 0, 1.55, 1.15, 2.3);
    m(new THREE.ConeGeometry(0.95, 2.8, 10), this.headMat, 0, -0.05, 3.7, Math.PI / 2, 0, 0, 1, 1, 0.62);
    m(new THREE.BoxGeometry(1.6, 0.35, 2.6), this.headMat, 0, -0.75, 2.6, 0.18, 0, 0);
    for (const s of [1, -1]) {
      m(new THREE.ConeGeometry(0.32, 3.6, 6), this.hornMat, s * 0.95, 1.05, 0.3, -1.15, 0, s * -0.35);
      m(new THREE.ConeGeometry(0.2, 2.2, 6), this.hornMat, s * 1.25, 0.4, -0.2, -1.4, 0, s * -0.9);
      m(new THREE.SphereGeometry(0.3, 10, 8), this.eyeMat, s * 1.08, 0.42, 2.35, 0, 0, 0, 1, 0.65, 1.2);
    }
    for (let i = 0; i < 5; i++) m(new THREE.ConeGeometry(0.12, 1.4 - i * 0.18, 5), this.hornMat, 0, 1.15 - i * 0.05, 1.6 - i * 0.65, -1.0, 0, 0);
    mergeStaticMeshes(g, new Set());
  }
  /** radius profile along the body (i = 0 head … N-1 tail tip) */
  prof(i) {
    const s = i / (this.N - 1);
    if (s < 0.035) return 1.75;
    return 2.35 * (1 - Math.pow(s, 1.7) * 0.86) * (0.92 + 0.08 * Math.sin(s * 40));
  }
  setMode(m, rate) { this.mode = m; this.rate = rate || 1.2; if (m === 'rim' || m === 'crush') this.f = 1.0; else if (m !== 'death') this.f = 0.5; }
  /** Coil Crush: band k (0..3, 45° steps) through the centre; side ±1 picks which half of the ring lifts across */
  startCrush(k, side, dur) { this.setMode('crush', 9); this.crush = { k, side, t: 0, dur, h: 2.6, done: false }; }
  // ------------------------------------------------------------ control-point targets per mode
  targets(dt) {
    const T = this.tgt, t = this.t;
    if (this.mode === 'orbit' || this.mode === 'descend' || this.mode === 'intro') {
      this.prec += dt * 0.12;
      const uMid = ((this.u0 + this.f * 0.5) % 1 + 1) % 1, dU = Math.min(uMid, 1 - uMid);
      let want = dU < 0.16 ? 1 : 0;
      if (this.mode === 'descend') want = 1;
      if (this.passForce >= 0) want = this.passForce;
      const was = this.pass;
      this.pass = damp(this.pass, want, 1.1, dt);
      if (was < 0.6 && this.pass >= 0.6 && this.onPass) this.onPass();
      const P = smooth01(this.pass);
      for (let k = 0; k < 8; k++) {
        const th = k / 8 * TAU;
        T[k].set(Math.sin(th) * 40, 21 + 9 * Math.sin(th + this.prec) + 4 * Math.sin(2 * th - this.prec * 1.3), -6 - Math.cos(th) * 36);
      }
      if (P > 0.001) {
        T[7].lerp(_v1.set(-25, 10.5 - this.lower, -13), P);
        T[0].lerp(_v1.set(0, 8.6 - this.lower, -9), P);
        T[1].lerp(_v1.set(25, 10.5 - this.lower, -13), P);
      }
    } else if (this.mode === 'rim' || this.mode === 'crush') {
      for (let k = 0; k < 8; k++) {
        const th = k / 8 * TAU;
        T[k].set(Math.sin(th) * 23.5, 2.6 + 0.9 * Math.sin(3 * th + t * 1.4), -Math.cos(th) * 23.5);
      }
      const c = this.crush;
      if (this.mode === 'crush' && c) {
        c.t += dt;
        const u = clamp01(c.t / c.dur);
        c.h = c.done ? lerp(1.1, 3.2, smooth01((c.t - c.dur) / 0.9)) : u < 0.6 ? lerp(2.6, 8.5, easeOutCubic(u / 0.6)) : lerp(8.5, 1.1, easeInCubic((u - 0.6) / 0.4));
        const A = T[c.k], B = T[(c.k + 4) % 8];
        const a = _v1.copy(A), b = _v2.copy(B);
        for (let j = 1; j <= 3; j++) {
          const kk = c.side > 0 ? (c.k + j) % 8 : (c.k + 4 + j) % 8;
          const from = c.side > 0 ? a : b, to = c.side > 0 ? b : a;
          T[kk].lerpVectors(from, to, j / 4); T[kk].y = c.h + Math.sin(j * 1.7 + t * 3) * 0.3;
        }
        if (c.done && c.t > c.dur + 1.4) { this.crush = null; this.setMode('rim', 2.2); }
      }
    } else if (this.mode === 'death') {
      for (let k = 0; k < 8; k++) {
        const th = k / 8 * TAU + t * 0.25;
        T[k].set(Math.sin(th) * (15 - this.deathRise * 4), 15 + 2.5 * Math.sin(2 * th + t) + this.deathRise * 24 + k * 0.3, -4 - Math.cos(th) * (15 - this.deathRise * 4));
      }
    }
  }
  /** sim step */
  update(dt) {
    this.t += dt;
    this.targets(dt);
    const k = 1 - Math.exp(-this.rate * dt);
    for (let i = 0; i < 8; i++) this.ctrl[i].lerp(this.tgt[i], k);
    this.u0 += this.speed * dt * (this.mode === 'rim' || this.mode === 'crush' ? 0.55 : this.mode === 'death' ? 0.7 : 1);
    this.pose();
  }
  /** evaluate the curve → instance matrices, shadows, moon occlusion */
  pose() {
    const N = this.N, cv = this.curve;
    cv.updateArcLengths();
    const cam = camera.position;
    let best = -1, bs = 0, occ = 0;
    const sideV = _v3, upV = _v4, P = _v5, Tg = _v6;
    for (let i = 0; i < N; i++) {
      let u = this.u0 + this.f * (1 - i / (N - 1)) * 0.999;
      u = ((u % 1) + 1) % 1;
      cv.getPointAt(u, P); cv.getTangentAt(u, Tg);
      sideV.crossVectors(UP, Tg); if (sideV.lengthSq() < 1e-4) sideV.set(1, 0, 0); sideV.normalize();
      upV.crossVectors(Tg, sideV).normalize();
      const und = Math.sin(i * 0.33 - this.t * 2.6) * 0.7 * (i / N + 0.2);
      P.addScaledVector(sideV, und);
      this.px[i * 3] = P.x; this.px[i * 3 + 1] = P.y; this.px[i * 3 + 2] = P.z;
      this.tx[i * 3] = Tg.x; this.tx[i * 3 + 1] = Tg.y; this.tx[i * 3 + 2] = Tg.z;
      // dissolve (death): segments shrink tail → head
      const dis = this.dissolve > 0 ? clamp01((this.dissolve * 1.15 - (1 - i / N)) * 6) : 0;
      const r = this.prof(i) * this.scaleK * (1 - dis);
      this.rad[i] = r;
      const len = 2.6 * (this.f / 0.5) * this.scaleK * (1 - dis);
      _m1.makeBasis(sideV, upV, Tg).scale(_v7.set(r, r * 0.9, Math.max(r, len * 0.75)));
      _m1.setPosition(P);
      this.segMesh.setMatrixAt(i, _m1);
      const fh = (i < 4 ? 2.4 : 1.6) * r * (1 - i / N * 0.4) * (this.f > 0.9 ? 0.55 : 1);
      _m1.makeBasis(sideV, upV, Tg).scale(_v7.set(1, fh, len * 1.15));
      _m1.setPosition(_v8.copy(P).addScaledVector(upV, r * 0.78));
      this.finMesh.setMatrixAt(i, _m1);
      if (i === 0) {
        this.head.matrix.makeBasis(sideV, upV, Tg).scale(_v7.setScalar(this.scaleK * (1 - dis))).setPosition(_v8.copy(P).addScaledVector(Tg, r * 0.5));
        this.head.matrixWorldNeedsUpdate = true;
        this.head.visible = this.scaleK * (1 - dis) > 0.02;
      }
      // shadow candidates: low segments over / near the arena
      const d = Math.hypot(P.x, P.z);
      if (r > 0.1 && d < 34) { const s = (1 - smooth01((P.y - 3) / 21)) / (1 + d / 12); if (s > bs) { bs = s; best = i; } }
      // moon occlusion as seen from the camera
      if ((i & 1) === 0 && r > 0.1) {
        _v8.set(P.x - cam.x, P.y - cam.y, P.z - cam.z); const dist = _v8.length();
        const c = _v8.dot(NER_MOON_DIR) / dist;
        if (c > 0.97) { const ang = Math.acos(Math.min(1, c)), sa = r / dist; occ = Math.max(occ, 1 - smooth01((ang - sa * 0.6) / (NER_MOON_SIZE + sa))); }
      }
    }
    this.segMesh.instanceMatrix.needsUpdate = true; this.finMesh.instanceMatrix.needsUpdate = true;
    this.moonOcc = occ;
    for (let j = 0; j < 8; j++) {
      const S = this.shadow[j];
      if (best < 0) { S.w = 0; continue; }
      const i = clamp(Math.round(best + (j - 3.5) * 4), 0, N - 1);
      const x = this.px[i * 3], y = this.px[i * 3 + 1], z = this.px[i * 3 + 2], r = this.rad[i];
      const d = Math.hypot(x, z);
      S.set(x, z, r * 1.5 + y * 0.07 + 0.4, r > 0.1 && d < 36 ? (1 - smooth01((y - 2) / 22)) * 0.85 : 0);
    }
    this.U.uDark.value = this.dark; this.U.uGlow.value = this.glow;
  }
  /** world position of segment i */
  segPos(i, out) { i = clamp(i | 0, 0, this.N - 1); return out.set(this.px[i * 3], this.px[i * 3 + 1], this.px[i * 3 + 2]); }
  dispose() {
    for (const m of [this.segMesh, this.finMesh]) { m.geometry.dispose(); m.dispose(); }
    this.segMat.dispose(); this.finMat.dispose(); this.headMat.dispose(); this.hornMat.dispose(); this.eyeMat.dispose();
    this.head.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}

// =============================================================================
//  THE SIREN MODEL (Nerith herself and her Reflections)
// =============================================================================
/** merge geometries keeping position/normal/uv + extra per-geometry constant attributes. extras: [{name, values:[v per geo]}] */
function nerMergeGeos(geos, extras) {
  let total = 0; const list = geos.map((g) => { const n = g.index ? g.toNonIndexed() : g; total += n.attributes.position.count; return n; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  const ex = (extras || []).map((e) => ({ name: e.name, arr: new Float32Array(total), values: e.values, fromUvX: e.fromUvX }));
  let o = 0;
  list.forEach((g, gi) => {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    for (const e of ex) for (let i = 0; i < n; i++) e.arr[o + i] = e.fromUvX ? g.attributes.uv.array[i * 2] : e.values[gi];
    o += n;
  });
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  for (const e of ex) mg.setAttribute(e.name, new THREE.BufferAttribute(e.arr, 1));
  mg.computeBoundingSphere();
  for (let i = 0; i < geos.length; i++) { geos[i].dispose(); if (list[i] !== geos[i]) list[i].dispose(); }
  return mg;
}

/**
 * Build a floating siren-oracle. o = {scale, ghost (Reflection Siren), reflection (true)}.
 * Returns {root, parts (PoseRig parts), mats, gown, hair, haloRing, haloOrbs, eye, refl:[{mesh, src}], column, arcane:[]}
 */
/** bioluminescent ribs and drips running down the gown (object space) */
function nerGownGlow(sh) {
  sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
    {
      float gAng = atan(vObjPos.z, vObjPos.x);
      float rib = smoothstep(0.93, 1.0, sin(gAng * 14.0 + sin(vObjPos.y * 3.0) * 0.7));
      float flow = fract(vObjPos.y * 0.7 + uTime * 0.45 + floor(gAng * 2.228) * 0.37);
      float drip = rib * smoothstep(0.0, 0.06, flow) * smoothstep(0.35, 0.06, flow);
      float hem = smoothstep(0.7, 0.0, vObjPos.y);
      float scales = smoothstep(0.42, 0.5, abs(fract(gAng * 4.456 + step(1.0, mod(floor(vObjPos.y * 5.0), 2.0)) * 0.5) - 0.5)) * step(1.6, vObjPos.y) * step(vObjPos.y, 2.6);
      totalEmissiveRadiance += vec3(0.1, 0.8, 1.0) * (rib * 0.10 + drip * 0.85 + hem * 0.25 * (rib + 0.3) + scales * 0.12) * (1.0 - uStone) * (1.0 - arcDis);
    }`);
}
function buildSirenModel(o) {
  o = o || {};
  const root = new THREE.Group();
  const arcane = [];
  const A = (m) => { arcane.push(m); return m; };
  const ghost = !!o.ghost;
  const mats = {
    body: A(makeArcane({ color: ghost ? 0x163a50 : 0x0a2034, roughness: 0.26, metalness: 0.45, emissive: new THREE.Color(0.0, 0.02, 0.035) }, { rim: 0.6, rimColor: NER_TEAL, crackColor: 0xaef8ff, crackScale: 2.6, dissolveColor: 0x9ff8ff, key: 'nerBody', onCompile: nerGownGlow })),
    pearl: A(makeArcane({ color: 0xb8d4de, roughness: 0.18, metalness: 0.7 }, { rim: 0.7, rimColor: 0xcff8ff, crackScale: 3.0, dissolveColor: 0x9ff8ff, key: 'nerPearl' })),
    dark: A(makeArcane({ color: 0x0a1520, roughness: 0.35, metalness: 0.55 }, { rim: 0.9, rimColor: NER_TEAL, crackScale: 3.0, dissolveColor: 0x9ff8ff, key: 'nerDark' })),
    shell: makeNerWaterMaterial({ color: 0x3fd8ff, intensity: ghost ? 0.2 : 0.13, scroll: 0.5 }),
    hair: makeNerWaterMaterial({ color: 0x46e0ff, intensity: 0.85, scroll: 1.3, hair: true }),
    column: makeNerWaterMaterial({ color: 0x4ad8ff, intensity: 0.5, scroll: -2.4 }),
    halo: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 2.0, 2.3) }),
    orb: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.5, 4.2) }),
    lid: new THREE.MeshBasicMaterial({ color: 0x050a10 }),
  };
  for (const k of ['body', 'pearl', 'dark', 'halo', 'orb', 'eye', 'lid']) mats[k].clippingPlanes = NER_CLIP;
  const piv = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const mesh = (parent, geo, mat, x, y, z, rx, ry, rz, shadow) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = shadow !== false && !mat.transparent; parent.add(m); return m; };

  const body = piv(root, 0, NER_FLOAT, 0);
  // ---- gown / torso: one lathe, scalloped flaring hem
  const prof = [[0.0, 0.02], [1.0, 0.0], [0.94, 0.24], [0.8, 0.68], [0.62, 1.12], [0.45, 1.52], [0.35, 1.84], [0.33, 2.02], [0.40, 2.24], [0.50, 2.46], [0.53, 2.6], [0.47, 2.76], [0.24, 2.9], [0.15, 2.98], [0.14, 3.1]];
  const latheG = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32);
  { const pa = latheG.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); if (y < 0.7) { const x = pa.getX(i), z = pa.getZ(i), a = Math.atan2(z, x); const k = 1 + (0.7 - y) * 0.14 * Math.sin(a * 7); pa.setX(i, x * k); pa.setZ(i, z * k); if (y < 0.05) pa.setY(i, y - 0.12 * (0.5 + 0.5 * Math.sin(a * 7))); } } latheG.computeVertexNormals(); }
  const gown = mesh(body, latheG, mats.body);
  const shellG = latheG.clone(); shellG.scale(1.07, 1.015, 1.07);
  const shell = mesh(body, shellG, mats.shell, 0, -0.02, 0); shell.renderOrder = 7;
  // pearl bands and a scaled corset
  mesh(body, new THREE.TorusGeometry(0.345, 0.035, 6, 28), mats.pearl, 0, 2.0, 0, Math.PI / 2, 0, 0);
  mesh(body, new THREE.TorusGeometry(0.5, 0.03, 6, 28), mats.pearl, 0, 2.55, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; mesh(body, new THREE.ConeGeometry(0.07, 0.42, 4), mats.dark, Math.sin(a) * 0.4, 2.2, Math.cos(a) * 0.4, 0, a, Math.PI); }
  // shoulder mantle of shell plates
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) mesh(body, new THREE.SphereGeometry(0.22 - i * 0.03, 10, 6, 0, TAU, 0, Math.PI / 2), mats.pearl, s * (0.36 + i * 0.12), 2.82 - i * 0.07, -0.02, 0.2, 0, s * (-0.5 - i * 0.25));
  // water column: from the hem down into the pool
  const colG = new THREE.CylinderGeometry(0.72, 1.1, NER_FLOAT + 0.05, 24, 1, true); colG.translate(0, (NER_FLOAT + 0.05) / 2 - 0.05, 0);
  const column = mesh(root, colG, mats.column, 0, 0, 0); column.renderOrder = 7;
  // ---- head
  const head = piv(body, 0, 3.06, 0);
  mesh(head, new THREE.SphereGeometry(0.27, 20, 14), mats.pearl, 0, 0.28, 0.02).scale.set(0.86, 1.1, 0.95);
  mesh(head, new THREE.SphereGeometry(0.2, 14, 10, 0, TAU, 0, Math.PI * 0.55), mats.dark, 0, 0.3, -0.06, -0.5, 0, 0).scale.set(1.25, 1.2, 1.25);   // hood-cap
  for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.42; mesh(head, new THREE.ConeGeometry(0.045, 0.62 - Math.abs(i - 2) * 0.1, 5), mats.pearl, Math.sin(a) * 0.22, 0.6 - Math.abs(i - 2) * 0.05, -0.08 + Math.cos(a) * 0.02, -0.35, 0, -a * 0.9); }  // coral crown
  const eye = mesh(head, new THREE.SphereGeometry(1, 16, 8), mats.eye, 0, 0.385, 0.232, 0, 0, 0, false); eye.scale.set(0.07, 0.004, 0.03);
  mesh(head, new THREE.BoxGeometry(0.15, 0.012, 0.02), mats.lid, 0, 0.385, 0.245, 0, 0, 0, false);
  // ---- choir halo: ring + 7 choir-lights
  const haloP = piv(head, 0, 0.32, -0.34);
  const haloRing = mesh(haloP, new THREE.TorusGeometry(0.95, 0.018, 6, 64), mats.halo, 0, 0, 0, 0, 0, 0, false);
  mesh(haloP, new THREE.TorusGeometry(0.72, 0.008, 4, 64), mats.halo, 0, 0, 0, 0, 0, 0, false);
  const haloOrbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.085, 1), mats.orb, 7);
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; haloOrbs.setMatrixAt(i, _m1.makeTranslation(Math.sin(a) * 0.95, Math.cos(a) * 0.95, 0)); haloOrbs.setColorAt(i, _c1.setRGB(1.5, 2.6, 2.8)); }
  haloOrbs.frustumCulled = false; haloP.add(haloOrbs);
  // ---- arms (shoulder → elbow → webbed hand)
  const arms = {};
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const sh = piv(body, s * 0.5, 2.72, 0); sh.rotation.z = s * 0.32;
    mesh(sh, new THREE.CylinderGeometry(0.075, 0.06, 0.95, 8), mats.body, 0, -0.475, 0);
    mesh(sh, new THREE.TorusGeometry(0.075, 0.018, 5, 14), mats.pearl, 0, -0.25, 0, Math.PI / 2, 0, 0);
    const el = piv(sh, 0, -0.95, 0); el.rotation.x = -0.35;
    mesh(el, new THREE.CylinderGeometry(0.06, 0.042, 0.85, 8), mats.body, 0, -0.425, 0);
    mesh(el, new THREE.TorusGeometry(0.058, 0.016, 5, 14), mats.pearl, 0, -0.7, 0, Math.PI / 2, 0, 0);
    mesh(el, new THREE.ConeGeometry(0.07, 0.36, 5), mats.pearl, 0, -1.02, 0, Math.PI, 0, 0);
    const fin = mesh(el, new THREE.PlaneGeometry(0.34, 0.55), mats.shell, s * 0.05, -0.62, -0.04, 0, s * 0.4, 0); fin.renderOrder = 7;
    arms[L] = { sh, el };
  }
  // ---- 12 ribbons of water hair, flowing from the back of the head (one merged mesh, vertex-shader flow)
  const tubes = [], ribs = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 11 - 0.5) * 2.5, sx = Math.sin(a), len = 2.2 + (i % 3) * 0.35 + Math.abs(sx) * 0.3;
    const r0 = new THREE.Vector3(sx * 0.2, 0.36 - Math.abs(sx) * 0.08, -0.1 - Math.cos(a) * 0.14);
    const pts = [r0,
      new THREE.Vector3(sx * 0.42, 0.2, -0.38),
      new THREE.Vector3(sx * 0.62, -len * 0.35, -0.62 - (i % 2) * 0.15),
      new THREE.Vector3(sx * 0.85, -len * 0.7, -0.78),
      new THREE.Vector3(sx * 1.05, -len, -0.72 + (i % 3) * 0.12)];
    tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.05 + (i % 2) * 0.015, 5, false)); ribs.push(i);
  }
  const hairG = nerMergeGeos(tubes, [{ name: 'aT', fromUvX: true }, { name: 'aRib', values: ribs }]);
  const hair = mesh(head, hairG, mats.hair, 0, 0, 0, 0, 0, 0, false); hair.renderOrder = 7; hair.frustumCulled = false;
  // ---- merge statics, keep the rig pivots
  const parts = { body, head, halo: haloP, shL: arms.L.sh, elL: arms.L.el, shR: arms.R.sh, elR: arms.R.el };
  const keep = new Set([gown, shell, column, eye, haloRing, haloOrbs, hair]);
  for (const k in parts) keep.add(parts[k]);
  mergeStaticMeshes(root, keep);
  // ---- mirrored reflection in the water (gown + hair), driven from the real meshes' world matrices
  const refl = [];
  if (o.reflection !== false) {
    const rm = makeNerReflMaterial(ghost ? 0x2aa8c8 : 0x2a9ab8, 0.55);
    const hm = makeNerWaterMaterial({ color: 0x3ac8ef, intensity: 0.35, scroll: 1.3, hair: true, refl: true });
    for (const [src, mat] of [[gown, rm], [hair, hm], [shell, rm]]) {
      const m = new THREE.Mesh(src.geometry, mat);
      m.matrixAutoUpdate = false; m.matrixWorldAutoUpdate = false; m.frustumCulled = false; m.renderOrder = 2;
      root.add(m); refl.push({ mesh: m, src });
    }
    mats.refl = rm; mats.hairRefl = hm;
  }
  return { root, parts, mats, gown, shell, hair, haloRing, haloOrbs, eye, refl, column, arcane, hairG };
}
/** update the mirrored reflection meshes (call each render frame after the rig moved) */
function nerSyncReflection(model) {
  for (const r of model.refl) {
    r.src.updateWorldMatrix(true, false);
    r.mesh.matrixWorld.multiplyMatrices(NER_MIRROR, r.src.matrixWorld);
  }
}

// =============================================================================
//  ARENA — the Sunken Cathedral
// =============================================================================
const NER_CURTAIN_FS = /* glsl */`
  uniform float uTime; uniform float uK; uniform vec3 uColor;
  varying vec2 vUv;
  ${GLSL_NOISE}
  void main(){
    float h = vUv.y, al = vUv.x;
    float n = vnoise(vec2(al * 18.0 - uTime * 3.0, h * 3.0)) * 0.5 + vnoise(vec2(al * 40.0 - uTime * 5.0, h * 9.0 + uTime)) * 0.5;
    float a = pow(1.0 - h, 2.2) * (0.45 + 0.7 * n) * smoothstep(1.0, 0.85, al) * smoothstep(0.0, 0.04, al);
    gl_FragColor = vec4(uColor * a * uK, 1.0);
  }`;
/** arcane material whose per-instance dissolve comes from an `aDis` instanced attribute (crumbling pillars) */
function makeNerInstArcane(params, opts) {
  return makeArcane(params, Object.assign({}, opts, {
    vertexHead: '\nattribute float aDis; varying float vDis;', vertexBody: '\nvDis = aDis;',
    onCompile: (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('uniform float uDissolve;', 'uniform float uDissolve; varying float vDis;').replace(/uDissolve(?![;CS])/g, 'max(uDissolve, vDis)');
    },
  }));
}
/** CPU mirror of the arcane occluder dither (06-materials ARC_OCC) at a world point: 0 = solid, ~1 = dithered away */
function nerOccK(x, y, z) {
  const cp = camera.position, op = GLOBAL_U.uOccP.value, near = GLOBAL_U.uOccNear.value;
  const ax = op.x - cp.x, ay = op.y - cp.y, az = op.z - cp.z, L = Math.max(Math.hypot(ax, ay, az), 1e-3);
  const dx = ax / L, dy = ay / L, dz = az / L, rx = x - cp.x, ry = y - cp.y, rz = z - cp.z;
  const ss = (a, b, v) => smooth01((v - a) / (b - a));
  let k = 1 - ss(near * 0.55, near, Math.hypot(rx, ry, rz));
  const tp = rx * dx + ry * dy + rz * dz;
  if (tp > 0 && tp < L - 0.4) {
    const dl = Math.hypot(rx - dx * tp, ry - dy * tp, rz - dz * tp);
    k = Math.max(k, (1 - ss(1.3, 3.2, dl)) * 0.9, (1 - ss(3.5, 6.5, dl)) * (1 - ss(L * 0.6, L * 0.85, tp)) * 0.9);
  }
  return Math.min(1, k * 1.6);
}
function nerDisAttr(geo, n) { const a = new THREE.InstancedBufferAttribute(new Float32Array(n), 1); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aDis', a); return a; }

function buildCathedralArena(ctx) {
  const B = CONFIG.bosses[1], M = B.mech, R = B.arenaRadius;
  const group = new THREE.Group(); group.name = 'cathedral-arena';
  const add = (o) => { group.add(o); return o; };
  const rnd = mulberry32(4242), RR = (a, b) => a + (b - a) * rnd();
  const keepSet = new Set();
  const keep = (o) => { keepSet.add(o); return o; };

  // ---------------------------------------------------------------- shared uniforms
  const ripples = []; for (let i = 0; i < 16; i++) ripples.push(new THREE.Vector3(0, 0, -100));
  const pillarsU = []; for (let i = 0; i < 6; i++) pillarsU.push(new THREE.Vector4(0, 0, 1, 0));
  const shadowU = []; for (let i = 0; i < 8; i++) shadowU.push(new THREE.Vector4(0, 0, 1, 0));
  const spots = [new THREE.Vector4(-7, -3, 3.4, 0.55), new THREE.Vector4(1.5, 3, 3.0, 0.5), new THREE.Vector4(8, -6, 3.2, 0.5)];
  const FU = {
    uRipples: { value: ripples }, uFlow: { value: 0 }, uFlowS: { value: 0 }, uHymn: { value: 0 }, uHymnPulse: { value: 0 }, uEye: { value: new THREE.Vector2() },
    uPillars: { value: pillarsU }, uShadow: { value: shadowU }, uBoss: { value: new THREE.Vector4(0, -6, 0, 0) }, uMoonDir: { value: NER_MOON_DIR },
    uMoonSize: { value: NER_MOON_SIZE }, uMoonOcc: { value: 0 }, uRaySpots: { value: spots }, uGlow: { value: 1 },
    uWin: { value: new THREE.Vector4(NER_WIN.x, NER_WIN.y, NER_WIN.z, NER_WIN.r) }, uWinGlow: { value: 1 },
  };

  // ---------------------------------------------------------------- sky
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL_U.uRealTime, uStreak: GLOBAL_U.uStreak, uFocus: { value: new THREE.Vector3(0, 0, -1) }, uOctaves: GLOBAL_U.uOctaves,
      uMoonDir: { value: NER_MOON_DIR }, uMoonSize: { value: NER_MOON_SIZE }, uMoonOcc: FU.uMoonOcc, uNewMoon: { value: 0 }, uAurora: { value: 1 }, uDark: { value: 0 } },
    vertexShader: SKY_VS, fragmentShader: NER_SKY_FS, side: THREE.BackSide, depthWrite: false,
  });
  const sky = keep(add(new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), skyMat)));
  sky.renderOrder = -10; sky.frustumCulled = false; sky.matrixAutoUpdate = false;

  // ---------------------------------------------------------------- lights
  const hemi = add(new THREE.HemisphereLight(0x3a6aa0, 0x05080f, 0.45));
  const moon = add(new THREE.DirectionalLight(0xbfe4ff, 1.2));
  moon.position.copy(NER_MOON_DIR).multiplyScalar(60); moon.target.position.set(0, 0, 0); group.add(moon.target);
  moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.04;
  { const sc = moon.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 5; sc.far = 140; }
  const applyShadows = (tier) => { moon.castShadow = !!tier.shadows; };
  applyShadows(Quality.tier); Quality.onChange(applyShadows);
  const winLight = add(new THREE.DirectionalLight(0x3ac8d8, 0.4)); winLight.position.set(0, 14, -40);     // teal light through the rose window

  // ---------------------------------------------------------------- the water floor
  const floorMat = makeCathedralFloorMaterial(R, FU);
  const floor = keep(add(new THREE.Mesh(new THREE.CircleGeometry(80, 160), floorMat)));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.updateMatrix(); floor.matrixAutoUpdate = false; floor.renderOrder = -2;

  // ---------------------------------------------------------------- stone
  const stoneMat = makeArcane({ color: 0x2c3640, roughness: 0.82, metalness: 0.08 }, { rim: 0.35, rimColor: 0x46c8e0, crackColor: 0x5ff2ff, crackScale: 0.6, key: 'nerStone' });
  const darkStone = makeArcane({ color: 0x161d25, roughness: 0.9, metalness: 0.05 }, { rim: 0.25, rimColor: 0x3aa8c8, key: 'nerStoneDark' });
  // low balustrade ring at the arena edge (posts + rail), broken in places
  {
    const postG = new THREE.CylinderGeometry(0.14, 0.18, 0.75, 6); postG.translate(0, 0.37, 0);
    const posts = new THREE.InstancedMesh(postG, stoneMat, 72);
    let n = 0;
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * TAU, broken = rnd() < 0.18;
      posts.setMatrixAt(n++, _m1.compose(_v1.set(Math.sin(a) * (R + 1.05), 0, -Math.cos(a) * (R + 1.05)), _q1.setFromEuler(_e1.set(broken ? RR(-0.5, 0.5) : 0, 0, broken ? RR(-0.6, 0.6) : 0)), _v2.set(1, broken ? RR(0.3, 0.7) : 1, 1)));
    }
    add(posts);
    for (let s = 0; s < 6; s++) {      // rail segments (gaps between them)
      const a0 = s / 6 * TAU + 0.08, a1 = (s + 1) / 6 * TAU - 0.12;
      const rail = add(new THREE.Mesh(new THREE.TorusGeometry(R + 1.05, 0.13, 5, 40, a1 - a0), stoneMat));
      rail.rotation.set(Math.PI / 2, 0, a0 - Math.PI / 2); rail.position.y = 0.78;
    }
  }
  // north façade: gothic gable with the rose window, buttresses and pinnacles
  {
    const sh = new THREE.Shape();
    sh.moveTo(-15.5, -0.5); sh.lineTo(15.5, -0.5); sh.lineTo(15.5, 21); sh.lineTo(9, 27.5); sh.lineTo(0, 34); sh.lineTo(-9, 27.5); sh.lineTo(-15.5, 21); sh.lineTo(-15.5, -0.5);
    const hole = new THREE.Path(); hole.absarc(0, NER_WIN.y, NER_WIN.r + 0.05, 0, TAU, true); sh.holes.push(hole);
    const wg = new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 1, curveSegments: 64 });
    wg.translate(0, 0, -1.2);
    const wall = add(new THREE.Mesh(wg, darkStone)); wall.position.set(0, 0, -27.6); wall.castShadow = false;
    const frame = add(new THREE.Mesh(new THREE.TorusGeometry(NER_WIN.r + 0.1, 0.55, 8, 96), stoneMat)); frame.position.set(0, NER_WIN.y, -26.35);
    const frame2 = add(new THREE.Mesh(new THREE.TorusGeometry(NER_WIN.r + 1.1, 0.28, 6, 96), stoneMat)); frame2.position.set(0, NER_WIN.y, -26.3);
    for (const s of [1, -1]) {
      const bt = add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 25, 4.2), stoneMat)); bt.position.set(s * 16.6, 12, -26.5);
      const pn = add(new THREE.Mesh(new THREE.ConeGeometry(1.5, 6, 4), stoneMat)); pn.position.set(s * 16.6, 27.5, -26.5); pn.rotation.y = Math.PI / 4;
      // broken side walls stepping back toward the south-east / south-west
      for (let j = 0; j < 3; j++) {
        const h = 13 - j * 3 + RR(-1.5, 1.5);
        const w = add(new THREE.Mesh(new THREE.BoxGeometry(7.5, h, 1.6), darkStone));
        const ax = s * (21 + j * 5.2), az = -24.5 + j * 4.8;
        w.position.set(ax, h / 2 - 0.3, az); w.rotation.y = s * (0.62 + j * 0.12);
        const tp = add(new THREE.Mesh(new THREE.ConeGeometry(1.0, RR(2, 4), 4), stoneMat)); tp.position.set(ax + s * RR(-2, 2), h + 0.8, az); tp.rotation.set(RR(-0.2, 0.2), RR(0, 3), RR(-0.3, 0.3));
      }
    }
  }
  // rose window disc
  const winMat = new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uGlow: { value: 1.35 }, uEye: { value: 0 } }, vertexShader: BASIC_UV_VS, fragmentShader: NER_WINDOW_FS });
  const win = keep(add(new THREE.Mesh(new THREE.PlaneGeometry(NER_WIN.r * 2, NER_WIN.r * 2), winMat)));
  win.position.set(NER_WIN.x, NER_WIN.y, NER_WIN.z);
  // ruined colonnade around the rim (fluted shafts), fallen drums in the deep water
  const shaftG = new THREE.CylinderGeometry(1.0, 1.08, 1, 20, 6, false); shaftG.translate(0, 0.5, 0);
  { const pa = shaftG.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i), a = Math.atan2(z, x), k = 1 + 0.05 * Math.cos(a * 20); pa.setX(i, x * k); pa.setZ(i, z * k); } shaftG.computeVertexNormals(); }
  {
    const cols = new THREE.InstancedMesh(shaftG, stoneMat, 18);
    let n = 0;
    for (let i = 0; i < 18; i++) {
      const a = (55 + i / 17 * 250) * DEG, r = 25.5 + RR(-0.6, 1.6), h = RR(2.5, 12);
      cols.setMatrixAt(n++, _m1.compose(_v1.set(Math.sin(a) * r, -0.2, -Math.cos(a) * r), _q1.setFromEuler(_e1.set(RR(-0.05, 0.05), RR(0, 3), RR(-0.05, 0.05))), _v2.set(0.8, h, 0.8)));
    }
    add(cols);
    const drums = new THREE.InstancedMesh(shaftG, darkStone, 6);
    for (let i = 0; i < 6; i++) { const a = RR(0.9, 5.4), r = RR(23, 30); drums.setMatrixAt(i, _m1.compose(_v1.set(Math.sin(a) * r, 0.2, -Math.cos(a) * r), _q1.setFromEuler(_e1.set(Math.PI / 2, RR(0, 3), RR(-0.2, 0.2))), _v2.set(0.8, RR(2, 4), 0.8))); }
    add(drums);
  }

  // ---------------------------------------------------------------- 6 coral pillars (colliders, line-of-sight blockers, 2 gaze charges each)
  const P = M.pillars, NP = 6;
  const heights = [7.6, 5.3, 8.4, 6.0, 7.3, 4.9];
  const colliders = [], pillars = [];
  const pilMat = makeNerInstArcane({ color: 0x3a4652, roughness: 0.8, metalness: 0.08 }, { rim: 0.4, rimColor: 0x46c8e0, crackColor: 0x5ff2ff, crackScale: 1.2, dissolveColor: 0x9ff8ff, key: 'nerPillar', occluder: true });
  const coralMat = makeNerInstArcane({ color: 0xffffff, roughness: 0.65, metalness: 0.0, emissive: new THREE.Color(0.06, 0.01, 0.03) }, { rim: 0.6, rimColor: 0xff7ab8, dissolveColor: 0xffa0d0, key: 'nerCoral', occluder: true });
  const plinthG = new THREE.CylinderGeometry(1.45, 1.65, 0.55, 8); plinthG.translate(0, 0.275, 0);
  const capG = nerMergeGeos([new THREE.CylinderGeometry(1.38, 1.0, 0.75, 10).translate(0, 0.375, 0), new THREE.BoxGeometry(2.9, 0.4, 2.9).translate(0, 0.95, 0)]);
  const topG = new THREE.CylinderGeometry(1.02, 1.04, 0.9, 10, 2); topG.translate(0, 0.45, 0);
  { const pa = topG.attributes.position; for (let i = 0; i < pa.count; i++) if (pa.getY(i) > 0.8) pa.setY(i, pa.getY(i) + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.9 - 0.3); topG.computeVertexNormals(); }
  const pilShaftG = shaftG.clone();
  const coralG = nerMergeGeos([0, 1, 2, 3, 4].map((j) => { const c = new THREE.ConeGeometry(0.09 - j * 0.008, 0.9 - j * 0.1, 5); c.translate(0, 0.45 - j * 0.05, 0); c.rotateZ((j - 2) * 0.45); c.rotateY(j * 1.3); return c; }));
  const NC = 18;
  const dPl = nerDisAttr(plinthG, NP), dSh = nerDisAttr(pilShaftG, NP), dCap = nerDisAttr(capG, NP), dTop = nerDisAttr(topG, NP), dCo = nerDisAttr(coralG, NP * NC);
  const plinths = new THREE.InstancedMesh(plinthG, pilMat, NP), shafts = new THREE.InstancedMesh(pilShaftG, pilMat, NP), caps = new THREE.InstancedMesh(capG, pilMat, NP), tops = new THREE.InstancedMesh(topG, pilMat, NP);
  const corals = new THREE.InstancedMesh(coralG, coralMat, NP * NC);
  const polypMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const polyps = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.075, 0), polypMat, NP * 12);
  const runeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const runeG = new THREE.TorusGeometry(1.13, 0.05, 5, 48); runeG.rotateX(Math.PI / 2);
  const runes = new THREE.InstancedMesh(runeG, runeMat, NP * 2);
  const rubbleG = new THREE.DodecahedronGeometry(1, 0);
  const rubble = new THREE.InstancedMesh(rubbleG, stoneMat, NP * 8);
  const coralCols = [0xd8486a, 0xe8784a, 0xa04ad0, 0xf0a0c0, 0x40c0b0];
  for (let i = 0; i < NP; i++) {
    const a = (30 + 60 * i) * DEG, x = Math.sin(a) * P.ring, z = -Math.cos(a) * P.ring, h = heights[i], broken = h < 6.5;
    const shaftH = broken ? h - 0.55 : h - 0.55 - 1.15;
    _q1.setFromAxisAngle(UP, RR(0, TAU));
    plinths.setMatrixAt(i, _m1.compose(_v1.set(x, 0, z), _q1, NER_ONE));
    shafts.setMatrixAt(i, _m1.compose(_v1.set(x, 0.55, z), _q1, _v2.set(1, shaftH, 1)));
    caps.setMatrixAt(i, _m1.compose(_v1.set(x, 0.55 + shaftH, z), _q1, broken ? _v2.set(0, 0, 0) : NER_ONE));
    tops.setMatrixAt(i, _m1.compose(_v1.set(x, 0.55 + shaftH - 0.05, z), _q1, broken ? NER_ONE : _v2.set(0, 0, 0)));
    for (let j = 0; j < NC; j++) {
      const ca = RR(0, TAU), cy = Math.pow(rnd(), 1.6) * Math.min(h - 0.5, 4.6) + 0.15, cr = 1.0 + 0.08 * Math.cos(ca * 20);
      _v3.set(Math.sin(ca), RR(0.4, 1.6), Math.cos(ca)).normalize();
      _q2.setFromUnitVectors(UP, _v3);
      const s = RR(0.45, 1.05) * (cy < 1 ? 1.2 : 1);
      corals.setMatrixAt(i * NC + j, _m1.compose(_v1.set(x + Math.sin(ca) * cr * 0.95, cy, z + Math.cos(ca) * cr * 0.95), _q2, _v2.set(s, s, s)));
      corals.setColorAt(i * NC + j, _c1.set(coralCols[(rnd() * coralCols.length) | 0]).multiplyScalar(RR(0.55, 1.0)));
      if (j < 12) { const k = i * 12 + j; polyps.setMatrixAt(k, _m1.compose(_v2.set(x + Math.sin(ca) * (cr + 0.35 * s), cy + 0.55 * s, z + Math.cos(ca) * (cr + 0.35 * s)), _q2, _v4.setScalar(RR(0.6, 1.3)))); }
    }
    for (let j = 0; j < 2; j++) runes.setMatrixAt(i * 2 + j, _m1.compose(_v1.set(x, 2.0 + j * 0.65, z), _q1.identity(), NER_ONE));
    for (let j = 0; j < 8; j++) rubble.setMatrixAt(i * 8 + j, _m1.compose(_v1.set(x, 0, z), _q1.identity(), _v2.set(0, 0, 0)));
    const col = { x, z, r: P.r, enabled: true, pillar: i };
    colliders.push(col);
    pillars.push({ i, x, z, h, col, charges: P.charges, alive: true, dis: 0, disT: -1, polypHue: rnd() });
  }
  for (const im of [plinths, shafts, caps, tops]) { im.castShadow = true; im.receiveShadow = true; keep(add(im)); }
  keep(add(corals)); keep(add(polyps)); keep(add(runes)); keep(add(rubble));
  corals.instanceColor.needsUpdate = true;
  polyps.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NP * 12 * 3), 3); polyps.instanceColor.setUsage(THREE.DynamicDrawUsage);
  runes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NP * 2 * 3), 3); runes.instanceColor.setUsage(THREE.DynamicDrawUsage);
  // pillar reflections (shafts mirrored under the water)
  const pilRefl = new THREE.InstancedMesh(pilShaftG, makeNerReflMaterial(0x1e6a82, 0.4), NP);
  for (let i = 0; i < NP; i++) { const p = pillars[i]; pilRefl.setMatrixAt(i, _m1.compose(_v1.set(p.x, 0, p.z), _q1.identity(), _v2.set(1.0, -(p.h - 0.4), 1.0))); }
  pilRefl.frustumCulled = false; pilRefl.renderOrder = 2; keep(add(pilRefl));

  // ---------------------------------------------------------------- god rays from the rose window (High / Medium)
  const rayMat = new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uK: { value: 0.16 }, uColor: { value: new THREE.Color(0.45, 0.85, 0.95) } },
    vertexShader: NER_RAY_VS, fragmentShader: NER_RAY_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const rays = [];
  for (const s of spots) {
    const top = _v1.set(s.x * 0.35, NER_WIN.y + RR(-2, 2), NER_WIN.z + 0.5), bot = _v2.set(s.x, 0, s.y);
    const dir = _v3.subVectors(top, bot); const L = dir.length(); dir.normalize();
    const g = new THREE.CylinderGeometry(2.4, 3.6, L, 20, 1, true);
    const m = keep(add(new THREE.Mesh(g, rayMat)));
    m.position.copy(bot).addScaledVector(dir, L / 2); m.quaternion.setFromUnitVectors(UP, dir); m.renderOrder = 8;
    rays.push(m);
  }
  const applyRays = (tier) => { for (const m of rays) m.visible = !!tier.godrays; };
  applyRays(Quality.tier); Quality.onChange(applyRays);

  // ---------------------------------------------------------------- 300 rising bubbles + 300 bioluminescent motes (static Points, shader-animated)
  const mkPoints = (n, fill, vs, fs) => {
    const pos = new Float32Array(n * 3), ar = new Float32Array(n);
    for (let i = 0; i < n; i++) { fill(i, pos); ar[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aR', new THREE.BufferAttribute(ar, 1));
    const p = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uScale: Particles.mat.uniforms.uScale, uK: { value: 1 } }, vertexShader: vs, fragmentShader: fs,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.frustumCulled = false; return keep(add(p));
  };
  const bubbles = mkPoints(300, (i, a) => { const an = Math.random() * TAU, r = Math.sqrt(Math.random()) * 34; a[i * 3] = Math.sin(an) * r; a[i * 3 + 1] = 0; a[i * 3 + 2] = Math.cos(an) * r; },
    /* glsl */`attribute float aR; uniform float uTime; uniform float uScale; uniform float uK; varying float vA;
      void main(){ vec3 p = position; float sp = 0.5 + aR * 0.9; float y = mod(uTime * sp + aR * 17.0, 5.0);
        p.y = y - 0.05; p.x += sin(uTime * 3.0 + aR * 40.0) * 0.08 * y; p.z += cos(uTime * 2.6 + aR * 30.0) * 0.08 * y;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = min((0.05 + aR * 0.06) * uScale / -mv.z, 7.0); gl_Position = projectionMatrix * mv;
        vA = smoothstep(0.0, 0.3, y) * (1.0 - smoothstep(3.5, 5.0, y)) * uK; }`,
    /* glsl */`varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float ring = smoothstep(0.55, 0.85, d) * (1.0 - smoothstep(0.85, 1.0, d)); float hl = smoothstep(0.35, 0.0, length(gl_PointCoord - vec2(0.35))) ;
      gl_FragColor = vec4(vec3(0.5, 0.85, 1.0) * (ring * 0.7 + hl * 0.9) * vA, 1.0); }`);
  const motes = mkPoints(300, (i, a) => { const an = Math.random() * TAU, r = 3 + Math.random() * 30; a[i * 3] = Math.sin(an) * r; a[i * 3 + 1] = 0.4 + Math.random() * 9; a[i * 3 + 2] = Math.cos(an) * r - 3; },
    /* glsl */`attribute float aR; uniform float uTime; uniform float uScale; uniform float uK; varying float vA; varying float vR;
      void main(){ vec3 p = position; float t = uTime * (0.15 + aR * 0.2) + aR * 30.0;
        p.x += sin(t) * 1.6; p.z += cos(t * 0.8) * 1.6; p.y += sin(t * 1.7) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = min((0.06 + aR * 0.07) * uScale / -mv.z, 8.0); gl_Position = projectionMatrix * mv;
        vA = (0.5 + 0.5 * sin(uTime * (1.0 + aR * 3.0) + aR * 50.0)) * uK; vR = aR; }`,
    /* glsl */`varying float vA; varying float vR; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
      vec3 c = vR < 0.6 ? vec3(0.3, 1.6, 1.8) : vR < 0.85 ? vec3(0.4, 1.7, 0.9) : vec3(1.2, 0.6, 1.8);
      gl_FragColor = vec4(c * pow(1.0 - d, 2.0) * vA, 1.0); }`);

  // ---------------------------------------------------------------- pooled VFX meshes
  // whirlpool swirl decals
  const swirlG = new THREE.PlaneGeometry(1, 1); swirlG.rotateX(-Math.PI / 2);
  const swirls = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(swirlG, new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uA: { value: 0 }, uSeed: { value: i * 2.1 } }, vertexShader: BASIC_UV_VS, fragmentShader: NER_SWIRL_FS,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.visible = false; m.renderOrder = 3; m.position.y = 0.02; keep(add(m));
    swirls.push({ mesh: m, h: null, a: 0 });
  }
  // choir tower light columns
  const towerG = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true); towerG.translate(0, 0.5, 0);
  const towers = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(towerG, new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uK: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.72, 0.22) } },
      vertexShader: NER_RAY_VS, fragmentShader: NER_TOWER_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.visible = false; m.renderOrder = 8; keep(add(m));
    towers.push({ mesh: m, t: 0, dur: 1, r: 2.5, fade: 0 });
  }
  // moonbeams: floor beam + vertical curtain per beam, and a column of moonlight on Nerith
  const beamFloorG = new THREE.PlaneGeometry(1, 1); beamFloorG.rotateX(-Math.PI / 2); beamFloorG.translate(0, 0.06, 0.5);
  const curtainG = new THREE.BufferGeometry();
  { const v = [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1], uv = [0, 0, 0, 1, 1, 0, 1, 1]; curtainG.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); curtainG.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); curtainG.setIndex([0, 2, 1, 1, 2, 3]); curtainG.computeVertexNormals(); }
  const beams = [];
  for (let i = 0; i < 2; i++) {
    const grp = new THREE.Group(); grp.visible = false;
    const fm = makeBeamMaterial({ color: 0xbfe6ff, intensity: 0.55, len: 20, scroll: 2.5, soft: 0.08 });
    const f = new THREE.Mesh(beamFloorG, fm); grp.add(f);
    const cm = new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uK: { value: 0 }, uColor: { value: new THREE.Color(0.55, 0.8, 1.0) } }, vertexShader: BASIC_UV_VS, fragmentShader: NER_CURTAIN_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const c = new THREE.Mesh(curtainG, cm); grp.add(c);
    grp.renderOrder = 8; f.renderOrder = 8; c.renderOrder = 8;
    keep(add(grp)); keep(f); keep(c);
    beams.push({ grp, fm, cm, curtain: c, h: null, a: 0 });
  }
  const pillarLightG = new THREE.CylinderGeometry(0.9, 1.4, 1, 24, 1, true); pillarLightG.translate(0, 0.5, 0);
  const moonColMat = new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uK: { value: 0 }, uColor: { value: new THREE.Color(0.5, 0.75, 1.0) } },
    vertexShader: NER_RAY_VS, fragmentShader: NER_TOWER_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const moonCol = keep(add(new THREE.Mesh(pillarLightG, moonColMat))); moonCol.visible = false; moonCol.renderOrder = 8; moonCol.scale.set(1, 40, 1);
  // tidal lash: a racing wall of water
  const lashG = new THREE.BufferGeometry();
  {
    const n = 90, L = M.lash.len + 2, v = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) { const z = i / n * L; v.push(0, 0, z, 0, 1, z); uv.push(i / n, 0, i / n, 1); if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    lashG.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); lashG.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); lashG.setIndex(idx); lashG.computeVertexNormals();
  }
  const lashes = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(lashG, new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uFront: { value: -5 }, uAmp: { value: 2.6 }, uAlpha: { value: 1 } }, vertexShader: NER_LASH_VS, fragmentShader: NER_LASH_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.visible = false; m.frustumCulled = false; m.renderOrder = 8; keep(add(m));
    lashes.push({ mesh: m, t: 0, dur: 0.5, x: 0, z: 0, rot: 0 });
  }
  // the Abyssal Hymn flood surface
  const floodMat = new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uA: { value: 0 }, uMoonDir: { value: NER_MOON_DIR } }, vertexShader: NER_FLOOD_VS, fragmentShader: NER_FLOOD_FS,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const flood = keep(add(new THREE.Mesh(new THREE.CircleGeometry(80, 64), floodMat))); flood.rotation.x = -Math.PI / 2; flood.visible = false; flood.renderOrder = 9;
  // underwater lens overlay for the intro (child of the camera)
  const underMat = new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uRealTime, uA: { value: 0 } }, vertexShader: BASIC_UV_VS, fragmentShader: NER_UNDER_FS,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), underMat); under.visible = false; under.renderOrder = 999; under.frustumCulled = false; under.position.z = -0.3;
  camera.add(under);
  const surfMat = new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uRealTime, uA: { value: 0 } }, vertexShader: NER_FLOOD_VS, fragmentShader: NER_SURF_FS,
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const surf = keep(add(new THREE.Mesh(new THREE.CircleGeometry(90, 48), surfMat)));
  surf.rotation.x = -Math.PI / 2; surf.position.y = 0.01; surf.visible = false; surf.renderOrder = 998; surf.frustumCulled = false;

  // ---------------------------------------------------------------- Nyxara
  const serpent = new Nyxara(group);
  serpent.segMesh.traverse((o) => keepSet.add(o)); serpent.finMesh.traverse((o) => keepSet.add(o)); serpent.head.traverse((o) => keepSet.add(o));
  syncLightLayers(group);
  mergeStaticMeshes(group, keepSet);
  scene.add(group);

  // ---------------------------------------------------------------- arena API
  let ripI = 0, stepT = 0, lastDash = -1, wakeT = 0;
  const arena = {
    key: 'nerith', group, radius: R, colliders, spawn: B.playerSpawn, exposure: B.exposure, bloom: B.bloom, grade: B.grade,
    sky, skyMat, FU, serpent, pillars, floodMat,
    hymn: 0, hymnPulse: 0, flow: 0, flowS: 0, floodLevel: 0.0, floodOn: false, underwater: 0, winGlow: 1.35, aurora: 1, newMoon: 0, skyDark: 0, rayK: 0.16, bossGlow: 0.5,
    tw: {},
    tween(name, to, dur) { if (!dur) { this[name] = to; delete this.tw[name]; return; } this.tw[name] = { from: this[name], to, t: 0, dur }; },
    /** write a ripple ring into the floor's 16-entry ring buffer */
    ripple(x, z, delay) { const n = GLOBAL_U.uOctaves.value > 3.5 ? 16 : 8; ripI %= n; const r = ripples[ripI]; ripI = (ripI + 1) % n; r.set(x, z, Game.time + (delay || 0)); },   // Medium/Low: the shader reads 8 slots
    /** line of ripples (lash / coil impact) */
    rippleLine(x0, z0, x1, z1, n, dt) { for (let i = 0; i < n; i++) { const k = i / Math.max(1, n - 1); this.ripple(lerp(x0, x1, k), lerp(z0, z1, k), i * (dt || 0)); } },
    /** standing pillars as line-of-sight circles */
    losCircles() { return colliders; },
    /** is (x,z) hidden from the eye at (ex,ez) behind a standing pillar? */
    inShadow(ex, ez, x, z) { return !!BossKit.losBlocker(ex, ez, x, z, colliders); },
    /** a gaze hits pillar c: spend one charge (crumbles at 0) */
    spendCharge(c, fromX, fromZ) {
      const p = pillars[c.pillar]; if (!p || !p.alive) return;
      p.charges--;
      const yaw = yawTo(p.x, p.z, fromX, fromZ), hx = p.x + Math.sin(yaw) * 1.05, hz = p.z + Math.cos(yaw) * 1.05;
      Particles.burst(_v1.set(hx, 2.4, hz), 50, 0xe0c8ff, 0x7a3cff, 6, 0.7, 0.25, -6, { intensity: 2.2 });
      for (let i = 0; i < 3; i++) Rubble.spawn(hx, RR(1, 4), hz, Math.sin(yaw) * RR(2, 5), RR(1, 4), Math.cos(yaw) * RR(2, 5), { life: 1.6, scale: RR(0.25, 0.5), color: 0x9aa8b4 });
      sfx('tink', { f: 1800 }); sfx('boom');
      if (p.charges <= 0) this.crumble(p.i);
      else Hint.show('That pillar has 1 gaze charge left. It crumbles next time.', 3, 'nerPillarHint');
    },
    crumble(i, instant) {
      const p = pillars[i]; if (!p.alive) return;
      p.alive = false; p.col.enabled = false; p.charges = 0;
      if (instant) { p.dis = 1; p.disT = -1; }
      else {
        p.disT = 0;
        sfx('explode'); sfx('rumble', { dur: 1.4 }); CamRig.addTrauma(0.3);
        for (let k = 0; k < 16; k++) Rubble.spawn(p.x + RR(-1, 1), RR(0.5, p.h), p.z + RR(-1, 1), RR(-5, 5), RR(2, 7), RR(-5, 5), { life: 2.2, scale: RR(0.35, 0.9), color: 0x8a98a4 });
        Particles.burst(_v1.set(p.x, 2, p.z), 120, 0x9ab0c0, 0x223040, 5, 1.6, 0.9, -1, { spread: 1.2, up: 2, intensity: 0.7, drag: 1.2 });
        Particles.burst(_v1.set(p.x, 0.3, p.z), 80, 0xbff8ff, 0x2a8cff, 8, 0.9, 0.3, -9, { flat: true, intensity: 2.2 });
        GroundFX.ring(p.x, p.z, 1, 5, 0x9ff8ff, 0.6, 0.4, 2.2);
        this.ripple(p.x, p.z); this.ripple(p.x, p.z, 0.25);
        Banner.show('A PILLAR CRUMBLES', null, { dur: 1.1 });
      }
      for (let j = 0; j < 8; j++) { const a = j / 8 * TAU + RR(-0.3, 0.3), r = RR(0.6, 2.4), s = RR(0.35, 0.8); rubble.setMatrixAt(i * 8 + j, _m1.compose(_v1.set(p.x + Math.sin(a) * r, s * 0.25, p.z + Math.cos(a) * r), _q1.setFromEuler(_e1.set(RR(0, 3), RR(0, 3), RR(0, 3))), _v2.set(s, s * 0.6, s))); }
      rubble.instanceMatrix.needsUpdate = true;
      pilRefl.setMatrixAt(i, _m1.makeScale(0, 0, 0)); pilRefl.instanceMatrix.needsUpdate = true;
    },
    /** whirlpool decal follows a hazard until it dies */
    whirl(h) { let s = swirls.find((q) => !q.h); if (!s) s = swirls[0]; s.h = h; s.mesh.position.set(h.x, 0.02, h.z); s.mesh.scale.set(h.r * 2.3, 1, h.r * 2.3); s.mesh.visible = true; s.a = 0; },
    /** gold choir tower light (shown until `dur` seconds, then flashes out) */
    tower(x, z, r, dur) { let t = towers.find((q) => !q.mesh.visible); if (!t) t = towers[0]; t.mesh.position.set(x, 0, z); t.mesh.scale.set(r, 15, r); t.mesh.visible = true; t.t = 0; t.dur = dur; t.r = r; return t; },
    /** moonbeam visual i follows hazard h */
    beam(i, h) { const b = beams[i]; b.h = h; b.grp.visible = true; b.a = 0; },
    moonColumn(on, x, z) { this.moonColOn = on; if (on) { moonCol.position.set(x, 0, z); moonCol.visible = true; } },
    /** water wall racing along the lash line */
    lash(x, z, rot) { let l = lashes.find((q) => !q.mesh.visible); if (!l) l = lashes[0]; l.mesh.position.set(x, 0, z); l.mesh.rotation.set(0, rot, 0); l.mesh.visible = true; l.t = 0; return l; },
    setHymn(on, ex, ez) { if (on) FU.uEye.value.set(ex, ez); this.tween('hymn', on ? 1 : 0, on ? 0.5 : 0.6); },
    setFlow(v, dur) { this.tween('flow', v, dur || 0); },
    update(dt) {
      for (const k in this.tw) { const w = this.tw[k]; w.t += dt; const u = smooth01(w.t / w.dur); this[k] = lerp(w.from, w.to, u); if (w.t >= w.dur) { this[k] = w.to; delete this.tw[k]; } }
      serpent.update(dt);
      // floor uniforms
      this.flowS += dt * M.current * this.flow;
      FU.uFlow.value = this.flow; FU.uFlowS.value = this.flowS; FU.uHymn.value = this.hymn; FU.uHymnPulse.value = this.hymnPulse;
      FU.uMoonOcc.value = serpent.moonOcc; FU.uWinGlow.value = this.winGlow; winMat.uniforms.uGlow.value = this.winGlow;
      for (let j = 0; j < 8; j++) shadowU[j].copy(serpent.shadow[j]);
      for (let i = 0; i < NP; i++) { const p = pillars[i]; pillarsU[i].set(p.x, p.z, P.r, p.alive ? 1 : 0); }
      const b = Game.boss;
      if (b && b.pos) FU.uBoss.value.set(b.pos.x, b.pos.z, (b.alive && !b.submerged ? 1 : 0) * this.bossGlow, 0);
      skyMat.uniforms.uNewMoon.value = this.newMoon; skyMat.uniforms.uAurora.value = this.aurora; skyMat.uniforms.uDark.value = this.skyDark;
      camera.getWorldDirection(skyMat.uniforms.uFocus.value);
      moon.intensity = 1.2 * (1 - 0.55 * serpent.moonOcc) * (1 - this.skyDark * 0.5);
      rayMat.uniforms.uK.value = this.rayK * (1 - 0.6 * serpent.moonOcc);
      // pillars: dissolve, charges → rune glow, polyps
      let disDirty = false;
      for (let i = 0; i < NP; i++) {
        const p = pillars[i];
        if (p.disT >= 0) { p.disT += dt; p.dis = Math.min(1, p.disT / 1.3); if (p.dis >= 1) p.disT = -1; disDirty = true; }
        if (dPl.array[i] !== p.dis) { dPl.array[i] = dSh.array[i] = dCap.array[i] = dTop.array[i] = p.dis; for (let j = 0; j < NC; j++) dCo.array[i * NC + j] = p.dis; disDirty = true; }
        // the stone dithers out on the camera→player sightline / near the lens (occluder): the unlit rune rings and
        // polyps must fade with it, or they float in mid-air in front of the player
        const live = (1 - p.dis) * (1 - nerOccK(p.x, 2.3, p.z)), t = Game.time;
        for (let j = 0; j < 2; j++) {
          const on = p.charges > j ? 1 : 0.06, fl = 0.85 + 0.15 * Math.sin(t * 2.2 + i + j);
          _c1.setRGB(0.3 * on * fl, 1.1 * on * fl, 1.3 * on * fl);
          if (this.hymn > 0.01 && p.charges > j) _c1.lerp(_c2.setRGB(1.6, 0.9, 2.6), this.hymn * 0.7);
          runes.setColorAt(i * 2 + j, _c1.multiplyScalar(live));
        }
        for (let j = 0; j < 12; j++) { const k = 0.6 + 0.4 * Math.sin(t * (1.2 + (j % 4) * 0.4) + j * 1.7 + i); runes; polyps.instanceColor.setXYZ(i * 12 + j, (j % 3 === 0 ? 1.8 : 0.4) * k * live, (j % 3 === 0 ? 0.5 : 1.7) * k * live, (j % 3 === 0 ? 1.4 : 1.9) * k * live); }
      }
      runes.instanceColor.needsUpdate = true; polyps.instanceColor.needsUpdate = true;
      if (disDirty) { dPl.needsUpdate = dSh.needsUpdate = dCap.needsUpdate = dTop.needsUpdate = dCo.needsUpdate = true; }
      pilRefl.visible = camera.position.y > 0.05;
      // pooled VFX
      for (const s of swirls) {
        if (!s.h) continue;
        const alive = s.h.active && !s.h.dying;
        s.a = damp(s.a, alive ? 1 : 0, alive ? 2 : 5, dt);
        s.mesh.material.uniforms.uA.value = s.a;
        if (!alive && s.a < 0.02) { s.h = null; s.mesh.visible = false; }
        else if (alive && fxRand() < dt * 10) { const a = fxRange(0, TAU), r = fxRange(1, s.h.r); Particles.trailPoint(_v1.set(s.h.x + Math.sin(a) * r, 0.1, s.h.z + Math.cos(a) * r), 0x9ff8ff, 0x1a6a8a, 0.8, 0.14, { vx: Math.cos(a) * 2.2, vz: -Math.sin(a) * 2.2, vy: 0.2, intensity: 1.4 }); }
      }
      for (const t of towers) {
        if (!t.mesh.visible) continue;
        t.t += dt;
        const u = t.t / t.dur;
        t.mesh.material.uniforms.uK.value = u < 1 ? (0.35 + 0.65 * u) * Math.min(1, t.t / 0.3) : Math.max(0, 1 - (t.t - t.dur) / 0.45) * 2.0;
        if (u >= 1 && t.t > t.dur + 0.45) t.mesh.visible = false;
        else if (u < 1 && fxRand() < dt * 18) { const a = fxRange(0, TAU); Particles.trailPoint(_v1.set(t.mesh.position.x + Math.sin(a) * t.r, 0.2, t.mesh.position.z + Math.cos(a) * t.r), 0xffe0a0, 0xff9a20, 1.2, 0.16, { vy: 3.5, intensity: 1.8 }); }
      }
      for (let i = 0; i < 2; i++) {
        const bm = beams[i];
        if (!bm.h) continue;
        const alive = bm.h.active && !bm.h.dying;
        bm.a = damp(bm.a, alive ? 1 : 0, 8, dt);
        bm.grp.position.set(bm.h.x, 0, bm.h.z); bm.grp.rotation.set(0, bm.h.rot, 0);
        bm.grp.scale.set(1, 1, 1);
        bm.grp.children[0].scale.set(bm.h.width * 0.7, 1, bm.h.len);    // a moonlight core inside the red footprint
        bm.curtain.scale.set(1, 5.5, bm.h.len);
        bm.fm.uniforms.uAlpha.value = bm.a; bm.cm.uniforms.uK.value = bm.a * 0.32;
        if (!alive && bm.a < 0.02) { bm.h = null; bm.grp.visible = false; }
      }
      const mk = moonColMat.uniforms.uK;
      mk.value = damp(mk.value, this.moonColOn ? 0.55 : 0, 6, dt); if (!this.moonColOn && mk.value < 0.01) moonCol.visible = false;
      for (const l of lashes) {
        if (!l.mesh.visible) continue;
        l.t += dt;
        const u = l.t / l.dur, U2 = l.mesh.material.uniforms;
        U2.uFront.value = u * (M.lash.len + 6); U2.uAlpha.value = u < 0.8 ? 1 : Math.max(0, 1 - (u - 0.8) / 0.4);
        if (u < 1 && fxRand() < 0.9) { const s = U2.uFront.value; if (s < M.lash.len) Particles.cone(_v1.set(l.mesh.position.x + Math.sin(l.mesh.rotation.y) * s, 0.4, l.mesh.position.z + Math.cos(l.mesh.rotation.y) * s), UP, 0.5, 6, 0xdff8ff, 0x2a8cff, 7, 0.6, 0.22, -14, { intensity: 1.8 }); }
        if (u > 1.2) l.mesh.visible = false;
      }
      // flood (enrage)
      if (this.floodOn) { flood.visible = true; flood.position.y = this.floodLevel; floodMat.uniforms.uA.value = Math.min(1, this.floodLevel / 0.3); }
      else flood.visible = false;
      // underwater overlay sized to the frustum
      under.visible = this.underwater > 0.01;
      surf.visible = under.visible && camera.position.y < 0.01; surfMat.uniforms.uA.value = this.underwater;
      if (under.visible) { const h = 2 * 0.3 * Math.tan(camera.fov * DEG / 2) * 1.05; under.scale.set(h * camera.aspect, h, 1); underMat.uniforms.uA.value = this.underwater; }
      // footsteps / dashes / Nerith's wake → ripples
      const p = Game.player;
      if (p && p.alive && (Game.state === 'fight' || Game.state === 'transition')) {
        const moving = p.vel && (p.vel.x * p.vel.x + p.vel.z * p.vel.z) > 1;
        stepT -= dt;
        if (moving && stepT <= 0) { stepT = 0.25; this.ripple(p.pos.x, p.pos.z); if (fxRand() < 0.6) Particles.burst(_v1.set(p.pos.x, 0.08, p.pos.z), 5, 0xbff0ff, 0x3a8aa8, 2.2, 0.35, 0.09, -9, { up: 1.6, intensity: 1.2 }); }
        if (p.dashId !== lastDash) { if (lastDash >= 0 && p.dashing) { this.ripple(p.dashFrom.x, p.dashFrom.z); this.ripple(p.dashTo.x, p.dashTo.z, 0.15); Particles.burst(_v1.set(p.dashFrom.x, 0.1, p.dashFrom.z), 24, 0xdff8ff, 0x2a8cff, 5, 0.5, 0.16, -10, { up: 3, intensity: 1.6 }); } lastDash = p.dashId; }
      }
      if (b && b.alive && !b.submerged && Game.state !== 'title') { wakeT -= dt; if (wakeT <= 0) { wakeT = 0.75; this.ripple(b.pos.x, b.pos.z); } }
      // ambient glints of light falling through the window
      if (Quality.tier.godrays && fxRand() < dt * 6) { const s = spots[(fxRand() * 3) | 0]; Particles.trailPoint(_v1.set(s.x + fxRange(-2, 2), fxRange(1, 7), s.y + fxRange(-2, 2)), 0xbff8ff, 0x3ac8e0, 2.2, 0.08, { vy: -0.3, intensity: 1.4, drag: 0.5 }); }
    },
    dispose() {
      scene.remove(group);
      camera.remove(under); under.geometry.dispose(); underMat.dispose();
      for (const fn of [applyShadows, applyRays]) { const i = Quality.listeners.indexOf(fn); if (i >= 0) Quality.listeners.splice(i, 1); }
      serpent.dispose();
      group.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.dispose) c.material.dispose(); });
      for (const s of swirls) s.mesh.material.dispose();
    },
  };
  return arena;
}

// =============================================================================
//  NERITH — the boss
// =============================================================================
const NER_POSES = {
  idle: {},
  lash: { body: { r: [-0.1, 0.55, 0.05] }, shR: { r: [0.9, 0, -1.25] }, elR: { r: [0.25, 0, 0] }, shL: { r: [-0.3, 0, 0.35] }, head: { r: [0.1, 0.3, 0] } },
  lashStrike: { body: { r: [0.16, -0.55, -0.05] }, shR: { r: [-1.5, 0, -0.35] }, elR: { r: [0.3, 0, 0] }, shL: { r: [0.4, 0, 0.2] }, head: { r: [0.05, -0.2, 0] } },
  raise: { shL: { r: [0, 0, 1.9] }, shR: { r: [0, 0, -1.9] }, elL: { r: [0.3, 0, 0] }, elR: { r: [0.3, 0, 0] }, head: { r: [-0.35, 0, 0] }, body: { p: [0, 0.45, 0] } },
  hymn: { shL: { r: [-1.0, 0, 0.9] }, shR: { r: [-1.0, 0, -0.9] }, elL: { r: [-0.4, 0, 0] }, elR: { r: [-0.4, 0, 0] }, head: { r: [-0.18, 0, 0] }, body: { p: [0, 0.9, 0], r: [-0.08, 0, 0] } },
  dive: { body: { p: [0, -5.2, 0], r: [0.7, 0, 0] }, shL: { r: [-2.6, 0, 0.2] }, shR: { r: [-2.6, 0, -0.2] }, head: { r: [0.4, 0, 0] } },
  stunned: { body: { r: [0.38, 0, 0.12], p: [0, -0.6, 0] }, head: { r: [0.55, 0, 0.25] }, shL: { r: [0.2, 0, -0.15] }, shR: { r: [0.3, 0, 0.1] }, elL: { r: [0.3, 0, 0] }, elR: { r: [0.3, 0, 0] } },
  beam: { shL: { r: [-2.5, 0, 0.45] }, shR: { r: [-2.5, 0, -0.45] }, elL: { r: [0.2, 0, 0] }, elR: { r: [0.2, 0, 0] }, head: { r: [-0.55, 0, 0] }, body: { p: [0, 1.1, 0] } },
  sing: { shL: { r: [-0.55, 0, 0.75] }, shR: { r: [-0.55, 0, -0.75] }, elL: { r: [-0.7, 0, 0] }, elR: { r: [-0.7, 0, 0] }, head: { r: [-0.28, 0, 0] }, body: { p: [0, 0.3, 0] } },
};

class Nerith extends Boss {
  constructor(ctx, arena) {
    const B = CONFIG.bosses[1], M = B.mech, L = M.lash, T = M.towers, H = M.hymn;
    const up = (b) => !b.submerged;
    const noSoak = () => !Telegraphs.list.some((t) => t.active && !t.resolved && t.soak);
    const noHymn = (b) => !(b.cast && b.cast.name === 'Hymn of Stone');
    // fairness: a Tidal Lash never lands on a tower resolution, nor on a Petrified player
    const lashOk = (b) => !(Game.player && Game.player.hasStatus('petrified')) &&
      !Telegraphs.list.some((t) => t.active && !t.resolved && t.soak && Math.abs(t.remaining + t.delay - L.windup * Game.diff.windup) < 1.3);
    super({
      index: 1, x: B.spawn.x, z: B.spawn.z, walkRange: 6,
      phases: [
        { name: 'ECHOES', until: 0.65, abilities: [
          { id: 'lash', first: L.first, every: L.every, major: true, resolveIn: L.windup, when: lashOk },
          { id: 'towers', first: T.first, every: T.every, major: true, resolveIn: T.tA, when: noHymn },
          { id: 'hymn', first: H.first, every: H.every, major: true, resolveIn: H.cast, when: noSoak } ] },
        { name: 'REFLECTIONS', title: 'PHASE II', subtitle: 'REFLECTIONS', until: 0.30, abilities: [
          { id: 'undertow', first: M.undertow.first + 6, every: M.undertow.every, cast: false, when: up },
          { id: 'lash', first: 9, every: L.every, major: true, resolveIn: L.windup, when: (b) => up(b) && lashOk(b) },
          { id: 'towers', first: 15, every: T.everyP2, major: true, resolveIn: T.tA, when: (b) => up(b) && noHymn(b) },
          { id: 'hymn', first: 24, every: H.every, major: true, resolveIn: H.cast, when: (b) => up(b) && noSoak() } ],
          specials: [{ atPct: M.reflections.again, id: 'reflections' }] },
        { name: 'MAELSTROM', title: 'PHASE III', subtitle: 'MAELSTROM', until: 0, walk: false, wide: true, abilities: [
          { id: 'moonbeam', first: M.moonbeam.first, every: M.moonbeam.every, major: true, resolveIn: M.moonbeam.tell },
          // fairness: the coil never lands across a live tower soak or a moonbeam sweep (it is not a cast, so it would otherwise overlap them)
          { id: 'coil', first: M.coil.first, every: M.coil.every, cast: false, major: true, resolveIn: M.coil.windup, when: (b) => noSoak() && !b.arena.moonColOn },
          { id: 'towers', first: 22, every: T.everyP3, major: true, resolveIn: T.tA, when: () => !Telegraphs.list.some((t) => t.active && !t.resolved && t.source === 'Coil Crush') },
          { id: 'lash', first: 3, every: L.everyP3, major: true, resolveIn: L.windup, when: lashOk } ] },
      ],
    });
    this.arena = arena; this.serpent = arena.serpent; this.M = M;
    this.submerged = false; this.sirens = []; this.reflBusy = false; this.markT = 0; this.lockYaw = null; this.glide = null;
    this.tw = []; this.eyeOpen = 0; this.eyeTarget = 0; this.haloK = 1; this.subVis = 1; this.introT = -1; this.unfurl = 1;
    this.shardColor = 0xbff8ff; this.shardColor2 = 0x2bd9ff;
    this.eyeWorld = new THREE.Vector3(); this.handWorld = new THREE.Vector3();
    this.buildModel();
    this.light.color.set(NER_TEAL); this.light.distance = 14; this.light.decay = 1.4; this.light.intensity = 0;
  }

  // ------------------------------------------------------------ model
  buildModel() {
    const m = this.model = buildSirenModel({});
    m.root.scale.setScalar(1.22);
    this.group.add(m.root);
    for (const a of m.arcane) this.addArcane(a);
    this.rig = new PoseRig(m.parts, NER_POSES);
    this.rig.set('idle').snap();
    this.blob = makeBlobShadow(3.2); this.group.add(this.blob); this.blob.position.y = 0.016;
  }
  pose(name, speed) { this.rig.set(name, speed || 7); }
  get P() { return Game.player.pos; }
  /** sim-time tween on any object field (death beat / intro) */
  tween(obj, key, to, dur) {
    for (let i = this.tw.length - 1; i >= 0; i--) if (this.tw[i].obj === obj && this.tw[i].key === key) this.tw.splice(i, 1);
    if (!dur) { obj[key] = to; return; }
    this.tw.push({ obj, key, from: obj[key], to, t: 0, dur });
  }
  splash(x, z, power) {
    const k = power || 1;
    Particles.burst(_v1.set(x, 0.2, z), Math.round(60 * k), 0xdff8ff, 0x2a8cff, 7 * k, 0.9, 0.22, -12, { up: 6 * k, intensity: 1.8 });
    Particles.burst(_v1.set(x, 0.05, z), Math.round(40 * k), 0xbff8ff, 0x1a6a8a, 5 * k, 0.7, 0.3, -2, { flat: true, intensity: 1.4 });
    GroundFX.ring(x, z, 0.5, 3 + 3 * k, 0x9ff8ff, 0.6, 0.35, 2.2);
    this.arena.ripple(x, z); this.arena.ripple(x, z, 0.2);
    sfx('pool'); sfx('whoosh', { f: 300, f1: 1400, dur: 0.5, vol: 0.2 });
  }

  // ------------------------------------------------------------ TIDAL LASH: a 30 m line toward the player, a wall of water races along it
  ab_lash() {
    const L = this.M.lash, p = this.P;
    const rot = yawTo(this.pos.x, this.pos.z, p.x, p.z);
    this.yaw = rot; this.lockYaw = rot; this.faceLock = true;
    this.pose('lash', 6);
    const W = L.windup * this.windupMul, x = this.pos.x - Math.sin(rot) * 0.5, z = this.pos.z - Math.cos(rot) * 0.5;
    this.startCast('Tidal Lash', L.windup, { stingF: 220 });
    Telegraphs.spawn({ shape: 'rect', x, z, rot, len: L.len, width: L.width, windup: L.windup, color: 'red', dmg: L.dmg, source: 'Tidal Lash', major: true, flashK: 0.35,   // a 30 m strip: a full flash whites out the screen
      onResolve: () => {
        this.pose('lashStrike', 22); this.after(0.5, () => this.pose('idle', 4));
        const ar = this.arena; ar.lash(x, z, rot);
        ar.rippleLine(x, z, x + Math.sin(rot) * 20, z + Math.cos(rot) * 20, 7, 0.04);
        sfx('whoosh', { f: 250, f1: 2400, dur: 0.45, vol: 0.4 }); sfx('slam'); CamRig.addTrauma(0.22); Post.kickBloom(0.12, 0.25);
      } });
    return W + 0.6;
  }

  // ------------------------------------------------------------ CHOIR TOWERS: gold soaks A then B (Heroic: C). All soaked → HARMONIZED
  pillarClear(x, z, pad) {
    for (const c of this.arena.colliders) if (c.enabled !== false && dist2(x, z, c.x, c.z) < c.r + pad) return false;
    // never ask for a soak inside a live whirlpool (the soak would force 60/0.5 s ticks for its whole windup)
    for (const h of Hazards.list) if (h.active && !h.dying && h.source === 'Whirlpool' && dist2(x, z, h.x, h.z) < h.r + pad) return false;
    return true;
  }
  pickTowers(n) {
    const T = this.M.towers, R = this.arena.radius - T.r - 1.2, p = this.P, out = [];
    let A = null;
    for (let i = 0; i < 40 && !A; i++) {
      const a = rand() * TAU, r = randRange(3, R), x = Math.sin(a) * r, z = Math.cos(a) * r, d = dist2(x, z, p.x, p.z);
      if (d >= 3 && d <= 10 && this.pillarClear(x, z, T.r + 0.4) && dist2(x, z, this.pos.x, this.pos.z) > 3) A = { x, z };
    }
    if (!A) A = { x: clamp(p.x, -8, 8) + 3, z: clamp(p.z, -8, 8) };
    out.push(A);
    for (let k = 1; k < n; k++) {
      const prev = out[k - 1]; let Bp = null, sep = T.sep;
      for (let i = 0; i < 60 && !Bp; i++) {
        if (i && i % 15 === 0) sep -= 1.5;
        const a = rand() * TAU, x = prev.x + Math.sin(a) * sep, z = prev.z + Math.cos(a) * sep;
        if (Math.hypot(x, z) <= R && this.pillarClear(x, z, T.r + 0.4) && (k < 2 || dist2(x, z, out[0].x, out[0].z) > 8)) Bp = { x, z };
      }
      out.push(Bp || { x: -prev.x * 0.6, z: -prev.z * 0.6 });
    }
    return out;
  }
  ab_towers() {
    const T = this.M.towers, n = this.heroic ? 3 : 2, times = [T.tA, T.tB, T.tC];
    this.pose('raise', 5); this.after(1.1, () => this.pose('idle', 3));
    this.startCast('Choir Towers', 1.0, { stingF: 262 });
    Banner.show('CHOIR TOWERS', 'Stand in the gold: A, then B', { cls: 'gold' });
    if (!Save.seenHint('nerTowers')) Hint.show(HINTS['Choir Tower'], 5);
    sfx('bell', { f: 330 });
    const pts = this.pickTowers(n), st = this.towerSt = { n, soaked: 0, done: 0, ep: this.epoch };
    pts.forEach((pt, i) => {
      const W = times[i] * this.windupMul;
      this.arena.tower(pt.x, pt.z, T.r, W);
      Telegraphs.spawn({ shape: 'circle', x: pt.x, z: pt.z, r: T.r, windup: times[i], color: 'gold', soak: true, dmg: T.dmg, soakDmg: T.soakDmg, source: 'Choir Tower',
        major: i === 0, pips: n, pipsOn: i + 1, interior: 0.55, sfx: null,
        onResolve: (tg, inside) => {
          st.done++;
          sfx('bell', { f: 392 + i * 98 }); sfx('chime');
          Particles.burst(_v1.set(tg.x, 0.4, tg.z), 90, 0xfff0c0, 0xffa020, 7, 0.9, 0.22, -3, { up: 6, spread: T.r * 0.6, intensity: 2.0 });
          GroundFX.ring(tg.x, tg.z, 0.5, T.r + 2.5, 0xffd070, 0.5, 0.4, 2.2);
          PointLights.flash(_v1.set(tg.x, 2, tg.z), 0xffc845, 30, 0.35);
          this.arena.ripple(tg.x, tg.z);
          const pl = Game.player;
          if (inside && pl.alive) { st.soaked++; Particles.line(_v1.set(tg.x, 6, tg.z), this.hitPoint, 24, 0xfff0c0, 0xffa020, 0.45, 0.22, { intensity: 2.2 }); }
          else if (pl.alive && !pl.invuln) { pl.addStatus('drowning', T.drown); Game.stats.mechanicsFailed++; Banner.show('DROWNING', '-30% healing for 15 s', { cls: 'cyan', dur: 1.2 }); }
          if (st.done === st.n && st.soaked === st.n && this.alive && this.epoch === st.ep && !this.transitioning) this.harmonize();
        } });
    });
    return 1.3;
  }
  harmonize() {
    const T = this.M.towers;
    this.addStatus('harmonized', T.harmonized);
    this.cast = null; this.busyT = Math.max(this.busyT, T.harmonized);
    this.pose('stunned', 6); this.after(T.harmonized - 0.4, () => this.pose('idle', 3));
    Stamp.show('HARMONIZED', 'gold'); Banner.show('HARMONIZED', 'Nerith is stunned: +20% damage taken', { cls: 'gold', dur: 1.8 });
    sfx('bell', { f: 523 }); Post.kickBloom(0.25, 0.5); CamRig.addTrauma(0.15);
    Particles.burst(this.hitPoint, 140, 0xfff0c0, 0xffc845, 9, 1.0, 0.25, 0, { spread: 1.4, intensity: 2.0 });
    logEvent('harmonized', {});
  }

  // ------------------------------------------------------------ HYMN OF STONE: the forehead eye opens; break line of sight behind a pillar
  ab_hymn() {
    const H = this.M.hymn, ex = this.pos.x, ez = this.pos.z;
    this.pose('hymn', 4);
    Banner.show('HYMN OF STONE', 'Hide behind a pillar', { cls: 'violet' });
    if (!Save.seenHint('nerHymn')) Hint.show(HINTS['Hymn of Stone'], 5);
    this.arena.setHymn(true, ex, ez); this.eyeTarget = 1;
    sfx('bell', { f: 185 }); sfx('rumble', { dur: H.cast });
    this.startCast('Hymn of Stone', H.cast, { stingF: 185, onComplete: () => this.hymnResolve(ex, ez) });
    return H.cast * this.windupMul + 0.9;
  }
  hymnResolve(ex, ez) {
    const H = this.M.hymn, ar = this.arena, p = Game.player;
    const blk = BossKit.losBlocker(ex, ez, p.pos.x, p.pos.z, ar.colliders);
    const ey = this.eyeWorld.y || 4.5, yaw = yawTo(ex, ez, p.pos.x, p.pos.z);
    const len = blk ? Math.max(1, dist2(ex, ez, blk.x, blk.z) - blk.r) : dist2(ex, ez, p.pos.x, p.pos.z) + 1;
    Beams.flash(this.eyeWorld.x, ey - 1.5, this.eyeWorld.z, yaw, len, 0.9, 0xa070ff, 0.4);
    Post.kickBloom(0.2, 0.35); CamRig.addTrauma(0.25); sfx('explode');
    PointLights.flash(_v1.set(ex, 4, ez), 0xb266ff, 40, 0.4);
    if (blk) ar.spendCharge(blk, ex, ez);
    else if (p.alive && !p.invuln) {
      p.damage({ amount: H.dmg, source: 'Hymn of Stone', avoidable: true });
      if (p.alive) p.addStatus('petrified', H.petrify);
      Game.stats.mechanicsFailed++;
      Particles.burst(_v1.set(p.pos.x, 1.2, p.pos.z), 70, 0xd0c8c0, 0x6a6058, 4, 1.0, 0.3, -4, { intensity: 0.9 });
    }
    ar.setHymn(false); this.eyeTarget = 0;
    this.pose('sing', 8); this.after(0.7, () => this.pose('idle', 3));
  }

  // ------------------------------------------------------------ UNDERTOW MARK: 5 s ring on the player, then a 30 s whirlpool where they stand
  ab_undertow() {
    const U = this.M.undertow, p = Game.player;
    if (!p.alive) return 0;
    p.addStatus('undertow', U.mark);
    this.markT = U.mark;
    Banner.show('UNDERTOW MARK', 'Carry it to the edge', { cls: 'violet' });
    if (!Save.seenHint('nerUndertow')) Hint.show(HINTS['Whirlpool'], 5);
    sfx('whoosh', { f: 200, f1: 800, dur: 0.8, vol: 0.25 }); sfx('castSting', { f: 165 });
    Particles.line(this.hitPoint, _v2.set(p.pos.x, 1.2, p.pos.z), 30, 0xc8c0ff, 0x6a50ff, 0.4, 0.2, { intensity: 2 });
    return 0;
  }
  dropWhirlpool(x, z) {
    const U = this.M.undertow;
    const h = Hazards.spawn({ shape: 'circle', x, z, r: U.r, life: U.life, tickDmg: U.tick, tickInterval: U.tickEvery, pull: U.pull, color: 'violet', source: 'Whirlpool',
      firstTickDelay: 1.0, interior: 0.3, fadeIn: 0.5, gentle: true });   // first tick 1 s: room to walk out of a 4 m pool dropped at your feet without a dash
    if (h) this.arena.whirl(h);
    this.splash(x, z, 1.1); sfx('rumble', { dur: 1 }); CamRig.addTrauma(0.12);
  }

  // ------------------------------------------------------------ REFLECTIONS: Nerith dives; two Sirens rise and sing a Requiem. Lance the real one.
  sp_reflections() { this.forceNext = 'reflections'; }
  ab_reflections() {
    const R = this.M.reflections;
    if (this.submerged || !this.alive) return 0;
    this.submerged = true; this.invuln = true; this.targetable = false; this.cast = null; this.reflBusy = true;
    this.pose('dive', 3.5); this.eyeTarget = 0;
    Banner.show('REFLECTIONS', 'Lance the REAL Siren', { cls: 'violet', dur: 1.6 });
    if (!Save.seenHint('nerRefl')) Hint.show(HINTS['Requiem'], 6);
    sfx('bell', { f: 233 });
    this.after(0.35, () => this.splash(this.pos.x, this.pos.z, 1.4));
    this.after(R.rise, () => this.spawnSirens(), { keep: false });
    return R.rise + R.cast * this.windupMul + 2.5;
  }
  spawnSirens() {
    const R = this.M.reflections, p = this.P; let rad = R.sep / 2;
    // landscape: 16 m apart across the player's line to the centre. Portrait (narrow screen, the camera follows the
    // player): a tighter pair stacked in depth just north of the player, pulled inward until both stand in the arena
    let a, cx = 0, cz = -2;
    if (View.portrait) {
      rad = 5.5; a = (rand() < 0.5 ? 1 : -1) * randRange(0.3, 0.42); cx = p.x; cz = p.z - 7.5;
      for (let k = 0; k < 30; k++) {
        if (Math.hypot(cx + Math.sin(a) * rad, cz + Math.cos(a) * rad) < this.arena.radius - 3 && Math.hypot(cx - Math.sin(a) * rad, cz - Math.cos(a) * rad) < this.arena.radius - 3) break;
        cx *= 0.9; cz *= 0.9;
      }
    } else a = yawTo(0, 0, p.x, p.z) + Math.PI / 2 + randRange(-0.4, 0.4);
    const real = rand() < 0.5 ? 0 : 1;
    this.sirens = [];
    for (let i = 0; i < 2; i++) {
      const s = i ? -1 : 1, x = Math.sin(a) * rad * s + cx, z = Math.cos(a) * rad * s + cz, isReal = i === real;
      const pt = new BossPart(this, { name: 'SIREN', hp: 1, radius: 1.1, height: 5.6, x, z, targetable: false, lanceable: true, invuln: true });
      const mdl = buildSirenModel({ ghost: true, reflection: isReal });
      mdl.root.scale.setScalar(1.12);
      pt.group.add(mdl.root);
      for (const m of mdl.arcane) pt.addArcane(m);
      pt.model = mdl; pt.real = isReal; pt.dis = 0; pt.fading = false; pt.t = 0; pt.seed = rand() * 10;
      pt.rig = new PoseRig(mdl.parts, NER_POSES); pt.rig.set('dive').snap(); pt.rig.set('sing', 2.6);
      pt.yaw = pt.prevYaw = pt.visYaw = yawTo(x, z, p.x, p.z);
      pt.onLanceHit = () => this.sirenLanced(pt);
      pt.startCast('Requiem', R.cast, { interruptible: true, stingF: 233, onComplete: () => this.requiemDone(pt) });
      this.parts.push(pt); this.lanceTargets.push(pt); this.sirens.push(pt);
      this.splash(x, z, 1.2);
      if (isReal && this.story) Telegraphs.spawn({ shape: 'donut', x, z, r: 2.2, inner: 1.6, windup: R.cast, color: 'green', dmg: 0, source: 'Requiem', sfx: null, noFlash: true, interior: 0.2 });
    }
    this.pos.set(this.sirens[real].pos.x, 0, this.sirens[real].pos.z); this.prevPos.copy(this.pos);
  }
  sirenLanced(pt) {
    if (!pt.alive || pt.fading) return true;
    if (pt.real) {
      pt.cast = null;
      this.endReflections(pt, true);
      return 'interrupted';
    }
    pt.cast = null; pt.fading = true;
    const i = this.lanceTargets.indexOf(pt); if (i >= 0) this.lanceTargets.splice(i, 1);
    Banner.show('FALSE REFLECTION', 'She was never there', { cls: 'violet', dur: 1.2 });
    Particles.burst(pt.hitPoint, 120, 0xdff8ff, 0x2a8cff, 8, 0.9, 0.25, -2, { spread: 1.2, intensity: 2.0 });
    this.splash(pt.pos.x, pt.pos.z, 1);
    sfx('rendShatter');
    return true;
  }
  requiemDone(pt) {
    if (!pt.real || !this.reflBusy) return;
    const R = this.M.reflections, p = Game.player;
    Post.kickBloom(0.3, 0.5); CamRig.addTrauma(0.4); sfx('explode'); sfx('bell', { f: 117 });
    if (p.alive && !p.invuln) { p.damage({ amount: R.dmg, source: 'Requiem', avoidable: true }); if (p.alive) p.addStatus('drowning', R.drown); Game.stats.mechanicsFailed++; }
    Particles.line(pt.hitPoint, _v2.set(p.pos.x, 1.2, p.pos.z), 50, 0xdff8ff, 0x2a8cff, 0.5, 0.3, { intensity: 2.4 });
    this.splash(p.pos.x, p.pos.z, 1.3);
    this.endReflections(pt, false);
  }
  /** both reflections shatter; Nerith surfaces where the real one stood */
  endReflections(real, interrupted) {
    if (!this.reflBusy) return;
    this.reflBusy = false;
    for (const s of this.sirens) {
      s.cast = null;
      if (s.alive) { ShardFX.explode(s.hitPoint, 16, 7, s.real ? 0xbff8ff : 0x9fd8ff, { spread: 1, scale: 0.4 }); s.fading = true; }
    }
    this.lanceTargets.length = 0;
    const x = real.pos.x, z = real.pos.z;
    this.pos.set(x, 0, z); this.prevPos.copy(this.pos); this.vis.copy(this.pos);
    this.submerged = false; this.invuln = false; this.targetable = true;
    this.pose('dive'); this.rig.snap(); this.pose(interrupted ? 'stunned' : 'idle', 3);
    this.splash(x, z, 1.6);
    this.busyT = interrupted ? 3.0 : 1.2;
    if (interrupted) { this.addStatus('frozen', 0.6); this.after(2.6, () => this.pose('idle', 3)); }
    Timers.after(1.4, () => this.cleanupSirens(), { tag: 'nerSirens' });
  }
  cleanupSirens() {
    for (const s of this.sirens) { const i = this.parts.indexOf(s); if (i >= 0) this.parts.splice(i, 1); s.dispose(); }
    this.sirens = []; this.lanceTargets.length = 0;
  }
  /** abort reflections immediately (phase change, enrage, death) */
  abortReflections() {
    if (this.sirens.length) this.cleanupSirens();
    if (this.submerged || this.reflBusy) { this.reflBusy = false; this.submerged = false; if (this.alive && !this.transitioning) { this.invuln = false; this.targetable = true; } this.pose('idle', 4); }   // enrage mid-Reflections: she must be hittable again
  }

  // ------------------------------------------------------------ MOONBEAMS (P3): two rotating beams from Nerith
  ab_moonbeam() {
    const MB = this.M.moonbeam, x = this.pos.x, z = this.pos.z, p = this.P;
    const base = yawTo(x, z, p.x, p.z) + Math.PI / 2 + randRange(-0.5, 0.5), dir = rand() < 0.5 ? 1 : -1;
    const W = MB.tell * this.windupMul;
    this.pose('beam', 4); this.faceLock = true; this.lockYaw = this.yaw;
    Banner.show('MOONBEAMS', dir > 0 ? 'Sweeping counter-clockwise' : 'Sweeping clockwise', { cls: 'cyan' });
    if (!Save.seenHint('nerBeam')) Hint.show(HINTS['Moonbeam'], 5);
    this.startCast('Moonbeams', MB.tell, { stingF: 294 });
    this.arena.moonColumn(true, x, z); sfx('bell', { f: 294 });
    for (let i = 0; i < 2; i++) {
      const rot = base + i * Math.PI;
      Telegraphs.spawn({ shape: 'rect', x, z, rot, len: MB.len, width: MB.width, windup: MB.tell, color: 'red', dmg: 0, source: 'Moonbeam', major: i === 0, sfx: null, noFlash: true,
        onResolve: () => {
          const h = BossKit.rotatingRect({ x, z, rot, angVel: dir * MB.speed * DEG, len: MB.len, width: MB.width, life: MB.dur, tickDmg: MB.dmg, tickInterval: MB.tick, source: 'Moonbeam', color: 'red', gentle: false });
          if (h) this.arena.beam(i, h);      // the red hazard footprint stays visible under the moonlight (red = get out)
          if (i === 0) { sfx('ultRelease'); Post.kickBloom(0.2, 0.4); CamRig.addTrauma(0.2); }
        } });
    }
    this.after(W + MB.dur, () => { this.arena.moonColumn(false); this.pose('idle', 3); });
    return W + MB.dur + 0.4;
  }

  // ------------------------------------------------------------ COIL CRUSH (P3): Nyxara lifts a band of her coil across the arena and slams it down
  ab_coil() {
    const C = this.M.coil, p = this.P, R = this.arena.radius;
    let k = 0, best = 1e9;
    for (let j = 0; j < 4; j++) { const th = j * 45 * DEG, dx = Math.sin(th), dz = -Math.cos(th), d = Math.abs(p.x * dz - p.z * dx); if (d < best) { best = d; k = j; } }
    const th = k * 45 * DEG, ax = Math.sin(th) * (R + 1), az = -Math.cos(th) * (R + 1), rot = yawTo(ax, az, -ax, -az);
    const side = rand() < 0.5 ? 1 : -1, W = C.windup * this.windupMul;
    Banner.show('COIL CRUSH', 'Leave the shadow');
    if (!Save.seenHint('nerCoil')) Hint.show(HINTS['Coil Crush'], 4);
    sfx('rumble', { dur: W + 0.5 }); sfx('whoosh', { f: 120, f1: 600, dur: W, vol: 0.3 });
    this.serpent.startCrush(k, side, W);
    Telegraphs.spawn({ shape: 'rect', x: ax, z: az, rot, len: 2 * (R + 1), width: C.width, windup: C.windup, color: 'red', dmg: C.dmg, source: 'Coil Crush', major: true, sfx: null, flashK: 0.3,
      onResolve: () => {
        const s = this.serpent; if (s.crush) s.crush.done = true;
        CamRig.addTrauma(C.trauma); sfx('slam'); sfx('explode'); Post.kickBloom(0.2, 0.4);
        this.arena.rippleLine(ax, az, -ax, -az, 9, 0.03);
        for (let i = 0; i <= 6; i++) {
          const u = i / 6, x = lerp(ax, -ax, u) * 0.92, z = lerp(az, -az, u) * 0.92;
          Particles.burst(_v1.set(x, 0.3, z), 40, 0xdff8ff, 0x2a8cff, 9, 0.9, 0.3, -12, { up: 8, spread: 2, intensity: 1.8 });
        }
        GroundFX.ring(0, 0, 2, R, 0x9ff8ff, 0.4, 0.4, 1.6);
      } });
    return 0;
  }

  // ------------------------------------------------------------ transitions
  /** 65%: Nyxara descends low over the cathedral; Nerith dives into her own reflection */
  transition_1() {
    const P = this.pos, c0 = camera.position.clone(), l0 = CamRig.look.clone(), sp = this.serpent;
    const final = () => { sp.setMode('orbit', 1.2); sp.passForce = -1; sp.lower = 0; this.pose('dive', 4); };   // she stays under: Reflections follow at once
    return {
      dur: 4.6, ease: 'inOut', letterbox: true, skippable: true, blendOut: 0.8,
      pos: [c0, [P.x + 7, 2.2, P.z + 9], [9, 1.6, 8], [0, 5, 17]],
      tgt: [l0, [P.x, 3, P.z], [0, 9, -9], [0, 7, -22]],
      fov: [CONFIG.camera.fov, 52, 62, 58], roll: [0, -1.5, 2, 0],
      events: [
        { t: 0.1, fn: () => { sfx('rumble', { dur: 4 }); sp.setMode('descend', 1.4); sp.passForce = 1; sp.lower = 1.2; this.pose('raise', 5); } },
        { t: 1.0, fn: () => { this.pose('dive', 4); } },
        { t: 1.5, fn: () => { this.splash(P.x, P.z, 1.6); CamRig.addTrauma(0.2); } },
        { t: 2.2, fn: () => { sfx('whoosh', { f: 100, f1: 500, dur: 1.6, vol: 0.35 }); CamRig.addTrauma(0.3); Post.kickBloom(0.3, 0.8); } },
        { t: 3.0, fn: () => { PhaseTitle.show('PHASE II', 'REFLECTIONS'); sfx('bell', { f: 233 }); } },
        { t: 3.9, fn: () => { sp.passForce = -1; sp.lower = 0; } },
      ],
      onDone: () => final(),
    };
  }
  /** 30%: Nyxara coils around the rim; the water starts to turn */
  transition_2() {
    const c0 = camera.position.clone(), l0 = CamRig.look.clone(), sp = this.serpent, ar = this.arena;
    this.glide = { x: 0, z: -1 };
    const final = () => { sp.setMode('rim', 3); ar.setFlow(1, 0); this.pos.set(0, 0, -1); this.glide = null; this.pose('idle', 3); };
    return {
      dur: 4.4, ease: 'inOut', letterbox: true, skippable: true, blendOut: 0.8,
      pos: [c0, [6, 9, 22], [16, 12, 16], [0, 15, 24]],
      tgt: [l0, [0, 2, -6], [-4, 1, -6], [0, 0, -2]],
      fov: [CONFIG.camera.fov, 58, 62, 60], roll: [0, 1.5, -1.5, 0],
      events: [
        { t: 0.1, fn: () => { sfx('rumble', { dur: 4 }); sp.passForce = -1; sp.setMode('rim', 1.3); this.pose('beam', 3); } },
        { t: 1.9, fn: () => { CamRig.addTrauma(0.45); sfx('slam'); sfx('explode'); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ar.ripple(Math.sin(a) * 21, -Math.cos(a) * 21, i * 0.05); } } },
        { t: 2.3, fn: () => { ar.setFlow(1, 2.2); sfx('whoosh', { f: 150, f1: 700, dur: 2, vol: 0.3 }); } },
        { t: 2.8, fn: () => { PhaseTitle.show('PHASE III', 'MAELSTROM'); sfx('bell', { f: 147 }); Post.kickBloom(0.3, 0.6); this.pose('idle', 3); } },
      ],
      onDone: () => final(),
    };
  }
  onPhaseEnter(n, instant) {
    const sp = this.serpent, ar = this.arena;
    if (n === 1) {
      if (instant) { sp.setMode('orbit', 1.2); }
      this.forceNext = 'reflections';
    }
    if (n === 2) {
      this.forceNext = null;
      sp.setMode('rim', instant ? 3 : sp.rate);
      if (instant) { sp.targets(0); for (let k = 0; k < 8; k++) sp.ctrl[k].copy(sp.tgt[k]); sp.pose(); this.pos.set(0, 0, -1); this.prevPos.copy(this.pos); }
      ar.setFlow(1, instant ? 0 : 1.5);
      Post.setGrade({ lift: [0, 0.015, 0.04], gain: [0.9, 1.0, 1.12], gamma: [1, 1, 1], sat: 1.05 }, instant ? 0 : 1.5);
    }
  }
  onPhaseExit() {
    const p = Game.player;
    this.abortReflections();
    this.markT = 0; if (p) { p.clearMarkRing(); p.removeStatus('undertow'); }
    this.arena.moonColumn(false); this.arena.setHymn(false); this.eyeTarget = 0;
    this.faceLock = false; this.lockYaw = null;
    const s = this.serpent; if (s.crush) { s.crush = null; s.setMode('rim', 2); }
  }

  // ------------------------------------------------------------ enrage: ABYSSAL HYMN — the cathedral floods
  onEnrage() {
    Banner.show('ABYSSAL HYMN', 'The cathedral floods', { cls: 'violet', dur: 2.4 });
    logEvent('enrage', { name: 'Abyssal Hymn' });
    this.cast = null; Telegraphs.clearAll(); Timers.cancelTag('boss'); this.epoch++;
    this.onPhaseExit();
    this.pose('hymn', 3); this.eyeTarget = 1;
    sfx('rumble', { dur: 5 }); sfx('bell', { f: 92.5 }); CamRig.addTrauma(0.4);
    const ar = this.arena; ar.floodOn = true; ar.floodLevel = 0; this.enrageT = 0;
    ar.tween('winGlow', 2.2, 3); ar.tween('aurora', 2, 3);
  }
  updateEnrage(dt) {
    const A = this.M.abyssal, ar = this.arena, p = Game.player;
    this.enrageT = (this.enrageT || 0) + dt;
    ar.floodLevel = Math.min(A.level, A.level * this.enrageT / A.rise);
    if (fxRand() < dt * 25) { const a = fxRange(0, TAU), r = fxRange(2, ar.radius); Particles.burst(_v1.set(Math.sin(a) * r, ar.floodLevel, Math.cos(a) * r), 4, 0xdff8ff, 0x2a8cff, 2, 0.8, 0.12, 2, { up: 2, intensity: 1.4 }); }
    if (fxRand() < dt * 6) ar.ripple(fxRange(-15, 15), fxRange(-15, 15));
    if (ar.floodLevel > A.lethalAt && p && p.alive) p.damage({ amount: A.dps * dt, source: 'Abyssal Hymn', avoidable: false, tick: true, raw: true });
  }

  // ------------------------------------------------------------ death: the serpent's lights go out tail → head; the moon turns new
  onDeathStart() {
    this.abortReflections();
    this.onPhaseExit();
    const ar = this.arena; ar.setFlow(0, 2.5); ar.tween('floodLevel', 0, 2.5);
    this.eyeTarget = 0;
  }
  deathBeat() {
    const sp = this.serpent, ar = this.arena, cam = new THREE.Vector3(0, 2.2, 14);
    const moonAt = (k) => [cam.x + NER_MOON_DIR.x * 100 * k, cam.y + NER_MOON_DIR.y * 100 * k, cam.z + NER_MOON_DIR.z * 100 * k];
    let streamT = 0;
    const final = () => { sp.dark = 1; sp.dissolve = 1; ar.newMoon = 1; ar.tween('aurora', 0.25, 0); ar.tween('winGlow', 0.6, 0); ar.floodOn = false; this.tw.length = 0; this.streaming = false; };
    return {
      dur: 7.0, ease: 'inOut', letterbox: true, skippable: true, blendOut: 1.2,
      pos: [[3, 1.4, 12], [1.5, 2.0, 13], [0.5, 2.2, 14], [0, 2.4, 14.5]],
      tgt: [[0, 9, -8], moonAt(0.3), moonAt(0.6), moonAt(1)],
      fov: [58, 60, 56, 50], roll: [0, 1, -0.5, 0],
      events: [
        { t: 0.1, fn: () => { sp.passForce = -1; sp.crush = null; sp.setMode('death', 0.7); this.tween(sp, 'deathRise', 1, 6); sfx('bell', { f: 92.5 }); sfx('rumble', { dur: 4 }); } },
        { t: 0.6, fn: () => { this.tween(sp, 'dark', 1, 2.8); sfx('whoosh', { f: 90, f1: 400, dur: 2.5, vol: 0.3 }); } },
        { t: 3.0, fn: () => { this.tween(sp, 'dissolve', 1, 2.8); this.streaming = true; sfx('grandShatter'); } },
        { t: 3.6, fn: () => { ar.tween('newMoon', 1, 2.6); ar.tween('aurora', 0.25, 2.6); ar.tween('winGlow', 0.6, 2.6); sfx('bell', { f: 69.3 }); } },
        { t: 6.0, fn: () => { this.streaming = false; } },
      ],
      onDone: () => final(),
    };
  }

  // ------------------------------------------------------------ per-step
  onUpdate(dt) {
    const p = Game.player, ar = this.arena;
    for (let i = this.tw.length - 1; i >= 0; i--) { const w = this.tw[i]; w.t += dt; const u = smooth01(w.t / w.dur); w.obj[w.key] = lerp(w.from, w.to, u); if (w.t >= w.dur) { w.obj[w.key] = w.to; this.tw.splice(i, 1); } }
    if (this.lockYaw != null && this.faceLock) this.yaw = angDamp(this.yaw, this.lockYaw, 14, dt);
    if (this.free && this.faceLock && this.busyT <= 0) { this.faceLock = false; this.lockYaw = null; }
    if (this.glide) { const g = this.glide, dx = g.x - this.pos.x, dz = g.z - this.pos.z, d = Math.hypot(dx, dz); if (d < 0.05) this.glide = null; else { const s = Math.min(d, 5 * dt); this.pos.x += dx / d * s; this.pos.z += dz / d * s; } }
    // the Maelstrom current (P3): clockwise around the centre
    if (ar.flow > 0.01 && p && p.alive && Game.state === 'fight' && !p.dashing) {
      const r = Math.hypot(p.pos.x, p.pos.z);
      if (r > 0.3) { const k = this.M.current * ar.flow * Math.min(1, r / 3); p.addExtVel(-p.pos.z / r * k, p.pos.x / r * k); }
    }
    // Undertow Mark
    if (this.markT > 0 && p) {
      this.markT -= dt;
      const U = this.M.undertow;
      if (p.alive) p.setMarkRing(0x8a7dff, 1 - this.markT / U.mark);
      if (this.markT <= 0 || !p.alive) { this.markT = 0; p.clearMarkRing(); if (p.alive && Game.state === 'fight') this.dropWhirlpool(p.pos.x, p.pos.z); }
    }
    // the eye gathers violet light during the Hymn
    const c = this.cast;
    if (c && c.name === 'Hymn of Stone' && fxRand() < dt * 30) Particles.converge(this.eyeWorld, 3, 3.5 - 2 * (c.t / c.dur), 0xc8a0ff, 0x7a3cff, 0.4, 0.14, { intensity: 1.4 });
    if (this.hasStatus('harmonized') && fxRand() < dt * 25) Particles.trailPoint(_v1.set(this.pos.x + fxRange(-1, 1), fxRange(2, 6), this.pos.z + fxRange(-1, 1)), 0xfff0c0, 0xffc845, 0.8, 0.18, { vy: 2, intensity: 1.8 });
    // death: motes stream from the dissolving serpent to the moon
    if (this.streaming) {     // a river of moonlight: several motes per step, brightest from the segments dissolving right now
      const sp = this.serpent;
      for (let k = 0; k < 4; k++) {
        const i = k < 2 ? clamp(Math.round((1 - sp.dissolve * 1.15) * sp.N + fxRange(-4, 6)), 0, sp.N - 1) : (fxRand() * sp.N) | 0;
        sp.segPos(i, _v1); _v1.x += fxRange(-1, 1); _v1.y += fxRange(-1, 1); _v1.z += fxRange(-1, 1);
        const v = fxRange(16, 26);
        Particles.trailPoint(_v1, 0xeffcff, k < 2 ? 0x7ae8ff : 0x46d8ff, 2.6, k < 2 ? 0.55 : 0.32, { vx: NER_MOON_DIR.x * v, vy: NER_MOON_DIR.y * v, vz: NER_MOON_DIR.z * v, intensity: 2.6 });
      }
    }
    // sirens: drift, fade
    for (const s of this.sirens) {
      s.t += dt;
      if (s.alive && !s.fading && p) s.faceToward(p.pos.x, p.pos.z, dt, 2);
      if (s.fading) s.dis = Math.min(1, s.dis + dt / 0.9);
      if (s.real && s.cast && fxRand() < dt * 24) { s.model.hair.getWorldPosition(_v1); Particles.trailPoint(_v1.set(s.pos.x + fxRange(-0.7, 0.7), fxRange(2.5, 4.8), s.pos.z + fxRange(-0.7, 0.7)), 0xdff8ff, 0x2a8cff, 0.7, 0.1, { vy: -4, intensity: 1.8 }); }
    }
  }

  // ------------------------------------------------------------ visuals
  onSync(alpha, dt) {
    const t = Game.realTime, m = this.model, ar = this.arena;
    // floating bob + breathing, hair wave, halo spin
    this.rig.add('body', 0, 0, 0, 0, Math.sin(t * 1.3) * 0.14, 0);
    this.rig.add('head', Math.sin(t * 1.1 + 1) * 0.04, Math.sin(t * 0.6) * 0.08, 0);
    this.rig.add('shL', 0, 0, Math.sin(t * 1.3) * 0.05); this.rig.add('shR', 0, 0, -Math.sin(t * 1.3) * 0.05);
    this.rig.add('halo', 0, 0, t * 0.35);
    // eye
    this.eyeOpen = damp(this.eyeOpen, this.eyeTarget, 6, dt);
    m.eye.scale.y = 0.004 + 0.034 * this.eyeOpen;
    m.mats.eye.color.setRGB(2.6 + this.eyeOpen * 2, 1.5 + this.eyeOpen, 4.2 + this.eyeOpen * 2);
    m.eye.getWorldPosition(this.eyeWorld);
    // halo: teal, gold when Harmonized, violet in the Hymn, flaring with any cast
    const harm = this.hasStatus('harmonized'), hymn = this.eyeOpen;
    const cK = this.cast ? 0.4 + 0.6 * (this.cast.t / this.cast.dur) : 0;
    for (let i = 0; i < 7; i++) {
      const fl = 0.75 + 0.25 * Math.sin(t * 3 + i * 0.9);
      _c1.setRGB(1.2, 2.4, 2.7);
      if (harm) _c1.setRGB(3.0, 2.0, 0.6); else if (hymn > 0.05) _c1.lerp(_c2.setRGB(2.2, 1.0, 3.2), hymn);
      _c1.multiplyScalar(fl * (1 + cK) * (1 - this.dissolve));
      m.haloOrbs.setColorAt(i, _c1);
    }
    m.haloOrbs.instanceColor.needsUpdate = true;
    m.mats.halo.color.setRGB(0.9, 2.0, 2.3).multiplyScalar((0.7 + 0.5 * cK) * (1 - this.dissolve));
    if (harm) m.mats.halo.color.setRGB(2.2, 1.5, 0.4);
    // water materials fade with the dissolve; the column hides when she dives
    const live = 1 - this.dissolve;
    const below = this.rig.map.body.o.position.y < NER_FLOAT - 1.5;
    m.mats.shell.uniforms.uAlpha.value = live; m.mats.column.uniforms.uAlpha.value = live * (below ? 0 : 1);
    m.mats.hair.uniforms.uAlpha.value = live; m.mats.hair.uniforms.uWave.value = harm ? 0.3 : 1;
    m.mats.hair.uniforms.uUnfurl.value = this.unfurl; m.mats.hairRefl.uniforms.uUnfurl.value = this.unfurl;
    m.mats.refl.uniforms.uAlpha.value = 0.55 * live; m.mats.hairRefl.uniforms.uAlpha.value = live;
    this.blob.visible = this.alive && !this.submerged;
    nerSyncReflection(m);
    const above = camera.position.y > 0.05; for (const r of m.refl) r.mesh.visible = above && !this.submerged;
    // point light: teal glow at the head
    if (this.light) {
      m.parts.head.getWorldPosition(this.light.position); this.light.position.y += 0.4;
      this.light.position.x += Math.sin(this.visYaw) * 1.2; this.light.position.z += Math.cos(this.visYaw) * 1.2;
      this.light.color.set(harm ? 0xffc845 : hymn > 0.3 ? 0xb88aff : NER_TEAL);
      this.light.intensity = this.alive && !this.submerged ? 5 + 3 * cK + Math.sin(t * 2) * 0.5 : 0;
    }
    ar.bossGlow = this.alive && !this.submerged ? 0.5 + cK * 0.5 : 0;
    if (this.introOn) ar.underwater = clamp01((0.25 - camera.position.y) / 0.5);
    // sirens (reflections)
    for (const s of this.sirens) {
      const sm = s.model;
      s.rig.add('body', 0, 0, 0, 0, Math.sin(t * 1.4 + s.seed) * 0.12, 0);
      s.rig.add('halo', 0, 0, t * 0.35);
      s.rig.update(dt);
      const pr = s.cast ? s.cast.t / s.cast.dur : 0, sl = 1 - s.dis;
      for (const mm of s.arcane) mm.userData.arcane.uDissolve.value = s.dis;
      // tell #2: the real halo pulses steadily with her cast; the false one flickers out of time
      const pulse = s.real ? 0.65 + 0.35 * Math.sin((s.t / 0.9) * TAU) : (fxRand() < 0.3 ? 0.2 : 0.9) * (0.6 + 0.4 * Math.sin(t * 7.3 + s.seed));
      for (let i = 0; i < 7; i++) sm.haloOrbs.setColorAt(i, _c1.setRGB(1.2, 2.4, 2.7).multiplyScalar(pulse * (1 + pr) * sl));
      sm.haloOrbs.instanceColor.needsUpdate = true;
      sm.mats.halo.color.setRGB(0.9, 2.0, 2.3).multiplyScalar(pulse * sl);
      sm.mats.shell.uniforms.uAlpha.value = sl; sm.mats.hair.uniforms.uAlpha.value = sl; sm.mats.column.uniforms.uAlpha.value = sl * 0.8;
      if (sm.mats.refl) { sm.mats.refl.uniforms.uAlpha.value = 1.5 * sl; sm.mats.refl.uniforms.uFade.value = 6.5; sm.mats.hairRefl.uniforms.uAlpha.value = 1.8 * sl; }   // tell #1 must read at a glance (it was lost under the water column)
      sm.eye.scale.y = 0.004 + 0.02 * pr;
      nerSyncReflection(sm);
      s.group.visible = s.dis < 0.999;
    }
  }
  dispose() {
    Timers.cancelTag('nerSirens');
    const p = Game.player; if (p) p.clearMarkRing();
    this.sirens = [];
    super.dispose();
  }
}

// =============================================================================
//  REGISTRATION + INTRO
// =============================================================================
registerBoss({
  index: 1, key: 'nerith', music: 'nerith',
  buildArena: (ctx) => buildCathedralArena(ctx),
  createBoss: (ctx, arena) => new Nerith(ctx, arena),
  /** ~6 s: under the water looking up at the moon as Nyxara crosses it; break the surface, glide down the god rays; Nerith rises, hair unfurling */
  intro(ctx, boss, arena) {
    const sp = arena.serpent, B = boss.pos;
    const moonT = (x, y, z, k) => [x + NER_MOON_DIR.x * k, y + NER_MOON_DIR.y * k, z + NER_MOON_DIR.z * k];
    HUD.show(false);
    boss.pose('dive'); boss.rig.snap(); boss.unfurl = 0; boss.introOn = true;
    sp.setMode('intro', 2); sp.passForce = 1; sp.lower = -5; sp.u0 = 0.3;
    arena.underwater = 1;
    // the rail starts under the floor right beside the player's spawn: keep the Chronoblade out of the shot
    const pl = Game.player, showPlayer = () => { if (pl) { pl.root.visible = true; pl.blob.visible = true; } };
    if (pl) { pl.root.visible = false; pl.blob.visible = false; }
    return {
      dur: 6.2, ease: 'linear', letterbox: true, skippable: true, blendOut: 1.0,
      pos: [[0, -1.6, 13], [0.3, -1.2, 12], [0.4, 0.9, 10], [-3.5, 6.5, 6], [2.8, 2.4, 2.6], [3.4, 3.4, 6.0]],
      tgt: [moonT(0, -1.6, 13, 80), moonT(0.3, -1.2, 12, 70), [6, 18, -40], [-1, 7, -18], [B.x, 5.0, B.z], [B.x * 0.6, 4.4, B.z * 0.6 + 1]],
      fov: [62, 60, 58, 54, 46, 50], roll: [0, 2, -1.5, 1, -0.5, 0],
      events: [
        { t: 0.1, fn: () => { sfx('rumble', { dur: 3 }); sfx('whoosh', { f: 80, f1: 300, dur: 2.5, vol: 0.25 }); } },
        { t: 1.9, fn: () => { sfx('pool'); sfx('whoosh', { f: 600, f1: 2400, dur: 0.6, vol: 0.3 }); Particles.burst(_v1.set(0.4, 0.2, 10), 80, 0xdff8ff, 0x2a8cff, 6, 0.8, 0.12, -10, { up: 5, intensity: 1.6 }); } },
        { t: 2.9, fn: () => { boss.pose('idle', 1.6); boss.splash(B.x, B.z, 1.6); sfx('bell', { f: 185 }); boss.tween(boss, 'unfurl', 1.01, 2.0); } },
        { t: 3.6, fn: () => { sp.passForce = -1; sp.lower = 0; boss.pose('raise', 2.5); } },
        { t: 4.4, fn: () => { Banner.show('NERITH', 'The Drowned Choir', { cls: 'cyan', dur: 1.6 }); sfx('bell', { f: 277 }); boss.eyeTarget = 0.6; } },
        { t: 5.4, fn: () => { boss.pose('idle', 3); boss.eyeTarget = 0; } },
      ],
      onDone: (skipped) => { showPlayer(); boss.introOn = false; arena.underwater = 0; sp.setMode('orbit', 1.2); sp.passForce = -1; sp.lower = 0; boss.unfurl = 1.01; boss.tween(boss, 'unfurl', 1.01, 0); boss.eyeTarget = 0; boss.pose('idle'); if (skipped) boss.rig.snap(); },
    };
  },
});
