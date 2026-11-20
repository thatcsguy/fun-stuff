// node tools/gatesoak.js [classes|all] [runs] [botLevel] : door `portal` autopilot soak. Plays full fights (god mode, so every
// mechanic is seen through to the end) with different seeds and counts hits from the gate mechanics (walls, rings, Lockout),
// which a level-3 autopilot following the route solver must never take. Prints per class: hits by mechanic, kill times, trips.
// GATE=walk|dwell|jump picks the entry rule (?gate=). Exit code 1 if any gate-mechanic hit happened.
const { launch } = require('./harness.js');
const GATE_HITS = ['Slam', 'Iris', 'Double Doors', 'Rebound', 'Triptych', 'Lockout'];
(async () => {
  const [clsArg = 'all', runsArg = '20', lvlArg = '3'] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 }); page.setDefaultTimeout(0);
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=1' + (process.env.GATE ? '&gate=' + process.env.GATE : ''));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const classes = clsArg === 'all' ? await page.evaluate('window.__game.G.classes.map((c) => c.id)') : clsArg.split(',');
  let bad = 0;
  for (const cls of classes) {
    const r = await page.evaluate(([cls, runs, lvl, GH]) => {
      const g = window.__game, out = { hits: {}, times: [], trips: 0, other: 0, fails: [] };
      for (let i = 0; i < runs; i++) {
        g.G.rng = (() => { let a = 1000 + i * 7919; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
        g.G.headless = true; g.G.hitLog = []; g.G.hitDbg = g.G.hitDbg || []; g.bot(lvl); g.god(true); g.start('portal', { cls });
        let s; for (let k = 0; k < 100; k++) { s = g.fastForward(5); if (s.state !== 'fight') break; }
        // god mode swallows damage before it is logged, so count gate hits from the boss's own record instead
        const S = g.G.boss.state; out.trips += S.trips || 0;
        (S.hitNames || []).forEach((e, j) => { out.hits[e] = (out.hits[e] || 0) + 1; out.fails.push('run ' + i + ' ' + e + ' @' + S.hitTimes[j]); });
        out.times.push(s.state === 'win' ? s.t : -1);
      }
      g.god(false); out.dbg = g.G.hitDbg.splice(0); return out;
    }, [cls, +runsArg, +lvlArg, GATE_HITS]);
    const n = Object.values(r.hits).reduce((a, b) => a + b, 0); if (n) bad++;
    const won = r.times.filter((t) => t > 0), avg = won.length ? won.reduce((a, b) => a + b, 0) / won.length : 0;
    console.log(`${cls.padEnd(12)} gate hits ${n} ${JSON.stringify(r.hits)}  kills ${won.length}/${r.times.length} avg ${avg.toFixed(0)} s (max ${Math.max(...r.times).toFixed(0)})  trips/fight ${(r.trips / r.times.length).toFixed(1)}`);
    if (n) console.log('   ', r.fails.slice(0, 8).join(' | '));
    if (process.env.DBG && r.dbg.length) console.log('   ', r.dbg.join(' | '));
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
