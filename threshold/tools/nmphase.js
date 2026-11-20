// node nmphase.js [boss] : forces each nightmare phase change in the middle of a mechanic (Stillness tell, Stillness, a
// Counter, Final Verse, the overtime blow) and checks that the next phase's enter leaves no per-mechanic state behind:
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
      if (b.dmgTaken !== 1) bad.push('dmgTaken=' + b.dmgTaken); if (!b.group.visible) bad.push('hidden'); if (!b.targetable) bad.push('untargetable');
      if (S.weapon && !S.weapon.visible) bad.push('sheathed'); if (G.timeScale !== 1) bad.push('timeScale=' + G.timeScale); if (S.verse) bad.push('verse');
      if (b.overtime) bad.push('overtime'); if (b.immune) bad.push('immune');
      if (S.extraCheck) bad.push(...S.extraCheck(b));
      out.push((bad.length ? 'FAIL ' : 'ok   ') + label + (bad.length ? ': ' + bad.join(', ') : ''));
    };
    // advance to phase `ph`, wait for `cond` (a mechanic in flight), then push past the next threshold
    const cut = (ph, label, cond, maxSec = 120) => {
      g.start(boss, { cls: 'stormcaller', phase: ph }); G.headless = true; g.bot(3); g.god(true);
      const b = G.boss; let t = 0;
      while (t < maxSec && !(b.phase === ph && !b.transitioning && cond(b))) { step(0.05); b.hp = Math.max(b.hp, b.maxHp * (def.phases[ph + 1].at + 0.02)); t += 0.05; }
      if (t >= maxSec) { out.push('n/a  ' + label + ' (not in this phase)'); return; }
      b.hp = b.maxHp * def.phases[ph + 1].at - 5; let k = 0;
      while (k++ < 600 && (b.phase !== ph + 1 || b.transitioning)) step(0.05);
      step(0.1); check(label + ` (phase ${ph + 1} -> ${ph + 2})`);
    };
    for (let ph = 0; ph < n - 1; ph++) {
      const P = def.phases[ph];
      cut(ph, 'during the Stillness tell', (b) => b.state.warn > 0);
      cut(ph, 'during Stillness', (b) => b.state.still);
      cut(ph, 'during a Counter', (b) => { const S = b.state; if (S.still && G.now >= S.graceT && !S.countered) b.damage(10, { src: 'player' }); return S.countered && b.state.still; });
      cut(ph, 'during Final Verse', (b) => !b.group.visible || b.state.verse);
      cut(ph, 'during overtime (sheathed, slow time)', (b) => { if (!b.overtime) b.phaseT = Math.max(b.phaseT, P.budget - 0.01); return b.overtime && G.timeScale < 1; });
      cut(ph, 'during the overtime telegraph', (b) => { if (!b.overtime) b.phaseT = Math.max(b.phaseT, P.budget - 0.01); return b.overtime && G.timeScale === 1 && g.Hz.list.length > 0; });
    }
    // the last phase has no next phase: its mechanics are cut off by the overtime instead (door III: Niten's swap, a Counter by the
    // still body, the twin Final Verse, paired Moons). After the overtime's first beat, no mechanic state may remain.
    const last = n - 1, LP = def.phases[last];
    const over = (label, cond) => {
      g.start(boss, { cls: 'stormcaller', phase: last }); G.headless = true; g.bot(3); g.god(true);
      const b = G.boss; let t = 0;
      while (t < 150 && !(b.phase === last && !b.transitioning && cond(b))) { step(0.05); b.hp = Math.max(b.hp, b.maxHp * 0.1); t += 0.05; }
      if (t >= 150) { out.push('n/a  overtime ' + label); return; }
      b.phaseT = LP.budget; step(0.05); step(1.0);
      const S = b.state, bad = [];
      for (const act of [S.A, S.R].filter(Boolean)) { if (act.warn > 0) bad.push(act.name + '.warn'); if (act.hold) bad.push(act.name + '.hold'); if (act.open > 0) bad.push(act.name + '.open'); if (act.ent.dmgTaken !== 1) bad.push(act.name + '.dmgTaken'); }
      if (!b.group.visible) bad.push('hidden'); if (!b.targetable) bad.push('untargetable'); if (S.R && S.niten && (!S.R.root.visible || !S.R.ent.targetable)) bad.push('reflection hidden'); if (S.verse) bad.push('verse'); if (S.cine) bad.push('cinematic'); if (S.moonHint) bad.push('moonHint');
      out.push((bad.length ? 'FAIL ' : 'ok   ') + 'overtime ' + label + ` (phase ${last + 1})` + (bad.length ? ': ' + bad.join(', ') : ''));
    };
    over('during a swap tell', (b) => b.state.niten && b.state.lead && b.state.lead.warn > 0);
    over('during a Counter by the still body', (b) => { const S = b.state; if (!S.niten || !S.lead) return false; const F = S.lead === S.A ? S.R : S.A; if (F.still && G.now >= F.graceT && !S.countered) F.ent.damage(10, { src: 'player' }); return F.hold; });
    over('during the twin Final Verse', (b) => b.state.niten && !b.group.visible);
    over('during paired Moons', (b) => !!b.state.moonHint);
    g.god(false); return out;
  }, boss);
  console.log(r.join('\n'));
  await browser.close(); process.exit(r.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})();
