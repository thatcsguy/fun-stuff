// node tools/portalcap.js <outDir> [class] [shots] : door `portal` visual review after a full normal entry (the intro plays).
// Shots (comma list, default all): intro1 intro2 intro3 idle slamcast slammid transit p2trans iris doors p3trans triptych lockout death.
// Fight shots run headless up to the moment, then a short stretch with effects on, then the game is paused for the screenshot.
// Prints the median frame time of a live stretch of each phase. Use TH_GPU=1 on a machine with a GPU.
const { launch } = require('./harness.js');
const fs = require('fs'), path = require('path');
(async () => {
  const [out, cls = 'stormcaller', which] = process.argv.slice(2);
  const want = which ? new Set(which.split(',')) : null, on = (n) => !want || want.has(n);
  fs.mkdirSync(out, { recursive: true });
  const { browser, page } = await launch({ w: 1280, h: 720 }); page.setDefaultTimeout(0);
  await page.goto('http://game.local/threshold/?mute=1&god=1&bot=3&quality=high&seed=4&class=' + cls + '&boss=portal' + (process.env.GATE ? '&gate=' + process.env.GATE : ''));
  await page.waitForFunction('window.__game && window.__game.G.state === "intro"', null, { timeout: 300000 });
  await page.evaluate('document.getElementById("fade").style.transition="none"; window.__t0 = window.__game.G.now');
  const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
  // the autopilot never turns the camera: before each fight shot, put it behind the hero facing Janus (as a player would)
  const face = () => page.evaluate(() => { const g = window.__game, p = g.G.player, b = g.G.boss; if (g.G.state === 'fight' && !g.Cam.cine) { g.Cam.yaw = Math.atan2(b.pos.x - p.pos.x, b.pos.z - p.pos.z); g.Cam.pitch = 0.4; g.Cam.tDist = g.Cam.dist = 17; } });
  const snap = async (name) => { await face(); await page.evaluate('window.__game.G.paused = true'); await frames(4); const f = path.join(out, name + '.png'); await page.screenshot({ path: f }); await page.evaluate('window.__game.G.paused = false'); console.log(f); };
  const at = async (sec) => page.waitForFunction((s) => window.__game.G.now - window.__t0 >= s, sec, { timeout: 120000 });
  // the intro, in real time
  if (on('intro1')) { await at(2.3); await snap('01_intro_wide'); }
  if (on('intro2')) { await at(4.6); await snap('02_intro_gate'); }
  if (on('intro3')) { await at(7.8); await snap('03_intro_key'); }
  await page.waitForFunction('window.__game.G.state === "fight"', null, { timeout: 120000 });
  // run the sim headless until cond (JS with g, G, b, p, S), then `warm` seconds with effects on
  const until = (cond, warm = 0.3, max = 90) => page.evaluate(([cond, warm, max]) => { const g = window.__game, G = g.G, f = new Function('g', 'G', 'b', 'p', 'S', 'return ' + cond);
    G.headless = true; let n = Math.round(max * 60); try { while (n-- > 0 && !f(g, G, G.boss, G.player, G.boss.state)) { g.Bot.update(1 / 60); G.step(1 / 60); } } finally { G.headless = false; } if (warm > 0) g.warm(warm); return n > 0; }, [cond, warm, max]);
  const ftime = () => page.evaluate(() => new Promise((res) => { const ts = []; let last = performance.now(); const f = (now) => { ts.push(now - last); last = now; if (ts.length < 90) requestAnimationFrame(f); else { ts.sort((a, b) => a - b); res(ts[45].toFixed(2)); } }; requestAnimationFrame(f); }));
  const perf = {};
  await until('G.ft > 2', 1.0); perf.p1 = await ftime();
  if (on('idle')) await snap('04_p1_idle');
  if (on('slamcast')) { await until('S.mechOn === "slam" && S.haz.length && G.now > S.haz[0].born + 1.0', 0.3); await snap('05_slam_cast'); }
  if (on('slammid') || on('transit')) {
    if (on('slammid')) { await until('S.mechOn === "slam" && S.haz.length && G.now > S.haz[0].t0 + 1.6', 0.15); await snap('06_slam_mid'); }
    if (on('transit')) { await until('S.tr && S.tr.t > 0.12', 0.05, 60); await snap('07_transit'); }
  }
  if (on('p2trans') || on('iris') || on('doors')) {
    await page.evaluate('window.__game.setPhase(1)'); await until('G.boss.phase === 1', 0, 5);
    await until('false', 2.6, 0.01); perf.p2 = await ftime();
    if (on('p2trans')) await snap('08_p2_transition');
    if (on('iris')) { await until('S.mechOn === "iris" && S.haz.length && G.now > S.haz[0].t0 + 1.4', 0.2); await snap('09_iris'); }
    if (on('doors')) { await until('S.mechOn === "doors" && S.haz.length && G.now > S.haz[0].t0 + 2.55', 0.15); await snap('10_double_doors'); }
  }
  if (on('p3trans') || on('triptych') || on('lockout')) {
    await page.evaluate('window.__game.setPhase(2)'); await until('G.boss.phase === 2', 0, 5);
    await until('false', 3.2, 0.01); perf.p3 = await ftime();
    if (on('p3trans')) await snap('11_p3_transition');
    if (on('triptych')) { await until('S.mechOn === "triptych" && S.haz.length === 3 && G.now > S.haz[0].t0 + 0.6', 0.25, 120); await snap('12_triptych'); }
    if (on('lockout')) { await until('S.lockout && S.lockAt - G.now < 1.6', 0.3, 120); await snap('13_lockout'); }
  }
  if (on('death')) { await page.evaluate('window.__game.G.god = false; window.__game.kill()'); await page.waitForTimeout(3600); await snap('14_death'); }
  const st = await page.evaluate(() => ({ calls: window.__game.renderer.info.render.calls, tris: window.__game.renderer.info.render.triangles, errors: window.__game.G.errors.slice(0, 5) }));
  console.log('frame ms (median)', JSON.stringify(perf), 'last frame', JSON.stringify(st));
  await browser.close();
})();
