// =====================================================================
// 07_player.js: the Regicide. Model, free movement on the disc, the kit
// (Rend auto-attack, Dash, Bulwark/Riposte, Rebuke, Mend, Verdict), edict
// mods, damage intake, stats, prediction for bosses and the bot.
// See SPEC.md section 3.
// =====================================================================
(() => {
  const T3 = G.THREE;
  const PI = Math.PI, TAU = PI * 2;
  const V = T3.Vector3;
  const clamp = G.clamp, lerp = G.lerp;
  const logE = (w, e) => G.log.error(w, e);
  const fx = (name, ...a) => { try { const f = G.fx && G.fx[name]; return f ? f.apply(G.fx, a) : undefined; } catch (e) { logE('fx.' + name, e); } };
  const sfx = (name, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(name, o); } catch (e) { } };
  const cam = (name, ...a) => { try { const f = G.cam && G.cam[name]; return f ? f.apply(G.cam, a) : undefined; } catch (e) { } };
  const PLAY = () => G.state === 'fight' || G.state === 'practice';
  const arenaR = () => (G.world && G.world.arenaR != null) ? G.world.arenaR : (G.ARENA_R || 13);

  // ------------------------------------------------ tunable constants
  const K = {
    maxHp: 100, speed: 7.5, radius: 0.45, hitIframes: 0.5,
    rendRange: 7, rendPeriod: 0.42, rendDmg: 10, cleaveDmg: 24, addRange: 4,
    dashDist: 4.6, dashDur: 0.22, dashIframes: 0.32, dashCharges: 2, dashCd: 5,
    shieldHold: 2.5, riposteBase: 20, riposteMax: 3.0, riposteMin: 1.0, riposteGrace: 0.6, bulwarkCd: 14, tapDur: 0.5,
    rebukeCd: 9, rebukeRange: 8, rebukeWidth: G.deg(120), exposeDur: 6, rebukeStun: 2.5,
    mendCharges: 2, mendCd: 24, mendAmt: 35, mendDur: 2,
    ultNeed: 400, verdictDmg: 160, verdictDur: 0.9,
  };
  const NEUTRAL = () => ({ dmgMul: 1, maxHp: 0, dashCharges: 0, dashCd: 1, mendCharges: 0, mendAmt: 1, rebukeCd: 1, riposteMul: 1, riposteStun: 0, ultRate: 1, lifesteal: 0, lastRites: false, dashTrail: false, takenMul: 1, speedMul: 1, rebukeHeal: 0, cleaveMul: 1, exposeDur: K.exposeDur, shieldHold: 0, mirrorGuard: false, verdictMul: 1, executioner: 0, juggernaut: false, phaseHeal: 0, bulwarkCd: 1 });

  // ------------------------------------------------------------ state
  const S = {
    hp: 100, maxHp: 100, pos: new V(0, 0, 8), vel: new V(), facing: PI / 2, alive: true, dashing: false, iframes: 0, invuln: false,
    shield: { up: false, absorbed: 0, lastHitAt: -9, t: 0, tap: false }, cds: { dash: [0, 0, 0], mend: [0, 0, 0], rebuke: 0, bulwark: 0 },
    ult: 0, ultActive: false, burning: 0, burnDps: 0, slowMul: 1, slowT: 0, lastRitesUsed: false, practice: false, mendHot: 0, mendHotRate: 0,
    speedMulT: 0, speedMul: 1, pull: null, combo: 0, target: null, lastHitLabel: '', deadT: 0,
  };
  let mods = NEUTRAL();
  const stats = { damageTaken: 0, hitsTaken: 0, damageDealt: 0, damageBySkill: {}, interrupts: 0, ripostes: 0, absorbed: 0, deaths: 0, dashes: 0, rebukes: 0, mends: 0, verdicts: 0 };
  const dashMax = () => K.dashCharges + (mods.dashCharges | 0);
  const mendMax = () => K.mendCharges + (mods.mendCharges | 0);
  const shieldHold = () => K.shieldHold + (mods.shieldHold || 0);
  const maxHp = () => Math.max(20, Math.round(K.maxHp + (mods.maxHp || 0)));

  // ============================================================ MODEL
  let root, model, blade, bladeGlow, cloak, body, head, hood, markerRing, shieldDome, healGlow, trail = null, dashTrail = null, markerU;
  const tmp = new V(), tmp2 = new V();
  function buildModel() {
    root = new T3.Group(); root.name = 'regicide';
    model = new T3.Group(); model.scale.setScalar(1.22); root.add(model);
    const dark = G.mat.brass({ color: '#1c1522', metalness: 0.55, roughness: 0.6 });
    const gold = G.mat.brass({ color: '#d7a648', metalness: 0.95, roughness: 0.3 });
    const red = G.mat.brass({ color: '#6a1a22', metalness: 0.4, roughness: 0.7 });
    // cloak: a tapered cone, slightly swept back (-x)
    cloak = new T3.Mesh(new T3.ConeGeometry(0.62, 1.75, 14, 1, true), red); cloak.position.set(-0.08, 0.88, 0); cloak.rotation.z = 0.08; cloak.material.side = T3.DoubleSide; model.add(cloak);
    body = new T3.Mesh(new T3.CapsuleGeometry(0.34, 0.75, 6, 10), dark); body.position.y = 1.05; model.add(body);
    const belt = new T3.Mesh(new T3.TorusGeometry(0.37, 0.05, 6, 16), gold); belt.rotation.x = PI / 2; belt.position.y = 0.95; model.add(belt);
    const pauldron = new T3.Mesh(new T3.SphereGeometry(0.22, 10, 8, 0, TAU, 0, PI / 2), gold); pauldron.position.set(0.05, 1.48, 0.36); model.add(pauldron);
    const pauldron2 = pauldron.clone(); pauldron2.position.z = -0.36; model.add(pauldron2);
    head = new T3.Mesh(new T3.SphereGeometry(0.24, 12, 10), dark); head.position.y = 1.78; model.add(head);
    hood = new T3.Mesh(new T3.ConeGeometry(0.34, 0.62, 12, 1, true), red); hood.position.set(-0.06, 1.95, 0); hood.rotation.z = 0.15; hood.material = red; model.add(hood);
    // the crown-shard mask: a thin gold glowing slit
    const visor = new T3.Mesh(new T3.BoxGeometry(0.2, 0.05, 0.3), G.mat.emissive('#ffd36b', 2.2)); visor.position.set(0.2, 1.8, 0); model.add(visor);
    // the blade: a long thin emissive box held forward (+x)
    blade = new T3.Group(); blade.position.set(0.3, 1.0, 0.3);
    const bl = new T3.Mesh(new T3.BoxGeometry(1.5, 0.05, 0.12), G.mat.emissive('#ffe3a0', 2.4)); bl.position.x = 0.75; blade.add(bl);
    const hilt = new T3.Mesh(new T3.BoxGeometry(0.22, 0.09, 0.3), gold); blade.add(hilt);
    bladeGlow = G.fx && G.fx.glowSprite ? G.fx.glowSprite('#ffd36b', 1.2, { intensity: 1.2, opacity: 0.6 }) : null; if (bladeGlow) { bladeGlow.position.x = 1.0; blade.add(bladeGlow); }
    model.add(blade);
    // ground marker (position readability)
    markerRing = G.hz.teleMesh({ shape: 'ring', r0: 0.5, r1: 0.62, color: '#ffd36b', y: 0.03, order: 9 });
    markerU = markerRing.material.uniforms; markerU.uP.value = 1; markerU.uAlpha.value = 0.8; markerU.uMode.value = 5; markerU.uArrow.value = 0;
    root.add(markerRing);
    // shield dome
    shieldDome = new T3.Mesh(new T3.SphereGeometry(1.35, 24, 16), G.mat.additive('#ffd36b', 0.35, { intensity: 1.2 })); shieldDome.position.y = 1.0; shieldDome.visible = false; root.add(shieldDome);
    healGlow = G.fx && G.fx.glowSprite ? G.fx.glowSprite('#5cff9a', 3.0, { intensity: 1.0, opacity: 0 }) : null; if (healGlow) { healGlow.position.y = 1.0; root.add(healGlow); }
    root.position.copy(S.pos);
    (G.layers && G.layers.player || G.scene).add(root);
    trail = G.fx && G.fx.trail ? G.fx.trail(body, { color: '#ffd36b', width: 0.35, length: 14, intensity: 0.9, opacity: 0.0 }) : null;
    if (trail && trail.setVisible) trail.setVisible(false);
  }

  // ============================================================ MOVEMENT
  const move = new V();
  function stepMove(dt) {
    if (!S.alive) return;
    const inp = G.input ? G.input.move : { x: 0, z: 0, mag: 0 };
    let speed = K.speed * (mods.speedMul || 1) * S.slowMul * S.speedMul;
    if (S.shield.up && !S.shield.tap) speed *= 0.8;   // a raised shield slows you a little
    if (S.dashing) {
      const u = clamp(S.dashT / K.dashDur, 0, 1);
      const dist = K.dashDist * (mods.juggernaut ? 2 : 1);
      const v = dist / K.dashDur * (1.0 + 0.6 * (1 - u));   // a little front-loaded
      S.vel.set(S.dashDir.x * v, 0, S.dashDir.z * v);
      S.dashT += dt; if (S.dashT >= K.dashDur) { S.dashing = false; S.vel.multiplyScalar(0.2); }
    } else if (S.ultActive) { S.vel.set(0, 0, 0); }
    else {
      move.set(inp.x * speed, 0, inp.z * speed);
      // short smoothing (60 ms) for feel
      S.vel.x = G.damp(S.vel.x, move.x, 24, dt); S.vel.z = G.damp(S.vel.z, move.z, 24, dt);
    }
    if (S.pull) {
      S.pull.t -= dt; if (S.pull.t <= 0) S.pull = null;
      else { const dx = S.pull.x - S.pos.x, dz = S.pull.z - S.pos.z, d = Math.hypot(dx, dz) || 1e-3; if (d > 0.3 && !S.dashing) { const k = S.pull.strength * Math.min(dt, 1 / 20) * 30; S.vel.x += dx / d * k; S.vel.z += dz / d * k; } }
    }
    S.pos.x += S.vel.x * dt; S.pos.z += S.vel.z * dt;
    // keep inside the live arena
    const R = arenaR() - 0.4, d = Math.hypot(S.pos.x, S.pos.z);
    if (d > R) { S.pos.x *= R / d; S.pos.z *= R / d; if (S.dashing) S.dashing = false; }
    // the boss has a body
    const b = G.combat && G.combat.boss;
    if (b && b.alive && !S.dashing && !S.ultActive && !b.noBody) {
      const dx = S.pos.x - b.pos.x, dz = S.pos.z - b.pos.z, dd = Math.hypot(dx, dz), minD = b.bodyRadius + 0.25;
      if (dd < minD) { const k = dd > 1e-3 ? minD / dd : 1; S.pos.x = b.pos.x + (dd > 1e-3 ? dx * k : minD); S.pos.z = b.pos.z + (dd > 1e-3 ? dz * k : 0); }
    }
    // facing: toward the target while attacking, else along movement
    const t = S.target;
    if (t && t.pos) S.facing = Math.atan2(-(t.pos.z - S.pos.z), t.pos.x - S.pos.x);
    else if (inp.mag > 0.1) S.facing = Math.atan2(-inp.z, inp.x);
    root.position.copy(S.pos);
    model.rotation.y = G.damp(model.rotation.y, model.rotation.y + G.angDiff(S.facing, model.rotation.y), 18, dt);
  }
  // ------------------------------------------------------------ targeting
  function pickTarget() {
    const b = G.combat && G.combat.boss;
    let best = null, bd = 1e9;
    if (b && b.alive && !b.invulnerable) { const d = Math.hypot(b.pos.x - S.pos.x, b.pos.z - S.pos.z) - b.hitRadius; if (d <= K.rendRange) { best = b; bd = d; } }
    const a = G.adds && G.adds.nearest ? G.adds.nearest(S.pos.x, S.pos.z, K.addRange) : null;
    if (a) { const d = Math.hypot(a.pos.x - S.pos.x, a.pos.z - S.pos.z) - a.radius; if (d < bd) { best = a; bd = d; } }
    return best;
  }
  const isBoss = (t) => !!(t && t.def);
  const targetPoint = (t, out) => { if (isBoss(t)) return out.copy(t.hitPoint(Math.atan2(-(S.pos.z - t.pos.z), S.pos.x - t.pos.x))); return out.copy(t.pos).setY(0.9); };

  // ============================================================ REND
  let rendT = 0;
  function stepRend(dt) {
    if (!S.alive || !PLAY() || S.ultActive) { S.target = null; return; }
    const t = pickTarget(); S.target = t;
    if (!t) { rendT = Math.min(rendT, K.rendPeriod * 0.5); return; }
    if (S.dashing) return;
    rendT -= dt;
    if (rendT > 0) return;
    rendT = K.rendPeriod;
    S.combo = (S.combo + 1) % 3;
    const cleave = S.combo === 0;
    const base = cleave ? K.cleaveDmg * (mods.cleaveMul || 1) : K.rendDmg;
    const to = targetPoint(t, tmp), from = tmp2.copy(S.pos).setY(1.0);
    from.x += Math.cos(S.facing) * 0.6; from.z -= Math.sin(S.facing) * 0.6;
    fx('lance', from, to, { color: cleave ? '#fff1c2' : '#ffd36b', width: cleave ? 0.5 : 0.28, life: cleave ? 0.3 : 0.22, intensity: cleave ? 2.2 : 1.6, travel: 0.6, tail: 0.5, flare: cleave });
    fx('burst', to, { color: cleave ? '#fff1c2' : '#ffd36b', count: cleave ? 14 : 5, speed: cleave ? 6 : 4, size: 0.3, life: 0.35, flareSize: cleave ? 1.1 : 0.6 });
    sfx(cleave ? 'cleave' : 'rend', { pitch: 0.95 + Math.random() * 0.1 });
    if (cleave) cam('shake', 0.08, 0.12);
    const info = { source: cleave ? 'cleave' : 'rend', crit: cleave, target: isBoss(t) ? null : t, pos: to.clone() };
    const dealt = G.combat.dealDamage(base, info);
    if (mods.lifesteal > 0 && dealt > 0) heal(mods.lifesteal, true);
    S.swing = 1;
  }

  // ============================================================ DASH
  function dash() {
    if (!S.alive || !PLAY() || S.ultActive || S.dashing) return false;
    const cds = S.cds.dash; let slot = -1;
    for (let i = 0; i < dashMax(); i++) if (cds[i] <= 0) { slot = i; break; }
    if (slot < 0) { fx('number', S.pos.clone().setY(2.2), 0, { text: 'NO DASH', color: '#ff9a8a', size: 0.45, life: 0.5 }); return false; }
    cds[slot] = K.dashCd * (mods.dashCd || 1);
    const inp = G.input ? G.input.move : { x: 0, z: 0, mag: 0 };
    let dx, dz;
    if (inp.mag > 0.1) { dx = inp.x; dz = inp.z; }
    else { const b = G.combat && G.combat.boss; if (b) { dx = S.pos.x - b.pos.x; dz = S.pos.z - b.pos.z; } else { dx = Math.cos(S.facing); dz = -Math.sin(S.facing); } }
    const d = Math.hypot(dx, dz) || 1; S.dashDir = { x: dx / d, z: dz / d };
    S.dashing = true; S.dashT = 0; S.iframes = Math.max(S.iframes, K.dashIframes); S.dashI = K.dashIframes;
    S.facing = Math.atan2(-S.dashDir.z, S.dashDir.x);
    stats.dashes++;
    fx('burst', S.pos.clone().setY(0.5), { color: '#ffd36b', count: 10, speed: 3, size: 0.3, life: 0.3, flareSize: 0.8 });
    if (trail) { trail.setVisible(true); S.trailT = 0.4; }
    sfx('dash'); G.emit('dash', { x: S.pos.x, z: S.pos.z, dir: S.dashDir });
    if (mods.dashTrail) { S.fireTrail = S.fireTrail || []; S.fireTrail.push({ x: S.pos.x, z: S.pos.z, ex: S.pos.x + S.dashDir.x * K.dashDist, ez: S.pos.z + S.dashDir.z * K.dashDist, t: 3, mesh: null }); makeFireTrail(S.fireTrail[S.fireTrail.length - 1]); }
    return true;
  }
  function makeFireTrail(tr) {
    const len = Math.hypot(tr.ex - tr.x, tr.ez - tr.z);
    const m = G.hz.teleMesh({ shape: 'rect', x: (tr.x + tr.ex) / 2, z: (tr.z + tr.ez) / 2, len, width: 1.2, rot: Math.atan2(-(tr.ez - tr.z), tr.ex - tr.x), color: '#ff7a2a', y: 0.025, order: 4 });
    m.material.uniforms.uP.value = 1; m.material.uniforms.uLive.value = 1; m.material.uniforms.uSoft.value = 1; m.material.uniforms.uAlpha.value = 0.7;
    (G.layers.fx || G.scene).add(m); tr.mesh = m;
  }
  function stepFireTrails(dt) {
    if (!S.fireTrail || !S.fireTrail.length) return;
    const b = G.combat && G.combat.boss;
    for (let i = S.fireTrail.length - 1; i >= 0; i--) {
      const tr = S.fireTrail[i]; tr.t -= dt;
      if (tr.mesh) { tr.mesh.material.uniforms.uTime.value += dt; tr.mesh.material.uniforms.uAlpha.value = Math.min(0.7, tr.t); }
      if (tr.t <= 0) { if (tr.mesh) G.combat.removeObj(tr.mesh); S.fireTrail.splice(i, 1); continue; }
      if (b && b.alive && PLAY()) {
        // distance from the boss centre to the segment
        const dx = tr.ex - tr.x, dz = tr.ez - tr.z, L2 = dx * dx + dz * dz || 1e-3;
        let u = ((b.pos.x - tr.x) * dx + (b.pos.z - tr.z) * dz) / L2; u = clamp(u, 0, 1);
        const cx = tr.x + dx * u, cz = tr.z + dz * u;
        if (Math.hypot(b.pos.x - cx, b.pos.z - cz) <= b.hitRadius + 0.6) { tr.acc = (tr.acc || 0) + 8 * dt; if (tr.acc >= 4) { G.combat.dealDamage(tr.acc, { source: 'afterimage', pos: new V(cx, 0.8, cz) }); tr.acc = 0; } }
      }
    }
  }

  // ============================================================ BULWARK / RIPOSTE
  function bulwarkDown() {
    if (!S.alive || !PLAY() || S.ultActive) return false;
    if (S.shield.up) return false;
    if (S.cds.bulwark > 0) { fx('number', S.pos.clone().setY(2.2), 0, { text: 'BULWARK ' + S.cds.bulwark.toFixed(1) + 's', color: '#ff9a8a', size: 0.45, life: 0.5 }); return false; }
    const sh = S.shield; sh.up = true; sh.absorbed = 0; sh.lastHitAt = -9; sh.t = 0; sh.tap = false; sh.full = false;
    shieldDome.visible = true; shieldDome.scale.setScalar(0.4);
    sfx('bulwarkUp'); G.emit('bulwarkUp', {});
    return true;
  }
  function bulwarkUp() {
    const sh = S.shield; if (!sh.up) return false;
    if (sh.t < 0.15 && !sh.tap) { sh.tap = true; return true; }   // a tap: keep it up for the tap duration, release then
    release(false);
    return true;
  }
  function release(auto) {
    const sh = S.shield; if (!sh.up) return;
    sh.up = false; shieldDome.visible = false;
    S.cds.bulwark = K.bulwarkCd * (mods.bulwarkCd || 1);
    riposte(sh, auto);
    G.emit('bulwarkDown', { auto });
  }
  function riposteMult(sh, auto) {
    if (sh.absorbed <= 0) return 1;
    const since = sh.t - sh.lastHitAt;
    let m = lerp(K.riposteMax, K.riposteMin, clamp((since - K.riposteGrace) / Math.max(0.3, shieldHold() - K.riposteGrace)));
    if (auto && mods.mirrorGuard) m = Math.max(m, 1.5);
    return m * (mods.riposteMul || 1);
  }
  function riposte(sh, auto) {
    const b = G.combat && G.combat.boss; if (!b || !b.alive || !PLAY()) return;
    const mult = riposteMult(sh, auto);
    const dmg = Math.round(K.riposteBase + sh.absorbed * mult);
    const from = S.pos.clone().setY(1.0), to = b.hitPoint(Math.atan2(-(S.pos.z - b.pos.z), S.pos.x - b.pos.x));
    fx('shockwave', S.pos.clone().setY(0.1), { color: '#ffd36b', radius: 3.5, life: 0.4, intensity: 1.6 });
    fx('lance', from, to, { color: '#fff1c2', width: 0.7 + Math.min(1.5, sh.absorbed / 40), life: 0.45, intensity: 2.4, travel: 0.45, tail: 0.4, flare: true });
    fx('burst', to, { color: '#fff1c2', count: 30, speed: 8, size: 0.6, life: 0.6 });
    fx('number', to.clone().setY(to.y + 1.0), 0, { text: 'RIPOSTE x' + mult.toFixed(1), color: '#fff1c2', size: 0.6, life: 0.9 });
    cam('shake', Math.min(0.8, 0.2 + sh.absorbed / 80), 0.35); cam('hitStop', Math.min(0.12, 0.04 + sh.absorbed / 600));
    sfx('riposte', { mult });
    stats.ripostes++;
    G.combat.dealDamage(dmg, { source: 'riposte', crit: true, big: true, pos: to });
    if (mods.riposteStun > 0 && sh.absorbed > 0) b.stagger(mods.riposteStun);
    G.emit('riposte', { mult, absorbed: sh.absorbed, dmg });
  }
  function stepShield(dt) {
    const sh = S.shield; if (!sh.up) return;
    sh.t += dt;
    shieldDome.scale.setScalar(G.damp(shieldDome.scale.x, 1, 14, dt));
    shieldDome.material.opacity = 0.22 + 0.1 * Math.sin(G.now * 9) + Math.min(0.35, sh.absorbed / 100);
    shieldDome.rotation.y += dt * 0.8;
    if (sh.tap && sh.t >= K.tapDur) { release(false); return; }
    if (sh.t >= shieldHold()) { sh.full = true; release(true); }
  }

  // ============================================================ REBUKE
  function rebuke() {
    if (!S.alive || !PLAY() || S.ultActive) return false;
    if (S.cds.rebuke > 0) { fx('number', S.pos.clone().setY(2.2), 0, { text: 'REBUKE ' + S.cds.rebuke.toFixed(1) + 's', color: '#ff9a8a', size: 0.45, life: 0.5 }); return false; }
    S.cds.rebuke = K.rebukeCd * (mods.rebukeCd || 1);
    const b = G.combat && G.combat.boss;
    // aim: the boss if it is in front-ish and in range, else the facing
    let th = S.facing;
    if (b && b.alive) th = Math.atan2(-(b.pos.z - S.pos.z), b.pos.x - S.pos.x);
    S.facing = th;
    const half = K.rebukeWidth / 2, R = K.rebukeRange;
    const inCone = (x, z, rad = 0) => { const dx = x - S.pos.x, dz = z - S.pos.z, d = Math.hypot(dx, dz); if (d - rad > R) return false; if (d < 0.5) return true; const a = Math.atan2(-dz, dx); return Math.abs(G.angDiff(a, th)) <= half + (rad > 0 ? Math.atan2(rad, d) : 0); };
    // visuals: a quick cone flash on the floor + a wave
    const cone = G.hz.teleMesh({ shape: 'sector', x: S.pos.x, z: S.pos.z, r0: 0.3, r1: R, theta: th, width: K.rebukeWidth, color: '#e9c0ff', y: 0.05, order: 10 });
    cone.material.uniforms.uP.value = 1; cone.material.uniforms.uLive.value = 1; cone.material.uniforms.uAlpha.value = 0.9; cone.userData.tele = true;
    (G.layers.fx || G.scene).add(cone); S.rebukeFx = { mesh: cone, t: 0.35 };
    fx('shockwave', S.pos.clone().setY(0.2), { color: '#e9c0ff', radius: R, life: 0.45, intensity: 1.8, thickness: 0.6 });
    cam('shake', 0.25, 0.25);
    let interrupted = false, cleared = 0, staggered = 0;
    if (b && b.alive && b.casting && b.casting.interruptible && inCone(b.pos.x, b.pos.z, b.hitRadius)) { interrupted = G.combat.interrupt(); }
    cleared = G.hz.clearProjectiles((h) => inCone(h.x, h.z, h.r || 0.5));
    for (const a of (G.adds ? G.adds.list : [])) if (a.alive && inCone(a.pos.x, a.pos.z, a.radius)) { G.adds.stagger(a, 3); staggered++; const dx = a.pos.x - S.pos.x, dz = a.pos.z - S.pos.z, d = Math.hypot(dx, dz) || 1; a.pos.x += dx / d * 2; a.pos.z += dz / d * 2; }
    if (cleared) fx('number', S.pos.clone().setY(2.4), 0, { text: cleared + ' CLEARED', color: '#e9c0ff', size: 0.5, life: 0.8 });
    if (mods.rebukeHeal > 0) heal(mods.rebukeHeal);
    stats.rebukes++;
    sfx('rebuke'); if (cleared) sfx('rebukeClear', { delay: 0.05 });
    G.emit('rebuke', { interrupted, cleared, staggered });
    return true;
  }

  // ============================================================ MEND
  function mend() {
    if (!S.alive || !PLAY() || S.ultActive) return false;
    const cds = S.cds.mend; let slot = -1;
    for (let i = 0; i < mendMax(); i++) if (cds[i] <= 0) { slot = i; break; }
    if (slot < 0) { fx('number', S.pos.clone().setY(2.2), 0, { text: 'NO MEND', color: '#ff9a8a', size: 0.45, life: 0.5 }); return false; }
    cds[slot] = K.mendCd;
    const amt = K.mendAmt * (mods.mendAmt || 1);
    S.mendHot += amt; S.mendHotRate = Math.max(S.mendHotRate, amt / K.mendDur);
    S.burning = 0; S.burnDps = 0;
    if (healGlow) healGlow.material.opacity = 0.9;
    fx('burst', S.pos.clone().setY(0.6), { color: '#5cff9a', count: 24, speed: 3, size: 0.35, life: 0.8, up: true, gravity: -2 });
    stats.mends++; sfx('mend'); G.emit('mend', { amount: amt });
    return true;
  }
  function heal(n, quiet) {
    if (!S.alive) return 0;
    const before = S.hp; S.hp = Math.min(S.maxHp, S.hp + n); const got = S.hp - before;
    if (got > 0 && !quiet && (!G.settings || G.settings.numbers !== false)) fx('number', S.pos.clone().setY(2.3), Math.round(got), { color: '#5cff9a', size: 0.6, life: 0.7, text: '+' + Math.round(got) });
    return got;
  }

  // ============================================================ VERDICT
  function verdict() {
    if (!S.alive || !PLAY() || S.ultActive) return false;
    const b = G.combat && G.combat.boss;
    if (S.ult < 1) { fx('number', S.pos.clone().setY(2.2), 0, { text: 'VERDICT ' + Math.round(S.ult * 100) + '%', color: '#ff9a8a', size: 0.45, life: 0.5 }); return false; }
    if (!b || !b.alive || b.invulnerable) return false;
    S.ult = 0; S.ultActive = true; S.ultT = 0; S.invuln = true;
    if (S.shield.up) release(false);
    S.ultFrom = S.pos.clone();
    const th = Math.atan2(-(S.pos.z - b.pos.z), S.pos.x - b.pos.x);
    S.ultTo = G.polar(b.hitRadius + 0.9, th, 0); S.ultTo.x += b.pos.x; S.ultTo.z += b.pos.z;
    S.ultHit = b.hitPoint(th);
    cam('slowMo', 0.35, 0.55); cam('shake', 0.2, 0.3);
    fx('flash', '#fff1c2', 0.25, 0.3);
    stats.verdicts++;
    G.emit('verdict', { impactIn: 0.5 });
    if (trail) { trail.setVisible(true); S.trailT = 1.0; }
    return true;
  }
  function stepVerdict(dt) {
    if (!S.ultActive) return;
    S.ultT += dt;
    const u = clamp(S.ultT / K.verdictDur, 0, 1);
    const b = G.combat && G.combat.boss;
    if (u < 0.55) {   // leap: arc toward the boss
      const k = G.smooth(u / 0.55);
      S.pos.lerpVectors(S.ultFrom, S.ultTo, k); S.pos.y = Math.sin(k * PI) * 4.5;
      S.facing = Math.atan2(-(S.ultTo.z - S.ultFrom.z), S.ultTo.x - S.ultFrom.x);
    } else if (!S.ultLanded) {
      S.ultLanded = true; S.pos.copy(S.ultTo); S.pos.y = 0;
      const hit = S.ultHit || (b ? b.hitPoint() : S.pos.clone());
      const dmg = K.verdictDmg * (mods.verdictMul || 1);
      fx('lance', S.pos.clone().setY(1.0), hit, { color: '#fff6dd', width: 1.6, life: 0.5, intensity: 2.6, travel: 0.3, tail: 0.6, flare: true });
      fx('burst', hit, { color: '#fff1c2', count: 60, speed: 11, size: 0.9, life: 0.9 });
      fx('shockwave', S.pos.clone().setY(0.2), { color: '#ffd36b', radius: 10, life: 0.7, intensity: 2.0, thickness: 0.8 });
      fx('flash', '#fff6dd', 0.4, 0.3);
      cam('shake', 1.0, 0.6); cam('hitStop', 0.14);
      if (G.post && G.post.shock) G.post.shock(hit, 1, 0.8);
      fx('number', hit.clone().setY(hit.y + 1.2), 0, { text: 'VERDICT', color: '#fff6dd', size: 1.0, life: 1.1, crit: true });
      G.hz.clearProjectiles();
      if (b && b.alive) G.combat.dealDamage(dmg, { source: 'verdict', crit: true, big: true, pos: hit });
      sfx('crack', { vol: 0.9 });
    }
    if (u >= 1) { S.ultActive = false; S.ultLanded = false; S.invuln = false; S.pos.y = 0; S.iframes = Math.max(S.iframes, 0.4); }
  }
  function onDealtDamage(amt, info) {
    if (info && (info.source === 'verdict')) return;
    S.ult = Math.min(1, S.ult + amt / K.ultNeed * (mods.ultRate || 1));
    if (S.ult >= 1 && !S.ultReadyShown) { S.ultReadyShown = true; sfx('verdictReady'); G.emit('verdictReady', {}); fx('number', S.pos.clone().setY(2.5), 0, { text: 'VERDICT READY', color: '#fff6dd', size: 0.6, life: 1.2 }); }
    if (S.ult < 1) S.ultReadyShown = false;
  }

  // ===================================================== DAMAGE / HEAL
  function damage(amount, label, opts = {}) {
    const res = { applied: false, blocked: false, absorbed: 0, amount: 0 };
    if (!S.alive || !PLAY()) return res;
    if (S.invuln || S.ultActive || (S.iframes > 0 && !opts.dot) || (G.combat && G.combat.transitioning)) { res.blocked = true; return res; }
    if (S.dashing && S.dashI > 0) { res.blocked = true; return res; }
    const sh = S.shield;
    if (sh.up && !opts.unblockable) {
      sh.absorbed += amount; sh.lastHitAt = sh.t; res.absorbed = amount; stats.absorbed += amount;
      fx('burst', S.pos.clone().setY(1.0), { color: '#ffd36b', count: 12, speed: 4, size: 0.35, life: 0.4, flareSize: 1.0 });
      fx('number', S.pos.clone().setY(2.4), 0, { text: 'ABSORB ' + Math.round(amount), color: '#ffe9a8', size: 0.5, life: 0.7 });
      if (!opts.dot) S.iframes = Math.max(S.iframes, 0.25);
      G.emit('playerHit', { amount: 0, absorbed: amount, blocked: false, label });
      return res;
    }
    if (S.practice) {
      fx('number', S.pos.clone().setY(2.4), 0, { text: 'HIT ' + Math.round(amount), color: '#ff9a8a', size: 0.55, life: 0.7 });
      if (!opts.dot) S.iframes = Math.max(S.iframes, K.hitIframes);
      res.applied = true; res.amount = amount; S.hitFlash = 1;
      G.emit('playerHit', { amount, absorbed: 0, blocked: false, label, practice: true });
      return res;
    }
    let amt = amount * (mods.takenMul || 1);
    amt = Math.max(1, Math.round(amt));
    S.hp -= amt; S.lastHitLabel = label || '';
    stats.damageTaken += amt; stats.hitsTaken++;
    if (!opts.dot) S.iframes = Math.max(S.iframes, K.hitIframes);
    S.hitFlash = 1;
    res.applied = true; res.amount = amt;
    if (!G.settings || G.settings.numbers !== false) fx('number', S.pos.clone().setY(2.4), amt, { color: '#ff6a5a', size: amt >= 40 ? 0.85 : 0.6, life: 0.8, text: '-' + amt });
    cam('shake', Math.min(0.6, 0.1 + amt / 120), 0.3);
    if (G.post && G.post.flash) G.post.flash('#c8322e', Math.min(0.35, 0.12 + amt / 200), 0.25);
    G.emit('playerHit', { amount: amt, absorbed: 0, blocked: false, label });
    if (S.hp <= 0) {
      if (mods.lastRites && !S.lastRitesUsed) {
        S.lastRitesUsed = true; S.hp = 1; S.invulnT = 3; S.invuln = true;
        fx('flash', '#fff6dd', 0.4, 0.5); fx('shockwave', S.pos.clone().setY(0.2), { color: '#fff6dd', radius: 6, life: 0.8 });
        fx('number', S.pos.clone().setY(2.6), 0, { text: 'LAST RITES', color: '#fff6dd', size: 0.8, life: 1.4, crit: true });
        sfx('lastRites'); G.emit('lastRites', {});
      } else die(label);
    }
    return res;
  }
  function die(label) {
    if (!S.alive) return;
    S.hp = 0; S.alive = false; S.deadT = 0; stats.deaths++;
    if (S.shield.up) { S.shield.up = false; shieldDome.visible = false; }
    S.ultActive = false; S.dashing = false;
    fx('burst', S.pos.clone().setY(1.0), { color: '#c8322e', count: 50, speed: 7, size: 0.6, life: 1.2 });
    fx('shockwave', S.pos.clone().setY(0.1), { color: '#c8322e', radius: 5, life: 0.8 });
    cam('slowMo', 0.25, 1.6); cam('shake', 0.8, 0.8);
    if (G.post && G.post.setDesat) G.post.setDesat(0.6);
    if (G.post && G.post.fade) G.post.fade(0.35, '#1a0408', 1.5);
    sfx('playerDeath');
    G.emit('playerDeath', { label });
  }
  function burn(dps, dur, label) { S.burning = Math.max(S.burning, dur); S.burnDps = Math.max(S.burnDps, dps); S.burnLabel = label || 'Burning'; }

  // ============================================================ MODS
  function setMods(m) { mods = Object.assign(NEUTRAL(), m || {}); const nm = maxHp(); const f = S.maxHp > 0 ? S.hp / S.maxHp : 1; S.maxHp = nm; S.hp = Math.min(nm, Math.max(1, Math.round(f * nm))); }
  function damageMul(info = {}) {
    let m = mods.dmgMul || 1;
    const b = G.combat && G.combat.boss;
    if (mods.executioner > 0 && b && b.alive && b.hp <= b.maxHp * 0.3 && !(info.target && info.target !== b)) m *= 1 + mods.executioner;
    return m;
  }

  // ============================================================ UPDATE
  const PAUSED = () => G.state === 'paused';
  function update(dt) {
    if (!root) return;
    if (PAUSED()) return;
    const st = G.state;
    const active = st === 'fight' || st === 'practice';
    // timers (run during cinematics too, so cooldowns keep ticking)
    if (st === 'fight' || st === 'practice' || st === 'cinematic') {
      for (let i = 0; i < 3; i++) { S.cds.dash[i] = Math.max(0, S.cds.dash[i] - dt); S.cds.mend[i] = Math.max(0, S.cds.mend[i] - dt); }
      S.cds.rebuke = Math.max(0, S.cds.rebuke - dt); S.cds.bulwark = Math.max(0, S.cds.bulwark - dt);
    }
    S.iframes = Math.max(0, S.iframes - dt); S.dashI = Math.max(0, (S.dashI || 0) - dt);
    if (S.invulnT > 0) { S.invulnT -= dt; if (S.invulnT <= 0) { S.invulnT = 0; if (!S.ultActive) S.invuln = false; } }
    if (S.slowT > 0) { S.slowT -= dt; if (S.slowT <= 0) S.slowMul = 1; }
    if (S.speedMulT > 0) { S.speedMulT -= dt; if (S.speedMulT <= 0) S.speedMul = 1; }
    S.hitFlash = Math.max(0, (S.hitFlash || 0) - dt * 4);
    if (active && S.alive) {
      stepVerdict(dt);
      stepMove(dt);
      stepShield(dt);
      stepRend(dt);
      stepFireTrails(dt);
      // HOT + DOT
      if (S.mendHot > 0) { const h = Math.min(S.mendHot, S.mendHotRate * dt); S.mendHot -= h; heal(h, true); if (S.mendHot <= 0.01) { S.mendHot = 0; S.mendHotRate = 0; } }
      if (S.burning > 0) { S.burning -= dt; S.burnAcc = (S.burnAcc || 0) + S.burnDps * dt; if (S.burnAcc >= 4) { const a = Math.round(S.burnAcc); S.burnAcc = 0; damage(a, S.burnLabel || 'Burning', { dot: true, unblockable: true }); } if (S.burning <= 0) { S.burning = 0; S.burnDps = 0; } }
    } else if (!S.alive) {
      S.deadT += dt;
      model.rotation.z = G.damp(model.rotation.z, -PI / 2 * 0.9, 4, dt); model.position.y = G.damp(model.position.y, 0.3, 4, dt);
    }
    // visuals
    if (S.trailT > 0) { S.trailT -= dt; if (S.trailT <= 0 && trail) trail.setVisible(false); }
    if (S.rebukeFx) { S.rebukeFx.t -= dt; S.rebukeFx.mesh.material.uniforms.uAlpha.value = Math.max(0, S.rebukeFx.t / 0.35); S.rebukeFx.mesh.material.uniforms.uTime.value += dt; if (S.rebukeFx.t <= 0) { G.combat.removeObj(S.rebukeFx.mesh); S.rebukeFx = null; } }
    if (healGlow && healGlow.material.opacity > 0) healGlow.material.opacity = Math.max(0, healGlow.material.opacity - dt * 1.2);
    if (blade) { S.swing = Math.max(0, (S.swing || 0) - dt * 5); blade.rotation.y = -S.swing * 1.4 + (S.target ? 0 : 0.5); blade.rotation.z = S.swing * 0.4; }
    if (cloak) { const sp = Math.hypot(S.vel.x, S.vel.z); cloak.rotation.z = 0.08 + Math.min(0.5, sp * 0.05) + Math.sin(G.now * 3) * 0.03; }
    if (body) { body.position.y = 1.05 + Math.sin(G.now * 2.2) * 0.02; }
    if (markerU) { markerU.uTime.value += dt; markerU.uAlpha.value = S.alive ? (S.iframes > 0 ? 0.35 + 0.4 * Math.abs(Math.sin(G.now * 20)) : 0.8) : 0.2; markerU.uColor.value.set(S.shield.up ? '#ffe9a8' : (S.hitFlash > 0.3 ? '#ff6a5a' : '#ffd36b')); }
    // hit tint on the model (red)
    if (S.hitFlash > 0 || S._tinted) {
      const k = S.hitFlash;
      [body, head].forEach(m => { if (m && m.material && m.material.emissive) { m.material.emissive.setRGB(0.8 * k, 0.1 * k, 0.1 * k); } });
      S._tinted = S.hitFlash > 0;
    }
    if (S.alive) { model.position.y = S.pos.y; }
    root.position.copy(S.pos); root.position.y = 0;
  }

  // ============================================================ RESET
  function reset(opts = {}) {
    S.practice = !!opts.practice;
    S.maxHp = maxHp(); S.hp = S.maxHp;
    S.pos.set(0, 0, 8); S.vel.set(0, 0, 0); S.facing = PI / 2; S.alive = true; S.dashing = false; S.iframes = 0; S.invuln = false; S.invulnT = 0;
    S.shield.up = false; S.shield.absorbed = 0; S.shield.t = 0; S.shield.lastHitAt = -9;
    S.cds.dash.fill(0); S.cds.mend.fill(0); S.cds.rebuke = 0; S.cds.bulwark = 0;
    S.ult = opts.keepUlt ? S.ult : 0; S.ultActive = false; S.ultLanded = false; S.burning = 0; S.burnDps = 0; S.slowMul = 1; S.slowT = 0; S.speedMul = 1; S.speedMulT = 0; S.pull = null;
    S.lastRitesUsed = false; S.mendHot = 0; S.mendHotRate = 0; S.combo = 0; S.target = null; S.deadT = 0; S.hitFlash = 0; S.trailT = 0;
    if (S.fireTrail) { for (const tr of S.fireTrail) if (tr.mesh) G.combat.removeObj(tr.mesh); S.fireTrail = []; }
    if (S.rebukeFx) { G.combat.removeObj(S.rebukeFx.mesh); S.rebukeFx = null; }
    if (!opts.keepStats) { for (const k of Object.keys(stats)) stats[k] = typeof stats[k] === 'number' ? 0 : {}; }
    if (root) { root.visible = true; root.position.copy(S.pos); model.rotation.set(0, PI / 2, 0); model.position.y = 0; shieldDome.visible = false; if (trail) { trail.clear && trail.clear(); trail.setVisible(false); } }
    rendT = 0.3;
  }

  // ============================================================ API
  G.player = {
    K, state: S, stats,
    get mods() { return mods; }, setMods, damageMul,
    damage, heal, burn, die,
    knockback(theta, dist, soft) { S.pos.x += Math.cos(theta) * dist; S.pos.z -= Math.sin(theta) * dist; if (!soft) { S.vel.x += Math.cos(theta) * dist * 6; S.vel.z -= Math.sin(theta) * dist * 6; } },
    setSpeedMul(m, dur) { S.speedMul = m; S.speedMulT = dur; },
    slow(m, dur) { S.slowMul = m; S.slowT = dur; },
    pull(x, z, strength, dur) { S.pull = { x, z, strength, t: dur }; },
    predictPos(sec) { const p = S.pos.clone().addScaledVector(S.vel, sec); const R = arenaR() - 0.4, d = Math.hypot(p.x, p.z); if (d > R) { p.x *= R / d; p.z *= R / d; } p.y = 0; return p; },
    onDealtDamage,
    onPhaseTransition() { if (mods.phaseHeal > 0) heal(mods.phaseHeal); },
    skillInfo() {
      const dm = dashMax(), mm = mendMax(), cd = S.cds;
      const charges = (arr, n, max) => { let c = 0, best = 0; for (let i = 0; i < n; i++) { if (arr[i] <= 0) c++; else best = Math.max(best, 1 - arr[i] / max); } return { charges: c, max: n, frac: c >= n ? 1 : best }; };
      return {
        dash: charges(cd.dash, dm, K.dashCd * (mods.dashCd || 1)),
        bulwark: { cd: cd.bulwark, cdMax: K.bulwarkCd * (mods.bulwarkCd || 1), up: S.shield.up, mult: S.shield.up ? riposteMult(S.shield, false) : 0, absorbed: S.shield.absorbed, hold: S.shield.up ? S.shield.t / shieldHold() : 0 },
        rebuke: { cd: cd.rebuke, cdMax: K.rebukeCd * (mods.rebukeCd || 1) },
        mend: charges(cd.mend, mm, K.mendCd),
        verdict: { ult: S.ult, ready: S.ult >= 1 },
      };
    },
    actions: { dash, bulwarkDown, bulwarkUp, rebuke, mend, verdict },
    reset, update,
    get root() { return root; },
    init() {
      buildModel();
      reset({});
      const I = G.input;
      I.on('dash', () => dash());
      I.on('bulwarkDown', () => bulwarkDown());
      I.on('bulwarkUp', () => bulwarkUp());
      I.on('rebuke', () => rebuke());
      I.on('mend', () => mend());
      I.on('verdict', () => verdict());
      G.on('stateChange', (d) => { if (d.to === 'menu') { if (root) root.visible = false; } if (d.from === 'menu' && root) root.visible = true; });
    },
  };
})();
