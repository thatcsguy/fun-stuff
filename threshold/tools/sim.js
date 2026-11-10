// node sim.js <boss> <class> <botLevel> [runs] [maxSec] [phase]
const { launch } = require('./harness.js');
(async () => {
  const [boss, cls, lvl, runs, maxSec, phase] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  for (let i = 0; i < +(runs || 1); i++) {
    const r = await page.evaluate(([boss, cls, lvl, maxSec, phase]) => {
      const g = window.__game; g.G.headless = true; g.bot(+lvl); g.start(boss, { cls, phase: +phase || 0 });
      const marks = []; let last = -1, out;
      for (let k = 0; k < (+maxSec || 600) / 5; k++) { out = g.fastForward(5); if (out.phase !== last) { last = out.phase; marks.push('p' + out.phase + '@' + out.t); } if (out.state !== 'fight') break; }
      out.marks = marks.join(' '); return out;
    }, [boss, cls, lvl, maxSec, phase]);
    console.log(JSON.stringify(r));
  }
  await browser.close();
})();
