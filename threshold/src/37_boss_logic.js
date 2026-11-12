// DOOR XVIII: DAEMON, the Truth Table. The floor is a circuit and it really computes. The bits along the south edge
// are yours to flip; when he executes, every output that evaluates TRUE is electrocuted, including the one he floats over.
(() => {
  const H = 18, CY = 0x30e0ff, MG = 0xff3fd0, AMBER = 0xffa040, TEL = 0xff8a30, FLOW = 1.0;
  const ZX = [-12, 0, 12], ZN = -H, ZS = -5, N = 1024, U = N / (2 * H), px = (v) => (v + H) * U;
  const zoneOf = (x, z) => z > ZS ? -1 : x < -6 ? 0 : x < 6 ? 1 : 2;
  const _c = new THREE.Color(), _a = new V3(), _b = new V3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(), _e = new THREE.Euler();
  const HASH = 'float h21(vec2 p){ vec3 q=fract(vec3(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }';
  const VSW = 'varying vec2 vUv; varying vec3 vW; varying vec3 vN; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=mat3(modelMatrix)*normal; gl_Position=projectionMatrix*viewMatrix*w; }';
  const shm = (U, fs, o = {}) => new THREE.ShaderMaterial(Object.assign({ uniforms: U, vertexShader: VSW, fragmentShader: fs }, o));
  // box whose uvs are in world units (plus a per-face offset), so one shader can tile windows and pins across any size
  function boxW(w, h, d, seed) { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, D = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * D[f][0] + seed + f * 41.3, uv.getY(i) * D[f][1]); } return g; }
  function cylW(r, h, seed) { const g = new THREE.CylinderGeometry(r, r, h, 24), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * TAU * r + seed, uv.getY(i) * h); return g; }
  // the components: dark machined bodies with ordered rows of status LEDs, vertical traces carrying pulses up, phase-coloured fresnel, haze with distance
  const TOWER_FS = `uniform vec3 uC; uniform vec3 uFog; uniform float uT,uK1,uK2,uFogD; varying vec2 vUv; varying vec3 vW; varying vec3 vN; ${HASH}
    void main(){ vec3 N=normalize(vN+vec3(0.0,1e-5,0.0)); vec3 dv=cameraPosition-vW; float dist=max(length(dv),1e-4); vec3 V=dv/dist; float top=step(0.7,N.y); vec2 g=vUv;
      float lam=0.3+0.7*clamp(dot(N,vec3(-0.27,0.9,0.36)),0.0,1.0); vec3 col=mix(vec3(0.05,0.056,0.064),vec3(0.07,0.076,0.085),top)*lam;
      vec2 pf=fract(g/vec2(2.4,1.8)); float seam=1.0-step(0.03,pf.x)*step(pf.x,0.97)*step(0.05,pf.y)*step(pf.y,0.95); col*=1.0-seam*0.55*(1.0-top);
      float row=floor(g.y/2.4), rf=fract(g.y/2.4), rr=h21(vec2(row,floor(g.x/9.0)+3.0)); vec2 lc=vec2(floor(g.x/0.7),row), lf=vec2(fract(g.x/0.7),rf);
      float led=step(0.3,lf.x)*step(lf.x,0.7)*step(0.44,lf.y)*step(lf.y,0.56)*(1.0-top)*step(0.45,rr);
      float r=h21(lc); float on=step(0.35-uK2*0.15,r)*step(0.25,fract(r*7.0+uT*(0.03+r*0.06)));
      float wave=step(0.55,fract((vW.y+length(vW.xz)*0.6)*0.035-uT*0.9)); on*=mix(1.0,0.25+0.75*wave,uK2);
      vec3 lcol=step(0.9,rr)>0.5?vec3(0.25,1.0,0.5):(step(0.83,r)>0.5?mix(uC,vec3(1.0),0.4)*0.8:uC); lcol*=0.9+0.8*uK2*wave;
      float tx=abs(fract(g.x/3.3+0.37)-0.5)*3.3; float tr=(1.0-smoothstep(0.03,0.08,tx))*(1.0-top)*(1.0-step(0.45,rr)*0.6);
      float pulse=pow(clamp(fract(g.y*0.045-uT*(0.22+uK2*0.5)+floor(g.x/3.3)*0.37),0.0,1.0),10.0);
      float fr=pow(clamp(1.0-abs(dot(N,V)),0.0,1.0),5.0); float far=step(66.0,length(vW.xz)); led*=1.0-far;
      float mk=step(0.55,fract(g.y/17.0))*step(fract(g.y/17.0),0.8)*step(0.15,fract(g.x/6.0+0.1))*step(fract(g.x/6.0+0.1),0.85)*(0.6+0.4*far)*(1.0-top); col=mix(col,vec3(0.09,0.1,0.11)*lam,mk); col*=mix(0.65,1.0,smoothstep(-14.0,16.0,vW.y));
      float hdr=step(abs(fract(g.x/6.0+0.6)-0.5),0.03)*step(0.4,fract(g.y/0.6))*far*(1.0-top); col=mix(col,vec3(0.4,0.42,0.45)*lam,hdr);
      float sled=far*(1.0-top)*(1.0-step(0.07,length(vec2(fract(g.x/6.0+0.35)-0.5,(fract(g.y/17.0)-0.9)*0.35)*6.0)));
      vec3 e=lcol*led*on*0.8+uC*tr*(0.08+pulse*1.6)*(1.0+far*1.4)+uC*fr*0.16+uC*0.035*(1.0-0.85*uK1)*(1.0-smoothstep(-14.0,-6.0,vW.y))+uC*sled*2.0*(0.6+0.4*step(0.5,fract(uT*0.7+g.x*0.13)));
      col+=e; float fg=1.0-exp(-uFogD*uFogD*dist*dist); col=mix(col,uFog,clamp(fg,0.0,1.0)); col=mix(col,uFog,smoothstep(80.0,150.0,dist)*0.6); gl_FragColor=vec4(col,1.0); }`;
  // the board's own slab: dark substrate sides, a gold band, rows of contact pins, pulsing warning chevrons in phase 2, under-glow
  const SLAB_FS = `uniform vec3 uC; uniform float uT,uK1,uK2; varying vec2 vUv; varying vec3 vW; varying vec3 vN; ${HASH}
    void main(){ vec3 N=normalize(vN+vec3(0.0,1e-5,0.0)); float side=1.0-step(0.7,abs(N.y)); float y=vW.y, hc=vW.x+vW.z;
      float lam=0.35+0.65*clamp(dot(N,vec3(-0.27,0.9,0.36))+0.4,0.0,1.0); vec3 col=vec3(0.018,0.03,0.03)*lam;
      float gb=step(-0.42,y)*step(y,-0.3); col=mix(col,vec3(0.5,0.38,0.16)*lam,gb*side);
      float pin=step(abs(fract(hc/1.2)-0.5),0.14)*step(-1.6,y)*step(y,-0.85); col=mix(col,vec3(0.3,0.32,0.34)*lam,pin*side);
      float bw=fwidth(y)+1e-4; float band=smoothstep(-3.0-bw,-3.0+bw,y)*(1.0-smoothstep(-1.95-bw,-1.95+bw,y))*side; float cf=fract(hc*0.35+abs(y+2.475)*0.9-uT*0.7), cw=max(fwidth(cf),1e-4)*2.2; float ch=smoothstep(0.5-cw,0.5+cw,cf)*(1.0-smoothstep(1.0-cw,1.0,cf))+0.18*exp(-abs(cf-0.75)*6.0);
      vec3 e=vec3(1.0,0.08,0.03)*1.9*ch*band*uK1*(1.0-uK2)*(0.55+0.45*sin(uT*6.0))+uC*band*uK2*(0.3+1.2*pow(clamp(fract(hc*0.02-uT*0.5),0.0,1.0),6.0))+uC*band*0.08*(1.0-uK1);
      e+=uC*(0.4-0.2*uK1)*(1.0-smoothstep(-4.0,-3.4,y))*side; gl_FragColor=vec4(col+e,1.0); }`;
  // the void under the board: a faint giant grid with slow sweeping rings, fading into the dark
  const GRID_FS = `uniform vec3 uC; uniform float uT,uK1,uK2; varying vec2 vUv; varying vec3 vW; varying vec3 vN;
    void main(){ vec2 p=vW.xz; float d=length(p); vec2 g=abs(fract(p/4.0)-0.5)*4.0, G=abs(fract(p/20.0)-0.5)*20.0; vec2 fw=max(fwidth(p),vec2(1e-4));
      float l=max((1.0-smoothstep(0.0,fw.x*0.9,min(g.x,g.y)))*0.6,(1.0-smoothstep(0.0,max(fw.x,fw.y)*1.5,min(G.x,G.y))));
      float ring=pow(clamp(fract(d/70.0-uT*(0.06+uK2*0.12)),0.0,1.0),14.0); float fade=exp(-d*0.022)*smoothstep(20.0,30.0,d+8.0);
      vec3 c=vec3(0.004,0.01,0.01)+uC*(l*(0.14+ring*0.7)+ring*0.03)*fade*(1.0-0.6*uK1); gl_FragColor=vec4(c,1.0); }`;
  // phase-coloured glow on the horizon, heat shimmer in phase 2, glitch tears and a drifting tear band in phase 3
  const HOR_FS = `uniform vec3 uC; uniform float uT,uK1,uK2; varying vec2 vUv; varying vec3 vW; varying vec3 vN; ${HASH}
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y); }
    void main(){ float v=vUv.y+sin(vUv.x*120.0+uT*2.3)*0.006*uK1; float d=v-0.3; float up=max(d,0.0), dn=max(-d,0.0);
      float a=exp(-up*(9.0-3.5*uK2))*0.55+exp(-up*60.0)*0.6; a*=exp(-dn*6.0); a*=1.0-smoothstep(0.6,0.95,v);
      float neb=vn(vec2(vUv.x*26.0+uT*0.02,v*7.0))*0.6+vn(vec2(vUv.x*61.0,v*17.0-uT*0.03))*0.4; a*=0.65+0.7*neb;
      a*=(0.3-0.08*uK1+0.22*uK2);
      float row=floor(v*400.0), ft=floor(uT*14.0); float sl=step(0.996,h21(vec2(row,ft)))*smoothstep(0.24,0.32,v)*(1.0-smoothstep(0.42,0.55,v))*uK2;
      float seg=step(0.8,h21(vec2(floor(vUv.x*(30.0+h21(vec2(row,3.0))*50.0)),ft+row)));
      a+=sl*seg*0.7; gl_FragColor=vec4(uC*a,1.0); }`;

  // <circuit> (pure: fuzzed in node by tools/logicfuzz.js)
  const OPS = { NOT: (a) => !a, AND: (a, b) => a && b, OR: (a, b) => a || b, XOR: (a, b) => a !== b, NAND: (a, b) => !(a && b), NOR: (a, b) => !(a || b) };
  // { n inputs, flip: how many of them can be flipped, gates: [{ op, a, b, zone, lvl }], out: gate index per zone, latch: zone fed back as input 3 }
  // a reference r < n is input r, otherwise gate r - n
  function evalC(C, bits) { const v = [], get = (r) => r < C.n ? !!bits[r] : v[r - C.n]; C.gates.forEach((g, i) => { v[i] = OPS[g.op](get(g.a), g.b === undefined ? false : get(g.b)); }); return { v, out: C.out.map((i) => v[i]) }; }
  function genC(lvl, rng) {
    const pk = (a) => a[Math.floor(rng() * a.length)], sh = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    if (lvl === 0) { const gates = sh(['NOT', 'AND', 'OR']).map((op, z) => { const s = sh([0, 1, 2]); return op === 'NOT' ? { op, a: s[0], zone: z, lvl: 1 } : { op, a: Math.min(s[0], s[1]), b: Math.max(s[0], s[1]), zone: z, lvl: 1 }; }); return { n: 3, flip: 3, gates, out: [0, 1, 2], latch: -1 }; }
    const n = 4, O = lvl === 1 ? ['AND', 'OR', 'XOR'] : ['AND', 'OR', 'XOR', 'NAND', 'NOR'], gates = [], out = [], useQ = lvl === 2 ? sh([0, 1, 2]).slice(0, 1 + Math.floor(rng() * 2)) : [];
    for (let z = 0; z < 3; z++) {
      const s = sh(lvl === 1 ? [0, 1, 2, 3] : [0, 1, 2]), c = useQ.indexOf(z) >= 0 ? 3 : s[2];
      gates.push({ op: pk(O), a: Math.min(s[0], s[1]), b: Math.max(s[0], s[1]), zone: z, lvl: 0 });
      gates.push({ op: pk(O), a: n + gates.length - 1, b: c, zone: z, lvl: 1 }); out.push(gates.length - 1);
    }
    return { n, flip: lvl === 1 ? 4 : 3, gates, out, latch: lvl === 2 ? Math.floor(rng() * 3) : -1 };
  }
  // the best set of at most two flips: one that leaves somewhere to stand, and if possible shorts the zone `bz`
  function solveC(C, bits, bz) {
    const sets = [[]]; for (let i = 0; i < C.flip; i++) { sets.push([i]); for (let j = i + 1; j < C.flip; j++) sets.push([i, j]); }
    let best = null;
    for (const f of sets) { const bb = bits.slice(); f.forEach((i) => { bb[i] = !bb[i]; }); const o = evalC(C, bb).out; if (o.every((v) => v)) continue; const short = bz >= 0 && o[bz], sc = (short ? 10 : 0) - f.length; if (!best || sc > best.sc) best = { flips: f, short, sc, out: o }; }
    return best;
  }
  function makeC(lvl, rng, bits, bz) { // always survivable; where it can be, shortable but not already shorted
    let fall = null;
    for (let k = 0; k < 60; k++) { const C = genC(lvl, rng), s = solveC(C, bits, bz); if (!s) continue; if (!fall) fall = C; if (s.short && s.flips.length > 0) return C; }
    return fall || genC(0, rng);
  }
  // </circuit>

  // ---- the board: traces and gate symbols painted on the floor, redrawn whenever the circuit or a bit changes ----
  function baseCanvas() {
    const cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d'), r = mulberry(1808);
    x.fillStyle = '#0a2a1e'; x.fillRect(0, 0, N, N);
    x.strokeStyle = 'rgba(40,110,80,0.16)'; x.lineWidth = 1; for (let i = 0; i <= 36; i++) { x.beginPath(); x.moveTo(i * U, 0); x.lineTo(i * U, N); x.moveTo(0, i * U); x.lineTo(N, i * U); x.stroke(); }
    x.strokeStyle = 'rgba(30,120,84,0.35)'; x.lineWidth = 2; x.fillStyle = 'rgba(30,120,84,0.5)';
    for (let i = 0; i < 70; i++) { let a = Math.floor(r() * 36) + 0.5, b = Math.floor(r() * 36) + 0.5; x.beginPath(); x.moveTo(a * U, b * U); for (let k = 0; k < 3; k++) { if (r() < 0.5) a += Math.floor(r() * 7) - 3; else b += Math.floor(r() * 7) - 3; x.lineTo(a * U, b * U); } x.stroke(); x.beginPath(); x.arc(a * U, b * U, 4, 0, TAU); x.fill(); }
    x.fillStyle = 'rgba(4,20,16,0.5)'; x.fillRect(0, 0, N, px(ZS));
    x.strokeStyle = 'rgba(200,160,70,0.85)'; x.lineWidth = 4; for (let z = 0; z < 3; z++) x.strokeRect(px(ZX[z] - 6) + 5, px(ZN) + 5, 12 * U - 10, (ZS - ZN) * U - 10);
    x.lineWidth = 6; x.strokeRect(3, 3, N - 6, N - 6);
    return cv;
  }
  function glyph(x, op, gx, gz, s, col, fill) {
    x.save(); x.translate(px(gx), px(gz)); x.scale(s * U, s * U * 1.35); x.lineWidth = 0.13; x.strokeStyle = col; x.fillStyle = fill; x.lineJoin = 'round';
    const bub = (y) => { x.beginPath(); x.arc(0, y, 0.2, 0, TAU); x.fill(); x.stroke(); };
    if (op === 'NOT') { x.beginPath(); x.moveTo(-0.85, 1); x.lineTo(0.85, 1); x.lineTo(0, -0.7); x.closePath(); x.fill(); x.stroke(); bub(-0.9); }
    else if (op === 'AND' || op === 'NAND') { x.beginPath(); x.moveTo(-1, 1); x.lineTo(-1, -0.1); x.arc(0, -0.1, 1, PI, TAU); x.lineTo(1, 1); x.closePath(); x.fill(); x.stroke(); if (op === 'NAND') bub(-1.3); }
    else { x.beginPath(); x.moveTo(-1, 1); x.quadraticCurveTo(0, 0.4, 1, 1); x.quadraticCurveTo(1, -0.45, 0, -1.1); x.quadraticCurveTo(-1, -0.45, -1, 1); x.closePath(); x.fill(); x.stroke();
      if (op === 'XOR') { x.beginPath(); x.moveTo(-1, 1.36); x.quadraticCurveTo(0, 0.76, 1, 1.36); x.stroke(); } if (op === 'NOR') bub(-1.3); }
    x.restore();
  }
  const gatePos = (g) => g.lvl === 0 ? { x: ZX[g.zone] - 1.1, z: 5.4, s: 1.2, d: 0.85 } : { x: ZX[g.zone], z: -1.8, s: 1.55, d: 1.1 };
  const draw = (S) => { S.dirty = true; }; // painted on the next rendered frame
  function paint(S) {
    S.dirty = false; if (!S.baseCv) S.baseCv = baseCanvas(); const x = S.ctx, C = S.C; x.drawImage(S.baseCv, 0, 0);
    if (C) {
      const rev = S.rev, E = S.shown, LIT = '#ff58dc', OFF = '#1c9cc0', IDLE = '#c09a44';
      const col = (need, val) => rev >= need && E ? (val ? LIT : OFF) : IDLE;
      const line = (pts, c, wd) => { for (const [cc, w] of [['#020806', wd + 7], [c, wd]]) { x.strokeStyle = cc; x.lineWidth = w; x.lineJoin = x.lineCap = 'round'; x.beginPath(); pts.forEach((q, i) => i ? x.lineTo(px(q[0]), px(q[1])) : x.moveTo(px(q[0]), px(q[1]))); x.stroke(); } };
      if (rev >= 4 && E) E.out.forEach((v, z) => { const X0 = px(ZX[z] - 6) + 7, Y0 = px(ZN) + 7, Wd = 12 * U - 14, Hd = (ZS - ZN) * U - 14; x.fillStyle = v ? 'rgba(255,60,210,0.27)' : 'rgba(40,200,230,0.10)'; x.fillRect(X0, Y0, Wd, Hd);
        if (v) { x.save(); x.beginPath(); x.rect(X0, Y0, Wd, Hd); x.clip(); x.strokeStyle = 'rgba(255,110,230,0.16)'; x.lineWidth = 3; x.beginPath(); for (let k = -Hd; k < Wd; k += 20) { x.moveTo(X0 + k, Y0 + Hd); x.lineTo(X0 + k + Hd, Y0); } x.stroke();
          for (const [w, a] of [[40, 0.07], [22, 0.12], [10, 0.22], [4, 0.45]]) { x.strokeStyle = `rgba(255,80,220,${a})`; x.lineWidth = w; x.strokeRect(X0, Y0, Wd, Hd); } x.restore(); } });
      if (C.latch >= 0) line([[ZX[C.latch], -4.3], [-17.3, -4.3], [-17.3, 14.4], [-16.9, 14.4]], rev >= 4 && E ? (E.out[C.latch] ? LIT : OFF) : '#7a58c8', 5);
      let row = 0;
      C.gates.forEach((g, gi) => {
        const P = gatePos(g), pins = g.b === undefined ? [[g.a, P.x]] : [[g.a, P.x - P.d], [g.b, P.x + P.d]];
        for (const [r, pxx] of pins) {
          if (r < C.n) { const ip = S.ipos[r], rz = 12.6 - (row++) * 0.55; line([[ip, 13.3], [ip, rz], [pxx, rz], [pxx, P.z + P.s * 0.5]], col(1, E && S.shownBits[r]), 6); }
          else { const Q = gatePos(C.gates[r - C.n]); line([[Q.x, Q.z], [pxx, P.z + P.s * 0.5]], col(2, E && E.v[r - C.n]), 6); }
        }
        if (g.lvl === 1) line([[P.x, P.z], [P.x, ZS + 0.25]], col(3, E && E.v[gi]), 7);
      });
      C.gates.forEach((g, gi) => { const P = gatePos(g), need = g.lvl === 0 ? 2 : 3, on = rev >= need && E; glyph(x, g.op, P.x, P.z, P.s, on ? (E.v[gi] ? LIT : OFF) : '#f0c868', on && E.v[gi] ? 'rgba(120,20,100,0.95)' : 'rgba(4,22,16,0.95)'); });
      for (let i = 0; i < C.n; i++) { const ix = S.ipos[i], on = S.bits[i], q = i >= C.flip; x.fillStyle = on ? 'rgba(255,70,215,0.85)' : 'rgba(6,30,24,0.95)'; x.strokeStyle = q ? '#9a78e8' : i === S.skew ? '#ff9a30' : '#f0c868'; x.lineWidth = i === S.skew ? 7 : 4;
        if (q) { x.beginPath(); x.arc(px(ix), px(14.6), 1.25 * U, 0, TAU); x.fill(); x.stroke(); } else { x.fillRect(px(ix - 1.3), px(13.3), 2.6 * U, 2.6 * U); x.strokeRect(px(ix - 1.3), px(13.3), 2.6 * U, 2.6 * U); if (i === S.skew) { x.setLineDash([10, 8]); x.strokeRect(px(ix - 1.75), px(12.85), 3.5 * U, 3.5 * U); x.setLineDash([]); } } }
    }
    S.tex.needsUpdate = true;
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x010608, horizon: 0x0a3a34, bottom: 0x010405, stars: 0.5, nebula: 0.5, nebulaA: 0x0a5a50, nebulaB: 0x402a70, sunSize: 0, sunGlow: 0, exp: 0.7 });
    g.add(sky); S.sky = sky; W.env(sky, 0.9);
    scene.fog = new THREE.FogExp2(0x03100e, 0.006);
    S.hemi = W.hemi(g, 0x9fd8d0, 0x2a3a30, 1.12);
    S.sun = W.sun(g, { dir: [-0.3, 1, 0.4], color: 0xcfeee8, intensity: 1.7, size: 30 });
    S.rim = new THREE.DirectionalLight(0x9ad0ff, 4.0); S.rim.position.set(3, -3, -40); g.add(S.rim); g.add(S.rim.target); S.key = new THREE.DirectionalLight(0xa8c8ff, 2.0); S.key.position.set(-6, -2, 40); g.add(S.key); g.add(S.key.target);
    S.baseCv = null; S.cv = document.createElement('canvas'); S.cv.width = S.cv.height = N; S.ctx = S.cv.getContext('2d');
    S.tex = new THREE.CanvasTexture(S.cv); S.tex.colorSpace = THREE.SRGBColorSpace; S.tex.anisotropy = 8;
    S.floorM = new THREE.MeshStandardMaterial({ map: S.tex, emissiveMap: S.tex, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.42, metalness: 0.25, envMapIntensity: 0.5 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * H, 2 * H), S.floorM); floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
    S.ppoolU = { uA: { value: 0.075 } }; S.ppool = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), shm(S.ppoolU, `uniform float uA; varying vec2 vUv; varying vec3 vW; varying vec3 vN; void main(){ float r=clamp(length(vUv-0.5)*2.0,0.0,1.0); float a=(1.0-r)*(1.0-r)*uA; gl_FragColor=vec4(vec3(0.75,0.85,1.0)*a,1.0); }`, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); S.ppool.rotation.x = -PI / 2; S.ppool.position.y = 0.02; S.ppool.renderOrder = 2; g.add(S.ppool);
    // shared uniforms of the surround: phase colour, time, phase-2 heat, phase-3 overclock
    S.TU = { uC: { value: new THREE.Color(CY) }, uT: { value: 0 }, uK1: { value: 0 }, uK2: { value: 0 }, uFog: { value: scene.fog.color }, uFogD: { value: 0.006 } };
    // lit outputs: an inward-scanning band and a bright rim over the painted fill (same hue, never over a dark output)
    S.zoneU = [0, 1, 2].map(() => ({ uT: S.TU.uT, uOn: { value: 0 } }));
    S.zoneFx = S.zoneU.map((U, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(12 - 0.5, ZS - ZN - 0.5), shm(U, `uniform float uT,uOn; varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      void main(){ float d=min(min(vUv.x,1.0-vUv.x)*11.5,min(vUv.y,1.0-vUv.y)*12.5); float ph=fract(d*0.22-uT*0.45); float band=smoothstep(0.0,0.3,ph)*(1.0-smoothstep(0.3,0.6,ph))*0.09; float rim=exp(-d*2.2)*0.22;
        float a=(band+rim)*uOn; gl_FragColor=vec4(vec3(1.0,0.25,0.82)*a,1.0); }`, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -PI / 2; m.position.set(ZX[z], 0.015, (ZN + ZS) / 2); m.renderOrder = 2; g.add(m); return m; });
    const gold = W.mat({ color: 0xc09a44, roughness: 0.5, metalness: 0.75 }), black = W.mat({ color: 0x0c0e12, roughness: 0.9, metalness: 0.1 }), dark = W.mat({ color: 0x06090c, roughness: 0.9, metalness: 0.1 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2 * H + 2, 4, 2 * H + 2), shm(S.TU, SLAB_FS)); slab.position.y = -2.02; g.add(slab);
    S.frameM = W.mat({ color: 0x151a20, roughness: 0.42, metalness: 0.75 }); const inlM = W.glow(0xf0c868, 0.7), prof = new THREE.Shape(), pads = [];
    prof.moveTo(-0.5, -0.05); prof.lineTo(-0.5, 0.65); prof.lineTo(0.2, 0.65); prof.lineTo(0.5, 0.35); prof.lineTo(0.5, -0.05); prof.closePath();
    for (const [x, z, L, ry] of [[0, -H - 0.5, 2 * H + 2, PI / 2], [0, H + 0.5, 2 * H + 2, -PI / 2], [-H - 0.5, 0, 2 * H, PI], [H + 0.5, 0, 2 * H, 0]]) {
      const ge = new THREE.ExtrudeGeometry(prof, { depth: L, bevelEnabled: false }); ge.translate(0, 0, -L / 2); const m = new THREE.Mesh(ge, S.frameM); m.position.set(x, 0, z); m.rotation.y = ry; m.castShadow = true; g.add(m);
      const inl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, L), inlM); inl.position.set(-0.4, 0.66, 0); m.add(inl); const ch = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, L), S.chamM || (S.chamM = W.glow(CY, 1))); ch.position.set(0.21, 0.645, 0); m.add(ch);
      for (let p = -L / 2 + 1; p < L / 2 - 0.5; p += 1.5) { const lx = -0.08, cs = Math.cos(ry), sn = Math.sin(ry); pads.push([x + lx * cs + p * sn, z - lx * sn + p * cs]); } }
    { const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0xd8b060, roughness: 0.3, metalness: 0.8, emissive: 0xffc050, emissiveIntensity: 0.55 }), pads.length); pads.forEach((p, i) => { _m.makeTranslation(p[0], 0.67, p[1]); im.setMatrixAt(i, _m); }); g.add(im); }
    // a halo of light leaking from under the slab, then the grid of the void far below
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), shm(S.TU, `uniform vec3 uC; uniform float uK1; varying vec2 vUv; varying vec3 vW; varying vec3 vN; void main(){ float d=max(abs(vW.x),abs(vW.z))-19.0; float a=step(0.0,d)*exp(-d*(0.7+0.8*uK1))*(0.4-0.18*uK1); gl_FragColor=vec4(uC*a,1.0); }`, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.rotation.x = -PI / 2; halo.position.y = -4.3; g.add(halo);
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), shm(S.TU, GRID_FS)); grid.rotation.x = -PI / 2; grid.position.y = -13; g.add(grid);
    const hor = new THREE.Mesh(new THREE.CylinderGeometry(160, 160, 70, 48, 1, true), shm(S.TU, HOR_FS, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide })); hor.position.y = 8; g.add(hor);
    // the skyline: capacitors, chips and monoliths the size of buildings, rising out of the void
    const r = mulberry(404), BASE = -14; S.towM = shm(S.TU, TOWER_FS); S.bandM = W.glow(CY, 1.4); S.tops = []; const legs = [];
    const sleeveM = W.mat({ color: 0x7a8696, roughness: 0.55, metalness: 0.3 }), canM = W.mat({ color: 0x9aa4b0, roughness: 0.4, metalness: 0.85 }), finM = W.mat({ color: 0x5a6470, roughness: 0.5, metalness: 0.35 }), cuM = (() => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 8; const x = cv.getContext('2d'); for (let i = 0; i < 40; i++) { x.fillStyle = '#c07a48'; x.fillRect(i * 12.8, 0, 9.5, 8); x.fillStyle = '#e8b080'; x.fillRect(i * 12.8 + 3, 0, 2, 8); x.fillStyle = '#140804'; x.fillRect(i * 12.8 + 9.5, 0, 3.3, 8); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(1, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.28, metalness: 0.85, envMapIntensity: 1.2 }); })(), markM = W.mat({ color: 0x20252c, roughness: 0.75, metalness: 0.1 });
    const at = (o, x, y, z, ry) => { o.position.set(x, y, z); if (ry) o.rotation.y = ry; g.add(o); return o; };
    const ic = (x, z, ry, w, top) => { const dd = w * 0.62, h = top - BASE; at(new THREE.Mesh(boxW(w, h, dd, r() * 500), S.towM), x, BASE + h / 2, z, ry); at(new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.06, dd * 0.45), markM), x, top + 0.03, z, ry);
      const n = Math.floor((w - 0.6) / 0.85), cs = Math.cos(ry), sn = Math.sin(ry); for (let sd = -1; sd <= 1; sd += 2) for (let p = 0; p < n; p++) { const lx = -w / 2 + 0.6 + p * 0.85, lz = sd * (dd / 2 + 0.14); legs.push([x + lx * cs + lz * sn, top - 0.9, z - lx * sn + lz * cs, ry]); } };
    const cap = (x, z, rr, top) => { const h = top - BASE; at(new THREE.Mesh(cylW(rr, h, r() * 500), S.towM), x, BASE + h / 2, z); at(new THREE.Mesh(new THREE.CylinderGeometry(rr * 1.012, rr * 1.012, h - 1.2, 12, 1, true, r() * TAU, 0.9), sleeveM), x, BASE + (h - 1.2) / 2, z);
      at(new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.97, rr * 0.97, 0.35, 24), canM), x, top + 0.17, z); for (const a of [0, PI / 2]) at(new THREE.Mesh(new THREE.BoxGeometry(rr * 1.5, 0.06, 0.1), markM), x, top + 0.36, z, a);
      at(new THREE.Mesh(new THREE.CylinderGeometry(rr * 1.02, rr * 1.02, 0.22, 24, 1, true), S.bandM), x, top - 1.0, z); if (top <= 8) S.nearTops.push(new V3(x, top + 0.4, z)); if (top > 8) { S.tops.push(new V3(x, top + 0.4, z)); edges.push([x + rr * 0.72, BASE + h / 2, z + rr * 0.72, h], [x - rr * 0.72, BASE + h / 2, z - rr * 0.72, h]); at(new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), S.bandM), x + rr, top - 2.2, z); } };
    const sink = (x, z, ry, w, top) => { const fh = 6 + r() * 3, h = top - fh - BASE; at(new THREE.Mesh(boxW(w, h, 6, r() * 500), S.towM), x, BASE + h / 2, z, ry); const grp = at(new THREE.Group(), x, top - fh, z, ry);
      for (let f = 0; f < 8; f++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(w, fh, 0.22), finM); fin.position.set(0, fh / 2, (f - 3.5) * 0.78); grp.add(fin); const ed = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.24), S.bandM); ed.position.set(0, fh, (f - 3.5) * 0.78); grp.add(ed); } };
    const coil = (x, z, ry, top) => { const h = top - 5.4 - BASE; at(new THREE.Mesh(boxW(5.6, h, 3, r() * 500), S.towM), x, BASE + h / 2, z, ry); at(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.95, 20, 96), cuM), x, top - 2.7, z, ry); for (const sd of [-0.7, 0.7]) at(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 6), canM), x + Math.cos(ry) * sd, top - 5.3, z - Math.sin(ry) * sd); };
    const stack = (x, z, top) => { const h = top - BASE; at(new THREE.Mesh(cylW(1.4, h, r() * 500), S.towM), x, BASE + h / 2, z); const tg = new THREE.TorusGeometry(1.75, 0.42, 10, 40); tg.rotateX(PI / 2); for (let y = top - 1; y > top - 9; y -= 1.0) at(new THREE.Mesh(tg, cuM), x, y, z); S.tops.push(new V3(x, top, z)); };
    const edges = []; S.nearTops = []; const mono = (x, z, ry, w, top, dd) => { const h = top - BASE; for (const [ex, ez] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const lx = ex * (w / 2 + 0.02), lz = ez * (dd / 2 + 0.02); edges.push([x + lx * Math.cos(ry) + lz * Math.sin(ry), BASE + h / 2, z - lx * Math.sin(ry) + lz * Math.cos(ry), h]); } at(new THREE.Mesh(boxW(w, h, dd, r() * 500), S.towM), x, BASE + h / 2, z, ry); at(new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.18, dd + 0.1), S.bandM), x, top - 0.6, z, ry); S.tops.push(new V3(x, top, z)); };
    const ring = (n, d0, d1, fn) => { for (let i = 0; i < n; i++) { const a = (i + r() * 0.5) / n * TAU, d = d0 + r() * (d1 - d0), x = Math.sin(a) * d, z = Math.cos(a) * d; if (Math.abs(x) < 15 && z < -18 && z > -46) continue; fn(x, z, a, i); } };
    ring(14, 30, 38, (x, z, a, i) => { if (i % 2) ic(x, z, Math.round(a / (PI / 2)) * PI / 2, 6 + r() * 6, -3.5 + r() * 2); else cap(x, z, 1.6 + r() * 1.2, -2 + r() * 5); });
    ring(12, 44, 58, (x, z, a, i) => { const k = i % 4; if (k === 0) sink(x, z, a, 5 + r() * 3, 6 + r() * 6); else if (k === 1) coil(x, z, a + PI / 2, 5 + r() * 4); else if (k === 2) cap(x, z, 2.4 + r() * 1.4, 5 + r() * 9); else ic(x, z, a, 9 + r() * 5, 1 + r() * 3); });
    ring(22, 78, 115, (x, z, a, i) => { const k = i % 3; if (k === 0) mono(x, z, a, 4 + r() * 5, 14 + r() * 26, 3 + r() * 3); else if (k === 1) cap(x, z, 3 + r() * 2, 14 + r() * 18); else stack(x, z, 12 + r() * 14); });
    if (edges.length) { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 1, 0.09), S.edgeLM = W.glow(CY, 0.8), edges.length); edges.forEach((p, i) => { _m.makeScale(1, p[3], 1); _m.setPosition(p[0], p[1], p[2]); im.setMatrixAt(i, _m); }); g.add(im); }
    if (legs.length) { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 1.7, 0.2), canM, legs.length); legs.forEach((p, i) => { _m.makeRotationY(p[3]); _m.setPosition(p[0], p[1], p[2]); im.setMatrixAt(i, _m); }); g.add(im); }
    // the system clock: a quartz can on the north wall that pulses with every cycle
    S.oscU = { uC: { value: new THREE.Color(CY) } }; S.oscM = shm(S.oscU, `uniform vec3 uC; varying vec2 vUv; varying vec3 vW; varying vec3 vN; void main(){ float sx=fract(vUv.x*18.0); float seg=step(0.1,sx)*step(sx,0.9)*step(0.33,vUv.y)*step(vUv.y,0.67); float gl=exp(-abs(vUv.y-0.5)*7.0)*0.3*step(0.02,vUv.x)*step(vUv.x,0.98); gl_FragColor=vec4(uC*(seg+gl),1.0); }`, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    // the same schematic, hanging in the air to the north so it can be read from anywhere: a framed scanline display
    S.holoU = { uMap: { value: S.tex }, uT: S.TU.uT, uA: { value: 0.56 }, uG: { value: 0 } };
    S.holoM = shm(S.holoU, `uniform sampler2D uMap; uniform float uT,uA,uG; varying vec2 vUv; varying vec3 vW; varying vec3 vN; ${HASH}
      void main(){ vec2 uv=vUv; float bl=floor(uv.y*160.0), ft=floor(uT*12.0); float tear=step(0.95,h21(vec2(bl,ft)))*uG; vec2 su=uv+vec2((h21(vec2(bl*3.1,ft))-0.5)*0.07,0.0);
        vec3 c=texture2D(uMap,clamp(uv,0.0,1.0)).rgb*vec3(0.69,1.0,0.94); vec3 cs=texture2D(uMap,clamp(su,0.0,1.0)).rgb*vec3(0.85,0.8,1.1); c=mix(c,max(c,cs),tear*0.75); float sc=0.84+0.16*sin(vUv.y*300.0-uT*3.0); float fl=1.0-0.07*step(0.75,h21(vec2(floor(uT*6.0),7.0)));
        float e=smoothstep(0.0,0.015,vUv.x)*(1.0-smoothstep(0.985,1.0,vUv.x))*smoothstep(0.0,0.015,vUv.y)*(1.0-smoothstep(0.985,1.0,vUv.y)); float a=uA*sc*fl*e; gl_FragColor=vec4(c*a,1.0); }`,
      { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const hg = new THREE.Group(); hg.position.set(0, 9.6, -22.5); hg.rotation.x = 0.1; g.add(hg); hg.add(new THREE.Mesh(new THREE.PlaneGeometry(17, 17), S.holoM)); const bp = new THREE.Mesh(new THREE.BoxGeometry(17.6, 20, 0.3), dark); bp.position.set(0, -1.3, -0.5); hg.add(bp); const ow = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 1.5), S.oscM); ow.position.set(0, -10.1, -0.3); hg.add(ow);
    for (const [x, y, w, h] of [[0, 8.85, 18.2, 0.7], [0, -8.85, 18.2, 0.7], [-8.85, 0, 0.7, 17], [8.85, 0, 0.7, 17]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), black); f.position.set(x, y, -0.15); hg.add(f); const l = new THREE.Mesh(new THREE.BoxGeometry(w > h ? w - 1.2 : 0.07, w > h ? 0.07 : h, 0.06), S.bandM); l.position.set(x - Math.sign(x) * 0.36, y - Math.sign(y) * 0.36, 0.12); hg.add(l); }
    for (const sx of [-8.85, 8.85]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.6, 14, 0.6), black); st.position.set(sx, -15.5, -0.5); hg.add(st); }
    S.motes = W.motes({ n: 240, box: [70, 30, 70], color: 0x60ffe0, size: 0.14, vel: [0, 1.6, 0], sway: 0.2, center: [0, 12, 0], alpha: 0.5 }); g.add(S.motes);
    // embers (phase 2) and sparks (phase 3) rising off the board's edges
    S.sparks = [[0, -H - 1.6, 2 * H + 3, 1.4, 9, 1.5], [-H - 1.6, 0, 1.4, 2 * H + 3, 4.4, -1.8], [H + 1.6, 0, 1.4, 2 * H + 3, 4.4, -1.8]].map(([x, z, w, d, hh, cy]) => { const m = W.motes({ n: 80, box: [w, hh, d], color: 0xffffff, size: 0.5, vel: [0, 4.2, 0], sway: 0.1, center: [x, cy, z], alpha: 0, streak: true }); g.add(m); return m.material.uniforms; });
    // the bits: four lamp pylons, each one an entity so that any hit toggles it
    S.pyl = []; const postG = new THREE.CylinderGeometry(0.16, 0.26, 1.5, 12), baseG = new THREE.CylinderGeometry(0.72, 0.84, 0.16, 20), collG = new THREE.CylinderGeometry(0.3, 0.22, 0.24, 16), lampG = new THREE.SphereGeometry(0.55, 20, 14), cageG = new THREE.TorusGeometry(0.72, 0.05, 6, 24), lipG = new THREE.TorusGeometry(0.78, 0.025, 4, 32);
    const postM = W.mat({ color: 0x6a7584, roughness: 0.32, metalness: 0.85 }), lipM = W.glow(0xf0c868, 0.55), rimG = new THREE.SphereGeometry(0.575, 20, 14);
    S.lampRimM = shm({}, `varying vec2 vUv; varying vec3 vW; varying vec3 vN; void main(){ vec3 N=normalize(vN+vec3(0.0,1e-5,0.0)); vec3 V=normalize(cameraPosition-vW+vec3(0.0,1e-4,0.0)); float f=pow(clamp(1.0-abs(dot(N,V)),0.0,1.0),3.0); gl_FragColor=vec4(vec3(0.5,0.65,0.9)*f*0.55,1.0); }`, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Group(), add = (geo, mat, y, rx) => { const o = new THREE.Mesh(geo, mat); o.position.y = y; if (rx) o.rotation.x = rx; m.add(o); return o; };
      add(baseG, gold, 0.08); add(lipG, lipM, 0.17, PI / 2); add(postG, postM, 0.9).castShadow = true; add(collG, gold, 1.68);
      const lm = new THREE.MeshStandardMaterial({ color: 0x1c0c1a, roughness: 0.26, metalness: 0.2, emissive: MG }); add(lampG, lm, 2.1); add(rimG, S.lampRimM, 2.1); add(cageG, gold, 2.1, PI / 2);
      const ent = b.spawnAdd({ name: 'Bit', hp: 1e7, x: 0, z: 14.6, radius: 0.9, aimY: 2.0, mesh: m, color: MG, onDamaged() { if (S.pyl[i].lock <= 0 && S.C && i < S.C.flip) toggle(b, i); } });
      S.pyl.push({ ent, lm, lock: 0, k: 0 });
    }
    // forks: a smoked amber shell around a bright core, edged in light (one hidden copy so its shaders are built up front)
    S.forkG = new THREE.OctahedronGeometry(0.75); S.forkCG = new THREE.OctahedronGeometry(0.3); S.forkEG = new THREE.EdgesGeometry(S.forkG);
    S.forkM = new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.35, metalness: 0.6, emissive: AMBER, emissiveIntensity: 0.45, flatShading: true, transparent: true, opacity: 0.7 });
    S.forkCM = W.glow(AMBER, 3.2); S.forkLM = new THREE.LineBasicMaterial({ color: new THREE.Color(AMBER).multiplyScalar(2.4) });
    const fd = forkMesh(S); fd.visible = false; fd.position.y = -3; g.add(fd);
    // ---- Daemon: a glowing core behind a shell of machined plates, three notched hoops, and a halo of orbiting bit-plates and pins ----
    S.rig = new THREE.Group(); b.group.add(S.rig); S.core = new THREE.Group(); S.rig.add(S.core);
    S.seamM = W.glow(CY, 2, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); { const sm = new THREE.Mesh(new THREE.IcosahedronGeometry(1.08, 1), S.seamM); sm.renderOrder = -1; S.core.add(sm); S.hotM = W.glow(0xffffff, 1, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); const hm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), S.hotM); hm.renderOrder = -1; S.core.add(hm); S.seamLM = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); S.core.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.24, 0)), S.seamLM)); }
    { const ico = new THREE.IcosahedronGeometry(1.32, 0), P = ico.attributes.position, out = [], A = new V3(), B = new V3(), Cc = new V3(), M = new V3();
      const push = (...v) => { for (const q of v) out.push(q.x, q.y, q.z); };
      for (let f = 0; f < P.count; f += 3) {
        A.fromBufferAttribute(P, f); B.fromBufferAttribute(P, f + 1); Cc.fromBufferAttribute(P, f + 2); M.copy(A).add(B).add(Cc).divideScalar(3);
        const o = [A, B, Cc].map((v) => v.clone().sub(M).multiplyScalar(0.72).add(M)), n = o.map((v) => v.clone().multiplyScalar(0.8));
        push(o[0], o[1], o[2], n[0], n[2], n[1]); for (let e = 0; e < 3; e++) { const a = e, c = (e + 1) % 3; push(o[a], n[a], n[c], o[a], n[c], o[c]); }
      }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); sg.computeVertexNormals();
      S.coreM = new THREE.MeshStandardMaterial({ color: 0x0e1a22, roughness: 0.38, metalness: 0.7, flatShading: true, emissive: CY, emissiveIntensity: 0.2, transparent: true, side: THREE.DoubleSide });
      S.shell = new THREE.Mesh(sg, S.coreM); S.shell.castShadow = true; S.core.add(S.shell); }
    S.eyeM = W.glow(CY, 5); S.eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), S.eyeM); S.eye.position.z = 1.45; S.eye.scale.set(1.6, 0.7, 1); S.rig.add(S.eye);
    S.ringM = new THREE.MeshStandardMaterial({ color: 0xb08a40, roughness: 0.4, metalness: 0.85, emissive: CY, emissiveIntensity: 0.15, transparent: true });
    S.rimGM = W.glow(CY, 2.6, { transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }); S.tickM = W.glow(CY, 1.8, { transparent: true });
    const hoop = (R, w, nn) => { const s = new THREE.Shape(), M = 120; for (let i = 0; i <= M; i++) { const a = i / M * TAU, rr = R + w / 2 - ((i % (M / nn)) < 2 ? 0.09 : 0); if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      const h = new THREE.Path(); h.absarc(0, 0, R - w / 2, 0, TAU, true); s.holes.push(h); const ge = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 1, curveSegments: 72 }); ge.translate(0, 0, -0.05); return ge; };
    const tickG = new THREE.BoxGeometry(0.03, 0.075, 0.012);
    S.rings = [[2.0, 0.24, 6], [2.5, 0.26, 8], [3.0, 0.28, 12]].map(([R, w, nn], i) => {
      const m = new THREE.Mesh(hoop(R, w, nn), S.ringM); m.castShadow = true; S.rig.add(m);
      for (const sz of [-0.078, 0.078]) { const e = new THREE.Mesh(new THREE.RingGeometry(R - w / 2 - 0.004, R - w / 2 + 0.035, 96), S.rimGM); e.position.z = sz; m.add(e); }
      const nt = 48, im = new THREE.InstancedMesh(tickG, S.tickM, nt * 2); for (let k = 0; k < nt * 2; k++) { const a = (k % nt) / nt * TAU, rr = R + w / 2 - 0.16; _m.makeRotationZ(a - PI / 2); _m.setPosition(Math.cos(a) * rr, Math.sin(a) * rr, k < nt ? 0.078 : -0.078); im.setMatrixAt(k, _m); } m.add(im);
      return m; });
    S.satM = new THREE.MeshStandardMaterial({ color: 0x141e28, roughness: 0.4, metalness: 0.6, emissive: CY, emissiveIntensity: 0.5, transparent: true }); S.pinM = W.glow(CY, 2.2, { transparent: true });
    S.sat = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.07, 0.42), S.satM, 20); { const sh = new THREE.Shape(); sh.moveTo(-0.33, -0.23); sh.lineTo(0.33, -0.23); sh.lineTo(0.33, 0.23); sh.lineTo(-0.33, 0.23); sh.closePath(); const ho = new THREE.Path(); ho.moveTo(-0.29, -0.19); ho.lineTo(-0.29, 0.19); ho.lineTo(0.29, 0.19); ho.lineTo(0.29, -0.19); ho.closePath(); sh.holes.push(ho); const fg = new THREE.ShapeGeometry(sh); fg.rotateX(-PI / 2); fg.translate(0, 0.04, 0); S.satEM = W.glow(CY, 1.6, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); S.satE = new THREE.InstancedMesh(fg, S.satEM, 20); S.satE.frustumCulled = false; S.rig.add(S.satE); } S.pin = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), S.pinM, 30); S.sat.frustumCulled = S.pin.frustumCulled = false; S.rig.add(S.sat, S.pin);
    const rs = mulberry(1818); S.arcP = [0, 1, 2, 3, 4, 5].map(() => new V3()); S.satP = []; for (let i = 0; i < 20; i++) S.satP.push({ r: 3.6 + rs() * 0.8, inc: (rs() - 0.5) * 1.1, a: rs() * TAU, sp: 0.35 + rs() * 0.35, y: (rs() - 0.5) * 0.6 }); S.pinP = []; for (let i = 0; i < 30; i++) S.pinP.push({ r: 4.5 + (i % 3) * 0.4, a: i / 30 * TAU + rs() * 0.1, y: (rs() - 0.5) * 1.2, sp: (i % 2 ? 1 : -1) * (0.25 + rs() * 0.2) });
    // a faint downward cone of data falling from the core to the board
    S.coneU = { uC: { value: new THREE.Color(CY) }, uT: S.TU.uT, uA: { value: 0.16 } };
    { const cg = new THREE.CylinderGeometry(0.4, 2.3, 1, 28, 1, true); cg.translate(0, -0.5, 0); S.cone = new THREE.Mesh(cg, shm(S.coneU, `uniform vec3 uC; uniform float uT,uA; varying vec2 vUv; varying vec3 vW; varying vec3 vN; ${HASH}
      void main(){ vec3 N=normalize(vN+vec3(0.0,1e-5,0.0)); vec3 V=normalize(cameraPosition-vW+vec3(0.0,1e-4,0.0)); float f=pow(clamp(abs(dot(N,V)),0.0,1.0),1.5); float col=floor(vUv.x*48.0);
        float st=step(0.72,h21(vec2(col,3.0)))*pow(clamp(fract(vUv.y*2.0+uT*(0.8+h21(vec2(col,9.0))))*1.0,0.0,1.0),5.0); float a=uA*f*(0.35+0.65*vUv.y+st*2.5)*smoothstep(0.0,0.15,vUv.y); gl_FragColor=vec4(uC*a,1.0); }`,
      { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); S.cone.renderOrder = 4; b.group.add(S.cone); }
    S.light = new THREE.PointLight(CY, 16, 22, 1.7); S.light.position.y = 3; b.group.add(S.light);
    Object.assign(S, { lvl: 0, live: true, bits: [false, true, false, false], C: null, bz: 1, skew: -1, rev: 0, shown: null, shownBits: [], ipos: [-8, 0, 8, 99], exec: null, down: 0, look: 0, lookT: 0, forks: 0, botT: 0, hov: 2.6 });
    layout(b, 0); draw(S);
    return {
      edge: 'wall', spawn: { x: 0, z: 9 }, bossStart: { x: 0, z: -11, face: 0 }, camDist: 17, camPitch: 0.52,
      contains: (x, z) => Math.abs(x) <= H - 0.5 && Math.abs(z) <= H - 0.5,
      clamp(p) { p.x = clamp(p.x, -H + 0.5, H - 0.5); p.z = clamp(p.z, -H + 0.5, H - 0.5); },
      solid(p) { for (const q of S.pyl) { if (!q.ent.group.visible) continue; const dx = p.x - q.ent.pos.x, dz = p.z - q.ent.pos.z, d = Math.hypot(dx, dz); if (d < 1.05 && d > 1e-3) { p.x = q.ent.pos.x + dx / d * 1.05; p.z = q.ent.pos.z + dz / d * 1.05; } } },
      bulletBounds: (x, z) => Math.abs(x) < H + 1 && Math.abs(z) < H + 1,
      camLimit(x, y, z) { return { x: clamp(x, -46, 46), y: Math.max(y, 0.5), z: clamp(z, -46, 46) }; },
    };
  }

  function layout(b, lvl) { // where the bits stand for this phase
    const S = b.state; S.ipos = lvl === 1 ? [-12, -4, 4, 12] : [-8, 0, 8, -15.4];
    S.pyl.forEach((q, i) => { const on = lvl === 1 || i < 3 || lvl === 2, e = q.ent; e.pos.set(S.ipos[i], 0, 14.6); e.group.position.copy(e.pos); e.group.visible = on; e.targetable = on && (lvl === 1 || i < 3); });
  }
  const effBits = (S) => { const bb = S.bits.slice(); if (S.skew >= 0) bb[S.skew] = !bb[S.skew]; return bb; };
  function show(S) { if (S.live && S.C) { S.shown = evalC(S.C, S.bits); S.shownBits = S.bits.slice(); S.rev = 4; } draw(S); }
  function toggle(b, i, auto) {
    const S = b.state, q = S.pyl[i]; S.bits[i] = !S.bits[i]; q.lock = 0.7; q.k = 1; Sound.sfx(auto ? 'interrupt' : 'zap', 0.6, S.bits[i] ? 1.5 : 0.9);
    if (!G.headless) FX.ring(q.ent.pos.x, q.ent.pos.z, { r0: 0.4, r1: 2.4, color: S.bits[i] ? MG : CY, dur: 0.3 });
    show(S);
  }
  function setLvl(b, n) {
    const S = b.state; S.lvl = n; S.live = n === 0; S.lookT = n; S.exec = null; S.down = 0; S.skew = -1; b.autoFace = true;
    if (n < 2) S.bits[3] = n === 1 ? S.bits[3] : false; layout(b, n);
  }
  function* next(b) { // a new circuit, and he drifts over a different output
    const S = b.state; S.bz = pick([0, 1, 2].filter((z) => z !== S.bz)); S.skew = S.lvl === 1 ? Math.min(3, Math.floor(rnd(4))) : -1;
    S.C = makeC(S.lvl, () => rnd(), effBits(S), S.bz); S.rev = 0; S.shown = null; show(S); Sound.sfx('uiok', 0.7, 0.7);
    yield* b.moveTo(ZX[S.bz], -11, 10, { face: false });
  }
  function zap(z) {
    Sound.sfx('thunder', 0.5); if (G.headless) return;
    for (let i = 0; i < 4; i++) { const x = ZX[z] + rnd(-5, 5), zz = rnd(ZN + 1, ZS - 1); FX.lightning(_a.set(x + rnd(-3, 3), 22, zz - 4), _b.set(x, 0, zz), { color: MG, width: 0.22, jag: 1.6 }); FX.burst(x, 0.3, zz, { n: 16, color: MG, color2: 0xffffff, speed: [3, 11], life: [0.25, 0.7] }); }
    FX.flash(MG, 0.14, 3);
  }
  function* execute(b, T) {
    const S = b.state, C = S.C; let bus = false, skewed = S.skew < 0;
    S.exec = { t: T + FLOW, out: null };
    yield* b.cast({ name: 'Execute', time: T, onTick(k, cs) {
      S.exec.t = T - cs.t + FLOW;
      if (!skewed && cs.t >= T * 0.5) { skewed = true; const i = S.skew; S.skew = -1; toggle(b, i, true); }
      if (!bus && cs.t >= T - 2.5) { bus = true; Hz.rect(0, ZS, 0, H - ZS, 2 * H, T - cs.t + FLOW, 450, { name: 'Live Bus', quiet: true, onFire() { FX.shake(0.5); if (!G.headless) for (let i = 0; i < 5; i++) FX.lightning(_a.set(rnd(-H, H), 0.3, rnd(ZS, H)), _b.set(rnd(-H, H), 0.3, rnd(ZS, H)), { color: CY, width: 0.16, jag: 1.2 }); } }); }
    } });
    const E = evalC(C, S.bits); S.exec.out = E.out; S.exec.t = FLOW; S.shown = E; S.shownBits = S.bits.slice(); Sound.sfx('charge', 0.8, 1.7);
    E.out.forEach((v, z) => { if (v) Hz.rect(ZX[z], ZN, 0, ZS - ZN, 12, FLOW, 500, { name: 'Execute', color: MG, quiet: true, onFire() { zap(z); } }); });
    for (let r = 1; r <= 3; r++) { if (!S.live) { S.rev = r; draw(S); } Sound.sfx('tick', 1.6, 0.8 + r * 0.25); const t0 = G.ft; yield FLOW / 3; S.exec.t -= G.ft - t0; }
    S.rev = 4; if (C.latch >= 0) S.bits[3] = !!E.out[C.latch]; draw(S); S.exec = null; yield 0.05;
    if (E.out[S.bz]) yield* shorted(b); else yield 1.0;
  }
  function* shorted(b) {
    const S = b.state; S.down = 6; b.exposed = 6; b.autoFace = false; Sound.sfx('shatter', 0.9, 0.7); Sound.sfx('bigboom', 0.6); FX.shake(0.7); FX.flash(0xffffff, 0.25, 2.5);
    if (!G.headless) FX.explode(b.pos.x, 2.4, b.pos.z, MG, 4);
    b.damage(Math.round(b.maxHp * 0.04), { src: 'player', crit: true });
    yield 6; S.down = 0; b.autoFace = true; yield 0.6;
  }
  // ---- filler between cycles ----
  function* packets(b, waves) {
    yield* b.cast({ name: 'Packets', time: 0.8 });
    for (let w = 0; w < waves; w++) { const lanes = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).slice(0, 5); for (const l of lanes) Bul.fire({ x: -16.5 + l * 3, z: -H + 0.4, dir: 0, speed: 10.5, r: 0.45, dmg: 130, color: CY, life: 3.6 }); Sound.sfx('bolt', 0.5, 1.3); yield 1.0; }
    yield 0.6;
  }
  function* collect(b) {
    yield* b.cast({ name: 'Garbage Collection', time: 0.9 }); const o = shuffle([0, 1, 2]);
    for (let i = 0; i < 2; i++) { Hz.rect(ZX[o[i]], -H, 0, 2 * H, 12, 1.5, 300, { name: 'Garbage Collection' }); yield 0.95; }
    yield 1.0;
  }
  function* ping(b, n) { const p = G.player; for (let i = 0; i < n; i++) { Hz.circle(p.pos.x, p.pos.z, 3.2, 1.0, 240, { name: 'Ping' }); yield 0.8; } }
  function forkMesh(S) { const m = new THREE.Group(); m.add(new THREE.Mesh(S.forkCG, S.forkCM), new THREE.Mesh(S.forkG, S.forkM), new THREE.LineSegments(S.forkEG, S.forkLM)); return m; }
  function fork(b, x, z, gen) {
    const S = b.state; if (S.forks >= 4) return; S.forks++;
    const m = forkMesh(S); m.position.y = 1.5;
    b.spawnAdd({ name: 'Fork', hp: 380, x, z, radius: 0.8, aimY: 1.5, mesh: m, color: AMBER, onDeath() { S.forks--; },
      *run(e) {
        let t = 0; while (e.alive) { yield 2.4; t += 2.4; if (!e.alive) return; const p = G.player; Bul.fire({ x: e.pos.x, z: e.pos.z, dir: angTo(e.pos.x, e.pos.z, p.pos.x, p.pos.z), speed: 8.5, r: 0.4, dmg: 130, color: AMBER, life: 5 });
          if (t >= 7 && gen < 2 && S.forks < 4) { t = -99; Sound.sfx('blink', 0.6, 1.4); fork(b, clamp(e.pos.x + rnd(-5, 5), -16, 16), clamp(e.pos.z + rnd(3, 6), -4, 10), gen + 1); } }
      }, update(e, dt) { m.rotation.y += dt * 2.2; m.position.y = 1.5 + Math.sin(G.now * 3 + x) * 0.2; } });
    Sound.sfx('cast', 0.6, 1.5); if (!G.headless) FX.ring(x, z, { r0: 0.3, r1: 2.5, color: AMBER, dur: 0.35 });
  }

  G.bosses.push({
    id: 'logic', name: 'DAEMON', title: 'The Truth Table', hint: 'True or false', color: '#5ff0e0', telegraph: TEL,
    hp: 34000, radius: 1.7, aimY: 2.6, enrage: 450,
    post: { bloom: 0.5, threshold: 0.86, radius: 0.7, exposure: 1.0, vig: 1.0, sat: 1.05, contrast: 1.06, tint: [0.97, 1.02, 1.0] },
    music: { bpm: 124, root: 38, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 3, 0, 0, 6, 4],
      layers: [
        { v: 'hat', pat: 'x.x.x.x.x.x.x.x.', vol: 0.06 }, { v: 'pulse', pat: '0..0..0.0..0..3.', oct: -1, len: 1, vol: 0.09 }, { v: 'arp', pat: ['0.4.7.4.0.4.7.9.', '0.3.7.3.0.3.7.8.'], oct: 1, len: 1, vol: 0.05 }, { v: 'pad', pat: '0...............', len: 16, vol: 0.07 },
        { v: 'kick', from: 1, pat: 'x...x...x...x...', vol: 0.22 }, { v: 'sub', from: 1, pat: '0.......0.....0.', oct: -2, len: 4, vol: 0.14 }, { v: 'clap', from: 1, pat: '....x.......x...', vol: 0.1 },
        { v: 'bell', from: 2, pat: ['0..7..9...0.7...', '..0...7..9..0..7'], oct: 1, len: 1, vol: 0.06 }, { v: 'snare', from: 2, pat: '....x..x....x.xx', vol: 0.12 }, { v: 'lead', from: 2, pat: ['0.......7...5...', '3.......2.......'], oct: 1, len: 4, vol: 0.06 },
      ] },
    build,
    *intro(b) { Sound.sfx('charge', 0.7, 0.6); yield* Cam.shot([0, 30, 30], [0, 0, 0], [5, 4, -1], [0, 2.8, -11], 5.2, 46); },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setLvl(b, 0); yield 1.0; let first = true, k = 0;
        while (true) { yield* next(b); if (!first) { if (k % 3 === 0) yield* packets(b, 2); else if (k % 3 === 1) { yield* ping(b, 3); yield 0.8; } else yield* collect(b); } else yield 1.5; yield* execute(b, first ? 9 : 6); first = false; k++; }
      } },
      { at: 0.66, skipTo(b) { b.state.look = 1; }, *enter(b) {
        const S = b.state; setLvl(b, 0); S.C = null; S.lookT = 1; draw(S);
        yield* b.cast({ name: 'Overheat', time: 3.0, onTick: (k) => { FX.shake(k * 0.3); } });
        Sound.sfx('bigboom', 0.6); Sound.sfx('roar', 0.5, 1.6); FX.flash(AMBER, 0.35, 1.5); Co.start(Post.lerpTo({ tint: [1.06, 0.99, 0.93], bloom: 0.55 }, 3), 'fight'); yield 1.0;
      }, *run(b) {
        const S = b.state; setLvl(b, 1); let k = 0;
        while (true) {
          yield* next(b);
          if (k % 3 === 0) { fork(b, rnd(-8, 8), rnd(0, 6), 0); yield* packets(b, 2); } else if (k % 3 === 1) { yield* collect(b); yield* ping(b, 2); } else { yield* packets(b, 3); }
          Co.start(function* () { yield 1.2; yield* ping(b, 2); }, 'phase'); yield* execute(b, 6); k++;
        }
      } },
      { at: 0.33, skipTo(b) { b.state.look = 2; }, *enter(b) {
        const S = b.state; setLvl(b, 1); S.C = null; S.lookT = 2; draw(S);
        yield* b.cast({ name: 'Kernel Panic', time: 3.2, onTick: (k) => { FX.shake(k * 0.5); } });
        Sound.sfx('shatter', 1, 0.5); Sound.sfx('bigboom', 0.9); FX.flash(0x80a0ff, 0.45, 1.2); Co.start(Post.lerpTo({ tint: [0.92, 0.98, 1.12], bloom: 0.58, contrast: 1.1, sat: 0.9 }, 3), 'fight'); yield 1.2;
      }, *run(b) {
        const S = b.state; setLvl(b, 2); S.bits[3] = false; let k = 0;
        while (true) {
          yield* next(b);
          if (k % 3 === 0) { yield* packets(b, 2); } else if (k % 3 === 1) { fork(b, rnd(-8, 8), rnd(0, 6), 0); yield* collect(b); } else { yield* ping(b, 3); yield 0.6; }
          Co.start(function* () { yield 0.6; yield* (k % 2 ? packets(b, 2) : ping(b, 3)); }, 'phase'); yield* execute(b, 4.6); k++;
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, t = G.now;
      for (const q of S.pyl) { if (q.lock > 0) q.lock -= dt; q.k = Math.max(0, q.k - dt * 3); }
      if (S.down > 0) S.down -= dt; if (S.botT > 0) S.botT -= dt;
      if (G.headless) return;
      if (S.dirty) paint(S);
      if (G.player) S.ppool.position.set(G.player.pos.x, 0.02, G.player.pos.z); S.ppoolU.uA.value = S.lvl === 1 ? 0.075 : 0.11;
      S.pyl.forEach((q, i) => { const on = S.bits[i], sk = i === S.skew, lat = S.C && i >= S.C.flip; q.lm.emissive.setHex(sk ? AMBER : lat ? 0x9a78ff : MG).multiplyScalar(on ? 1.35 + q.k * 1.5 : sk ? 0.25 + (Math.sin(t * 9) > 0 ? 0.7 : 0) : 0.07 + q.k); });
      const dn = S.down > 0 ? 1 : 0; S.dnK = damp(S.dnK || 0, dn, 5, dt); const ex = S.exec ? sat(1 - S.exec.t / 5) : 0, lv = S.lvl, spd = [1, 1.3, 1.9][lv], live = 1 - S.dnK;
      S.rig.position.y = lerp(S.hov + Math.sin(t * 1.3) * 0.18, 1.3, S.dnK); S.core.rotation.y += dt * (0.6 + ex * 4) * spd * live; S.core.rotation.x += dt * 0.37 * live;
      S.rings.forEach((m, i) => { const sp = (0.7 + i * 0.35 + ex * 3) * spd * live; m.rotation.x += dt * sp * (i % 2 ? 1 : -1); m.rotation.y += dt * sp * 0.6; if (S.dnK > 0.5) { m.rotation.x = damp(m.rotation.x, PI / 2 + i * 0.12, 4, dt); } });
      const hot = lv >= 2 ? 0x8a6cff : lv === 1 ? AMBER : CY, coreC = lv >= 2 ? 0xdfe6ff : lv === 1 ? 0xffe2a0 : CY, xo = S.exec && S.exec.out, c = xo ? MG : hot, cc = xo ? MG : coreC;
      // fade the boss while it hides the player from the camera
      const pl = G.player; let occ = false; if (pl) { const cp = camera.position, sx = pl.pos.x - cp.x, sy = pl.pos.y + 1.2 - cp.y, sz = pl.pos.z - cp.z, l2 = Math.max(sx * sx + sy * sy + sz * sz, 1e-6), bx = b.pos.x - cp.x, by = b.pos.y + S.rig.position.y - cp.y, bz = b.pos.z - cp.z, k = (bx * sx + by * sy + bz * sz) / l2; if (k > 0 && k < 0.95) occ = Math.hypot(bx - sx * k, by - sy * k, bz - sz * k) < 3.3; }
      S.occA = damp(S.occA === undefined ? 1 : S.occA, occ ? 0.3 : 1, 8, dt); const oa = S.occA;
      S.coreM.emissive.setHex(xo ? MG : lv === 1 ? 0xff5a18 : c); S.coreM.emissiveIntensity = (lv === 1 ? 0.32 : 0.2) * (1 + ex * 2.5) * (1 - S.dnK * 0.8); S.coreM.opacity = Math.max(oa * oa, 0.2); S.coreM.color.setHex(lv === 1 ? 0x16120f : 0x0e1a22); S.coreM.roughness = lv === 1 ? 0.62 : 0.38; S.coreM.metalness = lv === 1 ? 0.4 : 0.7;
      const sc2 = xo ? MG : lv === 1 ? 0xff9a28 : cc; S.seamM.color.setHex(sc2).multiplyScalar([1.7, 1.9, 1.35][lv] + ex * 1.5 + Math.sin(t * 5) * 0.15 - S.dnK * 1.1); S.seamM.opacity = 0.35 + oa * 0.65; S.seamLM.color.setHex(sc2).multiplyScalar(([1.6, 1.9, 1.3][lv] + ex - S.dnK) * (0.55 + oa * 0.45));
      S.hotM.color.setHex(xo ? 0xffc0f0 : lv === 1 ? 0xfff0b0 : cc).multiplyScalar(([0.6, 1.6, 0.5][lv] + ex) * (1 - S.dnK * 0.8));
      S.eyeM.color.setHex(lv === 1 && !xo ? 0xffa840 : cc).multiplyScalar((lv === 1 ? 3 : 5) * (1 + ex) * (1 - S.dnK * 0.9)); S.ringM.emissive.setHex(c); S.ringM.emissiveIntensity = 0.15 + ex * 0.5; S.ringM.opacity = oa * oa;
      S.rimGM.color.setHex(c).multiplyScalar((2.4 + ex * 2) * (1 - S.dnK * 0.7)); S.rimGM.opacity = 0.6 + oa * 0.4; S.tickM.color.setHex(c).multiplyScalar(1.6 + ex); S.tickM.opacity = 0.4 + oa * 0.6;
      S.satM.emissive.setHex(c); S.satM.emissiveIntensity = 0.45 + ex * 0.6; S.satM.opacity = oa * oa * 0.9 + 0.04; S.satEM.color.setHex(c).multiplyScalar(1.1 + (1 - oa) * 1.2 + ex); S.pinM.color.setHex(c).multiplyScalar(2.2 + ex * 2); S.pinM.opacity = 0.5 + oa * 0.5;
      const nS = [10, 14, 20][lv], nP = [16, 22, 30][lv]; S.sat.count = S.satE.count = nS; S.pin.count = nP; const fall = S.dnK; S.satT = (S.satT || 0) + dt * spd * (1 + ex * 2) * live; S.pinT = (S.pinT || 0) + dt * spd * live;
      for (let i = 0; i < nS; i++) { const q = S.satP[i], a = q.a + S.satT * q.sp; _a.set(Math.cos(a) * q.r, q.y, Math.sin(a) * q.r).applyAxisAngle(_b.set(1, 0, 0), q.inc); _a.y = lerp(_a.y, -S.rig.position.y + 0.2, fall); _e.set(0, -a, q.inc); _q.setFromEuler(_e); _m.compose(_a, _q, _s.set(1, 1, 1)); S.sat.setMatrixAt(i, _m); S.satE.setMatrixAt(i, _m); if (i < 6) S.arcP[i].copy(_a); }
      for (let i = 0; i < nP; i++) { const q = S.pinP[i], a = q.a + S.pinT * q.sp; _a.set(Math.cos(a) * q.r, q.y + Math.sin(a * 2 + i) * 0.4, Math.sin(a) * q.r); _a.y = lerp(_a.y, -S.rig.position.y + 0.1, fall); _q.setFromAxisAngle(_b.set(0, 1, 0), a * 3); _m.compose(_a, _q, _s.set(1, 1, 1)); S.pin.setMatrixAt(i, _m); }
      S.sat.instanceMatrix.needsUpdate = S.pin.instanceMatrix.needsUpdate = S.satE.instanceMatrix.needsUpdate = true;
      if (lv >= 2 && live > 0.5 && Math.random() < dt * 2.2) { const p = S.arcP[Math.floor(Math.random() * S.arcP.length)]; if (p) FX.lightning(S.rig.localToWorld(_a.set(0, 0, 0)), S.rig.localToWorld(_b.copy(p)), { color: 0xa890ff, width: 0.06, jag: 0.5 }); }
      S.cone.position.y = S.rig.position.y; S.cone.scale.y = Math.max(0.1, S.rig.position.y - 0.05); S.coneU.uC.value.setHex(cc); S.coneU.uA.value = (0.14 + ex * 0.12) * live * oa;
      S.light.color.setHex(c); S.light.intensity = (16 + ex * 22 + (lv >= 2 ? 8 : 0)) * (1 - S.dnK * 0.7); S.light.distance = lv >= 2 ? 30 : 22;
      if (S.dnK > 0.5 && Math.random() < dt * 9) FX.burst(b.pos.x + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 1.5, b.pos.z + (Math.random() - 0.5) * 3, { n: 3, color: MG, speed: [1, 5], life: [0.2, 0.5] });
      S.look = damp(S.look, S.lookT, 0.6, dt); const k1 = sat(S.look), k2 = sat(S.look - 1), Uu = S.sky.material.uniforms;
      Uu.uHor.value.setHex(0x0a3a34).lerp(_c.setHex(0x2a0a10), k1).lerp(_c.setHex(0x2a1670), k2); Uu.uNebA.value.setHex(0x0a5a50).lerp(_c.setHex(0x40101c), k1).lerp(_c.setHex(0x2040c0), k2); Uu.uNebB.value.setHex(0x402a70).lerp(_c.setHex(0x302040), k1).lerp(_c.setHex(0x7030b0), k2);
      S.sun.color.setHex(0xcfeee8).lerp(_c.setHex(0xd8dce8), k1).lerp(_c.setHex(0xb8c4ff), k2);
      const TU = S.TU; TU.uT.value = t; TU.uK1.value = k1; TU.uK2.value = k2; TU.uC.value.setHex(CY).lerp(_c.setHex(0xe0203a), k1).lerp(_c.setHex(0x7a5cff), k2);
      scene.fog.color.setHex(0x03100e).lerp(_c.setHex(0x0a0408), k1).lerp(_c.setHex(0x080620), k2);
      S.rim.color.setHex(0x9ad0ff).lerp(_c.setHex(0xa8c0ff), k1).lerp(_c.setHex(0xb0a0ff), k2); S.hemi.color.setHex(0x9fd8d0).lerp(_c.setHex(0xa8b4c4), k1).lerp(_c.setHex(0xa8c8d0), k2); const strobe = k2 * Math.pow(Math.max(0, Math.sin(t * 5.5)), 4); S.chamM.color.copy(TU.uC.value).multiplyScalar(0.9 + strobe * 2.2); S.edgeLM.color.copy(TU.uC.value).multiplyScalar(0.7 + strobe * 1.6);
      S.bandM.color.copy(TU.uC.value).multiplyScalar(1.3 + k2 * (Math.sin(t * 11) > 0.2 ? 1.2 : 0));
      S.motes.material.uniforms.uCol.value.setHex(0x60ffe0).lerp(_c.setHex(0xff4050), k1).lerp(_c.setHex(0xa0a0ff), k2);
      for (const u of S.sparks) { u.uCol.value.setHex(0xff6a30).lerp(_c.setHex(0xd0c8ff), k2).multiplyScalar(1.6); u.uAlpha.value = k1 * 0.95 + k2 * 0.7; }
      for (let z = 0; z < 3; z++) { const u = S.zoneU[z].uOn, lit = S.C && S.rev >= 4 && S.shown && S.shown.out[z] ? 1 : 0; u.value = damp(u.value, lit, 10, dt); }
      const beat = Math.pow(Math.max(0, Math.sin(t * (S.exec ? 9 : 3.2))), 6); S.oscU.uC.value.setHex(lv >= 2 ? 0x80a8ff : lv === 1 ? 0xff4050 : CY).multiplyScalar(0.35 + beat * 1.1);
      if (k2 > 0.5 && S.tops.length > 1 && Math.random() < dt * 2.6) { camera.getWorldDirection(_b); let A = null; for (let n = 0; n < 6 && !A; n++) { const q = S.tops[Math.floor(Math.random() * S.tops.length)]; if (_a.copy(q).sub(camera.position).normalize().dot(_b) > 0.6) A = q; } if (!A) A = S.tops[0]; let best = null, bd = 1e9; for (const B of S.tops) { const d = A.distanceTo(B); if (B !== A && d < bd) { bd = d; best = B; } } if (best && bd < 45) { const o = { color: 0xe8e0ff, width: 0.1, jag: 1.6, dur: 0.16, mult: 1.6 }; FX.lightning(A, best, o); FX.lightning(A, best, o); FX.lightning(A, best, { color: 0x8a60ff, width: 0.32, jag: 1.0, dur: 0.16, mult: 0.7, sparks: false }); for (const P of [A, best]) FX.burst(P.x, P.y, P.z, { n: 14, color: 0xd8c8ff, speed: [2, 9], life: [0.2, 0.5], size: [0.35, 0.9] }); FX.lightning(A, _a.copy(A).lerp(best, 0.5).add(_b.set((Math.random() - 0.5) * 12, -2 - Math.random() * 5, (Math.random() - 0.5) * 12)), { color: 0xc8b8ff, width: 0.05, jag: 1.0, dur: 0.12, mult: 1.2, sparks: false }); } }
      if (k2 > 0.5 && S.nearTops.length && Math.random() < dt * 1.3) { camera.getWorldDirection(_b); const q = S.nearTops[Math.floor(Math.random() * S.nearTops.length)]; if (_a.copy(q).sub(camera.position).normalize().dot(_b) > 0.45) { const ax = Math.abs(q.x) > Math.abs(q.z); _a.set(ax ? Math.sign(q.x) * 19.1 : clamp(q.x, -19, 19), 0.35, ax ? clamp(q.z, -19, 19) : Math.sign(q.z) * 19.1); FX.lightning(q, _a, { color: 0xe8e0ff, width: 0.06, jag: 1.0, dur: 0.14, mult: 1.6 }); FX.lightning(q, _a, { color: 0x8a60ff, width: 0.2, jag: 0.6, dur: 0.14, mult: 0.6, sparks: false }); FX.burst(q.x, q.y, q.z, { n: 10, color: 0xd8c8ff, speed: [2, 7], life: [0.2, 0.45], size: [0.3, 0.7] }); } }
      S.holoU.uA.value = 0.52 + Math.sin(t * 2.1) * 0.04 - (lv >= 2 && Math.sin(t * 31) > 0.93 ? 0.25 : 0); S.holoU.uG.value = k2; S.floorM.emissiveIntensity = 0.75 + (xo ? 0.35 : 0) + k2 * 0.05 * Math.sin(t * 2.6);
    },
    danger(b, x, z) {
      const S = b.state; if (!S.exec || !S.C) return Infinity; const zn = zoneOf(x, z), t = Math.max(0.05, S.exec.t);
      if (zn < 0) return t; const o = S.exec.out || evalC(S.C, effBits(S)).out; return o[zn] ? t : Infinity;
    },
    bot(b, p) {
      const S = b.state, out = {}; if (!S.C || S.down > 0) return out;
      const eb = effBits(S), sampled = S.exec && S.exec.out, now = sampled || evalC(S.C, eb).out, sol = sampled ? null : solveC(S.C, eb, S.bz), melee = p.cls.melee;
      // where is the nearest output that will stay dark?
      let safe = null, sd = Infinity; now.forEach((v, zn) => { if (v) return; const x = clamp(p.pos.x, ZX[zn] - 4.5, ZX[zn] + 4.5), z = clamp(p.pos.z, ZN + 1.5, ZS - 2), d = Math.hypot(x - p.pos.x, z - p.pos.z); if (d < sd) { sd = d; safe = { x, z }; } });
      const left = S.exec ? S.exec.t : 99, must = safe && left < sd / 7 + 1.3;
      if (sol && sol.flips.length && !(must && now.some((v) => !v) && left < 2.2)) {
        const i = sol.flips[0], e = S.pyl[i].ent, d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
        if (d <= (melee ? 3.4 : 26)) { if (S.pyl[i].lock <= 0 && S.botT <= 0) { toggle(b, i); S.botT = 0.9; } }
        else { out.x = e.pos.x; out.z = e.pos.z - 2; out.w = 2.5; }
        if (melee || d > 26) return out;
      }
      if (safe && (must || (S.exec && zoneOf(p.pos.x, p.pos.z) < 0 && left < 3.2))) { out.x = safe.x; out.z = safe.z; out.w = 5; }
      return out;
    },
  });
})();
