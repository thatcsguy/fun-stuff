// DOOR XVI: THE CLOSER, Bottom of the Ninth. A ghost ballpark at night. The fight is played in innings: he bats and you
// field, then he pitches and you bat. The scoreboard past centre field is the only thing that keeps count.
(() => {
  const R = 21, GHOST = 0x9fd4ff, GOLD = 0xffe08a, RED = 0xff4030, TEL = 0xff8a3a;
  const HOME = { x: 0, z: 13 }, BASES = [{ x: 13, z: 0 }, { x: 0, z: -13 }, { x: -13, z: 0 }, HOME], BOX = [{ x: 2.1, z: 13.2 }, { x: -2.1, z: 13.2 }];
  const PITCH = { fast: { T: 0.55, col: 0xffffff, name: 'Heater' }, change: { T: 1.1, col: 0x60ff80, name: 'Change' }, curve: { T: 0.85, col: 0x60b0ff, name: 'Hook' }, brush: { T: 0.6, col: RED, name: 'Chin Music' }, split: { T: 0.95, col: 0xd080ff, name: 'Splitter' }, ghost: { T: 0.7, col: 0xffffff, name: 'Double Play' }, knuckle: { T: 1.05, col: 0xffd060, name: 'Knuckler' }, fire: { T: 0.9, col: 0xff5020, name: 'Fireball' } };
  const _c = new THREE.Color(), _c2 = new THREE.Color(), _m = new THREE.Object3D(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const inBox = (p) => BOX.find((q) => Math.abs(p.pos.x - q.x) < 1.35 && Math.abs(p.pos.z - q.z) < 1.9) || null;
  // stands: lower deck from the field wall, a fascia, an upper deck, a back wall under a roof canopy; a gap behind home and in centre field
  const LO = { r: R + 2.2, y: 3.6, n: 7, dr: 0.7, dy: 0.38 }, UP = { r: R + 7.5, y: 7.7, n: 6, dr: 0.75, dy: 0.48 }, ARCS = [[0.62, PI - 0.34], [PI + 0.34, TAU - 0.62]];
  const BANKS = [0.95, 1.8, 2.6, -0.95, -1.8, -2.6];
  const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const ctex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const VS_UV = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';

  function fieldTexture() {
    const N = 2048, cv = cvs(N, N), x = cv.getContext('2d'), RR = R + 0.5, u = N / (2 * RR), X = (v) => (v / (2 * RR) + 0.5) * N, r = mulberry(21);
    x.fillStyle = '#1d5a2a'; x.fillRect(0, 0, N, N);
    // narrow mowing bands with soft edges, then blade-direction grain that flips with the band
    x.save(); x.translate(N / 2, N / 2); x.rotate(PI / 4); const bw = N / 20;
    for (let i = 0; i < 58; i++) { const y0 = -1.45 * N + i * bw, g0 = x.createLinearGradient(0, y0, 0, y0 + bw), c = i % 2 ? '255,255,235' : '0,0,0', a = i % 2 ? 0.05 : 0.08; g0.addColorStop(0, 'rgba(' + c + ',' + (a * 0.4) + ')'); g0.addColorStop(0.25, 'rgba(' + c + ',' + a + ')'); g0.addColorStop(0.75, 'rgba(' + c + ',' + a + ')'); g0.addColorStop(1, 'rgba(' + c + ',' + (a * 0.4) + ')'); x.fillStyle = g0; x.fillRect(-1.5 * N, y0, 3 * N, bw);
      for (let k = 0; k < 1100; k++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(200,255,170,0.07)'; x.fillRect(-1.45 * N + r() * 2.9 * N, y0 + r() * bw, i % 2 ? 1 : 4, i % 2 ? 4 : 1); } }
    x.restore();
    x.strokeStyle = '#6f4a2c'; x.lineWidth = 1.7 * u; x.beginPath(); x.arc(X(0), X(0), (R - 0.35) * u, 0, TAU); x.stroke(); // warning track
    for (let i = 0; i < 5000; i++) { const a = r() * TAU, d = R - 1.2 + r() * 1.7; x.fillStyle = r() < 0.5 ? 'rgba(30,16,6,0.18)' : 'rgba(230,190,140,0.08)'; x.fillRect(X(Math.sin(a) * d), X(Math.cos(a) * d), 2, 2); }
    // the infield skin: smooth wavy outlines (no pixel blobs), on its own layer so grain, rake lines and scuffs stay inside it
    const D = cvs(N, N), y = D.getContext('2d'), dirt = '#8a5a34', blobs = [[0, 13, 4.3], [0, 0, 2.6], ...BASES.slice(0, 3).map((q) => [q.x, q.z, 2.3])];
    const outline = (each) => { for (const [cx, cz, rr] of blobs) { y.beginPath(); const p0 = r() * TAU, p1 = r() * TAU; for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU, d = rr * (1 + 0.018 * Math.sin(a * 7 + p0) + 0.011 * Math.sin(a * 13 + p1)), px = X(cx + Math.sin(a) * d), pz = X(cz + Math.cos(a) * d); i ? y.lineTo(px, pz) : y.moveTo(px, pz); } y.closePath(); each(); }
      for (let k = 0; k < 4; k++) { const A = BASES[(k + 3) % 4], B = BASES[k], ax = B.x - A.x, az = B.z - A.z, l = Math.hypot(ax, az), nx = -az / l, nz = ax / l, p0 = r() * TAU, pts = [];
        for (let i = 0; i <= 40; i++) { const t = i / 40, w = 1.1 + 0.05 * Math.sin(t * 23 + p0) + 0.03 * Math.sin(t * 57); pts.push([A.x + ax * t + nx * w, A.z + az * t + nz * w]); } for (let i = 40; i >= 0; i--) { const t = i / 40, w = 1.1 + 0.05 * Math.sin(t * 19 + p0 + 2) + 0.03 * Math.sin(t * 61); pts.push([A.x + ax * t - nx * w, A.z + az * t - nz * w]); }
        y.beginPath(); pts.forEach(([px, pz], i) => i ? y.lineTo(X(px), X(pz)) : y.moveTo(X(px), X(pz))); y.closePath(); each(); } };
    y.fillStyle = dirt; outline(() => y.fill());
    y.globalCompositeOperation = 'source-atop';
    for (const [cx, cz, rr] of [[0, 0, 1.9], [0, 13, 3.2]]) { const g1 = y.createRadialGradient(X(cx), X(cz), 0, X(cx), X(cz), rr * u); g1.addColorStop(0, 'rgba(196,140,90,0.55)'); g1.addColorStop(1, 'rgba(196,140,90,0)'); y.fillStyle = g1; y.fillRect(0, 0, N, N); }
    y.lineCap = 'round'; for (const [cx, cz, R1] of [[0, 0, 2.5], [0, 13, 4.2]]) for (let rr = 0.35; rr < R1; rr += 0.16 + r() * 0.2) { let a = r() * TAU; const end = a + TAU; while (a < end) { const l = 0.25 + r() * 0.9, al = 0.04 + r() * 0.07; y.strokeStyle = 'rgba(50,24,8,' + al + ')'; y.lineWidth = 1.6 + r(); y.beginPath(); y.arc(X(cx), X(cz), rr * u, a, Math.min(end, a + l)); y.stroke(); y.strokeStyle = 'rgba(255,225,180,' + (al * 0.4) + ')'; y.lineWidth = 1.1; y.beginPath(); y.arc(X(cx), X(cz), (rr + 0.05) * u, a, Math.min(end, a + l)); y.stroke(); a += l + r() * 0.5; } }
    for (let i = 0; i < 26000; i++) { y.fillStyle = r() < 0.55 ? 'rgba(40,20,8,0.14)' : 'rgba(255,220,170,0.08)'; y.fillRect(r() * N, r() * N, 2, 2); }
    for (const q of [...BASES, { x: 0, z: 0 }, { x: 0, z: 13 }, { x: 0, z: 13 }]) for (let i = 0; i < 70; i++) { const a = r() * TAU, d = Math.pow(r(), 0.7) * 2.6; y.fillStyle = r() < 0.6 ? 'rgba(45,22,8,0.42)' : 'rgba(215,165,115,0.36)'; y.beginPath(); y.ellipse(X(q.x + Math.sin(a) * d), X(q.z + Math.cos(a) * d), (0.08 + r() * 0.14) * u, (0.04 + r() * 0.05) * u, r() * PI, 0, TAU); y.fill(); }
    // damp darker soil lip just inside the edge, soft
    { const E = cvs(N, N), e = E.getContext('2d'); e.fillStyle = 'rgb(52,30,14)'; e.fillRect(0, 0, N, N); e.globalCompositeOperation = 'destination-out'; e.drawImage(D, 0, 0); y.save(); y.shadowColor = 'rgba(52,30,14,0.85)'; y.shadowBlur = 0.3 * u; y.drawImage(E, 0, 0); y.restore(); }
    x.save(); x.shadowColor = 'rgba(10,24,8,0.7)'; x.shadowBlur = 0.25 * u; x.drawImage(D, 0, 0); x.restore();
    // grass tufts biting into the dirt edge: short soft blades with round caps
    x.lineCap = 'round'; for (const [cx, cz, rr] of blobs) for (let i = 0; i < 260; i++) { const a = r() * TAU, d = rr + (r() - 0.6) * 0.22, px = X(cx + Math.sin(a) * d), pz = X(cz + Math.cos(a) * d), l = (0.05 + r() * 0.1) * u, aa = a + PI + (r() - 0.5) * 1.2; x.strokeStyle = r() < 0.5 ? 'rgba(40,100,48,0.8)' : 'rgba(26,74,34,0.8)'; x.lineWidth = 1.6 + r() * 1.4; x.beginPath(); x.moveTo(px, pz); x.lineTo(px + Math.sin(aa) * l, pz + Math.cos(aa) * l); x.stroke(); }
    const gr = x.createRadialGradient(X(0), X(0), R * 0.3 * u, X(0), X(0), RR * u); gr.addColorStop(0, 'rgba(255,244,220,0.07)'); gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(0.9, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)'); x.fillStyle = gr; x.fillRect(0, 0, N, N);
    // chalk: a faint dusty spread under the crisp line (crisp line unchanged)
    const lines = () => { x.beginPath(); x.moveTo(X(0), X(13)); x.lineTo(X(26), X(-13)); x.moveTo(X(0), X(13)); x.lineTo(X(-26), X(-13)); x.stroke(); for (const q of BOX) x.strokeRect(X(q.x - 1.1), X(q.z - 1.7), 2.2 * u, 3.4 * u); };
    x.lineCap = 'butt'; x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 0.3 * u; lines();
    x.strokeStyle = 'rgba(255,255,255,0.88)'; x.lineWidth = 0.14 * u; lines();
    x.fillStyle = '#ffffff'; for (const q of BASES.slice(0, 3)) { x.save(); x.translate(X(q.x), X(q.z)); x.rotate(PI / 4); x.fillRect(-0.45 * u, -0.45 * u, 0.9 * u, 0.9 * u); x.restore(); }
    x.beginPath(); x.moveTo(X(-0.5), X(12.6)); x.lineTo(X(0.5), X(12.6)); x.lineTo(X(0.5), X(13.1)); x.lineTo(X(0), X(13.6)); x.lineTo(X(-0.5), X(13.1)); x.fill(); x.fillRect(X(-0.5), X(-0.15), 1.0 * u, 0.3 * u);
    return ctex(cv);
  }
  // red: the chalk (glows in the last innings); green: light spilling from the rifts; blue: their dark gap
  function glowTexture() {
    const N = 2048, cv = cvs(N, N), x = cv.getContext('2d'), RR = R + 0.5, u = N / (2 * RR), X = (v) => (v / (2 * RR) + 0.5) * N, r = mulberry(5);
    x.fillStyle = '#000'; x.fillRect(0, 0, N, N); x.globalCompositeOperation = 'lighter';
    x.strokeStyle = '#ff0000'; x.fillStyle = '#ff0000'; x.lineWidth = 0.17 * u; x.beginPath(); x.moveTo(X(0), X(13)); x.lineTo(X(26), X(-13)); x.moveTo(X(0), X(13)); x.lineTo(X(-26), X(-13)); x.stroke();
    x.lineWidth = 0.1 * u; for (const q of BOX) x.strokeRect(X(q.x - 1.1), X(q.z - 1.7), 2.2 * u, 3.4 * u);
    for (const q of BASES.slice(0, 3)) { x.save(); x.translate(X(q.x), X(q.z)); x.rotate(PI / 4); x.fillRect(-0.47 * u, -0.47 * u, 0.94 * u, 0.94 * u); x.restore(); }
    x.beginPath(); x.moveTo(X(-0.5), X(12.6)); x.lineTo(X(0.5), X(12.6)); x.lineTo(X(0.5), X(13.1)); x.lineTo(X(0), X(13.6)); x.lineTo(X(-0.5), X(13.1)); x.fill();
    // four heavy rifts from the mound: jagged plate-edged polygons, a dark gap, light spilling up on both lips; short hairlines off them
    const rifts = [], hair = [];
    for (let k = 0; k < 4; k++) { let a = k / 4 * TAU + 0.4 + r() * 0.6, px = Math.sin(a) * 0.8, pz = Math.cos(a) * 0.8; const C = [[px, pz]];
      const a0 = a, n2 = 4 + Math.floor(r() * 3); for (let i = 0; i < n2; i++) { a = a0 + (i % 2 ? 1 : -1) * (0.2 + r() * 0.45); const l = 1.2 + r() * 0.7; px += Math.sin(a) * l; pz += Math.cos(a) * l; C.push([px, pz]); if (r() < 0.45) { const b = a + (r() < 0.5 ? 1 : -1) * (0.7 + r() * 0.6), hl = 0.6 + r() * 1.0; hair.push([px, pz, px + Math.sin(b) * hl, pz + Math.cos(b) * hl]); } }
      const L = [], Rr = []; C.forEach(([qx, qz], i) => { const [ax, az] = C[Math.max(0, i - 1)], [bx, bz] = C[Math.min(C.length - 1, i + 1)], dx = bx - ax, dz = bz - az, dl = Math.hypot(dx, dz) || 1, nx = -dz / dl, nz = dx / dl, w = 0.62 * Math.pow(1 - i / (C.length - 1), 1.1) * (0.8 + r() * 0.4) + 0.005;
        L.push([qx + nx * w * (0.6 + r() * 0.5), qz + nz * w * (0.6 + r() * 0.5)]); Rr.push([qx - nx * w * (0.6 + r() * 0.5), qz - nz * w * (0.6 + r() * 0.5)]); });
      rifts.push([...L, ...Rr.reverse()]); }
    const slabs = []; for (const a of [1.2, 4.1]) { const cx = Math.sin(a) * 1.9, cz = Math.cos(a) * 1.9, P = []; for (let i = 0; i < 5; i++) { const b = a + i / 5 * TAU + r() * 0.3, d = 0.5 + r() * 0.35; P.push([cx + Math.sin(b) * d, cz + Math.cos(b) * d]); } slabs.push(P); }
    const poly = (P) => { x.beginPath(); P.forEach(([qx, qz], i) => i ? x.lineTo(X(qx), X(qz)) : x.moveTo(X(qx), X(qz))); x.closePath(); };
    x.lineJoin = 'miter'; x.save(); x.shadowColor = 'rgba(0,255,0,0.8)'; x.shadowBlur = 0.9 * u; x.strokeStyle = 'rgba(0,255,0,0.5)'; x.lineWidth = 0.5 * u; for (const P of rifts) { poly(P); x.stroke(); } x.restore();
    x.strokeStyle = 'rgba(0,255,0,1)'; x.lineWidth = 0.07 * u; for (const P of rifts) { poly(P); x.stroke(); }
    x.fillStyle = 'rgba(0,0,255,1)'; for (const P of rifts) { poly(P); x.fill(); }
    for (const P of slabs) { x.strokeStyle = 'rgba(0,0,255,1)'; x.lineWidth = 0.12 * u; x.beginPath(); P.slice(0, 4).forEach(([qx, qz], i) => i ? x.lineTo(X(qx), X(qz)) : x.moveTo(X(qx), X(qz))); x.stroke(); x.strokeStyle = 'rgba(0,255,0,0.5)'; x.lineWidth = 0.04 * u; x.beginPath(); x.moveTo(X(P[3][0]), X(P[3][1])); x.lineTo(X(P[4][0]), X(P[4][1])); x.lineTo(X(P[0][0]), X(P[0][1])); x.stroke(); }
    x.strokeStyle = 'rgba(0,200,0,0.8)'; x.lineWidth = Math.max(1.2, 0.04 * u); x.lineCap = 'round'; for (const [ax, az, bx, bz] of hair) { x.beginPath(); x.moveTo(X(ax), X(az)); x.lineTo(X(bx), X(bz)); x.stroke(); }
    return ctex(cv, false);
  }
  // padded outfield wall: panels and seams, a yellow home-run line, distance markers and sponsor boards; low behind home
  function wallTextures() {
    const Wd = 4096, H = 128, c = cvs(Wd, H), e = cvs(Wd, H), x = c.getContext('2d'), y = e.getContext('2d'), r = mulberry(13), U = (phi) => (1 - (((phi / TAU) % 1) + 1) % 1) * Wd, pu = Wd / ((R + 0.5) * TAU), lowH = Math.round(H * (1 - 1.5 / 3.2));
    x.fillStyle = '#0c2a18'; x.fillRect(0, 0, Wd, H); y.fillStyle = '#0a160e'; y.fillRect(0, 0, Wd, H);
    const pw = Wd / 120; for (let i = 0; i < 120; i++) { const g0 = x.createLinearGradient(0, 0, 0, H); g0.addColorStop(0, '#3c8656'); g0.addColorStop(0.1, '#24643c'); g0.addColorStop(0.65, '#1a4e30'); g0.addColorStop(1, '#0e301c'); x.fillStyle = g0; x.fillRect(i * pw + 2, 9, pw - 4, H - 11); }
    const pal = [['#6a1616', '#e0c890'], ['#14224e', '#d8dde6'], ['#d6cba8', '#1a2a4a'], ['#8a5412', '#1a1008'], ['#1c4a64', '#f0e0a0']];
    const mark = [[1.86, '330'], [2.5, '375'], [-1.86, '330'], [-2.5, '375']];
    for (const s of [1, -1]) for (let i = 0; i < 9; i++) { const ph = s * (0.82 + i * 0.25); if (mark.some((m) => Math.abs(m[0] - ph) < 0.16) || Math.abs(ph) > 2.85 || Math.abs(ph) < 1.12) continue; const cx = U(ph), w = 3.0 * pu, [bg, fg] = pal[(i + (s > 0 ? 0 : 2)) % pal.length], k = (i * 7 + (s > 0 ? 1 : 4)) % 4;
      x.fillStyle = bg; x.fillRect(cx - w / 2, 26, w, 70); x.fillStyle = fg; x.strokeStyle = fg; x.lineWidth = 6;
      if (k === 0) { x.beginPath(); x.arc(cx - w * 0.25, 61, 22, 0, TAU); x.fill(); x.fillRect(cx, 48, w * 0.36, 9); x.fillRect(cx, 66, w * 0.28, 9); }
      else if (k === 1) { for (let j = 0; j < 3; j++) { x.beginPath(); x.moveTo(cx - w * 0.38 + j * w * 0.26, 40); x.lineTo(cx - w * 0.24 + j * w * 0.26, 61); x.lineTo(cx - w * 0.38 + j * w * 0.26, 82); x.stroke(); } }
      else if (k === 2) { x.fillRect(cx - w * 0.4, 44, w * 0.8, 8); x.fillRect(cx - w * 0.4, 70, w * 0.8, 8); x.beginPath(); x.moveTo(cx - 18, 61); x.lineTo(cx, 46); x.lineTo(cx + 18, 61); x.lineTo(cx, 76); x.fill(); }
      else { x.beginPath(); x.ellipse(cx, 61, w * 0.38, 24, 0, 0, TAU); x.stroke(); x.fillRect(cx - w * 0.2, 57, w * 0.4, 8); }
      y.globalAlpha = 0.3; y.drawImage(c, cx - w / 2, 26, w, 70, cx - w / 2, 26, w, 70); y.globalAlpha = 1; }
    x.textAlign = y.textAlign = 'center'; x.textBaseline = y.textBaseline = 'middle'; x.font = y.font = 'bold 62px "Courier New", monospace';
    for (const [ph, s] of mark) { x.fillStyle = '#f2f2ea'; x.fillText(s, U(ph), 64); y.fillStyle = '#5a5a52'; y.fillText(s, U(ph), 64); }
    for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(210,240,210,0.07)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * Wd, 12 + r() * (H - 14), 3 + r() * 8, 1 + r() * 2); }
    for (let i = 0; i < 120; i++) { const sx = i * pw, gs = x.createLinearGradient(sx - 9, 0, sx + 9, 0); gs.addColorStop(0, 'rgba(4,14,8,0)'); gs.addColorStop(0.45, 'rgba(4,14,8,0.75)'); gs.addColorStop(0.55, 'rgba(4,14,8,0.75)'); gs.addColorStop(1, 'rgba(4,14,8,0)'); x.fillStyle = gs; x.fillRect(sx - 9, 0, 18, H); x.fillStyle = 'rgba(120,180,130,0.18)'; x.fillRect(sx + 3, 9, 2, H - 11); }
    x.fillStyle = '#ffd040'; x.fillRect(0, 0, Wd, 7); y.fillStyle = '#ffc830'; y.fillRect(0, 0, Wd, 7);
    // behind home the wall drops to a low padded backstop
    for (const [a0, a1] of [[0, U(-1.0)], [U(1.0), Wd]]) { x.clearRect(a0, 0, a1 - a0, lowH); y.clearRect(a0, 0, a1 - a0, lowH); x.fillStyle = '#2a6a40'; x.fillRect(a0, lowH, a1 - a0, 6); y.fillStyle = '#000'; y.fillRect(a0, 0, a1 - a0, lowH + 6); }
    y.globalCompositeOperation = 'lighter'; y.globalAlpha = 0.3; y.drawImage(c, 0, 0); y.globalAlpha = 1; const gt = y.createLinearGradient(0, 0, 0, H * 0.5); gt.addColorStop(0, 'rgba(70,120,80,0.3)'); gt.addColorStop(1, 'rgba(70,120,80,0)'); y.fillStyle = gt; y.fillRect(0, 7, Wd, H * 0.5);
    for (const [a0, a1] of [[0, U(-1.0)], [U(1.0), Wd]]) y.clearRect(a0, 0, a1 - a0, lowH); y.globalCompositeOperation = 'source-over';
    const t = ctex(c), te = ctex(e); for (const q of [t, te]) { q.wrapS = THREE.RepeatWrapping; q.repeat.x = -1; } return { map: t, em: te };
  }
  function skylineTexture() {
    const Wd = 2048, H = 256, c = cvs(Wd, H), x = c.getContext('2d'), r = mulberry(77);
    x.clearRect(0, 0, Wd, H); let px = 0;
    while (px < Wd) { const w = 18 + r() * 60, h = 20 + Math.pow(r(), 1.6) * 150, top = H - h; x.fillStyle = '#05070d'; x.fillRect(px, top, w + 1, h);
      if (r() < 0.25) { x.fillRect(px + w * 0.45, top - 18, 2, 18); x.fillStyle = '#ff3020'; x.fillRect(px + w * 0.45 - 1, top - 20, 4, 3); }
      for (let wy = top + 5; wy < H - 4; wy += 6) for (let wx = px + 3; wx < px + w - 3; wx += 5) if (r() < 0.16) { x.fillStyle = r() < 0.7 ? 'rgba(255,200,120,' + (0.35 + r() * 0.5) + ')' : 'rgba(170,200,255,' + (0.3 + r() * 0.4) + ')'; x.fillRect(wx, wy, 2, 2); }
      px += w + r() * 4; }
    const t = ctex(c); t.wrapS = THREE.RepeatWrapping; t.repeat.x = 3; return t;
  }
  function haloTexture() {
    const N = 128, c = cvs(N, N), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,255,255,0.55)'); g.addColorStop(0.4, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, N, N);
    const s = x.createLinearGradient(0, 0, N, 0); s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.35)'); s.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = s; x.fillRect(0, 61, N, 6);
    return ctex(c);
  }
  function drawBoard(S) {
    const x = S.boardTmp, lamp = (px, py, on, c) => { x.fillStyle = on ? c : '#1c1a14'; x.beginPath(); x.arc(px, py, 27, 0, TAU); x.fill(); if (on) { x.fillStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.arc(px - 8, py - 8, 8, 0, TAU); x.fill(); } };
    x.fillStyle = '#06100c'; x.fillRect(0, 0, 1024, 512); x.strokeStyle = '#d8c890'; x.lineWidth = 10; x.strokeRect(8, 8, 1008, 496); x.fillStyle = '#0c1a12'; x.fillRect(20, 20, 984, 260);
    const i0 = Math.max(1, S.inning - 8), cx = (j) => 330 + j * 62;
    x.textBaseline = 'middle'; x.textAlign = 'center'; x.font = 'bold 32px "Courier New", monospace'; x.fillStyle = '#b8a870'; for (let j = 0; j < 9; j++) x.fillText(String(i0 + j), cx(j), 50); x.fillText('R', 940, 50);
    for (let row = 0; row < 2; row++) { const y = 118 + row * 92, ls = row ? S.lsH : S.lsG;
      x.textAlign = 'left'; x.font = 'bold 50px "Courier New", monospace'; x.fillStyle = '#ffd870'; x.fillText(row ? 'HOME' : 'GUEST', 34, y);
      for (let j = 0; j < 9; j++) { const n = i0 + j, live = n === S.inning; x.fillStyle = live ? '#2e2a10' : '#101c15'; x.fillRect(cx(j) - 26, y - 34, 52, 68); if (live) { x.strokeStyle = '#ffd870'; x.lineWidth = 3; x.strokeRect(cx(j) - 26, y - 34, 52, 68); }
        if (n <= S.inning) { x.fillStyle = '#ffe9a0'; x.textAlign = 'center'; x.font = 'bold 46px "Courier New", monospace'; x.fillText(String(ls[n] || 0), cx(j), y + 2); } }
      x.fillStyle = '#1e180a'; x.fillRect(900, y - 36, 80, 72); x.fillStyle = '#ffd870'; x.textAlign = 'center'; x.font = 'bold 56px "Courier New", monospace'; x.fillText(String(row ? S.homeRuns : S.guest), 940, y + 2); }
    x.textAlign = 'left'; x.font = 'bold 44px "Courier New", monospace'; x.fillStyle = '#ffd870'; x.fillText('INN ' + S.inning + (S.half === 'bot' ? ' ▼' : ' ▲'), 34, 330);
    x.fillText('S', 40, 430); for (let i = 0; i < 3; i++) lamp(120 + i * 74, 428, i < S.strikes, '#ff5030'); x.fillText('O', 420, 430); for (let i = 0; i < 3; i++) lamp(500 + i * 74, 428, i < S.outs, '#ffd040');
    x.strokeStyle = '#8a9a8a'; x.lineWidth = 8; x.beginPath(); x.moveTo(800, 330); x.lineTo(900, 400); x.lineTo(800, 470); x.lineTo(700, 400); x.closePath(); x.stroke(); x.fillStyle = '#c8d8e0'; for (const [qx, qy] of [[900, 400], [800, 330], [700, 400]]) x.fillRect(qx - 8, qy - 8, 16, 16);
    // bulb matrix: the text layer, slightly dilated, masked to lit dots and added over a cached dim-dot face (no pixel readback)
    const M = S.boardX, Lc = S.boardL; Lc.globalCompositeOperation = 'source-over'; Lc.clearRect(0, 0, 1024, 512); Lc.globalCompositeOperation = 'lighten'; for (const [ox, oy] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) Lc.drawImage(x.canvas, ox, oy);
    Lc.globalCompositeOperation = 'destination-in'; Lc.drawImage(S.dotMask, 0, 0); M.globalCompositeOperation = 'source-over'; M.drawImage(S.dotBase, 0, 0); M.globalCompositeOperation = 'lighter'; M.drawImage(Lc.canvas, 0, 0); M.globalAlpha = 0.2; M.drawImage(Lc.canvas, 0, 0); M.globalAlpha = 1; M.globalCompositeOperation = 'source-over';
    M.strokeStyle = '#e0c878'; M.lineWidth = 12; M.strokeRect(6, 6, 1012, 500); M.strokeStyle = '#5a4a20'; M.lineWidth = 3; M.strokeRect(16, 16, 992, 480);
    S.boardT.needsUpdate = true;
  }
  // fresnel rim on lit materials: the spectral edge that keeps him a ghost without one flat emissive colour
  function rimify(mat, rim, pw = 2.4) {
    mat.onBeforeCompile = (sh) => { sh.uniforms.uRim = { value: rim }; sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim;\nvoid main() {').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float nd = clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRim * pow(max(1.0 - nd, 0.0), ' + pw.toFixed(1) + '); }'); };
    mat.customProgramCacheKey = () => 'bpRim' + pw; return mat;
  }
  function faceify(mat, rim) {
    mat.onBeforeCompile = (sh) => { sh.uniforms.uRim = { value: rim };
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vLy;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLy = position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim; varying float vLy;\nvoid main() {').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float sh = smoothstep(-0.01, 0.09, vLy); diffuseColor.rgb *= mix(1.0, 0.4, sh); totalEmissiveRadiance *= mix(1.0, 0.35, sh); vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float nd = clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRim * pow(max(1.0 - nd, 0.0), 2.0) * 1.5 * (1.0 - sh * 0.8); }'); };
    mat.customProgramCacheKey = () => 'bpFace'; return mat;
  }
  // the spectral fielders: see-through in the middle, bright at the edges, scanlines, dissolving into nothing at the feet
  function spectral(mat, rim, uT) {
    mat.onBeforeCompile = (sh) => { sh.uniforms.uRim = { value: rim }; sh.uniforms.uT = uT;
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vBpY;\nvoid main() {').replace('#include <project_vertex>', '#include <project_vertex>\nvBpY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim; uniform float uT; varying float vBpY;\nvoid main() {').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float nd = clamp(abs(dot(normal, vv)), 0.0, 1.0); float fr = pow(max(1.0 - nd, 0.0), 2.0);\n' +
        ' float sc = 0.7 + 0.3 * sin(vBpY * 24.0 - uT * 7.0); float ft = smoothstep(0.1, 1.9, vBpY); diffuseColor.a *= clamp((0.22 + 1.1 * fr) * sc * ft, 0.0, 1.0); totalEmissiveRadiance += uRim * fr * 1.3 * ft; }'); };
    mat.customProgramCacheKey = () => 'bpSpec'; return mat;
  }
  const ballMat = (hex, uT) => { const m = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(hex) }, uT },
    vertexShader: 'varying vec3 vO; varying vec3 vN; varying vec3 vV; void main(){ vO=position; vN=normalMatrix*normal; vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
    fragmentShader: `uniform vec3 uC; uniform float uT; varying vec3 vO; varying vec3 vN; varying vec3 vV;
      void main(){ vec3 n=vO/max(length(vO),1e-4); float a=uT*18.0, c=cos(a), s=sin(a); n=vec3(c*n.x+s*n.y,-s*n.x+c*n.y,n.z);
        float ph=atan(n.z, (abs(n.x)+abs(n.z))<1e-4 ? 1.0 : n.x); float seam=1.0-smoothstep(0.05,0.12,abs(n.y-0.42*cos(2.0*ph)));
        vec3 vv=vV/max(length(vV),1e-4); vec3 nn=vN/max(length(vN),1e-4); float nd=clamp(dot(nn,vv),0.0,1.0); float core=pow(nd,3.0);
        vec3 col=uC*(0.55+0.45*core)*(1.0-seam*0.55*(0.3+0.7*nd)); gl_FragColor=vec4(max(col,vec3(0.0)),1.0); }` }); m.color = m.uniforms.uC.value; return m; };
  function mkTrail(g, n) {
    const pos = new Float32Array(n * 6), al = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < n; i++) { al[i * 2] = al[i * 2 + 1] = 1 - i / (n - 1); if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aA', new THREE.BufferAttribute(al, 1)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color() } }, vertexShader: 'attribute float aA; varying float vA; void main(){ vA=aA; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform vec3 uC; varying float vA; void main(){ float a=clamp(vA,0.0,1.0); a*=a; gl_FragColor=vec4(uC*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.frustumCulled = false; m.visible = false; m.renderOrder = 11; g.add(m); return { m, pts: Array.from({ length: n }, () => new V3()), n, live: 0 };
  }
  function stepTrail(T, o, on, w) {
    if (!on) { T.live = 0; T.m.visible = false; return; }
    const P = T.pts; if (!T.live) for (const q of P) q.copy(o.position); T.live = 1;
    for (let i = T.n - 1; i > 0; i--) P[i].copy(P[i - 1]); P[0].copy(o.position);
    const a = T.m.geometry.attributes.position, c = camera.position;
    for (let i = 0; i < T.n; i++) { _v.subVectors(P[Math.max(0, i - 1)], P[Math.min(T.n - 1, i + 1)]); _w.subVectors(P[i], c); _v.cross(_w); const l = _v.length(); if (l > 1e-5) _v.multiplyScalar(w * (1 - i / T.n) / l); else _v.set(0, 0, 0); a.setXYZ(i * 2, P[i].x + _v.x, P[i].y + _v.y, P[i].z + _v.z); a.setXYZ(i * 2 + 1, P[i].x - _v.x, P[i].y - _v.y, P[i].z - _v.z); }
    a.needsUpdate = true; T.m.visible = true;
  }
  // a ballplayer: legs and arms on pivots the animation drives; `kit` is one material or a full uniform
  function ghostMan(scale, kit, bat) {
    const K = kit.isMaterial ? { jersey: kit, pants: kit, trim: kit, under: kit, sock: kit, cleat: kit, cap: kit, skin: kit, face: kit, glove: kit, web: kit, belt: kit, wood: kit, tape: kit, barrel: kit, emblem: kit } : kit;
    const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig); rig.scale.setScalar(scale);
    const add = (geo, x, y, z, par, m) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); par.add(o); return o; };
    const C = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s), Sp = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
    const legs = [-1, 1].map((sx) => { const h = new THREE.Group(); h.position.set(sx * (K.stripe ? 0.19 : 0.17), 0.95, 0); rig.add(h);
      add(K.stripe ? C(0.14, 0.11, 0.6) : C(0.155, 0.124, 0.6), 0, -0.3, 0, h, K.pants);
      if (!K.stripe) { add(C(0.112, 0.082, 0.3), 0, -0.74, 0, h, K.sock); add(new THREE.BoxGeometry(0.15, 0.08, 0.32), 0, -0.915, 0.06, h, K.cleat); return h; }
      add(new THREE.LatheGeometry([[0.001, -0.89], [0.078, -0.89], [0.096, -0.81], [0.116, -0.71], [0.11, -0.62], [0.001, -0.6]].map(([a, b]) => new THREE.Vector2(a, b)), 12), 0, 0, 0, h, K.sock);
      add(new THREE.BoxGeometry(0.022, 0.22, 0.07), sx * 0.108, -0.74, 0, h, K.stripe);
      add(new THREE.BoxGeometry(0.14, 0.075, 0.26), 0, -0.88, 0.04, h, K.cleat); add(new THREE.SphereGeometry(0.07, 10, 6), 0, -0.9, 0.165, h, K.cleat).scale.set(1, 0.55, 1);
      add(new THREE.BoxGeometry(0.15, 0.024, 0.34), 0, -0.928, 0.05, h, K.sole); add(new THREE.BoxGeometry(0.06, 0.006, 0.13), 0, -0.84, 0.07, h, K.stripe);
      for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.025, 0.02, 0.025), (i % 2 - 0.5) * 0.08, -0.945, -0.08 + Math.floor(i / 2) * 0.12, h, K.belt); return h; });
    const body = new THREE.Group(); body.position.y = 0.95; rig.add(body);
    if (K.stripe) { add(new THREE.LatheGeometry([[0.001, -0.2], [0.17, -0.19], [0.25, -0.11], [0.285, 0.0], [0.27, 0.1], [0.255, 0.17], [0.001, 0.18]].map(([a, b]) => new THREE.Vector2(a, b)), 18), 0, 0, -0.01, body, K.pants).scale.set(1, 1, 0.8); add(new THREE.BoxGeometry(0.06, 0.045, 0.015), 0, 0.12, 0.205, body, K.trim); }
    else add(Sp(0.27, 12, 8), 0, 0.04, 0, body, K.pants).scale.set(1.05, 0.62, 0.78);
    const tg = new THREE.Group(); tg.scale.z = 0.74; body.add(tg);
    add(new THREE.LatheGeometry([[0.001, 0.05], [0.24, 0.07], [0.26, 0.3], [0.32, 0.62], [0.355, 0.84], [0.33, 0.96], [0.22, 1.04], [0.1, 1.08], [0.001, 1.09]].map(([a, b]) => new THREE.Vector2(a, b)), 16), 0, 0, 0, tg, K.jersey);
    add(new THREE.TorusGeometry(0.255, 0.028, 6, 18), 0, 0.12, 0, tg, K.belt).rotation.x = PI / 2;
    if (K.number) { add(new THREE.CylinderGeometry(0.35, 0.324, 0.34, 14, 1, true, PI - 0.8, 1.6), 0, 0.75, 0, tg, K.number); add(new THREE.CylinderGeometry(0.358, 0.33, 0.2, 10, 1, true, -0.62, 0.5), 0, 0.72, 0, tg, K.chest);
      add(new THREE.BoxGeometry(0.034, 0.426, 0.02), 0, 0.41, 0.296, tg, K.trim).rotation.x = 0.158; add(new THREE.BoxGeometry(0.034, 0.33, 0.02), 0, 0.785, 0.336, tg, K.trim).rotation.x = 0.04;
      for (const [by, bz] of [[0.3, 0.287], [0.48, 0.316], [0.66, 0.338], [0.84, 0.346]]) add(Sp(0.016, 6, 4), 0.0, by, bz + 0.012, tg, K.stripe);
      add(new THREE.TorusGeometry(0.11, 0.026, 6, 16), 0, 1.05, 0, body, K.trim).rotation.x = PI / 2; }
    add(K.number ? C(0.11, 0.125, 0.18, 10) : C(0.09, 0.1, 0.16, 8), 0, 1.1, 0, body, K.skin);
    const head = new THREE.Group(); head.position.y = 1.2; body.add(head); add(Sp(0.2, 14, 10), 0, 0, 0, head, K.face).scale.set(0.92, 1.05, 0.96);
    if (K.number) { add(Sp(0.15, 12, 8), 0, -0.135, 0.05, head, K.skin).scale.set(0.9, 0.72, 1.0); add(Sp(0.06, 8, 6), 0, -0.2, 0.14, head, K.skin); add(new THREE.BoxGeometry(0.04, 0.07, 0.06), 0, -0.06, 0.2, head, K.skin).rotation.x = -0.25;
      add(new THREE.TorusGeometry(0.212, 0.016, 5, 24), 0, 0.035, 0, head, K.trim).rotation.x = PI / 2; add(new THREE.TorusGeometry(0.219, 0.006, 4, 28), 0, 0.035, 0, head, K.glowLine).rotation.x = PI / 2;
      add(new THREE.SphereGeometry(0.205, 14, 6, PI, PI, PI / 2, 0.95), 0, 0.03, -0.005, head, K.hair); for (const sx of [-1, 1]) add(Sp(0.045, 8, 6), sx * 0.183, -0.02, -0.01, head, K.skin).scale.set(0.45, 1, 0.8); }
    add(new THREE.SphereGeometry(0.215, 14, 8, 0, TAU, 0, PI / 2), 0, 0.03, 0, head, K.cap);
    const brim = add(new THREE.CylinderGeometry(0.2, 0.21, 0.022, 16, 1, false, -PI / 2, PI), 0, 0.04, 0.1, head, K.cap); brim.scale.z = 1.45; brim.rotation.x = 0.2;
    add(new THREE.CircleGeometry(K.number ? 0.065 : 0.055, 12), 0, 0.155, 0.183, head, K.emblem).rotation.x = -0.62;
    const eyeM = K.eye || W.glow(GHOST, 5); for (const sx of [-1, 1]) { const e = add(Sp(0.032, 8, 5), sx * 0.072, -0.03, 0.178, head, eyeM); if (K.number) { e.scale.set(1.7, 0.42, 0.6); e.rotation.z = -sx * 0.18; } }
    const arms = [-1, 1].map((sx) => { const s = new THREE.Group(); s.position.set(sx * 0.39, 0.93, 0); body.add(s);
      if (K.glowLine) { add(Sp(0.118, 10, 8), 0, -0.01, 0, s, K.jersey).scale.set(1, 0.7, 1); add(C(0.12, 0.1, 0.3), 0, -0.15, 0, s, K.jersey); } else { add(Sp(0.135), 0, 0, 0, s, K.jersey); add(C(0.125, 0.105, 0.3), 0, -0.15, 0, s, K.jersey); }
      add(new THREE.TorusGeometry(0.106, 0.024, 6, 14), 0, -0.28, 0, s, K.trim).rotation.x = PI / 2; if (K.glowLine) add(new THREE.TorusGeometry(0.13, 0.008, 4, 20), 0, -0.28, 0, s, K.glowLine).rotation.x = PI / 2;
      add(Sp(0.088), 0, -0.36, 0, s, K.under); add(C(0.088, 0.068, 0.36), 0, -0.54, 0, s, K.under); add(Sp(0.075, 8, 6), 0, -0.74, 0.01, s, K.skin); return s; });
    const mitt = new THREE.Group(); mitt.position.set(0, -0.8, 0.05); arms[0].add(mitt); add(Sp(0.15), 0, 0, 0, mitt, K.glove).scale.set(1, 1.1, 0.5);
    for (let i = 0; i < 4; i++) add(new THREE.CapsuleGeometry(0.038, 0.13, 3, 6), -0.09 + i * 0.06, -0.19, 0, mitt, K.glove).rotation.z = (i - 1.5) * 0.12;
    add(new THREE.CapsuleGeometry(0.04, 0.11, 3, 6), 0.15, -0.02, 0.02, mitt, K.glove).rotation.z = 0.9; add(new THREE.BoxGeometry(0.1, 0.12, 0.02), 0.1, -0.13, 0, mitt, K.web).rotation.z = 0.5;
    if (K.lace) { add(new THREE.TorusGeometry(0.15, 0.009, 4, 20), 0, 0, 0.012, mitt, K.lace).scale.set(1, 1.1, 0.5); for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.11, 0.012, 0.03), 0.1, -0.08 - i * 0.04, 0.012, mitt, K.lace).rotation.z = 0.5; for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.012, 0.1, 0.012), -0.09 + i * 0.06, -0.24, 0.03, mitt, K.lace); }
    let batG = null; if (bat) { batG = new THREE.Group(); batG.position.set(0, -0.74, 0); arms[1].add(batG);
      add(C(0.056, 0.056, 0.035), 0, -0.1, 0, batG, K.wood); add(C(0.034, 0.034, 0.46, 8), 0, 0.15, 0, batG, K.tape); add(C(0.07, 0.034, 0.36), 0, 0.56, 0, batG, K.wood); add(C(0.079, 0.07, 0.5, 12), 0, 0.98, 0, batG, K.barrel); add(new THREE.SphereGeometry(0.079, 12, 6, 0, TAU, 0, PI / 2), 0, 1.23, 0, batG, K.barrel); }
    // fewer draw calls: inside each pivot group, fold the meshes that share a material into one (pivots and animation unchanged)
    const merge = (grp) => { const by = new Map(); for (const o of grp.children) if (o.isMesh) { if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(o); }
      for (const [m, L] of by) { if (L.length < 2) continue; const parts = L.map((o) => { o.updateMatrix(); const q = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); q.applyMatrix4(o.matrix); return q; }), out = new THREE.BufferGeometry();
        for (const k of ['position', 'normal', 'uv']) { if (!parts.every((p) => p.attributes[k])) continue; const A = new Float32Array(parts.reduce((a, p) => a + p.attributes[k].array.length, 0)); let off = 0; for (const p of parts) { A.set(p.attributes[k].array, off); off += p.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(A, parts[0].attributes[k].itemSize)); }
        for (const o of L) { grp.remove(o); o.geometry.dispose(); } for (const p of parts) p.dispose(); grp.add(new THREE.Mesh(out, m)); } };
    for (const q of [...legs, body, tg, head, ...arms, mitt, batG]) if (q) merge(q);
    return { g, rig, legs, body, head, arms, eyeM, batG };
  }

  function build(b) {
    const g = G.world, S = b.state, vr = mulberry(8);
    S.uT = { value: 0 }; S.rimC = new THREE.Color(GHOST); S.specRim = new THREE.Color(GHOST);
    const sky = W.sky({ top: 0x03060f, horizon: 0x1e2a48, bottom: 0x04070a, stars: 1.3, sunDir: [-0.4, 0.42, -0.82], sunColor: 0x2a3242, sunSize: 0.035, sunGlow: 0.45, clouds: 0.2, cloudColor: 0x343e58, cloudDark: 0x05070c, cloudSpeed: 0.008, auroraColor: 0x50ffb0, exp: 0.45 });
    g.add(sky); S.sky = sky; W.env(sky, 0.8);
    scene.fog = new THREE.FogExp2(0x0b1220, 0.009); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x8fa8d8, 0x1a2a1a, 0.7);
    S.sun = W.sun(g, { dir: [0.2, 1, 0.45], color: 0xfff4e6, intensity: 2.8, size: 30 });
    S.rimL = new THREE.DirectionalLight(0xc8dcff, 1.3); S.rimL.position.set(0, 26, -60); g.add(S.rimL); g.add(S.rimL.target);
    S.grassM = new THREE.MeshStandardMaterial({ map: fieldTexture(), roughness: 0.95 });
    const field = new THREE.Mesh(new THREE.CircleGeometry(R + 0.5, 96), S.grassM); field.rotation.x = -PI / 2; field.receiveShadow = true; g.add(field);
    S.chalkM = new THREE.ShaderMaterial({ uniforms: { uMap: { value: glowTexture() }, uChalk: { value: new THREE.Color() }, uCrack: { value: new THREE.Color() }, uCore: { value: 0 }, uT: S.uT, uHa: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uHb: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) } }, vertexShader: VS_UV,
      fragmentShader: `uniform sampler2D uMap; uniform vec3 uChalk,uCrack; uniform float uT,uCore; uniform vec4 uHa[8]; uniform vec4 uHb[8]; varying vec2 vUv;
        float inHz(vec2 p, vec4 a, vec4 b){ if (b.w < 0.5) return 0.0; vec2 d = p - a.xy; float L = length(d), m = 0.9; if (b.x < 1.5) return 1.0 - smoothstep(a.z, a.z + m, L); float s = sin(b.y), c = cos(b.y), al = d.x * s + d.y * c, sd = d.x * c - d.y * s;
          if (b.x < 2.5) { if (L < 1e-3) return 1.0; return (1.0 - smoothstep(a.z, a.z + m, L)) * (1.0 - smoothstep(a.w * 0.5, a.w * 0.5 + 0.3, abs(atan(sd, al)))); } return (1.0 - smoothstep(0.0, m, -al)) * (1.0 - smoothstep(a.z, a.z + m, al)) * (1.0 - smoothstep(a.w * 0.5, a.w * 0.5 + m, abs(sd))); }
        void main(){ vec2 p = vec2((vUv.x * 2.0 - 1.0) * ${(R + 0.5).toFixed(2)}, -(vUv.y * 2.0 - 1.0) * ${(R + 0.5).toFixed(2)}); float hide = 0.0; for (int i = 0; i < 8; i++) hide = max(hide, inHz(p, uHa[i], uHb[i])); float k = 1.0 - hide;
          vec3 m = texture2D(uMap, vUv).rgb; float pu = 0.7 + 0.3 * sin(uT * 1.4 + p.x * 0.3 + p.y * 0.2); vec3 c = uChalk * m.r + uCrack * m.g * (1.0 - m.b * 0.85) * pu * k; float a = clamp(m.b * uCore * k, 0.0, 0.8); gl_FragColor = vec4(max(c, vec3(0.0)), a); }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    const ov = new THREE.Mesh(new THREE.CircleGeometry(R + 0.5, 96), S.chalkM); ov.rotation.x = -PI / 2; ov.position.y = 0.02; ov.renderOrder = 2; g.add(ov);
    const far = new THREE.Mesh(new THREE.CircleGeometry(160, 40), W.mat({ color: 0x0b0d10, roughness: 1 })); far.rotation.x = -PI / 2; far.position.y = -0.05; g.add(far);
    const walk = new THREE.Mesh(new THREE.RingGeometry(R + 0.5, R + 2.3, 96), W.mat({ color: 0x1e2126, roughness: 0.95 })); walk.rotation.x = -PI / 2; walk.position.y = 0.01; g.add(walk);
    const wt = wallTextures(); const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.5, R + 0.5, 3.2, 128, 1, true), W.mat({ map: wt.map, emissiveMap: wt.em, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.85, side: THREE.BackSide, alphaTest: 0.5 })); wall.position.y = 1.6; wall.receiveShadow = true; g.add(wall);
    const rollM = W.mat({ color: 0x2a6a40, roughness: 0.6 }); for (const [yy, ph0, len] of [[3.2, -1.0, TAU - 2.0]]) { for (const pe of [1.0, -1.0]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), rollM); cap.position.set(Math.sin(pe) * (R + 0.42), yy - 0.05, Math.cos(pe) * (R + 0.42)); g.add(cap); } const tr = new THREE.Mesh(new THREE.TorusGeometry(R + 0.42, 0.11, 6, 120, len), rollM); tr.rotation.set(PI / 2, ph0 - PI / 2, 0, 'YXZ'); tr.position.y = yy - 0.05; g.add(tr); }
    const poleM = W.mat({ color: 0xffd040, emissive: 0xffb820, emissiveIntensity: 0.35, roughness: 0.5 });
    for (const s of [1, -1]) { const a = s * 1.914, px = Math.sin(a) * (R + 0.3), pz = Math.cos(a) * (R + 0.3); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 13, 8), poleM); p.position.set(px, 6.5, pz); g.add(p); const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 8, 0.7), poleM); fin.position.set(px + Math.sin(a) * 0.4, 8.5, pz + Math.cos(a) * 0.4); fin.rotation.y = a + PI / 2; g.add(fin); }
    const apron = new THREE.Mesh(new THREE.RingGeometry(R + 0.5, R + 12, 48, 1, -0.62 - PI / 2, 1.24), W.mat({ color: 0x5a3a2c, roughness: 0.9, emissive: 0x120a06 })); apron.rotation.x = -PI / 2; apron.position.y = 0.02; g.add(apron);
    { const roofM = W.mat({ color: 0x141c18, roughness: 0.8 }), backM = W.mat({ color: 0x14161a, roughness: 0.9 });
      for (const sx of [-1, 1]) { const ph = sx * 0.42, d = R + 4.1, dg = new THREE.Group(); dg.position.set(Math.sin(ph) * d, 0, Math.cos(ph) * d); dg.rotation.y = ph + PI; g.add(dg);
        const rf = new THREE.Mesh(new THREE.BoxGeometry(7, 0.16, 3.2), roofM); rf.position.y = 1.3; dg.add(rf); const edge = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.07, 0.08), W.mat({ color: 0x3a5446, roughness: 0.6 })); edge.position.set(0, 1.39, 1.62); dg.add(edge); const fas = new THREE.Mesh(new THREE.BoxGeometry(7, 0.32, 0.1), backM); fas.position.set(0, 1.12, 1.58); dg.add(fas);
        for (const px of [-3.4, 0, 3.4]) { const po = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), backM); po.position.set(px, 0.5, 1.5); dg.add(po); }
        for (let i = 1; i < 5; i++) { const sm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 3.2), backM); sm.position.set(-3.5 + i * 1.4, 1.395, 0); dg.add(sm); } const bk = new THREE.Mesh(new THREE.BoxGeometry(7, 1.3, 0.2), backM); bk.position.set(0, 0.65, -1.5); dg.add(bk);
        const rl = new THREE.Mesh(new THREE.BoxGeometry(7, 0.05, 0.05), W.mat({ color: 0x9aa0aa, roughness: 0.5, metalness: 0.5 })); rl.position.set(0, 0.9, 1.6); dg.add(rl); } }
    // the bowl
    const lowP = [[R + 1.8, 0], [R + 1.8, LO.y], [LO.r, LO.y]]; for (let j = 0; j < LO.n; j++) { const r0 = LO.r + j * LO.dr, y0 = LO.y + (j + 1) * LO.dy; lowP.push([r0, y0], [r0 + LO.dr, y0]); }
    const loTop = LO.r + LO.n * LO.dr; lowP.push([loTop, UP.y], [UP.r, UP.y]); for (let j = 0; j < UP.n; j++) { const r0 = UP.r + j * UP.dr, y0 = UP.y + (j + 1) * UP.dy; lowP.push([r0, y0], [r0 + UP.dr, y0]); }
    const upTop = UP.r + UP.n * UP.dr, upY = UP.y + UP.n * UP.dy; lowP.push([upTop, 12.7], [upTop + 0.4, 12.7], [upTop + 0.4, 0]);
    const stTex = (() => { const n = lowP.length - 1, H = n * 8, c = cvs(32, H), x = c.getContext('2d'); for (let j = 0; j < n; j++) { const y0 = (1 - (j + 1) / n) * H, [ax, ay] = lowP[j], [bx, by] = lowP[j + 1];
        if (Math.abs(by - ay) > Math.abs(bx - ax)) { const gq = x.createLinearGradient(0, y0 + 8, 0, y0); gq.addColorStop(0, '#22252c'); gq.addColorStop(1, '#3e434e'); x.fillStyle = gq; x.fillRect(0, y0, 32, 8); }
        else { x.fillStyle = '#353943'; x.fillRect(0, y0, 32, 8); x.fillStyle = '#1e2640'; x.fillRect(0, y0 + 2, 32, 4); x.fillStyle = '#12182a'; x.fillRect(0, y0 + 2, 3, 4); x.fillStyle = '#8a909c'; x.fillRect(0, y0 + 7, 32, 1); } }
      const t = ctex(c); t.wrapS = THREE.RepeatWrapping; t.repeat.x = 130; t.anisotropy = 4; return t; })();
    const standM = W.mat({ color: 0xffffff, map: stTex, roughness: 0.92, emissive: 0x14161e, emissiveIntensity: 1, side: THREE.DoubleSide }), railM = W.mat({ color: 0x9aa0aa, roughness: 0.5, metalness: 0.5 }), roofM = W.mat({ color: 0x15181e, roughness: 0.8, metalness: 0.3, side: THREE.DoubleSide }), fasM = W.mat({ color: 0x101218, roughness: 0.9, side: THREE.DoubleSide });
    S.ribM = new THREE.ShaderMaterial({ uniforms: { uT: S.uT, uA: { value: new THREE.Color(0xffc040) }, uB: { value: new THREE.Color(0xff3020) }, uK: { value: 1 } }, vertexShader: VS_UV, side: THREE.DoubleSide,
      fragmentShader: 'uniform float uT,uK; uniform vec3 uA,uB; varying vec2 vUv; void main(){ float x=vUv.x*90.0-uT*1.5; float blk=floor(x); float h=fract(sin(blk*12.9898)*43758.5453); float f=fract(x); float e=smoothstep(0.0,0.04,f)*smoothstep(1.0,0.96,f); float bar=step(0.25,vUv.y)*step(vUv.y,0.75); float dots=step(0.5,fract(x*6.0))*step(0.3,fract(vUv.y*4.0)); vec3 c=mix(uA,uB,step(0.5,h))*(0.35+0.65*mix(bar,dots,step(0.7,h)))*e*uK; gl_FragColor=vec4(max(c,vec3(0.0)),1.0); }' });
    S.doorM = W.glow(0xffb060, 0.55); const doors = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 1.3), S.doorM, 24); let nd = 0;
    const aisleM = W.mat({ color: 0x4a4f5a, roughness: 0.9 }), aisles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.08, 1), aisleM, 64); let na = 0; const aisleA = [];
    for (const [a0, a1] of ARCS) {
      g.add(new THREE.Mesh(new THREE.LatheGeometry(lowP.map(([x, y]) => new THREE.Vector2(x, y)), 72, a0, a1 - a0), standM));
      g.add(new THREE.Mesh(new THREE.LatheGeometry([[upTop + 0.4, 12.7], [upTop + 0.6, 13.5], [R + 9.2, 13.2], [R + 9.2, 12.95], [upTop + 0.4, 12.7]].map(([x, y]) => new THREE.Vector2(x, y)), 72, a0, a1 - a0), roofM));
      const fas = new THREE.Mesh(new THREE.CylinderGeometry(loTop - 0.02, loTop - 0.02, UP.y - (LO.y + LO.n * LO.dy), 72, 1, true, a0, a1 - a0), fasM); fas.position.y = (UP.y + LO.y + LO.n * LO.dy) / 2; g.add(fas);
      for (const [rr, yy] of [[R + 2.0, LO.y + 0.9], [UP.r - 0.1, UP.y + 0.85]]) { const rl = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.06, 96, 1, true, a0, a1 - a0), railM); rl.position.y = yy; g.add(rl); }
      { const sm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, LO.y, 0.04), railM, 40); let ns = 0; for (let ph = a0 + 0.06; ph < a1 && ns < 40; ph += 0.12) { _m.position.set(Math.sin(ph) * (R + 1.77), LO.y / 2, Math.cos(ph) * (R + 1.77)); _m.rotation.set(0, ph, 0); _m.scale.set(1, 1, 1); _m.updateMatrix(); sm.setMatrixAt(ns++, _m.matrix); } sm.count = ns; g.add(sm);
        const cp = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.78, R + 1.78, 0.1, 96, 1, true, a0, a1 - a0), railM); cp.position.y = LO.y - 0.05; g.add(cp); }
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(loTop - 0.06, loTop - 0.06, 0.62, 72, 1, true, a0, a1 - a0), S.ribM); rib.position.y = UP.y - 0.55; g.add(rib);
      for (let k = 0; k < 8; k++) { const ph = a0 + (k + 0.5) / 8 * (a1 - a0); aisleA.push(ph);
        for (const D of [LO, UP]) { const r0 = D.r, r1 = D.r + D.n * D.dr, y0 = D.y, y1 = D.y + D.n * D.dy, len = Math.hypot(r1 - r0, y1 - y0), rm = (r0 + r1) / 2; _m.position.set(Math.sin(ph) * rm, (y0 + y1) / 2 + 0.22, Math.cos(ph) * rm); _m.rotation.set(-Math.atan2(y1 - y0, r1 - r0), ph, 0, 'YXZ'); _m.scale.set(1, 1, len); _m.updateMatrix(); aisles.setMatrixAt(na++, _m.matrix); }
        if (k % 3 !== 1) { _m.position.set(Math.sin(ph) * (upTop - 0.05), upY + 0.9, Math.cos(ph) * (upTop - 0.05)); _m.rotation.set(0, ph + PI, 0); _m.scale.set(1, 1, 1); _m.updateMatrix(); doors.setMatrixAt(nd++, _m.matrix); } }
    }
    aisles.count = na; doors.count = nd; g.add(aisles); g.add(doors);
    // the crowd: thousands of small figures in rows, dim warm and cool, with camera flashes; phone lights in the last innings
    S.crowdM = new THREE.ShaderMaterial({ uniforms: { uT: S.uT, uCheer: { value: 0 }, uBright: { value: 0.6 }, uPhone: { value: 0 }, uFlash: { value: 1 }, uPhoneC: { value: new THREE.Color(0x9affd8) } },
      vertexShader: `uniform float uT,uCheer; varying vec3 vC; varying float vH; varying float vY; varying float vAz; varying vec3 vP; varying vec3 vNo;
        void main(){ vP=position; vNo=normal; vec3 o=(instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz; float h=fract(sin(dot(o.xz,vec2(12.9898,78.233)))*43758.5453); vec4 wp=instanceMatrix*vec4(position,1.0);
          wp.y+=abs(sin(uT*(2.5+uCheer*5.0)+h*6.283))*(0.04+uCheer*0.3); vC=instanceColor; vH=h; vY=position.y; vAz=atan(o.x,o.z); gl_Position=projectionMatrix*modelViewMatrix*wp; }`,
      fragmentShader: `uniform float uT,uBright,uPhone,uFlash; uniform vec3 uPhoneC; varying vec3 vC; varying float vH; varying float vY; varying float vAz; varying vec3 vP; varying vec3 vNo;
        void main(){ float tw=step(0.986,fract(vH*91.7))*pow(max(sin(uT*2.3+vH*400.0),0.0),60.0)*uFlash; float wave=smoothstep(0.6,1.0,sin(vAz*3.0-uT*1.7));
          float ph=uPhone*step(0.72,fract(vH*37.3))*(0.3+0.7*wave)*step(0.5,vNo.z)*step(0.3,vP.y)*step(abs(vP.x),0.05); vec3 c=min(vC*uBright*(0.55+0.45*smoothstep(-0.2,0.3,vY)),vec3(0.6))+vec3(1.6)*tw*step(0.24,vY)+uPhoneC*ph*1.8; gl_FragColor=vec4(max(c,vec3(0.0)),1.0); }` });
    const boxes = (L) => { const parts = L.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed()), o = new THREE.BufferGeometry();
      for (const k of ['position', 'normal']) { const n = parts.reduce((a, p) => a + p.attributes[k].array.length, 0), C = new Float32Array(n); let off = 0; for (const p of parts) { C.set(p.attributes[k].array, off); off += p.attributes[k].array.length; } o.setAttribute(k, new THREE.BufferAttribute(C, 3)); } return o; };
    const FIG = [[0.36, 0.2, 0.3, 0, -0.12, 0], [0.28, 0.24, 0.24, 0, 0.09, 0], [0.17, 0.18, 0.17, 0, 0.33, 0]], fig = boxes(FIG);
    const figA = boxes([...FIG, [0.08, 0.36, 0.08, 0.17, 0.42, 0]]);
    const crowds = [new THREE.InstancedMesh(fig, S.crowdM, 3000), new THREE.InstancedMesh(figA, S.crowdM, 600)], cn = [0, 0];
    const tones = [0x2c2c32, 0x34302c, 0x262a3a, 0x3c2e2a, 0x2e3a34, 0x423c36, 0x303036], acc = [0x1c2c70, 0x9a2020, 0xd8d8d0, 0xd09040, 0x2a6a9a];
    for (const [a0, a1] of ARCS) for (const D of [LO, UP]) for (let j = 0; j < D.n; j++) { const rr = D.r + j * D.dr + D.dr * 0.5, yy = D.y + (j + 1) * D.dy + 0.27, st = 0.5 / rr;
      for (let ph = a0 + st; ph < a1 - st; ph += st) { if (vr() > 0.86 || aisleA.some((q) => Math.abs(q - ph) < 0.5 / rr)) continue; const p2 = ph + (vr() - 0.5) * st * 0.3;
        _m.position.set(Math.sin(p2) * rr, yy, Math.cos(p2) * rr); _m.rotation.set(0, p2 + PI, 0); const s = 0.85 + vr() * 0.3; _m.scale.set(s, s * (0.9 + vr() * 0.25), s); _m.updateMatrix(); const ci = vr() < 0.14 ? 1 : 0, cr = crowds[ci]; if (cn[ci] >= cr.instanceMatrix.count) continue; cr.setMatrixAt(cn[ci], _m.matrix);
        cr.setColorAt(cn[ci], _c.setHex(vr() < 0.26 ? acc[Math.floor(vr() * acc.length)] : tones[Math.floor(vr() * tones.length)]).lerp(_c2.setHex(GHOST), 0.08).multiplyScalar(0.7 + vr() * 0.6)); cn[ci]++; } }
    crowds.forEach((cr, i) => { cr.count = cn[i]; cr.frustumCulled = false; cr.instanceMatrix.needsUpdate = true; cr.instanceColor.needsUpdate = true; g.add(cr); });
    // light banks hung from the roof canopy: lamps, a halo, and a shaft through the haze
    const bankM = W.mat({ color: 0x1c2028, roughness: 0.5, metalness: 0.5 }), halo = haloTexture(), shaftG = new THREE.CylinderGeometry(1.3, 5.2, 1, 20, 1, true), star = (() => { const c = cvs(64, 64), x = c.getContext('2d'), g0 = x.createRadialGradient(32, 32, 0, 32, 32, 14); g0.addColorStop(0, 'rgba(255,255,255,1)'); g0.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g0.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g0; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(4, 31, 56, 2); x.fillRect(31, 4, 2, 56); return ctex(c); })(), lensM = W.mat({ color: 0x3a3a36, roughness: 0.3, metalness: 0.2 });
    S.banks = BANKS.map((a) => { const x = Math.sin(a) * (R + 9.3), z = Math.cos(a) * (R + 9.3), y = 12.0;
      const bank = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.0, 0.5), bankM); bank.position.set(x, y, z); bank.lookAt(0, 0, 0); g.add(bank);
      for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), bankM); st.position.set(sx * 2.6, 2.0, -0.1); bank.add(st); }
      const lampM = new THREE.MeshBasicMaterial({ map: star, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), lamps = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.0, 1.0), lampM, 15), lens = new THREE.InstancedMesh(new THREE.CircleGeometry(0.36, 12), lensM, 15);
      for (let i = 0; i < 15; i++) { _m.position.set(-2.4 + (i % 5) * 1.2, -0.95 + Math.floor(i / 5) * 0.95, 0.27); _m.rotation.set(0, 0, 0); _m.scale.set(1, 1, 1); _m.updateMatrix(); lens.setMatrixAt(i, _m.matrix); _m.position.z = 0.3; _m.updateMatrix(); lamps.setMatrixAt(i, _m.matrix); } bank.add(lens); bank.add(lamps);
      const haloM = new THREE.SpriteMaterial({ map: halo, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }), hs = new THREE.Sprite(haloM); hs.position.set(0, 0, 0.9); hs.scale.set(8, 5.5, 1); bank.add(hs);
      const tx = x * 0.3, tz = z * 0.3, ty = 0, L = Math.hypot(x - tx, y - ty, z - tz), shM = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0xfff1d8) }, uA: { value: 0.07 } },
        vertexShader: 'varying float vY; varying float vE; void main(){ vY=uv.y; vec4 mv=modelViewMatrix*vec4(position,1.0); vec3 n=normalMatrix*normal; vec3 v=-mv.xyz; vE=abs(dot(n/max(length(n),1e-4),v/max(length(v),1e-4))); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uA; varying float vY; varying float vE; void main(){ float a=uA*pow(clamp(vE,0.0,1.0),2.0)*smoothstep(0.0,0.18,vY)*(0.45+0.55*vY); gl_FragColor=vec4(uC*a,a); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const sh = new THREE.Mesh(shaftG, shM); sh.scale.set(1, L, 1); sh.position.set((x + tx) / 2, (y + ty) / 2, (z + tz) / 2); sh.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(x - tx, y - ty, z - tz).normalize()); sh.renderOrder = 3; g.add(sh);
      const poolM = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0xfff1d8) }, uA: { value: 0 } }, vertexShader: VS_UV, fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float d=length(vUv-0.5)*2.0; float a=uA*pow(max(1.0-d,0.0),1.6); gl_FragColor=vec4(uC*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 15), poolM); pool.rotation.set(-PI / 2, 0, a + PI); pool.position.set(tx, 0.03, tz); pool.renderOrder = 2; g.add(pool);
      const rfM = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0xdce4ff) }, uA: { value: 0 }, uT: S.uT }, vertexShader: VS_UV, fragmentShader: 'uniform vec3 uC; uniform float uA,uT; varying vec2 vUv; void main(){ float ac=(vUv.x-0.5)*2.0; float al=smoothstep(1.0,0.82,vUv.y)*pow(clamp(vUv.y,0.0,1.0),1.4); float rp=0.85+0.15*sin(vUv.y*9.0+uT*3.0)*sin(uT*5.3+vUv.x*3.0); float a=uA*exp(-ac*ac*4.0)*al*rp; gl_FragColor=vec4(uC*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const rf = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 8).rotateX(-PI / 2), rfM); rf.position.y = 0.035; rf.renderOrder = 2; rf.visible = false; g.add(rf);
      return { lampM, haloM, shM, poolM, rf, rfM, x, y, z, on: true }; });
    S.infM = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0xfff0d8) }, uA: { value: 0 } }, vertexShader: VS_UV, fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ vec2 q=(vUv-0.5)*2.0; float d=length(q); float a=uA*pow(max(1.0-d,0.0),1.3); gl_FragColor=vec4(uC*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    { const ip = new THREE.Mesh(new THREE.PlaneGeometry(34, 32), S.infM); ip.rotation.x = -PI / 2; ip.position.set(0, 0.028, 4); ip.renderOrder = 2; g.add(ip); }
    // warm haze in front of the upper deck
    { const hz = new THREE.Mesh(new THREE.CylinderGeometry(R + 6.5, R + 6.5, 5, 96, 1, true), new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0xffe0b0) } }, vertexShader: VS_UV, fragmentShader: 'uniform vec3 uC; varying vec2 vUv; void main(){ float a=0.05*sin(clamp(vUv.y,0.0,1.0)*3.14159); gl_FragColor=vec4(uC*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); hz.position.y = 9; hz.renderOrder = 3; g.add(hz); S.hazeM = hz.material; }
    // the scoreboard in the centre-field gap, ringed with chasing bulbs
    const cv = cvs(1024, 512); S.boardX = cv.getContext('2d'); S.boardTmp = cvs(1024, 512).getContext('2d'); S.boardL = cvs(1024, 512).getContext('2d');
    { const dm = cvs(1024, 512), db = cvs(1024, 512), a = dm.getContext('2d'), c = db.getContext('2d'); c.fillStyle = '#0c261a'; c.fillRect(0, 0, 1024, 512); a.beginPath(); c.beginPath();
      for (let cy = 3; cy < 512; cy += 6) for (let cx = 3; cx < 1024; cx += 6) { a.moveTo(cx + 2.8, cy); a.arc(cx, cy, 2.8, 0, TAU); c.moveTo(cx + 1.9, cy); c.arc(cx, cy, 1.9, 0, TAU); } a.fillStyle = '#fff'; a.fill(); c.fillStyle = '#153325'; c.fill(); S.dotMask = dm; S.dotBase = db; } S.boardT = ctex(cv);
    S.boardM = new THREE.MeshBasicMaterial({ map: S.boardT, color: new THREE.Color(0xffffff).multiplyScalar(1.25) });
    const BZ = -(R + 7.4), BY = 8.9; const board = new THREE.Mesh(new THREE.PlaneGeometry(17, 8.5), S.boardM); board.position.set(0, BY, BZ); g.add(board); S.board = board;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(18.6, 10.1, 0.9), bankM); frame.position.set(0, BY, BZ - 0.5); g.add(frame);
    for (const sx of [-1, 1]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.9, BY - 5, 0.9), bankM); lg.position.set(sx * 6, (BY - 5) / 2, BZ - 0.6); g.add(lg); const br = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.4, 0.3), bankM); br.position.set(sx * 3, (BY - 5) / 2, BZ - 0.7); br.rotation.z = sx * 1.0; g.add(br); }
    { const c = cvs(64, 64), x = c.getContext('2d'), g0 = x.createRadialGradient(32, 10, 0, 32, 10, 54); g0.addColorStop(0, 'rgba(255,190,90,0.9)'); g0.addColorStop(1, 'rgba(255,190,90,0)'); x.fillStyle = g0; x.fillRect(0, 0, 64, 64);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(22, 7), new THREE.MeshBasicMaterial({ map: ctex(c), color: new THREE.Color(0xffb060).multiplyScalar(0.35), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.set(0, BY - 7.2, BZ + 0.8); g.add(gl); }
    S.bulbM = new THREE.ShaderMaterial({ uniforms: { uT: S.uT, uC: { value: new THREE.Color(0xffd890) } }, vertexShader: 'varying float vP; void main(){ vec3 o=(instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz; vP=o.x*0.9+o.y*0.9; gl_Position=projectionMatrix*modelViewMatrix*(instanceMatrix*vec4(position,1.0)); }',
      fragmentShader: 'uniform float uT; uniform vec3 uC; varying float vP; void main(){ float k=step(0.5,fract((vP-uT*5.0)/3.0)); gl_FragColor=vec4(uC*(0.25+2.6*k),1.0); }' });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 6, 4), S.bulbM, 100); let nb = 0;
    for (let i = 0; i <= 30; i++) for (const sy of [-1, 1]) { _m.position.set(-9 + i * 0.6, BY + sy * 4.75, BZ + 0.1); _m.rotation.set(0, 0, 0); _m.scale.set(1, 1, 1); _m.updateMatrix(); bulbs.setMatrixAt(nb++, _m.matrix); }
    for (let i = 1; i < 16; i++) for (const sx of [-1, 1]) { _m.position.set(sx * 9, BY - 4.75 + i * 0.594, BZ + 0.1); _m.updateMatrix(); bulbs.setMatrixAt(nb++, _m.matrix); }
    bulbs.count = nb; g.add(bulbs);
    // the city past the outfield
    const city = new THREE.Mesh(new THREE.CylinderGeometry(170, 170, 60, 64, 1, true), new THREE.MeshBasicMaterial({ map: skylineTexture(), transparent: true, depthWrite: false, fog: false, side: THREE.BackSide })); city.position.y = 28; city.renderOrder = -50; g.add(city);
    S.aurM = new THREE.ShaderMaterial({ uniforms: { uT: S.uT, uA: { value: 0 } }, vertexShader: VS_UV, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      fragmentShader: 'uniform float uT,uA; varying vec2 vUv; void main(){ float x=vUv.x*TAU_*6.0+uT*0.03; float y0=0.16+sin(x*0.6)*0.05+sin(x*1.7+1.3)*0.025; float h=0.3+0.14*sin(x*0.9+2.0)+0.07*sin(x*2.3); float q=vUv.y-y0; float base=smoothstep(-0.015,0.02,q); float up=exp(-max(q,0.0)/max(h,0.05)*2.2); float st=0.62+0.22*sin(x*48.0+sin(x*6.0)*2.0)+0.16*sin(x*131.0-uT*0.4); float lv=0.75+0.25*sin(x*0.8+uT*0.04); vec3 c=mix(vec3(0.25,1.0,0.62),vec3(0.55,0.32,1.0),clamp(q/max(h,0.05),0.0,1.0)); float a=uA*0.5*base*up*st*lv*smoothstep(1.0,0.8,vUv.y); gl_FragColor=vec4(c*a,a); }'.replace('TAU_', '6.2832') });
    const aur = new THREE.Mesh(new THREE.CylinderGeometry(178, 178, 50, 96, 1, true), S.aurM); aur.position.y = 36; aur.renderOrder = -60; g.add(aur);
    { const n = 2600, pos = new Float32Array(n * 6), sd = new Float32Array(n * 2), en = new Float32Array(n * 2), q = mulberry(31); for (let i = 0; i < n; i++) { const px = q() * 60, py = q() * 30, pz = q() * 60, k = q(); for (let e = 0; e < 2; e++) { pos.set([px, py, pz], i * 6 + e * 3); sd[i * 2 + e] = k; en[i * 2 + e] = e; } }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); rg.setAttribute('aS', new THREE.BufferAttribute(sd, 1)); rg.setAttribute('aE', new THREE.BufferAttribute(en, 1));
      S.rainM = new THREE.ShaderMaterial({ uniforms: { uT: S.uT, uCen: { value: new V3(0, 14, 0) }, uA: { value: 0.5 }, uC: { value: new THREE.Color(0xc8d8ff) } },
        vertexShader: 'uniform float uT; uniform vec3 uCen; attribute float aS; attribute float aE; varying float vA; void main(){ vec3 B=vec3(60.0,30.0,60.0), V=vec3(8.0,-30.0,2.5); vec3 p=position+V*uT*(0.85+aS*0.3); p=mod(p,B)-B*0.5+uCen; p-=normalize(V)*aE*(1.2+aS*1.2); vA=(1.0-aE*0.7)*(0.55+0.9*smoothstep(4.0,14.0,p.y)); vec4 mv=modelViewMatrix*vec4(p,1.0); vA*=smoothstep(1.0,5.0,-mv.z); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uA; varying float vA; void main(){ float a=clamp(uA*vA,0.0,1.0); gl_FragColor=vec4(uC*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      S.rain = new THREE.LineSegments(rg, S.rainM); S.rain.frustumCulled = false; S.rain.renderOrder = 14; S.rain.visible = false; g.add(S.rain);
      S.mistM = new THREE.ShaderMaterial({ uniforms: { uT: S.uT, uA: { value: 0 }, uC: { value: new THREE.Color(0xa8b8d4) } }, vertexShader: VS_UV, side: THREE.DoubleSide, transparent: true, depthWrite: false,
        fragmentShader: 'uniform float uT,uA; uniform vec3 uC; varying vec2 vUv; void main(){ float x=vUv.x*60.0; float n=0.5+0.25*sin(x*1.3+uT*0.7)+0.15*sin(x*3.1-uT*1.1+vUv.y*4.0)+0.1*sin(x*7.0+uT*0.4); float a=uA*pow(clamp(1.0-vUv.y,0.0,1.0),1.6)*clamp(n,0.0,1.0); gl_FragColor=vec4(uC,a); }' });
      const mist = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 2.8, 128, 1, true), S.mistM); mist.position.y = 1.4; mist.renderOrder = 4; g.add(mist); }
    S.wisps = W.motes({ n: 420, box: [60, 14, 60], color: 0x80ffc0, size: 0.26, vel: [0.1, 0.6, 0.1], sway: 0.9, center: [0, 7, 0], alpha: 0.7 }); S.wisps.visible = false; g.add(S.wisps);
    { const max = 40, geo = new THREE.BufferGeometry(), uv = new Float32Array(max * 8), idx = []; for (let i = 0; i < max; i++) { uv.set([0, 0, 1, 0, 0, 1, 1, 1], i * 8); const o = i * 4; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 12), 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 } }, vertexShader: VS_UV, fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float d=abs(vUv.x-0.5)*2.0; float a=uA*(exp(-d*d*8.0)*0.7+exp(-d*d*60.0)*1.6); gl_FragColor=vec4(vec3(0.85,0.82,1.0)*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.frustumCulled = false; m.visible = false; m.renderOrder = -40; g.add(m); S.bolt = { geo, m, max }; }
    S.rise = W.motes({ n: 480, box: [14, 6, 14], color: 0x70ffb0, size: 0.22, vel: [0, 1.3, 0], sway: 0.4, center: [0, 3, 0], alpha: 0.8 }); S.rise.visible = false; g.add(S.rise);
    // soft billowing dust puffs (own sprites; the shared smoke reads as hard discs)
    { const c = cvs(64, 64), x = c.getContext('2d'), q = mulberry(9); for (let i = 0; i < 9; i++) { const px = 26 + q() * 12, py = 26 + q() * 12, g0 = x.createRadialGradient(px, py, 0, px, py, 10 + q() * 8); g0.addColorStop(0, 'rgba(255,255,255,0.5)'); g0.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g0; x.fillRect(0, 0, 64, 64); }
      x.globalCompositeOperation = 'destination-in'; const mk = x.createRadialGradient(32, 32, 0, 32, 32, 31); mk.addColorStop(0, 'rgba(0,0,0,1)'); mk.addColorStop(0.7, 'rgba(0,0,0,0.8)'); mk.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = mk; x.fillRect(0, 0, 64, 64); const dt0 = ctex(c);
      S.puffs = Array.from({ length: 18 }, () => { const m = new THREE.SpriteMaterial({ map: dt0, color: 0xc8b090, transparent: true, depthWrite: false, opacity: 0 }), sp = new THREE.Sprite(m); sp.visible = false; g.add(sp); return { sp, m, t: 1, life: 1, v: new V3(), s0: 1, s1: 2 }; }); S.puffI = 0; }
    // balls (one for the pitch, one decoy, three for flies and grounders), each with a seam-spun shader and a trail
    S.ballM = [0, 1, 2, 3, 4].map(() => ballMat(0xffffff, S.uT)); S.ballM.forEach((m) => m.color.multiplyScalar(3));
    S.balls = S.ballM.map((m) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), m); o.visible = false; g.add(o); return { o, m, mode: 0, t: 0 }; });
    S.trails = S.balls.map(() => mkTrail(g, 20));
    // strike zone over the plate and the bat that appears in your hands
    S.zoneM = new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(1.4), transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const zm = new THREE.Group(); const zb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.9), S.zoneM); zb.position.y = 1.15; zm.add(zb); const ze = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.1, 1.3, 0.9)), new THREE.LineBasicMaterial({ color: GOLD })); ze.position.y = 1.15; zm.add(ze); zm.visible = false; S.zoneG = zm;
    S.bat = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.04, 1.5, 8), W.glow(GOLD, 2.2)); S.bat.visible = false; g.add(S.bat);
    S.boxM = new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(1.2), transparent: true, opacity: 0, depthWrite: false }); for (const q of BOX) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4), S.boxM); m.rotation.x = -PI / 2; m.position.set(q.x, 0.04, q.z); g.add(m); }
    // fielders for the later innings: spectral, see-through, no shadow
    const ghostM = spectral(new THREE.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.6, emissive: GHOST, emissiveIntensity: 0.35, transparent: true, opacity: 0.9, depthWrite: false }), S.specRim, S.uT);
    S.fielders = [0, 1].map(() => { const f = ghostMan(1.9, ghostM, false); f.g.visible = false; g.add(f.g); return f; });
    // ---- the Closer: a road-grey pinstriped uniform worn by a ghost ----
    const pin = (() => { const c = cvs(128, 16), x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 16); x.fillStyle = '#2a3456'; for (let i = 0; i < 8; i++) x.fillRect(i * 16 + 7, 0, 2, 16); const t = ctex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); return t; })();
    const num = (() => { const c = cvs(256, 128), x = c.getContext('2d'); x.font = 'bold 118px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 16; x.strokeStyle = '#ece6d4'; x.strokeText('09', 128, 68); x.fillStyle = '#0e1636'; x.fillText('09', 128, 68); return ctex(c); })();
    const chest = (() => { const c = cvs(256, 64), x = c.getContext('2d'); x.strokeStyle = '#ffffff'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(30, 44); x.bezierCurveTo(80, 10, 150, 52, 226, 18); x.stroke(); x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(128, 8); x.lineTo(146, 30); x.lineTo(128, 52); x.lineTo(110, 30); x.closePath(); x.fill(); return ctex(c); })();
    const wood = (() => { const c = cvs(64, 256), x = c.getContext('2d'), q = mulberry(4); x.fillStyle = '#c8a070'; x.fillRect(0, 0, 64, 256); for (let i = 0; i < 40; i++) { x.fillStyle = q() < 0.5 ? 'rgba(90,50,20,0.25)' : 'rgba(255,230,180,0.15)'; x.fillRect(q() * 64, 0, 1 + q() * 2, 256); } return ctex(c); })();
    const stripe = (() => { const c = cvs(64, 8), x = c.getContext('2d'), g0 = x.createLinearGradient(0, 0, 64, 0); g0.addColorStop(0, '#000'); g0.addColorStop(0.4, '#000'); g0.addColorStop(0.47, '#fff'); g0.addColorStop(0.53, '#fff'); g0.addColorStop(0.6, '#000'); g0.addColorStop(1, '#000'); x.fillStyle = g0; x.fillRect(0, 0, 64, 8); return ctex(c); })();
    S.barrelRim = new THREE.Color(GOLD);
    const K = S.K = {
      jersey: rimify(new THREE.MeshStandardMaterial({ color: 0xb8c2d0, map: pin, roughness: 0.75, emissive: GHOST, emissiveIntensity: 0.04 }), S.rimC),
      trim: new THREE.MeshStandardMaterial({ color: 0x1a2450, roughness: 0.6, emissive: 0xffc860, emissiveIntensity: 0.15 }), under: W.mat({ color: 0x1a2240, roughness: 0.85 }), sock: W.mat({ color: 0x141c38, roughness: 0.85 }),
      cleat: W.mat({ color: 0x0c0c10, roughness: 0.45 }), cap: W.mat({ color: 0x121a34, roughness: 0.8 }), belt: new THREE.MeshStandardMaterial({ color: 0x161c34, roughness: 0.5, emissive: 0x7fd8ff, emissiveIntensity: 0 }),
      skin: rimify(new THREE.MeshStandardMaterial({ color: 0x8ea4bc, roughness: 0.6, emissive: GHOST, emissiveIntensity: 0.1 }), S.rimC, 2.0),
      glove: W.mat({ color: 0x7a4824, roughness: 0.7 }), web: W.mat({ color: 0x3a2210, roughness: 0.8 }), wood: W.mat({ color: 0xffffff, map: wood, roughness: 0.5 }), lace: W.mat({ color: 0xc89a60, roughness: 0.8 }), sole: W.mat({ color: 0x8a8c92, roughness: 0.6 }),
      stripe: new THREE.MeshStandardMaterial({ color: 0xe8eef8, roughness: 0.7, emissive: 0x7fd8ff, emissiveIntensity: 0 }),
      glowLine: W.glow(0xffc860, 0.3), hair: W.mat({ color: 0x1a1612, roughness: 0.9 }),
      face: faceify(new THREE.MeshStandardMaterial({ color: 0x8ea4bc, roughness: 0.6, emissive: GHOST, emissiveIntensity: 0.1 }), S.rimC), tape: W.mat({ color: 0x1e1e22, roughness: 0.9 }),
      barrel: rimify(new THREE.MeshStandardMaterial({ color: 0xffffff, map: wood, roughness: 0.45, emissive: GOLD, emissiveMap: stripe, emissiveIntensity: 1.6 }), S.barrelRim, 1.6), emblem: W.glow(GOLD, 2.4), eye: W.glow(GHOST, 5),
      number: new THREE.MeshStandardMaterial({ map: num, transparent: true, alphaTest: 0.3, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
      chest: new THREE.MeshBasicMaterial({ map: chest, color: new THREE.Color(GOLD).multiplyScalar(1.3), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
    K.pants = K.jersey; S.M = ghostMan(2.75, K, true); b.group.add(S.M.g); S.M.g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    S.bossMats = [...new Set(Object.values(K))]; for (const m of S.bossMats) { m.transparent = true; m.userData.baseOp = m.opacity; }
    // soft contact shadow so he stands on the dirt
    const cs = cvs(64, 64), cx = cs.getContext('2d'), cg = cx.createRadialGradient(32, 32, 0, 32, 32, 32); cg.addColorStop(0, 'rgba(0,0,0,0.6)'); cg.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = cg; cx.fillRect(0, 0, 64, 64);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: ctex(cs), transparent: true, depthWrite: false })); blob.rotation.x = -PI / 2; blob.position.y = 0.03; blob.renderOrder = 1; b.group.add(blob);
    // afterimages that trail the throwing arm once the game turns
    const armG = new THREE.CapsuleGeometry(0.1, 0.62, 3, 8); armG.translate(0, -0.38, 0);
    S.after = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(armG, new THREE.MeshBasicMaterial({ color: new THREE.Color(GHOST), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.matrixAutoUpdate = false; m.visible = false; m.frustumCulled = false; g.add(m); return m; });
    S.armHist = Array.from({ length: 16 }, () => new THREE.Matrix4()); S.armI = 0;
    S.light = new THREE.PointLight(GHOST, 10, 18, 1.7); S.light.position.set(0, 5.5, -3.2); b.group.add(S.light);
    Object.assign(S, { half: 'top', inning: 1, guest: 0, homeRuns: 0, strikes: 0, outs: 0, guestHalf: 0, rally: 0, pitch: null, swingCd: 0, batK: 0, gap: 1, lvl: 0, look: 0, lookT: 0, wind: 0, throwK: 0, swingK: 0, batUp: 0, fly: [], cheer: 0, flash: 0, runners: [], gr: [], fpos: [{ x: 0, z: -6 }, { x: 9, z: -2 }], strikeFx: 0, lsG: {}, lsH: {}, _g: 0, _h: 0, ghostK: 0 });
    S.zone = b.spawnAdd({ name: 'Strike Zone', hp: 1e7, x: HOME.x, z: HOME.z, radius: 1.2, aimY: 1.15, mesh: zm, targetable: false, onDamaged() { swing(b); } });
    S.zone.targetable = false; drawBoard(S);
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 17.2 }, bossStart: { x: 0, z: 9.6, face: 0 }, camDist: 15,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
      // stay out of the stands; behind home plate there are none, so the camera may back off there
      camLimit(x, y, z) { const d = Math.hypot(x, z), lim = lerp(R + 1.4, R + 14, smooth(sat((0.6 - Math.abs(Math.atan2(x, z))) / 0.25))); if (d > lim) { x *= lim / d; z *= lim / d; } return { x, y: Math.max(y, 0.5), z }; },
    };
  }

  // ---- keeping score ----
  const tally = (S) => { const i = S.inning; if (S.guest > S._g) { S.lsG[i] = (S.lsG[i] || 0) + S.guest - S._g; S._g = S.guest; } if (S.homeRuns > S._h) { S.lsH[i] = (S.lsH[i] || 0) + S.homeRuns - S._h; S._h = S.homeRuns; } };
  const board = (b) => { tally(b.state); if (!G.headless) drawBoard(b.state); };
  function out(b, how) { const S = b.state; S.outs = Math.min(3, S.outs + 1); S.cheer = 1; Sound.sfx('uiok'); board(b); }
  function homeScores(b) { const S = b.state, p = G.player; S.homeRuns++; p.dmgTakenMul = 1 + 0.1 * Math.min(8, S.homeRuns); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.015); Sound.sfx('roar', 0.6, 1.4); FX.flash(RED, 0.2, 2); board(b); }
  function strike(b, P) {
    const S = b.state, p = G.player; if (P) P.done = true; S.strikes++; S.strikeFx = 1; Sound.sfx('interrupt', 0.7, 0.7); board(b);
    if (S.strikes >= 3) { S.strikes = 0; Sound.sfx('thunder', 0.9); FX.flash(0xffffff, 0.35, 3); FX.shake(0.8); if (!G.headless) FX.lightning(new V3(p.pos.x, 30, p.pos.z), new V3(p.pos.x, 0, p.pos.z), { color: 0xffffff, width: 0.4 }); p.hurt(350, { blockable: false, src: { name: 'Strikeout' } }); board(b); }
  }
  function fireworks(n = 5) { if (G.headless) return; for (let i = 0; i < n; i++) { const x = rnd(-22, 22), y = rnd(22, 34), z = -(R + rnd(2, 16)); FX.burst(x, y, z, { n: 70, color: pick([0xff5060, 0xffd040, 0x60c0ff, 0x80ff90, 0xff80e0]), color2: 0xffffff, speed: [6, 16], life: [0.8, 1.8], size: [0.3, 0.7], drag: 1.6 }); FX.light(x, y, z, 0xffffff, 60, 0.6, 60); } Sound.sfx('boom', 0.6, 1.6); Sound.sfx('shatter', 0.5, 0.8); }
  function hitBall(S, tx, ty, tz, dur) { const q = S.balls[0]; q.mode = 9; q.t = 0; q.dur = dur; q.from = q.o.position.clone(); q.to = new V3(tx, ty, tz); q.o.visible = true; }
  function resolve(b, P, d) {
    const S = b.state, ad = Math.abs(d), lane = d < 0 ? -1 : 1, HR = S.lvl >= 1 ? 0.05 : 0.07; P.done = true; Sound.sfx('parry', 1, 0.6); Sound.sfx('hit', 1, 1.4);
    if (!G.headless) { const q = S.balls[0].o.position; FX.burst(q.x, q.y, q.z, { n: 30, color: 0xffffff, color2: 0xfff0c0, speed: [4, 12], life: [0.15, 0.4], size: [0.12, 0.3] }); FX.light(q.x, q.y + 0.5, q.z, 0xfff0c0, 40, 0.25, 12); }
    if (ad <= HR) { S.guest++; S.guestHalf++; S.cheer = 1.6; hitBall(S, rnd(-6, 6), 30, -(R + 40), 1.6); fireworks(6); FX.shake(0.5); b.damage(600, { src: 'player', crit: true }); board(b); }
    else if (ad <= 0.17) {
      if (S.lvl >= 1 && lane !== S.gap) { const f = S.fpos[1]; hitBall(S, f.x, 2.2, f.z, 0.45); strike(b, P); return; }
      if (S.lvl >= 1) { S.guest++; S.guestHalf++; board(b); hitBall(S, lane * 12, 1, -9, 0.5); b.damage(400, { src: 'player' }); } else { hitBall(S, b.pos.x, 3, b.pos.z, 0.3); b.damage(300, { src: 'player' }); S.flinch = 1; }
      S.cheer = 1;
    } else hitBall(S, lane * 14, 12, 24, 0.7);
  }
  function swing(b) {
    const S = b.state, p = G.player; if (S.swingCd > 0 || S.half !== 'bot' || !p.alive || !inBox(p)) return; S.swingCd = 0.6; S.batK = 1;
    FX.slash(p.pos.x, 1.2, p.pos.z, PI, { r: 2.4, color: 0xfff2c0, dur: 0.2 }); Sound.sfx('slash', 0.8, 1.3);
    const P = S.pitch; if (!P || P.done || P.swung || !P.released) return; P.swung = true; const d = G.ft - P.tc;
    if (P.type === 'brush' || P.type === 'fire') { strike(b, P); return; }
    if (d < -0.28) return; // swung through air; it is called when the ball gets there
    resolve(b, P, d);
  }
  const ballS = (type, k) => type === 'split' ? (k < 0.42 ? k * 1.7 : 0.714 + (k - 0.42) * 0.493) : type === 'knuckle' ? k + 0.11 * Math.sin(k * TAU * 1.5) * (1 - k) : k;
  // a ball landing on the field: a puff of infield dirt, chalk sparks and a ghost-blue ring (no dark smoke)
  // a thin jagged forked bolt behind the stands: camera-facing ribbon rebuilt on each strike, faded by the flash
  function bolt(S, bx, bz) { const B = S.bolt, a = B.geo.attributes.position, c = camera.position, paths = [], main = [[bx, 58, bz]]; let px = bx, py = 58, pz = bz;
    while (py > 16) { py -= 2.5 + vrand() * 2.5; px += (vrand() - 0.5) * 5; pz += (vrand() - 0.5) * 5; main.push([px, Math.max(16, py), pz]); } paths.push([main, 1.3]);
    for (let k = 0; k < 2; k++) { const st = main[2 + Math.floor(vrand() * (main.length - 4))], br = [st]; let [qx, qy, qz] = st; const dx = (vrand() - 0.5) * 9; for (let i = 0; i < 5; i++) { qy -= 2 + vrand() * 2; qx += dx * 0.3 + (vrand() - 0.5) * 3; qz += (vrand() - 0.5) * 3; br.push([qx, qy, qz]); } paths.push([br, 0.65]); }
    let v = 0; for (const [P, w] of paths) for (let i = 0; i < P.length - 1 && v < B.max; i++, v++) { const [x0, y0, z0] = P[i], [x1, y1, z1] = P[i + 1]; _v.set(x1 - x0, y1 - y0, z1 - z0); _w.set((x0 + x1) / 2 - c.x, (y0 + y1) / 2 - c.y, (z0 + z1) / 2 - c.z); _v.cross(_w).normalize().multiplyScalar(w);
      a.setXYZ(v * 4, x0 - _v.x, y0 - _v.y, z0 - _v.z); a.setXYZ(v * 4 + 1, x0 + _v.x, y0 + _v.y, z0 + _v.z); a.setXYZ(v * 4 + 2, x1 - _v.x, y1 - _v.y, z1 - _v.z); a.setXYZ(v * 4 + 3, x1 + _v.x, y1 + _v.y, z1 + _v.z); }
    for (; v < B.max; v++) for (let j = 0; j < 4; j++) a.setXYZ(v * 4 + j, 0, -50, 0); a.needsUpdate = true; B.geo.computeBoundingSphere(); B.m.visible = true; }
  function puff(S, x, y, z, n, sc) { if (G.headless || !S.puffs) return; for (let i = 0; i < n; i++) { const P = S.puffs[S.puffI = (S.puffI + 1) % S.puffs.length], a = vrand() * TAU, sp = (0.6 + vrand()) * sc; P.t = 0; P.life = 1.1 + vrand() * 0.8; P.sp.position.set(x + Math.sin(a) * 0.3 * sc, y, z + Math.cos(a) * 0.3 * sc); P.v.set(Math.sin(a) * sp, 0.6 + vrand() * 0.8, Math.cos(a) * sp); P.s0 = (0.6 + vrand() * 0.5) * sc; P.s1 = P.s0 * (2.6 + vrand()); P.sp.visible = true; }
    FX.burst(x, y + 0.2, z, { n: Math.round(8 * sc), color: 0x5a3c22, color2: 0x3a2614, speed: [2, 6 * sc], life: [0.4, 0.8], size: [0.08, 0.16], grav: 20, up: 4 }); }
  function landFx(x, z, s = 1) { if (G.headless) return; const Sb = G.boss && G.boss.state; if (Sb) puff(Sb, x, 0.4, z, 5, 1.2 * s); FX.burst(x, 0.4, z, { n: Math.round(36 * s), color: 0xffffff, color2: 0xbfe0ff, speed: [3, 11 * s], life: [0.25, 0.6], size: [0.12, 0.32], drag: 2.5 }); FX.ring(x, z, { r0: 0.3, r1: 4.5 * s, color: GHOST, dur: 0.45, width: 0.16 }); FX.light(x, 1.5, z, GHOST, 50 * s, 0.4, 14); }

  // ---- the top of the inning: he bats ----
  function* walk(b, x, z, face) { const S = b.state; S.walking = 1; b.autoFace = false; yield* b.moveTo(x, z, 11); yield* b.turnTo(face, 0.25); S.walking = 0; }
  function* liner(b) {
    const S = b.state, p = G.player, dir = b.angToPlayer(); b.facing = dir; S.batUp = 1;
    Hz.rect(b.pos.x, b.pos.z, dir, 46, 3.2, 0.95, 300, { name: 'Line Drive', onFire() { Sound.sfx('parry', 0.8, 0.7); if (!G.headless) FX.missile(new V3(b.pos.x, 2.5, b.pos.z), new V3(b.pos.x + Math.sin(dir) * 44, 1.2, b.pos.z + Math.cos(dir) * 44), { speed: 90, color: 0xffffff, size: 0.4 }); } });
    yield* b.cast({ name: 'Line Drive', time: 0.95 }); S.swingK = 1; S.batUp = 0; yield 0.55;
  }
  function runner(b, at) {
    const S = b.state, m = ghostMan(1.15, new THREE.MeshStandardMaterial({ color: 0xffd0c8, roughness: 0.6, emissive: RED, emissiveIntensity: 0.7, transparent: true, opacity: 0.85 }), false), from = at === 0 ? HOME : BASES[at - 1];
    const e = b.spawnAdd({ name: 'Runner', hp: 300, x: from.x, z: from.z, radius: 0.7, aimY: 1.1, mesh: m.g, color: RED,
      update(e, dt) {
        if (G.state !== 'fight' || b.transitioning) return; if (e.wait > 0) { e.wait -= dt; return; }
        const q = BASES[e.next], dx = q.x - e.pos.x, dz = q.z - e.pos.z, d = Math.hypot(dx, dz), s = 4.6 * dt; e.facing = Math.atan2(dx, dz); e.run = (e.run || 0) + dt * 14; m.legs[0].rotation.x = Math.sin(e.run) * 0.9; m.legs[1].rotation.x = -Math.sin(e.run) * 0.9;
        if (d <= s) { e.pos.x = q.x; e.pos.z = q.z; e.next++; if (e.next > 3) { e.scored = true; homeScores(b); e.die(); } } else { e.pos.x += dx / d * s; e.pos.z += dz / d * s; }
      },
      onDeath(e) { const i = S.runners.indexOf(e); if (i >= 0) S.runners.splice(i, 1); if (!e.scored && S.half === 'top') out(b); } });
    e.next = at; e.wait = at === 0 ? 0.3 : 2.2; S.runners.push(e); return e;
  }
  function* fly(b, n = 1) {
    const S = b.state, p = G.player; S.batUp = 1; yield* b.cast({ name: 'Pop Fly', time: 0.7 }); S.swingK = 1; S.batUp = 0; Sound.sfx('parry', 0.9, 0.8);
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0; for (let k = 0; k < 30; k++) { const a = rnd(0, TAU), d = rnd(8, 14); x = p.pos.x + Math.sin(a) * d; z = p.pos.z + Math.cos(a) * d; if (Math.hypot(x, z) < R - 2.5 && Math.hypot(x - b.pos.x, z - b.pos.z) > 5 && (i === 0 || Math.hypot(x - S.fly[S.fly.length - 1].x, z - S.fly[S.fly.length - 1].z) > 9)) break; }
      const T = 3.2 + i * 1.5, q = S.balls[2 + i], f = { x, z, T, t: 0, q, sx: b.pos.x, sz: b.pos.z }; S.fly.push(f); q.mode = 2; q.o.visible = true;
      Hz.circle(x, z, 1.75, T, 0, { name: 'Pop Fly', color: 0xffffff, style: 1, quiet: true, silent: true, onFire() {
        const i2 = S.fly.indexOf(f); if (i2 >= 0) S.fly.splice(i2, 1); q.mode = 0; q.o.visible = false;
        if (p.alive && Math.hypot(p.pos.x - x, p.pos.z - z) < 2.1) { out(b); FX.ring(x, z, { r0: 2, r1: 0.4, color: 0xffffff, dur: 0.3 }); Sound.sfx('hit', 0.9, 0.6); }
        else { landFx(x, z, 1); if (!G.headless) FX.shake(0.44); Sound.sfx('boom', 0.7); if (p.alive && Math.hypot(p.pos.x - x, p.pos.z - z) < 5) p.hurt(150, { blockable: true, src: { name: 'Base Hit' } }); runner(b, 0); }
      } });
    }
    yield 0.6;
  }
  function* grounder(b, n = 2) {
    const S = b.state, p = G.player;
    for (let i = 0; i < n; i++) { S.batUp = 1; yield* b.cast({ name: 'Grounder', time: 0.6 }); S.swingK = 1; S.batUp = 0; Sound.sfx('parry', 0.7, 0.9); const q = S.balls.find((o, j) => j >= 1 && o.mode === 0) || S.balls[1]; S.gr.push({ q, x: b.pos.x, z: b.pos.z, dir: b.angToPlayer() + rnd(-0.12, 0.12), t: 0 }); q.mode = 3; q.o.visible = true; yield 0.55; }
    yield 0.4;
  }
  function* bigSwing(b) {
    const S = b.state, dir = b.angToPlayer(); b.facing = dir; S.batUp = 1;
    Hz.cone(b.pos.x, b.pos.z, dir, 3.5, 7.8, 1.1, 300, { name: 'Big Swing', quiet: true }); yield* b.cast({ name: 'Big Swing', time: 1.1 }); S.swingK = 1; Sound.sfx('slash', 1, 0.5); FX.shake(0.4); FX.slash(b.pos.x, 2.4, b.pos.z, dir, { r: 7.5, color: GOLD, dur: 0.3 });
    Hz.cone(b.pos.x, b.pos.z, dir + PI, 3.5, 7.8, 0.85, 300, { name: 'Backswing', quiet: true }); yield 0.85; S.swingK = 1; Sound.sfx('slash', 1, 0.45); FX.slash(b.pos.x, 2.4, b.pos.z, dir + PI, { r: 7.5, color: GOLD, dur: 0.3, flip: true }); S.batUp = 0; yield 0.6;
  }
  function* top(b, lvl) {
    const S = b.state; S.half = 'top'; S.outs = 0; S.strikes = 0; S.pitch = null; S.zone.targetable = false; S.zoneG.visible = false; b.targetable = true; b.dmgTaken = 1 + Math.min(0.5, 0.1 * S.guestHalf); S.rally = S.guestHalf; S.guestHalf = 0; board(b);
    yield* walk(b, 0, 9.6, 0); b.autoFace = true; S.pose = 'bat';
    if (lvl === 1) runner(b, 1); if (lvl >= 2) { runner(b, 1); runner(b, 2); }
    const plan = lvl === 0 ? ['fly', 'liner', 'swing', 'ground', 'fly', 'liner', 'swing', 'fly'] : lvl === 1 ? ['fly2', 'liner', 'swing', 'ground', 'liner', 'fly2', 'swing', 'ground'] : ['fly2', 'swing', 'liner', 'ground', 'fly2', 'liner', 'swing'];
    for (const a of plan) {
      if (S.outs >= 3) break;
      if (a === 'fly') yield* fly(b, 1); else if (a === 'fly2') yield* fly(b, 2); else if (a === 'liner') { yield* liner(b); if (lvl >= 1) yield* liner(b); } else if (a === 'swing') yield* bigSwing(b); else yield* grounder(b, lvl >= 1 ? 3 : 2);
      yield 0.5;
    }
    yield () => S.fly.length === 0;
    if (S.outs >= 3) { b.exposed = 5; S.down = 5; S.cheer = 1.4; Sound.sfx('interrupt', 0.8, 0.6); FX.flash(0xffffff, 0.2, 3); b.autoFace = false; yield 5; b.autoFace = true; }
    b.dmgTaken = 1; S.rally = 0;
  }
  // ---- the bottom of the inning: you bat ----
  function* pitchOne(b, type) {
    const S = b.state, p = G.player, D = PITCH[type], P = { type, tc: 1e9, released: false, done: false, swung: false }; S.pitch = P; S.wind = 1; S.windType = type;
    const box = inBox(p) || BOX.reduce((a, q) => Math.hypot(q.x - p.pos.x, q.z - p.pos.z) < Math.hypot(a.x - p.pos.x, a.z - p.pos.z) ? q : a);
    if (type === 'brush') Hz.rect(b.pos.x, b.pos.z, angTo(b.pos.x, b.pos.z, box.x, box.z), 19, 2.4, 1.3 + D.T, 380, { name: 'Chin Music', color: RED, quiet: true });
    if (type === 'fire') Hz.circle(HOME.x, HOME.z, 4.8, 1.3 + D.T, 380, { name: 'Fireball', color: RED, onFire() { if (!G.headless) { FX.burst(HOME.x, 0.5, HOME.z, { n: 50, color: 0xff5020, color2: 0xffc060, speed: [5, 16], life: [0.4, 1.1], size: [0.3, 0.9], drag: 2.2 }); FX.ring(HOME.x, HOME.z, { r0: 0.3, r1: 6.5, color: 0xff5020, dur: 0.5, width: 0.16 }); FX.dome(HOME.x, 0.5, HOME.z, { r: 5, color: 0xff5020, dur: 0.45 }); FX.light(HOME.x, 2, HOME.z, 0xff5020, 90, 0.5, 25); puff(b.state, HOME.x, 0.4, HOME.z, 4, 1.4); } FX.shake(0.55); } });
    yield* b.cast({ name: D.name, time: 1.3 });
    S.wind = 0; S.throwK = 1; P.released = true; P.t0 = G.ft; P.tc = G.ft + D.T; P.tx = type === 'brush' ? box.x : HOME.x; P.tz = type === 'brush' ? box.z : HOME.z; P.side = box.x > 0 ? 1 : -1; Sound.sfx('dash', 0.8, type === 'fast' ? 1.6 : 0.9);
    if (type === 'ghost') { P.decoy = G.ft; P.tc += 0.42; P.t0 += 0.42; }
    S.balls[0].mode = 1; S.balls[0].o.visible = true; S.ballM[0].color.setHex(D.col).multiplyScalar(3.2);
    yield () => P.done || G.ft >= P.tc + 0.28;
    if (!P.done) { P.done = true; if (type !== 'brush' && type !== 'fire') strike(b, null); }
    if (S.balls[0].mode === 1) { S.balls[0].mode = 0; S.balls[0].o.visible = false; }
    yield 0.85;
  }
  function* bottom(b, lvl) {
    const S = b.state; S.half = 'bot'; S.strikes = 0; S.pose = 'pitch'; b.targetable = false; b.dmgTaken = 1; board(b);
    yield* walk(b, 0, 0, 0); S.zone.targetable = true; S.zoneG.visible = true; if (G.player.target === b || !G.player.target) G.player.target = S.zone;
    const pool = lvl === 0 ? ['fast', 'change', 'fast', 'curve', 'brush', 'change'] : lvl === 1 ? ['fast', 'split', 'curve', 'ghost', 'brush', 'change', 'split', 'fast'] : ['knuckle', 'fast', 'fire', 'split', 'ghost', 'brush', 'knuckle', 'curve', 'fire', 'change'];
    const order = S.inning === 1 && lvl === 0 ? pool : shuffle(pool); yield 0.6;
    for (const t of order) { if (lvl >= 1) { S.gap = rnd() < 0.5 ? 1 : -1; S.fpos[1] = { x: -S.gap * 9, z: -2 }; } yield* pitchOne(b, t); }
    S.pitch = null; S.zone.targetable = false; S.zoneG.visible = false; b.targetable = true; if (G.player.target === S.zone) G.player.target = b;
    S.inning++;
  }
  function setLvl(b, n) {
    const S = b.state; S.lvl = n; S.lookT = n; S.wind = 0; S.batUp = 0; S.pitch = null; S.zone.targetable = false; S.zoneG.visible = false; b.targetable = true; b.dmgTaken = 1; b.autoFace = false; if (G.player && G.player.target === S.zone) G.player.target = b;
    for (const f of S.fielders) f.g.visible = n >= 1; S.rain.visible = n === 1; S.wisps.visible = n >= 2; for (const q of S.balls) { if (q.mode === 1) { q.mode = 0; q.o.visible = false; } }
  }

  G.bosses.push({
    id: 'ballpark', name: 'THE CLOSER', title: 'Bottom of the Ninth', hint: 'Play ball', color: '#bfe0ff', telegraph: TEL,
    hp: 26000, radius: 1.5, aimY: 3.4, enrage: 500,
    post: { bloom: 0.55, threshold: 0.86, radius: 0.7, exposure: 1.0, vig: 1.05, sat: 1.05, contrast: 1.06, tint: [0.97, 1.0, 1.06] },
    music: { bpm: 112, root: 36, scale: [0, 2, 4, 5, 7, 9, 10], prog: [0, 0, 3, 4, 0, 0, 5, 4],
      layers: [
        { v: 'organ', pat: ['0...2...4...2...', '0...2...4.5.7...'], oct: 1, len: 3, vol: 0.07 }, { v: 'bass', pat: '0...0...4...4...', oct: -1, len: 3, vol: 0.13 }, { v: 'clap', pat: '....x.......x.x.', vol: 0.1 }, { v: 'kick', pat: 'x.......x.......', vol: 0.2 },
        { v: 'hat', from: 1, pat: 'x.x.x.x.x.x.x.x.', vol: 0.05 }, { v: 'tom', from: 1, pat: '......x.......xx', vol: 0.14 }, { v: 'brass', from: 1, pat: ['0.......4.......', '3.......4...5...'], len: 6, vol: 0.09 }, { v: 'pad', from: 1, pat: '0...............', len: 16, vol: 0.07 },
        { v: 'choir', from: 2, pat: '0.......3.......', oct: 1, len: 8, vol: 0.08 }, { v: 'taiko', from: 2, pat: 'x..x..x.x..x.xx.', vol: 0.2 }, { v: 'lead', from: 2, pat: ['0.2.4.7.4.2.0...', '7.5.4.2.0.......'], oct: 1, len: 2, vol: 0.05 },
      ] },
    build,
    *intro(b) { const S = b.state; S.floodK = 0; Co.start(function* () { for (let i = 0; i < 6; i++) { yield 0.42; S.floodK = (i + 1) / 6; Sound.sfx('hit', 0.9, 0.5); } }, 'sys'); yield* Cam.shot([14, 3, 24], [0, 9, -20], [4, 3.2, 17], [0, 3.6, 9], 5.4, 48); S.floodK = 1; },
    phases: [
      { at: 1, *run(b) { b.state.floodK = 1; setLvl(b, 0); yield 0.8; while (true) { yield* top(b, 0); yield* bottom(b, 0); } } },
      { at: 0.66, skipTo(b) { b.state.look = 1; b.state.inning = 3; }, *enter(b) {
        const S = b.state; setLvl(b, 0); S.lookT = 1; S.flash = 1; if (S.half === 'bot') S.inning++; S.outs = 0; S.strikes = 0; board(b); Sound.sfx('thunder', 1); FX.flash(0xffffff, 0.5, 1.5);
        yield* b.cast({ name: 'Seventh-Inning Stretch', time: 3.0, onTick: (k) => { if (vrand() < 0.03) S.flash = 1; } }); S.rain.visible = true; S.cheer = 1.5;
        Co.start(Post.lerpTo({ tint: [0.92, 0.97, 1.12], bloom: 0.6 }, 3), 'fight'); yield 1.0;
      }, *run(b) { setLvl(b, 1); while (true) { yield* top(b, 1); yield* bottom(b, 1); } } },
      { at: 0.33, skipTo(b) { b.state.look = 2; b.state.inning = 7; b.state.floodK = 0; }, *enter(b) {
        const S = b.state; setLvl(b, 1); S.lookT = 2; S.inning = Math.max(S.inning, 9); board(b);
        yield* b.cast({ name: 'Lights Out', time: 3.2, onTick: (k) => { const n = Math.floor(k * 6.99); if (n !== S.lo) { S.lo = n; S.floodK = 1 - n / 6; Sound.sfx('shatter', 0.7, 0.6); FX.shake(0.3); } } });
        S.floodK = 0; S.rain.visible = false; S.wisps.visible = true; Sound.sfx('roar', 0.9, 0.5); FX.flash(0x70ffb0, 0.4, 1.2);
        Co.start(Post.lerpTo({ tint: [1.0, 0.99, 1.04], bloom: 0.6, exposure: 1.05, contrast: 1.12 }, 3), 'fight'); yield 1.2;
      }, *run(b) { setLvl(b, 2); b.state.floodK = 0; while (true) { yield* bottom(b, 2); yield* top(b, 2); } } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight' && p && p.alive, P = S.pitch;
      if (S.swingCd > 0) S.swingCd -= dt; S.zone.hp = S.zone.maxHp; if (S.down > 0) S.down -= dt;
      if (fight && p.casting && p.casting.tgt === S.zone) { p.casting = null; swing(b); }
      // the pitch
      const q0 = S.balls[0];
      if (P && P.released && q0.mode === 1) {
        const k = (G.ft - P.t0) / PITCH[P.type].T, s = ballS(P.type, sat(k)), ext = k > 1 ? (k - 1) * 1.2 : 0; let x = lerp(b.pos.x, P.tx, s + ext), z = lerp(b.pos.z + 1.2, P.tz, s + ext);
        if (P.type === 'curve') x += Math.sin(sat(k) * PI) * 3.6 * P.side;
        q0.o.position.set(x, lerp(4.6, 1.15, sat(s)) + Math.sin(sat(k) * PI) * (P.type === 'change' ? 1.4 : 0.4), z); q0.o.visible = k >= 0; if (!G.headless) S.ballM[0].color.setHex(PITCH[P.type].col).multiplyScalar(3.2 * (0.35 + 0.65 * sat(k * 4)));
        if (P.decoy !== undefined) { const kd = (G.ft - P.decoy) / PITCH.ghost.T, d = S.balls[1]; d.o.visible = kd < 1.5; d.mode = kd < 1.5 ? 8 : 0; d.o.position.set(lerp(b.pos.x, P.tx, kd), lerp(4.6, 1.15, sat(kd)), lerp(b.pos.z + 1.2, P.tz, kd)); S.ballM[1].color.setHex(0x8090a0).multiplyScalar(0.8); }
        if (!G.headless && k >= 1 && !P.puff) { P.puff = 1; puff(S, P.tx, 0.3, P.tz - 0.6, 3, 0.6); }
      }
      if (q0.mode === 9) { q0.t += dt; const k = q0.t / q0.dur; q0.o.position.lerpVectors(q0.from, q0.to, sat(k)); q0.o.position.y += Math.sin(sat(k) * PI) * 2; if (k >= 1) { q0.mode = 0; q0.o.visible = false; } }
      // flies in the air, grounders on the grass
      for (const f of S.fly) { f.t += dt; const k = sat(f.t / f.T); f.q.o.position.set(lerp(f.sx, f.x, k), 2 + Math.sin(k * PI) * 24, lerp(f.sz, f.z, k)); }
      for (let i = S.gr.length - 1; i >= 0; i--) {
        const g = S.gr[i]; g.t += dt; g.x += Math.sin(g.dir) * 15.5 * dt; g.z += Math.cos(g.dir) * 15.5 * dt; g.q.o.position.set(g.x, 0.35 + Math.abs(Math.sin(g.t * 9)) * 0.45, g.z); S.ballM[S.balls.indexOf(g.q)].color.setHex(0xffe0b0).multiplyScalar(3);
        if (fight && !g.hit && Math.hypot(p.pos.x - g.x, p.pos.z - g.z) < 0.95 && p.pos.y < 0.6) { g.hit = true; p.hurt(220, { blockable: true, src: { name: 'Grounder' } }); }
        if (Math.hypot(g.x, g.z) > R || g.hit) { g.q.mode = 0; g.q.o.visible = false; S.gr.splice(i, 1); }
      }
      // ---- cosmetics ----
      if (G.headless) return;
      S.uT.value = t;
      S.look = damp(S.look, S.lookT, 0.6, dt); const k1 = sat(S.look), k2 = sat(S.look - 1), U = S.sky.material.uniforms, fk = S.floodK === undefined ? 1 : S.floodK;
      S.flash = Math.max(0, S.flash - dt * 3); const storm = k1 * (1 - k2);
      if (S.lvl === 1 && G.state === 'fight' && t >= (S.nextBolt || 0)) { S.nextBolt = t + 1.8 + vrand() * 2.2; S.flash = 1; const a = PI + (vrand() - 0.5) * 1.1, d = 75 + vrand() * 30, bx = Math.sin(a) * d, bz = Math.cos(a) * d; bolt(S, bx, bz); if (vrand() < 0.5) Sound.sfx('thunder', 0.3); }
      S.ghostK = damp(S.ghostK, S.lvl >= 2 ? 1 : 0, 1.1, dt); const gk = S.ghostK, lit = Math.max(fk, gk * 0.95);
      U.uFlash.value = S.flash; U.uCloud.value = 0.2 + k1 * 0.55 - k2 * 0.35; U.uStars.value = 1.3 - k1 * 1.0 + k2 * 0.9;
      U.uCloudCol.value.setHex(0x343e58).lerp(_c.setHex(0x8a6ab0), k1).lerp(_c.setHex(0x2a2040), k2); U.uCloudDark.value.setHex(0x05070c).lerp(_c.setHex(0x1a1030), storm); U.uAurora.value = k2 * 0.45;
      U.uHor.value.setHex(0x1e2a48).lerp(_c.setHex(0x2e2250), k1).lerp(_c.setHex(0x2c1850), k2).lerp(_c.setHex(0x8a70c0), S.flash * 0.35 * (1 - k2)); U.uTop.value.setHex(0x03060f).lerp(_c.setHex(0x080614), k1).lerp(_c.setHex(0x0c0626), k2); S.aurM.uniforms.uA.value = k2;
      // light banks: warm white; storm-cold with two failing in the stretch; blown one by one and relit as ghost-green at the end
      const nOn = Math.round(fk * 6), cp = camera.position; _c2.setHex(0xfff1d8).lerp(_c.setHex(0xc4d4ff), k1);
      S.banks.forEach((bk, i) => { const white = i < nOn, fail = S.lvl === 1 && (i === 1 || i === 4) ? (Math.sin(Math.floor(t * 9 + i * 5) * 77.3) > 0.55 ? 0.15 : 0.85 + 0.15 * Math.sin(t * 31)) : 1;
        const fl = (0.8 + 0.2 * Math.sin(t * 17 + i * 3) * Math.sin(t * 5.3 + i)) * (Math.sin(Math.floor(t * 7 + i * 13) * 91.7) > 0.86 ? 0.2 : 1), lv = white ? (1 + S.flash * 0.4) * fail : gk * fl, near = smooth((Math.hypot(bk.x - cp.x, bk.y - cp.y, bk.z - cp.z) - 8) / 14);
        const col = white ? _c2 : _c.setHex(0x9affd0);
        if (bk.on && !white && G.state === 'fight') FX.burst(bk.x * 0.97, bk.y, bk.z * 0.97, { n: 40, color: 0xfff4d0, color2: 0xffa040, speed: [3, 10], life: [0.4, 1.0], size: [0.12, 0.3], grav: 14 }); bk.on = white;
        bk.lampM.color.copy(col).multiplyScalar(0.05 + 2.4 * lv); bk.haloM.color.copy(col).multiplyScalar(0.3 * lv * near); bk.shM.uniforms.uC.value.copy(col); bk.shM.uniforms.uA.value = (white ? 0.19 : 0.38) * lv;
        bk.poolM.uniforms.uC.value.copy(col); bk.poolM.uniforms.uA.value = (white ? 0.07 : 0.46) * lv;
        const ry = cp.y / Math.max(cp.y + bk.y, 1e-3), rx = cp.x + (bk.x - cp.x) * ry, rz = cp.z + (bk.z - cp.z) * ry, ddx = cp.x - bk.x, ddz = cp.z - bk.z, dl = Math.max(Math.hypot(ddx, ddz), 1e-3), on = storm > 0.05 && white && Math.hypot(rx, rz) < R - 1;
        bk.rf.visible = on; if (on) { bk.rf.position.set(rx + ddx / dl * 2.6, 0.035, rz + ddz / dl * 2.6); bk.rf.rotation.y = Math.atan2(ddx, ddz); bk.rfM.uniforms.uA.value = 0.35 * storm * lv; } });
      S.sun.intensity = 0.45 + lit * 2.4 + S.flash * 2; S.sun.color.setHex(0xfff2e2).lerp(_c.setHex(0xd0dcff), k1).lerp(_c.setHex(0xfff0e0), gk);
      S.hemi.intensity = 0.6 + lit * 0.2 + k1 * 0.15 - k2 * 0.05 + S.flash * 0.3; S.hemi.color.setHex(0x8fa8d8).lerp(_c.setHex(0x9a98e0), k1).lerp(_c.setHex(0x9088c0), k2);
      S.rimL.intensity = 1.2 + S.flash * 1.5 + k2 * 0.4; S.rimL.color.setHex(0xc8dcff).lerp(_c.setHex(0xc0ffe0), gk * 0.25); S.rimL.intensity += S.flash * 1.5;
      S.fog.color.setHex(0x0b1220).lerp(_c.setHex(0x120f22), k1).lerp(_c.setHex(0x0c0818), k2);
      S.grassM.color.setRGB(1 - storm * 0.2, 1 - storm * 0.12, 1 - storm * 0.16);
      S.bolt.m.visible = S.flash > 0.02; S.bolt.m.material.uniforms.uA.value = Math.min(1, S.flash * 1.6) * (0.75 + 0.25 * Math.sin(t * 60)); S.rainM.uniforms.uCen.value.set(cp.x, 14, cp.z); S.rainM.uniforms.uA.value = 0.5 * storm; S.mistM.uniforms.uA.value = 0.2 * storm; S.rise.visible = S.lvl >= 2;
      for (const P of S.puffs) { if (!P.sp.visible) continue; P.t += dt; const q = P.t / P.life; if (q >= 1) { P.sp.visible = false; continue; } P.sp.position.addScaledVector(P.v, dt); P.v.multiplyScalar(Math.exp(-dt * 2.2)); const sc = lerp(P.s0, P.s1, 1 - Math.pow(1 - q, 2)); P.sp.scale.set(sc, sc, 1); P.m.opacity = 0.55 * Math.min(1, q * 6) * (1 - q); }
      S.cheer = Math.max(0, S.cheer - dt * 0.5); const CU = S.crowdM.uniforms; CU.uCheer.value = S.cheer; CU.uBright.value = 0.95 + lit * 0.35 - k2 * 0.95 + S.flash * 0.4; CU.uPhone.value = k2; CU.uFlash.value = 0.6 + S.cheer; CU.uPhoneC.value.setHex(0xd0ffe8);
      const RU = S.ribM.uniforms; RU.uA.value.setHex(0xffc040).lerp(_c.setHex(0x60d8ff), k1).lerp(_c.setHex(0xffb030), k2); RU.uB.value.setHex(0xff3020).lerp(_c.setHex(0xa060ff), k1).lerp(_c.setHex(0x60ffa0), k2); RU.uK.value = 0.9 + S.cheer * 0.8;
      const CM = S.chalkM.uniforms; CM.uChalk.value.setHex(0xffffff).lerp(_c.setHex(0xd8fff0), k2).multiplyScalar(0.08 + k2 * (0.42 + 0.12 * Math.sin(t * 9))); CM.uCrack.value.setHex(0x50ffa0).multiplyScalar(k2 * 0.55); CM.uCore.value = k2 * 0.8;
      // the fractures go dark wherever a telegraph is live, so telegraphs stay the brightest thing on the ground
      { const HA = CM.uHa.value, HB = CM.uHb.value; let nh = 0; for (const h of Hz.list) { if (nh >= 8) break; const q = h.shape, T = h.state === 'done' ? undefined : { circle: 0, donut: 1, cone: 2, rect: 3 }[q.type]; if (T === undefined) continue;
          HA[nh].set(q.x, q.z, q.type === 'circle' ? q.r : q.type === 'donut' ? q.r1 : q.type === 'cone' ? q.r : q.len, q.type === 'cone' ? q.arc : q.type === 'rect' ? q.w : 0); HB[nh].set(T, q.dir || 0, 0, 1); nh++; } for (; nh < 8; nh++) HB[nh].w = 0; }
      S.doorM.color.setHex(0xffb060).multiplyScalar(0.55); S.infM.uniforms.uC.value.setHex(0xfff0d8).lerp(_c.setHex(0xd0dcff), k1); S.infM.uniforms.uA.value = 0.16 * fk * (1 - k2) * (1 + S.flash * 0.5);
      S.board.material.color.setScalar(1.25 + (S.lvl >= 2 ? Math.sin(t * 23) * Math.sin(t * 7.1) * 0.45 : 0)); S.strikeFx = Math.max(0, S.strikeFx - dt * 2);
      const bot = S.half === 'bot', box = fight && bot ? inBox(p) : null; S.boxM.opacity = bot ? 0.14 + Math.sin(t * 4) * 0.05 + (box ? 0.12 : 0) : 0; S.zoneM.opacity = 0.16 + (P && P.released && !P.done ? 0.2 : 0) + S.strikeFx * 0.4; S.zoneM.color.setHex(S.strikeFx > 0.05 ? RED : GOLD).multiplyScalar(1.4);
      S.batK = Math.max(0, S.batK - dt * 4); S.bat.visible = !!box; if (box) { const a = p.facing + 0.9 - S.batK * 2.6; S.bat.position.set(p.pos.x + Math.sin(a) * 0.75, p.pos.y + 1.55 - S.batK * 0.3, p.pos.z + Math.cos(a) * 0.75); S.bat.rotation.set(0.5 + S.batK * 1.0, a, 0.5, 'YXZ'); }
      S.fielders.forEach((f, i) => { if (!f.g.visible) return; const q = S.fpos[i]; f.g.position.x = damp(f.g.position.x, q.x, 5, dt); f.g.position.z = damp(f.g.position.z, q.z, 5, dt); f.g.rotation.y = angTo(f.g.position.x, f.g.position.z, HOME.x, HOME.z); f.g.visible = S.lvl >= 1 && bot; f.arms[0].rotation.x = -1.2; f.rig.position.y = Math.sin(t * 2 + i * 2) * 0.12; });
      for (const f of S.fielders) if (S.lvl >= 1 && bot) f.g.visible = true;
      S.specRim.setHex(S.lvl >= 2 ? 0x80ffc8 : GHOST).multiplyScalar(1.1);
      // the Closer
      const M = S.M; S.windK = damp(S.windK || 0, S.wind, 7, dt); S.throwK = Math.max(0, S.throwK - dt * 2.6); S.swingK = Math.max(0, S.swingK - dt * 2.8); S.batUpK = damp(S.batUpK || 0, S.batUp, 9, dt); S.flinch = Math.max(0, (S.flinch || 0) - dt * 2);
      const wk = S.walking ? 1 : 0; S.stepT = (S.stepT || 0) + dt * 11 * wk; const top_ = S.half === 'top', dn = S.down > 0 ? 1 : 0; S.dnK = damp(S.dnK || 0, dn, 6, dt);
      M.batG.visible = top_; M.rig.position.y = Math.sin(t * 1.6) * 0.06 - S.dnK * 0.9; M.rig.rotation.x = S.flinch * -0.4 + S.dnK * 0.5;
      M.legs[0].rotation.x = Math.sin(S.stepT) * 0.7 * wk - S.windK * 1.5; M.legs[1].rotation.x = -Math.sin(S.stepT) * 0.7 * wk + S.throwK * 0.6;
      M.body.rotation.y = top_ ? 0.9 * S.batUpK - S.swingK * 2.4 : S.windK * 1.1 - S.throwK * 1.0; M.body.rotation.x = S.throwK * 0.5 - S.windK * 0.15;
      M.arms[1].rotation.x = top_ ? -1.5 - S.batUpK * 0.6 + S.swingK * 0.4 : -S.windK * 2.6 + S.throwK * 2.0 - 0.2; M.arms[1].rotation.z = top_ ? -0.5 : 0.2; M.arms[0].rotation.x = top_ ? -1.3 - S.batUpK * 0.5 : -0.9 - S.windK * 0.5; M.arms[0].rotation.z = top_ ? 0.7 : -0.2;
      if (M.batG) M.batG.rotation.x = -0.6 - S.batUpK * 0.6 + S.swingK * 2.2;
      const hot = P && !P.done && (P.type === 'brush' || P.type === 'fire'), gc = S.lvl >= 2 ? 0x70ffb0 : GHOST, K = S.K; M.eyeM.color.setHex(hot ? RED : gc).multiplyScalar(hot ? 7 : 3.4);
      S.rimC.setHex(gc).lerp(_c.setHex(0xe8dcc8), k2).multiplyScalar(0.5 + k1 * 0.3 - k2 * 0.15 + (b.castState ? 0.25 : 0) + S.flash * 0.6);
      // the trim ignites cyan in the stretch (sleeves, belt, collar, placket, sock stripes) and burns amber at the end
      K.trim.emissive.setHex(0xffc860).lerp(_c.setHex(0x7fd8ff), k1).lerp(_c.setHex(0xffa030), k2); const ti = k1 * (1 - k2) * (1.7 + 0.6 * Math.sin(t * 6)) + k2 * 0.4; K.trim.emissiveIntensity = 0.15 + ti;
      K.glowLine.color.copy(K.trim.emissive).multiplyScalar(0.25 + ti * 1.05); K.belt.emissive.copy(K.trim.emissive); K.belt.emissiveIntensity = ti * 0.7; K.stripe.emissive.copy(K.trim.emissive); K.stripe.emissiveIntensity = ti * 0.6;
      K.emblem.color.setHex(GOLD).lerp(_c.setHex(0x7fd8ff), k1 * (1 - k2)).multiplyScalar(1.3); const bc = b.castState && top_ ? 1 : 0; K.barrel.emissiveIntensity = 1.4 + bc * 0.8; S.barrelRim.setHex(GOLD).multiplyScalar(0.9 + bc * 0.5);
      S.light.color.setHex(hot ? RED : S.lvl >= 2 ? 0xffe0b8 : GHOST); S.light.intensity = 8 + (b.castState ? 6 : 0);
      // fade him when he stands between the camera and the player
      if (p) { const c = camera.position, dx = p.pos.x - c.x, dz = p.pos.z - c.z, L2 = Math.max(dx * dx + dz * dz, 1e-6), k = ((b.pos.x - c.x) * dx + (b.pos.z - c.z) * dz) / L2, kk = sat(k), qx = c.x + dx * kk - b.pos.x, qz = c.z + dz * kk - b.pos.z, yq = c.y + (p.pos.y + 1.2 - c.y) * kk;
        const hide = k > 0.02 && k < 0.97 && qx * qx + qz * qz < 2.4 * 2.4 && yq < 7.4; S.fadeA = damp(S.fadeA === undefined ? 1 : S.fadeA, hide ? 0.25 : 1, 8, dt); for (const m of S.bossMats) m.opacity = m.userData.baseOp * S.fadeA;
        const fa = S.fadeA; K.glowLine.color.multiplyScalar(fa * fa * fa); K.emblem.color.multiplyScalar(fa * fa); K.trim.emissiveIntensity *= fa; K.belt.emissiveIntensity *= fa; K.stripe.emissiveIntensity *= fa; K.barrel.emissiveIntensity *= fa; M.eyeM.color.multiplyScalar(0.3 + 0.7 * fa); }
      // afterimages of the throwing arm from the stretch on
      S.armI = (S.armI + 1) % S.armHist.length; S.armHist[S.armI].copy(M.arms[1].matrixWorld); const ai = S.lvl >= 1 ? Math.min(1, S.throwK * 2 + S.swingK * 2) : 0;
      S.after.forEach((m, i) => { m.visible = ai > 0.03; if (!m.visible) return; m.matrix.copy(S.armHist[(S.armI - (i + 1) * 3 + S.armHist.length * 2) % S.armHist.length]); m.matrixWorld.copy(m.matrix); m.material.color.setHex(S.lvl >= 2 ? 0x70ffb0 : 0x7fd8ff); m.material.opacity = ai * 0.14 * (1 - i / 4.5) * S.fadeA; });
      for (let i = 2; i < 5; i++) if (S.balls[i].mode === 2) S.ballM[i].color.setHex(0xffffff).multiplyScalar(4);
      S.balls.forEach((q, i) => { stepTrail(S.trails[i], q.o, q.o.visible && q.mode !== 0, i === 0 ? 0.42 : 0.26); if (q.o.visible) S.trails[i].m.material.uniforms.uC.value.copy(S.ballM[i].color).multiplyScalar(i === 0 ? 1.0 : 0.35); });
    },
    danger(b, x, z) { const S = b.state; let best = Infinity; for (const g of S.gr) { const rx = x - g.x, rz = z - g.z, k = rx * Math.sin(g.dir) + rz * Math.cos(g.dir); if (k > 0 && k < 14 && Math.abs(rx * Math.cos(g.dir) - rz * Math.sin(g.dir)) < 1.3) best = Math.min(best, k / 15.5); } return best; },
    bot(b, p) {
      const S = b.state, out = {};
      if (S.half === 'bot') {
        const P = S.pitch, away = P && !P.done && (P.type === 'brush' || P.type === 'fire'); out.holdFire = true; out.w = 4; out.target = S.zone.targetable ? S.zone : b;
        if (away) { out.x = 7.5; out.z = 15; } else { out.x = BOX[0].x; out.z = BOX[0].z; }
        if (P && P.released && !P.done && !P.swung && !away && inBox(p)) { if (P.err === undefined) P.err = (G.rng() - 0.5) * [0, 0.5, 0.3, 0.2][Bot.level] + (S.lvl >= 1 ? S.gap * 0.1 : 0); if (G.ft >= P.tc + P.err) swing(b); }
        return out;
      }
      if (S.fly.length) { const f = S.fly.reduce((a, q) => q.T - q.t < a.T - a.t ? q : a); if (f.T - f.t < Math.hypot(f.x - p.pos.x, f.z - p.pos.z) / 7 + 1.4) { out.x = f.x; out.z = f.z; out.w = 4; } }
      if (S.runners.length) out.target = S.runners.reduce((a, q) => q.next > a.next ? q : a);
      return out;
    },
  });
})();
