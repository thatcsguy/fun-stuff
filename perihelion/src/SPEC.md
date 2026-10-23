# PERIHELION: The Orrery Raid (build spec)

This is the binding spec for the build. The design brief it comes from is `/mnt/project-files/auto-raid/design.md`
(Patrick's decisions there are final). Where this file and the brief differ, this file wins: it adds the concrete
numbers, the code architecture and the module contracts that let several people write modules in parallel.

The player is Patrick (also plays on an iPhone with Chrome iOS = WebKit, and on desktop). He will not be asked
questions: every open decision is ours. Quality bar: the previous three games in this repo (`raid/`, `prismfall/`,
`kart-raid/`); Prismfall's look and its boss 2 ("each phase escalates, feels like a real raid fight") are the
favourites, but this game must look different (see Visual direction).

---------------------------------------------------------------------------------------------------------------
## 1. The game in one paragraph

A single-file Three.js boss rush. Three bosses, each 3 to 5 minutes. The hero, the **Orrery Knight**, never steers:
they always run around the boss along one of **three concentric brass rings**. The player has exactly two movement
verbs, **Reverse** (flip cw/ccw) and **Shift** (hop one ring in or out), and five skill buttons. Nearly every skill
cares about *where on the orbit you are when you press it*: the boss's back is its weak point, anchors heal you when
you run back over them, and the big charge shot wants to be released from behind. Threats are expressed as polar
shapes on the rings (wedges, sweeping beams, whole-ring detonations, rotating slices, travelling orbs, soak stars,
blockers), all telegraphed, and a ghost trail shows where you will be in 1.5 s (tinted red where that will be unsafe).

---------------------------------------------------------------------------------------------------------------
## 2. Core rules and numbers (starting values; boss/tuning passes may adjust them)

### 2.1 Arena geometry and coordinates
- World units, y up. The arena plane is y = 0. The boss stands at the origin.
- Ring radii `G.RINGS = [5.5, 9.0, 12.5]` (index 0 inner, 1 middle, 2 outer). Track width (visual) 1.3.
- Polar coordinates: angle `theta` in radians, measured from +x toward **-z** (so on screen, with the camera looking
  from +z toward the origin, increasing theta is counter-clockwise). Helper: `G.polar(r, theta, y=0, out?) ->
  Vector3(r*cos(theta), y, -r*sin(theta))`. Always use `G.polar`, never hand-roll the conversion.
- Angle helpers in core: `G.wrap(a)` to (-PI, PI], `G.angDiff(a, b)` = wrap(a - b), `G.inArc(a, center, halfWidth)`.
- "Contact" on a ring: something at (ring k, angle phi) touches the hero when the hero's *visual ring* (rounded, see
  Shift) is k and `|angDiff(hero.theta, phi)| * RINGS[k] < hitRadius` (arc length, not angle). Default hero hit
  radius 0.55 world units.

### 2.2 Movement
- Constant **angular** speed on every ring: `omega = 0.60 rad/s` (one lap = 10.5 s on any ring; the outer ring
  feels faster in world units, which is fine). `dir = +1` ccw, `-1` cw. Start: middle ring, theta = -PI/2 (bottom of
  screen, nearest the camera), dir = +1.
- `P.speedMul` (default 1) can be changed by boss mechanics (ring speed-ups). `P.halted` (Eclipse) sets speed 0.
- **Reverse:** 0.20 s turnaround (velocity eases through zero to the new direction; visually the knight skids and
  turns, cape swings). 0.15 s lockout after it completes. Input during a turnaround or lockout is buffered (one).
- **Shift in/out:** a 0.28 s arc hop to the adjacent ring (keeps orbiting during the hop). **I-frames from 0.06 s to
  0.20 s into the hop** (0.14 s window, deliberately small; a well-timed Shift dodges a beam). 0.35 s lockout after
  landing; buffered. Shifting past the inner or outer ring does nothing except a small "bump" wobble + soft sound.
  During the hop, the hero's ring for hazard purposes is the source ring for the first half and the target ring for
  the second half (`P.ringF` is the continuous float radius index, `P.ring` the rounded one).
- **Ghost trail:** a dotted gold arc from the hero to where they will be in 1.5 s on the current ring at the current
  velocity, ending in a faint ghost silhouette. Each dot samples `G.hz.dangerAt(ring, theta, tAhead)`: dots that will
  be inside an active-or-firing hazard at that time are tinted the current boss's threat accent. While the current
  path is dangerous, faint ghost markers also appear on the adjacent ring(s) at the 1.5 s point, gold if those are
  safe. This is the main readability device: keep it on by default (setting to hide).

### 2.3 The Orrery Knight's kit
Damage multipliers, applied to everything the player deals:
- Ring: inner x1.35, middle x1.0, outer x0.75.
- **Behind the boss:** x1.5 when the hero is inside the boss's rear arc: `|angDiff(heroTheta, boss.facing + PI)| <
  60 deg`. The boss shows a glowing rear sigil (its weak point) and the hero gets a gold glint + the HUD shows
  "BEHIND" while it holds.
- Constellation (see Anchor): x1.15 while active.
- Stagger (successful interrupt): boss takes x1.3 for 3 s.

Skills (desktop key / mobile button):
1. **Strike** (automatic). Every 0.45 s the knight throws a starlight bolt (visible travelling projectile, 0.25 s
   flight) at the target: the nearest add on the hero's ring within 70 deg ahead of the hero, otherwise the boss.
   12 base damage. +1.2 supernova meter per hit. Strike keeps going during Eclipse halts and shifts.
2. **Anchor** (Q or 1). Plants a star-anchor at the hero's current (ring, theta). 2 charges, 9 s recharge per charge.
   Max 3 anchors on the field (placing a 4th removes the oldest). Anchors last 30 s. When the hero passes over an
   anchor on the same ring (contact radius 0.7) and that anchor's own 1.5 s cooldown is ready, it **pulses**: a gold
   lance from the anchor to the boss for 26 damage, **+5 HP heal**, +3 meter. Healing exists ONLY through anchor
   pulses (and none passively). Some boss attacks destroy anchors (`G.player.anchors.smash(pred)`), with a clear
   shatter effect.
   - **Constellation:** with 3 anchors whose angular spread contains the boss (every gap between consecutive anchor
     angles < 180 deg, ignoring ring), gold constellation lines link them over the arena floor and the player gets the
     x1.15 damage buff. With 2 anchors a line links them but no buff.
   - Empowered (by Eclipse): a **Meridian Anchor**, which pulses on any ring at that angle and heals double.
3. **Comet** (Space or 2; hold to charge, release to fire). Charge 0 to 1 over 1.2 s, holds at full indefinitely.
   While held, a trajectory line runs hero to boss and turns bright gold (with a chime) while behind. Release fires a
   comet: 60 + 240 * charge damage, +10 meter (+15 if it landed from behind). 7 s cooldown from release. A tap
   (charge < 0.1) fires a weak comet. Empowered: instantly full, x1.5 damage, pierces (also hits every add in its
   line).
4. **Eclipse** (E or 3). 14 s cooldown. Always does all three:
   - **Halts** the hero's orbit for 1.5 s (dark corona around them; Strike keeps firing). Pressing Reverse or Shift
     ends the halt early. This is the emergency brake / "wait here" tool.
   - **Interrupts** any interruptible boss cast in progress. Success: cast cancelled, boss staggered (x1.3 damage
     taken for 3 s, recoil animation), +15 meter, Eclipse cooldown immediately reduced to 7 s, big feedback.
   - **Empowers** the next skill used within 6 s (Anchor, Comet, Aegis or Supernova). Icon on the empowered buttons.
5. **Aegis** (F or 4). 24 s cooldown. For 1.0 s, blocks ALL incoming damage (hazards, projectiles, contact, forced
   falls). Each blocked hit fires a reflected gold lance at the boss for `max(40, 3 x the blocked damage)`; a hit
   blocked in the first 0.3 s is "PERFECT" for x4.5 and +20 meter. +12 meter per reflect. This is the panic button
   with a DPS payoff: greedy players save it for the biggest hit. Empowered: 1.8 s window and x1.5 reflects.
6. **Supernova** (R or 5; usable only at 100 meter). 3.0 s set piece: the hero rises, hazards slow to 0.3x, the camera
   swings to a dramatic low angle, the hero collapses a star into the boss: 900 damage (x1.5 if empowered; ring/
   behind multipliers do not apply), destroys all adds and travelling projectiles, the hero is invulnerable during
   it and for 1 s after. Target one cast per 60-80 s of decent play.

Player HP 100, no passive regen. After taking a hit: 0.8 s of i-frames (hero flickers). Death: slow-motion collapse,
then the defeat screen with **Retry phase** (restart the phase you died in: boss at that phase's HP threshold, player
full HP, anchors cleared, cooldowns reset), **Restart fight** and **Menu**. Results record whether a checkpoint
was used.

### 2.4 Damage guidelines for bosses
Ordinary hazard 15-25, heavy 35-50, lethal-tier 70-100 (only with a telegraph of at least 2.5 s and a clear
"get off this ring" or "be in the gap" read). Never two lethal-tier threats that need opposite answers at once. Boss
1 must be readable on a first try and still kill a sloppy player (see tuning targets, section 9).

---------------------------------------------------------------------------------------------------------------
## 3. Controls
- Desktop: Reverse = A or D or Left/Right arrow (either key flips direction). Shift in = W / Up, Shift out = S /
  Down. Skills Q/1 Anchor, Space/2 Comet (hold), E/3 Eclipse, F/4 Aegis, R/5 Supernova. Esc or P pause. Mouse
  clicks on the on-screen skill buttons also work (show them on desktop too, smaller, with key hints).
- Mobile (coarse pointer): landscape is primary, portrait must also work.
  - Left thumb: one large **Reverse** button (about 96 px, shows the current direction as a curved arrow that
    flips), and next to it a vertical two-part **In / Out rocker** (top half IN, bottom half OUT, about 64x128 px).
  - Right thumb: five skill buttons in an arc (Comet the largest, about 84 px, the rest about 64 px; Supernova
    glows and pulses when ready). Each shows a radial cooldown sweep, charge count (Anchor), and an empowered glyph.
  - Pointer events with `touch-action:none`, act on pointerdown (no click delay), full multi-touch, Comet charges on
    pointerdown and fires on pointerup/pointercancel. Respect safe-area insets. Haptics via `navigator.vibrate` where
    available (short tick on Shift, longer on damage), toggleable.
- Input layer emits semantic actions only: `G.input.on('reverse'|'shiftIn'|'shiftOut'|'anchor'|'cometDown'|
  'cometUp'|'eclipse'|'aegis'|'nova'|'pause', fn)`. Gameplay never reads keys directly. The bot drives the same
  actions through `G.input.fire(action)`.

---------------------------------------------------------------------------------------------------------------
## 4. Camera and readability
- Fixed camera, no auto-rotation during play (screen-space cw/ccw must stay stable). Perspective FOV 42. Looks at
  (0, 0.5, 0) from the +z side at about 56 deg pitch. Distance auto-fits so a circle of radius 14 (outer ring +
  margin) fits the viewport with room for the HUD, on any aspect ratio (portrait phones pull back more).
- Subtle life: tiny idle drift (< 0.15 units), shake API with a settings toggle, hit-stop API.
- The boss fades to ~35% opacity where it would hide the hero (hero behind it on screen), and the hero always has a
  readable silhouette marker (gold ring decal under them + soft beacon).
- Cinematic API for phase transitions and Supernova: camera moves on a scripted path then returns smoothly.

---------------------------------------------------------------------------------------------------------------
## 5. Visual direction: celestial orrery (must NOT look like Prismfall)
Prismfall = monochrome-to-colour, prismatic RGB, hex mirror floor. Avoid all three.
- A deep indigo-to-black void. No floor plane: the rings float in space over a faint engraved star-chart disc
  (concentric circles, degree ticks, constellation figures, very low contrast, slowly rotating).
- Arena rings: brass/gold metal tracks (MeshStandardMaterial / physical, metalness ~0.9, roughness ~0.35, a small
  generated env map so the metal has highlights), engraved with degree ticks and zodiac-like glyphs (canvas texture)
  and an emissive inlay line that brightens with the music/phase. Large decorative armillary rings and orrery arms
  with small planets turn slowly far outside the play area (and deep below/behind), never covering the track.
- Player effects warm gold/white with bloom. Each boss has ONE cold threat accent used for all its telegraphs:
  boss 1 ice cyan `#5fe3ff`, boss 2 viridian `#3dffa2` (with a rose secondary `#ff5f9e` for adds only), boss 3
  violet `#a77bff` going white-hot in the finale. Telegraphs: filled translucent shapes with a bright animated edge
  and a fill that grows toward the fire moment, so "when" is readable, not just "where".
- Sky escalates per boss AND per phase (the Prismfall bar): boss 1 night starfield + milky way band -> constellations
  draw themselves, meteors -> frost-cyan nebula; boss 2 dusk aurora -> full aurora curtains -> emerald/rose nebula
  bloom -> storm; boss 3 swollen red sun -> flares/corona -> collapse -> black hole with gravitational lensing and an
  accretion disk. Phase changes are cinematic (2-3 s, camera move, sky transformation, banner, music swell).
- Post: RenderPass -> UnrealBloom (half res) -> final grade pass (ACES, slight vignette, warm-gold/indigo grade,
  very light film grain). Optional chromatic fringe is NOT allowed (Prismfall-ish).
- Performance: 60 fps desktop, 45-60 on a recent phone at "Med". Quality tiers High/Med/Low + Auto (drops a tier
  when frame time stays bad). Particle budgets per tier. Pixel ratio capped (High 2, Med 1.5, Low 1).

---------------------------------------------------------------------------------------------------------------
## 6. Screens and HUD
- Title: PERIHELION wordmark (engraved gold, glowing), a slowly turning orrery behind it, buttons: Fight (boss
  select with 3 cards: name, title, accent, best time / cleared mark; all unlocked), Practice (training dummy, no
  damage to the player, shows the controls), How to play (one short illustrated card per verb/skill), Settings,
  and a **Fullscreen** button (top-right; uses the Fullscreen API where it exists; where it does not, e.g. iPhone,
  it shows a one-line hint: "Use Share > Add to Home Screen for full screen"). Fullscreen toggle also in pause.
- URL: `?boss=1|2|3` skips the menu straight into that fight (1-indexed). `?practice=1`, `?debug=1`, `?bot=1..3`,
  `?quality=high|med|low`, `?safe=0..4`, `?seed=N`, `?mute=1`.
- Boss intro card on fight start (name + title, 2 s, skippable by any input), then "Begin".
- HUD: boss name + HP bar (phase threshold ticks) top centre; cast bar under it (interruptible casts are framed with
  the Eclipse glyph); player HP bar + supernova meter bottom centre (between the thumb clusters on mobile); fight
  timer top-left; pause + fullscreen top-right; "BEHIND" and "CONSTELLATION" chips; phase banner; floating damage
  numbers (gold, crits bigger; toggle). Hero HP also as a thin arc under the hero in-world.
- Results: victory (time, grade S/A/B/C by time and damage taken, damage breakdown by skill, hits taken, perfect
  Aegis count, interrupts, checkpoint used?) with Next boss / Retry / Menu. Best time per boss in localStorage.
- Settings (localStorage `ph_settings`): master/music/sfx volume, quality, screen shake, ghost trail, damage numbers,
  haptics. Pause on Esc/P/pause button and automatically on `visibilitychange` hidden.

---------------------------------------------------------------------------------------------------------------
## 7. Audio
WebAudio only, all synthesized (no files). Unlocked on first user gesture. Music per boss: celestial
music-box/celesta arpeggios, bell tones, choir-like pads, a pulse that rises per phase (intensity layers 0-3), a
distinct motif per boss, a short victory fanfare, a defeat sting. SFX: strike tick, anchor plant + pulse chime
(pitch rises with consecutive pulses in a lap), comet charge riser + release + impact, eclipse "thoom", interrupt
shatter, aegis block / perfect ping / reflect, supernova build + blast, shift whoosh, reverse skid, hurt, telegraph
warn tones (rising pitch as the fire moment approaches; distinct sound for lethal-tier), phase transition swell.
API: `G.audio.sfx(name, opts?)`, `G.audio.music(bossIndex|'menu'|null)`, `G.audio.setIntensity(0..3)`,
`G.audio.duck(amount, dur)`, `G.audio.volumes({master, music, sfx})`.

---------------------------------------------------------------------------------------------------------------
## 8. Code architecture

### 8.1 Files and build
Sources live in `perihelion/src/`. `perihelion/src/build.sh` concatenates them into `perihelion/index.html`:

```
00_head.html     doctype, meta (viewport-fit=cover, apple-mobile-web-app-capable, theme-color), <title>, base CSS,
                 the importmap, </head><body>, <canvas id="c">, the loading veil
00_ui.html       all HUD/menu/touch-control markup and its CSS (<style> + DOM)
(build echoes)   <script type="module">
01_core.js       G namespace, params, utils, event bus, renderer/scene/camera/post/watchdog, loop, quality
02_input.js      keyboard + touch + pointer -> semantic actions
03_audio.js      synth audio
04_fx.js         particles, beams, lances, shockwaves, decals, damage numbers (world-space), screen flash
05_world.js      sky presets, star chart, rings, orrery decor, ring state (breaks/tilt/glow)
06_combat.js     hazard system + telegraph meshes, adds, damage, boss framework, fight flow, practice dummy
07_player.js     knight model, orbit motion, ghost trail, skills, anchors, constellation, stats
08_ui.js         HUD binding, menus, boss select, settings, results, fullscreen, how-to-play
09_boss1.js      boss 1      10_boss2.js  boss 2      11_boss3.js  boss 3
12_bot.js        autopilot + test hooks (window.__game)
99_tail.js       boot sequence
(build echoes)   </script></body></html>
```
Then build.sh extracts the module script and runs `node --check` on it (as `.mjs`). Three.js is loaded from the
pinned CDN via the importmap: `three` -> `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js`,
`three/addons/` -> `https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/`. `01_core.js` begins with the imports
(THREE, EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass as needed). No other dependencies.

### 8.2 Rules every module follows
- Everything is one ES module after concatenation, so top-level names are shared. **Only `01_core.js` declares
  top-level imports and `const G`.** Every other file wraps itself in an IIFE `(() => { ... })();` and exposes its
  API by assigning onto `G` (e.g. `G.fx = {...}`). This avoids name collisions between files.
- Top-level code may only define things. All work happens in init functions called by `99_tail.js` in this order:
  `G.core.init()`, `G.input.init()`, `G.audio.init()`, `G.fx.init()`, `G.world.init()`, `G.combat.init()`,
  `G.player.init()`, `G.ui.init()`, then the boss files have already pushed their definitions onto `G.bosses`
  (they do that at top level: `G.bosses[0] = {...}`; `G.bosses` is created in core), `G.bot.init()`, then
  `G.core.start()`.
- Per-frame: core's loop calls, in order, `G.input.update(dt)`, `G.combat.update(dt)` (which updates hazards,
  adds, the active boss, fight flow), `G.player.update(dt)`, `G.fx.update(dt)`, `G.world.update(dt)`,
  `G.ui.update(dt)`, `G.bot.update(dt)`, then renders. `dt` is clamped to 1/20 and already multiplied by
  `G.timeScale` (hit-stop/slow-mo); `G.rdt` is the real (unscaled) frame dt for UI and camera.
- Simulation time: `G.t` (seconds of fight time, advances only in 'fight' and 'cinematic' states and not while
  paused). Hazards and bosses schedule against `G.t`.
- **Fast-forward for tests:** `G.core.step(dt)` runs one full update without rendering; `window.__game.fastForward
  (seconds, dt=1/30)` loops it. Therefore no gameplay logic may depend on rendering, requestAnimationFrame timing or
  real time. Visual-only updates inside update functions are fine.
- Defensive: any `G.fx.*` / `G.audio.*` / `G.world.*` call from gameplay code must not throw if the effect is
  unknown; those modules guard their own internals. Errors inside one boss attack should be caught and logged via
  `G.log.error(where, e)`, not kill the loop.
- Determinism: use `G.rand()` (seeded mulberry32, reseeded per fight from `?seed` or a fight counter) for gameplay
  randomness. Visual-only randomness may use Math.random.
- Disposal: anything a fight creates must be removed on fight end/retry (`G.combat.reset()` tears down hazards, adds,
  boss model, anchors, fx owned by the fight). No leaks across 10 retries.

### 8.3 Core (`01_core.js`) API
```
G.params            parsed URL params (boss, practice, debug, bot, quality, safe, seed, mute)
G.isTouch, G.isIOS  booleans
G.RINGS, G.OMEGA    [5.5, 9, 12.5], 0.6
G.polar, G.wrap, G.angDiff, G.inArc, G.lerp, G.clamp, G.smooth(t), G.easeOutCubic, ... small math helpers
G.rand(), G.randRange(a,b), G.reseed(n)
G.on(evt, fn), G.off(evt, fn), G.emit(evt, data)        event bus
G.scene, G.camera, G.renderer, G.composer, G.bloomPass  three objects
G.layers            { arena, fx, boss, player, ui3d }   Groups added to scene, so teardown is easy
G.cam               { shake(amount, dur), hitStop(dur, scale=0.05), slowMo(scale, dur),
                      cinematic(keys, opts) -> Promise,   // keys: [{t, pos:[x,y,z], look:[x,y,z]}], returns to play cam
                      fit() }
G.timeScale, G.t, G.rdt, G.state  ('menu'|'intro'|'fight'|'cinematic'|'paused'|'dead'|'victory'|'practice')
G.quality           { tier, set(tier), auto, particleBudget }
G.gfx               { safe, set(n) }     safe levels as in kart-raid: 0 full, 1 no MSAA, 2 + 8-bit targets,
                                         3 + no bloom, 4 no post chain; iOS starts at 1; ?safe overrides;
                                         black-screen watchdog steps up and remembers (localStorage ph_gfx_safe)
G.core              { init(), start(), step(dt), pause(bool) }
G.log               { error(where, e), info(...) }  errors also counted in G.log.count for tests
G.bosses            []  boss definitions (pushed by boss files)
G.mat               shared material helpers: brass(opts), emissive(color, intensity), additive(color), glow sprite
                    texture G.tex.glow, G.tex.star, G.tex.ring (generated canvases)
G.colors            { gold:'#ffc94d', goldHot:'#fff1c2', indigo:'#0b0a24', void:'#04030c', accent: current boss
                      threat colour (set by combat at fight start) }
```
Renderer: antialias false on the default framebuffer (post handles it), `powerPreference:'high-performance'`,
ACES tone mapping in the grade pass, sRGB output. MSAA (samples 4) only on the composer target at safe level 0 and
never on iOS. HDR half-float targets only when `EXT_color_buffer_float/half_float` exist. Copy the watchdog approach
from `kart-raid` (`/mnt/project-files/kart-raid/src-snapshot/01_core.js`, search `gfxWatch`).

### 8.4 Events (G.emit names; payloads in braces)
`fightStart {bossIndex, practice}`, `fightEnd {result:'victory'|'defeat'|'quit'}`, `phaseStart {index, name}`,
`phaseTransition {from, to}` (cinematic begins), `bossDamaged {amount, source, crit, behind, pos}`,
`playerDamaged {amount, source, blocked}`, `playerHealed {amount}`, `playerDied`, `bossDefeated`,
`castStart {name, dur, interruptible}`, `castEnd {name, interrupted}`, `interrupt`, `skillUsed {skill, empowered}`,
`anchorPlaced`, `anchorPulse {pos}`, `anchorSmashed`, `constellation {active}`, `aegisBlock {perfect}`,
`novaStart`, `novaEnd`, `shift {from, to}`, `reverse {dir}`, `behind {active}`, `telegraph {lethal}`,
`stateChange {from, to}`.

### 8.5 Combat (`06_combat.js`): hazards, adds, bosses, fight flow
**Hazards** are the ONLY way boss attacks hurt the player (plus add contact, which is also routed through hazards).
Every hazard draws its own telegraph (in the boss accent unless `color` given) and resolves its own damage, so bosses
compose attacks from these. All times are seconds; `warn` is telegraph time before it goes live; `active` how long
it stays live. `rings` is an array of ring indices (default all three). Angles in radians. Each returns a handle
`{id, cancel(), done:Promise-like via .then, fireAt, endAt}`. Each hit calls `G.player.damage(dmg, label)`; a hazard
hits a given player at most once per activation unless `tick` is set (damage every `tick` s while inside).
```
G.hz.arc({rings, center, width, warn, active=0.25, dmg, lethal?, label, color?})      static wedge
G.hz.sweep({rings, from, to, warn, dur, width=0.22, dmg, label})                        beam sweeping from->to (rad,
          can exceed 2PI; sign gives direction), preview shows the whole swept arc + an arrow, then the beam moves
G.hz.ring({ring, warn, active=0.4, dmg, lethal?, gaps?:[{center,width}]})               whole-ring detonation, optional
          safe gaps (the ring is safe inside a gap)
G.hz.rotor({rings, slices:[{center,width}], omega, warn, dur, dmg, tick=0.5})           slices rotating at omega
G.hz.wave({from:'in'|'out', speed, gaps:[{center,width}], warn, dmg, lethal?})          shockwave expanding (or
          collapsing) across the rings; it crosses ring k at a computable time; safe inside gaps or with i-frames
G.hz.orb({ring, theta, omega=0, dr=0, life, radius=0.6, dmg, onHit?})                   travelling projectile on/
          between rings (dr in ring-index/s); visible model, no warn (its motion is the telegraph)
G.hz.bolt({from:Vector3, ring, theta, warn, dmg})                                       targeted strike at a spot
          (circle decal on the track that fills, then a bolt lands)
G.hz.soak({ring, theta, warn, radius=0.8, failDmg, onSoak?, onFail?})                   star the hero must touch
          before `warn` runs out; untouched = failDmg to the player (raid-wide) + onFail
G.hz.gap({ring, center, width, dmg=30})                                                 broken track: running into
          it = damage + forced Shift to an adjacent intact ring (outer first), with a fall animation
G.hz.custom({warn, active, test(ring, theta, t)->bool, dmg, draw?})                     escape hatch
G.hz.dangerAt(ring, theta, tAhead) -> 0..1   predicted danger at that spot tAhead s from now (for ghost trail/bot)
G.hz.clear(filter?)                           cancel all (or matching) hazards with a quick fade
G.hz.active                                   list (for debug/bot)
```
Telegraph meshes: ring-sector geometry (`G.combat.sectorGeometry(r0, r1, a0, a1, segments)`), a shared shader with
uniforms `uColor`, `uProgress` (0..1 fill toward fire), `uTime`, `uLethal` (extra pulsing hatch pattern + a deeper
warning tone for lethal-tier). On fire: bright flash + fx burst along the shape. Shapes lie just above the track
(y = 0.03 .. 0.06, polygonOffset) and must stay readable on the gold tracks (dark rim + accent edge).

**Adds:** `G.adds.spawn({ring, theta, omega=0, hp, model?:fn(group), radius=0.6, contactDmg=20, blocks=true,
onDeath?, update?(add,dt)})`. Adds are Strike/Comet targets (`G.adds.list`), show a small HP bar, die with an effect.
A blocking add on the hero's ring: contact = contactDmg + the hero is bounced (auto-Reverse) — unless Aegis or
i-frames. Supernova kills all adds.

**Boss framework:** a boss definition (pushed to `G.bosses[i]` by the boss file):
```
{ name:'GNOMON', title:'the Brass Warden', accent:'#5fe3ff', sky:'night', music:0,
  maxHp, phases:[{name, hpStart:1.0, enter(b), update?(b, dt), script(b)}, ...],   // hpStart descending
  build(b) -> creates b.model (THREE.Group) under G.layers.boss and anything else persistent,
  animate?(b, dt), onTransition?(b, from, to) -> Promise (the cinematic), teardown?(b) }
```
The runtime object `b` passed to everything has: `hp, maxHp, phase, facing (rad), turnRate (rad/s, default 0.42),
trackPlayer=true` (when true the facing turns toward the hero at turnRate; bosses may set `b.facingTarget` or turn
it off), `model`, `pos`, `staggered`, `casting`, and the helpers:
- `b.wait(sec) -> Promise` (resolves after sec of fight time; rejected/aborted on phase change or reset, so scripts
  stop cleanly: use `G.combat.Abort` checks or the helpers below, never raw setTimeout)
- `b.loop(async fn)` keeps running fn while the phase is active
- `b.cast({name, dur, interruptible=false, onDone, onInterrupt, telegraph?}) -> Promise<'done'|'interrupted'>`
- `b.pick(array)`, `b.playerTheta()`, `b.playerRing()`, `b.behind()`, `b.say(text)` (small subtitle)
- `b.damage(amount, info)` used by the player module; applies multipliers in one place:
  `G.combat.dealDamage(baseAmount, {source, behindEligible, ringEligible})`
Phase change happens when hp crosses the next phase's hpStart: current script aborts, hazards clear, a
`onTransition` cinematic runs (hero invulnerable, timer paused), sky/music intensity advance, then the next phase's
`enter` and `script` start. Boss HP never drops below the next threshold during a transition.
Fight flow: `G.combat.startFight(bossIndex, {practice, fromPhase})`, `G.combat.retryPhase()`,
`G.combat.restart()`, `G.combat.quit()`, `G.combat.reset()`. Victory: death cinematic for the boss (big!), then
results. The **practice dummy** is a fourth definition at `G.bosses.practice` (an orrery sphere target, infinite HP,
occasional gentle slow hazards of each kind so the player can try Reverse/Shift/Aegis/Eclipse, interruptible cast
every 12 s; player takes no damage).

### 8.6 Player (`07_player.js`) API
```
G.player = { init(), update(dt), reset(opts),
  state: { hp, maxHp:100, ring, ringF, theta, dir, speedMul, halted, invuln, iframes, shifting, alive,
           meter (0..100), empowered (bool), behind (bool), constellation (bool), pos:Vector3, model },
  damage(amount, label) -> {applied, blocked},     // all player damage goes through here
  heal(amount),
  forceShift(delta, {fall?}), forceReverse(), setSpeedMul(m, dur?), 
  cooldowns: { anchor:{charges, t}, comet:{t, charge, holding}, eclipse:{t}, aegis:{t}, nova:{ready} },
  anchors: { list, smash(pred), clear() },
  stats: { damageBySkill:{}, hitsTaken, damageTaken, perfectAegis, interrupts, deaths } }
```
The knight model: small (about 1.1 units tall) but readable: a gold-armoured figure with a tiny orbiting orrery halo
(two thin rings + a bead) above the head, a flowing cape/ribbon trail in gold, run cycle bob. Strong silhouette at
phone size (emissive rim, beacon).

### 8.7 UI (`08_ui.js` + `00_ui.html`)
Owns all DOM. Listens to events and reads `G.player.state`, `G.combat.boss`, cooldowns. Styles: engraved brass/gold
on deep indigo, serif display face via system fonts (e.g. "Cinzel" is not available offline, so use a CSS stack like
`"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif` for titles and system sans for numbers), thin gold
rules, glows. HUD must never cover the outer ring's bottom arc on phones (the camera fit leaves room; check both
orientations). Big touch targets, no hover-only affordances.

### 8.8 Bot and test hooks (`12_bot.js`)
`window.__game` (always present; destructive helpers only act when `?debug=1` or `?bot`):
`setBoss(i)`, `startFight(i, {fromPhase})`, `setPhase(n)`, `godMode(bool)`, `killBoss()`, `fillMeter()`,
`fastForward(seconds, dt)`, `state()` (compact JSON: state, t, boss hp/phase, player hp/ring/theta, errors),
`stats()`, `bot(level|0)`.
Bot (levels 1-3): every decision tick (level 1: 0.45 s reaction and 25% chance to ignore a threat; level 2: 0.25 s,
10%; level 3: 0.1 s, 0%) it reads `G.hz.dangerAt` for its current path and the adjacent rings and picks the safest
of: keep going, Reverse, Shift in, Shift out, Eclipse halt, Aegis (when a hit is unavoidable within 0.3 s).
It plants anchors spread around the arena, charges Comet and releases when behind, interrupts interruptible casts,
uses Supernova when ready, soaks soak stars, kills blocking adds. It uses only `G.input.fire()` (same rules as a
human).

---------------------------------------------------------------------------------------------------------------
## 9. Bosses
All three: distinct silhouette, their accent colour for every threat, a phase-transition cinematic, a death
cinematic, boss intro card, music motif, and per-phase sky/arena escalation. Their scripts must use every verb:
Reverse, Shift, Eclipse (both halt and interrupt), Aegis, and give reasons to go inner (greed) and outer (safety).
Interruptible casts should be maybe 1 every 20-30 s, and NOT the only reason Eclipse exists. Back exposure windows
should be deliberate (boss turns to face something else, or slams and stays put).

Tuning targets (measured with the bot in fast-forward, several seeds):
- Fight length for a bot-2 clear: boss 1 about 3:00-3:45, boss 2 about 3:45-4:30, boss 3 about 4:15-5:00.
- Bot-3 (near perfect) beats all three, usually with HP to spare on boss 1.
- Bot-2 beats boss 1 most of the time, boss 2 sometimes, boss 3 rarely.
- Bot-1 (sloppy) usually loses boss 1 (that is "not too easy").
- No hit that a bot-3 cannot avoid except deliberate soft raid-damage (<= 15) on cast completions.

### Boss 1: GNOMON, the Brass Warden (accent ice cyan; sky: night)
Silhouette: a tall brass sundial-knight. An obelisk body with a slanted gnomon blade for a head/crest, three
armillary hoops spinning around its torso, a huge shadow-hand on the ground that shows where it "points" (its
facing). Its back carries a glowing cyan-white keyhole sigil (weak point). Teaches every verb. 3 phases.
- **P1 "Noon" (100-65%)**: *Meridian Sweep* (a 240-300 deg sweep across 2 rings; the uncovered wedge is safe:
  reverse into it or shift to the uncovered ring), *Hour Strike* (bolts on 3-4 spots of your ring ahead of you:
  shift or reverse), *Gnomon Pylons* (2-3 blocking pylons, hp ~180, drop onto a ring: kill, reverse or shift around),
  *Equinox* ring detonation (one ring, 3 s warn, 60 dmg: shift off). Interruptible: *Zenith Hymn* (3 s cast;
  completion = 18 raid damage + the boss empowered: its next two attacks are faster). Back windows: after each Hour
  Strike the boss plants its blade for 3 s.
- **P2 "Dusk" (65-30%)**: transition: the armillary hoops detach and expand to become the rotating barrier arcs over
  the rings. *Armillary Spin* (rotor slices on two rings, 10 s, match their speed or reverse to wait in the gaps),
  combined with Hour Strikes; *Shadow Lengthens* (a lethal-tier inward wave with two gaps, 3 s warn: be in a gap or
  Aegis it for a huge reflect), anchors get smashed by the shadow hand sometimes (clear warning on the anchor).
  Sky: constellations draw themselves, meteors.
- **P3 "Midnight" (30-0%)**: transition: frost; the sky gets a cyan nebula, the rings rime over. Faster, combos
  (sweep + equinox on the other ring, pylons + armillary spin), *Long Night* (the boss's facing locks and it turns
  slowly so its back is a moving window: a Comet race), a final interruptible *Solstice* (5 s cast; completion =
  heavy 45 damage, so the interrupt really matters here but there is plenty of warning).

### Boss 2: OUROS, the Aurora Coil (accent viridian, adds rose; sky: aurora)
The Prismfall-boss-2 feeling: each phase transforms the sky and arena. Silhouette: a vast celestial serpent of
brass vertebrae and aurora ribbons, coiled around a central pillar; its head rears over the arena and its body loops
through the rings (sections of body physically occupy arcs of rings and move). 4 phases.
- **P1 "Veil" (100-75%)**: *Aurora Curtains* (rotor slices, slow, on all rings with gaps that are offset per ring:
  shift to stay in gaps), *Lunar Wisps* (rose adds that walk the rings toward you and explode on contact: kill or
  dodge), *Coil Lash* (the body sweeps one ring), interruptible *Siren Song* (if it completes, the hero is
  force-reversed and slowed for 4 s).
- **P2 "Tide" (75-50%)**: transition: the aurora pours down into the arena, the inner ring floods. The body
  occupies a moving arc of the middle ring (a moving blocker, contact damage). *Tidal Pull* waves (collapsing waves
  with gaps), wisps + curtains together. The flooded inner ring is safe but slows you (speedMul 0.6) and gives the
  inner bonus: a greed/safety choice.
- **P3 "Bloom" (50-20%)**: transition: nebula bloom, sky full of emerald and rose. *Star Seeds*: soak stars placed
  on different rings ahead of you on a timer (miss one = 20 raid damage and it spawns wisps); combined with curtains
  and coil lash. Aegis reflect on *Venom Beam* (a channelled sweep).
- **P4 "Storm" (20-0%)**: the storm: everything faster, lightning-lit aurora, the serpent's head dives through the
  arena (a lethal-tier lane marked across all rings), final enrage cast at 0:00 of a 60 s soft timer (screen shows
  the storm closing; if it completes, a heavy hit every 5 s).

### Boss 3: HELIARCH, the Dying Sun (accent violet, white-hot finale; sky: collapse)
The rings themselves become the enemy. Silhouette: a colossal brass astrolabe-crown floating around a burning
swollen star with a face-like corona mask; flares lash out from it. 3 phases + desperation.
- **P1 "Corona" (100-70%)**: *Solar Flares* (sweeps from multiple angles), *Prominence* (arcs that erupt from the
  inner ring outward), *Gravity Well* (every ~12 s the hero is pulled one ring in unless they Shift out during the
  1 s warning window, telegraphed by the rings bending), interruptible *Coronal Mass* (completion = a heavy outward wave
  with a single narrow gap; Aegis also works and reflects big).
- **P2 "Fracture" (70-40%)**: transition: segments of the rings break away and drift (gap hazards); *Spin Up*
  (a ring accelerates the hero: speedMul 1.6 for 8 s) and *Retrograde* (all rings force-reverse every 6 s,
  telegraphed by the ring inlay arrows flipping); soak stars that refill broken segments.
- **P3 "Collapse" (40-12%)**: transition: the star collapses, the plane TILTS (the whole arena tilts up to 18 deg,
  rotating slowly: purely visual plus the camera fit, mechanics stay polar), lensing sky, the black hole. Combos of
  everything.
- **Desperation "Event Horizon" (12-0%)**: only two rings remain (the outer breaks away), the event horizon pulls
  in a little every few seconds, Supernova is fully charged on entry for a final duel: a DPS race against a visible
  collapse timer (about 45 s; when it reaches zero, the player is consumed). Victory: the sun reignites into a
  calm new star (gorgeous moment).

---------------------------------------------------------------------------------------------------------------
## 10. Testing (every module author self-tests before finishing)
- Harness: `$HARNESS` (a Playwright helper; `const {launch} = require(process.env.HARNESS); const {browser,
  page, url} = await launch({mobile:true|false}); await page.goto(url('perihelion') + '?debug=1')`). It serves the
  repo from `http://game.local/` and maps the jsdelivr three@0.170.0 CDN to a local copy (sandboxes cannot reach
  CDNs). Rendering is SwiftShader: slow (expect 5-20 fps), so use `__game.fastForward` for long simulations and
  screenshots for visuals.
- Build: `bash perihelion/src/build.sh` (must print SYNTAX_OK).
- No console errors or page errors, `G.log.count === 0` after a full fight in fast-forward.
- Screenshots at desktop 1280x720 and phone (Pixel 7 portrait 412x915 and landscape 915x412) for every screen and
  every phase. Look at them (Read the png) and fix what looks wrong.
