// =====================================================================
// 15_bot.js: window.__game test hooks + the autopilot (levels 1-3).
// Destructive hooks need ?debug=1 or ?bot=N. See SPEC.md section 10.
// =====================================================================
(() => {
  const PI = Math.PI, TAU = PI * 2;
  const destructiveOk = () => !!(G.params && (G.params.debug || G.params.bot));
  const clamp = G.clamp;

  // ------------------------------------------------------------ bot
  const B = { level: 0, t: 0, think: 0, stuckT: 0, target: null, stats: { dashes: 0, bulwarks: 0, rebukes: 0, mends: 0, verdicts: 0 }, holdUntil: -1, lastEval: null };
  const LV = { 1: { tick: 0.25, look: 0.45, pad: 0.15, dashLook: 0.25, mendAt: 0.35, rebukeP: 0.5 }, 2: { tick: 0.1, look: 0.7, pad: 0.3, dashLook: 0.35, mendAt: 0.5, rebukeP: 0.9 }, 3: { tick: 0.05, look: 1.0, pad: 0.4, dashLook: 0.45, mendAt: 0.6, rebukeP: 1 } };
  const DIRS = []; for (let i = 0; i < 16; i++) DIRS.push([Math.cos(i / 16 * TAU), -Math.sin(i / 16 * TAU)]);

  function dangerScore(x, z, L) {
    const hz = G.hz; let s = 0;
    s += hz.dangerAt(x, z, 0.0, L.pad) * 10 + hz.dangerAt(x, z, 0.25, L.pad) * 6 + hz.dangerAt(x, z, 0.55, L.pad) * 3 + hz.dangerAt(x, z, L.look, L.pad * 0.7) * 1.2;
    // safe discs that end soon: outside is danger
    for (const h of hz.active) { if (h.done || !h.safeDisc) continue; const left = h.warn - h.t; if (left < 2.6) { const d = Math.hypot(x - h.x, z - h.z); if (d > h.r - 0.5) s += 4 + (2.6 - left) * 3; } }
    return s;
  }
  function evaluate(dt) {
    const L = LV[B.level] || LV[2]; const pl = G.player, P = pl.state, c = G.combat, b = c.boss;
    if (!P.alive || !(G.state === 'fight' || G.state === 'practice')) { G.input.override = { x: 0, z: 0 }; return; }
    const R = (G.world && G.world.arenaR != null ? G.world.arenaR : G.ARENA_R) - 0.7;
    const px = P.pos.x, pz = P.pos.z;
    const bx = b ? b.pos.x : 0, bz = b ? b.pos.z : 0, br = b ? b.hitRadius : 1.5;
    // soaks
    let soak = null; for (const h of G.hz.active) if (!h.done && h.isSoak && !h.soaked) { if (!soak || h.warn - h.t < soak.warn - soak.t) soak = h; }
    const here = dangerScore(px, pz, L);
    let best = null, bestS = 1e9, bestD = 0;
    const consider = (x, z, moveCost) => {
      const d = Math.hypot(x, z); if (d > R) return;
      let s = dangerScore(x, z, L) * 10 + moveCost;
      const db = Math.hypot(x - bx, z - bz) - br;
      if (b && b.alive) { if (db > 5.5) s += (db - 5.5) * 1.5; if (db < 1.2) s += (1.2 - db) * 3; }
      if (soak) { const ds = Math.hypot(x - soak.x, z - soak.z); s += ds * 1.2; }
      for (const a of G.adds.list) { if (!a.alive) continue; const da = Math.hypot(x - a.pos.x, z - a.pos.z); if (da < a.radius + 1.0) s += (a.radius + 1.0 - da) * 6; }
      if (d > R - 1.5) s += (d - (R - 1.5)) * 0.8;
      if (s < bestS) { bestS = s; best = [x, z]; bestD = moveCost; }
    };
    consider(px, pz, 0);
    for (const dist of [1.2, 2.6, 4.2]) for (const d of DIRS) consider(px + d[0] * dist, pz + d[1] * dist, dist * 0.25);
    if (!best) best = [px, pz];
    let mx = best[0] - px, mz = best[1] - pz; const ml = Math.hypot(mx, mz);
    if (ml < 0.25) { mx = 0; mz = 0; } else { mx /= ml; mz /= ml; }
    G.input.override = { x: mx, z: mz };
    // dash: danger right now or very soon here, and the best spot is still far / also dangerous
    const soon = G.hz.dangerAt(px, pz, L.dashLook, L.pad) || G.hz.dangerAt(px, pz, 0.1, L.pad);
    const bestDanger = G.hz.dangerAt(best[0], best[1], L.dashLook, L.pad * 0.6);
    const si = pl.skillInfo();
    if (soon && (ml > 1.8 || bestDanger) && si.dash.charges > 0 && !P.dashing && !P.shield.up) {
      // dash toward the best spot (override direction is used by dash())
      if (pl.actions.dash()) B.stats.dashes++;
    } else if (soon && here > 0 && si.dash.charges === 0 && si.bulwark.cd <= 0 && !P.shield.up) {
      // no dash: shield through blockable danger
      let blockable = false; for (const h of G.hz.active) { if (h.done || !h.danger || h.unblockable) continue; if (h.test(px, pz, h.t + 0.3, L.pad) || h.test(px, pz, h.t, L.pad)) blockable = true; }
      if (blockable && pl.actions.bulwarkDown()) { B.stats.bulwarks++; B.holdUntil = G.t + 0.9; }
    }
    // level 3: deliberately absorb a heavy blockable hit that cannot be dodged in time, then riposte at once
    if (B.level >= 3 && !P.shield.up && si.bulwark.cd <= 0 && here === 0) {
      for (const h of G.hz.active) {
        if (h.done || !h.danger || h.unblockable || h.isOrb || h.safeDisc || h.dmg < 28) continue;
        const left = h.warn - h.t;
        if (left > 0 && left < 0.5 && h.test(px, pz, h.warn, 0.1) && bestS >= 9) { if (pl.actions.bulwarkDown()) { B.stats.bulwarks++; B.holdUntil = G.t + left + 0.25; } break; }
      }
    }
    if (P.shield.up) {
      const stillDanger = G.hz.dangerAt(px, pz, 0.05, L.pad) || G.hz.dangerAt(px, pz, 0.3, L.pad);
      const hitRecently = P.shield.absorbed > 0 && (P.shield.t - P.shield.lastHitAt) < 0.2;
      if ((G.t >= B.holdUntil && !stillDanger) || (P.shield.absorbed > 0 && !stillDanger && hitRecently)) pl.actions.bulwarkUp();
    }
    // rebuke: interruptible cast in range, or a cluster of orbs
    if (si.rebuke.cd <= 0 && b && b.alive) {
      const dist = Math.hypot(px - bx, pz - bz) - br;
      if (b.casting && b.casting.interruptible && dist <= 7.5 && Math.random() < L.rebukeP && b.casting.progress > 0.15) { if (pl.actions.rebuke()) B.stats.rebukes++; }
      else if (B.level >= 2) {
        let orbs = 0; for (const h of G.hz.active) if (!h.done && h.isOrb && Math.hypot(h.x - px, h.z - pz) < 7 && h.test(px, pz, h.t + 0.8, 0.6)) orbs++;
        if (orbs >= 2) { if (pl.actions.rebuke()) B.stats.rebukes++; }
      }
    }
    // mend
    if (P.hp / P.maxHp < L.mendAt && si.mend.charges > 0 && P.mendHot <= 0) { if (pl.actions.mend()) B.stats.mends++; }
    // verdict
    if (si.verdict.ready && b && b.alive && !b.invulnerable && here === 0 && !soon) { if (pl.actions.verdict()) B.stats.verdicts++; }
  }
  const bot = {
    set(level) { B.level = clamp(level | 0, 0, 3); if (!B.level) G.input.override = null; else { G.input.enabled = true; } },
    update(dt) {
      if (!B.level) return;
      B.think -= dt;
      if (B.think > 0) return;
      B.think = (LV[B.level] || LV[2]).tick;
      try { evaluate(dt); } catch (e) { G.log.error('bot', e); }
    },
    stats() { return { level: B.level, ...B.stats }; },
  };

  // ------------------------------------------------------------ hooks
  const game = window.__game = {
    startRun(seed) { if (!destructiveOk()) return false; G.ui && G.ui.only(null); G.run.newRun(seed); return true; },
    startFight(i, opts = {}) {
      if (!destructiveOk()) return false;
      G.ui && G.ui.only(null);
      if (i === 'practice') { G.run.practice(); return true; }
      const floor = (i | 0) - 1;
      if (opts.edicts) { G.run.state.edicts = opts.edicts.slice(); }
      G.run.single(floor, { edicts: opts.edicts || G.run.state.edicts || [], fromPhase: opts.fromPhase || 0, skipIntro: opts.skipIntro !== false });
      return true;
    },
    setPhase(n) { if (!destructiveOk()) return false; return G.combat.forcePhase((n | 0) - 1); },
    godMode(on = true) { if (!destructiveOk()) return false; G.player.state.invuln = !!on; G.player.state.invulnT = on ? 1e9 : 0; return !!on; },
    killBoss() { if (!destructiveOk()) return false; return G.combat.killBoss(); },
    setHp(n) { if (!destructiveOk()) return false; G.player.state.hp = clamp(n, 0, G.player.state.maxHp); return G.player.state.hp; },
    fillUlt() { if (!destructiveOk()) return false; G.player.state.ult = 1; return true; },
    setEdicts(ids) { if (!destructiveOk()) return false; G.run.state.edicts = (ids || []).slice(); G.run.applyMods(); return G.player.mods; },
    draftPick(i) { if (!destructiveOk()) return false; G.ui && G.ui.only(null); return G.run.draftPick(i); },
    async fastForward(seconds = 10, dt = 1 / 30) {
      if (!destructiveOk()) return false;
      const n = Math.ceil(seconds / dt);
      for (let i = 0; i < n; i++) { G.core.step(dt); for (let k = 0; k < 14; k++) await null; }
      return game.state();
    },
    state() {
      const c = G.combat, b = c && c.boss, P = G.player && G.player.state, R = G.run && G.run.state;
      return {
        state: G.state, t: +(G.t || 0).toFixed(2), fightTime: +((c && c.fightTime) || 0).toFixed(2),
        boss: b ? { name: b.name, hp: Math.round(b.hp), maxHp: b.maxHp, pct: +(b.hp / b.maxHp * 100).toFixed(1), phase: b.phase, casting: b.casting ? b.casting.name : null, exposed: b.exposedT > 0, staggered: b.staggerT > 0, alive: b.alive, pos: [+b.pos.x.toFixed(2), +b.pos.z.toFixed(2)] } : null,
        player: P ? { hp: Math.round(P.hp), maxHp: P.maxHp, pos: [+P.pos.x.toFixed(2), +P.pos.z.toFixed(2)], alive: P.alive, ult: +P.ult.toFixed(2), shield: P.shield.up, dashing: P.dashing } : null,
        run: R ? { active: R.active, single: R.single, floor: R.floor, edicts: R.edicts.slice(), deaths: R.deaths, draft: R.draft } : null,
        hazards: G.hz ? G.hz.active.filter(h => !h.done).length : 0, adds: G.adds ? G.adds.list.length : 0,
        errors: G.log ? G.log.count : 0, practice: !!(c && c.practice), bot: B.level,
      };
    },
    stats() { return { player: G.player && JSON.parse(JSON.stringify(G.player.stats)), results: G.combat && G.combat.results, bot: bot.stats() }; },
    hazards() { return (G.hz ? G.hz.active : []).filter(h => !h.done).map(h => ({ id: h.id, kind: h.kind, label: h.label, t: +h.t.toFixed(2), warn: h.warn, active: h.active, dmg: h.dmg, lethal: h.lethal, unblockable: h.unblockable, live: h.live })); },
    errors() { return G.log ? G.log.errors.slice() : []; },
    dangerAt(x, z, t = 0) { return G.hz.dangerAt(x, z, t); },
    bot(level) { bot.set(level); return B.level; },
    skipIntro() { G.combat.skipIntro(); },
  };

  G.bot = {
    init() {
      if (G.params && G.params.bot) bot.set(G.params.bot);
      if (G.params && G.params.testboss && destructiveOk()) installTestBoss(G.params.testboss === 'all');
    },
    update(dt) { bot.update(dt); },
    get level() { return B.level; },
  };

  // ------------------------------------------------------------ throwaway test boss (?testboss=1&debug=1): every primitive once
  function installTestBoss(all) {
    const T3 = G.THREE;
    const def = {
      name: 'PROBE', title: 'the Test Boss', court: 'the Lab', accent: '#5fe3ff', sky: 'night', arena: 'ash', music: 0, maxHp: 3000, hitRadius: 1.4,
      intro: ['A target for the primitives.', 'Nothing more.'],
      phases: [
        { name: 'Shapes', hpStart: 1.0, async script(b) {
          b.loop(async () => {
            const p = b.playerPos();
            await b.hz.circle({ x: p.x, z: p.z, r: 2.2, warn: 1.8, dmg: 18, label: 'Probe Disc' });
            await b.hz.cone({ x: 0, z: 0, theta: b.playerTheta(), width: 0.9, r: 12, warn: 1.8, dmg: 20, label: 'Probe Cone' });
            await b.hz.line({ ax: -13, az: p.z, bx: 13, bz: p.z, width: 1.6, warn: 2.0, dmg: 22, label: 'Probe Line', arrow: true });
            await b.hz.ring({ r0: 4, r1: 9, warn: 2.2, dmg: 30, gaps: [{ theta: b.playerTheta() + 1.2, width: 0.8 }], label: 'Probe Ring' });
            await b.hz.wave({ r0: 1.5, r1: 14, speed: 6, thickness: 1.0, warn: 2.4, dmg: 35, gaps: [{ theta: b.playerTheta(), width: 0.6 }], label: 'Probe Wave' });
            await b.hz.safe({ x: -p.x * 0.6, z: -p.z * 0.6, r: 3, warn: 3.0, dmg: 15, label: 'Probe Hymn' });
            for (let i = 0; i < 5; i++) { b.hz.orb({ x: 0, z: 0, dir: b.playerTheta() + (i - 2) * 0.2, speed: 5.5, r: 0.5, life: 5, dmg: 12, label: 'Probe Orb' }); await b.wait(0.2); }
            await b.wait(2.5);
            await b.cast({ name: 'Probe Chant', dur: 3.2, interruptible: true, onDone: () => b.hz.wipe(12, 'Probe Chant') });
            b.hz.soak({ x: p.x * 0.5, z: p.z * 0.5, r: 1, warn: 5, failDmg: 20, label: 'Probe Soak' });
            await b.hz.cone({ x: 0, z: 0, theta: 0, width: 0.7, r: 13, warn: 1.5, omega: 0.8, dur: 5, tick: 0.5, dmg: 10, label: 'Probe Rotor' });
            await b.wait(1);
          });
        } },
        { name: 'Movers', hpStart: 0.55, async script(b) {
          b.loop(async () => {
            const p = b.playerPos();
            await b.moveTo(p.x * 0.5, p.z * 0.5, 4);
            b.adds.spawn({ x: -p.x * 0.5, z: -p.z * 0.5, hp: 120, radius: 0.6, contactDmg: 12, label: 'Probe Add', color: '#ff5f9e', update: (a, dt) => { const q = G.player.state.pos; const dx = q.x - a.pos.x, dz = q.z - a.pos.z, d = Math.hypot(dx, dz) || 1; a.pos.x += dx / d * 2.5 * dt; a.pos.z += dz / d * 2.5 * dt; } });
            await b.hz.circle({ r: 3, warn: 2.0, dmg: 60, lethal: true, unblockable: true, follow: 'player', label: 'Probe Gold' });
            await b.hz.line({ ax: -13, az: -6, bx: 13, bz: -6, width: 1.4, warn: 2.0, sweep: { to: [-13, 8], dur: 3 }, dmg: 18, label: 'Probe Sweep', arrow: true });
            await b.wait(2);
          });
        } },
      ],
      build(b) {
        const g = new T3.Group();
        const m = new T3.Mesh(new T3.OctahedronGeometry(1.4, 0), G.mat.emissive('#5fe3ff', 1.6)); m.position.y = 1.8; g.add(m);
        b.model = g; b.data.m = m;
      },
      animate(b, dt) { if (b.data.m) b.data.m.rotation.y += dt; },
    };
    if (all) { for (let i = 0; i < 5; i++) if (!G.bosses[i]) G.bosses[i] = Object.assign({}, def, { name: 'PROBE ' + (i + 1) }); }
    else G.bosses[0] = def;
  }
})();
