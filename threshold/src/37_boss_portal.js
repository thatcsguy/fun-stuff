// DOOR XVIII: JANUS, the Space Between. A floor with holes into other skies. Every pair of gates is one door; what he swings across the hall cannot be dodged, only left.
(() => {
  // How a gate is entered (a feel choice, all three are built): 'walk' = step within 1.2 m of an open gate's centre;
  // 'dwell' = stand on it for 0.45 s while its rim fills; 'jump' = walking over is safe, landing on it from a jump enters.
  // ?gate=walk|dwell|jump overrides it for playtesting.
  const ENTER_DEFAULT = 'walk';
  const ENTER = ['walk', 'dwell', 'jump'].indexOf(QS.get('gate')) >= 0 ? QS.get('gate') : ENTER_DEFAULT;
  const R = 20, TRIG = 1.2, GATE_R = 1.7, TRANSIT = 0.45, LOCK_TRANSIT = 1.2, SHUT = 6, DWELL = 0.45, MOVE_AT = 0.44, NSLOT = 11; // slots 0-9 hold the layout; slot 10 is the gate he uses at the centre (intro and death)
  const CRIMSON = 0xff2a3a;
  const PAIR_HEX = [0xffd04a, 0x38d8ff, 0xa070ff, 0x5cf08a, 0xffb0e0];
  const PG = [
    { bloom: 0.35, threshold: 0.9, radius: 0.55, exposure: 1.0, vig: 0.45, sat: 1.05, contrast: 1.04, tint: [1.03, 1.0, 0.97] },
    { bloom: 0.45, threshold: 0.88, radius: 0.55, exposure: 0.92, vig: 0.7, sat: 1.0, contrast: 1.1, tint: [0.96, 1.0, 1.04] },
    { bloom: 0.5, threshold: 0.9, radius: 0.55, exposure: 1.0, vig: 0.55, sat: 1.15, contrast: 1.08, tint: [1.0, 1.0, 1.0] },
  ];
  // per phase look: sky split (dawn/night), drifting doors, mosaic, mirror floor, door leaves (0 shut, 1 ajar, 2 open, 3 torn off), head (0 gold face, 1 silver face, 2 masks orbit)
  const LOOK = [
    { split: 1, doors: 0, mosaic: 0, gloss: 0, leaves: 1, head: 0, shaft: 0 },
    { split: 0, doors: 1, mosaic: 0, gloss: 0, leaves: 2, head: 1, shaft: 0.35 },
    { split: 0, doors: 1, mosaic: 1, gloss: 1, leaves: 3, head: 2, shaft: 0 },
  ];

  // <gates> pure gate logic and route solver: no THREE or game globals (tools/gatefuzz.js loads this block on its own)
  // A hazard sweeps the hall: { k: 'wall', dx, dz, u, t0, s0 } has its front at s = s0 + u (t - t0) along (dx, dz);
  // { k: 'in', u, t0, r0 } is a ring closing from radius r0; { k: 'out', u, t0 } a ring opening from the centre.
  // hzF > 0: the point is ahead (not swept yet); < 0: behind. Before launch everything is ahead, after the sweep everything is behind.
  // Times are seconds; the solver works in times relative to "now".
  function hzF(h, x, z, t) {
    const e = t > h.t0 ? t - h.t0 : 0;
    if (h.k === 'wall') return x * h.dx + z * h.dz - (h.s0 + h.u * e);
    if (h.k === 'in') return (h.r0 - h.u * e) - Math.hypot(x, z);
    return Math.hypot(x, z) - h.u * e;
  }
  function hzEnd(h) { return h.t0 + (h.k === 'wall' ? (22 - h.s0) / h.u : h.k === 'in' ? h.r0 / h.u : 22 / h.u); }
  function hzReach(h, x, z) { // when the front passes (x, z)
    if (h.k === 'wall') return h.t0 + (x * h.dx + z * h.dz - h.s0) / h.u;
    const r = Math.hypot(x, z); return h.k === 'in' ? h.t0 + (h.r0 - r) / h.u : h.t0 + r / h.u;
  }
  const mkWall = (a, u, t0) => ({ k: 'wall', dx: -Math.sin(a), dz: -Math.cos(a), u, t0, s0: -22 }); // rises at compass angle a on the rim, crosses toward the far side
  // gate layouts. Each gate: { x, z, pair, twin }. P3 keeps ten fixed sockets (inner 0-4, outer 5-9); pairing A or B only rewires them.
  const LAYOUT = (() => {
    const P = (list) => { const g = []; list.forEach(([a, b], pair) => { const i = g.length; g.push({ x: a[0], z: a[1], pair, twin: i + 1 }, { x: b[0], z: b[1], pair, twin: i }); }); return g; };
    const IN = [[0, -7.5], [7.1, -2.3], [4.4, 6.1], [-4.4, 6.1], [-7.1, -2.3]], OUT = [[9.1, -12.5], [14.7, 4.8], [0, 15.5], [-14.7, 4.8], [-9.1, -12.5]];
    const P3 = (off) => { const g = []; for (let i = 0; i < 5; i++) g.push({ x: IN[i][0], z: IN[i][1], pair: i, twin: 5 + (i + off) % 5 }); for (let j = 0; j < 5; j++) { const i = (j - off + 5) % 5; g.push({ x: OUT[j][0], z: OUT[j][1], pair: i, twin: i }); } return g; };
    return {
      P1: P([[[0, -14], [0, 14]], [[-14, 0], [14, 0]], [[-10, -10], [10, 10]]]),
      P2: P([[[0, -7.5], [10.6, 10.6]], [[7.5, 0], [-10.6, 10.6]], [[0, 7.5], [-10.6, -10.6]], [[-7.5, 0], [10.6, -10.6]]]),
      P3A: P3(2), P3B: P3(0),
    };
  })();
  // the variants of each gate mechanic, as hazard lists. ct = cast time (launch, seconds from now).
  const VARIANTS = {
    slam: (ct) => { const v = []; for (let k = 0; k < 8; k++) v.push([mkWall(k * Math.PI / 4, 9, ct)]); return v; },
    iris: (ct) => [[{ k: 'in', u: 6, t0: ct, r0: 22 }]],
    doors: (ct) => { const v = []; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; v.push([mkWall(a, 8, ct), mkWall(a + Math.PI, 8, ct)]); } return v; },
    rebound: (ct) => [[{ k: 'in', u: 6, t0: ct, r0: 22 }, { k: 'out', u: 7, t0: ct + 22 / 6 + 0.8 }]],
    triptych: (ct) => { const v = []; for (let k = 0; k < 8; k++) for (const sg of [1, -1]) { const a = k * Math.PI / 4; v.push([0, 1, 2].map((i) => mkWall(a + sg * i * Math.PI * 0.75, 9, ct + i * 1.8))); } return v; },
  };
  const HOLD = { walk: 0, dwell: 0.45, jump: 0.65 };
  // Route solver. o: { gates, haz, x, z, t (start, i.e. after the reaction time), shut: { pair: reopen time } (Infinity = sealed),
  //   mode, v (run speed), m (margin on every side test), tr (transit time), maxTrips, budget, F (starting sides, optional) }.
  // A trip runs straight to a spot 2 m short of a gate (on it in 'jump' mode), may wait there, steps in, and comes out of the twin
  // TR later. Running and waiting must never change any hazard's side; only a gate may. Done when every hazard is behind.
  // Returns { n, trips: [{ g, W: [x, z], te, tx }] } with the fewest trips, or null.
  function solve(o) {
    const H = o.haz, GT = o.gates, v = o.v || 5.8, m = o.m === undefined ? 0.6 : o.m, TR = o.tr || 0.45, mode = o.mode || 'walk', hold = HOLD[mode] || 0, walk = mode === 'walk';
    const SH = o.shutT === undefined ? 6 : o.shutT; let budget = o.budget || 3000;
    const F0 = o.F ? o.F.slice() : H.map((h) => { const f = hzF(h, o.x, o.z, o.t); return Math.abs(f) <= m ? 0 : f > 0 ? 1 : -1; });
    if (F0.some((f) => f === 0)) return null;
    const done = (F) => { for (const f of F) if (f > 0) return false; return true; };
    if (done(F0)) return { n: 0, trips: [] };
    const shutOf = (S, p) => (S && S[p] !== undefined ? S[p] : 0);
    const segOk = (F, x0, z0, t0, x1, z1, t1) => {
      const dur = t1 - t0;
      for (let i = 0; i < H.length; i++) {
        const h = H[i], f = F[i];
        if (h.k === 'wall') { // linear in time on each side of the launch: the ends and the launch instant are enough
          if (f * hzF(h, x0, z0, t0) <= m || f * hzF(h, x1, z1, t1) <= m) return false;
          if (h.t0 > t0 && h.t0 < t1) { const k = (h.t0 - t0) / dur; if (f * hzF(h, x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, h.t0) <= m) return false; }
        } else { const n = dur > 0.001 ? Math.ceil(dur / 0.08) : 0; for (let j = 0; j <= n; j++) { const k = n ? j / n : 0; if (f * hzF(h, x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, t0 + dur * k) <= m) return false; } }
      }
      return true;
    };
    // in 'walk' mode a run may not pass over another open gate (it would take you through)
    const clear = (S, gi, x0, z0, x1, z1, t1) => {
      if (!walk) return true;
      const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz;
      for (let k = 0; k < GT.length; k++) { if (k === gi) continue; const q = GT[k]; if (shutOf(S, q.pair) > t1) continue;
        if (Math.hypot(x0 - q.x, z0 - q.z) < TRIG_S + 0.4) continue; // the gate you are standing on (shut, you just came out of it)
        const k2 = L2 > 1e-6 ? Math.max(0, Math.min(1, ((q.x - x0) * dx + (q.z - z0) * dz) / L2)) : 0;
        if (Math.hypot(x0 + dx * k2 - q.x, z0 + dz * k2 - q.z) < TRIG_S + 0.35) return false; }
      return true;
    };
    const TRIG_S = 1.2;
    function cands(x, z, t, F, S) {
      const out = [];
      for (let gi = 0; gi < GT.length; gi++) {
        const C = GT[gi], T = GT[C.twin], so = shutOf(S, C.pair); if (so === Infinity) continue;
        const dx = x - C.x, dz = z - C.z, dl = Math.hypot(dx, dz); if (dl < 0.3 && so > t) continue;
        let Wx = C.x, Wz = C.z, step = 0;
        if (mode !== 'jump') { // 2 m out on the approach side (standing on it already: step off toward the middle first)
          const ux = dl > 0.05 ? dx / dl : -C.x / (Math.hypot(C.x, C.z) || 1), uz = dl > 0.05 ? dz / dl : -C.z / (Math.hypot(C.x, C.z) || 1); Wx = C.x + ux * 2; Wz = C.z + uz * 2; step = 2 / v; }
        const tW = t + Math.hypot(x - Wx, z - Wz) / v;
        if (!segOk(F, x, z, t, Wx, Wz, tW) || !clear(S, gi, x, z, Wx, Wz, tW)) continue;
        const teMin = Math.max(tW + step + hold, so > t ? so + 0.25 : so); // a gate that is still shut: step in a beat after it reopens
        const ts = [teMin]; for (const h of H) { const tt = hzReach(h, T.x, T.z) + (m + 0.15) / h.u - TR; if (tt > teMin) ts.push(tt); }
        ts.sort((a, b) => a - b);
        const seen = {};
        for (const te of ts) {
          if (!segOk(F, Wx, Wz, tW, Wx, Wz, te)) break; // waiting longer only gets worse
          if (step > 0 && !segOk(F, Wx, Wz, te - hold - step, C.x, C.z, te - hold)) continue;
          if (hold > 0 && !segOk(F, C.x, C.z, te - hold, C.x, C.z, te)) continue;
          const tx = te + TR; let ok = true, sig = ''; const F2 = [];
          for (const h of H) { const f = hzF(h, T.x, T.z, tx); if (Math.abs(f) <= m) { ok = false; break; } F2.push(f > 0 ? 1 : -1); sig += f > 0 ? '+' : '-'; }
          if (!ok || seen[sig]) continue; seen[sig] = 1;
          let gain = 0; for (let i = 0; i < F.length; i++) gain += F[i] - F2[i];
          out.push({ g: gi, W: [Wx, Wz], te, tx, F: F2, pair: C.pair, gain });
        }
      }
      out.sort((a, b) => (b.gain - a.gain) || (a.te - b.te));
      return out;
    }
    function dfs(x, z, t, F, S, depth, path) {
      if (done(F)) return path;
      if (depth === 0 || --budget < 0) return null;
      for (const c of cands(x, z, t, F, S)) {
        const S2 = Object.assign({}, S); S2[c.pair] = c.te + SH; const T = GT[GT[c.g].twin];
        const r = dfs(T.x, T.z, c.tx, c.F, S2, depth - 1, path.concat([c])); if (r) return r;
        if (budget < 0) return null;
      }
      return null;
    }
    for (let D = 1; D <= (o.maxTrips || 3); D++) { const r = dfs(o.x, o.z, o.t, F0, o.shut || {}, D, []); if (r) return { n: D, trips: r }; if (budget < 0) break; }
    return null;
  }
  // Pick the variants of a mechanic that the player can survive from where they stand, preferring the intended number of trips.
  // Returns { i, haz, plan, n } or null. pref(i, plan) may rank the candidates (lower first).
  function pickVariant(list, o, want, rnd, pref) {
    const good = [];
    for (let i = 0; i < list.length; i++) { const r = solve(Object.assign({}, o, { haz: list[i] })); if (r && r.n > 0) good.push({ i, haz: list[i], plan: r, n: r.n }); }
    if (!good.length) return null;
    let pool = good.filter((g) => g.n === want); if (!pool.length) { const mn = Math.max(...good.map((g) => g.n)); pool = good.filter((g) => g.n === Math.min(mn, want + 1) || g.n === mn); }
    if (pref) { pool.sort((a, b) => pref(a) - pref(b)); const best = pref(pool[0]); pool = pool.filter((g) => pref(g) <= best + 1e-6); }
    return pool[Math.floor(rnd() * pool.length) % pool.length];
  }
  // </gates>

  // ---------------------------------------------------------------------------------------------------------------------
  // colour and shared GLSL. Palette hexes are sRGB; shaders work in linear light before ACES (OutputPass).
  const _c = new THREE.Color(), _v = new V3(), _w = new V3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m4 = new THREE.Matrix4(), _s = new V3(), _o = new THREE.Object3D(), _Y = new V3(0, 1, 0);
  const lin = (hex, k = 1) => { _c.setHex(hex); return `vec3(${(_c.r * k).toFixed(4)}, ${(_c.g * k).toFixed(4)}, ${(_c.b * k).toFixed(4)})`; };
  const LIB = `
uniform float uTime, uSplit, uDoors, uMosaic;
const vec3 TRAV = ${lin(0xe6dccb)}, BRASS = ${lin(0xb8893a)}, SHADE = ${lin(0x8d8ba0)}, BRONZE = ${lin(0x3a2c1e)}, MARBLE = ${lin(0xefe9df)};
const vec3 DAWNG = ${lin(0xffe2a8)}, DAWNR = ${lin(0xffb59a)}, NIGHT = ${lin(0x141a3c)}, STORM = ${lin(0x0c2a34)}, DOORL = ${lin(0xffc878)}, CRIM = ${lin(CRIMSON)};
float hh(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float hh3(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm3(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return s * 1.1428; }
float starF(vec3 d, float dens, float sc){ vec3 g = d * sc, c = floor(g), f = fract(g) - 0.5; float s = hh3(c);
  vec3 j = vec3(hh3(c + 1.7), hh3(c + 4.1), hh3(c + 8.3)) - 0.5; float b = (1.0 - smoothstep(0.0, 0.36, length(f - j * 0.45))); return step(1.0 - dens, s) * b * b * (0.6 + 2.4 * hh3(c + 2.0)); }
/// the five gate worlds. d is a direction in that world (y = its zenith). Deep saturated zeniths, lighter horizons, mid values.
// gold = sunrise over a cloud deck, cyan = open day sky with high cirrus, violet = stars and nebula, green = aurora over ice, rose = dusk with a low sun
// gSun: when set (non-zero), where the gold and rose suns hang, so a gate or a mosaic panel can put its low sun where it is seen
vec3 gSun = vec3(0.0);
vec3 sunDir(vec3 def, float el){ return dot(gSun, gSun) > 1e-4 ? normalize(gSun) : normalize(def); }
vec3 skyW(vec3 d, float wf){
  float h = d.y, hp = max(h, 0.0); int w = int(wf + 0.5); vec3 res = vec3(0.0);
  if (w == 0) { // sunrise: deep amber overhead grading to pale gold at the horizon, hotter toward a small low sun, a cloud deck with shaded undersides below
    vec3 sd = sunDir(vec3(0.62, 0.16, -0.78), 0.1); float s = max(dot(d, sd), 0.0);
    float side = dot(normalize(d.xz + vec2(1e-4, 0.0)), normalize(sd.xz + vec2(1e-4, 0.0))) * 0.5 + 0.5; side *= side;
    vec3 col = mix(vec3(0.92, 0.56, 0.24) * mix(0.55, 1.0, side), vec3(0.5, 0.17, 0.04) * mix(0.65, 1.0, side), smoothstep(0.0, 0.16, h));
    col = mix(col, vec3(0.14, 0.04, 0.012), smoothstep(0.14, 0.5, h));
    col += vec3(1.0, 0.55, 0.2) * (pow(s, 14.0) * 0.3 + pow(s, 120.0) * 0.45) + vec3(1.0, 0.86, 0.62) * smoothstep(0.9962, 0.9976, s) * 1.1;
    vec2 q = d.xz / (abs(h) + 0.07) * 0.6 + vec2(uTime * 0.008, uTime * 0.003);
    float c = fbm3(q), c2 = fbm3(q - sd.xz * 0.3); float lit = clamp((c - c2) * 5.0 + 0.3, 0.0, 1.0);
    vec3 deck = mix(vec3(0.1, 0.03, 0.03), vec3(0.95, 0.48, 0.13) * (0.5 + 0.7 * side), lit) * (0.55 + 0.55 * c);
    res = mix(col, deck, (1.0 - smoothstep(-0.06, 0.035, h)) * smoothstep(0.25, 0.5, c + 0.12));
    res = mix(res, deck * 0.75, (1.0 - smoothstep(-0.18, -0.03, h)));
  } else if (w == 1) {
    vec3 col = mix(vec3(0.42, 0.7, 0.82), vec3(0.05, 0.36, 0.62), smoothstep(0.0, 0.32, h));
    col = mix(col, vec3(0.0, 0.11, 0.33), smoothstep(0.3, 0.95, h));
    vec3 sd = normalize(vec3(-0.3, 0.7, 0.4)); float s = max(dot(d, sd), 0.0);
    col += vec3(0.9, 0.95, 1.0) * (pow(s, 40.0) * 0.3 + smoothstep(0.9975, 0.9985, s) * 1.6);
    vec2 q = d.xz / (hp + 0.12) * vec2(0.45, 2.8) + vec2(uTime * 0.01, 0.0);
    float ci = smoothstep(0.5, 0.85, fbm3(q)) * smoothstep(0.05, 0.4, h);
    col = mix(col, vec3(0.72, 0.84, 0.94), ci * 0.6);
    float cu = fbm3(d.xz / (hp + 0.05) * 1.2 + uTime * 0.004);
    col = mix(col, mix(vec3(0.33, 0.43, 0.58), vec3(0.82, 0.88, 0.94), smoothstep(0.55, 0.8, cu)), smoothstep(0.5, 0.65, cu) * (1.0 - smoothstep(0.02, 0.18, h)) * step(-0.02, h));
    res = mix(col, vec3(0.28, 0.48, 0.64), (1.0 - smoothstep(-0.1, 0.0, h)));
  } else if (w == 2) {
    vec3 col = mix(vec3(0.07, 0.03, 0.16), vec3(0.015, 0.005, 0.05), smoothstep(-0.2, 0.8, h));
    vec2 q = d.xz / (abs(h) + 0.6) * 1.2 + d.y * 0.7; float n = clamp(fbm3(q * 1.3 + vec2(uTime * 0.004, 0.0)), 0.0, 1.0), m2 = clamp(fbm3(q * 2.6 - 4.0), 0.0, 1.0);
    col += vec3(0.5, 0.12, 0.8) * n * n * n * 1.25 + vec3(0.1, 0.22, 0.85) * m2 * m2 * m2 * 1.0 + vec3(0.95, 0.3, 0.6) * (n * m2) * (n * m2) * 0.8;
    col += vec3(0.95, 0.88, 1.0) * starF(d, 0.04, 110.0) * 1.2;
    res = col;
  } else if (w == 3) {
    vec3 col = mix(vec3(0.03, 0.14, 0.12), vec3(0.005, 0.05, 0.05), smoothstep(0.0, 0.8, h));
    vec2 ring = normalize(d.xz + vec2(1e-4, 0.0)); float band = fbm3(ring * 1.6 + vec2(uTime * 0.03, h * 1.5));
    float fold = vn(ring * 7.0 + band * 2.5 + vec2(uTime * 0.05, 0.0)) * 0.65 + vn(ring * 19.0 + band * 4.0 - vec2(0.0, uTime * 0.07)) * 0.35;
    float curt = smoothstep(0.02, 0.2, h) * exp(-abs(h - 0.4 - band * 0.35) * 2.6) * (0.2 + 0.8 * smoothstep(0.3, 0.75, fold)) * (0.75 + 0.25 * vn(vec2(h * 9.0, uTime * 0.2) + ring * 3.0));
    col += vec3(0.15, 0.85, 0.42) * curt * 1.1 + vec3(0.45, 0.2, 0.8) * curt * smoothstep(0.4, 0.8, h) * 0.6;
    float ice = (1.0 - smoothstep(-0.08, 0.03, h)); float n = vn(d.xz / (abs(h) + 0.05) * 2.4);
    col = mix(col, mix(vec3(0.12, 0.25, 0.32), vec3(0.4, 0.6, 0.7), n), ice);
    res = col + starF(d, 0.015, 120.0) * 0.7;
  } else {
    vec3 col = mix(vec3(1.0, 0.48, 0.32), vec3(0.78, 0.2, 0.34), smoothstep(0.0, 0.22, h));
    col = mix(col, vec3(0.3, 0.05, 0.16), smoothstep(0.2, 0.9, h));
    vec3 sd = sunDir(vec3(-0.45, 0.04, -0.89), 0.05); float s = max(dot(d, sd), 0.0);
    col += vec3(1.0, 0.5, 0.35) * (pow(s, 8.0) * 0.42 + pow(s, 60.0) * 0.55) + vec3(1.4, 0.95, 0.75) * smoothstep(0.9965, 0.998, s) * 1.5;
    vec2 q = d.xz / (hp + 0.15) * vec2(0.35, 2.4) + vec2(uTime * 0.006, 0.0); float n = fbm3(q), n2 = fbm3(q + sd.xz * 0.2);
    float cov = smoothstep(0.48, 0.72, n) * smoothstep(-0.02, 0.06, h) * (1.0 - smoothstep(0.35, 0.6, h));
    col = mix(col, mix(vec3(0.22, 0.07, 0.16), vec3(1.0, 0.45, 0.4), clamp((n - n2) * 5.0 + 0.4, 0.0, 1.0)), cov * 0.85);
    res = mix(col, vec3(0.35, 0.12, 0.2), (1.0 - smoothstep(-0.12, 0.0, h)));
  }
  return res;
}
// a cloud deck seen through a portal, k = 0 near, 1 mid, 2 far: premultiplied colour and coverage, in the world's own style
vec4 cloudL(vec2 q, float wf, float k){
  int w = int(wf + 0.5);
  if (w == 1 && k > 1.5) q *= vec2(0.3, 2.6); else if (w == 0) q *= vec2(0.6, 2.3); else if (w == 3) q *= vec2(0.25, 2.2); else if (w == 4) q *= vec2(0.45, 1.9);
  float n = fbm3(q), n2 = fbm3(q + vec2(0.23, 0.15)); float lit = clamp((n - n2) * 6.0 + 0.5, 0.0, 1.0);
  vec3 lo, hi; float a;
  if (w == 0) { lo = vec3(0.13, 0.04, 0.025); hi = vec3(1.0, 0.68, 0.32); a = smoothstep(0.58, 0.82, n) * (k > 1.5 ? 0.25 : k > 0.5 ? 0.7 : 0.55); lit = clamp((n - n2) * 6.0 + 0.3, 0.0, 1.0); }
  else if (w == 1) { lo = vec3(0.3, 0.42, 0.6); hi = vec3(0.8, 0.88, 0.95); a = smoothstep(0.55, 0.78, n) * (k > 1.5 ? 0.55 : 0.9); }
  else if (w == 2) { lo = vec3(0.08, 0.015, 0.18); hi = mix(vec3(0.45, 0.12, 0.55), vec3(0.14, 0.24, 0.7), k * 0.4); a = smoothstep(0.52, 0.95, n) * 0.42; }
  else if (w == 3) { lo = vec3(0.02, 0.22, 0.14); hi = mix(vec3(0.2, 0.95, 0.5), vec3(0.5, 0.3, 0.95), k * 0.3); a = smoothstep(0.55, 0.85, n) * 0.55; }
  else { lo = vec3(0.24, 0.06, 0.16); hi = vec3(1.0, 0.48, 0.42); a = smoothstep(0.5, 0.75, n) * 0.85; }
  return vec4(mix(lo, hi, lit) * a, a);
}
// looking down a gate: a sky bowl (zenith straight down, horizon toward the far lip) under three cloud decks at depths, so they slide against the rim and each other
vec3 bowlDir(vec3 P, vec3 V){ vec3 o = P - vec3(0.0, 0.9, 0.0); float b = dot(o, V), c = dot(o, o) - 9.0; float t = -b + sqrt(max(b * b - c, 0.0));
  vec3 n = (o + V * t) / 3.0; return normalize(vec3(n.x, -n.y * 1.15 - 0.12, n.z) + vec3(0.0, 1e-4, 0.0)); }
vec3 gateSky(vec3 P, vec3 V, float wf){ // P: point on the gate's floor relative to its centre; V: view ray, V.y < 0
  vec3 s = bowlDir(P, V); vec2 vd = normalize(V.xz + vec2(1e-4, 0.0));
  if (wf < 0.5 || wf > 3.5) { float hs = bowlDir(vec3(vd.x * 1.6, 0.0, vd.y * 1.6), V).y - 0.03; s = normalize(vec3(s.x, (s.y - hs) * 1.9, s.z) + vec3(0.0, 1e-4, 0.0)); } // gold and rose: the horizon hangs just inside the far rim from any view, the low sun over it, the sky deepening toward the near rim
  vec3 sm = bowlDir(vec3(vd.x * 0.95, 0.0, vd.y * 0.95), V); gSun = normalize(vec3(vd.x, wf < 0.5 || wf > 3.5 ? (sm.y - bowlDir(vec3(vd.x * 1.6, 0.0, vd.y * 1.6), V).y + 0.03) * 1.9 : sm.y, vd.y)); // the sun just inside the far rim, clear of the shaft's shade
  vec3 col = skyW(s, wf); gSun = vec3(0.0);
  float vy = max(-V.y, 0.14);
  for (int k = 2; k >= 0; k--) { float fk = float(k), D = 1.0 + fk * 2.4 + fk * fk * 1.8;
    vec2 hp = P.xz + V.xz * (D / vy); vec2 q = hp * (0.62 - fk * 0.17) + vec2(uTime * (0.06 - fk * 0.015), uTime * 0.025) + fk * 7.3;
    vec4 L = cloudL(q, wf, fk); L.rgb = mix(L.rgb, col * L.a, fk * 0.22); L *= exp(-D / vy * 0.025) * (0.55 + 0.45 * smoothstep(-0.1, 0.35, s.y));
    col = col * (1.0 - L.a) + L.rgb; }
  return col;
}
// the hall's own sky: P1 dawn and night split by a luminous seam, P2 storm full of lit doors, P3 a mosaic of the five worlds
vec3 dawnNight(vec3 d){
  float h = d.y, hp = max(h, 0.0);
  vec3 dawn = mix(DAWNG * 1.05, DAWNR * 0.85, smoothstep(0.02, 0.45, hp)); dawn = mix(dawn, vec3(0.3, 0.24, 0.42), smoothstep(0.45, 1.0, hp) * 0.6);
  vec3 sd = normalize(vec3(0.92, 0.1, -0.38)); float s = max(dot(d, sd), 0.0);
  dawn += vec3(1.0, 0.72, 0.45) * (smoothstep(0.9992, 0.9996, s) * 2.5 + pow(s, 60.0) * 0.7 + pow(s, 6.0) * 0.22);
  float cl = fbm3(d.xz / (hp + 0.18) * vec2(0.8, 2.4) + vec2(uTime * 0.006, 0.0));
  dawn = mix(dawn, mix(vec3(1.0, 0.5, 0.45), vec3(1.0, 0.8, 0.62), cl), smoothstep(0.55, 0.8, cl) * smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.35, 0.7, h)) * 0.7);
  vec3 night = mix(NIGHT * 1.7, NIGHT * 0.5, smoothstep(0.0, 0.8, hp));
  float nb = fbm3(d.xz / (hp + 0.6) * 1.7 + 11.0); night += vec3(0.2, 0.1, 0.4) * nb * nb * nb * 0.9;
  night += vec3(0.85, 0.88, 1.0) * starF(d, 0.03, 150.0) * smoothstep(-0.02, 0.15, h);
  float k = smoothstep(-0.07, 0.07, d.x);
  vec3 col = mix(night, dawn, k);
  float xs = d.x + (vn(vec2(h * 5.0, uTime * 0.08)) - 0.5) * 0.05; // the seam: a soft ribbon of cream and gold, wavering
  col += vec3(1.0, 0.8, 0.5) * (exp(-abs(xs) * 60.0) * 0.32 + exp(-abs(xs) * 14.0) * 0.12) * smoothstep(-0.05, 0.3, h);
  return mix(col, mix(vec3(0.16, 0.14, 0.24), vec3(0.85, 0.62, 0.48), k), (1.0 - smoothstep(-0.14, 0.02, h)));
}
vec3 doorsSky(vec3 d){
  float h = d.y, hp = max(h, 0.0), az = atan(d.x, d.z + 1e-6);
  vec3 col = mix(STORM * 5.5, STORM * 1.2, smoothstep(0.0, 0.75, hp));
  // three decks of storm cloud stacked up from the horizon: dark teal masses, their upper edges lit, lightning flickering inside
  float ac = floor(az * 1.6 + 8.0), fl = step(0.965, hh(vec2(ac, floor(uTime * 5.0)))) * hh(vec2(ac, floor(uTime * 13.0)));
  for (int k = 0; k < 4; k++) { float fk = float(k), e0 = -0.02 + fk * 0.055;
    vec2 q = vec2(az * (3.0 + fk * 1.3) + uTime * (0.01 + fk * 0.005) + fk * 3.1, (h - e0) * (10.0 - fk * 1.8)); float m = fbm3(q), m2 = fbm3(q + vec2(0.0, -0.12));
    float env = exp(-abs(h - e0 - 0.03) * (12.0 - fk * 2.4)), mass = smoothstep(0.46, 0.6, m + env * 0.4 - 0.22) * (0.95 - fk * 0.1);
    float lit = clamp((m2 - m) * 7.0 + 0.2, 0.0, 1.0);
    vec3 cc = mix(STORM * (0.9 + fk * 0.6), vec3(0.42, 0.66, 0.66) * (1.0 - fk * 0.1), lit) + vec3(0.35, 0.55, 0.6) * fl * smoothstep(0.5, 0.8, m) * 0.6;
    col = mix(col, cc, mass); }
  float sc = fbm3(d.xz / (hp + 0.25) * 1.1 + vec2(uTime * 0.02, uTime * 0.008));
  col = mix(col, STORM * 0.4, smoothstep(0.45, 0.75, sc) * 0.65 * smoothstep(0.45, 0.7, hp));
  // the lit doors drifting in it: a dark frame, a warm leaf of light (brighter at the sill), a soft glow, edges anti-aliased
  float az1 = az / 6.2832 + 0.5, el = asin(clamp(h, -1.0, 1.0)) / 1.5708;
  vec2 g = vec2(az1 * 54.0, el * 16.0); float ci = floor(g.x); g.y += fract(uTime * (0.004 + 0.006 * hh(vec2(ci, 3.0)))) * 16.0;
  vec2 gw = min(fwidth(g), vec2(0.2)) + 1e-3;
  vec2 c = floor(g), f = fract(g); float e = hh(vec2(mod(c.x, 54.0), mod(c.y, 16.0)));
  float fade = smoothstep(0.2, 0.32, el) * (1.0 - smoothstep(0.7, 0.92, el));
  if (e < 0.42 && fade > 0.0) {
    vec2 sz = vec2(0.26 + 0.16 * hh(c + 1.0), 0.55 + 0.2 * hh(c + 2.0)), o = (f - 0.5) / sz, aw = gw / sz;
    float op = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.3 + e) + e * 40.0));
    float frame = (1.0 - smoothstep(0.5 - aw.x, 0.5 + aw.x, abs(o.x))) * (1.0 - smoothstep(0.5 - aw.y, 0.5 + aw.y, abs(o.y)));
    float lit2 = (1.0 - smoothstep(0.36 * op - aw.x, 0.36 * op + aw.x, abs(o.x + 0.36 * (1.0 - op)))) * (1.0 - smoothstep(0.42 - aw.y, 0.42 + aw.y, abs(o.y)));
    col = mix(col, vec3(0.03, 0.025, 0.02), frame * 0.85 * fade);
    col += DOORL * (lit2 * (0.75 + 0.6 * e) * (0.8 + 0.5 * clamp(0.5 - o.y, 0.0, 1.0)) + exp(-length(o * vec2(1.0, 0.6)) * 2.6) * 0.3) * fade;
  }
  return mix(col, STORM * 1.3, (1.0 - smoothstep(-0.15, 0.02, h)));
}
float sdArch(vec2 o, float aw, float y0, float y1){ float d = max(abs(o.x) - aw, y0 - o.y); if (o.y > y1) d = length(vec2(o.x, (o.y - y1) * 1.6)) - aw; return d; }
// P3: the dome is a leaded window of the five worlds, arched panels in brass came. Muted (about half a gate's brightness, desaturated) so it never competes with the beacons.
// soft > 0: a blurred version for the mirror floor (one colour per panel, wide soft leading, no fine detail to alias)
// which world a panel shows: a fixed pattern (neighbours always differ, each world about a fifth of any stretch of dome), stepping on per panel at its own time
float panelW(vec2 c){ float cx = mod(c.x, 22.0), cid = hh(vec2(cx, c.y) + 0.5); return mod(cx * 2.0 + c.y * 3.0 + floor(uTime * 0.06 + cid * 7.0), 5.0); }
// a panel is a window into its world: horizon low in the pane, each panel looking a different way, the gold and rose suns hung where the pane shows them
vec3 panelSky(vec2 o, float w, float cid){
  float yaw = cid * 6.2832, cy = cos(yaw), sy = sin(yaw);
  vec3 dl = normalize(vec3(o.x * 0.55, mix(-0.16, 0.75, o.y), 1.0)), d = vec3(dl.x * cy + dl.z * sy, dl.y, -dl.x * sy + dl.z * cy);
  float so = (hh(vec2(cid, 3.7)) - 0.5) * 0.6; gSun = vec3(sin(yaw + so), 0.08 + 0.1 * hh(vec2(cid, 5.1)), cos(yaw + so));
  vec3 col = skyW(d, w); gSun = vec3(0.0);
  return col;
}
vec3 mosaicSky(vec3 d, vec3 under, float soft){
  float h = d.y, az = atan(d.x, d.z + 1e-6) / 6.2832 + 0.5, el = asin(clamp(h, -1.0, 1.0)) / 1.5708;
  float up = step(0.0, el); vec2 g = vec2(az * 22.0, sqrt(abs(el) + 0.0005) * 5.2 * (up * 2.0 - 1.0)), c = floor(g), f = fract(g);
  vec2 o = vec2((f.x - 0.5) * 2.0, up > 0.5 ? f.y : 1.0 - f.y);
  vec2 fo = fwidth(o); float px = max(0.5 * (min(fo.x, 0.2) + min(fo.y, 0.2)), 1e-5); // o units per pixel (the atan seam is clamped)
  float sd = max(sdArch(o, 1.0, 0.0, 0.62), o.y - 1.0), spx = -sd / px; // pixels inside the pane's edge
  if (hh(vec2(mod(c.x, 22.0), c.y) + 9.5) > uMosaic) return under;
  float cid = hh(vec2(mod(c.x, 22.0), c.y) + 0.5), k = fract(uTime * 0.06 + cid * 7.0), wid = panelW(c);
  float inC = smoothstep(1.0, 2.2, spx); // thin brass leading, the same width on screen everywhere
  vec3 col = inC > 0.0 ? panelSky(o, wid, cid) : vec3(0.0);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(lum), col, 0.85) * (up > 0.5 ? 0.5 : 0.34);
  col *= 0.8 + 0.2 * smoothstep(0.0, 14.0, spx); // a faint shade inside the came
  vec3 lat = BRASS * (0.3 + 0.25 * (1.0 - smoothstep(0.0, 1.6, abs(spx - 0.6))));
  col = mix(lat, col, inC);
  col += vec3(1.0, 0.86, 0.62) * (1.0 - smoothstep(0.0, 0.07, k)) * exp(-max(spx, 0.0) * 0.15) * 0.4;
  return col;
}
// the mosaic as the mirror sees it: no leading, each panel one average colour, blended smoothly into its neighbours (a rough reflection)
vec3 worldAvg(float w){ return w < 0.5 ? vec3(0.6, 0.3, 0.1) : w < 1.5 ? vec3(0.14, 0.38, 0.6) : w < 2.5 ? vec3(0.2, 0.08, 0.36) : w < 3.5 ? vec3(0.04, 0.24, 0.16) : vec3(0.56, 0.18, 0.26); }
vec3 mosaicSoft(vec3 d, vec3 under){
  float h = d.y, az = atan(d.x, d.z + 1e-6) / 6.2832 + 0.5, el = asin(clamp(h, -1.0, 1.0)) / 1.5708, up = step(0.0, el);
  vec2 g = vec2(az * 22.0, sqrt(abs(el) + 0.0005) * 5.2 * (up * 2.0 - 1.0)) - 0.5, c = floor(g), f = smoothstep(0.0, 1.0, fract(g));
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 4; j++) { vec2 dc = vec2(mod(float(j), 2.0), floor(float(j) / 2.0)), cc = c + dc; float cx = mod(cc.x, 22.0);
    float wid = panelW(cc), rv = step(hh(vec2(cx, cc.y) + 9.5), uMosaic);
    vec3 pc = worldAvg(wid); float lum = dot(pc, vec3(0.2126, 0.7152, 0.0722)); pc = mix(vec3(lum), pc, 0.85) * (cc.y >= 0.0 ? 0.5 : 0.34);
    vec2 wt = mix(1.0 - f, f, dc); acc += mix(under, pc, rv) * wt.x * wt.y; }
  return acc;
}
vec3 domeColS(vec3 d, float soft){
  vec3 col = vec3(0.0);
  if (uMosaic < 0.999) { if (uSplit > 0.001) col = dawnNight(d); if (uDoors > 0.001) col = mix(col, doorsSky(d), uDoors); }
  if (uMosaic > 0.001) { vec3 un = col * (1.0 - uMosaic) + STORM * uMosaic * (d.y < 0.0 ? 1.3 : 0.6); col = soft > 0.5 ? mosaicSoft(d, un) : mosaicSky(d, un, 0.0); }
  return col;
}
vec3 domeCol(vec3 d){ return domeColS(d, 0.0); }
`;
  // GLSL ES 3 needs fwidth: three.js ShaderMaterial on WebGL2 has derivatives available.
  const VW = 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
  const VWI = 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
  function smat(U, vs, fs, o = {}) { return new THREE.ShaderMaterial(Object.assign({ uniforms: U, vertexShader: vs, fragmentShader: LIB + fs, fog: false }, o)); }
  // geometry helpers
  function T(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { geo.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); return geo; }
  function merge(list) { // concatenate non-indexed position/normal/uv
    const gs = list.map((g) => g.index ? g.toNonIndexed() : g); let n = 0; for (const g of gs) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
    for (const g of gs) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); if (g.attributes.normal) N.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2); o += c; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); out.computeBoundingSphere(); return out;
  }
  const iattr = (n, k) => new THREE.InstancedBufferAttribute(new Float32Array(n * k), k);
  const lane = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);

  // ---------------------------------------------------------------------------------------------------------------------
  // the hall
  function buildDome(S, g) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 32), smat(S.U, 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }', `
      varying vec3 vD; void main(){ vec3 d = normalize(vD); gl_FragColor = vec4(max(domeCol(d), 0.0), 1.0); }`, { side: THREE.BackSide, depthWrite: false }));
    m.renderOrder = -100; m.frustumCulled = false; m.onBeforeRender = () => m.position.copy(camera.position); g.add(m); S.dome = m;
  }
  // far below the floor: a sea of cloud the hall floats over, two drifting layers with lit tops and shadowed hollows
  function buildSea(S, g) {
    S.seaU = { uSeaA: { value: new THREE.Color(0x3a2a40) }, uSeaB: { value: new THREE.Color(0xf0b890) }, uSeaH: { value: new THREE.Color(0x8a6a70) } };
    const geo = new THREE.PlaneGeometry(4200, 4200, 1, 1); geo.rotateX(-PI / 2);
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(geo, smat(Object.assign({ uL: { value: i } }, S.U, S.seaU), VW, `
        uniform float uL; uniform vec3 uSeaA, uSeaB, uSeaH; varying vec3 vW;
        void main(){ vec2 q = vW.xz * (0.0075 + uL * 0.006) + vec2(uTime * (0.004 + uL * 0.003), uTime * 0.002);
          float d = length(vW.xz - cameraPosition.xz), far = smoothstep(650.0, 2100.0, d), fw = clamp(length(fwidth(q)) * 1.6, 0.0, 1.0);
          vec2 wq = q + fbm3(q * 0.45 + 3.0) * 0.9; float n = fbm3(wq), n2 = fbm3(wq + vec2(0.07, -0.05));
          float lit = mix(clamp((n - n2) * 7.0 + 0.5, 0.0, 1.0), 0.5, fw), cov = smoothstep(0.3, 0.78, mix(n, 0.55, fw * 0.7));
          vec3 col = mix(uSeaA, uSeaB, cov * (0.3 + 0.7 * lit)) * (0.8 + 0.35 * lit * cov);
          col *= 1.0 + uSplit * (smoothstep(-500.0, 500.0, vW.x) - 0.45) * 0.45; // dawn lights one side of the sea
          col = mix(col, uSeaH * mix(vec3(1.0), mix(vec3(0.4, 0.48, 0.95), vec3(1.2, 1.02, 0.84), smoothstep(-350.0, 350.0, vW.x)), uSplit), far); // the haze splits too: night blue under the stars, gold under the dawn
          float a = (uL < 0.5 ? 1.0 : smoothstep(0.5, 0.75, n) * 0.8 * (1.0 - far)) * (1.0 - uMosaic);
          gl_FragColor = vec4(max(col, 0.0) * (uL < 0.5 ? 1.0 : 1.06), a); }`, { transparent: true, depthWrite: false }));
      m.position.y = i ? -26 : -44; m.renderOrder = i ? -50 : -60; m.frustumCulled = false; g.add(m);
    }
  }
  // P2 and P3: dozens of small lit doors drifting round the hall at several depths (all motion in the vertex shader)
  function buildDrift(S, g) {
    const N = 320, geo = new THREE.PlaneGeometry(1.6, 2.4); const aP = iattr(N, 4); geo.setAttribute('aP', aP);
    for (let i = 0; i < N; i++) { const k = i / N, r = 56 + 250 * Math.pow(vrand(), 1.5); aP.setXYZW(i, k * TAU + vrand() * 0.4, r, r * (-0.12 + 0.27 * Math.pow(vrand(), 1.3)), vrand()); }
    const m = new THREE.InstancedMesh(geo, smat(S.U, `uniform float uTime; attribute vec4 aP; varying vec2 vUv; varying float vS; varying float vFar;
      void main(){ vUv = uv; vS = aP.w; float sg = fract(aP.w * 3.1) > 0.5 ? 1.0 : -1.0;
        float ang = aP.x + uTime * (0.004 + 0.008 * fract(aP.w * 7.3)) * sg, r = aP.y, y = aP.z + sin(uTime * 0.12 + aP.w * 20.0) * r * 0.012;
        float tw = fract(aP.w * 5.0), sc = r * 0.05 * (0.5 + 1.0 * fract(aP.w * 11.0)), fa = ang + 3.1416 + (tw < 0.3 ? (tw / 0.3 - 0.5) * 2.7 : (tw - 0.65) * 0.9); // some turned nearly edge-on
        vec3 c = vec3(sin(ang) * r, y, cos(ang) * r), right = vec3(cos(fa), 0.0, -sin(fa));
        vec3 wp = c + right * position.x * sc + vec3(0.0, position.y * sc, 0.0); vFar = smoothstep(90.0, 330.0, r);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`, `
      varying vec2 vUv; varying float vS; varying float vFar;
      float boxA(vec2 o, vec2 h, vec2 aw){ return (1.0 - smoothstep(h.x - aw.x, h.x + aw.x, abs(o.x))) * (1.0 - smoothstep(h.y - aw.y, h.y + aw.y, abs(o.y))); }
      void main(){ vec2 o = (vUv - 0.5) * vec2(1.6, 2.4), aw = fwidth(o) * 0.8 + 1e-4;
        // a tiny door: a dark stone frame with a lintel, an opening full of warm light (brightest at the sill), a dark leaf swung part way, a soft glow round it
        float fr = max(boxA(o, vec2(0.5, 0.86), aw), boxA(o - vec2(0.0, 0.9), vec2(0.6, 0.07), aw));
        float hole = boxA(o + vec2(0.0, 0.05), vec2(0.34, 0.8), aw);
        float op = 0.25 + 0.6 * (0.5 + 0.5 * sin(uTime * (0.2 + vS * 0.3) + vS * 40.0)), leaf = boxA(o + vec2(0.34 * op, 0.05), vec2(0.34 * (1.0 - op), 0.8), aw) * hole;
        float glow = max(exp(-length(o * vec2(1.3, 0.8)) * 2.4) - 0.04, 0.0);
        vec3 lit = DOORL * (1.2 + 0.9 * clamp(0.6 - o.y * 0.6, 0.0, 1.0));
        vec3 col = mix(vec3(0.05, 0.04, 0.034) * (1.0 + 0.6 * smoothstep(0.3, 0.5, abs(o.x))), lit, hole);
        col = mix(col, vec3(0.09, 0.06, 0.035) + DOORL * 0.25 * boxA(o + vec2(0.34 * op * 2.0 - 0.34, 0.05), vec2(0.03, 0.8), aw), leaf);
        col = mix(col, STORM * 2.2, vFar * 0.55);
        float a = max(fr, glow * 0.55) * uDoors * (1.0 - uMosaic) * (1.0 - vFar * 0.35);
        col = mix(DOORL * 1.1, col, fr); // outside the frame only the glow shows
        gl_FragColor = vec4(max(col, 0.0) * (1.0 - vFar * 0.3), a); }`, { transparent: true, depthWrite: false }), N);
    m.frustumCulled = false; m.renderOrder = -40; m.visible = false; g.add(m); S.drift = m;
  }
  // P2: warm shafts of light falling through the twelve open doors onto the floor, camera-facing ribbons with drifting dust
  function buildShafts(S, g) {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 16); const aI = iattr(NDOOR, 1); for (let i = 0; i < NDOOR; i++) aI.setX(i, i); geo.setAttribute('aI', aI);
    S.shU = { uSh: { value: 0 }, uShA: { value: 0 } };
    const m = new THREE.InstancedMesh(geo, smat(Object.assign({}, S.U, S.shU), `attribute float aI; uniform float uShA; varying vec2 vS; varying float vI; varying float vNear;
      void main(){ float u = 1.0 - uv.y, v = uv.x * 2.0 - 1.0; vS = vec2(u, v); vI = aI;
        if (mod(aI, 2.0) > 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; } // six beams, one through every other door, with clear gaps
        float ang = (aI + 0.5 + uShA) / 12.0 * 6.2832; vec3 dO = vec3(sin(ang), 0.0, cos(ang));
        vec3 A = dO * 44.0 + vec3(0.0, 13.0, 0.0), B = dO * 5.0 + vec3(0.0, -0.3, 0.0), P = mix(A, B, u), ax = normalize(B - A);
        vec3 side = normalize(cross(ax, normalize(cameraPosition - P)) + vec3(1e-4, 0.0, 0.0));
        vec3 wp = P + side * v * mix(1.5, 2.6, u); vNear = smoothstep(4.0, 16.0, length(cameraPosition - wp));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`, `
      uniform float uSh; varying vec2 vS; varying float vI; varying float vNear;
      void main(){ float x2 = vS.y * vS.y, a = (exp(-x2 * 9.0) * 0.8 + exp(-x2 * 3.0) * 0.2) * (1.0 - smoothstep(0.85, 1.0, abs(vS.y))) * smoothstep(0.0, 0.12, vS.x) * (1.0 - smoothstep(0.8, 1.0, vS.x)) * uSh * vNear;
        a *= 0.65 + 0.35 * vn(vec2(vS.y * 2.5 + vI * 7.0, vS.x * 6.0 - uTime * 0.25)) + 0.25 * smoothstep(0.8, 1.0, vn(vec2(vS.y * 14.0 + vI, vS.x * 30.0 - uTime * 0.6)));
        a *= 0.26; gl_FragColor = vec4(DOORL * 0.9, a); }`, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), NDOOR);
    m.frustumCulled = false; m.renderOrder = 15; m.visible = false; g.add(m); S.shafts = m;
  }
  function buildFloor(S, g) {
    S.fU = {
      uWall: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, uRing: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uGate: { value: Array.from({ length: NSLOT }, () => new THREE.Vector4()) }, uGCol: { value: Array.from({ length: NSLOT }, () => new THREE.Vector4()) },
      uBlob: { value: [new THREE.Vector4(), new THREE.Vector4()] }, uGloss: { value: 0 }, uShaft: { value: 0 }, uShaftA: { value: 0 }, uDeton: { value: 0 }, uLock: { value: 0 }, uSunD: { value: new V3(0.5, 0.8, 0.3).normalize() },
    };
    const geo = new THREE.CircleGeometry(21, 160); geo.rotateX(-PI / 2);
    const m = new THREE.Mesh(geo, smat(Object.assign({}, S.U, S.fU), VW, `
      uniform vec4 uWall[3], uRing[2], uGate[${NSLOT}], uGCol[${NSLOT}], uBlob[2]; uniform float uGloss, uShaft, uShaftA, uDeton, uLock; uniform vec3 uSunD; varying vec3 vW;
      float lineAA(float d, float w){ float fw = max(fwidth(d), 1e-4); return 1.0 - smoothstep(w - fw, w + fw, abs(d)); }
      const vec3 CHEV = ${lin(0xc8102e)};
      vec2 chevF(float al, float lx, float cw){ // al: along the sweep's motion; lx: lateral offset in a cell cw wide. x = chevron, y = chevron plus a thin (1-2 px) dark edge
        float sc = mix(0.3, 0.24, uGloss), arm = mix(0.08, 0.06, uGloss); // sparser and thinner on the dark mirror, where they would otherwise swamp it
        float u = (al + abs(lx) * 0.9) * sc - uTime * 1.1 * sc / 0.36, fw = max(fwidth(u), 1e-3);
        float c = abs(fract(u + 0.5) - 0.5), e = abs(lx) / cw, fe = max(fwidth(e), 1e-3);
        return vec2((1.0 - smoothstep(arm - fw, arm + fw, c)) * (1.0 - smoothstep(0.35 - fe, 0.35 + fe, e)), (1.0 - smoothstep(arm + fw, arm + fw * 3.0, c)) * (1.0 - smoothstep(0.35 + fe, 0.35 + fe * 3.0, e))); }
      void main(){
        vec2 p = vW.xz; float r = length(p), a = atan(p.x, p.y + 1e-6);
        for (int i = 0; i < ${NSLOT}; i++) { vec4 q = uGate[i]; if (q.z > 0.0 && length(p - q.xy) < q.z) discard; }
        // travertine slabs on a polar grid; each slab has its own vein direction and tone
        float ring = floor(r / 3.6), nseg = max(6.0, floor(6.2832 * (ring + 0.5) * 3.6 / 3.4)), seg = floor((a / 6.2832 + 0.5) * nseg);
        vec2 sid = vec2(ring, seg); float th = hh(sid) * 3.1416, tone = hh(sid + 7.0);
        vec2 rq = vec2(cos(th) * p.x - sin(th) * p.y, sin(th) * p.x + cos(th) * p.y);
        float band = vn(vec2(rq.x * 0.7 + vn(rq * 0.3) * 1.5, rq.y * 2.2)), pores = smoothstep(0.74, 0.86, vn(vec2(rq.x * 5.0, rq.y * 11.0)));
        vec3 col = TRAV * (0.86 + 0.04 * band + 0.08 * tone) * (1.0 - pores * 0.08);
        col = mix(col, col * vec3(1.02, 0.97, 0.9), smoothstep(0.55, 0.9, vn(rq * 0.6 + 9.0)) * 0.6);
        float sr = (fract(r / 3.6) - 0.5) * 3.6, sa = (fract((a / 6.2832 + 0.5) * nseg) - 0.5) * 6.2832 * r / nseg;
        float seam = max(lineAA(abs(sr) - 1.8, 0.025), lineAA(abs(sa) - 3.14159 * r / nseg, 0.025) * step(2.0, r));
        col *= 1.0 - seam * 0.45;
        // brass inlay: rings, meridians, an eight-point star at the centre, a rim band
        float br = 0.0;
        br = max(br, lineAA(r - 2.2, 0.06)); br = max(br, lineAA(r - 7.5, 0.05)); br = max(br, lineAA(r - 11.6, 0.045)); br = max(br, lineAA(r - 15.5, 0.05)); br = max(br, lineAA(r - 19.1, 0.07));
        float am = (fract(a / 6.2832 * 16.0 + 0.5) - 0.5) * 6.2832 / 16.0 * r; br = max(br, lineAA(am, 0.035) * step(2.2, r) * step(r, 19.1));
        float sa8 = abs(fract(a / 6.2832 * 8.0 + 0.5) - 0.5) * 2.0; float star = step(r, 2.2) * step(r, mix(2.1, 0.55, sa8));
        float starL = lineAA(r - mix(2.1, 0.55, sa8), 0.03) * step(r, 2.2);
        br = max(br, max(star * 0.55, starL));
        float rim = smoothstep(19.85, 19.9, r) * (1.0 - smoothstep(20.8, 20.85, r)); br = max(br, rim * 0.9);
        vec3 V = normalize(vW - cameraPosition), Hn = normalize(uSunD - V);
        float spec = pow(clamp(Hn.y, 0.0, 1.0), 60.0), glint = pow(clamp(-V.y, 0.0, 1.0), 2.0);
        vec3 brass = BRASS * (0.55 + 0.45 * vn(p * 4.0)) + vec3(1.0, 0.82, 0.5) * spec * 1.4 + BRASS * glint * 0.2;
        col = mix(col, brass, br);
        // light: sun plus a cool sky fill, blob shadows under the hero and Janus
        col *= 0.78 + 0.3 * uSunD.y;
        for (int i = 0; i < 2; i++) { vec4 b = uBlob[i]; if (b.w > 0.0) { float dd = length(p - b.xy); col = mix(col, col * SHADE * 0.8, b.w * (1.0 - smoothstep(b.z * 0.25, b.z, dd))); } }
        // pools of gate light around every open gate
        for (int i = 0; i < ${NSLOT}; i++) { vec4 q = uGate[i], c = uGCol[i]; if (q.z > 0.0 && c.w > 0.0) { float dd = length(p - q.xy) - q.z; col += c.rgb * c.w * (exp(-max(dd, 0.0) * 1.3) * 0.28 + exp(-max(dd, 0.0) * 6.0) * 0.22); } }
        // P2: warm light thrown in through the twelve open doors (the pools where the shafts in the air land)
        if (uShaft > 0.001) { float k = a / 6.2832 * 6.0 - uShaftA * 0.5 + 0.25; float sx = (fract(k) - 0.5) * 18.0, sh = exp(-sx * sx); col += DOORL * sh * uShaft * smoothstep(4.0, 18.0, r) * (1.0 - smoothstep(19.0, 20.5, r)) * (0.75 + 0.25 * vn(p * 0.7)) * 0.15; }
        // P3: the floor turns to dark glass reflecting a blurred mosaic
        if (uGloss > 0.001) {
          vec3 dk = mix(vec3(0.022, 0.02, 0.028) * (0.85 + 0.3 * band), brass * 0.9, br);
          vec3 Rf = vec3(V.x, -V.y, V.z); float fr = 0.55 + 0.45 * pow(1.0 - clamp(-V.y, 0.0, 1.0), 4.0);
          vec3 refl = domeColS(normalize(Rf + vec3(vn(p * 0.6) - 0.5, 0.0, vn(p * 0.6 + 5.0) - 0.5) * 0.03), 1.0);
          // what stands on the glass, softened: the reflected ray's closest pass to each upright (Janus, the beacons), fading with height and distance
          vec2 rh = Rf.xz; float rl = max(dot(rh, rh), 1e-4); vec3 ob = vec3(0.0);
          { vec4 jb = uBlob[1]; vec2 dq = jb.xy - p; float t = max(dot(dq, rh) / rl, 0.0), dd = length(p + rh * t - jb.xy);
            float hY = Rf.y * t; ob += vec3(0.42, 0.36, 0.3) * step(0.001, jb.w) * step(0.0, dot(dq, rh)) * exp(-dd * dd * 0.35) * (1.0 - smoothstep(0.0, 7.5, hY)) * 0.55
              + vec3(1.0, 0.86, 0.6) * step(0.001, jb.w) * step(0.0, dot(dq, rh)) * exp(-dd * dd * 4.0) * exp(-abs(hY - 3.6) * 1.6) * 0.5; }
          for (int i = 0; i < ${NSLOT}; i++) { vec4 q = uGate[i], gc = uGCol[i]; if (q.z > 0.0 && gc.w > 0.0) { vec2 dq = q.xy - p; float t = max(dot(dq, rh) / rl, 0.0), dd = length(p + rh * t - q.xy), hY = Rf.y * t;
            ob += gc.rgb * min(gc.w, 1.0) * step(0.0, dot(dq, rh)) * exp(-dd * dd * 2.2) * (1.0 - smoothstep(0.0, 5.0, hY)) * 0.3; } }
          col = mix(col, dk + (refl * 0.8 + ob) * fr * (1.0 - br * 0.7), uGloss);
        }
        // the sweeping hazards: crimson chevrons on the ground they have not reached yet (pointing the way it moves), a hot line where they touch the floor
        float tel = 0.0, chev = 0.0, outl = 0.0, hot = 0.0;
        for (int i = 0; i < 3; i++) { vec4 w = uWall[i]; if (w.w > 0.001) {
          vec2 d2 = w.xy; float al = dot(p, d2), bl = dot(p, vec2(-d2.y, d2.x)), dp = al - w.z;
          if (dp > 0.0) { vec2 cv = chevF(al, (fract(bl / 3.1) - 0.5) * 3.1, 3.1); float fd = w.w * smoothstep(0.3, 1.3, dp) * (w.w > 0.5 ? 1.0 : 0.12 * (1.0 - uGloss)); // a wall still waiting its turn barely marks the floor (none on the mirror: its ghost grille says it is coming)
            tel = max(tel, fd); chev = max(chev, cv.x * fd); outl = max(outl, cv.y * fd); }
          hot = max(hot, w.w * (exp(-abs(dp) * 7.0) + exp(-max(-dp, 0.0) * 1.2) * step(dp, 0.0) * 0.18) * step(w.z, 21.5) * step(-21.5, w.z)); } }
        for (int i = 0; i < 2; i++) { vec4 w = uRing[i]; if (w.z > 0.001) {
          float dp = w.y > 0.0 ? w.x - r : r - w.x;
          if (dp > 0.0) { float cw = 6.2832 * max(r, 0.5) / 24.0; vec2 cv = chevF(w.y > 0.0 ? -r : r, (fract(a / 6.2832 * 24.0) - 0.5) * cw, cw); float fd = w.z * smoothstep(0.3, 1.3, dp);
            tel = max(tel, fd); chev = max(chev, cv.x * fd); outl = max(outl, cv.y * fd); }
          hot = max(hot, w.z * (exp(-abs(dp) * 7.0) + exp(-max(-dp, 0.0) * 1.2) * step(dp, 0.0) * 0.18) * step(0.05, w.x) * step(w.x, 21.5)); } }
        float inF = step(r, 20.9) * (1.0 - uGloss * step(0.001, uBlob[0].w) * (1.0 - smoothstep(1.5, 1.95, length(p - uBlob[0].xy)))); tel *= inF; chev *= inF; outl *= inF; // and none inside the hero's ring on the mirror
        col *= 1.0 - tel * 0.12;
        col = mix(col, col * mix(0.5, 0.3, uGloss), max(outl - chev, 0.0)); // a thin dark edge round each chevron, no drop shadow
        col = mix(col, mix(CHEV * 0.92, CHEV * 1.12, uGloss) * (0.92 + 0.14 * sin(uTime * 4.2)), chev); // the same crimson in every phase, a slight emissive pulse
        col += CRIM * vec3(1.0, 0.75, 0.75) * hot * 3.2;
        // P3: a solid pale ring of light under the hero, so the silhouette always reads against the dark glass
        { vec4 hb = uBlob[0]; float hd = length(p - hb.xy), on = uGloss * step(0.001, hb.w);
          col += vec3(0.82, 0.84, 0.88) * on * (exp(-hd * hd * 0.6) * 0.12 + lineAA(hd - 1.72, 0.06) * 0.85 + lineAA(hd - 1.72, 0.2) * 0.14); }
        // Lockout: the seams fill with crimson, then the floor goes off
        if (uLock > 0.001) col += CRIM * (seam * 2.5 + 0.12) * uLock * (0.75 + 0.25 * sin(uTime * 14.0));
        col = mix(col, CRIM * 2.5 + vec3(0.6, 0.2, 0.2), uDeton);
        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }`));
    m.renderOrder = -5; g.add(m); S.floor = m;
    // the floor is a floating disc of stone: a hanging underside and a brass band at the edge
    const prof = [[21.0, 0.0], [21.0, -0.5], [20.4, -1.2], [17.0, -3.2], [12.0, -6.4], [6.5, -10.5], [2.0, -14.5], [0.01, -15.5]].map(([x, y]) => new THREE.Vector2(x, y));
    const ug = new THREE.LatheGeometry(prof, 72);
    const st = W.surface('stone', { size: 256, seed: 18, n: 5, dark: 0x5a5148, light: 0xc9bca6, repeat: 6 });
    const under = new THREE.Mesh(ug, W.mat({ map: st.map, normalMap: st.normalMap, roughness: 0.85, color: 0xd8ccb8 })); under.material.side = THREE.BackSide; g.add(under);
    const band = new THREE.Mesh(new THREE.TorusGeometry(21.02, 0.2, 8, 160), W.mat({ color: 0xb8893a, metalness: 1, roughness: 0.32 })); band.rotation.x = PI / 2; band.position.y = -0.35; g.add(band);
    // a low brass balustrade
    const bp = new THREE.LatheGeometry([[0.09, 0], [0.13, 0.07], [0.06, 0.28], [0.11, 0.5], [0.055, 0.74], [0.1, 0.86], [0.001, 0.87]].map(([x, y]) => new THREE.Vector2(x, y)), 10);
    const NB = 132, posts = new THREE.InstancedMesh(bp, W.mat({ color: 0xefe9df, roughness: 0.5 }), NB);
    for (let i = 0; i < NB; i++) { const a = i / NB * TAU; _o.position.set(Math.sin(a) * 20.4, 0, Math.cos(a) * 20.4); _o.rotation.set(0, a, 0); _o.scale.setScalar(1); _o.updateMatrix(); posts.setMatrixAt(i, _o.matrix); }
    g.add(posts);
    const railM = W.mat({ color: 0xb8893a, metalness: 1, roughness: 0.3 });
    for (const [y, t] of [[0.9, 0.07], [0.05, 0.12]]) { const rl = new THREE.Mesh(new THREE.TorusGeometry(20.4, t, 6, 180), railM); rl.rotation.x = PI / 2; rl.position.y = y; g.add(rl); }
  }
  // twelve colossal doors stand on the horizon, each opening onto a different sky
  const NDOOR = 12, DOOR_R = 46, _od = new THREE.Object3D(), _o2 = new THREE.Object3D(), _dm = new THREE.Matrix4(), _dt = new THREE.Matrix4().makeTranslation(0, 0, 0.6);
  function buildDoors(S, g) {
    // one frame (local +z faces the hall): weathered stone pilasters on stepped plinths, capitals, a lintel with a keystone, a cornice and pediment; bronze trim
    // it is built as four pieces (base, two pilasters, the lintel and pediment), so in P3 it can break apart
    const box = (w, h, d, x, y, z) => T(new THREE.BoxGeometry(w, h, d), x, y, z), SP4 = [[], [], [], []], BP4 = [[], [], [], []];
    let sp = SP4[3], bp = BP4[3];
    for (const x of [-5.7, 5.7]) {
      sp = SP4[x < 0 ? 1 : 2]; bp = BP4[x < 0 ? 1 : 2];
      sp.push(box(2.4, 21.6, 3.0, x, 12.0, 0), box(4.0, 1.0, 4.4, x, 0.5, 0), box(3.4, 0.8, 3.9, x, 1.4, 0), box(3.0, 0.5, 3.5, x, 2.05, 0));
      sp.push(box(3.2, 0.7, 3.7, x, 22.2, 0), box(3.6, 0.9, 4.1, x, 23.0, 0));
      for (const fx of [-0.75, -0.25, 0.25, 0.75]) sp.push(box(0.22, 19.4, 0.3, x + fx, 12.3, 1.55)); // fluting ribs on the hall face
      bp.push(box(2.6, 0.35, 3.2, x, 4.2, 0), box(2.6, 0.35, 3.2, x, 19.6, 0));
    }
    sp = SP4[3]; bp = BP4[3];
    sp.push(box(14.2, 2.6, 3.4, 0, 24.75, 0), box(15.6, 0.8, 3.9, 0, 26.45, 0), box(16.6, 0.45, 4.4, 0, 27.05, 0), box(1.8, 3.4, 3.8, 0, 24.1, 0.1));
    for (let k = -7; k <= 7; k++) sp.push(box(0.45, 0.4, 0.4, k * 1.0, 26.0, 1.95)); // dentils
    const ped = new THREE.Shape(); ped.moveTo(-7.8, 0); ped.lineTo(7.8, 0); ped.lineTo(0, 4.0); ped.closePath();
    sp.push(T(new THREE.ExtrudeGeometry(ped, { depth: 3.2, bevelEnabled: false }), 0, 27.25, -1.6));
    for (const sx of [-1, 1]) sp.push(T(new THREE.BoxGeometry(9.1, 0.5, 3.7), sx * 3.82, 29.3, 0, 0, 0, -sx * Math.atan2(4.0, 7.8))); // raking cornices: a clean edge on the slopes
    SP4[0].push(box(16, 2.6, 6, 0, -1.3, 0));
    bp.push(T(new THREE.CylinderGeometry(1.15, 1.15, 0.3, 24), 0, 24.4, 2.05, PI / 2), T(new THREE.TorusGeometry(0.9, 0.12, 6, 24), 0, 24.4, 2.25), T(new THREE.TorusGeometry(1.3, 0.1, 6, 24), 0, 28.6, 1.7));
    bp.push(box(14.8, 0.28, 0.3, 0, 23.35, 1.75));
    const st = W.surface('stone', { size: 256, seed: 5, n: 4, dark: 0x4a4038, light: 0xa89a86, repeat: 2 });
    const fm = W.mat({ map: st.map, normalMap: st.normalMap, color: 0xd6cab4, roughness: 0.74, emissive: 0x4a4032, emissiveIntensity: 1 }); // lighter stone
    const tm = W.mat({ color: 0xc89a48, metalness: 0.85, roughness: 0.3, emissive: 0x2e1e0a, emissiveIntensity: 1 }); // brass capitals and bands
    const PC = [[0, -1.3, 0], [-5.7, 11.5, 0], [5.7, 11.5, 0], [0, 26.5, 0]];
    S.fParts = SP4.map((list, k) => { const st2 = new THREE.InstancedMesh(merge(list), fm, NDOOR); st2.frustumCulled = false; g.add(st2);
      for (let i = 0; i < NDOOR; i++) { const x = Math.sin(i / NDOOR * TAU + PI / NDOOR), w2 = smooth(clamp(x * 1.6 + 0.5, 0, 1)); st2.setColorAt(i, _c.setRGB(lerp(0.84, 1.07, w2), lerp(0.88, 0.99, w2), lerp(1.0, 0.86, w2))); }
      let tr = null; if (BP4[k].length) { tr = new THREE.InstancedMesh(merge(BP4[k]), tm, NDOOR); tr.frustumCulled = false; g.add(tr); }
      return { st: st2, tr, c: new V3(...PC[k]), back: new THREE.Matrix4().makeTranslation(-PC[k][0], -PC[k][1], -PC[k][2]) }; });
    // the openings: each shows its own world with a horizon and cloud banks at depths behind the door, so they slide as you move
    S.dW = iattr(NDOOR, 2);
    const og = new THREE.PlaneGeometry(9.0, 22.6); og.translate(0, 11.3, 0); og.setAttribute('aD', S.dW);
    const om = new THREE.InstancedMesh(og, smat(S.U, `attribute vec2 aD; varying vec3 vW; varying vec2 vDk; varying vec2 vUv;
      void main(){ vDk = aD; vUv = uv; vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`, `
      varying vec3 vW; varying vec2 vDk; varying vec2 vUv;
      void main(){ vec3 V = normalize(vW - cameraPosition), nO = normalize(vec3(vW.x, 0.0, vW.z) + vec3(1e-4, 0.0, 0.0)), tg = vec3(nO.z, 0.0, -nO.x);
        float vt = dot(V, tg), vn0 = max(dot(V, nO), 0.2);
        vec3 sd = normalize(nO + tg * (vt * 0.7 + (vUv.x - 0.5) * 0.5) + vec3(0.0, (vUv.y - 0.3) * 1.25 + V.y * 0.5, 0.0));
        vec3 col = skyW(sd, vDk.x);
        for (int k = 2; k >= 0; k--) { float fk = float(k), D = 12.0 + fk * 30.0 + fk * fk * 20.0;
          vec3 P = vW + V * (D / vn0); vec2 q = vec2(dot(P, tg), P.y - 7.0) * vec2(0.06, 0.16) * (1.0 - fk * 0.25) + vec2(uTime * (0.05 - fk * 0.012), 0.0) + fk * 5.1;
          vec4 L = cloudL(q, vDk.x, fk); float band = smoothstep(-0.25, 0.1, sd.y) * (1.0 - smoothstep(0.2 + fk * 0.08, 0.5, sd.y));
          L *= band; L.rgb = mix(L.rgb, col * L.a, fk * 0.25); col = col * (1.0 - L.a) + L.rgb; }
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = max(mix(vec3(lum), col, 1.35), 0.0) * 0.85;
        float e = min(min(vUv.x, 1.0 - vUv.x) * 9.0, vUv.y * 22.6); col *= 0.1 + 0.9 * smoothstep(0.15, 1.5, e); // a dark stone reveal round the opening
        gl_FragColor = vec4(max(col, 0.0) * 1.0 * (1.0 - vDk.y * 0.93), 1.0); }`), NDOOR);
    om.frustumCulled = false; g.add(om); S.openings = om;
    for (let i = 0; i < NDOOR; i++) S.dW.setXY(i, (i * 3) % 5, 0);
    // the leaves: 24 bronze slabs hinged on the posts, panelled on both faces so they catch the light
    const lp = [], ld = [T(new THREE.BoxGeometry(4.5, 22.4, 0.42), 2.25, 11.2, 0)]; // brass: the panel borders and studs; dark bronze: the slab and the raised panels
    for (const y of [3.0, 8.4, 13.8, 19.2]) for (const z of [-0.25, 0.25]) { lp.push(T(new THREE.BoxGeometry(3.3, 4.4, 0.14), 2.25, y, z)); ld.push(T(new THREE.BoxGeometry(2.5, 3.6, 0.1), 2.25, y, z * 1.36)); }
    for (const y of [5.7, 11.1, 16.5]) for (const z of [-0.27, 0.27]) for (const x of [0.8, 2.25, 3.7]) lp.push(T(new THREE.SphereGeometry(0.16, 8, 6), x, y, z));
    const lm = W.surface('metal', { size: 256, seed: 9, dark: 0x3a2a1a, light: 0x8a6a46 });
    const leaves = new THREE.InstancedMesh(merge(ld), W.mat({ map: lm.map, normalMap: lm.normalMap, color: 0x6e5438, metalness: 0.55, roughness: 0.45, emissive: 0x1c120a, emissiveIntensity: 1 }), NDOOR * 2);
    leaves.frustumCulled = false; g.add(leaves); S.leaves = leaves;
    S.leafP = new THREE.InstancedMesh(merge(lp), W.mat({ color: 0xb8893a, metalness: 0.85, roughness: 0.32, emissive: 0x2a1c0a, emissiveIntensity: 1 }), NDOOR * 2); // the panels and studs in brass, catching the light
    S.leafP.frustumCulled = false; g.add(S.leafP);
    // haze pooled round the doors' feet, so they stand far off and huge
    S.hazeU = { uHz: { value: new THREE.Color(0x9a7480) } };
    const hz = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 40, 96, 1, true), smat(Object.assign({}, S.U, S.hazeU), VW, `
      uniform vec3 uHz; varying vec3 vW;
      void main(){ float a = smoothstep(-9.0, -1.5, vW.y) * (1.0 - smoothstep(-0.5, 2.8, vW.y)) * 0.6 * (0.85 + 0.15 * vn(vec2(atan(vW.x, vW.z) * 12.0 + uTime * 0.05, vW.y * 0.2)));
        vec3 hz = uHz * mix(vec3(1.0), mix(vec3(0.4, 0.48, 0.95), vec3(1.2, 1.02, 0.84), smoothstep(-24.0, 24.0, vW.x)), uSplit);
        gl_FragColor = vec4(hz * 1.05, a * (1.0 - uMosaic)); }`, { transparent: true, depthWrite: false, side: THREE.BackSide }));
    hz.position.y = -10; hz.renderOrder = -30; hz.frustumCulled = false; g.add(hz); S.haze = hz;
    S.leafA = 0; S.leafT = 0; S.tear = -1; S.tearSeed = Array.from({ length: NDOOR * 2 }, () => [vrand(), vrand(), vrand()]);
    S.doorDark = new Float32Array(NDOOR);
  }
  function poseLeaves(S) {
    const L = S.leaves, tear = S.tear >= 0 ? G.now - S.tear : -1;
    for (let i = 0; i < NDOOR; i++) {
      const a = i / NDOOR * TAU + PI / NDOOR, cx = Math.sin(a) * (DOOR_R - 0.2), cz = Math.cos(a) * (DOOR_R - 0.2), ry = a + PI;
      // the frame: in P3 it breaks apart, the pilasters toppling outward and away from each other, the lintel tumbling, the base sinking into the cloud sea
      _od.position.set(Math.sin(a) * DOOR_R, 0, Math.cos(a) * DOOR_R); _od.rotation.set(0, ry, 0, 'YXZ'); _od.scale.setScalar(1); _od.updateMatrix();
      for (let k = 0; k < 4; k++) { const P = S.fParts[k];
        if (tear < 0) _dm.copy(_od.matrix);
        else { const sv = S.tearSeed[i * 2 + (k & 1)], t = Math.max(0, tear - 0.15 - sv[1] * 0.8 - k * 0.08), side = k === 1 ? -1 : k === 2 ? 1 : sv[2] - 0.5;
          if (k === 0) { _o2.position.set(P.c.x, P.c.y - t * t * 1.4, P.c.z - t * 0.6); _o2.rotation.set(-t * 0.04, 0, 0); }
          else { const out = t * (1.6 + sv[0] * 2.2 + (k === 3 ? 1.4 : 0));
            _o2.position.set(P.c.x + side * t * 1.8, P.c.y + t * (k === 3 ? 2.6 : 0.8) - t * t * (k === 3 ? 2.2 : 1.6), P.c.z - out);
            if (k === 3) _o2.rotation.set(-t * (0.45 + sv[1] * 0.5), t * (0.25 + sv[0] * 0.4) * (sv[2] > 0.5 ? 1 : -1), t * 0.3 * side);
            else _o2.rotation.set(-t * (0.32 + sv[0] * 0.35), t * 0.12 * side, side * t * (0.22 + sv[2] * 0.3)); }
          _o2.scale.setScalar(t > 7.5 ? 0.0001 : 1); _o2.updateMatrix();
          _dm.multiplyMatrices(_od.matrix, _o2.matrix).multiply(P.back); }
        P.st.setMatrixAt(i, _dm); if (P.tr) P.tr.setMatrixAt(i, _dm); }
      if (tear >= 0 && tear > 0.3) _dm.makeScale(0.0001, 0.0001, 0.0001); else _dm.multiplyMatrices(_od.matrix, _dt); S.openings.setMatrixAt(i, _dm);
      for (let s = 0; s < 2; s++) {
        const k = i * 2 + s, sd = s ? -1 : 1, open = S.leafA * (1 + (S.tearSeed[k][0] - 0.5) * 0.15);
        _o.position.set(cx + Math.cos(ry) * -4.5 * sd, 0, cz - Math.sin(ry) * -4.5 * sd);
        _o.rotation.set(0, ry + (s ? PI : 0) - open * sd, 0, 'XYZ'); _o.scale.setScalar(1);
        if (tear >= 0) { // torn off their hinges: thrown outward, tumbling, falling into the cloud sea
          const sv = S.tearSeed[k], t = Math.max(0, tear - sv[1] * 0.6), out = t * (11 + sv[0] * 12);
          _o.position.x += Math.sin(a) * out + (sv[2] - 0.5) * t * 3; _o.position.z += Math.cos(a) * out; _o.position.y += t * 6 - t * t * 7;
          _w.set(2.25, 11.2, 0).applyEuler(_o.rotation);
          _o.rotation.x += t * (0.9 + sv[0]) * sd; _o.rotation.y += t * (sv[1] - 0.5) * 1.6; _o.rotation.z += t * (0.6 + sv[2] * 0.8);
          _v.set(2.25, 11.2, 0).applyEuler(_o.rotation); _o.position.add(_w).sub(_v);
          if (t > 4.5) _o.scale.setScalar(0.0001);
        }
        _o.updateMatrix(); L.setMatrixAt(k, _o.matrix); S.leafP.setMatrixAt(k, _o.matrix);
      }
    }
    L.instanceMatrix.needsUpdate = true; S.leafP.instanceMatrix.needsUpdate = true; S.openings.instanceMatrix.needsUpdate = true;
    for (const P of S.fParts) { P.st.instanceMatrix.needsUpdate = true; if (P.tr) P.tr.instanceMatrix.needsUpdate = true; }
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // the gates: ten slots, each a hole into another sky with an inner wall, a brass rim with pips, an iris, a glow and a beacon
  function buildGates(S, g) {
    const n = NSLOT;
    S.gA = iattr(n, 4); S.gC = iattr(n, 3); // gate attrs: world, white, open, rim fill; pair colour
    // the interior: a disc at the bottom of a 0.9 m shaft that flares outward below the lip. It looks into a sky bowl under drifting cloud decks (gateSky), so the sky slides with true parallax
    const DEP = 0.85, FL = 0.1; // near-vertical walls: the far reveal shows from the play camera and the near lip hides the sky at grazing angles
    const dg = new THREE.CircleGeometry(GATE_R + FL + 0.02, 56); dg.rotateX(-PI / 2); dg.translate(0, -DEP, 0); dg.setAttribute('aG', S.gA); dg.setAttribute('aC', S.gC);
    const di = new THREE.InstancedMesh(dg, smat(S.U, `attribute vec4 aG; attribute vec3 aC; varying vec3 vW; varying vec4 vG; varying vec3 vC; varying vec2 vL;
      void main(){ vG = aG; vC = aC; vL = position.xz; vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`, `
      varying vec3 vW; varying vec4 vG; varying vec3 vC; varying vec2 vL;
      void main(){ vec3 V = normalize(vW - cameraPosition); V.y = min(V.y, -0.02); V = normalize(V);
        vec3 col = gateSky(vec3(vL.x, 0.0, vL.y), V, vG.x);
        float rr = length(vL) / ${(GATE_R + FL).toFixed(2)};
        col *= 1.0 - 0.55 * smoothstep(0.8, 1.0, rr); // the shaft's foot shades the sky's edge
        col += vC * smoothstep(0.86, 1.0, rr) * 0.12;
        col = mix(col, mix(vec3(0.6, 0.58, 0.56), vC * 0.75, 0.3) * (0.85 + 0.1 * sin(uTime * 9.0)), vG.y * 0.5); // Lockout: pale, never white, the pair's hue kept
        col += vC * smoothstep(0.75, 1.0, rr) * vG.y * 0.35;
        gl_FragColor = vec4(max(col, 0.0), 1.0); }`), n);
    di.frustumCulled = false; g.add(di); S.gInt = di;
    // the shaft: coursed stone banded with brass, a lit brass lip, darkening toward the bottom, a thin rim of sky light at its foot
    const sg = new THREE.CylinderGeometry(GATE_R, GATE_R + FL, DEP, 56, 1, true); sg.translate(0, -DEP / 2, 0); sg.setAttribute('aC', S.gC); sg.setAttribute('aG', S.gA);
    const si = new THREE.InstancedMesh(sg, smat(S.U, `attribute vec3 aC; attribute vec4 aG; varying vec3 vC; varying float vY; varying float vA; varying vec4 vG;
      void main(){ vC = aC; vG = aG; vY = position.y; vA = atan(position.x, position.z); gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`, `
      varying vec3 vC; varying float vY; varying float vA; varying vec4 vG;
      void main(){ float k = clamp(-vY / ${DEP.toFixed(2)}, 0.0, 1.0), u = vA * ${(GATE_R * 6).toFixed(2)} / 6.2832;
        float course = fract(-vY / 0.2), row = floor(-vY / 0.2), joint = max(1.0 - smoothstep(0.0, 0.06, course), 1.0 - smoothstep(0.0, 0.03, (0.5 - abs(fract(u / 0.9 + row * 0.5) - 0.5)) * 0.9));
        vec3 stone = vec3(0.24, 0.19, 0.145) * (0.78 + 0.22 * hh(vec2(row, floor(u / 0.9 + row * 0.5)))) * (1.0 - joint * 0.55);
        float band = smoothstep(0.05, 0.065, -vY) * (1.0 - smoothstep(0.14, 0.155, -vY));
        vec3 col = mix(stone, BRASS * 0.55, band) * (1.0 - 0.25 * smoothstep(0.0, 0.6, k) - 0.68 * smoothstep(0.6, 0.86, k)); // the bottom third falls into shadow
        col += vec3(1.0, 0.82, 0.52) * (1.0 - smoothstep(0.0, 0.035, -vY)) * 0.7; // the lit lip
        col += vC * smoothstep(0.9, 1.0, k) * 0.35;
        gl_FragColor = vec4(col, 1.0); }`, { side: THREE.BackSide }), n);
    si.frustumCulled = false; g.add(si); S.gShaft = si;
    // the iris: ten brass blades per gate that slide out of the hole with a twist, or meet in the middle
    const sh = new THREE.Shape(); sh.moveTo(0, 0); const BW = 0.82;
    for (let k = 0; k <= 10; k++) { const t = k / 10 * BW - BW * 0.5; sh.lineTo(Math.sin(t) * 1.95, Math.cos(t) * 1.95); } sh.lineTo(0, 0);
    const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }); bg.rotateX(PI / 2); bg.translate(0, -0.075, 0);
    // a shut gate is a brass compass star: blades alternate bright and dark brass and each is canted like a real iris leaf, so the star reads in any light
    const bm = W.mat({ color: 0xffffff, metalness: 0.6, roughness: 0.42, emissive: 0x5a4018, emissiveIntensity: 1 }); // brushed: less mirror, so it never turns brown against a dark sky
    const bi = new THREE.InstancedMesh(bg, bm, n * 10); bi.frustumCulled = false; g.add(bi); S.gIris = bi;
    bi.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 30), 3);
    for (let k = 0; k < n * 10; k++) bi.setColorAt(k, _c.setHex(k % 2 ? 0xc29548 : 0xd0a454)); // one brass, the star only a shallow engraving (blade seams and a 10% step)
    // brass rim, coloured inner line, pips
    const rimM = W.mat({ color: 0xc89a48, metalness: 1, roughness: 0.28 });
    const rg = new THREE.TorusGeometry(GATE_R + 0.14, 0.13, 10, 72); rg.rotateX(PI / 2); rg.translate(0, 0.04, 0);
    const ri = new THREE.InstancedMesh(rg, rimM, n); ri.frustumCulled = false; g.add(ri); S.gRim = ri;
    const lg = new THREE.TorusGeometry(GATE_R + 0.01, 0.035, 6, 72); lg.rotateX(PI / 2); lg.translate(0, 0.03, 0);
    const li = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: 0xffffff }), n); li.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); li.frustumCulled = false; g.add(li); S.gLine = li;
    const pi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), n * 5); pi.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 15), 3); pi.frustumCulled = false; g.add(pi); S.gPip = pi;
    // each pip is a glowing bead set in a brass collar on the rim
    const pc = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.125, 0.15, 0.08, 14, 1, true), rimM, n * 5); pc.frustumCulled = false; g.add(pc); S.gPipC = pc;
    // a soft upward glow card
    const cg = new THREE.CylinderGeometry(GATE_R * 0.98, GATE_R * 1.05, 2.6, 40, 1, true); cg.translate(0, 1.3, 0); cg.setAttribute('aC', S.gC); cg.setAttribute('aG', S.gA);
    const ci = new THREE.InstancedMesh(cg, smat(S.U, `attribute vec3 aC; attribute vec4 aG; varying vec3 vC; varying vec4 vG; varying float vY; varying float vF;
      void main(){ vC = aC; vG = aG; vY = position.y / 2.6; vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vF = abs(dot(n, normalize(cameraPosition - wp.xyz))); gl_Position = projectionMatrix * viewMatrix * wp; }`, `
      varying vec3 vC; varying vec4 vG; varying float vY; varying float vF;
      void main(){ float a = pow(clamp(1.0 - vY, 0.0, 1.0), 4.0) * (0.15 + 0.85 * vF * vF) * vG.z * (0.85 + 0.15 * sin(uTime * 3.0 + vY * 9.0)) * 0.4;
        vec3 c = mix(vC, vec3(1.0), vG.y * 0.35); gl_FragColor = vec4(c * a * 0.55, a); }`, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), n);
    ci.frustumCulled = false; ci.renderOrder = 14; g.add(ci); S.gGlow = ci;
    // beacons: a soft column of the pair's colour (alpha-blended so it reads on the pale floor too), about half a gate wide and 5.5 m tall, Y-billboarded, motes rising
    const qg = new THREE.PlaneGeometry(1, 1, 1, 8); qg.translate(0, 0.5, 0); qg.setAttribute('aC', S.gC); qg.setAttribute('aG', S.gA);
    const qi = new THREE.InstancedMesh(qg, smat(S.U, `attribute vec3 aC; attribute vec4 aG; varying vec3 vC; varying vec4 vG; varying vec2 vUv; varying float vNear; varying vec3 vW;
      void main(){ vC = aC; vG = aG; vUv = uv; vec3 base = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 toC = cameraPosition - base; toC.y = 0.0; vec3 side = normalize(vec3(-toC.z, 0.0, toC.x) + vec3(1e-4, 0.0, 0.0));
        float w = 1.5 + 0.3 * (1.0 - uv.y); vec3 wp = base + side * (uv.x - 0.5) * w + vec3(0.0, uv.y * 5.5, 0.0);
        vNear = smoothstep(2.0, 8.0, length(cameraPosition - wp)); vW = wp; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`, `
      uniform vec3 uHero; varying vec3 vC; varying vec4 vG; varying vec2 vUv; varying float vNear; varying vec3 vW;
      void main(){ float x = abs(vUv.x - 0.5) * 2.0, core = exp(-x * x * 14.0), body = exp(-x * x * 3.2) * (1.0 - smoothstep(0.8, 1.0, x));
        float mote = smoothstep(0.78, 1.0, vn(vec2(vUv.x * 5.0, vUv.y * 10.0 - uTime * 1.4))) * body;
        float fall = (1.0 - smoothstep(0.3, 1.0, vUv.y)) * (0.75 + 0.25 * (1.0 - vUv.y)) * smoothstep(0.0, 0.04, vUv.y);
        vec3 cp = uHero - cameraPosition; float th = clamp(dot(vW - cameraPosition, cp) / max(dot(cp, cp), 1e-3), 0.0, 1.0), dh = length(vW - cameraPosition - cp * th);
        float a = clamp((body * 0.3 + core * 0.1 + mote * 0.14) * fall * vG.z * vNear * mix(0.25, 1.0, smoothstep(0.45, 1.3, dh)), 0.0, 1.0); // never a curtain over the hero
        vec3 c = mix(vC, vec3(1.0, 0.97, 0.95), vG.y * 0.45) * (0.95 + 0.45 * core); gl_FragColor = vec4(c, a); }`, { transparent: true, depthWrite: false, side: THREE.DoubleSide }), n);
    qi.frustumCulled = false; qi.renderOrder = 16; g.add(qi); S.gBeacon = qi;
    S.gs = Array.from({ length: n }, () => ({ x: 0, z: 0, pair: -1, twin: -1, on: false, vis: 0, white: 0, fill: 0, ripple: -10, flare: 0 }));
    S.armed = new Array(n).fill(false); S.dw = new Array(n).fill(0);
  }
  // arcs of light between twins (Rehang, and the path of every transit)
  function buildArcs(S, g) {
    const N = 9, seg = 48, pos = new Float32Array((seg + 1) * 2 * 3), idx = [];
    for (let i = 0; i <= seg; i++) for (let s = 0; s < 2; s++) { const k = (i * 2 + s) * 3; pos[k] = i / seg; pos[k + 1] = s * 2 - 1; }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.InstancedBufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
    S.arA = iattr(N, 4); S.arB = iattr(N, 4); S.arC = iattr(N, 4); geo.setAttribute('aA', S.arA); geo.setAttribute('aB', S.arB); geo.setAttribute('aCo', S.arC); geo.instanceCount = N;
    const m = new THREE.Mesh(geo, smat(S.U, `attribute vec4 aA, aB, aCo; varying vec4 vC; varying vec2 vP;
      void main(){ float u = position.x; vec3 A = aA.xyz, B = aB.xyz; float H = aA.w;
        vec3 P = mix(A, B, u) + vec3(0.0, 4.0 * H * u * (1.0 - u), 0.0); vec3 tg = normalize(B - A + vec3(0.0, 4.0 * H * (1.0 - 2.0 * u), 0.0) + vec3(1e-4));
        vec3 side = normalize(cross(tg, normalize(cameraPosition - P)) + vec3(0.0, 1e-4, 0.0));
        vC = aCo; vP = vec2(u, position.y); gl_Position = projectionMatrix * viewMatrix * vec4(P + side * position.y * aB.w, 1.0); }`, `
      varying vec4 vC; varying vec2 vP;
      void main(){ float x = abs(vP.y); float a = (exp(-x * x * 12.0) + exp(-x * x * 2.0) * 0.3) * vC.a * smoothstep(0.0, 0.06, vP.x) * (1.0 - smoothstep(0.94, 1.0, vP.x));
        a *= 0.75 + 0.25 * sin(vP.x * 40.0 - uTime * 12.0); gl_FragColor = vec4(vC.rgb * a, a); }`, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.frustumCulled = false; m.renderOrder = 17; g.add(m); S.arcs = Array.from({ length: N }, () => ({ a: 0, t: -10, dur: 1 }));
  }
  function arc(S, i, ax, az, bx, bz, hex, dur = 1.2, h = 3, w = 0.35) {
    if (G.headless) return; const A = S.arcs[i]; A.t = G.now; A.dur = dur; _c.setHex(hex);
    S.arA.setXYZW(i, ax, 0.3, az, h + Math.hypot(bx - ax, bz - az) * 0.18); S.arB.setXYZW(i, bx, 0.3, bz, w); S.arC.setXYZW(i, _c.r * 2.2, _c.g * 2.2, _c.b * 2.2, 0); S.arA.needsUpdate = S.arB.needsUpdate = true;
  }
  // the portcullis: a door grille the size of a cathedral door, crimson where it meets the floor (that seam is the hit line)
  const GRILLE = `
    uniform float uA, uGhost, uLive, uRad, uCyl; uniform vec3 uPP, uJP; varying vec2 vL; varying vec3 vW;
    vec2 sightD(vec3 tgt){ vec3 cp = tgt - cameraPosition; float t = clamp(dot(vW - cameraPosition, cp) / max(dot(cp, cp), 1e-3), 0.0, 1.0); return vec2(length(vW - cameraPosition - cp * t), t); } // distance from the line of sight, and how far along it
    void main(){
      vec2 q = vL; float fx = max(fwidth(q.x), 1e-3), fy = max(fwidth(q.y), 1e-3);
      float bx = abs(fract(q.x / 2.3) - 0.5) * 2.3, vb = 1.0 - smoothstep(0.2 - fx, 0.2 + fx, bx);
      float tooth = 1.0 - smoothstep(-fx, fx, bx - 0.22 * clamp(q.y / 1.1, 0.0, 1.0)); if (q.y < 1.1) vb = tooth;
      float hy = abs(fract((q.y - 1.6) / 2.2) - 0.5) * 2.2, hb = (1.0 - smoothstep(0.13 - fy, 0.13 + fy, hy)) * step(1.3, q.y);
      vec2 dq = vec2(q.x / 2.3, (q.y - 1.6) / 2.2); vec2 fq = fract(dq) - 0.5; float dg = min(abs(fq.x - fq.y), abs(fq.x + fq.y));
      float lat = (1.0 - smoothstep(0.009, 0.009 + fx * 0.5, dg)) * step(1.3, q.y) * 0.45; // light X bracing, well under the weight of the main bars
      float top = 1.0 - smoothstep(14.8, 15.0, q.y); float crown = smoothstep(14.6, 14.8, q.y) * (1.0 - smoothstep(15.6, 15.7, q.y));
      float bar = max(max(vb, hb), max(lat, crown)) * top + crown;
      float bev = max(1.0 - smoothstep(0.0, 0.2, bx), 1.0 - smoothstep(0.0, 0.13, hy));
      vec3 col = BRONZE * (0.35 + 0.9 * bev) + BRASS * 0.25 * bev * (0.5 + 0.5 * sin(q.y * 0.6 + uTime * 0.5));
      float g = exp(-q.y * 1.3) * uLive, seam = (1.0 - smoothstep(0.0, 0.22, q.y)) * uLive;
      col += CRIM * g * 1.6 * bar + CRIM * seam * 6.0;
      // bars fade to about a quarter near the camera and around the lines of sight to the hero and to Janus; the crimson contact seam stays
      float dc = length(vW - cameraPosition);
      vec2 sJ = sightD(uJP);
      float fade = mix(0.1, 1.0, smoothstep(7.0, 22.0, dc)) * mix(1.0, 0.4, smoothstep(9.0, 13.5, q.y) * (1.0 - crown)) * min(mix(0.27, 1.0, smoothstep(1.6, 4.6, sightD(uPP).x)), mix(0.3, 1.0, smoothstep(2.4, 5.0, sJ.x / max(sJ.y, 0.3)))) * smoothstep(1.5, 3.0, dc);
      float a = (bar * 0.94 + (1.0 - bar) * g * 0.22) * fade + seam * max(fade, 0.7) * smoothstep(1.5, 3.0, dc);
      a *= uA * mix(1.0, 0.32, uGhost);
      if (a < 0.003) discard;
      gl_FragColor = vec4(col * mix(1.0, 0.6, uGhost), clamp(a, 0.0, 1.0));
    }`;
  function grilleMat(S, cyl) {
    const U = Object.assign({ uA: { value: 0 }, uGhost: { value: 0 }, uLive: { value: 0 }, uRad: { value: 1 }, uCyl: { value: cyl ? 1 : 0 }, uPP: { value: new V3() }, uJP: { value: new V3(0, -100, 0) } }, S.U);
    return smat(U, cyl ? `uniform float uRad; varying vec2 vL; varying vec3 vW;
      void main(){ float n = max(6.0, floor(6.2832 * uRad / 2.3 + 0.5)); vL = vec2((atan(position.x, position.z + 1e-6) / 6.2832 + 0.5) * n * 2.3, position.y);
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`
      : 'varying vec2 vL; varying vec3 vW; void main(){ vL = position.xy; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    GRILLE, { transparent: true, depthWrite: false, side: THREE.DoubleSide });
  }
  function buildWalls(S, g) {
    const wg = new THREE.PlaneGeometry(46, 16, 1, 1); wg.translate(0, 8, 0);
    S.walls = [0, 1, 2].map(() => { const m = new THREE.Mesh(wg, grilleMat(S, false)); m.visible = false; m.renderOrder = 18; m.frustumCulled = false; g.add(m); return m; });
    const cg = new THREE.CylinderGeometry(1, 1, 16, 128, 1, true); cg.translate(0, 8, 0);
    S.rings = [0, 1].map(() => { const m = new THREE.Mesh(cg, grilleMat(S, true)); m.visible = false; m.renderOrder = 18; m.frustumCulled = false; g.add(m); return m; });
  }
  // the transit: for 0.45 s you fall through the gate's rim into its world, clouds rushing past, and rise out through the twin's rim
  function buildOverlay(S, g) {
    S.ovU = { uRes: { value: new THREE.Vector2(1280, 720) }, uK: { value: 0 }, uT: { value: 0 }, uP: { value: 0 }, uOW: { value: 0 }, uOC: { value: new THREE.Color() }, uLockO: { value: 0 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), smat(Object.assign({}, S.U, S.ovU), 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', `
      uniform vec2 uRes; uniform float uK, uT, uP, uOW, uLockO; uniform vec3 uOC;
      void main(){
        vec2 uv = gl_FragCoord.xy / max(uRes, vec2(1.0)), c = (uv - 0.5) * vec2(uRes.x / max(uRes.y, 1.0), 1.0);
        float r = length(c), a = atan(c.y, c.x + 1e-6), z = 0.35 / max(r, 0.02);
        // the world beyond: its sky, and cloud banks swelling out of the centre and rushing past
        vec3 d = normalize(vec3(c * 1.4, 1.0)); vec3 col = skyW(vec3(d.x, d.z * 0.75 + 0.18, d.y), uOW);
        for (int k = 0; k < 2; k++) { float ph = fract(uT * 2.2 + float(k) * 0.5), sc = mix(0.25, 3.5, ph * ph);
          vec4 L = 0.75 * cloudL(c / sc * 4.0 + float(k) * 3.7 + floor(uT * 2.2 + float(k) * 0.5) * 1.3, uOW, float(k)) * sin(ph * 3.1416);
          col = col * (1.0 - L.a) + L.rgb; }
        // the rim: you fall in through one (it widens past you) and rise out through the twin's (it grows toward you)
        float rr = uP < 0.44 ? mix(0.12, 1.25, smoothstep(0.0, 0.44, uP)) : mix(0.08, 1.25, smoothstep(0.44, 1.0, uP));
        float out0 = smoothstep(rr - 0.01, rr + 0.02, r);
        col = mix(col, col * 0.4 + uOC * 0.05, out0);
        col += mix(vec3(0.9, 0.75, 0.45), uOC, 0.7) * (exp(-abs(r - rr) * 70.0) * 0.62 + exp(-abs(r - rr) * 12.0) * 0.12); // capped: the destination's hue, never a white disc
        // streaks only in the outer part of the frame
        float sp = mix(5.0, 2.4, uLockO);
        float st = vn(vec2(a * 18.0, z * 0.6 - uT * sp * 3.0)), streak = smoothstep(0.6, 0.9, st) * smoothstep(0.5, 0.72, r);
        col += uOC * streak * 0.9;
        if (uLockO > 0.5) { float cell = floor(a / 6.2832 * 10.0 + 10.0), zz = fract(z * 0.25 - uT * 0.9 + hh(vec2(cell, 1.0)));
          vec2 fq = vec2(fract(a / 6.2832 * 10.0) - 0.5, zz - 0.5); float door = step(abs(fq.x), 0.28) * step(abs(fq.y), 0.36) * step(hh(vec2(cell, floor(z * 0.25 - uT * 0.9))), 0.55);
          col = mix(col, DOORL * 1.6 * smoothstep(0.15, 0.6, r), door * smoothstep(0.1, 0.4, r)); }
        float vig = smoothstep(0.35, 1.0, r); col *= 1.0 - vig * 0.5;
        gl_FragColor = vec4(max(col, 0.0) * uK, uK); // opaque at the peak: no hall geometry ghosting through
      }`, { transparent: true, depthTest: false, depthWrite: false }));
    m.frustumCulled = false; m.renderOrder = 9999; m.visible = false; g.add(m); S.overlay = m;
  }
  // a small key: the halo's keys, Latchkeys and Deadbolt
  function keyGeo(L = 1) {
    const s = L / 0.9, parts = [T(new THREE.CylinderGeometry(0.028, 0.028, 0.62, 8), 0, -0.12, 0), T(new THREE.TorusGeometry(0.12, 0.03, 6, 16), 0, 0.3, 0), T(new THREE.BoxGeometry(0.16, 0.05, 0.03), 0.07, -0.36, 0), T(new THREE.BoxGeometry(0.05, 0.1, 0.03), 0.13, -0.3, 0), T(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8), 0, 0.15, 0)];
    const gg = merge(parts); gg.scale(s, s, s); return gg;
  }
  function buildKeys(S, g) {
    const km = W.mat({ color: 0xffd98a, metalness: 1, roughness: 0.25, emissive: 0x6a4a10, emissiveIntensity: 0.6 });
    const fk = new THREE.InstancedMesh(keyGeo(1.6), km, 6); fk.frustumCulled = false; for (let i = 0; i < 6; i++) fk.setMatrixAt(i, _m4.makeScale(0, 0, 0)); g.add(fk); S.fKeys = fk;
    S.falls = []; // { x, z, t0, t1 } a halo key dropping onto a Latchkey circle
    // the Padlock (shared geometry so the add can reuse it)
    const pg = new THREE.Group();
    const pm = W.mat({ color: 0xb8893a, metalness: 1, roughness: 0.3 }), pd = W.mat({ color: 0x3a2c1e, metalness: 0.9, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.7), pm); body.position.y = 0.95; pg.add(body);
    const sh = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.11, 8, 20, PI), pd); sh.position.y = 1.55; pg.add(sh);
    for (const x of [-0.5, 0.5]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 8), pd); leg.position.set(x, 1.5, 0); pg.add(leg); }
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); hole.position.set(0, 0.95, 0.36); pg.add(hole); S.lockHole = hole;
    const hole2 = hole.clone(); hole2.position.z = -0.36; hole2.rotation.y = PI; pg.add(hole2);
    pg.traverse((o) => { if (o.geometry) o.geometry.userData.shared = true; if (o.material) o.material.userData.shared = true; });
    S.lockMesh = pg; pg.visible = false; g.add(pg);
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // JANUS: a robed bronze colossus, two masks, a halo of keys, a great key, and an archway through his chest full of another sky
  function buildJanus(S, b) {
    const J = S.J = {}, root = J.root = new THREE.Group(); b.group.add(root);
    const bronze = W.mat({ color: 0x5a4430, metalness: 0.88, roughness: 0.36 }), brass = W.mat({ color: 0xc89a48, metalness: 1, roughness: 0.26 });
    const marble = W.mat({ color: 0xb8ab97, roughness: 0.62, metalness: 0 }), robeM = W.mat({ color: 0xbcae98, roughness: 0.78, metalness: 0, vertexColors: true }); J.mats = { bronze, brass, marble };
    root.scale.setScalar(1.32); // a colossus: the head clears the balustrade from the play camera
    const add = (par, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; par.add(m); return m; };
    // the robe: a lathe of warm grey marble with deep vertical folds (broad lit ridges, narrow dark creases), a hem that lifts into drapes between them, a brass band above the hem
    const prof = [[1.62, 0], [1.6, 0.12], [1.56, 0.3], [1.545, 0.34], [1.53, 0.38], [1.505, 0.5], [1.49, 0.54], [1.475, 0.58], [1.42, 0.85], [1.28, 1.45], [1.08, 2.05], [0.93, 2.42], [0.9, 2.56], [0.001, 2.58]].map(([x, y]) => new THREE.Vector2(x, y));
    const rg = new THREE.LatheGeometry(prof, 120), rp = rg.attributes.position;
    const rc = new Float32Array(rp.count * 3);
    for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i), a = Math.atan2(x, z), amp = (1 - y / 2.7) * (y < 2.5 ? 1 : 0);
      const ridge = 0.5 + 0.5 * Math.cos(a * 9 + y * 0.55 + 0.7 * Math.sin(a * 3)); // nine folds: 1 on a fold's crest, 0 deep in its crease
      const k = 1 + (0.22 * (ridge - 0.55) + 0.03 * Math.sin(a * 23 - y)) * amp * 1.15; rp.setXYZ(i, x * k, y < 0.01 ? (1 - ridge) * 0.1 : y, z * k);
      let c = (0.3 + 0.7 * Math.pow(ridge, 0.8)) * (0.86 + 0.14 * Math.min(1, y / 1.2)), r = c, gC = c * 0.97, bC = c * 0.93;
      if (y > 0.35 && y < 0.53) { r = c * 1.25; gC = c * 0.86; bC = c * 0.42; } // the brass band
      rc[i * 3] = r; rc[i * 3 + 1] = gC; rc[i * 3 + 2] = bC; }
    rg.setAttribute('color', new THREE.BufferAttribute(rc, 3)); rg.computeVertexNormals();
    J.robe = new THREE.Group(); root.add(J.robe);
    add(J.robe, rg, robeM);
    add(J.robe, T(new THREE.TorusGeometry(0.94, 0.1, 8, 48), 0, 2.5, 0, PI / 2), bronze);
    // the torso is a doorway: an arched opening straight through it
    J.torso = new THREE.Group(); J.torso.position.y = 2.5; root.add(J.torso);
    const AW = 0.6, AY0 = 0.16, AY1 = 0.9; // the archway: 1.5x the old one, half-width AW, sill AY0, springing line AY1
    const hole = new THREE.Path(); hole.moveTo(-AW, AY0); hole.lineTo(AW, AY0); hole.lineTo(AW, AY1); hole.absarc(0, AY1, AW, 0, PI, false); hole.lineTo(-AW, AY0);
    const outer = new THREE.Shape(); outer.moveTo(-0.86, -0.05); outer.lineTo(0.86, -0.05); outer.lineTo(1.02, 1.3); outer.quadraticCurveTo(1.12, 1.62, 0.62, 1.8); outer.lineTo(-0.62, 1.8); outer.quadraticCurveTo(-1.12, 1.62, -1.02, 1.3); outer.closePath();
    outer.holes.push(hole);
    const tg = new THREE.ExtrudeGeometry(outer, { depth: 0.8, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 18 }); tg.translate(0, 0, -0.4);
    add(J.torso, tg, bronze);
    const lining = new THREE.Shape(); lining.moveTo(-AW - 0.1, AY0 - 0.08); lining.lineTo(AW + 0.1, AY0 - 0.08); lining.lineTo(AW + 0.1, AY1); lining.absarc(0, AY1, AW + 0.1, 0, PI, false); lining.lineTo(-AW - 0.1, AY0 - 0.08); lining.holes.push(hole);
    const lgeo = new THREE.ExtrudeGeometry(lining, { depth: 0.96, bevelEnabled: false, curveSegments: 18 }); lgeo.translate(0, 0, -0.48);
    add(J.torso, lgeo, W.mat({ color: 0x140e0a, metalness: 0.6, roughness: 0.7 })); // a dark inner reveal
    // the sky through his chest
    const hs = new THREE.Shape(); hs.moveTo(-AW, AY0); hs.lineTo(AW, AY0); hs.lineTo(AW, AY1); hs.absarc(0, AY1, AW, 0, PI, false); hs.lineTo(-AW, AY0);
    S.chestU = { uChest: { value: 1 }, uCW: { value: 1 } };
    J.chest = add(J.torso, new THREE.ShapeGeometry(hs, 18), smat(Object.assign({}, S.U, S.chestU), 'varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }', `
      uniform float uChest, uCW; varying vec3 vW; varying vec2 vUv;
      void main(){ vec3 V = normalize(vW - cameraPosition); vec2 u = vUv; // a window: horizon low in the arch, the sky rising above, clouds drifting behind it
        vec3 sd = normalize(vec3(u.x * 0.8 + V.x * 0.35, (u.y - 0.4) * 1.05 + V.y * 0.3, 1.0)); vec3 col = skyW(sd, uCW);
        for (int k = 1; k >= 0; k--) { float fk = float(k); vec2 q = vec2(u.x * 1.6 + V.x * (1.0 + fk * 2.0), u.y * 3.6 + V.y * (1.0 + fk * 2.0)) * vec2(1.0, 0.6) + vec2(uTime * (0.08 - fk * 0.03), fk * 4.0);
          vec4 L = cloudL(q, uCW, fk + 1.0) * smoothstep(-0.15, 0.05, sd.y) * (1.0 - smoothstep(0.25, 0.55, sd.y)); col = col * (1.0 - L.a) + L.rgb; }
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = max(mix(vec3(lum), col, 1.45), 0.0) * 0.85; // a saturated sky, deep enough not to read as a lamp
        float e = u.y < ${AY1.toFixed(2)} ? min(${AW.toFixed(2)} - abs(u.x), u.y - ${AY0.toFixed(2)}) : ${AW.toFixed(2)} - length(vec2(u.x, u.y - ${AY1.toFixed(2)}));
        col *= (0.08 + 0.92 * smoothstep(0.0, 0.2, e)) * (0.4 + 0.5 * min(uChest, 1.4));
        gl_FragColor = vec4(max(col, 0.0), 1.0); }`, { side: THREE.DoubleSide }));
    J.chest.castShadow = false;
    for (const s of [-1, 1]) {
      add(J.torso, T(new THREE.SphereGeometry(0.52, 18, 12), 0, 0, 0, 0, 0, 0, 1, 0.78, 1), bronze, s * 1.02, 1.52, 0);
      add(J.torso, T(new THREE.TorusGeometry(0.5, 0.05, 6, 24), 0, 0, 0, 0.2, 0, s * 0.5), brass, s * 1.02, 1.48, 0);
    }
    add(J.torso, T(new THREE.CylinderGeometry(0.2, 0.26, 0.4, 14), 0, 0, 0), bronze, 0, 1.95, 0);
    // the head: bronze, two masks (dawn gold in front, dusk silver behind), and in P3 a doorway of light where the face was
    J.head = new THREE.Group(); J.head.position.y = 2.1; J.head.scale.setScalar(1.6); J.torso.add(J.head);
    add(J.head, new THREE.SphereGeometry(0.36, 22, 16), bronze, 0, 0.3, 0);
    const gold = W.mat({ color: 0xffd98a, metalness: 1, roughness: 0.22, emissive: 0x7a5418, emissiveIntensity: 0.45 }), silver = W.mat({ color: 0xd4dce8, metalness: 0.55, roughness: 0.3, emissive: 0x3a4458, emissiveIntensity: 0.8 }), sock = W.mat({ color: 0x060404, metalness: 0.2, roughness: 0.9 }); // bright cool silver, plainly not gold
    J.eyeG = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c8).multiplyScalar(1.1) }); J.eyeS = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fd0ff).multiplyScalar(0.4) });
    J.halves = [];
    for (let m = 0; m < 2; m++) for (let s = 0; s < 2; s++) { // m 0 = dawn (front), 1 = dusk (back); s = left/right half
      const hg = new THREE.Group(); J.head.add(hg);
      const mg = new THREE.Group(); mg.position.y = 0.3 * (1 - 1.3); mg.scale.set(1, 1.3, 1); hg.add(mg); // a tall classical mask, not a ball
      const ph0 = (m ? PI : 0) + s * PI / 2, mat = m ? silver : gold;
      add(mg, new THREE.SphereGeometry(0.43, 16, 14, ph0, PI / 2, PI * 0.1, PI * 0.74), mat, 0, 0.3, 0).material.side = THREE.DoubleSide;
      const fx = (s ? 1 : -1) * (m ? -1 : 1), fz = m ? -1 : 1;
      // calm relief: a heavy level brow over eye sockets in shadow (a small glint, no lamp), a soft cheekbone; on one half a straight nose, a closed mouth and a chin
      add(mg, T(new THREE.BoxGeometry(0.3, 0.075, 0.14), 0, 0, 0, 0, 0, -fx * 0.08), mat, fx * 0.14, 0.45, fz * 0.36);
      add(mg, T(new THREE.SphereGeometry(0.085, 12, 8), 0, 0, 0, 0, 0, 0, 1.5, 0.8, 0.5), sock, fx * 0.14, 0.37, fz * 0.37).castShadow = false;
      const eye = add(mg, T(new THREE.SphereGeometry(0.045, 10, 8), 0, 0, 0, 0, 0, 0, 1.3, 0.45, 0.5), m ? J.eyeS : J.eyeG, fx * 0.14, 0.365, fz * 0.395); eye.castShadow = false;
      add(mg, T(new THREE.SphereGeometry(0.07, 10, 8), 0, 0, 0, 0, 0, 0, 1.4, 0.7, 0.5), mat, fx * 0.2, 0.27, fz * 0.36);
      if (s === 0) { add(mg, T(new THREE.CylinderGeometry(0.03, 0.065, 0.22, 3), 0, 0, 0, -0.2 * fz, m ? PI : 0, 0), mat, 0, 0.28, fz * 0.415);
        add(mg, new THREE.BoxGeometry(0.1, 0.03, 0.05), mat, 0, 0.175, fz * 0.435);
        add(mg, new THREE.BoxGeometry(0.16, 0.014, 0.04), sock, 0, 0.115, fz * 0.41); add(mg, new THREE.BoxGeometry(0.18, 0.028, 0.05), mat, 0, 0.132, fz * 0.405); add(mg, new THREE.BoxGeometry(0.13, 0.032, 0.05), mat, 0, 0.096, fz * 0.4);
        add(mg, T(new THREE.SphereGeometry(0.08, 10, 8), 0, 0, 0, 0, 0, 0, 1.3, 0.8, 0.6), mat, 0, 0.0, fz * 0.32); }
      hg.userData = { m, s }; J.halves.push(hg);
    }
    const fl = new THREE.Shape(); fl.moveTo(-0.16, -0.2); fl.lineTo(0.16, -0.2); fl.lineTo(0.16, 0.08); fl.absarc(0, 0.08, 0.16, 0, PI, false); fl.lineTo(-0.16, -0.2);
    J.faceL = add(J.head, new THREE.ShapeGeometry(fl, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.9, 0.74).multiplyScalar(2.2), side: THREE.DoubleSide }), 0, 0.32, 0.37); J.faceL.visible = false; J.faceL.castShadow = false;
    J.faceB = add(J.head, new THREE.ShapeGeometry(fl, 12), J.faceL.material, 0, 0.32, -0.37); J.faceB.visible = false; J.faceB.castShadow = false;
    // arms in marble sleeves
    const sleeve = new THREE.LatheGeometry([[0.001, 0.05], [0.32, 0.0], [0.36, -0.4], [0.44, -0.85], [0.5, -1.05]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
    const mkArm = (s) => {
      const sh = new THREE.Group(); sh.position.set(s * 1.08, 1.42, 0); J.torso.add(sh);
      add(sh, T(new THREE.CapsuleGeometry(0.21, 0.7, 4, 12), 0, -0.5, 0), bronze); add(sh, sleeve, marble).material.side = THREE.DoubleSide;
      const el = new THREE.Group(); el.position.y = -1.05; sh.add(el);
      add(el, T(new THREE.CapsuleGeometry(0.17, 0.66, 4, 12), 0, -0.45, 0), bronze); add(el, T(new THREE.CylinderGeometry(0.21, 0.24, 0.32, 14), 0, -0.62, 0), brass);
      const hand = new THREE.Group(); hand.position.y = -0.98; el.add(hand);
      add(hand, T(new THREE.BoxGeometry(0.24, 0.3, 0.2), 0, -0.08, 0), bronze); add(hand, T(new THREE.BoxGeometry(0.08, 0.16, 0.08), s * -0.13, -0.02, 0.06, 0, 0, s * 0.4), bronze);
      return { sh, el, hand };
    };
    J.armL = mkArm(1); J.armR = mkArm(-1);
    // the small Deadbolt key in his left hand
    J.dkey = new THREE.Mesh(keyGeo(1.1), W.mat({ color: 0xffd98a, metalness: 1, roughness: 0.2, emissive: 0xffc860, emissiveIntensity: 1.6 })); J.dkey.position.y = -0.25; J.dkey.rotation.x = PI; J.dkey.scale.setScalar(0.001); J.armL.hand.add(J.dkey);
    // the halo: eight keys radiating from a gold ring standing behind his head, turning slowly, clear of the shoulders
    J.halo = new THREE.Group(); J.halo.position.set(0, 5.0, -0.75); root.add(J.halo);
    const hk = W.mat({ color: 0xffd98a, metalness: 1, roughness: 0.22, emissive: 0x8a6420, emissiveIntensity: 0.7 });
    J.hkeys = new THREE.InstancedMesh(keyGeo(1.5), hk, 8); J.hkeys.frustumCulled = false; J.halo.add(J.hkeys);
    const hr = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.03, 4, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd98a).multiplyScalar(1.4), transparent: true, opacity: 0.7, depthWrite: false })); J.halo.add(hr); J.hring = hr;
    J.haloA = 0;
    // the great key, 5 m, built from the tip of the bit (y 0) up to the bow (y 5)
    const kb = [T(new THREE.CylinderGeometry(0.085, 0.085, 4.15, 10), 0, 2.3, 0), T(new THREE.TorusGeometry(0.42, 0.085, 10, 28), 0, 4.5, 0), T(new THREE.CylinderGeometry(0.15, 0.15, 0.14, 12), 0, 4.0, 0), T(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), 0, 3.75, 0)];
    for (const [x, y] of [[0.17, 0], [-0.17, 0], [0, 0.17], [0, -0.17]]) kb.push(T(new THREE.TorusGeometry(0.13, 0.03, 6, 16), x, 4.5 + y, 0));
    const kbit = [T(new THREE.BoxGeometry(0.62, 0.62, 0.1), 0.38, 0.4, 0), T(new THREE.BoxGeometry(0.16, 0.22, 0.1), 0.62, 0.0, 0), T(new THREE.BoxGeometry(0.14, 0.3, 0.1), 0.3, -0.02, 0)];
    J.key = new THREE.Group(); b.group.add(J.key);
    add(J.key, merge(kb), brass); add(J.key, merge(kbit), bronze);
    add(J.key, new THREE.BoxGeometry(0.03, 3.9, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd98a).multiplyScalar(1.8) }), 0, 2.2, 0.08).castShadow = false;
    J.fkey = J.key.clone(); J.fkey.visible = false; b.group.add(J.fkey); // the thrown key (Through-Lance), sharing the same parts
    { const gl = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c0).multiplyScalar(2.4) })); gl.position.y = 4.5; gl.scale.set(1, 1.8, 1); J.fkey.add(gl); } // a glint in its bow
    // a warm light in his chest
    J.light = new THREE.PointLight(0xffd8a0, 18, 9, 1.6); J.light.position.set(0, 3.3, 0.9); root.add(J.light);
    b.group.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) o.castShadow = true; });
    // pose state
    S.pose = { mode: 'idle', k: 0, strike: -10, reachA: 0, turn: 0, turnK: 0 };
    S.pw = { idle: 1, sweep: 0, lance: 0, turn: 0, reach: 0, kneel: 0, stagger: 0 };
    J.head2 = 0; J.orbit = 0; J.dead = -1;
  }
  const _hp = new V3(), _kq = new THREE.Quaternion(), _kq2 = new THREE.Quaternion(), _kp = new V3(), _ku = new V3(), _ma = new V3();
  // joints per pose: [twist, lean, drop, shRx, shRz, elR, shLx, shLz, elL, headX]
  const POSES = {
    idle: [0, 0, 0, -0.28, -0.3, -0.62, 0.05, 0.22, -0.28, 0.06],
    sweep: [0, 0.08, -0.15, -1.25, -0.25, -0.38, -1.15, 0.65, -0.55, 0.12],
    lance: [0.25, -0.05, 0, -2.7, -0.15, -0.85, 0.35, 0.4, -0.3, -0.05],
    turn: [0, -0.14, 0, -2.55, 0.28, -0.15, -2.55, -0.28, -0.15, -0.3],
    reach: [0, 0.12, 0, -0.28, -0.3, -0.62, -1.5, 0.05, -0.12, 0.15],
    kneel: [0, 0.45, -1.0, -0.25, -1.15, -0.25, -0.25, 1.15, -0.25, 0.6],
    stagger: [0, -0.28, 0, -0.35, -0.95, -0.4, -0.35, 0.95, -0.4, -0.35],
  };
  function poseJanus(S, b, dt) {
    const J = S.J, P = S.pose, w = S.pw, t = G.now;
    for (const k in w) w[k] = damp(w[k], P.mode === k ? 1 : 0, k === 'lance' || k === 'sweep' ? 10 : 6, dt);
    let sum = 0; for (const k in w) sum += w[k];
    const a = new Array(10).fill(0); for (const k in w) { const p = POSES[k], ww = w[k] / Math.max(sum, 1e-4); for (let i = 0; i < 10; i++) a[i] += p[i] * ww; }
    const wn = (k) => w[k] / Math.max(sum, 1e-4);
    // per-action motion on top of the pose
    const st = t - P.strike;
    if (wn('sweep') > 0.01) { const tw = st >= 0 && st < 0.6 ? lerp(1.15, -1.35, smooth(st / 0.22)) : st >= 0.6 ? -1.35 : lerp(0, 1.15, smooth(P.k)); a[0] += tw * wn('sweep'); }
    if (wn('lance') > 0.01 && st >= 0 && st < 0.8) { const k = smooth(st / 0.18); a[3] += 1.6 * k * wn('lance'); a[1] += 0.18 * k * wn('lance'); }
    if (wn('reach') > 0.01) a[0] += clamp(angDiff(b.facing, P.reachA), -0.9, 0.9) * wn('reach');
    a[0] += Math.sin(t * 0.5) * 0.04; a[1] += Math.sin(t * 0.7) * 0.012;
    if (b.stagger > 0 && P.mode !== 'kneel') { a[1] -= 0.2; a[9] -= 0.25; }
    J.torso.rotation.set(a[1], a[0], Math.sin(t * 0.6) * 0.015);
    root_y(J, a[2]);
    J.armR.sh.rotation.set(a[3], 0, a[4]); J.armR.el.rotation.x = a[5]; J.armL.sh.rotation.set(a[6], 0, a[7]); J.armL.el.rotation.x = a[8];
    J.head.rotation.x = a[9];
    // head: the silver face comes round in P2; in P3 the masks lift off and orbit, and a doorway of light shows where the face was
    J.head.rotation.y = PI * J.head2;
    for (const hg of J.halves) {
      if (J.dead >= 0) continue;
      const { m, s } = hg.userData, o = J.orbit;
      if (o < 0.001) { hg.position.set(0, 0, 0); hg.rotation.set(0, 0, 0); continue; }
      const ang = t * 0.9 + m * PI + (s ? 0.06 : -0.06), r = 1.25 * o;
      hg.position.set(Math.sin(ang) * r, 0.25 * o + Math.sin(t * 1.3 + m) * 0.05 * o, Math.cos(ang) * r - (m ? 0 : 0));
      hg.rotation.set(0, ang * o - (m ? PI : 0) * o, 0);
    }
    J.faceL.visible = J.faceB.visible = J.orbit > 0.3 && J.dead < 0; if (J.faceL.visible) { const s = smooth((J.orbit - 0.3) / 0.7); J.faceL.scale.setScalar(s); J.faceB.scale.setScalar(s); }
    J.eyeS.color.setHex(0x9fd0ff).multiplyScalar(0.4 + 0.9 * clamp(J.head2, 0, 1));
    // halo
    const still = wn('kneel'); J.haloA += dt * (0.55 * (1 - still)); const hy = still * -0.6;
    for (let i = 0; i < 8; i++) { const an = J.haloA + i / 8 * TAU; const hr2 = 1.4 + Math.sin(t * 1.1 + i) * 0.04; _o.position.set(Math.sin(an) * hr2, Math.cos(an) * hr2 + hy * (0.5 + 0.5 * Math.sin(i * 2.1)), 0);
      _o.rotation.set(0, 0, -an + still * 0.6 * (i % 2 ? 1 : -1), 'XYZ'); _o.scale.setScalar(S.haloHide && S.haloHide[i] > G.now ? 0.0001 : 1); _o.updateMatrix(); J.hkeys.setMatrixAt(i, _o.matrix); }
    J.hkeys.instanceMatrix.needsUpdate = true;
    // the great key: in the hand, held level for the sweep, raised for the throw, standing in the air for the turn, planted while he kneels
    b.group.updateMatrixWorld(true);
    J.armR.hand.getWorldPosition(_hp); b.group.worldToLocal(_hp);
    let px = 0, py = 0, pz = 0; _kq.set(0, 0, 0, 0); let first = true;
    const put = (wt, x, y, z, ex, ey, ez) => { if (wt < 1e-3) return; px += x * wt; py += y * wt; pz += z * wt; _kq2.setFromEuler(_e.set(ex, ey, ez, 'YXZ')); if (first) { _kq.copy(_kq2); first = false; } else { if (_kq.dot(_kq2) < 0) _kq2.set(-_kq2.x, -_kq2.y, -_kq2.z, -_kq2.w); _kq.x += _kq2.x * wt; _kq.y += _kq2.y * wt; _kq.z += _kq2.z * wt; _kq.w += _kq2.w * wt; } };
    const grip = (wt, g, ex, ey, ez) => { if (wt < 1e-3) return; _ku.set(0, 1, 0).applyEuler(_e.set(ex, ey, ez, 'YXZ')); put(wt, _hp.x - _ku.x * g, _hp.y - _ku.y * g, _hp.z - _ku.z * g, ex, ey, ez); };
    _kq.set(0, 0, 0, 0); first = true;
    grip(wn('idle') + wn('reach') + wn('stagger'), 2.0, 0.06, 0, -0.04);
    { const tw = J.torso.rotation.y; grip(wn('sweep'), 4.2, 0, tw - 0.15, PI / 2); }
    grip(wn('lance'), 3.6, -PI / 2 + 0.15, J.torso.rotation.y, 0);
    put(wn('turn'), 0, 1.3 + Math.sin(t * 2) * 0.05, 2.5, 0, P.turn, 0);
    put(wn('kneel'), 2.3, 0, 0.9, 0, 0.4, 0.2);
    const ql = Math.hypot(_kq.x, _kq.y, _kq.z, _kq.w) || 1; _kq.set(_kq.x / ql, _kq.y / ql, _kq.z / ql, _kq.w / ql);
    if (!S.keyFree) { J.key.position.set(px, py, pz); J.key.quaternion.copy(_kq); }
    // chest light
    const ch = (1 - 0.7 * wn('kneel')) * (1 + 0.6 * wn('turn')) * (S.dead ? Math.max(0, 1 - (G.now - S.deadT) / 1.5) : 1);
    S.chestU.uChest.value = damp(S.chestU.uChest.value, ch, 5, dt); J.light.intensity = 18 * S.chestU.uChest.value;
  }
  function root_y(J, drop) { J.root.position.y = J.rise || 0; J.robe.scale.y = (2.5 + drop) / 2.5; J.torso.position.y = 2.5 + drop; J.halo.position.y = 5.0 + drop; }

  // ---------------------------------------------------------------------------------------------------------------------
  function build(b) {
    const g = G.world, S = b.state;
    S.U = { uTime: { value: 0 }, uSplit: { value: 1 }, uDoors: { value: 0 }, uMosaic: { value: 0 }, uHero: { value: new V3(0, -100, 0) } };
    { const sk = W.sky({ top: 0x6a6a9a, horizon: 0xffd8b0, bottom: 0x8a7a80, sunGlow: 0.6, sunSize: 0.02, sunDir: [0.9, 0.15, -0.35], sunColor: 0xffe0b0 }); W.env(sk, 0.8); sk.geometry.dispose(); sk.material.dispose(); }
    S.hemi = W.hemi(g, 0xffe6cc, 0x8d8ba0, 1.0);
    S.sun = W.sun(g, { dir: [0.75, 0.6, -0.3], color: 0xffe2b8, intensity: 1.9, shadow: false });
    S.heroL = new THREE.PointLight(0xbcd6ff, 0, 7, 1.5); g.add(S.heroL); // P3: a cool light over the hero, so the figure stays lighter than the dark glass and the robe behind
    buildDome(S, g); buildSea(S, g); buildDrift(S, g); buildShafts(S, g); buildFloor(S, g); buildDoors(S, g); buildGates(S, g); buildArcs(S, g); buildWalls(S, g); buildKeys(S, g);
    if (!G.headless) buildOverlay(S, g);
    buildJanus(S, b);
    Object.assign(S, { pairs: Array.from({ length: 5 }, () => ({ shutUntil: 0, sealed: false })), haz: [], mem: {}, hid: 0, tr: null, pg: true, lastExit: -10, rise: -10, trips: 0,
      mechOn: null, mechHit: false, mechSeq: 0, lockout: false, lockAt: 0, deton: -10, hold: false, pairing: 0, lvl: 0, seen: {}, slamSeen: false, ajar: false, lock: null,
      lk: Object.assign({}, LOOK[0]), lkT: Object.assign({}, LOOK[0]), bp: null, lp: null, kf: null, g10: { open: false }, introOn: false, dead: false, deadT: 0, fovOn: false, haloHide: new Array(8).fill(0), hitNames: [], hitTimes: [], shaftSweep: -10, flareT: new Array(NSLOT).fill(-10) });
    setLayout(b, LAYOUT.P1);
    { const s = S.gs[10]; s.x = 0; s.z = 0; s.pair = 0; s.twin = 10; s.on = false; }
    g.addEventListener('removed', () => { Cam.fov = 55; });
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 9 }, bossStart: { x: 0, z: 0, face: 0 }, camDist: 19, camPitch: 0.3,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.6,
      clamp(p) { const d = Math.hypot(p.x, p.z), m = R - 0.6; if (d > m) { p.x *= m / d; p.z *= m / d; } },
      bulletBounds: (x, z) => Math.hypot(x, z) < 26,
      camLimit(x, y, z) { return { x, y: Math.max(y, 0.6), z }; },
    };
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // gates in play
  const LAYOUT_OF = (i, pairing) => i === 0 ? LAYOUT.P1 : i === 1 ? LAYOUT.P2 : pairing ? LAYOUT.P3B : LAYOUT.P3A;
  function setLayout(b, list) {
    const S = b.state;
    for (let i = 0; i < 10; i++) { const g = S.gs[i], q = list[i]; if (q) { g.x = q.x; g.z = q.z; g.pair = q.pair; g.twin = q.twin; g.on = true; } else { g.on = false; g.pair = -1; g.twin = -1; } S.armed[i] = false; S.dw[i] = 0; }
    S.nOn = list.length;
  }
  const pairOpen = (S, p) => p >= 0 && p < 5 && !S.pairs[p].sealed && G.now >= S.pairs[p].shutUntil && !S.hold;
  const gateOpen = (S, i) => i < 10 && S.gs[i].on && pairOpen(S, S.gs[i].pair);
  const solverGates = (S) => S.gs.slice(0, S.nOn).map((g) => ({ x: g.x, z: g.z, pair: g.pair, twin: g.twin }));
  function shutMap(S) { const o = {}; for (let p = 0; p < 5; p++) { const q = S.pairs[p]; if (q.sealed) o[p] = Infinity; else if (S.hold) o[p] = 1e6; else if (q.shutUntil > G.now) o[p] = q.shutUntil - G.now; } return o; }
  const openPairs = (S) => { const s = new Set(); for (let i = 0; i < S.nOn; i++) if (gateOpen(S, i)) s.add(S.gs[i].pair); return s.size; };
  const bell = (n, v = 0.12, oct = 0) => { if (!G.headless) Sound.note(41 + 24 + oct * 12 + [0, 2, 3, 5, 7][((n % 5) + 5) % 5], 'bell', 1.4, v); };
  const clunk = (v = 1) => { if (!G.headless) { Sound.sfx('hit', v, 0.32); Sound.sfx('boom', 0.5 * v, 0.55); } };

  // sweeps in play (absolute times)
  function addHaz(b, h, dmg, name, o = {}) {
    const S = b.state, H = Object.assign({ id: ++S.hid, dmg, name, r0: 22, s0: -22, born: G.now }, h, o); H.t0 = G.now + h.t0; H.end = hzEnd(H);
    S.haz.push(H); S.mem[H.id] = { side: 1, hit: false }; return H;
  }
  function logHit(S, name) { S.hitNames.push(name); S.hitTimes.push(+G.ft.toFixed(1)); } // read by tools/gatesoak.js (god mode hides the damage)
  function hitBy(b, h) {
    const S = b.state, p = G.player; S.mem[h.id].hit = true; S.mechHit = true; logHit(S, h.name);
    const dir = h.k === 'wall' ? Math.atan2(h.dx, h.dz) : h.k === 'in' ? angTo(p.pos.x, p.pos.z, 0, 0) : angTo(0, 0, p.pos.x, p.pos.z);
    p.hurt(h.dmg, { src: { name: h.name }, blockable: false, kb: { dir, dist: 6 } });
    if (!G.headless) { FX.burst(p.pos.x, 1, p.pos.z, { n: 40, color: CRIMSON, color2: 0xffd0c0, speed: [3, 10], life: [0.3, 0.8] }); FX.shake(0.6); Sound.sfx('bigboom', 0.4, 1.3); }
  }
  // the sim, identical headless or not: gate entry, transit, and the wall rule
  function simStep(b, dt) {
    const S = b.state, p = G.player;
    if (S.tr) stepTransit(b, dt);
    else if (p && p.alive && G.state === 'fight' && !S.introOn) checkEntry(b, dt);
    if (p) S.pg = p.grounded;
    // crossing a live sweep any way but through a gate is a hit (walking, Blink, Lunge, a roll, being knocked through)
    if (p && p.alive && !S.tr && G.state === 'fight') for (const h of S.haz) {
      if (G.now < h.t0) continue; const m = S.mem[h.id]; if (m.hit) continue;
      const side = hzF(h, p.pos.x, p.pos.z, G.now) >= 0 ? 1 : -1;
      if (side !== m.side) { m.side = side; hitBy(b, h); }
    }
    for (let i = S.haz.length - 1; i >= 0; i--) if (G.now > S.haz[i].end + 0.7) S.haz.splice(i, 1);
  }
  function checkEntry(b, dt) {
    const S = b.state, p = G.player, landed = p.grounded && !S.pg;
    for (let i = 0; i < 10; i++) {
      const g = S.gs[i]; if (!g.on) continue;
      const d = Math.hypot(p.pos.x - g.x, p.pos.z - g.z);
      if (d > TRIG + 0.2) { S.armed[i] = true; S.dw[i] = 0; continue; }
      if (!gateOpen(S, i)) { if (d <= TRIG) S.armed[i] = false; S.dw[i] = 0; continue; } // standing on a gate as it reopens does not take you through
      if (d > TRIG || p.falling) { S.dw[i] = 0; continue; }
      let go = false;
      if (ENTER === 'walk') go = p.grounded && S.armed[i];
      else if (ENTER === 'jump') go = landed;
      else if (p.grounded && S.armed[i]) { S.dw[i] += dt; go = S.dw[i] >= DWELL; }
      if (go) { enterGate(b, i); return; }
    }
  }
  function enterGate(b, gi) {
    const S = b.state, p = G.player, g = S.gs[gi], tw = S.gs[g.twin], dur = S.lockout ? LOCK_TRANSIT : TRANSIT;
    S.tr = { gi, ti: g.twin, t: 0, dur, fx: g.x, fz: g.z, sx: p.pos.x, sz: p.pos.z, tx: tw.x, tz: tw.z, pair: g.pair, moved: false, lock: !!S.lockout };
    S.pairs[g.pair].shutUntil = G.now + SHUT;
    p.invuln = Math.max(p.invuln, dur); p.rooted = Math.max(p.rooted, dur); p.lockT = Math.max(p.lockT, dur); p.casting = null; p.dash = null; p.kb = null; p.vy = 0; p.grounded = true;
    S.armed[gi] = false; S.armed[g.twin] = false; S.dw.fill(0); S.trips++;
    if (!G.headless) {
      const c = PAIR_HEX[g.pair];
      FX.burst(g.x, 0.4, g.z, { n: 36, color: c, color2: 0xffffff, speed: [1, 5], dir: [0, -1, 0], spread: 0.8, life: [0.3, 0.7], radius: 0.8 });
      FX.ring(g.x, g.z, { r0: 0.4, r1: 4.5, color: c, dur: 0.5, y: 0.06 }); FX.ring(tw.x, tw.z, { r0: 4.5, r1: 0.6, color: c, dur: 0.4, y: 0.06 });
      Sound.sfx('blink', 0.6); bell(g.pair, 0.14); arc(S, 5, g.x, g.z, tw.x, tw.z, c, dur + 0.6, 2.5, 0.28);
    }
  }
  function stepTransit(b, dt) {
    const S = b.state, T = S.tr, p = G.player; T.t += dt;
    if (p) { const rem = Math.max(0, T.dur - T.t); p.rooted = Math.max(p.rooted, rem); p.lockT = Math.max(p.lockT, rem); p.invuln = Math.max(p.invuln, rem); p.casting = null; p.dash = null; p.kb = null; }
    if (!T.moved && T.t >= T.dur * MOVE_AT) moveToTwin(b);
    if (T.t >= T.dur) finishTransit(b);
  }
  function moveToTwin(b) {
    const S = b.state, T = S.tr, p = G.player; T.moved = true; if (!p) return;
    const dx = T.tx - p.pos.x, dz = T.tz - p.pos.z; p.pos.set(T.tx, G.arena ? G.arena.floorY || 0 : 0, T.tz);
    Cam.focus.x += dx; Cam.focus.z += dz; p.group.position.copy(p.pos); // the camera keeps its yaw and pitch: hold W in, keep running out
  }
  function finishTransit(b) {
    const S = b.state, T = S.tr, p = G.player; if (!T) return;
    if (!T.moved) moveToTwin(b);
    S.tr = null; S.lastExit = G.now; S.rise = G.now; S.armed[T.ti] = false;
    if (p) { p.rooted = 0; p.lockT = 0; if (p.invuln < 5) p.invuln = 0; p.group.visible = true;
      for (const h of S.haz) { const m = S.mem[h.id]; m.side = hzF(h, p.pos.x, p.pos.z, G.now) >= 0 ? 1 : -1; } }
    if (!G.headless) { const c = PAIR_HEX[T.pair];
      FX.burst(T.tx, 0.3, T.tz, { n: 46, color: c, color2: 0xffffff, speed: [2, 8], dir: [0, 1, 0], spread: 0.55, life: [0.35, 0.9], radius: 0.6 });
      FX.ring(T.tx, T.tz, { r0: 0.6, r1: 5.5, color: c, dur: 0.55, y: 0.06 }); FX.light(T.tx, 1.5, T.tz, c, 40, 0.4, 12); bell(T.pair, 0.12, 1); }
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // resets and looks
  function resetMech(b, i, o = {}) {
    const S = b.state; if (!S.J) return;
    if (S.tr) finishTransit(b); // a phase change mid-transit still delivers the player to the twin
    S.haz.length = 0; S.mem = {}; S.mechOn = null; S.mechHit = false; S.lockout = false; S.deton = -10; S.bp = null; S.lp = null; S.kf = null; S.falls.length = 0;
    for (const q of S.pairs) { q.shutUntil = 0; q.sealed = false; }
    if (S.lock && S.lock.add && S.lock.add.alive) { const a = S.lock.add; Co.stopTag(a.tag); a.onDeath = null; a.alive = false; }
    S.lock = null; S.lockMesh.visible = false;
    if (o.layout !== false) { setLayout(b, LAYOUT_OF(i, 0)); S.pairing = 0; S.hold = false; } else S.hold = true;
    b.dmgTaken = 1; if (!o.keepImmune) b.immune = false; b.stagger = 0; b.autoFace = true; b.targetable = true; S.ajar = false;
    S.pose.mode = 'idle'; S.pose.turn = 0; S.pose.strike = -10; S.keyFree = false; S.J.fkey.visible = false; S.J.key.visible = true; S.J.dkey.scale.setScalar(0.001); S.haloHide.fill(0);
    S.lkT = Object.assign({}, LOOK[i]); S.lvl = i; S.seen = {};
    if (S.walls) for (const m of S.walls) m.visible = false; if (S.rings) for (const m of S.rings) m.visible = false;
    if (S.fU) { for (const v of S.fU.uWall.value) v.set(0, 0, 0, 0); for (const v of S.fU.uRing.value) v.set(0, 0, 0, 0); S.fU.uLock.value = 0; S.fU.uDeton.value = 0; }
    Cam.fov = 55; S.fovOn = false;
    const p = G.player; if (p) { p.group.visible = true; }
  }
  function applyLook(b, i) { const S = b.state; S.lk = Object.assign({}, LOOK[i]); S.lkT = Object.assign({}, LOOK[i]); S.lvl = i; S.J.head2 = LOOK[i].head >= 1 ? 1 : 0; S.J.orbit = LOOK[i].head === 2 ? 1 : 0; S.leafA = [0, 0.42, 1.85, 1.85][LOOK[i].leaves]; S.tear = LOOK[i].leaves === 3 ? G.now - 60 : -1; }
  const sp = (b) => b.enraged ? 0.7 : 1;
  function* camPath(p0, l0, p1, l1, dur, fov, fn) {
    const c = { pos: new V3(...p0), look: new V3(...l0), fov }; Cam.cine = c; let t = 0;
    while (t < dur) { t += G.dt; const k = smooth(t / dur); c.pos.set(lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k), lerp(p0[2], p1[2], k)); c.look.set(lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k), lerp(l0[2], l1[2], k)); if (fn) fn(sat(t / dur), t); if (Cam.cine !== c) return; yield; }
  }
  function chordToRim(x, z, dir, r = 20.5) { const dx = Math.sin(dir), dz = Math.cos(dir), bq = x * dx + z * dz, c = x * x + z * z - r * r, disc = bq * bq - c; return disc > 0 ? -bq + Math.sqrt(disc) : 0; }
  // the great key in flight: legs of [from, to, seconds, arc height] in world space
  function flyKey(S, legs) { S.kf = { t0: G.now, legs, dur: legs.reduce((a, l) => a + l[2], 0) }; keyTrail(S, legs); }
  // a streak of gold along each long leg of the key's flight, lit as the key passes and fading behind it (arc slots 6-8; 0-4 Rehang, 5 transit)
  function keyTrail(S, legs) {
    if (G.headless) return; let t0 = G.now, slot = 6;
    for (const l of legs) { if (l[2] > 0.2 && slot < 9) { const A = S.arcs[slot]; A.t = t0; A.dur = l[2] + 0.45;
      S.arA.setXYZW(slot, l[0][0], l[0][1], l[0][2], l[3]); S.arB.setXYZW(slot, l[1][0], l[1][1], l[1][2], 0.2); S.arC.setXYZW(slot, 2.4, 1.7, 0.7, 0); slot++; }
      t0 += l[2]; }
    S.arA.needsUpdate = S.arB.needsUpdate = S.arC.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // mechanics
  function* keySweep(b) {
    const S = b.state, ct = 1.1 * sp(b);
    b.autoFace = false; yield* b.turnTo(b.angToPlayer(), 0.25);
    Hz.cone(b.pos.x, b.pos.z, b.facing, 2.4, 8, ct, 300, { name: 'Key Sweep' });
    S.pose.mode = 'sweep'; S.pose.k = 0; S.pose.strike = -10;
    yield* b.cast({ name: 'Key Sweep', time: ct, onTick: (k) => { S.pose.k = k; } });
    S.pose.strike = G.now; if (!G.headless) { Sound.sfx('slash', 1, 0.45); Sound.sfx('dash', 0.6, 0.5); FX.slash(b.pos.x, 2.8, b.pos.z, b.facing, { r: 7, color: 0xffd98a }); }
    yield 0.5; S.pose.mode = 'idle'; b.autoFace = true; yield 0.2;
  }
  // he throws the key into one gate; it comes out of the twin and carries on to the rim
  function lancePick(b, used) {
    const S = b.state, p = G.player; let best = null, bs = 1e9;
    for (let i = 0; i < S.nOn; i++) {
      if (!gateOpen(S, i) || used.has(S.gs[i].pair)) continue; const g = S.gs[i], tw = S.gs[g.twin], dir = angTo(b.pos.x, b.pos.z, g.x, g.z);
      const dx = Math.sin(dir), dz = Math.cos(dir), rx = p.pos.x - tw.x, rz = p.pos.z - tw.z, al = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);
      const s = (al < 0 ? 30 + lat : lat) + rnd(0, 3); if (s < bs) { bs = s; best = i; }
    }
    return best;
  }
  function lanceHz(b, gi, ct, delay) {
    const S = b.state, g = S.gs[gi], tw = S.gs[g.twin], dir = angTo(b.pos.x, b.pos.z, g.x, g.z), len = Math.max(1, Math.hypot(g.x - b.pos.x, g.z - b.pos.z));
    Hz.rect(b.pos.x, b.pos.z, dir, len, 2.4, delay, 320, { name: 'Through-Lance' });
    Hz.rect(tw.x, tw.z, dir, chordToRim(tw.x, tw.z, dir), 2.4, delay, 320, { name: 'Through-Lance', silent: true });
    return { g, tw, dir };
  }
  function* lance(b, n) {
    const S = b.state, used = new Set(), ct = 1.4 * sp(b);
    const gi = lancePick(b, used); if (gi === null) return; used.add(S.gs[gi].pair);
    const L = lanceHz(b, gi, ct, ct);
    b.autoFace = false; yield* b.turnTo(L.dir, 0.2); S.pose.mode = 'lance'; S.pose.strike = -10;
    if (n > 1) Co.start(function* () { yield 0.6; const g2 = lancePick(b, used); if (g2 === null) return; used.add(S.gs[g2].pair); const L2 = lanceHz(b, g2, ct, ct);
      // a halo key takes the second gate
      const k = 7; S.haloHide[k] = G.now + ct + 0.8; S.falls.push({ x: L2.g.x, z: L2.g.z, t0: G.now + ct - 0.25, t1: G.now + ct, from: [b.pos.x, 7.2, b.pos.z], to: [L2.g.x, -2, L2.g.z], out: [L2.tw.x, L2.tw.z, L2.dir], slot: 4 });
    }, 'phase');
    let thrown = false;
    yield* b.cast({ name: 'Through-Lance', time: ct, onTick: (k) => {
      if (!thrown && k > 0.86) { thrown = true; S.pose.strike = G.now; if (!G.headless) Sound.sfx('dash', 0.8, 0.6);
        const hp = S.J.armR.hand.getWorldPosition(new V3()), ex = chordToRim(L.tw.x, L.tw.z, L.dir), rx = L.tw.x + Math.sin(L.dir) * ex, rz = L.tw.z + Math.cos(L.dir) * ex;
        flyKey(S, [[[hp.x, hp.y, hp.z], [L.g.x, 0.3, L.g.z], ct * 0.14 + 0.02, 0.4], [[L.g.x, 0.3, L.g.z], [L.g.x, -3, L.g.z], 0.06, 0], [[L.tw.x, -3, L.tw.z], [L.tw.x, 1.4, L.tw.z], 0.06, 0], [[L.tw.x, 1.4, L.tw.z], [rx, 2.2, rz], 0.28, 0.5], [[rx, 2.2, rz], [b.pos.x + 1.2, 3.2, b.pos.z], 0.75, 6]]); } } });
    if (!G.headless) { Sound.sfx('boom', 0.6, 0.8); bell(S.gs[gi].pair, 0.1); }
    yield 0.4; S.pose.mode = 'idle'; b.autoFace = true; yield 0.3;
  }
  // three to four halo keys drop where the player stands (never over a gate)
  function offGates(S, s, r) {
    for (let it = 0; it < 3; it++) for (let i = 0; i < S.nOn; i++) { const g = S.gs[i], dx = s.x - g.x, dz = s.z - g.z, d = Math.hypot(dx, dz) || 1e-3, need = r + 0.4; if (d < need) { s.x = g.x + dx / d * need; s.z = g.z + dz / d * need; } }
    const rr = Math.hypot(s.x, s.z); if (rr > R - 1) { s.x *= (R - 1) / rr; s.z *= (R - 1) / rr; }
  }
  function* latch(b, n) {
    const S = b.state, p = G.player;
    for (let i = 0; i < n; i++) {
      const ki = (i * 3) % 8; S.haloHide[ki] = G.now + 2.2;
      const h = Hz.circle(p.pos.x, p.pos.z, 2.8, 1.2, 240, { name: 'Latchkey', lock: 0.8, track: (s) => { s.x = G.player.pos.x; s.z = G.player.pos.z; offGates(S, s, 2.8); },
        onFire: (q) => { if (G.headless) return; const s = q.shape; FX.burst(s.x, 0.4, s.z, { n: 26, color: 0xffd98a, color2: CRIMSON, speed: [2, 8], life: [0.3, 0.7], radius: 1.2, up: 2 }); FX.ring(s.x, s.z, { r0: 0.5, r1: 3.2, color: CRIMSON, dur: 0.35 }); Sound.sfx('hit', 0.9, 0.5); Sound.sfx('boom', 0.5, 1.2); FX.shake(0.2); } });
      offGates(S, h.shape, 2.8);
      S.falls.push({ hz: h, t0: G.now + 0.55, t1: G.now + 1.2, slot: i % 4 });
      if (!G.headless) bell(i + 1, 0.06, 1);
      yield 0.5;
    }
  }
  function* draught(b) {
    const S = b.state, list = []; for (let i = 0; i < S.nOn; i++) if (gateOpen(S, i)) list.push(i);
    const pickG = shuffle(list).slice(0, 2);
    for (const gi of pickG) {
      const g = S.gs[gi]; S.flareT[gi] = G.now; if (!G.headless) { Sound.sfx('wave', 0.35, 1.6); bell(g.pair, 0.08); }
      yield 0.6;
      const gap = rnd(TAU); Bul.ring(g.x, g.z, 10, 6, { r: 0.4, dmg: 110, color: CRIMSON, y: 1.0, life: 7, name: 'Draught' }, rnd(TAU), gap, 70 * PI / 180);
      if (!G.headless) { FX.burst(g.x, 0.6, g.z, { n: 30, color: PAIR_HEX[g.pair], speed: [3, 7], dir: [0, 1, 0], spread: 0.7, life: [0.3, 0.7] }); Sound.sfx('boom', 0.4, 1.5); }
      yield 0.2;
    }
    yield 0.6;
  }
  function* deadbolt(b) {
    const S = b.state, p = G.player, pairs = [];
    for (let i = 0; i < S.nOn; i++) if (gateOpen(S, i) && pairs.indexOf(S.gs[i].pair) < 0) pairs.push(S.gs[i].pair);
    if (!pairs.length) return;
    const pr = pick(pairs); let gi = -1, gd = 1e9; for (let i = 0; i < S.nOn; i++) { const g = S.gs[i]; if (g.pair !== pr) continue; const d = Math.hypot(g.x - b.pos.x, g.z - b.pos.z); if (d < gd) { gd = d; gi = i; } }
    const g = S.gs[gi]; S.pose.mode = 'reach'; S.pose.reachA = angTo(b.pos.x, b.pos.z, g.x, g.z); S.J.dkey.scale.setScalar(1);
    const r = yield* b.cast({ name: 'Deadbolt', time: 3.0, interruptible: true, onTick: (k) => { if (!G.headless && Math.floor(k * 6) !== S.dbk) { S.dbk = Math.floor(k * 6); Sound.sfx('tick', 0.5, 0.6 + k * 0.4); } } });
    S.J.dkey.scale.setScalar(0.001);
    if (r === 'done' && G.state === 'fight') { padlock(b, pr, gi); clunk(1); }
    else if (r === 'interrupted') { b.stagger = 2.5; S.pose.mode = 'stagger'; yield 2.5; }
    S.pose.mode = 'idle';
  }
  function padlock(b, pair, gi) {
    const S = b.state, g = S.gs[gi]; S.pairs[pair].sealed = true;
    const a = b.spawnAdd({ name: 'Padlock', hp: 420, x: g.x, z: g.z, radius: 0.9, aimY: 1.0, mesh: S.lockMesh, color: PAIR_HEX[pair],
      *run(e) { yield 20; if (e.alive) e.die(); },
      onDeath: () => { S.pairs[pair].sealed = false; S.lockMesh.visible = false; if (S.lock && S.lock.add === a) S.lock = null; bell(pair, 0.14, 1); } });
    S.lockMesh.visible = true; S.lockMesh.position.set(0, 0, 0); S.lockMesh.rotation.set(0, angTo(g.x, g.z, 0, 0), 0); S.lockHole.material.color.setHex(PAIR_HEX[pair]).multiplyScalar(2.5);
    S.lock = { add: a, pair, gi };
    if (!G.headless) { FX.burst(g.x, 1, g.z, { n: 30, color: 0xffd98a, speed: [2, 7], life: [0.3, 0.7] }); FX.shake(0.25); }
  }
  function* ajar(b) {
    const S = b.state; S.ajar = true; S.pose.mode = 'kneel'; b.autoFace = false; b.dmgTaken = 1.3; if (!G.headless) { Sound.sfx('boom', 0.4, 0.5); Sound.note(53, 'organ', 2.5, 0.06); }
    yield 4; S.ajar = false; S.pose.mode = 'idle'; b.dmgTaken = 1; b.autoFace = true; yield 0.6;
  }
  const WANT = { slam: 1, iris: 1, doors: 2, rebound: 2, triptych: 3 };
  const BASE = { slam: 2.6, iris: 2.4, doors: 2.6, rebound: 2.4, triptych: 2.4 };
  const NAME = { slam: 'Slam', iris: 'Iris', doors: 'Double Doors', rebound: 'Iris Rebound', triptych: 'Triptych' };
  const DMG = { slam: 550, iris: 550, doors: 500, rebound: 500, triptych: 450 };
  // a gate mechanic: the Key Turn, then sweeps that only a gate gets you past. Always a variant the solver can beat from where you stand.
  function* gateMech(b, kind) {
    const S = b.state, p = G.player;
    let ct = BASE[kind];
    if (kind === 'slam' && !S.slamSeen) ct = 3.4; else if (kind !== 'slam' && !S.seen[kind]) ct += 0.6;
    if (b.enraged) ct *= 0.7;
    const o = { gates: solverGates(S), x: p.pos.x, z: p.pos.z, t: 0.5, shut: shutMap(S), mode: ENTER, v: 5.8, m: 0.6, maxTrips: 3, budget: 3000 };
    const first = kind === 'slam' && !S.slamSeen;
    const near = first ? (c) => { const g = S.gs[c.plan.trips[0].g]; return Math.hypot(g.x - p.pos.x, g.z - p.pos.z); } : null;
    let pk = pickVariant(VARIANTS[kind](ct), o, WANT[kind], G.rng, near);
    if (!pk && kind !== 'slam') { kind = 'slam'; ct = Math.max(ct, 2.6 * sp(b)); pk = pickVariant(VARIANTS.slam(ct), o, 1, G.rng); }
    if (!pk) { yield 1; return; }
    S.seen[kind] = 1; if (kind === 'slam') S.slamSeen = true;
    const name = kind === 'rebound' ? 'Iris' : NAME[kind];
    pk.haz.forEach((h, i) => addHaz(b, h, DMG[kind], kind === 'rebound' && i === 1 ? 'Rebound' : name, { ghost: h.t0 > ct + 0.01 }));
    S.mechOn = kind; S.mechHit = false; S.mechSeq++;
    b.autoFace = false; S.pose.mode = 'turn'; S.pose.turn = 0;
    if (!G.headless) Co.start(function* () { for (let i = 0; i < 12; i++) { Sound.sfx('tick', 0.55, 0.35 + vrand() * 0.3); yield 0.06; } }, 'phase');
    let turned = false;
    yield* b.cast({ name: NAME[kind], time: ct, onTick: (k) => { S.pose.k = k; if (!turned && k > 0.9) { turned = true; S.pose.turn = PI / 2; clunk(1); if (!G.headless) FX.shake(0.3); } } });
    if (!G.headless) { Sound.sfx('roar', 0.4, 0.5); FX.shake(0.4); }
    yield 0.5; S.pose.mode = 'idle'; b.autoFace = true;
    yield () => S.haz.every((h) => G.now > h.end);
    S.mechOn = null; S.bp = null;
    if (!S.mechHit) yield* ajar(b);
    if (b.enraged) yield* lockout(b);
  }
  // Lockout: four tolls; on the fourth the whole floor goes off. Be between gates when it does.
  function* lockout(b) {
    const S = b.state; if (openPairs(S) < 2) return;
    const ct = 4.0 * sp(b); S.lockout = true; S.lockAt = G.now + ct; S.mechOn = 'lockout'; S.mechSeq++; S.mechHit = false;
    b.autoFace = false; S.pose.mode = 'turn'; S.pose.turn = 0; let tolls = 0;
    const toll = (n) => { if (G.headless) return; Sound.sfx('bell', 0.9, n === 4 ? 0.5 : 0.7); FX.shake(0.15 + n * 0.08); };
    const res = yield* b.cast({ name: 'Lockout', time: ct, onTick: (k) => { const n = Math.floor(k * 4 + 1e-6); while (tolls < n && tolls < 3) toll(++tolls); } });
    if (res !== 'done' || !b.alive) { S.lockout = false; S.mechOn = null; S.lp = null; return; }
    toll(4); S.deton = G.now;
    const p = G.player; if (p && p.alive && !S.tr && G.state === 'fight') { p.hurt(650, { src: { name: 'Lockout' }, blockable: false }); S.mechHit = true; logHit(S, 'Lockout'); }
    if (!G.headless) { Sound.sfx('bigboom', 1); FX.shake(0.9); FX.flash(CRIMSON, 0.25, 2.5); }
    S.lockout = false; S.mechOn = null; S.lp = null; S.pose.turn = PI / 2; yield 0.6; S.pose.mode = 'idle'; b.autoFace = true; yield 0.4;
  }
  // Rehang: the pairs rewire between pairing A and B
  function* rehang(b) {
    const S = b.state; S.pose.mode = 'turn'; S.pose.turn = 0; b.autoFace = false;
    yield* b.cast({ name: 'Rehang', time: 1.5, onTick: (k) => { S.pose.k = k; } });
    S.pairing ^= 1; const L = LAYOUT_OF(2, S.pairing);
    for (let i = 0; i < 10; i++) { const g = S.gs[i], q = L[i]; g.pair = q.pair; g.twin = q.twin; S.armed[i] = false; }
    clunk(0.8); S.pose.turn = PI / 2;
    if (!G.headless) for (let pr = 0; pr < 5; pr++) { const i = pr, tw = S.gs[S.gs[i].twin]; arc(S, pr, S.gs[i].x, S.gs[i].z, tw.x, tw.z, PAIR_HEX[pr], 1.8, 3.5, 0.32); bell(pr, 0.07); }
    yield 0.6; S.pose.mode = 'idle'; b.autoFace = true;
  }
  // gates close, move to the new layout, and reopen one pair at a time with a chime
  function* rehung(b, list, gap = 0.45) {
    const S = b.state; S.hold = true; yield 1.0;
    setLayout(b, list); const n = new Set(list.map((g) => g.pair)).size;
    for (const q of S.pairs) q.shutUntil = G.now + 99; S.hold = false;
    for (let pr = 0; pr < n; pr++) { yield gap; S.pairs[pr].shutUntil = 0; bell(pr, 0.12); }
  }
  function* toP2(b) {
    const S = b.state; resetMech(b, 1, { layout: false, keepImmune: true }); b.autoFace = false;
    S.lkT = Object.assign({}, LOOK[0], { head: 1 }); S.pose.mode = 'turn'; S.pose.turn = 0;
    if (!G.headless) Sound.sfx('roar', 0.5, 0.6);
    yield 1.4;
    S.pose.turn = PI / 2; clunk(1.2); if (!G.headless) { FX.shake(0.6); Sound.sfx('bigboom', 0.6); }
    S.lkT = Object.assign({}, LOOK[1]); S.shaftSweep = G.now; Co.start(Post.lerpTo(PG[1], 3), 'fight'); Music.intensity(1);
    yield* rehung(b, LAYOUT.P2, 0.4);
    S.pose.mode = 'idle'; b.autoFace = true; yield 0.4;
  }
  function* toP3(b) {
    const S = b.state; resetMech(b, 2, { layout: false, keepImmune: true }); b.autoFace = false;
    S.pose.mode = 'turn'; S.pose.turn = 0; S.lkT = Object.assign({}, LOOK[1], { head: 2 });
    if (!G.headless) { Sound.sfx('roar', 0.7, 0.5); Sound.sfx('wave', 0.6, 0.8); }
    yield 1.3;
    S.tear = G.now; S.lkT = Object.assign({}, LOOK[2]); clunk(1.2); if (!G.headless) { FX.shake(0.8); Sound.sfx('bigboom', 0.8); FX.flash(0xfff0d8, 0.25, 2); }
    Co.start(Post.lerpTo(PG[2], 3), 'fight'); Music.intensity(2);
    yield 0.6;
    yield* rehung(b, LAYOUT.P3A, 0.35);
    S.pose.mode = 'idle'; b.autoFace = true; yield 0.5;
  }
  function finishIntro(b) { const S = b.state; S.introOn = false; S.J.rise = 0; S.gs[10].on = false; S.g10.open = false; S.kf = null; Cam.fov = 55; }

  // ---------------------------------------------------------------------------------------------------------------------
  // cosmetics, every rendered frame
  const SEA = [[0x3a2a40, 0xf0b890, 0x9a7480], [0x03141a, 0x5a96a2, 0x0c2a34], [0x140c20, 0x5a3a7a, 0x281c38]];
  const _ca = new THREE.Color(), _cb = new THREE.Color();
  function lookStep(S, b, dt) {
    const lk = S.lk, lt = S.lkT, U = S.U;
    lk.split = damp(lk.split, lt.split, 1.2, dt); lk.doors = damp(lk.doors, lt.doors, 1.0, dt); lk.gloss = damp(lk.gloss, lt.gloss, 1.1, dt);
    lk.mosaic = lt.mosaic > lk.mosaic ? Math.min(lt.mosaic, lk.mosaic + dt / 3) : damp(lk.mosaic, lt.mosaic, 3, dt);
    const sw = G.now - S.shaftSweep, sweeping = sw >= 0 && sw < 3.5;
    lk.shaft = damp(lk.shaft, sweeping ? 1 : lt.shaft, 2, dt);
    U.uSplit.value = lk.split; U.uDoors.value = lk.doors; U.uMosaic.value = lk.mosaic;
    S.fU.uGloss.value = lk.gloss; S.fU.uShaft.value = lk.shaft; S.fU.uShaftA.value = sweeping ? sw / 3.5 * 3 : 0;
    S.drift.visible = lk.doors > 0.01 && lk.mosaic < 0.99; S.shafts.visible = lk.shaft > 0.01 && lk.mosaic < 0.5; S.shU.uSh.value = Math.min(1, lk.shaft * 2.4) * (1 - lk.mosaic); S.shU.uShA.value = S.fU.uShaftA.value;
    // the leaves: shut, ajar, thrown open, torn off
    const la = [0, 0.42, 1.85, 1.85][lt.leaves];
    S.leafA = damp(S.leafA, la, lt.leaves >= 2 && S.leafA < 1.6 ? 1.6 : 2.2, dt);
    poseLeaves(S);
    // the head turns, the masks lift
    const J = S.J; J.head2 = lt.head >= 1 ? Math.min(1, J.head2 + dt / 1.2) : Math.max(0, J.head2 - dt / 1.2); J.orbit = damp(J.orbit, lt.head === 2 ? 1 : 0, 1.4, dt);
    S.chestU.uCW.value = S.lvl === 0 ? 1 : S.lvl === 1 ? 4 : Math.floor(G.now / 3.5) % 5;
    // the cloud sea and the lights follow the sky
    const w = [lk.split * (1 - lk.doors), lk.doors * (1 - lk.mosaic), lk.mosaic]; const ws = w[0] + w[1] + w[2] || 1;
    for (let k = 0; k < 3; k++) { _ca.setRGB(0, 0, 0); for (let i = 0; i < 3; i++) _ca.add(_cb.setHex(SEA[i][k]).multiplyScalar(w[i] / ws)); [S.seaU.uSeaA, S.seaU.uSeaB, S.seaU.uSeaH][k].value.copy(_ca); }
    S.hazeU.uHz.value.copy(S.seaU.uSeaH.value);
    S.sun.intensity = 1.9 * w[0] / ws + 1.1 * w[1] / ws + 1.5 * w[2] / ws; S.sun.color.setHex(0xffe2b8).lerp(_ca.setHex(0xb8d8e8), w[1] / ws);
    S.hemi.intensity = 1.0 * w[0] / ws + 0.75 * w[1] / ws + 0.9 * w[2] / ws;
  }
  function gateVisuals(S, b, dt) {
    const fu = S.fU, t = G.now;
    for (let i = 0; i < NSLOT; i++) {
      const g = S.gs[i], on = i === 10 ? S.g10.open || g.vis > 0.01 : g.on, open = i === 10 ? S.g10.open : gateOpen(S, i);
      if (i === 10) g.on = S.g10.on;
      g.vis = damp(g.vis, open ? 1 : 0, open ? 4.5 : 7, dt);
      const pr = Math.max(0, g.pair), white = S.lockout && open ? 1 : 0; g.white = damp(g.white, white, 6, dt);
      const fill = ENTER === 'dwell' ? S.dw[i] / DWELL : 0, show = (i === 10 ? S.g10.on : g.on) ? 1 : 0, fl = sat(1 - (t - S.flareT[i]) / 0.8);
      S.gA.setXYZW(i, pr, g.white, g.vis * show, fill); _c.setHex(PAIR_HEX[pr]); S.gC.setXYZ(i, _c.r * (1 + fl * 2), _c.g * (1 + fl * 2), _c.b * (1 + fl * 2));
      _m4.makeTranslation(g.x, 0, g.z); if (!show) _m4.scale(_s.set(0.0001, 0.0001, 0.0001));
      for (const m of [S.gInt, S.gShaft, S.gRim, S.gLine, S.gGlow, S.gBeacon]) m.setMatrixAt(i, _m4);
      _ca.setHex(PAIR_HEX[pr]).lerp(_cb.setRGB(1, 1, 1), g.white * 0.35).multiplyScalar(1.1 + 1.6 * g.vis); S.gLine.setColorAt(i, _ca); // shut gates keep a faint ring of their pair colour
      for (let j = 0; j < 10; j++) { const a = j / 10 * TAU, o = g.vis; _o.position.set(g.x + Math.sin(a + o * 0.55) * o * 2.15, -j * 0.0025, g.z + Math.cos(a + o * 0.55) * o * 2.15); _o.rotation.set(0, a + o * 0.55, 0.012, 'YXZ'); _o.scale.setScalar(show ? 1 : 0.0001); _o.updateMatrix(); S.gIris.setMatrixAt(i * 10 + j, _o.matrix); }
      for (let j = 0; j < 5; j++) { const ok = show && j <= pr && i !== 10, a = angTo(g.x, g.z, 0, 0) + (j - pr / 2) * 0.32; _o.position.set(g.x + Math.sin(a) * (GATE_R + 0.14), 0.2, g.z + Math.cos(a) * (GATE_R + 0.14)); _o.rotation.set(0, 0, 0); _o.scale.setScalar(ok ? 1 : 0.0001); _o.updateMatrix(); S.gPip.setMatrixAt(i * 5 + j, _o.matrix); S.gPip.setColorAt(i * 5 + j, _ca.setHex(PAIR_HEX[pr]).multiplyScalar(0.7 + 1.5 * g.vis));
        _o.position.y = 0.17; _o.updateMatrix(); S.gPipC.setMatrixAt(i * 5 + j, _o.matrix); }
      fu.uGate.value[i].set(g.x, g.z, show ? GATE_R : 0, 0); _c.setHex(PAIR_HEX[pr]).lerp(_cb.setRGB(1, 1, 1), g.white * 0.35); fu.uGCol.value[i].set(_c.r, _c.g, _c.b, g.vis * show * (1 + fl));
    }
    for (const m of [S.gInt, S.gShaft, S.gRim, S.gLine, S.gGlow, S.gBeacon, S.gIris, S.gPip, S.gPipC]) m.instanceMatrix.needsUpdate = true;
    S.gLine.instanceColor.needsUpdate = true; S.gPip.instanceColor.needsUpdate = true; S.gA.needsUpdate = true; S.gC.needsUpdate = true;
  }
  function hazVisuals(S, b, dt) {
    const p = G.player, fu = S.fU, t = G.now; let wi = 0, ri = 0;
    for (const m of S.walls) m.visible = false; for (const m of S.rings) m.visible = false;
    for (const v of fu.uWall.value) v.set(0, 0, 0, 0); for (const v of fu.uRing.value) v.set(0, 0, 0, 0);
    for (const h of S.haz) {
      const live = t >= h.t0, e = Math.max(0, t - h.t0), rise = smooth((t - h.born) / 1.3), endK = 1 - sat((t - h.end) / 0.5), act = t < h.end ? 1 : 0;
      if (h.k === 'wall' && wi < 3) {
        const s = h.s0 + h.u * e, m = S.walls[wi], U = m.material.uniforms;
        m.visible = endK > 0.001; m.position.set(h.dx * s, lerp(-17, 0, rise) - (1 - endK) * 4, h.dz * s); m.rotation.y = Math.atan2(h.dx, h.dz);
        U.uA.value = rise * endK; U.uGhost.value = !live && h.ghost ? 1 : 0; U.uLive.value = live ? 1 : 0.35 + 0.25 * Math.sin(t * 8); if (p) U.uPP.value.set(p.pos.x, p.pos.y + 1, p.pos.z); U.uJP.value.set(b.pos.x, 3.8, b.pos.z);
        fu.uWall.value[wi].set(h.dx, h.dz, s, (live ? 1 : h.ghost ? 0.3 : 1) * act);
        if (live && !h.slammed && s > 20.6) { h.slammed = true; Sound.sfx('bigboom', 0.5); Sound.sfx('hit', 0.9, 0.3); FX.shake(0.3); }
        wi++;
      } else if (h.k !== 'wall' && ri < 2) {
        const r = h.k === 'in' ? Math.max(0, h.r0 - h.u * e) : live ? h.u * e : 0, m = S.rings[ri], U = m.material.uniforms, pre = h.k === 'out' && !live;
        m.visible = endK > 0.001 && r > 0.15; m.scale.set(Math.max(r, 0.01), 1, Math.max(r, 0.01)); m.position.set(0, h.k === 'in' ? lerp(-17, 0, rise) - (1 - endK) * 4 : -(1 - endK) * 4, 0);
        U.uRad.value = Math.max(r, 0.5); U.uA.value = (h.k === 'in' ? rise : 1) * endK * sat(r / 1.2); U.uGhost.value = 0; U.uLive.value = live ? 1 : 0.35 + 0.25 * Math.sin(t * 8); if (p) U.uPP.value.set(p.pos.x, p.pos.y + 1, p.pos.z); U.uJP.value.set(b.pos.x, 3.8, b.pos.z);
        const wv = pre ? (t > h.t0 - 0.9 ? 1 : 0) : 1;
        fu.uRing.value[ri].set(r, h.k === 'in' ? 1 : -1, wv * act, 0);
        if (h.k === 'in' && live && !h.slammed && r < 0.5) { h.slammed = true; Sound.sfx('bigboom', 0.6); FX.shake(0.45); FX.burst(0, 1, 0, { n: 40, color: 0xffd98a, color2: CRIMSON, speed: [3, 12], life: [0.4, 0.9] }); }
        ri++;
      }
    }
    // Lockout: the seams fill, then the floor goes off
    fu.uLock.value = S.lockout ? sat(1 - (S.lockAt - t) / 4) : damp(fu.uLock.value, 0, 6, dt);
    fu.uDeton.value = sat(1 - (t - S.deton) / 0.7) * 0.85;
  }
  function keyStep(S, b, dt) {
    const J = S.J, t = G.now;
    // the great key in flight
    J.key.visible = !S.kf && !S.keyPlant; J.fkey.visible = !!S.kf || !!S.keyPlant;
    if (S.kf) {
      let el = t - S.kf.t0; if (el >= S.kf.dur) { S.kf = null; J.key.visible = true; J.fkey.visible = !!S.keyPlant; }
      else { let L = null; for (const l of S.kf.legs) { if (el <= l[2]) { L = l; break; } el -= l[2]; }
        const k = sat(el / L[2]), a = L[0], c = L[1]; _v.set(lerp(a[0], c[0], k), lerp(a[1], c[1], k) + Math.sin(k * PI) * L[3], lerp(a[2], c[2], k));
        _w.set(c[0] - a[0], c[1] - a[1] + Math.cos(k * PI) * L[3] * PI, c[2] - a[2]); if (_w.lengthSq() < 1e-6) _w.set(0, -1, 0); _w.normalize().negate();
        b.group.worldToLocal(_v); J.fkey.position.copy(_v); _ma.copy(_w).transformDirection(_m4.copy(b.group.matrixWorld).invert()); J.fkey.quaternion.setFromUnitVectors(_Y, _ma);
        J.fkey.position.addScaledVector(_ma, -2.5); } // centre the key on its path
    }
    if (S.keyPlant) { _v.copy(S.keyPlant); b.group.worldToLocal(_v); J.fkey.position.copy(_v); J.fkey.quaternion.identity(); }
    // halo keys dropping: Latchkeys, and the second Through-Lance
    let n = 0;
    for (let i = S.falls.length - 1; i >= 0; i--) {
      const f = S.falls[i]; if (t > f.t1 + 0.45) { S.falls.splice(i, 1); continue; }
      if (t < f.t0 || n >= 6) continue;
      const k = sat((t - f.t0) / (f.t1 - f.t0)); let x, y, z, rx = PI, ry = 0;
      if (f.hz) { const s = f.hz.shape; x = s.x; z = s.z; y = t > f.t1 ? 0.5 - Math.min(0.5, (t - f.t1) * 2) : lerp(16, 0.5, k * k); ry = t * 3; }
      else if (t <= f.t1) { x = lerp(f.from[0], f.to[0], k); y = lerp(f.from[1], f.to[1], k) + Math.sin(k * PI) * 3; z = lerp(f.from[2], f.to[2], k); rx = PI * 0.5; ry = f.out[2]; }
      else { const k2 = sat((t - f.t1) / 0.45); x = f.out[0] + Math.sin(f.out[2]) * k2 * 9; z = f.out[1] + Math.cos(f.out[2]) * k2 * 9; y = lerp(-1, 2, sat(k2 * 3)); rx = PI * 0.5; ry = f.out[2]; }
      _o.position.set(x, y, z); _o.rotation.set(rx, ry, 0, 'YXZ'); _o.scale.setScalar(1); _o.updateMatrix(); S.fKeys.setMatrixAt(n++, _o.matrix);
    }
    for (let i = n; i < 6; i++) S.fKeys.setMatrixAt(i, _m4.makeScale(0, 0, 0));
    S.fKeys.instanceMatrix.needsUpdate = true;
  }
  function heroStep(S, b, dt) {
    const p = G.player; if (!p) return;
    let off = 0, vis = true;
    if (S.tr) { const T = S.tr; if (!T.moved && T.t < 0.16) { const k = smooth(T.t / 0.16); off = -k * 1.9; p.group.position.x = lerp(T.sx, T.fx, k * 0.8); p.group.position.z = lerp(T.sz, T.fz, k * 0.8); } else vis = false; }
    else if (G.now - S.rise < 0.3) off = -1.7 * (1 - smooth((G.now - S.rise) / 0.3));
    p.group.visible = vis; p.group.position.y = p.pos.y + off;
    // the transit tunnel and a small FOV punch
    const O = S.overlay; if (O) {
      if (S.tr) { const T = S.tr, k = T.t / T.dur; O.visible = true; renderer.getDrawingBufferSize(S.ovU.uRes.value);
        S.ovU.uK.value = smooth(k / 0.22) * (1 - smooth((k - 0.78) / 0.22)); S.ovU.uT.value = T.t; S.ovU.uP.value = sat(k); S.ovU.uOW.value = T.pair; S.ovU.uOC.value.setHex(PAIR_HEX[T.pair]); S.ovU.uLockO.value = T.lock ? 1 : 0;
        Cam.fov = 55 + Math.sin(sat(k) * PI) * 11; S.fovOn = true; }
      else { O.visible = false; if (S.fovOn) { Cam.fov = 55; S.fovOn = false; } }
    }
    S.U.uHero.value.set(p.pos.x, p.pos.y + 1.0, p.pos.z);
    S.heroL.intensity = 16 * S.lk.gloss * (p.alive && vis ? 1 : 0); if (S.heroL.intensity > 0) { _v.set(camera.position.x - p.pos.x, 0, camera.position.z - p.pos.z).normalize(); S.heroL.position.set(p.pos.x + _v.x * 1.1, p.pos.y + 2.7, p.pos.z + _v.z * 1.1); }
    const bl = S.fU.uBlob.value; bl[0].set(p.pos.x, p.pos.z, 1.0, p.alive && vis ? 0.55 : 0); bl[1].set(b.pos.x, b.pos.z, 2.6, S.J.rise > -1 ? 0.6 : 0);
  }
  function arcStep(S) {
    for (let i = 0; i < S.arcs.length; i++) { const A = S.arcs[i], k = (G.now - A.t) / A.dur; const a = k < 0 || k > 1 ? 0 : Math.sin(k * PI) * (i === 5 ? 1 : 0.9); S.arC.setW(i, a); }
    S.arC.needsUpdate = true;
  }

  G.bosses.push({
    id: 'portal', name: 'JANUS', title: 'The Space Between', hint: 'Mind the gap', color: '#ffd04a', telegraph: CRIMSON,
    hp: 26000, radius: 1.9, aimY: 3.0, enrage: 420, botSaveInterrupt: true,
    post: PG[0],
    music: { bpm: 100, root: 41, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 0, 3, 4, 0, 0, 5, 4],
      layers: [
        { v: 'bell', pat: '0.......4.......', oct: 1, len: 8, vol: 0.07 },
        { v: 'organ', pat: ['0...............', '3...............'], len: 16, vol: 0.07 },
        { v: 'sub', pat: '0.......0.......', oct: -1, vol: 0.15 },
        { v: 'arp', pat: '0.2.4.2.0.2.4.2.', oct: 2, vol: 0.04 },
        { v: 'kick', from: 1, pat: 'x...x...x...x...', vol: 0.24 },
        { v: 'hat', from: 1, pat: '..x...x...x...x.', vol: 0.06 },
        { v: 'bass', from: 1, pat: '0..0..3...0..4..', oct: -1, vol: 0.13 },
        { v: 'pulse', from: 1, pat: '0.4.2.4.0.4.5.4.', oct: 1, vol: 0.05 },
        { v: 'choir', from: 2, pat: '0.......5.......', len: 8, vol: 0.08 },
        { v: 'brass', from: 2, pat: ['0.......3.......', '4.......5.......'], len: 7, vol: 0.1 },
        { v: 'taiko', from: 2, pat: 'x..x..x.x..x.xx.', vol: 0.22 },
        { v: 'arp', from: 2, pat: '0242302402423024', oct: 2, len: 1, vol: 0.05 },
      ] },
    build,
    *intro(b) {
      const S = b.state, J = S.J; S.introOn = true; J.rise = -8; S.g10.on = true; S.g10.open = false; const c = S.gs[10]; c.x = 0; c.z = 0; c.pair = 0;
      // 1: the hall over the cloud sea, twelve doors on the horizon, dawn and night overhead
      yield* camPath([3, 8.5, 29], [0, 8, -30], [0, 5.8, 23], [0, 8.5, -30], 3.0, 54, (k) => { if (k > 0.5) S.g10.open = true; });
      UI.hideCard();
      // 2: low over a gate full of stars
      yield* camPath([-16.5, 2.7, -7.5], [-10, -0.8, -10], [-7.5, 2.2, -16.5], [-10, -0.8, -10], 2.6, 54);
      // 3: Janus rises out of a gate at the centre, drops his key into the gold gate, and catches it as it shoots out of the gold twin
      let thrown = false, shut = false;
      yield* camPath([23, 5.5, 5], [0, 3.6, 0], [21, 7.2, -3], [0, 3.8, -1], 4.4, 54, (k, t) => {
        J.rise = -8 * (1 - smooth(t / 1.4)); if (t < 1.4 && !G.headless && Math.random() < 0.3) FX.burst(0, 0.2, 0, { n: 3, color: 0xffd04a, speed: [1, 4], dir: [0, 1, 0], spread: 0.6, life: [0.4, 0.9], radius: 1.4 });
        if (!shut && t > 1.5) { shut = true; S.g10.open = false; clunk(0.8); bell(0, 0.12); }
        if (!thrown && t > 1.8) { thrown = true; S.pose.strike = G.now; const hp = J.armR.hand.getWorldPosition(new V3());
          flyKey(S, [[[hp.x, hp.y, hp.z], [0, 0.3, -14], 0.55, 2.5], [[0, 0.3, -14], [0, -3, -14], 0.08, 0], [[0, -3, 14], [0, 3, 14], 0.12, 0], [[0, 3, 14], [1.4, 3.2, 0.6], 1.1, 5]]);
          if (!G.headless) { Sound.sfx('dash', 0.8, 0.6); Co.start(function* () { yield 0.62; bell(0, 0.14); FX.burst(0, 0.4, -14, { n: 30, color: 0xffd04a, speed: [1, 5], life: [0.3, 0.7] }); yield 0.1; FX.burst(0, 0.5, 14, { n: 40, color: 0xffd04a, color2: 0xffffff, speed: [2, 8], dir: [0, 1, 0], spread: 0.5, life: [0.4, 0.9] }); bell(0, 0.12, 1); yield 1.1; clunk(0.6); }, 'sys'); } }
        S.pose.mode = t > 1.6 && t < 2.2 ? 'lance' : 'idle';
      });
      S.pose.mode = 'idle'; finishIntro(b);
    },
    *death(b) {
      const S = b.state, J = S.J; S.dead = true; S.deadT = G.now; J.dead = G.now; S.pose.mode = 'kneel'; b.autoFace = false; Sound.sfx('bell', 0.8, 0.5);
      S.haz.length = 0; S.lockout = false; S.kf = null;
      // the masks drop and crack
      for (const hg of J.halves) { b.group.attach(hg); hg.userData.vy = 0; hg.userData.land = false; hg.userData.vx = (hg.userData.s ? 1 : -1) * 0.6; }
      const c0 = camera.position.clone(), l0 = new V3(b.pos.x, 3.5, b.pos.z), dir = angTo(b.pos.x, b.pos.z, c0.x, c0.z), c1 = new V3(b.pos.x + Math.sin(dir) * 15, 6.5, b.pos.z + Math.cos(dir) * 15), l1 = new V3(b.pos.x, 2.0, b.pos.z);
      const cine = { pos: c0.clone(), look: l0.clone(), fov: 50 }; Cam.cine = cine; let t = 0, opened = false, planted = false, shut = false;
      const g = S.gs[10];
      while (t < 6.0) {
        const rdt = G.dt / Math.max(G.timeScale, 0.05); t += rdt; if (t > 0.5) G.timeScale = 1;
        const k = smooth(t / 4.5); cine.pos.lerpVectors(c0, c1, k); cine.look.lerpVectors(l0, l1, k);
        // the rim doors go dark one by one, all the way round
        for (let i = 0; i < NDOOR; i++) S.doorDark[i] = sat((t - 0.8 - i * 0.18) / 0.4);
        if (!planted && t > 1.6) { planted = true; S.keyPlant = new V3(b.pos.x + Math.sin(b.facing) * 2.4, 0, b.pos.z + Math.cos(b.facing) * 2.4); if (!G.headless) { clunk(1); FX.burst(S.keyPlant.x, 0.3, S.keyPlant.z, { n: 30, color: 0xffd98a, speed: [2, 6], life: [0.3, 0.7] }); } }
        if (!opened && t > 2.0) { opened = true; g.x = b.pos.x; g.z = b.pos.z; g.pair = 2; S.g10.on = true; S.g10.open = true; bell(2, 0.14); }
        if (t > 2.4) J.rise = -8 * smooth((t - 2.4) / 2.0);
        if (!shut && t > 4.6) { shut = true; S.g10.open = false; clunk(1); bell(2, 0.1, 1); }
        yield;
      }
    },
    phases: [
      { at: 1, *run(b) {
        resetMech(b, 0); yield 1.0;
        while (true) {
          yield* keySweep(b); yield 1.0; yield* lance(b, 1); yield 2.0;
          yield* gateMech(b, 'slam');
          yield* latch(b, 3); yield 0.7; yield* keySweep(b); yield* deadbolt(b); yield 2.0;
          yield* gateMech(b, 'slam');
        }
      } },
      { at: 0.68, skipTo(b) { resetMech(b, 1); applyLook(b, 1); Post.set(PG[1]); }, *enter(b) { yield* toP2(b); }, *run(b) {
        const S = b.state; if (S.nOn !== 8) resetMech(b, 1); yield 0.6;
        while (true) {
          yield* keySweep(b); yield* lance(b, 2); yield 2.0;
          yield* gateMech(b, 'iris');
          Co.start(latch(b, 4), 'phase'); yield 0.4; yield* keySweep(b); yield 0.8; yield* draught(b); yield* deadbolt(b); yield 2.0;
          yield* gateMech(b, 'doors');
        }
      } },
      { at: 0.36, skipTo(b) { resetMech(b, 2); applyLook(b, 2); Post.set(PG[2]); }, *enter(b) { yield* toP3(b); }, *run(b) {
        const S = b.state; if (S.nOn !== 10) resetMech(b, 2); yield 0.6;
        while (true) {
          yield* keySweep(b); yield* lance(b, 2); yield 1.2;
          yield* gateMech(b, 'rebound');
          yield* rehang(b);
          Co.start(latch(b, 4), 'phase'); yield 0.4; yield* draught(b); yield 0.8; yield* deadbolt(b); yield 2.0;
          yield* gateMech(b, 'triptych');
          if (!b.enraged) { yield* lockout(b); yield 2.0; }
        }
      } },
    ],
    update(b, dt) {
      const S = b.state; if (!S.J) return;
      simStep(b, dt);
      if (G.state === 'fight' && S.introOn) finishIntro(b);
      if (G.headless) return;
      S.U.uTime.value = G.now % 3600;
      lookStep(S, b, dt); poseJanus(S, b, dt); keyStep(S, b, dt); gateVisuals(S, b, dt); hazVisuals(S, b, dt); heroStep(S, b, dt); arcStep(S);
      // the dead: masks falling and cracking on the floor; door openings dark
      const J = S.J;
      if (J.dead >= 0) for (const hg of J.halves) { const u = hg.userData; if (u.land) continue; u.vy -= 14 * dt; hg.position.y += u.vy * dt; hg.position.x += u.vx * dt * 0.4; hg.rotation.x += dt * 2.2 * (u.m ? -1 : 1); hg.rotation.z += dt * u.vx;
        if (hg.position.y < -0.05 && !u.land) { u.land = true; hg.position.y = -0.05; hg.rotation.x = (u.m ? -1 : 1) * 1.3; hg.position.x += u.vx * 0.5; FX.burst(b.pos.x + hg.position.x, 0.3, b.pos.z + hg.position.z, { n: 20, color: u.m ? 0xc8d6f0 : 0xffd98a, speed: [1, 5], life: [0.3, 0.7] }); Sound.sfx('shatter', 0.4); } }
      for (let i = 0; i < NDOOR; i++) S.dW.setY(i, S.doorDark[i]); S.dW.needsUpdate = true;
    },
    danger(b, x, z) {
      const S = b.state, p = G.player;
      // while the autopilot follows a route, "danger" where it stands is the time it has before it must set off (so a cast is only finished if it fits)
      if (S.botOn === G.now && p) return x === p.pos.x && z === p.pos.z ? Math.max(0.35, S.botDepart - G.now) : Infinity; // only the spot it stands on, never a step it might take
      let best = Infinity; for (const h of S.haz) { if (S.mem[h.id] && S.mem[h.id].hit) continue; if (hzF(h, x, z, G.now) <= 0) continue; const tt = hzReach(h, x, z) - G.now; if (tt < best) best = Math.max(0, tt); }
      if (S.lockout) best = Math.min(best, Math.max(0, S.lockAt - G.now));
      return best;
    },
    bot(b, p) {
      const S = b.state, out = {}, now = G.now;
      if (S.tr) { out.x = p.pos.x; out.z = p.pos.z; out.w = 4; out.holdFire = true; return out; }
      // a trip: wait 2 m short of the gate, then step in on time (in 'jump' mode stand on it and jump)
      const runTrip = (gi, W, te) => {
        const g = S.gs[gi], dWC = Math.hypot(W[0] - g.x, W[1] - g.z), spd = p.speed * p.speedMul;
        const lead = ENTER === 'walk' ? Math.max(0, dWC - TRIG + 0.1) / spd + 0.03 : ENTER === 'dwell' ? Math.max(0, dWC - TRIG + 0.1) / spd + DWELL + 0.02 : 0.66;
        const dP = Math.hypot(p.pos.x - W[0], p.pos.z - W[1]); const depart = te - lead - dP / spd - 0.25;
        if (ENTER === 'jump') { out.x = g.x; out.z = g.z; if (now >= te - 0.66 && p.grounded && Math.hypot(p.pos.x - g.x, p.pos.z - g.z) < 0.9) p.jump(); }
        else if (now >= te - lead) { out.x = g.x; out.z = g.z; } else { out.x = W[0]; out.z = W[1]; }
        out.w = 8; out.holdFire = p.cls.melee || depart - now < 2.5; S.botDepart = depart; S.botOn = G.now; return depart; // gap closers and blinks must not carry it across a sweep
      };
      const d0 = (g) => Math.hypot(g.x - p.pos.x, g.z - p.pos.z);
      if (S.lockout && S.mechOn === 'lockout') {
        if (!S.lp) { let best = -1, bd = 1e9; for (let i = 0; i < S.nOn; i++) { if (!gateOpen(S, i)) continue; const g = S.gs[i], d = Math.hypot(g.x - p.pos.x, g.z - p.pos.z) + (d0(g) < TRIG + 0.3 ? 3 : 0); if (d < bd) { bd = d; best = i; } }
          if (best >= 0) { const g = S.gs[best], far = Math.hypot(p.pos.x - g.x, p.pos.z - g.z) > 0.05, dx = far ? p.pos.x - g.x : -g.x, dz = far ? p.pos.z - g.z : -g.z, k = 2 / (Math.hypot(dx, dz) || 1); S.lp = { gi: best, W: [g.x + dx * k, g.z + dz * k], te: S.lockAt - 0.55 }; } }
        if (S.lp) { runTrip(S.lp.gi, S.lp.W, S.lp.te); return out; }
      }
      if (S.mechOn && S.mechOn !== 'lockout' && S.haz.length) {
        if (!S.bp || S.bp.seq !== S.mechSeq || S.bp.exit !== S.lastExit) {
          const H = S.haz.map((h) => Object.assign({}, h, { t0: h.t0 - now }));
          const F = S.haz.map((h) => { const m = S.mem[h.id]; return m.hit || now > h.end ? -1 : now < h.t0 ? 1 : m.side; });
          // plan with some slack first; if that finds nothing, assume its real speed and slimmer margins; if still nothing, keep what was left of the last plan
          let r = null; for (const [v, m] of [[6.0, 0.6], [6.6, 0.45], [7.0, 0.3]]) { r = solve({ gates: solverGates(S), haz: H, x: p.pos.x, z: p.pos.z, t: 0.05, shut: shutMap(S), mode: ENTER, v, m, maxTrips: 3, budget: 4000, F }); if (r) break; }
          const old = S.bp && S.bp.seq === S.mechSeq && S.bp.trips ? S.bp.trips.filter((q) => q.te > now + 0.2 && !S.pairs[S.gs[q.g].pair].sealed && S.pairs[S.gs[q.g].pair].shutUntil <= q.te + 0.01) : null;
          S.bp = { seq: S.mechSeq, exit: S.lastExit, trips: r ? r.trips.map((q) => ({ g: q.g, W: q.W, te: now + q.te })) : old && old.length ? old : null, depart: now };
        }
        const P = S.bp;
        if (P.trips && P.trips.length) { P.depart = runTrip(P.trips[0].g, P.trips[0].W, P.trips[0].te); return out; }
        if (P.trips) { out.x = p.pos.x; out.z = p.pos.z; out.w = 6; out.holdFire = true; return out; } // safe where you stand: stay until it has passed
      }
      // otherwise: kill the Padlock, keep off the gates, and walk around them rather than over them
      if (S.lock && S.lock.add && S.lock.add.alive && !S.mechOn) out.target = S.lock.add;
      out.avoid = (x, z) => { for (let i = 0; i < S.nOn; i++) if (gateOpen(S, i) && Math.hypot(x - S.gs[i].x, z - S.gs[i].z) < 2.4) return true; return false; };
      if (p.cls.melee) { const t = out.target || b, dT = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) || 1, r = t.radius + 2.0, ax = t.pos.x + (p.pos.x - t.pos.x) / dT * r, az = t.pos.z + (p.pos.z - t.pos.z) / dT * r;
        for (let i = 0; i < S.nOn; i++) { if (!gateOpen(S, i)) continue; const g = S.gs[i], dx = ax - p.pos.x, dz = az - p.pos.z, L2 = dx * dx + dz * dz || 1e-6, k = clamp(((g.x - p.pos.x) * dx + (g.z - p.pos.z) * dz) / L2, 0, 1), cx = p.pos.x + dx * k - g.x, cz = p.pos.z + dz * k - g.z, cd = Math.hypot(cx, cz);
          if (cd < 2.2 && k > 0.02 && k < 0.98) { const nx = cd > 1e-3 ? cx / cd : -dz / Math.sqrt(L2), nz = cd > 1e-3 ? cz / cd : dx / Math.sqrt(L2); out.x = g.x + nx * 3.2; out.z = g.z + nz * 3.2; out.w = 3; return out; } } }
      return out;
    },
  });
})();
