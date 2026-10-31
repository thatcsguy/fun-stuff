# REGICIDE: a roguelike raid (binding spec)

One HTML file (built from these sources) hosting a single-player, desktop-first, Three.js raid game with a run
structure. You are **the Regicide**, a knight-assassin climbing the five courts of the Hollow Crown. Each court is a
raid boss with three escalating phases (the King has four). Between courts you draft one of three **Edicts** (build
choices). Dying returns you to the start of the current court with your Edicts intact; a run with no deaths is
**Flawless**. Everything is readable: every damaging thing has a telegraph that fills up to the moment it hits.

Design goals (from Patrick's playtests of raid/, prismfall/, kart-raid/, perihelion/):
- raid-boss fights with escalating phases and maximum spectacle, each phase visibly louder than the last;
- a class kit with real tradeoffs (the shield that can be *spent* for damage), an interrupt skill that is useful
  even when nothing is castable, and **no opaque resource system**: cooldowns, charges and one ult bar that fills
  from damage dealt, all shown on the HUD;
- telegraphs you can learn: consistent shape language, fill-from-inside timing, strong outlines; nothing hits
  without a visible warning; lethal things have long warnings and a gold "must move" look;
- keyboard first (WASD + hotkeys, mouse optional for buttons), with a serviceable touch fallback.

---------------------------------------------------------------------------------------------------------------
## 1. Files and build

`regicide/src/*.js|html` are concatenated by `build.sh` into `regicide/index.html` (one `<script type="module">`,
Three.js 0.170.0 from jsDelivr via importmap, exactly like `perihelion/`). Never edit `index.html` by hand.

| file | contents | owner |
|---|---|---|
| `00_head.html` | doctype, meta, base CSS, importmap, canvas, loading veil | lead |
| `00_ui.html` | HUD, menus, run screens, touch controls markup + CSS | lead |
| `01_core.js` | `G` namespace, params, math, seeded rand, events, renderer + post chain, watchdog, quality, camera rig, loop. Forked from perihelion (same API) | lead |
| `02_input.js` | keyboard/mouse/gamepad -> move vector + semantic actions; touch joystick/buttons call in | lead |
| `03_audio.js` | synthesised music (menu + 5 boss motifs, intensity 0-3) and SFX | audio agent |
| `04_fx.js` | particles, lances, shockwaves, numbers, trails (perihelion's, kept) | lead |
| `05_world.js` | sky presets + the court arena (floor disc, rim, props), per-boss skins | world agent |
| `06_combat.js` | hazards (2D shapes), telegraph shader, adds, damage, boss framework, fight flow | lead |
| `07_player.js` | the Regicide: model, movement, skills, mods (edicts), stats | lead |
| `08_ui.js` | screens, HUD binding, settings, touch controls, fullscreen | lead |
| `09_run.js` | run state machine, edict pool + draft screen data, persistence, best times | lead |
| `10_boss1.js` .. `14_boss5.js` | the five courts | boss agents |
| `15_bot.js` | `window.__game` hooks + autopilot | lead |
| `99_tail.js` | boot order | lead |

Boot order: core, input, audio, fx, world, combat, player, run, ui, bot. Each module exposes `G.<name>.init()` and
optionally `update(dt)`; the loop order is input, combat, player, fx, world, ui, bot (same as perihelion).

---------------------------------------------------------------------------------------------------------------
## 2. World, coordinates, camera

- The arena is a disc of radius `G.ARENA_R = 13` on the plane y = 0, centre at the origin, y up. The playable
  area is `r <= ARENA_R - 0.4`; the player is clamped to it. Bosses can shrink it (`G.world.setArenaR(r, dur)`),
  which the player clamp and the bot respect.
- `G.polar(r, theta, y)` = `(r cos theta, y, -r sin theta)`; `G.thetaOf(v)`. Theta is counter-clockwise on screen.
- The camera is the perihelion rig: pitched 56 degrees, on +z, auto-fitted so the whole disc (radius 14 incl. rim)
  is in view with HUD margins. The player starts at `(0, 0, 8)` (bottom of the screen), the boss at the origin,
  facing the player. Never move `G.camera` outside `G.cam.cinematic`.
- `G.layers`: `sky`, `play` > `arena`, `boss`, `player`, `fx`, `ui3d`. Hazard telegraphs draw into `fx` at y 0.02-0.08.
- Randomness: gameplay uses `G.rand` / `b.rand` (seeded by `?seed`); visuals may use `Math.random`.

Sky presets (`G.world.setSky(preset, level 0-3, sec)`): `menu`, `night`, `aurora`, `collapse` (perihelion's) plus
new `ember` (red-orange firestorm, embers rising, level 3 = burning sky), `glass` (pale ice-white, prismatic
shards, refracted light bars, level 3 = shattering), `storm` (violet thunderheads, lightning, level 3 = eye of the
storm). Arena skins (`G.world.setArena(skin)`): `ash` (blackened flagstones, ember cracks), `glass` (mirror floor
with reflections hints and glass pillars at the rim), `tide` (dark water at the rim, wet stone), `storm` (basalt
with lightning rods at the rim), `throne` (gold-inlaid obsidian with a throne silhouette behind the boss). Each
skin also sets the rim look. `G.world.setArena('none')` leaves a plain disc.

---------------------------------------------------------------------------------------------------------------
## 3. The Regicide (player)

| stat | value |
|---|---|
| max HP | 100 (edicts modify) |
| move speed | 7.5 u/s, instant acceleration (tiny 60 ms smoothing for feel) |
| radius | 0.45 (hit tests use the centre plus `pad`; hazards count the player inside up to 0.15 past their edge) |
| hit i-frames | 0.5 s after taking damage (prevents double hits, not a dodge) |

Desktop controls: `WASD` / arrows move (screen-relative: W = up the screen). Hotkeys below, each also a HUD
button clickable with the mouse. Holding LMB also attacks (Rend is automatic anyway). `Esc`/`P` pause.
Touch: left-half virtual joystick, right-side buttons: DASH, BULWARK (hold), REBUKE, MEND, VERDICT.

### Skills

| key | skill | numbers | notes |
|---|---|---|---|
| auto | **Rend** | every 0.42 s when a target is within 7 u (boss surface counts): 10 dmg; every 3rd hit is **Cleave** 24 dmg | auto-targets the boss, or the nearest add within 4 u if one is closer than the boss. A blade-whip visual toward the target. |
| `Space` / `Shift` | **Dash** | 4.6 u over 0.22 s, i-frames 0.32 s, 2 charges, 5 s each | direction = movement input, else away from the boss. Passes through the boss and adds. Also crosses `unblockable` hazards safely while i-framed. |
| `Q` (hold) | **Bulwark** / **Riposte** | shield up to 2.5 s, absorbs all blockable damage; on release fires Riposte: `20 + absorbed x mult` to the boss anywhere; mult 3.0 if released within 0.6 s of the last absorbed hit, decaying linearly to 1.0 at 2.5 s hold; cooldown 14 s from release | **The tradeoff:** holding is safe for a whole mechanic; releasing right after a hit converts it into a burst but drops the shield. HUD chip shows `RIPOSTE x2.8`. A tap (< 0.15 s) still raises it for 0.5 s. Gold `unblockable` hazards go through it. |
| `E` | **Rebuke** | 9 s cd; 120 degree cone, range 8, toward the target | (1) interrupts an interruptible cast: boss **Exposed** 6 s (+30% damage taken) and stunned 2.5 s; (2) destroys every boss projectile/orb in the cone; (3) adds in the cone are staggered 3 s (x3 damage) and knocked back 2 u. Always useful. |
| `F` / `1` | **Mend** | heals 35 over 2 s, 2 charges, 24 s each; cleanses burning/poison DOTs | |
| `R` | **Verdict** | ult bar fills with damage dealt (400 dmg = full, shown as %); 0.9 s leap + impale: 160 dmg, destroys all projectiles, player invulnerable for the animation, `G.cam.slowMo(0.35, 0.5)` + hit stop | usable as burst or as a panic button |

Damage dealt is multiplied by `mods.dmgMul`, Exposed (x1.3) and Staggered adds (x3). Boss `b.damage(amount, info)`.
Healing/absorb/charges all go through `G.player.mods` (section 7).

Player state (`G.player.state`): `hp, maxHp, pos (Vector3), vel, facing, alive, dashing, iframes, invuln, shield
{up, absorbed, lastHitAt, t}, cds {dash:[...], mend:[...], rebuke, bulwark}, ult (0-1), burning, slowMul`.
`G.player.damage(amount, label, {unblockable, dot})` -> `{applied, blocked, absorbed}`. During i-frames, invuln,
cinematics or practice it reports but does not reduce HP. `G.player.heal(n)`, `G.player.knockback(dir, dist)`,
`G.player.setSpeedMul(m, dur)`, `G.player.pull(center, strength, dur)`.

---------------------------------------------------------------------------------------------------------------
## 4. Telegraph grammar (binding for every boss)

| look | meaning | player answer |
|---|---|---|
| **accent-coloured shape, fill grows from the inside until full at impact, bright outline** | ordinary damage (15-25) or heavy (35-50), blockable | move out, or Bulwark it |
| **gold, hatched, pulsing outline** (`lethal` or `unblockable`) | 60-100 damage or unblockable | must move (Dash i-frames also work). Warn >= 2.5 s |
| **blue disc with a soft inner glow** (`safe`) | safe zone; everything outside takes damage when the timer ends | get in |
| **green star marker** (`soak`) | stand on it before it expires | touch it |
| **purple cast bar + purple ring around the boss** (`interruptible`) | Rebuke to interrupt | Rebuke |
| **accent cast bar** (not interruptible) | a big thing is coming; look at the floor | |
| **orbs / bolts with a trail** | projectile; Rebuke clears them | sidestep or Rebuke |
| **arrows along a line/ring** | the hazard travels that way | |

Rules: ordinary 15-25, heavy 35-50, lethal 70-100 (warn >= 2.5 s, clear answer). Raid-wide (unavoidable) damage
is <= 15 per instance and only from a completed cast. Never two lethal things at once in phase 1 of court 1.
Every hazard has a `label` (shown on death: "Killed by Hearth Slam"). Nothing damages without a telegraph except
add contact (adds are visible) and orbs (their motion is the telegraph).

---------------------------------------------------------------------------------------------------------------
## 5. Hazards (`G.hz`, also `b.hz`)

Common options: `warn` (telegraph seconds), `active` (live seconds, default 0.25), `dmg`, `label`, `color`
(default accent), `lethal` (gold hatched look + deeper tone), `unblockable` (gold look; Bulwark does not stop it;
Dash i-frames do), `tick` (repeat damage every n s while inside and live), `liveStyle`. Positions are play-local
`x, z` numbers (or `pos` Vector3). Angles in radians, theta convention of `G.polar`.

| call | shape | extra options |
|---|---|---|
| `circle({x, z, r})` | disc | `follow: 'player'` keeps the centre on the player until `lockAt` seconds before impact |
| `ring({x, z, r0, r1})` | annulus | `gaps: [{theta, width}]` safe arcs, drawn in blue |
| `cone({x, z, theta, width, r})` | wedge from a point | `omega` rotates (rad/s) for `dur` seconds with `tick`; `r0` for a hollow start |
| `line({ax, az, bx, bz, width})` | rectangle between two points | `arrow: true` draws travel direction; `sweep: {to: [bx,bz], dur}` moves the line |
| `wave({x, z, r0, r1, speed, thickness})` | expanding (or collapsing, `r1 < r0`) ring | `gaps` like ring; `crossTime(r)` |
| `safe({x, z, r, dmg})` | blue disc; at the end, outside = `dmg` | `follow: 'boss'` |
| `soak({x, z, r, warn, failDmg, onSoak, onFail})` | green star | |
| `orb({x, z, vx, vz | dir, speed, r, life, dmg})` | projectile | `homing` (0-1 turn rate), `onHit`, `onPop`, `bounce` off the rim; `pop()`; rebukable |
| `custom({test(px, pz, lt, pad), draw(group, h), onFire})` | escape hatch | telegraph materials in `group` get the standard fill |
| `wipe(dmg, label)` | raid damage now | goes through `G.player.damage` |

Handle: `{id, kind, cancel(), done (Promise 'done'|'cancelled'), then, fireAt, endAt, hazard}`. Awaiting a handle
inside a phase script rejects with `Abort` when the phase ended first (so follow-ups never leak).
Queries: `G.hz.dangerAt(x, z, tAhead, pad = 0.3)` -> 0/1, `G.hz.damageAt`, `G.hz.safeAt(x, z)` (inside a safe
disc), `G.hz.list()`, `G.hz.clear(filter?)`, `G.hz.clearProjectiles(filter?)`.

The telegraph shader: one `ShaderMaterial` per hazard mesh (flat geometry at y 0.03): outline + inner fill with
progress `uP` (0 warn start -> 1 impact), hatch when lethal/unblockable, live flash. Blue/green variants for safe
and soak. All of it fades out over 0.35 s on cancel.

---------------------------------------------------------------------------------------------------------------
## 6. Boss framework (`G.combat`)

```js
G.bosses[0] = {
  name: 'VARRAK', title: 'the Hearth Knight', court: 'Court of Ash', accent: '#ff7a2a', sky: 'ember', arena: 'ash',
  music: 0, maxHp: 11000, hitRadius: 1.6, hitHeight: 2.2, parTime: 210,
  phases: [{ name: 'Kindling', hpStart: 1.0, enter(b) {}, update(b, dt) {}, async script(b) {}, sky?: ['ember', 1] }, ...],
  build(b) { b.model = group; }, animate(b, dt) {}, onTransition(b, from, to) -> Promise, onDeath(b) -> Promise, teardown(b) {},
  intro: ['The hearth remembers every traitor.', 'Burn with it.'],     // two lines shown on the court card
};
```

Runtime `b`: `hp, maxHp, phase, alive, phaseT, clock, pos (Vector3, y 0), facing, turnRate (default 2.4 rad/s),
trackPlayer, facingTarget, root, model, data, casting, staggerT, exposedT, invulnerable, speed`.
Helpers: `b.wait(s)`, `b.until(pred)`, `b.loop(fn)`, `b.cast({name, dur, interruptible, onDone, onInterrupt,
telegraph})`, `b.moveTo(x, z, speed?)` (returns a promise; the boss walks), `b.teleport(x, z)`, `b.faceTo(theta)`,
`b.playerPos()` (Vector3 copy), `b.playerAhead(sec)` (predicted position, clamped to the arena), `b.playerTheta()`,
`b.playerDist()`, `b.dirToPlayer()` (theta), `b.say(text, dur)`, `b.stagger(dur)`, `b.hitPoint()`, `b.damage(n, info)`,
`b.pick, b.rand, b.randRange, b.randInt`, `b.adds`, `b.hz`.
Transition and death order, `Abort`, scripts, casts: exactly as perihelion's BOSS_AUTHORING sections 3-5 (casts
emit `castStart`/`castEnd`, interruptible casts are stopped by Rebuke, handles returned from `telegraph` are
cancelled on interrupt). Phase transitions clear hazards and adds, pause the fight clock, run `onTransition`
(9 s cap), then `enter` + `script`.

Adds (`G.adds.spawn({x, z, hp, radius, contactDmg, label, color, model(group, add), update(add, dt), onDeath})`):
fields `pos, vel, hp, alive, group, data, staggerT`. Contact: `contactDmg` + 1 s cooldown, the player is pushed
out. Rend/Verdict/Riposte target adds when closer; Rebuke staggers them. `G.adds.kill`, `damage`, `killAll`, `list`.

Fight flow (`G.combat`): `startFight(bossIndex, {fromPhase, skipIntro, practice})`, `retryPhase()` (restart at the
phase reached; counts as a death for the run), `restartFight()`, `quit()`, `wait(s)`, `isAbort(e)`. States:
`boot, menu, intro, fight, cinematic, paused, dead, victory, draft, practice`.
Events: `fightStart, phaseStart, phaseTransition, castStart, castEnd, interrupted, telegraph, playerHit,
playerDeath, bossDefeated, addDied, dash, bulwarkUp, riposte, rebuke, mend, verdict`.

---------------------------------------------------------------------------------------------------------------
## 7. Run structure and Edicts (`G.run`)

- A run is floors 0-4 in order. HP refills at each floor start. After each kill on floors 0-3 the **draft** screen
  shows three Edicts (`state = 'draft'`): pick one. After floor 4: the run ends with results (time, deaths,
  Flawless, Edicts).
- Death: "Retry court" restarts the current floor (phase 1) with Edicts kept, `deaths + 1`. "Retry phase" also
  exists (counts as a death). "Abandon run" clears it.
- Persistence: `rg_run` (floor, edicts, deaths, time, seed), `rg_best` (per-court kill, best run time, flawless
  flag), `rg_unlock` (highest court reached: boss select), `rg_settings`. Boss select fights one court with the
  Edicts of the saved run (or none).
- `G.player.mods` is rebuilt from the Edict list: `{dmgMul, maxHp, dashCharges, dashCd, mendCharges, mendAmt,
  rebukeCd, riposteMul, riposteStun, ultRate, lifesteal, lastRites, dashTrail, thorns, takenMul, speedMul,
  rebukeHeal, cleaveMul, exposeDur, shieldDur}` with neutral defaults.

Edict pool (24; rarity common/rare/epic affects draft weight; each can be taken once):
```
common: Ironheart (+30 max HP) | Whetstone (+15% dmg) | Fleetfoot (+12% move speed) | Second Wind (Mend +1 charge)
        Wraithstep (Dash +1 charge) | Quick Rebuke (Rebuke cd 9 -> 6) | Deep Breath (Mend heals 35 -> 55)
        Long Guard (Bulwark hold 2.5 -> 3.5 s) | Zeal (Verdict charges 40% faster)
rare:   Glass Crown (+40% dmg, -30 max HP) | Hubris (+60% dmg, +40% damage taken) | Bloodlet (Rend heals 1 per hit)
        Thornwall (Riposte also stuns the boss 1.5 s) | Afterimage (Dash leaves a burning trail: 8 dmg/s for 3 s)
        Blade Oath (Cleave x2 damage) | Mirror Guard (a full Bulwark hold fires Riposte at x1.5 instead of x1)
        Penance (Rebuke also heals 15) | Exposure (Exposed lasts 6 -> 10 s)
epic:   Last Rites (once per court: survive a lethal hit at 1 HP, 3 s invulnerable) | Crownbreaker (Verdict dmg x2)
        Executioner (+50% dmg to a boss under 30% HP) | Juggernaut (dashes are 2x longer and break through adds)
        Ashen Vow (heal 20 on every phase transition; +25 max HP) | Regicide's Patience (Bulwark cd 14 -> 7)
```

---------------------------------------------------------------------------------------------------------------
## 8. The five courts

Each court: distinct accent, sky, arena skin, model, motif, 3 phases (King: 4), a 2-line intro, phase names.
Fights are 3-5 minutes with a competent player. Every court has at least one interruptible cast per phase (so
Rebuke matters), at least one projectile pattern (so Rebuke's clear matters) and at least one heavy blockable hit
(so Riposte matters). Court 1 teaches each shape once before combining them. Bot-3 must beat every court, bot-2
most of them. Boss HP: 11k, 14k, 17k, 20k, 30k (tune to the time targets).

| # | court | boss | accent | sky / arena | signature |
|---|---|---|---|---|---|
| 1 | Court of Ash | VARRAK, the Hearth Knight | `#ff7a2a` | `ember` / `ash` | slams, cones, a line charge, War Horn (interruptible; summons cinder hounds), P2 falling pillars (circles), P3 blade rotor + ember orbs |
| 2 | Court of Glass | SERAPHINE, the Mirror Choir | `#ff9ad5` (rose glass; pale ice would clash with blue safe zones) | `glass` / `glass` | mirror beams (lines across the arena, rotating), shard orb volleys, Hymn (blue safe discs), P3 the floor shatters (void circles that stay) |
| 3 | Court of Tides | MORVANNA, the Drowned Queen | `#3dffa2` | `aurora` / `tide` | tide lines sweeping across with gaps, whirlpool pulls, the rising tide shrinks the arena per phase, Riptide (gold wave, dash through), drowned adds |
| 4 | Court of Storms | THESSALY, the Ashen Archon | `#b77bff` | `storm` / `storm` | lightning markers that follow you, chain lightning between rod-adds (lines), roaming tempest orb, Tempest cast (interrupt or 15 raid dmg + knockback) |
| 5 | The Throne | THE HOLLOW KING | `#ffd36b` | `collapse` / `throne` | 4 phases: echoes of courts 1-4 one per phase with the King's own slams; P4 the floor breaks into islands (void), black-sun finale with a safe disc and a Verdict-worthy burn |

---------------------------------------------------------------------------------------------------------------
## 9. UI

HUD: boss frame top (name, court, HP bar with phase ticks, cast bar), player frame bottom-left (HP, Verdict bar,
chips: EXPOSED, RIPOSTE x2.8, BURNING), skill bar bottom-centre (icons with cooldown sweeps and charge pips, key
labels), run strip top-left (COURT II, timer, deaths, edict icons), key hints, subtitles. Screens: title (NEW RUN,
CONTINUE, COURT SELECT, PRACTICE, HOW TO PLAY, SETTINGS), court card intro (court, name, title, two lines), draft
(three edict cards), defeat (retry court / retry phase / abandon), victory per court (time, damage taken, grade),
run results, pause, settings. Same visual language as perihelion's UI (serif display font, dark glass panels),
palette gold-on-black with the court accent.

---------------------------------------------------------------------------------------------------------------
## 10. Testing

Playwright + SwiftShader harness (`$HARNESS`), `?debug=1&seed=N&quality=low&mute=1`. `window.__game`:
`startRun(seed?)`, `startFight(court 1-5, {fromPhase, skipIntro, edicts: [...ids]})`, `setPhase(n)`, `godMode`,
`killBoss`, `setHp`, `fillUlt`, `setEdicts(ids)`, `fastForward(sec, dt)` (async; returns `state()`), `state()`,
`stats()`, `hazards()`, `errors()`, `bot(level 0-3)`, `dangerAt(x, z, t)`, `draftPick(i)`.
Every run must end with `G.log.count === 0`. Render only for screenshots (320x180 for sims; 1280x720, Pixel 7
portrait/landscape for shots, `G.post.ae.snap = true` first). 4 CPUs: at most 2 Chromium instances at once.
iOS: no MSAA, no half-float targets at safe >= 2, watchdog steps the safe level up (`rg_gfx_safe`).
