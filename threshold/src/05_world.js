// Camera rig + world-building helpers shared by every arena: sky, water, lava, procedural textures, lights, ambient particles.
const Cam = {
  yaw: 0, pitch: 0.38, dist: 14, tDist: 14, shakeAmt: 0, focus: new V3(), fov: 55, cine: null, cineW: 0, cPos: new V3(), cLook: new V3(), cFov: 55,
  minDist: 4, maxDist: 26,
  reset(yaw) { this.yaw = yaw === undefined ? (G.player ? G.player.facing : 0) : yaw; this.pitch = 0.36; this.tDist = this.dist = 14; if (G.player) this.focus.copy(G.player.pos).y += 1.5; },
  // Cinematic shot: set Cam.cine = {pos: V3, look: V3, fov?} every frame from a script; set to null to blend back to the player camera.
  update(rdt) {
    this.yaw = wrapPi(this.yaw + Input.lookX); this.pitch = clamp(this.pitch + Input.lookY, -0.32, 1.42);
    if (Input.zoom) this.tDist = clamp(this.tDist * (1 + Input.zoom * 0.12), this.minDist, this.maxDist);
    this.dist = damp(this.dist, this.tDist, 10, rdt);
    const p = G.player;
    if (p) { const ty = Math.max(p.pos.y, -3) + 1.55; this.focus.x = damp(this.focus.x, p.pos.x, 22, rdt); this.focus.z = damp(this.focus.z, p.pos.z, 22, rdt); this.focus.y = damp(this.focus.y, ty, 10, rdt); }
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    let px = this.focus.x - Math.sin(this.yaw) * cp * this.dist, py = this.focus.y + sp * this.dist, pz = this.focus.z - Math.cos(this.yaw) * cp * this.dist;
    if (G.arena && G.arena.camLimit) { const q = G.arena.camLimit(px, py, pz, this.focus); px = q.x; py = q.y; pz = q.z; }
    if (py < 0.35 && this.focus.y > 0) py = 0.35;
    this.cineW = this.cine ? Math.min(1, this.cineW + rdt * 2.5) : Math.max(0, this.cineW - rdt * 1.4);
    if (this.cine) { this.cPos.copy(this.cine.pos); this.cLook.copy(this.cine.look); this.cFov = this.cine.fov || 50; }
    const w = smooth(this.cineW);
    camera.position.set(lerp(px, this.cPos.x, w), lerp(py, this.cPos.y, w), lerp(pz, this.cPos.z, w));
    const lx = lerp(this.focus.x, this.cLook.x, w), ly = lerp(this.focus.y, this.cLook.y, w), lz = lerp(this.focus.z, this.cLook.z, w);
    if (this.shakeAmt > 0.001) { const s = this.shakeAmt * 0.3; camera.position.x += (vrand() - 0.5) * s; camera.position.y += (vrand() - 0.5) * s; camera.position.z += (vrand() - 0.5) * s; this.shakeAmt *= Math.exp(-rdt * 6); }
    camera.lookAt(lx, ly, lz);
    this.fadeOccluders(rdt, lx, ly, lz);
    const f = lerp(this.fov, this.cFov, w); if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
  },
  // generator: fly the cinematic camera from (p0,l0) to (p1,l1) over dur seconds. Arrays [x,y,z].
  *shot(p0, l0, p1, l1, dur, fov = 48) {
    const c = { pos: new V3(...p0), look: new V3(...l0), fov }; this.cine = c; let t = 0;
    while (t < dur) { t += G.dt; const k = smooth(t / dur); c.pos.set(lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k), lerp(p0[2], p1[2], k)); c.look.set(lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k), lerp(l0[2], l1[2], k)); if (this.cine !== c) return; yield; }
  },
  release() { this.cine = null; },
  // Meshes with userData.fadeOcclude = true fade out while they sit between the camera and what it looks at (pillars, tree
  // canopies, a giant boss's limbs). The fade sets the mesh's own material(s) transparent, so give such meshes their own
  // material; an InstancedMesh fades as a whole. userData.fadeMin sets how far it fades (default 0.18).
  occ: [], occScan: 0,
  fadeOccluders(rdt, lx, ly, lz) {
    if (G.headless) return;
    if ((this.occScan -= rdt) <= 0) { this.occScan = 1; this.occ.length = 0; scene.traverse((o) => { if (o.isMesh && o.userData.fadeOcclude) this.occ.push(o); }); }
    if (!this.occ.length) return;
    const c = camera.position, sx = lx - c.x, sy = ly - c.y, sz = lz - c.z, sl2 = Math.max(sx * sx + sy * sy + sz * sz, 1e-6);
    for (const o of this.occ) {
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const bs = o.geometry.boundingSphere; _occV.copy(bs.center).applyMatrix4(o.matrixWorld);
      const r = bs.radius * Math.max(o.matrixWorld.getMaxScaleOnAxis(), 1e-4);
      const k = clamp(((_occV.x - c.x) * sx + (_occV.y - c.y) * sy + (_occV.z - c.z) * sz) / sl2, 0, 1);
      const dx = c.x + sx * k - _occV.x, dy = c.y + sy * k - _occV.y, dz = c.z + sz * k - _occV.z;
      const hit = o.visible && k < 0.97 && dx * dx + dy * dy + dz * dz < r * r * 0.7;
      const ud = o.userData, target = hit ? (ud.fadeMin === undefined ? 0.18 : ud.fadeMin) : 1;
      ud.fadeA = damp(ud.fadeA === undefined ? 1 : ud.fadeA, target, 8, rdt);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const fading = ud.fadeA < 0.995;
      for (const m of mats) {
        const mu = m.userData;
        if (mu.fadeBase === undefined) { mu.fadeBase = m.opacity; mu.fadeT = m.transparent; mu.fadeDW = m.depthWrite; mu.fading = false; }
        if (mu.fading !== fading) { mu.fading = fading; m.transparent = fading || mu.fadeT; m.depthWrite = fading ? false : mu.fadeDW; m.needsUpdate = true; }
        m.opacity = mu.fadeBase * ud.fadeA;
      }
    }
  },
};
const _occV = new THREE.Vector3();
Hooks.frame.push((rdt, stage) => { if (stage === 1) Cam.update(rdt); });

const W = (() => {
  // ---------- value noise on the CPU for texture baking ----------
  function hash2(x, y, s) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s, period) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const w = (n) => period ? ((n % period) + period) % period : n;
    const a = hash2(w(xi), w(yi), s), b = hash2(w(xi + 1), w(yi), s), c = hash2(w(xi), w(yi + 1), s), d = hash2(w(xi + 1), w(yi + 1), s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, oct = 5, period = 0) { let a = 0.5, f = 1, sum = 0, n = 0; for (let i = 0; i < oct; i++) { sum += a * vnoise(x * f, y * f, s + i * 17, period ? period * f : 0); n += a; a *= 0.5; f *= 2; } return sum / n; }
  function cell(x, y, s, period) { // returns [F1, F2-F1]
    const xi = Math.floor(x), yi = Math.floor(y); let f1 = 9, f2 = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = xi + i, cy = yi + j, wx = period ? ((cx % period) + period) % period : cx, wy = period ? ((cy % period) + period) % period : cy;
      const px = cx + hash2(wx, wy, s), py = cy + hash2(wx, wy, s + 5), d = Math.hypot(px - x, py - y);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return [f1, f2 - f1];
  }
  // Bake {map, normalMap, roughnessMap} from height(u,v)->[h 0..1, tone 0..1, rough 0..1]. Tileable if the fn is periodic in u,v in [0,1).
  function bake(size, fn, o = {}) {
    const H = new Float32Array(size * size), mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
    const cm = mk(), cn = mk(), cr = mk(), xm = cm.getContext('2d'), xn = cn.getContext('2d'), xr = cr.getContext('2d');
    const im = xm.createImageData(size, size), inn = xn.createImageData(size, size), ir = xr.createImageData(size, size);
    const c0 = new THREE.Color(o.dark || 0x333333), c1 = new THREE.Color(o.light || 0xaaaaaa);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const r = fn(x / size, y / size), i = y * size + x; H[i] = r[0];
      const t = r[1], k = i * 4;
      im.data[k] = 255 * lerp(c0.r, c1.r, t); im.data[k + 1] = 255 * lerp(c0.g, c1.g, t); im.data[k + 2] = 255 * lerp(c0.b, c1.b, t); im.data[k + 3] = 255;
      const rr = 255 * sat(r[2]); ir.data[k] = ir.data[k + 1] = ir.data[k + 2] = rr; ir.data[k + 3] = 255;
    }
    const st = o.strength || 3;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const xl = H[y * size + (x + size - 1) % size], xr2 = H[y * size + (x + 1) % size], yu = H[((y + size - 1) % size) * size + x], yd = H[((y + 1) % size) * size + x];
      let nx = (xl - xr2) * st, ny = (yu - yd) * st, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const k = (y * size + x) * 4; inn.data[k] = (nx * 0.5 + 0.5) * 255; inn.data[k + 1] = (-ny * 0.5 + 0.5) * 255; inn.data[k + 2] = (nz * 0.5 + 0.5) * 255; inn.data[k + 3] = 255;
    }
    xm.putImageData(im, 0, 0); xn.putImageData(inn, 0, 0); xr.putImageData(ir, 0, 0);
    const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; const rp = o.repeat || 1; t.repeat.set(rp, rp); return t; };
    return { map: tex(cm, true), normalMap: tex(cn), roughnessMap: tex(cr) };
  }
  const SURF = {
    stone: (seed = 1, cells = 6) => (u, v) => { const n = fbm(u * 8, v * 8, seed, 5, 8), c = cell(u * cells, v * cells, seed, cells), crack = smooth(sat(c[1] * 9)); const h = n * 0.5 + crack * 0.5; return [h, n * 0.75 + crack * 0.25, 0.9 - n * 0.3]; },
    slabs: (seed = 1, n = 4) => (u, v) => { const fu = (u * n) % 1, fv = (v * n) % 1, e = Math.min(fu, 1 - fu, fv, 1 - fv), seam = smooth(sat(e * 28)), nz = fbm(u * 16, v * 16, seed, 5, 16), id = hash2(Math.floor(u * n), Math.floor(v * n), seed); return [seam * 0.7 + nz * 0.3, (0.35 + id * 0.35 + nz * 0.3) * (0.4 + 0.6 * seam), 0.75 - nz * 0.35 + (1 - seam) * 0.2]; },
    metal: (seed = 1) => (u, v) => { const streak = fbm(u * 3, v * 90, seed, 3, 3), sc = fbm(u * 40, v * 40, seed + 3, 3, 40); const fu = (u * 2) % 1, fv = (v * 2) % 1, e = Math.min(fu, 1 - fu, fv, 1 - fv), seam = smooth(sat(e * 40)); return [seam * 0.8 + streak * 0.1 + sc * 0.1, 0.5 + streak * 0.3 + sc * 0.2, 0.25 + streak * 0.25 + (1 - seam) * 0.4]; },
    wood: (seed = 1, planks = 6) => (u, v) => { const p = Math.floor(u * planks), fu = (u * planks) % 1, e = Math.min(fu, 1 - fu), seam = smooth(sat(e * 16)), g = fbm(u * 4 + p * 7.3, v * 60, seed, 4, 0), w = fbm(u * 2, v * 3, seed + p, 3, 0); return [seam * 0.7 + g * 0.3, (0.35 + g * 0.45 + w * 0.2) * (0.5 + 0.5 * seam), 0.55 + g * 0.3]; },
    rock: (seed = 1) => (u, v) => { const n = fbm(u * 5, v * 5, seed, 6, 5), c = cell(u * 4, v * 4, seed, 4), r = 1 - sat(c[0] * 1.2); const h = n * 0.6 + r * 0.4; return [h, h, 0.95 - n * 0.2]; },
  };
  function surface(kind, o = {}) { return bake(o.size || 512, SURF[kind](o.seed || 1, o.n), o); }
  function mat(o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color: 0x888888, roughness: 0.8, metalness: 0 }, o)); }
  function glow(color, intensity = 2, o = {}) { return new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(color).multiplyScalar(intensity) }, o)); }

  // ---------- sky ----------
  // Uniform-driven dome: gradient, sun/moon disc, stars, fbm clouds, aurora, nebula. Tween `mesh.material.uniforms` to change the sky per phase.
  function sky(o = {}) {
    const U = {
      uTime: { value: 0 }, uTop: { value: new THREE.Color(o.top || 0x0a1430) }, uHor: { value: new THREE.Color(o.horizon || 0x30405a) }, uBot: { value: new THREE.Color(o.bottom || 0x05060a) },
      uSunDir: { value: new V3(...(o.sunDir || [0.3, 0.5, -0.8])).normalize() }, uSunCol: { value: new THREE.Color(o.sunColor || 0xffffff) }, uSunSize: { value: o.sunSize === undefined ? 0.03 : o.sunSize }, uSunGlow: { value: o.sunGlow === undefined ? 1 : o.sunGlow },
      uStars: { value: o.stars || 0 }, uCloud: { value: o.clouds || 0 }, uCloudCol: { value: new THREE.Color(o.cloudColor || 0x888888) }, uCloudDark: { value: new THREE.Color(o.cloudDark || 0x111111) }, uCloudScale: { value: o.cloudScale || 1.5 }, uCloudSpeed: { value: o.cloudSpeed || 0.01 },
      uAurora: { value: o.aurora || 0 }, uAurCol: { value: new THREE.Color(o.auroraColor || 0x40ffb0) }, uNeb: { value: o.nebula || 0 }, uNebA: { value: new THREE.Color(o.nebulaA || 0x6020a0) }, uNebB: { value: new THREE.Color(o.nebulaB || 0x1060c0) },
      uExp: { value: o.exp || 0.6 }, uFlash: { value: 0 },
    };
    const m = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 32), new THREE.ShaderMaterial({
      uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
      fragmentShader: `
        uniform float uTime,uSunSize,uSunGlow,uStars,uCloud,uCloudScale,uCloudSpeed,uAurora,uNeb,uExp,uFlash; uniform vec3 uTop,uHor,uBot,uSunDir,uSunCol,uCloudCol,uCloudDark,uAurCol,uNebA,uNebB; varying vec3 vD;
        float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
        float h31(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*n2(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
        void main(){
          vec3 d=normalize(vD); float h=d.y;
          vec3 col = h>0.0 ? mix(uHor,uTop,pow(clamp(h,0.0,1.0),uExp)) : mix(uHor,uBot,pow(min(1.0,-h*2.5),0.6));
          float sd=max(0.0,dot(d,uSunDir));
          if (uNeb>0.0){ vec2 q=d.xz/(abs(d.y)+0.6)*1.4; float n=fbm(q*1.5+3.0), m=fbm(q*3.0-7.0); col+=uNeb*(uNebA*pow(n,2.5)*2.2+uNebB*pow(m,3.0)*2.4); }
          if (uStars>0.0){ vec3 gp=d*170.0; vec3 g=floor(gp); vec3 fp=fract(gp)-0.5; float s=h31(g); float tw=0.75+0.25*sin(uTime*2.0+s*90.0); float disc=smoothstep(0.42,0.0,length(fp)); col+=uStars*step(0.972,s)*disc*disc*tw*mix(vec3(1.0,0.82,0.65),vec3(0.75,0.86,1.0),h31(g+3.0))*(0.5+h31(g+7.0)*3.0)*smoothstep(-0.05,0.2,abs(h)+uNeb); }
          if (uAurora>0.0 && h>0.02){ float az=atan(d.x,d.z); float band=fbm(vec2(az*3.0+uTime*0.05,h*2.0-uTime*0.03)); float curt=pow(sat(1.0-abs(h-0.32-band*0.25)*3.2),2.0)*(0.5+0.5*sin(az*40.0+band*20.0+uTime)); col+=uAurora*uAurCol*curt*band*2.4; }
          col += uSunCol*(pow(sd,900.0/(1.0+uSunSize*900.0))*0.0 + smoothstep(1.0-uSunSize*0.02,1.0-uSunSize*0.012,sd)*6.0 + uSunGlow*(pow(sd,180.0)*1.5+pow(sd,14.0)*0.35+pow(sd,3.0)*0.08));
          if (uCloud>0.0 && h>-0.02){ vec2 q=d.xz/(h+0.22)*uCloudScale+uTime*uCloudSpeed; float c=fbm(q+fbm(q*0.5)*1.2); float cov=smoothstep(1.0-uCloud,1.0-uCloud+0.35,c); vec3 cc=mix(uCloudDark,uCloudCol,sat(c*1.3-0.25+pow(sd,6.0)*0.6))+uSunCol*pow(sd,20.0)*0.5*(1.0-cov*0.5)+uFlash*vec3(0.75,0.85,1.0)*c; col=mix(col,cc,cov*smoothstep(-0.02,0.18,h)); }
          col+=uFlash*vec3(0.25,0.3,0.4);
          gl_FragColor=vec4(col,1.0);
        }`.replace(/sat\(/g, 'clamp01(').replace('void main(){', 'float clamp01(float x){ return clamp(x,0.0,1.0); }\nvoid main(){'),
    }));
    m.renderOrder = -100; m.frustumCulled = false; m.userData.isSky = true;
    m.onBeforeRender = () => { U.uTime.value = G.now; m.position.copy(camera.position); };
    return m;
  }
  // Bake the sky into scene.environment so PBR surfaces reflect it.
  let pmrem = null;
  function env(skyMesh, intensity = 1) {
    if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer);
    const s = new THREE.Scene(); const parent = skyMesh.parent; s.add(skyMesh);
    const hook = skyMesh.onBeforeRender; skyMesh.onBeforeRender = () => { }; skyMesh.position.set(0, 0, 0);
    const rt = pmrem.fromScene(s, 0, 1, 4000); skyMesh.onBeforeRender = hook; if (parent) parent.add(skyMesh);
    if (scene.environment && scene.environment.userData.owned) scene.environment.dispose();
    rt.texture.userData.owned = true; rt.texture.userData.shared = true; scene.environment = rt.texture; scene.environmentIntensity = intensity; return rt.texture;
  }

  // ---------- lights ----------
  function sun(parent, o = {}) {
    const L = new THREE.DirectionalLight(o.color || 0xffffff, o.intensity === undefined ? 2 : o.intensity);
    const d = new V3(...(o.dir || [0.4, 1, 0.3])).normalize(); L.position.copy(d).multiplyScalar(80); L.target.position.set(0, 0, 0);
    if (o.shadow !== false) {
      L.castShadow = true; const s = o.size || 34, c = L.shadow.camera; c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.near = 1; c.far = 220;
      L.shadow.mapSize.set(G.q.shadow, G.q.shadow); L.shadow.bias = -0.0004; L.shadow.normalBias = 0.05; L.shadow.radius = 3;
    }
    parent.add(L); parent.add(L.target); return L;
  }
  function hemi(parent, sky_, ground, intensity = 0.6) { const L = new THREE.HemisphereLight(sky_, ground, intensity); parent.add(L); return L; }

  // ---------- water ----------
  function water(o = {}) {
    const size = o.size || 800, seg = o.seg || 200;
    const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-PI / 2);
    const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uDeep: { value: new THREE.Color(o.deep || 0x04121c) }, uShallow: { value: new THREE.Color(o.shallow || 0x0c3a4a) }, uSky: { value: new THREE.Color(o.sky || 0x55667a) },
      uSunDir: { value: new V3(...(o.sunDir || [0.3, 0.5, -0.8])).normalize() }, uSunCol: { value: new THREE.Color(o.sunColor || 0xffffff) },
      uAmp: { value: o.amp === undefined ? 0.6 : o.amp }, uScale: { value: o.scale || 0.08 }, uSpeed: { value: o.speed || 1 }, uFoam: { value: o.foam === undefined ? 0.5 : o.foam }, uGlow: { value: new THREE.Color(o.glow || 0x000000) },
      uHole: { value: o.hole || 0 }, uOpacity: { value: o.opacity === undefined ? 1 : o.opacity }, uRipple: { value: o.ripple || 0 },
    }]);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: U, fog: true, transparent: (o.opacity !== undefined && o.opacity < 1),
      vertexShader: `
        uniform float uTime,uAmp,uScale,uSpeed; varying vec3 vW; varying vec3 vN; varying float vH;
        #include <fog_pars_vertex>
        vec3 wave(vec2 p, vec2 d, float k, float a, float sp, inout vec3 n){ float ph=dot(p,d)*k+uTime*sp*uSpeed; float s=sin(ph), c=cos(ph); n.x-=d.x*k*a*c; n.z-=d.y*k*a*c; return vec3(d.x*a*c*0.6, a*s, d.y*a*c*0.6); }
        void main(){
          vec4 wp=modelMatrix*vec4(position,1.0); vec2 p=wp.xz; vec3 n=vec3(0.0,1.0,0.0); vec3 o=vec3(0.0);
          float k=uScale*6.2831;
          o+=wave(p,normalize(vec2(1.0,0.35)),k,uAmp,1.1,n); o+=wave(p,normalize(vec2(-0.6,1.0)),k*1.7,uAmp*0.55,1.5,n);
          o+=wave(p,normalize(vec2(0.3,-1.0)),k*2.9,uAmp*0.3,2.1,n); o+=wave(p,normalize(vec2(-1.0,-0.2)),k*4.7,uAmp*0.16,2.9,n);
          wp.xyz+=o; vW=wp.xyz; vN=normalize(n); vH=o.y;
          vec4 mvPosition=viewMatrix*wp; gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uTime,uFoam,uAmp,uHole,uOpacity,uRipple; uniform vec3 uDeep,uShallow,uSky,uSunDir,uSunCol,uGlow; varying vec3 vW; varying vec3 vN; varying float vH;
        #include <fog_pars_fragment>
        float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
        float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
        void main(){
          if (uHole>0.0 && length(vW.xz)<uHole) discard;
          vec2 q=vW.xz; float t=uTime;
          float e=0.5; float a=n2(q*0.45+vec2(t*0.4,t*0.25))+0.5*n2(q*1.1-vec2(t*0.6,-t*0.35));
          float ax=n2((q+vec2(e,0.0))*0.45+vec2(t*0.4,t*0.25))+0.5*n2((q+vec2(e,0.0))*1.1-vec2(t*0.6,-t*0.35));
          float az=n2((q+vec2(0.0,e))*0.45+vec2(t*0.4,t*0.25))+0.5*n2((q+vec2(0.0,e))*1.1-vec2(t*0.6,-t*0.35));
          vec3 n=normalize(vN+vec3(a-ax,0.0,a-az)*(0.5+uRipple));
          vec3 v=normalize(cameraPosition-vW); float fr=pow(1.0-max(0.0,dot(n,v)),4.0);
          vec3 base=mix(uDeep,uShallow,clamp(vH/(uAmp*2.0+0.001)*0.5+0.5,0.0,1.0));
          vec3 col=mix(base,uSky,clamp(0.08+fr*0.9,0.0,1.0));
          vec3 hv=normalize(v+uSunDir); col+=uSunCol*pow(max(0.0,dot(n,hv)),120.0)*1.4+uSunCol*pow(max(0.0,dot(n,hv)),20.0)*0.1;
          float foam=smoothstep(0.55,1.0,vH/(uAmp*1.6+0.001))*uFoam; foam*=0.6+0.4*n2(q*1.5+t); col=mix(col,vec3(0.55,0.62,0.66),clamp(foam,0.0,1.0));
          col+=uGlow*(0.4+0.6*a)*smoothstep(-uAmp,uAmp*1.5,vH);
          gl_FragColor=vec4(col,uOpacity);
          #include <fog_fragment>
        }`,
    }));
    m.position.y = o.y || 0; m.onBeforeRender = () => { U.uTime.value = G.now; };
    return m;
  }

  // ---------- lava / energy plane ----------
  function lava(o = {}) {
    const geo = o.geo || (() => { const g = new THREE.PlaneGeometry(o.size || 200, o.size || 200, 1, 1); g.rotateX(-PI / 2); return g; })();
    const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uHot: { value: new THREE.Color(o.hot || 0xffc040) }, uMid: { value: new THREE.Color(o.mid || 0xff4a08) }, uCool: { value: new THREE.Color(o.cool || 0x1a0502) }, uScale: { value: o.scale || 0.12 }, uSpeed: { value: o.speed || 0.06 }, uHeat: { value: o.heat === undefined ? 1 : o.heat } }]);
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: U, fog: true,
      vertexShader: 'varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; vec4 mvPosition=viewMatrix*wp; gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: `
        uniform float uTime,uScale,uSpeed,uHeat; uniform vec3 uHot,uMid,uCool; varying vec3 vW;
        #include <fog_pars_fragment>
        float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
        float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*n2(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
        void main(){
          vec2 q=vW.xz*uScale; float t=uTime*uSpeed;
          vec2 w=vec2(fbm(q+t),fbm(q+vec2(5.2,1.3)-t));
          float n=fbm(q+w*1.6+vec2(t*0.6,-t*0.4));
          float crust=smoothstep(0.38,0.62,n); float veins=pow(1.0-abs(n-0.5)*2.0,6.0);
          vec3 col=mix(uMid*1.6,uCool,crust)+uHot*veins*2.4*uHeat+uMid*(1.0-crust)*uHeat*(0.8+0.4*sin(uTime*1.3+n*20.0));
          gl_FragColor=vec4(col,1.0);
          #include <fog_fragment>
        }`,
    }));
    m.position.y = o.y || 0; m.onBeforeRender = () => { U.uTime.value = G.now; };
    return m;
  }

  // ---------- ambient particle fields (snow, embers, petals, dust, rain) ----------
  // motes({n, box:[x,y,z], color, size, vel:[x,y,z], sway, additive, center:[x,y,z], streak})
  function motes(o = {}) {
    const n = Math.round((o.n || 600) * G.q.part), box = o.box || [60, 30, 60];
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = vrand() * box[0]; pos[i * 3 + 1] = vrand() * box[1]; pos[i * 3 + 2] = vrand() * box[2]; seed[i] = vrand(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); g.boundingSphere = new THREE.Sphere(new V3(), 1e6);
    const U = { uTime: { value: 0 }, uBox: { value: new V3(...box) }, uVel: { value: new V3(...(o.vel || [0, -1, 0])) }, uSway: { value: o.sway || 0 }, uSize: { value: o.size || 0.2 }, uCol: { value: new THREE.Color(o.color || 0xffffff).multiplyScalar(o.mult || 1) }, uCenter: { value: new V3(...(o.center || [0, box[1] / 2, 0])) }, uScale: { value: 500 }, uAlpha: { value: o.alpha === undefined ? 1 : o.alpha } };
    const m = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: `uniform float uTime,uSway,uSize,uScale; uniform vec3 uBox,uVel,uCenter; attribute float aSeed; varying float vS;
        void main(){ vec3 p=position+uVel*uTime*(0.6+aSeed*0.8); p.x+=sin(uTime*(0.5+aSeed)+aSeed*40.0)*uSway; p.z+=cos(uTime*(0.4+aSeed*0.7)+aSeed*70.0)*uSway;
          p=mod(p,uBox)-uBox*0.5+uCenter; vS=aSeed; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=uSize*(0.5+aSeed)*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uCol; uniform float uAlpha,uTime; varying float vS; void main(){ vec2 c=gl_PointCoord-0.5; ${o.streak ? 'float a=(1.0-smoothstep(0.0,0.08,abs(c.x)))*(1.0-abs(c.y)*2.0);' : 'float d=length(c)*2.0; if(d>1.0) discard; float a=pow(1.0-d,1.5);'} a*=uAlpha*(0.6+0.4*sin(uTime*(1.0+vS*3.0)+vS*50.0)); gl_FragColor=vec4(uCol*${o.additive === false ? '1.0' : 'a'},a); }`,
    }));
    m.frustumCulled = false; m.renderOrder = 15; m.onBeforeRender = () => { U.uTime.value = G.now; U.uScale.value = renderer.domElement.height * 0.5; };
    return m;
  }

  // helper: tween a set of uniform colors / numbers inside a script
  function* tween(dur, fn) { let t = 0; while (t < dur) { t += G.dt; fn(smooth(t / dur)); yield; } fn(1); }
  const colorLerp = (c, a, b, k) => c.setRGB(lerp(a.r, b.r, k), lerp(a.g, b.g, k), lerp(a.b, b.b, k));
  return { hash2, vnoise, fbm, cell, bake, surface, SURF, mat, glow, sky, env, sun, hemi, water, lava, motes, tween, colorLerp };
})();
