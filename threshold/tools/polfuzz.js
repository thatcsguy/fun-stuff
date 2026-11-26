// node polfuzz.js : Parallax Nightmare design checks for Polarize (exit code 1 on a failure). Independent of the boss file's own
// deck filter: it measures the real floor.
// 1. Boards (nmTest.BOARDS: the full 7x7, phase II, and every Totality board down to the 3x3 ring). For each pattern in that
//    board's deck (nmTest.deckOf, what the fight draws from), both inversions: each colour has at least 2 present tiles (3 on
//    boards of 12 or more), and from the centre of every present painted tile a tile of the other colour can be walked to
//    (0.4 m inside it, over present floor, around the core's body) within lastWindow - 0.25 s at 7 m/s. Beams are out at that
//    moment, so they are not part of the check. Patterns left out of a deck that would pass are listed as information.
// 2. Flip schedules (nmTest.flipSchedule) for every cast time and flip range in POL, 20,000 random draws each: the count is in
//    range, the first flip comes no earlier than POL.firstAt, flips are at least POL.gap apart and the last leaves lastWindow.
// 3. Information: per Totality step and its arm count, over every deck pattern, inversion, condemned colour and beam angle (1 deg
//    steps), the share of beam positions where some wedge holds no live tile (its centre inside the wedge), and where the
//    wedge with the fewest live tiles has none.
const { launch } = require('./harness.js');
(async () => {
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=3');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const g = window.__game, def = g.G.bosses.find((d) => d.id === 'engine'), T = def.nmTest, out = [], info = []; let fail = 0;
    const { N, TS, HALF, CTR, PATTERNS, POL, SWEEP, BOARDS } = T, walk = (POL.lastWindow - 0.25) * 7;
    const cx = (i) => -HALF + TS * ((i % N) + 0.5), cz = (i) => -HALF + TS * (Math.floor(i / N) + 0.5);
    // walking distance over present floor on a 0.25 m grid (8-connected), avoiding the core's body (radius 2.3 + 0.4)
    const H = 0.25, M = Math.round(2 * HALF / H);
    const dist = (set, from, goalFn) => {
      const isP = (x, z) => { const ix = Math.floor((x + HALF) / TS), iz = Math.floor((z + HALF) / TS); return ix >= 0 && iz >= 0 && ix < N && iz < N && set.has(iz * N + ix) && Math.hypot(x, z) > 2.7; };
      const D = new Float32Array(M * M).fill(1e9), at = (k) => [-HALF + (k % M + 0.5) * H, -HALF + (Math.floor(k / M) + 0.5) * H];
      const s0 = Math.floor((from[1] + HALF) / H) * M + Math.floor((from[0] + HALF) / H); D[s0] = 0; let front = [s0];
      while (front.length) { const nx = []; for (const k of front) { const [x, z] = at(k); if (goalFn(x, z)) return D[k]; if (D[k] > walk + 1) continue;
        for (const [dx, dz, c] of [[1, 0, H], [-1, 0, H], [0, 1, H], [0, -1, H], [1, 1, H * 1.414], [1, -1, H * 1.414], [-1, 1, H * 1.414], [-1, -1, H * 1.414]]) { const kx = k % M + dx, kz = Math.floor(k / M) + dz; if (kx < 0 || kz < 0 || kx >= M || kz >= M) continue; const k2 = kz * M + kx, [x2, z2] = at(k2); if (!isP(x2, z2)) continue; const d2 = D[k] + c; if (d2 < D[k2] - 1e-6) { D[k2] = d2; nx.push(k2); } } }
        nx.sort((a, b) => D[a] - D[b]); front = nx; }
      return Infinity;
    };
    for (const name in BOARDS) {
      const list = BOARDS[name], set = new Set(list), isP = (i) => set.has(i), deck = T.deckOf(isP);
      const painted = list.filter((i) => i !== CTR), min = painted.length >= 12 ? 3 : 2; let worst = 0;
      const check = (k, inv) => {
        const col = (i) => (PATTERNS[k](i % N, Math.floor(i / N)) ^ inv) ? 1 : 2, c = [0, 0, 0]; for (const i of painted) c[col(i)]++;
        if (c[1] < min || c[2] < min) return `colour counts ${c[1]}/${c[2]} (need ${min})`;
        for (const i of painted) { const other = 3 - col(i);
          const goal = (x, z) => { const ix = Math.floor((x + HALF) / TS), iz = Math.floor((z + HALF) / TS), j = iz * N + ix; if (j === CTR || !set.has(j) || col(j) !== other) return false; const ex = Math.min(x + HALF - ix * TS, (ix + 1) * TS - HALF - x), ez = Math.min(z + HALF - iz * TS, (iz + 1) * TS - HALF - z); return Math.min(ex, ez) >= 0.4 + 0.12; };
          const d = dist(set, [cx(i), cz(i)], goal); if (deck.includes(k)) worst = Math.max(worst, d); if (d > walk) return `tile ${i % N},${Math.floor(i / N)}: ${d === Infinity ? 'no' : d.toFixed(1) + ' m to a'} safe tile (limit ${walk.toFixed(2)} m)`; }
        return null;
      };
      const bad = [], extra = [];
      for (let k = 0; k < PATTERNS.length; k++) { const e0 = check(k, 0), e1 = check(k, 1), inDeck = deck.includes(k); if (inDeck && (e0 || e1)) bad.push(`pattern ${k}: ${e0 || e1}`); if (!inDeck && !e0 && !e1) extra.push(k); }
      if (bad.length) fail++;
      out.push(`${bad.length ? 'FAIL' : 'ok  '} ${name.padEnd(24)} ${String(painted.length).padStart(2)} tiles  deck [${deck.join(',')}]  worst walk ${worst.toFixed(1)} m` + (extra.length ? `  (would also pass: ${extra.join(',')})` : '') + (bad.length ? '\n       ' + bad.join('\n       ') : ''));
    }
    // flip schedules
    const ranges = new Set(); POL.time.forEach((t, i) => ranges.add(t + ':' + POL.flips[i].join('-'))); POL.teachTime.forEach((t) => { ranges.add(t + ':1-2'); ranges.add(t + ':1-1'); ranges.add(t + ':0-0'); });
    for (const key of ranges) {
      const [t, rg] = key.split(':'), [lo, hi] = rg.split('-').map(Number), time = +t; let bad = 0, nmin = 9, nmax = 0, lastMax = 0, firstMin = 9, gapMin = 9;
      for (let k = 0; k < 20000; k++) { const s = T.flipSchedule(time, lo, hi, Math.random); nmin = Math.min(nmin, s.length); nmax = Math.max(nmax, s.length);
        if (s.length) { firstMin = Math.min(firstMin, s[0]); lastMax = Math.max(lastMax, s[s.length - 1]); for (let i = 1; i < s.length; i++) gapMin = Math.min(gapMin, s[i] - s[i - 1]); }
        if (s.length < lo || s.length > hi || (s.length && (s[0] < POL.firstAt - 1e-9 || time - s[s.length - 1] < POL.lastWindow - 1e-9))) bad++;
        for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] < POL.gap - 1e-9) bad++; }
      if (bad) fail++;
      out.push(`${bad ? 'FAIL' : 'ok  '} flips ${time.toFixed(1)} s, ${lo}-${hi}: drawn ${nmin}-${nmax}, first >= ${firstMin === 9 ? '-' : firstMin.toFixed(2)} s, gap >= ${gapMin === 9 ? '-' : gapMin.toFixed(2)} s, last window >= ${lastMax ? (time - lastMax).toFixed(2) : '-'} s` + (bad ? ` (${bad} bad)` : ''));
    }
    // wedges with no live tile, per Totality step
    const stepBoard = ['5x5 (step 0)', 'no corners (step 1)', 'no edge middles (step 2)', 'pinwheel (step 3)', '3x3 ring (steps 4-5)', '3x3 ring (steps 4-5)'];
    for (let st = 0; st < 6; st++) {
      const list = BOARDS[stepBoard[st]], set = new Set(list), deck = T.deckOf((i) => set.has(i)), n = SWEEP.arms[st], painted = list.filter((i) => i !== CTR); let tot = 0, some = 0, mean = 0;
      for (const k of deck) for (const inv of [0, 1]) for (const dead of [1, 2]) {
        const liveT = painted.filter((i) => ((PATTERNS[k](i % N, Math.floor(i / N)) ^ inv) ? 1 : 2) !== dead);
        for (let a = 0; a < 360; a++) { const a0 = a / 180 * Math.PI, cnt = new Array(n).fill(0);
          for (const i of liveT) { const pa = Math.atan2(cx(i), cz(i)), rel = ((pa - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); cnt[Math.floor(rel / (2 * Math.PI / n))]++; }
          tot++; if (cnt.some((c) => c === 0)) some++; mean += cnt.filter((c) => c === 0).length / n; } }
      info.push(`step ${st}: ${String(painted.length).padStart(2)} tiles, ${n} arms: some wedge empty at ${Math.round(some / tot * 100)}% of beam angles, a random wedge empty ${Math.round(mean / tot * 100)}% of the time`);
    }
    return { out, info, fail };
  });
  console.log(r.out.join('\n')); console.log('information (live tiles per wedge, centres only):\n  ' + r.info.join('\n  '));
  await browser.close(); process.exit(r.fail ? 1 : 0);
})();
