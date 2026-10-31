# REGICIDE

A single-file Three.js roguelike raid. One player, five courts, five bosses with escalating phases, and an
Edict draft after each kill that bends the kit for the rest of the run. Keyboard and mouse first (WASD, Space,
Q hold, E, F, R), with a touch joystick and buttons as the fallback.

Live: https://thatcsguy.github.io/fun-stuff/regicide/

## Playing

- **Move** WASD / arrows. **Dash** Space or Shift (2 charges, i-frames).
- **Bulwark** hold Q (or right mouse): absorb blockable hits; release to **Riposte** for 20 + absorbed damage
  times a multiplier that is highest right after a hit lands. Gold hatched telegraphs go through it.
- **Rebuke** E: interrupts purple casts (boss Exposed + stunned), clears every orb in the cone, staggers adds.
- **Mend** F or 1: heal over time, 2 charges, cleanses burning.
- **Verdict** R: ultimate, charged by damage dealt. Leap, impale, invulnerable during the animation.
- Telegraph grammar: accent fill = blockable damage, gold hatched = lethal or unblockable (move), blue = safe zone,
  green = soak it, purple cast = interrupt it.
- Run: courts I to V in order, draft one Edict after each of the first four. Death offers retry court, retry phase,
  or abandon. Progress is saved in localStorage (`rg_run`, `rg_best`, `rg_unlock`, `rg_settings`).
- Court Select fights one court on its own (unlocks as you reach them). Practice is the Yard with a dummy.

URL params: `?boss=1..5`, `?practice=1`, `?run=1`, `?edicts=zeal,ironheart`, `?skipintro=1`, `?quality=low|med|high`,
`?safe=0..4` (graphics fallback level, saved as `rg_gfx_safe`), `?mute=1`, `?debug=1`, `?seed=N`, `?bot=0..3`.

## Building

```
cd regicide/src && ./build.sh
```

`build.sh` concatenates `00_head.html`, `00_ui.html` and `01_core.js` .. `99_tail.js` into `../index.html` as one
`<script type="module">` (Three.js 0.170.0 from jsDelivr via an importmap) and runs `node --check` on the script.
Never hand-edit `index.html`; edit the sources and rebuild.

| file | contents |
|---|---|
| `00_head.html`, `00_ui.html` | document head + CSS, HUD and screens markup |
| `01_core.js` | `G` namespace, params, renderer and post chain, watchdog, camera, loop |
| `02_input.js` | keyboard, mouse, gamepad, touch: move vector + semantic actions |
| `03_audio.js` | synthesised music per court and SFX |
| `04_fx.js` | particles, lances, shockwaves, floating numbers |
| `05_world.js` | sky presets and the arena skins per court |
| `06_combat.js` | hazard primitives, telegraph shader, adds, damage, the boss runtime |
| `07_player.js` | the Regicide: model, movement, skills, Edict mods |
| `08_ui.js` | screens, HUD, settings, touch controls, fullscreen |
| `09_run.js` | run state machine, Edict pool, draft, persistence |
| `10_boss1.js` .. `14_boss5.js` | the five courts |
| `15_bot.js` | `window.__game` test hooks + the autopilot used for balance sims |
| `99_tail.js` | boot order |

`SPEC.md` is the binding design spec. `BOSS_AUTHORING.md` documents the boss runtime API (`b.wait`, `b.hz.*`,
`b.cast`, `b.expose`, adds, phases) for adding or tuning a court.

## Testing

Playwright with SwiftShader: open `index.html?debug=1&mute=1&quality=low&seed=N`, then drive `window.__game`:
`startFight(court, {fromPhase, skipIntro, edicts})`, `bot(level 0-3)`, `fastForward(sec)` (async), `state()`,
`stats()`, `errors()`, `killBoss()`, `godMode`, `setPhase(n)`. A run is healthy when `errors()` is empty.
`?testboss=1` installs a probe boss that exercises every hazard primitive.
