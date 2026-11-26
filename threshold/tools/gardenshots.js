// node gardenshots.js <outDir> : Euryale's Nightmare at the moments to judge on a real GPU (TH_GPU=1 on Pat_PC; it also runs on
// SwiftShader, slowly and with a different look). The questions to answer from them: does "her shell is shut / cracked open" read
// without text (grey stone skin and a dark ring under her vs lit cracks and a lit arc, one segment per statue)? Does a statue
// rising from the floor read before it stands? Shots: the lesson (two statues rising in her lane), shell shut, shell open, a
// Behold about to fire with statues in the lane, the mirror, each garden ramp step, a floor rise, the garden cinematic, A Thousand
// Eyes (the last blow) and the kill. Moments are reached headless (god mode, health held). ONLY=name,name limits the list.
const { launch } = require('./harness.js');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || 'callshots'; fs.mkdirSync(out, { recursive: true }); const { browser, page } = await launch({ w: +(process.env.W || 1600), h: +(process.env.H || 900) });
  await page.goto('http://game.local/threshold/?mute=1&nm=1&seed=7' + (process.env.LOW ? '&quality=low' : ''));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const want = (n) => !process.env.ONLY || process.env.ONLY.split(',').includes(n);
  // start at a phase, then step (headless) until cond holds; hold = per-step tweak (ramp step, health floor)
  const go = async (name, ph, cond, o = {}) => {
    if (!want(name)) return;
    const ok = await page.evaluate(([ph, cond, o]) => { const g = window.__game, G = g.G; g.start('gorgon', { cls: o.cls || 'stormcaller', phase: ph }); g.god(true); g.bot(3);
      const b = G.boss, S = b.state, T = b.def.nmTest, f = new Function('b', 'S', 'g', 'G', 'return ' + cond); const floor = o.floor === undefined ? [0.89, 0.75, 0.11][ph] : o.floor;
      for (let i = 0; i < 6000; i++) { if (o.step !== undefined && S.finale) T.setStep(b, o.step); if (o.ft !== undefined && S.finale) G.ft = Math.max(G.ft, o.ft); b.hp = Math.max(b.hp, b.maxHp * floor); g.fastForward(0.05, false); if (!b.transitioning && f(b, S, g, G)) return true; }
      return false; }, [ph, cond, o]);
    if (!ok) { console.log('not reached', name); return; }
    await page.evaluate(() => window.__game.warm(0.6)); await page.waitForTimeout(400); await page.screenshot({ path: out + '/' + name + '.png' }); console.log('shot', name);
  };
  await go('a-lesson-rise', 0, 'S.rising.length === 2 && G.now > S.rising[0].at - 0.5');
  await go('b-lesson-risen', 0, 'G.ents.filter(e => e.isAdd && e.alive && !e.rising).length === 2 && b.castState && b.castState.name === "Behold"');
  await go('c-shell-shut', 0, 'G.ft > 12 && G.now > S.openUntil + 1 && !b.castState');
  await go('d-shell-open', 2, 'G.now < S.openUntil - 2.5 && S.crackK < 0.3 && !b.castState', { step: 0 });
  await go('e-behold-lane', 1, 'b.castState && b.castState.name === "Behold" && S.locked && G.ents.some(e => e.isAdd && e.alive)');
  for (let st = 0; st <= 5; st++) await go('f-step-' + st, 2, 'S.finale && S.gStep >= ' + st + ' && G.ents.filter(e => e.isAdd && e.alive).length >= ' + Math.min(3, 3 + Math.floor(st / 2)) + ' && b.castState && b.castState.name === "Behold"', { step: st });
  await go('g-floor-rise', 2, 'S.rising.length > 0 && G.now > S.rising[0].at - 0.6', { step: 3 });
  await go('h-thousand-eyes', 2, 'b.lastBlowing && S.lastEyes > 0.7', { ft: 370, step: 4 });
  // the garden cinematic and the kill play with real frames (cinematics only run when not headless)
  if (want('i-garden-enter')) { await page.evaluate(() => { const g = window.__game, G = g.G; g.start('gorgon', { cls: 'stormcaller', phase: 1 }); g.god(true); g.bot(3); const b = G.boss; for (let i = 0; i < 200; i++) g.fastForward(0.05, false); G.headless = false; b.hp = b.maxHp * 0.74 - 5; });
    await page.waitForTimeout(2200); await page.screenshot({ path: out + '/i-garden-enter-1.png' }); await page.waitForTimeout(2000); await page.screenshot({ path: out + '/i-garden-enter-2.png' }); console.log('shot i-garden-enter'); }
  if (want('j-kill')) { await page.evaluate(() => { const g = window.__game, G = g.G; g.start('gorgon', { cls: 'stormcaller', phase: 2 }); g.god(true); g.bot(3); for (let i = 0; i < 300; i++) g.fastForward(0.05, false); G.headless = false; G.boss.hp = 1; G.boss.dmgTaken = 1; G.boss.damage(50, { src: 'player' }); });
    await page.waitForTimeout(1600); await page.screenshot({ path: out + '/j-kill-1.png' }); await page.waitForTimeout(1600); await page.screenshot({ path: out + '/j-kill-2.png' }); console.log('shot j-kill'); }
  await browser.close();
})();
