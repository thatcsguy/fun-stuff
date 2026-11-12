// DOOR IX: IRONJAW, the Midnight Express. A fight along the roof of a moving train. The country it runs through is trying to kill you too.
(() => {
  const HW = 5, LANE = 3.35, FIRE = 0xff6a1a, SIGNAL = 0xff3020, GY = -2.7, Z0 = -40, LEN = 62, TELL = 0xffbe50, LANEC = 0xc8303c;
  const CARS = [['T', -40, -26], ['A', -24, -10], ['B', -8, 6], ['C', 8, 22]];
  const _a = new V3(), _b2 = new V3(), _m = new THREE.Object3D();

  const carAt = (S, x, z) => Math.abs(x) > HW ? null : S.cars.find((c) => c.on && z >= c.z0 + c.off && z <= c.z1 + c.off) || null;
  function gapAt(S, x, z) { if (Math.abs(x) > HW) return null; for (let i = 0; i < 3; i++) { const a = S.cars[i], c = S.cars[i + 1]; if (a.on && c.on && !a.loose && !c.loose && z > a.z1 && z < c.z0) return [a, c]; } return null; }
  const car = (S, id) => S.cars.find((c) => c.id === id);
  const live = (S) => S.cars.filter((c) => c.on && !c.loose);

  // ---------- look helpers ----------
  // cold moonlight edge (fresnel, biased to up-facing surfaces) added to a standard material, against the furnace orange
  function rimify(mat, rimObj, power = 2.4, k = 1) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: rimObj };
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim;\nvoid main() {').replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0); vec3 wn = inverseTransformDirection(normal, viewMatrix);' +
        ' totalEmissiveRadiance += uRim * ' + k.toFixed(2) + ' * pow(max(fr, 0.0), ' + power.toFixed(2) + ') * (0.45 + 0.55 * smoothstep(-0.3, 0.8, wn.y)); }');
    };
    mat.customProgramCacheKey = () => 'xrim' + power + '_' + k; return mat;
  }
  // sedimentary rock: banded tones from mesh-local height (periodic in z so scrolling scenery can wrap), lit rim on top edges
  function strataify(mat, rimObj, sc = 0.16) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: rimObj };
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vSW;\nvoid main() {').replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 sw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n sw = instanceMatrix * sw;\n#endif\n vSW = sw.xyz; }');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim; varying vec3 vSW;\nfloat sH(float n){ return fract(sin(n * 91.345) * 47453.13); }\nvoid main() {').replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        { float sy = vSW.y * ${sc.toFixed(3)} + sin(vSW.z * 0.020944 + vSW.x * 0.017) * 0.9 + sin(vSW.z * 0.062832) * 0.5; float bi = floor(sy), bf = fract(sy);
          float tone = mix(0.5, 1.3, sH(bi)) * (0.78 + 0.22 * smoothstep(0.0, 0.14, bf)) * (0.9 + 0.1 * sin(vSW.x * 1.3 + vSW.z * 0.6283 + sy * 9.0));
          diffuseColor.rgb *= tone * mix(vec3(0.8, 0.74, 0.7), vec3(1.12, 0.94, 0.78), sH(bi + 7.0));
          vec3 wn = inverseTransformDirection(normal, viewMatrix); vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0);
          totalEmissiveRadiance += uRim * (pow(max(fr, 0.0), 3.0) * 0.22 + smoothstep(0.6, 0.95, wn.y) * (0.015 + 0.1 * fr)); }`);
    };
    mat.customProgramCacheKey = () => 'strata' + sc; return mat;
  }
  // riveted boiler plate: 'cols' plates around, 'rows' high, rivet rows along the horizontal seams, soot streaks
  const plates = (cols, rows, seed) => (u, v) => {
    const fu = (u * cols) % 1, fv = (v * rows) % 1, eu = Math.min(fu, 1 - fu) / cols, ev = Math.min(fv, 1 - fv) / rows, seam = smooth(sat((Math.min(eu, ev) - 0.002) / 0.008));
    const rc = cols * 7, ru = ((u * rc) % 1) - 0.5, rv = (ev - 0.024) * rc * 1.6, riv = smooth(sat(1 - Math.hypot(ru, rv) / 0.34));
    const id = W.hash2(Math.floor(u * cols), Math.floor(v * rows), seed), n = W.fbm(u * 12, v * 12, seed, 4, 12), soot = W.fbm(u * 24, v * 2.5, seed + 4, 3, 24);
    return [seam * 0.75 + riv * 0.4 + n * 0.08, (0.32 + id * 0.3 + n * 0.25 - soot * 0.3) * (0.3 + 0.7 * seam) + riv * 0.4, 0.3 + n * 0.3 + (1 - seam) * 0.35 - riv * 0.2];
  };
  const seamMask = (cols, rows) => (u, v) => { const fu = (u * cols) % 1, fv = (v * rows) % 1, e = Math.min(fv, 1 - fv) / rows; return [0, (1 - smooth(sat((e - 0.0005) / 0.004))) * (0.6 + 0.4 * Math.sin(fu * PI)), 0]; };
  function stripeTex(tall, rx, ry) {
    const c = document.createElement('canvas'); c.width = tall ? 16 : 128; c.height = tall ? 128 : 16; const x = c.getContext('2d');
    x.fillStyle = '#17130d'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#e2a41c';
    for (let i = -2; i < 10; i++) { x.beginPath(); if (tall) { x.moveTo(0, i * 16); x.lineTo(0, i * 16 + 8); x.lineTo(16, i * 16 + 16); x.lineTo(16, i * 16 + 8); } else { x.moveTo(i * 16, 16); x.lineTo(i * 16 + 8, 16); x.lineTo(i * 16 + 16, 0); x.lineTo(i * 16 + 8, 0); } x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t;
  }
  // craggy mesa / butte: a cylinder pushed in and out by noise, with a terrace and a broken top
  function crag(seed, jag = 0.22) {
    const geo = new THREE.CylinderGeometry(1, 1.4, 1, 20, 7), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ang = (Math.atan2(x, z) + PI) / TAU;
      const k = (1 + (W.fbm(ang * 6, y * 2.5 + 9, seed, 4, 6) - 0.5) * 2 * jag) * (y > 0.2 ? 0.84 : 1), ty = y > 0.49 ? (W.fbm(x * 2 + 5, z * 2 + 5, seed + 7, 3) - 0.5) * 0.16 : 0;
      P.setXYZ(i, x * k, y + ty, z * k);
    }
    geo.computeVertexNormals(); return geo;
  }
  // grate fire: rolling flames over a bed of coals, inside the furnace door
  const fireMat = () => new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uI: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uT,uI,uA; varying vec2 vUv;
      float h(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){ vec2 q=vUv*2.0-1.0; float r=length(q);
        float fl=n2(vec2(q.x*4.0,q.y*3.0-uT*3.5))*0.6+n2(vec2(q.x*9.0,q.y*7.0-uT*6.0))*0.4;
        float bed=smoothstep(0.1,-0.7,q.y), coal=smoothstep(0.3,0.75,n2(q*6.0+vec2(0.0,uT*0.3)));
        float flame=clamp(fl*1.35-0.35+bed*0.5-(q.y+1.0)*0.3,0.0,1.0);
        float e=clamp(flame*0.75+bed*coal*0.8,0.0,1.4)*smoothstep(1.0,0.8,r);
        vec3 c=mix(vec3(0.22,0.025,0.0),vec3(1.0,0.36,0.06),clamp(e,0.0,1.0))+vec3(1.0,0.75,0.4)*pow(clamp(e-0.65,0.0,1.0),2.0)*1.6;
        gl_FragColor=vec4(max(c,vec3(0.0))*uI*(0.2+e),uA); }`,
  });
  // a hot coal: black crust split by glowing cracks
  const coalMat = () => new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normalMatrix*normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uT; varying vec3 vP; varying vec3 vN;
      float h(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){ float n=n3(vP*6.0+uT*0.7); float cr=1.0-smoothstep(0.0,0.1,abs(n-0.5)); float fr=1.0-clamp(abs(vN.z),0.0,1.0);
        vec3 c=vec3(0.05,0.03,0.025)+vec3(1.0,0.5,0.1)*cr*2.4+vec3(1.0,0.32,0.04)*fr*fr*1.3; gl_FragColor=vec4(c,1.0); }`,
  });
  // the ground beside the track, smeared into streaks by speed
  const streakMat = () => new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uS: { value: 0 }, uC: { value: new THREE.Color(0x8a7e68) }, uA: { value: 0.28 } }]), fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv=uv; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
    fragmentShader: `uniform float uS,uA; uniform vec3 uC; varying vec2 vUv;
      #include <fog_pars_fragment>
      float h(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){ float x=vUv.x*70.0, ln=floor(x), w=1.0-abs(fract(x)-0.5)*2.0; float z=vUv.y*300.0+uS*(0.9+h(vec2(ln,3.0))*0.2);
        float s=smoothstep(0.7,0.98,n2(vec2(ln*1.7,z/7.0)))*step(0.45,h(vec2(ln,9.0))); float a=s*smoothstep(0.0,0.6,w)*smoothstep(1.0,0.55,vUv.x)*smoothstep(0.0,0.08,vUv.x)*uA;
        gl_FragColor=vec4(uC*(0.6+0.4*h(vec2(ln,1.0))),a);
        #include <fog_fragment>
      }`,
  });

  const VUV = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
  const N2 = 'float h(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }\n float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }\n';
  const sm = (u, frag, o = {}) => new THREE.ShaderMaterial(Object.assign({ uniforms: u, vertexShader: VUV, fragmentShader: frag }, o));
  const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
  // hot piston rod: white-yellow core facing you, falling to dark red at the silhouette
  const rodMat = (u) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform float uI,uA; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=vN/max(length(vN),1e-4); vec3 v=vV/max(length(vV),1e-4); float k=clamp(abs(dot(n,v)),0.0,1.0); vec3 c=mix(vec3(0.2,0.015,0.0),vec3(1.0,0.36,0.06),smoothstep(0.15,0.75,k))+vec3(1.0,0.85,0.55)*pow(k,6.0); gl_FragColor=vec4(c*uI,uA); }' });
  // forged ram face: hot centre, concentric heat rings, dark rim
  const forgeFrag = 'uniform float uI,uT,uA; varying vec2 vUv; void main(){ vec2 q=vUv*2.0-1.0; float r=length(q); float rings=0.5+0.5*sin(r*26.0-uT*2.0); float core=clamp(1.0-r,0.0,1.0); vec3 c=mix(vec3(0.1,0.015,0.0),vec3(1.0,0.38,0.07),core*core)*(0.7+0.3*rings)+vec3(1.0,0.8,0.5)*pow(core,5.0)*0.8; c*=0.12+0.88*smoothstep(1.0,0.78,r); gl_FragColor=vec4(c*uI,uA); }';
  // cab window / firebox door: mullions, sooty glass, flicker from the fire inside
  const winFrag = N2 + 'uniform float uI,uT,uM; varying vec2 vUv; void main(){ vec2 u=vUv; float mull=uM*(step(abs(u.x-0.5),0.04)+step(abs(u.y-0.55),0.04)); float inside=step(0.07,u.x)*step(u.x,0.93)*step(0.07,u.y)*step(u.y,0.93); float g=mix(0.25,1.0,smoothstep(1.0,0.0,u.y))*(0.8+0.2*sin(uT*9.0+u.x*3.0)*sin(uT*5.3)); float soot=0.55+0.45*n2(u*vec2(5.0,7.0)+uT*0.2); vec3 c=vec3(1.0,0.4,0.1)*g*soot*inside*(1.0-clamp(mull,0.0,1.0)); gl_FragColor=vec4(c*uI,1.0); }';
  // heated deck grate: wood/iron grain, bright cracks, soft falloff at the edges
  const heatFrag = N2 + 'uniform float uH,uT; varying vec2 vUv; void main(){ float gx=abs(vUv.x-0.5)*2.0; float grain=n2(vec2(vUv.x*8.0,vUv.y*140.0)); float cr=1.0-smoothstep(0.0,0.05,abs(n2(vec2(vUv.x*5.0+3.0,vUv.y*50.0+uT*0.4))-0.5)); float e=smoothstep(1.0,0.45,gx)*smoothstep(0.0,0.03,vUv.y)*smoothstep(1.0,0.97,vUv.y); float hh=clamp(uH,0.0,3.0)*e; vec3 c=vec3(0.014,0.015,0.019)*(0.6+0.5*grain)+vec3(0.9,0.22,0.03)*hh*(0.25+0.5*grain)+vec3(1.0,0.7,0.3)*cr*hh*0.9; gl_FragColor=vec4(c,1.0); }';
  // cherry-red heat rising through the lower boiler (additive shell)
  const skirtFrag = 'uniform float uI,uT; varying vec2 vUv; void main(){ float f=pow(clamp(1.0-vUv.y,0.0,1.0),1.5); float n=0.7+0.3*sin(vUv.x*60.0+uT*3.0)*sin(vUv.x*23.0-uT*2.0); gl_FragColor=vec4(vec3(1.0,0.1,0.02)*f*n*uI,1.0); }';
  // a tongue of flame
  const flameFrag = N2 + 'uniform float uI,uT,uS; varying vec2 vUv; void main(){ float y=vUv.y, x=(vUv.x-0.5)*2.0; float sw=sin(y*5.0-uT*8.0+uS)*0.2*y; float w=max(1.0-y*0.85,0.05); float n=n2(vec2(vUv.x*5.0+uS,y*4.0-uT*6.0)); float d=abs(x+sw)/w+(n-0.5)*0.9*y; float body=smoothstep(1.0,0.2,d)*smoothstep(0.0,0.15,y)*pow(clamp(1.0-y,0.0,1.0),1.2); float core=smoothstep(0.3,0.0,d)*pow(clamp(1.0-y,0.0,1.0),2.5); vec3 c=vec3(0.85,0.14,0.015)*body+vec3(1.0,0.62,0.22)*core*0.7; gl_FragColor=vec4(max(c,vec3(0.0))*uI*0.75,1.0); }';
  // head lamp: small white core, warm parabolic reflector rings around it
  const lensFrag = 'uniform float uI,uA; varying vec2 vUv; void main(){ float r=length(vUv*2.0-1.0); float core=1.0-smoothstep(0.3,0.42,r); float refl=smoothstep(1.0,0.35,r)*(0.3+0.25*sin(r*38.0)); vec3 c=vec3(1.0,0.92,0.72)*core+vec3(0.85,0.55,0.22)*refl*0.4; gl_FragColor=vec4(c*uI,uA); }';
  function heatPlate(u, rimObj) {
    const m = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 1, metalness: 0, envMapIntensity: 0 }); m.uniforms = u;
    m.onBeforeCompile = (sh) => { sh.uniforms.uH = u.uH; sh.uniforms.uT = u.uT; sh.uniforms.uRim = { value: rimObj };
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vHP;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uH,uT; uniform vec3 uRim; varying vec3 vHP;\n' + N2 + 'void main() {').replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n{ vec2 q=vec2(vHP.x/1.1+0.5, vHP.z*0.08); float gx=abs(q.x-0.5)*2.0; float grain=n2(vec2(q.x*8.0,q.y*140.0)); float rv=step(0.82,fract(vHP.z*0.7))*step(0.7,gx); diffuseColor.rgb*=0.75+0.35*grain+rv*0.6; float cr=1.0-smoothstep(0.0,0.05,abs(n2(vec2(q.x*5.0+3.0,q.y*50.0+uT*0.4))-0.5)); float hh=clamp(uH,0.0,3.0)*smoothstep(1.0,0.45,gx); totalEmissiveRadiance+=vec3(0.9,0.22,0.03)*hh*(0.25+0.5*grain)+vec3(1.0,0.7,0.3)*cr*hh*0.9; vec3 vv=vViewPosition/max(length(vViewPosition),1e-4); totalEmissiveRadiance+=uRim*(0.3*smoothstep(0.9,0.98,gx)+0.12*rv); }');
    };
    m.customProgramCacheKey = () => 'heatplate'; return m;
  }
  function toIndexed(geo) { const P = geo.attributes.position, map = new Map(), pos = [], idx = []; for (let i = 0; i < P.count; i++) { const k = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4); let j = map.get(k); if (j === undefined) { j = pos.length / 3; map.set(k, j); pos.push(P.getX(i), P.getY(i), P.getZ(i)); } idx.push(j); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g; }

  function build(b) {
    const g = G.world, S = b.state;
    S.rimC = new THREE.Color(0x46587e);
    const sky = W.sky({ top: 0x030816, horizon: 0x2c4270, bottom: 0x05070c, stars: 1.3, sunDir: [0.72, 0.06, -1], sunColor: 0xe8eeff, sunSize: 0.06, sunGlow: 0.7, clouds: 0.34, cloudColor: 0x6a7a9a, cloudDark: 0x0a0e1c, cloudSpeed: 0.02, cloudScale: 1.1, exp: 0.5 });
    g.add(sky); S.sky = sky; W.env(sky, 0.9);
    scene.fog = new THREE.FogExp2(0x182642, 0.0042);
    S.hemi = W.hemi(g, 0x6a7c9c, 0x3a3e48, 1.75);
    S.sun = W.sun(g, { dir: [0.55, 0.62, -0.5], color: 0xa8c0ff, intensity: 3.1, size: 36 });
    S.sun.target.position.set(0, 0, -9); S.sun.shadow.camera.top = 40; S.sun.shadow.camera.bottom = -40; S.sun.shadow.camera.updateProjectionMatrix();
    S.sunI = 3.0; S.hemiI = 1.6;
    const steel = rimify(W.mat({ color: 0x3a3e48, roughness: 0.4, metalness: 0.85 }), S.rimC, 3, 0.5), darkSteel = rimify(W.mat({ color: 0x15171c, roughness: 0.6, metalness: 0.7 }), S.rimC, 3, 0.4);
    const iron = rimify(W.mat({ color: 0x15171d, roughness: 0.35, metalness: 0.9, envMapIntensity: 1.6 }), S.rimC, 3, 0.55), brass = rimify(W.mat({ color: 0xa87a38, roughness: 0.32, metalness: 1 }), S.rimC, 3.5, 0.25);
    const ironDS = rimify(W.mat({ color: 0x15171d, roughness: 0.35, metalness: 0.9, envMapIntensity: 1.6, side: THREE.DoubleSide }), S.rimC, 3, 0.55);
    // ---- the country ----
    const sand = W.surface('rock', { seed: 12, dark: 0x1e2228, light: 0x7a7c80, strength: 2 }); for (const k in sand) sand[k].repeat.set(40, 120);
    S.sand = sand; S.ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 2400), new THREE.MeshStandardMaterial({ map: sand.map, normalMap: sand.normalMap, roughness: 0.95 })); S.ground.rotation.x = -PI / 2; S.ground.position.y = GY; S.ground.receiveShadow = true; g.add(S.ground);
    const rock = strataify(W.mat({ color: 0x6a5240, roughness: 1 }), S.rimC, 0.16), rockI = strataify(W.mat({ color: 0x5e4a3a, roughness: 1 }), S.rimC, 0.22);
    for (const sx of [-1, 1]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(400, 60, 2400), rock); pl.position.set(sx * 275, GY - 30.1, 0); g.add(pl); }
    // canyon cliffs in front of the plateau edges: they sit below the ground until the floor falls away, then they are the canyon walls
    S.cliffs = new THREE.Group(); g.add(S.cliffs);
    for (const sx of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(1200, 66, 240, 14); geo.rotateY(-sx * PI / 2); const P = geo.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const y = P.getY(i), z = P.getZ(i), X = (z + 600) / 300 * 16, top = (y + 33) / 66, sd = sx > 0 ? 3 : 11;
        const d = W.fbm(X, y * 0.07 + 4, sd, 4, 16) * 9 + W.fbm(X * 4, y * 0.3, sd + 2, 3, 64) * 3, jag = top > 0.99 ? 0.3 + Math.max(0, W.fbm(X * 2, 1, sd + 5, 4, 32) - 0.42) * 26 : 0;
        P.setXYZ(i, sx * (72 - d + top * top * 3), GY - 33 + y + jag, z);
      }
      geo.computeVertexNormals(); const m = new THREE.Mesh(geo, rock); S.cliffs.add(m);
    }
    const vr = mulberry(909);
    // far buttes (fogged silhouettes) on the plateaus; tall enough that they never float when the canyon opens
    { const geos = [0, 1, 2, 3].map((i) => crag(31 + i * 7, 0.16 + i * 0.04)), per = 6; for (let gi = 0; gi < 4; gi++) { const im = new THREE.InstancedMesh(geos[gi], rock, per); for (let i = 0; i < per; i++) { let a, rr, x, z; do { a = vr() * TAU; rr = 230 + vr() * 330; x = Math.sin(a) * rr; z = Math.cos(a) * rr; } while (Math.abs(x) < 110); const h = 30 + vr() * 70, rt = 18 + vr() * 46; _m.position.set(x, GY + (h + 50) / 2 - 50, z); _m.rotation.set(0, vr() * 6, 0); _m.scale.set(rt, h + 50, rt * (0.7 + vr() * 0.6)); _m.updateMatrix(); im.setMatrixAt(i, _m.matrix); } g.add(im); } }
    // mid-distance hills that stream past (parallax): one period, two copies
    S.hills = new THREE.Group(); g.add(S.hills); S.hillP = 600;
    { const hg = toIndexed(new THREE.IcosahedronGeometry(1, 3)), P = hg.attributes.position; for (let i = 0; i < P.count; i++) { _a.set(P.getX(i), P.getY(i), P.getZ(i)); const n = W.fbm(_a.x * 1.6 + 3, _a.z * 1.6 + _a.y * 1.2, 77, 4); _a.multiplyScalar(0.7 + n * 0.6); if (_a.y < 0) _a.y *= 0.2; P.setXYZ(i, _a.x, _a.y, _a.z); } hg.computeVertexNormals();
      const NH = 16, im = new THREE.InstancedMesh(hg, rockI, NH * 2); for (let i = 0; i < NH; i++) { const sx = vr() < 0.5 ? -1 : 1, x = sx * (95 + vr() * 160), z = vr() * S.hillP, w = 14 + vr() * 34, h = 6 + vr() * 20; for (let c = 0; c < 2; c++) { _m.position.set(x, GY - 0.5, z - c * S.hillP); _m.rotation.set(0, vr() * 6, 0); _m.scale.set(w, h, w * (0.6 + vr() * 0.8)); _m.updateMatrix(); im.setMatrixAt(i * 2 + c, _m.matrix); } } S.hills.add(im); }
    // track bed: everything periodic lives in a group that slides by (scroll % period)
    S.bed = new THREE.Group(); g.add(S.bed);
    for (const sx of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 700), steel); rail.position.set(sx * 1.6, GY + 0.42, 0); g.add(rail); }
    const ballast = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.5, 700), W.mat({ color: 0x4a4a4e, roughness: 1 })); ballast.position.set(0, GY + 0.05, 0); g.add(ballast);
    const NS = 130, sl = new THREE.InstancedMesh(new THREE.BoxGeometry(4.6, 0.2, 0.55), W.mat({ color: 0x1e1812, roughness: 0.9 }), NS); for (let i = 0; i < NS; i++) { _m.position.set(0, GY + 0.3, -170 + i * 2.6); _m.rotation.set(0, 0, 0); _m.scale.setScalar(1); _m.updateMatrix(); sl.setMatrixAt(i, _m.matrix); } S.bed.add(sl);
    S.streaks = new THREE.Group(); g.add(S.streaks); S.streakM = streakMat();
    S.shMap = sand.map.clone(); S.shMap.repeat.set(0.25, 35); S.shN = sand.normalMap.clone(); S.shN.repeat.set(0.25, 35);
    { const shM = new THREE.MeshStandardMaterial({ map: S.shMap, normalMap: S.shN, color: 0xffffff, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); for (const sx of [-1, 1]) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(5, 700), shM); sh.rotation.x = -PI / 2; sh.position.set(sx * 7.7, GY + 0.02, 0); sh.receiveShadow = true; S.streaks.add(sh); } }
    S.shoulder = new THREE.Group(); g.add(S.shoulder);
    { const NT = 130, ties = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.14, 0.32), W.mat({ color: 0x5a5650, roughness: 0.9 }), NT * 2); for (let i = 0; i < NT; i++) for (const sx of [-1, 1]) { _m.position.set(sx * 6.2, GY + 0.08, -170 + i * 2.6); _m.rotation.set(0, 0, 0); _m.scale.setScalar(1); _m.updateMatrix(); ties.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), _m.matrix); } S.shoulder.add(ties); }
    for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(16, 300), S.streakM); st.rotation.x = -PI / 2; if (sx < 0) st.scale.x = -1; st.position.set(sx * 11.3, GY + 0.04, -60); st.renderOrder = 2; S.streaks.add(st); }
    S.poles = new THREE.Group(); g.add(S.poles);
    { const pm = rimify(W.mat({ color: 0x241a12, roughness: 0.9 }), S.rimC, 2, 0.8); for (let i = -5; i <= 5; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 11, 6), pm); p.position.set(-10, GY + 5.5, i * 46); S.poles.add(p); const cb = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 0.18), pm); cb.position.set(-10, GY + 10.2, i * 46); S.poles.add(cb); }
      for (const wx of [-11.3, -10, -8.7]) { const pts = []; for (let i = -5; i < 5; i++) for (let k = 0; k < 8; k++) { const f = k / 8; pts.push(new V3(wx, GY + 10.32 - Math.sin(f * PI) * 1.3, i * 46 + f * 46)); } pts.push(new V3(wx, GY + 10.32, 230)); const w = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 320, 0.035, 3, false), W.mat({ color: 0x0c0c10, roughness: 0.6, metalness: 0.5 })); S.poles.add(w); } }
    S.scrub = new THREE.Group(); g.add(S.scrub);
    { const NCt = 70, P = 260, trunk = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.5, 3.4, 3, 8), rimify(W.mat({ color: 0x1a3a22, roughness: 0.9 }), S.rimC, 2, 0.8), NCt * 2), arm = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.3, 1.5, 3, 6), trunk.material, NCt * 2), rk = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.6, 0), rockI, NCt * 2);
      for (let i = 0; i < NCt; i++) { const sx = vr() < 0.5 ? -1 : 1, x = sx * (13 + Math.pow(vr(), 1.6) * 120), z = vr() * P, sc = 0.7 + vr() * 0.9, rx = (vr() < 0.5 ? -1 : 1) * (11 + vr() * 90), rz = vr() * P, rs = 0.6 + vr() * 2.4;
        for (let c = 0; c < 2; c++) { const zz = z - c * P, k = i * 2 + c; _m.rotation.set(0, 0, 0); _m.scale.setScalar(sc); _m.position.set(x, GY + 2 * sc, zz); _m.updateMatrix(); trunk.setMatrixAt(k, _m.matrix); _m.position.set(x + 0.9 * sc, GY + 2.6 * sc, zz); _m.updateMatrix(); arm.setMatrixAt(k, _m.matrix); _m.position.set(rx, GY + 0.3, rz - c * P); _m.scale.set(rs, rs * 0.7, rs); _m.rotation.set(i, i * 2, 0); _m.updateMatrix(); rk.setMatrixAt(k, _m.matrix); } }
      S.scrub.add(trunk); S.scrub.add(arm); S.scrub.add(rk); S.scrubP = P;
      const NP = 90, pr = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rimify(W.mat({ color: 0x8e8c90, roughness: 0.9 }), S.rimC, 2.5, 0.8), NP * 2); for (let i = 0; i < NP; i++) { const x = (vr() < 0.5 ? -1 : 1) * (9 + vr() * 22), z = vr() * P, rs = 0.25 + vr() * 0.8; for (let c = 0; c < 2; c++) { _m.position.set(x, GY + rs * 0.25, z - c * P); _m.rotation.set(i, i * 1.7, 0); _m.scale.set(rs, rs * 0.6, rs); _m.updateMatrix(); pr.setMatrixAt(i * 2 + c, _m.matrix); } } S.scrub.add(pr); }
    S.trestle = new THREE.Group(); S.trestle.visible = false; g.add(S.trestle);
    { const NT = 24, tm = rimify(W.mat({ color: 0x3a2818, roughness: 0.9 }), S.rimC, 2, 1.0), beam = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 60, 0.5), tm, NT * 2), cross = new THREE.InstancedMesh(new THREE.BoxGeometry(9, 0.4, 0.4), tm, NT * 3); let k2 = 0;
      for (let i = 0; i < NT; i++) { const z = -150 + i * 13; for (const sx of [-1, 1]) { _m.position.set(sx * 3.2, GY - 30, z); _m.rotation.set(0, 0, sx * 0.05); _m.scale.setScalar(1); _m.updateMatrix(); beam.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), _m.matrix); } for (let c = 0; c < 3; c++) { _m.position.set(0, GY - 6 - c * 16, z); _m.rotation.set(0, 0, c % 2 ? 0.5 : -0.5); _m.updateMatrix(); cross.setMatrixAt(k2++, _m.matrix); } }
      S.trestle.add(beam); S.trestle.add(cross); }
    // the tunnel: rock bore with timber ribs and wall lamps, a mountain face round the portal
    S.tunnel = new THREE.Group(); S.tunnel.position.set(0, 4.6, -900); g.add(S.tunnel);
    { const tr = strataify(W.mat({ color: 0x4a3c30, roughness: 1, side: THREE.BackSide }), S.rimC, 0.5); S.tunnel.add(new THREE.Mesh(new THREE.BoxGeometry(24, 15, 150), tr));
      const NR = 25, rib = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1, 0.7), rimify(W.mat({ color: 0x2e2216, roughness: 0.9 }), S.rimC, 2, 0.6), NR * 3); for (let i = 0; i < NR; i++) { const z = -72 + i * 6; for (const sx of [-1, 1]) { _m.position.set(sx * 11.5, 0, z); _m.rotation.set(0, 0, 0); _m.scale.set(1, 15, 1); _m.updateMatrix(); rib.setMatrixAt(i * 3 + (sx > 0 ? 1 : 0), _m.matrix); } _m.position.set(0, 7.1, z); _m.scale.set(33, 1, 1); _m.updateMatrix(); rib.setMatrixAt(i * 3 + 2, _m.matrix); } S.tunnel.add(rib);
      const NLm = 15, lm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.5, 0.8), W.glow(0xffb060, 3.5), NLm * 2); for (let i = 0; i < NLm; i++) for (const sx of [-1, 1]) { _m.position.set(sx * 11.7, 1.2, -70 + i * 10); _m.scale.setScalar(1); _m.rotation.set(0, 0, 0); _m.updateMatrix(); lm.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), _m.matrix); } S.tunnel.add(lm);
      const poolM = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; vec4 p=vec4(position,1.0);\n#ifdef USE_INSTANCING\n p=instanceMatrix*p;\n#endif\n gl_Position=projectionMatrix*modelViewMatrix*p; }', fragmentShader: 'varying vec2 vUv; void main(){ vec2 q=vUv*2.0-1.0; float a=pow(clamp(1.0-length(q*vec2(1.0,1.3)),0.0,1.0),2.0)*0.55; gl_FragColor=vec4(vec3(1.0,0.55,0.22)*a,1.0); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(6, 5), poolM, NLm * 2), brk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.9, 1.1), darkSteel, NLm * 2);
      for (let i = 0; i < NLm; i++) for (const sx of [-1, 1]) { const k = i * 2 + (sx > 0 ? 1 : 0), z = -70 + i * 10; _m.position.set(sx * 11.9, 1.0, z); _m.rotation.set(0, -sx * PI / 2, 0); _m.scale.setScalar(1); _m.updateMatrix(); pool.setMatrixAt(k, _m.matrix); _m.position.set(sx * 11.92, 1.2, z); _m.rotation.set(0, 0, 0); _m.updateMatrix(); brk.setMatrixAt(k, _m.matrix); }
      pool.frustumCulled = false; S.tunnel.add(pool); S.tunnel.add(brk);
      const sh = new THREE.Shape(); sh.moveTo(-110, -40); for (let i = 0; i <= 22; i++) { const x = -110 + i * 10, y = 26 + Math.sin(i * 1.7) * 7 + Math.sin(i * 0.6) * 10 - Math.abs(x) * 0.12; sh.lineTo(x, y); } sh.lineTo(110, -40); sh.closePath();
      const hole = new THREE.Path(); hole.moveTo(-12, -7.6); hole.lineTo(12, -7.6); hole.lineTo(12, 7.4); hole.lineTo(-12, 7.4); hole.closePath(); sh.holes.push(hole);
      const face = new THREE.Mesh(new THREE.ShapeGeometry(sh), strataify(W.mat({ color: 0x5e4a3a, roughness: 1 }), S.rimC, 0.16)); face.position.z = 75; S.tunnel.add(face);
      const arch = new THREE.Mesh(new THREE.BoxGeometry(27, 2.2, 2), steel); arch.position.set(0, 8.4, 75.5); S.tunnel.add(arch); }
    S.boltGlow = new THREE.Mesh(new THREE.PlaneGeometry(90, 55), sm({ uI: { value: 0 } }, 'uniform float uI; varying vec2 vUv; void main(){ vec2 q=vUv*2.0-1.0; float a=pow(clamp(1.0-length(q),0.0,1.0),2.0)*uI; gl_FragColor=vec4(vec3(0.6,0.7,1.0)*a*0.8,1.0); }', { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); S.boltGlow.visible = false; g.add(S.boltGlow);
    S.tunL = new THREE.PointLight(0xffb060, 0, 26, 1.8); S.tunL.position.set(0, 4, -10); g.add(S.tunL);
    S.rain = W.motes({ n: 1100, box: [44, 26, 60], color: 0xb8c8e0, size: 0.75, vel: [0, -30, 34], streak: true, center: [0, 8, -6], alpha: 0, mult: 0.9 }); S.rain.visible = false; g.add(S.rain);
    S.dust = W.motes({ n: 520, box: [70, 16, 150], color: 0xcdb890, size: 0.6, vel: [0, 0, 46], streak: true, center: [0, 5, -8], alpha: 0.35, mult: 0.7 }); g.add(S.dust);
    // ---- the train ----
    const wd = W.surface('wood', { n: 10, dark: 0x22232a, light: 0x8e887a, strength: 2.4, seed: 2 }); for (const k in wd) wd[k].repeat.set(1, 2);
    const deckM = new THREE.MeshStandardMaterial({ map: wd.map, normalMap: wd.normalMap, roughnessMap: wd.roughnessMap, roughness: 0.8, metalness: 0.05 }); S.deckM = deckM;
    const edgeM = rimify(new THREE.MeshStandardMaterial({ map: stripeTex(true, 1, 4), emissiveMap: stripeTex(true, 1, 4), emissive: 0xffb030, emissiveIntensity: 0.18, roughness: 0.6 }), S.rimC, 2, 0.5);
    const chainM = rimify(W.mat({ color: 0x4a4c52, roughness: 0.35, metalness: 0.9 }), S.rimC, 2, 1.4);
    S.cars = CARS.map(([id, z0, z1]) => {
      const grp = new THREE.Group(), zc = (z0 + z1) / 2, len = z1 - z0; grp.position.z = zc; g.add(grp);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, 0.5, len), [steel, steel, deckM, darkSteel, steel, steel]); deck.position.y = -0.25; deck.receiveShadow = true; deck.castShadow = true; grp.add(deck);
      for (const sx of [-1, 1]) {
        const sill = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, len), steel); sill.position.set(sx * (HW + 0.05), -0.4, 0); grp.add(sill);
        const ed = new THREE.Mesh(new THREE.PlaneGeometry(0.22, len - 0.2), edgeM); ed.rotation.x = -PI / 2; ed.position.set(sx * (HW - 0.13), 0.012, 0); grp.add(ed);
        const pts = []; for (let k = 0; k < 5; k++) { const z = -len / 2 + 1.4 + k * (len - 2.8) / 4; const st = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.3), darkSteel); st.position.set(sx * (HW + 0.2), -0.1, z); grp.add(st); pts.push(new V3(sx * (HW + 0.2), 0.32, z)); if (k < 4) pts.push(new V3(sx * (HW + 0.24), 0.02, z + (len - 2.8) / 8)); }
        grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 64, 0.045, 4, false), chainM));
        for (const zz of [-len / 2 + 3.6, len / 2 - 3.6]) { const bf = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 3.6), darkSteel); bf.position.set(sx * 1.95, GY + 1.5, zz); grp.add(bf); for (const dz of [-1, 1]) { const ab = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.45), brass); ab.position.set(sx * 2.0, GY + 1.45, zz + dz * 1.0); grp.add(ab); } }
      }
      for (const ez of [-1, 1]) for (const sx of [-1, 1]) { const bu = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.45, 8), steel); bu.rotation.x = PI / 2; bu.position.set(sx * 2.4, -0.62, ez * (len / 2 + 0.2)); grp.add(bu); const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 14), iron); bp.rotation.x = PI / 2; bp.position.set(sx * 2.4, -0.62, ez * (len / 2 + 0.44)); grp.add(bp); }
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, len - 1), darkSteel); frame.position.y = -1.0; grp.add(frame);
      const wheels = [];
      for (const zz of [-len / 2 + 2.6, -len / 2 + 4.6, len / 2 - 4.6, len / 2 - 2.6]) for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 16), steel); w.rotation.z = PI / 2; w.position.set(sx * 1.6, GY + 1.45, zz); grp.add(w); wheels.push(w); const sp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.5, 0.2), darkSteel); sp.position.copy(w.position); grp.add(sp); wheels.push(sp); }
      const heatM = heatPlate({ uH: { value: 0 }, uT: { value: 0 } }, S.rimC);
      for (const xx of [-2.6, 0, 2.6]) { const gr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, len - 2.4), heatM); gr.position.set(xx, 0.02, 0); gr.receiveShadow = true; grp.add(gr); }
      const boltM = W.glow(SIGNAL, 0.05), bolts = [];
      if (id !== 'T') { const cp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 2.4), darkSteel); cp.position.set(0, -0.9, -len / 2 - 1); grp.add(cp); const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 10), brass); kn.position.set(0, -0.9, -len / 2 - 1.9); grp.add(kn); for (const sx of [-1, 1]) { const bo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), boltM); bo.position.set(sx * 3.6, 0.2, -len / 2 + 0.4); grp.add(bo); bolts.push(bo); } }
      return { id, z0, z1, zc, on: true, off: 0, v: 0, loose: false, warn: 0, heat: 0, hot: 0, grp, wheels, heatM, boltM };
    });
    // locomotive
    const loco = new THREE.Group(); loco.position.z = -40; g.add(loco); S.loco = loco;
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 22, 24), iron); boiler.rotation.x = PI / 2; boiler.position.set(0, 2.0, -15); boiler.castShadow = true; loco.add(boiler);
    for (const z of [-6, -11, -16, -21, -25.5]) { const bd = new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.09, 6, 32), brass); bd.position.set(0, 2.0, z); loco.add(bd); }
    for (const sx of [-1, 1]) { const hr = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 20, 6), brass); hr.rotation.x = PI / 2; hr.position.set(sx * 2.55, 3.4, -15.5); loco.add(hr); const rb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 21), darkSteel); rb.position.set(sx * 2.78, 1.42, -15.5); loco.add(rb); }
    const cabM = rimify(W.mat({ color: 0x2a2c34, roughness: 0.5, metalness: 0.6, envMapIntensity: 1.2 }), S.rimC, 2.5, 0.9); for (const y of [1.2, 3.2, 5.2]) for (const sx of [-1, 1]) { const sb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 5.04), brass); sb.position.set(sx * 3.52, y, -2.6); loco.add(sb); } { const sb = new THREE.Mesh(new THREE.BoxGeometry(7.04, 0.1, 0.06), brass); sb.position.set(0, 2.2, -0.08); loco.add(sb); }
    const cab = new THREE.Mesh(new THREE.BoxGeometry(7, 6.5, 5), cabM); cab.position.set(0, 3.2, -2.6); cab.castShadow = true; loco.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 6.4), rimify(W.mat({ color: 0x141418, roughness: 0.85, metalness: 0.3 }), S.rimC, 3, 0.4)); roof.position.set(0, 6.6, -2.6); loco.add(roof);
    S.winU = { uI: { value: 0.7 }, uT: { value: 0 }, uM: { value: 1 } }; const winM = sm(S.winU, winFrag); for (const sx of [-1, 1]) { const wn = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), winM); wn.position.set(sx * 1.7, 4.6, -0.08); loco.add(wn); }
    S.fbU = { uI: { value: 1 }, uT: { value: 0 }, uM: { value: 0 } }; { const fb = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), sm(S.fbU, winFrag)); fb.position.set(0, 1.0, -0.08); loco.add(fb); }
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 3.4, 16), iron); stack.position.set(0, 6.2, -23); loco.add(stack);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), brass); dome.position.set(0, 4.6, -13); loco.add(dome);
    S.lampM = W.glow(0xfff0c0, 6); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), S.lampM); lamp.position.set(0, 4.6, -26.4); loco.add(lamp);
    S.drive = []; for (const zz of [-8, -13.5, -19]) for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.4, 20), iron); w.rotation.z = PI / 2; w.position.set(sx * 3.15, GY + 2.2, zz); loco.add(w); const wr = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.09, 6, 28), brass); wr.rotation.y = PI / 2; wr.position.set(sx * 3.37, GY + 2.2, zz); loco.add(wr); const sp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.0, 0.3), brass); sp.position.copy(w.position); loco.add(sp); S.drive.push(sp); }
    for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 12), brass); rod.position.set(sx * 3.5, GY + 2.2, -13.5); loco.add(rod); S.drive.push(rod); rod.userData.rod = 1; }
    const cow = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4, 4), iron); cow.rotation.x = -PI / 2; cow.rotation.z = PI / 4; cow.scale.y = 1; cow.position.set(0, -0.6, -28.5); loco.add(cow);
    // signal mast: three lamps, one per lane
    S.sigM = [-1, 0, 1].map((l) => { const m = W.glow(SIGNAL, 0.06); const s = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), m); s.position.set(l * 2.4, 9.4, -39.2); g.add(s); const bp = new THREE.Mesh(new THREE.CircleGeometry(0.66, 20), darkSteel); bp.position.set(l * 2.4, 9.4, -39.28); g.add(bp); const lr = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 6, 20), steel); lr.position.set(l * 2.4, 9.4, -39.1); g.add(lr); const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.38, 14, 1, true, -PI / 2, PI), rimify(W.mat({ color: 0x15171c, roughness: 0.6, metalness: 0.7, side: THREE.DoubleSide }), S.rimC, 3, 0.4)); hood.rotation.x = -PI / 2; hood.position.set(l * 2.4, 9.45, -39.08); g.add(hood); const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 12), darkSteel); hd.rotation.x = PI / 2; hd.position.set(l * 2.4, 9.4, -39.5); g.add(hd); return m; });
    const mast = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 0.3), darkSteel); mast.position.set(0, 8.6, -39.5); g.add(mast);
    for (const sx of [-1, 1]) { const mp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), darkSteel); mp.position.set(sx * 3.4, 4.3, -39.6); g.add(mp); }
    // trackside things that reach across the cars: lattice signal posts with striped girder arms, a signal bridge with a striped drop bar
    const hazM = rimify(new THREE.MeshStandardMaterial({ map: stripeTex(false, 1.5, 1), emissiveMap: stripeTex(false, 1.5, 1), emissive: 0xffa020, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0.3 }), S.rimC, 2, 1.0);
    const lattice = (o, x, h, y0) => { for (const dx of [-0.35, 0.35]) { const u = new THREE.Mesh(new THREE.BoxGeometry(0.14, h, 0.14), darkSteel); u.position.set(x + dx, y0 + h / 2, 0); o.add(u); } const nb = Math.floor(h / 1.6); for (let k = 0; k < nb; k++) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.75, 0.07), steel); br.position.set(x, y0 + 0.8 + k * 1.6, 0); br.rotation.z = k % 2 ? 0.41 : -0.41; o.add(br); } };
    S.obs = [-1, 0, 1].map((l) => {
      const o = new THREE.Group(); o.visible = false; g.add(o);
      if (l) { lattice(o, l * 7.4, 12.5, -4.2); const web = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.6, 0.14), hazM); web.position.set(l * 4.25, 1.25, 0); o.add(web); for (const dy of [-0.34, 0.34]) { const fl = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.1, 0.5), steel); fl.position.set(l * 4.25, 1.25 + dy, 0); o.add(fl); }
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.2, 0.12), steel); st.position.set(l * 5.6, 3.55, 0); st.rotation.z = -l * 0.745; o.add(st); const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.7), W.glow(SIGNAL, 2.5)); tip.position.set(l * 1.4, 1.25, 0); o.add(tip); }
      else { for (const sx of [-1, 1]) lattice(o, sx * 7.4, 14, -4); for (const y of [9.6, 8.7]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.22, 0.4), darkSteel); ch.position.set(0, y, 0); o.add(ch); } for (let k = 0; k < 9; k++) { if (k > 7) break; const v = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.97, 0.08), steel); v.position.set(-7 + k * 1.75 + 0.875, 9.15, 0); v.rotation.z = k % 2 ? 1.1 : -1.1; o.add(v); }
        for (const sx of [-1, 1]) { const rd = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.2, 6), steel); rd.position.set(sx * 1.2, 5.1, 0); o.add(rd); } const bar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 0.6), hazM); bar.position.set(0, 1.4, 0); o.add(bar); const tip = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.32, 0.7), W.glow(SIGNAL, 2.5)); tip.position.set(0, 0.9, 0); o.add(tip); }
      return { g: o, t: 0, on: false, at: 0 };
    });

    // ---- Ironjaw ----
    const bg = b.group; S.rig = new THREE.Group(); bg.add(S.rig);
    { const iron = rimify(W.mat({ color: 0x15171d, roughness: 0.35, metalness: 0.9, envMapIntensity: 1.6 }), S.rimC, 3, 0.55), brass = rimify(W.mat({ color: 0xa87a38, roughness: 0.32, metalness: 1 }), S.rimC, 3.5, 0.25), steel = rimify(W.mat({ color: 0x3a3e48, roughness: 0.4, metalness: 0.85 }), S.rimC, 3, 0.5), ironDS = rimify(W.mat({ color: 0x15171d, roughness: 0.35, metalness: 0.9, envMapIntensity: 1.6, side: THREE.DoubleSide }), S.rimC, 3, 0.55), chainM = rimify(W.mat({ color: 0x4a4c52, roughness: 0.35, metalness: 0.9 }), S.rimC, 2, 1.4);
    const pl = W.bake(256, plates(8, 3, 21), { dark: 0x06070b, light: 0x4e5a74, strength: 2.2 }), pmk = W.bake(256, seamMask(8, 3), { dark: 0x000000, light: 0xffffff });
    const plateM = rimify(new THREE.MeshStandardMaterial({ map: pl.map, normalMap: pl.normalMap, roughnessMap: pl.roughnessMap, roughness: 1, metalness: 0.8, envMapIntensity: 1.4, emissive: 0xff2a08, emissiveMap: pmk.map, emissiveIntensity: 0 }), S.rimC, 2.8, 0.7);
    const plateN = rimify(new THREE.MeshStandardMaterial({ map: pl.map, normalMap: pl.normalMap, roughnessMap: pl.roughnessMap, roughness: 1, metalness: 0.8, envMapIntensity: 1.4 }), S.rimC, 2.8, 0.7);
    S.plateM = plateM; S.seamM = W.glow(FIRE, 1); S.fadeU = { value: 1 }; S.rodU = { uI: { value: 1 }, uA: S.fadeU }; S.rodHot = rodMat(S.rodU);
    const rivet = new THREE.SphereGeometry(1, 6, 4), rivs = []; const addRiv = (x, y, z, s = 0.06) => rivs.push([x, y, z, s]);
    const rAt = (y) => 1.5 + (y - 1.7) / 3 * 0.25;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.5, 3.0, 28), plateM); torso.position.y = 3.2; torso.castShadow = true; S.rig.add(torso);
    for (const y of [1.9, 3.2, 4.5]) {
      const gap = y === 3.2 ? 1.5 : 0, arc = TAU - gap, rr = rAt(y) + 0.02, bgeo = new THREE.TorusGeometry(rr, 0.11, 6, 32, arc); bgeo.rotateX(PI / 2); if (gap) bgeo.rotateY(-(PI / 2 + gap / 2));
      const bd = new THREE.Mesh(bgeo, iron); bd.position.y = y; S.rig.add(bd);
      const sgeo = new THREE.TorusGeometry(rAt(y - 0.17) + 0.012, 0.03, 4, 40, arc); sgeo.rotateX(PI / 2); if (gap) sgeo.rotateY(-(PI / 2 + gap / 2)); const sm = new THREE.Mesh(sgeo, S.seamM); sm.position.y = y - 0.17; S.rig.add(sm);
      for (let i = 0; i < 30; i++) { const a = i / 30 * TAU; if (gap && Math.abs(angDiff(a, 0)) < gap / 2 + 0.08) continue; addRiv(Math.sin(a) * (rr + 0.1), y, Math.cos(a) * (rr + 0.1)); }
    }
    const topD = new THREE.Mesh(new THREE.SphereGeometry(1.75, 24, 12, 0, TAU, 0, PI / 2), plateM); topD.position.y = 4.7; topD.scale.y = 0.55; S.rig.add(topD);
    // furnace door: recessed firebox, five countable bars, brass frame studded with rivets
    { const GZ = rAt(3.0); S.fireM = fireMat(); S.fireM.uniforms.uA = S.fadeU; const fd = new THREE.Mesh(new THREE.CircleGeometry(0.95, 28), S.fireM); fd.position.set(0, 3.0, GZ + 0.04); S.rig.add(fd); S.grate = fd;
      const rc = new THREE.Mesh(new THREE.CylinderGeometry(0.97, 0.97, 0.56, 24, 1, true), ironDS); rc.rotation.x = PI / 2; rc.position.set(0, 3.0, GZ - 0.04); S.rig.add(rc);
      for (let i = -2; i <= 2; i++) { const x = i * 0.34, L = 2 * Math.sqrt(0.95 * 0.95 - x * x); const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, L, 0.14), iron); bar.position.set(x, 3.0, GZ + 0.16); S.rig.add(bar); }
      const cb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.12), iron); cb.position.set(0, 3.0, GZ + 0.19); S.rig.add(cb);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.14, 8, 32), brass); ring.position.set(0, 3.0, GZ + 0.24); S.rig.add(ring);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; addRiv(Math.sin(a) * 1.0, 3.0 + Math.cos(a) * 1.0, GZ + 0.36, 0.05); }
      S.flames = [-0.45, -0.12, 0.2, 0.5].map((x, i) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.4), sm({ uI: { value: 0 }, uT: { value: 0 }, uS: { value: i * 2.1 } }, flameFrag, ADD)); f.position.set(x, 3.25 + Math.sqrt(Math.max(0, 0.9 - x * x)) * 0.5, GZ + 0.1); f.rotation.set(0.35, 0, -x * 0.35); f.visible = false; S.rig.add(f); return f; });
      S.skirtU = { uI: { value: 0 }, uT: { value: 0 } }; S.skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.525, 1.4, 28, 1, true), sm(S.skirtU, skirtFrag, ADD)); S.skirt.position.y = 2.42; S.skirt.visible = false; S.rig.add(S.skirt); }
    // head: lamp drum under a riveted cowl, a hinged cow-catcher jaw
    S.head = new THREE.Group(); S.head.position.set(0, 6.1, 0.45); const hriv = []; S.rig.add(S.head);
    { const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 0.9, 14), iron); nk.position.set(0, -0.7, -0.2); S.head.add(nk);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.74, 1.25, 20), iron); drum.rotation.x = PI / 2; drum.castShadow = true; S.head.add(drum);
      S.lensU = { uI: { value: 1.2 }, uA: S.fadeU }; const lens = new THREE.Mesh(new THREE.CircleGeometry(0.5, 28), sm(S.lensU, lensFrag)); lens.position.z = 0.64; S.head.add(lens);
      const lr = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.07, 6, 24), brass); lr.position.z = 0.64; S.head.add(lr);
      const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.55, 20, 1, true, -PI / 2, PI), ironDS); cowl.rotation.x = -PI / 2; cowl.position.set(0, 0.04, 0.12); S.head.add(cowl);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 1.4), brass); crest.position.set(0, 0.98, 0.05); S.head.add(crest);
      for (let i = 0; i < 7; i++) { const a = -PI / 2 + (i + 0.5) / 7 * PI; hriv.push([Math.sin(a) * 0.93, 0.04 + Math.cos(a) * 0.93, 0.88]); }
      for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.22), iron); t.position.set(-0.48 + i * 0.32, -0.86, 0.5); S.head.add(t); }
      S.mouthM = W.glow(FIRE, 1.5); const mo = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.6), S.mouthM); mo.position.set(0, -0.86, 0.42); for (const sx of [-1, 1]) { const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 14), brass); hb.rotation.z = PI / 2; hb.position.set(sx * 1.3, -0.82, -0.35); S.head.add(hb); } S.head.add(mo);
      S.jaw = new THREE.Group(); S.jaw.position.set(0, -0.95, -0.35); S.jaw.scale.set(1.5, 1.4, 1.35); S.head.add(S.jaw);
      const mand = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.24, 1.55), iron); mand.position.set(0, -0.12, 1.25); mand.castShadow = true; S.jaw.add(mand);
      for (let i = 0; i < 7; i++) { const x = -0.72 + i * 0.24, sl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), steel); sl.position.set(x * 1.07, -0.4, 2.05); sl.rotation.x = 0.94; S.jaw.add(sl); if (i % 2 === 0) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), iron); t.position.set(x, 0.14, 1.75); S.jaw.add(t); } }
      const lip = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.14), brass); lip.position.set(0, -0.68, 2.25); S.jaw.add(lip);
      const hr = new THREE.InstancedMesh(rivet, brass, hriv.length); hriv.forEach(([x, y, z], i) => { _m.position.set(x, y, z); _m.rotation.set(0, 0, 0); _m.scale.setScalar(0.045); _m.updateMatrix(); hr.setMatrixAt(i, _m.matrix); }); S.head.add(hr); }
    { const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 18), plateN); tk.rotation.z = PI / 2; tk.position.set(0, 3.9, -1.85); S.rig.add(tk); for (const sx of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 8, 0, TAU, 0, PI / 2), brass); cap.rotation.z = -sx * PI / 2; cap.position.set(sx * 1.3, 3.9, -1.85); S.rig.add(cap); const strap = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.05, 6, 18), brass); strap.rotation.y = PI / 2; strap.position.set(sx * 0.7, 3.9, -1.85); S.rig.add(strap);
        const pp = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(sx * 1.0, 4.35, -1.9), new V3(sx * 1.6, 4.9, -1.4), new V3(sx * 2.05, 4.75, -0.6)]), 16, 0.09, 6, false), brass); S.rig.add(pp); }
      const hop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 0.9), plateN); hop.position.set(0, 2.45, -1.75); S.rig.add(hop); const hl = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 1.0), brass); hl.position.set(0, 3.02, -1.75); S.rig.add(hl);
      const hc = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.12, 20), brass); hc.rotation.x = PI / 2; hc.position.set(0, 0, -0.66); S.head.add(hc); }
    const stk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 2.2, 12), iron); stk.position.set(-1.0, 5.6, -0.9); stk.rotation.z = 0.2; S.rig.add(stk);
    const stc = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.08, 6, 16), brass); stc.rotation.x = PI / 2; stc.position.set(-1.21, 6.67, -0.9); S.rig.add(stc);
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.9, 12), plateN); leg.position.set(sx * 0.95, 0.95, 0); leg.castShadow = true; S.rig.add(leg); const kn = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.09, 6, 20), brass); kn.rotation.x = PI / 2; kn.position.set(sx * 0.95, 1.5, 0); S.rig.add(kn); const ft = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.6), iron); ft.position.set(sx * 0.95, 0.25, 0.1); S.rig.add(ft); const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.4, 10, 1, false, 0, PI), iron); toe.rotation.z = PI / 2; toe.position.set(sx * 0.95, 0.25, 0.9); toe.scale.set(1, 1, 2.2); S.rig.add(toe); }
    S.arms = []; S.valves = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 2.2, 4.3, 0); S.rig.add(sh);
      const pau = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 14), plateN); pau.castShadow = true; sh.add(pau);
      const pr = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.08, 6, 24), brass); pr.rotation.x = PI / 2; pr.position.y = -0.3; sh.add(pr);
      const vl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.55, 8), brass); vl.position.set(sx * 0.15, 0.95, -0.1); sh.add(vl); const vc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10), iron); vc.position.set(sx * 0.15, 1.24, -0.1); sh.add(vc); S.valves.push(vc);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.47, 1.8, 16), iron); cyl.position.y = -1.1; cyl.castShadow = true; sh.add(cyl);
      for (const y of [-0.4, -1.85]) { const cr = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 6, 18), brass); cr.rotation.x = PI / 2; cr.position.y = y; sh.add(cr); }
      const rodM = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 10), S.rodHot); rodM.position.y = -2.3; sh.add(rodM);
      const fist = new THREE.Group(); fist.position.y = -3.4; sh.add(fist);
      if (sx > 0) { const ram = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.95, 20), plateN); ram.castShadow = true; fist.add(ram); const col = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.09, 6, 22), brass); col.rotation.x = PI / 2; col.position.y = 0.45; fist.add(col);
        S.forgeU = { uI: { value: 1 }, uT: { value: 0 }, uA: S.fadeU }; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, bo = new THREE.Mesh(rivet, brass); bo.scale.setScalar(0.07); bo.position.set(Math.sin(a) * 0.6, -0.5, Math.cos(a) * 0.6); fist.add(bo); } const face = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), sm(S.forgeU, forgeFrag)); face.rotation.x = PI / 2; face.position.y = -0.485; fist.add(face); const fr = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 6, 22), iron); fr.rotation.x = PI / 2; fr.position.y = -0.47; fist.add(fr); }
      else { const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.7, 14), plateN); fist.add(hub); for (let k = 0; k < 3; k++) { const lk = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 12), chainM); lk.position.y = -0.5 - k * 0.3; lk.rotation.y = k % 2 ? PI / 2 : 0; fist.add(lk); } const hk = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.15, 8, 18, PI * 1.3), brass); hk.position.y = -1.6; hk.rotation.y = PI / 2; fist.add(hk); const pt = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.45, 6), brass); pt.position.set(0, -1.05, 0.55); pt.rotation.x = -0.6; fist.add(pt); }
      S.arms.push({ sh, rodM, fist, sx, ext: 0 });
    }
    { const rim = new THREE.InstancedMesh(rivet, brass, rivs.length); rivs.forEach(([x, y, z, s], i) => { _m.position.set(x, y, z); _m.rotation.set(0, 0, 0); _m.scale.setScalar(s); _m.updateMatrix(); rim.setMatrixAt(i, _m.matrix); }); S.rig.add(rim); }
    S.bMats = []; S.rig.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) { if (m.isShaderMaterial && m.uniforms.uA) m.transparent = true; if (!m.isShaderMaterial && !S.bMats.includes(m)) S.bMats.push(m); } }); for (const m of S.bMats) m.transparent = true; S.plateN = plateN; S.bBrass = brass; } // always in the transparent pass, so ghosting him only changes opacity and depthWrite (no new shader variant mid-fight)
    // furnace light: a warm pool on the deck in front of him, not a flood
    S.furL = new THREE.PointLight(FIRE, 40, 20, 2); S.furL.position.set(0, 1.4, 3.6); bg.add(S.furL);
    // cold overhead fill (moonlight off the cloud deck) so shadows sit at blue-grey instead of black
    S.lampL = new THREE.PointLight(0x9ab0e8, 90, 60, 1.2); S.lampL.position.set(0, 11, -8); g.add(S.lampL);
    // stoked coals (cosmetic flight; the damage is the ground telegraph)
    { const cg = new THREE.IcosahedronGeometry(0.42, 1); S.coalM = coalMat(); S.coals = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(cg, S.coalM); m.visible = false; g.add(m); S.coals.push({ m, a: new V3(), b: new V3(), t: 0, T: 1 }); } S.ccoals = []; for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(cg, S.coalM); m.scale.setScalar(1.35); m.visible = false; m.userData.seen = 0; g.add(m); S.ccoals.push(m); } }
    Object.assign(S, { scroll: 0, speed: 38, speedT: 38, lean: 0, leanK: 0, leanTele: 0, wind: 0, windK: 0, gy: GY, gyT: GY, dark: 0, heat: 0, punch: 0, sig: [0, 0, 0], lvl: 0, boltT: 3 });
    return {
      edge: 'fall', spawn: { x: 0, z: -13 }, bossStart: { x: 0, z: -37.3, face: 0 }, camDist: 15,
      contains: (x, z) => !!carAt(S, x, z) || !!gapAt(S, x, z),
      clamp() { }, bulletBounds: (x, z) => z < 60 && z > -45,
      camLimit(x, y, z) { return { x, y: Math.max(y, 0.6), z: Math.max(z, -37) }; },
    };
  }
  function coal(S, from, to) { if (G.headless) return; const c = S.coals.find((q) => !q.m.visible); if (!c) return; c.m.visible = true; c.a.copy(from); c.b.copy(to); c.t = 0; c.T = Math.max(0.05, from.distanceTo(to) / 26); c.m.position.copy(from); }

  // ---- hazards ----
  function* sweep(b, lanes, delay = 1.9) {
    const S = b.state; Sound.sfx('steam', 1, 1.8); Sound.sfx('bell', 0.5, 2.6); S.sig = [-1, 0, 1].map((l) => lanes.includes(l) ? 1 : 0);
    for (const l of lanes) {
      Hz.rect(l * LANE, Z0 - 0.5, 0, LEN + 1, LANE - 0.05, delay, 340, { name: 'Trackside', color: LANEC, quiet: true, onFire() { Sound.sfx('boom', 0.9, 1.4); FX.shake(0.4); } });
      const o = S.obs[l + 1]; o.on = true; o.t = -delay; o.g.visible = true;
    }
    yield delay + 0.25; S.sig = [0, 0, 0];
  }
  function* stoke(b, n) {
    const S = b.state; yield* b.cast({ name: 'Stoke', time: 0.6 });
    for (let i = 0; i < n; i++) {
      const p = G.player, x = clamp(p.pos.x + (i ? rnd(-1.2, 1.2) : 0), -HW + 0.5, HW - 0.5), z = p.pos.z + (i ? rnd(-1.5, 1.5) : 0); S.punch = 1;
      coal(S, _a.set(b.pos.x + 1.5, 4.5, b.pos.z + 1), _b2.set(x, 0.2, z)); Sound.sfx('dash', 0.7, 0.5);
      Hz.circle(x, z, 2.5, 1.15, 250, { name: 'Hot Coal', onFire() { FX.explode(x, 0.4, z, FIRE, 2.6, 0xffe0a0); Sound.sfx('boom', 0.7, 1.2); Hz.zone({ type: 'circle', x, z, r: 1.8 }, 5, 60, { name: 'Embers', color: 0xffa040, delay: 0.3 }); } });
      yield 0.85;
    }
    yield 0.5;
  }
  function* piston(b, quick) {
    const S = b.state, dir = b.angToPlayer(), t = quick ? 0.95 : 1.25; b.autoFace = false; S.wind_up = 1;
    Hz.rect(b.pos.x, b.pos.z, dir, 11, 5.2, t, 320, { name: 'Piston', kb: { dir, dist: 2.5 }, onFire() { S.punch = 1.4; FX.shake(0.5); Sound.sfx('bigboom', 0.5); FX.burst(b.pos.x + Math.sin(dir) * 5, 1, b.pos.z + Math.cos(dir) * 5, { n: 22, smoke: true, color: 0xb8bcc8, color2: 0x30343c, speed: [3, 10], life: [0.3, 0.7], size: [0.4, 1.0], alpha: 0.35 }); } });
    yield* b.cast({ name: 'Piston', time: t }); S.wind_up = 0; yield 0.5; b.autoFace = true;
  }
  function* furnace(b, ids, dur = 5) {
    const S = b.state; yield* b.cast({ name: 'Overheat', time: 0.7 }); Sound.sfx('steam', 1, 0.6);
    let k = 0, D = 3.0; for (const id of ids) { const c = car(S, id); if (!c || !c.on || c.loose) continue; D = 3.0 + 1.7 * k++; c.hot = D + dur; c.heatT = D; c.hotDur = dur; Hz.zone({ type: 'rect', x: 0, z: c.z0, dir: 0, len: c.z1 - c.z0, w: HW * 2 }, dur, 170, { name: 'Overheat', color: 0xff7a20, delay: D, alpha: 0.38 }); }
    yield D; Sound.sfx('roar', 0.5, 1.5); yield 1.0;
  }
  const myCar = (S) => { const p = G.player, c = carAt(S, p.pos.x, p.pos.z); if (c) return c; let best = null; for (const q of live(S)) if (!best || Math.abs(q.zc - p.pos.z) < Math.abs(best.zc - p.pos.z)) best = q; return best; };
  function* hook(b) {
    const S = b.state, p = G.player; S.hookUp = 1;
    const r = yield* b.cast({ name: 'Chain Hook', time: 2.8, interruptible: true }); S.hookUp = 0;
    if (r !== 'done') { yield 1.0; return; }
    if (!G.headless) FX.beam(new V3(b.pos.x - 2, 3, b.pos.z + 1), p.aim(new V3()), { color: 0xffd080, width: 0.2, dur: 0.4 }); Sound.sfx('sword', 1, 0.5);
    const tx = b.pos.x, tz = b.pos.z + 5.2, dx = tx - p.pos.x, dz = tz - p.pos.z;
    if (p.hurt(240, { blockable: true, src: { name: 'Chain Hook' } }) > 0 && p.alive) { p.dash = { vx: dx / 0.4, vz: dz / 0.4, t: 0.4 }; p.casting = null; p.rooted = 1.3; }
    yield 0.5; yield* piston(b, true);
  }
  function* lean(b, side, dur = 3.4, withSweep) {
    const S = b.state; S.leanTele = side; Sound.sfx('sword', 0.9, 0.35); Sound.sfx('steam', 0.8, 2.4); yield 1.3;
    S.leanTele = 0; S.lean = side; if (withSweep) Co.start(sweep(b, [side]), 'phase'); yield dur; S.lean = 0; yield 0.6;
  }
  function* cinders(b, dur = 5) {
    yield* b.cast({ name: 'Cinders', time: 0.7 }); let t = 0, last = 0; const tr = cinderTrail(b.state);
    while (t < dur) { let l; do { l = rndi(-1, 1); } while (l === last); last = l; Bul.fire({ x: l * LANE + rnd(-0.9, 0.9), z: -44, dir: 0, speed: 15, r: 0.45, dmg: 120, color: 0xff9030, life: 4.6, onUpdate: tr }); if (rnd() < 0.4) Bul.fire({ x: rnd(-4.5, 4.5), z: -46, dir: 0, speed: 15, r: 0.4, dmg: 120, color: 0xffb040, life: 4.6, onUpdate: tr }); t += 0.34; yield 0.34; }
    yield 0.6;
  }
  const cinderTrail = (S) => (q, dt) => { if (G.headless) return; if (!q.cm) { const m = S.ccoals.find((c) => !c.visible); if (m) { q.cm = m; m.visible = true; } } if (q.cm) { q.cm.position.set(q.x, q.y, q.z); q.cm.userData.seen = G.now; } if (vrand() < dt * 45) FX.burst(q.x + (vrand() - 0.5) * 0.3, q.y, q.z - 0.3, { n: 1, color: 0xffb050, color2: 0xff3010, dir: [0, 0.4, -1], spread: 0.3, speed: [2, 6], life: [0.2, 0.45], size: [0.1, 0.22] }); };
  function* uncouple(b, id) {
    const S = b.state, c = car(S, id); if (!c.on || c.loose) return; c.warn = 4.4; Sound.sfx('bell', 1, 1.6);
    Hz.mark({ type: 'rect', x: 0, z: c.z0, dir: 0, len: c.z1 - c.z0, w: HW * 2 }, 4.4, { color: LANEC, tag: 'fight', style: 2, zoneStyle: 2, alpha: 0.55 });
    for (let i = 0; i < 4; i++) { yield 1.1; Sound.sfx('warn', 2, 0.6 + i * 0.15); }
    c.loose = true; c.warn = 0; Sound.sfx('bigboom', 0.9); FX.shake(0.8); FX.explode(0, 0, c.z0 - 1, FIRE, 5, 0xffffff);
  }
  function setLvl(b, n) {
    const S = b.state; S.lvl = n; S.lean = 0; S.leanTele = 0; S.sig = [0, 0, 0]; S.hookUp = 0; S.wind_up = 0; b.autoFace = true;
    const drop = (id) => { const c = car(S, id); if (c.on && !c.loose) { c.loose = true; c.off = 200; } };
    if (n >= 1) { if (!car(S, 'C').loose) drop('C'); S.gyT = GY - 46; S.trestle.visible = true; }
    if (n >= 2) { if (!car(S, 'B').loose) drop('B'); S.wind = 1; S.speedT = 56; }
    const p = G.player; if (p && !carAt(S, p.pos.x, p.pos.z) && !gapAt(S, p.pos.x, p.pos.z)) p.pos.set(0, 0, -13);
  }
  function* skyTo(b, o, dur) {
    const U = b.state.sky.material.uniforms, keys = Object.keys(o), from = keys.map((k) => U[k].value.isColor ? U[k].value.clone() : U[k].value), to = keys.map((k) => U[k].value.isColor ? new THREE.Color(o[k]) : o[k]);
    yield* W.tween(dur, (t) => keys.forEach((k, i) => { if (U[k].value.isColor) W.colorLerp(U[k].value, from[i], to[i], t); else U[k].value = lerp(from[i], to[i], t); }));
  }
  function* sunTo(b, dir, size, dur) { const U = b.state.sky.material.uniforms, a = U.uSunDir.value.clone(), z = new V3(...dir).normalize(), s0 = U.uSunSize.value; yield* W.tween(dur, (t) => { U.uSunDir.value.lerpVectors(a, z, t).normalize(); U.uSunSize.value = lerp(s0, size, t); }); }
  function* fogTo(col, dens, dur) { const a = scene.fog.color.clone(), c = new THREE.Color(col), d0 = scene.fog.density; yield* W.tween(dur, (t) => { W.colorLerp(scene.fog.color, a, c, t); scene.fog.density = lerp(d0, dens, t); }); }
  const side = () => rnd() < 0.5 ? -1 : 1;

  G.bosses.push({
    id: 'express', name: 'IRONJAW', title: 'The Midnight Express', hint: 'A departure', color: '#ff5a36', telegraph: TELL,
    hp: 28000, radius: 2.2, aimY: 3.4, enrage: 450,
    post: { bloom: 0.5, threshold: 0.9, radius: 0.6, exposure: 1.24, vig: 1.0, sat: 1.04, contrast: 1.08, tint: [0.96, 1.0, 1.08] },
    music: { bpm: 152, root: 40, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 0, 0, 0, 3, 4],
      layers: [
        { v: 'hat', pat: 'x.xxx.xxx.xxx.xx', vol: 0.07 }, { v: 'bass', pat: '0.0.0.0.0.0.0.3.', oct: -1, len: 1, vol: 0.12 }, { v: 'tom', pat: 'x.......x.......', vol: 0.22 },
        { v: 'kick', from: 1, pat: 'x...x...x...x...', vol: 0.3 }, { v: 'snare', from: 1, pat: '....x.......x...', vol: 0.16 }, { v: 'koto', from: 1, pat: ['0.2.3.2.0.2.3.5.', '7.5.3.5.7.5.3.2.'], oct: 1, len: 1, vol: 0.08 },
        { v: 'brass', from: 2, pat: ['0.......3...4...', '7.......5...4...'], oct: 1, len: 5, vol: 0.11 }, { v: 'snare', from: 2, pat: '..x...x...x...xx', vol: 0.1 }, { v: 'lead', from: 2, pat: ['0.3.5.7.5.3.0.3.', '4.7.9.b.9.7.4.7.'], oct: 2, len: 1, vol: 0.045 }, { v: 'taiko', from: 2, pat: 'x..x..x.x..x..x.', vol: 0.26 },
      ] },
    build,
    *intro(b) { Sound.sfx('steam', 1, 0.5); yield* Cam.shot([-16, 3, -62], [0, 3, -50], [-9, 6, -22], [0, 3.5, -37], 5.0, 50); },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; b.autoFace = true; b.turnRate = 3; setLvl(b, 0); yield 1.4;
        while (true) {
          yield* stoke(b, 3); yield* piston(b); yield* sweep(b, [side()]);
          yield* furnace(b, [myCar(S).id]); yield* sweep(b, [0]); yield* hook(b);
          yield* lean(b, side()); yield* stoke(b, 3); yield* sweep(b, [side()]); yield* piston(b);
          yield* furnace(b, rnd() < 0.5 ? ['T', 'A'] : ['T', 'B']); yield* sweep(b, [pick([-1, 0, 1])]); yield 1.0;
        }
      } },
      { at: 0.67, *enter(b) {
        const S = b.state; S.lean = 0; b.autoFace = true; Sound.sfx('roar', 0.8, 0.8); Sound.sfx('steam', 1, 0.4); FX.shake(0.7);
        S.storm = 1; Co.start(uncouple(b, 'C'), 'fight'); Co.start(skyTo(b, { uCloud: 0.66, uCloudCol: 0x8090b0, uCloudDark: 0x10141f, uStars: 0.3, uHor: 0x1e2842, uCloudScale: 0.8 }, 0.8), 'fight'); Co.start(fogTo(0x1c2840, 0.0046, 1), 'fight');
        S.tunnel.position.z = -520; S.tunnelGo = 1; yield 3.6; S.dark = 1; yield 1.0;
        S.gyT = GY - 46; S.gy = GY - 46; S.trestle.visible = true; yield 1.6; S.dark = 0;
        Co.start(Post.lerpTo({ tint: [0.94, 1.0, 1.12], bloom: 0.52 }, 2), 'fight'); Sound.sfx('thunder', 0.7); S.sky.material.uniforms.uFlash.value = 1.2;
        yield 0.6;
      }, *run(b) {
        const S = b.state; setLvl(b, 1); S.gy = S.gyT;
        while (true) {
          yield* sweep(b, [side(), 0]); yield* stoke(b, 4); yield* piston(b);
          { const s = side(); yield* lean(b, s, 3.6, true); }
          yield* furnace(b, [myCar(S).id]); yield* hook(b); yield* sweep(b, [-1, 1]);
          yield* stoke(b, 3); yield* furnace(b, ['T', rnd() < 0.5 ? 'A' : 'B']); yield* sweep(b, [0]); yield* piston(b);
          { const s = side(); yield* lean(b, s, 3.0); } yield* sweep(b, [side(), 0], 1.7);
        }
      } },
      { at: 0.34, *enter(b) {
        const S = b.state; S.lean = 0; b.autoFace = true; S.heat = 1; S.storm = 0;
        Co.start(uncouple(b, 'B'), 'fight');
        yield* b.cast({ name: 'Full Steam', time: 3.0, onTick: (k) => { FX.shake(k * 0.5); S.speedT = 38 + k * 18; } });
        Sound.sfx('roar', 1, 0.5); Sound.sfx('bigboom'); FX.flash(FIRE, 0.5, 1.2); FX.shake(1.2); S.wind = 1;
        Co.start(skyTo(b, { uHor: 0xffa860, uTop: 0x2a1238, uStars: 0.1, uCloud: 0.5, uCloudCol: 0xff9a58, uCloudDark: 0x3a1a38, uCloudScale: 0.55, uSunCol: 0x8a6044, uSunGlow: 0.16, uExp: 0.36 }, 6), 'fight'); Co.start(sunTo(b, [0.42, 0.025, -1], 0.05, 6), 'fight');
        Co.start(fogTo(0x7a4a5a, 0.0036, 5), 'fight'); Co.start(Post.lerpTo({ tint: [1.04, 0.99, 0.95], bloom: 0.34, threshold: 0.96, exposure: 1.12 }, 4), 'fight');
        S.hemi.color.set(0x6a78a8); S.hemi.groundColor.set(0x3a2a22); S.sun.color.set(0xffc090); S.sun.position.set(0.95, 0.55, -0.35).normalize().multiplyScalar(80); S.sunI = 3.4; yield 1.8;
      }, *run(b) {
        const S = b.state; setLvl(b, 2); S.heat = 1; S.gy = S.gyT;
        while (true) {
          yield* cinders(b, 5); yield* sweep(b, [side(), 0], 1.7); yield* piston(b);
          yield* stoke(b, 3); { const s = side(); yield* lean(b, s, 3.2, true); }
          yield* furnace(b, [myCar(S).id], 4.5); yield* hook(b);
          yield* sweep(b, [-1, 1], 1.7); yield* cinders(b, 4); yield* stoke(b, 3); yield* sweep(b, [0], 1.6); yield* piston(b, true);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      S.speed = damp(S.speed, S.speedT, 0.8, dt); S.scroll += S.speed * dt;
      // cars: coupling bounce, cars cut loose, things that push you around
      const fight = G.state === 'fight' && p.alive;
      for (const c of S.cars) {
        if (c.warn > 0) c.warn -= dt; if (c.hot > 0) c.hot -= dt;
        if (c.loose && c.on) { c.v = Math.min(30, c.v + 6 * dt); c.off += c.v * dt; if (fight && carAt(S, p.pos.x, p.pos.z) === c && p.grounded) p.push.z += c.v; if (c.off > 70) { c.on = false; c.grp.visible = false; } }
      }
      if (fight && p.grounded && !p.dash && !p.kb) {
        const gp = gapAt(S, p.pos.x, p.pos.z);
        if (gp) { const mid = (gp[0].z1 + gp[1].z0) / 2, dz = p.intentZ < -0.2 ? -1 : p.intentZ > 0.2 ? 1 : (p.pos.z < mid ? -1 : 1); p.hurt(220, { blockable: false, src: { name: 'The coupling' } }); p.vy = 7.5; p.grounded = false; p.kb = { vx: 0, vz: dz * 9, t: 0.38 }; FX.impact(p.pos.x, 0.2, p.pos.z, 0xffd080, 1); Sound.sfx('hit', 1, 0.5); }
      }
      S.leanK = damp(S.leanK, S.lean, 2.2, dt); S.windK = damp(S.windK, S.wind, 0.8, dt);
      if (fight && p.grounded) { p.push.x += S.leanK * 3.5; p.push.z += S.windK * 2.1; }
      for (const o of S.obs) if (o.on) { o.t += dt; if (o.t > 1.2) { o.on = false; o.g.visible = false; } }
      if (S.tunnelGo) { S.tunnel.position.z += S.speed * 3.2 * dt; if (S.tunnel.position.z > 400) S.tunnelGo = 0; }
      if (G.headless) return;
      // scenery
      const sc = S.scroll, lv = S.lvl || 0; S.bed.position.z = sc % 2.6; S.poles.position.z = sc % 46; S.scrub.position.z = sc % S.scrubP; S.hills.position.z = sc % S.hillP; S.cliffs.position.z = sc % 300;
      S.gy = damp(S.gy, S.gyT, 3, dt); S.ground.position.y = S.gy; S.scrub.position.y = S.gy - GY; S.streaks.position.y = S.gy - GY; S.shoulder.position.y = S.gy - GY; S.shoulder.position.z = sc % 2.6; S.trestle.position.z = sc % 13;
      const off = sc / 20; S.sand.map.offset.y = off % 1; S.sand.normalMap.offset.y = off % 1; S.shMap.offset.y = S.shN.offset.y = (sc / 20) % 1; S.streakM.uniforms.uS.value = sc;
      { const tz = S.tunnel.position.z, rel = -10 - tz; if (Math.abs(rel) < 75) { const lz = Math.round((rel + 70) / 10) * 10 - 70 + tz, d = Math.abs(lz + 10); S.tunL.position.set(Math.sin(lz) > 0 ? 9 : -9, 5, lz); S.tunL.intensity = 260 * Math.max(0, 1 - d / 6); } else S.tunL.intensity = 0; }
      const dk = S.darkK = damp(S.darkK || 0, S.dark, 5, dt); S.sun.intensity = S.sunI * (1 - dk * 0.95); S.hemi.intensity = S.hemiI * (1 - dk * 0.85); S.lampL.intensity = (lv === 2 ? 45 : 90) * (1 - dk * 0.9); if (p) { S.lampL.position.x = damp(S.lampL.position.x, p.pos.x * 0.6, 3, dt); S.lampL.position.z = damp(S.lampL.position.z, p.pos.z + 5, 3, dt); }
      const U = S.sky.material.uniforms; S.dust.material.uniforms.uVel.value.z = S.speed * 1.2; U.uFlash.value = Math.max(0, U.uFlash.value - dt * 2.5);
      // storm over the canyon: lightning behind the clouds, the cloud deck flickering, rain, a wet deck
      if (lv === 1) {
        if ((S.boltT -= dt) <= 0) { S.boltT = 2.2 + vrand() * 3; U.uFlash.value = 0.7 + vrand() * 0.5; const a = (vrand() - 0.5) * 1.3, r = 170; _a.set(Math.sin(a) * r, 42, -Math.cos(a) * r); _b2.set(_a.x + (vrand() - 0.5) * 30, GY - 2, _a.z); S.boltGlow.position.copy(_a); S.boltGlow.lookAt(camera.position); S.boltK = 1; FX.lightning(_a, _b2, { width: 0.22, jag: 9, dur: 0.3 }); for (let k = 0; k < 2; k++) { const m = new V3().lerpVectors(_a, _b2, 0.25 + k * 0.3); FX.lightning(m, new V3(m.x + (vrand() - 0.5) * 30, m.y - 14 - vrand() * 12, m.z + (vrand() - 0.5) * 10), { width: 0.1, jag: 5, dur: 0.22 }); } Sound.sfx('thunder', 0.25); }
        if ((S.flickT = (S.flickT || 0) - dt) <= 0) { S.flickT = 0.5 + vrand() * 1.2; U.uFlash.value = Math.max(U.uFlash.value, 0.18 + vrand() * 0.22); }
      }
      S.boltK = Math.max(0, (S.boltK || 0) - dt * 3); S.boltGlow.visible = S.boltK > 0.01; S.boltGlow.material.uniforms.uI.value = S.boltK;
      S.rainK = damp(S.rainK || 0, lv === 1 || S.storm ? 1 : 0, 2.5, dt); S.rain.material.uniforms.uAlpha.value = S.rainK * 0.95; S.rain.visible = S.rainK > 0.01;
      S.deckM.roughness = 0.8 - S.rainK * 0.5; S.deckM.metalness = 0.05 + S.rainK * 0.25;
      S.rimC.setHex(lv === 2 ? 0x5a5c84 : lv === 1 ? 0x44567e : 0x46587e).multiplyScalar(1 + U.uFlash.value * 1.5);
      for (const c of S.cars) {
        if (!c.on) continue; c.grp.position.z = c.zc + c.off; c.grp.position.y = c.warn > 0 ? Math.sin(t * 40) * 0.03 : 0;
        for (let i = 0; i < c.wheels.length; i += 2) c.wheels[i + 1].rotation.x = -(sc + c.off) / 0.95;
        const h = c.hot > 0 ? (c.hot > c.hotDur ? 0.25 + (1 - (c.hot - c.hotDur) / c.heatT) * 0.5 : 1) : 0; c.heat = damp(c.heat, h, 5, dt); c.heatM.uniforms.uH.value = c.heat * (1.5 + Math.sin(t * 9) * 0.3); c.heatM.uniforms.uT.value = t;
        c.boltM.color.setHex(SIGNAL).multiplyScalar(c.warn > 0 ? (Math.sin(t * 16) > 0 ? 6 : 0.4) : 0.05);
        if (c.heat > 0.7 && vrand() < dt * 30) FX.burst((vrand() - 0.5) * 9, 0.1, c.zc + (vrand() - 0.5) * 13, { n: 1, color: FIRE, color2: 0xffe0a0, speed: [0.5, 2], up: 5, life: [0.3, 0.8], size: [0.3, 0.8] });
        if (lv >= 1 && !c.loose && vrand() < dt * 45) { const sx = vrand() < 0.5 ? -1 : 1; FX.burst(sx * (HW + 0.35), -0.75, c.grp.position.z + (vrand() - 0.5) * (c.z1 - c.z0 - 3), { n: 4, color: 0xffe0a0, color2: FIRE, dir: [sx * 0.7, 0.45, 1], spread: 0.3, speed: [7, 16], grav: 16, life: [0.2, 0.5], size: [0.1, 0.22] }); }
      }
      for (const d of S.drive) { if (d.userData.rod) d.position.y = GY + 2.2 + Math.sin(sc / 1.75) * 0.7; else d.rotation.x = -sc / 1.75; }
      if (vrand() < dt * 60) FX.burst(0, 8.4, -63, { n: 1, smoke: true, color: S.heat ? 0x9a6248 : 0x8a8a96, color2: S.heat ? 0x2a1814 : 0x202430, dir: [0, 0.5, 1], spread: 0.1, speed: [S.speed * 0.5, S.speed * 0.75], life: [1.2, 2.0], size: [3, 6], alpha: 0.35 });
      if (S.heat && vrand() < dt * 40) FX.burst(0, 8.2, -63, { n: 2, color: 0xffb050, color2: FIRE, dir: [0, 0.6, 1], spread: 0.25, speed: [8, 18], life: [0.3, 0.8], size: [0.5, 1.2] });
      if ((S.lean || S.leanTele) && vrand() < dt * 80) { const s = S.lean || S.leanTele, c = pick(live(S)); if (c) { FX.burst(-s * 1.6, GY + 0.6, c.zc + (vrand() - 0.5) * 12, { n: 2, color: 0xffd080, color2: FIRE, dir: [s, 0.5, 0.6], spread: 0.3, speed: [6, 16], grav: 12, life: [0.3, 0.7], size: [0.12, 0.3] }); } }
      if (S.windK > 0.3 && vrand() < dt * 50) FX.burst((vrand() - 0.5) * 12, 3 + vrand() * 5, -44, { n: 1, color: 0xffb050, color2: 0xff3010, dir: [0, 0.05, 1], spread: 0.08, speed: [24, 40], life: [0.8, 1.6], size: [0.1, 0.25] });
      // trackside rigs: hidden once they reach the camera plane so they never fill the screen as they rush past
      for (const o of S.obs) if (o.on) { o.g.position.z = -9 + o.t * 95; o.g.visible = o.g.position.z < camera.position.z - 1.5; }
      S.sigM.forEach((m, i) => m.color.setHex(lv === 2 && !S.sig[i] ? 0xff4a18 : SIGNAL).multiplyScalar(S.sig[i] ? (Math.sin(t * 18) > -0.3 ? 4.5 : 1.2) : lv === 2 ? 1.5 + Math.sin(t * 4 + i) * 0.25 : 0.06));
      // coals in flight; cinder coals ride on their bullets and are dropped once a bullet stops reporting
      S.coalM.uniforms.uT.value = t;
      for (const c of S.coals) { if (!c.m.visible) continue; c.t += dt; const k = Math.min(1, c.t / c.T); c.m.position.lerpVectors(c.a, c.b, k); c.m.position.y += Math.sin(k * PI) * 6; c.m.rotation.set(t * 7, t * 5, 0); if (vrand() < dt * 60) FX.burst(c.m.position.x, c.m.position.y, c.m.position.z, { n: 2, color: 0xffb050, color2: FIRE, speed: [0.5, 2.5], life: [0.2, 0.45], size: [0.12, 0.3] }); if (k >= 1) c.m.visible = false; }
      for (const m of S.ccoals) if (m.visible) { if (t - m.userData.seen > 0.12) m.visible = false; else m.rotation.set(t * 6, t * 4, 0); }
      // Ironjaw
      S.punch = Math.max(0, (S.punch || 0) - dt * 2.4); const cast = b.castState ? 1 : 0; S.castK = damp(S.castK || 0, cast, 6, dt); const ck = S.castK;
      S.rig.position.y = Math.sin(t * 9) * 0.03; S.rig.rotation.x = (S.wind_up ? -0.14 : 0) + S.punch * 0.12; S.head.rotation.y = Math.sin(t * 0.8) * 0.2; S.jaw.rotation.x = 0.3 + ck * 0.28 + Math.abs(Math.sin(t * 5)) * 0.08 * ck + S.punch * 0.15;
      for (const A of S.arms) { const up = A.sx > 0 ? (S.wind_up ? 1 : 0) : (S.hookUp ? 1 : 0); A.ext = damp(A.ext, up, 6, dt); const pk = A.sx > 0 ? S.punch : 0; A.sh.rotation.set(-0.25 - A.ext * 1.7 + pk * 2.2 + Math.sin(t * 1.3 + A.sx) * 0.05, 0, A.sx * (0.25 + A.ext * 0.25)); A.rodM.scale.y = 1 + pk * 0.8; A.fist.position.y = -3.4 - pk * 1.6; }
      // ghost the whole boss (every part together, glow damped) when he stands between the camera and the player
      { const c = camera.position, sx = p.pos.x - c.x, sy = p.pos.y + 1.2 - c.y, sz = p.pos.z - c.z, l2 = Math.max(sx * sx + sy * sy + sz * sz, 1e-6), k = clamp(((b.pos.x - c.x) * sx + (3.4 - c.y) * sy + (b.pos.z - c.z) * sz) / l2, 0, 1);
        const dx = c.x + sx * k - b.pos.x, dy = c.y + sy * k - 3.4, dz = c.z + sz * k - b.pos.z, hit = !Cam.cine && k < 0.97 && dx * dx + dy * dy * 0.3 + dz * dz < 2.7 * 2.7;
        S.fadeA = damp(S.fadeA === undefined ? 1 : S.fadeA, hit ? 0.55 : 1, 8, dt); const fading = S.fadeA < 0.99;
        if (fading !== !!S.fading) { S.fading = fading; for (const m of S.bMats) m.depthWrite = !fading; }
        if (fading || S.fadeWas) for (const m of S.bMats) m.opacity = fading ? (m === S.plateM || m === S.plateN ? S.fadeA : m === S.bBrass ? S.fadeA * 0.4 : S.fadeA * 0.75) : 1; S.fadeWas = fading; S.fadeU.value = fading ? S.fadeA * 0.85 : 1; }
      const fa = S.fadeA, heatL = lv === 2 ? 1 : lv === 1 ? 0.6 : 0, fl = Math.sin(t * 7) * 0.08 + Math.sin(t * 17) * 0.05;
      S.fireM.uniforms.uT.value = t; S.fireM.uniforms.uI.value = (0.75 + heatL * 0.8 + ck * 0.6) * (1 + fl) * fa;
      S.furL.intensity = (26 + heatL * 26 + ck * 30) * (1 + fl) * fa;
      S.seamM.color.setHex(heatL > 0.9 ? 0xff4a14 : FIRE).multiplyScalar((0.5 + heatL * 1.6 + ck * 0.6 + (heatL > 0.9 ? Math.sin(t * 3) * 0.4 : 0)) * fa);
      S.plateM.emissiveIntensity = (heatL > 0.9 ? 0.32 + Math.sin(t * 3) * 0.1 + ck * 0.2 : heatL * 0.2) * fa;
      S.rodU.uI.value = (0.75 + heatL * 0.5 + (S.wind_up ? 0.6 : 0) + S.punch * 0.8) * fa; S.forgeU.uI.value = (0.55 + (S.wind_up ? 0.7 : 0) + S.punch * 1.0 + heatL * 0.3) * fa; S.forgeU.uT.value = t;
      S.mouthM.color.setHex(0xc02a0c).multiplyScalar((1.0 + ck * 1.6 + heatL * 0.8) * fa); S.lensU.uI.value = (1.25 + ck * 0.7) * fa;
      S.skirtU.uI.value = heatL > 0.9 ? (0.9 + Math.sin(t * 2.3) * 0.2 + ck * 0.4) * fa : 0; S.skirtU.uT.value = t; S.skirt.visible = heatL > 0.9;
      for (const f of S.flames) { f.material.uniforms.uT.value = t; f.material.uniforms.uI.value = (heatL > 0.9 ? 1.25 : heatL > 0.5 ? 0.6 : 0) * (1 + ck * 0.5) * fa; f.visible = heatL > 0.5; }
      S.winU.uT.value = t; S.winU.uI.value = 0.32 + heatL * 0.15; S.fbU.uT.value = t; S.fbU.uI.value = (0.35 + heatL * 0.25) * (1 + fl);
      if (vrand() < dt * (heatL > 0.9 ? 35 : 10)) FX.burst(b.pos.x - 1.2, 6.9, b.pos.z - 0.9, { n: 1, smoke: true, color: heatL > 0.9 ? 0x5a3a30 : 0x40424a, color2: 0x141418, dir: [0, 1, 0.35], spread: 0.12, speed: [3, 5], life: [1.0, 1.8], size: [1.3, 2.8], alpha: heatL > 0.9 ? 0.12 : 0.16 });
      if (heatL > 0.9 && vrand() < dt * 40) FX.burst(b.pos.x - 1.2, 6.8, b.pos.z - 0.9, { n: 2, color: 0xffb050, color2: FIRE, dir: [0, 1, 0.3], spread: 0.3, speed: [3, 7], life: [0.25, 0.6], size: [0.35, 0.8] });
      if (heatL > 0.9 && vrand() < dt * 30) { S.arms[vrand() < 0.5 ? 0 : 1].sh.getWorldPosition(_a); FX.burst(_a.x, _a.y + 0.6, _a.z, { n: 1, color: 0xffc060, color2: 0xff3010, dir: [0, 0.6, 1], spread: 0.4, speed: [2, 5], life: [0.5, 1.0], size: [0.1, 0.22] }); }
      if (lv >= 1) for (const v of S.valves) if (vrand() < dt * 8) { v.getWorldPosition(_a); FX.burst(_a.x, _a.y + 0.15, _a.z, { n: 1, smoke: true, color: lv === 2 ? 0xc89070 : 0xb8c0cc, color2: lv === 2 ? 0x4a2e28 : 0x5a6270, dir: [0, 0.8, 0.7], spread: 0.25, speed: [2.5, 5], life: [1.2, 2.0], size: [1.4, 3.0], alpha: 0.1, drag: 1.2 }); }
    },
    danger(b, x, z) {
      const S = b.state, c = carAt(S, x, z); let best = Infinity;
      if (c && c.warn > 0) best = c.warn; if (c && c.hot > 0) best = Math.min(best, Math.max(0, c.hot - c.hotDur)); if (c && c.loose) best = 0; if (!c && gapAt(S, x, z)) best = 0.4;
      if (S.lean && x * S.lean > 2.4) best = Math.min(best, 0.6);
      return best;
    },
    bot(b, p) {
      const S = b.state;
      // hop the couplings
      if (p.grounded && p.moving) for (let i = 0; i < 3; i++) { const a = S.cars[i], c = S.cars[i + 1]; if (!a.on || !c.on || a.loose || c.loose) continue; if ((p.intentZ > 0.3 && p.pos.z > a.z1 - 0.9 && p.pos.z <= a.z1 + 0.2) || (p.intentZ < -0.3 && p.pos.z < c.z0 + 0.9 && p.pos.z >= c.z0 - 0.2)) p.jump(); }
      const h = { avoid: (x, z) => Math.abs(x) > HW - 0.9 || (S.wind && !gapAt(S, x, z) && (() => { const c = carAt(S, x, z); return c && z > c.z1 - 1.2 && c === live(S)[live(S).length - 1]; })()) };
      if (S.wind && !p.cls.melee) { const c = myCar(S); if (c) { h.x = clamp(p.pos.x, -3, 3); h.z = clamp(p.pos.z, c.z0 + c.off + 2, c.z1 + c.off - 4.5); } }
      if (S.wind) { const c = myCar(S); if (c && p.pos.z > c.z1 + c.off - 3.4) { p.casting = null; Bot.timer = 0; h.x = clamp(p.pos.x, -3, 3); h.z = c.z1 + c.off - 7; } }
      return h;
    },
  });
})();
