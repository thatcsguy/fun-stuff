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
| `07_player.js` | Procedural hero model, `Player` (movement, casting, GCD, buffs, dashes, damage) |
| `08_classes.js` | The four classes and their autopilot rotations (see "Classes" below) |
| `09_ui.js`, `10_game.js` | HUD/menus, fight lifecycle (including the hidden rehearsal at load), the hall-of-doors menu scene |
| `11_warm.js` | Warm-up frame and light keeper that stop shader compiles mid-fight |
| `2x_boss_*.js`, `3x_boss_*.js` | One file per boss. Adding a file here adds a door. See `BOSS_AUTHORING.md` |
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
Start / Options pause, and A / B (✕ / ○) plus the d-pad in menus. Everything is stored in `localStorage.th_settings`
(`pad`: true / false / unset, where unset means the first controller button press turns it on; `glyphs`: auto / xbox / ps; `binds`).
Button prompts follow the connected pad (PlayStation pads are detected by Sony's vendor id 054c) unless overridden.
Pad buttons use the W3C standard mapping that Chrome gives Xbox, DualShock 4 and DualSense pads.

Every class has up to seven skills in hotbar slots 0-6 (a slot can be empty). Duskblade and Stormcaller fill all seven the same way: filler, spender, ultimate, mobility, defensive, interrupt, heal. Ashwarden and Hexslinger do not follow that template.

## Classes

| Class | Shape | How it plays |
| --- | --- | --- |
| Duskblade | melee, 7 skills | Builds Momentum with a combo, spends it; Lunge, a parry that counters, three instant heals. |
| Stormcaller | ranged, 7 skills | Stands still to cast Bolt, spends Static on the move; Blink, a barrier, three cast-time heals. |
| Ashwarden | melee, 5 skills | No cooldowns. One stamina bar pays for Strike, the Overhead (a wind-up leap that is also the interrupt) and the Roll (passes through blockable hits; a dodged hit makes the next Overhead instant and free). Overdrawing stamina leaves you Winded. Four flasks, which can be drunk or poured on the blade (Kindle) for damage. |
| Hexslinger | ranged, 5 skills | No cooldowns, no resource, fully mobile. A six-chamber cylinder loaded one round at a time and fired in order: lead (damage, stronger up close), silver (the interrupt, plus Exposed), salve (the heal, six per fight). The sixth shot of a full cylinder emptied without reloading hits double. Spin sends the next round to the back. |

### What a class must be able to do

The twenty fights assume these, so any new class has to provide them in some form (they do not have to be buttons of their own):

- **Stop a cast.** Every door has an interruptible cast about once per rotation (2.4 to 3.4 s long, one of 9 s). The interrupt has to work on adds as well as the boss and has to reach: give it range or a gap closer. Roughly one every 14 s is enough.
- **Heal about 1100 over a fight.** 1000 health, no regeneration, hits of 230 to 520. A cast-time or delayed heal is fine: every fight leaves 2 s gaps.
- **About 110 to 140 damage per second on one target, and be able to point it at adds.** Enrage timers only need about half of that. No area damage is needed.
- **Be clearly melee (reach 3.4) or clearly ranged (about 34).** Set `melee: true` on a melee class: boss autopilot hints and the autopilot's positioning read that flag.
- **Deal damage in discrete hits with `src: 'player'`.** Several fights react to being hit (or to a cast starting on a specific target) rather than to damage totals.
- Jumping belongs to the engine, not the class: do not change jump height or airtime.

Optional: a dash (no fight needs one; the Ashwarden roll and leap and the Duskblade Lunge may cross gaps) and a defensive. Anything that negates a hit must only negate `blockable` hits, as `parryT`, `shield` and `dodgeT` in `Player.hurt` do: rule-breaking punishments are unblockable on purpose.

HUD hooks on a skill: `rdy(p)` (glow), `act(p)` (lit while active), `interrupt: true` (glow while the target casts something stoppable), `view(p)` (icon override). `resource.kind` picks the resource display: pips (default), `'bar'` or `'cylinder'`. A `usable()` reason that starts with a capital letter is shown to the player as a hint.

## URL parameters

`?boss=cathedral|leviathan|duelist|engine|titan|gorgon|theatre|wheel|express|winter|origami|lamp|chess|festival|fall`, `&class=duskblade|stormcaller|ashwarden|hexslinger`, `&phase=N` (0-based), `&skipintro`, `&god`, `&bot=1..3` (autopilot), `&debug`, `&mute`, `&seed=N`, `&quality=low|medium|high|ultra`, `&strictmath` (testing only: out-of-domain shader math returns NaN and NaN pixels show bright magenta).

Doors XVI to XX use the ids `ballpark`, `clock`, `logic`, `atelier`, `pit`.

## Test hooks

`window.__game`: `start(id, {cls, phase})`, `bot(level)`, `god(on)`, `state()`, `fastForward(seconds)` (runs the sim without rendering), `setPhase(n)`, `hurtBoss(frac)`, `kill()`, plus `G`, `Game`, `Bot`, `Hz`, `Bul`, `FX`, `Cam`. Set `G.headless = true` before long `fastForward` runs to skip cosmetic effects.

`../tools/` has Playwright scripts built on those hooks (they serve the repo locally and swap the CDN for a local three.js package, so they work offline):

- `smoke.js <boss>`: every phase with every class in god mode, reports script errors.
- `matrix.js <class,class|all> [runs] [boss,boss]`: autopilot attempts for every door and class, one summary line each (wins, boss health left, dps). `GOD=1` checks instead that each class can finish every fight before the enrage.
- `sim.js <boss> <class> <botLevel> [runs] [maxSec] [phase]`: full autopilot attempts.
- `tank.js <boss> <class> <botLevel> [hpMult]`: one attempt with extra health, totals damage taken per mechanic.
- `hits.js <boss> <class> <botLevel>`: one attempt, prints every hit taken.
- `hitch.js <boss>`: plays each phase in real frames and lists every shader compiled after the fight started (should be none).
- `warmcheck.js [boss...]`: loads fights through the real loading path and prints rehearsal and warm-up times.
- `shot.js <query> <out.png> [evalJS] [frames]`: screenshot.
- `diag.js <boss> <class> <expr> <seconds> [phase]`: autopilot run that prints `expr` (JS with `g, G, b, p, S` in scope) every half second, for tracing a mechanic.
- `logicfuzz.js`: no browser; fuzzes the circuit generator of door `logic` (every circuit must be survivable).
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

The autopilot is a rough stand-in for a player who already knows the fight. At the time of writing it clears the cathedral and the engine, gets the leviathan and titan into their last phase, and dies in phase two of the duelist. Nothing has been tuned against a human yet.

## Shader safety (black squares)

Two framework guards in `01_core.js` keep one bad shader from blacking out the screen:

- **Math guard**: every GLSL ES 3.00 shader the page compiles gets `pow`, `sqrt`, `log`, `log2`, `acos`, `asin` and `normalize` remapped to domain-safe versions (negative bases clamp to 0, zero vectors normalize to 0).
- **Sanitize pass**: right after the scene render and before bloom, any NaN/Inf pixel is replaced by its neighbours, so bloom can never spread one into a square.

Still write shaders as if neither existed: re-clamp in the fragment shader anything you clamped in the vertex shader (MSAA extrapolates varyings past triangle edges), and guard divides. Run `tools/nanscan.js` after adding effects.
