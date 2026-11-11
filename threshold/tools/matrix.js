// node matrix.js <class[,class...]|all> [runs] [boss,boss...] : level-3 autopilot attempts for every door x class, one summary line each.
// Use it to compare classes: wins, how far the boss got, average dps and damage taken.
// GOD=1 runs in god mode instead: the question becomes whether the class can finish every fight (adds, immunities,
// interrupts) before the enrage timer; a kill slower than the enrage is marked LATE.
const { launch } = require('./harness.js');
(async () => {
  const [clsArg = 'all', runs = '3', bossArg] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const info = await page.evaluate(() => ({ bosses: window.__game.G.bosses.map((d) => d.id), classes: window.__game.G.classes.map((c) => c.id) }));
  const classes = clsArg === 'all' ? info.classes : clsArg.split(','), bosses = bossArg ? bossArg.split(',') : info.bosses;
  const tot = {};
  for (const boss of bosses) {
    const row = [boss.padEnd(10)];
    for (const cls of classes) {
      const r = await page.evaluate(([boss, cls, runs, god]) => {
        const g = window.__game; g.G.headless = true; g.bot(3); g.god(god); const enr = g.G.bosses.find((d) => d.id === boss).enrage || 1e9; let wins = 0, left = 0, dps = 0, taken = 0, t = 0; const err = new Set();
        for (let i = 0; i < runs; i++) { g.start(boss, { cls }); let out; for (let k = 0; k < 120; k++) { out = g.fastForward(5); if (out.state !== 'fight') break; }
          if (out.state === 'win' && out.t <= enr) wins++; left += out.boss; dps += out.dps; taken += out.taken; t += out.t; out.errors.forEach((e) => err.add(e)); }
        g.god(false); return { wins, left: left / runs, dps: dps / runs, taken: taken / runs, t: t / runs, enr, err: [...err] };
      }, [boss, cls, +runs, !!process.env.GOD]);
      const T = tot[cls] || (tot[cls] = { wins: 0, left: 0, dps: 0, n: 0 }); T.wins += r.wins; T.left += r.left; T.dps += r.dps; T.n++;
      row.push(`${cls.slice(0, 5)} ${r.wins}/${runs} left ${r.left.toFixed(0).padStart(2)}% dps ${r.dps.toFixed(0).padStart(3)} t ${r.t.toFixed(0).padStart(3)}${process.env.GOD ? '/' + r.enr + (r.wins < +runs ? ' LATE' : '') : ''}${r.err.length ? ' ERR ' + r.err.join('|').slice(0, 200) : ''}`);
    }
    console.log(row.join(' | '));
  }
  for (const c in tot) console.log(`TOTAL ${c}: wins ${tot[c].wins}/${tot[c].n * +runs}, avg boss left ${(tot[c].left / tot[c].n).toFixed(1)}%, avg dps ${(tot[c].dps / tot[c].n).toFixed(0)}`);
  await browser.close();
})();
