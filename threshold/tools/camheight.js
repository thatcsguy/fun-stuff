// node camheight.js : checks the "Character height on screen" setting (Settings.camY, a vertical lens shift in Cam.update).
// For each door in DOORS and each height in HEIGHTS: enters the fight normally (with the intro), then
//  - checks the shift is faded out during the intro shot and fully in after it,
//  - measures where the player sits on screen (should be camY % up from the bottom of the focus point) while the camera yaws,
//    pitches and (door VIII) the rings turn the camera, and how much it drifts,
//  - checks screen picking: projecting the boss's aim point then pickTarget() at that pixel selects the boss, and a Raycaster
//    built from that pixel passes through the aim point (so project / unproject agree with the shifted projection).
// Then pauses mid-fight, opens Settings from the pause menu, drags the slider, and checks the shift changes while paused.
// Screenshots go to OUT.
const { launch } = require('./harness.js');
const OUT = process.env.OUT || '.';
const DOORS = (process.env.DOORS || 'wheel,cathedral,titan').split(',');
const HEIGHTS = (process.env.HEIGHTS || '30,50,60').split(',').map(Number);
(async () => {
  const W = 1280, H = 720;
  const { browser, page } = await launch({ w: W, h: H });
  await page.goto('http://game.local/threshold/?mute=1&god=1&quality=low&seed=7');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  let fails = 0; const bad = (m) => { fails++; console.log('  FAIL', m); };
  for (const door of DOORS) for (const camY of HEIGHTS) {
    await page.evaluate(([door, camY]) => { const g = window.__game; g.Settings.camY = camY; g.G.god = true; window.__introShift = []; g.Game.start(door, { cls: 'stormcaller' }); }, [door, camY]);
    // sample the shift during the intro
    await page.waitForFunction('window.__game.G.state === "intro" || window.__game.G.state === "fight"', null, { timeout: 120000, polling: 50 });
    const intro = await page.evaluate(() => new Promise((done) => { const g = window.__game, s = []; const iv = setInterval(() => { s.push([g.G.state, +g.Cam.cineW.toFixed(2), +g.Cam.shift.toFixed(3)]); if (g.G.state === 'fight' && !g.Cam.cine) { clearInterval(iv); done(s); } }, 100); }));
    const inIntro = intro.filter((q) => q[1] >= 0.999);
    if (inIntro.some((q) => Math.abs(q[2]) > 1e-4)) bad(`${door} ${camY}: shift during full cinematic ${JSON.stringify(inIntro.slice(0, 3))}`);
    await page.waitForTimeout(1600);
    if (camY !== 50 || door === 'wheel') await page.screenshot({ path: `${OUT}/${door}_${camY}_fight.png` });
    const res = await page.evaluate(([W, H]) => new Promise((done) => {
      const g = window.__game, G = g.G, cam = g.camera, C = g.Cam, p = G.player, T = cam.position.constructor;
      const want = (50 - g.Settings.camY) / 100; let t = 0, ys = [], xs = [];
      const up = C.update; C.update = function (rdt) {
        // scripted camera motion: yaw sweep, then pitch sweep (as if the right stick were held)
        if (t < 2) C.yaw += rdt * 1.4; else if (t < 4) C.pitch = 0.36 + Math.sin((t - 2) * 2) * 0.5;
        up.call(this, rdt); t += rdt;
        const v = C.focus.clone().project(cam); ys.push((1 - v.y) / 2 * H); xs.push((v.x + 1) / 2 * W);
        if (t > 4.5) { C.update = up; finish(); }
      };
      function finish() {
        const b = G.boss, out = { shift: +C.shift.toFixed(3), want: +want.toFixed(3), viewOn: !!(cam.view && cam.view.enabled), aspect: +cam.aspect.toFixed(3) };
        const k = ys.length > 20 ? 10 : 0, y = ys.slice(k), x = xs.slice(k);
        out.focusY = +(y.reduce((a, c) => a + c, 0) / y.length).toFixed(1); out.focusYexp = +((0.5 + want) * H).toFixed(1);
        out.yDrift = +(Math.max(...y) - Math.min(...y)).toFixed(1); out.xDrift = +(Math.max(...x) - Math.min(...x)).toFixed(1);
        // screen pick + raycast consistency
        const a = b.aim(new T()), v = a.clone().project(cam), sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
        p.target = null; p.pickTarget(sx, sy); out.pick = p.target === b;
        const n0 = new T(v.x, v.y, -1).unproject(cam), d = new T(v.x, v.y, 1).unproject(cam).sub(n0).normalize(), q = a.clone().sub(n0);
        out.rayMiss = +q.sub(d.multiplyScalar(q.dot(d))).length().toFixed(4);
        out.bossOnScreen = Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
        done(out);
      }
    }), [W, H]);
    console.log(door, camY, JSON.stringify(res));
    if (Math.abs(res.shift - res.want) > 1e-3) bad(`${door} ${camY}: shift ${res.shift} != ${res.want}`);
    if (Math.abs(res.aspect - W / H) > 0.01) bad(`${door} ${camY}: aspect changed`);
    if (Math.abs(res.focusY - res.focusYexp) > 12) bad(`${door} ${camY}: player at y ${res.focusY}, expected ${res.focusYexp}`);
    if (res.yDrift > 30) bad(`${door} ${camY}: vertical drift ${res.yDrift}px`);
    if (res.rayMiss > 0.01) bad(`${door} ${camY}: ray from projected pixel misses aim point by ${res.rayMiss}`);
    if (res.bossOnScreen && !res.pick) bad(`${door} ${camY}: clicking the boss did not target it`);
  }
  // live change while paused, from the pause menu's settings
  await page.evaluate(() => { const g = window.__game; g.Settings.camY = 50; g.Game.start('wheel', { cls: 'stormcaller', instant: true }); });
  await page.waitForFunction('window.__game.G.state === "fight" && !window.__game.Cam.cine && window.__game.Cam.cineW === 0', null, { timeout: 120000, polling: 100 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.Game.pause(true));
  await page.click('#pause [data-act=settings]');
  await page.hover('#settings .srow-peek');
  const sl = await page.$('#set-camY'); const bb = await sl.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + 2, bb.y + bb.height / 2, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(500);
  const live = await page.evaluate(() => { const g = window.__game; return { paused: g.G.paused, camY: g.Settings.camY, shift: +g.Cam.shift.toFixed(3), saved: JSON.parse(localStorage.getItem('th_settings')).camY, label: document.querySelector('#set-camY').nextElementSibling.textContent, bg: getComputedStyle(document.querySelector('#settings')).backgroundImage }; });
  console.log('live', JSON.stringify(live));
  if (!live.paused || live.camY !== 30 || Math.abs(live.shift - 0.2) > 1e-3 || live.saved !== 30) bad('live change while paused: ' + JSON.stringify(live));
  if (live.bg !== 'none') bad('settings screen not see-through while the height row is hovered');
  await page.screenshot({ path: `${OUT}/paused_settings_peek.png` });
  await page.mouse.move(5, 5); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/paused_settings_normal.png` });
  // controller-style adjust: move focus down to the row, then right x3 (one step = 2 %)
  const nav = await page.evaluate(async () => { const g = window.__game, f = () => document.querySelector('#settings .focus');
    for (let i = 0; i < 12 && !(f() && f().dataset.adj === 'camY'); i++) g.Input.navFire('down');
    const before = g.Settings.camY; for (let i = 0; i < 3; i++) g.Input.navFire('right');
    await new Promise((r) => setTimeout(r, 400));
    return { focused: f() && f().dataset.adj, before, after: g.Settings.camY, shift: +g.Cam.shift.toFixed(3), bg: getComputedStyle(document.querySelector('#settings')).backgroundImage }; });
  console.log('nav', JSON.stringify(nav));
  if (nav.focused !== 'camY' || nav.after !== nav.before + 6 || Math.abs(nav.shift - (50 - nav.after) / 100) > 1e-3 || nav.bg !== 'none') bad('controller adjust: ' + JSON.stringify(nav));
  await page.screenshot({ path: `${OUT}/paused_settings_padfocus.png` });
  // back to the fight: the shift stays
  await page.evaluate(() => { window.__game.Input.navFire('back'); window.__game.Game.pause(false); });
  console.log('done, fails =', fails);
  await browser.close(); process.exit(fails ? 1 : 0);
})();
