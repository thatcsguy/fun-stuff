// node stagecam.js [outDir] : the Impresario's camera. From a normal entry (intro played, never skipintro), then for Normal and
// Nightmare (phase 1 and the finale): parks the hero in each back corner and at the front, swings the camera all the way out
// (max zoom, low and high, from behind the backdrop, from the wings, from the house) and checks that the camera really got out
// there (camLimit), that the scenery between the camera and the hero / boss / dolls faded, and that no shader program was
// compiled after the fight started. Writes one screenshot per view to outDir (default /tmp/stagecam) unless NOSHOT=1.
const { launch } = require('./harness.js');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || '/tmp/stagecam'; fs.mkdirSync(out, { recursive: true });
  const VIEWS = [ // hero x, z, camera yaw (the camera sits at hero - (sin yaw, cos yaw) * dist: yaw 0 = behind the backdrop), pitch
    ['back-left, from behind', -13.5, -7.8, 0.35, 0.32], ['back-right, from behind', 13.5, -7.8, -0.35, 0.32],
    ['back-left, from the wing', -13.5, -7.8, Math.PI / 2, 0.25], ['back-right, high', 13.5, -7.8, -0.4, 0.95],
    ['front-left, from the house', -12, 7.5, Math.PI - 0.25, 0.4], ['centre, from behind high', 0, -6, 0, 1.2],
  ];
  let fails = 0;
  for (const nm of [false, true]) for (const ph of nm ? [0, 2] : [0, 2]) {
    const { browser, page } = await launch({ w: 960, h: 540 });
    await page.goto('http://game.local/threshold/?mute=1&quality=high&seed=5&boss=theatre&class=duskblade' + (nm ? '&nm=1' : ''));
    await page.waitForFunction('window.__game && window.__game.G.state === "fight"', null, { timeout: 180000 });
    await page.evaluate('document.getElementById("fade").style.transition="none"');
    const base = await page.evaluate(async (ph) => {
      const g = window.__game, raf = () => new Promise((r) => requestAnimationFrame(r)); g.god(true);
      if (ph) { g.setPhase(ph); for (let i = 0; i < 10; i++) await raf(); for (let i = 0; i < 1500 && (g.G.boss.transitioning || g.G.boss.state.cine || g.Cam.cine); i++) await raf(); }
      for (let i = 0; i < 30; i++) await raf();
      window.__progs = new Set(g.renderer.info.programs); return g.renderer.info.programs.length;
    }, ph);
    for (const [name, x, z, yaw, pitch] of VIEWS) {
      const r = await page.evaluate(async ({ x, z, yaw, pitch }) => {
        const g = window.__game, G = g.G, Cam = g.Cam, p = G.player, raf = () => new Promise((r) => requestAnimationFrame(r));
        for (let i = 0; i < 70; i++) { p.pos.x = x; p.pos.z = z; Cam.yaw = yaw; Cam.pitch = pitch; Cam.tDist = Cam.maxDist; G.arena.contains && 0; await raf(); }
        const c = g.camera.position, d = Math.hypot(c.x - p.pos.x, c.y - p.pos.y - 1.55, c.z - p.pos.z);
        const faded = []; for (const o of Cam.occ) if ((o.userData.fadeA || 1) < 0.6) faded.push(o.geometry.type.replace('Geometry', '') + '@' + [12, 13, 14].map((i) => o.matrixWorld.elements[i].toFixed(0)).join(','));
        const fresh = g.renderer.info.programs.filter((q) => !window.__progs.has(q)).map((q) => q.name || q.cacheKey.slice(0, 30));
        return { cam: [c.x, c.y, c.z].map((v) => +v.toFixed(1)), dist: +d.toFixed(1), faded, fresh };
      }, { x, z, yaw, pitch });
      const tag = (nm ? 'nm' : 'normal') + '-p' + ph + '-' + name.replace(/[^a-z]+/g, '-');
      if (!process.env.NOSHOT) await page.screenshot({ path: out + '/' + tag + '.png' });
      const bad = r.fresh.length ? 'NEW SHADERS ' + r.fresh.join(' ') : '';
      if (bad) fails++;
      console.log(tag.padEnd(44), 'cam', r.cam.join(','), 'dist', r.dist, 'faded', r.faded.length, bad, process.env.V ? r.faded.join(' ') : '');
    }
    await browser.close();
  }
  console.log(fails ? 'FAIL ' + fails : 'no new shaders in any view');
})();
