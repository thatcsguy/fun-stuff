// node wakefuzz.js [trials] [runs] : route check for Issen Nightmare's Waking Cut (Niten). At every swap every standing ghost line
// fires (wave 1 at WAKE.tell, the still one's wave 2 WAKE.wave2 later), so a safe wedge must always exist and be reachable.
// Part 1, geometry fuzz (no game needed beyond the levers): per ramp step, `trials` random swap cycles. The blade starts anywhere
// within 9 m of the centre and each Draw Cut runs from him toward a random player spot to the deck edge (as nitenCut: at least 6 m,
// to 14.2 m from the centre), he dashes to its end; from WAKE.twoWaves every other cut is wave 2, from WAKE.mirror the first cut
// also leaves its mirror (x -> -x) in wave 2. A spot is safe when it is MARGIN m clear of every wave-1 and every wave-2 line, or
// (two waves) clear of wave 1 and one step (STEP m, 0.6 s at 7 m/s less a reaction) from a spot clear of wave 2. Reports per step
// the worst safe-area share of the deck and the worst walk from the player's last spot to the nearest safe spot (must be < 9 m,
// the 1.3 s tell at 7 m/s). Part 2, live: the level-3 Stormcaller autopilot through whole Niten phases (god mode, `runs` runs),
// the same check on the real board at every swap. Exit code 1 if any cycle has no safe spot or none in reach.
const { launch } = require('./harness.js');
const MARGIN = 0.35, HALF = 2.3 / 2, DECK = 14.3, STEP = 3.0, REACH = 9.0;
function inRect(c, x, z, m) { const s = Math.sin(c.dir), co = Math.cos(c.dir), dx = x - c.x, dz = z - c.z, u = dx * s + dz * co, v = dx * co - dz * s; return u > -m && u < c.len + m && Math.abs(v) < HALF + m; }
function check(cuts, px, pz) {
  const w1 = cuts.filter((c) => c.wave !== 2), w2 = cuts.filter((c) => c.wave === 2), G = 0.5; let n = 0, safe = 0, best = Infinity; const clear2 = [];
  for (let x = -DECK; x <= DECK; x += G) for (let z = -DECK; z <= DECK; z += G) { if (x * x + z * z > DECK * DECK) continue; if (!w2.some((c) => inRect(c, x, z, MARGIN))) clear2.push([x, z]); }
  for (let x = -DECK; x <= DECK; x += G) for (let z = -DECK; z <= DECK; z += G) {
    if (x * x + z * z > DECK * DECK) continue; n++;
    if (w1.some((c) => inRect(c, x, z, MARGIN))) continue;
    let ok = !w2.some((c) => inRect(c, x, z, MARGIN));
    if (!ok && w2.length) for (const [qx, qz] of clear2) if (Math.hypot(qx - x, qz - z) < STEP && !w1.some((c) => inRect(c, qx, qz, 0)) ) { ok = true; break; }
    if (!ok) continue; safe++; const d = Math.hypot(x - px, z - pz); if (d < best) best = d;
  }
  return { share: safe / n, walk: best };
}
function edgeLen(x, z, a) { let d = 0; while (d < 40) { const nx = x + Math.sin(a) * (d + 0.5), nz = z + Math.cos(a) * (d + 0.5); if (nx * nx + nz * nz > 14.2 * 14.2) break; d += 0.5; } return d; }
let rs = 12345; const rnd = () => (rs = (rs * 1103515245 + 12345) % 2147483648) / 2147483648;
(async () => {
  const [trials = '400', runs = '3'] = process.argv.slice(2); let bad = 0;
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  const W = await page.evaluate(() => window.__game.def('duelist').nightmare.nmTest.WAKE);
  console.log('geometry fuzz, ' + trials + ' cycles per step (cuts ' + W.cuts.join('/') + ', two waves from step ' + W.twoWaves + ', mirror from step ' + W.mirror + ')');
  for (let st = 0; st < 6; st++) {
    let worstShare = 1, worstWalk = 0, fails = 0;
    for (let k = 0; k < +trials; k++) {
      const a0 = rnd() * Math.PI * 2, r0 = Math.sqrt(rnd()) * 9; let bx = Math.sin(a0) * r0, bz = Math.cos(a0) * r0, px = 0, pz = 0; const cuts = [];
      for (let i = 0; i < W.cuts[st]; i++) {
        const pa = rnd() * Math.PI * 2, pr = Math.sqrt(rnd()) * 13.5; px = Math.sin(pa) * pr; pz = Math.cos(pa) * pr;
        if (Math.hypot(px - bx, pz - bz) < 1) continue;
        const a = Math.atan2(px - bx, pz - bz), len = Math.max(6, edgeLen(bx, bz, a)), c = { x: bx, z: bz, dir: a, len, wave: st >= W.twoWaves && (i + 1) % 2 === 0 ? 2 : 1 };
        cuts.push(c); if (st >= W.mirror && i === 0) cuts.push({ x: -c.x, z: c.z, dir: -c.dir, len, wave: 2 });
        bx += Math.sin(a) * len; bz += Math.cos(a) * len;
      }
      const r = check(cuts, px, pz); if (r.share <= 0 || r.walk > REACH) fails++; worstShare = Math.min(worstShare, r.share); if (r.walk < Infinity) worstWalk = Math.max(worstWalk, r.walk);
    }
    bad += fails; console.log(`  step ${st}: worst safe share ${(worstShare * 100).toFixed(1)}%, worst walk to safety ${worstWalk.toFixed(1)} m, fails ${fails}`);
  }
  // live boards
  for (let k = 0; k < +runs; k++) {
    const boards = await page.evaluate(() => {
      const g = window.__game, G = g.G; G.headless = true; g.bot(3); g.god(true); g.start('duelist', { cls: 'stormcaller', phase: 3 });
      const b = G.boss, S = b.state, out = []; let seen = null;
      for (let i = 0; i < 200; i++) { const s = g.fastForward(2, true, () => { if (S.waking && S.waking !== seen) { seen = S.waking; out.push({ st: S.nitenStep, p: [G.player.pos.x, G.player.pos.z], cuts: S.waking.cuts.map((c) => ({ x: c.x, z: c.z, dir: c.dir, len: c.len, wave: c.wave })) }); } }); if (s.state !== 'fight') break; }
      g.god(false); return out;
    });
    let worstShare = 1, worstWalk = 0, fails = 0, maxN = 0;
    for (const B of boards) { if (!B.cuts.length) continue; maxN = Math.max(maxN, B.cuts.length); const r = check(B.cuts, B.p[0], B.p[1]); if (r.share <= 0 || r.walk > REACH) fails++; worstShare = Math.min(worstShare, r.share); if (r.walk < Infinity) worstWalk = Math.max(worstWalk, r.walk); }
    bad += fails; console.log(`live run ${k + 1}: ${boards.length} Waking Cuts (up to ${maxN} lines), worst safe share ${(worstShare * 100).toFixed(1)}%, worst walk ${worstWalk.toFixed(1)} m, fails ${fails}`);
  }
  await browser.close();
  console.log(bad ? 'FAIL: ' + bad + ' cycles without a reachable safe wedge' : 'OK: a reachable safe wedge in every cycle');
  process.exit(bad ? 1 : 0);
})();
