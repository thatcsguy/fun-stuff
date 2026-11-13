// node festsoak.js [runs] : door XIV volley planner soak test. For many seeds, builds each act's colour layout, plays out a
// run of volley picks with the real weights, and checks every volley against its archetype's definition plus variety.
const { launch } = require('./harness.js');
(async () => {
  const runs = +(process.argv[2] || 300);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=1');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate((runs) => {
    const g = window.__game, G = g.G; G.headless = true; g.start('festival', { cls: 'duskblade' }); g.fastForward(1);
    const F = G.festTest, S0 = G.boss.state, rng0 = G.rng, fails = [], stats = { A: 0, B: 0, C: 0, D: 0, T: 0 }, maxShare = [0, 0, 0], minAns = [99, 99, 99], pools = [[], [], []], layouts = [new Set(), new Set(), new Set()];
    const W = [{ A: 1 }, { A: 0.45, B: 0.45, C: 0.1 }, { A: 0.35, B: 0.25, C: 0.1, D: 0.3 }], VOL = [10, 9, 9];
    const mul = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    const t0 = performance.now(); let tLayout = 0, nLayout = 0;
    for (let run = 0; run < runs; run++) {
      G.rng = mul(1000 + run * 7919);
      for (let n = 0; n < 3; n++) {
        const S = { fuses: S0.fuses, spiral: S0.spiral }, c = F.ACT[n]; const tl = performance.now(); F.makeLayout(S, n); tLayout += performance.now() - tl; nLayout++;
        layouts[n].add(S.types.join(''));
        if (S.types.some((x, k) => x === S.types[(k + 1) % 8])) fails.push('adjacent colours ' + S.types);
        pools[n].push(['A', 'B', 'C', 'D'].map((a) => S.pools[a].length).join('/'));
        const seq = n === 0 ? F.teach(S) : []; const count = {}, answers = new Set(); let last = '', hist = [];
        for (let v = 0; v < VOL[n]; v++) {
          const pl = n === 0 ? (seq[v] || F.pickPlan(S, 'A')) : F.pickPlan(S, F.nextArch(S, W[n]));
          if (!pl) { fails.push('no plan act ' + n); continue; }
          S.hist.push(pl.arch); S.lastLit = pl.lit.slice().sort().join(','); stats[pl.arch]++;
          const key = S.lastLit; if (key === last && pl.arch !== 'T') fails.push('repeat lit ' + key); last = key; count[key] = (count[key] || 0) + 1;
          if (pl.arch !== 'T') answers.add(pl.answer); hist.push(pl.arch); const L = hist.length; if (n > 0 && L >= 3 && hist[L - 1] === hist[L - 2] && hist[L - 2] === hist[L - 3]) fails.push('3x ' + pl.arch);
          const all = F.evalSet(S, pl.lit), ka = F.kind(all), drop = pl.lit.map((k) => ({ k, c: F.kind(F.evalSet(S, pl.lit.filter((j) => j !== k))) }));
          const total = c.T + F.RISE + (n === 0 && v < 6 ? 1.6 : c.warn), bad = (m) => fails.push(n + ':' + pl.arch + ' ' + m + ' lit=' + pl.lit + ' types=' + S.types);
          if (pl.arch === 'T') { if (ka !== 'ok') bad('teaching set not survivable'); continue; }
          if (drop.some((d) => d.c === 'sliver') || ka === 'sliver') bad('sliver');
          const okd = drop.filter((d) => d.c === 'ok').map((d) => d.k);
          if (pl.arch === 'A') { if (ka !== 'dead') bad('A all-lit not dead'); if (!okd.includes(pl.answer)) bad('A answer not ok'); if (okd.length !== 1 && n !== 0) bad('A has ' + okd.length + ' answers'); if (n === 0 && v === 5 && S.types[pl.lit[0]] !== 'ring') bad('teach yellows'); if (!F.reachOK(S.fuses[pl.answer], c.T, pl.safe, total)) bad('A reach'); }
          if (pl.arch === 'B') { if (ka !== 'dead') bad('B all-lit not dead'); if (okd.length !== 2 || !okd.includes(pl.answer) || !okd.includes(pl.keep) || pl.answer === pl.keep) bad('B answers ' + okd);
            const hits = pl.lit.filter((k) => F.shapesOf(S.types[k], k).some((s) => F.inShape(s, pl.spot[0], pl.spot[1]))); if (hits.length !== 1 || hits[0] !== pl.keep) bad('B spot covered by ' + hits); }
          if (pl.arch === 'C' || pl.arch === 'D') { if (ka !== 'ok' || all.big.length > F.TIGHT) bad('C/D not tight-ok ' + all.big.length); if (pl.arch === 'D' && n !== 2) bad('D outside act 3'); }
        }
        minAns[n] = Math.min(minAns[n], answers.size); const share = Math.max(...Object.values(count)) / VOL[n]; if (share > maxShare[n]) maxShare[n] = share;
      }
    }
    G.rng = rng0;
    const ps = pools.map((p) => { const a = p.map((s) => s.split('/').map(Number)); return ['A', 'B', 'C', 'D'].map((x, i) => x + ' min ' + Math.min(...a.map((r) => r[i])) + ' med ' + a.map((r) => r[i]).sort((u, v) => u - v)[a.length >> 1]).join(', '); });
    return { runs, ms: Math.round(performance.now() - t0), layoutMs: +(tLayout / nLayout).toFixed(1), fails: fails.length, firstFails: [...new Set(fails)].slice(0, 12), stats, maxLitShareInOneRun: maxShare, minDistinctAnswersInOneRun: minAns, pools: ps, distinctLayouts: layouts.map((s) => s.size) };
  }, runs);
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
