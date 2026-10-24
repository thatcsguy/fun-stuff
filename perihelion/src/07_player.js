// =====================================================================
// 07_player.js: the Orrery Knight. Model, orbit motion (Reverse / Shift),
// ghost trail, Strike, Anchor + constellation, Comet, Eclipse, Aegis,
// Supernova, damage / heal / death, stats.  Owner: gameplay.
// =====================================================================
(() => {
  const T3 = (typeof THREE !== 'undefined') ? THREE : G.THREE;
  const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;

  // ------------------------------------------------ tunable constants (spec 2.2 / 2.3)
  const K = {
    maxHp: 100, omega: 0.60, startRing: 1, startTheta: -PI / 2, startDir: 1, hitRadius: 0.55, hitIframes: 0.8,
    reverseDur: 0.20, reverseLock: 0.15,
    shiftDur: 0.28, shiftIStart: 0.06, shiftIEnd: 0.20, shiftLock: 0.35, hopHeight: 0.85, bumpLock: 0.12,
    fallDur: 0.65,
    ghostAhead: 1.5, ghostDots: 18,
    ringMul: [1.35, 1.0, 0.75], behindMul: 1.5, behindHalf: 60 * DEG, constellationMul: 1.15, staggerMul: 1.3, staggerDur: 3,
    strikeInterval: 0.45, strikeFlight: 0.25, strikeDmg: 12, strikeMeter: 1.2, strikeCone: 70 * DEG,
    anchorCharges: 2, anchorRecharge: 9, anchorMax: 3, anchorLife: 30, anchorContact: 0.7, anchorCd: 1.5,
    anchorDmg: 26, anchorHeal: 5, anchorMeter: 3, meridianHealMul: 2,
    cometCharge: 1.2, cometBase: 60, cometBonus: 240, cometMeter: 10, cometMeterBehind: 15, cometCd: 7, cometTap: 0.1,
    cometEmpMul: 1.5, cometFlight: 0.32, cometPierceR: 1.0,
    eclipseCd: 14, eclipseHalt: 1.5, eclipseInterruptCd: 7, eclipseMeter: 15, empowerDur: 6,
    aegisCd: 24, aegisDur: 1.0, aegisEmpDur: 1.8, aegisPerfect: 0.3, aegisReflectMul: 3, aegisPerfectMul: 4.5,
    aegisMinReflect: 40, aegisMeter: 12, aegisPerfectMeter: 20, aegisEmpMul: 1.5,
    novaDur: 3.0, novaDmg: 900, novaEmpMul: 1.5, novaHzSpeed: 0.3, novaAfterInvuln: 1.0, novaThrow: 2.0, novaImpact: 2.35,
    meterMax: 100,
    // spec lists per-action gains (+1.2 per Strike hit etc.) AND a target of one Supernova per 60-80 s; with the raw gains a
    // decent player fills the meter in ~20-25 s, so every gain is multiplied by this (tuning knob, relative gains kept)
    meterScale: 0.3,
  };

  const RINGS = () => G.RINGS || [5.5, 9.0, 12.5];
  const wrap = (a) => a - TAU * Math.floor((a + PI) / TAU);
  const angDiff = (a, b) => wrap(a - b);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const polar = (r, th, y = 0, out) => G.polar(r, th, y, out);   // single source of the polar convention (theta ccw from +x toward -z)
  const ringR = (f) => { const R = RINGS(); return R[0] + (R[2] - R[0]) / 2 * f; };
  const logE = (w, e) => { try { G.log && G.log.error ? G.log.error(w, e) : console.error(w, e); } catch (_) { console.error(w, e); } };
  const fx = (name, ...a) => { try { const f = G.fx && G.fx[name]; return f ? f.apply(G.fx, a) : undefined; } catch (e) { logE('fx.' + name, e); } };
  const sfx = (name, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(name, o); } catch (e) { logE('sfx.' + name, e); } };
  const cam = (name, ...a) => { try { const f = G.cam && G.cam[name]; return f ? f.apply(G.cam, a) : undefined; } catch (e) { logE('cam.' + name, e); } };
  const emit = (n, d) => { try { G.emit && G.emit(n, d); } catch (e) { logE('emit.' + n, e); } };
  const PLAY = () => G.state === 'fight' || G.state === 'practice';
  const boss = () => (G.combat && G.combat.boss) || null;
  const GOLD = '#ffc94d', GOLD_HOT = '#fff1c2';

  // ------------------------------------------------------------ state
  const S = {
    hp: K.maxHp, maxHp: K.maxHp, ring: 1, ringF: 1, theta: K.startTheta, dir: 1, speedMul: 1, halted: false, invuln: false,
    iframes: false, shifting: false, alive: true, meter: 0, empowered: false, behind: false, constellation: false,
    pos: new T3.Vector3(), model: null, v: 0, novaActive: false, aegisActive: false, y: 0,
  };
  const CD = {
    anchor: { charges: K.anchorCharges, t: 0, max: K.anchorCharges, dur: K.anchorRecharge },
    comet: { t: 0, charge: 0, holding: false, dur: K.cometCd, empowered: false },
    eclipse: { t: 0, dur: K.eclipseCd },
    aegis: { t: 0, dur: K.aegisCd },
    nova: { ready: false },
  };
  const stats = { damageBySkill: {}, hitsTaken: 0, damageTaken: 0, perfectAegis: 0, interrupts: 0, deaths: 0, uses: {}, reflects: 0, pulses: 0, healed: 0 };
  // movement internals
  const M = { turn: null, revLock: 0, revBuf: false, hop: null, shiftLock: 0, shiftBuf: 0, haltT: 0, haltF: 1, hitT: 0,
    speedT: 0, empT: 0, aegisT: 0, aegisAge: 0, aegisEmp: false, postNovaT: 0, strikeT: 0.2, nova: null, deathT: 0, bump: 0,
    runPhase: 0, faceAng: 0, lean: 0, skid: 0, glint: 0, clock: 0, cometBehindWas: false };

  // ============================================================ MODEL
  let root, body, legs = [], arms = [], halo, haloBead, headGlint, handStar, capeMesh, capePts = [], capePrev = [];
  let pointer = null, decal, beacon, ghostDots, ghostFig, adjMarks = [], aegisBubble, coronaSprite, cometLine, cometOrb, novaStar, layerP, layerFx;
  const goldMat = () => new T3.MeshStandardMaterial({ color: 0xffd98a, metalness: 0.92, roughness: 0.22, emissive: 0x6a4410, emissiveIntensity: 0.7, envMapIntensity: 1.4 });
  function glowTex() {
    if (G.tex && G.tex.glow) return G.tex.glow;
    if (glowTex.t) return glowTex.t;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    glowTex.t = new T3.CanvasTexture(c); return glowTex.t;
  }
  function sprite(color, size, opacity = 1) {
    const s = new T3.Sprite(new T3.SpriteMaterial({ map: glowTex(), color: new T3.Color(color), transparent: true, opacity, blending: T3.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(size); return s;
  }
  function coronaTex() {
    if (coronaTex.t) return coronaTex.t;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(4,2,14,1)'); g.addColorStop(0.42, 'rgba(4,2,14,1)'); g.addColorStop(0.47, 'rgba(255,236,180,1)');
    g.addColorStop(0.55, 'rgba(255,200,90,.55)'); g.addColorStop(1, 'rgba(255,170,60,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    coronaTex.t = new T3.CanvasTexture(c); return coronaTex.t;
  }

  function buildKnight() {
    root = new T3.Group(); root.name = 'knight';
    body = new T3.Group(); root.add(body);
    const gold = goldMat();
    const dark = new T3.MeshStandardMaterial({ color: 0x1a1640, metalness: 0.6, roughness: 0.45, emissive: 0x0d0a2a, emissiveIntensity: 0.6 });
    const hot = new T3.MeshBasicMaterial({ color: new T3.Color(GOLD_HOT).multiplyScalar(1.8) });
    const rimMat = new T3.MeshBasicMaterial({ color: new T3.Color(GOLD).multiplyScalar(0.9), side: T3.BackSide, transparent: true, opacity: 0.55, blending: T3.AdditiveBlending, depthWrite: false });
    // dark inverted-hull outline: keeps the gold figure readable against the gold tracks
    const inkMat = new T3.MeshBasicMaterial({ color: 0x07041a, side: T3.BackSide });
    const add = (geo, mat, x, y, z, parent = body) => { const m = new T3.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    const ink = (m, k = 1.18) => { const o = new T3.Mesh(m.geometry, inkMat); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale).multiplyScalar(k); o.userData.sharedGeo = true; m.parent.add(o); return o; };
    // legs (pivot at hip)
    for (const s of [-1, 1]) {
      const pivot = new T3.Group(); pivot.position.set(0, 0.47, s * 0.08); body.add(pivot);
      ink(add(new T3.CapsuleGeometry(0.065, 0.26, 4, 8), dark, 0, -0.2, 0, pivot), 1.3);
      ink(add(new T3.CylinderGeometry(0.075, 0.06, 0.16, 8), gold, 0, -0.34, 0, pivot), 1.25);     // greave
      const boot = add(new T3.CapsuleGeometry(0.05, 0.08, 3, 8), gold, 0.03, -0.44, 0, pivot); boot.rotation.z = Math.PI / 2; ink(boot, 1.3);
      legs.push(pivot);
    }
    // torso: tapered cuirass + skirt
    const torso = add(new T3.CylinderGeometry(0.17, 0.12, 0.34, 10), gold, 0, 0.67, 0);
    torso.scale.z = 0.8; ink(torso, 1.16);
    add(new T3.CylinderGeometry(0.13, 0.19, 0.14, 10), dark, 0, 0.48, 0).scale.z = 0.85;
    const rimT = add(new T3.CylinderGeometry(0.17, 0.12, 0.34, 10), rimMat, 0, 0.67, 0); rimT.scale.set(1.16, 1.06, 0.95);
    // breastplate sigil (a small star)
    const star = add(new T3.OctahedronGeometry(0.05, 0), hot, 0.14, 0.72, 0); star.scale.set(0.4, 1, 1);
    // pauldrons
    for (const s of [-1, 1]) {
      const p = add(new T3.SphereGeometry(0.095, 12, 8), gold, 0, 0.82, s * 0.19); p.scale.set(1, 0.75, 1); ink(p, 1.2);
      const pivot = new T3.Group(); pivot.position.set(0, 0.8, s * 0.22); body.add(pivot);
      add(new T3.CapsuleGeometry(0.045, 0.2, 4, 8), dark, 0, -0.14, 0, pivot);
      add(new T3.CylinderGeometry(0.055, 0.05, 0.1, 8), gold, 0, -0.24, 0, pivot);   // vambrace
      arms.push(pivot);
    }
    // helmet
    const helm = add(new T3.SphereGeometry(0.12, 16, 12), gold, 0, 0.98, 0); helm.scale.set(1, 1.1, 0.95); ink(helm, 1.17);
    const rimH = add(new T3.SphereGeometry(0.12, 12, 10), rimMat, 0, 0.98, 0); rimH.scale.set(1.2, 1.28, 1.15);
    add(new T3.BoxGeometry(0.03, 0.022, 0.16), hot, 0.11, 0.98, 0);                          // visor slit (faces +x local = forward)
    const crest = add(new T3.BoxGeometry(0.2, 0.09, 0.02), gold, -0.03, 1.12, 0); crest.rotation.z = 0.25;
    // orrery halo
    halo = new T3.Group(); halo.position.set(0, 1.24, 0); body.add(halo);
    const hm = new T3.MeshBasicMaterial({ color: new T3.Color(GOLD).multiplyScalar(1.5) });
    const r1 = new T3.Mesh(new T3.TorusGeometry(0.17, 0.011, 6, 40), hm); r1.rotation.x = PI / 2;
    const r2 = new T3.Mesh(new T3.TorusGeometry(0.125, 0.009, 6, 32), hm); r2.rotation.x = PI / 2 - 0.5;
    const core = new T3.Mesh(new T3.SphereGeometry(0.035, 10, 8), new T3.MeshBasicMaterial({ color: new T3.Color(GOLD_HOT).multiplyScalar(2) }));
    haloBead = new T3.Mesh(new T3.SphereGeometry(0.028, 8, 6), new T3.MeshBasicMaterial({ color: new T3.Color('#bfe6ff').multiplyScalar(1.6) }));
    halo.add(r1, r2, core, haloBead);
    halo.userData.r1 = r1; halo.userData.r2 = r2;
    // hand star (throws Strike bolts from here)
    handStar = sprite(GOLD_HOT, 0.32, 0.9); handStar.position.set(0.06, -0.27, 0); arms[1].add(handStar);
    headGlint = sprite('#ffffff', 0.7, 0); headGlint.position.set(0.05, 1.05, 0); body.add(headGlint);
    // the model's "forward" is +x; we rotate root so +x points along motion
    root.traverse(o => { if (o.isMesh) o.castShadow = false; });
    body.scale.setScalar(1.15);       // a touch over spec size: readable at phone distance
    return root;
  }
  function buildCape() {
    const N = 9;
    capePts = []; capePrev = [];
    for (let i = 0; i < N; i++) { capePts.push(new T3.Vector3()); capePrev.push(new T3.Vector3()); }
    const geo = new T3.BufferGeometry();
    const pos = new Float32Array(N * 2 * 3), col = new Float32Array(N * 2 * 4), idx = [];
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1);
      const c0 = new T3.Color(GOLD).lerp(new T3.Color('#ff8a3a'), k * 0.6).multiplyScalar(1.25 - k * 0.5);
      for (let s = 0; s < 2; s++) { const o = (i * 2 + s) * 4; col[o] = c0.r; col[o + 1] = c0.g; col[o + 2] = c0.b; col[o + 3] = 1 - k * 0.85; }
      if (i < N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    geo.setAttribute('position', new T3.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T3.BufferAttribute(col, 4));
    geo.setIndex(idx);
    capeMesh = new T3.Mesh(geo, new T3.MeshBasicMaterial({ vertexColors: true, transparent: true, side: T3.DoubleSide, depthWrite: false }));
    capeMesh.frustumCulled = false; capeMesh.renderOrder = 9;
    return capeMesh;
  }
  function buildDecal() {
    const g = new T3.PlaneGeometry(2.2, 2.2); g.rotateX(-PI / 2);
    const m = new T3.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      uniforms: { uFrac: { value: 1 }, uTime: { value: 0 }, uHit: { value: 0 }, uBehind: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float uFrac, uTime, uHit, uBehind;
        void main(){ vec2 q = vUv - 0.5; float r = length(q) * 2.0; if (r > 1.0) discard;
          float ang = abs(atan(q.x, q.y)) / 3.14159265;          // 0 at the camera side, 1 at the far side
          float mark = smoothstep(0.40, 0.43, r) * (1.0 - smoothstep(0.49, 0.52, r));
          float band = smoothstep(0.60, 0.62, r) * (1.0 - smoothstep(0.70, 0.72, r));
          float hp = band * step(ang, uFrac * 0.5 + 0.001) ;
          float bg = band * 0.22 * step(ang, 0.5);
          float soft = (1.0 - smoothstep(0.0, 0.42, r)) * 0.05;
          float shade = (1.0 - smoothstep(0.18, 0.44, r)) * 0.6;
          vec3 gold = vec3(1.0, 0.78, 0.3);
          vec3 hpc = mix(vec3(1.0, 0.25, 0.2), vec3(1.0, 0.86, 0.45), smoothstep(0.2, 0.5, uFrac));
          vec3 col = gold * (mark * (1.2 + 0.6 * uBehind) + soft) + hpc * hp * 1.6 + vec3(0.1, 0.08, 0.2) * bg;
          float a = mark * 0.85 + hp * 0.95 + bg + soft + shade;
          col = mix(col, vec3(0.02, 0.01, 0.06), shade / max(a, 0.001));
          col = mix(col, vec3(1.6, 0.4, 0.3), uHit * mark);
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0)); }`,
    });
    const d = new T3.Mesh(g, m); d.renderOrder = 8; d.frustumCulled = false;
    return d;
  }
  // constant screen-size "you are here" chevron over the knight: readable on a phone at any arena scale
  function buildPointer() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.lineJoin = 'round';
    x.beginPath(); x.moveTo(10, 14); x.lineTo(54, 14); x.lineTo(32, 50); x.closePath();
    x.lineWidth = 10; x.strokeStyle = 'rgba(6,4,18,0.9)'; x.stroke();
    const g = x.createLinearGradient(0, 14, 0, 50); g.addColorStop(0, '#fff6d6'); g.addColorStop(1, '#ffb52e');
    x.fillStyle = g; x.fill();
    const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace;
    const m = new T3.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false, fog: false });
    const sp = new T3.Sprite(m); sp.center.set(0.5, 0); sp.renderOrder = 45; sp.frustumCulled = false;
    return sp;
  }
  function buildBeacon() {
    const g = new T3.CylinderGeometry(0.06, 0.32, 3.2, 12, 1, true); g.translate(0, 1.6, 0);
    const m = new T3.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide,
      uniforms: { uA: { value: 0.35 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float uA; void main(){ float a = pow(1.0 - vUv.y, 2.2) * uA; gl_FragColor = vec4(vec3(1.0,0.8,0.4)*a, a); }',
    });
    const b = new T3.Mesh(g, m); b.renderOrder = 2; b.frustumCulled = false; return b;
  }
  function buildGhost() {
    const geo = new T3.CircleGeometry(0.085, 10); geo.rotateX(-PI / 2);
    const mat = new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, blending: T3.AdditiveBlending });
    ghostDots = new T3.InstancedMesh(geo, mat, K.ghostDots);
    ghostDots.instanceMatrix.setUsage(T3.DynamicDrawUsage);
    for (let i = 0; i < K.ghostDots; i++) ghostDots.setColorAt(i, new T3.Color(GOLD));
    ghostDots.frustumCulled = false; ghostDots.renderOrder = 9;
    const fig = new T3.Group();
    const gm = new T3.MeshBasicMaterial({ color: new T3.Color(GOLD), transparent: true, opacity: 0.28, blending: T3.AdditiveBlending, depthWrite: false });
    const b1 = new T3.Mesh(new T3.CapsuleGeometry(0.13, 0.5, 4, 8), gm); b1.position.y = 0.55;
    const b2 = new T3.Mesh(new T3.SphereGeometry(0.11, 10, 8), gm); b2.position.y = 1.0;
    const b3 = new T3.Mesh(new T3.TorusGeometry(0.16, 0.012, 6, 28), gm); b3.position.y = 1.24; b3.rotation.x = PI / 2;
    fig.add(b1, b2, b3); fig.userData.mat = gm;
    ghostFig = fig;
    for (let i = 0; i < 2; i++) {
      const g2 = new T3.RingGeometry(0.28, 0.4, 24); g2.rotateX(-PI / 2);
      const mm = new T3.Mesh(g2, new T3.MeshBasicMaterial({ color: new T3.Color(GOLD), transparent: true, opacity: 0.5, blending: T3.AdditiveBlending, depthWrite: false }));
      const sp = sprite(GOLD, 0.9, 0.35); sp.position.y = 0.55;
      const grp = new T3.Group(); grp.add(mm, sp); grp.visible = false; grp.userData.ring = mm; grp.userData.sp = sp;
      adjMarks.push(grp);
    }
  }
  function buildAegis() {
    const m = new T3.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T3.AdditiveBlending,
      uniforms: { uA: { value: 0 }, uT: { value: 0 }, uPerf: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform float uA, uT, uPerf;
        void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
          float hex = step(0.92, fract(vP.y * 9.0 + uT * 2.0)) * 0.4 + step(0.94, fract(atan(vP.x, vP.z) * 3.0)) * 0.3;
          vec3 c = mix(vec3(1.0, 0.75, 0.3), vec3(1.4, 1.3, 1.1), uPerf);
          float a = (f * 1.2 + hex * f + 0.06) * uA; gl_FragColor = vec4(c * a * 1.6, a); }`,
    });
    aegisBubble = new T3.Mesh(new T3.IcosahedronGeometry(0.95, 2), m); aegisBubble.visible = false; aegisBubble.renderOrder = 10;
    coronaSprite = new T3.Sprite(new T3.SpriteMaterial({ map: coronaTex(), transparent: true, depthWrite: false, opacity: 0 }));
    coronaSprite.scale.setScalar(1.9); coronaSprite.visible = false; coronaSprite.renderOrder = 11;
  }
  function buildComet() {
    const g = new T3.PlaneGeometry(1, 1); g.rotateX(-PI / 2); g.translate(0.5, 0, 0);
    const m = new T3.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide,
      uniforms: { uT: { value: 0 }, uOn: { value: 0 }, uC: { value: 0 }, uLen: { value: 8 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float uT, uOn, uC, uLen;
        void main(){ float w = 1.0 - abs(vUv.y - 0.5) * 2.0; float dash = step(0.45, fract(vUv.x * uLen * 1.3 - uT * 3.0));
          float a = pow(w, 3.0) * (0.25 + 0.75 * dash) * (0.35 + 0.65 * uC) * (0.5 + uOn);
          vec3 c = mix(vec3(0.75, 0.55, 0.25), vec3(1.5, 1.25, 0.7), uOn);
          a *= smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.9, 1.0, vUv.x));
          gl_FragColor = vec4(c * a, a); }`,
    });
    cometLine = new T3.Mesh(g, m); cometLine.visible = false; cometLine.renderOrder = 9; cometLine.frustumCulled = false;
    cometOrb = sprite(GOLD_HOT, 0.4, 1); cometOrb.visible = false;
    novaStar = sprite('#fff6dd', 1, 1); novaStar.visible = false;
  }

  // =========================================================== MOTION
  const canMove = () => S.alive && PLAY() && !S.novaActive && !(G.combat && G.combat.transitioning);
  const canAct = canMove;
  function baseSpeed() { return K.omega * S.speedMul * M.haltF; }
  function computeV() {
    const sp = baseSpeed();
    if (M.turn) { const u = clamp(M.turn.t / M.turn.dur, 0, 1); return -S.dir * Math.cos(PI * u) * sp; }
    return S.dir * sp;
  }
  // predicted angular velocity tf seconds ahead (ignores future input)
  function velAhead(tf) {
    let hf = M.haltF;
    if (M.haltT > 0) hf = tf < M.haltT ? 0 : 1; else if (hf < 1) hf = Math.min(1, hf + tf / 0.15);
    let sm = S.speedMul; if (M.speedT > 0 && tf > M.speedT) sm = 1;
    if (S.novaActive) return 0;
    const sp = K.omega * sm * hf;
    if (M.turn) { const u = clamp((M.turn.t + tf) / M.turn.dur, 0, 1); return -S.dir * Math.cos(PI * u) * sp; }
    return S.dir * sp;
  }
  function predictTheta(tAhead, stepDt = 0.05) {
    let th = S.theta, t = 0;
    while (t < tAhead - 1e-6) { const h = Math.min(stepDt, tAhead - t); th += (velAhead(t) + velAhead(t + h)) * 0.5 * h; t += h; }
    return th;
  }
  function predictRing(tAhead) {
    if (M.hop) { const rem = (M.hop.dur - M.hop.t); return tAhead > rem * 0.5 - 1e-3 ? M.hop.to : S.ring; }
    return S.ring;
  }

  function doReverse() {
    if (!canMove()) return;
    if (M.haltT > 0) { endHalt(); }
    if (M.turn || M.revLock > 0) { M.revBuf = true; return; }
    S.dir = -S.dir;
    M.turn = { t: 0, dur: K.reverseDur };
    M.skid = 1;
    emit('reverse', { dir: S.dir });
  }
  // ring availability: a boss can switch a ring off (e.g. HELIARCH's Event Horizon breaks the outer ring away);
  // a Shift toward a disabled ring bumps like a Shift past the inner/outer edge, and forced shifts avoid it
  const ringOff = [false, false, false];
  function ringOk(i) { return i >= 0 && i < RINGS().length && !ringOff[i]; }
  function disableRing(i, off = true) {
    i = i | 0; if (i < 0 || i >= ringOff.length) return;
    off = !!off; if (ringOff[i] === off) return;
    ringOff[i] = off;
    emit('ringsChanged', { disabled: ringOff.slice() });
  }
  function doShift(delta) {
    if (!canMove()) return;
    if (M.haltT > 0) endHalt();
    if (M.hop || M.shiftLock > 0) { M.shiftBuf = delta; return; }
    const to = S.ring + delta;
    if (!ringOk(to)) {
      M.bump = 1; M.shiftLock = K.bumpLock; sfx('bump'); emit('bump', { delta, ring: S.ring, disabled: to >= 0 && to < RINGS().length });
      return;
    }
    M.hop = { from: S.ring, to, t: 0, dur: K.shiftDur, fall: false };
    S.shifting = true;
    emit('shift', { from: S.ring, to });
  }
  function endHalt() {
    M.haltT = 0; S.halted = false;
  }
  function forceShift(delta, opts = {}) {
    if (!S.alive) return;
    const n = RINGS().length;
    let to = clamp(S.ring + delta, 0, n - 1);
    if (to === S.ring || !ringOk(to)) to = clamp(S.ring - delta, 0, n - 1);
    if (to === S.ring || !ringOk(to)) return;
    const from = M.hop ? (M.hop.t / M.hop.dur < 0.5 ? M.hop.from : M.hop.to) : S.ring;
    M.hop = { from, to, t: 0, dur: opts.fall ? K.fallDur : K.shiftDur, fall: !!opts.fall, forced: true };
    S.ring = from; S.shifting = true;
    M.shiftBuf = 0;
    emit('shift', { from, to, forced: true, fall: !!opts.fall });
    if (opts.fall) { fx('burst', S.pos.clone(), { color: GOLD, count: 14, speed: 3, size: 0.4, life: 0.6 }); }
  }
  function forceReverse() {
    if (!S.alive) return;
    const old = S.dir;
    S.dir = -S.dir; M.turn = null; M.revLock = 0.2; M.revBuf = false;
    S.theta -= old * 0.06;                  // knock back out of contact
    M.bump = 1; M.skid = 1;
    emit('reverse', { dir: S.dir, forced: true });
    sfx('bump');
  }
  function setSpeedMul(m, dur) { S.speedMul = m; M.speedT = dur || 0; }

  function updateMotion(dt) {
    // timers
    if (M.speedT > 0) { M.speedT -= dt; if (M.speedT <= 0) { M.speedT = 0; S.speedMul = 1; } }
    if (M.haltT > 0) { M.haltT -= dt; if (M.haltT <= 0) endHalt(); }
    const hTarget = (M.haltT > 0 || S.novaActive) ? 0 : 1;
    M.haltF += (hTarget - M.haltF) * Math.min(1, dt * (hTarget ? 7 : 16));
    if (Math.abs(M.haltF - hTarget) < 0.01) M.haltF = hTarget;
    // reverse turnaround
    if (M.turn) { M.turn.t += dt; if (M.turn.t >= M.turn.dur) { M.turn = null; M.revLock = K.reverseLock; } }
    else if (M.revLock > 0) { M.revLock -= dt; if (M.revLock <= 0) { M.revLock = 0; if (M.revBuf) { M.revBuf = false; doReverse(); } } }
    // shift hop
    if (M.hop) {
      const h = M.hop; h.t += dt;
      const u = clamp(h.t / h.dur, 0, 1);
      S.ringF = h.from + (h.to - h.from) * smooth(u);
      S.ring = u < 0.5 ? h.from : h.to;
      if (h.fall) S.y = u < 0.45 ? -1.4 * Math.sin(u / 0.45 * PI / 2) : -1.4 * (1 - smooth((u - 0.45) / 0.55)) + Math.sin(clamp((u - 0.45) / 0.55, 0, 1) * PI) * 0.6;
      else S.y = Math.sin(PI * u) * K.hopHeight;
      if (u >= 1) {
        M.hop = null; S.ring = h.to; S.ringF = h.to; S.y = 0; S.shifting = false; M.shiftLock = K.shiftLock;
        fx('burst', S.pos.clone().setY(0.1), { color: GOLD, count: 6, speed: 2, size: 0.3, life: 0.35 });
      }
    } else if (M.shiftLock > 0) {
      M.shiftLock -= dt;
      if (M.shiftLock <= 0) { M.shiftLock = 0; if (M.shiftBuf) { const d = M.shiftBuf; M.shiftBuf = 0; doShift(d); } }
    }
    const shiftI = M.hop && !M.hop.forced && M.hop.t >= K.shiftIStart && M.hop.t <= K.shiftIEnd;
    M.hitT = Math.max(0, M.hitT - dt);
    S.iframes = !!shiftI || M.hitT > 0;
    S.v = computeV();
    if (S.alive && G.state !== 'intro' && G.state !== 'victory' && G.state !== 'dead' && G.state !== 'menu') S.theta = wrap(S.theta + S.v * dt);
  }

  // ======================================================= GHOST TRAIL
  const tmpM = new T3.Matrix4(), tmpQ = new T3.Quaternion(), tmpS = new T3.Vector3(1, 1, 1), tmpV = new T3.Vector3();
  const cGold = new T3.Color(GOLD), cAcc = new T3.Color(), cDim = new T3.Color('#7a6a50');
  function updateGhost(dt) {
    const on = !(G.settings && G.settings.ghost === false) && S.alive && (PLAY() || G.state === 'intro') && !S.novaActive;
    ghostDots.visible = on; ghostFig.visible = on;
    if (!on) { adjMarks.forEach(m => m.visible = false); return; }
    cAcc.set((G.colors && G.colors.accent) || '#5fe3ff');
    const hz = G.hz;
    const N = K.ghostDots, ring = predictRing(0.3);
    const R = RINGS()[ring];
    let danger = false, th = S.theta, t = 0, endTh = th;
    const step = K.ghostAhead / N;
    for (let i = 0; i < N; i++) {
      const tA = (i + 1) * step;
      th += (velAhead(t) + velAhead(tA)) * 0.5 * (tA - t); t = tA;
      const r = predictRing(tA);
      const d = hz && hz.dangerAt ? hz.dangerAt(r, th, tA) : 0;
      if (d > 0.5) danger = true;
      polar(RINGS()[r], th, 0.09, tmpV);
      const s = (0.75 + 0.5 * (i / N)) * (d > 0.5 ? 1.45 : 1) * (M.dotK || 1);
      tmpS.set(s, s, s);
      tmpM.compose(tmpV, tmpQ, tmpS);
      ghostDots.setMatrixAt(i, tmpM);
      ghostDots.setColorAt(i, d > 0.5 ? cAcc : cGold);
      endTh = th;
    }
    ghostDots.instanceMatrix.needsUpdate = true; if (ghostDots.instanceColor) ghostDots.instanceColor.needsUpdate = true;
    const endR = predictRing(K.ghostAhead);
    polar(RINGS()[endR], endTh, 0.02, ghostFig.position);
    ghostFig.rotation.y = root.rotation.y;
    const endDanger = hz && hz.dangerAt ? hz.dangerAt(endR, endTh, K.ghostAhead) > 0.5 : false;
    ghostFig.userData.mat.color.copy(endDanger ? cAcc : cGold);
    ghostFig.userData.mat.opacity = (G.isTouch ? 0.32 : 0.24) + 0.08 * Math.sin(M.clock * 5);
    // adjacent-ring hints while the current path is dangerous
    let k = 0;
    for (const dr of [-1, 1]) {
      const m = adjMarks[k++]; const rr = endR + dr;
      if (!danger || !ringOk(rr)) { m.visible = false; continue; }
      let safe = true;
      if (hz && hz.dangerAt) { let tt = 0, th2 = S.theta; for (let i = 1; i <= 8; i++) { const tA = K.ghostAhead * i / 8; th2 += (velAhead(tt) + velAhead(tA)) * 0.5 * (tA - tt); tt = tA; if (tA > 0.25 && hz.dangerAt(rr, th2, tA) > 0.5) { safe = false; break; } } }
      m.visible = true;
      polar(RINGS()[rr], endTh, 0.08, m.position);
      const col = safe ? cGold : cDim;
      m.userData.ring.material.color.copy(col); m.userData.sp.material.color.copy(col);
      m.userData.ring.material.opacity = safe ? 0.55 + 0.2 * Math.sin(M.clock * 8) : 0.18;
      m.userData.sp.material.opacity = safe ? 0.4 : 0.08;
    }
    S.pathDanger = danger;
  }

  // ============================================================ STRIKE
  const bolts = [];
  let boltMat = null;
  function strikeTarget() {
    const adds = G.adds && G.adds.list;
    if (adds && adds.length) {
      let best = null, bd = 1e9;
      for (const a of adds) {
        if (!a.alive || a.ring !== S.ring) continue;
        const d = angDiff(a.theta, S.theta) * S.dir;
        if (d >= -0.05 && d <= K.strikeCone && d < bd) { bd = d; best = a; }
      }
      if (best) return best;
    }
    const b = boss();
    return b && b.alive && !b.invulnerable ? b : null;
  }
  function targetPos(t, out) {
    if (!t) return out;
    if (t.pos && t.group) return out.copy(t.pos);
    const b = boss(); if (b && b.hitPoint) return out.copy(b.hitPoint(S.theta)); return out.set(0, 2, 0);
  }
  function handPos(out) { out = out || new T3.Vector3(); if (handStar) handStar.getWorldPosition(out); else out.copy(S.pos).setY(S.pos.y + 0.6); return out; }
  function fireStrike() {
    const t = strikeTarget(); if (!t) return;
    if (!boltMat) boltMat = new T3.SpriteMaterial({ map: glowTex(), color: new T3.Color(GOLD_HOT).multiplyScalar(1.6), transparent: true, blending: T3.AdditiveBlending, depthWrite: false });
    const sp = new T3.Sprite(boltMat); sp.scale.setScalar(0.55); sp.userData.sharedMat = true;
    const tail = new T3.Sprite(boltMat); tail.scale.setScalar(0.32); tail.userData.sharedMat = true;
    const from = handPos();
    sp.position.copy(from); tail.position.copy(from);
    layerFx.add(sp); layerFx.add(tail);
    const info = { source: 'strike', ring: S.ring, behind: S.behind, constellation: S.constellation };
    const arcUp = 0.6 + Math.random() * 0.6, side = (Math.random() - 0.5) * 0.8;
    bolts.push({ sp, tail, from, t: 0, dur: K.strikeFlight, target: t, info, arcUp, side, kind: 'strike' });
    sfx('strike');
  }
  const bp = new T3.Vector3(), bq = new T3.Vector3();
  function updateBolts(dt) {
    for (let i = bolts.length - 1; i >= 0; i--) {
      const o = bolts[i]; o.t += dt;
      const u = clamp(o.t / o.dur, 0, 1);
      if (o.target && (o.target.alive === false && o.target.group)) o.target = null;
      targetPos(o.target || boss(), bq);
      bp.lerpVectors(o.from, bq, u); bp.y += Math.sin(u * PI) * o.arcUp;
      o.tail.position.copy(o.sp.position);
      o.sp.position.copy(bp);
      if (u >= 1) {
        layerFx.remove(o.sp); layerFx.remove(o.tail);
        bolts.splice(i, 1);
        landBolt(o, bq);
      }
    }
  }
  function landBolt(o, pos) {
    const b = boss();
    if (o.kind === 'strike') {
      let dealt = 0;
      if (o.target && o.target.group) dealt = G.adds && G.adds.damage ? G.adds.damage(o.target, K.strikeDmg, o.info) : 0;
      else if (b && G.combat) dealt = G.combat.dealDamage(K.strikeDmg, { ...o.info, pos: pos.clone() });
      if (dealt > 0) addMeter(K.strikeMeter);
      fx('spark', pos.clone(), o.info.behind ? GOLD_HOT : GOLD);
      if (o.target && o.target.group) sfx('strikeHit', { crit: o.info.behind });
    }
  }

  // ============================================================ METER
  function addMeter(n, raw) {
    const before = S.meter;
    S.meter = clamp(S.meter + n * (raw ? 1 : K.meterScale), 0, K.meterMax);
    CD.nova.ready = S.meter >= K.meterMax;
    if (before < K.meterMax && S.meter >= K.meterMax) { emit('novaReady', {}); sfx('novaReady'); }
  }
  function use(skill, emp, extra) { stats.uses[skill] = (stats.uses[skill] || 0) + 1; emit('skillUsed', { skill, empowered: !!emp, ...(extra || {}) }); }
  function consumeEmpower() { if (!S.empowered) return false; S.empowered = false; M.empT = 0; emit('empower', { active: false }); return true; }

  // ============================================================ ANCHORS
  const anchors = [];
  let anchorId = 1, lapPulses = 0, lapStartTheta = 0;
  let constLines = [], constMat = null;
  function anchorModel(meridian) {
    const g = new T3.Group();
    const shape = new T3.Shape();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? 0.12 : 0.42; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? shape.lineTo(x, y) : shape.moveTo(x, y); }
    const sg = new T3.ShapeGeometry(shape); sg.rotateX(-PI / 2);
    const baseMat = new T3.MeshBasicMaterial({ color: new T3.Color(GOLD).multiplyScalar(1.3), transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    const base = new T3.Mesh(sg, baseMat); base.position.y = 0.08; base.renderOrder = 8;
    const rg = new T3.RingGeometry(0.55, 0.62, 32); rg.rotateX(-PI / 2);
    const ring = new T3.Mesh(rg, new T3.MeshBasicMaterial({ color: new T3.Color(GOLD), transparent: true, opacity: 0.6, depthWrite: false, blending: T3.AdditiveBlending })); ring.position.y = 0.08;
    const gem = new T3.Mesh(new T3.OctahedronGeometry(0.16, 0), new T3.MeshBasicMaterial({ color: new T3.Color(GOLD_HOT).multiplyScalar(1.7) }));
    gem.scale.set(1, 1.7, 1); gem.position.y = 0.85;
    const glow = sprite(GOLD, 1.4, 0.8); glow.position.y = 0.85;
    const pillar = new T3.Mesh(new T3.CylinderGeometry(0.03, 0.05, 0.8, 6, 1, true), new T3.MeshBasicMaterial({ color: new T3.Color(GOLD), transparent: true, opacity: 0.4, blending: T3.AdditiveBlending, depthWrite: false }));
    pillar.position.y = 0.45;
    const warnG = new T3.RingGeometry(0.7, 0.85, 32); warnG.rotateX(-PI / 2);
    const warn = new T3.Mesh(warnG, new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); warn.position.y = 0.09;
    g.add(base, ring, gem, glow, pillar, warn);
    g.userData = { base, ring, gem, glow, pillar, warn };
    if (meridian) {
      const R = RINGS();
      const lg = new T3.PlaneGeometry(R[2] - R[0] + 1.6, 0.09); lg.rotateX(-PI / 2);
      const line = new T3.Mesh(lg, new T3.MeshBasicMaterial({ color: new T3.Color(GOLD).multiplyScalar(1.3), transparent: true, opacity: 0.55, blending: T3.AdditiveBlending, depthWrite: false }));
      line.userData.meridian = true; g.userData.mline = line;
    }
    return g;
  }
  function placeAnchor() {
    if (!canAct() || CD.anchor.charges <= 0) return;
    const emp = consumeEmpower();
    CD.anchor.charges--; if (CD.anchor.charges < CD.anchor.max && CD.anchor.t <= 0) CD.anchor.t = K.anchorRecharge;
    if (anchors.length >= K.anchorMax) removeAnchor(anchors[0], false);
    const a = { id: anchorId++, ring: S.ring, theta: S.theta, born: M.clock, life: K.anchorLife, cd: 0.6, meridian: emp, warn: false, pos: polar(RINGS()[S.ring], S.theta, 0), group: anchorModel(emp), pulses: 0 };
    a.group.position.copy(a.pos);
    layerP.add(a.group);
    if (a.group.userData.mline) {
      const R = RINGS(); const l = a.group.userData.mline;
      polar((R[0] + R[2]) / 2, a.theta, 0.07, l.position); l.rotation.y = a.theta; layerP.add(l);
    }
    anchors.push(a);
    fx('burst', a.pos.clone().setY(0.4), { color: GOLD, count: 20, speed: 4, size: 0.5, life: 0.6 });
    fx('shockwave', a.pos.clone().setY(0.1), { color: GOLD, radius: 1.6, life: 0.4 });
    emit('anchorPlaced', { id: a.id, ring: a.ring, theta: a.theta, meridian: emp });
    use('anchor', emp);
  }
  function removeAnchor(a, smashed) {
    const i = anchors.indexOf(a); if (i < 0) return;
    anchors.splice(i, 1);
    if (a.group.userData.mline) disposeObj(a.group.userData.mline);
    disposeObj(a.group);
    if (smashed) {
      const acc = (G.colors && G.colors.accent) || '#5fe3ff';
      fx('burst', a.pos.clone().setY(0.5), { color: GOLD, count: 24, speed: 7, size: 0.5, life: 0.7 });
      fx('burst', a.pos.clone().setY(0.3), { color: acc, count: 14, speed: 5, size: 0.4, life: 0.6 });
      fx('shockwave', a.pos.clone().setY(0.1), { color: acc, radius: 1.8, life: 0.35 });
      emit('anchorSmashed', { id: a.id, ring: a.ring, theta: a.theta });
    } else fx('burst', a.pos.clone().setY(0.4), { color: GOLD, count: 8, speed: 2, size: 0.3, life: 0.4 });
  }
  function disposeObj(o) {
    if (o.parent) o.parent.remove(o);
    o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material && !c.userData.sharedMat) c.material.dispose(); });
  }
  const anchorsApi = {
    list: anchors,
    smash(pred) { for (const a of anchors.slice()) { let hit = false; try { hit = !pred || pred(a); } catch (e) { logE('anchors.smash', e); } if (hit) removeAnchor(a, true); } },
    mark(pred, on = true) { let n = 0; for (const a of anchors) { let hit = false; try { hit = !pred || pred(a); } catch (e) { } if (hit) { if (on && !a.warn) n++; a.warn = on; } } if (n) sfx('anchorWarn'); },
    clear() { for (const a of anchors.slice()) removeAnchor(a, false); updateConstellation(); },
  };
  function pulseAnchor(a) {
    const b = boss(); if (!b || !b.alive) return;
    a.cd = K.anchorCd; a.pulses++;
    const from = a.pos.clone().setY(0.85);
    const to = b.hitPoint ? b.hitPoint(a.theta) : new T3.Vector3(0, 2, 0);
    fx('lance', from, to, { color: GOLD, width: 0.16, life: 0.35 });
    fx('burst', from, { color: GOLD_HOT, count: 12, speed: 3, size: 0.4, life: 0.5 });
    const dealt = G.combat ? G.combat.dealDamage(K.anchorDmg, { source: 'anchor', pos: to }) : 0;
    const heal = K.anchorHeal * (a.meridian ? K.meridianHealMul : 1);
    healHp(heal);
    addMeter(K.anchorMeter);
    lapPulses++;
    stats.pulses++;
    emit('anchorPulse', { pos: a.pos.clone(), id: a.id, dealt, heal });
  }
  function updateAnchors(dt) {
    const R = RINGS();
    // lap counter for the rising chime
    if (Math.abs(angDiff(S.theta, lapStartTheta)) < 0.05 && M.clock - (M.lapT || 0) > 3) { lapPulses = 0; M.lapT = M.clock; }
    for (const a of anchors.slice()) {
      const age = M.clock - a.born;
      if (age > a.life) { removeAnchor(a, false); continue; }
      a.cd = Math.max(0, a.cd - dt);
      const u = a.group.userData;
      const ready = a.cd <= 0;
      u.gem.rotation.y += dt * 2;
      u.gem.position.y = 0.85 + Math.sin(M.clock * 2.5 + a.id) * 0.06;
      u.glow.material.opacity = ready ? 0.8 : 0.25;
      u.ring.material.opacity = ready ? 0.6 : 0.2;
      u.base.material.opacity = (age > a.life - 5) ? (0.5 + 0.45 * Math.sign(Math.sin(M.clock * 12))) : 0.95;
      u.warn.material.opacity = a.warn ? 0.4 + 0.4 * Math.sin(M.clock * 16) : 0;
      if (a.warn) u.warn.material.color.set((G.colors && G.colors.accent) || '#5fe3ff');
      // contact
      if (ready && S.alive && PLAY() && boss()) {
        const onRing = a.meridian || (S.ring === a.ring && !M.hop);
        const rr = R[a.meridian ? S.ring : a.ring];
        if (onRing && Math.abs(angDiff(S.theta, a.theta)) * rr < K.anchorContact) pulseAnchor(a);
      }
    }
    updateConstellation();
  }
  function updateConstellation() {
    if (!constMat) return;
    const n = anchors.length;
    let active = false;
    if (n >= 3) {
      const ang = anchors.map(a => ((a.theta % TAU) + TAU) % TAU).sort((x, y) => x - y);
      active = true;
      for (let i = 0; i < ang.length; i++) { const gap = (i + 1 < ang.length ? ang[i + 1] : ang[0] + TAU) - ang[i]; if (gap >= PI) { active = false; break; } }
    }
    if (active !== S.constellation) { S.constellation = active; emit('constellation', { active }); }
    // lines
    const pairs = n === 2 ? [[0, 1]] : n >= 3 ? [[0, 1], [1, 2], [2, 0]] : [];
    for (let i = 0; i < 3; i++) {
      const l = constLines[i];
      if (i >= pairs.length) { l.visible = false; continue; }
      const a = anchors[pairs[i][0]].pos, b = anchors[pairs[i][1]].pos;
      l.visible = true;
      l.position.set((a.x + b.x) / 2, 0.075, (a.z + b.z) / 2);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      l.scale.set(len, 1, active ? 1.6 : 1);
      l.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    }
    constMat.uniforms.uOn.value = active ? 1 : 0;
    constMat.uniforms.uT.value = M.clock;
  }
  function buildConstLines() {
    constMat = new T3.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide,
      uniforms: { uOn: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float uOn, uT;
        void main(){ float w = 1.0 - abs(vUv.y - 0.5) * 2.0; float core = pow(w, 4.0); float halo = pow(w, 1.2) * 0.35;
          float spark = pow(max(0.0, sin(vUv.x * 40.0 - uT * 6.0)), 18.0) * uOn;
          float a = (core + halo) * (0.35 + 0.65 * uOn) + spark * core;
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.45) * a * (1.0 + uOn * 0.8), a); }`,
    });
    const g = new T3.PlaneGeometry(1, 0.22); g.rotateX(-PI / 2);
    for (let i = 0; i < 3; i++) { const m = new T3.Mesh(g, constMat); m.visible = false; m.renderOrder = 7; m.userData.sharedMat = true; m.frustumCulled = false; constLines.push(m); layerP.add(m); }
  }

  // ============================================================ COMET
  const comets = [];
  function cometDown() {
    const c = CD.comet;
    if (!canAct() || c.t > 0 || c.holding) return;
    c.holding = true; c.empowered = consumeEmpower(); c.charge = c.empowered ? 1 : 0;
    M.cometBehindWas = S.behind;
    sfx('cometCharge', { empowered: c.empowered });
    M.cometFullSent = c.empowered;
    emit('cometCharge', { empowered: c.empowered });
  }
  function cometUp() {
    const c = CD.comet;
    if (!c.holding) return;
    c.holding = false;
    if (!canAct()) { c.charge = 0; try { G.audio && G.audio.stopCharge && G.audio.stopCharge(); } catch (e) { } return; }
    const charge = c.charge; c.charge = 0;
    c.t = K.cometCd;
    const behind = S.behind;
    let dmg = (K.cometBase + K.cometBonus * charge) * (c.empowered ? K.cometEmpMul : 1);
    const from = handPos();
    const sp = sprite(GOLD_HOT, 0.8 + charge * 0.9, 1); sp.position.copy(from); layerFx.add(sp);
    const glow = sprite(GOLD, 2.2 + charge * 1.5, 0.6); sp.add(glow); glow.scale.setScalar(2.2);
    const trail = fx('trail', sp, { color: GOLD, width: 0.35 + charge * 0.35, length: 22 });
    comets.push({ sp, trail, from, t: 0, dur: K.cometFlight, dmg, behind, charge, empowered: c.empowered, info: { source: 'comet', ring: S.ring, behind, constellation: S.constellation }, theta: S.theta });
    try { G.audio && G.audio.stopCharge && G.audio.stopCharge(); } catch (e) { }
    stats.lastCometCharge = charge;
    use('comet', c.empowered, { charge, behind });
    c.empowered = false;
  }
  function updateComets(dt) {
    const b = boss();
    for (let i = comets.length - 1; i >= 0; i--) {
      const o = comets[i]; o.t += dt;
      const u = clamp(o.t / o.dur, 0, 1);
      const to = b && b.hitPoint ? b.hitPoint(o.theta) : new T3.Vector3(0, 2, 0);
      bp.lerpVectors(o.from, to, u * u * (2 - u) * 0.5 + u * 0.5); bp.y += Math.sin(u * PI) * 1.2;
      o.sp.position.copy(bp);
      if (u >= 1) {
        comets.splice(i, 1);
        try { o.trail && o.trail.remove && o.trail.remove(); } catch (e) { }
        disposeObj(o.sp);
        // pierce: hits every add in its line
        if (o.empowered && G.adds) {
          for (const a of G.adds.list.slice()) {
            if (!a.alive) continue;
            if (segDist(o.from, to, a.pos) < K.cometPierceR + (a.radius || 0.6)) G.adds.damage(a, o.dmg, o.info);
          }
        }
        let dealt = 0;
        if (b && G.combat) dealt = G.combat.dealDamage(o.dmg, { ...o.info, pos: to.clone(), crit: o.charge > 0.95 });
        if (dealt > 0 || !b) addMeter(o.behind ? K.cometMeterBehind : K.cometMeter);
        fx('burst', to.clone(), { color: GOLD_HOT, count: 30 + o.charge * 40, speed: 8, size: 0.8, life: 0.8 });
        fx('shockwave', to.clone().setY(0.3), { color: GOLD, radius: 2.5 + o.charge * 3, life: 0.5 });
        if (o.charge > 0.6) { cam('shake', 0.3 + o.charge * 0.4, 0.3); cam('hitStop', 0.05 + o.charge * 0.05); }
      }
    }
  }
  function segDist(a, b, p) {
    const abx = b.x - a.x, abz = b.z - a.z, apx = p.x - a.x, apz = p.z - a.z;
    const t = clamp((apx * abx + apz * abz) / Math.max(1e-6, abx * abx + abz * abz), 0, 1);
    return Math.hypot(apx - abx * t, apz - abz * t);
  }

  // ============================================================ ECLIPSE
  function eclipse() {
    if (!canAct() || CD.eclipse.t > 0) return;
    CD.eclipse.t = K.eclipseCd;
    M.haltT = K.eclipseHalt; S.halted = true;
    if (M.turn) { M.turn = null; }
    let ok = false;
    try { ok = !!(G.combat && G.combat.interrupt && G.combat.interrupt()); } catch (e) { logE('interrupt', e); }
    if (ok) {
      CD.eclipse.t = K.eclipseInterruptCd;
      addMeter(K.eclipseMeter);
      stats.interrupts++;
      fx('flash', '#fff1c2', 0.4, 0.4);
      cam('shake', 0.6, 0.4);
    }
    S.empowered = true; M.empT = K.empowerDur;
    emit('empower', { active: true });
    fx('shockwave', S.pos.clone().setY(0.2), { color: GOLD_HOT, radius: 3.2, life: 0.5 });
    use('eclipse', false);
    M.eclipseFlash = 1;
  }

  // ============================================================ AEGIS
  function aegis() {
    if (!canAct() || CD.aegis.t > 0) return;
    const emp = consumeEmpower();
    CD.aegis.t = K.aegisCd;
    M.aegisT = emp ? K.aegisEmpDur : K.aegisDur; M.aegisAge = 0; M.aegisEmp = emp;
    S.aegisActive = true;
    use('aegis', emp);
  }
  function aegisBlock(amount, label) {
    const perfect = M.aegisAge <= K.aegisPerfect;
    let dmg = Math.max(K.aegisMinReflect, (perfect ? K.aegisPerfectMul : K.aegisReflectMul) * amount);
    if (M.aegisEmp) dmg *= K.aegisEmpMul;
    addMeter(K.aegisMeter + (perfect ? K.aegisPerfectMeter : 0));
    if (perfect) stats.perfectAegis++;
    stats.reflects++;
    const b = boss();
    const from = S.pos.clone().setY(S.pos.y + 0.7);
    const to = b && b.hitPoint ? b.hitPoint(S.theta) : new T3.Vector3(0, 2, 0);
    fx('lance', from, to, { color: perfect ? GOLD_HOT : GOLD, width: perfect ? 0.45 : 0.28, life: 0.45 });
    fx('burst', from, { color: GOLD_HOT, count: perfect ? 40 : 20, speed: 6, size: 0.6, life: 0.6 });
    fx('shockwave', from.clone().setY(0.2), { color: GOLD, radius: perfect ? 3 : 2, life: 0.4 });
    if (perfect) { fx('flash', '#fff1c2', 0.3, 0.25); cam('hitStop', 0.08); fx('number', from.clone().setY(from.y + 1.2), 0, { text: 'PERFECT', crit: true, color: GOLD_HOT, size: 0.8 }); }
    cam('shake', perfect ? 0.5 : 0.3, 0.25);
    // reflect lands on the boss (ring / behind multipliers apply: it is player damage)
    if (b && G.combat) G.combat.dealDamage(dmg, { source: 'aegis', pos: to, crit: perfect });
    emit('aegisBlock', { perfect, amount, reflect: dmg });
    M.aegisHitFlash = 1;
  }

  // ============================================================ SUPERNOVA
  function nova() {
    if (!canAct() || S.meter < K.meterMax) return;
    const emp = consumeEmpower();
    S.meter = 0; CD.nova.ready = false;
    S.novaActive = true; S.invuln = true;
    M.nova = { t: 0, emp, thrown: false, hit: false, startY: 0 };
    if (CD.comet.holding) { CD.comet.holding = false; CD.comet.charge = 0; }
    if (G.hz) G.hz.speed = K.novaHzSpeed;
    novaStar.visible = true; novaStar.scale.setScalar(0.2);
    // camera: low dramatic angle from behind the hero, looking up at the boss, then back
    const heroP = S.pos.clone();
    const out = polar(RINGS()[S.ring] + 4.5, S.theta - S.dir * 0.25, 1.2);
    const side = polar(RINGS()[S.ring] + 2.2, S.theta + S.dir * 0.35, 3.4);
    const c = G.camera ? G.camera.position.toArray() : [0, 20, 16];
    cam('cinematic', [
      { t: 0, pos: c, look: [0, 0.5, 0] },
      { t: 0.9, pos: out.toArray(), look: [heroP.x * 0.6, 2.8, heroP.z * 0.6] },
      { t: 2.0, pos: side.toArray(), look: [0, 2.4, 0] },
      { t: 3.0, pos: c, look: [0, 0.5, 0] },
    ], { name: 'supernova' });
    emit('novaStart', { empowered: emp });
    use('nova', emp);
  }
  function updateNova(dt) {
    const n = M.nova; if (!n) return;
    n.t += dt;
    const t = n.t;
    // rise, hold, descend
    const rise = smooth(t / 1.1), fall = smooth((t - K.novaImpact) / (K.novaDur - K.novaImpact));
    S.novaY = 2.6 * (t < K.novaImpact ? rise : 1 - fall);
    const sp = novaStar;
    if (!n.thrown) {
      const s = 0.3 + 2.6 * smooth(t / K.novaThrow);
      sp.scale.setScalar(s * (1 + 0.08 * Math.sin(t * 30)));
      sp.position.copy(S.pos).setY(S.pos.y + 1.9 + s * 0.2);
      if (Math.random() < 0.5) fx('spark', sp.position.clone().add(new T3.Vector3((Math.random() - .5) * 3, (Math.random() - .5) * 3, (Math.random() - .5) * 3)), GOLD_HOT);
      if (t >= K.novaThrow) { n.thrown = true; n.from = sp.position.clone(); sfx('lance', {}); }
    } else if (!n.hit) {
      const b = boss();
      const to = b && b.hitPoint ? b.hitPoint(S.theta) : new T3.Vector3(0, 2, 0);
      const u = clamp((t - K.novaThrow) / (K.novaImpact - K.novaThrow), 0, 1);
      sp.position.lerpVectors(n.from, to, u * u);
      sp.scale.setScalar(2.9 * (1 - 0.5 * u));
      if (t >= K.novaImpact) {
        n.hit = true; sp.visible = false;
        const dmg = K.novaDmg * (n.emp ? K.novaEmpMul : 1);
        if (b && G.combat) G.combat.dealDamage(dmg, { source: 'nova', ringEligible: false, behindEligible: false, pos: to.clone(), crit: true, force: true });
        try { G.adds && G.adds.killAll && G.adds.killAll('nova'); } catch (e) { logE('nova.adds', e); }
        try { G.hz && G.hz.clear && G.hz.clear(h => h.kind === 'orb'); } catch (e) { logE('nova.orbs', e); }
        fx('flash', '#fff6dd', 0.4, 0.4);
        fx('shockwave', new T3.Vector3(0, 0.4, 0), { color: GOLD_HOT, radius: 18, life: 1.1 });
        fx('burst', to.clone(), { color: GOLD_HOT, count: 120, speed: 14, size: 1.1, life: 1.2 });
        fx('starFall', to.clone(), GOLD_HOT);
        cam('shake', 1.2, 0.8); cam('hitStop', 0.12);
      }
    }
    if (t >= K.novaDur) {
      M.nova = null; S.novaActive = false; S.novaY = 0; sp.visible = false;
      S.invuln = false;                         // the 1 s after-glow grace runs on its own timer (M.postNovaT)
      M.postNovaT = K.novaAfterInvuln;
      if (G.hz) G.hz.speed = 1;
      emit('novaEnd', {});
    }
  }

  // ===================================================== DAMAGE / HEAL
  function damage(amount, label) {
    if (!S.alive || amount <= 0) return { applied: false, blocked: false };
    if (!PLAY()) return { applied: false, blocked: false };
    if (S.novaActive || M.postNovaT > 0 || S.invuln || (G.combat && G.combat.transitioning)) return { applied: false, blocked: false };
    if (M.aegisT > 0) { aegisBlock(amount, label); emit('playerDamaged', { amount: 0, source: label, blocked: true }); return { applied: false, blocked: true }; }
    if (S.iframes) return { applied: false, blocked: false };
    M.hitT = K.hitIframes; S.iframes = true;
    stats.hitsTaken++;
    const practice = !!(G.combat && G.combat.practice);
    if (practice || G.player.god) {
      fx('number', S.pos.clone().setY(S.pos.y + 1.6), 0, { text: practice ? 'HIT' : 'GOD', color: '#ff9a9a', size: 0.8 });
      emit('playerDamaged', { amount, source: label, blocked: false, practice: true });
      M.hurtFlash = 1;
      return { applied: true, blocked: false };
    }
    S.hp = Math.max(0, S.hp - amount);
    stats.damageTaken += amount;
    M.hurtFlash = 1;
    cam('shake', clamp(amount / 60, 0.2, 1), 0.3);
    fx('flash', '#ff3b4a', clamp(amount / 120, 0.12, 0.45), 0.3);
    fx('number', S.pos.clone().setY(S.pos.y + 1.6), amount, { color: '#ff6b6b' });
    fx('burst', S.pos.clone().setY(S.pos.y + 0.6), { color: '#ff8a7a', count: 14, speed: 4, size: 0.4, life: 0.5 });
    emit('playerDamaged', { amount, source: label, blocked: false });
    if (S.hp <= 0) die(label);
    return { applied: true, blocked: false };
  }
  function healHp(n) {
    if (!S.alive || n <= 0) return;
    const before = S.hp;
    S.hp = Math.min(S.maxHp, S.hp + n);
    const d = S.hp - before;
    stats.healed += d;
    if (d > 0) { emit('playerHealed', { amount: d }); fx('number', S.pos.clone().setY(S.pos.y + 1.5), Math.round(d), { text: '+' + Math.round(d), color: '#bfffcf' }); }
  }
  function die(label) {
    S.alive = false; stats.deaths++;
    M.deathT = 0; M.turn = null; M.hop = null; S.shifting = false;
    CD.comet.holding = false; M.aegisT = 0; S.aegisActive = false;
    if (M.nova) { M.nova = null; S.novaActive = false; S.invuln = false; S.novaY = 0; if (novaStar) novaStar.visible = false; if (G.hz) G.hz.speed = 1; }
    M.postNovaT = 0;
    cam('slowMo', 0.3, 1.4);
    fx('burst', S.pos.clone().setY(0.7), { color: GOLD, count: 40, speed: 5, size: 0.6, life: 1.2 });
    sfx('crack', { vol: 0.8 });
    emit('playerDied', { label });
  }

  // ============================================================ VISUALS
  const fwd = new T3.Vector3(), right = new T3.Vector3(), shoulder = new T3.Vector3();
  function updateVisual(dt) {
    const R = ringR(S.ringF);
    polar(R, S.theta, 0, S.pos);
    let y = S.y + (S.novaY || 0);
    // run cycle
    const speed = Math.abs(S.v) * R;
    M.runPhase += speed * dt * 4.2;
    const run = clamp(speed / 5, 0, 1) * (S.alive ? 1 : 0);
    const sw = Math.sin(M.runPhase) * 0.75 * run;
    legs[0].rotation.z = sw; legs[1].rotation.z = -sw;
    arms[0].rotation.z = -sw * 0.8; arms[1].rotation.z = sw * 0.8 - (CD.comet.holding ? 1.6 : 0);
    const bob = Math.abs(Math.sin(M.runPhase)) * 0.05 * run;
    body.position.y = bob;
    root.position.copy(S.pos); root.position.y = y;
    // face direction of motion: +x local along tangent
    const vs = Math.abs(S.v) > 0.02 ? Math.sign(S.v) : S.dir;
    const tangAng = S.theta + vs * PI / 2;                   // world heading angle (polar convention)
    const want = tangAng;
    M.faceAng += angDiff(want, M.faceAng) * Math.min(1, dt * 16);
    root.rotation.set(0, M.faceAng, 0);
    // lean into the turn / skid
    M.skid = Math.max(0, M.skid - dt * 4);
    M.bump = Math.max(0, M.bump - dt * 4);
    body.rotation.z = -M.skid * 0.35 + Math.sin(M.bump * PI * 3) * M.bump * 0.25;
    body.rotation.x = Math.sin(M.bump * PI * 4) * M.bump * 0.2;
    if (M.skid > 0.6 && Math.random() < 0.5) fx('spark', S.pos.clone().setY(0.1), GOLD);
    // death collapse
    if (!S.alive) { M.deathT += G.rdt || dt; const k = smooth(M.deathT / 1.2); body.rotation.z = -k * 1.45; body.position.y = -k * 0.25; }
    // halo
    halo.rotation.y += dt * 1.6;
    halo.userData.r2.rotation.z += dt * 2.4;
    const ba = M.clock * 4.0; haloBead.position.set(Math.cos(ba) * 0.17, Math.sin(ba * 0.5) * 0.04, Math.sin(ba) * 0.17);
    // behind glint
    M.glint += ((S.behind ? 1 : 0) - M.glint) * Math.min(1, dt * 8);
    headGlint.material.opacity = M.glint * (0.6 + 0.4 * Math.sin(M.clock * 14));
    headGlint.scale.setScalar(0.5 + M.glint * 0.5);
    handStar.material.opacity = 0.6 + (CD.comet.holding ? 0.4 : 0);
    handStar.scale.setScalar(CD.comet.holding ? 0.35 + CD.comet.charge * 0.7 : 0.3);
    // flicker while hit i-frames
    body.visible = !(M.hitT > 0 && S.alive && Math.floor(M.clock * 18) % 2 === 0);
    // decal + beacon
    decal.position.set(S.pos.x, 0.1, S.pos.z);
    decal.material.uniforms.uFrac.value = S.hp / S.maxHp;
    decal.material.uniforms.uTime.value = M.clock;
    M.hurtFlash = Math.max(0, (M.hurtFlash || 0) - dt * 3);
    decal.material.uniforms.uHit.value = M.hurtFlash;
    decal.material.uniforms.uBehind.value = M.glint;
    decal.visible = S.alive;
    beacon.position.set(S.pos.x, 0, S.pos.z);
    beacon.material.uniforms.uA.value = S.alive ? (G.isTouch ? 0.4 : 0.28) + 0.1 * Math.sin(M.clock * 2) : 0;
    if (pointer) {
      const show = S.alive && (PLAY() || G.state === 'intro') && !S.novaActive && !(G.cam && G.cam.inCinematic);
      pointer.visible = show;
      if (show) {
        pointer.position.set(S.pos.x, S.pos.y + body.position.y + 1.75 * body.scale.y / 1.15 + 0.12 * Math.sin(M.clock * 3.2), S.pos.z);
        const hurt = M.hurtFlash || 0;
        pointer.material.color.setRGB(1 + 0.35 * M.glint, 1 - 0.55 * hurt, 1 - 0.65 * hurt);
        pointer.material.opacity = 0.92;
      }
    }
    // cape (verlet chain attached behind the shoulders)
    G.polar(1, M.faceAng, 0, fwd);
    right.set(fwd.z, 0, -fwd.x);
    shoulder.copy(root.position).addScaledVector(fwd, -0.12 * body.scale.x / 1.15); shoulder.y += 0.82 * body.scale.y / 1.15 + body.position.y;
    updateCape(dt);
    // aegis bubble
    if (M.aegisT > 0) {
      aegisBubble.visible = true; aegisBubble.position.copy(root.position).setY(y + 0.6);
      const u = aegisBubble.material.uniforms; u.uT.value = M.clock;
      const perfect = M.aegisAge <= K.aegisPerfect;
      u.uPerf.value = perfect ? 1 : 0;
      M.aegisHitFlash = Math.max(0, (M.aegisHitFlash || 0) - dt * 4);
      const left = M.aegisT;
      u.uA.value = clamp(M.aegisAge / 0.06, 0, 1) * (left < 0.2 ? left / 0.2 : 1) * (0.8 + M.aegisHitFlash);
      aegisBubble.scale.setScalar(1 + M.aegisHitFlash * 0.15 + (perfect ? 0.06 * Math.sin(M.clock * 40) : 0));
    } else aegisBubble.visible = false;
    // eclipse corona while halted
    const halt = M.haltT > 0;
    M.eclipseFlash = Math.max(0, (M.eclipseFlash || 0) - dt * 2);
    coronaSprite.visible = halt || M.eclipseFlash > 0;
    if (coronaSprite.visible) {
      coronaSprite.position.copy(root.position).setY(y + 0.65);
      coronaSprite.material.opacity = Math.max(halt ? 0.85 : 0, M.eclipseFlash);
      coronaSprite.scale.setScalar(1.7 + 0.08 * Math.sin(M.clock * 6) + M.eclipseFlash * 1.2);
      coronaSprite.material.rotation += dt * 0.6;
    }
    // comet aim line
    const b = boss();
    if (CD.comet.holding && b) {
      cometLine.visible = true;
      const from = handPos(bq);
      const to = b.hitPoint ? b.hitPoint(S.theta) : new T3.Vector3(0, 2, 0);
      const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
      cometLine.position.set(from.x, 0.62, from.z);
      cometLine.rotation.set(0, -Math.atan2(dz, dx), 0);
      cometLine.scale.set(len, 1, 0.35 + CD.comet.charge * 0.35);
      const u = cometLine.material.uniforms; u.uT.value = M.clock; u.uOn.value = S.behind ? 1 : 0; u.uC.value = CD.comet.charge; u.uLen.value = len;
      if (S.behind && !M.cometBehindWas) sfx('cometBehind');
      M.cometBehindWas = S.behind;
    } else cometLine.visible = false;
  }
  function updateCape(dt) {
    const N = capePts.length, seg = 0.085;
    if (!M.capeInit) { for (let i = 0; i < N; i++) { capePts[i].copy(shoulder).addScaledVector(fwd, -seg * i); capePrev[i].copy(capePts[i]); } M.capeInit = true; }
    capePts[0].copy(shoulder); capePrev[0].copy(shoulder);
    const g = -5.5 * dt * dt;
    for (let i = 1; i < N; i++) {
      const p = capePts[i], q = capePrev[i];
      const vx = (p.x - q.x) * 0.9, vy = (p.y - q.y) * 0.9, vz = (p.z - q.z) * 0.9;
      q.copy(p);
      p.x += vx; p.y += vy + g; p.z += vz;
      // flutter
      p.y += Math.sin(M.clock * 9 + i * 0.9) * 0.0035 * i;
    }
    for (let it = 0; it < 2; it++) for (let i = 1; i < N; i++) {
      const a = capePts[i - 1], p = capePts[i];
      tmpV.subVectors(p, a); const d = tmpV.length() || 1e-4; tmpV.multiplyScalar(seg / d); p.copy(a).add(tmpV);
      // keep behind the body and above the track
      const ahead = (p.x - shoulder.x) * fwd.x + (p.z - shoulder.z) * fwd.z;
      if (ahead > -0.05 * i) { p.addScaledVector(fwd, -0.05 * i - ahead); }
      if (p.y < 0.12) p.y = 0.12;
    }
    const pos = capeMesh.geometry.attributes.position;
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1), w = 0.2 * (1 - k * 0.5);
      const p = capePts[i];
      pos.setXYZ(i * 2, p.x + right.x * w, p.y, p.z + right.z * w);
      pos.setXYZ(i * 2 + 1, p.x - right.x * w, p.y, p.z - right.z * w);
    }
    pos.needsUpdate = true;
    capeMesh.visible = S.alive || M.deathT < 1.5;
  }

  // ============================================================ UPDATE
  function update(dt) {
    if (G.state === 'paused' || G.state === 'menu' && !G.player._menuShow) {
      if (G.state === 'menu') setVisible(false);
      return;
    }
    setVisible(true);
    M.clock += dt;
    updateMotion(dt);
    // empower / cooldown timers (only tick while the fight runs)
    const playing = PLAY() || G.state === 'cinematic';
    if (playing) {
      if (M.empT > 0) { M.empT -= dt; if (M.empT <= 0) { M.empT = 0; S.empowered = false; emit('empower', { active: false }); } }
      const a = CD.anchor;
      if (a.charges < a.max) { a.t -= dt; if (a.t <= 0) { a.charges++; a.t = a.charges < a.max ? K.anchorRecharge : 0;  } } else a.t = 0;
      if (CD.comet.t > 0) { CD.comet.t = Math.max(0, CD.comet.t - dt); if (CD.comet.t === 0) emit('cooldownReady', { skill: 'comet' }); }
      if (CD.eclipse.t > 0) { CD.eclipse.t = Math.max(0, CD.eclipse.t - dt); if (CD.eclipse.t === 0) emit('cooldownReady', { skill: 'eclipse' }); }
      if (CD.aegis.t > 0) { CD.aegis.t = Math.max(0, CD.aegis.t - dt); if (CD.aegis.t === 0) emit('cooldownReady', { skill: 'aegis' }); }
      if (CD.comet.holding) { CD.comet.charge = Math.min(1, CD.comet.charge + dt / K.cometCharge); if (CD.comet.charge >= 1 && !M.cometFullSent) { M.cometFullSent = true; sfx('cometFull'); } }
      if (M.aegisT > 0) { M.aegisT -= dt; M.aegisAge += dt; if (M.aegisT <= 0) { M.aegisT = 0; S.aegisActive = false; } }
      if (M.postNovaT > 0) M.postNovaT = Math.max(0, M.postNovaT - dt);
    }
    // behind
    const b = boss();
    const beh = !!(b && b.alive && Math.abs(angDiff(S.theta, b.facing + PI)) < K.behindHalf);
    if (beh !== S.behind) { S.behind = beh; emit('behind', { active: beh }); }
    // strike
    if (PLAY() && S.alive && !S.novaActive && b && b.alive && !b.invulnerable) {
      M.strikeT -= dt;
      if (M.strikeT <= 0) { M.strikeT += K.strikeInterval; fireStrike(); }
    } else M.strikeT = Math.max(M.strikeT, 0.15);
    updateBolts(dt);
    updateComets(dt);
    updateAnchors(dt);
    updateNova(dt);
    updateVisual(dt);
    updateGhost(dt);
  }
  let shown = true;
  function setVisible(v) {
    if (shown === v) return; shown = v;
    [root, capeMesh, decal, beacon, ghostDots, ghostFig].forEach(o => { if (o) o.visible = v; });
    if (!v && pointer) pointer.visible = false;
    if (!v) adjMarks.forEach(m => m.visible = false);
  }

  // ============================================================ RESET
  function reset(opts = {}) {
    S.hp = S.maxHp = K.maxHp; S.ring = K.startRing; S.ringF = K.startRing; S.theta = K.startTheta; S.dir = K.startDir;
    S.speedMul = 1; S.halted = false; S.invuln = false; S.iframes = false; S.shifting = false; S.alive = true;
    S.meter = opts.meter != null ? opts.meter : 0; S.empowered = false; S.behind = false; S.constellation = false; S.v = 0; S.y = 0; S.novaY = 0;
    S.novaActive = false; S.aegisActive = false; S.pathDanger = false;
    if (ringOff.some(Boolean)) { ringOff.fill(false); emit('ringsChanged', { disabled: ringOff.slice() }); }
    Object.assign(M, { turn: null, revLock: 0, revBuf: false, hop: null, shiftLock: 0, shiftBuf: 0, haltT: 0, haltF: 1, hitT: 0, speedT: 0, empT: 0,
      aegisT: 0, aegisAge: 0, aegisEmp: false, postNovaT: 0, strikeT: 0.6, nova: null, deathT: 0, bump: 0, skid: 0, glint: 0, capeInit: false, hurtFlash: 0, eclipseFlash: 0 });
    M.faceAng = S.theta + PI / 2;
    CD.anchor.charges = K.anchorCharges; CD.anchor.t = 0;
    Object.assign(CD.comet, { t: 0, charge: 0, holding: false, empowered: false });
    CD.eclipse.t = 0; CD.aegis.t = 0; CD.nova.ready = S.meter >= K.meterMax;
    anchorsApi.clear();
    for (const o of bolts) { layerFx.remove(o.sp); layerFx.remove(o.tail); } bolts.length = 0;
    for (const o of comets) { try { o.trail && o.trail.remove && o.trail.remove(); } catch (e) { } disposeObj(o.sp); } comets.length = 0;
    if (novaStar) novaStar.visible = false;
    if (G.hz) G.hz.speed = 1;
    if (!opts.keepStats) {
      stats.damageBySkill = {}; stats.hitsTaken = 0; stats.damageTaken = 0; stats.perfectAegis = 0; stats.interrupts = 0; stats.deaths = 0;
      stats.uses = {}; stats.reflects = 0; stats.pulses = 0; stats.healed = 0;
    }
    lapPulses = 0; lapStartTheta = S.theta;
    if (body) { body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); body.visible = true; }
    updateVisual(0);
    setVisible(true);
  }

  // ============================================================ INIT
  function init() {
    layerP = (G.layers && G.layers.player) || G.scene;
    layerFx = (G.layers && G.layers.fx) || G.scene;
    const k = buildKnight(); layerP.add(k); S.model = k;
    layerP.add(buildCape());
    decal = buildDecal(); layerP.add(decal);
    beacon = buildBeacon(); layerP.add(beacon);
    pointer = buildPointer(); layerP.add(pointer);
    buildGhost(); layerP.add(ghostDots); layerP.add(ghostFig); adjMarks.forEach(m => layerP.add(m));
    // readability: phones see the arena smaller, so the knight (visual only, not its hit radius) grows a little
    const fitScale = () => {
      const portrait = innerHeight > innerWidth, k = G.isTouch ? (portrait ? 1.45 : 1.3) : 1.15;
      body.scale.setScalar(k); decal.scale.setScalar(k / 1.15); if (ghostFig) ghostFig.scale.setScalar(k / 1.15);
      // chevron: ~17 css px tall on touch (15 on desktop) whatever the viewport; 0.767 = view height at 1 unit (FOV 42)
      if (pointer) { const px = G.isTouch ? 17 : 15; const sc = px / Math.max(240, innerHeight) * 0.767; pointer.scale.set(sc, sc, 1); }
      M.dotK = G.isTouch ? (portrait ? 1.6 : 1.45) : 1.15;
    };
    fitScale(); try { G.on('resize', fitScale); } catch (e) { }
    buildAegis(); layerP.add(aegisBubble); layerP.add(coronaSprite);
    buildComet(); layerP.add(cometLine); layerFx.add(novaStar);
    buildConstLines();
    const on = (a, fn) => { try { G.input && G.input.on && G.input.on(a, fn); } catch (e) { logE('input.on.' + a, e); } };
    on('reverse', doReverse);
    on('shiftIn', () => doShift(-1));
    on('shiftOut', () => doShift(1));
    on('anchor', placeAnchor);
    on('cometDown', cometDown);
    on('cometUp', cometUp);
    on('eclipse', eclipse);
    on('aegis', aegis);
    on('nova', nova);
    reset();
    setVisible(false);
  }

  G.player = {
    K, init, update, reset, state: S, damage, heal: healHp, forceShift, forceReverse, setSpeedMul,
    cooldowns: CD, anchors: anchorsApi, stats, predictTheta, predictRing, velAhead, addMeter, god: false,
    canAct: () => canAct(),
    disableRing, ringOk,
    get disabledRings() { return ringOff.slice(); },
    // highest usable ring index (rings above it are disabled); assigning it disables/enables the outer rings
    get maxRing() { let m = RINGS().length - 1; while (m > 0 && ringOff[m]) m--; return m; },
    set maxRing(n) { for (let i = 0; i < ringOff.length; i++) disableRing(i, i > n); },
    anchorAge: (a) => M.clock - a.born,
    // movement introspection for the bot / UI
    motion: () => ({ turning: !!M.turn, turnLeft: M.turn ? M.turn.dur - M.turn.t : 0, revLock: M.revLock, revBuf: M.revBuf, shiftBuf: M.shiftBuf, hopLeft: M.hop ? M.hop.dur - M.hop.t : 0, hop: M.hop ? { ...M.hop } : null, shiftLock: M.shiftLock, haltT: M.haltT, aegisT: M.aegisT, empT: M.empT, hitT: M.hitT, postNovaT: M.postNovaT, haltF: M.haltF, speedT: M.speedT }),
  };
})();
