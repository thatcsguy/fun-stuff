// node callentry.js [classes] : Euryale's Nightmare from a normal entry with the intro (never skipintro): real rendered frames
// through the intro until the fight starts (the Nightmare pieces are built and hidden: shell ring, extra statues, no keeper yet),
// a few seconds of the fight with real frames (the lesson statues rise in her lane and the first Behold fires), then the level-3
// autopilot (god mode) to the end. One line per class: result, fight time, errors, phase times, garden step times. This is the
// check that the opening works from a normal entry, never skipintro (door VI's black screen once hid behind skipintro).
const { launch } = require('./harness.js');
(async () => {
  for (const cls of (process.argv[2] || 'stormcaller,hexslinger,ashwarden,duskblade').split(',')) {
    const { browser, page } = await launch({ w: 480, h: 270 });
    await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=11&boss=gorgon&nm=1&class=' + cls);
    await page.waitForFunction('window.__game && window.__game.G.state === "intro"', null, { timeout: 120000 });
    const intro = await page.evaluate(() => { const S = window.__game.G.boss.state; return { nm: !!S.nmOn, want: S.want, awake: window.__game.G.ents.filter((e) => e.isAdd && e.alive).length, pool: S.pool.length, shell: !!S.shell, phase: window.__game.G.boss.phase }; });
    await page.waitForFunction('window.__game && window.__game.G.state === "fight"', null, { timeout: 120000 });
    await page.evaluate((cls) => { const g = window.__game; if (g.G.player.cls.id !== cls) console.log('class ' + g.G.player.cls.id); g.god(true); g.bot(3); }, cls);
    await page.waitForTimeout(9000); // real rendered frames of the fight: the lesson and the first Behold
    const early = await page.evaluate(() => { const S = window.__game.G.boss.state; return { fed: S.fedLog.slice(), awake: window.__game.G.ents.filter((e) => e.isAdd && e.alive).length, open: window.__game.G.boss.dmgTaken }; });
    const r = await page.evaluate(() => { const g = window.__game; let s; for (let i = 0; i < 260; i++) { s = g.fastForward(2); if (s.state !== 'fight') break; } const b = g.G.boss; return Object.assign(s, { cls: g.G.player.cls.id, steps: (b.state.stepAt || []).join(','), log: (b.phaseLog || []).map((q) => q && Math.round(q.time)) }); });
    r.intro = intro; r.early = early; console.log(JSON.stringify(r));
    await browser.close();
  }
})();
