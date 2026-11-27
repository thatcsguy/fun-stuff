// Node fairness test: node tools/headless.js [seeds=200] [simId]
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = path.join(__dirname, '../src');
const files = ['01_kit.js', ...fs.readdirSync(src).filter(f => /^[1-8]\d_.*\.js$/.test(f)).sort()];
const code = 'var AU=new Proxy({},{get:()=>()=>{}});\n' + files.map(f => fs.readFileSync(path.join(src, f), 'utf8')).join('\n') +
  '\nFX.off=true; this.SIMS=SIMS; this.runRound=runRound;';
const ctx = { console, Math, Map, Set, Array, Object, JSON, Float32Array, Int16Array, Uint8Array, Int32Array, Float64Array, Uint16Array, Int8Array };
vm.createContext(ctx); vm.runInContext(code, ctx);
const n = +process.argv[2] || 200, only = process.argv[3];
for (const s of ctx.SIMS) {
  if (only && !only.split(',').includes(s.id)) continue;
  const wins = {}, ts = [], fair = []; let capped = 0, slots = 0, err = '', t0 = Date.now();
  try { for (let j = 0; j < n; j++) { const r = ctx.runRound(s, 7000 + j); slots = Math.max(slots, r.n); for (let i = 0; i < r.n; i++) fair[i] = (fair[i] || 0) + 1 / r.n; wins[r.win] = (wins[r.win] || 0) + 1; ts.push(r.t); if (r.capped) capped++; } }
  catch (e) { err = ' ERROR ' + e.stack.split('\n').slice(0, 3).join(' | '); }
  ts.sort((a, b) => a - b);
  const sh = Array.from({ length: slots }, (_, i) => ((wins[i] || 0) / (fair[i] || 1)).toFixed(2));
  const pct = q => (ts[Math.floor(ts.length * q)] || 0).toFixed(1);
  console.log(`${s.id.padEnd(9)} p10 ${pct(.1)} med ${pct(.5)} p90 ${pct(.9)} max ${(ts[ts.length - 1] || 0).toFixed(1)} cap ${capped} | slots ${sh.join(' ')} | ${((Date.now() - t0) / n).toFixed(0)}ms/rd${err}`);
}
