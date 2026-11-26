// node callshots.js <outDir> : the Impresario Nightmare at the moments to judge on a real GPU (TH_GPU=1 on Pat_PC; it also runs on
// SwiftShader, slowly and with a different look). The questions to answer from them: does "the lead doll is in his light" read
// without text (gate open vs closed, gold strings on the lead)? Can you find your mark in a dark Cue from the dolls' lights alone?
// Shots: the split opening, gate open and closed, a Recast mid-tell, the Final Call cinematic, each finale ramp step, a dark Cue,
// an Ovation, the Final Curtain and the kill. Moments are reached headless (god mode, health held). ONLY=name,name limits the list.
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
    const ok = await page.evaluate(([ph, cond, o]) => { const g = window.__game, G = g.G; g.start('theatre', { cls: o.cls || 'stormcaller', phase: ph }); g.god(true); g.bot(3);
      const b = G.boss, S = b.state, T = b.def.nmTest, f = new Function('b', 'S', 'g', 'G', 'return ' + cond); const floor = o.floor === undefined ? [0.86, 0.69, 0.11][ph] : o.floor;
      for (let i = 0; i < 6000; i++) { if (o.step !== undefined && S.finale) T.setStep(b, o.step); if (o.ft !== undefined && S.finale) G.ft = Math.max(G.ft, o.ft); b.hp = Math.max(b.hp, b.maxHp * floor); g.fastForward(0.05, false); if (!b.transitioning && f(b, S, g, G)) return true; }
      return false; }, [ph, cond, o]);
    if (!ok) { console.log('not reached', name); return; }
    await page.evaluate(() => window.__game.warm(0.6)); await page.waitForTimeout(400); await page.screenshot({ path: out + '/' + name + '.png' }); console.log('shot', name);
  };
  await go('a-split-opening', 0, 'G.ft > 3 && S.inLight');
  await go('b-gate-open', 1, 'S.inLight && !S.recast && !S.black && G.ft > 6 && S.lead === 1');
  await go('c-gate-closed', 1, '!S.inLight && !S.recast && !S.black && G.ft > 6 && S.dolls[1].on && !(G.now < S.ovUntil)');
  await go('d-recast-tell', 1, 'S.recast && G.now - S.recast.t0 > 0.7');
  await go('e-blackout-classic', 1, 'S.black && !S.black.cue && S.dark > 0.9');
  for (let st = 0; st <= 4; st++) await go('f-step-' + st, 2, 'S.finale && S.callStep >= ' + st + ' && !S.black && !S.recast && G.now > S.ovUntil && g.Hz.list.filter(h => h.state === "tele" && h.dmg).length > 0', { step: st });
  await go('g-cue-forgiving', 2, 'S.black && S.black.cue && S.black.faint !== undefined && S.dark > 0.9');
  await go('h-cue-dark', 2, 'S.black && S.black.cue && S.black.faint === undefined && S.dark > 0.9', { step: 2 });
  await go('i-ovation', 2, 'G.now < S.ovUntil - 2 && S.bow', { step: 1 });
  await go('j-curtain-call', 2, 'S.curtainOn && S.black && S.dark > 0.9', { step: 5 });
  await go('k-final-curtain', 2, 'b.lastBlowing && S.frontK > 0.5', { ft: 380, step: 4 });
  // the Final Call cinematic and the kill play with real frames (cinematics only run when not headless)
  if (want('l-final-call')) { await page.evaluate(() => { const g = window.__game, G = g.G; g.start('theatre', { cls: 'stormcaller', phase: 1 }); g.god(true); g.bot(3); const b = G.boss; for (let i = 0; i < 200; i++) g.fastForward(0.05, false); G.headless = false; b.hp = b.maxHp * 0.68 - 5; });
    await page.waitForTimeout(3500); await page.screenshot({ path: out + '/l-final-call-1.png' }); await page.waitForTimeout(1800); await page.screenshot({ path: out + '/l-final-call-2.png' }); console.log('shot l-final-call'); }
  if (want('m-kill')) { await page.evaluate(() => { const g = window.__game, G = g.G; g.start('theatre', { cls: 'stormcaller', phase: 2 }); g.god(true); g.bot(3); for (let i = 0; i < 300; i++) g.fastForward(0.05, false); G.headless = false; G.boss.hp = 1; G.boss.damage(50, { src: 'player' }); });
    await page.waitForTimeout(2600); await page.screenshot({ path: out + '/m-kill-1.png' }); await page.waitForTimeout(2200); await page.screenshot({ path: out + '/m-kill-2.png' }); console.log('shot m-kill'); }
  await browser.close();
})();
