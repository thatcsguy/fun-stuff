// Autopilot + test hooks (window.__game). Used for balance sims in Playwright; never active for players unless ?bot=N.
const Bot = {
  level: 0, timer: 0, goal: null, pressT: 0,
  update(dt) {
    const p = G.player, b = G.boss;
    if (!this.level || !p || !b || G.state !== 'fight' || !p.alive) { Input.bot = this.level && p ? { moveX: 0, moveZ: 0 } : null; return; }
    const A = G.arena, def = b.def, melee = p.cls.id === 'duskblade', t = p.target || b;
    const hint = def.bot ? def.bot(b, p) || {} : {};
    const danger = (x, z) => { let th = Hz.threat(x, z); if (def.danger) th = Math.min(th, def.danger(b, x, z)); return th; };
    this.timer -= dt;
    const period = [0, 0.4, 0.18, 0.05][this.level];
    if (this.timer <= 0 || !this.goal) {
      this.timer = period;
      // anchor: where we would like to stand if nothing were dangerous
      let ax = p.pos.x, az = p.pos.z; const dT = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) || 1;
      if (hint.x !== undefined) { ax = hint.x; az = hint.z; }
      else if (melee) { const r = t.radius + 2.0; ax = t.pos.x + (p.pos.x - t.pos.x) / dT * r; az = t.pos.z + (p.pos.z - t.pos.z) / dT * r; }
      else if (dT - t.radius > 28) { const r = t.radius + 22; ax = t.pos.x + (p.pos.x - t.pos.x) / dT * r; az = t.pos.z + (p.pos.z - t.pos.z) / dT * r; }
      const C = [[p.pos.x, p.pos.z, melee ? -0.3 : -1.2], [ax, az, 0]];
      for (const r of [1.5, 3, 5, 8, 12]) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + r; C.push([p.pos.x + Math.sin(a) * r, p.pos.z + Math.cos(a) * r, 0]); }
      for (const r of [2, 4.5]) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; C.push([ax + Math.sin(a) * r, az + Math.cos(a) * r, 0]); }
      let best = null, bs = 1e9;
      for (const c of C) {
        const x = c[0], z = c[1]; if (!A.contains(x, z)) continue;
        if (Math.hypot(x - b.pos.x, z - b.pos.z) < b.radius + 0.3) continue;
        if (A.edge === 'fall') { const d = Math.hypot(x - p.pos.x, z - p.pos.z) || 1; if (!A.contains(x + (x - p.pos.x) / d * 1.2, z + (z - p.pos.z) / d * 1.2)) continue; let ok = true; for (let k = 1; k < 5 && ok; k++) ok = A.contains(lerp(p.pos.x, x, k / 5), lerp(p.pos.z, z, k / 5)); if (!ok) continue; }
        const tt = Math.hypot(x - p.pos.x, z - p.pos.z) / (p.speed * p.speedMul), th = danger(x, z);
        let s = c[2] + Math.hypot(x - ax, z - az) * (hint.w || 1) + tt * 3;
        if (th !== Infinity) { if (th > tt - 0.12) s += th < tt + 1.2 ? 400 - th * 20 : th < 1.5 ? 20 / th : 0; }
        const mx = (x + p.pos.x) / 2, mz = (z + p.pos.z) / 2, tm = danger(mx, mz); if (tm !== Infinity && Math.abs(tm - tt / 2) < 0.3) s += 200;
        if (Bul.threat(x, z, 0.7)) s += 80;
        if (Hz.persist(x, z)) s += 450;
        if (hint.avoid && hint.avoid(x, z)) s += 500;
        const dt2 = Math.hypot(x - t.pos.x, z - t.pos.z) - t.radius; if (!melee && dt2 > 32) s += 50; if (melee && dt2 > MELEE - 0.3 && hint.x === undefined) s += 25 + dt2;
        if (s < bs) { bs = s; best = c; }
      }
      this.goal = best || [p.pos.x, p.pos.z];
    }
    const gx = this.goal[0] - p.pos.x, gz = this.goal[1] - p.pos.z, gd = Math.hypot(gx, gz);
    Input.bot = gd > 0.25 ? { moveX: gx / gd, moveZ: gz / gd } : { moveX: 0, moveZ: 0 };
    // finish a cast in progress when nothing will land before it completes
    if (p.casting && this.level >= 2) { const left = p.casting.time - p.casting.t; if (danger(p.pos.x, p.pos.z) > left + 0.3 && !Hz.persist(p.pos.x, p.pos.z) && !Bul.threat(p.pos.x, p.pos.z, left + 0.3)) Input.bot = { moveX: 0, moveZ: 0 }; }
    // rotation
    this.pressT -= dt; if (this.pressT > 0) return; this.pressT = [0, 0.25, 0.12, 0.05][this.level];
    const here = danger(p.pos.x, p.pos.z), cs = t.castState;
    const ctx = { hp: p.hp / p.maxHp, danger: here < 0.3 && this.level >= 2, calm: here, wantInterrupt: !!(cs && cs.int && cs.t > (this.level >= 3 ? 0.3 : 0.8)), chase: gd < 1.5, holdFire: !!hint.holdFire, saveInterrupt: !!def.botSaveInterrupt || !!hint.saveInterrupt || this.level < 3 };
    if (hint.target && p.target !== hint.target) p.target = hint.target;
    p.cls.bot(p, ctx);
  },
};

window.__game = {
  G, Game, Bot, Hz, Bul, FX, Cam,
  start(id, opts = {}) { Game.start(id, Object.assign({ instant: true }, opts)); },
  bot(n) { Bot.level = n; },
  god(on = true) { G.god = on; },
  state() { const p = G.player, b = G.boss; return { state: G.state, t: +G.ft.toFixed(1), phase: b ? b.phase : -1, boss: b ? +(b.hp / b.maxHp * 100).toFixed(1) : 0, hp: p ? Math.round(p.hp) : 0, dps: p ? Math.round(p.stats.dmg / Math.max(1, G.ft)) : 0, taken: p ? Math.round(p.stats.taken) : 0, src: p && p.deathSrc && (typeof p.deathSrc === 'string' ? p.deathSrc : (p.deathSrc.name || (p.deathSrc.shape && p.deathSrc.shape.type) || 'bullet')), errors: G.errors.slice(0, 5) }; },
  // Run the sim headless for `sec` seconds (stops early on death/victory). Returns state().
  fastForward(sec, stopOnEnd = true) {
    G.headless = true; const dt = 1 / 60; let n = Math.round(sec * 60), tail = 30;
    try { while (n-- > 0) { Bot.update(dt); G.step(dt * G.timeScale); if (stopOnEnd && (G.state === 'dead' || G.state === 'win') && tail-- <= 0) break; } } finally { G.headless = false; }
    return this.state();
  },
  // Run `sec` seconds of frames with effects on but without rendering, so a screenshot taken next shows live particles and telegraphs.
  warm(sec = 1.5) { const dt = 1 / 60; for (let i = Math.round(sec * 60); i > 0; i--) { G.rt += dt; G.rdt = dt; for (const f of Hooks.frame) f(dt, 0); G.step(dt * G.timeScale); for (const f of Hooks.frame) f(dt, 1); Post.update(dt); } return this.state(); },
  setPhase(i) { const b = G.boss; b.hp = b.maxHp * b.def.phases[i].at - 1; },
  hurtBoss(frac) { const b = G.boss; b.hp = Math.max(1, b.hp - b.maxHp * frac); },
  kill() { G.boss.damage(1e9); },
};
Hooks.frame.push((rdt, stage) => { if (stage === 0 && !G.paused) Bot.update(rdt * G.timeScale); });
