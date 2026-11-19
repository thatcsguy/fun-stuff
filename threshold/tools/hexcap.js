// node hexcap.js <outDir> [boss,boss] [only] : herocap.js for the Hexslinger. Enters each door normally (intro plays), god mode,
// no autopilot, then poses the hero with the play camera and a follow camera: idle, walk, fire and recoil, Load, Spin, Salve
// (twirl), Silver, the armed sixth shot (Last Word), airborne. Prints mesh / draw-call / triangle counts and frame time.
// `only` = comma list of shot groups (play,idle,walk,fire,load,spin,salve,last,air) to keep a review loop short.
const { launch } = require('./harness.js');
const fs = require('fs'), path = require('path');
(async () => {
  const [out = 'hexcap', bosses = 'cathedral', only = ''] = process.argv.slice(2), want = (k) => !only || only.split(',').includes(k);
  fs.mkdirSync(out, { recursive: true });
  const { browser, page } = await launch({ w: 1280, h: 720 }); page.setDefaultTimeout(300000);
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://game.local/threshold/?mute=1&god=1&quality=high&seed=5&class=hexslinger');
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
  // set the cylinder, then press a skill with the GCD cleared
  const press = async (i, cyl, extra) => { if (cyl || extra) { await ev(([cyl, extra]) => { const p = window.__game.G.player; if (cyl) p.cyl = cyl.split(''); if (extra) Object.assign(p, extra); }, [cyl, extra]); await frames(2); }
    await ev((i) => { const p = window.__game.G.player; p.gcd = 0; p.press(i); }, i); };
  for (const boss of bosses.split(',')) {
    await ev(([b]) => { const g = window.__game; g.G.god = true; g.Bot.update = () => { g.Input.bot = window.__mv || { moveX: 0, moveZ: 0 }; }; window.__mv = null; g.Game.start(b, { cls: 'hexslinger' }); }, [boss]);
    await page.waitForFunction('window.__game.G.state === "fight" && !window.__game.Cam.cine', null, { timeout: 120000, polling: 100 });
    await ev(() => { const g = window.__game; window.__mv = { moveX: 0, moveZ: 0 }; g.G.boss.immune = false; });
    // calm (default; HX_LIVE=1 to skip): freeze the boss so its attacks do not wash over the review shots
    if (!process.env.HX_LIVE) await ev(() => { const g = window.__game, b = g.G.boss; b.update = () => {}; for (const e of g.G.ents) if (e !== b && !e.isBoss) e.alive = false; });
    await frames(60);
    const P = boss + '_';
    await ev(() => { const g = window.__game, p = g.G.player; g.Cam.yaw = p.facing + 0.5; g.Cam.pitch = 0.36; });
    await frames(20); if (want('play')) await shot(P + 'play_idle');
    const perf = await ev(() => new Promise((res) => { const g = window.__game, r = g.renderer, p = g.G.player; let meshes = 0, tris = 0;
      p.group.traverse((o) => { if (o.isMesh && o.visible) { meshes++; const gg = o.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
      const t = []; let last = performance.now(); const f = () => { const n = performance.now(); t.push(n - last); last = n; if (t.length < 120) requestAnimationFrame(f); else { t.sort((a, b) => a - b);
        res({ heroMeshes: meshes, heroTris: Math.round(tris), calls: r.info.render.calls, sceneTris: r.info.render.triangles, frameMsMed: +t[60].toFixed(2), frameMsP95: +t[114].toFixed(2) }); } }; requestAnimationFrame(f); }));
    console.log('perf', boss, JSON.stringify(perf));
    if (want('play')) {
      await ev(() => { const g = window.__game; const a = g.Cam.yaw + Math.PI / 2; window.__mv = { moveX: Math.sin(a), moveZ: Math.cos(a) }; });
      await frames(40); await shot(P + 'play_walk');
      await ev(() => { window.__mv = { moveX: 0, moveZ: 0 }; }); await frames(30);
      await press(0, 'LLLLLL'); await frames(4); await shot(P + 'play_fire'); await frames(50);
    }
    await ev(() => { document.getElementById('hud').style.visibility = 'hidden'; }); // close-ups: no HUD over the legs
    if (want('idle')) {
      for (const [n, yaw, d, h] of [['front', 0.55, 5.2, 1.6], ['side', 1.57, 5.2, 1.4], ['back', 2.7, 5.2, 1.8]]) { await follow({ yaw, d, h }); await frames(8); await shot(P + 'idle_' + n); }
      await follow({ yaw: 0.35, d: 2.0, h: 1.75, ly: 1.6, fov: 30 }); await frames(8); await shot(P + 'idle_face');
      await follow({ yaw: 0.9, d: 1.6, h: 1.1, ly: 1.0, fov: 30 }); await frames(8); await shot(P + 'idle_gun');
    }
    if (want('walk')) {
      await ev(() => { const p = window.__game.G.player; window.__mv = { moveX: Math.sin(p.facing), moveZ: Math.cos(p.facing) }; });
      for (const [n, yaw] of [['side', 1.57], ['front', 0.6], ['back', 2.6]]) { await follow({ yaw, d: 4.2, h: 1.4 }); await frames(23); await shot(P + 'walk_' + n); await frames(11); await shot(P + 'walk_' + n + '2'); }
      await ev(() => { window.__mv = { moveX: 0, moveZ: 0 }; }); await frames(30);
    }
    if (want('fire')) {
      await follow({ yaw: 0.6, d: 3.6, h: 1.5 });
      await press(0, 'LLLLL', { armed: false }); await frames(2); await shot(P + 'fire_a'); await frames(5); await shot(P + 'fire_b'); await frames(20); await shot(P + 'fire_aim');
      await follow({ yaw: 1.5, d: 3.4, h: 1.4 }); await frames(30);
      await press(0, 'LLLL', { armed: false }); await frames(3); await shot(P + 'fire_side'); await frames(40); await shot(P + 'fire_side_settle');
      await follow({ yaw: -0.5, d: 3.0, h: 1.5, ly: 1.3 }); await press(0, 'SLL', { armed: false }); await frames(3); await shot(P + 'fire_silver'); await frames(60);
    }
    if (want('load')) {
      await follow({ yaw: 0.5, d: 3.0, h: 1.55, ly: 1.2 });
      await press(1, 'LS'); await frames(6); await shot(P + 'load_a'); await frames(8); await shot(P + 'load_b');
      await press(2, 'LSL'); await frames(9); await shot(P + 'load_silver');
      await follow({ yaw: 0.15, d: 2.3, h: 1.45, ly: 1.3, fov: 30 }); await frames(30); await press(1, 'LSL'); await frames(10); await shot(P + 'gun_load'); await frames(30); await press(3, 'SVLLL'); await frames(6); await shot(P + 'gun_spin'); await frames(30);
      await follow({ yaw: 0.9, d: 2.6, h: 1.55, ly: 1.4, fov: 30 }); await press(0, 'LSVL', { armed: false }); await frames(25); await shot(P + 'gun_aim'); await frames(30);
      await follow({ yaw: 1.2, d: 2.6, h: 1.4, ly: 1.2 }); await press(6, 'LSLL'); await frames(9); await shot(P + 'load_salve_side'); await frames(40); await shot(P + 'cyl_mixed');
    }
    if (want('spin')) { await follow({ yaw: 0.5, d: 3.0, h: 1.55, ly: 1.2 }); await press(3, 'SVLLL'); await frames(4); await shot(P + 'spin_a'); await frames(6); await shot(P + 'spin_b'); await frames(30); }
    if (want('salve')) {
      await follow({ yaw: 0.7, d: 3.2, h: 1.5, ly: 1.3 });
      await press(0, 'VLL'); await frames(6); await shot(P + 'salve_a'); await frames(10); await shot(P + 'salve_b'); await frames(16); await shot(P + 'salve_c'); await frames(40);
    }
    if (want('last')) {
      await follow({ yaw: 0.6, d: 3.6, h: 1.5 });
      await ev(() => { const p = window.__game.G.player; p.cyl = ['L', 'L']; p.armed = true; p.streak = 4; }); await frames(10); await shot(P + 'armed_5');
      await press(0); await frames(30); await ev(() => { window.__game.G.player.gcd = 0; }); await frames(4); await shot(P + 'armed_last');
      await press(0); await frames(3); await shot(P + 'lastword'); await frames(60);
    }
    if (want('air')) {
      await follow({ yaw: 1.0, d: 4.5, h: 1.6 });
      await ev(() => { const p = window.__game.G.player; p.jump(); }); await frames(14); await shot(P + 'air'); await frames(60);
    }
    await ev(() => { document.getElementById('hud').style.visibility = ''; });
    await follow(null); await frames(40);
    const st = await ev(() => window.__game.state()); console.log('state', JSON.stringify(st));
  }
  if (errs.length) console.log('ERRORS', errs.slice(0, 8).join('\n'));
  await browser.close();
})();
