// node hitch.js <boss> [cls] : plays the fight in real frames (god + bot), forces each phase in turn, and reports
// every shader program compiled after the fight started, plus the longest frames around each transition.
const { launch } = require('./harness.js');
(async () => {
  const boss = process.argv[2], cls = process.argv[3] || 'duskblade', q = process.env.Q || 'high';
  const { browser, page } = await launch({ w: 320, h: 180 });
  await page.goto('http://game.local/threshold/?mute=1&quality=' + q + '&seed=3');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  if (process.env.FAST) await page.evaluate(() => { window.__game.G.headless = false; });
  const r = await page.evaluate(async ({ boss, cls }) => {
    const g = window.__game, R = g.renderer, raf = () => new Promise((res) => requestAnimationFrame(res));
    g.bot(3); g.god(true); g.start(boss, { cls, skipIntro: true });
    const def = g.G.bosses.find((d) => d.id === boss), n = def.phases.length, log = [];
    for (let i = 0; i < 20; i++) await raf();
    const base = R.info.programs.length; let seen = new Set(R.info.programs), lastL = -1; const lightsAt = new Set(); g.scene.traverse((o) => { if (o.isLight) lightsAt.add(o); });
    const watch = async (label, frames) => {
      let worst = 0, t0 = performance.now();
      for (let f = 0; f < frames; f++) {
        const a = performance.now(); await raf(); const d = performance.now() - a; if (d > worst) worst = d;
        for (const p of R.info.programs) if (!seen.has(p)) { seen.add(p); let who = '?'; g.scene.traverse((o) => { const ms = o.material ? [].concat(o.material) : []; for (const m of ms) if (R.properties.get(m).currentProgram === p) { let a = o, path = []; while (a && path.length < 5) { path.push(a.type + (a.name ? ':' + a.name : '') + (a.isBoss ? '' : '')); a = a.parent; } who = path.join('<') + ' ' + m.type + (m.name ? ':' + m.name : '') + (m.map ? ' map' : '') + ' inBossGroup=' + (() => { let q = o; while (q) { if (g.G.boss && q === g.G.boss.group) return 1; if (g.G.player && q === g.G.player.group) return 'player'; q = q.parent; } return 0; })(); } }); log.push(label + ' f' + f + ' NEW ' + who + ' | ' + p.cacheKey.slice(0, 40).replace(/\s+/g,' ')); }
        let nl = 0; g.scene.traverseVisible((o) => { if (o.isLight) nl++; }); if (nl !== lastL) { const nw = []; g.scene.traverseVisible((o) => { if (o.isLight && !lightsAt.has(o)) nw.push(o.type + (o.castShadow ? '+s' : '') + '@' + (o.parent && (o.parent.name || o.parent.type))); }); log.push(label + ' f' + f + ' lights ' + lastL + ' -> ' + nl + ' new: ' + nw.join(' ')); lastL = nl; }
      }
      log.push(label + ' worst frame ' + worst.toFixed(0) + 'ms');
    };
    await watch('p0', 120);
    for (let ph = 1; ph < n; ph++) { g.setPhase(ph); await watch('p' + ph, 300); }
    return { base, total: R.info.programs.length, log };
  }, { boss, cls });
  console.log(boss, cls, 'programs at fight start', r.base, 'after all phases', r.total); console.log(r.log.join('\n'));
  await browser.close();
})();
