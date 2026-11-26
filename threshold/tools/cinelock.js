// node cinelock.js [bosses] [classes] : checks that every cinematic locks the player. Real rendered frames from a normal entry
// with the intro (never skipintro). The "player" holds W and taps 1 the whole time (BOT=1: the level-3 autopilot instead); the
// tool pushes the boss through every phase (each phase change plays its mid-fight shot, if it has one), then kills it.
// For every stretch of G.cineLock it reports how far the hero moved, casts started, and GCD / cooldown / gauge drift (all should
// be 0), and whether the HUD stayed hidden in fight shots. Outside the locks it reports metres moved and casts, to show input works.
// NM=0 runs the normal fights (default: nightmare where the boss has one). Defaults: the bosses with mid-fight shots.
const { launch } = require('./harness.js');
(async () => {
  const bosses = (process.argv[2] || 'duelist,engine,gorgon,theatre,atelier').split(','), classes = (process.argv[3] || 'stormcaller').split(',');
  const bot = !!process.env.BOT, nm = process.env.NM !== '0';
  let bad = 0;
  for (const boss of bosses) for (const cls of classes) {
    const { browser, page } = await launch({ w: 480, h: 270 });
    await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=7&boss=' + boss + (nm ? '&nm=1' : '') + '&class=' + cls);
    await page.waitForFunction('window.__game && window.__game.G.player', null, { timeout: 120000 });
    await page.evaluate((bot) => {
      const g = window.__game, G = g.G; g.Settings.godMode = true; g.god(true); if (bot) g.bot(3);
      const M = window.__cl = { locks: [], free: { moved: 0, casts: 0 }, cur: null, lastPos: null, lastCast: null };
      const snap = (p) => ({ gcd: p.gcd, cd: p.sk.reduce((a, s) => a + (s ? (s.cd || 0) + Math.min(s.charges || 0, 99) * 100 + Math.min(s.uses || 0, 99) * 1e4 : 0), 0), res: p.res, buffs: p.buffs.reduce((a, b) => a + b.t, 0) });
      const tick = () => {
        const p = G.player; if (p) {
          const lock = !!G.cineLock;
          if (lock && !M.cur) { M.cur = { state: G.state, t0: G.ft, r0: G.rt, x: p.pos.x, z: p.pos.z, moved: 0, casts: 0, s0: snap(p), hudOn: 0, frames: 0 }; }
          if (M.cur && !lock) { const c = M.cur, s = c.last; c.dur = +(G.rt - c.r0).toFixed(2); delete c.r0; c.gcd = +(s.gcd - c.s0.gcd).toFixed(3); c.cd = +(s.cd - c.s0.cd).toFixed(3); c.res = +(s.res - c.s0.res).toFixed(2); c.buffs = +(s.buffs - c.s0.buffs).toFixed(2); delete c.s0; delete c.last; M.locks.push(c); M.cur = null; }
          if (M.cur) {
            const c = M.cur; c.last = snap(p); c.moved = Math.max(c.moved, Math.hypot(p.pos.x - c.x, p.pos.z - c.z)); if (p.casting && p.casting !== M.lastCast) c.casts++;
            c.frames++; if (G.state === 'fight' && c.frames > 2 && document.querySelector('#hud.on')) c.hudOn++;
          } else if (G.state === 'fight') { if (M.lastPos) M.free.moved += Math.hypot(p.pos.x - M.lastPos.x, p.pos.z - M.lastPos.z); if (p.casting && p.casting !== M.lastCast) M.free.casts++; }
          M.lastPos = { x: p.pos.x, z: p.pos.z }; M.lastCast = p.casting;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, bot);
    let held = !bot, tap = null;
    if (held) { await page.keyboard.down('KeyW'); tap = setInterval(() => { page.keyboard.press('Digit1').catch(() => {}); }, 180); }
    await page.waitForFunction('window.__game.G.state === "fight"', null, { timeout: 120000 });
    const n = await page.evaluate(() => window.__game.G.boss.def.phases.length);
    for (let i = 1; i < n; i++) { await page.waitForTimeout(6000); await page.evaluate((i) => window.__game.setPhase(i), i); await page.waitForTimeout(14000); }
    await page.waitForTimeout(4000); await page.evaluate(() => window.__game.kill());
    await page.waitForTimeout(12000);
    if (tap) clearInterval(tap); if (held) await page.keyboard.up('KeyW').catch(() => {});
    const r = await page.evaluate(() => { const M = window.__cl; if (M.cur) { M.cur.dur = 'open'; delete M.cur.s0; delete M.cur.last; M.locks.push(M.cur); } return { state: window.__game.G.state, phases: window.__game.G.boss ? window.__game.G.boss.phase : -1, locks: M.locks, free: { moved: Math.round(M.free.moved), casts: M.free.casts } }; });
    for (const l of r.locks) { const leak = l.moved > 0.05 || l.casts || (l.gcd && l.gcd < 0) || (l.cd && l.cd < 0) || (l.res && l.res > 0) || l.hudOn; l.moved = +l.moved.toFixed(2); l.t0 = +l.t0.toFixed(1); delete l.frames; if (leak) { l.LEAK = true; bad++; } }
    console.log(boss + (nm ? ' NM ' : ' ') + cls + (bot ? ' bot' : ' keys') + ': end ' + r.state + ', free ' + JSON.stringify(r.free));
    for (const l of r.locks) console.log('   ' + JSON.stringify(l));
    await browser.close();
  }
  console.log(bad ? bad + ' LEAKS' : 'no leaks');
})();
