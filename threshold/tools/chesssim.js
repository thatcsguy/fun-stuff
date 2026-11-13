// node tools/chesssim.js <class> [runs] [mode] : door `chess` autopilot fights (bot level 3, headless). mode 'nocheck' makes the
// bot walk to safe squares that do NOT give check, which should lose. Prints result, time, and Gambit outcomes (check/struck/refuted).
const { launch } = require('./harness.js');
(async () => {
  const [cls, runs, mode] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  for (let i = 0; i < +(runs || 1); i++) {
    const r = await page.evaluate(([cls, mode]) => {
      const g = window.__game; g.G.headless = true; g.G.chessBot = mode || ''; g.bot(3); g.start('chess', { cls });
      const marks = []; let last = -1, out;
      for (let k = 0; k < 120; k++) { out = g.fastForward(5); if (out.phase !== last) { last = out.phase; marks.push('p' + out.phase + '@' + out.t); } if (out.state !== 'fight') break; }
      const L = g.G.boss.state.log, c = (x) => L.filter((y) => y === x).length;
      return { cls, state: out.state, t: out.t, hp: Math.round(g.G.boss.hp / g.G.boss.maxHp * 100) + '%', php: Math.round(g.G.player.hp), marks: marks.join(' '), gambits: L.length, check: c('check'), struck: c('struck'), refuted: c('refuted'), none: c('none') };
    }, [cls, mode]);
    console.log(JSON.stringify(r));
  }
  await browser.close();
})();
