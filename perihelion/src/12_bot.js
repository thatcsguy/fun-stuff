// =====================================================================
// 12_bot.js: window.__game test hooks + the autopilot (levels 1-3).
// The bot only acts through G.input.fire (same rules as a human). It
// reads every hazard primitive through its covers() predicate, which is
// exactly what G.hz.dangerAt evaluates, plus the hazard list for soaks.
// Also: a throwaway test boss (?debug=1&testboss=1 only).
// =====================================================================
(() => {
  const T3 = (typeof THREE !== 'undefined') ? THREE : G.THREE;
  const PI = Math.PI, TAU = PI * 2;
  const qs = new URLSearchParams(location.search);
  const wrap = (a) => a - TAU * Math.floor((a + PI) / TAU);
  const angDiff = (a, b) => wrap(a - b);
  const posMod = (a) => ((a % TAU) + TAU) % TAU;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const logE = (w, e) => { try { G.log.error(w, e); } catch (_) { console.error(w, e); } };
  const PLAY = () => G.state === 'fight' || G.state === 'practice';
  const destructiveOk = () => !!(G.params && (G.params.debug || G.params.bot));

  // seeded RNG for the bot's own sloppiness (keeps G.rand's sequence for the boss)
  let bs = ((G.params && G.params.seed) || 777) * 2654435761 >>> 0 || 1;
  const brand = () => { bs |= 0; bs = (bs + 0x6D2B79F5) | 0; let t = Math.imul(bs ^ (bs >>> 15), 1 | bs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // ================================================================ BOT
  const LV = {
    1: { react: 0.45, ignore: 0.25, greedAegis: false, ringPref: 0, interruptMiss: 0.3 },
    2: { react: 0.25, ignore: 0.10, greedAegis: true, ringPref: 1, interruptMiss: 0.1 },
    3: { react: 0.10, ignore: 0.0, greedAegis: true, ringPref: 2, interruptMiss: 0 },
  };
  const B = { level: 0, t: 0, ignored: new Map(), castSeen: new Map(), holdT: 0, lastAct: '', acts: {}, decisions: 0, lastCost: 0 };
  const H = 1.8, STEP = 0.1, PAD = 0.12;
  const fire = (a) => { try { G.input.fire(a, { source: 'bot' }); B.acts[a] = (B.acts[a] || 0) + 1; B.lastAct = a; } catch (e) { logE('bot.fire', e); } };

  function hazards() {
    const L = (G.hz && G.hz.active) || [];
    const out = [];
    for (const h of L) {
      if (h.finished) continue;
      if (!B.ignored.has(h.id)) B.ignored.set(h.id, h.kind !== 'contact' && h.kind !== 'gap' && brand() < LV[B.level].ignore);
      if (B.ignored.get(h.id)) continue;
      out.push(h);
    }
    if (B.ignored.size > 400) { const live = new Set(L.map(h => h.id)); for (const k of B.ignored.keys()) if (!live.has(k)) B.ignored.delete(k); }
    return out;
  }
  const weightOf = (h) => (h.kind === 'contact' ? ((h.add && h.add.contactDmg) || 20) + 6 : Math.max(10, h.dmg || 0)) * (h.lethal ? 1.6 : 1);

  // ---- path simulation: returns sample arrays for one plan
  // plan: {rev: t|null, shift: {t, d}|null, halt: t|null}
  function simulate(plan) {
    const pl = G.player, S = pl.state;
    const R = G.RINGS;
    const samples = [];
    let th = S.theta, t = 0;
    let dirAfter = S.dir;
    const sp0 = (G.OMEGA || 0.6) * (S.speedMul || 1);
    const velAt = (tt) => {
      let v = pl.velAhead(tt);
      if (plan.rev != null && tt >= plan.rev) {
        const u = (tt - plan.rev) / 0.2;
        const nd = -dirAtRev;
        v = u < 1 ? -nd * Math.cos(PI * u) * sp0 : nd * sp0;
      }
      if (plan.halt != null && tt >= plan.halt && tt < plan.halt + 1.5) v *= clamp(1 - (tt - plan.halt) / 0.08, 0, 1);
      return v;
    };
    let dirAtRev = S.dir;
    if (plan.rev != null) { const v = pl.velAhead(plan.rev); dirAtRev = Math.abs(v) > 0.05 ? Math.sign(v) : S.dir; dirAfter = -dirAtRev; }
    for (let k = 1; k * STEP <= H + 1e-6; k++) {
      const t1 = k * STEP;
      th += (velAt(t) + velAt(t1)) * 0.5 * STEP; t = t1;
      let ring = pl.predictRing(t1), inv = false;
      if (plan.shift) {
        const ts = plan.shift.t;
        if (t1 >= ts + 0.14) ring = clamp(pl.predictRing(ts) + plan.shift.d, 0, R.length - 1);
        if (t1 >= ts + 0.06 && t1 <= ts + 0.20) inv = true;
      }
      const m = pl.motion();
      if (m.aegisT > t1 || m.postNovaT > t1 || (m.hitT > t1)) inv = true;
      samples.push({ t: t1, ring, th, inv });
    }
    return { samples, dirEnd: dirAfter, plan };
  }

  function evaluate(sim, hz, soaks, boss) {
    const hit = new Set();
    let cost = 0, firstHit = 99, firstHitDmg = 0;
    const sp = (G.hz && G.hz.speed) || 1;
    for (const s of sim.samples) {
      const tw = s.t < 0.9 ? 1 : 1 - (s.t - 0.9) / (H - 0.9) * 0.55;
      for (const h of hz) {
        if (h.soak) continue;
        const lt = h.lt + s.t * sp;
        let c = false;
        try { c = h.covers(s.ring, s.th, lt, s.ring, PAD); } catch (e) { c = false; }
        if (!c) continue;
        if (s.inv) continue;
        const tick = h.tick && h.kind !== 'contact';
        if (hit.has(h.id) && !tick) continue;
        const w = weightOf(h) * (hit.has(h.id) ? 0.35 : 1);
        hit.add(h.id);
        cost += w * tw;
        if (s.t < firstHit) { firstHit = s.t; firstHitDmg = w; }
      }
    }
    // soaks: must reach before the timer runs out
    for (const h of soaks) {
      const left = (h.warn - h.lt) / sp;
      let touched = false;
      for (const s of sim.samples) { if (s.t > left) break; if (!s.inv && h.touches(s.ring, s.th, 0)) { touched = true; break; } }
      if (touched) { cost -= 4; continue; }
      const e = sim.samples[sim.samples.length - 1];
      const om = (G.OMEGA || 0.6) * ((G.player.state.speedMul) || 1);
      const ringT = Math.abs(e.ring - h.ring) * 0.65;
      const fwd = posMod((h.theta - e.th) * sim.dirEnd) / om;
      const back = posMod((e.th - h.theta) * sim.dirEnd) / om + 0.4;
      const need = H + Math.max(ringT, Math.min(fwd, back));
      if (need > left - 0.2) cost += (h.failDmg || 20) * 1.4 + 10;
      else cost += need * 0.8;
    }
    // preferences at the end of the horizon
    const e = sim.samples[sim.samples.length - 1];
    const lv = LV[B.level];
    if (lv.ringPref >= 1) cost += [-(lv.ringPref === 2 ? 2.2 : 1.2), 0, 1.4][e.ring] || 0;
    if (boss && boss.alive && G.player.K) {
      const behind = Math.abs(angDiff(e.th, boss.facing + PI)) < G.player.K.behindHalf * 0.9;
      if (behind) cost -= (G.player.cooldowns.comet.holding ? 5 : 1.5);
    }
    return { cost, firstHit, firstHitDmg };
  }

  function decide() {
    const pl = G.player, S = pl.state, CD = pl.cooldowns, b = G.combat && G.combat.boss;
    if (!S.alive || S.novaActive) return;
    const lv = LV[B.level];
    B.decisions++;
    const hz = hazards();
    const soaks = hz.filter(h => h.soak && !h.finished);
    const m = pl.motion();
    // ---- build candidate plans
    const revT = m.turning ? m.turnLeft + 0.15 : m.revLock;
    const shT = m.hopLeft > 0 ? m.hopLeft + 0.35 : m.shiftLock;
    const base = S.halted ? 0 : 0;
    const plans = [{ name: 'keep' }];
    plans.push({ name: 'reverse', rev: Math.max(0, revT) + base });
    if (S.ring > 0 || (m.hopLeft > 0)) plans.push({ name: 'shiftIn', shift: { t: Math.max(0, shT), d: -1 } });
    if (S.ring < 2 || (m.hopLeft > 0)) plans.push({ name: 'shiftOut', shift: { t: Math.max(0, shT), d: 1 } });
    if (S.ring > 0) plans.push({ name: 'shiftIn+rev', shift: { t: Math.max(0, shT), d: -1 }, rev: Math.max(0.3, revT) });
    if (S.ring < 2) plans.push({ name: 'shiftOut+rev', shift: { t: Math.max(0, shT), d: 1 }, rev: Math.max(0.3, revT) });
    const eclipseReady = CD.eclipse.t <= 0;
    const castInt = !!(b && b.casting && b.casting.interruptible);
    if (eclipseReady && !castInt && !S.halted) plans.push({ name: 'halt', halt: 0 });
    // filter invalid shifts from the predicted ring
    const sims = plans.map(p => {
      if (p.shift) { const r0 = pl.predictRing(p.shift.t); const r1 = r0 + p.shift.d; if (r1 < 0 || r1 > 2) return null; }
      const sim = simulate(p); const ev = evaluate(sim, hz, soaks, b);
      const act = { keep: 0, reverse: 1.2, shiftIn: 1.6, shiftOut: 1.6, 'shiftIn+rev': 3.0, 'shiftOut+rev': 3.0, halt: 9 }[p.name] || 0;
      return { p, sim, ev, cost: ev.cost + act };
    }).filter(Boolean);
    sims.sort((a, c) => a.cost - c.cost);
    const keep = sims.find(s => s.p.name === 'keep');
    let best = sims[0];
    if (keep && best !== keep && keep.cost - best.cost < 1.0) best = keep;
    B.lastCost = best.cost;
    // ---- interrupt (priority)
    if (castInt && eclipseReady) {
      const cs = b.casting;
      if (!B.castSeen.has(cs)) B.castSeen.set(cs, brand() < lv.interruptMiss);
      if (!B.castSeen.get(cs) && cs.progress > (B.level === 3 ? 0.08 : 0.25) && cs.progress < 0.97) { fire('eclipse'); return; }
    }
    // ---- aegis: unavoidable hit within 0.35 s, or (greedy) a big hit about to land on the current path
    const aegisReady = CD.aegis.t <= 0 && m.aegisT <= 0;
    if (aegisReady) {
      const unavoidable = best.ev.firstHit <= 0.35 && best.ev.cost > 8;
      const greedy = lv.greedAegis && keep && keep.ev.firstHit <= 0.3 && keep.ev.firstHit >= 0.05 && keep.ev.firstHitDmg >= 15;
      if (unavoidable || greedy) { fire('aegis'); if (greedy && !unavoidable) return; }
    }
    // ---- movement
    const n = best.p.name;
    if (n !== 'keep') {
      // only commit the first step now; a delayed second step is re-decided next tick
      if (n === 'reverse') { if (!m.revBuf) fire('reverse'); }
      else if (n === 'shiftIn' || n === 'shiftIn+rev') { if (!m.shiftBuf) fire('shiftIn'); }
      else if (n === 'shiftOut' || n === 'shiftOut+rev') { if (!m.shiftBuf) fire('shiftOut'); }
      else if (n === 'halt') fire('eclipse');
    }
    // ---- supernova
    if (CD.nova.ready && b && b.alive && !b.invulnerable && !(G.combat.transitioning)) { fire('nova'); return; }
    // ---- comet: charge whenever ready, release from behind at full charge
    const cm = CD.comet;
    if (!cm.holding && G.input.held && G.input.held.comet) fire('cometUp');            // a press the game ignored (e.g. on cooldown)
    else if (!cm.holding && cm.t <= 0 && b && b.alive) { fire('cometDown'); B.holdT = 0; }
    else if (cm.holding) {
      const fullish = cm.charge >= 0.95;
      if ((S.behind && fullish) || (B.holdT > 9 && fullish) || (S.behind && B.holdT > 0.6 && Math.abs(angDiff(S.theta, b.facing + PI)) > G.player.K.behindHalf * 0.8 && cm.charge > 0.6)) fire('cometUp');
    }
    // ---- anchors: spread around the boss, plant on safe ground
    const A = pl.anchors.list;
    if (CD.anchor.charges > 0 && best.ev.cost < 6) {
      const oldest = A.length ? A[0] : null;
      const far = A.every(a => Math.abs(angDiff(a.theta, S.theta)) > 1.75);
      const stale = A.length >= 3 && oldest && G.player.anchorAge(oldest) > 22;
      if ((A.length < 3 && far) || (stale && far)) fire('anchor');
    }
  }

  const bot = G.bot = {
    get level() { return B.level; },
    set(level) { B.level = clamp(level | 0, 0, 3); B.t = 0; },
    stats: () => ({ level: B.level, decisions: B.decisions, acts: { ...B.acts }, lastCost: B.lastCost }),
    init() {
      const lvl = G.params && G.params.bot ? G.params.bot | 0 : 0;
      if (lvl) bot.set(lvl);
    },
    update(dt) {
      if (!B.level || !PLAY()) return;
      const cm = G.player && G.player.cooldowns && G.player.cooldowns.comet;
      if (cm && cm.holding) B.holdT += dt;
      B.t -= dt;
      if (B.t > 0) return;
      B.t = LV[B.level].react;
      try { decide(); } catch (e) { logE('bot.decide', e); }
    },
  };

  // ============================================================ __game hooks
  const toIdx = (i) => (i === 'practice' || i === 'test') ? i : clamp((i | 0) - 1, 0, 2);
  const game = window.__game = {
    version: 'perihelion-1',
    get G() { return G; },
    setBoss(i) { if (!destructiveOk()) return false; return game.startFight(i); },
    startFight(i = 1, opts = {}) {
      if (!destructiveOk()) return false;
      const idx = toIdx(i);
      try { if (G.state === 'paused') G.core.pause(false); } catch (e) { }
      G.ui && G.ui.only && G.ui.only(null);
      return G.combat.startFight(idx, { practice: idx === 'practice', fromPhase: opts.fromPhase || 0, skipIntro: opts.skipIntro !== false });
    },
    setPhase(n) { if (!destructiveOk()) return false; return G.combat.forcePhase((n | 0) - 1); },
    godMode(on = true) { if (!destructiveOk()) return false; G.player.god = !!on; return G.player.god; },
    killBoss() { if (!destructiveOk()) return false; return G.combat.killBoss(); },
    fillMeter() { if (!destructiveOk()) return false; G.player.addMeter(100, true); return true; },
    setHp(n) { if (!destructiveOk()) return false; G.player.state.hp = n; return true; },
    async fastForward(seconds = 10, dt = 1 / 30) {
      if (!destructiveOk()) return false;
      const n = Math.ceil(seconds / dt);
      for (let i = 0; i < n; i++) {
        G.core.step(dt);
        // let promise chains (boss scripts) settle inside the step, as they would between rAF frames
        for (let k = 0; k < 14; k++) await null;
      }
      return game.state();
    },
    state() {
      const c = G.combat, b = c && c.boss, P = G.player && G.player.state;
      return {
        state: G.state, t: +(G.t || 0).toFixed(2), fightTime: +((c && c.fightTime) || 0).toFixed(2),
        boss: b ? { name: b.name, hp: Math.round(b.hp), maxHp: b.maxHp, pct: +(b.hp / b.maxHp * 100).toFixed(1), phase: b.phase, casting: b.casting ? b.casting.name : null, staggered: b.staggered, facing: +b.facing.toFixed(2), alive: b.alive } : null,
        player: P ? { hp: Math.round(P.hp), ring: P.ring, theta: +P.theta.toFixed(3), dir: P.dir, meter: Math.round(P.meter), alive: P.alive, behind: P.behind, empowered: P.empowered, constellation: P.constellation, anchors: G.player.anchors.list.length } : null,
        hazards: G.hz ? G.hz.active.filter(h => !h.finished).length : 0, adds: G.adds ? G.adds.list.length : 0,
        errors: G.log ? G.log.count : 0, practice: !!(c && c.practice), bot: B.level,
      };
    },
    stats() { return { player: G.player && JSON.parse(JSON.stringify(G.player.stats)), results: G.combat && G.combat.results, bot: bot.stats() }; },
    hazards() { return (G.hz ? G.hz.active : []).filter(h => !h.finished).map(h => ({ id: h.id, kind: h.kind, state: h.state, lt: +h.lt.toFixed(2), warn: h.warn, rings: h.rings, dmg: h.dmg, lethal: h.lethal })); },
    errors() { return G.log ? G.log.errors.slice() : []; },
    bot(level = 0) { if (!destructiveOk() && level) return false; bot.set(level); return B.level; },
    input(a) { G.input.fire(a, { source: 'test' }); },
    dangerAt: (r, th, t) => G.hz.dangerAt(r, th, t),
  };

  // =================================================== throwaway test boss
  // only under ?debug=1&testboss=1: a plain obelisk that runs every primitive with real damage
  if (qs.get('testboss') === '1' && G.params && G.params.debug) {
    const acc = '#7fd6ff';
    G.bosses.test = {
      name: 'TEST ENGINE', title: 'a throwaway trial', accent: acc, sky: 'night', maxHp: 4200, parTime: 120, hitRadius: 1.0, hitHeight: 2.2,
      phases: [
        { name: 'Primitives', hpStart: 1.0, enter(b) { b.turnRate = 0.4; }, async script(b) {
          let i = 0;
          b.loop(async () => {
            const k = i++ % 10, r = b.playerRing(), th = b.playerTheta(), d = b.playerDir();
            if (k === 0) await G.hz.arc({ rings: [r], center: b.playerAhead(1.8), width: 0.8, warn: 1.8, dmg: 20, label: 'Wedge' });
            if (k === 1) await G.hz.sweep({ rings: [0, 1, 2], from: th - d * 1.2, to: th - d * 1.2 + d * PI * 1.5, warn: 2.0, dur: 2.6, dmg: 22, label: 'Sweep' });
            if (k === 2) await G.hz.ring({ ring: r, warn: 2.5, dmg: 45, label: 'Ring' });
            if (k === 3) await G.hz.rotor({ rings: [0, 1, 2], slices: [{ center: th + 1, width: 0.6 }, { center: th + 1 + PI, width: 0.6 }], omega: -d * 0.3, warn: 1.8, dur: 6, dmg: 12, label: 'Rotor' });
            if (k === 4) await G.hz.wave({ from: 'in', speed: 5, gaps: [{ center: b.playerAhead(2.5), width: 0.7 }], warn: 2.6, dmg: 70, lethal: true, label: 'Wave' });
            if (k === 5) { for (let j = 0; j < 3; j++) G.hz.orb({ ring: r, theta: th + d * (2.2 + j * 0.5), omega: -d * 0.4, life: 8, dmg: 15, label: 'Orb' }); await b.wait(3); }
            if (k === 6) { for (let j = 0; j < 3; j++) G.hz.bolt({ from: new T3.Vector3(0, 6, 0), ring: r, theta: b.playerAhead(1.3 + j * 0.6), warn: 1.6, dmg: 18, label: 'Bolt' }); await b.wait(2.2); }
            if (k === 7) await G.hz.soak({ ring: (r + 1) % 3, theta: b.playerAhead(3.5), warn: 6, failDmg: 20, label: 'Soak' });
            if (k === 8) { G.adds.spawn({ ring: r, theta: b.playerAhead(2.8), hp: 150, contactDmg: 20, label: 'Pylon' }); await b.wait(4); }
            if (k === 9) { const h = G.hz.gap({ ring: r, center: b.playerAhead(3), width: 0.5, dmg: 25 }); G.hz.custom({ warn: 1.5, active: 0.4, dmg: 15, label: 'Custom', test: (ring, t2) => ring === 2 && Math.abs(angDiff(t2, 0)) < 0.5 }); await b.wait(5); h.cancel(); }
            await b.wait(0.8);
          });
          b.loop(async () => { await b.wait(14); await b.cast({ name: 'Test Hymn', dur: 3, interruptible: true, onDone: () => G.player.damage(15, 'Test Hymn') }); });
        } },
        { name: 'Overdrive', hpStart: 0.5, async script(b) {
          b.loop(async () => {
            const r = b.playerRing();
            G.hz.ring({ ring: r, warn: 2.2, dmg: 30, gaps: [{ center: b.playerAhead(2.2) + PI, width: 0.8 }] });
            await b.wait(1.2);
            G.hz.sweep({ rings: [(r + 1) % 3], from: b.playerTheta() + PI, to: b.playerTheta() + PI * 2.2, warn: 1.6, dur: 2.2, dmg: 20 });
            await b.wait(3.2);
            await b.cast({ name: 'Overdrive Hymn', dur: 2.4, interruptible: true, onDone: () => G.player.damage(15, 'Overdrive Hymn') });
            await b.wait(1);
          });
        } },
      ],
      build(b) {
        const g = new T3.Group();
        const brass = G.mat.brass({});
        const ob = new T3.Mesh(new T3.CylinderGeometry(0.5, 1.0, 3.6, 4), brass); ob.position.y = 1.8; ob.rotation.y = PI / 4;
        const cr = new T3.Mesh(new T3.OctahedronGeometry(0.55, 0), new T3.MeshBasicMaterial({ color: new T3.Color(acc).multiplyScalar(1.6) })); cr.position.set(0.9, 2.6, 0);
        const rear = new T3.Mesh(new T3.RingGeometry(0.2, 0.38, 24), new T3.MeshBasicMaterial({ color: new T3.Color('#ffd36b').multiplyScalar(1.6), side: T3.DoubleSide })); rear.position.set(-0.75, 2.2, 0); rear.rotation.y = PI / 2;
        g.add(ob, cr, rear); b.model = g; b.data.cr = cr;
      },
      animate(b, dt) { if (b.data.cr) { b.data.cr.rotation.y += dt * 2; b.data.cr.position.y = 2.6 + Math.sin(b.clock * 2) * 0.1; } },
    };
  }
})();
