// node birdlift.js [flights] : Paper Birds with two dolls (Normal phase 3 and the Nightmare finale from step 3). He must lift the
// blue doll for every flight and set it down after: counts flights, how long the doll was up, whether it was still up when a
// Recast or a Cue started (must never be), hits that landed through the lifted doll (must be 0), and that it came down by the
// end. God mode + level-3 autopilot, headless.
const { launch } = require('./harness.js');
(async () => {
  const N = +(process.argv[2] || 6);
  const { browser, page } = await launch({ w: 320, h: 200 });
  let fails = 0;
  for (const nm of [false, true]) {
    await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=9' + (nm ? '&nm=1' : ''));
    await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
    const r = await page.evaluate(([N, nm]) => {
      const g = window.__game, G = g.G; G.headless = true; g.bot(3); g.god(true); g.start('theatre', { cls: 'duskblade', phase: 2 });
      const b = G.boss, S = b.state, T = b.def.nmTest, d = S.dolls[1];
      let flights = 0, up = false, t0 = 0, upT = [], badStart = 0, viaLifted = 0, birdsSeen = 0;
      const p = G.player, hurt0 = p.hurt.bind(p);
      p.hurt = (dmg, o) => { if (o && o.src && o.src.name === 'Understudy' && d.air) { const q = { x: p.pos.x, z: -p.pos.z }; if (g.Bul.list.some((bl) => Math.hypot(bl.x - q.x, bl.z - q.z) < bl.r + 0.6)) viaLifted++; } return hurt0(dmg, o); };
      const onStep = () => {
        if (nm && S.finale) T.setStep(b, 3); b.hp = Math.max(b.hp, b.maxHp * 0.12);
        if (g.Bul.list.some((q) => q.bird)) birdsSeen = 1;
        if (d.air && !up) { up = true; t0 = G.ft; flights++; }
        if (!d.air && up) { up = false; upT.push(+(G.ft - t0).toFixed(1)); }
        if (d.air && ((S.recast && S.recast.t0 === G.now) || (S.black && S.black.cue && S.black.at - G.now > (T.CUE.time[3] - 0.05)))) badStart++;
      };
      let s; for (let i = 0; i < 6000 && upT.length < N; i++) { s = g.fastForward(2, true, onStep); if (s.state !== 'fight') break; }
      g.god(false); return { flights, upT, badStart, viaLifted, birdsSeen, endUp: d.air, end: s.state, err: s.errors };
    }, [N, nm]);
    const bad = r.badStart + r.viaLifted + (r.flights < 1 ? 1 : 0) + (r.err && r.err.length ? 1 : 0); fails += bad;
    console.log((nm ? 'nightmare finale step 3' : 'normal phase 3') + `: ${r.flights} flights lifted, seconds up ${r.upT.join(' ')}, still up at a Recast/Cue start ${r.badStart}, hits through the lifted doll ${r.viaLifted}` + (r.err && r.err.length ? ' ERR ' + JSON.stringify(r.err).slice(0, 300) : '') + (bad ? ' FAIL' : ' ok'));
  }
  console.log(fails ? 'FAILURES ' + fails : 'birdlift: ok');
  await browser.close();
})();
