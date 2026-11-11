# THRESHOLD: sources

A PC-first 3D raid game: ten unrelated boss fights behind ten doors, two classes, no progression.
`threshold/index.html` is **generated**. Edit the files in this folder and run `./build.sh`; never hand-edit `index.html`.

## Layout

| File | What it holds |
| --- | --- |
| `00_head.html`, `00_ui.html` | CSS, import map (three.js 0.170 from jsDelivr), HUD and menu markup |
| `01_core.js` | `G` namespace, math helpers, seeded RNG, `Settings`, `Save`, coroutines (`Co`), renderer, post-processing (`Post`) |
| `02_input.js` | Keyboard, mouse (MMO camera), gamepad; `Input.bot` override for the autopilot |
| `03_audio.js` | Synth sound effects (`Sound`) and the layered step-sequencer (`Music`) |
| `04_fx.js` | `FX`: particles, rings, beams, lightning, domes, missiles, damage numbers, shake |
| `05_world.js` | `Cam` (orbit camera + cinematic shots) and `W` (procedural textures, sky, water, lava, lights, motes) |
| `06_combat.js` | `Hz` telegraphed hazards, `Bul` bullets, `Ent` and `Boss` |
| `07_player.js` | Procedural hero model, `Player` (movement, casting, GCD, buffs, dashes, damage) |
| `08_classes.js` | The two classes and their autopilot rotations |
| `09_ui.js`, `10_game.js` | HUD/menus, fight lifecycle, the hall-of-doors menu scene |
| `2x_boss_*.js` | One file per boss. Adding a file here adds a door. See `BOSS_AUTHORING.md` |
| `90_bot.js` | Autopilot and the `window.__game` test hooks |
| `99_tail.js` | Boot and URL parameters |

`build.sh` concatenates `00_head.html`, `00_ui.html`, then every `NN_*.js` in filename order into one ES module and syntax-checks it.

## Controls

Keyboard and mouse: WASD move (camera-relative), hold LMB to orbit the camera, hold RMB to steer the character with the camera, both buttons to run forward, wheel to zoom, Space to jump, Tab or click to target, Esc to pause. Abilities on `1 2 3 Q E R F` (also `4-7`).

Controller: left stick move, right stick camera, `RT RB Y A B X LB` for the seven slots, LT jump, d-pad to cycle targets, R3 to reset the camera, Start to pause.

Slot order is the same for every class: filler, spender, ultimate, mobility, defensive, interrupt, heal.

## URL parameters

`?boss=cathedral|leviathan|duelist|engine|titan|gorgon|theatre|wheel|express|winter`, `&class=duskblade|stormcaller`, `&phase=N` (0-based), `&skipintro`, `&god`, `&bot=1..3` (autopilot), `&debug`, `&mute`, `&seed=N`, `&quality=low|medium|high|ultra`, `&strictmath` (testing only: out-of-domain shader math returns NaN and NaN pixels show bright magenta).

## Test hooks

`window.__game`: `start(id, {cls, phase})`, `bot(level)`, `god(on)`, `state()`, `fastForward(seconds)` (runs the sim without rendering), `setPhase(n)`, `hurtBoss(frac)`, `kill()`, plus `G`, `Game`, `Bot`, `Hz`, `Bul`, `FX`, `Cam`. Set `G.headless = true` before long `fastForward` runs to skip cosmetic effects.

`../tools/` has Playwright scripts built on those hooks (they serve the repo locally and swap the CDN for a local three.js package, so they work offline):

- `smoke.js <boss>`: every phase with both classes in god mode, reports script errors.
- `sim.js <boss> <class> <botLevel> [runs] [maxSec] [phase]`: full autopilot attempts.
- `tank.js <boss> <class> <botLevel> [hpMult]`: one attempt with extra health, totals damage taken per mechanic.
- `hits.js <boss> <class> <botLevel>`: one attempt, prints every hit taken.
- `shot.js <query> <out.png> [evalJS] [frames]`: screenshot.
- `nanscan.js [boss ...]`: NaN audit (all doors if no args). Real GPUs turn out-of-domain shader math (`pow` of a negative, `normalize` of zero, ...) into NaN pixels that bloom spreads into black squares; SwiftShader hides most of these. This runs with `?strictmath`, which makes the sandbox return NaN the way a GPU does, plays every phase with both classes, and counts NaN pixels. Should print `ALL CLEAN`; door V (titan) may show an occasional 1-2 pixel hit on a `MeshStandardMaterial` at the screen edge, which comes from three.js's own flat-shading normal and is covered by the math guard below. Anything in the hundreds is a real bug (the Petal Storm bullet bug showed 600-900). `__game.nanScanBy()` names the mesh responsible. `NANSCAN_SAFE=1` runs it without `?strictmath`, to check the guards themselves.

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
