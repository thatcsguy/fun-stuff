// DOOR XIII: ZUGZWANG, the Last Grandmaster. A chessboard on a giant's study table. The pieces play by the rules.
(() => {
  // <board> pure board logic, no THREE or game globals (tools/chessfuzz.js loads this block on its own)
  const C = 4.5, HALF = 18, EMBER = 0xff5a28, IVORY = 0xfff0d0, GOLD = 0xffc850;
  const cx = (i) => (i - 3.5) * C, ci = (x) => Math.floor((x + HALF) / C);
  const inB = (i, j) => i >= 0 && i < 8 && j >= 0 && j < 8;
  const cellOf = (x, z) => { const i = ci(x), j = ci(z); return inB(i, j) ? { i, j } : null; };
  const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ALL = ROOK.concat(DIAG);
  const JUMP = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const HEIGHT = { P: 3.2, R: 3.6, N: 4.2, B: 4.8, Q: 5.5 };

  // Squares a piece of `type` on (i,j) attacks. occ(i,j) is truthy for blockers; a ray includes its first blocker.
  // rays (optional) collects the far end of each line / each jump target for the strike effects.
  function attacks(type, i, j, occ, rays) {
    const out = [];
    const slide = (dirs) => { for (const [dx, dz] of dirs) { let x = i + dx, z = j + dz, lx = -1, lz = -1; while (inB(x, z)) { out.push(z * 8 + x); lx = x; lz = z; if (occ(x, z)) break; x += dx; z += dz; } if (rays && lx >= 0) rays.push([lx, lz]); } };
    if (type === 'R') slide(ROOK); else if (type === 'B') slide(DIAG); else if (type === 'Q') slide(ALL);
    else if (type === 'N') { for (const [dx, dz] of JUMP) if (inB(i + dx, j + dz)) { out.push((j + dz) * 8 + i + dx); if (rays) rays.push([i + dx, j + dz]); } }
    else if (type === 'P') { for (const dx of [-1, 1]) if (inB(i + dx, j + 1)) { out.push((j + 1) * 8 + i + dx); if (rays) rays.push([i + dx, j + 1]); } }
    else if (type === 'K') { for (const [dx, dz] of ALL) if (inB(i + dx, j + dz)) out.push((j + dz) * 8 + i + dx); }
    return out;
  }
  // good-cell count wanted per act, and the walking budget to the nearest good cell
  const GOOD = [[3, 8], [2, 5], [1, 3]], LOCK = 0.6;
  const reachOf = (T) => Math.max(C * 1.2, (T - LOCK - 1.5) * 7 * 0.8);
  // A final position: which cells the pieces strike, and from which free cells the player's piece `you` attacks the King.
  function evalBoard(all, k, you) {
    const grid = new Uint8Array(64); grid[k.j * 8 + k.i] = 1; for (const r of all) grid[r.j * 8 + r.i] = 1;
    const occ = (i, j) => grid[j * 8 + i] === 1, kc = k.j * 8 + k.i, struck = new Uint8Array(64), check = new Uint8Array(64);
    for (const r of all) { struck[r.j * 8 + r.i] = 1; for (const c of attacks(r.type, r.i, r.j, occ)) struck[c] = 1; }
    struck[kc] = 1;
    const safe = [], good = []; let decoySafe = 0, decoyCheck = 0;
    for (let c = 0; c < 64; c++) {
      if (grid[c]) continue; const ch = attacks(you, c % 8, c >> 3, occ).includes(kc); if (ch) check[c] = 1;
      if (!struck[c]) { safe.push(c); if (ch) good.push(c); else decoySafe++; } else if (ch) decoyCheck++;
    }
    return { struck, check, safe, good, decoySafe, decoyCheck };
  }
  // Plan one Gambit. ctx: { pieces: [{type,i,j,ref,mover}], k, pc, px, pz, rnd }. o: { types, fixed, pawns, T, lvl, you | youSeq, range }.
  // Returns where movers go, what drops where, the player's piece and the evaluation, or null. Relaxes in the agreed order:
  // decoy rules, then one fewer piece, then any good count. A reachable good cell is never relaxed.
  function genPlan(ctx, o) {
    const { k, pc, rnd } = ctx, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), reach = reachOf(o.T);
    const youList = o.you ? [o.you] : [...new Set(o.youSeq.concat(['R', 'B', 'N', 'Q']))];
    let types = (o.types || []).slice(), range = o.range || GOOD[o.lvl], relax = 0;
    const tries = o.fixed && !ctx.pieces.some((r) => r.mover) && !types.length ? 1 : 150;
    for (let attempt = 0; attempt < tries; attempt++) {
      if (attempt === 50) relax = 1; if (attempt === 90) { relax = 2; types = types.slice(0, -1); } if (attempt === 105) types = []; if (attempt === 120) relax = 3;
      const pos = ctx.pieces.map((r) => ({ ref: r.ref, type: r.type, i: r.i, j: r.j, mover: r.mover })), moves = [], drops = [];
      const taken = (i, j) => (i === k.i && j === k.j) || pos.some((r) => r.i === i && r.j === j) || drops.some((r) => r.i === i && r.j === j);
      for (const r of pos) {
        if (r.type === 'P') { if (o.pawns && r.j < 7 && !taken(r.i, r.j + 1)) { moves.push({ ref: r.ref, i: r.i, j: r.j + 1 }); r.j++; } continue; }
        if (!r.mover) continue;
        const opts = attacks(r.type, r.i, r.j, taken).map((c) => ({ i: c % 8, j: c >> 3 })).filter((c) => !taken(c.i, c.j) && !(c.i === pc.i && c.j === pc.j));
        if (opts.length) { const d = opts[ri(0, opts.length - 1)]; moves.push({ ref: r.ref, i: d.i, j: d.j }); r.i = d.i; r.j = d.j; }
      }
      let ok = true;
      for (const d of (o.fixed || [])) { if (!inB(d.i, d.j) || taken(d.i, d.j) || (d.i === pc.i && d.j === pc.j)) { ok = false; break; } drops.push({ type: d.type, i: d.i, j: d.j }); }
      if (!ok) return null;
      for (const type of types) {
        let placed = false;
        for (let t = 0; t < 30 && !placed; t++) { const i = ri(0, 7), j = type === 'P' ? ri(2, 4) : ri(0, 7); if (taken(i, j) || (i === pc.i && j === pc.j)) continue; drops.push({ type, i, j }); placed = true; }
        if (!placed) ok = false;
      }
      if (!ok) continue;
      const all = pos.map((r) => ({ type: r.type, i: r.i, j: r.j })).concat(drops);
      for (const you of youList) {
        const ev = evalBoard(all, k, you); let near = 1e9;
        for (const c of ev.good) near = Math.min(near, Math.hypot(cx(c % 8) - ctx.px, cx(c >> 3) - ctx.pz));
        if (near > reach) continue;
        if (relax < 3 && (ev.good.length < range[0] || ev.good.length > range[1])) continue;
        if (relax < 1 && (!ev.decoySafe || !ev.decoyCheck)) continue;
        if (attempt < 30 && tries > 1 && ev.check[pc.j * 8 + pc.i] && !ev.struck[pc.j * 8 + pc.i]) continue; // no free answer where you already stand
        return Object.assign(ev, { moves, drops, you, relax, attempt });
      }
    }
    return null;
  }
  // </board>
  const _a = new V3(), _b = new V3(), _m = new THREE.Object3D(), _c = new THREE.Color();

  // ---------- shader helpers ----------
  const NZ = `float h31(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fb3(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*n3(p); p=p*2.07+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
`;
  // inject world/object position and code into a standard material: o.map edits diffuseColor, o.rough edits roughnessFactor, o.emit adds to totalEmissiveRadiance (nd = |N.V|)
  function shade(mat, key, U, o) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vWP; varying vec3 vOP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 wq=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nwq=instanceMatrix*wq;\n#endif\nvWP=(modelMatrix*wq).xyz; vOP=transformed; }');
      sh.fragmentShader = 'varying vec3 vWP; varying vec3 vOP;\n' + (o.decl || '') + '\n' + NZ + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + (o.map || ''))
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + (o.rough || ''))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv=vViewPosition/max(length(vViewPosition),1e-4); float nd=clamp(abs(dot(normal,vv)),0.0,1.0);\n' + (o.emit || '') + '\n}')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + (o.post || ''));
    };
    mat.customProgramCacheKey = () => 'chess_' + key; return mat;
  }
  // occlusion fade: a dark smoked-glass body that keeps a bright rim line along its contour
  const FADE = '{ float k=1.0-clamp(opacity,0.0,1.0); if (k>0.001) { vec3 vv=vViewPosition/max(length(vViewPosition),1e-4); float f=pow(1.0-clamp(abs(dot(normal,vv)),0.0,1.0),2.0); gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(0.02,0.017,0.014)+gl_FragColor.rgb*0.05+vec3(0.62,0.58,0.52)*f*1.1,k); gl_FragColor.a=mix(1.0,0.7+0.28*f,k); } }';
  // depth-only copies drawn just before a fading piece, so only its outer shell is blended (no inner blobs or facets)
  const prepass = (root, mats, dm) => { const out = []; root.traverse((o) => { if (o.isMesh && mats.includes(o.material)) { const d = new THREE.Mesh(o.geometry, dm); d.renderOrder = 5; d.visible = false; d.castShadow = false; o.renderOrder = 6; o.add(d); out.push(d); } }); return out; };
  const canvasTex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  function softTex(stops, tall) { // radial (or teardrop flame) sprite
    const [c, x] = mkCanvas(128, tall ? 256 : 128), H = tall ? 256 : 128, g = tall ? x.createRadialGradient(64, 170, 2, 64, 150, 120) : x.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [k, col] of stops) g.addColorStop(k, col); x.fillStyle = g;
    if (tall) { x.beginPath(); x.moveTo(64, 6); x.bezierCurveTo(98, 90, 118, 150, 110, 190); x.bezierCurveTo(100, 240, 28, 240, 18, 190); x.bezierCurveTo(10, 150, 30, 90, 64, 6); x.fill(); } else x.fillRect(0, 0, 128, H);
    return canvasTex(c);
  }
  function frameTex(horiz) { // dark lacquered frame strip, brass inlay and file / rank letters as ornament
    const L = 1024, w = horiz ? L : 64, h = horiz ? 64 : L, [c, x] = mkCanvas(w, h), [cm, xm] = mkCanvas(w, h), r = mulberry(horiz ? 7 : 8);
    x.fillStyle = '#2c1a0e'; x.fillRect(0, 0, w, h); xm.fillStyle = '#000'; xm.fillRect(0, 0, w, h);
    for (let k = 0; k < 420; k++) { x.globalAlpha = 0.06 + r() * 0.12; x.fillStyle = r() < 0.5 ? '#5a3418' : '#120804'; const a = r() * L, b = r() * 64, len = 30 + r() * 220, th = 0.6 + r() * 1.8; if (horiz) x.fillRect(a, b, len, th); else x.fillRect(b, a, th, len); }
    x.globalAlpha = 1;
    const brass = (ctx, col) => { ctx.fillStyle = col; for (const o of [5, 9, 55, 59]) { const t = o === 9 || o === 55 ? 1.2 : 2.2; if (horiz) ctx.fillRect(0, o - t / 2, w, t); else ctx.fillRect(o - t / 2, 0, t, h); } };
    brass(x, '#b88a3c'); brass(xm, '#fff');
    for (let i = 0; i < 8; i++) {
      const pos = (cx(i) + (horiz ? HALF + 3 : HALF)) / (horiz ? HALF * 2 + 6 : HALF * 2) * L, ch = horiz ? 'abcdefgh'[i] : String(8 - i);
      for (const [ctx, col] of [[x, '#c99a48'], [xm, '#fff']]) { ctx.fillStyle = col; ctx.font = 'bold 34px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if (horiz) ctx.fillText(ch, pos, 33); else ctx.fillText(ch, 32, pos); }
      for (const [ctx, col] of [[x, '#b88a3c'], [xm, '#fff']]) { ctx.fillStyle = col; const d = (C / (horiz ? HALF * 2 + 6 : HALF * 2)) * L * 0.5; for (const s of [-1, 1]) { if (horiz) { ctx.beginPath(); ctx.arc(pos + s * d, 32, 3, 0, TAU); ctx.fill(); } else { ctx.beginPath(); ctx.arc(32, pos + s * d, 3, 0, TAU); ctx.fill(); } } }
    }
    return { map: canvasTex(c), metalnessMap: canvasTex(cm, false) };
  }
  function coverTex(col, seed) { // tooled leather cover with a gold border
    const [c, x] = mkCanvas(256, 256), r = mulberry(seed); x.fillStyle = col; x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 900; k++) { x.globalAlpha = 0.05 + r() * 0.08; x.fillStyle = r() < 0.5 ? '#000' : '#fff'; x.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); }
    x.globalAlpha = 1; x.strokeStyle = '#c8a050'; x.lineWidth = 5; x.strokeRect(18, 18, 220, 220); x.lineWidth = 2; x.strokeRect(30, 30, 196, 196);
    x.fillStyle = '#c8a050'; for (const [a, b] of [[30, 30], [226, 30], [30, 226], [226, 226]]) { x.beginPath(); x.arc(a, b, 7, 0, TAU); x.fill(); }
    return canvasTex(c);
  }
  function pageTex() { const [c, x] = mkCanvas(256, 256), r = mulberry(3); x.fillStyle = '#d6c6a0'; x.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 2) { x.globalAlpha = 0.15 + r() * 0.25; x.fillStyle = r() < 0.5 ? '#8a7650' : '#f4e8c8'; x.fillRect(0, y, 256, 1); } return canvasTex(c); }
  function dialTex() { // ivory dial with ticks and numerals; second canvas is the glow mask of the ticks
    const [c, x] = mkCanvas(512, 512), [cm, xm] = mkCanvas(512, 512), g = x.createRadialGradient(256, 256, 20, 256, 256, 256);
    g.addColorStop(0, '#f4ead2'); g.addColorStop(0.85, '#e2d2ae'); g.addColorStop(1, '#a89060'); x.fillStyle = g; x.fillRect(0, 0, 512, 512); xm.fillStyle = '#000'; xm.fillRect(0, 0, 512, 512);
    for (const [ctx, col] of [[x, '#1a120c'], [xm, '#fff']]) {
      ctx.strokeStyle = col; ctx.fillStyle = col;
      for (let k = 0; k < 60; k++) { const a = k / 60 * TAU, big = k % 5 === 0, r0 = big ? 200 : 218; ctx.lineWidth = big ? 9 : 3; ctx.beginPath(); ctx.moveTo(256 + Math.sin(a) * r0, 256 - Math.cos(a) * r0); ctx.lineTo(256 + Math.sin(a) * 238, 256 - Math.cos(a) * 238); ctx.stroke(); }
      ctx.font = 'bold 52px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let k = 1; k <= 12; k++) { const a = k / 12 * TAU; ctx.fillText(String(k), 256 + Math.sin(a) * 160, 258 - Math.cos(a) * 160); }
    }
    x.fillStyle = '#a01810'; x.beginPath(); x.moveTo(256, 256); x.arc(256, 256, 120, -PI / 2 - 0.26, -PI / 2, false); x.closePath(); x.globalAlpha = 0.35; x.fill(); x.globalAlpha = 1;
    return { map: canvasTex(c), emissiveMap: canvasTex(cm) };
  }

  // ---------- piece models ----------
  const PROFILE = {
    P: [[0, 0], [1.15, 0], [1.2, 0.25], [0.9, 0.5], [0.55, 0.8], [0.42, 1.6], [0.72, 1.85], [0.45, 2.0], [0.62, 2.3], [0.7, 2.65], [0.55, 3.0], [0.25, 3.2], [0, 3.25]],
    R: [[0, 0], [1.3, 0], [1.35, 0.3], [1.0, 0.6], [0.8, 1.0], [0.72, 2.6], [1.0, 2.9], [1.05, 3.6], [0.8, 3.6], [0.8, 3.3], [0, 3.3]],
    B: [[0, 0], [1.3, 0], [1.35, 0.3], [0.95, 0.6], [0.6, 1.0], [0.45, 2.6], [0.8, 2.85], [0.5, 3.0], [0.7, 3.5], [0.6, 4.0], [0.3, 4.4], [0.12, 4.55], [0.2, 4.7], [0, 4.8]],
    Q: [[0, 0], [1.45, 0], [1.5, 0.35], [1.05, 0.7], [0.7, 1.2], [0.5, 3.4], [0.9, 3.7], [0.6, 3.85], [0.75, 4.3], [1.0, 5.0], [0.7, 4.9], [0.35, 5.1], [0.3, 5.3], [0, 5.45]],
    K: [[0, 0], [1.6, 0], [1.65, 0.4], [1.15, 0.8], [0.8, 1.3], [0.58, 3.8], [1.0, 4.1], [0.7, 4.3], [0.85, 4.8], [1.1, 5.5], [0.8, 5.6], [0, 5.7]],
    // the King: a taller waisted body, a flared crown bowl
    KB: [[0, 0], [1.78, 0], [1.82, 0.16], [1.72, 0.34], [1.36, 0.52], [1.2, 0.78], [0.98, 1.1], [0.8, 1.6], [0.64, 2.5], [0.56, 3.3], [0.6, 3.75], [0.96, 3.98], [1.06, 4.1], [0.74, 4.28], [0.7, 4.5], [0.8, 4.75], [0.98, 5.15], [1.14, 5.5], [1.2, 5.68], [1.04, 5.74], [0.9, 5.6], [0.4, 5.62], [0, 5.66]],
    Nb: [[0, 0], [1.3, 0], [1.35, 0.3], [0.95, 0.6], [0.8, 0.95], [0, 0.95]],
  };
  const geoCache = {};
  function lathe(k) { return geoCache[k] || (geoCache[k] = new THREE.LatheGeometry(PROFILE[k].map(([r, y]) => new THREE.Vector2(r, y)), k === 'KB' ? 40 : 28)); }
  const extr = (P, o) => { const s = new THREE.Shape(); s.moveTo(P[0][0], P[0][1]); for (let k = 1; k < P.length; k++) s.lineTo(P[k][0], P[k][1]); s.closePath(); const g = new THREE.ExtrudeGeometry(s, o); g.translate(0, 0, -o.depth / 2); return g; };
  // the knight's head in profile coordinates (x forward, y up, z sideways): curved neck, jaw, muzzle, forehead; ears, cheeks, muzzle and mane are separate rounded parts
  function knightParts() {
    if (geoCache.Nh) return geoCache.Nh;
    const sph = new THREE.SphereGeometry(1, 20, 14), nc = new THREE.CatmullRomCurve3([[0.05, 0.7], [-0.1, 1.4], [-0.08, 2.1], [0.08, 2.7], [0.3, 3.3]].map(([x, y]) => new V3(x, y, 0))), NS = 24, NR = 20, ng = new THREE.TubeGeometry(nc, NS, 1, NR, false), np = ng.attributes.position;
    for (let i = 0; i <= NS; i++) { const u = i / NS, c = nc.getPointAt(u), r = lerp(0.8, 0.46, Math.pow(u, 0.8)); for (let j = 0; j <= NR; j++) { const k = i * (NR + 1) + j; _a.fromBufferAttribute(np, k).sub(c); np.setXYZ(k, c.x + _a.x * r, c.y + _a.y * r, c.z + _a.z * r * 0.82); } }
    ng.computeVertexNormals(); const neck = [ng];
    const skull = sph.clone(); skull.scale(0.62, 0.5, 0.46); skull.translate(0.38, 3.45, 0);
    const muzzle = new THREE.CylinderGeometry(0.27, 0.42, 1.05, 18, 1); muzzle.rotateZ(-PI / 2 - 0.55); muzzle.translate(0.95, 3.05, 0);
    const nose = sph.clone(); nose.scale(0.3, 0.27, 0.29); nose.translate(1.38, 2.76, 0);
    const jaw = sph.clone(); jaw.scale(0.45, 0.32, 0.4); jaw.translate(0.55, 3.0, 0);
    const mane = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0.05, 3.98], [-0.3, 3.62], [-0.55, 3.0], [-0.72, 2.3], [-0.76, 1.6], [-0.72, 1.1]].map(([x, y]) => new V3(x, y, 0))), 24, 0.13, 8, false);
    const ear = new THREE.ConeGeometry(0.13, 0.5, 10); ear.translate(0, 0.25, 0);
    return (geoCache.Nh = { parts: neck.concat([skull, muzzle, nose, jaw]), mane, ear });
  }
  const BASE_R = { P: 1.17, R: 1.32, B: 1.32, Q: 1.47, N: 1.32 };
  function pieceMesh(type, body, glowM, trim) {
    const g = new THREE.Group(), add = (geo, m, y = 0) => { const q = new THREE.Mesh(geo, m); q.position.y = y; q.castShadow = true; g.add(q); return q; };
    if (type === 'N') {
      add(lathe('Nb'), body); const K = knightParts(), hg = new THREE.Group(); hg.rotation.y = -PI / 2; g.add(hg);
      const put = (geo, m, x, y, z, sh = true) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); q.castShadow = sh; hg.add(q); return q; };
      for (const q of K.parts) put(q, body, 0, 0, 0); put(K.mane, trim || body, 0, 0, 0);
      for (const s of [-1, 1]) { const e = put(K.ear, body, 0.12, 3.82, s * 0.2); e.rotation.set(s * 0.3, 0, 0.15); const ey = put(new THREE.SphereGeometry(0.13, 10, 8), glowM, 0.62, 3.52, s * 0.4, false); ey.scale.set(1.2, 0.85, 0.7); put(new THREE.SphereGeometry(0.06, 6, 4), glowM, 1.55, 2.7, s * 0.14, false); }
    }
    else add(lathe(type), body);
    const ringY = { P: 1.85, R: 2.9, B: 2.85, Q: 3.7, K: 4.1, N: 0.95 }[type], ringR = { P: 0.72, R: 1.0, B: 0.8, Q: 0.9, K: 1.0, N: 0.82 }[type];
    const ring = add(new THREE.TorusGeometry(ringR, 0.07, 6, 28), glowM, ringY); ring.rotation.x = PI / 2; ring.castShadow = false;
    if (type === 'Q') { const pt = geoCache.Qp || (geoCache.Qp = new THREE.ConeGeometry(0.1, 0.34, 6).translate(0, 0.17, 0)), gm = geoCache.Qg || (geoCache.Qg = new THREE.SphereGeometry(0.075, 10, 8)); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, s = add(pt, trim || body, 4.92); s.position.set(Math.sin(a) * 0.95, 4.92, Math.cos(a) * 0.95); s.rotation.order = 'YXZ'; s.rotation.set(0.35, a, 0); s.castShadow = false; const e = add(gm, trim && pieceMesh.qGem ? pieceMesh.qGem : glowM, 5.24); e.position.set(Math.sin(a) * 1.06, 5.24, Math.cos(a) * 1.06); e.castShadow = false; } }
    if (type === 'R') { for (let k = 0; k < 6; k++) { const m = add(new THREE.BoxGeometry(0.42, 0.4, 0.3), body, 3.75); m.position.set(Math.sin(k / 6 * TAU) * 0.9, 3.75, Math.cos(k / 6 * TAU) * 0.9); m.rotation.y = k / 6 * TAU; } const c = add(new THREE.TorusGeometry(0.74, 0.05, 5, 28), glowM, 3.58); c.rotation.x = PI / 2; c.castShadow = false; }
    if (type === 'B') { const sl = add(new THREE.BoxGeometry(0.05, 0.62, 1.26), glowM, 3.95); sl.rotation.x = 0.6; sl.castShadow = false; }
    if (trim) { // gold base band and a thin gold line above the collar, the King's trim language
      const t = add(new THREE.TorusGeometry(BASE_R[type], 0.06, 6, 32), trim, 0.22); t.rotation.x = PI / 2; t.castShadow = false;
      const t2 = add(new THREE.TorusGeometry(ringR * 0.86, 0.035, 5, 28), trim, ringY + (type === 'N' ? -0.35 : 0.22)); t2.rotation.x = PI / 2; t2.castShadow = false;
      if (type === 'R') { const t3 = add(new THREE.TorusGeometry(1.06, 0.045, 5, 32), trim, 3.42); t3.rotation.x = PI / 2; t3.castShadow = false; }
    }
    return g;
  }
  function kingMesh(S) {
    const g = new THREE.Group(), add = (geo, m, y = 0, sh = true) => { const q = new THREE.Mesh(geo, m); q.position.y = y; q.castShadow = sh; g.add(q); return q; };
    add(lathe('KB'), S.kingM);
    const felt = add(new THREE.CylinderGeometry(1.8, 1.8, 0.1, 40), S.feltM, 0.03, false);
    const band = (r, tube, y) => { const t = add(new THREE.TorusGeometry(r, tube, 8, 48), S.goldKM, y, false); t.rotation.x = PI / 2; return t; };
    band(1.8, 0.075, 0.2); band(1.39, 0.05, 0.53); band(0.62, 0.05, 3.72); band(0.74, 0.045, 4.32); band(1.17, 0.07, 5.62);
    const collar = add(new THREE.TorusGeometry(1.07, 0.085, 8, 40), S.glowM, 4.1, false); collar.rotation.x = PI / 2;
    // crown: eight separate points, each tipped with a gem that ignites as the fight goes on
    const prong = new THREE.ConeGeometry(0.28, 1.1, 8); prong.translate(0, 0.55, 0);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, m = add(prong, S.goldKM, 5.62); m.position.set(Math.sin(a) * 1.06, 5.62, Math.cos(a) * 1.06); m.rotation.order = 'YXZ'; m.rotation.set(0.3, a, 0); const gm = add(new THREE.OctahedronGeometry(0.17, 0), S.gemM, 0, false); gm.position.set(Math.sin(a) * 1.38, 6.62, Math.cos(a) * 1.38); }
    add(new THREE.CylinderGeometry(0.22, 0.34, 0.8, 16), S.goldKM, 5.95);
    add(new THREE.SphereGeometry(0.42, 20, 14), S.goldKM, 6.55);
    const cs = new THREE.Shape(), w = 0.2, P = [[-w, 0], [w, 0], [w, 0.95], [0.72, 0.95], [0.72, 1.35], [w, 1.35], [w, 1.95], [-w, 1.95], [-w, 1.35], [-0.72, 1.35], [-0.72, 0.95], [-w, 0.95]];
    cs.moveTo(P[0][0], P[0][1]); for (let k = 1; k < P.length; k++) cs.lineTo(P[k][0], P[k][1]); cs.closePath();
    const cg = new THREE.ExtrudeGeometry(cs, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 2 }); cg.translate(0, 0, -0.12);
    S.cross = add(cg, S.goldKM, 6.85);
    const ci = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.42), S.gemM); ci.position.set(0, 1.0, 0); S.cross.add(ci); const ci2 = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 0.42), S.gemM); ci2.position.set(0, 1.15, 0); S.cross.add(ci2);
    return g;
  }

  function build(b) {
    const g = G.world, S = b.state;
    // the shared sky only shows through the open ceiling; its warm "sun" straight overhead is the study lamp, which the glossy board and pieces reflect
    const sky = W.sky({ top: 0x0a0c14, horizon: 0x2a1e16, bottom: 0x080604, stars: 0, sunDir: [0.12, 1, -0.2], sunColor: 0x18110a, sunSize: 0.7, sunGlow: 0.5, clouds: 0, exp: 0.8 });
    g.add(sky); S.sky = sky; W.env(sky, 0.55);
    scene.fog = new THREE.FogExp2(0x1a1410, 0.0042); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x9a948a, 0x2a1e14, 0.7);
    S.keyDir = new V3(-0.45, 0.85, -0.3).normalize();
    S.key = W.sun(g, { dir: S.keyDir.toArray(), color: 0xffd6a0, intensity: 2.6, size: 30 });
    S.rim = new THREE.DirectionalLight(0x9ab8ff, 1.0); S.rim.position.set(-14, 90, -40); g.add(S.rim); g.add(S.rim.target);
    S.cool = new THREE.DirectionalLight(0x7a7a80, 0.2); S.cool.position.set(60, 20, 30); g.add(S.cool); g.add(S.cool.target);
    S.T = { value: 0 }; S.rimU = { value: new THREE.Color(0x3a5a8a) }; S.emberU = { value: 0 }; S.EC = { value: new THREE.Color(EMBER) };

    // board: ivory marble squares with faint veins, polished ebony squares that crack open with embers as the fight heats up
    S.poolU = { value: 1 }; S.telA = new Float32Array(64); S.tel = new Float64Array(64); TEL = S.tel;
    const lightM = shade(new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.0, color: 0xe6dcc6, envMapIntensity: 0.9 }), 'ivory', { uPool: S.poolU }, { decl: 'uniform float uPool;',
      map: '{ vec2 p=vWP.xz; float w=fb3(vec3(p*0.16,1.0)); float vein=pow(1.0-abs(sin(p.x*0.31+p.y*0.23+w*7.0)),16.0); float cl=fb3(vec3(p*0.8,3.0)); vec2 f=fract((p+18.0)/4.5); float ed=min(min(f.x,1.0-f.x),min(f.y,1.0-f.y));\n diffuseColor.rgb*=mix(vec3(1.0),vec3(0.72,0.66,0.56),vein*0.55)*(0.92+0.1*cl)*(0.82+0.18*smoothstep(0.0,0.035,ed))*mix(1.0,0.62+0.62*exp(-dot(p,p)/320.0),uPool); }' });
    const darkM = shade(new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.05, color: 0xffffff, envMapIntensity: 1.25 }), 'ebony', { uEmber: S.emberU, uEC: S.EC, uT: S.T, uPool: S.poolU, uTel: { value: S.telA }, uVI: S.veinI = { value: 0 }, uVH: S.veinH = { value: 0 } }, {
      decl: 'uniform float uEmber,uT,uPool,uVI,uVH; uniform vec3 uEC; uniform float uTel[64];',
      map: '{ vec2 p=vWP.xz; vec2 id=floor((p+18.0)/4.5); float alt=mod(id.x+id.y,4.0)<2.0?1.0:0.0; vec2 gp=mix(p.yx,p,alt); float gr=fb3(vec3(gp.x*0.35,gp.y*5.0,id.x*3.0+id.y)); float fl=fb3(vec3(p*0.4,5.0));\n diffuseColor.rgb=mix(vec3(0.026,0.016,0.011),vec3(0.085,0.052,0.034),gr*0.8+fl*0.3)*mix(1.0,0.62+0.62*exp(-dot(p,p)/320.0),uPool); }',
      rough: '{ vec2 p=vWP.xz; roughnessFactor=0.27+0.12*fb3(vec3(p*1.3,9.0)); }',
      emit: 'if (uEmber>0.001 && vWP.y>-0.02) { vec2 p=vWP.xz; vec2 id=clamp(floor((p+18.0)/4.5),0.0,7.0); vec2 f=fract((p+18.0)/4.5); float clr=(1.0-clamp(uTel[int(id.y*8.0+id.x)],0.0,1.0))*smoothstep(0.1,0.2,length(f-0.5));\n float v=abs(fb3(vec3(p*0.5,7.0))-0.5); float msk=smoothstep(0.42,0.62,fb3(vec3(p*0.11,2.0))+uEmber*0.22); float wv=0.35+1.3*n3(vec3(p*0.3,3.0)), bv=0.3+0.9*n3(vec3(p*0.21,5.0)); float ve=(1.0-smoothstep(0.002*wv,(0.004+uEmber*0.009)*wv,v))*msk*bv; float co=(1.0-smoothstep(0.0,(0.0015+uEmber*0.003)*wv,v))*msk*smoothstep(0.62,0.8,n3(vec3(p*0.45,9.0))); float hl=(1.0-smoothstep(0.0,0.04,v))*0.1*msk;\n float pu=0.6+0.4*sin(uT*0.7+p.x*0.2+p.y*0.14); vec3 vc=mix(vec3(0.7,0.13,0.03),vec3(1.0,0.32,0.08),uVH); totalEmissiveRadiance+=(vc*(ve+hl)+vec3(1.0,0.85,0.55)*co*uVH*1.3)*pu*uVI*clr; }',
    });
    const sq = new THREE.BoxGeometry(C - 0.04, 0.5, C - 0.04);
    const li = new THREE.InstancedMesh(sq, lightM, 32), di = new THREE.InstancedMesh(sq, darkM, 32); let nl = 0, nd = 0;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { _m.position.set(cx(i), -0.25, cx(j)); _m.rotation.set(0, 0, 0); _m.scale.setScalar(1); _m.updateMatrix(); if ((i + j) & 1) di.setMatrixAt(nd++, _m.matrix); else li.setMatrixAt(nl++, _m.matrix); }
    li.receiveShadow = di.receiveShadow = true; g.add(li); g.add(di);
    const under = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.1, 0.4, HALF * 2 + 0.1), W.mat({ color: 0x0a0605, roughness: 0.6 })); under.position.y = -0.3; g.add(under);
    const walnut = W.surface('wood', { seed: 4, dark: 0x2c170c, light: 0x5e3822 });
    const fh = frameTex(true), fv = frameTex(false);
    const fmH = new THREE.MeshStandardMaterial({ map: fh.map, metalnessMap: fh.metalnessMap, metalness: 0.85, roughness: 0.4, envMapIntensity: 1.0 }), fmV = new THREE.MeshStandardMaterial({ map: fv.map, metalnessMap: fv.metalnessMap, metalness: 0.85, roughness: 0.4, envMapIntensity: 1.0 });
    for (const [x, z, w, d, m] of [[0, -HALF - 1.5, HALF * 2 + 6, 3, fmH], [0, HALF + 1.5, HALF * 2 + 6, 3, fmH], [-HALF - 1.5, 0, 3, HALF * 2, fmV], [HALF + 1.5, 0, 3, HALF * 2, fmV]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), m); f.position.set(x, -0.35, z); f.receiveShadow = true; f.castShadow = true; g.add(f); }
    const moulding = new THREE.MeshStandardMaterial({ map: walnut.map, color: 0x4a2c1a, roughness: 0.45, envMapIntensity: 0.8 });
    for (const [x, z, w, d] of [[0, -HALF - 3.25, HALF * 2 + 7.5, 0.75], [0, HALF + 3.25, HALF * 2 + 7.5, 0.75], [-HALF - 3.25, 0, 0.75, HALF * 2 + 6], [HALF + 3.25, 0, 0.75, HALF * 2 + 6]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), moulding); f.position.set(x, -0.6, z); f.receiveShadow = true; g.add(f); }
    S.brassM = W.mat({ color: 0xb88a40, roughness: 0.42, metalness: 0.85, envMapIntensity: 1.1 });
    const finial = new THREE.LatheGeometry([[0, 0], [0.95, 0], [1.0, 0.18], [0.6, 0.35], [0.45, 0.6], [0.7, 0.95], [0.72, 1.15], [0.4, 1.45], [0.22, 1.7], [0.3, 1.85], [0, 2.0]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const k = new THREE.Mesh(finial, S.brassM); k.position.set(sx * (HALF + 1.5), 0.2, sz * (HALF + 1.5)); k.castShadow = true; g.add(k); }

    // the table: broad varnished planks with growth rings and knots, fading to an even tone in the distance so it never shimmers
    const table = S.table = new THREE.Mesh(new THREE.PlaneGeometry(330, 330), shade(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, envMapIntensity: 0.7 }), 'table', { uDs: S.dsU = { value: 0 } }, {
      decl: 'float tGap, tGrain, tFd; uniform float uDs;',
      map: '{ vec2 p=vWP.xz; float pl=floor(p.y/15.0), fv=fract(p.y/15.0); float hp=fract(sin(pl*91.7)*4375.85); float gap=smoothstep(0.0,0.02,fv)*smoothstep(1.0,0.98,fv); float px=p.x+hp*300.0;\n float ring=fb3(vec3(px*0.03,p.y*0.13,pl*1.7)); float band=fract(ring*7.0+fv*0.5); band=smoothstep(0.0,0.4,band)*smoothstep(1.0,0.55,band);\n float grain=fb3(vec3(px*0.13,p.y*0.9,pl*3.0)); gap=mix(gap,1.0,smoothstep(8.0,28.0,length(vWP-cameraPosition))); float kn=smoothstep(0.8,0.88,n3(vec3(px*0.035,fv*2.5,pl*5.0)));\n float fd=smoothstep(22.0,105.0,length(vWP-cameraPosition)); float tone=mix(0.3+0.42*band+0.28*grain,0.42+0.1*n3(vec3(p*0.04,2.0)),fd); tone=mix(tone,0.08,kn*(1.0-fd)*0.8);\n diffuseColor.rgb=mix(vec3(0.04,0.022,0.012),vec3(0.21,0.12,0.062),tone)*mix(0.28,1.0,mix(gap,1.0,fd))*diffuse; diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(0.3,0.5,0.2)))*diffuse,uDs); tGap=mix(gap,1.0,fd); tGrain=grain*(1.0-fd); tFd=fd; }',
      rough: 'roughnessFactor=mix(mix(0.3+0.16*tGrain,0.75,1.0-tGap),0.5,tFd);',
    }));
    table.rotation.x = -PI / 2; table.position.y = -0.9; table.receiveShadow = true; g.add(table);
    const apronM = W.mat({ color: 0x24140a, roughness: 0.5, envMapIntensity: 0.6 });
    for (const [x, z, w, d] of [[0, -166, 336, 6], [0, 166, 336, 6], [-166, 0, 6, 336], [166, 0, 6, 336]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), apronM); f.position.set(x, -3.2, z); g.add(f); }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), W.mat({ color: 0x0c0806, roughness: 0.9 })); floor.rotation.x = -PI / 2; floor.position.y = -160; g.add(floor);
    // the room: a library wall around the table. Tall moonlit windows beyond the King, a hearth glowing behind the hero, shelves of books between
    S.wallU = { uFog: { value: S.fog.color }, uWall: { value: new THREE.Color(0x2c2016) }, uWin: { value: new THREE.Color(0x4a6898) }, uWinI: { value: 0.7 }, uHearth: { value: new THREE.Color(0xff7a30) }, uHI: { value: 1 }, uT: S.T, uRed: { value: 0 } };
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(310, 310, 560, 96, 1, true), new THREE.ShaderMaterial({ uniforms: S.wallU, side: THREE.BackSide, fog: false, depthWrite: true,
      vertexShader: 'varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.0); }',
      fragmentShader: `uniform vec3 uFog,uWall,uWin,uHearth; uniform float uWinI,uHI,uT,uRed; varying vec3 vP;
        float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
        float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
        void main(){
          float az=atan(vP.x,vP.z), y=vP.y, R=310.0;
          vec3 col=uWall*(0.45+0.55*smoothstep(-40.0,240.0,y));
          float wm=0.0, spill=0.0;
          for(int i=0;i<3;i++){ float c=3.14159+float(i-1)*0.33; float d=abs(mod(az-c+3.14159,6.28318)-3.14159)*R; float top=190.0;
            float inW=step(d,21.0)*step(14.0,y)*min(1.0,step(y,top)+step(length(vec2(d,y-top)),21.0)); float fr=step(d,25.0)*step(10.0,y)*min(1.0,step(y,top)+step(length(vec2(d,y-top)),25.0));
            float ux=abs(fract(d/7.0+0.5)-0.5), uy=abs(fract(y/18.0)-0.5), fx=fwidth(d/7.0)+0.002, fy=fwidth(y/18.0)+0.002; float mul=max(1.0-smoothstep(0.06-fx,0.06+fx,ux),1.0-smoothstep(0.045-fy,0.045+fy,uy));
            vec3 gl=uWin*(0.3+0.7*smoothstep(14.0,210.0,y))*(1.0-0.45*d/21.0)*(0.85+0.15*h21(floor(vec2(d/7.0,y/18.0))))*(1.0-mul*0.96);
            col=mix(col,vec3(0.02,0.015,0.012),fr*(1.0-inW)); col=mix(col,gl*uWinI,inW); wm=max(wm,fr);
            spill+=(exp(-d/70.0)*0.4+exp(-max(d-25.0,0.0)/14.0)*1.2)*smoothstep(-30.0,120.0,y)*(1.0-fr); }
          col+=uWin*uWinI*spill*0.06;
          { float d=abs(mod(az+3.14159,6.28318)-3.14159)*R, hw=46.0, top=34.0; float fl=0.85+0.15*sin(uT*3.1)*sin(uT*1.7+1.3);
            float inA=step(d,hw)*step(-40.0,y)*min(1.0,step(y,top)+step(length(vec2(d,y-top)),hw)); float fr=step(d,hw+12.0)*step(-40.0,y)*min(1.0,step(y,top)+step(length(vec2(d,y-top)),hw+12.0));
            float fn=n2(vec2(d*0.07,y*0.045-uT*1.1))*0.6+n2(vec2(d*0.19,y*0.11-uT*2.3))*0.4; float flame=clamp(1.0-(y+24.0)/(60.0+fn*40.0)+fn*0.35-0.2,0.0,1.0)*(1.0-smoothstep(hw*0.5,hw,d)*0.7);
            vec3 hc=vec3(0.02,0.012,0.008)+uHearth*uHI*fl*(flame*flame*1.6+0.03);
            float st=0.75+0.25*n2(vec2(d,y)*0.15); float jt=step(abs(fract((d+hw)/14.0+0.5*step(0.5,fract(y/16.0)))-0.5),0.04)+step(abs(fract(y/16.0)-0.5),0.03);
            col=mix(col,vec3(0.09,0.075,0.065)*st*(1.0-0.5*min(1.0,jt)),fr*(1.0-inA)); col=mix(col,hc,inA);
            col+=uHearth*uHI*fl*exp(-max(d-hw,0.0)/60.0)*0.05*(1.0-fr)*(1.0-smoothstep(0.0,140.0,y)); wm=max(wm,fr); }
          { float sh=fract((y+8.0)/34.0), row=floor((y+8.0)/34.0), u=az*R; float shelf=smoothstep(0.0,0.05,sh)*(1.0-smoothstep(0.9,0.94,sh));
            float bi=floor(u/2.4); float bh=0.42+0.48*h21(vec2(bi,row)); float bk=step(sh,bh)*shelf*step(0.12,h21(vec2(bi*1.3,row+7.0)))*step(0.06,h21(vec2(floor(bi/7.0),row+1.0)));
            float run=floor(bi/(3.0+floor(h21(vec2(row,5.0))*4.0))); vec3 bc=mix(vec3(0.09,0.04,0.028),vec3(0.04,0.05,0.06),h21(vec2(run,row*3.0)))*(0.55+0.4*h21(vec2(run+3.0,row)))*(0.85+0.15*h21(vec2(bi,row))); bc=mix(bc,vec3(dot(bc,vec3(0.33))),0.35)*(0.35+0.65*smoothstep(0.93,0.45,sh));
            bc+=vec3(0.09,0.065,0.025)*step(abs(sh-bh*0.75),0.012)*step(0.5,h21(vec2(bi,row+2.0)));
            float use=(1.0-wm)*step(-10.0,y)*step(y,250.0); col=mix(col,mix(col*0.3*(0.4+0.6*smoothstep(0.93,0.5,sh)),bc,bk),use); }
          { float pool=0.0; for(int i=0;i<5;i++){ float c=float(i)*1.05+0.9; float d=abs(mod(az-c+3.14159,6.28318)-3.14159)*R; pool+=exp(-d*d/5200.0)*exp(-(y-40.0)*(y-40.0)/9000.0); } col*=(0.5+0.9*min(pool,1.0))*(1.0-wm)+wm; }
          col=mix(col,uFog,0.32); col*=1.0+uRed*vec3(0.25,-0.1,-0.15);
          gl_FragColor=vec4(max(col,vec3(0.0)),1.0);
        }` }));
    wall.position.y = 110; wall.renderOrder = -50; g.add(wall);

    // the candle: it burns down over the fight; translucent wax that glows from the flame, a brass stick, a sprite flame and halo
    S.flameC = { value: new THREE.Color(0xff9a40) };
    const wax = shade(new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.55 }), 'wax', { uFC: S.flameC }, {
      decl: 'uniform vec3 uFC;',
      map: '{ float yy=vOP.y+0.5; float a=atan(vOP.x,vOP.z); float dr=smoothstep(0.5,1.0,sin(a*7.0+sin(a*3.0)*2.0))*smoothstep(0.15+0.5*fract(sin(floor(a*7.0/6.2832*7.0+0.5)*17.3)*43.7),1.0,yy); diffuseColor.rgb*=mix(0.7,1.0,yy)*(1.0+0.16*dr); }',
      emit: '{ float yy=vOP.y+0.5; diffuseColor.rgb*=0.22+0.78*pow(nd,0.8); totalEmissiveRadiance+=uFC*((0.03+0.08*yy)*nd+pow(smoothstep(0.45,1.0,yy),2.0)*0.6*(0.4+0.6*nd)); }',
    });
    S.candle = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 1, 28), wax); S.candle.position.set(-62, 0, -74); g.add(S.candle);
    S.lip = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.7, 8, 28), wax); S.lip.rotation.x = PI / 2; g.add(S.lip);
    { const dr = mulberry(12); for (let k = 0; k < 9; k++) { const a = k / 9 * TAU + dr() * 0.4, len = 1.5 + dr() * 3.5, d = new THREE.Mesh(new THREE.CapsuleGeometry(0.42 + dr() * 0.25, len, 4, 8), S.dripM || (S.dripM = W.mat({ color: 0xf2e6cc, roughness: 0.45, emissive: 0xff9a40, emissiveIntensity: 0.28 }))); d.rotation.x = PI / 2; d.position.set(Math.cos(a) * 7.05, Math.sin(a) * 7.05, len / 2 + 0.2); S.lip.add(d); } }
    const stick = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [14, 0], [14.5, 0.8], [13, 1.6], [9, 2.2], [8.2, 3.4], [8.8, 4.2], [7.6, 4.6], [0, 4.6]].map(([r, y]) => new THREE.Vector2(r, y)), 32), S.brassM); stick.position.set(-62, -0.9, -74); g.add(stick);
    S.flameM = new THREE.SpriteMaterial({ map: softTex([[0, 'rgba(255,255,240,1)'], [0.25, 'rgba(255,210,120,1)'], [0.6, 'rgba(255,120,40,0.85)'], [1, 'rgba(120,30,0,0)']], true), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    S.flame = new THREE.Sprite(S.flameM); g.add(S.flame);
    S.candleL = new THREE.PointLight(0xff8a30, 0, 120, 1.4); g.add(S.candleL);
    S.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex([[0, 'rgba(255,180,90,0.55)'], [0.3, 'rgba(255,120,40,0.18)'], [1, 'rgba(0,0,0,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); S.halo.scale.setScalar(46); g.add(S.halo);
    // books: tooled leather covers, page blocks
    const vr = mulberry(41), bookC = ['#5a1810', '#16303a', '#3a3010', '#2a1030', '#103018'], pgM = new THREE.MeshStandardMaterial({ map: pageTex(), color: 0x8a7c66, roughness: 0.85 });
    for (let k = 0; k < 5; k++) { const bk = new THREE.Mesh(new THREE.BoxGeometry(58 - k * 4, 8 + vr() * 4, 40 - k * 2), new THREE.MeshStandardMaterial({ map: coverTex(bookC[k], k + 3), roughness: 0.62 })); bk.position.set(100 + vr() * 6, 4 + k * 10.5, -78 + vr() * 6); bk.rotation.y = 0.35 + (vr() - 0.5) * 0.5; g.add(bk); const pg = new THREE.Mesh(new THREE.BoxGeometry(56 - k * 4, bk.geometry.parameters.height - 2, 38 - k * 2), pgM); pg.position.copy(bk.position); pg.position.x -= 2; pg.rotation.y = bk.rotation.y; g.add(pg); }
    // the chess clock on the table beyond the board; it runs away in the Blitz
    const clock = new THREE.Group(); clock.position.set(-16, -0.9, -138); clock.rotation.y = 0.1; clock.scale.setScalar(0.62); g.add(clock); S.clock = clock;
    const caseM = new THREE.MeshStandardMaterial({ map: walnut.map, color: 0x6a4028, roughness: 0.45, envMapIntensity: 0.8 });
    const cb = (w, h, d, x, y, z, m, rx = 0) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.position.set(x, y, z); q.rotation.x = rx; clock.add(q); return q; };
    cb(76, 2.4, 28, 0, 1.2, 0, caseM); cb(70, 26, 20, 0, 15, 0, caseM); cb(73, 2.2, 23, 0, 29, 0, caseM); cb(70, 2, 2, 0, 3.5, 10.6, S.brassM);
    const dt = dialTex(); S.dialM = new THREE.MeshStandardMaterial({ map: dt.map, emissive: EMBER, emissiveMap: dt.emissiveMap, emissiveIntensity: 0, roughness: 0.5 });
    const handM = W.mat({ color: 0x0e0a08, roughness: 0.4, metalness: 0.3 }); S.hands = [];
    for (const sx of [-1, 1]) {
      const bz = new THREE.Mesh(new THREE.TorusGeometry(10.8, 1.1, 10, 48), S.brassM); bz.position.set(sx * 17, 15.5, 10.4); clock.add(bz);
      const face = new THREE.Mesh(new THREE.CircleGeometry(10.4, 48), S.dialM); face.position.set(sx * 17, 15.5, 10.2); clock.add(face);
      const hs = [[0.9, 6.0], [0.55, 8.8]].map(([w, l]) => { const pv = new THREE.Group(), h = new THREE.Mesh(new THREE.BoxGeometry(w, l, 0.35), handM); h.position.y = l / 2 - 0.8; pv.add(h); pv.position.set(sx * 17, 15.5, 10.9); clock.add(pv); return pv; }); S.hands.push(hs);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.6, 12), S.brassM); pin.rotation.x = PI / 2; pin.position.set(sx * 17, 15.5, 11.1); clock.add(pin);
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 2.2, 20), S.brassM); pl.position.set(sx * 17, 31.2, 0); clock.add(pl); const st = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.6, 12), handM); st.position.set(sx * 17, 30.6, 0); clock.add(st);
    }
    S.flag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), W.mat({ color: 0xb01810, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x400804 })); S.flag.position.set(17 + 1.1, 15.5 + 9.6, 11.0); clock.add(S.flag);
    // captured white pieces lying off the board
    S.ivoryM = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.3, envMapIntensity: 1.2 });
    for (const [t, x, z, ry] of [['P', -30, 8, 0.4], ['R', -27, -6, 2.1], ['P', 29, 12, 4.0], ['B', 31, -3, 1.2]]) { const m = new THREE.Mesh(lathe(t), S.ivoryM); m.position.set(x, 0.35, z); m.rotation.set(PI / 2, 0, ry, 'YXZ'); m.rotation.y = ry; m.castShadow = true; g.add(m); }
    S.motes = W.motes({ n: 300, box: [80, 30, 80], color: 0xffd0a0, size: 0.16, vel: [0.12, 0.05, 0.08], sway: 0.5, center: [0, 13, 0], alpha: 0.5 }); g.add(S.motes);
    S.dust = W.motes({ n: 420, box: [46, 18, 46], color: 0xffe2b8, size: 0.24, vel: [0.05, -0.06, 0.04], sway: 0.9, center: [0, 9, -2], alpha: 0.9 }); g.add(S.dust);
    S.haze = W.motes({ n: 220, box: [44, 3, 44], color: 0xff6a28, size: 0.11, vel: [0.04, 0.25, 0.03], sway: 0.6, center: [0, 1.6, 0], alpha: 0 }); g.add(S.haze);
    // the study lamp hanging over the board: a green enamel shade, a hot bulb, a soft cone of light full of dust
    const lamp = new THREE.Group(); lamp.position.set(0, 27, 0); g.add(lamp); S.lamp = lamp;
    const shadeM = W.mat({ color: 0x18301e, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }); S.lampInM = W.glow(0xffd8a0, 1.4, { side: THREE.BackSide });
    const shG = new THREE.LatheGeometry([[1.2, 4.2], [2.2, 3.6], [5.5, 1.4], [9.5, -0.6], [10.2, -1.0]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
    lamp.add(new THREE.Mesh(shG, shadeM)); const shI = new THREE.Mesh(shG, S.lampInM); shI.scale.setScalar(0.97); lamp.add(shI);
    const rimL = new THREE.Mesh(new THREE.TorusGeometry(10.2, 0.25, 6, 48), S.brassM); rimL.rotation.x = PI / 2; rimL.position.y = -1.0; lamp.add(rimL);
    S.bulbM = W.glow(0xfff0d0, 3); const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), S.bulbM); bulb.position.y = 0.6; lamp.add(bulb);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 120, 6), S.brassM); chain.position.y = 64; lamp.add(chain);
    const volMat = (col, I) => new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(col) }, uI: I, uT: S.T }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
      vertexShader: 'varying vec3 vW; varying vec2 vUv; varying float vF; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.0)).xyz; vec3 n=normalize(mat3(modelMatrix)*normal); vF=abs(dot(n,normalize(cameraPosition-vW))); gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uI,uT; varying vec3 vW; varying vec2 vUv; varying float vF; float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); } float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); } void main(){ float n=0.6+0.4*n2(vec2(vUv.x*14.0+uT*0.05,vW.y*0.08-uT*0.1)); float a=uI*smoothstep(1.0,0.9,vUv.y)*smoothstep(0.05,0.6,vUv.y)*smoothstep(4.0,18.0,vW.y)*smoothstep(0.0,0.7,vF)*n*0.09; gl_FragColor=vec4(uC*a,a); }' });
    S.lampI = { value: 1 }; S.shaftI = { value: 0.15 };
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 30, 26, 40, 1, true), volMat(0xffc888, S.lampI)); cone.position.y = 14;
    S.lampHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex([[0, 'rgba(255,220,160,0.8)'], [0.3, 'rgba(255,170,80,0.25)'], [1, 'rgba(0,0,0,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); S.lampHalo.scale.setScalar(26); S.lampHalo.position.y = -1.5; lamp.add(S.lampHalo); cone.renderOrder = 16; g.add(cone);
    for (let i = 0; i < 3; i++) { const az = PI + (i - 1) * 0.33, a = new V3(Math.sin(az) * 300, 110, Math.cos(az) * 300), e = new V3(Math.sin(az) * 46 + (i - 1) * 8, -6, Math.cos(az) * 46), dv = e.clone().sub(a), L = dv.length();
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(12, 20, L, 24, 1, true), volMat(0x9ab8ff, S.shaftI)); sh.position.copy(a).add(e).multiplyScalar(0.5); sh.quaternion.setFromUnitVectors(new V3(0, -1, 0), dv.normalize()); sh.renderOrder = 16; g.add(sh); }
    // Blitz: board chips torn loose, drifting around the board
    S.shardM = shade(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, envMapIntensity: 1.0 }), 'shard', { uEC: S.EC, uEmber: S.emberU }, { decl: 'uniform vec3 uEC; uniform float uEmber;', emit: 'totalEmissiveRadiance+=uEC*pow(1.0-nd,3.0)*0.18*uEmber;' });
    const chipG = new THREE.BoxGeometry(1.8, 0.14, 1.8), splG = new THREE.BoxGeometry(0.16, 0.12, 1.8); chipG.translate(0, 0, 0); const mixG = new THREE.BufferGeometry(); { const a = chipG.toNonIndexed(), b2 = splG.toNonIndexed(); b2.translate(0.9, 0.3, 0.2); for (const k of ['position', 'normal', 'uv']) mixG.setAttribute(k, new THREE.BufferAttribute(new Float32Array([...a.attributes[k].array, ...b2.attributes[k].array]), a.attributes[k].itemSize)); }
    S.shards = new THREE.InstancedMesh(mixG, S.shardM, 36); S.shards.frustumCulled = false; const sr = mulberry(77);
    S.shardP = Array.from({ length: 36 }, (_, k) => { _c.setHex(k % 2 ? 0xe6dcc6 : 0x1a110c); S.shards.setColorAt(k, _c); return { a: PI / 2 + (sr() - 0.5) * 1.3, r: 28 + sr() * 16, y: 8 + sr() * 14, s: 0.7 + sr() * 0.9, w: (sr() - 0.5) * 0.2, sp: sr() * 3 }; });
    _m.position.set(0, -50, 0); _m.scale.setScalar(0.001); _m.updateMatrix(); for (let k = 0; k < 36; k++) S.shards.setMatrixAt(k, _m.matrix); g.add(S.shards);

    // pieces: a pool of every piece the fight can show, built now so nothing compiles mid-fight. Each has its own body material so it can fade when it hides the hero.
    S.glowM = W.glow(EMBER, 2.2); S.goldRimU = { value: new THREE.Color(0x5a3c10) };
    const goldMat = (u = S.goldRimU) => shade(new THREE.MeshStandardMaterial({ color: 0xd0a050, roughness: 0.38, metalness: 0.7, envMapIntensity: 1.3, transparent: true }), 'gold', { uRim: u }, { decl: 'uniform vec3 uRim;', map: '{ float a=atan(vOP.x,vOP.z); diffuseColor.rgb*=0.78+0.22*step(0.0,sin(a*28.0+sin(vOP.y*20.0)*2.0)); }', emit: 'totalEmissiveRadiance+=uRim*(0.35+pow(1.0-nd,2.0)*1.6);', post: FADE });
    const pieceMat = () => shade(new THREE.MeshStandardMaterial({ color: 0x1a1311, roughness: 0.3, metalness: 0.15, envMapIntensity: 1.4, transparent: true }), 'piece', { uRim: S.rimU }, { decl: 'uniform vec3 uRim;', emit: 'totalEmissiveRadiance+=uRim*pow(1.0-nd,3.0)*(0.35+0.65*smoothstep(0.0,1.5,vOP.y));', post: FADE });
        pieceMesh.qGem = W.glow(EMBER, 1.5);
    S.depthM = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true });
    S.pool = {}; for (const [t, n] of [['P', 5], ['R', 5], ['B', 5], ['N', 5], ['Q', 3]]) S.pool[t] = Array.from({ length: n }, () => { const mat = pieceMat(), gm = goldMat(), m = pieceMesh(t, mat, S.glowM, gm); m.visible = false; g.add(m); return { m, mat, gm, dm: prepass(m, [mat, gm], S.depthM), used: false }; });
    S.pieces = []; S.ver = 0;
    // pawn trails along the file ahead of each pawn (drawn even when empty so the shader compiles at load)
    S.trailN = 5; const tg = new THREE.PlaneGeometry(0.55, 1); tg.rotateX(-PI / 2);
    S.trail = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), S.trailN);
    S.trail.frustumCulled = false; S.trail.renderOrder = 8; S.trail.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(S.trailN * 3), 3);
    _m.position.set(0, 0.06, 0); _m.scale.setScalar(0.0001); _m.updateMatrix(); for (let n = 0; n < S.trailN; n++) S.trail.setMatrixAt(n, _m.matrix); g.add(S.trail);
    // annotation arrows for pieces that move before they strike
    S.arrowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa030).multiplyScalar(1.4), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    S.arrows = Array.from({ length: 6 }, () => { const a = new THREE.Group(), sh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1), S.arrowM), hd = new THREE.Mesh(new THREE.CircleGeometry(1.3, 3), S.arrowM); sh.rotation.x = -PI / 2; hd.rotation.x = -PI / 2; hd.rotation.z = -PI / 2; a.add(sh); a.add(hd); a.sh = sh; a.hd = hd; a.visible = false; a.renderOrder = 9; g.add(a); return a; });
    // the piece you are: a small ivory figure over the hero
    S.glyphM = new THREE.MeshBasicMaterial({ color: new THREE.Color(IVORY).multiplyScalar(1.3), transparent: true, opacity: 0.9 });
    S.glyph = {}; for (const t of ['R', 'B', 'N', 'Q']) { const m = pieceMesh(t, S.glyphM, S.glyphM); m.traverse((o) => { o.castShadow = false; }); m.scale.setScalar(0.17); m.visible = false; g.add(m); S.glyph[t] = m; }
    S.crown = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.75, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(1.8), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); S.crown.rotation.x = -PI / 2; S.crown.visible = false; S.crown.renderOrder = 9; g.add(S.crown);
    // knight strikes: faceted ember shards with a hot core, a soft halo and a short trail
    const haloT = softTex([[0, 'rgba(255,230,190,1)'], [0.18, 'rgba(255,140,60,0.9)'], [0.5, 'rgba(255,70,20,0.3)'], [1, 'rgba(0,0,0,0)']]);
    S.jHaloM = new THREE.SpriteMaterial({ map: haloT, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }); S.jTrailM = new THREE.SpriteMaterial({ map: haloT, color: new THREE.Color(EMBER).multiplyScalar(1.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 });
    S.jCoreM = shade(new THREE.MeshStandardMaterial({ color: 0x120c0a, roughness: 0.2, metalness: 0.3, envMapIntensity: 1.5, flatShading: true }), 'jshard', { uEC: S.EC }, { decl: 'uniform vec3 uEC;', emit: '{ float e=min(abs(vOP.x),min(abs(vOP.y/1.7),abs(vOP.z)))/0.62; float ed=1.0-smoothstep(0.015,0.06,e); float tip=smoothstep(0.75,1.0,abs(vOP.y)/1.054); totalEmissiveRadiance+=uEC*ed*1.6+vec3(1.0,0.85,0.6)*tip*1.5; }' }); const jg = new THREE.OctahedronGeometry(0.62, 0); jg.scale(1, 1.7, 1);
    S.scorchG = new THREE.RingGeometry(0.5, 2.3, 36); S.scorchG.rotateX(-PI / 2);
    S.jumps = Array.from({ length: 24 }, () => { const core = new THREE.Mesh(jg, S.jCoreM), halo = new THREE.Sprite(S.jHaloM), tr = [0, 1, 2, 3, 4, 5, 6, 7].map(() => { const s = new THREE.Sprite(S.jTrailM); s.visible = false; g.add(s); return s; }); halo.scale.setScalar(1.5); halo.renderOrder = 18; core.add(halo); core.visible = false; g.add(core);
      const sc = new THREE.Mesh(S.scorchG, new THREE.MeshBasicMaterial({ color: 0x0a0503, transparent: true, opacity: 0, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); sc.renderOrder = 7; sc.position.y = 0.03; g.add(sc); return { core, tr, sc, sT: 9, t: 1, dur: 1, a: new V3(), b: new V3() }; });

    // ---- the King ----
    S.kU = { uCrack: { value: 0.022 }, uHeat: { value: 0.7 }, uCore: { value: 0 }, uT: S.T, uKC: S.EC, uRim: S.rimU };
    S.kingM = shade(new THREE.MeshStandardMaterial({ color: 0x141012, roughness: 0.28, metalness: 0.2, envMapIntensity: 1.5, transparent: true }), 'king', S.kU, {
      decl: 'uniform float uCrack,uHeat,uCore,uT; uniform vec3 uKC,uRim;',
      emit: '{ float yk=smoothstep(0.7,1.5,vOP.y)*(1.0-smoothstep(5.3,5.65,vOP.y)); vec3 q=vOP*vec3(1.5,0.6,1.5); float n=fb3(q*1.25+vec3(3.0,0.0,1.0)); float r=abs(n-0.5); float w=uCrack*(0.45+1.1*n3(vOP*1.7+7.0));\n float cr=(1.0-smoothstep(w*0.35,w,r))*yk; float co=(1.0-smoothstep(0.0,w*0.45,r))*yk; float pu=0.7+0.3*sin(uT*2.2-vOP.y*1.6+n*9.0);\n float fill=(1.0-smoothstep(w*0.6,w*3.2,r))*yk; totalEmissiveRadiance+=uKC*(cr*uHeat*pu+cr*0.1+fill*0.12*uHeat)+vec3(1.0,0.85,0.6)*co*uCore*pu; totalEmissiveRadiance+=uRim*pow(1.0-nd,2.4)*2.0; }', post: FADE,
    });
    S.goldKM = goldMat({ value: new THREE.Color(0x8a5c1c) }); S.feltM = W.mat({ color: 0x1c4428, roughness: 1 }); S.gemM = W.glow(EMBER, 1);
    S.rig = kingMesh(S); S.rig.scale.setScalar(1.04); b.group.add(S.rig); S.kdm = prepass(S.rig, [S.kingM, S.goldKM], S.depthM);
    const glowT = softTex([[0, 'rgba(255,200,130,0.9)'], [0.35, 'rgba(255,140,60,0.3)'], [1, 'rgba(0,0,0,0)']]);
    S.khalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 })); S.khalo.scale.setScalar(9); g.add(S.khalo);
    S.gemHaloM = new THREE.SpriteMaterial({ map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 }); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, s = new THREE.Sprite(S.gemHaloM); s.position.set(Math.sin(a) * 1.38, 6.62, Math.cos(a) * 1.38); s.scale.setScalar(1.1); S.rig.add(s); }
    S.light = new THREE.PointLight(EMBER, 3, 12, 1.6); S.light.position.set(0, 5, 0); b.group.add(S.light);
    S.cur = null; look(b, 0, true);
    Object.assign(S, { lvl: 0, you: null, pending: null, inGambit: false, gcount: 0, checkUntil: 0, hop: 0, safeHint: null, age: 0, glyphPulse: 0, log: [] });
    return {
      edge: 'wall', spawn: { x: cx(4), z: cx(7) }, bossStart: { x: cx(3), z: cx(1), face: 0 }, camDist: 17,
      contains: (x, z) => Math.abs(x) <= HALF - 0.4 && Math.abs(z) <= HALF - 0.4,
      clamp(p) { p.x = clamp(p.x, -HALF + 0.4, HALF - 0.4); p.z = clamp(p.z, -HALF + 0.4, HALF - 0.4); },
      solid(p) { for (const q of S.pieces) { if (q.dropT > 0.15 || q.gone) continue; const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz); if (d < 1.75 && d > 0.001) { p.x = q.x + dx / d * 1.75; p.z = q.z + dz / d * 1.75; } } },
      bulletBounds: (x, z) => Math.abs(x) < HALF + 2 && Math.abs(z) < HALF + 2,
      camLimit(x, y, z) { return { x: clamp(x, -44, 44), y: Math.max(y, 0.5), z: clamp(z, -44, 44) }; },
    };
  }

  // ---------- board state ----------
  const kingCell = (b) => cellOf(b.pos.x, b.pos.z) || { i: 3, j: 1 };
  function occFn(b, list) { const k = kingCell(b), set = new Set(list.map((q) => q.j * 8 + q.i)); set.add(k.j * 8 + k.i); return (i, j) => set.has(j * 8 + i); }
  function take(S, type) { const P = S.pool[type]; for (const q of P) if (!q.used) { q.used = true; return q; } return null; }
  function place(b, type, i, j, o = {}) {
    const S = b.state, slot = take(S, type); if (!slot) return null;
    const q = Object.assign({ type, i, j, x: cx(i), z: cx(j), slot, dropT: 0, outT: 0, gone: false, keep: false, mv: null, born: S.age++ }, o);
    slot.m.visible = true; slot.m.scale.setScalar(1); slot.m.position.set(q.x, q.dropT > 0 ? 40 : 0, q.z); slot.m.rotation.y = 0;
    S.pieces.push(q); S.ver++; return q;
  }
  function retire(b, q) { if (q.gone) return; q.gone = true; q.outT = 0.45; b.state.ver++; }
  const live = (S) => S.pieces.filter((q) => !q.gone);
  // Plan a Gambit on the live board. If nothing passes even relaxed, retire the oldest piece that is not a Queen and try again.
  function plan(b, o, anyQ) {
    const S = b.state, p = G.player, pc = cellOf(p.pos.x, p.pos.z) || { i: 4, j: 7 }, k = kingCell(b);
    for (let n = 0; n < 7; n++) {
      const L = live(S), ctx = { pieces: L.map((q) => ({ ref: q, type: q.type, i: q.i, j: q.j, mover: !!(o.movers && o.movers.includes(q)) })), k, pc, px: p.pos.x, pz: p.pos.z, rnd: G.rng };
      const r = genPlan(ctx, o); if (r) return r;
      if (o.fixed) return null;
      // last resort only (the King far from the hero behind a wall of Queens): a Queen leaves too
      const old = L.filter((q) => q.type !== 'Q').sort((x, y) => x.born - y.born)[0] || (anyQ && L.sort((x, y) => x.born - y.born)[0]); if (!old) break; retire(b, old);
    }
    return null;
  }
  // scripted teaching boards, as offsets from the King (+z is toward the hero's side); mirrored and flipped at random
  const OPEN1 = [
    { you: 'R', fixed: [['R', 2, 3]] },                 // lines: line up with the King
    { you: 'R', fixed: [['R', 3, 3], ['B', 3, 1]] },    // a piece blocks another's line
    { you: 'B', fixed: [['R', 1, 1], ['N', -2, 3]] },   // your own diagonal can be blocked
    { you: 'R', types: ['N', 'R'] },                    // a knight, and safe is not enough
  ];
  function scripted(b, base, d) {
    const k = kingCell(b), vs = [[1, 1], [-1, 1], [1, -1], [-1, -1]].sort(() => G.rng() - 0.5);
    if (d.fixed) for (const [sx, sz] of vs) { const o = Object.assign({}, base, { you: d.you, range: [1, 14], fixed: d.fixed.map(([type, dx, dz]) => ({ type, i: k.i + dx * sx, j: k.j + dz * sz })) }); const r = plan(b, o); if (r) return [o, r]; }
    const o = Object.assign({}, base, { you: d.you, types: d.types || d.fixed.map((f) => f[0]) }); return [o, plan(b, o)];
  }
  let TEL = null;
  const sqHz = (i, j, delay, dmg, o) => (TEL && (TEL[j * 8 + i] = Math.max(TEL[j * 8 + i], G.now + delay)), Hz.rect(cx(i), cx(j) - C / 2 + 0.1, 0, C - 0.2, C - 0.2, delay, dmg, Object.assign({ quiet: true, silent: true }, o)));

  function strikeFX(b) {
    const S = b.state; Sound.sfx('bigboom', 0.8); Sound.sfx('sword', 0.9, 0.6); FX.shake(0.6);
    if (G.headless) return;
    const L = live(S), occ = occFn(b, L);
    for (const q of L) {
      const rays = []; attacks(q.type, q.i, q.j, occ, rays); const h = HEIGHT[q.type] * 0.7;
      for (const [i, j] of rays) {
        _a.set(q.x, h, q.z); _b.set(cx(i), 0.3, cx(j));
        if (q.type === 'N') { const J = S.jumps.find((x) => x.t >= x.dur); if (J) { J.a.copy(_a); J.b.copy(_b); J.t = 0; J.dur = Math.max(0.12, _a.distanceTo(_b) / 60); J.core.visible = true; } }
        else FX.beam(_a.clone(), _b.clone(), { color: EMBER, width: q.type === 'P' ? 0.3 : 0.55, dur: 0.45, mult: 3 });
      }
      q.kick = 1;
    }
    FX.flash(EMBER, 0.05, 0.25);
  }
  function showArrows(S, moves) {
    S.arrows.forEach((a) => { a.visible = false; });
    moves.forEach((mv, n) => {
      const a = S.arrows[n]; if (!a) return; const x0 = mv.ref.x, z0 = mv.ref.z, x1 = cx(mv.i), z1 = cx(mv.j), len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.1) return;
      a.visible = true; a.position.set(x0, 0.16, z0); a.rotation.y = Math.atan2(x1 - x0, z1 - z0);
      a.sh.scale.set(1, len - 1.2, 1); a.sh.position.set(0, 0, (len - 1.2) / 2); a.hd.position.set(0, 0, len - 1.0);
    });
  }
  // the player's piece, preferred order per act (the plan falls back to the others when a board needs it)
  const YOU = [['R', 'B', 'R', 'B', 'N', 'R', 'B', 'N'], ['N', 'B', 'R', 'Q', 'B', 'N'], ['Q', 'N', 'R', 'B']];
  function setYou(b, t) {
    const S = b.state; S.you = t; for (const k in S.glyph) S.glyph[k].visible = k === t; S.glyphPulse = 1;
    Sound.sfx('glint', 0.8, t === 'Q' ? 0.8 : t === 'N' ? 1.2 : 1); Sound.sfx('tick', 0.8, 0.7);
    if (!G.headless && G.player) { FX.ring(G.player.pos.x, G.player.pos.z, { r0: 0.3, r1: 3.2, color: IVORY, dur: 0.5 }); FX.burst(G.player.pos.x, G.player.pos.y + 2.6, G.player.pos.z, { n: 18, color: IVORY, color2: GOLD, speed: [1, 4], life: [0.3, 0.7], size: [0.1, 0.3] }); }
  }
  // lock-in: the hero cannot leave the cell (no walking, jumping, dashes, Blink, Lunge, Overhead leap or roll); casting and attacking go on
  function lockIn(b) {
    const p = G.player; p.rooted = Math.max(p.rooted, LOCK + 0.05); p.lockT = LOCK + 0.05; p.dash = null; p.kb = null;
    Sound.sfx('tick', 1.4, 0.45); Sound.sfx('boom', 0.5, 1.6); FX.shake(0.15);
    if (!G.headless) { FX.ring(p.pos.x, p.pos.z, { r0: 3.4, r1: 0.9, color: IVORY, dur: 0.28, width: 0.2 }); FX.ring(p.pos.x, p.pos.z, { r0: 0.9, r1: 1.0, color: IVORY, dur: LOCK, width: 0.1, mult: 1.4 }); }
    return cellOf(p.pos.x, p.pos.z);
  }
  // the outcome on the hero's locked cell: struck by a piece, safe without check (the King refutes it), or safe and giving check
  function resolve(b, cell) {
    const S = b.state, p = G.player; if (!p || !p.alive || !cell) return 'none';
    const ev = evalBoard(live(S).map((q) => ({ type: q.type, i: q.i, j: q.j })), kingCell(b), S.you), c = cell.j * 8 + cell.i;
    if (ev.struck[c]) { p.hurt(380, { blockable: true, src: { name: 'Gambit' } }); return 'struck'; }
    if (!ev.check[c]) {
      Sound.sfx('laser', 1, 0.55); Sound.sfx('boom', 0.8, 0.8); FX.shake(0.5);
      if (!G.headless) { FX.beam(new V3(b.pos.x, 5.6, b.pos.z), new V3(p.pos.x, 1.2, p.pos.z), { color: EMBER, width: 0.9, dur: 0.55, mult: 4 }); FX.beam(new V3(b.pos.x, 5.6, b.pos.z), new V3(p.pos.x, 1.2, p.pos.z), { color: 0xfff0d0, width: 0.25, dur: 0.35, mult: 3 }); FX.burst(p.pos.x, 1.2, p.pos.z, { n: 30, color: EMBER, color2: 0xffe0b0, speed: [2, 9], life: [0.3, 0.8] }); }
      p.hurt(S.refute || 350, { blockable: false, src: { name: 'Refutation' } }); S.hop = 0.5; return 'refuted';
    }
    S.checkUntil = G.now + 10; b.stagger = 1.5; S.hop = 0.6; Sound.sfx('bell', 1, 1.3); Sound.sfx('crit', 0.7);
    if (!G.headless) { FX.ring(b.pos.x, b.pos.z, { r0: 0.5, r1: 7, color: GOLD, dur: 0.6 }); FX.num(b.aim(_a), 'CHECK', 'note'); FX.beam(new V3(p.pos.x, 1.2, p.pos.z), new V3(b.pos.x, 3, b.pos.z), { color: GOLD, width: 0.3, dur: 0.9, mult: 3 }); }
    return 'check';
  }

  // The Gambit. o: {types, T, pawns, movers, fixed, keep, name, you, script}. Returns 'check', 'struck', 'refuted' or 'none'.
  function* gambit(b, o) {
    const S = b.state; S.inGambit = true; S.checkUntil = 0;
    const seq = YOU[S.lvl], base = Object.assign({ lvl: S.lvl, youSeq: seq.slice(S.gcount % seq.length).concat(seq.slice(0, S.gcount % seq.length)) }, o);
    let pl = null, po = base;
    if (o.script) [po, pl] = scripted(b, base, o.script);
    else { pl = plan(b, base); if (!pl && o.fixed) { po = Object.assign({}, base, { fixed: null, types: o.fixed.map((f) => f.type) }); pl = plan(b, po); } }
    if (!pl) { yield* march(b, 2); pl = plan(b, po, true); } // too far from the hero for any check square: the King advances first
    if (!pl) { S.inGambit = false; yield 0.5; return 'none'; }
    S.gcount++; setYou(b, pl.you); S.lastPlan = pl;
    showArrows(S, pl.moves.filter((mv) => mv.ref.type !== 'P'));
    for (const d of pl.drops) {
      const q = place(b, d.type, d.i, d.j, { dropT: 1.1, keep: !!o.keep || d.type === 'P' }); if (!q) continue; d.q = q;
      sqHz(d.i, d.j, 1.1, 300, { name: 'Crushed', onFire() { Sound.sfx('boom', 0.7, 0.7); FX.shake(0.35); if (!G.headless) FX.burst(q.x, 0.2, q.z, { n: 16, color: 0xb09070, speed: [2, 7], life: [0.3, 0.8], size: [0.2, 0.6], radius: 1.4 }); } });
    }
    S.raise = 1;
    let r = yield* b.cast({ name: o.name || 'Gambit', time: 1.1 }); if (r === 'dead') return 'none';
    const T = o.T; S.pending = { struck: pl.struck, at: G.now + T };
    const noCheck = pl.safe.filter((c) => !pl.check[c]); S.safeHint = (G.chessBot === 'nocheck' || (G.chessBot === 'mix' && vrand() < 0.25)) && noCheck.length ? noCheck : pl.good; // test-only bot modes (tools/chesssim.js)
    let moved = !pl.moves.length, cell = null;
    r = yield* b.cast({ name: o.name || 'Gambit', time: T, onTick(k, cs) {
      if (!moved && cs.t >= T - 1.25) { moved = true; S.arrows.forEach((a) => { a.visible = false; }); for (const mv of pl.moves) { const q = mv.ref; if (q.gone) continue; q.mv = { x0: q.x, z0: q.z, x1: cx(mv.i), z1: cx(mv.j), t: 0 }; q.i = mv.i; q.j = mv.j; } S.ver++; Sound.sfx('dash', 0.5, 0.7); }
      if (!cell && cs.t >= T - LOCK) cell = lockIn(b);
    } });
    S.raise = 0; S.pending = null; S.safeHint = null; if (r === 'dead') return 'none';
    for (const q of live(S)) if (q.mv) { q.x = q.mv.x1; q.z = q.mv.z1; q.mv = null; }
    if (!cell) cell = cellOf(G.player.pos.x, G.player.pos.z);
    strikeFX(b);
    const res = resolve(b, cell); S.log && S.log.push(res);
    // promotion: a pawn on the last rank becomes a Queen that stays to the end (three at most, so pawns stop dropping at the cap)
    for (const q of live(S)) {
      if (q.type !== 'P') continue;
      if (q.j >= 7 && live(S).filter((x) => x.type === 'Q').length < 3) { const i = q.i, j = q.j; retire(b, q); const nq = place(b, 'Q', i, j, { keep: true }); if (nq) { Sound.sfx('bell', 0.9, 0.5); FX.pillar(nq.x, nq.z, { r: 1.6, h: 16, color: EMBER, dur: 0.8 }); } }
      else if (q.j === 6 && !q.warned) { q.warned = true; Sound.sfx('bell', 0.7, 0.75); if (!G.headless) FX.ring(q.x, q.z, { r0: 0.5, r1: 3.5, color: EMBER, dur: 0.6 }); }
    }
    yield 0.5;
    for (const q of live(S)) if (!q.keep) retire(b, q);
    S.inGambit = false; yield 0.6; return res;
  }
  function* edict(b) {
    const S = b.state, k = kingCell(b), hs = [];
    for (const [dx, dz] of ALL) if (inB(k.i + dx, k.j + dz)) hs.push(sqHz(k.i + dx, k.j + dz, 1.4, 330, { name: 'Edict', silent: false }));
    S.raise = 0.6; const r = yield* b.cast({ name: 'Edict', time: 1.4 }); S.raise = 0;
    if (r !== 'done') { for (const h of hs) Hz.cancel(h); yield 0.8; return; }
    Sound.sfx('bigboom', 0.7, 1.2); FX.shake(0.5); S.hop = 1; if (!G.headless) FX.ring(b.pos.x, b.pos.z, { r0: 1, r1: C * 1.5, color: EMBER, dur: 0.4 });
    yield 0.9;
  }
  function* march(b, steps = 1) {
    const S = b.state, p = G.player;
    for (let n = 0; n < steps; n++) {
      const k = kingCell(b), pc = cellOf(p.pos.x, p.pos.z); if (!pc) break; if (Math.max(Math.abs(pc.i - k.i), Math.abs(pc.j - k.j)) <= 1) break;
      const occ = occFn(b, live(S)); let best = null, bd = 1e9;
      for (const [dx, dz] of ALL) { const i = k.i + dx, j = k.j + dz; if (!inB(i, j) || occ(i, j) || (i === pc.i && j === pc.j)) continue; const d = Math.hypot(cx(i) - p.pos.x, cx(j) - p.pos.z); if (d < bd) { bd = d; best = [i, j]; } }
      if (!best) break; S.hop = 1; Sound.sfx('boom', 0.4, 0.6);
      yield* b.moveTo(cx(best[0]), cx(best[1]), 11, { face: false }); b.pos.x = cx(best[0]); b.pos.z = cx(best[1]); S.ver++; FX.shake(0.2); yield 0.25;
    }
    yield 0.3;
  }
  function* castle(b) {
    const S = b.state, p = G.player, k = kingCell(b), occ = occFn(b, live(S)); let best = null, bd = -1;
    for (let t = 0; t < 24; t++) { const i = rndi(0, 7), j = rndi(0, 7); if (occ(i, j)) continue; const d = Math.hypot(cx(i) - p.pos.x, cx(j) - p.pos.z); if (d > bd && d < 26) { bd = d; best = [i, j]; } }
    if (!best) return 'none';
    const r = yield* b.cast({ name: 'Castle', time: 0.9 }); if (r !== 'done') { yield 0.5; return 'none'; }
    if (!G.headless) { FX.pillar(b.pos.x, b.pos.z, { r: 1.8, h: 18, color: EMBER, dur: 0.5 }); FX.pillar(cx(best[0]), cx(best[1]), { r: 1.8, h: 18, color: EMBER, dur: 0.5 }); }
    Sound.sfx('blink', 0.9, 0.6); b.pos.x = cx(best[0]); b.pos.z = cx(best[1]); S.ver++;
    // a rook takes the King's old square; then a normal Gambit around it
    return yield* gambit(b, { fixed: [{ type: 'R', i: k.i, j: k.j }], types: [pick(MIX)], T: 6.0, pawns: true, name: 'Castle' });
  }
  function* stalemate(b) {
    const S = b.state; S.raise = 1;
    const r = yield* b.cast({ name: 'Stalemate', time: 2.8, interruptible: true }); S.raise = 0;
    if (r === 'done') { b.hp = Math.min(b.maxHp * 0.33, b.hp + b.maxHp * 0.04); Sound.sfx('bell', 1, 0.4); FX.pillar(b.pos.x, b.pos.z, { r: 2.2, h: 20, color: 0x60ff90, dur: 0.9 }); }
    yield 0.6;
  }

  // Gambit: a calm lamp-lit study. The Queen: the room cools, the lamp falters, embers wake in the ebony. Blitz: a cold blue night against a burning board.
  const LOOK = [
    { key: 2.6, keyC: 0xffd6a0, rim: 0.15, rimC: 0x9ab8ff, rimE: 0x50709c, hemi: 0.7, fog: 0x1a1410, wall: 0x2c2016, win: 0x4a6898, winI: 0.75, hearth: 1.0, ember: 0, crack: 0.022, heat: 0.7, core: 0, gem: 1.3, shard: 0, clock: 1, candle: 110, lampI: 1, shaftI: 0.3, haze: 0, halo: 0.5, tab: 0xffffff, ds: 0, pool: 1, veinI: 0, veinH: 0 },
    { key: 1.75, keyC: 0xdcc6a8, rim: 0.2, rimC: 0x9aa4b8, rimE: 0x5878b4, hemi: 0.5, fog: 0x0e1018, wall: 0x1c1d27, win: 0x5a84c8, winI: 1.1, hearth: 0.7, ember: 0.62, crack: 0.052, heat: 2.1, core: 0.3, gem: 3.6, shard: 0, clock: 5, candle: 150, lampI: 0.7, shaftI: 1.6, haze: 0.55, halo: 0.55, tab: 0xe0c6aa, ds: 0, pool: 0.6, veinI: 0.75, veinH: 0 },
    { key: 1.9, keyC: 0xa8bcff, rim: 0.35, rimC: 0x9aa8c8, rimE: 0x6088d0, hemi: 0.65, fog: 0x080d1a, wall: 0x0e1424, win: 0x7ab0ff, winI: 1.5, hearth: 0.45, ember: 1.0, crack: 0.068, heat: 2.6, core: 1.0, gem: 3.0, shard: 1, clock: 40, candle: 110, lampI: 0.2, shaftI: 9.0, haze: 0.85, halo: 0.7, tab: 0xb8c8ec, ds: 0.75, pool: 0.15, veinI: 1.15, veinH: 1 },
  ];
  function look(b, n, instant) {
    const S = b.state, L = LOOK[n], tg = {};
    for (const k in L) tg[k] = /C$|^fog$|^wall$|^win$|^rimE$|^tab$/.test(k) ? new THREE.Color(L[k]) : L[k];
    S.lookT = tg; if (instant || !S.cur) { S.cur = {}; for (const k in tg) S.cur[k] = tg[k].isColor ? tg[k].clone() : tg[k]; }
  }
  function setAct(b, n) {
    const S = b.state; S.lvl = n; S.pending = null; S.safeHint = null; S.inGambit = false; S.raise = 0; S.arrows.forEach((a) => { a.visible = false; });
    for (const q of live(S)) { if (q.mv) { q.x = q.mv.x1; q.z = q.mv.z1; q.mv = null; } if (!q.keep) retire(b, q); }
    look(b, n, false);
  }
  const P1 = [null, null, null, null, ['R', 'N', 'B'], ['N', 'N', 'R'], ['R', 'B', 'B']], MIX = ['R', 'B', 'N'];
  // a pawn joins every other Gambit from the Queen on, while pawns plus Queens stay under the cap of three
  const pawnDue = (S, n) => n % 2 === 0 && live(S).filter((q) => q.type === 'P' || q.type === 'Q').length < 3;
  const oneQueen = (S) => { const Q = live(S).filter((q) => q.type === 'Q'); return Q.length ? [pick(Q)] : []; };

  G.bosses.push({
    id: 'chess', name: 'ZUGZWANG', title: 'The Last Grandmaster', hint: 'Your move', color: '#ffd9a0', telegraph: 0xff5a28,
    hp: 22000, radius: 1.7, aimY: 3.4, enrage: 440,
    post: { bloom: 0.5, threshold: 0.86, radius: 0.7, exposure: 1.05, vig: 1.28, sat: 1.05, contrast: 1.08, tint: [1.04, 1.0, 0.94] },
    music: { bpm: 112, root: 38, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 0, 3, 4, 0, 5, 3, 4],
      layers: [
        { v: 'pulse', pat: ['0.2.4.2.0.2.4.7.', '0.2.4.2.6.4.2.1.'], oct: 1, len: 1, vol: 0.06 }, { v: 'bass', pat: '0.....0...0.....', oct: -1, len: 3, vol: 0.13 }, { v: 'hat', pat: '..x...x...x...x.', vol: 0.05 },
        { v: 'organ', from: 1, pat: ['0.......4.......', '2.......4.......'], oct: 0, len: 8, vol: 0.07 }, { v: 'taiko', from: 1, pat: 'x.......x...x...', vol: 0.2 }, { v: 'arp', from: 1, pat: '0247420702474207', oct: 1, len: 1, vol: 0.04 },
        { v: 'brass', from: 2, pat: ['0.......7.......', '5.......4...6...'], oct: 0, len: 7, vol: 0.11 }, { v: 'taiko', from: 2, pat: 'x.x...x.x.x..xx.', vol: 0.2 }, { v: 'snare', from: 2, pat: '....x.......x...', vol: 0.12 },
      ] },
    build,
    *intro(b) { Sound.sfx('bell', 0.7, 0.5); yield* Cam.shot([cx(7) + 6, 1.4, cx(7) + 8], [cx(3), 4.5, cx(1)], [cx(4) + 1, 3.6, cx(3)], [cx(3), 4.2, cx(1)], 5.0, 44); },
    *death(b) {
      const S = b.state, a = Cam.yaw + 0.5; Cam.cine = { pos: new V3(b.pos.x - Math.sin(a) * 15, 7, b.pos.z - Math.cos(a) * 15), look: new V3(b.pos.x, 2.5, b.pos.z), fov: 42 };
      S.fallA = Cam.yaw + PI / 2; S.falling = 0.001; Sound.sfx('bell', 1, 0.35);
      for (const q of live(S)) { q.topple = 0.001 + Math.hypot(q.x - b.pos.x, q.z - b.pos.z) * -0.012; }
      yield 0.75; Sound.sfx('bigboom', 1, 0.5); FX.shake(0.9); FX.flash(0xffffff, 0.35, 1.2); yield 0.6;
    },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setAct(b, 0); yield 1.0; let n = 0;
        while (true) {
          const T = n < 3 ? 7.0 : 6.0;
          const res = n < OPEN1.length ? yield* gambit(b, { T, script: OPEN1[n] }) : yield* gambit(b, { types: n < P1.length ? P1[n] : [pick(MIX), pick(MIX), pick(['N', 'B'])], T });
          n++; if (res === 'check') yield 3;
          yield* edict(b); yield* march(b, 2);
          if (n % 2 === 0) yield* edict(b);
        }
      } },
      { at: 0.66, skipTo(b) { look(b, 1, true); },
        *enter(b) {
          const S = b.state; setAct(b, 1); S.raise = 1;
          yield* b.cast({ name: 'The Queen', time: 1.4, onTick: (k) => FX.shake(k * 0.2) });
          const p = G.player, pc = cellOf(p.pos.x, p.pos.z) || { i: 4, j: 7 }, k = kingCell(b); let qi = 3, qj = 3;
          for (let t = 0; t < 30; t++) { qi = rndi(1, 6); qj = rndi(1, 5); if (!(qi === pc.i && qj === pc.j) && !(qi === k.i && qj === k.j) && !live(S).some((x) => x.i === qi && x.j === qj)) break; }
          const q = live(S).filter((x) => x.type === 'Q').length < 3 ? place(b, 'Q', qi, qj, { dropT: 1.3, keep: true }) : null;
          if (q) sqHz(qi, qj, 1.3, 300, { name: 'Crushed', tag: 'fight', onFire() { Sound.sfx('bigboom', 1, 0.6); FX.shake(0.9); FX.flash(EMBER, 0.25, 0.8); if (!G.headless) { FX.ring(q.x, q.z, { r0: 1, r1: 16, color: EMBER, dur: 0.7 }); FX.burst(q.x, 0.3, q.z, { n: 50, color: EMBER, color2: 0xffffff, speed: [3, 14], life: [0.4, 1.1], size: [0.2, 0.6] }); } } });
          Co.start(Post.lerpTo({ tint: [1.05, 0.99, 0.95], bloom: 0.54 }, 3), 'fight'); yield 2.0; S.raise = 0;
        },
        *run(b) {
          const S = b.state; setAct(b, 1); yield 0.6; let n = 0;
          while (true) {
            let res;
            if (n === 0) res = yield* gambit(b, { types: [pick(MIX)], T: 6.0, pawns: true, movers: oneQueen(S), you: 'N' }); // the Queen moves first; you are a knight
            else { const types = [pick(MIX)]; if (n % 2 === 1) types.push(pick(MIX)); if (pawnDue(S, n)) types.push('P'); res = yield* gambit(b, { types, T: 6.0, pawns: true, movers: oneQueen(S) }); }
            n++; if (res === 'check') yield 3;
            yield* edict(b); yield* march(b, 2);
            if (n % 3 === 0) { if ((yield* castle(b)) === 'check') yield 3; }
          }
        } },
      { at: 0.33, skipTo(b) { look(b, 2, true); },
        *enter(b) {
          const S = b.state; setAct(b, 2); S.raise = 1; Sound.sfx('roar', 0.8, 0.5);
          yield* b.cast({ name: 'Blitz', time: 2.2, onTick: (k) => FX.shake(k * 0.3) }); S.raise = 0;
          FX.flash(EMBER, 0.3, 1.0); Co.start(Post.lerpTo({ tint: [0.99, 0.99, 1.05], bloom: 0.58, contrast: 1.12 }, 3), 'fight');
          if ((yield* gambit(b, { types: ['R', 'N'], T: 4.5, keep: true, pawns: true, name: 'Blitz', you: 'R' })) === 'check') yield 2;
        },
        *run(b) {
          const S = b.state; setAct(b, 2); yield 0.4; let n = 0;
          while (true) {
            let L = live(S).filter((q) => q.type !== 'P'); L.sort((x, y) => x.born - y.born);
            while (L.length > 5) { const old = L.find((q) => q.type !== 'Q') || L[0]; retire(b, old); L = L.filter((q) => q !== old); }
            const mover = L.length ? [pick(L)] : [], types = [pick(MIX)]; if (pawnDue(S, n + 1)) types.push('P');
            const res = yield* gambit(b, { types, T: 4.5, keep: true, pawns: true, movers: mover }); n++;
            if (res === 'check') yield 2;
            if (n % 2 === 0) { yield* edict(b); yield* march(b, 2); }
            if (n % 4 === 3) yield* stalemate(b);
          }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      // pieces: drop, slide, sink
      for (let n = S.pieces.length - 1; n >= 0; n--) {
        const q = S.pieces[n], m = q.slot.m;
        if (q.dropT > 0) { q.dropT -= dt; const k = Math.max(0, q.dropT) / 1.1; m.position.y = 40 * k * k; }
        else if (!q.topple) m.position.y = 0;
        if (q.mv) { q.mv.t += dt / 0.6; const k = smooth(q.mv.t); q.x = lerp(q.mv.x0, q.mv.x1, k); q.z = lerp(q.mv.z0, q.mv.z1, k); m.position.y = Math.sin(k * PI) * 0.6; if (q.mv.t >= 1) { q.x = q.mv.x1; q.z = q.mv.z1; q.mv = null; } }
        if (q.kick > 0) { q.kick -= dt * 3; m.scale.set(1 + Math.max(0, q.kick) * 0.12, 1 - Math.max(0, q.kick) * 0.1, 1 + Math.max(0, q.kick) * 0.12); }
        m.position.x = q.x; m.position.z = q.z;
        if (q.topple) { q.topple += dt; if (q.topple > 0) { m.rotation.z = -Math.min(PI / 2, q.topple * q.topple * 9); m.rotation.y = 0.4 * q.born; } }
        if (q.gone) { q.outT -= dt; const k = Math.max(0, q.outT / 0.45); m.scale.setScalar(Math.max(0.001, k)); m.position.y = -(1 - k) * 1.5; if (q.outT <= 0) { m.visible = false; m.rotation.set(0, 0, 0); q.slot.used = false; S.pieces.splice(n, 1); } }
      }
      // the look
      const L = S.cur, T = S.lookT, kk = 1 - Math.exp(-1.2 * dt); S.T.value = t;
      for (const k in T) { if (T[k].isColor) L[k].lerp(T[k], kk); else L[k] = damp(L[k], T[k], 1.2, dt); }
      // the lamp: steady in the Gambit, swaying and faltering later
      const sw = S.lvl * 0.06, fk = S.lvl ? 1 - 0.1 * S.lvl * Math.max(0, Math.sin(t * 7.3) * Math.sin(t * 2.9 + 1.0)) - (S.lvl > 1 && Math.sin(t * 1.3) > 0.97 ? 0.25 : 0) : 1;
      _a.copy(S.keyDir); _a.x += Math.sin(t * 0.6) * sw; _a.z += Math.cos(t * 0.47) * sw * 0.6; S.key.position.copy(_a.normalize()).multiplyScalar(80);
      S.key.intensity = L.key * fk; S.key.color.copy(L.keyC); S.rim.intensity = L.rim; S.rim.color.copy(L.rimC); S.hemi.intensity = L.hemi; S.fog.color.copy(L.fog); S.rimU.value.copy(L.rimE);
      const U = S.wallU; U.uWall.value.copy(L.wall); U.uWin.value.copy(L.win); U.uWinI.value = L.winI; U.uHI.value = L.hearth;
      S.lampI.value = L.lampI * fk; S.shaftI.value = L.shaftI; S.haze.material.uniforms.uAlpha.value = L.haze; S.dust.material.uniforms.uAlpha.value = 0.4 + 0.6 * L.lampI; S.lampHalo.material.opacity = L.lampI * fk; S.table.material.color.copy(L.tab); S.bulbM.color.setHex(0xfff0d0).multiplyScalar(0.6 + 2.6 * L.lampI * fk); S.lampInM.color.setHex(0xffd8a0).multiplyScalar(0.3 + 1.2 * L.lampI * fk);
      S.lamp.rotation.z = Math.sin(t * 0.6) * sw * 0.8; S.lamp.rotation.x = Math.cos(t * 0.47) * sw * 0.5;
      S.gemHaloM.opacity = sat(L.gem / 4) * 0.7; S.khalo.material.opacity = L.halo * (0.85 + 0.15 * Math.sin(t * 2)); S.cross.getWorldPosition(_b); _b.y += 0.6; _a.copy(_b).sub(camera.position).normalize(); S.khalo.position.copy(_b).addScaledVector(_a, 2.2); _b.y -= 0.6;
      S.poolU.value = L.pool; S.dsU.value = L.ds; S.veinI.value = L.veinI; S.veinH.value = L.veinH;
      for (let c = 0; c < 64; c++) S.telA[c] = damp(S.telA[c], S.tel[c] > t - 0.25 ? 1 : 0, S.tel[c] > t - 0.25 ? 20 : 4, dt);
      S.emberU.value = L.ember; S.kU.uCrack.value = L.crack + (S.raiseK || 0) * 0.01; S.kU.uHeat.value = L.heat + (S.raiseK || 0) * 1.5; S.kU.uCore.value = L.core + (S.raiseK || 0) * 0.3;
      S.gemM.color.setHex(EMBER).lerp(_c.setHex(0xfff0c0), sat(L.core * 0.6)).multiplyScalar(L.gem * (0.85 + 0.15 * Math.sin(t * 5)));
      const burn = sat(G.ft / 440), ch = 12 - burn * 8; S.candle.scale.y = ch; S.candle.position.y = ch / 2 + 1; S.lip.position.set(-62, ch + 1, -74); const fl = 1 + Math.sin(t * 11) * 0.06 + Math.sin(t * 23.7) * 0.04;
      S.flame.position.set(-62, ch + 7.2, -74); S.flame.scale.set(5.2 * fl, 12 * fl, 1); S.halo.position.set(-62, ch + 6, -74); S.halo.material.opacity = 0.75 + 0.25 * fl; S.flameC.value.setHex(0xff9a40).multiplyScalar(fl); S.candleL.position.set(-62, ch + 8, -74); S.candleL.intensity = L.candle * fl;
      // the clock: ticking in the Gambit, racing in the Blitz
      S.clockA = (S.clockA || 0) + dt * L.clock * 0.1; for (let k = 0; k < 2; k++) { const a = S.clockA * (k ? 1.0 : 0.7) + k * 2.1; S.hands[k][0].rotation.z = -a / 12; S.hands[k][1].rotation.z = -a; }
      S.dialM.emissiveIntensity = sat((L.clock - 5) / 35) * (1.1 + 0.4 * Math.sin(t * 9)); S.flag.rotation.z = S.lvl > 1 ? Math.sin(t * 6) * 0.4 : 0;
      // Blitz shards
      if (L.shard > 0.005) { for (let k = 0; k < 36; k++) { const P = S.shardP[k], a = P.a + Math.sin(t * 0.3 + P.sp) * 0.15; _m.position.set(Math.sin(a) * P.r, P.y + Math.sin(t * 0.8 + P.sp) * 1.2 + (1 - L.shard) * -14, Math.cos(a) * P.r); _m.rotation.set(t * 0.5 + P.sp, t * 0.3 * P.s, P.sp * 2); _m.scale.setScalar(P.s * L.shard); _m.updateMatrix(); S.shards.setMatrixAt(k, _m.matrix); } S.shards.instanceMatrix.needsUpdate = true; S.shardOn = true; }
      else if (S.shardOn) { S.shardOn = false; _m.position.set(0, -50, 0); _m.scale.setScalar(0.001); _m.updateMatrix(); for (let k = 0; k < 36; k++) S.shards.setMatrixAt(k, _m.matrix); S.shards.instanceMatrix.needsUpdate = true; }
      // knight strike shards in flight
      for (const J of S.jumps) {
        if (J.sT < 1.4) { J.sT += dt; J.sc.material.opacity = 0.75 * (1 - sat(J.sT / 1.4)); J.sc.scale.setScalar(0.8 + 0.3 * sat(J.sT * 4)); } else if (J.sc.material.opacity) J.sc.material.opacity = 0;
        if (J.t >= J.dur) continue; J.t += dt; const k = Math.min(1, J.t / J.dur), pos = (kk2) => _b.lerpVectors(J.a, J.b, kk2).setY(lerp(J.a.y, J.b.y, kk2) + Math.sin(kk2 * PI) * 5);
        J.core.position.copy(pos(k)); J.core.rotation.set(t * 9, t * 7, 0);
        J.tr.forEach((s, n) => { const kt = k - (n + 1) * 0.06; s.visible = kt > 0 && k < 1; if (s.visible) { s.position.copy(pos(kt)); s.scale.setScalar(2.2 * Math.pow(1 - n / 8, 1.3)); } });
        if (k >= 1) { J.core.visible = false; J.tr.forEach((s) => { s.visible = false; }); FX.burst(J.b.x, 0.4, J.b.z, { n: 34, color: 0xffe0b0, color2: EMBER, speed: [4, 12], life: [0.3, 0.8], size: [0.15, 0.4], up: 4, grav: 10 }); FX.ring(J.b.x, J.b.z, { r0: 0.3, r1: 2.6, color: 0xffb060, dur: 0.35, width: 0.2 }); FX.burst(J.b.x, 0.3, J.b.z, { n: 8, color: EMBER, speed: [0.5, 2], life: [0.4, 0.8], size: [0.5, 0.9], flat: true }); J.sT = 0; J.sc.position.set(J.b.x, 0.03, J.b.z); J.sc.rotation.y = t * 3.7; }
      }
      // pieces and the King fade when they stand between the camera and the hero
      const cam = camera.position, fadeAt = (x, z, r) => { if (!p) return 1; const vx = p.pos.x - cam.x, vz = p.pos.z - cam.z, l2 = vx * vx + vz * vz; if (l2 < 1) return 1; const s = ((x - cam.x) * vx + (z - cam.z) * vz) / l2; if (s <= 0 || s >= 0.96) return 1; return Math.hypot(cam.x + vx * s - x, cam.z + vz * s - z) < r ? 0.2 : 1; };
      for (const q of S.pieces) { q.slot.mat.opacity = q.slot.gm.opacity = damp(q.slot.mat.opacity, q.gone ? 1 : fadeAt(q.x, q.z, 2.1), 8, dt); const fd = q.slot.mat.opacity < 0.98; if (q.slot.dm[0].visible !== fd) q.slot.dm.forEach((d) => { d.visible = fd; }); }
      for (const P of Object.values(S.pool)) for (const s of P) if (!s.used && s.mat.opacity !== 1) { s.mat.opacity = s.gm.opacity = 1; s.dm.forEach((d) => { d.visible = false; }); }
      const kf = S.falling ? 1 : fadeAt(b.pos.x, b.pos.z, 2.6); S.kingM.opacity = S.goldKM.opacity = damp(S.kingM.opacity, kf, 8, dt); S.gemHaloM.opacity *= S.kingM.opacity * S.kingM.opacity; const kd = S.kingM.opacity < 0.98; if (S.kdm[0].visible !== kd) S.kdm.forEach((d) => { d.visible = kd; }); S.khalo.material.opacity *= S.kingM.opacity;
      // the King
      S.hop = Math.max(0, (S.hop || 0) - dt * 2.6); S.raiseK = damp(S.raiseK || 0, S.raise || 0, 6, dt);
      if (S.falling) { S.falling += dt; S.rig.rotation.order = 'YXZ'; S.rig.rotation.y = S.fallA - b.facing; S.rig.rotation.x = Math.min(PI / 2, S.falling * S.falling * 7); }
      else { S.rig.position.y = Math.sin(S.hop * PI) * 1.1 + S.raiseK * 0.5 + Math.sin(t * 1.6) * 0.04; S.rig.rotation.y = -b.facing + Math.sin(t * 0.7) * 0.05; }
      const hot = 2.2 + S.raiseK * (2.5 + Math.sin(t * 14)) + S.lvl * 0.8; S.glowM.color.setHex(EMBER).multiplyScalar(hot); S.light.intensity = 2.5 + S.lvl * 2.5 + S.raiseK * 6;
      if (!p) return;
      // you are a piece: the glyph over the hero is the only clue. Check opens a damage window until the next Gambit begins.
      const fighting = G.state === 'fight' && p.alive && !!S.you, win = G.now < (S.checkUntil || 0);
      b.dmgTaken = win ? 1.4 : 0.75;
      S.crown.visible = win && !S.falling; if (S.crown.visible) { S.crown.position.set(b.pos.x, 0.09, b.pos.z); S.crown.rotation.z = t * 0.8; S.crown.material.opacity = 0.55 + Math.sin(t * 6) * 0.25; }
      S.glyphPulse = Math.max(0, (S.glyphPulse || 0) - dt * 1.6);
      const gl = S.glyph[S.you]; if (gl) { const gp = S.glyphPulse; gl.visible = fighting; gl.position.set(p.pos.x, p.pos.y + 2.55 + Math.sin(t * 2.2) * 0.06 + gp * 0.3, p.pos.z); gl.rotation.y = t * 0.9 + gp * 6; gl.scale.setScalar(0.17 * (1 + Math.sin(gp * PI) * 0.9)); S.glyphM.color.setHex(win ? GOLD : IVORY).multiplyScalar((win ? 1.8 : 1.2) + gp * 2.5); }
      // pawn trails: a faint ember line up the file ahead of each pawn, bright and pulsing when the next step promotes it
      let tn = 0;
      for (const q of S.pieces) {
        if (q.type !== 'P' || q.gone || q.dropT > 0 || tn >= S.trailN) continue; const len = (7 - q.j) * C; if (len <= 0.1) continue;
        _m.position.set(q.x, 0.06, q.z + C * 0.5 + len / 2); _m.rotation.set(0, 0, 0); _m.scale.set(1, 1, len); _m.updateMatrix(); S.trail.setMatrixAt(tn, _m.matrix);
        const warn = q.j >= 6; _c.setHex(EMBER).multiplyScalar(warn ? 1.1 + 0.9 * Math.sin(t * 9) : 0.32); S.trail.setColorAt(tn, _c); tn++;
      }
      _m.scale.setScalar(0.0001); _m.updateMatrix(); for (let n = tn; n < S.trailN; n++) S.trail.setMatrixAt(n, _m.matrix);
      S.trail.instanceMatrix.needsUpdate = true; if (S.trail.instanceColor) S.trail.instanceColor.needsUpdate = true;
    },
    danger(b, x, z) { const P = b.state.pending; if (!P) return Infinity; const c = cellOf(x, z); if (!c || !P.struck[c.j * 8 + c.i]) return Infinity; return Math.max(0, P.at - G.now); },
    bot(b, p) {
      const S = b.state, L = live(S), avoid = (x, z) => L.some((q) => Math.hypot(x - q.x, z - q.z) < 2.1);
      if (S.safeHint && S.safeHint.length) { let best = -1, bd = 1e9; for (const c of S.safeHint) { const d = Math.hypot(cx(c % 8) - p.pos.x, cx(c >> 3) - p.pos.z) + Math.hypot(cx(c % 8) - b.pos.x, cx(c >> 3) - b.pos.z) * 0.15; if (d < bd) { bd = d; best = c; } } return { x: cx(best % 8), z: cx(best >> 3), w: 3, avoid }; }
      return { avoid, target: b };
    },
  });
})();
