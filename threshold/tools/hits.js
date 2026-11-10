// node hits.js <boss> <class> <lvl> [phase] : one run, prints the hit log
const { launch } = require('./harness.js');
(async () => {
  const [boss, cls, lvl, phase] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=' + (process.env.SEED || 5));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate(([boss, cls, lvl, phase]) => { const g = window.__game; g.G.headless = true; g.G.hitLog = []; g.bot(+lvl); g.start(boss, { cls, phase: +phase || 0 }); let s; for (let k = 0; k < 120; k++) { s = g.fastForward(5); if (s.state !== 'fight') break; } return [JSON.stringify(s), g.G.hitLog.join(' | ')]; }, [boss, cls, lvl, phase]);
  console.log(r.join('\n'));
  await browser.close();
})();
