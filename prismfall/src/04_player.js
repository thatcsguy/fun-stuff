   10  PLAYER — The Lightbreaker
   ===================================================================== */
const player = {
  x: 0, z: 7, y: 0, vx: 0, vz: 0, alive: true, hp: 100, maxHp: 100, r: 30, g: 30, b: 30,
  facing: -Math.PI / 2, dashCharges: 2, dashMax: 2, dashRecharge: 0, dashT: -1, dashDX: 0, dashDZ: 0, dashSX: 0, dashSZ: 0, dashI: 0, perfectsThisDash: 0, ghostN: 0,
  hurtI: 0, invuln: 0, slowT: 0, stunT: 0, boltT: 0, cdLance: 0, cdLattice: 0, cdMirror: 0, comboN: 0, comboT: 0, novaT: -1, novaConsumed: 0, afterglowT: 0,
  grazeFlash: 0, distWalked: 0, healAcc: 0, healT: 0, lowHpBeatT: 0, coreCol: new THREE.Color(1, 1, 1), reflectN: 0,
};
const aim = { x: 0, y: 2, z: 0, tgt: null, ang: -Math.PI / 2 };
const targets = [];         // {x,y,z,r,hy,alive,priority,isBoss,hit(dmg,crit,src)}
function hasFacet(id) { return game.facets.indexOf(id) >= 0; }
function grazeRadius() { return PLAYER.grazeR + (hasFacet('greed') ? 0.4 : 0); }
function costMul() { return player.afterglowT > 0 ? 0.5 : 1; }

// ---- model ----
const crystalU = { uTime: { value: 0 }, uCore: { value: new THREE.Color(1, 1, 1) }, uFlash: { value: 0 }, uAlpha: { value: 0.88 } };
const crystalMat = new THREE.ShaderMaterial({
  uniforms: crystalU, transparent: true,
  vertexShader: `varying vec3 vV; varying vec3 vO; void main(){ vO = position; vec4 mv = modelViewMatrix*vec4(position,1.0); vV = mv.xyz; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: GLSL_LIB + /* glsl */`
    uniform float uTime,uFlash,uAlpha; uniform vec3 uCore; varying vec3 vV; varying vec3 vO;
    void main(){
      vec3 n = normalize(cross(dFdx(vV), dFdy(vV))); vec3 v = normalize(-vV);
      float fr = 1.0-abs(dot(n,v));
      vec3 irid = palette(fr*1.2 + uTime*0.1 + vO.y*0.4)*1.1*pow(fr,1.3);
      float fl = 0.85+0.15*noise2(vec2(uTime*6.0, vO.y*3.0));
      vec3 core = uCore*pow(1.0-fr,2.0)*1.1*fl;
      vec3 L = normalize((viewMatrix*vec4(0.4,0.9,0.3,0.0)).xyz);
      float spec = pow(max(dot(reflect(-v,n), L),0.0), 28.0)*1.6;
      vec3 c = irid + core + vec3(spec) + uCore*0.12;
      c = mix(c, vec3(3.0), uFlash);
      gl_FragColor = vec4(c, uAlpha);
    }`,
});
const playerG = new THREE.Group(); scene.add(playerG);
const BODY_SC = 1.3;                    // visual scale only: the hurtbox stays PLAYER.hurtR
const bodyG = new THREE.Group(); bodyG.scale.setScalar(BODY_SC); playerG.add(bodyG);
const torsoGeo = new THREE.IcosahedronGeometry(0.55, 0); torsoGeo.scale(1, 1.5, 1);
const headGeo = new THREE.OctahedronGeometry(0.28, 0);
const torso = new THREE.Mesh(torsoGeo, crystalMat); torso.position.y = 1.15; bodyG.add(torso);
const head = new THREE.Mesh(headGeo, crystalMat); head.position.y = 2.25; bodyG.add(head);
// dark inverted-hull rim so the hero reads against bright floors and bloom
const hullMat = new THREE.MeshBasicMaterial({ color: 0x06040c, side: THREE.BackSide });
const torsoHull = new THREE.Mesh(torsoGeo, hullMat); torsoHull.scale.setScalar(1.13); torsoHull.renderOrder = -1; torso.add(torsoHull);
const headHull = new THREE.Mesh(headGeo, hullMat); headHull.scale.setScalar(1.18); headHull.renderOrder = -1; head.add(headHull);
const limbGeo = new THREE.OctahedronGeometry(1, 0); limbGeo.scale(0.11, 0.42, 0.11);
const limbs = [];
for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(limbGeo, crystalMat); bodyG.add(l); limbs.push(l); }
const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) }));
coreGlow.position.y = 1.15; bodyG.add(coreGlow);
// bullet-hell style hitbox dot: always drawn on top (beams, the sun, bloom)
const hitDot = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.32, 'rgba(255,255,255,1)'); g.addColorStop(0.42, 'rgba(10,6,20,0.95)'); g.addColorStop(0.58, 'rgba(10,6,20,0.85)'); g.addColorStop(0.7, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.setScalar(0.5); sp.position.y = 1.15; sp.renderOrder = 998; playerG.add(sp); return sp;
})();
// spectrum ring
const specU = { uVal: { value: new THREE.Vector3(0.3, 0.3, 0.3) }, uWhite: { value: 0 }, uTime: { value: 0 }, uPop: { value: new THREE.Vector3() } };
const specRing = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.2, 96, 1), new THREE.ShaderMaterial({
  uniforms: specU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */`uniform vec3 uVal, uPop; uniform float uWhite, uTime; varying vec2 vP;
    void main(){ float a = fract(atan(vP.x, vP.y)/6.28318 + 1.0); float seg = floor(a*3.0); float loc = fract(a*3.0);
      float gap = smoothstep(0.02,0.05,loc)*smoothstep(0.98,0.95,loc);
      float val = seg<0.5 ? uVal.x : seg<1.5 ? uVal.y : uVal.z; float pop = seg<0.5 ? uPop.x : seg<1.5 ? uPop.y : uPop.z;
      vec3 c = seg<0.5 ? vec3(1.0,0.08,0.2) : seg<1.5 ? vec3(0.15,1.0,0.3) : vec3(0.2,0.45,1.0);
      float lr = length(vP); float edge = smoothstep(0.98,1.02,lr)*smoothstep(1.2,1.16,lr);
      float filled = step(loc, val);
      vec3 col = c*(filled*(1.1+pop*1.5) + 0.14)*gap*edge;
      float wp = 0.6+0.4*sin(uTime*7.0);
      col = mix(col, vec3(1.0,0.97,0.92)*1.3*wp*edge, uWhite);
      gl_FragColor = vec4(col, 1.0); }`,
}));
specRing.rotation.x = -Math.PI / 2; specRing.position.y = 0.05; specRing.renderOrder = 30; specRing.material.depthTest = false; playerG.add(specRing);
const grazeU = { uA: { value: 0.15 }, uTime: { value: 0 }, uR: { value: PLAYER.grazeR } };
const grazeRingMesh = new THREE.Mesh(new THREE.RingGeometry(PLAYER.grazeR - 0.03, PLAYER.grazeR + 0.03, 120, 1), new THREE.ShaderMaterial({
  uniforms: grazeU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform float uA,uTime; varying vec2 vP; void main(){ float a = atan(vP.y,vP.x); float dash = step(0.2, sin(a*40.0 + uTime*1.5)); gl_FragColor = vec4(vec3(0.85,0.92,1.0)*dash*uA*1.6, 1.0); }`,
}));
grazeRingMesh.rotation.x = -Math.PI / 2; grazeRingMesh.position.y = 0.06; grazeRingMesh.renderOrder = 30; grazeRingMesh.material.depthTest = false; playerG.add(grazeRingMesh);
// ghosts (dash afterimages)
const ghostMatBase = new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Color(1, 1, 1) }, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vV = mv.xyz; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform vec3 uCol; uniform float uA; varying vec3 vV; void main(){ vec3 n = normalize(cross(dFdx(vV), dFdy(vV))); float fr = pow(1.0-abs(dot(n, normalize(-vV))), 1.5); gl_FragColor = vec4(uCol*(fr*2.2+0.15)*uA, 1.0); }`,
});
const ghosts = [];
for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(torsoGeo, ghostMatBase.clone()); m.visible = false; m.renderOrder = 9; scene.add(m); ghosts.push({ m, t: 0, life: 0.35 }); }
let ghostIdx = 0;
function spawnGhost(x, y, z, rotY, c) {
  const g = ghosts[ghostIdx]; ghostIdx = (ghostIdx + 1) % 8; g.m.position.set(x, y * BODY_SC, z); g.m.rotation.set(0, rotY, 0); g.t = 0; g.m.visible = true;
  g.m.material.uniforms.uCol.value.copy(c);
}
function updateGhosts(dt) {
  for (let i = 0; i < 8; i++) { const g = ghosts[i]; if (!g.m.visible) continue; g.t += dt; const k = g.t / g.life; if (k >= 1) { g.m.visible = false; continue; } g.m.material.uniforms.uA.value = (1 - k) * 0.9; g.m.scale.setScalar(BODY_SC * (1 + k * 0.25)); }
}

// ---- Lattice field ----
const latU = { uT: { value: 0 }, uA: { value: 0 }, uTime: { value: 0 } };
const latDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShaderMaterial({
  uniforms: latU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, defines: { FBM_OCT: 2 },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: GLSL_LIB + `uniform float uT,uA,uTime; varying vec2 vP;
    void main(){ float r = length(vP); vec4 h = hexCoords(vP*5.5); float e = 0.5-hexD(h.xy);
      float line = smoothstep(0.06,0.0,e); float cell = hash12(h.zw);
      float tw = 0.5+0.5*sin(uTime*3.0 + cell*6.28);
      float rim = smoothstep(0.9,1.0,r)*smoothstep(1.0,0.97,r);
      float sweep = exp(-pow((r - fract(uTime*0.6))*8.0,2.0));
      vec3 c = vec3(0.12,1.0,0.38)*(line*(0.25+0.35*tw)*smoothstep(1.0,0.3,r) + rim*1.1 + 0.03 + sweep*line*0.8);
      gl_FragColor = vec4(c*uA, 1.0); }`,
}));
latDisc.rotation.x = -Math.PI / 2; latDisc.position.y = 0.04; latDisc.visible = false; latDisc.renderOrder = 4; scene.add(latDisc);
const latWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 64, 1, true).translate(0, 0.5, 0), new THREE.ShaderMaterial({
  uniforms: latU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform float uA,uTime; varying vec2 vUv; void main(){ float g = pow(1.0-vUv.y, 2.5); float s = 0.6+0.4*sin(vUv.x*80.0 + uTime*4.0);
    gl_FragColor = vec4(vec3(0.15,1.0,0.4)*g*s*uA*0.45, 1.0); }`,
}));
latWall.visible = false; latWall.renderOrder = 7; scene.add(latWall);
const lattice = { active: false, x: 0, z: 0, r: 4.5, t: 0, dur: 6 };

// ---- Azure Mirror ----
const mirU = { uTime: { value: 0 }, uA: { value: 0 }, uFlash: { value: 0 } };
const mirrorMesh = new THREE.Mesh(new THREE.CircleGeometry(1.1, 6), new THREE.ShaderMaterial({
  uniforms: mirU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position.xy; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform float uTime,uA,uFlash; varying vec2 vP; varying vec3 vN; varying vec3 vV;
    void main(){ float r = length(vP)/1.1; float f = pow(1.0-abs(dot(normalize(vN), normalize(vV))), 1.2);
      float glint = exp(-pow((vP.x+vP.y*0.6) - (fract(uTime*0.9)*4.0-2.0), 2.0)*6.0);
      float rim = smoothstep(0.8,0.97,r);
      float hexl = smoothstep(0.03,0.0,abs(fract(r*4.0)-0.5)-0.45);
      vec3 c = vec3(0.25,0.55,1.0)*(0.35 + rim*2.2 + f*0.8 + hexl*0.4) + vec3(0.9,0.95,1.0)*glint*1.4;
      c += vec3(1.5)*uFlash;
      gl_FragColor = vec4(c*uA, 1.0); }`,
}));
mirrorMesh.visible = false; mirrorMesh.renderOrder = 13; scene.add(mirrorMesh);
const mirror = { active: false, t: 0, dur: 2.5, ang: 0, blockUsed: false, x: 0, z: 0 };

// ---- spectrum helpers ----
function chan(c) { return c === R ? player.r : c === G ? player.g : player.b; }
function addCharge(c, n) {
  if (c === W) { player.r = Math.min(100, player.r + n); player.g = Math.min(100, player.g + n); player.b = Math.min(100, player.b + n); specU.uPop.value.set(1, 1, 1); return; }
  if (c === R) player.r = Math.min(100, player.r + n); else if (c === G) player.g = Math.min(100, player.g + n); else player.b = Math.min(100, player.b + n);
  if (c === R) specU.uPop.value.x = 1; else if (c === G) specU.uPop.value.y = 1; else specU.uPop.value.z = 1;
}
function spend(c, n) { if (c === R) player.r -= n; else if (c === G) player.g -= n; else player.b -= n; }
function chargeMul() { return (bossRT.lastLight ? 2 : 1); }
function onGraze(c, amt, sx, sz) {
  if (c < 0) c = W;
  const greed = hasFacet('greed') ? 2 : 0;
  if (c === W) addCharge(W, 3 * chargeMul()); else addCharge(c, (amt + greed) * chargeMul());
  player.comboN++; player.comboT = 2; player.grazeFlash = 0.15; game.stats.grazes++;
  sfx.graze(c, player.comboN);
  streakToPlayer(sx, 0.9, sz, c, 6);
}
function onPerfect(c, sx, sz) {
  if (c < 0) c = W;
  player.perfectsThisDash++; game.stats.perfects++;
  addCharge(c === W ? W : c, (c === W ? 4 : 12) * chargeMul());
  hitstop(0.08); aberrSpike(0.008); vibrate(15);
  player.dashRecharge += 0.5; if (player.dashCharges < player.dashMax && player.dashRecharge >= PLAYER.dashCd) { player.dashCharges++; player.dashRecharge = 0; }
  dmgNumber(player.x, 2.6, player.z, 'PERFECT', 5);
  if (bossRT.def) bossAddFracture(2);
  player.comboN++; player.comboT = 2;
  sfx.perfect(c, player.comboN);
  streakToPlayer(sx, 0.9, sz, c, 10);
  ring(player.x, 0.08, player.z, 0.4, 2.6, 0.35, 0.12, 2, 2, 2.4, 1.2);
}
let hitSrc = '';
function damagePlayer(dmg, col) {
  if (dmg <= 0) return;
  player.hp -= dmg; player.hurtI = PLAYER.hurtI;
  if (debug.log) debug.log.push([Math.round(game.fightTime), dmg, hitSrc, bossRT.cast.active ? bossRT.cast.name : '']);
  addTrauma(0.35); LU.uHurt.value = 0.55; vibrate(40);
  dmgNumber(player.x, 2.4, player.z, '-' + Math.round(dmg), 2);
  sfx.hurt();
  const c = PCOL[col >= 0 ? col : 0];
  burst(player.x, 1.1, player.z, 18, c[0] * 2, c[1] * 2, c[2] * 2, 6, 0.5, 0.16, 1, 0);
  crystalU.uFlash.value = 0.6;
  if (player.hp <= 0) { player.hp = 0; playerDie(); }
}
function healPlayer(n) {
  if (!player.alive || player.hp >= player.maxHp) return;
  player.hp = Math.min(player.maxHp, player.hp + n); player.healAcc += n;
}
function playerDie() {
  if (!player.alive) return;
  player.alive = false; game.stats.deaths++; store.deaths = (store.deaths || 0) + 1; saveStore();
  playerG.visible = false; mirror.active = false; mirrorMesh.visible = false;
  shatter(player.x, 1.2, player.z, 0.6, 60, 1.6, 1.8, 2.4, 7, 2.2, 9, true);
  burstRainbow(player.x, 1.2, player.z, 80, 9, 1.2, 0.2, 0);
  addTrauma(0.7); hitstop(0.2); bloomSpike(1.2);
  sfx.shatter(1);
  game.defeatT = 1.2;
}
function resetPlayer(fullCharge = 30) {
  player.maxHp = hasFacet('core') ? 130 : 100; player.hp = player.maxHp; player.alive = true;
  player.x = 0; player.z = 7; player.vx = player.vz = 0; player.y = 0;
  player.r = player.g = player.b = fullCharge;
  player.dashMax = hasFacet('third') ? 3 : 2; player.dashCharges = player.dashMax; player.dashRecharge = 0; player.dashT = -1; player.dashI = 0;
  player.hurtI = 0; player.invuln = 0; player.slowT = 0; player.stunT = 0; player.cdLance = player.cdLattice = player.cdMirror = 0; player.boltT = 0;
  player.comboN = 0; player.comboT = 0; player.novaT = -1; player.afterglowT = 0; player.facing = -Math.PI / 2;
  lattice.active = false; latDisc.visible = latWall.visible = false; mirror.active = false; mirrorMesh.visible = false;
  playerG.visible = true; crystalU.uFlash.value = 0;
  for (let i = 0; i < PB_N; i++) { PB.alive[i] = 0; writeBoltMatrix(i); }
  pbMesh.instanceMatrix.needsUpdate = true;
}

// ---- aim ----
function computeAim() {
  const p = player;
  if (!IS_TOUCH && input.mouseIn && input.mouseAimT > 0) {
    aim.x = input.groundX; aim.z = input.groundZ; aim.y = 1.1; aim.tgt = null;
    // snap to boss height if pointing near a target
    for (let i = 0; i < targets.length; i++) { const t = targets[i]; if (t.alive && Math.hypot(t.x - aim.x, t.z - aim.z) < t.r + 0.6) { aim.y = t.y; aim.tgt = t; aim.x = t.x; aim.z = t.z; break; } }
  } else {
    let best = null, bd = 1e9;
    for (let i = 0; i < targets.length; i++) { const t = targets[i]; if (!t.alive || !t.priority) continue; const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < PLAYER.boltRange && d < bd) { bd = d; best = t; } }
    if (!best) { for (let i = 0; i < targets.length; i++) { const t = targets[i]; if (t.alive && t.isBoss) { best = t; break; } } }
    if (best) { aim.x = best.x; aim.y = best.y; aim.z = best.z; aim.tgt = best; }
    else { aim.x = p.x + Math.cos(p.facing) * 6; aim.z = p.z + Math.sin(p.facing) * 6; aim.y = 1.1; aim.tgt = null; }
  }
  aim.ang = Math.atan2(aim.z - p.z, aim.x - p.x);
}

// ---- abilities ----
function canControl() { return game.state === 'fight' && player.alive && player.novaT < 0 && player.stunT <= 0; }
function abilityReady(name) {
  const m = costMul();
  switch (name) {
    case 'dash': return player.dashCharges > 0 && player.dashT < 0;
    case 'lance': return player.cdLance <= 0 && player.r >= PLAYER.lanceCost * m;
    case 'lattice': return player.cdLattice <= 0 && player.g >= PLAYER.latCost * m;
    case 'mirror': return player.cdMirror <= 0 && player.b >= PLAYER.mirCost * m;
    case 'nova': return player.r >= PLAYER.novaReq && player.g >= PLAYER.novaReq && player.b >= PLAYER.novaReq && player.novaT < 0;
  }
  return false;
}
function useAbility(name) {
  if (!canControl() && !((name === 'dash' || name === 'nova') && game.state === 'fight' && player.alive && player.novaT < 0)) return false; // short stuns never eat a dash or the ultimate
  if (!abilityReady(name)) { if (name !== 'dash') sfx.deny(); return false; }
  ui.pressFlash(name);
  switch (name) {
    case 'dash': castDash(); break;
    case 'lance': castLance(); break;
    case 'lattice': castLattice(); break;
    case 'mirror': castMirror(); break;
    case 'nova': castNova(); break;
  }
  return true;
}
function castDash() {
  const p = player; p.dashCharges--; if (p.dashCharges < p.dashMax && p.dashRecharge <= 0) p.dashRecharge = 0.0001;
  let dx = input.mx, dz = input.mz; const l = Math.hypot(dx, dz);
  if (l > 0.1) { dx /= l; dz /= l; } else if (!IS_TOUCH && input.mouseIn && input.mouseAimT > 0) { const a = Math.atan2(input.groundZ - p.z, input.groundX - p.x); dx = Math.cos(a); dz = Math.sin(a); } else { dx = Math.cos(p.facing); dz = Math.sin(p.facing); }
  p.dashDX = dx; p.dashDZ = dz; p.dashSX = p.x; p.dashSZ = p.z; p.dashT = 0; p.dashI = PLAYER.dashI; p.perfectsThisDash = 0; p.ghostN = 0;
  p.stunT = 0;
  sfx.dash();
  burst(p.x, 0.6, p.z, 14, 1.5, 1.7, 2.2, 3, 0.4, 0.14, 0.5, 4);
}
function castLance() {
  const p = player; spend(R, PLAYER.lanceCost * costMul()); p.cdLance = PLAYER.lanceCd;
  computeAim();
  fireLanceBeam(aim.ang, 1);
  if (hasFacet('echo')) fireLanceBeam(aim.ang + 12 * Math.PI / 180, 0.5);
  sfx.lance(); addTrauma(0.15); bloomSpike(0.6);
}
function fireLanceBeam(ang, mul) {
  const p = player, c = Math.cos(ang), s = Math.sin(ang);
  const x0 = p.x + c * 0.6, z0 = p.z + s * 0.6, L = PLAYER.lanceLen, x1 = x0 + c * L, z1 = z0 + s * L;
  const tgtD = aim.tgt ? Math.max(1, Math.hypot(aim.tgt.x - x0, aim.tgt.z - z0)) : 10;
  const slope = aim.tgt ? (aim.tgt.y - 1.15) / tgtD : 0;
  beam(x0, 1.15, z0, x1, 1.15 + slope * L, z1, PLAYER.lanceW * 0.5 * (mul < 1 ? 0.6 : 1), 0.22, 1.0, 0.1, 0.18, 0, 1.25);
  beam(x0, 1.15, z0, x1, 1.15 + slope * L, z1, PLAYER.lanceW * 0.85 * (mul < 1 ? 0.6 : 1), 0.38, 0.9, 0.05, 0.12, 0, 0.45); // tapering afterimage
  ring(x0, 1.15, z0, 0.1, 1.4, 0.25, 0.15, 2.5, 0.4, 0.5, 1.2);
  burst(x0, 1.15, z0, 10, 2.5, 0.4, 0.5, 5, 0.25, 0.14, 1, 4);
  let hitAny = false, critAny = false;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]; if (!t.alive) continue;
    const d = segDist(t.x, t.z, x0, z0, x1, z1);
    if (d < t.r + PLAYER.lanceW / 2) {
      const crit = frand() < 0.25; const dmg = PLAYER.lanceDmg * mul * (crit ? 1.6 : 1) * (t.lanceMul || 1);
      t.hit(dmg, crit, 'lance');
      if (t.isBoss) bossAddFracture(3);
      hitAny = true; critAny = critAny || crit;
      const along = Math.max(0, (t.x - x0) * c + (t.z - z0) * s);
      const hx = x0 + c * along, hz = z0 + s * along, hy = 1.15 + slope * along;
      burst(hx, hy, hz, 40, 2.6, 0.35, 0.4, 9, 0.6, 0.2, 1, 0);
      ring(hx, hy, hz, 0.2, 2.2, 0.3, 0.2, 2.4, 0.5, 0.5, 1);
      if (t.isBoss) { shockAt(hx, hy, hz, 0.035); aberrSpike(0.006); bossRT.lanceFlash = 1; const hc = bossRT.def && bossRT.def.hue || PCOL[R]; shatter(hx, hy, hz, 0.4, 10, hc[0] * 1.6, hc[1] * 1.6, hc[2] * 1.6, 7, 0.9, 9); }
    }
  }
  // destroy projectiles along the beam
  for (let i = 0; i <= PJ.hi; i++) if (PJ.alive[i] && !(PJ.fl[i] & F_REFL)) { if (segDist(PJ.x[i], PJ.z[i], x0, z0, x1, z1) < PLAYER.lanceW / 2 + PJ.r[i]) pjKill(i, true); }
  if (hitAny) { hitstop(critAny ? 0.07 : 0.05); addTrauma(critAny ? 0.1 : 0); sfx.bossHit(); }
}
function castLattice() {
  const p = player; spend(G, PLAYER.latCost * costMul()); p.cdLattice = PLAYER.latCd;
  lattice.active = true; lattice.x = p.x; lattice.z = p.z; lattice.t = 0; lattice.dur = PLAYER.latDur; lattice.r = PLAYER.latR * (hasFacet('living') ? 1.3 : 1);
  latDisc.position.set(p.x, 0.04, p.z); latDisc.scale.setScalar(lattice.r); latWall.position.set(p.x, 0, p.z); latWall.scale.set(lattice.r, 0.9, lattice.r);
  latDisc.visible = latWall.visible = true;
  ring(p.x, 0.1, p.z, 0.5, lattice.r, 0.5, 0.3, 0.3, 2.5, 0.8, 1.4);
  burst(p.x, 0.4, p.z, 40, 0.3, 2.4, 0.8, 6, 0.8, 0.16, 0.3, 3);
  sfx.lattice();
}
function castMirror() {
  const p = player; spend(Bc, PLAYER.mirCost * costMul()); p.cdMirror = PLAYER.mirCd;
  mirror.active = true; mirror.t = 0; mirror.dur = hasFacet('polished') ? 4 : PLAYER.mirDur; mirror.blockUsed = false; p.reflectN = 0;
  mirrorMesh.visible = true; computeAim(); mirror.ang = aim.ang;
  sfx.mirror();
  burst(p.x, 1.2, p.z, 24, 0.5, 1.2, 2.6, 5, 0.5, 0.15, 1, 4);
}
function castNova() {
  const p = player; p.novaConsumed = p.r + p.g + p.b; p.r = p.g = p.b = 0; p.novaT = 0; p.invuln = 1.2;
  p.novaRefund = [0, 0, 0];
  sfx.nova();
  if (bossRT.lastLight) bossRT.novaInLastLight = true;
}
function novaBurst() {
  const p = player;
  const vulnBefore = bossRT.vuln > 0;
  // clear projectiles: refund
  let rr = 0, gg = 0, bb = 0;
  for (let i = 0; i <= PJ.hi; i++) if (PJ.alive[i] && !(PJ.fl[i] & F_REFL)) {
    const c = PJ.c[i];
    if (c === R && rr < 30) rr++; else if (c === G && gg < 30) gg++; else if (c === Bc && bb < 30) bb++; else if (c === W) { if (rr < 30) rr++; if (gg < 30) gg++; if (bb < 30) bb++; }
    if ((i & 1) === 0) streakToPlayer(PJ.x[i], PJ.y[i], PJ.z[i], c, 1);
    pjKill(i, false);
  }
  p.r = Math.min(100, p.r + rr); p.g = Math.min(100, p.g + gg); p.b = Math.min(100, p.b + bb);
  if (bossRT.def && bossRT.fracture >= 100 && !vulnBefore) bossVulnerable();
  const dmg = 300 + 6 * p.novaConsumed;
  for (let i = 0; i < targets.length; i++) { const t = targets[i]; if (t.alive) t.hit(dmg, true, 'nova'); }
  ring(p.x, 0.2, p.z, 0.5, 30, 1.0, 0.45, 0.9, 1.0, 1.3, 0.7);
  ring(p.x, 1.2, p.z, 0.2, 12, 0.6, 0.25, 1.1, 1.1, 1.5, 0.6);
  burstRainbow(p.x, 1.6, p.z, 180, 16, 1.3, 0.24, 0);
  bloomSpike(1.1); addTrauma(0.9); shockAt(p.x, 1.2, p.z, 0.06); rainbowWave(p.x, p.z, 1.0, 20);
  aberrSpike(0.012);
  if (hasFacet('afterglow')) p.afterglowT = 5;
}
function updateNova(realDt) {
  const p = player; if (p.novaT < 0) return;
  const t0 = p.novaT; p.novaT += realDt; const t = p.novaT;
  p.y = Math.min(1, t / 0.3) * (t < 0.8 ? 1 : Math.max(0, 1 - (t - 0.8) / 0.3));
  // radial shock: white core at the player, expanding ring with a chromatic edge, world drops to dark silhouettes for a few frames
  _v1.set(p.x, 1.2 + p.y, p.z).project(camera); LU.uNovaC.value.set(_v1.x * 0.5 + 0.5, _v1.y * 0.5 + 0.5);
  const rfx = settings.reduceFx;
  if (t < 0.25) { LU.uNovaA.value = 0; LU.uNovaR.value = 0; }
  else if (t < 0.4) { LU.uNovaA.value = (t - 0.25) / 0.15 * 0.6; LU.uNovaR.value = 0; LU.uNovaNeg.value = rfx ? 0 : (t - 0.25) / 0.15 * 0.5; }
  else { const k = clamp((t - 0.4) / 0.6, 0, 1); LU.uNovaR.value = easeOut(k) * 1.5; LU.uNovaA.value = (1 - k * k) * (rfx ? 0.5 : 1); LU.uNovaNeg.value = rfx ? 0 : (t < 0.52 ? 1 : Math.max(0, 1 - (t - 0.52) / 0.14)); }
  LU.uWhite.value = (!rfx && t >= 0.4 && t < 0.48) ? 0.5 : 0;
  if (t0 < 0.4 && t >= 0.4) novaBurst();
  if (t >= 0.4 && t < 0.8) director.timeScale = 0.35; else if (t >= 0.8 && t < 1.1) director.timeScale = lerp(0.35, 1, (t - 0.8) / 0.3);
  if (t < 0.4) { crystalU.uFlash.value = t / 0.4; burst(p.x, 1.2 + p.y, p.z, 3, 2, 2, 2, 4, 0.4, 0.15, 1, 1); }
  if (t >= 1.1) { p.novaT = -1; p.y = 0; LU.uWhite.value = 0; LU.uNovaA.value = 0; LU.uNovaNeg.value = 0; director.timeScale = 1; crystalU.uFlash.value = 0; }
}

// ---- per-frame player update ----
function updatePlayer(dt) {
  const p = player;
  crystalU.uTime.value = fx.simTime; specU.uTime.value = fx.simTime; grazeU.uTime.value = fx.simTime;
  if (!p.alive) { return; }
  const ctrl = canControl();
  let ix = ctrl ? input.mx : 0, iz = ctrl ? input.mz : 0;
  const sp = PLAYER.speed * (p.slowT > 0 ? 0.7 : 1);
  p.vx = damp(p.vx, ix * sp, PLAYER.accel, dt); p.vz = damp(p.vz, iz * sp, PLAYER.accel, dt);
  if (p.dashT >= 0) {
    p.dashT += dt; const k = Math.min(1, p.dashT / PLAYER.dashTime), e = easeOut(k);
    const nx = p.dashSX + p.dashDX * PLAYER.dashDist * e, nz = p.dashSZ + p.dashDZ * PLAYER.dashDist * e;
    const ox = p.x, oz = p.z; p.x = nx; p.z = nz;
    for (let j = 0; j < 3; j++) { const u = frand(); emitP(lerp(ox, p.x, u), 0.4 + frand() * 1.4, lerp(oz, p.z, u), (frand() - 0.5), frand() * 0.6, (frand() - 0.5), p.coreCol.r * 1.6, p.coreCol.g * 1.6, p.coreCol.b * 1.6, 0.5, 0.12, 4); }
    while (p.ghostN < 4 && k >= p.ghostN / 4) { spawnGhost(p.x, 1.15, p.z, torso.rotation.y + playerG.rotation.y, p.coreCol); p.ghostN++; }
    if (k >= 1) { p.dashT = -1; p.vx = p.dashDX * sp * 0.6; p.vz = p.dashDZ * sp * 0.6; ring(p.x, 0.07, p.z, 0.3, 1.6, 0.3, 0.12, 1.6, 1.8, 2.4, 1); }
  } else {
    p.x += p.vx * dt; p.z += p.vz * dt;
  }
  // external pull (boss 3 gravity hook)
  if (game.gravity > 0 && p.dashT < 0) { const d = Math.hypot(p.x, p.z) || 1; p.x -= p.x / d * game.gravity * dt; p.z -= p.z / d * game.gravity * dt; }
  // arena clamp
  const maxR = game.arenaR - 0.6, rr = Math.hypot(p.x, p.z);
  if (rr > maxR) { p.x *= maxR / rr; p.z *= maxR / rr; }
  const ac = game.arenaCut; if (ac.on) { const s = p.x * ac.nx + p.z * ac.nz - (ac.off - 0.6); if (s > 0) { p.x -= ac.nx * s; p.z -= ac.nz * s; } }
  p.distWalked += Math.hypot(p.vx, p.vz) * dt;
  // timers
  if (p.dashI > 0) p.dashI -= dt; if (p.hurtI > 0) p.hurtI -= dt; if (p.invuln > 0) p.invuln -= dt; if (p.slowT > 0) p.slowT -= dt; if (p.stunT > 0) p.stunT -= dt;
  if (p.cdLance > 0) p.cdLance -= dt; if (p.cdLattice > 0) p.cdLattice -= dt; if (p.cdMirror > 0) p.cdMirror -= dt; if (p.afterglowT > 0) p.afterglowT -= dt;
  if (p.dashCharges < p.dashMax) { p.dashRecharge += dt; if (p.dashRecharge >= PLAYER.dashCd) { p.dashCharges++; p.dashRecharge = p.dashCharges < p.dashMax ? 0.0001 : 0; } } else p.dashRecharge = 0;
  if (p.comboT > 0) { p.comboT -= dt; if (p.comboT <= 0) p.comboN = 0; }
  if (p.grazeFlash > 0) p.grazeFlash -= dt;
  // aim + facing
  computeAim();
  const moving = Math.hypot(p.vx, p.vz) > 0.5;
  const faceTarget = aim.tgt || (!IS_TOUCH && input.mouseIn && input.mouseAimT > 0) ? aim.ang : (moving ? Math.atan2(p.vz, p.vx) : p.facing);
  p.facing = p.facing + wrapA(faceTarget - p.facing) * (1 - Math.exp(-12 * dt));
  // auto-fire Prism Bolt
  if (game.state === 'fight' && p.novaT < 0) {
    p.boltT -= dt;
    if (p.boltT <= 0) {
      const splinter = hasFacet('splinter');
      p.boltT += splinter ? 0.22 : PLAYER.boltInterval; if (p.boltT < 0) p.boltT = 0;
      if (aim.tgt || (!IS_TOUCH && input.mouseAimT > 0)) {
        if (splinter) { fireBolt(-0.0524); fireBolt(0.0524); } else fireBolt(0);
      }
    }
  }
  // lattice
  if (lattice.active) {
    lattice.t += dt; const k = lattice.t / lattice.dur;
    latU.uA.value = Math.min(1, lattice.t / 0.25) * (k > 0.85 ? (1 - k) / 0.15 : 1); latU.uTime.value = fx.simTime;
    floorU.uLatPos.value.set(lattice.x, lattice.z, latU.uA.value);
    if (frand() < 0.6) { const a = frand() * TAU, r = Math.sqrt(frand()) * lattice.r; emitP(lattice.x + Math.cos(a) * r, 0.1, lattice.z + Math.sin(a) * r, 0, 0.6 + frand(), 0, 0.3, 2.2, 0.7, 1.4, 0.1, 4); }
    if (Math.hypot(p.x - lattice.x, p.z - lattice.z) < lattice.r) { healPlayer((hasFacet('living') ? 6 : PLAYER.latHeal) * dt); }
    if (k >= 1) { lattice.active = false; latDisc.visible = latWall.visible = false; floorU.uLatPos.value.z = 0; }
  } else floorU.uLatPos.value.z = 0;
  p.healT += dt; if (p.healT > 0.6) { p.healT = 0; if (p.healAcc >= 1) { dmgNumber(p.x, 2.3, p.z, '+' + Math.round(p.healAcc), 3); p.healAcc = 0; } }
  // mirror
  if (mirror.active) {
    mirror.t += dt; const k = mirror.t / mirror.dur;
    mirror.ang = mirror.ang + wrapA(aim.ang - mirror.ang) * (1 - Math.exp(-10 * dt));
    mirror.x = p.x + Math.cos(mirror.ang) * 1.2; mirror.z = p.z + Math.sin(mirror.ang) * 1.2;
    mirrorMesh.position.set(mirror.x, 1.15 + p.y, mirror.z);
    mirrorMesh.rotation.set(0, -mirror.ang + Math.PI / 2, 0); mirrorMesh.rotateZ(fx.simTime * 1.5);
    mirU.uTime.value = fx.simTime; mirU.uA.value = Math.min(1, mirror.t / 0.12) * (k > 0.85 ? (1 - k) / 0.15 : 1);
    if (mirU.uFlash.value > 0) mirU.uFlash.value = Math.max(0, mirU.uFlash.value - dt * 5);
    if (k >= 1) { mirror.active = false; mirrorMesh.visible = false; }
  }
  // low hp heartbeat
  if (p.hp / p.maxHp < 0.3) { p.lowHpBeatT -= dt; if (p.lowHpBeatT <= 0) { p.lowHpBeatT = 0.8; sfx.heartbeat(); } }
}
function fireBolt(spread) {
  const p = player;
  const sx = p.x + Math.cos(p.facing) * 0.55, sz = p.z + Math.sin(p.facing) * 0.55, sy = 1.15 + p.y;
  let dx = aim.x - sx, dy = aim.y - sy, dz = aim.z - sz;
  if (spread) { const c = Math.cos(spread), s = Math.sin(spread); const nx = dx * c - dz * s; dz = dx * s + dz * c; dx = nx; }
  const l = Math.hypot(dx, dy, dz) || 1;
  let i = -1; for (let n = 0; n < PB_N; n++) { const k = (PB.cursor + n) % PB_N; if (!PB.alive[k]) { i = k; break; } }
  if (i < 0) i = PB.cursor; PB.cursor = (i + 1) % PB_N;
  PB.alive[i] = 1; PB.x[i] = sx; PB.y[i] = sy; PB.z[i] = sz; PB.vx[i] = dx / l * PLAYER.boltSpeed; PB.vy[i] = dy / l * PLAYER.boltSpeed; PB.vz[i] = dz / l * PLAYER.boltSpeed; PB.dist[i] = 0;
  PB.crit[i] = frand() < PLAYER.crit ? 1 : 0; PB.dmg[i] = PLAYER.boltDmg;
  sfx.bolt();
}
function updateBolts(dt) {
  for (let i = 0; i < PB_N; i++) {
    if (!PB.alive[i]) continue;
    const ox = PB.x[i], oz = PB.z[i];
    PB.x[i] += PB.vx[i] * dt; PB.y[i] += PB.vy[i] * dt; PB.z[i] += PB.vz[i] * dt; PB.dist[i] += PLAYER.boltSpeed * dt;
    emitP(PB.x[i], PB.y[i], PB.z[i], 0, 0, 0, 1.2, 1.3, 1.6, 0.14, 0.12, 4);
    let dead = PB.dist[i] > PLAYER.boltRange + 4 || PB.y[i] < 0;
    if (!dead) for (let k = 0; k < targets.length; k++) {
      const t = targets[k]; if (!t.alive) continue;
      if (segDist(t.x, t.z, ox, oz, PB.x[i], PB.z[i]) < t.r + 0.12 && Math.abs(PB.y[i] - t.y) < t.hy) {
        const crit = PB.crit[i] === 1; t.hit(PB.dmg[i] * (crit ? 2 : 1), crit, 'bolt');
        // trickle: lowest channel (ties R > G > B)
        const p = player; const lo = p.r <= p.g && p.r <= p.b ? R : p.g <= p.b ? G : Bc; addCharge(lo, 1.2 * (bossRT.lastLight ? 1 : 1));
        if (bossRT.lastLight) addCharge(W, 3);
        burst(PB.x[i], PB.y[i], PB.z[i], crit ? 10 : 5, 1.8, 1.8, 2.2, crit ? 6 : 3.5, 0.3, 0.12, 1, 0);
        dead = true; break;
      }
    }
    if (dead) PB.alive[i] = 0;
    writeBoltMatrix(i);
  }
  pbMesh.instanceMatrix.needsUpdate = true;
}

// ---- player visuals ----
function updatePlayerVisuals(dt) {
  const p = player;
  playerG.position.set(p.x, p.y, p.z);
  const t = fx.simTime;
  // dominant color
  const white = p.r >= 60 && p.g >= 60 && p.b >= 60;
  if (white) p.coreCol.setRGB(1.6, 1.55, 1.5);
  else if (p.r >= p.g && p.r >= p.b) p.coreCol.setRGB(1.6, 0.25, 0.35);
  else if (p.g >= p.b) p.coreCol.setRGB(0.35, 1.6, 0.5);
  else p.coreCol.setRGB(0.35, 0.6, 1.7);
  crystalU.uCore.value.lerp(p.coreCol, 1 - Math.exp(-6 * dt));
  coreGlow.material.color.copy(crystalU.uCore.value).multiplyScalar(0.75);
  specU.uVal.value.set(p.r / 100, p.g / 100, p.b / 100);
  specU.uWhite.value = damp(specU.uWhite.value, white ? 1 : 0, 6, dt);
  specU.uPop.value.multiplyScalar(Math.exp(-6 * dt));
  const tut = bossRT.def && bossRT.idx === 0 && bossRT.phase === 0 && game.fightTime < 20;
  grazeU.uA.value = damp(grazeU.uA.value, (p.grazeFlash > 0 ? 1.0 : tut ? 0.45 : 0.14), 20, dt);
  grazeRingMesh.scale.setScalar(grazeRadius() / PLAYER.grazeR);
  floorU.uPlayerPos.value.set(p.x, p.z);
  floorU.uPlayerColor.value.copy(crystalU.uCore.value);
  const lvl = (p.r + p.g + p.b) / 300;
  floorU.uPlayerGlow.value = p.alive && playerG.visible ? 0.11 * (0.5 + lvl * 0.9) * (game.state === 'title' ? 0 : 1) : 0;
  hitDot.visible = p.alive && game.state !== 'title';
  hitDot.material.opacity = game.state === 'fight' ? 1 : 0.4;
  // body animation
  const sp = Math.hypot(p.vx, p.vz);
  if (sp > 2 && p.alive && playerG.visible && p.dashT < 0 && dt > 0) { const c = crystalU.uCore.value; emitP(p.x - p.vx * 0.03 + (frand() - 0.5) * 0.2, 0.5 + frand() * 1.2, p.z - p.vz * 0.03 + (frand() - 0.5) * 0.2, -p.vx * 0.08, 0.15, -p.vz * 0.08, c.r * 0.9, c.g * 0.9, c.b * 0.9, 0.35, 0.1, 4); }
  const bob = Math.sin(t * 2.2) * 0.06;
  torso.position.y = 1.15 + bob; coreGlow.position.y = torso.position.y;
  torso.rotation.y += dt * (0.6 + sp * 0.1);
  head.position.y = 2.25 + Math.sin(t * 2.2 + 0.6) * 0.08; head.rotation.y -= dt * 1.4;
  const lean = clamp(sp / PLAYER.speed, 0, 1) * 0.25;
  const fdx = Math.cos(p.facing), fdz = Math.sin(p.facing);
  const mvx = sp > 0.1 ? p.vx / sp : 0, mvz = sp > 0.1 ? p.vz / sp : 0;
  for (let i = 0; i < 4; i++) {
    const l = limbs[i]; const isLeg = i >= 2; const side = (i % 2 === 0) ? 1 : -1;
    const swing = Math.sin(p.distWalked * 1.6 + (i % 2) * Math.PI + (isLeg ? 0 : Math.PI)) * (0.15 + lean);
    // side axis perpendicular to facing
    const sx = -fdz * side, sz = fdx * side;
    const orbit = t * 0.6 + i * 1.57;
    const rad = isLeg ? 0.28 : 0.62;
    const px = sx * rad + fdx * swing * 0.6 + Math.cos(orbit) * 0.05, pz = sz * rad + fdz * swing * 0.6 + Math.sin(orbit) * 0.05;
    l.position.set(px, isLeg ? 0.42 + Math.abs(swing) * 0.1 : 1.25 + bob + Math.sin(t * 3 + i) * 0.05, pz);
    l.rotation.set(mvz * lean * 2 + swing * fdz, 0, -mvx * lean * 2 - swing * fdx + (isLeg ? 0 : side * 0.35));
  }
  // facing (mesh group yaw): only the spectrum ring stays world-aligned
  // flicker during hurt i-frames
  crystalU.uAlpha.value = p.hurtI > 0 ? (Math.sin(t * 60) > 0 ? 0.25 : 0.9) : 0.88;
  if (crystalU.uFlash.value > 0 && p.novaT < 0) crystalU.uFlash.value = Math.max(0, crystalU.uFlash.value - dt * 4);
}

// ---- enemy projectile simulation ----
let pjFrame = 0;
function updateProjectiles(dt) {
  pjFrame++;
  const arr = pjMesh.instanceMatrix.array; let hi = -1;
  const px = player.x, pz = player.z, gR = grazeRadius(), hurt = PLAYER.hurtR;
  const lat = lattice.active ? lattice : null, lr2 = lat ? lat.r * lat.r : 0;
  const trailN = Q.cfg.trail * (settings.reduceFx ? 2 : 1);
  const bt = bossMainTarget();
  for (let i = 0; i <= PJ.hi; i++) {
    if (!PJ.alive[i]) continue;
    PJ.age[i] += dt; PJ.life[i] -= dt;
    let fl = PJ.fl[i];
    if (PJ.life[i] <= 0) { const cb = PJ.onLand[i]; pjKill(i, true); if (cb) cb(PJ.x[i], PJ.z[i]); continue; }
    PJ.ox[i] = PJ.x[i]; PJ.oz[i] = PJ.z[i];
    let spd = 1;
    if (lat && !(fl & F_REFL)) {
      const dx = PJ.x[i] - lat.x, dz = PJ.z[i] - lat.z;
      if (dx * dx + dz * dz < lr2) { spd = 0.4; if (!(fl & F_LAT)) { fl |= F_LAT; PJ.c[i] = G; pjSetColor(i, G, fl & F_HARMLESS ? 0.35 : 1); } }
    }
    if (fl & F_ORBIT) {
      PJ.orA[i] += PJ.orW[i] * dt * spd; PJ.x[i] = Math.cos(PJ.orA[i]) * PJ.orR[i]; PJ.z[i] = Math.sin(PJ.orA[i]) * PJ.orR[i];
    } else {
      if (PJ.av[i] !== 0) { const a = PJ.av[i] * dt, c = Math.cos(a), s = Math.sin(a), vx = PJ.vx[i]; PJ.vx[i] = vx * c - PJ.vz[i] * s; PJ.vz[i] = vx * s + PJ.vz[i] * c; }
      if (PJ.acc[i] !== 0) { const m = Math.max(0.05, 1 + PJ.acc[i] * dt); PJ.vx[i] *= m; PJ.vz[i] *= m; }
      if ((fl & F_HOME) && PJ.turn[i] > 0) {
        let tx, tz;
        if (fl & F_REFL) { if (bt) { tx = bt.x; tz = bt.z; } } else { tx = px; tz = pz; }
        if (tx !== undefined) {
          const cur = Math.atan2(PJ.vz[i], PJ.vx[i]), want = Math.atan2(tz - PJ.z[i], tx - PJ.x[i]);
          const da = clamp(wrapA(want - cur), -PJ.turn[i] * dt, PJ.turn[i] * dt); const sp = Math.hypot(PJ.vx[i], PJ.vz[i]);
          PJ.vx[i] = Math.cos(cur + da) * sp; PJ.vz[i] = Math.sin(cur + da) * sp;
        }
      }
      PJ.x[i] += PJ.vx[i] * dt * spd; PJ.z[i] += PJ.vz[i] * dt * spd;
    }
    if ((fl & F_HARMLESS) && PJ.age[i] > 1.0) { fl &= ~F_HARMLESS; pjSetColor(i, PJ.c[i], 1); }
    const x = PJ.x[i], z = PJ.z[i], r = PJ.r[i];
    if (fl & F_REFL) {
      for (let k = 0; k < targets.length; k++) {
        const t = targets[k]; if (!t.alive) continue;
        if (Math.hypot(x - t.x, z - t.z) < t.r + r) {
          t.hit(PJ.dmg[i], false, 'refl'); if (t.isBoss) bossAddFracture(4);
          burst(x, PJ.y[i], z, 12, 0.6, 1.2, 2.6, 5, 0.4, 0.15, 1, 0); PJ.fl[i] = fl; pjKill(i, false); break;
        }
      }
      if (!PJ.alive[i]) continue;
    } else if (!(fl & (F_HARMLESS | F_NOHIT)) && player.alive) {
      const dxp = x - px, dzp = z - pz;
      if (mirror.active && dxp * dxp + dzp * dzp < (PLAYER.mirR + r) * (PLAYER.mirR + r)) {
        const a = Math.atan2(dzp, dxp);
        if (Math.abs(wrapA(a - mirror.ang)) < Math.PI / 3) {
          fl |= F_REFL | F_HOME; PJ.c[i] = Bc; pjSetColor(i, Bc, 1.3); PJ.turn[i] = 6; PJ.dmg[i] = hasFacet('polished') ? 40 : PLAYER.mirDmg; PJ.life[i] = 4;
          const sp = Math.hypot(PJ.vx[i], PJ.vz[i]) * 1.4 + 2; PJ.vx[i] = Math.cos(a) * sp; PJ.vz[i] = Math.sin(a) * sp; PJ.av[i] = 0; PJ.acc[i] = 0; fl &= ~F_ORBIT; PJ.onLand[i] = null;
          player.reflectN++; sfx.tink(player.reflectN); mirU.uFlash.value = 0.6;
          burst(x, 1.0, z, 6, 0.8, 1.4, 2.8, 4, 0.3, 0.12, 1, 4);
          PJ.fl[i] = fl; hi = i; writePj(arr, i); continue;
        }
      }
      hitSrc = 'proj';
      const cd = segDist(px, pz, PJ.ox[i], PJ.oz[i], x, z);
      const d = cd - r - hurt;
      if (d < gR - hurt) {
        const res = resolveHazard(d, gR - hurt, PJ.c[i], PJ.dmg[i], !(fl & F_GRAZED), 6, x, z);
        if (res === HZ_HIT) { PJ.fl[i] = fl; pjKill(i, true); continue; }
        if (res === HZ_GRAZE || res === HZ_PERFECT) fl |= F_GRAZED;
      }
    }
    if (x * x + z * z > 900) { PJ.fl[i] = fl; pjKill(i, false); continue; }
    PJ.fl[i] = fl;
    if (!(fl & F_NOTRAIL) && ((pjFrame + i) % trailN) === 0) { const c = PCOL[PJ.c[i]]; emitP(x, PJ.y[i], z, -PJ.vx[i] * 0.05, 0, -PJ.vz[i] * 0.05, c[0] * 1.4, c[1] * 1.4, c[2] * 1.4, 0.25, r * 1.1, 4); }
    writePj(arr, i);
    hi = i;
  }
  PJ.hi = hi; pjMesh.count = hi + 1;
  pjMesh.instanceMatrix.needsUpdate = true;
  if (PJ.colorDirty) { pjMesh.instanceColor.needsUpdate = true; PJ.colorDirty = false; }
}
function writePj(arr, i) {
  const o = i * 16; const s = PJ.r[i] * (1 + Math.sin(PJ.age[i] * 14 + i) * 0.08);
  arr[o] = s; arr[o + 5] = s; arr[o + 10] = s; arr[o + 12] = PJ.x[i]; arr[o + 13] = PJ.y[i]; arr[o + 14] = PJ.z[i]; arr[o + 15] = 1;
}

/* =====================================================================
