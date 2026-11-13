// node spinlock.js : door VIII camera lock check. Enters the wheel fight normally (with the intro), then stands still
// (later runs skip it) and tracks how far a floor point under the player moves on screen while the rings turn. Writes screenshots to OUT.
const { launch } = require('./harness.js');
const OUT = process.env.OUT || '.';
(async () => {
  const { browser, page } = await launch({ w: 480, h: 270 });
  await page.goto('http://game.local/threshold/?mute=1&god=1&quality=low&seed=7');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const run = async (label, opts, setup) => {
    await page.evaluate((opts) => { window.__game.G.god = true; window.__game.Game.start('wheel', opts); }, opts);
    await page.waitForFunction('window.__game.G.state === "fight" && !window.__game.Cam.cine', null, { timeout: 120000, polling: 100 });
    const atRelease = await page.evaluate(() => { const g = window.__game; return { yaw: g.Cam.yaw, facing: g.G.player.facing, camW: g.G.boss.state.camW, nan: !isFinite(g.Cam.yaw) || !isFinite(g.G.player.facing) }; });
    if (label === 'p1-intro') await page.screenshot({ path: OUT + '/after_intro.png' });
    const res = await page.evaluate(([setup]) => new Promise((done) => {
      const g = window.__game, G = g.G, S = G.boss.state, p = G.player, cam = g.camera; const V = p.pos.constructor;
      window.__ev = null; eval(setup);
      let grp = null, loc = null, t = 0; const xs = []; let base = null, maxD = 0, maxD2 = 0;
      let jmax = 0, lastW = null, slide = 0, yr0 = null, yrD = 0; const hook = (rdt, stage) => {
        if (stage !== 1) return; t += rdt;
        if (!grp && t > 0.05) { grp = Math.hypot(p.pos.x, p.pos.z) < 10.4 ? S.inner : S.outer; grp.updateMatrixWorld(); loc = grp.worldToLocal(new V(p.pos.x, 0, p.pos.z)); }
        if (window.__ev) window.__ev(t, p, S);
        if (!grp) return;
        if (lastW !== null) jmax = Math.max(jmax, Math.abs(S.camW - lastW) / Math.max(1e-3, Math.abs(S.wo - S.wi) || 1)); lastW = S.camW;
        { const lp = grp.worldToLocal(new V(p.pos.x, 0, p.pos.z)); if (t > 0.6) slide = Math.max(slide, Math.hypot(lp.x - loc.x, lp.z - loc.z));
          const o = grp.localToWorld(new V(0, 0, 0)), d = grp.localToWorld(new V(0, 0, 1)).sub(o), yr = Math.atan2(Math.sin(g.Cam.yaw - Math.atan2(d.x, d.z)), Math.cos(g.Cam.yaw - Math.atan2(d.x, d.z)));
          if (t > 0.6) { if (yr0 === null) yr0 = yr; yrD = Math.max(yrD, Math.abs(Math.atan2(Math.sin(yr - yr0), Math.cos(yr - yr0)))); } }
        grp.updateMatrixWorld(); const w = grp.localToWorld(loc.clone()); w.project(cam); const sx = (w.x + 1) * 640, sy = (1 - w.y) * 360;
        if (t > 0.6) { if (!base) base = [sx, sy]; const d = Math.hypot(sx - base[0], sy - base[1]); maxD = Math.max(maxD, d); }
        if (t > 0.6 && t < 2.6) { if (!xs.b2) xs.b2 = [sx, sy]; maxD2 = Math.max(maxD2, Math.hypot(sx - xs.b2[0], sy - xs.b2[1])); }
        if (t > 8) { window.__hooks.splice(window.__hooks.indexOf(hook), 1); window.__ev = null; done({ slideM: +slide.toFixed(2), yawVsRingRad: +yrD.toFixed(3), maxCamWStepFrac: +jmax.toFixed(3), maxDrift: +maxD.toFixed(1), drift2s: +maxD2.toFixed(1), wo: +S.wo.toFixed(3), wi: +S.wi.toFixed(3), camW: +S.camW.toFixed(3), r: +Math.hypot(p.pos.x, p.pos.z).toFixed(2), phase: G.boss.phase, hp: Math.round(p.hp) }); }
      };
      window.__hooks.push(hook);
    }), [setup]);
    console.log(label, JSON.stringify(atRelease), JSON.stringify(res));
  };
  await page.evaluate(() => { const C = window.__game.Cam, up = C.update; window.__hooks = []; C.update = function (rdt) { up.call(this, rdt); for (const h of window.__hooks.slice()) h(rdt, 1); }; });
  await run('p1-intro', { cls: 'duskblade' }, 'p.pos.set(0,0,14)');
  await run('p1-inner', { cls: 'duskblade', instant: true }, 'p.pos.set(0,0,7)');
  await run('p1-frenzy', { cls: 'duskblade', instant: true }, 'p.pos.set(0,0,14); S.frenzy = 7.5');
  await run('p3-outer', { cls: 'duskblade', phase: 2, instant: true }, 'p.pos.set(0,0,14)');
  await run('p3-inner', { cls: 'duskblade', phase: 2, instant: true }, 'p.pos.set(0,0,7)');
  await run('p1-jump', { cls: 'duskblade', instant: true }, "p.pos.set(0,0,14); let jumped = 0; window.__ev = (t, p) => { if (t > 1.5 && jumped < 3 && p.grounded && t > 1.5 + jumped * 1.6) { p.grounded = false; p.vy = 9; jumped++; } }");
  await run('p3-cross', { cls: 'duskblade', phase: 2, instant: true }, "p.pos.set(0,0,14); let c = 0; window.__ev = (t, p) => { if (t > 3 && c === 0) { c = 1; p.pos.set(0,0,7); } if (t > 5.5 && c === 1) { c = 2; p.pos.set(0,0,14); } }");
  await browser.close();
})();
