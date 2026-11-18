// node montage.js <out.png> <cols> <crop: x,y,w,h | full> img... : tiles screenshots (optionally cropped) into one contact sheet.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const [out, cols, crop, ...imgs] = process.argv.slice(2); const [cx, cy, cw, ch] = crop === 'full' ? [0, 0, 1280, 720] : crop.split(',').map(Number);
  const tw = Math.round(1600 / +cols), th = Math.round(tw * ch / cw);
  const cells = imgs.map((f) => `<div style="position:relative;width:${tw}px;height:${th}px;overflow:hidden;display:inline-block"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="position:absolute;left:${-cx * tw / cw}px;top:${-cy * th / ch}px;width:${1280 * tw / cw}px"><span style="position:absolute;left:4px;top:2px;color:#ff0;font:13px sans-serif;text-shadow:0 0 3px #000">${path.basename(f, '.png')}</span></div>`).join('');
  const b = await chromium.launch({ channel: process.env.TH_GPU ? 'chrome' : undefined }); const p = await b.newPage({ viewport: { width: tw * +cols, height: th * Math.ceil(imgs.length / +cols) } });
  await p.setContent(`<body style="margin:0;background:#000;line-height:0">${cells}</body>`); await p.screenshot({ path: out }); await b.close();
})();
