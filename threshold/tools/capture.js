// node capture.js <boss> <outDir> [class] [shotsPerPhase]
// The last shot of each phase uses a cinematic camera behind the player aimed at the boss, to show the boss and arena.
// CAP_YAW (radians off the player-boss line, default 0.6), CAP_DIST and CAP_H (multipliers, default 1) move that camera when scenery blocks it;
// CAP_POS=x,y,z pins it to a fixed world position instead (it still looks at the player-boss midpoint).
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
      if (k === +per - 1 && +per > 1) await page.evaluate((cv) => { const g = window.__game, C = g.Cam, p = g.G.player, b = g.G.boss, V = p.pos.constructor;
        const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, h = Math.max(b.def.aimY || 3, 2);
        // three-quarter view of player and boss together: from beside-and-behind the player, far enough for the boss's full height
        const D = (13 + (b.radius || 1) * 2.2 + h * 1.3) * cv.dist, ca = Math.atan2(ux, uz) + cv.yaw, mx = (p.pos.x + b.pos.x) / 2, mz = (p.pos.z + b.pos.z) / 2;
        C.cine = { pos: new V(mx - Math.sin(ca) * D, p.pos.y + 3 + D * 0.38 * cv.h, mz - Math.cos(ca) * D), look: new V(mx, b.pos.y + h * 0.55, mz), fov: 50 };
        if (cv.pos) C.cine.pos.set(cv.pos[0], cv.pos[1], cv.pos[2]); // CAP_POS: fixed world position instead of the relative one
        const A = g.G.arena; if (A && A.camLimit) { const q = A.camLimit(C.cine.pos.x, C.cine.pos.y, C.cine.pos.z, C.cine.look); C.cine.pos.set(q.x, q.y, q.z); } // stay inside walled arenas
        g.warm(0.8); }, { yaw: +(process.env.CAP_YAW || 0.6), dist: +(process.env.CAP_DIST || 1), h: +(process.env.CAP_H || 1), pos: process.env.CAP_POS ? process.env.CAP_POS.split(',').map(Number) : null });
      const t0 = Date.now(); await frames(24); // long enough for camera-occlusion fades to settle
      const f = path.join(out, `${boss}_p${ph}_${k}.png`); await page.screenshot({ path: f, timeout: 300000 }); files.push(f);
      const st = await page.evaluate('window.__game.state()');
      console.log(f, 'renderMs', Date.now() - t0, JSON.stringify(st));
    }
  }
  await browser.close();
})();
