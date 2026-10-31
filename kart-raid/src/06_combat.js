// =====================================================================
// 06_combat.js — telegraphs (track bands + decal pool), zones, obstacles,
// gates, shock rings, items, boss framework (G.Boss: HP, sub-targets,
// phases, rotations, stagger, casts/interrupts, enrage), damageBoss /
// hitPlayer, graze + slow-mo, targeting, fight start/end.   (COMBAT)
// =====================================================================
{
  const { THREE } = G;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, t) => a + (b - a) * t;
  const TR = () => G.track;
  const KP = () => G.kart;
  const sfx = (n, o) => { try { G.audio?.sfx?.(n, o); } catch (e) { } };
  const callout = (t, s) => { try { if (G.ui && G.ui.callout) G.ui.callout(t, s); else G.emit('ui:callout', { text: t, style: s }); } catch (e) { } };
  const KIND_ID = { damage: 0, knock: 1, gold: 2, soak: 3, lava: 4, safe: 5, crack: 6, electric: 7, fire: 0 };
  const KPAD = 0.9;   // kart half width (hit padding)

  // scratch
  const V = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), m: new THREE.Matrix4(),
    x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
  const F = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), n: new THREE.Vector3(), w: 0, bank: 0, kappa: 0 };
  const evPos = new THREE.Vector3();

  const C = G.combat = {
    handlesInterrupt: false,       // kart's crit bolt calls G.boss.interrupt itself
    errors: 0, fightId: 0, lastKS: 0, grazeSlowT: -9,
  };

  // ==================================================================
  // HAZARD BAND SLOTS (16, owned by combat; rebuilt every tick)
  // ==================================================================
  const MAX_BANDS = 16;
  function writeBands() {
    const T = TR(); if (!T.uniforms) return;
    let slot = 0;
    // pass 1: telegraph bands (danger first, they matter most)
    for (let i = 0; i < teles.length && slot < MAX_BANDS; i++) {
      const h = teles[i]; if (h.shape !== 'band' || h.alpha <= 0.001) continue;
      T.setBand(slot++, h.s0, h.s1, h.d0, h.d1, h.visKind, h.state === 'fill' ? Math.min(0.999, h.fill) : 1, h.flash, h.alpha * 0.8);   // road band shader is very emissive; 0.8 keeps wide bands from blooming out
    }
    // pass 2: zone visuals, newest first (so the oldest gold/lava visuals get dropped)
    for (let i = zones.length - 1; i >= 0 && slot < MAX_BANDS; i--) {
      const z = zones[i]; if (!z.visual || z.alpha <= 0.001) continue;
      T.setBand(slot++, z.s0, z.s1, z.d0, z.d1, z.visKind, 1, 0, z.alpha * (z.visAlpha ?? 0.6));
    }
    for (; slot < MAX_BANDS; slot++) T.uniforms.uHazB.value[slot].w = 0;
  }

  // ==================================================================
  // DECAL POOL: one InstancedMesh of 32 quads (circle / ring / rect)
  // ==================================================================
  const MAX_DECALS = 32;
  let decal = null;
  function buildDecals() {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index; ig.attributes.position = geo.attributes.position;
    const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DECALS * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    ig.setAttribute('iA', mk(4));   // shape, kind, fill, flash
    ig.setAttribute('iB', mk(4));   // sizeX (across, m), sizeZ (along, m), r0 (m), alpha
    ig.setAttribute('iC', mk(4));   // live(0/1), seed, unused
    ig.setAttribute('iM0', mk(4)); ig.setAttribute('iM1', mk(4)); ig.setAttribute('iM2', mk(4)); ig.setAttribute('iM3', mk(4));
    ig.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: /* glsl */`
        attribute vec4 iA, iB, iC, iM0, iM1, iM2, iM3;
        varying vec4 vA, vB, vC; varying vec2 vL;
        void main(){
          vA = iA; vB = iB; vC = iC;
          vL = vec2(position.x * iB.x, -position.z * iB.y);       // meters: x across (d), y along (s)
          mat4 m = mat4(iM0, iM1, iM2, iM3);
          vec4 wp = m * vec4(position.x * iB.x, 0., position.z * iB.y, 1.);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime; varying vec4 vA, vB, vC; varying vec2 vL;
        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
          return mix(mix(h12(i), h12(i+vec2(1,0)), u.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), u.x), u.y); }
        vec3 kindCol(float k){
          if (k < .5) return vec3(1., .165, .227); if (k < 1.5) return vec3(.706, .294, 1.); if (k < 2.5) return vec3(1., .788, .227);
          if (k < 3.5) return vec3(.208, .953, 1.); if (k < 4.5) return vec3(1., .353, 0.); if (k < 5.5) return vec3(.75, 1., 1.);
          if (k < 6.5) return vec3(1., .2, .15); return vec3(.25, .66, 1.); }
        void main(){
          float shape = vA.x, kind = vA.y, fill = vA.z, fl = vA.w, alpha = vB.w;
          float hx = vB.x * .5, hz = vB.y * .5;
          float edge, prog, along = vL.y, across = vL.x;
          float r = length(vL);
          if (shape < .5) {                 // circle: fills from the center out
            if (r > hx) discard; edge = hx - r; prog = r / hx;
          } else if (shape < 1.5) {          // ring: fills from both edges toward the middle
            float r0 = vB.z; if (r > hx || r < r0) discard;
            float hw2 = max((hx - r0) * .5, .01); edge = min(hx - r, r - r0); prog = 1. - edge / hw2;
          } else {                           // rect: fills from both s-edges inward
            float ex = hx - abs(across), ez = hz - abs(along); if (ex < 0. || ez < 0.) discard;
            edge = min(ex, ez); prog = 1. - ez / hz;
          }
          vec3 kc = kindCol(kind);
          float x = shape < 1.5 ? r : along + hz;
          float pat;
          if (kind < .5 || kind > 5.5 && kind < 6.5) pat = step(.5, fract((vL.x + vL.y) / 1.4));
          else if (kind < 1.5) pat = shape < 1.5 ? step(.5, fract(atan(vL.y, vL.x) * 1.91 + r * .35 - uTime * 1.5)) : step(length(fract(vL / 1.6) - .5), .22); // spiral / dots
          else if (kind < 2.5) pat = step(.55, fract((along - abs(across) * .7 - uTime * 4.) / 2.6));
          else if (kind < 3.5) pat = step(.5, fract(r / 1.6 - uTime * .8));
          else if (kind < 4.5) pat = step(.5, fract(x / 2.2 + sin(across * .9 + uTime * 2.) * .25));
          else pat = step(.6, fract((along - uTime * 6.) / 2.));
          float filled = step(prog, fill);
          float border = 1. - smoothstep(.22, .34, edge);
          float a = alpha * (.28 + .12 * pat);
          vec3 emi = kc * border * 2.6;
          vec3 col = kc * (.5 + .25 * pat);
          if (kind < .5) emi = mix(emi, vec3(1., .54, .12) * 2.8, border * .6);
          if (filled > .5) {
            a = alpha * (.6 + .18 * pat); col = kc * (.7 + .3 * pat); emi += kc * (.15 + .35 * pat);   // fill stays under the bloom threshold; the border carries the glow
            if (fill > .9 && vC.x < .5) emi += kc * (.5 + .5 * sin(uTime * 40.)) * 1.1;
          }
          // fill front line (bright leading edge)
          emi += kc * 2.2 * (1. - smoothstep(0., .05, abs(prog - fill))) * step(fill, .999);
          if (vC.x > .5) {                   // LIVE: animated energy
            float n1 = vn(vec2(x * .5 - uTime * 5., across * .7)), n2 = vn(vec2(x * 1.3, across * 1.3 + uTime * 6.));
            if (kind < .5) emi += vec3(1., .45, .08) * pow(n1 * n2 * 2.2, 2.) * 3.;
            else if (kind < 1.5 || kind > 6.5) emi += kc * smoothstep(.05, .0, abs(n1 - .5)) * 4.;
            else if (kind > 3.5 && kind < 4.5) emi += vec3(1., .5, .05) * smoothstep(.3, .0, abs(n1 - .5)) * 2.5;
            else emi += kc * n1 * 1.2;
          }
          vec3 outc = col * a + emi * alpha + vec3(fl) * 2.5 * alpha;
          gl_FragColor = vec4(outc, a + fl * alpha * .5);
        }`,
    });
    decal = new THREE.Mesh(ig, mat);
    decal.frustumCulled = false; decal.renderOrder = 3;
    G.scene.add(decal);
  }
  function writeDecals() {
    if (!decal) return;
    const T = TR(); if (!T.built) { decal.geometry.instanceCount = 0; return; }
    const g = decal.geometry, A = g.attributes.iA.array, B = g.attributes.iB.array, Cc = g.attributes.iC.array;
    const M = [g.attributes.iM0.array, g.attributes.iM1.array, g.attributes.iM2.array, g.attributes.iM3.array];
    let n = 0;
    for (let i = 0; i < teles.length && n < MAX_DECALS; i++) {
      const h = teles[i]; if (h.shape === 'band' || h.alpha <= 0.001) continue;
      const f = T.frame(h.s, F);
      // basis: X across (R rotated by rot), Y normal, Z along (T rotated)
      const cr = Math.cos(h.rot || 0), sr = Math.sin(h.rot || 0);
      V.z.copy(f.t).multiplyScalar(cr).addScaledVector(f.r, sr);
      V.x.copy(f.r).multiplyScalar(cr).addScaledVector(f.t, -sr);
      V.y.copy(f.n);
      V.a.copy(f.p).addScaledVector(f.r, h.d).addScaledVector(f.n, 0.07);
      const e = V.m.elements;
      e[0] = V.x.x; e[1] = V.x.y; e[2] = V.x.z; e[3] = 0; e[4] = V.y.x; e[5] = V.y.y; e[6] = V.y.z; e[7] = 0;
      e[8] = V.z.x; e[9] = V.z.y; e[10] = V.z.z; e[11] = 0; e[12] = V.a.x; e[13] = V.a.y; e[14] = V.a.z; e[15] = 1;
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) M[c][n * 4 + r] = e[c * 4 + r];
      const sc = h.state === 'fill' ? 0.85 + 0.15 * Math.min(1, h.t / 0.12) : 1;   // appear scale-in
      let sx, sz;
      if (h.shape === 'rect') { sx = h.wid * sc; sz = h.len * sc; } else { sx = sz = h.r * 2 * sc; }
      A[n * 4] = h.shape === 'circle' ? 0 : h.shape === 'ring' ? 1 : 2; A[n * 4 + 1] = h.visKind;
      A[n * 4 + 2] = h.state === 'fill' ? Math.min(0.999, h.fill) : 1; A[n * 4 + 3] = h.flash;
      B[n * 4] = sx; B[n * 4 + 1] = sz; B[n * 4 + 2] = (h.r0 || 0) * sc; B[n * 4 + 3] = h.alpha;
      Cc[n * 4] = h.state === 'live' ? 1 : 0; Cc[n * 4 + 1] = h.id % 7;
      n++;
    }
    g.instanceCount = n;
    if (n) for (const k of ['iA', 'iB', 'iC', 'iM0', 'iM1', 'iM2', 'iM3']) g.attributes[k].needsUpdate = true;
    decal.material.uniforms.uTime.value = G.time.now;
  }

  // ==================================================================
  // TELEGRAPHS  G.tele.spawn(opts) -> handle
  // ==================================================================
  const teles = [];
  let teleId = 0;
  const grazeDist = () => (KP().mods?.magnet ? 2.5 : (G.cfg.grazeDist || 1.5));

  // track-space distance from the kart (center) to the shape's padded edge; <= 0 means hit
  function shapeDist(h, ks, kd) {
    const T = TR();
    if (h.shape === 'band') {
      const L = T.L, x = ((ks - h.s0) % L + L) % L, len = ((h.s1 - h.s0) % L + L) % L;
      const dS = x < len ? 0 : Math.min(x - len, L - x);
      const dD = kd < h.d0 - KPAD ? h.d0 - KPAD - kd : kd > h.d1 + KPAD ? kd - h.d1 - KPAD : 0;
      if (dS === 0 && dD === 0) {
        // inside: negative distance to the nearest edge
        return -Math.min(Math.min(x, len - x), Math.min(kd - h.d0 + KPAD, h.d1 + KPAD - kd));
      }
      return Math.hypot(dS, dD);
    }
    const dsv = T.ds(h.s, ks), dd = kd - h.d;
    if (h.shape === 'circle') return Math.hypot(dsv, dd) - (h.r + KPAD);
    if (h.shape === 'ring') {
      const r = Math.hypot(dsv, dd);
      if (r > h.r + KPAD) return r - h.r - KPAD;
      if (r < (h.r0 || 0) - KPAD) return (h.r0 || 0) - KPAD - r;
      return -Math.min(h.r + KPAD - r, r - (h.r0 || 0) + KPAD);
    }
    // rect: local frame (u along, v across)
    const cr = Math.cos(h.rot || 0), sr = Math.sin(h.rot || 0);
    const u = dsv * cr + dd * sr, v = -dsv * sr + dd * cr;
    const ax = Math.abs(u) - (h.len / 2 + KPAD), ay = Math.abs(v) - (h.wid / 2 + KPAD);
    if (ax <= 0 && ay <= 0) return Math.max(ax, ay);
    return Math.hypot(Math.max(0, ax), Math.max(0, ay));
  }
  // kart center inside the (unpadded) shape — used for soak
  function insideRaw(h, ks, kd) {
    const T = TR();
    if (h.shape === 'band') return T.inRange(ks, h.s0, h.s1) && kd >= h.d0 && kd <= h.d1;
    const dsv = T.ds(h.s, ks), dd = kd - h.d;
    if (h.shape === 'circle') return Math.hypot(dsv, dd) < h.r;
    if (h.shape === 'ring') { const r = Math.hypot(dsv, dd); return r < h.r && r > (h.r0 || 0); }
    const cr = Math.cos(h.rot || 0), sr = Math.sin(h.rot || 0);
    return Math.abs(dsv * cr + dd * sr) < h.len / 2 && Math.abs(-dsv * sr + dd * cr) < h.wid / 2;
  }

  // lead time: true = 0.9 x windup (legacy), 'resolve' = the actual resolve instant (windup + 0.12 flash), number = seconds
  const leadT = (o, w) => o.lead === 'resolve' ? w + 0.12 : typeof o.lead === 'number' ? o.lead : w * 0.9;
  const tele = G.tele = {
    spawn(o = {}) {
      const T = TR(), K = KP(), b = G.boss;
      const h = {
        id: ++teleId, shape: o.shape || 'circle', kind: o.kind || 'damage',
        s: 0, d: o.d ?? 0, s0: undefined, s1: undefined, d0: undefined, d1: undefined,
        r: o.r ?? 4, r0: o.r0 ?? 0, len: o.len ?? 10, wid: o.wid ?? 6, rot: o.rot ?? 0,
        windup: 1.6, active: o.active ?? 0, tick: o.tick ?? 0.5,
        dmg: o.dmg ?? 25, knock: o.knock ?? 0, spin: !!o.spin, unblockable: !!o.unblockable, tall: !!o.tall,
        follow: o.follow || null, sound: o.sound ?? null, noGraze: !!o.noGraze, visualOnly: !!o.visualOnly,
        onResolve: o.onResolve || null, onHit: o.onHit || null, onLive: o.onLive || null, onEnd: o.onEnd || null, src: o.src || o.name || 'tele',
        t: 0, fill: 0, flash: 0, alpha: 0, state: 'fill', liveT: 0, hitCD: 0, grazed: false, grazeAcc: 0, grazeTick: 0,
        resolved: false, hit: false, data: o.data || null, persist: !!o.persist,
        visKind: KIND_ID[o.visKind || o.kind || 'damage'] ?? 0,
        cancel() { tele.cancel(h); },
      };
      // windup: per-boss minimum, ×0.8 in enrage, never below 0.8 s (unless exact)
      let w = o.windup ?? 1.6;
      if (!o.exact) {
        if (b && b.minWindup) w = Math.max(w, b.minWindup);
        if (b && b.enrage >= 1) w = Math.max(0.8, w * 0.8);
      }
      h.windup = w;
      if (h.shape === 'band') {
        if (o.s0 != null && o.s1 != null) { h.s0 = T.wrap(o.s0); h.s1 = T.wrap(o.s1); }
        else { const c = o.s ?? (o.lead ? K.predict(leadT(o, w)).s : K.s); const l = o.len ?? 30; h.s0 = T.wrap(c - l / 2); h.s1 = T.wrap(c + l / 2); }
        h.d0 = o.d0 ?? -99; h.d1 = o.d1 ?? 99;
        h.s = T.wrap(h.s0 + T.wrap(h.s1 - h.s0) / 2); h.d = (Math.max(h.d0, -9) + Math.min(h.d1, 9)) / 2;
      } else {
        if (o.s != null) h.s = T.wrap(o.s);
        else if (o.lead) { const p = K.predict(leadT(o, Math.max(w, b?.minWindup || 0))); h.s = p.s; if (o.d == null) h.d = p.d; }
        else h.s = K.s;
      }
      teles.push(h);
      if (h.kind === 'damage' || h.kind === 'knock') h.sound = h.sound ?? (h.kind === 'damage' ? 'whine' : 'drone');
      if (!h.visualOnly) G.emit('tele:spawn', { id: h.id, shape: h.shape, kind: h.kind, s: h.s, d: h.d });
      return h;
    },
    cancel(hOrId) {
      const h = typeof hOrId === 'number' ? teles.find(x => x.id === hOrId) : hOrId;
      if (!h || h.state === 'done' || h.state === 'fade') return;
      h.state = 'fade'; h.fadeT = 0.25;
      if (!h.resolved) { h.resolved = true; G.emit('tele:resolve', { id: h.id, hit: false, grazed: false, fizzled: true }); }
      try { h.onEnd?.(h); } catch (e) { G.logError('tele.onEnd', e); }
    },
    clear(keepPersist = false) { for (let i = teles.length - 1; i >= 0; i--) if (!(keepPersist && teles[i].persist)) tele.cancel(teles[i]); },
    // unresolved, non-live telegraphs fizzle (stagger)
    fizzle() { for (const h of teles) if (h.state === 'fill' || h.state === 'flash') tele.cancel(h); },
    list() { return teles; },
    count() { let n = 0; for (const h of teles) if (h.state !== 'fade' && h.state !== 'done') n++; return n; },
    worldPos(h, out) { return TR().toWorld(h.s, h.d, 0, out || V.d); },
  };

  function doGraze(amount, h, slow = true) {
    const K = KP();
    const add = amount + (K.mods?.magnet && amount >= 10 ? 4 : 0);
    K.addFlux(add, 'graze');
    G.emit('kart:graze', { amount: add, mega: false, src: h?.src });
    if (slow && G.time.real - C.grazeSlowT > 1.2) { C.grazeSlowT = G.time.real; G.time.slowmo(0.35, 0.25); }
    C.stats.grazes++;
  }

  function updateTeles(dt) {
    const K = KP(), T = TR();
    const gd = grazeDist();
    let pipBest = null;
    for (let i = teles.length - 1; i >= 0; i--) {
      const h = teles[i];
      if (h.follow) { try { h.follow(dt, h.t, h); } catch (e) { G.logError('tele.follow', e); } if (h.shape === 'band') h.s = T.wrap(h.s0 + T.wrap(h.s1 - h.s0) / 2); }
      h.t += dt;
      if (h.state === 'fill') {
        h.fill = Math.min(1, h.t / h.windup);
        h.alpha = Math.min(1, h.t / 0.12);
        if (h.t >= h.windup) { h.state = 'flash'; h.flash = 1; }
        if (!h.visualOnly && (h.kind === 'damage' || h.kind === 'knock') && (!pipBest || h.windup - h.t < pipBest.windup - pipBest.t)) pipBest = h;
      } else if (h.state === 'flash') {
        h.flash = Math.max(0, 1 - (h.t - h.windup) / 0.12);
        if (h.t >= h.windup + 0.12) resolveTele(h, gd);
      } else if (h.state === 'live') {
        h.liveT += dt; h.flash = 0;
        if (h.hitCD > 0) h.hitCD -= dt;
        if (!h.visualOnly && !K.cometActive && (K.h < 2 || h.tall)) {
          const dist = shapeDist(h, K.s, K.d);
          if (dist <= 0 && h.dmg > 0 && h.hitCD <= 0) {
            const r = C.hitPlayer(h.dmg, { src: h.src, knock: h.knock, spin: h.spin, unblockable: h.unblockable });
            h.hitCD = h.tick; if (r === 'hit') { h.hit = true; try { h.onHit?.(h, r); } catch (e) { G.logError('tele.onHit', e); } }
          } else if (dist > 0 && dist <= gd && !h.noGraze && h.grazeAcc < 12) {
            h.grazeTick -= dt;
            if (h.grazeTick <= 0) { h.grazeTick = 0.3; h.grazeAcc += 4; doGraze(4, h, false); }
          }
        }
        try { h.onLive?.(dt, h); } catch (e) { G.logError('tele.onLive', e); }
        if (h.liveT >= h.active) { h.state = 'fade'; h.fadeT = 0.25; try { h.onEnd?.(h); } catch (e) { G.logError('tele.onEnd', e); } }
      } else if (h.state === 'fade') {
        h.fadeT -= dt; h.alpha = Math.max(0, h.fadeT / 0.25); h.flash = 0;
        if (h.fadeT <= 0) { h.state = 'done'; teles.splice(i, 1); }
      }
    }
    // positional pip for the most urgent telegraph (rate rises with fill)
    if (pipBest && !G.params.test) {
      C.pipT -= dt;
      if (C.pipT <= 0) {
        C.pipT = lerp(0.25, 0.08, pipBest.fill);
        const p = T.toWorld(pipBest.s, pipBest.d, 0, V.c);
        let pan = 0; try { pan = G.audio?.panFor?.(p) || 0; } catch (e) { }
        sfx('telePip', { pitch: 0.8 + pipBest.fill * 0.9, pan });
      }
    }
  }
  function resolveTele(h, gd) {
    const K = KP();
    h.resolved = true; h.flash = 0;
    let hit = false, grazed = false;
    if (!h.visualOnly) {
      const airOK = K.h < 2 || h.tall;
      if (h.kind === 'soak') {
        hit = !K.cometActive && insideRaw(h, K.s, K.d);
      } else if (h.kind !== 'gold' && h.kind !== 'safe' && !K.cometActive && airOK) {
        const dist = shapeDist(h, K.s, K.d);
        if (dist <= 0) {
          if (h.dmg > 0) { const r = C.hitPlayer(h.dmg, { src: h.src, knock: h.knock, spin: h.spin, unblockable: h.unblockable }); hit = r === 'hit' || r === 'god'; h.hitResult = r; if (r === 'hit') { try { h.onHit?.(h, r); } catch (e) { G.logError('tele.onHit', e); } } }
          else hit = true;
        } else if (dist <= gd && !h.noGraze && (h.kind === 'damage' || h.kind === 'knock' || h.kind === 'lava')) {
          grazed = true; h.grazed = true; doGraze(10, h, true);
        }
      }
    }
    h.hit = hit;
    G.emit('tele:resolve', { id: h.id, hit, grazed });
    try { h.onResolve?.(hit, grazed, h); } catch (e) { G.logError('tele.onResolve', e); }
    if (h.active > 0 && h.state !== 'fade') { h.state = 'live'; h.liveT = 0; h.hitCD = hit ? h.tick : 0; }
    else if (h.state !== 'fade') { h.state = 'fade'; h.fadeT = 0.25; try { h.onEnd?.(h); } catch (e) { G.logError('tele.onEnd', e); } }
  }

  // ==================================================================
  // ZONES (persistent area effects)  G.zones.add(opts) -> id
  // ==================================================================
  const zones = [];
  let zoneId = 0;
  const ZVIS = { lava: 'lava', slow: 'lava', oil: 'knock', pull: 'knock', void: 'crack', drift: 'safe', fire: 'damage', electric: 'electric' };
  const zonesApi = G.zones = {
    add(o = {}) {
      const T = TR();
      const z = {
        id: ++zoneId, type: o.type || 'lava', shape: 'band',
        s0: T.wrap(o.s0 ?? 0), s1: o.s1 != null ? T.wrap(o.s1) : T.wrap((o.s0 ?? 0) + 20), d0: o.d0 ?? -99, d1: o.d1 ?? 99,
        until: o.until ?? (o.dur != null ? G.time.now + o.dur : Infinity),
        dps: o.dps || 0, instant: o.instant ?? (o.type === 'lava' ? 15 : 0), slow: o.slow ?? 1, pull: o.pull || 0,
        visual: o.visual !== false, phaseClear: o.phaseClear ?? (o.until == null && o.dur == null ? false : true),
        alpha: 0, visAlpha: o.alpha, inside: false, tickT: 0, voidGap: null, src: o.src || o.type || 'zone',
        onEnter: o.onEnter || null,
      };
      z.kind = o.kind || (z.type === 'lava' || z.type === 'slow' ? 'lava' : z.type === 'void' ? 'damage' : 'knock');
      z.visKind = KIND_ID[o.visKind || ZVIS[z.type] || 'lava'] ?? 4;
      if (z.type === 'void') { try { z.voidGap = T.setGap({ s0: z.s0, s1: z.s1, until: z.until }); } catch (e) { } }
      zones.push(z);
      return z.id;
    },
    remove(id) {
      const i = zones.findIndex(z => z.id === id || z === id); if (i < 0) return;
      const z = zones[i]; if (z.voidGap != null) { try { TR().removeGap(z.voidGap); } catch (e) { } }
      zones.splice(i, 1);
    },
    clear(phaseOnly = false) { for (let i = zones.length - 1; i >= 0; i--) if (!phaseOnly || zones[i].phaseClear) zonesApi.remove(zones[i].id); },
    list() { return zones; },
    get(id) { return zones.find(z => z.id === id) || null; },
  };
  function updateZones(dt) {
    const K = KP(), T = TR(), now = G.time.now;
    K.zoneSlow = 1; K.pullV = 0;
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      const ending = z.until - now;
      if (ending <= 0) { zonesApi.remove(z.id); continue; }
      z.alpha = Math.min(1, z.alpha + dt / 0.3, ending / 0.3);
      if (K.cometActive || K.wrecked) { z.inside = false; continue; }
      const inS = T.inRange(K.s, z.s0, z.s1);
      const inside = inS && K.d >= z.d0 - 0.4 && K.d <= z.d1 + 0.4 && K.h < 1.0;
      const entered = inside && !z.inside;
      z.inside = inside;
      if (!inside) continue;
      if (entered) { try { z.onEnter?.(z); } catch (e) { G.logError('zone.onEnter', e); } }
      if (z.type === 'lava') {
        z.tickT -= dt;
        if (entered || z.tickT <= 0) {
          z.tickT = 1.0;
          if (z.instant > 0) C.hitPlayer(z.instant, { src: z.src });
          G.fx?.burst?.('lavaSplash', K.worldPos, { count: 24 });
        }
        // bounce toward the nearest safe edge (an edge that is inside the drivable width)
        const hd = T.halfDrive(K.s);
        const toLo = z.d0 > -hd ? K.d - z.d0 : Infinity, toHi = z.d1 < hd ? z.d1 - K.d : Infinity;
        const dir = toLo < toHi ? -1 : 1;
        K.knockV = dir * Math.max(Math.abs(K.knockV), 10);
      } else if (z.type === 'slow') {
        K.zoneSlow = Math.min(K.zoneSlow, z.slow);
      } else if (z.type === 'oil') {
        if (entered && !K.isInvuln() && K.spinT <= 0) { K.spinT = 0.6; K.speed *= 0.8; sfx('scrape'); callout('OIL!', 'danger'); G.cam.shake(0.15); }
      } else if (z.type === 'pull') {
        K.pullV += z.pull;
      }
      if (z.dps > 0) { z.dpsT = (z.dpsT || 0) - dt; if (z.dpsT <= 0) { z.dpsT = 1; C.hitPlayer(z.dps, { src: z.src }); } }
    }
  }

  // ==================================================================
  // OBSTACLES (moving hitboxes in track space)
  // ==================================================================
  const obstacles = [];
  const obsApi = G.obstacles = {
    add(o = {}) {
      const ob = Object.assign({ s: 0, d: 0, h: 0, r: 2.5, vs: 0, vd: 0, life: Infinity, dmg: 20, spin: false, knock: 0, dashable: true, lanceable: false,
        mesh: null, megaGraze: false, grazeR: 4, onHit: null, onDestroyed: null, update: null, persist: false, hitCD: 0, t: 0, alive: true, grazed: false, near: false }, o);
      ob.s = TR().wrap(ob.s);
      if (ob.mesh && !ob.mesh.parent) G.scene.add(ob.mesh);
      obstacles.push(ob);
      return ob;
    },
    remove(ob) {
      const i = obstacles.indexOf(ob); if (i < 0) return;
      obstacles.splice(i, 1); ob.alive = false;
      if (ob.mesh && ob.mesh.parent && !ob.keepMesh) ob.mesh.parent.remove(ob.mesh);
    },
    clear(phaseOnly = false) { for (let i = obstacles.length - 1; i >= 0; i--) if (!phaseOnly || !obstacles[i].persist) obsApi.remove(obstacles[i]); },
    list() { return obstacles; },
  };
  function updateObstacles(dt) {
    const K = KP(), T = TR();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const ob = obstacles[i];
      ob.t += dt; ob.life -= dt;
      ob.s = T.wrap(ob.s + ob.vs * dt); ob.d += ob.vd * dt;
      try { ob.update?.(dt, ob); } catch (e) { G.logError('obstacle.update', e); }
      if (!ob.alive) continue;
      if (ob.life <= 0) { obsApi.remove(ob); continue; }
      if (ob.hitCD > 0) ob.hitCD -= dt;
      if (K.cometActive || K.wrecked) continue;
      const dsv = T.ds(ob.s, K.s), dd = K.d - ob.d;
      const dist = Math.hypot(dsv, dd);
      if (dist < ob.r + KPAD && Math.abs(K.h - ob.h) < 1.5 && ob.dmg >= 0) {
        if (K.dashT > 0 && ob.dashable) {
          ob.alive = false;
          K.addFlux(5, 'dashBreak');
          G.fx?.burst?.('chrome', T.toWorld(ob.s, ob.d, ob.h + 1, V.a), { count: 30 });
          try { ob.onDestroyed?.(ob, 'dash'); } catch (e) { G.logError('obstacle.onDestroyed', e); }
          obsApi.remove(ob); continue;
        }
        if (ob.hitCD <= 0) {
          ob.hitCD = 0.6;
          const r = ob.dmg > 0 ? C.hitPlayer(ob.dmg, { src: ob.src || 'obstacle', spin: ob.spin, knock: ob.knock, knockDir: Math.sign(dd) || 1 }) : 'hit';
          if (r === 'hit') ob.wasHit = true;
          try { ob.onHit?.(ob, r); } catch (e) { G.logError('obstacle.onHit', e); }
        }
      } else if (ob.megaGraze && dist < ob.grazeR && !ob.wasHit) ob.near = true;
      else if (ob.megaGraze && ob.near && !ob.grazed && dist >= ob.grazeR) {
        ob.grazed = true;
        K.addFlux(30, 'megaGraze'); G.time.slowmo(0.3, 0.6);
        G.emit('kart:graze', { amount: 30, mega: true, src: ob.src }); C.stats.grazes++;
      }
    }
  }
  function renderObstacles() {
    const T = TR();
    for (const ob of obstacles) {
      if (!ob.mesh || ob.mesh.userData.manual) continue;
      const f = T.frame(ob.s, F);
      ob.mesh.position.copy(f.p).addScaledVector(f.r, ob.d).addScaledVector(f.n, ob.h);
      V.z.copy(f.t).negate(); V.m.makeBasis(f.r, f.n, V.z); ob.mesh.quaternion.setFromRotationMatrix(V.m);
    }
  }

  // ==================================================================
  // GATES (drive-through rings / pylons)
  // ==================================================================
  const gates = [];
  let gateGeo = null, gateMats = null, pylonGeo = null;
  function gateAssets() {
    if (gateGeo) return;
    gateGeo = new THREE.TorusGeometry(1, 0.09, 8, 48);
    pylonGeo = G.addons.BufferGeometryUtils.mergeGeometries([
      new THREE.CylinderGeometry(0.45, 0.7, 6, 8).translate(0, 3, 0).toNonIndexed(),
      new THREE.OctahedronGeometry(1.0, 0).translate(0, 7, 0),                 // already non-indexed
      new THREE.TorusGeometry(1.4, 0.08, 6, 24).rotateX(Math.PI / 2).translate(0, 6.2, 0).toNonIndexed(),
    ]);
    const energy = (col, k) => new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(col).multiplyScalar(k) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec3 vP;
        void main(){ float a = atan(vP.y, vP.x); float n = .65 + .35 * sin(a * 9. + uTime * 12.) * sin(a * 23. - uTime * 17. + vP.z * 3.);
          gl_FragColor = vec4(uCol * n, 1.); }`,
    });
    gateMats = { gold: energy('#ffc93a', 3), red: energy('#ff2a3a', 3), breach: energy('#ffc93a', 4), pylon: energy('#ffc93a', 2.6) };
  }
  const gatesApi = G.gates = {
    add(o = {}) {
      gateAssets();
      const g = Object.assign({ s: 0, d: 0, r: 4, kind: 'gold', life: Infinity, needBoost: false, mesh: null, onPass: null, h: null, persist: false, t: 0, passed: false }, o);
      g.s = TR().wrap(g.s);
      if (!g.mesh) {
        g.mesh = new THREE.Mesh(g.kind === 'pylon' ? pylonGeo : gateGeo, gateMats[g.kind] || gateMats.gold);
        g.ownMesh = true; g.mesh.frustumCulled = false;
      }
      if (!g.mesh.parent) G.scene.add(g.mesh);
      gates.push(g); return g;
    },
    remove(g) { const i = gates.indexOf(g); if (i < 0) return; gates.splice(i, 1); if (g.mesh && g.mesh.parent) g.mesh.parent.remove(g.mesh); },
    clear(phaseOnly = false) { for (let i = gates.length - 1; i >= 0; i--) if (!phaseOnly || !gates[i].persist) gatesApi.remove(gates[i]); },
    list() { return gates; },
  };
  function updateGates(dt, prevS) {
    const K = KP(), T = TR();
    for (let i = gates.length - 1; i >= 0; i--) {
      const g = gates[i]; g.t += dt; g.life -= dt;
      if (g.life <= 0) { gatesApi.remove(g); continue; }
      if (K.cometActive || K.wrecked) continue;
      const a = T.ds(prevS, g.s), b = T.ds(K.s, g.s);
      if (a > 0 && b <= 0 && a < 40 && Math.abs(K.d - g.d) < g.r) {
        g.passed = true;
        try { g.onPass?.(K.boosting, g); } catch (e) { G.logError('gate.onPass', e); }
        sfx('gate');
        G.fx?.burst?.('gold', K.worldPos, { count: 40, color: g.kind === 'red' ? 0xff2a3a : 0xffc93a });
        if (!g.persist) gatesApi.remove(g);
      }
    }
  }
  function renderGates() {
    const T = TR(), t = G.time.now;
    for (const g of gates) {
      if (!g.ownMesh) continue;
      const f = T.frame(g.s, F);
      if (g.kind === 'pylon') {
        g.mesh.position.copy(f.p).addScaledVector(f.r, g.d);
        g.mesh.quaternion.setFromAxisAngle(f.n, t * 2);
        g.mesh.scale.setScalar(g.r / 3.5);
        if (Math.random() < 0.06) { V.a.copy(g.mesh.position).addScaledVector(f.n, 7); V.b.copy(V.a).add(V.c.set(Math.random() * 6 - 3, -4 - Math.random() * 3, Math.random() * 6 - 3)); G.fx?.lightning?.(V.a, V.b, { color: 0xffe9a0, width: 0.5, life: 0.12 }); }
      } else {
        const hh = g.h ?? g.r;
        g.mesh.position.copy(f.p).addScaledVector(f.r, g.d).addScaledVector(f.n, hh);
        V.m.makeBasis(f.r, f.n, f.t); g.mesh.quaternion.setFromRotationMatrix(V.m);
        g.mesh.scale.setScalar(g.r * (1 + 0.04 * Math.sin(t * 8)));
      }
    }
    if (gateMats) for (const k in gateMats) gateMats[k].uniforms.uTime.value = t;
  }

  // ==================================================================
  // SHOCK RINGS: expanding vertical energy walls from a world center.
  // Hit if the kart's xz distance crosses the radius with h < clearH.
  // ==================================================================
  const RING_N = 4;
  const rings = [];
  let ringGeo = null;
  function buildRings() {
    ringGeo = new THREE.CylinderGeometry(1, 1, 1, 160, 1, true).translate(0, 0.5, 0);
    for (let i = 0; i < RING_N; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color('#b44bff') }, uA: { value: 1 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `uniform float uTime, uA; uniform vec3 uCol; varying vec2 vUv; varying vec3 vW;
          void main(){ float y = vUv.y; float a = atan(vW.z, vW.x);
            float core = smoothstep(.62, .0, y) ; float lip = smoothstep(.08, 0., abs(y - .38)) * 1.5;
            float n = .6 + .4 * sin(a * 140. - uTime * 30.) * sin(a * 57. + uTime * 13.);
            vec3 c = uCol * (core * 1.6 * n + lip * 2.5) + vec3(1.) * lip * .6;
            gl_FragColor = vec4(c * uA, 1.); }`,
      });
      const m = new THREE.Mesh(ringGeo, mat); m.visible = false; m.frustumCulled = false; m.renderOrder = 4;
      G.scene.add(m);
      rings.push({ on: false, mesh: m, cx: 0, cy: 0, cz: 0, r: 0, speed: 14, rMax: 140, clearH: 1.2, dmg: 20, spin: true, hitDone: false, lastDist: 0, onHit: null, onClear: null, onEnd: null, src: 'ring' });
    }
  }
  const ringsApi = G.rings = {
    // add({center:V3, r0, speed, rMax, clearH, dmg, spin, color, height, onHit, onClear, onEnd})
    add(o = {}) {
      let R = rings.find(x => !x.on) || rings[0];
      R.on = true; R.cx = o.center?.x || 0; R.cy = o.center?.y ?? 0; R.cz = o.center?.z || 0;
      R.r = o.r0 ?? 8; R.speed = o.speed ?? 14; R.rMax = o.rMax ?? 140; R.clearH = o.clearH ?? 1.2; R.dmg = o.dmg ?? 20; R.spin = o.spin !== false;
      R.height = o.height ?? 2.6; R.hitDone = false; R.lastDist = null; R.hopCued = false; R.onHit = o.onHit || null; R.onClear = o.onClear || null; R.onEnd = o.onEnd || null; R.src = o.src || 'ring';
      R.mesh.material.uniforms.uCol.value.set(o.color || '#b44bff'); R.mesh.visible = true;
      return R;
    },
    clear() { for (const R of rings) { R.on = false; R.mesh.visible = false; } },
    list() { return rings; },
    // seconds until a ring started now (r0, speed) reaches the kart's predicted position
    eta(cx, cz, r0 = 8, speed = 14) {
      const K = KP(), T = TR();
      for (let t = 0.2; t < 12; t += 0.05) {
        const p = K.predict(t); T.toWorld(p.s, p.d, 0, V.a);
        const dist = Math.hypot(V.a.x - cx, V.a.z - cz);
        if (r0 + speed * t >= dist) return { t, s: p.s, d: p.d };
      }
      return null;
    },
  };
  function updateRings(dt) {
    const K = KP();
    for (const R of rings) {
      if (!R.on) continue;
      R.r += R.speed * dt;
      const dist = Math.hypot(K.worldPos.x - R.cx, K.worldPos.z - R.cz);
      // 'HOP!' cue ~0.45 s before the wall reaches the kart
      if (!R.hopCued && !R.hitDone && R.lastDist != null && dist > R.r && (dist - R.r) / Math.max(1, R.speed) < 0.45 && R.clearH > 0) { R.hopCued = true; callout('HOP!', 'interrupt'); sfx('telePip', { pitch: 1.8 }); }
      if (!R.hitDone && R.lastDist != null && !K.cometActive && !K.wrecked) {
        // crossing: ring radius passed the kart (±0.8) this tick
        const before = R.r - R.speed * dt;
        if (before - 0.8 <= dist && R.r + 0.8 >= dist) {
          R.hitDone = true;
          if (K.h >= R.clearH || K.dashT > 0) {
            try { R.onClear?.(R); } catch (e) { G.logError('ring.onClear', e); }
          } else {
            const r = C.hitPlayer(R.dmg, { src: R.src, spin: R.spin });
            try { R.onHit?.(R, r); } catch (e) { G.logError('ring.onHit', e); }
            if (r === 'perfect' || r === 'invuln' || r === 'blocked') { try { R.onClear?.(R, r); } catch (e) { } }
          }
        }
      }
      R.lastDist = dist;
      if (R.r > R.rMax) { R.on = false; R.mesh.visible = false; try { R.onEnd?.(R); } catch (e) { G.logError('ring.onEnd', e); } }
    }
  }
  function renderRings() {
    for (const R of rings) {
      if (!R.on) continue;
      R.mesh.position.set(R.cx, R.cy - 0.3, R.cz);
      R.mesh.scale.set(R.r, R.height, R.r);
      R.mesh.material.uniforms.uTime.value = G.time.now;
      R.mesh.material.uniforms.uA.value = clamp((R.rMax - R.r) / 15, 0, 1);
    }
  }

  // ==================================================================
  // ITEMS
  // ==================================================================
  const ITEMS = ['seeker', 'nitro', 'prism', 'jammer', 'repair'];
  const items = G.items = {
    names: ITEMS, rolling: null /* {t, dur, item} */, charges: 0, shieldT: 0, healT: 0,
    give(name) {
      const K = KP(); if (!ITEMS.includes(name)) { console.warn('unknown item', name); return false; }
      K.item = name; items.charges = name === 'nitro' ? 3 : 1; items.rolling = null;
      G.emit('item:get', { item: name }); return true;
    },
    roll() {
      const K = KP(), b = G.boss;
      const w = { seeker: 30, nitro: 25, prism: 20, jammer: 15, repair: 10 };
      if (K.hp < 40) { w.prism = 35; w.repair = 30; }
      if (b && (b.cast || b.nextCastIn() < 4)) w.jammer *= 2;
      if (b && b.staggered) w.seeker *= 2;
      let tot = 0; for (const k in w) tot += w[k];
      let r = G.rng() * tot;
      for (const k of ITEMS) { r -= w[k]; if (r <= 0) return k; }
      return 'seeker';
    },
    use() {
      const K = KP(); if (!K.item || items.rolling || K.wrecked) return false;
      const it = K.item;
      if (it === 'nitro') {
        K.boost(14, 1.0, 'item'); items.charges--;
        if (items.charges <= 0) K.item = null;
      } else {
        K.item = null;
        if (it === 'seeker') fireSeeker();
        else if (it === 'prism') { items.shieldT = 10; sfx('shield'); callout('PRISM SHIELD', 'perfect'); }
        else if (it === 'repair') { items.healT = 1; sfx('heal'); G.fx?.burst?.('heal', K.worldPos, { count: 30 }); }
        else if (it === 'jammer') useJammer();
      }
      G.emit('item:use', { item: it });
      return true;
    },
    reset() { items.rolling = null; items.charges = 0; items.shieldT = 0; items.healT = 0; },
  };
  // seeker / reflect shard bolts use slots with persistent target vectors (no per-frame alloc)
  const seekSlot = { target: new THREE.Vector3(), targetId: null };
  seekSlot.get = () => { aimAt(seekSlot); return seekSlot.target; };
  function aimAt(slot) {
    const t = C.bestTarget(slot);
    if (t && t.node) { t.node.getWorldPosition(slot.target); slot.targetId = t.id; return true; }
    if (G.boss && G.boss.root) { G.boss.root.getWorldPosition(slot.target); slot.target.y += 8; slot.targetId = 'body'; return true; }
    return false;
  }
  function fireSeeker() {
    const K = KP(); if (!G.boss || !aimAt(seekSlot)) return;
    V.a.copy(K.worldPos).addScaledVector(K.renderUp, 1.5);
    sfx('itemUse');
    G.fx?.bolt?.(V.a, seekSlot.get, { color: '#ff3df2', tier: 3, width: 0.8, speed: 70, arc: 1.6,
      onHit: (pos) => { C.damageBoss(180, { source: 'seeker', targetId: seekSlot.targetId, pos }); G.boss?.addStagger?.(0.15); G.fx?.burst?.('explosion', pos, { count: 60, scale: 0.8 }); G.cam.shake(0.25); } });
  }
  const shardSlot = { target: new THREE.Vector3(), targetId: null };
  shardSlot.get = () => { aimAt(shardSlot); return shardSlot.target; };
  function reflectShard() {
    const K = KP(); if (!G.boss || !aimAt(shardSlot)) return;
    G.fx?.bolt?.(K.worldPos, shardSlot.get, { color: '#9ff8ff', tier: 2, width: 0.6, speed: 80,
      onHit: (pos) => C.damageBoss(60, { source: 'prism', targetId: shardSlot.targetId, pos }) });
  }
  function useJammer() {
    const K = KP(), b = G.boss; sfx('itemUse');
    if (!b) return;
    b.root?.getWorldPosition(V.b); V.b.y += 10;
    G.fx?.lightning?.(K.worldPos, V.b, { color: 0xc04bff, width: 1.2, life: 0.3, branches: 3 });
    if (b.cast && (b.cast.interruptible || !b.cast.final)) { b.interrupt('jammer', true); b.addStagger(0.25 - 0.2); }   // interrupt already adds 20%
    else { b.addStagger(0.10); C.damageBoss(60, { source: 'jammer', pos: V.b }); }
  }
  function updateItems(dt) {
    const K = KP(), T = TR(), now = G.time.now;
    // boxes
    for (const bx of T.boxes) {
      if (!bx.alive) { if (now >= bx.respawnAt) bx.alive = true; continue; }
      if (K.wrecked || K.cometActive) continue;
      if (Math.abs(T.ds(K.s, bx.s)) < 2 && Math.abs(K.d - bx.d) < 2 && K.h < 2.5) {
        bx.alive = false; bx.respawnAt = now + 6;
        G.fx?.shockwave?.(T.toWorld(bx.s, bx.d, 0.3, V.a), { color: 0x9ff8ff, radius: 3.5, dur: 0.3, alpha: 0.8 });
        if (!K.item && !items.rolling) { items.rolling = { t: 0, dur: 1.0, item: items.roll() }; sfx('itemRoll'); G.emit('item:roll', { dur: 1.0 }); }
      }
    }
    if (items.rolling) { items.rolling.t += dt; if (items.rolling.t >= items.rolling.dur) items.give(items.rolling.item); }
    if (items.shieldT > 0) items.shieldT = Math.max(0, items.shieldT - dt);
    if (items.healT > 0) { const k = Math.min(dt, items.healT); items.healT -= k; K.heal(35 * k); }
  }
  // prism bubble
  let bubble = null;
  function buildBubble() {
    bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(2.3, 2), G.fx?.mats?.fresnel ? G.fx.mats.fresnel('#9ff8ff', 2.2, 2.2) : new THREE.MeshBasicMaterial({ color: '#33f6ff', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    bubble.visible = false; bubble.frustumCulled = false; G.scene.add(bubble);
  }

  // ==================================================================
  // DAMAGE: boss and player
  // ==================================================================
  const dpsBins = new Float32Array(20); let dpsBin = 0, dpsBinT = 0;
  C.stats = { grazes: 0, interrupts: 0, hits: 0 };
  C.damageBoss = (amount, opts = {}) => {
    const b = G.boss; if (!b || !b.damage) return 0;
    const dealt = b.damage(amount, opts);
    dpsBins[dpsBin] += dealt;
    return dealt;
  };
  C.dps = () => { let s = 0; for (let i = 0; i < 20; i++) s += dpsBins[i]; return Math.round(s / 10); };
  function difficulty() { return G.difficulty || G.settings?.difficulty || 'raid'; }

  // returns 'hit'|'blocked'|'perfect'|'invuln'|'god'
  C.hitPlayer = (amount, opts = {}) => {
    const K = KP();
    if (K.god || G.params.god) return 'god';
    if (K.wrecked) return 'invuln';
    if (!opts.wipe) {
      if (K.cometActive) return 'invuln';
      if (K.dashT > 0) { K.perfectDash?.(); return 'perfect'; }
      if (items.shieldT > 0) {
        items.shieldT = 0; sfx('shield'); callout('BLOCKED!', 'perfect');
        G.fx?.burst?.('chrome', K.worldPos, { count: 50, color: 0x9ff8ff }); G.post?.flash?.('#9ff8ff', 0.3, 4);
        reflectShard(); return 'blocked';
      }
      if (!opts.unblockable && K.isInvuln()) return 'invuln';
    }
    let amt = amount;
    if (G.boss && G.boss.enrage >= 1 && !opts.wipe) amt *= 1.5;
    if (difficulty() === 'story') amt *= 0.7;
    const r = K.takeHit(Math.round(amt), { src: opts.src, spin: opts.spin, knock: opts.knock, knockDir: opts.knockDir, unblockable: opts.unblockable || opts.wipe });
    if (r === 'hit') C.stats.hits++;
    return r;
  };
  // unavoidable wipe (hard enrage)
  C.wipe = (name = 'WIPE') => {
    const K = KP(); callout(name, 'enrage');
    if (K.god || G.params.god) return;
    K.credits = 0; K.invulnT = 0;
    C.hitPlayer(999, { src: 'wipe', wipe: true, unblockable: true });
  };

  // ==================================================================
  // TARGETING (§6.3)
  // ==================================================================
  const camFwd = new THREE.Vector3();
  C.bestTarget = (slot) => {
    const b = G.boss; if (!b || !b.alive || !b.targets.length) return null;
    if (b.def.boss.bestTarget) { const t = b.def.boss.bestTarget(b, slot); if (t !== undefined) return t; }
    // the Comet always dives into the core (the furnace door / heart) when the boss has one
    if (KP().cometActive) { const c = b.target('core'); if (c && c.node && !(c.hp != null && c.hp <= 0)) return c; }
    G.camera.getWorldDirection(camFwd);
    const cp = G.camera.position, K = KP();
    let best = null, bestDot = Math.cos(35 * Math.PI / 180), anyWeak = null, body = null;
    for (const t of b.targets) {
      if (t.hp != null && t.hp <= 0) continue;
      if (!t.node) continue;
      t.node.getWorldPosition(V.a);
      if (V.a.distanceTo(K.worldPos) > (b.def.boss.range || 150)) continue;
      if (t.always && !body) body = t;
      const exposed = t.weak && (!t.isExposed || t.isExposed(b));
      if (!exposed) continue;
      if (!anyWeak) anyWeak = t;
      V.b.copy(V.a).sub(cp).normalize();
      const dt = V.b.dot(camFwd);
      if (dt > bestDot) { bestDot = dt; best = t; }
    }
    return best || anyWeak || body;
  };

  // ==================================================================
  // BOSS FRAMEWORK
  // ==================================================================
  class Boss {
    constructor(def, index) {
      const B = def.boss || {};
      this.def = def; this.B = B; this.index = index; this.id = def.id || index + 1; this.name = def.name || 'BOSS';
      const mult = difficulty() === 'mythic' ? 1.3 : 1;
      this.maxHp = Math.round((B.hp || 5000) * mult); this.hp = this.maxHp;
      this.minWindup = B.minWindup || 1.2;
      const ek = difficulty() === 'mythic' ? 0.8 : 1;
      this.softEnrage = (B.softEnrage || 9999) * ek; this.hardEnrage = (B.hardEnrage || 9999) * ek;
      this.staggerDurDef = B.staggerDur || 6; this.staggerDecay = B.staggerDecayMult || 0.85;
      this.phase = 0; this.phaseName = ''; this.t = 0; this.clk = 0; this.phaseT = 0;
      this.stagger = 0; this.staggered = false; this.staggerT = 0; this.staggerDur = 0; this.staggerCount = 0; this.staggerScripted = false;
      this.enrage = 0; this.invulnT = 0; this.cast = null; this.targets = []; this.root = null;
      this.alive = true; this.state = 'dormant'; this.rotT = 0; this.loopN = 0; this.timers = [];
      this.hitFlash = 0; this.phaseStartHp = this.maxHp; this.phaseStartT = 0; this.deathT = 0; this.mem = {};
      this.phaseStaggers = 0; this.sched = null; this.fired = null;
      try { B.create?.(this); } catch (e) { G.logError('boss.create', e); }
      if (typeof B.targets === 'function') { try { this.targets = B.targets(this) || []; } catch (e) { G.logError('boss.targets', e); } }
      else if (Array.isArray(B.targets) && !this.targets.length) this.targets = B.targets;
      for (const t of this.targets) if (t.hp != null && t.maxHp == null) t.maxHp = t.hp;
    }
    get phases() { return this.B.phases || []; }
    get fighting() { return this.state === 'fight'; }
    after(sec, fn, keep = false) { const tm = { at: this.clk + sec, fn, keep }; this.timers.push(tm); return tm; }
    clearTimers(all = false) { for (let i = this.timers.length - 1; i >= 0; i--) if (all || !this.timers[i].keep) this.timers.splice(i, 1); }
    target(id) { for (const t of this.targets) if (t.id === id) return t; return null; }

    // ---- fight lifecycle ----
    begin(phaseIdx = 0) {
      this.hp = this.maxHp; this.t = 0; this.stagger = 0; this.staggered = false; this.staggerCount = 0; this.enrage = 0;
      this.cast = null; this.alive = true; this.state = 'fight'; this.deathT = 0; this.clearTimers(true);
      for (const t of this.targets) if (t.maxHp != null) t.hp = t.maxHp;
      if (TR().uniforms) { TR().uniforms.uEnrage.value = 0; TR().uniforms.uCool.value = 0; }
      try { this.B.onStart?.(this); } catch (e) { G.logError('boss.onStart', e); }
      phaseIdx = clamp(phaseIdx | 0, 0, Math.max(0, this.phases.length - 1));
      if (phaseIdx > 0) this.hp = Math.round(this.maxHp * this.phases[phaseIdx].at);
      this.setPhase(phaseIdx, { initial: true });
    }
    setPhase(i, o = {}) {
      const ph = this.phases; if (!ph.length) return;
      i = clamp(i, 0, ph.length - 1);
      if (!o.initial && !o.retry) { try { ph[this.phase]?.exit?.(this); } catch (e) { G.logError('phase.exit', e); } }
      clearHazards(true);
      this.clearTimers();
      if (this.cast) this.endCast(true, true);
      if (this.staggered) this.endStagger(true);
      this.phase = i; this.phaseName = ph[i].name || ''; this.phaseT = 0; this.rotT = 0; this.loopN = 0; this.phaseStaggers = 0;
      this.buildSchedule();
      this.phaseStartHp = this.hp; this.phaseStartT = this.t;
      if (!o.initial && !o.retry) {
        this.invulnT = 2.5;
        const K = KP(); K.invulnT = Math.max(K.invulnT, 2.5);
        try { G.ui?.banner?.('PHASE ' + (i + 1) + ' - ' + this.phaseName, this.name); } catch (e) { }
        if (!G.ui?.banner) callout('PHASE ' + (i + 1) + ' - ' + this.phaseName, 'phase');
        G.cam.shake(0.6); G.cam.pullOut?.(2, 2); G.cam.lookAtBoss?.(0.45, 2);
      } else this.invulnT = 0;
      if (!o.initial || i > 0) G.emit('boss:phase', { boss: this.id, phase: i + 1, name: this.phaseName });
      try { ph[i].enter?.(this, o); } catch (e) { G.logError('phase.enter', e); }
    }
    buildSchedule() {
      const p = this.phases[this.phase], rot = (p && p.rotation) || [];
      this.sched = new Float32Array(rot.length); this.fired = new Uint8Array(rot.length);
      this.jitter();
    }
    jitter() {
      const p = this.phases[this.phase], rot = (p && p.rotation) || [], j = p?.jitter ?? 0.5;
      for (let k = 0; k < rot.length; k++) { this.sched[k] = Math.max(0, rot[k].t + (k === 0 && rot[k].t === 0 ? 0 : (G.rng() * 2 - 1) * j)); this.fired[k] = 0; }
    }
    // seconds until the next scheduled cast (entries flagged cast:true) — used by item rolls
    nextCastIn() {
      const p = this.phases[this.phase]; if (!p || !p.rotation || !this.sched) return 99;
      let best = 99;
      for (let k = 0; k < p.rotation.length; k++) if (p.rotation[k].cast && !this.fired[k]) best = Math.min(best, this.sched[k] - this.rotT);
      return best;
    }
    attack(name, params) {
      const fn = this.B.attacks && this.B.attacks[name];
      if (!fn) return false;
      try { fn(this, params || {}); } catch (e) { G.logError('attack:' + name, e); }
      return true;
    }

    // ---- damage ----
    damage(amount, opts = {}) {
      if (!this.alive || this.state !== 'fight' || amount <= 0) return 0;
      if (this.invulnT > 0 && !opts.force) return 0;
      let t = opts.targetId ? this.target(opts.targetId) : null;
      if (t && t.hp != null && t.hp <= 0) t = null;
      // world pos for the damage number
      let pos = opts.pos;
      if (!pos) { if (t && t.node) pos = t.node.getWorldPosition(evPos); else if (this.root) { pos = this.root.getWorldPosition(evPos); pos.y += 8; } }
      const exposed = t && t.weak && (!t.isExposed || t.isExposed(this));
      let m = t ? (t.getMult ? t.getMult(this) : exposed ? (t.mult || 1) : 1) : 1;
      if (this.staggered) m = t && t.id === 'core' ? 2.0 : m * 1.25;
      // Comet (and any opts.flat hit) lands at exactly its listed damage: spec §4.4 900, §6.4 budget
      if (opts.flat || opts.source === 'comet') m = 1;
      let dealt = Math.round(amount * m);
      const weak = m > 1.001;
      // sub-HP target: damage goes to the target, its onDestroyed applies main damage
      if (t && t.hp != null) {
        t.hp = Math.max(0, t.hp - dealt);
        this.hitFlash = 1;
        G.emit('boss:damaged', { amount: dealt, targetId: t.id, weak, crit: !!opts.crit, pos, source: opts.source || '', sub: true });
        if (t.hp <= 0) { try { t.onDestroyed?.(this, t); } catch (e) { G.logError('target.onDestroyed', e); } }
        try { this.B.onDamaged?.(this, dealt, opts, t); } catch (e) { G.logError('boss.onDamaged', e); }
        return dealt;
      }
      // phase threshold clamp (no skipping phases)
      const next = this.phases[this.phase + 1];
      let phaseUp = false;
      if (next) { const thr = Math.round(this.maxHp * next.at); if (this.hp - dealt <= thr) { dealt = Math.max(0, this.hp - thr); phaseUp = true; } }
      this.hp -= dealt; this.hitFlash = 1;
      G.emit('boss:damaged', { amount: dealt, targetId: t ? t.id : 'body', weak, crit: !!opts.crit, pos, source: opts.source || '' });
      try { this.B.onDamaged?.(this, dealt, opts, t); } catch (e) { G.logError('boss.onDamaged', e); }
      if (phaseUp) this.setPhase(this.phase + 1);
      else if (this.hp <= 0) this.die();
      return dealt;
    }
    die() {
      if (this.state !== 'fight') return;
      this.hp = 0; this.alive = false; this.state = 'dying'; this.deathT = 0;
      clearHazards(false); this.clearTimers(true);
      if (this.cast) this.endCast(true, true);
      this.staggered = false;
      G.time.slowmo(0.2, 1.0);
      const K = KP(); K.invulnT = Math.max(K.invulnT, 5);
      G.emit('boss:dead', { boss: this.id });
      try { this.B.onDeath?.(this); } catch (e) { G.logError('boss.onDeath', e); }
    }

    // ---- stagger ----
    addStagger(frac) {
      if (this.staggered || this.state !== 'fight' || !(frac > 0) || this.enrage >= 2) return;
      this.stagger += frac * Math.pow(this.staggerDecay, this.staggerCount);
      if (this.stagger >= 1) this.startStagger();
    }
    startStagger(dur, scripted = false) {
      if (this.state !== 'fight') return;
      if (this.enrage >= 2 || (this.cast && this.cast.final)) return;   // hard enrage: nothing cancels the wipe
      dur = dur || this.staggerDurDef;
      if (this.staggered) { this.staggerT = Math.max(this.staggerT, dur); this.staggerDur = Math.max(this.staggerDur, this.staggerT); return; }
      this.staggered = true; this.staggerT = dur; this.staggerDur = dur; this.stagger = 1; this.staggerScripted = scripted; this.phaseStaggers++;
      if (this.cast) this.endCast(true, true);
      tele.fizzle(); this.clearTimers();
      G.emit('boss:stagger', { on: true, dur });
      callout('BREAK!', 'break');
      G.post?.bloomPulse?.(0.8, 2); G.cam.kickFov(10, 0.5); G.cam.shake(0.5); G.time.hitstop(90);
      try { this.B.onStagger?.(this, scripted); } catch (e) { G.logError('boss.onStagger', e); }
    }
    endStagger(silent = false) {
      if (!this.staggered) return;
      this.staggered = false; this.stagger = 0; this.staggerT = 0;
      if (!silent) this.staggerCount++;
      G.emit('boss:stagger', { on: false, dur: 0 });
      try { this.B.onStaggerEnd?.(this); } catch (e) { G.logError('boss.onStaggerEnd', e); }
    }

    // ---- casts ----
    castBar(name, dur, o = {}) { return this.startCast(name, dur, o); }
    startCast(name, dur, o = {}) {
      if (this.state !== 'fight' || this.staggered) return null;
      if (this.cast) this.endCast(true, true);
      this.cast = { name, t: 0, dur, interruptible: !!o.interruptible, final: !!o.final, blocking: !!o.blocking, label: o.label || (o.interruptible ? 'REDLINE TO INTERRUPT' : ''), onComplete: o.onComplete || null, onInterrupt: o.onInterrupt || null };
      G.emit('boss:cast', { name, dur, interruptible: !!o.interruptible });
      return this.cast;
    }
    endCast(interrupted, silent = false) {
      const c = this.cast; if (!c) return;
      this.cast = null;
      G.emit('boss:castEnd', { name: c.name, interrupted: !!interrupted });
      if (!interrupted && !silent) { try { c.onComplete?.(this, c); } catch (e) { G.logError('cast.onComplete', e); } }
    }
    interrupt(src = 'bolt', force = false) {
      const c = this.cast; if (!c || this.state !== 'fight') return false;
      if (!(c.interruptible || (force && !c.final))) return false;
      this.cast = null;
      G.emit('boss:castEnd', { name: c.name, interrupted: true });
      C.stats.interrupts++;
      KP().addFlux(20, 'interrupt');
      callout('INTERRUPTED!', 'interrupt');
      G.cam.shake(0.3); G.time.hitstop(60);
      try { c.onInterrupt?.(this, src); } catch (e) { G.logError('cast.onInterrupt', e); }
      this.addStagger(0.2);
      return true;
    }
    // spec name: cast(name, dur, opts)
    castStart(...a) { return this.startCast(...a); }

    // ---- per tick ----
    update(dt, rdt) {
      const B = this.B;
      this.clk += dt;
      if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
      if (this.state === 'dormant') { try { B.idle?.(this, dt); B.update?.(this, dt); } catch (e) { G.logError('boss.tick', e); } return; }
      if (this.state === 'dying') {
        this.deathT += rdt;
        try { B.death?.(this, this.deathT, rdt); } catch (e) { G.logError('boss.death', e); }
        if (this.deathT >= (B.deathDur || 3.2)) {
          this.state = 'dead';
          G.emit('fight:end', { boss: this.id, win: true, time: +this.t.toFixed(2) });
        }
        return;
      }
      if (this.state !== 'fight') { try { B.update?.(this, dt); } catch (e) { G.logError('boss.tick', e); } return; }
      this.t += dt; this.phaseT += dt;
      if (this.invulnT > 0) this.invulnT -= dt;
      // timers
      for (let i = this.timers.length - 1; i >= 0; i--) {
        const tm = this.timers[i];
        if (this.clk >= tm.at) { this.timers.splice(i, 1); try { tm.fn(this); } catch (e) { G.logError('boss.timer', e); } }
      }
      // cast
      if (this.cast) { this.cast.t += dt; if (this.cast.t >= this.cast.dur) this.endCast(false); }
      // stagger
      if (this.staggered) { this.staggerT -= dt; this.stagger = Math.max(0, this.staggerT / this.staggerDur); if (this.staggerT <= 0) this.endStagger(); }
      // enrage
      if (this.enrage < 1 && this.t >= this.softEnrage) {
        this.enrage = 1; G.emit('boss:enrage', { level: 1 }); callout('ENRAGE', 'enrage');
        try { G.audio?.music?.enrage?.(true); } catch (e) { }
        try { B.onSoftEnrage?.(this); } catch (e) { G.logError('boss.onSoftEnrage', e); }
      }
      if (this.enrage < 2 && this.t >= this.hardEnrage) {
        this.enrage = 2; G.emit('boss:enrage', { level: 2 });
        try { if (B.onHardEnrage) B.onHardEnrage(this); else this.after(4, () => C.wipe('ENRAGED'), true); } catch (e) { G.logError('boss.onHardEnrage', e); }
      }
      const TU = TR().uniforms; if (TU) TU.uEnrage.value += ((this.enrage >= 1 ? 1 : 0) - TU.uEnrage.value) * Math.min(1, dt * 1.5);
      // rotation scheduler
      const ph = this.phases[this.phase];
      const paused = this.staggered || this.invulnT > 0 || (this.cast && this.cast.blocking);
      if (ph && ph.rotation && ph.rotation.length && !paused) {
        this.rotT += dt;
        const rot = ph.rotation;
        for (let k = 0; k < rot.length; k++) {
          if (this.fired[k] || this.rotT < this.sched[k]) continue;
          this.fired[k] = 1;
          const e = rot[k];
          if (e.when && !e.when(this)) continue;
          if (e.loops && (this.loopN % e.loops) !== (e.loopOffset || 0)) continue;
          this.attack(e.a, e.p);
        }
        const loop = ph.loop || 20;
        if (this.rotT >= loop) { this.rotT -= loop; this.loopN++; this.jitter(); try { ph.onLoop?.(this, this.loopN); } catch (e) { G.logError('phase.onLoop', e); } }
      }
      try { ph?.update?.(this, dt); } catch (e) { G.logError('boss.tick', e); }
      try { B.update?.(this, dt); } catch (e) { G.logError('boss.tick', e); }
    }
    render(alpha, rdt) { try { this.B.render?.(this, rdt, alpha); } catch (e) { G.logError('boss.render', e); } }
    dispose() { try { this.B.dispose?.(this); } catch (e) { } }
  }
  // spec alias: boss.cast(name, dur, opts) conflicts with the boss.cast field; use boss.startCast()
  G.Boss = Boss;

  function clearHazards(phaseOnly) {
    tele.clear(); zonesApi.clear(phaseOnly); obsApi.clear(phaseOnly); gatesApi.clear(phaseOnly); ringsApi.clear();
  }
  C.clearHazards = clearHazards;

  // ==================================================================
  // FIGHT CONTROL (used by flow + __game)
  // ==================================================================
  let pendingSetup = false;
  C.setupBoss = (def) => {
    def = def || TR().def;
    if (G.boss) { G.boss.dispose(); G.boss = null; }
    clearHazards(false); items.reset();
    if (!def || !def.boss) { G.boss = null; return null; }
    const idx = Math.max(0, G.bosses.indexOf(def));
    G.boss = new Boss(def, idx);
    C.bossNum = idx + 1;
    pendingSetup = false;
    return G.boss;
  };
  function ensureBoss() { if (pendingSetup || (TR().def && G.boss && G.boss.def !== TR().def)) C.setupBoss(TR().def); return G.boss; }
  C.startFight = (n, o = {}) => {
    if (n && G.bosses[n - 1] && TR().def !== G.bosses[n - 1]) { TR().buildArena(G.bosses[n - 1]); }
    const b = ensureBoss() || C.setupBoss(TR().def);
    if (!b) { console.warn('startFight: no boss def'); return false; }
    C.fightId++; C.stats.grazes = 0; C.stats.interrupts = 0; C.stats.hits = 0; dpsBins.fill(0);
    b.begin(((o.phase || G.params.phase || 1) | 0) - 1);
    return true;
  };
  // quit / next boss: stop the fight, keep the boss mesh idling (dormant)
  C.endFight = () => {
    clearHazards(false); items.reset();
    const b = G.boss; if (b) { if (b.cast) b.endCast(true, true); b.clearTimers(true); b.staggered = false; if (b.state === 'fight' || b.state === 'won') b.state = 'dormant'; }
    const TU = TR().uniforms; if (TU) TU.uEnrage.value = 0;
    return true;
  };
  C.retryCheckpoint = () => {
    const b = G.boss; if (!b) return false;
    clearHazards(false); items.reset();
    b.hp = b.phaseStartHp; b.t = b.phaseStartT; b.alive = true; b.state = 'fight';
    b.stagger = 0; b.staggered = false; b.cast = null; b.enrage = b.t >= b.softEnrage ? 1 : 0; b.clearTimers(true);
    KP().reset(false);
    b.setPhase(b.phase, { retry: true });
    G.emit('fight:retry', { boss: b.id, phase: b.phase + 1 });
    return true;
  };
  C.setPhase = (p) => {   // 1-based, sets HP to that threshold
    const b = G.boss; if (!b || b.state !== 'fight') { console.warn('setPhase: no fight'); return false; }
    const i = clamp((p | 0) - 1, 0, b.phases.length - 1);
    if (i === b.phase) return true;
    b.hp = Math.round(b.maxHp * b.phases[i].at); b.setPhase(i); return true;
  };
  C.setBossHP = (frac) => {
    const b = G.boss; if (!b || b.state !== 'fight') { console.warn('setBossHP: no fight'); return false; }
    if (frac <= 0) { C.killBoss(); return true; }
    const hp = Math.round(b.maxHp * clamp(frac, 0, 1));
    let pi = 0; for (let i = 0; i < b.phases.length; i++) if (b.phases[i].at * b.maxHp >= hp - 0.5) pi = i;
    b.hp = hp;
    if (pi !== b.phase) b.setPhase(pi);
    return true;
  };
  C.killBoss = () => { const b = G.boss; if (!b || b.state !== 'fight') { console.warn('killBoss: no fight'); return false; } b.hp = 0; b.die(); return true; };
  C.forceStagger = (dur = 6) => { const b = G.boss; if (!b || b.state !== 'fight') { console.warn('forceStagger: no fight'); return false; } b.startStagger(dur, true); return true; };
  C.triggerAttack = (name, params) => { const b = G.boss; if (!b || !b.B.attacks || !b.B.attacks[name]) return false; if (b.state !== 'fight') { console.warn('triggerAttack: no fight'); return false; } return b.attack(name, params); };
  C.listAttacks = () => { const b = G.boss; const d = b ? b.def : (TR().def || G.bosses[(C.bossNum || 1) - 1]); return d && d.boss && d.boss.attacks ? (d.boss.attackNames || Object.keys(d.boss.attacks)) : []; };
  // plain JSON snapshot for __game.state()
  C.state = () => {
    const b = G.boss;
    return {
      boss: b ? b.id : 0, phase: b ? b.phase + 1 : 0, phaseName: b ? b.phaseName : '', bossHP: b ? Math.max(0, Math.round(b.hp)) : 0, bossMaxHP: b ? b.maxHp : 0,
      bossHPFrac: b ? +(Math.max(0, b.hp) / b.maxHp).toFixed(4) : 0, stagger: b ? +b.stagger.toFixed(3) : 0, staggered: !!(b && b.staggered), enrage: b ? b.enrage : 0,
      fightTime: b ? +b.t.toFixed(2) : 0, bossState: b ? b.state : 'none',
      cast: b && b.cast ? { name: b.cast.name, t: +b.cast.t.toFixed(2), dur: b.cast.dur, interruptible: b.cast.interruptible } : null,
      subTargets: b ? b.targets.filter(t => t.maxHp != null).map(t => ({ id: t.id, hp: Math.round(t.hp), maxHp: t.maxHp, alive: t.hp > 0 })) : [],
      telegraphs: tele.count(), obstacles: obstacles.length, zones: zones.length, gates: gates.length,
      dps: C.dps(), grazes: C.stats.grazes, interrupts: C.stats.interrupts, item: KP().item, itemRolling: !!items.rolling, shield: items.shieldT > 0,
    };
  };
  C.telegraphs = () => teles.filter(h => h.state !== 'done').map(h => ({ id: h.id, shape: h.shape, kind: h.kind, s: +h.s.toFixed(2), d: +h.d.toFixed(2), s0: h.s0, s1: h.s1, d0: h.d0, d1: h.d1, r: h.r, len: h.len, wid: h.wid, fill: +h.fill.toFixed(3), state: h.state, dmg: h.dmg, src: h.src }));

  // flow hooks
  G.on('track:built', () => { pendingSetup = true; if (G.boss) { G.boss.dispose(); G.boss = null; } clearHazards(false); });
  G.on('fight:start', (e) => {
    ensureBoss();
    if (e && e.checkpoint) C.retryCheckpoint();
    else C.startFight(null, { phase: e && e.phase });
  });
  G.on('kart:wreck', (e) => {
    const b = G.boss;
    if (e && e.wipe && b && b.state === 'fight') {
      b.state = 'won'; b.clearTimers(true); if (b.cast) b.endCast(true, true);
      G.emit('fight:end', { boss: b.id, win: false, time: +b.t.toFixed(2) });
      try { b.B.onWipe?.(b); } catch (err) { }
      b.after(1.0, () => clearHazards(false), true);
    }
  });

  // ==================================================================
  // module hooks
  // ==================================================================
  function update(dt, rdt) {
    const T = TR(), K = KP();
    if (!T.built) return;
    if (pendingSetup) {
      C.setupBoss(T.def);
      // no UI/flow module: start immediately (test builds)
      if (!G.mods.ui && G.boss) G.emit('fight:start', { boss: G.boss.id });
    }
    const prevS = C.lastKS;
    // boss first (spec: boss.update via combat, then combat systems)
    const b = G.boss;
    if (b) { try { b.update(dt, rdt || G.DT); } catch (e) { G.logError('boss.tick', e); C.errors++; } }
    try { updateTeles(dt); } catch (e) { G.logError('tele.update', e); }
    try { updateZones(dt); } catch (e) { G.logError('zones.update', e); }
    try { updateObstacles(dt); } catch (e) { G.logError('obstacles.update', e); }
    try { updateGates(dt, prevS); } catch (e) { G.logError('gates.update', e); }
    try { updateRings(dt); } catch (e) { G.logError('rings.update', e); }
    try { updateItems(dt); } catch (e) { G.logError('items.update', e); }
    writeBands();
    // rolling dps bins (0.5 s each, 10 s window)
    dpsBinT += dt; if (dpsBinT >= 0.5) { dpsBinT -= 0.5; dpsBin = (dpsBin + 1) % 20; dpsBins[dpsBin] = 0; }
    C.lastKS = K.s;
  }
  function render(alpha, rdt) {
    if (!TR().built) { if (decal) decal.geometry.instanceCount = 0; return; }
    writeDecals(); renderObstacles(); renderGates(); renderRings();
    const K = KP();
    if (bubble) {
      bubble.visible = items.shieldT > 0 && !K.wrecked;
      if (bubble.visible) { bubble.position.copy(K.renderPos).addScaledVector(K.renderUp, 0.7); bubble.scale.setScalar(1 + 0.04 * Math.sin(G.time.real * 9) + (items.shieldT < 2 ? 0.1 * Math.sin(G.time.real * 30) : 0)); }
    }
    if (G.boss) G.boss.render(alpha, rdt);
  }
  G.register('combat', {
    init() { buildDecals(); buildRings(); buildBubble(); C.pipT = 0; },
    update, render,
    reset() { clearHazards(false); items.reset(); },
  });
}
