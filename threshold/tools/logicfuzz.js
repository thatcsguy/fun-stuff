// node tools/logicfuzz.js : fuzz the circuit generator of door `logic` (no browser needed).
// Every circuit must be survivable with at most two flips; most must also allow a short circuit.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/37_boss_logic.js'), 'utf8');
const body = '//' + src.split('// <circuit>')[1].split('// </circuit>')[0];
const { genC, solveC, makeC, evalC } = new Function(body + '; return { genC, solveC, makeC, evalC };')();
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let bad = 0;
for (let lvl = 0; lvl < 3; lvl++) {
  let dead = 0, short = 0, need = [0, 0, 0], N = 5000;
  for (let s = 0; s < N; s++) {
    const r = mulberry(s * 7919 + lvl), bits = [0, 1, 2, 3].map(() => r() < 0.5), bz = Math.floor(r() * 3);
    if (lvl === 0) bits[3] = false;
    const C = makeC(lvl, r, bits, bz), sol = solveC(C, bits, bz);
    if (!sol) { dead++; continue; }
    if (sol.short) short++; need[sol.flips.length]++;
    const o = evalC(C, bits.map((v, i) => sol.flips.includes(i) ? !v : v)).out; if (o.every((v) => v)) dead++;
  }
  console.log(`lvl ${lvl}: unsolvable ${dead}/${N}, shortable ${(short / N * 100).toFixed(1)}%, flips needed 0/1/2: ${need.join('/')}`);
  if (dead || short / N < 0.5) bad++;
}
console.log(bad ? 'FAIL' : 'OK'); process.exit(bad ? 1 : 0);
