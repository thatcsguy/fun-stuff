// node nmclock.js <boss> [classes|all] [runs] : nightmare phase clocks. For each class and each phase, starts the fight at that
// phase (god mode, level-3 autopilot) and plays it until the phase ends, then reports the time used against the budget.
// "OUT" = the clock ran out (the overtime blow killed the god-mode player; it pierces god mode on purpose).
// PASSIVE=1: the autopilot never attacks (the clock must run out in every phase).
// RAW=1: lifts every budget to 999 s for the run, to measure how long each phase really takes (for tuning).
const { launch } = require('./harness.js');
(async () => {
  const [boss = 'duelist', clsArg = 'all', runs = '2'] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate(([boss, clsArg, runs, passive, raw]) => {
    const g = window.__game, def = g.def(boss), n = def.phases.length, out = [], keep = def.phases.map((p) => p.budget);
    if (raw) def.phases.forEach((p) => { p.budget = 999; });
    const classes = clsArg === 'all' ? g.G.classes.map((c) => c.id) : clsArg.split(',');
    g.G.headless = true; g.bot(3); g.god(true); g.Bot.passive = passive;
    for (const cls of classes) {
      const row = { cls, ph: [] };
      for (let ph = 0; ph < n; ph++) {
        const res = [];
        for (let k = 0; k < runs; k++) {
          g.start(boss, { cls, phase: ph }); const b = g.G.boss; let s;
          for (let i = 0; i < 60; i++) { s = g.fastForward(2); if (s.state !== 'fight' || b.phase !== ph) break; }
          const q = (b.phaseLog || [])[ph] || { time: +(b.phaseT || 0).toFixed(1), budget: def.phases[ph].budget, over: !!b.overtime };
          res.push({ time: q.time, budget: q.budget, over: q.over || (s.state === 'dead' && s.src === 'enrage'), dps: Math.round((q.dmg || 0) / Math.max(1, q.time)), state: s.state, src: s.src, err: s.errors });
        }
        row.ph.push(res);
      }
      out.push(row);
    }
    g.god(false); g.Bot.passive = false; def.phases.forEach((p, i) => { p.budget = keep[i]; }); return { out, budgets: keep };
  }, [boss, clsArg, +runs, !!process.env.PASSIVE, !!process.env.RAW]);
  console.log('budgets ' + r.budgets.join(' / ') + ' s');
  for (const row of r.out) {
    console.log(row.cls.padEnd(12) + row.ph.map((res, i) => {
      const worst = res.reduce((a, q) => (q.over ? 1e9 : q.time) > (a.over ? 1e9 : a.time) ? q : a, res[0]), bud = r.budgets[i];
      const left = Math.round((1 - worst.time / bud) * 100);
      return `P${i + 1} ${res.map((q) => q.over ? 'OUT' : q.time.toFixed(0)).join(',').padStart(7)} ${worst.over ? '  OUT' : (left + '%').padStart(5)} left ${String(Math.round(res.reduce((a, q) => a + q.dps, 0) / res.length)).padStart(3)} dps${res.some((q) => q.err && q.err.length) ? ' ERR ' + JSON.stringify(res.find((q) => q.err.length).err).slice(0, 160) : ''}`;
    }).join(' | '));
  }
  await browser.close();
})();
