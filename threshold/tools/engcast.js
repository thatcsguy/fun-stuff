// node engcast.js [class] [runs] : Parallax Nightmare (Totality) cast budget. Starts in Totality, then holds the ramp at each
// step in turn (STEPS=0,1,2,3,4,5 by default; nmTest.setStep(b, n, hold) gives that step's board at once) for SEC seconds
// (default 60) with the level-3 autopilot in god mode, his health kept above 15% (so the breath stays in), and reports per step:
//   cast   share of live time spent in a planted cast (also the ones cancelled by moving); (fin) only casts that completed
//   noBoltMax the design check, independent of how well the autopilot plays: the longest stretch in which no lit spot within 3 m
//          of the player (same wedge) is safe for a whole Bolt (no beam, Lance, flip, Swallow or bullet reaches it within walk time + 1.6 s)
//          (the condemned colour counts during Polarize while the blast leaves time to walk off)
//   gapMax  the autopilot's longest stretch of live time without a finished planted cast (Bolt / Overcharge), for information
//   live   share of live time standing on a live tile (the only place hits count in full)
// OFFLOG=1 splits the time off a live tile by cause (no live tile the autopilot can reach in its wedge, a Polarize in progress,
// bullets out, walking to one). GAPLOG=1 prints every stretch over 6 s, one entry per 0.25 s: boss cast initial (P Polarize, L Lance? no: Lance is a hazard, S Supernova,
// O Overclock, C Critical Mass, - none, p Polarize resolving) + c casting / m moving / . idle, x off a live tile, b bullets out, o beams out.
//   moving share of live time spent walking; done/m planted casts finished per minute; dps damage per second of live time; hits = beam / Polarize / Lance / bullet hits taken
// Budget (parallax-nightmare-plan.md): cast >= 55% at steps 0-2 and >= 45% at steps 3-5, no stretch over 6 s without a Bolt
// (noBoltMax <= 6 s), live >= 75% at every
// step. Exit code 1 if a step misses (runs are averaged per step; gapMax is the worst run). SEED sets the page seed.
// If a step misses, the plan's levers in order: lengthen the breath (CYCLE.breath), drop Overclock at that step (CYCLE.clockFrom),
// cut Supernova to 2 waves (CYCLE.novaWaves), slow the beams (SWEEP.w), hold 3 arms at step 5 (SWEEP.arms).
const { launch } = require('./harness.js');
(async () => {
  const [cls = 'stormcaller', runs = '2'] = process.argv.slice(2), steps = (process.env.STEPS || '0,1,2,3,4,5').split(',').map(Number), SEC = +(process.env.SEC || 60);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const tot = {}; let fail = false;
  for (const st of steps) for (let k = 0; k < +runs; k++) {
    const r = await page.evaluate(([cls, st, SEC]) => {
      const g = window.__game, G = g.G; G.headless = true; g.bot(3); g.god(true);
      g.start('engine', { cls, phase: 2 }); const b = G.boss, p = G.player, S = b.state, T = b.def.nmTest; let s;
      for (let i = 0; i < 300 && (b.phase !== 2 || b.transitioning); i++) g.fastForward(0.1, false);
      T.setStep(b, st, true); p.pos.set(0, 0, 4.4); // (on a tile every board keeps)
      const A = { dmg0: p.stats.dmg, t: 0, cast: 0, fin: 0, live: 0, moving: 0, done: 0, gap: 0, gapMax: 0, hits: {}, logs: [] }; let tl = '', tlT = 0;
      let lastC = null; const com = p.commit.bind(p); p.commit = (i, tgt, wasCast) => { if (wasCast && !b.transitioning) { A.done++; if (lastC) A.fin += lastC.time; A.gapMax = Math.max(A.gapMax, A.gap); if (A.gap > 6) A.logs.push(A.gap.toFixed(1) + ' ' + tl); A.gap = 0; tl = ''; } return com(i, tgt, wasCast); };
      const hu = p.hurt.bind(p); p.hurt = (amt, o) => { const n = o && o.src ? (typeof o.src === 'string' ? o.src : o.src.name || 'bullet') : 'bullet'; A.hits[n] = (A.hits[n] || 0) + 1; return hu(amt, o); };
      let nbT = 0, nbAcc = 0; const T2 = T; const boltSpot = () => { // design check: a lit spot within 3 m, same wedge, that nothing reaches for walk time + 1.6 s
        const pw = T2.wedge(S, p.pos.x, p.pos.z), pts = [[p.pos.x, p.pos.z]]; for (const r of [1.5, 3]) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; pts.push([p.pos.x + Math.sin(a) * r, p.pos.z + Math.cos(a) * r]); }
        for (const [x, z] of pts) { const j = T2.tIdx(x, z); if (j < 0 || !T2.lit(S, j) || S.tiles[j].warn > 0 || Math.hypot(x, z) < 3.2) continue; if (pw >= 0 && T2.wedge(S, x, z) !== pw) continue;
          const need = Math.hypot(x - p.pos.x, z - p.pos.z) / 7 + 1.6; if (b.def.danger(b, x, z) > need && g.Hz.threat(x, z) > need && !g.Bul.threat(x, z, need)) return true; } return false; };
      const on = (dt) => { lastC = p.casting; if (!b.transitioning && G.state === 'fight') { nbAcc += dt; if (nbAcc >= 0.1) { if (boltSpot()) { A.noBoltMax = Math.max(A.noBoltMax || 0, nbT); nbT = 0; } else nbT += nbAcc; nbAcc = 0; } } b.hp = Math.max(b.hp, b.maxHp * 0.15); if (b.transitioning || G.state !== 'fight') return; A.t += dt; A.gap += dt; if ((tlT += dt) >= 0.25) { tlT -= 0.25; const cs = b.castState ? b.castState.name[0] : S.pol ? 'p' : '-', sw = S.sweep; tl += cs + (p.casting ? 'c' : p.moving ? 'm' : '.') + (S.onLive ? '' : 'x') + (g.Bul.list.length ? 'b' : '') + (sw && sw.out ? 'o' : '') + ' '; } if (p.casting) A.cast += dt; if (S.onLive) A.live += dt; else { const h = b.def.bot(b, p), why = h.w !== 3 ? 'noLiveInReach' : S.pol ? 'polarize' : g.Bul.list.length ? 'bullets' : 'walking'; A.off = A.off || {}; A.off[why] = (A.off[why] || 0) + dt; } if (p.moving) A.moving += dt; };
      for (let i = 0; i < SEC / 2; i++) { s = g.fastForward(2, true, on); if (s.state !== 'fight') break; }
      A.gapMax = Math.max(A.gapMax, A.gap); A.noBoltMax = Math.max(A.noBoltMax || 0, nbT); A.dmg = p.stats.dmg - A.dmg0; S.holdStep = undefined; A.offS = A.off ? Object.entries(A.off).map(([k, v]) => k + ' ' + Math.round(v / A.t * 100) + '%').join(', ') : ''; return { A, step: S.step, err: s.errors, state: s.state };
    }, [cls, st, SEC]);
    const q = tot[st] || (tot[st] = { t: 0, cast: 0, fin: 0, live: 0, moving: 0, done: 0, gapMax: 0, noBoltMax: 0, hits: {}, dmg: 0 }), A = r.A; q.noBoltMax = Math.max(q.noBoltMax, A.noBoltMax || 0);
    for (const kk of ['t', 'cast', 'fin', 'live', 'moving', 'done', 'dmg']) q[kk] += A[kk]; q.gapMax = Math.max(q.gapMax, A.gapMax); for (const h in A.hits) q.hits[h] = (q.hits[h] || 0) + A.hits[h];
    if (process.env.OFFLOG) console.log(`  step ${st} off a live tile: ${r.A.offS}`);
    if (process.env.GAPLOG) for (const l of r.A.logs) console.log('  gap step ' + st + ': ' + l);
    if (r.err && r.err.length) console.log('ERR', JSON.stringify(r.err).slice(0, 300));
    if (r.step !== st) console.log(`(step ${st}: held at ${r.step})`);
  }
  console.log(`${cls}, ${runs} run(s) x ${SEC} s per step`);
  for (const st of steps) {
    const q = tot[st], pc = (v) => Math.round(v / q.t * 100), cast = pc(q.cast), live = pc(q.live), need = st <= 2 ? 55 : 45;
    const ok = cast >= need && q.noBoltMax <= 6 && live >= 75; if (!ok) fail = true;
    console.log(`step ${st}: cast ${cast}% (fin ${pc(q.fin)}%)  noBoltMax ${q.noBoltMax.toFixed(1)} s (autopilot gapMax ${q.gapMax.toFixed(1)} s)  live ${live}%  moving ${pc(q.moving)}%  done/m ${(q.done / q.t * 60).toFixed(1)}  dps ${Math.round(q.dmg / q.t)}  hits ${JSON.stringify(q.hits)}  ${ok ? 'ok' : 'MISS (cast >= ' + need + '%, noBoltMax <= 6, live >= 75%)'}`);
  }
  await browser.close(); process.exit(fail ? 1 : 0);
})();
