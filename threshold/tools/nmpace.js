// node nmpace.js <boss> [classes|all] [runs] : Nightmare pace. Plays whole fights from phase 1 with the level-3 autopilot (seeded,
// god mode by default) and reports per run: kill time or OUT (the last blow killed the god-mode player: it pierces god mode),
// each phase's live time and damage per second (b.phaseLog), the last phase's share of the fight's time, the highest ramp step
// reached and the fight time each step started (S.stepAt, written by the boss file), and in REAL mode the death and its source.
// REAL=1: god mode off (survival). PASSIVE=1: the autopilot never attacks. SWAPBLIND=1: ignores who is awake in Niten (must fail).
// SIDEBLIND=1: ignores the called half in Chiaroscuro (must fail). SEED sets the page seed (runs continue one random stream).
const { launch } = require('./harness.js');
(async () => {
  const [boss = 'duelist', clsArg = 'all', runs = '4'] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const classes = await page.evaluate((c) => c === 'all' ? window.__game.G.classes.map((q) => q.id) : c.split(','), clsArg);
  const env = { passive: !!process.env.PASSIVE, real: !!process.env.REAL, swap: !!process.env.SWAPBLIND, side: !!process.env.SIDEBLIND, seed: +(process.env.SEED || 7) };
  const fmt = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  let info = null;
  for (const cls of classes) {
    const rows = [];
    for (let k = 0; k < +runs; k++) {
      // one page evaluation per run keeps each call short
      const r = await page.evaluate(([boss, cls, env, k]) => {
        const g = window.__game, def = g.def(boss); g.G.headless = true; g.bot(3); g.god(!env.real);
        g.Bot.passive = env.passive; g.Bot.swapBlind = env.swap; g.Bot.sideBlind = env.side;
        g.start(boss, { cls }); const b = g.G.boss; let s;
        for (let i = 0; i < 260; i++) { s = g.fastForward(2); if (s.state !== 'fight') break; }
        const S = b.state, L = b.phaseLog || [], n = def.phases.length;
        const out = { state: s.state, t: s.t, src: s.src, hp: s.hp, boss: s.boss, err: s.errors, ph: L.map((q) => q && { t: q.time, dps: Math.round(q.dmg / Math.max(1, q.time)) }), stepAt: (S.stepAt || []).slice(), info: { hp: def.hp, enrage: def.enrage, n }, lastBlow: !!b.lastBlowing };
        g.god(false); g.Bot.passive = g.Bot.swapBlind = g.Bot.sideBlind = false; return out;
      }, [boss, cls, env, k]);
      info = r.info; rows.push(r);
      const tot = r.ph.reduce((a, q) => a + (q ? q.t : 0), 0), last = r.ph[r.info.n - 1];
      const share = last && tot ? Math.round(last.t / tot * 100) + '%' : '-';
      const res = r.state === 'win' ? fmt(r.t) : r.state === 'dead' && r.src === 'enrage' ? 'OUT ' + (r.lastBlow ? '(blow)' : '(pulse)') + ' ' + fmt(r.t) : r.state === 'dead' ? 'DEAD ' + fmt(r.t) + ' ' + (typeof r.src === 'string' ? r.src : JSON.stringify(r.src)) + ' boss ' + r.boss + '%' : r.state + ' ' + fmt(r.t);
      const steps = r.stepAt.map((t, i) => t === undefined || t === null ? null : i + '@' + fmt(t)).filter(Boolean).join(' ');
      console.log(cls.padEnd(12) + res.padEnd(34) + r.ph.map((q, i) => q ? `P${i + 1} ${String(Math.round(q.t)).padStart(3)}s ${String(q.dps).padStart(3)}` : `P${i + 1}   -`).join(' | ') + `  last ${share}  steps ${steps}` + (r.err && r.err.length ? '  ERR ' + JSON.stringify(r.err).slice(0, 200) : ''));
    }
    const wins = rows.filter((r) => r.state === 'win').map((r) => r.t).sort((a, b) => a - b);
    const med = wins.length ? wins[Math.floor((wins.length - 1) / 2)] : null;
    console.log(`  ${cls}: ${wins.length}/${rows.length} kills` + (wins.length ? `, median ${fmt(med)}, best ${fmt(wins[0])}, worst ${fmt(wins[wins.length - 1])}` : '') + `, max step ${Math.max(-1, ...rows.map((r) => r.stepAt.length - 1))}`);
  }
  console.log(`hp ${info.hp}  enrage ${info.enrage} s`);
  await browser.close();
})();
