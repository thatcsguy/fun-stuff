// node hitchscan.js [boss,boss|all] [class] : the freeze hunt. Enters each fight the normal way (loading screen, rehearsal, warm-up,
// full intro), then lets the level-3 autopilot play the whole fight in god mode in real frames, and prints every late frame
// the freeze log (src/12_hitch.js) recorded together with what happened just before it: shaders compiled, programs drawn for
// the first time, textures and geometry uploaded, slow simulation steps, casts and phase changes.
// NM=1 runs the nightmare versions. MAXSEC caps a fight (default 420). LIM = ms a frame may be late in the summary (default 50).
// VIRT=1 (GPU-less sandboxes): frames are far too slow there to time, so only causes are listed (compiles, first draws, uploads, slow steps).
// SYNC=1 waits for the graphics card every frame, so GPU-side work (driver compiles, uploads) shows up in `draw` next to its cause.
// OLD=1 runs the warm-up without its newer steps (before/after comparisons).
// OUT=file.json also writes everything as JSON. Use TH_GPU=1 on a machine with a graphics card: only that shows real stalls.
const { launch } = require('./harness.js');
const fs = require('fs');
(async () => {
  const cls = process.argv[3] || 'stormcaller', maxSec = +(process.env.MAXSEC || 420), virt = !!process.env.VIRT, lim = +(process.env.LIM || 50);
  const { browser, page } = await launch(virt ? { w: 320, h: 180 } : { w: 1280, h: 720 });
  await page.goto('http://game.local/threshold/?mute=1&hitch=' + (process.env.SYNC ? 2 : 1) + (process.env.OLD ? '&warm=old' : '') + '&quality=' + (process.env.Q || 'high') + '&seed=3');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const all = await page.evaluate(() => window.__game.G.bosses.map((d) => d.id));
  const ids = (process.argv[2] && process.argv[2] !== 'all') ? process.argv[2].split(',') : all, out = [];
  for (const id of ids) {
    const r = await page.evaluate(async ({ id, cls, maxSec, virt }) => {
      const g = window.__game, G = g.G, H = g.Hitch, raf = () => new Promise((res) => requestAnimationFrame(res));
      if (g.def(id).nm !== !!new URLSearchParams(location.search).has('nm') && new URLSearchParams(location.search).has('nm')) return { skip: 1 };
      G.errors.length = 0; H.log.length = 0; g.bot(3); g.god(true); g.start(id, { cls });
      while (G.state !== 'intro' && G.state !== 'fight') await raf();
      const causes = [], seenEv = new Set(), t0 = performance.now(), phases = []; let lastPh = -1, endT = 0, ended = '';
      // in VIRT mode every frame is "late", so collect the causes straight from the event marks instead
      H.tap = (s) => { if (/^(COMPILED|FIRST DRAW|textures|geometry|slow step)/.test(s)) causes.push({ st: G.state, ft: +G.ft.toFixed(1), ph: G.boss ? G.boss.phase : -1, what: s }); };
      while (true) {
        await raf();
        if (G.boss && G.boss.phase !== lastPh) { lastPh = G.boss.phase; phases.push(lastPh + '@' + G.ft.toFixed(0)); }
        if (G.state === 'win' || G.state === 'dead') { if (!ended) { ended = G.state; endT = performance.now(); } else if (performance.now() - endT > (virt ? 20000 : 6000)) break; }
        if (G.state === 'fight' && G.ft > maxSec) { ended = 'timeout'; break; }
        if (performance.now() - t0 > (virt ? 3600 : maxSec + 90) * 1000) { ended = ended || 'wall'; break; }
      }
      H.tap = null;
      return { id, nm: !!G.nightmare, ended, ft: +G.ft.toFixed(0), phases, frames: H.count.frames, late: H.log.slice(), causes, warm: G.warmStats, errors: G.errors.slice(0, 3) };
    }, { id, cls, maxSec, virt });
    if (r.skip) continue;
    out.push(r);
    const late = r.late.filter((e) => e.gap >= lim), worst = late.reduce((m, e) => Math.max(m, e.gap), 0);
    console.log('\n== ' + r.id + (r.nm ? ' NM' : '') + ' ' + cls + ': ' + r.ended + ' at ' + r.ft + 's, phases ' + r.phases.join(' ') + ', load ' + JSON.stringify(r.warm) + (r.errors.length ? ' ERRORS ' + r.errors.join(' / ') : ''));
    if (virt) { const by = {}; for (const c of r.causes) { const k = c.what.replace(/\d+ms$/, '').replace(/\+\d+$/, '+'); (by[k] = by[k] || []).push(c.st[0] + (c.ph + 1) + '@' + c.ft + (c.what.match(/\d+ms$|\+\d+$/) || [''])[0]); } const ks = Object.keys(by); console.log(ks.length ? ks.map((k) => '  ' + k + '  [' + by[k].slice(0, 8).join(', ') + (by[k].length > 8 ? ', ... x' + by[k].length : '') + ']').join('\n') : '  nothing created or compiled after loading'); }
    else { console.log('  ' + late.length + ' late frames of ' + r.frames + (late.length ? ', worst ' + worst + ' ms' : '')); for (const e of late) console.log('  ' + e.clock + ' ' + e.st + ' phase ' + (e.ph + 1) + ' at ' + e.ft + 's: ' + e.gap + ' ms (step ' + e.sim + ', draw ' + e.draw + ')' + (e.ev.length ? ' <- ' + e.ev.join('; ') : '')); }
  }
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
  await browser.close();
})();
