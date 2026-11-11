const { launch } = require('./harness.js');
(async () => {
  const [boss, cls, expr, secs, phase] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=7');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate(([boss, cls, expr, secs, phase]) => {
    const g = window.__game; g.G.headless = true; g.bot(3); g.start(boss, { cls, phase: +phase || 0 }); const out = []; const f = new Function('g', 'G', 'b', 'p', 'S', 'return ' + expr);
    for (let k = 0; k < +secs * 2; k++) { const s = g.fastForward(0.5); out.push(s.t + ' hp' + s.hp + ' ' + JSON.stringify(f(g, g.G, g.G.boss, g.G.player, g.G.boss.state))); if (s.state !== 'fight') break; }
    return out;
  }, [boss, cls, expr, secs, phase]);
  console.log(r.join('\n')); await browser.close();
})();
