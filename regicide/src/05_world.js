// =====================================================================
// 05_world.js: the sky and the court arena.
//
// Exported API (G.world.*), everything is safe to call at any time (before init the sky call is queued, the rest
// is a no-op); unknown names fall back to a default:
//
//   init() / update(dt)                    boot + per-frame (called by core).
//   setSky(preset, level 0-3, sec = 1.5)   sky preset with a crossfade. Presets:
//       'menu'     warm deep-space backdrop with the throne arena dimly lit (the title screen)
//       'night'    indigo night: constellations at 1+, cyan nebula at 2+, meteor shower at 3
//       'aurora'   green/pink curtains, a storm with lightning at 3
//       'collapse' red sun (0), corona (1), violet collapse + flash (2), black hole (3)
//       'ember'    red-orange firestorm: rising embers, dusk-red horizon; 2+ a swollen fire sun; 3 the sky burns, meteors of fire
//       'glass'    pale ice-white / cyan: prismatic light bars, sharp stars; 3 shattering (shards flying, a cold flash)
//       'storm'    violet / indigo thunderheads: lightning at 2+, driving rain at 3, 3 = the eye with a violet corona
//       A set-piece (flash / bloom pulse) plays when the level rises inside the same preset.
//   sky (getter)                            { preset, intensity, transitioning }.
//   setArena(skin, sec = 0.5)               arena skin with a short crossfade: 'ash' (blackened flagstones, ember cracks, charred
//                                           stumps), 'glass' (mirror floor, caustic hints, glass pillars outside the rim),
//                                           'tide' (wet stone, dark water beyond the rim with ripples), 'storm' (basalt, lightning
//                                           rods at the rim that spark), 'throne' (gold-inlaid obsidian, a throne silhouette at
//                                           the far side -z), 'none' (plain). Fights call it at start.
//   arena (getter)                          the current skin name.
//   arenaR (get/set)                        the live playable radius (starts at G.ARENA_R; setting it is instant).
//   setArenaR(r, dur = 1)                   animates the live radius; the floor outside becomes visibly unsafe per skin
//                                           (ash: cracks + lava, glass: shattered void, tide: water over the stone, storm:
//                                           static, throne: falls away) and an accent edge ring marks the live radius.
//   floorGlow(hex, amount, dur = 0.6)       whole-floor accent pulse; dur 0 holds until changed.
//   rimGlow(hex, amount, dur = 0.6)         rim inlay pulse; dur 0 holds.
//   setAccent(hex)                          accent for the edge ring / rim light tint (combat sets it per boss).
//   beat(strength)                          a small world pulse (floor emissive + rim).
//   meteor(color) / lightning(color)        one sky event now.
//   reset()                                 fight start / menu: arenaR back to G.ARENA_R at once, glows cleared.
//   readability                             { ceil, ceilCine, expMax, bloomMax, expMaxCine, bloomMaxCine } play caps.
//
// Internals: baked nebula cube (two cubes crossfaded), live stars, constellations, meteor / bolt / prism streak pool,
// aurora / fire curtains, swollen sun + corona, black hole with lensing + accretion disk, embers + rain particle
// layers, PMREM env map per preset; one floor disc (ShaderMaterial on canvas textures) + a lathe rim + a few props.
// =====================================================================
(() => {
  const T = THREE;
  const V = T.Vector3, C = T.Color;
  const TAU = Math.PI * 2;
  let ready = false;
  const W = {};                 // internal state
  const tmpV = new V(), tmpV2 = new V(), tmpC = new C();
  const col = (c, d = '#ffffff') => { try { return c == null ? new C(d) : c.isColor ? c.clone() : new C(c); } catch (e) { return new C(d); } };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const SHADER_TAIL = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';

  // shared GLSL noise
  const NOISE = /* glsl */`
    float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    vec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
    float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
    float fbm3(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
  `;

  // tileable 4-channel fbm noise texture (cheap stand-in for per-pixel fbm in big screen-area shaders)
  let noiseTex = null;
  function getNoiseTex() {
    if (noiseTex) return noiseTex;
    const N = 256, data = new Uint8Array(N * N * 4);
    const lat = (P, seed) => { const a = new Float32Array(P * P); for (let i = 0; i < a.length; i++) a[i] = hash(i * 1.37 + seed * 91.7); return a; };
    const chans = [[4, 8, 16, 32], [8, 16, 32, 64], [16, 32, 64, 128], [6 * 0 + 4, 16, 64, 128]].map((ps, ci) => ps.map((P, k) => ({ P, a: lat(P, ci * 10 + k), w: Math.pow(0.5, k) })));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      for (let c = 0; c < 4; c++) {
        let v = 0, ws = 0;
        for (const o of chans[c]) {
          const fx = x / N * o.P, fy = y / N * o.P, ix = Math.floor(fx), iy = Math.floor(fy);
          let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
          const P = o.P, A = o.a, x0 = ix % P, y0 = iy % P, x1 = (ix + 1) % P, y1 = (iy + 1) % P;
          const v0 = A[y0 * P + x0] * (1 - tx) + A[y0 * P + x1] * tx, v1 = A[y1 * P + x0] * (1 - tx) + A[y1 * P + x1] * tx;
          v += (v0 * (1 - ty) + v1 * ty) * o.w; ws += o.w;
        }
        data[(y * N + x) * 4 + c] = Math.round(G.clamp(v / ws) * 255);
      }
    }
    noiseTex = new T.DataTexture(data, N, N, T.RGBAFormat);
    noiseTex.wrapS = noiseTex.wrapT = T.RepeatWrapping; noiseTex.magFilter = T.LinearFilter; noiseTex.minFilter = T.LinearMipmapLinearFilter; noiseTex.generateMipmaps = true; noiseTex.needsUpdate = true;
    return noiseTex;
  }

  // ==================================================================
  // Env map
  // ==================================================================
  let pmrem = null, envRT = null;
  function makeEnv(e) {
    try {
      pmrem = pmrem || new T.PMREMGenerator(G.renderer);
      const es = new T.Scene();
      const mat = new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false,
        uniforms: { a: { value: col(e.top) }, b: { value: col(e.mid) }, c: { value: col(e.bot) }, d: { value: col(e.panel) }, f: { value: col(e.panel2 || e.panel) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: `uniform vec3 a, b, c, d, f; varying vec3 vP; void main(){ vec3 n = normalize(vP); float y = n.y;
          vec3 col = y > 0. ? mix(b, a, pow(y, .5)) : mix(b, c, pow(-y, .35));
          col += b * 1.6 * pow(1. - abs(y), 12.);
          // broad warm lobe where the track tops reflect (upper far sky), plus a sharper sheen band
          float l = max(0., dot(n, normalize(vec3(0., .78, -.62))));
          col += d * (pow(l, 4.) * .32 + pow(l, 60.) * 1.4);
          float band = exp(-pow((y - .66) / .025, 2.)) * smoothstep(.2, -.6, n.z);
          col += f * band * 1.1;
          gl_FragColor = vec4(col, 1.); }`,
      });
      es.add(new T.Mesh(new T.SphereGeometry(10, 48, 24), mat));
      // soft-box panels for crisp highlights on bevels / boss metal
      const panels = [[e.panel, 2.6, [-5, 6, 4], 4, 1.4], [e.rim || '#8090ff', 1.4, [6, 2, 5], 3, 2.2], [e.rim || '#8090ff', 1.0, [0, -6, 6], 6, 1]];
      for (const [c, k, p, sw, sh] of panels) {
        const m = new T.Mesh(new T.PlaneGeometry(sw, sh), new T.MeshBasicMaterial({ color: col(c).multiplyScalar(k), side: T.DoubleSide }));
        m.position.set(...p); m.lookAt(0, 0, 0); es.add(m);
      }
      const rt = pmrem.fromScene(es, 0.025);
      if (envRT) envRT.dispose();
      envRT = rt; G.scene.environment = rt.texture;
      es.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    } catch (err) { G.log.error('world.makeEnv', err); }
  }


  // ==================================================================
  // Arena: floor textures per skin (albedo + mask: R emissive inlay / cracks, G gloss, B height)
  // ==================================================================
  const FLOOR_R = 13.6;                     // the floor disc runs under the rim lip
  const SKINS = ['ash', 'glass', 'tide', 'storm', 'throne', 'none'];
  const SKIN_ID = { ash: 0, glass: 1, tide: 2, storm: 3, throne: 4, none: 5 };
  const texCache = {};
  function floorTextures(skin) {
    if (texCache[skin]) return texCache[skin];
    const size = G.quality.tier === 'low' ? 768 : 1024;
    let seed = 11 + SKIN_ID[skin] * 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const S = size / (2 * FLOOR_R);         // px per world unit
    const toPx = (x) => size / 2 + x * S;
    // the albedo and the mask are drawn from the same random stream so the features line up
    const draw = (fn) => G.canvasTex(size, size, (x, w, h) => { x.save(); fn(x, w, h); x.restore(); });
    const scatter = (x, n, fn) => { for (let i = 0; i < n; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * FLOOR_R; fn(toPx(r * Math.cos(a)), toPx(r * Math.sin(a)), i); } };
    const poly = (x, pts) => { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); };
    // jittered grid cells (flagstones / basalt columns)
    const cells = (step, jit, hex) => {
      const out = [];
      const n = Math.ceil(FLOOR_R * 2 / step) + 2;
      for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
        const cx = (i + (hex && j % 2 ? 0.5 : 0)) * step + (rnd() - 0.5) * jit, cz = j * step * (hex ? 0.866 : 1) + (rnd() - 0.5) * jit;
        if (Math.hypot(cx, cz) > FLOOR_R + step) continue;
        out.push({ cx, cz, k: rnd(), rot: rnd() * TAU, s: 0.8 + rnd() * 0.3 });
      }
      return out;
    };
    const cellPts = (c, step, hex, inset) => {
      const pts = []; const nSides = hex ? 6 : 4; const R = (hex ? step * 0.577 : step * 0.707) * c.s - inset;
      for (let i = 0; i < nSides; i++) { const a = c.rot * (hex ? 0 : 1) + (hex ? Math.PI / 6 : Math.PI / 4) + i / nSides * TAU; pts.push([toPx(c.cx + Math.cos(a) * R), toPx(c.cz + Math.sin(a) * R)]); }
      return pts;
    };
    let alb, msk;
    if (skin === 'ash') {
      const cs = cells(1.55, 0.18, false); seed = 101;
      const cracks = []; // polylines in world units
      for (let i = 0; i < 26; i++) {
        const a = rnd() * TAU, r0 = 1 + rnd() * 11.5; let px = r0 * Math.cos(a), pz = r0 * Math.sin(a), d = rnd() * TAU; const pts = [[px, pz]];
        const n = 3 + Math.floor(rnd() * 6);
        for (let k = 0; k < n; k++) { d += (rnd() - 0.5) * 1.6; const L = 0.4 + rnd() * 0.9; px += Math.cos(d) * L; pz += Math.sin(d) * L; pts.push([px, pz]); }
        cracks.push({ pts, w: (1.4 + rnd() * 2.0) * S * 0.03, hot: rnd() });
      }
      const sootSeed = seed;
      alb = draw((x, w) => {
        x.fillStyle = '#0d0a09'; x.fillRect(0, 0, w, w);
        seed = 7;
        for (const c of cs) {
          const t = 0.3 + c.k * 0.16; const g = Math.round(34 * t * 4), r = Math.round(40 * t * 4), b = Math.round(30 * t * 4);
          x.fillStyle = `rgb(${r},${g},${b})`; poly(x, cellPts(c, 1.55, false, 0.06)); x.fill();
          // bevelled lighter edge on two sides + soot patches
          x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = Math.max(2, S * 0.05); x.stroke();
          x.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.12})`; x.beginPath(); x.arc(toPx(c.cx + (rnd() - 0.5) * 0.9), toPx(c.cz + (rnd() - 0.5) * 0.9), (0.25 + rnd() * 0.45) * S, 0, TAU); x.fill();
        }
        // grit
        x.fillStyle = 'rgba(160,140,120,0.08)'; for (let i = 0; i < 2500; i++) x.fillRect(rnd() * w, rnd() * w, 1.5, 1.5);
        // cracks: dark gouges with a warm albedo so they read even unlit
        x.lineCap = 'round'; x.lineJoin = 'round';
        for (const c of cracks) { x.strokeStyle = '#1a0806'; x.lineWidth = c.w * 1.8; x.beginPath(); c.pts.forEach((p, i) => i ? x.lineTo(toPx(p[0]), toPx(p[1])) : x.moveTo(toPx(p[0]), toPx(p[1]))); x.stroke(); x.strokeStyle = `rgba(255,${90 + c.hot * 60 | 0},30,0.8)`; x.lineWidth = c.w * 0.6; x.stroke(); }
        // a scorched ring + soot halo at the centre (the hearth)
        const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, 3.2 * S); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.7, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w);
      });
      msk = draw((x, w) => {
        x.fillStyle = 'rgb(0,30,120)'; x.fillRect(0, 0, w, w);
        seed = 7;
        for (const c of cs) { const hgt = 120 + Math.round(c.k * 70); x.fillStyle = `rgb(0,28,${hgt})`; poly(x, cellPts(c, 1.55, false, 0.06)); x.fill(); rnd(); rnd(); rnd(); rnd(); }
        for (let i = 0; i < 2500; i++) { rnd(); rnd(); }
        x.lineCap = 'round'; x.lineJoin = 'round';
        for (const c of cracks) {
          const path = () => { x.beginPath(); c.pts.forEach((p, i) => i ? x.lineTo(toPx(p[0]), toPx(p[1])) : x.moveTo(toPx(p[0]), toPx(p[1]))); };
          x.strokeStyle = 'rgba(0,0,0,0.9)'; x.lineWidth = c.w * 2.2; path(); x.stroke();
          x.strokeStyle = `rgba(${60 + c.hot * 60 | 0},0,0,0.4)`; x.lineWidth = c.w * 2.6; path(); x.stroke();
          x.strokeStyle = `rgba(${150 + c.hot * 105 | 0},0,0,1)`; x.lineWidth = c.w * 0.6; path(); x.stroke();
        }
      });
      seed = sootSeed;
    } else if (skin === 'glass') {
      alb = draw((x, w) => {
        x.fillStyle = '#070a12'; x.fillRect(0, 0, w, w);
        // pane lines: concentric circles + spokes
        x.strokeStyle = 'rgba(150,200,230,0.22)'; x.lineWidth = Math.max(1, S * 0.03);
        for (const r of [2.5, 5, 7.5, 10, 12.5]) { x.beginPath(); x.arc(w / 2, w / 2, r * S, 0, TAU); x.stroke(); }
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; x.beginPath(); x.moveTo(toPx(Math.cos(a) * 2.5), toPx(Math.sin(a) * 2.5)); x.lineTo(toPx(Math.cos(a) * FLOOR_R), toPx(Math.sin(a) * FLOOR_R)); x.stroke(); }
        // caustic blobs (faint)
        x.globalCompositeOperation = 'lighter';
        scatter(x, 90, (px, py) => { const rr = (0.6 + rnd() * 1.6) * S; const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, `rgba(120,200,255,${0.05 + rnd() * 0.07})`); g.addColorStop(1, 'rgba(120,200,255,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); });
        // a central rose
        x.strokeStyle = 'rgba(190,230,255,0.35)'; x.lineWidth = Math.max(1, S * 0.04);
        for (let i = 0; i < 8; i++) { x.beginPath(); x.ellipse(w / 2, w / 2, 2.4 * S, 0.7 * S, i / 8 * Math.PI, 0, TAU); x.stroke(); }
      });
      msk = draw((x, w) => {
        x.fillStyle = 'rgb(0,235,128)'; x.fillRect(0, 0, w, w);
        x.strokeStyle = 'rgba(200,255,130,1)'; x.lineWidth = Math.max(1, S * 0.03);
        for (const r of [2.5, 5, 7.5, 10, 12.5]) { x.beginPath(); x.arc(w / 2, w / 2, r * S, 0, TAU); x.stroke(); }
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; x.beginPath(); x.moveTo(toPx(Math.cos(a) * 2.5), toPx(Math.sin(a) * 2.5)); x.lineTo(toPx(Math.cos(a) * FLOOR_R), toPx(Math.sin(a) * FLOOR_R)); x.stroke(); }
        scatter(x, 90, () => { rnd(); rnd(); rnd(); });
        x.strokeStyle = 'rgba(255,255,130,1)'; x.lineWidth = Math.max(1, S * 0.04);
        for (let i = 0; i < 8; i++) { x.beginPath(); x.ellipse(w / 2, w / 2, 2.4 * S, 0.7 * S, i / 8 * Math.PI, 0, TAU); x.stroke(); }
      });
    } else if (skin === 'tide') {
      const cobbles = []; scatter(null, 0, () => {});
      for (let i = 0; i < 1500; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * (FLOOR_R + 0.4); cobbles.push({ x: r * Math.cos(a), z: r * Math.sin(a), rr: 0.28 + rnd() * 0.32, k: rnd(), e: 0.75 + rnd() * 0.3 }); }
      const puddles = []; for (let i = 0; i < 26; i++) { const a = rnd() * TAU, r = 1 + Math.sqrt(rnd()) * 11.5; puddles.push({ x: r * Math.cos(a), z: r * Math.sin(a), rr: 0.7 + rnd() * 1.6, ry: 0.5 + rnd() * 0.6, rot: rnd() * TAU }); }
      alb = draw((x, w) => {
        x.fillStyle = '#14191d'; x.fillRect(0, 0, w, w);
        for (const c of cobbles) { const t = 0.42 + c.k * 0.22; x.fillStyle = `rgb(${Math.round(40 * t * 2)},${Math.round(48 * t * 2)},${Math.round(52 * t * 2)})`; x.beginPath(); x.ellipse(toPx(c.x), toPx(c.z), c.rr * S, c.rr * c.e * S, c.k * 3, 0, TAU); x.fill(); }
        // wet sheen on the upper-left of each cobble
        x.fillStyle = 'rgba(140,190,200,0.06)';
        for (const c of cobbles) { x.beginPath(); x.ellipse(toPx(c.x - c.rr * 0.25), toPx(c.z - c.rr * 0.25), c.rr * 0.5 * S, c.rr * 0.35 * S, c.k * 3, 0, TAU); x.fill(); }
        // puddles (darker, bluish)
        for (const p of puddles) { x.fillStyle = 'rgba(10,30,40,0.75)'; x.beginPath(); x.ellipse(toPx(p.x), toPx(p.z), p.rr * S, p.rr * p.ry * S, p.rot, 0, TAU); x.fill(); }
        // weed / tide lines
        x.strokeStyle = 'rgba(40,110,90,0.25)'; x.lineWidth = Math.max(1, S * 0.05);
        for (const r of [6.5, 9.2, 11.8]) { x.beginPath(); x.arc(w / 2, w / 2, r * S, 0, TAU); x.stroke(); }
      });
      msk = draw((x, w) => {
        x.fillStyle = 'rgb(0,60,110)'; x.fillRect(0, 0, w, w);
        for (const c of cobbles) { x.fillStyle = `rgb(0,70,${150 + Math.round(c.k * 60)})`; x.beginPath(); x.ellipse(toPx(c.x), toPx(c.z), c.rr * S, c.rr * c.e * S, c.k * 3, 0, TAU); x.fill(); }
        for (const p of puddles) { x.fillStyle = 'rgb(255,255,120)'; x.beginPath(); x.ellipse(toPx(p.x), toPx(p.z), p.rr * S, p.rr * p.ry * S, p.rot, 0, TAU); x.fill(); }
      });
    } else if (skin === 'storm') {
      const cs = cells(1.25, 0.05, true);
      alb = draw((x, w) => {
        x.fillStyle = '#0a0a0e'; x.fillRect(0, 0, w, w);
        for (const c of cs) { const t = 0.62 + c.k * 0.4; x.fillStyle = `rgb(${Math.round(30 * t * 2.5)},${Math.round(30 * t * 2.5)},${Math.round(38 * t * 2.5)})`; poly(x, cellPts(c, 1.25, true, 0.035)); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = Math.max(1, S * 0.03); x.stroke(); }
        // mineral speckle + a few violet veins
        x.fillStyle = 'rgba(180,170,210,0.07)'; for (let i = 0; i < 2000; i++) x.fillRect(rnd() * w, rnd() * w, 1.5, 1.5);
        x.strokeStyle = 'rgba(140,100,220,0.35)'; x.lineWidth = Math.max(1, S * 0.04); x.lineCap = 'round';
        for (let i = 0; i < 14; i++) { const a = rnd() * TAU, r = 2 + rnd() * 10; let px = r * Math.cos(a), pz = r * Math.sin(a), d = rnd() * TAU; x.beginPath(); x.moveTo(toPx(px), toPx(pz)); for (let k = 0; k < 6; k++) { d += (rnd() - 0.5) * 1.4; px += Math.cos(d) * 0.7; pz += Math.sin(d) * 0.7; x.lineTo(toPx(px), toPx(pz)); } x.stroke(); }
      });
      msk = draw((x, w) => {
        x.fillStyle = 'rgb(0,40,90)'; x.fillRect(0, 0, w, w);
        for (const c of cs) { x.fillStyle = `rgb(0,40,${110 + Math.round(c.k * 90)})`; poly(x, cellPts(c, 1.25, true, 0.035)); x.fill(); x.strokeStyle = 'rgba(90,40,0,1)'; x.lineWidth = Math.max(1, S * 0.03); x.stroke(); }
        for (let i = 0; i < 2000; i++) { rnd(); rnd(); }
        x.strokeStyle = 'rgba(255,40,0,1)'; x.lineWidth = Math.max(1, S * 0.05); x.lineCap = 'round';
        for (let i = 0; i < 14; i++) { const a = rnd() * TAU, r = 2 + rnd() * 10; let px = r * Math.cos(a), pz = r * Math.sin(a), d = rnd() * TAU; x.beginPath(); x.moveTo(toPx(px), toPx(pz)); for (let k = 0; k < 6; k++) { d += (rnd() - 0.5) * 1.4; px += Math.cos(d) * 0.7; pz += Math.sin(d) * 0.7; x.lineTo(toPx(px), toPx(pz)); } x.stroke(); }
      });
    } else if (skin === 'throne') {
      const inlay = (x, gold) => {
        x.strokeStyle = gold; x.lineCap = 'round'; x.fillStyle = gold;
        x.lineWidth = Math.max(1.5, S * 0.05);
        for (const r of [1.6, 4.2, 8.6, 12.4]) { x.beginPath(); x.arc(x.canvas.width / 2, x.canvas.width / 2, r * S, 0, TAU); x.stroke(); }
        x.lineWidth = Math.max(1.5, S * 0.09); x.beginPath(); x.arc(x.canvas.width / 2, x.canvas.width / 2, 12.75 * S, 0, TAU); x.stroke();
        x.lineWidth = Math.max(1, S * 0.04);
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.beginPath(); x.moveTo(toPx(Math.cos(a) * 1.6), toPx(Math.sin(a) * 1.6)); x.lineTo(toPx(Math.cos(a) * 12.4), toPx(Math.sin(a) * 12.4)); x.stroke(); }
        // crown points on the outer band + rune ticks
        for (let i = 0; i < 24; i++) { const a = (i + 0.5) / 24 * TAU, r = 12.55; x.save(); x.translate(toPx(Math.cos(a) * r), toPx(Math.sin(a) * r)); x.rotate(a + Math.PI / 2); x.beginPath(); x.moveTo(-0.16 * S, 0); x.lineTo(0, -0.42 * S); x.lineTo(0.16 * S, 0); x.closePath(); x.fill(); x.restore(); }
        for (let i = 0; i < 72; i++) { const a = i / 72 * TAU, r0 = 8.6, r1 = i % 6 === 0 ? 9.3 : 8.95; x.beginPath(); x.moveTo(toPx(Math.cos(a) * r0), toPx(Math.sin(a) * r0)); x.lineTo(toPx(Math.cos(a) * r1), toPx(Math.sin(a) * r1)); x.stroke(); }
        // central sunburst (the hollow crown): ring of 8 spikes
        x.lineWidth = Math.max(1.5, S * 0.07);
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; x.beginPath(); x.moveTo(toPx(Math.cos(a) * 1.6), toPx(Math.sin(a) * 1.6)); x.lineTo(toPx(Math.cos(a + 0.2) * 3.4), toPx(Math.sin(a + 0.2) * 3.4)); x.lineTo(toPx(Math.cos(a + 0.39) * 1.6), toPx(Math.sin(a + 0.39) * 1.6)); x.stroke(); }
        x.lineWidth = Math.max(1, S * 0.03); x.beginPath(); x.arc(x.canvas.width / 2, x.canvas.width / 2, 0.9 * S, 0, TAU); x.stroke();
      };
      alb = draw((x, w) => {
        x.fillStyle = '#07060a'; x.fillRect(0, 0, w, w);
        // obsidian: broad dark sheen bands + conchoidal flecks
        for (let i = 0; i < 30; i++) { const g = x.createLinearGradient(rnd() * w, rnd() * w, rnd() * w, rnd() * w); g.addColorStop(0, 'rgba(40,30,60,0)'); g.addColorStop(0.5, `rgba(40,30,60,${0.08 + rnd() * 0.12})`); g.addColorStop(1, 'rgba(40,30,60,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }
        x.fillStyle = 'rgba(120,110,150,0.06)'; for (let i = 0; i < 2500; i++) x.fillRect(rnd() * w, rnd() * w, 2, 1);
        // slab seams
        x.strokeStyle = 'rgba(0,0,0,0.7)'; x.lineWidth = Math.max(1, S * 0.03);
        for (const r of [3.0, 6.0, 10.5]) { x.beginPath(); x.arc(w / 2, w / 2, r * S, 0, TAU); x.stroke(); }
        for (let i = 0; i < 24; i++) { const a = (i + 0.5) / 24 * TAU; x.beginPath(); x.moveTo(toPx(Math.cos(a) * 3), toPx(Math.sin(a) * 3)); x.lineTo(toPx(Math.cos(a) * FLOOR_R), toPx(Math.sin(a) * FLOOR_R)); x.stroke(); }
        inlay(x, 'rgba(214,160,60,0.95)');
      });
      msk = draw((x, w) => {
        x.fillStyle = 'rgb(0,200,128)'; x.fillRect(0, 0, w, w);
        for (let i = 0; i < 30; i++) { rnd(); rnd(); rnd(); rnd(); rnd(); }
        for (let i = 0; i < 2500; i++) { rnd(); rnd(); }
        x.strokeStyle = 'rgba(0,0,0,0.8)'; x.lineWidth = Math.max(1, S * 0.03);
        for (const r of [3.0, 6.0, 10.5]) { x.beginPath(); x.arc(w / 2, w / 2, r * S, 0, TAU); x.stroke(); }
        for (let i = 0; i < 24; i++) { const a = (i + 0.5) / 24 * TAU; x.beginPath(); x.moveTo(toPx(Math.cos(a) * 3), toPx(Math.sin(a) * 3)); x.lineTo(toPx(Math.cos(a) * FLOOR_R), toPx(Math.sin(a) * FLOOR_R)); x.stroke(); }
        inlay(x, 'rgb(255,120,140)');
      });
    } else {
      alb = draw((x, w) => {
        x.fillStyle = '#2a2b33'; x.fillRect(0, 0, w, w);
        x.fillStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 3000; i++) x.fillRect(rnd() * w, rnd() * w, 1.5, 1.5);
        x.strokeStyle = 'rgba(120,130,160,0.25)'; x.lineWidth = Math.max(1, S * 0.03);
        for (const r of [4.33, 8.66, 12.6]) { x.beginPath(); x.arc(w / 2, w / 2, r * S, 0, TAU); x.stroke(); }
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; x.beginPath(); x.moveTo(w / 2, w / 2); x.lineTo(toPx(Math.cos(a) * FLOOR_R), toPx(Math.sin(a) * FLOOR_R)); x.stroke(); }
      });
      msk = draw((x, w) => {
        x.fillStyle = 'rgb(0,60,128)'; x.fillRect(0, 0, w, w);
        for (let i = 0; i < 3000; i++) { rnd(); rnd(); }
        x.strokeStyle = 'rgb(140,60,128)'; x.lineWidth = Math.max(1, S * 0.03);
        for (const r of [4.33, 8.66, 12.6]) { x.beginPath(); x.arc(w / 2, w / 2, r * S, 0, TAU); x.stroke(); }
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; x.beginPath(); x.moveTo(w / 2, w / 2); x.lineTo(toPx(Math.cos(a) * FLOOR_R), toPx(Math.sin(a) * FLOOR_R)); x.stroke(); }
      });
    }
    const aniso = Math.min(8, G.renderer.capabilities.getMaxAnisotropy ? G.renderer.capabilities.getMaxAnisotropy() : 4);
    alb.anisotropy = aniso; msk.anisotropy = aniso; msk.colorSpace = T.NoColorSpace; msk.needsUpdate = true;
    alb.minFilter = msk.minFilter = T.LinearMipmapLinearFilter;
    return (texCache[skin] = { alb, msk });
  }

  // ==================================================================
  // Arena: floor disc shader, rim, edge ring
  // ==================================================================
  const RIM_LOOK = {
    ash:    { color: '#2a211c', metal: 0.15, rough: 0.85, inlay: '#ff6a2a', inlayI: 0.35, emis: '#1a0804' },
    glass:  { color: '#9fd4ea', metal: 0.25, rough: 0.12, inlay: '#dff8ff', inlayI: 0.5, emis: '#0a1a22' },
    tide:   { color: '#182a2e', metal: 0.3, rough: 0.35, inlay: '#3dffa2', inlayI: 0.45, emis: '#02100a' },
    storm:  { color: '#1c1a24', metal: 0.5, rough: 0.6, inlay: '#b77bff', inlayI: 0.45, emis: '#0a0614' },
    throne: { color: '#0e0b12', metal: 0.6, rough: 0.3, inlay: '#ffd36b', inlayI: 0.7, emis: '#0a0804' },
    none:   { color: '#23242c', metal: 0.4, rough: 0.6, inlay: '#5fe3ff', inlayI: 0.25, emis: '#000000' },
  };
  function buildFloor() {
    const arena = G.layers.arena;
    const A = W.arena = { skin: 'none', prev: 'none', mix: 1, mixDur: 0.5, liveR: G.ARENA_R, rFrom: G.ARENA_R, rTo: G.ARENA_R, rT: 1, rDur: 0,
      glow: { col: new C('#ffffff'), amt: 0, decay: 0 }, rimG: { col: new C('#ffffff'), amt: 0, decay: 0 }, props: {}, propT: 1, rimCur: null, rimTo: null };
    const t0 = floorTextures('none');
    const keyDir = G.lights ? G.lights.key.position.clone().normalize() : new V(-0.4, 0.8, 0.5).normalize();
    A.u = {
      uAlbA: { value: t0.alb }, uMskA: { value: t0.msk }, uAlbB: { value: t0.alb }, uMskB: { value: t0.msk }, uMix: { value: 1 }, uSkinA: { value: 5 }, uSkinB: { value: 5 },
      uTime: { value: 0 }, uLiveR: { value: G.ARENA_R }, uShrunk: { value: 0 }, uDim: { value: 0 }, uBeat: { value: 0 }, uTexel: { value: 1 / 1024 },
      uAccent: { value: new C(G.colors.accent) }, uGlowCol: { value: new C('#ffffff') }, uGlow: { value: 0 },
      uKeyDir: { value: keyDir }, uKeyCol: { value: new C('#ffe3b0') }, uHemi: { value: new C('#8d8cff') }, uGround: { value: new C('#1a0f08') },
      uNoise: { value: getNoiseTex() }, uCubeA: { value: null }, uCubeB: { value: null }, uSkyMix: { value: 0 }, uSkyGain: { value: 1 },
    };
    const mat = new T.ShaderMaterial({
      uniforms: A.u, transparent: false, depthWrite: true,
      vertexShader: 'varying vec3 vP; varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vP = position; vW = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */`
        uniform sampler2D uAlbA, uMskA, uAlbB, uMskB, uNoise; uniform samplerCube uCubeA, uCubeB;
        uniform float uMix, uTime, uLiveR, uShrunk, uDim, uBeat, uTexel, uGlow, uSkyMix, uSkyGain; uniform int uSkinA, uSkinB;
        uniform vec3 uAccent, uGlowCol, uKeyDir, uKeyCol, uHemi, uGround;
        varying vec3 vP; varying vec2 vUv; varying vec3 vW;
        float rh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        // per-skin: emissive inlay (steady), and the unsafe look outside the live radius. k = unsafe weight 0..1
        vec3 emis(int id, vec4 m, float r, float th){
          float pulse = .5 + .5 * sin(uTime * 1.7 + r * .9 + th * 2.);
          if (id == 0) { float n = texture2D(uNoise, vP.xz * .05 + uTime * .01).r; return mix(vec3(1.2, .22, .04), vec3(1.6, .75, .25), n) * m.r * (.55 + .45 * pulse) * 1.1; }
          if (id == 1) return vec3(.45, .85, 1.) * m.r * .22;
          if (id == 3) { float fl = step(.985, rh(floor(vP.xz * 3. + uTime * 9.) + vec2(1., 3.))); return vec3(.55, .35, 1.) * m.r * (.22 + fl * 1.5); }
          if (id == 4) return vec3(1.6, 1.05, .35) * m.r * (.75 + .25 * pulse) * .8;
          if (id == 5) return uAccent * m.r * .18;
          return vec3(0.);
        }
        // returns the unsafe colour; sets dropK > .5 to discard (void)
        vec3 unsafeCol(int id, vec3 col, vec4 m, float r, float th, float edge, out float dropK){
          dropK = 0.;
          if (id == 0) { float n = texture2D(uNoise, vP.xz * .07 + vec2(uTime * .02, 0.)).r; float n2 = texture2D(uNoise, vP.xz * .2 - uTime * .03).g;
            float lava = smoothstep(.5, .68, n + m.r * .4 + n2 * .15) * .7; vec3 hot = mix(vec3(1.3, .18, .02), vec3(1.9, .9, .3), smoothstep(.5, 1., n2 + m.r));
            return mix(col * .25 + vec3(.08, .01, 0.), hot * (.8 + .4 * sin(uTime * 3. + n * 12.)), lava) + vec3(1.2, .3, .05) * edge * .8; }
          if (id == 1) { vec2 q = mat2(.866, -.5, .5, .866) * vP.xz * 1.3; vec2 cell = floor(q + .5); float c = rh(cell + 3.7); float fallen = step(.45, c + edge * .3);
            dropK = fallen; vec2 f = fract(q + .5) - .5; float rim = smoothstep(.3, .47, max(abs(f.x), abs(f.y)));
            return mix(col * .5 + vec3(.02, .05, .08), vec3(.5, .8, 1.), rim * .35 + edge * .3); }
          if (id == 2) { float w1 = texture2D(uNoise, vP.xz * .045 + vec2(uTime * .012, uTime * .007)).b; float w2 = texture2D(uNoise, vP.xz * .11 - vec2(uTime * .02, 0.)).a;
            float rip = sin(r * 5. - uTime * 2.4 + w1 * 6.) * .5 + .5; vec3 water = vec3(.006, .028, .04) + uAccent * (pow(w1 * .6 + w2 * .5, 4.) * .16 + rip * rip * .02) * .8;
            float foam = exp(-pow((r - uLiveR) / .22, 2.)) + exp(-pow((r - uLiveR - .5 * w2) / .12, 2.)) * .6;
            return mix(col * .3, water, .85) + vec3(.55, .85, .85) * foam * .4; }
          if (id == 3) { float s = rh(floor(vP.xz * 14.) + floor(uTime * 26.) * 7.); float scan = .8 + .2 * sin(vP.z * 40. - uTime * 30.);
            vec3 st = mix(vec3(.75, .6, 1.1), vec3(1.), s) * pow(s, 5.) * 1.1 * scan; return mix(col * .35, st + vec3(.12, .06, .22), .9) + vec3(.8, .55, 1.2) * edge * .35; }
          if (id == 4) { dropK = 1.; return col; }
          return mix(col * .45, vec3(.5, .08, .06), .6);
        }
        void main(){
          vec2 uv = vUv; float r = length(vP.xz); float th = atan(-vP.z, vP.x);
          vec3 V = normalize(cameraPosition - vW);
          vec4 mA = texture2D(uMskA, uv), mB = texture2D(uMskB, uv);
          vec3 aA = texture2D(uAlbA, uv).rgb, aB = texture2D(uAlbB, uv).rgb;
          vec4 m = mix(mA, mB, uMix); vec3 base = mix(aA, aB, uMix);
          // bump from the mask height (forward differences)
          float hx = mix(texture2D(uMskA, uv + vec2(uTexel, 0.)).b, texture2D(uMskB, uv + vec2(uTexel, 0.)).b, uMix) - m.b;
          float hz = mix(texture2D(uMskA, uv + vec2(0., uTexel)).b, texture2D(uMskB, uv + vec2(0., uTexel)).b, uMix) - m.b;
          float gl = mix(uSkinA == 1 ? 1. : uSkinA == 4 ? .7 : uSkinA == 2 ? (.15 + mA.g * .8) : uSkinA == 3 ? .12 : .06,
                         uSkinB == 1 ? 1. : uSkinB == 4 ? .7 : uSkinB == 2 ? (.15 + mB.g * .8) : uSkinB == 3 ? .12 : .06, uMix);
          vec3 n = normalize(vec3(-hx * 18., 1., hz * 18.) * vec3(1. - gl * .6, 1., 1. - gl * .6));
          float dif = max(dot(n, uKeyDir), 0.);
          vec3 light = uKeyCol * (dif * .55 + .25) + mix(uGround, uHemi, n.y * .5 + .5) * .55;
          vec3 refl = reflect(-V, n);
          vec3 sky = mix(textureCube(uCubeA, refl).rgb, textureCube(uCubeB, refl).rgb, uSkyMix) * uSkyGain;
          float fres = pow(1. - max(dot(n, V), 0.), 3.);
          float spec = pow(max(dot(refl, uKeyDir), 0.), 36.);
          vec3 col = base * light + sky * gl * (.18 + .6 * fres) * .9 + uKeyCol * spec * gl * .35;
          // steady emissive inlay (+ beat)
          vec3 em = mix(emis(uSkinA, mA, r, th), emis(uSkinB, mB, r, th), uMix);
          col += em * (1. + uBeat * 1.2) + uAccent * m.r * uBeat * .5;
          // unsafe zone outside the live radius
          float jag = (texture2D(uNoise, vec2(th * 1.2, r * .11)).g - .5) * .9 + (texture2D(uNoise, vP.xz * .3).r - .5) * .25;
          float outK = uShrunk * smoothstep(uLiveR - .15, uLiveR + .45, r + jag * (uSkinA == 2 || uSkinB == 2 ? .25 : 1.));
          float edge = exp(-max(r + jag * .5 - uLiveR, 0.) * 1.6) * outK;
          if (outK > .001) {
            float dA, dB; vec3 uA_ = unsafeCol(uSkinA, col, mA, r, th, edge, dA); vec3 uB_ = unsafeCol(uSkinB, col, mB, r, th, edge, dB);
            float drop = mix(dA, dB, uMix); if (drop > .5 && outK > .5) discard;
            col = mix(col, mix(uA_, uB_, uMix), outK);
            // crumbling edge for the throne (inside the live radius, just before the drop)
            float thr = mix(uSkinA == 4 ? 1. : 0., uSkinB == 4 ? 1. : 0., uMix);
            col += vec3(1.8, 1.1, .3) * thr * exp(-max(uLiveR - r, 0.) * 2.5) * uShrunk * (.6 + .4 * sin(uTime * 5. + th * 7.));
          }
          // live-radius edge ring (accent)
          float ed = exp(-pow((r - uLiveR) / .09, 2.)) * (.82 + .18 * sin(uTime * 4.)) + exp(-pow((r - uLiveR) / .45, 2.)) * .18;
          col += min(uAccent * ed * (.45 + 1.0 * uShrunk), vec3(.8));   // under the bloom knee: the ring must not haze the floor
          // floor glow pulse
          col += uGlowCol * uGlow * (.25 + .75 * m.r) * .4;
          col *= 1. - uDim;
          gl_FragColor = vec4(col, 1.);
          ${SHADER_TAIL}
        }`,
    });
    const floor = new T.Mesh(new T.CircleGeometry(FLOOR_R, 160).rotateX(-Math.PI / 2), mat);
    floor.name = 'floor'; floor.renderOrder = 0; floor.receiveShadow = false; arena.add(floor); A.floor = floor;
    A.u.uTexel.value = 1.5 / (G.quality.tier === 'low' ? 768 : 1024);

    // rim: a bevelled lip around the disc
    const prof = [[13.35, -0.5], [13.35, 0.16], [13.47, 0.27], [14.05, 0.27], [14.3, 0.12], [14.3, -0.5]].map(([x, y]) => new T.Vector2(x, y));
    const rimGeo = new T.LatheGeometry(prof, G.quality.tier === 'low' ? 128 : 192);
    const rimMat = new T.MeshStandardMaterial({ color: 0x23242c, metalness: 0.4, roughness: 0.6, emissive: 0x000000, emissiveIntensity: 1, envMapIntensity: 0.9 });
    const rim = new T.Mesh(rimGeo, rimMat); rim.name = 'rim'; rim.renderOrder = 1; arena.add(rim); A.rim = rim; A.rimMat = rimMat;
    // rim inlay (flat glowing band on the lip) + the skirt below (dark, so nothing shows through from underneath)
    const inlay = new T.Mesh(new T.RingGeometry(13.6, 13.92, 160, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x000000, toneMapped: false, fog: false }));
    inlay.position.y = 0.275; inlay.renderOrder = 2; arena.add(inlay); A.inlay = inlay;
    const skirt = new T.Mesh(new T.CylinderGeometry(14.3, 13.2, 3.4, 96, 1, true), new T.MeshStandardMaterial({ color: 0x08080c, metalness: 0.2, roughness: 0.9, side: T.DoubleSide }));
    skirt.position.y = -2.2; arena.add(skirt); A.skirt = skirt;
    // soft under-glow halo around the rim (accent), sells the floating island
    const halo = new T.Mesh(new T.RingGeometry(12.6, 17.5, 128, 1).rotateX(-Math.PI / 2), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
      uniforms: { uCol: { value: new C('#5fe3ff') }, uA: { value: 0.12 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform float uA; uniform vec3 uCol; varying vec3 vP; void main(){ float d = (length(vP.xz) - 14.2) / 2.2; gl_FragColor = vec4(uCol * exp(-d * d * 2.5) * uA, 1.); }' }));
    halo.position.y = -0.55; halo.renderOrder = -1; arena.add(halo); A.halo = halo;
    // edge wall: a short glowing curtain standing on the live radius (visible when shrunk)
    const wall = new T.Mesh(new T.CylinderGeometry(1, 1, 0.9, 128, 1, true).translate(0, 0.45, 0), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
      uniforms: { uCol: { value: new C('#5fe3ff') }, uA: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform float uA, uTime; uniform vec3 uCol; varying vec2 vUv; void main(){ float v = exp(-vUv.y * 4.5) * (.85 + .15 * sin(vUv.x * 80. + uTime * 3.)); gl_FragColor = vec4(uCol * v * uA, 1.); }' }));
    wall.renderOrder = 3; wall.visible = false; arena.add(wall); A.wall = wall;
  }

  // ==================================================================
  // Arena props per skin (all outside the rim; tall ones only on the far side -z so the disc stays unblocked)
  // ==================================================================
  const farness = (th) => G.clamp((-Math.sin(th) + 1) / 2);     // 1 at the far side (-z), 0 at the near side (+z)
  function buildProps(skin) {
    const g = new T.Group(); g.name = 'props-' + skin; g.visible = false; G.layers.arena.add(g);
    const P = { group: g, skin, items: [], t: 0 };
    const dark = new T.MeshStandardMaterial({ color: 0x0c0b10, metalness: 0.3, roughness: 0.7 });
    if (skin === 'ash') {
      // charred stumps / broken pillars with ember tops, and a brazier ring far out
      for (let i = 0; i < 9; i++) {
        const th = i / 9 * TAU + 0.3, r = 15 + hash(i) * 1.2, h = 0.5 + hash(i + 9) * 0.9 + farness(th) * 1.6;
        const m = new T.Mesh(new T.CylinderGeometry(0.28 + hash(i + 3) * 0.12, 0.42, h, 8), new T.MeshStandardMaterial({ color: 0x120c0a, roughness: 0.95, metalness: 0.05, emissive: 0x3a0c02, emissiveIntensity: 0.6 }));
        const p = G.polar(r, th, h / 2 - 0.5); m.position.copy(p); m.rotation.set((hash(i + 5) - 0.5) * 0.25, hash(i + 2) * TAU, (hash(i + 7) - 0.5) * 0.25); g.add(m);
        const s = G.mat.glowSprite('#ff6a1c', 1.6 + hash(i + 4) * 0.9, { intensity: 0.9 }); s.position.copy(p); s.position.y += h / 2; g.add(s);
        P.items.push({ mesh: m, sprite: s, k: hash(i + 11) * 6, base: s.scale.x });
      }
    } else if (skin === 'glass') {
      const gm = new T.MeshStandardMaterial({ color: 0xcfefff, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.42, emissive: 0x9fe8ff, emissiveIntensity: 0.22, envMapIntensity: 1.6, side: T.DoubleSide, depthWrite: false });
      for (let i = 0; i < 12; i++) {
        const th = i / 12 * TAU + 0.26, f = farness(th), r = 15.3 + (1 - f) * 0.7, h = 1.5 + f * 5.5 + hash(i) * 0.8;
        const m = new T.Mesh(new T.BoxGeometry(0.42, h, 0.42), gm); const p = G.polar(r, th, h / 2 - 0.6); m.position.copy(p); m.rotation.y = th; g.add(m);
        const cap = new T.Mesh(new T.ConeGeometry(0.34, 0.6, 4), gm); cap.position.copy(p); cap.position.y += h / 2 + 0.3; cap.rotation.y = th; g.add(cap);
        const bar = new T.Mesh(new T.BoxGeometry(0.08, h * 0.8, 0.08), G.mat.emissive('#dff8ff', 1.6)); bar.position.copy(p); g.add(bar);
        P.items.push({ mesh: m, bar, k: hash(i + 21) * 6, h });
      }
    } else if (skin === 'tide') {
      // dark water plane beyond the rim with slow ripples; a few rock stacks breaking the surface far out
      P.waterU = { uTime: { value: 0 }, uA: { value: 1 }, uAccent: { value: new C('#3dffa2') }, uNoise: { value: getNoiseTex() }, uKeyCol: { value: new C('#ffe3b0') }, uDim: { value: 0 } };
      const water = new T.Mesh(new T.RingGeometry(13.3, 90, 96, 4).rotateX(-Math.PI / 2), new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: P.waterU,
        vertexShader: 'varying vec3 vP; varying vec3 vW; void main(){ vP = position; vW = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: `uniform float uTime, uA, uDim; uniform vec3 uAccent, uKeyCol; uniform sampler2D uNoise; varying vec3 vP; varying vec3 vW;
          void main(){ float r = length(vP.xz); vec3 V = normalize(cameraPosition - vW);
            float w1 = texture2D(uNoise, vP.xz * .018 + vec2(uTime * .006, uTime * .004)).b; float w2 = texture2D(uNoise, vP.xz * .05 - vec2(uTime * .012, uTime * .003)).a;
            float rip = sin((r - 13.3) * 2.2 - uTime * 1.1 + w1 * 5.) * .5 + .5; rip *= exp(-(r - 13.3) * .08);
            vec3 n = normalize(vec3((w1 - .5) * .6, 1., (w2 - .5) * .6)); vec3 kd = normalize(vec3(-.4, .8, .55)); float spec = pow(max(dot(reflect(-V, n), kd), 0.), 60.);
            vec3 c = vec3(.006, .022, .03) + uAccent * (pow(w1 * .6 + w2 * .5, 5.) * .16 + rip * rip * .03) * .7 + uKeyCol * spec * .12;
            float fog = exp(-(r - 13.3) * .07); c = mix(vec3(.002, .005, .008), c, fog);
            float lap = exp(-pow((r - 13.55) / .3, 2.)) * (.4 + .6 * w2); c += vec3(.4, .8, .75) * lap * .18;
            gl_FragColor = vec4(c * (1. - uDim), uA * exp(-(r - 13.3) * .045)); ${SHADER_TAIL} }` }));
      water.position.y = -0.22; water.renderOrder = -2; water.frustumCulled = false; g.add(water); P.water = water;
      for (let i = 0; i < 6; i++) {
        const th = i / 6 * TAU + 0.9, f = farness(th), r = 18 + hash(i + 40) * 7, h = 0.4 + f * 1.4 + hash(i + 41) * 0.6;
        const m = new T.Mesh(new T.DodecahedronGeometry(0.6 + hash(i + 42) * 0.6, 0), new T.MeshStandardMaterial({ color: 0x0e1418, roughness: 0.8, metalness: 0.1 }));
        m.position.copy(G.polar(r, th, h - 1.2)); m.scale.set(1.2, h, 1); m.rotation.y = hash(i + 43) * TAU; g.add(m);
      }
    } else if (skin === 'storm') {
      const rodMat = new T.MeshStandardMaterial({ color: 0x3a3a46, metalness: 0.85, roughness: 0.35 });
      for (let i = 0; i < 10; i++) {
        const th = i / 10 * TAU + 0.15, f = farness(th), r = 14.85, h = 1.4 + f * 2.6;
        const m = new T.Mesh(new T.CylinderGeometry(0.05, 0.1, h, 8), rodMat); const p = G.polar(r, th, h / 2 - 0.35); m.position.copy(p); g.add(m);
        const base = new T.Mesh(new T.CylinderGeometry(0.3, 0.38, 0.3, 8), dark); base.position.copy(G.polar(r, th, -0.3)); g.add(base);
        const tip = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), G.mat.emissive('#b77bff', 1.2)); const tp = G.polar(r, th, h - 0.35); tip.position.copy(tp); g.add(tip);
        const s = G.mat.glowSprite('#c9a0ff', 1.2, { intensity: 0.5 }); s.position.copy(tp); g.add(s);
        P.items.push({ mesh: m, tip, sprite: s, pos: tp, k: hash(i + 31), flash: 0 });
      }
      P.nextSpark = 1.5;
    } else if (skin === 'throne') {
      // the throne silhouette far behind the boss (-z), on a stepped dais, with gold inlay lines and a halo
      const obs = new T.MeshStandardMaterial({ color: 0x0b0910, metalness: 0.55, roughness: 0.4, envMapIntensity: 0.8 });
      const goldM = G.mat.emissive('#ffd36b', 1.1); P.goldM = goldM;
      const tg = new T.Group(); tg.position.set(0, -0.3, -18.5); g.add(tg);
      const dais = [[7.5, 0.5], [6.2, 0.5], [5.0, 0.5], [3.9, 0.6]];
      let y = 0; for (const [rr, hh] of dais) { const d = new T.Mesh(new T.CylinderGeometry(rr, rr + 0.3, hh, 48), obs); d.position.y = y + hh / 2; tg.add(d); y += hh; const ring = new T.Mesh(new T.TorusGeometry(rr - 0.25, 0.035, 6, 96).rotateX(Math.PI / 2), goldM); ring.position.y = y + 0.01; tg.add(ring); }
      const seat = new T.Mesh(new T.BoxGeometry(3.0, 1.4, 2.4), obs); seat.position.set(0, y + 0.7, 0); tg.add(seat);
      const back = new T.Mesh(new T.BoxGeometry(3.4, 7.5, 0.6), obs); back.position.set(0, y + 3.75, -1.0); tg.add(back);
      const spire = new T.Mesh(new T.ConeGeometry(1.7, 2.6, 4), obs); spire.position.set(0, y + 7.5 + 1.3, -1.0); spire.rotation.y = Math.PI / 4; tg.add(spire);
      for (const sx of [-1, 1]) {
        const arm = new T.Mesh(new T.BoxGeometry(0.5, 1.0, 2.2), obs); arm.position.set(sx * 1.5, y + 1.9, 0.1); tg.add(arm);
        const horn = new T.Mesh(new T.ConeGeometry(0.35, 2.4, 4), obs); horn.position.set(sx * 1.9, y + 8.4, -1.0); horn.rotation.z = -sx * 0.25; tg.add(horn);
        const col = new T.Mesh(new T.CylinderGeometry(0.35, 0.45, 9.5, 10), obs); col.position.set(sx * 6.2, 4.4, -2.5); tg.add(col);
        const colRing = new T.Mesh(new T.TorusGeometry(0.42, 0.04, 6, 24).rotateX(Math.PI / 2), goldM); colRing.position.set(sx * 6.2, 8.8, -2.5); tg.add(colRing);
        const brazier = G.mat.glowSprite('#ffb040', 2.4, { intensity: 0.8 }); brazier.position.set(sx * 6.2, 9.6, -2.5); tg.add(brazier); P.items.push({ sprite: brazier, k: sx * 2, base: 2.4 });
        // inlay lines up the back
        for (let k = 0; k < 3; k++) { const ln = new T.Mesh(new T.BoxGeometry(0.06, 6.4 - k * 1.2, 0.06), goldM); ln.position.set(sx * (0.5 + k * 0.45), y + 3.6, -0.68); tg.add(ln); }
      }
      const crown = new T.Mesh(new T.TorusGeometry(0.9, 0.06, 6, 32), goldM); crown.position.set(0, y + 6.3, -0.66); tg.add(crown);
      const haloS = G.mat.glowSprite('#ffd36b', 9, { intensity: 0.5 }); haloS.position.set(0, y + 6.3, -1.2); tg.add(haloS); P.items.push({ sprite: haloS, k: 1, base: 9 });
      P.throne = tg;
    }
    return P;
  }

  // ==================================================================
  // Arena API
  // ==================================================================
  function propsFor(skin) { const A = W.arena; if (!A.props[skin]) A.props[skin] = buildProps(skin); return A.props[skin]; }
  function setArena(skin = 'none', sec = 0.5) {
    if (!ready) { W.pendingArena = [skin, sec]; return; }
    if (!SKIN_ID.hasOwnProperty(skin)) skin = 'none';
    const A = W.arena;
    if (A.skin === skin && A.mix >= 1) return;
    const tex = floorTextures(skin);
    // finish any running crossfade: B becomes A
    const u = A.u;
    if (A.mix < 1) { u.uAlbA.value = u.uAlbB.value; u.uMskA.value = u.uMskB.value; u.uSkinA.value = u.uSkinB.value; }
    else { const cur = floorTextures(A.skin); u.uAlbA.value = cur.alb; u.uMskA.value = cur.msk; u.uSkinA.value = SKIN_ID[A.skin]; }
    u.uAlbB.value = tex.alb; u.uMskB.value = tex.msk; u.uSkinB.value = SKIN_ID[skin];
    A.prev = A.skin; A.skin = skin;
    A.mixDur = Math.max(0, +sec || 0); A.mix = A.mixDur > 0 ? 0 : 1; u.uMix.value = A.mix;
    // props: old group hides, new one grows in
    for (const k in A.props) if (k !== skin) A.props[k].group.visible = false;
    const P = propsFor(skin); P.group.visible = true; A.propT = A.mixDur > 0 ? 0 : 1; P.group.scale.set(1, Math.max(0.001, A.propT), 1);
    // rim look
    const look = RIM_LOOK[skin];
    A.rimTo = { color: new C(look.color), metal: look.metal, rough: look.rough, inlay: new C(look.inlay), inlayI: look.inlayI, emis: new C(look.emis) };
    if (!A.rimCur || A.mixDur === 0) A.rimCur = { color: A.rimTo.color.clone(), metal: look.metal, rough: look.rough, inlay: A.rimTo.inlay.clone(), inlayI: look.inlayI, emis: A.rimTo.emis.clone() };
    G.emit('arenaChange', { skin });
  }
  function setArenaR(r, dur = 1) {
    const A = W.arena; if (!A) return;
    const target = G.clamp(+r || 0, 2, G.ARENA_R);
    A.rFrom = A.liveR; A.rTo = target; A.rDur = Math.max(0, +dur || 0); A.rT = A.rDur > 0 ? 0 : 1;
    if (A.rT >= 1) A.liveR = target;
  }
  function floorGlow(hex = '#ffffff', amount = 1, dur = 0.6) {
    const A = W.arena; if (!A) return;
    try { A.glow.col.set(hex || '#ffffff'); } catch (e) { A.glow.col.set('#ffffff'); }
    A.glow.amt = Math.max(0, Math.min(2, +amount || 0)); A.glow.decay = dur > 0 ? A.glow.amt / dur : 0;
  }
  function rimGlow(hex = '#ffffff', amount = 1, dur = 0.6) {
    const A = W.arena; if (!A) return;
    try { A.rimG.col.set(hex || '#ffffff'); } catch (e) { A.rimG.col.set('#ffffff'); }
    A.rimG.amt = Math.max(0, Math.min(3, +amount || 0)); A.rimG.decay = dur > 0 ? A.rimG.amt / dur : 0;
  }
  function updateArena(dt, t, p) {
    const A = W.arena, u = A.u;
    // crossfade
    if (A.mix < 1) { A.mix = A.mixDur > 0 ? Math.min(1, A.mix + dt / A.mixDur) : 1; u.uMix.value = G.smooth(A.mix); }
    if (A.propT < 1) { A.propT = A.mixDur > 0 ? Math.min(1, A.propT + dt / Math.max(0.2, A.mixDur)) : 1; const P = A.props[A.skin]; if (P) P.group.scale.set(1, Math.max(0.001, G.easeOutBack(A.propT)), 1); }
    // live radius
    if (A.rT < 1) { A.rT = A.rDur > 0 ? Math.min(1, A.rT + dt / A.rDur) : 1; A.liveR = A.rFrom + (A.rTo - A.rFrom) * G.smooth(A.rT); }
    const shrunk = G.clamp((G.ARENA_R - A.liveR) / 0.5);
    u.uLiveR.value = A.liveR; u.uShrunk.value = shrunk; u.uTime.value = t;
    A.wall.visible = shrunk > 0.01; A.wall.scale.set(A.liveR, 1, A.liveR); A.wall.material.uniforms.uA.value = shrunk * 0.3; A.wall.material.uniforms.uTime.value = t; A.wall.material.uniforms.uCol.value.copy(W.accent);
    // glows
    if (A.glow.decay > 0) A.glow.amt = Math.max(0, A.glow.amt - A.glow.decay * dt);
    if (A.rimG.decay > 0) A.rimG.amt = Math.max(0, A.rimG.amt - A.rimG.decay * dt);
    u.uGlowCol.value.copy(A.glow.col); u.uGlow.value = A.glow.amt; u.uBeat.value = W.beat * 0.6; u.uAccent.value.copy(W.accent);
    // lighting from the sky preset; menu dim
    const menu = p.menu, dim = menu * 0.5;
    u.uKeyCol.value.copy(p.key).multiplyScalar(p.keyI * 0.42); u.uHemi.value.copy(p.hemiS).multiplyScalar(p.hemiI * 1.6); u.uGround.value.copy(p.hemiG).multiplyScalar(p.hemiI * 1.6);
    u.uDim.value = dim; u.uCubeA.value = W.cubes[0].texture; u.uCubeB.value = W.cubes[1].texture; u.uSkyMix.value = W.domeU.uMix.value;
    u.uSkyGain.value = Math.min(1, (W.ceil || 10) * 6);
    // rim material eases toward the skin look
    if (A.rimTo) {
      const k = A.mixDur > 0 ? Math.min(1, dt / A.mixDur * 1.2) : 1, c = A.rimCur, to = A.rimTo;
      c.color.lerp(to.color, k); c.inlay.lerp(to.inlay, k); c.emis.lerp(to.emis, k); c.metal += (to.metal - c.metal) * k; c.rough += (to.rough - c.rough) * k; c.inlayI += (to.inlayI - c.inlayI) * k;
      A.rimMat.color.copy(c.color).multiplyScalar(1 - dim * 0.6); A.rimMat.metalness = c.metal; A.rimMat.roughness = c.rough;
      A.rimMat.emissive.copy(c.emis).add(tmpC.copy(A.rimG.col).multiplyScalar(A.rimG.amt * 0.35)).add(tmpC.copy(W.accent).multiplyScalar(W.beat * 0.12));
      A.inlay.material.color.copy(c.inlay).multiplyScalar((c.inlayI * (0.7 + 0.3 * Math.sin(t * 1.3)) + W.beat * 0.5) * (1 - dim * 0.7)).add(tmpC.copy(A.rimG.col).multiplyScalar(A.rimG.amt * 1.4));
    }
    A.halo.material.uniforms.uCol.value.copy(W.accent).lerp(A.rimCur ? A.rimCur.inlay : W.accent, 0.5); A.halo.material.uniforms.uA.value = 0.1 + A.rimG.amt * 0.12 + shrunk * 0.05;
    // props animation
    const P = A.props[A.skin]; if (!P) return;
    P.t += dt;
    if (P.skin === 'ash') for (const it of P.items) it.sprite.scale.setScalar(it.base * (0.8 + 0.25 * Math.sin(t * 2.3 + it.k) + 0.1 * Math.sin(t * 7.1 + it.k * 3)) * (1 - dim * 0.5));
    else if (P.skin === 'glass') for (const it of P.items) it.bar.material.color.setRGB(1.3, 1.6, 1.8).multiplyScalar((0.5 + 0.5 * Math.sin(t * 0.9 + it.k)) * 0.6 + 0.3);
    else if (P.skin === 'tide') { P.waterU.uTime.value = t; P.waterU.uAccent.value.copy(W.accent); P.waterU.uKeyCol.value.copy(p.key); P.waterU.uDim.value = dim; }
    else if (P.skin === 'storm') {
      P.nextSpark -= dt;
      if (P.nextSpark <= 0) {
        P.nextSpark = 1.2 + Math.random() * 3.5;
        const i = Math.floor(Math.random() * P.items.length), a = P.items[i], b = P.items[(i + 1 + Math.floor(Math.random() * 2)) % P.items.length];
        a.flash = 1; b.flash = 0.7;
        try { G.fx?.lightning?.(a.pos, b.pos, { color: '#d8c0ff', width: 0.16, life: 0.2, segments: 7, jag: 0.08 }); } catch (e) { /* fx may be missing */ }
        try { G.audio?.sfx?.('spark', { vol: 0.25 }); } catch (e) { /* */ }
        W.beat = Math.max(W.beat, 0.25);
      }
      for (const it of P.items) { it.flash = Math.max(0, it.flash - dt * 4); it.sprite.scale.setScalar((1.0 + it.flash * 3.2) * (0.9 + 0.1 * Math.sin(t * 5 + it.k * 9))); it.tip.material.color.setRGB(0.72, 0.48, 1).multiplyScalar(1.2 + it.flash * 4); }
    } else if (P.skin === 'throne') {
      for (const it of P.items) it.sprite.scale.setScalar(it.base * (0.9 + 0.1 * Math.sin(t * 1.7 + it.k)) * (1 - dim * 0.35));
      P.goldM.color.setRGB(1, 0.83, 0.42).multiplyScalar((1.0 + W.beat * 0.6) * (1 - dim * 0.55));
    }
  }
  // ==================================================================
  // Sky
  // ==================================================================
  const SKY_R = 1000;
  function buildSky() {
    const sky = G.layers.sky;
    // ---- nebula bake (cube) ----
    const hdr = G.gfx.hdr;
    const cubeSize = G.quality.tier === 'low' ? 256 : 512;
    const mkCube = () => new T.WebGLCubeRenderTarget(cubeSize, { type: hdr ? T.HalfFloatType : T.UnsignedByteType, generateMipmaps: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    W.cubes = [mkCube(), mkCube()];
    W.cubeCam = new T.CubeCamera(0.5, 100, W.cubes[0]);
    W.bakeScene = new T.Scene();
    W.bakeMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: {
        uBaseA: { value: new C() }, uBaseB: { value: new C() }, uDownPow: { value: 2.5 },
        uMilky: { value: 0 }, uMilkyN: { value: new V(0, 0, 1) }, uMilkyCol: { value: new C() }, uMilkyCol2: { value: new C() },
        uNeb: { value: 0 }, uNebA: { value: new C() }, uNebB: { value: new C() }, uNebDir: { value: new V(0, -1, 0) }, uNebSpread: { value: 0.5 }, uNebSeed: { value: 0 },
        uNeb2: { value: 0 }, uNeb2A: { value: new C() }, uNeb2B: { value: new C() }, uNeb2Dir: { value: new V(0, -1, 0) },
        uDusk: { value: 0 }, uDuskCol: { value: new C() }, uDuskDir: { value: new V(0, 0, -1) },
        uStorm: { value: 0 }, uStormCol: { value: new C('#264d4d') }, uAur: { value: 0 }, uAurCol: { value: new C() }, uAurCol2: { value: new C() }, uGain: { value: 0.55 },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */`
        uniform vec3 uBaseA, uBaseB, uMilkyN, uMilkyCol, uMilkyCol2, uNebA, uNebB, uNebDir, uNeb2A, uNeb2B, uNeb2Dir, uDuskCol, uDuskDir, uAurCol, uAurCol2, uStormCol;
        uniform float uDownPow, uMilky, uNeb, uNebSpread, uNebSeed, uNeb2, uDusk, uStorm, uAur, uGain;
        varying vec3 vDir; ${NOISE}
        vec3 nebula(vec3 d, vec3 dir, float spread, float seed, vec3 a, vec3 b){
          float nd = dot(d, dir); float m = smoothstep(1. - spread, 1. - spread * .25, nd);
          float n1 = fbm(d * 2.4 + seed); float n2 = fbm(d * 5.3 - seed + n1 * 1.8);
          float dens = m * smoothstep(.38, .95, n1 * .55 + n2 * .65);
          vec3 c = mix(a, b, smoothstep(.35, .8, n2));
          float wisps = pow(smoothstep(.5, .9, fbm(d * 11. + seed * 2.)), 2.) * m;
          return c * dens * (.5 + 1.8 * pow(n2, 3.)) + b * wisps * .25;
        }
        void main(){
          vec3 d = normalize(vDir);
          float down = clamp(-d.y, 0., 1.);
          vec3 col = mix(uBaseB, uBaseA, pow(down, uDownPow));
          col += uBaseA * .25 * fbm3(d * 3. + 11.);
          // milky way band with dust lanes
          float bd = dot(d, uMilkyN); float band = exp(-bd * bd * 14.); float core = exp(-bd * bd * 70.);
          float n = fbm(d * 3.6 + 7.), dust = fbm(d * 8.5 + 3.), fine = fbm(d * 26. + 5.);
          vec3 mw = mix(uMilkyCol, uMilkyCol2, smoothstep(.35, .8, n)) * (band * (.12 + .7 * n * n) + core * .7 * n * n);
          mw *= 1. - smoothstep(.4, .62, dust) * .9 * band;
          mw += uMilkyCol2 * band * pow(fine, 5.) * 2.4 * (1. - smoothstep(.45, .6, dust));
          col += mw * uMilky;
          if (uNeb > .001) col += nebula(d, uNebDir, uNebSpread, uNebSeed, uNebA, uNebB) * uNeb;
          if (uNeb2 > .001) col += nebula(d, uNeb2Dir, uNebSpread * .8, uNebSeed + 13.7, uNeb2A, uNeb2B) * uNeb2;
          // dusk glow
          float dd = max(0., dot(d, uDuskDir)); col += uDuskCol * (pow(dd, 6.) * .9 + pow(dd, 2.) * .15) * uDusk;
          // aurora veil (diffuse sheets)
          if (uAur > .001) { float a1 = fbm(vec3(d.x * 3., d.z * 3., d.y * 1.5) + 4.); float v = smoothstep(.45, .8, a1) * smoothstep(.05, .7, down);
            col += mix(uAurCol, uAurCol2, smoothstep(.4, .9, fbm3(d * 5.))) * v * uAur * .5; }
          // storm clouds: heavy dark masses with lit edges
          if (uStorm > .001) { float cl = fbm(d * 2.6 + vec3(0., 0., 4.)); float m = smoothstep(.36, .56, cl);
            col = mix(col, col * .18 + vec3(.015, .02, .035), uStorm * m) + uStormCol * uStorm * smoothstep(.6, .62, cl) * (1. - smoothstep(.62, .7, cl)) * .3; }
          col *= uGain;
          { vec2 fc = gl_FragCoord.xy; col += (fract(52.9829189 * fract(dot(fc, vec2(.06711056, .00583715)))) - .5) * (1. / 255.); }   // 8-bit cubes: dither
          gl_FragColor = vec4(max(col, vec3(0.)), 1.);
        }`,
    });
    W.bakeScene.add(new T.Mesh(new T.SphereGeometry(50, 64, 32), W.bakeMat));

    // ---- live dome ----
    W.domeU = {
      uCubeA: { value: W.cubes[0].texture }, uCubeB: { value: W.cubes[1].texture }, uMix: { value: 0 },
      uTime: { value: 0 }, uStars: { value: 1 }, uPix: { value: 0.0008 }, uStarTint: { value: new C('#ffffff') },
      uHole: { value: 0 }, uHoleDir: { value: new V(0.3, -0.6, -0.7).normalize() }, uHoleR: { value: 0.11 },
      uFlash: { value: 0 }, uFlashCol: { value: new C('#cfe6ff') }, uDim: { value: 0 }, uTwinkle: { value: 1 },
      uDither: { value: 1 }, uCeil: { value: 10 },   // soft luminance ceiling of the baked sky (play readability; set per frame in update)
    };
    const dome = new T.Mesh(new T.SphereGeometry(SKY_R, 64, 32), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, depthTest: false, uniforms: W.domeU,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */`
        uniform samplerCube uCubeA, uCubeB; uniform float uMix, uTime, uStars, uPix, uHole, uHoleR, uFlash, uDim, uTwinkle, uCeil, uDither;
        uniform vec3 uHoleDir, uFlashCol, uStarTint; varying vec3 vDir;
        float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
        vec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
        vec3 starLayer(vec3 d, float scale, float dens, float sz, float bright){
          vec3 p = d * scale; vec3 c = floor(p); vec3 f = p - c;
          float h = h13(c); if (h > dens) return vec3(0.);
          vec3 o = h33(c) * .7 + .15; float dist = length(f - o) / scale;
          float sig = max(uPix * .75, sz);
          float b = (1. - h / dens); b = b * b * bright;
          float tw = 1. - uTwinkle * .35 * (.5 + .5 * sin(uTime * (1.5 + h * 7.) + h * 60.));
          float I = exp(-dist * dist / (2. * sig * sig)) * (sz * sz) / (sig * sig) * b * tw;
          vec3 tint = mix(vec3(1., .82, .62), vec3(.7, .82, 1.), h33(c + 7.).x);
          return tint * I;
        }
        vec3 rot(vec3 v, vec3 k, float a){ return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1. - cos(a)); }
        void main(){
          vec3 d = normalize(vDir); vec3 dl = d; float shadow = 0., pring = 0.;
          if (uHole > .001) {
            float ca = clamp(dot(d, uHoleDir), -1., 1.); float a = acos(ca);
            vec3 ax = cross(uHoleDir, d); float al = length(ax);
            if (al > 1e-5) { ax /= al; float R = uHoleR; float defl = uHole * R * R * 1.6 / max(a, R * .35); dl = rot(d, ax, -defl); }
            shadow = smoothstep(uHoleR * 1.04, uHoleR * .96, a) * uHole;
            pring = (exp(-pow((a - uHoleR * 1.12) / (uHoleR * .05), 2.)) * 1.2 + exp(-pow((a - uHoleR * 1.3) / (uHoleR * .25), 2.)) * .25) * uHole;
          }
          vec3 col = mix(textureCube(uCubeA, dl).rgb, textureCube(uCubeB, dl).rgb, uMix);
          // soft knee on the nebula/aurora luminance: bright skies keep their hue and structure but stay dark enough
          // behind the play area that gold rings, the knight and the accent telegraphs pop
          { float l = max(dot(col, vec3(.2126, .7152, .0722)), .5 * max(col.r, max(col.g, col.b))); col *= uCeil * (1. - exp(-l / uCeil)) / max(l, 1e-5); }
          vec3 st = starLayer(dl, 70., .16, .0008, 1.9) + starLayer(dl, 180., .22, .00058, 1.15) + starLayer(dl, 420., .3, .00045, .7);
          col *= 1. + uFlash * 3.;
          col += min(st * uStars * uStarTint, vec3(.8)) * (1. + uFlash * .4);
          col += uFlashCol * uFlash * .08;
          col = mix(col, vec3(0.), shadow);
          col += vec3(1.1, .9, .7) * pring * .6;
          col *= 1. - uDim;
          // triangular dither at the step of an 8-bit linear target (safe level 2+ / no float targets): no sky banding
          { vec2 fc = gl_FragCoord.xy + fract(uTime * 7.13) * 41.; float n = fract(52.9829189 * fract(dot(fc, vec2(.06711056, .00583715)))) + fract(52.9829189 * fract(dot(fc.yx + 17.3, vec2(.06711056, .00583715)))) - 1.;
            col += n * uDither * (.6 / 255.) * step(.0005, col.r + col.g + col.b); col = max(col, vec3(0.)); }
          gl_FragColor = vec4(col, 1.);
          ${SHADER_TAIL}
        }`,
    }));
    dome.renderOrder = -100; dome.frustumCulled = false;
    sky.add(dome); W.dome = dome;

    // ---- constellations (self-drawing) ----
    buildConstellations(sky);
    // ---- meteors / sky bolts (camera-facing streak quads) ----
    buildStreaks(sky);
    // ---- celestial bodies: sun, corona, black hole disk ----
    buildCelestial(sky);
    // ---- aurora curtains (world-placed, far below and around) ----
    buildCurtains();
  }

  function bake(cubeIdx, p) {
    const U = W.bakeMat.uniforms;
    for (const k of ['baseA', 'baseB', 'milkyCol', 'milkyCol2', 'nebA', 'nebB', 'neb2A', 'neb2B', 'duskCol', 'aurCol', 'aurCol2', 'stormCol']) U['u' + k[0].toUpperCase() + k.slice(1)].value.set(p[k] || (k === 'stormCol' ? '#264d4d' : '#000000'));
    for (const k of ['milky', 'neb', 'nebSpread', 'nebSeed', 'neb2', 'dusk', 'storm', 'aur', 'downPow']) if (p[k] != null) U['u' + k[0].toUpperCase() + k.slice(1)].value = p[k];
    for (const k of ['milkyN', 'nebDir', 'neb2Dir', 'duskDir']) if (p[k]) U['u' + k[0].toUpperCase() + k.slice(1)].value.set(...p[k]).normalize();
    try {
      W.cubeCam.renderTarget = W.cubes[cubeIdx];
      W.cubeCam.update(G.renderer, W.bakeScene);
    } catch (e) { G.log.error('world.bake', e); }
  }

  function buildConstellations(sky) {
    // procedurally laid out figures in the directions the play camera sees (below/ahead) + some for the menu view
    // play camera basis: forward 56 deg down toward -z; constellations sit around (not behind) the arena
    const P = G.deg(56), f = new V(0, -Math.sin(P), -Math.cos(P)), up = new V(0, Math.cos(P), -Math.sin(P)), rt = new V(1, 0, 0);
    const at = (a, b) => f.clone().addScaledVector(rt, a).addScaledVector(up, b).normalize().toArray();
    const centers = [at(-0.56, 0.05), at(0.58, -0.02), at(-0.42, 0.3), at(0.4, 0.31), at(-0.5, -0.3), at(0.52, -0.28), at(0.02, 0.36), at(-0.05, -0.36), at(-0.9, 0.2), at(0.92, 0.15)];
    const pos = [], aOrd = [], aAl = [], spos = [], sOrd = [];
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const R = 880;
    centers.forEach((c, ci) => {
      const cd = new V(...c).normalize();
      const t1 = new V().crossVectors(cd, new V(0, 1, 0.3)).normalize(), t2 = new V().crossVectors(cd, t1).normalize();
      const n = 5 + Math.floor(rnd() * 4), pts = [];
      let u = (rnd() - 0.5) * 0.05, v = (rnd() - 0.5) * 0.05;
      for (let i = 0; i < n; i++) {
        u += (rnd() - 0.5) * 0.16; v += (rnd() - 0.5) * 0.16;
        pts.push(cd.clone().addScaledVector(t1, u).addScaledVector(t2, v).normalize().multiplyScalar(R));
      }
      const order0 = ci * 0.6;
      for (let i = 0; i < n; i++) { spos.push(pts[i].x, pts[i].y, pts[i].z); sOrd.push(order0 + i); }
      for (let i = 1; i < n; i++) {
        const from = (i > 2 && rnd() < 0.3) ? Math.floor(rnd() * (i - 1)) : i - 1;
        pos.push(pts[from].x, pts[from].y, pts[from].z, pts[i].x, pts[i].y, pts[i].z);
        aOrd.push(order0 + i - 1, order0 + i - 1); aAl.push(0, 1);
      }
    });
    const lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); lg.setAttribute('aOrd', new T.Float32BufferAttribute(aOrd, 1)); lg.setAttribute('aAl', new T.Float32BufferAttribute(aAl, 1));
    W.conU = { uDraw: { value: 0 }, uA: { value: 0 }, uCol: { value: new C('#ffd89a') }, uTime: { value: 0 } };
    W.conU.uCol.value.set('#ffe2a8');
    const lines = new T.LineSegments(lg, new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, uniforms: W.conU,
      vertexShader: 'attribute float aOrd; attribute float aAl; varying float vO; varying float vAl; void main(){ vO = aOrd; vAl = aAl; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform float uDraw, uA; uniform vec3 uCol; varying float vO; varying float vAl; void main(){ float p = uDraw - vO; if (vAl > p) discard; float head = smoothstep(.25, 0., p - vAl); gl_FragColor = vec4(min(uCol * uA * (.62 + head * .9), vec3(.6)), 1.); }' }));
    lines.frustumCulled = false; lines.renderOrder = -90; sky.add(lines);
    const sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.Float32BufferAttribute(spos, 3)); sg.setAttribute('aOrd', new T.Float32BufferAttribute(sOrd, 1));
    const stars = new T.Points(sg, new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, uniforms: W.conU,
      vertexShader: 'attribute float aOrd; uniform float uDraw, uTime; varying float vK; void main(){ float p = clamp((uDraw - aOrd + .4) * 2., 0., 1.); vK = p; gl_PointSize = (5. + 9. * (1. - p) * p * 4. + sin(uTime * 2. + aOrd) * 1.) ; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform float uA; uniform vec3 uCol; varying float vK; void main(){ vec2 q = gl_PointCoord * 2. - 1.; float r = dot(q, q); if (r > 1.) discard; float s = exp(-r * 7.) + (exp(-abs(q.x) * 12.) + exp(-abs(q.y) * 12.)) * (1. - r) * .6; gl_FragColor = vec4(min(mix(uCol, vec3(1.), .5) * max(s, 0.) * uA * vK * 1.6, vec3(.62)), 1.); }' }));
    stars.frustumCulled = false; stars.renderOrder = -89; sky.add(stars);
    W.conLines = lines; W.conStars = stars; W.conMax = centers.length * 0.6 + 9;
  }

  function buildStreaks(sky) {
    W.streaks = [];
    const geo = new T.PlaneGeometry(1, 1).translate(0.5, 0, 0);
    for (let i = 0; i < 40; i++) {
      const m = new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, side: T.DoubleSide,
        uniforms: { uCol: { value: new C() }, uA: { value: 0 }, uHead: { value: 1 }, uTail: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: 'uniform vec3 uCol; uniform float uA, uHead, uTail; varying vec2 vUv; void main(){ float y = abs(vUv.y - .5) * 2.; float c = exp(-y * y * 9.); float t = smoothstep(uHead - uTail, uHead, vUv.x) * step(vUv.x, uHead); gl_FragColor = vec4(min((uCol * c + vec3(c * c * c)) * t * uA, vec3(1.6)), 1.); }' });
      const mesh = new T.Mesh(geo, m); mesh.matrixAutoUpdate = false; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = -80;
      mesh.userData = { a: new V(), b: new V(), life: 0, max: 1, w: 2, kind: 'meteor' };
      sky.add(mesh); W.streaks.push(mesh);
    }
  }
  const bx = new V(), by = new V(), bz = new V(), bm = new T.Matrix4();
  function placeStreak(mesh, a, b, w) {
    bx.subVectors(b, a); const len = bx.length(); if (len < 1e-3) return;
    bx.multiplyScalar(1 / len); tmpV.addVectors(a, b).multiplyScalar(-0.5).normalize();   // toward the camera (sky origin)
    by.crossVectors(tmpV, bx).normalize(); bz.crossVectors(bx, by);
    bm.makeBasis(bx.multiplyScalar(len), by.multiplyScalar(w), bz); bm.setPosition(a); mesh.matrix.copy(bm); mesh.matrixWorldNeedsUpdate = true;
  }
  function takeStreak() { for (const s of W.streaks) if (!s.visible) return s; return null; }
  // directions the play camera / menu camera sees
  function randomSkyDir() {
    const menuish = W.cur && W.preset === 'menu';
    if (menuish) return new V((Math.random() - 0.5) * 1.6, -0.05 + Math.random() * 0.4, -1).normalize();
    return new V((Math.random() - 0.5) * 1.8, -0.4 - Math.random() * 0.55, -0.35 - Math.random() * 0.6).normalize();
  }
  function meteor(color = '#fff2d0') {
    const s = takeStreak(); if (!s) return;
    const u = s.userData, R = 800;
    const d0 = randomSkyDir(), dir = new V((Math.random() - 0.5), (Math.random() - 0.5) * 0.4, (Math.random() - 0.5)).normalize();
    u.a.copy(d0).multiplyScalar(R); u.b.copy(d0).addScaledVector(dir, 0.12 + Math.random() * 0.12).normalize().multiplyScalar(R);
    u.life = u.max = 0.5 + Math.random() * 0.6; u.w = 1.6 + Math.random() * 1.6; u.kind = 'meteor';
    s.material.uniforms.uCol.value.set(color).multiplyScalar(1.5); s.material.uniforms.uTail.value = 0.45;
    s.visible = true; placeStreak(s, u.a, u.b, u.w);
    if (Math.random() < 0.3) G.audio?.sfx?.('meteor', { vol: 0.5 });
  }
  function skyBolt(color = '#d6ecff') {
    const R = 780;
    const d0 = randomSkyDir(); const down = new V((Math.random() - 0.5) * 0.3, -1, (Math.random() - 0.5) * 0.3).normalize();
    let prev = d0.clone().multiplyScalar(R);
    const segs = 9, len = 0.28 + Math.random() * 0.2;
    let branchLeft = 2;
    const mk = (a, b, w, life) => { const s = takeStreak(); if (!s) return; const u = s.userData; u.a.copy(a); u.b.copy(b); u.life = u.max = life; u.w = w; u.kind = 'bolt'; s.material.uniforms.uCol.value.set(color).multiplyScalar(2.2); s.material.uniforms.uTail.value = 2; s.material.uniforms.uHead.value = 1; s.visible = true; placeStreak(s, a, b, w); };
    for (let i = 1; i <= segs; i++) {
      const p = d0.clone().addScaledVector(down, len * i / segs).add(new V((Math.random() - 0.5) * 0.045, 0, (Math.random() - 0.5) * 0.045)).normalize().multiplyScalar(R);
      mk(prev, p, 3.2, 0.28);
      if (branchLeft > 0 && Math.random() < 0.3) { branchLeft--; const q = p.clone().normalize().add(new V((Math.random() - 0.5) * 0.08, -0.05, (Math.random() - 0.5) * 0.08)).normalize().multiplyScalar(R); mk(p, q, 1.8, 0.22); }
      prev = p;
    }
    W.flash = Math.max(W.flash, 0.6 + Math.random() * 0.4);
    G.post?.bloomPulse?.(0.25, 0.4);
    G.audio?.sfx?.('thunder', { delay: 0.25 + Math.random() * 0.9, vol: 0.5 + Math.random() * 0.4 });
  }
  function updateStreaks(dt) {
    for (const s of W.streaks) {
      if (!s.visible) continue;
      const u = s.userData; u.life -= dt;
      if (u.life <= 0) { s.visible = false; continue; }
      const k = 1 - u.life / u.max, U = s.material.uniforms;
      if (u.kind === 'meteor') { U.uHead.value = Math.min(1, k * 1.4); U.uA.value = k < 0.7 ? 1 : (1 - k) / 0.3; }
      else if (u.kind === 'bar') { U.uA.value = Math.sin(k * Math.PI) * 0.55; }
      else { U.uA.value = (1 - k) * (0.5 + 0.5 * Math.random()); }
    }
  }

  function buildCelestial(sky) {
    const cel = new T.Group(); sky.add(cel); W.cel = cel;
    // sun billboard
    W.sunU = { uNoise: { value: getNoiseTex() }, uTime: { value: 0 }, uCol: { value: new C('#ff4a1c') }, uCorona: { value: 0 }, uCollapse: { value: 0 }, uA: { value: 0 }, uHot: { value: new C('#ffd27a') } };
    const sun = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, uniforms: W.sunU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */`uniform float uTime, uCorona, uCollapse, uA; uniform vec3 uCol, uHot; uniform sampler2D uNoise; varying vec2 vUv;
        float tn(vec2 q){ return texture2D(uNoise, q).r; }
        void main(){
          // the quad spans 2.6 sun radii
          vec2 p = vUv * 2.6; float r = length(p); float ang = atan(p.y, p.x);
          vec3 c = vec3(0.);
          if (r < 1.) {
            float mu = sqrt(1. - r * r);
            vec2 q = p / (.6 + .4 * mu);   // slight sphere warp
            float g = texture2D(uNoise, q * .45 + vec2(uTime * .004, 0.)).g; float g2 = texture2D(uNoise, q * 1.3 - vec2(0., uTime * .01)).b;
            float spots = smoothstep(.7, .78, texture2D(uNoise, q * .11 + .3).r);
            vec3 base = mix(uCol * .55, mix(uCol, uHot, .45), g) * (.35 + .75 * pow(mu, .55)) * (.85 + .3 * g2);
            base *= 1. - spots * .7;
            c = base * 1.15;
          }
          float edge = smoothstep(1.0, .985, r);
          c *= edge;
          // limb glow + corona streamers
          float halo = exp(-(r - 1.) * 4.) * step(1., r) * .7 + exp(-max(r - 1., 0.) * 1.4) * step(1., r) * .25;
          float au = ang / 6.2831853;
          float rays = texture2D(uNoise, vec2(au * 4., r * .1 - uTime * .02)).r; rays = pow(rays, 2.) * 2.4;
          float flares = pow(texture2D(uNoise, vec2(au * 3., uTime * .012)).g, 5.) * exp(-(r - 1.) * 2.2) * step(1., r) * 7.;
          c += uCol * halo * 1.1 + mix(uCol, uHot, .4) * (rays * exp(-(r - 1.) * 2.) * step(1., r) + flares) * uCorona * .7;
          // collapse: hot white-violet core
          c = mix(c, vec3(1.6, 1.4, 2.0) * (exp(-r * r * 3.) * 1.6 + halo * .6), uCollapse * .7);
          float fade = smoothstep(2.6, 1.9, r);
          gl_FragColor = vec4(c * fade * uA, 1.);
          ${SHADER_TAIL}
        }`,
    }));
    sun.frustumCulled = false; sun.renderOrder = -70; cel.add(sun); W.sun = sun;
    // accretion disk around the hole
    W.diskU = { uNoise: { value: getNoiseTex() }, uTime: { value: 0 }, uA: { value: 0 }, uHoleDir: { value: W.domeU.uHoleDir.value }, uHoleR: W.domeU.uHoleR, uIn: { value: 1.25 }, uOut: { value: 3.6 } };
    const diskGeo = new T.RingGeometry(1.25, 3.6, 160, 6);
    const disk = new T.Mesh(diskGeo, new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: W.diskU,
      vertexShader: 'varying vec2 vP; varying vec3 vW; void main(){ vP = position.xy; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */`uniform float uTime, uA, uIn, uOut; uniform vec3 uHoleDir; uniform float uHoleR; uniform sampler2D uNoise; varying vec2 vP; varying vec3 vW;
        void main(){
          float r = length(vP), a = atan(vP.y, vP.x);
          float u = (r - uIn) / (uOut - uIn);
          // far half (behind the hole) is hidden inside the shadow
          vec3 d = normalize(vW); float ang = acos(clamp(dot(d, uHoleDir), -1., 1.));
          float far = step(0., vP.y);
          if (far > .5 && ang < uHoleR * 1.02) discard;
          float swirl = texture2D(uNoise, vec2(a / 6.2831853 * 3. + r * .25 - uTime * .25 / r, r * .35)).r;
          float bands = .6 + .4 * sin(r * 22. - uTime * 3. + swirl * 4.);
          float dop = 1. + .75 * cos(a + .3);                 // doppler beaming: one side brighter
          float prof = smoothstep(0., .08, u) * pow(1. - u, 1.6);
          vec3 hot = vec3(3., 2.6, 2.2), mid = vec3(2.4, 1.1, .45), cool = vec3(.8, .3, 1.4);
          vec3 c = mix(hot, mix(mid, cool, smoothstep(.3, 1., u)), smoothstep(0., .4, u));
          gl_FragColor = vec4(c * prof * bands * (.4 + swirl) * dop * uA * .38, 1.);
          ${SHADER_TAIL}
        }`,
    }));
    disk.frustumCulled = false; disk.renderOrder = -60; cel.add(disk); W.disk = disk;
    // lensed upper image of the disk (halo arc facing the camera)
    const halo = new T.Mesh(new T.RingGeometry(1.08, 1.55, 128, 1), new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { uA: W.diskU.uA, uTime: W.diskU.uTime },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uA, uTime; varying vec2 vP; void main(){ float r = length(vP), a = atan(vP.y, vP.x); float u = (r - 1.08) / .47;
        float prof = smoothstep(0., .15, u) * pow(1. - u, 2.);
        float k = .55 + .45 * sin(a * 9. - uTime * 2.);
        float side = .6 + .4 * sin(a);   // brighter on top
        gl_FragColor = vec4(vec3(2.6, 1.6, .9) * prof * k * side * uA * .3, 1.); ${SHADER_TAIL} }`,
    }));
    halo.frustumCulled = false; halo.renderOrder = -59; cel.add(halo); W.diskHalo = halo;
    // infall streaks around a collapsing star (spiral sparks): a points cloud
    const N = 600, pp = new Float32Array(N * 3), seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) { seeds[i] = Math.random(); pp[i * 3] = Math.random(); pp[i * 3 + 1] = Math.random(); pp[i * 3 + 2] = 0; }
    const ig = new T.BufferGeometry(); ig.setAttribute('position', new T.BufferAttribute(pp, 3)); ig.setAttribute('aSeed', new T.BufferAttribute(seeds, 1));
    W.infallU = { uTime: { value: 0 }, uA: { value: 0 }, uScale: { value: 60 } };
    const inf = new T.Points(ig, new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, uniforms: W.infallU,
      vertexShader: `attribute float aSeed; uniform float uTime, uScale; varying float vK;
        void main(){ float t = fract(aSeed * 7.31 + uTime * (.08 + aSeed * .12)); float r = mix(5.5, .9, t * t); float a = aSeed * 6.2831 * 13. + t * 9. / (r * .3);
          vec3 p = vec3(cos(a) * r, sin(a) * r * .35, 0.) * uScale / 3.6; vK = t * (1. - t) * 4.;
          vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = 2. + 3. * vK; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform float uA; varying float vK; void main(){ vec2 q = gl_PointCoord * 2. - 1.; float s = exp(-dot(q, q) * 4.); gl_FragColor = vec4(vec3(1.6, 1.1, 2.) * s * vK * uA, 1.); }' }));
    inf.frustumCulled = false; inf.renderOrder = -58; cel.add(inf); W.infall = inf;
  }

  function placeCelestial(p) {
    // position the sun / hole along the configured direction at sky distance, facing the camera
    const dir = W.celDir, D = 860;
    const ang = Math.max(0.01, p.sunSize * 0.2);   // angular radius (rad)
    W.sun.position.copy(dir).multiplyScalar(D);
    W.sun.lookAt(G.camera.position);
    // portrait: horizontal FOV is narrow, so shrink the sun to keep the arena readable
    const asp = (G.camera && G.camera.aspect) || 1.6, aMul = asp >= 1.15 ? 1 : Math.pow(G.clamp(asp / 1.15, 0.4, 1), 0.7);
    W.sun.scale.setScalar(Math.tan(ang) * D * 2.6 * aMul);
    const hr = W.domeU.uHoleR.value;
    W.disk.position.copy(dir).multiplyScalar(D * 0.98);
    // disk plane: nearly edge-on, tilted toward the camera a little
    W.disk.lookAt(G.camera.position); W.disk.rotateX(-1.32); W.disk.rotateZ(0.25);
    W.disk.scale.setScalar(Math.tan(hr) * D);
    W.diskHalo.position.copy(dir).multiplyScalar(D * 0.985); W.diskHalo.lookAt(G.camera.position); W.diskHalo.rotateZ(0.25);
    W.diskHalo.scale.setScalar(Math.tan(hr) * D * 0.985);
    W.infall.position.copy(W.sun.position); W.infall.lookAt(G.camera.position); W.infall.rotateZ(0.25);
    W.infallU.uScale.value = Math.tan(0.2) * D * 0.5;
  }

  function buildCurtains() {
    W.curtains = [];
    W.curtU = { uNoise: { value: getNoiseTex() }, uTime: { value: 0 }, uA: { value: 0 }, uC1: { value: new C('#3dffa2') }, uC2: { value: new C('#ff5f9e') }, uC3: { value: new C('#7a5cff') }, uSpeed: { value: 1 }, uFlash: { value: 0 } };
    const g = new T.Group(); g.name = 'curtains'; G.layers.sky.parent.add(g); W.curtGroup = g;
    // snaking ribbons hanging far below the arena (seen from above, like aurora from orbit)
    const defs = [
      { pts: [[-190, -70], [-110, -130], [-20, -100], [60, -150], [170, -120]], y0: -150, h: 62, seed: 1 },
      { pts: [[-170, -210], [-60, -185], [40, -225], [150, -200]], y0: -175, h: 75, seed: 2 },
      { pts: [[-160, 10], [-140, -30], [-175, -90]], y0: -140, h: 55, seed: 3 },
      { pts: [[150, 20], [130, -40], [185, -90], [160, -140]], y0: -140, h: 58, seed: 4 },
    ];
    for (const d of defs) {
      const curve = new T.CatmullRomCurve3(d.pts.map(([x, z]) => new V(x, 0, z)), false, 'centripetal');
      const N = 220, len = curve.getLength();
      const pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), seedA = new Float32Array((N + 1) * 2), idx = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, q = curve.getPointAt(u);
        const topH = d.h * (0.65 + 0.35 * Math.sin(u * 17 + d.seed) * Math.sin(u * 5.3 + d.seed * 2));
        pos.set([q.x, 0, q.z, q.x, topH, q.z], i * 6);
        uv.set([u, 0, u, 1], i * 4); seedA[i * 2] = seedA[i * 2 + 1] = d.seed + len * 0.001;
        if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setAttribute('aSeed', new T.BufferAttribute(seedA, 1));
      geo.setIndex(idx); geo.computeBoundingSphere();
      const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: W.curtU,
        vertexShader: `attribute float aSeed; uniform float uTime, uSpeed; varying vec2 vUv; varying float vS; varying float vLen; varying vec3 vWp;
          void main(){ vUv = uv; vS = aSeed; vec3 p = position; float t = uTime * uSpeed;
            p.x += sin(uv.x * 31. + t * .45 + aSeed) * 3.5 * (.3 + uv.y);
            p.z += sin(uv.x * 23. - t * .35 + aSeed * 3.) * 4. * (.3 + uv.y) + sin(uv.x * 71. + t * .9) * .8;
            vWp = (modelMatrix * vec4(p, 1.)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
        fragmentShader: /* glsl */`uniform float uTime, uA, uSpeed, uFlash; uniform vec3 uC1, uC2, uC3; uniform sampler2D uNoise; varying vec2 vUv; varying float vS; varying vec3 vWp;
          void main(){ float t = uTime * uSpeed;
            // keep the area seen through the arena calm: project this fragment onto the play plane
            vec3 rd = vWp - cameraPosition; float hk = -cameraPosition.y / min(rd.y, -1e-3);
            float behind = mix(.22, 1., smoothstep(12., 21., length(cameraPosition.xz + rd.xz * hk)));
            float r1 = texture2D(uNoise, vec2(vUv.x * 9. + vS * .37 + t * .003, vS * .1 + t * .004)).a;
            float r2 = texture2D(uNoise, vec2(vUv.x * 3.1 - t * .002, vS * .23)).g;
            float rays = pow(r1 * .65 + r2 * .55, 3.) * 2.6;
            float bottom = smoothstep(0., .04, vUv.y) * (exp(-vUv.y * 9.) * 1.4 + exp(-vUv.y * 2.2) * .35);
            float top = pow(1. - vUv.y, 1.6);
            float ends = smoothstep(0., .08, vUv.x) * smoothstep(1., .92, vUv.x);
            float pulse = .8 + .2 * sin(vUv.x * 13. - t * .7 + vS);
            vec3 c = mix(uC1, uC2, smoothstep(.3, .9, vUv.y)); c = mix(c, uC3, smoothstep(.75, 1., vUv.y) * .5);
            float I = (bottom * (1.2 + rays * .6) + rays * top * .8) * ends * pulse;
            gl_FragColor = vec4(c * I * uA * behind * (1. + uFlash * 1.5), 1.); }` });
      const mesh = new T.Mesh(geo, mat);
      mesh.position.y = d.y0; mesh.renderOrder = -50; mesh.frustumCulled = false;
      g.add(mesh); W.curtains.push(mesh);
    }
  }


  // ==================================================================
  // Particle layers: embers (ember sky), rain (storm 3), prism bars + shards (glass)
  // ==================================================================
  function buildParticles() {
    const root = G.layers.sky.parent;
    // embers: points rising around (and a little over) the arena
    const N = G.quality.tier === 'low' ? 320 : 640;
    const pp = new Float32Array(N * 3), sd = new Float32Array(N);
    for (let i = 0; i < N; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 36; pp[i * 3] = Math.cos(a) * r; pp[i * 3 + 1] = Math.random() * 34; pp[i * 3 + 2] = Math.sin(a) * r; sd[i] = Math.random(); }
    const eg = new T.BufferGeometry(); eg.setAttribute('position', new T.BufferAttribute(pp, 3)); eg.setAttribute('aSeed', new T.BufferAttribute(sd, 1));
    W.emberU = { uTime: { value: 0 }, uA: { value: 0 }, uPx: { value: 1 } };
    const embers = new T.Points(eg, new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: W.emberU,
      vertexShader: `attribute float aSeed; uniform float uTime, uPx; varying float vK; varying float vHot;
        void main(){ vec3 p = position; float sp = 1.2 + aSeed * 2.2; p.y = mod(p.y + uTime * sp, 34.) - 5.;
          p.x += sin(uTime * (.5 + aSeed) + aSeed * 40.) * (1. + aSeed * 2.); p.z += cos(uTime * (.4 + aSeed * .7) + aSeed * 23.) * (1. + aSeed);
          float r = length(p.xz); float over = smoothstep(9., 16., r); vHot = aSeed; vK = (.35 + .65 * over) * smoothstep(-5., 0., p.y) * smoothstep(29., 18., p.y);
          vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = min((2.2 + aSeed * 3.) * uPx * 140. / max(-mv.z, 10.), 9. * uPx); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uA; varying float vK; varying float vHot; void main(){ vec2 q = gl_PointCoord * 2. - 1.; float d = dot(q, q); if (d > 1.) discard; float s = exp(-d * 3.5);
        vec3 c = mix(vec3(1.4, .32, .05), vec3(1.8, .9, .35), vHot * vHot); gl_FragColor = vec4(min(c * s * vK * uA, vec3(.9)), 1.); }` }));
    embers.frustumCulled = false; embers.renderOrder = 4; embers.visible = false; root.add(embers); W.embers = embers;
    // rain: falling line segments outside the disc
    const M = G.quality.tier === 'low' ? 260 : 520;
    const rp = new Float32Array(M * 2 * 3), rs = new Float32Array(M * 2), re = new Float32Array(M * 2);
    for (let i = 0; i < M; i++) {
      const a = Math.random() * TAU, r = 11.5 + Math.sqrt(Math.random()) * 34, x = Math.cos(a) * r, z = Math.sin(a) * r, y = Math.random() * 30, L = 1.4 + Math.random() * 1.6, s = Math.random();
      rp.set([x, y, z, x, y + L, z], i * 6); rs[i * 2] = rs[i * 2 + 1] = s; re[i * 2] = 0; re[i * 2 + 1] = 1;
    }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3)); rg.setAttribute('aSeed', new T.BufferAttribute(rs, 1)); rg.setAttribute('aEnd', new T.BufferAttribute(re, 1));
    W.rainU = { uTime: { value: 0 }, uA: { value: 0 }, uCol: { value: new C('#c8b8ff') } };
    const rain = new T.LineSegments(rg, new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: W.rainU,
      vertexShader: `attribute float aSeed; attribute float aEnd; uniform float uTime; varying float vE;
        void main(){ vec3 p = position; float sp = 20. + aSeed * 10.; float y = 30. - mod(p.y + uTime * sp, 30.); p.x += (30. - y) * .32 + aSeed * 2.; p.y = y - 4.; vE = aEnd;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
      fragmentShader: 'uniform float uA; uniform vec3 uCol; varying float vE; void main(){ gl_FragColor = vec4(uCol * (.25 + .75 * vE) * uA, 1.); }' }));
    rain.frustumCulled = false; rain.renderOrder = 4; rain.visible = false; root.add(rain); W.rain = rain;
  }
  // a slow prismatic light bar across the sky (glass): a long thin streak in a pale hue that fades in and out
  const PRISM_COLS = ['#ffffff', '#bff4ff', '#ffd0f0', '#d0ffe8', '#fff0c0', '#d8c8ff'];
  function prismBar() {
    const s = takeStreak(); if (!s) return;
    const u = s.userData, R = 800;
    const d0 = randomSkyDir(), dir = new V((Math.random() - 0.5), (Math.random() - 0.5) * 0.5, (Math.random() - 0.5)).normalize();
    u.a.copy(d0).addScaledVector(dir, -0.25 - Math.random() * 0.3).normalize().multiplyScalar(R); u.b.copy(d0).addScaledVector(dir, 0.25 + Math.random() * 0.3).normalize().multiplyScalar(R);
    u.life = u.max = 1.6 + Math.random() * 1.8; u.w = 0.5 + Math.random() * 0.7; u.kind = 'bar';
    s.material.uniforms.uCol.value.set(PRISM_COLS[Math.floor(Math.random() * PRISM_COLS.length)]).multiplyScalar(1.1); s.material.uniforms.uTail.value = 1.0; s.material.uniforms.uHead.value = 1;
    s.visible = true; placeStreak(s, u.a, u.b, u.w);
  }
  // shattering: a burst of short cold shards radiating from one point of the sky
  function shardBurst(color = '#dff8ff') {
    const R = 790, d0 = randomSkyDir(), n = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const s = takeStreak(); if (!s) return;
      const u = s.userData, dir = new V((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize();
      u.a.copy(d0).addScaledVector(dir, 0.02).normalize().multiplyScalar(R); u.b.copy(d0).addScaledVector(dir, 0.08 + Math.random() * 0.1).normalize().multiplyScalar(R);
      u.life = u.max = 0.35 + Math.random() * 0.4; u.w = 1 + Math.random() * 1.4; u.kind = 'meteor';
      s.material.uniforms.uCol.value.set(color).multiplyScalar(1.6); s.material.uniforms.uTail.value = 0.6;
      s.visible = true; placeStreak(s, u.a, u.b, u.w);
    }
    W.flash = Math.max(W.flash, 0.25);
  }
  // ==================================================================
  // Presets
  // ==================================================================
  const NIGHT_MW = [0.55, 0.25, -0.8];
  // a direction in the play view: a = right, b = up, in tan units from the view centre
  const VD = (a, b) => { const P = G.deg(56); return new V(a, -Math.sin(P) + b * Math.cos(P), -Math.cos(P) - b * Math.sin(P)).normalize().toArray(); };      // milky way band normal (band crosses the play view diagonally)
  const PRESETS = {
    menu: () => ({
      bake: { baseA: '#141238', baseB: '#05040d', downPow: 1.4, milky: 0.42, milkyN: [0.25, 0.95, 0.2], milkyCol: '#7d86b8', milkyCol2: '#e2cfa6',
        neb: 0.38, nebA: '#3a2a8a', nebB: '#d9a35a', nebDir: [-0.55, 0.08, -0.83], nebSpread: 0.5, nebSeed: 3.1, neb2: 0.25, neb2A: '#24306e', neb2B: '#8fb3ff', neb2Dir: [0.7, 0.2, -0.7],
        dusk: 0.22, duskCol: '#c88a3c', duskDir: [0, -0.12, -1], storm: 0, aur: 0 },
      stars: 1, starTint: '#fff4e0', constel: 0, meteor: 0.12, lightning: 0, curtains: 0, curtSpeed: 1,
      sun: 0, sunSize: 1, sunCol: '#ff6a2a', corona: 0, collapse: 0, hole: 0, infall: 0, dim: 0, twinkle: 1,
      key: '#ffe2b0', keyI: 2.2, rim: '#7f90ff', rimI: 1.1, hemiS: '#8d8cff', hemiG: '#1a0f08', hemiI: 0.5, exposure: 1.0, bloom: 0.8, inlay: 0.85, menu: 1,
      env: { top: '#2a2a6a', mid: '#c89550', bot: '#0a0612', panel: '#fff0d0', panel2: '#ffc070', rim: '#6a7aff' },
    }),
    night: (L) => ({
      bake: { baseA: L >= 2 ? '#0c1d38' : '#100f30', baseB: '#030309', downPow: 2.2, milky: L >= 1 ? 0.5 : 0.42, milkyN: NIGHT_MW, milkyCol: '#3e4a7e', milkyCol2: '#c8bca4',
        neb: L >= 2 ? (L >= 3 ? 1.5 : 1.0) : 0, nebA: '#1d7fa8', nebB: '#bdf4ff', nebDir: VD(-0.62, 0.12), nebSpread: L >= 3 ? 0.75 : 0.55, nebSeed: 1.7,
        neb2: L >= 3 ? 0.8 : 0, neb2A: '#1c3f8a', neb2B: '#7fe8ff', neb2Dir: VD(0.66, -0.12), dusk: 0, duskCol: '#000000', duskDir: [0, -1, 0], storm: 0, aur: L >= 3 ? 0.35 : 0, aurCol: '#5fe3ff', aurCol2: '#a8c8ff' },
      stars: L >= 2 ? 1.1 : 1, starTint: L >= 2 ? '#e8f6ff' : '#fff6e8', constel: L >= 1 ? 1 : 0, meteor: [0, 0.45, 0.6, 1.6][L], meteorCol: L >= 2 ? '#d8f6ff' : '#fff2d0', lightning: 0, curtains: 0, curtSpeed: 1,
      sun: 0, sunSize: 1, sunCol: '#ff6a2a', corona: 0, collapse: 0, hole: 0, infall: 0, dim: 0, twinkle: 1,
      key: L >= 2 ? '#e6f4ff' : '#fff0d6', keyI: 2.2, rim: '#6fb8ff', rimI: 1.2 + L * 0.15, hemiS: L >= 2 ? '#7fb6ff' : '#8a8cff', hemiG: '#0e0b16', hemiI: 0.5, exposure: 1.0 + L * 0.02, bloom: 0.85 + L * 0.06, inlay: 0.8 + L * 0.12, menu: 0,
      env: { top: '#1c2a5a', mid: '#b88f58', bot: '#060814', panel: '#fff4e0', panel2: '#cfe6ff', rim: '#5f8cff' },
    }),
    aurora: (L) => ({
      bake: { baseA: ['#2a1640', '#0f2a36', '#132b2a', '#0a1418'][L], baseB: ['#0b0614', '#040c10', '#05100c', '#020506'][L], downPow: 1.8, milky: [0.35, 0.3, 0.25, 0.1][L], milkyN: NIGHT_MW, milkyCol: '#5a6a8a', milkyCol2: '#c0d8c8',
        neb: L >= 2 ? (L === 3 ? 0.25 : 1.2) : 0, nebA: '#11b877', nebB: '#9cffd0', nebDir: VD(-0.62, -0.1), nebSpread: 0.7, nebSeed: 5.3,
        neb2: L >= 2 ? (L === 3 ? 0.2 : 1.0) : 0, neb2A: '#c23a7a', neb2B: '#ffb0d0', neb2Dir: VD(0.62, 0.18),
        dusk: [0.85, 0.35, 0.15, 0][L], duskCol: '#ff7a4a', duskDir: [0.1, -0.35, -0.93], storm: L === 3 ? 1 : 0, aur: [0.45, 0.8, 0.6, 0.2][L], aurCol: '#3dffa2', aurCol2: '#ff5f9e' },
      stars: [0.65, 0.8, 0.7, 0.35][L], starTint: '#f0fff6', constel: 0, meteor: L === 1 ? 0.15 : 0, lightning: L === 3 ? 0.45 : 0, curtains: [0.3, 1, 1.0, 0.8][L], curtSpeed: L === 3 ? 2.6 : 1,
      sun: 0, sunSize: 1, sunCol: '#ff6a2a', corona: 0, collapse: 0, hole: 0, infall: 0, dim: L === 3 ? 0.05 : 0, twinkle: 1,
      key: ['#ffd2b0', '#d8ffe8', '#e8fff0', '#d0e8ff'][L], keyI: L === 3 ? 1.8 : 2.1, rim: ['#ff8a6a', '#3dffa2', '#ff5f9e', '#7fd0ff'][L], rimI: 1.3, hemiS: '#6fd8b0', hemiG: '#120a14', hemiI: 0.5, exposure: 1.0, bloom: 0.9 + L * 0.05, inlay: 0.85 + L * 0.1, menu: 0,
      env: { top: '#123a3a', mid: '#a88a58', bot: '#06100c', panel: '#f0fff4', panel2: '#ffb0a0', rim: '#3dffa2' },
    }),
    collapse: (L) => ({
      bake: { baseA: ['#2a0a12', '#3a0c14', '#160a1e', '#0a0814'][L], baseB: ['#080306', '#0a0306', '#05030a', '#020206'][L], downPow: 1.6, milky: [0.3, 0.25, 0.2, 0.45][L], milkyN: NIGHT_MW, milkyCol: '#5a4a6a', milkyCol2: '#e0b8a0',
        neb: [0.35, 0.4, 0.55, 0.3][L], nebA: L >= 2 ? '#2a0c3a' : '#7a1a10', nebB: L >= 2 ? '#8a5ab0' : '#ff8a4a', nebDir: VD(-0.62, 0.05), nebSpread: 0.6, nebSeed: 8.2,
        neb2: L >= 1 ? 0.45 : 0, neb2A: L >= 2 ? '#3a0a18' : '#6a1030', neb2B: L >= 2 ? '#c05a40' : '#ff7a5a', neb2Dir: VD(0.1, -0.42), dusk: L <= 1 ? 0.6 : 0.2, duskCol: L <= 1 ? '#ff3a10' : '#8a4cff', duskDir: [0.38, -0.5, -0.78], storm: 0, aur: 0 },
      stars: [0.6, 0.55, 0.5, 1.0][L], starTint: L === 3 ? '#ffffff' : '#ffe8e0', constel: 0, meteor: 0, lightning: 0, curtains: 0, curtSpeed: 1,
      sun: L <= 2 ? 1 : 0, sunSize: [1.0, 1.08, 0.3, 0.05][L], sunCol: ['#ff3a12', '#ff5a1c', '#d8b8ff', '#ffffff'][L], corona: [0.15, 1.0, 1.6, 0][L], collapse: L >= 2 ? 1 : 0,
      hole: L === 3 ? 1 : 0, infall: L === 2 ? 1 : 0, dim: L === 2 ? 0.12 : 0, twinkle: L === 3 ? 0.4 : 1,
      key: ['#ff9a6a', '#ffb070', '#c8a8ff', '#b8a0ff'][L], keyI: 2.4, rim: ['#ff5a2a', '#ff7a3a', '#a77bff', '#a77bff'][L], rimI: 1.5, hemiS: L >= 2 ? '#7a6aff' : '#ff7a5a', hemiG: '#140608', hemiI: 0.55, exposure: 1.0, bloom: 0.95 + L * 0.07, inlay: 0.9 + L * 0.12, menu: 0,
      env: L >= 2 ? { top: '#2a1a5a', mid: '#a080d0', bot: '#08040c', panel: '#f0e8ff', panel2: '#b090ff', rim: '#a77bff' } : { top: '#4a1410', mid: '#e07a3a', bot: '#0c0404', panel: '#ffe0c0', panel2: '#ff7a3a', rim: '#ff4a2a' },
    }),

    ember: (L) => ({
      bake: { baseA: ['#2a0a06', '#3a0e06', '#4a1206', '#5c1804'][L], baseB: ['#0a0404', '#0c0404', '#100404', '#160604'][L], downPow: 1.8, milky: [0.2, 0.15, 0.1, 0][L], milkyN: NIGHT_MW, milkyCol: '#5a3a2a', milkyCol2: '#d0a070',
        neb: [0.3, 0.6, 1.0, 1.4][L], nebA: '#5a1408', nebB: '#ff7a2a', nebDir: VD(-0.5, 0.0), nebSpread: 0.7, nebSeed: 2.4,
        neb2: [0, 0.3, 0.6, 1.0][L], neb2A: '#3a0a04', neb2B: '#ffb040', neb2Dir: VD(0.6, -0.2),
        dusk: [0.5, 0.7, 0.9, 1.2][L], duskCol: '#ff4a10', duskDir: [0, -0.2, -1], storm: L >= 2 ? 0.35 : 0, stormCol: '#ff5a1a', aur: L >= 3 ? 0.3 : 0, aurCol: '#ff6a20', aurCol2: '#ffc060' },
      stars: [0.5, 0.4, 0.3, 0.15][L], starTint: '#ffd8b0', constel: 0, meteor: [0.05, 0.15, 0.4, 1.4][L], meteorCol: '#ff9a3a', lightning: 0, curtains: [0, 0, 0.12, 0.22][L], curtSpeed: 2.2,
      curtC1: '#ff5a10', curtC2: '#ffb040', curtC3: '#ffe0a0', embers: [0.3, 0.6, 1.0, 1.6][L], rain: 0, prism: 0, shards: 0, flashCol: '#ffb070',
      sun: L >= 2 ? 1 : 0, sunSize: [0.3, 0.3, 0.38, 0.5][L], sunCol: '#ff4a10', sunHot: '#ffc060', corona: [0, 0, 0.8, 1.5][L], collapse: 0, hole: 0, infall: 0, dim: 0, twinkle: 0.6,
      key: '#ffc090', keyI: 2.2, rim: '#ff6a2a', rimI: 1.3, hemiS: '#ff8a50', hemiG: '#1a0804', hemiI: 0.5, exposure: 1.0, bloom: 0.9 + L * 0.05, inlay: 1, menu: 0,
      env: { top: '#3a1408', mid: '#d06a2a', bot: '#0a0404', panel: '#ffd0a0', panel2: '#ff7a2a', rim: '#ff5a2a' },
    }),
    glass: (L) => ({
      bake: { baseA: ['#1a2a3a', '#203648', '#2a4458', '#3a5870'][L], baseB: ['#06080e', '#080c14', '#0a1018', '#0e1620'][L], downPow: 2.0, milky: [0.5, 0.55, 0.6, 0.7][L], milkyN: NIGHT_MW, milkyCol: '#8aa8c8', milkyCol2: '#e8f4ff',
        neb: [0.3, 0.6, 0.9, 1.2][L], nebA: '#2a5a7a', nebB: '#cfefff', nebDir: VD(-0.6, 0.1), nebSpread: 0.55, nebSeed: 4.4,
        neb2: [0.2, 0.4, 0.6, 0.8][L], neb2A: '#4a3a7a', neb2B: '#ffd0f0', neb2Dir: VD(0.65, -0.1),
        dusk: [0.2, 0.3, 0.4, 0.6][L], duskCol: '#9fe8ff', duskDir: [0, -0.15, -1], storm: 0, aur: [0, 0.2, 0.4, 0.3][L], aurCol: '#bff4ff', aurCol2: '#ffd0f0' },
      stars: [1.3, 1.5, 1.7, 2.0][L], starTint: '#e8f8ff', constel: [0, 0.6, 0.8, 0.8][L], conCol: '#cfefff', meteor: [0, 0, 0.15, 0.3][L], meteorCol: '#e8f8ff', lightning: 0, curtains: 0, curtSpeed: 1,
      embers: 0, rain: 0, prism: [0.15, 0.4, 0.8, 1.2][L], shards: L === 3 ? 0.8 : 0, flashCol: '#dff4ff',
      sun: 0, sunSize: 1, sunCol: '#ff6a2a', corona: 0, collapse: 0, hole: 0, infall: 0, dim: 0, twinkle: 1,
      key: '#eaf6ff', keyI: 2.3, rim: '#9fe8ff', rimI: 1.4, hemiS: '#9fd0ff', hemiG: '#0a1018', hemiI: 0.55, exposure: 1.0, bloom: 0.85 + L * 0.05, inlay: 1, menu: 0,
      env: { top: '#2a4a6a', mid: '#9fc8e0', bot: '#060a10', panel: '#ffffff', panel2: '#bff4ff', rim: '#9fe8ff' },
    }),
    storm: (L) => ({
      bake: { baseA: ['#1a1030', '#201438', '#2a1848', '#381c5a'][L], baseB: ['#060410', '#080514', '#0a0618', '#0c0820'][L], downPow: 1.7, milky: [0.25, 0.2, 0.15, 0.1][L], milkyN: NIGHT_MW, milkyCol: '#5a4a8a', milkyCol2: '#c0a8e0',
        neb: [0.4, 0.7, 1.0, 1.2][L], nebA: '#2a1050', nebB: '#8a5ad0', nebDir: VD(-0.55, 0.05), nebSpread: 0.75, nebSeed: 6.1,
        neb2: [0.3, 0.5, 0.7, 0.9][L], neb2A: '#1a0a40', neb2B: '#b77bff', neb2Dir: VD(0.6, -0.15),
        dusk: [0.3, 0.4, 0.5, 0.9][L], duskCol: '#7a3aff', duskDir: [0.2, -0.25, -0.95], storm: [0.5, 0.8, 1, 1][L], stormCol: '#6a4aa0', aur: [0, 0, 0.2, 0.4][L], aurCol: '#b77bff', aurCol2: '#5a8aff' },
      stars: [0.4, 0.35, 0.3, 0.4][L], starTint: '#d8c8ff', constel: 0, meteor: 0, lightning: [0, 0, 0.5, 1.2][L], boltCol: '#d8c8ff', curtains: [0, 0.08, 0.16, 0.14][L], curtSpeed: 1.5,
      curtC1: '#6a3aff', curtC2: '#b77bff', curtC3: '#3a8aff', embers: 0, rain: [0, 0, 0.3, 1][L], prism: 0, shards: 0, flashCol: '#e0d8ff',
      sun: L === 3 ? 1 : 0, sunSize: 0.36, sunCol: '#8a4aff', sunHot: '#d8b8ff', corona: 1.4, collapse: 0.18, hole: 0, infall: 0, dim: 0, twinkle: 1,
      key: ['#d8d0ff', '#d8d0ff', '#e0d8ff', '#efe8ff'][L], keyI: 2.2, rim: '#b77bff', rimI: 1.5, hemiS: '#8a6aff', hemiG: '#0c0818', hemiI: 0.55, exposure: 1.0, bloom: 0.9 + L * 0.05, inlay: 1, menu: 0,
      env: { top: '#2a1a5a', mid: '#8a6ad0', bot: '#06040c', panel: '#f0e8ff', panel2: '#b77bff', rim: '#b77bff' },
    }),
  };
  const DEFAULTS = { embers: 0, rain: 0, prism: 0, shards: 0, meteorCol: '#fff2d0', boltCol: '#d6ecff', flashCol: '#cfe6ff', curtC1: '#3dffa2', curtC2: '#ff5f9e', curtC3: '#7a5cff', conCol: '#ffe2a8', sunHot: '#ffd27a' };
  const LIVE_NUM = ['stars', 'constel', 'meteor', 'lightning', 'curtains', 'curtSpeed', 'sun', 'sunSize', 'corona', 'collapse', 'hole', 'infall', 'dim', 'twinkle', 'keyI', 'rimI', 'hemiI', 'exposure', 'bloom', 'inlay', 'menu', 'embers', 'rain', 'prism', 'shards'];
  const LIVE_COL = ['starTint', 'sunCol', 'sunHot', 'key', 'rim', 'hemiS', 'hemiG', 'meteorCol', 'boltCol', 'flashCol', 'curtC1', 'curtC2', 'curtC3', 'conCol'];
  // the sun / black hole sit in a free corner of the play view: upper right on landscape, top centre on portrait
  function updateCelDir() {
    const P = G.deg(56), f = new V(0, -Math.sin(P), -Math.cos(P)), up = new V(0, Math.cos(P), -Math.sin(P)), rt = new V(1, 0, 0);
    const halfH = Math.tan(G.deg(21)), asp = (G.camera && G.camera.aspect) || 1.6, halfW = halfH * asp;
    const a = asp >= 1.15 ? 0.74 * halfW : 0.12 * halfW, b = asp >= 1.15 ? 0.58 * halfH : 0.74 * halfH;
    W.celDir.copy(f).addScaledVector(rt, a).addScaledVector(up, b).normalize();
    if (W.domeU) W.domeU.uHoleDir.value.copy(W.celDir);
  }
  function paramsFor(preset, L) {
    const f = PRESETS[preset] || PRESETS.night;
    const p = f(G.clamp(L | 0, 0, 3));
    for (const k in DEFAULTS) if (p[k] == null) p[k] = DEFAULTS[k];
    const o = { bake: p.bake, env: p.env };
    for (const k of LIVE_NUM) o[k] = p[k];
    for (const k of LIVE_COL) o[k] = new C(p[k]);
    return o;
  }
  function lerpParams(a, b, t, out) {
    for (const k of LIVE_NUM) out[k] = a[k] + (b[k] - a[k]) * t;
    for (const k of LIVE_COL) { out[k] = out[k] || new C(); out[k].copy(a[k]).lerp(b[k], t); }
    return out;
  }
  const cloneParams = (p) => { const o = { bake: p.bake, env: p.env }; for (const k of LIVE_NUM) o[k] = p[k]; for (const k of LIVE_COL) o[k] = p[k].clone(); return o; };

  function setSky(preset = 'night', intensity = 0, transitionSec = 1.5) {
    if (!ready) { W.pendingSky = [preset, intensity, transitionSec]; return; }
    if (!PRESETS[preset]) preset = 'night';
    const L = G.clamp(Math.round(+intensity || 0), 0, 3);
    if (W.preset === preset && W.level === L && W.to) return;
    const dur = Math.max(0, +transitionSec || 0);
    // finish an ongoing transition instantly before starting a new one
    if (W.tr && W.tr.t < 1) { lerpParams(W.tr.from, W.tr.to, 1, W.cur); W.domeU.uMix.value = W.front === 1 ? 1 : 0; }
    const target = paramsFor(preset, L);
    const back = W.front === 0 ? 1 : 0;
    bake(back, target.bake);
    if (W.preset !== preset || !W.envDone) { makeEnv(target.env); W.envDone = true; }
    W.tr = { from: cloneParams(W.cur), to: target, t: dur > 0 ? 0 : 1, dur, mixFrom: W.domeU.uMix.value, mixTo: back };
    W.front = back;
    const prevPreset = W.preset, prevLevel = W.level;
    W.preset = preset; W.level = L; W.to = target;
    if (dur === 0) { lerpParams(W.tr.from, target, 1, W.cur); W.domeU.uMix.value = back; }
    // set-piece moments
    if (prevPreset === preset && L > prevLevel) {
      if (preset === 'collapse' && L === 2) { W.collapseFlash = 1.0; G.post?.bloomPulse?.(1.0, 1.1); }   // short: the implosion must stay visible
      if (preset === 'collapse' && L === 3) { W.collapseFlash = 0.6; }
      if (preset === 'night' && L === 1) W.conDraw = 0;
      if (preset === 'ember' && L === 3) { W.flash = Math.max(W.flash, 0.7); G.post?.bloomPulse?.(0.5, 0.9); for (let i = 0; i < 4; i++) meteor('#ff9a3a'); }
      if (preset === 'ember' && L === 2) { W.flash = Math.max(W.flash, 0.35); }
      if (preset === 'glass' && L === 3) { W.flash = Math.max(W.flash, 1.0); G.post?.bloomPulse?.(0.5, 0.8); for (let i = 0; i < 3; i++) shardBurst(); }
      if (preset === 'glass' && L === 2) { for (let i = 0; i < 3; i++) prismBar(); }
      if (preset === 'storm' && L >= 2) { skyBolt(preset === 'storm' ? '#d8c8ff' : undefined); if (L === 3) { W.flash = Math.max(W.flash, 0.9); G.post?.bloomPulse?.(0.5, 0.9); } }
    }
    if (preset === 'menu') setArena('throne', prevPreset ? 0.5 : 0);
    if (preset === 'night' && L >= 1 && prevPreset !== 'night') W.conDraw = 0;
    G.emit('skyChange', { preset, intensity: L });
  }


  // ==================================================================
  // Small world API
  // ==================================================================
  function beat(strength = 1) { W.beat = Math.max(W.beat, G.clamp(+strength || 0.6, 0, 1.5)); }
  function setAccent(hex) { try { W.accent.set(hex || G.colors.accent); } catch (e) { /* keep */ } }
  function reset() {
    if (!ready) return;
    const A = W.arena;
    A.liveR = A.rFrom = A.rTo = G.ARENA_R; A.rT = 1; A.rDur = 0;
    A.glow.amt = 0; A.glow.decay = 0; A.rimG.amt = 0; A.rimG.decay = 0;
    W.beat = 0;
  }

  // ==================================================================
  // Update
  // ==================================================================
  function update(dt) {
    if (!ready) return;
    const t = (W.time += dt);
    const cam = G.camera;
    // sky follows the camera
    G.layers.sky.position.copy(cam.position);
    // transition
    const tr = W.tr;
    if (tr && tr.t < 1) {
      tr.t = tr.dur > 0 ? Math.min(1, tr.t + dt / tr.dur) : 1;
      const e = G.smooth(tr.t);
      lerpParams(tr.from, tr.to, e, W.cur);
      W.domeU.uMix.value = tr.mixFrom + (tr.mixTo - tr.mixFrom) * e;
    }
    const p = W.cur;
    // pixel angle for star AA
    W.domeU.uPix.value = (2 * Math.tan((cam.fov * Math.PI / 180) / 2)) / Math.max(200, G.renderer.domElement.height || 720);
    W.domeU.uTime.value = t; W.domeU.uStars.value = p.stars; W.domeU.uStarTint.value.copy(p.starTint); W.domeU.uTwinkle.value = p.twinkle;
    W.flash = Math.max(0, W.flash - dt * 3.2); W.domeU.uFlash.value = W.flash; W.curtU.uFlash.value = W.flash; W.domeU.uFlashCol.value.copy(p.flashCol);
    W.collapseFlash = Math.max(0, (W.collapseFlash || 0) - dt * 0.6);
    W.domeU.uDim.value = G.clamp(p.dim - W.collapseFlash * 0.5);
    // constellations draw themselves
    if (p.constel > 0.01) W.conDraw = Math.min(W.conMax, (W.conDraw || 0) + dt * 1.8); else W.conDraw = Math.max(0, (W.conDraw || 0) - dt * 3);
    W.conU.uDraw.value = W.conDraw; W.conU.uA.value = p.constel * 0.9; W.conU.uTime.value = t; W.conU.uCol.value.copy(p.conCol);
    W.conLines.visible = W.conStars.visible = p.constel > 0.01;
    // meteors / lightning / prism bars / shards
    if (p.meteor > 0.01 && Math.random() < p.meteor * dt) meteor(p.meteorCol.getStyle());
    if (p.lightning > 0.01 && Math.random() < p.lightning * dt) skyBolt(p.boltCol.getStyle());
    if (p.prism > 0.01 && Math.random() < p.prism * dt) prismBar();
    if (p.shards > 0.01 && Math.random() < p.shards * dt) shardBurst();
    updateStreaks(dt);
    // curtains
    W.curtU.uTime.value = t; W.curtU.uA.value = p.curtains * 0.55; W.curtU.uSpeed.value = p.curtSpeed;
    W.curtU.uC1.value.copy(p.curtC1); W.curtU.uC2.value.copy(p.curtC2); W.curtU.uC3.value.copy(p.curtC3);
    W.curtGroup.visible = p.curtains > 0.01;
    // particle layers
    W.embers.visible = p.embers > 0.01; W.emberU.uA.value = p.embers; W.emberU.uTime.value = t; W.emberU.uPx.value = Math.max(0.5, (G.renderer.domElement.height || 720) / 720);
    W.rain.visible = p.rain > 0.01; W.rainU.uA.value = p.rain * 0.5; W.rainU.uTime.value = t;
    // celestial
    const sunOn = p.sun > 0.01, holeOn = p.hole > 0.01;
    W.sun.visible = sunOn; W.sunU.uA.value = p.sun; W.sunU.uTime.value = t; W.sunU.uCol.value.copy(p.sunCol); W.sunU.uHot.value.copy(p.sunHot); W.sunU.uCorona.value = p.corona; W.sunU.uCollapse.value = G.clamp(p.collapse + W.collapseFlash * 0.6);
    W.domeU.uHole.value = p.hole; W.diskU.uA.value = p.hole; W.diskU.uTime.value = t;
    W.disk.visible = W.diskHalo.visible = holeOn;
    W.infall.visible = p.infall > 0.01; W.infallU.uA.value = p.infall; W.infallU.uTime.value = t;
    if (sunOn || holeOn || W.infall.visible) placeCelestial(p);
    // lights / post
    const L = G.lights;
    if (L) {
      L.key.color.copy(p.key); L.key.intensity = p.keyI * (1 + W.flash * 0.6);
      L.rim.color.copy(p.rim).lerp(W.accent, 0.25); L.rim.intensity = p.rimI;
      L.hemi.color.copy(p.hemiS); L.hemi.groundColor.copy(p.hemiG); L.hemi.intensity = p.hemiI;
    }
    // readability caps: during play the sky is soft-capped and bloom/exposure are held down, so every in-fight frame
    // keeps a dark backdrop; cinematics (transitions, deaths) get looser caps for the spectacle; the menu is uncapped
    {
      const RD = G.world.readability, st = G.state;
      const play = st === 'fight' || st === 'practice' || st === 'intro' || st === 'dead' || st === 'paused' || (G.cam && G.cam.mode === 'play' && st === 'menu');
      const cine = st === 'cinematic' || st === 'victory' || st === 'draft';
      const want = play ? RD.ceil : cine ? RD.ceilCine : 10;
      W.ceil = W.ceil == null ? want : W.ceil + (want - W.ceil) * Math.min(1, (G.rdt || dt) * 2.5);
      W.domeU.uCeil.value = W.ceil;
      let ex = p.exposure, bl = p.bloom;
      if (play) { ex = Math.min(ex, RD.expMax); bl = Math.min(bl, RD.bloomMax); }
      else if (cine) { ex = Math.min(ex, RD.expMaxCine); bl = Math.min(bl, RD.bloomMaxCine); }
      if (G.post) { G.post.base.exposure = ex; G.post.base.bloom = bl; }
    }
    // arena
    W.beat = Math.max(0, W.beat - dt * 3.5);
    updateArena(dt, t, p);
  }

  // ==================================================================
  // module
  // ==================================================================
  G.world = {
    init() {
      W.time = 0; W.beat = 0; W.flash = 0; W.front = 0; W.accent = new C(G.colors.accent || '#5fe3ff');
      W.celDir = new V(0.4, -0.6, -0.7).normalize();
      W.shardBurst = shardBurst; W.prismBar = prismBar; W.meteor = meteor; W.skyBolt = skyBolt;   // test hooks
      buildSky(); buildParticles(); buildFloor();
      updateCelDir(); G.on('resize', updateCelDir);
      W.cur = paramsFor('menu', 0);
      ready = true;
      W.preset = null; W.level = -1;
      const pa = W.pendingArena; W.pendingArena = null;
      const ps = W.pendingSky; W.pendingSky = null;
      setSky(ps ? ps[0] : 'menu', ps ? ps[1] : 0, 0);
      if (pa) setArena(pa[0], pa[1]);
      G.on('quality', () => { /* cube + floor detail are fixed after init; nothing heavy to redo */ });
    },
    update, setSky, setAccent, beat, reset, setArena, setArenaR, floorGlow, rimGlow,
    meteor: (c) => ready && meteor(c), lightning: (c) => ready && skyBolt(c),
    get sky() { return { preset: W.preset, intensity: W.level, transitioning: !!(W.tr && W.tr.t < 1) }; },
    get arena() { return W.arena ? W.arena.skin : 'none'; },
    get arenaR() { return W.arena ? W.arena.liveR : G.ARENA_R; },
    set arenaR(r) { setArenaR(r, 0); },
    get arenaRTarget() { return W.arena ? W.arena.rTo : G.ARENA_R; },
    skins: SKINS.slice(), presets: () => Object.keys(PRESETS),
    // play readability caps (see update): sky luminance knee (linear, pre-grade), max exposure and bloom strength
    readability: { ceil: 0.05, ceilCine: 0.09, expMax: 1.0, bloomMax: 0.86, expMaxCine: 1.04, bloomMaxCine: 0.98 },
    _W: W,
  };
})();
