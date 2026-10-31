// =====================================================================
// 10_boss1.js: COURT I, THE COURT OF ASH. VARRAK, the Hearth Knight.
// A hulking knight in blackened plate with a burning hearth in his chest and a greatsword. The first court, so
// he teaches every telegraph shape one at a time (long warns) before combining them:
//   P1 Kindling       cone (Hearth Cleave), circle (Ember Slam), line + charge (Hearth Charge), interruptible cast
//                     (War Horn: raid damage + two Cinder Hounds), then cleave + slam together.
//   P2 Pyre           everything faster, Falling Pillars (circles in sequence around a blue safe disc), Ember orbs
//                     (Rebuke clears them), the first gold unblockable ring with a blue gap (Bulwark does not stop gold).
//   P3 Conflagration  blade rotor (two spinning cones), Hearth Waves (gap lanes), a heavy blockable Hearth Slam
//                     (Bulwark + Riposte), War Horn with three hounds, and the P1/P2 kit in combinations.
// =====================================================================
(() => {
  const T3 = G.THREE, PI = Math.PI, TAU = PI * 2;
  const ACC = '#ff7a2a', HOT = '#ffc46b', EMBER = '#ff9a40', DEEP = '#ff3c12', GOLD = '#ffd36b';
  const world = (fn, ...a) => { try { return G.world && typeof G.world[fn] === 'function' ? G.world[fn](...a) : undefined; } catch (e) { return undefined; } };
  const fx = (fn, ...a) => { try { return G.fx && G.fx[fn] ? G.fx[fn](...a) : undefined; } catch (e) { return undefined; } };
  const cam = (fn, ...a) => { try { return G.cam && G.cam[fn] ? G.cam[fn](...a) : undefined; } catch (e) { return undefined; } };
  const sfx = (n, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(n, o || {}); } catch (e) { } };
  const V3 = (x = 0, y = 0, z = 0) => new T3.Vector3(x, y, z);
  const arenaR = () => (G.world && G.world.arenaR != null ? G.world.arenaR : G.ARENA_R);
  const clamp = G.clamp, damp = G.damp, lerp = G.lerp;
  const PLAYING = () => G.state === 'fight' || G.state === 'practice';

  // ------------------------------------------------------------------ small helpers
  // a point on the live rim in direction theta from (x, z)
  function rimFrom(x, z, theta, margin = 0.6) {
    const R = arenaR() - margin, dx = Math.cos(theta), dz = -Math.sin(theta);
    const dot = x * dx + z * dz, c = x * x + z * z - R * R;
    const t = -dot + Math.sqrt(Math.max(0, dot * dot - c));
    return [x + dx * t, z + dz * t, t];
  }
  const clampArena = (x, z, margin = 0.8) => { const R = arenaR() - margin, d = Math.hypot(x, z); return d > R ? [x * R / d, z * R / d] : [x, z]; };
  // chest position (play coords) for embers / bursts
  function chestPos(b, out) { const v = G.polar(0.95, b.facing, 3.0, out); v.x += b.pos.x; v.z += b.pos.z; return v; }
  // a camera position in front of the boss: dist along his facing (offset by `side` radians), at height y
  function frontCam(b, dist, y, side = 0.45) {
    const v = G.polar(dist, b.facing + side, y); let x = b.pos.x + v.x, z = b.pos.z + v.z;
    const R = G.ARENA_R - 1.5, d = Math.hypot(x, z); if (d > R) { x *= R / d; z *= R / d; }   // stay inside the rim
    return [x, y, z];
  }
  function swing(b, kind, dur) { b.data.swing = { kind, t: 0, dur: Math.max(0.2, dur) }; }
  // hearth hits that land leave the player Burning for a moment (Mend cleanses it)
  const scorch = (dps = 5, dur = 3) => (h, res) => { try { if (res && res.applied && G.player.burn) G.player.burn(dps, dur, 'Burning'); } catch (e) { } };

  // ------------------------------------------------------------------ Cinder Hounds (adds)
  function spawnHounds(b, n) {
    const back = b.facing + PI;
    for (let i = 0; i < n; i++) {
      const th = back + (i - (n - 1) / 2) * 0.75;
      let [x, z] = [b.pos.x + Math.cos(th) * (b.hitRadius + 1.6), b.pos.z - Math.sin(th) * (b.hitRadius + 1.6)];
      [x, z] = clampArena(x, z, 1.0);
      b.adds.spawn({
        x, z, hp: 150, radius: 0.55, contactDmg: 10, label: 'Cinder Hound', color: ACC, barY: 1.25,
        data: { ph: Math.random() * TAU, spd: 4.5 + i * 0.15, side: i % 2 ? 1 : -1, life: 13 + i },
        model(group, add) {
          const hide = G.mat.brass({ color: '#2a1b1a', metalness: 0.5, roughness: 0.7 });
          const body = new T3.Mesh(new T3.BoxGeometry(1.0, 0.42, 0.48), hide); body.position.y = 0.55; group.add(body);
          const head = new T3.Mesh(new T3.BoxGeometry(0.42, 0.34, 0.36), hide); head.position.set(0.62, 0.68, 0); group.add(head);
          const jaw = new T3.Mesh(new T3.BoxGeometry(0.3, 0.1, 0.3), hide); jaw.position.set(0.66, 0.5, 0); group.add(jaw);
          for (const s of [-1, 1]) { const eye = new T3.Mesh(new T3.BoxGeometry(0.08, 0.06, 0.08), G.mat.emissive(HOT, 2.4)); eye.position.set(0.84, 0.74, s * 0.11); group.add(eye); }
          const coal = new T3.Mesh(new T3.SphereGeometry(0.17, 8, 6), G.mat.emissive(ACC, 2.0)); coal.position.set(0.1, 0.62, 0); group.add(coal);
          const glow = G.fx && G.fx.glowSprite ? G.fx.glowSprite(ACC, 1.6, { intensity: 1.0, opacity: 0.45 }) : null; if (glow) { glow.position.set(0.1, 0.6, 0); group.add(glow); }
          const legs = [];
          for (const [lx, lz] of [[0.35, 0.18], [0.35, -0.18], [-0.35, 0.18], [-0.35, -0.18]]) { const l = new T3.Mesh(new T3.BoxGeometry(0.14, 0.42, 0.14), hide); l.position.set(lx, 0.22, lz); group.add(l); legs.push(l); }
          const spine = new T3.Mesh(new T3.BoxGeometry(0.7, 0.12, 0.1), G.mat.emissive(DEEP, 1.4)); spine.position.set(-0.05, 0.78, 0); group.add(spine);
          add.data.legs = legs; add.data.body = body; add.data.coal = coal; add.data.glow = glow;
        },
        update(add, dt) {
          const P = G.player.state.pos, d = add.data;
          // cinder hounds burn out: the coal dims over the last seconds, then they crumble
          const left = d.life - add.t;
          if (left <= 0) { G.adds.kill(add, 'burnout'); return; }
          if (left < 3 && d.glow) { d.glow.material.opacity = 0.45 * (left / 3); if (d.coal) d.coal.scale.setScalar(0.4 + 0.6 * left / 3); }
          const dx = P.x - add.pos.x, dz = P.z - add.pos.z, dist = Math.hypot(dx, dz) || 1e-3;
          const ux = dx / dist, uz = dz / dist;
          // weave a little while closing in (reads as a pack hunting, and makes them easier to kite)
          const w = Math.sin(add.t * 3.2 + d.ph) * 0.35 * d.side * clamp((dist - 1.5) / 4);
          const mx = ux + (-uz) * w, mz = uz + ux * w, ml = Math.hypot(mx, mz) || 1;
          add.pos.x += mx / ml * d.spd * dt; add.pos.z += mz / ml * d.spd * dt;
          add.inner.rotation.y = Math.atan2(-mz, mx);
          const run = add.t * 14;
          if (d.legs) d.legs.forEach((l, i) => { l.rotation.z = Math.sin(run + (i % 2 ? PI : 0) + (i > 1 ? 0.6 : 0)) * 0.6; });
          if (d.body) d.body.position.y = 0.55 + Math.abs(Math.sin(run * 0.5)) * 0.08;
        },
      });
    }
    sfx('addSpawn', { vol: 0.9 });
  }

  // ------------------------------------------------------------------ attacks (each resolves when the hazard has ended)
  // Hearth Cleave: a cone from the boss that follows the player until lockAt
  async function cleave(b, o = {}) {
    const warn = o.warn ?? 2.4, width = o.width ?? 1.05, lockAt = o.lockAt ?? 0.4;
    swing(b, 'cleave', warn + 0.35);
    const h = b.hz.cone({ x: b.pos.x, z: b.pos.z, anchor: 'boss', follow: 'player', lockAt, theta: b.playerTheta(), width, r: o.r ?? 9.5, warn, dmg: o.dmg ?? 20, label: 'Hearth Cleave', onHit: scorch(4, 3),
      onFire: () => { cam('shake', 0.25, 0.3); world('beat', 0.5); } });
    if (!o.noWait) {
      await b.wait(Math.max(0, warn - lockAt));
      if (!h.hazard.done) b.faceTo(h.hazard.theta);     // the boss commits to the locked direction
      await h; b.faceTo(null);
    }
    return h;
  }
  // Ember Slam: a disc on the player's predicted position
  function slam(b, o = {}) {
    const warn = o.warn ?? 2.4, p = b.playerAhead(o.ahead ?? 0.9);
    if (!o.noSwing) swing(b, 'slam', warn + 0.3);
    return b.hz.circle({ x: p.x, z: p.z, r: o.r ?? 2.8, warn, follow: o.follow ? 'player' : undefined, lockAt: o.lockAt ?? 0.5, dmg: o.dmg ?? 22, label: 'Ember Slam', onHit: scorch(5, 3),
      onFire: () => { cam('shake', 0.35, 0.35); world('beat', 0.7); world('floorGlow', ACC, 0.35 + 0.15 * b.phase, 0.8); } });
  }
  // Hearth Charge: a line from the boss through the player to the rim, then the boss charges down it
  async function charge(b, o = {}) {
    const warn = o.warn ?? 2.4, speed = o.speed ?? 13;
    b.stopMove();
    const th = b.playerTheta();
    const [bx, bz, len] = rimFrom(b.pos.x, b.pos.z, th, 0.9);
    const travel = Math.max(0.5, len / speed);
    b.faceTo(th); b.turnRate = 7;
    swing(b, 'charge', warn + travel + 0.2);
    const h = b.hz.line({ ax: b.pos.x, az: b.pos.z, bx, bz, width: o.width ?? 2.6, warn, active: travel + 0.15, dmg: o.dmg ?? 24, label: 'Hearth Charge', arrow: true, onHit: scorch(6, 3),
      onFire: () => { cam('shake', 0.4, 0.5); sfx('rumble', { vol: 0.7 }); } });
    await b.wait(Math.max(0, warn - 0.05));
    b.data.charging = true;
    const mv = b.moveTo(bx, bz, len / travel);
    const emberLoop = (async () => { try { while (b.data.charging) { fx('burst', chestPos(b).setY(0.5), { color: ACC, count: 5, speed: 3, size: 0.4, life: 0.6, gravity: 1, flare: false }); await b.wait(0.08); } } catch (e) { } })();
    await h;
    await mv;
    b.data.charging = false;
    b.faceTo(null); b.turnRate = b.data.turnRate || 2.4;
    cam('shake', 0.3, 0.3); world('beat', 0.6);
    fx('burst', chestPos(b).setY(0.4), { color: EMBER, count: 24, speed: 5, size: 0.45, life: 0.6, flat: true });
    await emberLoop;
    // walk back toward the heart of the arena while the next telegraph starts (not awaited)
    if (!o.stay) { const k = 0.35; b.moveTo(b.pos.x * k, b.pos.z * k, 3.2); }
    return h;
  }
  // War Horn: interruptible; completed = raid damage + hounds
  async function warHorn(b, hounds, o = {}) {
    b.stopMove();
    b.data.horn = 1;
    b.say(b.pick(['The hearth calls its hounds.', 'Come, my cinders.', 'Hear the horn and kneel.']), 2.4);
    const r = await b.cast({ name: 'War Horn', dur: o.dur ?? 3.2, interruptible: true,
      onDone: () => { b.hz.wipe(10, 'War Horn'); spawnHounds(b, hounds); world('rimGlow', ACC, 1.4, 1.2); fx('burst', chestPos(b).setY(3.6), { color: HOT, count: 40, speed: 7, size: 0.5, life: 0.8 }); },
      onInterrupt: () => { b.data.hornChoke = 1; } });
    b.data.horn = 0;
    if (r === 'interrupted') b.say('The horn falls silent.', 2.0);
    return r;
  }
  // Ember orbs: a fan of projectiles toward the player
  async function embers(b, n, o = {}) {
    swing(b, 'fling', 0.6);
    const th = b.playerTheta(), spread = o.spread ?? 0.22, speed = o.speed ?? 5.2;
    for (let i = 0; i < n; i++) {
      const a = th + (i - (n - 1) / 2) * spread;
      const p = b.hitPoint(a);
      b.hz.orb({ x: p.x, z: p.z, dir: a, speed, r: 0.5, life: o.life ?? 4.6, dmg: o.dmg ?? 14, label: 'Ember', homing: o.homing ?? 0, color: EMBER, onHit: scorch(4, 3) });
      if (o.gap) await b.wait(o.gap);
    }
    fx('burst', chestPos(b), { color: EMBER, count: 14, speed: 4, size: 0.4, life: 0.5 });
  }
  // Falling Pillars: a blue safe disc, then circles landing in sequence around it
  async function pillars(b, o = {}) {
    const n = o.n ?? 7, warn = o.warn ?? 2.2, gap = o.gap ?? 0.38, R = arenaR();
    const pt = Math.atan2(-G.player.state.pos.z, G.player.state.pos.x);        // player theta from the arena centre
    const sth = pt + b.pick([-1, 1]) * (o.safeOff ?? 1.1), sr = Math.min(6.5, R - 4);
    const sx = Math.cos(sth) * sr, sz = -Math.sin(sth) * sr;
    const total = warn + gap * (n - 1) + 0.45;
    b.say(o.line || 'Hide in the hearth\'s shadow.', 2.4);
    swing(b, 'raise', total);
    const safeH = b.hz.safe({ x: sx, z: sz, r: o.safeR ?? 2.6, warn: total, dmg: o.safeDmg ?? 15, label: 'Pyre Shadow' });
    const P = G.player.state.pos;
    const spots = [[P.x, P.z]];
    let tries = 0;
    while (spots.length < n && tries++ < 60) {
      const a = b.rand() * TAU, r = 2.5 + b.rand() * (R - 4), x = Math.cos(a) * r, z = -Math.sin(a) * r;
      if (Math.hypot(x - sx, z - sz) < (o.safeR ?? 2.6) + (o.r ?? 3.0) + 0.3) continue;
      if (spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 3.2)) continue;
      spots.push([x, z]);
    }
    const hs = [];
    for (let i = 0; i < spots.length; i++) {
      const [x, z] = spots[i];
      hs.push(b.hz.circle({ x, z, r: o.r ?? 3.0, warn, dmg: o.dmg ?? 24, label: 'Falling Pillar',
        onFire: (h) => { cam('shake', 0.3, 0.3); world('beat', 0.5); fx('lance', V3(h.hazard.x, 14, h.hazard.z), V3(h.hazard.x, 0.3, h.hazard.z), { color: ACC, width: 0.9, life: 0.35, intensity: 1.5 }); } }));
      await b.wait(gap);
    }
    await safeH;
    world('floorGlow', ACC, 0.5, 1.0);
    return hs;
  }
  // Hearthfire: the first gold ring, unblockable, with a blue gap. Long warn.
  async function hearthfire(b, o = {}) {
    const pt = Math.atan2(-G.player.state.pos.z, G.player.state.pos.x);
    const gth = pt + b.pick([-1, 1]) * (o.off ?? 1.15);
    b.say(o.line || 'Nothing shields you from the hearth.', 2.6);
    swing(b, 'raise', (o.warn ?? 3.2) + 0.3);
    b.data.flare = Math.max(b.data.flare, 0.6);
    const h = b.hz.ring({ x: 0, z: 0, r0: 0, r1: arenaR() + 0.2, warn: o.warn ?? 3.2, dmg: o.dmg ?? 45, unblockable: true, gaps: [{ theta: gth, width: o.gapW ?? 0.85 }], label: 'Hearthfire', onHit: scorch(6, 4),
      onFire: () => { cam('shake', 0.6, 0.6); world('floorGlow', DEEP, 0.9, 1.4); world('rimGlow', GOLD, 1.6, 1.2); fx('flash', ACC, 0.3, 0.4); } });
    await h;
    return h;
  }
  // Blade Rotor: two spinning cones anchored on the boss; he turns with them
  async function rotor(b, o = {}) {
    const warn = o.warn ?? 2.2, dur = o.dur ?? 6.5, omega = (o.omega ?? 0.72) * b.pick([-1, 1]);
    b.stopMove();
    const th0 = b.playerTheta() + PI / 2;
    b.say(o.line || 'Round and round the pyre.', 2.2);
    const mk = (th) => b.hz.cone({ x: b.pos.x, z: b.pos.z, anchor: 'boss', theta: th, width: o.width ?? 0.58, r: o.r ?? 14, warn, omega, dur, tick: 0.5, dmg: o.dmg ?? 11, label: 'Blade Rotor' });
    const h1 = mk(th0), h2 = mk(th0 + PI);
    b.data.spin = { h: h1.hazard, pre: true };
    swing(b, 'spin', warn + dur);
    await b.wait(warn);
    b.data.spin.pre = false; b.autoFace = false;
    const spark = (async () => { try { while (b.data.spin && !h1.hazard.done) { const th = h1.hazard.thetaAt(h1.hazard.t); for (const t of [th, th + PI]) { const p = G.polar(2.6 + Math.random() * 9, t, 0.2); p.x += b.pos.x; p.z += b.pos.z; if (Math.hypot(p.x, p.z) < arenaR()) fx('burst', p, { color: EMBER, count: 2, speed: 2, size: 0.35, life: 0.5, flat: true, flare: false }); } await b.wait(0.1); } } catch (e) { } })();
    try { await h1; } finally {
      if (b.data.spin) { b.facing = G.wrap ? G.wrap(b.data.spin.h.thetaAt(b.data.spin.h.t)) : b.data.spin.h.thetaAt(b.data.spin.h.t); }
      b.data.spin = null; b.autoFace = true;
    }
    h2.cancel();
    await spark;
    return h1;
  }
  // Hearth Wave: an expanding ring from the boss with two blue lanes
  function wave(b, o = {}) {
    const pt = b.playerTheta(), off = o.off ?? 0.95;
    const gaps = o.gaps || [{ theta: pt + off, width: o.laneW ?? 0.55 }, { theta: pt - off, width: o.laneW ?? 0.55 }];
    swing(b, 'slam', (o.warn ?? 2.4) + 0.3);
    return b.hz.wave({ x: b.pos.x, z: b.pos.z, r0: o.r0 ?? 1.6, r1: o.r1 ?? 14.5, speed: o.speed ?? 5.5, thickness: o.thickness ?? 1.15, warn: o.warn ?? 2.4, dmg: o.dmg ?? 25, gaps, label: 'Hearth Wave',
      onFire: () => { cam('shake', 0.45, 0.5); world('beat', 0.9); world('floorGlow', ACC, 0.6, 1.2); sfx('rumble', { vol: 0.6 }); } });
  }
  // Hearth Slam: the heavy blockable hit. The boss closes in; the disc follows the player until lockAt
  async function hearthSlam(b, o = {}) {
    const warn = o.warn ?? 2.5, lockAt = o.lockAt ?? 0.7;
    b.say(o.line || 'Raise your guard. It will not help.', 2.4);
    swing(b, 'heavy', warn + 0.3);
    const p = b.playerPos();
    const dx = p.x - b.pos.x, dz = p.z - b.pos.z, d = Math.hypot(dx, dz) || 1;
    const stop = Math.max(0, d - 3.2);
    b.moveTo(b.pos.x + dx / d * stop, b.pos.z + dz / d * stop, Math.max(2.5, stop / Math.max(0.6, warn - lockAt - 0.2)));
    const h = b.hz.circle({ r: o.r ?? 4.0, follow: 'player', lockAt, warn, dmg: o.dmg ?? 40, label: 'Hearth Slam',
      onFire: (hh) => { cam('shake', 0.8, 0.6); cam('hitStop', 0.06); world('beat', 1.2); world('floorGlow', DEEP, 0.8, 1.2); fx('shockwave', V3(hh.hazard.x, 0.1, hh.hazard.z), { color: HOT, radius: 8, life: 0.7, intensity: 1.2 }); sfx('crack', { vol: 1 }); } });
    await h;
    b.stopMove();
    return h;
  }

  // ------------------------------------------------------------------ transition lines
  const PHASE_LINES = [null, 'You feed the pyre.', 'All of it. Burns.'];

  // ------------------------------------------------------------------ the boss
  G.bosses[0] = {
    name: 'VARRAK', title: 'the Hearth Knight', court: 'The Court of Ash', accent: ACC, sky: 'ember', arena: 'ash', music: 0,
    maxHp: 8800, parTime: 210, hitRadius: 1.7, hitHeight: 2.5, bodyRadius: 1.4, speed: 3.2, turnRate: 2.4,
    intro: ['The hearth remembers every traitor.', 'Burn with it.'],

    phases: [
      // ============================================================ P1 KINDLING: one shape at a time, then pairs
      {
        name: 'Kindling', hpStart: 1.0, sky: ['ember', 1], intensity: 1,
        enter(b) { b.turnRate = 2.4; b.data.turnRate = 2.4; b.trackPlayer = true; b.facingTarget = null; b.autoFace = true; b.data.heat = 0.55; world('floorGlow', ACC, 0.12, 0); world('rimGlow', ACC, 0.5, 0); },
        async script(b) {
          let cycle = 0, lastHorn = b.clock - 4;
          await b.wait(1.0);
          b.loop(async () => {
            cycle++;
            if (cycle === 1) {
              // the lesson: each shape alone, long warns
              b.say('Learn the shape of the fire.', 2.4);
              await cleave(b, { warn: 2.5, width: 1.1 });
              await b.wait(0.9);
              await slam(b, { warn: 2.5, follow: true, lockAt: 0.6 });
              await b.wait(0.9);
              await charge(b, { warn: 2.5, speed: 13 });
              await b.wait(0.8);
              lastHorn = b.clock; await warHorn(b, 2);
              await b.wait(0.8);
              return;
            }
            // pairs: a cleave with a disc under the player, a charge that ends in a slam, two discs in a row
            const c = cleave(b, { warn: 2.1, width: 1.1, noWait: true });
            await b.wait(0.5);
            await slam(b, { warn: 2.0, follow: true, lockAt: 0.6 });
            await c;
            await b.wait(0.6);
            await charge(b, { warn: 2.1, speed: 13, stay: true });
            if (cycle >= 3) { await b.wait(0.3); await charge(b, { warn: 2.0, speed: 13, stay: true }); }
            await slam(b, { warn: 1.9, follow: true, lockAt: 0.6, r: 3.0 });
            b.moveTo(b.pos.x * 0.35, b.pos.z * 0.35, 3.4);
            await b.wait(0.5);
            if (b.clock - lastHorn > 17) { lastHorn = b.clock; await warHorn(b, 2); await b.wait(0.6); }
            const c2 = cleave(b, { warn: 2.0, width: 1.15, noWait: true });
            await b.wait(0.4);
            const s1 = slam(b, { warn: 1.9, follow: true, lockAt: 0.6 });
            await b.wait(0.9);
            const s2 = slam(b, { warn: 1.9, follow: true, lockAt: 0.6, r: 2.7 });
            await b.wait(0.9);
            const s3 = slam(b, { warn: 1.9, follow: true, lockAt: 0.6, r: 2.7 });
            await c2; await s1; await s2; await s3;
            await b.wait(0.5);
          });
        },
      },
      // ============================================================ P2 PYRE: faster, pillars, orbs, the first gold ring
      {
        name: 'Pyre', hpStart: 0.65, sky: ['ember', 2], intensity: 2,
        enter(b) { b.turnRate = 2.8; b.data.turnRate = 2.8; b.trackPlayer = true; b.facingTarget = null; b.autoFace = true; b.data.heat = 1.0; world('floorGlow', ACC, 0.22, 0); world('rimGlow', ACC, 0.9, 0); },
        async script(b) {
          let cycle = 0, lastHorn = b.clock - 2;
          await b.wait(0.8);
          b.loop(async () => {
            cycle++;
            const first = cycle === 1;
            // 1. cleave, then an ember volley (the orb lesson)
            const c = cleave(b, { warn: 2.0, width: 1.15, noWait: true });
            await b.wait(first ? 1.6 : 0.8);
            await embers(b, first ? 4 : 5, { spread: first ? 0.28 : 0.22, gap: 0.12, homing: first ? 0.1 : 0.3, speed: 5 });
            await c;
            await b.wait(first ? 1.2 : 0.6);
            // 2. falling pillars around a blue disc; later a cleave sweeps while they fall
            const pl = pillars(b, { n: first ? 7 : 8, warn: 2.2, gap: 0.34, r: 3.1, line: first ? 'Hide in the hearth\'s shadow.' : 'Into the shadow.' });
            if (!first) { await b.wait(1.4); await cleave(b, { warn: 1.9, width: 1.0 }); }
            await pl;
            await b.wait(0.3);
            await embers(b, 6, { spread: 0.26, gap: 0.1, homing: 0.35, speed: 5.2 });
            await b.wait(0.8);
            // 3. a charge that ends in a slam, then embers
            await charge(b, { warn: 2.0, speed: 14, stay: true });
            if (!first) { await b.wait(0.3); await charge(b, { warn: 1.9, speed: 14, stay: true }); }
            await slam(b, { warn: 1.9, follow: true, lockAt: 0.6, r: 3.0 });
            b.moveTo(b.pos.x * 0.35, b.pos.z * 0.35, 3.6);
            await b.wait(0.6);
            // 4. the horn, then an ember volley while the hounds (if any) close in
            if (b.clock - lastHorn > 18) { lastHorn = b.clock; await warHorn(b, 2); await b.wait(0.6); }
            await embers(b, 6, { spread: 0.24, gap: 0.1, homing: 0.35, speed: 5.2 });
            await b.wait(1.4);
            // 5. the gold ring, then a disc on whoever stood still
            await hearthfire(b, { warn: first ? 3.4 : 3.0, line: first ? 'Nothing shields you from the hearth.' : 'The hearth takes the floor.' });
            const sa = slam(b, { warn: 1.9, follow: true, lockAt: 0.6, r: 3.0 });
            await b.wait(0.9);
            await slam(b, { warn: 1.9, follow: true, lockAt: 0.6, r: 2.8 });
            await sa;
            await b.wait(0.6);
            if (!first) { const s = slam(b, { warn: 2.0, follow: true, lockAt: 0.6, r: 2.8 }); await b.wait(0.4); await cleave(b, { warn: 1.9, width: 1.1 }); await s; await b.wait(0.5); }
          });
        },
      },
      // ============================================================ P3 CONFLAGRATION: rotor, waves, the heavy slam
      {
        name: 'Conflagration', hpStart: 0.3, sky: ['ember', 3], intensity: 3,
        enter(b) { b.turnRate = 3.0; b.data.turnRate = 3.0; b.trackPlayer = true; b.facingTarget = null; b.autoFace = true; b.data.heat = 1.5; world('floorGlow', DEEP, 0.32, 0); world('rimGlow', ACC, 1.3, 0); },
        async script(b) {
          let cycle = 0, lastHorn = b.clock - 6;
          await b.wait(0.6);
          b.loop(async () => {
            cycle++;
            const first = cycle === 1;
            // 1. the rotor from the centre; discs chase the player between the blades and embers fly mid-spin
            await b.moveTo(0, 0, 4.5);
            const dur = first ? 6.0 : 7.0;
            const rt = rotor(b, { warn: first ? 2.4 : 2.1, dur, omega: first ? 0.68 : 0.78, line: first ? 'Round and round the pyre.' : null });
            const mid = (async () => {
              await b.wait((first ? 2.4 : 2.1) + 0.6);
              const end = b.clock + dur - 1.6;
              let k = 0;
              while (b.clock < end && b.data.spin) {
                slam(b, { warn: 1.8, follow: true, lockAt: 0.6, r: 2.6, dmg: 20, noSwing: true });
                if (k === 1) { const th = b.playerTheta(); for (let i = -1; i <= 1; i++) { const p = b.hitPoint(th + i * 0.35); b.hz.orb({ x: p.x, z: p.z, dir: th + i * 0.35, speed: 5, r: 0.5, life: 4.5, dmg: 12, label: 'Ember', color: EMBER }); } }
                k++; await b.wait(first ? 1.7 : 1.5);
              }
            })();
            await rt; await mid;
            await b.wait(0.8);
            // 2. a hearth wave with a cleave riding on it
            const wv = wave(b, { warn: 2.4 });
            await b.wait(0.6); await cleave(b, { warn: 1.8, width: 1.05 });
            await wv;
            await embers(b, 5, { spread: 0.3, gap: 0.12, homing: 0.35, speed: 5.2 });
            await b.wait(0.8);
            // 3. two discs, then the heavy slam: Bulwark it and Riposte
            slam(b, { warn: 1.9, follow: true, lockAt: 0.6, r: 2.8, noSwing: true });
            await b.wait(0.9);
            slam(b, { warn: 1.9, follow: true, lockAt: 0.6, r: 2.8, noSwing: true });
            await b.wait(0.9);
            await hearthSlam(b, { warn: 2.5, lockAt: 0.55, line: first ? 'Raise your guard. It will not help.' : 'Kneel.' });
            await b.wait(0.6);
            // 4. the horn: three hounds. Then an ember volley
            if (b.clock - lastHorn > 20) { lastHorn = b.clock; await warHorn(b, 3, { dur: 3.0 }); await b.wait(0.6); }
            await embers(b, 6, { spread: 0.22, gap: 0.1, homing: 0.35, speed: 5.2 });
            await b.wait(1.2);
            // 5. a charge that ends in a slam, then a double wave with the same lanes
            await charge(b, { warn: 2.0, speed: 14, stay: true });
            await b.wait(0.3); await charge(b, { warn: 1.9, speed: 14, stay: true });
            await slam(b, { warn: 1.9, follow: true, lockAt: 0.6, r: 3.0 });
            await b.moveTo(b.pos.x * 0.3, b.pos.z * 0.3, 4.5);
            const pt = b.playerTheta();
            const gaps = [{ theta: pt + 1.0, width: 0.6 }, { theta: pt - 1.0, width: 0.6 }];
            const w1 = wave(b, { warn: 2.4, gaps, speed: 5.5 });
            await b.wait(1.1);
            const w2 = wave(b, { warn: 2.0, gaps, speed: 5.5 });
            await b.wait(0.6); await embers(b, 5, { spread: 0.3, gap: 0.12, homing: 0.35, speed: 5.2 });
            await b.wait(0.5); slam(b, { warn: 1.9, follow: true, lockAt: 0.6, r: 2.8, noSwing: true });
            await w1; await w2;
            await b.wait(0.6);
            if (cycle >= 2) { await hearthfire(b, { warn: 3.0, gapW: 0.9, line: 'The hearth takes the floor.' }); await slam(b, { warn: 1.9, follow: true, lockAt: 0.6, r: 3.0 }); await b.wait(0.8); }
          });
        },
      },
    ],

    // ------------------------------------------------------------ model (local +x is the front)
    build(b) {
      const d = b.data;
      d.heat = 0.55; d.flare = 0; d.swing = null; d.horn = 0; d.hornChoke = 0; d.spin = null; d.kneel = 0; d.gutter = 0; d.dead = false; d.charging = false; d.emberT = 0; d.turnRate = 2.4;
      d.pose = { ry: 0, rz: 0, sz: -0.55, lz: 0, lean: 0, hy: 0 };
      const g = new T3.Group();
      const plate = G.mat.brass({ color: '#2a2024', metalness: 0.85, roughness: 0.42 });
      const iron = G.mat.brass({ color: '#4a3c40', metalness: 0.75, roughness: 0.55 });
      const trim = G.mat.brass({ color: '#a8762e', metalness: 0.95, roughness: 0.32 });
      const cloth = G.mat.brass({ color: '#3a0f12', metalness: 0.15, roughness: 0.9, side: T3.DoubleSide });
      const hearthM = G.mat.emissive(ACC, 2.0), coreM = G.mat.emissive('#ffdcae', 2.6), visorM = G.mat.emissive(HOT, 2.2), edgeM = G.mat.emissive(EMBER, 1.5);
      d.hearthM = hearthM; d.coreM = coreM; d.edgeM = edgeM; d.visorM = visorM;
      d.hearthBase = hearthM.color.clone(); d.edgeBase = edgeM.color.clone(); d.visorBase = visorM.color.clone();
      const box = (w, h, dd, m, x, y, z) => { const mm = new T3.Mesh(new T3.BoxGeometry(w, h, dd), m); mm.position.set(x, y, z); return mm; };
      const cyl = (r0, r1, h, m, x, y, z) => { const mm = new T3.Mesh(new T3.CylinderGeometry(r0, r1, h, 10), m); mm.position.set(x, y, z); return mm; };
      // legs
      d.legs = [];
      for (const s of [-1, 1]) {
        const leg = new T3.Group(); leg.position.set(0, 1.55, s * 0.55);
        leg.add(box(0.56, 1.5, 0.52, iron, 0, -0.75, 0));
        leg.add(box(0.5, 0.3, 0.6, trim, 0, -0.08, 0));
        leg.add(box(0.8, 0.36, 0.62, plate, 0.1, -1.45, 0));
        g.add(leg); d.legs.push(leg);
      }
      // torso
      const torso = new T3.Group(); torso.position.y = 1.55; g.add(torso); d.torso = torso;
      torso.add(box(1.5, 1.95, 1.7, plate, 0, 1.0, 0));
      torso.add(box(1.35, 0.5, 1.55, trim, 0.05, 0.12, 0));
      torso.add(box(1.1, 0.26, 1.85, trim, 0.2, 1.98, 0));
      torso.add(box(0.2, 1.4, 0.3, trim, 0.78, 1.0, 0.55)); torso.add(box(0.2, 1.4, 0.3, trim, 0.78, 1.0, -0.55));
      // the hearth in the chest
      const hg = new T3.Group(); hg.position.set(0.72, 1.08, 0); torso.add(hg); d.hearthG = hg;
      d.hearth = new T3.Mesh(new T3.SphereGeometry(0.44, 16, 12), hearthM); hg.add(d.hearth);
      d.core = new T3.Mesh(new T3.SphereGeometry(0.2, 10, 8), coreM); d.core.position.x = 0.15; hg.add(d.core);
      d.hearthGlow = G.fx && G.fx.glowSprite ? G.fx.glowSprite(ACC, 2.6, { intensity: 1.1, opacity: 0.55 }) : null; if (d.hearthGlow) { d.hearthGlow.position.x = 0.3; hg.add(d.hearthGlow); }
      for (let i = -1; i <= 1; i++) hg.add(box(0.1, 1.0, 0.07, iron, 0.42, 0, i * 0.27));
      hg.add(box(0.1, 0.07, 0.9, iron, 0.42, 0.3, 0)); hg.add(box(0.1, 0.07, 0.9, iron, 0.42, -0.3, 0));
      // pauldrons with spikes
      for (const s of [-1, 1]) {
        const p = new T3.Mesh(new T3.SphereGeometry(0.64, 12, 8, 0, TAU, 0, PI / 2), plate); p.position.set(0, 1.95, s * 1.0); torso.add(p);
        const rim = new T3.Mesh(new T3.TorusGeometry(0.62, 0.06, 6, 18), trim); rim.rotation.x = PI / 2; rim.position.set(0, 1.97, s * 1.0); torso.add(rim);
        const spike = new T3.Mesh(new T3.ConeGeometry(0.17, 0.8, 8), trim); spike.position.set(-0.1, 2.5, s * 1.15); spike.rotation.x = -s * 0.5; torso.add(spike);
      }
      // head
      const head = new T3.Group(); head.position.set(0.1, 2.45, 0); torso.add(head); d.head = head;
      head.add(box(0.82, 0.88, 0.82, plate, 0, 0.42, 0));
      head.add(box(0.12, 0.1, 0.52, visorM, 0.42, 0.5, 0));
      head.add(box(0.95, 0.5, 0.1, trim, -0.05, 0.98, 0));
      head.add(box(0.5, 0.12, 0.9, trim, 0.2, 0.08, 0));
      // arms
      const mkArm = (s) => { const a = new T3.Group(); a.position.set(0.15, 1.95, s * 1.08); a.add(cyl(0.24, 0.28, 1.3, iron, 0, -0.65, 0)); a.add(box(0.46, 0.46, 0.46, trim, 0, -1.36, 0)); torso.add(a); return a; };
      d.armR = mkArm(1); d.armL = mkArm(-1);
      // the greatsword (local +x along the blade)
      const sw = new T3.Group(); sw.position.set(0, -1.4, 0); d.armR.add(sw); d.sword = sw;
      sw.add(box(3.4, 0.09, 0.46, iron, 1.95, 0, 0));
      sw.add(box(3.3, 0.12, 0.07, edgeM, 1.95, 0, 0.25)); sw.add(box(3.3, 0.12, 0.07, edgeM, 1.95, 0, -0.25));
      const tip = new T3.Mesh(new T3.ConeGeometry(0.25, 0.5, 4), iron); tip.rotation.z = -PI / 2; tip.rotation.y = PI / 4; tip.position.x = 3.9; sw.add(tip);
      sw.add(box(0.26, 0.22, 1.2, trim, 0.2, 0, 0));
      sw.add(box(0.7, 0.17, 0.17, cloth, -0.4, 0, 0));
      const pom = new T3.Mesh(new T3.SphereGeometry(0.16, 8, 6), trim); pom.position.x = -0.8; sw.add(pom);
      const fuller = box(2.6, 0.11, 0.1, G.mat.emissive(DEEP, 1.2), 1.9, 0, 0); sw.add(fuller); d.fuller = fuller;
      d.swordGlow = G.fx && G.fx.glowSprite ? G.fx.glowSprite(EMBER, 1.6, { intensity: 0.9, opacity: 0.35 }) : null; if (d.swordGlow) { d.swordGlow.position.x = 2.0; sw.add(d.swordGlow); }
      // the horn in the left hand
      const horn = new T3.Group(); horn.position.set(0, -1.4, 0); d.armL.add(horn); d.hornG = horn;
      const hc = new T3.Mesh(new T3.ConeGeometry(0.22, 0.95, 10, 1, true), trim); hc.material = G.mat.brass({ color: '#a8762e', metalness: 0.95, roughness: 0.32, side: T3.DoubleSide }); hc.rotation.z = -1.2; hc.position.set(0.3, 0.2, 0); horn.add(hc);
      const hring = new T3.Mesh(new T3.TorusGeometry(0.24, 0.04, 6, 14), G.mat.emissive(HOT, 1.6)); hring.rotation.y = PI / 2; hring.rotation.z = -1.2; hring.position.set(0.58, 0.63, 0); horn.add(hring);
      // cape
      const cape = new T3.Mesh(new T3.PlaneGeometry(2.0, 2.7, 1, 4), cloth); cape.position.set(-0.82, 0.8, 0); cape.rotation.y = PI / 2; torso.add(cape); d.cape = cape;
      // foot glow
      const fg = G.fx && G.fx.glowSprite ? G.fx.glowSprite(ACC, 3.6, { intensity: 0.8, opacity: 0.22 }) : null; if (fg) { fg.position.y = 0.12; g.add(fg); d.footGlow = fg; }
      g.scale.setScalar(1.15);
      b.model = g;
    },

    // ------------------------------------------------------------ animation
    animate(b, dt) {
      const d = b.data; if (!d.torso) return;
      dt = Math.min(dt, 0.1);
      const t = b.clock, P = d.pose;
      // ---- target pose
      let ry = 0, rz = 0, sz = -0.55, lz = 0, lean = 0, hy = 0, rate = 7, hornK = d.horn ? 1 : 0;
      const sw = d.swing;
      if (sw) {
        sw.t += dt; const u = clamp(sw.t / sw.dur);
        switch (sw.kind) {
          case 'cleave': if (u < 0.78) { ry = 1.25; sz = -0.15; rz = 0.4; rate = 5; } else if (u < 0.9) { ry = -1.7; sz = -0.1; rz = 0.5; rate = 30; } else { ry = -1.2; sz = -0.3; rate = 6; } break;
          case 'slam': if (u < 0.8) { rz = 2.5; sz = -0.25; lean = -0.08; rate = 5; } else if (u < 0.9) { rz = 0.75; sz = -0.95; lean = 0.22; rate = 32; } else { rz = 0.7; sz = -0.9; lean = 0.15; rate = 6; } break;
          case 'heavy': if (u < 0.8) { rz = 2.7; sz = -0.1; lean = -0.14; lz = 0.6; rate = 4.5; } else if (u < 0.9) { rz = 0.6; sz = -1.05; lean = 0.3; rate = 34; } else { rz = 0.55; sz = -1.0; lean = 0.2; rate = 5; } break;
          case 'charge': if (u < 0.75) { lean = -0.1; rz = 0.9; sz = -0.1; rate = 5; } else { lean = 0.32; rz = 1.3; sz = -0.05; rate = 8; } break;
          case 'raise': rz = 2.3; sz = 0.2; lz = 0.9; lean = -0.12; rate = 4; break;
          case 'fling': rz = 1.6; sz = 0; lz = 1.2; lean = 0.1; rate = 20; break;
          case 'spin': rz = 1.57; sz = 0; lean = 0.05; rate = 6; break;
          case 'roar': rz = 1.9; sz = 0.3; lz = 1.9; lean = -0.3; hy = -0.35; rate = 4; break;
        }
        if (u >= 1) d.swing = null;
      }
      if (hornK) { lz = 2.2; hy = -0.28; }
      if (d.hornChoke > 0) { d.hornChoke = Math.max(0, d.hornChoke - dt * 1.4); lz = 0.6; lean = 0.25 * d.hornChoke; hy = 0.3 * d.hornChoke; }
      if (b.staggerT > 0 && !d.dead) { lean = 0.28; rz = 0.5; sz = -1.1; hy = 0.25; }
      // kneeling (death)
      const k = d.kneel;
      if (k > 0) { lean = lerp(lean, 0.45, k); rz = lerp(rz, 0.5, k); sz = lerp(sz, -1.25, k); lz = lerp(lz, 0.3, k); hy = lerp(hy, 0.5, k); rate = 5; }
      // ---- blend
      const kk = 1 - Math.exp(-rate * dt);
      P.ry += (ry - P.ry) * kk; P.rz += (rz - P.rz) * kk; P.sz += (sz - P.sz) * kk; P.lz += (lz - P.lz) * kk; P.lean += (lean - P.lean) * kk; P.hy += (hy - P.hy) * kk;
      // idle breathing + walk bob
      const walking = !!b._move && b.staggerT <= 0 && !d.dead;
      const bob = walking ? Math.abs(Math.sin(t * 7)) * 0.12 : Math.sin(t * 1.3) * 0.04;
      const legSwing = walking ? Math.sin(t * 7) * 0.45 : 0;
      d.legs[0].rotation.z = lerp(legSwing, -1.35, k); d.legs[1].rotation.z = lerp(-legSwing, 1.15, k);
      d.torso.position.y = 1.55 + bob - k * 0.95;
      d.torso.rotation.z = -P.lean + Math.sin(t * 1.3) * 0.012;
      d.torso.scale.y = 1 + Math.sin(t * 1.3) * 0.012;
      d.armR.rotation.set(0, P.ry, P.rz + Math.sin(t * 1.3 + 1) * 0.02);
      d.sword.rotation.set(0, 0, P.sz);
      d.armL.rotation.set(0, 0, -P.lz - Math.sin(t * 1.3 + 2) * 0.02);
      d.head.rotation.z = P.hy;
      d.hornG.rotation.z = hornK ? 0.9 : 0;
      if (d.cape) { d.cape.rotation.z = -0.15 - (walking ? 0.35 : 0) - Math.sin(t * 2.1) * 0.04 - (d.charging ? 0.5 : 0); }
      // spin: the body turns with the rotor blade
      if (d.spin && d.spin.h && !d.spin.pre) { try { b.root.rotation.y = d.spin.h.thetaAt(d.spin.h.t) + (b.def.facingOffset || 0); } catch (e) { } }
      // ---- the hearth
      d.flare = Math.max(0, d.flare - dt * 0.55);
      const heat = d.heat * (1 - d.gutter) + d.flare * 1.3;
      const flick = 1 + Math.sin(t * 9.1) * 0.05 + Math.sin(t * 23.7) * 0.03 * (1 + d.gutter * 6) + (d.gutter > 0 && Math.random() < d.gutter * 0.3 ? -0.3 : 0);
      const hs = (0.85 + 0.3 * Math.min(1.6, heat)) * flick;
      d.hearthG.scale.setScalar(Math.max(0.05, hs));
      const hc = clamp(0.55 + 0.45 * heat, 0.05, 1.5);
      d.hearthM.color.copy(d.hearthBase).multiplyScalar(hc);
      d.coreM.color.copy(d.hearthBase).lerp(new T3.Color(1, 0.9, 0.7), 0.6).multiplyScalar(1.1 * hc + 0.3);
      d.edgeM.color.copy(d.edgeBase).multiplyScalar(clamp(0.5 + 0.5 * heat, 0.1, 1.4));
      d.visorM.color.copy(d.visorBase).multiplyScalar(clamp(0.6 + 0.4 * heat, 0.1, 1.4));
      if (d.hearthGlow) { d.hearthGlow.material.opacity = clamp(0.3 + 0.3 * heat, 0, 0.85) * (1 - d.gutter * 0.9); d.hearthGlow.scale.setScalar(2.2 + 1.3 * Math.min(1.8, heat)); }
      if (d.swordGlow) { d.swordGlow.material.opacity = clamp(0.2 + 0.25 * heat, 0, 0.7) * (1 - d.gutter); }
      if (d.footGlow) { d.footGlow.material.opacity = clamp(0.12 + 0.12 * heat, 0, 0.5) * (1 - d.gutter); d.footGlow.scale.setScalar(3.2 + heat); }
      // embers rising from the chest
      if (!d.dead && (PLAYING() || G.state === 'cinematic')) {
        d.emberT -= dt;
        if (d.emberT <= 0) {
          d.emberT = 0.28 / (0.6 + heat);
          const p = chestPos(b); p.y = 2.5 + Math.random() * 0.4;
          fx('burst', p, { color: Math.random() < 0.3 ? HOT : ACC, count: 1 + Math.round(heat * 1.5), speed: 1.1, size: 0.26, life: 1.5, gravity: -0.8, drag: 1.2, up: 1.1, flare: false });
        }
      }
    },

    // ------------------------------------------------------------ cinematics
    onTransition(b, from, to) {
      const d = b.data;
      d.swing = null; d.spin = null; b.autoFace = true; d.charging = false; d.horn = 0;
      d.flare = 1.4;
      swing(b, 'roar', 3.0);
      const line = PHASE_LINES[to]; if (line) setTimeout(() => { try { b.say(line, 3.0); } catch (e) { } }, 500);
      fx('flash', ACC, 0.4, 0.6);
      fx('shockwave', b.pos.clone().setY(0.3), { color: ACC, radius: 17, life: 1.3 });
      cam('shake', 0.6, 0.9);
      world('floorGlow', ACC, 1.0, 2.8); world('rimGlow', ACC, 1.8, 3.0);
      sfx('swell', { vol: 0.9 });
      const home = G.camera ? G.camera.position.toArray() : [0, 20, 16];
      const bx = b.pos.x, bz = b.pos.z;
      const cin = cam('cinematic', [
        { t: 0, pos: home, look: [0, 0.5, 0] },
        { t: 1.2, pos: frontCam(b, 9.5, 3.4, 0.5), look: [bx, 3.0, bz] },
        { t: 2.6, pos: frontCam(b, 12, 5.5, -0.2), look: [bx, 2.8, bz] },
        { t: 3.6, pos: home, look: [0, 0.5, 0] },
      ], { name: 'varrak-transition' });
      (async () => {
        try {
          for (let i = 0; i < 5; i++) {
            await G.combat.wait(0.35 + i * 0.12);
            if (!b.alive) return;
            const p = chestPos(b); p.y += (Math.random() - 0.5) * 0.4;
            fx('burst', p, { color: i % 2 ? HOT : ACC, count: 26 + to * 8, speed: 6 + i, size: 0.5, life: 0.9, up: 0.8 });
            fx('shockwave', b.pos.clone().setY(0.25), { color: i % 2 ? HOT : DEEP, radius: 6 + i * 2.5, life: 0.6 });
            cam('shake', 0.3, 0.3); sfx('crack', { vol: 0.7 });
            if (to >= 2 || i % 2) world('meteor', ACC);
          }
          await G.combat.wait(0.5);
          fx('lance', chestPos(b), chestPos(b).setY(16), { color: HOT, width: 1.2, life: 0.6, intensity: 1.6 });
          fx('flash', HOT, 0.3, 0.5);
          sfx('thunder', { vol: 0.8 });
        } catch (e) { }
      })();
      return cin || Promise.resolve();
    },

    async onDeath(b) {
      const d = b.data;
      d.swing = null; d.spin = null; b.autoFace = true; d.charging = false; d.horn = 0; d.dead = true;
      cam('slowMo', 0.35, 1.4);
      fx('flash', HOT, 0.4, 0.5); cam('shake', 0.6, 0.6);
      fx('burst', chestPos(b), { color: HOT, count: 40, speed: 7, size: 0.6, life: 1.0 });
      const home = G.camera ? G.camera.position.toArray() : [0, 20, 16];
      const bx = b.pos.x, bz = b.pos.z;
      const cin = cam('cinematic', [
        { t: 0, pos: home, look: [0, 0.5, 0] },
        { t: 1.6, pos: frontCam(b, 9.0, 4.2, 0.55), look: [bx, 2.0, bz] },
        { t: 5.2, pos: frontCam(b, 10.0, 4.6, 0.2), look: [bx, 1.8, bz] },
        { t: 7.2, pos: frontCam(b, 14, 8.5, -0.1), look: [bx, 2.0, bz] },
        { t: 8.6, pos: home, look: [0, 0.5, 0] },
      ], { name: 'varrak-death' });
      const W = (s) => G.combat.wait(s);
      // he kneels
      const k0 = G.t;
      (async () => { try { while (d.kneel < 1) { await W(0.03); d.kneel = clamp(d.kneel + 0.03 / 1.3); } } catch (e) { } })();
      await W(0.9);
      sfx('rumble', { vol: 0.8 }); cam('shake', 0.4, 0.5);
      fx('burst', b.pos.clone().setY(0.3), { color: '#7a5a46', count: 30, speed: 4, size: 0.5, life: 0.9, flat: true, hot: false });
      await W(0.8);
      b.say('The hearth... remembers.', 3.0);
      // the hearth gutters out
      for (let i = 0; i < 24; i++) { await W(0.1); d.gutter = clamp(i / 22); if (i % 6 === 0) fx('burst', chestPos(b), { color: ACC, count: 8, speed: 2, size: 0.3, life: 1.2, gravity: -0.5, flare: false }); }
      world('floorGlow', ACC, 0.0, 1.5); world('rimGlow', ACC, 0.0, 1.5);
      await W(1.0);
      // then it bursts
      d.flare = 2.2; d.gutter = 0;
      sfx('swell', { vol: 1 });
      for (let i = 0; i < 6; i++) { await W(0.16); fx('burst', chestPos(b).setY(2.4 + i * 0.3), { color: i % 2 ? HOT : ACC, count: 28, speed: 6 + i * 1.5, size: 0.55, life: 1.0 }); cam('shake', 0.35, 0.3); sfx('crack', { vol: 0.8 }); }
      fx('flash', '#fff1d6', 0.6, 0.8);
      fx('shockwave', b.pos.clone().setY(0.4), { color: HOT, radius: 24, life: 1.6, intensity: 1.1 });
      fx('shards', chestPos(b), { color: '#ffb070', count: 40, speed: 9, size: 0.2, life: 1.8, gravity: 4, floor: true });
      fx('shards', b.pos.clone().setY(2.0), { color: '#6a5248', count: 30, speed: 7, size: 0.28, life: 2.0, gravity: 5, floor: true });
      cam('shake', 1.2, 1.0); sfx('bossDeath', { vol: 1 }); sfx('thunder', { vol: 0.9 });
      world('beat', 1.5); world('rimGlow', HOT, 1.1, 2.0);
      for (let i = 0; i < 3; i++) world('meteor', HOT);
      if (b.root) b.root.visible = false;
      await W(2.2);
      return cin || Promise.resolve();
    },

    teardown(b) {
      const d = b.data || {};
      d.swing = null; d.spin = null; d.charging = false; d.horn = 0; d.kneel = 0; d.gutter = 0; d.dead = false; d.flare = 0;
      b.autoFace = true;
      if (b.root) b.root.visible = true;
      world('floorGlow', ACC, 0, 0.3); world('rimGlow', ACC, 0, 0.3);
    },
  };
})();
