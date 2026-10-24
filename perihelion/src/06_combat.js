// =====================================================================
// 06_combat.js: hazard library + telegraph shader, adds, damage routing,
// boss framework (runtime object b), fight flow, practice dummy.
// Owner: gameplay. Exposes G.hz, G.adds, G.combat, G.bosses.practice.
// =====================================================================
(() => {
  const T3 = (typeof THREE !== 'undefined') ? THREE : G.THREE;
  const PI = Math.PI, TAU = PI * 2;
  const RINGS = () => G.RINGS || [5.5, 9.0, 12.5];
  const TRACK_HALF = 0.68;          // half visual track width (+ a hair) for telegraph bands
  const HIT_R = 0.55;               // hero hit radius (arc length)
  const AREA_M = 0.15;              // area hazards: hero counts as inside this far past the edge
  const PRED_PAD = 0.22;            // extra pad for predictions (ghost trail / bot)
  const TELE_Y = 0.05;
  const ARENA_R = 15.2;

  // ---------------------------------------------------------------- helpers
  const wrap = (a) => a - TAU * Math.floor((a + PI) / TAU);
  const angDiff = (a, b) => wrap(a - b);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const polar = (r, th, y = 0, out) => G.polar(r, th, y, out);   // single source of the polar convention (theta ccw from +x toward -z)
  const ringR = (f) => { const R = RINGS(); const s = (R[2] - R[0]) / 2; return R[0] + s * f; };
  const logE = (w, e) => { try { G.log && G.log.error ? G.log.error(w, e) : console.error(w, e); } catch (_) { console.error(w, e); } };
  const fx = (name, ...a) => { try { const f = G.fx && G.fx[name]; return f ? f.apply(G.fx, a) : undefined; } catch (e) { logE('fx.' + name, e); } };
  const sfx = (name, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(name, o); } catch (e) { logE('sfx.' + name, e); } };
  const world = (name, ...a) => { try { const f = G.world && G.world[name]; return f ? f.apply(G.world, a) : undefined; } catch (e) { logE('world.' + name, e); } };
  const cam = (name, ...a) => { try { const f = G.cam && G.cam[name]; return f ? f.apply(G.cam, a) : undefined; } catch (e) { logE('cam.' + name, e); } };
  const emit = (n, d) => { try { G.emit && G.emit(n, d); } catch (e) { logE('emit.' + n, e); } };
  const rand = () => (G.rand ? G.rand() : Math.random());
  const P = () => (G.player && G.player.state) || null;
  const accentHex = () => (G.colors && G.colors.accent) || '#5fe3ff';
  const PLAY = (s) => s === 'fight' || s === 'practice';

  function setState(s) {
    if (G.state === s) return;
    if (G.setState) { G.setState(s); return; }      // core's setter emits stateChange
    G.state = s;
  }

  class Abort extends Error { constructor(m) { super(m || 'aborted'); this.name = 'Abort'; this.isAbort = true; } }
  const isAbort = (e) => e && (e.isAbort || e instanceof Abort);

  // ----------------------------------------------------------- geometry
  function sectorGeometry(r0, r1, a0, a1, segments) {
    const span = a1 - a0;
    const seg = Math.max(2, segments || Math.ceil(Math.abs(span) / TAU * 96));
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, a = a0 + span * u, c = Math.cos(a), s = -Math.sin(a);
      pos.push(r0 * c, 0, r0 * s, r1 * c, 0, r1 * s);
      uv.push(u, 0, u, 1);
      if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T3.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    // winding: make faces point up (+y)
    g.computeVertexNormals();
    const n = g.attributes.normal; if (n.count && n.getY(0) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
    return g;
  }

  // ------------------------------------------------- telegraph shader
  // modes: 0 sector telegraph, 1 disc telegraph, 2 wave band, 3 safe gap, 4 void (broken), 5 soak timer disc, 6 beam
  const TELE_VS = `
    varying vec2 vUv; varying vec2 vP;
    void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const TELE_FS = `
    precision highp float;
    uniform vec3 uColor; uniform float uProgress, uTime, uLethal, uAlpha, uFire, uLive, uMode, uArrow, uWaveR, uWaveW, uSwept, uSoft, uCap;
    uniform vec2 uSize;
    varying vec2 vUv; varying vec2 vP;
    void main(){
      vec3 acc = uColor; vec3 col = acc; float a = 0.0;
      // the hazard hue at full saturation (max channel 1): live fills and the fire flash are tinted with it and
      // scaled by uCap (set per frame from the sky's bloom), so bloom never turns a live shape into a white blob
      // fills use a saturation-boosted accent: pale accents (ice cyan, lavender) otherwise wash toward white over gold
      float accC = max(acc.r, max(acc.g, acc.b)) - min(acc.r, min(acc.g, acc.b));   // chroma: very pale accents get a stronger push
      vec3 accS = max(mix(vec3(dot(acc, vec3(0.2126, 0.7152, 0.0722))), acc, clamp(0.5 / max(accC, 0.01), 1.35, 3.0)), vec3(0.0));
      vec3 tint = accS / max(0.001, max(accS.r, max(accS.g, accS.b)));
      float pulse = 0.5 + 0.5 * sin(uTime * mix(5.0, 19.0, uProgress));
      if (uMode < 0.5 || uMode > 5.5) {
        float dx = min(vUv.x, 1.0 - vUv.x) * uSize.x;
        float dy = min(vUv.y, 1.0 - vUv.y) * uSize.y;
        float d = min(dx, dy);
        if (uMode > 5.5) { // beam
          float c = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float core = pow(max(c, 0.0), 0.7);
          col = mix(acc * 1.15, vec3(1.25), pow(core, 6.0));
          a = uAlpha * (0.15 + 0.6 * core) * (0.85 + 0.15 * sin(uTime * 40.0 + vUv.y * 9.0));
        } else {
          float dmax = max(0.001, min(uSize.x, uSize.y) * 0.5);
          float f = clamp(d / dmax, 0.0, 1.0);
          float edge = 1.0 - smoothstep(0.03, 0.09, d);
          float rim = smoothstep(0.07, 0.11, d) * (1.0 - smoothstep(0.11, 0.26, d));
          float filled = 1.0 - smoothstep(uProgress - 0.015, uProgress + 0.015, f);
          float front = (1.0 - smoothstep(0.0, 0.035, abs(f - uProgress))) * step(0.02, uProgress) * (1.0 - uLive);
          float hatch = step(0.55, fract((vP.x + vP.y) * 0.9 - uTime * 1.4)) * uLethal;
          // chevrons along the arc (direction = sign of uArrow)
          float chev = 0.0;
          if (abs(uArrow) > 0.5) {
            float s = vUv.x * uSize.x * 0.55 * uArrow - abs(vUv.y - 0.5) * 0.9 - uTime * 1.3;
            chev = step(0.72, fract(s)) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
          }
          // swept part of a sweep preview fades
          float sw = 1.0;
          if (uSwept > 0.0) sw = step(uSwept, vUv.x);
          if (uSwept < 0.0) sw = step(vUv.x, 1.0 + uSwept);
          // unfilled part shades the gold track in a dark accent tint; the fill is the saturated accent
          float base = 0.26 + 0.04 * pulse;
          float fillA = filled * (0.2 + 0.08 * pulse + 0.08 * uLethal * pulse);
          a = base + fillA + front * 0.5 + hatch * filled * 0.2 + chev * 0.22;
          col = mix(accS * 0.12, accS * 0.95, filled) + acc * front * 0.8 + vec3(chev * 0.25);
          if (uLive > 0.5) {
            if (uSoft > 0.5) { a = 0.30 + 0.05 * pulse; col = tint * 0.62 * uCap; }     // long-lived hazards: a calm, solid fill
            else { a = 0.42 + 0.10 * sin(uTime * 30.0 + (vP.x - vP.y) * 2.0); col = mix(tint, vec3(1.0), 0.12) * 0.9 * uCap; }
          }
          // dark rim behind the bright edge so it reads on gold metal
          col = mix(col, vec3(0.0, 0.0, 0.02), rim * 0.85);
          a = max(a, rim * 0.55);
          col = mix(col, (acc * 1.9 + vec3(0.2)) * mix(1.0, 0.8 * uCap, uLive), edge);   // live edges are capped too
          a = max(a, edge * (0.75 + 0.25 * pulse));
          a *= sw;
          a *= uAlpha;
        }
      } else if (uMode < 1.5) { // disc telegraph
        float rr = length(vUv - 0.5) * 2.0;
        if (rr > 1.0) discard;
        float d = (1.0 - rr) * uSize.x;
        float f = 1.0 - rr;
        float edge = 1.0 - smoothstep(0.03, 0.09, d);
        float rim = smoothstep(0.07, 0.11, d) * (1.0 - smoothstep(0.11, 0.24, d));
        float filled = 1.0 - smoothstep(uProgress - 0.02, uProgress + 0.02, f);
        float front = (1.0 - smoothstep(0.0, 0.04, abs(f - uProgress))) * step(0.02, uProgress);
        float cross = (1.0 - smoothstep(0.02, 0.06, min(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * uSize.x)) * step(rr, 0.45) * 0.6;
        a = 0.22 + filled * (0.22 + 0.1 * pulse) + front * 0.55 + cross;
        col = mix(accS * 0.12, accS * 0.95, filled) + acc * front * 0.8;
        if (uLive > 0.5) { a = 0.62; col = mix(tint, vec3(1.0), 0.2) * 0.95 * uCap; }
        col = mix(col, vec3(0.0, 0.0, 0.02), rim * 0.85); a = max(a, rim * 0.55);
        col = mix(col, (acc * 2.2 + vec3(0.25)) * mix(1.0, 0.8 * uCap, uLive), edge); a = max(a, edge);
        a *= uAlpha;
      } else if (uMode < 2.5) { // wave band
        float rr = length(vP);
        float dd = rr - uWaveR;
        float band = 1.0 - smoothstep(uWaveW * 0.6, uWaveW, abs(dd));
        float trail = (1.0 - smoothstep(0.0, 2.2, abs(dd))) * 0.25;
        float edge = 1.0 - smoothstep(0.0, 0.12, abs(abs(dd) - uWaveW * 0.8));
        a = (band * 0.75 + trail + edge * 0.5) * uAlpha;
        col = mix(acc * 1.2, vec3(1.25), edge * 0.5 + band * 0.15);
      } else if (uMode < 3.5) { // safe gap
        float dx = min(vUv.x, 1.0 - vUv.x) * uSize.x;
        float dy = min(vUv.y, 1.0 - vUv.y) * uSize.y;
        float d = min(dx, dy);
        float edge = 1.0 - smoothstep(0.02, 0.07, d);
        float dash = step(0.45, fract((vUv.x * uSize.x + vUv.y * uSize.y) * 0.9 - uTime * 0.6));
        col = vec3(1.0, 0.8, 0.42) * (1.3 + 0.3 * uArrow);
        a = (0.07 + 0.05 * pulse + uArrow * 0.16 + edge * (0.35 + 0.4 * dash)) * uAlpha;
      } else if (uMode < 4.5) { // void / broken track
        float dx = min(vUv.x, 1.0 - vUv.x) * uSize.x;
        float dy = min(vUv.y, 1.0 - vUv.y) * uSize.y;
        float d = min(dx, dy);
        float edge = 1.0 - smoothstep(0.02, 0.1, dx);
        float crack = step(0.82, fract(sin(floor(vUv.x * uSize.x * 6.0) * 12.9898) * 43758.5453)) * (1.0 - smoothstep(0.0, 0.5, dx));
        col = mix(vec3(0.01, 0.0, 0.03), acc * 2.0, edge * (0.6 + 0.4 * sin(uTime * 9.0)) + crack * 0.6);
        a = (0.88 * smoothstep(0.0, 0.05, dy) + edge * 0.5) * uAlpha;
      } else { // soak timer disc
        vec2 q = vUv - 0.5; float rr = length(q) * 2.0;
        if (rr > 1.0) discard;
        float ang = fract(atan(q.x, q.y) / 6.2831853 + 1.0);
        float remain = 1.0 - uProgress;
        float band = step(0.78, rr) * step(rr, 0.96);
        float on = step(ang, remain);
        float inner = (1.0 - smoothstep(0.0, 0.7, rr)) * 0.25;
        vec3 gold = vec3(1.0, 0.85, 0.45);
        col = mix(gold * 1.5, acc * 1.8, uProgress);
        a = (band * (on * 0.95 + 0.12) + inner * (0.6 + 0.4 * pulse)) * uAlpha;
        col = mix(col, vec3(1.6), inner);
      }
      // fire pop: a quarter-second impact cue, kept near the bloom knee so a big shape flashes its hue, not white
      a += uFire * 0.38 * (1.0 - 0.5 * uSoft); col = mix(col, mix(tint, vec3(1.0), 0.3) * 1.02 * uCap, uFire * 0.65);
      if (a < 0.004) discard;
      gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    }`;
  let teleBase = null;
  function teleMaterial(mode, color, opts = {}) {
    if (!teleBase) {
      teleBase = new T3.ShaderMaterial({
        vertexShader: TELE_VS, fragmentShader: TELE_FS, transparent: true, depthWrite: false, side: T3.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        uniforms: {
          uColor: { value: new T3.Color() }, uProgress: { value: 0 }, uTime: { value: 0 }, uLethal: { value: 0 }, uAlpha: { value: 1 },
          uFire: { value: 0 }, uLive: { value: 0 }, uMode: { value: 0 }, uArrow: { value: 0 }, uWaveR: { value: 0 }, uWaveW: { value: 0.45 },
          uSwept: { value: 0 }, uSize: { value: new T3.Vector2(1, 1) }, uSoft: { value: 0 }, uCap: { value: 1 },
        },
      });
    }
    const m = teleBase.clone();
    m.uniforms.uColor.value = new T3.Color(color || accentHex());
    m.uniforms.uMode.value = mode;
    m.uniforms.uSize.value = new T3.Vector2(opts.sx || 1, opts.sy || 1);
    if (opts.lethal) m.uniforms.uLethal.value = 1;
    if (opts.arrow) m.uniforms.uArrow.value = opts.arrow;
    if (opts.additive) m.blending = T3.AdditiveBlending;
    if (opts.soft) m.uniforms.uSoft.value = 1;
    return m;
  }

  // a band mesh over one ring (or a span of rings) from angle a0..a1 (centered geometry if centered=true)
  function bandMesh(r0, r1, a0, a1, mode, color, opts = {}) {
    const g = sectorGeometry(r0, r1, a0, a1);
    const full = Math.abs(a1 - a0) >= TAU - 1e-3;
    const mid = (r0 + r1) / 2;
    const m = teleMaterial(mode, color, { ...opts, sx: full ? 1e4 : Math.abs(a1 - a0) * mid, sy: r1 - r0 });
    const mesh = new T3.Mesh(g, m);
    mesh.position.y = opts.y != null ? opts.y : TELE_Y;
    mesh.renderOrder = opts.order != null ? opts.order : 6;
    mesh.frustumCulled = false;
    return mesh;
  }
  // groups contiguous ring indices into spans: [0,1,2] -> [[0,2]], [0,2] -> [[0,0],[2,2]]
  function ringSpans(rings) {
    const s = [...new Set(rings)].filter(r => r >= 0 && r <= 2).sort((a, b) => a - b), out = [];
    for (const r of s) { const last = out[out.length - 1]; if (last && last[1] === r - 1) last[1] = r; else out.push([r, r]); }
    return out;
  }
  const spanR = (sp) => { const R = RINGS(); return [R[sp[0]] - TRACK_HALF, R[sp[1]] + TRACK_HALF]; };
  // complement of gap list on a full circle -> list of [a0,a1]
  function complementArcs(gaps) {
    if (!gaps || !gaps.length) return [[0, TAU]];
    const iv = gaps.map(g => { const c = ((g.center % TAU) + TAU) % TAU; return [c - g.width / 2, c + g.width / 2]; }).sort((a, b) => a[0] - b[0]);
    // merge
    const m = [];
    for (const x of iv) { const l = m[m.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else m.push(x.slice()); }
    const out = [];
    for (let i = 0; i < m.length; i++) {
      const a = m[i][1], b = (i + 1 < m.length) ? m[i + 1][0] : m[0][0] + TAU;
      if (b - a > 1e-3) out.push([a, b]);
    }
    return out;
  }
  const inGaps = (theta, gaps, inset) => {
    if (!gaps) return false;
    for (const g of gaps) if (Math.abs(angDiff(theta, g.center)) < g.width / 2 - inset) return true;
    return false;
  };

  // ============================================================ HAZARDS
  const HZ = G.hz = {
    active: [],
    speed: 1,            // hazard + boss clock multiplier (Supernova sets 0.3)
  };
  let hzId = 1;

  function hazardBase(kind, o) {
    const h = {
      id: hzId++, kind, o, lt: 0, warn: Math.max(0, o.warn || 0), active: o.active != null ? o.active : 0.25,
      rings: o.rings ? o.rings.slice() : [0, 1, 2], dmg: o.dmg || 0, lethal: !!o.lethal, label: o.label || kind,
      color: o.color || accentHex(), group: new T3.Group(), mats: [], state: 'warn', hit: false, finished: false,
      cancelled: false, fadeT: 0, fireFlash: 0, tick: o.tick || 0, nextTick: 0, dead: false, visTime: 0,
    };
    h.group.name = 'hz_' + kind + '_' + h.id;
    let resolveFn;
    h.promise = new Promise(r => { resolveFn = r; });
    h._resolve = resolveFn;
    h.duration = () => h.warn + h.active;
    // awaiting a handle from a boss script rejects with Abort once that script's phase is over (phase change,
    // death, reset), so `await hz.arc(..); hz.ring(..)` never spawns the follow-up into a cinematic or the next phase.
    // `done` is the raw promise: it always resolves 'done' | 'cancelled'.
    const owner = C && C.boss, ownerGen = owner ? owner.gen : 0, ownerAlive = !!(owner && owner.alive);
    const stale = () => !!owner && (C.boss !== owner || owner.gen !== ownerGen || (ownerAlive && !owner.alive));
    h.handle = {
      id: h.id, kind, hazard: h, done: h.promise,
      cancel: () => endHazard(h, true),
      then: (a, b) => h.promise.then(v => { if (stale()) throw new Abort(); return v; }).then(a, b),
      get fireAt() { return (G.t || 0) + Math.max(0, h.warn - h.lt) / Math.max(0.01, HZ.speed); },
      get endAt() { const d = h.duration(); return d === Infinity ? Infinity : (G.t || 0) + Math.max(0, d - h.lt) / Math.max(0.01, HZ.speed); },
    };
    h.live = (lt) => lt >= h.warn && lt < h.warn + h.active;
    return h;
  }
  function addMesh(h, mesh) { h.group.add(mesh); if (mesh.material && mesh.material.uniforms) h.mats.push(mesh.material); return mesh; }
  // live look: 'flash' (pulsing tinted fill, the default for short hazards) or 'soft' (calm fill; the default for
  // hazards that stay live 2.5 s or more, e.g. rotors and long customs). Per hazard: o.liveStyle = 'soft' | 'flash'.
  function register(h) {
    const ls = h.o && h.o.liveStyle;
    h.liveStyle = ls === 'soft' || ls === 'flash' ? ls : (h.active >= 2.5 && h.active !== Infinity ? 'soft' : 'flash');
    if (h.liveStyle === 'soft') for (const m of h.mats) if (m.uniforms.uSoft) m.uniforms.uSoft.value = 1;
    const layer = (G.layers && G.layers.fx) || G.scene;
    if (layer && h.group.children.length) layer.add(h.group);
    HZ.active.push(h);
    if (h.warn > 0.2 && h.kind !== 'contact' && h.kind !== 'orb' && h.kind !== 'gap') {
      emit('telegraph', { lethal: h.lethal, kind: h.kind, warn: h.warn, dur: h.warn, id: h.id });   // audio plays the warn tone
    }
    return h.handle;
  }
  function endHazard(h, cancelled) {
    if (h.finished) return;
    h.finished = true; h.cancelled = !!cancelled; h.fadeT = cancelled ? 0.22 : 0.32; h.fade0 = h.fadeT;
    try { h.onEnd && h.onEnd(cancelled); } catch (e) { logE('hz.onEnd', e); }
    h._resolve(cancelled ? 'cancelled' : 'done');
  }
  function disposeHazard(h) {
    h.dead = true;
    try { h.dispose && h.dispose(); } catch (e) { logE('hz.dispose', e); }
    if (h.group.parent) h.group.parent.remove(h.group);
    h.group.traverse(o => {
      if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose();
      if (o.material && !o.userData.sharedMat) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }
    });
    const i = HZ.active.indexOf(h); if (i >= 0) HZ.active.splice(i, 1);
  }
  function setU(h, name, v) { for (const m of h.mats) if (m.uniforms[name]) m.uniforms[name].value = v; }

  function hitPlayer(h, dmg, label) {
    const pl = G.player; if (!pl || !pl.damage) return { applied: false, blocked: false };
    try { return pl.damage(dmg != null ? dmg : h.dmg, label || h.label) || { applied: false, blocked: false }; } catch (e) { logE('player.damage', e); return { applied: false }; }
  }
  // generic: area hazard test helpers
  const arcHit = (ring, theta, center, halfW, pad) => {
    const R = RINGS()[ring]; if (R == null) return false;
    return Math.abs(angDiff(theta, center)) < halfW + (AREA_M + pad) / R;
  };
  const pointHit = (ring, theta, pr, ptheta, rad, pad) => {
    if (ring !== pr) return false; const R = RINGS()[ring]; if (R == null) return false;
    return Math.abs(angDiff(theta, ptheta)) * R < rad + pad;
  };

  // ---------- arc: static wedge
  HZ.arc = (o) => {
    const h = hazardBase('arc', o);
    h.center = o.center || 0; h.width = o.width || 0.8;
    h.covers = (ring, theta, lt, ringF, pad = 0) => h.live(lt) && h.rings.includes(ring) && arcHit(ring, theta, h.center, h.width / 2, pad);
    for (const sp of ringSpans(h.rings)) {
      const [r0, r1] = spanR(sp);
      addMesh(h, bandMesh(r0, r1, h.center - h.width / 2, h.center + h.width / 2, 0, h.color, { lethal: h.lethal }));
    }
    h.onFire = () => {
      for (const r of h.rings) fx('ringFlash', r, { color: h.color, a0: h.center - h.width / 2, a1: h.center + h.width / 2, life: 0.5 });
      const R = RINGS();
      for (const r of h.rings) for (let k = -1; k <= 1; k++) fx('burst', polar(R[r], h.center + k * h.width * 0.3, 0.3), { color: h.color, count: 7, speed: 4, size: 0.5, life: 0.6, flareSize: 1.2 });   // small flares: nine of them bloom into a white slab
      sfx('crack', { vol: h.lethal ? 1 : 0.7 });
      if (h.lethal) cam('shake', 0.5, 0.35);
    };
    return register(h);
  };

  // ---------- sweep: beam moving from -> to
  HZ.sweep = (o) => {
    const h = hazardBase('sweep', o);
    h.from = o.from || 0; h.to = o.to != null ? o.to : h.from + PI; h.dur = Math.max(0.05, o.dur || 2); h.width = o.width || 0.22;
    h.active = h.dur;
    h.beamAt = (lt) => h.from + (h.to - h.from) * clamp((lt - h.warn) / h.dur, 0, 1);
    h.covers = (ring, theta, lt, ringF, pad = 0) => h.live(lt) && h.rings.includes(ring) && arcHit(ring, theta, h.beamAt(lt), h.width / 2, pad);
    const sgn = Math.sign(h.to - h.from) || 1;
    const lo = Math.min(h.from, h.to), hi = Math.max(h.from, h.to);
    const full = hi - lo >= TAU - 1e-3;
    h.previews = [];
    for (const sp of ringSpans(h.rings)) {
      const [r0, r1] = spanR(sp);
      const m = addMesh(h, bandMesh(r0, r1, full ? 0 : lo, full ? TAU : hi, 0, h.color, { lethal: h.lethal, arrow: sgn }));
      h.previews.push(m);
      // beam: centered geometry, rotated each frame
      const beam = addMesh(h, bandMesh(r0 - 0.15, r1 + 0.15, -h.width / 2, h.width / 2, 6, h.color, { additive: true, y: TELE_Y + 0.01, order: 7 }));
      beam.visible = false; beam.userData.beam = true;
      // vertical light blade
      const bladeMat = new T3.MeshBasicMaterial({ color: new T3.Color(h.color).multiplyScalar(0.8), transparent: true, opacity: 0.0, blending: T3.AdditiveBlending, depthWrite: false, side: T3.DoubleSide, map: bladeTex() });
      const blade = new T3.Mesh(new T3.PlaneGeometry(r1 - r0 + 0.3, 1.4), bladeMat); blade.userData.sharedTex = true;
      blade.position.set((r0 + r1) / 2, 0.8, 0); blade.userData.blade = true;
      const pivot = new T3.Group(); pivot.add(blade); pivot.visible = false; pivot.userData.beamPivot = true;
      h.group.add(pivot);
    }
    h.prevLt = 0;
    h.visual = (lt) => {
      const live = h.live(lt) || (lt >= h.warn && !h.finished);
      const a = h.beamAt(lt);
      const s = clamp((lt - h.warn) / h.dur, 0, 1);
      h.group.children.forEach(c => {
        if (c.userData.beam || c.userData.beamPivot) { c.visible = lt >= h.warn; c.rotation.y = a; }
      });
      h.group.traverse(c => { if (c.userData.blade) c.material.opacity = live ? 0.22 + 0.06 * Math.sin(h.visTime * 30) : 0; });
      for (const m of h.previews) {
        const u = m.material.uniforms;
        if (lt >= h.warn) { u.uProgress.value = 1; if (!full) u.uSwept.value = sgn > 0 ? Math.max(0.0001, s) : -Math.max(0.0001, s); u.uAlpha.value = 0.55; }
      }
    };
    // sub-stepped hit test so a fast beam can't skip the hero
    h.checkHit = (pl, dtH) => {
      if (h.hit || lt0(h) < h.warn) return;
      const n = Math.max(1, Math.ceil(Math.abs(h.to - h.from) / h.dur * dtH / (h.width * 0.4)));
      for (let i = n - 1; i >= 0; i--) {
        const lt = h.lt - dtH * i / n;
        if (h.covers(pl.ring, pl.theta, lt, pl.ringF, 0)) { const r = hitPlayer(h); if (r.applied || r.blocked) h.hit = true; return; }
      }
    };
    h.onFire = () => { sfx('lance', { vol: 0.8 }); };
    return register(h);
  };
  const lt0 = (h) => h.lt;
  // vertical gradient for the sweep's light blade (bright at the floor, fading up)
  function bladeTex() {
    if (bladeTex.t) return bladeTex.t;
    const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 64, 0, 0); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 4, 64);
    bladeTex.t = new T3.CanvasTexture(c); return bladeTex.t;
  }

  // ---------- ring: whole-ring detonation with optional safe gaps
  HZ.ring = (o) => {
    const h = hazardBase('ring', o);
    h.ring = o.ring != null ? o.ring : 1; h.rings = [h.ring]; h.gaps = o.gaps || null; h.active = o.active != null ? o.active : 0.4;
    h.covers = (ring, theta, lt, ringF, pad = 0) => h.live(lt) && ring === h.ring && !inGaps(theta, h.gaps, (pad + 0.08) / RINGS()[ring]);
    const R = RINGS()[h.ring];
    for (const [a0, a1] of complementArcs(h.gaps)) addMesh(h, bandMesh(R - TRACK_HALF, R + TRACK_HALF, a0, a1, 0, h.color, { lethal: h.lethal }));
    if (h.gaps) for (const g of h.gaps) addMesh(h, bandMesh(R - TRACK_HALF, R + TRACK_HALF, g.center - g.width / 2, g.center + g.width / 2, 3, '#ffd88a', { order: 5 }));
    world('ringGlow', h.ring, h.color, h.lethal ? 1 : 0.7, h.warn + h.active);
    h.onFire = () => {
      for (const [a0, a1] of complementArcs(h.gaps)) fx('ringFlash', h.ring, { color: h.color, a0, a1, life: 0.7 });
      for (let i = 0; i < 10; i++) { const th = i / 10 * TAU; if (!inGaps(th, h.gaps, 0)) fx('burst', polar(R, th, 0.3), { color: h.color, count: 8, speed: 5, size: 0.5, life: 0.7, flareSize: 1.2 }); }
      sfx(h.lethal ? 'thunder' : 'crack', {});
      cam('shake', h.lethal ? 0.8 : 0.4, 0.4);
      if (h.lethal) fx('flash', h.color, 0.25, 0.25);
    };
    return register(h);
  };

  // ---------- rotor: rotating slices
  HZ.rotor = (o) => {
    const h = hazardBase('rotor', o);
    h.slices = (o.slices || [{ center: 0, width: 0.6 }]).map(s => ({ center: s.center, width: s.width }));
    h.omega = o.omega != null ? o.omega : 0.4; h.dur = o.dur || 8; h.active = h.dur; h.tick = o.tick != null ? o.tick : 0.5;
    h.sliceAt = (s, lt) => s.center + h.omega * lt;
    h.covers = (ring, theta, lt, ringF, pad = 0) => {
      if (!h.live(lt) || !h.rings.includes(ring)) return false;
      for (const s of h.slices) if (arcHit(ring, theta, h.sliceAt(s, lt), s.width / 2, pad)) return true;
      return false;
    };
    h.meshes = [];
    for (const sp of ringSpans(h.rings)) {
      const [r0, r1] = spanR(sp);
      for (const s of h.slices) { const m = addMesh(h, bandMesh(r0, r1, -s.width / 2, s.width / 2, 0, h.color, { lethal: h.lethal, arrow: Math.sign(h.omega) })); m.userData.slice = s; h.meshes.push(m); }
    }
    h.visual = (lt) => { for (const m of h.meshes) m.rotation.y = h.sliceAt(m.userData.slice, lt); };
    h.visual(0);
    h.onFire = () => { sfx('rumble', { vol: 0.6 }); };
    return register(h);
  };

  // ---------- wave: expanding / collapsing shockwave across the rings
  HZ.wave = (o) => {
    const h = hazardBase('wave', o);
    h.dir = o.from === 'out' ? -1 : 1;        // 'in' = starts at the boss and expands outward; 'out' = collapses inward
    h.speed = o.speed || 6; h.gaps = o.gaps || null; h.width = o.thickness || 0.9;
    h.r0 = h.dir > 0 ? 1.6 : ARENA_R;
    const rEnd = h.dir > 0 ? ARENA_R : 0.8;
    h.active = Math.abs(rEnd - h.r0) / h.speed;
    h.radiusAt = (lt) => h.r0 + h.dir * h.speed * (lt - h.warn);
    h.crossTime = (ring) => h.warn + Math.abs(RINGS()[ring] - h.r0) / h.speed;   // hazard-local time it crosses ring k
    h.covers = (ring, theta, lt, ringF, pad = 0) => {
      if (!h.live(lt) || !h.rings.includes(ring)) return false;
      const R = RINGS()[ring];
      if (Math.abs(h.radiusAt(lt) - R) > h.width / 2 + 0.25 + pad * 0.5) return false;
      return !inGaps(theta, h.gaps, (pad + 0.08) / R);
    };
    // warn: bands on each ring + safe gap wedges
    for (const r of h.rings) {
      const R = RINGS()[r];
      for (const [a0, a1] of complementArcs(h.gaps)) addMesh(h, bandMesh(R - TRACK_HALF, R + TRACK_HALF, a0, a1, 0, h.color, { lethal: h.lethal }));
    }
    if (h.gaps) {
      const R = RINGS();
      for (const g of h.gaps) addMesh(h, bandMesh(R[0] - TRACK_HALF - 0.2, R[2] + TRACK_HALF + 0.2, g.center - g.width / 2, g.center + g.width / 2, 3, '#ffd88a', { order: 5 }));
    }
    h.waveMeshes = [];
    for (const [a0, a1] of complementArcs(h.gaps)) {
      const m = addMesh(h, bandMesh(0.6, ARENA_R + 0.8, a0, a1, 2, h.color, { additive: true, y: TELE_Y + 0.02, order: 7 }));
      m.visible = false; h.waveMeshes.push(m);
    }
    h.visual = (lt) => {
      const live = lt >= h.warn;
      for (const m of h.waveMeshes) { m.visible = live; m.material.uniforms.uWaveR.value = h.radiusAt(lt); m.material.uniforms.uWaveW.value = h.width / 2 + 0.15; }
      if (live) for (const m of h.mats) if (m.uniforms.uMode.value === 0) {
        m.uniforms.uAlpha.value = Math.max(0, 1 - (lt - h.warn) / (h.active + 0.01));
      }
      // ring flash as the front passes each ring
      if (live) for (const r of h.rings) {
        const ct = h.crossTime(r);
        if (!h['x' + r] && lt >= ct) { h['x' + r] = 1; for (const [a0, a1] of complementArcs(h.gaps)) fx('ringFlash', r, { color: h.color, a0, a1, life: 0.45 }); }
      }
    };
    h.onFire = () => { sfx('rumble', { vol: h.lethal ? 1 : 0.7 }); if (h.lethal) sfx('thunder', { vol: 0.6 }); cam('shake', h.lethal ? 0.7 : 0.35, 0.5); if (h.lethal) fx('flash', h.color, 0.2, 0.3); };
    return register(h);
  };

  // ---------- orb: travelling projectile
  const orbGeo = () => orbGeo.g || (orbGeo.g = new T3.IcosahedronGeometry(1, 2));
  HZ.orb = (o) => {
    const h = hazardBase('orb', o);
    h.ring0 = o.ring != null ? o.ring : 1; h.theta0 = o.theta || 0; h.omega = o.omega || 0; h.dr = o.dr || 0;
    h.life = o.life || 6; h.radius = o.radius || 0.6; h.warn = 0; h.active = h.life; h.onHit = o.onHit;
    h.rings = [0, 1, 2];
    h.ringFAt = (lt) => h.ring0 + h.dr * lt;
    h.thetaAt = (lt) => h.theta0 + h.omega * lt;
    h.posAt = (lt, out) => polar(ringR(h.ringFAt(lt)), h.thetaAt(lt), 0.7, out);
    const tmpA = new T3.Vector3(), tmpB = new T3.Vector3();
    h.covers = (ring, theta, lt, ringF, pad = 0) => {
      if (lt < 0 || lt >= h.life) return false;
      const rf = ringF != null ? ringF : ring;
      polar(ringR(rf), theta, 0, tmpA); h.posAt(lt, tmpB); tmpB.y = 0;
      return tmpA.distanceTo(tmpB) < h.radius + HIT_R * 0.8 + pad;
    };
    const c = new T3.Color(h.color);
    const core = new T3.Mesh(orbGeo(), new T3.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.8) }));
    core.userData.sharedGeo = true;
    core.scale.setScalar(h.radius * 0.55);
    const shell = new T3.Mesh(orbGeo(), new T3.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.9), transparent: true, opacity: 0.35, blending: T3.AdditiveBlending, depthWrite: false }));
    shell.userData.sharedGeo = true; shell.scale.setScalar(h.radius);
    const holder = new T3.Group(); holder.add(core, shell);
    const glow = fx('glowSprite', h.color, h.radius * 4.5); if (glow) holder.add(glow);
    h.group.add(holder); h.holder = holder;
    const marker = addMesh(h, (() => { const g = new T3.CircleGeometry(1, 28); g.rotateX(-PI / 2); const m = new T3.Mesh(g, teleMaterial(1, h.color, { sx: h.radius + 0.3 })); m.position.y = TELE_Y; m.renderOrder = 6; m.scale.setScalar(h.radius + 0.3); m.frustumCulled = false; return m; })());
    marker.material.uniforms.uProgress.value = 0.35; marker.material.uniforms.uAlpha.value = 0.7;
    h.marker = marker;
    h.posAt(0, holder.position);
    h.trail = fx('trail', holder, { color: h.color, width: h.radius * 0.9, length: 14 });
    h.dispose = () => { try { h.trail && h.trail.remove && h.trail.remove(); } catch (e) { } };
    h.visual = (lt) => {
      h.posAt(lt, holder.position);
      holder.position.y = 0.7 + Math.sin(h.visTime * 6 + h.id) * 0.08;
      marker.position.set(holder.position.x, TELE_Y, holder.position.z);
      shell.scale.setScalar(h.radius * (1 + 0.12 * Math.sin(h.visTime * 14)));
      const rf = h.ringFAt(lt); if (rf < -0.7 || rf > 2.7) endHazard(h, false);
    };
    h.checkHit = (pl) => {
      if (h.finished) return;
      if (h.covers(pl.ring, pl.theta, h.lt, pl.ringF, 0)) {
        const r = hitPlayer(h);
        if (r.applied || r.blocked) {
          h.hit = true;
          fx('burst', holder.position.clone(), { color: h.color, count: 18, speed: 5, size: 0.5, life: 0.5 });
          try { h.onHit && h.onHit(h.handle, r); } catch (e) { logE('orb.onHit', e); }
          endHazard(h, false);
        }
      }
    };
    h.pop = () => { fx('burst', holder.position.clone(), { color: h.color, count: 14, speed: 4, size: 0.5, life: 0.5 }); endHazard(h, true); };
    return register(h);
  };

  // ---------- bolt: targeted strike at a spot
  HZ.bolt = (o) => {
    const h = hazardBase('bolt', o);
    h.ring = o.ring != null ? o.ring : 1; h.rings = [h.ring]; h.theta = o.theta || 0; h.radius = o.radius || 1.0;
    h.active = 0.18; h.from = o.from ? o.from.clone() : new T3.Vector3(0, 6, 0);
    h.covers = (ring, theta, lt, ringF, pad = 0) => h.live(lt) && pointHit(ring, theta, h.ring, h.theta, h.radius + 0.2, pad);
    const R = RINGS()[h.ring];
    const g = new T3.CircleGeometry(1, 36); g.rotateX(-PI / 2);
    const m = new T3.Mesh(g, teleMaterial(1, h.color, { sx: h.radius, lethal: h.lethal }));
    m.scale.setScalar(h.radius); m.renderOrder = 6; m.frustumCulled = false;
    polar(R, h.theta, TELE_Y, m.position);
    addMesh(h, m);
    // a thin pillar of light marking the spot during warn
    const pil = new T3.Mesh(new T3.CylinderGeometry(0.05, 0.05, 3, 6, 1, true), new T3.MeshBasicMaterial({ color: new T3.Color(h.color).multiplyScalar(1.2), transparent: true, opacity: 0.15, blending: T3.AdditiveBlending, depthWrite: false }));
    pil.position.copy(m.position); pil.position.y = 1.5; h.group.add(pil); h.pillar = pil;
    h.visual = (lt) => { pil.material.opacity = lt < h.warn ? 0.1 + 0.35 * (lt / Math.max(0.01, h.warn)) : 0; pil.scale.x = pil.scale.z = 1 + 2 * (lt / Math.max(0.01, h.warn)); };
    h.onFire = () => {
      const to = polar(R, h.theta, 0.1);
      fx('lance', h.from, to, { color: h.color, width: 0.35, life: 0.3 });
      fx('burst', to, { color: h.color, count: 16, speed: 5, size: 0.6, life: 0.6 });
      fx('shockwave', to, { color: h.color, radius: h.radius * 1.8, life: 0.45 });
      sfx('lance', { vol: 0.7 });
      cam('shake', 0.25, 0.2);
    };
    return register(h);
  };

  // ---------- soak: a star the hero must touch before warn runs out
  HZ.soak = (o) => {
    const h = hazardBase('soak', o);
    h.ring = o.ring != null ? o.ring : 1; h.rings = [h.ring]; h.theta = o.theta || 0; h.radius = o.radius || 0.8;
    h.failDmg = o.failDmg != null ? o.failDmg : 20; h.onSoak = o.onSoak; h.onFail = o.onFail; h.active = 0; h.soak = true; h.soaked = false;
    h.covers = () => false;    // beneficial: never "danger"
    h.touches = (ring, theta, pad = 0) => pointHit(ring, theta, h.ring, h.theta, h.radius + 0.35, pad);
    const R = RINGS()[h.ring];
    const g = new T3.CircleGeometry(1, 40); g.rotateX(-PI / 2);
    const disc = new T3.Mesh(g, teleMaterial(5, h.color, {}));
    disc.scale.setScalar(h.radius + 0.45); disc.renderOrder = 6; disc.frustumCulled = false;
    polar(R, h.theta, TELE_Y + 0.005, disc.position); addMesh(h, disc);
    const star = new T3.Group(); polar(R, h.theta, 0.9, star.position);
    const sp = fx('glowSprite', '#fff1c2', 2.2); if (sp) star.add(sp);
    const sm = new T3.Mesh(new T3.OctahedronGeometry(0.32, 0), new T3.MeshBasicMaterial({ color: new T3.Color('#fff1c2').multiplyScalar(1.6) }));
    sm.scale.set(1, 1.6, 1); star.add(sm);
    const sm2 = new T3.Mesh(new T3.OctahedronGeometry(0.22, 0), new T3.MeshBasicMaterial({ color: new T3.Color(h.color).multiplyScalar(1.5), transparent: true, opacity: 0.8, blending: T3.AdditiveBlending, depthWrite: false }));
    sm2.scale.set(1.8, 0.5, 1.8); star.add(sm2);
    h.group.add(star); h.star = star;
    h.visual = (lt) => {
      star.rotation.y += 0.04; star.position.y = 0.9 + Math.sin(h.visTime * 3) * 0.12;
      const late = h.warn > 0 ? lt / h.warn : 1; star.scale.setScalar(1 + (late > 0.7 ? 0.15 * Math.sin(h.visTime * 20) : 0));
    };
    h.duration = () => h.warn;
    h.checkHit = (pl) => {
      if (h.finished) return;
      if (pl.alive && h.touches(pl.ring, pl.theta) && !pl.shifting) {
        h.soaked = true;
        fx('burst', star.position.clone(), { color: '#ffe7a0', count: 26, speed: 6, size: 0.6, life: 0.8 });
        fx('shockwave', polar(R, h.theta, 0.1), { color: '#ffe7a0', radius: 2.4, life: 0.5 });
        sfx('pulse', { gap: 0.1 });
        emit('soak', { ok: true, id: h.id });
        try { h.onSoak && h.onSoak(h.handle); } catch (e) { logE('soak.onSoak', e); }
        endHazard(h, false);
      }
    };
    h.onTimeout = () => {
      if (h.soaked) return;
      fx('burst', star.position.clone(), { color: h.color, count: 30, speed: 7, size: 0.7, life: 0.8 });
      fx('flash', h.color, 0.25, 0.3);
      sfx('crack', {});
      emit('soak', { ok: false, id: h.id });
      if (h.failDmg > 0) hitPlayer(h, h.failDmg, o.label || 'Unsoaked star');
      try { h.onFail && h.onFail(h.handle); } catch (e) { logE('soak.onFail', e); }
    };
    return register(h);
  };

  // ---------- gap: broken track
  const gapState = [[], [], []];
  function refreshGaps() {
    for (let i = 0; i < 3; i++) {
      gapState[i] = HZ.active.filter(h => h.kind === 'gap' && !h.finished && h.ring === i).map(h => ({ center: h.center, width: h.width }));
      world('setRingBroken', i, gapState[i]);
    }
  }
  HZ.gapAt = (ring, theta) => HZ.active.some(h => h.kind === 'gap' && !h.finished && h.ring === ring && Math.abs(angDiff(theta, h.center)) < h.width / 2);
  HZ.gap = (o) => {
    const h = hazardBase('gap', o);
    h.ring = o.ring != null ? o.ring : 2; h.rings = [h.ring]; h.center = o.center || 0; h.width = o.width || 0.6;
    h.dmg = o.dmg != null ? o.dmg : 30; h.warn = 0; h.active = Infinity; h.cool = 0;
    h.duration = () => Infinity;
    h.covers = (ring, theta, lt, ringF, pad = 0) => ring === h.ring && Math.abs(angDiff(theta, h.center)) < h.width / 2 + (pad - 0.1) / RINGS()[ring];
    const R = RINGS()[h.ring];
    addMesh(h, bandMesh(R - TRACK_HALF - 0.05, R + TRACK_HALF + 0.05, h.center - h.width / 2, h.center + h.width / 2, 4, h.color, { y: TELE_Y + 0.01 }));
    h.checkHit = (pl, dtH) => {
      h.cool -= dtH; if (h.cool > 0) return;
      if (pl.alive && !pl.shifting && h.covers(pl.ring, pl.theta, 0, pl.ringF, 0)) {
        const r = hitPlayer(h);
        h.cool = 0.5;
        if (r.blocked) return;    // Aegis holds you up
        const R = RINGS();
        let d = 1;
        const ok = (k) => k >= 0 && k < R.length && !HZ.gapAt(k, pl.theta) && (!G.player.ringOk || G.player.ringOk(k));
        if (ok(pl.ring + 1)) d = 1; else if (ok(pl.ring - 1)) d = -1; else d = pl.ring < 2 ? 1 : -1;
        try { G.player.forceShift && G.player.forceShift(d, { fall: true }); } catch (e) { logE('forceShift', e); }
        sfx('bump', {});
      }
    };
    h.onEnd = () => { setTimeout0(refreshGaps); };
    const handle = register(h);
    refreshGaps();
    sfx('crack', { vol: 0.8 });
    return handle;
  };
  const setTimeout0 = (fn) => Promise.resolve().then(fn);

  // ---------- custom
  HZ.custom = (o) => {
    const h = hazardBase('custom', o);
    h.active = o.active != null ? o.active : 0.3;
    h.test = o.test || (() => false);
    h.covers = (ring, theta, lt, ringF, pad = 0) => {
      if (!h.live(lt)) return false;
      try { return !!h.test(ring, theta, lt, pad); } catch (e) { logE('hz.custom.test', e); return false; }
    };
    if (o.draw) { try { const u = o.draw(h.group, h.handle); if (typeof u === 'function') h.visual = (lt, dt) => u(lt, dt); } catch (e) { logE('hz.custom.draw', e); } }
    // telegraph materials built by draw (G.combat.bandMesh / teleMaterial) get the standard fill, fire flash and fade
    h.group.traverse(c => { const m = c.material; if (m && m.uniforms && m.uniforms.uProgress && m.uniforms.uMode && !h.mats.includes(m)) h.mats.push(m); });
    if (o.onFire) h.onFire = () => o.onFire(h.handle);
    return register(h);
  };

  // ---------- contact (internal: add bodies)
  function contactHazard(add) {
    const h = hazardBase('contact', { label: add.label || 'Add', dmg: add.contactDmg, warn: 0 });
    h.active = Infinity; h.duration = () => Infinity; h.add = add; h.rings = [add.ring];
    h.covers = (ring, theta, lt, ringF, pad = 0) => {
      if (!add.alive || add.spawnT > 0.05) return false;
      const dt = lt - h.lt;
      return pointHit(ring, theta, add.ring, add.theta + add.omega * dt, add.radius + HIT_R, pad);
    };
    h.checkHit = (pl, dtH) => {
      add.contactCd -= dtH;
      if (!add.alive || add.contactCd > 0 || pl.shifting && pl.ring !== add.ring) return;
      if (h.covers(pl.ring, pl.theta, h.lt, pl.ringF, 0)) {
        const r = hitPlayer(h, add.contactDmg, add.label || 'Add');
        if (r.applied || r.blocked) {
          add.contactCd = 1.0;
          if (r.applied && add.blocks) { try { G.player.forceReverse && G.player.forceReverse(); } catch (e) { logE('forceReverse', e); } }
          try { add.onContact && add.onContact(add, r); } catch (e) { logE('add.onContact', e); }
          if (add.dieOnContact) killAdd(add, 'contact');
        }
      }
    };
    HZ.active.push(h);
    return h;
  }

  // ---------- prediction
  HZ.dangerAt = (ring, theta, tAhead = 0) => {
    const s = HZ.speed;
    for (const h of HZ.active) {
      if (h.finished || h.soak) continue;
      const lt = h.lt + tAhead * s;
      if (h.covers(ring, theta, lt, ring, PRED_PAD)) return 1;
    }
    return 0;
  };
  // additive: predicted total damage at a spot (for the bot); lethal hazards weigh extra
  HZ.damageAt = (ring, theta, tAhead = 0) => {
    const s = HZ.speed; let d = 0;
    for (const h of HZ.active) {
      if (h.finished || h.soak) continue;
      const lt = h.lt + tAhead * s;
      if (h.covers(ring, theta, lt, ring, PRED_PAD)) d += (h.kind === 'contact' ? (h.add.contactDmg || 20) : h.dmg || 10) * (h.lethal ? 1.6 : 1);
    }
    return d;
  };
  HZ.clear = (filter) => {
    for (const h of HZ.active.slice()) {
      if (h.finished) continue;
      if (h.kind === 'contact' && !filter) continue;   // add bodies go with G.adds.clear()
      if (filter && !filter(h)) continue;
      endHazard(h, true);
    }
    refreshGaps();
  };
  HZ.list = () => HZ.active.filter(h => !h.finished);

  // live-fill brightness cap: brighter skies (more bloom) and LDR targets (lower bloom threshold) get dimmer fills
  function liveCap() {
    const bl = (G.post && G.post.base && G.post.base.bloom) || 0.85;
    let c = clamp(1.05 - (bl - 0.8) * 0.9, 0.7, 1.0);
    if (G.gfx && G.gfx.hdr === false) c *= 0.88;
    return c;
  }
  function updateHazards(dtH, dt) {
    const pl = P();
    const cap = liveCap();
    const canHit = pl && PLAY(G.state) && pl.alive;
    for (const h of HZ.active.slice()) {
      if (h.dead) continue;
      h.visTime += dt;
      if (h.finished) {
        h.fadeT -= dt;
        const k = Math.max(0, h.fadeT / (h.fade0 || 0.3));
        setU(h, 'uAlpha', k);
        h.group.traverse(o => { if (o.material && !o.material.uniforms && o.material.transparent) { if (o.userData.a0 == null) o.userData.a0 = o.material.opacity; o.material.opacity = o.userData.a0 * k; } });
        if (h.holder) h.holder.scale.setScalar(Math.max(0.01, k));
        if (h.fadeT <= 0) disposeHazard(h);
        continue;
      }
      const prevState = h.state;
      h.lt += dtH;
      const dur = h.duration();
      if (h.lt < h.warn) h.state = 'warn';
      else if (h.lt < dur) h.state = 'live';
      else h.state = 'end';
      // telegraph uniforms
      const prog = h.warn > 0 ? clamp(h.lt / h.warn, 0, 1) : 1;
      for (const m of h.mats) {
        const u = m.uniforms; u.uTime.value = h.visTime; if (u.uCap) u.uCap.value = cap;
        if (u.uMode.value === 0 || u.uMode.value === 1 || u.uMode.value === 5) { u.uProgress.value = prog; u.uLive.value = (h.state === 'live' && h.kind !== 'sweep' && h.kind !== 'wave' && h.kind !== 'orb' && h.kind !== 'soak') ? 1 : 0; }
        u.uFire.value = h.fireFlash;
      }
      if (prevState === 'warn' && h.state !== 'warn' && h.kind !== 'soak') {
        h.fireFlash = 1;
        try { h.onFire && h.onFire(); } catch (e) { logE('hz.onFire.' + h.kind, e); }
      }
      h.fireFlash = Math.max(0, h.fireFlash - dt * 4);
      try { h.visual && h.visual(h.lt, dt); } catch (e) { logE('hz.visual.' + h.kind, e); }
      if (h.finished) continue;
      // hits
      if (canHit) {
        try {
          if (h.checkHit) h.checkHit(pl, dtH);
          else if (h.state === 'live') {
            if (h.covers(pl.ring, pl.theta, h.lt, pl.ringF, 0)) {
              if (h.tick) { if (h.lt >= h.nextTick) { const r = hitPlayer(h); if (r.applied || r.blocked) h.nextTick = h.lt + h.tick; } }
              else if (!h.hit) { const r = hitPlayer(h); if (r.applied || r.blocked) h.hit = true; }
            }
          }
        } catch (e) { logE('hz.hit.' + h.kind, e); }
      }
      if (h.state === 'end' && !h.finished) {
        if (h.onTimeout) { try { h.onTimeout(); } catch (e) { logE('hz.timeout', e); } }
        endHazard(h, false);
      }
    }
  }

  // ============================================================== ADDS
  const ADDS = G.adds = { list: [] };
  let addId = 1;
  function defaultAddModel(group, color) {
    const c = new T3.Color(color || accentHex());
    const brass = (G.mat && G.mat.brass) ? G.mat.brass({}) : new T3.MeshStandardMaterial({ color: 0xc9933a, metalness: 0.9, roughness: 0.35 });
    const body = new T3.Mesh(new T3.OctahedronGeometry(0.42, 0), new T3.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.4), emissive: c, emissiveIntensity: 1.3, metalness: 0.2, roughness: 0.4 }));
    body.scale.set(1, 1.5, 1); body.position.y = 0.8;
    const cap = new T3.Mesh(new T3.CylinderGeometry(0.28, 0.42, 0.18, 8), brass); cap.position.y = 0.2;
    const cap2 = cap.clone(); cap2.position.y = 1.42; cap2.rotation.x = PI;
    group.add(body, cap, cap2);
    group.userData.spin = body;
  }
  function makeBar() {
    const bg = new T3.Sprite(new T3.SpriteMaterial({ color: 0x05030c, transparent: true, opacity: 0.8, depthTest: false }));
    const fg = new T3.Sprite(new T3.SpriteMaterial({ color: 0xffd36b, transparent: true, opacity: 0.95, depthTest: false }));
    bg.scale.set(1.1, 0.13, 1); fg.scale.set(1.04, 0.08, 1); fg.center.set(0, 0.5); fg.position.x = -0.52;
    bg.renderOrder = 20; fg.renderOrder = 21;
    const g = new T3.Group(); g.add(bg, fg); g.userData.fg = fg; g.visible = false;
    return g;
  }
  ADDS.spawn = (o) => {
    const add = {
      id: addId++, ring: o.ring != null ? o.ring : 1, theta: o.theta || 0, omega: o.omega || 0, hp: o.hp || 100, maxHp: o.hp || 100,
      radius: o.radius || 0.6, contactDmg: o.contactDmg != null ? o.contactDmg : 20, blocks: o.blocks !== false,
      onDeath: o.onDeath, update: o.update, onContact: o.onContact, dieOnContact: !!o.dieOnContact, label: o.label || 'Add', data: o.data || {},
      alive: true, contactCd: 0, spawnT: 0.45, t: 0, group: new T3.Group(), pos: new T3.Vector3(), color: o.color || accentHex(), hitFlash: 0,
    };
    add.inner = new T3.Group(); add.group.add(add.inner);
    try { if (o.model) o.model(add.inner, add); else defaultAddModel(add.inner, add.color); } catch (e) { logE('add.model', e); defaultAddModel(add.inner, add.color); }
    add.bar = makeBar(); add.bar.position.y = o.barY || 2.0; add.group.add(add.bar);
    polar(RINGS()[add.ring], add.theta, 0, add.group.position); add.pos.copy(add.group.position).setY(0.8);
    const layer = (G.layers && G.layers.boss) || G.scene; layer && layer.add(add.group);
    add.hz = contactHazard(add);
    ADDS.list.push(add);
    fx('shockwave', add.group.position.clone().setY(0.1), { color: add.color, radius: 1.8, life: 0.4 });
    sfx('addSpawn');
    return add;
  };
  function killAdd(add, reason) {
    if (!add.alive) return;
    add.alive = false;
    const p = add.group.position.clone().setY(0.8);
    fx('burst', p, { color: add.color, count: 26, speed: 6, size: 0.6, life: 0.8 });
    fx('shockwave', p.clone().setY(0.1), { color: add.color, radius: 2.2, life: 0.4 });
    sfx('addDeath');
    try { add.onDeath && add.onDeath(add, reason); } catch (e) { logE('add.onDeath', e); }
    if (add.hz) endHazard(add.hz, true);
    add.dieT = 0.25;
    emit('addDied', { id: add.id, reason });
  }
  ADDS.kill = killAdd;
  ADDS.damage = (add, base, info = {}) => {
    if (!add || !add.alive) return 0;
    const amt = Math.round(base * damageMul(info, false));
    add.hp -= amt; add.hitFlash = 1;
    const src = info.source || 'strike';
    const st = G.player && G.player.stats; if (st) { st.damageBySkill[src] = (st.damageBySkill[src] || 0) + amt; }
    if (!G.settings || G.settings.numbers !== false) fx('number', add.group.position.clone().setY(1.6), amt, { crit: false, color: '#ffe7a0' });
    if (add.hp <= 0) killAdd(add, src);
    return amt;
  };
  ADDS.killAll = (reason = 'nova') => { for (const a of ADDS.list.slice()) killAdd(a, reason); };
  ADDS.clear = () => {
    for (const a of ADDS.list) { a.alive = false; if (a.hz) disposeHazard(a.hz); removeObj(a.group); }
    ADDS.list.length = 0;
  };
  function updateAdds(dtH, dt) {
    for (const a of ADDS.list.slice()) {
      if (!a.alive) {
        a.dieT -= dt; a.group.scale.setScalar(Math.max(0.01, a.dieT / 0.25));
        if (a.dieT <= 0) { removeObj(a.group); ADDS.list.splice(ADDS.list.indexOf(a), 1); }
        continue;
      }
      a.t += dtH;
      if (a.spawnT > 0) { a.spawnT -= dt; }
      const s = a.spawnT > 0 ? 1 - a.spawnT / 0.45 : 1;
      a.theta = wrap(a.theta + a.omega * dtH);
      try { a.update && a.update(a, dtH); } catch (e) { logE('add.update', e); }
      if (a.hz) a.hz.rings = [a.ring];
      polar(RINGS()[a.ring] != null ? RINGS()[a.ring] : ringR(a.ring), a.theta, 0, a.group.position);
      a.group.position.y = (1 - smooth(s)) * 4;
      a.pos.copy(a.group.position).setY(a.group.position.y + 0.8);
      a.inner.rotation.y = -a.theta + (a.omega >= 0 ? 0 : PI);
      if (a.inner.userData.spin) a.inner.userData.spin.rotation.y += dt * 2;
      a.hitFlash = Math.max(0, a.hitFlash - dt * 6);
      a.inner.scale.setScalar(1 + a.hitFlash * 0.12);
      const f = clamp(a.hp / a.maxHp, 0, 1);
      a.bar.visible = f < 0.999; a.bar.userData.fg.scale.x = 1.04 * f;
    }
  }

  // ===================================================== DAMAGE ROUTING
  const K = () => (G.player && G.player.K) || {};
  function damageMul(info, isBoss) {
    const pl = P(); const k = K();
    let m = 1;
    const ringMul = k.ringMul || [1.35, 1.0, 0.75];
    const ring = info.ring != null ? info.ring : pl ? pl.ring : 1;
    if (info.ringEligible !== false) m *= ringMul[ring] != null ? ringMul[ring] : 1;
    const behind = info.behind != null ? info.behind : !!(pl && pl.behind);
    if (isBoss && info.behindEligible !== false && behind) m *= k.behindMul || 1.5;
    const con = info.constellation != null ? info.constellation : !!(pl && pl.constellation);
    if (con && info.constellationEligible !== false) m *= k.constellationMul || 1.15;
    if (isBoss && C.boss && C.boss.staggerT > 0) m *= k.staggerMul || 1.3;
    if (info.mult) m *= info.mult;
    return m;
  }

  // ============================================================ COMBAT
  const C = G.combat = {
    Abort, isAbort, sectorGeometry, teleMaterial, bandMesh, ringSpans, complementArcs,
    boss: null, def: null, bossIndex: -1, practice: false, fightTime: 0, clock: 0,
    transitioning: false, checkpointUsed: false, results: null, fightCount: 0, startPhase: 0, deathPhase: 0,
    TELE_Y, HIT_R,
  };
  const flowTimers = [];
  function flowWait(sec) { return new Promise(res => flowTimers.push({ at: C.clock + sec, res })); }
  // cinematic wait (onTransition / onDeath): combat clock, keeps running while the boss is dead; never rejects,
  // simply never resolves after a reset/retry
  C.wait = flowWait;
  function raceTimeout(p, sec) { return Promise.race([Promise.resolve(p).catch(e => { if (!isAbort(e)) logE('cinematic', e); }), flowWait(sec)]); }

  function removeObj(o) {
    if (!o) return;
    if (o.parent) o.parent.remove(o);
    o.traverse(c => {
      if (c.geometry && !c.userData.sharedGeo) c.geometry.dispose();
      if (c.material && !c.userData.sharedMat) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => { if (m.userData && m.userData.shared) return; m.dispose(); });
    });
  }

  // ---------------------------------------------------- boss runtime
  function makeRuntime(def, index) {
    const b = {
      def, index, name: def.name, hp: def.maxHp || 10000, maxHp: def.maxHp || 10000, phase: 0, facing: -PI / 2 + PI, turnRate: 0.42,
      trackPlayer: true, facingTarget: null, autoFace: true, model: null, root: new T3.Group(), pos: new T3.Vector3(0, 0, 0),
      staggerT: 0, casting: null, alive: true, invulnerable: false, clock: 0, gen: 0, data: {}, recoil: 0, phaseT: 0,
      get staggered() { return this.staggerT > 0; },
    };
    // boss faces the hero's start position (bottom of the screen)
    b.facing = -PI / 2;
    const timers = [];
    b._timers = timers;
    b.wait = (sec) => {
      const gen = b.gen;
      return new Promise((res, rej) => {
        if (gen !== b.gen || !b.alive) { rej(new Abort()); return; }
        timers.push({ at: b.clock + Math.max(0, sec || 0), res, rej, gen });
      });
    };
    b.until = async (pred, step = 0.1) => { while (!pred()) await b.wait(step); };
    b.loop = (fn) => {
      const gen = b.gen;
      return (async () => {
        while (gen === b.gen && b.alive) {
          const c0 = b.clock;
          try { await fn(b); }
          catch (e) { if (isAbort(e) || gen !== b.gen) return; logE('boss.loop', e); }
          if (gen !== b.gen) return;
          if (b.clock - c0 < 0.05) { try { await b.wait(0.25); } catch (e) { return; } }
        }
      })();
    };
    b.cast = (o = {}) => {
      if (b.casting) endCast(false, true);
      const gen = b.gen;
      return new Promise((res, rej) => {
        const c = { name: o.name || 'Cast', dur: Math.max(0.1, o.dur || 2), t0: b.clock, progress: 0, interruptible: !!o.interruptible, res, rej, gen, o, handles: [] };
        if (o.telegraph) { try { const hs = o.telegraph(b); c.handles = hs ? (Array.isArray(hs) ? hs : [hs]) : []; } catch (e) { logE('cast.telegraph', e); } }
        b.casting = c;
        castRing(c);
        emit('castStart', { name: c.name, dur: c.dur, interruptible: c.interruptible });
      });
    };
    b.pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];
    b.rand = rand;
    b.randRange = (a, c) => a + (c - a) * rand();
    b.playerTheta = () => { const p = P(); return p ? p.theta : -PI / 2; };
    b.playerRing = () => { const p = P(); return p ? p.ring : 1; };
    b.playerDir = () => { const p = P(); return p ? p.dir : 1; };
    // hero theta predicted `sec` ahead on the current path
    b.playerAhead = (sec) => { const pl = G.player; if (pl && pl.predictTheta) return pl.predictTheta(sec); const p = P(); return p ? p.theta + p.dir * (G.OMEGA || 0.6) * sec : 0; };
    b.behind = () => { const p = P(); return !!(p && Math.abs(angDiff(p.theta, b.facing + PI)) < (K().behindHalf || PI / 3)); };
    b.say = (text, dur = 2.5) => emit('say', { text, dur });
    b.damage = (amount, info = {}) => C.dealDamage(amount, info);
    b.stagger = (dur) => { b.staggerT = Math.max(b.staggerT, dur || K().staggerDur || 3); b.recoil = 1; };
    b.hitPoint = (theta) => polar(def.hitRadius != null ? def.hitRadius : 1.1, theta != null ? theta : b.playerTheta(), def.hitHeight != null ? def.hitHeight : 2.0);
    b.faceTo = (theta) => { b.facingTarget = theta; };
    b.turnToward = (theta, dt, rate) => { const d = angDiff(theta, b.facing); const st = (rate || b.turnRate) * dt; b.facing = wrap(b.facing + clamp(d, -st, st)); };
    b.setFacing = (theta) => { b.facing = wrap(theta); };
    b.hz = HZ; b.adds = ADDS; b.R = RINGS();
    return b;
  }
  function endCast(interrupted, aborted) {
    const b = C.boss; if (!b || !b.casting) return;
    const c = b.casting; b.casting = null;
    if (c.ringMesh) { removeObj(c.ringMesh); c.ringMesh = null; }
    if (aborted) { c.handles.forEach(h => h && h.cancel && h.cancel()); emit('castEnd', { name: c.name, interrupted: false, aborted: true }); c.rej(new Abort()); return; }
    if (interrupted) {
      c.handles.forEach(h => h && h.cancel && h.cancel());
      emit('castEnd', { name: c.name, interrupted: true });
      try { c.o.onInterrupt && c.o.onInterrupt(b); } catch (e) { logE('cast.onInterrupt', e); }
      c.res('interrupted');
    } else {
      emit('castEnd', { name: c.name, interrupted: false });
      try { c.o.onDone && c.o.onDone(b); } catch (e) { logE('cast.onDone', e); }
      c.res('done');
    }
  }
  // in-world cast circle around the boss base
  function castRing(c) {
    const col = c.interruptible ? '#ffd36b' : accentHex();
    const m = bandMesh(2.6, 3.25, 0, TAU, 0, col, { y: TELE_Y + 0.02, order: 8 });
    m.material.uniforms.uSize.value.set(1e4, 0.65);
    if (c.interruptible) m.material.uniforms.uArrow.value = 1;
    const layer = (G.layers && G.layers.fx) || G.scene; layer && layer.add(m);
    c.ringMesh = m;
  }
  C.interrupt = () => {
    const b = C.boss;
    if (!b || !b.casting || !b.casting.interruptible || !b.alive) return false;
    const c = b.casting;
    const pos = b.hitPoint(b.playerTheta());
    endCast(true);
    b.stagger(K().staggerDur || 3);
    emit('interrupt', { name: c.name });
    fx('shockwave', new T3.Vector3(0, 0.2, 0), { color: '#ffe7a0', radius: 6, life: 0.6 });
    fx('burst', pos, { color: '#fff1c2', count: 40, speed: 9, size: 0.8, life: 0.9 });
    fx('flash', '#fff1c2', 0.35, 0.35);
    fx('number', pos.clone().setY(3.4), 0, { text: 'INTERRUPTED', color: '#fff1c2', crit: true, size: 0.75 });
    cam('shake', 0.6, 0.4); cam('hitStop', 0.09);
    return true;
  };

  // ------------------------------------------------------- damage
  C.damageMul = damageMul;
  C.dealDamage = (base, info = {}) => {
    const b = C.boss;
    if (info.target && info.target !== b) return ADDS.damage(info.target, base, info);
    if (!b || !b.alive || b.invulnerable || C.transitioning || !(PLAY(G.state))) return 0;
    const mul = damageMul(info, true);
    let amt = Math.max(1, Math.round(base * mul));
    const pl = P();
    const behind = info.behind != null ? info.behind : !!(pl && pl.behind);
    const pos = info.pos || b.hitPoint(pl ? pl.theta : 0);
    if (b.def.infinite) {
      C.practiceDamage = (C.practiceDamage || 0) + amt;
      C.dpsLog.push([C.clock, amt]);
    } else {
      const next = b.def.phases[b.phase + 1];
      const floor = next ? b.maxHp * next.hpStart : 0;
      const before = b.hp;
      b.hp = Math.max(floor, b.hp - amt);
      amt = Math.round(before - b.hp) || amt;
      if (b.hp <= floor + 0.01) {
        if (next) queueTransition(b.phase, b.phase + 1); else bossDeath();
      }
    }
    const src = info.source || 'strike';
    const st = G.player && G.player.stats; if (st && st.damageBySkill) st.damageBySkill[src] = (st.damageBySkill[src] || 0) + amt;
    const crit = !!(behind && info.behindEligible !== false) || !!info.crit;
    // Strike ticks (2+ per second) stay small and short so the big hits (Comet, lances, Nova) read
    if (!G.settings || G.settings.numbers !== false) fx('number', pos, amt, src === 'strike' ? { crit, color: crit ? '#ffe9a8' : '#e9b850', size: crit ? 0.95 : 0.7, life: 0.7, rise: 1.1 } : { crit, color: crit ? '#fff1c2' : '#ffc94d' });
    b.hitFlash = 1;
    emit('bossDamaged', { amount: amt, source: src, crit, behind, pos });
    return amt;
  };

  // ------------------------------------------------- phase handling
  function abortScripts(b) {
    b.gen++;
    const ts = b._timers.splice(0);
    for (const t of ts) t.rej(new Abort());
    if (b.casting) endCast(false, true);
  }
  function runPhase(b, i) {
    abortScripts(b);
    b.phase = i; b.phaseT = 0;
    const ph = b.def.phases[i]; if (!ph) return;
    emit('phaseStart', { index: i, name: ph.name });
    try { ph.enter && ph.enter(b); } catch (e) { logE('phase.enter', e); }
    const gen = b.gen;
    if (ph.script) {
      (async () => {
        try { await ph.script(b); }
        catch (e) { if (!isAbort(e) && gen === b.gen) logE('phase.script.' + ph.name, e); }
      })();
    }
  }
  let pendingTransition = null;
  function queueTransition(from, to) {
    const b = C.boss; if (!b || C.transitioning || pendingTransition) return;
    b.invulnerable = true;
    pendingTransition = { from, to };
  }
  const heroDown = () => { const p = P(); return !!(p && !p.alive) || C.deathT > 0 || G.state === 'dead'; };
  async function doTransition(from, to) {
    const b = C.boss; if (!b) return;
    if (heroDown()) { pendingTransition = null; return; }      // the hero fell on the threshold frame: the defeat flow wins
    const fc = C.fightCount;
    C.transitioning = true; b.invulnerable = true;
    abortScripts(b);
    HZ.clear(); ADDS.killAll('transition');
    setState('cinematic');
    emit('phaseTransition', { from, to });
    const ph = b.def.phases[to] || {};
    if (ph.sky !== false) { const sk = skyFor(b.def, to); world('setSky', sk[0], sk[1], ph.skyDur != null ? ph.skyDur : 2.5); }
    try { G.audio && G.audio.setIntensity && G.audio.setIntensity(musicIntensity(b.def, to)); } catch (e) { }
    let p;
    try { p = b.def.onTransition ? b.def.onTransition(b, from, to) : defaultTransition(b, from, to); } catch (e) { logE('onTransition', e); }
    await raceTimeout(p, 9);
    if (fc !== C.fightCount || C.boss !== b) return;
    await flowWait(0.15);
    if (fc !== C.fightCount || C.boss !== b) return;
    C.transitioning = false;
    if (heroDown()) {
      // the hero died during the cinematic (e.g. a raid hit queued on the same frame): never resume the fight;
      // finish the defeat flow here if it did not already run
      if (G.state !== 'dead' && !(C.deathT > 0)) { C.deathPhase = from; C.deathT = 0.01; }
      return;
    }
    b.invulnerable = false;
    setState(C.practice ? 'practice' : 'fight');
    runPhase(b, to);
  }
  // phase sky: phase.sky may be a preset name ('night'), [preset, level] or {preset, level}; default = def.sky at level = phase index
  function skyFor(def, i) {
    const ph = (def.phases && def.phases[i]) || {}, sk = ph.sky;
    if (Array.isArray(sk)) return [sk[0] || def.sky || 'night', sk[1] != null ? sk[1] : i];
    if (sk && typeof sk === 'object') return [sk.preset || def.sky || 'night', sk.level != null ? sk.level : i];
    return [(typeof sk === 'string' && sk) || def.sky || 'night', Math.min(3, i)];
  }
  C.skyFor = skyFor;
  // music intensity layer (0-3) for phase i: phase.intensity, else def.intensity[i], else spread over the phases so
  // the last phase always reaches the top layer (3 phases: 0, 2, 3; 4 phases: 0, 1, 2, 3)
  function musicIntensity(def, i) {
    const phs = (def && def.phases) || [], ph = phs[i] || {};
    if (typeof ph.intensity === 'number') return clamp(Math.round(ph.intensity), 0, 3);
    if (def && Array.isArray(def.intensity) && typeof def.intensity[i] === 'number') return clamp(Math.round(def.intensity[i]), 0, 3);
    const n = phs.length;
    if (n <= 1) return 0;
    return clamp(Math.round(i * 3 / (n - 1)), 0, 3);
  }
  C.musicIntensity = musicIntensity;
  function defaultTransition(b) {
    fx('flash', b.def.accent || accentHex(), 0.35, 0.6);
    fx('shockwave', new T3.Vector3(0, 0.3, 0), { color: b.def.accent || accentHex(), radius: 16, life: 1.2 });
    cam('shake', 0.5, 0.8);
    const c = G.camera ? G.camera.position.toArray() : [0, 20, 16];
    return cam('cinematic', [
      { t: 0, pos: c, look: [0, 0.5, 0] },
      { t: 1.2, pos: [3.5, 5.0, 12.5], look: [0, 3.2, 0] },
      { t: 2.6, pos: c, look: [0, 0.5, 0] },
    ], { name: 'transition' });
  }
  async function bossDeath() {
    const b = C.boss; if (!b || !b.alive) return;
    const fc = C.fightCount;
    b.alive = false; b.dying = true; b.invulnerable = true;
    abortScripts(b);
    HZ.clear(); ADDS.killAll('bossDeath');
    setState('cinematic');
    emit('bossDefeated', { bossIndex: C.bossIndex });
    let p;
    try { p = b.def.onDeath ? b.def.onDeath(b) : defaultDeath(b); } catch (e) { logE('onDeath', e); }
    await raceTimeout(p, 11);
    if (fc !== C.fightCount) return;
    C.results = computeResults();
    setState('victory');
    emit('fightEnd', { result: 'victory', results: C.results, bossIndex: C.bossIndex });
  }
  async function defaultDeath(b) {
    const acc = b.def.accent || accentHex();
    cam('slowMo', 0.3, 1.4);
    const c = G.camera ? G.camera.position.toArray() : [0, 20, 16];
    const pc = cam('cinematic', [
      { t: 0, pos: c, look: [0, 0.5, 0] },
      { t: 1.6, pos: [0, 4.5, 13], look: [0, 3, 0] },
      { t: 4.4, pos: [6, 7, 15], look: [0, 2.5, 0] },
      { t: 6.0, pos: c, look: [0, 0.5, 0] },
    ], { name: 'death' });
    for (let i = 0; i < 9; i++) {
      const p = new T3.Vector3((Math.random() - 0.5) * 2.5, 1 + Math.random() * 4, (Math.random() - 0.5) * 2.5);
      fx('burst', p, { color: i % 2 ? acc : '#fff1c2', count: 30, speed: 7, size: 0.8, life: 1.0 });
      cam('shake', 0.4, 0.3); sfx('crack', { vol: 0.8 });
      await flowWait(0.32);
    }
    fx('flash', '#fff6dd', 0.9, 1.2);
    fx('shockwave', new T3.Vector3(0, 0.4, 0), { color: '#fff1c2', radius: 22, life: 1.6 });
    fx('starFall', new T3.Vector3(0, 3, 0), '#fff1c2');
    cam('shake', 1.2, 1.0);
    sfx('thunder', {});
    if (b.root) b.root.visible = false;
    await flowWait(2.2);
    return pc;
  }

  function computeResults() {
    const st = (G.player && G.player.stats) || {};
    const def = C.def || {};
    const par = def.parTime || [200, 255, 285][C.bossIndex] || 240;
    const t = C.fightTime, dmg = st.damageTaken || 0;
    let grade = 'C';
    if (t <= par && dmg <= 120 && !C.checkpointUsed) grade = 'S';
    else if (t <= par * 1.15 && dmg <= 300) grade = 'A';
    else if (t <= par * 1.4 || dmg <= 500) grade = 'B';
    if (grade === 'S' && C.checkpointUsed) grade = 'A';
    return {
      bossIndex: C.bossIndex, name: def.name, title: def.title, time: t, grade, par,
      damageTaken: Math.round(dmg), hitsTaken: st.hitsTaken || 0, perfectAegis: st.perfectAegis || 0, interrupts: st.interrupts || 0,
      damageBySkill: { ...(st.damageBySkill || {}) }, checkpoint: C.checkpointUsed, deaths: st.deaths || 0,
    };
  }

  // ------------------------------------------------------ fight flow
  C.startFight = (bossIndex, opts = {}) => {
    const practice = !!opts.practice || bossIndex === 'practice';
    const def = practice ? G.bosses.practice : (typeof bossIndex === 'string' ? G.bosses[bossIndex] : G.bosses[bossIndex]);
    if (!def) { logE('startFight', new Error('no boss definition ' + bossIndex)); return false; }
    const keepStats = !!opts.keepStats;
    C.reset({ keepStats });
    C.fightCount++;
    C.def = def; C.bossIndex = practice ? -1 : bossIndex; C.practice = practice;
    C.fightTime = opts.keepTime ? (C._savedTime || 0) : 0;
    C.checkpointUsed = !!opts.checkpoint || (keepStats && C.checkpointUsed);
    if (!keepStats) C.checkpointUsed = !!opts.checkpoint;
    C.results = null; C.practiceDamage = 0; C.dpsLog = [];
    const seed = G.params && G.params.seed != null && G.params.seed !== '' ? (+G.params.seed + C.fightCount * 7919) : (Date.now() & 0xffff) + C.fightCount;
    try { G.reseed && G.reseed(seed); } catch (e) { }
    const accent = def.accent || '#5fe3ff';
    if (G.colors) G.colors.accent = accent;
    world('reset');
    world('setAccent', accent);
    const fromPhase = clamp(opts.fromPhase | 0, 0, def.phases.length - 1);
    { const sk = skyFor(def, fromPhase); world('setSky', sk[0], sk[1], 0); }
    const b = makeRuntime(def, C.bossIndex);
    C.boss = b;
    const layer = (G.layers && G.layers.boss) || G.scene;
    layer && layer.add(b.root);
    try { def.build && def.build(b); } catch (e) { logE('boss.build', e); }
    if (b.model) { if (b.model.parent !== b.root) b.root.add(b.model); }
    if (fromPhase > 0) { b.hp = b.maxHp * def.phases[fromPhase].hpStart; }
    b.phase = fromPhase; C.startPhase = fromPhase;
    buildRearSigil();
    try { G.player && G.player.reset && G.player.reset({ keepStats, practice, meter: opts.meter }); } catch (e) { logE('player.reset', e); }
    const quick = opts.skipIntro === false ? false : !!(opts.skipIntro || (G.params && (G.params.bot || G.params.skipintro)));
    C.introT = quick ? 0.4 : (practice ? 1.8 : 2.6);
    setState('intro');
    emit('fightStart', { bossIndex: C.bossIndex, practice, fromPhase, name: def.name, title: def.title, accent });
    return true;
  };
  C.skipIntro = () => { if (G.state === 'intro') C.introT = Math.min(C.introT, 0.05); };
  function beginFight() {
    const b = C.boss; if (!b) return;
    setState(C.practice ? 'practice' : 'fight');
    emit('fightBegin', { bossIndex: C.bossIndex, practice: C.practice });
    runPhase(b, b.phase);
  }
  C.retryPhase = () => {
    const ph = C.deathPhase != null ? C.deathPhase : (C.boss ? C.boss.phase : 0);
    const idx = C.practice ? 'practice' : C.bossIndex;
    C._savedTime = C.fightTime;
    return C.startFight(idx, { practice: C.practice, fromPhase: ph, keepStats: true, checkpoint: true, keepTime: true });
  };
  C.restart = () => C.startFight(C.practice ? 'practice' : C.bossIndex, { practice: C.practice, fromPhase: 0 });
  C.quit = () => {
    const was = !!C.boss;
    C.reset();
    setState('menu');
    if (was) emit('fightEnd', { result: 'quit' });
  };
  C.reset = (opts = {}) => {
    const b = C.boss;
    pendingTransition = null; C.transitioning = false; C.deathT = 0;
    flowTimers.length = 0;
    if (b) {
      abortScripts(b); b.alive = false;
      try { b.def.teardown && b.def.teardown(b); } catch (e) { logE('boss.teardown', e); }
    }
    for (const h of HZ.active.slice()) disposeHazard(h);
    HZ.active.length = 0; HZ.speed = 1;
    ADDS.clear();
    for (let i = 0; i < 3; i++) world('setRingBroken', i, []);
    const layer = G.layers && G.layers.boss;
    if (layer) for (const c of layer.children.slice()) removeObj(c);
    else if (b) removeObj(b.root);
    if (sigil) { removeObj(sigil); sigil = null; }
    C.boss = null;
    try { G.player && G.player.anchors && G.player.anchors.clear(); } catch (e) { logE('anchors.clear', e); }
    try { G.fx && G.fx.clear && G.fx.clear(); } catch (e) { logE('fx.clear', e); }
    try { G.cam && G.cam.clearTime && G.cam.clearTime(); } catch (e) { }
    try { G.post && G.post.reset && G.post.reset(); } catch (e) { logE('post.reset', e); }
    try { G.cam && G.cam.endCinematic && G.cam.inCinematic && G.cam.endCinematic(); } catch (e) { }
  };

  // ----------------------------------------------- rear sigil (weak point arc)
  let sigil = null;
  function buildRearSigil() {
    const half = K().behindHalf || PI / 3;
    const g = new T3.Group(); g.name = 'rearSigil';
    const arc = bandMesh(3.4, 3.95, PI - half, PI + half, 3, '#ffd36b', { y: TELE_Y, order: 4 });
    arc.material.uniforms.uSize.value.set(2 * half * 3.7, 0.55); arc.material.uniforms.uArrow.value = 1;
    g.add(arc); g.userData.arc = arc;
    const lm = new T3.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.12, blending: T3.AdditiveBlending, depthWrite: false, side: T3.DoubleSide });
    for (const s of [-1, 1]) {
      const a = PI + s * half;
      const geo = sectorGeometry(3.9, RINGS()[2] + 1.0, a - 0.006, a + 0.006, 2);
      const m = new T3.Mesh(geo, lm.clone()); m.position.y = TELE_Y - 0.01; m.renderOrder = 3; g.add(m);
      (g.userData.lines = g.userData.lines || []).push(m);
    }
    const layer = (G.layers && G.layers.fx) || G.scene; layer && layer.add(g);
    sigil = g;
  }
  function updateSigil(b, dt) {
    if (!sigil) return;
    sigil.visible = !!(b && b.alive && !b.def.noSigil);
    if (!sigil.visible) return;
    sigil.rotation.y = b.facing;
    const pl = P(); const on = pl && pl.behind;
    const u = sigil.userData.arc.material.uniforms;
    u.uTime.value += dt;
    const target = on ? 1.0 : 0.45;
    u.uAlpha.value += (target - u.uAlpha.value) * Math.min(1, dt * 6);
    for (const m of sigil.userData.lines) m.material.opacity = on ? 0.3 : 0.12;
  }

  // ---------------------------------------------- boss per-frame
  const fadeBox = new T3.Box3(), v1 = new T3.Vector3(), v2 = new T3.Vector3();
  let fadeK = 1, fadeCheck = 0, fadeOn = false;
  function bossFade(b, dt) {
    if (!b.model || !G.camera) return;
    fadeCheck -= dt;
    if (fadeCheck <= 0) {
      fadeCheck = 0.1;
      const pl = P(); let want = false;
      // never ghost the boss in its own close-ups: cinematics (transitions, Supernova, death), transitions, death
      const scripted = (G.cam && G.cam.inCinematic) || C.transitioning || !b.alive || b.dying || G.state === 'cinematic' || G.state === 'victory';
      if (pl && pl.pos && b.root.visible && !scripted) {
        fadeBox.setFromObject(b.model);
        if (!fadeBox.isEmpty()) {
          // hero on the far side of the boss (screen-wise) and inside its projected box
          v1.copy(pl.pos).setY(pl.pos.y + 0.5).project(G.camera);
          const camD = G.camera.position.distanceTo(pl.pos), bossD = G.camera.position.distanceTo(v2.set(0, 1.5, 0));
          if (camD > bossD - 1.0) {
            const c = [fadeBox.min, fadeBox.max]; let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
            for (let i = 0; i < 8; i++) { v2.set(c[i & 1].x, c[(i >> 1) & 1].y, c[(i >> 2) & 1].z).project(G.camera); x0 = Math.min(x0, v2.x); x1 = Math.max(x1, v2.x); y0 = Math.min(y0, v2.y); y1 = Math.max(y1, v2.y); }
            const m = 0.04;
            want = v1.x > x0 - m && v1.x < x1 + m && v1.y > y0 - m && v1.y < y1 + m;
          }
        }
      }
      b._fadeWant = want;
    }
    const target = b._fadeWant ? (b.def.fadeOpacity || 0.35) : 1;
    fadeK += (target - fadeK) * Math.min(1, dt * 8);
    if (Math.abs(fadeK - 1) < 0.01 && !b._fadeWant) {
      if (fadeOn) { fadeOn = false; applyFade(b, 1, true); }
      fadeK = 1; return;
    }
    fadeOn = true; applyFade(b, fadeK, false);
  }
  function applyFade(b, k, restore) {
    b.model.traverse(o => {
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : null; if (!ms) return;
      for (const m of ms) {
        if (!m.userData) continue;
        if (m.userData.fade0 == null) { m.userData.fade0 = m.opacity; m.userData.fadeT0 = m.transparent; }
        if (restore) { m.opacity = m.userData.fade0; if (m.transparent !== m.userData.fadeT0) { m.transparent = m.userData.fadeT0; m.needsUpdate = true; } continue; }
        if (!m.transparent) { m.transparent = true; m.needsUpdate = true; }
        m.opacity = m.userData.fade0 * k;
      }
    });
  }
  function updateBoss(dt) {
    const b = C.boss; if (!b) return;
    const bdt = dt * HZ.speed;
    b.clock += bdt; b.phaseT += bdt;
    // timers
    if (b._timers.length) {
      const due = [];
      for (let i = b._timers.length - 1; i >= 0; i--) { const t = b._timers[i]; if (t.at <= b.clock) { due.push(t); b._timers.splice(i, 1); } }
      due.sort((a, c) => a.at - c.at).forEach(t => t.gen === b.gen ? t.res() : t.rej(new Abort()));
    }
    // facing
    if (b.alive && !b.dying) {
      const pl = P();
      let target = null;
      if (b.facingTarget != null) target = b.facingTarget;
      else if (b.trackPlayer && pl) target = pl.theta;
      if (target != null && b.turnRate > 0) b.turnToward(target, bdt);
    }
    b.staggerT = Math.max(0, b.staggerT - bdt);
    b.recoil = Math.max(0, b.recoil - dt * 2.2);
    b.hitFlash = Math.max(0, (b.hitFlash || 0) - dt * 5);
    if (b.casting) {
      const c = b.casting; c.progress = clamp((b.clock - c.t0) / c.dur, 0, 1);
      if (c.ringMesh) { const u = c.ringMesh.material.uniforms; u.uProgress.value = c.progress; u.uTime.value += dt; }
      if (c.progress >= 1 && PLAY(G.state)) endCast(false);
    }
    if (PLAY(G.state) && b.alive) {
      const ph = b.def.phases[b.phase];
      try { ph && ph.update && ph.update(b, bdt); } catch (e) { logE('phase.update', e); }
    }
    try { b.def.animate && b.def.animate(b, dt); } catch (e) { logE('boss.animate', e); }
    if (b.autoFace) b.root.rotation.y = b.facing + (b.def.facingOffset || 0);
    // recoil: a short backwards tilt (local -x is the boss's back since +x faces)
    b.root.rotation.z = b.recoil > 0 ? Math.sin(b.recoil * PI) * 0.12 : 0;
    updateSigil(b, dt);
    bossFade(b, dt);
  }

  // --------------------------------------------------------- update
  C.update = (dt) => {
    const st = G.state;
    if (st === 'paused') return;
    const rdt = G.rdt != null ? G.rdt : dt;
    C.clock += dt;
    if (flowTimers.length) {
      for (let i = flowTimers.length - 1; i >= 0; i--) if (flowTimers[i].at <= C.clock) { const t = flowTimers.splice(i, 1)[0]; t.res(); }
    }
    if (!C.boss) { if (HZ.active.length) updateHazards(dt * HZ.speed, dt); return; }
    if (st === 'intro') {
      C.introT -= dt;              // game time: fast-forward and pause behave like real play
      if (C.introT <= 0) beginFight();
    }
    if (st === 'fight') C.fightTime += dt;
    if (st === 'fight' || st === 'practice' || st === 'cinematic' || st === 'dead' || st === 'victory' || st === 'intro') {
      const dtH = dt * HZ.speed;
      updateHazards(dtH, dt);
      updateAdds(dtH, dt);
      updateBoss(dt);
    }
    if (pendingTransition && heroDown()) pendingTransition = null;
    if (pendingTransition && PLAY(G.state) && !(P() && P().novaActive)) {
      const p = pendingTransition; pendingTransition = null;
      doTransition(p.from, p.to);
    }
    // defeat flow
    if (C.deathT > 0) {
      C.deathT -= rdt;
      if (C.deathT <= 0) {
        C.deathT = 0;
        if (C.boss) { abortScripts(C.boss); }
        HZ.clear();
        setState('dead');
        emit('fightEnd', { result: 'defeat', bossIndex: C.bossIndex, phase: C.deathPhase });
      }
    }
    if (C.practice && C.dpsLog) { while (C.dpsLog.length && C.dpsLog[0][0] < C.clock - 5) C.dpsLog.shift(); }
  };
  // test hooks: jump to a phase through a real transition; kill the boss (death cinematic + results)
  C.forcePhase = (i) => {
    const b = C.boss; if (!b || !b.alive || b.def.infinite) return false;
    i = clamp(i | 0, 0, b.def.phases.length - 1);
    if (i === b.phase) return false;
    b.hp = b.maxHp * b.def.phases[i].hpStart;
    if (PLAY(G.state)) doTransition(b.phase, i); else pendingTransition = { from: b.phase, to: i };
    return true;
  };
  C.killBoss = () => {
    const b = C.boss; if (!b || !b.alive || b.def.infinite) return false;
    b.hp = 0; pendingTransition = null; C.transitioning = false; bossDeath(); return true;
  };
  C.dps = () => { if (!C.dpsLog || !C.dpsLog.length) return 0; let s = 0; for (const e of C.dpsLog) s += e[1]; return s / 5; };
  C.playing = () => PLAY(G.state);

  C.init = () => {
    G.on && G.on('playerDied', () => {
      if (!C.boss || C.practice) return;
      C.deathPhase = C.boss.phase;
      C.deathT = 1.8;
      pendingTransition = null;
    });
  };

  // ======================================================= PRACTICE DUMMY
  // An orrery sphere target: infinite HP, gentle versions of every primitive with a hint each, an
  // interruptible cast every 12 s. The player takes no damage (player module checks G.combat.practice).
  const practice = {
    name: 'ORRERY DUMMY', title: 'the Patient Sphere', accent: '#62cfff', sky: 'night', music: 'menu', maxHp: 1e9, infinite: true, noSigil: false,
    hitRadius: 1.2, hitHeight: 2.2,
    phases: [{
      name: 'Practice', hpStart: 1.0,
      enter(b) { b.turnRate = 0.3; },
      async script(b) {
        // lesson lines name the control the player actually has: keys on desktop, buttons on touch
        const K = (key, btn) => G.isTouch ? btn : key;
        const say = (t) => b.say(t, 4.4);
        b.loop(async () => {
          await b.wait(12);
          say('Gold-framed cast: press ' + K('ECLIPSE (E)', 'the ECLIPSE button') + ' before it ends');
          await b.cast({ name: 'Practice Hymn', dur: 3.5, interruptible: true, onInterrupt: () => b.say('Interrupted! The dummy is staggered: x1.3 damage'), onDone: () => b.say('Cast completed. Next time, Eclipse it.') });
        });
        const R = b.R;
        const lessons = [
          async () => {
            say('WEDGE: the fill shows when it fires. ' + K('Reverse (A/D) or Shift (W/S)', 'REVERSE or IN/OUT') + ' out of it');
            const c = b.playerAhead(2.2);
            await G.hz.arc({ rings: [b.playerRing()], center: c, width: 0.9, warn: 2.8, dmg: 15, label: 'Wedge' });
          },
          async () => {
            say('SWEEP: the beam travels the marked arc. Reverse into the open part');
            const th = b.playerTheta(), d = b.playerDir();
            const from = th - d * 1.6;
            await G.hz.sweep({ rings: [0, 1], from, to: from + d * PI * 1.4, warn: 2.6, dur: 3.2, dmg: 15, label: 'Sweep' });
          },
          async () => {
            say('RING: the whole ring detonates. Shift to another ring');
            await G.hz.ring({ ring: b.playerRing(), warn: 3.0, dmg: 20, label: 'Ring Blast' });
          },
          async () => {
            say('ROTOR: slices rotate. Match their speed, or ' + K('Eclipse (E)', 'ECLIPSE') + ' to wait in a gap');
            await G.hz.rotor({ rings: [1, 2], slices: [{ center: 0, width: 0.5 }, { center: PI, width: 0.5 }], omega: 0.35, warn: 2.2, dur: 7, dmg: 10, label: 'Rotor' });
          },
          async () => {
            say('WAVE: an outward shockwave. Be inside a gold gap, or Shift as it crosses you');
            const th = b.playerAhead(2.4);
            await G.hz.wave({ from: 'in', speed: 4.5, gaps: [{ center: th, width: 0.8 }, { center: th + PI, width: 0.8 }], warn: 3.2, dmg: 20, label: 'Wave' });
          },
          async () => {
            say('ORBS: travelling stars. Dodge, or ' + K('Aegis (F)', 'AEGIS') + ' just before they hit: a reflected lance');
            const r = b.playerRing();
            for (let i = 0; i < 3; i++) { G.hz.orb({ ring: r, theta: b.playerTheta() + b.playerDir() * (2.4 + i * 0.6), omega: -b.playerDir() * 0.35, life: 9, dmg: 10, label: 'Orb' }); await b.wait(0.4); }
            await b.wait(4);
          },
          async () => {
            b.say('BOLTS: marked spots ahead. Reverse or Shift');
            const r = b.playerRing();
            for (let i = 0; i < 3; i++) G.hz.bolt({ from: new T3.Vector3(0, 7, 0), ring: r, theta: b.playerAhead(1.6 + i * 0.7), warn: 2.2 + i * 0.25, dmg: 12, label: 'Bolt' });
            await b.wait(3.6);
          },
          async () => {
            say('SOAK STAR: run through it before its timer ends');
            const r = (b.playerRing() + 1) % 3;
            await G.hz.soak({ ring: r, theta: b.playerAhead(4), warn: 7, failDmg: 10, label: 'Soak', onSoak: () => b.say('Soaked!') });
          },
          async () => {
            say('BLOCKER: a pylon on your ring. Strike kills it, or Reverse / Shift around');
            const r = b.playerRing();
            ADDS.spawn({ ring: r, theta: b.playerAhead(3), hp: 160, contactDmg: 10, label: 'Pylon' });
            await b.wait(6);
          },
          async () => {
            say('BROKEN TRACK: running into a gap drops you a ring. Shift around it');
            const r = b.playerRing();
            const h = G.hz.gap({ ring: r, center: b.playerAhead(3.5), width: 0.5, dmg: 10, label: 'Gap' });
            await b.wait(8); h.cancel();
          },
          async () => {
            say('Plant ANCHORS' + K(' (Q)', '') + ' around the dummy; run back over them to pulse and heal');
            await b.wait(4);
          },
          async () => {
            say('COMET: hold ' + K('SPACE', 'COMET') + ', release while BEHIND the dummy (gold sigil) for x1.5');
            await b.wait(5);
          },
          async () => {
            say('LETHAL: striped shapes hit hard. Leave that ring before the fill completes');
            await G.hz.ring({ ring: b.playerRing(), warn: 3.2, dmg: 60, lethal: true, label: 'Lethal Ring' });
          },
        ];
        let i = 0;
        b.loop(async () => {
          await b.wait(2.2);
          await lessons[i % lessons.length]();
          i++;
          await b.wait(1.0);
        });
      },
    }],
    build(b) {
      const g = new T3.Group();
      const brass = (G.mat && G.mat.brass) ? G.mat.brass({}) : new T3.MeshStandardMaterial({ color: 0xc9933a, metalness: 0.9, roughness: 0.35 });
      const ped = new T3.Mesh(new T3.CylinderGeometry(0.9, 1.4, 0.6, 24), brass); ped.position.y = 0.3;
      const col = new T3.Mesh(new T3.CylinderGeometry(0.18, 0.28, 1.0, 12), brass); col.position.y = 1.0;
      const sph = new T3.Mesh(new T3.SphereGeometry(0.85, 32, 20), new T3.MeshStandardMaterial({ color: 0x1b1a3a, metalness: 0.5, roughness: 0.3, emissive: 0x3a4a8a, emissiveIntensity: 0.45 }));
      sph.position.y = 2.2;
      const rings = new T3.Group(); rings.position.y = 2.2;
      for (let i = 0; i < 3; i++) {
        const t = new T3.Mesh(new T3.TorusGeometry(1.15 + i * 0.12, 0.035, 8, 64), brass);
        t.rotation.x = PI / 2 + (i - 1) * 0.6; t.rotation.y = i * 0.9; rings.add(t);
      }
      // the "eye": shows facing (+x)
      const eye = new T3.Mesh(new T3.SphereGeometry(0.2, 16, 12), new T3.MeshBasicMaterial({ color: new T3.Color('#8fd8ff').multiplyScalar(1.6) }));
      eye.position.set(0.82, 2.25, 0);
      // rear weak point sigil (-x)
      const rear = new T3.Mesh(new T3.RingGeometry(0.18, 0.32, 24), new T3.MeshBasicMaterial({ color: new T3.Color('#ffd36b').multiplyScalar(1.6), side: T3.DoubleSide }));
      rear.position.set(-0.86, 2.2, 0); rear.rotation.y = PI / 2;
      g.add(ped, col, sph, rings, eye, rear);
      b.model = g; b.data.rings = rings; b.data.sph = sph;
    },
    animate(b, dt) {
      const r = b.data.rings; if (!r) return;
      r.children.forEach((t, i) => { t.rotation.z += dt * (0.4 + i * 0.25); });
      b.data.sph.material.emissiveIntensity = 0.45 + (b.hitFlash || 0) * 0.8 + (b.casting ? 0.4 * Math.sin(b.clock * 12) : 0);
      b.model.position.y = Math.sin(b.clock * 1.3) * 0.08;
    },
  };
  G.bosses = G.bosses || [];
  G.bosses.practice = practice;
})();
