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
  // A planner that plays like a competent human at level 3 and a hesitant / careless one at levels 1-2.
  // Every decision tick (reaction time per level) it rolls the hero's real motion rules forward ~4 s for a set of
  // candidate input plans (keep, reverse now or later, shift now or later, double shifts, reverse+shift, shift and
  // back, reverse twice to wait in a gap, Eclipse halts), scores each against every hazard's own covers() test at
  // the hazard-local time of each sample (the same test G.hz.dangerAt and the real hit check use), models hit
  // i-frames, shift i-frames, tick hazards and soak timers, and commits only the first input of the best plan.
  // Level differences (SPEC 8.8): reaction time and the chance to overlook a threat (re-rolled every ~2 s per hazard).
  const LV = {
    1: { react: 0.45, ignore: 0.25, greedAegis: false, ringPref: 0, interruptMiss: 0.3, reserve: false },
    2: { react: 0.25, ignore: 0.10, greedAegis: true, ringPref: 1, interruptMiss: 0.1, reserve: true },
    3: { react: 0.10, ignore: 0.0, greedAegis: true, ringPref: 2, interruptMiss: 0, reserve: true },
  };
  const B = { pending: [], level: 0, t: 0, ign: new Map(), castSeen: new Map(), holdT: 0, lastAct: '', acts: {}, decisions: 0, lastCost: 0, plans: {},
    intCasts: [], phaseT0: 0, retro: null, smashed: [0, 0, 0], smashT: [-99, -99, -99], lastBest: null };
  const PAD = 0.12, IGNORE_REROLL = 2.0, HIT_IFR = 0.8;
  // sample times: fine where inputs land (shift i-frames are 0.14 s wide), coarser further out
  const TS = (() => { const a = []; let t = 0; while (t < 1.6 - 1e-6) { t += 0.05; a.push(+t.toFixed(3)); } while (t < 3.0 - 1e-6) { t += 0.1; a.push(+t.toFixed(3)); } while (t < 4.0 - 1e-6) { t += 0.2; a.push(+t.toFixed(3)); } return a; })();
  const H = TS[TS.length - 1];
  const fire = (a) => { try { G.input.fire(a, { source: 'bot' }); B.acts[a] = (B.acts[a] || 0) + 1; B.lastAct = a; } catch (e) { logE('bot.fire', e); } };
  const fightT = () => (G.combat && G.combat.fightTime) || 0;

  // ---- perception: hazards the bot noticed this moment (each threat re-rolls its "overlooked" chance every ~2 s)
  function hazards() {
    const L = (G.hz && G.hz.active) || [];
    const out = [], now = G.t || 0, p = LV[B.level].ignore;
    for (const h of L) {
      if (h.finished) continue;
      if (p > 0 && h.kind !== 'contact' && h.kind !== 'gap') {
        let e = B.ign.get(h.id);
        if (!e || now >= e.until) { e = { ign: brand() < p, until: now + IGNORE_REROLL * (0.75 + 0.5 * brand()) }; B.ign.set(h.id, e); }
        if (e.ign) continue;
      }
      out.push(h);
    }
    if (B.ign.size > 300) { const live = new Set(L.map(h => h.id)); for (const k of B.ign.keys()) if (!live.has(k)) B.ign.delete(k); }
    return out;
  }
  const dmgOf = (h) => h.kind === 'contact' ? ((h.add && h.add.contactDmg) || 20) : (h.dmg || 0);
  // the cost of one hit: its damage, plus the knock-on of contact bounces and falls
  const costOf = (h) => {
    const d = dmgOf(h);
    if (h.kind === 'contact') return d + 6;
    if (h.kind === 'gap') return d + 10;
    return Math.max(6, d) * (h.lethal ? 1.15 : 1);
  };
  // the gravity well (HELIARCH): its brace state is shown on screen ("SHIFT OUT!"); read it from the boss data
  function wellInfo(b, sp) {
    const st = b && b.data && b.data.well;
    if (!st || st.braced || !st.h || !st.h.hazard || st.h.hazard.finished) return null;
    const h = st.h.hazard, warn = st.warn || h.warn, win = st.win || 1.2;
    return { h, braced: false, fireIn: Math.max(0, (warn - h.lt) / sp), openIn: Math.max(0, (warn - win - h.lt) / sp) };
  }
  // forced reverses (HELIARCH Retrograde): every ring's inlay arrows show the direction the knight will be forced
  // into, and all rings glow for the lead time before the flip (the glow fades out exactly at the flip)
  function retroInfo(S) {
    const rs = (G.world && G.world.ringState) ? G.world.ringState() : [];
    if (!(rs.length === 3 && rs.every(r => r.arrowShown) && rs.every(r => r.arrowDir === rs[0].arrowDir))) { B.retro = null; return null; }
    const want = rs[0].arrowDir;
    const left = Math.min(...rs.map(r => r.glowLeft));
    B.retro = { want, left };
    if (want === S.dir || !(left > 0 && left < 4)) return { want, at: Infinity };
    return { want, at: Math.max(0.05, left) };
  }
  // speed rules the hero can read off the arena: a flooded ring slows to x0.6 (OUROS), a ring-bound haste or
  // slow (spin-up, flood) stays with its ring, anything else (enthral) follows the hero
  function speedModel(S, m) {
    const rs = (G.world && G.world.ringState) ? G.world.ringState() : [];
    const flooded = [0, 1, 2].map(i => !!(rs[i] && rs[i].flooded));
    const cur = S.speedMul || 1, until = m.speedT > 0 ? m.speedT : Infinity;
    const kind = Math.abs(cur - 1) < 1e-3 ? 0 : (cur > 1 || (cur < 1 && flooded[S.ring])) ? 1 : 2;
    const home = S.ring;
    return (ring, t) => {
      let v = 1;
      if (t < until && (kind === 2 || (kind === 1 && ring === home))) v = cur;
      if (flooded[ring]) v = Math.min(v, 0.6);
      return v;
    };
  }

  // ---- forward model of the hero's motion (mirrors 07_player.js updateMotion / doReverse / doShift / eclipse)
  function rollout(events, ctx) {
    const pl = G.player, S = pl.state, K = pl.K, m = ctx.m;
    const st = {
      th: S.theta, ring: m.hop ? m.hop.from : S.ring, dir: S.dir,
      turn: m.turning ? { t: K.reverseDur - m.turnLeft, dur: K.reverseDur } : null, revLock: m.revLock, revBuf: m.revBuf,
      hop: m.hop ? { from: m.hop.from, to: m.hop.to, t: m.hop.t, dur: m.hop.dur, forced: !!m.hop.forced } : null,
      shiftLock: m.shiftLock, shiftBuf: m.shiftBuf, haltT: m.haltT, haltF: m.haltF != null ? m.haltF : 1,
    };
    const ringOk = ctx.ringOk;
    const outT = [];                                  // times an outward shift or outward bump started (gravity brace)
    let tNow = 0;
    const endHalt = () => { st.haltT = 0; };
    const doRev = () => {
      if (st.haltT > 0) endHalt();
      if (st.turn || st.revLock > 0) { st.revBuf = true; return; }
      st.dir = -st.dir; st.turn = { t: 0, dur: K.reverseDur };
    };
    const doShift = (d) => {
      if (st.haltT > 0) endHalt();
      if (st.hop || st.shiftLock > 0) { st.shiftBuf = d; return; }
      const to = st.ring + d;
      if (!ringOk(to)) { st.shiftLock = K.bumpLock; if (d > 0) outT.push(tNow); return; }
      st.hop = { from: st.ring, to, t: 0, dur: K.shiftDur, forced: false };
      if (d > 0) outT.push(tNow);
    };
    const doHalt = () => { st.haltT = K.eclipseHalt; st.turn = null; };
    const ev = events.slice().sort((a, c) => a.t - c.t);
    let ei = 0, prevT = 0;
    const samples = [];
    const retro = ctx.retro; let retroDone = !retro || retro.at === Infinity;
    for (const t1 of TS) {
      // integrate in <= 0.05 s sub-steps (exactly the sample grid up to 1.6 s)
      let t = prevT;
      while (t < t1 - 1e-6) {
        const dt = Math.min(0.05, t1 - t);
        tNow = t;
        while (ei < ev.length && ev[ei].t <= t + 1e-6) {
          const e = ev[ei++];
          if (e.a === 'R') doRev(); else if (e.a === 'S') doShift(e.d); else if (e.a === 'H') doHalt();
        }
        if (!retroDone && t + 1e-6 >= retro.at) {
          retroDone = true;
          if (st.dir !== retro.want) { const old = st.dir; st.dir = -st.dir; st.turn = null; st.revLock = 0.2; st.revBuf = false; st.th -= old * 0.06; }
        }
        // timers (same order as updateMotion)
        if (st.haltT > 0) { st.haltT -= dt; if (st.haltT <= 0) st.haltT = 0; }
        const hT = st.haltT > 0 ? 0 : 1;
        st.haltF += (hT - st.haltF) * Math.min(1, dt * (hT ? 7 : 16)); if (Math.abs(st.haltF - hT) < 0.01) st.haltF = hT;
        if (st.turn) { st.turn.t += dt; if (st.turn.t >= st.turn.dur) { st.turn = null; st.revLock = K.reverseLock; } }
        else if (st.revLock > 0) { st.revLock -= dt; if (st.revLock <= 0) { st.revLock = 0; if (st.revBuf) { st.revBuf = false; doRev(); } } }
        if (st.hop) { st.hop.t += dt; if (st.hop.t >= st.hop.dur) { st.ring = st.hop.to; st.hop = null; st.shiftLock = K.shiftLock; } }
        else if (st.shiftLock > 0) { st.shiftLock -= dt; if (st.shiftLock <= 0) { st.shiftLock = 0; if (st.shiftBuf) { const d = st.shiftBuf; st.shiftBuf = 0; tNow = t + dt; doShift(d); } } }
        const vr = st.hop ? (st.hop.t / st.hop.dur < 0.5 ? st.hop.from : st.hop.to) : st.ring;
        const sp = K.omega * ctx.speed(vr, t) * st.haltF;
        const v = st.turn ? -st.dir * Math.cos(PI * clamp(st.turn.t / st.turn.dur, 0, 1)) * sp : st.dir * sp;
        st.th += v * dt;
        t += dt;
      }
      prevT = t1;
      const hop = st.hop, u = hop ? clamp(hop.t / hop.dur, 0, 1) : 0;
      const ring = hop ? (u < 0.5 ? hop.from : hop.to) : st.ring;
      const ringF = hop ? hop.from + (hop.to - hop.from) * (u * u * (3 - 2 * u)) : st.ring;
      // shift i-frames, trimmed by a frame-and-a-half each side: the bot never counts on frame-perfect timing
      const sInv = !!(hop && !hop.forced && hop.t >= K.shiftIStart + 0.03 && hop.t <= K.shiftIEnd - 0.03);
      samples.push({ t: t1, ring, ringF, th: st.th, inv: sInv || ctx.aegisT > t1 || ctx.postNovaT > t1, shifting: !!hop, dir: st.dir });
    }
    return { samples, outT, end: samples[samples.length - 1] };
  }

  function evaluate(sim, ctx) {
    const sp = ctx.sp, S = G.player.state;
    let cost = 0, dmgSum = 0, firstHit = 99, firstHitDmg = 0, firstCost = 0;
    let ifr = ctx.hitT;
    const once = new Set(), nextTick = new Map(), blocked = new Set(), aeg = ctx.aeg;
    let reward = 0;
    const well = ctx.well, braced = well && sim.outT.some(t => t >= well.openIn - 0.3 && t <= well.fireIn);
    let prev = null;
    for (const s of sim.samples) {
      const tw = s.t <= 1.2 ? 1 : 1 - (s.t - 1.2) / (H - 1.2) * 0.6;
      for (const h of ctx.hz) {
        if (well && h === well.h && braced) continue;
        if (h.kind === 'contact' ? (s.shifting && h.add && s.ring !== h.add.ring) : (h.kind === 'gap' && s.shifting)) continue;
        const lt = h.lt + s.t * sp;
        let c = false;
        try { c = h.covers(s.ring, s.th, lt, s.ringF, PAD); } catch (e) { c = false; }
        // a fast beam can pass between two coarse samples: check the crossing
        if (!c && h.kind === 'sweep' && prev && prev.ring === s.ring && !s.inv && h.rings.includes(s.ring) && h.live(lt) && s.t > 1.55) {
          const lt0 = h.lt + prev.t * sp, b0 = h.beamAt(lt0), b1 = h.beamAt(lt);
          c = Math.sign(angDiff(prev.th, b0)) !== Math.sign(angDiff(s.th, b1)) && Math.abs(angDiff(s.th, b1)) < 1.0;
        }
        if (!c || s.inv) continue;
        // a planned Aegis blocks (and reflects) everything in its window, i-frames or not
        if (aeg && s.t >= aeg.a0 && s.t <= aeg.a1) {
          if (!blocked.has(h.id)) { blocked.add(h.id); const d = dmgOf(h), perfect = s.t - aeg.a0 <= 0.3; reward += 2 + Math.max(40, d * (perfect ? 4.5 : 3)) * 0.04; }
          continue;
        }
        if (s.t < ifr) continue;
        const tick = h.tick > 0 && h.kind !== 'contact';
        if (tick) { const nt = nextTick.has(h.id) ? nextTick.get(h.id) : (h.nextTick || 0); if (lt < nt) continue; nextTick.set(h.id, lt + h.tick); }
        else { if (once.has(h.id)) continue; once.add(h.id); }
        const d = dmgOf(h), w = costOf(h);
        cost += w * tw; dmgSum += d; ifr = s.t + HIT_IFR;
        if (s.t < firstHit) { firstHit = s.t; firstHitDmg = d; firstCost = w; }
      }
      prev = s;
    }
    // being pulled in by an unbraced well (the crush on the inner ring is the hazard itself)
    if (well && !braced && well.fireIn < H) {
      const s = sim.samples.find(x => x.t >= well.fireIn) || sim.end;
      if (s.ring > 0) cost += 9;
    }
    if (dmgSum >= S.hp && !(G.player.god || (G.combat && G.combat.practice))) cost += 250;
    // soaks: reach them before their timer runs out; a missed one costs its real damage (and its side effect)
    for (const h of ctx.soaks) {
      const left = (h.warn - h.lt) / sp;
      let touched = false;
      for (const s of sim.samples) { if (s.t > left) break; if (!s.shifting && h.touches(s.ring, s.th, 0)) { touched = true; break; } }
      if (touched) { cost -= 1.5; continue; }
      const e = sim.end;
      const om = (G.OMEGA || 0.6) * ctx.speed(e.ring, e.t);
      const ringT = Math.abs(e.ring - h.ring) * 0.7;
      const fwd = posMod((h.theta - e.th) * e.dir) / om;
      const back = posMod((e.th - h.theta) * e.dir) / om + 0.45;
      const need = e.t + Math.max(ringT, Math.min(fwd, back));
      const fail = (h.failDmg || 0) + 7;            // a missed star also has a side effect (adds, a new crack)
      if (need > left - 0.15) cost += fail * (left <= H ? 1 : 0.85);
      else cost += Math.min(fail * 0.4, (need - e.t) * 0.3);
    }
    // anchors: running over a ready one pulses it (26 dmg, +5 HP); a marked one is about to be smashed, pulse it first
    for (const a of ctx.anchors) {
      const R = G.RINGS[a.ring], contact = (G.player.K.anchorContact || 0.7) / R;
      for (const s of sim.samples) {
        if (s.t < (a.cd || 0) || s.shifting) continue;
        if ((a.meridian || s.ring === a.ring) && Math.abs(angDiff(s.th, a.theta)) < contact) { cost -= a.warn ? 3 : 1.2; break; }
      }
    }
    // preferences at the end of the horizon: inner ring greed (levels 2-3), the boss's back
    const e = sim.end, lv = LV[B.level];
    if (lv.ringPref >= 1) cost += [-(lv.ringPref === 2 ? 2.2 : 1.2), 0, 1.4][e.ring] || 0;
    const b = ctx.boss;
    if (b && b.alive && G.player.K) {
      if (Math.abs(angDiff(e.th, b.facing + PI)) < G.player.K.behindHalf * 0.9) cost -= (G.player.cooldowns.comet.holding ? 5 : 1.5);
    }
    cost -= reward;
    return { cost, dmgSum, firstHit, firstHitDmg, firstCost, braced, reward };
  }

  // ---- Eclipse economy: keep it for the next interruptible cast when one is due (levels 2-3)
  function eclipseReserved() {
    if (!LV[B.level].reserve) return false;
    const now = fightT();
    const gaps = []; for (let i = 1; i < B.intCasts.length; i++) gaps.push(B.intCasts[i] - B.intCasts[i - 1]);
    const avg = gaps.length ? clamp(gaps.reduce((a, c) => a + c, 0) / gaps.length, 10, 40) : 22;
    const last = B.intCasts.length && B.intCasts[B.intCasts.length - 1] >= B.phaseT0 ? B.intCasts[B.intCasts.length - 1] : B.phaseT0;
    const due = last + avg;
    const cd = (G.player.K && G.player.K.eclipseCd) || 14;
    return due - now < cd + 1 && now < due + 14;
  }

  function plansFor(ctx) {
    const S = G.player.state, ok = ctx.ringOk, P = [];
    const add = (name, ev) => P.push({ name, ev });
    add('keep', []);
    for (const t of [0, 0.4, 0.8, 1.3, 2.0]) add(t ? 'rev@' + t : 'reverse', [{ t, a: 'R' }]);
    const r0 = ctx.m.hop ? ctx.m.hop.to : S.ring;
    for (const d of [-1, 1]) {
      const nm = d < 0 ? 'in' : 'out';
      const can1 = ok(r0 + d), can2 = can1 && ok(r0 + 2 * d);
      if (!can1 && !(d > 0 && ctx.well)) continue;           // an outward bump still braces against the well
      for (const t of [0, 0.3, 0.6, 1.0, 1.5, 2.2]) add(t ? nm + '@' + t : nm, [{ t, a: 'S', d }]);
      if (!can1) continue;
      if (can2) { add(nm + 'x2', [{ t: 0, a: 'S', d }, { t: 0.1, a: 'S', d }]); for (const t of [0.5, 1.0]) add(nm + 'x2@' + t, [{ t, a: 'S', d }, { t: t + 0.1, a: 'S', d }]); }
      for (const t2 of [0.3, 0.8, 1.4]) add(nm + '+rev@' + t2, [{ t: 0, a: 'S', d }, { t: t2, a: 'R' }]);
      for (const t2 of [0.25, 0.7, 1.2]) add('rev+' + nm + '@' + t2, [{ t: 0, a: 'R' }, { t: t2, a: 'S', d }]);
      for (const t2 of [0.8, 1.5]) add(nm + '+back@' + t2, [{ t: 0, a: 'S', d }, { t: t2, a: 'S', d: -d }]);
    }
    for (const t2 of [0.6, 1.1, 1.7]) add('rev2@' + t2, [{ t: 0, a: 'R' }, { t: t2, a: 'R' }]);
    if (ctx.haltOk) {
      add('halt', [{ t: 0, a: 'H' }]);
      add('halt+rev', [{ t: 0, a: 'H' }, { t: 0.9, a: 'R' }]);
      for (const d of [-1, 1]) if (ok(r0 + d)) add('halt+' + (d < 0 ? 'in' : 'out'), [{ t: 0, a: 'H' }, { t: 0.9, a: 'S', d }]);
    }
    return P;
  }
  const ACT_COST = { R: 0.5, S: 0.7, H: 0 };
  function pressAll(evs, m) {
    for (const e of evs) {
      if (e.a === 'R') { if (!m.revBuf) fire('reverse'); }
      else if (e.a === 'S') { if (m.shiftBuf !== e.d) fire(e.d < 0 ? 'shiftIn' : 'shiftOut'); }
      else if (e.a === 'H') { if (G.player.cooldowns.eclipse.t <= 0) fire('eclipse'); }
      else if (e.a === 'A') { if (G.player.cooldowns.aegis.t <= 0) fire('aegis'); }
    }
  }

  function decide() {
    const pl = G.player, S = pl.state, CD = pl.cooldowns, b = G.combat && G.combat.boss;
    if (!S.alive || S.novaActive) return;
    const lv = LV[B.level];
    B.decisions++;
    const sp = (G.hz && G.hz.speed) || 1;
    const all = hazards();
    const m = pl.motion();
    const ringOk = (i) => (pl.ringOk ? pl.ringOk(i) : i >= 0 && i <= 2);
    // hazards that can matter inside the horizon (live now or going live before it ends)
    const hz = [], soaks = [];
    for (const h of all) {
      if (h.soak) { soaks.push(h); continue; }
      if (h.kind !== 'contact' && h.kind !== 'gap' && h.kind !== 'orb' && h.lt + H * sp < h.warn) continue;
      hz.push(h);
    }
    const eclipseReady = CD.eclipse.t <= 0;
    const castInt = !!(b && b.casting && b.casting.interruptible);
    const reserved = eclipseReserved();
    const ctx = {
      m, sp, hz, soaks, boss: b, ringOk, speed: speedModel(S, m), retro: retroInfo(S), well: wellInfo(b, sp),
      aegisT: m.aegisT, postNovaT: m.postNovaT, hitT: m.hitT,
      anchors: pl.anchors.list.filter(a => a.ring != null),
      haltOk: eclipseReady && !castInt && !S.halted,
    };
    const haltCost = reserved ? 30 : 6;
    let best = null, keep = null;
    if (B.debug) B.dbg = [];
    for (const p of plansFor(ctx)) {
      const sim = rollout(p.ev, ctx);
      const ev = evaluate(sim, ctx);
      let c = ev.cost;
      for (const e of p.ev) c += e.a === 'H' ? haltCost : ACT_COST[e.a];
      const first = p.ev.length ? Math.min(...p.ev.map(e => e.t)) : Infinity;
      if (first < Infinity) c += 0.2 * first;           // among equal answers, act sooner rather than later
      const r = { p, sim, ev, cost: c, now: first <= 1e-6, first };
      if (p.name === 'keep') keep = r;
      if (!best || c < best.cost) best = r;
      if (B.debug) (B.dbg = B.dbg || []).push({ n: p.name, c: +c.toFixed(1), dmg: ev.dmgSum, fh: ev.firstHit, s: sim.samples.filter((x, i) => i % 3 === 0).map(x => x.t + ':' + x.ring + (x.shifting ? 's' : '') + (x.inv ? 'i' : '') + '@' + x.th.toFixed(2)).join(' ') });
    }
    // do not twitch: pressing something before the next look must beat doing nothing by a margin
    if (best !== keep && keep && best.first <= lv.react + 0.02 && keep.cost - best.cost < 0.8) best = keep;
    // ---- greedy Aegis (levels 2-3): take a big hit on purpose inside a perfect Aegis for the reflect
    const aegisReady = CD.aegis.t <= 0 && m.aegisT <= 0;
    let aegisPlan = null;
    if (aegisReady && lv.greedAegis) {
      for (const base of keep && keep !== best ? [best, keep] : [best]) {
        if (!(base.ev.firstHit < 2.5) || base.ev.firstHitDmg < 15) continue;
        const ta = Math.max(0, base.ev.firstHit - 0.2), dur = (G.player.K && G.player.K.aegisDur) || 1.0;
        const ev = evaluate(base.sim, { ...ctx, aeg: { a0: ta, a1: ta + dur } });
        let c = ev.cost; for (const e of base.p.ev) c += e.a === 'H' ? haltCost : ACT_COST[e.a];
        c += 2;                                            // the cooldown has value too
        if (ev.reward > 0 && c < best.cost && (!aegisPlan || c < aegisPlan.cost)) aegisPlan = { base, ta, cost: c };
      }
    }
    if (aegisPlan) {
      best = { ...aegisPlan.base, cost: aegisPlan.cost, aegisAt: aegisPlan.ta };
      B.plans['aegis'] = (B.plans['aegis'] || 0) + 1;
    }
    // an input planned for a moment before the next decision tick is pressed on time (a human times it too)
    B.pending = [];
    if (!best.now && best.first <= lv.react + 0.02) B.pending.push({ at: (G.t || 0) + best.first, ev: best.p.ev.filter(e => e.t === best.first) });
    B.lastCost = best.cost; B.lastBest = best.p.name;
    B.plans[best.p.name.split('@')[0]] = (B.plans[best.p.name.split('@')[0]] || 0) + 1;
    // ---- interrupt (priority)
    if (castInt && eclipseReady) {
      const cs = b.casting;
      if (!B.castSeen.has(cs)) B.castSeen.set(cs, brand() < lv.interruptMiss);
      if (!B.castSeen.get(cs) && cs.progress > (B.level === 3 ? 0.08 : 0.25) && cs.progress < 0.97) { fire('eclipse'); return; }
    }
    // ---- aegis: a planned greedy block, or an unavoidable hit within 0.35 s
    if (aegisReady) {
      if (best.aegisAt != null) {
        if (best.aegisAt <= 1e-6) fire('aegis');
        else if (best.aegisAt <= lv.react + 0.02) B.pending.push({ at: (G.t || 0) + best.aegisAt, ev: [{ t: best.aegisAt, a: 'A' }] });
      } else if (best.ev.firstHit <= 0.35 && best.ev.firstCost >= 8) fire('aegis');
    }
    // ---- movement: commit the plan's inputs that are due now; later ones are re-planned next tick
    if (best.now) pressAll(best.p.ev.filter(e => e.t <= 1e-6), m);
    // ---- supernova
    if (CD.nova.ready && b && b.alive && !b.invulnerable && !(G.combat.transitioning)) { fire('nova'); return; }
    // ---- comet: charge whenever ready, release from behind at full charge
    const cm = CD.comet;
    if (!cm.holding && G.input.held && G.input.held.comet) fire('cometUp');            // a press the game ignored (e.g. on cooldown)
    else if (!cm.holding && cm.t <= 0 && b && b.alive) { fire('cometDown'); B.holdT = 0; }
    else if (cm.holding) {
      const fullish = cm.charge >= 0.95;
      if ((S.behind && fullish) || (B.holdT > 9 && fullish) || (S.behind && B.holdT > 0.6 && b && Math.abs(angDiff(S.theta, b.facing + PI)) > G.player.K.behindHalf * 0.8 && cm.charge > 0.6)) fire('cometUp');
    }
    // ---- anchors: spread around the boss on safe ground; marked ones are as good as gone; avoid rings the boss
    // just smashed anchors on
    const A = pl.anchors.list.filter(a => !a.warn);
    if (CD.anchor.charges > 0 && best.ev.dmgSum === 0 && !S.shifting && ringOk(S.ring)) {
      const ringBad = B.smashed[S.ring] >= 1 && fightT() - B.smashT[S.ring] < 30 && [0, 1, 2].some(r => r !== S.ring && ringOk(r) && !(B.smashed[r] >= 1 && fightT() - B.smashT[r] < 30));
      const all3 = pl.anchors.list;
      const oldest = all3.length ? all3[0] : null;
      const far = A.every(a => Math.abs(angDiff(a.theta, S.theta)) > 1.75);
      const stale = all3.length >= 3 && oldest && (oldest.warn || G.player.anchorAge(oldest) > 22);
      if (!ringBad && ((A.length < 3 && far && (all3.length < 3 || stale || A.length < all3.length)) || (stale && far))) fire('anchor');
    }
  }

  const bot = G.bot = {
    get level() { return B.level; },
    set(level) { B.level = clamp(level | 0, 0, 3); B.t = 0; },
    _B: B,
    stats: () => ({ level: B.level, decisions: B.decisions, acts: { ...B.acts }, lastCost: B.lastCost, lastPlan: B.lastBest, plans: { ...B.plans } }),
    init() {
      const lvl = G.params && G.params.bot ? G.params.bot | 0 : 0;
      if (lvl) bot.set(lvl);
      // what a player remembers between moments: when interruptible casts come, where anchors get smashed
      G.on('castStart', (d) => { if (d && d.interruptible) B.intCasts.push(fightT()); });
      G.on('phaseStart', () => { B.phaseT0 = fightT(); });
      G.on('fightStart', () => { B.pending = []; B.intCasts.length = 0; B.phaseT0 = 0; B.retro = null; B.ign.clear(); B.castSeen = new Map(); B.smashed = [0, 0, 0]; B.smashT = [-99, -99, -99]; });
      G.on('anchorSmashed', (d) => { if (d && d.ring != null) { B.smashed[d.ring]++; B.smashT[d.ring] = fightT(); } });
    },
    update(dt) {
      if (!B.level || !PLAY()) return;
      const cm = G.player && G.player.cooldowns && G.player.cooldowns.comet;
      if (cm && cm.holding) B.holdT += dt;
      if (B.pending && B.pending.length) {
        for (let i = B.pending.length - 1; i >= 0; i--) {
          const pe = B.pending[i]; if ((G.t || 0) < pe.at - 1e-6) continue;
          B.pending.splice(i, 1);
          try { if (G.player.state.alive && !G.player.state.novaActive) pressAll(pe.ev, G.player.motion()); } catch (e) { logE('bot.pending', e); }
        }
      }
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
