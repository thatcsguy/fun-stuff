// =====================================================================
// 07_kart.js — kart model, track-space physics, drift + mini-turbo tiers,
// Spark Lance volleys, Flux, Arc Dash, Overclock, Comet, hull/credits,
// ghost recorder, bot autopilot, launch start.   (KART)
// =====================================================================
{
  const { THREE } = G;
  const cfg = G.cfg;
  const tr = () => G.track;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, t) => a + (b - a) * t;
  const DEG = Math.PI / 180;

  // scratch
  const V = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(),
    fwd: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(),
    s: new THREE.Vector3(1, 1, 1) };
  const F1 = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), n: new THREE.Vector3(), w: 0, bank: 0, kappa: 0 };
  const F2 = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), n: new THREE.Vector3(), w: 0, bank: 0, kappa: 0 };
  const predRes = { s: 0, d: 0 };
  const tierColors = cfg.tierColor.map(c => new THREE.Color(c));

  // ------------------------------------------------------------------
  // Public kart state (spec §2.3)
  // ------------------------------------------------------------------
  const K = G.kart = {
    s: 0, d: 0, h: 0, speed: 0, psi: 0, vh: 0, slip: 0, hp: 100, maxHp: 100, flux: 0, credits: 3, lap: 0, item: null,
    drifting: false, driftDir: 0, driftTier: 0, driftCharge: 0, airborne: false, boosting: false, boostT: 0, boostAdd: 0,
    invulnT: 0, dashT: 0, dashCD: 0, freeDash: true, freeDashT: 0, cometActive: false, overclockT: 0, overclockCD: 0, brand: 0,
    overchargedT: 0, wobbleT: 0, spinT: 0, wrecked: false, wiped: false, frozen: false, bot: false, god: G.params.god,
    zoneSlow: 1, pullV: 0, knockV: 0, sdot: 0, ddot: 0,
    mods: {},   // capacitor, magnet, twin, hotstart, hull, storm (set by garage)
    worldPos: new THREE.Vector3(), worldQuat: new THREE.Quaternion(), mesh: null,
    renderPos: new THREE.Vector3(), renderUp: new THREE.Vector3(0, 1, 0), camFwd: new THREE.Vector3(1, 0, 0),
    stats: { hits: 0, perfects: 0, comets: 0, releases: 0, dashes: 0 },
  };
  // internal
  const st = {
    prevS: 0, prevD: 0, prevH: 0, prevYaw: 0, yawVis: 0, lastHitT: -99, cleanLap: true, onRamp: null, rampAir: false,
    airT: 0, trickQueued: false, hopKind: 0, pendingDrift: 0, pendingT: 0, assistTap: false, lastSteerDir: 1,
    dashDir: 0, dashPaid: false, dashPerfect: false, dashHeldDrift: false, wallT: 0, wallHitCD: 0, railCD: 0,
    padCD: 0, lastPad: null, sputterT: 0, countT: 0, launchOK: false, launchEarly: false,
    wreckT: 0, wreckSpin: 0, squash: 0, squashV: 0, lean: 0, pitch: 0, sparkAcc: 0, smokeAcc: 0, flameAcc: 0,
    comet: null, boostSrc: '', fizzT: 0, dHold: 0, invHitT: 0, supercell: false, tick: 0,
  };

  const ctl = { steer: 0, steerRaw: 0, throttle: 1, brake: false, drift: false, dash: false, ability: false, item: false,
    pressed: { drift: false, dash: false, ability: false, item: false }, released: { drift: false, dash: false, ability: false, item: false } };
  const botPrev = { drift: false, dash: false, ability: false, item: false };

  const sfx = (n, o) => { try { G.audio?.sfx?.(n, o); } catch (e) { } };
  const callout = (t, s) => { try { if (G.ui && G.ui.callout) G.ui.callout(t, s); else G.emit('ui:callout', { text: t, style: s }); } catch (e) { } };

  K.isInvuln = () => K.invulnT > 0 || K.cometActive || K.wrecked;
  K.cometReady = () => K.flux >= 100 && !!(G.boss && G.boss.staggered) && !K.cometActive && !K.wrecked && !K.frozen;
  K.addFlux = (n, reason) => { const before = K.flux; K.flux = clamp(K.flux + n, 0, 100); if (reason && n > 0) G.emit('kart:flux', { amount: n, reason }); return K.flux - before; };
  K.heal = (n) => { K.hp = Math.min(K.maxHp, K.hp + n); };
  K.predict = (t) => {
    const T = tr(); predRes.s = T.wrap(K.s + K.sdot * t);
    const hd = T.halfDrive(predRes.s); predRes.d = clamp(K.d + K.ddot * t * 0.5, -hd, hd); return predRes;
  };

  // ------------------------------------------------------------------
  // Boost
  // ------------------------------------------------------------------
  K.boost = (add, dur, source = 'item') => {
    if (K.boostT > 0) K.boostAdd = Math.max(K.boostAdd, add); else K.boostAdd = add;
    K.boostT = Math.max(K.boostT, dur);
    st.boostSrc = source;
    G.cam.kickFov(4 + add * 0.25, 0.45);
    G.cam.shake(0.08);
    if (source) G.emit('kart:boost', { source, dur });
  };

  // ------------------------------------------------------------------
  // Hits / damage (COMBAT calls K.takeHit after deciding the result)
  // ------------------------------------------------------------------
  K.takeHit = (amount, opts = {}) => {
    if (K.god || G.params.god) return 'god';
    if (!opts.unblockable && K.isInvuln()) return 'invuln';
    if (K.wrecked) return 'invuln';
    amount = Math.round(amount);
    K.hp -= amount; st.lastHitT = G.time.now; st.cleanLap = false; K.stats.hits++;
    K.invulnT = Math.max(K.invulnT, cfg.hitIframes); st.invHitT = cfg.hitIframes;
    K.addFlux(-10);
    if (opts.spin) { K.spinT = 0.6; K.speed *= 0.6; endDrift(false); }
    else { K.wobbleT = cfg.wobble; K.speed *= 0.85; }
    if (opts.knock) K.knockV += opts.knock / 0.3 * (opts.knockDir || -Math.sign(K.d || 1));
    G.cam.shake(0.35);
    G.post?.caPulse?.(0.008, 2.5); if (!G.fx) G.post?.flash?.('#ff2a3a', 0.25, 3);
    sfx('hit');
    G.emit('kart:hit', { amount, src: opts.src || '', hp: Math.max(0, K.hp) });
    if (K.hp <= 0) wreck();
    return 'hit';
  };
  K.perfectDash = () => G.emit('kart:perfect', {});
  G.on('kart:perfect', () => {
    if (st.dashPerfect || K.dashT <= 0) return;
    st.dashPerfect = true; K.stats.perfects++;
    if (st.dashPaid) K.addFlux(cfg.dashCost); else K.freeDash = true;
    K.addFlux(15, 'perfect'); K.dashCD = 0;
    G.time.slowmo(0.35, 0.3); K.overchargedT = 4;
    G.post?.flash?.('#33f6ff', 0.3, 4);
    callout('PERFECT', 'perfect'); sfx('perfect');
  });

  function wreck() {
    K.hp = 0; endDrift(false);
    if (K.credits > 0) { K.credits--; K.wrecked = true; st.wreckT = 1.5; }
    else { K.wrecked = true; K.wiped = true; st.wreckT = Infinity; }
    st.wreckSpin = 0;
    G.cam.shake(0.7); sfx('wreck');
    fbBurst(K.worldPos, 50, 1, 0.45, 0.2, 14);
    G.emit('kart:wreck', { credits: K.credits, wipe: K.wiped });
  }
  K.respawn = (s) => {
    const T = tr();
    K.s = T.wrap(s ?? K.s); K.d = 0; K.h = 0; K.vh = 0; K.psi = 0; K.slip = 0; K.airborne = false;
    K.hp = K.maxHp; K.invulnT = 2; K.wrecked = false; K.wiped = false; K.spinT = 0; K.wobbleT = 0; K.knockV = 0;
    K.flux = Math.max(0, K.flux - 20); K.speed = 20; endDrift(false);
    st.prevS = K.s; st.prevD = 0; st.prevH = 0; G.cam.snap();
    G.emit('kart:respawn', { credits: K.credits });
  };

  // ------------------------------------------------------------------
  // Reset: full = new fight; false = checkpoint retry
  // ------------------------------------------------------------------
  K.reset = (full = true) => {
    const T = tr();
    K.maxHp = cfg.hull + (K.mods.hull ? 30 : 0); K.hp = K.maxHp;
    K.flux = full ? (K.mods.hotstart ? 50 : 0) : 30; K.credits = cfg.credits;
    if (full) { K.lap = 0; for (const k in K.stats) K.stats[k] = 0; }
    K.s = T.wrap((T.lapGateS || 0) + 4); K.d = 0; K.h = 0; K.vh = 0; K.psi = 0; K.slip = 0; K.speed = 0;
    K.boostT = 0; K.boostAdd = 0; K.boosting = false; K.invulnT = 0; K.dashT = 0; K.dashCD = 0; K.freeDash = true; K.freeDashT = 0;
    K.overclockT = 0; K.overclockCD = 0; K.overchargedT = 0; K.brand = 0; K.wobbleT = 0; K.spinT = 0; K.item = null;
    K.wrecked = false; K.wiped = false; K.cometActive = false; K.airborne = false; K.knockV = 0; K.pullV = 0; K.zoneSlow = 1;
    endDrift(false); st.comet = null; G.cam.setCinematic(null);
    st.prevS = K.s; st.prevD = 0; st.prevH = 0; st.cleanLap = true; st.lastHitT = -99; st.rampAir = false; st.onRamp = null;
    boltQ.length = 0; ghostClear();
    G.cam.snap();
  };
  K.teleport = (s, d = 0) => { const T = tr(); K.s = T.wrap(s); K.d = d; K.h = 0; K.vh = 0; K.airborne = false; st.prevS = K.s; st.prevD = d; st.prevH = 0; st.onRamp = null; G.cam.snap(); };

  // Launch start (§4.9): UI calls startCountdown(secondsToGo) at "3".
  K.startCountdown = (sec = 3) => { K.frozen = true; st.countT = sec; st.launchOK = false; st.launchEarly = false; K.speed = 0; };

  // ------------------------------------------------------------------
  // Drift helpers
  // ------------------------------------------------------------------
  function startDrift(dir) {
    K.drifting = true; K.driftDir = dir; K.driftTier = 0; K.driftCharge = 0;
    st.dHold = clamp(K.d, -tr().halfDrive(K.s) + 2, tr().halfDrive(K.s) - 2);
    G.emit('kart:driftStart', { dir });
  }
  function endDrift(fire) {
    if (!K.drifting) { K.driftTier = 0; K.driftCharge = 0; return; }
    const tier = K.driftTier;
    K.drifting = false; K.driftDir = 0;
    if (fire) {
      if (tier >= 1) {
        const i = tier - 1;
        K.boost(cfg.turboAdd[i], cfg.turboDur[i], 'turbo');
        K.addFlux(cfg.releaseFlux[i], 'release');
        const nb = fireVolley(tier);
        K.stats.releases++;
        sfx('release', { pitch: 1 + i * 0.15 });
        G.emit('kart:release', { tier, bolts: nb });
        fbBurst(rearPos(V.e), 18, tier - 1, 0.35, 0.6, 9);
      } else { sfx('fizz'); st.fizzT = 0.2; G.fx?.burst?.('fizz', rearPos(V.e), {}); G.emit('kart:release', { tier: 0, bolts: 0 }); }
    }
    K.driftTier = 0; K.driftCharge = 0;
  }
  function dropTier() {
    if (!K.drifting || K.driftTier < 1) { K.driftCharge = Math.min(K.driftCharge, cfg.tierT[0] * 0.5); return; }
    K.driftTier--; K.driftCharge = K.driftTier ? cfg.tierT[K.driftTier - 1] : 0;
  }

  // ------------------------------------------------------------------
  // Spark Lance volleys (bolts via G.fx.bolt, local fallback tracers otherwise)
  // ------------------------------------------------------------------
  const boltQ = [];                         // pending bolts {t, tier, dmg, crit, first}
  const BOLT_POOL = [];
  for (let i = 0; i < 24; i++) {
    const slot = { busy: false, tier: 1, dmg: 0, crit: false, first: false, target: new THREE.Vector3(), targetId: null, from: new THREE.Vector3(), color: '#3fa9ff' };
    slot.get = () => { resolveTarget(slot); return slot.target; };
    slot.onHit = (pos) => boltHit(slot, pos);
    BOLT_POOL.push(slot);
  }
  function resolveTarget(slot) {
    let t = null;
    try { t = G.combat?.bestTarget?.(slot) ?? G.boss?.bestTarget?.(slot) ?? null; } catch (e) { t = null; }
    if (t && t.isVector3) { slot.target.copy(t); slot.targetId = null; return true; }
    if (t && t.node) { t.node.getWorldPosition(slot.target); slot.targetId = t.id || null; return true; }
    if (t && t.pos) { slot.target.copy(t.pos); slot.targetId = t.id || null; return true; }
    if (G.boss && G.boss.root) { G.boss.root.getWorldPosition(slot.target); slot.target.y += 8; slot.targetId = 'body'; return true; }
    // no boss: fly forward and fizzle
    slot.target.copy(K.worldPos).addScaledVector(K.camFwd, 60).addScaledVector(K.renderUp, 6); slot.targetId = null;
    return false;
  }
  function fireVolley(tier) {
    const i = tier - 1;
    let count = cfg.bolts[i] + (K.mods.storm ? 1 : 0);
    if (K.overclockT > 0) count = Math.ceil(count * 1.5);
    const now = G.time.now;
    for (let b = 0; b < count; b++) boltQ.push({ t: now + b * 0.04, tier, dmg: cfg.boltDmg[i], crit: false, first: b === 0 });
    if (tier === 3) boltQ.push({ t: now + count * 0.04, tier, dmg: cfg.critDmg, crit: true, first: false });
    if (tier === 3) G.cam.shake(0.15);
    return count + (tier === 3 ? 1 : 0);
  }
  function spawnBolt(q) {
    const slot = BOLT_POOL.find(s => !s.busy); if (!slot) return;
    slot.busy = true; slot.tier = q.tier; slot.dmg = q.dmg; slot.crit = q.crit; slot.first = q.first;
    slot.color = q.crit ? '#ffffff' : cfg.tierColor[q.tier - 1];
    rearPos(slot.from);
    const hasTarget = resolveTarget(slot);
    if (G.fx && G.fx.bolt) {
      try { G.fx.bolt(slot.from, slot.get, { color: slot.color, dmg: slot.dmg, speed: 90, delay: 0, tier: q.tier, crit: q.crit, onHit: hasTarget ? slot.onHit : null, onFizzle: () => { slot.busy = false; } }); }
      catch (e) { G.logError('fx.bolt', e); slot.busy = false; }
      // fx may not call onEnd: free the slot after max flight time
      slot.freeAt = G.time.now + 1.2;
    } else fbBolt(slot, hasTarget);
    sfx('bolt', { pitch: 1 + q.tier * 0.1 });
  }
  function boltHit(slot, pos) {
    slot.busy = false;
    const mult = K.overchargedT > 0 ? 1.5 : 1;
    const dmg = Math.round(slot.dmg * mult);
    const p = pos && pos.isVector3 ? pos : slot.target;
    try {
      if (G.combat && G.combat.damageBoss) G.combat.damageBoss(dmg, { source: 'bolt', tier: slot.tier, crit: slot.crit, pierce: slot.crit, interrupt: slot.crit, targetId: slot.targetId, pos: p });
      else if (G.boss && G.boss.damage) G.boss.damage(dmg, { source: 'bolt', tier: slot.tier, crit: slot.crit, targetId: slot.targetId, pos: p });
    } catch (e) { G.logError('boltHit', e); }
    if (slot.crit) { try { if (G.boss && G.boss.cast && G.boss.cast.interruptible && G.boss.interrupt && !G.combat?.handlesInterrupt) G.boss.interrupt('bolt'); } catch (e) { } }
    if (slot.first) {
      G.time.hitstop(cfg.hitstopMs[slot.tier - 1]);
      try { G.boss?.addStagger?.(cfg.volleyStagger[slot.tier - 1]); } catch (e) { }
      V.a.copy(p).sub(G.camera.position).normalize();
      G.cam.punch(V.a, 0.12);
    }
    G.fx?.burst?.('boltImpact', p, { color: slot.color });
    if (!G.fx) fbBurst(p, 14, slot.tier - 1, 0.4, 0.3, 12);
  }

  // ------------------------------------------------------------------
  // Comet (§4.4): launch -> orbit (slow-mo) -> dive -> impact -> return
  // ------------------------------------------------------------------
  const comet = { phase: '', t: 0, from: new THREE.Vector3(), apex: new THREE.Vector3(), target: new THREE.Vector3(), land: new THREE.Vector3(), pos: new THREE.Vector3(), targetId: 'core', twinT: -1, s0: 0 };
  const cometSlot = { target: new THREE.Vector3(), targetId: null };
  function startComet() {
    K.cometActive = true; K.flux = 0; endDrift(false); K.stats.comets++;
    comet.phase = 'launch'; comet.t = 0; comet.s0 = K.s; comet.twinT = -1; comet.a0 = undefined;
    comet.from.copy(K.worldPos);
    resolveTarget(cometSlot); comet.target.copy(cometSlot.target); comet.targetId = cometSlot.targetId || 'core';
    // apex: 12 m up and ahead along the travel direction
    comet.apex.copy(K.worldPos).addScaledVector(K.camFwd, 14).addScaledVector(K.renderUp, 12);
    G.emit('kart:comet', { phase: 'launch', dmg: 0 });
    sfx('comet'); G.cam.shake(0.3); G.post?.flash?.('#ffc93a', 0.25, 3);
    G.cam.setCinematic(cometCam);
  }
  function updateComet(dt) {
    comet.t += dt;
    const T = tr();
    if (comet.phase === 'launch') {
      const u = Math.min(1, comet.t / 0.25), e = 1 - (1 - u) * (1 - u);
      comet.pos.lerpVectors(comet.from, comet.apex, e);
      if (u >= 1) { comet.phase = 'orbit'; comet.t = 0; G.time.slowmo(0.3, 0.6); }
    } else if (comet.phase === 'orbit') {
      comet.pos.copy(comet.apex); comet.pos.y += Math.sin(comet.t * 20) * 0.05;
      resolveTarget(cometSlot); comet.target.copy(cometSlot.target);
      if (comet.t >= 0.18) { comet.phase = 'dive'; comet.t = 0; G.emit('kart:comet', { phase: 'dive', dmg: 0 }); }
    } else if (comet.phase === 'dive') {
      const u = Math.min(1, comet.t / 0.42), e = u * u * u;
      resolveTarget(cometSlot); comet.target.copy(cometSlot.target);
      // quadratic arc from apex to target with a lift control point
      V.a.lerpVectors(comet.apex, comet.target, 0.5); V.a.y += 10;
      comet.pos.copy(comet.apex).multiplyScalar((1 - e) * (1 - e)).addScaledVector(V.a, 2 * e * (1 - e)).addScaledVector(comet.target, e * e);
      if (u >= 1) { cometImpact(1); comet.phase = 'return'; comet.t = 0; T.toWorld(T.wrap(comet.s0 + 30), 0, 3, comet.land); comet.from.copy(comet.pos); }
    } else if (comet.phase === 'return') {
      if (comet.twinT >= 0) { comet.twinT -= dt; if (comet.twinT < 0) cometImpact(0.4); }
      const u = Math.min(1, comet.t / 0.55), e = u * u * (3 - 2 * u);
      T.toWorld(T.wrap(comet.s0 + 30), 0, 3, comet.land);
      V.a.lerpVectors(comet.from, comet.land, 0.5); V.a.y += 8;
      comet.pos.copy(comet.from).multiplyScalar((1 - e) * (1 - e)).addScaledVector(V.a, 2 * e * (1 - e)).addScaledVector(comet.land, e * e);
      if (u >= 1) {
        K.cometActive = false; comet.phase = '';
        K.s = T.wrap(comet.s0 + 30); K.d = 0; K.h = 3; K.vh = 0; K.airborne = true; K.psi = 0; K.speed = Math.max(K.speed, 30);
        st.prevS = K.s; st.prevD = 0; st.prevH = 3; st.rampAir = false;
        K.invulnT = Math.max(K.invulnT, 0.6);
        K.boost(16, 1.4, 'launch');
        G.cam.setCinematic(null); G.cam.snap();
      }
    }
    K.worldPos.copy(comet.pos);
    // keep track-space s moving so telegraph code sees sensible values
    K.s = T.wrap(comet.s0 + Math.min(30, (comet.phase === 'return' ? 15 + comet.t * 27 : comet.t * 10)));
  }
  function cometImpact(mult) {
    const dmg = Math.round(cfg.cometDmg * mult);
    try {
      if (G.combat && G.combat.damageBoss) G.combat.damageBoss(dmg, { source: 'comet', targetId: comet.targetId, pos: comet.target, tier: 3 });
      else if (G.boss && G.boss.damage) G.boss.damage(dmg, { source: 'comet', targetId: comet.targetId, pos: comet.target });
    } catch (e) { G.logError('cometImpact', e); }
    G.cam.shake(0.8); G.time.hitstop(120);
    if (!G.fx) { fbBurst(comet.target, 120, 3, 0.9, 0.6, 30); G.post?.flash?.('#ffe9a8', 0.7, 2.5); G.post?.bloomPulse?.(1.2, 1.5); }   // fx reacts to kart:comet itself
    G.post?.shockAt?.(comet.target, 0.9);
    if (mult === 1) { callout('COMET!', 'break'); if (K.mods.twin) comet.twinT = 0.35; }
    G.emit('kart:comet', { phase: 'impact', dmg });
  }
  // Comet camera: orbit (launch) and over-the-shoulder (dive). The camera is kept out of the boss:
  // at launch an orbit start angle with a clear view is chosen, and every frame the camera is pulled
  // in front of any boss geometry between it and the comet. The dive camera sits 3 m to the side of
  // the trail so the ribbon does not run up the middle of the frame.
  const camRay = new THREE.Raycaster(); const camHits = [];
  function occludedDist(from, to) {
    const root = G.boss && G.boss.root; if (!root || !root.visible) return Infinity;
    V.e.copy(to).sub(from); const len = V.e.length(); if (len < 0.5) return Infinity;
    camRay.set(from, V.e.multiplyScalar(1 / len)); camRay.near = 0.5; camRay.far = len;
    camHits.length = 0;
    try { camRay.intersectObject(root, true, camHits); } catch (e) { return Infinity; }
    for (const h of camHits) { if (!h.object.isMesh) continue; const m = h.object.material; if (m && (m.transparent || m.blending === THREE.AdditiveBlending)) continue; return h.distance; }
    return Infinity;
  }
  function orbitOffset(a, out) { out.copy(K.camFwd).applyAxisAngle(THREE.Object3D.DEFAULT_UP, a).multiplyScalar(-9); out.y += 2.5; return out; }
  function pickOrbitStart() {
    comet.a0 = 0.6;
    if (!G.boss || !G.boss.root) return;
    for (const a of [0.6, -0.6, 1.4, -1.4, 2.2, -2.2, 3.0]) {
      orbitOffset(a, V.c); V.d.copy(comet.apex).add(V.c);
      orbitOffset(a + 0.9, V.c); V.b.copy(comet.apex).add(V.c);           // and where the orbit ends
      if (occludedDist(comet.apex, V.d) === Infinity && occludedDist(comet.apex, V.b) === Infinity) { comet.a0 = a; return; }
    }
  }
  function cometCam(t, cam) {
    const p = comet.pos;
    if (comet.phase === 'launch' || comet.phase === 'orbit') {
      if (comet.a0 === undefined) pickOrbitStart();
      orbitOffset(t * 2.2 + comet.a0, V.c);
      cam.position.copy(p).add(V.c);
      V.d.lerpVectors(p, comet.target, 0.25);
    } else {
      V.c.copy(comet.target).sub(p); const dist = V.c.length(); V.c.normalize();
      V.b.crossVectors(V.c, THREE.Object3D.DEFAULT_UP); if (V.b.lengthSq() < 1e-4) V.b.set(1, 0, 0); V.b.normalize();
      cam.position.copy(p).addScaledVector(V.c, -7 - Math.min(6, dist * 0.05)).addScaledVector(V.b, 3); cam.position.y += 3;
      V.d.copy(comet.target);
    }
    const occ = occludedDist(p, cam.position);
    if (occ !== Infinity) { V.e.copy(cam.position).sub(p).normalize(); cam.position.copy(p).addScaledVector(V.e, Math.max(1.5, occ - 1)); }
    cam.up.set(0, 1, 0); cam.lookAt(V.d);
    // ~88 deg vertical, but cap the horizontal FOV at ~115 deg on wide phones
    const asp = cam.aspect || 1.78, fov = Math.min(88, 2 * Math.atan(Math.tan(57.5 * DEG) / asp) / DEG);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  // ------------------------------------------------------------------
  // Ghost recorder (10 Hz, 300 entries)
  // ------------------------------------------------------------------
  const GN = 300;
  const ghost = { s: new Float32Array(GN), d: new Float32Array(GN), lap: new Int32Array(GN), t: new Float32Array(GN), head: 0, count: 0, acc: 0 };
  const ghostRes = { s: 0, d: 0 };
  function ghostClear() { ghost.head = 0; ghost.count = 0; ghost.acc = 0; }
  G.ghosts = {
    record: ghost,
    sampleAgo(sec) {
      if (!ghost.count) { ghostRes.s = K.s; ghostRes.d = K.d; return ghostRes; }
      const target = G.time.now - sec;
      // walk back from newest
      let newer = (ghost.head - 1 + GN) % GN;
      if (ghost.t[newer] <= target) { ghostRes.s = ghost.s[newer]; ghostRes.d = ghost.d[newer]; return ghostRes; }
      for (let k = 1; k < ghost.count; k++) {
        const older = (ghost.head - 1 - k + GN * 2) % GN;
        if (ghost.t[older] <= target) {
          const span = ghost.t[newer] - ghost.t[older], f = span > 0 ? (target - ghost.t[older]) / span : 0;
          const T = tr(); ghostRes.s = T.wrap(ghost.s[older] + T.ds(ghost.s[older], ghost.s[newer]) * f);
          ghostRes.d = ghost.d[older] + (ghost.d[newer] - ghost.d[older]) * f; return ghostRes;
        }
        newer = older;
      }
      ghostRes.s = ghost.s[newer]; ghostRes.d = ghost.d[newer]; return ghostRes;
    },
  };
  function recordGhost(dt) {
    ghost.acc += dt; if (ghost.acc < 0.1) return; ghost.acc -= 0.1;
    const i = ghost.head; ghost.s[i] = K.s; ghost.d[i] = K.d; ghost.lap[i] = K.lap; ghost.t[i] = G.time.now;
    ghost.head = (i + 1) % GN; ghost.count = Math.min(GN, ghost.count + 1);
  }

  // ------------------------------------------------------------------
  // Bot autopilot (§4.10)
  // ------------------------------------------------------------------
  const bot = { lane: 0, laneT: 0, wantDrift: false, wantT: 0, dir: 0, driftCD: 0, dashCD: 0 };
  function threatAt(s0, s1, d, list) {
    const T = tr();
    for (let i = 0; i < list.length; i++) {
      const t = list[i]; if (!t || t.kind === 'gold' || t.kind === 'soak' || t.kind === 'safe') continue;
      if (t.shape === 'band' || t.s0 != null && t.s1 != null) {
        const a = T.ds(s0, t.s0 ?? t.s), b = T.ds(s0, t.s1 ?? t.s);
        if (b >= 0 && a <= s1 - s0 && d >= (t.d0 ?? -99) - 2 && d <= (t.d1 ?? 99) + 2) return t;
      } else {
        const r = (t.r || Math.max(t.len || 0, t.wid || 0) / 2 || 3) + 1.5;
        const x = T.ds(s0, t.s);
        if (x >= -r && x <= s1 - s0 + r && Math.abs(d - (t.d || 0)) < r) return t;
      }
    }
    return null;
  }
  function botControl(dt) {
    const T = tr();
    const hd = T.halfDrive(K.s);
    let teles = []; try { teles = G.tele?.list?.() || []; } catch (e) { }
    let zones = []; try { zones = G.zones?.list?.() || []; } catch (e) { }
    // Branded (Boss 2): steer for the cleanse pylon
    let pyl = null;
    if (K.brand > 0 && G.gates && G.gates.list) { try { for (const g of G.gates.list()) if (g && g.kind === 'pylon' && !g.passed && !g.dead) { const x = T.ds(K.s, g.s); if (x > -2) { pyl = g; pyl._x = x; break; } } } catch (e) { } }
    // Boss 1 arc gates: line up and keep the drift through them (K.botGates = false: ignore them, for balance tests)
    let arcG = null;
    if (K.botGates !== false && G.gates && G.gates.list) { try { for (const g of G.gates.list()) if (g && g.kind === 'arc' && !g.passed) { const x = T.ds(K.s, g.s); if (x > -2 && x < 170) { arcG = g; arcG._x = x; break; } } } catch (e) { } }
    // lane choice every 0.25 s
    bot.laneT -= dt;
    if (bot.laneT <= 0) {
      bot.laneT = 0.25;
      let best = bot.lane, bestScore = -1e9;
      for (const lane of [-1, 0, 1]) {
        const d = T.laneD(lane, K.s + 20);
        let score = lane === bot.lane ? 2 : 0;
        if (threatAt(K.s, K.s + 60, d, teles)) score -= 50;
        if (threatAt(K.s, K.s + 60, d, zones)) score -= 30;
        for (const p of T.pads) { const x = T.ds(K.s, p.s); if (x > 5 && x < 50 && p.lane === lane) score += 6; }
        if (pyl && pyl._x < 160) { const ld = T.laneD(lane, pyl.s); score += Math.max(0, 40 - Math.abs(ld - (pyl.d || 0)) * 10); }
        if (arcG) { const ld = T.laneD(lane, arcG.s); score += Math.max(0, 25 - Math.abs(ld - (arcG.d || 0)) * 8); }
        if (score > bestScore) { bestScore = score; best = lane; }
      }
      bot.lane = best;
    }
    let dT = clamp(T.laneD(bot.lane, K.s + 15), -hd + 0.5, hd - 0.5);
    if (pyl && pyl._x < 70) dT = clamp(pyl.d || 0, -hd + 0.5, hd - 0.5);
    if (arcG && arcG._x < 80) dT = clamp(arcG.d || 0, -hd + 0.5, hd - 0.5);
    const kAhead = T.curvature(K.s + 15), kNow = T.curvature(K.s);
    // steering: aim at target d with a lookahead, compensate curvature
    const look = Math.max(10, K.speed * 0.55);
    const psiDes = Math.atan2(dT - K.d, look);
    const yawDes = (psiDes - K.psi) * 4 - kNow * K.sdot;
    let drift = false;
    let steer;
    if (K.drifting) {
      const steerIn = clamp((yawDes * K.driftDir - cfg.driftYawBase) / cfg.driftYawRange, -1, 1);
      steer = steerIn * K.driftDir;
      drift = true;
      // release at T2+ when the curve ends, or at T3
      if (K.driftTier >= 3 || (K.driftTier >= 2 && Math.abs(kAhead) < 0.004)) drift = false;
      if (arcG && arcG._x < 60) drift = true;            // carry the charge through the gate
      if (Math.abs(kAhead) < 0.002 && K.driftTier < 2 && Math.abs(kNow) < 0.002) drift = false;
      if (pyl && pyl._x < 90 && Math.abs(dT - K.d) > 2) drift = false;   // line up for the pylon
      bot.wantDrift = false;
    } else {
      const ymax = lerp(cfg.yawLow, cfg.yawHigh, clamp(K.speed / cfg.vTop, 0, 1));
      steer = clamp(yawDes / ymax, -1, 1);
      // start a drift into an upcoming curve: hold the button (with steer) until the drift locks in
      if (!bot.wantDrift && !(pyl && pyl._x < 90) && !K.airborne && K.speed > cfg.driftMinSpeed + 2 && Math.abs(kAhead) > 0.006 && bot.driftCD <= 0) { bot.wantDrift = true; bot.wantT = 0; bot.dir = -Math.sign(kAhead); }
      if (bot.wantDrift) {
        bot.wantT += dt; drift = true;
        if (bot.wantT < 0.05) steer = bot.dir * 0.6;
        if (bot.wantT > 0.6) { bot.wantDrift = false; drift = false; bot.driftCD = 0.5; }
      }
    }
    bot.driftCD = (bot.driftCD || 0) - dt;
    // dash if a telegraph is about to resolve on us
    bot.dashCD -= dt;
    let dash = false;
    for (const t of teles) {
      if (!t || (t.state !== 'fill' && t.state !== 'flash') || (t.fill || 0) < 0.88) continue;
      if (t.kind === 'gold' || t.kind === 'soak') continue;
      if (threatAt(K.s - 3, K.s + 8, K.d, [t])) { dash = bot.dashCD <= 0; break; }
    }
    if (dash) { bot.dashCD = 1.2; steer = K.d > 0 ? -1 : 1; }
    ctl.steer = steer; ctl.steerRaw = steer; ctl.throttle = 1; ctl.brake = false; ctl.drift = drift;
    ctl.dash = dash; ctl.ability = K.cometReady(); ctl.item = !!K.item;
  }

  function readControls(dt) {
    if (K.bot) {
      botControl(dt);
      for (const a of ['drift', 'dash', 'ability', 'item']) { ctl.pressed[a] = ctl[a] && !botPrev[a]; ctl.released[a] = !ctl[a] && botPrev[a]; botPrev[a] = ctl[a]; }
      return;
    }
    const I = G.input; if (!I) return;
    ctl.steer = I.steer; ctl.steerRaw = I.steerRaw ?? I.steer; ctl.throttle = I.throttle; ctl.brake = I.brake; ctl.drift = I.drift;
    for (const a of ['drift', 'dash', 'ability', 'item']) { ctl.pressed[a] = I.pressed[a]; ctl.released[a] = I.released[a]; botPrev[a] = I[a]; }
  }

  // ------------------------------------------------------------------
  // Fixed-step update
  // ------------------------------------------------------------------
  function update(dt) {
    const T = tr(); if (!T || !T.built) return;
    st.prevS = K.s; st.prevD = K.d; st.prevH = K.h; st.prevYaw = st.yawVis;
    readControls(dt);
    st.tick++;
    fbUpdate(dt);
    // queued bolts
    for (let i = boltQ.length - 1; i >= 0; i--) if (boltQ[i].t <= G.time.now) { spawnBolt(boltQ[i]); boltQ.splice(i, 1); }
    for (const s of BOLT_POOL) if (s.busy && s.freeAt && G.time.now > s.freeAt && !s.fb) { s.busy = false; s.freeAt = 0; }

    if (K.frozen) { updateCountdown(dt); K.speed = 0; K.sdot = 0; K.ddot = 0; return; }
    if (K.wrecked) {
      st.wreckT -= dt; st.wreckSpin += dt; K.speed = Math.max(0, K.speed - 30 * dt);
      K.s = T.wrap(K.s + K.speed * dt);
      if (st.wreckT <= 0) K.respawn(K.s);
      return;
    }
    if (K.cometActive) { updateComet(dt); timers(dt); return; }

    timers(dt);
    if (st.sputterT > 0) st.sputterT -= dt;

    // ---- effective steer ----
    let steer = clamp(ctl.steer, -1, 1);
    if (Math.abs(steer) > 0.3) st.lastSteerDir = Math.sign(steer);
    if (K.spinT > 0) steer = 0;
    else if (K.wobbleT > 0) steer = steer * 0.4 + Math.sin(G.time.now * 40) * 0.25;

    // ---- drift / hop / trick input ----
    // A press with clear steer = instant short drift hop. Any other press = a full HOP right away
    // (so a tap always clears shockwaves); if the button is still held after HOLD_T it turns into a
    // drift (assist picks the direction, or the steer that arrived meanwhile) and the kart is pulled
    // down fast. A quick tap after a steered drift hop (tier 0, < TAP_T) is also converted to a full hop.
    const assist = G.input && G.input.driftAssist && !K.bot;
    const HOLD_T = 0.13, TAP_T = 0.16;
    // digital keys ramp the analog steer; decide on the intended direction (raw key target)
    const steerIntent = K.bot ? steer : (Math.abs(ctl.steerRaw) > Math.abs(steer) ? ctl.steerRaw : steer);
    if (ctl.pressed.drift && K.spinT <= 0) {
      if (K.airborne && st.rampAir) st.trickQueued = true;
      else if (!K.airborne && K.dashT <= 0) {
        st.pendingT = 0;
        if (Math.abs(steerIntent) > cfg.driftSteerMin && K.speed > cfg.driftMinSpeed) { hop(cfg.driftHopV, 1); st.pendingDrift = Math.sign(steerIntent); st.assistTap = 'drift'; }
        else {
          hop(cfg.hopV, 2); st.pendingDrift = 0;
          st.assistTap = K.speed > cfg.driftMinSpeed ? 'hop' : false;
        }
      }
    }
    if (st.assistTap) {
      st.pendingT += dt;
      if (st.assistTap === 'hop') {
        if (!ctl.drift) st.assistTap = false;                       // it was a tap: keep the full hop
        else if (st.pendingT >= HOLD_T) {
          st.assistTap = false;
          let dir = Math.abs(steerIntent) > cfg.driftSteerMin ? Math.sign(steerIntent) : 0;
          if (!dir && assist) { const ka = T.curvature(K.s + 20); dir = Math.abs(ka) > 0.004 ? -Math.sign(ka) : st.lastSteerDir; }
          if (dir && K.airborne && !st.rampAir && K.speed > cfg.driftMinSpeed - 4) {
            startDrift(dir); st.pendingDrift = 0;
            st.hopKind = 1; K.vh = Math.min(K.vh, 0);              // slam down into the drift
          }
          // no direction (keyboard, no steer yet): stays a hop; landing with drift+steer starts a drift
        }
      } else if (st.assistTap === 'drift') {
        if (ctl.released.drift && st.pendingT < TAP_T && K.driftTier === 0) {
          // quick tap while steering: it was meant as a hop
          st.assistTap = false; st.pendingDrift = 0;
          if (K.drifting) { K.drifting = false; K.driftDir = 0; K.driftCharge = 0; }
          if (K.airborne) { K.vh = Math.max(K.vh, cfg.hopV * 0.85); st.hopKind = 2; } else hop(cfg.hopV, 2);
        } else if (st.pendingT >= TAP_T) st.assistTap = false;
      }
    }
    if (st.pendingDrift && !ctl.drift && !K.drifting) st.pendingDrift = 0;
    // in a big hop, holding drift + steering at landing starts a drift
    if (ctl.released.drift && K.drifting && K.dashT <= 0) endDrift(true);

    // ---- abilities ----
    if (ctl.pressed.dash) tryDash(steer);
    if (ctl.pressed.ability) {
      if (K.cometReady()) startComet();
      else if (K.overclockCD <= 0 && K.overclockT <= 0 && K.flux >= cfg.overclockCost) {
        K.flux -= cfg.overclockCost; K.overclockT = cfg.overclockDur; K.overclockCD = cfg.overclockCD;
        sfx('overclock'); callout('OVERCLOCK', 'interrupt'); G.cam.kickFov(8, 0.6); G.post?.flash?.('#c04bff', 0.2, 3);
        G.emit('kart:overclock', { on: true });
      }
      if (K.cometActive) return;
    }
    if (ctl.pressed.item) { try { G.items?.use?.(); } catch (e) { G.logError('items.use', e); } }

    // ---- frame at s ----
    const f = T.frame(K.s, F1);
    const kap = f.kappa;
    const hd = f.w / 2 - 0.9;

    // ---- yaw ----
    let yawRate;
    const drifting = K.drifting && K.dashT <= 0;
    if (drifting) {
      let steerIn = steer * K.driftDir, chargeIn = steerIn;
      // digital keyboard steer (3 states) cannot hold a line through a real curve: drive a line-holding
      // controller instead, and let the keys move the held line in / out (charge still rewards steering in)
      const digital = !K.bot && G.input && G.input.device === 'keyboard' && G.input.inject && G.input.inject.steer == null && !assist;
      if (digital) {
        const hdD = T.halfDrive(K.s) - 1.6;
        st.dHold = clamp(st.dHold + steer * 7 * dt, -hdD, hdD);
        const psiDes = clamp((st.dHold - K.d) * 0.08, -0.32, 0.32);
        const yawDes = (psiDes - K.psi) * 3.2 - kap * K.sdot;
        steerIn = clamp((yawDes * K.driftDir - cfg.driftYawBase) / cfg.driftYawRange, -1, 1);
      } else if (assist && Math.abs(ctl.steer) < 0.15) {
        // drift assist: hold a line that follows the curve
        const psiDes = clamp((st.dHold - K.d) * 0.05, -0.3, 0.3) + K.driftDir * 0.08;
        const yawDes = (psiDes - K.psi) * 3 - kap * K.sdot;
        steerIn = clamp((yawDes * K.driftDir - cfg.driftYawBase) / cfg.driftYawRange, -1, 0.6);
        chargeIn = steerIn;
      }
      yawRate = K.driftDir * (cfg.driftYawBase + cfg.driftYawRange * steerIn);
      const slipT = K.driftDir * lerp(16, 42, (clamp(chargeIn, -1, 1) + 1) / 2) * DEG;
      K.slip += (slipT - K.slip) * Math.min(1, dt * 10);
      if (!K.airborne) chargeDrift(dt, chargeIn);
    } else {
      yawRate = lerp(cfg.yawLow, cfg.yawHigh, clamp(Math.abs(K.speed) / cfg.vTop, 0, 1)) * steer * (K.speed < 0 ? -1 : 1);
      if (K.speed < 4) yawRate *= Math.max(0, Math.abs(K.speed) / 4);
      K.slip += (steer * 4 * DEG - K.slip) * Math.min(1, dt * 8);
    }
    if (K.airborne && !(drifting && st.hopKind === 1)) yawRate *= 0.3;   // a drift that began in the hop keeps its yaw
    if (K.spinT > 0) K.slip += dt * 18;     // spin-out: visual pirouette
    else if (Math.abs(K.slip) > Math.PI) K.slip = Math.atan2(Math.sin(K.slip), Math.cos(K.slip));

    // ---- speed ----
    const supercell = K.flux >= 100 && !K.cometReady();
    let top = (cfg.vTop + (supercell ? 2 : 0)) * K.zoneSlow;
    if (drifting) top *= cfg.driftSpeedMult;
    if (st.sputterT > 0) top *= 0.35;
    K.boosting = K.boostT > 0 || K.dashT > 0;
    let target = top;
    if (K.boostT > 0) target = Math.min(top + K.boostAdd, cfg.vBoostCap);
    if (K.dashT > 0) target = Math.max(target, Math.min(top + cfg.dashAdd, cfg.vBoostCap));
    if (ctl.brake) {
      K.speed -= cfg.brake * dt; if (K.speed < -cfg.reverseMax) K.speed = -cfg.reverseMax;
    } else if (ctl.throttle > 0.05) {
      const tg = target * ctl.throttle;
      if (K.speed < tg) {
        const rate = K.boosting ? 7 : cfg.accel;
        K.speed += Math.max((tg - K.speed) * rate * dt, cfg.accelFloor * dt); if (K.speed > tg) K.speed = tg;
      } else K.speed = Math.max(tg, K.speed - cfg.boostDecay * dt);
    } else {
      K.speed -= Math.sign(K.speed) * Math.min(Math.abs(K.speed), cfg.coast * dt);
    }

    // ---- integrate heading + position ----
    const sdot = K.speed * Math.cos(K.psi) / Math.max(0.2, 1 + kap * K.d);
    let ddot = K.speed * Math.sin(K.psi);
    K.psi += yawRate * dt + kap * sdot * dt;
    if (!drifting && Math.abs(ctl.steer) < 0.05 && !K.airborne) K.psi *= (1 - cfg.autoAlign * dt);
    K.psi = clamp(K.psi, -1.3, 1.3);
    // lateral extras: dash shift, knock impulse, zone pull
    if (K.dashT > 0) { const u = 1 - K.dashT / cfg.dashDur; ddot += st.dashDir * cfg.dashShift * Math.PI / (2 * cfg.dashDur) * Math.sin(Math.PI * u); }
    if (K.knockV) { ddot += K.knockV; K.knockV *= Math.max(0, 1 - dt * 6); if (Math.abs(K.knockV) < 0.05) K.knockV = 0; }
    ddot += K.pullV;
    if (K.pullV && K.drifting && Math.sign(K.pullV) !== Math.sign(K.driftDir)) st.againstPull = true; else st.againstPull = false;
    K.sdot = sdot; K.ddot = ddot;
    const oldS = K.s;
    K.s = T.wrap(K.s + sdot * dt); K.d += ddot * dt;

    // ---- walls / rails ----
    if (st.wallHitCD > 0) st.wallHitCD -= dt;
    if (Math.abs(K.d) > hd) {
      const side = Math.sign(K.d); K.d = side * hd;
      const into = K.psi * side > 0;
      if (T.arena && T.arena.rail === 'energy') {
        if (st.railCD <= 0) { st.railCD = 1; K.takeHit(10, { src: 'rail' }); G.post?.flash?.('#3fa9ff', 0.25, 4); }
        K.psi = -K.psi * 0.5 - side * 0.15; K.knockV = -side * 8;
      } else if (into) {
        // drifting: a wall touch is a scrape up to 0.9 rad (no crash), which costs a little speed and
        // slows the charge so holding the racing line pays more than grinding the wall
        if (Math.abs(K.psi) < (K.drifting ? 0.9 : 0.52)) {
          K.psi *= 0.3; K.speed *= Math.pow(K.drifting ? 0.8 : 0.92, dt);
          if (K.drifting) { const floor = K.driftTier ? cfg.tierT[K.driftTier - 1] : 0; K.driftCharge = Math.max(floor, K.driftCharge - 0.6 * dt); st.dHold = clamp(st.dHold - side * 4 * dt, -hd, hd); }
          st.wallT = 0.1;
        } else {
          if (st.wallHitCD <= 0) {
            K.speed *= 0.7; st.wallHitCD = 0.5;
            if (!K.isInvuln() && !K.god && !G.params.god) { K.hp -= 4; st.lastHitT = G.time.now; st.cleanLap = false; if (K.hp <= 0) wreck(); }
            G.cam.shake(0.25); sfx('wall'); if (K.drifting) dropTier();
          }
          K.psi = -K.psi * 0.35;
        }
        wallSparks(side);
      }
    }
    if (st.railCD > 0) st.railCD -= dt;
    if (st.wallT > 0) st.wallT -= dt;

    // ---- vertical: ramps, gaps, air ----
    vertical(dt, oldS, f);

    // ---- pads ----
    if (st.padCD > 0) st.padCD -= dt;
    if (!K.airborne && K.h < 0.6) {
      const pad = T.padAt(K.s, K.d);
      if (pad && (pad !== st.lastPad || st.padCD <= 0)) {
        st.lastPad = pad; st.padCD = 0.6;
        K.boost(pad.add || cfg.padAdd, (pad.dur || cfg.padDur) * (K.overclockT > 0 ? 2 : 1), 'pad');
        K.addFlux(3, 'pad'); sfx('pad');
      } else if (!pad) st.lastPad = null;
    }

    // ---- laps ----
    const gs = T.lapGateS || 0;
    const a = T.ds(oldS, gs), b = T.ds(K.s, gs);
    if (a > 0 && b <= 0 && a < 30) {
      K.lap++;
      const clean = st.cleanLap; st.cleanLap = true;
      if (clean && K.lap > 1) { K.addFlux(15, 'cleanLap'); callout('CLEAN LAP', 'lap'); }
      G.emit('lap', { lap: K.lap, clean });
    } else if (a <= 0 && b > 0 && b < 30) K.lap--;

    // ---- hull regen ----
    const cap = K.maxHp * (K.mods.hull ? 0.75 : cfg.regenCap);
    if (G.time.now - st.lastHitT > cfg.regenDelay && K.hp < cap) K.hp = Math.min(cap, K.hp + cfg.regenRate * dt);

    // ---- flux while drifting ----
    if (K.drifting && !K.airborne) K.addFlux((K.driftTier >= 3 ? 6 : 4) * dt);
    st.supercell = supercell;

    recordGhost(dt);
    simPose();
    emitTrails(dt);
    try { G.audio?.engine?.update?.(K.speed, K.boosting, K.drifting ? Math.abs(K.slip) : 0); } catch (e) { }
    if (G.fx && G.fx.speedLines) { try { G.fx.speedLines(clamp((K.speed - 30) / 22, 0, 1)); } catch (e) { } }
  }

  function timers(dt) {
    if (K.boostT > 0) { K.boostT -= dt; if (K.boostT <= 0) { K.boostT = 0; K.boostAdd = 0; } }
    if (K.invulnT > 0) K.invulnT -= dt;
    if (st.invHitT > 0) st.invHitT -= dt;
    if (K.wobbleT > 0) K.wobbleT -= dt;
    if (K.spinT > 0) { K.spinT -= dt; if (K.spinT <= 0) K.slip = 0; }
    if (K.dashCD > 0) K.dashCD -= dt;
    if (K.overclockT > 0) { K.overclockT -= dt; if (K.overclockT <= 0) G.emit('kart:overclock', { on: false }); }
    if (K.overclockCD > 0) K.overclockCD -= dt;
    if (K.overchargedT > 0) K.overchargedT -= dt;
    if (st.fizzT > 0) st.fizzT -= dt;
    if (!K.freeDash) { K.freeDashT -= dt; if (K.freeDashT <= 0) K.freeDash = true; }
    if (K.dashT > 0) {
      K.dashT -= dt;
      if (K.dashT <= 0) {
        K.dashT = 0;
        // dash keeps the drift charge: resume if still held, otherwise fire it
        if (K.drifting && !ctl.drift) endDrift(true);
        else if (K.drifting) { const hdD = tr().halfDrive(K.s) - 2; st.dHold = clamp(K.d, -hdD, hdD); }   // resume holding the new line
      }
    }
    if (K.brand > 0) K.brand = Math.max(0, K.brand - dt);
  }

  function hop(v, kind) { K.vh = v; K.airborne = true; st.hopKind = kind; st.rampAir = false; st.airT = 0; st.squashV -= 3; }

  function chargeDrift(dt, steerIn) {
    let rate = 1;
    if (steerIn > 0.2) rate *= 1.35;
    if (K.overclockT > 0) rate *= 2;
    rate *= tr().driftMult(K.s);
    if (st.againstPull) rate *= 1.5;
    if (K.mods.capacitor) rate *= 1.15;
    K.driftCharge += dt * rate;
    const T3 = cfg.tierT;
    const newTier = K.driftCharge >= T3[2] ? 3 : K.driftCharge >= T3[1] ? 2 : K.driftCharge >= T3[0] ? 1 : 0;
    if (newTier > K.driftTier) {
      K.driftTier = newTier;
      G.emit('kart:tier', { tier: newTier }); sfx('tier' + newTier);
      G.cam.kickFov(1.5 + newTier, 0.25);
      fbBurst(rearPos(V.e), 10 + newTier * 6, newTier - 1, 0.3, 0.5, 8);
      if (newTier === 3) { callout('REDLINE', 'interrupt'); G.post?.caPulse?.(0.003, 3); }
    }
  }

  function tryDash(steer) {
    if (K.dashCD > 0 || K.dashT > 0 || K.wrecked) return;
    if (K.freeDash) { K.freeDash = false; K.freeDashT = cfg.dashFreeRegen; st.dashPaid = false; }
    else if (K.flux >= cfg.dashCost) { K.flux -= cfg.dashCost; st.dashPaid = true; }
    else return;
    K.dashT = cfg.dashDur; K.dashCD = cfg.dashCD; K.invulnT = Math.max(K.invulnT, cfg.dashInvuln);
    st.dashDir = Math.abs(steer) > 0.3 ? Math.sign(steer) : 0; st.dashPerfect = false;
    K.stats.dashes++;
    G.cam.kickFov(7, 0.35); G.cam.shake(0.1); sfx('dash');
    G.emit('kart:dash', {});
    ai.n = 0; ai.acc = 1;
  }

  function vertical(dt, oldS, f) {
    const T = tr();
    const ramp = T.rampAt(K.s, K.d);
    if (!K.airborne) {
      if (ramp && ramp.visual !== false) { K.h = T.rampHeight(ramp, K.s); st.onRamp = ramp; }
      else if (st.onRamp) {
        // left the ramp: launch
        const r = st.onRamp; st.onRamp = null;
        K.vh = r.kick; K.airborne = true; st.rampAir = true; st.airT = 0; st.hopKind = 0; K.h = r.h;
        G.cam.shake(0.06);
      } else if (ramp && ramp.visual === false) { K.vh = ramp.kick; K.airborne = true; st.rampAir = true; st.airT = 0; st.hopKind = 0; }
      else K.h = 0;
      if (!K.airborne && T.isGap(K.s)) { K.airborne = true; K.vh = 0; st.rampAir = false; st.hopKind = 0; st.airT = 0; }
    }
    if (K.airborne) {
      st.airT += dt;
      const g = st.hopKind === 1 ? 140 : st.hopKind === 2 ? 55 : cfg.gravity;   // tap hop apex ≈1.5 m, 0.47 s
      K.vh -= g * dt; K.h += K.vh * dt;
      const gap = T.isGap(K.s);
      const ground = ramp && ramp.visual !== false ? T.rampHeight(ramp, K.s) : 0;
      if (K.h <= ground && !gap && K.vh <= 0) land(ground);
      else if (gap && K.h < -4) fall();
    }
  }
  function land(ground) {
    const airT = st.airT;
    K.h = ground; K.airborne = false;
    st.squashV += Math.min(6, Math.abs(K.vh) * 0.35);
    K.vh = 0;
    if (st.rampAir && airT > 0.4) {
      G.cam.shake(0.1);
      if (st.trickQueued) { K.boost(cfg.trickAdd, cfg.trickDur, 'item'); callout('TRICK!', 'graze'); K.addFlux(3, 'trick'); }
    }
    st.trickQueued = false; st.rampAir = false;
    if (st.pendingDrift && ctl.drift) {
      const dir = st.pendingDrift; st.pendingDrift = 0;
      if (K.speed > cfg.driftMinSpeed - 4) startDrift(dir);
    } else if (st.hopKind === 2 && ctl.drift && Math.abs(ctl.steer) > cfg.driftSteerMin && K.speed > cfg.driftMinSpeed) startDrift(Math.sign(ctl.steer));
    st.pendingDrift = 0; st.hopKind = 0;
    if (airT > 0.25) { G.emit('kart:land', { airTime: +airT.toFixed(2) }); sfx('land'); fbBurst(K.worldPos, 8, -1, 0.3, 0.1, 4); }
  }
  function fall() {
    const T = tr();
    if (!K.god && !G.params.god) { K.hp -= 15; st.lastHitT = G.time.now; st.cleanLap = false; G.emit('kart:hit', { amount: 15, src: 'fall', hp: Math.max(0, K.hp) }); }
    G.cam.shake(0.3);
    if (K.hp <= 0) { K.s = T.wrap(K.s + 25); wreck(); return; }
    K.s = T.wrap(K.s + 25); K.d = 0; K.h = 0; K.vh = 0; K.psi = 0; K.airborne = false; K.speed = 28; K.invulnT = 1.5; endDrift(false);
    st.prevS = K.s; st.prevD = 0; st.prevH = 0; G.cam.snap();
    callout('FELL!', 'danger');
  }

  function updateCountdown(dt) {
    st.countT -= dt;
    const pressedGo = ctl.pressed.drift;
    if (pressedGo) {
      if (st.countT > 1.0) st.launchEarly = true;
      else if (st.countT > 0.5) st.launchOK = true;
    }
    if (st.countT <= 0) {
      K.frozen = false;
      if (st.launchOK && !st.launchEarly) { K.boost(14, 1.0, 'launch'); K.speed = 20; callout('PERFECT START', 'perfect'); }
      else if (st.launchEarly) st.sputterT = 0.5;
    }
  }

  // ------------------------------------------------------------------
  // Kart model (§4.11): body (standard), glow trims (basic), dynamic (shader)
  // ------------------------------------------------------------------
  const model = {};
  function colorize(geo, hex, mult = 1) {
    const c = new THREE.Color(hex).multiplyScalar(mult), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
  }
  function prep(geo) { if (geo.index) geo = geo.toNonIndexed(); for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color' && k !== 'aPart' && k !== 'aAng') geo.deleteAttribute(k); return geo; }
  function box(w, h, l, x, y, z, rx = 0) { const g = new THREE.BoxGeometry(w, h, l); if (rx) g.rotateX(rx); g.translate(x, y, z); return g; }
  function buildModel() {
    const merge = G.addons.BufferGeometryUtils.mergeGeometries;
    const root = new THREE.Group();
    // ---- body ----
    const prof = new THREE.Shape();
    const pts = [[-1.3, 0.24], [1.15, 0.2], [1.5, 0.3], [1.3, 0.42], [0.35, 0.6], [-0.55, 0.72], [-1.32, 0.66]];
    prof.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) prof.lineTo(pts[i][0], pts[i][1]);
    let chassis = new THREE.ExtrudeGeometry(prof, { depth: 1.04, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 1, curveSegments: 1 });
    chassis.rotateY(Math.PI / 2); chassis.translate(-0.52, 0, 0);
    const bodyParts = [
      colorize(prep(chassis), '#2a3f9a'),
      colorize(prep(box(0.34, 0.34, 1.7, 0.78, 0.4, 0.15)), '#22327a'), colorize(prep(box(0.34, 0.34, 1.7, -0.78, 0.4, 0.15)), '#22327a'),
      colorize(prep(box(0.14, 0.03, 1.25, 0.21, 0.815, -0.45, -0.22)), '#ff8a1f'), colorize(prep(box(0.14, 0.03, 1.25, -0.21, 0.815, -0.45, -0.22)), '#ff8a1f'),   // livery stripes
      colorize(prep(box(1.9, 0.07, 0.5, 0, 1.08, 1.18)), '#1a1030'),                 // rear wing
      colorize(prep(box(0.07, 0.38, 0.3, 0.55, 0.86, 1.15)), '#10162e'), colorize(prep(box(0.07, 0.38, 0.3, -0.55, 0.86, 1.15)), '#10162e'),
      colorize(prep(box(1.75, 0.05, 0.45, 0, 0.17, -1.35)), '#0b0f22'),               // splitter
      colorize(prep(new THREE.CapsuleGeometry(0.22, 0.26, 3, 8).translate(0, 0.98, 0.15)), '#e9eef8'),   // driver
      colorize(prep(new THREE.SphereGeometry(0.25, 10, 8).translate(0, 1.32, 0.08)), '#f4f7ff'),          // helmet
      colorize(prep(new THREE.CylinderGeometry(0.26, 0.3, 0.12, 10).rotateZ(Math.PI / 2).translate(0.86, 0.36, -0.95)), '#1c2030'),
      colorize(prep(new THREE.CylinderGeometry(0.26, 0.3, 0.12, 10).rotateZ(Math.PI / 2).translate(-0.86, 0.36, -0.95)), '#1c2030'),
      colorize(prep(new THREE.CylinderGeometry(0.26, 0.3, 0.12, 10).rotateZ(Math.PI / 2).translate(0.86, 0.36, 0.95)), '#1c2030'),
      colorize(prep(new THREE.CylinderGeometry(0.26, 0.3, 0.12, 10).rotateZ(Math.PI / 2).translate(-0.86, 0.36, 0.95)), '#1c2030'),
    ];
    const bodyGeo = merge(bodyParts); bodyGeo.computeVertexNormals();
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.32, envMapIntensity: 1.4 });
    // rim light so the silhouette reads against dark roads
    bodyMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(0.35, 0.65, 1.0) * pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 3.0) * 0.6;');
    };
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    // ---- glow trims ----
    const slope = Math.atan2(0.72 - 0.42, 1.3 + 0.55) ;
    const glowParts = [
      colorize(prep(box(0.05, 0.05, 1.9, 0.6, 0.6, -0.2, -slope * 0.55)), '#33f6ff', 2.4), colorize(prep(box(0.05, 0.05, 1.9, -0.6, 0.6, -0.2, -slope * 0.55)), '#33f6ff', 2.4),
      colorize(prep(box(0.36, 0.04, 1.5, 0.78, 0.585, 0.15)), '#ff3df2', 1.8), colorize(prep(box(0.36, 0.04, 1.5, -0.78, 0.585, 0.15)), '#ff3df2', 1.8),
      colorize(prep(box(1.9, 0.03, 0.06, 0, 1.12, 0.94)), '#33f6ff', 2.6),              // wing leading edge
      colorize(prep(box(1.7, 0.04, 0.05, 0, 0.2, -1.58)), '#33f6ff', 2.2),              // splitter edge
      colorize(prep(box(0.5, 0.06, 0.04, 0.5, 0.62, 1.4)), '#ff2a55', 3.2), colorize(prep(box(0.5, 0.06, 0.04, -0.5, 0.62, 1.4)), '#ff2a55', 3.2), // tail lights
      colorize(prep(new THREE.SphereGeometry(0.255, 10, 6, -0.9, 1.8, 1.2, 0.75).rotateY(Math.PI).translate(0, 1.32, 0.08)), '#33f6ff', 2.0), // visor
      colorize(prep(box(0.08, 0.025, 1.2, 0, 0.83, -0.45, -0.22)), '#ff3df2', 2.0),       // nose spine
    ];
    const glow = new THREE.Mesh(merge(glowParts), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }));
    // ---- dynamic: hover-wheel rings, arc coil, thruster flames ----
    const dynParts = [];
    const tag = (g, part, cy, cz) => {
      g = prep(g); const n = g.attributes.position.count, pa = new Float32Array(n).fill(part), an = new Float32Array(n), p = g.attributes.position.array;
      for (let i = 0; i < n; i++) an[i] = Math.atan2(p[i * 3 + 1] - cy, p[i * 3 + 2] - cz);
      g.setAttribute('aPart', new THREE.BufferAttribute(pa, 1)); g.setAttribute('aAng', new THREE.BufferAttribute(an, 1)); return g;
    };
    for (const [x, z] of [[0.9, -0.95], [-0.9, -0.95], [0.9, 0.95], [-0.9, 0.95]]) dynParts.push(tag(new THREE.TorusGeometry(0.36, 0.075, 5, 14).rotateY(Math.PI / 2).translate(x, 0.36, z), 0, 0.36, z));
    const coil = new THREE.TorusGeometry(0.34, 0.06, 5, 16).translate(0, 0.72, 1.48); dynParts.push(tag(coil, 1, 0.72, 1.48));
    for (const x of [0.38, -0.38]) { const c = new THREE.ConeGeometry(0.14, 1, 8, 1, true).rotateX(-Math.PI / 2).translate(x, 0.42, 1.38 + 0.5); dynParts.push(tag(c, 2, 0.42, 1.38)); }
    const dynMat = new THREE.ShaderMaterial({
      uniforms: { uSpin: { value: 0 }, uTier: { value: new THREE.Color('#33f6ff') }, uDrift: { value: 0 }, uCoil: { value: 0 }, uCoilCol: { value: new THREE.Color('#33f6ff') },
        uBoost: { value: 0 }, uTime: { value: 0 }, uFlameCol: { value: new THREE.Color('#5fd8ff') } },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`attribute float aPart, aAng; uniform float uBoost; varying float vPart, vAng, vZ; varying vec3 vN, vV;
        void main(){ vec3 p = position; vPart = aPart; vAng = aAng;
          if (aPart > 1.5) { float z0 = 1.38; vZ = clamp((p.z - z0), 0., 1.); p.z = z0 + (p.z - z0) * (0.25 + uBoost * 1.6); p.xy = mix(p.xy, vec2(sign(p.x) * .38, .42), 0.) ; }
          vec4 wp = modelMatrix * vec4(p, 1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */`uniform float uSpin, uDrift, uCoil, uBoost, uTime; uniform vec3 uTier, uCoilCol, uFlameCol; varying float vPart, vAng, vZ; varying vec3 vN, vV;
        void main(){ vec3 c;
          float fres = pow(1. - abs(dot(normalize(vN), vV)), 1.5);
          if (vPart < .5) {                    // wheel ring: spinning dashes
            float dash = step(.5, fract((vAng + uSpin) / 6.2832 * 6.));
            vec3 base = mix(vec3(.2, .9, 1.), uTier, uDrift);
            c = base * (.55 + dash * .9 + uDrift * 1.3) * (.6 + fres * .7);
          } else if (vPart < 1.5) {            // arc coil: flux-scaled
            float seg = .6 + .4 * step(.5, fract((vAng - uTime * 4.) / 6.2832 * 8.));
            c = uCoilCol * (.3 + uCoil * 1.0) * seg;
          } else {                             // thruster flame
            float a = (1. - vZ) * uBoost * 1.6;
            c = mix(vec3(1.), uFlameCol, vZ) * a * (2. + sin(uTime * 60.) * .3);
          }
          gl_FragColor = vec4(c, 1.); }`,
    });
    const dyn = new THREE.Mesh(merge(dynParts), dynMat);
    const inner = new THREE.Group(); inner.add(body, glow, dyn);
    root.add(inner);
    // blob shadow
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.6).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uA: { value: 0.6 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float d = length((vUv - .5) * 2.); gl_FragColor = vec4(0., 0., 0., uA * smoothstep(1., .2, d)); }',
    }));
    shadow.renderOrder = 1;
    // afterimages (Arc Dash): instanced copies of the body, additive cyan fresnel
    const after = new THREE.InstancedMesh(bodyGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN, vV; varying float vI; void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.); vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vI = float(gl_InstanceID); gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: 'varying vec3 vN, vV; varying float vI; void main(){ float f = pow(1. - abs(dot(normalize(vN), vV)), 2.); gl_FragColor = vec4(vec3(.2, .95, 1.) * (f * 1.6 + .12) * (1. - vI * .22), 1.); }',
    }), 4);
    after.count = 0; after.frustumCulled = false;
    G.scene.add(root, shadow, after);
    model.root = root; model.inner = inner; model.body = body; model.glow = glow; model.dyn = dyn; model.dynU = dynMat.uniforms;
    model.shadow = shadow; model.after = after;
    K.mesh = root;
  }

  // afterimage ring buffer
  const ai = { n: 0, acc: 0, pos: [0, 1, 2, 3].map(() => new THREE.Vector3()), quat: [0, 1, 2, 3].map(() => new THREE.Quaternion()) };

  // ------------------------------------------------------------------
  // Local fallback particles (only used when 04_fx.js is absent)
  // ------------------------------------------------------------------
  const FBN = 600;
  const fb = { pos: new Float32Array(FBN * 3), vel: new Float32Array(FBN * 3), col: new Float32Array(FBN * 3), life: new Float32Array(FBN), max: new Float32Array(FBN), size: new Float32Array(FBN), alpha: new Float32Array(FBN), next: 0, mesh: null, drag: new Float32Array(FBN), grav: new Float32Array(FBN) };
  const fbCols = [new THREE.Color('#3fa9ff'), new THREE.Color('#ff8a1f'), new THREE.Color('#c04bff'), new THREE.Color('#ffc93a'), new THREE.Color('#ffffff'), new THREE.Color('#5fd8ff'), new THREE.Color('#ffb070')];
  function buildFallbackFx() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(fb.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(fb.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(fb.size, 1)); geo.setAttribute('aAlpha', new THREE.BufferAttribute(fb.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 600 } },
      vertexShader: 'attribute float aSize, aAlpha; attribute vec3 color; uniform float uScale; varying vec3 vC; varying float vA; void main(){ vC = color; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = aSize * uScale / max(1., -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.; if (d > 1.) discard; gl_FragColor = vec4(vC * vA * (1. - d * d) * 2.5, 1.); }',
    });
    fb.mesh = new THREE.Points(geo, mat); fb.mesh.frustumCulled = false; G.scene.add(fb.mesh);
  }
  // spawn one particle: ci = color index (-1 = smoke grey)
  function fbSpawn(p, vx, vy, vz, ci, life, size, drag = 2, grav = 6) {
    if (!fb.mesh) return;
    const i = fb.next; fb.next = (i + 1) % FBN;
    fb.pos[i * 3] = p.x; fb.pos[i * 3 + 1] = p.y; fb.pos[i * 3 + 2] = p.z;
    fb.vel[i * 3] = vx; fb.vel[i * 3 + 1] = vy; fb.vel[i * 3 + 2] = vz;
    const c = ci < 0 ? fbCols[6] : fbCols[Math.min(ci, fbCols.length - 1)];
    const k = ci < 0 ? 0.12 : 1;
    fb.col[i * 3] = c.r * k; fb.col[i * 3 + 1] = c.g * k; fb.col[i * 3 + 2] = c.b * k;
    fb.life[i] = life; fb.max[i] = life; fb.size[i] = size; fb.alpha[i] = 1; fb.drag[i] = drag; fb.grav[i] = grav;
  }
  function fbBurst(p, count, ci, life, size, spd) {
    if (G.fx || !fb.mesh) return;
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u), s = spd * (0.3 + Math.random() * 0.7);
      fbSpawn(p, r * Math.cos(a) * s, Math.abs(u) * s * 0.8 + 1, r * Math.sin(a) * s, ci < 0 ? 4 : ci, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8));
    }
  }
  function fbUpdate(dt) {
    if (!fb.mesh) return;
    for (let i = 0; i < FBN; i++) {
      if (fb.life[i] <= 0) { if (fb.size[i] !== 0) { fb.size[i] = 0; fb.alpha[i] = 0; } continue; }
      fb.life[i] -= dt;
      const k = Math.max(0, 1 - fb.drag[i] * dt);
      fb.vel[i * 3] *= k; fb.vel[i * 3 + 1] = fb.vel[i * 3 + 1] * k - fb.grav[i] * dt; fb.vel[i * 3 + 2] *= k;
      fb.pos[i * 3] += fb.vel[i * 3] * dt; fb.pos[i * 3 + 1] += fb.vel[i * 3 + 1] * dt; fb.pos[i * 3 + 2] += fb.vel[i * 3 + 2] * dt;
      fb.alpha[i] = Math.max(0, fb.life[i] / fb.max[i]);
    }
    const g = fb.mesh.geometry.attributes;
    g.position.needsUpdate = true; g.color.needsUpdate = true; g.aSize.needsUpdate = true; g.aAlpha.needsUpdate = true;
  }
  // fallback bolt: a glowing head flying a homing arc, dropping trail particles
  const fbBolts = [];
  function fbBolt(slot, hasTarget) {
    slot.fb = true;
    const b = fbBolts.find(x => !x.on) || (fbBolts.length < 24 ? (fbBolts.push({ on: false, p: new THREE.Vector3(), c: new THREE.Vector3(), t: 0, dur: 0 }), fbBolts[fbBolts.length - 1]) : null);
    if (!b) { slot.busy = false; slot.fb = false; return; }
    b.on = true; b.slot = slot; b.t = 0; b.hasTarget = hasTarget;
    b.p.copy(slot.from);
    const dist = slot.from.distanceTo(slot.target); b.dur = clamp(dist / 90, 0.3, 0.8);
    // control point: up and sideways for a nice arc
    b.c.copy(slot.from).lerp(slot.target, 0.35); b.c.y += 6 + Math.random() * 6; b.c.addScaledVector(K.renderUp, 0).x += (Math.random() - 0.5) * 14;
    b.from = b.from || new THREE.Vector3(); b.from.copy(slot.from);
  }
  function fbBoltsUpdate(dt) {
    for (const b of fbBolts) {
      if (!b.on) continue;
      b.t += dt; const u = Math.min(1, b.t / b.dur);
      b.slot.get();
      const tgt = b.slot.target;
      b.p.copy(b.from).multiplyScalar((1 - u) * (1 - u)).addScaledVector(b.c, 2 * u * (1 - u)).addScaledVector(tgt, u * u);
      const ci = b.slot.crit ? 4 : b.slot.tier - 1;
      for (let k = 0; k < 3; k++) fbSpawn(b.p, (Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2, ci, 0.22, k === 0 ? 0.9 : 0.45, 4, 0);
      if (u >= 1) { b.on = false; b.slot.fb = false; if (b.hasTarget) b.slot.onHit(tgt); else { b.slot.busy = false; fbBurst(b.p, 8, ci, 0.3, 0.3, 5); } }
    }
  }

  // ------------------------------------------------------------------
  // Trails: drift sparks, smoke, boost flames, wall sparks (G.fx first)
  // ------------------------------------------------------------------
  function rearPos(out) { return out.copy(K.worldPos).addScaledVector(V.fwd, -1.45).addScaledVector(V.up, 0.72); }
  function wheelPos(out, side) { return out.copy(K.worldPos).addScaledVector(V.fwd, -0.95).addScaledVector(V.right, side * 0.9).addScaledVector(V.up, 0.12); }
  function wallSparks(side) {
    V.b.copy(K.worldPos).addScaledVector(V.right, side * 1.0).addScaledVector(V.up, 0.3);
    V.c.copy(V.fwd).multiplyScalar(-1).addScaledVector(V.right, -side * 0.5);
    kv.copy(V.fwd).multiplyScalar(K.speed);
    if (G.fx && G.fx.emit) { pOpts.color = '#ffd38a'; pOpts.tier = 0; pOpts.scale = 1; pOpts.key = 'ws'; pOpts.spread = 0.3; pOpts.speed = inherit(V.a, V.c, 10, 0.75, 12); try { G.fx.emit('wallSpark', V.b, V.a, 0.5, pOpts); } catch (e) { } }
    else for (let i = 0; i < 2; i++) { inherit(V.a, V.c, 12, 0.75, 1); fbSpawn(V.b, V.a.x + (Math.random() - .5) * 5, 2 + Math.random() * 4, V.a.z + (Math.random() - .5) * 5, 6, 0.35, 0.25, 1, 18); }
  }
  // non-interpolated pose for sim-side emitters (render() later overwrites with the interpolated one)
  function simPose() {
    const f = tr().frame(K.s, F1), yaw = K.psi + K.slip;
    V.up.copy(f.n);
    V.fwd.copy(f.t).multiplyScalar(Math.cos(yaw)).addScaledVector(f.r, Math.sin(yaw));
    V.right.crossVectors(V.fwd, V.up).normalize();
    K.worldPos.copy(f.p).addScaledVector(f.r, K.d).addScaledVector(f.n, K.h);
  }
  // particles inherit most of the kart velocity so they stay visible around it
  const pOpts = { color: '#ffffff', tier: 0, scale: 1, key: '', speed: 1, spread: 0.12 };
  // pre-dimmed colours: fx multiplies by the preset glow (3.2 sparks / 1.6 flame); keep the kart's own trail ~1.2-1.4 HDR
  const sparkCols = [...cfg.tierColor, '#bfe8ff'].map(c => new THREE.Color(c).multiplyScalar(0.42));
  const flameCols = ['#5fd8ff', '#c04bff'].map(c => new THREE.Color(c).multiplyScalar(0.75));
  const kv = new THREE.Vector3();
  function inherit(out, spray, sprayMag, keep, base) {
    // out = kartVel*keep + spray*sprayMag ; returns |out| / base  (fx speed multiplier)
    out.copy(kv).multiplyScalar(keep).addScaledVector(spray, sprayMag);
    return out.length() / base;
  }
  function emitTrails(dt) {
    kv.copy(V.fwd).multiplyScalar(K.speed);
    if (K.airborne && !K.drifting && !K.boosting) return;
    // drift sparks: 40/s per rear wheel in tier colour (pre-T1: small white-blue)
    if (K.drifting && !K.airborne) {
      st.sparkAcc += dt * (K.driftTier ? 40 : 16);
      const ci = K.driftTier ? K.driftTier - 1 : 4;
      const col = K.driftTier ? cfg.tierColor[K.driftTier - 1] : '#bfe8ff';
      while (st.sparkAcc >= 1) {
        st.sparkAcc -= 1;
        for (const side of [-1, 1]) {
          wheelPos(V.b, side);
          V.d.copy(V.fwd).multiplyScalar(-1).addScaledVector(V.right, side * 0.7 - K.driftDir * 0.4).addScaledVector(V.up, 0.9).normalize();
          if (G.fx && G.fx.emit) {
            pOpts.color = sparkCols[K.driftTier ? K.driftTier - 1 : 3]; pOpts.tier = K.driftTier; pOpts.scale = K.driftTier >= 3 ? 1.05 : 0.85; pOpts.key = side > 0 ? 'dsR' : 'dsL';
            pOpts.spread = 0.14; pOpts.speed = inherit(V.c, V.d, 7 + Math.random() * 5, 0.88, 10) / pOpts.scale;
            try { G.fx.emit('driftSpark', V.b, V.c, 1.3, pOpts); } catch (e) { }
          } else { inherit(V.c, V.d, 6 + Math.random() * 8, 0.88, 1); fbSpawn(V.b, V.c.x + (Math.random() - .5) * 3, V.c.y, V.c.z + (Math.random() - .5) * 3, ci, 0.28 + Math.random() * 0.2, K.driftTier >= 3 ? 0.32 : 0.24, 1.5, 22); }
        }
      }
      st.smokeAcc += dt * 6;
      while (st.smokeAcc >= 1) {
        st.smokeAcc -= 1; wheelPos(V.b, -K.driftDir);
        if (G.fx && G.fx.emit) { try { G.fx.emit('tireSmoke', V.b, V.up, 1, null); } catch (e) { } }
        else fbSpawn(V.b, (Math.random() - .5) * 2, 1.5, (Math.random() - .5) * 2, -1, 0.7, 1.4, 1, -1);
      }
    }
    // boost flames
    if (K.boosting) {
      st.flameAcc += dt * 50;
      while (st.flameAcc >= 1) {
        st.flameAcc -= 1;
        for (const side of [-1, 1]) {
          V.b.copy(K.worldPos).addScaledVector(V.fwd, -1.6).addScaledVector(V.right, side * 0.38).addScaledVector(V.up, 0.42);
          V.d.copy(V.fwd).multiplyScalar(-1);
          if (G.fx && G.fx.emit) {
            pOpts.color = K.overclockT > 0 ? flameCols[1] : flameCols[0]; pOpts.tier = 0; pOpts.scale = 0.75; pOpts.key = side > 0 ? 'bfR' : 'bfL';
            pOpts.spread = 0.08; pOpts.speed = inherit(V.c, V.d, 12, 0.8, 12);
            try { G.fx.emit('boostFlame', V.b, V.c, 1, pOpts); } catch (e) { }
          } else { inherit(V.c, V.d, 10, 0.8, 1); fbSpawn(V.b, V.c.x + (Math.random() - .5) * 2, V.c.y + (Math.random() - .5) * 2, V.c.z + (Math.random() - .5) * 2, K.overclockT > 0 ? 2 : 5, 0.18, 0.5, 3, 0); }
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Render (interpolated)
  // ------------------------------------------------------------------
  function render(alpha, rdt) {
    const T = tr(); if (!T || !T.built || !model.root) return;
    rdt = rdt || 0.016;
    fbBoltsUpdate(G.time.paused ? 0 : rdt * G.time.effectiveScale());
    const s = K.cometActive ? K.s : T.wrap(st.prevS + T.ds(st.prevS, K.s) * alpha);
    const d = lerp(st.prevD, K.d, alpha), h = lerp(st.prevH, K.h, alpha);
    const f = T.frame(s, F2);
    // heading (track frame rotated by psi), body yaw adds slip
    const yaw = K.psi + K.slip;
    V.up.copy(f.n);
    if (K.cometActive) {
      V.fwd.copy(comet.target).sub(comet.pos).normalize();
      if (comet.phase === 'return') V.fwd.copy(comet.land).sub(comet.pos).normalize();
      V.up.set(0, 1, 0);
    } else {
      V.fwd.copy(f.t).multiplyScalar(Math.cos(yaw)).addScaledVector(f.r, Math.sin(yaw));
      K.worldPos.copy(f.p).addScaledVector(f.r, d).addScaledVector(f.n, h);
    }
    V.right.crossVectors(V.fwd, V.up).normalize(); V.up.crossVectors(V.right, V.fwd).normalize();
    V.c.copy(V.fwd).negate();
    V.m.makeBasis(V.right, V.up, V.c); K.worldQuat.setFromRotationMatrix(V.m);
    model.root.position.copy(K.worldPos); model.root.quaternion.copy(K.worldQuat);
    // body dynamics: lean, pitch, squash/stretch, spin, wreck tumble
    const steerVis = K.drifting ? K.driftDir * 0.6 : (ctl.steer || 0);
    st.lean += (-steerVis * clamp(K.speed / 36, 0, 1) * 0.16 - st.lean) * Math.min(1, rdt * 8);
    const pitchT = K.airborne ? clamp(-K.vh * 0.02, -0.25, 0.25) : (K.boosting ? -0.04 : 0);
    st.pitch += (pitchT - st.pitch) * Math.min(1, rdt * 6);
    st.squashV += -st.squash * 220 * rdt - st.squashV * 14 * rdt; st.squash += st.squashV * rdt;
    st.squash = clamp(st.squash, -0.35, 0.35);
    const sy = 1 - st.squash, sxz = 1 + st.squash * 0.5;
    model.inner.scale.set(sxz, sy, sxz);
    const hover = K.airborne ? 0 : Math.sin(G.time.now * 9) * 0.025;
    model.inner.position.set(0, 0.05 + hover, 0);
    model.inner.rotation.set(st.pitch, 0, st.lean);
    if (K.wrecked) { model.inner.rotation.set(st.wreckSpin * 7, st.wreckSpin * 3, st.wreckSpin * 5); model.inner.position.y = 0.6 + Math.sin(Math.min(1, st.wreckSpin) * Math.PI) * 2.5; }
    // blink during hit i-frames
    model.inner.visible = !(st.invHitT > 0 && Math.floor(G.time.real * 18) % 2 === 0) || K.dashT > 0;
    model.root.visible = !(K.wrecked && st.wreckT < 0.5 && st.wreckT > 0);
    // blob shadow on the ground
    if (!K.cometActive) {
      model.shadow.visible = !T.isGap(s);
      model.shadow.position.copy(f.p).addScaledVector(f.r, d).addScaledVector(f.n, 0.04);
      V.a.copy(f.t).multiplyScalar(Math.cos(yaw)).addScaledVector(f.r, Math.sin(yaw)).negate();
      V.b.crossVectors(V.a, f.n).negate(); V.m.makeBasis(V.b, f.n, V.a); model.shadow.quaternion.setFromRotationMatrix(V.m);
      const sc = 1 / (1 + h * 0.35); model.shadow.scale.setScalar(sc); model.shadow.material.uniforms.uA.value = 0.65 * sc;
    } else model.shadow.visible = false;
    // dynamic uniforms
    const U = model.dynU;
    U.uSpin.value += (K.speed / 0.36) * rdt * G.time.effectiveScale();
    U.uTime.value = G.time.now;
    const tierCol = K.driftTier ? tierColors[K.driftTier - 1] : tierColors[0];
    U.uTier.value.copy(tierCol);
    U.uDrift.value += ((K.drifting ? (K.driftTier ? 1 : 0.35) : 0) - U.uDrift.value) * Math.min(1, rdt * 10);
    U.uCoil.value = K.flux / 100;
    if (K.flux >= 100) U.uCoilCol.value.setRGB(1.4, 1.15, 0.6); else U.uCoilCol.value.set(K.overchargedT > 0 ? '#c04bff' : '#33f6ff');
    const bt = K.boosting ? 1 : (K.speed > 30 ? 0.18 : 0.06);
    U.uBoost.value += (bt - U.uBoost.value) * Math.min(1, rdt * 10);
    U.uFlameCol.value.set(K.overclockT > 0 ? '#c04bff' : '#5fd8ff');
    // afterimages during Arc Dash
    if (K.dashT > 0) {
      ai.acc += rdt;
      if (ai.acc > 0.04) { ai.acc = 0; for (let i = 3; i > 0; i--) { ai.pos[i].copy(ai.pos[i - 1]); ai.quat[i].copy(ai.quat[i - 1]); } ai.pos[0].copy(K.worldPos); ai.quat[0].copy(K.worldQuat); ai.n = Math.min(4, ai.n + 1); }
      for (let i = 0; i < ai.n; i++) model.after.setMatrixAt(i, V.m.compose(ai.pos[i], ai.quat[i], V.s.set(1, 1, 1)));
      model.after.count = ai.n; model.after.instanceMatrix.needsUpdate = true;
    } else if (model.after.count) { ai.n = Math.max(0, ai.n - 1); model.after.count = ai.n; }
    // camera hooks
    K.renderPos.copy(K.worldPos);
    K.renderUp.copy(K.cometActive ? THREE.Object3D.DEFAULT_UP : f.n);
    const camYaw = K.drifting ? K.psi * 0.7 : K.psi * 0.85;
    K.camFwd.copy(f.t).multiplyScalar(Math.cos(camYaw)).addScaledVector(f.r, Math.sin(camYaw));
    if (K.boosting && K.speed > 40) G.cam.trauma = Math.max(G.cam.trauma, 0.16);
  }

  G.register('kart', {
    init() {
      buildModel();
      if (!G.fx) buildFallbackFx();
      K.reset(true);
    },
    update, render, reset: (full) => K.reset(full !== false),
  });
}
