// DOOR XIV: NIAN, the Year-Eater. A lantern festival on a night lake. Sparks race along fuses; you choose which shells go up.
(() => {
  const R = 19, MR = 17, NM = 8, GOLD = 0xffc840, RED = 0xff4838;
  const TYPES = { peony: 0xff4444, ring: 0xffc840, willow: 0x58e070, cross: 0x58a8ff, comet: 0xc878ff };
  const PAIR = { 0xff4444: 0xffc840, 0xff5050: 0xffc840, 0xffc840: 0xff4838, 0x58e070: 0xffffff, 0x58a8ff: 0xffffff, 0xc878ff: 0xffc840, 0xff8a40: 0xff3020 }, _c2 = new THREE.Color(), _v2 = new THREE.Vector2(), _a = new V3(), _b = new V3(), _c = new THREE.Color(), _m = new THREE.Object3D(), _w = new THREE.Color(1, 1, 1);
  const mAng = (k) => k * PI / 4 + PI / 8, mPos = (k, r = MR) => [Math.sin(mAng(k)) * r, Math.cos(mAng(k)) * r];

  // ---------- look: helpers, palette, phase moods ----------
  const _m4 = new THREE.Matrix4(), _m5 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3(), _up = new V3(0, 1, 0);
  function T(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { geo.applyMatrix4(_m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); return geo; }
  function mergeC(list) { // [[geo, hex], ...] -> one geometry with vertex colours
    let n = 0; const gs = list.map(([g, c]) => { const q = g.index ? g.toNonIndexed() : g; if (q !== g) g.dispose(); if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return [q, c === undefined ? 0xffffff : c]; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = new Float32Array(n * 3); let o = 0;
    for (const [q, c] of gs) { const k = q.attributes.position.count; P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); if (q.attributes.uv) U.set(q.attributes.uv.array, o * 2); _c.setHex(c); for (let i = 0; i < k; i++) C.set([_c.r, _c.g, _c.b], (o + i) * 3); o += k; q.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeBoundingSphere(); return g;
  }
  function lockGeo(len, rad, curl) { // tapered fur lock, base at the origin, curling toward -z, darker gold toward the tip
    const g = new THREE.ConeGeometry(rad, len, 6, 6, true); g.translate(0, len / 2, 0); const P = g.attributes.position, C = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), t = y / len; P.setX(i, P.getX(i) * (1 - t * 0.15)); P.setZ(i, P.getZ(i) * 0.7 - curl * t * t * len); C.set([lerp(1, 0.82, t * t), lerp(1, 0.6, t * t), lerp(1, 0.3, t * t)], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeVertexNormals(); return g; }
  const flipV = (g) => { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setY(i, 1 - u.getY(i)); return g; };
  const MOON = new V3(0.42, 0.13, -0.9).normalize(), MOON_AZ = Math.atan2(MOON.x, MOON.z), ARCH_A = -2.35;
  const FUR = 0xf1e7d2, JADE = 0x1f7a5a, BLK = 0x0c0a0a, IVORY = 0xf4ecd0, LACQ = 0x8a1410, GFUR = 0xd09a2c;
  const PAL = [0xff5050, 0xffc840, 0x58e070, 0x58a8ff, 0xc878ff, 0xff8a40, 0xffffff];
  const MOOD = {
    top: [0x050716, 0x0c0618, 0x070201], hor: [0x262a5c, 0x3a1638, 0x5a1804], fog: [0x0e1430, 0x180c20, 0x120604],
    hemiS: [0x5a6aa8, 0x4a3452, 0x6a3a18], hemiG: [0x2a1810, 0x3a1410, 0x200a04], lamp: [0xff8a44, 0xd87a58, 0xffb050],
    lanCol: [0xd83a14, 0xe0200c, 0xff6a10], lanHot: [0xffc070, 0xff9a58, 0xffe0a8], halo: [0xff8030, 0xff4020, 0xffb040], skyL: [0xff9a48, 0xff7040, 0xffc060],
    cloudCol: [0x283050, 0x4a2040, 0x3a1408], cloudDark: [0x04050c, 0x08040a, 0x060101], warm: [0xff8a40, 0xff4a30, 0xffa030], red: [0x000000, 0x1a0306, 0x2a0802],
    rim: [0x1c2a58, 0x6a3020, 0x5a2a08], moon: [0xd8e0f2, 0xf0c8c0, 0xffa060], seaSun: [0xa8b4e0, 0xd0a0b8, 0xffb060], seaSky: [0x1c2650, 0x2a1838, 0x3a1206], seaGlow: [0x081020, 0x100814, 0x200804], smoke: [0x000000, 0x3a0c08, 0x6a1a08],
    hemiI: [0.5, 0.4, 0.36], lampI: [55, 36, 64], lanI: [1.0, 1.04, 1.12], cloud: [0.12, 0.2, 0.28], warmK: [0.3, 0.36, 0.5], heat: [0, 0.55, 1], smokeA: [0, 0.35, 0.85],
    swing: [0.05, 0.16, 0.26], ambA: [5, 1.6, 0.35], ambB: [8, 3, 0.9], dim: [0.42, 0.6, 0.8], ember: [0, 0.35, 1], paper: [0, 0.45, 1],
  };
  const MC = {}; for (const k in MOOD) if (!['hemiI', 'lampI', 'lanI', 'cloud', 'warmK', 'heat', 'smokeA', 'swing', 'ambA', 'ambB', 'dim', 'ember', 'paper'].includes(k)) MC[k] = MOOD[k].map((h) => new THREE.Color(h));
  const POST = [{ bloom: 0.56, sat: 1.12, contrast: 1.06, exposure: 1.06, vig: 1.05, tint: [1.04, 0.99, 0.95] }, { bloom: 0.62, sat: 1.18, contrast: 1.09, exposure: 1.08, vig: 1.08, tint: [1.04, 0.97, 0.98] }, { bloom: 0.66, sat: 1.16, contrast: 1.18, exposure: 1.05, vig: 1.2, tint: [1.1, 0.98, 0.82] }];

  const NOISE = 'float fh21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }\nfloat fn2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(fh21(i),fh21(i+vec2(1.0,0.0)),f.x),mix(fh21(i+vec2(0.0,1.0)),fh21(i+vec2(1.0,1.0)),f.x),f.y); }\n';
  const RIM = '{ vec3 vv=vViewPosition/max(length(vViewPosition),1e-4); float fr=1.0-clamp(abs(dot(normal,vv)),0.0,1.0); totalEmissiveRadiance+=uRimC*fr*fr*fr; }';
  function rimify(mat, S, key) { mat.onBeforeCompile = (sh) => { sh.uniforms.uRimC = S.rimC; sh.fragmentShader = 'uniform vec3 uRimC;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + RIM); }; mat.customProgramCacheKey = () => 'fest' + key; return mat; }
  // boss see-through: an ordered-dither window around the player's screen position, only for fragments in front of the player (opaque, single layer)
  const WIN = 'float winRim=0.0; { if (vViewPosition.z < uWin.w) { float wd=length(gl_FragCoord.xy-uWin.xy); float wk=1.0-smoothstep(uWin.z*0.4,uWin.z,wd); ivec2 bq=ivec2(mod(gl_FragCoord.xy,4.0)); float by=(float(BAYER4[bq.x+bq.y*4])+0.5)/16.0; if (wk>0.0 && by<wk*0.85) discard; winRim=smoothstep(0.0,0.08,wk)*(1.0-smoothstep(0.08,0.28,wk)); } }';
  function winify(mat, S) { const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey; mat.transparent = false; mat.onBeforeCompile = (sh, rr) => { if (prev) prev.call(mat, sh, rr); sh.uniforms.uWin = S.winU; sh.fragmentShader = 'uniform vec4 uWin; const int BAYER4[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n' + WIN).replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb*=1.0-winRim*0.7;'); }; const k0 = key.call(mat); mat.customProgramCacheKey = () => 'w' + k0; return mat; }
  // cloth: overlapping fish scales (red, a jade row), gold outlines, gold spine and black-and-gold hem; glowing seams and fiery tears with heat
  const SCALE_FN = 'float fScale(vec2 q, out float dd){ float H=0.34, RR=0.6; float k=floor(q.y/H); float ox=mod(k-1.0,2.0)*0.5; vec2 dv=vec2(q.x-(floor(q.x-ox)+0.5+ox), q.y-(k-1.0)*H); float d=length(dv);\n if (d<RR){ dd=d/RR; return k-1.0; }\n ox=mod(k,2.0)*0.5; dv=vec2(q.x-(floor(q.x-ox)+0.5+ox), q.y-k*H); dd=min(length(dv)/RR,1.0); return k; }\n';
  function clothMat(S, o) {
    const m = new THREE.MeshStandardMaterial({ color: o.color || 0x9a1810, roughness: 0.72, metalness: 0 }), rep = { value: new THREE.Vector2(o.rep[0], o.rep[1]) }, seed = { value: o.seed || 0 }, hem = { value: o.hem };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uHeat: S.heatU, uT: S.tU, uRep: rep, uSeed: seed, uRimC: S.rimC, uHem: hem });
      sh.vertexShader = 'varying vec2 vCU;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCU=uv;');
      sh.fragmentShader = 'uniform float uHeat,uT,uSeed,uHem; uniform vec2 uRep; uniform vec3 uRimC; varying vec2 vCU;\n' + NOISE + SCALE_FN + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec2 clQ=vCU*uRep; float clD; float clK=fScale(clQ,clD);
          float clE=smoothstep(0.80,0.92,clD)*(1.0-smoothstep(0.97,1.0,clD));
          vec3 clC=mod(clK,5.0)<1.0 ? vec3(0.05,0.24,0.15) : diffuseColor.rgb; clC*=0.6+0.4*clD;
          clC=mix(clC,vec3(0.80,0.55,0.17),clE*0.9);
          float clH=vCU.y-uHem; if (clH>0.0 && clH<0.12){ float g1=step(clH,0.022)+step(abs(clH-0.095),0.013); clC=mix(vec3(0.03,0.02,0.02),vec3(0.80,0.56,0.18),clamp(g1,0.0,1.0)); clE=0.0; }
          if (vCU.y<0.06) { clC=vec3(0.74,0.5,0.15); clE=0.0; }
          float clTear=smoothstep(0.0,0.06,fn2(clQ*0.55+uSeed*7.1)-(1.02-max(uHeat-0.55,0.0)*0.7))*step(vCU.y,uHem);
          clC=mix(clC,vec3(0.05,0.01,0.0),clTear); diffuseColor.rgb=clC;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { float fl=0.65+0.35*sin(uT*5.0+clK*1.7+vCU.x*20.0); totalEmissiveRadiance+=vec3(1.0,0.62,0.18)*clE*smoothstep(0.2,0.6,uHeat)*0.5*fl;
            totalEmissiveRadiance+=vec3(1.0,0.36,0.06)*clTear*(0.5+0.3*sin(uT*9.0+clQ.x*3.0)); }
          ${RIM}`);
    };
    m.customProgramCacheKey = () => 'festCloth'; return winify(m, S);
  }
  function fringeMat(S, seed) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide, transparent: true }), sd = { value: seed }; m.forceSinglePass = true;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uT: S.tU, uSeed: sd, uRimC: S.rimC });
      sh.vertexShader = 'uniform float uT,uSeed; varying vec2 vFR;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFR=uv; { float hang=1.0-uv.y; transformed.x+=sin(uT*6.0+uv.x*60.0+uSeed)*0.04*hang; transformed.z+=cos(uT*5.0+uv.x*47.0)*0.04*hang; }');
      sh.fragmentShader = 'uniform float uSeed; uniform vec3 uRimC; varying vec2 vFR;\n' + NOISE + sh.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\n{ float st=vFR.x*140.0; float id=floor(st); float fs=fract(st); float L=0.55+0.45*fh21(vec2(id,uSeed)); if (fs>0.7 || 1.0-vFR.y>L) discard; float k=mod(id,6.0); vec3 c=k<1.0 ? vec3(0.8,0.1,0.05) : (k<3.0 ? vec3(0.9,0.62,0.2) : vec3(0.92,0.88,0.78)); diffuseColor.rgb=c*(0.7+0.3*(1.0-abs(fs-0.35)*2.0)); }')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + RIM);
    };
    m.customProgramCacheKey = () => 'festFringe'; return winify(m, S);
  }
  // billboards (also used instanced): soft halo and the spark's star
  const BB_VERT = 'uniform float uSz; varying vec2 vU; varying float vSeed;\nvoid main(){ mat4 im=mat4(1.0);\n#ifdef USE_INSTANCING\nim=instanceMatrix;\n#endif\nmat4 mm=modelMatrix*im; vec4 c=mm*vec4(0.0,0.0,0.0,1.0); float s=length(mm[0].xyz)*uSz; vec4 mv=viewMatrix*c; mv.xy+=position.xy*s; vU=position.xy; vSeed=c.x*1.7+c.z*2.3; gl_Position=projectionMatrix*mv; }';
  const haloMat = (col, sz) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uCol: { value: new THREE.Color(col) }, uSz: { value: sz } }, vertexShader: BB_VERT,
    fragmentShader: 'uniform vec3 uCol; varying vec2 vU; varying float vSeed; void main(){ float a=exp(-dot(vU,vU)*4.0)-0.0183; if (a<=0.0) discard; gl_FragColor=vec4(uCol*a,1.0); }' });
  const sparkleMat = (S, sz = 0.8) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uCol: { value: new THREE.Color(1, 0.42, 0.1) }, uCore: { value: new THREE.Color(1.3, 0.95, 0.55) }, uT: S.tU, uSz: { value: sz } }, vertexShader: BB_VERT,
    fragmentShader: `uniform vec3 uCol,uCore; uniform float uT; varying vec2 vU; varying float vSeed;
      void main(){ float r=length(vU); if (r>1.0) discard; float an=uT*2.5+vSeed; float cs=cos(an), sn=sin(an); vec2 p=mat2(cs,-sn,sn,cs)*vU;
        float rays=(exp(-abs(p.x)*26.0)+exp(-abs(p.y)*26.0))*(1.0-r); float g=max(exp(-r*r*6.0)-0.0025,0.0); float core=exp(-r*r*55.0);
        gl_FragColor=vec4(uCol*g*0.7+uCore*(core*1.1+rays*0.5),1.0); }` });
  // paper lanterns (rail, arch: round; sky: cylinders lit from the flame below)
  function lanternMat(o) {
    return new THREE.ShaderMaterial({ fog: true, uniforms: o.uniforms || THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCol: { value: new THREE.Color(o.col) }, uHot: { value: new THREE.Color(o.hot) }, uT: { value: 0 }, uFl: { value: 0.15 }, uI: { value: 1 }, uMode: { value: o.mode }, uH: { value: o.h } }]),
      vertexShader: 'varying vec3 vN,vW,vL; varying float vId;\n#include <fog_pars_vertex>\nvoid main(){ mat4 im=mat4(1.0);\n#ifdef USE_INSTANCING\nim=instanceMatrix;\n#endif\nvec4 wp=modelMatrix*im*vec4(position,1.0); vW=wp.xyz; vN=mat3(modelMatrix*im)*normal; vL=position; vId=im[3].x*1.7+im[3].z*3.1+modelMatrix[3].x;\nvec4 mvPosition=viewMatrix*wp; gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: `uniform vec3 uCol,uHot; uniform float uT,uFl,uI,uMode,uH; varying vec3 vN,vW,vL; varying float vId;
        #include <fog_pars_fragment>
        ${NOISE}
        void main(){ vec3 n=normalize(vN); vec3 v=normalize(cameraPosition-vW); float f=clamp(abs(dot(n,v)),0.0,1.0);
          float yy=clamp(vL.y/max(uH,1e-3),-1.0,1.0); float lon=atan(vL.x,vL.z+1e-5); float rib=1.0-0.3*smoothstep(0.9,1.0,abs(cos(lon*6.0)));
          float fl=1.0+uFl*(fn2(vec2(uT*7.0,vId))-0.5)*2.0; vec3 col;
          if (uMode<0.5){ float ends=smoothstep(0.72,0.98,abs(yy)); col=mix(uCol*0.5,uHot,pow(f,1.4))*rib*(1.0-0.65*ends); }
          else { float bot=smoothstep(0.6,-1.0,yy); col=mix(uCol*0.45,uHot,clamp(bot*0.8+f*0.3,0.0,1.0))*rib; }
          gl_FragColor=vec4(max(col*fl*uI,vec3(0.0)),1.0);
          #include <fog_fragment>
        }` });
  }
  // fuses: flat braided cords lying under the telegraphs; burnt behind the spark, a faint running glow ahead of it
  function fuse(g, P, S) {
    const n = P.pts.length, w = 0.5, pos = new Float32Array(n * 6), nor = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = [];
    for (let i = 0; i < n; i++) { const a = P.pts[Math.max(0, i - 1)], c = P.pts[Math.min(n - 1, i + 1)]; let tx = c[0] - a[0], tz = c[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const px = -tz * w * 0.5, pz = tx * w * 0.5, [x, z] = P.pts[i];
      pos.set([x + px, 0.03, z + pz, x - px, 0.03, z - pz], i * 6); nor.set([0, 1, 0, 0, 1, 0], i * 6); uv.set([P.L[i], 1, P.L[i], -1], i * 4); if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeBoundingSphere();
    const u = { uS: { value: -1 }, uBurn: { value: -1 } }, m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); m.forceSinglePass = true;
    m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u, { uT: S.tU });
      sh.vertexShader = 'varying vec2 vFU;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFU=uv;');
      sh.fragmentShader = 'uniform float uS,uBurn,uT; varying vec2 vFU;\n' + NOISE + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          float fuM=abs(vFU.y)*0.25, fuX=clamp(fuM/0.09,0.0,1.0), fuE=sqrt(max(1.0-fuX*fuX,0.0)), fuC=1.0-smoothstep(0.088,0.1,fuM), fuO=1.0-smoothstep(0.1,0.112,fuM), fuB=step(vFU.x,uBurn)*step(0.0,uBurn);
          float fuOn=step(0.0,uS), fuAh=step(uS,vFU.x)*fuOn;
          { float sp=vFU.x*22.0+vFU.y*2.2; float aa=clamp(fwidth(sp)*0.6,0.0,1.0); float tw=mix(0.5+0.5*sin(sp),0.5,aa);
            vec3 fc=vec3(0.74,0.6,0.38)*(0.62+0.38*tw)*(0.45+0.55*fuE); fc=mix(vec3(0.03,0.022,0.018),fc,fuC); vec3 ash=mix(vec3(0.17,0.16,0.15),vec3(0.06,0.056,0.052),smoothstep(0.2,0.8,fuE))*(0.7+0.3*tw)*(0.8+0.4*fn2(vec2(vFU.x*6.0,vFU.y*3.0)));
            fc=mix(fc,ash,fuB*fuC); fc=mix(fc,vec3(0.0),fuAh*fuC);
            diffuseColor.rgb=fc; diffuseColor.a=max(fuO,(1.0-smoothstep(0.11,0.25,fuM))*0.55); }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { totalEmissiveRadiance+=vec3(0.74,0.6,0.38)*0.035*fuC*(1.0-fuB)*(1.0-fuAh); totalEmissiveRadiance+=vec3(1.0,0.3,0.05)*fuB*fuC*0.3*smoothstep(0.8,0.95,fn2(vec2(vFU.x*2.3,vFU.y*1.5+uT*0.12)))*(0.5+0.5*sin(uT*2.3+vFU.x*5.0));
            float pulse=0.5+0.5*sin((vFU.x-uT*9.0)*1.4); float bead=smoothstep(0.7,1.0,pulse); vec3 hot=mix(vec3(1.05,0.62,0.16),vec3(1.12,0.92,0.55),smoothstep(0.62,0.95,fuE))*(0.75+0.25*fuE)+vec3(0.35,0.08,0.0)*(1.0-fuE);
            totalEmissiveRadiance+=hot*fuAh*fuC*(0.85+0.4*bead);
            totalEmissiveRadiance+=vec3(1.0,0.4,0.06)*(1.0-step(uS,vFU.x))*fuOn*exp(-max(uS-vFU.x,0.0)*1.4)*0.8*fuC; }`)
        .replace('#include <opaque_fragment>', 'outgoingLight=min(outgoingLight,vec3(0.6,0.48,0.3)+totalEmissiveRadiance);\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'festFuse';
    const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; g.add(mesh); P.u = u; P.burn = -1; return mesh;
  }

  // The ground pattern of a shell from mortar k, always relative to that mortar. Four colours in two pairs of opposites:
  // red (peony) near me is bad, yellow (ring) only near me is safe, blue (cross) my line is bad, green (willow) only my line is safe.
  function shapesOf(type, k) {
    const th = mAng(k) + PI, dx = Math.sin(th), dz = Math.cos(th), px = dz, pz = -dx;
    if (type === 'peony') { const [x, z] = mPos(k, 9); return [{ type: 'circle', x, z, r: 11 }]; }
    if (type === 'ring') { const [x, z] = mPos(k, 10); return [{ type: 'donut', x, z, r0: 5, r1: 30 }]; }
    if (type === 'cross') { const [x, z] = mPos(k, R + 1); return [{ type: 'rect', x, z, dir: th, len: 2 * R + 2, w: 9 }]; }
    if (type === 'willow') return [-1, 1].map((s) => ({ type: 'rect', x: -dx * (R + 2) + px * s * 23.5, z: -dz * (R + 2) + pz * s * 23.5, dir: th, len: 2 * R + 4, w: 40 }));
    return [];
  }
  // ---------- volley planner ----------
  // The floor as a grid of cells. A set of shells is survivable when one connected safe patch of SURV cells is left,
  // impossible when DEAD or fewer cells are left anywhere; nothing in between (a sliver) is ever allowed to decide a volley.
  const GS = 1.25, GRID = [], GI = new Map(), SURV = 20, DEAD = 3, TIGHT = 45, SPD = 7, SPARE = 1.5, RISE = 1.2;
  for (let x = -R + 1, i = 0; x < R; x += GS, i++) for (let z = -R + 1, j = 0; z < R; z += GS, j++) {
    if (Math.hypot(x, z) >= R - 1) continue; let solid = false; for (let k = 0; k < NM; k++) { const [mx, mz] = mPos(k); if (Math.hypot(x - mx, z - mz) < 1.4) solid = true; }
    if (!solid) { GI.set(i * 64 + j, GRID.length); GRID.push([x, z, i, j]); } }
  const NBR = GRID.map(([, , i, j]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, c]) => GI.get((i + a) * 64 + j + c)).filter((n) => n !== undefined));
  const MASK = {}, maskOf = (type, k) => MASK[type + k] || (MASK[type + k] = Uint8Array.from(GRID, (q) => shapesOf(type, k).some((s) => Hz.inShape(s, q[0], q[1])) ? 1 : 0));
  // safe cells left when these mortars fire (purple never counts): { total, big: cell ids of the largest connected safe patch }
  function evalSet(S, set) {
    const ms = set.filter((k) => k >= 0 && S.types[k] !== 'comet').map((k) => maskOf(S.types[k], k)), n = GRID.length, ok = new Uint8Array(n); let total = 0;
    for (let i = 0; i < n; i++) { let f = 1; for (const m of ms) if (m[i]) { f = 0; break; } ok[i] = f; total += f; }
    let big = []; const seen = new Uint8Array(n);
    for (let i = 0; i < n; i++) { if (!ok[i] || seen[i]) continue; const c = [i]; seen[i] = 1; for (let h = 0; h < c.length; h++) for (const j of NBR[c[h]]) if (ok[j] && !seen[j]) { seen[j] = 1; c.push(j); } if (c.length > big.length) big = c; }
    return { total, big };
  }
  const kind = (e) => e.big.length >= SURV ? 'ok' : e.total <= DEAD ? 'dead' : 'sliver';
  const minD = (cells, x, z) => { let d = Infinity; for (const c of cells) { const q = GRID[c], e = Math.hypot(q[0] - x, q[1] - z); if (e < d) d = e; } return d; };
  // From the worst of a few starting points, on foot at speed 7: catch the spark while it is still on its fuse, then reach the
  // patch with SPARE seconds left before the shells land (total seconds after the volley starts).
  const SAMPLES = [[0, 0], [11, 0], [-11, 0], [0, 11], [0, -11]];
  function reachOK(P, Tspark, cells, total) {
    const q = [0, 0];
    for (const s0 of SAMPLES) {
      let best = Infinity;
      if (P) { for (let t = 0.3; t < Tspark - 0.15; t += 0.1) { at(P, P.len * t / Tspark, q); if (Math.hypot(q[0] - s0[0], q[1] - s0[1]) / SPD > t) continue; best = Math.min(best, t + minD(cells, q[0], q[1]) / SPD); } }
      else best = minD(cells, s0[0], s0[1]) / SPD;
      if (best + SPARE > total) return false;
    }
    return true;
  }
  // Where Nian plants himself for Feast: covered by the keeper shell alone, a few metres from the player's patch.
  function feastSpot(S, lit, keep, patch) {
    const km = maskOf(S.types[keep], keep), others = lit.filter((k) => k !== keep).map((k) => maskOf(S.types[k], k)); let best = null, bs = Infinity;
    for (let i = 0; i < GRID.length; i++) { if (!km[i] || others.some((m) => m[i])) continue; const [x, z] = GRID[i]; if (Math.hypot(x, z) > 14) continue; const d = minD(patch, x, z); if (d < 3.5) continue; const s = Math.abs(d - 5.5); if (s < bs) { bs = s; best = [x, z]; } }
    return best;
  }
  // Every lit set this layout allows, sorted into archetypes:
  //  A one answer: all lit is impossible, exactly one stamp makes it survivable.
  //  B Feast: two stamps survive, only one of them leaves the keeper shell that lands on Nian.
  //  C leave it alone: all lit is survivable but tight, stamping wastes the stamp.
  //  D dragon: like C, but the centre spiral burns too and is the spark to stamp.
  const ACT = [
    { T: 8, warn: 1.0, ns: [2, 3], multi: true }, // act 1 also accepts sets where more than one stamp works (like the two yellows)
    { T: 8, warn: 0.5, ns: [3, 4] },
    { T: 8, warn: 0.5, ns: [4, 5], D: true }, // same 8 s to solve in every act; only the puzzles get bigger
  ];
  function buildPools(S, cfg) {
    const pools = { A: [], B: [], C: [], D: [] }, total = cfg.T + RISE + cfg.warn;
    for (let m = 1; m < 1 << NM; m++) {
      const lit = []; let bad = false; for (let k = 0; k < NM; k++) if (m >> k & 1) { if (S.types[k] === 'comet') bad = true; lit.push(k); }
      if (bad || !cfg.ns.includes(lit.length)) continue;
      const all = evalSet(S, lit), ka = kind(all); if (ka === 'sliver') continue;
      const drops = lit.map((k) => { const e = evalSet(S, lit.filter((j) => j !== k)); return { k, e, c: kind(e) }; });
      if (drops.some((d) => d.c === 'sliver')) continue;
      const okd = drops.filter((d) => d.c === 'ok');
      if (ka === 'dead') {
        if (okd.length === 1 || (cfg.multi && okd.length)) { const d = okd[Math.floor(rnd(okd.length))]; if (reachOK(S.fuses[d.k], cfg.T, d.e.big, total)) pools.A.push({ arch: 'A', lit, answer: d.k, safe: d.e.big }); }
        else if (okd.length === 2 && cfg.B) for (const [x, kp] of [[okd[0], okd[1]], [okd[1], okd[0]]]) {
          const spot = feastSpot(S, lit, kp.k, x.e.big); if (spot && reachOK(S.fuses[x.k], cfg.T, x.e.big, total)) pools.B.push({ arch: 'B', lit, answer: x.k, keep: kp.k, spot, safe: x.e.big });
        }
      } else if (all.big.length <= TIGHT) {
        if (reachOK(null, 0, all.big, total)) pools.C.push({ arch: 'C', lit, answer: null, safe: all.big });
        if (cfg.D && reachOK(S.spiral, total + 0.3, all.big, total)) pools.D.push({ arch: 'D', lit, answer: -1, safe: all.big });
      }
    }
    return pools;
  }
  // New colours for every act of every run: two of each, never two of a colour side by side; act 3 trades one for purple.
  function makeLayout(S, n) {
    if (S.layouts && S.layouts[n]) { Object.assign(S, S.layouts[n], { hist: [], lastLit: '', used: {} }); return; }
    const cfg = ACT[n], need = { A: 8, C: n ? n : 0, D: cfg.D ? 3 : 0 }; let best = null, bs = -1;
    for (let t = 0; t < 500 && (!best || t < 120); t++) {
      const cols = ['peony', 'peony', 'ring', 'ring', 'cross', 'cross', 'willow', 'willow']; if (n === 2) cols[rndi(0, 3) * 2] = 'comet';
      const ty = shuffle(cols); if (ty.some((c, k) => c === ty[(k + 1) % NM])) continue;
      S.types = ty; const pools = buildPools(S, cfg); let sc = Infinity; for (const a in need) if (need[a]) sc = Math.min(sc, pools[a].length / need[a]);
      sc = Math.min(sc, new Set(pools.A.map((e) => e.answer)).size / 4); // the answer can't always be the same mortar
      if (sc > bs) { bs = sc; best = { ty, pools }; } if (sc >= 1) break;
    }
    S.types = best.ty; S.pools = best.pools; S.hist = []; S.lastLit = ''; S.used = {};
    if (S.layouts) S.layouts[n] = { types: S.types, pools: S.pools };
  }
  const litKey = (lit) => lit.slice().sort().join(',');
  // weighted archetype pick: never the same archetype three volleys running, only archetypes this layout has
  function nextArch(S, w) {
    const h = S.hist, ok = (a) => S.pools[a] && S.pools[a].some((e) => litKey(e.lit) !== S.lastLit) && !(h.length >= 2 && h[h.length - 1] === a && h[h.length - 2] === a);
    const keys = Object.keys(w).filter(ok); if (!keys.length) return Object.keys(w).find((a) => S.pools[a] && S.pools[a].length) || 'A';
    let r = rnd(keys.reduce((s, a) => s + w[a], 0)); for (const a of keys) { r -= w[a]; if (r <= 0) return a; } return keys[keys.length - 1];
  }
  // a random lit set of that archetype, never the same set twice running, favouring the sets used least this act
  function pickPlan(S, arch) {
    const all = S.pools[arch] || [], used = S.used || (S.used = {}), pool = all.filter((e) => litKey(e.lit) !== S.lastLit), cand = pool.length ? pool : all; if (!cand.length) return null;
    const sc = (e) => (used[litKey(e.lit)] || 0) * 2 + (used['k' + e.answer] || 0), lo = Math.min(...cand.map(sc)), use = cand.filter((e) => sc(e) === lo), pl = use[Math.floor(rnd(use.length))];
    used[litKey(pl.lit)] = (used[litKey(pl.lit)] || 0) + 1; used['k' + pl.answer] = (used['k' + pl.answer] || 0) + 1; return pl;
  }
  // phase 1's fixed opener: each colour alone, a red with a blue that leave room, then two yellows (stamp one)
  function teach(S) {
    const of = (t) => shuffle(S.types.map((x, k) => x === t ? k : -1).filter((k) => k >= 0)), one = (lit) => ({ arch: 'T', lit, answer: null, safe: evalSet(S, lit).big });
    const r = of('peony'), y = of('ring'), bl = of('cross'), gr = of('willow'); let pair = null;
    for (const a of r) for (const c of bl) if (!pair && kind(evalSet(S, [a, c])) === 'ok') pair = [a, c];
    return [one([r[0]]), one([y[0]]), one([bl[0]]), one([gr[0]]), one(pair || [r[1]]), { arch: 'A', lit: y, answer: y[0], safe: evalSet(S, [y[1]]).big }];
  }

  // ---------- polylines ----------
  function polyline(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L, len: L[L.length - 1] }; }
  function at(P, s, out) { s = clamp(s, 0, P.len); let i = 1; while (i < P.L.length - 1 && P.L[i] < s) i++; const t = (s - P.L[i - 1]) / Math.max(1e-6, P.L[i] - P.L[i - 1]); out[0] = lerp(P.pts[i - 1][0], P.pts[i][0], t); out[1] = lerp(P.pts[i - 1][1], P.pts[i][1], t); return out; }
  function bez(p0, p1, p2, n, wig) { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t, w = Math.sin(t * PI * 3) * wig * Math.sin(t * PI); const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], z = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1], tx = p2[0] - p0[0], tz = p2[1] - p0[1], tl = Math.hypot(tx, tz) || 1; pts.push([x - tz / tl * w, z + tx / tl * w]); } return pts; }

  function build(b) {
    const g = G.world, S = b.state;
    S.heatU = { value: 0 }; S.rimC = { value: new THREE.Color(0x1c2a58) }; S.tU = { value: 0 };
    // ---- night sky: gradient and stars from the shared dome, plus our own moon, horizon haze and distant shore
    const sky = W.sky({ top: 0x040612, horizon: 0x1a2250, bottom: 0x020308, stars: 1.6, sunDir: [0, -1, 0], sunColor: 0x000000, sunSize: 0.01, sunGlow: 0, clouds: 0.12, cloudColor: 0x283050, cloudDark: 0x04050c, cloudSpeed: 0.004 });
    g.add(sky); S.sky = sky; W.env(sky, 0.7);
    scene.fog = new THREE.FogExp2(0x0e1430, 0.0028); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x5a6aa8, 0x2a1810, 0.5);
    S.moon = W.sun(g, { dir: [0.45, 0.8, -0.5], color: 0xa8c0ff, intensity: 1.2, size: 30 });
    const follow = (m, d) => { m.frustumCulled = false; m.renderOrder = -50; m.onBeforeRender = () => { m.position.copy(camera.position); if (d) { m.position.addScaledVector(MOON, d); m.quaternion.copy(camera.quaternion); } m.updateMatrixWorld(); }; g.add(m); return m; };
    S.moonM = follow(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uCol: { value: new THREE.Color(0xd8e0f2) }, uHalo: { value: new THREE.Color(0.2, 0.24, 0.36) } },
      vertexShader: 'varying vec2 vU; void main(){ vU=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uCol,uHalo; varying vec2 vU; ${NOISE}
        void main(){ float r=length(vU), R0=0.3; float disc=1.0-smoothstep(R0-0.006,R0,r); vec2 q=vU/R0; float z=sqrt(max(1.0-dot(q,q),0.0));
          float mar=fn2(q*2.2+3.0)*0.55+fn2(q*5.0+1.0)*0.3+fn2(q*12.0)*0.15; vec3 c=uCol*(0.6+0.4*z)*(1.0-smoothstep(0.42,0.68,mar)*0.28);
          float e=max(r-R0,0.0); float halo=(exp(-e*9.0)*0.45+exp(-e*2.6)*0.12)*(1.0-smoothstep(0.85,1.0,r));
          gl_FragColor=vec4(c*disc*0.85+uHalo*halo*(1.0-disc),1.0); }` })), 1400);
    S.moonM.scale.setScalar(240);
    S.atmos = follow(new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.BackSide,
      uniforms: { uWarm: { value: new THREE.Color(0xff8a40) }, uWarmK: { value: 0.22 }, uRed: { value: new THREE.Color(0) }, uFw: { value: new THREE.Color(0) }, uMoonD: { value: MOON }, uMoonC: { value: new THREE.Color(0.16, 0.2, 0.34) } },
      vertexShader: 'varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uWarm,uRed,uFw,uMoonD,uMoonC; uniform float uWarmK; varying vec3 vD;
        void main(){ vec3 d=normalize(vD); float h=d.y, band=exp(-abs(h)*7.0), up=exp(-max(h,0.0)*3.0); float az=atan(d.x,d.z+1e-5);
          float town=0.55+0.45*sin(az*2.0+1.3)*sin(az*3.0+0.4); float md=max(dot(d,uMoonD),0.0);
          vec3 col=uWarm*band*uWarmK*town+uMoonC*pow(md,6.0)*up*0.6+uFw*up+uRed*up*(0.6+0.4*band);
          gl_FragColor=vec4(max(col,vec3(0.0)),1.0); }` })), 0);
    S.water = W.water({ deep: 0x050a18, shallow: 0x0e1c40, sky: 0x1c2650, glow: 0x081020, sunDir: [MOON.x, MOON.y, MOON.z], sunColor: 0xa8b4e0, amp: 0.2, scale: 0.09, speed: 0.5, foam: 0, size: 2400, seg: 240 }); S.water.position.y = -2.2; g.add(S.water);
    // plaza: slate with a worn gold-and-oxblood medallion and wet patches
    const st = W.surface('slabs', { seed: 8, dark: 0x4a4650, light: 0x8a8690 }); for (const k in st) st[k].repeat.set(6, 6);
    const stone = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: 0.6, color: 0xffffff, envMapIntensity: 0.6 }); stone.normalScale.set(0.5, 0.5);
    stone.onBeforeCompile = (sh) => {
      sh.uniforms.uHeat = S.heatU; sh.uniforms.uT = S.tU;
      sh.vertexShader = 'varying vec3 vFW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvFW=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = 'uniform float uHeat,uT; varying vec3 vFW;\n' + NOISE + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          float flR=length(vFW.xz), flA=atan(vFW.x,vFW.z+1e-5); float flW=smoothstep(0.3,0.7,fn2(vFW.xz*0.45+7.0))*0.6+0.4*fn2(vFW.xz*2.7);
          float flOut=smoothstep(13.55,13.65,flR)*(1.0-smoothstep(14.75,14.85,flR)), flIn=smoothstep(8.75,8.85,flR)*(1.0-smoothstep(9.35,9.45,flR));
          float flSeg=flA*1.9098593; float flSd=(0.5-abs(fract(flSeg)-0.5))*0.5235988*flR; float flSpk=(1.0-smoothstep(0.12,0.17,flSd))*step(9.4,flR)*step(flR,13.6);
          float flAc=(floor(flSeg)+0.5)*0.5235988; vec2 flL=vFW.xz-vec2(sin(flAc),cos(flAc))*11.5; vec2 flLL=vec2(dot(flL,vec2(cos(flAc),-sin(flAc))),dot(flL,vec2(sin(flAc),cos(flAc))));
          float flDia=1.0-smoothstep(0.82,0.9,abs(flLL.x)+abs(flLL.y));
          float flWedge=step(0.5,fract(flA*1.27324))*step(1.0,flR)*step(flR,3.6);
          float flChip=step(0.36,flW); float flG=clamp(flOut*0.9+flIn+flDia*0.8,0.0,1.0)*flChip; float flOx=clamp(flSpk+flWedge,0.0,1.0)*flChip;
          float flRed=step(9.4,flR)*step(flR,13.6)*0.35*smoothstep(0.25,0.6,flW);
          float flWet=smoothstep(0.6,0.8,fn2(vFW.xz*0.21+vec2(3.0,1.0)))*0.7;
          vec3 flC=diffuseColor.rgb; flC=mix(flC,flC*vec3(1.05,0.4,0.32),flRed*0.5); flC=mix(flC,vec3(0.40,0.29,0.13),flG*0.5); flC=mix(flC,vec3(0.26,0.08,0.06),flOx*0.45); flC*=1.0-flWet*0.25; diffuseColor.rgb=flC;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.36,max(flWet,flG*0.4));')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float hm=fn2(vFW.xz*0.9+vec2(uT*0.05,0.0)), cr=1.0-smoothstep(0.0,0.05,abs(fn2(vFW.xz*1.6+3.0)-0.5)); totalEmissiveRadiance+=vec3(1.0,0.38,0.06)*flOut*smoothstep(0.7,1.0,uHeat)*((0.08+0.3*hm*hm)+cr*0.35)*(0.85+0.15*sin(uT*3.0+flA*6.0)); }');
    };
    stone.customProgramCacheKey = () => 'festFloor';
    const top = new THREE.Mesh(new THREE.CircleGeometry(R + 1.6, 96), stone); top.rotation.x = -PI / 2; top.receiveShadow = true; g.add(top);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.6, R + 2.4, 3.4, 72, 1, true), W.mat({ color: 0x3a3640, roughness: 0.9 })); drum.position.y = -1.7; g.add(drum);
    const lacq = W.mat({ color: 0x8a1a14, roughness: 0.45 }), goldM = W.mat({ color: 0xd8a840, roughness: 0.38, metalness: 0.75 }), jadeM = W.mat({ color: 0x1a5a44, roughness: 0.5 }), darkM = W.mat({ color: 0x1a0c08, roughness: 0.55 });
    const trim = new THREE.Mesh(new THREE.TorusGeometry(R + 1.6, 0.1, 6, 120), lacq); trim.rotation.x = PI / 2; trim.position.y = -0.04; g.add(trim);
    { const vr = mulberry(31), N = 240, pap = new THREE.InstancedMesh(T(new THREE.PlaneGeometry(0.26, 0.14), 0, 0, 0, -PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), N);
      for (let i = 0; i < N; i++) { const a = vr() * TAU, r = Math.min(R + 1.2, 14.8 + Math.pow(vr(), 0.6) * 6); _m.position.set(Math.sin(a) * r, 0.012 + i * 0.00002, Math.cos(a) * r); _m.rotation.set(0, vr() * TAU, 0); _m.scale.setScalar(0.7 + vr() * 0.8); _m.updateMatrix(); pap.setMatrixAt(i, _m.matrix); pap.setColorAt(i, _c.setHex(vr() < 0.12 ? 0xc89030 : vr() < 0.5 ? 0xa01a10 : 0x701008)); }
      pap.receiveShadow = true; g.add(pap); }
    // railing, sagging lantern string, paper lanterns with caps and tassels
    const NPOST = 24, RL = R + 1.1, LN = NPOST * 2, postI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.2, 2.6, 8), lacq, NPOST), finI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 10, 8), goldM, NPOST);
    for (let i = 0; i < NPOST; i++) { const a = i / NPOST * TAU; _m.rotation.set(0, 0, 0); _m.scale.setScalar(1); _m.position.set(Math.sin(a) * RL, 1.3, Math.cos(a) * RL); _m.updateMatrix(); postI.setMatrixAt(i, _m.matrix); _m.position.y = 2.72; _m.updateMatrix(); finI.setMatrixAt(i, _m.matrix); }
    postI.castShadow = true; g.add(postI); g.add(finI);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(RL, 0.07, 5, 120), lacq); rail.rotation.x = PI / 2; rail.position.y = 2.45; g.add(rail);
    const rail2 = new THREE.Mesh(new THREE.TorusGeometry(RL, 0.05, 5, 120), lacq); rail2.rotation.x = PI / 2; rail2.position.y = 1.1; g.add(rail2);
    { const pts = []; for (let i = 0; i < NPOST * 12; i++) { const a = i / (NPOST * 12) * TAU, t = (i % 12) / 12; pts.push(new V3(Math.sin(a) * RL, 2.78 - 0.42 * Math.sin(PI * t), Math.cos(a) * RL)); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), NPOST * 24, 0.022, 4, true), darkM)); }
    S.lanA = []; for (let i = 0; i < NPOST; i++) for (const t of [0.3, 0.7]) { const a = (i + t) / NPOST * TAU; S.lanA.push({ x: Math.sin(a) * RL, y: 2.78 - 0.42 * Math.sin(PI * t), z: Math.cos(a) * RL, a }); }
    S.lanM = lanternMat({ col: 0xd83a14, hot: 0xffc070, mode: 0, h: 0.34 });
    S.lanBody = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 16, 12), S.lanM, LN); S.lanCap = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.17, 0.07, 10), darkM, LN * 2);
    S.lanTas = new THREE.InstancedMesh(T(new THREE.ConeGeometry(0.05, 0.34, 6), 0, -0.17, 0, PI), W.mat({ color: 0xb01a10, roughness: 0.7 }), LN); S.lanHalo = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), haloMat(0x000000, 1), LN);
    for (const m of [S.lanBody, S.lanCap, S.lanTas, S.lanHalo]) { m.frustumCulled = false; g.add(m); }
    S.lanL = [_m4.clone().compose(_p.set(0, -0.42, 0), _q.identity(), _s.set(1, 1.18, 1)), _m4.clone().compose(_p.set(0, -0.03, 0), _q.identity(), _s.set(1, 1, 1)), _m4.clone().compose(_p.set(0, -0.81, 0), _q.identity(), _s.set(1, 1, 1)), _m4.clone().compose(_p.set(0, -0.84, 0), _q.identity(), _s.set(1, 1, 1)), _m4.clone().compose(_p.set(0, -0.42, 0), _q.identity(), _s.set(1.5, 1.5, 1.5))];
    S.reflM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uCol: { value: new THREE.Color(0) }, uT: S.tU, uL: { value: 7 }, uW: { value: 0.8 } },
      vertexShader: 'uniform float uL,uW; varying vec2 vU; varying float vId;\nvoid main(){ mat4 im=mat4(1.0);\n#ifdef USE_INSTANCING\nim=instanceMatrix;\n#endif\nvec3 c=(modelMatrix*im*vec4(0.0,0.0,0.0,1.0)).xyz; vec2 d=c.xz-cameraPosition.xz; float dl=length(d); d=dl>1e-3 ? d/dl : vec2(0.0,1.0); vec2 pp=vec2(d.y,-d.x);\nvec2 xz=c.xz+pp*position.x*uW+d*position.y*uL; vU=vec2(position.x*2.0,position.y); vId=c.x*1.3+c.z*0.7; gl_Position=projectionMatrix*viewMatrix*vec4(xz.x,c.y,xz.y,1.0); }',
      fragmentShader: `uniform vec3 uCol; uniform float uT; varying vec2 vU; varying float vId; ${NOISE}
        void main(){ float a=exp(-vU.x*vU.x*3.0)*(1.0-vU.y)*(1.0-vU.y); float sh=0.3+0.7*smoothstep(0.25,0.8,fn2(vec2(vU.y*14.0-uT*1.5,vId+vU.x*2.0))); gl_FragColor=vec4(uCol*a*sh,1.0); }` });
    { const rf = new THREE.InstancedMesh(T(new THREE.PlaneGeometry(1, 1), 0, 0.5, 0), S.reflM, LN); rf.frustumCulled = false; S.lanA.forEach((A, i) => { _m.position.set(Math.sin(A.a) * (R + 2.7), -1.96, Math.cos(A.a) * (R + 2.7)); _m.rotation.set(0, 0, 0); _m.scale.setScalar(1); _m.updateMatrix(); rf.setMatrixAt(i, _m.matrix); }); g.add(rf); }
    S.lamps = []; for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4, L = new THREE.PointLight(0xff8040, 55, 34, 1.5); L.position.set(Math.sin(a) * (R - 1), 3.2, Math.cos(a) * (R - 1)); g.add(L); S.lamps.push(L); }
    // pier walkway with a paifang gate, and banner poles with long pennants around the rim
    { const wood = W.surface('wood', { seed: 5, dark: 0x1e140c, light: 0x5a3c24 }); for (const k in wood) wood[k].repeat.set(1, 3); const woodM = new THREE.MeshStandardMaterial({ map: wood.map, normalMap: wood.normalMap, roughness: 0.75 });
      const pier = new THREE.Group(); pier.rotation.y = ARCH_A; g.add(pier);
      const walk = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 21), woodM); walk.position.set(0, -0.27, 30.3); walk.receiveShadow = true; pier.add(walk);
      for (let k = 0; k < 8; k++) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3, 8), darkM); pl.position.set(k % 2 ? 2.5 : -2.5, -1.9, 22 + (k >> 1) * 5.5); pier.add(pl); }
      const gate = new THREE.Group(); gate.position.set(0, 0, 31); pier.add(gate); const gm = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; gate.add(m); return m; };
      for (const sx of [-1, 1]) { gm(new THREE.CylinderGeometry(0.42, 0.48, 8.6, 14), lacq, sx * 3.4, 4.3, 0); gm(new THREE.BoxGeometry(1.3, 1.0, 1.3), W.mat({ color: 0x3a3640, roughness: 0.9 }), sx * 3.4, 0.5, 0); gm(new THREE.ConeGeometry(0.3, 1.1, 6), goldM, sx * 5.5, 7.9, 0).rotation.z = sx * 1.1; }
      gm(new THREE.BoxGeometry(9.6, 0.55, 0.65), lacq, 0, 7.0, 0); gm(new THREE.BoxGeometry(8.4, 0.4, 0.5), jadeM, 0, 5.7, 0); gm(new THREE.BoxGeometry(1.8, 1.0, 0.14), new THREE.MeshStandardMaterial({ color: 0xd8a840, roughness: 0.4, metalness: 0.6, emissive: 0x3a2004 }), 0, 6.35, 0.3);
      gm(new THREE.BoxGeometry(11, 0.35, 1.9), W.mat({ color: 0x0c2a22, roughness: 0.6 }), 0, 7.55, 0); gm(new THREE.BoxGeometry(10, 0.28, 0.45), goldM, 0, 7.86, 0);
      const glm = lanternMat({ uniforms: S.lanM.uniforms }); for (const sx of [-1, 1]) { const l = gm(new THREE.SphereGeometry(0.55, 16, 12), glm, sx * 1.9, 4.8, 0); l.scale.y = 1.2; l.castShadow = false; gm(new THREE.CylinderGeometry(0.015, 0.015, 0.75, 4), darkM, sx * 1.9, 5.5, 0); } }
    S.poles = []; for (let k = 0; k < 6; k++) { const a = ARCH_A + PI / 6 + k * PI / 3, pg = new THREE.Group(); pg.position.set(Math.sin(a) * (R + 1.35), 0, Math.cos(a) * (R + 1.35)); pg.rotation.y = a + PI; g.add(pg);
      const poleM = W.mat({ color: 0x3a0c08, roughness: 0.5, transparent: true }), pole = new THREE.Mesh(mergeC([[T(new THREE.CylinderGeometry(0.08, 0.1, 8.6, 8), 0, 4.3, 0)], [T(new THREE.BoxGeometry(1.5, 0.08, 0.08), 0.65, 8.3, 0)]]), poleM); pole.castShadow = true; pg.add(pole);
      const pm = new THREE.MeshStandardMaterial({ color: 0xa01810, roughness: 0.8, side: THREE.DoubleSide, transparent: true }); pm.forceSinglePass = true; const sd = { value: k * 1.7 };
      pm.onBeforeCompile = (sh) => { sh.uniforms.uT = S.tU; sh.uniforms.uSeed = sd; sh.uniforms.uRimC = S.rimC;
        sh.vertexShader = 'uniform float uT,uSeed; varying vec2 vPU;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPU=uv; { float hang=1.0-uv.y; transformed.z+=sin(uT*2.3+hang*4.0+uSeed)*0.28*hang+sin(uT*3.7+hang*7.0+uSeed*2.0)*0.06*hang; transformed.x+=sin(uT*1.7+hang*3.0+uSeed)*0.08*hang; }');
        sh.fragmentShader = 'uniform vec3 uRimC; varying vec2 vPU;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          { vec2 u=vPU; float notch=0.1*(1.0-abs(u.x-0.5)*2.0); if (u.y<notch) discard; float bd=step(u.x,0.07)+step(0.93,u.x)+step(u.y,notch+0.04)+step(0.97,u.y);
            vec2 e=(u-vec2(0.5,0.74))*vec2(1.0,4.2); float r=length(e); float ring=1.0-smoothstep(0.0,0.03,abs(r-0.3)); float bands=step(abs(u.y-0.45),0.012)+step(abs(u.y-0.4),0.006);
            vec3 c=diffuseColor.rgb; c=mix(c,vec3(0.03,0.02,0.02),step(r,0.26)); c=mix(c,vec3(0.85,0.6,0.2),clamp(bd+ring+bands,0.0,1.0)); diffuseColor.rgb=c; }`).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*0.14;\n' + RIM); };
      pm.customProgramCacheKey = () => 'festPennant';
      const pen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.6, 1, 14), pm); pen.position.set(0.75, 6.0, 0); pg.add(pen); S.poles.push({ x: pg.position.x, z: pg.position.z, mats: [poleM, pm], a: 1 }); }
    // far shore: hills, a harbour town with lit windows, a pagoda
    const vr = mulberry(23), hillMat = (col, k) => { const m = new THREE.MeshBasicMaterial({ color: col, fog: false }), uk = { value: k }; m.onBeforeCompile = (sh) => { sh.uniforms.uHor = S.sky.material.uniforms.uHor; sh.uniforms.uK = uk; sh.uniforms.uRimH = S.moonM.material.uniforms.uCol;
        sh.vertexShader = 'varying float vHY, vHR;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvHY=clamp(position.y,0.0,1.0); vHR=1.0-abs(dot(normalize(normalMatrix*normal),normalize(-mvPosition.xyz)));');
        sh.fragmentShader = 'uniform vec3 uHor,uRimH; uniform float uK; varying float vHY, vHR;\n' + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity ); { float hy=clamp(vHY,0.0,1.0); diffuseColor.rgb=mix(diffuseColor.rgb,uHor,uK*(0.6+0.4*(1.0-hy)))+uHor*pow(1.0-hy,6.0)*0.45+uRimH*0.09*smoothstep(0.8,1.0,vHR)*smoothstep(0.4,0.9,hy); }'); }; m.customProgramCacheKey = () => 'festHill'; return m; },
      hillM = hillMat(0x030409, 0.1), hillM2 = hillMat(0x0b0e22, 0.34), hillM3 = hillMat(0x161c3c, 0.6), hillG = (() => { const gg = new THREE.SphereGeometry(1, 72, 10, 0, TAU, 0, PI / 2), P = gg.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(x, z); P.setY(i, y * (1 + (Math.abs(Math.sin(a * 37)) * 0.05 + Math.abs(Math.sin(a * 91 + 1.3)) * 0.035 + Math.sin(a * 13) * 0.03) * Math.pow(y, 3))); } gg.computeVertexNormals(); return gg; })();
    for (let k = 0; k < 42; k++) { const L = k % 3, a = k / 42 * TAU + vr() * 0.3, d = [215, 270, 340][L] + vr() * 30, h = [9, 20, 36][L] + vr() * [8, 16, 30][L]; if (Math.abs(angDiff(a, MOON_AZ)) < 0.5 - L * 0.1) continue; const m = new THREE.Mesh(hillG, [hillM, hillM2, hillM3][L]); m.scale.set(60 + vr() * 60, h, 40 + vr() * 40); m.position.set(Math.sin(a) * d, -2.5, Math.cos(a) * d); m.rotation.y = a; g.add(m); }
    { const townM = new THREE.MeshBasicMaterial({ color: 0x080810 });
      townM.onBeforeCompile = (sh) => { sh.vertexShader = 'varying vec3 vTS,vTL,vTN; varying float vSd;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTS=vec3(1.0); vSd=0.0;\n#ifdef USE_INSTANCING\nvTS=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz)); vSd=instanceMatrix[3].x*0.37+instanceMatrix[3].z*0.61;\n#endif\nvTL=position; vTN=normal;');
        sh.fragmentShader = 'varying vec3 vTS,vTL,vTN; varying float vSd;\n' + NOISE + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );
          { vec3 lp=vTL*vTS; float side=1.0-step(0.5,abs(vTN.y)); vec2 wq=vec2(abs(vTN.x)>0.5 ? lp.z : lp.x, lp.y)/vec2(2.6,3.0); vec2 cell=floor(wq), fc=fract(wq);
            float win=smoothstep(0.2,0.34,fc.x)*(1.0-smoothstep(0.66,0.8,fc.x))*smoothstep(0.22,0.36,fc.y)*(1.0-smoothstep(0.68,0.82,fc.y)); float on=step(0.7,fh21(cell+vec2(vSd*3.1,vSd*1.7)))*step(0.45,fract(vSd*7.31))*step(lp.y,9.0);
            vec3 wc=mix(vec3(1.0,0.45,0.12),vec3(1.0,0.66,0.3),fh21(cell+11.0))*(0.7+0.5*fh21(cell+3.0)); diffuseColor.rgb+=wc*win*on*side*step(1.0,lp.y)*1.0+vec3(0.5,0.2,0.05)*exp(-lp.y*0.5)*0.22*step(0.45,fract(vSd*7.31))*side; }`); };
      townM.customProgramCacheKey = () => 'festTown';
      const N = 170, town = new THREE.InstancedMesh(T(new THREE.BoxGeometry(1, 1, 1), 0, 0.5, 0), townM, N), roofs = new THREE.InstancedMesh(T(new THREE.ConeGeometry(0.85, 1, 4), 0, 0.5, 0, 0, PI / 4), new THREE.MeshBasicMaterial({ color: 0x040306 }), N); let nr = 0; const tref = [];
      for (let i = 0; i < N; i++) { let a = vr() * TAU; if (Math.abs(angDiff(a, MOON_AZ)) < 0.6) a += PI; const d = 150 + vr() * 45, w = 3 + vr() * 7, h = 3 + vr() * vr() * 16, dp = 3 + vr() * 5; _m.position.set(Math.sin(a) * d, -2.3, Math.cos(a) * d); _m.rotation.set(0, a, 0); _m.scale.set(w, h, dp); _m.updateMatrix(); town.setMatrixAt(i, _m.matrix); if (i % 4 === 0) tref.push([a, d]);
        if (vr() < 0.45) { _m.position.y = -2.3 + h; _m.scale.set(w * 1.15, 1.2 + vr() * 1.5, dp * 1.15); _m.updateMatrix(); roofs.setMatrixAt(nr++, _m.matrix); } }
      roofs.count = nr; g.add(town); g.add(roofs);
      const trM = S.reflM.clone(); trM.uniforms = { uCol: { value: new THREE.Color(0.22, 0.1, 0.03) }, uT: S.tU, uL: { value: -26 }, uW: { value: 2.4 } }; const tr = new THREE.InstancedMesh(T(new THREE.PlaneGeometry(1, 1), 0, 0.5, 0), trM, tref.length); tr.frustumCulled = false;
      tref.forEach(([a, d], i) => { _m.position.set(Math.sin(a) * (d - 3), -2.0, Math.cos(a) * (d - 3)); _m.rotation.set(0, 0, 0); _m.scale.setScalar(1); _m.updateMatrix(); tr.setMatrixAt(i, _m.matrix); }); g.add(tr);
      const pa = -1.9, pag = new THREE.Group(); pag.position.set(Math.sin(pa) * 175, -2.3, Math.cos(pa) * 175); pag.rotation.y = pa; g.add(pag); const pb = new THREE.MeshBasicMaterial({ color: 0x0e080a }), pr = new THREE.MeshBasicMaterial({ color: 0x050304 }), pw = W.glow(0xffa040, 1.3);
      for (let k = 0; k < 6; k++) { const sc = 1 - k * 0.13, y = k * 7.2; const tier = new THREE.Mesh(new THREE.BoxGeometry(12 * sc, 5, 12 * sc), pb); tier.position.y = y + 2.5; pag.add(tier); const roof = new THREE.Mesh(T(new THREE.ConeGeometry(12 * sc, 2.6, 4), 0, 0, 0, 0, PI / 4), pr); roof.position.y = y + 6.1; pag.add(roof);
        const win = new THREE.Mesh(new THREE.PlaneGeometry(8 * sc, 1.4), pw); win.position.set(0, y + 2.8, -6.05 * sc); win.rotation.y = PI; pag.add(win); }
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.8, 7, 6), pr); spire.position.y = 46; pag.add(spire); }
    // sky lanterns drifting up, far enough out never to fill the screen
    S.NL = 150; S.skyLM = lanternMat({ col: 0xc83010, hot: 0xffb060, mode: 1, h: 0.475 }); S.skyLan = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.36, 0.95, 10, 1), S.skyLM, S.NL); S.skyLan.frustumCulled = false; g.add(S.skyLan);
    S.lan = Array.from({ length: S.NL }, () => ({ a: vr() * TAU, d: 70 + vr() * 120, y: 2 + vr() * 108, v: 0.5 + vr() * 0.6, ph: vr() * 10, s: 0.7 + vr() * 0.6 }));
    S.embers = W.motes({ n: 700, box: [50, 24, 50], color: 0xff7a28, size: 0.28, vel: [0.3, 1.6, 0.2], sway: 0.8, center: [0, 9, 0], mult: 2 }); g.add(S.embers);
    S.smokeM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uCol: { value: new THREE.Color(0) }, uA: { value: 0 }, uT: S.tU, uSz: { value: 1 } }, vertexShader: BB_VERT,
      fragmentShader: `uniform vec3 uCol; uniform float uA,uT; varying vec2 vU; varying float vSeed; ${NOISE} void main(){ float r2=dot(vU,vU); if (r2>1.0) discard; float n=fn2(vU*1.8+vec2(vSeed,uT*0.07))*0.6+fn2(vU*4.0-vec2(uT*0.1,vSeed))*0.4; float a=(1.0-r2)*(1.0-r2)*smoothstep(0.25,0.75,n)*uA; gl_FragColor=vec4(uCol*(0.6+0.6*n),a); }` });
    S.smoke = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), S.smokeM, 28); S.smoke.frustumCulled = false; S.smoke.renderOrder = 2; S.smokeP = Array.from({ length: 28 }, () => ({ a: vr() * TAU, d: 22.5 + vr() * 12, y: 0.5 + vr() * 3.5, s: 3.5 + vr() * 3.5, v: (vr() - 0.5) * 0.02 })); g.add(S.smoke);
    S.paper = W.motes({ n: 600, box: [46, 22, 46], color: 0xa81e0e, size: 0.26, vel: [0.4, -1.3, 0.2], sway: 1.4, additive: false, center: [0, 9, 0] }); g.add(S.paper);

    // mortars: bronze tubes with brass hoops on wooden cradles; the paper band keeps the shell's colour
    S.types = ['peony', 'ring', 'willow', 'cross', 'peony', 'ring', 'willow', 'cross'];
    const tubeM = rimify(new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide }), S, 'tube'); S.hoopM = new THREE.MeshStandardMaterial({ color: 0xd8a840, roughness: 0.35, metalness: 0.8, emissive: 0xff9a30, emissiveIntensity: 0 });
    const woodM2 = W.mat({ color: 0x4a2a16, roughness: 0.8 }), cradleG = mergeC([[T(new THREE.BoxGeometry(1.9, 0.22, 0.3), 0, 0.11, 0, 0, PI / 4)], [T(new THREE.BoxGeometry(1.9, 0.22, 0.3), 0, 0.11, 0, 0, -PI / 4)], [T(new THREE.CylinderGeometry(0.85, 0.9, 0.12, 16), 0, 0.26, 0)]]);
    const hoopG = mergeC([[T(new THREE.TorusGeometry(0.66, 0.06, 6, 20), 0, 0.95, 0, PI / 2)], [T(new THREE.TorusGeometry(0.73, 0.06, 6, 20), 0, -0.85, 0, PI / 2)], [T(new THREE.TorusGeometry(0.71, 0.035, 6, 20), 0, -0.38, 0, PI / 2)], [T(new THREE.TorusGeometry(0.71, 0.035, 6, 20), 0, 0.38, 0, PI / 2)],
      ...Array.from({ length: 8 }, (_, i) => [T(new THREE.SphereGeometry(0.05, 6, 4), Math.sin(i / 8 * TAU) * 0.69, -0.6, Math.cos(i / 8 * TAU) * 0.69)])]);
    S.mortars = []; for (let k = 0; k < NM; k++) { const [x, z] = mPos(k), grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = mAng(k) + PI; g.add(grp);
      const tg = new THREE.Group(); tg.position.y = 1.15; tg.rotation.x = 0.16; grp.add(tg);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 1.9, 16, 1, true), tubeM); tube.castShadow = true; tg.add(tube); tg.add(new THREE.Mesh(hoopG, S.hoopM));
      const bm = new THREE.MeshBasicMaterial({ color: 0xffffff }), band = new THREE.Mesh(new THREE.CylinderGeometry(0.69, 0.73, 0.7, 16, 1, true), bm); tg.add(band);
      const cr = new THREE.Mesh(cradleG, woodM2); cr.castShadow = true; grp.add(cr);
      S.mortars.push({ k, x, z, bm, armed: false, kick: 0, tg }); }
    // fuses: straight out from the middle to each mortar. Forks (unused for now) branch to the next mortar round.
    S.fuses = []; S.forks = [];
    for (let k = 0; k < NM; k++) { const sgn = k % 2 ? 1 : -1, a0 = mAng(k) + sgn * 1.9, p0 = [Math.sin(a0) * 16.3, Math.cos(a0) * 16.3], p2 = mPos(k, MR - 0.9), mid = [(p0[0] + p2[0]) * 0.5 * 0.5, (p0[1] + p2[1]) * 0.5 * 0.5];
      const P = polyline(Array.from({ length: 31 }, (_, i) => mPos(k, lerp(3, MR - 0.9, i / 30)))); P.mesh = fuse(g, P, S); S.fuses.push(P); // straight out from the middle to the mortar
      const k2 = (k + (sgn > 0 ? NM - 1 : 1)) % NM, fp = at(P, P.len * 0.5, [0, 0]).slice(), q2 = mPos(k2, MR - 0.9), fm = [(fp[0] + q2[0]) * 0.5 * 0.8, (fp[1] + q2[1]) * 0.5 * 0.8];
      const F = polyline(bez(fp, fm, q2, 26, 0.6)); F.mesh = fuse(g, F, S); F.mesh.visible = false; F.to = k2; F.atS = P.len * 0.5; S.forks.push(F); }
    { const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = 0.6 + t * TAU * 1.5, r = lerp(15.2, 1.6, t); pts.push([Math.sin(a) * r, Math.cos(a) * r]); } S.spiral = polyline(pts); S.spiral.mesh = fuse(g, S.spiral, S); S.spiral.mesh.visible = false; }
    S.allF = [...S.fuses, ...S.forks, S.spiral];
    // this run's three colour layouts and their volley pools, worked out during loading so act changes don't hitch
    S.layouts = []; for (let n = 2; n >= 0; n--) makeLayout(S, n);
    S.big = new THREE.Group(); const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 1.5, 20), rimify(W.mat({ color: 0x7a1610, roughness: 0.42 }), S, 'lq')); for (const y of [0.12, 0.75, 1.42]) { const hp = new THREE.Mesh(new THREE.TorusGeometry(y < 0.5 ? 1.09 : y > 1 ? 0.97 : 1.03, 0.06, 6, 24), S.hoopM); hp.rotation.x = PI / 2; hp.position.y = y; S.big.add(hp); } const btop = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), W.glow(0xff7a20, 0.9)); btop.rotation.x = -PI / 2; btop.position.y = 1.51; S.big.add(btop); bt.position.y = 0.75; bt.castShadow = true; S.big.add(bt); const bb = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.1, 6, 20), goldM); bb.rotation.x = PI / 2; bb.position.y = 1.1; S.big.add(bb); S.big.visible = false; g.add(S.big);
    // sparks and rising shells: warm core, soft halo, a turning star
    S.sparkM = W.glow(0xffd890, 1.8); const bbG = new THREE.PlaneGeometry(2, 2), coreG = new THREE.SphereGeometry(0.12, 8, 6);
    const ringG = new THREE.TorusGeometry(0.5, 0.06, 6, 24); S.sparkPool = Array.from({ length: 16 }, () => { const m = new THREE.Group(), cm = W.glow(0xffd890, 1.8), c = new THREE.Mesh(coreG, cm), h = new THREE.Mesh(bbG, sparkleMat(S, 1.45)), rg = new THREE.Mesh(ringG, W.glow(0xffe8c0, 2.4, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); rg.rotation.x = -PI / 2; rg.visible = false; h.frustumCulled = false; m.add(c); m.add(h); m.add(rg); m.userData = { cm, rg }; m.visible = false; g.add(m); return m; });
    S.shellPool = Array.from({ length: 10 }, () => { const m = new THREE.Group(), c = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), W.glow(0xffffff, 1)), h = new THREE.Mesh(bbG, sparkleMat(S, 1.1)); h.frustumCulled = false; m.add(c); m.add(h); m.userData.c = c; m.userData.h = h; m.visible = false; g.add(m); return m; });
    S.sparks = []; S.shells = [];
    // sky bursts: one point cloud, motion done in the vertex shader
    const NPT = Math.round(7000 * Math.max(0.5, G.q.part)), geo = new THREE.BufferGeometry();
    S.fw = { n: NPT, head: 0, start: new Float32Array(NPT * 3), vel: new Float32Array(NPT * 3), col: new Float32Array(NPT * 3), dat: new Float32Array(NPT * 4).fill(-100), sz: new Float32Array(NPT).fill(1) };
    geo.setAttribute('position', new THREE.BufferAttribute(S.fw.start, 3)); geo.setAttribute('aVel', new THREE.BufferAttribute(S.fw.vel, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(S.fw.col, 3)); geo.setAttribute('aDat', new THREE.BufferAttribute(S.fw.dat, 4)); geo.setAttribute('aSz', new THREE.BufferAttribute(S.fw.sz, 1));
    geo.boundingSphere = new THREE.Sphere(new V3(), 1e6);
    const mk = (flip) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uFlip: { value: flip }, uPx: { value: 1 } },
      vertexShader: `attribute vec3 aVel; attribute vec3 aCol; attribute vec4 aDat; attribute float aSz; uniform float uTime, uFlip, uPx; varying vec4 vC;
        void main(){ float t = uTime - aDat.x, life = max(aDat.y, 0.01), k = clamp(t / life, 0.0, 1.0), dr = max(aDat.z, 0.05);
          vec3 p = position + aVel * (1.0 - exp(-dr * max(t, 0.0))) / dr; p.y -= aDat.w * t * t;
          if (uFlip > 0.5) p.y = -4.4 - p.y;
          float on = step(0.0, t) * step(t, life);
          float fade = (1.0 - k) * (1.0 - k) * (0.75 + 0.25 * sin(t * 40.0 + position.x * 7.0));
          vC = vec4(aCol * fade * (uFlip > 0.5 ? 0.22 : 1.0), on);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float ps = on * uPx * aSz * (1.0 + 2.0 * (1.0 - k)) * 60.0 / max(-mv.z, 1.0); vC.rgb *= clamp(ps / 3.0, 0.0, 1.0) * clamp(ps / 3.0, 0.0, 1.0); gl_PointSize = on * min(max(ps, 3.0), 64.0); }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d) * 4.0; if (vC.a < 0.5 || r2 >= 1.0) discard; float a = exp(-r2 * 7.0) + exp(-r2 * 2.5) * 0.2; gl_FragColor = vec4(max(vC.rgb, vec3(0.0)) * a, 1.0); }` });
    S.fwM = mk(0); S.fwM2 = mk(1); S.fwPts = new THREE.Points(geo, S.fwM); S.fwPts.frustumCulled = false; g.add(S.fwPts); S.fwPts2 = new THREE.Points(geo, S.fwM2); S.fwPts2.frustumCulled = false; g.add(S.fwPts2);

    // ---- Nian: a lion-dance costume come alive ----
    const bg = b.group; S.rig = new THREE.Group(); bg.add(S.rig);
    S.winU = { value: new THREE.Vector4(-1e4, -1e4, 1, -1) }; const hGold = winify(rimify(new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.4, metalness: 0.7 }), S, 'g'), S), bGold = rimify(new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.4, metalness: 0.7 }), S, 'g');
    S.hvcM = winify(rimify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), S, 'vc'), S); const bvcM = winify(rimify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), S, 'vc'), S);
    S.eyeM = winify(new THREE.MeshStandardMaterial({ color: 0xf4eedc, roughness: 0.3, emissive: 0xff9a30, emissiveIntensity: 0 }), S); S.mawM = winify(new THREE.MeshStandardMaterial({ color: 0x2a0404, roughness: 0.7, emissive: 0xff3a10, emissiveIntensity: 0.1 }), S);
    S.head = new THREE.Group(); S.head.position.set(0, 2.75, 1.15); S.head.scale.setScalar(1.25); S.rig.add(S.head);
    const skullG = flipV(new THREE.SphereGeometry(1.35, 28, 18)); skullG.scale(1.18, 1, 1.05);
    const skull = new THREE.Mesh(skullG, clothMat(S, { rep: [16, 5], hem: 2, seed: 9 })); skull.castShadow = true; S.head.add(skull);
    const hv = [], hg = [], ey = [], gl = [];
    for (const sx of [-1, 1]) {
      ey.push([T(new THREE.SphereGeometry(0.42, 16, 12), sx * 0.62, 0.32, 1.15)]); hv.push([T(new THREE.SphereGeometry(0.2, 12, 10), sx * 0.62, 0.32, 1.49, 0, 0, 0, 1, 1, 0.45), BLK]); gl.push([T(new THREE.SphereGeometry(0.055, 6, 4), sx * 0.55, 0.42, 1.6)]);
      hg.push([T(new THREE.TorusGeometry(0.43, 0.07, 8, 22), sx * 0.62, 0.32, 1.33)]); hg.push([T(new THREE.SphereGeometry(0.47, 16, 8, 0, TAU, 0, PI * 0.36), sx * 0.62, 0.32, 1.15, 0.55)]);
      hv.push([T(new THREE.TorusGeometry(0.55, 0.16, 8, 16, PI), sx * 0.62, 0.45, 1.12, -0.15, 0, -sx * 0.12), JADE]);
      for (let k = 0; k < 4; k++) { const an = 0.4 + k * 0.78; hv.push([T(new THREE.SphereGeometry(0.17, 8, 6), sx * 0.62 + Math.cos(an) * 0.55, 0.51 + Math.sin(an) * 0.55, 1.18), FUR]); }
      hv.push([T(new THREE.SphereGeometry(0.45, 12, 10), sx * 1.0, -0.3, 0.98, 0, 0, 0, 1, 0.8, 0.75), FUR]); hv.push([T(new THREE.ConeGeometry(0.3, 0.8, 8), sx * 1.12, 1.02, 0, 0, 0, -sx * 0.55), JADE]); hv.push([T(new THREE.SphereGeometry(0.24, 8, 6), sx * 0.98, 0.72, 0), FUR]);
    }
    hg.push([T(new THREE.TorusGeometry(0.95, 0.09, 8, 30, PI), 0, 0.45, 1.0, -0.5)], [T(new THREE.TorusGeometry(0.22, 0.045, 6, 18), 0, 1.0, 1.03, -0.55)], [T(new THREE.ConeGeometry(0.19, 1.0, 10), 0, 1.7, 0.67, 0.45)],
      [T(new THREE.SphereGeometry(0.36, 14, 10), 0, -0.08, 1.42, 0, 0, 0, 1.2, 0.85, 0.9)], [T(new THREE.TorusGeometry(1.2, 0.15, 8, 28), 0, -0.15, -0.9)]);
    hv.push([T(new THREE.TorusGeometry(0.2, 0.06, 6, 14), 0, 1.28, 0.47, -1.12), JADE], [T(new THREE.SphereGeometry(0.75, 14, 10), 0, -0.32, 1.22, 0, 0, 0, 1.2, 0.5, 0.8), LACQ], [T(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 20), 0, 1.0, 1.03, PI / 2 - 0.55), 0xc8d4e8]);
    for (let i = 0; i < 7; i++) { const x = -0.6 + i * 0.2; hv.push([T(new THREE.ConeGeometry(0.075, 0.26, 5), x, -0.5, 0.9 + Math.sqrt(Math.max(0, 1 - (x / 1.05) ** 2)) * 0.85, PI), IVORY]); }
    const hvM = new THREE.Mesh(mergeC(hv), S.hvcM), hgM = new THREE.Mesh(mergeC(hg), hGold); hvM.castShadow = hgM.castShadow = true; S.head.add(hvM); S.head.add(hgM);
    S.head.add(new THREE.Mesh(mergeC(ey), S.eyeM)); S.head.add(new THREE.Mesh(mergeC(gl), W.glow(0xffffff, 1.4)));
    const maw = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 10), S.mawM); maw.scale.set(1.1, 0.45, 1.0); maw.position.set(0, -0.62, 1.05); S.head.add(maw);
    S.jaw = new THREE.Group(); S.jaw.position.set(0, -0.55, 0.35); S.head.add(S.jaw);
    { const jv = [[T(new THREE.SphereGeometry(1.0, 20, 10, 0, TAU, PI / 2, PI / 2), 0, 0.05, 0.55, 0, 0, 0, 1.05, 0.5, 1.1), LACQ], [T(new THREE.SphereGeometry(0.4, 10, 8), 0, 0.08, 1.0, 0, 0, 0, 1, 0.3, 1), 0xc83a2a], [T(new THREE.ConeGeometry(0.7, 1.3, 12), 0, -0.7, 0.95, PI), FUR]], jg = [[T(new THREE.TorusGeometry(1.0, 0.06, 6, 28), 0, 0.05, 0.55, PI / 2, 0, 0, 1.05, 1.1, 1)]];
      for (let k = 0; k < 5; k++) { const an = -0.9 + k * 0.45; jv.push([T(new THREE.SphereGeometry(0.3, 8, 6), Math.sin(an) * 0.9, -0.3, 0.55 + Math.cos(an) * 0.9), FUR]); }
      for (let i = 0; i < 7; i++) { const x = -0.6 + i * 0.2; jg.push([T(new THREE.ConeGeometry(0.07, 0.24, 5), x, 0.16, 0.55 + Math.sqrt(Math.max(0, 1 - (x / 1.05) ** 2)) * 1.0)]); }
      S.jaw.add(new THREE.Mesh(mergeC(jv), S.hvcM)); S.jaw.add(new THREE.Mesh(mergeC(jg), hGold)); }
    // mane: fur tufts framing the face and covering the back of the head; they burn in the last act
    { const maneG = lockGeo(1, 0.13, 0.35), dirs = [];
      for (let row = 0; row < 4; row++) for (let k = 0; k < 22; k++) { const ph = (k + row * 0.5) / 22 * TAU; dirs.push([Math.cos(ph), Math.sin(ph) * 0.95, -0.2 - row * 0.32, row]); }
      for (let k = 0; k < 12; k++) { const ph = k / 12 * TAU; dirs.push([Math.cos(ph) * 0.4, Math.sin(ph) * 0.4 + 0.1, -1, 4]); }
      const N = dirs.length, maneM = winify(rimify(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }), S, 'mane'), S);
      const maneG2 = maneG.clone(); maneG2.boundingSphere = new THREE.Sphere(new V3(0, 0, -0.2), 2.0); S.mane = new THREE.InstancedMesh(maneG2, maneM, N); S.mane.castShadow = true;
      S.flameM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: S.tU, uA: { value: 0 } },
        vertexShader: 'uniform float uT; varying float vY, vS;\nvoid main(){ mat4 im=mat4(1.0);\n#ifdef USE_INSTANCING\nim=instanceMatrix;\n#endif\nvec3 p=position; vY=clamp(p.y,0.0,1.0); vS=im[3].x*3.1+im[3].y*1.7+im[3].z*2.3; p.x+=sin(uT*9.0+vS+p.y*4.0)*0.07*vY; p.z+=cos(uT*7.0+vS)*0.06*vY; gl_Position=projectionMatrix*viewMatrix*modelMatrix*im*vec4(p,1.0); }',
        fragmentShader: `uniform float uT,uA; varying float vY, vS; ${NOISE} void main(){ float y=clamp(vY,0.0,1.0); float n=fn2(vec2(vS*3.0,y*4.0-uT*6.0)); float a=smoothstep(0.55,0.8,n)*smoothstep(0.35,0.75,y)*(1.0-smoothstep(0.9,1.0,y))*uA; gl_FragColor=vec4(mix(vec3(1.0,0.55,0.1),vec3(0.85,0.22,0.03),y)*a*0.45,1.0); }` });
      S.flame = new THREE.InstancedMesh(maneG, S.flameM, N); S.flame.visible = false;
      dirs.forEach(([x, y, z, row], i) => { if (y < -0.75 && row < 4) y = -0.75; _a.set(x, y, z).normalize(); _p.set(_a.x * 1.5, _a.y * 1.28, _a.z * 1.35 + 0.15); _b.set(0, 0, -1).addScaledVector(_a, _a.z); if (_b.lengthSq() < 0.05) _b.set(0, -1, 0).addScaledVector(_a, _a.y); _b.normalize().multiplyScalar(0.85).addScaledVector(_a, 0.4).normalize(); _q.setFromUnitVectors(_up, _b);
        const L = (row === 0 ? 0.62 : 0.6 + row * 0.06) + vr() * 0.25; _m4.compose(_p, _q, _s.set(1, L, 1)); S.mane.setMatrixAt(i, _m4); S.mane.setColorAt(i, _c.setHex(i % 7 === 0 ? 0xc83020 : i % 3 === 0 ? 0xf0c060 : 0xece2cc)); _m4.compose(_p, _q, _s.set(1.4, L * 1.3, 1.4)); S.flame.setMatrixAt(i, _m4); });
      S.head.add(S.mane); S.head.add(S.flame); }
    S.poms = [[-0.75, 1.15, 0.25, 0xd82a1a], [-0.38, 1.4, -0.2, JADE], [0.38, 1.4, -0.2, 0xf0c040], [0.75, 1.15, 0.25, 0xd82a1a], [0, 1.2, -0.65, JADE]].map(([x, y, z, c]) => { const p = new THREE.Group(); p.position.set(x, y, z); p.userData.rz = -x * 0.5; S.head.add(p);
      p.add(new THREE.Mesh(mergeC([[T(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 4), 0, 0.27, 0), BLK], [T(new THREE.SphereGeometry(0.21, 10, 8), 0, 0.6, 0), c]]), S.hvcM)); return p; });
    // body: shingled cloth tiers with a swaying fringe, a fur crest, trousered legs; a tasselled tail on the last
    const prof = [[1.08, 0.8], [1.05, 0.95], [1.1, 1.2], [1.13, 1.55], [1.05, 1.9], [0.82, 2.18], [0.45, 2.38], [0.02, 2.45]].map(([r, y]) => new THREE.Vector2(r, y));
    const shellG = flipV(new THREE.LatheGeometry(prof, 28)), fringeG = new THREE.CylinderGeometry(1.08, 1.14, 0.46, 64, 2, true); fringeG.translate(0, 0.57, 0);
    const crestG = lockGeo(1, 0.16, 0.5), crestM = winify(rimify(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide }), S, 'mane'), S);
    const legG = mergeC([[T(new THREE.CylinderGeometry(0.21, 0.18, 0.62, 10), 0, -0.31, 0), GFUR], [T(new THREE.TorusGeometry(0.2, 0.09, 6, 12), 0, -0.62, 0, PI / 2), FUR], [T(new THREE.CylinderGeometry(0.17, 0.15, 0.34, 10), 0, -0.82, 0), GFUR], [T(new THREE.TorusGeometry(0.16, 0.075, 6, 12), 0, -0.95, 0, PI / 2), FUR],
      [T(new THREE.SphereGeometry(0.22, 10, 8), 0, -1.03, 0.08, 0, 0, 0, 1, 0.55, 1.35), BLK], ...[-0.1, 0, 0.1].map((x) => [T(new THREE.ConeGeometry(0.04, 0.14, 5), x, -1.06, 0.36, PI / 2), IVORY])]);
    const tailG = mergeC([[T(new THREE.ConeGeometry(0.26, 1.1, 8), 0, 0.15, -0.5, -1.2), FUR], [T(new THREE.ConeGeometry(0.2, 0.9, 8), 0.2, 0.05, -0.4, -1.4, 0.3), FUR], [T(new THREE.ConeGeometry(0.2, 0.9, 8), -0.2, 0.05, -0.4, -1.4, -0.3), FUR], [T(new THREE.SphereGeometry(0.18, 8, 6), 0, 0, -0.05), GFUR], [T(new THREE.ConeGeometry(0.16, 0.7, 8), 0, -0.35, -0.2, PI - 0.3), 0xc02018]]);
    S.segs = Array.from({ length: 5 }, (_, i) => { const s = new THREE.Group(), sc = 1 - i * 0.11, dress = new THREE.Group(); dress.scale.set(sc, (0.8 + 0.2 * sc) * (i % 2 ? 0.88 : 1), 1.15); dress.position.y = 0.4; s.add(dress);
      const sh = new THREE.Mesh(shellG, clothMat(S, { rep: [14, 4.6], hem: 0.86, seed: i })); sh.castShadow = true; dress.add(sh);
      const fr = new THREE.Mesh(fringeG, fringeMat(S, i)); dress.add(fr); const cr = new THREE.InstancedMesh(crestG, crestM, 9); for (let k = 0; k < 9; k++) { const z = -1.0 + k * 0.25, sx = k % 2 ? 1 : -1, y = 2.45 - z * z * 0.14; _q.setFromEuler(_e.set(-0.75 + vr() * 0.3, 0, sx * (0.25 + vr() * 0.2))); _m4.compose(_p.set(sx * 0.06, y - 0.05, z), _q, _s.set(1, 0.4 + vr() * 0.25, 1)); cr.setMatrixAt(k, _m4); cr.setColorAt(k, _c.setHex(k % 4 === 1 ? 0xf0c060 : k % 4 === 3 ? 0xc83020 : 0xece2cc)); } cr.castShadow = true; dress.add(cr);
      if (i === 4) { S.tail = new THREE.Group(); S.tail.position.set(0, 1.95, -1.2); dress.add(S.tail); S.tail.add(new THREE.Mesh(tailG, bvcM)); }
      s.legs = [-1, 1].map((sx) => { const hip = new THREE.Group(); hip.position.set(sx * 0.52 * sc, 1.1, 0); s.add(hip); const lg = new THREE.Mesh(legG, bvcM); lg.castShadow = true; hip.add(lg); return hip; }); g.add(s); return s; });
    S.path = []; S.stars = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.07, 5, 5), W.glow(GOLD, 3)); S.stars.rotation.x = PI / 2; S.stars.position.y = 5.7; S.stars.visible = false; bg.add(S.stars);
    S.light = new THREE.PointLight(0xff7a40, 16, 16, 1.6); S.light.position.set(0, 0.7, 1.6); bg.add(S.light);
    Object.assign(S, { lvl: 0, vol: null, stun: 0, hopY: 0, jawK: 0, bigS: null, walk: 0, mood: 0, ambT: 2, swing: 0.05 });
    return {
      edge: 'wall', spawn: { x: 0, z: 9 }, bossStart: { x: 0, z: -7, face: 0 }, camDist: 17, camPitch: 0.5,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 2,
      clamp(p) { const d = Math.hypot(p.x, p.z); if (d > R - 0.5) { p.x *= (R - 0.5) / d; p.z *= (R - 0.5) / d; } },
      solid(p) { for (const m of S.mortars) { const dx = p.x - m.x, dz = p.z - m.z, d = Math.hypot(dx, dz); if (d < 1.2 && d > 0.001) { p.x = m.x + dx / d * 1.2; p.z = m.z + dz / d * 1.2; } } },
      camLimit(x, y, z) { const d = Math.hypot(x, z); if (d > R + 9) { x *= (R + 9) / d; z *= (R + 9) / d; } return { x, y: Math.max(y, d > R + 1 ? -0.5 : 0.5), z }; },
    };
  }

  // ---------- fireworks in the sky ----------
  function skyBurst(S, x, y, z, type, color, scale = 1, o = {}) {
    if (G.headless) return; const F = S.fw, now = S.fwM.uniforms.uTime.value, c = _c.setHex(color), n = o.n || Math.round((type === 'big' ? 1500 : 520) * Math.max(0.5, G.q.part)), dim = o.dim || 1, sz = o.sz || 1, nt = o.trail || 2, c2 = _c2.setHex(PAIR[color] || 0xffffff), emit = (j, px, py, pz, vx, vy, vz, cr, cg, cb, t0, life, drag, grav, z) => { F.start.set([px, py, pz], j * 3); F.vel.set([vx, vy, vz], j * 3); F.col.set([cr, cg, cb], j * 3); F.dat.set([t0, life, drag, grav], j * 4); F.sz[j] = z; };
    for (let i = 0; i < 10; i++) { const j = F.head; F.head = (F.head + 1) % F.n; emit(j, x, y, z, (vrand() - 0.5) * 3, (vrand() - 0.5) * 3, (vrand() - 0.5) * 3, 1.0 * dim, 0.85 * dim, 0.6 * dim, now, 0.16 + vrand() * 0.1, 1, 0, sz * 4); }
    for (let i = 0; i < n; i++) {
      const j = F.head; F.head = (F.head + 1) % F.n; let vx, vy, vz, life = 1.9, drag = 1.5, grav = 1.2, sp = 26 * scale, k = 1;
      const u = vrand() * 2 - 1, ph = vrand() * TAU, sq = Math.sqrt(1 - u * u); vx = sq * Math.cos(ph); vy = u; vz = sq * Math.sin(ph);
      if (type === 'ring') { const a = vrand() * TAU; vx = Math.cos(a); vz = Math.sin(a); vy = (vrand() - 0.5) * 0.08; sp *= 1.1; if (i % 3 === 0) { sp *= 0.36; } }
      else if (type === 'willow') { life = 3.0; drag = 1.1; grav = 3.0; sp *= 0.8 + vrand() * 0.25; }
      else if (type === 'cross') { const ax = i % 4, s = (vrand() < 0.5 ? -1 : 1) * (0.3 + vrand() * 0.7); vx = ax < 2 ? s : 0; vz = ax >= 2 ? s : 0; if (ax % 2) { const t = vx; vx = (t + vz) * 0.707; vz = (vz - t) * 0.707 + t * 0; } vy = (vrand() - 0.5) * 0.1; sp *= 1.25; vx += (vrand() - 0.5) * 0.05; vz += (vrand() - 0.5) * 0.05; }
      else if (type === 'comet') { const a = i / n * TAU * 3; vx = Math.cos(a) * (i / n); vz = Math.sin(a) * (i / n); vy = 0.2; life = 2.6; }
      else if (type === 'big') { sp *= 1.7; life = 3.2; k = 1.3; } else sp *= 0.75 + vrand() * 0.35;
      F.start[j * 3] = x; F.start[j * 3 + 1] = y; F.start[j * 3 + 2] = z; F.vel[j * 3] = vx * sp; F.vel[j * 3 + 1] = vy * sp; F.vel[j * 3 + 2] = vz * sp;
      const cc = i % 2 ? c2 : c, w = i % 11 === 0 ? 1 : 0; F.col[j * 3] = lerp(cc.r, 1, w) * 1.5 * k * dim; F.col[j * 3 + 1] = lerp(cc.g, 1, w) * 1.5 * k * dim; F.col[j * 3 + 2] = lerp(cc.b, 1, w) * 1.5 * k * dim;
      F.dat[j * 4] = now; F.dat[j * 4 + 1] = life * (0.75 + vrand() * 0.4); F.dat[j * 4 + 2] = drag; if (o.grav) grav = o.grav; F.dat[j * 4 + 3] = grav; F.sz[j] = sz;
      if (i % 3 === 0 || nt > 2) for (let q = 1; q <= nt; q++) { const jt = F.head; F.head = (F.head + 1) % F.n; emit(jt, x, y, z, F.vel[j * 3], F.vel[j * 3 + 1], F.vel[j * 3 + 2], F.col[j * 3] * Math.max(0.6 - q * 0.6 / (nt + 1), 0.05), F.col[j * 3 + 1] * Math.max(0.6 - q * 0.6 / (nt + 1), 0.05), F.col[j * 3 + 2] * Math.max(0.6 - q * 0.6 / (nt + 1), 0.05), now + q * 0.06, F.dat[j * 4 + 1] * 0.9, drag, grav, sz * Math.max(0.85 - q * 0.5 / nt, 0.3)); }
    }
    for (const k of ['position', 'aVel', 'aCol', 'aDat', 'aSz']) S.fwPts.geometry.attributes[k].needsUpdate = true;
  }
  // distant festival fireworks: far, dim, more of them each act
  function ambientBurst(S, dim) {
    const a = vrand() * TAU, d = 120 + vrand() * 90, col = PAL[Math.floor(vrand() * PAL.length)], type = ['peony', 'ring', 'willow', 'peony', 'comet'][Math.floor(vrand() * 5)];
    skyBurst(S, Math.sin(a) * d * 0.8, 14 + vrand() * 22, Math.cos(a) * d * 0.8, type === 'comet' ? 'willow' : type, col, 1.9, { n: Math.round((80 + S.mood * 30) * Math.max(0.5, G.q.part)), dim, sz: 4.8, grav: 2.6, trail: 4 });
    if (S.mood > 0.8) FX.light(Math.sin(a) * 12, 12, Math.cos(a) * 12, col, 70 * dim * S.mood, 0.9, 50);
    S.atmos.material.uniforms.uFw.value.setHex(col).multiplyScalar(0.05 * dim);
  }
  function shellLook(sm, col, k) { sm.userData.c.material.color.setHex(col).multiplyScalar(k); const u = sm.userData.h.material.uniforms; u.uCol.value.setHex(col).multiplyScalar(0.8); u.uCore.value.setHex(col).lerp(_w, 0.55).multiplyScalar(1.4); }

  // ---------- fuses and shells ----------
  // Each spark burns in its mortar's colour. Once one spark of a volley is stamped the rest go white-hot (white core,
  // a little ring of flame, coloured trail) and can't be stamped until the volley lands or Rekindle relights the first.
  function sparkLook(sp) {
    const m = sp.m; if (!m) return; const u = m.children[1].material.uniforms, cm = m.userData.cm, c = _c.setHex(sp.col || 0xffa040);
    m.scale.setScalar(sp.big ? 1.6 : 1); m.userData.rg.visible = !!sp.locked;
    if (sp.locked) { cm.color.setRGB(2.6, 2.5, 2.3); u.uCol.value.copy(c).multiplyScalar(1.0); u.uCore.value.setRGB(1.9, 1.85, 1.75); }
    else if (sp.big) { cm.color.setRGB(1.8, 1.3, 0.6); u.uCol.value.setRGB(1, 0.6, 0.1); u.uCore.value.setRGB(1.5, 1.2, 0.6); }
    else { cm.color.copy(c).lerp(_w, 0.3).multiplyScalar(1.8); u.uCol.value.copy(c).multiplyScalar(1.0); u.uCore.value.copy(c).lerp(_w, 0.4).multiplyScalar(1.35); }
  }
  function addSpark(S, o) { const m = S.sparkPool.find((q) => !q.visible); const sp = Object.assign({ s: 0, alive: true, m, locked: false }, o); if (m) { m.visible = true; sparkLook(sp); } S.sparks.push(sp); return sp; }
  function stampOut(S, sp, x, z) {
    sp.alive = false; if (sp.m) { sp.m.visible = false; sp.m = null; } if (sp.to >= 0) S.mortars[sp.to].armed = S.sparks.some((o) => o.alive && o.to === sp.to);
    Sound.sfx('steam', 0.9, 2.2); if (!G.headless) FX.burst(x, 0.3, z, { n: 14, color: 0x9a9088, speed: [1, 4], up: 3, life: [0.4, 0.9], size: [0.3, 0.6], smoke: true });
    const V = sp.vol; if (!V || V.lock) return; V.lock = sp; let any = false;
    for (const o of V.sparks) if (o.alive && o !== sp) { o.locked = true; sparkLook(o); any = true; if (!G.headless && o.m) FX.burst(o.m.position.x, 0.4, o.m.position.z, { n: 10, color: 0xffffff, color2: o.col || GOLD, speed: [1, 4], up: 3, life: [0.2, 0.5], size: [0.1, 0.22] }); }
    if (any) Sound.sfx('tick', 0.8, 0.6);
  }
  function startVolley(b, pl, o) {
    const S = b.state, T = o.T; if (!pl) return null;
    const V = Object.assign({}, pl, { arrive: G.now + T, land: G.now + T + RISE + o.warn, warn: o.warn, T, lock: null, fired: [], sparks: [], fuses: pl.lit.slice() });
    if (o.comet) { const c = S.types.indexOf('comet'); if (c >= 0) V.fuses.push(c); }
    for (const k of V.fuses) { const P = S.fuses[k]; S.mortars[k].armed = true; V.sparks.push(addSpark(S, { P, to: k, speed: P.len / T, vol: V, col: TYPES[S.types[k]] })); }
    if (pl.arch === 'D') { V.sparks.push(addSpark(S, { P: S.spiral, to: -1, speed: S.spiral.len / (T + RISE + o.warn + 0.3), big: true, vol: V, col: GOLD })); Sound.sfx('steam', 0.9, 1.2); }
    S.vol = V; S.lastLit = litKey(pl.lit); S.hist.push(pl.arch); Sound.sfx('steam', 0.7, 1.8);
    return V;
  }
  function launch(b, k, V) {
    const S = b.state, m = S.mortars[k], type = S.types[k], col = TYPES[type], [ax, az] = mPos(k, MR * 0.45); m.kick = 1; m.armed = false;
    Sound.sfx('boom', 0.7, 1.6); if (!G.headless) { FX.burst(m.x, 2, m.z, { n: 14, color: 0xffd090, speed: [2, 8], up: 6, life: [0.2, 0.6], size: [0.2, 0.5] }); FX.ring(m.x, m.z, { r0: 0.7, r1: 3.4, color: col, dur: 0.45, width: 0.1 }); FX.burst(m.x, 2.1, m.z, { n: 6, smoke: true, color: 0x6a6460, color2: 0x2a2624, speed: [0.5, 2], up: 2, life: [0.8, 1.6], size: [0.6, 1.2], alpha: 0.35 }); }
    const sm = S.shellPool.find((q) => !q.visible); if (sm) { sm.visible = true; shellLook(sm, col, 2); }
    S.shells.push({ m: sm, x0: m.x, z0: m.z, x1: ax, z1: az, t: 0, type, col, k, V });
    if (V) V.fired.push(k);
  }
  function burst(b, sh) {
    const S = b.state, shapes = shapesOf(sh.type, sh.k), warn = sh.V ? sh.V.warn : 1.0; skyBurst(S, sh.x1, 30, sh.z1, sh.type, sh.col); Sound.sfx('bigboom', 0.55, 1.3 + (sh.k % 3) * 0.15); FX.flash(sh.col, 0.07, 3); FX.light(sh.x1, 16, sh.z1, sh.col, 45, 0.7, 60);
    if (!G.headless) S.atmos.material.uniforms.uFw.value.setHex(sh.col).multiplyScalar(0.07);
    let first = true;
    const hit = () => { if (!first) return; first = false; Sound.sfx('boom', 0.8, 0.8); FX.shake(0.5); };
    const o = { name: sh.type[0].toUpperCase() + sh.type.slice(1), color: sh.col, tag: 'fight', quiet: true, silent: true, onFire: hit };
    for (const s of shapes) { if (s.type === 'circle') Hz.circle(s.x, s.z, s.r, warn, 600, o); else if (s.type === 'donut') Hz.donut(s.x, s.z, s.r0, s.r1, warn, 600, o); else Hz.rect(s.x, s.z, s.dir, s.len, s.w, warn, 600, o); }
    if (sh.type === 'comet') { const sgn = sh.k % 2 ? 1 : -1, a0 = mAng(sh.k) + PI, t0 = G.now; Hz.zone({ type: 'rect', x: sh.x1, z: sh.z1, dir: a0, len: 24, w: 3.4 }, 6.5, 95, { name: 'Comet', color: sh.col, delay: 1.6, tag: 'fight', track(s) { s.dir = a0 + sgn * Math.max(0, G.now - t0 - 1.6) * 0.75; } }); }
    Sound.sfx('warn', 0.5);
  }
  function startle(b) {
    const S = b.state; if (S.stun > 0 || b.transitioning || !b.alive) return; S.stun = 5; b.stagger = 5; Sound.sfx('roar', 0.9, 2.2); Sound.sfx('crit', 0.8);
    if (b.castState) { b.castState.result = 'interrupted'; b.castState = null; }
    if (!G.headless) { b.aim(_a); FX.burst(_a.x, _a.y + 1, _a.z, { n: 40, color: GOLD, color2: 0xffffff, speed: [3, 10], life: [0.4, 1.0], size: [0.2, 0.5] }); FX.ring(b.pos.x, b.pos.z, { r0: 1, r1: 7, color: GOLD, dur: 0.5 }); }
  }
  function* stunned(b) { const S = b.state; while (S.stun > 0) yield; }
  // while the shells are in the air Nian pads after the player (never closer than a few metres), so melee can keep hitting
  function* waitVolley(b, V, extra = 0.4) { if (!V) return; const S = b.state, p = G.player;
    while (G.now < V.land + extra) { if (p && S.stun <= 0 && !b.castState) { const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z, d = Math.hypot(dx, dz); if (d > 3.6) { const k = Math.min(1, 4.2 * G.dt / d); b.pos.x += dx * k; b.pos.z += dz * k; S.walk += G.dt * 8; } } yield; }
    if (S.vol === V) S.vol = null; }

  // ---------- Nian's own kit ----------
  function* pounce(b) {
    const S = b.state, p = G.player; yield* stunned(b);
    const h = Hz.circle(p.pos.x, p.pos.z, 4.4, 1.35, 320, { name: 'Pounce', lock: 0.85, track(s) { s.x = p.pos.x; s.z = p.pos.z; }, onFire() { Sound.sfx('boom', 0.9, 0.7); FX.shake(0.5); } });
    const r = yield* b.cast({ name: 'Pounce', time: 0.75 }); if (r !== 'done') { Hz.cancel(h); return; }
    const x0 = b.pos.x, z0 = b.pos.z; for (let t = 0; t < 0.6; t += G.dt) { const q = smooth(t / 0.6); b.pos.x = lerp(x0, h.shape.x, q); b.pos.z = lerp(z0, h.shape.z, q); S.hopY = Math.sin(q * PI) * 5; yield; } S.hopY = 0;
    if (!G.headless) { FX.ring(b.pos.x, b.pos.z, { r0: 1.5, r1: 6, color: 0xd8b080, dur: 0.28, width: 0.05, mult: 1.2 }); FX.burst(b.pos.x, 0.4, b.pos.z, { n: 28, color: 0xff3020, color2: GOLD, speed: [4, 11], up: 5, life: [0.3, 0.8], size: [0.12, 0.3] }); FX.burst(b.pos.x, 0.3, b.pos.z, { n: 10, smoke: true, color: 0x5a4a40, color2: 0x2a2420, speed: [2, 5], up: 1, life: [0.6, 1.2], size: [0.8, 1.6], alpha: 0.35 }); }
    yield 0.7;
  }
  function* sweep(b) {
    const S = b.state; yield* stunned(b); const dir = b.angToPlayer(); b.autoFace = false;
    const h = Hz.cone(b.pos.x, b.pos.z, dir, 2.4, 9.5, 1.2, 300, { name: 'Tail Sweep', onFire() { Sound.sfx('sword', 0.9, 0.6); FX.shake(0.4); S.spin = 1; } });
    const r = yield* b.cast({ name: 'Tail Sweep', time: 1.2 }); if (r !== 'done') Hz.cancel(h); yield 0.5; b.autoFace = true;
  }
  function* toss(b, n = 3) {
    const S = b.state, p = G.player; yield* stunned(b); const r = yield* b.cast({ name: 'Lantern Toss', time: 0.8 }); if (r !== 'done') return;
    for (let k = 0; k < n; k++) { const a = rnd(TAU), d = k ? rnd(2, 8) : 0, x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; if (Math.hypot(x, z) > R - 2) continue;
      if (!G.headless) FX.missile(new V3(b.pos.x, 3.5, b.pos.z), new V3(x, 0.3, z), { speed: 22, arc: 6, color: 0xff8030, size: 0.4 });
      Hz.zone({ type: 'circle', x, z, r: 3 }, 4, 80, { name: 'Lantern Fire', color: 0xff7028, delay: 1.2 }); yield 0.3; }
    yield 0.6;
  }
  function* stampede(b, legs = 3) {
    const S = b.state, p = G.player; yield* stunned(b); b.autoFace = false;
    let x = b.pos.x, z = b.pos.z; const path = [];
    for (let k = 0; k < legs; k++) { let a = k === 0 ? angTo(x, z, p.pos.x, p.pos.z) : rnd(TAU), len = 16; for (let t = 0; t < 12; t++) { const nx = x + Math.sin(a) * len, nz = z + Math.cos(a) * len; if (Math.hypot(nx, nz) < R - 2.5) break; a = angTo(x, z, 0, 0) + rnd(-0.8, 0.8); len = 14; } path.push({ x, z, a, len }); Hz.rect(x, z, a, len, 4.6, 1.3 + k * 0.55, 330, { name: 'Stampede', quiet: k > 0 }); x += Math.sin(a) * len; z += Math.cos(a) * len; }
    const r = yield* b.cast({ name: 'Stampede', time: 1.3 }); if (r !== 'done') { b.autoFace = true; return; }
    for (const q of path) { b.facing = q.a; Sound.sfx('dash', 0.8, 0.6); for (let t = 0; t < 0.5; t += G.dt) { const k = t / 0.5; b.pos.x = q.x + Math.sin(q.a) * q.len * k; b.pos.z = q.z + Math.cos(q.a) * q.len * k; S.walk += G.dt * 30;
        if (!G.headless) { if (vrand() < G.dt * 30) FX.burst(b.pos.x, 0.3, b.pos.z, { n: 3, smoke: true, color: 0x5a4a40, color2: 0x2a2420, speed: [1, 3], up: 1.5, life: [0.4, 0.9], size: [0.5, 1.1], alpha: 0.35 }); if (vrand() < G.dt * 24) FX.burst(b.pos.x, 0.5, b.pos.z, { n: 3, color: 0xc81e14, color2: GOLD, speed: [2, 6], up: 4, life: [0.5, 1.2], size: [0.12, 0.22] }); }
        yield; } b.pos.x = q.x + Math.sin(q.a) * q.len; b.pos.z = q.z + Math.cos(q.a) * q.len; yield 0.05; }
    yield 0.6; b.autoFace = true;
  }
  function* rockets(b, waves = 2) {
    yield* stunned(b); const r = yield* b.cast({ name: 'Bottle Rockets', time: 0.8 }); if (r !== 'done') return;
    for (let w = 0; w < waves; w++) { const a = rnd(TAU), sx = Math.sin(a), sz = Math.cos(a), gap = rndi(-3, 3); for (let i = -6; i <= 6; i++) { if (Math.abs(i - gap) <= 1) continue; Bul.fire({ x: -sx * 24 + sz * i * 2.6, z: -sz * 24 - sx * i * 2.6, dir: a, speed: 13, r: 0.36, dmg: 130, color: pick([0xff5050, 0xffc840, 0x60c0ff]), life: 4 }); } Sound.sfx('laser', 0.6, 1.4); yield 1.2; }
    yield 0.4;
  }
  // Feast: only the keeper shell landing on him stops it. The planner chose where he plants himself.
  function* feast(b, V) {
    const S = b.state; if (!V || !V.spot) return; yield* stunned(b);
    const [x, z] = V.spot, x0 = b.pos.x, z0 = b.pos.z; for (let t = 0; t < 0.6; t += G.dt) { const q = smooth(t / 0.6); b.pos.x = lerp(x0, x, q); b.pos.z = lerp(z0, z, q); S.hopY = Math.sin(q * PI) * 4; yield; } S.hopY = 0;
    const time = Math.max(1.5, V.land - G.now + 0.5); S.jawOpen = 1;
    const r = yield* b.cast({ name: 'Feast', time }); S.jawOpen = 0;
    if (r === 'done') { const p = G.player; Sound.sfx('roar', 1, 0.5); FX.flash(RED, 0.5, 1.2); FX.shake(0.9); if (p.alive) p.hurt(450, { blockable: false, src: { name: 'Feast' } }); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.025); if (!G.headless) FX.ring(b.pos.x, b.pos.z, { r0: 1, r1: 30, color: RED, dur: 0.7 }); yield 0.6; }
    else yield* stunned(b);
  }
  // Rekindle: relights the spark the player stamped and lifts the white-hot lock, so they must stamp again.
  function* roar(b) {
    const S = b.state; yield* stunned(b); S.jawOpen = 1; const r = yield* b.cast({ name: 'Rekindle', time: 2.4, interruptible: true }); S.jawOpen = 0;
    if (r === 'done') { Sound.sfx('roar', 1, 0.8); const V = S.vol, sp = V && V.lock;
      if (sp && G.now < V.arrive - 0.5) { sp.alive = true; sp.speed = (sp.P.len - sp.s) / Math.max(0.6, (sp.big ? V.land + 0.3 : V.arrive) - G.now); sp.m = S.sparkPool.find((q) => !q.visible); if (sp.m) sp.m.visible = true; if (sp.to >= 0) S.mortars[sp.to].armed = true;
        V.lock = null; for (const o of V.sparks) if (o.alive) { o.locked = false; sparkLook(o); }
        if (!G.headless) { const q = at(sp.P, sp.s, [0, 0]); FX.burst(q[0], 0.4, q[1], { n: 24, color: sp.col || GOLD, color2: 0xffffff, speed: [2, 6], up: 4, life: [0.3, 0.7], size: [0.12, 0.3] }); } } }
    yield 0.5;
  }
  // Nian waits for the player to commit, then tries to undo it. Never late in the fuse.
  function* rekindleWatch(b, V) { while (V && !V.lock && G.now < V.arrive - 4.6) yield; if (V && V.lock && G.now < V.arrive - 4.2 && b.state.vol === V) yield* roar(b); }

  // one volley with Nian's moves around it: an opener at the start of the fuse, nothing that moves the player late, then
  // straight back to the player once it lands so melee isn't chasing him out of a pocket
  const OPEN = [pounce, sweep];
  function* volley(b, pl, o) {
    const S = b.state; if (!pl) { yield 1; return; }
    const V = startVolley(b, pl, o);
    if (pl.arch === 'B') yield* feast(b, V);
    else { if (!o.calm) { if (!S.obag || !S.obag.length) S.obag = shuffle([0, 1]); yield* OPEN[S.obag.pop()](b); } if (o.rekindle) yield* rekindleWatch(b, V); }
    yield* waitVolley(b, V, 0.2); yield* pounce(b);
  }
  // Nian's own moves between volleys, drawn from a shuffled bag so the order changes every run
  const FILL = [
    [(b) => toss(b, 3), (b) => stampede(b, 2), (b) => rockets(b, 1), sweep],
    [(b) => toss(b, 3), (b) => stampede(b, 3), (b) => rockets(b, 2), sweep],
    [(b) => stampede(b, 3), (b) => rockets(b, 1), (b) => toss(b, 2), sweep],
  ];
  function* filler(b, n, count) { const S = b.state; for (let i = 0; i < count; i++) { if (!S.bag || !S.bag.length) S.bag = shuffle(FILL[n].map((_, j) => j)); yield* FILL[n][S.bag.pop()](b); } }

  function setAct(b, n) {
    const S = b.state; S.lvl = n; S.hopY = 0; S.jawOpen = 0; b.autoFace = true;
    for (const sp of S.sparks) { sp.alive = false; if (sp.m) sp.m.visible = false; } S.sparks.length = 0; S.vol = null; for (const m of S.mortars) m.armed = false;
    for (const P of S.allF) P.burn = -1;
    if (S.act !== n) { S.act = n; makeLayout(S, n); S.bag = null; S.obag = null; }
    S.mortars.forEach((m, k) => m.bm.color.setHex(TYPES[S.types[k]]).multiplyScalar(1.3)); for (const F of S.forks) F.mesh.visible = false; S.spiral.mesh.visible = S.big.visible = n >= 2;
  }
  function look(b, n, instant) { const S = b.state; S.lookN = n; if (instant) { S.mood = n; if (!G.headless) Post.set(Object.assign({}, b.def.post, POST[n])); } }
  // the phase mood: sky, fog, light, lanterns, cloth heat, embers, all eased toward the current act
  function mood(S, dt, t) {
    const mo = clamp(S.mood, 0, 2), i = Math.min(1, Math.floor(mo)), f = mo - i, C = (k, out) => out.lerpColors(MC[k][i], MC[k][i + 1], f), N = (k) => lerp(MOOD[k][i], MOOD[k][i + 1], f);
    const U = S.sky.material.uniforms; C('top', U.uTop.value); C('hor', U.uHor.value); C('cloudCol', U.uCloudCol.value); C('cloudDark', U.uCloudDark.value); U.uCloud.value = N('cloud');
    C('fog', S.fog.color); C('hemiS', S.hemi.color); C('hemiG', S.hemi.groundColor); S.hemi.intensity = N('hemiI');
    const strobe = Math.max(0, mo - 1.2), beat = Math.exp(-((t * 2.1) % 1) * 6) * clamp(mo, 0, 1);
    C('lamp', _c); S.lamps.forEach((L, k) => { L.color.copy(_c); L.intensity = N('lampI') * (1 + strobe * 0.3 * Math.sin(t * 13 + k * 2) + beat * 0.08); });
    const LU = S.lanM.uniforms; C('lanCol', LU.uCol.value); C('lanHot', LU.uHot.value); LU.uI.value = N('lanI') * (1 + beat * 0.08); LU.uFl.value = 0.12 + strobe * 0.6; LU.uT.value = t;
    C('halo', S.lanHalo.material.uniforms.uCol.value).multiplyScalar(0.2 + beat * 0.05); C('halo', S.reflM.uniforms.uCol.value).multiplyScalar(0.5);
    const SU = S.skyLM.uniforms; C('skyL', SU.uHot.value); SU.uT.value = t; SU.uI.value = 0.85;
    S.heatU.value = N('heat'); C('rim', S.rimC.value); C('moon', S.moonM.material.uniforms.uCol.value);
    const A = S.atmos.material.uniforms; C('warm', A.uWarm.value); A.uWarmK.value = N('warmK'); C('red', A.uRed.value); A.uFw.value.multiplyScalar(Math.exp(-dt * 2.5));
    S.embers.material.uniforms.uAlpha.value = N('ember'); S.embers.visible = N('ember') > 0.01; S.paper.material.uniforms.uAlpha.value = N('paper'); S.paper.visible = N('paper') > 0.01;
    S.swing = N('swing'); const WU = S.water.material.uniforms; C('seaSun', WU.uSunCol.value); C('seaSky', WU.uSky.value); C('seaGlow', WU.uGlow.value);
    C('smoke', S.smokeM.uniforms.uCol.value); S.smokeM.uniforms.uA.value = N('smokeA'); S.smoke.visible = N('smokeA') > 0.01; S.hoopM.emissiveIntensity = beat * 0.35;
    if (!G.headless && G.state === 'fight' && (S.ambT -= dt) <= 0) { S.ambT = lerp(N('ambA'), N('ambB'), vrand()); ambientBurst(S, N('dim')); }
  }

  G.bosses.push({
    id: 'festival', name: 'NIAN', title: 'The Year-Eater', hint: 'Loud and bright', color: '#ffb060', telegraph: 0xff5a30,
    hp: 28000, radius: 1.9, aimY: 2.4, enrage: 440,
    post: Object.assign({ threshold: 0.86, radius: 0.75 }, POST[0]),
    music: { bpm: 126, root: 41, scale: [0, 2, 4, 7, 9], prog: [0, 0, 3, 2, 0, 4, 3, 1],
      layers: [
        { v: 'koto', pat: ['0.2.4.2.0.4.2.1.', '4.2.0.2.4.3.2.0.'], oct: 1, len: 1, vol: 0.08 }, { v: 'clap', pat: '....x.......x...', vol: 0.1 }, { v: 'tom', pat: 'x..x..x.x..x..x.', vol: 0.13 }, { v: 'flute', pat: ['0.......2...4...', '3.......2...0...'], oct: 2, len: 5, vol: 0.05 },
        { v: 'taiko', from: 1, pat: 'x...x..xx...x.x.', vol: 0.22 }, { v: 'brass', from: 1, pat: ['0.......3.......', '4.......2.......'], oct: 0, len: 7, vol: 0.1 }, { v: 'bass', from: 1, pat: '0..0..0.0..0..2.', oct: -1, len: 1, vol: 0.12 },
        { v: 'arp', from: 2, pat: '0241024302410243', oct: 2, len: 1, vol: 0.045 }, { v: 'taiko', from: 2, pat: 'x.xxx.x.x.xxx.xx', vol: 0.2 }, { v: 'choir', from: 2, pat: '0.......4.......', oct: 1, len: 8, vol: 0.06 },
      ] },
    build,
    *intro(b) { const S = b.state; Sound.sfx('roar', 0.6, 0.9); Co.start(function* () { yield 1.2; skyBurst(S, -8, 34, -20, 'peony', TYPES.peony); yield 0.8; skyBurst(S, 10, 38, -26, 'ring', TYPES.ring); yield 0.9; skyBurst(S, 0, 42, -30, 'willow', TYPES.willow); }, 'fight'); yield* Cam.shot([16, 3, 22], [0, 10, -10], [4, 3.2, 3], [0, 3, -7], 5.2, 48); },
    *death(b) {
      const S = b.state, a = Cam.yaw + 0.5; Cam.cine = { pos: new V3(b.pos.x - Math.sin(a) * 20, 5, b.pos.z - Math.cos(a) * 20), look: new V3(b.pos.x, 12, b.pos.z), fov: 54 };
      S.dead = true; Sound.sfx('roar', 1, 0.5); const order = shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
      for (let i = 0; i < 8; i++) { const k = order[i], [ax, az] = mPos(k, MR * 0.5); skyBurst(S, ax, 26 + (i % 3) * 5, az, ['peony', 'ring', 'willow', 'cross'][i % 4], Object.values(TYPES)[i % 5]); Sound.sfx('bigboom', 0.6, 1.2 + (i % 3) * 0.2); FX.flash(Object.values(TYPES)[i % 5], 0.1, 3); yield 0.09; }
      skyBurst(S, 0, 40, 0, 'big', GOLD); yield 0.5;
    },
    phases: [
      { at: 1, *run(b) {
        const S = b.state, c = ACT[0]; setAct(b, 0); yield 1.0;
        // the fixed teaching opener: long ground warning, no stamp needed until the two yellows
        for (const pl of teach(S)) { yield* volley(b, pl, { T: pl.lit.length === 1 ? 6 : c.T, warn: 1.6, calm: pl.lit.length === 1 }); if (pl.lit.length > 1) yield* filler(b, 0, 1); }
        let warn = 1.45;
        while (true) { yield* volley(b, pickPlan(S, 'A'), { T: c.T, warn }); warn = Math.max(c.warn, warn - 0.15); yield* filler(b, 0, 1); }
      } },
      { at: 0.66, skipTo(b) { look(b, 1, true); },
        *enter(b) {
          const S = b.state; setAct(b, 1); S.stun = 0; S.jawOpen = 1; yield* b.moveTo(0, 0, 14);
          yield* b.cast({ name: 'New Year', time: 2.0, onTick: (k) => FX.shake(k * 0.25) }); S.jawOpen = 0; Sound.sfx('roar', 1, 0.7); FX.flash(RED, 0.3, 1);
          for (let k = 0; k < 8; k++) if (!G.headless) FX.pillar(S.mortars[k].x, S.mortars[k].z, { r: 0.9, h: 10, color: TYPES[S.types[k]], dur: 0.8 });
          Co.start(Post.lerpTo(POST[1], 3), 'fight'); yield 1.2;
        },
        *run(b) {
          const S = b.state, c = ACT[1]; setAct(b, 1); yield 0.5;
          while (true) { const a = nextArch(S, { A: 0.85, C: 0.15 }); yield* volley(b, pickPlan(S, a), { T: c.T, warn: c.warn, rekindle: a === 'A' && rnd() < 0.4 }); yield* filler(b, 1, rndi(1, 2)); }
        } },
      { at: 0.33, skipTo(b) { look(b, 2, true); },
        *enter(b) {
          const S = b.state; setAct(b, 2); S.stun = 0; S.jawOpen = 1; yield* b.moveTo(4, 4, 14);
          yield* b.cast({ name: 'Grand Finale', time: 2.2, onTick: (k) => FX.shake(k * 0.3) }); S.jawOpen = 0; Sound.sfx('roar', 1, 0.5); FX.flash(GOLD, 0.35, 1);
          for (let k = 0; k < 8; k++) if (!G.headless) FX.pillar(S.mortars[k].x, S.mortars[k].z, { r: 0.9, h: 10, color: TYPES[S.types[k]], dur: 0.8 });
          skyBurst(S, 0, 36, 0, 'big', GOLD); Co.start(Post.lerpTo(POST[2], 3), 'fight'); yield 1.0;
        },
        *run(b) {
          const S = b.state, c = ACT[2]; setAct(b, 2); yield 0.4;
          while (true) { const a = nextArch(S, { A: 0.55, C: 0.15, D: 0.3 }); yield* volley(b, pickPlan(S, a), { T: c.T, warn: c.warn, comet: a !== 'D' && rnd() < 0.5, rekindle: (a === 'A' || a === 'D') && rnd() < 0.35 }); yield* filler(b, 2, rndi(1, 2)); }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight';
      S.fwM.uniforms.uTime.value = S.fwM2.uniforms.uTime.value = t; S.fwM.uniforms.uPx.value = S.fwM2.uniforms.uPx.value = renderer.getPixelRatio() * (innerHeight / 720) * 2.2; S.tU.value = t;
      S.mood = damp(S.mood, S.lvl, 1.1, dt); mood(S, dt, t);
      // sparks
      const q = [0, 0];
      for (let i = S.sparks.length - 1; i >= 0; i--) {
        const sp = S.sparks[i]; if (!sp.alive) { if (!sp.vol || G.now > sp.vol.land) S.sparks.splice(i, 1); continue; }
        sp.s += sp.speed * dt;
        at(sp.P, sp.s, q); if (sp.m) { sp.m.position.set(q[0], 0.3, q[1]); const fl = 0.8 + Math.sin(t * 40 + i) * 0.25; sp.m.children[1].scale.setScalar(fl * (sp.locked ? 1.25 : 1)); if (sp.locked) { const rg = sp.m.userData.rg; rg.scale.setScalar(0.9 + Math.sin(t * 17 + i) * 0.15); rg.rotation.z = t * 4; } }
        if (!G.headless && vrand() < dt * 55) FX.burst(q[0], 0.35, q[1], { n: 2, color: sp.locked ? 0xffffff : (sp.col || 0xffd070), color2: sp.locked ? (sp.col || 0xffd070) : 0xff7a20, speed: [1.5, 5], up: 3, life: [0.2, 0.55], size: [0.08, 0.2] });
        // stamped out? White-hot (locked) sparks can't be.
        if (fight && p && p.alive && !sp.locked && Math.hypot(p.pos.x - q[0], p.pos.z - q[1]) < 1.15 && p.pos.y < 1.2) { stampOut(S, sp, q[0], q[1]); continue; }
        if (sp.s >= sp.P.len) { sp.alive = false; if (sp.m) { sp.m.visible = false; sp.m = null; }
          if (sp.big) { Sound.sfx('bigboom', 1, 0.5); const sm = { x0: 0, z0: 0, x1: 0, z1: 0, t: 0, type: 'big', col: GOLD, k: -1, m: S.shellPool.find((o) => !o.visible) }; if (sm.m) { sm.m.visible = true; shellLook(sm.m, GOLD, 2.5); } S.shells.push(sm); }
          else launch(b, sp.to, sp.vol); }
      }
      // fuse state: burnt behind each spark, glowing ahead of it
      for (const P of S.allF) P.cur = -1;
      for (const sp of S.sparks) if (sp.alive && sp.P && sp.s > sp.P.cur) sp.P.cur = sp.s;
      for (const P of S.allF) { if (P.cur >= 0) P.burn = P.cur; P.u.uS.value = P.cur; P.u.uBurn.value = P.burn; }
      for (let i = S.shells.length - 1; i >= 0; i--) {
        const sh = S.shells[i]; sh.t += dt / 1.2; const k = Math.min(1, sh.t), e = 1 - (1 - k) * (1 - k);
        if (sh.m) { sh.m.position.set(lerp(sh.x0, sh.x1, e), 1.5 + e * 28.5, lerp(sh.z0, sh.z1, e)); if (!G.headless && vrand() < dt * 40) FX.burst(sh.m.position.x, sh.m.position.y - 0.4, sh.m.position.z, { n: 1, color: sh.col, color2: 0xffe0a0, speed: [0, 1.5], up: -1, life: [0.25, 0.6], size: [0.1, 0.25] }); }
        if (sh.t >= 1) { if (sh.m) sh.m.visible = false; S.shells.splice(i, 1);
          if (sh.type === 'big') { skyBurst(S, 0, 36, 0, 'big', GOLD); FX.flash(GOLD, 0.2, 2); Hz.circle(0, 0, R + 2, 1.6, 600, { name: 'Dragon Shell', color: GOLD, blockable: false, tag: 'fight', onFire() { Sound.sfx('bigboom', 1, 0.4); FX.shake(1); } }); }
          else if (fight) burst(b, sh); }
      }
      S.mortars.forEach((m, k) => { m.kick = Math.max(0, m.kick - dt * 3); const base = TYPES[S.types[k]]; m.bm.color.setHex(base).multiplyScalar(m.armed ? (1.25 + Math.sin(t * 9) * 0.35) * (1 - 0.2 * clamp(S.mood - 1, 0, 1)) : 0.55); m.tg.position.y = 1.15 - m.kick * 0.12; });
      if (!G.headless) {
        // sky lanterns
        for (let i = 0; i < S.NL; i++) { const L = S.lan[i]; L.y += L.v * dt; if (L.y > 110) L.y = 2; const a = L.a + Math.sin(t * 0.1 + L.ph) * 0.05; _m.position.set(Math.sin(a) * L.d + Math.sin(t * 0.4 + L.ph) * 1.5, L.y, Math.cos(a) * L.d); _m.rotation.set(0, L.ph, Math.sin(t * 0.7 + L.ph) * 0.1); _m.scale.setScalar(L.s); _m.updateMatrix(); S.skyLan.setMatrixAt(i, _m.matrix); } S.skyLan.instanceMatrix.needsUpdate = true;
        // rail lanterns swing on the string
        const sw = S.swing; S.lanA.forEach((A, k) => { _q.setFromEuler(_e.set(Math.sin(t * 1.1 + k * 1.3) * sw * 0.6, A.a, Math.sin(t * 1.4 + k * 0.7) * sw)); _m4.compose(_p.set(A.x, A.y, A.z), _q, _s.set(1, 1, 1));
          S.lanBody.setMatrixAt(k, _m5.multiplyMatrices(_m4, S.lanL[0])); S.lanCap.setMatrixAt(k * 2, _m5.multiplyMatrices(_m4, S.lanL[1])); S.lanCap.setMatrixAt(k * 2 + 1, _m5.multiplyMatrices(_m4, S.lanL[2])); S.lanTas.setMatrixAt(k, _m5.multiplyMatrices(_m4, S.lanL[3])); S.lanHalo.setMatrixAt(k, _m5.multiplyMatrices(_m4, S.lanL[4])); });
        for (const m of [S.lanBody, S.lanCap, S.lanTas, S.lanHalo]) m.instanceMatrix.needsUpdate = true;
        // banner poles fade when they stand between the camera and the player or the beast
        const cp = camera.position; if (p) for (const P of S.poles) { let hit = false; for (const tg of [[p.pos.x, p.pos.y + 1.2, p.pos.z], [b.pos.x, 2, b.pos.z]]) { const sx = tg[0] - cp.x, sy = tg[1] - cp.y, sz = tg[2] - cp.z, l2 = Math.max(sx * sx + sy * sy + sz * sz, 1e-6); for (const y of [2, 4.5, 7]) { const k = clamp(((P.x - cp.x) * sx + (y - cp.y) * sy + (P.z - cp.z) * sz) / l2, 0, 0.97), dx = cp.x + sx * k - P.x, dy = cp.y + sy * k - y, dz = cp.z + sz * k - P.z; if (dx * dx + dy * dy + dz * dz < 2.2) hit = true; } }
          P.a = damp(P.a, hit ? 0.12 : 1, 8, dt); for (const m of P.mats) m.opacity = P.a; }
        if (S.smoke.visible) { S.smokeP.forEach((P, i) => { P.a += P.v * dt; _m.position.set(Math.sin(P.a) * P.d, P.y, Math.cos(P.a) * P.d); _m.rotation.set(0, 0, 0); _m.scale.setScalar(P.s); _m.updateMatrix(); S.smoke.setMatrixAt(i, _m.matrix); }); S.smoke.instanceMatrix.needsUpdate = true; }
      }
      // Nian: see-through window around the player
      if (!G.headless && p) { _a.set(p.pos.x, p.pos.y + 1.1, p.pos.z); _b.copy(_a).applyMatrix4(camera.matrixWorldInverse); const dep = Math.max(-_b.z, 1); _a.project(camera); renderer.getDrawingBufferSize(_v2); S.winU.value.set((_a.x * 0.5 + 0.5) * _v2.x, (_a.y * 0.5 + 0.5) * _v2.y, 1.45 / (dep * Math.tan(camera.fov * PI / 360)) * _v2.y * 0.5, dep - 0.7); }
      if (S.stun > 0) { S.stun -= dt; b.dmgTaken = 1.5; } else b.dmgTaken = 1;
      S.stars.visible = S.stun > 0; S.stars.rotation.z = t * 5;
      S.jawK = damp(S.jawK, S.jawOpen ? 1 : (b.castState ? 0.4 : 0.1 + Math.max(0, Math.sin(t * 3)) * 0.15), 10, dt); S.jaw.rotation.x = S.jawK * 0.7;
      S.spin = Math.max(0, (S.spin || 0) - dt * 2.2);
      S.head.position.y = 2.75 + (S.hopY || 0) + Math.sin(t * 5) * 0.08; S.head.rotation.z = S.stun > 0 ? Math.sin(t * 22) * 0.2 : Math.sin(t * 2.5) * 0.08; S.head.rotation.y = S.spin * TAU;
      S.poms.forEach((pm, i) => { pm.rotation.x = Math.sin(t * 7 + i * 1.3) * 0.2 + S.jawK * 0.15; pm.rotation.z = pm.userData.rz + Math.cos(t * 6 + i) * 0.16; });
      if (S.tail) { S.tail.rotation.y = Math.sin(t * 3.2) * 0.5; S.tail.rotation.x = Math.sin(t * 4.1) * 0.15; }
      const heat = S.heatU.value; S.eyeM.emissiveIntensity = heat * 0.9; S.mawM.emissiveIntensity = 0.1 + S.jawK * (0.5 + heat * 1.5); S.flameM.uniforms.uA.value = clamp((heat - 0.7) * 3.3, 0, 1) * (1 + S.jawK * 0.4); S.flame.visible = heat > 0.71;
      if (!G.headless && heat > 0.8 && vrand() < dt * 14) FX.burst(b.pos.x + Math.sin(b.facing) * 1.1 + (vrand() - 0.5) * 2, 3.4 + (S.hopY || 0), b.pos.z + Math.cos(b.facing) * 1.1 + (vrand() - 0.5) * 2, { n: 2, color: 0xffa030, color2: 0xff4010, speed: [0.5, 2], up: 3, life: [0.4, 0.9], size: [0.08, 0.18] });
      const hx = b.pos.x, hz = b.pos.z, last = S.path[0]; if (!last || Math.hypot(hx - last[0], hz - last[1]) > 0.25) { S.path.unshift([hx, hz]); if (S.path.length > 60) S.path.length = 60; S.walk += 1.2; }
      S.segs.forEach((s, i) => { // body follows the path the head took
        const want = (i + 1) * 1.7; let acc = 0, px = hx, pz = hz, tx = hx - Math.sin(b.facing) * want, tz = hz - Math.cos(b.facing) * want;
        for (const pt of S.path) { const d = Math.hypot(pt[0] - px, pt[1] - pz); if (acc + d >= want) { const k = (want - acc) / (d || 1); tx = lerp(px, pt[0], k); tz = lerp(pz, pt[1], k); acc = want; break; } acc += d; px = pt[0]; pz = pt[1]; }
        if (acc < want) { const rem = want - acc; tx = px - Math.sin(b.facing) * rem; tz = pz - Math.cos(b.facing) * rem; }
        const prev = i ? S.segs[i - 1].position : _a.set(hx, 0, hz); s.position.set(tx, (S.hopY || 0) * Math.max(0, 1 - (i + 1) * 0.22) + Math.sin(t * 5 - i) * 0.06, tz); s.rotation.y = Math.atan2(prev.x - tx, prev.z - tz) + S.spin * TAU * (1 - i * 0.1);
        s.legs.forEach((h, j) => { h.rotation.x = Math.sin(S.walk * 0.9 + i * 1.3 + j * PI) * 0.6; }); s.visible = !S.dead || true; });
      S.light.intensity = 14 + S.jawK * 26;
    },
    bot(b, p) {
      const S = b.state, V = S.vol, q = [0, 0]; if (!V || G.now > V.land + 0.1) return {};
      const live = V.sparks.filter((sp) => sp.alive), goal = !V.lock && V.answer !== null && V.answer !== undefined ? live.find((sp) => V.answer === -1 ? sp.big : sp.to === V.answer) : null;
      const avoid = (x, z) => live.some((sp) => sp !== goal && !sp.locked && [0, 0.4].some((dt) => { at(sp.P, sp.s + sp.speed * dt, q); return Math.hypot(q[0] - x, q[1] - z) < 1.8; }));
      // walk round sparks it must not stamp: if one sits on the straight line to the target, aim beside it instead
      const detour = (tx, tz, w) => { const px = p.pos.x, pz = p.pos.z, lx = tx - px, lz = tz - pz, L = Math.hypot(lx, lz) || 1, ux = lx / L, uz = lz / L;
        // a spark about to run into us: step off its fuse sideways
        for (const sp of live) { if (sp === goal || sp.locked) continue; for (const dt of [0, 0.25, 0.5]) { at(sp.P, sp.s + sp.speed * dt, q); if (Math.hypot(q[0] - px, q[1] - pz) > 1.7) continue;
          const a = at(sp.P, sp.s + sp.speed * dt + 0.5, [0, 0]), fx = a[0] - q[0], fz = a[1] - q[1], fl = Math.hypot(fx, fz) || 1, sg = ((px - q[0]) * fz - (pz - q[1]) * fx) > 0 ? 1 : -1;
          return { x: px + fz / fl * sg * 2.5, z: pz - fx / fl * sg * 2.5, w: w + 2, avoid }; } }
        for (const sp of live) { if (sp === goal || sp.locked) continue; for (const dt of [0, 0.35]) { at(sp.P, sp.s + sp.speed * dt, q); const rx = q[0] - px, rz = q[1] - pz, al = rx * ux + rz * uz, sd = rx * uz - rz * ux;
          if (al > -0.5 && al < L + 0.5 && Math.abs(sd) < 1.8) { const sg = sd > 0 ? -1 : 1; return { x: q[0] + uz * sg * 2.6, z: q[1] - ux * sg * 2.6, w: w + 2, avoid }; } } }
        return { x: tx, z: tz, w, avoid }; };
      // meet the spark further along its fuse, at the first point it can be reached before it gets there
      if (goal && (goal.big || G.now < V.arrive - 0.2)) { let ok = false; for (let dt = 0.3; dt < 8 && !ok; dt += 0.1) { if (goal.s + goal.speed * dt > goal.P.len) break; at(goal.P, goal.s + goal.speed * dt, q); ok = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z) - 0.9 <= SPD * dt; } if (!ok) at(goal.P, goal.s + goal.speed * 0.4, q); return Object.assign(detour(q[0], q[1], 6), { holdFire: Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z) > 2.5 }); }
      // what will still fire, and the biggest safe patch it leaves
      const firing = V.fuses.filter((k) => V.fired.includes(k) || live.some((sp) => sp.to === k)), e = evalSet(S, firing);
      if (!e.big.length) return { avoid };
      const inP = new Set(e.big), deep = e.big.filter((c) => NBR[c].length === 4 && NBR[c].every((j) => inP.has(j))), use = deep.length ? deep : e.big;
      let s = null, sd = Infinity; for (const c of use) { const [x, z] = GRID[c], d = Math.hypot(x - p.pos.x, z - p.pos.z) + Math.hypot(x - b.pos.x, z - b.pos.z) * 0.2; if (d < sd) { sd = d; s = GRID[c]; } }
      return detour(s[0], s[1], 4);
    },
  });
  G.festTest = { inShape: Hz.inShape, shapesOf, evalSet, kind, buildPools, makeLayout, nextArch, pickPlan, teach, reachOK, ACT, RISE, SURV, DEAD, TIGHT }; // planner hooks for tools/festsoak.js
})();
