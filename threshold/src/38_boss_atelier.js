// DOOR XIX: PENTIMENTO, the Unfinished Canvas. A blank canvas to the horizon, and the floor keeps every drop of paint.
// You wear what you walk through, and what you are wearing decides what you can hurt.
(() => {
  const R = 20, GN = 80, CELL = 0.5, N = 1024, U = N / (2 * R), WET = 20, RED = 1, YEL = 2, BLU = 4;
  const HEX = [0xffffff, 0xe23a2e, 0xf2c218, 0xf08a1e, 0x2a5fe0, 0x8a3cd0, 0x2aa858, 0x5c4332];
  const CSS = HEX.map((h) => '#' + h.toString(16).padStart(6, '0'));
  const mixC = (h, t, k) => '#' + [16, 8, 0].map((s) => { const a = (h >> s) & 255, b = (t >> s) & 255; return Math.round(a + (b - a) * k).toString(16).padStart(2, '0'); }).join('');
  const LT = HEX.map((h) => mixC(h, 0xffffff, 0.35)), DK = HEX.map((h) => mixC(h, 0, 0.42)), LT2 = HEX.map((h) => mixC(h, 0xffffff, 0.16)), DK2 = HEX.map((h) => mixC(h, 0, 0.2));
  // the smock, sleeves, brush tip and drip are recoloured after lighting to exactly the loaded hue: light and glow change only brightness
  const HUE = '{ vec3 lw = vec3(0.2126, 0.7152, 0.0722); float l = dot(outgoingLight, lw), lh = max(dot(uHue, lw), 1e-3); outgoingLight = uHue * clamp(l / lh, 0.3, uHueMax); }\n#include <opaque_fragment>';
  function hueLock(m, S, key) { const pv = m.onBeforeCompile; m.onBeforeCompile = (sh, rr) => { if (pv) pv(sh, rr); sh.uniforms.uHue = S.hueU; sh.uniforms.uHueMax = S.hueMax; sh.fragmentShader = 'uniform vec3 uHue; uniform float uHueMax;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', HUE); }; m.customProgramCacheKey = () => 'atelierHue' + key; return m; }
  const INK = 0x16161e, _c = new THREE.Color(), _a = new V3(), _b = new V3();
  const px = (v) => (v + R) * U, bitsOf = (m) => [RED, YEL, BLU].filter((q) => m & q);
  const need = (S) => S.neg ? 7 ^ S.col : S.col; // in the negative the rule inverts with the world
  const tel = (S) => S.neg ? 0xf4f4ff : INK;
  const CLIP = R - 0.25; // paint stops just inside the drawn edge of the tondo

  // ---- the floor: a grid of wet pigment for the rules, a canvas of strokes for the eye ----
  function cells(S, sh, fn) {
    let x0, x1, z0, z1;
    if (sh.t === 'c') { x0 = sh.x - sh.r; x1 = sh.x + sh.r; z0 = sh.z - sh.r; z1 = sh.z + sh.r; }
    else { const ex = sh.x + Math.sin(sh.dir) * sh.len, ez = sh.z + Math.cos(sh.dir) * sh.len, h = sh.w / 2; x0 = Math.min(sh.x, ex) - h; x1 = Math.max(sh.x, ex) + h; z0 = Math.min(sh.z, ez) - h; z1 = Math.max(sh.z, ez) + h; }
    const i0 = clamp(Math.floor((x0 + R) / CELL), 0, GN - 1), i1 = clamp(Math.floor((x1 + R) / CELL), 0, GN - 1), j0 = clamp(Math.floor((z0 + R) / CELL), 0, GN - 1), j1 = clamp(Math.floor((z1 + R) / CELL), 0, GN - 1), fx = Math.sin(sh.dir || 0), fz = Math.cos(sh.dir || 0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = (i + 0.5) * CELL - R, z = (j + 0.5) * CELL - R, dx = x - sh.x, dz = z - sh.z; if (x * x + z * z > R * R) continue;
      if (sh.t === 'c') { if (dx * dx + dz * dz > sh.r * sh.r) continue; } else { const al = dx * fx + dz * fz, sd = dx * fz - dz * fx; if (al < 0 || al > sh.len || Math.abs(sd) > sh.w / 2) continue; }
      fn(j * GN + i);
    }
  }
  function lay(S, sh) { // sh.m = pigment, or 0 to scrape the floor clean
    sh.t0 = G.ft; sh.dry = false; sh.seed = (S.seed = (S.seed + 7919) % 100003);
    cells(S, sh, (k) => { S.pig[k] = sh.m; S.dryAt[k] = sh.m ? G.ft + WET : 0; });
    S.strokes.push(sh); if (G.headless) { S.fresh.length = 0; S.full = true; } else S.fresh.push(sh); if (S.strokes.length > 110) { S.baked.push(S.strokes.shift()); if (S.baked.length > 400) S.baked.shift(); S.full = true; }
  }
  const wetAt = (S, x, z) => { const i = Math.floor((x + R) / CELL), j = Math.floor((z + R) / CELL); if (i < 0 || j < 0 || i >= GN || j >= GN) return 0; const k = j * GN + i; return S.dryAt[k] > G.ft ? S.pig[k] : 0; };
  // x: colour canvas, s: surface canvas (red = height for the bump, green = roughness). Hue, extent, opacity and marks are
  // the rules made visible; everything added here is tonal (lighter/darker of the same hue) or lives in the surface canvas.
  function stamp(S, x, s, sh) {
    const r = mulberry(sh.seed), neg = S.neg, wet = !sh.dry, c = sh.t === 'c';
    let t0 = 0, t1 = sh.len || 0;
    if (!c) { const fx = Math.sin(sh.dir), fz = Math.cos(sh.dir), tc = -(sh.x * fx + sh.z * fz), RR = R + sh.w / 2 + 0.6, D = RR * RR - (sh.x * sh.x + sh.z * sh.z - tc * tc); if (D <= 0) return; const q = Math.sqrt(D); t0 = Math.max(0, tc - q); t1 = Math.min(sh.len, tc + q); if (t1 <= t0) return; }
    for (const k of [x, s]) { k.save(); k.translate(px(sh.x), px(sh.z)); k.rotate(-(sh.dir || 0)); k.scale(U, U); }
    const blob = (k, pts) => { const n = pts.length, md = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = md(pts[n - 1], pts[0]); k.beginPath(); k.moveTo(m0[0], m0[1]); for (let i = 0; i < n; i++) { const p = pts[i], m = md(p, pts[(i + 1) % n]); k.quadraticCurveTo(p[0], p[1], m[0], m[1]); } k.closePath(); };
    if (!sh.m) { // palette knife: scraped back to clean canvas, smooth, with a ridge of pushed paint along each side
      x.globalAlpha = 0.93; x.fillStyle = neg ? '#0a0a10' : '#d9d2c2'; s.globalAlpha = 0.93; s.fillStyle = 'rgb(112,175,0)';
      if (c) { for (const k of [x, s]) { k.beginPath(); k.arc(0, 0, sh.r, 0, TAU); k.fill(); } }
      else { x.fillRect(-sh.w / 2, t0, sh.w, t1 - t0); s.fillRect(-sh.w / 2, t0, sh.w, t1 - t0); x.globalAlpha = 0.06; x.fillStyle = neg ? '#ffffff' : '#6a6052'; for (let i = 0; i < 6; i++) { const o = (r() - 0.5) * sh.w * 0.9; x.fillRect(o - 0.03, t0, 0.06, t1 - t0); }
        s.globalAlpha = 0.8; s.fillStyle = 'rgb(205,140,0)'; s.fillRect(-sh.w / 2, t0, 0.1, t1 - t0); s.fillRect(sh.w / 2 - 0.1, t0, 0.1, t1 - t0); }
      x.restore(); s.restore(); return;
    }
    const A = wet ? 0.94 : neg ? 0.2 : 0.3, col = CSS[sh.m], lt = LT[sh.m], dk = DK[sh.m], gB = wet ? 138 : 210;
    x.globalAlpha = A; x.fillStyle = col; s.globalAlpha = wet ? 0.95 : 0.6; s.fillStyle = `rgb(${wet ? 172 : 150},${gB},0)`;
    if (c) {
      const pts = []; for (let i = 0; i < 22; i++) { const a = i / 22 * TAU, rr = sh.r * (0.9 + r() * 0.14); pts.push([Math.sin(a) * rr, Math.cos(a) * rr]); }
      blob(x, pts); x.fill(); blob(s, pts); s.fill();
      for (let i = 0; i < 11; i++) { const a = r() * TAU, d = sh.r * (1.0 + r() * 0.42), rad = (0.08 + r() * 0.2) * (i < 5 ? 1 : 0.6), cx = Math.sin(a) * d, cy = Math.cos(a) * d; for (const k of [x, s]) { k.beginPath(); k.arc(cx, cy, rad, 0, TAU); k.fill(); } }
      for (let i = 0; i < 4; i++) { const a = r() * TAU, d = sh.r * (0.98 + r() * 0.12), cx = Math.sin(a) * d, cy = Math.cos(a) * d, rad = 0.1 + r() * 0.1; for (const k of [x, s]) { k.beginPath(); k.ellipse(cx, cy, rad * 2.4, rad, PI / 2 - a, 0, TAU); k.fill(); } }
      if (wet) { x.globalAlpha = 0.5; x.strokeStyle = dk; x.lineWidth = 0.22; blob(x, pts); x.stroke(); s.globalAlpha = 0.9; s.strokeStyle = 'rgb(236,112,0)'; s.lineWidth = 0.17; blob(s, pts); s.stroke();
        if (sh.m !== RED) { const gd = x.createRadialGradient(-sh.r * 0.15, -sh.r * 0.15, 0, 0, 0, sh.r * 0.8); gd.addColorStop(0, lt); gd.addColorStop(1, col); x.globalAlpha = 0.45; x.fillStyle = gd; x.beginPath(); x.arc(0, 0, sh.r * 0.8, 0, TAU); x.fill(); x.globalAlpha = 0.6; x.fillStyle = lt; x.beginPath(); x.ellipse(-sh.r * 0.35, -sh.r * 0.3, sh.r * 0.12, sh.r * 0.06, 0.7, 0, TAU); x.fill(); } s.strokeStyle = 'rgb(205,85,0)'; s.lineWidth = 0.24; s.beginPath(); s.arc(-sh.r * 0.1, -sh.r * 0.1, sh.r * 0.62, 3.5, 4.7); s.stroke();
        s.globalAlpha = 0.45; s.strokeStyle = 'rgb(200,130,0)'; s.lineWidth = 0.1; s.beginPath(); s.arc(0, 0, sh.r * 0.45, 0, TAU); s.stroke(); }
    } else {
      const L = t1 - t0, hw = sh.w / 2, nW = Math.max(2, Math.ceil(L / 0.7)), wl = [], wr = [], wa = 0.09 + sh.w * 0.012; for (let i = 0; i <= nW; i++) { wl.push((r() - 0.5) * wa); wr.push((r() - 0.5) * wa); }
      const body = (k) => { k.beginPath(); for (let i = 0; i <= nW; i++) k.lineTo(-hw + wl[i], t0 + L * i / nW); for (let i = nW; i >= 0; i--) k.lineTo(hw + wr[i], t0 + L * i / nW); k.closePath(); }; body(x); x.fill(); body(s); s.fill();
      const brk = (k, xo, w, al, mn, mx) => { for (let a = t0 + r() * 1.5; a < t1;) { const ln = mn + r() * mx; k.globalAlpha = al * (0.4 + r() * 0.6); k.fillRect(xo, a, w, Math.min(ln, t1 - a)); a += ln + 0.3 + r() * 1.6; } };
      const ns = Math.min(18, 5 + Math.round(sh.w * 3)); // bristle streaks: fine, broken, a shade lighter or darker of the same hue, fading in and out
      for (let i = 0; i < ns; i++) { const o = (r() - 0.5) * sh.w * 0.94, ww = 0.025 + r() * 0.05, lit = r() < 0.5; x.fillStyle = lit && !neg && sh.m !== RED ? LT2[sh.m] : DK2[sh.m]; brk(x, o - ww / 2, ww, A * 0.22, 0.6, 2.6); }
      for (let i = 0; i < 8; i++) { const o = (r() - 0.5) * sh.w * 0.9, ww = 0.05 + r() * 0.06; s.fillStyle = `rgb(${r() < 0.5 ? 182 : 150},${gB},0)`; brk(s, o - ww / 2, ww, 0.45, 1, 3); }
      x.globalAlpha = A * 0.85; x.fillStyle = col; for (let i = 0; i < Math.min(40, Math.round(L * 0.9)); i++) { const sd = r() < 0.5 ? -1 : 1, a = t0 + r() * L, ln = 0.3 + r() * 0.9, wd = 0.03 + r() * 0.05; x.beginPath(); x.moveTo(sd * (hw - 0.02), a); x.lineTo(sd * (hw + wd), a + ln * 0.15); x.lineTo(sd * (hw - 0.02), a + ln); x.closePath(); x.fill(); } // short bristle wisps touching the edge
      for (const [e, dn] of [[0, -1], [sh.len, 1]]) { if (e < t0 - 0.01 || e > t1 + 0.01 || sh.w >= 10) continue; // dry-brush tails where the brush lifted
        for (let i = 0; i < 16; i++) { const o = (r() - 0.5) * sh.w, ln = 0.15 + r() * 0.5, ww = 0.04 + r() * 0.08, y0 = dn < 0 ? e - ln : e; x.globalAlpha = A * (0.45 + r() * 0.4); x.fillRect(o - ww / 2, y0, ww, ln); s.globalAlpha = 0.5; s.fillRect(o - ww / 2, y0, ww, ln); } }
      if (wet) { x.fillStyle = DK2[sh.m]; brk(x, -hw, 0.035, 0.55, 1, 3); brk(x, hw - 0.035, 0.035, 0.55, 1, 3); if (!neg && sh.m !== RED) { const sd = Math.sin(sh.dir) > 0 ? 1 : -1, gw = clamp(sh.w * 0.1, 0.2, 0.7); x.fillStyle = LT2[sh.m]; brk(x, sd * (hw - 0.14) - 0.04, 0.08, 0.75, 1.5, 4); brk(x, -sd * (hw - 0.1) - 0.025, 0.05, 0.3, 1.5, 4); x.fillStyle = LT[sh.m]; brk(x, sd * hw * 0.42 - gw / 2, gw, 0.28, 2, 6); }
        s.globalAlpha = 0.9; s.fillStyle = 'rgb(240,100,0)'; s.fillRect(-sh.w / 2 + 0.04, t0, 0.15, L); s.fillRect(sh.w / 2 - 0.19, t0, 0.15, L); }
    }
    if (wet) { // each pigment has its own mark as well as its own colour: red is hatched, yellow dotted, blue ringed
      x.globalAlpha = 0.3; x.strokeStyle = x.fillStyle = neg ? '#ffffff' : '#000000'; x.lineWidth = 0.09; const L = sh.t === 'c' ? sh.r * 1.4 : sh.len, W2 = sh.t === 'c' ? sh.r * 0.7 : sh.w / 2 - 0.3, y0 = sh.t === 'c' ? -sh.r * 0.7 : 0.4;
      for (let y = y0; y < y0 + L - 0.4; y += 1.5) { if (sh.t !== 'c' && Math.hypot(sh.x + Math.sin(sh.dir) * y, sh.z + Math.cos(sh.dir) * y) > R) continue;
        if (sh.m === RED) { x.beginPath(); x.moveTo(-W2, y); x.lineTo(W2, y + 0.9); x.stroke(); } else if (sh.m === YEL) { for (const o of [-0.6, 0, 0.6]) { x.beginPath(); x.arc(o * W2, y, 0.16, 0, TAU); x.fill(); } } else { x.beginPath(); x.arc(0, y, Math.min(0.5, W2 * 0.6), 0, TAU); x.stroke(); } }
    }
    x.restore(); s.restore();
  }
  // bare canvas (weave, mottling, a falloff toward the edge, the charcoal edge line) into the bitmaps that old dry paint bakes into
  function baseInto(S) {
    const x = S.bctx, s = S.bsctx, neg = S.neg, r = mulberry(77); x.globalAlpha = 1; x.fillStyle = neg ? '#07070c' : '#d9d2c2'; x.fillRect(0, 0, N, N);
    if (!neg) {
      for (let i = 0; i < 46; i++) { const cx = r() * N, cy = r() * N, rad = 40 + r() * 170, g = x.createRadialGradient(cx, cy, 0, cx, cy, rad), dk = r() < 0.55; g.addColorStop(0, dk ? 'rgba(120,98,66,0.06)' : 'rgba(255,252,244,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - rad, cy - rad, 2 * rad, 2 * rad); }
      x.lineWidth = 1; for (let i = 0; i < N; i += 3) { x.strokeStyle = 'rgba(120,110,95,' + (0.03 + r() * 0.05).toFixed(3) + ')'; x.beginPath(); x.moveTo(i + r() * 0.8, 0); x.lineTo(i + r() * 0.8, N); x.stroke(); x.strokeStyle = 'rgba(120,110,95,' + (0.03 + r() * 0.05).toFixed(3) + ')'; x.beginPath(); x.moveTo(0, i + r() * 0.8); x.lineTo(N, i + r() * 0.8); x.stroke(); }
      const g = x.createRadialGradient(N / 2, N / 2, R * U * 0.5, N / 2, N / 2, R * U); g.addColorStop(0, 'rgba(96,74,48,0)'); g.addColorStop(1, 'rgba(96,74,48,0.2)'); x.fillStyle = g; x.fillRect(0, 0, N, N);
    } else { const g = x.createRadialGradient(N / 2, N / 2, R * U * 0.6, N / 2, N / 2, R * U); g.addColorStop(0, 'rgba(40,44,80,0)'); g.addColorStop(1, 'rgba(40,44,80,0.22)'); x.fillStyle = g; x.fillRect(0, 0, N, N); }
    x.globalAlpha = neg ? 0.6 : 0.72; x.strokeStyle = neg ? '#c8c8dc' : '#34302c'; x.lineWidth = 0.09 * U; x.beginPath(); x.arc(N / 2, N / 2, (R - 0.12) * U, 0, TAU); x.stroke(); x.globalAlpha = 1;
    s.globalAlpha = 1; s.fillStyle = 'rgb(128,235,0)'; s.fillRect(0, 0, N, N); s.strokeStyle = 'rgba(92,242,0,0.75)'; s.lineWidth = 1.5; s.beginPath(); for (let i = 0; i < N; i += 4) { s.moveTo(i, 0); s.lineTo(i, N); s.moveTo(0, i); s.lineTo(N, i); } s.stroke();
  }
  const clipC = (k) => { k.save(); k.beginPath(); k.arc(N / 2, N / 2, CLIP * U, 0, TAU); k.clip(); };
  function paint(S) {
    const x = S.ctx, s = S.sctx;
    if (S.reset) { S.reset = false; baseInto(S); for (const sh of S.baked) sh.inBmp = false; S.full = true; }
    if (S.full) {
      S.full = false; clipC(S.bctx); clipC(S.bsctx); for (const sh of S.baked) if (!sh.inBmp && (sh.dry || !sh.m)) { stamp(S, S.bctx, S.bsctx, sh); sh.inBmp = true; } S.bctx.restore(); S.bsctx.restore();
      x.globalAlpha = 1; s.globalAlpha = 1; x.drawImage(S.bmp, 0, 0); s.drawImage(S.sbmp, 0, 0);
      clipC(x); clipC(s); for (const sh of S.baked) if (!sh.inBmp) stamp(S, x, s, sh); for (const sh of S.strokes) stamp(S, x, s, sh); x.restore(); s.restore();
    } else { clipC(x); clipC(s); for (const sh of S.fresh) stamp(S, x, s, sh); x.restore(); s.restore(); }
    S.fresh.length = 0; S.tex.needsUpdate = true; S.stex.needsUpdate = true;
  }

  // ---- materials and props ----
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
  const ctex = (c, srgb = true, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
  const woodFn = (u, v) => { const w = W.fbm(u * 4, v * 4, 21, 4, 4), gr = 0.5 + 0.5 * Math.sin(TAU * (u * 10 + w * 1.6)), f = W.fbm(u * 16, v * 16, 23, 3, 16), g3 = gr * gr * gr; return [g3 * 0.5 + f * 0.25, 0.3 + g3 * 0.35 + f * 0.35, 0.34 + f * 0.26]; };
  function weaveTex() { const c = cv(64), x = c.getContext('2d'); x.fillStyle = '#ddd5c4'; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(110,98,80,0.22)'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i < 64; i += 4) { x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, 64); x.moveTo(0, i + 0.5); x.lineTo(64, i + 0.5); } x.stroke(); return c; }
  function smockTex() {
    const c = cv(256), x = c.getContext('2d'), r = mulberry(88); x.fillStyle = '#ececec'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 14; i++) { const fx = (i + r() * 0.5) / 14 * 256, g = x.createLinearGradient(fx - 9, 0, fx + 9, 0), y0 = 70 + r() * 60; g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.24)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(fx - 9, y0, 18, 256 - y0); }
    x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(0, 0, 256, 16);
    for (let i = 0; i < 10; i++) { const dx = r() * 256, y0 = 30 + r() * 90, L = 30 + r() * 100, w = 2 + r() * 3; x.fillStyle = 'rgba(0,0,0,0.32)'; x.fillRect(dx, y0, w, L); x.beginPath(); x.arc(dx + w / 2, y0 + L, w * 0.9, 0, TAU); x.fill(); }
    for (let i = 0; i < 7; i++) { x.save(); x.translate(r() * 256, 50 + r() * 160); x.rotate(-0.6 + r() * 1.2); x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.22)'; x.fillRect(-20, -3, 40 + r() * 30, 5 + r() * 4); x.restore(); }
    const g = x.createLinearGradient(0, 196, 0, 256); g.addColorStop(0, 'rgba(40,30,20,0)'); g.addColorStop(1, 'rgba(40,30,20,0.36)'); x.fillStyle = g; x.fillRect(0, 196, 256, 60);
    return ctex(c, true, [1, 1]);
  }
  function napTex() {
    const c = cv(256, 128), x = c.getContext('2d'), r = mulberry(61); x.fillStyle = '#ececec'; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 2600; i++) { const v = 170 + Math.floor(r() * 85); x.strokeStyle = `rgba(${v},${v},${v},0.55)`; x.lineWidth = 1 + r(); const sx = r() * 256, sy = r() * 128; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (r() - 0.5) * 3, sy + 2 + r() * 5); x.stroke(); }
    for (let i = 0; i < 10; i++) { x.fillStyle = r() < 0.5 ? 'rgba(90,90,90,0.18)' : 'rgba(255,255,255,0.3)'; x.fillRect(0, r() * 128, 256, 2 + r() * 8); }
    return ctex(c, true, [3, 6]);
  }
  function tuftGeo(seed, vc) {
    const r = mulberry(seed), P = [[0.13, 0], [0.19, 0.12], [0.25, 0.36], [0.245, 0.6], [0.18, 0.86], [0.09, 1.04], [0.02, 1.15]].map((q) => new THREE.Vector2(q[0], q[1])), SEG = 22, n = P.length;
    const g = new THREE.LatheGeometry(P, SEG), pos = g.attributes.position, cols = [], jit = Array.from({ length: SEG }, () => [r() - 0.5, r() - 0.5]);
    for (let i = 0; i <= SEG; i++) for (let j = 0; j < n; j++) { const k = i * n + j, x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), t = y / 1.15, a = i / SEG * TAU, jj = jit[i % SEG], cl = 1 + 0.09 * Math.sin(a * 9 + 1) + 0.05 * Math.sin(a * 17), tp = smooth((t - 0.62) / 0.38), sp = 1 + jj[0] * 0.5 * tp;
      pos.setXYZ(k, x * cl * sp + jj[1] * 0.08 * tp, y + jj[0] * 0.14 * tp, z * cl * sp + jj[0] * 0.08 * tp); const cc = 0.4 + 0.6 * smooth((t - 0.08) / 0.5); cols.push(cc, cc, cc); }
    if (vc) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); g.rotateX(PI / 2); return g;
  }
  const vsUV = 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }';
  const NOISE = 'float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); } float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); } float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*n2(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }';
  const PREMUL = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };
  // soft contact shadow
  const shadowMat = () => new THREE.ShaderMaterial(Object.assign({ uniforms: { uA: { value: 0 } }, vertexShader: vsUV,
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float d=length(vUv-0.5)*2.0; float a=uA*pow(clamp(1.0-d,0.0,1.0),1.4); gl_FragColor=vec4(0.0,0.0,0.0,a); }' }, PREMUL));
  // hanging canvases: blank with a charcoal under-drawing, then painted in (phase 2), then the negative (phase 3)
  function panelMat(S, ca, cb, na, nb, seed) {
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCa: { value: new THREE.Color(ca) }, uCb: { value: new THREE.Color(cb) }, uNa: { value: new THREE.Color(na) }, uNb: { value: new THREE.Color(nb) }, uSeed: { value: seed } }]);
    u.uK1 = S.pK1; u.uK2 = S.pK2; u.uT = S.pT;
    return new THREE.ShaderMaterial({ uniforms: u, fog: true, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv=uv; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: `uniform float uK1,uK2,uT,uSeed; uniform vec3 uCa,uCb,uNa,uNb; varying vec2 vUv;
        #include <fog_pars_fragment>
        ${NOISE}
        float ln(float d, float w){ return 1.0-smoothstep(w*0.4, w+fwidth(d)*1.5, d); }
        void main(){
          vec2 uv=vUv; float bx=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y)); float gr=fbm(uv*vec2(40.0,30.0)+uSeed);
          vec3 base=vec3(0.80,0.76,0.68)*(0.93+0.07*gr);
          float y1=0.38+0.1*sin(uv.x*5.0+uSeed*3.0)+0.05*sin(uv.x*13.0+uSeed); float y2=0.58+0.2*abs(sin(uv.x*3.1+uSeed*1.7));
          float c3=length((uv-vec2(0.68+0.12*sin(uSeed),0.76))*vec2(1.0,0.8));
          float l=max(max(ln(abs(uv.y-y1),0.006),ln(abs(uv.y-y2),0.005)*0.8),ln(abs(c3-0.08),0.005)*0.7)*(0.55+0.45*n2(uv*vec2(60.0,8.0)));
          float hd=abs(fract((uv.x+uv.y)*38.0+uSeed)-0.5); float ht=(1.0-smoothstep(0.08,0.08+fwidth(uv.x+uv.y)*57.0,hd))*step(uv.y,y2)*step(y1,uv.y)*(0.5+0.5*n2(uv*vec2(9.0,5.0)+uSeed)); l=max(l,ht*0.5);
          vec3 col=mix(base,vec3(0.16,0.15,0.15),l*0.85);
          float nb=fbm(uv*vec2(3.0,9.0)+uSeed*2.0); float st=0.86+0.14*sin(uv.y*140.0+nb*12.0)*(0.6+0.4*n2(uv*vec2(4.0,90.0)));
          float gm=smoothstep(0.1,0.95,uv.y+(nb-0.5)*0.4); vec3 pc=mix(uCa,uCb,gm)*st;
          float front=uK1*1.35-0.2; float rev=smoothstep(front+0.04,front-0.04,uv.x+(n2(uv*vec2(2.0,40.0)+uSeed)-0.5)*0.16)*smoothstep(0.02,0.045,bx);
          col=mix(col,pc,rev*0.97);
          vec3 nc=mix(vec3(0.02,0.02,0.035)+vec3(0.45,0.45,0.55)*l*0.6,mix(uNa,uNb,gm)*(0.88+0.12*sin(uv.y*22.0+nb*9.0+uv.x*3.0))*(0.92+0.08*n2(uv*vec2(3.0,7.0)+uSeed)),rev);
          col=mix(col,nc,uK2);
          col*=1.0-(1.0-smoothstep(0.0,0.02,bx))*0.45; col*=mix(0.8,1.04,uv.y);
          gl_FragColor=vec4(max(col,vec3(0.0)),1.0);
          #include <fog_fragment>
        }` });
  }

  // fresnel rim added to a standard material's emissive (cool rim on the wood; in the negative a thin cyan line on every prop)
  function rimify(m, U2, key) { m.onBeforeCompile = (sh) => { sh.uniforms.uRimC = U2; sh.fragmentShader = 'uniform vec3 uRimC;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRimC * pow(max(fr, 0.0), 3.0); }'); }; m.customProgramCacheKey = () => 'atelierRim' + key; return m; }
  // the studio around the canvas: floorboards and a drop cloth, plaster walls with north-light windows, giant props
  function studio(S, g) {
    const r = mulberry(4242), mats = S.stM = [], sm = (o, warm) => { const m = rimify(W.mat(o), S.propRim, 'p'); mats.push([m, m.color.clone(), warm === undefined ? null : new THREE.Color(warm)]); return m; }, sf = (o, warm) => { const m = W.mat(o); mats.push([m, m.color.clone(), warm === undefined ? null : new THREE.Color(warm)]); return m; }, add = (geo, m, x, y, z, p) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); (p || g).add(o); return o; };
    const WR = 82, WH = 80, at = (a, d) => [Math.sin(a) * d, Math.cos(a) * d];
    const fb = W.bake(256, (u, v) => { const P = 5, p = Math.floor(u * P), fu = u * P - p, off = W.hash2(p, 0, 7), sv = (v + off) % 1, gap = smooth(sat(Math.min(fu, 1 - fu) * P * 0.6)), jn = smooth(sat(Math.min(sv, 1 - sv) * 160)), gg = W.fbm(u * 6 + p * 3.1, v * 50, 13, 3, 0), t = W.hash2(p, 3, 9);
      return [gap * 0.22 + gg * 0.1, (0.6 + gg * 0.2 + t * 0.14) * (0.87 + 0.13 * gap) * (0.96 + 0.04 * jn), 0.45 + gg * 0.15]; }, { dark: 0xa89474, light: 0xece2ce, strength: 1.2 });
    for (const t of [fb.map, fb.normalMap, fb.roughnessMap]) t.repeat.set(6, 1);
    const floor = add(new THREE.CircleGeometry(WR, 64), sf({ map: fb.map, normalMap: fb.normalMap, roughnessMap: fb.roughnessMap, roughness: 0.6, envMapIntensity: 0.6 }, 0xfff0e2), 0, -0.6, 0); floor.rotation.x = -PI / 2; floor.receiveShadow = true;
    // drop cloth: unbleached linen, folds radiating from the tondo, a hem, small dull drips of the primaries well outside the play area
    const cc = cv(512), x = cc.getContext('2d'), CR = 34, tr = 256 * R / CR; x.fillStyle = '#f2ebdc'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 46; i++) { const a = r() * TAU, w = 0.04 + r() * 0.08, r0 = tr * (1.02 + r() * 0.2), dk = r() < 0.6; x.save(); x.translate(256, 256); x.rotate(a); const gg = x.createLinearGradient(0, -w * 140, 0, w * 140); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(0.5, dk ? 'rgba(90,76,56,0.08)' : 'rgba(255,252,244,0.06)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.beginPath(); x.moveTo(r0, -w * 20); x.lineTo(256, -w * 140); x.lineTo(256, w * 140); x.lineTo(r0, w * 20); x.fill(); x.restore(); }
    x.strokeStyle = 'rgba(120,108,88,0.06)'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i < 512; i += 3) { x.moveTo(i, 0); x.lineTo(i, 512); x.moveTo(0, i); x.lineTo(512, i); } x.stroke();
    for (let i = 0; i < 70; i++) { const a = r() * TAU, d = tr * 1.15 + r() * (240 - tr * 1.15), col = ['#b8645a', '#c8aa5a', '#6a80b0'][i % 3]; x.globalAlpha = 0.28 + r() * 0.2; x.fillStyle = col; x.beginPath(); x.arc(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, 1 + r() * (i < 12 ? 5 : 2.5), 0, TAU); x.fill(); }
    for (let i = 0; i < 6; i++) { const a = r() * TAU, d = tr * 1.25 + r() * 50, col = ['#b8645a', '#c8aa5a', '#6a80b0'][i % 3]; x.globalAlpha = 0.22; x.fillStyle = col; for (let k = 0; k < 4; k++) { const dd = d + k * 14, sx = 256 + Math.cos(a) * dd + (k % 2 ? 4 : -4), sy = 256 + Math.sin(a) * dd; x.beginPath(); x.ellipse(sx, sy, 3, 5.5, a + PI / 2, 0, TAU); x.fill(); } }
    x.globalAlpha = 1; const ao = x.createRadialGradient(256, 256, tr * 0.97, 256, 256, tr * 1.18); ao.addColorStop(0, 'rgba(40,30,18,0.42)'); ao.addColorStop(1, 'rgba(40,30,18,0)'); x.fillStyle = ao; x.fillRect(0, 0, 512, 512);
    x.strokeStyle = 'rgba(120,106,84,0.22)'; x.lineWidth = 3; x.beginPath(); x.arc(256, 256, 250, 0, TAU); x.stroke(); x.strokeStyle = 'rgba(80,68,50,0.4)'; x.lineWidth = 1; x.setLineDash([3, 3]); x.beginPath(); x.arc(256, 256, 244, 0, TAU); x.stroke(); x.setLineDash([]);
    const clg = new THREE.CircleGeometry(CR, 96), cp = clg.attributes.position; for (let i = 1; i < cp.count; i++) { const a = Math.atan2(cp.getY(i), cp.getX(i)), k = 0.9 + 0.08 * Math.sin(a * 5 + 1) * Math.sin(a * 3) + 0.03 * Math.sin(a * 11); cp.setXY(i, cp.getX(i) * k, cp.getY(i) * k); }
    const cloth = add(clg, sf({ map: ctex(cc), roughness: 1, envMapIntensity: 0.2, emissive: 0x24201a, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, 0xfff0e0), 0, -0.56, 0); cloth.rotation.x = -PI / 2; cloth.receiveShadow = true;
    // the tondo: canvas tacked over a round stretcher, with a rolled edge
    const wv = weaveTex(), canM = sf({ color: 0xffffff, map: ctex(wv, true, [160, 1]), roughness: 0.95 }, 0xfff0e0), lipM = sf({ color: 0xffffff, map: ctex(wv, true, [220, 1]), roughness: 0.85 }, 0xfff0e0);
    const lip = add(new THREE.TorusGeometry(R, 0.08, 10, 240), lipM, 0, -0.04, 0); lip.rotation.x = PI / 2;
    add(new THREE.CylinderGeometry(R + 0.08, R + 0.08, 0.56, 200, 1, true), canM, 0, -0.32, 0);
    const tk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8), sm({ color: 0x4a4a50, roughness: 0.5, metalness: 0.6 }), 96), dm = new THREE.Object3D();
    for (let i = 0; i < 96; i++) { const a = i / 96 * TAU; dm.position.set(Math.sin(a) * (R + 0.09), -0.3, Math.cos(a) * (R + 0.09)); dm.rotation.set(PI / 2, a, 0, 'YXZ'); dm.updateMatrix(); tk.setMatrixAt(i, dm.matrix); } g.add(tk);
    // pale plaster walls (chalk outlines of their panels in the negative), wainscot, ceiling and beams
    const pl = W.bake(256, (u, v) => { const n = W.fbm(u * 8, v * 8, 9, 5, 8), m = W.fbm(u * 32, v * 32, 11, 3, 32); return [n * 0.6 + m * 0.4, 0.62 + n * 0.3 + m * 0.08, 0.92]; }, { dark: 0xd2ccc0, light: 0xf4f2ec, strength: 1.2 });
    for (const t of [pl.map, pl.normalMap]) t.repeat.set(10, 1);
    S.wallM = sm({ map: pl.map, normalMap: pl.normalMap, roughness: 0.95, side: THREE.BackSide, emissive: 0x58534a }, 0xe0c4ac);
    S.wallM.onBeforeCompile = (sh) => { sh.uniforms.uChalk = S.chalk; sh.uniforms.uRimC = S.propRim; sh.fragmentShader = 'uniform float uChalk; uniform vec3 uRimC;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float fu = fract(vMapUv.x * 2.0); float du = min(fu, 1.0 - fu) / max(fwidth(vMapUv.x * 2.0), 1e-4); float dv = min(min(abs(vMapUv.y - 0.1), abs(vMapUv.y - 0.86)), abs(vMapUv.y - 0.35)) / max(fwidth(vMapUv.y), 1e-4); float ln = max(1.0 - smoothstep(0.5, 1.6, du), 1.0 - smoothstep(0.5, 1.6, dv)); totalEmissiveRadiance += vec3(0.42, 0.44, 0.58) * ln * uChalk; }'); };
    S.wallM.customProgramCacheKey = () => 'atelierWall';
    add(new THREE.CylinderGeometry(WR, WR, WH, 72, 1, true), S.wallM, 0, WH / 2 - 0.6, 0);
    const dkw = sm({ color: 0x6a4a2e, roughness: 0.6 }, 0xffb890); add(new THREE.CylinderGeometry(WR - 0.5, WR - 0.5, 6, 72, 1, true), sf({ color: 0xc0a47e, roughness: 0.6, side: THREE.BackSide }, 0xd8bca4), 0, 2.4, 0);
    const ceil = add(new THREE.CircleGeometry(WR, 48), sf({ color: 0xe0d8c8, roughness: 1, emissive: 0x2a261e }, 0xffb890), 0, WH - 0.6, 0); ceil.rotation.x = PI / 2;
    for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(3.5, 4.5, WR * 2), dkw, i * 28, WH - 4, 0);
    // north-light windows on the far wall; the middle one throws a slanted shaft with dust in it
    S.paneM = new THREE.MeshBasicMaterial({ color: 0xe8f0ff, vertexColors: true, fog: false }); const frM = sm({ color: 0x3a3028, roughness: 0.7 }, 0xc09070);
    for (const [wa, ww, wh] of [[PI, 40, 56], [PI - 1.08, 30, 50], [PI + 1.08, 30, 50]]) { const win = new THREE.Group(), p2 = at(wa, WR - 0.6); win.position.set(p2[0], -0.6, p2[1]); win.rotation.y = wa + PI; g.add(win);
      const pg = new THREE.PlaneGeometry(ww, wh, 1, 4), pcol = []; for (let i = 0; i < pg.attributes.position.count; i++) { const k = pg.attributes.position.getY(i) / wh + 0.5; pcol.push(0.86 - 0.04 * k, 0.84 + 0.04 * k, 0.74 + 0.22 * k); } pg.setAttribute('color', new THREE.Float32BufferAttribute(pcol, 3)); add(pg, S.paneM, 0, 3 + wh / 2, -0.2, win);
      const nc = Math.round(ww / 10); for (let i = 0; i <= nc; i++) add(new THREE.BoxGeometry(i % nc ? 1.1 : 2.4, wh, 1.4), frM, -ww / 2 + i * ww / nc, 3 + wh / 2, 0.6, win);
      for (let j = 0; j <= 6; j++) add(new THREE.BoxGeometry(ww, j % 6 ? 1 : 2.4, 1.4), frM, 0, 3 + j * wh / 6, 0.6, win); add(new THREE.BoxGeometry(ww + 6, 1.4, 4), frM, 0, 2.4, 1.8, win); }
    S.shaftU = { uC: { value: new THREE.Color(0xfff2dc) }, uA: { value: 0.09 }, uT: S.pT };
    const shM = new THREE.ShaderMaterial({ uniforms: S.shaftU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: vsUV,
      fragmentShader: 'uniform vec3 uC; uniform float uA,uT; varying vec2 vUv; varying vec3 vN,vV; void main(){ vec3 n=vN/max(length(vN),1e-4), v=vV/max(length(vV),1e-4); float f=pow(clamp(abs(dot(n,v)),0.0,1.0),1.5); float e=smoothstep(0.0,0.5,vUv.y)*smoothstep(1.0,0.92,vUv.y); float s=0.72+0.28*sin(vUv.x*50.0+uT*0.3)*sin(vUv.x*17.0-uT*0.2); float a=uA*f*e*s; gl_FragColor=vec4(uC*a,a); }' });
    const A0 = new V3(0, 30, -WR + 2), B0 = new V3(7, -0.6, -34), dir = A0.clone().sub(B0), L = dir.length(), shaft = add(new THREE.CylinderGeometry(13, 19, 1, 4, 1, true), shM, (A0.x + B0.x) / 2, (A0.y + B0.y) / 2, (A0.z + B0.z) / 2);
    shaft.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir.normalize()); shaft.scale.y = L; shaft.renderOrder = 5;
    const pc = cv(128), pq = pc.getContext('2d'), pgr = pq.createRadialGradient(64, 64, 12, 64, 64, 64); pgr.addColorStop(0, 'rgba(255,255,255,1)'); pgr.addColorStop(1, 'rgba(255,255,255,0)'); pq.fillStyle = pgr; pq.fillRect(0, 0, 128, 128); pq.globalCompositeOperation = 'destination-out'; pq.fillStyle = 'rgba(0,0,0,0.7)'; for (let i = 1; i < 4; i++) pq.fillRect(i * 32 - 2, 0, 4, 128); for (let j = 1; j < 6; j++) pq.fillRect(0, j * 128 / 6 - 2, 128, 4);
    S.poolM = new THREE.MeshBasicMaterial({ map: ctex(pc), color: 0xfff4e0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }); const pool = add(new THREE.PlaneGeometry(22, 34), S.poolM, B0.x, -0.5, B0.z - 4); pool.rotation.x = -PI / 2; pool.renderOrder = 3;
    S.motes = W.motes({ n: 260, box: [34, 34, 46], center: [4, 15, -56], color: 0xfff4dc, size: 0.4, vel: [0.1, -0.15, 0.05], sway: 1.2, alpha: 0.6 }); g.add(S.motes);
    // giant props: a jar of brushes, paint tubes, a rag, stacked canvases, an easel (all beyond where the camera can go)
    const lacq = sm({ color: 0x7a3420, roughness: 0.34 }, 0xffc0a0), steel = sm({ color: 0xc0c4cc, roughness: 0.3, metalness: 0.85 }), dull = sm({ color: 0xd0d0cc, roughness: 0.38, metalness: 0.7 });
    const glassM = rimify(new THREE.MeshStandardMaterial({ color: 0xd8e8ea, roughness: 0.06, transparent: true, opacity: 0.3, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }), S.propRim, 'p'); mats.push([glassM, glassM.color.clone(), null]);
    const jp = at(PI + 0.72, 48), jar = new THREE.Group(); jar.position.set(jp[0], -0.6, jp[1]); g.add(jar);
    add(new THREE.CylinderGeometry(6, 5.6, 15, 40, 1, true), glassM, 0, 7.5, 0, jar); const jl = add(new THREE.TorusGeometry(6, 0.25, 8, 48), glassM, 0, 15, 0, jar); jl.rotation.x = PI / 2;
    add(new THREE.CylinderGeometry(5.7, 5.5, 6, 32), sm({ color: 0x9aa498, roughness: 0.2, transparent: true, opacity: 0.55 }), 0, 3, 0, jar);
    const tg = tuftGeo(9, false);
    [0xe23a2e, 0x2a5fe0, 0xf2c218, 0x5c4332, 0xe8e4dc, 0x2aa858].forEach((h, i) => { const b = new THREE.Group(), a = i / 6 * TAU + 0.3; b.position.set(Math.sin(a) * 2.6, 1, Math.cos(a) * 2.6); b.rotation.set(Math.cos(a) * 0.22, 0, -Math.sin(a) * 0.22); jar.add(b);
      add(new THREE.CylinderGeometry(0.42, 0.6, 26, 10), lacq, 0, 13, 0, b); add(new THREE.CylinderGeometry(0.72, 0.5, 3, 14), steel, 0, 27.4, 0, b); const t = add(tg, sm({ color: h, roughness: 0.6 }), 0, 28.6, 0, b); t.scale.setScalar(4.2); t.rotation.x = -PI / 2; });
    const tube = (a, d, ry, h) => { const t = new THREE.Group(), q = at(a, d); t.position.set(q[0], -0.6 + 1.8, q[1]); t.rotation.y = ry; t.scale.y = 0.8; g.add(t);
      const bg = new THREE.LatheGeometry([[0.05, -7], [1.9, -6.6], [2.2, -5], [2.2, 4], [1.5, 5.6], [0.9, 6.2], [0.9, 6.8]].map((p) => new THREE.Vector2(p[0], p[1])), 28); bg.rotateZ(-PI / 2); add(bg, dull, 0, 0, 0, t);
      add(new THREE.BoxGeometry(1.4, 0.5, 4.8), dull, -7.3, 0, 0, t); const lb = add(new THREE.CylinderGeometry(2.24, 2.24, 6, 32, 1, true), sm({ color: h, roughness: 0.5 }), -0.6, 0, 0, t); lb.rotation.z = PI / 2;
      const worm = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[6.6, 0, 0], [8.2, -0.3, 0.4], [9.6, -1.2, 1.0], [11, -1.5, 0.2], [12.4, -1.5, -0.9], [13.4, -1.5, 0.3]].map((p) => new V3(...p))), 40, 0.75, 10); add(worm, sm({ color: h, roughness: 0.15 }), 0, 0, 0, t);
      const cap = add(new THREE.CylinderGeometry(1.0, 1.0, 1.7, 20), sm({ color: 0x1a1a1a, roughness: 0.4 }), 4, -1.0, 5, t); cap.rotation.z = PI / 2; };
    tube(1.95, 46, 0.4, 0xe23a2e); tube(-1.95, 47, -0.3, 0x2a5fe0); tube(0.15, 47, 1.9, 0xd8a028);
    // rag: soft folds and stains
    const rg = new THREE.SphereGeometry(1, 56, 36), rp = rg.attributes.position, rcol = [];
    for (let i = 0; i < rp.count; i++) { _a.set(rp.getX(i), rp.getY(i), rp.getZ(i)).normalize(); const n = W.fbm(_a.x * 1.4 + 5, _a.z * 1.4 + _a.y * 2, 31, 3), fo = Math.sin(_a.x * 9 + n * 6) * Math.sin(_a.z * 7 - n * 5), k = 0.7 + n * 0.5 + fo * 0.09; rp.setXYZ(i, _a.x * 7 * k, Math.max(-0.15, _a.y) * 7 * k * 0.45, _a.z * 7 * k);
      const st = W.fbm(_a.x * 3 + 1, _a.z * 3 + _a.y * 3, 41, 3); _c.setRGB(0.84, 0.8, 0.72).multiplyScalar(0.82 + 0.18 * (fo * 0.5 + 0.5)); if (st > 0.56) _c.lerp(new THREE.Color([0xb04a3a, 0x3a5aa0, 0xc8a030][Math.floor(st * 40) % 3]), sat((st - 0.56) * 6) * 0.6); rcol.push(_c.r, _c.g, _c.b); }
    rg.setAttribute('color', new THREE.Float32BufferAttribute(rcol, 3)); rg.computeVertexNormals(); const rq = at(0.75, 48); add(rg, sm({ color: 0xffffff, vertexColors: true, roughness: 1 }), rq[0], -0.6, rq[1]);
    const prim = (c1, c2) => { const c = cv(64), q = c.getContext('2d'), gr = q.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, c1); gr.addColorStop(1, c2); q.fillStyle = gr; q.fillRect(0, 0, 64, 64); return ctex(c); }, arts = [prim('#ece6da', '#e0d8c8'), prim('#d8dde2', '#b8c4cc'), prim('#ecdcbc', '#d8c094')].map((t) => sm({ map: t, roughness: 0.9 }, 0xffe0c8));
    const fr2 = sm({ color: 0xb09068, roughness: 0.8 }, 0xffc090);
    for (const az of [1.3, -1.3, 2.6]) for (let k = 0; k < 2; k++) { const w = 18 + r() * 10, h = 22 + r() * 12, rr = WR - 4 - k * 2.2, o = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.9), [fr2, fr2, fr2, fr2, arts[(k + Math.round(az * 3) + 9) % 3], fr2]), a = az + (k - 1) * 0.13; o.position.set(Math.sin(a) * rr, -0.6 + h / 2 * 0.98, Math.cos(a) * rr); o.rotation.set(-0.16, a + PI, 0, 'YXZ'); g.add(o); }
    const ep = at(-0.95, 52), es = new THREE.Group(); es.position.set(ep[0], -0.6, ep[1]); es.rotation.y = -0.95 + PI; g.add(es);
    for (const sx of [-1, 1]) { const l = add(new THREE.BoxGeometry(1.4, 56, 1.4), dkw, sx * 9, 26, 0, es); l.rotation.set(0.08, 0, sx * 0.12); }
    const bl = add(new THREE.BoxGeometry(1.4, 54, 1.4), dkw, 0, 25, -8, es); bl.rotation.x = -0.32; add(new THREE.BoxGeometry(28, 1.4, 3), dkw, 0, 9, 1.4, es);
    add(new THREE.BoxGeometry(30, 20, 0.9), [fr2, fr2, fr2, fr2, arts[1], fr2], 0, 20, 0.8, es); add(new THREE.BoxGeometry(3.4, 1.8, 2.6), dkw, 0, 31, 0.9, es);
    // hanging canvases on wires, low enough to be seen: they take paint in phase two and glow lilac/cyan in the negative
    S.panels = [];
    [[PI - 0.42, 60], [PI + 0.42, 61], [1.62, 58], [-1.62, 59], [0.95, 62], [-0.5, 60]].forEach(([a, d], i) => { const w = 16 + r() * 6, h = 12 + r() * 4, y = 4.5 + h / 2 + r() * 3;
      const pgm = new THREE.PlaneGeometry(w, h, 12, 6), pp = pgm.attributes.position; for (let k = 0; k < pp.count; k++) { const u = pp.getX(k) / w + 0.5, v = pp.getY(k) / h + 0.5; pp.setZ(k, Math.sin(u * PI) * 0.7 + (1 - v) * (1 - v) * 0.8 * Math.sin(u * 7 + i)); }
      const m = panelMat(S, i % 2 ? 0x6a3a78 : 0xe8703a, i % 2 ? 0xe8703a : 0x6a3a78, i % 2 ? 0xa890d8 : 0x50a8d0, i % 2 ? 0x50a8d0 : 0xa890d8, i * 1.7 + 0.3);
      const pn = new THREE.Group(), q = at(a, d); pn.position.set(q[0], y, q[1]); pn.rotation.y = a + PI; g.add(pn); add(pgm, m, 0, 0, 0, pn);
      for (const sx of [-0.42, 0.42]) add(new THREE.BoxGeometry(0.15, WH - 0.6 - y - h / 2, 0.15), frM, sx * w, h / 2 + (WH - 0.6 - y - h / 2) / 2, 0, pn);
      S.panels.push({ g: pn, a: a + PI, y, ph: r() * TAU }); });
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0xd8d2c6, horizon: 0xe6e2d8, bottom: 0xa89c88, stars: 0, nebula: 0, sunSize: 0, sunGlow: 0, exp: 0.62 });
    g.add(sky); S.sky = sky; W.env(sky, 0.7);
    scene.fog = new THREE.FogExp2(0xe8e2d6, 0.003); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0xdfe6f4, 0xa89478, 0.7);
    S.sun = W.sun(g, { dir: [-0.7, 1, 0.25], color: 0xffe2bc, intensity: 1.3, size: 30 });
    S.fill = W.sun(g, { dir: [0.6, 0.55, -0.6], color: 0xb4c4ff, intensity: 0.4, shadow: false });
    S.negK = { value: 0 }; S.hueU = { value: new THREE.Color(1, 1, 1) }; S.hueMax = { value: 1 }; S.pK1 = { value: 0 }; S.pK2 = { value: 0 }; S.pT = { value: 0 }; S.propRim = { value: new THREE.Color(0) }; S.woodRim = { value: new THREE.Color(0) }; S.chalk = { value: 0 };
    S.cv = cv(N); S.ctx = S.cv.getContext('2d'); S.tex = ctex(S.cv); S.scv = cv(N); S.sctx = S.scv.getContext('2d'); S.stex = ctex(S.scv, false);
    S.bmp = cv(N); S.bctx = S.bmp.getContext('2d'); S.sbmp = cv(N); S.bsctx = S.sbmp.getContext('2d');
    S.floorM = new THREE.MeshStandardMaterial({ map: S.tex, emissiveMap: S.tex, emissive: 0x000000, roughness: 1, roughnessMap: S.stex, bumpMap: S.stex, bumpScale: 1.4, metalness: 0, envMapIntensity: 0.16 });
    S.floorM.onBeforeCompile = (sh) => { sh.uniforms.uT = S.pT; sh.uniforms.uNegK = S.negK; sh.fragmentShader = 'uniform float uT, uNegK;\n' + sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 1.0, uNegK);').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float wk = smoothstep(0.64, 0.56, texture2D(roughnessMap, vRoughnessMapUv).g); vec2 q = vRoughnessMapUv * 40.0; float bd = pow(max(0.0, sin(q.x * 0.33 + q.y * 0.21 - uT * 1.4)), 36.0) * (0.6 + 0.4 * sin(q.x * 3.1 - q.y * 2.3)); float sk = bd * wk * (1.0 - smoothstep(0.3, 0.55, diffuseColor.r - max(diffuseColor.g, diffuseColor.b))); diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * 1.3, vec3(1.0)), sk * 0.45); totalEmissiveRadiance *= 1.0 + sk * 0.08; }'); }; S.floorM.customProgramCacheKey = () => 'atelierFloor';
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 160), S.floorM); floor.rotation.x = -PI / 2; floor.receiveShadow = true; floor.position.y = 0.01; g.add(floor);
    studio(S, g);
    // wash water: a sunk dish of clean turpentine; the aura you wear; the roller
    S.washU = { uC: { value: new THREE.Color(0x9fd8f0) }, uT: S.pT };
    S.washM = new THREE.ShaderMaterial({ uniforms: S.washU, transparent: true, depthWrite: false, vertexShader: vsUV,
      fragmentShader: `uniform vec3 uC; uniform float uT; varying vec2 vUv; void main(){ vec2 p=vUv*2.0-1.0; float d=length(p); if(d>1.0) discard; float a=atan(p.y,p.x+1e-5);
        float deep=smoothstep(1.0,0.15,d); float sw=0.5+0.5*sin(a*3.0+d*7.0-uT*0.9+sin(d*5.0-uT*0.5)*1.5);
        vec3 col=mix(uC*1.05,uC*0.55,deep*0.7); col=mix(col,uC*1.25+0.06,sw*0.28*deep);
        float men=smoothstep(0.84,0.96,d)*(1.0-smoothstep(0.96,1.0,d)); col+=vec3(0.32)*men;
        float gl=pow(max(0.0,1.0-length(p-vec2(-0.35,0.4+0.05*sin(uT*0.7)))*2.4),3.0)*0.45; col+=vec3(gl);
        gl_FragColor=vec4(max(col,vec3(0.0)),0.82); }` });
    S.washG = new THREE.Group(); const wd = new THREE.Mesh(new THREE.CircleGeometry(2.5, 48), S.washM); wd.rotation.x = -PI / 2; wd.position.y = 0.05; S.washG.add(wd);
    S.dishM = W.mat({ color: 0xece6da, roughness: 0.22, metalness: 0 }); const wr = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.14, 12, 64), S.dishM); wr.rotation.x = PI / 2; wr.position.y = 0.08; S.washG.add(wr);
    const wb2 = new THREE.Mesh(new THREE.TorusGeometry(2.33, 0.035, 6, 64), W.mat({ color: 0x4a6a90, roughness: 0.25 })); wb2.rotation.x = PI / 2; wb2.position.y = 0.13; S.washG.add(wb2); g.add(S.washG);
    S.auraM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }); S.aura = new THREE.Group(); const ar = new THREE.Mesh(new THREE.RingGeometry(0.72, 1.02, 40), S.auraM); ar.rotation.x = -PI / 2; ar.position.y = 0.07; S.aura.add(ar);
    S.drop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), S.auraM); S.drop.position.y = 2.75; S.drop.scale.y = 1.4; S.aura.add(S.drop); S.aura.visible = false; g.add(S.aura);
    const nap = napTex(); S.rollM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: nap, bumpMap: nap, bumpScale: 2, roughness: 0.85, metalness: 0, transparent: true }); S.rollG = new THREE.Group();
    const rc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 12, 40, 1, true), S.rollM); rc.rotation.z = PI / 2; rc.position.y = 0.95; rc.castShadow = true; rc.userData.fadeOcclude = true; rc.userData.fadeMin = 0.35; S.rollG.add(rc);
    const capM = W.mat({ color: 0x3a3a40, roughness: 0.5, metalness: 0.6 }), stl = W.mat({ color: 0x9a9ca4, roughness: 0.35, metalness: 0.8 });
    for (const sy of [-1, 1]) { const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.14, 32), capM); cp.position.y = sy * 6.07; rc.add(cp); const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12), stl); hb.position.y = sy * 6.3; rc.add(hb);
      const yk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[6.35, 0.95, 0], [6.7, 0.95, 0], [6.75, 2.1, -0.5], [4, 2.9, -1.3], [0, 3.1, -1.6]].map((q) => new V3(q[0] * sy, q[1], q[2]))), 40, 0.07, 6), stl); S.rollG.add(yk); }
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 4.4, 12), W.mat({ color: 0x7a3a22, roughness: 0.4 })); hd.position.set(0, 4.1, -3.5); hd.rotation.x = -1.1; S.rollG.add(hd);
    S.rollG.visible = false; g.add(S.rollG); S.rollC = rc;
    S.blotG = new THREE.SphereGeometry(0.75, 14, 10); S.blotM = [RED, YEL, BLU].map((m) => new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.15, metalness: 0.3, emissive: HEX[m], emissiveIntensity: 0.5 }));
    // ---- Pentimento: an artist's lay figure, carved and pinned, with a brush the length of a halberd ----
    S.rig = new THREE.Group(); b.group.add(S.rig);
    const wb = W.bake(256, woodFn, { dark: 0x9a6a3c, light: 0xeac08a, strength: 2 });
    const wood = new THREE.MeshStandardMaterial({ map: wb.map, normalMap: wb.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: wb.roughnessMap, roughness: 1, metalness: 0, envMapIntensity: 0.7 });
    const joint = rimify(wood.clone(), S.woodRim, 'w'); rimify(wood, S.woodRim, 'w'); joint.color.setHex(0xb08458); const brass = W.mat({ color: 0xc8a050, roughness: 0.4, metalness: 0.8 }), seamM = W.mat({ color: 0x3a2416, roughness: 0.8 });
    const hb = W.bake(128, (u, v) => { const w = W.fbm(u * 4, v * 4, 27, 3, 4), gr = 0.5 + 0.5 * Math.sin(TAU * (u * 16 + w * 0.8)), f2 = W.fbm(u * 16, v * 16, 29, 3, 16); return [gr * 0.04 + f2 * 0.12, 0.72 + gr * 0.04 + f2 * 0.14, 0.32 + f2 * 0.12]; }, { dark: 0xb88a58, light: 0xf4dcb0, strength: 1 });
    const headM = new THREE.MeshStandardMaterial({ map: hb.map, normalMap: hb.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughnessMap: hb.roughnessMap, roughness: 1, metalness: 0, envMapIntensity: 0.8 });
    headM.onBeforeCompile = (sh) => { sh.uniforms.uRimC = S.woodRim; sh.vertexShader = 'varying vec3 vOP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;'); sh.fragmentShader = 'varying vec3 vOP;\nuniform vec3 uRimC;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n{ float s = abs(vOP.x); float w = fwidth(vOP.x) + 0.006; diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(0.004, 0.004 + w, s)); }').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRimC * pow(max(fr, 0.0), 3.0); }'); }; headM.customProgramCacheKey = () => 'atelierHead';
    S.woodMats = [wood, joint, headM].map((m) => [m, m.color.clone()]); const sphG = new THREE.SphereGeometry(1, 16, 12), pinG = new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(PI / 2), seamG = new THREE.TorusGeometry(1, 0.1, 6, 20).rotateX(PI / 2);
    const ball = (par, r, y, pin) => { const m = new THREE.Mesh(sphG, joint); m.scale.setScalar(r); m.position.y = y; par.add(m); if (pin) { const p = new THREE.Mesh(pinG, brass); p.scale.set(r * 2.12, r * 0.22, r * 0.22); p.position.y = y; par.add(p); } const s2 = new THREE.Mesh(seamG, seamM); s2.scale.setScalar(r * 0.78); s2.position.y = y - r * 0.68; par.add(s2); return m; };
    const seg = (par, r, len, y) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 12), wood); m.position.y = y; par.add(m); return m; };
    const hips = new THREE.Mesh(sphG, wood); hips.scale.set(0.55, 0.4, 0.45); hips.position.y = 2.45; S.rig.add(hips);
    S.smockU = { uT: { value: 0 }, uSw: { value: new THREE.Vector2() } }; const smT = smockTex();
    S.smockM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: smT, emissiveMap: smT, roughness: 0.82, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.12, side: THREE.DoubleSide });
    S.smockM.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, S.smockU); sh.vertexShader = 'uniform float uT; uniform vec2 uSw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float k = clamp((3.7 - position.y) / 1.5, 0.0, 1.0); float an = atan(position.x, position.z + 1e-4); transformed.xz += uSw * k * k; transformed.xz *= 1.0 + k * k * 0.035 * sin(uT * 2.3 + an * 5.0); transformed.y += k * k * 0.05 * sin(uT * 1.7 + an * 4.0); }'); };
    hueLock(S.smockM, S, 's'); S.sleeveM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: smT, emissiveMap: smT, roughness: 0.82, emissive: 0xffffff, emissiveIntensity: 0.12, side: THREE.DoubleSide }); hueLock(S.sleeveM, S, 'v');
    const SP = [[1.13, 2.08], [1.1, 2.2], [1.0, 2.6], [0.86, 3.08], [0.71, 3.52], [0.66, 3.84], [0.71, 4.12], [0.74, 4.32], [0.62, 4.52], [0.4, 4.66], [0.29, 4.72], [0.34, 4.78], [0.31, 4.86], [0.2, 4.83]];
    const sgm = new THREE.LatheGeometry(SP.map((q) => new THREE.Vector2(q[0], q[1])), 40), spp = sgm.attributes.position;
    for (let k = 0; k < spp.count; k++) { const x = spp.getX(k), y = spp.getY(k), z = spp.getZ(k), a = Math.atan2(x, z), lo = sat((3.7 - y) / 1.6), f = 1 + lo * (0.07 * Math.sin(a * 7 + 0.5) + 0.035 * Math.sin(a * 13 + 2)), hem = y < 2.25 ? Math.sin(a * 5 + 1) * 0.07 + Math.sin(a * 11) * 0.03 : 0; spp.setXYZ(k, x * f, y + hem, z * f); }
    sgm.computeVertexNormals(); S.rig.add(new THREE.Mesh(sgm, S.smockM));
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.42, 10), wood); neck.position.y = 4.82; S.rig.add(neck); ball(S.rig, 0.15, 5.0, false);
    const hg = new THREE.SphereGeometry(0.46, 28, 20), hp = hg.attributes.position; for (let i = 0; i < hp.count; i++) { const y = hp.getY(i); if (y < 0) { const k = 1 - 0.22 * (-y / 0.46); hp.setX(i, hp.getX(i) * k); hp.setZ(i, hp.getZ(i) * k); } } hg.computeVertexNormals();
    S.head = new THREE.Mesh(hg, headM); S.head.scale.y = 1.28; S.head.position.y = 5.55; S.rig.add(S.head);
    const arm = (sx) => { const a = new THREE.Group(); a.position.set(sx * 0.85, 4.35, 0); S.rig.add(a); ball(a, 0.22, 0, true); const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.33, 0.66, 14, 1, true), S.sleeveM); sl.position.y = -0.28; a.add(sl); seg(a, 0.15, 0.7, -0.55);
      const el = new THREE.Group(); el.position.y = -1.0; a.add(el); ball(el, 0.16, 0, true); seg(el, 0.13, 0.62, -0.48); ball(el, 0.11, -0.9, false); const hd2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.15), wood); hd2.position.y = -1.08; el.add(hd2); const th = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), wood); th.position.set(-sx * 0.11, -1.0, 0.06); th.rotation.z = sx * 0.4; el.add(th); return [a, el]; };
    [S.armR, S.elR] = arm(1); [S.armL, S.elL] = arm(-1); S.armL.rotation.set(-0.5, 0, -0.5);
    S.legs = [-1, 1].map((sx) => { const h = new THREE.Group(); h.position.set(sx * 0.36, 2.4, 0); S.rig.add(h); ball(h, 0.23, 0, true); seg(h, 0.19, 0.8, -0.6); const kn = new THREE.Group(); kn.position.y = -1.2; h.add(kn); ball(kn, 0.18, 0, true); seg(kn, 0.16, 0.72, -0.5); ball(kn, 0.13, -1.0, false);
      const ft = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.17, 0.52), wood); ft.position.set(0, -1.11, 0.1); kn.add(ft); h.userData.knee = kn; return h; });
    S.brush = new THREE.Group(); S.brush.position.y = -1.0; S.elR.add(S.brush); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.095, 5.4, 10), W.mat({ color: 0x6a2c1c, roughness: 0.32 })); pole.rotation.x = PI / 2; pole.position.z = 1.4; S.brush.add(pole);
    const knob = new THREE.Mesh(sphG, pole.material); knob.scale.setScalar(0.1); knob.position.z = -1.3; S.brush.add(knob);
    const fm = W.mat({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.85 }), fer = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.55, 16), fm); fer.rotation.x = PI / 2; fer.position.z = 4.2; S.brush.add(fer);
    for (const z of [4.04, 4.12]) { const cr = new THREE.Mesh(new THREE.TorusGeometry(0.133, 0.018, 6, 20), fm); cr.position.z = z; S.brush.add(cr); }
    S.tipM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.38, emissive: 0xffffff, emissiveIntensity: 0.35 }); hueLock(S.tipM, S, 't'); const tip = new THREE.Mesh(tuftGeo(3, true), S.tipM); tip.position.z = 4.45; S.brush.add(tip);
    S.tipEnd = new THREE.Object3D(); S.tipEnd.position.z = 5.58; S.brush.add(S.tipEnd);
    S.dripM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.35 }); hueLock(S.dripM, S, 'd'); S.drip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), S.dripM); S.drip.scale.y = 1.6; S.drip.visible = false; g.add(S.drip);
    const ps = new THREE.Shape(); for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, k = 1 - 0.28 * Math.exp(-Math.pow(angDiff(a, 0.5), 2) / 0.05), x = Math.cos(a) * k, y = Math.sin(a) * 0.72 * k; if (i) ps.lineTo(x, y); else ps.moveTo(x, y); }
    const hole = new THREE.Path(); hole.absarc(0.42, 0.08, 0.12, 0, TAU, true); ps.holes.push(hole);
    const pgeo = new THREE.ExtrudeGeometry(ps, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 16 }); pgeo.rotateX(-PI / 2);
    const pal = new THREE.Mesh(pgeo, wood); pal.position.y = -1.0; pal.rotation.z = 1.2; S.elL.add(pal);
    [[RED, -0.5, 0.2], [YEL, -0.15, 0.45], [BLU, 0.25, 0.42], [0, -0.55, -0.25], [3, -0.1, -0.45], [7, 0.35, -0.3]].forEach(([m, bx, bz], i) => { const d = new THREE.Mesh(sphG, W.mat({ color: HEX[m], roughness: 0.16, metalness: 0 })); d.position.set(bx, 0.085, bz); d.scale.set(0.15 + (i % 3) * 0.03, 0.06, 0.13 + (i % 2) * 0.04); pal.add(d); });
    S.rig.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    // varnish cloche: shows while the figure is protected. A thin shell, clear in the middle, amber and glinting at the rim
    S.varnU = { uA: { value: 1 }, uT: S.pT, uC: { value: new THREE.Color(0xd8a050) } };
    S.varnM = new THREE.ShaderMaterial(Object.assign({ uniforms: S.varnU, vertexShader: 'varying vec3 vN, vV; varying float vY; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; vY=position.y; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uA,uT; uniform vec3 uC; varying vec3 vN, vV; varying float vY; void main(){ vec3 n=vN/max(length(vN),1e-4), v=vV/max(length(vV),1e-4); float fr=1.0-clamp(abs(dot(n,v)),0.0,1.0); float rim=pow(max(fr,0.0),3.5); float a=uA*0.8*rim; float gl=uA*0.4*smoothstep(0.6,0.8,fr)*(1.0-smoothstep(0.82,0.95,fr))*pow(clamp(dot(n,normalize(vec3(-0.7+0.1*sin(uT*0.6),0.7,0.1))),0.0,1.0),16.0); gl_FragColor=vec4(uC*a+vec3(gl),clamp(a,0.0,1.0)); }' }, PREMUL));
    S.varn = new THREE.Mesh(new THREE.SphereGeometry(3.3, 40, 24), S.varnM); S.varn.position.y = 2.9; S.varn.scale.y = 1.05; b.group.add(S.varn);
    S.light = new THREE.PointLight(0xffffff, 0, 24, 1.6); S.light.position.set(0, 8.5, 1); b.group.add(S.light);
    S.plight = new THREE.PointLight(0xc0d0ff, 0, 14, 1.5); g.add(S.plight);
    S.shBM = shadowMat(); S.shB = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), S.shBM); S.shB.rotation.x = -PI / 2; S.shB.renderOrder = 2; g.add(S.shB);
    S.shTM = shadowMat(); S.shT = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), S.shTM); S.shT.rotation.x = -PI / 2; S.shT.renderOrder = 2; g.add(S.shT);
    Object.assign(S, { pig: new Uint8Array(GN * GN), dryAt: new Float32Array(GN * GN), strokes: [], baked: [], fresh: [], full: true, reset: true, seed: 11, neg: false, col: RED, wear: 0, wearK: 0, lvl: 0, wash: { x: 0, z: 16.2, r: 2.5 }, roll: null, down: 0, swing: 0, look: 0, lookT: 0, bag: [], dryT: 0, scanT: 0, goal: null, flood: 0, blots: 0, blotList: [], match: 0, dr: { t: 1, on: false, v: 0 }, vr: mulberry(5) });
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 12 }, bossStart: { x: 0, z: -3, face: 0 }, camDist: 17, camPitch: 0.55,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
    };
  }

  const nextPig = (S) => { if (!S.bag.length) S.bag = shuffle([RED, YEL, BLU]); return S.bag.pop(); };
  function tint(S, m, loud) { if ((S.wear | m) === S.wear) return; S.wear |= m; S.wearK = 1; if (loud !== false) Sound.sfx('wave', 0.5, 1.5); }
  function* recolor(b, c) {
    const S = b.state; S.flood = 1;
    yield* b.cast({ name: 'Fresh Coat', time: 1.3 }); S.col = c; S.flood = 0; Sound.sfx('wave', 0.9, 0.7); FX.flash(HEX[c], 0.16, 3);
    if (!G.headless) FX.ring(b.pos.x, b.pos.z, { r0: 1, r1: 9, color: HEX[c], dur: 0.5 }); yield 0.5;
  }
  function stripe(b, m, x, z, a, w, delay, dmg, name) {
    const S = b.state, x0 = x - Math.sin(a) * 22, z0 = z - Math.cos(a) * 22;
    Hz.rect(x0, z0, a, 44, w, delay, dmg, { name, color: tel(S), onFire() { lay(S, { t: 'r', x: x0, z: z0, dir: a, len: 44, w, m }); S.swing = 1; if (!G.headless && m) FX.burst(x, 0.4, z, { n: 24, color: HEX[m], speed: [2, 9], life: [0.3, 0.8] }); }, onHit() { if (m && S.lvl >= 1) tint(S, m); } });
  }
  function* strokes(b, pigs) {
    const S = b.state, p = G.player; let a = rnd(0, PI);
    for (const m of pigs) { yield* b.cast({ name: 'Stroke', time: 0.45 }); stripe(b, m, p.pos.x + rnd(-1.5, 1.5), p.pos.z + rnd(-1.5, 1.5), a, 3, 1.0, 280, 'Stroke'); a += PI / 3 + rnd(-0.3, 0.3); yield 0.75; }
    yield 0.7;
  }
  function* splatter(b, n) {
    const S = b.state, p = G.player; yield* b.cast({ name: 'Splatter', time: 0.7 });
    for (let i = 0; i < n; i++) { const m = nextPig(S), a = rnd(0, TAU), d = i === 0 ? 0 : rnd(3, 8), x = clamp(p.pos.x + Math.sin(a) * d, -17, 17), z = clamp(p.pos.z + Math.cos(a) * d, -17, 17);
      Hz.circle(x, z, 2.6, 1.25, 220, { name: 'Splatter', color: tel(S), onFire() { lay(S, { t: 'c', x, z, r: 2.6, m }); }, onHit() { if (S.lvl >= 1) tint(S, m); } }); yield 0.28; }
    yield 1.1;
  }
  function* drips(b, n) {
    const S = b.state, p = G.player;
    for (let i = 0; i < n; i++) { const m = nextPig(S), a = rnd(0, TAU), d = rnd(1, 9), x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; if (Math.hypot(x, z) > R - 1) continue;
      Hz.circle(x, z, 1.7, 2.0, 160, { name: 'Drip', color: tel(S), quiet: true, onFire() { lay(S, { t: 'c', x, z, r: 1.7, m }); }, onHit() { if (S.lvl >= 1) tint(S, m); } }); yield 0.4; }
  }
  function* roller(b) {
    const S = b.state, p = G.player, m = nextPig(S), a = rnd(0, TAU), fx = Math.sin(a), fz = Math.cos(a), off = clamp(p.pos.x * fz - p.pos.z * fx, -9, 9), cx = fz * off, cz = -fx * off;
    yield* b.cast({ name: 'Roller', time: 0.8 }); Hz.rect(cx - fx * 22, cz - fz * 22, a, 44, 12, 1.3, 0, { name: 'Roller', color: tel(S), quiet: true });
    S.rollM.color.setHex(HEX[m]); S.roll = { a, fx, fz, cx, cz, s: -24, v: 11, m, hit: false, laid: -22 }; yield 1.3; Sound.sfx('wave', 0.8, 0.5);
    const q = S.roll; while (q.s < 22) { q.s += q.v * G.dt;
      if (p.alive && !q.hit && p.pos.y < 0.5) { const dx = p.pos.x - q.cx, dz = p.pos.z - q.cz, al = dx * fx + dz * fz, sd = dx * fz - dz * fx; if (Math.abs(al - q.s) < 1.0 && Math.abs(sd) < 6) { q.hit = true; p.hurt(300, { blockable: true, kb: { dir: a, dist: 4 }, src: { name: 'Roller' } }); if (S.lvl >= 1) tint(S, m); } }
      if (q.s - q.laid >= 5.5 || q.s >= 22) { const e = Math.min(q.s - 1, 22); if (e > q.laid) { lay(S, { t: 'r', x: q.cx + fx * q.laid, z: q.cz + fz * q.laid, dir: a, len: e - q.laid, w: 12, m }); q.laid = e; } }
      yield; }
    S.roll = null; yield 0.5;
  }
  function* knife(b) {
    const S = b.state, p = G.player; let a = rnd(0, PI);
    yield* b.cast({ name: 'Palette Knife', time: 0.7 });
    for (let i = 0; i < 3; i++) { stripe(b, 0, p.pos.x + rnd(-2, 2), p.pos.z + rnd(-2, 2), a, 2.4, 0.95, 260, 'Palette Knife'); a += PI / 3; yield 0.5; }
    yield 1.0;
  }
  function blot(b, m) {
    const S = b.state; if (S.blots >= 2) return; S.blots++; const a = rnd(0, TAU), x = Math.sin(a) * 15, z = Math.cos(a) * 15, mesh = new THREE.Mesh(S.blotG, S.blotM[[RED, YEL, BLU].indexOf(m)]); mesh.position.y = 0.7; mesh.castShadow = true;
    let lt = 0, cd = 0;
    const ent = b.spawnAdd({ name: 'Blot', hp: 280, x, z, radius: 0.85, aimY: 0.8, mesh, color: HEX[m], onDeath(e) { S.blots--; S.blotList = S.blotList.filter((q) => q !== e); lay(S, { t: 'c', x: e.pos.x, z: e.pos.z, r: 2.2, m }); },
      update(e, dt) { const p = G.player, d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z); if (d > 0.9) { e.pos.x += (p.pos.x - e.pos.x) / d * 3.1 * dt; e.pos.z += (p.pos.z - e.pos.z) / d * 3.1 * dt; e.group.position.copy(e.pos); }
        lt -= dt; if (lt <= 0) { lt = 0.55; lay(S, { t: 'c', x: e.pos.x, z: e.pos.z, r: 1.05, m }); } if (d < 1.35 && cd <= 0 && p.alive && e.alive) { cd = 9; p.hurt(140, { blockable: true, src: { name: 'Blot' } }); tint(S, m); e.damage(e.hp + 1, { src: 'self' }); }
        mesh.scale.set(1 + Math.sin(G.now * 7) * 0.12, 0.8 - Math.sin(G.now * 7) * 0.1, 1 + Math.cos(G.now * 6) * 0.12); } });
    S.blotList.push(ent); Sound.sfx('cast', 0.5, 0.6);
  }
  function* critique(b, T) {
    const S = b.state, p = G.player; S.crit = T;
    yield* b.cast({ name: 'Critique', time: T, onTick(k, cs) { S.crit = T - cs.t; } }); S.crit = 0;
    if (S.wear === need(S)) { S.down = 5; b.exposed = 5; Sound.sfx('shatter', 0.9, 0.9); Sound.sfx('parry', 0.9, 0.6); FX.flash(0xffffff, 0.2, 3); FX.shake(0.5); b.damage(Math.round(b.maxHp * 0.03), { src: 'player', crit: true }); if (!G.headless) { const c = HEX[S.wear] || 0xffffff; FX.burst(b.pos.x, 3, b.pos.z, { n: 46, color: c, color2: 0xffffff, speed: [4, 11], life: [0.4, 1.0], size: [0.25, 0.7], drag: 2.2 }); FX.burst(b.pos.x, 2.5, b.pos.z, { n: 10, smoke: true, color: 0xe8e0d0, color2: 0xc8beb0, speed: [1, 3], life: [0.8, 1.6], size: [1, 2.2], up: 1.5, alpha: 0.28, drag: 1.5 }); FX.ring(b.pos.x, b.pos.z, { r0: 0.3, r1: 6, color: c, dur: 0.5, width: 0.16 }); FX.light(b.pos.x, 4, b.pos.z, c, 60, 0.4, 15); } yield 5; S.down = 0; }
    else { if (p.alive) p.hurt(350, { blockable: false, src: { name: 'Critique' } }); Sound.sfx('bigboom', 0.7); FX.flash(tel(S), 0.25, 2); FX.shake(0.6); if (!G.headless) FX.beam(new V3(b.pos.x, 4, b.pos.z), new V3(p.pos.x, 1, p.pos.z), { color: S.neg ? 0xffffff : 0x202028, width: 0.9, dur: 0.35 }); yield 1.0; }
  }
  function* wander(b) { const a = rnd(0, TAU), d = rnd(0, 6); yield* b.moveTo(Math.sin(a) * d, Math.cos(a) * d, 5); }
  // one colour's worth of fight: he floods with it, lays down what you need and what you must not touch, then judges you
  function* block(b, c, k) {
    const S = b.state, lvl = S.lvl; yield* recolor(b, c);
    const nb = bitsOf(need(S)), others = [RED, YEL, BLU].filter((m) => nb.indexOf(m) < 0);
    yield* strokes(b, shuffle(nb.concat(others).slice(0, 3)));
    if (lvl >= 1 && k % 2 === 0) blot(b, pick(others.length ? others : nb));
    if (k % 3 === 0) yield* splatter(b, lvl >= 1 ? 4 : 3); else if (k % 3 === 1 && lvl >= 1) yield* roller(b); else yield* drips(b, 5);
    Co.start(function* () { yield 1.2; if (lvl >= 2) yield* drips(b, 4); else if (lvl === 1) yield* drips(b, 2); }, 'phase');
    yield* critique(b, lvl >= 2 ? 4.5 : 5);
    yield* wander(b);
    if (lvl >= 1 && k % 2 === 1) yield* knife(b); else yield* splatter(b, 3);
    if (lvl >= 2) { yield* strokes(b, shuffle(nb.concat(others)).slice(0, 2)); yield* critique(b, 4.5); }
    else yield* strokes(b, [nextPig(S), nextPig(S)]);
  }
  function setLvl(b, n) { const S = b.state; S.lvl = n; S.lookT = n; S.down = 0; S.roll = null; S.crit = 0; S.flood = 0; if ((n >= 2) !== S.neg) { S.neg = n >= 2; S.full = true; S.reset = true; } }
  function moveWash(S) { const a = rnd(0, TAU); S.wash = { x: Math.sin(a) * 16.2, z: Math.cos(a) * 16.2, r: 2.5 }; S.washK = 0; }

  G.bosses.push({
    id: 'atelier', name: 'PENTIMENTO', title: 'The Unfinished Canvas', hint: 'Wet paint', color: '#f0e8d8', telegraph: INK,
    hp: 31000, radius: 1.5, aimY: 3.6, enrage: 450,
    post: { bloom: 0.22, threshold: 0.97, radius: 0.6, exposure: 0.92, vig: 0.7, sat: 1.08, contrast: 1.04, tint: [1.0, 1.0, 1.0] },
    music: { bpm: 100, root: 43, scale: [0, 2, 4, 7, 9, 11, 12], prog: [0, 3, 4, 0, 5, 3, 1, 4],
      layers: [
        { v: 'flute', pat: ['0...2...4.....2.', '4...2...0.......'], oct: 1, len: 4, vol: 0.07, to: 1 }, { v: 'bell', pat: '0.....4...2.....', oct: 1, len: 6, vol: 0.06, to: 1 }, { v: 'pad', pat: '0...............', len: 16, vol: 0.09 },
        { v: 'kick', from: 1, to: 1, pat: 'x.....x.x.......', vol: 0.2 }, { v: 'tom', from: 1, to: 1, pat: '....x.......x.x.', vol: 0.12 }, { v: 'koto', from: 1, to: 1, pat: '0.2.4.2.0.4.2.4.', oct: 0, len: 1, vol: 0.06 }, { v: 'bass', from: 1, pat: '0.......0...4...', oct: -1, len: 3, vol: 0.12 },
        { v: 'sub', from: 2, pat: '0.......0.......', oct: -2, len: 6, vol: 0.16 }, { v: 'pulse', from: 2, pat: '0.0.4.0.0.0.2.0.', oct: 0, len: 1, vol: 0.06 }, { v: 'kick', from: 2, pat: 'x...x...x...x.x.', vol: 0.22 }, { v: 'choir', from: 2, pat: '0.......4.......', oct: 1, len: 8, vol: 0.06 },
      ] },
    build,
    *intro(b) { Sound.sfx('wave', 0.7, 0.5); yield* Cam.shot([-14, 22, 26], [0, 2, 0], [4, 4.5, 8], [0, 3.8, -3], 5.2, 46); },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setLvl(b, 0); yield 1.0; let k = 0; const seq = shuffle([RED, YEL, BLU]).concat(shuffle([3, 5, 6]));
        while (true) { yield* block(b, seq[k % seq.length], k); k++; }
      } },
      { at: 0.66, skipTo(b) { b.state.look = 1; }, *enter(b) {
        const S = b.state; setLvl(b, 0); S.lookT = 1;
        yield* b.cast({ name: 'Colour', time: 3.0, onTick: (k) => { FX.shake(k * 0.2); } });
        Sound.sfx('wave', 1, 0.4); Sound.sfx('roar', 0.4, 1.5); FX.flash(0xffb060, 0.3, 1.5); Co.start(Post.lerpTo({ tint: [1.02, 1.0, 0.98], sat: 1.12 }, 3), 'fight'); yield 1.0;
      }, *run(b) {
        const S = b.state; setLvl(b, 1); let k = 0, last = S.col;
        while (true) { const c = pick([1, 2, 4, 3, 5, 6].filter((q) => q !== last)); last = c; yield* block(b, c, k); k++; }
      } },
      { at: 0.33, skipTo(b) { b.state.look = 2; }, *enter(b) {
        const S = b.state; setLvl(b, 1); S.lookT = 2;
        yield* b.cast({ name: 'Negative', time: 3.2, onTick: (k) => { FX.shake(k * 0.45); } });
        setLvl(b, 2); Sound.sfx('shatter', 1, 0.4); Sound.sfx('bigboom', 0.9); FX.flash(0x000000, 0.5, 1.2); Co.start(Post.lerpTo({ bloom: 0.32, threshold: 0.9, exposure: 1.0, tint: [1.0, 1.0, 1.04], contrast: 1.1 }, 1.5), 'fight'); yield 1.4;
      }, *run(b) {
        const S = b.state; setLvl(b, 2); let k = 0, last = S.col;
        while (true) { const c = pick([1, 2, 4, 3, 5, 6].filter((q) => q !== last)); last = c; yield* block(b, c, k); k++; }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight' && p && p.alive;
      if (S.down > 0) S.down -= dt; S.washT = (S.washT || 0) + dt; if (S.washT > 18) { S.washT = 0; moveWash(S); }
      if (fight) {
        const inWash = Math.hypot(p.pos.x - S.wash.x, p.pos.z - S.wash.z) < S.wash.r;
        if (inWash) { if (S.wear) { S.wear = 0; S.wearK = 1; Sound.sfx('heal', 0.5, 1.6); } }
        else if (p.grounded && p.pos.y < 0.15) { const m = wetAt(S, p.pos.x, p.pos.z); if (m) tint(S, m); }
        p.speedMul = S.wear === 7 ? 0.8 : 1; const ok = S.wear === need(S); b.dmgTaken = ok ? 1.3 : 0.35; if (ok) S.match += dt;
      }
      S.dryT -= dt; if (S.dryT <= 0) { S.dryT = 0.5; for (const L of [S.strokes, S.baked]) for (const sh of L) if (!sh.dry && sh.m && G.ft - sh.t0 > WET) { sh.dry = true; S.full = true; } }
      if (G.headless) return;
      if (S.full || S.fresh.length || S.reset) paint(S);
      S.look = damp(S.look, S.lookT, 0.7, dt); const k1 = sat(S.look), k2 = sat(S.look - 1); S.pK1.value = k1; S.pK2.value = k2; S.pT.value = t;
      for (const [m, c0, cw] of S.stM) { m.color.copy(c0); if (cw) m.color.multiply(_c.setRGB(1, 1, 1).lerp(cw, k1)); m.color.multiplyScalar(1 - 0.93 * k2); }
      S.wallM.emissive.setHex(0x58534a).multiplyScalar(1 - k2); S.propRim.value.setHex(0x2a8cb0).multiplyScalar(k2 * 0.9); S.woodRim.value.setHex(0x3a4660).multiplyScalar(0.5 + k2 * 0.6); S.chalk.value = k2; S.varnU.uC.value.setScalar(S.neg ? 0.75 : 0.32);
      S.paneM.color.setHex(0xdfe9ff).lerp(_c.setHex(0xffb070), k1).lerp(_c.setHex(0x7a6ab8), k2).multiplyScalar(1.12 - 0.12 * k2);
      S.shaftU.uC.value.setHex(0xfff2dc).lerp(_c.setHex(0xffa860), k1); S.shaftU.uA.value = 0.22 * (1 - k2); S.poolM.color.setHex(0xfff4e0).lerp(_c.setHex(0xffb070), k1); S.poolM.opacity = 0.5 * (1 - k2);
      S.motes.material.uniforms.uAlpha.value = lerp(0.55, 0.25, k2); S.motes.material.uniforms.uCol.value.setHex(0xfff4dc).lerp(_c.setHex(0x9a90d0), k2);
      for (const q of S.panels) { q.g.rotation.y = q.a + Math.sin(t * 0.13 + q.ph) * 0.05; q.g.position.y = q.y + Math.sin(t * 0.21 + q.ph) * 0.3; }
      S.hemi.color.setHex(0xdfe6f4).lerp(_c.setHex(0xf4ece2), k1); S.hemi.groundColor.setHex(0xa89478).lerp(_c.setHex(0xa88a6c), k1); S.hemi.intensity = lerp(0.7, 0.28, k2);
      S.sun.color.setHex(0xfff2e2).lerp(_c.setHex(0xffe2c4), k1); S.sun.intensity = lerp(1.3, 0.08, k2); S.fill.color.setHex(0xb4c4ff).lerp(_c.setHex(0x9a80d0), k1); S.fill.intensity = lerp(0.4, 0, k2);
      S.fog.color.setHex(0xe4e6e4).lerp(_c.setHex(0xe8c4a0), k1).lerp(_c.setHex(0x020204), k2); S.fog.density = 0.003 + k2 * 0.0015;
      S.negK.value = S.neg ? 1 : 0; scene.environmentIntensity = 0.7 * (1 - 0.93 * k2); S.floorM.emissive.setScalar(S.neg ? 0.85 : 0); S.floorM.color.setScalar(S.neg ? 0 : 1); S.floorM.envMapIntensity = S.neg ? 0 : 0.16; // negative: the paint is pure emission, no light can wash it
      const cc = S.flood ? 0xffffff : HEX[S.col]; S.fl = damp(S.fl || 0, S.flood ? 1 : 0, 6, dt);
      for (const m of [S.smockM, S.sleeveM]) { m.color.setHex(cc); m.emissive.setHex(cc); m.emissiveIntensity = (S.neg ? 0.55 : 0.3) + S.fl * 0.5; }
      S.hueU.value.setHex(cc); S.hueMax.value = 1.0; for (const [m, c0] of S.woodMats) { m.color.copy(c0).multiply(_c.setRGB(1 - 0.8 * k2, 1 - 0.77 * k2, 1 - 0.7 * k2)); m.emissive.setRGB(0.05, 0.048, 0.046).multiplyScalar(k2); } for (const m of [S.tipM, S.dripM]) { m.color.setHex(cc); m.emissive.setHex(cc); m.emissiveIntensity = S.neg ? 1.0 : 0.3; }
      S.light.color.setHex(cc); S.light.intensity = S.neg ? 4 : 2 + S.fl * 8;
      const ok = S.wear === need(S); S.vk = damp(S.vk === undefined ? 1 : S.vk, ok || S.down > 0 ? 0 : 1, 6, dt); S.varn.visible = S.vk > 0.02; S.varnU.uA.value = S.vk; S.varn.rotation.y += dt * 0.3;
      S.swing = Math.max(0, S.swing - dt * 2.4); const dn = S.down > 0 ? 1 : 0; S.dnK = damp(S.dnK || 0, dn, 6, dt); const cast = b.castState ? 1 : 0; S.ck = damp(S.ck || 0, cast, 5, dt);
      S.armR.rotation.set(-0.6 - S.ck * 1.3 + S.swing * 1.9, 0, 0.25 - S.swing * 0.8); S.elR.rotation.x = -0.3 - S.ck * 0.2; S.brush.rotation.x = 0.7 + S.swing * 0.6 + S.ck * 0.2;
      S.armL.rotation.set(-0.5 + Math.sin(t * 1.1) * 0.06, 0, -0.5 - S.dnK * 0.8); S.elL.rotation.x = -0.55;
      S.rig.rotation.x = S.dnK * 0.5 + Math.sin(t * 0.9) * 0.02; S.rig.position.y = -S.dnK * 0.5; S.head.rotation.z = Math.sin(t * 0.7) * 0.12 + (S.crit > 0 ? 0.3 : 0); S.legs.forEach((l, i) => { l.rotation.x = (i ? 1 : -1) * 0.08 - S.dnK * 0.4; l.userData.knee.rotation.x = 0.06 + S.dnK * 0.7; });
      S.smockU.uT.value = t; S.smockU.uSw.value.set(Math.sin(t * 1.3) * 0.04, -S.swing * 0.12 - S.ck * 0.05);
      // paint drips off the loaded brush; soft contact shadows ground the figure and the brush head
      S.tipEnd.getWorldPosition(_a);
      if (!S.dr.on) { S.dr.t -= dt; if (S.dr.t <= 0) { S.dr.t = 0.5 + S.vr() * 1.2; if (_a.y > 0.4) { S.dr.on = true; S.dr.v = 0; S.drip.position.copy(_a); S.drip.visible = true; } } }
      else { S.dr.v += 14 * dt; S.drip.position.y -= S.dr.v * dt; if (S.drip.position.y < 0.05) { S.dr.on = false; S.drip.visible = false; } }
      S.shT.position.set(_a.x, 0.03, _a.z); S.shTM.uniforms.uA.value = S.neg ? 0 : 0.22 * sat(1 - _a.y / 3.5); S.shB.position.set(b.pos.x, 0.025, b.pos.z); S.shBM.uniforms.uA.value = S.neg ? 0 : 0.45;
      S.washK = damp(S.washK || 0, 1, 3, dt); S.washG.position.set(S.wash.x, 0, S.wash.z); S.washG.scale.setScalar(Math.max(0.01, S.washK)); S.washU.uC.value.setHex(S.neg ? 0x305880 : 0x9fd8f0); S.dishM.color.setHex(S.neg ? 0x8890a8 : 0xece6da);
      S.wearK = Math.max(0, S.wearK - dt * 2); S.aura.visible = !!p && S.wear > 0; if (p && S.wear) { S.aura.position.set(p.pos.x, 0, p.pos.z); S.drop.position.y = p.pos.y + 2.75 + Math.sin(t * 3) * 0.08; S.auraM.color.setHex(HEX[S.wear]).multiplyScalar(S.neg ? 1.5 : 1 + S.wearK * 0.6); S.aura.scale.setScalar(1 + S.wearK * 0.5); }
      if (p) { _b.set(p.pos.x - camera.position.x, 0, p.pos.z - camera.position.z); const l = Math.max(_b.length(), 1e-3); S.plight.position.set(p.pos.x + _b.x / l * 2.4, p.pos.y + 3.2, p.pos.z + _b.z / l * 2.4); S.plight.intensity = S.neg ? 40 : 0; }
      S.rollG.visible = !!S.roll; if (S.roll) { const q = S.roll; S.rollG.position.set(q.cx + q.fx * q.s, 0, q.cz + q.fz * q.s); S.rollG.rotation.y = q.a; S.rollC.rotation.x += dt * q.v; }
    },
    danger(b, x, z) {
      const S = b.state, q = S.roll; if (!q) return Infinity; const dx = x - q.cx, dz = z - q.cz, al = dx * q.fx + dz * q.fz, sd = dx * q.fz - dz * q.fx;
      if (Math.abs(sd) > 6.4 || al < q.s - 1) return Infinity; return Math.max(0.05, (al - q.s - 1) / q.v + (q.s < -22 ? 0.4 : 0));
    },
    bot(b, p) {
      const S = b.state, out = {}, nd = need(S), miss = nd & ~S.wear, extra = S.wear & ~nd, q = S.roll;
      if (q) { const dx = p.pos.x - q.cx, dz = p.pos.z - q.cz, al = dx * q.fx + dz * q.fz, sd = dx * q.fz - dz * q.fx, tt = (al - q.s - 1) / q.v; if (Math.abs(sd) < 6.3 && tt > 0 && tt < 0.2) p.jump(); }
      const bad = (x, z) => { const m = wetAt(S, x, z); return !!m && (m & ~nd) !== 0 && !(Math.hypot(x - S.wash.x, z - S.wash.z) < S.wash.r); };
      // hop over paint you must not touch
      if (p.grounded && p.moving && !bad(p.pos.x, p.pos.z)) { const l = Math.hypot(p.intentX, p.intentZ) || 1; if (bad(p.pos.x + p.intentX / l * 1.1, p.pos.z + p.intentZ / l * 1.1)) p.jump(); }
      out.avoid = bad; if (S.blotList.length) out.target = S.blotList.reduce((a, e) => Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) ? e : a);
      if (extra) { out.x = S.wash.x * 0.97; out.z = S.wash.z * 0.97; out.w = 4; return out; }
      if (miss) {
        S.scanT -= G.dt; if (S.scanT <= 0 || !S.goal) { S.scanT = 0.3; let best = null, bd = Infinity; for (let j = 0; j < GN; j += 1) for (let i = 0; i < GN; i += 1) { const k = j * GN + i, m = S.dryAt[k] > G.ft + 0.5 ? S.pig[k] : 0; if (!m || (m & ~nd) || !(m & miss)) continue; const x = (i + 0.5) * CELL - R, z = (j + 0.5) * CELL - R, d = Math.hypot(x - p.pos.x, z - p.pos.z); if (Math.hypot(x - S.wash.x, z - S.wash.z) < S.wash.r + 0.4) continue; if (d < bd) { bd = d; best = { x, z }; } } S.goal = best; }
        if (S.goal) { out.x = S.goal.x; out.z = S.goal.z; out.w = 4; }
      } else S.goal = null;
      return out;
    },
  });
})();
