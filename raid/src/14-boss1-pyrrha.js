// =============================================================================
//  §14  BOSS 1 — PYRRHA, THE FORGE-WARDEN  (spec §4.1)
//   Arena: obsidian disc (Voronoi magma-vein floor), 4 basalt anvil pylons,
//   domain-warped lava sea, forge sky dome (sun + uNoon), 400 embers, heat haze.
//   Backdrop: VORATH, a 60 m magma titan (≈190 instanced rock plates on a bone rig
//   with 2-bone arm IK) whose hands grip the north rim; he tears out the sun at 60%,
//   slams the arena in phase 3 and sinks into a golden sea when Pyrrha dies.
//   Boss: Pyrrha (procedural basalt colossus + forge hammer, PoseRig poses).
// =============================================================================

// ---------------------------------------------------------------- tuning (Normal) — lives in CONFIG (spec §0.9)
Object.assign(CONFIG.bosses[0], {
  spawn: { x: 0, z: -6 }, playerSpawn: { x: 0, z: 9 },
  tapEvery: 3,          // QA: spec 25/2 s melee chip alone (~1000 over a 2:20 kill) out-damaged the 1000 HP pool → the 'easy' boss was a chip race

  mech: {
    hammerfall: { first: 6, every: 9, windup: 1.4, angle: 100, r: 11, dmg: 450, knock: 4, twinDelay: 0.8, trauma: 0.4 },
    slagRain: { first: 11, every: 15, count: 4, heroicExtra: 1, r: 3.5, windup: 2.0, stagger: 0.3, dmg: 300, flight: 1.25,
      pool: { r: 2.5, tick: 80, every: 0.5, life: 6 } },
    incinerate: { first: 16, every: 24, cast: 2.5, dmg: 300, burn: 8 },
    cinderlings: { first: 4, every: 30, count: 3, hp: 800, speed: 1.7, size: 1.2 },   // QA: spec 2000 HP @ 2.2 m/s was unkillable solo (+30% STOKED every wave, unavoidable); they are also priority targets now
    inOut: { first: 9, every: 12, windup: 2.0, dmg: 450, ringInner: 6, eruptR: 7 },
    palm: { first: 5, every: 16, windup: 2.4, dmg: 600, trauma: 0.6 },
    stomp: { first: 13, every: 16, count: 3, gap: 0.8, tell: 1.0, speed: 10, width: 1.2, dmg: 250 },
    p3IntervalMul: 0.85,
    overheat: { at: 0.10, dur: 6 },
    meltdown: { dur: 6, dps: 2000 },
  },
});
Object.assign(HINTS, {
  'Slag Rain': 'Keep moving: one glob always targets where you stand.',
  'Slag Pool': "Burning pools last 6 s. Don't fight inside them.",
  'Incinerate': 'Violet cast bar = interruptible. Throw your Stasis Lance at Pyrrha before the bar fills.',
  'Forge Ring': 'Red donut: the safe spot is right beside Pyrrha.',
  'Eruption': 'Red circle around Pyrrha: get out, then come back.',
  "Titan's Palm": 'Cross the centre line to the safe half, or dash through on the last beat.',
  'Shockwave Stomp': 'Rings cannot be outrun. Phase Step THROUGH each ring as it reaches you.',
  'Meltdown': 'The forge melts at 3:45. Burst harder: Grand Shatters, Zero Hour, and Cinderlings detonated beside her.',
});

const PYR_EMBER = 0xff6a1c, PYR_HOT = 0xffc070, PYR_DARK = 0x4a1204;

// =============================================================================
//  SHADERS
// =============================================================================
const FORGE_SKY_FS = /* glsl */`
  uniform float uTime; uniform float uStreak; uniform vec3 uFocus; uniform float uOctaves;
  uniform vec3 uSunDir; uniform float uSunSize; uniform float uSunDisc; uniform float uNoon; uniform float uGold; uniform float uCoronaK;
  varying vec3 vDir;
  ${GLSL_NOISE}
  float spark(vec3 d, float scale, float thr){
    vec3 q = d * scale; vec3 id = floor(q); float h = hash13(id);
    if (h < thr) return 0.0;
    vec3 sp = hash33(id + 3.7);
    float dist = length(fract(q) - sp);
    return smoothstep(0.13, 0.0, dist) * (0.55 + 0.45 * sin(uTime * (2.0 + h * 5.0) + h * 40.0));
  }
  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;
    int oct = int(uOctaves + 0.5);
    // ---- dusk palette (ember-black zenith → blood-orange horizon) and white-hot noon palette
    vec3 duskZ = vec3(0.010, 0.003, 0.003), duskM = vec3(0.10, 0.018, 0.010), duskH = vec3(0.62, 0.15, 0.035);
    vec3 noonZ = vec3(0.11, 0.04, 0.022), noonM = vec3(0.38, 0.14, 0.045), noonH = vec3(0.92, 0.42, 0.12);
    vec3 zen = mix(duskZ, noonZ, uNoon), mid = mix(duskM, noonM, uNoon), hor = mix(duskH, noonH, uNoon);
    vec3 col = mix(hor, mid, smoothstep(-0.01, 0.16, h));
    col = mix(col, zen, smoothstep(0.14, 0.75, h));
    col = mix(col, hor * vec3(1.0, 0.55, 0.35) * 0.7, smoothstep(0.0, -0.08, h));      // below the horizon: lava-lit haze
    // ---- smoke bands scrolling sideways (FBM), underlit by the magma
    float az = atan(d.x, -d.z);
    vec2 sp = vec2(az * 2.2 + uTime * 0.010, h * 8.0);
    float warp = fbm(sp * 0.6 + vec2(uTime * 0.006, 0.0), 2);
    float sm = fbm(sp + vec2(warp * 1.6, 0.0), oct);
    float band = smoothstep(0.40, 0.78, sm) * smoothstep(-0.03, 0.05, h) * (1.0 - smoothstep(0.30, 0.75, h));
    vec3 smokeCol = mix(vec3(0.03, 0.008, 0.006), vec3(0.15, 0.06, 0.03), uNoon) + hor * 0.18 * (1.0 - smoothstep(0.0, 0.25, h));
    col = mix(col, smokeCol, band * mix(0.85, 0.6, uNoon));
    float high = smoothstep(0.55, 0.85, fbm(vec2(az * 3.0 - uTime * 0.004, h * 5.0 + 3.0), oct)) * smoothstep(0.15, 0.4, h);
    col = mix(col, smokeCol * 0.6, high * 0.5 * (1.0 - uNoon * 0.6));
    // ---- the sun: disc (when it still sits on the horizon) + corona that follows the held sun
    float ang = acos(clamp(dot(d, uSunDir), -1.0, 1.0));
    vec3 sunC = mix(vec3(3.2, 1.25, 0.28), vec3(2.4, 1.5, 0.7), uNoon);
    float corona = exp(-ang * 7.0) * 0.22 + exp(-ang * 22.0) * 0.55 + exp(-ang * 1.8) * 0.06;
    col += sunC * corona * (0.6 + 0.4 * uNoon) * uCoronaK;
    if (uSunDisc > 0.001 && ang < uSunSize * 1.02) {
      float mu = sqrt(max(1.0 - (ang * ang) / (uSunSize * uSunSize), 0.0));
      float gran = fbm3(d * 260.0 + vec3(0.0, uTime * 0.05, 0.0), 3);
      vec3 disc = vec3(3.4, 1.7, 0.6) * (0.55 + 0.45 * mu) * (0.85 + 0.3 * gran);
      col = mix(col, disc, smoothstep(uSunSize * 1.02, uSunSize * 0.97, ang) * uSunDisc);
    }
    // ---- drifting sparks high in the sky (streak toward uFocus for Zero Hour)
    float s = spark(d, 90.0, 0.985) + spark(d, 190.0, 0.992) * 0.6;
    if (uStreak > 0.01) for (int i = 1; i < 6; i++) { vec3 dd = normalize(d + (d - uFocus) * float(i) * 0.04 * uStreak); s += (spark(dd, 90.0, 0.985)) * (1.0 - float(i) / 6.0) * uStreak; }
    col += vec3(2.2, 0.9, 0.25) * s * smoothstep(0.02, 0.2, h) * (1.0 - uNoon * 0.7);
    // ---- golden calm after the titan falls
    col = mix(col, vec3(dot(col, vec3(0.3, 0.55, 0.15))) * vec3(1.1, 0.72, 0.3) + vec3(0.02, 0.012, 0.0), uGold * 0.65);
    gl_FragColor = vec4(col, 1.0);
  }`;

const LAVA_SEA_VS = /* glsl */`
  varying vec3 vW;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const LAVA_SEA_FS = /* glsl */`
  uniform float uTime; uniform float uOctaves; uniform float uGold; uniform float uRingR; uniform vec2 uRingC; uniform vec3 uHaze;
  uniform vec4 uBulge; uniform float uNoon; uniform float uEdgeR;
  varying vec3 vW;
  ${GLSL_NOISE}
  vec3 lavaRamp(float h){
    vec3 c = mix(vec3(0.030, 0.008, 0.004), vec3(0.42, 0.055, 0.008), smoothstep(0.0, 0.45, h));
    c = mix(c, vec3(1.25, 0.30, 0.035), smoothstep(0.35, 0.75, h));
    c = mix(c, vec3(1.6, 0.62, 0.12), smoothstep(0.72, 1.0, h));
    return c;
  }
  void main(){
    vec2 wp = vW.xz;
    int oct = int(clamp(uOctaves, 2.0, 4.0) + 0.5);
    vec2 p = wp * 0.05;
    float t = uTime;
    // domain-warped FBM (Inigo Quilez style), scrolling crust
    vec2 q = vec2(fbm(p + vec2(0.0, t * 0.020), oct), fbm(p + vec2(5.2, 1.3) - t * 0.016, oct));
    vec2 r = vec2(fbm(p + 3.2 * q + vec2(1.7, 9.2) + t * 0.030, oct), fbm(p + 3.2 * q + vec2(8.3, 2.8) - t * 0.012, oct));
    float f = fbm(p + 2.6 * r, oct);
    float heat = smoothstep(0.34, 0.9, f + 0.25 * r.x - 0.1);
    // crust plates crack along iso-lines → bright seams (only these exceed the bloom threshold)
    float seam = 1.0 - smoothstep(0.0, 0.03 + 0.03 * heat, abs(fract(f * 3.0 + q.x * 0.6) - 0.5));
    float dC = length(wp);
    float nearGlow = exp(-max(dC - uEdgeR, 0.0) * 0.08);                 // hotter under the platform
    heat = clamp(heat + nearGlow * 0.16, 0.0, 1.0);
    vec3 col = lavaRamp(heat * 0.85) + vec3(1.35, 0.42, 0.07) * seam * (0.2 + 0.8 * heat) * (0.55 + 0.45 * nearGlow);
    col = col / (1.0 + max(col.r - 1.1, 0.0) * 0.6);                        // soft-cap the hottest crust so the sea never blooms into a white sheet
    // titan rising / sinking: a glowing bulge
    if (uBulge.w > 0.001) { float b = 1.0 - smoothstep(0.0, uBulge.z, length(wp - uBulge.xy)); col += vec3(3.0, 1.2, 0.3) * b * b * uBulge.w; }
    // golden sea (death beat) + slow shockwave ring
    float lum = dot(col, vec3(0.3, 0.55, 0.15));
    vec3 gold = vec3(0.85, 0.5, 0.14) * (0.06 + min(lum, 1.2) * 0.75) + vec3(1.9, 1.25, 0.45) * seam * 0.45;   // calm molten gold, seams glint
    col = mix(col, gold, uGold);
    if (uRingR > 0.0) { float dr = length(wp - uRingC) - uRingR; col += vec3(2.6, 1.7, 0.6) * exp(-dr * dr / 18.0) * (1.0 - smoothstep(250.0, 420.0, uRingR)); }
    // distance haze toward the sky horizon colour (hides the plane edge)
    float dist = length(vW - cameraPosition);
    col = mix(col, uHaze, smoothstep(110.0, 300.0, dist) * 0.92);
    gl_FragColor = vec4(col, 1.0);
  }`;

// floor: MeshStandardMaterial + onBeforeCompile (Voronoi magma veins, edge darkening, uHeat, palm shadow/heat, meltdown)
function makeMagmaFloorMaterial(R, U) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.12 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uTime: GLOBAL_U.uTime, uOctaves: GLOBAL_U.uOctaves, uR: { value: R } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFloor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloor = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFloor; uniform float uTime; uniform float uOctaves; uniform float uR;\n' +
      'uniform float uHeat; uniform float uMeltR; uniform vec4 uShade; uniform vec4 uHand; uniform vec4 uPalm; uniform float uCool;\n' + GLSL_NOISE + `
      float gVein; float gFine; float gCid; float gEdge; vec2 gWp;
    `).replace('#include <color_fragment>', `#include <color_fragment>
      vec2 fp = vFloor; float fr = length(fp);
      gWp = fp + vec2(vnoise(fp * 0.33), vnoise(fp * 0.33 + 7.3)) * 1.6;
      vec4 vo = voronoi2(gWp * 0.34);
      gCid = hash12(vo.zw);
      gVein = 1.0 - smoothstep(0.008, 0.055, vo.y);
      vec4 vo2 = voronoi2(gWp * 1.25 + 11.0);
      gFine = (1.0 - smoothstep(0.0, 0.045, vo2.y)) * smoothstep(0.25, 0.7, vnoise(gWp * 0.5 + 3.0));
      gEdge = smoothstep(uR - 5.5, uR, fr);
      vec3 obs = vec3(0.030, 0.026, 0.030) * (0.65 + 0.8 * gCid) + vec3(0.02, 0.006, 0.004) * vo.x;
      obs *= 1.0 - 0.75 * gVein;                        // charred vein channels
      obs = mix(obs, obs * 0.35, gEdge);                // distance-to-edge darkening
      float shade = uShade.z * smoothstep(-1.5, 2.5, dot(fp, uShade.xy));
      float hand = uHand.w * (1.0 - smoothstep(0.0, 1.0, length((fp - uHand.xy) / vec2(uHand.z * 0.75, uHand.z * 1.1))));
      float darkK = 1.0 - clamp(shade * 0.7 + hand * 0.6, 0.0, 0.9);
      diffuseColor.rgb = obs * darkK;
    `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(0.62 + 0.2 * gCid + gVein * 0.4 + gEdge * 0.2 + vnoise(gWp * 3.0) * 0.1, 0.05, 1.0);
    `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float pulse = 0.72 + 0.28 * sin(uTime * 3.14159 + gCid * 6.2831);          // 0.5 Hz
        float flow = vnoise(gWp * 1.6 + vec2(0.0, uTime * 0.55)) * 0.6 + vnoise(gWp * 4.0 - uTime * 0.4) * 0.4;
        vec3 magma = mix(vec3(0.85, 0.12, 0.015), vec3(2.2, 0.75, 0.12), flow);
        float heat = 1.0 + uHeat * 0.4;
        float centreFade = 0.6 + 0.4 * smoothstep(1.0, 9.0, fr);
        vec3 em = magma * (gVein * gVein * 0.62 + gFine * 0.18) * pulse * heat * centreFade * (1.0 - gEdge * 0.4);
        em += vec3(1.6, 0.35, 0.04) * smoothstep(uR - 0.9, uR - 0.05, fr) * (0.6 + 0.4 * pulse);      // molten lip
        float shade = uShade.z * smoothstep(-1.5, 2.5, dot(fp, uShade.xy));
        float hand = uHand.w * (1.0 - smoothstep(0.0, 1.0, length((fp - uHand.xy) / vec2(uHand.z * 0.75, uHand.z * 1.1))));
        em *= 1.0 - clamp(shade * 0.55 + hand * 0.5, 0.0, 0.85);
        // Titan's Palm: the impacted half glows white-hot along the hand print, then cools
        if (uPalm.z > 0.001) {
          float side = smoothstep(-0.5, 1.5, dot(fp, uPalm.xy));
          float print = 1.0 - smoothstep(0.0, 1.0, length((fp - uPalm.xy * 11.0) / vec2(7.0, 13.0)));
          float k = uPalm.z * side * (0.12 + 0.6 * print + gVein * 0.7);
          em += mix(vec3(1.3, 0.28, 0.03), vec3(1.9, 1.05, 0.35), uPalm.z * uPalm.z) * k;
        }
        // Meltdown: molten lava swallowing the floor from the rim inward
        if (fr > uMeltR - 1.5) {
          float n = fbm(gWp * 0.35 + vec2(uTime * 0.15, -uTime * 0.1), 3);
          vec3 lava = mix(vec3(0.9, 0.16, 0.02), vec3(2.0, 0.85, 0.18), smoothstep(0.35, 0.8, n));
          float cover = smoothstep(uMeltR - 0.2, uMeltR + 0.4, fr);
          float crust = exp(-abs(fr - uMeltR) * 2.5) * 2.0;
          em = mix(em, lava, cover) + vec3(2.2, 1.1, 0.3) * crust * step(uMeltR, uR);
          diffuseColor.rgb *= 1.0 - cover;
        }
        em *= uCool;
        totalEmissiveRadiance += em;
      }
    `);
  };
  mat.customProgramCacheKey = () => 'magmaFloor';
  return mat;
}

// emissive magma (Vorath's inner body, pools, pylon flames) — instancing-aware
const MAGMA_VS = /* glsl */`
  varying vec3 vW; varying vec3 vN; varying vec3 vV;
  void main(){
    #ifdef USE_INSTANCING
      vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    #else
      vec4 w = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
    #endif
    vW = w.xyz; vV = cameraPosition - w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const MAGMA_FS = /* glsl */`
  uniform float uTime; uniform float uIntensity; uniform float uWhite; uniform float uScale;
  varying vec3 vW; varying vec3 vN; varying vec3 vV;
  ${GLSL_NOISE}
  void main(){
    float fres = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.0);
    float n = fbm3(vW * uScale + vec3(0.0, -uTime * 0.9, uTime * 0.2), 3);
    float n2 = vnoise3(vW * uScale * 3.0 + vec3(0.0, -uTime * 2.0, 0.0));
    vec3 c = mix(vec3(0.9, 0.12, 0.01), vec3(3.2, 1.2, 0.2), smoothstep(0.3, 0.75, n));
    c += vec3(2.0, 1.1, 0.4) * smoothstep(0.7, 0.95, n2);
    c *= 0.65 + 0.7 * fres;
    c = mix(c, vec3(6.0, 5.2, 4.2) * (0.6 + 0.6 * n), uWhite);
    gl_FragColor = vec4(c * uIntensity, 1.0);
  }`;
function makeMagmaMaterial(o) {
  o = o || {};
  return new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL_U.uTime, uIntensity: { value: o.intensity != null ? o.intensity : 1 }, uWhite: { value: 0 }, uScale: { value: o.scale || 0.25 } },
    vertexShader: MAGMA_VS, fragmentShader: MAGMA_FS,
  });
}

// the sun (a real object once Vorath tears it out of the horizon)
const SUN_FS = /* glsl */`
  uniform float uTime; uniform float uIntensity;
  varying vec3 vW; varying vec3 vN; varying vec3 vV;
  ${GLSL_NOISE}
  void main(){
    float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    vec3 p = normalize(vN) * 6.0;
    float g = fbm3(p + vec3(0.0, uTime * 0.25, uTime * 0.1), 4);
    float cells = 1.0 - smoothstep(0.0, 0.08, voronoiEdge3(p * 2.2 + uTime * 0.05, p));
    vec3 c = mix(vec3(2.4, 0.85, 0.18), vec3(3.6, 2.2, 1.0), smoothstep(0.35, 0.75, g));
    c *= 0.55 + 0.45 * pow(mu, 0.6);                     // limb darkening
    c -= vec3(1.0, 0.6, 0.2) * cells * 0.25;
    c += vec3(1.8, 0.6, 0.12) * pow(1.0 - mu, 3.0);       // hot limb
    gl_FragColor = vec4(c * uIntensity, 1.0);
  }`;

// flames on the ignited anvil pylons (additive billboard-ish cone)
const FLAME_VS = /* glsl */`varying vec2 vUv; varying float vNear; void main(){ vUv = uv; vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  vec4 w = modelMatrix * p; vNear = smoothstep(13.0, 24.0, distance(w.xyz, cameraPosition));
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLAME_FS = /* glsl */`
  uniform float uTime; uniform float uAmt;
  varying vec2 vUv; varying float vNear;
  ${GLSL_NOISE}
  void main(){
    float y = vUv.y;
    float n = vnoise(vec2(vUv.x * 7.0, y * 3.0 - uTime * 3.2)) * 0.6 + vnoise(vec2(vUv.x * 15.0 + 3.0, y * 6.0 - uTime * 5.0)) * 0.4;
    float tongues = smoothstep(0.25, 0.7, vnoise(vec2(vUv.x * 11.0, y * 1.6 - uTime * 2.6)) + (1.0 - y) * 0.35);
    float a = smoothstep(1.0, 0.1, y + n * 0.5) * smoothstep(0.0, 0.1, y) * tongues;
    vec3 c = mix(vec3(0.8, 0.16, 0.02), vec3(1.3, 0.62, 0.16), smoothstep(0.55, 0.0, y + n * 0.2)) * a * uAmt * vNear * 0.85;
    gl_FragColor = vec4(c, 1.0);
  }`;

// Pyrrha's own fire (crown, chimney mouths): like FLAME_FS but never faded near the lens and with a hot core
const PYR_FLAME_VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PYR_FLAME_FS = /* glsl */`
  uniform float uTime; uniform float uAmt; uniform float uSeed; uniform vec3 uHot;
  varying vec2 vUv;
  ${GLSL_NOISE}
  void main(){
    float y = vUv.y;
    float n = vnoise(vec2(vUv.x * 8.0 + uSeed, y * 3.0 - uTime * 4.2)) * 0.6 + vnoise(vec2(vUv.x * 17.0 + uSeed * 2.0, y * 7.0 - uTime * 6.5)) * 0.4;
    float a = smoothstep(1.0, 0.1, y + n * 0.55) * smoothstep(0.0, 0.08, y);
    vec3 c = mix(vec3(0.85, 0.18, 0.02), uHot, smoothstep(0.55, 0.0, y + n * 0.2)) * a * uAmt;
    gl_FragColor = vec4(c, 1.0);
  }`;
function makePyrFlameMaterial(seed, hot) {
  return new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uAmt: { value: 1 }, uSeed: { value: seed || 0 }, uHot: { value: new THREE.Color(hot || 0xffb050).multiplyScalar(1.5) } },
    vertexShader: PYR_FLAME_VS, fragmentShader: PYR_FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

// lava seams injected into Pyrrha's basalt (object-space Voronoi, slowly crawling); uVein drives the heat
const PYR_VEIN_GLSL = /* glsl */`
  if (uVein > 0.01) {
    vec3 vcid; float ve = voronoiEdge3(vObjPos * uVeinScale, vcid);
    float crawl = smoothstep(0.3, 0.7, vnoise3(vObjPos * 1.7 + vec3(0.0, -uTime * 0.35, uTime * 0.1)));
    float vk = (1.0 - smoothstep(0.015, 0.06, ve)) * (0.35 + 0.65 * crawl) * step(0.25, hash13(vcid));
    totalEmissiveRadiance += mix(vec3(1.25, 0.24, 0.03), vec3(1.9, 0.9, 0.25), uVeinHot) * vk * uVein;
  }
`;
function veinHook(U, scale) {
  return (shader) => {
    shader.uniforms.uVein = U.uVein; shader.uniforms.uVeinHot = U.uVeinHot; shader.uniforms.uVeinScale = { value: scale };
    shader.fragmentShader = 'uniform float uVein; uniform float uVeinHot; uniform float uVeinScale;\n' +
      shader.fragmentShader.replace('#include <lights_fragment_begin>', PYR_VEIN_GLSL + '\n#include <lights_fragment_begin>');
  };
}

// soft rising smoke (normal-blended points, CPU integrated; a few dozen particles)
class SmokePlume {
  constructor(n, opts) {
    opts = opts || {};
    this.n = n; this.next = 0;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.t = new Float32Array(n).fill(1e9); this.life = new Float32Array(n).fill(1);
    this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.heat = new Float32Array(n); this.rot = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    this.aA = new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    this.aH = new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    this.aR = new THREE.BufferAttribute(new Float32Array(n), 1);
    for (let i = 0; i < n; i++) this.aR.array[i] = Math.random();
    g.setAttribute('position', this.aPos); g.setAttribute('aSize', this.aSize); g.setAttribute('aA', this.aA); g.setAttribute('aH', this.aH); g.setAttribute('aR', this.aR);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: Particles.mat.uniforms.uScale, uTime: GLOBAL_U.uTime, uDark: { value: new THREE.Color(opts.dark || 0x0c0807) }, uLit: { value: new THREE.Color(opts.lit || 0x8a2a08) } },
      vertexShader: /* glsl */`
        attribute float aSize; attribute float aA; attribute float aH; attribute float aR; uniform float uScale;
        varying float vA; varying float vH; varying float vR;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 220.0); vA = aA; vH = aH; vR = aR; }`,
      fragmentShader: /* glsl */`
        uniform vec3 uDark; uniform vec3 uLit; uniform float uTime; varying float vA; varying float vH; varying float vR;
        ${GLSL_NOISE}
        void main(){
          vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; if (r > 1.0 || vA < 0.003) discard;
          float n = vnoise(q * 4.0 + vec2(vR * 17.0, vR * 9.0 - uTime * 0.3)) * 0.6 + vnoise(q * 9.0 + vR * 31.0) * 0.4;
          float a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7) * vA;
          float under = smoothstep(-0.5, 0.5, q.y);           // gl_PointCoord y grows downward: the underside catches the forge light
          vec3 c = mix(uDark, uLit, clamp(vH * (0.35 + 0.65 * under), 0.0, 1.0));
          gl_FragColor = vec4(c * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 6;
    this.alpha = opts.alpha || 0.55;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, heat) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.t[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.heat[i] = heat;
  }
  update(dt, wind) {
    const P = this.aPos.array, S = this.aSize.array, A = this.aA.array, H = this.aH.array;
    for (let i = 0; i < this.n; i++) {
      const t = this.t[i] += dt, L = this.life[i];
      if (t >= L) { A[i] = 0; S[i] = 0; continue; }
      const k = t / L, drag = Math.exp(-0.9 * dt);
      this.v[i * 3] = this.v[i * 3] * drag + (wind ? wind.x : 0.4) * dt; this.v[i * 3 + 2] = this.v[i * 3 + 2] * drag + (wind ? wind.z : 0.15) * dt;
      this.v[i * 3 + 1] = this.v[i * 3 + 1] * Math.exp(-0.5 * dt) + 0.35 * dt;
      for (let a = 0; a < 3; a++) { this.p[i * 3 + a] += this.v[i * 3 + a] * dt; P[i * 3 + a] = this.p[i * 3 + a]; }
      S[i] = lerp(this.s0[i], this.s1[i], 1 - (1 - k) * (1 - k));
      A[i] = this.alpha * Math.min(1, k * 6) * (1 - k) * (1 - k);
      H[i] = this.heat[i] * (1 - k) * (1 - k);
    }
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aA.needsUpdate = this.aH.needsUpdate = true;
  }
  dispose() { this.points.geometry.dispose(); this.mat.dispose(); if (this.points.parent) this.points.parent.remove(this.points); }
}

// =============================================================================
//  VORATH — the magma titan (bone rig + instanced plates)
// =============================================================================
const VOR = {
  base: new THREE.Vector3(0, -8, -70), shoulder: 15, shoulderY: 24, L1: 30, L2: 30,
  palmLen: 9, phal: [4.2, 3.4, 2.8], thumb: [3.6, 3.0],
  sunR: 9, sunDir0: new THREE.Vector3(0.34, 0.14, -0.93).normalize(), sunD: 112,
};

class Vorath {
  constructor(parent) {
    this.parent = parent;
    this.rootY = VOR.base.y; this.lean = 0; this.headPitch = 0; this.crack = 0; this.coreBoost = 0; this.alpha = 1;
    this.tw = {};         // scalar tweens {name: {from,to,t,dur,ease}}
    this.seqs = [];       // timed actions [{t, fn}]
    this.time = 0;
    this.hands = {};
    for (const side of [1, -1]) {
      const k = side > 0 ? 'E' : 'W';
      this.hands[k] = { side, pos: new THREE.Vector3(), fwd: new THREE.Vector3(0, -0.1, 1).normalize(), up: new THREE.Vector3(0, 1, 0), curl: 0.9,
        from: { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(), curl: 0 },
        to: { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(), curl: 0 }, t: 1, dur: 0, ease: 'inOut', onDone: null,
        M: new THREE.Matrix4(), elbow: new THREE.Vector3(), shoulder: new THREE.Vector3() };
    }
    this.sunMode = 'sky'; this.sunPos = VOR.sunDir0.clone().multiplyScalar(VOR.sunD); this.sunVel = new THREE.Vector3(); this.sunScale = 1;
    this.build();
    this.gripPose(true);
  }

  // ------------------------------------------------------------ construction
  build() {
    const g = this.group = new THREE.Group(); g.name = 'vorath'; this.parent.add(g);
    // bones: 0 torso, 1 head, 2 upperE, 3 foreE, 4 handE, 5 upperW, 6 foreW, 7 handW, 8..22 phalanges E, 23..37 phalanges W
    this.boneM = []; for (let i = 0; i < 38; i++) this.boneM.push(new THREE.Matrix4());
    const plates = [], magma = [], horns = [];
    const rnd = mulberry32(7331); const R = (a, b) => a + (b - a) * rnd();
    const Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Vector3(), M = new THREE.Matrix4();
    const plate = (bone, px, py, pz, nx, ny, nz, w, h, d, roll) => {
      N.set(nx, ny, nz).normalize();
      Q.setFromUnitVectors(UP, N); const qr = _q1.setFromAxisAngle(N, roll != null ? roll : R(0, TAU)); Q.premultiply(qr);
      M.compose(P.set(px, py, pz), Q, S.set(w, h, d));
      plates.push({ bone, m: M.clone() });
    };
    // ---- torso: plates over an ellipsoid, with a window over the chest core
    const tc = [0, 13, 0], tr = [12.5, 15, 7.8];
    for (let i = 0; i < 96; i++) {
      const y = 1 - (i + 0.5) / 96 * 1.65, rr = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996;
      const ux = Math.cos(a) * rr, uz = Math.sin(a) * rr;
      const px = tc[0] + ux * tr[0], py = tc[1] + y * tr[1], pz = tc[2] + uz * tr[2];
      if (pz > 2 && Math.abs(px) < 4.8 && py > 8.5 && py < 20.5) continue;           // chest window → the core shows
      plate(0, px, py, pz, ux / tr[0], y / tr[1], uz / tr[2], R(4.2, 6.2), R(1.0, 1.6), R(4.5, 7.0));
    }
    // pauldrons
    for (const s of [1, -1]) for (let i = 0; i < 9; i++) {
      const a = R(-1.2, 1.2), b = R(0.2, 1.4);
      const nx = Math.sin(b) * Math.cos(a) * s, ny = Math.cos(b), nz = Math.sin(b) * Math.sin(a);
      plate(0, s * VOR.shoulder + nx * 5, VOR.shoulderY + ny * 4.5, nz * 5, nx, ny, nz, R(4, 6.5), R(1.2, 1.8), R(4, 6.5));
    }
    // ribs around the core window
    for (let i = 0; i < 5; i++) for (const s of [1, -1]) plate(0, s * R(4.6, 5.6), 9.5 + i * 2.4, R(5.6, 6.6), s * 0.6, 0.1, 1, 2.2, 0.9, R(5, 6.5), s * 0.4);
    // ---- head + brow + jaw
    const hc = [0, 5, 1.2], hr = [4.6, 5.6, 5];
    for (let i = 0; i < 22; i++) {
      const y = 1 - (i + 0.5) / 22 * 1.7, rr = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996;
      const ux = Math.cos(a) * rr, uz = Math.sin(a) * rr;
      const px = hc[0] + ux * hr[0], py = hc[1] + y * hr[1], pz = hc[2] + uz * hr[2];
      if (pz > 3.6 && Math.abs(px) < 3.3 && py > 4.2 && py < 6.4) continue;        // eye band
      plate(1, px, py, pz, ux / hr[0], y / hr[1], uz / hr[2], R(2.4, 3.6), R(0.8, 1.2), R(2.4, 3.6));
    }
    plate(1, 0, 7.2, 5.6, 0, 0.4, 1, 7.5, 1.2, 2.2, 0);                                       // brow
    plate(1, 0, 2.2, 5.0, 0, -0.6, 1, 5.5, 1.4, 2.5, 0);                                       // jaw
    for (let i = 0; i < 7; i++) {                                                               // crown horns
      const a = (i - 3) * 0.33, len = 7 + (3 - Math.abs(i - 3)) * 2.4;
      _v1.set(Math.sin(a) * 3.6, 8.6, Math.cos(a) * 1.2 - 1.2);
      _v2.set(Math.sin(a) * 0.9, 1, -0.35).normalize();
      Q.setFromUnitVectors(UP, _v2);
      horns.push({ bone: 1, m: new THREE.Matrix4().compose(_v1.clone().addScaledVector(_v2, len * 0.45), Q.clone(), new THREE.Vector3(1.3, len, 1.3)) });
    }
    // ---- arms (local +Z along the segment)
    const limb = (bone, L, r0, r1, n) => {
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, r = lerp(r0, r1, t), a = i * 2.39996 + rnd() * 0.5;
        const ux = Math.cos(a), uy = Math.sin(a);
        P.set(ux * r, uy * r, t * L);
        N.set(ux, uy, 0);
        Q.setFromUnitVectors(UP, N); Q.premultiply(_q1.setFromAxisAngle(N, R(-0.3, 0.3)));
        plates.push({ bone, m: new THREE.Matrix4().compose(P.clone(), Q.clone(), new THREE.Vector3(r * R(1.0, 1.4), R(0.9, 1.3), L / n * R(2.2, 3.0))) });
      }
      magma.push({ bone, m: new THREE.Matrix4().compose(new THREE.Vector3(0, 0, L * 0.5), new THREE.Quaternion(), new THREE.Vector3(r0 * 0.85, r0 * 0.85, L * 0.5)) });
    };
    for (const [up, fo] of [[2, 3], [5, 6]]) { limb(up, VOR.L1, 4.4, 3.4, 16); limb(fo, VOR.L2, 3.3, 2.7, 14); }
    // ---- hands: palm (local x right, y back of hand, z toward the fingers; origin = wrist) + fingers
    for (const [hb, side] of [[4, 1], [7, -1]]) {
      for (let i = 0; i < 12; i++) {
        const x = R(-4.4, 4.4), z = R(0.8, 8.4);
        plate(hb, x, 1.3 + R(-0.2, 0.3), z, R(-0.2, 0.2), 1, R(-0.2, 0.2), R(2.6, 3.8), R(0.8, 1.2), R(2.8, 4.2));
      }
      for (const s of [1, -1]) plate(hb, s * 4.9, 0, 4.5, s, 0.1, 0, 2.2, 0.9, 8.5, 0);
      plate(hb, 0, -1.2, 4.5, 0, -1, 0, 8.5, 0.8, 8.5, 0);
      magma.push({ bone: hb, m: new THREE.Matrix4().compose(new THREE.Vector3(0, 0, 4.5), new THREE.Quaternion(), new THREE.Vector3(4.4, 1.3, 4.6)) });
      const first = hb === 4 ? 8 : 23;
      for (let f = 0; f < 5; f++) {
        const L = f < 4 ? VOR.phal : VOR.thumb, rad = f < 4 ? 1.15 - Math.abs(f - 1.5) * 0.08 : 1.25;
        for (let j = 0; j < 3; j++) {
          const bone = first + f * 3 + j;
          if (j >= L.length) continue;
          const len = L[j], rr = rad * (1 - j * 0.12);
          plate(bone, 0, rr * 0.55, len * 0.5, 0, 1, 0, rr * 2.1, rr * 1.0, len * 0.95, 0);
          plate(bone, 0, -rr * 0.35, len * 0.5, 0, -1, 0, rr * 1.7, rr * 0.8, len * 0.8, 0);
          magma.push({ bone, m: new THREE.Matrix4().compose(new THREE.Vector3(0, 0, len * 0.5), new THREE.Quaternion(), new THREE.Vector3(rr * 0.8, rr * 0.8, len * 0.5)) });
          if (j === L.length - 1) {                                                       // claw
            Q.setFromUnitVectors(UP, _v2.set(0, -0.35, 1).normalize());
            horns.push({ bone, m: new THREE.Matrix4().compose(new THREE.Vector3(0, -0.2, len + 0.9), Q.clone(), new THREE.Vector3(rr * 1.1, 2.4, rr * 1.1)) });
          }
        }
      }
    }
    // inner magma for torso / head / eyes
    magma.push({ bone: 0, m: new THREE.Matrix4().compose(new THREE.Vector3(0, 12.5, -0.5), new THREE.Quaternion(), new THREE.Vector3(10.5, 13, 6.4)) });
    magma.push({ bone: 1, m: new THREE.Matrix4().compose(new THREE.Vector3(0, 5, 1.2), new THREE.Quaternion(), new THREE.Vector3(3.9, 4.8, 4.2)) });
    for (const s of [1, -1]) magma.push({ bone: 1, m: new THREE.Matrix4().compose(new THREE.Vector3(s * 1.9, 5.3, 5.6), new THREE.Quaternion(), new THREE.Vector3(0.9, 0.45, 0.5)), eye: true });

    this.plates = plates; this.magmaL = magma; this.hornL = horns;
    // materials
    this.plateMat = makeArcane({ color: 0x241815, roughness: 0.9, metalness: 0.06, flatShading: true }, { rim: 0.9, rimColor: 0xff5a14, crackColor: 0xff4a0a, crackScale: 2.1, key: 'vorathPlate' });
    this.plateMat.userData.arcane.uFracture.value = 0.5;
    this.magmaMat = makeMagmaMaterial({ intensity: 1.0, scale: 0.18 });
    this.hornMat = makeArcane({ color: 0x120c0b, roughness: 0.6, metalness: 0.3, flatShading: true }, { rim: 1.4, rimColor: 0xff7a2a, key: 'vorathHorn' });
    const boxG = new THREE.BoxGeometry(1, 1, 1);
    this.plateMesh = new THREE.InstancedMesh(boxG, this.plateMat, plates.length);
    const col = new THREE.Color();
    for (let i = 0; i < plates.length; i++) this.plateMesh.setColorAt(i, col.setHSL(0.03, 0.25, 0.55 + rnd() * 0.45));
    this.magmaMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), this.magmaMat, magma.length);
    const hornG = new THREE.ConeGeometry(0.5, 1, 6);
    this.hornMesh = new THREE.InstancedMesh(hornG, this.hornMat, horns.length);
    for (const m of [this.plateMesh, this.magmaMesh, this.hornMesh]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(m); }
    // chest core (fresnel + upward-moving emissive noise)
    this.coreMat = makeMagmaMaterial({ intensity: 1.15, scale: 0.35 });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(5.6, 4), this.coreMat); this.core.matrixAutoUpdate = false; g.add(this.core);
    // god rays out of the cracked core (death beat)
    this.rays = new THREE.Group(); this.rays.visible = false; g.add(this.rays);
    const rg = new THREE.ConeGeometry(1, 1, 12, 1, true); rg.translate(0, -0.5, 0); rg.rotateX(-Math.PI / 2);
    this.rayMat = makeBeamMaterial({ color: 0xffc070, intensity: 1.0, len: 40, scroll: 2, soft: 0.3 });
    this.rayMat.side = THREE.DoubleSide;
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(rg, this.rayMat);
      m.userData.dir = new THREE.Vector3(R(-1, 1), R(-0.3, 1), R(0.2, 1)).normalize(); m.userData.w = R(2, 4.5); m.userData.len = R(30, 70);
      this.rays.add(m);
    }
    // the sun
    this.sunMat = new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uIntensity: { value: 1 } }, vertexShader: MAGMA_VS, fragmentShader: SUN_FS });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(VOR.sunR, 48, 32), this.sunMat); this.sun.visible = false; this.parent.add(this.sun);
    this.coronaMat = new THREE.SpriteMaterial({ map: makeRadialTexture(256, [[0, 'rgba(255,240,200,1)'], [0.18, 'rgba(255,190,90,0.85)'], [0.45, 'rgba(255,110,30,0.25)'], [1, 'rgba(255,60,10,0)']]),
      color: new THREE.Color(0.9, 0.55, 0.28), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    this.corona = new THREE.Sprite(this.coronaMat); this.corona.scale.setScalar(VOR.sunR * 4.4); this.corona.visible = false; this.parent.add(this.corona);
  }

  // ------------------------------------------------------------ animation API
  tween(name, to, dur, ease) {
    const cur = this[name];
    if (!dur) { this[name] = to; delete this.tw[name]; return; }
    this.tw[name] = { from: cur, to, t: 0, dur, ease: ease || 'inOut' };
  }
  /** move a hand: wrist world pos, finger direction, back-of-hand up, finger curl (0..1.4), over dur (0 = snap) */
  moveHand(k, pos, fwd, up, curl, dur, ease, onDone) {
    const h = this.hands[k];
    h.from.pos.copy(h.pos); h.from.fwd.copy(h.fwd); h.from.up.copy(h.up); h.from.curl = h.curl;
    h.to.pos.copy(pos); h.to.fwd.copy(fwd).normalize(); h.to.up.copy(up).normalize(); h.to.curl = curl;
    h.t = 0; h.dur = dur || 0; h.ease = ease || 'inOut'; h.onDone = onDone || null;
    if (!dur) { h.pos.copy(pos); h.fwd.copy(h.to.fwd); h.up.copy(h.to.up); h.curl = curl; h.t = 1; if (onDone) onDone(); }
  }
  /** timed action relative to now (sim seconds) */
  seq(delay, fn) { this.seqs.push({ t: this.time + delay, fn }); }
  cancelSeqs() { this.seqs.length = 0; }

  // ---- canned poses
  gripTarget(k) { const s = this.hands[k].side; return { pos: _v5.set(s * 10.5, 2.4, -34.5), fwd: _v6.set(-s * 0.06, -0.16, 1), up: _v7.set(0, 1, 0.12), curl: 1.05 }; }
  gripPose(instant, k, dur) {
    for (const kk of (k ? [k] : ['E', 'W'])) { const t = this.gripTarget(kk); this.moveHand(kk, t.pos, t.fwd, t.up, t.curl, instant ? 0 : (dur || 1.2), 'inOut'); }
  }
  submerge() {
    this.cancelSeqs(); this.tween('rootY', -78, 0); this.tween('lean', 0.1, 0); this.headPitch = 0.3;
    for (const k of ['E', 'W']) { const s = this.hands[k].side; this.moveHand(k, _v5.set(s * 16, -30, -44), _v6.set(0, 0.6, 1), _v7.set(0, 0, -1), 0.4, 0); }
    this.sunMode = 'sky';
  }
  /** the rise for the intro: lava bulge, body rises, hands slam onto the rim at `slamAt` */
  rise(dur, slamAt) {
    this.tween('rootY', VOR.base.y, dur, 'out'); this.tween('headPitch', 0, dur * 1.2, 'inOut');
    for (const k of ['E', 'W']) {
      const s = this.hands[k].side;
      this.seq(dur * 0.25, () => this.moveHand(k, _v5.set(s * 13, 16, -38), _v6.set(-s * 0.1, -0.3, 1), _v7.set(0, 1, 0.3), 0.3, slamAt - dur * 0.25 - 0.25, 'out'));
      this.seq(slamAt - 0.25, () => { const t = this.gripTarget(k); this.moveHand(k, t.pos, t.fwd, t.up, t.curl, 0.25, 'in'); });
    }
  }
  /** sun aloft (phase 2): east hand palm-up overhead */
  holdSunAloft(dur) { this.moveHand('E', _v5.set(30, 50, -60), _v6.set(-0.45, 0.35, 0.55), _v7.set(0.1, -1, 0.15), 0.75, dur || 0, 'inOut'); }
  /** phase 3 rest: the sun is held low beside the arena (visible at the top of the frame) */
  holdSunLow(dur) { this.moveHand('E', _v5.set(27, 3.5, -46), _v6.set(-0.55, 0.3, 0.6), _v7.set(0.15, -1, 0.1), 0.7, dur || 0, 'inOut'); }
  sunWorld(out) {
    const h = this.hands.E;
    return out.set(0, -(VOR.sunR * 0.92 + 1.4), 4.6).applyMatrix4(h.M);
  }

  // ------------------------------------------------------------ simulation (sim time)
  update(dt) {
    this.time += dt;
    for (let i = this.seqs.length - 1; i >= 0; i--) { const s = this.seqs[i]; if (this.time >= s.t) { this.seqs.splice(i, 1); try { s.fn(); } catch (e) { console.error(e); } } }
    for (const k in this.tw) {
      const w = this.tw[k]; w.t += dt;
      const u = clamp01(w.t / w.dur), e = w.ease === 'out' ? easeOutCubic(u) : w.ease === 'in' ? easeInCubic(u) : w.ease === 'linear' ? u : easeInOutCubic(u);
      this[k] = lerp(w.from, w.to, e);
      if (u >= 1) delete this.tw[k];
    }
    for (const k in this.hands) {
      const h = this.hands[k];
      if (h.t < 1) {
        h.t = Math.min(1, h.t + dt / Math.max(1e-3, h.dur));
        const u = h.t, e = h.ease === 'out' ? easeOutCubic(u) : h.ease === 'in' ? easeInCubic(u) : h.ease === 'linear' ? u : easeInOutCubic(u);
        h.pos.lerpVectors(h.from.pos, h.to.pos, e);
        h.fwd.lerpVectors(h.from.fwd, h.to.fwd, e).normalize(); h.up.lerpVectors(h.from.up, h.to.up, e).normalize();
        h.curl = lerp(h.from.curl, h.to.curl, e);
        if (h.t >= 1 && h.onDone) { const f = h.onDone; h.onDone = null; f(); }
      }
    }
    // sun physics while falling (death beat)
    if (this.sunMode === 'falling') {
      this.sunVel.y -= 30 * dt;
      this.sunPos.addScaledVector(this.sunVel, dt);
      if (this.sunPos.y < -6 - VOR.sunR * 0.4 && !this.sunSplashed) { this.sunSplashed = true; if (this.onSunSplash) this.onSunSplash(this.sunPos); }
      if (this.sunPos.y < -6 - VOR.sunR * 1.2) { this.sunMode = 'gone'; }
    }
    this.pose();
  }

  // ------------------------------------------------------------ rig evaluation → instance matrices
  pose() {
    const t = this.time, B = this.boneM;
    const breathe = Math.sin(t * 0.42) * 0.5, sway = Math.sin(t * 0.23) * 0.015;
    const root = _m1.compose(_v1.set(VOR.base.x, this.rootY + breathe, VOR.base.z), _q1.setFromEuler(_e1.set(this.lean + sway * 0.5, sway, 0)), _s1.set(1, 1, 1));
    B[0].copy(root);
    // head: pivot at the neck
    B[1].copy(root).multiply(_m2.makeTranslation(0, 28, 0)).multiply(_m2.makeRotationX(this.headPitch + Math.sin(t * 0.31) * 0.03)).multiply(_m2.makeRotationY(Math.sin(t * 0.17) * 0.08)).multiply(_m2.makeTranslation(0, 0, 0));
    // arms (2-bone IK) + hands + fingers
    for (const k of ['E', 'W']) {
      const h = this.hands[k], s = h.side;
      const S = h.shoulder.set(s * VOR.shoulder, VOR.shoulderY, 0).applyMatrix4(root);
      const W = _v2.copy(h.pos);
      const d = _v3.subVectors(W, S); let L = d.length();
      const maxL = VOR.L1 + VOR.L2 - 0.05;
      if (L > maxL) { d.multiplyScalar(maxL / L); L = maxL; W.copy(S).add(d); }
      d.normalize();
      const a = (VOR.L1 * VOR.L1 - VOR.L2 * VOR.L2 + L * L) / (2 * L), hh = Math.sqrt(Math.max(0, VOR.L1 * VOR.L1 - a * a));
      const pole = _v4.set(s * 1.0, 0.55, -0.35);                       // elbows out, up and back
      pole.addScaledVector(d, -pole.dot(d)).normalize();
      const El = h.elbow.copy(S).addScaledVector(d, a).addScaledVector(pole, hh);
      const ui = k === 'E' ? 2 : 5;
      this._segMatrix(B[ui], S, El);
      this._segMatrix(B[ui + 1], El, W);
      // hand basis
      const F = _v4.copy(h.fwd).normalize(), U = _v5.copy(h.up); U.addScaledVector(F, -U.dot(F)).normalize();
      const Rr = _v6.crossVectors(U, F).normalize();
      h.M.makeBasis(Rr, U, F).setPosition(W);
      B[ui + 2].copy(h.M);
      // fingers
      const first = k === 'E' ? 8 : 23;
      for (let f = 0; f < 5; f++) {
        const thumb = f === 4, L3 = thumb ? VOR.thumb : VOR.phal;
        const fx = thumb ? -s * 4.6 : (f - 1.5) * 2.45 * -s, fz = thumb ? 2.6 : VOR.palmLen;
        const splay = thumb ? -s * 0.75 : (f - 1.5) * -s * 0.07;
        const flex = Math.sin(t * 0.7 + f * 1.3 + s) * 0.05;
        const c = h.curl + flex;
        let M = _m2.copy(h.M).multiply(_m1.makeTranslation(fx, thumb ? -0.4 : 0, fz)).multiply(_m1.makeRotationY(splay));
        if (thumb) M.multiply(_m1.makeRotationZ(-s * 0.5));
        for (let j = 0; j < L3.length; j++) {
          const bend = c * (j === 0 ? 0.55 : j === 1 ? 0.8 : 0.6) * (thumb ? 0.7 : 1);
          M.multiply(_m1.makeRotationX(bend));
          B[first + f * 3 + j].copy(M);
          M.multiply(_m1.makeTranslation(0, 0, L3[j]));
        }
      }
    }
    // write instances
    const pm = this.plateMesh;
    for (let i = 0; i < this.plates.length; i++) { const p = this.plates[i]; pm.setMatrixAt(i, _m1.multiplyMatrices(B[p.bone], p.m)); }
    pm.instanceMatrix.needsUpdate = true;
    const mm = this.magmaMesh;
    for (let i = 0; i < this.magmaL.length; i++) { const p = this.magmaL[i]; mm.setMatrixAt(i, _m1.multiplyMatrices(B[p.bone], p.m)); }
    mm.instanceMatrix.needsUpdate = true;
    const hm = this.hornMesh;
    for (let i = 0; i < this.hornL.length; i++) { const p = this.hornL[i]; hm.setMatrixAt(i, _m1.multiplyMatrices(B[p.bone], p.m)); }
    hm.instanceMatrix.needsUpdate = true;
    this.core.matrix.copy(B[0]).multiply(_m1.makeTranslation(0, 14.5, 3.2)); this.core.matrixWorldNeedsUpdate = true;
    // sun
    if (this.sunMode === 'held') this.sunWorld(this.sunPos);
    const sv = this.sunMode === 'held' || this.sunMode === 'falling';
    this.sun.visible = this.corona.visible = sv;
    const glare = (this.sunMode === 'held' && Game.state === 'fight') ? 0.5 : this.crack > 0.05 ? 0.45 : 0.8;
    this.sunGlare = this.sunGlare == null ? glare : this.sunGlare + (glare - this.sunGlare) * 0.08;
    this.sunMat.uniforms.uIntensity.value = this.sunGlare; this.coronaMat.opacity = this.sunGlare;
    if (sv) { this.sun.position.copy(this.sunPos); this.sun.scale.setScalar(this.sunScale); this.corona.position.copy(this.sunPos); this.corona.scale.setScalar(VOR.sunR * 4.4 * this.sunScale); }
    // god rays
    if (this.rays.visible) {
      _v1.set(0, 14.5, 3.2).applyMatrix4(B[0]);
      for (const r of this.rays.children) {
        r.position.copy(_v1); _v2.copy(_v1).add(r.userData.dir); r.lookAt(_v2);
        const k = this.crack; r.scale.set(r.userData.w * k, r.userData.w * k, r.userData.len * k);
      }
      this.rayMat.uniforms.uAlpha.value = clamp01(this.crack) * 0.35;
    }
    // material state
    const cu = this.plateMat.userData.arcane;
    cu.uFracture.value = 0.5 + this.crack * 0.35;
    this.magmaMat.uniforms.uWhite.value = clamp01(this.crack * 0.15);
    this.coreMat.uniforms.uWhite.value = clamp01(this.crack) * 0.35;
    this.coreMat.uniforms.uIntensity.value = 1.15 + this.coreBoost + this.crack * 0.25;
  }
  _segMatrix(out, a, b) {
    const d = _v8.subVectors(b, a); const L = d.length() || 1;
    _m2.lookAt(d, ORIGIN, Math.abs(d.y / L) > 0.98 ? _v7.set(0, 0, 1) : UP);
    out.copy(_m2).setPosition(a);
    // stretch slightly if the segment had to reach further than its rest length
    return out;
  }
  dispose() {
    for (const m of [this.plateMesh, this.magmaMesh, this.hornMesh]) { m.geometry.dispose(); m.dispose(); }
    this.plateMat.dispose(); this.magmaMat.dispose(); this.hornMat.dispose(); this.coreMat.dispose(); this.sunMat.dispose(); this.coronaMat.map.dispose(); this.coronaMat.dispose(); this.rayMat.dispose();
  }
}

// =============================================================================
//  ARENA — the Forge
// =============================================================================
function buildForgeArena(ctx) {
  const B = CONFIG.bosses[0], R = B.arenaRadius;
  const group = new THREE.Group(); group.name = 'forge-arena';
  const add = (o) => { group.add(o); return o; };
  const rnd = mulberry32(1234), RR = (a, b) => a + (b - a) * rnd();

  // ---- shared uniforms
  const FU = {
    uHeat: { value: 0 }, uMeltR: { value: 99 }, uShade: { value: new THREE.Vector4(1, 0, 0, 0) }, uHand: { value: new THREE.Vector4(0, 0, 8, 0) },
    uPalm: { value: new THREE.Vector4(1, 0, 0, 0) }, uCool: { value: 1 },
  };
  // ---- sky
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL_U.uRealTime, uStreak: GLOBAL_U.uStreak, uFocus: { value: new THREE.Vector3(0, 0, -1) }, uOctaves: GLOBAL_U.uOctaves,
      uSunDir: { value: VOR.sunDir0.clone() }, uSunSize: { value: VOR.sunR / VOR.sunD }, uSunDisc: { value: 1 }, uNoon: { value: 0 }, uGold: { value: 0 }, uCoronaK: { value: 1 } },
    vertexShader: SKY_VS, fragmentShader: FORGE_SKY_FS, side: THREE.BackSide, depthWrite: false,
  });
  const sky = add(new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), skyMat));
  sky.renderOrder = -10; sky.frustumCulled = false; sky.matrixAutoUpdate = false;

  // ---- lava sea (600 × 600 at y = -6)
  const lavaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL_U.uTime, uOctaves: GLOBAL_U.uOctaves, uGold: { value: 0 }, uRingR: { value: -1 }, uRingC: { value: new THREE.Vector2(0, -70) },
      uHaze: { value: new THREE.Color(0.7, 0.16, 0.035) }, uBulge: { value: new THREE.Vector4(0, -70, 30, 0) }, uNoon: { value: 0 }, uEdgeR: { value: R } },
    vertexShader: LAVA_SEA_VS, fragmentShader: LAVA_SEA_FS,
  });
  const sea = add(new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), lavaMat));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -6; sea.updateMatrix(); sea.matrixAutoUpdate = false; sea.renderOrder = -5;

  // ---- lights
  const hemi = add(new THREE.HemisphereLight(0xff8a4a, 0x200806, 0.5));
  const key = add(new THREE.DirectionalLight(0xffb070, 1.6));
  key.target.position.set(0, 0, 0); group.add(key.target);
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.04;
  const sc = key.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 5; sc.far = 140;
  const applyShadows = (tier) => { key.castShadow = !!tier.shadows; };
  applyShadows(Quality.tier); Quality.onChange(applyShadows);
  const under = add(new THREE.DirectionalLight(0xff4a14, 0.55)); under.position.set(0, -10, -30);   // lava bounce from below / north

  // ---- the obsidian disc
  const floorMat = makeMagmaFloorMaterial(R, FU);
  const floor = add(new THREE.Mesh(new THREE.CircleGeometry(R, 128), floorMat));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.updateMatrix(); floor.matrixAutoUpdate = false;
  // basalt skirt down into the lava
  const rockMat = makeArcane({ color: 0x1d1513, roughness: 0.92, metalness: 0.05, flatShading: true }, { rim: 0.5, rimColor: 0xff5a14, crackColor: 0xff4a0a, crackScale: 0.35, key: 'forgeRock' });
  rockMat.userData.arcane.uFracture.value = 0.45;
  const skirtG = new THREE.CylinderGeometry(R + 0.2, R * 0.42, 12, 56, 5, true);
  { const pa = skirtG.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); const k = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.1 * (6 - y) / 12; if (y < 5.9) { pa.setX(i, pa.getX(i) * k); pa.setZ(i, pa.getZ(i) * k); } } skirtG.computeVertexNormals(); }
  const skirt = add(new THREE.Mesh(skirtG, rockMat)); skirt.position.y = -6.02;
  // jagged rim stones
  const rimG = new THREE.DodecahedronGeometry(1, 0);
  const rimStones = new THREE.InstancedMesh(rimG, rockMat, 56);
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * TAU + RR(-0.03, 0.03), r = R + RR(0.2, 0.9), h = RR(0.3, 1.0) * (i % 3 === 0 ? 1.6 : 1);
    _q1.setFromEuler(_e1.set(RR(0, 3), RR(0, 3), RR(0, 3)));
    rimStones.setMatrixAt(i, _m1.compose(_v1.set(Math.sin(a) * r, h * 0.2 - 0.3, Math.cos(a) * r), _q1, _v2.set(RR(0.8, 1.4), h, RR(0.8, 1.3))));
  }
  add(rimStones);
  const lip = add(new THREE.Mesh(new THREE.TorusGeometry(R + 0.05, 0.12, 6, 180), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.55, 0.08) })));
  lip.rotation.x = Math.PI / 2; lip.position.y = 0.03;

  // ---- 4 basalt anvil pylons at the cardinal points, colliders r = 1.2.
  //      Each pylon is its own merged mesh with its own material so it can FADE as a whole (real alpha, no stipple)
  //      whenever it stands between the camera and the player / Pyrrha, or hugs the lens during a rail.
  const colliders = [];
  const pylons = [];
  const flameMats = [];
  const pylonParts = () => {
    const parts = [];
    const P = (geo, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); m.updateMatrix(); parts.push(m); return m; };
    P(new THREE.CylinderGeometry(1.75, 2.05, 0.55, 8), 0, 0.27, 0);                         // plinth
    P(new THREE.CylinderGeometry(1.45, 1.75, 0.35, 8), 0, 0.72, 0);
    P(new THREE.CylinderGeometry(0.95, 1.3, 3.5, 8, 2), 0, 2.6, 0);                         // tapered shaft
    for (const y of [1.25, 3.35]) P(new THREE.CylinderGeometry(1.2 - (y - 1.25) * 0.08, 1.24 - (y - 1.25) * 0.08, 0.22, 8), 0, y, 0);   // iron bands
    P(new THREE.CylinderGeometry(1.35, 0.95, 0.5, 8), 0, 4.55, 0);                          // flared neck
    P(new THREE.BoxGeometry(3.0, 0.75, 1.9), 0, 5.15, 0);                                   // anvil body
    P(new THREE.BoxGeometry(3.6, 0.32, 2.05), 0, 5.66, 0);                                  // anvil face
    P(new THREE.ConeGeometry(0.62, 1.9, 4), 2.5, 5.5, 0, 0, Math.PI / 4, -Math.PI / 2);     // horn
    P(new THREE.BoxGeometry(0.7, 0.9, 1.5), -1.85, 5.25, 0);                                // heel
    for (const s of [1, -1]) P(new THREE.BoxGeometry(0.28, 1.6, 0.28), s * 0.8, 0.9, 1.45, 0.35 * s, 0, 0.25 * s);   // buttresses
    for (const s of [1, -1]) P(new THREE.BoxGeometry(0.28, 1.6, 0.28), s * 0.8, 0.9, -1.45, -0.35 * s, 0, 0.25 * s);
    return parts;
  };
  const mergeParts = (parts) => {
    let total = 0; const geos = parts.map((m) => { const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrix); total += g.attributes.position.count; m.geometry.dispose(); return g; });
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2); let o = 0;
    for (const g of geos) { const n = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += n; g.dispose(); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    mg.computeBoundingSphere(); return mg;
  };
  const stoneG = mergeParts(pylonParts());
  const glowG = new THREE.BoxGeometry(2.7, 0.12, 1.95); glowG.translate(0, 5.45, 0);          // molten seam between anvil body and face
  const runeG = new THREE.BoxGeometry(0.16, 2.6, 0.05);                                       // vertical rune seams on the shaft
  const flameG = new THREE.CylinderGeometry(0.15, 1.15, 3.4, 14, 1, true); flameG.translate(0, 7.45, 0);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, x = Math.round(Math.sin(a) * 17), z = Math.round(-Math.cos(a) * 17);   // N, E, S, W
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = a + Math.PI / 2; add(g);
    const stoneMat = makeArcane({ color: 0x241b18, roughness: 0.8, metalness: 0.15, flatShading: true, transparent: true }, { rim: 0.7, rimColor: 0xff6a20, crackColor: 0xff4a0a, crackScale: 1.2, key: 'pylonF' });
    stoneMat.userData.arcane.uFracture.value = 0.25;
    const stone = new THREE.Mesh(stoneG, stoneMat); stone.castShadow = true; stone.receiveShadow = true; g.add(stone);
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.12, 0.02), transparent: true });
    const glow = new THREE.Mesh(glowG, glowMat); g.add(glow);
    for (const s of [1, -1]) { const r = new THREE.Mesh(runeG, glowMat); r.position.set(0, 2.6, s * 1.13); r.rotation.x = -s * 0.1; g.add(r); }
    const fm = new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uAmt: { value: 0 } }, vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const flame = new THREE.Mesh(flameG, fm); flame.renderOrder = 7; flame.visible = false; g.add(flame); flameMats.push(fm);
    for (const m of [stone, glow, ...g.children]) if (m !== flame) m.renderOrder = -1;     // first in the transparent list → acts opaque when solid
    colliders.push({ x, z, r: 1.2 });
    pylons.push({ x, z, lit: 0, litT: -1, group: g, stoneMat, glowMat, flame, fm, fade: 0 });
  }
  /** per-pylon fade: ghost a pylon that hides the player (or Pyrrha) or crowds the lens. Called every sim step. */
  const _oc = new THREE.Vector3();
  const sightBlocks = (pl, cx, cy, cz, tx, ty, tz) => {
    const dx = tx - cx, dz = tz - cz, L2 = dx * dx + dz * dz; if (L2 < 1e-4) return 0;
    const t = ((pl.x - cx) * dx + (pl.z - cz) * dz) / L2;
    if (t <= 0 || t >= 1) return 0;
    const L = Math.sqrt(L2); if ((1 - t) * L < 1.2) return 0;                       // the pylon is behind (or at) the target
    const d = Math.hypot(cx + dx * t - pl.x, cz + dz * t - pl.z), y = cy + (ty - cy) * t;
    return (1 - smooth01((d - 1.9) / 1.6)) * (1 - smooth01((y - 6.3) / 1.4));
  };
  const updatePylonFade = (dt) => {
    const c = camera.position, pl0 = Game.player, b = Game.boss, rail = !!CamRig.rail;
    for (const pl of pylons) {
      let k = 0;
      if (pl0 && pl0.vis && Game.state !== 'title') {
        const px = pl0.vis.x, pz = pl0.vis.z;
        k = Math.max(sightBlocks(pl, c.x, c.y, c.z, px, 0.15, pz), sightBlocks(pl, c.x, c.y, c.z, px, 1.9, pz));
        if (b && b.alive && b.vis) k = Math.max(k, 0.85 * sightBlocks(pl, c.x, c.y, c.z, b.vis.x, (b.height || 6) * 0.55, b.vis.z));
      }
      const dc = Math.hypot(c.x - pl.x, c.z - pl.z), near = rail ? 10 : 5.5;
      if (c.y < 8) k = Math.max(k, 1 - smooth01((dc - near * 0.6) / (near * 0.4)));
      pl.fade = damp(pl.fade, k, k > pl.fade ? 9 : 5, Math.max(dt, 1 / 240));
      const op = lerp(1, 0.1, pl.fade);                                         // QA: 0.16 left a brown slab over the player at spawn
      const solid = op > 0.985;
      pl.stoneMat.opacity = solid ? 1 : op; pl.stoneMat.depthWrite = solid;
      pl.stoneMat.userData.arcane.uRim.value = 0.7 + pl.fade * 0.6;               // ghost keeps a faint hot silhouette
      pl.glowMat.opacity = solid ? 1 : op * 0.8;
      pl.glowMat.depthWrite = solid;
      pl.fm.uniforms.uAmt.value = pl.lit * (1 - 0.75 * pl.fade);
    }
  };

  // ---- floating basalt shards around the platform + distant spires in the lava
  const spires = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), rockMat, 18);
  for (let i = 0; i < 18; i++) {
    const a = RR(0, TAU), r = RR(48, 160), h = RR(10, 38);
    if (Math.abs(Math.atan2(Math.sin(a), -Math.cos(a))) < 0.5 && r < 120) continue;       // keep the titan's sightline clear
    spires.setMatrixAt(i, _m1.compose(_v1.set(Math.sin(a) * r, -6 + h * 0.4, Math.cos(a) * r), _q1.setFromEuler(_e1.set(RR(-0.15, 0.15), RR(0, 3), RR(-0.15, 0.15))), _v2.set(RR(3, 7), h, RR(3, 7))));
  }
  add(spires);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 22);
  for (let i = 0; i < 22; i++) {
    const a = i * 2.39996 + 0.4, r = RR(26, 40), s = RR(0.8, 2.6);
    rocks.setMatrixAt(i, _m1.compose(_v1.set(Math.sin(a) * r, RR(-4, 3), Math.cos(a) * r), _q1.setFromEuler(_e1.set(i, i * 2, i * 3)), _v2.set(s, s * 0.7, s)));
  }
  add(rocks);

  // ---- 400 embers rising from the rim and the sea (static Points, animated in the shader)
  const NE = 400, ep = new Float32Array(NE * 3), er = new Float32Array(NE);
  for (let i = 0; i < NE; i++) { const a = Math.random() * TAU, r = i < 260 ? R + Math.random() * 10 - 2 : 30 + Math.random() * 60; ep[i * 3] = Math.sin(a) * r; ep[i * 3 + 1] = Math.random() * 18 - 6; ep[i * 3 + 2] = Math.cos(a) * r; er[i] = Math.random(); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3)); eg.setAttribute('aR', new THREE.BufferAttribute(er, 1));
  const embers = add(new THREE.Points(eg, new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL_U.uTime, uScale: Particles.mat.uniforms.uScale, uNoon: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aR; uniform float uTime; uniform float uScale; varying float vA; varying float vR;
      void main(){
        vec3 p = position;
        float sp = 0.8 + aR * 1.6;
        p.y = mod(p.y + 6.0 + uTime * sp, 22.0) - 6.0;
        p.x += sin(uTime * (0.4 + aR) + aR * 20.0) * (0.6 + p.y * 0.08); p.z += cos(uTime * (0.33 + aR * 0.7) + aR * 10.0) * (0.6 + p.y * 0.08);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min((0.07 + aR * 0.09) * uScale / -mv.z, 9.0);
        gl_Position = projectionMatrix * mv;
        vA = smoothstep(-6.0, -3.0, p.y) * (1.0 - smoothstep(10.0, 16.0, p.y)) * (0.55 + 0.45 * sin(uTime * 7.0 + aR * 40.0));
        vR = aR;
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying float vR;
      void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
        vec3 c = mix(vec3(3.0, 0.9, 0.15), vec3(3.6, 2.2, 0.8), step(0.8, vR));
        gl_FragColor = vec4(c * pow(max(1.0 - d, 0.0), 1.6) * vA, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })));
  embers.frustumCulled = false;

  // ---- lava pools (Slag Rain) — pooled molten decals under the hazard telegraph
  const poolMat = (() => {
    const m = new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime }, vertexShader: BASIC_UV_VS,
      fragmentShader: /* glsl */`
        uniform float uTime; varying vec2 vUv; uniform float uA; uniform float uSeed;
        ${GLSL_NOISE}
        void main(){
          vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
          float n = fbm(p * 2.2 + vec2(uSeed, uTime * 0.3), 3), b = vnoise(p * 6.0 + vec2(0.0, -uTime * 1.5));
          float edge = 1.0 - smoothstep(0.78 + n * 0.18, 0.98, r);
          vec3 c = mix(vec3(0.7, 0.1, 0.01), vec3(2.6, 1.0, 0.18), smoothstep(0.3, 0.8, n)) + vec3(1.5, 0.8, 0.3) * smoothstep(0.75, 0.95, b);
          c *= 0.55;
          float crust = smoothstep(0.55, 0.95, r) * 0.6;
          gl_FragColor = vec4(c * edge * (1.0 - crust) * uA, edge * uA * 0.92);
        }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    return m;
  })();
  const poolG = new THREE.PlaneGeometry(1, 1); poolG.rotateX(-Math.PI / 2);
  const pools = [];
  for (let i = 0; i < 10; i++) {
    const m = poolMat.clone(); m.uniforms.uTime = GLOBAL_U.uTime; m.uniforms.uA = { value: 0 }; m.uniforms.uSeed = { value: i * 7.3 };
    const mesh = new THREE.Mesh(poolG, m); mesh.visible = false; mesh.renderOrder = 3; mesh.position.y = 0.02; add(mesh);
    pools.push({ mesh, t: 0, life: 0, r: 2.5 });
  }

  // ---- Vorath
  const vorath = new Vorath(group);
  syncLightLayers(group);
  const keepSet = new Set([sky, sea, floor, skirt, lip, vorath.sun, vorath.corona, embers, ...pools.map((p) => p.mesh)]);
  vorath.group.traverse((o) => keepSet.add(o));        // the titan is animated: never merge inside it
  mergeStaticMeshes(group, keepSet);
  scene.add(group);

  // ---------------------------------------------------------------- arena API
  const arena = {
    key: 'pyrrha', group, radius: R, colliders, sky, vorath, pylons, FU, lavaMat, lavaRing: null,
    spawn: B.playerSpawn,
    exposure: B.exposure, bloom: B.bloom, grade: B.grade,
    noon: 0, heat: 0, shade: 0, shadeSide: 1, palmHeat: 0, palmSide: 1, meltR: 99, cool: 1, gold: 0,
    tw: {},
    tween(name, to, dur) { if (!dur) { this[name] = to; delete this.tw[name]; return; } this.tw[name] = { from: this[name], to, t: 0, dur }; },
    /** spawn a molten pool decal (visual only) */
    pool(x, z, r, life) {
      let p = null; for (const q of pools) if (!q.mesh.visible) { p = q; break; } if (!p) p = pools[0];
      p.mesh.position.set(x, 0.02, z); p.mesh.scale.set(r * 2.25, 1, r * 2.25); p.mesh.visible = true; p.t = 0; p.life = life; p.r = r;
    },
    igniteAll(instant) {
      pylons.forEach((pl, i) => {
        if (instant) { pl.lit = 1; return; }
        Timers.after(i * 0.16, () => {
          pl.litT = 0; sfx('boom');
          Particles.burst(_v1.set(pl.x, 5.6, pl.z), 90, 0xffe0a0, PYR_EMBER, 9, 0.9, 0.35, -6, { up: 4, intensity: 2.4 });
          GroundFX.ring(pl.x, pl.z, 0.5, 5, 0xff8a40, 0.6, 0.4, 2.6);
        });
      });
    },
    setNoon(v, dur) { this.tween('noon', v, dur); },
    update(dt) {
      for (const k in this.tw) { const w = this.tw[k]; w.t += dt; const u = smooth01(w.t / w.dur); this[k] = lerp(w.from, w.to, u); if (w.t >= w.dur) { this[k] = w.to; delete this.tw[k]; } }
      vorath.update(dt);
      // sun → sky, light direction
      const sunHeld = vorath.sunMode === 'held' || vorath.sunMode === 'falling';
      const sd = skyMat.uniforms.uSunDir.value;
      if (sunHeld) sd.copy(vorath.sunPos).normalize(); else sd.copy(VOR.sunDir0);
      skyMat.uniforms.uSunDisc.value = vorath.sunMode === 'sky' ? 1 : 0;
      skyMat.uniforms.uCoronaK.value = vorath.sunMode === 'sky' ? 1 : vorath.sunMode === 'gone' ? 0 : 0.3 * (vorath.sunGlare || 1);
      skyMat.uniforms.uNoon.value = this.noon; skyMat.uniforms.uGold.value = this.gold;
      lavaMat.uniforms.uNoon.value = this.noon; lavaMat.uniforms.uGold.value = this.gold;
      _c1.setRGB(0.7, 0.16, 0.035).lerp(_c2.setRGB(0.85, 0.36, 0.1), this.noon);
      if (this.gold > 0) _c1.lerp(_c2.setRGB(0.55, 0.33, 0.1), this.gold * 0.8);
      lavaMat.uniforms.uHaze.value.copy(_c1);
      if (this.lavaRing) { this.lavaRing.r += dt * 55; lavaMat.uniforms.uRingR.value = this.lavaRing.r; lavaMat.uniforms.uRingC.value.set(this.lavaRing.x, this.lavaRing.z); if (this.lavaRing.r > 420) { this.lavaRing = null; lavaMat.uniforms.uRingR.value = -1; } }
      _v1.copy(sd); _v1.y = Math.max(_v1.y, 0.42); _v1.normalize();
      _v1.lerp(_v2.set(0.12, 1, 0.25).normalize(), this.noon * 0.85).normalize();
      key.position.copy(_v1).multiplyScalar(60);
      key.color.setRGB(1, 0.69, 0.44).lerp(_c2.setRGB(1, 0.92, 0.78), this.noon);
      key.intensity = 1.6 + this.noon * 0.7;
      hemi.intensity = 0.5 + this.noon * 0.2; hemi.color.setRGB(1, 0.54, 0.29).lerp(_c2.setRGB(1, 0.7, 0.48), this.noon);
      // floor
      FU.uHeat.value = this.heat; FU.uMeltR.value = this.meltR; FU.uCool.value = this.cool;
      FU.uShade.value.set(this.shadeSide, 0, this.shade, 0);
      this.palmHeat = Math.max(0, this.palmHeat - dt * 0.35);
      FU.uPalm.value.set(this.palmSide, 0, this.palmHeat, 0);
      const hw = vorath.hands.W;
      const hy = hw.pos.y;
      if (this.handShadow) { FU.uHand.value.set(hw.pos.x, hw.pos.z + 9, 9, clamp01((34 - hy) / 26) * this.handShadow); }
      else FU.uHand.value.w = Math.max(0, FU.uHand.value.w - dt * 2);
      // pylons: ignition, flames, glow seams, occlusion fade
      for (const pl of pylons) {
        if (pl.litT >= 0) { pl.litT += dt; pl.lit = Math.min(1, pl.litT / 0.4); if (pl.lit >= 1) pl.litT = -1; }
        pl.flame.visible = pl.lit > 0.01;
        pl.glowMat.color.setRGB(0.55 + 1.6 * pl.lit, 0.13 + 0.5 * pl.lit, 0.02 + 0.08 * pl.lit).multiplyScalar(this.cool * (0.85 + 0.15 * Math.sin(GLOBAL_U.uTime.value * 2.3 + pl.x)));
        if (pl.lit > 0.5 && fxRand() < dt * 14) Particles.trailPoint(_v1.set(pl.x + fxRange(-0.8, 0.8), 6.2, pl.z + fxRange(-0.4, 0.4)), 0xffc070, PYR_EMBER, 1.1, 0.22, { vy: 3.2, intensity: 2.2 * (1 - pl.fade * 0.8), jitter: 0.3 });
      }
      updatePylonFade(dt);
      for (const pl of pylons) pl.fm.uniforms.uAmt.value *= this.cool;
      // lava pools
      for (const p of pools) {
        if (!p.mesh.visible) continue;
        p.t += dt;
        const a = Math.min(1, p.t / 0.15) * (p.t > p.life - 0.6 ? Math.max(0, (p.life - p.t) / 0.6) : 1);
        p.mesh.material.uniforms.uA.value = a;
        if (p.t >= p.life) p.mesh.visible = false;
        else if (fxRand() < dt * 6) Particles.trailPoint(_v1.set(p.mesh.position.x + fxRange(-p.r, p.r) * 0.7, 0.15, p.mesh.position.z + fxRange(-p.r, p.r) * 0.7), 0xffa040, 0x401000, 0.9, 0.2, { vy: 1.4, intensity: 2 });
      }
      // ember mote brightness / sky focus
      camera.getWorldDirection(skyMat.uniforms.uFocus.value);
    },
    dispose() {
      scene.remove(group);
      Quality.listeners.splice(Quality.listeners.indexOf(applyShadows), 1);
      vorath.dispose();
      group.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.dispose) c.material.dispose(); });
      Post.haze = 0;
    },
  };
  Post.haze = 1;          // heat haze near the bottom of the frame (High tier only)
  return arena;
}

// =============================================================================
//  PYRRHA, THE FORGE-WARDEN
// =============================================================================
//            part offsets (radians / metres) added to the rest pose
const PYR_POSES = {
  idle: {},
  walk: { torso: { r: [0.12, 0, 0] } },
  hammerUp: { torso: { r: [-0.28, 0, 0] }, head: { r: [-0.2, 0, 0] }, shR: { r: [-2.85, 0, 0.25] }, elR: { r: [-0.35, 0, 0] }, hammer: { r: [2.35, 0, 0] },
    shL: { r: [-2.75, 0, -0.45] }, elL: { r: [-0.55, 0, 0] }, body: { p: [0, -0.15, 0] }, thighL: { r: [-0.35, 0, 0] }, shinL: { r: [0.4, 0, 0] } },
  slam: { torso: { r: [0.62, 0, 0] }, head: { r: [-0.35, 0, 0] }, shR: { r: [-1.25, 0, 0.12] }, elR: { r: [-0.05, 0, 0] }, hammer: { r: [0.95, 0, 0] },
    shL: { r: [-1.2, 0, -0.35] }, elL: { r: [-0.2, 0, 0] }, body: { p: [0, -0.55, 0.3] }, thighL: { r: [-0.9, 0, 0] }, shinL: { r: [0.95, 0, 0] }, thighR: { r: [0.35, 0, 0] }, shinR: { r: [0.3, 0, 0] } },
  palm: { torso: { r: [0.05, -0.45, 0] }, shL: { r: [-1.55, 0.25, -0.15] }, elL: { r: [-0.1, 0, 0] }, handL: { r: [0, 0, 0], s: 1.25 }, shR: { r: [0.55, 0, 0.35] }, elR: { r: [-0.6, 0, 0] },
    head: { r: [0.05, -0.3, 0] }, thighL: { r: [-0.3, 0, 0] }, shinL: { r: [0.25, 0, 0] } },
  crossed: { torso: { r: [0.22, 0, 0] }, shL: { r: [-1.35, 0, -1.05] }, elL: { r: [-1.25, 0, 0] }, shR: { r: [-1.35, 0, 1.05] }, elR: { r: [-1.25, 0, 0] }, hammer: { r: [0.6, 0, 0] },
    head: { r: [0.3, 0, 0] }, body: { p: [0, -0.35, 0] }, thighL: { r: [-0.35, 0, 0] }, shinL: { r: [0.45, 0, 0] }, thighR: { r: [-0.35, 0, 0] }, shinR: { r: [0.45, 0, 0] } },
  raised: { torso: { r: [-0.32, 0, 0] }, head: { r: [-0.45, 0, 0] }, shL: { r: [-2.6, 0, 0.75] }, elL: { r: [-0.25, 0, 0] }, shR: { r: [-2.6, 0, -0.75] }, elR: { r: [-0.25, 0, 0] }, hammer: { r: [1.6, 0, 0] } },
  roar: { torso: { r: [-0.38, 0, 0] }, head: { r: [-0.6, 0, 0] }, shL: { r: [-0.6, 0, 1.25] }, elL: { r: [-0.6, 0, 0] }, shR: { r: [-0.6, 0, -1.25] }, elR: { r: [-0.6, 0, 0] }, body: { p: [0, -0.2, 0] } },
  stompUp: { thighL: { r: [-1.35, 0, 0] }, shinL: { r: [1.2, 0, 0] }, torso: { r: [-0.18, 0, 0] }, shL: { r: [-0.4, 0, 0.9] }, shR: { r: [-0.4, 0, -0.9] }, hammer: { r: [0.4, 0, 0] }, body: { p: [0, 0.15, 0] } },
  stompDown: { thighL: { r: [-0.25, 0, 0] }, shinL: { r: [0.15, 0, 0] }, torso: { r: [0.3, 0, 0] }, shL: { r: [-0.2, 0, 0.6] }, shR: { r: [-0.2, 0, -0.6] }, body: { p: [0, -0.45, 0] },
    thighR: { r: [-0.3, 0, 0] }, shinR: { r: [0.5, 0, 0] } },
  kneel: { body: { p: [0, -1.25, 0] }, thighL: { r: [-1.5, 0, 0] }, shinL: { r: [1.5, 0, 0] }, thighR: { r: [0.25, 0, 0] }, shinR: { r: [1.65, 0, 0] },
    torso: { r: [0.55, 0, 0] }, head: { r: [0.5, 0, 0] }, shR: { r: [-0.6, 0, 0.2] }, elR: { r: [-0.3, 0, 0] }, hammer: { r: [0.2, 0, 0] }, shL: { r: [-0.3, 0, -0.2] }, elL: { r: [-0.8, 0, 0] } },
  overheat: { torso: { r: [-0.2, 0, 0] }, head: { r: [-0.5, 0, 0] }, shL: { r: [-0.3, 0, 0.7] }, shR: { r: [-0.3, 0, -0.7] }, body: { p: [0, -0.3, 0] } },
};

class Pyrrha extends Boss {
  constructor(ctx, arena) {
    const M = CONFIG.bosses[0].mech, H = M.hammerfall, S = M.slagRain, I = M.incinerate, mul = M.p3IntervalMul;
    super({
      index: 0, x: CONFIG.bosses[0].spawn.x, z: CONFIG.bosses[0].spawn.z,
      phases: [
        { name: 'LEARN THE SHAPES', until: 0.60, abilities: [
          { id: 'hammerfall', first: H.first, every: H.every, major: true, resolveIn: H.windup },
          { id: 'slagRain', first: S.first, every: S.every, major: true, resolveIn: S.windup },
          { id: 'incinerate', first: I.first, every: I.every } ] },
        { name: 'PRIORITIES', title: 'PHASE II', subtitle: 'PRIORITIES', until: 0.25, abilities: [
          { id: 'cinderlings', first: M.cinderlings.first, every: M.cinderlings.every, cast: false },
          { id: 'hammerfall', first: 6.5, every: H.every, major: true, resolveIn: H.windup },
          { id: 'inOut', first: M.inOut.first, every: M.inOut.every, major: true, resolveIn: M.inOut.windup },
          { id: 'slagRain', first: 13, every: S.every, major: true, resolveIn: S.windup },
          { id: 'incinerate', first: 19, every: I.every } ] },
        { name: 'SUNFALL', title: 'PHASE III', subtitle: 'SUNFALL', until: 0, abilities: [
          { id: 'titansPalm', first: M.palm.first, every: M.palm.every, major: true, resolveIn: M.palm.windup, cast: false },
          { id: 'stomp', first: M.stomp.first, every: M.stomp.every },
          { id: 'hammerfall', first: 9, every: H.every * mul, major: true, resolveIn: H.windup },
          { id: 'slagRain', first: 16, every: S.every * mul, major: true, resolveIn: S.windup } ],
          specials: [{ atPct: M.overheat.at, id: 'overheat' }] },
      ],
    });
    this.arena = arena; this.vorath = arena.vorath; this.M = M;
    this.yaw = 0; this.prevYaw = 0; this.visYaw = 0;
    this.nextIn = true; this.lockYaw = null; this.hammerHeat = 0; this.heatTarget = 0; this.overheatV = 0; this.stepT = 0; this.palmFxT = 0;
    this.shardColor = 0xffd9a0; this.shardColor2 = 0xff7a2a;
    this.palmWorld = new THREE.Vector3(); this.hammerWorld = new THREE.Vector3();
    this.buildModel();
    this.light.color.set(0xff5a1f); this.light.distance = 12; this.light.decay = 1.4; this.light.intensity = 0;
  }

  // ------------------------------------------------------------ model
  // A 7 m forge colossus: basalt plates veined with live magma, a furnace for a chest (iron grate over a
  // white-hot core), twin chimney stacks on her back that belch smoke and sparks, a crown of fire, and a
  // forge hammer whose head heats from dull iron to molten gold over each windup.
  buildModel() {
    const g = this.group;
    this.veinU = { uVein: { value: 0.55 }, uVeinHot: { value: 0 } };
    const arc = (params, opts, veinScale) => {
      if (veinScale) opts.onCompile = veinHook(this.veinU, veinScale);
      opts.dissolveColor = 0xff7a2a;
      return this.addArcane(makeArcane(params, opts));
    };
    const basalt = arc({ color: 0x2c211d, roughness: 0.8, metalness: 0.12, flatShading: true }, { rim: 0.55, rimColor: 0xff5a1a, crackScale: 1.25, key: 'pyrBasaltV' }, 1.7);
    const dark = arc({ color: 0x16100e, roughness: 0.6, metalness: 0.35, flatShading: true }, { rim: 0.45, rimColor: 0xff6a2a, crackScale: 1.6, key: 'pyrDarkV' }, 2.3);
    const iron = arc({ color: 0x4a4440, roughness: 0.34, metalness: 0.9, flatShading: true }, { rim: 0.35, rimColor: 0xffa060, crackScale: 2.0, key: 'pyrIron' });
    const bronze = arc({ color: 0x9a5e28, roughness: 0.28, metalness: 0.95, flatShading: true }, { rim: 0.3, rimColor: 0xffc080, crackScale: 2.2, key: 'pyrBronze' });
    this.hammerMat = arc({ color: 0x2e2826, roughness: 0.42, metalness: 0.8, flatShading: true, emissive: 0xff3a08, emissiveIntensity: 0.2 }, { rim: 0.3, rimColor: 0xffb070, crackScale: 1.8, key: 'pyrHammer' });
    this.jointMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.7, 0.12) });
    this.coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.2, 0.25) });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.8, 0.4) });
    this.innerMat = makeMagmaMaterial({ intensity: 0.8, scale: 1.6 });
    this.seamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.3, 0.04) });
    this.flames = [];
    const piv = (parent, x, y, z) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
    const mesh = (parent, geo, mat, x, y, z, rx, ry, rz, shadow) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = shadow !== false; parent.add(m); return m; };
    const box = (parent, w, h, d, x, y, z, mat, rx, ry, rz) => mesh(parent, new THREE.BoxGeometry(w, h, d), mat || basalt, x, y, z, rx, ry, rz);
    const seg = (parent, rTop, rBot, len, mat, sides, y0, z0) => mesh(parent, new THREE.CylinderGeometry(rTop, rBot, len, sides || 6), mat, 0, (y0 || 0) - len / 2, z0 || 0);
    const glow = (parent, r, x, y, z) => mesh(parent, new THREE.IcosahedronGeometry(r, 0), this.jointMat, x, y, z, 0, 0, 0, false);
    const flame = (parent, r, h, x, y, z, seed, hot) => {
      const fg = new THREE.CylinderGeometry(r * 0.12, r, h, 10, 1, true); fg.translate(0, h / 2, 0);
      const m = makePyrFlameMaterial(seed, hot); const f = mesh(parent, fg, m, x, y, z, 0, 0, 0, false); f.renderOrder = 8;
      this.flames.push({ mesh: f, mat: m, base: 1 }); return f;
    };

    const body = piv(g, 0, 2.75, 0);
    // ---- pelvis + war-skirt (plates fan out around the back → a strong triangular silhouette)
    mesh(body, new THREE.CylinderGeometry(0.98, 0.82, 0.72, 8), dark, 0, 0, 0);
    mesh(body, new THREE.TorusGeometry(1.0, 0.1, 4, 14), bronze, 0, 0.3, 0, Math.PI / 2, 0, 0);
    glow(body, 0.26, 0, 0.12, 0.94);                                        // belt buckle ember
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.3 + i * 0.14);
      const p = piv(body, Math.sin(a) * 0.92, -0.1, Math.cos(a) * 0.92); p.rotation.y = a;
      const plate = box(p, 0.6, 1.7 - Math.abs(i - 5) * 0.08, 0.1, 0, -0.82, 0, i % 2 ? dark : basalt, 0.34);
      plate.position.z = 0.24;
      box(p, 0.62, 0.12, 0.13, 0, -0.02, 0.0, bronze, 0.34);
      if (i % 2 === 0) mesh(p, new THREE.ConeGeometry(0.07, 0.3, 4), iron, 0, -1.72 + Math.abs(i - 5) * 0.08, 0.5, Math.PI, 0, 0);   // studs hanging off the hem
    }
    // ---- legs
    const legs = {};
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R';
      const thigh = piv(body, s * 0.62, -0.25, 0);
      seg(thigh, 0.5, 0.36, 1.3, basalt, 7);
      seg(thigh, 0.54, 0.5, 0.45, dark, 7, 0.05);
      box(thigh, 0.62, 0.9, 0.16, 0, -0.65, 0.38, iron, 0.06);                                 // cuisse plate
      const shin = piv(thigh, 0, -1.3, 0);
      mesh(shin, new THREE.OctahedronGeometry(0.36, 0), iron, 0, 0.02, 0.22, 0, 0, 0);          // knee cop
      glow(shin, 0.16, 0, 0, -0.05);
      seg(shin, 0.4, 0.28, 1.25, basalt, 7);
      box(shin, 0.56, 1.1, 0.2, 0, -0.55, 0.32, iron, -0.08);                                   // greave
      box(shin, 0.05, 0.75, 0.05, 0, -0.5, 0.43, this.seamMat, -0.08).castShadow = false;     // molten seam down the greave
      box(shin, 0.68, 0.32, 1.12, 0, -1.25, 0.22, dark);                                        // sabaton
      mesh(shin, new THREE.ConeGeometry(0.22, 0.55, 4), iron, 0, -1.28, 0.95, Math.PI / 2, Math.PI / 4, 0);
      legs[L] = { thigh, shin };
    }
    // ---- torso: a furnace. Magma body inside segmented basalt; the core blazes behind an iron grate in the V-split breastplate
    const torso = piv(body, 0, 0.35, 0);
    mesh(torso, new THREE.CylinderGeometry(1.08, 0.74, 2.6, 8), this.innerMat, 0, 1.35, -0.05, 0, 0, 0, false);
    this.coreMesh = mesh(torso, new THREE.IcosahedronGeometry(0.66, 1), this.coreMat, 0, 1.6, 0.42, 0, 0, 0, false);
    for (const s of [1, -1]) {
      box(torso, 1.02, 1.5, 0.32, s * 0.66, 1.82, 0.58, basalt, -0.1, s * -0.42, s * 0.1);     // breastplates (split wide → furnace mouth)
      box(torso, 0.92, 0.13, 0.36, s * 0.66, 2.58, 0.62, bronze, -0.1, s * -0.42, s * 0.1);    // gilded edges
      box(torso, 0.1, 1.45, 0.36, s * 0.3, 1.8, 0.78, bronze, -0.1, s * -0.42, 0);
      for (let i = 0; i < 3; i++) box(torso, 0.85 - i * 0.08, 0.26, 0.24, s * 0.47, 0.35 + i * 0.34, 0.6, i % 2 ? dark : basalt, 0.12, s * -0.3, 0);   // abdomen lames (gaps glow)
      for (let i = 0; i < 3; i++) box(torso, 0.12, 0.22, 1.12, s * 1.0, 0.9 + i * 0.42, 0.0, dark, 0, 0, s * 0.18);     // flank ribs
    }
    for (let i = 0; i < 4; i++) mesh(torso, new THREE.CylinderGeometry(0.045, 0.045, 0.62, 5), iron, 0, 1.2 + i * 0.27, 0.86, 0, 0, Math.PI / 2);   // furnace grate
    mesh(torso, new THREE.CylinderGeometry(0.05, 0.05, 1.05, 5), iron, 0, 1.6, 0.87);
    box(torso, 2.4, 2.2, 0.5, 0, 1.55, -0.74, dark, 0.08);                  // back plate
    mesh(torso, new THREE.CylinderGeometry(0.78, 1.18, 0.5, 8), basalt, 0, 2.75, -0.05);   // gorget
    mesh(torso, new THREE.TorusGeometry(0.85, 0.075, 4, 14), bronze, 0, 2.98, -0.05, Math.PI / 2, 0, 0);
    // ---- the forge on her back: two chimney stacks (smoke + sparks), a bellows hump, a tattered mantle
    this.chimneys = [];
    for (const s of [1, -1]) {
      const c = piv(torso, s * 0.72, 2.15, -1.12); c.rotation.set(-0.16, 0, s * -0.1);
      mesh(c, new THREE.CylinderGeometry(0.3, 0.38, 2.5, 7), dark, 0, 1.0, 0);
      mesh(c, new THREE.CylinderGeometry(0.44, 0.32, 0.36, 7), iron, 0, 2.3, 0);             // flared cap
      for (const y of [0.25, 1.2]) mesh(c, new THREE.CylinderGeometry(0.41, 0.41, 0.14, 7), bronze, 0, y, 0);
      mesh(c, new THREE.CircleGeometry(0.33, 10), this.jointMat, 0, 2.49, 0, -Math.PI / 2, 0, 0, false);   // glowing mouth
      const fl = flame(c, 0.3, 1.1, 0, 2.45, 0, s * 3.1, 0xffc060); fl.userData.chimney = true;
      const mouth = piv(c, 0, 2.6, 0);
      this.chimneys.push(mouth);
    }
    box(torso, 1.5, 1.3, 0.55, 0, 1.25, -1.1, basalt, 0.15);               // bellows hump
    for (let i = 0; i < 3; i++) box(torso, 1.56, 0.08, 0.6, 0, 0.75 + i * 0.4, -1.12, bronze, 0.15);
    for (let i = 0; i < 4; i++) {
      const c = piv(torso, (i - 1.5) * 0.58, 2.7, -0.9); c.rotation.set(0.14 + (i % 2) * 0.05, 0, (i - 1.5) * 0.09);
      box(c, 0.58, 3.7 - (i % 2) * 0.5 - Math.abs(i - 1.5) * 0.4, 0.06, 0, -1.75 + (i % 2) * 0.25 + Math.abs(i - 1.5) * 0.2, 0, dark);
    }
    // ---- head: horned forge-helm, grated visor with burning eyes, crown of fire
    const head = piv(torso, 0, 3.05, 0.05);
    mesh(head, new THREE.CylinderGeometry(0.38, 0.46, 0.92, 7), iron, 0, 0.42, 0);
    box(head, 0.74, 0.58, 0.24, 0, 0.25, 0.37, dark, 0.22);               // faceplate
    box(head, 0.6, 0.08, 0.09, 0, 0.5, 0.44, this.eyeMat);                 // visor slit
    for (let i = 0; i < 3; i++) box(head, 0.05, 0.36, 0.06, (i - 1) * 0.16, 0.24, 0.5, this.jointMat, 0.22).castShadow = false;   // mouth grille glow
    mesh(head, new THREE.ConeGeometry(0.38, 0.5, 7), iron, 0, 1.1, -0.02);
    for (const s of [1, -1]) {                                              // swept horns, three tapered links each
      let h = piv(head, s * 0.4, 0.65, -0.05); h.rotation.set(-0.35, 0, s * -0.95);
      const R = [0.16, 0.12, 0.08], Ln = [0.65, 0.65, 0.7];
      for (let k = 0; k < 3; k++) {
        mesh(h, new THREE.CylinderGeometry(R[k] * 0.75, R[k], Ln[k], 6), k === 2 ? bronze : dark, 0, Ln[k] / 2, 0);
        const nx = piv(h, 0, Ln[k], 0); nx.rotation.set(-0.45, 0, s * 0.42); h = nx;
      }
      mesh(h, new THREE.ConeGeometry(0.07, 0.45, 5), bronze, 0, 0.22, 0);
    }
    const crown = piv(head, 0, 0.98, -0.05);
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.42, cx = Math.sin(a) * 0.3, cz = Math.cos(a) * 0.22 - 0.05;
      mesh(crown, new THREE.ConeGeometry(0.06, 0.34, 4), bronze, cx, 0.12, cz, -0.3, 0, (i - 2) * -0.28);
      flame(crown, 0.13, 0.75 + (i === 2 ? 0.35 : 0) - Math.abs(i - 2) * 0.08, cx, 0.18, cz, i * 1.7, 0xffd080);
    }
    // ---- arms
    const arms = {};
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R';
      const sh = piv(torso, s * 1.45, 2.45, 0);
      const pd = piv(sh, s * 0.15, 0.2, 0); pd.rotation.z = s * -0.38;      // layered pauldron
      mesh(pd, new THREE.SphereGeometry(0.96, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), dark, 0, 0, 0).scale.set(1.12, 0.88, 1.06);
      mesh(pd, new THREE.SphereGeometry(1.02, 8, 2, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.18), basalt, 0, -0.32, 0).scale.set(1.14, 1.0, 1.1);
      mesh(pd, new THREE.TorusGeometry(1.02, 0.065, 4, 16), bronze, 0, 0.0, 0, Math.PI / 2, 0, 0).scale.set(1.1, 1.05, 1);
      mesh(pd, new THREE.TorusGeometry(1.0, 0.035, 3, 16), this.jointMat, 0, -0.08, 0, Math.PI / 2, 0, 0, false).scale.set(1.1, 1.05, 1);   // molten under-rim
      for (let k = 0; k < 3; k++) mesh(pd, new THREE.ConeGeometry(0.12, 0.85 - k * 0.17, 5), iron, s * (0.1 + k * 0.32), 0.9 - k * 0.15, -0.1 + k * 0.05, -0.15, 0, s * (-0.25 - k * 0.3));
      glow(sh, 0.22, 0, -0.1, 0);
      seg(sh, 0.36, 0.3, 1.35, basalt, 7, -0.1);
      const el = piv(sh, 0, -1.48, 0);
      mesh(el, new THREE.OctahedronGeometry(0.3, 0), iron, 0, 0, -0.12);
      glow(el, 0.15, 0, 0, 0.12);
      seg(el, 0.31, 0.4, 1.0, basalt, 7, -0.05);
      mesh(el, new THREE.CylinderGeometry(0.55, 0.38, 0.58, 8), iron, 0, -1.0, 0.02);           // flared gauntlet cuff
      mesh(el, new THREE.TorusGeometry(0.5, 0.05, 4, 12), bronze, 0, -0.76, 0.02, Math.PI / 2, 0, 0);
      const hand = piv(el, 0, -1.45, 0.02);
      box(hand, 0.58, 0.52, 0.62, 0, -0.1, 0, dark);
      for (let k = 0; k < 3; k++) { box(hand, 0.15, 0.13, 0.64, (k - 1) * 0.18, -0.39, 0.05, iron); glow(hand, 0.06, (k - 1) * 0.18, -0.3, 0.38); }   // molten knuckles
      arms[L] = { sh, el, hand };
    }
    // ---- the forge hammer (right hand): octagonal head with cooling fins, gilded caps, glowing rune bands, heat halo
    const hammer = piv(arms.R.hand, 0, -0.1, 0);
    hammer.rotation.x = -1.05;
    mesh(hammer, new THREE.CylinderGeometry(0.1, 0.13, 4.6, 7), dark, 0, -2.0, 0);
    for (let k = 0; k < 3; k++) mesh(hammer, new THREE.CylinderGeometry(0.16, 0.16, 0.14, 7), bronze, 0, -0.35 - k * 1.25, 0);
    mesh(hammer, new THREE.OctahedronGeometry(0.24, 0), bronze, 0, 0.25, 0);   // pommel
    const headH = piv(hammer, 0, -4.2, 0);
    this.hammerHead = mesh(headH, new THREE.CylinderGeometry(0.82, 0.82, 2.3, 8), this.hammerMat, 0, 0, 0, Math.PI / 2, 0, Math.PI / 8);
    for (const e of [1, -1]) {
      mesh(headH, new THREE.CylinderGeometry(0.95, 0.88, 0.26, 8), bronze, 0, 0, e * 1.12, Math.PI / 2, 0, Math.PI / 8);
      mesh(headH, new THREE.CylinderGeometry(0.52, 0.8, 0.32, 8), this.hammerMat, 0, 0, e * 1.36, e * Math.PI / 2, 0, Math.PI / 8);
      for (let f = 0; f < 4; f++) box(headH, 0.06, 1.95, 0.08, 0, 0, e * (0.45 + f * 0.14), iron, 0, 0, f * 0.0).castShadow = false;   // cooling fins
    }
    this.runeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.7, 0.12) });
    mesh(headH, new THREE.TorusGeometry(0.84, 0.06, 4, 16), this.runeMat, 0, 0, 0.3, 0, 0, 0, false);
    mesh(headH, new THREE.TorusGeometry(0.84, 0.06, 4, 16), this.runeMat, 0, 0, -0.3, 0, 0, 0, false);
    mesh(headH, new THREE.ConeGeometry(0.28, 0.95, 6), iron, 0, 1.18, 0);
    this.hammerTip = headH;
    this.heatHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeRadialTexture(128, [[0, 'rgba(255,230,170,1)'], [0.25, 'rgba(255,150,50,.6)'], [0.6, 'rgba(255,80,10,.18)'], [1, 'rgba(255,40,0,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 }));
    this.heatHalo.scale.setScalar(3.6); this.heatHalo.renderOrder = 8; headH.add(this.heatHalo);
    // ---- the furnace glow seeping out of the chest (depth-tested sprite: the plates and grate occlude it)
    this.coreHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeRadialTexture(128, [[0, 'rgba(255,200,120,1)'], [0.3, 'rgba(255,110,30,.5)'], [1, 'rgba(255,40,0,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.4 }));
    this.coreHalo.position.set(0, 1.6, 0.9); this.coreHalo.scale.setScalar(2.0); this.coreHalo.renderOrder = 8; torso.add(this.coreHalo);
    // fire palm (left)
    this.palmL = arms.L.hand;
    glow(arms.L.hand, 0.2, 0, -0.32, 0.22);
    this.blob = makeBlobShadow(5.5); g.add(this.blob); this.blob.position.y = 0.016;
    this.parts_ = { body, torso, head, shL: arms.L.sh, elL: arms.L.el, handL: arms.L.hand, shR: arms.R.sh, elR: arms.R.el, hammer,
      thighL: legs.L.thigh, shinL: legs.L.shin, thighR: legs.R.thigh, shinR: legs.R.shin };
    const keep = new Set([this.coreMesh, this.hammerHead, this.blob, this.heatHalo, this.coreHalo, crown, ...this.chimneys]);
    for (const f of this.flames) keep.add(f.mesh);
    for (const k in this.parts_) keep.add(this.parts_[k]);
    mergeStaticMeshes(g, keep);
    // smoke from the chimneys (world space, so it trails behind her as she walks)
    this.smoke = new SmokePlume(80, { alpha: 0.72, dark: 0x1a1210, lit: 0xa03a10 }); scene.add(this.smoke.points);
    this.smokeT = 0;
    this.rig = new PoseRig(this.parts_, PYR_POSES);
    this.rig.set('idle').snap();
  }
  pose(name, speed) { this.rig.set(name, speed || 7); }

  // ------------------------------------------------------------ helpers
  get P() { return Game.player.pos; }
  forward(out, dist) { return out.set(this.pos.x + Math.sin(this.yaw) * dist, 0, this.pos.z + Math.cos(this.yaw) * dist); }
  hammerImpact(rot, power) {
    const ix = this.pos.x + Math.sin(rot) * 3.4, iz = this.pos.z + Math.cos(rot) * 3.4;
    // phones: the impact crescents fill most of a small frame and the bloom floods it white (mean luma ~150, 15%
    // near-white at a Twin Hammerfall landing) → half the additive energy and hot-orange (not white-gold) crescents
    const small = Math.min(View.w, View.h) < 600, ek = small ? 0.5 : 1;
    sfx('slam'); sfx('boom');
    BossKit.impact(ix, iz, 1.5, 0xffc070, PYR_DARK);
    CamRig.addTrauma(this.M.hammerfall.trauma * power);
    Post.kickBloom(0.25 * ek, 0.3);
    // molten wave rolling over the cone
    for (let k = 0; k < 7; k++) {
      const a = rot + (k - 3) / 3 * (this.M.hammerfall.angle * DEG * 0.45);
      Particles.cone(_v1.set(ix, 0.3, iz), _v2.set(Math.sin(a), 0.12, Math.cos(a)), 0.13, small ? 12 : 18, small ? 0xffb060 : 0xffd090, 0xff2a04, 15, 0.6, 0.42, -6, { intensity: 2.2 * (small ? 0.6 : 1), drag: 2.2 });
    }
    Particles.burst(_v1.set(ix, 0.6, iz), small ? 45 : 70, small ? 0xffd090 : 0xfff0c0, PYR_EMBER, 10, 1.0, 0.18, -12, { up: 7, intensity: 2.6 * (small ? 0.6 : 1), drag: 1.2 });
    for (let i = 0; i < 3; i++) SlashFX.spawn(this.pos.x, 0.25, this.pos.z, rot, 0, 4.5 + i * 3.2, i || small ? 0xff8a30 : 0xffd090, { dur: 0.16, hold: small ? 0.1 : 0.18, intensity: (2.4 - i * 0.4) * ek, tail: 0.9, delay: i * 0.06 });
    GroundFX.ring(ix, iz, 1, 9, 0xff7a30, 0.55, 0.5, 2.4 * (small ? 0.6 : 1));
  }

  // ------------------------------------------------------------ abilities
  /** HAMMERFALL (P1) / TWIN HAMMERFALL (P2+): 100° cone(s) locked at cast start */
  ab_hammerfall() {
    const H = this.M.hammerfall, twin = this.phase >= 1, p = this.P;
    const rot = yawTo(this.pos.x, this.pos.z, p.x, p.z);
    this.yaw = rot; this.lockYaw = rot; this.faceLock = true;
    this.pose('hammerUp', 6);
    Banner.show(twin ? 'TWIN HAMMERFALL' : 'HAMMERFALL', twin ? 'Front, then back' : null);
    const W = H.windup * this.windupMul, x = this.pos.x, z = this.pos.z;
    this.startCast(twin ? 'Twin Hammerfall' : 'Hammerfall', H.windup, { stingF: 175 });
    this.heatTarget = 1;
    Telegraphs.spawn({ shape: 'cone', x, z, rot, r: H.r, angle: H.angle, windup: H.windup, color: 'red', dmg: H.dmg, knock: H.knock, source: 'Hammerfall', major: true,
      onResolve: () => { this.pose('slam', 24); this.hammerImpact(rot, 1); this.heatTarget = twin ? 0.7 : 0; if (!twin) this.after(0.55, () => this.pose('idle', 5)); } });
    if (twin) {
      const rot2 = rot + Math.PI;
      Telegraphs.spawn({ shape: 'cone', x, z, rot: rot2, r: H.r, angle: H.angle, windup: W + H.twinDelay, rawWindup: true, color: 'red', dmg: H.dmg, knock: H.knock, source: 'Hammerfall',
        onResolve: () => { this.pose('slam', 24); this.hammerImpact(rot2, 1); this.heatTarget = 0; this.after(0.55, () => this.pose('idle', 5)); } });
      this.after(W + 0.12, () => { this.lockYaw = rot2; this.pose('hammerUp', 14); });
    }
    return W + (twin ? H.twinDelay : 0) + 0.7;
  }

  /** SLAG RAIN: 3 random circles + 1 on the player (staggered 0.3 s); molten globs land at resolve; burning pools */
  ab_slagRain() {
    const S = this.M.slagRain, p = this.P;
    Banner.show('SLAG RAIN', 'Keep moving');
    this.pose('raised', 6);
    this.startCast('Slag Rain', 1.0, { stingF: 196 });
    const n = S.count + (this.heroic ? S.heroicExtra : 0);
    const pts = [];
    for (let i = 0; i < n - 1; i++) pts.push(BossKit.randomArenaPoint(new THREE.Vector3(), 3, this.arena.radius - 3, 1.6));
    pts.splice(Math.min(1, pts.length), 0, new THREE.Vector3(p.x, 0, p.z));                    // the one on the player lands second
    const W = S.windup * this.windupMul;
    pts.forEach((pt, i) => {
      const delay = i * S.stagger;
      Telegraphs.spawn({ shape: 'circle', x: pt.x, z: pt.z, r: S.r, windup: S.windup, delay, color: 'red', dmg: S.dmg, source: 'Slag Rain', major: i === 0, sfx: null,
        onResolve: (t) => {
          sfx('boom'); CamRig.addTrauma(0.14);
          Particles.burst(_v1.set(t.x, 0.4, t.z), 80, 0xffe0a0, 0xff3a08, 9, 0.8, 0.32, -14, { flat: true, intensity: 2.4, up: 4 });
          Particles.burst(_v1.set(t.x, 0.8, t.z), 30, 0x3a2a24, 0x120a08, 4, 1.4, 0.7, 1.5, { intensity: 0.6, drag: 1.5 });
          GroundFX.ring(t.x, t.z, 0.5, 4.6, 0xff8a40, 0.5, 0.35, 2.6);
          Rubble.spawn(t.x, 0.4, t.z, fxRange(-4, 4), fxRange(5, 8), fxRange(-4, 4), { life: 1.5, scale: 0.5 });
          PointLights.flash(_v1.set(t.x, 1.4, t.z), 0xff7a2a, 26, 0.3);
          const P = S.pool;
          this.arena.pool(t.x, t.z, P.r, P.life);
          Hazards.spawn({ shape: 'circle', x: t.x, z: t.z, r: P.r, life: P.life, tickDmg: P.tick, tickInterval: P.every, firstTickDelay: 0.25, color: 'red', source: 'Slag Pool', lingering: true, interior: 0.35, fadeIn: 0.2 });
        } });
      // the glob: flung from the north (Vorath's forge) on a ballistic arc that lands exactly at resolve
      const T = S.flight, land = delay + W - T;
      this.after(Math.max(0, land), () => {
        const from = _v1.set(pt.x * 0.35 + fxRange(-6, 6), 34, -40 + fxRange(-5, 5)), g = -22;
        const v = BossKit.ballistic(from, _v2.set(pt.x, 0, pt.z), Math.min(T, W + delay), g, _v3);
        Projectiles.spawn({ kind: 'orb', x: from.x, y: from.y, z: from.z, vx: v.x, vy: v.y, vz: v.z, gravity: g, friendly: true, color: 0xff6a1c, size: 1.6, life: T + 0.5 });
      }, { keep: false });
    });
    this.after(1.2, () => this.pose('idle', 4));
    return 1.4;
  }

  /** INCINERATE: interruptible 2.5 s cast; open palm with fire streaming inward */
  ab_incinerate() {
    const I = this.M.incinerate;
    Banner.show('INCINERATE', 'Interrupt it!', { cls: 'violet' });
    this.pose('palm', 5);
    if (!Save.seenHint('incinerateHint')) Hint.show(Input.lastTouch ? 'Violet cast bar = interruptible. Tap your STASIS LANCE now!' : 'Violet cast bar = interruptible. Throw your Stasis Lance (F) now!', 4.5, null, this, 'Incinerate');
    this.startCast('Incinerate', I.cast, { interruptible: true, stingF: 247,
      onComplete: () => {
        const pl = Game.player; this.pose('slam', 10); this.after(0.6, () => this.pose('idle', 4));
        const from = this.palmWorld, yaw = yawTo(from.x, from.z, pl.pos.x, pl.pos.z), d = dist2(from.x, from.z, pl.pos.x, pl.pos.z);
        Beams.flash(from.x, from.y, from.z, yaw, d + 3, 1.0, 0xff6a20, 0.45);
        Particles.cone(from, _v2.set(pl.pos.x - from.x, 1.0 - from.y, pl.pos.z - from.z).normalize(), 0.12, 90, 0xffc070, 0xff3a08, 34, 0.55, 0.36, 0, { intensity: 1.8, drag: 1 });
        sfx('explode'); sfx('ultRelease'); CamRig.addTrauma(0.3); Post.kickBloom(0.4, 0.4);
        if (pl.alive && !pl.invuln) {
          pl.damage({ amount: I.dmg, source: 'Incinerate', avoidable: true });
          pl.addStatus('burning', I.burn, { stacks: 1 });
          Game.stats.mechanicsFailed++;
        }
        Particles.burst(_v1.set(pl.pos.x, 1, pl.pos.z), 120, 0xffd080, 0xff3a08, 9, 0.9, 0.3, 2, { intensity: 2.4 });
        GroundFX.ring(pl.pos.x, pl.pos.z, 0.5, 4, 0xff7a2a, 0.5, 0.4, 2.6);
      },
      onInterrupt: () => {
        this.pose('roar', 9); this.after(0.8, () => this.pose('idle', 4));
        Particles.burst(this.palmWorld, 80, 0xd8c0ff, 0x401008, 6, 0.8, 0.25, 2, { intensity: 2 });
      } });
    return 0.5;
  }

  /** CINDERLINGS: 3 lava-orb adds from random pylons walking to Pyrrha (STOKED on contact; detonate if killed beside her) */
  ab_cinderlings() {
    const C = this.M.cinderlings;
    Banner.show('CINDERLINGS', 'Kill them beside Pyrrha');
    if (!Save.seenHint('cinderHint')) Hint.show('Cinderlings empower Pyrrha if they reach her. Kill one within 5 m of her and it detonates on her for 1200!', 5.5);
    const order = [0, 1, 2, 3].sort(() => rand() - 0.5);
    const pyl = this.arena.pylons;
    for (let i = 0; i < C.count; i++) {
      const pl = pyl[order[i]], k = 14.5 / 17;
      this.arena.pylons[order[i]].litT = this.arena.pylons[order[i]].lit < 1 ? 0 : -1;
      Particles.burst(_v1.set(pl.x, 5.5, pl.z), 60, 0xffe0a0, PYR_EMBER, 8, 0.8, 0.35, -8, { up: 3, intensity: 2.4 });
      Particles.line(_v1.set(pl.x, 5.5, pl.z), _v2.set(pl.x * k, 1.2, pl.z * k), 20, 0xffc070, PYR_EMBER, 0.5, 0.3, { intensity: 2.2 });
      this.after(0.35 + i * 0.12, () => spawnBossAdd({
        x: pl.x * k, z: pl.z * k, hp: C.hp * Game.diff.hp, speed: C.speed, radius: 0.65, color: 0xff6a1c, name: 'Cinderling', height: 1.2, size: C.size,
        seek: 'boss', explodeNearBoss: true, footprints: 0xff5a10, data: { priorityTarget: true },     // auto-target them even beside Pyrrha (the graft is the point)
        onReachBoss: (a) => {
          const b = Game.boss; b.addStatus('stoked', Infinity, { stacks: b.statusStacks('stoked') + 1 });
          Banner.show('STOKED', '+' + Math.round(CONFIG.boss.stokedMul * 100 * b.statusStacks('stoked')) + '% boss damage', { cls: 'gold' });
          sfx('explode'); CamRig.addTrauma(0.2); Post.kickBloom(0.3, 0.4);
          Particles.burst(b.hitPoint, 120, 0xffe0a0, 0xff3a08, 8, 0.9, 0.35, 0, { spread: 1.5, intensity: 2.6 });
          Game.stats.mechanicsFailed++;
        },
      }));
    }
    this.pose('roar', 8); this.after(0.9, () => this.pose('idle', 4));
    sfx('rumble', { dur: 1 });
    return 0;
  }

  /** IN / OUT: alternating FORGE RING (donut, safe beside her) and ERUPTION (circle on her) */
  ab_inOut() {
    const O = this.M.inOut, inn = this.nextIn; this.nextIn = !inn;
    const x = this.pos.x, z = this.pos.z, off = Math.hypot(x, z);
    if (inn) {
      Banner.show('FORGE RING', 'Get close!');
      this.pose('crossed', 6);
      this.startCast('Forge Ring', O.windup, { stingF: 165 });
      Telegraphs.spawn({ shape: 'donut', x, z, r: this.arena.radius + off + 0.6, inner: O.ringInner, windup: O.windup, color: 'red', dmg: O.dmg, source: 'Forge Ring', major: true, wide: true,
        onResolve: () => {
          this.pose('raised', 18); this.after(0.6, () => this.pose('idle', 4));
          sfx('slam'); sfx('explode'); CamRig.addTrauma(0.4); Post.kickBloom(0.35, 0.4);
          for (let i = 0; i < 3; i++) Particles.ring(_v1.set(x, 0, z), O.ringInner + 1 + i * 5, 70, 0xffe0a0, 0xff3a08, 4, 0.9, 0.45, { up: 9, intensity: 2.2, gravity: -6 });
          for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, r = O.ringInner + 2 + (i % 3) * 5; Particles.cone(_v1.set(x + Math.sin(a) * r, 0.2, z + Math.cos(a) * r), UP, 0.25, 12, 0xffd090, 0xff3a08, 12, 0.7, 0.45, -8, { intensity: 2.2 }); }
          GroundFX.ring(x, z, O.ringInner, O.ringInner + 16, 0xff8a40, 0.4, 0.8, 1.6);
        } });
      if (this.story) Telegraphs.spawn({ shape: 'circle', x, z, r: O.ringInner - 0.6, windup: O.windup, color: 'green', dmg: 0, silent: true, sfx: null });
    } else {
      Banner.show('ERUPTION', 'Get out!');
      this.pose('raised', 6);
      this.startCast('Eruption', O.windup, { stingF: 165 });
      Telegraphs.spawn({ shape: 'circle', x, z, r: O.eruptR, windup: O.windup, color: 'red', dmg: O.dmg, source: 'Eruption', major: true,
        onResolve: () => {
          this.pose('slam', 18); this.after(0.6, () => this.pose('idle', 4));
          sfx('slam'); sfx('explode'); CamRig.addTrauma(0.42); Post.kickBloom(0.4, 0.4);
          Particles.burst(_v1.set(x, 0.5, z), 220, 0xfff0c0, 0xff3a08, 14, 1.0, 0.4, -10, { spread: 2, up: 9, intensity: 2.4 });
          Particles.ring(_v1.set(x, 0, z), 1.5, 140, 0xffd090, 0xff3a08, 12, 0.7, 0.4, { up: 3, intensity: 2.4 });
          GroundFX.ring(x, z, 1, O.eruptR + 1, 0xffc070, 0.55, 0.6, 3);
          PointLights.flash(_v1.set(x, 3, z), 0xff8a40, 90, 0.45);
        } });
      if (this.story) Telegraphs.spawn({ shape: 'donut', x, z, r: O.eruptR + 6, inner: O.eruptR + 0.6, windup: O.windup, color: 'green', dmg: 0, silent: true, sfx: null });
    }
    return O.windup * this.windupMul + 0.6;
  }

  /** TITAN'S PALM (P3): Vorath slams one half of the arena; the shadow of his hand darkens it as it fills */
  ab_titansPalm() {
    const P = this.M.palm, east = rand() < 0.5, side = east ? 1 : -1;
    const W = P.windup * this.windupMul, R = this.arena.radius;
    Banner.show("TITAN'S PALM", east ? 'Cross to the WEST' : 'Cross to the EAST', { dur: 1.2 });
    sfx('rumble', { dur: W });
    const ar = this.arena; ar.shadeSide = side; ar.handShadow = 1;
    Telegraphs.spawn({ shape: 'halfplane', x: 0, z: 0, rot: east ? Math.PI / 2 : -Math.PI / 2, r: R + 0.6, windup: P.windup, color: 'red', dmg: P.dmg, source: "Titan's Palm", major: true, wide: true,
      onUpdate: (t) => { ar.shade = t.progress * 0.85; },
      onResolve: () => {
        ar.shade = 0; ar.palmSide = side; ar.palmHeat = 1;
        CamRig.addTrauma(P.trauma); sfx('slam'); sfx('explode'); sfx('rumble', { dur: 1.6 }); Post.kickBloom(0.25, 0.5); Post.kickCA(0.004);
        for (let i = 0; i < 9; i++) { const z = -18 + i * 4.5, x = side * fxRange(4, 16); Particles.burst(_v1.set(x, 0.5, z), 34, 0xffd8a0, 0xff4a10, 11, 0.9, 0.4, -12, { spread: 3, flat: true, intensity: 1.7, up: 3 }); }
        for (let i = 0; i < 5; i++) this.smoke.emit(side * fxRange(5, 16), 0.6, fxRange(-14, 14), fxRange(-1, 1), fxRange(2, 3.5), fxRange(-1, 1), fxRange(2.2, 3.2), 2.5, 7, 0.8);
        for (let i = 0; i < 6; i++) Rubble.spawn(side * fxRange(3, 18), 0.5, fxRange(-16, 16), fxRange(-4, 4), fxRange(6, 11), fxRange(-4, 4), { life: 2, scale: fxRange(0.6, 1.2) });
        GroundFX.ring(side * 10, 0, 2, 22, 0xffd090, 0.9, 1.2, 2.6);
        PointLights.flash(_v1.set(side * 10, 4, 0), 0xff9a40, 70, 0.6);
      } });
    if (this.story) Telegraphs.spawn({ shape: 'halfplane', x: 0, z: 0, rot: east ? -Math.PI / 2 : Math.PI / 2, r: R - 1, windup: P.windup, color: 'green', dmg: 0, silent: true, sfx: null });
    // Vorath: west hand rises, hovers over the half, slams at resolve; the sun hand comes down
    const v = this.vorath, hx = side * 10.5;
    v.cancelSeqs();
    v.tween('lean', 0.3, W * 0.6);
    v.moveHand('W', _v5.set(hx, 30, -26), _v6.set(0, -0.45, 1), _v7.set(0, 1, 0.4), 0.35, W * 0.45, 'out');
    v.seq(W * 0.45, () => v.moveHand('W', _v5.set(hx, 15, -15), _v6.set(0, -0.2, 1), _v7.set(0, 1, 0.1), 0.25, W * 0.55 - 0.16, 'inOut'));
    v.seq(W - 0.16, () => v.moveHand('W', _v5.set(hx, 2.1, -12), _v6.set(0, -0.04, 1), _v7.set(0, 1, 0), 0.12, 0.16, 'in'));
    v.seq(W + 0.75, () => { v.tween('lean', 0, 1.4); ar.handShadow = 0; v.gripPose(false, 'W', 1.5); });
    v.moveHand('E', _v5.set(22, 1.5, -38), _v6.set(-0.6, 0.3, 0.6), _v7.set(0.15, -1, 0.1), 0.7, W, 'inOut');
    v.seq(W + 0.8, () => v.holdSunLow(1.6));
    return 0;
  }

  /** SHOCKWAVE STOMP (P3): three stomps 0.8 s apart; each ring expands at 10 m/s and cannot be outrun */
  ab_stomp() {
    const S = this.M.stomp, x = this.pos.x, z = this.pos.z, off = Math.hypot(x, z);
    Banner.show('SHOCKWAVE STOMP', 'Dash through the rings');
    if (!Save.seenHint('stompHint')) Hint.show('Rings cannot be outrun: Phase Step THROUGH each ring as it reaches you.', 4.5);
    this.pose('stompUp', 7);
    this.startCast('Shockwave Stomp', S.tell, { stingF: 147 });
    Telegraphs.spawn({ shape: 'circle', x, z, r: 3, windup: S.tell, color: 'red', dmg: 0, sfx: null, noFlash: false });
    const t0 = S.tell * this.windupMul;
    for (let i = 0; i < S.count; i++) {
      this.after(t0 + i * S.gap, () => {
        this.pose('stompDown', 26);
        sfx('slam'); CamRig.addTrauma(0.3); Post.kickBloom(0.15, 0.2);
        Particles.burst(_v1.set(x, 0.3, z), 60, 0xffd0a0, PYR_DARK, 9, 0.7, 0.4, -12, { flat: true, intensity: 2 });
        Particles.ring(_v1.set(x, 0, z), 1.0, 110, 0xffc070, 0xff2a04, S.speed, 2.3, 0.35, { up: 0.6, drag: 0, intensity: 2.2 });
        BossKit.shockRing({ x, z, speed: S.speed, width: S.width, maxR: this.arena.radius + off + 1, dmg: S.dmg, source: 'Shockwave Stomp' });
        if (i < S.count - 1) this.after(0.32, () => this.pose('stompUp', 14));
        else this.after(0.5, () => this.pose('idle', 4));
      });
    }
    return t0 + (S.count - 1) * S.gap + 0.7;
  }

  /** OVERHEAT at 10%: the core goes white and she takes +25% damage for 6 s */
  sp_overheat() {
    const O = this.M.overheat;
    this.addStatus('overheat', O.dur);
    Banner.show('OVERHEAT — STRIKE NOW', '+25% damage taken', { cls: 'gold', dur: 1.8 });
    sfx('bell', { f: 196 }); sfx('explode'); Post.kickBloom(0.3, 0.6); CamRig.addTrauma(0.25);
    Particles.burst(this.hitPoint, 120, 0xffe0b0, 0xffa040, 9, 1.0, 0.3, 3, { spread: 1.2, intensity: 1.8 });
    if (!this.cast) { this.pose('overheat', 9); this.after(1.0, () => this.pose('idle', 3)); }
  }

  // ------------------------------------------------------------ transitions
  /** 60%: THE STOLEN SUN */
  transition_1() {
    const v = this.vorath, ar = this.arena, P = this.pos, c0 = camera.position.clone(), l0 = CamRig.look.clone();
    this.pose('roar', 5);
    const sunGrab = v.sunPos.clone();
    const grab = () => { if (v.sunMode !== 'sky') return; v.sunMode = 'held'; Post.kickBloom(0.9, 0.7); CamRig.addTrauma(0.35); sfx('explode'); sfx('bell', { f: 131 });
      Particles.burst(v.sunPos, 200, 0xfff0c0, 0xff7a20, 14, 1.4, 1.4, -4, { spread: 8, intensity: 2.6 }); };
    const final = () => { grab(); v.holdSunAloft(0); ar.setNoon(1, 0); ar.tween('heat', 1, 0); ar.igniteAll(true); this.pose('idle', 4); };
    return {
      dur: 4.6, ease: 'inOut', letterbox: true, skippable: true, blendOut: 0.8,
      pos: [c0, [P.x + 5, 5.5, P.z + 8], [3, 13, 22], [-4, 15, 30]],
      tgt: [l0, [P.x, 4, P.z], [10, 16, -70], [16, 38, -64]],
      fov: [CONFIG.camera.fov, 52, 58, 62], roll: [0, -1.5, 1.5, 0],
      events: [
        { t: 0.1, fn: () => { sfx('rumble', { dur: 4 }); v.cancelSeqs(); } },
        { t: 0.35, fn: () => { v.moveHand('E', _v5.set(26, 22, -46), _v6.set(0.3, 0.6, -0.5), _v7.set(0, 0.5, 0.8), 0.25, 0.8, 'out'); CamRig.addTrauma(0.2); } },
        { t: 1.1, fn: () => v.moveHand('E', _v5.copy(sunGrab).add(_v6.set(-5, -7, 8)), _v6.set(0.45, 0.2, -1), _v7.set(0, 1, 0), 0.25, 0.75, 'inOut') },
        { t: 1.75, fn: () => { v.moveHand('E', _v5.copy(sunGrab).add(_v6.set(-5, -7, 8)), _v6.set(0.45, 0.2, -1), _v7.set(0, 1, 0), 1.2, 0.18, 'in'); } },
        { t: 1.95, fn: grab },
        { t: 2.05, fn: () => { v.holdSunAloft(1.55); ar.setNoon(1, 1.9); Post.setExposure(CONFIG.bosses[0].exposure * 0.92, 1.5); } },
        { t: 2.9, fn: () => { ar.tween('heat', 1, 1.0); ar.igniteAll(false); Post.kickBloom(0.7, 0.8); } },
        { t: 3.3, fn: () => { PhaseTitle.show('PHASE II', 'PRIORITIES'); sfx('bell', { f: 175 }); } },
      ],
      onDone: () => final(),
    };
  }
  /** 25%: SUNFALL — the titan brings the sun down beside the arena */
  transition_2() {
    const v = this.vorath, P = this.pos, c0 = camera.position.clone(), l0 = CamRig.look.clone();
    this.pose('roar', 5);
    const final = () => { v.holdSunLow(0); v.tween('lean', 0, 0); this.pose('idle', 4); };
    return {
      dur: 4.0, ease: 'inOut', letterbox: true, skippable: true, blendOut: 0.8,
      pos: [c0, [P.x - 6, 1.6, P.z + 6], [P.x - 3, 1.2, P.z + 9], [-2, 9, 20]],
      tgt: [l0, [P.x, 5, P.z], [16, 20, -50], [20, 8, -42]],
      fov: [CONFIG.camera.fov, 56, 48, 52], roll: [0, 2.5, -1, 0],
      events: [
        { t: 0.1, fn: () => { sfx('rumble', { dur: 3.5 }); v.cancelSeqs(); v.tween('lean', 0.22, 1.6); } },
        { t: 0.6, fn: () => { v.holdSunLow(2.2); Post.kickBloom(0.4, 1.0); } },
        { t: 2.0, fn: () => { CamRig.addTrauma(0.4); PhaseTitle.show('PHASE III', 'SUNFALL'); sfx('bell', { f: 147 }); this.pose('slam', 10); BossKit.impact(P.x, P.z + 2, 1.2, 0xffc070, PYR_DARK); } },
        { t: 3.0, fn: () => { v.tween('lean', 0, 1.2); this.pose('idle', 4); } },
      ],
      onDone: () => final(),
    };
  }
  onPhaseEnter(n, instant) {
    const v = this.vorath, ar = this.arena;
    if (n === 1 && instant) { v.sunMode = 'held'; v.holdSunAloft(0); ar.setNoon(1, 0); ar.tween('heat', 1, 0); ar.igniteAll(true); v.update(0); }
    if (n === 2 && instant) { v.sunMode = 'held'; v.holdSunLow(0); ar.setNoon(1, 0); ar.tween('heat', 1, 0); ar.igniteAll(true); v.update(0); }
    if (n >= 1) Post.setGrade({ lift: [0.02, 0.008, 0], gain: [1.04, 1.0, 0.94], gamma: [1, 1, 1], sat: 1.0 }, instant ? 0 : 1.5);
    if (n === 2) this.nextIn = true;
  }
  onPhaseExit() { this.arena.shade = 0; this.arena.handShadow = 0; this.vorath.cancelSeqs(); this.vorath.gripPose(false, 'W', 0.8); this.heatTarget = 0; }

  // ------------------------------------------------------------ enrage: MELTDOWN
  onEnrage() {
    const D = this.M.meltdown, ar = this.arena;
    Banner.show('MELTDOWN', 'The forge consumes everything', { cls: 'gold', dur: 2.2 });
    logEvent('enrage', { name: 'Meltdown' });
    this.cast = null; Telegraphs.clearAll(); Timers.cancelTag('boss'); this.epoch++;
    this.pose('raised', 4);
    sfx('rumble', { dur: D.dur }); CamRig.addTrauma(0.5);
    const v = this.vorath; v.cancelSeqs();
    for (const k of ['E', 'W']) { const s = v.hands[k].side; if (k === 'E' && v.sunMode === 'held') continue; v.moveHand(k, _v5.set(s * 9, 9, -30), _v6.set(-s * 0.1, -0.6, 1), _v7.set(0, 1, 0.5), 1.4, 1.2, 'out'); }
    ar.meltR = ar.radius + 0.5;
    this.meltHz = Hazards.spawn({ shape: 'donut', x: 0, z: 0, r: ar.radius + 6, inner: ar.radius + 0.5, life: Infinity, tickDmg: D.dps * 0.25, tickInterval: 0.25, color: 'red', source: 'Meltdown', avoidable: false, gentle: false, wide: true, fadeIn: 0.3, visible: false });      // the floor shader draws the lava (uMeltR)
  }
  updateEnrage(dt) {
    const D = this.M.meltdown, ar = this.arena;
    ar.meltR = Math.max(0, ar.meltR - (ar.radius / D.dur) * dt);
    if (this.meltHz && this.meltHz.active) this.meltHz.inner = Math.max(0, ar.meltR);
    if (fxRand() < dt * 30) {
      const a = fxRange(0, TAU), r = ar.meltR + fxRange(0, 1.5);
      Particles.burst(_v1.set(Math.sin(a) * r, 0.3, Math.cos(a) * r), 6, 0xffd090, 0xff3a08, 4, 0.7, 0.35, -8, { up: 4, intensity: 1.8 });
    }
    if (fxRand() < dt * 8) { const a = fxRange(-1, 1), r = ar.radius; Particles.cone(_v1.set(Math.sin(a) * r, 2, -Math.cos(a) * r), _v2.set(-Math.sin(a), -0.3, Math.cos(a)), 0.3, 10, 0xffc070, 0xff3a08, 8, 1.0, 0.6, -14, { intensity: 2.4 }); }
  }

  // ------------------------------------------------------------ death beat: Vorath cracks, sinks, the sun drops, the sea turns gold
  onDeathStart() {
    this.arena.shade = 0; this.arena.handShadow = 0; this.arena.meltR = 99; this.heatTarget = 0;
    this.vorath.cancelSeqs();
  }
  deathBeat() {
    const v = this.vorath, ar = this.arena;
    return {
      dur: 6.2, ease: 'inOut', letterbox: true, skippable: true, blendOut: 1.0,
      pos: [[0, 7, 18], [2, 6, 12], [4, 5, 6], [2, 7, 4]],
      tgt: [[0, 16, -70], [0, 18, -70], [6, 6, -76], [14, 3, -90]],
      fov: [54, 52, 54, 58], roll: [0, 1.5, -1, 0],
      events: [
        { t: 0.2, fn: () => { v.tween('crack', 1, 1.2); v.rays.visible = true; sfx('rumble', { dur: 5 }); sfx('bell', { f: 98 }); } },
        { t: 0.9, fn: () => { v.tween('headPitch', -0.55, 1.0); CamRig.addTrauma(0.35); sfx('explode');
          for (const k of ['E', 'W']) { const s = v.hands[k].side; v.moveHand(k, _v5.set(s * 20, 26, -44), _v6.set(s * 0.3, 0.7, -0.3), _v7.set(0, 0.4, 1), 0.2, 1.3, 'out'); } } },
        { t: 1.5, fn: () => {
          v.tween('rootY', -72, 3.8, 'in'); v.tween('lean', -0.2, 3.0);
          if (v.sunMode === 'held') { v.sunMode = 'falling'; v.sunVel.set(4, 8, -16); }
          v.onSunSplash = (p) => {
            sfx('explode'); sfx('grandShatter'); CamRig.addTrauma(0.5); Post.kickBloom(0.45, 1.2);
            Particles.burst(_v1.set(p.x, -4, p.z), 220, 0xffe0a0, 0xffa020, 26, 2.0, 1.8, -10, { spread: 8, up: 18, intensity: 1.8 });
            ar.tween('gold', 1, 2.6); ar.tween('cool', 0.35, 3.0);
            ar.lavaRing = { x: p.x, z: p.z, r: 0 };
            TimeFX.slowMo(0.35, 1.4);
          };
        } },
        { t: 1.8, fn: () => { for (const k of ['E', 'W']) { const s = v.hands[k].side; v.moveHand(k, _v5.set(s * 26, -20, -50), _v6.set(0, 0.8, 0.2), _v7.set(0, 0, -1), 0.6, 3.0, 'in'); } } },
        { t: 2.4, fn: () => { for (let i = 0; i < 4; i++) Particles.burst(_v1.set(fxRange(-14, 14), -4, -70 + fxRange(-6, 6)), 80, 0xffd090, 0xff3a08, 14, 1.6, 1.6, -12, { up: 14, spread: 6, intensity: 2.2 }); } },
        { t: 4.6, fn: () => { v.tween('crack', 0, 1.5); } },
      ],
      onDone: () => { v.sunMode = 'gone'; v.tween('rootY', -90, 0); ar.tween('gold', 1, 0); v.rays.visible = false; },
    };
  }

  // ------------------------------------------------------------ per-step + visuals
  onUpdate(dt) {
    if (this.lockYaw != null && this.faceLock) this.yaw = angDamp(this.yaw, this.lockYaw, 16, dt);
    if (this.free && this.faceLock && this.busyT <= 0) { this.faceLock = false; this.lockYaw = null; }
    // cast heat on the hammer head
    const c = this.cast;
    const castHeat = c && (c.name === 'Hammerfall' || c.name === 'Twin Hammerfall') ? c.t / c.dur : 0;   // only while the cast runs
    this.hammerHeat = damp(this.hammerHeat, Math.max(this.heatTarget, castHeat), 6, dt);
    // Incinerate: fire streams inward into the open palm
    if (c && c.name === 'Incinerate' && this.frozenT <= 0) {
      this.palmFxT -= dt;
      if (this.palmFxT <= 0) { this.palmFxT = 0.045; Particles.converge(this.palmWorld, 5, 3.6 - 1.4 * (c.t / c.dur), 0xffe0a0, 0xff3a08, 0.42, 0.3, { intensity: 2.4 }); }
    }
    // walking dust / footfalls
    if (this.free && this.alive) {
      const mv = dist2(this.pos.x, this.pos.z, this.prevPos.x, this.prevPos.z);
      if (mv > 0.001) { this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.55; sfx('tap'); GroundFX.ring(this.pos.x, this.pos.z, 0.8, 2.6, 0xff6a20, 0.4, 0.25, 1.4); Particles.burst(_v1.set(this.pos.x, 0.2, this.pos.z), 10, 0xff8a40, 0x200804, 3, 0.6, 0.3, -3, { flat: true }); } }
    }
    if (this.hasStatus('overheat') && fxRand() < dt * 30) Particles.trailPoint(_v1.set(this.pos.x + fxRange(-1, 1), fxRange(2, 6), this.pos.z + fxRange(-1, 1)), 0xffe0b0, 0xffa040, 0.8, 0.25, { vy: 3, intensity: 1.6 });
  }
  onSync(alpha, dt) {
    const t = Game.realTime;
    // walking pose
    if (this.alive && this.free && this.rig.name === 'idle') {
      const mv = this.vis.distanceTo(this.prevPos) > 0.0005 ? 1 : 0;
      this.walkK = damp(this.walkK || 0, mv, 6, dt);
      const ph = t * 4.2, w = this.walkK;
      this.rig.add('thighL', Math.sin(ph) * 0.45 * w); this.rig.add('thighR', -Math.sin(ph) * 0.45 * w);
      this.rig.add('shinL', Math.max(0, -Math.sin(ph)) * 0.6 * w); this.rig.add('shinR', Math.max(0, Math.sin(ph)) * 0.6 * w);
      this.rig.add('body', 0, 0, 0, 0, -Math.abs(Math.cos(ph)) * 0.12 * w, 0);
      this.rig.add('torso', 0.08 * w, Math.sin(ph) * 0.08 * w, 0);
      this.rig.add('shL', -Math.sin(ph) * 0.3 * w); this.rig.add('shR', Math.sin(ph) * 0.15 * w);
    }
    // breathing
    this.rig.add('torso', Math.sin(t * 1.6) * 0.025, 0, 0); this.rig.add('head', Math.sin(t * 1.6 + 1) * 0.03, Math.sin(t * 0.7) * 0.05, 0);
    // core flicker, overheat white
    const oh = this.hasStatus('overheat') ? 1 : 0;
    this.overheatV = damp(this.overheatV, oh, 4, dt);
    const fl = 0.8 + 0.2 * Math.sin(t * 13.0) * Math.sin(t * 7.3) + (this.cast ? 0.25 : 0);
    this.coreMat.color.setRGB(3.2 * fl, 1.15 * fl, 0.22 * fl).lerp(_c1.setRGB(3.4, 2.1, 0.9), this.overheatV);      // the core goes white-gold (QA: full white blew her whole torso out)
    this.jointMat.color.setRGB(2.4 * fl, 0.7 * fl, 0.12 * fl).lerp(_c1.setRGB(2.6, 1.3, 0.4), this.overheatV * 0.6);
    const live = 1 - (this.dissolve || 0);
    if (live < 1) { this.coreMat.color.multiplyScalar(live); this.jointMat.color.multiplyScalar(live); }
    this.innerMat.uniforms.uIntensity.value = (0.8 + this.overheatV * 0.4 + (this.cast ? 0.25 : 0)) * live;
    this.innerMat.uniforms.uWhite.value = this.overheatV * 0.12;
    for (const m of this.arcane) {
      const u = m.userData.arcane;
      u.uRimColor.value.setRGB(1, 0.35, 0.1).lerp(_c1.setRGB(1, 0.6, 0.25), this.overheatV * 0.35);   // QA: a full white-gold rim turned every plate glassy
      if (m.userData.rim0 == null) m.userData.rim0 = u.uRim.value;
      u.uRim.value = m.userData.rim0 * (1 - 0.6 * this.overheatV);                  // the furnace blazes, the plates stay dark (readable silhouette)
      u.uFlashColor.value.setRGB(1, 0.78, 0.55);                                  // forge-warm hit flash (white clips on bloom)
      if (u.uFracture.value > 1.4) u.uFracture.value = 1.4;                       // grand-shatter blaze stays readable
    }
    // hammer head heat (uHeatCast): dull iron → cherry → molten gold (never flat white: the shape must stay readable)
    const h = this.hammerHeat;
    this.hammerMat.emissive.setRGB(1, lerp(0.16, 0.6, h * h), lerp(0.02, 0.18, h * h * h));
    this.hammerMat.emissiveIntensity = 0.12 + h * 2.1;
    this.runeMat.color.setRGB(2.4, 0.7 + h * 0.9, 0.12 + h * 0.3).multiplyScalar((0.75 + 0.25 * fl) * live);
    this.heatHalo.material.opacity = clamp01(h * 1.1 - 0.1) * 0.7 * live;
    this.heatHalo.scale.setScalar(2.6 + h * 2.2);
    // furnace glow, magma seams, fire
    this.coreHalo.material.opacity = (0.2 + 0.08 * fl + this.overheatV * 0.07 + (this.cast ? 0.08 : 0)) * live;
    this.veinU.uVein.value = (0.5 + 0.25 * Math.sin(t * 1.3) * Math.sin(t * 0.7) + this.overheatV * 0.08 + h * 0.3) * live;
    this.veinU.uVeinHot.value = this.overheatV * 0.3;
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i]; f.mat.uniforms.uAmt.value = (0.85 + 0.25 * Math.sin(t * 9 + i * 2.1) + this.overheatV * 0.6 + (this.cast ? 0.25 : 0)) * live;
      f.mesh.scale.y = 1 + 0.12 * Math.sin(t * 7 + i) + this.overheatV * 0.5;
    }
    // chimney smoke + sparks (world space)
    if (this.alive && live > 0.5) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = this.cast ? 0.07 : 0.12;
        for (const m of this.chimneys) {
          m.getWorldPosition(_v1);
          this.smoke.emit(_v1.x, _v1.y, _v1.z, fxRange(-0.3, 0.3), fxRange(1.8, 2.8), fxRange(-0.3, 0.3) - 0.5, fxRange(2.8, 3.8), 0.8, fxRange(3.4, 4.8), 1);
          if (fxRand() < 0.5) Particles.trailPoint(_v1, 0xffd090, PYR_EMBER, fxRange(0.7, 1.2), 0.16, { vy: 4.5, intensity: 2.2, jitter: 0.5 });
        }
      }
    }
    this.smoke.update(dt);
    // point light on the core
    if (this.light) {
      this.coreMesh.getWorldPosition(this.light.position); this.light.position.x += Math.sin(this.visYaw || this.yaw) * 2.2; this.light.position.z += Math.cos(this.visYaw || this.yaw) * 2.2;
      this.light.intensity = this.alive ? (7 + 5 * fl + this.overheatV * 4 + h * 8) : 0;
      this.light.color.setRGB(1, 0.35 + this.overheatV * 0.5, 0.12 + this.overheatV * 0.6);
    }
    this.palmL.getWorldPosition(this.palmWorld); this.palmWorld.y -= 0.2;
    this.hammerTip.getWorldPosition(this.hammerWorld);
    if (this.hammerHeat > 0.6 && fxRand() < dt * 20) Particles.trailPoint(this.hammerWorld, 0xffe0a0, PYR_EMBER, 0.5, 0.18, { vy: 1.5, intensity: 2.4, jitter: 0.4 });
    this.blob.visible = this.alive;
  }
  dispose() { if (this.smoke) this.smoke.dispose(); super.dispose(); }
}

// =============================================================================
//  REGISTRATION + INTRO
// =============================================================================
registerBoss({
  index: 0, key: 'pyrrha', music: 'pyrrha',
  buildArena: (ctx) => buildForgeArena(ctx),
  createBoss: (ctx, arena) => new Pyrrha(ctx, arena),
  /** 5 s: low on the platform looking north; the magma bulges, Vorath rises and slams his hands on the rim; tilt down to Pyrrha rising from a kneel */
  intro(ctx, boss, arena) {
    const v = arena.vorath;
    v.submerge(); v.update(0);
    boss.pose('kneel'); boss.rig.snap();
    HUD.show(false);
    const bulge = arena.lavaMat ? arena.lavaMat.uniforms.uBulge.value : null;
    let bt = null;
    const B = boss.pos;
    return {
      dur: 5.6, ease: 'linear', letterbox: true, skippable: true, blendOut: 0.9,
      pos: [[3.6, 1.2, 12.5], [3.4, 1.5, 8.5], [2.2, 2.2, 5], [6.2, 1.3, 4.6], [4.4, 1.2, 5.2], [2.5, 6, 8]],
      tgt: [[0, 6, -70], [0, 14, -70], [0, 22, -70], [B.x, 4.2, B.z], [B.x, 5.4, B.z], [B.x * 0.4, 2.5, B.z * 0.4 + 3]],
      fov: [56, 56, 58, 54, 50, 50], roll: [0, -1, 1.5, 1, -1.5, 0],
      events: [
        { t: 0.1, fn: () => { sfx('rumble', { dur: 3.2 }); CamRig.addTrauma(0.15); if (bulge) { bulge.set(0, -70, 34, 0); bt = 0; } } },
        { t: 0.3, fn: () => { if (bulge) bulge.w = 0.8; for (let i = 0; i < 3; i++) Particles.burst(_v1.set(fxRange(-10, 10), -5, -70 + fxRange(-6, 6)), 60, 0xffd090, 0xff3a08, 12, 1.4, 1.2, -10, { up: 10, spread: 6, intensity: 2.4 }); } },
        { t: 0.7, fn: () => { v.rise(2.1, 2.2); sfx('explode'); CamRig.addTrauma(0.3); } },
        { t: 1.0, fn: () => { for (let i = 0; i < 10; i++) Timers.after(i * 0.12, () => { const x = fxRange(-14, 14), y = fxRange(-4, 18); Particles.burst(_v1.set(x, v.rootY + 14 + y, -64), 26, 0xffc070, 0xff2a04, 3, 1.6, 1.0, -16, { spread: 4, intensity: 2.2 }); }, { real: true }); } },
        { t: 2.0, fn: () => { if (bulge) bulge.w = 0.35; } },
        { t: 2.95, fn: () => {
          CamRig.addTrauma(0.5); sfx('slam'); sfx('explode'); Post.kickBloom(0.4, 0.5);
          for (const s of [1, -1]) { BossKit.impact(s * 10.5, -21, 1.6, 0xffc070, PYR_DARK); Particles.burst(_v1.set(s * 10.5, 2, -24), 120, 0xffe0a0, 0xff3a08, 12, 1.2, 0.5, -12, { up: 6, spread: 3, intensity: 2.4 }); }
          if (bulge) bulge.w = 0; } },
        { t: 3.6, fn: () => { boss.pose('idle', 2.2); sfx('rumble', { dur: 1.2 }); } },
        { t: 4.2, fn: () => { Banner.show('PYRRHA', 'The Forge-Warden', { cls: 'gold', dur: 1.6 }); sfx('bell', { f: 147 }); boss.heatTarget = 0.6; } },
        { t: 5.2, fn: () => { boss.heatTarget = 0; } },
      ],
      onDone: (skipped) => { v.cancelSeqs(); v.tween('rootY', VOR.base.y, 0); v.tween('headPitch', 0, 0); v.gripPose(true); v.update(0); if (bulge) bulge.w = 0; boss.pose('idle'); if (skipped) boss.rig.snap(); },
    };
  },
});
