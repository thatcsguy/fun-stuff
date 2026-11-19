// node duskpose.js <outDir> [boss] : pose sheet for the Duskblade model. Pins each swing kind at several points of its timeline
// (and the guard and dash poses) on the live player model, and shoots it from the front and the sword side.
// Then: node montage.js sheet.png 4 x,y,w,h <outDir>/k0_*.png ...
const { launch } = require('./harness.js');
const fs = require('fs'), path = require('path');
(async () => {
  const [out = 'duskpose', boss = 'cathedral'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const { browser, page } = await launch({ w: 1280, h: 720 }); page.setDefaultTimeout(300000);
  await page.goto('http://game.local/threshold/?mute=1&god=1&quality=high&seed=5&skipintro&class=duskblade');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 120000 });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const frames = (n) => page.evaluate((n) => new Promise((res) => { const t0 = performance.now(); let k = 0; const f = () => { if (++k >= 2 && performance.now() - t0 >= n / 60 * 1000) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
  await ev((b) => { const g = window.__game; g.G.god = true; g.Bot.update = () => { g.Input.bot = { moveX: 0, moveZ: 0 }; }; g.Game.start(b, { cls: 'duskblade', skipIntro: true }); }, boss);
  await page.waitForFunction('window.__game.G.state === "fight"', null, { timeout: 120000, polling: 100 });
  await frames(30);
  // stand clear of the boss, facing away from it, and pin the model's anim from outside
  await ev(() => { const g = window.__game, p = g.G.player, b = g.G.boss, M = p.model; let dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const r = b.radius + 6; p.pos.x = b.pos.x + dx * r; p.pos.z = b.pos.z + dz * r; p.facing = Math.atan2(dx, dz); g.G.boss.update = () => {}; b.immune = true;
    const u = M.update; M.update = (dt, q) => { const pin = window.__pin; let pp = q;
      if (pin) { p.facing = window.__face; if (pin.kind !== undefined) { M.anim.swingKind = pin.kind; M.anim.swingDur = 1; M.anim.swing = 1 - pin.k + dt; } pp = Object.create(q); pp.parryT = pin.guard ? 1 : 0; pp.dash = pin.dash ? {} : null; pp.res = pin.res !== undefined ? pin.res : q.res; }
      u(dt, pp); };
    window.__face = p.facing; window.__pin = {}; });
  const follow = (v) => ev((v) => { const g = window.__game, C = g.Cam; window.__follow = v;
    if (!window.__fl) { window.__fl = true; const V = g.camera.position.constructor, c = { pos: new V(), look: new V(), fov: 34 };
      const f = () => { const q = window.__follow, p = g.G.player; if (q && p) { const a = p.facing + q.yaw; c.fov = q.fov || 34; c.pos.set(p.pos.x + Math.sin(a) * q.d, p.pos.y + q.h, p.pos.z + Math.cos(a) * q.d); c.look.set(p.pos.x, p.pos.y + (q.ly || 1.05), p.pos.z); C.cine = c; C.cineW = 1; } requestAnimationFrame(f); }; requestAnimationFrame(f); } }, v);
  const shot = async (name) => { const f = path.join(out, name + '.png'); await page.screenshot({ path: f }); console.log(f); };
  const views = [['f', 0.35, 4.6, 1.5], ['r', -1.45, 4.6, 1.4]];
  const pin = async (o, name) => { await ev((o) => { window.__pin = o; }, o); await frames(14); for (const [v, yaw, d, h] of views) { await follow({ yaw, d, h }); await frames(5); await shot(name + '_' + v); } };
  await pin({}, 'idle'); await pin({ guard: 1 }, 'guard'); await pin({ dash: 1 }, 'dash'); await pin({ res: 5 }, 'full');
  for (const kind of (process.env.KINDS || '0,1,2,3,5,6,7').split(',').map(Number)) for (const k of [0.12, 0.28, 0.4, 0.62]) await pin({ kind, k }, 'k' + kind + '_' + Math.round(k * 100));
  await browser.close();
})();
