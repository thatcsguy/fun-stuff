// Playwright smoke test: node tools/browser.js [outDir]
// Every sim: loads from a seed link, pre-roll shot, mid-run shot, runs to a win, banner shot, then New gives a new seed.
const { chromium } = require('playwright'), path = require('path'), http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..'), out = process.argv[2] || '/tmp/ww-shots';
fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200, { 'content-type': 'text/html' }); r.end(d); }); }).listen(8765);
(async () => {
  const br = await chromium.launch(), pg = await br.newPage({ viewport: { width: 390, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${out}/picker.png` });
  const ids = await pg.evaluate(() => __ww.SIMS.map(s => s.id));
  const res = [];
  for (const [k, id] of ids.entries()) {
    await pg.goto(`http://localhost:8765/?sim=${id}&seed=${4242 + k}`); await pg.waitForTimeout(700);
    await pg.screenshot({ path: `${out}/${id}-0pre.png` });
    // fast-forward 8 s of sim time, then let it run live for a moment
    await pg.evaluate(() => { const { R } = __ww; R.phase = 'run'; for (let i = 0; i < 960 && R.st.win == null; i++) tickSim(R.sim, R.st); });
    await pg.waitForTimeout(400); await pg.screenshot({ path: `${out}/${id}-1mid.png` });
    const fps = await pg.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
    const r1 = await pg.evaluate(() => { const { R } = __ww; let i = 0; while (R.st.win == null && R.st.t < MAX_T) { tickSim(R.sim, R.st); i++; } if (R.st.win == null) R.st.win = leadOf(R.sim, R.st); return { t: R.st.t, seed: R.seed, win: R.st.win }; });
    await pg.waitForTimeout(2600); await pg.screenshot({ path: `${out}/${id}-2end.png` });
    const phase = await pg.evaluate(() => __ww.R.phase);
    await pg.click('#bRestart'); await pg.waitForTimeout(200);
    const r2 = await pg.evaluate(() => ({ seed: __ww.R.seed, t: __ww.R.st.t, phase: __ww.R.phase }));
    res.push(`${id.padEnd(9)} end ${r1.t.toFixed(1)}s phase=${phase} winner=${r1.win} fps~${fps} | restart seed ${r1.seed}->${r2.seed} t=${r2.t.toFixed(2)} ${r2.phase}`);
  }
  console.log(res.join('\n')); console.log('errors:', errs.length ? errs.slice(0, 10).join('\n') : 'none');
  await br.close(); srv.close();
})();
