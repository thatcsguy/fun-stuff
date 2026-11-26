// node gardenfuzz.js [classes|all] [runs] : Euryale's Nightmare garden. Whole fights from phase 1 with the level-3 autopilot (god mode
// unless REAL=1) and per phase: live time, the share of it she was open (cracked), Beholds and the statues each one crumbled
// (0 = a wasted stare), Stone Grasps and petrifies taken, and the most statues awake at once. GARDENBLIND=1 ignores the
// garden (looks at her, stands anywhere): it must not kill. PHASE=n starts at phase n.
const { launch } = require('./harness.js');
(async () => {
  const [clsArg = 'all', runs = '2'] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const classes = await page.evaluate((c) => c === 'all' ? window.__game.G.classes.map((q) => q.id) : c.split(','), clsArg);
  const env = { real: !!process.env.REAL, blind: !!process.env.GARDENBLIND, phase: +(process.env.PHASE || 0) };
  const fmt = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  for (const cls of classes) for (let k = 0; k < +runs; k++) {
    const r = await page.evaluate(([cls, env]) => {
      const g = window.__game, G = g.G; G.headless = true; g.bot(3); g.god(!env.real); g.Bot.gardenBlind = env.blind;
      g.start('gorgon', { cls, phase: env.phase }); const b = G.boss, p = G.player, S = b.state, ph = [];
      const P = (i) => ph[i] || (ph[i] = { live: 0, open: 0, grasp: 0, petrify: 0, maxAwake: 0, hurt: 0, by: {} });
      const hu = p.hurt.bind(p); p.hurt = (amt, o) => { if (b.phase >= 0) { const q = P(b.phase), n = o && o.src && o.src.name; if (n === 'Stone Grasp') q.grasp++; if (n === 'Behold') q.petrify++; if (!(o && o.src === 'enrage')) { q.hurt += amt; const k = n || (o && typeof o.src === 'string' ? o.src : 'other'); q.by[k] = (q.by[k] || 0) + amt; } } return hu(amt, o); };
      const onStep = (dt) => { if (G.state !== 'fight' || b.phase < 0 || b.transitioning) return; const q = P(b.phase); q.live += dt; if (b.dmgTaken === 1) q.open += dt; q.maxAwake = Math.max(q.maxAwake, G.ents.filter((e) => e.isAdd && e.alive).length); };
      let s; for (let i = 0; i < 260; i++) { s = g.fastForward(2, true, onStep); if (s.state !== 'fight') break; }
      const fed = [[], [], []]; for (const v of S.fedLog) fed[Math.floor(v / 100)].push(v % 100);
      g.god(false); g.Bot.gardenBlind = false;
      return { state: s.state, t: s.t, src: s.src, boss: s.boss, ph: ph.map((q, i) => q && Object.assign(q, { fed: fed[i] })), stepAt: (S.stepAt || []).slice(), err: s.errors };
    }, [cls, env]);
    const res = r.state === 'win' ? 'KILL ' + fmt(r.t) : r.state === 'dead' && r.src === 'enrage' ? 'OUT ' + fmt(r.t) + ' boss ' + r.boss + '%' : r.state + ' ' + fmt(r.t) + ' ' + JSON.stringify(r.src) + ' boss ' + r.boss + '%';
    console.log(cls.padEnd(12) + res);
    r.ph.forEach((q, i) => { if (!q) return; const z = q.fed.filter((n) => !n).length, tot = q.fed.reduce((a, n) => a + n, 0);
      console.log(`   P${i + 1} ${String(Math.round(q.live)).padStart(3)}s open ${String(Math.round(q.open / Math.max(1, q.live) * 100)).padStart(3)}%  beholds ${q.fed.length} fed [${q.fed.join(' ')}] (${tot}, ${z} wasted)  grasp ${q.grasp} petrify ${q.petrify} hurt ${Math.round(q.hurt)}  max awake ${q.maxAwake}` + (process.env.BY ? '\n      ' + Object.entries(q.by).sort((x, y) => y[1] - x[1]).map(([k, v]) => k + ' ' + Math.round(v)).join(', ') : '')); });
    if (r.err && r.err.length) console.log('   ERR ' + JSON.stringify(r.err).slice(0, 300));
  }
  await browser.close();
})();
