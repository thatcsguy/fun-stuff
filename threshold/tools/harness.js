const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
// ROOT = the repo root (parent of threshold/). THREE_DIR = an unpacked three@0.170.0 npm package (npm pack three@0.170.0 && tar xzf), used instead of the CDN.
const ROOT = process.env.TH_ROOT || path.resolve(__dirname, '../..'), THREE = process.env.THREE_DIR || path.resolve(__dirname, 'package');
const types = {'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png'};
async function launch(o = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: o.w || 1280, height: o.h || 720 }, deviceScaleFactor: 1 });
  await ctx.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
    const m = route.request().url().match(/three@[^/]+\/([^?#]*)/); const f = path.join(THREE, m[1]);
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) });
  });
  await ctx.route(/^http:\/\/game\.local\/(.*)$/, (route) => {
    let p = decodeURIComponent(new URL(route.request().url()).pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p); if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, contentType: types[path.extname(f)] || 'text/plain', body: fs.readFileSync(f) });
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|swiftshader|Automatic fallback/i.test(m.text()))) console.log('[console.' + m.type() + ']', m.text().slice(0, 400)); });
  page.on('pageerror', (e) => console.log('[pageerror]', (e.stack||e.message).split('\n').slice(0,4).join(' | ')));
  return { browser, page };
}
module.exports = { launch };
