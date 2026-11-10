// node smoke.js <boss> : every phase x both classes with god mode, reports errors
const { launch } = require('./harness.js');
(async () => {
  const boss = process.argv[2];
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=3');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate((boss) => {
    const g = window.__game, out = []; g.G.headless = true; g.bot(3); g.god(true);
    const n = g.G.bosses.find((d) => d.id === boss).phases.length;
    for (const cls of ['duskblade', 'stormcaller']) for (let ph = 0; ph < n; ph++) { g.start(boss, { cls, phase: ph }); let s; const b = g.G.boss; for (let k = 0; k < 20; k++) { s = g.fastForward(5); b.hp = Math.max(b.hp, b.maxHp * (ph + 1 < n ? b.def.phases[ph + 1].at + 0.01 : 0.02)); } out.push(cls + ' p' + ph + ': t=' + s.t + ' taken=' + s.taken + ' dps=' + s.dps + ' err=' + JSON.stringify(s.errors)); }
    g.god(false); return out;
  }, boss);
  console.log(r.join('\n'));
  await browser.close();
})();
