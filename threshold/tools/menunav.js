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
  let s = await st(); ok(s.diff === 'normal' && !s.nm && s.na === 0 && s.nav === 19, `fresh: Normal, all 19 fights open (${JSON.stringify(s)})`);

  // ---- mouse
  await page.click('#set-diff span[data-v="nightmare"]'); await frames(); s = await st();
  ok(s.diff === 'nightmare' && s.nm && s.na === 17 && s.nav === 2, `mouse: Nightmare greys 17 fights, leaves Issen and Pentimento (${s.na}/${s.nav})`);
  const box = await page.locator('#doors .door[data-door="cathedral"]').boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await frames(10); s = await st();
  ok(s.state === 'menu', 'mouse: clicking greyed cathedral does nothing');
  await page.reload(); await menu(); s = await st(); ok(s.diff === 'nightmare' && s.nm && s.na === 17, 'reload: Nightmare is remembered');
  await page.click('#set-diff span[data-v="normal"]'); await frames(); s = await st(); ok(s.diff === 'normal' && s.na === 0, 'mouse: back to Normal');
  await page.click('#diffrow', { position: { x: 2, y: 2 } }); await frames(); s = await st(); ok(s.diff === 'nightmare', 'mouse: clicking the row edge flips it');

  // ---- keyboard: classes (4) -> difficulty toggle -> 4 group toggles -> the open fights (duelist, atelier) -> Settings -> Fullscreen
  await page.reload(); await menu();
  for (let i = 0; i < 5; i++) await key('ArrowDown'); s = await st(); ok(s.focus === 'diffrow', `keys: 5 x down reaches the toggle (${s.focus})`);
  await key('ArrowLeft'); s = await st(); ok(s.diff === 'normal' && s.focus === 'diffrow', `keys: left = Normal, focus stays (${s.diff}, ${s.focus})`);
  await key('ArrowRight'); s = await st(); ok(s.diff === 'nightmare' && s.focus === 'diffrow', 'keys: right = Nightmare');
  await key('Enter'); s = await st(); ok(s.diff === 'normal', 'keys: Enter flips to Normal');
  await key('Enter'); s = await st(); ok(s.diff === 'nightmare', 'keys: Enter flips back');
  await key('ArrowDown'); s = await st(); ok(s.focus === 'grp-nightmare', `keys: down from the toggle reaches the group toggles (${s.focus})`);
  for (let i = 0; i < 4; i++) await key('ArrowDown'); s = await st(); ok(s.focus === 'door:duelist', `keys: past the group toggles, greyed fights skipped, lands on duelist (${s.focus})`);
  await key('ArrowDown'); s = await st(); ok(s.focus === 'door:atelier', `keys: next is atelier, no greyed fight in between (${s.focus})`);
  await key('ArrowDown'); s = await st(); ok(s.focus === 'btn-settings', `keys: then Settings (${s.focus})`);

  // ---- simulated controller
  await page.reload(); await menu(); await page.evaluate(() => { window.__padOn = true; }); await frames(4);
  await pad(0); s = await st(); ok(s.focus === 'door:duelist', `pad: first press wakes the pad, focus starts on duelist (${s.focus})`);
  for (let i = 0; i < 5; i++) await pad(12); s = await st(); ok(s.focus === 'diffrow', `pad: d-pad up past the group toggles reaches the difficulty toggle (${s.focus})`);
  await pad(14); s = await st(); ok(s.diff === 'normal' && s.focus === 'diffrow', `pad: d-pad left = Normal, focus kept (${s.focus})`);
  for (let i = 0; i < 5; i++) await pad(13); s = await st(); ok(s.focus === 'door:duelist', `pad: on Normal, down past the group toggles goes to the first fight (${s.focus})`);
  for (let i = 0; i < 5; i++) await pad(12); await pad(0); s = await st(); ok(s.diff === 'nightmare' && s.focus === 'diffrow', 'pad: A on the toggle flips to Nightmare');
  await pad(15); s = await st(); ok(s.diff === 'nightmare', 'pad: right at the end stays Nightmare');
  for (let i = 0; i < 5; i++) await pad(13); await pad(0); await fight(); s = await st();
  ok(s.gnm === true && await page.evaluate(() => !!window.__game.G.boss.def.nm), 'pad: A on duelist starts the nightmare version');
  await page.evaluate(() => { window.__padOn = false; });
  await page.evaluate(() => window.__game.Game.restart()); await page.waitForFunction('window.__game.G.state === "loading"', null, { timeout: 20000 }).catch(() => {}); await fight();
  ok(await page.evaluate(() => window.__game.G.nightmare && window.__game.G.boss.def.nm && window.__game.G.boss.def.phases.some((p) => p.budget)), 'restart keeps Nightmare');
  await page.evaluate(() => window.__game.Game.quit()); await menu();
  await page.click('#set-diff span[data-v="normal"]'); await frames();
  await page.click('#doors .door[data-door="cathedral"]'); await fight(); s = await st();
  ok(s.gnm === false && await page.evaluate(() => !window.__game.G.boss.def.nm && window.__game.G.boss.def.id === 'cathedral'), 'Normal cathedral click starts Normal');
  await page.evaluate(() => window.__game.Game.quit()); await menu();
  // atelier on Nightmare starts its nightmare version; on Normal, the normal fight
  await page.click('#set-diff span[data-v="nightmare"]'); await frames(); await page.click('#doors .door[data-door="atelier"]'); await fight();
  ok(await page.evaluate(() => window.__game.G.nightmare && window.__game.G.boss.def.nm && window.__game.G.boss.def.id === 'atelier' && window.__game.G.boss.def.phases.length === 3 && window.__game.G.boss.def.phases[2].budget > 0), 'Nightmare atelier click starts the nightmare version');
  await page.evaluate(() => window.__game.Game.quit()); await menu(); await page.click('#set-diff span[data-v="normal"]'); await frames();
  await page.click('#doors .door[data-door="atelier"]'); await fight();
  ok(await page.evaluate(() => !window.__game.G.nightmare && !window.__game.G.boss.def.nm && window.__game.G.boss.def.id === 'atelier' && window.__game.G.boss.def.enrage === 450 && !window.__game.G.boss.def.phases.some((p) => p.budget)), 'Normal atelier click starts Normal');
  await page.evaluate(() => window.__game.Game.quit()); await menu();
  // a fight with a nightmare version clicked on Normal stays Normal
  await page.click('#doors .door[data-door="duelist"]'); await fight();
  ok(await page.evaluate(() => !window.__game.G.nightmare && !window.__game.G.boss.def.nm && window.__game.G.boss.def.enrage === 420), 'Normal duelist click starts Normal');
  await page.evaluate(() => window.__game.Game.quit()); await menu();
  // ---- group toggles: hide and show a group, remembered across a reload, no door numbers anywhere
  const grp = () => page.evaluate(() => ({ doors: [...document.querySelectorAll('#doors .door')].map((n) => n.dataset.door), on: [...document.querySelectorAll('#grouptog .gtog.on')].map((n) => n.id), text: document.querySelector('#doors').textContent }));
  let q = await grp(); ok(q.doors.join() === 'duelist,atelier,engine,cathedral,leviathan,gorgon,theatre,origami,lamp,chess,festival,fall,portal,titan,wheel,express,winter,clock,sumi' && q.on.length === 4, `groups: all four shown in table order (${q.doors.join()})`);
  ok(!/\b(XVI|XIX|XX|VIII|IV|IX)\b/.test(q.text) && !q.doors.includes('ballpark'), 'groups: no roman numerals, ballpark gone');
  await page.click('#grp-almost'); await frames(); q = await grp(); ok(q.doors.length === 9 && !q.doors.includes('cathedral') && !q.on.includes('grp-almost'), `groups: hiding Almost leaves 9 (${q.doors.length})`);
  await page.click('#grp-concept'); await frames(); q = await grp(); ok(q.doors.join() === 'duelist,atelier,engine', `groups: hiding Concept too leaves Nightmare + Ready (${q.doors.join()})`);
  await page.reload(); await menu(); q = await grp(); ok(q.doors.join() === 'duelist,atelier,engine', 'groups: hidden groups remembered after reload');
  await page.click('#grp-almost'); await page.click('#grp-concept'); await frames(); q = await grp(); ok(q.doors.length === 19, 'groups: shown again');
  await page.evaluate(() => window.__game.Game.start('engine')); await page.waitForFunction('document.querySelector("#title-card .nm").textContent.length > 0', null, { timeout: 60000 });
  ok(await page.evaluate(() => document.querySelector('#title-card .tnum').textContent === ''), 'title card: no door number');
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  await browser.close(); process.exit(fails.length ? 1 : 0);
})();
