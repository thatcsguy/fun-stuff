// node stillcounter.js : the Stillness Counter fires on ANY player hit that lands on a still Issen, whoever is selected (Patrick
// 2026-11-26: tabbing away at the bell must not save a cast already aimed at him). Niten (Nightmare last phase): a Bolt started on
// the twin who then kneels, landing after the player tabs to the awake one, counters and builds no Static; a second hit inside
// COUNTER_CD (0.8 s) is swallowed, one after it counters again. Normal: the same two-hit rule on the single Issen's Stillness.
const { launch } = require('./harness.js');
(async () => {
  const { browser, page } = await launch({ w: 320, h: 200 });
  const out = [];
  for (const nm of [1, 0]) {
    await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=9' + (nm ? '&nm=1' : ''));
    await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
    out.push(...await page.evaluate((nm) => {
      const g = window.__game, G = g.G, def = g.def('duelist'), n = def.phases.length, o = [], step = (s) => g.fastForward(s, false);
      g.start('duelist', { cls: 'stormcaller', phase: nm ? n - 1 : 0 }); G.headless = true; g.bot(3); g.god(true);
      const b = G.boss, S = b.state, p = G.player, bolt = p.sk.findIndex((s) => s.def.id === 'bolt');
      let t = 0;
      const ok = (c, label) => o.push((c ? 'ok   ' : 'FAIL ') + (nm ? 'NM Niten: ' : 'Normal: ') + label);
      const stillBody = () => { if (!nm) return S.still ? b : null; if (!S.niten || !S.lead) return null; const F = S.lead === S.A ? S.R : S.A; return F.still && G.now >= F.graceT ? F : null; };
      // wait for a fresh kneel with no Counter yet this cycle
      while (t < 120 && !(stillBody() && !S.countered && b.phase === (nm ? n - 1 : 0))) { step(0.05); t += 0.05; b.hp = Math.max(b.hp, b.maxHp * 0.3); }
      if (t >= 120) { ok(false, 'no Stillness reached'); return o; }
      g.bot(0); g.god(false); p.casting = null; const F = stillBody(), still = nm ? F.ent : b, awake = nm ? S.lead.ent : b;
      p.target = awake; p.res = 0; const at0 = S.counterAt || 0, h0 = p.hp;
      p.commit(bolt, still, true); // a Bolt started on him lands after the player has tabbed to the awake one
      ok(S.counterAt > at0, 'Bolt on the still body counters with the other twin selected');
      if (nm) ok(p.res === 0, 'that Bolt builds no Static (res ' + p.res + ')'); // Normal Issen is not immune when still: the Bolt lands
      step(0.4); const at1 = S.counterAt; still.damage(10, { src: 'player' }); ok(S.counterAt === at1, 'a second hit inside 0.8 s is swallowed');
      ok(p.hp < h0, 'the Counter hit the player: ' + h0 + ' -> ' + p.hp);
      step(0.5); if (stillBody()) { still.damage(10, { src: 'player' }); ok(S.counterAt > at1, 'a later hit in the same kneel counters again'); } else o.push('n/a  later hit: kneel already over');
      return o;
    }, nm));
  }
  console.log(out.join('\n')); await browser.close();
})();
