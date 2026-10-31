// =============================================================================
//  §18a  Game flow — state machine (loading → title → intro → fight ⇄ paused →
//        transition → victory | defeat), fight setup/teardown, countdown,
//        death & victory cards, pause / settings / how-to overlays, title backdrop.
//        (The Raid Map + talent picker are provided by a later UI module through
//        Game.showMap / Game.showTalentPick when present.)
// =============================================================================

Object.assign(Game, {
  setState(s) {
    this.prevState = this.state; this.state = s;
    document.body.dataset.state = s;
  },

  /** reset every pooled system (no allocation) */
  resetWorld() {
    TimeFX.clear(); Timers.clear();
    Telegraphs.reset(); Hazards.reset(); RingCue.reset(); Projectiles.reset(); Adds.reset();
    Particles.clear(); Shards.clear(); Rubble.clear(); GroundFX.clear(); SlashFX.clear(); Beams.clear(); DmgNumbers.clear(); PointLights.reset();
    Post.setDesatHold(0); Post.desatPulseT = 0; Post.whiteout = 0; Post.lensStr = 0; Post.zoomBlur = 0; Post.sepia = 0; Post.tunnel = 0; Post.haze = 0; Post.hurt = 0;
    GLOBAL_U.uStreak.value = 0;
    CamRig.trauma = 0; CamRig.fovKick = 0;
    if (CamRig.rail) { CamRig.rail.onDone = null; CamRig.rail.events = null; CamRig.finishRail(true); }
    Letterbox.set(false);
    Hint.hide();
    this.baseScale = 1; this.inputLocked = false; this.cinematic = false; this.forceWide = 0;
    this.dying = false;                                        // a Retry / Raid Map during the death beat drops its timer (Timers.clear) — never leave the flag stuck
    Post.expDur = 0; Post.expT = 0;                            // a running exposure tween (rail events, Auren's dawn) must not carry into the next fight
    Post.bloomKick = 0; Post.caKick = 0; Post.desatCur = 0;
  },

  /** destroy the current arena + boss */
  teardown() {
    this.resetWorld();
    Quality.applyPending();                                    // a shadow flip deferred during the last fight recompiles here, not mid-fight
    if (this.boss && this.boss.dispose) { try { this.boss.dispose(); } catch (e) { console.error(e); } }
    if (this.arena && this.arena.dispose) { try { this.arena.dispose(); } catch (e) { console.error(e); } }
    if (this.encounter && this.encounter.dispose) { try { this.encounter.dispose(); } catch (e) { console.error(e); } }
    if (this.titleArena && this.titleArena !== this.arena) { try { this.titleArena.dispose(); } catch (e) { console.error(e); } }
    this.boss = null; this.arena = null; this.encounter = null; this.titleArena = null;
    CamRig.override = null;
  },

  /**
   * Start a fight. key: 0|1|2 (boss index) or 'training'.
   * opts: {difficulty, skipIntro (default false), instant (skip the 3-2-1 too; used by __raid), seed}
   */
  startFight(key, opts) {
    opts = opts || {};
    let enc = ENCOUNTERS[key];
    if (!enc) { if (key !== 'training') console.warn('encounter ' + key + ' not available yet — using Training Grounds'); enc = ENCOUNTERS.training; key = 'training'; }
    hideOverlays();
    this.teardown();
    this.paused = false;
    if (opts.difficulty && CONFIG.difficulty[opts.difficulty]) { this.difficulty = opts.difficulty; }
    this.diff = CONFIG.difficulty[this.difficulty];
    this.seedExplicit = opts.seed != null || URLP.has('seed');   // seeded test mode → scheduler jitter 0
    if (opts.seed != null) this.seed = opts.seed | 0;
    else if (!URLP.has('seed')) this.seed = (Math.random() * 2 ** 31) | 0;
    this.rng = mulberry32(this.seed);
    resetStats();
    this.events.length = 0;
    this.fightTime = 0;
    this.talents = Save.data.talents.slice();
    const ctx = { difficulty: this.difficulty, diff: this.diff, seed: this.seed, key, startPhase: opts.startPhase | 0 };
    const built = enc.setup(ctx);
    this.arena = built.arena; this.boss = built.boss; this.encounter = enc; this.encounterKey = key;
    renderer.toneMappingExposure = this.arena.exposure || 1;
    Post.setBloomBase(this.arena.bloom != null ? this.arena.bloom : CONFIG.post.bloom.strength);
    Post.setGrade(this.arena.grade || {}, 0);
    const sp = this.arena.spawn || { x: 0, z: 8 };
    this.player.reset(sp.x, sp.z);
    this.player.root.visible = true; this.player.blob.visible = true;
    CamRig.override = null;
    CamRig.zoomTarget = CONFIG.camera.zooms[Input.zoomIdx]; CamRig.zoom = CamRig.zoomTarget;
    CamRig.snap();
    HUD.bindBoss(this.boss);
    this.prewarmFight();
    Audio.music.play(enc.music || 'training');
    Audio.music.setPhase(0);
    if (!opts.skipIntro && enc.intro) {
      this.setState('intro'); this.inputLocked = true; HUD.show(false);
      const rail = enc.intro(ctx);
      if (rail) {
        const done = rail.onDone;
        rail.onDone = (skipped) => { if (done) done(skipped); HUD.show(true); this.beginCountdown(false); };
        CamRig.playRail(rail);
      } else { HUD.show(true); this.beginCountdown(false); }
    } else {
      HUD.show(true);
      this.beginCountdown(!!opts.instant);
    }
    if (enc.onStart) enc.onStart(ctx);
  },

  /** compile every material of the new arena + boss now (hidden lava pools, towers, beams, ghosts, shields, anchor
   *  templates…), behind the intro / countdown, instead of on first use in the middle of a dodge window.
   *  renderer.compile walks invisible meshes too; lights are taken from the visible scene, as at render time. */
  prewarmFight() {
    if (this.boss && this.boss.prewarm) { try { this.boss.prewarm(); } catch (e) { console.warn('prewarm', e); } }
    try { Post.compileScene(); } catch (e) { console.warn('prewarm', e); }
  },

  /** "3, 2, 1, FIGHT" over 1.5 s (or instantly) */
  beginCountdown(instant) {
    if (instant) { this.setState('fight'); this.inputLocked = false; HUD.showJoyGhost(); return; }
    this.setState('intro'); this.inputLocked = true;
    const el = $('countdown');
    const step = (txt, cls) => { el.textContent = txt; el.className = cls || ''; restartAnim(el); sfx(cls ? 'fight' : 'countdown'); };
    step('3');
    Timers.after(0.375, () => step('2'), { real: true, tag: 'cd' });
    Timers.after(0.75, () => step('1'), { real: true, tag: 'cd' });
    Timers.after(1.125, () => { step('FIGHT', 'fight'); this.setState('fight'); this.inputLocked = false; HUD.showJoyGhost(); }, { real: true, tag: 'cd' });
  },

  /** pausing is allowed in live gameplay only — not during the 1.5 s death beat or Auren's credits roll */
  canPause() {
    const st = this.state;
    if (st !== 'fight' && st !== 'transition' && st !== 'intro') return false;
    if (this.dying) return false;
    if (this.boss && this.boss.creditsOn) return false;
    return true;
  },
  togglePause(force) {
    const st = this.state;
    if (force === true && st === 'paused') return;
    if (st === 'paused' || force === false) {
      $('pause').classList.add('hidden'); $('settings').classList.add('hidden');
      if (st !== 'paused') { this.paused = false; Audio.resume(); return; }   // recover a stray paused flag (state moved on under the menu)
      this.paused = false; this.setState(this.pausedFrom || 'fight');
      Audio.resume();
      return;
    }
    if (!this.canPause()) return;
    this.pausedFrom = st; this.paused = true; this.setState('paused');
    $('p-quality').textContent = 'QUALITY: ' + Quality.label;
    $('pause').classList.remove('hidden');
    Input.releaseJoy();
  },

  retry() {
    hideOverlays();
    this.startFight(this.encounterKey != null ? this.encounterKey : 'training', { skipIntro: true });
  },

  // ---------------------------------------------------------------- death (§11.4)
  onPlayerDeath(source) {
    if (this.state === 'defeat' || this.state === 'victory' || this.dying) return;
    if (this.boss && this.boss.dying) return;                  // the boss fell first: its death beat owns the outcome (one result card only)
    this.dying = true;
    this.baseScale = 0.1; this.inputLocked = true;
    Post.setDesatHold(1);
    Telegraphs.clearAll();
    const p = this.player;
    CamRig.playRail(CamRig.orbitRail(_v1.set(p.pos.x, 0.8, p.pos.z), 50, 1.4, { radius: 7, height: 4, lookUp: 0.5, letterbox: false, skippable: false }));
    Timers.after(1.5, () => {
      this.dying = false;
      this.setState('defeat');
      this.baseScale = 1;
      const b = this.boss;
      const stats = $('death-stats');
      stats.innerHTML = '';
      const row = (k, v) => { const a = document.createElement('span'); a.textContent = k; const bb = document.createElement('b'); bb.textContent = v; stats.appendChild(a); stats.appendChild(bb); };
      if (b) { row('Boss HP remaining', (b.hp / b.maxHp * 100).toFixed(1) + '%'); row('Phase reached', ['I', 'II', 'III', 'IV'][b.phase] || String(b.phase + 1)); }
      row('Time survived', fmtTime(this.fightTime));
      $('death-src').textContent = source || 'Unknown';
      $('death-hint').textContent = HINTS[source] || 'Watch the floor: red means get out, gold means stand in.';
      $('d-retry-phase').classList.toggle('hidden', !(this.difficulty === 'story' && b && b.phase > 0 && b.retryFromPhase));
      $('death').classList.remove('hidden');
      HUD.show(false); Hint.hide();   // a pending tutorial hint would sit on top of the card
    }, { real: true });
  },

  // ---------------------------------------------------------------- victory (§11.5)
  onBossDefeated(boss) {
    if (this.state === 'victory') return;
    if (this.dying || this.state === 'defeat') return;        // the player fell first: no victory over the death card (if the boss fell first, onPlayerDeath stood down)
    this.setState('victory'); this.inputLocked = true; this.baseScale = 1;
    Audio.music.stop(2); sfx('victory');
    const t = this.fightTime, S = this.stats;
    const idx = boss && boss.index >= 0 ? boss.index : -1;
    const exp = idx >= 0 ? CONFIG.bosses[idx].expected : { expert: 90, average: 180 };
    let score = 100 - 25 * Math.max(0, (t - exp.expert) / Math.max(1, exp.average - exp.expert));
    score -= 3 * S.mechanicsFailed + 2 * Math.max(0, S.hitsTaken - 20) * 0.25;
    score = clamp(score, 0, 100);
    const rank = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : 'C';
    this.lastResult = { time: t, rank, score, index: idx };
    if (idx >= 0) Save.markCleared(idx, this.difficulty, t, rank);
    const stats = $('vic-stats'); stats.innerHTML = '';
    const row = (k, v) => { const a = document.createElement('span'); a.textContent = k; const bb = document.createElement('b'); bb.textContent = v; stats.appendChild(a); stats.appendChild(bb); };
    row('Time', fmtTime(t));
    row('DPS', Math.round(S.damageDealt / Math.max(1, t)) + '');
    row('Damage taken', Math.round(S.damageTaken) + '');
    row('Perfect Dodges', S.perfectDodges + '');
    row('Interrupts', S.interrupts + ' / ' + S.interruptChances);
    row('Grand Shatters', S.grandShatters + '');
    row('Fracture uptime', Math.round(100 * S.fractureUptime / Math.max(1, t)) + '%');
    row('Healing from Shatter', Math.round(S.shatterHealing) + '');
    $('vic-title').textContent = boss ? boss.name + ' FALLS' : 'VICTORY';
    $('vic-rank').textContent = rank;
    Timers.after(0.4, () => { $('victory').classList.remove('hidden'); HUD.show(false); Hint.hide(); }, { real: true });
  },
  victoryContinue() {
    hideOverlays();
    const r = this.lastResult;
    if (r && r.index >= 0 && r.index < 2 && this.showTalentPick) { this.showTalentPick(r.index); return; }
    if (this.showMap) this.showMap(); else this.toTitle();
  },

  // ---------------------------------------------------------------- title
  toTitle(forMap) {
    hideOverlays();
    this.teardown();
    this.setState('title');
    HUD.show(false);
    const T = (typeof TitleScene !== 'undefined') ? TitleScene.build() : buildTrainingArena();
    this.titleArena = T;
    this.arena = T;
    renderer.toneMappingExposure = T.exposure || 1.05; Post.setBloomBase(T.bloom != null ? T.bloom : 1.0); Post.setGrade(T.grade, 0);
    this.player.reset(0, 0);
    if (T.cameraOverride) {
      this.player.root.visible = false; this.player.blob.visible = false;     // the hourglass is the hero of the title shot
      CamRig.override = (dt, cam) => { T.cameraOverride(dt, cam); if (typeof RaidMap !== 'undefined') RaidMap.update(); };
    } else {
      this.player.yaw = 0.5; this.player.prevYaw = 0.5;
      let t = 0;
      CamRig.override = (dt, cam) => {
        t += dt;
        const a = 0.6 + t * 0.06;
        cam.position.set(Math.sin(a) * 7.5, 2.2 + Math.sin(t * 0.2) * 0.4, Math.cos(a) * 7.5);
        _v1.set(0, 1.6, 0); cam.lookAt(_v1);
        if (Math.abs(cam.fov - 46) > 0.01) { cam.fov = 46; cam.updateProjectionMatrix(); }
      };
    }
    Audio.music.play('title');
    syncTitleButtons();
    if (forMap) return;
    $('title').classList.remove('hidden');
  },
});

function hideOverlays() { for (const id of ['title', 'pause', 'death', 'victory', 'settings', 'how', 'map', 'talentpick']) { const e = $(id); if (e) e.classList.add('hidden'); } $('rotatehint').classList.remove('on'); }

function syncTitleButtons() {
  $('btn-diff').textContent = CONFIG.difficulty[Game.difficulty].label;
  $('btn-quality').textContent = 'QUALITY: ' + Quality.mode.toUpperCase();
  $('set-quality').textContent = Quality.mode.toUpperCase();
}

function initMenus() {
  const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); Audio.unlock(); sfx('ui'); fn(); });
  // title: tap to begin → buttons
  $('title').addEventListener('pointerdown', () => {
    if ($('titlebtns').classList.contains('hidden')) {
      Audio.unlock();
      $('tapbegin').classList.add('hidden'); $('titlebtns').classList.remove('hidden');
      sfx('uiConfirm');
      try { if (View.touch && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
    }
  });
  click('btn-play', () => { if (Game.showMap) Game.showMap(); else Game.startFight(ENCOUNTERS[0] ? 0 : 'training', {}); });
  click('btn-training', () => Game.startFight('training', {}));
  click('btn-diff', () => {
    const order = ['story', 'normal', 'heroic'];
    let i = (order.indexOf(Game.difficulty) + 1) % 3;
    if (order[i] === 'heroic' && !Save.heroicUnlocked() && !Game.debug) i = 0;
    Game.difficulty = order[i]; Game.diff = CONFIG.difficulty[Game.difficulty];
    Save.data.difficulty = Game.difficulty; Save.save(); syncTitleButtons();
  });
  click('btn-quality', () => { Quality.cycle(); syncTitleButtons(); });
  click('btn-settings', () => openSettings());
  click('btn-how', () => $('how').classList.remove('hidden'));
  click('how-close', () => $('how').classList.add('hidden'));
  // settings
  const vol = $('set-vol'); vol.value = Save.settings.volume;
  vol.addEventListener('input', () => Audio.setVolume(parseFloat(vol.value)));
  const tog = (id, get, set) => { const el = $(id); const sync = () => { const v = get(); el.textContent = v ? 'ON' : 'OFF'; el.classList.toggle('on', v); }; sync(); el.addEventListener('click', (e) => { e.stopPropagation(); set(!get()); sync(); sfx('ui'); }); };
  tog('set-mute', () => !Audio.muted, (v) => Audio.setMute(!v));
  tog('set-shake', () => Save.settings.shake !== false, (v) => { Save.settings.shake = v; Save.save(); });
  tog('set-nums', () => Save.settings.numbers !== false, (v) => { Save.settings.numbers = v; Save.save(); });
  click('set-quality', () => { Quality.cycle(); syncTitleButtons(); });
  click('set-close', () => $('settings').classList.add('hidden'));
  // pause
  click('p-resume', () => Game.togglePause(false));
  click('p-retry', () => { Game.paused = false; Game.retry(); });
  click('p-settings', () => openSettings());
  click('p-quality', () => { Quality.cycle(); $('p-quality').textContent = 'QUALITY: ' + Quality.label; });
  click('p-map', () => { Game.paused = false; if (Game.showMap) Game.showMap(); else Game.toTitle(); });
  // death / victory
  click('d-retry', () => Game.retry());
  click('d-retry-phase', () => { if (Game.boss && Game.boss.retryFromPhase) Game.boss.retryFromPhase(); else Game.retry(); });
  click('d-map', () => { if (Game.showMap) Game.showMap(); else Game.toTitle(); });
  click('v-continue', () => Game.victoryContinue());
  click('v-retry', () => Game.retry());
  if (typeof initRaidMenus === 'function') initRaidMenus();
  syncTitleButtons();
}
function openSettings() { $('set-vol').value = Save.settings.volume; syncTitleButtons(); $('settings').classList.remove('hidden'); }
