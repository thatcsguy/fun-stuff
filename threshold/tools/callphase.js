// node callphase.js : the Impresario Nightmare's phase changes and last blow, forced in the middle of each mechanic. Co.stopTag('phase')
// skips a coroutine's cleanup, so anything a cut-off mechanic set must be reset by the next enter (resetMech). Each phase change is
// forced during a Recast, a classic Blackout or a Cue, an Ovation, a Hand slam and the Curtain call (where the phase has them), and
// the last blow (the Final Curtain, 24 s into the enrage) during each finale mechanic. Nothing may be left behind once the next
// phase has entered (or the last blow has started): dark stage, a Blackout or Cue, a half-done Recast, an Ovation, the damage gate
// at anything but 1 or GATE.off, a lifted boss, a hand on the floor, lit cones, a cinematic camera, slow time. Then a restart
// must reset the ramp (finale clock, step, step times, Curtain call).
const { launch } = require('./harness.js');
(async () => {
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=9');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const g = window.__game, G = g.G, out = [], def = g.def('theatre'), n = def.phases.length, T = def.nmTest;
    const step = (sec) => g.fastForward(sec, false);
    const bad = (b, last) => { const S = b.state, q = []; if (!last && b.transitioning) q.push('transitioning');
      if (S.black) q.push('blackout/cue'); if (S.dark && !(last && S.finaleOver)) q.push('dark=' + S.dark); // the Final Curtain darkens the house itself if (S.recast) q.push('recast'); if (G.now < S.ovUntil) q.push('ovation'); if (S.bow) q.push('bow');
      if (b.dmgTaken !== 1 && b.dmgTaken !== T.GATE.off) q.push('dmgTaken=' + b.dmgTaken); if (b.pos.y) q.push('lifted=' + b.pos.y.toFixed(2)); if (S.lift) q.push('lift');
      if (S.hands.some((H) => H.tgt.y < 5 && !last)) q.push('hand on the floor'); if (S.spin) q.push('spin'); if (S.fanOn) q.push('fan'); if (S.curtainOn) q.push('curtain call'); if (S.dolls.some((d) => d.air)) q.push('doll still lifted');
      if (S.cones.some((c) => c.visible)) q.push('lit cones'); if (S.cine || g.Cam.cine) q.push('cinematic'); if (G.timeScale !== 1) q.push('timeScale=' + G.timeScale);
      if (!last && (b.lastBlowing || b.immune)) q.push(b.lastBlowing ? 'lastBlow' : 'immune');
      if (b.phase >= 1 && !S.dolls[1].on) q.push('blue doll missing'); if (b.phase >= 1 && S.split) q.push('still split'); if (S.lead !== 0 && S.lead !== 1) q.push('lead=' + S.lead);
      if (b.phase === 2 && !last && (!S.finale || !S.heroOn)) q.push('finale not set');
      return q; };
    const push = (label, q) => out.push((q.length ? 'FAIL ' : 'ok   ') + label + (q.length ? ': ' + q.join(', ') : ''));
    const MECH = [
      ['during a Recast', (b) => !!b.state.recast && G.now - b.state.recast.t0 > 0.5],
      ['during a Blackout or Cue', (b) => !!b.state.black && b.state.dark > 0.5],
      ['during an Ovation', (b) => G.now < b.state.ovUntil - 1 && b.state.bow],
      ['during a Hand slam', (b) => g.Hz.list.some((h) => h.name === 'The Hand' && h.state === 'tele' && h.t > 0.6)],
      ['during the Curtain call', (b) => !!b.state.curtainOn && !!b.state.black],
      ['during Knife Act', (b) => !!b.state.fanOn],
      ['during a Pirouette', (b) => !!b.state.spin],
      ['during Paper Birds (blue doll lifted)', (b) => !!b.state.dolls[1].air],
    ];
    const run = (ph, cond, maxSec, hold) => { g.start('theatre', { cls: 'stormcaller', phase: ph }); G.headless = true; g.bot(3); g.god(true);
      const b = G.boss; let t = 0; while (t < maxSec && !(b.phase === ph && !b.transitioning && cond(b))) { if (hold) hold(b); step(0.05); b.hp = Math.max(b.hp, b.maxHp * (ph + 1 < n ? def.phases[ph + 1].at + 0.02 : 0.11)); t += 0.05; } return t < maxSec; };
    for (let ph = 0; ph < n - 1; ph++) for (const [label, cond] of MECH) {
      if (!run(ph, cond, 150)) { out.push('n/a  ' + label + ` (phase ${ph + 1})`); continue; }
      // the next phase's run starts a Recast on its first frame, so the state is read at the moment that run starts
      const P2 = def.phases[ph + 1], run0 = P2.run; let snap = null; P2.run = function* (bb) { snap = bad(bb, false); yield* run0(bb); };
      const b = G.boss; b.hp = b.maxHp * def.phases[ph + 1].at - 5; let k = 0; while (k++ < 800 && (b.phase !== ph + 1 || b.transitioning)) step(0.05);
      P2.run = run0; push(label + ` (phase ${ph + 1} -> ${ph + 2})`, snap || ['next run never started']);
    }
    // the last blow during each finale mechanic (the Curtain call needs step 5)
    for (const [label, cond] of MECH) {
      const hold = label.includes('Curtain') ? (b) => { if (b.state.finale) T.setStep(b, 5); } : (b) => { if (b.state.finale) T.setStep(b, 4); };
      if (!run(n - 1, cond, 200, hold)) { out.push('n/a  last blow ' + label); continue; }
      const b = G.boss; G.ft = def.enrage + def.lastBlowAt; step(0.1); push('last blow ' + label, bad(b, true));
    }
    // a restart resets the ramp
    { run(n - 1, (b) => b.state.callStep >= 3, 200, (b) => { if (b.state.finale) T.setStep(b, 3); }); g.start('theatre', { cls: 'stormcaller', phase: 2 }); G.headless = true; step(0.5); const S = G.boss.state, q = [];
      if (S.callT > 1) q.push('callT=' + S.callT.toFixed(1)); if (S.callStep) q.push('callStep=' + S.callStep); if ((S.stepAt || []).length > 1) q.push('stepAt=' + S.stepAt.join(',')); if (S.curtainDone) q.push('curtainDone'); if (S.lead !== 0) q.push('lead=' + S.lead); if (S.dolls.some((d) => d.air)) q.push('doll lifted');
      push('restart resets the ramp', q); }
    g.god(false); return out;
  });
  console.log(r.join('\n'));
  console.log(r.some((l) => l.startsWith('FAIL')) ? 'callphase: FAILURES' : 'callphase: zero failures');
  await browser.close();
})();
