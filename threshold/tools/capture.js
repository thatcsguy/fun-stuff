// node capture.js <boss> <outDir> [class] [shotsPerPhase]
// The last shot of each phase uses a cinematic camera behind the player aimed at the boss, to show the boss and arena.
// Screenshots several moments of every phase of one fight (god mode + autopilot), for visual review.
const { launch } = require('./harness.js');
const fs = require('fs'), path = require('path');
(async () => {
  const [boss, out, cls = 'duskblade', per = '2'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const { browser, page } = await launch({ w: 1280, h: 720 }); page.setDefaultTimeout(300000);
  await page.goto('http://game.local/threshold/?mute=1&god=1&bot=3&quality=high&class=' + cls + '&boss=' + boss + '&skipintro=1');
  await page.waitForFunction('window.__game && window.__game.G.state === "fight"', null, { timeout: 300000 });
  await page.evaluate('document.getElementById("fade").style.transition="none"');
  const nPh = await page.evaluate('window.__game.G.boss.def.phases.length');
  const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
  const files = [];
  for (let ph = 0; ph < nPh; ph++) {
    await page.evaluate(([b, c, ph]) => { window.__game.start(b, { cls: c, phase: ph }); }, [boss, cls, ph]);
    await frames(20);
    for (let k = 0; k < +per; k++) {
      const ff = k === 0 ? 5 + ph : 9 + k * 5;
      // run most of the gap headless, then the last 1.5 s with effects on (no rendering), so particles/telegraphs are live in the shot
      await page.evaluate((s) => { const g = window.__game; g.fastForward(Math.max(0, s - 1.5), false); g.warm(1.5);
        if (g.G.boss && g.G.boss.hp < g.G.boss.maxHp * 0.02) g.G.boss.hp = g.G.boss.maxHp * 0.5; }, ff);
      if (k === +per - 1 && +per > 1) await page.evaluate(() => { const g = window.__game, C = g.Cam, p = g.G.player, b = g.G.boss, V = p.pos.constructor;
        const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, h = Math.max(b.def.aimY || 3, 2);
        const back = 9 + (b.radius || 1) * 2.5 + h; C.cine = { pos: new V(p.pos.x - ux * back, p.pos.y + 4 + h * 1.1, p.pos.z - uz * back), look: new V(b.pos.x, b.pos.y + h * 0.6, b.pos.z), fov: 52 };
        const A = g.G.arena; if (A && A.camLimit) { const q = A.camLimit(C.cine.pos.x, C.cine.pos.y, C.cine.pos.z, C.cine.look); C.cine.pos.set(q.x, q.y, q.z); } // stay inside walled arenas
        g.warm(0.8); });
      const t0 = Date.now(); await frames(3);
      const f = path.join(out, `${boss}_p${ph}_${k}.png`); await page.screenshot({ path: f, timeout: 300000 }); files.push(f);
      const st = await page.evaluate('window.__game.state()');
      console.log(f, 'renderMs', Date.now() - t0, JSON.stringify(st));
    }
  }
  await browser.close();
})();
