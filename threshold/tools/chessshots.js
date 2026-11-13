// node tools/chessshots.js <outDir> [class] : door `chess` after a FULL normal entry (intro plays, no skipintro). Checks lighting and
// errors after the intro, then shoots the Gambit beats: glyph change, lock-in ring, check line, counter-attack, pawn trail and promotion warning.
const { launch } = require('./harness.js');
const path = require('path');
(async () => {
  const [out, cls = 'stormcaller'] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 1280, h: 720 }); page.setDefaultTimeout(600000);
  await page.goto('http://game.local/threshold/?mute=1&god=1&bot=3&quality=high&class=' + cls + '&boss=chess');
  await page.waitForFunction('window.__game && window.__game.G.state === "fight" && window.__game.G.boss && window.__game.G.boss.phase >= 0', null, { timeout: 600000, polling: 500 });
  await page.evaluate('document.getElementById("fade").style.transition="none"');
  const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
  console.log('after intro', JSON.stringify(await page.evaluate(() => { const g = window.__game, b = g.G.boss, S = b.state; return { phase: b.phase, key: S.key.intensity, nan: [S.key.intensity, S.hemi.intensity, S.lampI.value].some((v) => !isFinite(v)), errors: g.G.errors }; })));
  const until = (cond, max = 3000) => page.evaluate(([c, max]) => { const g = window.__game, f = new Function('g', 'b', 'S', 'p', 'return ' + c); for (let k = 0; k < max; k++) { if (f(g, g.G.boss, g.G.boss.state, g.G.player)) return k; g.warm(1 / 60); } return -1; }, [cond, max]);
  const shot = async (name) => { await frames(4); const f = path.join(out, name + '.png'); await page.screenshot({ path: f }); console.log(f, JSON.stringify(await page.evaluate('window.__game.state()'))); };
  console.log('glyph', await until('S.inGambit && S.glyphPulse > 0.55 && S.glyphPulse < 0.75')); await shot('1_glyph_pulse');
  console.log('lock', await until('p.lockT > 0.5')); await shot('2_lockin_ring');
  console.log('check', await until('S.checkUntil > g.G.now && S.checkUntil - g.G.now > 9.75')); await shot('3_check_line');
  await page.evaluate(() => { window.__game.G.chessBot = 'nocheck'; });
  console.log('refute', await until("S.log.length && S.log[S.log.length - 1] === 'refuted' && !S.inGambit === false", 4000)); await shot('4_counter_attack');
  await page.evaluate(() => { const g = window.__game; g.G.chessBot = ''; g.setPhase(1); });
  console.log('pawn', await until("S.lvl === 1 && S.pieces.some((q) => q.type === 'P' && !q.gone && q.dropT <= 0)", 6000)); await shot('5_pawn_trail');
  await page.evaluate(() => { const S = window.__game.G.boss.state, q = S.pieces.find((x) => x.type === 'P' && !x.gone); if (q && q.j < 5) { q.j = 5; q.z = (5 - 3.5) * 4.5; } });
  console.log('warn', await until("S.pieces.some((q) => q.type === 'P' && !q.gone && q.j >= 6) && !S.inGambit", 6000)); await shot('6_promotion_warning');
  console.log('errors', JSON.stringify(await page.evaluate('window.__game.G.errors')));
  await browser.close();
})();
