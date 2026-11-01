// ============================================================================
// 04_fx.js — particles, bolts/ribbons, lightning, shards, damage numbers,
// shock rings, speed lines, screen flash, sky shaders, shared materials.
// Owner: FX. Reads G only inside init()/methods. Registers G.fx and G.sky.
// Draw calls (all pools, always): sky 1 + ambient 1 + glow particles 1 +
// smoke 1 + bolt heads 1 + ribbons 1 + shards 1 + rings 1 + text 1 + speed 1.
// ============================================================================
{
  const { THREE } = G;
  const V3 = THREE.Vector3;
  const _v = new V3(), _v2 = new V3(), _v3 = new V3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const _s = new V3(), _up = new V3(0, 1, 0), _col = new THREE.Color(), _c2 = new THREE.Color();
  const rnd = Math.random; // cosmetic randomness only
  const rr = (a, b) => a + (b - a) * rnd();
  const TIER_COL = [0xffffff, 0x3fa9ff, 0xff8a1f, 0xc04bff];

  // ---------------------------------------------------------------------------
  // GLSL shared chunks
  // ---------------------------------------------------------------------------
  const GLSL_NOISE = /* glsl */`
    float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y), f.z); }
    float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<OCT;i++){ s += a*vnoise(p); p = p*2.03 + vec3(1.7,9.2,3.1); a*=0.5; } return s/(1.0-pow(0.5,float(OCT))); }
    float fbm3(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<3;i++){ s += a*vnoise(p); p = p*2.03 + vec3(1.7,9.2,3.1); a*=0.5; } return s/0.875; }
  `;

  // ---------------------------------------------------------------------------
  // Glow particle layer: instanced camera-facing quads, velocity-stretched.
  // Sim arrays double as GPU attribute arrays (packed; swap-remove on death).
  // ---------------------------------------------------------------------------
  const PART_VS = /* glsl */`
    attribute vec3 iPos; attribute vec3 iVel; attribute vec3 iColor; attribute vec2 iSA; // size, alpha
    attribute float iStretch;
    uniform vec2 uNear;   // fade particles within uNear.x..uNear.y metres of the camera (they sit between camera and kart)
    varying vec2 vUv; varying vec3 vCol; varying float vA;
    void main(){
      vUv = position.xy * 2.0;
      vec4 mv = viewMatrix * vec4(iPos, 1.0);
      vCol = iColor; vA = iSA.y * smoothstep(uNear.x, uNear.y, -mv.z);
      vec2 vv = (viewMatrix * vec4(iVel, 0.0)).xy;
      float sp = length(vv);
      vec2 ax = sp > 0.01 ? vv / sp : vec2(1.0, 0.0);
      float len = iSA.x + sp * iStretch;
      vec2 off = ax * position.x * len + vec2(-ax.y, ax.x) * position.y * iSA.x;
      mv.xy += off;
      gl_Position = projectionMatrix * mv;
    }`;
  const PART_FS_ADD = /* glsl */`
    varying vec2 vUv; varying vec3 vCol; varying float vA;
    void main(){
      float d = length(vUv);
      if (d > 1.0) discard;
      float a = 1.0 - d; a *= a;
      vec3 c = vCol * a + vec3(1.0) * pow(a, 6.0) * 0.8 * min(1.0, dot(vCol, vec3(0.33)));
      gl_FragColor = vec4(min(c * vA, vec3(2.2)), 1.0);
    }`;
  const PART_FS_SMOKE = /* glsl */`
    varying vec2 vUv; varying vec3 vCol; varying float vA;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      float d = length(vUv);
      if (d > 1.0) discard;
      float n = 0.75 + 0.25 * sin(atan(vUv.y, vUv.x) * 5.0 + vA * 9.0 + h(vCol.rg) * 6.0);
      float a = smoothstep(1.0, 0.2, d * n * 1.05);
      gl_FragColor = vec4(vCol, a * vA * 0.55);
    }`;

  class GlowLayer {
    constructor(max, smoke) {
      this.max = max; this.n = 0;
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,.5,0]), 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const mk = (name, sz) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * sz), sz); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
      this.aPos = mk('iPos', 3); this.aVel = mk('iVel', 3); this.aCol = mk('iColor', 3); this.aSA = mk('iSA', 2); this.aSt = mk('iStretch', 1);
      this.attrs = [this.aPos, this.aVel, this.aCol, this.aSA, this.aSt];
      this.pos = this.aPos.array; this.vel = this.aVel.array; this.col = this.aCol.array; this.sa = this.aSA.array; this.st = this.aSt.array;
      // sim-only
      this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
      this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
      this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3);
      this.drag = new Float32Array(max); this.grav = new Float32Array(max); this.a0 = new Float32Array(max);
      this.flick = new Float32Array(max);
      g.instanceCount = 0;
      this.geo = g;
      const m = new THREE.ShaderMaterial({
        uniforms: { uNear: { value: new THREE.Vector2(smoke ? 2.5 : 1.5, smoke ? 9 : 5) } },
        vertexShader: PART_VS, fragmentShader: smoke ? PART_FS_SMOKE : PART_FS_ADD,
        transparent: true, depthWrite: false,
        blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      this.mesh = new THREE.Mesh(g, m);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = smoke ? 5 : 6;
      this.cap = max;
    }
    // spawn one particle; returns index or -1
    spawn(px, py, pz, vx, vy, vz, life, s0, s1, r, g, b, r1, g1, b1, alpha, drag, grav, stretch, flick) {
      if (this.n >= this.cap) return -1;
      const i = this.n++, i3 = i * 3;
      this.pos[i3] = px; this.pos[i3 + 1] = py; this.pos[i3 + 2] = pz;
      this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
      this.c0[i3] = r; this.c0[i3 + 1] = g; this.c0[i3 + 2] = b;
      this.c1[i3] = r1; this.c1[i3 + 1] = g1; this.c1[i3 + 2] = b1;
      this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
      this.life[i] = 0; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
      this.sa[i * 2] = s0; this.sa[i * 2 + 1] = alpha; this.a0[i] = alpha;
      this.drag[i] = drag; this.grav[i] = grav; this.st[i] = stretch; this.flick[i] = flick || 0;
      return i;
    }
    kill(i) {
      const j = --this.n; if (i === j) return;
      const i3 = i * 3, j3 = j * 3;
      for (let k = 0; k < 3; k++) {
        this.pos[i3 + k] = this.pos[j3 + k]; this.vel[i3 + k] = this.vel[j3 + k];
        this.c0[i3 + k] = this.c0[j3 + k]; this.c1[i3 + k] = this.c1[j3 + k]; this.col[i3 + k] = this.col[j3 + k];
      }
      this.sa[i * 2] = this.sa[j * 2]; this.sa[i * 2 + 1] = this.sa[j * 2 + 1];
      this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j];
      this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j]; this.a0[i] = this.a0[j]; this.st[i] = this.st[j]; this.flick[i] = this.flick[j];
    }
    update(dt) {
      if (dt <= 0) return;
      const { pos, vel, col, sa, c0, c1 } = this;
      for (let i = this.n - 1; i >= 0; i--) {
        const L = (this.life[i] += dt), M = this.maxLife[i];
        if (L >= M) { this.kill(i); continue; }
        const t = L / M, i3 = i * 3, dr = Math.max(0, 1 - this.drag[i] * dt);
        vel[i3] *= dr; vel[i3 + 1] = vel[i3 + 1] * dr - this.grav[i] * dt; vel[i3 + 2] *= dr;
        pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
        col[i3] = c0[i3] + (c1[i3] - c0[i3]) * t; col[i3 + 1] = c0[i3 + 1] + (c1[i3 + 1] - c0[i3 + 1]) * t; col[i3 + 2] = c0[i3 + 2] + (c1[i3 + 2] - c0[i3 + 2]) * t;
        sa[i * 2] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
        // alpha: quick fade-in, ease-out; optional flicker
        let a = this.a0[i] * Math.min(1, t * 12) * (1 - t * t);
        if (this.flick[i] > 0) a *= 1 - this.flick[i] * rnd();
        sa[i * 2 + 1] = a;
      }
    }
    upload() {
      const n = this.n; this.geo.instanceCount = n;
      if (!n) return;
      for (let i = 0; i < this.attrs.length; i++) { const a = this.attrs[i]; a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); a.needsUpdate = true; }
    }
    clear() { this.n = 0; this.geo.instanceCount = 0; }
  }

  // ---------------------------------------------------------------------------
  // Emitter presets. Colors are linear multipliers (>1 blooms).
  // count: burst count; spd [min,max]; spread: 0 = along dir, 1 = sphere;
  // life [min,max]; size [s0,s1]; col / col1 (end color); glow (color mult)
  // ---------------------------------------------------------------------------
  const P = {
    driftSpark: { kartFx: true, emitMul: 2, count: 3, spd: [6, 14], spread: 0.55, up: 3, life: [0.18, 0.42], size: [0.16, 0.04], col: 0x3fa9ff, col1: 0xffffff, glow: 1.5, drag: 2, grav: 14, stretch: 0.045, rnd: 0.3 },
    tireSmoke: { pool: 'smoke', count: 1, spd: [0.5, 2], spread: 1, up: 1.2, life: [0.6, 1.1], size: [0.6, 2.6], col: 0x8a8f9c, col1: 0x3a3d48, alpha: 0.5, drag: 1.5, grav: -1.5 },
    boostFlame: { kartFx: true, count: 2, spd: [8, 16], spread: 0.18, up: 0, life: [0.08, 0.2], size: [0.4, 0.1], col: 0xbff8ff, col1: 0xff3df2, glow: 0.95, drag: 4, grav: 0, stretch: 0.03 },
    wallSpark: { count: 10, spd: [6, 18], spread: 0.7, up: 5, life: [0.2, 0.5], size: [0.13, 0.03], col: 0xffd38a, col1: 0xff5a00, glow: 3, drag: 1.2, grav: 22, stretch: 0.05 },
    hit: { count: 40, spd: [5, 20], spread: 1, up: 2, life: [0.2, 0.55], size: [0.3, 0.05], col: 0xffffff, col1: 0xff2a3a, glow: 3, drag: 3, grav: 6, stretch: 0.04 },
    boltImpact: { count: 26, spd: [6, 22], spread: 1, up: 2, life: [0.15, 0.45], size: [0.35, 0.05], col: 0xffffff, col1: 0x3fa9ff, glow: 3.5, drag: 3.5, grav: 4, stretch: 0.05, flash: 3.5 },
    ember: { count: 1, spd: [0.3, 1.5], spread: 1, up: 2.5, life: [1.5, 3.5], size: [0.18, 0.05], col: 0xffb347, col1: 0xff3a00, glow: 3, drag: 0.3, grav: -0.6, flick: 0.5 },
    lavaSplash: { count: 30, spd: [4, 11], spread: 0.6, up: 9, life: [0.5, 1.1], size: [0.45, 0.12], col: 0xffd060, col1: 0xff3000, glow: 3, drag: 0.6, grav: 22, stretch: 0.02 },
    steam: { pool: 'smoke', count: 6, spd: [3, 7], spread: 0.25, up: 10, life: [0.8, 1.6], size: [1.2, 4.5], col: 0xb8b2ac, col1: 0x6a6262, alpha: 0.4, drag: 1.2, grav: -1 },
    chrome: { count: 24, spd: [6, 18], spread: 1, up: 4, life: [0.4, 0.9], size: [0.3, 0.1], col: 0xe8f4ff, col1: 0x3fa9ff, glow: 2.4, drag: 1.5, grav: 14, stretch: 0.03, flick: 0.6 },
    lightning: { count: 18, spd: [10, 30], spread: 1, up: 0, life: [0.08, 0.25], size: [0.18, 0.04], col: 0xffffff, col1: 0x7fd0ff, glow: 4, drag: 5, grav: 0, stretch: 0.06 },
    starDust: { count: 20, spd: [0.5, 3], spread: 1, up: 0.5, life: [0.8, 1.8], size: [0.22, 0.02], col: 0xbfe3ff, col1: 0x8fd7ff, glow: 2.6, drag: 0.8, grav: 0, flick: 0.7 },
    ghostShatter: { count: 50, spd: [6, 18], spread: 1, up: 3, life: [0.4, 1.0], size: [0.4, 0.05], col: 0xffb0b8, col1: 0xff2a3a, glow: 3, drag: 2, grav: 6, stretch: 0.04 },
    gold: { count: 90, spd: [8, 30], spread: 1, up: 4, life: [0.5, 1.3], size: [0.55, 0.08], col: 0xfff2c0, col1: 0xffc93a, glow: 3.2, drag: 2.2, grav: 5, stretch: 0.04, flash: 6 },
    comet: { count: 220, spd: [12, 48], spread: 1, up: 6, life: [0.6, 1.6], size: [0.7, 0.1], col: 0xfff4d0, col1: 0xffb020, glow: 1.8, drag: 2.0, grav: 8, stretch: 0.05, flash: 5 },
    firework: { count: 120, spd: [10, 22], spread: 1, up: 0, life: [1.0, 2.0], size: [0.45, 0.06], col: 0xffffff, col1: 0xff3df2, glow: 3.4, drag: 1.4, grav: 6, stretch: 0.03, flick: 0.35, flash: 5 },
    explosion: { count: 120, spd: [6, 28], spread: 1, up: 5, life: [0.35, 1.0], size: [1.2, 0.15], col: 0xfff0c0, col1: 0xff3a00, glow: 2, drag: 2.6, grav: 6, stretch: 0.025, flash: 5, smoke: 10 },
    mote: { count: 12, spd: [0.5, 2.5], spread: 1, up: 1, life: [0.8, 1.6], size: [0.25, 0.03], col: 0x9ff8ff, col1: 0x33f6ff, glow: 2.8, drag: 0.6, grav: -0.8, flick: 0.4 },
    dust: { pool: 'smoke', count: 12, spd: [2, 6], spread: 1, up: 0.6, life: [0.5, 1.0], size: [0.8, 2.6], col: 0x9a8e86, col1: 0x4a4440, alpha: 0.4, drag: 2.5, grav: 0.5, flat: true },
    graze: { count: 26, spd: [8, 16], spread: 1, up: 0, life: [0.15, 0.35], size: [0.22, 0.03], col: 0xffffff, col1: 0xaef6ff, glow: 1.8, drag: 4, grav: 0, stretch: 0.05, flat: true },
    dashTrail: { count: 10, spd: [0.5, 3], spread: 1, up: 0, life: [0.25, 0.5], size: [0.5, 0.05], col: 0xaef6ff, col1: 0x33f6ff, glow: 2.6, drag: 2, grav: 0 },
    fizz: { count: 8, spd: [1, 4], spread: 1, up: 1, life: [0.15, 0.3], size: [0.12, 0.02], col: 0x8a96a8, col1: 0x404858, glow: 1.2, drag: 3, grav: 4 },
    tierUp: { count: 36, spd: [6, 12], spread: 1, up: 0, life: [0.18, 0.4], size: [0.26, 0.04], col: 0xffffff, col1: 0x3fa9ff, glow: 1.7, drag: 4, grav: 0, stretch: 0.05, flat: true },
    heal: { count: 20, spd: [1, 3], spread: 1, up: 3, life: [0.6, 1.0], size: [0.3, 0.05], col: 0xc8ffd8, col1: 0x30ff90, glow: 2.6, drag: 1, grav: -2 },
    geyser: { count: 4, spd: [9, 15], spread: 0.12, up: 0, life: [0.5, 0.9], size: [0.5, 0.2], col: 0xffe0b0, col1: 0xff7a20, glow: 1.5, drag: 0.6, grav: 9, stretch: 0.03 },
  };
  // resolve colors once
  for (const k in P) { const p = P[k]; const g = p.glow || 1; _col.set(p.col); p._c = [_col.r * g, _col.g * g, _col.b * g]; _col.set(p.col1 ?? p.col); p._c1 = [_col.r * g, _col.g * g, _col.b * g]; }

  // ---------------------------------------------------------------------------
  // Ribbons: one geometry holding RIB_N camera-facing strips of RIB_P points.
  // Used by bolts (trails), lightning, and user ribbons (G.fx.ribbon()).
  // ---------------------------------------------------------------------------
  const RIB_N = 112, RIB_P = 24;
  const RIB_VS = /* glsl */`
    attribute vec4 aCol; attribute float aSide;
    varying vec4 vCol; varying float vSide;
    void main(){ vCol = aCol; vSide = aSide; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
  const RIB_FS = /* glsl */`
    varying vec4 vCol; varying float vSide;
    void main(){ float e = 1.0 - abs(vSide); float core = pow(e, 5.0);
      gl_FragColor = vec4((vCol.rgb * e * e + vec3(core) * 0.9 * min(1.0, vCol.a)) * vCol.a, 1.0); }`;

  class Ribbon { // pooled; never constructed per frame
    constructor(idx) { this.idx = idx; this.pts = new Float32Array(RIB_P * 3); this.n = 0; this.active = false;
      this.width = 0.3; this.r = 1; this.g = 1; this.b = 1; this.alpha = 1; this.taper = 1; this.headW = 1; this.handle = null; }
    reset(width, color, glow, alpha) { this.n = 0; this.active = true; this.width = width; _col.set(color); this.r = _col.r * glow; this.g = _col.g * glow; this.b = _col.b * glow; this.alpha = alpha; this.taper = 1; }
    // push a new head point (shifts tail)
    push(x, y, z) {
      const p = this.pts;
      if (this.n < RIB_P) this.n++;
      p.copyWithin(3, 0, (RIB_P - 1) * 3);
      p[0] = x; p[1] = y; p[2] = z;
      if (this.n === 1) for (let i = 1; i < RIB_P; i++) { p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; }
    }
  }

  // ---------------------------------------------------------------------------
  // Damage number / 3D text atlas: A-Z 0-9 + - ! . %  drawn once to a canvas.
  // R channel = fill, G channel = outline. One instanced glyph mesh.
  // ---------------------------------------------------------------------------
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-!.%x ';
  const ATL_C = 8, ATL_R = 6, CW = 64, CH = 80;
  const TXT_MAX = 40, TXT_GL = 12, TXT_I = TXT_MAX * TXT_GL;
  const TXT_VS = /* glsl */`
    attribute vec3 iPos; attribute vec4 iUv; attribute vec4 iCA; attribute vec2 iOff; // offset x (glyph units), scale
    uniform float uScrH;
    varying vec2 vUv; varying vec4 vCA;
    void main(){
      vUv = mix(iUv.xy, iUv.zw, position.xy + 0.5);
      vCA = iCA;
      vec4 mv = viewMatrix * vec4(iPos, 1.0);
      float h = iOff.y * clamp(-mv.z, 4.0, 160.0) * uScrH; // ~constant screen height
      mv.xy += vec2((position.x * 0.8 + iOff.x * 0.52), position.y) * h;
      gl_Position = projectionMatrix * mv;
    }`;
  const TXT_FS = /* glsl */`
    uniform sampler2D uAtlas; varying vec2 vUv; varying vec4 vCA;
    void main(){ vec4 t = texture2D(uAtlas, vUv); float a = max(t.r, t.g) * vCA.a; if (a < 0.01) discard;
      vec3 c = mix(vec3(0.02, 0.02, 0.05), vCA.rgb, t.r);
      gl_FragColor = vec4(c, a); }`;
  const TXT_STYLE = {
    normal: { col: 0xffffff, mult: 1.1, size: 0.055 },
    weak: { col: 0xffc93a, mult: 1.25, size: 0.065 },
    crit: { col: 0xd27bff, mult: 1.4, size: 0.085 },
    player: { col: 0xff2a3a, mult: 1.25, size: 0.06 },
    heal: { col: 0x40ff9a, mult: 1.15, size: 0.05 },
    flux: { col: 0x33f6ff, mult: 1.25, size: 0.05 },
    graze: { col: 0xffffff, mult: 1.1, size: 0.042 },
    gold: { col: 0xffc93a, mult: 1.4, size: 0.07 },
  };
  for (const k in TXT_STYLE) { const s = TXT_STYLE[k]; _col.set(s.col); s._c = [_col.r * s.mult, _col.g * s.mult, _col.b * s.mult]; }

  // ---------------------------------------------------------------------------
  // Sky shaders
  // ---------------------------------------------------------------------------
  const SKY_VS = /* glsl */`
    varying vec3 vDir;
    void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; gl_Position.z = p.w * 0.99999; }`;
  const SKY_HEAD = /* glsl */`
    uniform float uTime, uBeat, uEnrage, uFlash, uDawn, uSpeed; uniform vec3 uFlashDir, uAxis;
    varying vec3 vDir;
    ${GLSL_NOISE}
    vec3 aces(vec3 x){ return x; }
  `;
  const SKY_FS = {
    // Molten dusk: smoke bands lit from below, heat haze, blood eclipse, eruption plumes, sky sparks.
    ember: /* glsl */`
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        float az = atan(d.z, d.x);
        // heat haze: wobble the lookup near the horizon
        vec2 hz = vec2(vnoise(vec3(az*14.0, h*40.0 - uTime*2.6, uTime*0.7)), vnoise(vec3(az*14.0+7.0, h*40.0 - uTime*2.2, 3.0))) - 0.5;
        vec3 dd = normalize(d + vec3(hz.x, hz.y, hz.x) * 0.02 * exp(-abs(h) * 7.0));
        h = dd.y; float hp = max(h, 0.0);
        // base gradient: near-black smoke ceiling -> blood red -> molten horizon band
        vec3 top = vec3(0.012, 0.004, 0.003), mid = vec3(0.10, 0.022, 0.008), hor = vec3(1.0, 0.30, 0.05);
        vec3 c = mix(mid, top, smoothstep(0.02, 0.55, hp));
        c += hor * (exp(-hp * 16.0) * 0.9 + exp(-hp * 60.0) * 0.6);
        if (h < 0.0) c = mix(hor * 1.2, vec3(0.16, 0.03, 0.005), smoothstep(0.0, -0.25, h));
        // smoke: fbm density, lit from below by sampling slightly lower (fake volumetric light)
        vec3 sp = vec3(dd.x * 1.7, h * 4.5, dd.z * 1.7) + vec3(uTime * 0.02, 0.0, uTime * 0.014);
        float wv = fbm(sp * 0.8);
        float sA = fbm(sp * 2.2 + wv * 1.3);
        float sB = fbm((sp + vec3(0.0, -0.09, 0.0)) * 2.2 + wv * 1.3);
        float dens = smoothstep(0.38, 0.78, sA) * smoothstep(-0.03, 0.1, h);
        float lit = clamp((sB - sA) * 7.0 + 0.25, 0.0, 1.0) * exp(-hp * 3.0);
        vec3 smokeC = mix(vec3(0.03, 0.008, 0.005), vec3(1.25, 0.36, 0.06), lit);
        c = mix(c, smokeC, dens * 0.9);
        // blood eclipse low over the bowl
        vec3 sd = normalize(vec3(-0.55, 0.13, -0.82));
        float sdot = dot(dd, sd);
        float disc = smoothstep(0.9982, 0.9986, sdot);
        float corona = pow(max(sdot, 0.0), 400.0) * 1.2 + pow(max(sdot, 0.0), 40.0) * 0.25;
        c += vec3(1.5, 0.3, 0.05) * corona * (1.0 - dens * 0.7);
        c = mix(c, vec3(0.01, 0.0, 0.0), disc);
        c += vec3(2.4, 0.8, 0.25) * smoothstep(0.9977, 0.9982, sdot) * (1.0 - disc) * (0.8 + 0.2 * sin(uTime * 3.0 + az * 40.0));
        // eruption plumes: 3 volcano columns on the horizon
        for (int i = 0; i < 3; i++) {
          float pa = float(i) * 2.15 + 0.6;
          float da = abs(mod(az - pa + 3.14159, 6.28318) - 3.14159);
          float w = 0.02 + hp * 0.3;
          float col = smoothstep(w, 0.0, da + (vnoise(vec3(hp * 18.0 - uTime * 1.8, float(i), az * 30.0)) - 0.5) * 0.05);
          c += vec3(1.8, 0.4, 0.06) * col * smoothstep(0.22, 0.0, hp) * step(-0.02, h) * (0.6 + 0.4 * vnoise(vec3(uTime * 3.0, float(i), 0.0)));
        }
        // drifting sky sparks
        vec3 g = dd * 70.0 + vec3(0.0, -uTime * 2.6, 0.0);
        vec3 gi = floor(g); float hs = hash13(gi);
        c += vec3(2.4, 0.8, 0.2) * step(0.988, hs) * smoothstep(0.3, 0.0, length(fract(g) - 0.5)) * (0.5 + 0.5 * sin(uTime * 6.0 + hs * 40.0)) * smoothstep(-0.1, 0.2, h);
        // enrage: red beat pulse
        c += vec3(0.5, 0.02, 0.0) * uEnrage * (0.3 + 0.7 * pow(1.0 - uBeat, 3.0)) * exp(-hp * 3.0);
        c *= 1.0 + uFlash * 1.5;
        gl_FragColor = vec4(c, 1.0);
      }`,
    // Storm: violet/teal towering clouds, cloud sea far below, lightning-lit pockets, dawn mode.
    storm: /* glsl */`
      void main(){
        vec3 d = normalize(vDir); float h = d.y; float hp = max(h, 0.0);
        vec3 zen = vec3(0.012, 0.01, 0.04), mid = vec3(0.06, 0.025, 0.11), hor = vec3(0.04, 0.26, 0.33);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, hp));
        c = mix(c, zen, smoothstep(0.2, 0.85, hp));
        // layered cloud deck (upper layer scrolls), lit from the horizon side
        vec3 cp = d / max(h + 0.1, 0.07);
        vec3 q = vec3(cp.xz * 0.8 + vec2(uTime * 0.012, 0.0), uTime * 0.015);
        float w = fbm(q * 0.7);
        float cA = fbm(q * 1.8 + w);
        float cB = fbm((q + vec3(0.06, 0.0, 0.0)) * 1.8 + w);
        float cU = fbm(vec3(cp.xz * 2.4 + vec2(uTime * 0.05, uTime * 0.02), 4.0));
        float dens = smoothstep(0.42, 0.75, cA * 0.8 + cU * 0.3) * smoothstep(-0.02, 0.12, h);
        float lit = clamp((cA - cB) * 6.0 + 0.3, 0.0, 1.0);
        vec3 cloudC = mix(vec3(0.03, 0.015, 0.06), vec3(0.42, 0.22, 0.62), lit) + vec3(0.02, 0.18, 0.2) * exp(-hp * 6.0);
        // towering cumulonimbus walls near the horizon: billowy silhouette, lit crowns
        float az = atan(d.z, d.x);
        float tb = fbm(vec3(az * 2.2, 0.5, 1.3 + uTime * 0.004));
        float tower = 0.04 + pow(tb, 2.2) * 0.75;
        float bil = fbm(vec3(az * 9.0, hp * 9.0 - uTime * 0.02, 5.0));
        float edge = tower + (bil - 0.5) * 0.12;
        float tw = smoothstep(-0.01, 0.02, h) * smoothstep(edge, edge - 0.025, hp);
        float inner = fbm(vec3(az * 6.0, hp * 7.0, 9.0 + uTime * 0.01));
        float crown = smoothstep(edge - 0.16, edge, hp) * (0.5 + inner);
        float hr = clamp(hp / max(edge, 0.05), 0.0, 1.0);
        vec3 towerC = mix(vec3(0.01, 0.012, 0.03), vec3(0.07, 0.04, 0.13), inner * hr)
                    + mix(vec3(0.25, 0.14, 0.42), vec3(0.6, 0.5, 0.85), inner) * pow(crown, 3.0) * 0.4
                    + vec3(0.02, 0.16, 0.18) * (1.0 - smoothstep(0.0, 0.06, hp));
        c = mix(c, cloudC, dens * 0.85);
        c = mix(c, towerC, tw);
        // cloud sea 400 m below: billows with deep shadow, teal haze at the horizon
        if (h < 0.0) {
          float t = 400.0 / max(-h, 0.004);
          vec2 p = d.xz * t * 0.0018 + vec2(uTime * 0.02, uTime * 0.01);
          float sea = fbm(vec3(p, uTime * 0.02));
          float seaS = fbm(vec3(p * 2.6 + sea * 1.5, 7.0));
          float seaL = fbm(vec3((p + vec2(0.04, 0.04)) * 2.6 + sea * 1.5, 7.0));
          float lt = clamp((seaS - seaL) * 3.0 + 0.45, 0.0, 1.0);
          float b = smoothstep(0.35, 0.85, sea * 0.6 + seaS * 0.5);
          vec3 seaC = mix(vec3(0.015, 0.015, 0.045), mix(vec3(0.06, 0.04, 0.12), vec3(0.3, 0.22, 0.5), lt), b);
          c = mix(hor * 0.7, seaC, smoothstep(-0.003, -0.2, h));
          dens = b * lt;
        }
        // lightning flash: lights clouds around the strike direction
        float fl = pow(max(dot(d, uFlashDir), 0.0), 5.0);
        c += vec3(0.7, 0.75, 1.4) * uFlash * (fl * 1.1 * (dens + tw * 0.8 + 0.15) + 0.06);
        c += vec3(0.2, 0.02, 0.12) * uEnrage * (0.4 + 0.6 * pow(1.0 - uBeat, 3.0)) * (1.0 - hp);
        // dawn: storm clears to gold/pink
        vec3 dawn = mix(vec3(1.2, 0.55, 0.3), vec3(0.25, 0.35, 0.75), smoothstep(0.0, 0.6, hp));
        dawn += vec3(2.0, 1.2, 0.6) * pow(max(dot(d, normalize(vec3(0.3, 0.08, -1.0))), 0.0), 40.0);
        c = mix(c, mix(dawn, vec3(1.0, 0.7, 0.8) * (0.4 + lit), dens * 0.5), uDawn);
        gl_FragColor = vec4(c, 1.0);
      }`,
    // Void: deep-space nebula, a distant vortex with an Einstein ring, two spiral galaxies, star dust.
    void: /* glsl */`
      vec3 galaxy(vec3 d, vec3 gd, vec3 gu, float sz, float rot, vec3 col){
        vec3 gr = normalize(cross(gd, gu)); vec3 gv = cross(gr, gd);
        float fd = dot(d, gd); if (fd < 0.9) return vec3(0.0);
        vec2 p = vec2(dot(d, gr), dot(d, gv) * 1.8) / sz; // tilted disk
        float r = length(p); float a = atan(p.y, p.x) + rot;
        float arms = pow(0.5 + 0.5 * cos(2.0 * (a - log(r + 0.001) * 3.2)), 3.0);
        float disk = exp(-r * 3.2);
        float n = vnoise(vec3(p * 9.0, rot));
        return col * (arms * disk * (0.6 + 0.6 * n) * 1.3 + exp(-r * r * 60.0) * 3.0);
      }
      void main(){
        vec3 d = normalize(vDir);
        // nebula: domain-warped fbm in purple/teal
        vec3 p = d * 2.2;
        float w = fbm(p + vec3(0.0, uTime * 0.01, 0.0));
        float n1 = fbm(p * 1.6 + w * 1.8 + vec3(uTime * 0.006));
        float n2 = fbm(p * 3.4 - w + vec3(5.2));
        vec3 purple = vec3(0.16, 0.04, 0.29), teal = vec3(0.04, 0.23, 0.29);
        vec3 c = vec3(0.004, 0.003, 0.012);
        c += purple * smoothstep(0.35, 0.9, n1) * 1.6;
        c += teal * smoothstep(0.45, 0.95, n2) * 1.5;
        c += vec3(0.9, 0.35, 0.9) * pow(smoothstep(0.62, 0.95, n1 * n2 * 1.6), 2.0) * 0.8;
        // dark dust lanes
        c *= 0.35 + 0.65 * smoothstep(0.3, 0.6, fbm(p * 5.0 + n1));
        // distant vortex: swirl, dark core, Einstein ring
        vec3 vd = normalize(vec3(0.6, 0.35, 0.72));
        float vdot = dot(d, vd);
        if (vdot > 0.0) {
          vec3 vr = normalize(cross(vd, vec3(0.0, 1.0, 0.0))); vec3 vu = cross(vr, vd);
          vec2 q = vec2(dot(d, vr), dot(d, vu)) / 0.22; float r = length(q); float a = atan(q.y, q.x);
          float sw = fbm(vec3(cos(a - 2.5 / (r + 0.15) + uTime * 0.25) * 2.0, sin(a - 2.5 / (r + 0.15) + uTime * 0.25) * 2.0, r * 3.0));
          float disc = smoothstep(1.5, 0.3, r) * smoothstep(0.18, 0.32, r);
          c += mix(vec3(1.4, 0.55, 0.25), vec3(0.6, 0.8, 1.6), smoothstep(-1.0, 1.0, q.x)) * pow(sw, 2.5) * disc * 1.8;
          c += vec3(1.6, 1.3, 2.2) * exp(-pow((r - 0.3) * 30.0, 2.0)) * 1.4; // photon ring
          c *= smoothstep(0.26, 0.31, r); // event horizon
        }
        c += galaxy(d, normalize(vec3(-0.7, 0.45, -0.55)), vec3(0.2, 1.0, 0.1), 0.09, uTime * 0.02, vec3(0.75, 0.7, 1.2));
        c += galaxy(d, normalize(vec3(0.15, 0.25, -0.96)), vec3(1.0, 0.3, 0.0), 0.06, -uTime * 0.03, vec3(1.2, 0.8, 0.6));
        // fine star dust
        vec3 g = d * 260.0; vec3 gi = floor(g); float hs = hash13(gi);
        c += vec3(0.8, 0.9, 1.0) * step(0.992, hs) * smoothstep(0.45, 0.0, length(fract(g) - 0.5)) * (0.6 + 0.4 * sin(uTime * 3.0 + hs * 90.0));
        // enrage / beat: subtle violet pulse
        c += vec3(0.25, 0.02, 0.12) * uEnrage * pow(1.0 - uBeat, 3.0);
        // dawn = newborn star: the nebula gains color
        c = mix(c, c * vec3(1.6, 1.3, 1.1) + vec3(0.05, 0.03, 0.06), uDawn);
        gl_FragColor = vec4(c, 1.0);
      }`,
    // Warp tunnel along uAxis: hex-lattice walls streaming past, light at the end.
    warp: /* glsl */`
      void main(){
        vec3 d = normalize(vDir); vec3 A = normalize(uAxis);
        vec3 U = normalize(cross(A, abs(A.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0))); vec3 V = cross(A, U);
        float z = dot(d, A); vec2 xy = vec2(dot(d, U), dot(d, V)); float r = length(xy);
        float ang = atan(xy.y, xy.x);
        float depth = z / max(r, 0.02);           // tunnel radius 1 => depth along axis
        float spd = 4.0 + uSpeed * 14.0;
        vec2 uv = vec2(ang / 6.28318 * 20.0, depth * 2.2 - uTime * spd * 0.8);
        // hex lattice
        vec2 hs = vec2(1.0, 1.732);
        vec2 a = mod(uv, hs) - hs * 0.5, b = mod(uv - hs * 0.5, hs) - hs * 0.5;
        vec2 hv = dot(a, a) < dot(b, b) ? a : b;
        vec2 ab = abs(hv); float hexd = 0.5 - max(dot(ab, normalize(vec2(1.0, 1.732))), ab.x);
        float lines = smoothstep(0.035, 0.0, hexd);
        float fogD = exp(-abs(depth) * 0.22);
        vec3 c1 = vec3(0.15, 1.1, 1.4), c2 = vec3(1.2, 0.18, 1.1);
        vec3 col = mix(c1, c2, 0.5 + 0.5 * sin(depth * 0.2 + uTime * 0.7 + ang));
        vec3 c = col * lines * fogD * 0.9 + col * 0.025 * fogD;
        // streaks along the walls
        float sk = hash12(vec2(floor(ang * 40.0), 0.0));
        float streak = step(0.75, sk) * smoothstep(0.7, 1.0, fract(depth * 0.08 * (0.5 + sk) - uTime * (0.6 + sk) * (1.0 + uSpeed)));
        c += vec3(0.62, 0.8, 1.0) * streak * fogD;   // <= 1.0: streaks read as lines, not bloom sheets
        // light at the end of the tunnel / dark behind
        c += vec3(0.75, 0.68, 0.95) * pow(max(z, 0.0), 400.0) + vec3(0.35, 0.2, 0.7) * pow(max(z, 0.0), 30.0) * 0.4;   // vanishing point < 1.0
        c += vec3(0.02, 0.024, 0.1) * 0.5 * (1.0 - fogD);   // dark navy tunnel body (#05061a-ish)
        c *= 0.85 + 0.3 * pow(1.0 - uBeat, 4.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
    // Title: synthwave sunset, striped sun, neon grid floor, mountain silhouettes, stars.
    title: /* glsl */`
      void main(){
        vec3 d = normalize(vDir); float h = d.y; float hp = max(h, 0.0);
        float az = atan(d.x, -d.z);
        vec3 c = mix(vec3(0.9, 0.12, 0.38), vec3(0.14, 0.02, 0.2), smoothstep(0.0, 0.2, hp));
        c = mix(c, vec3(0.008, 0.004, 0.03), smoothstep(0.15, 0.7, hp));
        // sun
        vec3 sd = normalize(vec3(0.0, 0.12, -1.0));
        vec3 sr = normalize(cross(sd, vec3(0.0, 1.0, 0.0))); vec3 su = cross(sr, sd);
        vec2 sq = vec2(dot(d, sr), dot(d, su)) / 0.2;
        float sdist = length(sq);
        float stripes = step(0.0, sin((sq.y * 9.0 + uTime * 0.6) * 3.14159)) + step(0.3, sq.y);
        float sun = smoothstep(1.0, 0.985, sdist) * clamp(stripes, 0.0, 1.0) * step(0.0, dot(d, sd));
        vec3 sunC = mix(vec3(1.6, 0.12, 0.7), vec3(1.7, 1.2, 0.2), smoothstep(-0.8, 0.9, sq.y));
        c = mix(c, sunC, sun);
        c += vec3(1.2, 0.15, 0.6) * exp(-sdist * 2.2) * 0.3 * step(0.0, dot(d, sd));
        // mountains silhouette with neon rim
        float mh = 0.035 + 0.06 * fbm3(vec3(az * 3.0, 0.0, 0.0)) + 0.03 * vnoise(vec3(az * 14.0, 1.0, 0.0));
        mh *= smoothstep(0.05, 0.45, abs(az)) * 1.2 + 0.2;
        float mtn = step(h, mh) * step(-0.001, h);
        c = mix(c, vec3(0.03, 0.0, 0.07), mtn);
        c += vec3(0.15, 1.3, 1.7) * exp(-abs(h - mh) * 900.0) * step(0.0, h) * 0.6;
        // grid floor
        if (h < 0.0) {
          float t = 6.0 / max(-h, 0.002);
          vec2 p = d.xz * t; p.y += uTime * 10.0;
          vec2 gw = abs(fract(p / 4.0) - 0.5) * 4.0; float fw = t * 0.004 + 0.02;
          float grid = max(smoothstep(fw, 0.0, gw.x - 0.0), smoothstep(fw, 0.0, gw.y));
          float fade = exp(-t * 0.006);
          vec3 gc = mix(vec3(2.0, 0.3, 1.6), vec3(0.3, 1.8, 2.2), smoothstep(30.0, 300.0, t));
          c = vec3(0.03, 0.0, 0.06) + gc * grid * fade * (0.7 + 0.5 * pow(1.0 - uBeat, 4.0));
          c += vec3(1.2, 0.2, 0.8) * exp(h * 60.0) * 0.8;
        }
        c += vec3(2.4, 0.4, 1.5) * exp(-abs(h) * 220.0) * 0.75; // horizon line (magenta rim)
        // stars
        vec3 g = d * 180.0; vec3 gi = floor(g); float hs = hash13(gi);
        c += vec3(1.0) * step(0.993, hs) * smoothstep(0.4, 0.0, length(fract(g) - 0.5)) * smoothstep(0.15, 0.5, h) * (0.5 + 0.5 * sin(uTime * 2.0 + hs * 60.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  };

  // Ambient sky points (GPU-animated, wrap around the camera). One Points object.
  const AMB_VS = /* glsl */`
    attribute vec4 aSeed; uniform float uTime, uMode, uPx, uSpeed; uniform vec3 uCam, uAxis; uniform float uBox, uR;
    varying float vA; varying vec3 vC;
    void main(){
      vec3 p; float sz; vA = 1.0;
      if (uMode < 0.5) { // ember: rise, sway, wrap in a box around the camera
        vec3 b = vec3(uBox, uBox * 0.5, uBox);
        p = aSeed.xyz * b + vec3(sin(uTime * 0.7 + aSeed.w * 30.0) * 2.0, uTime * (1.5 + aSeed.w * 3.0), cos(uTime * 0.5 + aSeed.w * 20.0) * 2.0);
        p = mod(p - uCam + b * 0.5, b) - b * 0.5 + uCam;
        sz = 0.25 + aSeed.w * 0.35; vA = 0.6 + 0.4 * sin(uTime * 8.0 + aSeed.w * 50.0);
        vC = mix(vec3(3.0, 1.1, 0.25), vec3(3.0, 0.4, 0.05), aSeed.w);
      } else if (uMode < 1.5) { // storm: wind motes streaming sideways
        vec3 b = vec3(uBox);
        p = aSeed.xyz * b + vec3(uTime * (14.0 + aSeed.w * 10.0), sin(uTime + aSeed.w * 9.0) * 1.5, uTime * 4.0);
        p = mod(p - uCam + b * 0.5, b) - b * 0.5 + uCam;
        sz = 0.12 + aSeed.w * 0.15; vC = vec3(0.6, 0.9, 1.6) * 1.2; vA = 0.5;
      } else if (uMode < 2.5) { // void / title: stars on a shell with twinkle
        p = uCam + normalize(aSeed.xyz - 0.5) * uR;
        sz = 1.0 + pow(aSeed.w, 6.0) * 4.0;
        vA = 0.55 + 0.45 * sin(uTime * (1.0 + aSeed.w * 3.0) + aSeed.w * 80.0);
        vC = mix(vec3(0.7, 0.8, 1.3), vec3(1.3, 1.0, 0.8), fract(aSeed.w * 7.0)) * (1.0 + pow(aSeed.w, 8.0) * 3.0);
      } else { // warp: points flying along the axis past the camera
        vec3 A = normalize(uAxis);
        vec3 U = normalize(cross(A, abs(A.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0))); vec3 V = cross(A, U);
        float ang = aSeed.x * 6.28318, rad = 6.0 + aSeed.y * 30.0;
        float z = mod(aSeed.z * 400.0 - uTime * (60.0 + uSpeed * 80.0) * (0.6 + aSeed.w), 400.0) - 60.0;
        p = uCam + A * z + (U * cos(ang) + V * sin(ang)) * rad;
        sz = 0.5 + aSeed.w * 0.6; vC = mix(vec3(0.4, 1.8, 2.2), vec3(2.0, 0.5, 1.9), aSeed.w);
      }
      vec4 mv = viewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(sz * uPx / max(-mv.z, 0.1), 1.0, 24.0);
      if (uMode > 1.5 && uMode < 2.5) gl_PointSize = clamp(sz * uPx / 400.0, 1.0, 6.0);
    }`;
  const AMB_FS = /* glsl */`
    varying float vA; varying vec3 vC;
    void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float d = dot(q, q); if (d > 1.0) discard; float a = (1.0 - d); a *= a; gl_FragColor = vec4(vC * a * vA, 1.0); }`;
  const AMB_MODE = { ember: 0, storm: 1, void: 2, title: 2, warp: 3 };
  const AMB_COUNT = { ember: 600, storm: 400, void: 2000, title: 900, warp: 700 };

  // Shock ring (instanced flat quads) shader
  const RING_VS = /* glsl */`
    attribute vec4 iCT; // rgb, t (0..1)
    attribute vec2 iTA; // thickness, alpha
    varying vec2 vUv; varying vec4 vCT; varying vec2 vTA;
    void main(){ vUv = position.xy * 2.0; vCT = iCT; vTA = iTA; gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0); }`;
  const RING_FS = /* glsl */`
    varying vec2 vUv; varying vec4 vCT; varying vec2 vTA;
    void main(){ float d = length(vUv); if (d > 1.0) discard;
      float th = vTA.x; float ring = exp(-pow((d - 1.0 + th) / th, 2.0) * 1.8);
      float inner = smoothstep(1.0 - th * 4.0, 1.0, d) * smoothstep(1.0, 0.98, d) * 0.12;
      float a = (ring + inner) * vTA.y * (1.0 - vCT.a) * (1.0 - vCT.a);
      gl_FragColor = vec4(vCT.rgb * a + vec3(ring * ring) * a * 0.5, 1.0); }`;

  // Shards: fake-lit tetrahedra with cooling heat glow
  const SHARD_VS = /* glsl */`
    attribute vec3 iCol; attribute float iHeat; varying vec3 vN; varying vec3 vCol; varying float vHeat; varying vec3 vV;
    void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vec4 mv = viewMatrix * wp;
      vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * mat3(instanceMatrix) * normal); vV = -mv.xyz; vCol = iCol; vHeat = iHeat;
      gl_Position = projectionMatrix * mv; }`;
  const SHARD_FS = /* glsl */`
    varying vec3 vN; varying vec3 vCol; varying float vHeat; varying vec3 vV;
    void main(){ vec3 n = normalize(vN); vec3 v = normalize(vV);
      float dif = 0.35 + 0.65 * max(dot(n, normalize(vec3(0.4, 0.8, 0.5))), 0.0);
      float spec = pow(max(dot(reflect(-normalize(vec3(0.4,0.8,0.5)), n), v), 0.0), 24.0);
      float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
      vec3 c = vCol * dif * 1.25 + vec3(spec) * 1.2 + vCol * rim * 1.2 + vec3(2.2, 0.9, 0.3) * vHeat * vHeat * 1.6;
      gl_FragColor = vec4(c, 1.0); }`;

  // Speed lines (instanced streaks in camera space)
  const SPD_VS = /* glsl */`
    attribute vec4 iSeed; uniform float uTime, uInt;
    varying float vA; varying float vX;
    void main(){
      float ang = iSeed.x * 6.28318; float rad = 3.5 + iSeed.y * 5.0;
      float spd = 1.0 + iSeed.w;
      float z = -mod(iSeed.z * 60.0 + uTime * 70.0 * spd, 60.0) + 8.0; // camera space: streams toward the camera
      float len = 2.5 + iSeed.w * 6.0;
      vec3 p = vec3(cos(ang) * rad, sin(ang) * rad * 0.75, z + position.y * len);
      vec3 side = normalize(vec3(-sin(ang), cos(ang), 0.0)) * 0.0036 * (1.0 + iSeed.y);   // ~30% of the old width
      p += side * position.x * 2.0;
      vA = uInt * uInt * 0.55 * (0.3 + 0.7 * iSeed.w) * (1.0 - abs(position.y * 2.0)) * smoothstep(-1.5, -9.0, z);   // never right beside the lens
      vX = position.x * 2.0;
      gl_Position = projectionMatrix * vec4(p, 1.0);
    }`;
  const SPD_FS = /* glsl */`
    uniform vec3 uCol; varying float vA; varying float vX;
    void main(){ float a = (1.0 - abs(vX)) * vA; gl_FragColor = vec4(uCol * a * 0.8, 1.0); }`;

  // ---------------------------------------------------------------------------
  // The module
  // ---------------------------------------------------------------------------
  const fx = {
    auto: true,           // react to events from the catalog (dmg numbers, hit/graze/stagger bursts)
    uniforms: { uTime: { value: 0 }, uBeat: { value: 0 } }, // shared by fx-made materials
    mats: {},
    _acc: {},             // fractional emit accumulators per preset type
  };
  const sky = { name: null, mesh: null, uniforms: null, _mats: {}, _env: {} };
  G.fx = fx; G.sky = sky;

  // pools (filled in init)
  let glow, smoke, heads, ribGeo, ribMesh, ribs, txt, rings, shards, speed, amb;
  const bolts = [];
  const BOLT_MAX = 64;
  const lightnings = []; // {rib[], life, maxLife, ax..bz, color, width, regen}
  const LIGHT_MAX = 16;
  const userRibs = new Set();
  let flashEl = null, flashA = 0, flashR = 1, flashG = 1, flashB = 1;
  let bloomAdd = 0, bloomT = 0, bloomDur = 0, bloomPeak = 0;
  let expAdd = 0;
  let speedTarget = 0, speedCur = 0;
  let stormNext = 5, stormFlash = 0;
  let realTime = 0;

  function qualityCap(full) { const t = G.quality?.tier || 'high'; return t === 'low' ? Math.floor(full * 0.27) : t === 'med' ? Math.floor(full * 0.53) : full; }

  // ---------------------------------------------------------------- particles
  function spawnPreset(type, pos, dir, count, opts) {
    const p = P[type]; if (!p) return;
    const layer = p.pool === 'smoke' ? smoke : glow;
    const sc = opts?.scale ?? 1;
    let c = p._c, c1 = p._c1;
    let cr = c[0], cg = c[1], cb = c[2], er = c1[0], eg = c1[1], eb = c1[2];
    if (opts && (opts.color != null || opts.tier)) {
      const g = p.glow || 1;
      _col.set(opts.color != null ? opts.color : TIER_COL[opts.tier]);
      // tint: start hot (towards white) and end in the given color
      er = _col.r * g; eg = _col.g * g; eb = _col.b * g;
      cr = (er + g) * 0.5; cg = (eg + g) * 0.5; cb = (eb + g) * 0.5;
      if (p.pool === 'smoke') { cr = er; cg = eg; cb = eb; }
    }
    if (opts?.color1 != null) { const g = p.glow || 1; _col.set(opts.color1); er = _col.r * g; eg = _col.g * g; eb = _col.b * g; }
    const spdMul = opts?.speed ?? 1;
    const hasDir = !!dir && (dir.x || dir.y || dir.z);
    let dx = 0, dy = 1, dz = 0;
    if (hasDir) { const l = Math.hypot(dir.x, dir.y, dir.z) || 1; dx = dir.x / l; dy = dir.y / l; dz = dir.z / l; }
    const spread = opts?.spread ?? p.spread;
    const alpha = p.alpha ?? 1;
    for (let k = 0; k < count; k++) {
      // random direction: blend dir with a random unit vector by spread
      let rx = rnd() * 2 - 1, ry = rnd() * 2 - 1, rz = rnd() * 2 - 1;
      const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
      if (p.flat) ry *= 0.08;
      let vx, vy, vz;
      if (hasDir) { vx = dx + rx * spread; vy = dy + ry * spread; vz = dz + rz * spread; }
      else { vx = rx; vy = ry; vz = rz; }
      const vl = Math.hypot(vx, vy, vz) || 1;
      const sp = rr(p.spd[0], p.spd[1]) * spdMul * sc;
      vx = vx / vl * sp; vy = vy / vl * sp + (p.up || 0) * rnd() * (hasDir ? 0.5 : 1) * sc; vz = vz / vl * sp;
      const j = p.rnd ? p.rnd : 0.15 * sc;
      layer.spawn(pos.x + (rnd() - .5) * j, pos.y + (rnd() - .5) * j, pos.z + (rnd() - .5) * j, vx, vy, vz,
        rr(p.life[0], p.life[1]), p.size[0] * sc * rr(0.7, 1.3), p.size[1] * sc, cr, cg, cb, er, eg, eb,
        alpha, p.drag || 0, p.grav || 0, p.stretch || 0, p.flick || 0);
    }
    // bonus: a big soft flash particle and optional smoke
    if (p.flash) glow.spawn(pos.x, pos.y, pos.z, 0, 0, 0, 0.18, p.flash * sc, p.flash * sc * 1.6, cr * 0.45, cg * 0.45, cb * 0.45, er * 0.2, eg * 0.2, eb * 0.2, 1, 0, 0, 0, 0);
    if (p.smoke) spawnPreset('dust', pos, null, p.smoke, { scale: sc * 1.5 });
  }

  fx.burst = (type, pos, opts) => {
    if (!glow || !pos) return;
    if (type === 'shockwave') return fx.shockwave(pos, opts);
    if (type === 'lightningStrike') return fx.lightning(_v3.set(pos.x, pos.y + 40, pos.z), pos, opts);
    const p = P[type]; if (!p) return;
    const n = opts?.count ?? (p.count >= 6 ? p.count : p.count * 6);
    spawnPreset(type, pos, opts?.dir || null, n, opts);
    if (type === 'comet' || type === 'explosion') fx.shockwave(pos, { color: type === 'comet' ? 0xffc93a : 0xff6a1a, radius: type === 'comet' ? 30 : 14, dur: 0.6 });
    return n;
  };
  // continuous emission: count may be fractional (e.g. rate*dt); remainder accumulates per type
  fx.emit = (type, pos, dir, count, opts) => {
    if (!glow || !pos) return;
    const key = opts?.key || type;
    const tierK = P[type]?.kartFx && (G.quality?.tier || 'high') !== 'high' ? 0.45 : 1;   // per-kart emission cap on med/low
    const a = (fx._acc[key] || 0) + (count ?? 1) * (P[type]?.emitMul || 1) * tierK;
    const n = Math.floor(a); fx._acc[key] = a - n;
    if (n > 0) spawnPreset(type, pos, dir, n, opts);
  };
  fx.presets = P;

  // -------------------------------------------------------------- shockwaves
  const RING_MAX = 24;
  const ringState = []; // {active,t,dur,radius,x,y,z,nx,ny,nz,thick,alpha}
  fx.shockwave = (pos, opts = {}) => {
    if (!rings) return;
    let r = ringState.find(x => !x.active); if (!r) r = ringState[0];
    r.active = true; r.t = 0; r.dur = opts.dur ?? 0.55; r.radius = opts.radius ?? 12; r.r0 = opts.r0 ?? 0.5;
    r.x = pos.x; r.y = pos.y + (opts.lift ?? 0.15); r.z = pos.z;
    const n = opts.normal || _up; r.nx = n.x; r.ny = n.y; r.nz = n.z;
    r.thick = opts.thick ?? 0.07; r.alpha = opts.alpha ?? 1.0;
    _col.set(opts.color ?? 0xffffff); const g = opts.glow ?? 2.0; r.cr = _col.r * g; r.cg = _col.g * g; r.cb = _col.b * g;
    return r;
  };

  // ------------------------------------------------------------------ ribbons
  function allocRib(reserveFor) {
    // bolts: 0..63, lightning: 64..95, user: 96..111
    const [a, b] = reserveFor === 'bolt' ? [0, 64] : reserveFor === 'light' ? [64, 96] : [96, RIB_N];
    for (let i = a; i < b; i++) if (!ribs[i].active) return ribs[i];
    return null;
  }
  // User ribbon: const h = G.fx.ribbon({color, width, glow}); h.push(v3) each frame; h.release()
  fx.ribbon = (opts = {}) => {
    if (!ribs) return null;
    const rb = allocRib('user'); if (!rb) return null;
    rb.reset(opts.width ?? 0.4, opts.color ?? 0x33f6ff, opts.glow ?? 2, opts.alpha ?? 1);
    if (!rb.handle) rb.handle = {
      rib: rb,
      push(v) { if (this.rib.active) this.rib.push(v.x, v.y, v.z); },
      clear() { this.rib.n = 0; },
      setColor(c, g = 2) { _col.set(c); this.rib.r = _col.r * g; this.rib.g = _col.g * g; this.rib.b = _col.b * g; },
      setAlpha(a) { this.rib.alpha = a; },
      setWidth(w) { this.rib.width = w; },
      release() { this.rib.active = false; this.rib.n = 0; userRibs.delete(this); },
    };
    userRibs.add(rb.handle);
    return rb.handle;
  };

  function writeRibbons() {
    const pos = ribGeo.attributes.position.array, col = ribGeo.attributes.aCol.array;
    const cam = G.camera.position;
    for (let r = 0; r < RIB_N; r++) {
      const rb = ribs[r], base = r * RIB_P * 2;
      if (!rb.active || rb.n < 2) {
        if (rb._wasDrawn) { for (let k = 0; k < RIB_P * 2; k++) { col[(base + k) * 4 + 3] = 0; pos[(base + k) * 3] = 0; pos[(base + k) * 3 + 1] = -9999; pos[(base + k) * 3 + 2] = 0; } rb._wasDrawn = false; }
        continue;
      }
      rb._wasDrawn = true;
      const p = rb.pts, n = rb.n;
      for (let i = 0; i < RIB_P; i++) {
        const ii = Math.min(i, n - 1);
        const i0 = Math.max(ii - 1, 0), i1 = Math.min(ii + 1, n - 1);
        // tangent
        _v.set(p[i1 * 3] - p[i0 * 3], p[i1 * 3 + 1] - p[i0 * 3 + 1], p[i1 * 3 + 2] - p[i0 * 3 + 2]);
        _v2.set(cam.x - p[ii * 3], cam.y - p[ii * 3 + 1], cam.z - p[ii * 3 + 2]);
        _v.cross(_v2); const l = _v.length() || 1;
        const t = ii / Math.max(1, n - 1);              // 0 head .. 1 tail
        const w = rb.width * (rb.taper ? (1 - t) * (1 - t * 0.3) + 0.04 : 1) * (i === 0 ? rb.headW : 1);
        _v.multiplyScalar(w / l);
        const a = rb.alpha * (1 - t * 0.85);
        const v0 = (base + i * 2) * 3, v1 = v0 + 3;
        pos[v0] = p[ii * 3] + _v.x; pos[v0 + 1] = p[ii * 3 + 1] + _v.y; pos[v0 + 2] = p[ii * 3 + 2] + _v.z;
        pos[v1] = p[ii * 3] - _v.x; pos[v1 + 1] = p[ii * 3 + 1] - _v.y; pos[v1 + 2] = p[ii * 3 + 2] - _v.z;
        const c0 = (base + i * 2) * 4;
        col[c0] = col[c0 + 4] = rb.r; col[c0 + 1] = col[c0 + 5] = rb.g; col[c0 + 2] = col[c0 + 6] = rb.b; col[c0 + 3] = col[c0 + 7] = a;
      }
    }
    ribGeo.attributes.position.needsUpdate = true; ribGeo.attributes.aCol.needsUpdate = true;
  }

  // -------------------------------------------------------------------- bolts
  // G.fx.bolt(fromV3, targetGetter, {color, tier, dmg, speed=90, delay=0, onHit(pos, bolt), onFizzle, arc, width})
  // targetGetter() -> Vector3 (world) or null (bolt fizzles). Homing quadratic arc, 0.3-0.8 s flight.
  fx.bolt = (from, targetGetter, opts = {}) => {
    if (!ribs) return null;
    let b = null;
    for (let i = 0; i < bolts.length; i++) if (!bolts[i].active) { b = bolts[i]; break; }
    if (!b) return null;
    b.active = true; b.delay = opts.delay ?? 0; b.started = false; b.done = false; b.dying = 0;
    b.ax = from.x; b.ay = from.y; b.az = from.z; b.get = targetGetter; b.opts = opts;
    b.speed = opts.speed ?? 90; b.t = 0;
    b.tier = opts.tier ?? 1; _col.set(opts.color ?? TIER_COL[b.tier] ?? 0x3fa9ff);
    b.cr = _col.r; b.cg = _col.g; b.cb = _col.b;
    b.width = opts.width ?? (0.3 + b.tier * 0.1) * (opts.crit ? 1.8 : 1);
    b.arc = opts.arc ?? 1;
    b.side = rnd() * 2 - 1; b.lift = rr(0.4, 1.0);
    b.rib = null;
    return b;
  };
  function startBolt(b) {
    const tgt = b.get?.();
    if (!tgt) { b.active = false; b.opts.onFizzle?.(); return; }
    b.started = true;
    b.tx = tgt.x; b.ty = tgt.y; b.tz = tgt.z;
    const dist = Math.hypot(b.tx - b.ax, b.ty - b.ay, b.tz - b.az);
    b.dur = Math.min(0.8, Math.max(0.3, dist / b.speed));
    // control point: up and to a random side relative to the travel direction
    _v.set(b.tx - b.ax, b.ty - b.ay, b.tz - b.az); const L = _v.length() || 1; _v.multiplyScalar(1 / L);
    _v2.crossVectors(_v, _up); if (_v2.lengthSq() < 1e-4) _v2.set(1, 0, 0); _v2.normalize();
    const k = Math.min(L * 0.35, 18) * b.arc;
    b.cx = (b.ax + b.tx) * 0.5 + _v2.x * b.side * k + _up.x * k * b.lift;
    b.cy = (b.ay + b.ty) * 0.5 + _v2.y * b.side * k + k * b.lift;
    b.cz = (b.az + b.tz) * 0.5 + _v2.z * b.side * k;
    b.rib = allocRib('bolt');
    if (b.rib) { b.rib.reset(b.width, 0xffffff, 1, 1); b.rib.r = b.cr * 3; b.rib.g = b.cg * 3; b.rib.b = b.cb * 3; b.rib.push(b.ax, b.ay, b.az); }
    b.hx = b.ax; b.hy = b.ay; b.hz = b.az;
    // muzzle sparkle
    _v3.set(b.ax, b.ay, b.az); spawnPreset('boltImpact', _v3, null, 5, { color: TIER_COL[b.tier] ?? 0xffffff, scale: 0.4 });
  }
  function updateBolts(dt) {
    for (let i = 0; i < bolts.length; i++) {
      const b = bolts[i]; if (!b.active) continue;
      if (!b.started) { b.delay -= dt; if (b.delay <= 0) startBolt(b); continue; }
      if (b.done) { // trail retracts into the impact point
        b.dying -= dt;
        if (b.rib) b.rib.push(b.hx, b.hy, b.hz);
        if (b.dying <= 0) { if (b.rib) b.rib.active = false; b.active = false; }
        continue;
      }
      // re-home onto the live target
      const tgt = b.get?.();
      if (tgt) { b.tx = tgt.x; b.ty = tgt.y; b.tz = tgt.z; }
      b.t += dt / b.dur;
      const t = Math.min(1, b.t), u = 1 - t;
      const px = u * u * b.ax + 2 * u * t * b.cx + t * t * b.tx;
      const py = u * u * b.ay + 2 * u * t * b.cy + t * t * b.ty;
      const pz = u * u * b.az + 2 * u * t * b.cz + t * t * b.tz;
      b.vx = (px - b.hx) / dt; b.vy = (py - b.hy) / dt; b.vz = (pz - b.hz) / dt;
      b.hx = px; b.hy = py; b.hz = pz;
      if (b.rib) b.rib.push(px, py, pz);
      // little sparks shed from the bolt
      if (rnd() < 0.5) glow.spawn(px, py, pz, (rnd() - .5) * 4, (rnd() - .5) * 4, (rnd() - .5) * 4, 0.25, 0.12, 0.02, b.cr * 3, b.cg * 3, b.cb * 3, b.cr, b.cg, b.cb, 1, 2, 0, 0, 0.4);
      if (t >= 1) {
        b.done = true; b.dying = 0.14;
        _v3.set(px, py, pz);
        spawnPreset('boltImpact', _v3, null, b.opts.crit ? 40 : 18 + b.tier * 4, { color: TIER_COL[b.tier] ?? 0xffffff, scale: b.opts.crit ? 1.6 : 0.8 + b.tier * 0.15 });
        if (b.opts.crit) fx.shockwave(_v3, { color: 0xc04bff, radius: 8, dur: 0.35, normal: _v2.set(b.vx, b.vy, b.vz).normalize().negate(), lift: 0 });
        try { b.opts.onHit?.(_v3, b); } catch (e) { console.error('[fx] bolt onHit', e); }
      }
    }
  }
  function writeHeads() {
    heads.n = 0;
    for (let i = 0; i < bolts.length; i++) {
      const b = bolts[i]; if (!b.active || !b.started || b.done) continue;
      const s = b.width * 2.6;
      heads.spawn(b.hx, b.hy, b.hz, b.vx || 0, b.vy || 0, b.vz || 0, 1, s, s, 1.5 + b.cr * 3, 1.5 + b.cg * 3, 1.5 + b.cb * 3, 0, 0, 0, 1, 0, 0, 0.006, 0);
    }
    heads.upload();
  }

  // ---------------------------------------------------------------- lightning
  // G.fx.lightning(fromV3, toV3, {color=0xbfe3ff, width=0.35, life=0.18, branches=2, jag=0.18})
  fx.lightning = (a, b, opts = {}) => {
    if (!ribs) return null;
    let L = lightnings.find(l => !l.active); if (!L) L = lightnings[0];
    L.active = true; L.life = 0; L.maxLife = opts.life ?? 0.18; L.regen = 0;
    L.ax = a.x; L.ay = a.y; L.az = a.z; L.bx = b.x; L.by = b.y; L.bz = b.z;
    L.color = opts.color ?? 0xbfe3ff; L.width = opts.width ?? 0.35; L.jag = opts.jag ?? 0.18; L.glowAmt = opts.glow ?? 3;
    const nb = Math.min(opts.branches ?? 2, 2);
    for (let k = 0; k < 3; k++) { if (L.ribs[k]) { L.ribs[k].active = false; L.ribs[k] = null; } }
    for (let k = 0; k <= nb; k++) { const rb = allocRib('light'); if (rb) { rb.reset(k ? L.width * 0.55 : L.width, L.color, L.glowAmt, 1); rb.taper = 0; } L.ribs[k] = rb; }
    buildLightning(L);
    _v3.set(b.x, b.y, b.z); spawnPreset('lightning', _v3, null, 14, { color: L.color });
    return L;
  };
  const _lp = new Float32Array(RIB_P * 3);
  function displace(out, ax, ay, az, bx, by, bz, jag) {
    // midpoint displacement into RIB_P points (iterative: fill endpoints, subdivide)
    const n = RIB_P;
    out[0] = ax; out[1] = ay; out[2] = az; out[(n - 1) * 3] = bx; out[(n - 1) * 3 + 1] = by; out[(n - 1) * 3 + 2] = bz;
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    // linear then add multi-scale noise perpendicular-ish
    for (let i = 1; i < n - 1; i++) {
      const t = i / (n - 1);
      out[i * 3] = ax + (bx - ax) * t; out[i * 3 + 1] = ay + (by - ay) * t; out[i * 3 + 2] = az + (bz - az) * t;
    }
    let amp = len * jag;
    for (let step = (n - 1) >> 1; step >= 1; step >>= 1, amp *= 0.55) {
      for (let i = step; i < n - 1; i += step * 2) {
        out[i * 3] += (rnd() - .5) * amp; out[i * 3 + 1] += (rnd() - .5) * amp; out[i * 3 + 2] += (rnd() - .5) * amp;
      }
    }
  }
  function setRibPts(rb, src) { if (!rb) return; rb.n = RIB_P; rb.pts.set(src); }
  function buildLightning(L) {
    displace(_lp, L.ax, L.ay, L.az, L.bx, L.by, L.bz, L.jag);
    setRibPts(L.ribs[0], _lp);
    for (let k = 1; k < 3; k++) {
      const rb = L.ribs[k]; if (!rb) continue;
      const j = 4 + Math.floor(rnd() * 12), x = _lp[j * 3], y = _lp[j * 3 + 1], z = _lp[j * 3 + 2];
      const len = Math.hypot(L.bx - L.ax, L.by - L.ay, L.bz - L.az) * 0.35;
      const ex = x + (L.bx - L.ax) / len * 0 + (rnd() - .5) * len, ey = y + (L.by - L.ay) * 0.2 + (rnd() - .5) * len * 0.5, ez = z + (rnd() - .5) * len;
      const tmp = rb.pts; displace(tmp, x, y, z, ex, ey, ez, L.jag * 1.3); rb.n = RIB_P;
    }
  }
  function updateLightning(dt) {
    for (const L of lightnings) {
      if (!L.active) continue;
      L.life += dt; L.regen += dt;
      if (L.life >= L.maxLife) { L.active = false; for (let k = 0; k < 3; k++) if (L.ribs[k]) { L.ribs[k].active = false; L.ribs[k] = null; } continue; }
      if (L.regen > 0.05) { L.regen = 0; buildLightning(L); }
      const a = (1 - L.life / L.maxLife) * (0.6 + 0.4 * rnd());
      for (let k = 0; k < 3; k++) if (L.ribs[k]) L.ribs[k].alpha = a * (k ? 0.7 : 1);
    }
  }

  // ------------------------------------------------------------- damage text
  const txtState = []; // {active, t, x,y,z, n, style, vx, vz, life}
  const glyphUV = {};
  const txtAttrs = [null, null, null, null];
  fx.callout3D = (pos, text, style = 'normal', opts) => {
    if (!txt || !pos) return;
    let s = txtState.find(t => !t.active);
    if (!s) { s = txtState[0]; for (const t of txtState) if (t.t > s.t) s = t; } // recycle oldest
    s.active = true; s.t = 0; s.life = opts?.life ?? 0.9;
    s.x = pos.x + (rnd() - .5) * 0.8; s.y = pos.y + 0.6; s.z = pos.z + (rnd() - .5) * 0.8;
    s.text = String(text).toUpperCase().slice(0, TXT_GL);
    const st = TXT_STYLE[style] || TXT_STYLE.normal; s.st = st;
    s.scale = (opts?.scale ?? 1);
    s.rise = opts?.rise ?? 2;
    return s;
  };
  fx.dmgNumber = (pos, n, style = 'normal') => {
    if (typeof n === 'number') n = Math.round(n);
    const str = style === 'crit' ? n + '!' : style === 'heal' ? '+' + n : style === 'player' ? '-' + n : String(n);
    return fx.callout3D(pos, str, style, { scale: style === 'crit' ? 1 : Math.min(1.5, 0.85 + Math.log10(Math.max(10, +n || 10)) * 0.12) });
  };
  function writeText(dt) {
    const aP = txt.geometry.attributes.iPos, aU = txt.geometry.attributes.iUv, aC = txt.geometry.attributes.iCA, aO = txt.geometry.attributes.iOff;
    let k = 0;
    for (const s of txtState) {
      if (!s.active) continue;
      s.t += dt;
      const t = s.t / s.life;
      if (t >= 1) { s.active = false; continue; }
      const ease = 1 - Math.pow(1 - t, 3);
      const y = s.y + ease * s.rise;
      // pop: 1.6 -> 1.0 over first 0.12s
      const pop = 1 + 0.6 * Math.max(0, 1 - s.t / 0.12);
      const a = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const n = s.text.length, half = (n - 1) * 0.5;
      for (let i = 0; i < n && k < TXT_I; i++) {
        const ch = s.text[i]; if (ch === ' ') continue;
        const uv = glyphUV[ch] || glyphUV['!'];
        aP.array[k * 3] = s.x; aP.array[k * 3 + 1] = y; aP.array[k * 3 + 2] = s.z;
        aU.array[k * 4] = uv[0]; aU.array[k * 4 + 1] = uv[1]; aU.array[k * 4 + 2] = uv[2]; aU.array[k * 4 + 3] = uv[3];
        aC.array[k * 4] = s.st._c[0]; aC.array[k * 4 + 1] = s.st._c[1]; aC.array[k * 4 + 2] = s.st._c[2]; aC.array[k * 4 + 3] = a;
        aO.array[k * 2] = (i - half); aO.array[k * 2 + 1] = s.st.size * s.scale * pop;
        k++;
      }
    }
    txt.geometry.instanceCount = k;
    if (k) { txtAttrs[0] = aP; txtAttrs[1] = aU; txtAttrs[2] = aC; txtAttrs[3] = aO; for (let i = 0; i < 4; i++) { const a = txtAttrs[i]; a.clearUpdateRanges(); a.addUpdateRange(0, k * a.itemSize); a.needsUpdate = true; } }
  }
  function buildAtlas() {
    const cv = document.createElement('canvas'); cv.width = ATL_C * CW; cv.height = ATL_R * CH;
    const x = cv.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, cv.width, cv.height);
    x.font = 'italic 900 64px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    for (let i = 0; i < GLYPHS.length; i++) {
      const cx = (i % ATL_C) * CW + CW / 2, cy = Math.floor(i / ATL_C) * CH + CH / 2 + 3;
      x.lineWidth = 12; x.strokeStyle = '#00ff00'; x.strokeText(GLYPHS[i], cx, cy);
      x.fillStyle = '#ff0000'; x.fillText(GLYPHS[i], cx, cy);
      const u0 = (i % ATL_C) / ATL_C, v1 = 1 - Math.floor(i / ATL_C) / ATL_R;
      glyphUV[GLYPHS[i]] = [u0, v1 - 1 / ATL_R, u0 + 1 / ATL_C, v1];
    }
    const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
    return tex;
  }

  // ------------------------------------------------------------------- shards
  const SHARD_MAX = 400;
  let sh; // typed arrays
  // G.fx.shards(meshOrPos, count=120, color=0xb08a3a, {speed=1, heat=1, size=1, life=3, gravity=16})
  fx.shards = (src, count = 120, color = 0xb08a3a, opts = {}) => {
    if (!shards || !src) return;
    let cx, cy, cz, ex = 1, ey = 1, ez = 1;
    if (src.isObject3D) {
      const box = new THREE.Box3().setFromObject(src); // one-off event; allocation acceptable
      box.getCenter(_v); box.getSize(_v2); cx = _v.x; cy = _v.y; cz = _v.z; ex = _v2.x * 0.5; ey = _v2.y * 0.5; ez = _v2.z * 0.5;
      if (!isFinite(cx)) { src.getWorldPosition(_v); cx = _v.x; cy = _v.y; cz = _v.z; ex = ey = ez = 2; }
    } else { cx = src.x; cy = src.y; cz = src.z; ex = ey = ez = opts.radius ?? 1; }
    _col.set(color);
    const spd = opts.speed ?? 1, sz = (opts.size ?? 1) * Math.max(0.6, Math.min(3, Math.max(ex, ey, ez) * 0.12)), life = opts.life ?? 3, heat = opts.heat ?? 1, grav = opts.gravity ?? 16;
    for (let k = 0; k < count; k++) {
      let i = sh.n < SHARD_MAX ? sh.n++ : Math.floor(rnd() * SHARD_MAX);
      const ox = (rnd() * 2 - 1) * ex, oy = (rnd() * 2 - 1) * ey, oz = (rnd() * 2 - 1) * ez;
      sh.p[i * 3] = cx + ox; sh.p[i * 3 + 1] = cy + oy; sh.p[i * 3 + 2] = cz + oz;
      const l = Math.hypot(ox / ex, oy / ey, oz / ez) || 1, v = rr(8, 26) * spd;
      sh.v[i * 3] = ox / ex / l * v + (rnd() - .5) * 4; sh.v[i * 3 + 1] = oy / ey / l * v * 0.7 + rr(4, 12) * spd; sh.v[i * 3 + 2] = oz / ez / l * v + (rnd() - .5) * 4;
      sh.q[i * 4] = rnd(); sh.q[i * 4 + 1] = rnd(); sh.q[i * 4 + 2] = rnd(); sh.q[i * 4 + 3] = rnd() * 6.28;
      sh.w[i] = rr(4, 14); sh.life[i] = 0; sh.max[i] = life * rr(0.7, 1.15); sh.size[i] = rr(0.4, 1.4) * sz; sh.g[i] = grav;
      const tint = rr(0.75, 1.15);
      shards.geometry.attributes.iCol.array[i * 3] = _col.r * tint; shards.geometry.attributes.iCol.array[i * 3 + 1] = _col.g * tint; shards.geometry.attributes.iCol.array[i * 3 + 2] = _col.b * tint;
      sh.heat0[i] = heat * rr(0.6, 1);
    }
    shards.geometry.attributes.iCol.needsUpdate = true;
  };
  function updateShards(dt) {
    if (!sh.n) { shards.count = 0; return; }
    const hA = shards.geometry.attributes.iHeat.array;
    for (let i = sh.n - 1; i >= 0; i--) {
      sh.life[i] += dt;
      if (sh.life[i] >= sh.max[i]) { // swap-remove
        const j = --sh.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) { sh.p[i * 3 + k] = sh.p[j * 3 + k]; sh.v[i * 3 + k] = sh.v[j * 3 + k]; shards.geometry.attributes.iCol.array[i * 3 + k] = shards.geometry.attributes.iCol.array[j * 3 + k]; }
          for (let k = 0; k < 4; k++) sh.q[i * 4 + k] = sh.q[j * 4 + k];
          sh.w[i] = sh.w[j]; sh.life[i] = sh.life[j]; sh.max[i] = sh.max[j]; sh.size[i] = sh.size[j]; sh.g[i] = sh.g[j]; sh.heat0[i] = sh.heat0[j];
          shards.geometry.attributes.iCol.needsUpdate = true;
        }
        continue;
      }
      const dr = 1 - 0.4 * dt;
      sh.v[i * 3] *= dr; sh.v[i * 3 + 1] = sh.v[i * 3 + 1] * dr - sh.g[i] * dt; sh.v[i * 3 + 2] *= dr;
      sh.p[i * 3] += sh.v[i * 3] * dt; sh.p[i * 3 + 1] += sh.v[i * 3 + 1] * dt; sh.p[i * 3 + 2] += sh.v[i * 3 + 2] * dt;
      sh.q[i * 4 + 3] += sh.w[i] * dt;
    }
  }
  function writeShards() {
    const hA = shards.geometry.attributes.iHeat.array;
    for (let i = 0; i < sh.n; i++) {
      const t = sh.life[i] / sh.max[i];
      _v.set(sh.q[i * 4] - .5, sh.q[i * 4 + 1] - .5, sh.q[i * 4 + 2] - .5).normalize();
      _q.setFromAxisAngle(_v, sh.q[i * 4 + 3]);
      const s = sh.size[i] * (t > 0.8 ? (1 - t) / 0.2 : 1);
      _s.set(s, s * 0.6, s * 1.4);
      _v2.set(sh.p[i * 3], sh.p[i * 3 + 1], sh.p[i * 3 + 2]);
      _m.compose(_v2, _q, _s); shards.setMatrixAt(i, _m);
      hA[i] = sh.heat0[i] * Math.max(0, 1 - t * 3.0);
    }
    shards.count = sh.n;
    if (sh.n) { shards.instanceMatrix.needsUpdate = true; shards.geometry.attributes.iHeat.needsUpdate = true; }
  }

  // -------------------------------------------------------------------- flash
  // G.fx.flash(color, amt 0..1, dur=0.25). Uses G.post.flash if core provides it, else a DOM overlay.
  fx.flash = (color = 0xffffff, amt = 0.6, dur = 0.25) => {
    if (typeof G.post?.flash === 'function') { G.post.flash(color, amt, amt / Math.max(0.05, dur)); return; } // core's 3rd arg is a decay rate
    _col.set(color);
    if (amt >= flashA) { flashR = _col.r; flashG = _col.g; flashB = _col.b; }
    flashA = Math.max(flashA, Math.min(1, amt)); fx._flashDecay = amt / Math.max(0.05, dur);
  };
  // Bloom pulse: adds `add` to bloom strength, decaying over dur (delta-based; composes with others)
  fx.bloomPulse = (add = 0.8, dur = 0.4) => {
    if (typeof G.post?.bloomPulse === 'function') { G.post.bloomPulse(add, add / Math.max(0.05, dur)); return; }
    if (add >= bloomAdd) { bloomPeak = add; bloomT = 0; bloomDur = dur; }
  };
  fx.speedLines = (k) => { speedTarget = Math.max(0, Math.min(1, k || 0)); };

  // ------------------------------------------------------- shared materials
  // Cached so modules share programs. Colors >1 bloom.
  const matCache = new Map();
  fx.mats.glow = (color, intensity = 2.5, opts = {}) => {
    const key = 'g' + color + ':' + intensity + ':' + (opts.additive ? 1 : 0) + ':' + (opts.opacity ?? 1);
    if (matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: !!opts.additive || opts.opacity != null, opacity: opts.opacity ?? 1,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !opts.additive, fog: false, side: opts.side ?? THREE.FrontSide });
    matCache.set(key, m); return m;
  };
  // fresnel rim glow (additive): great for shields, ghosts, energy shells
  fx.mats.fresnel = (color, intensity = 2.5, power = 2.5, opts = {}) => {
    const key = 'f' + color + ':' + intensity + ':' + power + ':' + (opts.base ?? 0.05);
    if (matCache.has(key)) return matCache.get(key);
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(intensity) }, uPow: { value: power }, uBase: { value: opts.base ?? 0.05 }, uTime: fx.uniforms.uTime },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);
        #ifdef USE_INSTANCING
        mv = modelViewMatrix * instanceMatrix * vec4(position,1.0);
        #endif
        vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uPow, uBase, uTime; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow); gl_FragColor = vec4(uColor * (f + uBase), 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: opts.side ?? THREE.FrontSide,
    });
    matCache.set(key, m); return m;
  };
  // animated energy: flowing noise bands (beams, portals, cores). Not cached: returns new (cheap uniforms) sharing the program.
  const ENERGY_FS = `uniform vec3 uColor; uniform float uTime, uScroll, uInt; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    void main(){ vec2 uv = vUv; float a = n(vec2(uv.x * 6.0, uv.y * 3.0 - uTime * uScroll)) * 0.6 + n(vec2(uv.x * 13.0, uv.y * 7.0 - uTime * uScroll * 1.7)) * 0.4;
      float e = smoothstep(0.35, 0.8, a); float core = 1.0 - abs(uv.x - 0.5) * 2.0;
      gl_FragColor = vec4(uColor * uInt * (e * 0.9 + 0.25) * (0.4 + core), 1.0); }`;
  fx.mats.energy = (color = 0x33f6ff, intensity = 2.5, scroll = 2) => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: fx.uniforms.uTime, uScroll: { value: scroll }, uInt: { value: intensity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec4 p = vec4(position,1.0);
      #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * p; }`,
    fragmentShader: ENERGY_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  fx.TIER_COL = TIER_COL;

  // ----------------------------------------------------------------- sky API
  function skyMaterial(name) {
    if (sky._mats[name]) return sky._mats[name];
    const oct = (G.quality?.tier === 'high' || !G.quality) ? 2 : 1;
    const m = new THREE.ShaderMaterial({
      uniforms: sky.uniforms, vertexShader: SKY_VS,
      fragmentShader: `#define OCT ${oct}\n` + SKY_HEAD + SKY_FS[name],
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    sky._mats[name] = m; return m;
  }
  // G.sky.set(name, {axis?:V3 (warp), env?:bool=true}) — 'ember'|'storm'|'void'|'warp'|'title'
  sky.set = (name, opts = {}) => {
    if (!SKY_FS[name]) { console.warn('[sky] unknown', name); name = 'title'; }
    sky.name = name;
    sky.mesh.material = skyMaterial(name);
    sky.mesh.visible = true;
    sky.uniforms.uDawn.value = 0; sky.uniforms.uFlash.value = 0; sky.uniforms.uEnrage.value = 0;
    if (opts.axis) sky.uniforms.uAxis.value.copy(opts.axis).normalize();
    else if (name === 'warp' && G.camera) { G.camera.getWorldDirection(_v); _v.y = 0; if (_v.lengthSq() < 1e-3) _v.set(0, 0, -1); sky.uniforms.uAxis.value.copy(_v.normalize()); }
    setAmbient(name);
    stormNext = 3 + rnd() * 3;
    if (opts.env !== false && G.renderer && G.scene) { try { G.scene.environment = sky.envMap(name); } catch (e) { console.warn('[sky] env', e); } }
  };
  // PMREM env map rendered from the sky shader (cached per sky). Great for chrome.
  sky.envMap = (name = sky.name) => {
    if (sky._env[name]) return sky._env[name];
    const pm = new THREE.PMREMGenerator(G.renderer);
    const sc = new THREE.Scene();
    const m = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial(name));
    sc.add(m);
    const rt = pm.fromScene(sc, 0, 0.1, 1000);
    pm.dispose(); m.geometry.dispose();
    sky._env[name] = rt.texture; return rt.texture;
  };
  sky.lightning = (dir) => { // manual storm flash
    stormFlash = 1;
    if (dir) sky.uniforms.uFlashDir.value.copy(dir).normalize();
    else sky.uniforms.uFlashDir.value.set(rnd() * 2 - 1, rr(0.05, 0.5), rnd() * 2 - 1).normalize();
    const cam = G.camera.position, d = sky.uniforms.uFlashDir.value;
    _v.copy(cam).addScaledVector(d, 520); _v2.copy(_v); _v.y += 160; _v2.y -= 60 + rnd() * 120;
    fx.lightning(_v, _v2, { width: 3.5, life: 0.25, branches: 2, jag: 0.12, color: 0xd8ccff, glow: 2.2 });
    G.emit?.('sky:lightning', { dir: d });
  };
  sky.setEnrage = (k) => { sky.uniforms.uEnrage.value = k; };
  sky.setDawn = (k) => { sky.uniforms.uDawn.value = k; };

  function setAmbient(name) {
    const want = qualityCap(AMB_COUNT[name] || 0);
    amb.material.uniforms.uMode.value = AMB_MODE[name] ?? 2;
    amb.geometry.setDrawRange(0, want);
    amb.visible = want > 0;
  }

  // ------------------------------------------------------------------ events
  function bindEvents() {
    if (!G.on) return;
    const kp = () => G.kart?.worldPos;
    G.on('boss:damaged', (e) => {
      if (!fx.auto || !e || !e.pos || !(e.amount > 0)) return;
      fx.dmgNumber(e.pos, e.amount, e.crit ? 'crit' : e.weak ? 'weak' : 'normal');
    });
    G.on('kart:hit', (e) => {
      if (!fx.auto) return; const p = kp(); if (!p) return;
      if (e?.amount > 0) fx.dmgNumber(p, e.amount, 'player');
      spawnPreset('hit', p, null, 40, null);
      fx.flash(0xff2a3a, 0.25, 0.25);
    });
    G.on('kart:graze', (e) => {
      if (!fx.auto) return; const p = kp(); if (!p) return;
      spawnPreset('graze', p, null, e?.mega ? 60 : 26, null);
      fx.shockwave(p, { color: 0xffffff, radius: e?.mega ? 9 : 4.5, dur: 0.3, thick: 0.08 });
      fx.callout3D(p, (e?.mega ? 'MEGA +' : 'GRAZE +') + (e?.amount ?? 10), e?.mega ? 'gold' : 'graze', { rise: 2.6 });
      fx.flash(0xffffff, e?.mega ? 0.22 : 0.08, 0.2);
    });
    G.on('kart:tier', (e) => {
      if (!fx.auto) return; const p = kp(); if (!p) return;
      spawnPreset('tierUp', p, null, 20 + (e?.tier || 1) * 10, { tier: e?.tier || 1 });
      fx.shockwave(p, { color: TIER_COL[e?.tier || 1], radius: 3 + (e?.tier || 1), dur: 0.3, thick: 0.1 });
    });
    G.on('kart:perfect', () => { if (!fx.auto) return; const p = kp(); fx.flash(0x33f6ff, 0.35, 0.3); if (p) { spawnPreset('mote', p, null, 40, { scale: 1.5 }); fx.callout3D(p, 'PERFECT', 'flux', { rise: 3 }); } });
    G.on('kart:dash', () => { if (!fx.auto) return; const p = kp(); if (p) spawnPreset('dashTrail', p, null, 24, null); });
    G.on('kart:comet', (e) => {
      if (!fx.auto) return; const p = kp(); if (!p) return;
      if (e?.phase === 'launch') { spawnPreset('gold', p, null, 50, { scale: 0.8 }); fx.shockwave(p, { color: 0xffc93a, radius: 10, dur: 0.4 }); }
      else if (e?.phase === 'impact') {
        const bp = G.boss?.root ? G.boss.root.getWorldPosition(_v3) : p;
        spawnPreset('comet', p, null, 220, null);
        fx.shockwave(p, { color: 0xffc93a, radius: 34, dur: 0.7, thick: 0.08 });
        fx.shockwave(p, { color: 0xffffff, radius: 18, dur: 0.45, normal: _v2.copy(G.camera.position).sub(p).normalize(), lift: 1 });
        // warm short flash + radial screen shock instead of a white-out (the boss getting hit must stay visible)
        fx.flash(0xffd27a, 0.3, 0.25); fx.bloomPulse(0.5, 0.5);
        G.post?.caPulse?.(0.006, 2.5);
        if (bp !== p) G.post?.shockAt?.(bp, 0.6);
        if (bp !== p) spawnPreset('gold', bp, null, 80, { scale: 1.5 });
      }
    });
    G.on('kart:wreck', () => { if (!fx.auto) return; const p = kp(); if (!p) return; spawnPreset('explosion', p, null, 140, null); fx.shockwave(p, { color: 0xff6a1a, radius: 14 }); fx.shards(p, 60, 0x33f6ff, { speed: 0.7, size: 0.5, heat: 0.6 }); fx.flash(0xff6a1a, 0.3, 0.35); });
    G.on('kart:land', (e) => { if (!fx.auto || !(e?.airTime > 0.35)) return; const p = kp(); if (p) { spawnPreset('dust', p, null, 14, null); fx.shockwave(p, { color: 0x33f6ff, radius: 5, dur: 0.3, alpha: 0.7 }); } });
    G.on('boss:stagger', (e) => {
      if (!fx.auto || !e?.on) return;
      const b = G.boss?.root; if (!b) return;
      b.getWorldPosition(_v3); _v3.y += 6;
      spawnPreset('gold', _v3, null, 120, { scale: 1.8 });
      fx.shockwave(_v3, { color: 0xffc93a, radius: 40, dur: 0.8, thick: 0.06 });
      fx.bloomPulse(0.4, 0.4); fx.flash(0xffc93a, 0.18, 0.3);
    });
    G.on('boss:castEnd', (e) => { if (!fx.auto || !e?.interrupted) return; const b = G.boss?.root; if (!b) return; b.getWorldPosition(_v3); _v3.y += 8; spawnPreset('lightning', _v3, null, 60, { color: 0xc04bff, scale: 2 }); fx.shockwave(_v3, { color: 0xc04bff, radius: 24, dur: 0.5, normal: _v2.copy(G.camera.position).sub(_v3).normalize() }); });
    G.on('boss:phase', () => { if (!fx.auto) return; fx.flash(0xfff0d8, 0.15, 0.4); fx.bloomPulse(0.3, 0.6); });
    G.on('boss:enrage', (e) => { if (sky.mesh) sky.uniforms.uEnrage.value = e?.level >= 1 ? 1 : 0; });
    G.on('fight:start', () => { sky.uniforms.uEnrage.value = 0; });
  }

  // -------------------------------------------------------------------- init
  function init() {
    const scene = G.scene;
    const tier = G.quality?.tier || 'high';
    glow = new GlowLayer(3000, false); glow.cap = qualityCap(3000);
    smoke = new GlowLayer(400, true);
    heads = new GlowLayer(BOLT_MAX, false); heads.mesh.renderOrder = 8;
    scene.add(smoke.mesh, glow.mesh, heads.mesh);

    // ribbons
    ribGeo = new THREE.BufferGeometry();
    const nv = RIB_N * RIB_P * 2;
    ribGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
    ribGeo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(nv * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const side = new Float32Array(nv); for (let i = 0; i < nv; i++) side[i] = i & 1 ? -1 : 1;
    ribGeo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    const idx = [];
    for (let r = 0; r < RIB_N; r++) for (let i = 0; i < RIB_P - 1; i++) { const a = (r * RIB_P + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    ribGeo.setIndex(idx);
    for (let i = 0; i < nv; i++) ribGeo.attributes.position.array[i * 3 + 1] = -9999;
    ribMesh = new THREE.Mesh(ribGeo, new THREE.ShaderMaterial({ vertexShader: RIB_VS, fragmentShader: RIB_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    ribMesh.frustumCulled = false; ribMesh.renderOrder = 7;
    ribs = []; for (let i = 0; i < RIB_N; i++) ribs.push(new Ribbon(i));
    for (let i = 0; i < BOLT_MAX; i++) bolts.push({ active: false });
    for (let i = 0; i < LIGHT_MAX; i++) lightnings.push({ active: false, ribs: [null, null, null] });
    scene.add(ribMesh);

    // text
    const tg = new THREE.InstancedBufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,.5,0]), 3));
    tg.setIndex([0, 1, 2, 0, 2, 3]);
    const ta = (n, s) => tg.setAttribute(n, new THREE.InstancedBufferAttribute(new Float32Array(TXT_I * s), s).setUsage(THREE.DynamicDrawUsage));
    ta('iPos', 3); ta('iUv', 4); ta('iCA', 4); ta('iOff', 2); tg.instanceCount = 0;
    txt = new THREE.Mesh(tg, new THREE.ShaderMaterial({ uniforms: { uAtlas: { value: buildAtlas() }, uScrH: { value: 1 } }, vertexShader: TXT_VS, fragmentShader: TXT_FS, transparent: true, depthWrite: false, depthTest: false }));
    txt.frustumCulled = false; txt.renderOrder = 20;
    for (let i = 0; i < TXT_MAX; i++) txtState.push({ active: false, t: 0 });
    scene.add(txt);

    // rings
    const rgeo = new THREE.PlaneGeometry(1, 1); rgeo.rotateX(-Math.PI / 2); // lies in XZ, normal +Y
    rgeo.setAttribute('iCT', new THREE.InstancedBufferAttribute(new Float32Array(RING_MAX * 4), 4).setUsage(THREE.DynamicDrawUsage));
    rgeo.setAttribute('iTA', new THREE.InstancedBufferAttribute(new Float32Array(RING_MAX * 2), 2).setUsage(THREE.DynamicDrawUsage));
    // uv on rotated plane: position.xy for shader -> use x,z; remap in shader via position.xz
    rings = new THREE.InstancedMesh(rgeo, new THREE.ShaderMaterial({ vertexShader: RING_VS.replace('vUv = position.xy * 2.0', 'vUv = position.xz * 2.0'), fragmentShader: RING_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), RING_MAX);
    rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage); rings.frustumCulled = false; rings.count = 0; rings.renderOrder = 6;
    for (let i = 0; i < RING_MAX; i++) ringState.push({ active: false });
    scene.add(rings);

    // shards
    const sgeo = new THREE.TetrahedronGeometry(0.5);
    sgeo.setAttribute('iCol', new THREE.InstancedBufferAttribute(new Float32Array(SHARD_MAX * 3), 3));
    sgeo.setAttribute('iHeat', new THREE.InstancedBufferAttribute(new Float32Array(SHARD_MAX), 1).setUsage(THREE.DynamicDrawUsage));
    shards = new THREE.InstancedMesh(sgeo, new THREE.ShaderMaterial({ vertexShader: SHARD_VS, fragmentShader: SHARD_FS }), SHARD_MAX);
    shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage); shards.frustumCulled = false; shards.count = 0;
    sh = { n: 0, p: new Float32Array(SHARD_MAX * 3), v: new Float32Array(SHARD_MAX * 3), q: new Float32Array(SHARD_MAX * 4), w: new Float32Array(SHARD_MAX), life: new Float32Array(SHARD_MAX), max: new Float32Array(SHARD_MAX), size: new Float32Array(SHARD_MAX), g: new Float32Array(SHARD_MAX), heat0: new Float32Array(SHARD_MAX) };
    scene.add(shards);

    // speed lines (camera-space)
    const SPD_N = 60;
    const sg = new THREE.InstancedBufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,.5,0]), 3)); sg.setIndex([0, 1, 2, 0, 2, 3]);
    const seeds = new Float32Array(SPD_N * 4); for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
    sg.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seeds, 4)); sg.instanceCount = SPD_N;
    speed = new THREE.Mesh(sg, new THREE.ShaderMaterial({ uniforms: { uTime: fx.uniforms.uTime, uInt: { value: 0 }, uCol: { value: new THREE.Color(0.75, 0.95, 1.0) } }, vertexShader: SPD_VS, fragmentShader: SPD_FS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    speed.frustumCulled = false; speed.visible = false; speed.renderOrder = 19;
    scene.add(speed);

    // sky
    sky.uniforms = { uTime: { value: 0 }, uBeat: { value: 0 }, uEnrage: { value: 0 }, uFlash: { value: 0 }, uDawn: { value: 0 }, uSpeed: { value: 0 },
      uFlashDir: { value: new V3(0, 0.3, -1).normalize() }, uAxis: { value: new V3(0, 0, -1) } };
    sky.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMaterial('title'));
    sky.mesh.frustumCulled = false; sky.mesh.renderOrder = -1000; sky.mesh.visible = false;
    scene.add(sky.mesh);
    // ambient points
    const AMAX = 2000, ag = new THREE.BufferGeometry();
    const seedA = new Float32Array(AMAX * 4); for (let i = 0; i < seedA.length; i++) seedA[i] = rnd();
    ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AMAX * 3), 3)); ag.setAttribute('aSeed', new THREE.BufferAttribute(seedA, 4));
    amb = new THREE.Points(ag, new THREE.ShaderMaterial({ uniforms: { uTime: sky.uniforms.uTime, uMode: { value: 0 }, uPx: { value: 800 }, uSpeed: sky.uniforms.uSpeed, uCam: { value: new V3() }, uAxis: sky.uniforms.uAxis, uBox: { value: 140 }, uR: { value: 800 } },
      vertexShader: AMB_VS, fragmentShader: AMB_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    amb.frustumCulled = false; amb.visible = false; amb.renderOrder = -900;
    scene.add(amb);

    bindEvents();
  }

  function update(dt) {
    glow.cap = qualityCap(3000);
    glow.update(dt); smoke.update(dt);
    updateBolts(dt); updateLightning(dt); updateShards(dt);
    fx.uniforms.uTime.value += dt;
  }

  function render(realDt) {
    realTime += realDt;
    const cam = G.camera;
    const beat = G.audio?.beat ?? ((realTime * 2) % 1);
    fx.uniforms.uBeat.value = beat;
    // sky follows the camera
    if (sky.mesh.visible) {
      sky.mesh.position.copy(cam.position);
      const r = Math.min(900, (cam.far || 1000) * 0.9); sky.mesh.scale.setScalar(r); amb.material.uniforms.uR.value = r * 0.92;
      const u = sky.uniforms; u.uTime.value = realTime; u.uBeat.value = beat;
      u.uSpeed.value = Math.min(1, (G.kart?.speed || 0) / 50);
      if (sky.name === 'storm') { // random lightning every 4-9 s
        stormNext -= realDt;
        if (stormNext <= 0) { stormNext = rr(4, 9); sky.lightning(); }
      }
      if (stormFlash > 0) {
        stormFlash = Math.max(0, stormFlash - realDt / 0.35);
        u.uFlash.value = stormFlash > 0.75 ? 1 : stormFlash * stormFlash * (0.7 + 0.3 * rnd());
      } else u.uFlash.value = 0;
      // exposure kick (+0.3 for ~80ms), delta-based
      const want = stormFlash > 0.77 ? 0.3 : 0;
      if (G.renderer && want !== expAdd) { G.renderer.toneMappingExposure += want - expAdd; expAdd = want; }
      amb.material.uniforms.uCam.value.copy(cam.position);
      amb.material.uniforms.uPx.value = (G.renderer?.domElement?.height || 720) * 0.5 / Math.tan((cam.userData.vfov || cam.fov || 70) * Math.PI / 360);
    }
    // particles upload
    glow.upload(); smoke.upload(); writeHeads();
    writeRibbons();
    // text
    txt.material.uniforms.uScrH.value = 2 * Math.tan((cam.userData.vfov || cam.fov || 70) * Math.PI / 360);
    writeText(realDt);
    // rings
    let rc = 0;
    const aCT = rings.geometry.attributes.iCT.array, aTA = rings.geometry.attributes.iTA.array;
    for (const r of ringState) {
      if (!r.active) continue;
      r.t += realDt;
      const t = r.t / r.dur; if (t >= 1) { r.active = false; continue; }
      const e = 1 - Math.pow(1 - t, 2.2);
      const rad = r.r0 + (r.radius - r.r0) * e;
      _v.set(r.nx, r.ny, r.nz); _q.setFromUnitVectors(_up, _v);
      _s.set(rad * 2, rad * 2, rad * 2); _v2.set(r.x, r.y, r.z);
      _m.compose(_v2, _q, _s); rings.setMatrixAt(rc, _m);
      aCT[rc * 4] = r.cr; aCT[rc * 4 + 1] = r.cg; aCT[rc * 4 + 2] = r.cb; aCT[rc * 4 + 3] = t;
      aTA[rc * 2] = r.thick; aTA[rc * 2 + 1] = r.alpha; rc++;
    }
    rings.count = rc;
    if (rc) { rings.instanceMatrix.needsUpdate = true; rings.geometry.attributes.iCT.needsUpdate = true; rings.geometry.attributes.iTA.needsUpdate = true; }
    writeShards();
    // speed lines: auto from kart speed unless set explicitly this frame
    const auto = G.kart ? Math.max(0, Math.min(1, ((G.kart.speed || 0) - 34) / 16)) : 0;
    const tgtS = Math.max(speedTarget, auto);
    speedCur += (tgtS - speedCur) * Math.min(1, realDt * 6);
    speed.material.uniforms.uInt.value = speedCur;
    { const pal = G.track?.uniforms?.uPalette?.value; const c = speed.material.uniforms.uCol.value;   // arena accent tint
      if (pal && pal[1]) c.copy(pal[1]).lerp(_c2.setRGB(1, 1, 1), 0.45).multiplyScalar(0.85); }
    speed.visible = speedCur > 0.02 && G.quality?.tier !== 'low';
    // flash overlay (DOM fallback)
    if (flashA > 0) {
      flashA = Math.max(0, flashA - realDt * (fx._flashDecay || 3));
      if (!flashEl) { flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;mix-blend-mode:screen;opacity:0'; document.body.appendChild(flashEl); }
      flashEl.style.background = `rgb(${flashR * 255 | 0},${flashG * 255 | 0},${flashB * 255 | 0})`;
      flashEl.style.opacity = flashA.toFixed(3);
    }
    // bloom pulse (delta-based)
    if (G.bloomPass && (bloomPeak > 0 || bloomAdd > 0)) {
      bloomT += realDt;
      const want = bloomPeak > 0 ? bloomPeak * Math.max(0, 1 - bloomT / bloomDur) : 0;
      if (want <= 0) bloomPeak = 0;
      G.bloomPass.strength += want - bloomAdd; bloomAdd = want;
    }
  }

  function reset() {
    glow.clear(); smoke.clear(); sh.n = 0;
    for (const b of bolts) { b.active = false; }
    for (const r of ribs) { if (!r.handle || !userRibs.has(r.handle)) r.active = false; }
    for (const L of lightnings) L.active = false;
    for (const t of txtState) t.active = false;
    for (const r of ringState) r.active = false;
    flashA = 0; speedTarget = 0;
  }
  fx.reset = reset;
  fx.stats = () => ({ particles: glow.n, smoke: smoke.n, bolts: bolts.filter(b => b.active).length, shards: sh.n, text: txt.geometry.instanceCount, rings: rings.count });

  G.register('fx', { init, update, render, reset });
}
