# THRESHOLD: sources

A PC-first 3D raid game: unrelated boss fights, one behind each door, four classes, no progression.
`threshold/index.html` is **generated**. Edit the files in this folder and run `./build.sh`; never hand-edit `index.html`.

## Layout

| File | What it holds |
| --- | --- |
| `00_head.html`, `00_ui.html` | CSS, import map (three.js 0.170 from jsDelivr), HUD and menu markup |
| `01_core.js` | `G` namespace, math helpers, seeded RNG, `Settings`, `Save`, coroutines (`Co`), renderer, post-processing (`Post`) |
| `02_input.js` | Keyboard, mouse (MMO camera), gamepad; remappable bindings (`Binds`), controller toggle; `Input.bot` override for the autopilot |
| `03_audio.js` | Synth sound effects (`Sound`) and the layered step-sequencer (`Music`) |
| `04_fx.js` | `FX`: particles, rings, beams, lightning, domes, missiles, damage numbers, shake |
| `05_world.js` | `Cam` (orbit camera + cinematic shots) and `W` (procedural textures, sky, water, lava, lights, motes) |
| `06_combat.js` | `Hz` telegraphed hazards, `Bul` bullets, `Ent` and `Boss` |
| `07_hero.js` | Hero model kit (`HeroKit`: rim-lit materials, parts merged per bone and material, lathe/tube helpers, cloth springs) and the per-class models in `HERO_MODELS` (Stormcaller so far) |
| `07_hexslinger.js` | Hexslinger model: witch-crown cattleman hat, duster on hinged panels, bandolier of salve vials, a revolver whose six chambers show the loaded rounds; two-bone IK arms (fan, load, spin, salve twirl) |
| `07_hero_warden.js` | The Ashwarden's model: ash-iron knight, greatsword held two-handed by IK (sword poses are a grip point and blade direction in chest space), cape and tabard springs, Ember Flasks on the belt. Its own file so class models can be built side by side; the name sorts after `07_hero.js` under any collation |
| `07_model_duskblade.js` | The Duskblade's model on `HeroKit` (registers `HERO_MODELS.duskblade`): helm, kit, half-cape, blade with Momentum runes and a swing trail, keyframed swings (kinds 0-2 Slash, 3 Sunder, 5 Sever, 6 thrust, 7 parry counter) |
| `07_player.js` | Generic procedural hero model (used by classes without their own, and by any `look` with `generic: true`, like Issen in door III), `Player` (movement, casting, GCD, buffs, dashes, damage) |
| `08_classes.js` | The four classes and their autopilot rotations (see "Classes" below) |
| `09_groups.js` | `GROUPS`: which fights the main screen shows under Nightmare / Ready / Almost / Concept (edit it to move a fight; unlisted bosses land in the last group). The toggle buttons above the fights show or hide each group (`Settings.groups`) |
| `09_ui.js`, `10_game.js` | HUD/menus (including the Difficulty toggle and the per-phase results), fight lifecycle (including the hidden rehearsal at load and nightmare versions), the hall-of-doors menu scene |
| `11_warm.js` | Warm-up frame and light keeper that stop shader compiles mid-fight |
| `12_hitch.js` | Freeze log: every late frame during a fight with its cause (Settings > Testing > Freeze log copies it; `?hitch=1` adds first-draw tracking) |
| `2x_boss_*.js`, `3x_boss_*.js` | One file per boss. Adding a file here adds a fight (add its id to a group in `09_groups.js`, or it lands in the last group). Bosses are shown by name only, with no door numbers. See `BOSS_AUTHORING.md` |
| `90_bot.js` | Autopilot and the `window.__game` test hooks |
| `99_tail.js` | Boot and URL parameters |

`build.sh` concatenates `00_head.html`, `00_ui.html`, then every `NN_*.js` in filename order into one ES module and syntax-checks it.

## Controls

Keyboard and mouse: WASD move (camera-relative), hold LMB to orbit the camera, hold RMB to steer the character with the camera, both buttons to run forward, wheel to zoom, Space to jump, Tab or click to target, Esc to pause. Abilities on `1 2 3 Q E R F` (also `4-7`).

Controller: left stick move, right stick camera, `RT RB Y A B X LB` for the seven slots, LT jump, d-pad to cycle targets, R3 to reset the camera, Start to pause.

These are the defaults. Settings (title menu or pause) has a Controller On/Off toggle and a binding table that shows keyboard + mouse
bindings when the controller is off and pad buttons when it is on; click a binding (or A / ✕ on it) and press the new key or button.
Taking a key another action uses swaps the two. Keyboard bindings can be any key, Shift + a key, or the middle and side mouse buttons;
Esc cancels, Backspace clears. Fixed and not remappable: left/right mouse camera, wheel zoom, click to target, Esc pause, both sticks,
Start / Options pause, and A / B (✕ / ○) plus the d-pad in menus. Settings also has two **Testing** toggles: *God mode* (`godMode`: hits land and show as usual but health never drops below 1, and a fall puts you back at the spawn point) and *Super damage* (`superDmg`: a landed hit of yours drops the boss to just under its next phase threshold, so the normal phase change, transitions and nightmare clocks run; in the last phase it kills; one skip per phase, and only once the phase has been live 0.75 s). A fight with either on shows a HUD tag and records no kill time or nightmare split. Everything is stored in `localStorage.th_settings`
(`pad`: true / false / unset, where unset means the first controller button press turns it on; `glyphs`: auto / xbox / ps; `binds`;
`diff`: normal / nightmare, the Difficulty toggle on the door page).
Button prompts follow the connected pad (PlayStation pads are detected by Sony's vendor id 054c) unless overridden.
Pad buttons use the W3C standard mapping that Chrome gives Xbox, DualShock 4 and DualSense pads.

Every class has up to seven skills in hotbar slots 0-6 (a slot can be empty). Duskblade and Stormcaller fill all seven the same way: filler, spender, ultimate, mobility, defensive, slot 5, heal. Slot 5 used to be the interrupt: Duskblade's Sunder is greyed out until it is redesigned; Stormcaller's is now Overcharge (see below). Ashwarden and Hexslinger do not follow that template.

## Classes

| Class | Shape | How it plays |
| --- | --- | --- |
| Duskblade | melee, 7 skills | Builds Momentum with a combo, spends it; Lunge, a parry that counters, three instant heals. |
| Stormcaller | ranged, 7 skills | Stands still to cast Bolt, spends Static on the move; Blink, a barrier, three cast-time heals. One Static pip glows each cycle: when it is the next pip to fill, Overcharge (R, 1.5x Bolt's cast) fills it, and a full Discharge holding it adds 250 damage. Bolt can still fill it, at base value. Each Discharge moves the glow to a different slot, picked a cycle ahead and shown under the pips (a gold underline) once the current glow is filled. Levers: `SC` in `08_classes.js`. |
| Ashwarden | melee, 5 skills | No cooldowns. One stamina bar pays for Strike, the Overhead (a wind-up leap) and the Roll (passes through blockable hits; a dodged hit makes the next Overhead instant and free). Overdrawing stamina leaves you Winded. Four flasks, which can be drunk or poured on the blade (Kindle) for damage. |
| Hexslinger | ranged, 5 skills | No cooldowns, no resource, fully mobile. A six-chamber cylinder loaded one round at a time and fired in order: lead (damage, stronger up close), silver (weak, leaves the target Exposed), salve (the heal, six per fight). The sixth shot of a full cylinder emptied without reloading hits double. Spin sends the next round to the back. |

### What a class must be able to do

The twenty fights assume these, so any new class has to provide them in some form (they do not have to be buttons of their own):

- **No interrupt.** Interrupts were removed (2026-11): no boss cast is interruptible, so every mechanic either always happens or is gone. Do not add `interruptible: true` to a new cast. The engine hook (`Ent.interrupt`, `castState.int`) is still there but unused.
- **Heal about 1100 over a fight.** 1000 health, no regeneration, hits of 230 to 520. A cast-time or delayed heal is fine: every fight leaves 2 s gaps.
- **About 110 to 140 damage per second on one target, and be able to point it at adds.** Enrage timers only need about half of that. No area damage is needed.
- **Be clearly melee (reach 3.4) or clearly ranged (about 34).** Set `melee: true` on a melee class: boss autopilot hints and the autopilot's positioning read that flag.
- **Deal damage in discrete hits with `src: 'player'`.** Several fights react to being hit (or to a cast starting on a specific target) rather than to damage totals.
- Jumping belongs to the engine, not the class: do not change jump height or airtime.

Optional: a dash (no fight needs one; the Ashwarden roll and leap and the Duskblade Lunge may cross gaps) and a defensive. Anything that negates a hit must only negate `blockable` hits, as `parryT`, `shield` and `dodgeT` in `Player.hurt` do: rule-breaking punishments are unblockable on purpose.

HUD hooks on a skill: `rdy(p)` (glow), `act(p)` (lit while active), `interrupt: true` (glow while the target casts something stoppable), `view(p)` (icon override). `resource.kind` picks the resource display: pips (default), `'bar'` or `'cylinder'`. A `usable()` reason that starts with a capital letter is shown to the player as a hint.

## Difficulty (Normal / Nightmare)

The door page has a Normal / Nightmare toggle between the classes and the doors (mouse, arrows / d-pad left-right on it, Enter / A flips it).
On Nightmare, a door without a nightmare version is greyed out, cannot be focused or clicked, and the hall behind the menu dims it.
Five fights have one so far (Parallax, "Totality", is described in `23_boss_engine.js`). Door III, Niten: four phases on the same 23,000 health (sunset, nightfall, the lake with its seam and mirrored
ghosts, then his reflection fighting beside him, where exactly one of the two can be hurt and Stillness is the swap). Door XIX, Chiaroscuro:
three phases on 24,000 health (Normal: 31,000) (the fight opens in colour, then the Negative, then a turning seam splits the canvas into a white
half and a black half, and every Critique names a half and a colour, shown as his whole body white or black with the colour as a swirl of
paint winding up him; under 10% three fast Critiques keep the same answer paint while the half flips). The Impresario, "Final Call":
three phases on 28,000 health (100 / 85 / 68). The Impresario only takes real damage while his lead understudy doll (gold strings and a gold
shell) stands in the pool of light at his feet (x0.1 otherwise); the dolls mirror your moves, so you steer the lead into it. Every 15 s he
recasts the lead. Phase 2 adds a second doll, phase 3 ("Final Call") ties strings to you and ramps every 35 s (the Hand, dark Cues where only
the dolls carry lights, birds and scenery, a faster tempo, then a triple-Cue Curtain call); a passed Cue gives a 4 s Ovation (x2 damage).
No Encore on Nightmare; the last blow is "Final Curtain". Euryale, "The Garden Remembers": three phases on 20,500 health
(100 / 88 / 74). Her skin is stone (x0.2) and statues cannot be hurt; every awake statue her own Behold crumbles cracks her open for
4 s (banked up to 14 s, shown as a lit arc on the stone ring under her, one segment per statue). Statues walk only while unseen, so
you herd them with your eyes into her cone. Phase 1 raises the first two in her lane, phase 2 adds the first mirror, phase 3 (the
garden) ramps every 35 s: more statues kept awake (3 to 5), faster (3.2 to 4.2 m/s), a second mirror, bare plinths (the last
statues rise from the floor), paired Beholds. Petrify roots for 1.8 s. The last blow is "A Thousand Eyes". Normal play is
untouched by any of this.

A nightmare version is a `nightmare` block on the boss def (see `BOSS_AUTHORING.md`). It has short teaching phases and a long last
phase that ramps on its own, and one overall enrage: from `enrage` seconds a soft creeping pulse (`enrageBase` 40 + `enrageGrow` 4 per
second over, every 2 s), and `lastBlowAt` (24) seconds later a themed last blow nothing survives (src `enrage`, so the death screen says
"Out of time"). No per-phase clocks. The death and victory screens list each phase (live time, dps). Nightmare records live in
`localStorage.th_save` as `Save.nm[doorId][classId] = { v: 2, best, splits, clears }` (best total, best time per phase on its own,
clears; records without `v: 2` are from the old clocked fights and are ignored); `Save.kills` is Normal only.

## URL parameters

`?boss=cathedral|leviathan|duelist|engine|titan|gorgon|theatre|wheel|express|winter|origami|lamp|chess|festival|fall`, `&class=duskblade|stormcaller|ashwarden|hexslinger`, `&phase=N` (0-based), `&skipintro`, `&god`, `&bot=1..3` (autopilot), `&debug`, `&mute`, `&seed=N`, `&quality=low|medium|high|ultra`, `&strictmath` (testing only: out-of-domain shader math returns NaN and NaN pixels show bright magenta), `&nm=1` (the nightmare version of `boss`, if it has one; does not change the saved difficulty).

Later fights use the ids `clock`, `portal`, `atelier`, `sumi`. `portal` also takes `&gate=walk|dwell|jump`, the rule for entering a gate (default `walk`).

## Test hooks

`window.__game`: `start(id, {cls, phase, nm})` (`nm` defaults to the page's `?nm=1`), `def(id)` (the def a start would use), `bot(level)`, `god(on)`, `state()`, `fastForward(seconds)` (runs the sim without rendering), `setPhase(n)`, `hurtBoss(frac)`, `kill()`, plus `G`, `Game`, `Bot`, `Hz`, `Bul`, `FX`, `Cam`. Set `G.headless = true` before long `fastForward` runs to skip cosmetic effects.

`../tools/` has Playwright scripts built on those hooks (they serve the repo locally and swap the CDN for a local three.js package, so they work offline):

- `superdmg.js [door ids]`: the Settings testing options (God mode + Super damage) on, level-3 autopilot clears every door, normal and nightmare; passes when each phase is entered once and in order, the player never dies and the boss falls.
- `smoke.js <boss>`: every phase with every class in god mode, reports script errors.
- `NM=1` before any of these tools adds `&nm=1` to every page they load, so `smoke`, `sim`, `matrix`, `hitch`, `nanscan`, `shot` and the rest run the nightmare version unchanged. The nightmare last blow pierces god mode on purpose, so god-mode runs still run out of time.
- `nmpace.js <boss> [classes|all] [runs]`: Nightmare pace. Plays whole fights from phase 1 with the level-3 autopilot in god mode and prints per run the kill time (or `OUT` when the last blow lands), each phase's time and dps, the last phase's share of the time, and the fight time each ramp step started; then kills, median, best and worst per class. `REAL=1` turns god mode off (survival, deaths with their source); `PASSIVE=1` never attacks; `SWAPBLIND=1` ignores who is awake in Niten; `SIDEBLIND=1` ignores the called half in Chiaroscuro and the lit tiles in Totality, `GARDENBLIND=1` ignores Euryale's garden (all must never kill). Bosses whose `nmTest.castStep(b)` names a ramp step (Niten, Euryale's garden) also get the cast budget per step.
- `nmphase.js [boss]`: forces each nightmare phase change in the middle of a mechanic (Issen: Stillness, a Counter, Final Verse; Pentimento: a Roller, a live Blot, a Critique, a matched Critique), then in the last phase starts the last blow mid-mechanic (Issen: a swap, a Counter, the twin Verse, paired Moons, a step-5 swap, the twin Petal Storm; Pentimento: a Fresh Coat, a Critique, a Roller, a repair drop, a Roller on the fast seam, a pair, the signature), and checks nothing is left behind; then that a restart resets the ramp state.
- `moonfuzz.js [classes] [runs]`: Issen's Moons (Full Moon = the "in", New Moon = the "out"). Whole fights with the level-3 autopilot; per Moon the share of the deck it leaves safe, whether the player already stood safe when its tell began, the walk to safety otherwise, and the hits. `NM=1` for Nightmare, `REAL=1` god mode off.
- `critfuzz.js [runs] [classes|all]`: door XIX's finale, where every Critique asks for a half and a paint at the instant it lands. Plays it (god mode; `STEPS=0,3,4` by default, forcing the ramp step so the fast seam and both Critiques of a pair are covered) with the level-3 autopilot and with a lazy one that never washes or fetches paint, and lists every Critique's route check (how long the walk to an answer takes, and the repair the boss made: moving the dish, dropping the missing paint, or stretching the cast). Passes when every Critique has an answer, all 14 calls appear, the level-3 bot needs a repair in under 25% of them and a stretched cast in at most 5% (the signature's stretched gaps are by design and counted apart).
- `nmshots.js <outDir> [class]`: screenshots of a Nightmare fight through the real menu and the full intro (door page on both settings, title card), then the last phase with one shot per ramp step, the enrage pulse, the last blow, the death table, the kill and the victory table. `BOSS=atelier` for Pentimento, `BOSS=engine` for Parallax.
- `callcast.js`: the Impresario's Final Call per ramp step: share of time the lead stands in the light, share of time casting, casts per minute, the longest stretch with no Bolt for the autopilot and by design, dps and Ovations. `STEP=n` forces one step, `BLIND=1` a bot that ignores who is the lead (must never kill), `REAL=1` god mode off.
- `cuefuzz.js [cues] [brackets]`: the Impresario's Cues (each has an answer, decoys never pass, dark Cues only readable from the dolls' lights), bird lanes stay symmetric, and every 15 s bracket leaves a reachable gate spot.
- `callphase.js`: forces each Impresario nightmare phase change and the last blow in the middle of every mechanic, checks nothing is left behind, then that a restart resets the state.
- `callentry.js`: the Impresario's Nightmare through the full intro for every class (split stage, pit, one doll), then a whole god-mode fight with ramp step times.
- `callshots.js <outDir>`: GPU shot list for the Impresario's Nightmare (opening, gate open / closed, recast tell, each ramp step, a dark Cue, an Ovation, the Curtain call, the last blow, the Final Call cinematic, the kill).
- `polfuzz.js`: Parallax Nightmare design checks. For every board the fight uses (7x7, phase II, each Totality board down to the 3x3 ring) and every pattern in that board's deck, both colourings leave enough tiles of each colour and a tile of the other colour within walking reach of every tile before the blast; every Polarize flip schedule stays in range; plus, for information, how often a beam wedge holds no lit tile at each Totality step. Exit code 1 on a failure.
- `engcast.js [class] [runs]`: Parallax Nightmare cast budget. Holds Totality at each ramp step (`STEPS`, `SEC`) with the level-3 autopilot in god mode and reports the share of time in a planted cast, the longest stretch with no lit spot safe for a whole Bolt (the design check, at most 6 s), the share of time on a lit tile, and the hits. `OFFLOG=1` and `GAPLOG=1` explain the misses.
- `gardenfuzz.js [classes] [runs]`: Euryale's Nightmare garden: per phase the share of live time she was open, each Behold's crumbled statues (0 = a wasted stare), Stone Grasps, petrifies and the most statues awake. `REAL=1`, `GARDENBLIND=1` (ignores the garden, must not kill), `PHASE=n`, `BY=1` (damage taken by source).
- `gardenphase.js`: forces each Euryale nightmare phase change and the last blow in the middle of every mechanic (a locked Behold, a floor rise, Lash, Vipers, an open window, the second mirror rising), checks nothing is left behind, then that a restart resets the garden.
- `gardenentry.js`: Euryale's Nightmare through the full intro for every class (the lesson statues rise in real frames), then a whole god-mode fight with garden step times.
- `gardenshots.js <outDir>`: GPU shot list for Euryale's Nightmare (the lesson, shell shut / open, a Behold with statues in the lane, each garden step, a floor rise, the garden cinematic, A Thousand Eyes, the kill).
- `cinelock.js [bosses] [classes]`: every cinematic locks the player. Full entry with the intro, holds W and taps 1 (BOT=1: autopilot), pushes the boss through each phase and kills it; per lock reports metres moved, casts, GCD/cooldown/gauge drift and HUD (all 0). NM=0 for normal fights.
- `menunav.js`: the Difficulty toggle with mouse, keyboard and a simulated controller (values, greyed doors skipped, focus, persistence, Restart keeps Nightmare, Normal still starts Normal). Must print `ALL PASS`.
- `matrix.js <class,class|all> [runs] [boss,boss]`: autopilot attempts for every door and class, one summary line each (wins, boss health left, dps). `GOD=1` checks instead that each class can finish every fight before the enrage.
- `sim.js <boss> <class> <botLevel> [runs] [maxSec] [phase]`: full autopilot attempts.
- `tank.js <boss> <class> <botLevel> [hpMult]`: one attempt with extra health, totals damage taken per mechanic.
- `hits.js <boss> <class> <botLevel>`: one attempt, prints every hit taken.
- `hitchscan.js [boss,boss|all] [class]`: the freeze hunt. Normal entry with the full intro, then the level-3 autopilot plays the whole fight in god mode in real frames; prints every late frame the freeze log (`12_hitch.js`) recorded with what happened just before it (shader compiled, program drawn for the first time, textures or geometry uploaded, slow step, main thread blocked, memory cleanup, cast, phase). Several ids play in one browser session on purpose: some stalls only happen from the second fight on. `TH_GPU=1` on a real graphics card for timings; `VIRT=1` in a GPU-less sandbox lists causes only; `NM=1`, `MAXSEC`, `SYNC=1` (wait for the GPU each frame), `OLD=1` (warm-up without its 2026-11 additions), `OUT=file.json`. Run one at a time: parallel runs stall each other.
- `hitch.js <boss>`: plays each phase in real frames and lists every shader compiled after the fight started (should be none). `FRAMES=n` watches each phase longer (default 300 frames); with `NM=1` it also jumps to the last blow and watches it play through.
- `warmcheck.js [boss...]`: loads fights through the real loading path and prints rehearsal and warm-up times.
- `shot.js <query> <out.png> [evalJS] [frames]`: screenshot.
- `hexcap.js <outDir> [boss,boss] [groups]`: herocap.js for the Hexslinger: idle, walk, fire and recoil, Load, Spin, Salve twirl, Silver, the Last Word, airborne, plus gun close-ups and the same perf line. `groups` (play,idle,walk,fire,load,spin,salve,last,air) keeps a review loop short.
- `herocap.js <outDir> [class] [boss,boss]`: player-model review. Enters each door normally (intro plays), then screenshots the hero with the play camera and with a follow camera (front, side, back, face) idle, walking, casting, on the spender, Blink, the barrier and Tempest; prints the hero's mesh and triangle counts and the frame time.
- `duskcap.js <outDir> [boss,boss]`: the same review for the Duskblade (normal entry; idle, walk, the three Slash steps, Sever, Riposte and its counter, Sunder, Lunge, Bladestorm). `duskpose.js <outDir> [boss]` pins every Duskblade swing at four points of its timeline (plus guard, dash and full Momentum) and shoots each from the front and the sword side.
- `awcap.js <outDir> [boss,boss] [groups]`: the same review for the Ashwarden (cuts, Overhead wind-up and slam, roll and hop, Kindle, Ember Flask, opening, Winded), with the one-shot moves in slow motion so screenshot latency cannot skip them. `AW_LAB=1` hides the arena and lights the knight evenly on grey.
- `montage.js <out.png> <cols> <x,y,w,h | full> img...`: tiles (optionally cropped) screenshots into one contact sheet.
- `diag.js <boss> <class> <expr> <seconds> [phase]`: autopilot run that prints `expr` (JS with `g, G, b, p, S` in scope) every half second, for tracing a mechanic.
- `gatefuzz.js [step] [mode]`: no browser; door `portal`. For every gate layout, pairing and single sealed pair, from start positions all over the floor, every gate mechanic must have a variant the route solver can beat (or else the fight's fallback Slam). Prints how often the intended number of trips is available and solver timings.
- `gatesoak.js [classes] [runs] [botLevel]`: door `portal` autopilot soak in god mode; counts hits from the gate mechanics (a level-3 autopilot should take none). `GATE=dwell|jump` tests the other entry rules.
- `figfuzz.js [N]`: no browser; fuzzes the One Breath figure generator of door `sumi` (N figures per phase, default 20000). Every figure must be solvable in one stroke, have a start that fails, sit inside the terrace with no joint within 4 m of the player and leave the dragon a clear spot; phase 2 one-way lines must change which starts work. Prints the spread of route lengths and cast times.
- `chessfuzz.js [N]`: no browser; fuzzes the Gambit board generator of door `chess` (N boards per act, default 10000). Every board must leave a reachable square that is safe and gives check. Prints good-square counts and how often each relaxation fired.
- `chesssim.js <class> [runs] [mode]`: door `chess` autopilot fights with Gambit outcomes. Mode `mix` skips check on a quarter of Gambits, `nocheck` never gives check (that bot should die).
- `chesslock.js`: door `chess` lock-in audit: every class presses every skill while locked; nobody may leave the square.
- `chessshots.js <outDir> [class]`: door `chess` after a full normal entry (intro plays), screenshots of the Gambit beats.
- `nanscan.js [boss ...]`: NaN audit (all doors if no args). Real GPUs turn out-of-domain shader math (`pow` of a negative, `normalize` of zero, ...) into NaN pixels that bloom spreads into black squares; SwiftShader hides most of these. This runs with `?strictmath`, which makes the sandbox return NaN the way a GPU does, plays every phase with every class, and counts NaN pixels. Should print `ALL CLEAN`; an occasional 1-2 pixel hit on a flat-shaded `MeshStandardMaterial` at the screen edge comes from three.js's own flat-shading normal (`normalize(cross(dFdx, dFdy))` on a sub-pixel sliver); door V swaps in a guarded copy of that chunk (`SAFE_FLAT` in `24_boss_titan.js`), which other doors can reuse if it shows up. Anything in the hundreds is a real bug (the Petal Storm bullet bug showed 600-900). `__game.nanScanBy()` names the mesh responsible. `NANSCAN_SAFE=1` runs it without `?strictmath`, to check the guards themselves.

Run them with `NODE_PATH=<global node_modules with playwright> THREE_DIR=<unpacked three@0.170.0 package> node tools/smoke.js titan`.

## Tuning levers

- Boss health, enrage timer and phase thresholds: the `hp`, `enrage` and `phases[].at` fields at the bottom of each boss file.
- Mechanic damage and telegraph time: the `delay` and `dmg` arguments of each `Hz.*` call in the boss file.
- Player health and speed: `Player` in `07_player.js` (1000 hp, speed 7). Class numbers: `08_classes.js`.
- Look per fight: the `post` block of each boss (bloom, exposure, tint) and its `build()`.
- Nightmare pace: `NM_HP` in `22_boss_duelist.js` (Issen), `38_boss_atelier.js` (Pentimento), `26_boss_theatre.js` (the Impresario), `23_boss_engine.js` (Parallax, with `POL`, `SWEEP`, `DRONE` and `CYCLE` beside it) and `25_boss_gorgon.js` (Euryale, with `OPEN`, `WAKE` and `STEP`), with the measured table next to it, then the `enrage` time (330 to 360 s), then the ramp (`RAMP` for Niten, the Final Call and the garden, `SIT_PER_STEP` for Chiaroscuro, `CYCLE.perStep` for Totality). Tune with `tools/nmpace.js`; never touch class numbers or Normal for it.

The autopilot is a rough stand-in for a player who already knows the fight. At the time of writing it clears the cathedral and the engine, gets the leviathan and titan into their last phase, and dies in phase two of the duelist. Nothing has been tuned against a human yet.

## Shader safety (black squares)

Two framework guards in `01_core.js` keep one bad shader from blacking out the screen:

- **Math guard**: every GLSL ES 3.00 shader the page compiles gets `pow`, `sqrt`, `log`, `log2`, `acos`, `asin` and `normalize` remapped to domain-safe versions (negative bases clamp to 0, zero vectors normalize to 0).
- **Sanitize pass**: right after the scene render and before bloom, any NaN/Inf pixel is replaced by its neighbours, so bloom can never spread one into a square.

Still write shaders as if neither existed: re-clamp in the fragment shader anything you clamped in the vertex shader (MSAA extrapolates varyings past triangle edges), and guard divides. Run `tools/nanscan.js` after adding effects.
