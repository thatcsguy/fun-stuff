// =============================================================================
//  §16  BOSS 3 — AUREN, THE UNWOUND HOUR  (spec §4.3)
//   Arena: a shattered clock face (r 20) — marble-glass tiles with SDF Roman
//   numerals, tick engravings and gold inlays, built as arc segments whose
//   vertex shader drops, tumbles and dissolves them into the singularity.
//   Sky: magenta/blue nebula + lensed starfield + THE SINGULARITY (shadow, photon
//   ring and lensed far-disk halo in the sky; a separate Doppler accretion disk;
//   FinalPass screen-space lensing on Medium/High). 24 broken gears, 400 void motes.
//   Hands: physical gold minute / hour hands sweeping the floor (rotating hazards).
//   Boss: Auren — inverted-fresnel crowned figure, cracked-mirror face, three
//   gyroscopic glyph rings. Mechanics: Numeral Sequence, Rewind, Your Shadow,
//   Fate Marks, Paradox Bell, Stopped Clock (4 Chrono Anchors in linked pairs),
//   Collapse (platform breaks, Entropy), Final Hour, Heat Death, new-star epilogue
//   and credits.
// =============================================================================

// ---------------------------------------------------------------- tuning (Normal) — lives in CONFIG (spec §0.9)
Object.assign(CONFIG.bosses[2], {
  spawn: { x: 0, z: 0 }, playerSpawn: { x: 0, z: 11 },
  mech: {
    minute: { width: 2.5, len: 20, degPerSec: 24, dmg: 250, knock: 3, lock: 0.5 },
    hour: { width: 4, len: 15, degPerSec: 8, dmg: 250, knock: 3, lock: 0.5 },
    numerals: { first: 8, every: 20, count: 3, countP2: 4, light: 0.6, pause: 1.0, gap: 1.0, fill: 1.0, dmg: 400, inner: 2, outline: { story: 0.6, normal: 0.35, heroic: 0 } },
    rewind: { first: 14, every: 28, cast: 3.0, ago: 5, dmg: 300 },
    shadow: { delay: 4, halfWidth: 0.6, life: 3, dmg: 150, lock: 0.5 },
    fate: { first: 10, every: 22, dur: 8, convergeR: 2, divergeR: 12, dmg: 600, stun: 1 },
    bell: { first: 19, every: 26, cast: 2.5, dmg: 500 },
    stoppedClock: { dur: 35, swap: 7.5, anchorR: 10, phasedMul: 0.1, storyDmg: 500 },
    collapse: { breaks: [[0.30, 14], [0.20, 10]], warn: 3, fallFrac: 0.30, fade: 1.0 },
    entropyEvery: 10,
    p3: { windupMul: 0.8, numeralsEvery: 18, fateEvery: 20 },
    finalHour: { at: 0.10, dur: 15, storyFrac: 0.5 },
    heatDeath: { lightsOut: 3, bleach: 1.4 },
  },
});
Object.assign(HINTS, {
  'Minute Hand': "Don't outrun the minute hand. Phase Step THROUGH it as it reaches you: a timed dash is a Perfect Dodge.",
  'Hour Hand': 'The hour hand is slow and wide. Walk ahead of it, or dash through.',
  'Numeral Sequence': 'Remember the order the numerals chime. The matching sectors explode in that order: stand in one that has already gone off.',
  'Rewind': 'Lance the violet REWIND cast, or keep the spot you stood on 5 seconds ago (the gold ghost) safe.',
  'Your Shadow': 'Your Shadow replays your path from 4 s ago. Keep moving, and never retrace your steps.',
  'Fate — Converge': 'CONVERGE: stand on your Echo when the mark ends (its circle is safe from your Shadow). Recall to it if you are far away.',
  'Fate — Diverge': 'DIVERGE: be more than 12 m from your Echo when the mark ends. Dash away early.',
  'Paradox Bell': 'The Bell punishes 5 held Fractures. Shatter before it tolls.',
  'Big Crunch': 'Kill the gold (vulnerable) pair of Anchors; the violet pair takes 10% damage. Zero Hour kills the gold pair outright.',
  'The Fall': 'When the rim glows red, move inside the inner ring before it falls.',
  'Final Hour': 'At 10% Auren is Overexposed (+50% damage taken). Save Zero Hour, Flux and Fractures for the last 15 seconds.',
  'Heat Death': 'The universe ends at 5:15. Spend Zero Hour on cooldown and keep Fractures stacked.',
});

const AUR_MAG = 0xff3bd4, AUR_GOLD = 0xffc845, AUR_VIOLET = 0xb266ff, AUR_RIM = 0xffb36b;
/** yaw of the clock numeral n (1..12): 12 = north (−Z), 3 = east (+X); clockwise = decreasing yaw */
const aurNumeralRot = (n) => Math.PI - n * Math.PI / 6;
const AUR_V = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const AUR_HIST = { x: 0, z: 0, hp: 0, t: 0, valid: false };
const AUR_BH = {
  // off-axis (upper left of the gameplay frame) so it never silhouettes Auren into a white blob
  dirP1: new THREE.Vector3(Math.sin(-15 * DEG) * Math.cos(-8.5 * DEG), Math.sin(-8.5 * DEG), -Math.cos(-15 * DEG) * Math.cos(-8.5 * DEG)).normalize(),
  dirP3: new THREE.Vector3(Math.sin(-21 * DEG) * Math.cos(-15 * DEG), Math.sin(-15 * DEG), -Math.cos(-21 * DEG) * Math.cos(-15 * DEG)).normalize(),
  sizeP1: 5 * DEG, sizeP3: 9.5 * DEG, dist: 300,
};

// =============================================================================
//  SHADERS
// =============================================================================
const AUR_SKY_FS = /* glsl */`
  uniform float uTime, uStreak, uOctaves, uBHSize, uCollapse, uDawn, uInhale, uDark, uWarm;
  uniform vec3 uFocus, uBH;
  varying vec3 vDir;
  ${GLSL_NOISE}
  float star(vec3 d, float scale, float thr){
    vec3 q = d * scale; vec3 id = floor(q); float h = hash13(id);
    if (h < thr) return 0.0;
    vec3 sp = hash33(id + 1.3);
    float r = length(fract(q) - sp);
    float tw = 0.65 + 0.35 * sin(uTime * (1.0 + h * 4.0) + h * 30.0);
    float alive = step(uDark * 1.05, hash13(id + 7.7));            // Heat Death: the stars go out one by one
    return smoothstep(0.09, 0.0, r) * tw * (h - thr) / (1.0 - thr) * alive;
  }
  void main(){
    vec3 d = normalize(vDir);
    int oct = int(uOctaves + 0.5);
    float hs = max(uBHSize * (1.0 - uCollapse), 1e-4);
    float ca = dot(d, uBH); float ang = acos(clamp(ca, -1.0, 1.0));
    vec3 side = normalize(d - uBH * ca + 1e-5);
    float bend = hs * hs * 1.7 / max(ang, hs * 0.9);
    vec3 db = normalize(cos(bend) * d - sin(bend) * side);
    // deep space + two-hue nebula (magenta / deep blue)
    vec3 col = mix(vec3(0.005, 0.003, 0.014), vec3(0.016, 0.010, 0.040), smoothstep(-0.5, 0.6, db.y));
    float n1 = fbm3(db * 2.0 + vec3(0.0, uTime * 0.004, 0.0), oct);
    float n2 = fbm3(db * 4.3 + vec3(n1 * 1.7, 3.1, -uTime * 0.006), oct);
    float neb = smoothstep(0.40, 0.86, n1 * 0.62 + n2 * 0.55);
    vec3 magenta = vec3(0.34, 0.03, 0.24), blue = vec3(0.03, 0.07, 0.30);
    col += mix(blue, magenta, smoothstep(0.30, 0.78, n2 + 0.25 * db.x)) * neb * 0.85;
    col += vec3(0.50, 0.10, 0.42) * pow(neb, 3.0) * 0.5;
    col *= 1.0 - 0.55 * smoothstep(0.55, 0.8, fbm3(db * 7.0 + 11.0, 2)) * neb;
    // scattered accretion light around the hole
    col += vec3(1.0, 0.5, 0.22) * exp(-ang / (hs * 2.0)) * 0.07 * (1.0 - uCollapse) * (1.0 + uWarm * 0.4);
    // stars (lensed: they arc around the hole), streaks for fly-ins / the inhale
    float s = star(db, 140.0, 0.965) + star(db, 300.0, 0.985) * 0.7 + star(db, 60.0, 0.992) * 1.6;
    if (uStreak > 0.01) for (int i = 1; i < 6; i++) { vec3 dd = normalize(db + (db - uFocus) * float(i) * 0.03 * uStreak); s += star(dd, 140.0, 0.965) * (1.0 - float(i) / 6.0) * uStreak; }
    if (uInhale > 0.01) for (int i = 1; i < 5; i++) { vec3 dd = normalize(db - (db - uBH) * float(i) * 0.05 * uInhale); s += star(dd, 140.0, 0.965) * (1.0 - float(i) / 5.0) * uInhale; }
    col += vec3(0.85, 0.9, 1.0) * s * 1.3 * (1.0 - uDawn * 0.8);
    // ---- the singularity: shadow, photon ring, lensed far side of the disk (top arc brighter)
    vec3 up0 = abs(uBH.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 bx = normalize(cross(up0, uBH)); vec3 by = cross(uBH, bx);
    vec2 p = vec2(dot(d, bx), dot(d, by)) / hs;
    float r = length(p);
    float live = (1.0 - uCollapse) * step(0.0, ca);
    float shadow = (1.0 - smoothstep(0.93, 1.0, r)) * live;
    float topw = 0.35 + 0.65 * smoothstep(-0.3, 0.8, p.y / max(r, 1e-3));
    float halo = smoothstep(1.02, 1.1, r) * (1.0 - smoothstep(1.22, 1.75, r)) * (0.55 + 0.6 * fbm(vec2(atan(p.y, p.x) * 3.0 - uTime * 0.5, r * 4.0), 2)) * topw;
    float ring = exp(-pow((r - 1.035) * 26.0, 2.0));
    vec3 hot = vec3(1.25, 0.62, 0.22);
    col = mix(col, vec3(0.0), shadow);
    col += (hot * halo * 0.4 + vec3(1.3, 1.05, 0.85) * ring * 0.65) * live;
    // ---- the new star (epilogue)
    if (uCollapse > 0.001) {
      float a2 = ang;
      col += uCollapse * (vec3(1.7, 1.45, 1.05) * exp(-a2 * a2 / 0.0006) * 2.6 + vec3(1.0, 0.7, 0.35) * exp(-a2 / 0.05) * 0.55 + vec3(0.6, 0.32, 0.16) * exp(-a2 / 0.28) * 0.3);
    }
    // ---- dawn time-lapse: the void warms into a sky
    if (uDawn > 0.001) {
      float hz = smoothstep(0.55, -0.15, d.y);
      vec3 sky = mix(vec3(0.05, 0.08, 0.24), vec3(0.78, 0.36, 0.22), hz) * 0.8 + vec3(1.0, 0.58, 0.28) * exp(-ang / 0.4) * 0.4;
      sky *= mix(0.55, 1.0, smoothstep(-0.6, 0.0, d.y));
      col = mix(col, sky + col * 0.25, uDawn * 0.85);
    }
    col *= 1.0 - uDark;
    gl_FragColor = vec4(col, 1.0);
  }`;

const AUR_DISK_VS = /* glsl */`
  varying vec3 vL; varying vec3 vW;
  void main(){ vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const AUR_DISK_FS = /* glsl */`
  uniform float uTime, uInt, uShadowAng, uDark; uniform vec3 uC, uN;
  varying vec3 vL; varying vec3 vW;
  ${GLSL_NOISE}
  void main(){
    vec3 f = vW - cameraPosition, c = uC - cameraPosition;
    float angTo = acos(clamp(dot(normalize(f), normalize(c)), -1.0, 1.0));
    if (length(f) > length(c) && angTo < uShadowAng * 0.985) discard;      // far half hides behind the shadow
    vec2 q = vL.xy; float r = length(q);
    float th = atan(q.y, q.x);
    float ph = th - uTime * 0.9 * pow(max(r, 0.5), -1.5);                // differential (Keplerian) rotation
    // anisotropic streaks: low angular, high radial frequency (seamless circle embedding)
    float n = fbm3(vec3(cos(ph) * 1.6, sin(ph) * 1.6, r * 6.5), 4);
    float n2 = vnoise3(vec3(cos(ph) * 5.0, sin(ph) * 5.0, r * 22.0));
    float bands = 0.45 + 0.75 * smoothstep(0.3, 0.75, n) + 0.25 * n2;
    float inner = smoothstep(1.42, 1.68, r), outer = 1.0 - smoothstep(2.2, 3.3, r);
    vec3 hot = mix(vec3(1.3, 1.1, 0.85), vec3(1.0, 0.42, 0.13), smoothstep(1.6, 2.4, r));
    hot = mix(hot, vec3(0.75, 0.16, 0.42), smoothstep(2.4, 3.2, r));
    vec3 vel = normalize(cross(uN, vW - uC));
    float D = clamp(1.0 + 0.6 * dot(vel, normalize(-f)), 0.2, 2.0);
    float boost = min(D * D * D * 0.11, 0.55);
    float a = inner * outer * bands;
    vec3 col = hot * a * boost * uInt * (1.0 - uDark);
    gl_FragColor = vec4(col, 1.0);
  }`;

const AUR_FLOOR_VS = /* glsl */`
  attribute vec3 aCenter; attribute vec3 aSeg; attribute float aTop;
  uniform float uFallT; uniform vec3 uFallDir;
  varying vec2 vRest; varying vec3 vWorld; varying vec3 vN; varying float vTop; varying float vFall; varying float vY;
  vec3 rotAxis(vec3 v, vec3 k, float a){ float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
  void main(){
    vec3 p = position; vec3 n = normal;
    float t = uFallT - aSeg.y; vFall = t;
    if (t > 0.0) {
      vec3 ax = normalize(vec3(aSeg.x - 0.5, 0.35, aSeg.z - 0.5));
      float a = t * (0.7 + aSeg.x * 1.8);
      p = rotAxis(p - aCenter, ax, a) + aCenter; n = rotAxis(n, ax, a);
      p.y -= 3.6 * t * t;
      p += uFallDir * (t * t * 3.0) + normalize(vec3(aCenter.x, 0.0, aCenter.z) + 1e-4) * t * 1.2;
    }
    vRest = position.xz; vTop = aTop; vY = position.y;
    vN = normalize(mat3(modelMatrix) * n);
    vec4 wp = modelMatrix * vec4(p, 1.0); vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const AUR_FLOOR_FS = /* glsl */`
  uniform float uTime, uOctaves, uWarm, uBroken, uDark, uDawn, uTimer, uTimerOn, uFallT;
  uniform float uSector[12], uSectorEdge[12], uSectorHit[12], uNumLit[12];
  uniform vec3 uBHDir, uKeyDir; uniform vec4 uHeart; uniform vec3 uTimerCol;
  varying vec2 vRest; varying vec3 vWorld; varying vec3 vN; varying float vTop; varying float vFall; varying float vY;
  ${GLSL_NOISE}
  float segD(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
  // Roman glyph strokes. code: 1 = I, 2 = V, 3 = X ; char box: width w, height 1 (centred)
  float glyphD(vec2 p, float code){
    if (code < 0.5) return 9.0;
    if (code < 1.5) return segD(p, vec2(0.0, -0.42), vec2(0.0, 0.42));
    if (code < 2.5) return min(segD(p, vec2(-0.24, 0.42), vec2(0.0, -0.42)), segD(p, vec2(0.24, 0.42), vec2(0.0, -0.42)));
    return min(segD(p, vec2(-0.24, 0.42), vec2(0.24, -0.42)), segD(p, vec2(0.24, 0.42), vec2(-0.24, -0.42)));
  }
  float cw(float code){ return code < 0.5 ? 0.0 : (code < 1.5 ? 0.26 : 0.6); }
  vec4 numeralCodes(int n){                      // clock-style (IIII)
    if (n == 1) return vec4(1, 0, 0, 0);  if (n == 2) return vec4(1, 1, 0, 0);  if (n == 3) return vec4(1, 1, 1, 0);
    if (n == 4) return vec4(1, 1, 1, 1);  if (n == 5) return vec4(2, 0, 0, 0);  if (n == 6) return vec4(2, 1, 0, 0);
    if (n == 7) return vec4(2, 1, 1, 0);  if (n == 8) return vec4(2, 1, 1, 1);  if (n == 9) return vec4(1, 3, 0, 0);
    if (n == 10) return vec4(3, 0, 0, 0); if (n == 11) return vec4(3, 1, 0, 0); return vec4(3, 1, 1, 0);
  }
  float numeralD(vec2 p, int n){
    vec4 c = numeralCodes(n);
    float W = cw(c.x) + cw(c.y) + cw(c.z) + cw(c.w);
    float x = -W * 0.5, d = 9.0;
    for (int i = 0; i < 4; i++) {
      float ci = c[i]; float w = cw(ci); if (w <= 0.0) break;
      d = min(d, glyphD(p - vec2(x + w * 0.5, 0.0), ci)); x += w;
    }
    d = min(d, segD(p, vec2(-W * 0.5 - 0.06, 0.5), vec2(W * 0.5 + 0.06, 0.5)));     // serif bars
    d = min(d, segD(p, vec2(-W * 0.5 - 0.06, -0.5), vec2(W * 0.5 + 0.06, -0.5)));
    return d;
  }
  void main(){
    int oct = int(uOctaves + 0.5);
    vec2 p = vRest; float r = length(p);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 col;
    float fallGlow = 0.0;
    if (vFall > 0.0) {                          // falling tile: dissolve from its edges with a glowing rim
      float dn = vnoise(p * 1.6) * 0.65 + vnoise(p * 5.1) * 0.35;
      float th = clamp((vFall - 0.35) * 0.42, 0.0, 1.05);
      if (dn < th) discard;
      fallGlow = 1.0 - smoothstep(0.0, 0.08, dn - th);
    }
    if (vTop < 0.5) {
      // slab sides: dark glass with a hot rim at the top lip
      col = vec3(0.012, 0.009, 0.022) + vec3(0.9, 0.25, 0.8) * exp(vY * 6.0) * 0.35;
      col += vec3(1.0, 0.45, 0.85) * fallGlow * 3.5;
      col *= 1.0 - uDark;
      gl_FragColor = vec4(col, 1.0); return;
    }
    // ---- marble-glass base with FBM veins
    float w1 = fbm(p * 0.16 + 4.0, oct);
    float v1 = abs(fbm(p * 0.33 + w1 * 2.2, oct) * 2.0 - 1.0);
    float v2 = abs(fbm(p * 0.9 + 9.0 + w1, max(oct - 1, 1)) * 2.0 - 1.0);
    float veins = (1.0 - smoothstep(0.0, 0.05, v1)) * 0.8 + (1.0 - smoothstep(0.0, 0.03, v2)) * 0.3;
    vec3 base = mix(vec3(0.016, 0.013, 0.03), vec3(0.05, 0.04, 0.075), w1);
    base += vec3(0.30, 0.24, 0.42) * veins * 0.13;
    vec3 N = vec3(0.0, 1.0, 0.0);
    N.xz += (vec2(vnoise(p * 3.0), vnoise(p * 3.0 + 5.0)) - 0.5) * 0.04;
    N = normalize(N);
    // ---- glass reflection of the sky: nebula + the accretion disk to the north
    vec3 R = reflect(-V, N);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 env = mix(vec3(0.03, 0.05, 0.16), vec3(0.22, 0.04, 0.18), smoothstep(-0.6, 0.6, R.x + 0.3 * R.z));
    float toBH = max(dot(normalize(R + vec3(0.0, 0.0, 0.0)), uBHDir), 0.0);
    env += vec3(1.0, 0.55, 0.25) * pow(toBH, 30.0) * (0.9 + uWarm * 1.6);
    env += vec3(1.0, 0.62, 0.32) * pow(toBH, 6.0) * 0.18 * (1.0 + uWarm * 2.0);
    env = mix(env, vec3(1.0, 0.7, 0.45), uDawn * 0.5);
    col = base * (0.55 + 0.45 * max(dot(N, uKeyDir), 0.0)) + env * fres * 0.5;
    col += vec3(0.25, 0.10, 0.03) * uWarm * 0.12;
    // ---- gold inlays: rings, ticks, numeral plaques
    float aa = atan(p.x, p.y);                          // yaw of this point
    float k = (3.14159265 - aa) / 0.5235988;            // numeral coordinate (12 = north, clockwise)
    float kn = floor(k + 0.5);
    int idx = int(mod(kn, 12.0) + 0.5);
    float da = (k - kn) * 0.5235988;                     // angular offset from the numeral axis (rad)
    float gold = 0.0;
    gold += 1.0 - smoothstep(0.035, 0.07, abs(r - 2.45));
    gold += 1.0 - smoothstep(0.03, 0.06, abs(r - 6.0));
    gold += 1.0 - smoothstep(0.05, 0.09, abs(r - 10.0));
    gold += 1.0 - smoothstep(0.05, 0.09, abs(r - 14.0));
    gold += 1.0 - smoothstep(0.06, 0.11, abs(r - 19.75));
    gold += (1.0 - smoothstep(0.03, 0.05, abs(r - 18.35))) * 0.7;
    // minute ticks (60) and hour ticks (12)
    float km = (3.14159265 - aa) / 0.10471976; float mn = floor(km + 0.5);
    float dm = abs(km - mn) * 0.10471976 * r;
    float minuteTick = (1.0 - smoothstep(0.035, 0.06, dm)) * step(18.45, r) * step(r, 19.6);
    float hourTick = (1.0 - smoothstep(0.11, 0.15, abs(da) * r)) * step(17.75, r) * step(r, 19.6);
    gold += max(minuteTick, hourTick);
    // timer: lit minute ticks for the remaining fraction (Stopped Clock / Final Hour)
    float mIdx = mod(mn + 60.0, 60.0) / 60.0;
    float timerLit = uTimerOn * step(uTimer, mIdx + 0.0001) * max(minuteTick, hourTick);
    // numeral plaques (r 16.7): darker polished square with a gold frame and the Roman numeral
    vec2 cN = vec2(sin(3.14159265 - kn * 0.5235988), cos(3.14159265 - kn * 0.5235988));
    vec2 dd = p - cN * 16.7;
    vec2 lp = vec2(dd.x, -dd.y);
    vec2 q = abs(lp) - vec2(1.15, 0.85);
    float plaque = 1.0 - smoothstep(0.0, 0.03, max(q.x, q.y));
    float frame = (1.0 - smoothstep(0.03, 0.07, abs(max(q.x, q.y)))) ;
    float nd = numeralD(lp / 1.05, idx == 0 ? 12 : idx) * 1.05;
    float glyph = 1.0 - smoothstep(0.045, 0.085, nd);
    col = mix(col, col * 0.45 + vec3(0.02, 0.015, 0.035), plaque * 0.8);
    gold += frame * 0.9 + glyph * 1.1;
    // gold shading: brushed metal + fake matcap spec toward the key light and the disk
    vec3 H1 = normalize(uKeyDir + V), H2 = normalize(uBHDir * vec3(1.0, -1.0, 1.0) * -1.0 + V);
    float spec = pow(max(dot(N, H1), 0.0), 50.0) * 1.4 + pow(max(dot(N, normalize(V + vec3(0.0, 0.25, -1.0))), 0.0), 12.0) * 0.6;
    vec3 goldC = vec3(0.95, 0.66, 0.26) * (0.22 + 0.3 * fres + spec * 1.6) + vec3(1.0, 0.6, 0.25) * pow(toBH, 8.0) * 0.6 * (1.0 + uWarm);
    col = mix(col, goldC, clamp(gold, 0.0, 1.0));
    // ---- sector reveal (gold) / hit flash (red) / faint red outline (Normal / Story memory aid)
    float inSec = step(2.0, r) * step(r, 19.9);
    float sg = uSector[idx], sh = uSectorHit[idx], se = uSectorEdge[idx];
    float edgeDist = min(abs(abs(da) - 0.2618) * r, min(abs(r - 2.0), abs(r - 19.85)));
    float outline = (1.0 - smoothstep(0.05, 0.12, edgeDist)) * inSec;
    col += vec3(1.0, 0.72, 0.32) * sg * inSec * (0.22 + 0.9 * outline);
    col += vec3(1.0, 0.18, 0.05) * sh * inSec * (0.35 + 0.8 * outline);
    col += vec3(1.0, 0.16, 0.06) * se * outline * 0.9;
    // rung numeral glows magenta-gold
    float nl = uNumLit[idx];
    col += (vec3(1.0, 0.5, 0.95) * glyph * 2.4 + vec3(1.0, 0.65, 0.3) * frame * 1.2 + vec3(0.5, 0.12, 0.4) * plaque * 0.35) * nl;
    col += uTimerCol * timerLit * 1.1;
    // ---- broken clock (phase 3): glowing magenta fissures
    if (uBroken > 0.001) {
      vec4 vo = voronoi2(p * 0.32 + 3.0);
      float fis = (1.0 - smoothstep(0.0, 0.05, vo.y)) * step(3.0, r);
      col = mix(col, vec3(0.004, 0.0, 0.01), fis * uBroken * 0.6);
      col += vec3(1.0, 0.2, 0.75) * (1.0 - smoothstep(0.0, 0.018, vo.y)) * step(3.0, r) * uBroken * (0.3 + 0.2 * sin(uTime * 2.0 + vo.z * 3.0));
      col *= 1.0 - fis * 0.0;
    }
    // ---- heart light pooled on the floor
    vec2 hp = vWorld.xz - uHeart.xy;
    col += vec3(1.0, 0.23, 0.83) * uHeart.w * 0.035 / (1.0 + dot(hp, hp) * 0.15);
    // tile seams (the face is visibly segmented: it WILL break)
    float seam = 0.0;
    if (r > 10.02) { float ns = r < 14.0 ? 20.0 : 24.0; float sa = fract((aa + 3.14159265) / 6.2831853 * ns); seam = 1.0 - smoothstep(0.0, 0.02 * (20.0 / r), min(sa, 1.0 - sa)); }
    col *= 1.0 - seam * 0.6;
    col += vec3(1.0, 0.45, 0.85) * fallGlow * 3.0;
    col *= 1.0 - uDark;
    gl_FragColor = vec4(col, 1.0);
  }`;

const AUR_MOTE_VS = /* glsl */`
  attribute vec4 aP; attribute float aC;
  uniform float uTime, uInhale, uScale, uDark; uniform vec3 uSink;
  varying vec3 vCol; varying float vA;
  void main(){
    float life = fract(uTime * aP.w * (1.0 + uInhale * 3.0) + aP.z * 7.31);
    float rr = aP.x * (1.0 - life * 0.55);
    float a = aP.y + life * (3.5 + 2.0 * aP.w * 10.0) + uTime * 0.05;
    vec3 p = vec3(sin(a) * rr, mix(-10.0, 6.0, fract(aP.z * 3.1)) - life * 6.0, cos(a) * rr);
    p += uSink * life * life * (40.0 + uInhale * 80.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uScale * (0.6 + aP.w * 8.0) / -mv.z, 1.0, 9.0);
    vCol = aC < 0.33 ? vec3(0.75, 0.45, 1.0) : (aC < 0.66 ? vec3(1.0, 0.35, 0.85) : vec3(0.9, 0.9, 1.0));
    vA = sin(life * 3.14159) * (1.0 - uDark);
  }`;
const AUR_MOTE_FS = /* glsl */`
  varying vec3 vCol; varying float vA;
  void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vCol * a * a * vA * 1.6, 1.0); }`;

const AUR_CLOCK_FS = /* glsl */`
  uniform float uFrac, uOn, uTime; uniform vec3 uCol;
  varying vec2 vUv;
  void main(){
    vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
    if (r > 1.0) discard;
    float a = atan(p.x, p.y); float a01 = fract(a / 6.2831853 + 1.0);
    float rim = (1.0 - smoothstep(0.0, 0.025, abs(r - 0.95))) + (1.0 - smoothstep(0.0, 0.012, abs(r - 0.88))) * 0.6;
    float mt = fract(a01 * 60.0 + 0.5) - 0.5, ht = fract(a01 * 12.0 + 0.5) - 0.5;
    float ticks = (1.0 - smoothstep(0.08, 0.16, abs(mt))) * step(0.83, r) * step(r, 0.9) * 0.6 + (1.0 - smoothstep(0.03, 0.06, abs(ht))) * step(0.74, r) * step(r, 0.91);
    float lit = step(uFrac, a01);                                  // remaining time (clockwise from the hand back to 12)
    float fill = lit * step(r, 0.72) * (0.18 + 0.12 * sin(r * 40.0 - uTime * 6.0));
    float handA = uFrac * 6.2831853;
    vec2 hd = vec2(sin(handA), cos(handA));
    float along = dot(p, hd), across = abs(p.x * hd.y - p.y * hd.x);
    float hand = (1.0 - smoothstep(0.012, 0.03, across)) * step(-0.08, along) * step(along, 0.86);
    float pivot = 1.0 - smoothstep(0.03, 0.06, r);
    float flick = 0.88 + 0.12 * sin(uTime * 37.0) * sin(uTime * 13.0);
    vec3 c = uCol * (rim * 1.4 + ticks * 1.2 * mix(0.35, 1.0, lit) + fill) + vec3(1.0, 0.95, 0.85) * (hand * 2.2 + pivot * 2.0);
    c += uCol * 0.06 * (1.0 - r);
    gl_FragColor = vec4(c * uOn * flick, 1.0);
  }`;

const AUR_MIRROR_FS = /* glsl */`
  uniform vec3 uTint; uniform float uTime, uFlash, uLive;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  ${GLSL_NOISE}
  void main(){
    vec2 p = (vUv - 0.5) * 2.0;
    vec3 N = normalize(vN), Vv = normalize(vV);
    float fres = pow(1.0 - abs(dot(N, Vv)), 2.0);
    vec3 env = mix(vec3(0.02, 0.03, 0.10), vec3(0.30, 0.05, 0.25), smoothstep(-0.8, 0.9, p.y + p.x * 0.3));
    env += vec3(1.0) * pow(max(0.0, 1.0 - abs(p.x * 0.8 + p.y * 0.6 - 0.35 + sin(uTime * 0.4) * 0.3) * 6.0), 4.0) * 0.6;
    vec4 vo = voronoi2(p * 3.2 + 1.7);
    float cr = 1.0 - smoothstep(0.0, 0.05, vo.y);
    vec2 ip = p - vec2(0.18, 0.22); float ia = atan(ip.y, ip.x);
    float rad = (1.0 - smoothstep(0.0, 0.06, abs(sin(ia * 4.5 + 0.7)) * length(ip) * 3.0)) * (1.0 - smoothstep(0.1, 1.2, length(ip)));
    float crack = max(cr * 0.8, rad);
    float shard = hash12(vo.zw);
    vec3 c = env * (0.6 + 0.6 * shard) + uTint * crack * 2.6 + vec3(1.0, 0.9, 1.0) * fres * 0.5 + uTint * uFlash * 1.5;
    gl_FragColor = vec4(c * uLive, 1.0);
  }`;

const AUR_TRAIL_FS = /* glsl */`
  varying vec2 vUv; varying float vA;
  uniform float uTime;
  void main(){
    float across = abs(vUv.y - 0.5) * 2.0;
    float edge = smoothstep(0.55, 1.0, across);
    float body = 1.0 - smoothstep(0.85, 1.0, across);
    float pulse = 0.75 + 0.25 * sin(vUv.x * 40.0 - uTime * 8.0);
    vec3 c = mix(vec3(0.02, 0.0, 0.045), vec3(0.85, 0.45, 1.4) * pulse, edge);
    gl_FragColor = vec4(c, body * vA * 0.9);
  }`;
const AUR_TRAIL_VS = /* glsl */`
  attribute float aA; varying vec2 vUv; varying float vA;
  void main(){ vUv = uv; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const AUR_PORTAL_FS = /* glsl */`
  uniform float uOpen, uTime; varying vec2 vUv;
  ${GLSL_NOISE}
  void main(){
    vec2 p = (vUv - 0.5) * 2.0; float r = length(p) / max(uOpen, 1e-3);
    float core = 1.0 - smoothstep(0.86, 0.95, r);
    float ring = exp(-pow((r - 0.98) * 14.0, 2.0)) * (0.7 + 0.5 * fbm(vec2(atan(p.y, p.x) * 4.0 + uTime * 2.0, r * 6.0), 3));
    float glow = exp(-max(r - 1.0, 0.0) * 5.0) * step(0.95, r) * 0.6;
    vec3 c = vec3(1.4, 0.9, 0.6) * ring * 1.15 + vec3(0.9, 0.25, 0.7) * glow * 0.7;
    float a = clamp(max(core, ring + glow), 0.0, 1.0) * step(0.001, uOpen);
    gl_FragColor = vec4(c, a);
  }`;

const AUR_TETHER_FS = /* glsl */`
  uniform vec3 uColor; uniform float uTime, uInt; varying vec2 vUv;
  void main(){
    float across = abs(vUv.y - 0.5) * 2.0;
    float flow = 0.55 + 0.45 * sin(vUv.x * 60.0 - uTime * 9.0);
    float core = pow(max(1.0 - across, 0.0), 2.0);
    float ends = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x);
    gl_FragColor = vec4(uColor * core * flow * uInt * ends, 1.0);
  }`;

// =============================================================================
//  GEOMETRY BUILDERS
// =============================================================================
/** annular tiles r0..r1 (nAng × nRad) with side walls; attrs aCenter / aSeg(x seed, y delay, z seed2) / aTop */
function aurTileGeo(r0, r1, nAng, nRad, sub, thick, rnd, delayK) {
  const P = [], N = [], C = [], S = [], T = [], I = [];
  let vi = 0;
  const push = (x, y, z, nx, ny, nz, c, s, top) => { P.push(x, y, z); N.push(nx, ny, nz); C.push(c[0], c[1], c[2]); S.push(s[0], s[1], s[2]); T.push(top); return vi++; };
  for (let a = 0; a < nAng; a++) for (let b = 0; b < nRad; b++) {
    const ra = r0 + (r1 - r0) * b / nRad, rb = r0 + (r1 - r0) * (b + 1) / nRad;
    const a0 = a * TAU / nAng, a1 = (a + 1) * TAU / nAng, am = (a0 + a1) / 2, rm = (ra + rb) / 2;
    const c = [Math.sin(am) * rm, -thick * 0.5, Math.cos(am) * rm];
    // tiles nearest the singularity (north, yaw ≈ π) go first, the ripple runs south around both sides
    const fromN = Math.abs(wrapAngle(am - Math.PI)) / Math.PI;
    const s = [rnd(), fromN * delayK + rnd() * 0.25 + (nRad > 1 ? (1 - b / nRad) * 0.15 : 0), rnd()];
    // top
    const base = vi;
    for (let i = 0; i <= sub; i++) {
      const t = a0 + (a1 - a0) * i / sub, sn = Math.sin(t), cs = Math.cos(t);
      push(sn * ra, 0, cs * ra, 0, 1, 0, c, s, 1); push(sn * rb, 0, cs * rb, 0, 1, 0, c, s, 1);
    }
    for (let i = 0; i < sub; i++) { const k = base + i * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    // outer + inner walls
    for (const [rr, sg] of [[rb, 1], [ra, -1]]) {
      if (rr <= 0.001) continue;
      const wb = vi;
      for (let i = 0; i <= sub; i++) {
        const t = a0 + (a1 - a0) * i / sub, sn = Math.sin(t), cs = Math.cos(t);
        push(sn * rr, -0.03, cs * rr, sn * sg, 0, cs * sg, c, s, 0); push(sn * rr, -thick, cs * rr, sn * sg, 0, cs * sg, c, s, 0);
      }
      for (let i = 0; i < sub; i++) { const k = wb + i * 2; I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    // radial walls
    for (const [t, sg] of [[a0, -1], [a1, 1]]) {
      const sn = Math.sin(t), cs = Math.cos(t), nx = cs * sg, nz = -sn * sg, wb = vi;
      push(sn * ra, -0.03, cs * ra, nx, 0, nz, c, s, 0); push(sn * rb, -0.03, cs * rb, nx, 0, nz, c, s, 0);
      push(sn * ra, -thick, cs * ra, nx, 0, nz, c, s, 0); push(sn * rb, -thick, cs * rb, nx, 0, nz, c, s, 0);
      I.push(wb, wb + 1, wb + 2, wb + 1, wb + 3, wb + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aSeg', new THREE.Float32BufferAttribute(S, 3));
  g.setAttribute('aTop', new THREE.Float32BufferAttribute(T, 1));
  g.setIndex(I);
  g.computeBoundingSphere(); g.boundingSphere.radius += 60;     // falling tiles leave the rest bounds
  return g;
}

/** ornate clock hand (flat, along +Z from the pivot), extruded `thick` */
function aurHandGeo(half, holes, thick) {
  const s = new THREE.Shape();
  const pts = half.concat(half.slice(0, -1).reverse().map(([x, y]) => [-x, y]));
  s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  for (const h of holes) { const hp = new THREE.Path(); hp.absarc(h[0], h[1], h[2], 0, TAU, true); s.holes.push(hp); }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 1, curveSegments: 16 });
  g.rotateX(Math.PI / 2); g.translate(0, thick, 0);
  g.computeVertexNormals();
  return g;
}

/** broken gear (extruded, missing teeth + a cut wedge) */
function aurGearGeo(R, teeth, missing, cut, depth) {
  const s = new THREE.Shape(), steps = teeth * 4;
  const a0 = cut ? 0.6 : 0, span = TAU - a0;
  for (let i = 0; i <= steps; i++) {
    const t = a0 + span * i / steps, k = i % 4, tooth = Math.floor(i / 4);
    const out = (k === 1 || k === 2) && !missing.includes(tooth);
    const r = out ? R * 1.14 : R;
    if (i === 0) s.moveTo(Math.cos(t) * r, Math.sin(t) * r); else s.lineTo(Math.cos(t) * r, Math.sin(t) * r);
  }
  if (cut) s.lineTo(0, 0);
  const hole = new THREE.Path(); hole.absarc(0, 0, R * 0.32, 0, TAU, true); if (!cut) s.holes.push(hole);
  for (let k = 0; k < 4; k++) { if (cut && k === 0) continue; const a = k * TAU / 4 + 0.4, p = new THREE.Path(); p.absarc(Math.cos(a) * R * 0.64, Math.sin(a) * R * 0.64, R * 0.17, 0, TAU, true); s.holes.push(p); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals();
  return g;
}

/** canvas glyph band for the gyroscopic rings */
function aurGlyphTexture(seed) {
  const W = 1024, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), rnd = mulberry32(seed);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 3; g.lineCap = 'round';
  g.font = 'bold 40px Georgia, serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
  const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  let x = 18;
  while (x < W - 30) {
    const k = rnd();
    if (k < 0.35) { const t = ROM[(rnd() * 12) | 0]; g.fillText(t, x + t.length * 9, H / 2 + 2); x += t.length * 20 + 26; }
    else if (k < 0.6) { g.beginPath(); g.arc(x + 14, H / 2, 13, 0, TAU); g.stroke(); const a = rnd() * TAU; g.beginPath(); g.moveTo(x + 14, H / 2); g.lineTo(x + 14 + Math.cos(a) * 11, H / 2 + Math.sin(a) * 11); g.stroke(); x += 40; }
    else if (k < 0.8) { g.beginPath(); g.moveTo(x, H * 0.2); g.lineTo(x + 12, H * 0.8); g.lineTo(x + 24, H * 0.2); g.moveTo(x, H * 0.5); g.lineTo(x + 24, H * 0.5); g.stroke(); x += 36; }
    else { g.beginPath(); g.moveTo(x, H * 0.25); g.lineTo(x + 20, H * 0.25); g.lineTo(x, H * 0.75); g.lineTo(x + 20, H * 0.75); g.stroke(); x += 32; }
  }
  g.fillRect(0, 3, W, 2); g.fillRect(0, H - 5, W, 2);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** vertical camera-facing beam (billboarded around Y in sync) */
function aurBeam(color, intensity, h, w) {
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
  const m = new THREE.Mesh(g, makeBeamMaterial({ color, intensity, len: h, scroll: 4, soft: 0.25 }));
  m.scale.set(w, h, 1); m.visible = false; m.frustumCulled = false; m.renderOrder = 8;
  return m;
}

// =============================================================================
//  ARENA — the shattered clock face above the singularity
// =============================================================================
function buildClockArena(ctx) {
  const B = CONFIG.bosses[2], R = B.arenaRadius;
  const group = new THREE.Group(); group.name = 'clock-arena';
  const add = (o) => { group.add(o); return o; };
  const rnd = mulberry32(7331);

  // ---- sky (follows the camera so the singularity sits at infinity)
  const skyU = { uTime: GLOBAL_U.uRealTime, uStreak: GLOBAL_U.uStreak, uOctaves: GLOBAL_U.uOctaves, uFocus: { value: new THREE.Vector3(0, 0, -1) },
    uBH: { value: AUR_BH.dirP1.clone() }, uBHSize: { value: AUR_BH.sizeP1 }, uCollapse: { value: 0 }, uDawn: { value: 0 }, uInhale: { value: 0 }, uDark: { value: 0 }, uWarm: { value: 0 } };
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VS, fragmentShader: AUR_SKY_FS, side: THREE.BackSide, depthWrite: false });
  const sky = add(new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), skyMat));
  sky.renderOrder = -10; sky.frustumCulled = false;

  // ---- accretion disk (flattened torus, camera-relative at 300 m along the hole direction)
  const diskU = { uTime: GLOBAL_U.uTime, uInt: { value: 1 }, uShadowAng: { value: AUR_BH.sizeP1 }, uDark: { value: 0 }, uC: { value: new THREE.Vector3() }, uN: { value: new THREE.Vector3(0, 1, 0) } };
  const diskMat = new THREE.ShaderMaterial({ uniforms: diskU, vertexShader: AUR_DISK_VS, fragmentShader: AUR_DISK_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const diskGeo = new THREE.TorusGeometry(2.4, 0.95, 6, 160); diskGeo.scale(1, 1, 0.07);
  const disk = add(new THREE.Mesh(diskGeo, diskMat));
  disk.frustumCulled = false; disk.renderOrder = -9;

  const st = {
    dir: AUR_BH.dirP1.clone(), size: AUR_BH.sizeP1, tilt: 9 * DEG, roll: -8 * DEG, lensK: 1,
  };
  const _bh = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
  sky.onBeforeRender = (r, s, cam) => {
    sky.position.copy(cam.position); sky.updateMatrixWorld();
    // screen-space lensing centre (FinalPass, Medium/High)
    _bh.copy(cam.position).addScaledVector(st.dir, 100).project(cam);
    Post.U.uBH.value.set(_bh.x * 0.5 + 0.5, _bh.y * 0.5 + 0.5);
    const ruv = Math.tan(st.size * (1 - arena.collapse)) / (2 * Math.tan(cam.fov * DEG * 0.5));
    Post.lensStr = _bh.z < 1 ? Math.min(0.09 * ruv * ruv, 0.018 * ruv) * st.lensK * (1 - arena.collapse) * (1 - arena.dark) : 0;
    // intro fly-in only (the hole swells far past its gameplay size): the 1/r UV pull folds the frame back on
    // itself inside the shadow (a mirrored pinwheel disc). Mask the core black there; in play the boss can sit in
    // front of the hole, so the mask stays off
    Post.lensCore = Post.lensStr > 0 && st.size > AUR_BH.sizeP3 * 1.3 ? ruv * 0.98 : 0;
  };
  disk.onBeforeRender = (r, s, cam) => {
    const D = AUR_BH.dist, sz = D * Math.tan(st.size);
    disk.position.copy(cam.position).addScaledVector(st.dir, D);
    // nearly edge-on: start from the plane that contains the view axis, open it toward the camera by `tilt`, roll it
    _n.set(0, 1, 0).addScaledVector(st.dir, -st.dir.y).normalize();
    _n.multiplyScalar(Math.cos(st.tilt)).addScaledVector(st.dir, -Math.sin(st.tilt)).normalize();
    _n.applyAxisAngle(st.dir, st.roll);
    _q.setFromUnitVectors(_z, _n);
    disk.quaternion.copy(_q);
    disk.scale.setScalar(sz * (1 - arena.collapse * 0.98));
    disk.updateMatrixWorld();
    diskU.uC.value.copy(disk.position); diskU.uN.value.copy(_n);
    diskU.uShadowAng.value = st.size * (1 - arena.collapse);
  };

  // ---- lights (spec): hemi #a0a0ff/#000 0.35, white key 1.0, accretion rim #ffb36b
  const hemi = add(new THREE.HemisphereLight(0xa0a0ff, 0x000000, 0.35));
  const key = add(new THREE.DirectionalLight(0xffffff, 1.0)); key.position.set(8, 22, 14); key.target.position.set(0, 0, 0); group.add(key.target);
  const rim = add(new THREE.DirectionalLight(AUR_RIM, 1.3)); rim.position.set(0, 4, -40); rim.target.position.set(0, 2, 0); group.add(rim.target);
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.04;
  { const sc = key.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 2; sc.far = 80; }
  const applyShadows = (tier) => { key.castShadow = !!tier.shadows; };
  applyShadows(Quality.tier); Quality.onChange(applyShadows);

  // ---- the clock face: inner disc (never falls), middle ring 10–14, outer ring 14–20
  const FU = {
    uTime: GLOBAL_U.uTime, uOctaves: GLOBAL_U.uOctaves, uWarm: { value: 0 }, uBroken: { value: 0 }, uDark: { value: 0 }, uDawn: { value: 0 },
    uTimer: { value: 0 }, uTimerOn: { value: 0 }, uTimerCol: { value: new THREE.Color(1.0, 0.7, 0.25) },
    uSector: { value: new Array(12).fill(0) }, uSectorEdge: { value: new Array(12).fill(0) }, uSectorHit: { value: new Array(12).fill(0) }, uNumLit: { value: new Array(12).fill(0) },
    uBHDir: { value: AUR_BH.dirP1.clone() }, uKeyDir: { value: new THREE.Vector3(8, 22, 14).normalize() }, uHeart: { value: new THREE.Vector4(0, 0, 0, 0) },
    uFallDir: { value: new THREE.Vector3(0, -0.4, -1).normalize() },
  };
  const floorMat = (fallU) => new THREE.ShaderMaterial({ uniforms: Object.assign({}, FU, { uFallT: fallU }), vertexShader: AUR_FLOOR_VS, fragmentShader: AUR_FLOOR_FS, side: THREE.DoubleSide });
  const rings = [
    { r0: 0, r1: 10, nAng: 12, nRad: 1, sub: 10, thick: 0.9, delayK: 0 },
    { r0: 10, r1: 14, nAng: 20, nRad: 1, sub: 4, thick: 1.0, delayK: 1.0 },
    { r0: 14, r1: R, nAng: 24, nRad: 2, sub: 4, thick: 1.1, delayK: 1.2 },
  ].map((d) => {
    const fallT = { value: -1 };
    const mesh = add(new THREE.Mesh(aurTileGeo(d.r0, d.r1, d.nAng, d.nRad, d.sub, d.thick, rnd, d.delayK), floorMat(fallT)));
    mesh.frustumCulled = false;
    return { mesh, fallT, falling: false, t: -1, r1: d.r1 };
  });
  // under-island: a dark glass cone beneath the inner disc, magenta veins
  const underMat = new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL_U.uTime, uDark: FU.uDark },
    vertexShader: /* glsl */`varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`uniform float uTime, uDark; varying vec3 vP; ${GLSL_NOISE}
      void main(){ float a = atan(vP.x, vP.z); float v = abs(fbm(vec2(a * 3.0, vP.y * 0.25 - uTime * 0.05), 3) * 2.0 - 1.0);
        // vP is mesh-local (the 15 m cone is centred on its origin, mounted at y −8.4): use world height, or the
        // lip term below explodes to exp(10) ≈ 2e4 and bleaches the whole frame once the middle ring has fallen
        float wy = vP.y - 8.4;
        float line = 1.0 - smoothstep(0.0, 0.05, v); float fade = smoothstep(-16.0, -2.0, wy);
        vec3 c = vec3(0.012, 0.008, 0.024) + vec3(1.0, 0.25, 0.8) * line * 0.5 * fade + vec3(0.5, 0.15, 0.4) * exp(min(wy + 1.0, 0.5) * 1.2) * 0.25;
        gl_FragColor = vec4(c * (1.0 - uDark), 1.0); }`,
  });
  const under = add(new THREE.Mesh(new THREE.CylinderGeometry(9.98, 1.2, 15, 48, 1, true), underMat));
  under.position.y = -8.4;

  // ---- clock hands (physical gold meshes; the boss drives their angles)
  const handMat = makeArcane({ color: 0xc8963c, roughness: 0.26, metalness: 1.0, emissive: 0x2a1600 }, { rim: 0.9, rimColor: 0xffd890, crackScale: 2.0, key: 'aurHand' });
  const ML = 18.6, HL = 13.4;
  const minuteGeo = aurHandGeo([[0, -2.5], [0.75, -2.15], [0.85, -1.35], [0.32, -0.75], [0.38, 0], [0.3, 2.2], [0.22, ML * 0.5], [0.58, ML * 0.545], [0.62, ML * 0.585], [0.2, ML * 0.63], [0.16, ML - 3.0], [0.72, ML - 1.9], [0.0, ML]], [[0, ML * 0.567, 0.3], [0, -1.55, 0.38]], 0.14);
  const hourGeo = aurHandGeo([[0, -1.9], [0.95, -1.45], [0.95, -0.65], [0.45, 0], [0.4, HL * 0.42], [1.2, HL * 0.6], [1.25, HL * 0.69], [0.32, HL * 0.78], [0.26, HL - 1.9], [1.05, HL - 1.15], [0.0, HL]], [[0, HL * 0.655, 0.55], [0, -1.1, 0.42]], 0.16);
  const minuteHand = add(new THREE.Mesh(minuteGeo, handMat)); minuteHand.position.y = 0.34;
  const hourHand = add(new THREE.Mesh(hourGeo, handMat)); hourHand.position.y = 0.16;
  for (const h of [minuteHand, hourHand]) { h.castShadow = true; h.renderOrder = 6; }
  // hand glow line (rides on the hand: bloom-friendly gold filament)
  const filMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.55) });
  const fil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, ML - 3.4), filMat); fil.position.set(0, 0.18, (ML - 3.4) / 2 + 0.4); minuteHand.add(fil);
  const fil2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, HL - 2.6), filMat); fil2.position.set(0, 0.2, (HL - 2.6) / 2 + 0.3); hourHand.add(fil2);

  // ---- 24 broken gears orbiting the arena (3 instanced variants)
  const gearMat = makeArcane({ color: 0x8a6a3a, roughness: 0.38, metalness: 0.92, emissive: 0x120800 }, { rim: 0.7, rimColor: AUR_RIM, crackScale: 1.0, key: 'aurGear' });
  const gearGeos = [aurGearGeo(1, 14, [3, 4, 9], false, 0.22), aurGearGeo(1, 10, [1, 6], true, 0.28), aurGearGeo(1, 20, [2, 3, 4, 12, 13], false, 0.18)];
  const gears = [];
  const gearMeshes = gearGeos.map((g) => { const m = add(new THREE.InstancedMesh(g, gearMat, 8)); m.frustumCulled = false; return m; });
  for (let i = 0; i < 24; i++) {
    const south = rnd() < 0.3, a = south ? lerp(-1.0, 1.0, rnd()) : lerp(1.4, TAU - 1.4, rnd());
    gears.push({ m: gearMeshes[i % 3], i: (i / 3) | 0, r: lerp(32, 64, rnd()), a, y: south ? lerp(-26, -14, rnd()) : lerp(-18, 3, rnd()),
      sp: lerp(0.01, 0.035, rnd()) * (rnd() < 0.5 ? -1 : 1), spin: lerp(0.08, 0.35, rnd()) * (rnd() < 0.5 ? -1 : 1), s: lerp(1.2, 3.6, rnd()),
      ax: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), tilt: rnd() * TAU, pull: 0 });
  }
  // ---- 400 void motes spiralling toward the singularity
  const MN = 400, mp = new Float32Array(MN * 4), mc = new Float32Array(MN);
  for (let i = 0; i < MN; i++) { mp.set([lerp(8, 42, Math.sqrt(rnd())), rnd() * TAU, rnd(), lerp(0.012, 0.05, rnd())], i * 4); mc[i] = rnd(); }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MN * 3), 3));
  mg.setAttribute('aP', new THREE.BufferAttribute(mp, 4)); mg.setAttribute('aC', new THREE.BufferAttribute(mc, 1));
  const moteU = { uTime: GLOBAL_U.uTime, uInhale: { value: 0 }, uScale: { value: 260 }, uDark: { value: 0 }, uSink: { value: new THREE.Vector3(0, -0.25, -1).normalize() } };
  const motes = add(new THREE.Points(mg, new THREE.ShaderMaterial({ uniforms: moteU, vertexShader: AUR_MOTE_VS, fragmentShader: AUR_MOTE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  motes.frustumCulled = false;

  // ---- the giant clock (Stopped Clock / Final Hour): hologram behind Auren
  const clockU = { uFrac: { value: 0 }, uOn: { value: 0 }, uTime: GLOBAL_U.uRealTime, uCol: { value: new THREE.Color(1.0, 0.7, 0.28) } };
  const giant = add(new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.ShaderMaterial({ uniforms: clockU, vertexShader: BASIC_UV_VS, fragmentShader: AUR_CLOCK_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
  giant.position.set(0, 9.6, -13); giant.visible = false; giant.renderOrder = 3;

  // ---- numeral beams (rung numerals), fate beam
  const numBeams = []; for (let i = 0; i < 4; i++) numBeams.push(add(aurBeam(0xffb0f0, 1.1, 9, 1.1)));
  const fateBeam = add(aurBeam(AUR_VIOLET, 2.6, 16, 1.2));

  // ---- fade overlay (falls, transitions)
  let fadeEl = $('aur-fade');
  if (!fadeEl) { fadeEl = document.createElement('div'); fadeEl.id = 'aur-fade'; fadeEl.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:40;transition:none'; document.body.appendChild(fadeEl); }

  const arena = {
    key: 'auren', group, radius: R, colliders: [], spawn: B.playerSpawn,
    exposure: B.exposure, bloom: B.bloom, grade: B.grade,
    FU, skyU, diskU, moteU, clockU, st, rings, minuteHand, hourHand, giant, numBeams, fateBeam, hemi, key, rim, gears,
    inhale: 0, warm: 0, broken: 0, dark: 0, collapse: 0, dawn: 0, bhSize: AUR_BH.sizeP1, bhP3: 0, diskInt: 1, clockOn: 0, fade: 0, lensK: 1,
    sectorEdge: FU.uSectorEdge.value, sector: FU.uSector.value, sectorHit: FU.uSectorHit.value, numLit: FU.uNumLit.value,
    lightsOut: 0, sepiaT: 0,
    tw: {},
    tween(name, to, dur, ease) { if (!dur) { this[name] = to; delete this.tw[name]; return; } this.tw[name] = { from: this[name], to, t: 0, dur, ease }; },
    /** drop ring i (1 = middle, 2 = outer) into the singularity */
    fall(i) { const rg = rings[i]; if (!rg || rg.falling) return; rg.falling = true; rg.t = 0; },
    /** instantly remove ring i (phase jumps) */
    gone(i) { const rg = rings[i]; if (!rg) return; rg.falling = true; rg.t = 99; rg.mesh.visible = false; },
    setFade(v) { this.fade = v; fadeEl.style.opacity = String(clamp01(v)); },
    beamAt(i, x, z, on) { const b = numBeams[i]; if (!b) return; b.position.set(x, 0, z); b.visible = on; b.userData.t = 0; },
    update(dt) {
      for (const k in this.tw) { const w = this.tw[k]; w.t += dt; let u = clamp01(w.t / w.dur); u = w.ease === 'in' ? u * u * u : w.ease === 'out' ? 1 - Math.pow(1 - u, 3) : smooth01(u); this[k] = lerp(w.from, w.to, u); if (w.t >= w.dur) { this[k] = w.to; delete this.tw[k]; } }
      // singularity: P1 → P3 (bigger, higher), intro fly-in (bhSize tween)
      st.dir.copy(AUR_BH.dirP1).lerp(AUR_BH.dirP3, this.bhP3).normalize();
      st.size = this.bhSize; st.lensK = this.lensK;
      skyU.uBH.value.copy(st.dir); skyU.uBHSize.value = st.size; skyU.uCollapse.value = this.collapse; skyU.uDawn.value = this.dawn;
      skyU.uInhale.value = this.inhale; skyU.uDark.value = this.dark; skyU.uWarm.value = this.warm;
      camera.getWorldDirection(skyU.uFocus.value);
      // a bigger disk needs less per-pixel light or bloom eats the frame
      diskU.uInt.value = this.diskInt * (1 + this.inhale * 0.3) * (1 - this.bhP3 * 0.35) * (1 - this.collapse);
      diskU.uDark.value = Math.min(1, this.lightsOut >= 4 ? 1 : this.dark);     // Heat Death: the disk goes out too
      disk.visible = this.collapse < 0.999;
      FU.uWarm.value = this.warm; FU.uBroken.value = this.broken; FU.uDark.value = this.lightsOut >= 6 ? 1 : this.dark * 0.92; FU.uDawn.value = this.dawn;
      FU.uBHDir.value.copy(st.dir);
      moteU.uInhale.value = this.inhale; moteU.uDark.value = this.dark;
      // decays: sector flashes, numeral glow
      for (let i = 0; i < 12; i++) { this.sector[i] = Math.max(0, this.sector[i] - dt * 1.6); this.sectorHit[i] = Math.max(0, this.sectorHit[i] - dt * 3.0); this.numLit[i] = Math.max(0, this.numLit[i] - dt * 0.9); }
      // falling rings
      for (const rg of rings) if (rg.falling && rg.t < 99) {
        rg.t += dt; rg.fallT.value = rg.t;
        if (rg.t > 5.5) { rg.mesh.visible = false; rg.t = 99; }
        else if (fxRand() < dt * 24 && rg.t < 3) { const a = fxRange(0, TAU), r = rg.r1 - fxRange(0.5, 3.5); Particles.burst(AUR_V[0].set(Math.sin(a) * r, -0.5 - rg.t * rg.t * 2, Math.cos(a) * r), 8, 0xffb0f0, 0x6a1060, 4, 1.0, 0.3, -6, { intensity: 2.2 }); }
      }
      // gears (orbit; pulled toward the hole on the inhale / during Heat Death)
      for (const g of gears) {
        g.a += g.sp * dt * (1 + this.inhale * 4); g.tilt += g.spin * dt * (1 + this.inhale * 3);
        g.pull = damp(g.pull, this.inhale * 0.6, 0.8, dt);
        AUR_V[1].set(Math.sin(g.a) * g.r, g.y, Math.cos(g.a) * g.r).addScaledVector(st.dir, g.pull * 40);
        _q.setFromAxisAngle(g.ax, g.tilt);
        _m1.compose(AUR_V[1], _q, AUR_V[2].setScalar(g.s * (1 - this.collapse * 0.0)));
        g.m.setMatrixAt(g.i, _m1);
      }
      for (const m of gearMeshes) m.instanceMatrix.needsUpdate = true;
      gearMat.userData.arcane.uRim.value = 0.7 * (1 - this.dark);
      filMat.color.setRGB(2.4, 1.5, 0.55).multiplyScalar(1 - this.dark);     // Heat Death: the hand filaments go out too
      // the giant clock
      clockU.uOn.value = this.clockOn; giant.visible = this.clockOn > 0.01;
      giant.lookAt(camera.position.x, giant.position.y, camera.position.z);
      // lights (Heat Death switches them off one by one)
      const lo = this.lightsOut;
      hemi.intensity = (lo >= 1 ? 0 : 0.35) + this.dawn * 0.35;
      key.intensity = lo >= 2 ? 0 : 1.0 + this.dawn * 0.4;
      rim.intensity = lo >= 3 ? 0 : 1.3 * (1 + this.warm * 0.35) * (1 - this.collapse * 0.5);
      rim.color.setHex(AUR_RIM).lerp(_c1.setRGB(1, 0.85, 0.65), this.dawn);
      // numeral beams fade
      for (const b of numBeams) if (b.visible) { b.userData.t = (b.userData.t || 0) + dt; b.material.uniforms.uAlpha.value = Math.max(0, 1 - b.userData.t / 0.9); if (b.userData.t > 0.9) b.visible = false; }
      for (const b of numBeams) if (b.visible) b.rotation.y = Math.atan2(camera.position.x - b.position.x, camera.position.z - b.position.z);
      if (fateBeam.visible) fateBeam.rotation.y = Math.atan2(camera.position.x - fateBeam.position.x, camera.position.z - fateBeam.position.z);
      // rewind sepia
      if (this.sepiaT > 0) { this.sepiaT -= dt; Post.sepia = Math.max(0, this.sepiaT / 0.9) * 0.75; if (this.sepiaT <= 0) Post.sepia = 0; }
    },
    dispose() {
      scene.remove(group);
      const li = Quality.listeners.indexOf(applyShadows); if (li >= 0) Quality.listeners.splice(li, 1);
      group.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.dispose) c.material.dispose(); });
      Post.lensStr = 0; Post.lensCore = 0; Post.sepia = 0; Post.whiteout = 0; Post.tunnel = 0;
      if (fadeEl) fadeEl.style.opacity = '0';
      const cr = $('aur-credits'); if (cr) cr.remove();
    },
  };
  scene.add(group);
  syncLightLayers(group);
  return arena;
}

// =============================================================================
//  AUREN, THE UNWOUND HOUR
// =============================================================================
const AUR_POSES = {
  idle: { shL: { r: [0, 0, 0.28] }, shR: { r: [0, 0, -0.28] }, elL: { r: [-0.25, 0, 0] }, elR: { r: [-0.25, 0, 0] } },
  point: { torso: { r: [-0.05, -0.15, 0] }, shR: { r: [-1.95, 0, -0.35] }, elR: { r: [-0.15, 0, 0] }, shL: { r: [0, 0, 0.55] }, elL: { r: [-0.4, 0, 0] }, head: { r: [-0.15, 0, 0] } },
  cast: { torso: { r: [0.08, 0, 0] }, shL: { r: [-1.35, 0, 0.35] }, shR: { r: [-1.35, 0, -0.35] }, elL: { r: [-0.55, 0, 0] }, elR: { r: [-0.55, 0, 0] }, head: { r: [0.12, 0, 0] } },
  bell: { torso: { r: [-0.1, 0.1, 0] }, shR: { r: [-1.6, 0, -0.15] }, elR: { r: [-0.9, 0, 0] }, shL: { r: [-0.6, 0, 0.9] }, elL: { r: [-0.6, 0, 0] }, head: { r: [-0.2, 0, 0] } },
  inhale: { torso: { r: [-0.28, 0, 0] }, head: { r: [-0.45, 0, 0] }, shL: { r: [0, 0, 1.75] }, shR: { r: [0, 0, -1.75] }, elL: { r: [-0.35, 0, 0] }, elR: { r: [-0.35, 0, 0] }, body: { p: [0, 0.2, 0] } },
  shield: { torso: { r: [0.22, 0, 0] }, head: { r: [0.35, 0, 0] }, shL: { r: [-1.15, 0, -0.85] }, shR: { r: [-1.15, 0, 0.85] }, elL: { r: [-1.35, 0, 0] }, elR: { r: [-1.35, 0, 0] }, body: { p: [0, -0.2, 0] } },
  channel: { torso: { r: [-0.2, 0, 0] }, head: { r: [-0.5, 0, 0] }, shL: { r: [0, 0, 2.75] }, shR: { r: [0, 0, -2.75] }, elL: { r: [-0.15, 0, 0] }, elR: { r: [-0.15, 0, 0] } },
  collapse: { body: { p: [0, -1.4, 0], s: 0.85 }, torso: { r: [0.65, 0, 0] }, head: { r: [0.6, 0, 0] }, shL: { r: [-0.4, 0, -0.2] }, shR: { r: [-0.4, 0, 0.2] }, elL: { r: [-1.2, 0, 0] }, elR: { r: [-1.2, 0, 0] } },
};

class Auren extends Boss {
  constructor(ctx, arena) {
    const B = CONFIG.bosses[2], M = B.mech, N = M.numerals, Rw = M.rewind, F = M.fate, Bl = M.bell, P3 = M.p3;
    super({
      index: 2, x: B.spawn.x, z: B.spawn.z,
      phases: [
        { name: 'TICK', until: 0.70, walk: false, abilities: [
          { id: 'numerals', first: N.first, every: N.every, major: true, resolveIn: 4.5 },
          { id: 'rewind', first: Rw.first, every: Rw.every } ] },
        { name: 'PARADOX', title: 'PHASE II', subtitle: 'PARADOX', until: 0.40, walk: false, abilities: [
          { id: 'numerals', first: 7, every: N.every, major: true, resolveIn: 5 },
          { id: 'fate', first: F.first, every: F.every, cast: false },
          { id: 'rewind', first: 15, every: Rw.every },
          { id: 'bell', first: Bl.first, every: Bl.every } ] },
        { name: 'STOPPED CLOCK', title: 'STOPPED CLOCK', subtitle: 'BREAK THE ANCHORS', until: null, invuln: true, targetable: false, walk: false, melee: false, wide: true, abilities: [] },
        { name: 'COLLAPSE', title: 'PHASE III', subtitle: 'COLLAPSE', until: 0, walk: false, abilities: [
          { id: 'numerals', first: 6, every: P3.numeralsEvery, major: true, resolveIn: 3.5 },
          { id: 'fate', first: 11, every: P3.fateEvery, cast: false } ],
          specials: [{ atPct: M.collapse.breaks[0][0], id: 'break1' }, { atPct: M.collapse.breaks[1][0], id: 'break2' }, { atPct: M.finalHour.at, id: 'finalHour' }] },
      ],
    });
    this.arena = arena; this.M = M;
    this.yaw = 0; this.prevYaw = 0; this.visYaw = 0;
    this.shardColor = 0xffc0f4; this.shardColor2 = AUR_MAG; this.shardIntensity = 1.2;
    this.hands = {
      min: { rot: aurNumeralRot(12), w: -M.minute.degPerSec * DEG, on: true, hz: null, mesh: arena.minuteHand, cfg: M.minute, src: 'Minute Hand' },
      hour: { rot: aurNumeralRot(9), w: -M.hour.degPerSec * DEG, on: true, hz: null, mesh: arena.hourHand, cfg: M.hour, src: 'Hour Hand' },
    };
    this.ringSpin = 1; this.heartK = 1; this.formK = 1; this.overV = 0; this.mirrorFlash = 0;
    this.fate = null; this.fateNext = rand() < 0.5 ? 'converge' : 'diverge';
    this.rewindOn = false; this.shadowOn = false; this.shadowA = 0;
    // brk[i] = 1: sample i starts a new strand (you teleported — Recall / Rewind — so no ribbon spans the gap)
    this.trail = { x: new Float32Array(64), z: new Float32Array(64), t: new Float32Array(64), brk: new Uint8Array(64), n: 0, head: 0, acc: 0, lockT: 0 };
    this.anchors = []; this.anchorGen = 0; this.imPending = false; this.vulnPair = 0; this.swapT = 0; this.imActive = false;
    this.entT = 0; this.finalHour = false; this.heat = null; this.killTime = 0;
    this.buildModel();
    this.buildExtras();
    this.light.color.set(AUR_MAG); this.light.distance = 16; this.light.decay = 1.3; this.light.intensity = 0;
  }

  /** Auren fills a third of the screen: a full-strength white hit flash + bloom washes her out, so it is kept subtle */
  applyArcane(dt) {
    super.applyArcane(dt);
    for (const m of this.arcane) { const u = m.userData.arcane; u.uFlash.value *= 0.35; u.uFlashColor.value.setRGB(1.0, 0.85, 1.0); }
  }
  get wmul() { return this.windupMul * (this.phase === 3 ? this.M.p3.windupMul : 1); }
  get P() { return Game.player.pos; }

  // ------------------------------------------------------------ model
  buildModel() {
    const g = this.group;
    const shell = this.addArcane(makeArcane({ color: 0x050409, roughness: 0.22, metalness: 0.75 }, { rim: 1.8, rimColor: 0xffc4f2, crackColor: AUR_MAG, crackScale: 1.4, key: 'aurShell' }));
    const gold = this.addArcane(makeArcane({ color: 0xc89434, roughness: 0.28, metalness: 1.0, emissive: 0x2a1600 }, { rim: 0.7, rimColor: 0xffd27a, crackColor: AUR_MAG, crackScale: 2.2, key: 'aurGold' }));
    this.shellMat = shell; this.goldMat = gold;
    this.heartMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.5, 2.7) });
    this.glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.8, 0.8) });
    this.maskMat = new THREE.ShaderMaterial({
      uniforms: { uTint: { value: new THREE.Color(0x5ff2ff) }, uTime: GLOBAL_U.uTime, uFlash: { value: 0 }, uLive: { value: 1 } },
      vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: AUR_MIRROR_FS,
    });
    const piv = (parent, x, y, z) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
    const mesh = (parent, geo, mat, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = mat !== this.glowMat && mat !== this.heartMat; parent.add(m); return m; };
    const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg || 40);

    const body = piv(g, 0, 0, 0);
    // lower robe: a wide bell of dark shell
    mesh(body, lathe([[2.15, 0.02], [2.05, 0.22], [1.8, 0.9], [1.4, 1.9], [1.08, 2.8], [0.98, 3.25]]), shell);
    mesh(body, new THREE.TorusGeometry(2.08, 0.06, 6, 64), gold, 0, 0.12, 0, Math.PI / 2);
    for (let i = 0; i < 3; i++) { const a = (i - 1) * 0.42; const sm = mesh(body, new THREE.BoxGeometry(0.07, 2.7, 0.05), gold, Math.sin(a) * 1.55, 1.5, Math.cos(a) * 1.55, 0.3 * Math.cos(a) * 0 - 0.32, a, 0); sm.rotation.order = 'YXZ'; sm.rotation.set(-0.3, a, 0); }
    // upper body
    const torso = piv(body, 0, 3.0, 0);
    mesh(torso, lathe([[0.98, 0.15], [1.12, 0.9], [1.3, 1.7], [1.45, 2.35], [1.28, 2.75], [0.55, 3.08], [0.3, 3.4]]), shell);
    mesh(torso, new THREE.TorusGeometry(0.62, 0.06, 6, 40), gold, 0, 2.95, 0, Math.PI / 2);
    // the heart: magenta crystal in a gold cage
    this.heart = mesh(torso, new THREE.OctahedronGeometry(0.42, 0), this.heartMat, 0, 1.85, 1.05); this.heart.scale.set(1, 1.45, 0.8);
    mesh(torso, new THREE.TorusGeometry(0.58, 0.045, 6, 32), gold, 0, 1.85, 0.98);
    mesh(torso, new THREE.TorusGeometry(0.58, 0.045, 6, 32), gold, 0, 1.85, 0.98, 0, Math.PI / 2);
    // pauldrons: clock-hand spades
    const spade = new THREE.Shape(); [[0, 0], [0.38, 0.42], [0.13, 0.55], [0.32, 1.55], [0, 2.3], [-0.32, 1.55], [-0.13, 0.55], [-0.38, 0.42]].forEach(([x, y], i) => i ? spade.lineTo(x, y) : spade.moveTo(x, y));
    const spG = new THREE.ExtrudeGeometry(spade, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }); spG.translate(0, 0, -0.06);
    const arms = {};
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R';
      mesh(torso, spG, gold, s * 1.35, 2.55, -0.05, 0, 0, s * -0.75);
      mesh(torso, spG, gold, s * 1.15, 2.6, -0.2, 0, 0, s * -0.35).scale.setScalar(0.7);
      const sh = piv(torso, s * 1.42, 2.55, 0);
      mesh(sh, new THREE.SphereGeometry(0.26, 12, 8), gold, 0, 0, 0);
      mesh(sh, new THREE.CylinderGeometry(0.17, 0.14, 1.7, 8), shell, 0, -0.85, 0);
      const el = piv(sh, 0, -1.72, 0);
      mesh(el, new THREE.SphereGeometry(0.17, 10, 8), gold, 0, 0, 0);
      mesh(el, new THREE.CylinderGeometry(0.14, 0.1, 1.5, 8), shell, 0, -0.75, 0);
      mesh(el, new THREE.CylinderGeometry(0.2, 0.17, 0.5, 8), gold, 0, -0.55, 0);
      mesh(el, new THREE.ConeGeometry(0.15, 0.7, 6), gold, 0, -1.75, 0.02, Math.PI, 0, 0);
      arms[L] = { sh, el };
    }
    // head: hood + cracked mirror face + crown of 12 + halo
    const head = piv(torso, 0, 3.5, 0.05);
    mesh(head, new THREE.SphereGeometry(0.62, 22, 16), shell, 0, 0.1, -0.05).scale.set(0.95, 1.28, 1.0);
    this.mask = mesh(head, new THREE.CircleGeometry(0.43, 36), this.maskMat, 0, 0.08, 0.56); this.mask.scale.set(1, 1.32, 1); this.mask.castShadow = false;
    mesh(head, new THREE.TorusGeometry(0.46, 0.035, 6, 40), gold, 0, 0.08, 0.53).scale.set(1, 1.32, 1);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU, h = i % 3 === 0 ? 0.95 : 0.6;
      const e = new THREE.Euler(Math.cos(a) * 0.38, 0, -Math.sin(a) * 0.38);
      const bx = Math.sin(a) * 0.5, by = 0.82, bz = Math.cos(a) * 0.5 - 0.05;
      const cg = new THREE.ConeGeometry(0.075, h, 5); cg.translate(0, h / 2, 0);
      mesh(head, cg, gold, bx, by, bz, e.x, e.y, e.z);
      const tip = new THREE.Vector3(0, h + 0.03, 0).applyEuler(e);
      mesh(head, new THREE.OctahedronGeometry(0.06, 0), this.glowMat, bx + tip.x, by + tip.y, bz + tip.z);
    }
    mesh(head, new THREE.TorusGeometry(1.05, 0.035, 6, 64), this.glowMat, 0, 0.45, -0.5);
    // floating hem shards
    const hem = piv(g, 0, 0, 0);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; mesh(hem, new THREE.TetrahedronGeometry(0.22 + (i % 3) * 0.08, 0), gold, Math.sin(a) * 2.5, 0.5 + (i % 4) * 0.35, Math.cos(a) * 2.5, i, i * 2, 0); }
    this.hem = hem;
    // ---- three gyroscopic glyph rings
    this.ringObjs = [];
    const RR = [3.0, 3.55, 4.1];
    for (let i = 0; i < 3; i++) {
      const tex = aurGlyphTexture(101 + i * 17); tex.repeat.set(i + 2, 1);
      const bandMat = this.addArcane(makeArcane({ color: 0x9a7030, roughness: 0.3, metalness: 1.0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.6, side: THREE.DoubleSide }, { rim: 0.5, rimColor: 0xffd27a, crackColor: AUR_MAG, crackScale: 2.0, key: 'aurBand' }));
      bandMat.emissive.setRGB(1.0, 0.62, 0.22);
      const gim = piv(g, 0, 5.2, 0), spin = piv(gim, 0, 0, 0);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(RR[i], RR[i], 0.34, 120, 1, true), bandMat); spin.add(band);
      for (const e of [1, -1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(RR[i], 0.05, 6, 120), gold); t.rotation.x = Math.PI / 2; t.position.y = e * 0.19; spin.add(t); }
      this.ringObjs.push({ gim, spin, tex, mat: bandMat, speed: [0.55, -0.8, 1.1][i], ph: i * 2.1, tiltA: [0.5, 0.42, 0.34][i] });
    }
    this.blob = makeBlobShadow(6); g.add(this.blob); this.blob.position.y = 0.02;
    this.parts_ = { body, torso, head, shL: arms.L.sh, elL: arms.L.el, shR: arms.R.sh, elR: arms.R.el };
    const keep = new Set([this.heart, this.mask, this.blob, hem]);
    for (const k in this.parts_) keep.add(this.parts_[k]);
    for (const r of this.ringObjs) { keep.add(r.gim); keep.add(r.spin); }
    mergeStaticMeshes(g, keep);
    // Fracture cracks (the player's stack readout) cover a 9 m figure: at full magenta strength 5 Fractures turn
    // Auren into a blooming pink lattice and her silhouette is lost. Same spread, half the light
    for (const m of this.arcane) m.userData.arcane.uFractureColor.value.multiplyScalar(0.5);
    this.rig = new PoseRig(this.parts_, AUR_POSES);
    this.rig.set('idle').snap();
  }
  pose(name, speed) { this.rig.set(name, speed || 6); }

  /** ghosts, shadow, bell, portal, tethers, trail */
  buildExtras() {
    // Rewind ghost: you, 5 seconds ago (gold echo)
    this.ghostMat = makeEchoMaterial({ color: 0xffc070, alpha: 0.75 });
    this.ghost = buildChronoblade(() => this.ghostMat, { echo: true }); this.ghost.root.visible = false; scene.add(this.ghost.root);
    const rg = new THREE.PlaneGeometry(1, 1); rg.rotateX(-Math.PI / 2);
    this.ghostRing = new THREE.Mesh(rg, makeGroundRingMaterial(0xffc070)); this.ghostRing.scale.setScalar(2.6); this.ghostRing.material.uniforms.uR.value = 1.04; this.ghostRing.visible = false; this.ghostRing.renderOrder = 4; scene.add(this.ghostRing);
    // Your Shadow: violet-black Chronoblade + its ribbon trail
    this.shadowMat = makeEchoMaterial({ shadow: true, color: AUR_VIOLET, alpha: 1 });
    this.shadowFig = buildChronoblade(() => this.shadowMat, { echo: true }); this.shadowFig.root.visible = false; scene.add(this.shadowFig.root);
    const TN = 64, tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TN * 2 * 3), 3));
    tg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(TN * 2 * 2), 2));
    tg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(TN * 2), 1));
    const ti = []; for (let i = 0; i < TN - 1; i++) { const k = i * 2; ti.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } tg.setIndex(ti);
    this.trailMesh = new THREE.Mesh(tg, new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime }, vertexShader: AUR_TRAIL_VS, fragmentShader: AUR_TRAIL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.trailMesh.frustumCulled = false; this.trailMesh.renderOrder = 4; this.trailMesh.visible = false; scene.add(this.trailMesh);
    // Paradox Bell (floats before Auren)
    this.bellMat = makeArcane({ color: 0x2a1640, roughness: 0.25, metalness: 0.9, emissive: 0x6a2cff, emissiveIntensity: 0.3 }, { rim: 1.6, rimColor: 0xd9b0ff, key: 'aurBell' });
    const bellG = new THREE.LatheGeometry([[0.0, 1.0], [0.18, 0.98], [0.32, 0.82], [0.38, 0.45], [0.48, 0.12], [0.66, -0.05], [0.64, -0.1], [0.0, -0.1]].map(([x, y]) => new THREE.Vector2(x, y)), 36);
    this.bell = new THREE.Mesh(bellG, this.bellMat); this.bell.visible = false; this.bell.scale.setScalar(1.6); this.group.add(this.bell); this.bell.position.set(0, 6.3, 2.9);
    // event-horizon portal (intro)
    this.portalMat = new THREE.ShaderMaterial({ uniforms: { uOpen: { value: 0 }, uTime: GLOBAL_U.uRealTime }, vertexShader: BASIC_UV_VS, fragmentShader: AUR_PORTAL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.portal = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), this.portalMat); this.portal.position.set(0, 4.8, -2.4); this.portal.visible = false; this.portal.renderOrder = 2; scene.add(this.portal);
    // anchor tethers (N–S and E–W arcs over Auren)
    this.tethers = [];
    for (let i = 0; i < 2; i++) {
      const R = this.M.stoppedClock.anchorR;
      const a = i === 0 ? new THREE.Vector3(0, 3.6, -R) : new THREE.Vector3(R, 3.6, 0), b = a.clone().multiplyScalar(-1); b.y = 3.6;
      const curve = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3(0, 13.5, 0), b);
      const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(AUR_GOLD) }, uTime: GLOBAL_U.uTime, uInt: { value: 1.5 } }, vertexShader: BASIC_UV_VS, fragmentShader: AUR_TETHER_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.09, 6, false), mat); m.visible = false; m.frustumCulled = false; scene.add(m);
      this.tethers.push(m);
    }
    this.extraObjs = [this.ghost.root, this.ghostRing, this.shadowFig.root, this.trailMesh, this.portal, ...this.tethers];
  }

  // ------------------------------------------------------------ clock hands
  /** keep the hand hazards alive in the fight state (never during intro / transitions / enrage) */
  updateHands(dt) {
    const fight = Game.state === 'fight' && !this.transitioning && this.alive && !this.enraged;
    for (const k in this.hands) {
      const H = this.hands[k];
      if (H.hz && (!H.hz.active || H.hz.dying)) H.hz = null;
      if (fight && H.on && !H.hz) this.spawnHand(H);
      if (H.hz) H.rot = H.hz.rot;
      if (H.stopAt != null) {        // Final Hour: swing to XII and stop
        H.rot = H.rot + angDiff(H.rot, H.stopAt) * (1 - Math.exp(-3 * dt));
        if (H.hz) { H.hz.rot = H.rot; H.hz.data.angVel = 0; }
      }
      if ((!H.on || !fight) && H.hz && !this.finalHour) { H.hz.kill(); H.hz = null; }
    }
  }
  spawnHand(H) {
    const c = H.cfg;
    H.hz = BossKit.rotatingRect({ x: 0, z: 0, rot: H.rot, angVel: H.stopAt != null ? 0 : H.w, len: c.len, width: c.width, tickDmg: c.dmg, tickInterval: c.lock, source: H.src, color: 'red', gentle: false, tag: 'hand' });
    if (!H.hz) return;
    H.hz.onHit = (h) => {
      // thrown clear: knocked back PAST the hand (opposite the sweep) so one contact = one hit
      const p = Game.player; if (!p || !p.alive || p.invuln) return;
      const w = h.data.angVel || -1, tx = -Math.cos(h.rot) * Math.sign(w) * -1, tz = Math.sin(h.rot) * Math.sign(w) * -1;
      p.knockback(p.pos.x + tx, p.pos.z + tz, c.knock);
      sfx('slam'); CamRig.addTrauma(0.2);
      Particles.burst(AUR_V[0].set(p.pos.x, 1, p.pos.z), 30, 0xffe0a0, 0xffa020, 7, 0.5, 0.25, -6, { intensity: 2.2 });
    };
  }
  setHandsFor(n) {
    this.hands.min.on = true;
    this.hands.hour.on = n <= 1;
    this.arena.hourHand.visible = n <= 1;
  }

  // ------------------------------------------------------------ abilities
  /** NUMERAL SEQUENCE: rings 3 (P2: 4) numerals; their 30° sectors explode in that order */
  ab_numerals() {
    const N = this.M.numerals, W = this.wmul, ar = this.arena;
    const count = this.phase === 1 ? N.countP2 : N.count;
    const L = N.light * W, pause = N.pause * W, gap = N.gap * W, fill = Math.max(0.8, N.fill * W);
    // distinct numerals, never two neighbours back to back (a memory test, not a sweep)
    const seq = [];
    let guard = 0;
    while (seq.length < count && guard++ < 200) {
      const n = 1 + Math.floor(rand() * 12);
      if (seq.includes(n)) continue;
      const last = seq[seq.length - 1];
      if (last && (Math.abs(last - n) === 1 || Math.abs(last - n) === 11)) continue;
      seq.push(n);
    }
    this.startCast('Numeral Sequence', count * L + pause, { raw: true, stingF: 262 });
    this.pose('point', 7);
    Banner.show('NUMERAL SEQUENCE', 'Remember the order', { cls: 'gold', dur: 1.0 });
    const R = ar.radius, edgeK = N.outline[Game.difficulty] != null ? N.outline[Game.difficulty] : 0.35;
    seq.forEach((n, i) => {
      const idx = n % 12, rot = aurNumeralRot(n);
      this.after(i * L, () => {
        ar.sector[idx] = 1; ar.numLit[idx] = 1;
        ar.beamAt(i, Math.sin(rot) * 16.7, Math.cos(rot) * 16.7, true);
        sfx('chime', { degree: n % 7 });
        this.ringPulse = 1; this.yawPoint = rot;
        Particles.burst(AUR_V[0].set(Math.sin(rot) * 16.7, 0.5, Math.cos(rot) * 16.7), 40, 0xffd8f4, AUR_MAG, 5, 0.9, 0.25, 2, { up: 4, intensity: 2.4 });
      });
      const start = count * L + pause + i * gap;
      if (edgeK > 0) this.after(count * L, () => { ar.sectorEdge[idx] = edgeK; });
      Telegraphs.spawn({ shape: 'sector', x: 0, z: 0, rot, r: R + 0.3, inner: N.inner, angle: 30, delay: start, windup: fill, rawWindup: true, dmg: N.dmg, source: 'Numeral Sequence',
        major: true, color: 'red', tag: 'numeral', onResolve: () => {
          ar.sectorEdge[idx] = 0; ar.sectorHit[idx] = 1;
          sfx('boom'); CamRig.addTrauma(0.16);
          for (let k = 0; k < 4; k++) { const rr = lerp(4, R - 1, (k + 0.5) / 4); Particles.burst(AUR_V[0].set(Math.sin(rot) * rr, 0.4, Math.cos(rot) * rr), 26, 0xffd0a0, 0xff3a10, 6 + k, 0.7, 0.32, -8, { up: 5, intensity: 2.2 }); }
          PointLights.flash(AUR_V[1].set(Math.sin(rot) * 10, 2, Math.cos(rot) * 10), 0xff5a20, 40, 0.3);
        } });
    });
    this.after(count * L + 0.3, () => { if (this.rig.name === 'point') this.pose('idle', 3); });
    return count * L + pause;
  }

  /** REWIND (interruptible): yanks you to where you stood 5 s ago */
  ab_rewind() {
    const Rw = this.M.rewind;
    this.startCast('Rewind', Rw.cast, { interruptible: true, stingF: 247,
      onComplete: () => this.rewindYank(),
      onInterrupt: () => { this.rewindEnd(); this.pose('idle', 4); } });
    this.rewindOn = true; this.pose('cast', 5);
    Banner.show('REWIND', 'Lance it, or make your past safe', { cls: 'violet', dur: 1.2 });
    if (!this.hintRw) { this.hintRw = true; Hint.show('REWIND: the gold ghost is where you stood 5 s ago. Interrupt with ' + Input.keyLabel('lance') + '.', 4, 'aurRewind', this, 'Rewind'); }
    sfx('whoosh', { f: 1800, f1: 300, dur: 0.8, vol: 0.2 });
    return Rw.cast * this.windupMul + 0.3;
  }
  rewindEnd() { this.rewindOn = false; this.ghost.root.visible = false; this.ghostRing.visible = false; }
  rewindYank() {
    const Rw = this.M.rewind, p = Game.player;
    this.rewindEnd(); this.pose('idle', 3);
    if (!p || !p.alive) return;
    p.history.sampleAgo(Rw.ago, AUR_HIST);
    if (!AUR_HIST.valid) return;
    const fx = p.pos.x, fz = p.pos.z;
    p.dashing = false; p.recallS = null; p.root.visible = true; p.knockV.set(0, 0, 0);
    const R = this.arena.radius - 0.6, rr = Math.hypot(AUR_HIST.x, AUR_HIST.z), k = rr > R ? R / rr : 1;
    p.pos.set(AUR_HIST.x * k, 0, AUR_HIST.z * k); p.prevPos.copy(p.pos);
    p.damage({ amount: Rw.dmg, source: 'Rewind', avoidable: true });
    this.arena.sepiaT = 0.9;
    worldToScreen(AUR_V[0].set(p.pos.x, 1, p.pos.z), AUR_V[1]);
    Post.zoomPulse(1.0, clamp01(AUR_V[1].x / View.w), 1 - clamp01(AUR_V[1].y / View.h)); Post.kickCA(0.006);
    Particles.line(AUR_V[0].set(fx, 0.6, fz), AUR_V[1].set(p.pos.x, 0.6, p.pos.z), 40, 0xffd090, 0xa0602a, 0.6, 0.22, { vy: 1, intensity: 2.2, stagger: true });
    GroundFX.ring(p.pos.x, p.pos.z, 2.6, 0.3, 0xffc070, 0.45, 0.3, 2.6);
    sfx('recall'); sfx('bell', { f: 196 });
    Game.stats.mechanicsFailed++;
  }

  /** FATE MARKS: converge on / diverge from your Echo when the 8 s mark expires */
  ab_fate() {
    const F = this.M.fate, p = Game.player; if (!p || !p.alive) return 0;
    if (this.fate) return 0;                     // never two marks at once (converge + diverge on one Echo is impossible)
    const kind = this.fateNext; this.fateNext = kind === 'converge' ? 'diverge' : 'converge';
    if (!p.echo.active) p.forceEcho();
    p.echo.pinned = true;
    const E = p.echo;
    this.keepEchoOnFloor(E);
    const dur = F.dur * this.wmul, conv = kind === 'converge';
    const dR = this.divergeR();
    p.addStatus(kind, dur, { stacks: 1 });
    Banner.show(conv ? 'FATE — CONVERGE' : 'FATE — DIVERGE', conv ? 'Be on your Echo when it ends' : 'Be ' + Math.round(dR) + ' m from your Echo when it ends', { cls: 'violet', dur: 1.6 });
    sfx('bell', { f: conv ? 330 : 247 }); sfx('echo');
    const tg = Telegraphs.spawn({ shape: 'circle', x: E.x, z: E.z, r: conv ? F.convergeR : dR, windup: dur, rawWindup: true, color: 'violet',
      soak: conv, soakDmg: 0, dmg: F.dmg, source: conv ? 'Fate — Converge' : 'Fate — Diverge', silent: true, avoidable: true, flashK: 0.35, wide: !conv, tag: 'fate',
      follow: (t) => { const e = Game.player.echo; if (e.active) { t.x = e.x; t.z = e.z; } if (!conv) t.r = Math.min(t.r, this.divergeR()); },
      onResolve: (t, inside) => this.resolveFate(kind, inside) });
    this.fate = { kind, t: 0, dur, tg, tick: 3, ex: E.x, ez: E.z };
    if (!this.hintFate) { this.hintFate = true; Hint.show(conv ? 'CONVERGE: be on your Echo (Recall works) when the mark ends. Its circle is safe from your Shadow.' : 'DIVERGE: be ' + Math.round(dR) + ' m away from your Echo when the mark ends.', 4, 'aurFate' + kind); }
    return 0;
  }
  /** Diverge distance: 12 m, but never more than the (shrinking) clock face allows — on the r 10 face a
   *  centred Echo would otherwise make the mark impossible (the far edge is only 10 m away) */
  divergeR() { return Math.min(this.M.fate.divergeR, Math.max(6, (this.arena.radius - 0.8) * 0.85)); }
  /** a marked Echo must stand on floor that still exists (the face breaks under it in Phase III) */
  keepEchoOnFloor(E) {
    const R = this.arena.radius - 1.2, r = Math.hypot(E.x, E.z);
    if (r <= R || r < 1e-3) return false;
    E.x *= R / r; E.z *= R / r;
    const p = Game.player; p.echoModel.root.position.set(E.x, 0, E.z); p.echoRing.position.set(E.x, 0.04, E.z);
    if (this.fate) { this.fate.ex = E.x; this.fate.ez = E.z; }
    return true;
  }
  resolveFate(kind, inside) {
    const F = this.M.fate, p = Game.player;
    const failed = kind === 'converge' ? !inside : inside;
    this.endFate();
    if (!p || !p.alive) return;
    if (failed) { p.addStatus('stunned', F.stun); Game.stats.mechanicsFailed++; Stamp.show('FATE SEALED', 'violet'); sfx('slam'); CamRig.addTrauma(0.3); }
    else { Stamp.show('FATE DEFIED', 'violet'); }
    Particles.burst(AUR_V[0].set(p.echo.x, 1, p.echo.z), 60, 0xe0c0ff, AUR_VIOLET, 6, 0.7, 0.25, 0, { intensity: 2.4 });
  }
  endFate() {
    const p = Game.player, f = this.fate; this.fate = null;
    if (p) { p.removeStatus('converge'); p.removeStatus('diverge'); p.clearMarkRing(); if (p.echo.active) { p.echo.pinned = false; p.echo.life = Math.min(p.echo.life, 1.5); } }
    this.arena.fateBeam.visible = false;
    if (f && f.tg && f.tg.active && !f.tg.resolved) f.tg.cancel();
  }

  /** PARADOX BELL: hits only if you hold 5 Fractures when it tolls */
  ab_bell() {
    const Bl = this.M.bell;
    this.startCast('Paradox Bell', Bl.cast, { stingF: 233, onComplete: () => this.bellToll() });
    this.pose('bell', 6); this.bell.visible = true; this.bellK = 0;
    Banner.show('PARADOX BELL', 'SPEND YOUR FRACTURES', { cls: 'violet', dur: 1.6 });
    if (!this.hintBell) { this.hintBell = true; Hint.show('The Bell hits only if you hold 5 Fractures. ' + Input.keyLabel('shatter') + ' before it tolls.', 4, 'aurBell'); }
    return Bl.cast * this.windupMul + 0.2;
  }
  bellToll() {
    const Bl = this.M.bell, p = Game.player;
    sfx('bell', { f: 110 }); sfx('bell', { f: 82 }); CamRig.addTrauma(0.25); Post.kickBloom(0.2, 0.4);
    this.bell.getWorldPosition(AUR_V[0]);
    Particles.burst(AUR_V[0], 120, 0xe8d0ff, AUR_VIOLET, 10, 0.8, 0.25, 0, { intensity: 2.2 });
    GroundFX.ring(this.pos.x, this.pos.z, 2, 22, 0xc090ff, 0.9, 0.6, 2.4);
    if (p && p.alive && p.fractures >= 5) {
      p.damage({ amount: Bl.dmg, source: 'Paradox Bell', avoidable: true });
      Stamp.show('YOU HOARD TIME', 'red'); Game.stats.mechanicsFailed++;
    }
    this.after(0.6, () => { this.bell.visible = false; if (this.rig.name === 'bell') this.pose('idle', 3); });
  }

  // ------------------------------------------------------------ Your Shadow (P2)
  updateShadow(dt) {
    const S = this.M.shadow, p = Game.player, T = this.trail;
    const live = this.shadowOn && Game.state === 'fight' && !this.transitioning && this.alive;
    this.shadowA = damp(this.shadowA, live ? 1 : 0, 3, dt);
    if (!live) { if (this.shadowA < 0.02) { T.n = 0; } return; }
    p.history.sampleAgo(S.delay, AUR_HIST);
    if (!AUR_HIST.valid || Game.time - this.shadowStart < S.delay) return;
    const sx = AUR_HIST.x, sz = AUR_HIST.z;
    this.shadowPos = this.shadowPos || new THREE.Vector3();
    const prevX = this.shadowPos.x, prevZ = this.shadowPos.z;
    this.shadowPos.set(sx, 0, sz);
    if (Math.hypot(sx - prevX, sz - prevZ) > 0.002) this.shadowYaw = Math.atan2(sx - prevX, sz - prevZ);
    T.acc += dt;
    if (T.acc >= 0.05) {
      T.acc = 0;
      const pi = (T.head + 63) % 64;          // a dash covers ≤ 2.5 m per sample; anything longer is a teleport
      T.brk[T.head] = T.n > 0 && Math.hypot(sx - T.x[pi], sz - T.z[pi]) > 3.0 ? 1 : 0;
      T.x[T.head] = sx; T.z[T.head] = sz; T.t[T.head] = Game.time; T.head = (T.head + 1) % 64; if (T.n < 64) T.n++;
    }
    // damage: touching any part of the trail younger than its 3 s life
    if (T.lockT > 0) T.lockT -= dt;
    // a CONVERGE mark's circle is sanctuary from your Shadow: the Echo stands on your own past path, so without
    // this the Shadow walks over it 4 s later and standing on the mark becomes 150 every 0.5 s (no fair answer)
    const sanct = this.fate && this.fate.kind === 'converge' && p.echo.active && Math.hypot(p.pos.x - p.echo.x, p.pos.z - p.echo.z) < this.M.fate.convergeR + 0.4;
    if (p.alive && T.lockT <= 0 && T.n > 1 && !sanct) {
      const px = p.pos.x, pz = p.pos.z, hw = S.halfWidth + 0.3;
      let hit = false;
      for (let k = 0; k < T.n - 1 && !hit; k++) {
        const i = ((T.head - 1 - k) % 64 + 64) % 64, j = ((T.head - 2 - k) % 64 + 64) % 64;
        if (Game.time - T.t[j] > S.life) break;
        if (T.brk[i]) continue;
        const ax = T.x[i], az = T.z[i], bx = T.x[j], bz = T.z[j], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-6;
        const u = clamp01(((px - ax) * dx + (pz - az) * dz) / L2);
        if (Math.hypot(px - ax - dx * u, pz - az - dz * u) < hw) hit = true;
      }
      if (hit) {
        T.lockT = S.lock;
        const got = p.damage({ amount: S.dmg, source: 'Your Shadow', avoidable: true, tick: true });
        if (got > 0) Particles.burst(AUR_V[0].set(px, 0.5, pz), 24, 0xd8b0ff, 0x3a0060, 4, 0.5, 0.25, 0, { intensity: 2 });
        if (!this.hintShadow) { this.hintShadow = true; Hint.show('YOUR SHADOW replays your path from 4 s ago. Never retrace your steps.', 4, 'aurShadow'); }
      }
    }
  }
  syncShadow() {
    const T = this.trail, vis = this.shadowA > 0.02 && this.shadowPos && T.n > 0;
    this.shadowFig.root.visible = !!vis; this.trailMesh.visible = !!vis && T.n > 1;
    if (!vis) return;
    const p = Game.player;
    p.copyPoseTo(this.shadowFig);
    this.shadowFig.root.position.set(this.shadowPos.x, 0, this.shadowPos.z);
    this.shadowFig.root.rotation.set(0, this.shadowYaw || 0, 0);
    this.shadowMat.uniforms.uAlpha.value = this.shadowA;
    // ribbon: oldest → newest
    const g = this.trailMesh.geometry, pa = g.attributes.position.array, ua = g.attributes.uv.array, aa = g.attributes.aA.array, life = this.M.shadow.life, hw = this.M.shadow.halfWidth;
    const n = T.n;
    for (let k = 0; k < 64; k++) {
      const kk = Math.min(k, n - 1), i = ((T.head - n + kk) % 64 + 64) % 64;
      const iPrev = ((T.head - n + Math.max(0, kk - 1)) % 64 + 64) % 64, iNext = ((T.head - n + Math.min(n - 1, kk + 1)) % 64 + 64) % 64;
      let tx = T.x[iNext] - T.x[iPrev], tz = T.z[iNext] - T.z[iPrev]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const x = T.x[i], z = T.z[i], age = Game.time - T.t[i];
      const iN = ((T.head - n + kk + 1) % 64 + 64) % 64, gap = T.brk[i] || (kk + 1 < n && T.brk[iN]);
      const a = (k < n && !gap ? clamp01((life - age) / 0.6) * clamp01(age / 0.15 + 0.6) : 0) * this.shadowA;
      pa.set([x - tz * hw, 0.045, z + tx * hw, x + tz * hw, 0.045, z - tx * hw], k * 6);
      ua.set([kk / 63, 0, kk / 63, 1], k * 4);
      aa[k * 2] = a; aa[k * 2 + 1] = a;
    }
    g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.attributes.aA.needsUpdate = true;
  }

  // ------------------------------------------------------------ STOPPED CLOCK (intermission)
  /** Game.prewarmFight hook: one hidden anchor crystal so its arcane program compiles at fight start, not when
   *  the Stopped Clock begins (the real anchors' materials share the program through the same cache key) */
  prewarm() {
    if (this._anchorTpl) return;
    const cm = makeArcane({ color: 0x140a24, roughness: 0.08, metalness: 0.35, emissive: 0x5a2090, emissiveIntensity: 0.6, flatShading: true }, { rim: 1.3, rimColor: AUR_GOLD, crackColor: AUR_GOLD, crackScale: 1.4, key: 'aurAnchor', occluder: true });
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), cm); m.visible = false; m.frustumCulled = false;
    scene.add(m); this._anchorTpl = m;
  }
  spawnAnchors() {
    const SC = this.M.stoppedClock, B = CONFIG.bosses[2], R = SC.anchorR;
    this.killAnchors();
    const gen = ++this.anchorGen;
    const hp = Math.round(B.anchorHp * Math.min(1, Game.diff.hp));
    const spots = [[0, -R, 0, 'N'], [0, R, 0, 'S'], [R, 0, 1, 'E'], [-R, 0, 1, 'W']];
    this.anchors = [];
    for (const [x, z, pair, nm] of spots) {
      const crystal = new THREE.Group();
      const cm = makeArcane({ color: 0x140a24, roughness: 0.08, metalness: 0.35, emissive: 0x5a2090, emissiveIntensity: 0.6, flatShading: true }, { rim: 1.3, rimColor: AUR_GOLD, crackColor: AUR_GOLD, crackScale: 1.4, key: 'aurAnchor', occluder: true });
      const gm = this.goldMat;
      const ob = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), cm); ob.scale.set(0.85, 2.7, 0.85); ob.position.y = 3.1; crystal.add(ob);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.6, 0.55, 6), gm); base.position.y = 0.28; crystal.add(base);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, 0.6) })); ring.rotation.x = Math.PI / 2; ring.position.y = 3.1; crystal.add(ring);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), makeHexShieldMaterial({ color: AUR_VIOLET })); sh.scale.set(1.9, 3.6, 1.9); sh.position.y = 3.0; sh.visible = false; sh.renderOrder = 9; crystal.add(sh);
      const a = spawnBossAdd({ x, z, hp, radius: 1.3, speed: 0, color: AUR_GOLD, name: 'ANCHOR ' + nm, height: 5.2, size: 1.6, mesh: crystal,
        data: { anchor: true, pair, gen, cm, ring, sh, ob, rise: 0 },
        update: (ad, dt) => { ad.data.rise = Math.min(1, ad.data.rise + dt / 1.2); },
        onSync: (ad) => {
          const d = ad.data, vul = d.pair === this.vulnPair, t = Game.realTime;
          crystal.position.y = (easeOutCubic(d.rise) - 1) * 5.5;
          d.ob.rotation.y = t * 0.6 + ad.i; d.ring.rotation.z = t * 1.4;
          d.cm.userData.arcane.uRimColor.value.set(vul ? AUR_GOLD : AUR_VIOLET);
          d.cm.emissive.setRGB(vul ? 0.55 : 0.25, vul ? 0.32 : 0.08, vul ? 0.08 : 0.45).multiplyScalar(0.6 + 0.25 * Math.sin(t * 4 + ad.i));
          d.cm.userData.arcane.uFlash.value = ad.flashV * 0.3;   // the near anchor sits under the camera: a full flash + bloom blanks the screen
          d.ring.material.color.setRGB(vul ? 2.0 : 0.9, vul ? 1.3 : 0.4, vul ? 0.45 : 1.9);
          d.sh.visible = !vul && ad.alive;
          if (d.sh.visible) d.sh.material.uniforms.uAlpha.value = 0.75;
        },
        onDeath: (ad) => this.onAnchorDeath(ad, gen) });
      if (!a) continue;
      a.data.cm = cm;
      a._mats = [cm, ring.material, sh.material];
      this.anchors.push(a);
      // linked pairs share HP; Zero Hour's add-wipe can't destroy them (only its 2400 to the vulnerable pair)
      a.kill = (byUlt) => { if (byUlt && a.data.anchor && a.data.gen === this.anchorGen && !a.data.allowKill) return; Object.getPrototypeOf(a).kill.call(a, byUlt); };
      a.takeDamage = (amt, info) => {
        if (!a.alive || a.invuln) return 0;
        const got = Math.min(a.hp, amt);
        a.hp -= amt; a.flashV = 1;
        for (const o of this.anchors) if (o !== a && o.alive && o.data.pair === a.data.pair) { o.hp = Math.max(0, a.hp); o.flashV = 1; }
        if (a.hp <= 0) {
          a.hp = 0;
          for (const o of this.anchors) if (o.alive && o.data.pair === a.data.pair) { o.data.allowKill = true; o.killedByPlayer = true; o.kill(false); }
        }
        return got;
      };
      Particles.burst(AUR_V[0].set(x, 0.5, z), 80, 0xffe6a0, AUR_GOLD, 7, 1.0, 0.3, -6, { up: 6, intensity: 2.2 });
      Rubble.spawn(x, 0.3, z, 0, 5, 0, { life: 1.6, scale: 0.6 });
    }
    this.applyVuln();
    for (const t of this.tethers) t.visible = true;
  }
  applyVuln() {
    const SC = this.M.stoppedClock;
    for (const a of this.anchors) if (a.alive) a.dmgTakenMul = a.data.pair === this.vulnPair ? 1 : SC.phasedMul;
    this.tethers.forEach((t, i) => { t.material.uniforms.uColor.value.set(i === this.vulnPair ? AUR_GOLD : AUR_VIOLET); t.material.uniforms.uInt.value = i === this.vulnPair ? 1.8 : 0.7; });
  }
  onAnchorDeath(a, gen) {
    if (gen !== this.anchorGen) return;
    ShardFX.explode(a.hitPoint, 40, 12, 0xffe0a0, { spread: 1.2, scale: 0.6, intensity: 2 });
    sfx('grandShatter'); CamRig.addTrauma(0.25);
    const pair = a.data.pair, partnerAlive = this.anchors.some((o) => o.alive && o.data.pair === pair);
    if (!partnerAlive && this.tethers[pair]) this.tethers[pair].visible = false;
    if (this.imActive && !this.anchors.some((o) => o.alive)) {
      this.imActive = false; this.cast = null;
      Stamp.show('THE CLOCK RESTARTS', 'gold');
      this.after(0.8, () => this.advancePhase(), { keep: true });
    }
  }
  /** ZERO HOUR: 2400 to each vulnerable anchor (kills the vulnerable pair) */
  onZeroHour(anchorDmg) {
    if (this.phase !== 2) return;
    for (const a of this.anchors.slice()) if (a.alive && a.data.pair === this.vulnPair) dealDamage(a, anchorDmg, { kind: 'grand', source: 'Zero Hour' });
  }
  killAnchors() {
    for (const a of this.anchors) {
      if (a.data) a.data.anchor = false;
      delete a.kill; delete a.takeDamage;
      if (a.alive) { a.onDeath = null; a.kill(false); }
    }
    // free each crystal (materials AND its four geometries, and detach it from the pooled add) after its death fade;
    // a teardown inside that 0.5 s drops the timer (Timers.clear), so dispose() flushes whatever is still pending
    for (const a of this.anchors) if (a._mats) {
      const job = { a, custom: a.custom, ms: a._mats }; a._mats = null;
      (this._anchorFree || (this._anchorFree = [])).push(job);
      Timers.after(0.5, () => this.freeAnchor(job));
    }
    this.anchors = [];
    for (const t of this.tethers) t.visible = false;
  }
  freeAnchor(job) {
    const L = this._anchorFree, i = L ? L.indexOf(job) : -1; if (i < 0) return; L.splice(i, 1);
    for (const m of job.ms) m.dispose();
    if (job.custom) {
      job.custom.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
      if (job.a.custom === job.custom) { job.a.group.remove(job.custom); job.a.custom = null; }
    }
  }
  startStoppedClock() {
    const SC = this.M.stoppedClock;
    this.imActive = true; this.vulnPair = 0; this.swapT = SC.swap; this.applyVuln();
    this.setShield(true, { color: AUR_VIOLET, scale: 5.6 });
    this.pose('shield', 4);
    this.startCast('STOPPED CLOCK', SC.dur, { raw: true, sting: false, onComplete: () => this.bigCrunch() });
    this.arena.tween('clockOn', 1, 0.8); this.arena.clockU.uCol.value.setRGB(1.0, 0.72, 0.3); this.arena.FU.uTimerCol.value.setRGB(1.0, 0.72, 0.3);
    this.arena.FU.uTimerOn.value = 1;
    Banner.show('STOPPED CLOCK', 'Break the gold Anchors — 35 s', { cls: 'gold', dur: 1.8 });
    if (!this.hintIm) { this.hintIm = true; Hint.show('Only the GOLD pair can be hurt; the pairs swap every 7.5 s. Zero Hour kills the gold pair.', 5, 'aurAnchors'); }
  }
  updateStoppedClock(dt) {
    if (!this.imActive) return;
    const SC = this.M.stoppedClock, c = this.cast;
    const frac = c && c.name === 'STOPPED CLOCK' ? c.t / c.dur : 1;
    this.arena.clockU.uFrac.value = frac; this.arena.FU.uTimer.value = frac;
    this.swapT -= dt;
    if (this.swapT <= 0) {
      this.swapT += SC.swap; this.vulnPair = 1 - this.vulnPair; this.applyVuln();
      sfx('bell', { f: 220 }); sfx('chime', { degree: this.vulnPair ? 4 : 0 });
      Banner.show(this.vulnPair ? 'EAST + WEST' : 'NORTH + SOUTH', 'The anchors swap', { cls: 'gold', dur: 0.9 });
      for (const a of this.anchors) if (a.alive) GroundFX.ring(a.pos.x, a.pos.z, 0.5, 3.5, a.data.pair === this.vulnPair ? AUR_GOLD : AUR_VIOLET, 0.6, 0.4, 2.6);
    }
  }
  bigCrunch() {
    const SC = this.M.stoppedClock, p = Game.player;
    if (!this.imActive) return;
    this.imActive = false;
    Banner.show('BIG CRUNCH', null, { cls: 'gold', dur: 1.4 });
    sfx('grandShatter'); sfx('rumble', { dur: 2 }); CamRig.addTrauma(0.7); Post.kickBloom(0.4, 0.8);
    Particles.converge(AUR_V[0].set(0, 4, 0), 300, 18, 0xffe0f8, AUR_MAG, 0.9, 0.3, { intensity: 2.4 });
    if (this.story) {
      if (p && p.alive) p.damage({ amount: SC.storyDmg, source: 'Big Crunch', avoidable: false, raw: true });
      for (const a of this.anchors) a.data.allowKill = true;
      this.after(1.0, () => this.advancePhase(), { keep: true });
    } else this.wipe('Big Crunch');
  }
  /** unavoidable wipe (Big Crunch / Final Hour / Heat Death); god mode survives for tests */
  wipe(source) {
    const p = Game.player; if (!p || !p.alive) return;
    p.iframeT = 0;
    p.damage({ amount: 99999, source, avoidable: false, raw: true });
    if (p.alive && !Game.god) { p.hp = 0; p.die(source); }
  }

  // ------------------------------------------------------------ COLLAPSE (P3)
  sp_break1() { this.platformBreak(this.M.collapse.breaks[0][1], 2); }
  sp_break2() { this.platformBreak(this.M.collapse.breaks[1][1], 1); }
  platformBreak(newR, ringIdx) {
    const C = this.M.collapse, ar = this.arena, oldR = ar.radius;
    Banner.show('THE CLOCK FACE BREAKS', 'Get inside the ring', { cls: 'gold', dur: 1.6 });
    sfx('rumble', { dur: C.warn + 1 }); CamRig.addTrauma(0.3);
    if (!this.hintFall) { this.hintFall = true; Hint.show('The red rim is falling into the singularity. Move inside before it drops.', 3.5, 'aurFall'); }
    Telegraphs.spawn({ shape: 'donut', x: 0, z: 0, r: oldR + 0.4, inner: newR, windup: C.warn, rawWindup: true, color: 'red', dmg: 0, source: 'The Fall', wide: true, flashK: 0.25, tag: 'fall',
      onResolve: () => this.resolveBreak(newR, ringIdx) });
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; Particles.burst(AUR_V[0].set(Math.sin(a) * newR, 0.3, Math.cos(a) * newR), 10, 0xffb0a0, 0xff3010, 3, 0.8, 0.25, 0, { flat: true, intensity: 2 }); }
  }
  resolveBreak(newR, ringIdx) {
    const ar = this.arena, p = Game.player;
    ar.fall(ringIdx);
    sfx('explode'); sfx('grandShatter'); CamRig.addTrauma(0.55); Post.kickBloom(0.25, 0.6);
    for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, r = newR + fxRange(0.5, 4); Rubble.spawn(Math.sin(a) * r, 0.3, Math.cos(a) * r, fxRange(-2, 2), fxRange(2, 6), fxRange(-2, 2), { life: 2.2, scale: fxRange(0.5, 1.1) }); }
    const outside = p && p.alive && Math.hypot(p.pos.x, p.pos.z) > newR - 0.35;
    if (outside) this.playerFall(newR); else ar.radius = Math.min(ar.radius, newR);   // two breaks resolving together may land in either order
  }
  /** falling off: 30% max HP, respawn at the centre after a 1 s fade (not instant death) */
  playerFall(newR) {
    const C = this.M.collapse, p = Game.player, ar = this.arena;
    if (!p || !p.alive || this._falling) { ar.radius = Math.min(ar.radius, newR); return; }
    this._falling = true;
    p.invulnFlags++; Game.inputLocked = true; p.dashing = false;
    const fx = p.pos.x, fz = p.pos.z;
    ar.noClamp = true;
    Particles.burst(AUR_V[0].set(fx, 0.5, fz), 60, 0xffd0f0, AUR_MAG, 5, 0.8, 0.3, -10, { intensity: 2 });
    sfx('whoosh', { f: 900, f1: 120, dur: 0.9, vol: 0.3 });
    let t = 0;
    const fade = () => { t += 1 / 30; ar.setFade(Math.min(1, t / 0.45)); p.pos.y = -t * t * 9; if (t < C.fade) Timers.after(1 / 30, fade, { tag: 'aurFall' }); };
    fade();
    Timers.after(C.fade, () => {
      ar.noClamp = false; ar.radius = Math.min(ar.radius, newR);
      p.invulnFlags = Math.max(0, p.invulnFlags - 1);
      p.pos.set(0, 0, 4.5); p.prevPos.copy(p.pos); p.knockV.set(0, 0, 0);
      if (Game.state === 'fight') Game.inputLocked = false;
      this._falling = false;
      p.iframeT = 0;
      p.damage({ amount: Math.round(p.maxHp * C.fallFrac), source: 'The Fall', avoidable: true, raw: true });
      Game.stats.mechanicsFailed++;
      GroundFX.ring(0, 4.5, 0.3, 3, 0xffc0f4, 0.5, 0.3, 2.6);
      let u = 0; const unfade = () => { u += 1 / 30; ar.setFade(Math.max(0, 1 - u / 0.4)); if (u < 0.4) Timers.after(1 / 30, unfade, { tag: 'aurFall' }); };
      unfade();
    }, { tag: 'aurFall' });
  }
  updateEntropy(dt) {
    if (this.phase !== 3 || Game.state !== 'fight' || this.transitioning || !this.alive) return;
    this.entT += dt;
    if (this.entT >= this.M.entropyEvery) {
      this.entT -= this.M.entropyEvery;
      const p = Game.player; if (!p || !p.alive) return;
      const n = p.statusStacks('entropy') + 1;
      p.addStatus('entropy', Infinity, { stacks: n });
      GroundFX.ring(p.pos.x, p.pos.z, 0.4, 2.4, 0xc56bff, 0.5, 0.25, 2.4);
      sfx('fracture', { n: 0 });
      if (n === 1) Hint.show('ENTROPY: +6% damage taken per stack. ' + Input.keyLabel('recall') + ' is the only cleanse.', 4, 'aurEntropy');
      if (n >= 3 && n % 2 === 1) Banner.show('ENTROPY ×' + n, 'Recall to cleanse', { cls: 'violet', dur: 0.9 });
    }
  }
  /** FINAL HOUR at 10%: a 15 s channel; Auren is Overexposed (+50% damage taken) */
  sp_finalHour() {
    const FH = this.M.finalHour;
    this.finalHour = true; this.sched.length = 0; this.cast = null; this.busyT = 0;
    Telegraphs.clearAll('numeral'); this.endFate();
    for (let i = 0; i < 12; i++) this.arena.sectorEdge[i] = 0;
    this.addStatus('overexposed', 999);
    this.hands.min.stopAt = aurNumeralRot(12);
    this.pose('channel', 4);
    this.arena.clockU.uCol.value.setRGB(1.0, 0.42, 0.3); this.arena.FU.uTimerCol.value.setRGB(1.0, 0.35, 0.2);
    this.arena.tween('clockOn', 1, 0.6); this.arena.FU.uTimerOn.value = 1;
    Banner.show('FINAL HOUR', 'Overexposed — burn it down', { cls: 'gold', dur: 2.2 });
    Stamp.show('OVEREXPOSED', 'gold');
    sfx('bell', { f: 98 }); sfx('rumble', { dur: 3 }); CamRig.addTrauma(0.35); Post.kickBloom(0.3, 0.8);
    Hint.show('FINAL HOUR: everything you have, now. Zero Hour, Grand Shatter.', 4, 'aurFinal');
    this.startFinalChannel();
  }
  startFinalChannel() {
    const FH = this.M.finalHour;
    this.startCast('FINAL HOUR', FH.dur, { raw: true, stingF: 147, onComplete: () => this.finalHourStrike() });
  }
  finalHourStrike() {
    const FH = this.M.finalHour, p = Game.player;
    if (!this.alive) return;
    sfx('grandShatter'); sfx('bell', { f: 65 }); CamRig.addTrauma(0.8); Post.kickBloom(0.5, 1.0);
    Particles.burst(this.hitPoint, 260, 0xfff0e0, AUR_MAG, 18, 1.2, 0.35, 0, { spread: 2, intensity: 2.2 });
    if (this.story) {
      if (p && p.alive) p.damage({ amount: Math.round(p.maxHp * FH.storyFrac), source: 'Final Hour', avoidable: false, raw: true });
      this.startFinalChannel();
    } else this.wipe('Final Hour');
  }

  // ------------------------------------------------------------ phases
  onPhaseEnter(n, instant) {
    const ar = this.arena;
    this.setHandsFor(n);
    if (n === 1) {
      this.shadowOn = true; this.shadowStart = Game.time; this.trail.n = 0;
      if (instant) { ar.tween('warm', 1, 0); ar.tween('inhale', 0.25, 0); }
      Post.setGrade({ lift: [0.01, 0, 0.02], gain: [1.08, 1.0, 1.04], gamma: [1, 1, 1], sat: 0.88, satKeep: 1 }, instant ? 0 : 1.5);
    }
    if (n === 2) {
      ar.tween('warm', 1, 0); ar.inhale = 0.25;
      if (instant) { this.imPending = true; this.setShield(true, { color: AUR_VIOLET, scale: 5.6 }); this.pose('shield'); this.rig.snap(); }
      else this.startStoppedClock();
    }
    if (n === 3) {
      this.shadowOn = false; this.imPending = false;
      this.p3World(true);
      if (instant) { this.hp = Math.round(this.maxHp * 0.4); this.rig.set('idle').snap(); }
      this.entT = 0;
      Post.setGrade({ lift: [0.01, 0, 0.03], gain: [1.08, 0.98, 1.08], gamma: [1, 1, 1], sat: 0.82, satKeep: 1 }, instant ? 0 : 1.2);
    }
  }
  onPhaseExit(n) {
    this.endFate(); this.rewindEnd(); this.bell.visible = false;
    if (n === 1) this.shadowOn = false;
    if (n === 2) {
      this.imActive = false; this.imPending = false;
      for (const a of this.anchors) if (a.data) a.data.allowKill = true;
      this.arena.FU.uTimerOn.value = 0; this.arena.tween('clockOn', 0, 0.5);
    }
  }
  /** world state of the Collapse: bigger singularity, broken face, warm light */
  p3World(instant) {
    const ar = this.arena, d = instant ? 0 : 2.5;
    ar.tween('bhP3', 1, d); ar.tween('bhSize', AUR_BH.sizeP3, d); ar.tween('broken', 1, d); ar.tween('warm', 1, d); ar.tween('inhale', 0.35, d);
    ar.FU.uTimerOn.value = 0; ar.clockOn = 0;
    this.killAnchors(); this.setShield(false); this.formK = 1;
  }

  /** 70%: PARADOX — the singularity inhales; dolly zoom */
  transition_1() {
    const ar = this.arena, c0 = camera.position.clone(), l0 = CamRig.look.clone();
    this.pose('inhale', 3);
    const final = () => { ar.tween('warm', 1, 0); ar.tween('inhale', 0.25, 0.8); ar.tween('diskInt', 1.15, 0); this.pose('idle', 3); };
    return {
      dur: 4.0, ease: 'inOut', letterbox: true, skippable: true, blendOut: 0.9,
      pos: [c0, [1.5, 6.5, 19], [0.8, 5.6, 15], [0, 5.0, 12]],
      tgt: [l0, [0, 5.2, 0], [0, 5.2, 0], [0, 5.4, 0]],
      fov: [CONFIG.camera.fov, 50, 60, 70], roll: [0, -1, 1, 0],
      events: [
        { t: 0.1, fn: () => { sfx('rumble', { dur: 4 }); ar.tween('inhale', 1, 1.6, 'in'); ar.tween('diskInt', 1.6, 1.6); sfx('whoosh', { f: 200, f1: 2400, dur: 3, vol: 0.3 }); } },
        { t: 0.6, fn: () => { for (let i = 0; i < 6; i++) Timers.after(i * 0.2, () => Particles.converge(AUR_V[0].set(0, 5, -60), 60, 40, 0xffe0f8, AUR_MAG, 1.2, 0.3, { intensity: 2 }), { real: true }); } },
        { t: 1.4, fn: () => { ar.tween('warm', 1, 2.0); CamRig.addTrauma(0.2); Post.kickBloom(0.3, 1.0); } },
        { t: 2.4, fn: () => { PhaseTitle.show('PHASE II', 'PARADOX'); sfx('bell', { f: 165 }); ar.tween('inhale', 0.25, 1.4); } },
      ],
      onDone: () => final(),
    };
  }
  /** 40%: STOPPED CLOCK — shield, the anchors rise, the giant clock */
  transition_2() {
    const ar = this.arena, c0 = camera.position.clone(), l0 = CamRig.look.clone();
    this.pose('shield', 4);
    const final = () => { if (!this.anchors.length) this.spawnAnchors(); this.setShield(true, { color: AUR_VIOLET, scale: 5.6 }); ar.tween('clockOn', 1, 0.6); };
    return {
      dur: 3.8, ease: 'inOut', letterbox: true, skippable: true, blendOut: 0.9,
      pos: [c0, [9, 13, 16], [14, 15, 4], [10, 17, -2]],
      tgt: [l0, [0, 4, 0], [0, 3, 0], [0, 4, 0]],
      fov: [CONFIG.camera.fov, 56, 58, 60], roll: [0, 1.5, -1, 0],
      events: [
        { t: 0.2, fn: () => { this.setShield(true, { color: AUR_VIOLET, scale: 5.6 }); sfx('castSting', { f: 175 }); Post.kickBloom(0.3, 0.6); } },
        { t: 1.0, fn: () => { this.spawnAnchors(); sfx('rumble', { dur: 2 }); CamRig.addTrauma(0.3); } },
        { t: 1.8, fn: () => { ar.tween('clockOn', 1, 0.8); sfx('bell', { f: 131 }); } },
        { t: 2.2, fn: () => { PhaseTitle.show('STOPPED CLOCK', 'BREAK THE ANCHORS'); } },
      ],
      onDone: () => final(),
    };
  }
  /** INTERMISSION → PHASE III: "fall into the hour" */
  transition_3() {
    const ar = this.arena, c0 = camera.position.clone(), l0 = CamRig.look.clone();
    const H = AUR_V[3].set(0, 4.85, 1.1);
    let shieldK = 0;
    const final = () => {
      ar.setFade(0); Post.tunnel = 0; Post.whiteout = 0; GLOBAL_U.uStreak.value = 0; ar.tween('lensK', 1, 0);
      this.p3World(true); this.tw = {}; this.formK = 1; this.heartK = 1; this.pose('idle', 3); this.rig.snap();
    };
    return {
      dur: 5.0, ease: 'linear', letterbox: true, skippable: true, blendOut: 1.0,
      pos: [c0, [3, 7, 14], [0.5, 6.5, 6], [0, 4, -22], [0, 3, -48], [0, 15, 30], [0, 11.5, 19]],
      tgt: [l0, [0, 5, 0], [0, 5, 0], [0, -6, -300], [0, -6, -300], [0, 3, 0], [0, 2.5, 3]],
      fov: [CONFIG.camera.fov, 52, 46, 58, 70, 54, 50], roll: [0, 1, -2, 2, -3, 0, 0],
      events: [
        { t: 0.1, fn: () => { sfx('rumble', { dur: 5 }); if (this.shieldMat) this.shieldMat.uniforms.uBreak.value = 0.5; } },
        { t: 0.45, fn: () => { if (this.shieldMat) this.shieldMat.uniforms.uBreak.value = 1; ShardFX.explode(AUR_V[0].set(0, 4.5, 0), 70, 14, 0xd8b0ff, { spread: 4, scale: 0.6, intensity: 2 }); sfx('grandShatter'); CamRig.addTrauma(0.4); this.setShield(false); } },
        { t: 0.8, fn: () => { this.pose('collapse', 3); this.tween('formK', 0, 0.9); this.tween('heartK', 5, 0.9); sfx('whoosh', { f: 2400, f1: 200, dur: 1, vol: 0.3 }); Particles.converge(AUR_V[0].set(0, 4.9, 0.9), 200, 6, 0xffe0f8, AUR_MAG, 0.8, 0.25, { intensity: 2.4 }); } },
        { t: 1.6, fn: () => { Post.kickBloom(0.7, 0.7); Post.whiteout = 0.22; CamRig.addTrauma(0.5); sfx('explode'); Particles.burst(AUR_V[0].set(0, 4.9, 0.9), 220, 0xffffff, AUR_MAG, 16, 1.0, 0.3, 0, { intensity: 2 }); } },
        { t: 1.9, fn: () => { Post.whiteout = 0.08; this.tween('heartK', 0.05, 0.5); } },
        { t: 2.1, fn: () => { Post.whiteout = 0; ar.tween('lensK', 4, 1.2, 'in'); GLOBAL_U.uStreak.value = 0.6; Post.zoomPulse(1, 0.5, 0.8); sfx('whoosh', { f: 300, f1: 3000, dur: 1.4, vol: 0.35 }); } },
        { t: 2.6, fn: () => { GLOBAL_U.uStreak.value = 1; Post.tunnel = 0.6; Post.zoomPulse(1, 0.5, 0.85); } },
        { t: 3.0, fn: () => { Post.tunnel = 1.0; Post.zoomPulse(1, 0.5, 0.85); } },
        { t: 3.25, fn: () => { ar.setFade(1); } },
        { t: 3.35, fn: () => { this.p3World(true); ar.tween('lensK', 1, 0); GLOBAL_U.uStreak.value = 0; Post.tunnel = 0.5; this.tw = {}; this.formK = 1; this.heartK = 1; this.pose('idle'); this.rig.snap(); } },
        { t: 3.9, fn: () => { let u = 0; const f = () => { u += 1 / 30; ar.setFade(Math.max(0, 1 - u / 0.5)); Post.tunnel = Math.max(0, 0.5 - u); if (u < 0.5) Timers.after(1 / 30, f, { real: true }); }; f(); CamRig.addTrauma(0.35); sfx('slam'); } },
        { t: 4.2, fn: () => { PhaseTitle.show('PHASE III', 'COLLAPSE'); sfx('bell', { f: 110 }); } },
      ],
      onDone: () => final(),
    };
  }

  // ------------------------------------------------------------ enrage: HEAT DEATH
  onEnrage() {
    const HD = this.M.heatDeath;
    Banner.show('HEAT DEATH', 'Every light goes out', { cls: 'gold', dur: 2.4 });
    logEvent('enrage', { name: 'Heat Death' });
    this.cast = null; this.epoch++; Telegraphs.clearAll(); Hazards.clearAll(); Timers.cancelTag('boss');
    this.endFate(); this.rewindEnd(); this.shadowOn = false; this.sched.length = 0; this.imActive = false;
    for (const k in this.hands) this.hands[k].hz = null;
    this.heat = { t: 0, step: 0 };
    sfx('rumble', { dur: 5 });
    this.pose('channel', 2);
  }
  updateEnrage(dt) {
    const HD = this.M.heatDeath, ar = this.arena, h = this.heat; if (!h) return;
    h.t += dt;
    const steps = 7, per = HD.lightsOut / steps;
    while (h.step < steps && h.t >= (h.step + 1) * per) {
      h.step++; ar.lightsOut = h.step; sfx('click'); sfx('tap'); CamRig.addTrauma(0.1);
      if (h.step === 5) this.heartK = 0.05;
    }
    ar.dark = clamp01(h.t / HD.lightsOut) * 0.9;
    if (h.t > HD.lightsOut) {
      Post.whiteout = Math.min(0.95, (h.t - HD.lightsOut) / HD.bleach * 0.95);
      if (h.t > HD.lightsOut + HD.bleach && !h.done) { h.done = true; this.wipe('Heat Death'); }
    }
    if (h.done) { h.after = (h.after || 0) + dt; if (h.after > 1.5) Post.whiteout = Math.max(0.35, Post.whiteout - dt * 0.6); }
  }

  // ------------------------------------------------------------ death → new star → dawn → credits
  onDeathStart() {
    this.killTime = Game.fightTime;
    this.endFate(); this.rewindEnd(); this.shadowOn = false; this.imActive = false; this.killAnchors();
    this.arena.tween('clockOn', 0, 0.5); this.arena.FU.uTimerOn.value = 0;
    this.removeStatus('overexposed');
    for (const k in this.hands) this.hands[k].hz = null;
    this.bell.visible = false;
  }
  deathBeat() {
    const ar = this.arena;
    const dir = ar.st.dir;
    const far = (x, y, z) => [x + dir.x * 300, y + dir.y * 300, z + dir.z * 300];
    return {
      dur: 8.0, ease: 'inOut', letterbox: true, skippable: true, blendOut: 1.2,
      pos: [[0, 6, 16], [1.5, 4.5, 10], [1, 4, 6], [0, 5.5, 4]],
      tgt: [far(0, 6, 16), far(0, 10, 10), far(0, 14, 6), far(0, 22, 4)],
      fov: [54, 52, 56, 62], roll: [0, 1, -0.5, 0],
      events: [
        { t: 0.2, fn: () => { ar.tween('collapse', 0.92, 1.6, 'in'); ar.tween('inhale', 1, 1.4); sfx('rumble', { dur: 2 }); sfx('whoosh', { f: 3000, f1: 100, dur: 1.6, vol: 0.3 }); } },
        { t: 1.85, fn: () => { ar.tween('collapse', 1, 0.15); ar.tween('inhale', 0, 1.5); Post.kickBloom(0.6, 1.2); Post.whiteout = 0.25; Timers.after(0.15, () => { Post.whiteout = 0.1; }, { real: true }); Timers.after(0.35, () => { Post.whiteout = 0; }, { real: true });
          sfx('explode'); sfx('bell', { f: 262 }); sfx('victory'); CamRig.addTrauma(0.4); } },
        { t: 2.2, fn: () => { ar.tween('dawn', 1, 5.8); ar.tween('warm', 0.4, 4); Post.setGrade({ lift: [0.02, 0.01, 0.0], gain: [1.06, 1.0, 0.94], gamma: [1, 1, 1], sat: 1.0 }, 5); Post.setExposure(1.0, 4); } },
      ],
      onDone: () => { ar.tween('collapse', 1, 0); ar.tween('dawn', 1, 0.6); Post.whiteout = 0; },
    };
  }
  /** credits roll over the dawn, then the results card */
  finishVictory() {
    if (this.victoryDone || this.creditsOn) return;
    if (this.killTime) Game.fightTime = this.killTime;
    this.creditsOn = true;
    const done = () => {
      if (!this.creditsOn) return; this.creditsOn = false;
      if (Game.paused) Game.togglePause(false);              // never leave the results card behind a pause menu
      const el = $('aur-credits'); if (el) el.remove();
      window.removeEventListener('keydown', keySkip, true); this._creditsKey = null;
      CamRig.override = null;
      if (this.killTime) Game.fightTime = this.killTime;      // the results card times the fight, not the credits
      Boss.prototype.finishVictory.call(this);
    };
    const keySkip = (e) => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); done(); } };
    this.creditsDone = done;
    const S = Game.stats, best = Save.data.best || {}, diff = Game.difficulty;
    const bt = (i) => { const b = best[i + '_' + diff]; return b ? fmtTime(b.time) + '  ' + b.rank : '—'; };
    const el = document.createElement('div'); el.id = 'aur-credits';
    el.style.cssText = 'position:fixed;inset:0;z-index:45;overflow:hidden;pointer-events:auto;cursor:pointer;background:linear-gradient(90deg,rgba(8,3,18,0) 8%,rgba(8,3,18,.5) 32%,rgba(8,3,18,.5) 68%,rgba(8,3,18,0) 92%),linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,.1) 22%,rgba(0,0,0,.1) 78%,rgba(0,0,0,.6));-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 18%,#000 82%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 18%,#000 82%,transparent 100%)';
    const row = (k, v) => `<div style="display:flex;justify-content:space-between;gap:24px;max-width:360px;margin:4px auto;font-size:15px;letter-spacing:.06em"><span style="opacity:.75">${k}</span><b style="color:#ffd27a">${v}</b></div>`;
    const t = this.killTime || Game.fightTime;
    el.innerHTML = `<div class="roll" style="position:absolute;left:0;right:0;top:100%;text-align:center;color:#f4ecff;font-family:var(--head,Georgia,serif);text-shadow:0 2px 8px #000,0 0 18px rgba(0,0,0,.8);padding:0 16px">
      <div style="font-size:clamp(30px,7vw,54px);letter-spacing:.32em;color:#fff3d8">SHATTERCLOCK</div>
      <div style="font-size:14px;letter-spacing:.5em;opacity:.8;margin-top:6px">A RAID FOR ONE</div>
      <div style="height:48px"></div>
      <div style="font-size:18px;letter-spacing:.24em;color:#ffc0f4">THE UNWOUND HOUR HAS ENDED</div>
      <div style="font-size:14px;opacity:.75;margin-top:8px;font-style:italic">The singularity is a star now. Time runs forward again.</div>
      <div style="height:56px"></div>
      <div style="font-size:13px;letter-spacing:.4em;opacity:.7;margin-bottom:10px">THIS RUN · ${Game.diff.label}</div>
      ${row('Auren defeated in', fmtTime(t))}${row('Damage dealt', Math.round(S.damageDealt).toLocaleString())}${row('Damage taken', Math.round(S.damageTaken).toLocaleString())}
      ${row('Perfect Dodges', S.perfectDodges)}${row('Interrupts', S.interrupts + ' / ' + S.interruptChances)}${row('Grand Shatters', S.grandShatters)}
      ${row('Zero Hours', S.zeroHours)}${row('Healing from Recall', Math.round(S.recallHealing))}${row('Mechanics failed', S.mechanicsFailed)}
      <div style="height:44px"></div>
      <div style="font-size:13px;letter-spacing:.4em;opacity:.7;margin-bottom:10px">THE THREE THRONES · BEST TIMES</div>
      ${row('Pyrrha, the Forge-Warden', bt(0))}${row('Nerith, the Drowned Choir', bt(1))}${row('Auren, the Unwound Hour', bt(2) === '—' ? fmtTime(t) : bt(2))}
      <div style="height:60px"></div>
      <div style="font-size:13px;letter-spacing:.4em;opacity:.7">THE LAST CHRONOBLADE</div><div style="font-size:16px;margin-top:6px">you</div>
      <div style="height:26px"></div>
      <div style="font-size:13px;letter-spacing:.4em;opacity:.7">BUILT WITH</div><div style="font-size:16px;margin-top:6px">Three.js · WebGL · Web Audio</div>
      <div style="height:80px"></div>
      <div style="font-size:22px;letter-spacing:.3em;color:#fff3d8">THANK YOU FOR PLAYING</div>
      <div style="height:30px"></div></div>
      <div style="position:absolute;right:16px;bottom:14px;font-size:12px;letter-spacing:.2em;opacity:.6;color:#fff;font-family:var(--head,Georgia,serif)"><span class="tch">TAP TO SKIP</span><span class="kbd">CLICK / SPACE TO SKIP</span></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); done(); });   // 'click', not 'pointerdown': removing the layer on pointerdown let the click land on the button underneath
    window.addEventListener('keydown', keySkip, true); this._creditsKey = keySkip;
    this.credits = { el, roll: el.querySelector('.roll'), t: 0, dur: 26 };
    HUD.show(false); Letterbox.set(false);
    // a slow crane up into the new dawn
    const c0 = camera.position.clone(), dir = this.arena.st.dir;
    CamRig.override = (dt, cam) => {
      const k = this.credits ? Math.min(1, this.credits.t / this.credits.dur) : 1;
      cam.position.set(c0.x * (1 - k), c0.y + k * 6, c0.z + k * 8);
      AUR_V[2].copy(cam.position).addScaledVector(dir, 100); AUR_V[2].y += 18 + k * 20;
      cam.lookAt(AUR_V[2]);
      if (Math.abs(cam.fov - 60) > 0.01) { cam.fov = 60; cam.updateProjectionMatrix(); }
    };
  }
  updateCredits(dt) {
    const c = this.credits; if (!this.creditsOn || !c) return;
    c.t += dt;
    const h = c.roll.offsetHeight || 1200, vh = window.innerHeight || 720;
    const y = -(c.t / c.dur) * (h + vh * 0.9);
    c.roll.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
    if (c.t >= c.dur + 0.5 && this.creditsDone) this.creditsDone();
  }

  // ------------------------------------------------------------ per-step
  onUpdate(dt) {
    const ar = this.arena;
    this.stepTweens(dt);
    if (this.imPending && this.phase === 2 && Game.state === 'fight' && !this.transitioning) { this.imPending = false; this.spawnAnchors(); this.startStoppedClock(); }
    this.updateHands(dt);
    if (this.phase === 1) this.updateShadow(dt); else if (this.shadowA > 0) { this.shadowA = damp(this.shadowA, 0, 4, dt); }
    if (this.phase === 2) this.updateStoppedClock(dt);
    this.updateEntropy(dt);
    // Rewind ghost: the spot you stood on 5 s ago (live)
    if (this.rewindOn) {
      const c = this.cast;
      if (!c || c.name !== 'Rewind') this.rewindEnd();
      else {
        const p = Game.player; p.history.sampleAgo(this.M.rewind.ago, AUR_HIST);
        if (AUR_HIST.valid) {
          this.ghostAt = this.ghostAt || new THREE.Vector3();
          this.ghostAt.set(AUR_HIST.x, 0, AUR_HIST.z);
          this.ghostRing.material.uniforms.uFrac.value = c.t / c.dur;
        }
      }
    }
    // Fate: keep the Echo pinned, the mark ring + beam on it, a countdown tick
    if (this.fate) {
      const f = this.fate, p = Game.player, E = p.echo;
      f.t += dt;
      if (!E.active && p.alive) { p.forceEcho(); f.ex = E.x; f.ez = E.z; }
      if (E.active) {
        E.pinned = true;
        // the marked Echo is fixed: a dash would normally re-plant it at your feet (that would trivialise both marks)
        if (E.x !== f.ex || E.z !== f.ez) { E.x = f.ex; E.z = f.ez; p.echoModel.root.position.set(E.x, 0, E.z); p.echoRing.position.set(E.x, 0.04, E.z); }
        if (!ar.noClamp) this.keepEchoOnFloor(E);
      }
      p.setMarkRing(AUR_VIOLET, 1 - f.t / f.dur);
      const b = ar.fateBeam; b.visible = E.active; b.position.set(E.x, 0, E.z); b.material.uniforms.uAlpha.value = 0.7 + 0.3 * Math.sin(Game.time * 10);
      const rem = f.dur - f.t;
      if (rem < f.tick && f.tick > 0) { f.tick--; sfx('chime', { degree: 6 - f.tick, octave: 1 }); }
    }
    // the heart lights the floor
    ar.FU.uHeart.value.set(this.pos.x, this.pos.z + 1.0, 0, this.alive ? (6 + this.heartK * 4) * this.formK * (ar.lightsOut >= 5 ? 0 : 1) : 0);
    if (this.creditsOn) this.updateCredits(dt);
  }

  onSync(alpha, dt) {
    const t = Game.realTime, ar = this.arena, p = Game.player;
    // hands follow their angles (scale the minute hand to the shrinking face)
    for (const k in this.hands) { const H = this.hands[k]; H.mesh.rotation.y = H.hz ? H.hz.rot : H.rot; }
    ar.minuteHand.scale.z = Math.min(1, (ar.radius + 0.3) / 19.4);
    // breathing + rings
    this.rig.add('torso', Math.sin(t * 1.3) * 0.02, 0, 0); this.rig.add('head', Math.sin(t * 1.3 + 1) * 0.03, Math.sin(t * 0.6) * 0.06, 0);
    this.rig.add('body', 0, 0, 0, 0, Math.sin(t * 0.9) * 0.08, 0);
    this.ringPulse = Math.max(0, (this.ringPulse || 0) - dt * 2);
    const spin = this.ringSpin * (this.cast ? 1.8 : 1) * (this.finalHour ? 2.5 : 1) * (this.alive ? 1 : 0.2);
    for (let i = 0; i < this.ringObjs.length; i++) {
      const r = this.ringObjs[i];
      r.spin.rotation.y += r.speed * spin * dt;
      r.gim.rotation.x = Math.sin(t * (0.21 + i * 0.07) + r.ph) * r.tiltA;
      r.gim.rotation.z = Math.cos(t * (0.17 + i * 0.05) + r.ph * 1.7) * r.tiltA * 0.8;
      r.tex.offset.x = (r.tex.offset.x + dt * 0.03 * (i % 2 ? -1 : 1) * spin) % 1;
      r.mat.emissiveIntensity = (1.4 + this.ringPulse * 2.5 + (this.cast ? 0.6 : 0) + this.overV * 1.5) * (1 - ar.dark) * this.formK;
      r.gim.scale.setScalar(Math.max(0.01, this.formK));
    }
    this.hem.rotation.y += dt * 0.25;
    // overexposure: shell rim goes white-hot
    this.overV = damp(this.overV, this.hasStatus('overexposed') ? 1 : 0, 3, dt);
    const live = 1 - (this.dissolve || 0);
    this.shellMat.userData.arcane.uRimColor.value.setRGB(1, 0.77, 0.95).lerp(_c1.setRGB(1, 1, 1), this.overV);
    this.shellMat.userData.arcane.uRim.value = (2.4 + this.overV * 1.8) * (1 - ar.dark * 0.9);
    // heart + crown glow
    const fl = 0.85 + 0.15 * Math.sin(t * 5.1) * Math.sin(t * 2.3) + (this.cast ? 0.3 : 0);
    const hk = this.heartK * live;
    this.heartMat.color.setRGB(3.2 * fl * hk, 0.5 * fl * hk + Math.max(0, hk - 1) * 0.5, 2.7 * fl * hk + Math.max(0, hk - 1) * 0.4);
    this.heart.scale.set(1, 1.45, 0.8).multiplyScalar(Math.min(3, 0.6 + hk * 0.4));
    this.glowMat.color.setRGB(2.6, 1.8, 0.8).multiplyScalar(live * (1 - ar.dark) * (0.85 + this.overV * 0.6));
    // body formation (Phase III collapse into the heart)
    const fk = Math.max(0.001, this.formK);
    this.parts_.body.scale.setScalar(this.rig.map.body.s * fk);
    this.hem.scale.setScalar(fk);
    // mirror face: tinted with the player's blade (cyan → gold at 5 Fractures)
    const fr = p ? p.fractures / 5 : 0;
    this.maskMat.uniforms.uTint.value.setRGB(0.37, 0.95, 1.0).lerp(_c1.setRGB(1.0, 0.78, 0.3), fr);
    this.maskMat.uniforms.uFlash.value = this.flashV; this.maskMat.uniforms.uLive.value = live * (1 - ar.dark);
    // the bell
    if (this.bell.visible) {
      const c = this.cast, k = c && c.name === 'Paradox Bell' ? c.t / c.dur : 1;
      this.bell.rotation.z = Math.sin(t * 9) * 0.2 * k; this.bell.position.y = 6.3 + Math.sin(t * 2) * 0.1;
      this.bellMat.emissiveIntensity = 0.3 + k * 2.2;
      if (p && p.fractures >= 5) p.setMarkRing(0xff5050, 1 - k);
      else if (!this.fate) p.clearMarkRing();
    }
    // point light on the heart
    if (this.light) {
      this.heart.getWorldPosition(this.light.position); this.light.position.y += 0.2;
      this.light.position.x += Math.sin(this.visYaw) * 1.5; this.light.position.z += Math.cos(this.visYaw) * 1.5;
      this.light.intensity = this.alive || this.dying ? (7 + 4 * fl) * Math.min(3, hk) * Math.min(1, this.formK * 2) * (ar.lightsOut >= 5 ? 0 : 1) : 0;
      this.light.color.set(AUR_MAG);
    }
    // Rewind ghost
    if (this.rewindOn && this.ghostAt && p) {
      p.copyPoseTo(this.ghost); this.ghost.root.position.copy(this.ghostAt); this.ghost.root.visible = true;
      this.ghostRing.position.set(this.ghostAt.x, 0.05, this.ghostAt.z); this.ghostRing.visible = true;
      this.ghostMat.uniforms.uAlpha.value = 0.55 + 0.25 * Math.sin(t * 12);
    }
    this.syncShadow();
    // portal (intro)
    if (this.portal.visible) this.portal.lookAt(camera.position.x, this.portal.position.y, camera.position.z);
    this.blob.visible = this.alive && this.formK > 0.2;
  }

  dispose() {
    this.killAnchors();
    for (const o of this.extraObjs) { scene.remove(o); o.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); }
    this.ghostMat.dispose(); this.shadowMat.dispose(); this.trailMesh.material.dispose(); this.portalMat.dispose(); this.bellMat.dispose(); this.maskMat.dispose();
    for (const r of this.ringObjs) r.tex.dispose();
    for (const t of this.tethers) t.material.dispose();
    const p = Game.player; if (p) { p.clearMarkRing(); p.pos.y = 0; p.prevPos.y = 0; }
    Timers.cancelTag('aurFall');
    if (this._anchorFree) while (this._anchorFree.length) this.freeAnchor(this._anchorFree[0]);
    if (this._anchorTpl) { scene.remove(this._anchorTpl); this._anchorTpl.geometry.dispose(); this._anchorTpl.material.dispose(); this._anchorTpl = null; }
    if (this.creditsOn) { this.creditsOn = false; const el = $('aur-credits'); if (el) el.remove(); CamRig.override = null; }
    if (this._creditsKey) { window.removeEventListener('keydown', this._creditsKey, true); this._creditsKey = null; }   // torn down mid-roll (Retry / Raid Map): the capture listener must not outlive it
    super.dispose();
  }
  /** formK / heartK / ringSpin tweens (stepped in onUpdate; a direct set via setNow cancels) */
  tween(name, to, dur) { this.tw = this.tw || {}; this.tw[name] = { from: this[name], to, t: 0, dur: Math.max(0.01, dur) }; }
  setNow(name, v) { if (this.tw) delete this.tw[name]; this[name] = v; }
  stepTweens(dt) {
    if (!this.tw) return;
    for (const k in this.tw) { const w = this.tw[k]; w.t += dt; this[k] = lerp(w.from, w.to, smooth01(w.t / w.dur)); if (w.t >= w.dur) { this[k] = w.to; delete this.tw[k]; } }
  }
}

// =============================================================================
//  REGISTRATION + INTRO
// =============================================================================
registerBoss({
  index: 2, key: 'auren', music: 'auren',
  buildArena: (ctx) => buildClockArena(ctx),
  createBoss: (ctx, arena) => new Auren(ctx, arena),
  /** 6 s: fly in from deep space toward the singularity, nearly fall in, pull back as Auren steps out of the event horizon */
  intro(ctx, boss, arena) {
    HUD.show(false);
    boss.formK = 0.001; boss.ringSpin = 0; boss.pose('shield'); boss.rig.snap();
    boss.portal.visible = false;
    const D = (x, y, z) => [x + arena.st.dir.x * 300, y + arena.st.dir.y * 300, z + arena.st.dir.z * 300];
    const open = (to, dur) => { const from = boss.portalMat.uniforms.uOpen.value; let t = 0; const f = () => { t += 1 / 30; boss.portalMat.uniforms.uOpen.value = lerp(from, to, smooth01(t / dur)); if (t < dur) Timers.after(1 / 30, f, { real: true, tag: 'aurIntro' }); }; f(); };
    const finish = () => {
      Timers.cancelTag('aurIntro');
      arena.tween('bhSize', AUR_BH.sizeP1, 0); arena.lensK = 1; GLOBAL_U.uStreak.value = 0;
      boss.tw = {}; boss.formK = 1; boss.ringSpin = 1; boss.portal.visible = false; boss.portalMat.uniforms.uOpen.value = 0;
      boss.pose('idle'); boss.rig.snap();
    };
    return {
      dur: 6.2, ease: 'linear', letterbox: true, skippable: true, blendOut: 1.0,
      pos: [[0, 34, 96], [0, 16, 46], [0, 6, 4], [0, 2.5, -30], [9, 8, -9], [6, 6, 13], [3.5, 6.5, 17]],
      tgt: [D(0, 34, 96), D(0, 16, 46), D(0, 6, 4), D(0, 2.5, -30), [0, 4.5, -2], [0, 5, 0], [0, 4.8, 0]],
      fov: [60, 56, 50, 34, 48, 50, 50], roll: [0, -1.5, 1, -2.5, 1, 0, 0],
      events: [
        { t: 0.05, fn: () => { sfx('rumble', { dur: 3.5 }); sfx('whoosh', { f: 200, f1: 1600, dur: 3, vol: 0.3 }); GLOBAL_U.uStreak.value = 0.5; arena.tween('bhSize', 0.2, 2.6, 'in'); arena.lensK = 2; } },
        { t: 1.2, fn: () => { GLOBAL_U.uStreak.value = 1; } },
        { t: 2.5, fn: () => { arena.tween('bhSize', 0.62, 0.8, 'in'); CamRig.addTrauma(0.25); Post.zoomPulse(1, 0.5, 0.6); } },
        { t: 3.25, fn: () => { arena.tween('bhSize', AUR_BH.sizeP1, 0.9, 'out'); GLOBAL_U.uStreak.value = 0.4; sfx('whoosh', { f: 2400, f1: 300, dur: 0.9, vol: 0.3 }); boss.portal.visible = true; open(1, 0.6); } },
        { t: 3.6, fn: () => { GLOBAL_U.uStreak.value = 0; arena.lensK = 1; sfx('bell', { f: 98 }); } },
        { t: 3.9, fn: () => { boss.tween('formK', 1, 0.9); boss.pose('inhale', 2.5); Particles.burst(AUR_V[0].set(0, 4.8, -1.5), 70, 0xffe0f8, AUR_MAG, 9, 1.0, 0.22, 0, { spread: 2.5, intensity: 1.5 }); CamRig.addTrauma(0.2); } },
        { t: 4.6, fn: () => { open(0, 0.6); boss.tween('ringSpin', 1, 1.2); sfx('castSting', { f: 131 }); } },
        { t: 5.0, fn: () => { Banner.show('AUREN', 'The Unwound Hour', { cls: 'gold', dur: 1.8 }); sfx('bell', { f: 147 }); boss.pose('idle', 2); Post.kickBloom(0.25, 0.8); } },
      ],
      onDone: () => finish(),
    };
  },
});
