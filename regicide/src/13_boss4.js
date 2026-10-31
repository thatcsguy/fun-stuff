// =====================================================================
// 13_boss4.js: COURT IV, THE COURT OF STORMS. THESSALY, the Ashen Archon.
//
// A gaunt archon in a robe of ash and lightning, floating a hand above the basalt, a halo of crackling rods behind her
// head and a staff whose tip never stops glowing. She does not walk: she blinks across the arena in a thunderclap.
//
// Phase 1 "Stormcall"      lightning markers that chase you in chains, chain lightning between the storm rods (adds,
//                          kill one and its lines die with it), the roaming Tempest orb, the gold Lightning Wall with a
//                          blue gap, and Tempest (interruptible: raid damage + knockback + a storm of markers).
// Phase 2 "Eye of the Storm" + the Eye (blue disc under her: stand close) alternating with Stormburst (ring: stand far),
//                          two rotating storm beams from her staff at the centre, four rods, two chains per pulse.
// Phase 3 "Ashfall"        everything faster: rods in a square, markers become rings around you (standing still is
//                          safe), Thunderclap (heavy blockable: the Riposte window), two orbs, and Cataclysm.
// =====================================================================
(() => {
  const T3 = G.THREE || THREE, PI = Math.PI, TAU = PI * 2;
  const V = T3.Vector3;
  const ACC = '#b77bff', BOLT = '#dcccff', HOT = '#f4ecff', ASH = '#6c6474', GOLD = '#ffd36b';
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const world = (name, ...a) => { try { const f = G.world && G.world[name]; return f ? f.apply(G.world, a) : undefined; } catch (e) { /* world may still be forging */ } };
  const fx = (name, ...a) => { try { const f = G.fx && G.fx[name]; return f ? f.apply(G.fx, a) : undefined; } catch (e) { /* */ } };
  const sfx = (name, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(name, o); } catch (e) { /* */ } };
  const cam = (name, ...a) => { try { const f = G.cam && G.cam[name]; return f ? f.apply(G.cam, a) : undefined; } catch (e) { /* */ } };
  const arenaR = () => (G.world && G.world.arenaR != null) ? G.world.arenaR : (G.ARENA_R || 13);
  const tmpW = new V();
  // world position of a model part, in fx-layer space (where lances and lightning live)
  const fxPos = (obj, out = new V()) => { obj.getWorldPosition(out); try { (G.layers && G.layers.fx || G.scene).worldToLocal(out); } catch (e) { /* */ } return out; };

  // ------------------------------------------------------------------ fx helpers
  function strikeFx(x, z, big) {
    const top = new V(x + (Math.random() - 0.5) * 2.5, 15, z + (Math.random() - 0.5) * 2.5), bot = new V(x, 0.25, z);
    fx('lightning', top, bot, { color: BOLT, width: big ? 0.42 : 0.26, life: big ? 0.32 : 0.22, segments: 12, jag: 0.05 });
    if (big) fx('lightning', new V(x + (Math.random() - 0.5) * 3, 15, z + (Math.random() - 0.5) * 3), bot, { color: HOT, width: 0.2, life: 0.18, segments: 10, jag: 0.08 });
    fx('flash', '#cbb8ff', big ? 0.16 : 0.07, 0.2);
    cam('shake', big ? 0.35 : 0.12, 0.25);
    if (big) { world('lightning', BOLT); world('rimGlow', ACC, 0.8, 0.5); sfx('thunder', { vol: 0.5 }); }
  }
  function arc(a, b, o = {}) { fx('lightning', a, b, Object.assign({ color: BOLT, width: 0.14, life: 0.16, segments: 7, jag: 0.1 }, o)); }

  // ------------------------------------------------------------------ the blink: a thunderclap teleport
  async function blink(b, x, z) {
    if (x == null) {
      const p = b.playerPos();
      for (let i = 0; i < 24; i++) {
        const th = b.randRange(-PI, PI), r = b.randRange(2.0, Math.min(7.0, arenaR() - 2.5));
        const q = G.polar(r, th, 0);
        let nearRod = false; for (const s of (b.data.slots || [])) if (Math.hypot(q.x - s.x, q.z - s.z) < 2.0) nearRod = true;
        const dp = Math.hypot(q.x - p.x, q.z - p.z);
        if ((dp >= 3.8 && dp <= 6.4 && !nearRod) || i === 11) { x = q.x; z = q.z; break; }
      }
    }
    const d = b.data; const ox = b.pos.x, oz = b.pos.z;
    // leave: a column up from where she was
    fx('burst', new V(ox, 1.6, oz), { color: ASH, count: 18, speed: 2.5, size: 0.3, life: 0.8, gravity: -0.4, flare: false });
    fx('lightning', new V(ox, 0.4, oz), new V(ox, 14, oz), { color: BOLT, width: 0.22, life: 0.2, segments: 9, jag: 0.05 });
    b.teleport(x, z);
    d.blinkT = 1;
    strikeFx(x, z, true);
    fx('shockwave', new V(x, 0.1, z), { color: ACC, radius: 3.2, life: 0.4, intensity: 1.2 });
    await b.wait(0.45);
  }

  // ------------------------------------------------------------------ lightning markers: the basic dodge
  async function markerChain(b, n, o = {}) {
    const warn = o.warn != null ? o.warn : 1.3, gap = o.gap != null ? o.gap : 0.42;
    for (let i = 0; i < n; i++) {
      b.hz.circle({ r: 1.6, warn, dmg: o.dmg || 20, follow: 'player', label: o.label || 'Lightning Marker', onFire: (h) => strikeFx(h.hazard.x, h.hazard.z, false) });
      await b.wait(gap);
    }
    await b.wait(warn + 0.1);
  }
  const side = (p) => Promise.resolve(p).catch(() => {});   // a concurrent chain: Abort is handled by the main await
  // phase 3 twist: rings around the player; stand still
  async function ashRings(b, n, o = {}) {
    const warn = o.warn != null ? o.warn : 1.15, gap = o.gap != null ? o.gap : 0.45;
    for (let i = 0; i < n; i++) {
      const p = b.playerPos();
      b.hz.ring({ x: p.x, z: p.z, r0: 1.2, r1: 3.6, warn, dmg: 22, label: 'Ash Ring', onFire: (h) => { for (let k = 0; k < 3; k++) { const q = G.polar(2.4, b.randRange(-PI, PI), 0); strikeFx(h.hazard.x + q.x, h.hazard.z + q.z, false); } } });
      await b.wait(gap);
    }
    await b.wait(warn + 0.1);
  }

  // ------------------------------------------------------------------ the storm rods (adds) and chain lightning
  function rodModel(group, add) {
    const base = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.68, 0.4, 8), G.mat.brass({ color: '#2a2630', metalness: 0.5, roughness: 0.7 })); base.position.y = 0.18; group.add(base);
    const rod = new T3.Mesh(new T3.CylinderGeometry(0.09, 0.14, 3.4, 8), G.mat.brass({ color: '#c9963f', metalness: 0.9, roughness: 0.3, emissive: '#3a1a66', emissiveIntensity: 0.5 })); rod.position.y = 2.0; group.add(rod);
    for (let i = 0; i < 3; i++) { const ring = new T3.Mesh(new T3.TorusGeometry(0.21, 0.035, 6, 14), G.mat.brass()); ring.rotation.x = PI / 2; ring.position.y = 0.8 + i * 1.0; group.add(ring); }
    const tip = new T3.Mesh(new T3.OctahedronGeometry(0.3, 0), G.mat.emissive(ACC, 1.6)); tip.position.y = 3.9; group.add(tip);
    const glow = G.mat.glowSprite(ACC, 1.8, { intensity: 0.5, opacity: 0.8 }); glow.position.y = 3.9; group.add(glow);
    add.data.tip = tip; add.data.glow = glow; add.data.lines = []; add.data.pulse = 0;
  }
  function spawnRod(b, slot) {
    const d = b.data;
    const add = b.adds.spawn({
      x: slot.x, z: slot.z, hp: 150, radius: 0.5, contactDmg: 12, label: 'Storm Rod', color: ACC, barY: 4.5, data: {},
      model: rodModel,
      update: (a, dt) => {
        const D = a.data; D.pulse = Math.max(0, D.pulse - dt * 2);
        if (D.tip) { D.tip.rotation.y += dt * 2; const k = 1.2 + D.pulse * 2.2 + 0.15 * Math.sin(a.t * 6); D.tip.material.color.set(ACC).multiplyScalar(k); }
        if (D.glow) D.glow.scale.setScalar(1.8 + D.pulse * 1.8);
      },
      onDeath: (a, reason) => {
        for (const h of a.data.lines) { try { h.cancel(); } catch (e) { /* */ } }
        a.data.lines.length = 0;
        slot.add = null;
        if (reason !== 'transition' && reason !== 'bossDeath' && reason !== 'clear') { slot.diedAt = b.clock; b.say('A rod falls silent.', 1.6); fx('shards', a.pos.clone().setY(1.5), { color: '#c9963f', count: 14, speed: 5, size: 0.3, life: 1.2 }); }
      },
    });
    slot.add = add;
    strikeFx(slot.x, slot.z, false);
    return add;
  }
  function rodSlots(b, pts) {
    const d = b.data; d.slots = pts.map(([x, z]) => ({ x, z, add: null, diedAt: -1e9 }));
    for (const s of d.slots) spawnRod(b, s);
  }
  // light up `pairs` lines between alive rods (pairs: array of [slotIndex, slotIndex])
  function chainLightning(b, pairs, o = {}) {
    const d = b.data, hs = [];
    for (const [i, j] of pairs) {
      const A = d.slots[i] && d.slots[i].add, B = d.slots[j] && d.slots[j].add;
      if (!A || !B || !A.alive || !B.alive) continue;
      A.data.pulse = 1; B.data.pulse = 1;
      const h = b.hz.line({
        ax: A.pos.x, az: A.pos.z, bx: B.pos.x, bz: B.pos.z, width: o.width || 1.7, warn: o.warn || 1.8, dmg: o.dmg || 24, label: 'Chain Lightning',
        onFire: () => {
          if (!A.alive || !B.alive) return;
          const a = A.pos.clone().setY(3.9), c = B.pos.clone().setY(3.9);
          arc(a, c, { width: 0.3, life: 0.35, segments: 12, jag: 0.07 }); arc(a, c, { color: HOT, width: 0.14, life: 0.25, segments: 9, jag: 0.12 });
          A.data.pulse = 1.2; B.data.pulse = 1.2; world('beat', 0.5);
        },
      });
      A.data.lines.push(h); B.data.lines.push(h); hs.push(h);
      h.done.then(() => { const rm = (arr) => { const k = arr.indexOf(h); if (k >= 0) arr.splice(k, 1); }; rm(A.data.lines); rm(B.data.lines); });
    }
    return hs;
  }
  function alivePairs(b) {
    const d = b.data, out = [];
    for (let i = 0; i < d.slots.length; i++) for (let j = i + 1; j < d.slots.length; j++) if (d.slots[i].add && d.slots[j].add) out.push([i, j]);
    return out;
  }
  // the rod loop: pulse every `every` s, respawn dead rods after `respawn` s
  function rodLoop(b, { every = 5.5, pairsPerPulse = 1, respawn = 12, pairsFn = null, warn = 1.8 } = {}) {
    return b.loop(async () => {
      await b.wait(every);
      const d = b.data;
      for (const s of d.slots) if (!s.add && b.clock - s.diedAt > respawn) spawnRod(b, s);
      let pairs = pairsFn ? pairsFn(b) : alivePairs(b);
      if (!pairsFn) { // random subset
        const pick = [];
        while (pairs.length && pick.length < pairsPerPulse) pick.push(pairs.splice(Math.floor(b.rand() * pairs.length), 1)[0]);
        pairs = pick;
      }
      chainLightning(b, pairs, { warn });
    });
  }

  // ------------------------------------------------------------------ the Tempest orb
  function tempestOrb(b, o = {}) {
    const th = b.playerTheta() + b.randRange(-0.6, 0.6);
    const h = b.hz.orb({ x: b.pos.x, z: b.pos.z, dir: th, speed: 2.2, homing: 0.3, bounce: true, r: 1.0, life: o.life || 20, dmg: 25, label: 'Tempest Orb', color: ACC,
      onPop: (hh, hit) => { const hz = hh.hazard; fx('shockwave', new V(hz.x, 0.1, hz.z), { color: ACC, radius: 3, life: 0.5 }); strikeFx(hz.x, hz.z, false); } });
    fx('burst', b.hitPoint(), { color: ACC, count: 20, speed: 4, size: 0.5, life: 0.6 });
    return h;
  }
  function orbLoop(b, { first = 12, every = 22, max = 1, life = 20 } = {}) {
    const d = b.data; d.orbs = d.orbs || [];
    return b.loop(async () => {
      await b.wait(d.orbs.length ? every : first);
      d.orbs = d.orbs.filter(h => !h.hazard.done);
      if (d.orbs.length >= max) return;
      b.say('The tempest walks.', 1.6);
      const h = tempestOrb(b, { life }); d.orbs.push(h);
      // a bolt arcs off the orb now and then
      (async () => { while (!h.hazard.done) { await b.wait(b.randRange(0.8, 1.6)); if (h.hazard.done) break; const hz = h.hazard; arc(new V(hz.x, 0.9, hz.z), new V(hz.x + b.randRange(-2, 2), 0.1, hz.z + b.randRange(-2, 2)), { width: 0.1, life: 0.14, segments: 6 }); } })().catch(() => {});
    });
  }

  // ------------------------------------------------------------------ the Lightning Wall: gold, unblockable, one blue gap
  function stormWall(b, o = {}) {
    const dur = o.dur || 4.0, width = o.width || 2.8, warn = o.warn || 2.8, dmg = o.dmg || 40, label = 'Lightning Wall';
    const phi = b.pick([0, PI / 2, PI, -PI / 2, PI / 4, -PI / 4, 3 * PI / 4, -3 * PI / 4]);
    const dx = Math.cos(phi), dz = -Math.sin(phi), nx = Math.sin(phi), nz = Math.cos(phi);
    const R = arenaR(), L = R + 2.5, S = [-dx * (R + 1.8), -dz * (R + 1.8)], travel = 2 * (R + 1.8) + 0.6;
    const gOff = b.randRange(-R * 0.55, R * 0.55), gHalf = o.gapHalf || 1.75;
    const seg = (u0, u1) => b.hz.line({
      ax: S[0] + nx * u0, az: S[1] + nz * u0, bx: S[0] + nx * u1, bz: S[1] + nz * u1, width, warn, dmg, unblockable: true, label, arrow: true,
      sweep: { to: [S[0] + nx * u0 + dx * travel, S[1] + nz * u0 + dz * travel], dur },
      onFire: () => { sfx('thunder', { vol: 0.5 }); world('lightning', BOLT); cam('shake', 0.3, 0.4); },
    });
    const h1 = seg(-L, gOff - gHalf), h2 = seg(gOff + gHalf, L);
    const gx = S[0] + nx * gOff, gz = S[1] + nz * gOff, rot = Math.atan2(-nz, nx);
    const gap = b.hz.custom({
      warn, active: dur, danger: false, mode: 2, color: G.hz.COL.safe, label: 'Storm Gap',
      draw(group) {
        const lane = G.hz.teleMesh({ shape: 'rect', x: gx + dx * travel / 2, z: gz + dz * travel / 2, len: gHalf * 2, width: travel, rot, color: G.hz.COL.safe, mode: 2, y: G.hz.TELE_Y - 0.005 });
        lane.material.uniforms.uAlpha.value = 0.35; lane.userData.noFill = true; group.add(lane);
        const m = G.hz.teleMesh({ shape: 'rect', x: gx, z: gz, len: gHalf * 2, width, rot, color: G.hz.COL.safe, mode: 2, y: G.hz.TELE_Y + 0.006 }); group.add(m);
        return (lt) => { const u = clamp((lt - warn) / dur); m.position.x = gx + dx * travel * u; m.position.z = gz + dz * travel * u; if (u > 0) lane.material.uniforms.uAlpha.value = Math.max(0, 0.35 - u * 0.5); };
      },
    });
    // the wall crackles while live
    (async () => {
      await b.wait(warn);
      const t0 = b.clock;
      while (b.clock - t0 < dur) {
        const g = h1.hazard.geom(h1.hazard.t); const u = b.randRange(0.05, 0.95);
        const x = g[0] + (g[2] - g[0]) * u, z = g[1] + (g[3] - g[1]) * u;
        if (Math.hypot(x, z) < R + 1) arc(new V(x, 0.1, z), new V(x + b.randRange(-1, 1), 2.4 + b.randRange(0, 1.5), z + b.randRange(-1, 1)), { color: GOLD, width: 0.12, life: 0.14 });
        await b.wait(0.12);
      }
    })().catch(() => {});
    return [h1, h2, gap];
  }

  // ------------------------------------------------------------------ Eye of the Storm / Stormburst
  async function eyeOrBurst(b, o = {}) {
    const d = b.data;
    const eye = d.lastEye == null ? b.rand() < 0.5 : (b.rand() < 0.62 ? !d.lastEye : d.lastEye);   // mostly alternates, not always
    d.lastEye = eye;
    if (eye) {
      b.say('Into the eye.', 1.6); d.eyeT = 1;
      await b.hz.safe({ x: b.pos.x, z: b.pos.z, r: o.eyeR || 3.4, follow: 'boss', warn: o.warn || 3.0, dmg: 25, label: 'Eye of the Storm', flashColor: ACC,
        onFire: () => { d.eyeT = 0; for (let k = 0; k < 6; k++) { const q = G.polar(b.randRange(5, arenaR() - 1), b.randRange(-PI, PI), 0); strikeFx(q.x, q.z, k === 0); } } });
    } else {
      b.say('Away from me.', 1.6); d.burstT = 1;
      await b.hz.ring({ x: b.pos.x, z: b.pos.z, r0: 0, r1: o.burstR || 8.0, warn: o.warn || 2.6, dmg: 25, label: 'Stormburst',
        onFire: () => { d.burstT = 0; strikeFx(b.pos.x, b.pos.z, true); fx('shockwave', b.pos.clone().setY(0.2), { color: HOT, radius: 7, life: 0.6, intensity: 1.3 }); } });
    }
  }

  // ------------------------------------------------------------------ rotating storm beams from the centre
  async function stormBeams(b, o = {}) {
    await blink(b, 0, 0);
    b.faceTo(null); b.trackPlayer = false;
    const th = b.playerTheta() + PI / 2, om = (b.rand() < 0.5 ? 1 : -1) * (o.omega || 0.6), dur = o.dur || 9;
    const hs = [0, PI].map(k => b.hz.cone({ x: 0, z: 0, theta: th + k, width: 0.55, r: arenaR() + 1, warn: 2.0, omega: om, dur, tick: 0.6, dmg: 12, label: 'Storm Beam', anchor: 'boss' }));
    b.data.beams = hs; b.data.beamOm = om;
    try {
      await b.wait(2.2);
      await markerChain(b, o.markers || 3, { gap: 0.6 });
      await b.wait(Math.max(0, dur - 2.2 - 3.5));
      await Promise.all(hs);
    } finally { b.data.beams = null; b.trackPlayer = true; }
  }

  // ------------------------------------------------------------------ casts
  async function tempest(b, o = {}) {
    const name = o.name || 'Tempest', d = b.data;
    d.chant = 1;
    const r = await b.cast({
      name, dur: o.dur || 3.6, interruptible: true,
      onDone: () => {
        b.hz.wipe(15, name);
        const p = b.playerPos(); const th = Math.atan2(-p.z, p.x);
        try { G.player.knockback(th, o.knock || 4.0); } catch (e) { /* */ }
        strikeFx(p.x, p.z, true); fx('shockwave', new V(0, 0.2, 0), { color: ACC, radius: 16, life: 0.9, intensity: 1.2 });
        for (const s of d.slots || []) { if (s.add) s.add.data.pulse = 1.5; else spawnRod(b, s); }
        b.say(o.doneLine || 'The storm has your name.', 2.2);
        markerChain(b, o.storm || 5, { warn: 1.4, gap: 0.45 }).catch(() => {});
        if (o.wall) stormWall(b, { dur: 4.0, warn: 2.8 });
      },
      onInterrupt: () => {
        b.say(o.failLine || 'The rods discharge harmlessly.', 2.2);
        const rods = (d.slots || []).filter(s => s.add).map(s => s.add);
        for (let i = 0; i < rods.length; i++) { const a = rods[i], c = rods[(i + 1) % rods.length]; if (a !== c) arc(a.pos.clone().setY(3.9), c.pos.clone().setY(3.9), { width: 0.2, life: 0.4, segments: 12 }); a.data.pulse = 1.2; }
        fx('burst', b.hitPoint(), { color: ASH, count: 30, speed: 3, size: 0.4, life: 1.0, gravity: 0.5 });
      },
    });
    d.chant = 0;
    return r;
  }

  // ------------------------------------------------------------------ Thunderclap: heavy blockable, the Riposte window
  async function thunderclap(b, o = {}) {
    const d = b.data; d.raise = 1;
    b.say('Kneel.', 1.4);
    await b.hz.circle({ x: b.pos.x, z: b.pos.z, r: o.r || 6.2, warn: o.warn || 2.1, dmg: 45, follow: 'boss', label: 'Thunderclap',
      onFire: (h) => { d.raise = 0; d.clapT = 1; strikeFx(h.hazard.x, h.hazard.z, true); fx('shockwave', new V(h.hazard.x, 0.2, h.hazard.z), { color: HOT, radius: 7.5, life: 0.5, intensity: 1.4 }); cam('shake', 0.7, 0.5); world('beat', 1); } });
    d.raise = 0;
  }

  // ------------------------------------------------------------------ the model
  function build(b) {
    const d = b.data, g = new T3.Group();
    const robeMat = G.mat.brass({ color: '#2b2633', metalness: 0.35, roughness: 0.85, emissive: '#2a0f52', emissiveIntensity: 0.55 });
    const ashMat = G.mat.brass({ color: '#1a1720', metalness: 0.2, roughness: 0.95, emissive: '#160826', emissiveIntensity: 0.4, transparent: true, opacity: 0.75 });
    const brass = G.mat.brass({ color: '#c9963f', metalness: 0.9, roughness: 0.3, emissive: '#3a1a66', emissiveIntensity: 0.35 });
    const body = new T3.Group(); g.add(body); d.body = body;
    // robe: a long tapering cone, ragged hem (a second, wider, translucent cone a little lower)
    const robe = new T3.Mesh(new T3.ConeGeometry(0.72, 2.9, 14, 1), robeMat); robe.position.y = 1.45; body.add(robe);
    const hem = new T3.Mesh(new T3.ConeGeometry(0.95, 1.4, 9, 1, true), ashMat); hem.position.y = 0.55; body.add(hem);
    const hem2 = new T3.Mesh(new T3.ConeGeometry(0.62, 1.1, 7, 1, true), ashMat); hem2.position.y = 0.2; body.add(hem2);
    // brass bands and lightning veins on the robe (so the close-ups in cinematics have something to read)
    for (const [y, r] of [[1.15, 0.63], [2.0, 0.46]]) { const band = new T3.Mesh(new T3.TorusGeometry(r, 0.035, 6, 24), brass); band.rotation.x = PI / 2; band.position.y = y; body.add(band); }
    const veinMat = G.mat.emissive(ACC, 1.3); d.veins = [];
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + 0.4, h = 0.9 + (i % 2) * 0.5;
      const v = new T3.Mesh(new T3.BoxGeometry(0.03, h, 0.03), veinMat); const rr = 0.72 - (1.0 + h / 2 - 0.1) * (0.72 / 2.9);
      v.position.set(Math.cos(a) * rr * 0.98, 1.0 + h / 2 - 0.1, Math.sin(a) * rr * 0.98); v.rotation.y = -a; v.rotation.z = (Math.cos(a) > 0 ? -1 : 1) * 0.24 * Math.abs(Math.cos(a)); v.rotation.x = -0.24 * Math.sin(a);
      body.add(v); d.veins.push(v);
    }
    // torso / shoulders / head / hood
    const chest = new T3.Mesh(new T3.SphereGeometry(0.46, 14, 10), robeMat); chest.position.y = 2.55; chest.scale.set(1, 0.75, 1.15); body.add(chest);
    for (const s of [-1, 1]) {
      const pad = new T3.Mesh(new T3.SphereGeometry(0.34, 12, 8), brass); pad.position.set(-0.05, 2.72, s * 0.5); pad.scale.set(1, 0.55, 1); body.add(pad);
      const spike = new T3.Mesh(new T3.ConeGeometry(0.07, 0.55, 6), brass); spike.position.set(-0.05, 2.95, s * 0.7); spike.rotation.x = -s * 0.5; body.add(spike);
    }
    const collar = new T3.Mesh(new T3.TorusGeometry(0.4, 0.05, 8, 20), brass); collar.rotation.x = PI / 2; collar.position.y = 2.85; body.add(collar);
    const head = new T3.Mesh(new T3.IcosahedronGeometry(0.27, 1), G.mat.brass({ color: '#d8d0e0', metalness: 0.1, roughness: 0.6, emissive: '#5a3a9a', emissiveIntensity: 0.35 })); head.position.set(0.08, 3.18, 0); head.scale.set(1, 1.25, 0.9); body.add(head);
    const hood = new T3.Mesh(new T3.ConeGeometry(0.42, 0.9, 10, 1, true), robeMat); hood.position.set(-0.08, 3.45, 0); hood.rotation.z = 0.28; body.add(hood);
    const eyeL = new T3.Mesh(new T3.SphereGeometry(0.05, 6, 6), G.mat.emissive(HOT, 2.2)); eyeL.position.set(0.3, 3.22, 0.1); body.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.z = -0.1; body.add(eyeR);
    // crown of three brass thorns
    for (let i = -1; i <= 1; i++) { const th = new T3.Mesh(new T3.ConeGeometry(0.05, 0.5, 5), brass); th.position.set(-0.05, 3.75, i * 0.18); th.rotation.z = 0.1 - Math.abs(i) * 0.25; th.rotation.x = -i * 0.3; body.add(th); }
    // the halo: a brass ring in the y-z plane behind the head, with thin rods radiating out, tips glowing
    const halo = new T3.Group(); halo.position.set(-0.55, 3.25, 0); body.add(halo); d.halo = halo;
    const ring = new T3.Mesh(new T3.TorusGeometry(0.95, 0.035, 6, 36), brass); ring.rotation.y = PI / 2; halo.add(ring);
    const ring2 = new T3.Mesh(new T3.TorusGeometry(0.62, 0.025, 6, 30), brass); ring2.rotation.y = PI / 2; halo.add(ring2);
    d.rods = []; d.rodTips = [];
    const NR = 9;
    for (let i = 0; i < NR; i++) {
      const a = i / NR * TAU;
      const pivot = new T3.Group(); pivot.rotation.x = a; halo.add(pivot);         // rotating y around x by a gives (0, cos a, sin a)
      const rod = new T3.Mesh(new T3.CylinderGeometry(0.022, 0.05, 1.05, 6), brass); rod.position.y = 1.35; pivot.add(rod);
      const tip = new T3.Mesh(new T3.OctahedronGeometry(0.075, 0), G.mat.emissive(ACC, 1.8)); tip.position.y = 1.92; pivot.add(tip);
      d.rods.push(pivot); d.rodTips.push(tip);
    }
    const haloGlow = G.mat.glowSprite(ACC, 3.2, { intensity: 0.32, opacity: 0.7 }); haloGlow.position.set(-0.1, 0, 0); halo.add(haloGlow); d.haloGlow = haloGlow;
    // the staff, held out in front (+x), tip glowing
    const staff = new T3.Group(); staff.position.set(0.7, 1.9, -0.55); staff.rotation.z = 0.12; body.add(staff); d.staff = staff;
    const shaft = new T3.Mesh(new T3.CylinderGeometry(0.045, 0.06, 3.6, 8), brass); staff.add(shaft);
    const ferrule = new T3.Mesh(new T3.ConeGeometry(0.06, 0.3, 6), brass); ferrule.position.y = -1.9; ferrule.rotation.x = PI; staff.add(ferrule);
    const cage = new T3.Mesh(new T3.TorusGeometry(0.22, 0.03, 6, 16), brass); cage.position.y = 1.95; staff.add(cage);
    const cage2 = cage.clone(); cage2.rotation.y = PI / 2; staff.add(cage2);
    const tip = new T3.Mesh(new T3.OctahedronGeometry(0.16, 1), G.mat.emissive(HOT, 2.0)); tip.position.y = 1.95; staff.add(tip); d.staffTip = tip;
    const tipGlow = G.mat.glowSprite(ACC, 1.6, { intensity: 0.55, opacity: 0.85 }); tipGlow.position.y = 1.95; staff.add(tipGlow); d.tipGlow = tipGlow;
    const hand = new T3.Mesh(new T3.SphereGeometry(0.12, 8, 6), G.mat.brass({ color: '#d8d0e0', metalness: 0.1, roughness: 0.6 })); hand.position.y = 0.4; staff.add(hand);
    // violet floor glow under her (flat additive disc, modest)
    const floor = new T3.Mesh(new T3.CircleGeometry(2.2, 32), G.mat.additive(ACC, 0.3, { map: G.tex.glow, intensity: 0.9 })); floor.rotation.x = -PI / 2; floor.position.y = 0.035; floor.renderOrder = 3; g.add(floor); d.floor = floor;
    // ash motes that orbit her (a few small dark emissive flakes on a slow ring)
    const motes = new T3.Group(); g.add(motes); d.motes = [];
    for (let i = 0; i < 10; i++) { const m = new T3.Mesh(new T3.TetrahedronGeometry(0.07, 0), G.mat.emissive(i % 3 ? ASH : ACC, i % 3 ? 0.9 : 1.4)); motes.add(m); d.motes.push({ m, a: i / 10 * TAU, r: 1.1 + (i % 4) * 0.25, y: 0.6 + (i % 5) * 0.5, s: 0.6 + (i % 3) * 0.3 }); }
    d.motesG = motes;
    d.rise = 0; d.riseV = 0; d.blinkT = 0; d.chant = 0; d.raise = 0; d.arcT = 0.4; d.spin = 0; d.eyeT = 0; d.burstT = 0; d.clapT = 0; d.dead = 0; d.haloCollapse = 0; d.stormT = 4;
    body.position.y = 0.55; body.scale.setScalar(1.3);
    b.model = g;
  }

  function animate(b, dt) {
    const d = b.data; if (!d.body) return;
    const t = b.clock;
    d.blinkT = Math.max(0, d.blinkT - dt * 2.5); d.clapT = Math.max(0, d.clapT - dt * 2);
    const chant = d.chant || (b.casting ? 1 : 0), raise = d.raise;
    if (d.beams && d.beams[0] && !d.beams[0].hazard.done && b.alive) { const hz = d.beams[0].hazard; b.facing = hz.thetaAt(hz.t); }
    // float + rise (transition column)
    d.riseV += ((d.rise ? 4.2 : 0) - d.riseV) * Math.min(1, dt * 3);
    const hover = 0.55 + Math.sin(t * 1.4) * 0.08 + d.riseV + (d.dead ? -d.dead * 1.4 : 0);
    d.body.position.y = hover;
    d.body.rotation.z = Math.sin(t * 0.9) * 0.03 + (b.staggerT > 0 ? -0.25 : 0) + d.dead * 0.6;
    const BS = 1.3; d.body.scale.setScalar(BS * (1 + d.blinkT * 0.25 * Math.sin(d.blinkT * PI)));
    if (d.dead) d.body.scale.set(BS * (1 - d.dead * 0.35), BS * (1 - d.dead * 0.75), BS * (1 - d.dead * 0.35));
    // halo spin: faster while chanting / exposed, sags when staggered
    const want = (b.staggerT > 0 ? 0.3 : 1.1) + chant * 3.2 + raise * 2 + (d.rise ? 5 : 0) + d.haloCollapse * 8;
    d.spin += (want - d.spin) * Math.min(1, dt * 2.5);
    d.halo.rotation.x += dt * d.spin;
    d.halo.rotation.z = (b.staggerT > 0 ? 0.35 : 0) * 0.5 + Math.sin(t * 0.7) * 0.04;
    if (d.haloCollapse > 0) { const k = 1 - clamp(d.haloCollapse) * 0.92; for (const p of d.rods) p.scale.setScalar(k); d.halo.scale.setScalar(Math.max(0.05, k)); }
    const tipK = 1.4 + chant * 1.2 + 0.25 * Math.sin(t * 7) + d.blinkT * 1.5;
    for (let i = 0; i < d.rodTips.length; i++) { const tp = d.rodTips[i]; tp.material.color.set(ACC).multiplyScalar(tipK + 0.5 * Math.sin(t * 9 + i * 1.7)); tp.rotation.y += dt * 3; }
    d.haloGlow.scale.setScalar(3.2 + chant * 1.4 + d.blinkT * 1.0); d.haloGlow.material.opacity = 0.7 * (1 - d.dead);
    // staff: raised for Thunderclap, levelled at the player while chanting
    const sx = d.staff; sx.rotation.z += (((raise ? -1.35 : chant ? 0.55 : 0.12)) - sx.rotation.z) * Math.min(1, dt * 5);
    sx.position.y += (((raise ? 2.4 : 1.9)) - sx.position.y) * Math.min(1, dt * 5);
    d.staffTip.rotation.y += dt * 4; d.staffTip.rotation.x += dt * 2.3;
    const tg = 1.0 + chant * 1.0 + raise * 1.2 + d.blinkT * 1.5 + 0.15 * Math.sin(t * 11);
    d.staffTip.material.color.set(HOT).multiplyScalar(tg * 1.6); d.tipGlow.scale.setScalar(1.6 * (0.8 + tg * 0.45)); d.tipGlow.material.opacity = 0.85 * (1 - d.dead);
    // floor glow pulse
    d.floor.material.opacity = (0.22 + 0.08 * Math.sin(t * 2.2) + chant * 0.15 + d.blinkT * 0.3 + d.clapT * 0.3) * (1 - d.dead);
    if (d.veins) { const vk = 1.0 + chant * 1.2 + d.blinkT * 1.5 + 0.3 * Math.sin(t * 5.3); for (const v of d.veins) v.material.color.set(ACC).multiplyScalar(vk); }
    d.floor.scale.setScalar(1 + chant * 0.3 + d.clapT * 1.2);
    // motes orbit
    for (const mo of d.motes) { mo.a += dt * mo.s * (1 + chant * 2); const y = mo.y + Math.sin(t * 1.7 + mo.a) * 0.2 + d.riseV; mo.m.position.set(Math.cos(mo.a) * mo.r, y, Math.sin(mo.a) * mo.r); mo.m.rotation.x += dt * 2; mo.m.rotation.z += dt * 1.3; mo.m.visible = !d.dead; }
    // arcs between halo rod tips (and to the staff tip while chanting)
    d.arcT -= dt;
    if (d.arcT <= 0 && b.root.visible && !d.dead) {
      d.arcT = (chant || d.rise ? 0.12 : 0.55) + Math.random() * (chant ? 0.15 : 0.9);
      const n = d.rodTips.length, i = Math.floor(Math.random() * n), j = (i + 1 + Math.floor(Math.random() * 3)) % n;
      const a = fxPos(d.rodTips[i]), c = fxPos(d.rodTips[j]);
      arc(a, c, { width: 0.07 + chant * 0.05, life: 0.14, segments: 5, jag: 0.25 });
      if (chant && Math.random() < 0.5) arc(fxPos(d.rodTips[(j + 4) % n]), fxPos(d.staffTip), { color: HOT, width: 0.08, life: 0.16, segments: 7, jag: 0.15 });
      if (d.rise && Math.random() < 0.7) { const p = fxPos(d.halo); arc(new V(p.x + (Math.random() - 0.5) * 3, p.y + 10, p.z + (Math.random() - 0.5) * 3), p, { width: 0.2, life: 0.2, segments: 9, jag: 0.06 }); }
      if (!chant && !d.rise && Math.random() < 0.18) fx('burst', fxPos(d.body).add(new V((Math.random() - 0.5) * 0.8, 0.3, (Math.random() - 0.5) * 0.8)), { color: ASH, count: 3, speed: 0.6, size: 0.18, life: 1.6, gravity: -0.35, drag: 0.6, flare: false, hot: false, intensity: 0.8 });
    }
    // ambient: the storm bolts more often as the fight escalates (the sky does its own; this is the arena rim)
    if ((G.state === 'fight' || G.state === 'practice') && b.alive) {
      d.stormT = (d.stormT || 0) - dt;
      if (d.stormT <= 0) { d.stormT = [9, 6, 3.5][b.phase] + Math.random() * 4; world('lightning', BOLT); if (b.phase >= 1) world('rimGlow', ACC, 0.5, 0.6); }
    }
  }

  // ------------------------------------------------------------------ transitions and death
  function onTransition(b, from, to) {
    const d = b.data;
    d.rise = 1; d.chant = 0; d.raise = 0; d.beams = null;
    fx('flash', '#cbb8ff', 0.3, 0.5); cam('shake', 0.5, 0.7);
    world('floorGlow', ACC, 0.35 + to * 0.15, 0); world('rimGlow', ACC, 1.2, 1.5); world('lightning', BOLT); sfx('thunder', { vol: 0.8 });
    b.say(to === 1 ? 'The eye opens.' : 'Ash. All of it, ash.', 3);
    const home = G.camera ? G.camera.position.toArray() : [0, 20, 16];
    const bx = b.pos.x, bz = b.pos.z;
    const cin = cam('cinematic', [
      { t: 0, pos: home, look: [0, 0.5, 0] },
      { t: 1.3, pos: [bx + 4.5, 4.5, bz + 10.5], look: [bx, 5.5, bz] },
      { t: 2.6, pos: [bx + 2.5, 7.5, bz + 9.0], look: [bx, 2.5, bz] },
      { t: 3.9, pos: home, look: [0, 0.5, 0] },
    ], { name: 'storm-rise' });
    (async () => {
      for (let i = 0; i < 7; i++) {
        const top = new V(bx + (Math.random() - 0.5) * 4, 16, bz + (Math.random() - 0.5) * 4);
        fx('lightning', top, new V(bx, 3 + (d.riseV || 0), bz), { color: i % 2 ? HOT : BOLT, width: 0.3 + Math.random() * 0.25, life: 0.3, segments: 12, jag: 0.05 });
        cam('shake', 0.35, 0.25); world('lightning', BOLT); sfx('crack', { vol: 0.5 });
        await G.combat.wait(0.32);
      }
      d.rise = 0;
      await G.combat.wait(0.55);
      // she comes down at the centre in a thunderclap
      const ox = b.pos.x, oz = b.pos.z;
      fx('lightning', new V(ox, 0.4, oz), new V(ox, 14, oz), { color: BOLT, width: 0.25, life: 0.2, segments: 9, jag: 0.05 });
      b.teleport(0, 0); d.blinkT = 1;
      fx('flash', '#d8c8ff', 0.3, 0.4); strikeFx(0, 0, true);
      fx('shockwave', new V(0, 0.2, 0), { color: ACC, radius: 15, life: 1.0, intensity: 1.3 });
      fx('burst', new V(0, 1.5, 0), { color: ASH, count: 40, speed: 5, size: 0.35, life: 1.2, gravity: 0.3, flare: false, hot: false });
      cam('shake', 0.8, 0.6); world('beat', 1.2);
    })().catch(() => {});
    return cin || Promise.resolve();
  }
  async function onDeath(b) {
    const d = b.data;
    d.chant = 0; d.raise = 0; d.rise = 0; d.haloCollapse = 0; d.dead = 0;
    world('floorGlow', ACC, 0.9, 0); world('rimGlow', HOT, 1.5, 3);
    b.say('...the storm forgets.', 4);
    cam('slowMo', 0.35, 1.4);
    const home = G.camera ? G.camera.position.toArray() : [0, 20, 16];
    const bx = b.pos.x, bz = b.pos.z;
    const cin = cam('cinematic', [
      { t: 0, pos: home, look: [0, 0.5, 0] },
      { t: 1.4, pos: [bx + 3.5, 3.5, bz + 9.5], look: [bx, 3.2, bz] },
      { t: 4.2, pos: [bx - 4.0, 5.5, bz + 11.0], look: [bx, 2.2, bz] },
      { t: 6.4, pos: [bx + 1.0, 9.0, bz + 14.0], look: [bx, 1.0, bz] },
      { t: 8.2, pos: home, look: [0, 0.5, 0] },
    ], { name: 'storm-death' });
    // 1. the halo collapses: rods draw in, spinning faster, sparking
    for (let i = 0; i < 10; i++) {
      d.haloCollapse = (i + 1) / 10;
      const a = fxPos(d.rodTips[i % d.rodTips.length]), c = fxPos(d.halo);
      arc(a, c, { color: HOT, width: 0.1, life: 0.2, segments: 6 });
      fx('spark', c, HOT, { count: 6, size: 0.8 }); sfx('crack', { vol: 0.35, pitch: 1.2 });
      cam('shake', 0.2, 0.2);
      await G.combat.wait(0.16);
    }
    // 2. the last bolt
    await G.combat.wait(0.4);
    const top = new V(bx + 1, 18, bz - 1), at = new V(bx, 3.5, bz);
    fx('lightning', top, at, { color: HOT, width: 0.6, life: 0.5, segments: 14, jag: 0.04 });
    fx('lightning', new V(bx - 2, 18, bz + 1), at, { color: BOLT, width: 0.3, life: 0.4, segments: 12, jag: 0.08 });
    fx('flash', '#efe6ff', 0.42, 0.5); cam('shake', 1.1, 0.8); sfx('thunder', { vol: 1.0 }); world('lightning', HOT);
    fx('burst', at, { color: BOLT, count: 40, speed: 8, size: 0.5, life: 0.8, intensity: 1.2 });
    fx('shockwave', new V(bx, 0.3, bz), { color: ACC, radius: 16, life: 1.1, intensity: 0.7 });
    d.halo.visible = false;
    for (const tp of d.rodTips) tp.visible = false;
    await G.combat.wait(0.5);
    // 3. she falls as ash
    for (let i = 0; i < 12; i++) {
      d.dead = (i + 1) / 12;
      const p = new V(bx + (Math.random() - 0.5) * 1.4, 0.4 + (1 - d.dead) * 2.6 + Math.random() * 0.8, bz + (Math.random() - 0.5) * 1.4);
      fx('burst', p, { color: i % 3 ? ASH : ACC, count: 22, speed: 1.6 + i * 0.1, size: 0.3, life: 1.6, gravity: 0.9, drag: 1.2, flare: false, hot: false, intensity: 0.9 });
      if (i % 4 === 0) fx('shards', p, { color: '#c9963f', count: 8, speed: 4, size: 0.25, life: 1.4 });
      await G.combat.wait(0.17);
    }
    fx('shockwave', new V(bx, 0.1, bz), { color: ASH, radius: 6, life: 0.8, intensity: 0.6 });
    fx('burst', new V(bx, 0.3, bz), { color: ASH, count: 60, speed: 3, size: 0.35, life: 2.2, gravity: 0.4, flat: true, flare: false, hot: false, intensity: 0.8 });
    b.root.visible = false;
    world('floorGlow', ACC, 0.2, 4);
    await G.combat.wait(1.2);
    return cin || Promise.resolve();
  }

  // ------------------------------------------------------------------ the definition
  G.bosses[3] = {
    name: 'THESSALY', title: 'the Ashen Archon', court: 'The Court of Storms', accent: ACC, sky: 'storm', arena: 'storm', music: 3,
    maxHp: 12000, parTime: 300, hitRadius: 1.3, hitHeight: 2.6, bodyRadius: 1.0, speed: 4, turnRate: 3.2, fadeOpacity: 0.3,
    intro: ['She buried four kings beneath the storm, and kept the ash.', 'Stand where the lightning cannot find you.'],
    phases: [
      // ------------------------------------------------------------ PHASE 1: Stormcall
      {
        name: 'Stormcall', hpStart: 1.0, sky: ['storm', 1], intensity: 1,
        enter(b) {
          b.turnRate = 3.2; b.trackPlayer = true; b.facingTarget = null;
          world('floorGlow', ACC, 0.18, 0);
          b.say('Stand still, little knife. The storm is patient.', 3);
        },
        async script(b) {
          const R = 8.4, t0 = b.randRange(-PI, PI);
          rodSlots(b, [0, 1, 2].map(i => { const q = G.polar(R, t0 + i * TAU / 3, 0); return [q.x, q.z]; }));
          rodLoop(b, { every: 5.0, pairsPerPulse: 2, respawn: 30 });
          orbLoop(b, { first: 8, every: 16, max: 2, life: 20 });
          b.loop(async () => {
            await b.wait(1.0);
            await blink(b);
            await markerChain(b, b.randInt(4, 5));
            await b.wait(1.5);
            let [w] = stormWall(b, { dur: 3.9 });
            await b.wait(1.5);
            await markerChain(b, 3, { gap: 0.55 });
            await w;
            await b.wait(1.0);
            await blink(b);
            await markerChain(b, b.randInt(4, 5));
            await b.wait(1.2);
            await tempest(b, { storm: 6 });
            await b.wait(2.5);
            await blink(b);
            [w] = stormWall(b, { dur: 3.9 });
            await b.wait(1.5);
            await markerChain(b, 3, { gap: 0.55 });
            await w;
            await b.wait(1.5);
          });
        },
      },
      // ------------------------------------------------------------ PHASE 2: Eye of the Storm
      {
        name: 'Eye of the Storm', hpStart: 0.6, sky: ['storm', 2], intensity: 2,
        enter(b) {
          b.turnRate = 3.4; b.trackPlayer = true; b.facingTarget = null;
          world('floorGlow', ACC, 0.3, 0);
          b.say('Closer. Or further. Read the sky.', 3);
        },
        async script(b) {
          const R = 8.6, t0 = b.randRange(-PI, PI);
          rodSlots(b, [0, 1, 2, 3].map(i => { const q = G.polar(R, t0 + i * TAU / 4, 0); return [q.x, q.z]; }));
          rodLoop(b, { every: 4.6, pairsPerPulse: 3, respawn: 26, warn: 1.7 });
          orbLoop(b, { first: 6, every: 14, max: 3, life: 22 });
          b.loop(async () => {
            await b.wait(1.0);
            await blink(b);
            await markerChain(b, b.randInt(4, 5));
            await b.wait(1.0);
            let c = side(b.wait(0.6).then(() => markerChain(b, 3, { gap: 0.6 })));
            await eyeOrBurst(b);
            await c;
            await b.wait(0.8);
            c = side(b.wait(0.4).then(() => markerChain(b, 2, { gap: 0.6 })));
            await thunderclap(b, { r: 5.6, warn: 2.1 });
            await c;
            await b.wait(0.8);
            const [w] = stormWall(b, { dur: 3.8 });
            await b.wait(1.4);
            await markerChain(b, 3, { gap: 0.55 });
            await w;
            await b.wait(1.0);
            await blink(b);
            await markerChain(b, b.randInt(4, 5));
            await b.wait(1.0);
            await tempest(b, { storm: 6 });
            await b.wait(2.5);
            await stormBeams(b, { dur: 9, omega: 0.7, markers: 4 });
            await b.wait(1.0);
            c = side(b.wait(0.6).then(() => markerChain(b, 3, { gap: 0.6 })));
            await eyeOrBurst(b);
            await c;
            await b.wait(1.2);
            await blink(b);
            c = side(b.wait(0.5).then(() => markerChain(b, 3, { gap: 0.6 })));
            await eyeOrBurst(b, { warn: 2.6 });
            await c;
            await b.wait(1.5);
          });
        },
      },
      // ------------------------------------------------------------ PHASE 3: Ashfall
      {
        name: 'Ashfall', hpStart: 0.25, sky: ['storm', 3], intensity: 3,
        enter(b) {
          b.turnRate = 3.8; b.trackPlayer = true; b.facingTarget = null;
          world('floorGlow', ACC, 0.42, 0);
          b.say('Everything you love is already ash.', 3);
        },
        async script(b) {
          const S = 6.6;
          rodSlots(b, [[S, S], [S, -S], [-S, -S], [-S, S]]);
          // the square: sides one pulse, diagonals the next
          let k = 0;
          rodLoop(b, { every: 4.0, respawn: 22, warn: 1.6, pairsFn: () => (k++ % 2 === 0) ? [[0, 1], [1, 2], [2, 3], [3, 0]] : [[0, 2], [1, 3]] });
          orbLoop(b, { first: 5, every: 12, max: 3, life: 24 });
          b.loop(async () => {
            await b.wait(0.8);
            await blink(b);
            await ashRings(b, b.randInt(4, 5));
            await b.wait(0.6);
            let c = side(b.wait(0.3).then(() => markerChain(b, 3, { warn: 1.25, gap: 0.5 })));
            await thunderclap(b);
            await c;
            await b.wait(0.8);
            let [w] = stormWall(b, { dur: 3.4, warn: 2.8 });
            await b.wait(1.4);
            await ashRings(b, 3, { gap: 0.55 });
            await w;
            await b.wait(0.6);
            c = side(b.wait(0.5).then(() => ashRings(b, 3, { gap: 0.6 })));
            await eyeOrBurst(b, { warn: 2.6, eyeR: 3.2, burstR: 8.3 });
            await c;
            await b.wait(0.8);
            await blink(b);
            await ashRings(b, b.randInt(5, 6), { gap: 0.45 });
            await b.wait(0.6);
            await tempest(b, { name: 'Cataclysm', dur: 4.2, storm: 7, knock: 4.5, wall: true, doneLine: 'Cataclysm. Remember it.', failLine: 'The storm forgets her name.' });
            await b.wait(2.5);
            await blink(b);
            c = side(b.wait(0.3).then(() => ashRings(b, 3, { gap: 0.55 })));
            await thunderclap(b, { warn: 1.9 });
            await c;
            await b.wait(0.6);
            [w] = stormWall(b, { dur: 3.4, warn: 2.8 });
            await b.wait(1.2);
            await markerChain(b, 4, { warn: 1.2, gap: 0.4 });
            await w;
            await b.wait(0.8);
          });
        },
      },
    ],
    build, animate, onTransition, onDeath,
    teardown(b) {
      const d = b.data || {};
      d.beams = null; d.orbs = null; d.slots = null;
      world('floorGlow', ACC, 0, 0.3); world('rimGlow', ACC, 0, 0.3);
    },
  };
})();
