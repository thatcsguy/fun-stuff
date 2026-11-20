// node nmshots.js <outDir> [cls] : screenshots of the nightmare flow through the real menu and the full intro (never skipintro):
// the door page on Normal and Nightmare, the title card, the fight with its fuse, the last 15 s, overtime, the death table,
// then a second run to the victory table. SHOTS=menu,intro,... limits it. Use TH_GPU=1 on a machine with a graphics card.
const { launch } = require('./harness.js');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2] || 'nmshots', cls = process.argv[3] || 'stormcaller'; fs.mkdirSync(out, { recursive: true });
  const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null, want = (k) => !only || only.includes(k);
  const { browser, page } = await launch({ w: 1600, h: 900 });
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = async (name) => { await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
  const until = (js, t = 120000) => page.waitForFunction(js, null, { timeout: t });
  await page.goto('http://game.local/threshold/?mute=1&quality=high&seed=5&class=' + cls);
  await until('window.__game && window.__game.G.state === "menu"');
  await page.evaluate(() => { localStorage.removeItem('th_settings'); window.__game.Settings.diff = 'normal'; });
  await page.evaluate(() => window.__game.Game.toMenu()); await wait(1500);
  if (want('menu')) await shot('01-menu-normal');
  await page.click('#set-diff span[data-v="nightmare"]'); await wait(1200);
  if (want('menu')) await shot('02-menu-nightmare');
  await page.click('#doors .door.nav');
  await until('window.__game.G.state === "intro"'); await wait(2600);
  if (want('intro')) await shot('03-intro-card');
  await wait(2200); if (want('intro')) await shot('04-intro-late');
  await until('window.__game.G.state === "fight"'); await page.evaluate(() => { window.__game.god(true); window.__game.bot(3); });
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
