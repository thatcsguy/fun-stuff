// node tools/gatefuzz.js [step] [mode] : prove the gate mechanics of door `portal` are always survivable (no browser needed).
// Loads the pure <gates> block of src/37_boss_portal.js (layouts, mechanic variants, route solver) and, for every layout and pairing,
// with no pair sealed and with each single pair sealed, from start positions on a grid over the floor (default every 1.5 m),
// checks that every gate mechanic has at least one variant the solver can beat (conservative player: 5.8 m/s, 0.5 s reaction,
// 0.6 m margin), or else that the fight's fallback (a single Slam) is. Prints, per mechanic, how often a variant with the intended number of trips exists, and solver timings.
// mode = walk | dwell | jump (default walk), the gate entry rule. Exit code 1 on any unsurvivable start.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/37_boss_portal.js'), 'utf8');
const body = src.split('// <gates>')[1].split('// </gates>')[0];
const K = new Function(body.replace(/^[^\n]*\n/, '') + '; return { solve, pickVariant, LAYOUT, VARIANTS, hzF };')();
const STEP = +(process.argv[2] || 1.5), MODE = process.argv[3] || 'walk';
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// cast times as the fight uses them (the shortest: an enraged cast is 30% shorter)
const CASES = [
  ['P1', 'slam', 2.6 * 0.7, 1], ['P2', 'slam', 2.6 * 0.7, 1], ['P2', 'iris', 2.4 * 0.7, 1], ['P2', 'doors', 2.6 * 0.7, 2],
  ['P3A', 'rebound', 2.4 * 0.7, 2], ['P3A', 'triptych', 2.4 * 0.7, 3], ['P3B', 'rebound', 2.4 * 0.7, 2], ['P3B', 'triptych', 2.4 * 0.7, 3],
];
let fail = 0; const rnd = mulberry(7);
for (const [lay, mech, ct, want] of CASES) {
  const gates = K.LAYOUT[lay], pairs = [...new Set(gates.map((g) => g.pair))], list = K.VARIANTS[mech](ct);
  let fallback = 0, starts = 0, survive = 0, intended = 0, worst = 1e9, tSum = 0, tMax = 0, nSolves = 0; const tripHist = {}; const bad = [];
  for (const sealed of [-1, ...pairs]) {
    const shut = {}; if (sealed >= 0) shut[sealed] = Infinity;
    for (let x = -19; x <= 19; x += STEP) for (let z = -19; z <= 19; z += STEP) {
      if (Math.hypot(x, z) > 18.8 || Math.hypot(x, z) < 3.2) continue; // the floor, minus Janus's footprint
      if (gates.some((g) => Math.hypot(x - g.x, z - g.z) < 1.9)) continue; // not standing on a gate
      starts++; let good = 0, best = 99;
      for (const haz of list) {
        const t0 = process.hrtime.bigint();
        const r = K.solve({ gates, haz, x, z, t: 0.5, shut, mode: MODE, v: 5.8, m: 0.6, maxTrips: 3, budget: 3000 });
        const dt = Number(process.hrtime.bigint() - t0) / 1e6; tSum += dt; tMax = Math.max(tMax, dt); nSolves++;
        if (r && r.n > 0) { good++; best = Math.min(best, r.n); tripHist[r.n] = (tripHist[r.n] || 0) + 1; }
      }
      worst = Math.min(worst, good);
      if (good) survive++; else if (K.pickVariant(K.VARIANTS.slam(ct), { gates, x, z, t: 0.5, shut, mode: MODE, v: 5.8, m: 0.6, maxTrips: 3, budget: 3000 }, 1, rnd)) fallback++; else bad.push(`(${x.toFixed(1)},${z.toFixed(1)}) sealed ${sealed}`);
      const pv = K.pickVariant(list, { gates, x, z, t: 0.5, shut, mode: MODE, v: 5.8, m: 0.6, maxTrips: 3, budget: 3000 }, want, rnd);
      if (pv && pv.n === want) intended++;
    }
  }
  if (bad.length) fail++;
  console.log(`${lay.padEnd(4)} ${mech.padEnd(9)} starts ${starts}  survivable ${(survive / starts * 100).toFixed(1)}%  intended(${want}) ${(intended / starts * 100).toFixed(1)}%  fewest good variants ${worst}/${list.length}  slam fallback ${fallback}  trips ${JSON.stringify(tripHist)}  solve avg ${(tSum / nSolves).toFixed(2)} ms max ${tMax.toFixed(1)} ms`);
  if (bad.length) console.log('   UNSURVIVABLE:', bad.slice(0, 12).join(' | '), bad.length > 12 ? `(+${bad.length - 12})` : '');
}
console.log(fail ? 'FAIL' : 'ALL SURVIVABLE');
process.exit(fail ? 1 : 0);
