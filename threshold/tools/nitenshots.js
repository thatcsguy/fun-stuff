// node nitenshots.js <outDir> : Issen Nightmare's Niten (Blade and Storm) at the moments to judge on a real GPU (TH_GPU=1): one shot
// per ramp step with the Lighthouse Storm blowing, a cut lane mid-storm, the Eye of the Moon, and Twin Petal Storm. The question to
// answer from them: can you see where the calm spot is at a glance? Since options A + B also: standing ghosts under the storm,
// a Waking Cut mid-tell (can you see your wedge?), Twin Petal Storm with the ghost lines calm, and a Final Verse still moment. Moments are reached headless (god mode, health held at 20%).
const { launch } = require('./harness.js');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || 'nitenshots'; fs.mkdirSync(out, { recursive: true }); const { browser, page } = await launch({ w: +(process.env.W || 1600), h: +(process.env.H || 900) });
  await page.goto('http://game.local/threshold/?mute=1&nm=1&seed=7' + (process.env.LOW ? '&quality=low' : ''));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  await page.evaluate(() => { const g = window.__game; g.start('duelist', { cls: 'stormcaller', phase: 3 }); g.god(true); g.bot(3); });
  const go = async (name, cond, step) => {
    const ok = await page.evaluate(([cond, step]) => { const g = window.__game, b = g.G.boss, S = b.state; const f = new Function('b', 'S', 'g', 'return ' + cond);
      for (let i = 0; i < 4000; i++) { if (step !== null && S.niten) S.nitenT = Math.max(S.nitenT, step * 35 + 0.5); b.hp = Math.max(b.hp, b.maxHp * 0.2); g.fastForward(0.05, false); if (S.niten && f(b, S, g)) return true; } return false; }, [cond, step]);
    if (!ok) { console.log('not reached', name); return; }
    await page.evaluate(() => window.__game.warm(0.6)); await page.waitForTimeout(400); await page.screenshot({ path: out + '/' + name + '.png' }); console.log('shot', name);
  };
  // (the storm never sleeps + standing cuts build): ONLY=name,name limits the list
  const want = (n) => !process.env.ONLY || process.env.ONLY.split(',').includes(n);
  for (const st of [0, 2, 4]) if (want('step-' + st)) await go('step-' + st, "S.storm === 'on' && S.nitenStep >= " + st + " && g.Bul.list.filter(q=>q.storm).length > 20", st);
  if (want('a-standing-ghosts')) await go('a-standing-ghosts', "S.storm === 'on' && S.ghosts.filter(q=>q.cut).length >= 4 && S.lanes.length > 0", 3);
  if (want('b-waking-cut')) await go('b-waking-cut', "S.waking && S.waking.n >= 4 && g.G.now - (S.wakeT || (S.wakeT = g.G.now)) > 0.8 || (S.waking ? false : (S.wakeT = 0))", 4);
  if (want('c-twin-storm-ghosts')) await go('c-twin-storm-ghosts', "S.unison && b.group.visible && S.lanes.length > 0 && g.Bul.list.filter(q=>q.petal && !q.storm).length > 40", 4);
  if (want('d-eye')) await go('d-eye', "S.eye && g.G.now - S.eye.t0 > 0.7 && S.storm === 'on'", 2);
  if (want('e-verse-rest')) await go('e-verse-rest', "S.verse && S.lead && S.lead.ent.targetable", 3);
  await browser.close();
})();
