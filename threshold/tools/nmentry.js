// node nmentry.js [classes] : Issen Nightmare from a normal entry with the intro (never skipintro): real rendered frames until the
// fight starts, then the level-3 autopilot (god mode) to the end. One line per class: result, fight time, errors, Niten step times.
const { launch } = require('./harness.js');
(async () => {
  for (const cls of (process.argv[2] || 'stormcaller,hexslinger,ashwarden,duskblade').split(',')) {
    const { browser, page } = await launch({ w: 480, h: 270 });
    await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=11&boss=duelist&nm=1&class=' + cls);
    await page.waitForFunction('window.__game && window.__game.G.state === "fight"', null, { timeout: 120000 });
    await page.evaluate((cls) => { const g = window.__game; if (g.G.player.cls.id !== cls) console.log('class ' + g.G.player.cls.id); g.god(true); g.bot(3); }, cls);
    await page.waitForTimeout(3000); // a few real rendered frames of the fight
    const r = await page.evaluate(() => { const g = window.__game; let s; for (let i = 0; i < 260; i++) { s = g.fastForward(2); if (s.state !== 'fight') break; } const b = g.G.boss; return Object.assign(s, { cls: g.G.player.cls.id, steps: (b.state.stepAt || []).join(','), log: (b.phaseLog || []).map((q) => q && Math.round(q.time)) }); });
    console.log(JSON.stringify(r));
    await browser.close();
  }
})();
