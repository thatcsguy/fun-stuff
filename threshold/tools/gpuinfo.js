// node gpuinfo.js : prints the WebGL renderer the harness browser actually gets (check TH_GPU=1 hits the real card, not SwiftShader)
const { launch } = require('./harness.js');
(async () => {
  const { browser, page } = await launch({ w: 320, h: 200 });
  await page.goto('http://game.local/threshold/?mute=1');
  const r = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) return { webgl: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { webgl: true, vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  });
  console.log(JSON.stringify({ browser: browser.version(), ...r }));
  await browser.close();
})();
