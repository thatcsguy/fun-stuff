// =============================================================================
//  §7  Shared shaders & materials
//      makeTelegraphMaterial()  — one program for all 6 shapes (§3)
//      makeArcane(params, opts) — MeshStandardMaterial + rim / flash / fracture / dissolve / stone
//      makeEchoMaterial(opts)   — fresnel-only Echo; {shadow:true} = hostile violet-black Shadow
//      makeBeamMaterial(opts)   — scrolling-noise beam (Zero Hour, Moonbeam, god rays)
//      makeHexShieldMaterial()  — hex SDF shield with 8 ripple impacts
//      makeGroundRingMaterial() — additive ground ring / arc decal
//      makeCrescentMaterial()   — sweeping crescent slash
//  All custom ShaderMaterials output linear HDR; tone mapping happens once in OutputPass.
// =============================================================================

const TELEGRAPH_SHAPES = { circle: 0, donut: 1, cone: 2, rect: 3, sector: 4, halfplane: 5 };

const TELEGRAPH_VS = /* glsl */`
  uniform vec2 uHalf; uniform vec2 uCenter;
  varying vec2 vLocal; varying vec2 vWorldXZ;
  void main(){
    vec2 l = vec2(position.x * 2.0 * uHalf.x + uCenter.x, -position.y * 2.0 * uHalf.y + uCenter.y);
    vLocal = l;
    vWorldXZ = (modelMatrix * vec4(l.x, 0.0, l.y, 1.0)).xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(l.x, 0.0, l.y, 1.0);
  }`;

const TELEGRAPH_FS = /* glsl */`
  uniform float uShape; uniform vec4 uP; uniform float uProgress; uniform vec3 uColor; uniform float uColorNorm;
  uniform float uPattern; uniform float uFlash; uniform float uTime; uniform float uFillMode;
  uniform float uPips; uniform float uPipsOn; uniform float uRemain; uniform float uRim; uniform float uAlpha;
  uniform float uInterior; uniform float uClip;
  varying vec2 vLocal; varying vec2 vWorldXZ;
  ${GLSL_NOISE}
  float sdPie(vec2 p, float a, float r){
    vec2 c = vec2(sin(a), cos(a)); p.x = abs(p.x);
    float l = length(p) - r;
    float m = length(p - c * clamp(dot(p, c), 0.0, r));
    return max(l, m * sign(c.y * p.x - c.x * p.y));
  }
  float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  void main(){
    vec2 q = vLocal;
    int shape = int(uShape + 0.5);
    float r = length(q);
    float d, f;
    if (shape == 0)      { d = r - uP.x; f = r / uP.x; }
    else if (shape == 1) { d = max(r - uP.x, uP.y - r); f = (r - uP.y) / max(uP.x - uP.y, 1e-3); }
    else if (shape == 2) { d = sdPie(q, uP.y, uP.x); f = r / uP.x; }
    else if (shape == 3) { d = sdBox(q - vec2(0.0, uP.x * 0.5), vec2(uP.y, uP.x * 0.5)); f = q.y / uP.x; }
    else if (shape == 4) { d = max(sdPie(q, uP.z, uP.x), uP.y - r); f = (r - uP.y) / max(uP.x - uP.y, 1e-3); }
    else                 { d = max(-q.y, r - uP.x); f = q.y / uP.x; }

    float aa = max(fwidth(d), 0.015);
    float inside = 1.0 - smoothstep(-aa, aa, d);
    float halo = smoothstep(-aa, aa, d) * (1.0 - smoothstep(0.0, ${CONFIG.telegraph.halo.toFixed(2)}, d));
    float rimM = inside * smoothstep(-${CONFIG.telegraph.rim.toFixed(2)} - aa, -${CONFIG.telegraph.rim.toFixed(2)} + aa, d);
    float interior = inside - rimM;

    float prog = clamp(uProgress, 0.0, 1.0);
    float edge = uFillMode < 0.5 ? (1.0 - prog) : prog;
    float fw = max(fwidth(f), 0.002);
    float filled = uFillMode < 0.5 ? smoothstep(edge - fw, edge + fw, f) : 1.0 - smoothstep(edge - fw, edge + fw, f);
    float front = (1.0 - smoothstep(0.0, 0.02 + fw * 2.0, abs(f - edge))) * step(0.002, prog) * step(prog, 0.998);

    int pat = int(uPattern + 0.5);
    float ang = atan(q.x, q.y);
    float patv = 0.0;
    if (pat == 0) {            // diagonal stripes scrolling toward the nearest exit
      float s;
      if (shape == 0)      s = ang * 2.2 + r * 0.9 - uTime * 2.0;   // spiral outward
      else if (shape == 1) s = ang * 2.2 + r * 0.9 + uTime * 2.0;   // spiral inward (safe centre)
      else if (shape == 5) s = q.y * 0.9 + q.x * 0.5 + uTime * 2.0; // toward the dividing line
      else                 s = abs(q.x) * 0.9 + q.y * 0.4 - uTime * 2.0; // sideways out
      patv = smoothstep(0.42, 0.5, fract(s * 0.55)) * (1.0 - smoothstep(0.82, 0.9, fract(s * 0.55)));
    } else if (pat == 1) {     // concentric rings pulsing inward
      patv = smoothstep(0.55, 0.8, fract(r * 0.75 + uTime * 1.3)) * (1.0 - smoothstep(0.85, 1.0, fract(r * 0.75 + uTime * 1.3)));
    } else if (pat == 2) {     // dots
      vec2 g = fract(q * 0.8) - 0.5; patv = 1.0 - smoothstep(0.1, 0.17, length(g));
    }
    float heat = vnoise(q * 1.25 + vec2(uTime * 0.35, -uTime * 0.8));

    vec3 col = uColor;
    vec3 inCol = col * (mix(0.30, 0.55, filled) * uInterior + patv * 0.15 + heat * 0.08) + col * front * 0.3;
    float inA = mix(0.40, 0.58, filled) * mix(0.6, 1.0, uInterior);

    float last = (uRemain > 0.0 && uRemain < ${CONFIG.telegraph.pulseLast.toFixed(2)}) ? 1.0 : 0.0;
    float pulse = last * step(0.5, fract(uTime * 8.0));
    vec3 rimCol = mix(col * uColorNorm, vec3(1.25), pulse) * uRim;
    if (pat == 2) rimM *= step(0.42, fract(ang * max(r, 1.0) * 0.7));

    float pip = 0.0, pipLit = 0.0;
    if (uPips > 0.5) {
      for (int i = 0; i < 8; i++) {
        if (float(i) >= uPips) break;
        float a = (float(i) - (uPips - 1.0) * 0.5) * 0.42;
        vec2 c = vec2(sin(a), cos(a)) * uP.x * 0.62;
        vec2 dq = q - c;
        float m = 1.0 - smoothstep(0.16, 0.22, abs(dq.x) + abs(dq.y));
        pip = max(pip, m);
        if (float(i) < uPipsOn) pipLit = max(pipLit, m);
      }
    }
    vec3 rgb = inCol * interior + rimCol * rimM;
    float a = inA * interior + 0.9 * rimM + halo * 0.35;
    rgb = mix(rgb, mix(col * 0.2, col * uColorNorm * 1.3 + 0.15, pipLit), pip);
    a = max(a, pip * 0.85);
    vec3 flashCol = mix(col * uColorNorm, vec3(1.0), 0.45) * ${CONFIG.telegraph.flashIntensity.toFixed(2)};
    rgb = mix(rgb, flashCol * inside, uFlash);
    a = mix(a, inside * 0.95 + halo * 0.35, uFlash);
    // clip to the arena edge (soft 0.25 m) so arena-wide shapes never float over the void
    float clipK = 1.0 - smoothstep(uClip - 0.25, uClip, length(vWorldXZ));
    gl_FragColor = vec4(rgb, a) * uAlpha * clipK;
  }`;

const TELEGRAPH_GEO = new THREE.PlaneGeometry(1, 1, 1, 1);

function colorLumNorm(c) {
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return 0.75 / Math.max(l, 0.12);
}

function makeTelegraphMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uShape: { value: 0 }, uP: { value: new THREE.Vector4(3, 0, 0, 0) },
      uHalf: { value: new THREE.Vector2(4, 4) }, uCenter: { value: new THREE.Vector2(0, 0) },
      uProgress: { value: 0 }, uColor: { value: new THREE.Color(1, 0.3, 0.1) }, uColorNorm: { value: 2.5 },
      uPattern: { value: 0 }, uFlash: { value: 0 }, uTime: GLOBAL_U.uTime, uFillMode: { value: 0 },
      uPips: { value: 0 }, uPipsOn: { value: 0 }, uRemain: { value: 10 }, uRim: { value: CONFIG.telegraph.rimIntensity },
      uAlpha: { value: 1 }, uInterior: { value: 1 }, uClip: GLOBAL_U.uArenaClip,
    },
    vertexShader: TELEGRAPH_VS, fragmentShader: TELEGRAPH_FS,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    premultipliedAlpha: true, side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------- Arcane (onBeforeCompile)
const ARCANE_FRAG_HEAD = /* glsl */`
  varying vec3 vObjPos;
  uniform vec3 uRimColor; uniform float uRim; uniform float uFlash; uniform vec3 uFlashColor;
  uniform float uFracture; uniform vec3 uFractureColor; uniform float uCrackScale;
  uniform float uDissolve; uniform vec3 uDissolveColor; uniform float uDissolveScale;
  uniform float uStone; uniform float uTime;
  #ifdef ARC_OCC
  uniform vec3 uOccP; uniform float uOccNear; varying vec3 vWorldOcc;
  #endif
  ${GLSL_NOISE}
`;
const ARCANE_FRAG_DISCARD = /* glsl */`
  float arcDis = 0.0;
  #ifdef ARC_OCC
  {   // occluder fade: dither out fragments sitting on the camera→player sightline
    vec3 ab = uOccP - cameraPosition; float L = length(ab); vec3 dv = ab / max(L, 1e-3);
    vec3 rel = vWorldOcc - cameraPosition; float tp = dot(rel, dv);
    float k = 1.0 - smoothstep(uOccNear * 0.55, uOccNear, length(rel));          // anything hugging the lens
    if (tp > 0.0 && tp < L - 0.4) {
      float dl = length(rel - dv * tp);
      k = max(k, (1.0 - smoothstep(1.3, 3.2, dl)) * 0.9);
      // well in front of the player (foreground pillar): ghost a much wider column so no half-dithered block remains
      k = max(k, (1.0 - smoothstep(3.5, 6.5, dl)) * (1.0 - smoothstep(L * 0.6, L * 0.85, tp)) * 0.9);
    }
    if (k > 0.0) {
      vec2 q = mod(floor(gl_FragCoord.xy), 4.0);
      float bay = mod(q.x * 2.0 + q.y * 3.0 + q.x * q.y, 4.0) * 0.25 + 0.125 * mod(q.x + q.y, 2.0);
      if (bay < k) discard;
    }
  }
  #endif
  if (uDissolve > 0.001) {
    float dn = vnoise3(vObjPos * uDissolveScale) * 0.7 + vnoise3(vObjPos * uDissolveScale * 3.1) * 0.3;
    if (dn < uDissolve) discard;
    arcDis = 1.0 - smoothstep(0.0, 0.07, dn - uDissolve);
  }
`;
const ARCANE_FRAG_BODY = /* glsl */`
  {
    vec3 avd = normalize(vViewPosition);
    float afres = pow(1.0 - clamp(abs(dot(normal, avd)), 0.0, 1.0), 3.0);
    totalEmissiveRadiance += uRimColor * uRim * afres;
    if (uFracture > 0.001) {
      vec3 cid; float e = voronoiEdge3(vObjPos * uCrackScale, cid);
      float hcell = hash13(cid);
      float fr = clamp(uFracture, 0.0, 1.0);
      float reveal = smoothstep(hcell - 0.05, hcell + 0.05, fr * 1.08);
      float w = 0.035 + 0.04 * fr;
      float crack = (1.0 - smoothstep(w * 0.4, w, e)) * reveal;
      float hot = clamp(uFracture - 1.0, 0.0, 1.0);
      totalEmissiveRadiance += crack * mix(uFractureColor * (1.6 + 1.2 * fr), vec3(5.0, 4.6, 4.0), hot);
    }
    totalEmissiveRadiance += uFlashColor * uFlash * (0.55 + 1.6 * afres);
    totalEmissiveRadiance += uDissolveColor * arcDis * 5.0;
  }
`;

/**
 * Arcane material — MeshStandardMaterial with injected uniforms (§8.2):
 *   u.uRim / uRimColor     fresnel rim emission
 *   u.uFlash               hit flash (white, decays ~0.08 s — decay is the owner's job)
 *   u.uFracture            0..1 cracks spread (Voronoi in object space), >1 blazes white (Grand Shatter)
 *   u.uDissolve            0..1 noise dissolve with glowing edge
 *   u.uStone               0..1 grey stone tint (Petrified)
 *   opts.occluder          true → fragments on the camera→player sightline dither out (pillars, walls)
 * Access uniforms via material.userData.arcane (they exist before compile).
 */
function makeArcane(params, opts) {
  opts = opts || {};
  const mat = new THREE.MeshStandardMaterial(params || {});
  const u = {
    uRimColor: { value: new THREE.Color(opts.rimColor != null ? opts.rimColor : 0x5ff2ff) }, uRim: { value: opts.rim != null ? opts.rim : 0 },
    uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uFracture: { value: 0 }, uFractureColor: { value: new THREE.Color(opts.crackColor != null ? opts.crackColor : 0x5ff2ff) }, uCrackScale: { value: opts.crackScale || 1.6 },
    uDissolve: { value: 0 }, uDissolveColor: { value: new THREE.Color(opts.dissolveColor != null ? opts.dissolveColor : 0x5ff2ff) }, uDissolveScale: { value: opts.dissolveScale || 2.2 },
    uStone: { value: 0 }, uTime: GLOBAL_U.uTime,
  };
  mat.userData.arcane = u;
  if (opts.occluder) { mat.defines = Object.assign(mat.defines || {}, { ARC_OCC: 1 }); u.uOccP = GLOBAL_U.uOccP; u.uOccNear = GLOBAL_U.uOccNear; }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;' + (opts.vertexHead || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;\n#ifdef USE_INSTANCING\nvObjPos += instanceMatrix[3].xyz * 0.37;\n#endif\n' + (opts.vertexBody || '') +
        (opts.occluder ? '\n#ifdef USE_INSTANCING\nvWorldOcc = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvWorldOcc = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif\n' : ''));
    if (opts.occluder) shader.vertexShader = shader.vertexShader.replace('varying vec3 vObjPos;', 'varying vec3 vObjPos; varying vec3 vWorldOcc;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + ARCANE_FRAG_HEAD)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + ARCANE_FRAG_DISCARD)
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(.3,.59,.11)) * 0.7 + 0.18), uStone);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + ARCANE_FRAG_BODY);
    if (opts.onCompile) opts.onCompile(shader);
  };
  mat.customProgramCacheKey = () => 'arcane' + (opts.key || '');
  return mat;
}

// ---------------------------------------------------------------- Echo / Shadow
const ECHO_VS = /* glsl */`
  uniform float uTime; uniform float uDistort;
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    wp.x += sin(wp.y * 9.0 + uTime * 14.0) * uDistort;
    wp.z += cos(wp.y * 7.0 + uTime * 11.0) * uDistort * 0.6;
    vY = wp.y;
    vec4 mv = viewMatrix * wp;
    vV = -mv.xyz; vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;
const ECHO_FS = /* glsl */`
  uniform vec3 uColor; uniform float uAlpha; uniform float uTime; uniform float uDither; uniform float uShadow;
  varying vec3 vN; varying vec3 vV; varying float vY;
  ${GLSL_NOISE}
  void main(){
    float fres = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), 2.0);
    float scan = 0.72 + 0.28 * sin(vY * 70.0 - uTime * 9.0);
    float flick = 0.86 + 0.14 * hash11(floor(uTime * 24.0));
    if (uDither > 0.5 && hash12(floor(gl_FragCoord.xy)) > uAlpha) discard;
    float a = uDither > 0.5 ? 1.0 : uAlpha;
    if (uShadow > 0.5) {
      vec3 c = mix(vec3(0.012, 0.0, 0.025), uColor * 1.8, fres) * scan;
      gl_FragColor = vec4(c, a * (0.78 + 0.22 * fres));
    } else {
      vec3 c = uColor * (0.1 + 2.0 * fres) * scan * flick;
      gl_FragColor = vec4(c * a, 1.0);
    }
  }`;
function makeEchoMaterial(opts) {
  opts = opts || {};
  const shadow = !!opts.shadow;
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color != null ? opts.color : (shadow ? 0xb266ff : 0x5ff2ff)) },
      uAlpha: { value: opts.alpha != null ? opts.alpha : 1 }, uTime: GLOBAL_U.uTime,
      uDither: { value: opts.dither ? 1 : 0 }, uShadow: { value: shadow ? 1 : 0 }, uDistort: { value: shadow ? 0.04 : 0.0 },
    },
    vertexShader: ECHO_VS, fragmentShader: ECHO_FS,
    transparent: true, depthWrite: shadow, blending: shadow ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
}

// ---------------------------------------------------------------- Beam
const BEAM_FS = /* glsl */`
  uniform vec3 uColor; uniform float uIntensity; uniform float uAlpha; uniform float uTime; uniform float uLen; uniform float uScroll; uniform float uSoft;
  varying vec2 vUv;
  ${GLSL_NOISE}
  void main(){
    float across = abs(vUv.x - 0.5) * 2.0;
    float core = pow(max(1.0 - across, 0.0), 6.0) * 2.2 + pow(max(1.0 - across, 0.0), 1.6) * 0.55;
    float n = vnoise(vec2(vUv.x * 5.0, vUv.y * uLen * 0.5 - uTime * uScroll)) * 0.6 + vnoise(vec2(vUv.x * 11.0, vUv.y * uLen * 1.3 - uTime * uScroll * 1.7)) * 0.4;
    float endFade = smoothstep(0.0, uSoft, vUv.y) * smoothstep(1.0, 1.0 - uSoft, vUv.y);
    vec3 c = uColor * uIntensity * core * (0.55 + 0.9 * n) * endFade * uAlpha;
    c += vec3(1.0) * pow(max(1.0 - across, 0.0), 14.0) * uIntensity * 0.6 * endFade * uAlpha;
    gl_FragColor = vec4(c, 1.0);
  }`;
const BASIC_UV_VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
function makeBeamMaterial(opts) {
  opts = opts || {};
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color != null ? opts.color : 0xfff0c0) }, uIntensity: { value: opts.intensity != null ? opts.intensity : 3 },
      uAlpha: { value: opts.alpha != null ? opts.alpha : 1 }, uTime: GLOBAL_U.uTime, uLen: { value: opts.len || 10 }, uScroll: { value: opts.scroll != null ? opts.scroll : 3 },
      uSoft: { value: opts.soft != null ? opts.soft : 0.06 },
    },
    vertexShader: BASIC_UV_VS, fragmentShader: BEAM_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------- Hex shield
function makeHexShieldMaterial(opts) {
  opts = opts || {};
  const hits = []; for (let i = 0; i < 8; i++) hits.push(new THREE.Vector4(0, 1, 0, 99));
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(opts.color != null ? opts.color : 0xb266ff) }, uTime: GLOBAL_U.uTime, uAlpha: { value: 1 }, uHits: { value: hits }, uBreak: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vDir;
      void main(){ vUv = uv; vDir = normalize(position); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uTime; uniform float uAlpha; uniform vec4 uHits[8]; uniform float uBreak;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vDir;
      ${GLSL_NOISE}
      float hexDist(vec2 p){ p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.732))), p.x); }
      void main(){
        vec2 uv = vec2(vUv.x * 28.0, vUv.y * 14.0);
        vec2 r = vec2(1.0, 1.732), h = r * 0.5;
        vec2 a = mod(uv, r) - h, b = mod(uv - h, r) - h;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        float edge = smoothstep(0.38, 0.5, hexDist(g));
        float fres = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), 2.5);
        float rip = 0.0;
        for (int i = 0; i < 8; i++) {
          float age = uHits[i].w; if (age > 1.2) continue;
          float ang = acos(clamp(dot(vDir, normalize(uHits[i].xyz)), -1.0, 1.0));
          float ring = 1.0 - smoothstep(0.0, 0.12, abs(ang - age * 1.6));
          rip += ring * (1.0 - age / 1.2) + (1.0 - smoothstep(0.0, 0.35, ang)) * max(0.0, 0.4 - age) * 2.0;
        }
        float sweep = 0.5 + 0.5 * sin(vUv.y * 30.0 - uTime * 2.0);
        float crack = uBreak * step(0.6, vnoise(vUv * 40.0));
        vec3 c = uColor * (edge * (0.35 + 0.5 * sweep) * (0.4 + fres) + fres * 1.4 + rip * 2.2 + crack * 3.0);
        gl_FragColor = vec4(c * uAlpha, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// ---------------------------------------------------------------- ground ring (portal rings, shockwave decals, echo life ring)
function makeGroundRingMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color != null ? color : 0x5ff2ff) }, uR: { value: 1 }, uW: { value: 0.15 }, uFrac: { value: 1 }, uAlpha: { value: 1 }, uIntensity: { value: 2 }, uFill: { value: 0 } },
    vertexShader: BASIC_UV_VS,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uR, uW, uFrac, uAlpha, uIntensity, uFill; varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0;          // -1..1 → plane is scaled so 1.0 == uR*1.25
        float r = length(p) * 1.25;
        float ring = 1.0 - smoothstep(uW * 0.5, uW * 0.5 + 0.03, abs(r - 1.0) * uR);
        float ang = atan(p.x, -p.y) / 6.2831853 + 0.5;   // 0..1 from north, clockwise
        ring *= step(ang, uFrac);
        float glow = exp(-abs(r - 1.0) * uR * 4.0) * 0.35;
        float fill = uFill * (1.0 - smoothstep(0.95, 1.0, r)) * 0.25;
        gl_FragColor = vec4(uColor * uIntensity * (ring + glow * step(ang, uFrac) + fill) * uAlpha, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
}

// ---------------------------------------------------------------- crescent slash (melee arcs, Zero Hour afterimages)
function makeCrescentGeometry(radius, arc, width, segs) {
  segs = segs || 32;
  const pos = new Float32Array((segs + 1) * 2 * 3), uv = new Float32Array((segs + 1) * 2 * 2), idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, a = -arc / 2 + arc * u;
    const ri = radius - width / 2, ro = radius + width / 2;
    pos.set([Math.sin(a) * ri, 0, Math.cos(a) * ri, Math.sin(a) * ro, 0, Math.cos(a) * ro], i * 6);
    uv.set([u, 0, u, 1], i * 4);
    if (i < segs) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
function makeCrescentMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color != null ? color : 0x9ff8ff) }, uHead: { value: 1 }, uTail: { value: 0.6 }, uAlpha: { value: 1 }, uIntensity: { value: 3 } },
    vertexShader: BASIC_UV_VS,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uHead, uTail, uAlpha, uIntensity; varying vec2 vUv;
      void main(){
        float u = vUv.x;
        float vis = smoothstep(uHead - uTail, uHead, u) * (1.0 - smoothstep(uHead, uHead + 0.02, u));
        float thick = sin(3.14159 * clamp((u - (uHead - uTail)) / max(uTail, 0.01), 0.0, 1.0));
        float across = abs(vUv.y - 0.5) * 2.0;
        float body = 1.0 - smoothstep(thick * 0.75, thick, across);
        float core = 1.0 - smoothstep(0.0, thick * 0.35 + 0.02, abs(vUv.y - 0.62));
        vec3 c = (uColor * body * 0.9 + vec3(1.0) * core * 0.9) * uIntensity * vis * uAlpha;
        gl_FragColor = vec4(c, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------- canvas textures
function makeRadialTexture(size, stops) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const s of stops) gr.addColorStop(s[0], s[1]);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const BLOB_TEX = makeRadialTexture(128, [[0, 'rgba(0,0,0,0.75)'], [0.45, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);

/** A blob shadow decal (all quality levels). */
function makeBlobShadow(size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: BLOB_TEX, transparent: true, depthWrite: false, opacity: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.015; m.renderOrder = 1;
  return m;
}
