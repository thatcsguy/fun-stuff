// node nmshots.js <outDir> [cls] : screenshots of the nightmare flow through the real menu and the full intro (never skipintro):
// the door page on Normal and Nightmare, the title card, the fight with its fuse, the last 15 s, overtime, the death table,
// then a second run to the victory table. SHOTS=menu,intro,... limits it. Use TH_GPU=1 on a machine with a graphics card.
// BOSS=atelier: door XIX instead of door III (clicks door XIX on the door page), and MODE=late runs its own late flow (see atelierLate).
const { launch } = require('./harness.js');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2] || 'nmshots', cls = process.argv[3] || 'stormcaller'; fs.mkdirSync(out, { recursive: true });
  const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null, want = (k) => !only || only.includes(k);
  const { browser, page } = await launch({ w: 1600, h: 900 });
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = async (name) => { await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
  const until = (js, t = 120000) => page.waitForFunction(js, null, { timeout: t });
  // MODE=late: the same real entry (menu, full intro), then the later phases of a door with phase clocks: the next phases' enters,
  // the twin phase (both bodies, a swap, an opening), its overtime, and the kill. Shots are timed in real seconds.
  const late = async () => {
    const g = (js, a) => page.evaluate(js, a), boss = () => g(() => { const b = window.__game.G.boss; return { ph: b.phase, tr: b.transitioning }; });
    const toPhase = async (i) => { await g((i) => { const b = window.__game.G.boss; b.hp = b.maxHp * b.def.phases[i].at - 5; }, i); await until(`window.__game.G.boss.phase === ${i}`, 20000); };
    await wait(3000); await toPhase(1); await until('!window.__game.G.boss.transitioning', 30000); await wait(3000); await shot('20-nightfall');
    await toPhase(2); await wait(1300); await shot('21-lake-enter'); await wait(1500); await shot('22-lake-seam');
    await until('!window.__game.G.boss.transitioning', 30000); await g(() => { window.__game.G.boss.hp = window.__game.G.boss.maxHp * 0.42; });
    for (let i = 0; i < 40; i++) { if (await g(() => window.__game.G.boss.state.ghosts.some((q) => q.cut && q.cut.blue))) break; await wait(500); } await wait(400); await shot('23-lake-blue-ghosts');
    await toPhase(3); await wait(900); await shot('24-niten-image'); await wait(1500); await shot('25-niten-image-stands'); await wait(1500); await shot('26-niten-rises'); await wait(1000); await shot('27-niten-draws');
    await wait(1400); await shot('28-niten-marks');
    await until('!window.__game.G.boss.transitioning', 30000); await g(() => { window.__game.G.boss.hp = window.__game.G.boss.maxHp * 0.2; }); await wait(2500); await shot('29-niten-fight');
    await until('window.__game.G.boss.state.lead && window.__game.G.boss.state.lead.warn > 0.3', 60000); await shot('30-niten-swap-tell');
    await until('window.__game.G.boss.state.lead.open > 0 || (window.__game.G.boss.state.lead !== window.__game.G.boss.state.A)', 30000); await wait(500); await shot('31-niten-after-swap');
    await until('!!window.__game.G.boss.state.moonHint', 90000); await wait(500); await shot('32-niten-paired-moons');
    await g(() => { const b = window.__game.G.boss; b.phaseT = b.def.phases[b.phase].budget - 0.1; }); await wait(1200); await shot('33-niten-overtime'); await wait(3500); await shot('34-niten-overtime-tele');
    await until('!document.querySelector("#death").classList.contains("hidden")', 30000); await wait(500); await shot('35-niten-death-table');
    // the kill: restart, jump to phase IV, wait for the twins, cut him down
    await page.click('#death [data-act=restart]'); await until('window.__game.G.state === "fight"'); await g(() => { window.__game.god(true); window.__game.bot(3); });
    await wait(1500); await toPhase(3); await until('window.__game.G.boss.state.niten && !window.__game.G.boss.transitioning', 30000); await wait(3000);
    await g(() => { const b = window.__game.G.boss, S = b.state; (S.lead ? S.lead.ent : b).damage(1e9, { src: 'player' }); }); await wait(700); await shot('36-kill-reflection'); await wait(1500); await shot('37-kill-fall'); await wait(2200); await shot('38-kill-kneel');
    await until('!document.querySelector("#victory").classList.contains("hidden")', 30000); await wait(500); await shot('39-victory-table');
  };
  // door XIX (atelier), after the real entry: the fight in colour, the Negative, the knife cut and the tear, the split canvas with each
  // kind of call (white, black, bare in both tones) and close shots of the swirl, a Fresh Coat mid-rise, a matched Critique in the black
  // half, the signature, out of time (the varnish), the death table; then a second run to the kill (the painting) and the victory table.
  const atelierLate = async () => {
    const g = (js, a) => page.evaluate(js, a), S = 'window.__game.G.boss.state';
    const toPhase = async (i) => { await g((i) => { const b = window.__game.G.boss; b.hp = b.maxHp * b.def.phases[i].at - 5; }, i); await until(`window.__game.G.boss.phase === ${i}`, 20000); };
    const floor = (k) => g((k) => { clearInterval(window.__fl); if (k) window.__fl = setInterval(() => { const b = window.__game.G.boss; if (b && b.alive) { b.hp = Math.max(b.hp, b.maxHp * k); if (!b.overtime) b.phaseT = Math.min(b.phaseT, 30); } }, 100); }, k); // also holds the phase clock
    const close = async (name) => { await g(() => { const G = window.__game.G, b = G.boss, V = b.pos.constructor, a = window.__game.Cam.yaw || 0; window.__game.Cam.cine = { pos: new V(b.pos.x - Math.sin(a) * 7, 4.3, b.pos.z - Math.cos(a) * 7), look: new V(b.pos.x, 3.1, b.pos.z), fov: 42 }; }); await wait(700); await shot(name); await g(() => { window.__game.Cam.cine = null; }); };
    const want = (tone, col) => g(([tone, col]) => { const S = window.__game.G.boss.state; S.cbag = [{ tone, col }]; S.tones = []; }, [tone, col]);
    await wait(5000); await shot('20-colour');
    await toPhase(1); await wait(1800); await shot('21-negative-cast'); await until('!window.__game.G.boss.transitioning', 30000); await wait(4000); await shot('22-negative');
    await toPhase(2); await floor(0.2); await until(`${S}.seamOn && ${S}.seamP > 0.4`, 30000); await shot('23-knife-cut'); await until(`${S}.split`, 10000); await wait(450); await shot('24-tear');
    await until(`${S}.call && ${S}.top > 7`, 30000); await wait(1200); await shot('25-call-white'); await close('26-close-white');
    await until(`${S}.call && ${S}.call.tone === 'b' && ${S}.call.col && ${S}.top > 7`, 60000); await wait(1200); await shot('27-call-black'); await close('28-close-black');
    await until(`${S}.call && ${S}.call.col === 0 && ${S}.top > 7`, 60000); const t0 = await g(() => window.__game.G.boss.state.call.tone); await g(() => { window.__wantBare = setInterval(() => { const S = window.__game.G.boss && window.__game.G.boss.state; if (S && S.cbag) { S.cbag = S.cbag.filter((q) => q.col === 0); S.tones = []; } }, 200); }); await want(t0 === 'w' ? 'b' : 'w', 0); await wait(1000); await shot('29-bare-' + t0);
    await until(`${S}.call && ${S}.call.col !== 0 && ${S}.top > 1.2 && ${S}.top < 5`, 60000); await shot('30-fresh-coat-rise');
    if (await until(`${S}.call && ${S}.call.col === 0 && ${S}.call.tone !== '${t0}' && ${S}.top > 7`, 90000).then(() => true, () => { console.log('(no second bare call: he does not call what you already answer)'); return false; })) { await wait(1000); await shot('31-bare-' + (t0 === 'w' ? 'b' : 'w')); }
    await g(() => clearInterval(window.__wantBare)); await want('b', 1); await until(`${S}.call && ${S}.call.tone === 'b' && ${S}.down > 4.6 && window.__game.G.player.pos.x * Math.cos(${S}.lineA) - window.__game.G.player.pos.z * Math.sin(${S}.lineA) < 0`, 120000).catch(() => console.log('(no matched black-half Critique seen)')); await shot('32-matched-black-half');
    await floor(0); await g(() => { const b = window.__game.G.boss; b.hp = b.maxHp * 0.095; }); await floor(0.07);
    await until(`${S}.sig >= 1`, 90000); await wait(600); await shot('33-signature-1'); await until(`${S}.sig >= 2`, 30000); await wait(900); await shot('34-signature-2'); await until(`${S}.sig >= 3`, 30000); await wait(900); await shot('35-signature-3');
    await floor(0); await g(() => { const b = window.__game.G.boss; b.hp = b.maxHp * 0.09; b.phaseT = b.def.phases[b.phase].budget - 0.1; }); await wait(1500); await shot('36-overtime'); await wait(3000); await shot('37-varnish-closing');
    await until('!document.querySelector("#death").classList.contains("hidden")', 30000); await wait(500); await shot('38-death-table');
    await page.click('#death [data-act=restart]'); await until('window.__game.G.state === "fight"'); await g(() => { window.__game.god(true); window.__game.bot(3); });
    await wait(1500); await toPhase(2); await until(`${S}.split && !window.__game.G.boss.transitioning && ${S}.call`, 40000); await wait(4000);
    await g(() => window.__game.kill()); await wait(600); await shot('39-kill-heal'); await wait(2500); await shot('40-kill-rise'); await wait(1800); await shot('41-kill-painting');
    await until('!document.querySelector("#victory").classList.contains("hidden")', 30000); await wait(500); await shot('42-victory-table');
  };
  await page.goto('http://game.local/threshold/?mute=1&quality=high&seed=5&class=' + cls);
  await until('window.__game && window.__game.G.state === "menu"');
  await page.evaluate(() => { localStorage.removeItem('th_settings'); window.__game.Settings.diff = 'normal'; });
  await page.evaluate(() => window.__game.Game.toMenu()); await wait(1500);
  if (want('menu')) await shot('01-menu-normal');
  await page.click('#set-diff span[data-v="nightmare"]'); await wait(1200);
  if (want('menu')) await shot('02-menu-nightmare');
  await page.click(process.env.BOSS ? `#doors .door[data-door="${process.env.BOSS}"]` : '#doors .door.nav');
  await until('window.__game.G.state === "intro"'); await wait(2600);
  if (want('intro')) await shot('03-intro-card');
  await wait(2200); if (want('intro')) await shot('04-intro-late');
  await until('window.__game.G.state === "fight"'); await page.evaluate(() => { window.__game.god(true); window.__game.bot(3); });
  if (process.env.MODE === 'late') { await (process.env.BOSS === 'atelier' ? atelierLate() : late()); await browser.close(); return; }
  await wait(9000); await shot('05-fight-fuse');
  const g = (js) => page.evaluate(js);
  await g(() => { const b = window.__game.G.boss; b.phaseT = b.def.phases[b.phase].budget - 13; }); await wait(4500); await shot('06-last-15s');
  await until('window.__game.G.boss.overtime', 30000); await wait(900); await shot('07-overtime-sheathe');
  await wait(2600); await shot('08-overtime-telegraph');
  await until('window.__game.G.state === "dead"', 30000); await wait(300); await shot('09-overtime-cut');
  await until('!document.querySelector("#death").classList.contains("hidden")', 30000); await wait(600); await shot('10-death-table');
  // second run: clear phase I quickly, then win in phase II
  await page.click('#death [data-act=restart]'); await until('window.__game.G.state === "fight"'); await g(() => { window.__game.god(true); window.__game.bot(3); });
  await wait(4000); await g(() => { const b = window.__game.G.boss; b.hp = b.maxHp * b.def.phases[1].at + 50; }); await wait(2500);
  await until('window.__game.G.boss.phase === 1 && !window.__game.G.boss.transitioning', 60000); await wait(5000); await shot('11-phase2-fuse');
  await g(() => window.__game.kill()); await until('!document.querySelector("#victory").classList.contains("hidden")', 30000); await wait(600); await shot('12-victory-table');
  console.log(JSON.stringify(await g(() => ({ save: JSON.parse(localStorage.getItem('th_save') || '{}').nm, log: window.__game.G.boss.phaseLog }))));
  await browser.close();
})();
