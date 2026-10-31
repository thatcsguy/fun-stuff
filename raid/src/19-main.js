// =============================================================================
//  §18b/§19  Main loop (fixed 60 Hz sim + render interpolation, visibility pause),
//            window.__raid test hook, debug panel, boot / prewarm.
//  This is the LAST module: all wiring that calls into other modules happens here.
// =============================================================================
const STEP = 1 / CONFIG.sim.hz;
let simAcc = 0, lastNow = 0, fpsAcc = 0, fpsFrames = 0;
Game.fps = 0;

/** one fixed simulation step (dt = 1/60 s of sim time) */
function simStep(dt) {
  Game.time += dt;
  GLOBAL_U.uTime.value = Game.time;
  Timers.sim(dt);
  Input.update();
  const st = Game.state;
  if (st === 'fight' || st === 'transition' || st === 'intro' || st === 'defeat' || st === 'victory') {
    if (st === 'fight' || st === 'transition') Game.fightTime += dt;
    Game.player.update(dt);
    if (Game.boss) Game.boss.update(dt);
    Adds.update(dt);
    Projectiles.update(dt);
    Telegraphs.update(dt);
    Hazards.update(dt);
    RingCue.update(dt);
  }
  if (Game.arena && Game.arena.update) Game.arena.update(dt);
  if (Game.encounter && Game.encounter.update && Game.state !== 'title') Game.encounter.update(dt);
}

/** wall-clock systems (unaffected by hit-stop / slow-mo) */
function realStep(rdt) {
  TimeFX.update(rdt);
  Timers.real(rdt);
  if (Game.player) Game.player.updateReal(rdt);
}

function renderFrame(rdt, alpha, sdt, noDraw) {
  const p = Game.player;
  p.syncVisual(alpha, rdt);
  GLOBAL_U.uOccP.value.set(p.vis.x, 1.1, p.vis.z);
  GLOBAL_U.uOccNear.value = CamRig.rail ? 9 : 4;   // cinematic rails swing close past pillars: clear a bigger bubble around the lens
  if (Game.boss) Game.boss.syncVisual(alpha, rdt);
  Adds.syncVisual(alpha);
  Projectiles.syncVisual(alpha);
  Shards.update(sdt); Rubble.update(sdt);
  GroundFX.update(sdt); SlashFX.update(sdt); Beams.update(sdt);
  RingCue.sync(rdt);
  if (!Game.paused) CamRig.update(rdt);
  PointLights.update(rdt);
  Particles.flush(Game.time + simAcc);
  Post.update(rdt);
  Audio.update(rdt);
  HUD.update(rdt);
  DmgNumbers.update(rdt);
  Hint.update(rdt);
  Debug.update(rdt);
  if (!noDraw) Post.render(rdt);
}

/** one wall-clock frame of rdt seconds: real systems, fixed sim steps, visuals (+ draw unless noDraw) */
function tick(rdt, noDraw) {
  if (rdt > CONFIG.sim.maxFrameDt) rdt = CONFIG.sim.maxFrameDt;
  if (rdt < 0) rdt = 0;
  fpsAcc += rdt; fpsFrames++;
  if (fpsAcc >= 0.5) { Game.fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
  Game.realTime += rdt; GLOBAL_U.uRealTime.value = Game.realTime;
  if (!Game.paused) realStep(rdt);
  const ts = Game.paused ? 0 : TimeFX.scale * Game.baseScale;
  Game.timeScale = ts;
  simAcc += rdt * ts;
  let n = 0;
  try {
    while (simAcc >= STEP && n < CONFIG.sim.maxSteps) { simStep(STEP); simAcc -= STEP; n++; }
    if (n >= CONFIG.sim.maxSteps && simAcc > STEP) simAcc = STEP * 0.5;   // drop time rather than spiral
    renderFrame(rdt, simAcc / STEP, rdt * ts, noDraw);
  } catch (e) {
    console.error(e);
    if (!Game._errShown) { Game._errShown = true; }
  }
}

let manualClock = false;   // tests: __raid.manual(true) + __raid.advance(sec) give frame-rate-independent stepping
function frame(now) {
  requestAnimationFrame(frame);
  if (!lastNow) lastNow = now;
  const rdt = (now - lastNow) / 1000; lastNow = now;
  if (Game.hidden || manualClock) return;
  tick(rdt, false);
  Quality.sample(Math.min(rdt * 1000, 1000));
}

// ---------------------------------------------------------------- visibility → auto-pause (§0.3)
document.addEventListener('visibilitychange', () => {
  Game.hidden = document.hidden;
  if (document.hidden) {
    Audio.suspend();
    if (Game.state === 'fight' || Game.state === 'transition' || Game.state === 'intro') Game.togglePause(true);
  } else {
    lastNow = 0;
    if (!Game.paused) Audio.resume();
  }
});

// ---------------------------------------------------------------- window.__raid (§14)
const __raid = window.__raid = {
  ready: false,
  version: CONFIG.version,
  get state() { return Game.state; },
  get save() { return Save; },
  /** start boss i (0|1|2, or 'training'). Works from any state; skipIntro defaults to true. */
  startBoss(i, opts) {
    opts = opts || {};
    const skip = opts.skipIntro !== false;
    Game.paused = false;
    Game.startFight(i, { difficulty: opts.difficulty, skipIntro: skip, instant: skip, seed: opts.seed, startPhase: opts.startPhase });
  },
  startTraining(opts) { this.startBoss('training', opts); },
  setGod(on) { Game.god = !!on; },
  /** fast-forward the fight sim (fixed steps, no render) until fightTime >= seconds. Cinematics auto-skipped. */
  skipTo(seconds) {
    const ok = (s) => s === 'fight' || s === 'transition' || s === 'intro';
    if (!ok(Game.state)) return Game.fightTime;
    let guard = 0;
    while (Game.fightTime < seconds && guard++ < 60 * 1200) {
      if (CamRig.rail) CamRig.finishRail(true);
      realStep(STEP);
      simStep(STEP);
      if (!ok(Game.state)) break;
    }
    if (CamRig.rail) CamRig.finishRail(true);
    return Game.fightTime;
  },
  setBossHp(pct) { const b = Game.boss; if (!b) return; if (b.setHpPct) b.setHpPct(pct); else b.hp = Math.max(1, Math.round(b.maxHp * pct)); },
  press(action) { Input.press(action); },
  setMove(x, z) { Input.virt = (x || z) ? { x: +x || 0, z: +z || 0 } : null; },
  setQuality(t) { Quality.setMode(t); },
  get player() {
    const p = Game.player; if (!p) return null;
    const cds = {};
    for (const k of ACTIONS) cds[k] = k === 'dash' ? (p.cds.dash.charges > 0 ? 0 : +p.cds.dash.t.toFixed(3)) : (k === 'ult' ? (p.hourglass >= 100 ? 0 : 1) : Math.max(0, +p.cds[k].t.toFixed(3)));
    return { x: +p.pos.x.toFixed(3), z: +p.pos.z.toFixed(3), hp: p.hp, maxHp: p.maxHp, flux: +p.flux.toFixed(2), hourglass: +p.hourglass.toFixed(2), fractures: p.fractures,
      alive: p.alive, invuln: p.invuln, echo: p.echo.active ? { x: +p.echo.x.toFixed(3), z: +p.echo.z.toFixed(3) } : null, cds, dashCharges: p.cds.dash.charges,
      statuses: p.statuses.map((s) => s.id), shield: p.shield, target: p.target ? (p.target.isAdd ? 'add' : 'boss') : null };
  },
  get boss() {
    const b = Game.boss; if (!b) return null;
    return { index: b.index, name: b.name, hp: b.hp, maxHp: b.maxHp, phase: b.phase, casting: b.cast ? { name: b.cast.name, t: +b.cast.t.toFixed(3), dur: b.cast.dur, interruptible: !!b.cast.interruptible } : null,
      invuln: !!b.invuln, enrageAt: b.enrageAt, fightTime: +Game.fightTime.toFixed(3), x: +b.pos.x.toFixed(3), z: +b.pos.z.toFixed(3), statuses: (b.statuses || []).map((s) => s.id) };
  },
  get telegraphs() {
    const out = [];
    for (const t of Telegraphs.list) if (t.active && !t.resolved && t.delay <= 0) out.push({ shape: t.shape, x: +t.x.toFixed(3), z: +t.z.toFixed(3), progress: +t.progress.toFixed(3), color: t.colorName, source: t.source, rot: +t.rot.toFixed(3) });
    return out;
  },
  get hazards() { const out = []; for (const h of Hazards.list) if (h.active && !h.dying) out.push({ shape: h.shape, x: +h.x.toFixed(3), z: +h.z.toFixed(3), r: +h.r.toFixed(3), source: h.source }); return out; },
  events: Game.events,
  get fps() { return Game.fps; },
  // ---- extras for developers / tests
  game: Game,
  config: CONFIG,
  /** module internals for tests / console poking */
  get api() { return { THREE, Telegraphs, Hazards, RingCue, Particles, ShardFX, GroundFX, SlashFX, CamRig, TimeFX, Post, Quality, Banner, Stamp, Hint, PhaseTitle, dealDamage, Audio, Adds, Projectiles, Input, HUD, scene, camera, renderer }; },
  /** training dummy: force its next ability ('cleave','hail','line','toll','sanctum','chime','quarters','pulse','tremor','severance','gaze','adds') */
  forceAbility(name) { const b = Game.boss; if (b && b['ab_' + name]) { b.forceNext = name; b.nextT = 0; } },
  pause(on) { if (on !== Game.paused) Game.togglePause(on); },
  /** tests: stop the rAF clock (true) so advance() fully controls time; false resumes real time */
  manual(on) { manualClock = !!on; lastNow = 0; },
  /** tests: advance `sec` of wall-clock time in fixed 1/fps frames (default 60), drawing only the last frame */
  advance(sec, fps, noDraw) { const dt = 1 / (fps || 60), n = Math.max(1, Math.round(sec / dt)); for (let i = 0; i < n; i++) tick(dt, noDraw || i < n - 1); return Game.fightTime; },
};

// ---------------------------------------------------------------- debug panel (?debug=1, backtick)
const Debug = {
  el: null, on: false, t: 0, pre: null,
  init() {
    this.el = $('debug');
    if (!Game.debug) return;
    this.el.innerHTML = '<div><b>DEBUG</b></div>' +
      '<button data-d="god">GOD</button><button data-d="p1">PHASE II</button><button data-d="p2">PHASE III</button><button data-d="kill">KILL</button>' +
      '<button data-d="flux">FLUX+50</button><button data-d="hg">HOURGLASS</button><button data-d="frac">5 FRAC</button><button data-d="train">TRAINING</button>' +
      '<div>Boss HP <input type="range" min="0" max="1" step="0.01" value="1" data-d="hp"></div>' +
      '<div id="dbg-ab"></div><pre></pre>';
    this.pre = this.el.querySelector('pre');
    const abs = ['cleave', 'hail', 'line', 'toll', 'sanctum', 'chime', 'quarters', 'pulse', 'tremor', 'severance', 'gaze', 'adds'];
    const ab = this.el.querySelector('#dbg-ab');
    for (const a of abs) { const b = document.createElement('button'); b.textContent = a; b.dataset.ab = a; ab.appendChild(b); }
    this.el.addEventListener('click', (e) => {
      const d = e.target.dataset && e.target.dataset.d, a = e.target.dataset && e.target.dataset.ab;
      const b = Game.boss, p = Game.player;
      if (a) __raid.forceAbility(a);
      if (d === 'god') { Game.god = !Game.god; e.target.textContent = Game.god ? 'GOD ✓' : 'GOD'; }
      if (d === 'p1' && b) __raid.setBossHp((b.phaseThresholds[0] || 0.6) - 0.005);
      if (d === 'p2' && b) __raid.setBossHp((b.phaseThresholds[1] || 0.25) - 0.005);
      if (d === 'kill' && b) dealDamage(b, b.hp + 10, { kind: 'grand', source: 'Debug' });
      if (d === 'flux') p.addFlux(50);
      if (d === 'hg') p.addHourglass(100);
      if (d === 'frac') { p.fractures = 5; p.fractureT = 8; }
      if (d === 'train') Game.startFight('training', { skipIntro: true });
    });
    this.el.addEventListener('input', (e) => { if (e.target.dataset.d === 'hp') __raid.setBossHp(parseFloat(e.target.value)); });
    HUD.showFps(true);
  },
  toggle() { if (!Game.debug) return; this.on = !this.on; this.el.classList.toggle('on', this.on); },
  update(dt) {
    if (!this.on || !this.pre) return;
    this.t -= dt; if (this.t > 0) return; this.t = 0.25;
    const b = Game.boss, p = Game.player;
    this.pre.textContent = 'state ' + Game.state + '  t ' + Game.fightTime.toFixed(1) + '\nfps ' + Game.fps + '  ' + Quality.label + ' pr ' + Quality.pr.toFixed(2) +
      '\ntelegraphs ' + Telegraphs.activeCount() + '  hazards ' + Hazards.pool.used + '  proj ' + Projectiles.list.length + '  adds ' + Game.adds.length +
      '\nplayer hp ' + Math.round(p.hp) + ' flux ' + p.flux.toFixed(0) + ' hg ' + p.hourglass.toFixed(0) + ' fr ' + p.fractures +
      (b ? '\nboss ' + (b.hp / b.maxHp * 100).toFixed(1) + '% phase ' + b.phase + (b.cast ? ' cast ' + b.cast.name : '') + (b.lastAbility ? ' last ' + b.lastAbility : '') : '') +
      '\ncalls ' + renderer.info.render.calls + ' tris ' + renderer.info.render.triangles;
  },
};

// ---------------------------------------------------------------- prewarm (compile every pooled material once behind the loader)
function prewarm() {
  const flip = [];
  const show = (o) => { if (o && !o.visible) { o.visible = true; flip.push(o); } };
  show(Telegraphs.list[0].mesh); show(Hazards.list[0].mesh);
  for (const p of Projectiles.pool.items.slice(0, 1)) { show(p.grp); for (const k of PROJ_KINDS) show(p.vis[k]); }
  show(Adds.pool[0].group);
  show(SlashFX.pool.items[0].mesh); show(Beams.pool.items[0].grp); show(GroundFX.pool.items[0].mesh);
  const pl = Game.player; show(pl.echoModel.root); show(pl.echoRing); show(pl.markRing); show(pl.ghosts[0].model.root);
  try { Post.compileScene(); } catch (e) { console.warn('prewarm', e); }
  for (const o of flip) o.visible = false;
  // reset projectile child visibility to a sane default (spawn() sets it anyway)
}

// ---------------------------------------------------------------- boot
function boot() {
  Input.init();
  Quality.init();
  Post.init();
  applyResize();
  PointLights.init();
  Particles.init();
  initDebris();
  GroundFX.init(); SlashFX.init(); Beams.init();
  Projectiles.init(); Adds.init(); DmgNumbers.init();
  Telegraphs.init(); Hazards.init();
  HUD.init(); initMenus(); Debug.init();
  Game.player = new Player();
  Game.toTitle();
  prewarm();
  $('loader').classList.add('hidden');
  window.__raidBooted = true;
  const qb = URLP.get('boss');
  if (qb != null) {
    $('title').classList.add('hidden');
    Game.startFight(qb === 'training' ? 'training' : (parseInt(qb, 10) | 0), { skipIntro: true, instant: true });
  }
  // portrait hint (once)
  if (View.touch && View.portrait && !Save.seenHint('rotate')) { const r = $('rotatehint'); r.classList.add('on'); r.addEventListener('pointerdown', () => r.classList.remove('on')); setTimeout(() => r.classList.remove('on'), 5000); }
  __raid.ready = true;
  requestAnimationFrame(frame);
}

try { boot(); }
catch (e) { console.error(e); showFatal((e && e.message) || String(e)); }
