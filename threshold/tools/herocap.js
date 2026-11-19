// node herocap.js <outDir> [class] [boss,boss] : screenshots of the player character for model review.
// Enters each door normally (the intro plays, no skipintro), god mode, no autopilot, then poses the hero:
// normal play camera (idle, walking, casting) and close-ups from a camera that follows the player
// (front three-quarter, side, back) for idle, walk, cast, spender, blink and barrier. Also prints the hero's
// mesh / draw-call / triangle counts and the frame time over 2 s of normal play.
const { launch } = require('./harness.js');
const fs = require('fs'), path = require('path');
(async () => {
  const [out = 'herocap', cls = 'stormcaller', bosses = 'cathedral'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const { browser, page } = await launch({ w: 1280, h: 720 }); page.setDefaultTimeout(300000);
  await page.goto('http://game.local/threshold/?mute=1&god=1&quality=high&seed=5&class=' + cls);
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 120000 });
  await page.evaluate('document.getElementById("fade").style.transition="none"');
  // frames(n): wait n/60 s of real frames (the GPU may run well above 60 fps), at least two frames
  const frames = (n) => page.evaluate((n) => new Promise((res) => { const t0 = performance.now(); let k = 0; const f = () => { if (++k >= 2 && performance.now() - t0 >= n / 60 * 1000) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
  // follow camera: every frame, put the cinematic camera at (yaw off the hero's facing, distance, height) and look at the hero's chest
  const follow = (v) => page.evaluate((v) => {
    const g = window.__game, C = g.Cam; window.__follow = v;
    if (!window.__followLoop) { window.__followLoop = true; const V = g.camera.position.constructor; const c = { pos: new V(), look: new V(), fov: 34 };
      const f = () => { const q = window.__follow, p = g.G.player; if (q && p) { const a = (q.abs ? 0 : p.facing) + q.yaw; c.fov = q.fov || 34;
        c.pos.set(p.pos.x + Math.sin(a) * q.d, p.pos.y + q.h, p.pos.z + Math.cos(a) * q.d); c.look.set(p.pos.x, p.pos.y + (q.ly || 1.05), p.pos.z); C.cine = c; C.cineW = 1; }
        requestAnimationFrame(f); }; requestAnimationFrame(f); }
    if (!v) { C.cine = null; C.cineW = 0; }
  }, v);
  const shot = async (name) => { const f = path.join(out, name + '.png'); await page.screenshot({ path: f }); console.log(f); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // home(turn): put the hero back on the arena spawn point (walking drifts it into walls / the boss) and face spawnFacing + turn
  const home = (turn) => ev((turn) => { const p = window.__game.G.player, h = window.__home; p.pos.set(h.x, h.y, h.z); p.facing = h.f + turn; if (p.vel) p.vel.set(0, 0, 0); }, turn);
  for (const boss of bosses.split(',')) {
    await ev(([b, c]) => { const g = window.__game; g.G.god = true; g.Bot.update = () => { g.Input.bot = window.__mv || { moveX: 0, moveZ: 0 }; }; window.__mv = null; g.Game.start(b, { cls: c }); }, [boss, cls]);
    await page.waitForFunction('window.__game.G.state === "fight" && !window.__game.Cam.cine', null, { timeout: 120000, polling: 100 });
    await ev(() => { const g = window.__game; window.__mv = { moveX: 0, moveZ: 0 }; g.G.boss.immune = false; const p = g.G.player; window.__home = { x: p.pos.x, y: p.pos.y, z: p.pos.z, f: p.facing }; });
    await frames(60);
    const P = boss + '_';
    // ---- normal camera ----
    await ev(() => { const g = window.__game, p = g.G.player; g.Cam.yaw = p.facing + 0.5; g.Cam.pitch = 0.36; });
    await frames(20); await shot(P + 'play_idle');
    const perf = await ev(() => new Promise((res) => { const g = window.__game, r = g.renderer, p = g.G.player; let meshes = 0, tris = 0;
      p.group.traverse((o) => { if (o.isMesh && o.visible) { meshes++; const gg = o.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } });
      const t = []; let last = performance.now(); const f = () => { const n = performance.now(); t.push(n - last); last = n; if (t.length < 120) requestAnimationFrame(f); else { t.sort((a, b) => a - b);
        res({ heroMeshes: meshes, heroTris: Math.round(tris), calls: r.info.render.calls, sceneTris: r.info.render.triangles, frameMsMed: +t[60].toFixed(2), frameMsP95: +t[114].toFixed(2) }); } }; requestAnimationFrame(f); }));
    console.log('perf', boss, JSON.stringify(perf));
    await ev(() => { const g = window.__game, p = g.G.player; const a = g.Cam.yaw + Math.PI / 2; window.__mv = { moveX: Math.sin(a), moveZ: Math.cos(a) }; });
    await frames(40); await shot(P + 'play_walk');
    await ev(() => { window.__mv = { moveX: 0, moveZ: 0 }; }); await frames(30);
    await ev(() => window.__game.G.player.press(0)); await frames(50); await shot(P + 'play_cast');
    await frames(60);
    // ---- close-ups ----
    const views = [['front', 0.55, 5.2, 1.6], ['side', 1.57, 5.2, 1.4], ['back', 2.7, 5.2, 1.8]];
    for (const [n, yaw, d, h] of views) { await follow({ yaw, d, h }); await frames(8); await shot(P + 'idle_' + n); }
    await follow({ yaw: 0.35, d: 2.0, h: 1.75, ly: 1.6, fov: 30 }); await frames(8); await shot(P + 'idle_face');
    // walk: move across the follow camera
    await ev(() => { const g = window.__game, p = g.G.player; window.__mv = { moveX: Math.sin(p.facing), moveZ: Math.cos(p.facing) }; });
    for (const [n, yaw] of [['side', 1.57], ['front', 0.6]]) { await follow({ yaw, d: 4.2, h: 1.4 }); await frames(23); await shot(P + 'walk_' + n); await frames(11); await shot(P + 'walk_' + n + '2'); }
    await ev(() => { window.__mv = { moveX: 0, moveZ: 0 }; }); await frames(30);
    // bolt cast: mid-cast and the release
    await home(0); await frames(10);
    await follow({ yaw: 0.6, d: 3.8, h: 1.5 });
    await ev(() => { const p = window.__game.G.player; p.gcd = 0; p.press(0); }); await frames(45); await shot(P + 'cast_mid');
    await frames(38); await shot(P + 'cast_release');
    await follow({ yaw: 1.4, d: 3.8, h: 1.4 }); await frames(60);
    await ev(() => { const p = window.__game.G.player; p.gcd = 0; p.press(0); }); await frames(60); await shot(P + 'cast_side');
    await frames(60);
    // discharge (spender, instant)
    await home(0); await frames(10);
    await follow({ yaw: 0.8, d: 4, h: 1.5 });
    await ev(() => { const p = window.__game.G.player; p.gcd = 0; p.res = 4; p.press(1); }); await frames(14); await shot(P + 'discharge');
    await frames(60);
    // blink while moving (sideways across the arena), then aegis
    await home(-Math.PI / 2); await ev(() => { window.__game.G.player.pos.x -= 9; }); await frames(10); // blink (11 m) ends near the spawn, not in a wall
    await ev(() => { const g = window.__game, p = g.G.player; window.__mv = { moveX: Math.sin(p.facing), moveZ: Math.cos(p.facing) }; }); await frames(12);
    await follow({ yaw: 0.9, d: 5, h: 1.6 });
    await ev(() => window.__game.G.player.press(3)); await frames(2); await shot(P + 'blink_a'); await frames(6); await shot(P + 'blink_b');
    await ev(() => { window.__mv = { moveX: 0, moveZ: 0 }; }); await frames(40);
    await home(0); await frames(10);
    await follow({ yaw: 0.6, d: 4, h: 1.5 });
    await ev(() => window.__game.G.player.press(4)); await frames(30); await shot(P + 'aegis');
    await ev(() => { const p = window.__game.G.player; p.sk[2].cd = 0; p.sk[2].charges = 1; p.press(2); }); await frames(40); await shot(P + 'tempest');
    await follow(null); await frames(40);
    const st = await ev(() => window.__game.state()); console.log('state', JSON.stringify(st));
  }
  await browser.close();
})();
