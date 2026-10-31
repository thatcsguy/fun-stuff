// =====================================================================
// 12_boss3.js: COURT III, THE COURT OF TIDES. MORVANNA, the Drowned Queen.
//
// A tall drowned queen in a waterlogged gown, crown of coral, trailing kelp, a trident. She walks slowly, submerges
// and resurfaces elsewhere, and the tide rises with every phase (the arena shrinks 13 -> 11 -> 9).
//   Tide Line     a bar sweeps across the whole arena; a blue lane marks the gap. Stand in the lane or dash through.
//   Whirlpool     a ring fills around a point while you are pulled toward its centre: walk against the pull or dive
//                 to the eye (the centre is safe).
//   Riptide       gold, unblockable wave from the queen with two blue lanes: dash through it or stand in a lane.
//   Spindrift     orbs fanned from the trident (Rebuke clears them).
//   Trident Thrust / Slam   blockable cone / heavy circle (the Riposte opportunity).
//   Dirge         interruptible 3.5 s cast: completed = drowned adds + 10 raid damage, interrupted = Exposed.
//   Undertow (P3) the whirlpool is centred on the queen and repeats. Deluge (P3): the final interruptible cast.
// =====================================================================
(() => {
  const T3 = G.THREE, PI = Math.PI, TAU = PI * 2;
  const ACC = '#3dffa2', FOAM = '#dffff4', DEEP = '#0b2a30', KELP = '#0f4a35';
  const PHASE_R = [13, 11, 9];                               // the rising tide: live arena radius per phase
  const world = (fn, ...a) => { try { const w = G.world; if (w && typeof w[fn] === 'function') return w[fn](...a); } catch (e) { /* world may be mid-build */ } };
  const R = () => { try { const w = G.world; return (w && w.arenaR != null) ? w.arenaR : (G.ARENA_R || 13); } catch (e) { return G.ARENA_R || 13; } };
  const sfx = (n, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(n, o); } catch (e) { /* audio optional */ } };
  const fx = (n, ...a) => { try { const f = G.fx && G.fx[n]; if (f) return f(...a); } catch (e) { /* fx optional */ } };
  const cam = (n, ...a) => { try { const f = G.cam && G.cam[n]; if (f) return f(...a); } catch (e) { /* cam optional */ } };
  const post = (n, ...a) => { try { const f = G.post && G.post[n]; if (f) return f(...a); } catch (e) { /* post optional */ } };
  const V = (x, y, z) => new T3.Vector3(x, y, z);
  const polar = (r, th, y = 0) => G.polar(r, th, y);
  const liveBoss = (b) => b && b.alive && G.combat && G.combat.boss === b;
  const PLAYING = () => G.state === 'fight' || G.state === 'practice';

  // ================================================================ hazards
  // Tide Line: a bar spanning the arena sweeps across it along `theta`; a blue lane (the gap) runs the whole way.
  function tideLine(b, o = {}) {
    const Ra = R() + 1.4, L = 2 * Ra;
    const th = o.theta != null ? o.theta : b.rand() * TAU;
    const dx = Math.cos(th), dz = -Math.sin(th);             // travel direction
    const nx = -dz, nz = dx;                                 // bar axis
    const g = (o.gapU != null ? o.gapU : b.randRange(-0.55, 0.55)) * R();
    const gw = o.gapW || 3.2, w = o.width || 1.7, warn = o.warn || 2.6;
    const dur = o.dur || L / (o.speed || 6);
    const col = o.color || ACC;
    const centre = (lt) => { const u = G.clamp((lt - warn) / dur, 0, 1); const s = -Ra + L * u; return [dx * s, dz * s]; };
    const barRot = Math.atan2(-nz, nx);
    return b.hz.custom({
      warn, active: dur, dmg: o.dmg || 22, label: o.label || 'Tide Line', color: col,
      test(px, pz, lt, pad) {
        if (lt < warn) return false;
        const c = centre(lt), rx = px - c[0], rz = pz - c[1];
        if (Math.abs(rx * dx + rz * dz) > w / 2 + pad) return false;
        const along = rx * nx + rz * nz;
        if (Math.abs(along) > Ra + pad) return false;
        if (Math.abs(along - g) <= gw / 2 - pad) return false;
        return true;
      },
      draw(group) {
        const tm = G.hz.teleMesh, Y = G.hz.TELE_Y;
        const pre = tm({ shape: 'rect', x: 0, z: 0, len: L, width: 2 * Ra, rot: th, color: col, arrow: true, y: Y - 0.012 });
        pre.material.uniforms.uAlpha.value = 0.28; pre.userData.noFill = true; group.add(pre);
        const lane = tm({ shape: 'rect', x: nx * g, z: nz * g, len: L, width: gw, rot: th, color: G.hz.COL.safe, mode: 2, y: Y + 0.004 }); group.add(lane);
        const segs = [];
        const mk = (off, len) => { if (len < 0.3) return; const m = tm({ shape: 'rect', len, width: w, rot: barRot, color: col, y: Y + 0.01 }); m.userData.off = off; group.add(m); segs.push(m); };
        mk((-Ra + (g - gw / 2)) / 2, (g - gw / 2) + Ra);
        mk(((g + gw / 2) + Ra) / 2, Ra - (g + gw / 2));
        const place = (lt) => { const c = centre(lt); for (const m of segs) { const off = m.userData.off; m.position.x = c[0] + nx * off; m.position.z = c[1] + nz * off; } };
        place(0);
        let first = true, sprayT = 0;
        return (lt, dtH, dtR) => {
          if (first) { first = false; lane.material.uniforms.uMode.value = 2; }
          place(lt);
          if (lt < warn) return;
          pre.material.uniforms.uAlpha.value = Math.max(0.08, 0.28 - (lt - warn) * 0.25);
          sprayT -= dtR;
          if (sprayT <= 0) {
            sprayT = 0.11; const c = centre(lt), s = (Math.random() * 2 - 1) * (R() - 0.5);
            if (Math.abs(s - g) > gw / 2) fx('burst', V(c[0] + nx * s, 0.15, c[1] + nz * s), { color: Math.random() < 0.5 ? col : FOAM, count: 4, speed: 2.4, size: 0.32, life: 0.5, up: 1.4, gravity: 3 });
          }
        };
      },
      onFire() {
        const c = centre(warn);
        sfx('rumble', { dur: dur, vol: 0.6 });
        fx('lance', V(c[0] - nx * Ra, 0.4, c[1] - nz * Ra), V(c[0] + nx * Ra, 0.4, c[1] + nz * Ra), { color: col, width: 1.0, life: 0.35, intensity: 1.3, flare: false });
      },
    });
  }

  // Whirlpool: a ring hazard with the player pulled toward its centre during the warn; the eye is safe.
  function whirlpool(b, o = {}) {
    const x = o.x || 0, z = o.z || 0, r0 = o.r0 || 2.2, r1 = o.r1 || 5.6, warn = o.warn || 3.4, pull = o.pull || 3.2;
    const h = b.hz.ring({ x, z, r0, r1, warn, active: 1.0, tick: 0.5, dmg: o.dmg || 24, label: o.label || 'Whirlpool' });
    spinner(b, x, z, r1, warn + 1.2);
    sfx('swell', { vol: 0.5 });
    (async () => {
      let t = 0;
      try {
        while (t < warn - 0.05) {
          const k = 0.45 + 0.55 * G.clamp(t / Math.max(0.5, warn - 1));
          b.data.pullReq = { x, z, s: pull * k, until: b.clock + 0.15 };
          await b.wait(0.1); t += 0.1;
        }
      } catch (e) { if (!G.combat.isAbort(e)) G.log.error('whirlpool.pull', e); }
      b.data.pullReq = null;
    })();
    return h;
  }
  // rotating arcs that visualise the pull (fx layer, tracked in b.data and removed in animate / teardown)
  function spinner(b, x, z, r, life, o = {}) {
    try {
      const g = new T3.Group(); const alpha = o.alpha || 0.28;
      for (let i = 0; i < 4; i++) {
        const rr = r * (0.3 + i * 0.19);
        const m = new T3.Mesh(new T3.RingGeometry(rr, rr + 0.11, 56, 1, i * 1.7, PI * 1.15), G.mat.additive(i % 2 ? FOAM : ACC, alpha));
        m.rotation.x = -PI / 2; g.add(m);
      }
      g.position.set(x, 0.07, z); g.renderOrder = 7;
      (G.layers && G.layers.fx || G.scene).add(g);
      b.data.spin.push({ g, t: 0, life, speed: o.speed || 2.4, alpha, follow: !!o.follow });
    } catch (e) { /* visuals only */ }
  }

  // Riptide: gold unblockable wave from the queen with blue lanes.
  function riptide(b, o = {}) {
    const n = o.lanes || 2, lw = o.laneW || 0.75, base = b.playerTheta() + b.randRange(-0.4, 0.4);
    const gaps = []; for (let i = 0; i < n; i++) gaps.push({ theta: base + i * TAU / n + (n > 1 ? 0 : 0), width: lw });
    b.say(o.say || 'The sea takes a breath.', 2.2);
    const after = o.after || 0;
    return b.hz.wave({ x: b.pos.x, z: b.pos.z, r0: 1.3, r1: R() + 2.5, speed: o.speed || 5, thickness: 1.3, warn: o.warn || 3.0, dmg: o.dmg || 40, unblockable: true, gaps, label: 'Riptide',
      onEnd: (h, how) => { if (after > 0 && how === 'done' && liveBoss(b) && PLAYING()) { drowned(b, after); b.say('The wave leaves its dead behind.', 2.2); } } });
  }

  // Spindrift: orbs fanned from the trident tip, plus homing ones.
  async function spindrift(b, n = 4, homing = 0, nHoming = 1) {
    const tip = tridentTip(b);
    for (let i = 0; i < n; i++) {
      const th = b.playerTheta() + (i - (n - 1) / 2) * 0.22;
      b.hz.orb({ x: tip.x, z: tip.z, dir: th, speed: 6, r: 0.42, life: 4.5, dmg: 12, label: 'Spindrift' });
      fx('burst', tip, { color: FOAM, count: 6, speed: 3, size: 0.3, life: 0.4 });
      await b.wait(0.14);
    }
    if (homing > 0) for (let k = 0; k < nHoming; k++) { await b.wait(0.3); const tp = tridentTip(b); b.hz.orb({ x: tp.x, z: tp.z, dir: b.playerTheta() + (k ? 0.5 : -0.5), speed: 4.4, r: 0.5, life: 5, dmg: 16, homing, label: 'Spindrift' }); }
  }
  function tridentTip(b) { const p = polar(1.3, b.facing, 0); p.x += b.pos.x; p.z += b.pos.z; return p; }

  function thrust(b, o = {}) {
    return b.hz.cone({ x: b.pos.x, z: b.pos.z, theta: b.playerTheta(), width: 0.78, r: 7.5, warn: o.warn || 1.5, dmg: o.dmg || 22, follow: 'player', anchor: 'boss', label: 'Trident Thrust' });
  }
  function slam(b, o = {}) {
    b.stopMove(); b.data.tridentUp = 1.2;
    return b.hz.circle({ x: b.pos.x, z: b.pos.z, r: o.r || 4.0, warn: o.warn || 2.0, dmg: o.dmg || 45, follow: 'boss', label: 'Trident Slam', onFire: () => { cam('shake', 0.7, 0.5); sfx('crack', { vol: 0.9 }); fx('shards', V(b.pos.x, 0.3, b.pos.z), { color: FOAM, count: 16, speed: 6, size: 0.18, life: 0.8 }); b.data.tridentUp = 0; } });
  }

  // Drowned adds: slow shambling figures that walk at the player.
  function drowned(b, n) {
    const base = b.playerTheta() + PI, r = Math.max(2.5, R() - 1.4);
    for (let i = 0; i < n; i++) {
      const th = base + (i - (n - 1) / 2) * 0.55 + b.randRange(-0.15, 0.15);
      const p = polar(r, th, 0);
      b.adds.spawn({
        x: p.x, z: p.z, hp: 130, radius: 0.55, contactDmg: 10, label: 'Drowned', color: ACC, barY: 1.9, data: { ph: Math.random() * TAU, sp: 1.8 + Math.random() * 0.3 },
        model: (group, add) => {
          const bodyM = new T3.MeshStandardMaterial({ color: '#12302d', roughness: 0.75, metalness: 0.2, emissive: '#06221a', emissiveIntensity: 0.9 });
          const skin = new T3.MeshStandardMaterial({ color: '#8fb8b0', roughness: 0.6, metalness: 0.1, emissive: '#1a3a36', emissiveIntensity: 0.6 });
          const body = new T3.Mesh(new T3.ConeGeometry(0.5, 1.5, 7, 1), bodyM); body.position.y = 0.75; body.rotation.z = -0.22; group.add(body);
          const head = new T3.Mesh(new T3.SphereGeometry(0.21, 10, 8), skin); head.position.set(0.22, 1.5, 0); group.add(head);
          const eyeM = G.mat.emissive(ACC, 2.2);
          for (const s of [-1, 1]) { const e = new T3.Mesh(new T3.SphereGeometry(0.04, 6, 5), eyeM); e.position.set(0.4, 1.53, s * 0.08); group.add(e); }
          const arm = new T3.Mesh(new T3.CylinderGeometry(0.06, 0.05, 0.8, 6), skin); arm.position.set(0.45, 1.05, 0.2); arm.rotation.z = -1.3; group.add(arm);
          const kelpM = new T3.MeshStandardMaterial({ color: KELP, roughness: 0.8, emissive: '#0a3324', emissiveIntensity: 0.7 });
          for (let k = 0; k < 3; k++) { const s = new T3.Mesh(new T3.CylinderGeometry(0.02, 0.035, 0.9, 5).translate(0, -0.45, 0), kelpM); s.position.set(-0.15 + k * 0.12, 1.35, (k - 1) * 0.18); s.rotation.z = 0.3 - k * 0.3; group.add(s); }
          add.data.head = head;
        },
        update: (add, dt) => {
          const q = G.player.state.pos; const ddx = q.x - add.pos.x, ddz = q.z - add.pos.z, d = Math.hypot(ddx, ddz) || 1;
          add.data.ph += dt * 5;
          const sp = add.data.sp * (0.75 + 0.25 * Math.sin(add.data.ph));        // shamble
          if (d > add.radius + 0.5) { add.pos.x += ddx / d * sp * dt; add.pos.z += ddz / d * sp * dt; }
          add.inner.rotation.y = Math.atan2(-ddz, ddx) + Math.sin(add.data.ph * 0.5) * 0.12;
          add.inner.position.y = Math.abs(Math.sin(add.data.ph * 0.5)) * 0.06;
        },
        onDeath: (add) => { fx('burst', add.pos.clone().setY(0.5), { color: FOAM, count: 16, speed: 4, size: 0.4, life: 0.7, up: 1.2 }); },
      });
    }
    sfx('addSpawn', {});
  }

  // Submerge: she sinks (noBody, invulnerable, hidden), resurfaces elsewhere with a splash.
  async function submerge(b, o = {}) {
    if (b.data.submerged) return;
    b.data.submerged = true; b.stopMove(); b.trackPlayer = false;
    splash(b.pos, 1.0);
    b.data.depthTarget = 5;
    b.noBody = true;
    await b.wait(0.55);
    b.invulnerable = true; b.data.hidden = true;
    await b.wait(o.under || 1.1);
    const r = Math.min(R() * 0.5, R() - 3.2);
    let th = (o.theta != null) ? o.theta : b.playerTheta() + PI + b.randRange(-0.9, 0.9);
    const p = polar(r, th, 0);
    b.teleport(p.x, p.z);
    b.data.hidden = false; b.data.depthTarget = 0; b.data.depth = 4.2; b.invulnerable = false; b.noBody = false; b.trackPlayer = true;
    splash(b.pos, 1.4); cam('shake', 0.35, 0.4); sfx('crack', { vol: 0.6, pitch: 0.7 });
    await b.wait(0.55);
    b.data.submerged = false;
  }
  function surface(b) {           // enter() / teardown safety: never leave her hidden or bodiless
    b.data.submerged = false; b.data.hidden = false; b.data.depthTarget = 0; b.data.depth = 0; b.noBody = false; b.trackPlayer = true;
    if (b.model) b.model.visible = true;
  }
  function splash(pos, k = 1) {
    fx('burst', V(pos.x, 0.2, pos.z), { color: FOAM, count: Math.round(28 * k), speed: 5 * k, size: 0.5, life: 0.8, up: 1.6, gravity: 4 });
    fx('burst', V(pos.x, 0.2, pos.z), { color: ACC, count: Math.round(14 * k), speed: 3.5 * k, size: 0.4, life: 0.9, up: 1.2, gravity: 3 });
    fx('shockwave', V(pos.x, 0.08, pos.z), { color: FOAM, radius: 3.6 * k, life: 0.55, intensity: 1.1 });
    sfx('bump', { vol: 0.5 });
  }

  // slow walk to a spot near the player, kept well inside the live arena
  async function stalk(b, dist = 4.6, speed) {
    if (b.data.submerged) return;
    const p = b.playerPos(), th = Math.atan2(-(b.pos.z - p.z), b.pos.x - p.x) + b.randRange(-0.6, 0.6);
    let x = p.x + Math.cos(th) * dist, z = p.z - Math.sin(th) * dist;
    const lim = Math.max(1.5, R() - 2.6), d = Math.hypot(x, z); if (d > lim) { x *= lim / d; z *= lim / d; }
    await b.moveTo(x, z, speed || b.speed);
  }

  // arena-wide spray and bioluminescent bursts (escalates per phase)
  function ambient(b, dt) {
    const D = b.data, lvl = b.phase;
    D.sprayT -= dt;
    if (D.sprayT <= 0) {
      D.sprayT = [0.55, 0.32, 0.18][lvl] || 0.5;
      const th = Math.random() * TAU, p = polar(R() + 0.25, th, 0.05);
      fx('burst', p, { color: Math.random() < 0.6 ? FOAM : ACC, count: 4 + lvl * 2, speed: 2 + lvl * 0.6, size: 0.3, life: 0.9, up: 1.6, gravity: 2.5 });
    }
    D.glowT -= dt;
    if (D.glowT <= 0) {
      D.glowT = [2.4, 1.3, 0.7][lvl] || 2;
      const r = Math.sqrt(Math.random()) * (R() - 1), th = Math.random() * TAU, p = polar(r, th, 0.1);
      fx('spark', p, ACC, { count: 5 + lvl * 3, speed: 2.2, size: 1.0 + lvl * 0.3 });
    }
  }

  // ================================================================ the model
  function build(b) {
    const g = new T3.Group(); const D = b.data;
    D.spin = []; D.depth = 0; D.depthTarget = 0; D.hidden = false; D.t = 0; D.sprayT = 1; D.glowT = 2; D.tridentUp = 0; D.sink = 0; D.collapse = 0;
    const gownM = new T3.MeshStandardMaterial({ color: '#2c7a72', roughness: 0.35, metalness: 0.4, emissive: '#0f5a46', emissiveIntensity: 1.4 });
    const skinM = new T3.MeshStandardMaterial({ color: '#d2efe8', roughness: 0.5, metalness: 0.1, emissive: '#2e6a62', emissiveIntensity: 0.9 });
    const kelpM = new T3.MeshStandardMaterial({ color: '#1a6a4a', roughness: 0.75, metalness: 0.1, emissive: '#0e4a30', emissiveIntensity: 1.0 });
    const brass = G.mat.brass();
    const coralM = G.mat.emissive(ACC, 2.0);
    const foamM = G.mat.emissive(FOAM, 1.1);
    // gown: a waterlogged truncated cone, with a foam hem ring and wet emissive streaks running down it
    const gown = new T3.Mesh(new T3.CylinderGeometry(0.42, 1.3, 2.75, 28, 1), gownM); gown.position.y = 1.375; g.add(gown);
    const hem = new T3.Mesh(new T3.TorusGeometry(1.3, 0.09, 8, 40), foamM); hem.rotation.x = PI / 2; hem.position.y = 0.1; g.add(hem);
    const streakM = G.mat.emissive(ACC, 1.1);
    for (let i = 0; i < 8; i++) { const th = i / 8 * TAU + 0.2, s = new T3.Mesh(new T3.BoxGeometry(0.05, 2.3, 0.05), streakM); const rr = 0.86; s.position.set(Math.cos(th) * rr, 1.45, Math.sin(th) * rr); s.lookAt(0, 1.45, 0); s.rotateX(0.31); g.add(s); }
    const aura = G.fx.glowSprite(ACC, 5.0, { intensity: 0.55, opacity: 0.45 }); aura.position.y = 2.3; g.add(aura); D.aura = aura;
    const corset = new T3.Mesh(new T3.CylinderGeometry(0.36, 0.44, 0.75, 20), brass); corset.position.y = 3.05; g.add(corset);
    const bust = new T3.Mesh(new T3.CylinderGeometry(0.33, 0.37, 0.55, 20), gownM); bust.position.y = 3.65; g.add(bust);
    for (const s of [-1, 1]) { const sh = new T3.Mesh(new T3.SphereGeometry(0.2, 12, 10), gownM); sh.position.set(0, 3.86, s * 0.42); g.add(sh); }
    const neck = new T3.Mesh(new T3.CylinderGeometry(0.11, 0.13, 0.32, 10), skinM); neck.position.y = 4.05; g.add(neck);
    const head = new T3.Mesh(new T3.SphereGeometry(0.3, 18, 14), skinM); head.position.y = 4.4; g.add(head); D.head = head;
    const eyeM = G.mat.emissive(ACC, 2.6);
    for (const s of [-1, 1]) { const e = new T3.Mesh(new T3.SphereGeometry(0.05, 8, 6), eyeM); e.position.set(0.25, 4.44, s * 0.11); g.add(e); }
    // crown of coral
    const crown = new T3.Group(); crown.position.y = 4.62; g.add(crown); D.crown = crown;
    const band = new T3.Mesh(new T3.TorusGeometry(0.3, 0.045, 8, 32), brass); band.rotation.x = PI / 2; crown.add(band);
    for (let i = 0; i < 9; i++) {
      const th = i / 9 * TAU, len = 0.32 + (i % 3) * 0.14;
      const c = new T3.Mesh(new T3.ConeGeometry(0.05 + (i % 2) * 0.02, len, 6), i % 3 === 1 ? brass : coralM);
      c.position.set(Math.cos(th) * 0.3, len / 2, Math.sin(th) * 0.3); c.rotation.z = -Math.cos(th) * 0.35; c.rotation.x = Math.sin(th) * 0.35; crown.add(c);
      if (i % 3 === 2) { const twig = new T3.Mesh(new T3.ConeGeometry(0.03, 0.2, 5), coralM); twig.position.set(Math.cos(th) * 0.34, len * 0.75, Math.sin(th) * 0.34); twig.rotation.z = 0.8; crown.add(twig); }
    }
    // kelp hair + strands from the shoulders and the hem
    D.kelp = [];
    const strand = (x, y, z, len, r) => { const p = new T3.Group(); p.position.set(x, y, z); const m = new T3.Mesh(new T3.CylinderGeometry(r * 0.5, r, len, 5).translate(0, -len / 2, 0), kelpM); p.add(m); p.userData.ph = Math.random() * TAU; p.userData.amp = 0.12 + Math.random() * 0.1; g.add(p); D.kelp.push(p); return p; };
    for (let i = 0; i < 7; i++) { const th = PI * 0.55 + i / 6 * PI * 0.9; strand(Math.cos(th) * 0.27 - 0.05, 4.55, Math.sin(th) * 0.27, 1.3 + Math.random() * 0.9, 0.04); }
    strand(-0.1, 3.9, 0.5, 1.6, 0.045); strand(-0.15, 3.85, -0.5, 1.4, 0.045); strand(-0.3, 3.3, 0.1, 1.5, 0.035);
    // arms: left hangs, right holds the trident forward
    const armM = skinM;
    const la = new T3.Mesh(new T3.CylinderGeometry(0.08, 0.07, 1.0, 8), armM); la.position.set(0.05, 3.35, 0.55); la.rotation.x = 0.25; la.rotation.z = 0.15; g.add(la);
    const ra = new T3.Mesh(new T3.CylinderGeometry(0.08, 0.07, 1.0, 8), armM); ra.position.set(0.35, 3.45, -0.5); ra.rotation.z = -1.0; ra.rotation.x = -0.2; g.add(ra);
    // trident (pivot at the hand; shaft runs up along local y, tilted forward)
    const tr = new T3.Group(); tr.position.set(0.75, 3.1, -0.55); g.add(tr); D.trident = tr;
    const shaft = new T3.Mesh(new T3.CylinderGeometry(0.045, 0.055, 4.0, 8), brass); shaft.position.y = 0.6; tr.add(shaft);
    const cross = new T3.Mesh(new T3.BoxGeometry(0.62, 0.08, 0.08), brass); cross.position.y = 2.55; tr.add(cross);
    for (const s of [-1, 0, 1]) { const pr = new T3.Mesh(new T3.ConeGeometry(0.05, s ? 0.5 : 0.7, 6), coralM); pr.position.set(s * 0.27, 2.55 + (s ? 0.25 : 0.35), 0); tr.add(pr); }
    const tipGlow = G.fx.glowSprite(ACC, 1.3, { intensity: 1.2, opacity: 0.8 }); tipGlow.position.y = 2.95; tr.add(tipGlow); D.tipGlow = tipGlow;
    tr.rotation.z = -0.35;
    // bioluminescent heart + ripples under her
    const heart = G.fx.glowSprite(ACC, 1.1, { intensity: 0.9, opacity: 0.7 }); heart.position.set(0.3, 3.5, 0); g.add(heart); D.heart = heart;
    D.ripples = [];
    for (let i = 0; i < 3; i++) { const m = new T3.Mesh(new T3.RingGeometry(0.9, 1.0, 40), G.mat.additive(i ? FOAM : ACC, 0.3)); m.rotation.x = -PI / 2; m.position.y = 0.045 + i * 0.004; m.renderOrder = 7; g.add(m); D.ripples.push(m); }
    const pool = new T3.Mesh(new T3.CircleGeometry(1.5, 32), G.mat.additive(DEEP, 0.55, { intensity: 1.5 })); pool.rotation.x = -PI / 2; pool.position.y = 0.035; g.add(pool);
    D.foam = foamM;
    g.scale.setScalar(1.12);
    b.model = g; D.model = g;
    // flotsam: kelp fronds riding the water line at the live radius (fx layer; removed in teardown)
    try {
      const fl = new T3.Group(); D.flotsam = fl; D.fronds = [];
      for (let i = 0; i < 18; i++) {
        const p = new T3.Group(); const len = 0.5 + Math.random() * 0.7;
        const m = new T3.Mesh(new T3.ConeGeometry(0.07, len, 5), kelpM); m.position.y = len / 2; m.rotation.z = (Math.random() - 0.5) * 0.8; p.add(m);
        if (i % 3 === 0) { const gl = G.fx.glowSprite(ACC, 0.7, { intensity: 0.8, opacity: 0.6 }); gl.position.y = 0.3; p.add(gl); }
        p.userData.th = i / 18 * TAU + Math.random() * 0.25; p.userData.ph = Math.random() * TAU; fl.add(p); D.fronds.push(p);
      }
      (G.layers && G.layers.fx || G.scene).add(fl);
    } catch (e) { /* visuals only */ }
  }

  function animate(b, dt) {
    const D = b.data; if (!D.model) return;
    D.t += dt; const t = D.t;
    // depth (submerge / resurface / sink / collapse)
    D.depth = G.damp(D.depth, D.depthTarget, 5, dt);
    const m = D.model;
    m.visible = !D.hidden && D.depth < 4.6;
    m.position.y = -D.depth + Math.sin(t * 1.1) * 0.05;
    m.rotation.z = Math.sin(t * 0.7) * 0.035; m.rotation.x = Math.sin(t * 0.9 + 1) * 0.025;
    if (D.collapse > 0) { const k = G.clamp(D.collapse); m.scale.set(1.12 * (1 + k * 0.4), 1.12 * Math.max(0.02, 1 - k * 0.97), 1.12 * (1 + k * 0.4)); }
    for (const k of D.kelp) { const u = k.userData; k.rotation.z = Math.sin(t * 1.4 + u.ph) * u.amp; k.rotation.x = Math.cos(t * 1.1 + u.ph) * u.amp * 0.8; }
    if (D.crown) D.crown.rotation.y = Math.sin(t * 0.5) * 0.08;
    // trident raises for casts and slams
    const want = b.casting ? 1 : (D.tridentUp > 0 ? D.tridentUp : 0);
    D.trUp = G.damp(D.trUp || 0, Math.min(1, want), 6, dt);
    if (D.trident) { D.trident.rotation.z = -0.35 + D.trUp * 0.55; D.trident.rotation.x = Math.sin(t * 0.8) * 0.03; }
    if (D.tipGlow) D.tipGlow.scale.setScalar(1.3 + Math.sin(t * 5) * 0.25 + D.trUp * 1.2 + (b.casting ? 0.6 : 0));
    if (D.heart) D.heart.scale.setScalar(1.0 + Math.sin(t * 2.2) * 0.2 + b.phase * 0.25);
    for (let i = 0; i < D.ripples.length; i++) { const r = D.ripples[i]; const u = ((t * 0.45 + i / D.ripples.length) % 1); const s = 1 + u * 2.6; r.scale.set(s, s, 1); r.material.opacity = 0.32 * (1 - u) * (D.depth < 0.5 ? 1 : 0.3); }
    // water drip from the hem
    D.dripT = (D.dripT || 0) - dt;
    if (D.dripT <= 0 && m.visible && D.depth < 0.5) { D.dripT = 0.25; const th = Math.random() * TAU; const p = polar(1.1, th + b.facing, 0.3); fx('spark', V(b.pos.x + p.x, 0.3, b.pos.z + p.z), FOAM, { count: 2, speed: 1.2, size: 0.5 }); }
    // spinners
    for (let i = D.spin.length - 1; i >= 0; i--) {
      const s = D.spin[i]; s.t += dt; s.g.rotation.y -= dt * s.speed * (1 + Math.min(4, s.t) * 0.5);
      if (s.follow) { s.g.position.x = b.pos.x; s.g.position.z = b.pos.z; s.g.visible = !D.hidden; }
      const k = s.t < s.life - 0.6 ? Math.min(1, s.t * 2) : Math.max(0, (s.life - s.t) / 0.6);
      for (const c of s.g.children) c.material.opacity = s.alpha * k;
      if (s.t >= s.life) { try { G.combat.removeObj(s.g); } catch (e) { } D.spin.splice(i, 1); }
    }
    // flotsam rides the live radius
    if (D.fronds) { const r = R() + 0.45; for (const f of D.fronds) { const u = f.userData; u.th += dt * 0.04; const p = polar(r, u.th, 0); f.position.set(p.x, -0.1 + Math.sin(t * 1.6 + u.ph) * 0.07, p.z); f.rotation.z = Math.sin(t * 1.3 + u.ph) * 0.2; f.rotation.y = u.th; } }
    if (PLAYING() && b.alive) ambient(b, dt);
  }

  function teardown(b) {
    const D = b.data || {};
    try { for (const s of D.spin || []) G.combat.removeObj(s.g); } catch (e) { }
    D.spin = [];
    try { if (D.flotsam) G.combat.removeObj(D.flotsam); } catch (e) { }
    D.flotsam = null; D.fronds = null;
    b.noBody = false;
  }

  // ================================================================ cinematics
  function risingTide(b, to) {
    const toR = PHASE_R[to] != null ? PHASE_R[to] : R();
    const home = G.camera ? G.camera.position.toArray() : [0, 20, 16];
    const bx = b.pos.x, bz = b.pos.z;
    const cin = cam('cinematic', [
      { t: 0, pos: home, look: [0, 0.5, 0] },
      { t: 1.3, pos: [bx * 0.4 + 2, 2.6, bz * 0.4 + 10.5], look: [bx, 1.6, bz] },
      { t: 3.2, pos: [-6, 9, 14], look: [0, 0.8, 0] },
      { t: 4.6, pos: [2.5, 5.5, 11.5], look: [0, 2.2, 0] },
      { t: 5.6, pos: home, look: [0, 0.5, 0] },
    ], { name: 'tide' });
    (async () => {
      const W = G.combat.wait;
      try {
        b.stopMove(); b.trackPlayer = false; b.noBody = true;
        b.say(to === 1 ? 'The tide answers her.' : 'Drown with me.', 3);
        splash(b.pos, 1.2); b.data.depthTarget = 5;
        sfx('rumble', { dur: 2.5, vol: 0.8 }); cam('shake', 0.45, 1.2);
        await W(0.9);
        if (!liveBoss(b)) return;
        b.data.hidden = true;
        // the tide surges in: the floor beyond the new radius goes under
        world('setArenaR', toR, 2.8); sfx('arenaShrink', { vol: 1 });
        world('floorGlow', ACC, 0.3, 3.0); world('rimGlow', ACC, 1.2, 3.0);
        fx('shockwave', V(0, 0.1, 0), { color: FOAM, radius: toR, r0: 15.5, life: 2.4, intensity: 1.3, thickness: 1.6 });
        post('bloomPulse', 0.5, 1.2); fx('flash', ACC, 0.3, 0.7);
        for (let i = 0; i < 10; i++) {
          const th = i / 10 * TAU + 0.3, p = polar(toR + 0.8, th, 0.1);
          fx('burst', p, { color: i % 2 ? FOAM : ACC, count: 22, speed: 5, size: 0.5, life: 1.1, up: 1.8, gravity: 3 });
          cam('shake', 0.2, 0.25);
          await W(0.14);
        }
        if (to >= 2) { world('lightning', ACC); sfx('thunder', { vol: 0.9 }); fx('flash', '#ffffff', 0.35, 0.5); }
        await W(0.5);
        if (!liveBoss(b)) return;
        // she resurfaces at the centre
        b.teleport(0, 0); b.data.hidden = false; b.data.depth = 4.4; b.data.depthTarget = 0;
        splash(b.pos, 1.8); fx('shockwave', V(0, 0.1, 0), { color: ACC, radius: 8, life: 0.8, intensity: 1.4 });
        cam('shake', 0.6, 0.6); sfx('crack', { vol: 1, pitch: 0.6 }); post('bloomPulse', 0.4, 0.8);
        for (let i = 0; i < 3; i++) { await W(0.25); fx('burst', V(0, 1 + i, 0), { color: FOAM, count: 20, speed: 4, size: 0.5, life: 0.9, up: 1.2 }); }
      } catch (e) { G.log.error('morvanna.transition', e); }
    })();
    return cin;
  }

  async function death(b) {
    const W = G.combat.wait;
    const home = G.camera ? G.camera.position.toArray() : [0, 20, 16];
    const bx = b.pos.x, bz = b.pos.z;
    cam('slowMo', 0.3, 1.4);
    const cin = cam('cinematic', [
      { t: 0, pos: home, look: [0, 0.5, 0] },
      { t: 1.6, pos: [bx + 1.5, 3.2, bz + 9.5], look: [bx, 2.6, bz] },
      { t: 4.4, pos: [bx - 5, 6.5, bz + 13], look: [bx, 1.5, bz] },
      { t: 7.0, pos: home, look: [0, 0.5, 0] },
    ], { name: 'death' });
    try {
      b.stopMove(); b.trackPlayer = false; b.noBody = true;
      b.data.submerged = false; b.data.hidden = false; b.data.depthTarget = 0; b.data.pullReq = null;   // in case she was mid-submerge
      b.say('...the sea keeps nothing.', 4);
      sfx('bossDeath', {});
      for (let i = 0; i < 6; i++) {
        fx('burst', V(bx + (Math.random() - 0.5) * 1.5, 1 + i * 0.6, bz + (Math.random() - 0.5) * 1.5), { color: i % 2 ? FOAM : ACC, count: 26, speed: 6, size: 0.7, life: 1.0 });
        cam('shake', 0.35, 0.3); sfx('crack', { vol: 0.7 });
        await W(0.3);
      }
      // the water drains
      world('setArenaR', G.ARENA_R || 13, 3.2); world('floorGlow', FOAM, 0.35, 3.5); world('rimGlow', ACC, 1.0, 3);
      fx('shockwave', V(0, 0.1, 0), { color: FOAM, radius: 16, r0: R(), life: 2.2, intensity: 1.2, thickness: 1.4 });
      sfx('swell', { vol: 0.8 });
      // she collapses into foam and light
      b.data.collapse = 0.01;
      const t0 = G.combat.clock;
      while (G.combat.clock - t0 < 1.6) { b.data.collapse = Math.min(1, (G.combat.clock - t0) / 1.4); fx('burst', V(bx, 0.6 + Math.random() * 2.5, bz), { color: FOAM, count: 10, speed: 3.5, size: 0.5, life: 0.9, up: 1.5 }); fx('shards', V(bx, 1.5, bz), { color: ACC, count: 6, speed: 4, size: 0.14, life: 1.1 }); await W(0.12); }
      fx('flash', '#eafff6', 0.8, 1.2); fx('shockwave', V(bx, 0.3, bz), { color: '#ffffff', radius: 20, life: 1.5 });
      post('bloomPulse', 0.6, 1.2); cam('shake', 0.9, 0.8); sfx('thunder', {});
      b.data.hidden = true; if (b.root) b.root.visible = false;
      for (let i = 0; i < 8; i++) { const th = i / 8 * TAU, p = polar(5 + i * 0.6, th, 0.1); fx('starFall', V(p.x, 3, p.z), ACC, {}); fx('spark', p, FOAM, { count: 8, speed: 3, size: 1.2 }); await W(0.08); }
      await W(1.6);
    } catch (e) { G.log.error('morvanna.death', e); }
    return cin;
  }

  // ================================================================ phases
  // one pull driver per frame: a whirlpool request wins over the phase-3 base undertow
  function drivePull(b, dt, base) {
    if (!PLAYING() || !G.player || !G.player.pull) return;
    const q = b.data.pullReq;
    if (q && b.clock < q.until) { G.player.pull(q.x, q.z, q.s, 0.12); return; }
    if (base > 0 && !b.data.submerged) G.player.pull(b.pos.x, b.pos.z, base, 0.12);
  }
  function enterPhase(i) {
    return (b) => {
      b.turnRate = 2.2; b.facingTarget = null; surface(b);
      b.invulnerable = false; b.data.tridentUp = 0; b.data.pullReq = null;
      for (const s of b.data.spin) s.life = Math.min(s.life, s.t + 0.5);          // fade any spinner from the last phase
      const want = PHASE_R[i];
      if (Math.abs(R() - want) > 0.05) { world('setArenaR', want, 1.2); if (R() > want + 0.05) sfx('arenaShrink', { vol: 0.8 }); }
    };
  }
  const clampIn = (p, margin) => { const lim = Math.max(1, R() - margin), d = Math.hypot(p.x, p.z); if (d > lim) { p.x *= lim / d; p.z *= lim / d; } return p; };
  const walkLoop = (b, dist, speed, gap) => b.loop(async () => { if (!b.casting && !b.data.submerged) await stalk(b, dist, speed); await b.wait(b.randRange(gap[0], gap[1])); });
  const dirge = (b, n, say, extra = {}) => b.cast({ name: extra.name || 'Dirge', dur: extra.dur || 3.5, interruptible: true, onDone: () => { b.hz.wipe(extra.wipe || 10, extra.name || 'Dirge'); drowned(b, n); if (say) b.say(say, 2.5); } });

  const phases = [
    { // ---------------------------------------------------------- P1: EBB (arena 13)
      name: 'Ebb', hpStart: 1.0, sky: ['aurora', 1], intensity: 1,
      enter: enterPhase(0),
      update(b, dt) { drivePull(b, dt, 0); },
      async script(b) {
        walkLoop(b, 4.8, undefined, [4, 7]);
        b.loop(async () => {                                            // the floor: tide line, then a whirlpool
          await b.wait(2.0);
          await tideLine(b, { speed: 6.2, gapW: 3.4 });
          await b.wait(5.0);
          await whirlpool(b, { ...clampIn(b.playerAhead(0.6), 3.2), pull: 3.4, dmg: 22 });
          await b.wait(4.5);
        });
        b.loop(async () => {                                            // the trident
          await b.wait(3.5);
          await thrust(b); await b.wait(0.7); await thrust(b);
          await b.wait(4.0);
          await spindrift(b, 5);
          await b.wait(5.0);
        });
        b.loop(async () => {                                            // riptide; the wave leaves the drowned behind
          await b.wait(14);
          await riptide(b, { lanes: 2, laneW: 0.8, warn: 3.0, speed: 5.5 });
          await b.wait(7);
        });
        b.loop(async () => {                                            // the ONLY loop that casts
          await b.wait(12);
          b.stopMove();
          const r = await dirge(b, 2, 'Rise. Rise and take him.');
          if (r === 'interrupted') b.say('The dirge drowns in her throat.', 2.2);
          await b.wait(17);
        });
        b.loop(async () => { await b.wait(30); await submerge(b); });   // submerge
      },
    },
    { // ---------------------------------------------------------- P2: FLOOD (arena 11)
      name: 'Flood', hpStart: 0.6, sky: ['aurora', 2], intensity: 2,
      enter: enterPhase(1),
      update(b, dt) { drivePull(b, dt, 0); },
      async script(b) {
        walkLoop(b, 4.4, undefined, [4, 6]);
        b.loop(async () => {                                            // the floor: two tide lines, then a whirlpool
          await b.wait(1.5);
          { const th = b.rand() * TAU;
            tideLine(b, { theta: th, speed: 6.4, gapW: 3.2, warn: 2.8 });
            await b.wait(1.1);
            await tideLine(b, { theta: th + PI / 2 + b.randRange(-0.5, 0.5), speed: 6.4, gapW: 3.2, warn: 2.8 }); }
          await b.wait(3.5);
          await whirlpool(b, { ...clampIn(b.playerAhead(0.6), 3.0), pull: 3.9, r0: 2.3, r1: 5.8, warn: 3.4, dmg: 24 });
          await b.wait(4.0);
        });
        b.loop(async () => {                                            // the trident
          await b.wait(2.5);
          await thrust(b, { warn: 1.6 });
          await b.wait(3.0);
          await spindrift(b, 5, 0.6);
          await b.wait(3.5);
          await slam(b, { r: 3.8, warn: 2.0, dmg: 45 });
          await b.wait(4.0);
        });
        b.loop(async () => {
          await b.wait(11);
          await riptide(b, { lanes: 2, laneW: 0.7, warn: 3.0, speed: 5.5, say: 'The flood comes for you.', after: 1 });
          await b.wait(9);
        });
        b.loop(async () => {                                            // Dirge, then a second verse inside the Rebuke cooldown
          await b.wait(10);
          b.stopMove();
          const r = await dirge(b, 3, 'Up from the silt, my court.');
          if (r === 'interrupted') b.say('Silence. The drowned sleep on.', 2.2);
          await b.wait(5.5);
          b.stopMove();
          const r2 = await dirge(b, 1, null, { name: 'Dirge, second verse', dur: 3.0, wipe: 10 });
          if (r2 === 'interrupted') b.say('Her song breaks.', 2.0);
          await b.wait(13);
        });
        b.loop(async () => { await b.wait(22); await submerge(b); });
      },
    },
    { // ---------------------------------------------------------- P3: DROWNING (arena 9)
      name: 'Drowning', hpStart: 0.28, sky: ['aurora', 3], intensity: 3,
      enter: enterPhase(2),
      update(b, dt) { drivePull(b, dt, 0.8); },                          // the undertow never lets go
      async script(b) {
        spinner(b, b.pos.x, b.pos.z, 6.5, 1e9, { follow: true, speed: 0.9, alpha: 0.16 });
        b.say('The undertow has you now.', 3);
        walkLoop(b, 4.0, 1.8, [5, 7]);
        b.loop(async () => {                                            // undertow ring on the queen, then the slam punishes the eye
          await b.wait(1.0);
          b.stopMove();
          await whirlpool(b, { x: b.pos.x, z: b.pos.z, r0: 2.7, r1: 5.6, warn: 3.4, pull: 3.8, dmg: 24, label: 'Undertow' });
          await b.wait(0.7);
          await slam(b, { r: 4.0, warn: 2.0, dmg: 45 });
          await b.wait(3.0);
          { const th = b.rand() * TAU;                                  // tide lines in pairs
            tideLine(b, { theta: th, speed: 6.6, gapW: 3.0, warn: 2.8 });
            await b.wait(0.9);
            await tideLine(b, { theta: th + PI / 2 + b.randRange(-0.4, 0.4), speed: 6.6, gapW: 3.0, warn: 2.8 }); }
          await b.wait(3.0);
        });
        b.loop(async () => {                                            // the trident
          await b.wait(4.0);
          await spindrift(b, 5, 0.7, 1);
          await b.wait(5.5);
          await thrust(b); await b.wait(0.6); await thrust(b);
          await b.wait(4.0);
        });
        b.loop(async () => {
          await b.wait(9);
          await riptide(b, { lanes: 2, laneW: 0.7, warn: 3.0, speed: 5.5, say: 'Breathe while you can.', after: 1 });
          await b.wait(9);
        });
        b.loop(async () => {                                            // Dirge, then the Deluge inside the Rebuke cooldown
          await b.wait(8);
          b.stopMove();
          const r = await dirge(b, 3, null);
          if (r === 'interrupted') b.say('The drowned stay drowned.', 2.2);
          await b.wait(5.5);
          b.stopMove();
          const r2 = await b.cast({ name: 'Deluge', dur: 4.0, interruptible: true, onDone: () => {
            b.hz.wipe(15, 'Deluge'); world('floorGlow', ACC, 0.4, 1.2); cam('shake', 0.6, 0.6);
            riptide(b, { lanes: 2, laneW: 0.75, warn: 3.0, speed: 5.5, say: 'DELUGE.' });
          } });
          if (r2 === 'interrupted') b.say('The deluge breaks on your blade.', 2.4);
          await b.wait(12);
        });
        b.loop(async () => { await b.wait(18); await submerge(b, { under: 0.9 }); });
      },
    },
  ];

  G.bosses[2] = {
    name: 'MORVANNA', title: 'the Drowned Queen', court: 'The Court of Tides', accent: ACC, sky: 'aurora', arena: 'tide', music: 2,
    maxHp: 11000, parTime: 270, hitRadius: 1.5, hitHeight: 2.6, bodyRadius: 1.1, speed: 2.1, turnRate: 2.2, fadeOpacity: 0.3,
    intro: ['The sea keeps what the crown threw away.', 'She has been waiting at the bottom for a long time.'],
    phases,
    build, animate, teardown,
    onTransition(b, from, to) { return risingTide(b, to); },
    onDeath(b) { return death(b); },
  };
})();
