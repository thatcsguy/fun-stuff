// =====================================================================
// 11_boss3.js: Boss 3, HELIARCH the Dying Sun (SPEC 9 "Boss 3").
// A colossal brass astrolabe-crown around a swollen, burning star that
// wears a sun-god mask. The rings themselves become the enemy: a gravity
// well drags the knight inward, segments of track break away, rings spin
// up, all rings force-reverse, the plane tilts, and in the end only two
// rings remain around a growing event horizon.
// Phases: Corona (100-70) -> Fracture (70-40) -> Collapse (40-12) ->
//         Event Horizon (12-0, a DPS race against a visible collapse timer).
// Owner: boss 3 author. Everything lives in this file.
// =====================================================================
(() => {
  const T3 = (typeof THREE !== 'undefined') ? THREE : G.THREE;
  const PI = Math.PI, TAU = PI * 2;
  const ACC = '#a77bff', HOT = '#f2e8ff', FLARE = '#ff7a3a', EMBER = '#ffb347', GOLD = '#ffc94d', GOLD_HOT = '#fff1c2';
  const VIOLET_DEEP = '#5a2cc8';
  const HOVER_Y = 3.7, STAR_R = 1.75;
  const EH_TIME = 45;                      // Event Horizon collapse timer (boss clock seconds)
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const angDiff = (a, b) => G.angDiff(a, b);
  const logE = (w, e) => { try { G.log.error('heliarch.' + w, e); } catch (_) { console.error(w, e); } };
  const fx = (name, ...a) => { try { const f = G.fx && G.fx[name]; return f ? f.apply(G.fx, a) : undefined; } catch (e) { logE('fx.' + name, e); } };
  const sfx = (name, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(name, o || {}); } catch (e) { logE('sfx.' + name, e); } };
  const world = (name, ...a) => { try { const f = G.world && G.world[name]; return f ? f.apply(G.world, a) : undefined; } catch (e) { logE('world.' + name, e); } };
  const cam = (name, ...a) => { try { const f = G.cam && G.cam[name]; return f ? f.apply(G.cam, a) : undefined; } catch (e) { logE('cam.' + name, e); } };
  const post = (name, ...a) => { try { const f = G.post && G.post[name]; return f ? f.apply(G.post, a) : undefined; } catch (e) { logE('post.' + name, e); } };
  const V3 = (x, y, z) => new T3.Vector3(x, y, z);
  const PS = () => (G.player && G.player.state) || null;
  const RING = (i) => G.RINGS[i];
  const cwait = (s) => G.combat.wait(s);                 // cinematic wait (combat clock, never rejects)
  const homeCam = () => (G.camera ? G.camera.position.toArray() : [0, 20, 16]);
  const homeLook = () => { try { const p = G.cam.playPose; return p && p.look ? p.look.toArray() : [0, 0.5, 0]; } catch (e) { return [0, 0.5, 0]; } };
  const accentNow = () => (G.colors && G.colors.accent) || ACC;
  const starPos = (b) => V3(0, (b && b.data && b.data.hoverY) || HOVER_Y, 0);   // play-local (the boss root sits at the origin)
  // run fn after sec of boss clock unless the phase ends first (b.wait rejects with Abort)
  const later = (b, sec, fn) => { b.wait(sec).then(() => { try { fn(); } catch (e) { logE('later', e); } }, () => { }); };
  const SHADER_TAIL = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';

  // ================================================================ GLSL
  const NOISE = `
    float hh(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
      return mix(mix(mix(hh(i), hh(i + vec3(1,0,0)), f.x), mix(hh(i + vec3(0,1,0)), hh(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hh(i + vec3(0,0,1)), hh(i + vec3(1,0,1)), f.x), mix(hh(i + vec3(0,1,1)), hh(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= .5; } return s; }`;

  const STAR_VS = `
    varying vec3 vN; varying vec3 vVN; varying vec3 vV;
    void main(){ vN = normal; vVN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const STAR_FS = `
    uniform float uTime, uCrack, uCollapse, uHorizon, uCalm, uHit, uOpacity, uRear, uSwell, uHot;
    uniform vec3 uVein;
    varying vec3 vN; varying vec3 vVN; varying vec3 vV;
    ${NOISE}
    void main(){
      vec3 n = normalize(vN); float t = uTime;
      vec3 q = n * 2.6 + vec3(0., t * .05, t * .03);
      float w = fbm(q + fbm(q * 1.7 + t * .08) * 1.4);
      float cells = vn(n * 11. + t * .25);
      float mu = clamp(dot(normalize(vVN), normalize(vV)), 0., 1.);
      vec3 deep = vec3(.38, .03, .02), mid = vec3(1.5, .34, .07), hi = vec3(2.5, 1.3, .48);
      vec3 col = mix(deep, mid, smoothstep(.25, .6, w));
      col = mix(col, hi, smoothstep(.62, .9, w) * (.55 + .45 * cells));
      col *= .42 + .9 * pow(mu, .5);
      col *= 1. + uHot * .5;
      float rv = 1. - abs(vn(n * 4.2 + vec3(t * .1, 0., 0.)) * 2. - 1.); rv = pow(rv, 10.);
      float rc = 1. - abs(vn(n * 7.5 - vec3(0., t * .15, 0.)) * 2. - 1.); rc = pow(rc, 14.);
      col += uVein * (rv * .55 + rc * uCrack * 2.8) * (.6 + .4 * sin(t * 3. + w * 9.));
      float back = dot(n, vec3(-1., 0., 0.));
      float fis = smoothstep(.72, .97, back) * (.55 + .45 * vn(n * 14. + t));
      col += vec3(2.4, 1.7, .6) * fis * uRear * (.8 + .4 * sin(t * 6.));
      col *= 1. + uSwell * .9;
      vec3 dw = mix(vec3(.95, .7, 2.4), vec3(2.5, 2.25, 2.9), smoothstep(.3, .8, w));
      col = mix(col, dw * (.6 + .6 * pow(mu, .3)) + uVein * rc * 1.5, uCollapse);
      float rim = pow(1. - mu, 3.5);
      vec3 hor = vec3(1.5, 1.3, 2.6) * rim * 2.4 + vec3(2.2, 1.5, .6) * fis * uRear * .6;
      col = mix(col, hor, uHorizon);
      vec3 calm = mix(vec3(1.6, 1.05, .55), vec3(2.6, 2.1, 1.4), smoothstep(.3, .85, w)) * (.55 + .7 * pow(mu, .4));
      col = mix(col, calm, uCalm);
      col += uHit * vec3(.9, .7, 1.2) * .5;
      gl_FragColor = vec4(col, uOpacity);
      ${SHADER_TAIL}
    }`;
  const UV_VS = `varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
  const CORONA_FS = `
    uniform float uTime, uInt, uOpacity, uCore, uRays; uniform vec3 uC1, uC2;
    varying vec2 vUv;
    ${NOISE}
    void main(){
      vec2 p = vUv * 2. - 1.; float r = length(p);
      vec2 dv = p / max(r, 1e-4);
      float d = max(r - uCore, 0.);
      float n1 = vn(vec3(dv * 2.5, uTime * .25));
      float n2 = vn(vec3(dv * 6.0, uTime * .6 + 3.));
      float rays = pow(n1 * .65 + n2 * .35, 2.2);
      float glow = exp(-d * 9.) * 1.1 + exp(-d * 3.2) * (.22 + 1.2 * rays * uRays);
      float fo = 1. - smoothstep(.7, 1., r);
      vec3 col = mix(uC1, uC2, smoothstep(0., .45, d)) * glow * fo * uInt;
      gl_FragColor = vec4(col * uOpacity, 1.);
      ${SHADER_TAIL}
    }`;
  const FLOW_FS = `
    uniform float uTime, uA, uHead, uOpacity, uSeed; uniform vec3 uCol, uCol2;
    varying vec2 vUv;
    void main(){
      float s = vUv.x;
      float f = .55 + .45 * sin(s * 38. - uTime * 13. + uSeed) * sin(s * 11. + uTime * 3.1 + uSeed * 2.);
      float head = smoothstep(uHead, uHead - .1, s);
      float ends = smoothstep(0., .05, s) * smoothstep(1., .92, s);
      float ring = .55 + .45 * sin(vUv.y * 6.2831853 * 2. + uTime * 4.);
      vec3 col = mix(uCol, uCol2, f) * (1.1 + f) * ring;
      gl_FragColor = vec4(col * uA * head * ends * uOpacity, 1.);
      ${SHADER_TAIL}
    }`;
  const DISK_FS = `
    uniform float uTime, uA, uOpacity, uIn, uOut, uSpin; uniform vec3 uC1, uC2;
    varying vec3 vP;
    ${NOISE}
    void main(){
      float r = length(vP.xy); float a = atan(vP.y, vP.x);
      float u = clamp((r - uIn) / (uOut - uIn), 0., 1.);
      float sp = uTime * uSpin / (.3 + u);
      vec2 cs = vec2(cos(a - sp), sin(a - sp));
      float n = vn(vec3(cs * 3., u * 6.)) * .6 + vn(vec3(cs * 9., u * 14. + uTime * .3)) * .4;
      float streak = pow(vn(vec3(cs * 18., u * 30.)), 3.);
      float band = smoothstep(0., .07, u) * (1. - smoothstep(.62, 1., u));
      float hot = exp(-u * 3.2);
      vec3 col = mix(uC1, uC2, hot) * (.35 + 1.7 * n * n + streak * 1.4) * (.55 + 1.9 * hot);
      gl_FragColor = vec4(col * band * uA * uOpacity, 1.);
      ${SHADER_TAIL}
    }`;
  const HORIZON_FS = `
    uniform float uTime, uA, uPulse; uniform vec3 uRim;
    varying vec3 vP;
    ${NOISE}
    void main(){
      float r = length(vP.xy); if (r > 1.) discard;
      float a = atan(vP.y, vP.x);
      vec2 cs = vec2(cos(a + uTime * .7 / (.2 + r)), sin(a + uTime * .7 / (.2 + r)));
      float n = vn(vec3(cs * 4., r * 6. - uTime * .9));
      float rim = smoothstep(.84, .965, r) * (1. - smoothstep(.965, 1., r));
      vec3 col = uRim * rim * (1.5 + 1.6 * n + uPulse * 2.);
      col += uRim * .35 * pow(n, 4.) * smoothstep(.35, .92, r);
      float alpha = max(smoothstep(1., .93, r) * .97, rim);
      gl_FragColor = vec4(col, alpha * uA);
      ${SHADER_TAIL}
    }`;
  const HEAT_FS = `
    uniform float uTime, uA; uniform vec3 uCol; varying vec3 vP;
    void main(){ float r = length(vP.xy) / 4.7; float g = exp(-r * r * 5.) * .8 + exp(-r * 3.5) * .25;
      g *= .85 + .15 * sin(uTime * 1.7 + r * 9.); g *= 1. - smoothstep(.85, 1., r);
      gl_FragColor = vec4(uCol * g * uA, 1.); ${SHADER_TAIL} }`;
  // gravity-well telegraph across the whole arena: violet ripples flowing inward, gold outward chevrons in the brace window
  const WELL_FS = `
    uniform float uTime, uProg, uBrace, uA; uniform vec3 uCol, uGold; varying vec3 vP;
    float band(float r, float R){ return 1. - smoothstep(.42, .78, abs(r - R)); }
    void main(){
      float r = length(vP.xz); float th = atan(-vP.z, vP.x);
      float tr = max(max(band(r, 5.5), band(r, 9.)), band(r, 12.5));
      float rip = pow(.5 + .5 * sin(r * 2.1 + uTime * (5. + 7. * uProg)), 5.);
      float a = rip * (.08 + .34 * uProg) * (.2 + .8 * tr);
      vec3 col = uCol * 1.6;
      float s = fract(th * 30. / 6.2831853);
      float cv = fract(r * .85 - abs(s - .5) * 1.3 - uTime * 1.9);
      float chev = smoothstep(.0, .07, cv) * smoothstep(.36, .24, cv) * tr * uBrace;
      col = mix(col, uGold * 2.1, chev);
      a = max(a, chev * .9);
      a *= smoothstep(4.4, 5.0, r) * (1. - smoothstep(13.3, 13.6, r));
      if (a < .004) discard;
      gl_FragColor = vec4(col, clamp(a * uA, 0., 1.));
      ${SHADER_TAIL}
    }`;

  function shaderMat(vs, fs, uniforms, opts = {}) {
    const m = new T3.ShaderMaterial({
      vertexShader: vs, fragmentShader: fs, uniforms,
      transparent: opts.transparent !== false, depthWrite: !!opts.depthWrite, depthTest: opts.depthTest !== false,
      blending: opts.additive ? T3.AdditiveBlending : T3.NormalBlending, side: opts.side || T3.FrontSide,
    });
    return m;
  }

  // ================================================================ TEXTURES (cached once)
  const TEX = {};
  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x, w, h);
    const t = new T3.CanvasTexture(c); if (srgb) t.colorSpace = T3.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  const ZOD = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  // the astrolabe limb plate (planar UVs of a RingGeometry: the canvas is the disc seen from above)
  function limbTex(emissive) {
    const key = emissive ? 'limbE' : 'limbC';
    if (TEX[key]) return TEX[key];
    TEX[key] = canvasTex(1024, 1024, (x, w) => {
      const c = w / 2, ro = c, ri = c * 2.5 / 2.98;
      if (!emissive) {
        const g = x.createRadialGradient(c, c, ri, c, c, ro);
        g.addColorStop(0, '#7a5220'); g.addColorStop(0.5, '#d8a856'); g.addColorStop(1, '#8a5e24');
        x.fillStyle = g; x.fillRect(0, 0, w, w);
      } else { x.fillStyle = '#000'; x.fillRect(0, 0, w, w); }
      const ink = emissive ? 'rgba(220,200,255,1)' : 'rgba(40,20,6,.85)';
      x.strokeStyle = ink; x.fillStyle = ink;
      for (const [r, lw] of [[ro - 6, 4], [ri + 6, 3], [ri + 46, 1.5], [ro - 36, 1.5]]) { x.lineWidth = lw; x.beginPath(); x.arc(c, c, r, 0, TAU); x.stroke(); }
      for (let i = 0; i < 360; i += 2) {
        const a = i / 360 * TAU, r0 = i % 30 === 0 ? ri + 8 : i % 10 === 0 ? ro - 36 : ro - 22, r1 = ro - 8;
        x.lineWidth = i % 10 === 0 ? 2.6 : 1.2; x.beginPath();
        x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); x.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); x.stroke();
      }
      x.font = 'bold 34px "Segoe UI Symbol", "Noto Sans Symbols", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i < 12; i++) {
        const a = (i + 0.5) / 12 * TAU, r = (ri + ro - 36) / 2 + 4;
        x.save(); x.translate(c + Math.cos(a) * r, c + Math.sin(a) * r); x.rotate(a + PI / 2); x.fillText(ZOD[i], 0, 0); x.restore();
      }
    }, !emissive);
    return TEX[key];
  }
  // engraving on the sun mask (sphere-segment UVs: u across the face, v top to bottom)
  function maskTex(emissive) {
    const key = emissive ? 'maskE' : 'maskC';
    if (TEX[key]) return TEX[key];
    TEX[key] = canvasTex(512, 512, (x, w, h) => {
      if (!emissive) {
        const g = x.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, '#8a5a22'); g.addColorStop(0.5, '#e8b866'); g.addColorStop(1, '#8a5a22');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      } else { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); }
      const ink = emissive ? 'rgba(215,190,255,1)' : 'rgba(50,26,8,.8)';
      x.strokeStyle = ink; x.lineWidth = emissive ? 3 : 4; x.lineCap = 'round';
      // brow sweep, cheek flames, chin rays: all symmetric around u = .5
      for (const s of [-1, 1]) {
        const cx = w / 2;
        x.beginPath(); x.moveTo(cx + s * 30, h * 0.22); x.quadraticCurveTo(cx + s * 130, h * 0.12, cx + s * 230, h * 0.27); x.stroke();
        x.beginPath(); x.moveTo(cx + s * 40, h * 0.44); x.quadraticCurveTo(cx + s * 120, h * 0.52, cx + s * 200, h * 0.44); x.stroke();
        for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(cx + s * (70 + k * 40), h * (0.56 + k * 0.03)); x.quadraticCurveTo(cx + s * (95 + k * 40), h * 0.72, cx + s * (60 + k * 46), h * 0.86); x.stroke(); }
      }
      x.beginPath(); x.moveTo(w / 2, h * 0.05); x.lineTo(w / 2, h * 0.2); x.stroke();
      x.beginPath(); x.arc(w / 2, h * 0.82, 40, PI * 0.15, PI * 0.85); x.stroke();
      for (let k = 0; k < 9; k++) { const a = PI * (0.15 + 0.7 * k / 8); x.beginPath(); x.moveTo(w / 2 + Math.cos(a) * 48, h * 0.82 + Math.sin(a) * 48); x.lineTo(w / 2 + Math.cos(a) * 70, h * 0.82 + Math.sin(a) * 70); x.stroke(); }
    }, !emissive);
    return TEX[key];
  }

  // ================================================================ MODEL
  // a point on a sphere, three.js SphereGeometry convention (phi around y, theta from +y)
  const sph = (r, phi, th) => V3(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
  const qFromZ = (dir) => new T3.Quaternion().setFromUnitVectors(V3(0, 0, 1), dir.clone().normalize());
  function flameShape(len, wid, curl) {
    const s = new T3.Shape();
    s.moveTo(-wid, 0);
    s.bezierCurveTo(-wid * 0.9, len * 0.35, -wid * 0.2 + curl, len * 0.6, curl, len);
    s.bezierCurveTo(wid * 0.3 + curl * 0.6, len * 0.6, wid * 0.9, len * 0.35, wid, 0);
    s.lineTo(-wid, 0);
    return s;
  }
  function arcCurve(a, b, h) {           // a quadratic arch from a to b rising h above the chord midpoint
    const m = a.clone().add(b).multiplyScalar(0.5); m.y += h;
    return new T3.QuadraticBezierCurve3(a, m, b);
  }

  function build(b) {
    const D = b.data;
    Object.assign(D, {
      t: 0, emerge: 0, hoverY: HOVER_Y, said: {}, gaps: [], flares: [], vfx: [], dips: [0, 0, 0], ehT: EH_TIME, horizonR: 0,
      look: { crack: 0, collapse: 0, horizon: 0, calm: 0, disk: 0, crownBreak: 0, mask: 0, hot: 0, heat: 1, corona: 1 },
      cur: { crack: 0, collapse: 0, horizon: 0, calm: 0, disk: 0, crownBreak: 0, mask: 0, hot: 0, heat: 0, corona: 0 },
      swell: 0, swellT: 0, pulse: 0, castGlow: 0, starScaleK: 1, eyeClose: 0, lastOutShift: -99,
    });
    const g = new T3.Group(); g.name = 'heliarch';
    const brass = G.mat.brass({ color: '#c8984a', metalness: 0.92, roughness: 0.3, envMapIntensity: 1.2 });
    const brassDark = G.mat.brass({ color: '#8a6430', metalness: 0.9, roughness: 0.42 });
    const brassInlay = G.mat.brass({ color: '#ffffff', map: limbTex(false), emissiveMap: limbTex(true), emissive: ACC, emissiveIntensity: 0.9, metalness: 0.9, roughness: 0.32, side: T3.DoubleSide });
    const maskMat = G.mat.brass({ color: '#ffffff', map: maskTex(false), emissiveMap: maskTex(true), emissive: ACC, emissiveIntensity: 0.7, metalness: 0.88, roughness: 0.3, side: T3.DoubleSide });
    const gemMat = G.mat.emissive(ACC, 2.4);
    const eyeMat = G.mat.emissive('#efe4ff', 3.0);
    const goldGem = G.mat.emissive(GOLD_HOT, 2.6);
    D.mats = { brass, brassDark, brassInlay, maskMat, gemMat, eyeMat, goldGem };

    const hover = new T3.Group(); hover.position.y = HOVER_Y; g.add(hover); D.hover = hover;
    // ---- the star
    D.starU = {
      uTime: { value: 0 }, uCrack: { value: 0 }, uCollapse: { value: 0 }, uHorizon: { value: 0 }, uCalm: { value: 0 }, uHit: { value: 0 },
      uOpacity: { value: 1 }, uRear: { value: 1 }, uSwell: { value: 0 }, uHot: { value: 0 }, uVein: { value: new T3.Color(ACC).multiplyScalar(1.5) },
    };
    const starMat = shaderMat(STAR_VS, STAR_FS, D.starU, { transparent: false, depthWrite: true });
    const star = new T3.Mesh(new T3.SphereGeometry(STAR_R, 64, 40), starMat); star.name = 'star';
    hover.add(star); D.star = star;
    // ---- corona billboard (rays)
    D.coronaU = { uTime: { value: 0 }, uInt: { value: 1 }, uOpacity: { value: 1 }, uCore: { value: 0.36 }, uRays: { value: 0.6 }, uC1: { value: new T3.Color('#ffb070') }, uC2: { value: new T3.Color('#ff3a1a') } };
    const corona = new T3.Mesh(new T3.PlaneGeometry(9.6, 9.6), shaderMat(UV_VS, CORONA_FS, D.coronaU, { additive: true, side: T3.DoubleSide }));
    corona.renderOrder = 12; hover.add(corona); D.corona = corona;
    // ---- surface prominence loops (animated by shader)
    D.loops = [];
    const loopSpecs = [[0.4, 1.2, 0.7, 2.2], [1.6, 2.4, 0.6, 1.7], [2.9, 3.5, 0.9, 1.3], [4.2, 5.1, 0.55, 2.6], [5.4, 0.2, 0.8, 1.0]];
    loopSpecs.forEach(([a0, a1, h, el], i) => {
      const p0 = sph(STAR_R * 0.98, a0, el), p1 = sph(STAR_R * 0.98, a1, el + 0.25);
      const mid = p0.clone().add(p1).multiplyScalar(0.5); const out = mid.clone().normalize().multiplyScalar(STAR_R + h);
      const curve = new T3.QuadraticBezierCurve3(p0, out, p1);
      const U = { uTime: { value: 0 }, uA: { value: 1 }, uHead: { value: 1.1 }, uOpacity: { value: 1 }, uSeed: { value: i * 1.7 }, uCol: { value: new T3.Color('#ff9a40').multiplyScalar(1.2) }, uCol2: { value: new T3.Color('#ffe2a0').multiplyScalar(1.4) } };
      const m = new T3.Mesh(new T3.TubeGeometry(curve, 24, 0.07 + (i % 2) * 0.03, 6), shaderMat(UV_VS, FLOW_FS, U, { additive: true }));
      m.renderOrder = 11; hover.add(m); D.loops.push({ m, U, ph: i * 1.3, sp: 0.35 + (i % 3) * 0.12 });
    });
    // ---- accretion disk (Collapse onward)
    D.diskU = { uTime: { value: 0 }, uA: { value: 0 }, uOpacity: { value: 1 }, uIn: { value: 1.0 }, uOut: { value: 4.4 }, uSpin: { value: 1.2 }, uC1: { value: new T3.Color(ACC).multiplyScalar(0.9) }, uC2: { value: new T3.Color('#ffffff').multiplyScalar(1.6) } };
    const disk = new T3.Mesh(new T3.RingGeometry(1.0, 4.4, 160, 4), shaderMat(UV_VS, DISK_FS, D.diskU, { additive: true, side: T3.DoubleSide }));
    disk.rotation.x = -PI / 2 + 0.32; disk.rotation.y = 0.2; disk.renderOrder = 10; disk.visible = false; hover.add(disk); D.disk = disk;

    // ---- the sun mask (front, +x), two halves that split apart as the star dies
    const mask = new T3.Group(); hover.add(mask); D.mask = mask;
    D.maskHalves = [];
    for (const s of [-1, 1]) {
      const half = new T3.Group(); mask.add(half); D.maskHalves.push({ g: half, s });
      // sphere segment: u = 0..1 maps phi from (PI-0.82) to (PI+0.82); the half takes one side of the face
      const phiS = s < 0 ? PI - 0.82 : PI, geo = new T3.SphereGeometry(STAR_R + 0.2, 20, 22, phiS, 0.82, PI / 2 - 0.98, 1.96);
      // shift UVs so each half samples its side of the shared engraving
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5 + (s < 0 ? 0 : 0.5));
      const shell = new T3.Mesh(geo, maskMat); half.add(shell);
      // rim bead along the outer edge
      const rimPts = []; for (let k = 0; k <= 20; k++) { const th = PI / 2 - 0.98 + 1.96 * k / 20; rimPts.push(sph(STAR_R + 0.24, s < 0 ? PI - 0.82 : PI + 0.82, th)); }
      half.add(new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3(rimPts), 30, 0.05, 6), brass));
      // eye: an almond slit + a brass brow
      const ePhi = PI + s * 0.3, eTh = 1.2;
      const en = sph(1, ePhi, eTh);
      const eye = new T3.Mesh(new T3.SphereGeometry(1, 16, 10), eyeMat);
      eye.scale.set(0.3, 0.085, 0.05); eye.position.copy(sph(STAR_R + 0.22, ePhi, eTh)); eye.quaternion.copy(qFromZ(en));
      half.add(eye); D['eye' + (s < 0 ? 'L' : 'R')] = eye;
      const socket = new T3.Mesh(new T3.TorusGeometry(0.26, 0.04, 6, 24), brassDark);
      socket.scale.set(1.25, 0.55, 1); socket.position.copy(sph(STAR_R + 0.23, ePhi, eTh)); socket.quaternion.copy(qFromZ(en)); half.add(socket);
      const brow = new T3.Mesh(new T3.TorusGeometry(0.42, 0.045, 6, 20, PI * 0.62), brass);
      brow.position.copy(sph(STAR_R + 0.26, ePhi, eTh - 0.2)); brow.quaternion.copy(qFromZ(en)).multiply(new T3.Quaternion().setFromAxisAngle(V3(0, 0, 1), PI * 0.19 + (s > 0 ? -0.12 : 0.12)));
      half.add(brow);
      // cheek ridge
      const ck = []; for (let k = 0; k <= 8; k++) ck.push(sph(STAR_R + 0.24, PI + s * (0.12 + 0.5 * k / 8), 1.62 + 0.25 * Math.sin(k / 8 * PI)));
      half.add(new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3(ck), 16, 0.035, 5), brass));
    }
    // mouth slit, forehead gem and the third-eye spike (centre line)
    const mn = sph(1, PI, 1.95);
    const mouth = new T3.Mesh(new T3.SphereGeometry(1, 16, 8), eyeMat); mouth.scale.set(0.34, 0.035, 0.04);
    mouth.position.copy(sph(STAR_R + 0.22, PI, 1.95)); mouth.quaternion.copy(qFromZ(mn)); mask.add(mouth); D.mouth = mouth;
    const gem = new T3.Mesh(new T3.OctahedronGeometry(0.16, 0), gemMat); gem.scale.set(0.8, 1.4, 0.8);
    gem.position.copy(sph(STAR_R + 0.3, PI, 0.78)); mask.add(gem); D.gem = gem;
    // ---- sun-ray crown fanned around the mask (in the boss's y-z plane, behind the face)
    const rays = new T3.Group(); rays.position.x = 0.55; mask.add(rays); D.rays = [];
    const NR = 18;
    for (let i = 0; i < NR; i++) {
      const a = i / NR * TAU, long = i % 2 === 0, len = long ? 1.55 : 0.95;
      const geo = new T3.ExtrudeGeometry(flameShape(len, long ? 0.16 : 0.11, (i % 4 < 2 ? 0.12 : -0.12)), { depth: 0.06, bevelEnabled: false, curveSegments: 6 });
      geo.translate(0, 0, -0.03);
      const ray = new T3.Mesh(geo, brass);
      const holder = new T3.Group(); holder.rotation.x = a; rays.add(holder);
      ray.position.y = STAR_R + 0.18; ray.rotation.y = PI / 2; holder.add(ray);
      if (long) { const tip = new T3.Mesh(new T3.OctahedronGeometry(0.075, 0), gemMat); tip.position.y = STAR_R + 0.18 + len + 0.06; holder.add(tip); }
      D.rays.push({ holder, ray, a, len, long, out: 0, spin: 0 });
    }
    // ---- astrolabe crown
    const crown = new T3.Group(); hover.add(crown); D.crown = crown;
    const mater = new T3.Mesh(new T3.TorusGeometry(3.05, 0.12, 10, 128), brass); mater.rotation.x = PI / 2; crown.add(mater);
    const limb = new T3.Mesh(new T3.RingGeometry(2.5, 2.98, 128, 1), brassInlay); limb.rotation.x = -PI / 2; limb.position.y = 0.02; crown.add(limb);
    // spires around the mater, gem-tipped
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + PI / 12;
      const sp = new T3.Mesh(new T3.ConeGeometry(0.1, i % 2 ? 0.45 : 0.75, 6), brass);
      const p = G.polar(3.05, a, (i % 2 ? 0.34 : 0.48)); sp.position.copy(p); crown.add(sp);
      if (!(i % 2)) { const gm = new T3.Mesh(new T3.OctahedronGeometry(0.09, 0), gemMat); gm.position.copy(G.polar(3.05, a, 0.92)); crown.add(gm); }
    }
    // the rear emblem (weak point, -x): a gold keyhole ring
    const rearG = new T3.Group(); rearG.position.set(-3.05, 0.0, 0); crown.add(rearG); D.rearG = rearG;
    const rearRing = new T3.Mesh(new T3.TorusGeometry(0.32, 0.06, 8, 28), goldGem); rearRing.rotation.y = PI / 2; rearG.add(rearRing);
    const rearCore = new T3.Mesh(new T3.OctahedronGeometry(0.16, 0), goldGem); rearG.add(rearCore);
    const rearGlow = G.mat.glowSprite(GOLD, 1.6, { opacity: 0.8 }); rearG.add(rearGlow); D.rearGlow = rearGlow;
    // rete (the ecliptic ring, 23.4 deg) with flame star-pointers
    const reteHold = new T3.Group(); reteHold.rotation.z = 0.41; crown.add(reteHold);
    const rete = new T3.Group(); reteHold.add(rete); D.rete = rete;
    const reteRing = new T3.Mesh(new T3.TorusGeometry(2.45, 0.05, 6, 100), brass); reteRing.rotation.x = PI / 2; rete.add(reteRing);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      const geo = new T3.ExtrudeGeometry(flameShape(0.55, 0.08, i % 2 ? 0.08 : -0.08), { depth: 0.03, bevelEnabled: false, curveSegments: 4 });
      const ptr = new T3.Mesh(geo, brass);
      const hold = new T3.Group(); hold.rotation.y = a; rete.add(hold);
      ptr.position.set(2.45, 0, 0); ptr.rotation.z = PI / 2; ptr.rotation.x = PI / 2; hold.add(ptr);
      const tip = new T3.Mesh(new T3.OctahedronGeometry(0.06, 0), gemMat); tip.position.set(1.85, 0, 0); hold.add(tip);
    }
    // meridian hoops (gimbal)
    D.hoops = [];
    for (let i = 0; i < 2; i++) {
      const pivot = new T3.Group(); crown.add(pivot);
      const tilt = new T3.Group(); tilt.rotation.z = i ? -0.35 : 0.22; pivot.add(tilt);
      const spin = new T3.Group(); tilt.add(spin);
      const hoop = new T3.Mesh(new T3.TorusGeometry(2.72 + i * 0.2, 0.06, 6, 110), i ? brass : brassDark); spin.add(hoop);
      for (let k = 0; k < 4; k++) { const bead = new T3.Mesh(new T3.SphereGeometry(0.1, 10, 8), k % 2 ? gemMat : brass); const a = k / 4 * TAU; bead.position.set(Math.cos(a) * (2.72 + i * 0.2), Math.sin(a) * (2.72 + i * 0.2), 0); spin.add(bead); }
      D.hoops.push({ pivot, tilt, spin, i, off: V3(), drift: V3((i ? -1 : 1) * 0.5, i ? 0.35 : -0.25, i ? 0.4 : -0.5) });
    }
    // alidade (sighting rule) spinning above the star, with a finial
    const ali = new T3.Group(); ali.position.y = STAR_R + 0.38; crown.add(ali); D.alidade = ali;
    const bar = new T3.Mesh(new T3.BoxGeometry(6.3, 0.07, 0.2), brassDark); ali.add(bar);
    for (const s of [-1, 1]) { const vane = new T3.Mesh(new T3.BoxGeometry(0.06, 0.42, 0.2), brass); vane.position.set(s * 3.1, 0.2, 0); ali.add(vane); const vg = new T3.Mesh(new T3.SphereGeometry(0.06, 8, 6), gemMat); vg.position.set(s * 3.1, 0.45, 0); ali.add(vg); }
    const pin = new T3.Mesh(new T3.CylinderGeometry(0.07, 0.11, 0.6, 8), brass); pin.position.y = 0.25; ali.add(pin);
    const fin = new T3.Mesh(new T3.OctahedronGeometry(0.2, 0), gemMat); fin.scale.set(0.7, 1.6, 0.7); fin.position.y = 0.75; ali.add(fin); D.finial = fin;
    // pendant (plumb) below the star
    const pend = new T3.Group(); pend.position.y = -STAR_R - 0.05; hover.add(pend); D.pendant = pend;
    const prof = [[0.0, 0], [0.34, -0.05], [0.42, -0.2], [0.2, -0.45], [0.14, -0.9], [0.24, -1.05], [0.08, -1.45], [0.0, -1.6]].map(([r, y]) => new T3.Vector2(r, y));
    pend.add(new T3.Mesh(new T3.LatheGeometry(prof, 16), brass));
    const pg = new T3.Mesh(new T3.OctahedronGeometry(0.13, 0), gemMat); pg.position.y = -1.62; pg.scale.set(0.8, 1.6, 0.8); pend.add(pg);
    // fragments orbiting once the crown fractures
    D.frags = [];
    for (let i = 0; i < 9; i++) {
      const fr = new T3.Mesh(i % 3 ? new T3.TetrahedronGeometry(0.16 + (i % 4) * 0.05, 0) : new T3.BoxGeometry(0.42, 0.08, 0.16), i % 2 ? brass : brassDark);
      fr.visible = false; hover.add(fr);
      D.frags.push({ m: fr, a: i / 9 * TAU, r: 3.4 + (i % 3) * 0.35, y: (i % 5 - 2) * 0.35, sp: 0.25 + (i % 4) * 0.07, rot: V3(Math.random(), Math.random(), Math.random()) });
    }
    // reignition core glow (death cinematic)
    const core = G.mat.glowSprite('#ffffff', 0.1, { opacity: 0 }); core.renderOrder = 14; hover.add(core); D.coreGlow = core;

    // ---- floor: heat glow and the event-horizon disc (separate group in the boss layer, never fades)
    const floor = new T3.Group(); floor.name = 'heliarchFloor';
    D.heatU = { uTime: { value: 0 }, uA: { value: 0 }, uCol: { value: new T3.Color('#ff5a20') } };
    const heat = new T3.Mesh(new T3.CircleGeometry(4.7, 64), shaderMat(UV_VS, HEAT_FS, D.heatU, { additive: true }));
    heat.rotation.x = -PI / 2; heat.position.y = 0.02; heat.renderOrder = 2; floor.add(heat);
    D.horU = { uTime: { value: 0 }, uA: { value: 0 }, uPulse: { value: 0 }, uRim: { value: new T3.Color(HOT).multiplyScalar(1.2) } };
    const hor = new T3.Mesh(new T3.CircleGeometry(1, 96), shaderMat(UV_VS, HORIZON_FS, D.horU, {}));
    hor.rotation.x = -PI / 2; hor.position.y = 0.035; hor.renderOrder = 3; hor.visible = false; hor.scale.setScalar(0.01); floor.add(hor); D.horizon = hor;
    (G.layers.boss || G.scene).add(floor); D.floor = floor;

    D.shaderMats = [starMat, corona.material, disk.material, ...D.loops.map(l => l.m.material)];
    b.model = g;

    // brace listeners (gravity well): an outward Shift, or an outward bump on the outer ring
    D.onShift = G.on('shift', (d) => { if (!d || d.forced || !(d.to > d.from)) return; D.lastOutShift = b.clock; if (D.well && D.well.winOn) braceWell(b, D.well); });
    D.onBump = G.on('bump', (d) => { if (!d || !(d.delta > 0)) return; D.lastOutShift = b.clock; if (D.well && D.well.winOn) braceWell(b, D.well); });
  }

  // ================================================================ ANIMATION
  const _q = new T3.Quaternion(), _q2 = new T3.Quaternion(), _v = V3(), _v2 = V3();
  const RATES = { crack: 1.2, collapse: 2.4, horizon: 1.4, calm: 0.9, disk: 1.0, crownBreak: 1.3, mask: 1.1, hot: 1.5, heat: 1.0, corona: 1.2 };
  function animate(b, dt) {
    const D = b.data; if (!D || !D.hover) return;
    D.t += dt; const t = D.t;
    for (const k in D.look) D.cur[k] = damp(D.cur[k], D.look[k], RATES[k] || 1.2, dt);
    const C = D.cur;
    // emerge at the start of the fight: the star rises out of the chart and the crown assembles
    if (D.emerge < 1) D.emerge = Math.min(1, D.emerge + dt / 2.4);
    const em = G.easeOutCubic(D.emerge);
    D.swell = damp(D.swell, D.swellT, 3, dt);
    D.pulse = Math.max(0, D.pulse - dt * 1.6);
    D.castGlow = damp(D.castGlow, b.casting ? 1 : 0, 6, dt);
    const hy = lerp(1.2, HOVER_Y, em) + Math.sin(t * 0.9) * 0.12 + (D.dyingDrop || 0);
    D.hoverY = hy; D.hover.position.y = hy;
    // star: swollen, then collapsed, then a horizon, then (death) a calm new star
    const collapseK = C.collapse, calmK = C.calm;
    let sc = lerp(1, 0.46, collapseK) * (1 + D.swell * 0.16 + D.pulse * 0.1 + Math.sin(t * 1.3) * 0.012);
    sc = lerp(sc, 0.82, calmK) * D.starScaleK;
    D.star.scale.setScalar(Math.max(0.01, sc * lerp(0.4, 1, em)));
    const U = D.starU;
    U.uTime.value = t; U.uCrack.value = C.crack; U.uCollapse.value = clamp(collapseK - C.horizon * 0.2, 0, 1); U.uHorizon.value = C.horizon; U.uCalm.value = calmK;
    U.uHit.value = Math.max(b.hitFlash || 0, D.castGlow * (0.35 + 0.35 * Math.sin(t * 14))); U.uSwell.value = D.swell + D.pulse * 0.6; U.uHot.value = C.hot;
    U.uRear.value = b.alive ? 1 : Math.max(0, 1 - calmK * 2);
    // corona billboard: rays, colour per phase
    const cor = D.corona;
    cor.parent.getWorldQuaternion(_q); _q.invert(); if (G.camera) _q.multiply(G.camera.quaternion); cor.quaternion.copy(_q);
    const CU = D.coronaU; CU.uTime.value = t;
    const coreR = 0.36 * sc;
    CU.uCore.value = Math.max(0.05, coreR); CU.uRays.value = 0.55 + C.crack * 0.7 + collapseK * 0.4 + D.swell * 0.8;
    CU.uInt.value = C.corona * em * (1 + D.pulse * 1.5 + D.swell * 0.6) * (1 - C.horizon * 0.55);
    _v.set(1, 0.69, 0.44).lerp(V3(0.75, 0.55, 1.0), Math.max(C.crack * 0.45, collapseK)).lerp(V3(1, 0.97, 1.0), C.horizon * 0.8).lerp(V3(1, 0.86, 0.55), calmK);
    CU.uC1.value.setRGB(_v.x * 1.3, _v.y * 1.3, _v.z * 1.3);
    _v.set(1, 0.23, 0.1).lerp(V3(0.6, 0.3, 1.0), Math.max(C.crack * 0.6, collapseK)).lerp(V3(0.5, 0.35, 1), C.horizon).lerp(V3(1, 0.62, 0.25), calmK);
    CU.uC2.value.setRGB(_v.x, _v.y, _v.z);
    cor.scale.setScalar(lerp(1, 1.25, C.crack) * lerp(1, 0.9, collapseK) * (1 + D.swell * 0.2));
    // surface loops: rise and fall; hidden once the star has collapsed
    for (const L of D.loops) {
      L.U.uTime.value = t;
      const ph = (t * L.sp + L.ph) % 1;
      L.U.uHead.value = ph < 0.55 ? ph / 0.55 * 1.1 : 1.1;
      L.U.uA.value = (ph < 0.85 ? 1 : 1 - (ph - 0.85) / 0.15) * (1 - collapseK) * (1 - calmK * 0.6) * em * (1 + C.crack * 0.5);
      L.m.scale.setScalar(sc);
      L.m.visible = L.U.uA.value > 0.01;
    }
    // accretion disk
    const dk = C.disk * (1 - calmK);
    D.disk.visible = dk > 0.01;
    if (D.disk.visible) {
      const DU = D.diskU; DU.uTime.value = t; DU.uA.value = dk * (1 + D.pulse); DU.uSpin.value = 1.1 + C.horizon * 1.4;
      DU.uC1.value.set(C.horizon > 0.5 ? '#c8a8ff' : ACC).multiplyScalar(0.9 + C.horizon * 0.4);
      D.disk.rotation.z = t * 0.05;
      D.disk.scale.setScalar(lerp(0.6, 1, dk));
    }
    // mask halves split apart as the star dies; the eyes flare with casts and close in death
    const split = C.mask;
    for (const h of D.maskHalves) { h.g.position.z = h.s * split * 0.45; h.g.rotation.y = -h.s * split * 0.12; h.g.position.x = -collapseK * 0.25; }
    D.mask.position.y = Math.sin(t * 1.1) * 0.03;
    const eyeK = 1 + D.castGlow * 1.2 + C.hot * 0.6;
    const ec = clamp(1 - D.eyeClose, 0.12, 1);
    for (const e of [D.eyeL, D.eyeR]) { e.scale.set(0.3 * (1 + D.castGlow * 0.15), 0.085 * ec * (1 + D.castGlow * 0.4), 0.05); }
    D.mats.eyeMat.color.set(calmK > 0.5 ? '#ffd890' : (C.horizon > 0.5 ? '#ffffff' : '#efe4ff')).multiplyScalar(3.0 * eyeK);
    D.mouth.scale.y = 0.035 * (1 + D.castGlow * 1.6 + D.swell * 1.2);
    D.gem.rotation.y = t * 1.4;
    D.mats.gemMat.color.set(calmK > 0.5 ? '#ffd27a' : (C.horizon > 0.5 ? HOT : ACC)).multiplyScalar(2.4 + D.castGlow * 1.5 + D.pulse * 2);
    const inlay = 0.7 + C.crack * 0.6 + collapseK * 0.5 + D.castGlow * 1.2;
    D.mats.brassInlay.emissiveIntensity = inlay; D.mats.maskMat.emissiveIntensity = inlay * 0.8;
    if (calmK > 0.3) { D.mats.brassInlay.emissive.set('#ffc070'); D.mats.maskMat.emissive.set('#ffc070'); } else { D.mats.brassInlay.emissive.set(C.horizon > 0.5 ? HOT : ACC); D.mats.maskMat.emissive.set(C.horizon > 0.5 ? HOT : ACC); }
    // sun rays breathe; some detach once the crown fractures
    const br = C.crownBreak;
    D.rays.forEach((r, i) => {
      const detach = br * (i % 5 === 1 ? 1 : i % 5 === 3 ? 0.6 : 0);
      r.ray.position.y = STAR_R + 0.18 + Math.sin(t * 1.6 + i) * 0.04 + detach * (0.8 + Math.sin(t * 0.7 + i) * 0.2) + D.swell * 0.25;
      r.ray.rotation.z = detach * Math.sin(t * 0.9 + i) * 0.5;
      r.holder.rotation.x = r.a + Math.sin(t * 0.4 + i * 0.5) * 0.02 + detach * Math.sin(t * 0.3 + i) * 0.1;
      r.ray.scale.setScalar(lerp(0.3, 1, em) * (1 + D.swell * 0.15) * lerp(1, 0.75, collapseK));
    });
    // crown motion: rete turns (sidereal), hoops gimbal, the alidade sweeps; all speed up as the star collapses
    const spd = 1 + collapseK * 1.6 + C.horizon * 1.2 - calmK * 0.6;
    D.rete.rotation.y += dt * 0.22 * spd;
    D.alidade.rotation.y -= dt * 0.35 * spd;
    D.finial.rotation.y += dt * 1.2;
    for (const h of D.hoops) {
      h.spin.rotation.z += dt * (h.i ? -0.3 : 0.42) * spd; h.pivot.rotation.y += dt * (h.i ? 0.12 : -0.08) * spd;
      _v.copy(h.drift).multiplyScalar(br * (1 + 0.15 * Math.sin(t * 0.8 + h.i)));
      h.pivot.position.lerp(_v, Math.min(1, dt * 3));
      h.tilt.rotation.x = br * Math.sin(t * 0.5 + h.i * 2) * 0.25;
    }
    D.crown.rotation.x = damp(D.crown.rotation.x, collapseK * 0.32 - calmK * 0.32, 1.2, dt);
    D.crown.rotation.z = damp(D.crown.rotation.z, collapseK * 0.12 * Math.sin(t * 0.3), 1.2, dt);
    D.crown.scale.setScalar(lerp(0.55, 1, em));
    D.rearGlow.material.opacity = 0.55 + 0.35 * Math.sin(t * 5) * (b.alive ? 1 : 0);
    D.rearG.visible = b.alive || calmK < 0.5;
    // fragments orbit once the crown cracks
    for (const f of D.frags) {
      f.m.visible = br > 0.05;
      if (!f.m.visible) continue;
      f.a += dt * f.sp * spd;
      const rr = lerp(2.9, f.r, br) * (1 + collapseK * 0.1);
      f.m.position.set(Math.cos(f.a) * rr, f.y * br + Math.sin(t + f.a) * 0.1, Math.sin(f.a) * rr);
      f.m.rotation.x += dt * f.rot.x; f.m.rotation.y += dt * f.rot.y;
      f.m.scale.setScalar(br);
    }
    D.pendant.rotation.y += dt * 0.4;
    D.pendant.position.y = -STAR_R * lerp(1, 0.6, collapseK) - 0.05;
    // reignition core
    if (D.coreK != null) { D.coreGlow.material.opacity = clamp(D.coreK, 0, 1); D.coreGlow.scale.setScalar(0.2 + D.coreK * 6); }
    // floor discs
    D.heatU.uTime.value = t; D.heatU.uA.value = C.heat * em * (1 + D.pulse * 1.5 + D.swell);
    D.heatU.uCol.value.set(calmK > 0.4 ? '#ffb050' : (collapseK > 0.5 ? '#8a5cff' : '#ff5a20'));
    const hr = D.horizonR;
    D.horizon.visible = hr > 0.05;
    if (D.horizon.visible) {
      D.horU.uTime.value = t; D.horU.uA.value = clamp(hr / 0.6, 0, 1); D.horU.uPulse.value = D.pulse;
      D.horizon.scale.setScalar(hr * (1 + D.pulse * 0.04));
    }
    // fade support: the framework sets material.opacity, which these shaders read through a uniform
    const op = D.star.material.opacity != null ? D.star.material.opacity : 1;
    D.starU.uOpacity.value = op; D.coronaU.uOpacity.value = op; D.diskU.uOpacity.value = op;
    for (const L of D.loops) L.U.uOpacity.value = op;
    // flare streams from the star to every live sweep beam this boss cast
    if (D.flares.length) {
      D.flareT = (D.flareT || 0) - dt;
      const emit = D.flareT <= 0; if (emit) D.flareT = 0.07;
      for (let i = D.flares.length - 1; i >= 0; i--) {
        const h = D.flares[i].hazard;
        if (!h || h.finished || h.dead) { D.flares.splice(i, 1); continue; }
        if (emit && h.lt >= h.warn) {
          const a = h.beamAt(h.lt), rr = h.rings.reduce((s, k) => s + RING(k), 0) / h.rings.length;
          const from = starPos(b).add(G.polar(STAR_R * sc * 0.9, a, 0));
          const to = G.polar(rr, a, 0.25);
          fx('lance', from, to, { color: C.horizon > 0.5 ? HOT : FLARE, width: 0.42, life: 0.12, intensity: 2.2, flare: false });
          fx('burst', to, { color: C.horizon > 0.5 ? HOT : EMBER, count: 3, speed: 3, size: 0.4, life: 0.35, flare: false });
        }
      }
    }
    // temporary vfx meshes
    for (let i = D.vfx.length - 1; i >= 0; i--) {
      const v = D.vfx[i]; v.t += dt;
      try { v.update && v.update(v, dt); } catch (e) { logE('vfx', e); v.t = v.life; }
      if (v.t >= v.life) { killVfx(v); D.vfx.splice(i, 1); }
    }
    // the rings bend into the gravity well (visual only)
    const wr = G.world && G.world.rings;
    if (wr && wr.length) for (let i = 0; i < wr.length; i++) { const y = -(D.dips[i] || 0); if (wr[i].position.y !== y) wr[i].position.y = y; }
  }
  function killVfx(v) {
    if (!v.obj) return;
    if (v.obj.parent) v.obj.parent.remove(v.obj);
    v.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !(o.material.userData && o.material.userData.shared)) o.material.dispose(); });
    v.obj = null;
  }
  function addVfx(b, obj, life, update, layer) {
    (layer || G.layers.fx || G.scene).add(obj);
    const v = { obj, life, t: 0, update }; b.data.vfx.push(v); return v;
  }

  // ================================================================ GRAVITY WELL
  // Every ~12 s the star pulls the knight one ring inward. Shifting OUT during the last 1.2 s ("brace window")
  // resists it. On the inner ring there is nowhere further to fall: the corona crushes you instead.
  function braceWell(b, st) {
    if (st.braced) return;
    st.braced = true;
    const S = PS(); if (!S) return;
    fx('text', S.pos.clone().setY(S.pos.y + 1.9), 'BRACED', { color: GOLD_HOT, size: 0.7, life: 0.9 });
    fx('burst', S.pos.clone().setY(0.5), { color: GOLD, count: 14, speed: 4, size: 0.4, life: 0.5 });
  }
  let wellGeo = null;
  function gravityWell(b, o = {}) {
    const D = b.data;
    const warn = o.warn || 2.4, win = o.window || 1.2, crush = o.crush || 25, label = o.label || 'Gravity Well';
    const st = { braced: false, winOn: false, warn, win };
    D.well = st;
    sfx('gravity', { vol: 1 });
    world('ringGlow', 'all', accentNow(), 0.55, warn);
    if (!D.said.well) { D.said.well = 1; b.say('Come closer, little star. Everything falls to me.', 2.8); }
    const h = G.hz.custom({
      warn, active: 0.12, dmg: crush, label,
      // only predictions (ghost trail, bot) see it, as danger on the inner ring: the pull itself is resolved in onFire
      test: (ring, theta, lt, pad) => pad > 0 && !st.braced && ring === 0,
      draw: (group) => {
        if (!wellGeo) { wellGeo = new T3.RingGeometry(4.4, 13.6, 160, 1); wellGeo.rotateX(-PI / 2); }
        const U = { uTime: { value: 0 }, uProg: { value: 0 }, uBrace: { value: 0 }, uA: { value: 1 }, uCol: { value: new T3.Color(accentNow()) }, uGold: { value: new T3.Color(GOLD) } };
        const m = new T3.Mesh(wellGeo, shaderMat(`varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`, WELL_FS, U, {}));
        m.userData.sharedGeo = true; m.position.y = 0.075; m.renderOrder = 7; m.frustumCulled = false;
        group.add(m);
        return (lt, dt) => {
          U.uTime.value += dt; U.uProg.value = clamp(lt / warn, 0, 1);
          const inWin = lt >= warn - win && lt < warn;
          if (inWin && !st.winOn) {
            st.winOn = true;
            if (b.clock - D.lastOutShift < 0.35) braceWell(b, st);   // a Shift Out pressed a hair early still counts
            const S = PS();
            if (S && S.alive && !st.braced) fx('text', S.pos.clone().setY(S.pos.y + 1.9), 'SHIFT OUT!', { color: GOLD_HOT, size: 0.62, life: 1.0, rise: 0.6 });
            sfx('warn', { vol: 0.8 });
          }
          U.uBrace.value = st.winOn && !st.braced ? 1 : 0;
          const k = sm(lt / warn);
          D.dips[0] = 0.28 * k; D.dips[1] = 0.17 * k; D.dips[2] = 0.09 * k;
        };
      },
      onFire: () => resolveWell(b, st, crush, label),
    });
    st.h = h;
    h.done.then(() => { if (D.well === st) D.well = null; D.dips[0] = D.dips[1] = D.dips[2] = 0; });
    return h;
  }
  function resolveWell(b, st, crush, label) {
    const D = b.data; st.winOn = false;
    D.dips[0] = D.dips[1] = D.dips[2] = 0;
    for (let k = 0; k < 3; k++) fx('ringFlash', k, { color: accentNow(), life: 0.5, intensity: 1.4 });
    fx('shockwave', V3(0, 0.2, 0), { color: accentNow(), radius: 4.5, life: 0.5, thickness: 0.4 });
    D.pulse = Math.max(D.pulse, 0.8);
    cam('shake', 0.35, 0.3);
    const S = PS(); if (!S || !S.alive) return;
    if (st.braced) { sfx('aegisUp', { vol: 0.4 }); return; }
    if (S.novaActive || G.combat.transitioning) return;
    if (S.aegisActive) { G.player.damage(crush, label); return; }       // Aegis holds you (and reflects)
    if (S.ring === 0) {
      const r = G.player.damage(crush, label);
      if (r.applied) { fx('burst', S.pos.clone().setY(0.5), { color: FLARE, count: 26, speed: 5, size: 0.5, life: 0.7 }); fx('text', S.pos.clone().setY(S.pos.y + 1.9), 'CRUSHED', { color: '#ffb3c0', size: 0.62 }); }
      return;
    }
    const to = S.ring - 1;
    if (G.hz.gapAt(to, S.theta)) return;        // the well never drags you onto broken track
    G.player.forceShift(-1, {});
    sfx('shift', { dir: 'in' });
    fx('text', S.pos.clone().setY(S.pos.y + 1.9), 'PULLED IN', { color: '#d9c8ff', size: 0.55, life: 0.8 });
    const p = S.pos.clone().setY(0.4);
    fx('lance', p, starPos(b), { color: accentNow(), width: 0.25, life: 0.3, intensity: 1.6, flare: false });
  }

  // ================================================================ ATTACK PRIMITIVES
  const otherRings = (r) => [0, 1, 2].filter(k => k !== r);
  function pairFor(b, r) { if (r === 0) return [0, 1]; if (r === 2) return [1, 2]; return b.rand() < 0.5 ? [0, 1] : [1, 2]; }
  function trackFlare(b, h) { if (h && h.hazard) b.data.flares.push(h); return h; }

  // Flare Lash: one long flare across two rings; the uncovered wedge sits behind the knight
  async function flareLash(b, o = {}) {
    const r = b.playerRing(), d = b.playerDir(), th = b.playerTheta();
    const rings = o.rings || pairFor(b, r);
    const span = o.span || PI * 1.5;
    const from = th - d * (o.back != null ? o.back : 1.0), to = from + d * span;
    b.data.swellT = 0.4; later(b, (o.warn || 2.0) + 0.3, () => { b.data.swellT = 0; });
    const h = trackFlare(b, G.hz.sweep({ rings, from, to, warn: o.warn || 2.0, dur: o.dur || 2.8, width: 0.24, dmg: o.dmg || 24, label: o.label || 'Flare Lash', color: o.color }));
    if (!b.data.said.lash) { b.data.said.lash = 1; b.say('Burn.', 1.6); }
    if (o.noWait) return h;
    await h;
  }
  // Solar Flares: three short flares from three angles, all on the same two rings; the third ring is free
  async function solarFlares(b, o = {}) {
    const r = b.playerRing();
    const free = o.free != null ? o.free : (r === 1 ? (b.rand() < 0.5 ? 0 : 2) : 1);
    const rings = o.rings || otherRings(free);
    const base = b.playerAhead(2.0) + b.randRange(-0.3, 0.3), n = o.n || 3;
    const hs = [];
    b.data.swellT = 0.6;
    for (let i = 0; i < n; i++) {
      const c = base + i * TAU / n + (i ? b.randRange(-0.2, 0.2) : 0);
      const sg = i % 2 ? 1 : -1;
      hs.push(trackFlare(b, G.hz.sweep({ rings, from: c - sg * 0.95, to: c + sg * 0.95, warn: (o.warn || 1.9) + i * 0.32, dur: 1.4, width: 0.24, dmg: o.dmg || 22, label: o.label || 'Solar Flare', color: o.color })));
    }
    world('ringGlow', free, GOLD, 0.45, 2.4);
    if (!b.data.said.flares) { b.data.said.flares = 1; b.say('My flares reach every orbit but one.', 2.6); }
    await hs[hs.length - 1];
    b.data.swellT = 0;
  }
  // a single prominence: erupts on the inner ring and leaps outward ring by ring
  function prominence(b, c, o = {}) {
    const w = o.width || 0.5, t0 = o.warn || 1.7, step = o.step || 0.42, dmg = o.dmg || 22;
    const rings = o.rings || [0, 1, 2];
    let last = null;
    rings.forEach((k, idx) => {
      const R = RING(k), warn = t0 + idx * step;
      last = G.hz.custom({
        warn, active: 0.3, dmg, label: o.label || 'Prominence',
        test: (ring, theta, lt, pad) => ring === k && Math.abs(angDiff(theta, c)) < w / 2 + (0.15 + pad) / R,
        draw: (group) => {
          group.add(G.combat.bandMesh(R - 0.68, R + 0.68, c - w / 2, c + w / 2, 0, o.color || accentNow(), {}));
          // the plasma arch, hidden until it erupts
          const a = idx === 0 ? G.polar(2.0, c, 1.4) : G.polar(RING(rings[idx - 1]), c, 0.1), bb = G.polar(R, c, 0.1);
          const U = { uTime: { value: 0 }, uA: { value: 0 }, uHead: { value: 0 }, uOpacity: { value: 1 }, uSeed: { value: c * 3 }, uCol: { value: new T3.Color(o.color || accentNow()).multiplyScalar(1.3) }, uCol2: { value: new T3.Color(FLARE).multiplyScalar(1.6) } };
          const tube = new T3.Mesh(new T3.TubeGeometry(arcCurve(a, bb, 2.2 + idx * 0.5), 26, 0.26, 6), shaderMat(UV_VS, FLOW_FS, U, { additive: true }));
          tube.renderOrder = 9; tube.frustumCulled = false; group.add(tube);
          return (lt, dt) => {
            U.uTime.value += dt;
            const e = lt - warn + 0.12;
            U.uHead.value = clamp(e / 0.15, 0, 1.1); U.uA.value = e > 0 ? clamp(1 - (e - 0.24) / 0.18, 0, 1) * 1.5 : 0;
          };
        },
        onFire: () => {
          const p = G.polar(R, c, 0.3);
          fx('burst', p, { color: o.color || accentNow(), count: 16, speed: 5, size: 0.55, life: 0.6, up: 1.2 });
          fx('burst', p, { color: FLARE, count: 8, speed: 3, size: 0.5, life: 0.5 });
          fx('ringFlash', k, { color: o.color || accentNow(), a0: c - w / 2, a1: c + w / 2, life: 0.5 });
          sfx('crack', { vol: 0.5 });
          if (idx === 0) cam('shake', 0.25, 0.2);
        },
      });
    });
    return last;
  }
  // the star exhales after a salvo: its facing locks, so the back stays put for a few seconds
  function exhale(b, dur) { const D = b.data; b.faceTo(b.facing); D.exhaleEnd = b.clock + dur; D.swellT = -0.3; }
  async function prominences(b, o = {}) {
    const n = o.n || 3, c0 = b.playerAhead(o.lead || 2.0) + (o.off || 0);
    let last = null;
    for (let i = 0; i < n; i++) last = prominence(b, c0 + i * TAU / n + (i ? b.randRange(-0.3, 0.3) : 0), o);
    if (!b.data.said.prom) { b.data.said.prom = 1; b.say('Rise, my prominences.', 2.2); }
    if (o.noWait) { if (o.exhale !== false) later(b, (o.warn || 1.7) + 0.9, () => exhale(b, o.exhaleDur || 2.6)); return last; }
    await last;
    if (o.exhale !== false) exhale(b, o.exhaleDur || 2.6);
  }
  // ---- combos (each returns when the next attack may start, often while this one is still live)
  async function lashCombo(b, o = {}) {
    const r = b.playerRing(), rings = pairFor(b, r), free = [0, 1, 2].find(k => !rings.includes(k));
    flareLash(b, { rings, noWait: true, color: o.color });
    await b.wait(0.9);
    // a prominence on the free ring, right where a shift would carry the knight
    prominence(b, b.playerAhead(1.9), { rings: [free], warn: 1.5, color: o.color });
    if (o.surge && free !== 0) coronaSurge(b, {});
    await b.wait(2.3);
  }
  async function salvoCombo(b, o = {}) {
    prominences(b, { n: o.n || 3, noWait: true, color: o.color, rings: o.rings });
    await b.wait(1.5);
    lensing(b, { n: 3, lead: 1.6, warn: 1.6, color: o.color });
    await b.wait(2.6);
  }
  async function surgeLash(b) {
    coronaSurge(b, {});
    flareLash(b, { rings: [1, 2], noWait: true, warn: 2.2 });
    await b.wait(3.3);
  }
  // two flares on two rings sweeping toward each other through the knight
  async function pincer(b, o = {}) {
    const r = b.playerRing(), th = b.playerTheta(), d = b.playerDir();
    const rings = pairFor(b, r), mine = rings.indexOf(r) >= 0 ? r : rings[0], other = rings.find(k => k !== mine);
    trackFlare(b, G.hz.sweep({ rings: [mine], from: th - d * 1.3, to: th + d * 2.3, warn: 1.9, dur: 2.0, width: 0.24, dmg: 22, label: 'Pincer Flare', color: o.color }));
    trackFlare(b, G.hz.sweep({ rings: [other], from: th + d * 2.8, to: th - d * 0.9, warn: 2.3, dur: 2.0, width: 0.24, dmg: 22, label: 'Pincer Flare', color: o.color }));
    if (!b.data.said.pincer) { b.data.said.pincer = 1; b.say('Nowhere to run but where I allow.', 2.4); }
    await b.wait(3.1);
  }
  // Corona Surge: the inner ring detonates. Timed to land just after a pending gravity well
  async function coronaSurge(b, o = {}) {
    const D = b.data;
    let warn = o.warn || 2.6;
    if (D.well && D.well.h) { const f = D.well.h.fireAt - (G.t || 0); if (f > 0.4 && f < 4) warn = Math.max(warn, f + 1.3); }
    const h = G.hz.ring({ ring: 0, warn, active: 0.4, dmg: o.dmg || 32, label: 'Corona Surge', color: o.color });
    D.swellT = 0.5; later(b, warn, () => { D.swellT = 0; D.pulse = 1; });
    await h;
  }
  // Lensing: light bent around the star lands as bolts ahead of the knight
  async function lensing(b, o = {}) {
    const r = b.playerRing(), n = o.n || 4;
    const top = starPos(b).add(V3(0, STAR_R + 0.8, 0));
    for (let i = 0; i < n; i++) G.hz.bolt({ from: top.clone(), ring: r, theta: b.playerAhead((o.lead || 1.4) + i * (o.gapT || 0.55)), warn: (o.warn || 1.5) + i * 0.18, radius: 1.0, dmg: o.dmg || 20, label: o.label || 'Lensed Light', color: o.color });
    await b.wait((o.warn || 1.5) + n * 0.18 + 0.5);
  }

  // ---- Fracture: segments of track break away (gap hazards) -------------------------------------------
  const MAX_GAPS = 5;
  function liveGaps(b) { const D = b.data; D.gaps = D.gaps.filter(g => g.h && g.h.hazard && !g.h.hazard.finished); return D.gaps; }
  function gapOk(b, ring, center, width) {
    const gs = liveGaps(b);
    if (gs.length >= MAX_GAPS) return false;
    if (gs.filter(g => g.ring === ring).length >= 2) return false;
    for (const g of gs) if (g.ring === ring && Math.abs(angDiff(g.center, center)) < (g.width + width) / 2 + 0.9) return false;
    // never wall off an angle across all three rings
    const others = otherRings(ring).filter(k => gs.some(g => g.ring === k && Math.abs(angDiff(g.center, center)) < 0.75));
    if (others.length >= 2) return false;
    return true;
  }
  function makeGap(b, ring, center, width, o = {}) {
    if (!o.force && !gapOk(b, ring, center, width)) return null;
    const h = G.hz.gap({ ring, center: G.wrap(center), width, dmg: o.dmg != null ? o.dmg : 25, label: o.label || 'Broken Track' });
    const g = { ring, center: G.wrap(center), width, h };
    b.data.gaps.push(g);
    return g;
  }
  function crack(b, ring, center, o = {}) {
    const width = o.width || 0.42, warn = o.warn || 2.2;
    if (!gapOk(b, ring, center, width)) return false;
    G.hz.arc({ rings: [ring], center, width, warn, active: 0.2, dmg: o.dmg || 20, label: 'Fracture', color: o.color });
    later(b, warn, () => {
      const g = makeGap(b, ring, center, width);
      if (g) { fx('shards', G.polar(RING(ring), center, 0.2), { color: '#ffcf7a', count: 14, speed: 4, floor: -3 }); cam('shake', 0.3, 0.25); }
    });
    return true;
  }
  // pick a crack spot: on the knight's ring ahead of them (forces a reaction), or on another ring
  function crackSpot(b, ring, lead) {
    for (let tries = 0; tries < 8; tries++) {
      const c = b.playerAhead(lead + tries * 0.25) + (tries ? b.randRange(-1.2, 1.2) : 0);
      if (gapOk(b, ring, c, 0.42)) return c;
    }
    return null;
  }
  async function fracture(b, o = {}) {
    const r = b.playerRing(), n = o.n || 2;
    let made = 0;
    const order = [r, ...otherRings(r).sort(() => b.rand() - 0.5)];
    for (const ring of order) {
      if (made >= n) break;
      const c = crackSpot(b, ring, ring === r ? 3.2 : b.randRange(1.5, 4.5));
      if (c != null && crack(b, ring, c, o)) made++;
    }
    if (made && !b.data.said.fracture) { b.data.said.fracture = 1; b.say('Your orbit is only brass. Brass breaks.', 2.6); }
    await b.wait((o.warn || 2.2) + 0.6);
  }
  // Ember Star: a soak star beside a broken segment; catching it mends the track. Missing it cracks another
  function emberStar(b, o = {}) {
    const gs = liveGaps(b); if (!gs.length) return null;
    const S = PS(); if (!S) return null;
    const om = G.OMEGA * (S.speedMul || 1);
    let best = null, bestT = 1e9;
    for (const g of gs) {
      for (const side of [-1, 1]) {
        const th = g.center + side * (g.width / 2 + 0.5);
        if (G.hz.gapAt(g.ring, th)) continue;
        const fwd = (((th - S.theta) * S.dir) % TAU + TAU) % TAU / om;
        const back = (((S.theta - th) * S.dir) % TAU + TAU) % TAU / om + 0.6;
        const tt = Math.min(fwd, back) + Math.abs(g.ring - S.ring) * 0.7;
        if (tt > 1.2 && tt < bestT) { bestT = tt; best = { g, th }; }
      }
    }
    if (!best || bestT > 6.0) return null;
    const { g, th } = best;
    const h = G.hz.soak({
      ring: g.ring, theta: th, warn: Math.max(6.5, bestT + 2.6), radius: 0.8, failDmg: 10, label: 'Ember Star',
      onSoak: () => {
        if (g.h) { g.h.cancel(); }
        fx('ringFlash', g.ring, { color: GOLD, a0: g.center - g.width / 2 - 0.1, a1: g.center + g.width / 2 + 0.1, life: 0.9, intensity: 2.2 });
        fx('text', G.polar(RING(g.ring), g.center, 1.6), 'MENDED', { color: GOLD_HOT, size: 0.6 });
        if (!b.data.said.mend) { b.data.said.mend = 1; b.say('You mend what I break? Insolent spark.', 2.6); }
      },
      onFail: () => { const r = b.playerRing(); const c = crackSpot(b, r, 2.6); if (c != null) crack(b, r, c, { warn: 2.0 }); },
    });
    return h;
  }
  // Spin Up: one ring accelerates the knight to x1.6 for 8 s (anchor pulses and the back come faster, so do threats)
  function spinUp(b, ring, o = {}) {
    const D = b.data, lead = o.lead || 1.4, dur = o.dur || 8;
    const dir = b.playerDir();
    D.spin = { ring, t0: b.clock + lead, end: b.clock + lead + dur, dir };
    world('ringArrows', ring, dir, true);
    world('ringGlow', ring, accentNow(), 0.9, 0);
    sfx('retrograde', { vol: 0.6 }); sfx('swell', { vol: 0.5 });
    fx('ringFlash', ring, { color: accentNow(), life: 0.8, intensity: 1.6 });
    if (!D.said.spin) { D.said.spin = 1; b.say('Faster. Spin as the old worlds spun.', 2.4); }
    later(b, lead + dur, () => endSpin(b));
  }
  function endSpin(b) {
    const D = b.data; if (!D.spin) return;
    const ring = D.spin.ring; D.spin = null;
    world('ringArrows', ring, 1, false); world('ringGlow', ring, accentNow(), 0, 0.5);
    const S = PS(); if (S && S.speedMul !== 1) G.player.setSpeedMul(1, 0);
  }
  function tickSpin(b) {
    const D = b.data, S = PS(); if (!D.spin || !S) return;
    const sp = D.spin;
    if (b.clock >= sp.t0 && b.clock < sp.end && S.ring === sp.ring && S.alive) {
      G.player.setSpeedMul(1.6, Math.max(0.05, sp.end - b.clock));
      if (sp.arrowDir !== S.dir) { sp.arrowDir = S.dir; world('ringArrows', sp.ring, S.dir, true); }
    } else if (S.speedMul !== 1) G.player.setSpeedMul(1, 0);
  }
  async function spinCombo(b, o = {}) {
    const r = b.playerRing();
    spinUp(b, r, {});
    await b.wait(1.6);
    // the other two rings get a flare lash: staying on the spinning ring is the safe (but fast) answer
    const others = otherRings(b.playerRing());
    flareLash(b, { rings: others, noWait: true, warn: 2.0, dur: 2.6 });
    await b.wait(2.4);
    // bolts on the spinning ring, spaced for the faster knight
    if (b.data.spin && b.playerRing() === b.data.spin.ring) await lensing(b, { n: 3, lead: 1.3, gapT: 0.5, warn: 1.5 });
    else await prominences(b, { n: 2, exhale: false });
    await b.wait(1.5);
  }
  // Retrograde: three times, 6 s apart, every ring forces the knight's direction. The inlay arrows flip 1.6 s ahead
  async function retrograde(b, o = {}) {
    const D = b.data, flips = o.flips || 3, every = o.every || 6, lead = o.lead || 1.6;
    D.retro = true;
    world('ringArrows', 'all', b.playerDir(), true);
    sfx('retrograde', {});
    if (!D.said.retro) { D.said.retro = 1; b.say('Retrograde! The heavens turn back on you.', 2.6); }
    await b.wait(1.0);
    for (let i = 0; i < flips; i++) {
      const want = -b.playerDir();
      world('ringArrows', 'all', want, true);
      world('ringGlow', 'all', accentNow(), 0.5, lead);
      sfx('retrograde', {}); sfx('warn', { vol: 0.6 });
      const S0 = PS(); if (S0) fx('text', S0.pos.clone().setY(S0.pos.y + 1.9), 'RETROGRADE', { color: '#d9c8ff', size: 0.55, life: 1.2 });
      await b.wait(lead);
      const S = PS();
      if (S && S.alive && !S.novaActive && S.dir !== want) G.player.forceReverse();
      for (let k = 0; k < 3; k++) fx('ringFlash', k, { color: accentNow(), life: 0.45, intensity: 1.3 });
      cam('shake', 0.25, 0.2);
      if (o.onFlip) { try { o.onFlip(i); } catch (e) { logE('onFlip', e); } }
      if (i < flips - 1) await b.wait(every - lead);
    }
    await b.wait(0.6);
    world('ringArrows', 'all', b.playerDir(), false);
    D.retro = false;
  }
  async function retroCombo(b, o = {}) {
    const D = b.data;
    // after every forced reverse something lands on the knight's new path (aimed with the new direction)
    const onFlip = (i) => {
      if (i === 0) prominence(b, b.playerAhead(1.9), { warn: 1.5 });
      else if (i === 1) lensing(b, { n: 3, lead: 1.5, warn: 1.5 });
      else prominences(b, { n: 2, noWait: true, exhale: false, lead: 2.0 });
    };
    const task = retrograde(b, { onFlip }).catch(() => { });
    await b.wait(1.2);
    if (o.extra) await o.extra(b);
    await task;
    D.retro = false;
  }
  // Accretion Disk: rotor slices on every ring, Keplerian (the inner ring turns fastest, almost at the knight's speed)
  async function accretion(b, o = {}) {
    const sg = b.rand() < 0.5 ? 1 : -1, base = b.playerTheta() + PI * 0.5;
    const om = [0.62, 0.42, 0.27];
    let last = null;
    for (let k = 0; k < 3; k++) {
      const c = base + k * 0.8;
      last = G.hz.rotor({ rings: [k], slices: [{ center: c, width: 0.5 }, { center: c + PI, width: 0.5 }], omega: sg * om[k], warn: 2.0, dur: o.dur || 9, tick: 0.5, dmg: 15, label: 'Accretion Disk' });
    }
    b.data.pulse = 1;
    if (!b.data.said.disk) { b.data.said.disk = 1; b.say('Orbit me as the dust does. Faster near the heart.', 2.8); }
    await b.wait(2.0 + 1.0);
    if (o.extra) await o.extra(b);
    await last;
  }
  // White-hot variants for the Event Horizon
  async function infall(b, o = {}) {
    const c = b.playerAhead(2.4 + 0.5) + b.randRange(-0.25, 0.25);
    const h = G.hz.wave({ from: 'out', speed: o.speed || 5.5, thickness: 0.9, gaps: [{ center: c, width: 0.8 }, { center: c + PI, width: 0.8 }], warn: o.warn || 2.3, dmg: o.dmg || 22, label: o.label || 'Infall' });
    b.data.pulse = 0.6;
    await h;
  }

  // ---- interruptible casts (only the rotation loop casts) ----------------------------------------------
  function castPose(b, on) {
    const D = b.data;
    if (on) { b.faceTo(b.facing); D.swellT = 1; D.noWell = true; }
    else { b.faceTo(null); D.swellT = 0; D.noWell = false; }
  }
  async function coronalMass(b) {
    const D = b.data;
    castPose(b, true);
    if (!D.said.mass) { D.said.mass = 1; b.say('Coronal Mass. Eclipse me if you dare.', 2.6); }
    const res = await b.cast({
      name: 'Coronal Mass', dur: 3.6, interruptible: true,
      onInterrupt: () => { castPose(b, false); D.pulse = 1; b.say('You... dim me?', 1.8); },
    });
    castPose(b, false);
    if (res !== 'done') return;
    D.noWell = true;
    const warn = 2.4, sp = 6.5, r = b.playerRing();
    const tCross = warn + (RING(r) - 1.6) / sp;
    const off = b.rand() < 0.3 ? 0 : b.randRange(0.4, 0.85);
    const c = b.playerAhead(tCross) - b.playerDir() * off;
    D.pulse = 1.4; fx('flash', FLARE, 0.25, 0.5); cam('shake', 0.6, 0.6); post('bloomPulse', 0.6, 1.0);
    const h = G.hz.wave({ from: 'in', speed: sp, thickness: 1.0, gaps: [{ center: c, width: 0.62 }], warn, dmg: 50, label: 'Coronal Mass' });
    await h;
    D.noWell = false;
  }
  async function sunquake(b) {
    const D = b.data;
    castPose(b, true);
    if (!D.said.quake) { D.said.quake = 1; b.say('Sunquake! Every ring will shatter.', 2.4); }
    const res = await b.cast({
      name: 'Sunquake', dur: 3.4, interruptible: true,
      onInterrupt: () => { castPose(b, false); D.pulse = 1; },
    });
    castPose(b, false);
    if (res !== 'done') return;
    G.player.damage(12, 'Sunquake');
    D.pulse = 1.5; cam('shake', 0.9, 0.7); fx('flash', ACC, 0.25, 0.4); sfx('thunder', { vol: 0.8 });
    const base = b.playerAhead(3.0);
    for (let k = 0; k < 3; k++) {
      const c = base + k * 2.1 + b.randRange(-0.3, 0.3);
      const cc = gapOk(b, k, c, 0.42) ? c : crackSpot(b, k, b.randRange(1.5, 4));
      if (cc != null) crack(b, k, cc, { warn: 2.0 });
    }
    await b.wait(2.6);
  }
  async function collapseCast(b) {
    const D = b.data;
    castPose(b, true);
    if (!D.said.coll) { D.said.coll = 1; b.say('Fall inward with me!', 2.0); }
    const res = await b.cast({
      name: 'Gravitational Collapse', dur: 4.2, interruptible: true,
      onInterrupt: () => { castPose(b, false); D.pulse = 1; b.say('No... not yet...', 1.8); },
    });
    castPose(b, false);
    if (res !== 'done') return;
    D.noWell = true;
    const warn = 2.8;
    const c = b.playerAhead(warn + 0.9) - b.playerDir() * b.randRange(0.2, 0.6);
    D.pulse = 1.5; cam('shake', 0.8, 0.8); post('bloomPulse', 0.8, 1.2); fx('flash', '#ffffff', 0.2, 0.4);
    const h = G.hz.wave({ from: 'out', speed: 5, thickness: 1.1, gaps: [{ center: c, width: 0.78 }, { center: c + PI, width: 0.78 }], warn, dmg: 75, lethal: true, label: 'Gravitational Collapse' });
    await h;
    D.noWell = false;
  }

  // ================================================================ SCRIPTS
  function rotation(b, list, rest, castFn, castEvery, firstCast) {
    const D = b.data; let i = 0;
    D.nextCast = castFn ? b.clock + firstCast : Infinity;
    b.loop(async () => {
      if (D.consumed) { await b.wait(30); return; }
      if (castFn && b.clock >= D.nextCast) {
        await castFn(b);
        D.nextCast = b.clock + castEvery;
        await b.wait(b.randRange(rest[0], rest[1]));
        return;
      }
      const atk = list[i++ % list.length];
      await atk(b);
      await b.wait(b.randRange(rest[0], rest[1]));
    });
  }
  function wellLoop(b, every, o) {
    const D = b.data;
    b.loop(async () => {
      await b.wait(b.randRange(every[0], every[1]));
      await b.until(() => !D.noWell && !b.casting);
      if (D.consumed) return;
      await gravityWell(b, o);
    });
  }
  // common per-frame logic
  function phaseTick(b, dt) {
    const D = b.data;
    tickSpin(b);
    if (D.exhaleEnd && b.clock > D.exhaleEnd) { D.exhaleEnd = 0; b.faceTo(null); D.swellT = 0; }
    if (D.well && D.well.h && D.well.h.hazard && D.well.h.hazard.finished) D.well = null;
  }

  function setLook(b, i) {
    const L = b.data.look;
    L.crack = i >= 1 ? 1 : 0; L.crownBreak = i >= 1 ? 1 : 0;
    L.collapse = i >= 2 ? 1 : 0; L.disk = i >= 2 ? 1 : 0; L.mask = i >= 2 ? (i >= 3 ? 1 : 0.5) : 0;
    L.horizon = i >= 3 ? 1 : 0; L.hot = i >= 3 ? 1 : 0;
    L.heat = i >= 3 ? 0.4 : 1; L.corona = i >= 3 ? 0.8 : 1; L.calm = 0;
  }
  function snapLook(b) { const D = b.data; for (const k in D.look) D.cur[k] = D.look[k]; }
  function enterPhase(b, i) {
    const D = b.data;
    b.turnRate = [0.42, 0.46, 0.5, 0.32][i]; b.trackPlayer = true; b.facingTarget = null;
    D.exhaleEnd = 0; D.swellT = 0; D.noWell = false; D.retro = false;
    if (D.spin) endSpin(b);
    world('ringArrows', 'all', 1, false);
    setLook(b, i);
    if (D.phaseSeen == null) { snapLook(b); }   // a retry from a checkpoint starts with the right look at once
    D.phaseSeen = i;
  }

  // P2 starting fractures (made in the transition cinematic; a checkpoint retry makes them here)
  function initialFractures(b, avoidTheta, avoidDir) {
    const plan = [[2, 0.9], [1, 2.9], [0, 4.6], [2, 4.0]];
    let n = 0;
    for (const [ring, off] of plan) {
      if (n >= 3) break;
      const c = avoidTheta - avoidDir * 0.9 + avoidDir * off;
      // keep the knight's own path clear for the first seconds
      if (ring === PS().ring && Math.abs(angDiff(c, avoidTheta + avoidDir * 1.0)) < 1.6) continue;
      if (makeGap(b, ring, c, 0.45)) n++;
    }
  }
  function applyCollapseWorld(b, instant) {
    world('tilt', 0.24, 0.11, instant ? 0 : 3.2, { spin: 0.07 });
  }
  function breakOuterRing(b, stagger) {
    const D = b.data;
    const S = PS();
    if (S && S.ring === 2) G.player.forceShift(-1, { fall: true });
    D.outer = [];
    const base = (S ? S.theta : 0) + PI;
    for (let k = 0; k < 3; k++) {
      const mk = () => { const g = makeGap(b, 2, base + k * TAU / 3, 2.25, { force: true, dmg: 0, label: 'The Void' }); if (g) D.outer.push(g); cam('shake', 0.5, 0.4); };
      if (stagger) cwait(k * 0.28).then(() => { if (G.combat.boss === b) mk(); }); else mk();
    }
    // the outer ring's under-glow goes dark with it
    try { const r = G.world._W.rings[2]; if (r && r.halo) { D.haloA = D.haloA != null ? D.haloA : r.halo.material.uniforms.uA.value; r.halo.material.uniforms.uA.value = 0.03; } } catch (e) { /* world internals */ }
  }
  function restoreHalo(b) {
    const D = b.data || {};
    try { const r = G.world._W.rings[2]; if (r && r.halo && D.haloA != null) r.halo.material.uniforms.uA.value = D.haloA; } catch (e) { /* */ }
  }
  function enterHorizon(b, fromRetry) {
    const D = b.data;
    G.colors.accent = HOT; world('setAccent', HOT);
    if (!D.outer || !D.outer.length || D.outer.some(g => g.h.hazard.finished)) breakOuterRing(b, false);
    if (fromRetry) applyCollapseWorld(b, true);
    world('tilt', 0.29, 0.12, fromRetry ? 0 : 2.0, { spin: 0.08 });
    if (!D.metered) { D.metered = 1; try { G.player.addMeter(100, true); } catch (e) { logE('meter', e); } }
    D.ehT = EH_TIME; D.ehStart = b.clock; D.consumed = false;
    if (D.horizonR < 1.4) D.horizonR = 1.4;
    ehHud(b, true);
    post('setGrade', [0.78, 0.74, 1.2], [1.12, 1.04, 1.16]); post('setVignette', 0.44);
  }

  const PHASES = [
    {
      name: 'Corona', hpStart: 1.0, sky: ['collapse', 0],
      enter(b) {
        enterPhase(b, 0);
        if (!b.data.said.open) { b.data.said.open = 1; b.say('HELIARCH: I was the light your orrery was built to follow. Kneel at my perihelion.', 3.6); }
      },
      update: phaseTick,
      async script(b) {
        await b.wait(1.4);
        rotation(b, [
          lashCombo, salvoCombo, solarFlares, surgeLash, pincer, (bb) => salvoCombo(bb, { n: 2 }), (bb) => lashCombo(bb, { surge: true }), solarFlares,
        ], [0.35, 0.7], coronalMass, 24, 13);
        wellLoop(b, [10.5, 13], { warn: 2.4, window: 1.2, crush: 28 });
      },
    },
    {
      name: 'Fracture', hpStart: 0.70, sky: ['collapse', 1], skyDur: 3.0,
      enter(b) {
        enterPhase(b, 1);
        const D = b.data, S = PS();
        if (!liveGaps(b).length && S) initialFractures(b, S.theta, S.dir);
        post('setGrade', [0.84, 0.74, 1.12], [1.16, 0.98, 0.88]);
      },
      update(b, dt) {
        phaseTick(b, dt);
        const D = b.data; D.emberT = (D.emberT == null ? 9 : D.emberT) - dt;
        if (D.emberT <= 0) { D.emberT = 13; if (liveGaps(b).length >= 2 && !G.hz.active.some(h => h.soak && !h.finished)) emberStar(b); }
      },
      async script(b) {
        await b.wait(1.0);
        rotation(b, [
          fracture, spinCombo, salvoCombo, retroCombo, async (bb) => { solarFlares(bb); await bb.wait(1.0); await fracture(bb, { n: 1 }); },
          lashCombo, pincer, async (bb) => { fracture(bb, { n: 1 }); await bb.wait(0.8); await lensing(bb, {}); },
        ], [0.35, 0.7], sunquake, 24, 12);
      },
    },
    {
      name: 'Collapse', hpStart: 0.40, sky: false,
      enter(b) {
        const D = b.data, first = D.phaseSeen == null;
        enterPhase(b, 2);
        try { if (!G.world.sky || G.world.sky.preset !== 'collapse' || G.world.sky.intensity !== 3) world('setSky', 'collapse', 3, first ? 0 : 1.5); } catch (e) { logE('sky', e); }
        if (!D.tilted) { D.tilted = 1; applyCollapseWorld(b, true); }
        post('setGrade', [0.74, 0.7, 1.22], [1.06, 0.98, 1.16]); post('setVignette', 0.4);
      },
      update(b, dt) {
        phaseTick(b, dt);
        const D = b.data; D.emberT = (D.emberT == null ? 12 : D.emberT) - dt;
        if (D.emberT <= 0) { D.emberT = 15; if (liveGaps(b).length >= 2 && !G.hz.active.some(h => h.soak && !h.finished)) emberStar(b); }
      },
      async script(b) {
        await b.wait(0.8);
        rotation(b, [
          (bb) => accretion(bb, { extra: (x) => lensing(x, { n: 3 }) }),
          (bb) => lashCombo(bb, { surge: true }),
          (bb) => retroCombo(bb, {}),
          (bb) => spinCombo(bb, {}),
          async (bb) => { fracture(bb, { n: 1 }); await bb.wait(0.6); await salvoCombo(bb, {}); },
          solarFlares,
          (bb) => accretion(bb, { dur: 8, extra: (x) => salvoCombo(x, { n: 2 }) }),
          pincer,
        ], [0.3, 0.6], collapseCast, 24, 14);
        wellLoop(b, [11, 13.5], { warn: 2.2, window: 1.2, crush: 28 });
      },
    },
    {
      name: 'Event Horizon', hpStart: 0.12, sky: false,
      enter(b) {
        const D = b.data, retry = D.phaseSeen == null;
        enterPhase(b, 3);
        try { if (!G.world.sky || G.world.sky.intensity !== 3) world('setSky', 'collapse', 3, 0); } catch (e) { logE('sky', e); }
        enterHorizon(b, retry);
        if (!D.said.eh) { D.said.eh = 1; b.say('Past the horizon there is no orbit. Only the fall.', 3.0); }
      },
      update(b, dt) {
        phaseTick(b, dt);
        const D = b.data;
        if (D.consumed) { consumeTick(b, dt); return; }
        D.ehT = Math.max(0, D.ehT - dt);
        const k = 1 - D.ehT / EH_TIME;
        D.horizonR = damp(D.horizonR, lerp(1.4, 4.7, k), 2, dt);
        ehHud(b, true);
        if (!D.said.low && D.ehT < 15) { D.said.low = 1; b.say('Fifteen heartbeats, little star. Then nothing.', 2.6); }
        if (D.ehT <= 0) startConsume(b);
      },
      async script(b) {
        await b.wait(0.6);
        const W = (o) => ({ color: HOT, ...o });
        rotation(b, [
          (bb) => flareLash(bb, W({ rings: [0, 1], span: PI * 1.65, back: 0.7, label: 'White Flare', dmg: 24 })),
          (bb) => infall(bb, { dmg: 24 }),
          (bb) => prominences(bb, W({ n: 3, rings: [0, 1], exhale: true, exhaleDur: 3.0 })),
          (bb) => { const f = bb.playerRing() === 0 ? 1 : 0; return solarFlares(bb, W({ free: f, rings: [1 - f], n: 3, label: 'White Flare' })); },
          (bb) => lensing(bb, W({ n: 4, label: 'Lensed Light', dmg: 20 })),
        ], [0.9, 1.4], null, 0, 0);
        wellLoop(b, [5.6, 7.0], { warn: 1.9, window: 1.0, crush: 20, label: 'Event Horizon' });
      },
    },
  ];

  // ================================================================ EVENT HORIZON: timer + consumption
  function ehHud(b, show) {
    const D = b.data;
    if (!show) { if (D.ehEl) { D.ehEl.remove(); D.ehEl = null; } return; }
    if (!D.ehEl) {
      const hud = document.getElementById('hud') || document.body;
      const el = document.createElement('div'); el.id = 'heliarchHorizon';
      const touch = !!G.isTouch;
      el.style.cssText = 'position:absolute;pointer-events:none;z-index:3;font:600 11px system-ui,sans-serif;letter-spacing:.22em;color:#f2e8ff;' +
        'text-shadow:0 0 8px rgba(0,0,0,.95),0 0 12px rgba(167,123,255,.7);padding:5px 10px 6px;border:1px solid rgba(200,170,255,.6);border-radius:3px;' +
        'background:linear-gradient(180deg,rgba(14,6,30,.78),rgba(4,2,12,.7));box-shadow:0 0 18px rgba(167,123,255,.35);min-width:148px;' +
        (touch ? 'right:calc(var(--sar,0px) + 12px);top:calc(var(--sat,0px) + 84px);text-align:right;' : 'left:calc(var(--sal,0px) + 14px);top:calc(var(--sat,0px) + 42px);');
      el.innerHTML = '<div style="opacity:.85">EVENT HORIZON</div><div class="t" style="font:700 22px system-ui,sans-serif;letter-spacing:.06em;font-variant-numeric:tabular-nums;margin-top:1px">0:45</div>' +
        '<div style="height:4px;margin-top:4px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden"><i style="display:block;height:100%;width:100%;transform-origin:0 50%;background:linear-gradient(90deg,#5a2cc8,#c8a8ff,#ffffff)"></i></div>';
      hud.appendChild(el); D.ehEl = el; D.ehTxt = el.querySelector('.t'); D.ehBar = el.querySelector('i');
    }
    const t = Math.max(0, D.ehT), s = Math.ceil(t);
    const txt = D.consumed ? 'CONSUMED' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    if (D.ehTxt.textContent !== txt) D.ehTxt.textContent = txt;
    D.ehBar.style.transform = 'scaleX(' + (t / EH_TIME).toFixed(3) + ')';
    const hot = t < 10;
    D.ehEl.style.borderColor = hot ? 'rgba(255,255,255,.9)' : 'rgba(200,170,255,.6)';
    D.ehTxt.style.color = hot ? '#ffffff' : '#f2e8ff';
    D.ehEl.style.opacity = hot && !D.consumed ? (0.65 + 0.35 * Math.abs(Math.sin(D.t * 4))).toFixed(2) : '1';
  }
  function startConsume(b) {
    const D = b.data; if (D.consumed) return;
    D.consumed = true; D.consumeT = 0; b.invulnerable = true;
    G.hz.clear(h => h.kind !== 'gap');
    b.say('Nothing escapes.', 2.4);
    fx('flash', '#000000', 0.5, 1.2); cam('shake', 1.0, 1.4); sfx('thunder', {}); sfx('gravity', { vol: 1 });
    ehHud(b, true);
  }
  function consumeTick(b, dt) {
    const D = b.data; D.consumeT += dt;
    D.horizonR = damp(D.horizonR, 16, 1.6, dt);
    D.dips[0] = D.dips[1] = Math.min(0.6, D.consumeT * 0.5);
    const S = PS();
    if (S && S.alive && D.consumeT > 0.9) {
      G.player.damage(999, 'Event Horizon');
    }
  }

  // ================================================================ CINEMATICS
  // close-ups are framed for 16:9; on portrait screens pull them back along their view line
  function fitKeys(keys, home) {
    const asp = (typeof innerWidth === 'number' && innerHeight) ? innerWidth / innerHeight : 1.78;
    const k = clamp(Math.pow(1.45 / asp, 0.75), 1, 2.1);
    if (k <= 1.001) return keys;
    return keys.map(key => {
      if (key.pos === home || !Array.isArray(key.pos) || !Array.isArray(key.look)) return key;
      const p = key.pos, l = key.look;
      return Object.assign({}, key, { pos: [l[0] + (p[0] - l[0]) * k, l[1] + (p[1] - l[1]) * k, l[2] + (p[2] - l[2]) * k] });
    });
  }
  function onTransition(b, from, to) {
    const D = b.data;
    b.setFacing(-PI / 2); b.trackPlayer = false; b.turnRate = 0; b.facingTarget = null;
    D.swellT = 0; D.exhaleEnd = 0; D.well = null; D.dips[0] = D.dips[1] = D.dips[2] = 0;
    if (D.spin) endSpin(b);
    world('ringArrows', 'all', 1, false);
    D.gaps = [];
    const home = homeCam(), look = homeLook();
    sfx('swell', {});
    let keys;
    const events = (async () => {
      if (to === 1) {
        // ---- Corona -> Fracture: the star convulses, the crown cracks, the rings break apart and drift
        b.say('My crown... cracks? Then let the heavens crack with it!', 3.0);
        D.swellT = 1; fx('flash', FLARE, 0.3, 0.5); cam('shake', 0.5, 0.8); post('bloomPulse', 0.6, 1.2);
        await cwait(0.7);
        D.look.crack = 1; D.look.crownBreak = 1; D.pulse = 1.5;
        for (let i = 0; i < 6; i++) fx('shards', starPos(b).add(G.polar(3.0, i / 6 * TAU, 0)), { color: '#ffd27a', count: 6, speed: 4, floor: 0 });
        sfx('crack', {}); cam('shake', 0.6, 0.4);
        await cwait(0.6);
        const S = PS(); const th = S ? G.player.predictTheta(3.4) : 0, dir = S ? S.dir : 1;
        // three segments break, one at a time
        const plan = [[2, 0.9], [1, 2.9], [0, 4.6]];
        for (const [ring, off] of plan) {
          const c = th - dir * 0.9 + dir * off;
          makeGap(b, ring, c, 0.45, { force: true });
          fx('burst', G.polar(RING(ring), c, 0.3), { color: ACC, count: 24, speed: 6, size: 0.5, life: 0.8 });
          cam('shake', 0.55, 0.35); sfx('crack', { vol: 1 });
          await cwait(0.45);
        }
        fx('shockwave', V3(0, 0.3, 0), { color: ACC, radius: 15, life: 1.2 });
        for (let k = 0; k < 3; k++) fx('ringFlash', k, { color: ACC, life: 0.9, intensity: 1.2 });
        D.swellT = 0;
        post('setGrade', [0.84, 0.74, 1.12], [1.16, 0.98, 0.88]);
        await cwait(1.2);
      } else if (to === 2) {
        // ---- Fracture -> Collapse: the star swells one last time, then implodes; the plane tilts, the black hole opens
        b.say('I will not go out. I will go IN.', 2.8);
        D.swellT = 1.4; post('bloomPulse', 0.5, 1.4);
        for (let i = 0; i < 6; i++) { fx('lance', starPos(b), G.polar(RING(i % 3), i * 1.1, 0.3), { color: FLARE, width: 0.5, life: 0.25 }); await cwait(0.18); }
        await cwait(0.3);
        // implosion
        D.swellT = 0; D.look.collapse = 1; D.look.disk = 1; D.look.mask = 0.5; D.pulse = 2;
        world('setSky', 'collapse', 2, 0.8);
        fx('flash', '#ffffff', 0.55, 0.9); cam('shake', 1.1, 1.0); sfx('thunder', {}); sfx('gravity', { vol: 1 });
        fx('shockwave', starPos(b), { color: HOT, radius: 9, life: 0.7 });
        fx('shockwave', V3(0, 0.3, 0), { color: ACC, radius: 16, life: 1.4 });
        for (let k = 0; k < 3; k++) fx('ringFlash', k, { color: HOT, life: 1.0, intensity: 1.6 });
        D.tilted = 1; applyCollapseWorld(b, false);
        await cwait(1.6);
        world('setSky', 'collapse', 3, 2.4);
        post('setGrade', [0.74, 0.7, 1.22], [1.06, 0.98, 1.16]); post('setVignette', 0.4);
        D.pulse = 1;
        await cwait(2.4);
      } else if (to === 3) {
        // ---- Collapse -> Event Horizon: white-hot; the outer ring breaks away; the horizon opens; Supernova primed
        b.say('Past the horizon there is no orbit. Only the fall.', 3.0);
        D.said.eh = 1;
        fx('flash', '#ffffff', 0.4, 0.6); cam('shake', 0.6, 0.8);
        G.colors.accent = HOT; world('setAccent', HOT);
        D.look.horizon = 1; D.look.hot = 1; D.look.mask = 1; D.look.heat = 0.4; D.pulse = 1.5;
        await cwait(0.7);
        breakOuterRing(b, true);
        for (let i = 0; i < 10; i++) fx('shards', G.polar(RING(2), i / 10 * TAU, 0.2), { color: '#ffd27a', count: 6, speed: 4, floor: -4 });
        fx('ringFlash', 2, { color: HOT, life: 1.2, intensity: 2.2 });
        sfx('crack', { vol: 1 }); sfx('thunder', { vol: 0.8 });
        await cwait(1.2);
        D.horizonR = 0.2; D.growHorizon = true;
        world('tilt', 0.29, 0.12, 2.0, { spin: 0.08 });
        fx('shockwave', V3(0, 0.2, 0), { color: HOT, radius: 6, life: 1.0 });
        await cwait(1.0);
        D.metered = 1; try { G.player.addMeter(100, true); } catch (e) { logE('meter', e); }
        const S = PS(); if (S) { fx('burst', S.pos.clone().setY(0.8), { color: GOLD_HOT, count: 40, speed: 6, size: 0.6, life: 1.0 }); fx('text', S.pos.clone().setY(S.pos.y + 2.0), 'SUPERNOVA READY', { color: GOLD_HOT, size: 0.75, life: 1.6 }); }
        sfx('novaReady', {});
        await cwait(1.6);
      }
    })().catch(e => logE('transition.events', e));
    if (to === 1) keys = [
      { t: 0, pos: home, look },
      { t: 1.4, pos: [7.2, 3.0, 8.6], look: [0, 3.8, 0], fov: 46 },
      { t: 3.2, pos: [-7, 18, 15], look: [0, 0, 0], fov: 44 },
      { t: 5.0, pos: home, look },
    ];
    else if (to === 2) keys = [
      { t: 0, pos: home, look },
      { t: 1.3, pos: [5.6, 2.6, 7.6], look: [0, 3.9, 0], fov: 46 },
      { t: 3.0, pos: [-1.5, 3.2, 10.5], look: [0, 3.4, 0], fov: 50 },
      { t: 4.8, pos: [-11, 13, 15], look: [0, 0.5, 0], fov: 44 },
      { t: 6.4, pos: home, look },
    ];
    else keys = [
      { t: 0, pos: home, look },
      { t: 1.3, pos: [9.5, 5.5, 16.5], look: [0, 1.0, -2], fov: 46 },
      { t: 2.9, pos: [0, 24, 9], look: [0, 0, 0], fov: 44 },
      { t: 4.2, pos: [-4, 7, 12], look: [0, 3, 0], fov: 46 },
      { t: 5.8, pos: home, look },
    ];
    const cin = Promise.resolve(cam('cinematic', fitKeys(keys, home), { returnDur: 0.8 }));
    return Promise.all([events, cin]);
  }

  async function onDeath(b) {
    const D = b.data;
    D.swellT = 0; D.exhaleEnd = 0; D.well = null; D.dips[0] = D.dips[1] = D.dips[2] = 0;
    if (D.spin) endSpin(b);
    world('ringArrows', 'all', 1, false);
    ehHud(b, false);
    cam('slowMo', 0.4, 1.2);
    const home = homeCam(), look = homeLook();
    const cin = Promise.resolve(cam('cinematic', fitKeys([
      { t: 0, pos: home, look },
      { t: 1.6, pos: [6.2, 2.4, 8.2], look: [0, 3.9, 0], fov: 46 },
      { t: 3.4, pos: [3.0, 1.8, 9.6], look: [0, 4.2, 0], fov: 50 },
      { t: 6.0, pos: [-7.5, 4.5, 10.5], look: [0, 3.6, 0], fov: 46 },
      { t: 8.2, pos: [0, 12, 18], look: [0, 2.5, 0], fov: 44 },
      { t: 9.6, pos: home, look },
    ], home), { returnDur: 1.0 }));
    b.say('The dark... is so cold...', 2.6);
    // the horizon shudders and shrinks, the disk spirals in
    fx('flash', '#ffffff', 0.25, 0.5); cam('shake', 0.6, 0.8);
    for (let i = 0; i < 5; i++) {
      fx('burst', starPos(b).add(V3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5)), { color: i % 2 ? HOT : ACC, count: 20, speed: 6, size: 0.6, life: 0.8 });
      sfx('crack', { vol: 0.6 }); cam('shake', 0.3, 0.25);
      await cwait(0.3);
    }
    D.look.disk = 0; D.shrinkHorizon = true; D.starScaleK = 0.6;
    G.audio && G.audio.duck && G.audio.duck(0.85, 2.0);
    await cwait(1.0);
    // a single point of light in the dark
    D.coreK = 0; for (let i = 0; i < 12; i++) { D.coreK = (i + 1) / 12 * 0.7; D.starScaleK = lerp(0.6, 0.15, (i + 1) / 12); await cwait(0.06); }
    await cwait(0.4);
    // REIGNITION
    D.look.horizon = 0; D.look.collapse = 0; D.look.calm = 1; D.look.hot = 0; D.look.mask = 0; D.look.crack = 0; D.look.crownBreak = 0; D.look.corona = 1.1; D.look.heat = 1;
    D.cur.horizon = 0; D.cur.collapse = 0.2; D.cur.calm = 0.7;
    D.starScaleK = 1; D.pulse = 2; D.coreK = 1.4; D.eyeCloseT = true;
    fx('flash', '#fff2d0', 0.55, 1.4); post('bloomPulse', 1.2, 2.2);
    fx('shockwave', starPos(b), { color: GOLD_HOT, radius: 12, life: 1.0 });
    fx('shockwave', V3(0, 0.4, 0), { color: GOLD_HOT, radius: 24, life: 1.8 });
    fx('shockwave', V3(0, 0.4, 0), { color: GOLD, radius: 15, life: 1.3 });
    fx('burst', starPos(b), { color: GOLD_HOT, count: 80, speed: 13, size: 0.75, life: 1.5 });
    for (let i = 0; i < 6; i++) fx('starFall', G.polar(3 + i * 1.7, i * 1.05, 0.2), GOLD_HOT);
    cam('shake', 1.2, 1.2); sfx('bossDeath', {}); sfx('thunder', {});
    G.colors.accent = ACC; world('setAccent', ACC);
    world('setSky', 'night', 1, 4.0);
    world('tilt', 0, 0, 4.0, {});
    for (let k = 0; k < 3; k++) { world('ringGlow', k, GOLD, 1.3, 3.5); fx('ringFlash', k, { color: GOLD_HOT, life: 1.4, intensity: 1.4 }); }
    restoreHalo(b);
    post('setGrade', [0.86, 0.82, 1.08], [1.16, 1.06, 0.9]); post('setVignette', 0.3);
    b.say('...warm. I remember being warm. A new dawn over the orrery.', 4.0);
    await cwait(1.2);
    D.coreK = 0;
    await cwait(3.4);
    return cin;
  }

  // ================================================================ TEARDOWN
  function teardown(b) {
    const D = b.data || {};
    try { if (D.onShift) G.off('shift', D.onShift); if (D.onBump) G.off('bump', D.onBump); } catch (e) { logE('teardown.off', e); }
    ehHud(b, false);
    for (const v of (D.vfx || [])) killVfx(v);
    D.vfx = [];
    restoreHalo(b);
    try { const wr = G.world && G.world.rings; if (wr) for (const m of wr) m.position.y = 0; } catch (e) { /* */ }
    try { G.player && G.player.setSpeedMul && G.player.setSpeedMul(1, 0); } catch (e) { /* */ }
    if (G.colors) G.colors.accent = ACC;
    world('setAccent', ACC);
    try { G.world && G.world.reset && G.world.reset(); } catch (e) { logE('teardown.world', e); }
  }

  // death-cinematic animation extras that run in animate (horizon shrink, eyes closing)
  const baseAnimate = animate;
  function animateAll(b, dt) {
    const D = b.data;
    if (D && D.hover) {
      if (D.shrinkHorizon) D.horizonR = damp(D.horizonR, 0, 2.4, dt);
      if (D.growHorizon && G.state === 'cinematic') D.horizonR = damp(D.horizonR, 1.4, 1.5, dt);
      if (D.eyeCloseT) D.eyeClose = damp(D.eyeClose, 0.9, 0.8, dt);
    }
    baseAnimate(b, dt);
  }

  // ================================================================ DEFINITION
  G.bosses = G.bosses || [];
  G.bosses[2] = {
    name: 'HELIARCH', title: 'the Dying Sun', accent: ACC, sky: 'collapse', music: 2,
    maxHp: 24000, parTime: 285, hitRadius: 1.6, hitHeight: 3.7, fadeOpacity: 0.35,
    phases: PHASES,
    build, animate: animateAll, onTransition, onDeath, teardown,
  };
  // exposed for tests / tuning only
  G.heliarch = { EH_TIME, attacks: { flareLash, solarFlares, prominences, coronaSurge, lensing, fracture, emberStar, spinCombo, retroCombo, accretion, infall, coronalMass, sunquake, collapseCast, gravityWell } };
})();
