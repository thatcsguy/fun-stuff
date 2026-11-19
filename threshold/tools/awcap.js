// node awcap.js <outDir> [boss,boss] [only] : Ashwarden model review shots (herocap.js does the same for the Stormcaller).
// Enters each door normally (intro plays, no skipintro), god mode, no autopilot, then poses the knight: normal camera idle / walk /
// strike, close-ups (front, side, back, face), walk cycle, both cuts, the Overhead wind-up and slam, roll and back-hop, Kindle
// (pour and burning blade), the Ember Flask, an opening after a dodge, and Winded. Prints mesh / draw-call / triangle counts and
// the frame time over 2 s of normal play. `only` = comma list of shot groups: play,close,walk,strike,heavy,roll,kindle,flask.
const { launch } = require('./harness.js');
const fs = require('fs'), path = require('path');
(async () => {
  const [out = 'awcap', bosses = 'cathedral', only = ''] = process.argv.slice(2), want = (k) => !only || only.split(',').includes(k);
  fs.mkdirSync(out, { recursive: true });
  const { browser, page } = await launch({ w: 1280, h: 720 }); page.setDefaultTimeout(300000);
  await page.goto('http://game.local/threshold/?mute=1&god=1&quality=high&seed=5&class=ashwarden');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 120000 });
  await page.evaluate('document.getElementById("fade").style.transition="none"');
  // frames(n): wait n/60 s of real frames (the GPU may run well above 60 fps), at least two frames
  const frames = (n) => page.evaluate((n) => new Promise((res) => { const t0 = performance.now(); let k = 0; const f = () => { if (++k >= 2 && performance.now() - t0 >= n / 60 * 1000) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
  // follow camera: (yaw off the hero's facing, distance, height), looking at the hero's chest
  const follow = (v) => page.evaluate((v) => {
    const g = window.__game, C = g.Cam; window.__follow = v;
    if (!window.__followLoop) { window.__followLoop = true; const V = g.camera.position.constructor; const c = { pos: new V(), look: new V(), fov: 34 };
      const f = () => { const q = window.__follow, p = g.G.player; if (q && p) { const a = (q.abs ? 0 : p.group.rotation.y) + q.yaw; c.fov = q.fov || 34;
        c.pos.set(p.pos.x + Math.sin(a) * q.d, p.pos.y + q.h, p.pos.z + Math.cos(a) * q.d); c.look.set(p.pos.x, p.pos.y + (q.ly || 1.05), p.pos.z); C.cine = c; C.cineW = 1; }
        requestAnimationFrame(f); }; requestAnimationFrame(f); }
    if (!v) { C.cine = null; C.cineW = 0; }
  }, v);
  // slow motion for the one-shot moves, so screenshot latency does not skip past them; gf(n) waits n frames of game time
  const TS = 0.12, slow = (on) => page.evaluate((v) => { window.__game.G.timeScale = v; }, on ? TS : 1), gf = (n) => frames(n / TS);
  const shot = async (name) => { const f = path.join(out, name + '.png'); await page.screenshot({ path: f }); console.log(f); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const move = (on) => ev((on) => { const p = window.__game.G.player; window.__mv = on ? { moveX: Math.sin(p.facing), moveZ: Math.cos(p.facing) } : { moveX: 0, moveZ: 0 }; }, on);
  const press = (i, res) => ev(([i, res]) => { const p = window.__game.G.player; p.gcd = 0; if (res !== null) { p.res = res; p.winded = false; } p.press(i); }, [i, res === undefined ? null : res]);
  // near(d): stand d m from the boss's edge, facing it, with it targeted (so the cuts land and the Overhead does not leap unless d is large)
  const near = (d) => ev((d) => { const g = window.__game, p = g.G.player, b = g.G.boss; const a = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z), r = (b.radius || 1) + d;
    p.pos.x = b.pos.x + Math.sin(a) * r; p.pos.z = b.pos.z + Math.cos(a) * r; p.facing = a + Math.PI; p.target = b; }, d);
  for (const boss of bosses.split(',')) {
    await ev(([b]) => { const g = window.__game; g.G.god = true; g.Bot.update = () => { g.Input.bot = window.__mv || { moveX: 0, moveZ: 0 }; }; window.__mv = null; g.Game.start(b, { cls: 'ashwarden' }); }, [boss]);
    await page.waitForFunction('window.__game.G.state === "fight" && !window.__game.Cam.cine', null, { timeout: 120000, polling: 100 });
    await ev(() => { const g = window.__game; window.__mv = { moveX: 0, moveZ: 0 }; g.G.boss.immune = false; });
    // AW_CALM=1: the boss stands idle (its phases run an empty loop) and live hazards/bullets are cleared, so beams and telegraphs
    // do not wash out the close-ups
    if (process.env.AW_CALM) await ev(() => { const g = window.__game, b = g.G.boss;
      b.def = Object.assign({}, b.def, { phases: b.def.phases.map((ph) => Object.assign({}, ph, { enter: null, run: function* () { for (;;) yield 1; } })) });
      b.goPhase(Math.max(0, b.phase)); g.Hz.clear(); g.Bul.clear(); });
    // AW_LAB=1: hide the arena and light the knight evenly on grey, to judge the model itself
    if (process.env.AW_LAB) await ev(async () => { const T = await import('three'), g = window.__game, p = g.G.player;
      for (const o of g.scene.children) if (o !== p.group) o.visible = false;
      g.scene.background = new T.Color(0x4a4d55); g.scene.fog = null; const h = new T.HemisphereLight(0xe8eeff, 0x4a4038, 1.6), d = new T.DirectionalLight(0xfff0dc, 2.6); d.position.set(4, 9, 7); g.scene.add(h, d, d.target);
      const loop = () => { d.position.set(p.pos.x + 4, 9, p.pos.z + 7); d.target.position.copy(p.pos); requestAnimationFrame(loop); }; loop(); });
    await frames(60);
    const P = boss + '_';
    if (want('play')) {
      await ev(() => { const g = window.__game, p = g.G.player; g.Cam.yaw = p.facing + 0.5; g.Cam.pitch = 0.36; });
      await frames(20); await shot(P + 'play_idle');
      const perf = await ev(() => new Promise((res) => { const g = window.__game, r = g.renderer, p = g.G.player; let meshes = 0, tris = 0;
        p.group.traverse((o) => { if (o.isMesh && o.visible) { meshes++; const gg = o.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } });
        const t = []; let last = performance.now(); const f = () => { const n = performance.now(); t.push(n - last); last = n; if (t.length < 120) requestAnimationFrame(f); else { t.sort((a, b) => a - b);
          res({ heroMeshes: meshes, heroTris: Math.round(tris), calls: r.info.render.calls, sceneTris: r.info.render.triangles, frameMsMed: +t[60].toFixed(2), frameMsP95: +t[114].toFixed(2) }); } }; requestAnimationFrame(f); }));
      console.log('perf', boss, JSON.stringify(perf));
      await ev(() => { const g = window.__game; const a = g.Cam.yaw + Math.PI / 2; window.__mv = { moveX: Math.sin(a), moveZ: Math.cos(a) }; });
      await frames(40); await shot(P + 'play_walk'); await move(false); await frames(30);
      await press(0, 100); await frames(8); await shot(P + 'play_strike'); await frames(60);
    }
    if (want('close')) {
      for (const [n, yaw, d, h] of [['front', 0.55, 5.2, 1.6], ['side', 1.57, 5.2, 1.4], ['back', 2.7, 5.2, 1.8]]) { await follow({ yaw, d, h }); await frames(8); await shot(P + 'idle_' + n); }
      await follow({ yaw: 0.35, d: 2.0, h: 1.8, ly: 1.62, fov: 30 }); await frames(8); await shot(P + 'idle_face');
    }
    if (want('walk')) {
      await move(true);
      for (const [n, yaw] of [['side', 1.57], ['front', 0.6]]) { await follow({ yaw, d: 4.4, h: 1.4 }); await frames(23); await shot(P + 'walk_' + n); await frames(11); await shot(P + 'walk_' + n + '2'); }
      await move(false); await frames(30);
    }
    if (want('strike')) {
      await slow(true);
      await near(1.8); await gf(10);
      await follow({ yaw: 0.7, d: 4.6, h: 1.6 });
      for (const k of ['a', 'b']) { await press(0, 100); await gf(4); await shot(P + 'strike_' + k + '1'); await gf(4); await shot(P + 'strike_' + k + '2'); await gf(5); await shot(P + 'strike_' + k + '3'); await gf(30); }
      await shot(P + 'guard'); await follow({ yaw: 1.6, d: 4.6, h: 1.5 }); await gf(4); await shot(P + 'guard_side'); await slow(false); await frames(150); await shot(P + 'rest_side');
      await slow(false);
    }
    if (want('heavy')) {
      await slow(true);
      await near(1.8); await gf(10);
      await follow({ yaw: 1.5, d: 5, h: 1.6 });
      await press(1, 100); await gf(18); await shot(P + 'heavy_windup');
      await gf(14); await shot(P + 'heavy_go'); await gf(7); await shot(P + 'heavy_slam'); await gf(6); await shot(P + 'heavy_slam2'); await gf(60);
      await slow(false);
    }
    if (want('roll')) {
      await slow(true);
      await move(true); await gf(20); await follow({ yaw: 1.57, d: 5.2, h: 1.4 }); await gf(4);
      await press(3, 100); console.log('rollT', await ev(() => window.__game.G.player.rollT)); let n = 0; for (const k of [3, 5, 5, 5, 5]) { await gf(k); await shot(P + 'roll_' + (++n)); }
      await move(false); await gf(50);
      await press(3, 100); await gf(10); await shot(P + 'hop'); await gf(60);
      await slow(false);
    }
    if (want('kindle')) {
      await slow(true);
      await near(1.8); await gf(10);
      await follow({ yaw: 0.55, d: 4.4, h: 1.6 });
      await press(2); await gf(12); await shot(P + 'kindle_pour1'); await gf(16); await shot(P + 'kindle_pour2'); await gf(40); await shot(P + 'kindle_burn');
      await follow({ yaw: 1.2, d: 5, h: 1.5 }); await gf(5); await shot(P + 'kindle_burn_side'); await press(0, 100); await gf(7); await shot(P + 'kindle_strike'); await gf(40);
      await slow(false);
    }
    if (want('flask')) {
      await slow(true);
      await follow({ yaw: 0.6, d: 3.6, h: 1.65, ly: 1.3 });
      await press(6); await gf(14); await shot(P + 'flask_lift'); await gf(22); await shot(P + 'flask_drink'); await gf(50);
      await ev(() => { const p = window.__game.G.player; p.opening = 5; }); await gf(14); await shot(P + 'opening');
      await ev(() => { const p = window.__game.G.player; p.opening = 0; p.res = -30; p.winded = true; }); await gf(30); await shot(P + 'winded');
      await follow({ yaw: 1.5, d: 4.4, h: 1.4 }); await gf(6); await shot(P + 'winded_side');
      await slow(false);
    }
    await follow(null); await frames(40);
    const st = await ev(() => window.__game.state()); console.log('state', JSON.stringify(st));
  }
  await browser.close();
})();
