// node tools/chesslock.js : door `chess` lock-in audit. For each class, waits for a Gambit lock-in, then holds a direction and
// presses every skill slot each frame. The hero must not leave the cell recorded at lock time.
const { launch } = require('./harness.js');
(async () => {
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&seed=4');
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const g = window.__game, out = []; g.G.headless = true; g.god(true);
    for (const cls of g.G.classes.map((c) => c.id)) for (let rep = 0; rep < 3; rep++) {
      g.bot(3); g.start('chess', { cls, phase: rep }); const p = g.G.player; let t = 0;
      while (t < 60 && !(p.lockT > 0)) { g.fastForward(0.05); t += 0.05; }
      if (!(p.lockT > 0)) { out.push(cls + ' p' + rep + ': no lock seen'); continue; }
      const ci = (x) => Math.floor((x + 18) / 4.5), c0 = [ci(p.pos.x), ci(p.pos.z)], x0 = p.pos.x, z0 = p.pos.z; let maxD = 0, left = false, tried = 0;
      const ou = g.Bot.update; g.Bot.update = function (dt) { g.Input.bot = { moveX: Math.SQRT1_2, moveZ: Math.SQRT1_2 }; }; const key = () => {};
      while (p.lockT > 0) {
        for (let s = 0; s < 7; s++) { if (p.sk[s]) { p.sk[s].cd = 0; p.sk[s].charges = Math.max(1, p.sk[s].charges); p.gcd = 0; p.casting = null; if (p.block(s) === '') tried++; p.press(s); } }
        p.jump(); g.fastForward(1 / 60);
        maxD = Math.max(maxD, Math.hypot(p.pos.x - x0, p.pos.z - z0)); if (ci(p.pos.x) !== c0[0] || ci(p.pos.z) !== c0[1]) left = true;
      }
      const x1 = p.pos.x, z1 = p.pos.z; for (let f = 0; f < 30; f++) { p.press(0); g.fastForward(1 / 60); } const after = Math.hypot(p.pos.x - x1, p.pos.z - z1);
      g.Bot.update = ou;
      out.push(`control after the lock: walked ${after.toFixed(2)} m in 0.5 s;`);
      out.push(`${cls} p${rep}: moved ${maxD.toFixed(2)} m, left cell ${left}, presses that went through ${tried}`);
    }
    g.god(false); return out;
  });
  console.log(r.join('\n')); await browser.close();
})();
