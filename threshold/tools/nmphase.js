// node nmphase.js [boss] : forces each nightmare phase change in the middle of a mechanic and checks that the next phase's enter
// leaves no per-mechanic state behind. Issen (duelist): Stillness tell, Stillness, a Counter, Final Verse.
// Pentimento (atelier): a Roller, a live Blot, a Critique cast, a matched Critique. In the last phase the last blow (the enrage's
// themed end) cuts off a swap, a Counter, the Verse, paired Moons (Issen) or a Fresh Coat, a Critique, a Roller, a repair, a pair,
// the signature (Pentimento), and nothing may remain after its first beat. Then a restart must reset the ramp state.
// Parallax (engine): mid-Polarize, with the beams out, with a Siphon Drone drinking; Blackout also mid-Swallow. Afterwards: no
// Polarize or core colour left, no drone, no drain, beams relit after an enter (gone after Blackout), dmgTaken 1 or GATE.off, no
// paint on fallen tiles, no tile both dark and painted, no cinematic camera.
// Co.stopTag('phase') skips a coroutine's cleanup, so anything a cut-off mechanic set must be reset by the next enter.
const { launch } = require('./harness.js');
(async () => {
  const boss = process.argv[2] || 'duelist';
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=9');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate((boss) => {
    const g = window.__game, G = g.G, out = [], def = g.def(boss), n = def.phases.length;
    const step = (sec) => g.fastForward(sec, false);
    // what "clean" means once the next phase has finished its enter
    const check = (label) => {
      const b = G.boss, S = b.state, bad = [];
      if (S.still) bad.push('still'); if (S.warn > 0) bad.push('warn'); if (S.kneel > 0) bad.push('kneel=' + S.kneel); if (S.open > 0) bad.push('open');
      if (boss === 'duelist' && b.dmgTaken !== 1) bad.push('dmgTaken=' + b.dmgTaken); if (!b.group.visible) bad.push('hidden'); if (!b.targetable) bad.push('untargetable');
      if (S.weapon && !S.weapon.visible) bad.push('sheathed'); if (G.timeScale !== 1) bad.push('timeScale=' + G.timeScale); if (S.verse) bad.push('verse');
      if (b.lastBlowing) bad.push('lastBlow'); if (b.immune) bad.push('immune');
      if (S.extraCheck) bad.push(...S.extraCheck(b));
      if (boss === 'atelier') bad.push(...atelierBad(b));
      out.push((bad.length ? 'FAIL ' : 'ok   ') + label + (bad.length ? ': ' + bad.join(', ') : ''));
    };
    // door XIX: what a cut-off mechanic could leave behind (the look of the world - colour, Negative, split - is not per-mechanic)
    const atelierBad = (b) => { const S = b.state, bad = [];
      if (S.roll) bad.push('roller'); if (S.blotList.length || G.ents.some((e) => e.isAdd && e.alive)) bad.push('blots'); if (S.blots) bad.push('blots=' + S.blots);
      if (S.down > 0) bad.push('down'); if (S.crit > 0) bad.push('crit'); if (S.flood) bad.push('flood'); if (S.faceSide) bad.push('faceSide'); if (S.top !== 7.5) bad.push('swirl top=' + S.top);
      if (S.sig) bad.push('signature'); if (S.varnR < 30) bad.push('varnish ring'); if (S.cine || g.Cam.cine) bad.push('cinematic'); if (b.castState) bad.push('cast ' + b.castState.name);
      if (b.phase < 2 && (S.split || S.fin || S.call || S.seamOn)) bad.push('finale state before the finale'); if (b.phase === 2 && (!S.split || !S.seamOn || !S.fin)) bad.push('finale not set');
      return bad; };
    // Parallax: what a cut-off mechanic could leave behind (the eclipse and the board are the look of the phase, not per-mechanic)
    const engineBad = (b, after) => { const S = b.state, bad = [], T = def.nmTest;
      if (S.pol) bad.push('polarize'); if (S.dangerCol) bad.push('core colour ' + S.dangerCol); if (G.ents.some((e) => e.isAdd && e.alive)) bad.push('drone');
      if (S.tiles.some((t) => t.drain > 0)) bad.push('drain'); if (S.tiles.some((t) => t.col && !t.present)) bad.push('paint on a fallen tile'); if (S.tiles.some((t) => t.col && t.dead)) bad.push('dark and painted');
      if (b.dmgTaken !== 1 && b.dmgTaken !== T.GATE.off) bad.push('dmgTaken=' + b.dmgTaken); if (S.cine || g.Cam.cine) bad.push('cinematic');
      if (after === 'enter') { if (!S.sweep || S.sweep.out) bad.push('beams not relit'); if (b.castState) bad.push('cast ' + b.castState.name); if (b.immune) bad.push('immune'); }
      if (after === 'blow') { if (S.sweep) bad.push('beams still on'); }
      return bad; };
    // advance to phase `ph`, wait for `cond` (a mechanic in flight), then push past the next threshold
    const cut = (ph, label, cond, maxSec = 120) => {
      g.start(boss, { cls: 'stormcaller', phase: ph }); G.headless = true; g.bot(3); g.god(true);
      const b = G.boss; let t = 0;
      while (t < maxSec && !(b.phase === ph && !b.transitioning && cond(b))) { step(0.05); b.hp = Math.max(b.hp, b.maxHp * (def.phases[ph + 1].at + 0.02)); t += 0.05; }
      if (t >= maxSec) { out.push('n/a  ' + label + ' (not in this phase)'); return; }
      // door XIX starts a new mechanic on the first frame of the next run, so its state is read at the moment that run starts
      const P2 = def.phases[ph + 1], run0 = P2.run; let snap = null; if (boss === 'atelier') P2.run = function* (bb) { snap = atelierBad(bb); yield* run0(bb); }; if (boss === 'engine') P2.run = function* (bb) { snap = engineBad(bb, 'enter'); yield* run0(bb); };
      b.hp = b.maxHp * def.phases[ph + 1].at - 5; let k = 0;
      while (k++ < 600 && (b.phase !== ph + 1 || b.transitioning)) step(0.05);
      P2.run = run0;
      if (boss === 'atelier' || boss === 'engine') { out.push((snap && snap.length ? 'FAIL ' : snap ? 'ok   ' : 'FAIL ') + label + ` (phase ${ph + 1} -> ${ph + 2})` + (snap ? (snap.length ? ': ' + snap.join(', ') : '') : ': next run never started')); return; }
      step(0.1); check(label + ` (phase ${ph + 1} -> ${ph + 2})`);
    };
    for (let ph = 0; ph < n - 1 && boss === 'atelier'; ph++) {
      cut(ph, 'during a Roller', (b) => !!b.state.roll);
      cut(ph, 'with a live Blot', (b) => b.state.blotList.length > 0);
      cut(ph, 'during a Critique cast', (b) => b.state.crit > 0);
      cut(ph, 'during a matched Critique (he is down)', (b) => b.state.down > 0);
    }
    for (let ph = 0; ph < n - 1 && boss === 'engine'; ph++) {
      cut(ph, 'during a Polarize cast', (b) => !!b.state.pol && b.state.pol.t < 2);
      cut(ph, 'with the beams out after a blast', (b) => !b.state.pol && b.state.sweep && b.state.sweep.out && b.state.sweep.relightT > 0);
      if (ph === 1) cut(ph, 'with a Siphon Drone drinking', (b) => b.state.siphons.some((e) => e.alive && e.drink));
    }
    for (let ph = 0; ph < n - 1 && boss === 'duelist'; ph++) {
      cut(ph, 'during the Stillness tell', (b) => b.state.warn > 0);
      cut(ph, 'during Stillness', (b) => b.state.still);
      cut(ph, 'during a Counter', (b) => { const S = b.state; if (S.still && G.now >= S.graceT && !S.countered) b.damage(10, { src: 'player' }); return S.countered && b.state.still; });
      cut(ph, 'during Final Verse', (b) => !b.group.visible || b.state.verse);
    }
    // the last phase has no next phase: its mechanics are cut off by the last blow instead (Issen: Niten's swap, a Counter by the
    // still body, the twin Final Verse, a Moon and its Eye, the Lighthouse Storm and its lanes, Echo from the still one, Twin Petal Storm).
    // After the last blow's first beat, no mechanic state may remain.
    // FK / NT: force Pentimento's sitting count or Niten's ramp clock first, so the late-ramp mechanics are in play.
    const last = n - 1, LP = def.phases[last];
    const over = (label, cond, bad2, force) => {
      g.start(boss, { cls: 'stormcaller', phase: last }); G.headless = true; g.bot(3); g.god(true);
      const b = G.boss; let t = 0, forced = !force;
      while (t < 150 && !(b.phase === last && !b.transitioning && forced && cond(b))) { step(0.05); if (!forced && b.phase === last && !b.transitioning) { force(b.state); forced = true; } b.hp = Math.max(b.hp, b.maxHp * (boss !== 'atelier' ? 0.1 : b.state.sigDone ? 0.02 : 0.08)); t += 0.05; }
      if (t >= 150) { out.push('n/a  last blow ' + label); return; }
      G.ft = Math.max(G.ft, def.enrage + (def.lastBlowAt || 24)); step(0.05); step(1.0);
      if (!b.lastBlowing) { out.push('FAIL last blow ' + label + ': did not start'); return; }
      const S = b.state, bad = bad2 ? bad2(b) : [];
      if (!bad2) for (const act of [S.A, S.R].filter(Boolean)) { if (act.warn > 0) bad.push(act.name + '.warn'); if (act.hold) bad.push(act.name + '.hold'); if (act.open > 0) bad.push(act.name + '.open'); if (act.ent.dmgTaken !== 1) bad.push(act.name + '.dmgTaken'); }
      if (!bad2) { if (!b.group.visible) bad.push('hidden'); if (!b.targetable) bad.push('untargetable'); } if (S.R && S.niten && (!S.R.root.visible || !S.R.ent.targetable)) bad.push('reflection hidden'); if (S.verse) bad.push('verse'); if (S.cine) bad.push('cinematic');
      if (boss === 'duelist') { if (S.calmHint) bad.push('calmHint'); if (S.lanes && S.lanes.length) bad.push('lanes'); if (S.eye) bad.push('eye'); if (S.storm) bad.push('storm ' + S.storm); if (S.unison) bad.push('unison'); if (S.echoing) bad.push('echoing'); if (S.stormHold) bad.push('stormHold'); if (S.waking) bad.push('waking'); if (S.cycleCuts) bad.push('cycleCuts ' + S.cycleCuts); if (S.cycleMirror) bad.push('cycleMirror'); if (S.ghosts.some((q) => q.cut)) bad.push('standing ghosts'); if (S.R && S.R.ent.castState) bad.push('reflection cast ' + S.R.ent.castState.name); if (g.Bul.list.some((q) => q.storm)) bad.push('storm petals'); }
      out.push((bad.length ? 'FAIL ' : 'ok   ') + 'last blow ' + label + ` (phase ${last + 1})` + (bad.length ? ': ' + bad.join(', ') : ''));
    };
    const overA = (label, cond, force) => over(label, cond, (b) => { const S = b.state, bad = atelierBad(b).filter((q) => q !== 'varnish ring'); if (S.varnR > 25) bad.push('no varnish ring'); return bad; }, force);
    if (boss === 'atelier') {
      overA('during a Fresh Coat (the swirl rising)', (b) => b.state.call && b.state.top < 7 && b.state.top > 0);
      overA('during a finale Critique cast', (b) => b.state.split && b.state.crit > 0);
      overA('during a Roller in the finale', (b) => b.state.split && !!b.state.roll);
      overA('right after a repair drop (lazy autopilot)', (b) => { g.Bot.lazy = true; const L = b.state.critLog; return b.state.crit > 0 && L.length && /paint|wash/.test(L[L.length - 1].fix); });
      overA('during a Roller at seam speed (step 3)', (b) => b.state.split && !!b.state.roll && b.state.lineW > 0.2, (S) => { S.fk = 6; });
      overA('between the Critiques of a pair (step 4)', (b) => b.state.split && b.state.finStep === 4 && b.state.crit > 0 && b.state.crit < 3.9 && b.state.critLog.length >= 2 && b.state.critLog[b.state.critLog.length - 1].T === 4, (S) => { S.fk = 8; });
      overA('during the signature', (b) => { if (!b.state.sigDone) b.hp = Math.min(b.hp, b.maxHp * 0.095); return b.state.sig > 0; });
    }
    const overE = (label, cond, force) => over(label, cond, (b) => engineBad(b, 'blow'), force);
    if (boss === 'engine') {
      overE('during a Polarize cast', (b) => !!b.state.pol && b.state.pol.t < 2.5);
      overE('with the beams out after a blast', (b) => !b.state.pol && b.state.sweep && b.state.sweep.out);
      overE('mid-Swallow (step 1)', (b) => b.state.tiles.some((t) => t.warn > 0), (S) => { S.cyc = 2; });
      overE('with a Siphon Drone drinking (step 2)', (b) => b.state.siphons.some((e) => e.alive && e.drink), (S) => { S.cyc = 4; });
      overE('during a Supernova (step 3)', (b) => b.castState && b.castState.name === 'Supernova' || g.Bul.list.length > 20, (S) => { S.cyc = 6; });
    }
    if (boss === 'duelist') {
    over('during a swap tell', (b) => b.state.niten && b.state.lead && b.state.lead.warn > 0);
    over('during a Counter by the still body', (b) => { const S = b.state; if (!S.niten || !S.lead) return false; const F = S.lead === S.A ? S.R : S.A; if (F.still && G.now >= F.graceT && !S.countered) { G.player.target = F.ent; F.ent.damage(10, { src: 'player' }); } return F.hold; });
    over('during the twin Final Verse', (b) => b.state.niten && !b.group.visible);
    over('during a Full Moon (the Eye)', (b) => !!b.state.eye, null, (S) => { S.nitenT = 2 * def.nmTest.RAMP + 20; });
    over('during the Lighthouse Storm with a cut lane', (b) => b.state.storm === 'on' && b.state.lanes.length > 0);
    over('during the storm tell', (b) => b.state.storm === 'tell');
    over('during a Waking Cut (two waves, mirror ghost)', (b) => !!b.state.waking && b.state.waking.n >= 3, null, (S) => { S.nitenT = 4 * def.nmTest.RAMP; });
    over('during a Final Verse still moment', (b) => b.state.niten && b.state.verse && b.state.lead && b.state.lead.ent.targetable, null, (S) => { S.nitenT = 3 * def.nmTest.RAMP; });
    over('during a swap at step 5 (0.9 s tell)', (b) => b.state.niten && b.state.nitenStep === 5 && b.state.lead && b.state.lead.warn > 0, null, (S) => { S.nitenT = 5 * def.nmTest.RAMP; });
    over('during twin Petal Storm (step 4)', (b) => b.state.niten && b.state.nitenStep >= 4 && b.state.unison && g.Bul.list.some((q) => q.petal && !q.storm), null, (S) => { S.nitenT = 4 * def.nmTest.RAMP; });
    }
    // a restart after a late, ramped fight: the ramp state is back at its start values
    {
      g.start(boss, { cls: 'stormcaller', phase: last }); G.headless = true; g.bot(3); g.god(true); const b = G.boss; let t = 0;
      while (t < 60 && (b.phase !== last || b.transitioning)) { step(0.1); t += 0.1; }
      if (boss === 'duelist') b.state.nitenT = 5 * def.nmTest.RAMP; else if (boss === 'engine') def.nmTest.setStep(b, 5); else b.state.fk = 8; step(40);
      g.start(boss, { cls: 'stormcaller' }); step(0.1); const S = G.boss.state, bad = [];
      if (boss === 'duelist') { if (S.nitenT > 0.2 || S.nitenStep || S.tellT !== 1.2 || S.haste > 1) bad.push(`nitenT ${S.nitenT} step ${S.nitenStep} tell ${S.tellT} haste ${S.haste}`); }
      else if (boss === 'engine') { if (S.cyc || S.step !== -1 || S.stepAt.length || S.swallowed.length || S.holdStep !== undefined || S.ecl3 || S.eclLvl) bad.push(`cyc ${S.cyc} step ${S.step} stepAt ${S.stepAt} ecl3 ${S.ecl3}`); }
      else if (S.fk || Math.abs(S.lineW - def.nmTest.SEAM_W[0]) > 1e-9 || S.finStep) bad.push(`fk ${S.fk} lineW ${S.lineW} step ${S.finStep}`);
      if (G.boss.lastBlowing || G.boss.enraged) bad.push('enrage state');
      out.push((bad.length ? 'FAIL ' : 'ok   ') + 'restart resets the ramp' + (bad.length ? ': ' + bad.join(', ') : ''));
    }
    g.Bot.lazy = false; g.god(false); return out;
  }, boss);
  console.log(r.join('\n'));
  await browser.close(); process.exit(r.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})();
