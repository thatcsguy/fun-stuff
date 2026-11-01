// =====================================================================
// 05_track.js — track builder, sample table, surface shader with hazard
// bands, boost pads, ramps, gaps, item boxes, curbs/rails, lap gate,
// plus a DEFAULT test arena (Ember-Bowl-shaped) used when no boss def.  (TRACK)
// =====================================================================
{
  const { THREE } = G;
  const UP = new THREE.Vector3(0, 1, 0);
  const MAX_HAZ = 16, MAX_PADS = 8, MAX_GAPS = 6, MAX_RAMPS = 8, MAX_BOXES = 24;
  const KIND = { damage: 0, knock: 1, gold: 2, soak: 3, lava: 4, safe: 5, crack: 6, electric: 7, fire: 0, drift: 5 };

  // ---- sample table (filled by build) ----
  let n = 0, dsm = 1;                 // sample count, spacing (≈1 m)
  let P, TT, RR, NN, W, BANK, KAP;    // Float32Arrays
  const sv = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion() };
  const frameScratch = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), n: new THREE.Vector3(), w: 0, bank: 0, kappa: 0 };
  const nearRes = { s: 0, d: 0 };

  const T = G.track = {
    L: 0, def: null, built: false, lapGateS: 0, pads: [], itemRows: [], boxes: [], ramps: [], gaps: [], driftZones: [],
    group: new THREE.Group(), scenery: new THREE.Group(), uniforms: null,
    wrap(s) { const L = T.L; return L ? ((s % L) + L) % L : s; },
    ds(a, b) { const L = T.L; let x = ((b - a) % L + L) % L; if (x > L / 2) x -= L; return x; },

    // frame(s, out) -> {p,t,r,n,w,bank,kappa}; out is optional (shared scratch otherwise)
    frame(s, out) {
      out = out || frameScratch;
      if (!n) { out.p.set(0, 0, 0); out.t.set(1, 0, 0); out.r.set(0, 0, 1); out.n.set(0, 1, 0); out.w = 18; out.bank = 0; out.kappa = 0; return out; }
      const u = T.wrap(s) / dsm; let i = Math.floor(u); const f = u - i; i %= n; const j = (i + 1) % n;
      const i3 = i * 3, j3 = j * 3;
      out.p.set(P[i3] + (P[j3] - P[i3]) * f, P[i3 + 1] + (P[j3 + 1] - P[i3 + 1]) * f, P[i3 + 2] + (P[j3 + 2] - P[i3 + 2]) * f);
      out.t.set(TT[i3] + (TT[j3] - TT[i3]) * f, TT[i3 + 1] + (TT[j3 + 1] - TT[i3 + 1]) * f, TT[i3 + 2] + (TT[j3 + 2] - TT[i3 + 2]) * f).normalize();
      out.r.set(RR[i3] + (RR[j3] - RR[i3]) * f, RR[i3 + 1] + (RR[j3 + 1] - RR[i3 + 1]) * f, RR[i3 + 2] + (RR[j3 + 2] - RR[i3 + 2]) * f).normalize();
      out.n.set(NN[i3] + (NN[j3] - NN[i3]) * f, NN[i3 + 1] + (NN[j3 + 1] - NN[i3 + 1]) * f, NN[i3 + 2] + (NN[j3 + 2] - NN[i3 + 2]) * f).normalize();
      out.w = W[i] + (W[j] - W[i]) * f; out.bank = BANK[i] + (BANK[j] - BANK[i]) * f; out.kappa = KAP[i] + (KAP[j] - KAP[i]) * f;
      return out;
    },
    toWorld(s, d, h, out) {
      out = out || new THREE.Vector3();
      const f = T.frame(s, frameScratch);
      return out.copy(f.p).addScaledVector(f.r, d).addScaledVector(f.n, h || 0);
    },
    // nearest(world, hintS) -> {s,d} (shared result object: copy it if you need to keep it)
    nearest(w, hintS) {
      if (!n) { nearRes.s = 0; nearRes.d = 0; return nearRes; }
      let best = -1, bd = Infinity;
      const scan = (i) => { i = ((i % n) + n) % n; const i3 = i * 3; const dx = w.x - P[i3], dy = w.y - P[i3 + 1], dz = w.z - P[i3 + 2]; const d2 = dx * dx + dy * dy + dz * dz; if (d2 < bd) { bd = d2; best = i; } };
      if (hintS != null && isFinite(hintS)) { const c = Math.round(T.wrap(hintS) / dsm); for (let k = -6; k <= 6; k++) scan(c + k); }
      else for (let i = 0; i < n; i++) scan(i);
      const i3 = best * 3;
      const along = (w.x - P[i3]) * TT[i3] + (w.y - P[i3 + 1]) * TT[i3 + 1] + (w.z - P[i3 + 2]) * TT[i3 + 2];
      const s = T.wrap(best * dsm + Math.max(-dsm, Math.min(dsm, along)));
      const f = T.frame(s, frameScratch);
      nearRes.s = s; nearRes.d = sv.a.copy(w).sub(f.p).dot(f.r);
      return nearRes;
    },
    width(s) { if (!n) return 18; const u = T.wrap(s) / dsm; let i = Math.floor(u) % n; const f = u - Math.floor(u); return W[i] + (W[(i + 1) % n] - W[i]) * f; },
    curvature(s) { if (!n) return 0; const u = T.wrap(s) / dsm; let i = Math.floor(u) % n; const f = u - Math.floor(u); return KAP[i] + (KAP[(i + 1) % n] - KAP[i]) * f; },
    laneD(lane, s) { return lane * T.width(s) / 3; },
    halfDrive(s) { return T.width(s) / 2 - 0.9; },   // max |d| for the kart centre

    // ---- gaps ----
    isGap(s) {
      for (let i = 0; i < T.gaps.length; i++) { const g = T.gaps[i]; if (inRange(s, g.s0, g.s1)) return true; }
      return false;
    },
    setGap({ s0, s1, until }) { const g = { id: ++uid, s0: T.wrap(s0), s1: T.wrap(s1), until: until ?? Infinity }; T.gaps.push(g); rebuildIndex(); return g.id; },
    removeGap(id) { const i = T.gaps.findIndex(g => g.id === id); if (i >= 0) { T.gaps.splice(i, 1); rebuildIndex(); } },

    // ---- ramps: kart rides up the wedge, launch with vh = kick at its end ----
    addRamp({ s, len = 10, kick = 9, until, d0, d1, visual = true }) {
      const r = { id: ++uid, s: T.wrap(s), len, kick, until: until ?? Infinity, d0: d0 ?? -99, d1: d1 ?? 99, visual, h: Math.min(1.5, 0.2 + len * 0.12) };
      T.ramps.push(r); refreshRamps(); return r.id;
    },
    removeRamp(id) { const i = T.ramps.findIndex(r => r.id === id); if (i >= 0) { T.ramps.splice(i, 1); refreshRamps(); } },
    rampAt(s, d) {
      for (let i = 0; i < T.ramps.length; i++) { const r = T.ramps[i]; const x = T.wrap(s - r.s); if (x <= r.len && d >= r.d0 && d <= r.d1) return r; }
      return null;
    },
    rampHeight(r, s) { return r.visual ? r.h * Math.min(1, T.wrap(s - r.s) / r.len) : 0; },

    // ---- pads ----
    padAt(s, d) {
      for (let i = 0; i < T.pads.length; i++) { const p = T.pads[i]; if (T.wrap(s - p.s) <= p.len && d >= p.d0 - 0.4 && d <= p.d1 + 0.4) return p; }
      return null;
    },
    driftMult(s) { for (const z of T.driftZones) if (inRange(s, z.s0, z.s1)) return z.mult || 1.25; return 1; },

    // ---- hazard bands (COMBAT owns the 16 slots) ----
    setBand(slot, s0, s1, d0, d1, kind, fill, flash, alpha) {
      if (!T.uniforms || slot < 0 || slot >= MAX_HAZ) return;
      const k = typeof kind === 'string' ? (KIND[kind] ?? 0) : (kind || 0);
      T.uniforms.uHaz.value[slot].set(T.wrap(s0), T.wrap(s1), d0 ?? -99, d1 ?? 99);
      T.uniforms.uHazB.value[slot].set(k, fill ?? 0, flash ?? 0, alpha ?? 0);
    },
    clearBands() { if (T.uniforms) for (let i = 0; i < MAX_HAZ; i++) T.uniforms.uHazB.value[i].w = 0; },
    KIND,

    build, clear, buildArena,
  };
  let uid = 0;
  function inRange(s, s0, s1) { const L = T.L; const a = ((s - s0) % L + L) % L, b = ((s1 - s0) % L + L) % L; return a < b; }
  T.inRange = inRange;
  G.scene.add(T.group); G.scene.add(T.scenery);

  // ------------------------------------------------------------------
  // GLSL helpers shared by track shaders
  // ------------------------------------------------------------------
  const NOISE = /* glsl */`
    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
      return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
    float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
    float fbm2(vec2 p){ return vnoise(p) * .65 + vnoise(p * 2.1 + 5.3) * .35; }
    // sub-pixel lines are widened to ~1.2 px and dimmed by the same ratio (energy kept, no crawl)
    float aaLine(float x, float w){ float fw = max(fwidth(x), 1e-4); float ww = max(w, fw * .6); return (1. - smoothstep(ww - fw, ww + fw, abs(x))) * (w / ww); }
  `;

  // ------------------------------------------------------------------
  // Track surface material (§3.4)
  // ------------------------------------------------------------------
  function makeSurfaceMaterial() {
    const haz = [], hazB = [], pads = [], gaps = [];
    for (let i = 0; i < MAX_HAZ; i++) { haz.push(new THREE.Vector4(0, 0, 0, 0)); hazB.push(new THREE.Vector4(0, 0, 0, 0)); }
    for (let i = 0; i < MAX_PADS; i++) pads.push(new THREE.Vector4(0, 0, 0, 0));
    for (let i = 0; i < MAX_GAPS; i++) gaps.push(new THREE.Vector2(-1, -1));
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uBeat: { value: 0 }, uSpeed: { value: 0 }, uL: { value: 1 }, uSurface: { value: 0 },
      uEnrage: { value: 0 }, uMono: { value: 0 }, uCool: { value: 0 }, uDetail: { value: 1 }, uPulseAmt: { value: 1 },
      uPalette: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] },
      uKart: { value: new THREE.Vector3(0, 0, 0) }, uKartCol: { value: new THREE.Color('#33f6ff') },
      uSun: { value: new THREE.Vector3(-0.4, 0.8, 0.3).normalize() }, uSky: { value: new THREE.Color('#ff8a40') },
    }]);
    // arrays must stay as references (merge clones them, so re-assign)
    uniforms.uHaz = { value: haz }; uniforms.uHazB = { value: hazB }; uniforms.uPads = { value: pads }; uniforms.uGaps = { value: gaps };
    uniforms.uDZ = { value: [new THREE.Vector2(-1, -1), new THREE.Vector2(-1, -1)] };
    return new THREE.ShaderMaterial({
      uniforms, fog: true,
      vertexShader: /* glsl */`
        attribute float aS; attribute float aD; attribute float aHW;
        varying float vS, vD, vHW; varying vec3 vWP, vWN;
        #include <fog_pars_vertex>
        void main(){
          vS = aS; vD = aD; vHW = aHW;
          vec4 wp = modelMatrix * vec4(position, 1.); vWP = wp.xyz; vWN = normalize(mat3(modelMatrix) * normal);
          vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uBeat, uSpeed, uL, uSurface, uEnrage, uCool, uDetail, uPulseAmt;
        uniform vec3 uPalette[4]; uniform vec4 uHaz[${MAX_HAZ}]; uniform vec4 uHazB[${MAX_HAZ}]; uniform vec4 uPads[${MAX_PADS}];
        uniform vec2 uGaps[${MAX_GAPS}]; uniform vec2 uDZ[2]; uniform vec3 uKart, uKartCol, uSun, uSky;
        varying float vS, vD, vHW; varying vec3 vWP, vWN;
        #include <fog_pars_fragment>
        ${NOISE}
        float sdist(float a, float b){ float x = mod(b - a, uL); return x > uL * .5 ? x - uL : x; }
        vec3 kindCol(float k){
          if (k < .5) return vec3(1., .165, .227);       // damage
          if (k < 1.5) return vec3(.706, .294, 1.);      // knock
          if (k < 2.5) return vec3(1., .788, .227);      // gold
          if (k < 3.5) return vec3(.208, .953, 1.);      // soak
          if (k < 4.5) return vec3(1., .353, 0.);        // lava
          if (k < 5.5) return vec3(.75, 1., 1.);         // safe
          if (k < 6.5) return vec3(1., .2, .15);         // crack
          return vec3(.25, .66, 1.);                     // electric
        }
        void main(){
          vec3 base = uPalette[0], line = uPalette[1], edge = uPalette[2], accent = uPalette[3];
          float s = vS, d = vD, hw = vHW;
          vec2 p = vec2(s, d);
          vec3 V = normalize(cameraPosition - vWP); vec3 Nn = normalize(vWN);
          float ndl = clamp(dot(Nn, uSun), 0., 1.);
          float fres = pow(1. - clamp(dot(V, Nn), 0., 1.), 4.);
          float pulse = .4 * pow(1. - uBeat, 4.) * uPulseAmt;
          vec3 col; vec3 emi = vec3(0.);
          // emission near the camera (the strip under/behind the kart) is damped so it never blooms the lower screen
          float camD = length(cameraPosition - vWP);
          float nearCam = mix(.45, 1., smoothstep(4., 16., camD));

          // ---------- base material ----------
          if (uSurface < .5) {               // BASALT: dark grain + glowing cracks
            float g = vnoise(p * 2.7) * .5 + vnoise(p * 9.) * .25;
            float big = uDetail > .5 ? fbm(p * .11) : fbm2(p * .11);
            col = base * (.55 + g * .6) * (.75 + big * .5);
            float cr = abs(fbm2(p * .19 + 3.1) - .5);
            float crack = smoothstep(.035, .0, cr) * smoothstep(.35, .65, big);
            float flick = .7 + .3 * sin(uTime * 2. + s * .13);
            emi += mix(edge, accent, .35) * crack * 2.2 * flick * (1. - uCool);
          } else if (uSurface < 1.5) {       // GLASS: deep blue + hex grid pulse
            col = vec3(.03, .06, .13) + base * .4;
            vec2 q = p * vec2(.5, .5774);
            vec2 a = mod(q, vec2(1., 1.732)) - vec2(.5, .866), b = mod(q + vec2(.5, .866), vec2(1., 1.732)) - vec2(.5, .866);
            vec2 h = dot(a, a) < dot(b, b) ? a : b;
            float hx = max(abs(h.x) * .866 + abs(h.y) * .5, abs(h.y));
            float grid = smoothstep(.42, .48, hx);
            float wave = mod(uTime * 45., 140.); float kd = abs(sdist(uKart.x, s));
            float ring = exp(-pow(kd - wave, 2.) * .02) * (1. - wave / 140.);
            emi += line * grid * (.28 + ring * 1.4 + pulse * .8) * nearCam;
            col += vec3(.1, .2, .35) * fres * .3;
          } else {                           // CHROME: near black, white 4 m grid, reflected stars
            col = vec3(.012, .012, .02) + base * .2;
            float gx = aaLine(fract(s / 4. + .5) - .5, .012), gy = aaLine(fract(d / 4. + .5) - .5, .015);
            emi += vec3(.85, .9, 1.) * max(gx, gy) * (.45 + pulse * 1.) * nearCam;
            vec3 R = reflect(-V, Nn); vec2 sp = floor(R.xz / max(R.y, .05) * 60.);
            float st = step(.985, hash12(sp)); emi += vec3(.8, .9, 1.) * st * 1.5 * fres;
          }

          // ---------- lane lines, edges, chevrons ----------
          float lw = hw * 2. / 3.;
          float dash = step(.45, fract(s / 4.));
          float lanes = (aaLine(d - lw * .5, .07) + aaLine(d + lw * .5, .07)) * dash;
          emi += line * lanes * (.7 + pulse * .8) * nearCam;
          float edgeL = aaLine(abs(d) - (hw - .35), .12);
          emi += edge * edgeL * (1.6 + pulse * 1.2) * nearCam;
          float shoulder = smoothstep(hw - 1.4, hw - .35, abs(d));
          col = mix(col, col * .6 + edge * .04, shoulder);
          float chv = fract((s - abs(d) * .55 - uTime * uSpeed * 12.) / 3.);
          float chev = smoothstep(.0, .06, chv) * smoothstep(.22, .16, chv) * (1. - shoulder);
          emi += line * chev * (.03 + uSpeed * .1);

          // ---------- drift zones ----------
          for (int i = 0; i < 2; i++) {
            if (uDZ[i].x < 0.) continue;
            float x = mod(s - uDZ[i].x, uL), len = mod(uDZ[i].y - uDZ[i].x, uL);
            if (x < len) { float st = step(.5, fract((x + d) / 2.)); emi += vec3(.2, .95, 1.) * st * .28 * smoothstep(0., 4., x) * smoothstep(0., 4., len - x); }
          }

          // ---------- kart underglow ----------
          float kds = sdist(uKart.x, s); float kr2 = kds * kds * .6 + (d - uKart.y) * (d - uKart.y);
          emi += uKartCol * exp(-kr2 * .25) * .55;

          // ---------- boost pads ----------
          for (int i = 0; i < ${MAX_PADS}; i++) {
            vec4 pd = uPads[i]; if (pd.w <= 0.) continue;
            float x = mod(s - pd.x, uL);
            if (x < pd.w && d > pd.y && d < pd.z) {
              float u = x / pd.w, v = (d - pd.y) / (pd.z - pd.y);
              float c = fract(u * 3. - uTime * 2.6 - abs(v - .5) * 1.3);
              float arrow = smoothstep(.0, .08, c) * smoothstep(.42, .3, c);
              float border = 1. - smoothstep(.0, .06, min(min(u, 1. - u) * pd.w / (pd.z - pd.y), min(v, 1. - v)));
              col = mix(col, vec3(.0, .06, .1), .7);
              emi += vec3(.2, .97, 1.) * (arrow * 1.8 + border * 1.2 + .15) * nearCam;
            }
          }

          // ---------- gaps: glowing crack edges ----------
          for (int i = 0; i < ${MAX_GAPS}; i++) {
            if (uGaps[i].x < 0.) continue;
            float e = min(abs(sdist(uGaps[i].x, s)), abs(sdist(uGaps[i].y, s)));
            float jag = vnoise(vec2(d * 1.7, uGaps[i].x)) * 1.6;
            emi += mix(edge, vec3(1., .9, .6), .3) * smoothstep(2.5 + jag, 0., e) * (1.1 + sin(uTime * 9. + d) * .3) * nearCam;
          }

          col = col * (.35 + ndl * .75) + uSky * fres * .18;

          // ---------- hazard bands ----------
          for (int i = 0; i < ${MAX_HAZ}; i++) {
            vec4 hb = uHazB[i]; if (hb.w <= 0.) continue;
            vec4 hz = uHaz[i];
            float x = mod(s - hz.x, uL), len = max(mod(hz.y - hz.x, uL), .01);
            if (x > len || d < hz.z || d > hz.w) continue;
            float kind = hb.x, fill = hb.y, fl = hb.z, al = hb.w;
            vec3 kc = kindCol(kind);
            float edgeDist = min(x, len - x), halfL = len * .5;
            float filled = step(edgeDist / halfL, fill);
            float bd = min(edgeDist, min(d - hz.z, hz.w - d));
            float border = 1. - smoothstep(.22, .32, bd);
            float mid = (hz.z + hz.w) * .5;
            float pat;
            if (kind < .5 || kind > 5.5 && kind < 6.5) pat = step(.5, fract((x + d) / 1.4));                       // 45° stripes
            else if (kind < 1.5) pat = step(length(fract(vec2(x, d) / 1.6) - .5), .22);                           // dots
            else if (kind < 2.5) pat = step(.55, fract((x - abs(d - mid) * .7 - uTime * 4.) / 2.6));              // chevrons
            else if (kind < 3.5) pat = step(.5, fract(length(vec2(x - halfL, d - mid)) / 1.6 - uTime * .8));      // rings
            else if (kind < 4.5) pat = step(.5, fract(x / 2.2 + sin(d * .9 + uTime * 2.) * .25));                 // ripple
            else if (kind < 5.5) pat = step(.6, fract((x - uTime * 6.) / 2.));                                    // arrows
            else pat = step(.5, fract((x + d * .3) / 1.2));
            vec3 hc = kc * (.35 + .25 * pat);                        // unfilled: tinted region
            if (kind < .5) hc = mix(hc, vec3(1., .54, .12) * .5, border);
            vec3 he = kc * border * 2.2;
            float fillK = mix(.4, 1., smoothstep(3., 14., camD));   // inside the band: show edges + stripes, not a solid sheet
            if (filled > .5) {
              hc = kc * (.9 + .5 * pat);
              he += kc * (.35 + .5 * pat) * fillK;                  // peak ~.85: stays under the bloom threshold
              if (fill > .9 && fill < 1.) he += kc * (.5 + .5 * sin(uTime * 40.)) * (border * .9 + .45 * fillK);
            }
            if (fill >= 1.) {   // LIVE: animated energy by kind
              float n1 = vnoise(vec2(x * .5 - uTime * 5., d * .7)), n2 = vnoise(vec2(x * 1.3, d * 1.3 + uTime * 6.));
              if (kind < .5) he += vec3(1., .45, .08) * pow(n1 * n2 * 2.2, 2.) * 1.6 * fillK;                       // fire flicker
              else if (kind < 1.5 || kind > 6.5) he += kc * smoothstep(.04, .0, abs(n1 - .5)) * 2.2 * fillK;         // crackle
              else if (kind > 3.5 && kind < 4.5) he += vec3(1., .5, .05) * smoothstep(.3, .0, abs(fbm2(vec2(x, d) * .4 + uTime * .5) - .5)) * 1.5 * fillK;
            }
            col = mix(col, hc * .25, al * .85);
            emi = mix(emi, he, al * .9) + kc * fl * (border * 1.6 + .5 * fillK) * al;
          }

          // enrage red pulse
          emi += vec3(1., .05, .05) * uEnrage * (.15 + .25 * pow(1. - uBeat, 3.)) * (.4 + shoulder);
          gl_FragColor = vec4(col + emi, 1.);
          #include <fog_fragment>
        }`,
    });
  }

  // curb / wall / skirt material (one mesh, aPart: 0 curb, 1 skirt, 2 bottom)
  function makeTrimMaterial(U) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uBeat: U.uBeat, uPalette: U.uPalette, uEnrage: U.uEnrage, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) },
      fog: true, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute float aS, aPart, aV, aSide; varying float vS, vPart, vV, vSide; varying vec3 vWN;
        #include <fog_pars_vertex>
        void main(){ vS = aS; vPart = aPart; vV = aV; vSide = aSide; vWN = normalize(mat3(modelMatrix) * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uBeat, uEnrage; uniform vec3 uPalette[4]; varying float vS, vPart, vV, vSide; varying vec3 vWN;
        #include <fog_pars_fragment>
        void main(){
          vec3 edge = uPalette[2], line = uPalette[1];
          float pulse = .4 * pow(1. - uBeat, 4.);
          vec3 c;
          vec3 sideCol = vSide > 0. ? edge : line * .8;
          if (vPart < .5) {            // rumble curb: alternating stripes
            float st = step(.5, fract(vS / 2.5));
            c = mix(vec3(.03, .03, .05), sideCol * (1.0 + pulse * 1.2), st * .85);
            c += sideCol * smoothstep(.8, 1., vV) * .6;
          } else if (vPart < 1.5) {    // skirt: dark with a glowing top lip and panel seams
            float top = smoothstep(.25, .0, vV);
            float seam = smoothstep(.06, .0, abs(fract(vS / 12.) - .5) - .44);
            c = vec3(.02, .02, .03) + sideCol * (top * 1.6 + seam * .25) + vec3(1., .05, .05) * uEnrage * top;
          } else c = vec3(.01, .01, .015) + edge * .05;
          gl_FragColor = vec4(c, 1.);
          #include <fog_fragment>
        }`,
    });
  }

  // additive energy rail on top of the curbs
  function makeFenceMaterial(U) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uBeat: U.uBeat, uPalette: U.uPalette, uEnrage: U.uEnrage, uKart: U.uKart, uL: U.uL },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'attribute float aS, aV, aSide; varying float vS, vV, vSide; void main(){ vS = aS; vV = aV; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */`
        uniform float uTime, uBeat, uEnrage, uL; uniform vec3 uPalette[4]; uniform vec3 uKart; varying float vS, vV, vSide;
        void main(){
          vec3 c = vSide > 0. ? uPalette[2] : uPalette[1] * .7;
          c = mix(c, vec3(1., .1, .1), uEnrage * .6);
          float pulse = .4 * pow(1. - uBeat, 4.);
          float topLine = smoothstep(.88, .97, vV) * smoothstep(1., .97, vV);
          float body = pow(1. - vV, 2.2) * .12;
          float scan = smoothstep(.9, 1., fract(vS / 6. - uTime * 1.5)) * (1. - vV) * .5;
          float ks = mod(vS - uKart.x + uL * .5, uL) - uL * .5;
          float near = exp(-ks * ks * .004) * .35;    // brighter near the kart
          float a = (body + topLine * 1.1 + scan * .6) * (1. + pulse * 1.5 + near);
          gl_FragColor = vec4(c * a * 1.3, 1.);
        }`,
    });
  }

  // ------------------------------------------------------------------
  // Strip geometry builder with gap-aware index
  // strips: [{part, side, d0,h0, d1,h1 (functions of halfwidth)}]
  // ------------------------------------------------------------------
  const meshes = {};
  const stripGeos = [];   // {geo, nStrips}
  function buildStrips(strips, withPart) {
    const rows = n + 1, K = strips.length, vc = rows * K * 2;
    const pos = new Float32Array(vc * 3), aS = new Float32Array(vc), aV = new Float32Array(vc), aSide = new Float32Array(vc), aPart = withPart ? new Float32Array(vc) : null;
    const aD = new Float32Array(vc), aHW = new Float32Array(vc);
    for (let r = 0; r < rows; r++) {
      const i = r % n, i3 = i * 3, hw = W[i] / 2, s = r * dsm;
      for (let k = 0; k < K; k++) {
        const st = strips[k];
        for (let e = 0; e < 2; e++) {
          const d = e ? st.d1(hw) : st.d0(hw), h = e ? st.h1(hw) : st.h0(hw);
          const v = (r * K + k) * 2 + e, v3 = v * 3;
          pos[v3] = P[i3] + RR[i3] * d + NN[i3] * h; pos[v3 + 1] = P[i3 + 1] + RR[i3 + 1] * d + NN[i3 + 1] * h; pos[v3 + 2] = P[i3 + 2] + RR[i3 + 2] * d + NN[i3 + 2] * h;
          aS[v] = s; aV[v] = e; aSide[v] = st.side; aD[v] = d; aHW[v] = hw; if (aPart) aPart[v] = st.part;
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1)); geo.setAttribute('aV', new THREE.BufferAttribute(aV, 1));
    geo.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1)); geo.setAttribute('aD', new THREE.BufferAttribute(aD, 1));
    geo.setAttribute('aHW', new THREE.BufferAttribute(aHW, 1));
    if (aPart) geo.setAttribute('aPart', new THREE.BufferAttribute(aPart, 1));
    geo.userData = { K, flip: strips.map(s => !!s.flip) };
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(n * K * 6), 1));
    fillIndex(geo);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    stripGeos.push(geo);
    return geo;
  }
  function fillIndex(geo) {
    const K = geo.userData.K, idx = geo.index.array; let c = 0;
    for (let r = 0; r < n; r++) {
      const sm = (r + 0.5) * dsm;
      if (T.gaps.length && T.isGap(sm)) continue;
      for (let k = 0; k < K; k++) {
        const a = (r * K + k) * 2, b = a + 1, a2 = ((r + 1) * K + k) * 2, b2 = a2 + 1;
        // default winding faces +N for strips that run toward +d (surface)
        if (!geo.userData.flip[k]) { idx[c++] = a; idx[c++] = b; idx[c++] = a2; idx[c++] = b; idx[c++] = b2; idx[c++] = a2; }
        else { idx[c++] = a; idx[c++] = a2; idx[c++] = b; idx[c++] = b; idx[c++] = a2; idx[c++] = b2; }
      }
    }
    geo.setDrawRange(0, c); geo.index.needsUpdate = true;
  }
  function rebuildIndex() {
    for (const g of stripGeos) fillIndex(g);
    if (!T.uniforms) return;
    const ug = T.uniforms.uGaps.value;
    for (let i = 0; i < MAX_GAPS; i++) { const g = T.gaps[i]; if (g) ug[i].set(g.s0, g.s1); else ug[i].set(-1, -1); }
    refreshVoid();
  }

  // ------------------------------------------------------------------
  // Item boxes, ramps, void glow, lap gate
  // ------------------------------------------------------------------
  function makeBoxes(U) {
    const geo = new THREE.OctahedronGeometry(0.85, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`varying vec3 vN, vV, vP; void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.);
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vP = position;
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */`uniform float uTime; varying vec3 vN, vV, vP;
        void main(){ float f = pow(1. - abs(dot(normalize(vN), vV)), 2.);
          vec3 ir = .5 + .5 * cos(6.2831 * (f * 1.2 + uTime * .35 + vP.y * .6 + vec3(0., .33, .67)));
          vec3 c = ir * (f * 2.4 + .25) + vec3(1.) * pow(f, 6.) * 2.;
          gl_FragColor = vec4(c, 1.); }`,
    });
    const m = new THREE.InstancedMesh(geo, mat, MAX_BOXES);
    m.count = 0; m.frustumCulled = false; return m;
  }
  function makeRampMesh(U) {
    // unit wedge: x across [-.5,.5], z forward [0,1] (rising), y [0,1]; uv: x=across, y=along
    const v = [], uv = [], idx = [];
    const push = (x, y, z, u, w) => { v.push(x, y, z); uv.push(u, w); return v.length / 3 - 1; };
    // slope
    let a = push(-.5, 0, 0, 0, 0), b = push(.5, 0, 0, 1, 0), c = push(.5, 1, 1, 1, 1), d = push(-.5, 1, 1, 0, 1); idx.push(a, c, b, a, d, c);
    // back
    a = push(-.5, 0, 1, 0, 2), b = push(.5, 0, 1, 1, 2), c = push(.5, 1, 1, 1, 3), d = push(-.5, 1, 1, 0, 3); idx.push(a, b, c, a, c, d);
    // sides
    a = push(-.5, 0, 0, 0, 4), b = push(-.5, 0, 1, 0, 4), c = push(-.5, 1, 1, 0, 5); idx.push(a, c, b);
    a = push(.5, 0, 0, 1, 4), b = push(.5, 0, 1, 1, 4), c = push(.5, 1, 1, 1, 5); idx.push(a, b, c);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uPalette: U.uPalette, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) }, fog: true, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying float vCamD;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mvPosition; vCamD = -mvPosition.z;
        #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime; uniform vec3 uPalette[4]; varying vec2 vUv; varying float vCamD;
        #include <fog_pars_fragment>
        void main(){ vec3 acc = uPalette[3];
          float nearCam = mix(.35, 1., smoothstep(4., 16., vCamD));   // a ramp under the kart must not bloom the screen
          vec3 c;
          if (vUv.y <= 1.001) { float ch = fract(vUv.y * 4. - abs(vUv.x - .5) * 1.4 - uTime * 1.8);
            float arrow = smoothstep(.0, .08, ch) * smoothstep(.45, .35, ch);
            float side = smoothstep(.06, .0, min(vUv.x, 1. - vUv.x));
            c = vec3(.04, .03, .05) + (acc * (arrow * 1.3 + side * 1.8 + .1) + vec3(1.) * smoothstep(.97, 1., vUv.y) * 1.4) * nearCam; }
          else c = vec3(.03, .02, .03) + acc * smoothstep(.15, 0., abs(vUv.y - 3.)) * 1.4;
          gl_FragColor = vec4(c, 1.);
          #include <fog_fragment>
        }`,
    });
    const m = new THREE.InstancedMesh(geo, mat, MAX_RAMPS); m.count = 0; m.frustumCulled = false; return m;
  }
  function refreshRamps() {
    const m = meshes.ramps; if (!m) return;
    let c = 0;
    for (const r of T.ramps) {
      if (!r.visual || c >= MAX_RAMPS) continue;
      const f = T.frame(r.s, frameScratch);
      const d0 = Math.max(r.d0, -f.w / 2), d1 = Math.min(r.d1, f.w / 2);
      sv.a.copy(f.r).multiplyScalar(d1 - d0); sv.b.copy(f.n).multiplyScalar(r.h); sv.c.copy(f.t).multiplyScalar(r.len);
      sv.d.copy(f.p).addScaledVector(f.r, (d0 + d1) / 2).addScaledVector(f.n, 0.02);
      sv.m.makeBasis(sv.a, sv.b, sv.c).setPosition(sv.d);
      m.setMatrixAt(c++, sv.m);
    }
    m.count = c; m.instanceMatrix.needsUpdate = true;
  }
  function makeVoidMesh(U) {
    const SEG = 10, verts = MAX_GAPS * (SEG + 1) * 2;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geo.setAttribute('aV', new THREE.BufferAttribute(new Float32Array(verts), 1));
    const idx = [];
    for (let g = 0; g < MAX_GAPS; g++) for (let i = 0; i < SEG; i++) { const a = (g * (SEG + 1) + i) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uPalette: U.uPalette }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'attribute float aV; varying float vV; varying vec3 vP; void main(){ vV = aV; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uTime; uniform vec3 uPalette[4]; varying float vV; varying vec3 vP;
        void main(){ float n = sin(vP.x * .7 + uTime * 3.) * sin(vP.z * .6 - uTime * 2.3) * .5 + .5;
          gl_FragColor = vec4(uPalette[2] * (.9 + n * 1.) * (1. - abs(vV - .5) * 1.6), 1.); }`,
    });
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.userData.SEG = SEG; return m;
  }
  function refreshVoid() {
    const m = meshes.void; if (!m) return;
    const SEG = m.userData.SEG, pos = m.geometry.attributes.position.array, av = m.geometry.attributes.aV.array;
    for (let g = 0; g < MAX_GAPS; g++) {
      const gap = T.gaps[g];
      for (let i = 0; i <= SEG; i++) {
        const v = (g * (SEG + 1) + i) * 2;
        if (!gap) { for (let e = 0; e < 2; e++) { pos[(v + e) * 3] = pos[(v + e) * 3 + 1] = pos[(v + e) * 3 + 2] = 0; } continue; }
        const len = T.wrap(gap.s1 - gap.s0), s = gap.s0 + len * i / SEG;
        const f = T.frame(s, frameScratch), hw = f.w / 2 + 0.8;
        for (let e = 0; e < 2; e++) {
          sv.a.copy(f.p).addScaledVector(f.r, e ? hw : -hw).addScaledVector(f.n, -2.5);
          pos[(v + e) * 3] = sv.a.x; pos[(v + e) * 3 + 1] = sv.a.y; pos[(v + e) * 3 + 2] = sv.a.z; av[v + e] = i / SEG;
        }
      }
    }
    m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.aV.needsUpdate = true;
  }
  function makeLapGate(U, hw) {
    // merged boxes with a part attribute: 0 dark metal, 1 neon trim, 2 checker banner
    const parts = [];
    const add = (w, h, d, x, y, z, part) => {
      const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
      const a = new Float32Array(g.attributes.position.count).fill(part); g.setAttribute('aPart', new THREE.BufferAttribute(a, 1)); parts.push(g);
    };
    const X = hw + 1.6;
    for (const sx of [-1, 1]) {
      add(1.3, 8, 1.3, sx * X, 4, 0, 0);
      add(0.18, 7.6, 0.18, sx * (X - 0.66), 4, 0.66, 1); add(0.18, 7.6, 0.18, sx * (X - 0.66), 4, -0.66, 1);
      add(1.7, 0.5, 1.7, sx * X, 0.25, 0, 1);
    }
    add(X * 2 + 1.3, 1.1, 1.1, 0, 7.6, 0, 0);
    add(X * 2 - 1.4, 1.6, 0.12, 0, 6.6, 0.0, 2);
    add(X * 2 + 1.3, 0.14, 1.16, 0, 8.18, 0, 1); add(X * 2 + 1.3, 0.14, 1.16, 0, 7.02, 0, 1);
    const geo = G.addons.BufferGeometryUtils.mergeGeometries(parts); parts.forEach(p => p.dispose());
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uBeat: U.uBeat, uPalette: U.uPalette, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) }, fog: true,
      vertexShader: `attribute float aPart; varying float vPart; varying vec3 vP, vN;
        #include <fog_pars_vertex>
        void main(){ vPart = aPart; vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 mvPosition = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime, uBeat; uniform vec3 uPalette[4]; varying float vPart; varying vec3 vP, vN;
        #include <fog_pars_fragment>
        void main(){ vec3 c; float pulse = .4 * pow(1. - uBeat, 4.);
          if (vPart < .5) c = vec3(.025, .03, .05) * (.6 + .6 * clamp(vN.y * .5 + .5, 0., 1.)) + uPalette[1] * .04;
          else if (vPart < 1.5) c = uPalette[1] * (2.4 + pulse * 3.);
          else { vec2 q = floor(vec2(vP.x / .8 + uTime * 1.5, vP.y / .8)); float ch = mod(q.x + q.y, 2.); c = mix(vec3(.02), vec3(1.6), ch); }
          gl_FragColor = vec4(c, 1.);
          #include <fog_fragment>
        }`,
    });
    return new THREE.Mesh(geo, mat);
  }

  // ------------------------------------------------------------------
  // Centerline generation
  // ------------------------------------------------------------------
  function genStadium(sh) {
    const S = sh.straight || 120, r = sh.radius || 55, L = 2 * S + 2 * Math.PI * r;
    const pts = (s, out) => {
      if (s < S) return out.set(-S / 2 + s, 0, r);
      s -= S; if (s < Math.PI * r) { const a = s / r; return out.set(S / 2 + r * Math.sin(a), 0, r * Math.cos(a)); }
      s -= Math.PI * r; if (s < S) return out.set(S / 2 - s, 0, -r);
      s -= S; const a = s / r; return out.set(-S / 2 - r * Math.sin(a), 0, -r * Math.cos(a));
    };
    return { L, pos: pts, kabs: (s) => ((s >= S && s < S + Math.PI * r) || s >= 2 * S + Math.PI * r) ? 1 / r : 0 };
  }
  function genRing(sh) {
    const r = sh.radius || 70, L = 2 * Math.PI * r;
    return { L, pos: (s, out) => out.set(r * Math.sin(s / r), 0, r * Math.cos(s / r)), kabs: () => 1 / r };
  }
  function genSpline(sh, arena) {
    let pts = sh.points.map(p => p.slice());
    // ensure counter-clockwise seen from above (negative xz shoelace in our convention)
    let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[2] - b[0] * a[2]; }
    if (area > 0) { pts = [pts[0], ...pts.slice(1).reverse()]; pts.forEach(p => { if (p[4] != null) p[4] = -p[4]; }); T.reversed = true; }
    let curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), true, 'centripetal');
    if (sh.targetL) {
      const k = sh.targetL / curve.getLength();
      curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0] * k, p[1], p[2] * k)), true, 'centripetal');
    }
    curve.arcLengthDivisions = 2000;
    const L = curve.getLength(), np = pts.length;
    const wAt = (u) => { const t = curve.getUtoTmapping(u) * np; const i = Math.floor(t) % np, f = t - Math.floor(t), e = f * f * (3 - 2 * f); const a = pts[i], b = pts[(i + 1) % np];
      return [(a[3] ?? arena.width ?? 16) * (1 - e) + (b[3] ?? arena.width ?? 16) * e, (a[4] ?? 0) * (1 - e) + (b[4] ?? 0) * e]; };
    return { L, pos: (s, out) => out.copy(curve.getPointAt(T.wrap(s) / L)), wb: (s) => wAt(T.wrap(s) / L) };
  }

  // ------------------------------------------------------------------
  // build(def): sample table + meshes
  // ------------------------------------------------------------------
  function build(def) {
    clear();
    const arena = def.arena || def;
    T.def = def; T.arena = arena; T.reversed = false;
    const sh = arena.shape || { type: 'stadium', straight: 120, radius: 55 };
    const gen = sh.type === 'ring' ? genRing(sh) : sh.type === 'spline' ? genSpline(sh, arena) : genStadium(sh);
    T.L = gen.L; n = Math.max(16, Math.round(gen.L)); dsm = gen.L / n;
    P = new Float32Array(n * 3); TT = new Float32Array(n * 3); RR = new Float32Array(n * 3); NN = new Float32Array(n * 3);
    W = new Float32Array(n); BANK = new Float32Array(n); KAP = new Float32Array(n);
    const tmp = new THREE.Vector3();
    for (let i = 0; i < n; i++) { gen.pos(i * dsm, tmp); P[i * 3] = tmp.x; P[i * 3 + 1] = tmp.y; P[i * 3 + 2] = tmp.z; }
    // tangents (central differences)
    for (let i = 0; i < n; i++) {
      const a = ((i - 1 + n) % n) * 3, b = ((i + 1) % n) * 3;
      tmp.set(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]).normalize();
      TT[i * 3] = tmp.x; TT[i * 3 + 1] = tmp.y; TT[i * 3 + 2] = tmp.z;
    }
    // signed curvature (κ>0 bends left = CCW about +Y), smoothed ±3 m
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = i * 3, b = ((i + 1) % n) * 3;
      const cy = TT[a + 2] * TT[b] - TT[a] * TT[b + 2];          // (Ti × Ti+1).y
      raw[i] = Math.asin(Math.max(-1, Math.min(1, cy))) / dsm;
    }
    const sm = Math.max(1, Math.round(3 / dsm));
    for (let i = 0; i < n; i++) { let s = 0; for (let k = -sm; k <= sm; k++) s += raw[(i + k + n) % n]; KAP[i] = s / (2 * sm + 1); }
    // width + bank
    const bankDeg = arena.bankCurves ?? arena.bank ?? 0;
    const bs = Math.max(1, Math.round(12 / dsm));
    for (let i = 0; i < n; i++) {
      if (gen.wb) { const [w, b] = gen.wb(i * dsm); W[i] = w; BANK[i] = b * Math.PI / 180; continue; }
      W[i] = arena.width || 18;
      if (sh.type === 'ring') { BANK[i] = (arena.bank || 0) * Math.PI / 180; continue; }
      let acc = 0; for (let k = -bs; k <= bs; k++) acc += gen.kabs(((i + k + n) % n) * dsm) > 0 ? 1 : 0;
      const c = acc / (2 * bs + 1); BANK[i] = bankDeg * Math.PI / 180 * (c * c * (3 - 2 * c));
    }
    // right/normal with bank (positive bank lifts +d)
    const t = new THREE.Vector3(), r = new THREE.Vector3(), nn = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = i * 3; t.set(TT[a], TT[a + 1], TT[a + 2]);
      r.crossVectors(t, UP).normalize(); nn.crossVectors(r, t).normalize();
      const cb = Math.cos(BANK[i]), sb = Math.sin(BANK[i]);
      tmp.copy(r).multiplyScalar(cb).addScaledVector(nn, sb);
      nn.multiplyScalar(cb).addScaledVector(r, -sb); r.copy(tmp);
      RR[a] = r.x; RR[a + 1] = r.y; RR[a + 2] = r.z; NN[a] = nn.x; NN[a + 1] = nn.y; NN[a + 2] = nn.z;
    }

    // ---- gameplay features ----
    T.lapGateS = arena.lapGateS || 0;
    T.pads = (arena.pads || []).map(p => { const s = T.wrap(p.s), w = T.width(s), lane = p.lane || 0; return { s, lane, len: p.len || 8, d0: lane * w / 3 - w / 6 + 0.4, d1: lane * w / 3 + w / 6 - 0.4, add: p.add, dur: p.dur }; });
    T.itemRows = (arena.itemRows || []).map(s => T.wrap(s));
    T.boxes = [];
    for (const s of T.itemRows) for (const lane of [-1, 0, 1]) if (T.boxes.length < MAX_BOXES) T.boxes.push({ s, d: T.laneD(lane, s), lane, alive: true, scale: 1, respawnAt: 0, idx: T.boxes.length });
    T.driftZones = (arena.driftZones || arena['drift Zones'] || []).map(z => ({ s0: T.wrap(z.s0), s1: T.wrap(z.s1), mult: z.mult || 1.25 }));
    T.gaps = (arena.gaps || []).map(g => ({ id: ++uid, s0: T.wrap(g.s0), s1: T.wrap(g.s1), until: Infinity, permanent: true }));
    T.ramps = [];

    // ---- materials ----
    const surf = makeSurfaceMaterial(); const U = T.uniforms = surf.uniforms;
    const pal = arena.palette || {};
    U.uPalette.value[0].set(pal.base || '#16100d'); U.uPalette.value[1].set(pal.line || '#33f6ff');
    U.uPalette.value[2].set(pal.edge || '#ff6a1a'); U.uPalette.value[3].set(pal.accent || '#ffc93a');
    U.uSurface.value = { basalt: 0, glass: 1, chrome: 2 }[arena.surface || 'basalt'] ?? 0;
    U.uL.value = T.L;
    U.uDetail.value = G.quality.tier === 'low' ? 0 : 1;
    for (let i = 0; i < MAX_PADS; i++) { const p = T.pads[i]; if (p) U.uPads.value[i].set(p.s, p.d0, p.d1, p.len); else U.uPads.value[i].set(0, 0, 0, 0); }
    T.driftZones.slice(0, 2).forEach((z, i) => U.uDZ.value[i].set(z.s0, z.s1));
    if (arena.sunDir) U.uSun.value.set(...arena.sunDir).normalize();
    U.uSky.value.set(pal.edge || '#ff6a1a');

    // ---- meshes ----
    stripGeos.length = 0;
    const surfGeo = buildStrips([{ part: 0, side: 0, d0: hw => -hw, h0: () => 0, d1: hw => hw, h1: () => 0 }], false);
    // rename aV->unused; surface shader uses aS/aD/aHW
    meshes.surface = new THREE.Mesh(surfGeo, surf);
    const C = 0.8, CH = 0.18, SK = 3.2;
    const trimGeo = buildStrips([
      // outer side (+d)
      { part: 0, side: 1, d0: hw => hw, h0: () => 0, d1: hw => hw + 0.2, h1: () => CH },
      { part: 0, side: 1, d0: hw => hw + 0.2, h0: () => CH, d1: hw => hw + C, h1: () => CH },
      { part: 1, side: 1, d0: hw => hw + C, h0: () => CH, d1: hw => hw + C, h1: () => -SK },
      // inner side (-d)
      { part: 0, side: -1, d0: hw => -hw - 0.2, h0: () => CH, d1: hw => -hw, h1: () => 0 },
      { part: 0, side: -1, d0: hw => -hw - C, h0: () => CH, d1: hw => -hw - 0.2, h1: () => CH },
      { part: 1, side: -1, d0: hw => -hw - C, h0: () => -SK, d1: hw => -hw - C, h1: () => CH },
      // underside
      { part: 2, side: 0, d0: hw => hw + C, h0: () => -SK, d1: hw => -hw - C, h1: () => -SK },
    ], true);
    meshes.trim = new THREE.Mesh(trimGeo, makeTrimMaterial(U));
    const fenceGeo = buildStrips([
      { side: 1, d0: hw => hw + C, h0: () => CH, d1: hw => hw + C, h1: () => CH + 1.05 },
      { side: -1, d0: hw => -hw - C, h0: () => CH, d1: hw => -hw - C, h1: () => CH + 0.75 },
    ], false);
    meshes.fence = new THREE.Mesh(fenceGeo, makeFenceMaterial(U)); meshes.fence.renderOrder = 2;
    meshes.boxes = makeBoxes(U);
    meshes.ramps = makeRampMesh(U);
    meshes.void = makeVoidMesh(U);
    const gf = T.frame(T.lapGateS, frameScratch);
    meshes.gate = makeLapGate(U, gf.w / 2);
    sv.m.makeBasis(gf.r, gf.n, sv.a.copy(gf.t).negate()).setPosition(gf.p); meshes.gate.applyMatrix4(sv.m);
    for (const k in meshes) T.group.add(meshes[k]);

    for (const r of (arena.ramps || [])) T.addRamp(r);
    rebuildIndex(); refreshRamps();
    T.built = true;
    G.emit('track:built', { L: T.L });
    return T;
  }

  function clear() {
    for (const k in meshes) { const m = meshes[k]; T.group.remove(m); m.geometry.dispose(); m.material.dispose(); delete meshes[k]; }
    stripGeos.length = 0;
    // scenery group: dispose everything boss modules put there
    for (let i = T.scenery.children.length - 1; i >= 0; i--) {
      const c = T.scenery.children[i]; T.scenery.remove(c);
      c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    }
    T.pads = []; T.itemRows = []; T.boxes = []; T.ramps = []; T.gaps = []; T.driftZones = [];
    T.built = false; T.uniforms = null; n = 0; T.L = 0;
  }

  // ------------------------------------------------------------------
  // buildArena(def): track + fog + env + sky + boss scenery (into T.scenery)
  // ------------------------------------------------------------------
  function buildArena(def) {
    def = def || G.bosses[(G.params.boss || 1) - 1] || T.defaultArena;
    build(def);
    const a = def.arena || def, pal = a.palette || {};
    const fog = a.fog || { color: '#2a0d05', near: 80, far: 420 };
    G.scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
    G.renderer.setClearColor(fog.color, 1);
    G.makeEnv(a.envTop || fog.color, pal.edge || '#ff6a1a', '#050505');
    if (G.lights) { G.lights.hemi.color.set(a.hemiSky || '#8fb8ff'); G.lights.hemi.groundColor.set(pal.edge || '#ff6a1a').multiplyScalar(0.35); }
    if (G.sky && G.sky.set) { try { G.sky.set(a.sky || 'ember'); } catch (e) { G.logError('sky.set', e); } }
    else T.scenery.add(fallbackSky(fog.color, pal.edge || '#ff6a1a'));
    if (def.buildScenery) { try { def.buildScenery(T.scenery, T); } catch (e) { G.logError('buildScenery', e); } }
    return T;
  }

  function fallbackSky(top, hor) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { a: { value: new THREE.Color(top) }, b: { value: new THREE.Color(hor) }, uTime: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w * .9999; }',
      fragmentShader: `uniform vec3 a, b; uniform float uTime; varying vec3 vP; ${NOISE.replace(/float aaLine[^\n]*\n/, '')}
        void main(){ vec3 d = normalize(vP); float y = d.y;
          vec3 c = mix(b * 1.1, a * .6, smoothstep(-.02, .45, y));
          float sm = fbm2(vec2(atan(d.z, d.x) * 6., y * 9. - uTime * .02));
          c = mix(c, a * .3, smoothstep(.45, .8, sm) * smoothstep(.0, .3, y) * .7);
          c += b * pow(1. - abs(y), 12.) * 1.2;
          if (y < 0.) c = mix(b * .5, a * .4, smoothstep(0., -.2, y));
          gl_FragColor = vec4(c, 1.); }`,
    }));
    m.renderOrder = -10; m.frustumCulled = false; m.userData.fallbackSky = true;
    return m;
  }

  // ------------------------------------------------------------------
  // DEFAULT TEST ARENA (Ember Bowl shape, §7.1). Boss 1 module supplies the real one.
  // South straight s 0..120, east curve 120..292.8, north straight 292.8..412.8, west curve ..585.6
  // ------------------------------------------------------------------
  T.defaultArena = {
    id: 0, name: 'TEST', title: 'default arena',
    arena: {
      name: 'EMBER BOWL', sky: 'ember', palette: { base: '#16100d', line: '#33f6ff', edge: '#ff6a1a', accent: '#ffc93a' },
      shape: { type: 'stadium', straight: 120, radius: 55 }, width: 18, bankCurves: 8,
      pads: [{ s: 30, lane: 0, len: 8 }, { s: 80, lane: 1, len: 8 }, { s: 322.8, lane: 0, len: 8 }, { s: 388, lane: 1, len: 8 }],
      ramps: [{ s: 352.8, len: 10, kick: 9 }], gaps: [{ s0: 366, s1: 374 }], itemRows: [15, 307.8],
      surface: 'basalt', fog: { color: '#2a0d05', near: 80, far: 420 },
    },
    buildScenery(group, track) {
      // lava crater inside the oval
      const lavaMat = new THREE.ShaderMaterial({
        uniforms: { uTime: track.uniforms.uTime, uCool: track.uniforms.uCool, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) }, fog: true,
        vertexShader: `varying vec2 vXZ;
          #include <fog_pars_vertex>
          void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vXZ = wp.xz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
          }`,
        fragmentShader: `uniform float uTime, uCool; varying vec2 vXZ;
          #include <fog_pars_fragment>
          ${NOISE}
          void main(){ vec2 p = vXZ * .045; vec2 q = vec2(fbm(p + uTime * .03), fbm(p + 4.7 - uTime * .025));
            float f = fbm(p * 1.6 + q * 2.2 + uTime * .02);
            float crust = smoothstep(.36, .5, f);
            float vein = smoothstep(.05, .0, abs(f - .36));
            vec3 hot = mix(vec3(.9, .16, 0.), vec3(1., .6, .15), vein);
            vec3 c = mix(hot * (.9 + vein * 1.4) * (1. - uCool * .9), vec3(.035, .02, .018) + vec3(.25, .05, 0.) * (1. - crust) , crust);
            gl_FragColor = vec4(c, 1.);
            #include <fog_fragment>
          }`,
      });
      const shape = new THREE.Shape(); const S = 60, R = 55 - 10.5;
      shape.absarc(S, 0, R, -Math.PI / 2, Math.PI / 2, false); shape.absarc(-S, 0, R, Math.PI / 2, Math.PI * 1.5, false);
      const lg = new THREE.ShapeGeometry(shape, 24); lg.rotateX(-Math.PI / 2);
      const lava = new THREE.Mesh(lg, lavaMat); lava.position.y = -1.6; group.add(lava);
      // obsidian pedestal
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(13, 16, 5, 10), new THREE.MeshStandardMaterial({ color: '#0c0a0e', metalness: 0.6, roughness: 0.3, flatShading: true }));
      ped.position.y = 0.5; group.add(ped);
      // volcanic ground outside + low-poly rocks
      const ground = new THREE.Mesh(new THREE.CircleGeometry(700, 40), new THREE.MeshStandardMaterial({ color: '#140a07', roughness: 1, metalness: 0 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -3.4; group.add(ground);
      const rockGeo = new THREE.DodecahedronGeometry(1, 0);
      const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: '#1d130f', roughness: 0.9, metalness: 0.1, flatShading: true, emissive: '#3a0d00', emissiveIntensity: 0.4 }), 40);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
      for (let i = 0; i < 40; i++) {
        const a = i / 40 * Math.PI * 2 + Math.random() * 0.1, rr = 1.0 + Math.random() * 0.8;
        ps.set(Math.cos(a) * (130 * rr + 25), -3, Math.sin(a) * (85 * rr + 20));
        const k = 6 + Math.random() * 18; sc.set(k * (0.8 + Math.random() * 0.6), k * (0.6 + Math.random() * 1.6), k);
        q.setFromEuler(e.set(Math.random(), Math.random() * 6, Math.random() * 0.5));
        rocks.setMatrixAt(i, m.compose(ps, q, sc));
      }
      group.add(rocks);
    },
  };

  // ------------------------------------------------------------------
  // Per-tick update: uniforms, expiring ramps/gaps, item box fallback
  // ------------------------------------------------------------------
  let beatFallback = 0;
  function update(dt) {
    if (!T.built) return;
    const U = T.uniforms, now = G.time.now;
    U.uTime.value = now;
    if (G.audio && typeof G.audio.beat === 'number' && !G.params.test) U.uBeat.value = G.audio.beat;
    else { beatFallback = (beatFallback + dt * 140 / 60) % 1; U.uBeat.value = beatFallback; }
    const k = G.kart;
    U.uPulseAmt.value = G.settings && G.settings.reduceShake ? 0.25 : 1;
    if (k) { U.uSpeed.value = (k.speed || 0) / 50; U.uKart.value.set(k.s || 0, k.d || 0, k.speed || 0); }
    // expire timed ramps / gaps
    let ch = false;
    for (let i = T.ramps.length - 1; i >= 0; i--) if (T.ramps[i].until <= now) { T.ramps.splice(i, 1); ch = true; }
    if (ch) refreshRamps();
    ch = false;
    for (let i = T.gaps.length - 1; i >= 0; i--) if (T.gaps[i].until <= now) { T.gaps.splice(i, 1); ch = true; }
    if (ch) rebuildIndex();
    // item box pickup fallback (only while COMBAT's G.items does not exist)
    if (!G.items && k) {
      for (const b of T.boxes) {
        if (!b.alive) { if (now >= b.respawnAt) b.alive = true; continue; }
        if (Math.abs(T.ds(k.s, b.s)) < 2 && Math.abs(k.d - b.d) < 2 && (k.h || 0) < 2.5) {
          b.alive = false; b.respawnAt = now + 6;
          if (G.fx && G.fx.burst) G.fx.burst('chrome', T.toWorld(b.s, b.d, 1.2, sv.d), { count: 20 });
        }
      }
    }
  }
  // render: spin item boxes (scale animates toward alive state)
  function render(alpha, rdt) {
    const m = meshes.boxes; if (!m) return;
    const t = G.time.now;
    for (let i = 0; i < T.boxes.length; i++) {
      const b = T.boxes[i];
      const target = b.alive ? 1 : 0;
      b.scale += (target - b.scale) * Math.min(1, (rdt || 0.016) * (b.alive ? 6 : 14));
      const f = T.frame(b.s, frameScratch);
      sv.d.copy(f.p).addScaledVector(f.r, b.d).addScaledVector(f.n, 1.25 + Math.sin(t * 2.5 + i) * 0.18);
      sv.q.setFromAxisAngle(f.n, t * 1.6 + i);
      sv.a.setScalar(Math.max(0.0001, b.scale * (1 + 0.06 * Math.sin(t * 6 + i))));
      m.setMatrixAt(i, sv.m.compose(sv.d, sv.q, sv.a));
    }
    m.count = T.boxes.length; m.instanceMatrix.needsUpdate = true;
    // fallback sky follows the camera
    for (const c of T.scenery.children) if (c.userData.fallbackSky) { c.position.copy(G.camera.position); c.material.uniforms.uTime.value = t; }
  }

  G.on('quality', ({ tier }) => { if (T.uniforms) T.uniforms.uDetail.value = tier === 'low' ? 0 : 1; });

  G.register('track', { init() { }, update, render, reset() { T.clearBands(); } });
}
