// =====================================================================
// 11_boss2.js: COURT II, the Court of Glass. SERAPHINE, the Mirror Choir.
//
// A veiled figure of pink-white glass hovering over a mirror floor, ringed by orbiting mirror shards that sing.
//   Mirror Beams   lines across the whole arena through a shard (tangent "polygon" or "spoke" through her); 2 s warn.
//   Shard Volley   orb fans from a shard: sidestep, or Rebuke 3+ at once for DISCORD (she is Exposed 3 s).
//   Hymn           blue safe disc(s): be inside when it fills (3 s) or take 20. The signature of this court.
//   Crescendo      interruptible cast: completed = 12 raid damage + two more shards (denser beams); interrupted =
//                  Exposed and she drops a shard.
//   P2 Chorus      the beams rotate (twin spokes from her), two Hymn discs far apart.
//   P3 Shatter     the floor breaks: 3-4 void pits that stay, a gold collapsing Shatter Wave with lanes, Requiem.
// =====================================================================
(() => {
  const T3 = (typeof THREE !== 'undefined') ? THREE : G.THREE;
  const PI = Math.PI, TAU = PI * 2;
  const ACC = '#ff9ad5', COLD = '#dff6ff', WHITE = '#fff4fa', ROSE = '#ffd1ea', VIOLET = '#c9a8ff', BLUE = '#4fa8ff';
  const PRISM = ['#ffd1ea', '#dff6ff', '#fff4fa', '#c9a8ff', '#ff9ad5', '#b8fff2'];
  const world = (n, ...a) => { try { const f = G.world && G.world[n]; return f ? f.apply(G.world, a) : undefined; } catch (e) { } };
  const fx = (n, ...a) => { try { const f = G.fx && G.fx[n]; return f ? f.apply(G.fx, a) : undefined; } catch (e) { } };
  const sfx = (n, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(n, o); } catch (e) { } };
  const cam = (n, ...a) => { try { const f = G.cam && G.cam[n]; return f ? f.apply(G.cam, a) : undefined; } catch (e) { } };
  const post = (n, ...a) => { try { const f = G.post && G.post[n]; return f ? f.apply(G.post, a) : undefined; } catch (e) { } };
  const arenaR = () => (G.world && G.world.arenaR != null) ? G.world.arenaR : (G.ARENA_R || 13);
  const V = (x, y, z) => new T3.Vector3(x, y, z);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap = (a) => a - TAU * Math.floor((a + PI) / TAU);
  const cwait = (s) => G.combat.wait(s);
  const prism = () => PRISM[Math.floor(Math.random() * PRISM.length)];

  // --------------------------------------------------------------- geometry helpers
  // the chord of the circle of radius R through (px, pz) along (dx, dz): [ax, az, bx, bz] or null
  function chord(px, pz, dx, dz, R) {
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const sd = px * dx + pz * dz, c = px * px + pz * pz - R * R, disc = sd * sd - c;
    if (disc <= 0) return null;
    const q = Math.sqrt(disc), u0 = -sd - q, u1 = -sd + q;
    return [px + dx * u0, pz + dz * u0, px + dx * u1, pz + dz * u1];
  }
  const HOVER_Y = 1.85;

  // --------------------------------------------------------------- the model
  function build(b) {
    const D = b.data;
    const g = new T3.Group();
    const glass = (o = {}) => G.mat.brass(Object.assign({ color: '#ffe6f4', metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.85, emissive: '#ff9ad5', emissiveIntensity: 0.12 }, o));

    // the floating body
    const body = new T3.Group(); body.position.y = HOVER_Y; g.add(body); D.body = body;
    const gown = new T3.Mesh(new T3.ConeGeometry(0.72, 1.9, 28), glass({ emissiveIntensity: 0.18 })); gown.rotation.x = PI; gown.position.y = 0.0; body.add(gown);
    const hem = new T3.Mesh(new T3.TorusGeometry(0.7, 0.04, 8, 40), G.mat.emissive(ROSE, 1.6)); hem.rotation.x = PI / 2; hem.position.y = 0.93; body.add(hem);
    const torso = new T3.Mesh(new T3.CapsuleGeometry(0.34, 0.7, 6, 18), glass({ opacity: 0.9 })); torso.position.y = 1.3; body.add(torso);
    const head = new T3.Mesh(new T3.SphereGeometry(0.29, 20, 14), glass({ opacity: 0.92, roughness: 0.05 })); head.position.y = 2.08; body.add(head);
    // raised arms (singing)
    for (const s of [-1, 1]) {
      const arm = new T3.Mesh(new T3.CapsuleGeometry(0.085, 0.62, 4, 10), glass({ opacity: 0.85 }));
      arm.position.set(0.22, 1.55, s * 0.42); arm.rotation.z = -0.55; arm.rotation.x = s * 0.5; body.add(arm);
      const hand = new T3.Mesh(new T3.SphereGeometry(0.1, 10, 8), G.mat.emissive(WHITE, 1.4)); hand.position.set(0.44, 1.95, s * 0.62); body.add(hand);
    }
    // the veil: a hanging open cone, translucent, with an additive shimmer layer
    const veil = new T3.Group(); veil.position.y = 1.72; body.add(veil); D.veil = veil;
    veil.add(new T3.Mesh(new T3.ConeGeometry(0.95, 1.6, 28, 1, true), G.mat.brass({ color: '#fff0f8', metalness: 0.1, roughness: 0.25, transparent: true, opacity: 0.32, side: T3.DoubleSide })));
    veil.add(new T3.Mesh(new T3.ConeGeometry(1.0, 1.66, 28, 1, true), G.mat.additive(ROSE, 0.16, { intensity: 0.7 })));
    // emissive core + glow
    const core = new T3.Mesh(new T3.SphereGeometry(0.2, 14, 12), G.mat.emissive(ACC, 3.2)); core.position.y = 1.3; body.add(core); D.core = core;
    const coreGlow = G.mat.glowSprite(ACC, 2.4, { intensity: 0.8, opacity: 0.7 }); coreGlow.position.y = 1.3; body.add(coreGlow); D.coreGlow = coreGlow;
    // halo behind the head
    const halo = new T3.Mesh(new T3.TorusGeometry(0.58, 0.035, 8, 48), G.mat.emissive(WHITE, 2.0)); halo.position.set(-0.18, 2.12, 0); halo.rotation.y = PI / 2; body.add(halo); D.halo = halo;
    const halo2 = new T3.Mesh(new T3.TorusGeometry(0.82, 0.018, 6, 56), G.mat.additive(ROSE, 0.6, { intensity: 1.2 })); halo2.position.copy(halo.position); halo2.rotation.y = PI / 2; body.add(halo2); D.halo2 = halo2;
    // soft floor light under her (stays on the floor)
    const under = G.mat.glowSprite(ACC, 3.4, { intensity: 0.5, opacity: 0.35 }); under.position.y = 0.12; g.add(under); D.under = under;

    // the orbiting choir (counter-rotated so shard angles are in play space)
    const orbit = new T3.Group(); g.add(orbit); D.orbit = orbit;
    D.shards = []; D.shardSeq = 0;
    D.t = 0; D.hold = 0; D.scatter = 0; D.scatterK = 0; D.rise = 0; D.crack = 0; D.flicker = 0; D.orbitSpeed = 0.75; D.spin = 0.75;
    D.pops = []; D.lastDiscord = -9; D.voids = []; D.noMove = false; D.dead = false;
    b.model = g;
    setShardCount(b, 3, 'silent');
  }

  function makeShard(b, i) {
    const D = b.data;
    const grp = new T3.Group();
    const pane = new T3.Mesh(new T3.BoxGeometry(0.78, 1.08, 0.06), G.mat.brass({ color: '#fff0f8', metalness: 0.35, roughness: 0.06, transparent: true, opacity: 0.82, emissive: ACC, emissiveIntensity: 0.25 }));
    grp.add(pane);
    const edge = new T3.Mesh(new T3.BoxGeometry(0.9, 1.2, 0.02), G.mat.additive(ROSE, 0.28, { intensity: 0.9 })); grp.add(edge);
    const glow = G.mat.glowSprite(ACC, 1.5, { intensity: 0.8, opacity: 0.55 }); grp.add(glow);
    const seq = D.shardSeq++;
    const s = { grp, pane, edge, glow, ang: (seq * 2.399) % TAU, r: 0, rBase: 2.35 + (seq % 3) * 0.18, h: 1.5 + ((seq * 0.7) % 1.1), hBase: 1.5 + ((seq * 0.7) % 1.1), lit: 0, wob: Math.random() * TAU, alive: true, k: 0 };
    D.orbit.add(grp);
    return s;
  }
  function shardXZ(b, s) { return { x: b.pos.x + Math.cos(s.ang) * s.r, z: b.pos.z - Math.sin(s.ang) * s.r }; }
  function shardWorld(b, s) { return V(b.pos.x + Math.cos(s.ang) * s.r, s.h + (b.data.riseY || 0), b.pos.z - Math.sin(s.ang) * s.r); }
  function liveShards(b) { return b.data.shards.filter(s => s.alive); }
  function setShardCount(b, n, how) {
    const D = b.data; n = clamp(n | 0, 0, 7);
    let cur = liveShards(b);
    while (cur.length > n) { dropShard(b, cur[cur.length - 1], how); cur = liveShards(b); }
    while (cur.length < n) {
      const s = makeShard(b, cur.length);
      if (how === 'silent') { s.r = s.rBase; s.k = 1; }
      D.shards.push(s); cur = liveShards(b);
      if (how !== 'silent') { fx('burst', V(b.pos.x, HOVER_Y + 1.2, b.pos.z), { color: ROSE, count: 18, speed: 5, size: 0.5, life: 0.6 }); sfx('crack', { vol: 0.5, pitch: 1.4 }); }
    }
    respace(b);
  }
  function respace(b) {   // spread the live shards evenly around her (they drift to the new slots)
    const cur = liveShards(b); if (!cur.length) return;
    const base = cur[0].ang;
    cur.forEach((s, i) => { s.angTarget = base + i * TAU / cur.length; });
  }
  function dropShard(b, s, how) {
    if (!s || !s.alive) return;
    s.alive = false;
    const p = shardWorld(b, s);
    if (how !== 'silent') { fx('shards', p, { color: prism(), count: 22, speed: 6, size: 0.18, life: 1.2 }); fx('burst', p, { color: WHITE, count: 14, speed: 4, size: 0.4, life: 0.5 }); sfx('crack', { vol: 0.7, pitch: 1.2 }); }
    try { G.combat.removeObj(s.grp); } catch (e) { s.grp.visible = false; }
    const i = b.data.shards.indexOf(s); if (i >= 0) b.data.shards.splice(i, 1);
    respace(b);
  }
  function holdShards(b, sec) { b.data.hold = Math.max(b.data.hold, sec); }
  function lightShards(b, list, sec) { for (const s of list) s.lit = Math.max(s.lit, sec); }

  // --------------------------------------------------------------- animate
  function animate(b, dt) {
    const D = b.data; if (!D.body) return;
    D.t += dt;
    const t = D.t;
    // hover + sway (+ the death rise)
    D.riseY = D.rise > 0 ? Math.min(3.2, (D.riseY || 0) + dt * 1.1) : 0;
    const bob = Math.sin(t * 1.1) * 0.22 + Math.sin(t * 2.3) * 0.05;
    D.body.position.y = HOVER_Y + bob + (D.riseY || 0);
    D.body.rotation.z = Math.sin(t * 0.7) * 0.04; D.body.rotation.x = Math.sin(t * 0.9 + 1) * 0.03;
    if (D.crack > 0) { const j = D.crack * 0.08; D.body.position.x = (Math.random() - 0.5) * j; D.body.position.z = (Math.random() - 0.5) * j; D.body.scale.setScalar(1 + Math.sin(t * 40) * 0.03 * D.crack); }
    D.veil.rotation.y += dt * 0.35;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    const exposed = b.exposedT > 0;
    D.coreGlow.scale.setScalar(2.2 + pulse * 0.5 + (b.casting ? 0.8 : 0) + (exposed ? 0.6 : 0));
    D.coreGlow.material.opacity = 0.55 + pulse * 0.2 + (D.crack > 0 ? 0.4 : 0);
    D.core.scale.setScalar(1 + pulse * 0.15 + (b.casting ? 0.3 : 0));
    D.halo.rotation.z += dt * 0.6; D.halo2.rotation.z -= dt * 0.4;
    D.halo2.material.opacity = 0.35 + pulse * 0.35;
    D.under.scale.setScalar(3.0 + pulse * 0.4); D.under.material.opacity = 0.28 + pulse * 0.1;
    // orbit: counter the root rotation so shard angles stay in play space; slow to a hold while beams are telegraphed
    D.orbit.rotation.y = -(b.facing + (b.def.facingOffset || 0));
    D.hold = Math.max(0, D.hold - dt);
    const want = D.hold > 0 || D.rise > 0 ? 0 : D.orbitSpeed;
    D.spin += (want - D.spin) * Math.min(1, dt * 4);
    D.scatterK += ((D.scatter > 0 ? 1 : 0) - D.scatterK) * Math.min(1, dt * 2.6);
    D.flicker = Math.max(0, D.flicker - dt);
    for (const s of D.shards) {
      if (!s.alive) continue;
      s.ang += D.spin * dt;
      if (s.angTarget != null) { const d = wrap(s.angTarget - s.ang); s.ang += d * Math.min(1, dt * 2.5); s.angTarget += D.spin * dt; if (Math.abs(d) < 0.02) s.angTarget = null; }
      s.k = Math.min(1, s.k + dt * 1.6);
      const rT = lerp(s.rBase, 6.8, D.scatterK) * s.k, hT = lerp(s.hBase, 4.6, D.scatterK) + (D.riseY || 0);
      s.r += (rT - s.r) * Math.min(1, dt * 5); s.h += (hT - s.h) * Math.min(1, dt * 5);
      s.wob += dt * 1.3;
      s.grp.position.set(Math.cos(s.ang) * s.r, s.h + Math.sin(s.wob) * 0.12, -Math.sin(s.ang) * s.r);
      s.grp.rotation.y = s.ang + PI / 2 + Math.sin(s.wob * 0.7) * 0.25; s.grp.rotation.x = Math.sin(s.wob * 0.5) * 0.18;
      s.lit = Math.max(0, s.lit - dt);
      const litK = s.lit > 0 ? 0.6 + 0.4 * Math.sin(t * 14) : 0;
      s.glow.scale.setScalar(1.3 + pulse * 0.3 + litK * 1.6);
      s.glow.material.opacity = 0.45 + litK * 0.45 + (D.flicker > 0 ? (Math.random() - 0.5) * 0.5 : 0);
      s.edge.material.opacity = 0.22 + litK * 0.5;
    }
  }

  // --------------------------------------------------------------- mechanics
  // Mirror Beams: a line across the arena through each chosen shard. mode 'tangent' (perpendicular to the radial:
  // a polygon around her) or 'spoke' (through her). The choir holds its note while the beams charge.
  // Returns the handles (await the last one).
  function mirrorBeams(b, count, mode, o = {}) {
    const warn = o.warn ?? 2.0;
    const live = liveShards(b); if (!live.length) return [];
    count = Math.min(count, live.length);
    const start = b.randInt(0, live.length - 1), step = live.length / count, chosen = [];
    for (let i = 0; i < count; i++) chosen.push(live[(start + Math.round(i * step)) % live.length]);
    holdShards(b, warn + 0.35); lightShards(b, chosen, warn + 0.3);
    sfx('swell', { vol: 0.5, pitch: 1.3 });
    const R = arenaR() + 1.2, hs = [];
    for (const s of chosen) {
      const p = shardXZ(b, s); const rx = p.x - b.pos.x, rz = p.z - b.pos.z;
      const dir = mode === 'spoke' ? [rx, rz] : [-rz, rx];
      const c = chord(p.x, p.z, dir[0], dir[1], R); if (!c) continue;
      hs.push(b.hz.line({ ax: c[0], az: c[1], bx: c[2], bz: c[3], width: o.width ?? 2.2, warn, dmg: o.dmg ?? 26, label: o.label || 'Mirror Beam', liveStyle: 'flash',
        onFire: () => {
          const sp = shardWorld(b, s);
          fx('lance', V(c[0], sp.y, c[1]), V(c[2], sp.y, c[3]), { color: WHITE, width: 0.6, life: 0.5, intensity: 1.6 });
          fx('lance', V(c[0], 0.5, c[1]), V(c[2], 0.5, c[3]), { color: ACC, width: 0.9, life: 0.35, intensity: 1.2 });
          fx('burst', sp, { color: ROSE, count: 14, speed: 5, size: 0.4, life: 0.5 });
          world('floorGlow', ACC, 0.35, 0.5);
        } }));
    }
    return hs;
  }
  const last = (hs) => hs.length ? hs[hs.length - 1] : b_wait0();
  function b_wait0() { return Promise.resolve('none'); }
  // Reflection: one set of beams, and the moment it fires a second set "reflects" through her with a shorter warn
  async function reflect(b, n1, n2, o = {}) {
    await last(mirrorBeams(b, n1, 'tangent', o));
    await b.wait(0.25);
    await last(mirrorBeams(b, n2, 'spoke', Object.assign({ warn: 1.5 }, o)));
  }

  // Shard Volley: a fan of orbs from a shard toward the player. Rebuking 3+ at once = Discord.
  function volley(b, s, n = 5, spread = 0.2, o = {}) {
    if (!s) return;
    const p = shardXZ(b, s), pl = b.playerPos();
    const th = Math.atan2(-(pl.z - p.z), pl.x - p.x);
    lightShards(b, [s], 0.6);
    fx('burst', shardWorld(b, s), { color: ACC, count: 12, speed: 4, size: 0.35, life: 0.4 });
    sfx('lance', { vol: 0.35, pitch: 1.6 });
    for (let k = 0; k < n; k++) {
      b.hz.orb({ x: p.x, z: p.z, dir: th + (k - (n - 1) / 2) * spread, speed: o.speed ?? 7.8, r: 0.42, life: 4.5, dmg: o.dmg ?? 15, label: 'Shard Volley', homing: o.homing || 0,
        onPop: (h, hit) => onOrbPop(b, h, hit) });
    }
  }
  function onOrbPop(b, h, hit) {
    if (hit) return;
    const hz = h.hazard; if (!hz) return;
    if (Math.hypot(hz.x, hz.z) > arenaR() + 0.5) return;     // flew off the rim: not a clear
    const D = b.data, now = b.clock;
    D.pops = D.pops.filter(t => now - t < 0.3); D.pops.push(now);
    if (D.pops.length >= 3 && now - D.lastDiscord > 2.5 && b.alive) { D.lastDiscord = now; discord(b); }
  }
  function discord(b) {
    b.expose(3); b.data.flicker = 1.2;
    b.say('DISCORD. The choir falters.', 2.0);
    fx('number', V(b.pos.x, HOVER_Y + 3.4, b.pos.z), 0, { text: 'DISCORD', color: VIOLET, crit: true, size: 0.7 });
    fx('shockwave', V(b.pos.x, 0.2, b.pos.z), { color: VIOLET, radius: 5, life: 0.5 });
    for (const s of liveShards(b)) fx('burst', shardWorld(b, s), { color: VIOLET, count: 8, speed: 3, size: 0.3, life: 0.4 });
    sfx('crack', { vol: 0.6, pitch: 0.8 }); world('beat', 0.6);
  }

  // Hymn: blue safe disc(s). n = 1 or 2 (far apart); avoids her body and the P3 pits. Returns the handles.
  function hymn(b, n = 1, o = {}) {
    const r = o.r ?? 2.7, dmg = o.dmg ?? 24, warn = o.warn ?? 2.6;
    const voids = b.data.voids.map(h => h.hazard).filter(h => h && !h.done);
    const ok = (x, z) => {
      if (Math.hypot(x, z) > arenaR() - r - 0.2) return false;
      if (Math.hypot(x - b.pos.x, z - b.pos.z) < b.hitRadius + r * 0.6) return false;
      for (const v of voids) if (Math.hypot(x - v.x, z - v.z) < v.r + r + 0.3) return false;
      return true;
    };
    const base = b.rand() * TAU, hs = [], spots = [];
    for (let k = 0; k < n; k++) {
      let pos = null;
      for (let tries = 0; tries < 24 && !pos; tries++) {
        const th = base + k * PI + (b.rand() - 0.5) * 0.9 * (tries > 8 ? 2 : 1), rad = n > 1 ? 6.5 + b.rand() * 1.5 : 4.0 + b.rand() * 4.5;
        const x = Math.cos(th) * rad, z = -Math.sin(th) * rad;
        if (ok(x, z) && spots.every(q => Math.hypot(q[0] - x, q[1] - z) > r * 2 + 4)) pos = [x, z];
      }
      if (!pos) pos = [Math.cos(base + k * PI) * 6.5, -Math.sin(base + k * PI) * 6.5];
      spots.push(pos);
      hs.push(b.hz.safe({ x: pos[0], z: pos[1], r, warn, dmg, label: 'Hymn', flashColor: ACC,
        onFire: () => { fx('shockwave', V(b.pos.x, 0.3, b.pos.z), { color: ACC, radius: 15, life: 0.7, intensity: 1.3 }); fx('burst', V(b.pos.x, HOVER_Y + 1.4, b.pos.z), { color: WHITE, count: 30, speed: 7, size: 0.5, life: 0.6 }); } }));
    }
    b.say(n > 1 ? 'Two voices. Choose one.' : 'Hymn. Stand in the light.', 2.2);
    sfx('swell', { vol: 0.6 });
    for (const s of liveShards(b)) fx('burst', shardWorld(b, s), { color: BLUE, count: 6, speed: 2.5, size: 0.3, life: 0.5 });
    return hs;
  }

  // Chorus: twin rotating spokes from her (P2+). She holds position while they turn. Returns the handles.
  function rotor(b, dur = 7, omega = 0.7, o = {}) {
    const D = b.data; D.noMove = true; b.stopMove();
    const th = b.playerTheta() + PI / 2;
    const dirSign = b.rand() < 0.5 ? -1 : 1;
    const offs = o.four ? [0, PI / 2, PI, PI * 1.5] : [0, PI];
    const hs = offs.map(off => b.hz.cone({ x: b.pos.x, z: b.pos.z, theta: th + off, width: o.width ?? 0.3, r: arenaR() + 1, r0: 0.5, omega: omega * dirSign, dur, warn: o.warn ?? 2.0, tick: 0.5, dmg: o.dmg ?? 14, label: 'Chorus Beam', anchor: 'boss',
      onFire: () => { sfx('lance', { vol: 0.5, pitch: 0.9 }); world('rimGlow', ACC, 0.5, 0.6); },
      onEnd: () => { D.noMove = false; } }));
    holdShards(b, 0.8);
    b.say('Chorus. Keep turning.', 2.0);
    return hs;
  }

  // Shatter Wave (P3): gold collapsing ring with two blue lanes placed between the pits. Returns the handle.
  function shatterWave(b) {
    const lanes = laneAngles(b);
    const i0 = b.randInt(0, lanes.length - 1); const rest = lanes.filter((a, i) => i !== i0);
    const pick = [lanes[i0], rest[b.randInt(0, rest.length - 1)]].filter(a => a != null);
    b.say('The floor sings. Find a lane.', 2.4);
    sfx('lethalWarn', { vol: 0.6 });
    return b.hz.wave({ x: 0, z: 0, r0: arenaR() + 1.6, r1: 0.4, speed: 5.2, thickness: 1.4, warn: 2.7, dmg: 50, unblockable: true, gaps: pick.map(th => ({ theta: th, width: 0.52 })), label: 'Shatter Wave',
      onFire: () => { cam('shake', 0.45, 0.6); sfx('rumble', { vol: 0.6 }); world('floorGlow', ACC, 0.5, 0.8); post('bloomPulse', 0.25, 0.6); },
      onEnd: () => { fx('shards', V(0, 0.3, 0), { color: prism(), count: 40, speed: 7, size: 0.2, life: 1.2 }); } });
  }
  function laneAngles(b) {   // the midpoints between the pits that no pit sits on
    const D = b.data; const voids = D.voids.map(h => h.hazard).filter(h => h && !h.done);
    const out = [];
    for (let k = 0; k < 3; k++) {
      const th = D.voidBase + PI / 3 + k * TAU / 3;
      const blocked = voids.some(v => Math.abs(wrap(Math.atan2(-v.z, v.x) - th)) < 0.42);
      if (!blocked) out.push(th);
    }
    return out.length >= 2 ? out : [D.voidBase + PI / 3, D.voidBase + PI];
  }
  // A persistent pit. (G.hz.void passes active: Infinity, which the framework's num() rejects as non-finite, so a
  // void lives only 0.25 s; a circle with a large finite `active`, a tick and the void shader mode does the job.)
  function addVoid(b, th, rad) {
    const D = b.data;
    const x = Math.cos(th) * rad, z = -Math.sin(th) * rad;
    const h = b.hz.circle({ x, z, r: 2.1, warn: 1.8, active: 1e6, tick: 0.6, dmg: 14, label: 'Shattered Floor', mode: 4, color: G.hz.COL.void, burst: false, liveStyle: 'soft',
      onFire: () => { fx('shards', V(x, 0.2, z), { color: prism(), count: 30, speed: 6, size: 0.2, life: 1.3 }); fx('burst', V(x, 0.3, z), { color: VIOLET, count: 20, speed: 5, size: 0.5, life: 0.6 }); cam('shake', 0.35, 0.4); sfx('crack', { vol: 0.8, pitch: 0.7 }); } });
    try { const m = h.hazard.meshes[0]; m.position.y = G.combat.TELE_Y - 0.015; m.renderOrder = 5; } catch (e) { }
    D.voids.push(h);
    return h;
  }
  function clearVoids(b) { for (const h of b.data.voids) { try { h.cancel(); } catch (e) { } } b.data.voids.length = 0; }

  // the interruptible cast of each phase
  async function crescendo(b, name, o = {}) {
    b.stopMove();
    const r = await b.cast({ name, dur: o.dur ?? 3.4, interruptible: true,
      telegraph: () => { holdShards(b, 0.5); for (const s of liveShards(b)) s.lit = 0.4; return null; },
      onDone: () => {
        b.hz.wipe(o.wipe ?? 15, name);
        setShardCount(b, Math.min(7, liveShards(b).length + 2), 'grow');
        fx('shockwave', V(b.pos.x, 0.3, b.pos.z), { color: WHITE, radius: 14, life: 0.8, intensity: 1.4 });
        fx('shards', V(b.pos.x, HOVER_Y + 1.5, b.pos.z), { color: prism(), count: 36, speed: 8, size: 0.2, life: 1.4 });
        post('bloomPulse', 0.3, 0.7); world('beat', 1); sfx('castDone');
        b.say(o.doneLine || 'The choir swells.', 2.2);
        try { o.onDone && o.onDone(); } catch (e) { }
      },
      onInterrupt: () => {
        const live = liveShards(b);
        if (live.length > 2) dropShard(b, live[live.length - 1], 'drop');
        b.say(o.failLine || 'A mirror cracks. Her song breaks.', 2.2);
      } });
    return r;
  }

  // hover positions: she glides between a few spots (never far from the centre so the beams cover the floor)
  const SPOTS = [[0, 0], [4.2, 0], [-4.2, 0], [0, -4.2], [0, 4.0], [3.0, -3.0], [-3.0, -3.0], [3.0, 3.0], [-3.0, 3.0]];
  async function glide(b) {
    const D = b.data; if (D.noMove) return;
    const gen = b.gen;
    const far = SPOTS.filter(s => Math.hypot(s[0] - b.pos.x, s[1] - b.pos.z) > 3.5);
    const s = b.pick(far.length ? far : SPOTS);
    fx('burst', V(b.pos.x, HOVER_Y + 0.6, b.pos.z), { color: ROSE, count: 10, speed: 2, size: 0.35, life: 0.5 });
    await b.moveTo(s[0], s[1], 2.8);
    // moveTo resolves 'aborted' (no rejection) on a phase change, and b.wait() would capture the NEW gen: check by hand
    if (gen !== b.gen || !b.alive) throw new G.combat.Abort();
  }
  // prismatic sparkle: the escalation of the later phases
  function sparkleLoop(b, every) {
    b.loop(async () => {
      await b.wait(every * (0.7 + b.rand() * 0.6));
      const live = liveShards(b); if (!live.length) return;
      const s = live[b.randInt(0, live.length - 1)];
      fx('shards', shardWorld(b, s), { color: prism(), count: 10, speed: 3.5, size: 0.14, life: 1.0 });
      fx('lance', shardWorld(b, s), V(b.pos.x, HOVER_Y + 1.3, b.pos.z), { color: ROSE, width: 0.25, life: 0.3, intensity: 1.2 });
      world('beat', 0.3);
    });
  }
  function enterCommon(b, base, speed) {
    const D = b.data;
    b.turnRate = 2.4; b.trackPlayer = true; b.facingTarget = null; D.noMove = false; D.scatter = 0; D.hold = 0;
    D.orbitSpeed = speed;
    setShardCount(b, base, 'grow');
  }

  // --------------------------------------------------------------- the boss
  G.bosses[1] = {
    name: 'SERAPHINE', title: 'the Mirror Choir', court: 'The Court of Glass', accent: ACC, sky: 'glass', arena: 'glass', music: 1,
    maxHp: 9500, parTime: 240, hitRadius: 1.3, hitHeight: 2.4, bodyRadius: 0.9, speed: 2.8, turnRate: 2.4,
    intro: ['The choir has rehearsed your death a thousand times.', 'Tonight the mirrors sing it true.'],
    phases: [
      // ------------------------------------------------ P1 REFLECTION: beams in pairs, volleys, Hymn, Crescendo
      { name: 'Reflection', hpStart: 1.0, sky: ['glass', 1],
        enter(b) { enterCommon(b, 3, 0.75); },
        async script(b) {
          await b.wait(1.0);
          b.loop(async () => {
            await last(mirrorBeams(b, 3, 'tangent'));
            await b.wait(0.3);
            volley(b, b.pick(liveShards(b)), 6, 0.18, { homing: 0.14 });
            await b.wait(1.8);
            await glide(b);
            const hs = hymn(b, 1, { r: 2.6, dmg: 24, warn: 2.6 });
            await b.wait(0.5);
            await last(mirrorBeams(b, 2, 'spoke', { warn: 2.0 }));
            await last(hs);
            await b.wait(0.6);
            await reflect(b, 2, 3);
            await b.wait(0.2);
            volley(b, b.pick(liveShards(b)), 6, 0.2, { homing: 0.14 });
            await b.wait(1.0);
            volley(b, b.pick(liveShards(b)), 6, 0.2, { homing: 0.14 });
            await b.wait(1.6);
            await glide(b);
            await b.wait(0.3);
          });
          b.loop(async () => {
            await b.wait(11);
            await crescendo(b, 'Crescendo', { dur: 3.4, wipe: 15 });
            await b.wait(7);
          });
        } },
      // ------------------------------------------------ P2 CHORUS: rotating spokes, double Hymn, reflected beams
      { name: 'Chorus', hpStart: 0.62, sky: ['glass', 2],
        enter(b) { enterCommon(b, 4, 0.95); world('rimGlow', ACC, 0.35, 0); },
        async script(b) {
          sparkleLoop(b, 5);
          await b.wait(1.0);
          b.loop(async () => {
            await reflect(b, 4, 3);
            await b.wait(0.4);
            const rh = rotor(b, 7, 0.7);
            await b.wait(2.4);
            const sh = liveShards(b); volley(b, sh[0], 5, 0.22, { homing: 0.12 }); await b.wait(0.9); volley(b, sh[2] || sh[1], 5, 0.22, { homing: 0.12 });
            await b.wait(1.4);
            await last(mirrorBeams(b, 2, 'tangent', { warn: 2.0 }));
            await last(rh);
            await b.wait(0.4);
            await glide(b);
            const hs = hymn(b, 2, { r: 2.6, dmg: 24, warn: 2.6 });
            await b.wait(0.5);
            await last(mirrorBeams(b, 3, 'tangent', { warn: 2.0 }));
            await last(hs);
            await b.wait(0.6);
            await last(mirrorBeams(b, Math.min(liveShards(b).length, 4), 'spoke'));
            await b.wait(0.2);
            volley(b, b.pick(liveShards(b)), 6, 0.2, { homing: 0.12 });
            await b.wait(1.0);
            volley(b, b.pick(liveShards(b)), 6, 0.2, { homing: 0.12 });
            await b.wait(1.4);
            await glide(b);
            await b.wait(0.3);
          });
          b.loop(async () => {
            await b.wait(10);
            const r = await crescendo(b, 'Crescendo', { dur: 3.4, wipe: 15, doneLine: 'The chorus doubles.' });
            if (r === 'done') { await b.wait(1.2); await last(rotor(b, 6, 0.85)); }
            await b.wait(8);
          });
        } },
      // ------------------------------------------------ P3 SHATTER: the floor breaks, the collapsing wave, Requiem
      { name: 'Shatter', hpStart: 0.28, sky: ['glass', 3],
        enter(b) {
          const D = b.data;
          enterCommon(b, 5, 1.1);
          world('rimGlow', ACC, 0.55, 0); world('floorGlow', ACC, 0.22, 0);
          D.voidBase = b.rand() * TAU;
          for (let k = 0; k < 3; k++) addVoid(b, D.voidBase + k * TAU / 3, 7.4);
          b.say('The floor remembers every reflection.', 2.6);
        },
        async script(b) {
          const D = b.data;
          sparkleLoop(b, 3);
          await b.wait(2.2);
          b.loop(async () => {
            await last(mirrorBeams(b, 4, 'tangent'));
            await b.wait(0.4);
            const wh = shatterWave(b);
            await b.wait(0.7);
            const sh = liveShards(b);
            for (let i = 0; i < Math.min(3, sh.length); i++) { volley(b, sh[i], 4, 0.24, { homing: 0.12 }); await b.wait(0.4); }
            await wh;
            await b.wait(0.6);
            await glide(b);
            const hs = hymn(b, 1, { r: 2.5, dmg: 24, warn: 2.6 });
            await b.wait(0.5);
            await last(mirrorBeams(b, 3, 'spoke', { warn: 2.0 }));
            await last(hs);
            await b.wait(0.6);
            const rh = rotor(b, 6, 0.75, { four: true, width: 0.26 });
            await b.wait(2.4);
            const sh2 = liveShards(b); volley(b, sh2[1] || sh2[0], 5, 0.22, { homing: 0.14 }); await b.wait(0.8); volley(b, sh2[3] || sh2[0], 5, 0.22, { homing: 0.14 });
            await last(rh);
            await b.wait(0.3);
            await reflect(b, 3, 5);
            await b.wait(0.6);
            await glide(b);
            await b.wait(0.3);
          });
          b.loop(async () => {
            await b.wait(9);
            await crescendo(b, 'Requiem', { dur: 3.6, wipe: 15, doneLine: 'Requiem. The floor gives way.', failLine: 'The requiem dies in her throat.',
              onDone: () => { if (D.voids.filter(h => h.hazard && !h.hazard.done).length < 4) { const lanes = laneAngles(b); addVoid(b, lanes[b.randInt(0, lanes.length - 1)], 7.4); } } });
            await b.wait(8);
          });
        } },
    ],

    build, animate,

    // the shards fly out, a cold flash, the choir reforms around her
    onTransition(b, from, to) {
      const D = b.data;
      D.hold = 0; D.scatter = 1;
      fx('flash', COLD, 0.5, 0.7); cam('shake', 0.55, 0.7); sfx('crack', { vol: 0.9, pitch: 0.9 }); sfx('swell', { vol: 0.8 });
      post('bloomPulse', 0.4, 0.9); world('beat', 1);
      fx('shockwave', V(b.pos.x, 0.3, b.pos.z), { color: ACC, radius: 16, life: 1.1, intensity: 1.4 });
      fx('shards', V(b.pos.x, HOVER_Y + 1.2, b.pos.z), { color: prism(), count: 60, speed: 9, size: 0.22, life: 1.6 });
      for (const s of liveShards(b)) { s.lit = 1.4; fx('burst', shardWorld(b, s), { color: WHITE, count: 10, speed: 4, size: 0.4, life: 0.5 }); }
      const home = G.camera ? G.camera.position.toArray() : [0, 20, 16];
      const cin = cam('cinematic', [
        { t: 0, pos: home, look: [0, 0.5, 0] },
        { t: 1.3, pos: [b.pos.x + 2.5, 4.8, b.pos.z + 10.5], look: [b.pos.x, 2.8, b.pos.z] },
        { t: 3.3, pos: home, look: [0, 0.5, 0] },
      ], { name: 'transition' });
      (async () => {
        await cwait(1.4);
        D.scatter = 0;
        fx('flash', ROSE, 0.3, 0.4); sfx('crack', { vol: 0.6, pitch: 1.3 });
        for (const s of liveShards(b)) fx('burst', shardWorld(b, s), { color: ROSE, count: 12, speed: 4, size: 0.4, life: 0.5 });
        world('floorGlow', ACC, 0.45, 0.9);
      })().catch(() => { });
      return cin || Promise.resolve();
    },

    // she rises; the shards shatter one by one; the body cracks and bursts into light
    async onDeath(b) {
      const D = b.data; D.dead = true; D.hold = 1e9; D.rise = 1; D.noMove = false;
      clearVoids(b);
      cam('slowMo', 0.35, 1.0);
      const home = G.camera ? G.camera.position.toArray() : [0, 20, 16];
      const cin = cam('cinematic', [
        { t: 0, pos: home, look: [0, 0.5, 0] },
        { t: 1.8, pos: [b.pos.x + 1.5, 5.5, b.pos.z + 10], look: [b.pos.x, 3.6, b.pos.z] },
        { t: 5.4, pos: [b.pos.x - 4, 8.5, b.pos.z + 13], look: [b.pos.x, 4.5, b.pos.z] },
        { t: 7.6, pos: home, look: [0, 0.5, 0] },
      ], { name: 'death' });
      world('floorGlow', ACC, 0.5, 0);
      await cwait(0.6);
      const shards = liveShards(b);
      for (let i = 0; i < shards.length; i++) {
        const s = shards[i]; const p = shardWorld(b, s);
        fx('shards', p, { color: prism(), count: 26, speed: 7, size: 0.2, life: 1.4 });
        fx('burst', p, { color: WHITE, count: 18, speed: 5, size: 0.5, life: 0.6 });
        fx('lance', p, V(b.pos.x, HOVER_Y + 1.3 + (D.riseY || 0), b.pos.z), { color: ROSE, width: 0.4, life: 0.4 });
        sfx('crack', { vol: 0.8, pitch: 1.1 + i * 0.08 }); cam('shake', 0.3, 0.25);
        try { G.combat.removeObj(s.grp); } catch (e) { s.grp.visible = false; }
        s.alive = false;
        await cwait(0.42);
      }
      D.crack = 1; sfx('rumble', { vol: 0.8 }); cam('shake', 0.5, 1.2);
      for (let i = 0; i < 4; i++) {
        fx('burst', V(b.pos.x + (Math.random() - 0.5), HOVER_Y + 1 + (D.riseY || 0) + Math.random() * 1.5, b.pos.z + (Math.random() - 0.5)), { color: i % 2 ? ACC : WHITE, count: 20, speed: 5, size: 0.5, life: 0.7 });
        sfx('crack', { vol: 0.6, pitch: 0.7 + i * 0.1 });
        await cwait(0.3);
      }
      const top = V(b.pos.x, HOVER_Y + 1.3 + (D.riseY || 0), b.pos.z);
      fx('flash', '#fff6fb', 0.95, 1.3); post('bloomPulse', 0.6, 1.2);
      fx('burst', top, { color: WHITE, count: 120, speed: 11, size: 0.9, life: 1.2, flareSize: 2.5 });
      fx('shards', top, { color: prism(), count: 90, speed: 10, size: 0.24, life: 1.8 });
      fx('shockwave', V(b.pos.x, 0.3, b.pos.z), { color: ACC, radius: 18, life: 1.2, intensity: 1.6 });
      sfx('bossDeath'); cam('shake', 0.8, 0.8);
      b.model.visible = false;
      world('floorGlow', WHITE, 0.6, 1.5);
      return cin || Promise.resolve();
    },

    teardown(b) {
      const D = b.data || {};
      try { clearVoids(b); } catch (e) { }
      world('floorGlow', ACC, 0, 0.3); world('rimGlow', ACC, 0, 0.3);
      D.hold = 0; D.scatter = 0; D.rise = 0; D.crack = 0;
    },
  };
})();
