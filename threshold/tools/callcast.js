// node callcast.js [class] [runs] : where the time goes in the Impresario's Nightmare finale (Final Call), per ramp step:
// live time, share of time the gate is open (the lead understudy in his light, or an Ovation), share of time in a planted cast
// ("cast") and in casts that finished ("fin"), planted casts finished per minute, the longest stretch with no finished planted
// cast outside a Cue ("noBolt", the design target is 4 s or less for Stormcaller), damage per second, and Cues passed / held and
// Ovations. PH=n starts at phase n (default 2, Final Call; PH=0 is a whole fight). STEP=n holds the ramp at step n or later;
// ONLY=n counts step n only. SEED sets the page seed. "design" is the check behind the guard rail, independent of how well the
// autopilot plays: the longest stretch (outside Cues and Ovations) in which no spot within 3 m puts the lead in his light AND is safe
// for a whole 1.5 s Bolt for all three bodies (walk time + 1.6 s, after a Recast's bell). Targets (plan): Stormcaller cast share >= 50% at steps 0-3, >= 40% at 4-5.
// BLIND=1: whole fights (PH=0) with the lead-blind autopilot (Bot.leadBlind: always plays the rose doll as the lead and treats
// Cues as Normal Blackouts). It must never kill. REAL=1 turns god mode off. GAPLOG=1 prints the longest no-Bolt stretch per step,
// one entry per 0.25 s: his cast (3 letters, Rc = Recast), then c casting / m moving / . idle, x = the gate is closed.
const { launch } = require('./harness.js');
(async () => {
  const [cls = 'stormcaller', runs = '2'] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const blind = !!process.env.BLIND;
  for (let k = 0; k < +runs; k++) {
    const r = await page.evaluate(([cls, blind, STEP, PH, ONLY, real, gaplog]) => {
      const g = window.__game, G = g.G; G.headless = true; g.bot(3); g.god(!real); g.Bot.leadBlind = blind;
      g.start('theatre', { cls, phase: +(PH !== undefined ? PH : (blind ? 0 : 2)) }); const b = G.boss, p = G.player, S = b.state, T = b.def.nmTest; let s;
      const A = []; const at = () => (S.finale && !b.transitioning && G.state === 'fight') ? (A[S.callStep] || (A[S.callStep] = { t: 0, gate: 0, cast: 0, fin: 0, done: 0, dmg: 0, noBolt: 0, gap: 0, ov: 0, dz: 0, dzMax: 0, dzOver: 0 })) : null;
      let lastC = null, dmg0 = p.stats.dmg; const com = p.commit.bind(p); p.commit = (i, tgt, wasCast) => { const c = at(); if (c && wasCast) { c.done++; if (lastC) c.fin += lastC.time; if (c.gap > c.noBolt) { c.noBolt = c.gap; c.log = c.tl; } c.gap = 0; c.tl = ''; } return com(i, tgt, wasCast); };
      const onStep = (dt) => {
        if (STEP !== undefined && S.finale) T.setStep(b, +STEP);
        const c = at(), dd = p.stats.dmg - dmg0; dmg0 = p.stats.dmg; lastC = p.casting; if (!c) return; if (ONLY !== undefined && S.callStep !== +ONLY) return;
        c.t += dt; c.dmg += dd; if (S.inLight || G.now < S.ovUntil) c.gate += dt; if (G.now < S.ovUntil) c.ov += dt; if (p.casting) c.cast += dt;
        // design check, independent of the autopilot: is there a spot within 3 m where the lead stands in his light and a 1.5 s
        // Bolt started after walking there lands before anything reaches any of the three bodies? (Cues and Ovations excluded)
        if (!S.black && !(G.now < S.ovUntil)) { let ok = false; const pts = [[p.pos.x, p.pos.z]]; for (const rr of [1.5, 3]) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; pts.push([p.pos.x + Math.sin(a) * rr, p.pos.z + Math.cos(a) * rr]); }
            const lead = S.recast ? S.recast.to : S.lead, bx = S.recast ? S.recast.x : b.pos.x, bz = S.recast ? S.recast.z : b.pos.z, mode = S.dolls[lead].mode;
            for (const [x, z] of pts) { if (!G.arena.contains(x, z)) continue; const lx = mode === 'x' ? -x : x, lz = mode === 'x' ? z : -z; if (Math.hypot(lx - bx, lz - bz) > T.GATE.r - 0.3) continue;
              const tt = Math.hypot(x - p.pos.x, z - p.pos.z) / 7, need = tt + 1.6 + (S.recast ? Math.max(0, S.recast.at - G.now) : 0); if (Math.min(g.Hz.threat(x, z), b.def.danger(b, x, z)) > need && !g.Bul.threat(x, z, need)) { ok = true; break; } }
            if (ok) { if (c.dz > 0) { c.dzMax = Math.max(c.dzMax, c.dz); if (c.dz > 4) c.dzOver++; } c.dz = 0; } else c.dz += dt; } else c.dz = 0;
        if (S.black) { c.gap = 0; c.tl = ''; } else { c.gap += dt; c.tt = (c.tt || 0) + dt; if (c.tt >= 0.25) { c.tt -= 0.25; const cs = b.castState ? b.castState.name.slice(0, 3) : ''; c.tl = (c.tl || '') + (cs || (S.recast ? 'Rc' : '')) + (p.casting ? 'c' : p.moving ? 'm' : '.') + (S.inLight ? '' : 'x') + ' '; } } };
      const n = STEP !== undefined ? 50 : 200;
      for (let i = 0; i < n; i++) { s = g.fastForward(2, true, onStep); if (s.state !== 'fight') break; }
      g.Bot.leadBlind = false; g.god(false);
      const fmt = (q) => q && q.t > 1 ? `${Math.round(q.t)}s gate ${Math.round(q.gate / q.t * 100)}% cast ${Math.round(q.cast / q.t * 100)}% fin ${Math.round(q.fin / q.t * 100)}% ${(q.done / q.t * 60).toFixed(1)}/m noBolt ${q.noBolt.toFixed(1)} design ${q.dzMax.toFixed(1)}${q.dzOver ? ' (' + q.dzOver + ' over 4 s)' : ''} dps ${Math.round(q.dmg / q.t)} ov ${Math.round(q.ov)}s` + (gaplog ? '\n        ' + q.log : '') : null;
      return { state: s.state + ' ' + s.t + ' boss ' + s.boss + '%' + (s.src ? ' ' + (typeof s.src === 'string' ? s.src : JSON.stringify(s.src)) : ''), steps: A.map((q, i) => q && fmt(q) ? i + ': ' + fmt(q) : null).filter(Boolean), cues: (S.cuePass || 0) + '/' + (S.cueN || 0), ovations: S.ovN || 0, recasts: S.recastN || 0, stepAt: (S.stepAt || []).join(','), err: s.errors };
    }, [cls, blind, process.env.STEP, process.env.PH, process.env.ONLY, !!process.env.REAL, !!process.env.GAPLOG]);
    console.log(cls + ' run ' + k + ': ' + r.state + '  cues ' + r.cues + '  ovations ' + r.ovations + '  recasts ' + r.recasts + '  steps@ ' + r.stepAt + (r.err && r.err.length ? '  ERR ' + JSON.stringify(r.err).slice(0, 300) : ''));
    for (const l of r.steps) console.log('    ' + l);
  }
  await browser.close();
})();
