// DOOR VII: THE IMPRESARIO, the Paper Theatre. You have an understudy. It goes where you go, on the other side of the stage.
(() => {
  const HX = 15, HZ = 9, LIME = 0xfff2c8, ROSE = 0xff3d6e, VIO = 0xc86bff, MID = 1.6, PIT = 2.3;
  const _a = new V3(), _b2 = new V3(), _m = new THREE.Object3D(), _w = new V3(), _w2 = new V3(), _c = new THREE.Color(), _c2 = new THREE.Color(), _Y = new V3(0, 1, 0);
  const ROWZ = [-6, 0, 6];

  // ---- the understudies ----
  const dolls = (S) => S.dolls.filter((d) => d.on);
  const mir = (d, x, z, out) => { if (d.mode === 'x') { out.x = -x; out.z = z; } else { out.x = x; out.z = -z; } return out; };
  const dpos = (d, out) => mir(d, G.player.pos.x, G.player.pos.z, out);
  function dollHurt(b, d, dmg, o = {}) {
    const p = G.player, q = dpos(d, _a); q.y = 1.2;
    FX.impact(q.x, 1.2, q.z, ROSE, 0.9); if (!G.headless) FX.beam(new V3(q.x, 1.3, q.z), p.aim(new V3()), { color: ROSE, width: 0.12, dur: 0.35 });
    b.state.twang = 1; p.hurt(dmg, { blockable: o.blockable !== false, dot: o.dot, src: { name: 'Understudy' } });
  }

  // ---- paper art ----
  function ptex(draw, cw = 512, ch = 256) { const c = document.createElement('canvas'); c.width = cw; c.height = ch; draw(c.getContext('2d'), cw, ch); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  function paper(w, h, draw, o = {}) {
    const t = draw.isTexture ? draw : ptex(draw, o.cw, o.ch);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, transparent: false, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: o.em === undefined ? 0.12 : o.em }));
  }
  const grain = (x, w, h, a = 0.07) => { const r = mulberry(w + h); x.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 200},${a * r()})`; x.fillRect(r() * w, r() * h, 2 + r() * 14, 1 + r() * 2); } x.globalCompositeOperation = 'source-over'; };
  const ART = {
    hills: (c1, c2) => (x, w, h) => { x.fillStyle = c1; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 40; i++) x.lineTo(i / 40 * w, h * (0.45 - 0.22 * Math.sin(i * 0.37) - 0.12 * Math.sin(i * 0.93 + 1))); x.lineTo(w, h); x.fill(); x.strokeStyle = c2; x.lineWidth = 6; x.stroke(); grain(x, w, h); },
    waves: (c1, c2) => (x, w, h) => { x.fillStyle = c1; x.beginPath(); x.moveTo(0, h); x.lineTo(0, h * 0.5); for (let i = 0; i < 12; i++) { const x0 = i / 12 * w, x1 = (i + 1) / 12 * w; x.quadraticCurveTo((x0 + x1) / 2, h * 0.05, x1, h * 0.5); } x.lineTo(w, h); x.fill(); x.strokeStyle = c2; x.lineWidth = 7; for (let i = 0; i < 12; i++) { x.beginPath(); x.arc((i + 0.5) / 12 * w, h * 0.62, w / 30, PI, TAU); x.stroke(); } grain(x, w, h); },
    trees: (c1, c2) => (x, w, h) => { for (let i = 0; i < 7; i++) { const cx = (i + 0.5) / 7 * w, th = h * (0.7 + 0.28 * Math.sin(i * 2.1)); x.fillStyle = c2; x.fillRect(cx - 6, h - th * 0.3, 12, th * 0.3); x.fillStyle = c1; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(cx, h - th + k * th * 0.2); x.lineTo(cx - w / 18 - k * 6, h - th * 0.28 + (k - 2) * th * 0.16); x.lineTo(cx + w / 18 + k * 6, h - th * 0.28 + (k - 2) * th * 0.16); x.fill(); } } grain(x, w, h); },
    town: (c1, c2, burnt) => (x, w, h) => { const r = mulberry(5); for (let i = 0; i < 9; i++) { const x0 = i / 9 * w, bh = h * (0.45 + r() * 0.5); x.fillStyle = c1; x.fillRect(x0 + 2, h - bh, w / 9 - 4, bh); x.beginPath(); x.moveTo(x0, h - bh); x.lineTo(x0 + w / 18, h - bh - h * 0.14); x.lineTo(x0 + w / 9, h - bh); x.fill(); x.fillStyle = c2; for (let k = 0; k < 3; k++) if (r() < 0.7) { x.fillRect(x0 + w / 30, h - bh + 12 + k * 30, 14, 18); if (burnt) { x.fillStyle = 'rgba(255,120,30,0.5)'; x.fillRect(x0 + w / 30 - 4, h - bh + 6 + k * 30, 22, 10); x.fillStyle = c2; } } }
      if (burnt) { x.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(10,4,4,${0.35 + r() * 0.4})`; x.beginPath(); x.ellipse(r() * w, h * (0.1 + r() * 0.5), 6 + r() * 26, 4 + r() * 14, r() * 3, 0, TAU); x.fill(); } x.globalCompositeOperation = 'source-over';
        x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 9; i++) { const cx = r() * w; x.beginPath(); x.moveTo(cx - 10, 0); for (let k = 0; k < 6; k++) x.lineTo(cx + (r() - 0.5) * 40, h * (0.15 + k * 0.07)); x.lineTo(cx + 12, 0); x.fill(); } x.globalCompositeOperation = 'source-over'; }
      grain(x, w, h); },
    sky: (sun) => (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); if (sun) { g.addColorStop(0, '#2a0630'); g.addColorStop(0.45, '#8a1450'); g.addColorStop(0.8, '#e0384a'); g.addColorStop(1, '#ff8a3a'); } else { g.addColorStop(0, '#0b1030'); g.addColorStop(0.6, '#2a2a6a'); g.addColorStop(1, '#7a3a6a'); } x.fillStyle = g; x.fillRect(0, 0, w, h);
      const r = mulberry(8); x.fillStyle = sun ? '#ffd0c0' : '#fff6d8'; for (let i = 0; i < (sun ? 30 : 90); i++) { const s = 1 + r() * 3; x.save(); x.translate(r() * w, r() * h * (sun ? 0.35 : 0.7)); x.rotate(0.78); x.fillRect(-s, -s, s * 2, s * 2); x.restore(); }
      if (sun) { x.strokeStyle = 'rgba(255,200,150,0.25)'; x.lineWidth = 3; for (let i = 0; i < 7; i++) { x.beginPath(); const y = h * (0.55 + i * 0.06); x.moveTo(0, y); for (let k = 0; k <= 16; k++) x.lineTo(k / 16 * w, y + Math.sin(k * 1.3 + i) * 4); x.stroke(); } }
      grain(x, w, h, 0.05); },
    sun: () => (x, w, h) => { const cx = w / 2, cy = h / 2, R = w * 0.3; x.fillStyle = '#ff9a2a'; x.beginPath(); for (let i = 0; i < 32; i++) { const a = i / 32 * TAU, rr = i % 2 ? R * 1.06 : R * 1.55; x.lineTo(cx + Math.sin(a) * rr, cy + Math.cos(a) * rr); } x.fill(); x.fillStyle = '#ffd04a'; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill(); x.strokeStyle = '#c0501a'; x.lineWidth = 5; x.beginPath(); x.arc(cx, cy, R * 0.86, 0, TAU); x.stroke();
      x.fillStyle = '#c0501a'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * R * 0.32, cy - R * 0.12, R * 0.09, R * 0.05, 0, 0, TAU); x.fill(); } x.lineWidth = 6; x.beginPath(); x.arc(cx, cy + R * 0.05, R * 0.4, 0.3, PI - 0.3); x.stroke(); grain(x, w, h); },
    cloud: (c1, c2) => (x, w, h) => { const r = mulberry(w * 3 + h); x.fillStyle = c1; x.beginPath(); x.moveTo(0, h * 0.85); for (let i = 0; i <= 7; i++) { const cx = (i + 0.5) / 8 * w; x.arc(cx, h * (0.55 - 0.25 * Math.sin(i * 1.7 + 0.5) * r()), h * (0.22 + r() * 0.2), PI, TAU); } x.lineTo(w, h * 0.85); x.closePath(); x.fill(); x.fillRect(w * 0.04, h * 0.5, w * 0.92, h * 0.35); x.strokeStyle = c2; x.lineWidth = 5; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc((i + 0.8) / 6 * w, h * 0.62, h * 0.12, PI * 1.1, TAU * 0.95); x.stroke(); }
      x.fillStyle = '#ffd04a'; x.beginPath(); const lx = w * 0.62; x.moveTo(lx, h * 0.8); x.lineTo(lx - 18, h * 0.93); x.lineTo(lx - 4, h * 0.93); x.lineTo(lx - 20, h); x.lineTo(lx + 14, h * 0.88); x.lineTo(lx, h * 0.88); x.lineTo(lx + 10, h * 0.8); x.fill(); grain(x, w, h); },
  };
  // the Impresario's painted face, wrapped on a sphere (front at u = 0.5)
  const FACE = (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f6efe2'); g.addColorStop(0.7, '#ece2d0'); g.addColorStop(1, '#bfb2a0'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const cx = w / 2; x.lineCap = 'round';
    for (const s of [-1, 1]) {
      const rg = x.createRadialGradient(cx + s * 50, 140, 2, cx + s * 50, 140, 22); rg.addColorStop(0, 'rgba(225,50,80,0.75)'); rg.addColorStop(1, 'rgba(225,50,80,0)'); x.fillStyle = rg; x.fillRect(cx + s * 50 - 24, 116, 48, 48);
      x.save(); x.translate(cx + s * 31, 115); x.rotate(s * 0.22); x.shadowColor = 'rgba(20,0,20,0.8)'; x.shadowBlur = 6; x.fillStyle = '#120812'; x.beginPath(); x.ellipse(0, 0, 21, 13, 0, 0, TAU); x.fill(); x.restore();
      x.strokeStyle = '#140a10'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx + s * 12, 98); x.quadraticCurveTo(cx + s * 30, 80, cx + s * 54, 96); x.stroke();
      x.strokeStyle = '#120a0c'; x.lineWidth = 9; x.beginPath(); x.moveTo(cx + s * 3, 140); x.bezierCurveTo(cx + s * 22, 134, cx + s * 44, 150, cx + s * 58, 136); x.stroke();
      x.lineWidth = 6; x.beginPath(); x.arc(cx + s * 58, 129, 7, s > 0 ? PI * 0.5 : PI * 0.5, s > 0 ? PI * 2.1 : -PI * 1.1, s < 0); x.stroke();
    }
    x.fillStyle = '#1a0a14'; x.beginPath(); x.moveTo(cx - 31, 132); x.lineTo(cx - 26, 141); x.lineTo(cx - 31, 152); x.lineTo(cx - 36, 141); x.fill();
    x.fillStyle = '#b00e2a'; x.beginPath(); x.moveTo(cx - 40, 152); x.quadraticCurveTo(cx, 182, cx + 40, 152); x.quadraticCurveTo(cx, 166, cx - 40, 152); x.fill(); x.strokeStyle = '#5a0612'; x.lineWidth = 2; x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(cx + 70 + i * 9, 60 + i * 13); x.lineTo(cx + 84 + i * 7, 70 + i * 15); x.stroke(); }
  };
  // shaders: soft floor pool of light, volumetric beam with dust, cut-out paper flame
  const POOLV = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
  const POOLF = 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float r=clamp(length(vUv-0.5)*2.0,0.0,1.0); float q=1.0-r*r; float a=q*q*0.85*max(uA,0.0); a+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5)*0.006; a=max(a,0.0); gl_FragColor=vec4(uC*a,a); }';
  const poolMat = (c, a = 0) => new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(c) }, uA: { value: a } }, vertexShader: POOLV, fragmentShader: POOLF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const CONEV = 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }';
  const CONEF = 'uniform vec3 uC; uniform float uA,uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV; float h1(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }\nvoid main(){ vec3 n=vN/max(length(vN),1e-4); vec3 v=vV/max(length(vV),1e-4); float f=clamp(abs(dot(n,v)),0.0,1.0); float y=clamp(vUv.y,0.0,1.0); float a=(0.05+0.3*y)*(0.2+0.8*f*f)*uA*smoothstep(0.0,0.4,y);\n vec2 g=vec2(vUv.x*56.0,vUv.y*40.0+uT*0.5+sin(vUv.x*20.0+uT)*0.3); float s=h1(floor(g)); float d=step(0.93,s)*(1.0-smoothstep(0.05,0.3,length(fract(g)-0.5))); a+=d*0.3*uA*f; a*=smoothstep(6.0,13.0,length(vV)); a=max(a,0.0); gl_FragColor=vec4(uC*a,a); }';
  const coneMat = (c) => new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(c) }, uA: { value: 0 }, uT: { value: 0 } }, vertexShader: CONEV, fragmentShader: CONEF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const FIREF = 'uniform float uT,uA,uD; varying vec2 vUv; float h1(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); } float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h1(i),h1(i+vec2(1.0,0.0)),f.x),mix(h1(i+vec2(0.0,1.0)),h1(i+vec2(1.0,1.0)),f.x),f.y); }\n float tg(float x,float y,float s,float sp,float hg){ float t=floor(uT*sp)+s; float n=n2(vec2(x*2.4+s,t*0.37)); float w=0.5+0.5*sin(x*11.0+s*3.0+n*4.0); w=w*w; return hg*(0.25+0.75*w)*(0.7+0.5*n)*(1.0-abs(x)*0.8)-y; }\nvoid main(){ float x=(vUv.x-0.5)*2.0; float y=clamp(vUv.y,0.0,1.0)*1.2-0.2; vec3 c=vec3(0.0); float a=0.0;\n float fr=tg(x,y,1.0,7.0,0.95), fm=tg(x,y,4.0,9.0,0.68), fc=tg(x,y,7.0,12.0,0.4);\n if(fr>0.0){ c=vec3(0.62,0.06,0.03); a=1.0; } if(fm>0.0 && y>0.05) c=vec3(1.0,0.4,0.07); if(fc>0.0 && y>0.15) c=vec3(1.0,0.85,0.35);\n float cb=-0.06-0.11*n2(vec2(x*6.0,2.0)); if(y<0.0){ if(y>cb){ c=vec3(0.03,0.015,0.015); a=0.95*(1.0-smoothstep(0.85,1.0,abs(x))); if(y<cb+0.012) c=vec3(0.7,0.2,0.03); } else a=0.0; }\n vec2 g=vec2(x*9.0,y*7.0-uT*2.2); vec2 id=floor(g); vec2 fq=abs(fract(g)-0.5); if(a<0.5 && y>0.25 && h1(id)>0.93 && max(fq.x,fq.y)<0.13){ c=vec3(1.0,0.55,0.12); a=1.0-smoothstep(0.6,1.0,y); }\n a=clamp(a*uA,0.0,1.0); if(a<0.02) discard; c=mix(c,vec3(0.7,0.13,0.03),clamp(uD,0.0,1.0)*0.85); gl_FragColor=vec4(c*1.2,a); }';

  // stage geometry helpers
  const tubeOf = (pts, r, seg = 48, rad = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg, r, rad, false);
  const ring = (r, y, p0, p1, sz = 1, n = 24) => { const pts = []; for (let i = 0; i <= n; i++) { const ph = lerp(p0, p1, i / n); pts.push(new V3(r * Math.sin(ph), y, r * Math.cos(ph) * sz)); } return pts; };
  function rimify(mat, S, lining) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = S.rimU; sh.uniforms.uLin = S.linU;
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim; uniform vec3 uLin;\nvoid main() {')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (lining ? 'if (!gl_FrontFacing) diffuseColor.rgb = uLin;' : ''))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); totalEmissiveRadiance += uRim * pow(max(fr, 0.0), 3.6) * (gl_FrontFacing ? 1.0 : 0.2); ' + (lining ? 'if (!gl_FrontFacing) totalEmissiveRadiance += uLin * 0.12;' : '') + ' }');
    };
    mat.customProgramCacheKey = () => 'theatreRim' + (lining ? 1 : 0); return mat;
  }
  function dissolve(mat, U) {
    mat.onBeforeCompile = (sh) => { sh.uniforms.uCut = U;
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec2 vDis;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDis = transformed.xy;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uCut; varying vec2 vDis;\nvoid main() {\nif (vDis.y < uCut + 0.45 * sin(vDis.x * 2.1) + 0.25 * sin(vDis.x * 5.3 + 1.0)) discard;'); };
    mat.customProgramCacheKey = () => 'theatreDis'; return mat;
  }
  const velvetM = (color, o = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xff6a50), sheenRoughness: 0.42, side: THREE.DoubleSide, envMapIntensity: 0.45 }, o));

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x0a0406, horizon: 0x341a14, bottom: 0x050203, sunGlow: 0, sunSize: 0 }); g.add(sky); W.env(sky, 0.5);
    scene.fog = new THREE.FogExp2(0x0a0406, 0.009); S.fogC = scene.fog.color;
    S.hemi = W.hemi(g, 0x9a7a6a, 0x2a1810, 0.85);
    S.key = W.sun(g, { dir: [0.18, 0.85, 0.55], color: 0xffe2b8, intensity: 3.0, size: 24 });
    S.foot = new THREE.PointLight(0xffb060, 150, 46, 1.6); S.foot.position.set(0, 6, 11.2); g.add(S.foot);
    S.back = new THREE.PointLight(0x7090ff, 120, 50, 1.6); S.back.position.set(7, 9, -9.5); g.add(S.back);
    // stage floor in three pieces so the middle can drop away; painted border, tape marks and the trapdoor on a decal
    const wd = W.surface('wood', { n: 8, dark: 0x45240f, light: 0xb88048, strength: 1.45, seed: 4 });
    const DW = 33, DD = HZ * 2 + 1.6, decT = ptex((x, w, h) => {
      const X = (v) => (v + 16.5) / DW * w, Z = (v) => (v + 9.4) / DD * h, U = w / DW, r = mulberry(17);
      const eg = (x0, y0, x1, y1) => { const q = x.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, 'rgba(12,4,2,0.75)'); q.addColorStop(1, 'rgba(12,4,2,0)'); return q; };
      x.fillStyle = eg(0, 0, 0, U * 1.4); x.fillRect(0, 0, w, U * 1.4); x.fillStyle = eg(0, 0, U * 1.6, 0); x.fillRect(0, 0, U * 1.6, h); x.fillStyle = eg(w, 0, w - U * 1.6, 0); x.fillRect(w - U * 1.6, 0, U * 1.6, h); x.fillStyle = eg(0, h, 0, h - U * 0.8); x.fillRect(0, h - U * 0.8, w, U * 0.8);
      x.strokeStyle = 'rgba(210,160,90,0.22)'; x.lineWidth = 3; x.strokeRect(U * 1.1, U * 1.0, w - U * 2.2, h - U * 1.6);
      x.strokeStyle = 'rgba(12,6,4,0.75)'; x.lineWidth = 4; x.strokeRect(X(-2.0), Z(-2.0), U * 4, U * 4); x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(X(0), Z(-2)); x.lineTo(X(0), Z(2)); x.stroke();
      x.fillStyle = 'rgba(40,30,24,0.8)'; for (const zz of [-1.3, 1.0]) x.fillRect(X(-2.15), Z(zz), U * 0.45, U * 0.3); x.strokeStyle = 'rgba(30,22,16,0.8)'; x.lineWidth = 3; x.beginPath(); x.arc(X(1.4), Z(0), U * 0.22, 0, TAU); x.stroke();
      const tape = (cx, cz, kind, col) => { x.save(); x.translate(X(cx), Z(cz)); x.rotate((r() - 0.5) * 0.4); x.fillStyle = col; const L = U * 0.55, T = U * 0.11; if (kind === 'x') { x.rotate(0.785); x.fillRect(-L, -T / 2, L * 2, T); x.fillRect(-T / 2, -L, T, L * 2); } else { x.fillRect(-L, -T / 2, L * 2, T); x.fillRect(-T / 2, 0, T, L * 1.2); } x.restore(); };
      for (const [cx, cz, k, c] of [[-11, -5, 'x', 'rgba(255,210,80,0.55)'], [10.5, 5.5, 'x', 'rgba(255,210,80,0.5)'], [-6, 6.2, 't', 'rgba(240,235,220,0.45)'], [6.5, -6.4, 't', 'rgba(240,235,220,0.45)'], [12.5, -2, 'x', 'rgba(120,200,255,0.4)'], [-13, 2.5, 't', 'rgba(255,210,80,0.45)'], [0, 8.6, 't', 'rgba(240,235,220,0.5)']]) tape(cx, cz, k, c);
      x.fillStyle = 'rgba(235,230,220,0.05)'; for (let i = 0; i < 60; i++) { x.save(); x.translate(r() * w, r() * h); x.rotate((r() - 0.5) * 0.3); x.fillRect(0, 0, 10 + r() * 50, 1 + r() * 2); x.restore(); }
    }, 1024, 608);
    const decM = new THREE.MeshStandardMaterial({ map: decT, transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    S.floorM = [];
    const plank = (w, x) => { const t = {}; for (const k in wd) { t[k] = wd[k].clone(); t[k].repeat.set(w / 7, 2.6); t[k].offset.x = (x + 15) / 7; t[k].needsUpdate = true; }
      const fm = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 0.66, metalness: 0.03, envMapIntensity: 0.9 }); S.floorM.push(fm);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, DD), [0, 1, 2, 3, 4, 5].map((i) => i === 2 ? fm : W.mat({ color: 0x120a06, roughness: 0.9 }))); m.position.set(x, -0.6, 0.4); m.receiveShadow = true; g.add(m);
      const dg = new THREE.PlaneGeometry(w, DD), UV = dg.attributes.uv, P = dg.attributes.position; for (let i = 0; i < UV.count; i++) UV.setX(i, (P.getX(i) + x + 16.5) / DW);
      const dm = new THREE.Mesh(dg, decM); dm.rotation.x = -PI / 2; dm.position.y = 0.602; dm.receiveShadow = true; dm.renderOrder = 1; m.add(dm); return m; };
    plank(HX + 1.5 - PIT, -(HX + 1.5 + PIT) / 2); plank(HX + 1.5 - PIT, (HX + 1.5 + PIT) / 2); S.centre = plank(PIT * 2, 0);
    for (const k in wd) wd[k].dispose();
    const pitGlow = new THREE.Mesh(new THREE.PlaneGeometry(PIT * 2, DD), W.glow(0x3a0806, 1)); pitGlow.rotation.x = -PI / 2; pitGlow.position.set(0, -7, 0.4); g.add(pitGlow);
    S.pitWaves = []; for (let i = 0; i < 4; i++) { const w = paper(HZ * 2 + 2, 2.6, ART.waves('#2a080c', '#6a2a28'), { em: 0.04 }); w.rotation.y = PI / 2; w.position.set(-1.5 + i, -4.2 - i * 0.2, 0.4); g.add(w); S.pitWaves.push(w); }
    const front = new THREE.Mesh(new THREE.BoxGeometry(36, 4, 0.6), W.mat({ color: 0x2a0a10, roughness: 0.7 })); front.position.set(0, -2, HZ + 1.5); g.add(front);
    const goldM = W.mat({ color: 0xb08a44, roughness: 0.42, metalness: 1, envMapIntensity: 1.0 }), brass = W.mat({ color: 0x8a6a34, roughness: 0.38, metalness: 1, envMapIntensity: 1.2 });
    S.fascia = new THREE.Group(); S.fascia.visible = false; g.add(S.fascia);
    { const fT = ptex((x, w, h) => { x.fillStyle = '#16070a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { const x0 = i / 8 * w + 8, ww = w / 8 - 16; x.strokeStyle = 'rgba(150,90,50,0.55)'; x.lineWidth = 4; x.strokeRect(x0, 26, ww, h - 52); x.strokeStyle = 'rgba(0,0,0,0.7)'; x.lineWidth = 3; x.strokeRect(x0 + 6, 32, ww - 12, h - 64); } x.fillStyle = '#c9a050'; x.fillRect(0, 0, w, 10); x.fillStyle = '#5a3a18'; x.fillRect(0, 10, w, 4); }, 1024, 256);
      const fM = new THREE.MeshStandardMaterial({ map: fT, roughness: 0.5, metalness: 0.1, envMapIntensity: 0.4 });
      for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(DD, 5), fM); f.rotation.y = -sx * PI / 2; f.position.set(sx * (PIT - 0.01), -2.5, 0.4); S.fascia.add(f); const lip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, DD), goldM); lip.position.set(sx * (PIT - 0.05), -0.02, 0.4); S.fascia.add(lip); } }
    const trimF = new THREE.Mesh(new THREE.BoxGeometry(36, 0.25, 0.75), goldM); trimF.position.set(0, 0.02, HZ + 1.5); g.add(trimF);
    // footlights: brass shells with a hot lens strip
    S.footGlow = new THREE.ShaderMaterial({ uniforms: { uA: { value: 1 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }', fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float v=clamp(vUv.x,0.0,1.0); float g=0.5+0.5*sin(v*6.2832); vec3 c=mix(vec3(0.22,0.07,0.01),vec3(0.62,0.28,0.06),g); float fil=1.0-smoothstep(0.0,0.05,abs(fract(v+0.25)-0.5)); c+=vec3(0.9,0.6,0.25)*fil*0.45; float e=smoothstep(0.0,0.08,vUv.y)*smoothstep(1.0,0.92,vUv.y); gl_FragColor=vec4(c*(0.35+0.65*e)*max(uA,0.0),1.0); }' });
    { const NF = 15, sh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 1.0, 14, 1, true, -2.1, PI).rotateZ(PI / 2), W.mat({ color: 0x8a6a34, roughness: 0.6, metalness: 0.9, envMapIntensity: 0.8, side: THREE.DoubleSide }), NF), ln = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.84, 16).rotateZ(PI / 2), S.footGlow, NF);
      for (let i = 0; i < NF; i++) { const x = -14 + i * 2; _m.position.set(x, 0.12, HZ + 1.45); _m.rotation.set(0, 0, 0); _m.scale.set(1, 1, 1); _m.updateMatrix(); sh.setMatrixAt(i, _m.matrix); _m.position.set(x, 0.17, HZ + 1.36); _m.rotation.set(0, 0, 0); _m.updateMatrix(); ln.setMatrixAt(i, _m.matrix); }
      g.add(sh); g.add(ln); }
    { const spill = new THREE.Mesh(new THREE.PlaneGeometry(32, 3.2), poolMat(0xff7a30, 0.035)); spill.rotation.x = -PI / 2; spill.position.set(0, 0.03, HZ + 0.1); spill.scale.y = 1; spill.renderOrder = 2; g.add(spill); }
    // proscenium: fluted gilt pilasters, arch, valance with swags and fringe; velvet curtains that dissolve when they'd hide the play
    S.curt = [];
    const pil = new THREE.CylinderGeometry(1.0, 1.0, 15, 32, 1), PP = pil.attributes.position; for (let i = 0; i < PP.count; i++) { const x = PP.getX(i), z = PP.getZ(i), a = Math.atan2(x, z), k = 1 - 0.06 * Math.pow(Math.abs(Math.cos(a * 8)), 0.5); PP.setX(i, x * k); PP.setZ(i, z * k); } pil.computeVertexNormals();
    for (const sx of [-1, 1]) {
      const pg = W.mat({ color: 0xb08a44, roughness: 0.42, metalness: 1, envMapIntensity: 1.0 }); const col = new THREE.Mesh(pil, pg); col.position.set(sx * 18.2, 7.5, HZ + 1.6); g.add(col);
      for (const [y, s] of [[0.4, 1.0], [15.2, 1.15]]) { const cap = new THREE.Mesh(new THREE.BoxGeometry(2.6 * s, 0.8, 2.6 * s), pg); cap.position.set(sx * 18.2, y, HZ + 1.6); g.add(cap); }
      const cutU = { value: -9.5 }, legU = { value: -9.5 }, cm = dissolve(velvetM(0x7a0a18), cutU), tm = W.mat({ color: 0xc9a050, roughness: 0.45, metalness: 1, envMapIntensity: 0.9, transparent: true });
      const cur = new THREE.Mesh(folds(5.5, 16, 5, 0.42), cm); cur.position.set(sx * 15.4, 7.6, HZ + 1.1); g.add(cur);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 8, 24), tm); tie.position.set(sx * 15.6, 5.2, HZ + 1.2); tie.rotation.x = PI / 2; tie.scale.set(1.6, 0.6, 1); g.add(tie);
      const tas = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 10), tm); tas.position.set(sx * 14.2, 4.5, HZ + 1.3); g.add(tas);
      const wm = W.mat({ color: 0x2a0810, roughness: 0.9, emissive: 0x160306 }), legM = dissolve(velvetM(0x4a0814, { sheenColor: new THREE.Color(0xff8a60) }), legU);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1, 20, 24), wm); S.curt.push({ sx, a: 1, b: 1, mats: [tm], cutU, legU, wing }); wing.position.set(sx * 20.5, 9, -2); g.add(wing);
      for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(folds(4, 16, 3, 0.34), legM); leg.position.set(sx * 17.3, 7.6, -6.5 + k * 6); g.add(leg); }
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(39, 2.2, 2.2), goldM); beam.position.set(0, 16.2, HZ + 1.6); g.add(beam);
    { const pts = []; for (let i = 0; i <= 32; i++) { const u = i / 32 * 2 - 1; pts.push(new V3(u * 17.6, 15.0 + 2.6 * Math.sqrt(Math.max(0, 1 - u * u)), HZ + 2.75)); } const ar = new THREE.Mesh(tubeOf(pts, 0.42, 64, 8), goldM); g.add(ar); }
    const valM = velvetM(0x7a0a18); const val = new THREE.Mesh(folds(34.5, 3.4, 16, 0.35), valM); val.position.set(0, 13.7, HZ + 1.2); g.add(val);
    { const fr = [], sw = []; for (let s = 0; s < 4; s++) { const x0 = -17 + s * 8.5, x1 = x0 + 8.5, pts = [], fp = []; for (let i = 0; i <= 16; i++) { const u = i / 16, x = lerp(x0, x1, u), y = 12.4 - Math.sin(u * PI) * 1.1; pts.push(new V3(x, y, HZ + 0.95)); fp.push(new V3(x, y - 0.42, HZ + 0.95)); if (i % 2 === 0 && i > 0 && i < 16) fr.push(new V3(x, y - 0.6, HZ + 0.95)); } sw.push(tubeOf(pts, 0.42, 32, 8)); g.add(new THREE.Mesh(tubeOf(fp, 0.07, 32, 5), goldM)); }
      for (const q of sw) g.add(new THREE.Mesh(q, valM));
      const ft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.11, 0.5, 6), goldM, fr.length); fr.forEach((p, i) => { _m.position.copy(p); _m.rotation.set(PI, 0, 0); _m.scale.set(1, 1, 1); _m.updateMatrix(); ft.setMatrixAt(i, _m.matrix); }); g.add(ft); }
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.5, 6), goldM); crest.rotation.x = PI / 2; crest.position.set(0, 18.3, HZ + 3.0); g.add(crest);
    S.mask0 = W.glow(0xfff0c0, 1.2); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), S.mask0); e.scale.set(1.4, 0.7, 0.4); e.position.set(sx * 0.7, 18.6, HZ + 3.3); g.add(e); }
    // painted backdrop
    S.drop = new THREE.Group(); g.add(S.drop);
    S.skyT = [ptex(ART.sky(false)), ptex(ART.sky(true))];
    S.skyP = paper(42, 20, S.skyT[0], { em: 0.5 }); S.skyP.position.set(0, 9, -15); S.drop.add(S.skyP);
    S.moonM = W.glow(0xfff4d0, 2.2); S.moon = new THREE.Group(); S.moon.position.set(7, 11.5, -14.6); S.drop.add(S.moon);
    S.moon.add(new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), S.moonM)); { const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 14, 0.04), W.mat({ color: 0xd8c8a0, roughness: 0.6 })); st.position.y = 9; S.moon.add(st); }
    S.layers = [];
    S.townT = [ptex(ART.town('#1c1a3a', '#ffd070')), ptex(ART.town('#2a0e22', '#ff3a2a')), ptex(ART.town('#160a14', '#ff8a2a', true))];
    const lay = (art, w, h, y, z, amp, sp, rz, dy) => { const m = paper(w, h, art); m.position.set(0, y, z); S.drop.add(m); const L = { m, amp, sp, y0: y, rz, dy, w, h }; S.layers.push(L); return L; };
    lay(ART.hills('#3a2a6a', '#8a70c0'), 46, 9, 4.2, -13.8, 0.6, 0.23, 0.07, -1.6); S.townL = lay(S.townT[0], 40, 6.5, 3.0, -12.9, 0, 0, -0.11, -1.0); lay(ART.trees('#14302a', '#0a1814'), 44, 6, 2.6, -11.9, 0.35, 0.5, 0.14, -0.6);
    lay(ART.waves('#2a5a8a', '#c0e0ff'), 40, 2.6, 0.9, -11.0, 1.6, 0.9, -0.05, -0.4); lay(ART.waves('#1c406a', '#a0c8f0'), 40, 2.4, 0.7, -10.4, 1.6, -0.7, 0.07, -0.3);
    S.starG = new THREE.Group(); S.starG.position.set(-2, 13.4, -14.2); S.drop.add(S.starG);
    { const stT = ptex((x, w, h) => { x.fillStyle = '#ffd36a'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - PI / 2, r = i % 2 ? w * 0.2 : w * 0.47; x.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } x.closePath(); x.fill(); x.strokeStyle = '#9a5a1a'; x.lineWidth = 6; x.stroke(); }, 128, 128);
      S.starM = new THREE.MeshStandardMaterial({ map: stT, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: stT, emissiveIntensity: 0.35 });
      const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push(new V3(lerp(-12, 12, u), -Math.sin(u * PI) * 2.2, 0)); } S.starG.add(new THREE.Mesh(tubeOf(pts, 0.035, 40, 4), W.mat({ color: 0xd8c8a0, roughness: 0.8 })));
      for (const ex of [-12, 12]) { const rp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 14, 0.05), W.mat({ color: 0xd8c8a0, roughness: 0.8 })); rp.position.set(ex, 7, 0); S.starG.add(rp); }
      S.stars = []; for (let i = 0; i < 7; i++) { const u = (i + 0.5) / 7, st = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), S.starM); st.position.set(lerp(-12, 12, u), -Math.sin(u * PI) * 2.2 - 1.0, 0.05); S.starG.add(st); S.stars.push(st); } }
    // act two scenery: a painted sun and storm clouds lowered on ropes
    const ropeM = W.mat({ color: 0xd8c8a0, roughness: 0.8 }), ropeG = new THREE.BoxGeometry(0.05, 20, 0.05);
    S.hung = [];
    const hang = (m, x, y, z, rx) => { m.position.set(x, y + 16, z); for (const o of rx) { const rp = new THREE.Mesh(ropeG, ropeM); rp.position.set(o, 10, -0.02); m.add(rp); } S.drop.add(m); m.visible = false; S.hung.push({ m, y, em: m.material.emissiveIntensity }); };
    hang(paper(7, 7, ART.sun(), { em: 0.6, cw: 256, ch: 256 }), -7, 8.6, -14.3, [0]);
    hang(paper(12, 4, ART.cloud('#3a1838', '#c06080'), { em: 0.25 }), -12, 13.2, -13.4, [-4, 4]); hang(paper(13, 4.4, ART.cloud('#2a1030', '#a05080'), { em: 0.25 }), 9.5, 14.0, -13.2, [-4.5, 4.5]);
    // finale: flames on the flats, a hard limelight, embers
    S.fireM = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 0 }, uD: { value: 0 } }, vertexShader: POOLV, fragmentShader: FIREF, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    S.fireL = new THREE.PointLight(0xff6a20, 0, 34, 1.4); S.fireL.position.set(-2, 6, -8.5); g.add(S.fireL);
    { const fg = new THREE.PlaneGeometry(4.2, 4.4); fg.translate(0, 1.5, 0); const fx = mulberry(12);
      for (const [li, n] of [[0, 4], [1, 4], [2, 3]]) { const L = S.layers[li]; for (let i = 0; i < n; i++) { const f = new THREE.Mesh(fg, S.fireM); f.position.set((i + 0.5) / n * L.w - L.w / 2 + (fx() - 0.5) * 3, L.h * (0.05 + fx() * 0.2), 0.06); f.scale.setScalar(0.8 + fx() * 0.7); f.renderOrder = 3; f.visible = false; L.m.add(f); (S.fires = S.fires || []).push(f); } } }
    S.lime = new THREE.Group(); S.lime.visible = false; g.add(S.lime);
    { const LP = new V3(-10, 17, -17.5), LE = new V3(-3.5, 6.5, -9.5); const d = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), W.glow(0xffffff, 1.7)); d.position.copy(LP); d.lookAt(0, 4, 0); S.lime.add(d);
      const hs = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 1.6, 24, 1, true), W.mat({ color: 0x18141a, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide })); hs.position.copy(LP); hs.quaternion.setFromUnitVectors(_Y, _w.copy(LP).sub(LE).normalize()); hs.position.addScaledVector(_w, 0.6); S.lime.add(hs);
      const L = LP.distanceTo(LE); S.limeCone = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 5.2, L, 32, 1, true), coneMat(0xfff6e8)); S.limeCone.position.copy(LP).add(LE).multiplyScalar(0.5); S.limeCone.quaternion.setFromUnitVectors(_Y, _w.copy(LP).sub(LE).normalize()); S.limeCone.renderOrder = 4; S.lime.add(S.limeCone); }
    S.wash = []; { const wg = new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2); for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(wg, new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 }, uT: { value: 0 }, uS: { value: new THREE.Vector2(1, 1) } }, vertexShader: POOLV, fragmentShader: 'uniform float uA,uT; uniform vec2 uS; varying vec2 vUv; float h1(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); } void main(){ float ex=min(min(vUv.x,1.0-vUv.x)*uS.x,min(vUv.y,1.0-vUv.y)*uS.y); float e=smoothstep(0.0,0.04,ex); float rim=1.0-smoothstep(0.0,0.14,ex); vec2 gp=vUv*uS*5.0+vec2(sin(uT*0.7)*2.0,uT*1.5); vec2 fq=abs(fract(gp)-0.5); float d=step(0.97,h1(floor(gp)))*step(max(fq.x,fq.y),0.12); float a=(0.26+0.7*rim+d*0.6)*e*max(uA,0.0); gl_FragColor=vec4(vec3(1.0,0.86,0.64)*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.y = 0.05; m.renderOrder = 3; m.visible = false; g.add(m); S.wash.push({ m, t: 0 }); } } S.limeK = 0;
    S.embers = W.motes({ n: 220, box: [40, 16, 12], color: 0xff8a30, size: 0.09, vel: [0.15, 1.3, 0.05], sway: 0.8, center: [0, 7, -9], mult: 1.6 }); S.embers.visible = false; g.add(S.embers);
    S.hotPools = []; for (const [x, z, r] of [[-9, -4, 3.2], [8, 3.5, 3.6], [1, -6.5, 2.8]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat(0xfff0e0)); m.rotation.x = -PI / 2; m.position.set(x, 0.035, z); m.scale.setScalar(r * 2); m.renderOrder = 2; m.visible = false; g.add(m); S.hotPools.push(m); }
    // fly loft: battens, ropes, sandbags, spare flats
    const dark = W.mat({ color: 0x0a0808, roughness: 0.9 }), pipe = W.mat({ color: 0x2a2630, roughness: 0.5, metalness: 0.7 });
    for (const z of [-6, 0, 6]) { const r = new THREE.Mesh(new THREE.BoxGeometry(38, 0.3, 0.3), dark); r.position.set(0, 14, z); g.add(r); }
    { const rp = [], bat = [[15.5, -16.2], [19, -17.6], [12.5, -18.6], [21, -15.4], [17, -19.5]];
      for (const [y, z] of bat) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 40, 8), pipe); m.rotation.z = PI / 2; m.position.set(0, y, z); g.add(m); for (const x of [-14, -5, 5, 14]) rp.push(x, y, z, x, 44, z); }
      const NB = 12, sb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 10), W.mat({ color: 0x6a5434, roughness: 0.95 }), NB), sr = mulberry(9);
      for (let i = 0; i < NB; i++) { const sx = i % 2 ? 1 : -1, x = sx * (19.3 + sr() * 0.8), y = 3 + sr() * 12, z = -17 + sr() * 9; _m.position.set(x, y, z); _m.rotation.set(0, sr() * 3, 0); _m.scale.set(0.9, 1.35, 0.9); _m.updateMatrix(); sb.setMatrixAt(i, _m.matrix); rp.push(x, y + 0.6, z, x, 44, z); }
      g.add(sb); const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x8a7a60, transparent: true, opacity: 0.55 })));
      const sp1 = paper(18, 6, ART.trees('#1a3a2a', '#0a1814'), { em: 0.08 }); sp1.position.set(-8, 21, -17.6); sp1.rotation.z = 0.06; g.add(sp1); const sp2 = paper(16, 5, ART.cloud('#2a2040', '#6a5a90'), { em: 0.08 }); sp2.position.set(9, 23, -19.4); sp2.rotation.z = -0.08; g.add(sp2); }
    // follow spots for the blackout: beam with dust, housing, hot pool on the boards
    S.cones = []; S.spotPools = [];
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 3.1, 13.2, 32, 1, true), coneMat(LIME));
      const hs = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.1, 14), W.mat({ color: 0x141018, roughness: 0.5, metalness: 0.6 })); hs.position.y = 7.1; c.add(hs);
      const ln = new THREE.Mesh(new THREE.CircleGeometry(0.4, 18), W.glow(LIME, 1.6)); ln.rotation.x = PI / 2; ln.position.y = 6.54; c.add(ln);
      c.position.y = 7; c.visible = false; c.renderOrder = 14; g.add(c); S.cones.push(c);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat(LIME)); pl.rotation.x = -PI / 2; pl.position.y = 0.04; pl.scale.setScalar(6.6); pl.renderOrder = 2; pl.visible = false; g.add(pl); S.spotPools.push(pl);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.9, 12), dark); lamp.position.set(-13.5 + i * 4.5, 13.6, 6); lamp.rotation.x = 0.5; g.add(lamp);
    }
    // sliding flats for the scene changes
    S.flats = [];
    const arts = [ART.trees('#14302a', '#0a1814'), ART.town('#3a1a30', '#d8a050'), ART.hills('#5a3a20', '#c8a070')];
    for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) { const f = paper(20, 7.5, arts[r], { em: 0.25 }); f.position.set(sx * 30, 3.7, ROWZ[r]); f.castShadow = true; g.add(f); S.flats.push({ m: f, row: r, sx, x: sx * 30, tx: sx * 30 }); }
    // the house
    const NA = 150, heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), NA), ar = mulberry(31);
    for (let i = 0; i < NA; i++) { const row = Math.floor(i / 25), k = i % 25; _m.position.set((k - 12) * 1.5 + (row % 2) * 0.7 + (ar() - 0.5) * 0.3, -1.6 + row * 0.5 + ar() * 0.15, 15 + row * 1.9); _m.scale.set(1, 1.15, 1); _m.rotation.set(0, 0, 0); _m.updateMatrix(); heads.setMatrixAt(i, _m.matrix); heads.setColorAt(i, _c.setHex(row === 0 ? 0x2a0e08 : row === 1 ? 0x180705 : 0x070204)); }
    g.add(heads);
    S.hallM = W.mat({ color: 0x0a0508, roughness: 1, side: THREE.BackSide }); const hall = new THREE.Mesh(new THREE.BoxGeometry(70, 44, 90), S.hallM); hall.position.set(0, 16, 12); g.add(hall);
    const lampsFar = W.glow(0xffb060, 2); for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lampsFar); s.position.set(-27 + i * 6, 7 + (i % 2) * 5, 44); g.add(s); }
    g.add(W.motes({ n: 260, box: [34, 14, 22], color: 0xffe0b0, size: 0.06, vel: [0.03, -0.04, 0.02], sway: 0.5, center: [0, 7, 2], mult: 0.9 }));
    // paper birds ride the bird bullets; knives fly and stick in the boards
    { const P = [0, 0, 0.55, -0.24, 0.14, -0.05, 0, 0, -0.5, 0, 0, 0.55, 0, 0, -0.5, 0.24, 0.14, -0.05, 0, 0, 0.55, 0, -0.15, 0, 0, 0, -0.5, 0, 0.02, 0.32, -0.62, 0.3, -0.18, 0, 0.02, -0.38, 0, 0.02, 0.32, 0, 0.02, -0.38, 0.62, 0.3, -0.18, 0, 0, -0.5, 0.06, 0.12, -0.75, -0.06, 0.12, -0.75];
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.computeVertexNormals(); const VC = []; for (let i = 0; i < 18; i++) { const t = Math.floor(i / 3); const c = t < 2 ? [0.6, 0.05, 0.18] : t === 2 ? [0.18, 0.02, 0.06] : t === 5 ? [0.7, 0.08, 0.22] : (i % 3 === 1 ? [0.75, 0.25, 0.38] : i % 3 === 0 ? [0.3, 0.16, 0.12] : [0.52, 0.4, 0.3]); VC.push(...c); } bg.setAttribute('color', new THREE.Float32BufferAttribute(VC, 3));
      S.birds = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }), 48); S.birds.count = 0; S.birds.frustumCulled = false; g.add(S.birds); }
    { const steel = W.mat({ color: 0xf4f6ff, roughness: 0.35, metalness: 0.9, emissive: 0xb8c0e0, emissiveIntensity: 0.42, envMapIntensity: 0.8 }), bl = new THREE.OctahedronGeometry(1, 0); bl.scale(0.16, 0.08, 0.8); bl.translate(0, 0, 0.5); const stG = new THREE.ConeGeometry(0.03, 2.4, 6, 1, true).rotateX(-PI / 2).translate(0, 0, -1.3), stM = W.glow(0xe4ecff, 0.8, { transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }), edgeM = new THREE.MeshBasicMaterial({ color: 0xeef2ff });
      S.kn = []; for (let i = 0; i < 8; i++) { const k = new THREE.Group(); const bm = new THREE.Mesh(bl, steel); bm.castShadow = true; k.add(bm); const st = new THREE.Mesh(stG, stM); k.add(st); k.userData0 = st; const ed = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 1.35), edgeM); ed.position.z = 0.55; k.add(ed); const hl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.09), goldM); hl.position.z = -0.27; k.add(hl); const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.32, 8), W.mat({ color: 0x2a0a14, roughness: 0.6 })); gr.rotation.x = PI / 2; gr.position.z = -0.47; k.add(gr); k.visible = false; g.add(k); S.kn.push(k); } S.kni = 0; S.knBl = bl; S.knSteel = W.mat({ color: 0xe0e4ee, roughness: 0.45, metalness: 0.6, emissive: 0x8890a8, emissiveIntensity: 0.25, envMapIntensity: 0.6 }); }

    // ---- understudies ----
    const cls = UI.selectedClass() || G.classes[0]; S.dolls = [];
    for (const mode of ['x', 'z']) {
      const M = buildHero({ id: cls.id, look: { armor: 0xd9c9a4, cloth: mode === 'x' ? 0x7a1028 : 0x1c2a7a, glow: mode === 'x' ? ROSE : 0x5a9cff, hood: cls.look.hood, hat: cls.look.hat, weapon: cls.look.weapon || (cls.id === 'duskblade' ? 'blade' : 'staff') } });
      g.add(M.group);
      const bar = new THREE.Group(); for (const r of [0, PI / 2]) { const q = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.1), W.mat({ color: 0x3a2412 })); q.rotation.y = r; bar.add(q); } g.add(bar);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24), 3));
      const ln = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(mode === 'x' ? ROSE : 0x5a9cff).multiplyScalar(1.6), transparent: true, opacity: 0.8 })); ln.frustumCulled = false; g.add(ln);
      S.dolls.push({ mode, on: mode === 'x', M, bar, ln, fake: { moveSpeed: 0, grounded: true, casting: null, parryT: 0, flashT: 0 } });
    }
    S.dolls[1].M.group.visible = S.dolls[1].bar.visible = S.dolls[1].ln.visible = false;

    // ---- the Impresario: velvet tailcoat with crimson lining, porcelain mask, lacquer hat, gold trim, on a control cross ----
    const bg = b.group; S.rimU = { value: new THREE.Color(0.42, 0.34, 0.95) }; S.linU = { value: new THREE.Color(0x8a0a1c) };
    const coatM = rimify(new THREE.MeshStandardMaterial({ color: 0x0b0910, roughness: 0.92, side: THREE.DoubleSide, envMapIntensity: 0.4 }), S, true);
    const lacq = rimify(new THREE.MeshStandardMaterial({ color: 0x0a080c, roughness: 0.14, metalness: 0.15, envMapIntensity: 1.8 }), S, false);
    const shirt = W.mat({ color: 0xf2ece0, roughness: 0.55, emissive: 0xfff4e0, emissiveIntensity: 0.06 }), glove = W.mat({ color: 0xf6f2ea, roughness: 0.6, emissive: 0xfff4e0, emissiveIntensity: 0.08 });
    S.trim = new THREE.MeshStandardMaterial({ color: 0xd0a048, metalness: 1, roughness: 0.26, emissive: 0xffb030, emissiveIntensity: 0.12, envMapIntensity: 1.6 });
    const crim = W.mat({ color: 0x9a0a22, roughness: 0.55 }), hatM = W.mat({ color: 0x050407, roughness: 0.28, metalness: 0.1, envMapIntensity: 0.6 }); hatM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', '{ float lum = dot(max(outgoingLight, vec3(0.0)), vec3(0.299, 0.587, 0.114)); vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); outgoingLight = vec3(min(lum, 0.55)) + vec3(0.16, 0.12, 0.3) * pow(max(fr, 0.0), 6.0); }\n#include <opaque_fragment>'); }; hatM.customProgramCacheKey = () => 'theatreHat';
    const add = (par, geo, mat, x = 0, y = 0, z = 0, sh = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh; par.add(m); return m; };
    S.rig = new THREE.Group(); S.rig.scale.setScalar(1.12); bg.add(S.rig);
    const TP = [[0.34, 1.95], [0.44, 2.12], [0.4, 2.45], [0.52, 2.9], [0.8, 3.3], [0.88, 3.48], [0.62, 3.66], [0.2, 3.8]];
    const rAt = (y) => { for (let i = 1; i < TP.length; i++) if (y <= TP[i][1]) return lerp(TP[i - 1][0], TP[i][0], (y - TP[i - 1][1]) / (TP[i][1] - TP[i - 1][1])); return 0.2; };
    add(S.rig, new THREE.LatheGeometry(TP.map((p) => new THREE.Vector2(p[0], p[1])), 28), coatM).scale.z = 0.7;
    { const ys = [3.66, 3.48, 3.3, 2.9, 2.45, 2.3], P = [], I = []; ys.forEach((y, j) => { const hw = lerp(0.05, 0.27, (y - 2.3) / 1.36), r = rAt(y); for (const x of [-hw, 0, hw]) P.push(x, y, 0.7 * Math.sqrt(Math.max(r * r - x * x, 0)) + 0.014); if (j) { const a = (j - 1) * 3, c = j * 3; I.push(a, c, a + 1, a + 1, c, c + 1, a + 1, c + 1, a + 2, a + 2, c + 1, c + 2); } });
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); sg.setIndex(I); sg.computeVertexNormals(); add(S.rig, sg, shirt, 0, 0, 0, false); }
    for (const y of [3.15, 2.9, 2.65, 2.42]) add(S.rig, new THREE.SphereGeometry(0.05, 10, 8), S.trim, 0, y, 0.7 * rAt(y) + 0.04, false);
    { const bt = new THREE.Group(); bt.position.set(0, 3.64, 0.7 * rAt(3.64) + 0.05); S.rig.add(bt); for (const s of [-1, 1]) { const c = add(bt, new THREE.ConeGeometry(0.11, 0.24, 8), crim, s * 0.12, 0, 0, false); c.rotation.z = s * PI / 2; c.scale.z = 0.5; } add(bt, new THREE.SphereGeometry(0.055, 8, 6), crim, 0, 0, 0.01, false); }
    add(S.rig, new THREE.CylinderGeometry(0.22, 0.25, 0.22, 18, 1, true), shirt, 0, 3.8, 0.02, false);
    add(S.rig, new THREE.CylinderGeometry(0.14, 0.15, 0.4, 12), coatM, 0, 3.92, 0);
    { const cl = add(S.rig, new THREE.LatheGeometry([[0.3, 3.55], [0.36, 3.85], [0.5, 4.25], [0.6, 4.48]].map((p) => new THREE.Vector2(p[0], p[1])), 24, 1.0, TAU - 2.0), coatM); cl.scale.z = 0.8;
      add(S.rig, tubeOf(ring(0.6, 4.48, 1.0, TAU - 1.0, 0.8), 0.03, 48, 5), S.trim, 0, 0, 0, false); }
    { const SKP = [[0.74, 1.5], [0.64, 1.72], [0.5, 1.95], [0.44, 2.14]].map((p) => new THREE.Vector2(p[0], p[1]));
      for (const [p0, p1] of [[1.1, PI - 0.75], [PI + 0.75, TAU - 1.1]]) { add(S.rig, new THREE.LatheGeometry(SKP, 14, p0, p1 - p0), coatM).scale.z = 0.76; add(S.rig, tubeOf(ring(0.74, 1.5, p0, p1, 0.76, 14), 0.016, 28, 4), S.trim, 0, 0, 0, false); }
      add(S.rig, new THREE.LatheGeometry(SKP.map((v) => new THREE.Vector2(v.x * 0.93, v.y)), 8, PI - 0.77, 1.54), crim, 0, 0, 0, false).scale.z = 0.76;
      // back: seam piping, waist buttons, shoulder line
      const sm = W.mat({ color: 0x3a2a4a, roughness: 0.6 }), bp = []; for (let i = 0; i <= 10; i++) { const y = lerp(2.14, 3.62, i / 10); bp.push(new V3(0, y, -0.7 * rAt(y) - 0.006)); } add(S.rig, tubeOf(bp, 0.016, 20, 4), sm, 0, 0, 0, false);
      for (const sx of [-1, 1]) { add(S.rig, new THREE.SphereGeometry(0.055, 10, 8), S.trim, sx * 0.13, 2.16, -0.7 * rAt(2.16) * Math.cos(0.3) - 0.03, false); const pad = add(S.rig, new THREE.SphereGeometry(0.3, 14, 10), coatM, sx * 0.72, 3.5, 0); pad.scale.set(1.1, 0.42, 0.8); pad.rotation.z = -sx * 0.18;
        add(S.rig, tubeOf([new V3(sx * 0.2, 3.78, -0.08), new V3(sx * 0.5, 3.66, -0.12), new V3(sx * 0.96, 3.5, -0.05)], 0.018, 12, 4), S.trim, 0, 0, 0, false); } }
    // split tails
    S.tails = new THREE.Group(); S.tails.position.set(0, 2.08, -0.26); S.rig.add(S.tails); S.tail = [];
    for (const sx of [-1, 1]) {
      const P = [], I = [], N = 10; for (let j = 0; j <= N; j++) { const v = j / N, wd2 = 0.3 * Math.pow(1 - v, 0.7) + 0.03; for (const u of [0, 1]) { const x = sx * (0.13 + u * wd2 + v * 0.14); P.push(x, -v * 1.3, -0.04 - v * 0.22 - v * v * 0.3 - Math.abs(x) * 0.35); } if (j) { const a = (j - 1) * 2, c = j * 2; if (sx < 0) I.push(a, c, a + 1, a + 1, c, c + 1); else I.push(a, a + 1, c, a + 1, c + 1, c); } }
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); tg.setIndex(I); tg.computeVertexNormals();
      const tp = new THREE.Group(); S.tails.add(tp); add(tp, tg, coatM); S.tail.push(tp);
    }
    // legs
    S.legs = []; for (const sx of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(sx * 0.17, 2.0, 0); S.rig.add(lg); add(lg, new THREE.CylinderGeometry(0.1, 0.075, 1.8, 10), coatM, 0, -0.9, 0); add(lg, new THREE.CylinderGeometry(0.09, 0.1, 0.22, 10), shirt, 0, -1.72, 0, false); const sh = add(lg, new THREE.SphereGeometry(0.12, 10, 8), lacq, 0, -1.88, 0.08); sh.scale.set(0.8, 0.55, 1.6); S.legs.push(lg); }
    // head: porcelain mask with painted face and glowing pupils; lacquer top hat
    S.head = new THREE.Group(); S.head.position.y = 4.16; S.rig.add(S.head);
    { const ft = ptex(FACE, 512, 256), mg = new THREE.Group(); mg.scale.set(0.82, 1.05, 0.85); S.head.add(mg);
      const mk = add(mg, new THREE.SphereGeometry(0.42, 32, 24), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.28, emissive: 0xffffff, emissiveMap: ft, emissiveIntensity: 0.16, envMapIntensity: 1.2 })); mk.rotation.y = -PI / 2; }
    S.eyeM = W.glow(VIO, 2.5); for (const sx of [-1, 1]) add(S.head, new THREE.SphereGeometry(0.038, 10, 8), S.eyeM, sx * 0.126, 0.066, 0.322, false);
    { const hat = new THREE.Group(); hat.position.set(0.02, 0.36, -0.02); hat.rotation.set(-0.08, 0, 0.12); S.head.add(hat);
      add(hat, new THREE.CylinderGeometry(0.62, 0.62, 0.04, 36), hatM); const cu = add(hat, new THREE.TorusGeometry(0.62, 0.035, 8, 40), hatM, 0, 0.02, 0, false); cu.rotation.x = PI / 2;
      add(hat, new THREE.CylinderGeometry(0.41, 0.37, 1.0, 36), hatM, 0, 0.52, 0); add(hat, new THREE.CylinderGeometry(0.378, 0.372, 0.16, 36), S.trim, 0, 0.11, 0, false);
      S.hatTop = new THREE.Object3D(); S.hatTop.position.y = 1.02; hat.add(S.hatTop); }
    // jointed stick arms, white gloves, cane
    S.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.84, 3.42, 0); S.rig.add(sh); add(sh, new THREE.SphereGeometry(0.15, 12, 10), coatM, 0, 0, 0);
      add(sh, new THREE.CylinderGeometry(0.11, 0.09, 1.25, 10), coatM, 0, -0.62, 0);
      const el = new THREE.Group(); el.position.y = -1.25; sh.add(el); add(el, new THREE.SphereGeometry(0.1, 10, 8), coatM);
      add(el, new THREE.CylinderGeometry(0.09, 0.075, 1.12, 10), coatM, 0, -0.56, 0); add(el, new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12), shirt, 0, -1.1, 0, false); add(el, new THREE.TorusGeometry(0.1, 0.018, 6, 16), S.trim, 0, -1.04, 0, false).rotation.x = PI / 2;
      const gl = new THREE.Group(); gl.position.y = -1.26; el.add(gl); add(gl, new THREE.SphereGeometry(0.13, 12, 10), glove).scale.set(1, 1.15, 0.6);
      for (let f = 0; f < 3; f++) { const fg = add(gl, new THREE.CapsuleGeometry(0.034, 0.16, 3, 6), glove, (f - 1) * 0.07, -0.2, 0.02, false); fg.rotation.x = 0.3; } add(gl, new THREE.CapsuleGeometry(0.036, 0.1, 3, 6), glove, -sx * 0.12, -0.08, 0.05, false).rotation.z = sx * 0.8;
      S.arms.push({ sh, el, sx, glove: gl });
    }
    { const cn = new THREE.Group(); cn.rotation.x = 0.18; S.arms[1].glove.add(cn); add(cn, new THREE.CylinderGeometry(0.03, 0.03, 2.3, 8), lacq, 0, -1.0, 0.03); add(cn, new THREE.SphereGeometry(0.1, 12, 10), W.mat({ color: 0xb08a44, roughness: 0.4, metalness: 1, envMapIntensity: 0.8 }), 0, 0.17, 0.03); add(cn, new THREE.CylinderGeometry(0.034, 0.03, 0.1, 8), shirt, 0, -2.15, 0.03, false); }
    S.fan = new THREE.Group(); S.fan.position.set(0, -0.18, 0.05); S.fan.visible = false; S.arms[0].glove.add(S.fan); for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(S.knBl, S.knSteel); k.rotation.set(PI / 2, 0, (i - 1.5) * 0.32); k.scale.setScalar(0.85); S.fan.add(k); }
    S.backA = new THREE.Object3D(); S.backA.position.set(0, 3.55, -0.4); S.rig.add(S.backA);
    // control cross that his strings tie to
    S.cross = new THREE.Group(); S.cross.position.y = 9.0; bg.add(S.cross); const wood = W.mat({ color: 0x6a4320, roughness: 0.7 });
    add(S.cross, new THREE.BoxGeometry(2.1, 0.11, 0.14), wood, 0, 0, 0, false); add(S.cross, new THREE.BoxGeometry(0.14, 0.11, 1.5), wood, 0, 0, 0, false); add(S.cross, new THREE.BoxGeometry(0.09, 0.55, 0.09), wood, 0, 0.3, 0, false);
    for (const [x, z] of [[-1.05, 0], [1.05, 0], [0, 0.75], [0, -0.75]]) add(S.cross, new THREE.SphereGeometry(0.06, 8, 6), S.trim, x, 0, z, false);
    S.xa = [[-1.05, 0, 0], [1.05, 0, 0], [0, 0, 0.75], [0, 0, -0.75], [0, 0.58, 0]].map(([x, y, z]) => { const o = new THREE.Object3D(); o.position.set(x, y, z); S.cross.add(o); return o; });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
    S.bossStr = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.45 })); S.bossStr.frustumCulled = false; g.add(S.bossStr);
    S.bpool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat(0xffe6c0)); S.bpool.rotation.x = -PI / 2; S.bpool.scale.setScalar(7); S.bpool.renderOrder = 2; g.add(S.bpool);

    // ---- what holds his strings (revealed in the finale) ----
    S.giant = new THREE.Group(); S.giant.visible = false; g.add(S.giant);
    const carve = new THREE.MeshStandardMaterial({ color: 0xd6ccc2, roughness: 0.5, envMapIntensity: 0.6 });
    carve.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 wn = (vec4(normal, 0.0) * viewMatrix).xyz; wn /= max(length(wn), 1e-4); float up = clamp(wn.y, -1.0, 1.0); diffuseColor.rgb *= mix(1.0, 0.55, clamp(up, 0.0, 1.0)); totalEmissiveRadiance += vec3(0.3, 0.1, 0.62) * clamp(-up, 0.0, 1.0) * 0.85; }'); };
    carve.customProgramCacheKey = () => 'theatreCarve';
    const jointM = W.mat({ color: 0x8a7a74, roughness: 0.5 }), nailM = W.mat({ color: 0xf0e4dc, roughness: 0.15, envMapIntensity: 1.4 });
    { const gg = new THREE.Group(); gg.position.set(0, 15, -23); gg.scale.set(0.85, 1.12, 0.5); S.giant.add(gg); const ft = ptex(FACE, 512, 256); const gm = new THREE.Mesh(new THREE.SphereGeometry(7, 48, 32), new THREE.MeshStandardMaterial({ map: ft, color: 0x7a7078, roughness: 0.5, envMapIntensity: 0.4 })); gm.rotation.y = -PI / 2; gg.add(gm); }
    S.gEye = W.glow(VIO, 0.1); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), S.gEye); e.position.set(sx * 2.19, 16.18, -19.7); S.giant.add(e); }
    S.gL = new THREE.PointLight(VIO, 0, 60, 1.6); S.gL.position.set(0, 7, -7); g.add(S.gL);
    S.hands = [];
    const seg = (r0, r1, L) => new THREE.CylinderGeometry(r1, r0, L, 16).rotateX(PI / 2);
    for (const sx of [-1, 1]) {
      const ho = new THREE.Group(), h = new THREE.Group(); h.rotation.y = -sx * PI / 2; ho.add(h); const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), carve); palm.scale.set(2.3, 0.72, 2.5); palm.castShadow = true; h.add(palm);
      for (let f = 0; f < 4; f++) { let par = new THREE.Group(); par.position.set(-1.6 + f * 1.07, -0.05, 2.25); par.rotation.y = (f - 1.5) * 0.22; h.add(par); const k = f === 0 || f === 3 ? 0.86 : 1;
        [[1.15, 0.44, 0.37], [0.92, 0.36, 0.29], [0.72, 0.28, 0.18]].forEach(([L, r0, r1], j) => { const jb = new THREE.Mesh(new THREE.SphereGeometry(r0 * 0.98, 14, 10), jointM); par.add(jb); const sg2 = new THREE.Mesh(seg(r0, r1, L * k - 0.07), carve); sg2.position.z = (L * k) / 2 + 0.01; if (j === 2) { const tip = new THREE.Mesh(new THREE.SphereGeometry(r1, 12, 8), carve); tip.position.z = L * k - 0.04; par.add(tip); } sg2.castShadow = true; par.add(sg2);
          if (j === 2) { const nl = new THREE.Mesh(new THREE.BoxGeometry(r1 * 1.3, 0.06, 0.34), nailM); nl.position.set(0, r1 * 0.9, L * k - 0.25); nl.rotation.x = -0.12; par.add(nl); }
          const nx = new THREE.Group(); nx.position.z = L * k; nx.rotation.x = 0.26; par.add(nx); par = nx; }); }
      { let par = new THREE.Group(); par.position.set(sx * 2.0, -0.1, 0.4); par.rotation.y = sx * 0.9; h.add(par); [[1.0, 0.5, 0.44], [0.85, 0.42, 0.34]].forEach(([L, r0, r1]) => { par.add(new THREE.Mesh(new THREE.SphereGeometry(r0 * 0.92, 14, 10), jointM)); const sg2 = new THREE.Mesh(seg(r0, r1, L - 0.18), carve); sg2.position.z = L / 2; par.add(sg2); const nx = new THREE.Group(); nx.position.z = L; nx.rotation.y = -sx * 0.25; par.add(nx); par = nx; }); }
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.7, 32).rotateX(PI / 2), glove); cuff.position.z = -2.5; h.add(cuff); const roll = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.13, 8, 36), glove); roll.position.z = -2.15; h.add(roll);
      const slv = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.3, 4, 28, 1, true).rotateX(PI / 2), coatM); slv.position.z = -4.8; h.add(slv);
      const cr = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.06, 6, 40), S.trim); cr.position.z = -2.85; h.add(cr);
      const cl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), W.mat({ color: 0x9a7a3a, roughness: 0.6, metalness: 0.5 })); cl.position.set(-sx * 1.0, 1.1, -2.5); h.add(cl);
      ho.position.set(sx * 9, 30, -8); S.giant.add(ho); S.hands.push({ g: ho, sx, home: new V3(sx * 9, 13.5, -9), tgt: new V3(sx * 9, 13.5, -9), fast: 0 });
    }
    S.split = false; S.dark = 0; S.black = null; S.twang = 0; S.dz = 0; S.act = 0; S.gesture = 0; S.pitY = 0; S.a1 = 0; S.a2 = 0; S.lx = 0; S.lz = 0;
    b.distTo = function (x, z) { if (S.split) x = -x; return Math.max(0, Math.hypot(x - this.pos.x, z - this.pos.z) - this.radius); };
    return {
      edge: 'wall', spawn: { x: -5, z: 5 }, bossStart: { x: 0, z: -5, face: 0 }, camDist: 16,
      contains: (x, z) => Math.abs(x) <= HX - 0.4 && Math.abs(z) <= HZ - 0.4 && (!S.split || x <= -PIT - 0.3),
      clamp(p) { p.x = clamp(p.x, -HX + 0.5, S.split ? -PIT - 0.4 : HX - 0.5); p.z = clamp(p.z, -HZ + 0.5, HZ - 0.5); },
      bulletBounds: (x, z) => Math.abs(x) < 17.5 && Math.abs(z) < 11,
      camLimit(x, y, z) { return { x: clamp(x, -14.3, 14.3), y: Math.min(y, 12.5), z: clamp(z, -9.5, 30) }; },
    };
  }
  function folds(w, h, n, amp) { const geo = new THREE.PlaneGeometry(w, h, n * 8, 8), P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); P.setZ(i, Math.sin(x / w * n * TAU) * amp * (0.5 + 0.5 * (0.5 - y / h)) + Math.sin(x / w * n * 3.1 * TAU + 1) * amp * 0.18); } geo.computeVertexNormals(); return geo; }

  // ---- stagecraft ----
  const tgtOf = (S, k) => { const dl = dolls(S); if (k % (dl.length + 1) === 0) return { x: G.player.pos.x, z: G.player.pos.z }; return dpos(dl[(k % (dl.length + 1)) - 1], {}); };
  function* knives(b, n, gap = 0.72) {
    const S = b.state; S.fanOn = 1; yield* b.cast({ name: 'Knife Act', time: 0.6 });
    for (let i = 0; i < n; i++) {
      const q = tgtOf(S, i); S.gesture = 1;
      Sound.sfx('sword', 0.6, 1.3);
      if (!G.headless) { const K = S.kn[S.kni++ % S.kn.length], fr = new V3(b.pos.x, 3.4, b.pos.z), to = new V3(q.x, 0.3, q.z); K.userData = { t0: G.now, fr, to, dur: Math.max(0.05, fr.distanceTo(to) / 30), end: G.now + 1.0 }; K.visible = true; }
      Hz.circle(q.x, q.z, 2.6, 1.0, 260, { name: 'Knife Act', onFire() { FX.burst(q.x, 0.4, q.z, { n: 14, color: 0xffffff, color2: VIO, speed: [2, 8], up: 2, life: [0.2, 0.6] }); Sound.sfx('hit', 0.9, 1.4); } });
      yield gap;
    }
    S.fanOn = 0; yield 0.6;
  }
  function* flood(b, sides, delay = 1.7) {
    const S = b.state; S.gesture = 1; Sound.sfx('charge', 0.7, 1.4);
    for (const side of sides) {
      const o = { name: 'Limelight', color: LIME, quiet: true, onFire(h) { const s = h.shape; if (!G.headless) { const W0 = S.wash.find((q) => q.t <= 0) || S.wash[0]; W0.t = 1; W0.m.visible = true; W0.m.position.set(s.x + Math.sin(s.dir) * s.len * 0.5, 0.05, s.z + Math.cos(s.dir) * s.len * 0.5); W0.m.rotation.y = s.dir; W0.m.scale.set(s.w, 1, s.len); W0.m.material.uniforms.uS.value.set(s.w, s.len); S.limeK = 1; } Sound.sfx('boom', 0.8, 1.3); FX.flash(LIME, 0.08, 5); FX.shake(0.3); } };
      if (side === 'L') Hz.rect(-HX, 0, PI / 2, HX - MID, HZ * 2, delay, 380, o); else if (side === 'R') Hz.rect(HX, 0, -PI / 2, HX - MID, HZ * 2, delay, 380, o);
      else if (side === 'F') Hz.rect(0, HZ, PI, HZ - MID, HX * 2, delay, 380, o); else Hz.rect(0, -HZ, 0, HZ - MID, HX * 2, delay, 380, o);
    }
    yield* b.cast({ name: 'Limelight', time: delay }); yield 0.3;
  }
  function* trapdoor(b, delay = 1.25) {
    const S = b.state, o = { name: 'Trapdoor', color: ROSE, onFire() { FX.burst(0, 0.2, 0, { n: 50, color: ROSE, color2: 0x400010, speed: [2, 9], up: 5, life: [0.4, 1], radius: 3 }); Sound.sfx('boom', 1, 0.7); FX.shake(0.4); } };
    if (dolls(S).length > 1) Hz.circle(0, 0, 4.6, delay, 360, o); else Hz.rect(0, -HZ, 0, HZ * 2, 4.8, delay, 360, o);
    yield delay + 0.35;
  }
  function* scenery(b, n) {
    const S = b.state; yield* b.cast({ name: 'Scene Change', time: 0.7 }); Sound.sfx('steam', 0.7, 0.5);
    const rows = shuffle([0, 1, 2]).slice(0, n);
    for (const r of rows) {
      const sx = rnd() < 0.5 ? -1 : 1, len = rnd() < 0.5 ? rnd(9, 12.5) : rnd(17.5, 21), f = S.flats.find((q) => q.row === r && q.sx === sx);
      Hz.rect(sx * HX, ROWZ[r], sx < 0 ? PI / 2 : -PI / 2, len, 5.8, 1.7, 330, { name: 'Scene Change', color: 0xffb060, quiet: true, onFire() { f.tx = sx * (HX - len + 10); f.hold = 1.3; Sound.sfx('boom', 0.6, 1.5); FX.shake(0.2); } });
      yield 0.35;
    }
    yield 2.0;
  }
  function* birds(b, side, waves = 3) {
    yield* b.cast({ name: 'Paper Birds', time: 0.8 });
    let g0 = rndi(0, 6);
    for (let w = 0; w < waves; w++) {
      for (let i = 0; i < 9; i++) { if (i === g0 || i === g0 + 1 || i === (g0 + 5) % 9) continue; Bul.fire({ x: side * -16.5, z: -8 + i * 2, dir: side * PI / 2, speed: 8.5, r: 0.42, dmg: 120, color: 0x8a1a40, life: 4.2, bird: 1 }); }
      Sound.sfx('dash', 0.5, 1.6); g0 = (g0 + rndi(2, 4)) % 8; yield 1.15;
    }
    yield 1.6;
  }
  function* blackout(b, decoys, time = 4.4) {
    const S = b.state, p = G.player, dl = dolls(S), R0 = 3.1;
    let q = { x: -8, z: 3 };
    for (let k = 0; k < 40; k++) { q = { x: rnd(S.split ? -12.5 : -12, S.split ? -5 : 12), z: rnd(-6, 6) }; if (Math.abs(q.x) > 4.2 && (dl.length < 2 || Math.abs(q.z) > 3.6)) break; }
    const spots = [q]; for (const d of dl) { const m = mir(d, q.x, q.z, {}); spots.push({ x: m.x + rnd(-0.6, 0.6), z: m.z + rnd(-0.6, 0.6) }); }
    const lit = (x, z, L, r = R0) => L.some((s) => Math.hypot(s.x - x, s.z - z) <= r);
    for (let k = 0, tries = 0; k < decoys && tries < 200; tries++) {
      const c = { x: rnd(-12.5, 12.5), z: rnd(-6.5, 6.5) }; if (S.split && Math.abs(c.x) < 4.5) continue;
      if (spots.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < 6.4)) continue;
      if (dl.every((d) => { const m = mir(d, c.x, c.z, {}); return lit(m.x, m.z, spots, R0 + 1.2); })) continue;
      spots.push(c); k++;
    }
    S.black = { spots, at: G.now + time, r: R0, q }; Sound.sfx('bell', 0.7, 0.6);
    const marks = spots.map((s) => Hz.mark({ type: 'circle', x: s.x, z: s.z, r: R0 }, time + 0.2, { color: LIME, alpha: 0.9 }));
    if (!G.headless) spots.forEach((s, i) => { const c = S.cones[i]; if (c) { c.visible = true; c.position.set(s.x, 6.6, s.z); S.spotPools[i].visible = true; S.spotPools[i].position.set(s.x, 0.04, s.z); } });
    const r = yield* b.cast({ name: 'Blackout', time, onTick: (k) => { S.dark = Math.min(1, k * 5); } });
    for (const m of marks) Hz.cancel(m); for (const c of S.cones) c.visible = false; for (const pl of S.spotPools) pl.visible = false; S.black = null; S.dark = 0;
    if (r !== 'done') return;
    FX.flash(0xffffff, 0.35, 2.5); Sound.sfx('boom', 1, 0.5);
    const ok = lit(p.pos.x, p.pos.z, spots) && dl.every((d) => { const m = dpos(d, {}); return lit(m.x, m.z, spots); });
    if (!ok) { p.hurt(430, { blockable: false, src: { name: 'Blackout' } }); FX.shake(0.6); } else for (const s of spots.slice(0, 1 + dl.length)) FX.ring(s.x, s.z, { r1: 5, color: LIME, dur: 0.5 });
    yield 0.6;
  }
  function* encore(b) {
    const S = b.state, r = yield* b.cast({ name: 'Encore', time: 3.0, interruptible: true, onTick: () => { S.gesture = 1; } });
    if (r !== 'done') { yield 1.2; return; }
    Sound.sfx('clap', 1); FX.flash(ROSE, 0.2, 3);
    for (let i = 0; i < 12; i++) { const q = i % 3 === 2 ? { x: rnd(-13, S.split ? -3 : 13), z: rnd(-7, 7) } : tgtOf(S, i); const x = q.x + rnd(-1.2, 1.2), z = q.z + rnd(-1.2, 1.2); Hz.circle(x, z, 2.3, 1.15, 230, { name: 'Bouquet', color: ROSE, onFire() { FX.burst(x, 0.3, z, { n: 14, color: ROSE, color2: 0xffd0e0, speed: [1, 6], up: 4, grav: 6, life: [0.5, 1.1] }); } }); yield 0.42; }
    yield 1.0;
  }
  // act two: he works the far half of the stage
  function* flourish(b) {
    const S = b.state, q = dpos(S.dolls[0], {}), dir = angTo(b.pos.x, b.pos.z, q.x, q.z); b.autoFace = false; yield* b.turnTo(dir, 0.25); S.gesture = 1;
    Hz.cone(b.pos.x, b.pos.z, dir, 2.0, 8.5, 1.25, 300, { name: 'Flourish', onFire() { FX.slash(b.pos.x, 1.4, b.pos.z, dir, { r: 8.5, color: VIO, dur: 0.3 }); Sound.sfx('slash', 1, 0.7); } });
    yield 1.6; b.autoFace = true;
  }
  function* pirouette(b) { const S = b.state; S.spin = 1; Hz.circle(b.pos.x, b.pos.z, 6.6, 1.5, 320, { name: 'Pirouette', onFire() { FX.ring(b.pos.x, b.pos.z, { r1: 7, color: VIO, dur: 0.4 }); } }); yield* b.cast({ name: 'Pirouette', time: 1.5 }); S.spin = 0; yield 0.4; }
  function* sandbags(b, n) {
    yield* b.cast({ name: 'Sandbags', time: 0.5 });
    for (let i = 0; i < n; i++) { const p = G.player, x = p.pos.x, z = p.pos.z; Hz.circle(x, z, 2.8, 1.1, 260, { name: 'Sandbag', color: 0xffb060, onFire() { FX.burst(x, 0.3, z, { n: 16, smoke: true, color: 0x8a7a5a, color2: 0x2a2418, speed: [1, 5], life: [0.5, 1.1], size: [0.6, 1.4], alpha: 0.5 }); Sound.sfx('boom', 0.7, 0.9); } }); yield 0.85; }
    yield 0.4;
  }
  function* stroll(b) { const S = b.state; if (S.split) yield* b.moveTo(rnd(6.5, 11.5), rnd(-5, 5), 6); else { const p = G.player, a = angTo(p.pos.x, p.pos.z, 0, -2); yield* b.moveTo(clamp(p.pos.x + Math.sin(a) * 6, -9, 9), clamp(p.pos.z + Math.cos(a) * 6, -6, 4), 7); } }
  // finale: the hands
  function* slam(b, n) {
    const S = b.state;
    for (let i = 0; i < n; i++) {
      const H = S.hands[i % 2], q = tgtOf(S, i), x = clamp(q.x, -11, 11), z = clamp(q.z, -5, 5);
      H.tgt.set(x, 11, z); H.fast = 0;
      Hz.circle(x, z, 5.2, 1.6, 380, { name: 'The Hand', kb: { dist: 4 }, onFire() { H.tgt.set(x, 0.7, z); H.fast = 1; FX.ring(x, z, { r1: 5.6, color: VIO, dur: 0.45 }); FX.burst(x, 0.3, z, { n: 26, smoke: true, color: 0x8a7a6a, color2: 0x2a2020, speed: [2, 7], up: 1.5, life: [0.5, 1.1], size: [0.8, 1.8], alpha: 0.45, radius: 3 }); FX.shake(0.6); Sound.sfx('bigboom', 0.7); Co.start(function* () { yield 0.7; H.fast = 0; H.tgt.copy(H.home); }, 'fight'); } });
      yield 1.25;
    }
    yield 1.2;
  }
  function setAct(b, n) {
    const S = b.state, p = G.player; S.act = n; S.split = n === 1;
    S.black = null; S.dark = 0; S.spin = 0; S.fanOn = 0; for (const c of S.cones) c.visible = false; if (S.spotPools) for (const pl of S.spotPools) pl.visible = false;
    const d1 = S.dolls[1]; d1.on = n === 2; d1.M.group.visible = d1.bar.visible = d1.ln.visible = d1.on;
    S.giant.visible = n === 2;
    if (S.split && p.pos.x > -PIT - 0.6) { FX.burst(p.pos.x, 1, p.pos.z, { n: 20, color: VIO, speed: [1, 5] }); p.pos.x = -6; }
    if (S.split && b.pos.x < 5) b.pos.set(8, 0, -1);
    if (!S.split && n === 2 && Math.abs(b.pos.x) > 6) b.pos.set(0, 0, -4);
  }
  // per-act look: [key colour, key intensity, key dir, hemi sky, hemi ground, hemi intensity, foot intensity, fog, floor tint]
  const LOOK = [
    [0xffe2b8, 3.0, [0.18, 0.85, 0.55], 0x9a7a6a, 0x2a1810, 0.85, 105, 0x0a0406, 0xffffff],
    [0xff9a58, 2.0, [0.1, 0.42, 0.9], 0xa04a62, 0x2a0810, 0.6, 200, 0x1a0508, 0xffe0d8],
    [0xff9a8a, 2.0, [-0.25, 0.8, 0.5], 0x6a3a7a, 0x22060c, 0.5, 120, 0x0c0612, 0xb84848],
  ];
  const _kd = new V3(), _kd2 = new V3();

  G.bosses.push({
    id: 'theatre', name: 'THE IMPRESARIO', title: 'The Paper Theatre', hint: 'A performance', color: '#c86bff', telegraph: 0xd070ff,
    hp: 27500, radius: 1.5, aimY: 3.3, enrage: 450,
    post: { bloom: 0.62, threshold: 0.84, radius: 0.65, exposure: 1.08, vig: 1.15, sat: 1.12, tint: [1.05, 0.99, 0.95] },
    music: { bpm: 132, root: 45, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 0, 3, 4, 0, 0, 5, 4],
      layers: [
        { v: 'bass', pat: '0.....4.....0...', oct: -1, len: 2, vol: 0.13 }, { v: 'pulse', pat: '....24......24..', oct: 1, len: 1, vol: 0.05 }, { v: 'flute', pat: ['4.....7.6.5.4...', '2.....4.3.2.0...'], oct: 2, len: 3, vol: 0.06 },
        { v: 'snare', from: 1, pat: '....x.......x..x', vol: 0.14 }, { v: 'organ', from: 1, pat: ['0.2.4.7.4.2.0.2.', '0.3.5.7.5.3.0.3.'], oct: 1, len: 1, vol: 0.06 }, { v: 'kick', from: 1, pat: 'x.....x.x.......', vol: 0.3 },
        { v: 'brass', from: 2, pat: ['0.......4.......', '5.......4.......'], oct: 1, len: 7, vol: 0.1 }, { v: 'taiko', from: 2, pat: 'x..x..x.x..x..x.', vol: 0.28 }, { v: 'bell', from: 2, pat: '0...............', oct: 2, len: 8, vol: 0.08 }, { v: 'lead', from: 2, pat: ['7.6.5.4.5.6.7.9.', '7.9.b.9.7.6.5.4.'], oct: 2, len: 1, vol: 0.045 },
      ] },
    build,
    *intro(b) { yield* Cam.shot([0, 5, 34], [0, 6, 0], [-3, 3.4, 9], [0, 4, -5], 4.8, 44); },
    phases: [
      { at: 1, *run(b) {
        b.autoFace = true; setAct(b, 0); yield 1.2;
        while (true) {
          yield* knives(b, 4); yield* flood(b, [rnd() < 0.5 ? 'L' : 'R']); yield* trapdoor(b); yield 0.4;
          yield* scenery(b, 1); yield* stroll(b);
          yield* blackout(b, 1); yield* birds(b, rnd() < 0.5 ? -1 : 1, 3);
          yield* flood(b, ['L']); yield* flood(b, ['R'], 1.5); yield* trapdoor(b); yield* stroll(b);
          yield* encore(b); yield* scenery(b, 2); yield* knives(b, 5);
        }
      } },
      { at: 0.67, *enter(b) {
        const S = b.state, p = G.player; Sound.sfx('bell', 1, 0.7); S.gesture = 1; b.autoFace = false;
        Hz.rect(0, -HZ, 0, HZ * 2, PIT * 2 + 0.6, 2.2, 0, { color: ROSE, tag: 'fight' });
        Co.start(function* () { yield* b.turnTo(PI / 2, 0.3); yield* b.moveTo(8, -1, 9); b.autoFace = true; }, 'fight');
        yield 2.2; Sound.sfx('bigboom', 0.8); FX.shake(0.9); FX.flash(ROSE, 0.3, 2);
        setAct(b, 1); Co.start(Post.lerpTo({ tint: [1.08, 0.94, 0.98], bloom: 0.58 }, 2.5), 'fight'); S.back.color.set(0xff5070);
        yield* W.tween(1.5, (k) => { S.pitY = k; }); yield 0.4;
      }, *run(b) {
        const S = b.state; setAct(b, 1); S.pitY = 1; b.autoFace = true;
        while (true) {
          yield* flourish(b); yield* knives(b, 4); yield* stroll(b);
          yield* pirouette(b); yield* sandbags(b, 3); yield* flourish(b);
          yield* blackout(b, 2, 4.2); yield* stroll(b);
          yield* flood(b, [rnd() < 0.5 ? 'F' : 'B']); yield* birds(b, -1, 3); yield* pirouette(b);
          yield* encore(b); yield* scenery(b, 2); yield* stroll(b);
        }
      } },
      { at: 0.34, *enter(b) {
        const S = b.state; b.autoFace = false; S.gesture = 1;
        yield* b.cast({ name: 'Curtain', time: 2.2, onTick: (k) => { FX.shake(k * 0.4); S.pitY = 1 - k; } }); S.pitY = 0;
        setAct(b, 2); Sound.sfx('shatter'); Sound.sfx('roar', 0.8, 0.5); FX.flash(VIO, 0.6, 1.2); FX.shake(1.2);
        for (const L of S.layers) FX.burst(L.m.position.x + rnd(-12, 12), L.m.position.y, L.m.position.z, { n: 40, color: 0xffb060, color2: 0xff3010, speed: [2, 10], up: 4, grav: 5, life: [0.8, 1.8], size: [0.2, 0.6], radius: 8 });
        Co.start(Post.lerpTo({ tint: [1.08, 0.93, 0.97], bloom: 0.48, threshold: 0.92, exposure: 1.04 }, 2), 'fight'); S.back.color.set(VIO); S.back.intensity = 140;
        const d1 = S.dolls[1]; d1.drop = 1; yield* W.tween(1.8, (k) => { S.burn = k; d1.drop = 1 - k; for (const H of S.hands) H.g.position.y = lerp(30, H.home.y, k); }); b.autoFace = true; yield 0.4;
      }, *run(b) {
        const S = b.state; setAct(b, 2); S.burn = 1; S.pitY = 0; b.autoFace = true; for (const H of S.hands) if (H.g.position.y > 20) H.g.position.copy(H.home);
        while (true) {
          yield* slam(b, 3); yield* flood(b, [rnd() < 0.5 ? 'L' : 'R', rnd() < 0.5 ? 'F' : 'B'], 1.9); yield* trapdoor(b, 1.1);
          yield* knives(b, 6, 0.6); yield* stroll(b);
          yield* blackout(b, 2, 4.4); yield* slam(b, 2);
          yield* scenery(b, 2); yield* birds(b, rnd() < 0.5 ? -1 : 1, 3);
          yield* encore(b); yield* flood(b, ['L']); yield* flood(b, ['F'], 1.4); yield* slam(b, 3); yield* stroll(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, dl = dolls(S);
      // anything that lands on an understudy lands on you
      if (p.alive && G.state === 'fight') {
        for (const h of Hz.list) if (h.state === 'fired' && !h._d && h.dmg) { h._d = 1; if (p.lastHurt === G.now) continue; for (const d of dl) { const q = dpos(d, _b2); if (Hz.inShape(h.shape, q.x, q.z) !== !!h.invert) { dollHurt(b, d, h.dmg, { blockable: h.blockable }); break; } } }
        S.dz -= dt; if (S.dz <= 0) { S.dz = 0.5; for (const d of dl) { const q = dpos(d, _b2); for (const h of Hz.list) if (h.state === 'zone' && h.dmg && Hz.inShape(h.shape, q.x, q.z)) { dollHurt(b, d, h.dmg, { dot: true, blockable: false }); break; } } }
        for (const bl of Bul.list) { if (bl.t < 0.08 || bl.dead) continue; for (const d of dl) { const q = dpos(d, _b2); if (Math.hypot(q.x - bl.x, q.z - bl.z) < bl.r + 0.4) { bl.dead = true; dollHurt(b, d, bl.dmg); break; } } }
      }
      for (const f of S.flats) { if (f.hold > 0) { f.hold -= dt; if (f.hold <= 0) f.tx = f.sx * 30; } f.x = damp(f.x, f.tx, f.hold > 0 ? 14 : 3, dt); }
      if (G.headless) return;
      for (const f of S.flats) f.m.position.x = f.x;
      S.twang = Math.max(0, S.twang - dt * 3); S.gesture = Math.max(0, S.gesture - dt * 1.2);
      // understudies copy the player's body
      const pm = p.model;
      for (const d of S.dolls) {
        if (!d.on) continue; const q = dpos(d, _b2), M = d.M, drop = (d.drop || 0) * 16;
        M.group.position.set(q.x, p.pos.y + drop, q.z); M.group.rotation.y = d.mode === 'x' ? -p.facing : PI - p.facing; M.group.scale.x = -1;
        d.fake.moveSpeed = p.moveSpeed; d.fake.grounded = p.grounded; d.fake.casting = p.casting; d.fake.parryT = p.parryT; d.fake.rollT = p.rollT; d.fake.aimT = p.aimT; d.fake.loadT = p.loadT; d.fake.flashT = p.flashT;
        M.anim.swing = pm.anim.swing; M.anim.swingDur = pm.anim.swingDur; M.anim.swingKind = pm.anim.swingKind; M.update(dt, d.fake); if (pm.anim.swing > 0) M.anim.swing = pm.anim.swing;
        d.bar.position.set(q.x, 8.5 + drop + Math.sin(t * 2 + q.x) * 0.1, q.z); d.bar.rotation.y = M.group.rotation.y;
        const A = d.ln.geometry.attributes.position.array, tw = S.twang * 0.15; let k = 0;
        for (const [ox, oy, oz] of [[0.35, 1.5, 0], [-0.35, 1.5, 0], [0, 2.05, 0], [0, 1.0, -0.2]]) { const c = Math.cos(M.group.rotation.y), s = Math.sin(M.group.rotation.y), wx = q.x + ox * c + oz * s, wz = q.z - ox * s + oz * c; A[k++] = wx + (vrand() - 0.5) * tw; A[k++] = p.pos.y + oy + drop; A[k++] = wz; A[k++] = q.x + ox * c * 1.6; A[k++] = 8.5 + drop; A[k++] = q.z - ox * s * 1.6; }
        d.ln.geometry.attributes.position.needsUpdate = true; d.ln.material.opacity = 0.55 + S.twang * 0.45;
      }
      // the boss: a marionette, dangling and swinging
      const cast = b.castState ? 1 : 0, ges = Math.max(S.gesture, cast * 0.7);
      const vx = (b.pos.x - S.lx) / Math.max(dt, 1e-3), vz = (b.pos.z - S.lz) / Math.max(dt, 1e-3); S.lx = b.pos.x; S.lz = b.pos.z;
      const fy = b.group.rotation.y, fwd = clamp(vx * Math.sin(fy) + vz * Math.cos(fy), -12, 12), side = clamp(vx * Math.cos(fy) - vz * Math.sin(fy), -12, 12);
      S.sw = damp(S.sw || 0, fwd, 4, dt); S.ss = damp(S.ss || 0, side, 4, dt);
      S.rig.position.y = 0.35 + Math.sin(t * 1.5) * 0.14; S.rig.rotation.z = Math.sin(t * 0.8) * 0.04 - S.ss * 0.012; S.rig.rotation.x = S.sw * 0.02; if (S.spin) S.rig.rotation.y += dt * 14; else S.rig.rotation.y = damp(S.rig.rotation.y % TAU, 0, 8, dt);
      S.head.rotation.z = Math.sin(t * 1.1) * 0.12 + ges * 0.15; S.head.rotation.x = -ges * 0.2;
      for (const A of S.arms) { A.sh.rotation.set(-0.4 - ges * (A.sx > 0 ? 2.2 : 0.9) + Math.sin(t * 1.7 + A.sx) * 0.1, 0, A.sx * (0.4 + ges * 0.5)); A.el.rotation.x = -0.8 + ges * 0.5 + Math.sin(t * 2.3 + A.sx * 2) * 0.1; }
      S.tails.rotation.x = 0.08 + Math.min(0.9, Math.abs(S.sw) * 0.08) + (S.spin ? 0.6 : 0) + Math.sin(t * 1.9) * 0.05; S.tail.forEach((tp, i) => { tp.rotation.z = Math.sin(t * 2.4 + i * 1.7) * 0.07 + S.ss * 0.02 + (i ? 1 : -1) * (S.spin ? 0.35 : 0.04); });
      S.legs.forEach((lg, i) => { lg.rotation.x = Math.sin(t * 2.1 + i * 2.5) * 0.12 - S.sw * 0.03; lg.rotation.z = (i ? 1 : -1) * 0.04; });
      S.cross.rotation.set(-ges * 0.3 + Math.sin(t * 1.1) * 0.05 + S.sw * 0.015, S.rig.rotation.y, Math.sin(t * 0.8) * 0.08 - S.ss * 0.02); S.cross.position.y = 9.0 + Math.sin(t * 1.5) * 0.14 + ges * 0.4;
      const pulse = 0.5 + 0.5 * Math.sin(t * 9);
      S.trim.emissiveIntensity = 0.1 + cast * (0.22 + 0.18 * pulse); S.eyeM.color.setHex(VIO).multiplyScalar(1.5 + cast * 1.1);
      _c.setRGB(0.42, 0.34, 0.95); _c2.setRGB(1.2, 0.75, 0.35); S.rimU.value.copy(_c).lerp(_c2, cast * (0.55 + 0.25 * pulse));
      { S.rig.updateWorldMatrix(true, true); S.cross.updateWorldMatrix(false, true); const A = S.bossStr.geometry.attributes.position.array; let k = 0;
        const seg = (o1, o2) => { o1.getWorldPosition(_w); A[k++] = _w.x; A[k++] = _w.y; A[k++] = _w.z; if (o2.isVector3) _w2.copy(o2); else o2.getWorldPosition(_w2); A[k++] = _w2.x; A[k++] = _w2.y; A[k++] = _w2.z; };
        seg(S.xa[0], S.arms[0].glove); seg(S.xa[1], S.arms[1].glove); seg(S.xa[2], S.hatTop); seg(S.xa[3], S.backA);
        seg(S.xa[4], S.act === 2 ? _a.copy(S.hands[0].g.position).add(_b2.set(0, -0.6, 0)) : _a.set(b.pos.x, 26, b.pos.z));
        S.bossStr.geometry.attributes.position.needsUpdate = true; S.bossStr.material.opacity = S.act === 2 ? 0.75 : 0.45; }
      S.fan.visible = !!S.fanOn && !b.dead;
      // light: act looks blend, blackout is a designed blue-black
      S.a1 = damp(S.a1, S.act === 1 ? 1 : 0, 2.5, dt); S.a2 = damp(S.a2, S.act === 2 ? 1 : 0, 2.5, dt);
      const dk = S.darkK = damp(S.darkK || 0, S.dark, 6, dt), L0 = LOOK[0], L1 = LOOK[1], L2 = LOOK[2], w0 = Math.max(0, 1 - S.a1 - S.a2);
      const mix3 = (out, i) => out.setHex(L0[i]).multiplyScalar(w0).add(_c2.setHex(L1[i]).multiplyScalar(S.a1)).add(_c2.setHex(L2[i]).multiplyScalar(S.a2));
      const num = (i) => L0[i] * w0 + L1[i] * S.a1 + L2[i] * S.a2;
      S.limeK = Math.max(0, S.limeK - dt * 1.8); mix3(S.key.color, 0); S.key.color.lerp(_c.setRGB(1, 0.97, 0.9), S.limeK); S.key.intensity = num(1) * (1 - dk * 0.94) + S.limeK * S.limeK * 2.6;
      for (const q of S.wash) { if (q.t <= 0) continue; q.t -= dt / 0.75; q.m.visible = q.t > 0; q.m.material.uniforms.uA.value = Math.pow(Math.max(q.t, 0), 1.3) * 1.1; q.m.material.uniforms.uT.value = G.now % 100; }
      _kd.set(...L0[2]).multiplyScalar(w0).add(_kd2.set(...L1[2]).multiplyScalar(S.a1)).add(_kd2.set(...L2[2]).multiplyScalar(S.a2)).normalize(); S.key.position.copy(_kd).multiplyScalar(80);
      mix3(S.hemi.color, 3); S.hemi.color.lerp(_c.setHex(0x1a2a6a), dk * 0.85); mix3(S.hemi.groundColor, 4); S.hemi.groundColor.lerp(_c.setHex(0x04050c), dk); S.hemi.intensity = num(5) * (1 - dk * 0.6);
      S.back.intensity = (S.act === 2 ? 140 : 120) * (1 - dk * 0.75); S.foot.intensity = num(6) * (1 - dk * 0.92) * (0.95 + Math.sin(t * 11) * 0.03); S.footGlow.uniforms.uA.value = 1 - dk * 0.8;
      mix3(S.fogC, 7); S.fogC.lerp(_c.setHex(0x03050e), dk); mix3(_c, 8); for (const fm of S.floorM) fm.color.copy(_c).lerp(_c2.setHex(0x5a6aa0), dk * 0.5);
      S.hallM.color.setHex(0x0a0508).lerp(_c.setHex(0x0e0820), S.a2);
      _c.setRGB(1, 1, 1).lerp(_c2.setHex(0x18223f), dk * 0.92); S.skyP.material.color.copy(_c); S.skyP.material.emissiveIntensity = 0.5 * (1 - dk * 0.9); for (const L of S.layers) { L.m.material.color.copy(_c).lerp(_c2.setHex(0x5a2010), dk * (S.burn || 0) * 0.6); L.m.material.emissiveIntensity = 0.12 * (1 - dk * 0.85) + dk * (S.burn || 0) * 0.05; } for (const H of S.hung) { H.m.material.color.copy(_c); H.m.material.emissiveIntensity = (H.em || 0.25) * (1 - dk * 0.9); }
      const tu = (G.now % 100);
      const BS = S.black && S.black.spots; for (let i = 0; i < S.cones.length; i++) { const c = S.cones[i], pl = S.spotPools[i], on = !!BS && i < BS.length; c.visible = pl.visible = on; if (!on) continue; c.position.set(BS[i].x, 6.6, BS[i].z); pl.position.set(BS[i].x, 0.04, BS[i].z); const U = c.material.uniforms; U.uA.value = 0.6 + dk * 0.6 + Math.sin(t * 5 + c.position.x) * 0.04; U.uT.value = tu; pl.material.uniforms.uA.value = 0.16 + dk * 0.3; }
      S.bpool.position.set(b.pos.x, 0.03, b.pos.z); S.bpool.material.uniforms.uA.value = (0.07 + cast * 0.13 + S.a1 * 0.03) * (1 - dk);
      // scenery: night -> blood sunset -> the theatre burning down
      if (S.skyP.material.map !== S.skyT[S.a1 > 0.5 ? 1 : 0]) S.skyP.material.map = S.skyP.material.emissiveMap = S.skyT[S.a1 > 0.5 ? 1 : 0];
      const tt = S.townT[S.a2 > 0.3 ? 2 : S.a1 > 0.5 ? 1 : 0]; if (S.townL.m.material.map !== tt) S.townL.m.material.map = S.townL.m.material.emissiveMap = tt;
      S.starG.position.set(-2 + Math.sin(t * 0.25) * 1.2, 10.0 + Math.min(1, S.a1 + S.a2) * 17, -14.2); S.starG.visible = S.a1 + S.a2 < 0.97; S.starG.rotation.z = Math.sin(t * 0.4) * 0.03; S.stars.forEach((st, i) => { st.rotation.z = Math.sin(t * 1.3 + i * 1.9) * 0.25; }); S.starM.emissiveIntensity = 0.22 * (1 - dk * 0.9);
      const burn = S.burn || 0; S.moon.position.y = 11.5 + S.a1 * 10; S.moon.visible = S.a1 < 0.98 && burn < 0.7;
      for (const H of S.hung) { H.m.position.y = H.y + (1 - S.a1) * 16; H.m.visible = S.a1 > 0.02; }
            for (const L of S.layers) { L.m.position.x = L.amp ? Math.sin(t * L.sp) * L.amp * (1 - burn * 0.7) : 0; L.m.position.y = L.y0 + L.dy * burn + Math.sin(t * 0.7 + L.y0) * 0.08 * burn; L.m.rotation.z = L.rz * burn + Math.sin(t * 0.9 + L.y0 * 3) * 0.012 * burn; }
      S.skyP.visible = burn < 0.7; S.lime.visible = S.embers.visible = burn > 0.05; for (const f of S.fires) f.visible = burn > 0.05;
      S.fireM.uniforms.uA.value = burn * (1 - dk * 0.67); S.fireM.uniforms.uD.value = dk; S.fireM.uniforms.uT.value = tu; S.fireL.intensity = burn * (55 + 22 * Math.sin(t * 13) + 12 * Math.sin(t * 7.3)) * (1 - dk * 0.7);
      if (S.lime.visible) { S.limeCone.material.uniforms.uA.value = 0.32 * burn * (1 - dk * 0.6); S.limeCone.material.uniforms.uT.value = tu; }
      for (const hp of S.hotPools) { hp.visible = burn > 0.05; hp.material.uniforms.uA.value = 0.1 * burn * (1 - dk); }
      S.gEye.color.setHex(VIO).multiplyScalar(0.1 + burn * (1.8 + Math.sin(t * 2) * 0.5)); S.gL.intensity = burn * 90;
      S.centre.position.y = -0.6 - S.pitY * 9; S.fascia.visible = S.pitY > 0.02; for (let i = 0; i < S.pitWaves.length; i++) S.pitWaves[i].position.z = 0.4 + Math.sin(t * (0.8 + i * 0.2) + i * 2) * 1.2;
      for (const H of S.hands) { if (!S.giant.visible) break; H.g.position.lerp(H.tgt, 1 - Math.exp(-(H.fast ? 30 : 2.5) * dt)); H.g.position.y += Math.sin(t * 1.2 + H.sx) * 0.01; H.g.rotation.z = H.sx * (H.fast ? 0.05 : 0.3 + Math.sin(t * 0.9 + H.sx) * 0.08); }
      // paper birds on the bird bullets
      { let n = 0; for (const bl of Bul.list) { if (!bl.bird || n >= 48) continue; const s = bl.r * 4.5 * (bl.t < 0.15 ? bl.t / 0.15 : 1), fl = Math.sin(t * 13 + bl.z * 1.7); _m.position.set(bl.x, bl.y + 0.46, bl.z); _m.rotation.set(0, bl.dir, 0); _m.scale.set(s, s * (0.45 + 0.55 * Math.abs(fl)), s); _m.updateMatrix(); S.birds.setMatrixAt(n++, _m.matrix); } S.birds.count = n; if (n) S.birds.instanceMatrix.needsUpdate = true; }
      // knives in flight, then quivering in the boards
      for (const K of S.kn) { if (!K.visible) continue; const u = K.userData; if (!u.fr || G.now > u.end) { K.visible = false; continue; } const k = (G.now - u.t0) / u.dur;
        K.userData0.visible = k < 1; if (k < 1) { K.position.lerpVectors(u.fr, u.to, k); K.position.y += Math.sin(k * PI) * 0.4; K.lookAt(u.to); } else { if (!u.landed) { u.landed = 1; FX.burst(u.to.x, 0.2, u.to.z, { n: 9, color: 0x9a6a38, color2: 0x3a2010, speed: [2, 5], up: 3, grav: 9, life: [0.3, 0.6], size: [0.08, 0.18] }); } _w.copy(u.to).sub(u.fr); _w.y = 0; _w.normalize().multiplyScalar(0.5); _w.y = -1.6; _w.normalize(); K.position.set(u.to.x, 0, u.to.z).addScaledVector(_w, -1.0); K.lookAt(_w2.copy(K.position).add(_w)); K.rotateZ(Math.sin(t * 60) * Math.max(0, 0.3 - (k - 1) * 0.6)); } }
      // curtains dissolve when they stand between the camera and the play
      { const C = camera.position, zc = HZ + 1.1;
        for (const cu of S.curt) { let hit = (Math.abs(C.z - zc) < 1.6 && C.x * cu.sx > 11) || (C.z > zc && C.x * cu.sx > 8.5);
          if (!hit) for (const [tx, ty, tz] of [[p.pos.x, 1.2, p.pos.z], [p.pos.x - 3.5, 0, p.pos.z], [p.pos.x + 3.5, 0, p.pos.z], [p.pos.x, 0, p.pos.z + 3], [b.pos.x, 2.5, b.pos.z]]) { const dz = tz - C.z; if (Math.abs(dz) < 1e-3) continue; const k = (zc - C.z) / dz; if (k <= 0 || k >= 1) continue; const x = C.x + (tx - C.x) * k, y = C.y + (ty - C.y) * k; if (x * cu.sx > 12.0 && x * cu.sx < 18.8 && y < 16) { hit = true; break; } }
          cu.a = damp(cu.a, hit ? 0.0 : 1, 6, dt); cu.cutU.value = lerp(7.6, -9.5, cu.a); for (const m of cu.mats) { m.opacity = clamp(cu.a * 1.6 - 0.6, 0, 1); m.depthWrite = cu.a > 0.97; }
          cu.b = damp(cu.b, C.x * cu.sx > 8 && C.z > -2 ? 0.0 : 1, 6, dt); cu.legU.value = lerp(7.6, -9.5, cu.b); cu.wing.visible = cu.b > 0.5; } }
    },
    danger(b, x, z) {
      const S = b.state; let best = Infinity;
      for (const d of dolls(S)) { const m = mir(d, x, z, _a); best = Math.min(best, Hz.threat(m.x, m.z)); if (Hz.persist(m.x, m.z)) best = 0; if (Bul.threat(m.x, m.z, 0.7)) best = Math.min(best, 0.5); }
      if (S.black) { const B = S.black; if (Math.hypot(x - B.q.x, z - B.q.z) > B.r - 1.0) best = Math.min(best, Math.max(0, B.at - G.now)); }
      return best;
    },
    bot(b, p) {
      const S = b.state, h = {};
      if (S.black) return { x: S.black.q.x, z: S.black.q.z, w: 3 };
      if (S.split) { const side = p.pos.z >= b.pos.z ? 1 : -1, off = p.cls.melee ? b.radius + 1.7 : 6; let tz = b.pos.z + side * off; if (Math.abs(tz) > HZ - 1) tz = b.pos.z - side * off; h.x = -b.pos.x; h.z = tz; h.w = 1.5; }
      return h;
    },
  });
})();
