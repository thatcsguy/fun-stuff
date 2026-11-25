// node nitencast.js [class] [runs] : where the planted-cast time goes in Issen's Niten (Nightmare phase IV). Buckets live Niten time
// by what the boss is doing (calm, storm tell, Lighthouse Storm on with/without a calm-spot hint, swap, Echo, unison brackets) and
// reports the share spent casting in each, plus moving/idle time, finished and cancelled casts and why a cast was cancelled.
// PH=n starts at phase n (default 3, Niten; PH=0 is a whole fight). STEP=n holds the ramp at step n or later; ONLY=n counts step n only.
// POCKETBLIND=1 uses the autopilot that ignores the calm places. SEED sets the page seed.
// Also (Storm never sleeps + Waking Cut build): "moving" and "quiet" shares (quiet = no live telegraph, no petal within 6 m, no
// swap tell, as in issen-intensity-ideas.md), "gapMax" = the longest stretch of live Niten time outside the unison set pieces with
// no planted cast completed (target: no stretch over 4 s where a 1.5 s Bolt cannot finish, so gapMax should stay near 5.5 s or
// under; the autopilot is not perfect, so "gaps>5.5" counts them), "ocWin" = swap cycles with a 2.25 s planted cast that finished
// (an Overcharge-sized window), and "wake" = Waking Cuts survived / taken. "noBoltMax" is the design check behind the guard rail,
// independent of how well the autopilot plays: the longest stretch outside the unison set pieces in which no spot within 3 m of
// the player is safe for a whole 1.5 s Bolt (no telegraph, storm arm or flying petal reaches it in walk time + 1.6 s, the awake
// one targetable); "noBolt>4" counts the stretches over 4 s.
const { launch } = require('./harness.js');
(async () => {
  const [cls = 'stormcaller', runs = '2'] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  for (let k = 0; k < +runs; k++) {
    const r = await page.evaluate(([cls, blind, STEPV, PHV, ONLY]) => {
      const g = window.__game, G = g.G; G.headless = true; g.bot(3); g.god(true); g.Bot.pocketBlind = blind;
      g.start('duelist', { cls, phase: +(PHV || 3) }); const b = G.boss, p = G.player, S = b.state; let s;
      const A = {}; let dd = 0; const add = (key, dt, cast) => { const q = A[key] || (A[key] = [0, 0, 0]); q[0] += dt; if (cast) q[1] += dt; q[2] += dd; };
      let last = p.stats.dmg, done = 0, cancel = 0, wasC = null; const com = p.commit.bind(p); p.commit = (i, tgt, wc) => { if (S.niten && wc) done++; return com(i, tgt, wc); };
      let hits = 0; const why_ = {}; const hu = p.hurt.bind(p); p.hurt = (amt, o) => { if (S.niten && o && o.src && o.src.petal) hits++; return hu(amt, o); };
      let dmg0 = null; const dmgBy = {}; let nbT = 0, nbMax = 0, nbOver = 0, gapT = 0, gapMax = 0, gapsOver = 0, cycOC = 0, cycles = 0, ocNow = false, castRun = 0, lastLead = null; const gapAt = [];
      let tl = '', tlT = 0; const gapLog = [];
      const doneAt = () => { if (gapT > 5.5) { gapsOver++; gapAt.push(Math.round(S.nitenT)); gapLog.push(tl); } gapMax = Math.max(gapMax, gapT); gapT = 0; tl = ''; };
      const com2 = p.commit; p.commit = (i, tgt, wc) => { if (S.niten && wc) doneAt(); return com2(i, tgt, wc); };
      const STEP = STEPV; const onStep = (dt) => { if (STEP !== undefined && S.niten) S.nitenT = Math.max(S.nitenT, +STEP * 35 + 1); dd = p.stats.dmg - last; last = p.stats.dmg; if (!S.niten || b.transitioning) return; if (ONLY !== undefined && S.nitenStep !== +ONLY) return; const c = !!p.casting; if (wasC && !p.casting && wasC.t < wasC.time - 0.05) { cancel++; const why = (g.Hz.threat(p.pos.x, p.pos.z) < 3 ? 'hz' : '') + (g.Bul.threat(p.pos.x, p.pos.z, 1.5) ? 'bul' : '') + (S.storm || '') + (S.unison ? 'U' : '') + (S.lead && S.lead.warn > 0 ? 'W' : '') + (!S.lead.ent.targetable ? 'T' : ''); why_[why] = (why_[why] || 0) + 1; } wasC = p.casting ? Object.assign({}, p.casting) : null;
        const st = S.unison ? 'unison' : S.stormHold || (S.lead && S.lead.warn > 0) ? 'swap' : S.storm === 'on' ? 'storm' : S.storm === 'tell' ? 'stormtell' : S.echoing ? 'echo' : 'calm';
        if (S.unison) { gapT = 0; tl = ''; } else gapT += dt;
        // design check, independent of the autopilot: could a player within 3 m start a 1.5 s Bolt now and finish it unhit?
        // (a spot no telegraph, storm arm or flying petal reaches within walk time + 1.6 s; the awake one targetable)
        { let ok = false; const L = S.lead; if (!S.unison && L && L.ent.targetable) { const pts = [[p.pos.x, p.pos.z]]; for (const r of [1.5, 3]) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; pts.push([p.pos.x + Math.sin(a) * r, p.pos.z + Math.cos(a) * r]); }
            for (const [x, z] of pts) { if (x * x + z * z > 14 * 14) continue; const tt = Math.hypot(x - p.pos.x, z - p.pos.z) / 7, need = tt + 1.6; const th = Math.min(g.Hz.threat(x, z), b.def.nightmare.danger(b, x, z)); if (th > need && !g.Bul.threat(x, z, need)) { ok = true; break; } } }
          if (S.unison || ok) { if (nbT > 0) { nbMax = Math.max(nbMax, nbT); if (nbT > 4) nbOver++; } nbT = 0; } else nbT += dt; }
        // timeline of the current gap, one letter per 0.25 s: W swap tell/Waking Cut, T storm tell, D Draw Cut tell, M Moon, c casting, m moving, h holding fire, . idle
        if ((tlT += dt) >= 0.25) { tlT -= 0.25; tl += (S.lead && S.lead.warn > 0) || S.waking ? 'W' : g.Hz.list.some((h) => h.state === 'tele' && h.name === 'Draw Cut') ? 'D' : S.moonK ? 'M' : S.storm === 'tell' ? 'T' : ''; { const hh = b.def.bot(b) || {}; tl += p.casting ? 'c' : p.moving ? 'm' : '.'; tl += hh.holdFire ? 'h' : hh.noCast !== undefined && hh.noCast < 1.5 ? 'n' : hh.x !== undefined ? 'L' : ''; } tl += ' '; }
        if (c) castRun += dt; else { if (castRun >= 2.2) ocNow = true; castRun = 0; }
        if (S.lead !== lastLead) { if (lastLead) { cycles++; if (ocNow) cycOC++; } ocNow = false; lastLead = S.lead; }
        const quiet = !(S.lead && S.lead.warn > 0) && !g.Hz.list.some((h) => h.state === 'tele' && h.dmg) && !g.Bul.list.some((q) => q.petal && !q.dead && Math.hypot(q.x - p.pos.x, q.z - p.pos.z) < 6);
        if (quiet) add('quiet', dt, c);
        add('all', dt, c); add(st, dt, c); if (S.storm === 'on') { add(S.calmHint ? 'storm+hint' : 'storm-nohint', dt, c); }
        if (p.moving) add('moving', dt, false); if (!p.casting && !p.moving) add('idle', dt, false); };
      for (let i = 0; i < (STEPV !== undefined ? 45 : 200); i++) { s = g.fastForward(2, true, onStep); if (s.state !== 'fight') break; }
      g.Bot.pocketBlind = false;
      const o = {}; for (const kk in A) o[kk] = `${A[kk][0].toFixed(0)}s cast ${Math.round(A[kk][1] / A[kk][0] * 100)}% dps ${Math.round(A[kk][2] / A[kk][0])}`; o.hits = hits; o.done = done; o.noBoltMax = +nbMax.toFixed(1); o['noBolt>4'] = nbOver; o.gapMax = +gapMax.toFixed(1); o['gaps>5.5'] = gapsOver; o.gapAt = gapAt.join(','); o.gapLog = gapLog; o.ocWin = cycOC + '/' + cycles; const wl = S.wakeLog || []; o.wake = wl.filter((q) => !q.hit).length + '/' + wl.length + ' (ghosts ' + wl.map((q) => q.n).join(',') + ')'; o.cancel = cancel; o.why = why_; o.state = s.state + ' ' + s.t + ' boss ' + s.boss; o.err = s.errors; return o;
    }, [cls, !!process.env.POCKETBLIND, process.env.STEP, process.env.PH, process.env.ONLY]);
    if (!process.env.GAPLOG) delete r.gapLog;
    console.log(JSON.stringify(r));
  }
  await browser.close();
})();
