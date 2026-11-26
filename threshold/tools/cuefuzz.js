// node cuefuzz.js [cues per step] [brackets per step] : the Impresario Nightmare's fairness rules (plan: impresario-nightmare-plan.md).
// 1. Cues: generated Cues per ramp step (his mark and your gate spot random, the step's time and decoys; step 5 = the Curtain call).
//    A 0.25 m grid search with the boss file's own cueOk must find exactly two passing discs (q and its point mirror), the nearer
//    reachable from your spot in the Cue's time at walking speed (7 m/s, 0.9 s to react), neither real light overlapping his pool,
//    and you not already standing in one. "far" = how often the other answer is also reachable.
// 2. Paper Birds: every open-lane pattern is symmetric front to back (lane g open means lane 8 - g is open).
// 3. Brackets: whole finale brackets held at each step (god-mode level-3 autopilot), outside Cues. Every 0.1 s some point on the
//    stage must be clear of every pending telegraph, lingering zone and bird for all three bodies at once; and whenever a new
//    telegraph appears on one of your bodies, such a point must be reachable from where you stand before it lands (7 m/s after
//    0.25 s to react). Reports failures (should be 0).
// Defaults 2000 Cues and 500 brackets per step (the plan's numbers; a full run takes a while). SEED sets the page seed.
const { launch } = require('./harness.js');
(async () => {
  const [nCue = '2000', nBr = '500'] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1&quality=low&nm=1&seed=' + (process.env.SEED || 7));
  await page.waitForFunction('window.__game && window.__game.G.state === "menu"', null, { timeout: 90000 });
  let fails = 0;
  // ---- 1. Cues
  const cues = await page.evaluate((N) => {
    const g = window.__game, G = g.G; G.headless = true; g.start('theatre', { cls: 'stormcaller' }); const T = g.G.boss.def.nmTest, out = [];
    const rnd = (a, b) => a + Math.random() * (b - a);
    for (let st = 0; st < 6; st++) {
      const time = st === 5 ? T.CUE.curtain : T.CUE.time[st], dec = st === 5 ? T.CUE.curtainDecoys : T.CUE.decoys[st];
      const r = { step: st, n: 0, two: 0, near: 0, far: 0, pool: 0, standing: 0, genBad: 0, comps: {} };
      for (let k = 0; k < N; k++) {
        const M = T.MARKS[Math.floor(Math.random() * 4)], B = { x: M[0] + rnd(-1, 1), z: M[1] + rnd(-1, 1) }, rose = Math.random() < 0.5;
        const sx = rose ? -B.x : B.x, sz = rose ? B.z : -B.z, a = Math.random() * Math.PI * 2, rr = Math.random() * 4, P = { x: Math.max(-14, Math.min(14, sx + Math.sin(a) * rr)), z: Math.max(-8, Math.min(8, sz + Math.cos(a) * rr)) };
        const c = T.genCue(B, P, dec, time); r.n++; if (c.bad > 0) r.genBad++;
        // grid search and connected components of the passing cells
        const H = 0.25, nx = Math.round(29 / H) + 1, nz = Math.round(17 / H) + 1, pass = new Uint8Array(nx * nz);
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = -14.5 + i * H, z = -8.5 + j * H; if (T.cueOk({}, x, z, c.lights)) pass[i * nz + j] = 1; }
        const lab = new Int32Array(nx * nz); let comp = 0; const best = [];
        for (let s = 0; s < pass.length; s++) { if (!pass[s] || lab[s]) continue; comp++; let dmin = Infinity; const st2 = [s]; lab[s] = comp;
          while (st2.length) { const u = st2.pop(), i = Math.floor(u / nz), j = u % nz, x = -14.5 + i * H, z = -8.5 + j * H; dmin = Math.min(dmin, Math.hypot(x - P.x, z - P.z));
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a2 = i + di, b2 = j + dj; if (a2 < 0 || b2 < 0 || a2 >= nx || b2 >= nz) continue; const v = a2 * nz + b2; if (pass[v] && !lab[v]) { lab[v] = comp; st2.push(v); } } }
          best.push(dmin); }
        r.comps[comp] = (r.comps[comp] || 0) + 1;
        if (comp === 2) r.two++;
        best.sort((a2, b2) => a2 - b2); const reach = 7 * (time - 0.9);
        if (best.length && best[0] <= reach) r.near++; if (best.length > 1 && best[1] <= 7 * time) r.far++;
        if (best.length && best[0] === 0) r.standing++;
        for (const L of c.lights.slice(0, 2)) if (Math.hypot(L.x - B.x, L.z - B.z) <= T.CUE.r + T.GATE.r) { r.pool++; break; }
      }
      out.push(r);
    }
    return out;
  }, +nCue);
  for (const r of cues) {
    const bad = (r.n - r.two) + (r.n - r.near) + r.pool + r.standing; fails += bad;
    console.log(`cues step ${r.step}: ${r.n} generated, exactly two passing discs ${r.two}, nearer reachable ${r.near}, other also reachable ${r.far}, real light on his pool ${r.pool}, already standing in one ${r.standing}, generator fallbacks ${r.genBad}  components ${JSON.stringify(r.comps)}  ${bad ? 'FAIL ' + bad : 'ok'}`);
  }
  // ---- 2. birds
  const birds = await page.evaluate(() => { const T = window.__game.G.boss.def.nmTest; let bad = 0; for (let gg = 0; gg <= 3; gg++) { const o = T.birdOpen(gg); for (const i of o) if (!o.includes(8 - i)) bad++; } return bad; });
  fails += birds; console.log('bird lanes: ' + (birds ? 'FAIL ' + birds + ' asymmetric' : 'all symmetric front to back'));
  // ---- 3. brackets
  for (let st = 0; st < 6; st++) {
    const r = await page.evaluate(([st, N]) => {
      const g = window.__game, G = g.G; G.headless = true; g.bot(3); g.god(true); g.start('theatre', { cls: 'stormcaller', phase: 2 });
      const b = G.boss, p = G.player, S = b.state, T = b.def.nmTest, Hz = g.Hz, Bul = g.Bul;
      let samples = 0, bad = 0, acc = 0, news = 0, badNew = 0; const where = {}, seen = new Set();
      const bodies = (x, z) => [[x, z], [-x, z], [x, -z]];
      const live = () => Hz.list.filter((h) => h.state !== 'done' && h.state !== 'fired' && h.dmg);
      const hit = (x, z) => { for (const h of live()) if (Hz.inShape(h.shape, x, z) !== !!h.invert) return true; return Bul.threat(x, z, 0.5, 0.5); };
      const tFire = (x, z) => { let t = Infinity; for (const h of live()) if (Hz.inShape(h.shape, x, z) !== !!h.invert) t = Math.min(t, h.state === 'zone' ? 0 : h.delay - h.t); return t; };
      // is some point clear for all three bodies, within `reach` m of the player?
      const clear = (reach) => { for (let x = -14; x <= 14; x += 0.5) for (let z = -8; z <= 8; z += 0.5) { if (!G.arena.contains(x, z)) continue; if (Math.hypot(x - p.pos.x, z - p.pos.z) > reach) continue; if (bodies(x, z).every(([u, v]) => !hit(u, v))) return true; } return false; };
      const note = (key) => { where[key] = (where[key] || 0) + 1; };
      const onStep = (dt) => {
        if (S.finale) T.setStep(b, st); b.hp = Math.max(b.hp, b.maxHp * 0.12); // held at the step, never the Curtain call's 10% shortcut
        if (!S.finale || b.transitioning || S.black || G.state !== 'fight') return;
        const L = live(); if (!L.length) return;
        const names = () => L.filter((h) => h.state === 'tele').map((h) => h.name).join('+');
        // (b) each new telegraph: from where you stand when it appears, a point clear of everything pending is reachable before the
        // first hit on any of your bodies (7 m/s after 0.25 s to react)
        const fresh = L.filter((h) => !seen.has(h)); if (fresh.length) { for (const h of fresh) seen.add(h); let esc = Infinity; for (const h of fresh) if (bodies(p.pos.x, p.pos.z).some(([x, z]) => Hz.inShape(h.shape, x, z) !== !!h.invert)) esc = Math.min(esc, h.state === 'zone' ? 0 : h.delay - h.t); if (esc < Infinity) { news++; if (!clear(Math.max(0, esc - 0.25) * 7)) { badNew++; note('new: ' + names()); } } }
        // (a) every 0.1 s: some point on the stage is clear for all three bodies at once
        if ((acc += dt) < 0.1) return; acc = 0; samples++; if (!clear(99)) { bad++; note('none: ' + names()); }
      };
      let s; for (let i = 0; i < 4000 && (S.bk || 0) < N + 1; i++) { s = g.fastForward(2, true, onStep); if (s.state !== 'fight') break; }
      g.god(false); return { st, brackets: (S.bk || 1) - 1, samples, bad: bad + badNew, none: bad, news, badNew, where, end: s.state, err: s.errors };
    }, [st, +nBr]);
    fails += r.bad; console.log(`brackets step ${st}: ${r.brackets} brackets, ${r.samples} samples with a hit pending: no clear point anywhere ${r.none}; ${r.news} new telegraphs: no clear point reachable in time ${r.badNew}` + (r.bad ? ' ' + JSON.stringify(r.where) : '') + (r.err && r.err.length ? ' ERR ' + JSON.stringify(r.err).slice(0, 200) : ''));
  }
  console.log(fails ? `FAILURES: ${fails}` : 'cuefuzz: zero failures');
  await browser.close();
})();
