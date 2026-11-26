// node nmshots.js <outDir> [cls] : screenshots of a Nightmare fight through the real menu and the full intro (never skipintro):
// the door page on Normal and Nightmare, the title card, then the last phase with one shot per ramp step (the step is forced
// through the boss file's test hook), the enrage pulse, the last blow and the death table, then a second run to the kill and the
// victory table. BOSS=atelier for Pentimento, BOSS=engine for Parallax (plus the Totality transition) (default Issen). SHOTS=menu,intro limits the menu/intro shots. Use TH_GPU=1 on a
// machine with a graphics card.
const { launch } = require('./harness.js');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2] || 'nmshots', cls = process.argv[3] || 'stormcaller'; fs.mkdirSync(out, { recursive: true });
  const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null, want = (k) => !only || only.includes(k);
  const { browser, page } = await launch({ w: 1600, h: 900 });
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = async (name) => { await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
  const until = (js, t = 120000) => page.waitForFunction(js, null, { timeout: t });
  const g = (js, a) => page.evaluate(js, a), B = 'window.__game.G.boss';
  const toPhase = async (i) => { await g((i) => { const b = window.__game.G.boss; b.hp = b.maxHp * b.def.phases[i].at - 5; }, i); await until(`${B}.phase === ${i}`, 20000); };
  // keeps him above k of his health (0 = off), so the steps can be watched
  const floor = (k) => g((k) => { clearInterval(window.__fl); if (k) window.__fl = setInterval(() => { const b = window.__game.G.boss; if (b && b.alive) b.hp = Math.max(b.hp, b.maxHp * k); }, 100); }, k);
  const ramp = async () => {
    const boss = process.env.BOSS || 'duelist', duel = boss === 'duelist', eng = boss === 'engine', n = duel || eng ? 6 : 5, last = duel ? 3 : 2;
    await wait(3000); await toPhase(last); if (eng) { await wait(4200); await shot('09-totality'); } await until(`!${B}.transitioning`, 40000); await floor(0.3);
    for (let st = 0; st < n; st++) {
      await g(([st, duel, eng]) => { const b = window.__game.G.boss, S = b.state, T = b.def.nmTest; if (eng) T.setStep(b, st); else if (duel) S.nitenT = Math.max(S.nitenT, st * T.RAMP); else S.fk = Math.max(S.fk, st * T.SIT_PER_STEP); }, [st, duel, eng]);
      await until(eng ? `${B}.state.step >= ${st}` : duel ? `${B}.state.nitenStep >= ${st}` : `${B}.state.finStep >= ${st}`, 90000).catch(() => console.log('(step ' + st + ' not reached)'));
      await wait(duel ? 4500 : 6000); await shot(`${String(10 + st)}-step-${st}`);
    }
    await g(() => { const G = window.__game.G; G.ft = Math.max(G.ft, G.boss.def.enrage - 0.5); }); await wait(2200); await shot('20-enrage-pulse');
    await g(() => { const G = window.__game.G, d = G.boss.def; G.ft = Math.max(G.ft, d.enrage + (d.lastBlowAt || 24) - 0.2); }); await until(`${B}.lastBlowing`, 10000); await wait(1500); await shot('21-last-blow'); await wait(3600); await shot('22-last-blow-late');
    await until('!document.querySelector("#death").classList.contains("hidden")', 30000); await wait(500); await shot('23-death-table'); await floor(0);
    await page.click('#death [data-act=restart]'); await until('window.__game.G.state === "fight"'); await g(() => { window.__game.god(true); window.__game.bot(3); });
    await wait(1500); await toPhase(last); await until(`!${B}.transitioning`, 40000); await wait(5000);
    await g(() => { const b = window.__game.G.boss, S = b.state; (S.lead ? S.lead.ent : b).damage(1e9, { src: 'player' }); }); await wait(800); await shot('24-kill'); await wait(2500); await shot('25-kill-late');
    await until('!document.querySelector("#victory").classList.contains("hidden")', 30000); await wait(500); await shot('26-victory-table');
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
  await ramp();
  console.log(JSON.stringify(await g(() => ({ save: JSON.parse(localStorage.getItem('th_save') || '{}').nm, log: window.__game.G.boss.phaseLog }))));
  await browser.close();
})();
