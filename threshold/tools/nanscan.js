// node nanscan.js [boss ...] : NaN audit. Loads the game with ?strictmath (out-of-domain shader math returns NaN, as on
// real GPUs; SwiftShader otherwise hides it) and MSAA on, plays every phase with every class under the autopilot, and
// renders a float frame every couple of seconds, counting NaN/Inf pixels. Any non-zero count is a black-square bug on a
// real GPU. With no args it scans every door. Exit code 1 if anything was found. CLASSES=a,b limits the classes (the first
// one is also the menu selection, which door VII copies for its dolls). Each sample also fires the class effects the
// god-mode autopilot never triggers (heal, dodge).
const { launch } = require('./harness.js');
(async () => {
  const { browser, page } = await launch({ w: 480, h: 270 });
  await page.goto('http://game.local/threshold/?mute=1&quality=high&seed=5' + (process.env.NANSCAN_SAFE ? '' : '&strictmath') + (process.env.CLASSES ? '&class=' + process.env.CLASSES.split(',')[0] : ''));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 120000 });
  const all = await page.evaluate(() => window.__game.G.bosses.map((d) => d.id));
  const bosses = process.argv.slice(2).length ? process.argv.slice(2) : all;
  let found = 0;
  for (const boss of bosses) {
    const r = await page.evaluate(([boss, only]) => {
      const g = window.__game, out = []; g.bot(3); g.god(true);
      const n = g.G.bosses.find((d) => d.id === boss).phases.length;
      for (const cls of (only || g.G.classes.map((c) => c.id))) for (let ph = 0; ph < n; ph++) {
        g.start(boss, { cls, phase: ph }); const b = g.G.boss; let worst = { bad: 0 }, shots = 0;
        for (let k = 0; k < 8; k++) {
          g.fastForward(2.5); { const p = g.G.player; p.heal(1); if (p.cls.onDodge) { p.dodged = false; p.cls.onDodge(p, {}); } } g.warm(0.5); b.hp = Math.max(b.hp, b.maxHp * (ph + 1 < n ? b.def.phases[ph + 1].at + 0.01 : 0.02));
          const s = g.nanScan(); shots++; if (s.bad > worst.bad) worst = Object.assign(s, { t: +g.G.ft.toFixed(1), cast: b.castState ? b.castState.name : '', by: g.nanScanBy() });
        }
        out.push({ cls, ph, shots, bad: worst.bad, at: worst.t, cast: worst.cast, where: worst.where, by: worst.by, err: g.G.errors.slice(0, 2) });
      }
      g.god(false); return out;
    }, [boss, process.env.CLASSES ? process.env.CLASSES.split(',') : null]);
    for (const o of r) { if (o.bad) found++; console.log(`${boss} ${o.cls} p${o.ph}: ${o.bad ? 'NaN px=' + o.bad + ' t=' + o.at + ' cast=' + o.cast + ' at ' + JSON.stringify(o.where) + ' from ' + JSON.stringify(o.by) : 'clean'}${o.err.length ? ' ERR ' + o.err.join(' | ') : ''}`); }
  }
  console.log(found ? `FOUND NaN in ${found} runs` : 'ALL CLEAN');
  await browser.close(); process.exit(found ? 1 : 0);
})();
