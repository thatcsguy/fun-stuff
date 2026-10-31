   18  GAME — state machine & flow
   ===================================================================== */
let titleStarting = false;
function titleStart(idx = null, full = true) {
  if (game.state !== 'title' || titleStarting) return;
  if (idx === null) { const q = parseInt(URLP.get('boss') || '1', 10); idx = clamp((isNaN(q) ? 1 : q) - 1, 0, 2); if (idx > 0) full = false; }
  audioInit(); titleStarting = true;
  $('title').classList.add('out');
  _v1.set(0, 0, -10).applyQuaternion(camera.quaternion).add(camera.position);
  burstRainbow(_v1.x, _v1.y, _v1.z, 200, 10, 1.4, 0.18, 4);
  sfx.shatter(0.8);
  setTimeout(() => { titleStarting = false; showScreen('title', false); startRun(full, idx); }, 650);
}
function setArenaLook(arena) {
  floorU.uArena.value = arena;
  if (arena === 0) { nebU.uA.value.setRGB(0.45, 0.12, 0.25); nebU.uB.value.setRGB(0.15, 0.12, 0.45); scene.fog = null; }
  else if (arena === 1) { nebU.uA.value.setRGB(0.15, 0.5, 0.3); nebU.uB.value.setRGB(0.35, 0.15, 0.6); }
  else { nebU.uA.value.setRGB(0.1, 0.2, 0.6); nebU.uB.value.setRGB(0.6, 0.2, 0.1); }
  floorU.uPalFrom.value = 0; floorU.uPalTo.value = 0; floorU.uPalRadius.value = 0; floorU.uSwirl.value = 1;
  floor.position.y = arena === 1 ? -10 : 0; floorU.uEdgeGlow.value = arena === 1 ? 0 : 1;
  for (let i = 0; i < 6; i++) floorU.uVoid.value[i].w = 0;
  floorU.uIgnite.value = 99; floorU.uDawn.value = 0; floorU.uFloorDim.value = 0; LU.uWarpStrength.value = 0; LU.uDark.value = 0;
  starU.uColorful.value = 0; starU.uBright.value = 1; nebU.uOp.value = 0.25;
}
function startRun(full, idx = 0) {
  game.runMode = full ? 'full' : 'single'; game.facets = []; game.runTime = 0; game.bossTimes = [null, null, null]; game.cpBoss = {}; game.checkpointed = false;
  game.stats.grazes = 0; game.stats.perfects = 0; game.stats.deaths = 0; game.stats.time = 0; game.tutorial = {};
  game.sat = game.satTarget = SAT_BOSS[idx];
  beginBoss(idx, { intro: true });
}
game.gen = 0; game.checkpointed = false;
function beginBoss(idx, opts = {}) {
  const gen = ++game.gen; ui.tutQ.length = 0;
  ['title', 'bossSel', 'settings', 'pause', 'facet', 'defeat', 'victory'].forEach((s) => showScreen(s, false));
  $('title').classList.remove('out');
  ui.hud(false); ui.letterbox(false); ui.el.descend.classList.remove('on');
  game.bossIdx = idx; game.defeatT = -1;
  BOSSES.forEach((d, i) => d.show(i === idx));
  const def = BOSSES[idx];
  setArenaLook(def.arena);
  bossReset(idx, opts.phase || 0);
  resetPlayer(opts.charge || 30);
  game.fightTime = 0; director.timeScale = 1; LU.uWhite.value = 0; LU.uDark.value = 0;
  ui.setupBossFrame(def);
  ui.el.fade.style.opacity = '0';
  if (opts.retry) { playerG.visible = false; reform(player.x, 1.15, player.z, 60, 0.8, 1.4, 1.6, 2.2, 6); setTimeout(() => { if (game.gen === gen && player.alive && game.state !== 'title') { playerG.visible = true; ring(player.x, 0.06, player.z, 0.3, 4, 0.6, 0.3, 2, 2.2, 2.6, 1.4); } }, 800); player.invuln = 1.2; }
  if (opts.intro) {
    game.state = 'intro';
    const c = def.introCine(); const oe = c.end; c.end = () => { oe && oe(); startFight(); };
    playCine(c);
  } else startFight();
}
function startFight() {
  game.state = 'fight'; ui.hud(true);
  ui.letterbox(false); ui.tcT = Math.min(ui.tcT, 1.2); // never keep the cinematic bars over live play
  measureHud();
  const def = bossRT.def; music.setSection(def.music[bossRT.phase] || def.music[0]);
  if (bossRT.idx === 0 && bossRT.phase === 0) {
    const gen = game.gen;
    ui.tutorial('move', IS_TOUCH ? 'Move: drag the left side of the screen' : 'Move: WASD  ·  Aim: mouse  ·  Dash: SPACE');
    setTimeout(() => { if (game.gen === gen && game.state === 'fight') ui.tutorial('dash', 'Dash through attacks for PERFECT grazes'); }, 6500);
  }
}
function retryBoss() {
  showScreen('defeat', false);
  const idx = game.bossIdx;
  const cp = idx === 2 && B3.checkpoint; // boss 3 is long: dying in the Supernova phase restarts there
  const cpT = B3.cpTime || 0;
  beginBoss(idx, cp ? { retry: true, intro: false, phase: 2, charge: 40 } : { retry: true, intro: false });
  if (cp) { game.fightTime = cpT; B3.cpTime = cpT; game.checkpointed = true; ui.toast('CHECKPOINT — SUPERNOVA', 2.2); } // the clock resumes from the Supernova start; no best time
  else game.checkpointed = false;
}
function onBossDefeated() {
  const idx = game.bossIdx; const t = game.bossTimes[idx];
  const key = 'b' + (idx + 1); game.newBest = game.newBest || {};
  game.cpBoss = game.cpBoss || {}; game.cpBoss[key] = !!game.checkpointed;
  if (t != null && !game.checkpointed && (store.best[key] == null || t < store.best[key])) { store.best[key] = t; game.newBest[key] = true; }
  game.checkpointed = false;
  store.unlocked = Math.max(store.unlocked || 1, Math.min(3, idx + 2)); saveStore();
  if (idx < BOSSES.length - 1) showFacet(); else showVictory();
}
function showFacet() {
  game.state = 'facet'; ui.hud(false);
  const pool = FACETS.filter((f) => !hasFacet(f.id)); const pick = [];
  while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(frand() * pool.length), 1)[0]);
  const wrap = $('facetCards'); wrap.innerHTML = '';
  pick.forEach((f) => {
    const c = document.createElement('div'); c.className = 'card';
    c.innerHTML = `<div class="gl" style="color:${f.color}">${f.glyph}</div><div><div class="nm">${f.name}</div><div class="ds">${f.desc}</div></div>`;
    c.addEventListener('click', () => {
      if (c.classList.contains('pick')) return; sfx.shatter(0.6); sfx.ui();
      wrap.querySelectorAll('.card').forEach((o) => o.classList.add(o === c ? 'pick' : 'gone'));
      setTimeout(() => { pickFacet(f.id); showScreen('facet', false); descend(); }, 750);
    });
    wrap.appendChild(c);
  });
  showScreen('facet');
}
function pickFacet(id) { if (!hasFacet(id)) game.facets.push(id); if (id === 'core') { player.maxHp = 130; player.hp = 130; } if (id === 'third') player.dashMax = 3; }
function descend() {
  const next = game.bossIdx + 1; const def = BOSSES[next];
  ui.el.descendSub.textContent = def.name + ' — ' + def.subtitle;
  game.state = 'cinematic';
  playCine({
    dur: 3.0,
    start() { sfx.fall(); },
    update(t) {
      const k = smooth(t / 3);
      director.camPos.set(0, lerp(16, -30, easeIn(t / 3)), lerp(14, 4, k)); director.camLook.set(0, lerp(0, -60, k), 0); director.fov = lerp(50, 95, k);
      starU.uStreak.value = smooth((t - 0.6) / 1.2); ui.el.fade.style.opacity = String(smooth((t - 0.8) / 0.7) * 0.85);
      if (t > 1.0) ui.el.descend.classList.add('on');
    },
    ev: [[0.2, () => { rainbowWave(player.x, player.z, 1.2, 20); }]],
    end() { starU.uStreak.value = 0; ui.el.descend.classList.remove('on'); ui.el.fade.style.opacity = '0'; beginBoss(next, { intro: true }); },
  });
}
function showVictory() {
  game.state = 'victory'; ui.hud(false); music.setSection('victory');
  starU.uColorful.value = 1; game.satTarget = 1;
  let run = null;
  const cpb = game.cpBoss || {}; const anyCp = cpb.b1 || cpb.b2 || cpb.b3;
  if (game.runMode === 'full' && game.bossTimes.every((t) => t != null)) { run = game.bossTimes.reduce((a, b) => a + b, 0); if (!anyCp && (store.best.run == null || run < store.best.run)) { store.best.run = run; game.newBest.run = true; } saveStore(); }
  const nb = game.newBest || {};
  const rows = [];
  if (run != null) rows.push(`<div class="${nb.run ? 'best' : ''}">TOTAL ${fmtTimeMs(run)}${nb.run ? ' · NEW BEST' : ''}</div>`);
  game.bossTimes.forEach((t, i) => { if (t != null) rows.push(`<div class="${nb['b' + (i + 1)] ? 'best' : ''}">${BOSSES[i].name} · ${fmtTimeMs(t)}${cpb['b' + (i + 1)] ? ' · CHECKPOINT' : ''}</div>`); });
  rows.push(`<div>GRAZES ${game.stats.grazes} · PERFECT DASHES ${game.stats.perfects} · SHATTERED ${game.stats.deaths}</div>`);
  if (game.facets.length) rows.push(`<div>FACETS · ${game.facets.map((id) => FACETS.find((f) => f.id === id).name).join(' · ')}</div>`);
  $('victoryStats').innerHTML = rows.join('');
  const cred = ['<div class="h">PRISMFALL</div>', '<div>THE LANTERN CHOIR · SILENCED</div>', '<div>VEYRA · UNBOUND</div>', '<div>THE NULL SUN · DAWN</div>',
    '<div>every light, shard and note was synthesized in your browser</div>', '<div class="h">THANK YOU, LIGHTBREAKER</div>'];
  $('credits').innerHTML = cred.map((c, i) => c.replace('<div', `<div style="animation-delay:${(1.2 + i * 0.9).toFixed(1)}s"`)).join('');
  showScreen('victory');
  game.newBest = {}; game.cpBoss = {};
}
function showDefeat() {
  game.state = 'defeat'; ui.hud(false);
  const b = bossRT;
  $('defeatSub').textContent = b.def ? b.def.name : '';
  $('defeatStats').innerHTML = `<div>BOSS REMAINING ${(b.hp / b.maxHp * 100).toFixed(1)}%</div><div>TIME ${fmtTimeMs(game.fightTime)}</div><div>GRAZES ${game.stats.grazes} · PERFECT ${game.stats.perfects}</div>`;
  showScreen('defeat');
}
function toTitle() {
  ['bossSel', 'settings', 'pause', 'facet', 'defeat', 'victory'].forEach((s) => showScreen(s, false));
  if (director.cine) { director.cine = null; director.camOverride = false; }
  game.gen++; pendTouch.clear(); ui.tutQ.length = 0; dmgNumsClear(); LU.uNovaA.value = 0; LU.uNovaNeg.value = 0;
  game.state = 'title'; ui.hud(false); ui.letterbox(false); ui.el.titleCard.classList.remove('on'); ui.el.fade.style.opacity = '0';
  clearTasks(); teleClearAll(); pjClearAll(false); hzBeamsClear();
  bossRT.def = null; bossTarget.alive = false; targets.length = 0;
  BOSSES.forEach((d, i) => d.show(i === 0)); setArenaLook(0); BOSS1.setTitleMode();
  playerG.visible = false; lattice.active = false; latDisc.visible = latWall.visible = false; mirror.active = false; mirrorMesh.visible = false;
  game.sat = game.satTarget = SAT_TITLE; starU.uColorful.value = 0; LU.uWhite.value = 0; director.timeScale = 1;
  music.setSection('title'); renderStats(); showScreen('title'); $('title').classList.remove('out');
}
function togglePause(force) {
  const want = force !== undefined ? force : game.state !== 'paused';
  if (want && game.state === 'fight') { game.prevState = 'fight'; game.state = 'paused'; showScreen('pause'); joy.id = -1; joy.el.classList.remove('on'); input.jx = input.jz = 0; if (AU.ctx) { AU.music.gain.setTargetAtTime(0.15, AU.ctx.currentTime, 0.1); } }
  else if (!want && game.state === 'paused') { game.state = game.prevState || 'fight'; showScreen('pause', false); showScreen('settings', false); if (AU.ctx) { AU.music.gain.setTargetAtTime(0.5, AU.ctx.currentTime, 0.1); } }
}

/* =====================================================================
   QUALITY apply + adaptive controller
   ===================================================================== */
function applyQuality(name) {
  Q.name = name; Q.cfg = QUALITY[name];
  bloom.strength = Q.cfg.bloomStr;
  if (Q.cfg.low) LensFX.defines.LOW = ''; else delete LensFX.defines.LOW; LensFX.needsUpdate = true;
  for (const m of [floorMat, nebula.material, B1.flame.material, ...B3.fbmMats]) { m.defines.FBM_OCT = Q.cfg.fbm; m.needsUpdate = true; }
  starGeo.setDrawRange(0, Q.cfg.stars);
  if (fx.head >= Q.cfg.particles) fx.head = 0;
  Q.emergency = false;
  resize();
}
const perf = { frames: 0, time: 0, fps: 60, good: 0, lastChange: 0, skip: 0 };
function updatePerf(realDt, now) {
  perf.frames++; perf.time += realDt;
  if (perf.time < 2) return;
  const fps = perf.frames / perf.time; perf.fps = fps; perf.frames = 0; perf.time = 0;
  if (!Q.auto || perf.skip > 0 || document.hidden) { perf.skip = Math.max(0, perf.skip - 1); return; }
  const ti = TIERS.indexOf(Q.name);
  if (fps < 45 && now - perf.lastChange > 3000) {
    if (ti > 0) { applyQuality(TIERS[ti - 1]); perf.lastChange = now; perf.good = 0; }
    else if (fps < 30 && !Q.emergency) { Q.emergency = true; resize(); perf.lastChange = now; }
  } else if (fps > 58) {
    perf.good += 2;
    if (perf.good >= 6 && ti < TIERS.indexOf(Q.maxAuto) && now - perf.lastChange > 3000) { applyQuality(TIERS[ti + 1]); perf.lastChange = now; perf.good = 0; }
  } else perf.good = 0;
}

/* =====================================================================
   19  LOOP
   ===================================================================== */
let lastNow = performance.now();
function simStep(dt) {
  fx.simTime += dt;
  const t = fx.simTime;
  partU.uTime.value = t; floorU.uTime.value = t; nebU.uTime.value = t; starU.uTime.value = t; LU.uTime.value = t;
  partU.uAttract.value.set(player.x, player.y, player.z);
  if (game.state === 'fight') { game.fightTime += dt; game.runTime += dt; }
  if (rippleCD > 0) rippleCD -= dt;
  updatePlayer(dt);
  updateBoss(dt);
  updateProjectiles(dt);
  updateHzBeams(dt);
  updateTele(dt);
  updateBolts(dt);
  updateRings(dt); updateBeams(dt); updateShards(dt); updateDmgNums(dt); updateGhosts(dt); updateWaves(dt);
  updatePlayerVisuals(dt);
  if (game.defeatT > 0) { game.defeatT -= dt; if (game.defeatT <= 0 && !player.alive && game.state === 'fight') showDefeat(); }
  if (game.state === 'title' || game.state === 'victory') { titleWaveT -= dt; if (titleWaveT <= 0) { titleWaveT = game.state === 'victory' ? 2.2 : 4; rainbowWave(0, 0, game.state === 'victory' ? 1.2 : 0.7, 12); } }
}
let titleWaveT = 1;
function frame(now) {
  requestAnimationFrame(frame);
  let realDt = (now - lastNow) / 1000; lastNow = now;
  if (!(realDt > 0)) realDt = 0; const rawDt = Math.min(realDt, 0.5); if (realDt > 0.05) realDt = 0.05;
  updateInput(realDt);
  const paused = game.state === 'paused';
  if (!paused) updateDirector(realDt * debug.timeScale);
  let ts = director.timeScale * debug.timeScale; if (director.hitstopT > 0) ts = 0;
  const simDt = paused ? 0 : realDt * ts;
  if (simDt > 0) {
    const steps = Math.min(8, Math.max(1, Math.ceil(simDt / (1 / 30))));
    const h = simDt / steps;
    for (let i = 0; i < steps; i++) simStep(h);
  }
  if (!paused) updateNova(realDt * debug.timeScale);
  updateCamera(realDt);
  // post-processing uniforms
  bloom.strength = Math.min(game.state === 'fight' ? 1.6 : 1.4, Q.cfg.bloomStr + director.bloomBoost);
  // photosensitivity: full-screen white is capped (and nearly off with Reduce Effects)
  if (LU.uWhite.value > 0) LU.uWhite.value = Math.min(LU.uWhite.value, settings.reduceFx ? 0.12 : 0.6);
  LU.uAberr.value = 0.0015 + director.aberr;
  game.sat = damp(game.sat, game.satTarget + (game.state === 'fight' && bossRT.def ? 0.25 * bossRT.phase / Math.max(1, bossRT.def.phases.length - 1) * 0.6 : 0), 1.5, realDt);
  LU.uSat.value = clamp(game.sat, 0, 1);
  LU.uLowHp.value = damp(LU.uLowHp.value, game.state === 'fight' && player.alive && player.hp / player.maxHp < 0.3 ? 1 : 0, 3, realDt);
  LU.uHurt.value = Math.max(0, LU.uHurt.value - realDt * 2.2);
  LU.uGrain.value = settings.reduceFx ? 0.015 : 0.04;
  starU.uPx.value = renderer.getPixelRatio();
  partU.uProj.value = renderer.getPixelRatio() * VH / (2 * Math.tan(camera.fov * Math.PI / 360));
  ui.update(realDt);
  flushParticles();
  composer.render(realDt);
  updatePerf(rawDt, now);
  if (DEBUG) ui.el.dbg.textContent = `${perf.fps.toFixed(0)} fps · ${Q.name}${Q.emergency ? '!' : ''} · pr ${renderer.getPixelRatio().toFixed(2)} · pj ${PJ.count} · calls ${renderer.info.render.calls}`;
}

/* =====================================================================
   20  DEBUG — window.__game
   ===================================================================== */
window.__game = {
  get state() { return game.state; },
  get player() { const p = player; return { hp: p.hp, maxHp: p.maxHp, x: p.x, z: p.z, r: p.r, g: p.g, b: p.b, dashCharges: p.dashCharges, iframes: Math.max(p.dashI, p.hurtI, p.invuln), alive: p.alive }; },
  get boss() { const b = bossRT; return b.def ? { index: b.idx, name: b.def.name, hp: b.hp, maxHp: b.maxHp, phase: b.phase, fracture: b.fracture, vulnerable: b.vuln > 0, shielded: b.shieldMul < 1, cast: b.cast.active ? b.cast.name : null, enrageLeft: b.enrageLeft, dead: b.dead } : null; },
  get fps() { return perf.fps; }, get quality() { return Q.name; }, get projectiles() { return PJ.count; },
  get stats() { return Object.assign({}, game.stats, { time: game.fightTime }); },
  get facets() { return game.facets.slice(); },
  get info() { return renderer.info; },
  get cine() { return director.cine ? { t: director.ct, dur: director.cine.dur, ts: director.timeScale, hs: director.hitstopT } : null; },
  start() { if (director.cine) { director.cine = null; director.camOverride = false; } startRun(true, 0); endCine(); ui.tcT = 0.01; ui.letterbox(false); ui.el.titleCard.classList.remove('on'); },
  setBoss(n, skipIntro = true) { if (director.cine) { director.cine = null; director.camOverride = false; } game.sat = game.satTarget = SAT_BOSS[clamp(n - 1, 0, 2)]; beginBoss(clamp(n - 1, 0, 2), { intro: !skipIntro }); },
  // p is the 0-based phase index (1 = second phase); out-of-range values are clamped
  setPhase(p, opts = {}) { if (!bossRT.def) return false; const n = bossRT.def.phases.length; p = clamp(Math.round(+p || 0), 1, n - 1); if (opts.instant) bossStartTransition(p, true); else { bossRT.hp = bossRT.def.phases[p - 1].until * bossRT.maxHp; bossStartTransition(p); } return p; },
  killBoss() { if (bossRT.def && !bossRT.dead) { if (game.state !== 'fight') game.state = 'fight'; bossDie(); } },
  damageBoss(n) { const was = game.state; bossTakeDamage(n, false, 'debug'); return was; },
  godMode(on = true) { debug.god = !!on; },
  fill() { player.r = player.g = player.b = 100; player.cdLance = player.cdLattice = player.cdMirror = 0; player.dashCharges = player.dashMax; },
  get timeScale() { return debug.timeScale; }, set timeScale(v) { debug.timeScale = Math.max(0, +v || 0); },
  forceQuality(t) { if (t === 'auto') { Q.auto = true; return; } Q.auto = false; applyQuality(t); },
  skipCinematic() { skipCine(true); },
  setCam(x, y, z, lx, ly, lz) { if (x === null || x === undefined) { cam.lock = null; return; } cam.lock = { pos: new THREE.Vector3(x, y, z), look: new THREE.Vector3(lx, ly, lz) }; },
  cast(name, arg) { const d = bossRT.def; if (d && d.casts[name]) { d.casts[name](arg); return true; } return false; },
  facet(id) { pickFacet(id); }, victory() { showVictory(); }, defeat() { player.hurtI = 0; player.invuln = 0; debug.god = false; damagePlayer(9999, R); },
  use(name) { return useAbility(name); }, autopilot(on = true) { debug.autopilot = !!on; debug.log = []; }, get hitLog() { return debug.log || []; }, move(x, z) { input.jx = x; input.jz = z; },
  setPlayer(x, z) { player.x = x; player.z = z; },
  setPixelRatio(v) { Q.prOverride = v || 0; resize(); },  // test helper (software renderers)
  _dbg: { scene, renderer, floor, nebula, stars, composer, bloom, lensPass, Q, resize },
};

/* =====================================================================
   INIT
   ===================================================================== */
buildBoss1(); buildBoss2(); buildBoss3();
if (settings.quality !== 'auto') { Q.auto = false; applyQuality(settings.quality); } else applyQuality(Q.name);
resize();
function precompile() {
  const toggles = [B1.group, B2.group, B3.group, latDisc, latWall, mirrorMesh, ...rings.map((r) => r.m), ...beams.map((b) => b.m), ...tele.map((t) => t.m), ...ghosts.map((g) => g.m), ...dmgNums.map((d) => d.sp), ...B2.precomp, ...B3.precomp];
  const prev = toggles.map((o) => o.visible); toggles.forEach((o) => (o.visible = true)); const hv = B1.heart.visible; B1.heart.visible = true;
  try { renderer.compile(scene, camera); composer.render(0.016); } catch (e) { console.warn(e); }
  toggles.forEach((o, i) => (o.visible = prev[i])); B1.heart.visible = hv;
}
BOSSES.forEach((d, i) => d.show(i === 0)); BOSS1.setTitleMode(); playerG.visible = false;
updateCamera(0.016);
precompile();
renderStats();
requestAnimationFrame((t) => { lastNow = t; $('loading').style.opacity = '0'; setTimeout(() => $('loading').remove(), 900); frame(t); });
