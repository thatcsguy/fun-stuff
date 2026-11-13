// node festshot.js <outPrefix> [class] [seed] : door XIV after a full normal entry (intro plays, no skipintro).
// Shots: a two-spark volley right after one spark is stamped (white-hot lock), its ground shapes landing, and act 3 with the dragon spiral.
const { launch } = require('./harness.js');
(async () => {
  const [out, cls, seed] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 1280, h: 720 });
  await page.goto('http://game.local/threshold/?mute=1&god&seed=' + (seed || 5)); page.setDefaultTimeout(300000);
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 180000, polling: 250 });
  // a normal start (title card and intro camera shot play out), stepped with effects on instead of in real time
  console.log('intro', await page.evaluate((cls) => { const g = window.__game, G = g.G; g.god(true); g.start('festival', { cls, skipIntro: false }); const seen = []; for (let i = 0; i < 600 && G.state !== 'fight'; i++) { if (!seen.includes(G.state)) seen.push(G.state); g.warm(0.05); } return seen.join('>') + '>' + G.state; }, cls || 'duskblade'));
  await page.evaluate('document.getElementById("fade").style.transition="none"');
  const shot = async (name) => { await page.evaluate(() => new Promise((r) => { let k = 0; const f = () => (++k >= 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })); await page.screenshot({ path: out + name + '.png' }); console.log('shot', name, JSON.stringify(await page.evaluate('window.__game.state()'))); };
  const until = (cond, max = 120) => page.evaluate(([c, max]) => { const g = window.__game, G = g.G, S = G.boss.state, f = new Function('G', 'S', 'return ' + c); for (let i = 0; i < max * 10 && !f(G, S); i++) g.warm(0.1); return f(G, S); }, [cond, max]);
  // phase 1: wait for the first volley with two or more sparks, two seconds into its fuse
  console.log(await until('S.vol && S.vol.sparks.length >= 2 && G.now > S.vol.arrive - S.vol.T + 2.5', 200));
  // stamp the first spark by standing on it, then step back so both sparks are in frame
  await page.evaluate(() => { const G = window.__game.G, S = G.boss.state, V = S.vol, p = G.player, sp = V.sparks[0]; p.pos.x = sp.m.position.x; p.pos.z = sp.m.position.z; window.__game.warm(0.1); const o = V.sparks.find((x) => x.alive); if (o) { p.pos.x = (sp.m ? sp.m.position.x : p.pos.x) * 0.5 + o.m.position.x * 0.5 + 2; p.pos.z = o.m.position.z * 0.5 + p.pos.z * 0.5 + 2; } window.__game.warm(0.4); return !!V.lock; });
  await shot('-lock');
  await until('S.vol && G.now > S.vol.land - S.vol.warn + 0.25', 20); await shot('-land');
  // act 3 (reached by damage, the normal way): first dragon volley
  await page.evaluate(() => { const b = window.__game.G.boss; b.hp = b.maxHp * 0.32; });
  console.log(await until('S.lvl === 2 && S.vol && S.vol.arch === "D" && G.now > S.vol.arrive - S.vol.T + 2', 400));
  await shot('-dragon');
  await until('S.vol && G.now > S.vol.land - S.vol.warn + 0.25', 20); await shot('-dragonland');
  await browser.close();
})();
