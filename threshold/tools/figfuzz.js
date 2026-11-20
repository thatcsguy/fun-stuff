// node tools/figfuzz.js [N] : fuzz the One Breath figure generator of door `sumi` (no browser needed). N figures per phase (default 20000).
// Every figure must be solvable in one stroke, have at least one start that fails, sit inside the terrace with no joint within 4 m of the
// player, leave the dragon a spot clear of it, and (phase 2) have one-way lines that change which starts work. Prints the spread of
// route lengths and cast times.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/39_boss_sumi.js'), 'utf8');
const body = '//' + src.split('// <figure>')[1].split('// </figure>')[0];
const { FIG_SHAPES, figMake, figSolve, figStarts, figUsed, figSegD } = new Function(body + '; return { FIG_SHAPES, figMake, figSolve, figStarts, figUsed, figSegD };')();
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const N = +process.argv[2] || 20000, R = 21, pct = (a, q) => a[Math.min(a.length - 1, Math.floor(a.length * q))];
let bad = 0;
const fail = (msg, F) => { if (bad++ < 12) console.log('  BAD:', msg, F ? JSON.stringify({ shape: F.shape, L: F.L.map((l) => [l.a, l.b, l.ow]), eye: F.eye }) : ''); };
for (let lvl = 0; lvl < 3; lvl++) {
  const T = [], Ls = [], lines = [], shapes = new Map(); let nul = 0, ow = 0, firstOk = 0;
  for (let s = 0; s < N; s++) {
    const r = mulberry(s * 7919 + lvl * 104729 + 1), a = r() * Math.PI * 2, rr = Math.sqrt(r()) * (R - 0.6), px = Math.sin(a) * rr, pz = Math.cos(a) * rr;
    const first = lvl === 0 && s % 10 === 0, F = figMake(lvl, r, px, pz, s % 3 ? Math.floor(r() * FIG_SHAPES.length) : -1, first);
    if (!F) { nul++; fail(`lvl ${lvl}: no figure for player at (${px.toFixed(1)}, ${pz.toFixed(1)})`); continue; }
    const used = figUsed(F.L), starts = figStarts(F, F.eye), n = F.L.length;
    if (!starts.length) fail('unsolvable', F);
    if (starts.length === used.length) fail('every start works', F);
    if (first) { if (!FIG_SHAPES[F.shape].path || n !== 3) fail('first figure is not a 3-line path', F); else firstOk++; }
    else {
      if (FIG_SHAPES[F.shape].path) fail('path outside the first figure', F);
      if (lvl === 0 && (n < 3 || n > 5 || F.L.some((l) => l.ow))) fail('phase 1 size or one-way', F);
      if (lvl === 1) { const k = F.L.filter((l) => l.ow).length; if (n < 5 || n > 6 || k < 1 || k > 2) fail('phase 2 size or one-way count', F);
        const plain = figStarts({ L: F.L.map((l) => ({ a: l.a, b: l.b, ow: 0 })) }, -1); if (plain.every((j) => starts.includes(j))) fail('one-way lines change nothing', F); }
      if (lvl === 2) { if (n < 6 || n > 7 || F.L.filter((l) => l.ow).length > 1 || F.eye < 0) fail('phase 3 size, one-way or eye', F);
        if (!figSolve(F, starts[0], 0, F.eye)) fail('eye unreachable', F); }
    }
    for (const j of used) { const J = F.J[j]; if (Math.hypot(J.x, J.z) >= 17.5) fail('joint outside r 17.5', F); if (Math.hypot(J.x - px, J.z - pz) < 4) fail('joint within 4 m of the player', F);
      for (const l of F.L) if (l.a !== j && l.b !== j && figSegD(J.x, J.z, F.J[l.a], F.J[l.b]) < 3) fail('joint within 3 m of another line', F); }
    if (Math.hypot(F.bx, F.bz) > 16.6 || used.some((j) => Math.hypot(F.J[j].x - F.bx, F.J[j].z - F.bz) < 4.5) || F.L.some((l) => figSegD(F.bx, F.bz, F.J[l.a], F.J[l.b]) < 3.5)) fail('dragon spot on the figure', F);
    // the route the autopilot takes from a correct start covers every line once
    const rt = figSolve(F, starts[0], 0, F.eye); if (!rt || rt.length !== n) fail('route length', F);
    T.push(F.T); Ls.push(F.Lmin); lines.push(n); shapes.set(F.shape, (shapes.get(F.shape) || 0) + 1); if (F.L.some((l) => l.ow)) ow++;
  }
  T.sort((a, b) => a - b); Ls.sort((a, b) => a - b);
  console.log(`phase ${lvl + 1}: ${N - nul}/${N} made, shapes used ${shapes.size}, lines ${Math.min(...lines)}-${Math.max(...lines)}, with one-way ${(ow / N * 100).toFixed(0)}%` + (lvl === 0 ? `, first figures ok ${firstOk}` : ''));
  console.log(`  route L (m) min ${Ls[0].toFixed(1)} p10 ${pct(Ls, 0.1).toFixed(1)} median ${pct(Ls, 0.5).toFixed(1)} p90 ${pct(Ls, 0.9).toFixed(1)} max ${Ls[Ls.length - 1].toFixed(1)}`);
  console.log(`  cast T (s) min ${T[0].toFixed(1)} p10 ${pct(T, 0.1).toFixed(1)} median ${pct(T, 0.5).toFixed(1)} p90 ${pct(T, 0.9).toFixed(1)} max ${T[T.length - 1].toFixed(1)}`);
}
console.log(bad ? `FAIL (${bad})` : 'OK'); process.exit(bad ? 1 : 0);
