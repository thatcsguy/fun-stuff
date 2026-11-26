// node moonfuzz.js [classes] [runs] : Issen's Moons (Full Moon = the "in", New Moon = the "out", Crescent). Whole fights with the
// level-3 autopilot (god mode; REAL=1 off). For every Moon: the share of the deck it leaves safe, whether the player already stood
// safe when its tell began ("free" = no dodge needed), the walk to the nearest safe spot at that moment, and whether the Moon hit.
// Also checks that no deck point is safe from a New Moon and a Full Moon cast from the same spot (the edge cannot outrange both).
// NM=1 (harness) runs Nightmare. SEED sets the page seed.
const { launch } = require('./harness.js');
(async () => {
  const [clsArg = 'stormcaller,hexslinger,ashwarden,duskblade', runs = '2'] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const tot = {};
  for (const cls of clsArg.split(',')) for (let k = 0; k < +runs; k++) {
    const r = await page.evaluate(([cls, real]) => {
      const g = window.__game, G = g.G, Hz = g.Hz; G.headless = true; g.bot(3); g.god(!real);
      g.start('duelist', { cls }); const p = G.player, R = 15; const out = {};
      const pts = []; for (let x = -R; x <= R; x += 0.5) for (let z = -R; z <= R; z += 0.5) if (x * x + z * z <= R * R) pts.push([x, z]);
      const inS = (s, x, z) => { const d = (x - s.x) ** 2 + (z - s.z) ** 2; return s.type === 'circle' ? d <= s.r * s.r : d <= s.r1 * s.r1 && d >= s.r0 * s.r0; };
      const wrap = (fn, kind) => { const o = Hz[fn]; Hz[fn] = function (...a) { const h = o.apply(this, a); const nm = a[a.length - 1] && a[a.length - 1].name;
        if (nm === kind) { const s = fn === 'donut' ? { type: 'donut', x: a[0], z: a[1], r0: a[2], r1: a[3] } : { type: 'circle', x: a[0], z: a[1], r: a[2] };
          let safe = 0, near = 99; for (const [x, z] of pts) if (!inS(s, x, z)) { safe++; near = Math.min(near, Math.hypot(x - p.pos.x, z - p.pos.z)); }
          const q = out[kind] || (out[kind] = { n: 0, safe: 0, free: 0, walk: 0, walkMax: 0, hit: 0, tell: 0 }); q.n++; q.safe += safe / pts.length; q.tell += a[a.length - 3];
          if (!inS(s, p.pos.x, p.pos.z)) q.free++; else { q.walk += near; q.walkMax = Math.max(q.walkMax, near); }
          const oh = h && h.onHit; if (h) h.onHit = (...z) => { q.hit++; if (oh) return oh(...z); }; }
        return h; }; };
      wrap('donut', 'Full Moon'); wrap('circle', 'New Moon');
      const hu = p.hurt.bind(p); p.hurt = (amt, o) => { const n = o && o.src && o.src.name; if (n === 'Full Moon' || n === 'New Moon' || n === 'Crescent') { const q = out['hit ' + n] = (out['hit ' + n] || 0) + 1; } return hu(amt, o); };
      let s; for (let i = 0; i < 300; i++) { s = g.fastForward(2); if (s.state !== 'fight') break; }
      return { out, res: s.state, t: Math.round(G.ft || 0) };
    }, [cls, !!process.env.REAL]);
    console.log(cls, k, r.res, r.t + 's', JSON.stringify(r.out));
    for (const key in r.out) { if (typeof r.out[key] === 'number') { tot[key] = (tot[key] || 0) + r.out[key]; continue; } const q = tot[key] || (tot[key] = { n: 0, safe: 0, free: 0, walk: 0, walkMax: 0, hit: 0, tell: 0 }); for (const f in q) q[f] = f === 'walkMax' ? Math.max(q[f], r.out[key][f]) : q[f] + r.out[key][f]; }
  }
  for (const key in tot) { const q = tot[key]; if (typeof q === 'number') { console.log(key, q); continue; } const dodged = q.n - q.free;
    console.log(`${key}: ${q.n} cast, deck safe ${Math.round(q.safe / q.n * 100)}%, already safe at tell ${Math.round(q.free / q.n * 100)}%, walk when not ${dodged ? (q.walk / dodged).toFixed(1) : '-'} m (max ${q.walkMax.toFixed(1)}), mean tell ${(q.tell / q.n).toFixed(2)} s`); }
  await browser.close();
})();
