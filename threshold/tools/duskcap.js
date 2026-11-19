// node duskcap.js <outDir> [boss,boss] : Duskblade model review shots, like herocap.js but posed through the Duskblade kit.
// Enters each door normally (intro plays), god mode, no autopilot. Normal play camera (idle, walk, slash), then close-ups
// from a follow camera: idle front / side / back / face, walk, the three Slash steps, Sever at five Momentum, Riposte
// guard and its counter, Sunder, Lunge, Bladestorm. Prints the hero's mesh / triangle counts and frame times.
const { launch } = require('./harness.js');
const fs = require('fs'), path = require('path');
(async () => {
  const [out = 'duskcap', bosses = 'cathedral'] = process.argv.slice(2), cls = 'duskblade';
  fs.mkdirSync(out, { recursive: true });
  const { browser, page } = await launch({ w: 1280, h: 720 }); page.setDefaultTimeout(300000);
  await page.goto('http://game.local/threshold/?mute=1&god=1&quality=high&seed=5&class=' + cls);
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 120000 });
  await page.evaluate('document.getElementById("fade").style.transition="none"');
  const frames = (n) => page.evaluate((n) => new Promise((res) => { const t0 = performance.now(); let k = 0; const f = () => { if (++k >= 2 && performance.now() - t0 >= n / 60 * 1000) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
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
  // press a skill with its gate cleared; the target stays the boss
  const press = (i, res) => ev(([i, res]) => { const p = window.__game.G.player; p.gcd = 0; p.casting = null; const st = p.sk[i]; st.cd = 0; st.charges = Math.max(1, st.charges); if (res !== undefined) p.res = res; p.press(i); }, [i, res]);
  for (const boss of bosses.split(',')) {
    await ev(([b, c]) => { const g = window.__game; g.G.god = true; g.Bot.update = () => { g.Input.bot = window.__mv || { moveX: 0, moveZ: 0 }; }; window.__mv = null; g.Game.start(b, { cls: c }); }, [boss, cls]);
    await page.waitForFunction('window.__game.G.state === "fight" && !window.__game.Cam.cine', null, { timeout: 120000, polling: 100 });
    await ev(() => { const g = window.__game; window.__mv = { moveX: 0, moveZ: 0 }; g.G.boss.immune = false; });
    await frames(60);
    const P = boss + '_';
    await ev(() => { const g = window.__game, p = g.G.player; g.Cam.yaw = p.facing + 0.5; g.Cam.pitch = 0.36; });
    await frames(20); await shot(P + 'play_idle');
    const perf = await ev(() => new Promise((res) => { const g = window.__game, r = g.renderer, p = g.G.player; let meshes = 0, tris = 0;
      p.group.traverse((o) => { if (o.isMesh && o.visible) { meshes++; const gg = o.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } });
      const t = []; let last = performance.now(); const f = () => { const n = performance.now(); t.push(n - last); last = n; if (t.length < 120) requestAnimationFrame(f); else { t.sort((a, b) => a - b);
        res({ heroMeshes: meshes, heroTris: Math.round(tris), calls: r.info.render.calls, sceneTris: r.info.render.triangles, frameMsMed: +t[60].toFixed(2), frameMsP95: +t[114].toFixed(2) }); } }; requestAnimationFrame(f); }));
    console.log('perf', boss, JSON.stringify(perf));
    await ev(() => { const g = window.__game; const a = g.Cam.yaw + Math.PI / 2; window.__mv = { moveX: Math.sin(a), moveZ: Math.cos(a) }; });
    await frames(40); await shot(P + 'play_walk');
    await ev(() => { window.__mv = { moveX: 0, moveZ: 0 }; }); await frames(30);
    // walk up to the boss so melee lands
    await ev(() => { const g = window.__game, p = g.G.player, b = g.G.boss; const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z), k = Math.max(0, d - b.radius - 2.2) / d; p.pos.x += (b.pos.x - p.pos.x) * k; p.pos.z += (b.pos.z - p.pos.z) * k; p.facing = Math.atan2(b.pos.x - p.pos.x, b.pos.z - p.pos.z); });
    await frames(20);
    await press(0); await frames(6); await shot(P + 'play_slash');
    await frames(60);
    // ---- close-ups: stand clear of the boss and the walls, facing away from the boss ----
    const clear = () => ev(() => { const g = window.__game, p = g.G.player, b = g.G.boss; let dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      const r = b.radius + 5; p.pos.x = b.pos.x + dx * r; p.pos.z = b.pos.z + dz * r; p.facing = Math.atan2(dx, dz); });
    await clear(); await frames(20);
    for (const [n, yaw, d, h] of [['front', 0.55, 5.2, 1.6], ['side', 1.57, 5.2, 1.4], ['back', 2.7, 5.2, 1.8]]) { await follow({ yaw, d, h }); await frames(8); await shot(P + 'idle_' + n); }
    await follow({ yaw: 0.35, d: 2.0, h: 1.75, ly: 1.6, fov: 30 }); await frames(8); await shot(P + 'idle_face');
    // walk a lap around the boss so the run never meets a wall
    await ev(() => { window.__walkLoop = true; const g = window.__game; const f = () => { if (!window.__walkLoop) return; const p = g.G.player, b = g.G.boss; const a = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z) + Math.PI / 2; window.__mv = { moveX: Math.sin(a), moveZ: Math.cos(a) }; requestAnimationFrame(f); }; f(); });
    for (const [n, yaw] of [['side', 1.57], ['front', 0.6], ['back', 2.6]]) { await follow({ yaw, d: 4.2, h: 1.4 }); await frames(23); await shot(P + 'walk_' + n); await frames(11); await shot(P + 'walk_' + n + '2'); }
    await ev(() => { window.__walkLoop = false; window.__mv = { moveX: 0, moveZ: 0 }; }); await frames(40);
    await ev(() => { const g = window.__game, p = g.G.player, b = g.G.boss; const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z), k = Math.max(0, d - b.radius - 2.2) / d; p.pos.x += (b.pos.x - p.pos.x) * k; p.pos.z += (b.pos.z - p.pos.z) * k; p.facing = Math.atan2(b.pos.x - p.pos.x, b.pos.z - p.pos.z); p.combo = 0; });
    await frames(20);
    // three slash steps, caught mid-swing
    await follow({ yaw: -1.3, d: 4.4, h: 1.6 });
    for (let k = 0; k < 3; k++) { await press(0); await frames(5); await shot(P + 'slash' + (k + 1) + 'a'); await frames(5); await shot(P + 'slash' + (k + 1) + 'b'); await frames(50); }
    await press(1, 5); await frames(5); await shot(P + 'sever_a'); await frames(6); await shot(P + 'sever_b'); await frames(60);
    await follow({ yaw: 1.3, d: 4.2, h: 1.5 });
    await press(4); await frames(12); await shot(P + 'riposte_guard');
    await frames(60);
    await ev(() => { const p = window.__game.G.player; p.parryT = 0.5; p.hurt(50, { blockable: true, src: 'test' }); }); await frames(8); await shot(P + 'riposte_counter');
    await frames(60);
    await follow({ yaw: 1.2, d: 4.2, h: 1.5 });
    await press(5); await frames(6); await shot(P + 'sunder_a'); await frames(7); await shot(P + 'sunder_b'); await frames(60);
    // lunge from a distance onto the boss
    await clear(); await ev(() => { const g = window.__game, p = g.G.player, b = g.G.boss; p.facing = Math.atan2(b.pos.x - p.pos.x, b.pos.z - p.pos.z); }); await frames(20);
    await follow({ yaw: 1.4, d: 5.5, h: 1.6 });
    await press(3); await frames(3); await shot(P + 'lunge_a'); await frames(5); await shot(P + 'lunge_b'); await frames(4); await shot(P + 'lunge_c'); await frames(60);
    await clear(); await frames(10); await follow({ yaw: 0.6, d: 4.6, h: 1.6 });
    await press(2); await frames(40); await shot(P + 'storm');
    await ev(() => { const g = window.__game, p = g.G.player; p.res = 5; }); await frames(20); await shot(P + 'storm_full');
    await follow(null); await frames(40);
    const st = await ev(() => window.__game.state()); console.log('state', JSON.stringify(st));
  }
  await browser.close();
})();
