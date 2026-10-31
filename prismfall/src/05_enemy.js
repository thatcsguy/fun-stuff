   11  ENEMY BASE — boss shell, scheduler, tasks, hazard beams
   ===================================================================== */
const bossRT = {
  def: null, idx: 0, hp: 1, maxHp: 1, phase: 0, loopT: 0, cursor: 0, loops: 0, fracture: 0, fracIdle: 0, vuln: 0, stagger: 0, staggerMul: 1, shieldMul: 1,
  cast: { active: false, name: '', dur: 1, t: 0, white: false }, enrageLeft: 240, enrageWarned: false, invuln: false, dead: false, transitioning: false,
  flash: 0, lastLight: false, novaInLastLight: false, dnAcc: 0, dnT: 0, dnCrit: false, time: 0, wipeT: -1, lanceFlash: 0,
};
const bossTarget = { x: 0, y: 2, z: 0, r: 1.6, hy: 2, alive: false, priority: false, isBoss: true, hit: (d, c, s) => bossTakeDamage(d, c, s) };
function bossMainTarget() { return bossTarget.alive ? bossTarget : null; }

// ---- task pool (timed callbacks for pattern sequencing) ----
const TASK_N = 128;
const tasks = Array.from({ length: TASK_N }, () => ({ active: false, t: 0, fn: null, every: 0, n: 1, i: 0 }));
function taskAlloc() { for (let i = 0; i < TASK_N; i++) if (!tasks[i].active) return tasks[i]; return tasks[0]; }
function after(delay, fn) { const k = taskAlloc(); k.active = true; k.t = delay; k.fn = fn; k.every = 0; k.n = 1; k.i = 0; return k; }
function every(interval, count, fn, delay = 0) { const k = taskAlloc(); k.active = true; k.t = delay; k.fn = fn; k.every = interval; k.n = count; k.i = 0; return k; }
function updateTasks(dt) {
  for (let i = 0; i < TASK_N; i++) {
    const k = tasks[i]; if (!k.active) continue; k.t -= dt;
    let guard = 0;
    while (k.active && k.t <= 0 && guard++ < 50) { const idx = k.i++; if (k.i >= k.n) k.active = false; else k.t += k.every; k.fn(idx); }
  }
}
function clearTasks() { for (let i = 0; i < TASK_N; i++) tasks[i].active = false; }

// ---- hazard beams (lasers that tick damage while overlapping) ----
const HB_N = 16;
const hzBeams = Array.from({ length: HB_N }, () => ({ active: false, x0: 0, z0: 0, x1: 0, z1: 0, y0: 1, y1: 1, w: 1, dmg: 10, col: R, t: 0, dur: 1, tick: 0, grazed: false, sx: 0, sz: 0, vis: null, upd: null, slowed: false, r: 1, g: 0.2, b: 0.3 }));
function hzBeam(x0, y0, z0, x1, y1, z1, w, dur, dmg, col, upd) {
  let o = null; for (let i = 0; i < HB_N; i++) if (!hzBeams[i].active) { o = hzBeams[i]; break; } if (!o) o = hzBeams[0];
  o.active = true; o.x0 = x0; o.y0 = y0; o.z0 = z0; o.x1 = x1; o.y1 = y1; o.z1 = z1; o.w = w; o.dur = dur; o.dmg = dmg; o.col = col; o.t = 0; o.tick = 0; o.grazed = false; o.slowed = false;
  o.sx = x0; o.sz = z0; o.upd = upd || null;
  const c = PCOL[col]; o.vis = beam(x0, y0, z0, x1, y1, z1, w * 0.32, dur, c[0], c[1], c[2], 1, 0.62);
  return o;
}
function hzBeamsClear() { for (let i = 0; i < HB_N; i++) { const o = hzBeams[i]; if (o.active) { o.active = false; killBeam(o.vis); } } }
function updateHzBeams(dt) {
  for (let i = 0; i < HB_N; i++) {
    const o = hzBeams[i]; if (!o.active) continue;
    o.t += dt; if (o.t >= o.dur) { o.active = false; continue; }
    if (o.upd) { o.upd(o, dt); if (o.vis && o.vis.m.visible) beamSet(o.vis, o.x0, o.y0, o.z0, o.x1, o.y1, o.z1, o.vis.baseW); }
    if (!player.alive || game.state !== 'fight') continue;
    const d = segDist(player.x, player.z, o.x0, o.z0, o.x1, o.z1) - o.w / 2 - PLAYER.hurtR;
    o.tick -= dt;
    if (d < 0) {
      if (o.tick <= 0) {
        o.tick = 0.25;
        if (mirror.active && !mirror.blockUsed && Math.abs(wrapA(Math.atan2(o.sz - player.z, o.sx - player.x) - mirror.ang)) < Math.PI / 3) {
          mirror.blockUsed = true; bossAddFracture(20); mirU.uFlash.value = 1.2; sfx.tink(6); ring(mirror.x, 1.15, mirror.z, 0.2, 2.4, 0.35, 0.2, 0.6, 1.2, 2.6, 1.5);
          dmgNumber(player.x, 2.6, player.z, 'BLOCKED', 4, '#9cc8ff');
        } else {
          hitSrc = 'beam'; const res = resolveHazard(d, 0.8, o.col, o.dmg, !o.grazed, 8, player.x, player.z);
          if (res === HZ_HIT && !o.slowed) { o.slowed = true; player.slowT = 0.5; }
          if (res === HZ_PERFECT) o.grazed = true;
        }
      }
    } else if (d < 0.8 && !o.grazed) { o.grazed = true; resolveHazard(d, 0.8, o.col, 0, true, 8, player.x, player.z); }
  }
}

// ---- boss damage, phases, fracture ----
function bossAddFracture(n) { if (!bossRT.def || bossRT.dead || bossRT.vuln > 0) return; bossRT.fracture = Math.min(100, bossRT.fracture + n); bossRT.fracIdle = 0; }
function bossVulnerable() {
  bossRT.vuln = 6; bossRT.fracture = 0; bossInterrupt();
  ui.toast('VULNERABLE', 1.6, true); sfx.shatter(0.7); bloomSpike(1.2);
}
function bossInterrupt() {
  clearTasks(); bossRT.cast.active = false; hzBeamsClear();
  for (let i = 0; i < TELE_N; i++) if (tele[i].active && !tele[i].resolved && tele[i].shape !== 5) teleCancel(tele[i]);
  if (bossRT.def && bossRT.def.onInterrupt) bossRT.def.onInterrupt();
}
function castBar(name, dur, white = false) { const c = bossRT.cast; c.active = true; c.name = name; c.dur = dur; c.t = 0; c.white = white; }
function bossTakeDamage(n, crit, src) {
  const b = bossRT;
  if (!b.def || b.dead || game.state !== 'fight') return;
  if (b.invuln || b.transitioning) { if (src !== 'bolt' || frand() < 0.1) dmgNumber(bossTarget.x, bossTarget.y + 1.5, bossTarget.z, 'IMMUNE', 4, '#aaaacc'); return; }
  let m = 1; if (b.vuln > 0) m *= 2; if (b.stagger > 0) m *= b.staggerMul; m *= b.shieldMul;
  n *= m; b.hp -= n; b.flash = 0.08;
  // every non-crit source ticks one rolling number up; crits pop on their own
  if (crit) dmgNumber(bossTarget.x - dnRoll.ox * 0.9 + (frand() - 0.5) * 0.8, bossTarget.y + 1.0, bossTarget.z + 0.8, String(Math.round(n)), 1);
  else dmgRollAdd(n, src === 'refl');
  if (b.def.onDamage) b.def.onDamage(n, src);
  const ph = b.def.phases[b.phase];
  if (b.phase < b.def.phases.length - 1 && b.hp <= ph.until * b.maxHp) { b.hp = ph.until * b.maxHp; bossStartTransition(b.phase + 1); return; }
  if (b.def.hpCheck && b.def.hpCheck()) return;
  if (b.hp <= 0) { b.hp = 0; bossDie(); }
}
function bossStartTransition(n, instant = false) {
  const b = bossRT; if (!b.def) return; n = clamp(n | 0, 1, b.def.phases.length - 1);
  b.transitioning = true; bossInterrupt(); teleClearAll(); pjClearAll(true); b.vuln = 0; b.stagger = 0;
  hitstop(0.15);
  const done = () => { b.phase = n; b.loopT = 0; b.cursor = 0; b.loops = 0; b.transitioning = false; if (b.def.onPhase) b.def.onPhase(n); music.setSection(b.def.music[n] || b.def.music[0]);
    if (!instant && game.state === 'fight') { ui.hud(true); ui.letterbox(false); } };
  if (!instant) { ui.hud(false); ui.letterbox(true); dmgNumsClear(); }
  if (instant) { if (b.def.transitionInstant) b.def.transitionInstant(n); done(); return; }
  const c = b.def.transitionCine(n); const oe = c.end; c.end = () => { oe && oe(); done(); };
  playCine(c);
}
function bossDie() {
  const b = bossRT; if (b.dead) return;
  if (!player.alive && game.state === 'fight') { b.hp = Math.max(b.hp, 1); return; } // a shattered Lightbreaker can't win with shots still in flight
  b.dead = true; bossTarget.alive = false; bossInterrupt(); teleClearAll(); pjClearAll(true); dmgNumsClear();
  for (let i = 0; i < targets.length; i++) if (!targets[i].isBoss) targets[i].alive = false;
  game.bossTimes[b.idx] = game.fightTime;
  hitstop(0.25);
  const c = b.def.deathCine(); const oe = c.end; c.end = () => { oe && oe(); onBossDefeated(); };
  playCine(c);
}
function bossReset(idx, phase = 0) {
  const def = BOSSES[idx]; const b = bossRT;
  b.def = def; b.idx = idx; b.maxHp = def.maxHp; b.hp = def.maxHp; b.phase = 0; b.loopT = 0; b.cursor = 0; b.loops = 0;
  b.fracture = 0; b.fracIdle = 0; b.vuln = 0; b.stagger = 0; b.staggerMul = 1; b.shieldMul = 1; b.cast.active = false;
  b.enrageLeft = def.enrage; b.enrageWarned = false; b.invuln = false; b.dead = false; b.transitioning = false; b.flash = 0; b.lastLight = false; b.novaInLastLight = false;
  b.dnAcc = 0; b.dnT = 0; b.dnCrit = false; b.wipeT = -1; b.time = 0;
  targets.length = 0; targets.push(bossTarget);
  bossTarget.x = def.hit.x; bossTarget.y = def.hit.y; bossTarget.z = def.hit.z; bossTarget.r = def.hit.r; bossTarget.hy = def.hit.hy; bossTarget.alive = true;
  rng = mulberry32(1337 + idx * 101);
  clearTasks(); teleClearAll(); pjClearAll(false); hzBeamsClear();
  game.arenaR = def.arenaR; floorU.uArenaR.value = def.arenaR; game.gravity = 0; game.arenaCut.on = false;
  teleHC.value = 0; dmgNumsClear();
  def.reset();
  if (phase > 0) { b.hp = def.phases[phase - 1].until * b.maxHp; b.phase = phase; if (def.transitionInstant) for (let p = 1; p <= phase; p++) def.transitionInstant(p); if (def.onPhase) def.onPhase(phase); }
}
function updateBoss(dt) {
  const b = bossRT; if (!b.def) { if (game.state === 'title' || game.state === 'intro') BOSS1.update(dt); return; }
  const fighting = game.state === 'fight' && !b.dead;
  if (b.flash > 0) b.flash -= dt;
  if (b.cast.active) { b.cast.t += dt; if (b.cast.t >= b.cast.dur) b.cast.active = false; }
  if (fighting && !b.transitioning) {
    if (b.vuln > 0) { b.vuln -= dt; }
    if (b.stagger > 0) { b.stagger -= dt; if (b.stagger <= 0) b.staggerMul = 1; }
    b.fracIdle += dt; if (b.fracIdle > 4 && b.fracture > 0 && b.fracture < 100) b.fracture = Math.max(0, b.fracture - 2 * dt);
    b.time += dt;
    // enrage
    if (!b.lastLight) b.enrageLeft -= dt;
    if (b.enrageLeft <= 3 && !b.enrageWarned) { b.enrageWarned = true; ui.toast(b.def.enrageName ? b.def.enrageName() : 'ENRAGE', 3, true); sfx.riser(); }
    if (b.enrageLeft <= 0 && b.wipeT < 0) { b.wipeT = 0; bossInterrupt(); if (b.def.onEnrage) b.def.onEnrage(); LU.uWhite.value = 0.6; bloomSpike(1.6); addTrauma(1); sfx.boom(); if (!debug.god) { player.hurtI = 0; player.invuln = 0; damagePlayer(999, W); } b.enrageLeft = 9999; }
    if (b.wipeT >= 0) { b.wipeT += dt; LU.uWhite.value = b.wipeT < 0.08 ? 0.6 : Math.max(0, 0.35 * (1 - (b.wipeT - 0.08) / 0.5)); if (b.wipeT > 1.2) b.wipeT = -1; }
    // scheduler
    if (b.vuln <= 0 && b.stagger <= 0 && !b.lastLight) {
      const ph = b.def.phases[b.phase];
      b.loopT += dt;
      while (b.cursor < ph.steps.length && ph.steps[b.cursor][0] <= b.loopT) { const st = ph.steps[b.cursor++]; const fn = b.def.casts[st[1]]; if (fn) fn(st[2]); }
      if (b.loopT >= ph.loop) { b.loopT -= ph.loop; b.cursor = 0; b.loops++; }
      updateTasks(dt);
    }
  }
  b.def.update(dt);
  b.lanceFlash = 0;
}
let rippleCD = 0;
function tryRipple(x, z, s) { if (floorU.uArena.value !== 0 || rippleCD > 0) return; rippleCD = 0.12; addRipple(x, z, s); }

/* =====================================================================
   12  PATTERNS — reusable attack library
   ===================================================================== */
function patRing(x, z, n, speed, c, r, dmg, a0 = 0, gapAng = null, gapN = 0, flags = 0, life = 9) {
  const step = TAU / n;
  for (let i = 0; i < n; i++) {
    const a = a0 + i * step;
    if (gapAng !== null && gapN > 0) { const da = Math.abs(wrapA(a - gapAng)); if (da < step * (gapN / 2)) continue; }
    shoot(x + Math.cos(a) * 0.6, z + Math.sin(a) * 0.6, a, speed, c, r, dmg, life, flags);
  }
}
function patFan(x, z, ang, n, spread, speed, c, r, dmg) {
  for (let i = 0; i < n; i++) { const a = ang + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread); shoot(x, z, a, speed, c, r, dmg); }
}
function patSpiral(x, z, arms, rate, dur, stepDeg, speed, c, r, dmg, a0 = 0) {
  const n = Math.round(rate * dur), st = stepDeg * Math.PI / 180;
  every(1 / rate, n, (i) => { for (let k = 0; k < arms; k++) { const a = a0 + i * st + k * TAU / arms; shoot(x + Math.cos(a) * 0.8, z + Math.sin(a) * 0.8, a, speed, c, r, dmg); } if (i % 3 === 0) sfx.shot(c); });
}
function aimAt(x, z) { return Math.atan2(player.z - z, player.x - x); }
function randInArena(maxR) { const a = rng() * TAU, r = Math.sqrt(rng()) * maxR; _v2a.set(Math.cos(a) * r, Math.sin(a) * r); return _v2a; }

/* =====================================================================
   13  BOSSES
   ===================================================================== */
