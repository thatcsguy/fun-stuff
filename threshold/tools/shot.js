// node shot.js <query> <out.png> [evalJS] [frames]
const { launch } = require('./harness.js');
(async () => {
  const [q, out, js, frames] = process.argv.slice(2);
  const { browser, page } = await launch({ w: 1120, h: 630 });
  await page.goto('http://game.local/threshold/?mute=1&' + (q || ''));
  await page.waitForFunction('window.__game && (window.__game.G.state === "fight" || window.__game.G.state === "menu")', null, { timeout: 90000 });
  await page.evaluate('document.getElementById("fade").style.transition="none"');
  if (js) { const r = await page.evaluate(js); if (r !== undefined) console.log(JSON.stringify(r)); }
  await page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), +(frames || 3));
  await page.screenshot({ path: out, timeout: 300000 });
  console.log(JSON.stringify(await page.evaluate('window.__game.state()')));
  await browser.close();
})();
