// =====================================================================
// 06_combat.js: hazards (2D shapes on the arena disc) + telegraph shader,
// adds, damage routing, boss framework (runtime object b), fight flow,
// practice dummy. Exposes G.hz, G.adds, G.combat, G.bosses.practice.
// See SPEC.md sections 4-6 and BOSS_AUTHORING.md.
// =====================================================================
(() => {
  const T3 = (typeof THREE !== 'undefined') ? THREE : G.THREE;
  const PI = Math.PI, TAU = PI * 2;
  const AREA_M = 0.15;              // area hazards: the player counts as inside this far past the edge
  const PRED_PAD = 0.3;             // extra pad for predictions (bot)
  const TELE_Y = 0.04;
  const COL = { gold: '#ffd36b', safe: '#4fa8ff', soak: '#5cff9a', purple: '#c070ff', void: '#6a2a9a' };

  // ---------------------------------------------------------------- helpers
  const wrap = (a) => a - TAU * Math.floor((a + PI) / TAU);
  const angDiff = (a, b) => wrap(a - b);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const polar = (r, th, y = 0, out) => G.polar(r, th, y, out);
  const logE = (w, e) => { try { G.log && G.log.error ? G.log.error(w, e) : console.error(w, e); } catch (_) { console.error(w, e); } };
  const fx = (name, ...a) => { try { const f = G.fx && G.fx[name]; return f ? f.apply(G.fx, a) : undefined; } catch (e) { logE('fx.' + name, e); } };
  const sfx = (name, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(name, o); } catch (e) { logE('sfx.' + name, e); } };
  const world = (name, ...a) => { try { const f = G.world && G.world[name]; return f ? f.apply(G.world, a) : undefined; } catch (e) { logE('world.' + name, e); } };
  const cam = (name, ...a) => { try { const f = G.cam && G.cam[name]; return f ? f.apply(G.cam, a) : undefined; } catch (e) { logE('cam.' + name, e); } };
  const emit = (n, d) => { try { G.emit && G.emit(n, d); } catch (e) { logE('emit.' + n, e); } };
  const rand = () => (G.rand ? G.rand() : Math.random());
  const P = () => (G.player && G.player.state) || null;
  const PX = () => { const p = P(); return p && p.pos ? p.pos.x : 0; };
  const PZ = () => { const p = P(); return p && p.pos ? p.pos.z : 8; };
  const accentHex = () => (G.colors && G.colors.accent) || '#ff7a2a';
  const PLAY = (s) => s === 'fight' || s === 'practice';
  const arenaR = () => (G.world && G.world.arenaR != null) ? G.world.arenaR : (G.ARENA_R || 13);
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
  const setState = (s) => { if (G.state === s) return; if (G.setState) G.setState(s); else G.state = s; };

  class Abort extends Error { constructor(m) { super(m || 'aborted'); this.name = 'Abort'; this.isAbort = true; } }
  const isAbort = (e) => e && (e.isAbort || e instanceof Abort);

  // ------------------------------------------------- telegraph shader
  // One flat unit quad per telegraph; the fragment shader does the shape in local xz units.
  // uShape: 0 disc, 1 annulus, 2 sector, 3 rect.  uMode: 0 danger, 1 gold (lethal/unblockable), 2 safe (blue), 3 soak (green), 4 void, 5 cast ring
  const TELE_VS = `
    uniform vec2 uScale; varying vec2 vP; varying vec2 vUv;
    void main(){ vUv = uv; vP = position.xz * uScale; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const TELE_FS = `
    precision highp float;
    uniform vec3 uColor; uniform float uTime, uP, uLive, uAlpha, uMode, uShape, uA, uB, uC, uD, uArrow, uCap, uSoft, uFlash;
    varying vec2 vP; varying vec2 vUv;
    float adiff(float a, float b){ float d = a - b; return d - 6.28318530718 * floor((d + 3.14159265359) / 6.28318530718); }
    void main(){
      float r = length(vP); float th = atan(-vP.y, vP.x);
      float inside = 0.0;      // 1 inside the shape
      float edge = 1e9;        // distance to the nearest edge (world units)
      float fillF = 0.0;       // 0..1 along the fill direction
      if (uShape < 0.5) { inside = step(r, uA); edge = abs(r - uA); fillF = r / max(uA, 1e-3); }
      else if (uShape < 1.5) { inside = step(uA, r) * step(r, uB); edge = min(abs(r - uA), abs(r - uB)); fillF = (r - uA) / max(uB - uA, 1e-3); }
      else if (uShape < 2.5) {
        float da = abs(adiff(th, uC));
        inside = step(uA, r) * step(r, uB) * step(da, uD);
        float eAng = r * max(0.0, uD - da) ;       // approx distance to an angular edge
        edge = min(min(abs(r - uB), uA > 0.05 ? abs(r - uA) : 1e9), eAng);
        fillF = (r - uA) / max(uB - uA, 1e-3);
      } else {
        float hx = uA, hz = uB;   // half length (x), half width (z)
        inside = step(abs(vP.x), hx) * step(abs(vP.y), hz);
        edge = min(hx - abs(vP.x), hz - abs(vP.y));
        fillF = (vP.x + hx) / max(2.0 * hx, 1e-3);
      }
      if (inside < 0.5) discard;
      vec3 acc = uColor;
      float accC = max(acc.r, max(acc.g, acc.b)) - min(acc.r, min(acc.g, acc.b));
      vec3 accS = max(mix(vec3(dot(acc, vec3(0.2126, 0.7152, 0.0722))), acc, clamp(0.5 / max(accC, 0.01), 1.3, 3.0)), vec3(0.0));
      vec3 tint = accS / max(0.001, max(accS.r, max(accS.g, accS.b)));
      float pulse = 0.5 + 0.5 * sin(uTime * mix(4.0, 16.0, uP));
      float ew = 0.16;
      float outline = 1.0 - smoothstep(ew * 0.6, ew, edge);
      float innerGlow = (1.0 - smoothstep(ew, ew * 3.2, edge)) * 0.35;
      float filled = 1.0 - smoothstep(uP - 0.012, uP + 0.012, fillF);
      float front = (1.0 - smoothstep(0.0, 0.03, abs(fillF - uP))) * step(0.02, uP) * step(uP, 0.985);
      vec3 col; float a;
      if (uMode > 4.5) {            // cast ring: progress sweeps around
        float u = fract((th + 3.14159265359) / 6.28318530718);
        float sw = step(u, uP);
        a = uAlpha * (0.22 + 0.5 * sw + outline * 0.5);
        col = mix(accS * 0.35, accS * 1.1, sw) + vec3(outline * 0.4);
        float chev = step(0.7, fract(u * 36.0 - uTime * 2.0)) * uArrow;
        col += chev * 0.45; a += chev * 0.2;
      } else if (uMode > 3.5) {     // void: dark pit with a glowing lip
        a = uAlpha * (0.9 - 0.25 * smoothstep(0.0, 0.8, edge));
        col = mix(accS * 0.8, vec3(0.01, 0.0, 0.02), smoothstep(0.0, 0.5, edge)) + vec3(outline * 0.5) * accS;
      } else if (uMode > 2.5) {     // soak: green star, pulse, ring that closes with the timer
        float star = 1.0 - smoothstep(0.0, 0.5, abs(r - uA * (1.0 - uP) * 0.9));
        a = uAlpha * (0.18 + 0.12 * pulse + outline * 0.6 + star * 0.5);
        col = accS * (0.6 + 0.4 * pulse) + vec3(star * 0.35);
      } else if (uMode > 1.5) {     // safe: blue, calm, fills as the timer runs
        a = uAlpha * (0.14 + filled * 0.16 + outline * 0.7 + innerGlow * 0.5 + front * 0.5);
        col = mix(accS * 0.5, accS * 1.05, filled) + vec3(front * 0.4) + vec3(outline * 0.35);
        if (uLive > 0.5) { a = uAlpha * (0.3 + 0.08 * pulse); col = accS * 0.9; }
      } else {                      // danger / gold
        float hatch = step(0.55, fract((vP.x + vP.y) * 0.9 - uTime * 1.6)) * step(0.5, uMode);
        float base = 0.20 + 0.04 * pulse + 0.05 * uMode * pulse;
        float fillA = filled * (0.22 + 0.08 * pulse + 0.1 * uMode);
        a = base + fillA + front * 0.55 + hatch * 0.16 + outline * (0.8 + 0.2 * uMode * pulse) + innerGlow * 0.6;
        col = mix(accS * 0.16, accS * 0.95, filled) + acc * front * 0.9 + vec3(hatch * 0.18) + outline * mix(accS, vec3(1.0), 0.35) * 0.9 + innerGlow * accS * 0.5;
        if (uArrow > 0.5) {
          float s = (uShape > 2.5 ? (vP.x) : r) * 1.4 - uTime * 2.2;
          float chev = step(0.72, fract(s)) * step(ew * 1.5, edge);
          col += chev * 0.3; a += chev * 0.18;
        }
        if (uLive > 0.5) {
          if (uSoft > 0.5) { a = 0.34 + 0.05 * pulse + outline * 0.5; col = tint * 0.7 * uCap + outline * 0.3; }
          else { a = 0.5 + 0.12 * sin(uTime * 30.0 + (vP.x - vP.y) * 2.0) + outline * 0.4; col = mix(tint, vec3(1.0), 0.18) * 0.95 * uCap; }
        }
        a *= uAlpha;
        col += vec3(uFlash) * tint;
      }
      gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    }`;
  let quadGeo = null;
  const QUAD = () => {
    if (quadGeo) return quadGeo;
    const g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
    g.setAttribute('uv', new T3.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    quadGeo = g; return g;
  };
  const toC = (c) => { try { return (c && c.isColor) ? c.clone() : new T3.Color(c == null ? accentHex() : c); } catch (e) { return new T3.Color(accentHex()); } };
  function teleMaterial(color, mode = 0) {
    return new T3.ShaderMaterial({
      uniforms: {
        uColor: { value: toC(color) }, uTime: { value: Math.random() * 10 }, uP: { value: 0 }, uLive: { value: 0 }, uAlpha: { value: 1 }, uMode: { value: mode },
        uShape: { value: 0 }, uA: { value: 1 }, uB: { value: 2 }, uC: { value: 0 }, uD: { value: 0.5 }, uArrow: { value: 0 }, uCap: { value: 1 }, uSoft: { value: 0 }, uFlash: { value: 0 },
        uScale: { value: new T3.Vector2(1, 1) },
      },
      vertexShader: TELE_VS, fragmentShader: TELE_FS, transparent: true, depthWrite: false, depthTest: true, side: T3.DoubleSide, toneMapped: false, fog: false,
    });
  }
  // o: {shape: 'disc'|'ring'|'sector'|'rect', x, z, r, r0, r1, theta, width, len, rot, color, mode, y, order, arrow}
  function teleMesh(o = {}) {
    const m = new T3.Mesh(QUAD(), teleMaterial(o.color, o.mode || 0));
    m.userData.sharedGeo = true; m.userData.tele = true;
    m.renderOrder = o.order != null ? o.order : 6;
    m.frustumCulled = false;
    setShape(m, o);
    m.position.y = o.y != null ? o.y : TELE_Y;
    const U = m.material.uniforms;
    U.uArrow.value = o.arrow ? 1 : 0;
    return m;
  }
  function setShape(m, o) {
    const U = m.material.uniforms;
    const marg = 0.5;
    m.position.x = num(o.x, 0); m.position.z = num(o.z, 0); m.rotation.y = 0;
    if (o.shape === 'rect') {
      const len = Math.max(0.01, num(o.len, 4)), w = Math.max(0.01, num(o.width, 1));
      U.uShape.value = 3; U.uA.value = len / 2; U.uB.value = w / 2;
      m.scale.set(len + marg, 1, w + marg); U.uScale.value.set(len + marg, w + marg);
      m.rotation.y = num(o.rot, 0);
    } else if (o.shape === 'ring') {
      const r0 = Math.max(0, num(o.r0, 2)), r1 = Math.max(r0 + 0.01, num(o.r1, 4));
      U.uShape.value = 1; U.uA.value = r0; U.uB.value = r1;
      const s = r1 * 2 + marg; m.scale.set(s, 1, s); U.uScale.value.set(s, s);
    } else if (o.shape === 'sector') {
      const r0 = Math.max(0, num(o.r0, 0)), r1 = Math.max(r0 + 0.01, num(o.r, num(o.r1, 6)));
      U.uShape.value = 2; U.uA.value = r0; U.uB.value = r1; U.uC.value = num(o.theta, 0); U.uD.value = Math.max(0.01, num(o.width, 0.8) / 2);
      const s = r1 * 2 + marg; m.scale.set(s, 1, s); U.uScale.value.set(s, s);
    } else {
      const r = Math.max(0.01, num(o.r, 2));
      U.uShape.value = 0; U.uA.value = r;
      const s = r * 2 + marg; m.scale.set(s, 1, s); U.uScale.value.set(s, s);
    }
  }
  const fxLayer = () => (G.layers && G.layers.fx) || G.scene;
  function removeObj(o) {
    if (!o) return;
    if (o.parent) o.parent.remove(o);
    o.traverse(c => {
      if (c.geometry && !c.userData.sharedGeo) c.geometry.dispose();
      if (c.material && !c.userData.sharedMat) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => { if (m.userData && m.userData.shared) return; m.dispose(); });
    });
  }

  // ============================================================ HAZARDS
  let hid = 0;
  const HZ = G.hz = { active: [], speed: 1, TELE_Y };
  const bloomCap = () => { const b = G.bloomPass; const s = b ? b.strength : 0.85; return clamp(1.05 - 0.3 * clamp((s - 0.7) / 0.6, 0, 1), 0.7, 1.05) * (G.gfx && G.gfx.hdr ? 1 : 0.88); };

  function makeHazard(kind, o, impl) {
    const h = {
      id: ++hid, kind, o, t: 0, warn: Math.max(0, num(o.warn, 0)), active: o.active === Infinity ? Infinity : Math.max(0, num(o.active, 0.25)), dmg: num(o.dmg, 15), label: o.label || kind,
      color: o.color || (o.lethal || o.unblockable ? COL.gold : accentHex()), lethal: !!o.lethal, unblockable: !!o.unblockable, tick: num(o.tick, 0),
      live: false, fired: false, done: false, cancelled: false, fade: 1, hitAt: -1e9, group: new T3.Group(), meshes: [], onFire: o.onFire, onEnd: o.onEnd,
      liveStyle: o.liveStyle || (o.active === Infinity || num(o.active, 0.25) >= 2.5 ? 'soft' : 'flash'),
      danger: o.danger !== false,        // false = never counts as danger (safe discs, soaks)
      rebukable: !!o.rebukable, projectile: !!o.projectile,
    };
    Object.assign(h, impl);
    h.group.renderOrder = 6;
    fxLayer().add(h.group);
    h.mode = o.mode != null ? o.mode : (h.lethal || h.unblockable ? 1 : 0);
    try { h.build && h.build(); } catch (e) { logE('hz.build.' + kind, e); }
    for (const m of h.meshes) if (m.material && m.material.uniforms) { const cur = m.material.uniforms.uMode.value; if (m.userData.keepMode || ((cur === 2 || cur === 3) && h.mode <= 1)) continue; m.material.uniforms.uMode.value = h.mode; }
    HZ.active.push(h);
    const prom = new Promise((res) => { h._res = res; });
    const handle = {
      id: h.id, kind, hazard: h, done: prom,
      cancel: () => cancelHazard(h),
      get fireAt() { return (G.t || 0) + Math.max(0, h.warn - h.t) / (HZ.speed || 1); },
      get endAt() { return (G.t || 0) + Math.max(0, h.warn + h.active - h.t) / (HZ.speed || 1); },
      then(res, rej) {   // awaitable: rejects with Abort if the phase changed before the hazard ended
        const b = C.boss, gen = b ? b.gen : -1;
        return prom.then((v) => { if (b && (gen !== b.gen || !b.alive)) throw new Abort(); return v; }).then(res, rej);
      },
    };
    h.handle = handle;
    if (h.warn > 0.2 && h.danger && !h.projectile) { emit('telegraph', { lethal: h.lethal || h.unblockable, kind, warn: h.warn, id: h.id }); }
    return handle;
  }
  function cancelHazard(h) { if (h.done || h.cancelled) return; h.cancelled = true; h.done = true; h.live = false; h.fade = Math.min(h.fade, 0.999); finish(h, 'cancelled'); }
  function finish(h, how) {
    if (h._finished) return; h._finished = true;
    try { h.onEnd && h.onEnd(h.handle, how); } catch (e) { logE('hz.onEnd', e); }
    try { h._res(how); } catch (e) { }
  }
  function disposeHazard(h) {
    try { h.dispose && h.dispose(); } catch (e) { }
    removeObj(h.group);
    const i = HZ.active.indexOf(h); if (i >= 0) HZ.active.splice(i, 1);
    if (!h._finished) finish(h, 'cancelled');
  }
  const inside = (h, px, pz, pad) => { try { return !!h.test(px, pz, h.t, pad); } catch (e) { logE('hz.test.' + h.kind, e); return false; } };

  function updateHazards(dtH, dtReal) {
    const pl = P(); const px = PX(), pz = PZ();
    const cap = bloomCap();
    for (let i = HZ.active.length - 1; i >= 0; i--) {
      const h = HZ.active[i];
      if (h.done) {
        h.fade -= dtReal / 0.35;
        for (const m of h.meshes) if (m.material.uniforms) m.material.uniforms.uAlpha.value = Math.max(0, h.fade);
        try { h.fadeStep && h.fadeStep(dtReal); } catch (e) { }
        if (h.fade <= 0) disposeHazard(h);
        continue;
      }
      h.t += dtH;
      const wasLive = h.live;
      h.live = h.t >= h.warn && h.t < h.warn + h.active;
      if (!wasLive && h.live && !h.fired) {
        h.fired = true;
        try { h.fire && h.fire(); } catch (e) { logE('hz.fire.' + h.kind, e); }
        try { h.onFire && h.onFire(h.handle); } catch (e) { logE('hz.onFire', e); }
        for (const m of h.meshes) if (m.material.uniforms) { m.material.uniforms.uFlash.value = 0.5; }
      }
      try { h.update && h.update(dtH, dtReal); } catch (e) { logE('hz.update.' + h.kind, e); }
      // damage
      if (h.live && h.danger && pl && pl.alive && PLAY(G.state)) {
        if (inside(h, px, pz, AREA_M)) {
          const ok = h.tick > 0 ? (h.t - h.hitAt >= h.tick) : (h.hitAt < -1e8);
          if (ok) { h.hitAt = h.t; applyHit(h); }
        }
      }
      if (h.live && h.danger && pl && pl.alive && PLAY(G.state) && h.safeDisc) { /* handled in h.update */ }
      // visuals
      const p = h.warn > 0 ? clamp(h.t / h.warn, 0, 1) : 1;
      for (const m of h.meshes) {
        const U = m.material.uniforms; if (!U) continue;
        U.uTime.value += dtReal; U.uP.value = m.userData.noFill ? 0 : p; U.uLive.value = h.live ? 1 : 0; U.uCap.value = cap; U.uSoft.value = h.liveStyle === 'soft' ? 1 : 0;
        U.uFlash.value = Math.max(0, U.uFlash.value - dtReal * 3);
      }
      if (h.t >= h.warn + h.active && !h.done) { h.done = true; h.live = false; finish(h, 'done'); }
    }
  }
  function applyHit(h) {
    const pl = G.player; if (!pl || !pl.damage) return;
    const res = pl.damage(h.dmg, h.label, { unblockable: h.unblockable, hazard: h, dot: h.tick > 0 });
    try { h.onHit && h.onHit(h.handle, res); } catch (e) { logE('hz.onHit', e); }
    return res;
  }

  // ---------- circle
  HZ.circle = (o = {}) => makeHazard('circle', o, {
    x: num(o.x, 0), z: num(o.z, 0), r: Math.max(0.1, num(o.r, 2)), follow: o.follow, lockAt: num(o.lockAt, 0.35),
    build() { const m = teleMesh({ shape: 'disc', x: this.x, z: this.z, r: this.r, color: this.color }); this.meshes.push(m); this.group.add(m); },
    update() {
      if (this.follow === 'player' && this.t < this.warn - this.lockAt) { this.x = PX(); this.z = PZ(); this.meshes[0].position.set(this.x, TELE_Y, this.z); }
      else if (this.follow === 'boss' && C.boss && this.t < this.warn - this.lockAt) { this.x = C.boss.pos.x; this.z = C.boss.pos.z; this.meshes[0].position.set(this.x, TELE_Y, this.z); }
    },
    test(px, pz, lt, pad) { const dx = px - this.x, dz = pz - this.z; return dx * dx + dz * dz <= (this.r + pad) * (this.r + pad); },
    fire() { fx('shockwave', new T3.Vector3(this.x, 0.1, this.z), { color: this.color, radius: this.r * 1.3, life: 0.45, intensity: 1.4 }); if (this.o.burst !== false) fx('burst', new T3.Vector3(this.x, 0.3, this.z), { color: this.color, count: Math.min(40, 8 + this.r * 6), speed: 5 + this.r, size: 0.5, life: 0.6, flareSize: 1.2 }); },
  });
  // ---------- ring (annulus) with optional safe gaps [{theta, width}]
  HZ.ring = (o = {}) => makeHazard('ring', o, {
    x: num(o.x, 0), z: num(o.z, 0), r0: Math.max(0, num(o.r0, 3)), r1: Math.max(0.1, num(o.r1, 6)), gaps: (o.gaps || []).map(g => ({ theta: num(g.theta, 0), width: Math.max(0.05, num(g.width, 0.6)) })),
    build() {
      if (!this.gaps.length) { const m = teleMesh({ shape: 'ring', x: this.x, z: this.z, r0: this.r0, r1: this.r1, color: this.color }); this.meshes.push(m); this.group.add(m); return; }
      for (const s of complementArcs(this.gaps)) { const m = teleMesh({ shape: 'sector', x: this.x, z: this.z, r0: this.r0, r1: this.r1, theta: s.center, width: s.width, color: this.color }); this.meshes.push(m); this.group.add(m); }
      for (const g of this.gaps) { const m = teleMesh({ shape: 'sector', x: this.x, z: this.z, r0: this.r0, r1: this.r1, theta: g.theta, width: g.width, color: COL.safe, mode: 2, y: TELE_Y + 0.005 }); m.userData.gap = true; this.meshes.push(m); this.group.add(m); }
    },
    inGap(px, pz) { if (!this.gaps.length) return false; const th = Math.atan2(-(pz - this.z), px - this.x); for (const g of this.gaps) if (Math.abs(angDiff(th, g.theta)) <= g.width / 2) return true; return false; },
    test(px, pz, lt, pad) { const d = Math.hypot(px - this.x, pz - this.z); if (d < this.r0 - pad || d > this.r1 + pad) return false; return !this.inGap(px, pz); },
    fire() { fx('shockwave', new T3.Vector3(this.x, 0.1, this.z), { color: this.color, radius: this.r1 * 1.15, r0: this.r0, life: 0.5, intensity: 1.4 }); },
  });
  // ---------- cone (sector from a point), optional rotation (omega, dur)
  HZ.cone = (o = {}) => makeHazard('cone', Object.assign({}, o, { active: o.omega ? num(o.dur, 6) : o.active }), {
    x: num(o.x, 0), z: num(o.z, 0), r0: Math.max(0, num(o.r0, 0)), r: Math.max(0.1, num(o.r, 8)), theta: num(o.theta, 0), width: Math.max(0.05, num(o.width, 0.8)), omega: num(o.omega, 0), follow: o.follow, lockAt: num(o.lockAt, 0.35),
    thetaAt(lt) { return this.theta + this.omega * Math.max(0, lt - this.warn); },
    build() { const m = teleMesh({ shape: 'sector', x: this.x, z: this.z, r0: this.r0, r1: this.r, theta: this.theta, width: this.width, color: this.color, arrow: !!this.omega }); this.meshes.push(m); this.group.add(m); if (this.omega && !this.tick) this.tick = 0.5; },
    update() {
      const m = this.meshes[0];
      if (this.follow === 'player' && this.t < this.warn - this.lockAt) { this.theta = Math.atan2(-(PZ() - this.z), PX() - this.x); }
      if (this.o.anchor === 'boss' && C.boss) { this.x = C.boss.pos.x; this.z = C.boss.pos.z; m.position.set(this.x, m.position.y, this.z); }
      m.material.uniforms.uC.value = this.thetaAt(this.t);
    },
    test(px, pz, lt, pad) {
      const dx = px - this.x, dz = pz - this.z, d = Math.hypot(dx, dz);
      if (d > this.r + pad || d < this.r0 - pad) return false;
      const th = Math.atan2(-dz, dx), half = this.width / 2 + (d > 0.3 ? pad / d : PI);
      return Math.abs(angDiff(th, this.thetaAt(lt))) <= half;
    },
    fire() { if (this.omega) return; const th = this.theta, mid = polar((this.r0 + this.r) / 2, th, 0.2); mid.x += this.x; mid.z += this.z; fx('burst', mid, { color: this.color, count: 18, speed: 6, size: 0.5, life: 0.5, flareSize: 1.2 }); },
  });
  // ---------- line (rectangle between two points), optional sweep {to:[x,z], dur}
  HZ.line = (o = {}) => {
    const ax = num(o.ax, 0), az = num(o.az, 0), bx = num(o.bx, 0), bz = num(o.bz, 8);
    return makeHazard('line', Object.assign({}, o, { active: o.sweep ? num(o.sweep.dur, 2) : o.active }), {
      ax, az, bx, bz, width: Math.max(0.1, num(o.width, 1.2)), sweep: o.sweep || null,
      geom(lt) {
        let ax2 = this.ax, az2 = this.az, bx2 = this.bx, bz2 = this.bz;
        if (this.sweep) {
          const u = clamp((lt - this.warn) / Math.max(0.01, num(this.sweep.dur, 2)), 0, 1);
          const dx = (this.sweep.to[0] - ax2) * u, dz = (this.sweep.to[1] - az2) * u;   // translate the whole segment by the sweep offset
          ax2 += dx; az2 += dz; bx2 += dx; bz2 += dz;
        }
        return [ax2, az2, bx2, bz2];
      },
      build() {
        const len = Math.hypot(this.bx - this.ax, this.bz - this.az);
        const rot = Math.atan2(-(this.bz - this.az), this.bx - this.ax);
        const m = teleMesh({ shape: 'rect', x: (this.ax + this.bx) / 2, z: (this.az + this.bz) / 2, len, width: this.width, rot, color: this.color, arrow: !!o.arrow });
        this.meshes.push(m); this.group.add(m);
        if (this.sweep) {   // preview of the swept area: a wide faint rect from the start to the end offset
          const ox = this.sweep.to[0] - this.ax, oz = this.sweep.to[1] - this.az, od = Math.hypot(ox, oz);
          if (od > 0.1) {
            const nx = -(this.bz - this.az) / Math.max(1e-3, len), nz = (this.bx - this.ax) / Math.max(1e-3, len);
            const along = ox * nx + oz * nz;    // offset along the segment normal
            const pm = teleMesh({ shape: 'rect', x: (this.ax + this.bx) / 2 + nx * along / 2, z: (this.az + this.bz) / 2 + nz * along / 2, len, width: Math.abs(along) + this.width, rot, color: this.color, arrow: true, y: TELE_Y - 0.01 });
            pm.material.uniforms.uAlpha.value = 0.45; this.meshes.push(pm); this.group.add(pm); this.preview = pm;
          }
        }
      },
      update() {
        if (!this.sweep || !this.live) return;
        const g = this.geom(this.t); const m = this.meshes[0];
        m.position.x = (g[0] + g[2]) / 2; m.position.z = (g[1] + g[3]) / 2;
        if (this.preview) this.preview.material.uniforms.uAlpha.value = Math.max(0, 0.45 - (this.t - this.warn) * 0.6);
      },
      test(px, pz, lt, pad) {
        const g = this.geom(lt);
        const dx = g[2] - g[0], dz = g[3] - g[1], L = Math.hypot(dx, dz) || 1e-3;
        const ux = dx / L, uz = dz / L, rx = px - g[0], rz = pz - g[1];
        const along = rx * ux + rz * uz, across = Math.abs(-rx * uz + rz * ux);
        return along >= -pad && along <= L + pad && across <= this.width / 2 + pad;
      },
      fire() {
        const a = new T3.Vector3(this.ax, 0.4, this.az), b = new T3.Vector3(this.bx, 0.4, this.bz);
        fx('lance', a, b, { color: this.color, width: this.width * 0.7, life: this.sweep ? 0.3 : 0.45, intensity: 1.6, flare: false });
      },
    });
  };
  // ---------- wave: expanding (r1 > r0) or collapsing ring band, with optional radial gap lanes
  HZ.wave = (o = {}) => {
    const r0 = Math.max(0, num(o.r0, 1.5)), r1 = Math.max(0, num(o.r1, 15)), speed = Math.max(0.5, num(o.speed, 6));
    const travel = Math.abs(r1 - r0) / speed;
    return makeHazard('wave', Object.assign({}, o, { active: travel }), {
      x: num(o.x, 0), z: num(o.z, 0), r0, r1, speed, thickness: Math.max(0.3, num(o.thickness, 1.0)), gaps: (o.gaps || []).map(g => ({ theta: num(g.theta, 0), width: Math.max(0.05, num(g.width, 0.6)) })),
      radiusAt(lt) { const u = clamp((lt - this.warn) / Math.max(0.01, travel), 0, 1); return this.r0 + (this.r1 - this.r0) * u; },
      crossTime(r) { return this.warn + Math.abs(r - this.r0) / this.speed; },
      build() {
        const lo = Math.min(this.r0, this.r1), hi = Math.max(this.r0, this.r1);
        const pre = teleMesh({ shape: 'ring', x: this.x, z: this.z, r0: Math.max(0.05, lo), r1: hi, color: this.color, arrow: true });
        pre.material.uniforms.uAlpha.value = 0.3; pre.userData.noFill = true; this.meshes.push(pre); this.group.add(pre); this.pre = pre;
        const band = teleMesh({ shape: 'ring', x: this.x, z: this.z, r0: Math.max(0.05, this.r0 - this.thickness / 2), r1: this.r0 + this.thickness / 2, color: this.color, y: TELE_Y + 0.01 });
        band.material.uniforms.uAlpha.value = 1.0; this.meshes.push(band); this.group.add(band); this.band = band;
        for (const g of this.gaps) { const m = teleMesh({ shape: 'sector', x: this.x, z: this.z, r0: Math.max(0.05, lo), r1: hi, theta: g.theta, width: g.width, color: COL.safe, mode: 2, y: TELE_Y + 0.006 }); this.meshes.push(m); this.group.add(m); }
      },
      update(dtH, dtR) {
        if (!this.live) return;
        const r = this.radiusAt(this.t), U = this.band.material.uniforms;
        U.uA.value = Math.max(0.02, r - this.thickness / 2); U.uB.value = r + this.thickness / 2; U.uAlpha.value = 1; U.uP.value = 1;
        this.pre.material.uniforms.uAlpha.value = Math.max(0.1, 0.3 - (this.t - this.warn) * 0.4);
        if (this.ringFx) { this.ringFx.position.set(this.x, 0.15, this.z); }
      },
      inGap(px, pz) { if (!this.gaps.length) return false; const th = Math.atan2(-(pz - this.z), px - this.x); for (const g of this.gaps) if (Math.abs(angDiff(th, g.theta)) <= g.width / 2) return true; return false; },
      test(px, pz, lt, pad) {
        if (lt < this.warn) return false;
        const r = this.radiusAt(lt), d = Math.hypot(px - this.x, pz - this.z);
        if (Math.abs(d - r) > this.thickness / 2 + pad) return false;
        return !this.inGap(px, pz);
      },
      fire() { fx('shockwave', new T3.Vector3(this.x, 0.1, this.z), { color: this.color, radius: Math.max(this.r0, this.r1), r0: Math.min(this.r0, this.r1), life: travel, intensity: 1.2, thickness: this.thickness }); },
    });
  };
  // ---------- safe: blue disc; when the timer ends, everything outside takes dmg (the danger is the outside)
  HZ.safe = (o = {}) => makeHazard('safe', Object.assign({}, o, { active: num(o.active, 0.3), danger: true, mode: 2 }), {
    x: num(o.x, 0), z: num(o.z, 0), r: Math.max(0.5, num(o.r, 3)), follow: o.follow, safeDisc: true,
    build() { const m = teleMesh({ shape: 'disc', x: this.x, z: this.z, r: this.r, color: this.color === accentHex() || this.o.color == null ? COL.safe : this.color, mode: 2 }); this.meshes.push(m); this.group.add(m); this.color = COL.safe; },
    update() { if (this.follow === 'boss' && C.boss && this.t < this.warn - 0.3) { this.x = C.boss.pos.x; this.z = C.boss.pos.z; this.meshes[0].position.set(this.x, TELE_Y, this.z); } },
    // "inside the hazard" = OUTSIDE the safe disc
    test(px, pz, lt, pad) { const d = Math.hypot(px - this.x, pz - this.z); return d > this.r - pad; },
    fire() { fx('shockwave', new T3.Vector3(this.x, 0.1, this.z), { color: COL.safe, radius: this.r * 1.1, life: 0.5, intensity: 1.2 }); fx('flash', this.o.flashColor || this.o.color || accentHex(), 0.25, 0.3); cam('shake', 0.3, 0.3); },
  });
  HZ.safeAt = (px, pz) => { for (const h of HZ.active) if (h.safeDisc && !h.done && Math.hypot(px - h.x, pz - h.z) <= h.r) return true; return false; };
  // ---------- soak: a green marker the player must touch before warn runs out
  HZ.soak = (o = {}) => makeHazard('soak', Object.assign({}, o, { active: 0.2, danger: false, mode: 3, color: o.color || COL.soak }), {
    x: num(o.x, 0), z: num(o.z, 0), r: Math.max(0.4, num(o.r, 1.0)), failDmg: num(o.failDmg, 20), soaked: false, isSoak: true,
    build() { const m = teleMesh({ shape: 'disc', x: this.x, z: this.z, r: this.r, color: COL.soak, mode: 3 }); this.meshes.push(m); this.group.add(m); this.color = COL.soak; },
    update() {
      if (this.soaked || !PLAY(G.state)) return;
      const pl = P(); if (!pl || !pl.alive || pl.dashing) return;
      if (Math.hypot(PX() - this.x, PZ() - this.z) <= this.r + 0.35) {
        this.soaked = true; this.done = true;
        fx('burst', new T3.Vector3(this.x, 0.4, this.z), { color: COL.soak, count: 30, speed: 6, size: 0.5, life: 0.7 });
        fx('number', new T3.Vector3(this.x, 1.8, this.z), 0, { text: 'SOAKED', color: COL.soak, size: 0.6 });
        emit('soak', { ok: true, id: this.id });
        try { this.o.onSoak && this.o.onSoak(this.handle); } catch (e) { logE('soak.onSoak', e); }
        finish(this, 'done');
      }
    },
    test() { return false; },
    fire() {
      if (this.soaked) return;
      const pl = G.player; if (pl && pl.damage && PLAY(G.state)) pl.damage(this.failDmg, this.label || 'Unsoaked', { unblockable: true });
      fx('burst', new T3.Vector3(this.x, 0.4, this.z), { color: '#ff6a4a', count: 24, speed: 7, size: 0.5, life: 0.6 });
      emit('soak', { ok: false, id: this.id });
      try { this.o.onFail && this.o.onFail(this.handle); } catch (e) { logE('soak.onFail', e); }
    },
  });
  // ---------- orb: projectile (no warn: its motion is the telegraph). Rebuke clears it.
  HZ.orb = (o = {}) => {
    let vx = num(o.vx, NaN), vz = num(o.vz, NaN);
    if (!isFinite(vx) || !isFinite(vz)) { const d = num(o.dir, 0), s = num(o.speed, 5); vx = Math.cos(d) * s; vz = -Math.sin(d) * s; }
    return makeHazard('orb', Object.assign({}, o, { warn: 0, active: num(o.life, 6), rebukable: true, projectile: true, color: o.color || accentHex() }), {
      x: num(o.x, 0), z: num(o.z, 0), vx, vz, r: Math.max(0.15, num(o.r, 0.5)), homing: num(o.homing, 0), bounce: !!o.bounce, isOrb: true, speed0: Math.hypot(vx, vz),
      build() {
        const col = toC(this.color);
        const core = new T3.Mesh(new T3.SphereGeometry(this.r * 0.55, 12, 10), G.mat ? G.mat.emissive(col, 2.2) : new T3.MeshBasicMaterial({ color: col }));
        const glow = G.fx && G.fx.glowSprite ? G.fx.glowSprite(this.color, this.r * 5.5, { intensity: 1.4, opacity: 0.8 }) : null;
        const ringM = teleMesh({ shape: 'disc', x: 0, z: 0, r: this.r, color: this.color, y: TELE_Y });
        ringM.material.uniforms.uP.value = 1; ringM.material.uniforms.uAlpha.value = 0.75;
        this.body = new T3.Group(); this.body.add(core); if (glow) this.body.add(glow); this.body.position.set(this.x, 0.9, this.z);
        this.group.add(this.body); this.group.add(ringM); this.meshes.push(ringM); this.shadow = ringM; this.core = core;
        this.shadow.position.set(this.x, TELE_Y, this.z);
        this.trail = (G.fx && G.fx.trail) ? G.fx.trail(this.body, { color: this.color, width: this.r * 0.9, length: 10, intensity: 1.2 }) : null;
      },
      update(dtH) {
        if (this.homing > 0) {
          const dx = PX() - this.x, dz = PZ() - this.z, d = Math.hypot(dx, dz) || 1e-3;
          const sp = this.speed0 || 5, k = Math.min(1, this.homing * dtH * 2.5);
          this.vx += (dx / d * sp - this.vx) * k; this.vz += (dz / d * sp - this.vz) * k;
        }
        this.x += this.vx * dtH; this.z += this.vz * dtH;
        const R = arenaR() + 0.6, d = Math.hypot(this.x, this.z);
        if (d > R) {
          if (this.bounce) { const nx = this.x / d, nz = this.z / d, dot = this.vx * nx + this.vz * nz; this.vx -= 2 * dot * nx; this.vz -= 2 * dot * nz; this.x = nx * R; this.z = nz * R; }
          else if (d > R + 2) { this.pop(false); return; }
        }
        this.body.position.set(this.x, 0.9 + Math.sin(this.t * 6) * 0.08, this.z); this.shadow.position.set(this.x, TELE_Y, this.z);
        this.core.rotation.y += dtH * 4;
      },
      test(px, pz, lt, pad) {
        const dtp = lt - this.t; const x = this.x + this.vx * dtp, z = this.z + this.vz * dtp;
        const rr = this.r + 0.45 + pad; const dx = px - x, dz = pz - z; return dx * dx + dz * dz <= rr * rr;
      },
      onHit(h, res) { this.pop(true); try { this.o.onHit && this.o.onHit(h, res); } catch (e) { logE('orb.onHit', e); } },
      pop(hit) {
        if (this.done) return;
        fx('burst', new T3.Vector3(this.x, 0.9, this.z), { color: this.color, count: 16, speed: 5, size: 0.4, life: 0.5, flareSize: 1.0 });
        this.done = true; this.live = false;
        try { this.o.onPop && this.o.onPop(this.handle, !!hit); } catch (e) { logE('orb.onPop', e); }
        finish(this, 'done');
      },
      dispose() { if (this.trail) { try { this.trail.remove(); } catch (e) { } this.trail = null; } },
      fadeStep() { if (this.body) this.body.visible = false; },
    });
  };
  // ---------- void: a persistent pit (no warn by default); standing in it = dmg per tick; cancel it yourself
  HZ.void = (o = {}) => makeHazard('void', Object.assign({}, o, { active: Infinity, tick: num(o.tick, 0.6), mode: 4, color: o.color || COL.void, warn: num(o.warn, 0) }), {
    x: num(o.x, 0), z: num(o.z, 0), r: Math.max(0.3, num(o.r, 2)), isVoid: true,
    build() { const m = teleMesh({ shape: 'disc', x: this.x, z: this.z, r: this.r, color: this.color, mode: 4, y: TELE_Y - 0.015, order: 5 }); this.meshes.push(m); this.group.add(m); },
    test(px, pz, lt, pad) { const dx = px - this.x, dz = pz - this.z; return dx * dx + dz * dz <= (this.r - 0.2 + pad) * (this.r - 0.2 + pad); },
    fire() { fx('shockwave', new T3.Vector3(this.x, 0.1, this.z), { color: this.color, radius: this.r * 1.2, life: 0.6 }); },
  });
  // ---------- custom
  HZ.custom = (o = {}) => makeHazard('custom', o, {
    build() {
      let upd = null;
      try { upd = o.draw ? o.draw(this.group, this.handle) : null; } catch (e) { logE('custom.draw', e); }
      this._upd = typeof upd === 'function' ? upd : null;
      this.group.traverse(c => { if (c.userData && c.userData.tele && c.material && c.material.uniforms) this.meshes.push(c); });
    },
    update(dtH, dtR) { if (this._upd) { try { this._upd(this.t, dtH, dtR); } catch (e) { logE('custom.update', e); } } },
    test(px, pz, lt, pad) { return o.test ? !!o.test(px, pz, lt, pad) : false; },
    fire() { },
  });
  // ---------- wipe: raid damage now
  HZ.wipe = (dmg, label, opts) => { const pl = G.player; if (!pl || !pl.damage || !PLAY(G.state)) return null; fx('flash', (opts && opts.color) || accentHex(), 0.3, 0.4); cam('shake', 0.4, 0.4); return pl.damage(dmg, label || 'Raid damage', Object.assign({ unblockable: false }, opts || {})); };

  // ---------- gap helpers
  function complementArcs(gaps) {
    const gs = gaps.map(g => ({ a: wrap(g.theta - g.width / 2), w: g.width })).sort((p, q) => p.a - q.a);
    const out = [];
    for (let i = 0; i < gs.length; i++) {
      const end = gs[i].a + gs[i].w, next = i + 1 < gs.length ? gs[i + 1].a : gs[0].a + TAU;
      const w = next - end; if (w > 0.02) out.push({ center: end + w / 2, width: w });
    }
    if (!gs.length) out.push({ center: 0, width: TAU });
    return out;
  }
  HZ.complementArcs = complementArcs;

  // ---------- prediction / queries
  HZ.dangerAt = (px, pz, tAhead = 0, pad = PRED_PAD) => {
    const pl = P();
    for (const h of HZ.active) {
      if (h.done || !h.danger) continue;
      const lt = h.t + tAhead * (HZ.speed || 1);
      if (h.isOrb) { if (lt > h.warn + h.active) continue; if (h.test(px, pz, lt, pad)) return 1; continue; }
      if (lt < h.warn || lt > h.warn + h.active) continue;
      if (h.test(px, pz, lt, pad)) return 1;
    }
    return 0;
  };
  HZ.damageAt = (px, pz, tAhead = 0, pad = PRED_PAD) => {
    let s = 0;
    for (const h of HZ.active) {
      if (h.done || !h.danger) continue;
      const lt = h.t + tAhead * (HZ.speed || 1);
      if (!h.isOrb && (lt < h.warn || lt > h.warn + h.active)) continue;
      if (h.isOrb && lt > h.warn + h.active) continue;
      if (h.test(px, pz, lt, pad)) s += h.dmg;
    }
    return s;
  };
  HZ.list = () => HZ.active.filter(h => !h.done).map(h => h.handle);
  HZ.clear = (filter) => { for (const h of HZ.active.slice()) { if (h.done) continue; if (h.isContact) continue; if (filter && !filter(h)) continue; cancelHazard(h); } };
  HZ.clearProjectiles = (filter) => { let n = 0; for (const h of HZ.active.slice()) { if (h.done || !h.rebukable) continue; if (filter && !filter(h)) continue; n++; if (h.pop) h.pop(false); else cancelHazard(h); emit('orbPop', { id: h.id }); } return n; };
  HZ.teleMesh = teleMesh; HZ.teleMaterial = teleMaterial; HZ.COL = COL;

  // ============================================================== ADDS
  let aid = 0;
  const ADDS = G.adds = { list: [] };
  const ADD_DEFAULTS = { hp: 150, radius: 0.6, contactDmg: 15, label: 'Add', barY: 1.8 };
  function makeBarSprite(add) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 16;
    const tex = new T3.CanvasTexture(c); tex.colorSpace = T3.SRGBColorSpace;
    const m = new T3.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const s = new T3.Sprite(m); s.scale.set(1.6, 0.2, 1); s.renderOrder = 20; s.position.y = add.barY;
    add._bar = { c, tex, s, last: -1 };
    return s;
  }
  function drawBar(add) {
    const B = add._bar; if (!B) return;
    const f = clamp(add.hp / add.maxHp, 0, 1); if (Math.abs(f - B.last) < 0.01) return; B.last = f;
    const x = B.c.getContext('2d'); x.clearRect(0, 0, 128, 16);
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(0, 4, 128, 8);
    x.fillStyle = add.staggerT > 0 ? '#ffd36b' : add.color || '#ff5f9e'; x.fillRect(2, 6, 124 * f, 4);
    B.tex.needsUpdate = true;
  }
  ADDS.spawn = (o = {}) => {
    const add = Object.assign({}, ADD_DEFAULTS, o, {
      id: ++aid, pos: new T3.Vector3(num(o.x, 0), 0, num(o.z, 0)), vel: new T3.Vector3(), alive: true, t: 0, staggerT: 0, contactAt: -9, group: new T3.Group(), inner: new T3.Group(), data: o.data || {}, hitFlash: 0,
    });
    add.maxHp = add.hp;
    add.group.position.copy(add.pos); add.group.add(add.inner);
    try { if (o.model) o.model(add.inner, add); else { add.inner.add(new T3.Mesh(new T3.OctahedronGeometry(add.radius * 0.8), G.mat ? G.mat.emissive(add.color || '#ff5f9e', 1.4) : new T3.MeshBasicMaterial({ color: add.color || '#ff5f9e' }))); } } catch (e) { logE('add.model', e); }
    add.group.add(makeBarSprite(add)); drawBar(add);
    add.inner.position.y = 4; add.dropT = 0;   // drops in over 0.45 s, harmless meanwhile
    ((G.layers && G.layers.boss) || G.scene).add(add.group);
    ADDS.list.push(add);
    emit('addSpawn', { id: add.id, label: add.label });
    fx('burst', add.pos.clone().setY(0.5), { color: add.color || '#ff5f9e', count: 14, speed: 4, size: 0.4, life: 0.5, flareSize: 1 });
    return add;
  };
  ADDS.damage = (add, base, info = {}) => {
    if (!add || !add.alive) return 0;
    let mul = (G.player && G.player.damageMul ? G.player.damageMul(info) : 1);
    if (add.staggerT > 0) mul *= 3;
    const amt = Math.max(1, Math.round(base * mul));
    add.hp -= amt; add.hitFlash = 1; drawBar(add);
    if (!G.settings || G.settings.numbers !== false) fx('number', add.pos.clone().setY(1.4), amt, { color: add.staggerT > 0 ? '#fff1c2' : '#ffd36b', size: add.staggerT > 0 ? 0.8 : 0.6, life: 0.6 });
    const st = G.player && G.player.stats; if (st) st.damageDealt = (st.damageDealt || 0) + amt;
    if (add.hp <= 0) ADDS.kill(add, info.source || 'damage');
    return amt;
  };
  ADDS.kill = (add, reason) => {
    if (!add || !add.alive) return;
    add.alive = false;
    try { add.onDeath && add.onDeath(add, reason); } catch (e) { logE('add.onDeath', e); }
    fx('burst', add.pos.clone().setY(0.6), { color: add.color || '#ff5f9e', count: 26, speed: 6, size: 0.5, life: 0.7 });
    fx('shockwave', add.pos.clone().setY(0.1), { color: add.color || '#ff5f9e', radius: 2.2, life: 0.4 });
    removeObj(add.group);
    const i = ADDS.list.indexOf(add); if (i >= 0) ADDS.list.splice(i, 1);
    emit('addDied', { id: add.id, reason, label: add.label });
  };
  ADDS.killAll = (reason) => { for (const a of ADDS.list.slice()) ADDS.kill(a, reason || 'clear'); };
  ADDS.clear = () => { for (const a of ADDS.list.slice()) { a.alive = false; removeObj(a.group); } ADDS.list.length = 0; };
  ADDS.stagger = (add, dur = 3) => { if (!add || !add.alive) return; add.staggerT = Math.max(add.staggerT, dur); drawBar(add); fx('number', add.pos.clone().setY(1.6), 0, { text: 'STAGGERED', color: '#ffd36b', size: 0.5 }); };
  ADDS.nearest = (x, z, maxD = 1e9) => { let best = null, bd = maxD; for (const a of ADDS.list) { if (!a.alive || a.dropT < 0.45) continue; const d = Math.hypot(a.pos.x - x, a.pos.z - z) - a.radius; if (d < bd) { bd = d; best = a; } } return best; };
  function updateAdds(dtH, dtR) {
    const pl = P(); const px = PX(), pz = PZ();
    for (const a of ADDS.list.slice()) {
      if (!a.alive) continue;
      a.t += dtH; a.staggerT = Math.max(0, a.staggerT - dtH); a.hitFlash = Math.max(0, a.hitFlash - dtR * 5);
      if (a.dropT < 0.45) { a.dropT += dtH; a.inner.position.y = 4 * (1 - clamp(a.dropT / 0.45, 0, 1)) ** 2; if (a.dropT >= 0.45) a.inner.position.y = 0; }
      else if (a.staggerT <= 0) { try { a.update && a.update(a, dtH); } catch (e) { logE('add.update', e); } }
      // keep inside the arena
      const R = arenaR() - a.radius; const d = Math.hypot(a.pos.x, a.pos.z); if (d > R) { a.pos.x *= R / d; a.pos.z *= R / d; }
      a.group.position.copy(a.pos);
      if (a._bar) { a._bar.s.material.opacity = a.staggerT > 0 ? 1 : 0.85; if (a.staggerT > 0 && a._bar.last >= 0) { a._bar.last = -1; drawBar(a); } }
      // contact
      if (pl && pl.alive && PLAY(G.state) && a.dropT >= 0.45 && a.contactDmg > 0) {
        const dx = px - a.pos.x, dz = pz - a.pos.z, dd = Math.hypot(dx, dz), minD = a.radius + 0.45;
        if (dd < minD) {
          if (G.player.knockback && !pl.dashing) G.player.knockback(Math.atan2(-dz, dx), minD - dd + 0.05, true);
          if (a.t - a.contactAt > 1.0 && !pl.dashing) { a.contactAt = a.t; G.player.damage(a.contactDmg, a.label, { add: a }); try { a.onContact && a.onContact(a); } catch (e) { } }
        }
      }
    }
  }

  // ============================================================ COMBAT
  const C = G.combat = {
    Abort, isAbort, teleMesh, teleMaterial, removeObj, COL,
    boss: null, def: null, bossIndex: -1, practice: false, fightTime: 0, clock: 0,
    transitioning: false, checkpointUsed: false, results: null, fightCount: 0, startPhase: 0, deathPhase: 0, deathT: 0,
    TELE_Y,
  };
  const flowTimers = [];
  function flowWait(sec) { return new Promise(res => flowTimers.push({ at: C.clock + sec, res })); }
  C.wait = flowWait;
  function raceTimeout(p, sec) { return Promise.race([Promise.resolve(p).catch(e => { if (!isAbort(e)) logE('cinematic', e); }), flowWait(sec)]); }

  // ---------------------------------------------------- boss runtime
  function makeRuntime(def, index) {
    const b = {
      def, index, name: def.name, hp: def.maxHp || 10000, maxHp: def.maxHp || 10000, phase: 0, facing: -PI / 2, turnRate: num(def.turnRate, 2.4),
      trackPlayer: true, facingTarget: null, autoFace: true, model: null, root: new T3.Group(), pos: new T3.Vector3(0, 0, 0),
      staggerT: 0, exposedT: 0, casting: null, alive: true, invulnerable: false, clock: 0, gen: 0, data: {}, recoil: 0, phaseT: 0, hitFlash: 0,
      speed: num(def.speed, 3), hitRadius: num(def.hitRadius, 1.5), bodyRadius: num(def.bodyRadius, num(def.hitRadius, 1.5) * 0.85), _move: null,
      get staggered() { return this.staggerT > 0; }, get exposed() { return this.exposedT > 0; },
    };
    b.root.position.copy(b.pos);
    const timers = []; b._timers = timers;
    b.wait = (sec) => { const gen = b.gen; return new Promise((res, rej) => { if (gen !== b.gen || !b.alive) { rej(new Abort()); return; } timers.push({ at: b.clock + Math.max(0, sec || 0), res, rej, gen }); }); };
    b.until = async (pred, step = 0.1) => { while (!pred()) await b.wait(step); };
    b.loop = (fn) => {
      const gen = b.gen;
      return (async () => {
        while (gen === b.gen && b.alive) {
          const c0 = b.clock;
          try { await fn(b); } catch (e) { if (isAbort(e) || gen !== b.gen) return; logE('boss.loop', e); }
          if (gen !== b.gen) return;
          if (b.clock - c0 < 0.05) { try { await b.wait(0.25); } catch (e) { return; } }
        }
      })();
    };
    b.cast = (o = {}) => {
      if (b.casting) endCast(false, true);
      const gen = b.gen;
      return new Promise((res, rej) => {
        if (gen !== b.gen || !b.alive) { rej(new Abort()); return; }
        const c = { name: o.name || 'Cast', dur: Math.max(0.1, o.dur || 2), t0: b.clock, progress: 0, interruptible: !!o.interruptible, res, rej, gen, o, handles: [] };
        if (o.telegraph) { try { const hs = o.telegraph(b); c.handles = hs ? (Array.isArray(hs) ? hs : [hs]) : []; } catch (e) { logE('cast.telegraph', e); } }
        b.casting = c;
        castRing(b, c);
        emit('castStart', { name: c.name, dur: c.dur, interruptible: c.interruptible });
      });
    };
    b.pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];
    b.rand = rand;
    b.randRange = (a, c) => a + (c - a) * rand();
    b.randInt = (a, c) => Math.floor(a + (c - a + 1) * rand());
    b.playerPos = () => { const p = P(); return p && p.pos ? p.pos.clone() : new T3.Vector3(0, 0, 8); };
    b.playerTheta = () => Math.atan2(-(PZ() - b.pos.z), PX() - b.pos.x);
    b.playerDist = () => Math.hypot(PX() - b.pos.x, PZ() - b.pos.z);
    b.dirToPlayer = b.playerTheta;
    b.playerAhead = (sec) => { const pl = G.player; if (pl && pl.predictPos) return pl.predictPos(sec); return b.playerPos(); };
    b.say = (text, dur = 2.5) => emit('say', { text, dur });
    b.damage = (amount, info = {}) => C.dealDamage(amount, info);
    b.stagger = (dur = 2.5) => { b.staggerT = Math.max(b.staggerT, dur); b.recoil = 1; };
    b.expose = (dur = 6) => { b.exposedT = Math.max(b.exposedT, dur); emit('exposed', { dur }); };
    b.hitPoint = (theta) => { const th = theta != null ? theta : b.playerTheta(); const v = polar(b.hitRadius, th, num(def.hitHeight, 2.0)); v.x += b.pos.x; v.z += b.pos.z; return v; };
    b.faceTo = (theta) => { b.facingTarget = theta; };
    b.turnToward = (theta, dt, rate) => { const d = angDiff(theta, b.facing); const st = (rate || b.turnRate) * dt; b.facing = wrap(b.facing + clamp(d, -st, st)); };
    b.setFacing = (theta) => { b.facing = wrap(theta); };
    b.moveTo = (x, z, speed) => {
      const gen = b.gen;
      if (b._move) { b._move.res('replaced'); b._move = null; }
      return new Promise((res, rej) => { b._move = { x, z, speed: num(speed, b.speed), res, rej, gen }; });
    };
    b.stopMove = () => { if (b._move) { b._move.res('stopped'); b._move = null; } };
    b.teleport = (x, z) => { b.stopMove(); b.pos.set(x, 0, z); b.root.position.copy(b.pos); };
    b.hz = HZ; b.adds = ADDS;
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
  function castRing(b, c) {
    const col = c.interruptible ? COL.purple : accentHex();
    const m = teleMesh({ shape: 'ring', x: b.pos.x, z: b.pos.z, r0: b.hitRadius + 0.9, r1: b.hitRadius + 1.5, color: col, mode: 5, y: TELE_Y + 0.02, order: 8, arrow: c.interruptible });
    m.material.uniforms.uArrow.value = c.interruptible ? 1 : 0;
    fxLayer().add(m); c.ringMesh = m;
  }
  C.interrupt = () => {
    const b = C.boss;
    if (!b || !b.casting || !b.casting.interruptible || !b.alive) return false;
    const c = b.casting;
    const pos = b.hitPoint();
    endCast(true);
    b.stagger(2.5); b.expose(num(G.player && G.player.mods && G.player.mods.exposeDur, 6));
    emit('interrupted', { name: c.name });
    fx('shockwave', b.pos.clone().setY(0.2), { color: '#e9c0ff', radius: 7, life: 0.6 });
    fx('burst', pos, { color: '#f3dcff', count: 40, speed: 9, size: 0.8, life: 0.9 });
    fx('flash', '#e9c0ff', 0.3, 0.35);
    fx('number', pos.clone().setY(3.4), 0, { text: 'INTERRUPTED', color: '#f3dcff', crit: true, size: 0.75 });
    cam('shake', 0.6, 0.4); cam('hitStop', 0.09);
    const st = G.player && G.player.stats; if (st) st.interrupts = (st.interrupts || 0) + 1;
    return true;
  };

  // ------------------------------------------------------- damage
  C.dealDamage = (base, info = {}) => {
    const b = C.boss;
    if (info.target && info.target !== b) return ADDS.damage(info.target, base, info);
    if (!b || !b.alive || b.invulnerable || C.transitioning || !(PLAY(G.state))) return 0;
    let mul = (G.player && G.player.damageMul ? G.player.damageMul(info) : 1);
    if (b.exposedT > 0) mul *= 1.3;
    if (b.staggerT > 0) mul *= 1.1;
    if (info.mult) mul *= info.mult;
    let amt = Math.max(1, Math.round(base * mul));
    const pos = info.pos || b.hitPoint();
    if (b.def.infinite) { C.practiceDamage = (C.practiceDamage || 0) + amt; C.dpsLog.push([C.clock, amt]); }
    else {
      const next = b.def.phases[b.phase + 1];
      const floor = next ? b.maxHp * next.hpStart : 0;
      const before = b.hp;
      b.hp = Math.max(floor, b.hp - amt);
      amt = Math.round(before - b.hp) || amt;
      if (b.hp <= floor + 0.01) { if (next) queueTransition(b.phase, b.phase + 1); else bossDeath(); }
    }
    const src = info.source || 'rend';
    const st = G.player && G.player.stats; if (st) { st.damageDealt = (st.damageDealt || 0) + amt; if (st.damageBySkill) st.damageBySkill[src] = (st.damageBySkill[src] || 0) + amt; }
    const crit = !!info.crit;
    if (!G.settings || G.settings.numbers !== false) fx('number', pos, amt, src === 'rend' ? { crit, color: crit ? '#ffe9a8' : '#e9b850', size: crit ? 0.95 : 0.7, life: 0.7, rise: 1.1 } : { crit, color: crit ? '#fff1c2' : '#ffd36b', size: info.big ? 1.3 : 0.9 });
    b.hitFlash = 1;
    emit('bossDamaged', { amount: amt, source: src, crit, pos });
    try { G.player && G.player.onDealtDamage && G.player.onDealtDamage(amt, info); } catch (e) { }
    return amt;
  };

  // ------------------------------------------------- phase handling
  function abortScripts(b) {
    b.gen++;
    const ts = b._timers.splice(0);
    for (const t of ts) t.rej(new Abort());
    if (b.casting) endCast(false, true);
    if (b._move) { const m = b._move; b._move = null; (m.rej || m.res)(m.rej ? new Abort() : 'aborted'); }
  }
  function runPhase(b, i) {
    abortScripts(b);
    b.phase = i; b.phaseT = 0;
    const ph = b.def.phases[i]; if (!ph) return;
    emit('phaseStart', { index: i, name: ph.name });
    try { ph.enter && ph.enter(b); } catch (e) { logE('phase.enter', e); }
    const gen = b.gen;
    if (ph.script) { (async () => { try { await ph.script(b); } catch (e) { if (!isAbort(e) && gen === b.gen) logE('phase.script.' + ph.name, e); } })(); }
  }
  let pendingTransition = null;
  function queueTransition(from, to) { const b = C.boss; if (!b || C.transitioning || pendingTransition) return; b.invulnerable = true; pendingTransition = { from, to }; }
  const heroDown = () => { const p = P(); return !!(p && !p.alive) || C.deathT > 0 || G.state === 'dead'; };
  async function doTransition(from, to) {
    const b = C.boss; if (!b) return;
    if (heroDown()) { pendingTransition = null; return; }
    const fc = C.fightCount;
    C.transitioning = true; b.invulnerable = true;
    abortScripts(b);
    HZ.clear(); ADDS.killAll('transition');
    setState('cinematic');
    emit('phaseTransition', { from, to, name: (b.def.phases[to] || {}).name });
    const ph = b.def.phases[to] || {};
    if (ph.sky !== false) { const sk = skyFor(b.def, to); world('setSky', sk[0], sk[1], ph.skyDur != null ? ph.skyDur : 2.5); }
    try { G.audio && G.audio.setIntensity && G.audio.setIntensity(musicIntensity(b.def, to)); } catch (e) { }
    try { if (G.player && G.player.onPhaseTransition) G.player.onPhaseTransition(from, to); } catch (e) { logE('player.onPhaseTransition', e); }
    let p;
    try { p = b.def.onTransition ? b.def.onTransition(b, from, to) : defaultTransition(b, from, to); } catch (e) { logE('onTransition', e); }
    await raceTimeout(p, 9);
    if (fc !== C.fightCount || C.boss !== b) return;
    await flowWait(0.15);
    if (fc !== C.fightCount || C.boss !== b) return;
    C.transitioning = false;
    if (heroDown()) { if (G.state !== 'dead' && !(C.deathT > 0)) { C.deathPhase = from; C.deathT = 0.01; } return; }
    b.invulnerable = false;
    setState(C.practice ? 'practice' : 'fight');
    runPhase(b, to);
  }
  function skyFor(def, i) {
    const ph = (def.phases && def.phases[i]) || {}, sk = ph.sky;
    if (Array.isArray(sk)) return [sk[0] || def.sky || 'night', sk[1] != null ? sk[1] : i];
    if (sk && typeof sk === 'object') return [sk.preset || def.sky || 'night', sk.level != null ? sk.level : i];
    return [(typeof sk === 'string' && sk) || def.sky || 'night', Math.min(3, i)];
  }
  C.skyFor = skyFor;
  function musicIntensity(def, i) {
    const phs = (def && def.phases) || [], ph = phs[i] || {};
    if (typeof ph.intensity === 'number') return clamp(Math.round(ph.intensity), 0, 3);
    if (def && Array.isArray(def.intensity) && typeof def.intensity[i] === 'number') return clamp(Math.round(def.intensity[i]), 0, 3);
    const n = phs.length; if (n <= 1) return 0;
    return clamp(Math.round(i * 3 / (n - 1)), 0, 3);
  }
  C.musicIntensity = musicIntensity;
  function defaultTransition(b) {
    const acc = b.def.accent || accentHex();
    fx('flash', acc, 0.35, 0.6);
    fx('shockwave', b.pos.clone().setY(0.3), { color: acc, radius: 16, life: 1.2 });
    cam('shake', 0.5, 0.8);
    const c = G.camera ? G.camera.position.toArray() : [0, 20, 16];
    return cam('cinematic', [
      { t: 0, pos: c, look: [0, 0.5, 0] },
      { t: 1.2, pos: [b.pos.x + 3.5, 5.0, b.pos.z + 12.5], look: [b.pos.x, 3.2, b.pos.z] },
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
      { t: 1.6, pos: [b.pos.x, 4.5, b.pos.z + 13], look: [b.pos.x, 3, b.pos.z] },
      { t: 4.4, pos: [b.pos.x + 6, 7, b.pos.z + 15], look: [b.pos.x, 2.5, b.pos.z] },
      { t: 6.0, pos: c, look: [0, 0.5, 0] },
    ], { name: 'death' });
    for (let i = 0; i < 9; i++) {
      const p = new T3.Vector3(b.pos.x + (Math.random() - 0.5) * 2.5, 1 + Math.random() * 4, b.pos.z + (Math.random() - 0.5) * 2.5);
      fx('burst', p, { color: i % 2 ? acc : '#fff1c2', count: 30, speed: 7, size: 0.8, life: 1.0 });
      cam('shake', 0.4, 0.3); sfx('crack', { vol: 0.8 });
      await flowWait(0.32);
    }
    fx('flash', '#fff6dd', 0.9, 1.2);
    fx('shockwave', b.pos.clone().setY(0.4), { color: '#fff1c2', radius: 22, life: 1.6 });
    cam('shake', 1.2, 1.0);
    sfx('thunder', {});
    if (b.root) b.root.visible = false;
    await flowWait(2.2);
    return pc;
  }
  function computeResults() {
    const st = (G.player && G.player.stats) || {};
    const def = C.def || {};
    const par = def.parTime || [210, 240, 270, 300, 360][C.bossIndex] || 240;
    const t = C.fightTime, dmg = st.damageTaken || 0;
    let grade = 'C';
    if (t <= par && dmg <= 120 && !C.checkpointUsed) grade = 'S';
    else if (t <= par * 1.15 && dmg <= 300) grade = 'A';
    else if (t <= par * 1.4 || dmg <= 500) grade = 'B';
    if (grade === 'S' && C.checkpointUsed) grade = 'A';
    return {
      bossIndex: C.bossIndex, name: def.name, title: def.title, court: def.court, time: t, grade, par,
      damageTaken: Math.round(dmg), hitsTaken: st.hitsTaken || 0, interrupts: st.interrupts || 0, ripostes: st.ripostes || 0, absorbed: Math.round(st.absorbed || 0),
      damageBySkill: { ...(st.damageBySkill || {}) }, checkpoint: C.checkpointUsed, deaths: st.deaths || 0,
    };
  }

  // ------------------------------------------------------ fight flow
  C.startFight = (bossIndex, opts = {}) => {
    const practice = !!opts.practice || bossIndex === 'practice';
    const def = practice ? G.bosses.practice : G.bosses[bossIndex];
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
    const accent = def.accent || '#ff7a2a';
    if (G.colors) G.colors.accent = accent;
    world('reset'); world('setAccent', accent);
    if (def.arena) world('setArena', def.arena);
    const fromPhase = clamp(opts.fromPhase | 0, 0, def.phases.length - 1);
    { const sk = skyFor(def, fromPhase); world('setSky', sk[0], sk[1], 0); }
    const b = makeRuntime(def, C.bossIndex);
    C.boss = b;
    ((G.layers && G.layers.boss) || G.scene).add(b.root);
    try { def.build && def.build(b); } catch (e) { logE('boss.build', e); }
    if (b.model && b.model.parent !== b.root) b.root.add(b.model);
    if (fromPhase > 0) b.hp = b.maxHp * def.phases[fromPhase].hpStart;
    b.phase = fromPhase; C.startPhase = fromPhase;
    try { G.player && G.player.reset && G.player.reset({ keepStats, practice }); } catch (e) { logE('player.reset', e); }
    try { G.audio && G.audio.music && G.audio.music(def.music != null ? def.music : (practice ? 'practice' : C.bossIndex)); G.audio && G.audio.setIntensity && G.audio.setIntensity(musicIntensity(def, fromPhase)); } catch (e) { }
    const quick = opts.skipIntro === false ? false : !!(opts.skipIntro || (G.params && (G.params.bot || G.params.skipintro)));
    C.introT = quick ? 0.4 : (practice ? 1.8 : 3.4);
    setState('intro');
    emit('fightStart', { bossIndex: C.bossIndex, practice, fromPhase, name: def.name, title: def.title, court: def.court, accent, intro: def.intro, quick });
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
    return C.startFight(idx, { practice: C.practice, fromPhase: ph, keepStats: true, checkpoint: true, keepTime: true, skipIntro: true });
  };
  C.restart = (opts = {}) => C.startFight(C.practice ? 'practice' : C.bossIndex, Object.assign({ practice: C.practice, fromPhase: 0 }, opts));
  C.quit = () => { const was = !!C.boss; C.reset(); setState('menu'); if (was) emit('fightEnd', { result: 'quit' }); };
  C.reset = (opts = {}) => {
    const b = C.boss;
    pendingTransition = null; C.transitioning = false; C.deathT = 0;
    flowTimers.length = 0;
    if (b) { abortScripts(b); b.alive = false; try { b.def.teardown && b.def.teardown(b); } catch (e) { logE('boss.teardown', e); } }
    for (const h of HZ.active.slice()) disposeHazard(h);
    HZ.active.length = 0; HZ.speed = 1;
    ADDS.clear();
    const layer = G.layers && G.layers.boss;
    if (layer) for (const c of layer.children.slice()) removeObj(c); else if (b) removeObj(b.root);
    { const fl = fxLayer(); for (const c of fl.children.slice()) if (c.userData && c.userData.tele) removeObj(c); }
    C.boss = null;
    try { G.fx && G.fx.clear && G.fx.clear(); } catch (e) { logE('fx.clear', e); }
    try { G.cam && G.cam.clearTime && G.cam.clearTime(); } catch (e) { }
    try { G.post && G.post.reset && G.post.reset(); } catch (e) { logE('post.reset', e); }
    try { G.cam && G.cam.endCinematic && G.cam.inCinematic && G.cam.endCinematic(); } catch (e) { }
  };

  // ---------------------------------------------- boss per-frame
  const fadeBox = new T3.Box3(), v1 = new T3.Vector3(), v2 = new T3.Vector3();
  let fadeK = 1, fadeCheck = 0, fadeOn = false;
  function bossFade(b, dt) {
    if (!b.model || !G.camera) return;
    fadeCheck -= dt;
    if (fadeCheck <= 0) {
      fadeCheck = 0.1;
      const pl = P(); let want = false;
      const scripted = (G.cam && G.cam.inCinematic) || C.transitioning || !b.alive || b.dying || G.state === 'cinematic' || G.state === 'victory';
      if (pl && pl.pos && b.root.visible && !scripted) {
        fadeBox.setFromObject(b.model);
        if (!fadeBox.isEmpty()) {
          v1.copy(pl.pos).setY(pl.pos.y + 0.5).project(G.camera);
          const camD = G.camera.position.distanceTo(pl.pos), bossD = G.camera.position.distanceTo(v2.copy(b.pos).setY(1.5));
          if (camD > bossD - 1.0) {
            const c = [fadeBox.min, fadeBox.max]; let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
            for (let i = 0; i < 8; i++) { v2.set(c[i & 1].x, c[(i >> 1) & 1].y, c[(i >> 2) & 1].z).project(G.camera); x0 = Math.min(x0, v2.x); x1 = Math.max(x1, v2.x); y0 = Math.min(y0, v2.y); y1 = Math.max(y1, v2.y); }
            const m = 0.04; want = v1.x > x0 - m && v1.x < x1 + m && v1.y > y0 - m && v1.y < y1 + m;
          }
        }
      }
      b._fadeWant = want;
    }
    const target = b._fadeWant ? (b.def.fadeOpacity || 0.35) : 1;
    fadeK += (target - fadeK) * Math.min(1, dt * 8);
    if (Math.abs(fadeK - 1) < 0.01 && !b._fadeWant) { if (fadeOn) { fadeOn = false; applyFade(b, 1, true); } fadeK = 1; return; }
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
    if (b._timers.length) {
      const due = [];
      for (let i = b._timers.length - 1; i >= 0; i--) { const t = b._timers[i]; if (t.at <= b.clock) { due.push(t); b._timers.splice(i, 1); } }
      due.sort((a, c) => a.at - c.at).forEach(t => t.gen === b.gen ? t.res() : t.rej(new Abort()));
    }
    // movement
    if (b._move && b.alive && b.staggerT <= 0) {
      const m = b._move, dx = m.x - b.pos.x, dz = m.z - b.pos.z, d = Math.hypot(dx, dz), step = m.speed * bdt;
      if (d <= step || d < 0.02) { b.pos.set(m.x, 0, m.z); b._move = null; m.res('done'); }
      else { b.pos.x += dx / d * step; b.pos.z += dz / d * step; }
      b.root.position.copy(b.pos);
    }
    // facing
    if (b.alive && !b.dying && b.staggerT <= 0) {
      let target = null;
      if (b.facingTarget != null) target = b.facingTarget; else if (b.trackPlayer) target = b.playerTheta();
      if (target != null && b.turnRate > 0) b.turnToward(target, bdt);
    }
    b.staggerT = Math.max(0, b.staggerT - bdt);
    b.exposedT = Math.max(0, b.exposedT - bdt);
    b.recoil = Math.max(0, b.recoil - dt * 2.2);
    b.hitFlash = Math.max(0, (b.hitFlash || 0) - dt * 5);
    if (b.casting) {
      const c = b.casting; c.progress = clamp((b.clock - c.t0) / c.dur, 0, 1);
      if (c.ringMesh) { const u = c.ringMesh.material.uniforms; u.uP.value = c.progress; u.uTime.value += dt; c.ringMesh.position.set(b.pos.x, c.ringMesh.position.y, b.pos.z); }
      if (c.progress >= 1 && PLAY(G.state)) endCast(false);
    }
    if (PLAY(G.state) && b.alive) { const ph = b.def.phases[b.phase]; try { ph && ph.update && ph.update(b, bdt); } catch (e) { logE('phase.update', e); } }
    try { b.def.animate && b.def.animate(b, dt); } catch (e) { logE('boss.animate', e); }
    if (b.autoFace) b.root.rotation.y = b.facing + (b.def.facingOffset || 0);
    b.root.rotation.z = b.recoil > 0 ? Math.sin(b.recoil * PI) * 0.12 : 0;
    bossFade(b, dt);
  }

  // --------------------------------------------------------- update
  C.update = (dt) => {
    const st = G.state;
    if (st === 'paused') return;
    const rdt = G.rdt != null ? G.rdt : dt;
    C.clock += dt;
    if (flowTimers.length) { for (let i = flowTimers.length - 1; i >= 0; i--) if (flowTimers[i].at <= C.clock) { const t = flowTimers.splice(i, 1)[0]; t.res(); } }
    if (!C.boss) { if (HZ.active.length) updateHazards(dt * HZ.speed, dt); return; }
    if (st === 'intro') { C.introT -= dt; if (C.introT <= 0) beginFight(); }
    if (st === 'fight') C.fightTime += dt;
    if (st === 'fight' || st === 'practice' || st === 'cinematic' || st === 'dead' || st === 'victory' || st === 'intro') {
      const dtH = dt * HZ.speed;
      updateHazards(dtH, dt);
      updateAdds(dtH, dt);
      updateBoss(dt);
    }
    if (pendingTransition && heroDown()) pendingTransition = null;
    if (pendingTransition && PLAY(G.state) && !(P() && P().ultActive)) { const p = pendingTransition; pendingTransition = null; doTransition(p.from, p.to); }
    if (C.deathT > 0) {
      C.deathT -= rdt;
      if (C.deathT <= 0) {
        C.deathT = 0;
        if (C.boss) abortScripts(C.boss);
        HZ.clear();
        setState('dead');
        emit('fightEnd', { result: 'defeat', bossIndex: C.bossIndex, phase: C.deathPhase });
      }
    }
    if (C.practice && C.dpsLog) { while (C.dpsLog.length && C.dpsLog[0][0] < C.clock - 5) C.dpsLog.shift(); }
  };
  C.forcePhase = (i) => {
    const b = C.boss; if (!b || !b.alive || b.def.infinite) return false;
    i = clamp(i | 0, 0, b.def.phases.length - 1);
    if (i === b.phase) return false;
    b.hp = b.maxHp * b.def.phases[i].hpStart;
    if (PLAY(G.state)) doTransition(b.phase, i); else pendingTransition = { from: b.phase, to: i };
    return true;
  };
  C.killBoss = () => { const b = C.boss; if (!b || !b.alive || b.def.infinite) return false; b.hp = 0; pendingTransition = null; C.transitioning = false; bossDeath(); return true; };
  C.dps = () => { if (!C.dpsLog || !C.dpsLog.length) return 0; let s = 0; for (const e of C.dpsLog) s += e[1]; return s / 5; };
  C.playing = () => PLAY(G.state);
  C.init = () => {
    G.on('playerDeath', () => { if (!C.boss || C.practice) return; C.deathPhase = C.boss.phase; C.deathT = 1.8; pendingTransition = null; });
  };

  // ======================================================= PRACTICE DUMMY
  // A crowned training effigy: infinite HP, gentle versions of every shape with a hint each, an interruptible cast every 14 s.
  G.bosses = G.bosses || [];
  G.bosses.practice = {
    name: 'EFFIGY', title: 'the Training Dummy', court: 'the Yard', accent: '#ffd36b', sky: 'night', arena: 'ash', music: 'practice', maxHp: 1e9, infinite: true, hitRadius: 1.2, hitHeight: 2.0, noFade: true,
    phases: [{
      name: 'Drill', hpStart: 1.0,
      enter(b) { b.turnRate = 2.0; },
      async script(b) {
        const hint = (t) => b.say(t, 3.2);
        b.loop(async () => {
          const p = b.playerPos();
          hint('A disc fills up, then hits. Step out of it.');
          await b.hz.circle({ x: p.x, z: p.z, r: 2.4, warn: 2.2, dmg: 15, label: 'Drill Disc' });
          await b.wait(2.5);
          hint('A cone from the Effigy. Move sideways.');
          await b.hz.cone({ x: b.pos.x, z: b.pos.z, theta: b.playerTheta(), width: 0.9, r: 11, warn: 2.0, dmg: 15, label: 'Drill Cone' });
          await b.wait(2.5);
          hint('A gold hatched shape goes through Bulwark. Dash out.');
          await b.hz.ring({ x: b.pos.x, z: b.pos.z, r0: 0, r1: 13, warn: 3.0, dmg: 40, lethal: true, unblockable: true, gaps: [{ theta: b.playerTheta() + PI, width: 1.1 }], label: 'Drill Ring' });
          await b.wait(2.5);
          hint('Blue is safe. Be inside when it fills.');
          await b.hz.safe({ x: p.x * -0.5, z: p.z * -0.5, r: 3, warn: 3.2, dmg: 15, label: 'Drill Hymn' });
          await b.wait(2.5);
          hint('Orbs: sidestep, or Rebuke them away.');
          for (let i = 0; i < 4; i++) { b.hz.orb({ x: b.pos.x, z: b.pos.z, dir: b.playerTheta() + (i - 1.5) * 0.25, speed: 5, r: 0.5, life: 5, dmg: 10, label: 'Drill Orb' }); await b.wait(0.3); }
          await b.wait(3);
          hint('A purple cast. Rebuke to interrupt it.');
          const r = await b.cast({ name: 'Drill Hymn', dur: 3.5, interruptible: true, onDone: () => b.hz.wipe(10, 'Drill Hymn') });
          if (r === 'interrupted') hint('Interrupted: the Effigy is Exposed. Hit it.');
          await b.wait(4);
          hint('A wave with a blue lane. Stand in the lane.');
          await b.hz.wave({ x: b.pos.x, z: b.pos.z, r0: 1.5, r1: 14, speed: 5, thickness: 1.0, warn: 2.6, dmg: 25, gaps: [{ theta: b.playerTheta(), width: 0.7 }], label: 'Drill Wave' });
          await b.wait(3);
        });
      },
    }],
    build(b) {
      const g = new T3.Group();
      const body = new T3.Mesh(new T3.CylinderGeometry(0.7, 1.0, 2.6, 10), G.mat.brass({ color: '#6a4a2a', metalness: 0.6, roughness: 0.6 }));
      body.position.y = 1.3; g.add(body);
      const head = new T3.Mesh(new T3.SphereGeometry(0.55, 12, 10), G.mat.brass({ color: '#8a6a3a' })); head.position.y = 3.0; g.add(head);
      const crown = new T3.Mesh(new T3.TorusGeometry(0.5, 0.08, 8, 12), G.mat.emissive('#ffd36b', 1.6)); crown.position.y = 3.5; crown.rotation.x = PI / 2; g.add(crown);
      b.model = g;
    },
    animate(b, dt) { if (b.model) b.model.position.y = Math.sin(b.clock * 1.2) * 0.05; },
  };
})();
