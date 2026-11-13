// node tools/chessfuzz.js [N] : fuzz the Gambit board generator of door `chess` (no browser needed).
// Random King cell, hero cell, Queens 0-3, pawns and act. Every board must leave a good cell (safe AND gives check)
// that the hero can walk to before the lock-in. Prints good-count distribution and how often each relaxation fired.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/32_boss_chess.js'), 'utf8');
const body = src.split('// <board>')[1].split('// </board>')[0];
const { genPlan, evalBoard, cx, GOOD, reachOf } = new Function(body.replace(/^[^\n]*\n/, '') + '; return { genPlan, evalBoard, cx, GOOD, reachOf };')();
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const N = +(process.argv[2] || 10000), MIX = ['R', 'B', 'N'], YOU = [['R', 'B', 'R', 'B', 'N', 'R', 'B', 'N'], ['N', 'B', 'R', 'Q', 'B', 'N'], ['Q', 'N', 'R', 'B']], T = [6.0, 6.0, 4.5];
let fail = 0;
for (let lvl = 0; lvl < 3; lvl++) {
  let dead = 0, retired = 0, qret = 0, marched = 0; const hist = {}, relax = [0, 0, 0, 0], you = {};
  for (let s = 0; s < N; s++) {
    const r = mulberry(s * 7919 + lvl * 104729), ri = (a, b) => a + Math.floor(r() * (b - a + 1)), pk = (a) => a[ri(0, a.length - 1)];
    const k = { i: ri(0, 7), j: ri(0, 7) }, used = new Set([k.j * 8 + k.i]), free = () => { for (;;) { const i = ri(0, 7), j = ri(0, 7); if (!used.has(j * 8 + i)) { used.add(j * 8 + i); return { i, j }; } } };
    const pc = free(); used.delete(pc.j * 8 + pc.i); const px = cx(pc.i) + (r() - 0.5) * 3.8, pz = cx(pc.j) + (r() - 0.5) * 3.8;
    let pieces = [], born = 0; const add = (type, c) => pieces.push({ ref: born, type, i: c.i, j: c.j, born: born++ });
    if (lvl > 0) { const nq = ri(lvl === 1 ? 1 : 0, 3); for (let q = 0; q < nq; q++) add('Q', free()); const np = ri(0, 3 - nq); for (let q = 0; q < np; q++) { let c; do c = free(); while (c.j > 6); add('P', c); } }
    if (lvl === 2) { const nk = ri(0, 3); for (let q = 0; q < nk; q++) add(pk(MIX), free()); }
    for (const q of pieces) if (q.type === 'Q' || lvl === 2) q.mover = false; const movers = pieces.filter((q) => q.type !== 'P'); if (movers.length) pk(movers).mover = true;
    const types = lvl === 0 ? [pk(MIX), pk(MIX), pk(['N', 'B'])] : lvl === 1 ? [pk(MIX)].concat(r() < 0.5 ? [pk(MIX)] : []) : [pk(MIX)];
    if (lvl > 0 && pieces.filter((q) => q.type === 'P' || q.type === 'Q').length < 3 && r() < 0.5) types.push('P');
    const seq = YOU[lvl], g = ri(0, 7), o = { types, T: T[lvl], lvl, pawns: lvl > 0, youSeq: seq.slice(g % seq.length).concat(seq.slice(0, g % seq.length)) };
    let plan = null;
    const tryPlan = (anyQ) => { for (let n = 0; n < 7 && !plan; n++) {
      plan = genPlan({ pieces, k, pc, px, pz, rnd: r }, o);
      if (!plan) { const old = pieces.filter((q) => q.type !== 'Q').sort((a, b) => a.born - b.born)[0] || (anyQ && pieces.sort((a, b) => a.born - b.born)[0]); if (!old) break; if (old.type === 'Q') qret++; pieces = pieces.filter((q) => q !== old); retired++; }
    } };
    tryPlan(false);
    if (!plan) for (let m = 0; m < 2 && !plan; m++) { // the King advances toward the hero (march) and the plan runs again
      if (Math.max(Math.abs(k.i - pc.i), Math.abs(k.j - pc.j)) <= 1) break; const ni = k.i + Math.sign(pc.i - k.i), nj = k.j + Math.sign(pc.j - k.j);
      if (pieces.some((q) => q.i === ni && q.j === nj)) break; k.i = ni; k.j = nj; marched++;
    }
    if (!plan) tryPlan(true);
    if (!plan) { dead++; if (process.env.V) console.log("dead", lvl, JSON.stringify({ k, pc, kd: Math.max(Math.abs(k.i - pc.i), Math.abs(k.j - pc.j)), pieces: pieces.map((q) => q.type + q.i + q.j).join(" "), types })); continue; }
    // independent check: the returned good set really is safe and gives check, and one is reachable
    let near = 1e9; for (const c of plan.good) { if (plan.struck[c] || !plan.check[c]) { dead++; break; } near = Math.min(near, Math.hypot(cx(c % 8) - px, cx(c >> 3) - pz)); }
    if (near > reachOf(o.T)) { dead++; continue; }
    hist[plan.good.length] = (hist[plan.good.length] || 0) + 1; relax[plan.relax]++; you[plan.you] = (you[plan.you] || 0) + 1;
  }
  const h = Object.keys(hist).map(Number).sort((a, b) => a - b).map((c) => c + ':' + hist[c]).join(' ');
  console.log(`act ${lvl + 1} (range ${GOOD[lvl].join('-')}, T ${T[lvl]}): no reachable good cell ${dead}/${N}; piece retired ${retired} (Queens ${qret}); King advanced ${marched}; relax none/decoys/piece/range ${relax.join('/')}; you ${JSON.stringify(you)}\n  good counts ${h}`);
  if (dead) fail++;
}
console.log(fail ? 'FAIL' : 'OK'); process.exit(fail ? 1 : 0);
