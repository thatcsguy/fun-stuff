// node tank.js <boss> <class> <lvl> [hpMult] : one run with a tanky bot; totals damage by source and phase times
const { launch } = require('./harness.js');
(async () => {
  const [boss, cls, lvl, mult] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=' + (process.env.SEED || 5));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate(([boss, cls, lvl, mult]) => { const g = window.__game; g.G.headless = true; g.G.hitLog = []; g.bot(+lvl); g.start(boss, { cls }); const p = g.G.player; p.maxHp = p.hp = 1000 * (+mult || 5); let s, last = -1, marks = []; for (let k = 0; k < 120; k++) { s = g.fastForward(5); if (s.phase !== last) { last = s.phase; marks.push('p' + s.phase + '@' + s.t); } if (s.state !== 'fight') break; }
    const tot = {}; for (const l of g.G.hitLog) { const m = l.split(' '); const amt = +m.pop(); m.shift(); const n = m.join(' '); tot[n] = (tot[n] || 0) + amt; }
    return s.state + ' t=' + s.t + ' boss=' + s.boss + ' taken=' + s.taken + ' ' + marks.join(' ') + ' ' + JSON.stringify(tot) + ' ' + JSON.stringify(s.errors); }, [boss, cls, lvl, mult]);
  console.log(boss, cls, r);
  await browser.close();
})();
