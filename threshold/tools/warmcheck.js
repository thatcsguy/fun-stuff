// node warmcheck.js [boss...] : starts each fight with the real (non-headless) loading path and prints the rehearsal/warm-up stats.
const { launch } = require('./harness.js');
(async () => {
  const { browser, page } = await launch({ w: 320, h: 180 });
  await page.goto('http://game.local/threshold/?mute=1&quality=high&seed=3');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : await page.evaluate(() => window.__game.G.bosses.map((d) => d.id));
  for (const id of ids) {
    const r = await page.evaluate(async (id) => {
      const g = window.__game, t0 = performance.now(); g.G.errors.length = 0; g.start(id, { skipIntro: true });
      for (let i = 0; i < 5; i++) await new Promise((res) => requestAnimationFrame(res));
      return { total: Math.round(performance.now() - t0), stats: g.G.warmStats, state: g.state(), progs: g.renderer.info.programs.length, errors: g.G.errors.slice(0, 3) };
    }, id);
    console.log(id, JSON.stringify(r));
  }
  await browser.close();
})();
