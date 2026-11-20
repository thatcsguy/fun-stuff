// node menunav.js : checks the Difficulty toggle on the door page with the mouse, the keyboard and a simulated controller.
// The value changes and survives a reload, greyed doors cannot be focused or clicked, focus lands on the nightmare door,
// a nightmare door starts the nightmare version, Restart keeps it, and a Normal door click still starts Normal.
const { launch } = require('./harness.js');
const fails = []; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails.push(msg); };
(async () => {
  const { browser, page } = await launch({ w: 1600, h: 900 });
  await page.addInitScript(() => {
    const btn = () => ({ pressed: false, value: 0, touched: false });
    window.__pad = { id: 'Simulated Xbox Controller (STANDARD GAMEPAD Vendor: 045e Product: 02ea)', index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, btn), axes: [0, 0, 0, 0], timestamp: 0 };
    window.__padOn = false; const real = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
    navigator.getGamepads = () => window.__padOn ? [window.__pad] : real();
  });
  const url = 'http://game.local/threshold/?mute=1&quality=low&seed=3';
  const menu = () => page.waitForFunction('window.__game && window.__game.G.state === "menu" && !document.querySelector("#menu").classList.contains("hidden")', null, { timeout: 90000 });
  const frames = (n = 3) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const st = () => page.evaluate(() => { const f = document.querySelector('#menu .nav.focus'); return { diff: window.__game.Settings.diff, nm: document.querySelector('#menu').classList.contains('nm'), na: document.querySelectorAll('#doors .door.na').length, nav: document.querySelectorAll('#doors .door.nav').length, focus: f ? (f.id || (f.dataset.door ? 'door:' + f.dataset.door : f.dataset.cls ? 'cls:' + f.dataset.cls : f.className)) : null, state: window.__game.G.state, gnm: window.__game.G.nightmare }; });
  const key = async (k) => { await page.keyboard.press(k); await frames(2); };
  const pad = async (i) => { await page.evaluate((i) => { window.__pad.buttons[i].pressed = true; window.__pad.buttons[i].value = 1; window.__pad.timestamp++; }, i); await frames(4); await page.evaluate((i) => { window.__pad.buttons[i].pressed = false; window.__pad.buttons[i].value = 0; window.__pad.timestamp++; }, i); await frames(4); };
  const fight = () => page.waitForFunction('window.__game.G.state === "fight" || window.__game.G.state === "intro"', null, { timeout: 120000 });

  await page.goto(url); await menu(); await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await menu();
  let s = await st(); ok(s.diff === 'normal' && !s.nm && s.na === 0 && s.nav === 20, `fresh: Normal, all 20 doors open (${JSON.stringify(s)})`);

  // ---- mouse
  await page.click('#set-diff span[data-v="nightmare"]'); await frames(); s = await st();
  ok(s.diff === 'nightmare' && s.nm && s.na === 18 && s.nav === 2, `mouse: Nightmare greys 18 doors, leaves III and XIX (${s.na}/${s.nav})`);
  const box = await page.locator('#doors .door').nth(0).boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await frames(10); s = await st();
  ok(s.state === 'menu', 'mouse: clicking greyed door I does nothing');
  await page.reload(); await menu(); s = await st(); ok(s.diff === 'nightmare' && s.nm && s.na === 18, 'reload: Nightmare is remembered');
  await page.click('#set-diff span[data-v="normal"]'); await frames(); s = await st(); ok(s.diff === 'normal' && s.na === 0, 'mouse: back to Normal');
  await page.click('#diffrow', { position: { x: 2, y: 2 } }); await frames(); s = await st(); ok(s.diff === 'nightmare', 'mouse: clicking the row edge flips it');

  // ---- keyboard: classes (4) -> toggle -> the open doors (III, XIX) -> Settings -> Fullscreen
  await page.reload(); await menu();
  for (let i = 0; i < 5; i++) await key('ArrowDown'); s = await st(); ok(s.focus === 'diffrow', `keys: 5 x down reaches the toggle (${s.focus})`);
  await key('ArrowLeft'); s = await st(); ok(s.diff === 'normal' && s.focus === 'diffrow', `keys: left = Normal, focus stays (${s.diff}, ${s.focus})`);
  await key('ArrowRight'); s = await st(); ok(s.diff === 'nightmare' && s.focus === 'diffrow', 'keys: right = Nightmare');
  await key('Enter'); s = await st(); ok(s.diff === 'normal', 'keys: Enter flips to Normal');
  await key('Enter'); s = await st(); ok(s.diff === 'nightmare', 'keys: Enter flips back');
  await key('ArrowDown'); s = await st(); ok(s.focus === 'door:duelist', `keys: down from the toggle skips greyed doors I-II, lands on III (${s.focus})`);
  await key('ArrowDown'); s = await st(); ok(s.focus === 'door:atelier', `keys: next is door XIX, no greyed door in between (${s.focus})`);
  await key('ArrowDown'); s = await st(); ok(s.focus === 'btn-settings', `keys: then Settings (${s.focus})`);

  // ---- simulated controller
  await page.reload(); await menu(); await page.evaluate(() => { window.__padOn = true; }); await frames(4);
  await pad(0); s = await st(); ok(s.focus === 'door:duelist', `pad: first press wakes the pad, focus starts on door III (${s.focus})`);
  await pad(12); s = await st(); ok(s.focus === 'diffrow', `pad: d-pad up reaches the toggle (${s.focus})`);
  await pad(14); s = await st(); ok(s.diff === 'normal' && s.focus === 'diffrow', `pad: d-pad left = Normal, focus kept (${s.focus})`);
  await pad(13); s = await st(); ok(s.focus === 'door:cathedral', `pad: on Normal, down goes to door I (${s.focus})`);
  await pad(12); await pad(0); s = await st(); ok(s.diff === 'nightmare' && s.focus === 'diffrow', 'pad: A on the toggle flips to Nightmare');
  await pad(15); s = await st(); ok(s.diff === 'nightmare', 'pad: right at the end stays Nightmare');
  await pad(13); await pad(0); await fight(); s = await st();
  ok(s.gnm === true && await page.evaluate(() => !!window.__game.G.boss.def.nm), 'pad: A on door III starts the nightmare version');
  await page.evaluate(() => { window.__padOn = false; });
  await page.evaluate(() => window.__game.Game.restart()); await page.waitForFunction('window.__game.G.state === "loading"', null, { timeout: 20000 }).catch(() => {}); await fight();
  ok(await page.evaluate(() => window.__game.G.nightmare && window.__game.G.boss.def.nm && window.__game.G.boss.def.phases.some((p) => p.budget)), 'restart keeps Nightmare');
  await page.evaluate(() => window.__game.Game.quit()); await menu();
  await page.click('#set-diff span[data-v="normal"]'); await frames();
  await page.click('#doors .door >> nth=0'); await fight(); s = await st();
  ok(s.gnm === false && await page.evaluate(() => !window.__game.G.boss.def.nm && window.__game.G.boss.def.id === 'cathedral'), 'Normal door I click starts Normal');
  await page.evaluate(() => window.__game.Game.quit()); await menu();
  // door XIX on Nightmare starts its nightmare version; on Normal, the normal fight
  await page.click('#set-diff span[data-v="nightmare"]'); await frames(); await page.click('#doors .door >> nth=18'); await fight();
  ok(await page.evaluate(() => window.__game.G.nightmare && window.__game.G.boss.def.nm && window.__game.G.boss.def.id === 'atelier' && window.__game.G.boss.def.phases.length === 3 && window.__game.G.boss.def.phases[2].budget > 0), 'Nightmare door XIX click starts the nightmare version');
  await page.evaluate(() => window.__game.Game.quit()); await menu(); await page.click('#set-diff span[data-v="normal"]'); await frames();
  await page.click('#doors .door >> nth=18'); await fight();
  ok(await page.evaluate(() => !window.__game.G.nightmare && !window.__game.G.boss.def.nm && window.__game.G.boss.def.id === 'atelier' && window.__game.G.boss.def.enrage === 450 && !window.__game.G.boss.def.phases.some((p) => p.budget)), 'Normal door XIX click starts Normal');
  await page.evaluate(() => window.__game.Game.quit()); await menu();
  // a door with a nightmare version clicked on Normal stays Normal
  await page.click('#doors .door >> nth=2'); await fight();
  ok(await page.evaluate(() => !window.__game.G.nightmare && !window.__game.G.boss.def.nm && window.__game.G.boss.def.enrage === 420), 'Normal door III click starts Normal');
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  await browser.close(); process.exit(fails.length ? 1 : 0);
})();
