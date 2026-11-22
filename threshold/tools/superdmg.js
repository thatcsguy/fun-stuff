// node superdmg.js [door ids...] : with the god mode + super damage testing settings on, a level-3 autopilot clears every
// door (normal and, where one exists, nightmare). Checks phases advance one at a time in order, the player never dies,
// the boss dies, nothing throws, and no record is saved.
const { launch } = require('./harness.js');
(async () => {
  const only = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=3');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate((only) => {
    const g = window.__game, G = g.G, out = [], S = g.Settings; S.godMode = true; S.superDmg = true; g.bot(3);
    const save0 = localStorage.getItem('th_save');
    for (const d of G.bosses) for (const nm of [false, true]) {
      if (only.length && !only.includes(d.id)) continue; if (nm && !d.nightmare) continue;
      g.start(d.id, { nm }); const b = G.boss, n = b.def.phases.length, seq = [], err = [];
      const oe = window.onerror; let t = 0, minHp = 1e9, last = -2;
      try {
        while (t < 900 && G.state !== 'win' && G.state !== 'dead') { g.fastForward(0.5, false); t += 0.5; if (b.phase !== last) { seq.push(b.phase + '@' + G.ft.toFixed(0)); last = b.phase; } minHp = Math.min(minHp, G.player.hp); }
      } catch (e) { err.push(String(e)); }
      const ok = G.state === 'win' && seq.map((s) => +s.split('@')[0]).every((p, i) => p === i) && seq.length === n;
      out.push((ok ? 'OK  ' : 'BAD ') + d.id + (nm ? ' NM' : '') + ' phases ' + seq.join(' ') + ' / ' + n + ' state=' + G.state + ' t=' + G.ft.toFixed(0) + ' minHp=' + Math.round(minHp) + ' dmg=' + Math.round(G.player.stats.taken) + (err.length ? ' ERR ' + err : ''));
    }
    out.push('save unchanged: ' + (localStorage.getItem('th_save') === save0));
    return out;
  }, only);
  console.log(r.join('\n'));
  await browser.close();
})();
