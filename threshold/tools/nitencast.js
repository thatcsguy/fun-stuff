// node nitencast.js [class] [runs] : where the planted-cast time goes in Issen's Niten (Nightmare phase IV). Buckets live Niten time
// by what the boss is doing (calm, storm tell, Lighthouse Storm on with/without a calm-spot hint, swap, Echo, unison brackets) and
// reports the share spent casting in each, plus moving/idle time, finished and cancelled casts and why a cast was cancelled.
// PH=n starts at phase n (default 3, Niten; PH=0 is a whole fight). STEP=n holds the ramp at step n or later; ONLY=n counts step n only.
// POCKETBLIND=1 uses the autopilot that ignores the calm places. SEED sets the page seed.
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
      let dmg0 = null; const dmgBy = {};
      const STEP = STEPV; const onStep = (dt) => { if (STEP !== undefined && S.niten) S.nitenT = Math.max(S.nitenT, +STEP * 35 + 1); dd = p.stats.dmg - last; last = p.stats.dmg; if (!S.niten || b.transitioning) return; if (ONLY !== undefined && S.nitenStep !== +ONLY) return; const c = !!p.casting; if (wasC && !p.casting && wasC.t < wasC.time - 0.05) { cancel++; const why = (g.Hz.threat(p.pos.x, p.pos.z) < 3 ? 'hz' : '') + (g.Bul.threat(p.pos.x, p.pos.z, 1.5) ? 'bul' : '') + (S.storm || '') + (S.unison ? 'U' : '') + (S.lead && S.lead.warn > 0 ? 'W' : '') + (!S.lead.ent.targetable ? 'T' : ''); why_[why] = (why_[why] || 0) + 1; } wasC = p.casting ? Object.assign({}, p.casting) : null;
        const st = S.unison ? 'unison' : S.stormHold || (S.lead && S.lead.warn > 0) ? 'swap' : S.storm === 'on' ? 'storm' : S.storm === 'tell' ? 'stormtell' : S.echoing ? 'echo' : 'calm';
        add('all', dt, c); add(st, dt, c); if (S.storm === 'on') { add(S.calmHint ? 'storm+hint' : 'storm-nohint', dt, c); }
        if (p.moving) add('moving', dt, false); if (!p.casting && !p.moving) add('idle', dt, false); };
      for (let i = 0; i < (STEPV !== undefined ? 45 : 200); i++) { s = g.fastForward(2, true, onStep); if (s.state !== 'fight') break; }
      g.Bot.pocketBlind = false;
      const o = {}; for (const kk in A) o[kk] = `${A[kk][0].toFixed(0)}s cast ${Math.round(A[kk][1] / A[kk][0] * 100)}% dps ${Math.round(A[kk][2] / A[kk][0])}`; o.hits = hits; o.done = done; o.cancel = cancel; o.why = why_; o.state = s.state + ' ' + s.t + ' boss ' + s.boss; o.err = s.errors; return o;
    }, [cls, !!process.env.POCKETBLIND, process.env.STEP, process.env.PH, process.env.ONLY]);
    console.log(JSON.stringify(r));
  }
  await browser.close();
})();
