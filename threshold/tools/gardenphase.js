// node gardenphase.js : Euryale's Nightmare phase changes and last blow, forced in the middle of each mechanic. Co.stopTag('phase')
// skips a coroutine's cleanup, so anything a cut-off mechanic set must be reset by the next enter (nmReset). Each phase change is
// forced during a Behold, a statue rising from the floor, Serpent Lash, Nest of Vipers and an open (cracked) window, and the last
// blow (A Thousand Eyes, 24 s into the enrage) during those and the second mirror rising. Nothing may be left behind once the next
// phase's run starts (or the last blow has started): a held stare, a pending floor rise, a turned-off autoFace, a half-risen
// mirror, a cinematic camera, slow time, a gate at anything but OPEN.on / OPEN.off. Then a restart must reset the garden.
const { launch } = require('./harness.js');
(async () => {
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=9');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const g = window.__game, G = g.G, out = [], def = g.def('gorgon'), n = def.phases.length, T = def.nmTest;
    const step = (sec) => g.fastForward(sec, false);
    const bad = (b, last) => { const S = b.state, q = []; if (!last && b.transitioning) q.push('transitioning');
      if (S.gaze && !last) q.push('gaze=' + S.gaze.toFixed(2)); if (S.locked) q.push('locked'); // the last blow is a stare of its own if (S.mode && !last) q.push('mode'); if (S.rear && !last) q.push('rear');
      if (!b.autoFace && !last) q.push('autoFace off'); if (S.rising.length) q.push('floor rise pending'); if (S.cine || g.Cam.cine) q.push('cinematic'); if (G.timeScale !== 1) q.push('timeScale=' + G.timeScale);
      if (b.dmgTaken !== T.OPEN.on && b.dmgTaken !== T.OPEN.off) q.push('dmgTaken=' + b.dmgTaken);
      for (const m of S.mir) if (m.on && Math.abs(m.y - 5.2) > 0.01) q.push('mirror y=' + m.y.toFixed(2));
      const want = b.phase >= 1 ? (b.phase === 1 ? 1 : T.STEP[Math.max(0, S.gStep)].mirrors) : 0; if (!last && S.nMir !== want) q.push('mirrors ' + S.nMir + ' (want ' + want + ')');
      if (last && G.ents.some((e) => e.isAdd && e.alive && !e.strike)) q.push('statues left awake');
      if (!last && (b.lastBlowing || b.immune)) q.push(b.lastBlowing ? 'lastBlow' : 'immune');
      if (b.phase === 2 && !last && !S.finale) q.push('finale not set');
      return q; };
    const push = (label, q) => out.push((q.length ? 'FAIL ' : 'ok   ') + label + (q.length ? ': ' + q.join(', ') : ''));
    const MECH = [
      ['during a Behold (stare locked)', (b) => !!b.castState && b.castState.name === 'Behold' && b.state.locked],
      ['during a floor rise', (b) => b.state.rising.length > 0],
      ['during Serpent Lash', (b) => !!b.castState && b.castState.name === 'Serpent Lash'],
      ['during Nest of Vipers', (b) => !!b.castState && b.castState.name === 'Nest of Vipers'],
      ['while she is cracked open', (b) => G.now < b.state.openUntil - 1],
    ];
    const run = (ph, cond, maxSec, hold) => { g.start('gorgon', { cls: 'stormcaller', phase: ph }); G.headless = true; g.bot(3); g.god(true);
      const b = G.boss; let t = 0; while (t < maxSec && !(b.phase === ph && !b.transitioning && cond(b))) { if (hold) hold(b); step(0.05); b.hp = Math.max(b.hp, b.maxHp * (ph + 1 < n ? def.phases[ph + 1].at + 0.02 : 0.11)); t += 0.05; } return t < maxSec; };
    for (let ph = 0; ph < n - 1; ph++) for (const [label, cond] of MECH) {
      if (!run(ph, cond, 150)) { out.push('n/a  ' + label + ` (phase ${ph + 1})`); continue; }
      const P2 = def.phases[ph + 1], run0 = P2.run; let snap = null; P2.run = function* (bb) { snap = bad(bb, false); yield* run0(bb); };
      const b = G.boss; b.hp = b.maxHp * def.phases[ph + 1].at - 5; let k = 0; while (k++ < 800 && (b.phase !== ph + 1 || b.transitioning)) step(0.05);
      P2.run = run0; push(label + ` (phase ${ph + 1} -> ${ph + 2})`, snap || ['next run never started']);
    }
    // the last blow during each finale mechanic, and while the second mirror rises (step 2)
    const LB = MECH.concat([['while the second mirror rises', (b) => b.state.nMir === 2 && b.state.mir[1].y < 5]]);
    for (const [label, cond] of LB) {
      const st = label.includes('mirror') ? 2 : 4, hold = (b) => { if (b.state.finale) T.setStep(b, st); };
      if (!run(n - 1, cond, 200, hold)) { out.push('n/a  last blow ' + label); continue; }
      const b = G.boss; G.ft = def.enrage + def.lastBlowAt; step(0.1); push('last blow ' + label, bad(b, true));
      step(4); push('last blow lands ' + label, G.state === 'dead' && G.player.deathSrc === 'enrage' ? [] : ['state ' + G.state + ' src ' + G.player.deathSrc]);
    }
    // a restart resets the garden
    { run(n - 1, (b) => b.state.gStep >= 3, 200, (b) => { if (b.state.finale) T.setStep(b, 3); }); g.start('gorgon', { cls: 'stormcaller', phase: 2 }); G.headless = true; step(0.5); const S = G.boss.state, q = [];
      if (S.gardenT > 1) q.push('gardenT=' + S.gardenT.toFixed(1)); if (S.gStep > 0) q.push('gStep=' + S.gStep); if ((S.stepAt || []).length > 1) q.push('stepAt=' + S.stepAt.join(',')); if (S.noRegrow) q.push('noRegrow'); if (S.fedLog.length) q.push('fedLog'); if (S.nMir !== 1) q.push('mirrors=' + S.nMir);
      if (S.ped.some((p) => !p.has)) q.push('plinths not regrown');
      push('restart resets the garden', q); }
    g.god(false); return out;
  });
  console.log(r.join('\n'));
  console.log(r.some((l) => l.startsWith('FAIL')) ? 'gardenphase: FAILURES' : 'gardenphase: zero failures');
  await browser.close();
})();
