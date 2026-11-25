// node critfuzz.js [runs] [classes|all] : door XIX nightmare finale. Every Critique there asks for a half and a paint, judged at the
// instant it lands, so each one is route-checked before it is cast (and repaired by the boss if the walk is too long). This plays the
// finale (god mode) `runs` times per class with the level-3 autopilot and with a lazy one that never washes or fetches
// paint, and records every Critique: the call, the route time before and after repair, the cast time, the repair used, the verdict.
// Pass: no route failure (a cast stretched because no answer fit), all 12 calls appear, repairs in under 25% of the level-3 Critiques.
// Also checks wantWear / wantSide against the table in the plan. MAXSEC= caps each run (default 110 s of finale).
// STEPS=0,3,4 (default): each run is played from that ramp step (sitting count forced), so the slow seam, the fast seam (step 3)
// and the paired Critiques (step 4, both Critiques of a pair) are all checked.
const { launch } = require('./harness.js');
(async () => {
  const [runs = '25', clsArg = 'all'] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=' + (process.env.SEED || 11));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate(([runs, clsArg, maxSec, steps]) => {
    const g = window.__game, G = g.G, def = g.def('atelier'), T = def.nmTest, fails = [];
    // the table: what he shows -> what you must be
    const table = [['w', 1, 1, 1], ['w', 3, 3, 1], ['b', 1, 6, -1], ['b', 3, 4, -1], ['w', 0, 0, 1], ['b', 0, 7, -1], ['w', 4, 4, 1], ['b', 5, 2, -1], ['b', 2, 5, -1], ['b', 6, 1, -1]];
    for (const [tone, col, wear, side] of table) { const c = { tone, col }; if (T.wantWear(c) !== wear || T.wantSide(c) !== side) fails.push(`table ${tone}+${col}: wear ${T.wantWear(c)} side ${T.wantSide(c)}`); }
    if (T.sideAt(0, 1, 0) !== 1 || T.sideAt(0, -1, 0) !== -1 || T.sideAt(0, 0.3, 5) !== 0) fails.push('sideAt');
    const classes = clsArg === 'all' ? G.classes.map((c) => c.id) : clsArg.split(',');
    const out = {};
    for (const st of steps) for (const lazy of [false, true]) for (const cls of classes) {
      const key = cls + (lazy ? ' lazy' : ' L3') + ' s' + st, agg = out[key] = { crits: 0, fail: 0, time: 0, sigTime: 0, fixed: 0, fixWash: 0, fixPaint: 0, ok: 0, calls: {}, worstR: 0, sig: 0, runs: 0 };
      for (let k = 0; k < runs; k++) {
        g.bot(3); g.god(true); g.Bot.lazy = lazy; g.start('atelier', { cls, phase: 2 }); G.headless = true;
        const b = G.boss, S = b.state; let t = 0, forced = false;
        while (t < maxSec + 8) { const s = g.fastForward(2); t += 2; if (s.state !== 'fight') break; if (!forced && b.phase === 2 && !b.transitioning) { forced = true; S.fk = st * T.SIT_PER_STEP; } if (b.hp < b.maxHp * 0.03) b.hp = b.maxHp * 0.12; }
        agg.runs++; if (S.sigDone) agg.sig++;
        for (const q of S.critLog) {
          agg.crits++; agg.calls[q.call] = (agg.calls[q.call] || 0) + 1; if (q.fail) agg.fail++; if (q.stretch > 0) { if (q.sig) agg.sigTime++; else agg.time++; } if (/wash|paint/.test(q.fix)) agg.fixed++; if (/wash/.test(q.fix)) agg.fixWash++; if (/paint/.test(q.fix)) agg.fixPaint++; if (q.ok) agg.ok++;
          if (q.r < 99 && q.r > agg.worstR) agg.worstR = q.r; if ((q.fail || (q.stretch > 0 && !lazy && !q.sig)) && fails.length < 12) fails.push(`${key} run ${k}: ${JSON.stringify(q)}`);
        }
        if (G.errors.length && fails.length < 12) fails.push(`${key}: ${JSON.stringify(G.errors.slice(0, 2))}`);
      }
    }
    g.Bot.lazy = false; g.god(false);
    return { out, fails };
  }, [+runs, clsArg, +(process.env.MAXSEC || 110), (process.env.STEPS || '0,3,4').split(',').map(Number)]);
  const all = new Set(); let fail = 0, l3c = 0, l3f = 0, l3t = 0;
  console.log('who'.padEnd(18) + 'runs  crits  no-answer  stretched (sig)  repaired (wash/paint)  matched  worst route  signature');
  for (const [k, a] of Object.entries(r.out)) {
    Object.keys(a.calls).forEach((c) => all.add(c)); fail += a.fail; if (/L3/.test(k)) { l3c += a.crits; l3f += a.fixed; l3t += a.time; }
    console.log(k.padEnd(18) + String(a.runs).padStart(4) + String(a.crits).padStart(7) + String(a.fail).padStart(11) + `${a.time} (${a.sigTime})`.padStart(16) + `${String(Math.round(a.fixed / Math.max(1, a.crits) * 100)).padStart(9)}% (${a.fixWash}/${a.fixPaint})`.padEnd(23) + `${Math.round(a.ok / Math.max(1, a.crits) * 100)}%`.padStart(8) + `${a.worstR.toFixed(2)} s`.padStart(13) + `${a.sig}/${a.runs}`.padStart(11));
  }
  const calls = [...all].sort(); console.log(`calls seen (${calls.length}/12): ${calls.join(' ')}`);
  const rate = l3f / Math.max(1, l3c);
  const trate = l3t / Math.max(1, l3c), pass = fail === 0 && calls.length === 12 && rate < 0.25 && trate <= 0.05;
  if (r.fails.length) console.log(r.fails.join('\n'));
  console.log(`level-3: repaired ${(rate * 100).toFixed(1)}%, stretched ${(trate * 100).toFixed(1)}% (signature excluded)  ->  ${pass ? 'PASS' : 'FAIL'}`);
  await browser.close(); process.exit(pass ? 0 : 1);
})();
