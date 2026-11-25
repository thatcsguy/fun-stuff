// node nmpace.js <boss> [classes|all] [runs] : Nightmare pace. Plays whole fights from phase 1 with the level-3 autopilot (seeded,
// god mode by default) and reports per run: kill time or OUT (the last blow killed the god-mode player: it pierces god mode),
// each phase's live time and damage per second (b.phaseLog), the last phase's share of the fight's time, the highest ramp step
// reached and the fight time each step started (S.stepAt, written by the boss file), and in REAL mode the death and its source.
// REAL=1: god mode off (survival). PASSIVE=1: the autopilot never attacks. SWAPBLIND=1: ignores who is awake in Niten (must fail).
// SIDEBLIND=1: ignores the called half in Chiaroscuro (must fail). SEED sets the page seed (runs continue one random stream).
// POCKETBLIND=1: ignores the calm-spot hints (Niten's cut lanes and Eye of the Moon; compare its petal damage with the normal autopilot).
// CAST BUDGET (boss duelist, Niten only): per ramp step, the share of live Niten time the player spends in a planted cast ("cast"),
// planted casts completed per minute ("done/min") and petal damage taken per minute. Printed per run and summed per class.
// "cast" counts every planted cast, also the ones cancelled by moving; "(finished)" counts only casts that completed.
// Stormcaller, seeds 7/8/9 x 6 runs (step: cast% (finished%) / casts done per min):
//   main 17e769c, before Blade and Storm (28,000):  0: 71% (59%) 21.9   1: 72% (59%) 27.6   2: 67% (55%) 21.2   3: 66% (55%) 25.4
//                                                   (step 4 is only a few seconds of Tempest burn right before the kill: 86%, 50/m)
//   Blade and Storm (30,500):  0: 63% (56%) 25.1   1: 74% (67%) 27.5   2: 63% (56%) 24.7   3: 58% (50%) 22.5   4: 61% (56%) 21.5
//   Step 3 in whole fights is mostly the twin Final Verse plus the guaranteed Twin Petal Storm at 12% health (fast kills end in
//   step 3). Held at one step for 37 s (tools/nitencast.js STEP=n ONLY=n), main / new: step 3 65-67% / 61-70%, step 4 65-67% / 60-65%,
//   step 5 60-62% / 61-66%.
const { launch } = require('./harness.js');
(async () => {
  const [boss = 'duelist', clsArg = 'all', runs = '4'] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const classes = await page.evaluate((c) => c === 'all' ? window.__game.G.classes.map((q) => q.id) : c.split(','), clsArg);
  const env = { pocket: !!process.env.POCKETBLIND, passive: !!process.env.PASSIVE, real: !!process.env.REAL, swap: !!process.env.SWAPBLIND, side: !!process.env.SIDEBLIND, seed: +(process.env.SEED || 7) };
  const fmt = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  let info = null; const agg = {};
  const cbFmt = (c) => c.map((q, st) => q && q[0] > 1 ? `${st}: ${Math.round(q[1] / q[0] * 100)}% (${Math.round(q[4] / q[0] * 100)}%) ${(q[2] / q[0] * 60).toFixed(1)}/m ${Math.round(q[3] / q[0] * 60)}pd` : null).filter(Boolean).join('  ');
  for (const cls of classes) {
    const rows = [];
    for (let k = 0; k < +runs; k++) {
      // one page evaluation per run keeps each call short
      const r = await page.evaluate(([boss, cls, env, k]) => {
        const g = window.__game, def = g.def(boss); g.G.headless = true; g.bot(3); g.god(!env.real);
        g.Bot.passive = env.passive; g.Bot.swapBlind = env.swap; g.Bot.sideBlind = env.side; g.Bot.pocketBlind = env.pocket;
        g.start(boss, { cls }); const b = g.G.boss, p = g.G.player; let s;
        // cast budget: per Niten ramp step [live time, time in a planted cast, planted casts completed, petal damage, time in casts that completed]
        const cb = []; const at = () => (b.state.niten && !b.transitioning && g.G.state === 'fight') ? (cb[b.state.nitenStep] || (cb[b.state.nitenStep] = [0, 0, 0, 0, 0])) : null;
        let lastC = null; const com = p.commit.bind(p); p.commit = (i, tgt, wasCast) => { const c = at(); if (c && wasCast) { c[2]++; if (lastC) c[4] += lastC.time; } return com(i, tgt, wasCast); };
        const hu = p.hurt.bind(p); p.hurt = (amt, o) => { const c = at(), hp0 = p.hp; const r = hu(amt, o); if (c && o && o.src && o.src.petal) c[3] += Math.max(0, hp0 - p.hp) || amt; return r; };
        const onStep = (dt) => { lastC = p.casting; const c = at(); if (!c) return; c[0] += dt; if (p.casting) c[1] += dt; };
        for (let i = 0; i < 260; i++) { s = g.fastForward(2, true, onStep); if (s.state !== 'fight') break; }
        const S = b.state, L = b.phaseLog || [], n = def.phases.length;
        const out = { state: s.state, t: s.t, src: s.src, hp: s.hp, boss: s.boss, err: s.errors, ph: L.map((q) => q && { t: q.time, dps: Math.round(q.dmg / Math.max(1, q.time)) }), stepAt: (S.stepAt || []).slice(), info: { hp: def.hp, enrage: def.enrage, n }, lastBlow: !!b.lastBlowing, cb };
        g.god(false); g.Bot.passive = g.Bot.swapBlind = g.Bot.sideBlind = g.Bot.pocketBlind = false; return out;
      }, [boss, cls, env, k]);
      info = r.info; rows.push(r);
      for (let st = 0; st < r.cb.length; st++) if (r.cb[st]) { const A = agg[cls] || (agg[cls] = []), q = A[st] || (A[st] = [0, 0, 0, 0, 0]); for (let j = 0; j < 5; j++) q[j] += r.cb[st][j]; }
      const tot = r.ph.reduce((a, q) => a + (q ? q.t : 0), 0), last = r.ph[r.info.n - 1];
      const share = last && tot ? Math.round(last.t / tot * 100) + '%' : '-';
      const res = r.state === 'win' ? fmt(r.t) : r.state === 'dead' && r.src === 'enrage' ? 'OUT ' + (r.lastBlow ? '(blow)' : '(pulse)') + ' ' + fmt(r.t) : r.state === 'dead' ? 'DEAD ' + fmt(r.t) + ' ' + (typeof r.src === 'string' ? r.src : JSON.stringify(r.src)) + ' boss ' + r.boss + '%' : r.state + ' ' + fmt(r.t);
      const steps = r.stepAt.map((t, i) => t === undefined || t === null ? null : i + '@' + fmt(t)).filter(Boolean).join(' ');
      console.log(cls.padEnd(12) + res.padEnd(34) + r.ph.map((q, i) => q ? `P${i + 1} ${String(Math.round(q.t)).padStart(3)}s ${String(q.dps).padStart(3)}` : `P${i + 1}   -`).join(' | ') + `  last ${share}  steps ${steps}` + (r.cb.length ? '\n    cast ' + cbFmt(r.cb) : '') + (r.err && r.err.length ? '  ERR ' + JSON.stringify(r.err).slice(0, 200) : ''));
    }
    const wins = rows.filter((r) => r.state === 'win').map((r) => r.t).sort((a, b) => a - b);
    const med = wins.length ? wins[Math.floor((wins.length - 1) / 2)] : null;
    console.log(`  ${cls}: ${wins.length}/${rows.length} kills` + (wins.length ? `, median ${fmt(med)}, best ${fmt(wins[0])}, worst ${fmt(wins[wins.length - 1])}` : '') + `, max step ${Math.max(-1, ...rows.map((r) => r.stepAt.length - 1))}`);
    if (agg[cls]) console.log(`  ${cls} cast budget (step: cast% (in casts that finished) / casts done per min / petal dmg per min): ` + cbFmt(agg[cls]));
  }
  console.log(`hp ${info.hp}  enrage ${info.enrage} s`);
  await browser.close();
})();
