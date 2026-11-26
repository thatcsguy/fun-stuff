// Game flow: menu scene, fight lifecycle (build, intro, fight, death/victory), pause, per-frame entity updates.
const Game = (() => {
  let curDef = null, menuGroup = null, tries = 0, menuDoors = [], menuNm = 0;

  function clearWorld() {
    Co.clear(); Hz.clear(); Bul.clear(); FX.clear(); Music.stop(0.8); Cam.cine = null; Cam.cineW = 0; G.timeScale = 1;
    if (G.world) { scene.remove(G.world); disposeTree(G.world); G.world = null; }
    if (G.player) { scene.remove(G.player.group); scene.remove(G.player.ring); disposeTree(G.player.group); G.player = null; }
    if (menuGroup) { scene.remove(menuGroup); disposeTree(menuGroup); menuGroup = null; } menuDoors = [];
    G.boss = null; G.arena = null; G.ents.length = 0; scene.fog = null; scene.environment = null; Input.bot = null;
  }

  // ---- menu backdrop: a hall of doors ----
  function buildMenuScene() {
    const g = menuGroup = new THREE.Group(); scene.add(g);
    const sky = W.sky({ top: 0x02030a, horizon: 0x0b1024, bottom: 0x010103, stars: 1.2, nebula: 0.5, nebulaA: 0x3a1a6a, nebulaB: 0x0a3a6a, sunGlow: 0, sunSize: 0 }); g.add(sky);
    W.env(sky, 0.6);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(120, 64), W.mat({ color: 0x06070c, roughness: 0.12, metalness: 0.9 })); floor.rotation.x = -PI / 2; g.add(floor);
    G.bosses.forEach((d, i) => {
      const n = G.bosses.length, a = (i - (n - 1) / 2) * Math.min(0.36, Math.max(0.2, 2.2 / n)), x = Math.sin(a) * 26, z = -Math.cos(a) * 26;
      const col = new THREE.Color(d.color || '#e8c77a');
      const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 9.6, 0.5), W.mat({ color: 0x0c0d14, roughness: 0.35, metalness: 0.8 })); frame.position.set(x, 4.8, z); frame.lookAt(0, 4.8, 0); g.add(frame);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 8.6), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.5) })); pane.position.set(x * 0.985, 4.7, z * 0.985); pane.lookAt(0, 4.7, 0); g.add(pane);
      const L = new THREE.PointLight(col, 60, 30, 1.6); L.position.set(x * 0.9, 4, z * 0.9); g.add(L);
      menuDoors.push({ pane, L, col, avail: nmAvailable(d) });
    });
    g.add(W.motes({ n: 500, box: [70, 20, 70], color: 0xbfd0ff, size: 0.09, vel: [0, 0.25, 0], sway: 0.6, center: [0, 10, -10] }));
    scene.fog = new THREE.FogExp2(0x04050b, 0.012);
    Post.set({ bloom: 0.9, threshold: 0.7, vig: 1.1 });
    menuNm = -1; menuDiff(Settings.diff === 'nightmare', true);
    Co.start(function* () { const c = { pos: new V3(), look: new V3(0, 4.5, -26), fov: 46 }; Cam.cine = c; Cam.cineW = 1; while (G.state === 'menu') { c.pos.set(Math.sin(G.rt * 0.07) * 5, 3.2 + Math.sin(G.rt * 0.11) * 0.5, 6 + Math.cos(G.rt * 0.05) * 2); yield; } }, 'sys');
  }
  // the hall answers the Difficulty toggle: on Nightmare, doors with no nightmare version go dark (never removed, so no
  // shader recompiles) and the ones that have one burn hotter; the fog darkens and reddens. Tweened, or instant on open.
  const HOT = new THREE.Color(2.4, 0.42, 0.5), HOTL = new THREE.Color(0xff3048), FOGN = new THREE.Color(0x04050b), FOGM = new THREE.Color(0x0c0308), _c = new THREE.Color();
  function menuDiff(on, instant) {
    const to = on ? 1 : 0; if (!menuGroup || menuNm === to) return; const from = menuNm < 0 ? to : menuNm; menuNm = to;
    const apply = (k) => {
      for (const m of menuDoors) {
        if (m.avail) { m.pane.material.color.copy(m.col).multiplyScalar(1.5).lerp(HOT, k); m.L.color.copy(m.col).lerp(HOTL, k); m.L.intensity = lerp(60, 95, k); }
        else { m.pane.material.color.copy(m.col).multiplyScalar(lerp(1.5, 0.09, k)); m.L.color.copy(m.col); m.L.intensity = lerp(60, 4, k); }
      }
      if (scene.fog) { scene.fog.color.copy(FOGN).lerp(FOGM, k); scene.fog.density = lerp(0.012, 0.016, k); }
    };
    Co.stopTag('menudiff');
    if (instant) apply(to); else Co.start(function* () { let t = 0; while (t < 0.6) { t += G.rdt || 0.016; apply(lerp(from, to, smooth(t / 0.6))); yield; } apply(to); }, 'menudiff');
  }
  function toMenu() { clearWorld(); G.nightmare = false; G.state = 'menu'; G.paused = false; UI.hud(false); UI.hideCard(); buildMenuScene(); UI.show('menu'); UI.fade(false); }

  function build(def, opts = {}) {
    const rh = (!G.headless && !opts.noRehearsal) ? rehearse(def, opts) : null;
    buildWorld(def, opts);
    if (!G.headless) Warm.run(rh);
    Hitch.reset();
  }
  // Play the whole fight once, invisibly, before the real one: a throwaway copy of the arena runs every phase headless
  // for a while with the autopilot in god mode, so that everything a phase creates on the fly (adds, props, swapped
  // materials) exists once. Warm.run then draws those objects next to the real arena, which compiles their shaders up
  // front, and keeps their materials alive so the shaders are not thrown away before the real fight needs them.
  // The rehearsal uses its own random stream, so seeded runs play out exactly as they would without it.
  const REHEARSE_SEC = 24, REHEARSE_DT = 1 / 20;
  function rehearse(def, opts) {
    const t0 = performance.now(), rng = G.rng, god = G.god, bot = Bot.level, kept = [];
    G.rng = mulberry(0x5eed); G.god = true; Bot.level = 3; G.headless = true; G.rehearsing = true;
    const known = new Set(); let found = new Map();
    const mats = (o) => o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    const scan = (root) => root.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) for (const m of mats(o)) if (!known.has(m) && !found.has(m)) found.set(m, o); });
    try {
      buildWorld(def, opts);
      scene.traverse((o) => { for (const m of mats(o)) known.add(m); });
      G.keepDisposed = kept; // removed objects are kept whole until the warm-up frame has drawn them
      const b = G.boss, n = def.phases.length;
      G.state = 'fight';
      for (let ph = 0; ph < n && G.state === 'fight'; ph++) {
        G.ft = 0; const floor = () => b.maxHp * (ph + 1 < n ? def.phases[ph + 1].at + 0.005 : 0.02);
        if (ph === 0) b.goPhase(0); else b.hp = b.maxHp * def.phases[ph].at - 1;
        for (let k = Math.round(REHEARSE_SEC / REHEARSE_DT); k > 0 && G.state === 'fight' && b.alive; k--) {
          Bot.update(REHEARSE_DT); G.step(REHEARSE_DT); if (ph > 0 && b.phase < ph) continue; b.hp = Math.max(b.hp, floor());
        }
        scan(scene);
      }
    } catch (e) { console.warn('rehearsal stopped early', e); }
    try { G.keepDisposed = kept; clearWorld(); } catch (e) { console.warn(e); }
    G.keepDisposed = null; G.headless = false; G.rehearsing = false; G.rng = rng; G.god = god; Bot.level = bot; G.ft = 0;
    for (const r of kept) scan(r);
    G.warmStats = { boss: def.id, rehearsalMs: Math.round(performance.now() - t0), newMaterials: found.size };
    return { found, kept };
  }
  function buildWorld(def, opts = {}) {
    clearWorld(); curDef = def; G.state = 'loading'; G.ft = 0; G.paused = false;
    G.world = new THREE.Group(); scene.add(G.world);
    const cls = opts.cls ? G.classes.find((c) => c.id === opts.cls) : UI.selectedClass();
    const b = G.boss = new Boss(def); G.ents.push(b);
    const A = G.arena = def.build(b) || {};
    A.floorY = A.floorY || 0; A.edge = A.edge || 'wall';
    if (!A.contains) A.contains = (x, z) => Math.hypot(x, z) <= (A.radius || 20);
    if (!A.clamp) A.clamp = (p) => { const r = (A.radius || 20) - 0.4, d = Math.hypot(p.x, p.z); if (d > r) { p.x *= r / d; p.z *= r / d; } };
    G.world.add(b.group);
    const bs = A.bossStart || { x: 0, z: 0, face: 0 }; b.pos.set(bs.x, bs.y || 0, bs.z); b.facing = bs.face || 0; b.group.position.copy(b.pos); b.group.rotation.y = b.facing;
    const p = G.player = new Player(cls || G.classes[0]); const sp = A.spawn || { x: 0, z: 12 };
    p.pos.set(sp.x, A.floorY, sp.z); p.facing = sp.face !== undefined ? sp.face : angTo(sp.x, sp.z, b.pos.x, b.pos.z); p.target = b; b.P = p;
    scene.add(p.group); scene.add(p.ring); p.group.position.copy(p.pos); p.group.rotation.y = p.facing;
    Post.set(def.post || {}); Cam.reset(p.facing); if (G.arena.camDist) Cam.tDist = Cam.dist = G.arena.camDist; if (G.arena.camPitch !== undefined) Cam.pitch = G.arena.camPitch; UI.buildHud();
    if (!Save.seen) Save.seen = {}; Save.seen[def.id] = true; saveSave();
  }
  function* runIntro(def, opts) {
    const b = G.boss, p = G.player, A = G.arena;
    G.state = 'intro';
    if (def.music) Music.play(def.music, 0);
    if (!opts.skipIntro) {
      UI.fade(false); yield 0.3;
      UI.titleCard(def.nm ? 'NIGHTMARE' : '', def.name, def.title, def.color);
      if (def.intro) yield* def.intro(b);
      else { const a = angTo(b.pos.x, b.pos.z, p.pos.x, p.pos.z), r = b.radius * 2 + 9, h = b.aimY; yield* Cam.shot([b.pos.x + Math.sin(a + 0.9) * r, h + 2, b.pos.z + Math.cos(a + 0.9) * r], [b.pos.x, h, b.pos.z], [b.pos.x + Math.sin(a - 0.3) * r * 1.2, h + 4, b.pos.z + Math.cos(a - 0.3) * r * 1.2], [b.pos.x, h * 0.8, b.pos.z], 4.2); }
      UI.hideCard(); Cam.release(); yield 0.7;
    } else { UI.fade(false); Cam.release(); Cam.cineW = 0; }
    UI.hud(true); G.state = 'fight'; G.ft = 0; G.testUsed = !!(Settings.godMode || Settings.superDmg); // testing options on: no records
    const start = clamp(opts.phase || 0, 0, def.phases.length - 1);
    if (start > 0) { b.hp = Math.min(b.maxHp, b.maxHp * def.phases[start].at - 1); for (let i = 0; i < start; i++) if (def.phases[i + 1] && def.phases[i + 1].skipTo) def.phases[i + 1].skipTo(b); }
    b.goPhase(start);
  }
  // A door's nightmare version is its def with the `nightmare` block laid over it (prototype chain, so anything not
  // overridden reads through to the normal def). Built once per door and cached.
  function nightmareDef(base) { return base._nmDef || (base._nmDef = Object.assign(Object.create(base), base.nightmare, { base, nm: true })); }
  function nmAvailable(d) { return !!(d && d.nightmare); }
  function start(id, opts = {}) {
    const d0 = typeof id === 'object' ? id : G.bosses.find((d) => d.id === id) || G.bosses[(+id || 1) - 1]; if (!d0) return;
    const base = d0.base || d0, nm = !!(opts.nm === undefined ? QS.has('nm') : opts.nm) && nmAvailable(base), def = nm ? nightmareDef(base) : base;
    G.nightmare = nm;
    tries = (curDef === def) ? tries + 1 : 1;
    UI.show(null); UI.hud(false);
    if (G.headless || opts.instant) { build(def, opts); Co.start(runIntro(def, Object.assign({ skipIntro: true }, opts)), 'sys'); return; }
    UI.fade(true); G.state = 'loading';
    setTimeout(() => { try { build(def, opts); Co.start(runIntro(def, opts), 'sys'); } catch (e) { reportError(e); $('#boot-err').style.display = 'block'; $('#boot-err').textContent += String(e && e.stack || e); UI.fade(false); } }, 750);
  }
  function restart() { if (curDef) start(curDef, lastOpts); }
  let lastOpts = {};
  function quit() { UI.fade(true); UI.show(null); setTimeout(toMenu, 700); }
  function pause(on) {
    if (G.state !== 'fight' && G.state !== 'intro') return;
    G.paused = on === undefined ? !G.paused : on;
    if (G.paused) { if (document.pointerLockElement) document.exitPointerLock(); Input.clear(); UI.show('pause'); } else UI.show(null);
  }
  function onPlayerDead() {
    if (G.state !== 'fight') return; G.state = 'dead'; const b = G.boss, p = G.player; b.logPhase();
    Co.start(function* () {
      G.timeScale = 0.35; Music.stop(2.5); let t = 0; while (t < 1.9) { t += G.rdt || 0.016; yield; }
      $('#death-sub').textContent = p.deathSrc === 'fall' ? 'You fell from the arena' : p.deathSrc === 'enrage' ? 'Out of time' : 'Attempt ' + tries;
      $('#death-stats').innerHTML = `<b>${b.def.name}</b> had <b>${(b.hp / b.maxHp * 100).toFixed(1)}%</b> left after <b>${UI.fmtT(G.ft)}</b>`;
      UI.phaseTable($('#death-phases'), b);
      UI.hud(false); UI.show('death'); if (document.pointerLockElement) document.exitPointerLock();
    }, 'sys');
  }
  function onBossDead() {
    if (G.state !== 'fight') return; G.state = 'win'; const b = G.boss, p = G.player, def = b.def;
    Co.stopTag('phase'); for (const e of G.ents) if (e.isAdd && e.alive) e.die(); Co.stopTag('fight'); Hz.clear(); Bul.clear(); p.invuln = 999;
    const time = G.ft; b.logPhase();
    let prev, best, newSplit = [];
    if (G.testUsed) { /* god mode or super damage: a test run, nothing is recorded */ } else if (def.nm) { // nightmare records live apart from the normal kills: best total, best time per phase on its own, clears
      if (!Save.nm) Save.nm = {}; if (!Save.nm[def.id]) Save.nm[def.id] = {};
      const r0 = Save.nm[def.id][p.cls.id], r = r0 && r0.v === 2 ? r0 : { v: 2, best: 0, splits: [], clears: 0 }; // v 2: no phase clocks (records without it are from the old fights) prev = r.best; best = !prev || time < prev; if (best) r.best = Math.round(time * 10) / 10;
      (b.phaseLog || []).forEach((q, i) => { if (q && (!r.splits[i] || q.time < r.splits[i])) { if (r.splits[i]) newSplit[i] = true; r.splits[i] = q.time; } });
      r.clears++; Save.nm[def.id][p.cls.id] = r; saveSave();
    } else {
      if (!Save.kills) Save.kills = {}; if (!Save.kills[def.id]) Save.kills[def.id] = {};
      prev = Save.kills[def.id][p.cls.id]; best = !prev || time < prev; if (best) Save.kills[def.id][p.cls.id] = Math.round(time * 10) / 10; saveSave();
    }
    Co.start(function* () {
      Music.stop(3); Sound.sfx('kill'); G.timeScale = 0.3; FX.flash(0xffffff, 0.5, 1.2);
      if (def.death) yield* def.death(b);
      else {
        const a = Cam.yaw + 0.6, r = b.radius * 2 + 10; Cam.cine = { pos: new V3(b.pos.x - Math.sin(a) * r, b.aimY + 3, b.pos.z - Math.cos(a) * r), look: new V3(b.pos.x, b.aimY, b.pos.z), fov: 44 };
        for (let i = 0; i < 9; i++) { b.aim(_tv); FX.explode(_tv.x + (vrand() - 0.5) * b.radius * 2, _tv.y + (vrand() - 0.5) * b.aimY, _tv.z + (vrand() - 0.5) * b.radius * 2, def.telegraph || 0xffffff, 4 + i * 0.6, 0xffffff); yield 0.11; }
        b.group.visible = false; b.aim(_tv); FX.explode(_tv.x, _tv.y, _tv.z, 0xffffff, 14, def.telegraph); FX.flash(0xffffff, 0.6, 1); yield 0.5;
      }
      G.timeScale = 1; let t = 0; while (t < 1.6) { t += G.rdt || 0.016; yield; }
      $('#vic-title').textContent = def.name + ' FALLS';
      $('#vic-stats').innerHTML = `<b>${p.cls.name}</b> &nbsp; time <b>${UI.fmtT(time)}</b>${G.testUsed ? ' (test run, not recorded)' : best && prev ? ' (new best)' : ''} &nbsp; attempts <b>${tries}</b> &nbsp; damage taken <b>${Math.round(p.stats.taken)}</b>`;
      UI.phaseTable($('#vic-phases'), b, newSplit);
      UI.hud(false); UI.show('victory'); if (document.pointerLockElement) document.exitPointerLock();
    }, 'sys');
  }

  // One lock for every cinematic in every fight: the intro, the kill, and any shot a boss plays mid-fight (any time Cam.cine is
  // set while the fight runs). While it holds, Player ignores movement and skills, freezes its timers and gauge and takes no
  // hits (07_player.js), Input.onSlot/onAction drop presses, Cam ignores mouse look, and the HUD is hidden. Bosses need do nothing.
  let cineHud = false;
  function cineLock() { return G.state === 'intro' || G.state === 'win' || (G.state === 'fight' && !!Cam.cine); }
  Hooks.step.push((dt) => {
    const p = G.player, b = G.boss; if (!p || !b) { G.cineLock = false; cineHud = false; return; }
    G.cineLock = cineLock();
    if (G.state !== 'fight') cineHud = false; // the intro, the kill and the result screens run the HUD themselves
    else if (G.cineLock !== cineHud) { cineHud = G.cineLock; UI.hud(!cineHud); }
    if (G.state === 'fight' || G.state === 'intro' || G.state === 'dead' || G.state === 'win') {
      p.update(dt);
      for (let i = G.ents.length - 1; i >= 0; i--) { const e = G.ents[i]; if (e.alive || e.isBoss) e.update(dt); else { G.world.remove(e.group); disposeTree(e.group); G.ents.splice(i, 1); } }
      if (G.arena.update) G.arena.update(dt, G.now);
      if (b.def.update) b.def.update(b, dt);
      if (G.state === 'fight' && !b.alive) onBossDead();
    }
  });
  Input.onSlot = (i) => { if (G.state === 'fight' && !G.paused && !G.cineLock && G.player) G.player.press(i); };
  Input.onAction = (name, arg) => {
    const p = G.player;
    if (name === 'pause') { if (UI.screen === 'settings') $('#settings [data-act=back]').click(); else pause(); return; }
    if (G.state !== 'fight' || G.paused || !p || G.cineLock) { if (name === 'jump' && G.state === 'intro') skipIntro = true; return; }
    if (name === 'jump') p.jump(); else if (name === 'target-next') p.cycleTarget(1); else if (name === 'target-prev') p.cycleTarget(-1);
    else if (name === 'click') p.pickTarget(arg.x, arg.y); else if (name === 'camreset') Cam.reset(p.target ? angTo(p.pos.x, p.pos.z, p.target.pos.x, p.target.pos.z) : p.facing);
  };
  let skipIntro = false;
  return { start(id, opts = {}) { lastOpts = opts; start(id, opts); }, nmAvailable, nightmareDef, menuDiff, restart, quit, pause, toMenu, onPlayerDead, onBossDead, get def() { return curDef; }, get tries() { return tries; } };
})();
