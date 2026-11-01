# DRIFTBREAKER: Redline Raid — FINAL BUILD SPEC

How this spec was put together: Design 1 (DRIFTBREAKER) won 2 of 3 judge verdicts, so it supplies the creative spine, the class and the bosses. Design 4 (ORBIT RAID) supplies the engine: track-space simulation, hazard bands baked into the track shader, a fixed timestep and data-driven rotations. Raid features come from Design 3 (cast bars with interrupts, soak rings, the Brand debuff, soft and hard enrage). Spectacle comes from Design 2 (Breach/Coil gates, limbs that become ramps, the eclipse palette, shard finishers, the warp tunnel). The fixes the judges asked for are applied; see §16 "Judge fixes applied".

One self-contained `index.html`. Three.js r160 via importmap. Every asset is procedural. It is single player and mobile first (landscape touch) and also works with a desktop keyboard. Target: 55-60 fps on a mid-range phone.

---

## 0. Pitch and pillars

You are **Volt**, an Arc Runner. You fight three raid bosses on three looping circuits. **Your drift is your weapon.** Holding a drift charges a mini-turbo and a Spark Lance volley at the same time. Releasing it fires both. Grazing a telegraph just before it detonates gives you Flux and a short slow-mo. When the boss is Staggered and your Flux is full, you launch the **COMET**: a cinematic dive into the exposed core.

1. **The drift is the trigger.** There is no fire button. Racing well and dealing damage are the same input.
2. **Danger is fuel.** Grazes, Perfect Dashes and Mega Grazes pay out Flux.
3. **Momentum is sacred.** A hit costs hull and 0.4 s of wobble, never a full stop. Walls scrape you; they never stop you.
4. **Raid readability.** Every threat has a ground telegraph that fills toward resolution, a color and pattern code, and a distinct sound. Casts show a named cast bar.
5. **Every mechanic is solvable by steering, speed or a dash.** No mechanic forces you to stand still or brake for long.

Run length: Boss 1 about 2:15, Boss 2 about 3:00, Boss 3 about 3:30. With menus, briefings and some retries, a decent player finishes in **10-14 min**.

---

## 1. Units, coordinates, conventions (BINDING FOR ALL MODULES)

- **Units:** meters, seconds, radians, m/s. HUD speed shows km/h = m/s × 4 (for flavor).
- **World:** Three.js right-handed, **+Y up**. The arena center (boss home) is at world origin `(0, 0, 0)` unless an arena def says otherwise.
- **Track space `(s, d, h)`** is the authoritative space for gameplay:
  - `s` is the arc length along the track centerline in meters, in `[0, L)`, wrapping modulo `L`. The kart's driving direction is **+s**.
  - `d` is the lateral offset from the centerline in meters. **`d > 0` is to the driver's right.** All arenas are driven **counter-clockwise seen from above**, so `d < 0` is the inner edge (toward the boss) and `d > 0` is the outer edge.
  - `h` is the height above the track surface along the surface normal, in meters. It is 0 on the ground.
  - Track half-width `W(s)/2` comes from the sample table. Drivable range: `|d| ≤ W/2 − 0.9` (the kart half-width).
  - **Lanes:** 3 lanes. Lane index `-1` (inner), `0`, `+1` (outer). Lane center `d = lane × W/3`. Lane half-width is `W/6`.
- **Frame at s:** `P(s)` is the centerline point, `T(s)` the forward unit vector, `R(s)` the right unit vector (banked), and `N(s)` the up normal (banked). World position: `P + R·d + N·h`. Unbanked right = `normalize(cross(T, worldUp))`. Bank rotates R and N about T. A positive bank lifts the outer (`+d`) edge.
- **Signed curvature `κ(s)`:** `κ > 0` means the track bends **left** (toward `−d`). On a CCW loop κ is mostly ≥ 0.
- **Signed distance along the loop:** `G.track.ds(a, b)` returns the shortest signed `b − a` in `(−L/2, L/2]`.
- **Time:** the simulation runs at a fixed **60 Hz**: `G.DT = 1/60`. The game time scale `G.time.scale` (slow-mo, hit-stop) multiplies the sim dt. Rendering is interpolated.
- **Damage numbers** are integers. Boss HP and player hull are plain numbers (no percentages in the code; the HUD may show percentages).
- **Colors** are hex. Emissive values above 1.0 are intended to bloom.

---

## 2. Architecture

### 2.1 Source layout and build

```
/mnt/project-files/kart-raid/
  spec.md
  build.sh                 # concatenates src → index.html
  src/
    00_head.html           # <!doctype>, meta, CSS, HUD DOM, importmap, opening <script type="module">   (owner: UI)
    01_core.js             # imports, G namespace, renderer, composer + FinalPass, loop, time, events, rng, camera rig, shake, adaptive DPR, quality (owner: CORE)
    02_input.js            # touch joystick + buttons, keyboard, gamepad, injected input (owner: INPUT)
    03_audio.js            # WebAudio synth sfx, engine, sequencer music (owner: AUDIO)
    04_fx.js               # particles, bolts/ribbons, damage numbers, speed lines, shards, sky shaders, shared materials (owner: FX)
    05_track.js            # track builder, sample table, track shader w/ hazard bands, pads, ramps, gaps, item boxes, arena dressing (owner: TRACK)
    06_combat.js           # telegraph system + decal pool, zones, obstacles, gates, items, boss framework (HP, phases, stagger, cast bar, enrage, rotations) (owner: COMBAT)
    07_kart.js             # kart model, physics, drift/turbo, Flux, abilities, Comet, hull/credits, ghost recorder, bot (owner: KART)
    08_ui.js               # HUD, callouts, flow state machine, menus, briefing, garage, results, settings, persistence, window.__game (owner: UI)
    09_boss1.js            # Brasshollow + Ember Bowl arena def (owner: BOSS1)
    10_boss2.js            # Quicksilver Leviathan + Stratos Ribbon arena def (owner: BOSS2)
    11_boss3.js            # Velox + Event Horizon Circuit arena def (owner: BOSS3)
    99_tail.js             # boot: G.initAll(); closes </script></body></html> (owner: CORE)
```

`build.sh`:
```sh
#!/bin/sh
cd "$(dirname "$0")"
cat src/00_head.html src/01_core.js src/02_input.js src/03_audio.js src/04_fx.js src/05_track.js \
    src/06_combat.js src/07_kart.js src/08_ui.js src/09_boss1.js src/10_boss2.js src/11_boss3.js src/99_tail.js > index.html
```
`99_tail.js` ends with `\n</script>\n</body>\n</html>\n`. That works because the concatenation is plain text. The file is named .js only for the editor.

### 2.2 Module rules (critical, because the modules share one `<script type="module">` scope)

- **Only `01_core.js` contains `import` statements.** It puts everything on `G`:
  ```js
  import * as THREE from 'three';
  import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
  import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
  import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
  import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
  import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
  import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
  const G = window.G = { THREE, addons: { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass, BufferGeometryUtils } };
  ```
- Importmap (in `00_head.html`, exact):
  ```html
  <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
  ```
- **Every other file wraps its body in a block `{ ... }`**, so top-level `const`s cannot collide. It reads shared things only through `G` (for example, `const { THREE } = G;` inside the block).
- Each module registers itself: `G.register(name, { init, update?, render?, reset? })`. `init` may be async. Init order = registration order = file order. Per-frame hooks are called by core in the fixed order of §2.4.
- **No per-frame allocation.** Use module-level scratch `Vector3`/`Matrix4` instances and pools.
- **No external assets**, no fonts (system stack: `"Segoe UI", Roboto, Helvetica, Arial, sans-serif`, weights 800-900 italic for callouts), no textures except ones generated with CanvasTexture or DataTexture.
- Wrap every `localStorage` access in try/catch.
- Use the seeded RNG `G.rng()` for all gameplay randomness (cosmetic randomness may use `Math.random`).

### 2.3 Shared namespace `G` (exact names)

```js
G.DT = 1/60
G.cfg            // tuning constants (see §4); owned by KART/COMBAT, defined in core with defaults
G.params         // URL params parsed: {test, boss, phase, god, quality, seed, debug, mute}
G.rng()          // mulberry32 seeded; G.seed(n)
G.register(name, mod) ; G.initAll()
G.mods           // name -> module

// events (core)
G.on(name, fn) ; G.off(name, fn) ; G.emit(name, data)   // synchronous; also pushed to G.eventLog ring (200)

// time (core)
G.time = { now /*sim seconds*/, real, scale /*1*/, frame,
           hitstop(ms), slowmo(scale, durSec), paused /*bool*/ }
// hitstop: sim scale 0 for ms (real time); slowmo: scale for dur (real time), strongest wins; neither stacks beyond min scale

// rendering (core)
G.renderer, G.scene, G.camera /*PerspectiveCamera*/, G.composer, G.bloomPass
G.post           // FinalPass uniforms setters: see §9.2
G.cam = { mode:'chase'|'orbit'|'cinematic'|'turntable', shake(trauma), kickFov(deg,dur),
          lookAtBoss(weight, dur), setCinematic(fn(t,camera)|null), punch(dirVec3, amt) }
G.quality = { tier:'high'|'med'|'low', dpr, set(tier) }

// world / arena (track)
G.track = { L, def, built, build(arenaDef), clear(),
            frame(s, out) /*{p,t,r,n,w,bank,kappa}*/, toWorld(s,d,h,outV3), wrap(s), ds(a,b),
            nearest(worldV3, hintS) /*-> {s,d}*/, laneD(lane, s), curvature(s), width(s),
            isGap(s) /*true if surface missing*/,
            addRamp({s, len, kick, until?}) -> id, removeRamp(id),
            setGap({s0, s1, until?}) -> id, removeGap(id),
            pads /*[{s,lane,len}]*/, itemRows /*[s]*/, lapGateS /*0*/,
            setBand(slot, s0,s1,d0,d1, kind, fill, flash, alpha)  // low-level; COMBAT uses it
            uniforms /*track material uniforms: uTime, uBeat, uSpeed, uPalette...*/ }

// combat
G.tele.spawn(opts) -> handle ; G.tele.cancel(handle|id) ; G.tele.clear() ; G.tele.list()
G.zones.add(opts) -> id ; G.zones.remove(id) ; G.zones.clear()     // persistent area effects
G.obstacles.add(opts) -> obj ; .remove(obj) ; .clear()             // moving hitboxes in track space
G.gates.add(opts) -> gate ; .remove(gate) ; .clear()               // drive-through rings/pylons
G.items                                                           // boxes & held item logic
G.boss          // current Boss instance or null (see §7)
G.Boss          // class
G.bosses = []   // [def1, def2, def3]; boss modules push their def: G.bosses[0] = def
G.combat.damageBoss(amount, {source, targetId?, tier?, pos?})  -> dealt
G.combat.hitPlayer(amount, {src, knock?, spin?, unblockable?}) -> 'hit'|'blocked'|'perfect'|'invuln'|'god'

// kart
G.kart = { s, d, h, speed, psi, vh, hp, maxHp, flux, credits, lap, item,
           drifting, driftDir, driftTier, driftCharge, airborne, boosting, boostT,
           invulnT, dashT, cometActive, overclockT, brand /*seconds left or 0*/,
           worldPos /*V3*/, worldQuat, mesh,
           addFlux(n, reason), heal(n), respawn(s), reset(full), isInvuln(),
           predict(tSec) -> {s,d} }   // predicted position, for telegraph lead
G.ghosts = { record /*ring buffer (s,d,lap,t) @10Hz*/, sampleAgo(sec) -> {s,d} }

// fx
G.fx = { burst(type, worldV3, opts), emit(type, worldV3, dirV3, count, opts),
         bolt(fromV3, targetGetter, {color, dmg, speed, delay, onHit}),
         ribbon..., dmgNumber(worldV3, n, style), flash(color, amt), shards(mesh|pos, count, color),
         speedLines(intensity), callout3D... }
G.sky.set(name)  // 'ember'|'storm'|'void'|'warp'|'title'
// audio
G.audio = { unlock(), sfx(name, opts), music.play(trackId), music.layer(n, on), music.setIntensity(k),
            music.enrage(on), engine.update(speed, boost, drift), mute(on), beat /*0..1 phase*/, bpm }
// ui
G.ui = { callout(text, style), banner(title, sub), toast(text), setMode(m), showBriefing(i) }
G.flow = { state, go(state, data) }
```

### 2.4 Main loop (core)

```
frame(realDt):
  realDt = min(realDt, 0.1); G.time.real += realDt
  update FPS monitor / adaptive DPR
  if !paused: acc += realDt; steps = 0
    while acc >= DT and steps < 4:
       simDt = DT * effectiveScale   // effectiveScale = 0 during hitstop, else min(scale, slowmo)
       input.update(DT) ; kart.update(simDt) ; boss.update(simDt) (via combat) ;
       combat.update(simDt) ; track.update(simDt) ; fx.update(simDt) ; audio.update(DT) ; ui.update(DT)
       G.time.now += simDt ; acc -= DT ; steps++ ; G.time.frame++
  alpha = acc/DT
  kart.render(alpha) ; boss.render(alpha) ; cam.update(realDt) ; fx.render(realDt) ; composer.render()
```
Rules: UI, audio and camera shake run on **real** time, so they stay alive during hit-stop. When `G.params.test` is set, `__game.step(n)` advances n fixed steps synchronously, even while paused.

### 2.5 Event catalog (exact names; payloads as listed)

| Event | Payload | Emitter |
|---|---|---|
| `flow` | `{state, prev}` | ui |
| `fight:start` | `{boss}` (1..3) | ui/flow |
| `fight:end` | `{boss, win, time}` | combat |
| `boss:phase` | `{boss, phase, name}` | combat |
| `boss:damaged` | `{amount, targetId, weak, crit, pos, source}` | combat |
| `boss:stagger` | `{on, dur}` | combat |
| `boss:cast` | `{name, dur, interruptible}` | combat |
| `boss:castEnd` | `{name, interrupted}` | combat |
| `boss:enrage` | `{level}` (1 soft, 2 hard) | combat |
| `boss:dead` | `{boss}` | combat |
| `tele:spawn` / `tele:resolve` | `{id, shape, kind, s, d}` / `{id, hit, grazed}` | combat |
| `kart:hit` | `{amount, src, hp}` | combat |
| `kart:wreck` / `kart:respawn` | `{credits}` | kart |
| `kart:driftStart` / `kart:tier` / `kart:release` | `{dir}` / `{tier}` / `{tier, bolts}` | kart |
| `kart:boost` | `{source:'pad'|'turbo'|'item'|'gate'|'launch', dur}` | kart |
| `kart:graze` | `{amount, mega}` | combat |
| `kart:dash` / `kart:perfect` | `{}` | kart/combat |
| `kart:comet` | `{phase:'launch'|'dive'|'impact', dmg}` | kart |
| `kart:land` | `{airTime}` | kart |
| `lap` | `{lap, clean}` | kart |
| `item:get` / `item:use` | `{item}` | combat |
| `ui:callout` | `{text, style}` | anyone |

### 2.6 Initialization flow

`99_tail.js`: `await G.initAll(); G.flow.go(G.params.test ? 'fight' : 'title', {boss: G.params.boss||1})`, then start the rAF loop. All arena builds run through `G.track.build(def)` + `def.buildScenery(scene)`, called by flow when it enters `briefing`. The warp tunnel or briefing hides the build time.

---

## 3. Track system (05_track.js)

### 3.1 Arena definition (provided by each boss module)

```js
G.bosses[0] = {
  id:1, name:'BRASSHOLLOW', title:'the Furnace Sumo',
  arena: {
    name:'EMBER BOWL', sky:'ember', palette:{base:'#16100d', line:'#33f6ff', edge:'#ff6a1a', accent:'#ffc93a'},
    shape:{ type:'stadium', straight:120, radius:55 } | { type:'ring', radius:70 } | { type:'spline', points:[[x,y,z,width?,bankDeg?],...] },
    width:18, bankCurves:8,         // degrees on curves for stadium; spline uses per-point
    pads:[{s:20,lane:0,len:8},...], ramps:[{s:..., len:10, kick:9}], gaps:[{s0,s1}], itemRows:[s1, s2],
    drift Zones:[{s0,s1,mult:1.25}],
    surface:'basalt'|'glass'|'chrome', fog:{color:'#2a0d05', near:80, far:420},
  },
  buildScenery(scene, track){...}, // boss module builds the boss mesh & dressing
  boss: { hp:7000, softEnrage:210, hardEnrage:255, phases:[...] , ...}  // §7
}
```

### 3.2 Sample table
- Build a closed `CatmullRomCurve3` (centripetal) from points. Stadium and ring shapes are generated analytically as points every 5 m, which is more exact.
- Sample **1 per meter** into Float32Arrays: `P`, `T`, `R`, `N` (3 each), `W`, `bank`, `kappa`, `sCum`. Interpolate linearly between samples.
- `nearest(world, hintS)`: search ±6 samples around the hint, or a full scan when no hint is given.
- Curvature: `κ = signed angle(T(s), T(s+1)) / 1m`, smoothed over ±3 m.

### 3.3 Meshes (3-5 draw calls per track)
1. **Surface ribbon:** 2 verts per sample, plus a closing seam. Attributes `aS` (meters) and `aD` (meters). ShaderMaterial (§3.4).
2. **Edge curbs:** a 0.8 m lip on each side. An emissive stripe shader (`edge` palette color × 2.5, pulsing with `uBeat`), additive glow strip on top.
3. **Underside/skirt:** a dark extrusion 3 m down, so floating tracks read as solid.
4. **Item boxes:** InstancedMesh (max 24) of spinning octahedra with an iridescent fresnel shader. They hide while respawning (scale to 0).
5. **Ramps:** wedge meshes (one InstancedMesh, max 8) colored with an accent and chevrons.
Gaps: surface triangles in the gap range are degenerated (index rebuilt on `setGap`), and a crack/void shader is drawn on the edges. Rebuilding the index is cheap.

### 3.4 Track surface shader
Uniforms: `uTime`, `uBeat` (0..1 phase from the music), `uSpeed` (kart speed / 50), `uL`, `uPalette[4]`, `uSurface` (0 basalt, 1 glass, 2 chrome), `uEnrage` (0..1 red tint), `uMono` (eclipse), `uHaz[16]` vec4 `(s0, s1, d0, d1)`, `uHazB[16]` vec4 `(kind, fill, flash, alpha)`, `uPads[8]` vec4 `(s, d0, d1, len)`, `uKart` vec3 `(s, d, speed)`.
Fragment layers:
- **Base:** hash value-noise asphalt (basalt: dark with glowing orange cracks from `abs(fbm)` thresholds; glass: translucent `#0d1a33` with a hex grid that pulses outward from the kart's s; chrome: near-black with a white 4 m grid and stars reflected via a view-dir hash).
- **Lane lines** at `d = ±W/6` (dashed every 4 m), plus scrolling **chevrons** (`fract((s - uTime*uSpeed*12)/3)`) in `line` color, low alpha.
- **Boost pads:** bright cyan animated arrows inside the pad rects (emissive 3.0).
- **Hazard bands:** for i<16 where alpha>0: `inS = mod(s - s0, uL) < mod(s1 - s0, uL)`. When in the band, color comes from `kind` (§5.1). Fill grows **from both s-edges inward** toward the center (`edgeDist/halfLen < fill`). It draws 45° hazard stripes (pattern by kind), a 0.3 m bright border, a pulse at fill > 0.9, and a white overlay = `flash`. Active bands (fill = 1, "live") show an animated energy pattern (lava ripple, electric crackle, fire flicker by kind).
- **Beat pulse:** edge strips and lines brighten by `0.4 * (1 - uBeat)^4`.
- `uEnrage` mixes in a red pulse. `uMono` is handled in post (§9.2).

---

## 4. Kart, class and feel (07_kart.js)

### 4.1 Physics (track-space)

State: `s, d, h, psi` (heading relative to T, positive = right), `speed`, `vh` (vertical speed along N), `slip` (visual body yaw offset).

| Parameter | Value |
|---|---|
| Base top speed `vTop` | **36 m/s** |
| Acceleration | `speed += (vTop - speed) * 2.4 * dt` (≈70% at 0.8 s), +2 m/s² floor |
| Boost | target cap `vBoost = min(vTop + add, 52)`. Boosts stack by **max**, not add. Over cap, decay toward vTop at 18 m/s². |
| Brake | 40 m/s². Reverse caps at 8 m/s |
| Off-line (in lava/slow zones) | per zone |
| Steering yaw rate | `lerp(2.1, 1.35, speed/vTop)` rad/s × steer |
| Heading integration | `sdot = speed*cos(psi)/(1 + κ·d)`, `ddot = speed*sin(psi)`, `psi += yawRate*dt + κ*sdot*dt` (yawRate positive = right). Then auto-align: `psi *= (1 - 1.5*dt)` when the steering is neutral (light assist, keeps the kart from wandering). |
| Walls | When `|d| > W/2 − 0.9`, clamp d. If `|psi| < 0.52`: scrape, `psi *= 0.3`, speed ×0.92 per contact second (≈85% retained over a typical scrape), sparks. If the impact is head-on above 30°: speed ×0.7 and 4 hull damage. A wall hit during a drift drops the charge one tier. |
| Air | `vh -= 30*dt`; landing when `h ≤ 0` over a non-gap surface. Steering ×0.3 in air. If `h < −4` over a gap → fall: 15 dmg, respawn 25 m ahead at d=0 with 1.5 s invuln, speed 28. |
| Ramps | entering a ramp's s range on the ground gives `vh = kick` (default 9). A landing after more than 0.4 s of air gives a trick boost (+8 m/s for 0.6 s) if the drift button is tapped while airborne (Mario Kart trick). |
| Jump hop | tapping Drift without steer: `vh = 4.5`, 0.3 s hop (clears shockwaves with height < 1.2 m) |
| Camera | chase 6.5 m behind, 2.4 m up, looks 10 m ahead, yaw spring k=8, FOV 70 → 84 on boost (→ 90 Overclock), swings 6° to the outside during drift |

Visual: the kart yaws by `psi + slip`. Squash and stretch on hop and land. Wheel glow torus rings spin with speed. Blob shadow quad.

### 4.2 Drift and mini-turbo
- **Start:** Drift pressed while `|steer| > 0.25` and `speed > 18`: hop 0.14 s (0.35 m), then lock `driftDir = sign(steer)`.
- **Drift yaw rate:** `driftDir * (1.55 + 0.75 * steer*driftDir)` rad/s. Steering in tightens (to a 9 m radius at 0.9 speed), steering out widens. Visual slip is `driftDir * lerp(16°, 42°, (steer*driftDir+1)/2)`. Speed ×0.94 while drifting.
- **Touch drift assist** (default ON on touch, OFF on keyboard): when Drift is pressed with a neutral stick, `driftDir = sign(κ(s+20))` if |κ| > 0.004, else the last steer direction. While drifting with assist and a neutral stick, steer is auto-held at 0.35 into the curve.
- **Charge** accumulates only while actually drifting and on the ground: rate 1.0 per second, ×1.35 when steering into the drift, ×2 in Overclock, ×1.25 in Drift Zones, ×1.5 when drifting against a gust or gravity pull, ×1.15 with the Capacitor mod.
- **Tiers:**

| Tier | Charge | Spark color | Turbo on release | Spark Lance volley | Flux on release |
|---|---|---|---|---|---|
| T1 Blue | 0.6 s | `#3fa9ff` | +10 m/s, 0.5 s | 1 bolt × 40 | +3 |
| T2 Orange | 1.4 s | `#ff8a1f` | +13 m/s, 0.9 s | 3 bolts × 30 | +5 |
| T3 Violet "REDLINE" | 2.3 s | `#c04bff` | +16 m/s, 1.4 s | 6 bolts × 25 + 1 crit bolt × 60 (pierces shields, **interrupts**) | +8 |

- Releasing below T1 fires nothing (a "fizz" sound). Flux also builds **+4/s while drifting** (+6/s at T3).
- **Bolts:** they spawn from the kart's rear coil 40 ms apart, fly a homing quadratic arc at 90 m/s with a 0.3-0.8 s flight and a ribbon trail colored by tier. Target: the boss's **best target** (§7.4). Impact: hit-stop **40/60/90 ms** for T1/T2/T3 (applied once per volley, on the first bolt), a damage number, a boss flash, and a 0.12-unit camera punch toward the boss.
- Stagger contribution per volley: T1 2%, T2 5%, T3 12% (of the bar).

### 4.3 Signature resource: FLUX (0-100)
Electric-cyan ring around the speedometer.
- **Gains:** drifting +4/s (T3 +6/s), release +3/+5/+8, **graze +10**, **Perfect Dash +15**, **Mega Graze +30**, Clean Lap +15, boost pad +3, interrupt +20, Coil/Breach gold gate +8, shattered ghost +15.
- **Losses:** −10 per hit taken. **No passive drain** (judge fix).
- **Supercell:** while Flux = 100 and Comet is unavailable: +2 m/s top speed, white-gold arcs on the kart, and the Comet button shows "READY - WAIT FOR BREAK".

### 4.4 Abilities

| # | Name | Cost / CD | Effect |
|---|---|---|---|
| — | **DRIFT / HOP** | free | As above. Hold to drift, release to fire. Tap with no steer to hop. Tap in air to trick. |
| 1 | **ARC DASH** | 25 Flux, 1.2 s CD. **Free charge:** 1 stored charge that regenerates every 10 s, used first when available (so you always have a dodge) | 0.45 s lunge: +16 m/s and a lateral shift of 6.5 m toward the stick direction (forward only if neutral). **0.4 s invulnerability**, translucent cyan with 4 afterimages. **Keeps the drift charge** (dashing out of a drift resumes the drift afterwards if Drift is still held). Passing through a weak point, mine, orb or head hitbox deals 60 dmg (head: 150 + 25% stagger + interrupt) or destroys the projectile (+5 Flux). **Perfect Dash:** if any damage would have hit during the i-frames → "PERFECT", +15 Flux, cost refunded, 0.3 s slow-mo at 0.35×, and an **Overcharged** buff for 4 s (+50% bolt damage). |
| 2 | **OVERCLOCK** | 50 Flux, 20 s CD | 6 s: drift charge ×2, bolt count ×1.5 (rounded up), pad boost duration ×2, violet trail, hi-hat music layer, FOV +6. |
| 3 | **COMET** | needs **100 Flux** and **boss Staggered**; consumes all Flux. **Shares the Overclock button slot**, which turns into a big pulsing gold button when available. | 0.25 s launch on a 12 m arc → 0.6 s slow-mo (0.3×) cinematic orbit camera → dive into the core along an auto-targeted path (no aiming) → **900 dmg** (Twin Comet mod: plus a second hit at 40%) + trauma 0.8 + 120 ms hit-stop + gold shockwave + "COMET!" slam. Player invulnerable for the whole sequence (≈1.6 s). Lands back on the track 30 m further on, at d=0, with a +16 m/s 1.4 s boost. |
| — | **ITEM** | held item | See §6.4. |

### 4.5 Hull and lives
- **Hull 100.** Regen 3/s after 5 s without damage, up to 60% of max (75% with Reinforced Hull).
- On hit: 0.6 s i-frames (blink), 0.4 s wobble (steer ×0.4), speed ×0.85 (or a **spin-out** for 0.6 s where specified: steer locked, speed ×0.6), red chromatic aberration, trauma 0.35, vibrate 25 ms. Prism Shield blocks it.
- **Pit Credits:** 3 per fight. At 0 hull: **wreck** (explosion, kart tumbles), respawn after 1.5 s at the same s, d=0, with full hull, 2 s invuln and Flux kept −20. With 0 credits left: **WIPE** → defeat screen.
- **Retry from phase checkpoint:** the boss resets to its HP at the phase start, the fight timer resets to the phase-start time, hazards clear, you get full hull, 30 Flux and 3 credits. Unlimited, but the grade is capped at B. Restart-fight and Quit are also offered. Keyboard R = retry checkpoint.

### 4.6 Graze rules (combat checks these, kart receives them)
- A damaging telegraph (kind damage or knock) **at resolve**: if the player is not hit and the distance from the kart center to the shape edge is ≤ **1.5 m** (Graze Magnet: 2.5 m) → graze. Only one graze per telegraph. Only when on the ground or below h 2.
- For **live/persistent** hazards (spokes, beams, live bands): graze ticks of +4 Flux every 0.3 s while within the graze distance, up to +12 per hazard.
- Graze effects: +10 Flux, a 0.25 s slow-mo at 0.35× (**cooldown 1.2 s** on the slow-mo part only, to avoid stutter), a white rim flash, a "ting" sound and a "GRAZE +10" pop near the kart.
- **Mega Graze** (Boss 2 head-on pass within 4 m without being hit): +30 Flux, 0.6 s slow-mo at 0.3× with the camera swinging 40° to show the head passing.

### 4.7 Ghost recorder
`G.ghosts.record` stores `(s, d, t)` at 10 Hz in a ring buffer of 300 entries (30 s), always running in fights. `sampleAgo(sec)` interpolates. It is used by Boss 3 and by the bot.

### 4.8 Laps
A lap is counted when s wraps past `lapGateS` going forward. `clean` = no hull damage since the last crossing. A clean lap gives +15 Flux and a "CLEAN LAP" callout. `G.kart.lap` increments.

### 4.9 Launch start
On the 3-2-1-GO countdown, pressing or holding Drift (or W) **during "2"** (a 0.5 s window starting 1.0 s before GO) gives a launch boost of +14 m/s for 1.0 s and "PERFECT START". Pressing too early (during "3") gives a 0.5 s sputter.

### 4.10 Bot (for testing and the attract mode)
`G.kart.bot = true`: follows a target d (lane center), picks the lane with no active telegraph covering the s range `[s, s+60]` (it reads `G.tele.list()` and the zones), drifts when `|κ(s+15)| > 0.006`, releases at T2+, dashes if a telegraph resolves on it within 0.25 s, uses Comet when available and its item immediately. It does not need to be good, only to survive Boss 1 Phase 1 more often than not.

### 4.11 Kart model
Procedural, merged into ≤ 3 meshes, ~1,500 triangles. Chassis: beveled boxes in navy `#10162e` with emissive cyan trims `#33f6ff` (×2.2) and magenta accents `#ff3df2`. Four hover-wheel torus rings that glow with the tier color while drifting. A rear **Arc Coil** ring whose emissive scales with Flux (white-gold at 100). The driver is a white capsule-and-helmet figure with a cyan visor.

---

## 5. Telegraph language and system (06_combat.js)

### 5.1 Global language (colorblind-safe by pattern and sound)

| kind | Color | Meaning | Pattern | Sound cue |
|---|---|---|---|---|
| `damage` | red `#ff2a3a` with an orange `#ff8a1f` edge | Hurts at resolve | 45° hazard stripes | Rising whine (pips accelerate) |
| `knock` | purple `#b44bff` | Knockback, pull or spin | Dots / spiral | Low two-note drone |
| `gold` | gold `#ffc93a` | DPS window, weak point, Breach lane, gold gate | Forward chevrons | Bell chime |
| `soak` | cyan `#35f3ff` | Must be INSIDE when it resolves | Concentric pulsing rings | Choir pad swell |
| `lava` | orange `#ff5a00` | Persistent zone (lava, slow, acid) | Wavy ripple | Low bubbling |
| `safe` | cyan-white | Safe or boost hint | Arrows | — |
| (flash) | white | Final 0.12 s before resolve | Full overlay | Click |

### 5.2 Timing grammar (every telegraph)
`appear` (0.12 s scale/alpha-in) → `fill` 0 → 1 over `windup` → `flash` white for **0.12 s** → **resolve** (analytic hit check) → if `active > 0`, stay **live** for `active` seconds (checked every tick, its own damage tick rate) → fade out over 0.25 s.
Every telegraph honors the per-boss minimum: `windup ≥ boss.minWindup` (Boss 1 1.6 s, Boss 2 1.2 s, Boss 3 0.9 s), multiplied by 0.8 in enrage but never below 0.8 s.

### 5.3 `G.tele.spawn(opts)`
```js
G.tele.spawn({
  shape: 'band' | 'circle' | 'ring' | 'rect',   // band = track-space s/d rectangle (rendered in track shader, max 16 live)
                                                 // circle/ring/rect = decal quads (pool of 32)
  kind: 'damage'|'knock'|'gold'|'soak'|'lava',
  s, d,                 // center (band: use s0,s1,d0,d1 instead; d0/d1 default to full width)
  s0, s1, d0, d1,       // band only
  r, r0,                // circle radius; ring inner radius r0
  len, wid, rot,        // rect: length along s, width along d, rotation vs track tangent (rad)
  windup: 1.6, active: 0, tick: 0.5,
  dmg: 25, knock: 0 /*m lateral*/, spin: false, unblockable: false,
  follow: null,         // fn(dt, t) -> mutate {s,d,s0,s1} (moving telegraphs, e.g. spokes/sweeps)
  lead: false,          // if true and s omitted: s = kart.s + kart.speed*windup*0.9 (clamped by minWindup)
  sound: 'whine'|'drone'|'chime'|'choir'|null,
  noGraze: false,
  onResolve(hitPlayer, grazed){}, onLive(dt){}, onEnd(){}
}) -> handle {id, cancel(), t, fill, state:'fill'|'flash'|'live'|'done'}
```
- **Hit test** (track space, analytic): band → `inS && d in [d0-0.9, d1+0.9]`; circle → `hypot(ds(s,ks), d-kd) < r + 0.9`; ring → inside r+0.9 and outside r0−0.9; rect → transform into local frame and do an AABB test with 0.9 padding. `h > 2.0` (airborne) avoids ground telegraphs unless `opts.tall`.
- `soak` kind: at resolve, the player is "in" if inside → `onResolve(true)`. The boss module handles the failure (usually raid-wide damage through `G.combat.hitPlayer`).
- Band slots: COMBAT owns the 16 `uHaz` slots. Live zones (§5.4) also use slots. If more than 16 are requested, the oldest gold/lava zone visuals are dropped first (logic continues).
- **Decal pool:** one `InstancedMesh` of 32 quads with per-instance attributes `iShape` (0 circle, 1 ring, 2 rect), `iKind`, `iFill`, `iFlash`, `iParam` (r0/r, aspect, alpha). Each quad is oriented in the track frame at (s, d) (`P + R·d + N·0.06`). Material: transparent, depthWrite false, polygonOffset −2, additive edges and alpha-blended fill. Inactive instances get scale 0.
- **Off-screen threat arrows** (UI): for any damage/knock telegraph resolving within 2 s whose world position is outside the view frustum or behind the camera, show a red chevron at the screen edge (pooled DOM, max 6).
- **Audio:** a positional "pip" (StereoPanner by angle to the kart, pitch rising with fill) every 0.25 → 0.08 s, plus the sound-cue type.

### 5.4 Zones (persistent effects) `G.zones.add`
```js
{ type:'lava'|'slow'|'oil'|'pull'|'void'|'drift',  s0, s1, d0, d1,  until /*sim time*/ | dur,
  dps, instant /*dmg on entry*/, slow /*top speed mult*/, pull /*m/s lateral, signed d*/, push:'nearestEdge',
  visual:true /*uses a band slot with kind lava/knock*/ }
```
- `lava`: on entry, `instant` damage (15) + bounce: d is pushed toward the nearest safe edge at 10 m/s for 0.3 s.
- `slow`: top speed × slow, plus dps.
- `oil`: spin-out on entry (no damage).
- `pull`: adds `pull` to ddot (inward pull = negative). Drifting against it gives charge ×1.5.
- `void`: like a gap (falling).

### 5.5 Obstacles (moving hitboxes) `G.obstacles.add`
```js
{ s, d, h:0, r:2.5, vs:0 /*m/s along s, can be negative*/, vd:0, life:Infinity,
  dmg:20, spin:false, knock:0, dashable:true /*Arc Dash destroys -> onDestroyed*/, lanceable:false,
  mesh /*Object3D, positioned by combat each frame from (s,d,h) unless mesh.userData.manual*/,
  megaGraze:false, grazeR:4, onHit(){}, onDestroyed(){}, update(dt, self){} }
```
Collision: a cylinder in (s, d) with height h ± 1.5. A hit is applied once per 0.6 s per obstacle.

### 5.6 Gates `G.gates.add`
```js
{ s, d, r:4, kind:'gold'|'red'|'pylon'|'breach', life, needBoost:false,
  mesh, onPass(boosting){} }
```
A gate counts as passed when the kart crosses its s while within `|d − gate.d| < r`. Combat handles the visuals for standard kinds: a torus hoop (gold emissive ×3, red with an electric shader), and for `pylon` a 6 m tall gold pillar with a lightning crown.

### 5.7 Items `G.items`
- Box rows are defined by the arena (`itemRows`). Each row has 3 boxes at lane centers. A pickup radius of 2 m starts a 1.0 s slot roll (UI). Boxes respawn after 6 s. One item is held at a time.
- **Roll weights** (base): Seeker 30, Nitro 25, Prism 20, Jammer 15, Repair 10.
  - Hull < 40: Prism 35, Repair 30.
  - Boss currently casting or about to cast (an interruptible cast within 4 s in the rotation): Jammer ×2.
  - Boss staggered: Seeker ×2.

| Item | Effect |
|---|---|
| **Seeker Rocket** | Launches forward, arcs onto the best weak point: 180 dmg, +15% stagger |
| **Nitro Can ×3** | 3 taps, each +14 m/s for 1.0 s |
| **Prism Shield** | Bubble lasting 10 s. Absorbs one hit fully (including unblockable "CHECKERED" in Boss 3), then reflects a 60 dmg shard at the boss |
| **Jammer** | Interrupts the current interruptible cast **or any non-final cast** (that telegraph fizzles) and gives +25% stagger. With no cast active: +10% stagger and a small 60 dmg zap |
| **Repair Kit** | +35 hull over 1 s |

---

## 6. Boss framework (06_combat.js)

### 6.1 Boss definition
```js
boss: {
  hp: 7000, minWindup: 1.6, softEnrage: 210, hardEnrage: 255,   // seconds of fight time
  staggerDur: 6, staggerDecayMult: 0.85,   // each subsequent stagger needs bar fill rate × 0.85
  targets: [ {id:'body', node: Object3D, mult:1.0, always:true},
             {id:'vents', node, mult:1.5, weak:true, isExposed:()=>bool},
             {id:'core', node, mult:2.0, weak:true, isExposed:()=>boss.staggered},
             {id:'node3', node, hp:450, onDestroyed(){...}} ],   // optional sub-HP targets (damage goes to target hp, not main; onDestroyed applies main dmg)
  phases: [
    { name:'WARM-UP BOUT', at:1.0, enter(boss){}, exit(boss){},
      rotation: [ {t:0, a:'palm'}, {t:3, a:'vents'}, {t:9, a:'palm'}, {t:14, a:'stomp'}, ... ], loop: 20, jitter: 0.5,
      update(boss, dt){} },
    { name:'STOKE THE FURNACE', at:0.60, ...},
    { name:'OVERHEAT', at:0.25, ...}
  ],
  attacks: { palm(boss, params){...}, vents(boss){...}, ... },   // functions that call G.tele / G.obstacles / G.zones / boss.cast
  onSoftEnrage(boss){}, onHardEnrage(boss){},   // hard = wipe sequence
  intro(boss, t){}, death(boss, t){} ,            // cinematic hooks
  update(boss, dt){}                               // animation every tick (facing, idle)
}
```

### 6.2 Boss instance (`G.boss`)
Fields: `hp, maxHp, phase, phaseName, t /*fight time*/, stagger /*0..1*/, staggered, staggerT, staggerCount, enrage /*0,1,2*/, invulnT, cast /*{name,t,dur,interruptible}*/, targets, def, root /*Object3D*/, alive, rotT`.
Methods:
- `damage(amount, opts)`: applies the target multiplier (weak and exposed → mult; staggered: core ×2.0, everything else ×1.25). Blocked during `invulnT`. Sub-target HP routes damage. Emits `boss:damaged`. Checks phase thresholds.
- `addStagger(frac)`: frac is a fraction of the bar (×1/0.85^staggerCount). At ≥1 → `startStagger(dur)`.
- `startStagger(dur=def.staggerDur, scripted=false)`: `staggered=true`, cancels the current cast and all **unresolved non-live** telegraphs (they fizzle), pauses the rotation, emits `boss:stagger {on:true}`, calls the "BREAK!" slam and the boss module's `onStagger` animation. At the end: bar → 0, `staggerCount++`, rotation resumes.
- `cast(name, dur, {interruptible, onComplete, onInterrupt})`: shows the cast bar and emits `boss:cast`. `interrupt()` succeeds if `interruptible` (by a T3 volley crit bolt hit, an Arc Dash through the head, or Jammer) → `onInterrupt`, +20% stagger, +20 Flux to the player, "INTERRUPTED!". Jammer can also cancel non-interruptible casts unless `final:true`.
- `setPhase(i)`: phase transition = `invulnT = 2.5`, clears all telegraphs, obstacles (unless `persist`) and zones flagged `phaseClear`, banner "PHASE 2 - STOKE THE FURNACE", boss roar sfx, music layer +1, trauma 0.6, camera pull-out 2 m for 2 s. **The player keeps control and gets 2.5 s of i-frames.** Each phase is a checkpoint.
- **Phase thresholds:** at HP ≤ `maxHp * phase.at` of the next phase. Damage that overflows past a threshold is clamped to the threshold (no skipping phases).
- **Rotation scheduler:** each phase has `rotation` entries `{t, a, p}` with `loop` seconds. Entry times get uniform ±`jitter` (seeded). The scheduler pauses while staggered, during phase transitions and while `cast` is active and `blocking`. Boss modules may also schedule ad-hoc things in `update`.
- **Enrage:** at `softEnrage` fight time: `enrage = 1`, `uEnrage → 1` on the track and sky, music enrage layer, windups ×0.8, damage ×1.5, "ENRAGE" callout, then `def.onSoftEnrage`. At `hardEnrage`: `enrage = 2` → `def.onHardEnrage` runs an unavoidable wipe over 4 s (the kart takes 999 unblockable damage).
- **Guaranteed Comet stage:** every phase includes at least one scripted `startStagger(…, true)` (listed per boss), so Comet always has a stage even if the Stagger bar is not filled.

### 6.3 Targeting (`best target`)
Bolts and Seekers pick, in order: (1) the exposed weak target nearest to the camera's forward direction within a 35° cone, (2) any exposed weak target, (3) the boss's `always` body target. Each bolt re-evaluates when it spawns. A target must be within **range 150 m** (Boss 2 shows a RANGE chevron in red when it is out of range, and bolts then fizzle at max range).

### 6.4 Damage budget (tuning reference)
A good player gets about 36 dps from volleys (mostly T2/T3 every ~3 s at ~75% uptime) + ~6 dps from items + staggers (~1,100-1,300 per stagger including Comet). Expected: B1 7,000 HP ≈ 2:15, B2 10,500 ≈ 3:00, B3 14,000 ≈ 3:30. `__game.state().dps` exposes a rolling 10 s dps for tuning.

### 6.5 Stagger presentation (shared)
"BREAK!" slam text (gold, italic, 900 weight, scale punch 1.6 → 1.0), gold bloom burst (bloom strength +0.8 for 0.4 s), dolly-zoom (FOV +10 and the camera moves in 2 m over 0.5 s), trauma 0.5, the core target glows gold (emissive ×4), and the Comet button lights up if Flux is 100. The HUD Stagger bar shows a draining timer.

---

## 7. BOSS 1: BRASSHOLLOW, the Furnace Sumo (09_boss1.js)

*Teaches: drift-fire, decals, grazing, hopping, interrupts, Stagger, Comet.* HP **7,000**. `minWindup 1.6`. Target kill 2:15. **Soft enrage 3:30, hard enrage 4:15.**

### 7.1 Arena: EMBER BOWL
- Stadium loop: straights of 120 m, curve radius 55 m (centerline), **L ≈ 586 m** (a lap of ~16 s). Width 18 m. Curves banked 8°. s = 0 is the start of the south straight (lap gate), heading +x.
- **Boost pads:** 2 per straight (s offsets 30 and 80 into each straight, lane alternating 0 / +1). **Jump ramp** at the far (north) straight 60 m in, kick 9, followed by an **8 m lava gap** (`gaps:[{s0, s1}]`, lit by orange underglow). Item rows 15 m after each curve exit.
- Inside the oval is the lava crater: a large disc with a lava shader (domain-warped fbm, a dark crust crack pattern, emissive orange `#ff5a00` × 2.5 in the cracks, slowly churning). The boss sits on an obsidian pedestal at the center. The outside is a low glowing rail and volcanic cliffs (instanced low-poly rocks, ~40), a few lava falls (scrolling shader planes).
- **Sky `ember`:** smoky orange dusk gradient (`#2a0d05` → `#ff6a1a` at the horizon), fbm smoke bands, and 600 ember particles rising (fx ambient emitter). Fog color `#2a0d05`, 80-420.
- Music: 140 bpm, **Phrygian (E)**, industrial kick, saw bass.

### 7.2 Look
A 22 m tall brass sumo automaton sitting cross-legged in the crater. Its belly is a big round furnace door (the `core` target; it glows orange through the grille). Two piston arms with huge flat palms. Shoulder steam vents (`vents`: 2 weak points with gold glow when open). A boiler-plate topknot. Two red eye slits. Built from lathe, cylinder and box primitives with MeshStandardMaterial: brass `#b08a3a`, metalness 0.9, roughness 0.35, plus a CanvasTexture rivet/plate emissive map where the seams glow orange. It turns (yaw only) to face the kart with a 0.6 s lag.

### 7.3 Phase 1 (100-60%) "WARM-UP BOUT" — rotation loop 20 s
- **`palm` Palm Strike** (t=0, t=10): the arm rises (0.4 s), then a `rect` telegraph `len 10, wid 16` (full width) at `lead:true` (kart predicted 1.6 s ahead). windup 1.6 → 25 dmg + 0.4 s wobble. The palm mesh slams down onto the track at the rect (trauma 0.4 when you are within 40 m) and lifts after 0.8 s. *Dodge by braking or boosting; grazes are easy.*
- **`vents` Steam Vents** (t=4): 3 `circle` r 4 telegraphs placed on lanes in s range [kart.s+50, kart.s+110], windup 2.0, active 1.5 (geysers: particle columns 10 m tall, 15 dmg + `vh = 7` pop-up). After the eruption the **shoulder vents open for 3 s** (weak ×1.5, gold).
- **`stomp` Stomp Shockwave** (t=14): the boss stomps. A purple `knock` ring expands from the boss center at 14 m/s. It is implemented as an obstacle-like ring: `G.combat` checks the kart's world distance to the boss center against the ring radius ± 0.8 when `h < 1.2`. The telegraph is a purple ring decal 1.6 s ahead along the kart's predicted crossing. **Hop over it** (or dash) → clean clear = +10 Flux and +6% stagger. Hit = 20 dmg + 0.6 s spin.
- **Interruptible cast `BELLOWS`** (t=17, 2.5 s, purple cast bar "REDLINE TO INTERRUPT"): if not interrupted, a band of **fire** covers the full track width over s [kart.s+40, kart.s+90] for 4 s (live damage 10/0.5 s). Interrupting it → the boss coughs, then a scripted **4 s stagger**. *First time only: a tutorial prompt "Release a VIOLET drift to interrupt!"*
- **Guaranteed stagger:** the interrupt, or else after the second `stomp` cleared in this phase a scripted 4 s "steam purge" stagger.

### 7.4 Phase 2 (60-25%) "STOKE THE FURNACE" — rotation loop 24 s
Transition set piece: the boss slams both palms; the inner lava rises and floods **the inner lane on the north curve permanently** (`zones.add({type:'lava', s0, s1, d0:-9, d1:-3, instant:15})`). The belly door opens a crack: the core is visible but armored. **Three T3 volleys on the core = a 6 s stagger** (in addition to the normal bar).
- **`piston` Piston Barrage** (t=0): 4 `band`s, each 30 m long and full width, in sequence **ahead of the kart and moving in its driving direction**: band k at s = kart.s + 40 + 35k, windup 1.6 + 0.6k. You must outrun them (boost pads are on that line) or slow down behind them. Outrunning all 4 without being hit → +20 Flux "OUTRAN!". 25 dmg each.
- **`spill` Molten Spill** (t=7): 2 `lava` bands, each half the track width (inner or outer half, chosen opposite to the pad lanes) and 40 m long, telegraph 1.8 s, then a lava zone for 6 s (15 instant + bounce). The open half always contains a boost pad: *a reward for reading it*.
- **`oil` Oil Slicks** (t=12): 3 purple `circle` r 3 telegraphs (windup 1.6) → oil zones for 8 s (spin-out, no damage).
- **`palm` Palm Strike** every 8 s (t=4, t=16). **New in P2: the palm stays on the track for 3 s as a jump ramp** (`G.track.addRamp({s, len 6, kick 8, until})`, the palm mesh is tilted). Driving over it gives air + trick boost (D2 graft).
- **Interruptible `BELLOWS`** (t=20), as in P1.
- **Guaranteed stagger:** the core armor-crack mechanic (3 T3 hits), plus a scripted 5 s "furnace vent" stagger at the end of every second loop.

### 7.5 Phase 3 (25-0%) "OVERHEAT" — rotation loop 22 s
Transition: the boss stands up (the mesh rises 8 m, its legs unfold), its belly turns red hot, and the inner 4 m of the whole track becomes lava permanently (`d < −5`, so the track effectively narrows to 13 m; lane −1 is half gone). The music adds a lead.
- **`breath` Furnace Breath** (t=0): the boss breathes a fire stream (particle stream from the mouth to the band). The burning region is a `band` 40 m long, full width, that **sweeps along +s at 20 m/s** (`follow`), starting 60 m behind the kart. Its leading edge carries a red telegraph strip 1.6 s ahead (a separate band 30 m long moving with it). It lasts 6 s, live damage 15 per 0.5 s. Stay ahead of it (boost) or dash through it. **After each Breath the boss vents and is scripted-Staggered for 4 s** (the guaranteed Comet window).
- **`palm2` Double Palm** (t=9): two rects side by side (inner half and outer half), offset by 0.5 s, `lead:true`.
- **`heatwave` Heatwave (SOAK)** (t=14): 2 cyan `soak` circles r 6 appear on the track 3 s ahead, on opposite sides of the kart's predicted path (one at kart.s+70 lane −1, one at kart.s+110 lane +1). At resolve the boss pulses a raid-wide heat blast: if the kart is **not** inside either soak circle → 35 dmg. Inside → "+SOAKED" and +5 Flux. (D3 graft.)
- **`stomp`** every 11 s.
- **Soft enrage (3:30):** the oval glows red, stomps come every 6 s, Palm Strike does 40. **Hard enrage (4:15):** "MAGMA TIDE": the whole track floods over 4 s → wipe.

### 7.6 Death / finisher
The final hit gives a 1.0 s slow-mo at 0.2×. The boss's eyes go dark, the plates blow outward (400 instanced brass shards, `G.fx.shards`), the furnace explodes in a white-orange bloom (bloom strength 2.5 decaying), and the lava cools to dark crust across the shader (`uCool` 0 → 1 over 2 s).

### 7.7 Briefing tips (3)
1. "Release a drift to fire. VIOLET sparks deal the most and **interrupt** purple cast bars."
2. "HOP (tap DRIFT) over purple shockwaves."
3. "Skim the edge of red zones to GRAZE for Flux. Full Flux + BREAK = COMET."

### 7.8 Attack names exposed to `__game.triggerAttack`
`palm, vents, stomp, bellows, piston, spill, oil, breath, palm2, heatwave`.

---

## 8. BOSS 2: QUICKSILVER LEVIATHAN (10_boss2.js)

*The boss that races you. Teaches: chasing, moving weak points, threats from ahead and behind, delivering the debuff, gates.* HP **10,500**. `minWindup 1.2`. Target 3:00. **Soft enrage 4:15, hard 5:00.**

### 8.1 Arena: STRATOS RIBBON
- **A single banked loop in the sky (no figure-8, no overpass: judge fix).** A spline of ~10 control points with elevation changes of ±12 m and bank up to 15°. **L ≈ 760 m** (~21 s lap). Width 16 m. Suggested control points (x, y, z, width, bank°):
  `[0,0,-150,16,0], [140,4,-140,16,-12], [200,10,-40,16,-15], [170,14,70,16,-10], [80,8,130,16,0], [-20,2,110,16,10], [-90,-4,150,16,15], [-190,0,60,16,12], [-170,6,-70,16,-5], [-80,2,-150,16,0]`. Scale so L ≈ 760. It is CCW; the boss does not sit in the center here.
- **The long straight** (between points 0 and 1) ends in a **ramp + 14 m gap jump** (the "Sky Gap"). The gap is permanent and the ramp kicks 10. A boost pad sits in lane 0 just before the ramp, marked with a gold arrow decal.
- 3 boost-pad pairs, 1 long **Drift Zone** curve (cyan stripes painted on the surface, charge ×1.25), 2 item rows.
- Edges: no walls, an **energy rail** instead: crossing `|d| > W/2 − 0.9` bounces you back at 10 dmg (a cooldown of 1 s), with an electric flash.
- Surface `glass`: translucent deep blue `#0d1a33` with a hex-pulse grid (pulses from the kart's s outward, and along the track on each beat).
- **Sky `storm`:** a dome with violet-to-teal layered fbm clouds (2 octaves, the upper layer scrolls), a cloud sea far below (a large plane with an fbm shader, 400 m down), random lightning flashes every 4-9 s (sky and exposure +0.3 for 80 ms, a thunder sfx 0.5 s later), and instanced floating rock islands (~25) with rim lighting.
- Music: 150 bpm, **Dorian (D)**, synthwave arps.

### 8.2 Look and movement
- A chrome sky-serpent about 110 m long: **18 segments** in one InstancedMesh (hex-ring segments, chrome MeshStandard metalness 1.0, roughness 0.15, an env from a procedural CubeCamera-free gradient: use `scene.environment` from a PMREM of the sky scene rendered once). An electric-blue spine light runs through each segment (an emissive inner cylinder `#3fa9ff` × 3). The head is a separate mesh: a jagged visor and a four-way split mouth with a gold core inside.
- **Track-following:** the head has track-space `(sH, dH, hH)`. Segment i is at `s = sH − dir·i·6.2`, `d` from a 0.1 s history buffer of the head's d, and `h = hH + sin(t·2 + i·0.5)·1.2`. The world transform comes from the track frame. The body floats at `hH` 5-8 m in P1 (no contact), and the head dives to 1.5 m during Ram Charges.
- **Speed controller:** P1 keeps a target gap ahead of the kart of 55 m (`vH = kart.speed + clamp((sTarget − sH)*1.2, −15, 15)`, clamp 26-48 m/s).
- **Range:** bolts reach up to 150 m. The HUD shows a RANGE chevron.
- **Slipstream:** within 25 m behind the tail and |d − tail d| < 3 → +4 m/s, +8 Flux/s, drift charge ×1.1, wind-line particles.

### 8.3 Targets
- **6 Glowing Nodes** on the tail segments 12-17 (gold, **450 HP each**). Bolts lock on the **rearmost living node** in P1. Destroying a node: 300 main damage, +10% stagger, the segment goes dark, and that segment's attacks stop (each Node removes 1 mine from Chrome Scales).
- **Head/visor:** main HP target, ×1.0. **×1.5 when the visor is open** (it opens during Ram Charge passes, Coil, after the node phase and when staggered: core ×2).

### 8.4 Phase 1 (100-65%) "THE CHASE" — loop 22 s
- **`whip` Tail Whip** (t=0, t=11): the tail lashes across from one side: a purple `knock` band 25 m long, sweeping (follow) from the d edge on one side to the other over 0.5 s after a 1.4 s windup, starting at the tail's s. Hit: 20 dmg + 8 m lateral knock. Grazeable.
- **`scales` Chrome Scales** (t=4): the serpent sheds `4 + living nodes` mirror plates, which tumble back and land as **mines** (obstacles r 2.5, h 0, 1.2 s fuse shown as a red circle decal, then they arm; touching an armed mine → 20 dmg; mines explode after 8 s). Arc Dash destroys them (+5 Flux). Mines are placed in lanes ahead of the kart along s [kart.s+40, kart.s+120].
- **`lanes` Lightning Lanes** (t=8, t=18): one lane (1/3 of the width), as a `band` 60 m long ahead of the kart, crackles blue → windup 1.4, live 3 s (15 per 0.5 s + 0.3 s wobble).
- **`coil` COIL** DPS window (t=15, scripted stagger 5 s): the serpent arches into a giant loop over the track. Its head hangs low just ahead, with its visor open, inside a **gold Breach Gate** at its center (`gates.add({kind:'breach', needBoost:true})`: passing through while boosting = 250 dmg + 15% stagger, without boost = 80). This is the **guaranteed stagger** of P1.

### 8.5 Phase 2 (65-30%) "HEAD-ON" — loop 26 s
Transition: the serpent screeches and phases through a portal into the sky, then reappears **racing against you** (`dir = −1`, vH = 40 m/s). You meet it about every 10 s.
- **`ram` Ram Charge** (on every meeting): the head drops to h 1.5 and picks your lane. A **lane-wide red band 60 m long** in front of the head, moving with it, arms 1.2 s before the head reaches the kart (computed from the closing speed). Dodge by changing lane → if you pass within 4 m: **MEGA GRAZE** (§4.6). **Arc Dash through the visor head-on** → 150 dmg + 25% stagger + "HEADSHOT!" (inside the i-frames by design). Hit → 30 dmg + spin.
- **`gates` Coil Gates** (t=4): the body forms 4 hoops over the track in front of you (at s spaced 40 m apart, alternating lanes). Each hoop is gold or red, with the color revealed 2 s ahead. **Gold** (`needBoost` bonus): +12 m/s for 0.8 s, +8 Flux, +6% stagger (×2 stagger if boosting). **Red:** electrified (a red band at the hoop), 25 dmg. There is always a gold path through.
- **`brand` Conductor's Brand** (t=12, once per loop): a purple sigil on the kart with a **15 s** timer (a HUD ring above the kart plus a timer chip). A **gold Lightning Pylon** (`gates.add({kind:'pylon', r 3.5})`) spawns ~0.6 lap ahead (kart.s + 450) in a random lane, with a gold off-screen arrow. Driving through it → cleanses the brand, and the pylon fires a **thunderbolt into the head for 900 dmg** + 15% stagger (a huge lightning bolt fx, trauma 0.5). If it expires → 35 dmg and −30 Flux. (D3 graft.)
- **`acid` Acid Spit** (t=20): 3 lobbed globs (visible projectile arcs, 1.5 s flight) with landing `circle` r 5 telegraphs (windup 1.5), then 4 s **slow** puddles (×0.7 top speed + 5 dps).
- **Guaranteed stagger:** a successful Brand cleanse **or** a Headshot gives at least a 5 s stagger in that loop (if the bar does not fill, the boss is scripted-staggered after the cleanse, "OVERLOADED!").

### 8.6 Phase 3 (30-0%) "SPLIT SERPENT" — loop 24 s
Transition: the serpent tears in two. **Simplified split (judge fix): one head + a detached Tail Coil.**
- **Head** (the main HP, racing **against** you as in P2, with Ram Charges every meeting).
- **Tail Coil** (separate HP bar, **1,500 HP**, a gold tail-crystal target) races **with** you, about 40 m ahead, and does Tail Whips and Chrome Scales. Destroying the tail → 600 main damage, the head enrages early (+20% speed) and its **visor stays open** for the rest of the fight (×1.5 permanently).
- **`pincer` Pincer** (t=10): head and tail both converge on the **Sky Gap** ramp. The approach (s range of 60 m before the ramp) turns into a red band for all lanes **except lane 0**, which holds the pad and the ramp (gold arrow). Windup 1.5 s → electrified for 1.5 s (30 dmg). Take the pad and the ramp to clear it, or dash. Clearing it → +15 Flux.
- **`lanes`** every 8 s, **`acid`** every 16 s.
- **Guaranteed stagger:** every second Pincer cleared → the head and tail collide at the gap: a scripted 6 s stagger ("COLLISION!").
- **Soft enrage (4:15):** lightning `circle` r 3.5 strikes on the kart's predicted position every 0.8 s (windup 0.9). **Hard (5:00):** "WORLD-STORM": the whole ribbon electrifies → wipe.

### 8.7 Death
The serpent seizes and arches into a giant loop, then its segments unravel one by one with lightning arcs and chrome shards, and the storm clears to a dawn gradient (the sky's `uDawn` 0 → 1).

### 8.8 Briefing tips
1. "Stay in RANGE. Bolts lock onto the gold tail nodes."
2. "Head-on: switch lanes for a MEGA GRAZE, or DASH through the visor."
3. "Branded? Race to the GOLD PYLON before the timer ends."

Attacks: `whip, scales, lanes, coil, ram, gates, brand, acid, pincer`.

---

## 9. BOSS 3: VELOX, the Last Lap King (11_boss3.js)

*Final exam. Every system plus your own past laps.* HP **14,000**. `minWindup 0.9`. Target 3:30. **Soft enrage 5:00, hard 5:45.**

### 9.1 Arena: EVENT HORIZON CIRCUIT
- **Ring** with centerline radius 70 m (L ≈ 440 m, a ~12 s lap), width 18 m, flat, floating over a black hole accretion disk.
- 4 boost pads at the compass points (alternating lanes), item rows at 45° offsets, and 2 **ramp sites** at 120° and 300° that are only used when sections shatter in P3 (ramps get added there dynamically).
- Surface `chrome`: black with a white 4 m grid and chevrons that pulse to the beat.
- Center: Velox on a floating throne above a **black hole** (a pure black sphere r 14) surrounded by an **accretion disk** (a ring mesh r 16 → 55 under the track level, y = −6, with an additive shader: rotating spiral fbm bands, a doppler gradient from blue-white `#bfe3ff` on the approaching side to red-orange `#ff6a2a` on the receding side, intensity ×3). The FinalPass draws **screen-space lensing** around the projected black-hole center (`uLensPos`, `uLensStrength 0.06`, radial UV pull with `1/r²` falloff, clamped).
- **Sky `void`:** a deep-space nebula (fbm in purple `#2a0b4a` and teal `#0b3a4a`), a 2,000-star Points layer with twinkle, and 2 slowly rotating distant spiral galaxies (billboards with a procedural shader).
- Music: 160 bpm, **harmonic minor (A)**, choir pads, a breakbeat; P3 cuts to a heartbeat kick plus a clock tick.

### 9.2 Look
A 30 m crowned figure of dark glass on a floating throne. Body material: `onBeforeCompile`-injected **starfield** inside the glass (stars parallaxed from view direction hashes) with a fresnel rim of `#8fd7ff`. Four arms holding a giant **stopwatch** (its face is the `core` target), a checkered flag (a cloth plane with a vertex wave), a scepter and a mirror. **The crown: 8 floating, spinning gold clock hands** (`hand0..7`, each **250 HP**, gold emissive ×3, orbiting the head at r 6). Destroying a hand: 300 main damage + 20% stagger + a gold shard burst.

### 9.3 Phase 1 (100-70%) "COUNTDOWN" — loop 22 s
- **`spokes` Clock Spokes** (t=0): 2 (+1 per loop, up to 4) radial laser spokes from the center across the track. **Each spoke is a `band`**: full width, 3 m long in s, `follow` rotating at 0.3 rad/s (s advances at 0.3·70 = 21 m/s, opposite your direction on alternating spokes). Telegraph: a thin red line (band 0.5 m) for 0.9 s → live 3 m beams for 6 s (25 dmg on contact, 0.6 s i-frames). Graze ticks: +4 per 0.3 s up to +12 per spoke. Hop does **not** clear them (they are tall). Visual: an additive beam mesh from the center to the outer edge, plus spark particles where it crosses the track.
- **`starfall` Starfall** (t=8): 8 `circle` r 4 meteors clustered around the kart's predicted path 1.1 s ahead (windup 1.1, so ≥ minWindup), each meteor visibly falling (a streak mesh from the sky).
- **`ticktock` Tick-Tock** (t=15): a "TICK" sound plus a blue-white desaturation flash. For **0.8 s, all boss telegraphs, obstacles and boss animation freeze** (a pure freeze, no rewind: judge fix) while you keep moving. During the freeze the crown hands take ×1.5 damage. HUD: "TIME STOP" in blue.
- **`hourhand` Interruptible cast `HOUR HAND`** (t=18, 2.2 s): if not interrupted, the next spokes cast fires twice as many spokes. Interrupt → a scripted 5 s stagger (**the guaranteed stagger** of P1).

### 9.4 Phase 2 (70-35%) "GHOST LAPS" — loop 25 s
- **Phantom Racers (continuous):** ghost 1 replays your path from **8 s ago** (`G.ghosts.sampleAgo(8)`). After 60 s in the phase, ghost 2 replays **14 s ago**. Ghosts are translucent red copies of the kart (one InstancedMesh, fresnel additive red `#ff2a3a`, a ribbon trail). They are obstacles: r 1.6, 18 dmg + spin. **You must change your line every lap.** Ghost-free clean lap (no ghost contact for a full lap) → **shatter the oldest ghost**: +20% stagger, +15 Flux, a red shard burst. It respawns 12 s later.
- **`ghostlance` Ghost Lances** (t=5, t=17): each ghost "fires" 2 red bolts that land as `circle` r 3 telegraphs on the kart's predicted position 1.0 s ahead (windup 1.0).
- **`decree` Mirror Decree** (t=9): the lane-line colors flip. A **FORBIDDEN HALF** (inner or outer half of the track) is a red band 1.2 s ahead, live for 5 s along s [kart.s − 30, kart.s + 220] (follow keeps it ahead of the kart). 20 per 0.5 s. You have to cross lanes between ghosts.
- **`gravity` Gravity Pull** (t=14): a purple swirl band on the inner edge (1.5 s telegraph), then for 3 s a `pull` zone covering the whole lap at −6 m/s lateral (inward). Drifting outward against it charges ×1.5. Being dragged into the inner edge rail does nothing beyond a scrape (there is no lava). The pull is dangerous only because it combines with the other mechanics.
- **`pulse` Event Pulse (SOAK)** (t=21): 2 cyan soak circles r 6, 3 s ahead. Miss both → 35 dmg.
- **Guaranteed stagger:** at the end of every second loop, the boss casts "REWIND" and fails ("THE CLOCK STUTTERS") → a scripted 5 s stagger.
- Crown hands keep orbiting. Hands 0-3 are the "first set" and 4-7 the "second set".

### 9.5 Phase 3 (35-0%) "FINAL LAP" — loop 20 s
Transition: Velox stands up from his throne. **Eclipse palette:** the FinalPass sets `uMono → 0.85`, which desaturates everything except very bright saturated emissives (telegraphs, the kart's trims, weak points and bolts stay in color; see §10.2). A giant **countdown clock** appears in the sky (a ring mesh with a sweep shader plus a DOM big number) counting **45 s**.
- **`checkered` CHECKERED** (when the clock hits 0, then repeating every 45 s): **6 s before** zero, 2 cyan **"PIT BOX"** soak circles r 7 appear ahead on the track (on opposite lanes, 80 m and 160 m ahead, slowly drifting with you so they stay reachable). At zero: a white flash and a checkered-pattern shockwave. If the kart is inside a Pit Box, **or** mid-Comet, **or** under a Prism Shield, **or** in Perfect Dash i-frames → safe ("SURVIVED THE CLOCK!", +20 Flux). Otherwise **120 dmg (unblockable)**. This is the hard check, and it is skill-based rather than gated by RNG (judge fix). After each CHECKERED, Velox overwinds → **a scripted 5 s stagger** (the guaranteed Comet stage).
- **`shatter` Shattering Ring** (t=3, t=13): a 30 m section of track 120-200 m ahead cracks (a crack shader band with red flicker, 1.5 s) → becomes a **gap** (`G.track.setGap`, `until` +12 s). A ramp and a boost pad are added 6 m before it (`addRamp`, kick 9). **At most 2 gaps at once.** Falling = 15 dmg + respawn.
- **Spokes** at 0.6 rad/s (2 spokes, 0.9 s line telegraph) + **Starfall** + **ghost 1 (8 s ago)** returns.
- **Desperation Stagger:** when the last living hand of a set of 4 is destroyed → a 7 s stagger ("CROWN BROKEN!").
- **Soft enrage (5:00):** spokes ×2 speed, Starfall every 6 s. **Hard (5:45):** "SINGULARITY": the black hole swallows the ring from the inner edge outward over 4 s → wipe.

### 9.6 Death / final finale
At 0 HP: time freezes (scale 0.05) and the camera orbits the kart for 2 s. Then a cinematic: a **light bridge** (an additive ribbon) rises from the track into the stopwatch core and the kart drives up it automatically (2 s). On impact: a white-out (flash 1.0), the black hole collapses into a newborn star (the disk shader transitions to a bright white-gold star sprite with a bloom of 3.0), the nebula gains color, and fireworks start (particles). Then the credits lap.

### 9.7 Briefing tips
1. "Your GHOSTS replay your path from 8 s ago. Change your line every lap."
2. "When the clock hits zero, be in a cyan PIT BOX (or mid-COMET)."
3. "Break the 8 crown hands. Break all 4 of a set for a long BREAK."

Attacks: `spokes, starfall, ticktock, hourhand, ghostlance, decree, gravity, pulse, checkered, shatter`.

---

## 10. FX, shaders, post, performance (01_core.js + 04_fx.js)

### 10.1 Renderer
`new WebGLRenderer({antialias:false, powerPreference:'high-performance', stencil:false})`, `toneMapping = ACESFilmicToneMapping`, `toneMappingExposure 1.0`, output sRGB (OutputPass handles both). `setClearColor` per sky. No shadow maps (a blob shadow quad under the kart and the boss).
Lights: 1 HemisphereLight + 1 DirectionalLight (no shadows) + `scene.environment` from a PMREM of a quick gradient sky scene, generated once per arena. Glow comes from emissive materials and bloom, never from dynamic point lights.

### 10.2 Post chain (3 passes + output)
`RenderPass` → `UnrealBloomPass` (**half resolution**: construct with `new Vector2(w/2, h/2)`, strength 0.9, radius 0.55, threshold 0.78; events may push strength up to 2.5 with decay) → **FinalPass** (ShaderPass, one shader) → `OutputPass`.
FinalPass uniforms (`G.post.*` setters): `uSpeed` (0..1 = (speed − 30)/22), `uCA` (chromatic aberration 0..0.008), `uFlash` (vec4 rgb + amount), `uVignette` (0.25 base), `uDamage` (red pulse when hull < 30%), `uLensPos` (vec2 screen), `uLensStr`, `uMono` (0..1), `uShock` (vec3: screen pos xy + radius for a ripple ring), `uTint` (vec3 grade per arena), `uTime`.
- **Radial speed blur:** 6 taps toward the center, strength `uSpeed²·0.035`, masked to the outer 60% of the screen.
- **Speed lines:** procedural angular streaks: `hash(floor(angle*90))` thresholded, scrolled by time, masked radially, alpha `uSpeed`.
- **CA:** r/b offsets along the radial direction.
- **Lens:** `uv += normalize(uv-uLensPos) * uLensStr / max(dot(dv,dv)*40, 0.4)`, applied before sampling.
- **Mono (eclipse):** `float sat = max(c.r,max(c.g,c.b)) - min(...); float keep = smoothstep(0.55, 0.9, sat) * smoothstep(0.5, 1.2, max(c.r,max(c.g,c.b))); c = mix(c, vec3(luma), uMono * (1.0 - keep));` → telegraphs, trims and weak points (bright and saturated) keep their color.
- **Shock ripple:** a refractive ring around `uShock` for stomps and Comet impacts.
- Vignette, damage pulse, flash: last.

### 10.3 Adaptive quality
- `dpr` starts at `min(devicePixelRatio, 1.5)` on mobile (`matchMedia('(pointer:coarse)')`) and at `min(dpr, 2)` on desktop.
- Every frame, track a rolling 30-frame average of the frame time: **> 19 ms → dpr −= 0.1** (floor 0.55; 1.5 s cooldown between steps); **< 14 ms for 2 s → dpr += 0.05** (ceiling as above). Apply with `renderer.setPixelRatio` + `composer.setPixelRatio` + bloom resize.
- **Tiers** (auto: start `high` on desktop, `med` on coarse pointers; drop one tier automatically if dpr sits at the floor for 4 s):
  - **high:** bloom half res, 3,000 particles, sky fbm 2 octaves, stars 2,000, lens on.
  - **med:** bloom half res with fewer mips (strength unchanged), 1,600 particles, sky 1 octave + 1,000 stars.
  - **low:** bloom quarter res, 800 particles, speed blur 3 taps, no galaxies, 500 stars.
- Budget: **< 120 draw calls, < 250k triangles**. Merge static scenery with `BufferGeometryUtils.mergeGeometries`. Instance rocks, pylons, item boxes and serpent segments.

### 10.4 Particles (04_fx.js)
- One `InstancedMesh` of camera-facing quads (PlaneGeometry 1×1) with a custom shader: per-instance attributes `iColor` (rgb), `iAlpha`, `iSize`. Soft round falloff computed in the shader, additive. **CPU simulation in typed arrays** (pos, vel, life, maxLife, size0/1, color, drag, gravity). It writes `instanceMatrix` (translation + scale only; billboarding happens in the vertex shader using the camera right/up uniforms) and the attributes for live particles; `mesh.count = live`.
- A second, smaller **alpha-blended** pool (400) for smoke and dust.
- Emitter presets (`G.fx.burst(type, pos, opts)` / `G.fx.emit`): `driftSpark` (tier color, 40/s per rear wheel), `tireSmoke`, `boostFlame`, `wallSpark`, `hit` (white-red), `boltImpact` (tier color), `ember` (ambient), `lavaSplash`, `steam`, `chrome` (debris), `lightning` (bright line sparks), `starDust`, `ghostShatter` (red), `gold` (stagger), `comet` (huge), `firework`.
- **Bolts and ribbons:** a pool of 64 bolt heads (instanced capsules) + 64 ribbon trails (a ring-buffer BufferGeometry of 16 segments each, additive, width tapering).
- **Lightning bolts:** midpoint-displaced polylines rebuilt into one pooled line-ribbon geometry (max 8 bolts), additive, 0.15 s life.
- **Shards:** an InstancedMesh of 400 tetrahedra with CPU physics (velocity, spin, gravity, 3 s life), colored per boss.
- **Damage numbers:** a CanvasTexture atlas (digits 0-9, "!", "+", and the words CRIT and WEAK) on one InstancedMesh of sprites (pool 40). They rise 2 m and fade over 0.8 s. Colors: white normal, gold weak, violet crit, red player damage.
- **Speed lines (3D):** 60 instanced stretched quads in a cylinder around the camera. Opacity = `uSpeed`, they streak backward. On low quality, rely on the FinalPass lines only.
- **Screen shake:** trauma model. `offset = trauma² × (0.6 m position, 2.5° roll)` from 3-octave value noise at 25 Hz; trauma decays at 1.6/s. Gains: hit 0.35, stomp 0.5, Comet impact 0.8, T3 volley 0.15, landing 0.1, phase change 0.6, nearby palm slam 0.4. Settings has a "reduce shake" option (×0.4).
- **Hit-stop:** `G.time.hitstop(ms)` ≤ 120 ms (stagger burst 90 ms, Comet 120, T3 90, T2 60, T1 40). Camera shake keeps running.

### 10.5 Sky shaders (`G.sky.set`)
One inverted sphere r 900 with `depthWrite false`. Each sky is a ShaderMaterial variant: `ember`, `storm`, `void`, `warp` (the tunnel: see flow) and `title` (a neon grid horizon with a sunset). All are fbm-based with ≤ 2 octaves on high.

### 10.6 Color palette summary
UI cyan `#33f6ff`, magenta `#ff3df2`, gold `#ffc93a`, danger red `#ff2a3a`, violet `#c04bff`, ink `#0a0d1a`. Boss accents: B1 orange `#ff6a1a`, B2 electric blue `#3fa9ff` and chrome, B3 starlight `#8fd7ff` and gold.

---

## 11. Audio (03_audio.js)

All WebAudio, created on the first user gesture (`G.audio.unlock()`). Master chain: sfxGain + musicGain → DynamicsCompressor (threshold −14, ratio 4) → master gain → destination. Mute toggle. `?mute=1` and `?test=1` skip audio entirely (all calls become no-ops).
- **Engine:** 2 detuned saws (60 → 220 Hz mapped to speed) → lowpass (400 → 2,400 Hz) → a soft WaveShaper. Boost adds an octave-up oscillator + filtered noise. Drift adds band-passed noise screech whose gain follows slip.
- **SFX (`G.audio.sfx(name, {pan, pitch, vol})`):** `tier1/2/3` (sine + FM bell chimes C5, G5, C6), `release` (a down-sweep zap 1,200 → 200 Hz + click), `boltHit` (kick + crunch), `graze` (3 kHz ting + reverse whoosh; music lowpass dips to 800 Hz for 0.25 s), `perfect` (glass bell + tape-stop), `megaGraze`, `dash` (reverse swoosh), `overclock` (riser), `comet` (big riser → impact boom, sub drop), `hit` (noise burst + distorted sine), `wreck`, `pad` (whoosh), `itemRoll` (ticks), `itemGet`, `telePip`, `teleWhine`, `teleDrone`, `chime`, `choir`, `roar` (formant-filtered saw, boss voice), `stomp`, `thunder`, `laser`, `tick`, `tock`, `break` (gold crash), `enrage` (alarm), `countdown` (beeps + GO), `lap`, `uiClick`.
- **Music:** a lookahead step sequencer (25 ms timer, 0.1 s ahead) with 16-step patterns: kick (sine sweep 150 → 40 Hz), snare (noise + 200 Hz body), hats (high-passed noise), bass (saw + filter envelope), arp lead (square), pad (stacked detuned saws through a slow LFO lowpass).
  - Tracks: `title` (110 bpm, calm), `boss1` (140 bpm, E Phrygian), `boss2` (150 bpm, D Dorian), `boss3` (160 bpm, A harmonic minor), `warp`, `victory`.
  - Layers: phase 1 = drums + bass, phase 2 adds the arp, phase 3 adds the lead + pad. Overclock adds hats. Enrage doubles the hats and adds a siren. P3 of Boss 3 strips down to a heartbeat kick and clock ticks until the last 30% of the clock.
  - `G.audio.beat` (0..1 phase of the quarter-note) drives `uBeat` in the track and skies.

---

## 12. Input (02_input.js)

Unified actions: `steer` (−1..1), `throttle` (0..1), `brake` (bool), `drift` (held), `dash`, `ability` (Overclock/Comet slot), `item`, `pause`. Edge-triggered `pressed[a]` and `released[a]` per fixed step.

### 12.1 Touch (landscape)
- **Left 45% of the screen: a floating stick.** It appears where the thumb lands. Radius 60 CSS px, deadzone 10%, curve `steer = sign(x)·|x|^1.5`. **Auto-throttle ON** by default. Stick y < −0.55 (pulled down) = brake/reverse.
- **Right thumb arc** (all inside `env(safe-area-inset-*)`), responding on `pointerdown`, tracked by `pointerId`, `touch-action:none`:
  - **DRIFT**: 104 px, bottom right (24 px from the edges). A tier color ring fills as you charge. Hold = drift, tap = hop.
  - **DASH**: 76 px, up-left of DRIFT. A cooldown sweep, a free-charge pip, and the Flux cost.
  - **OVERCLOCK / COMET**: 72 px, above DRIFT. It becomes a 96 px pulsing gold COMET button when Comet is available.
  - **ITEM**: 64 px, left of DRIFT. It shows the item icon (an inline SVG).
  - Only 4 buttons total (judge fix).
- **Pause**: a 44 px button at top left.
- **Haptics** (`navigator.vibrate`, guarded): tier-up 10 ms, hit 25 ms, Comet `[40,20,40]`, Perfect 15 ms.
- **Portrait overlay:** "Rotate your device" with an animated phone icon when `innerHeight > innerWidth` on coarse pointers. The game auto-pauses while it shows.
- **Auto-pause** on `visibilitychange` (hidden) and on blur.

### 12.2 Keyboard
| Action | Keys |
|---|---|
| Steer | A/D, ←/→ |
| Throttle | W/↑ (auto-throttle is on by default; toggle in settings) |
| Brake / reverse | S/↓ |
| Drift / hop / trick | Space or Shift |
| Arc Dash | J or K |
| Overclock / Comet | L or Q |
| Item | E or I |
| Pause | Esc / P |
| Retry (defeat screen) | R |

Gamepad (bonus): left stick, A = drift, X = dash, Y = Overclock/Comet, B = item, RB = drift alt, Start = pause.

### 12.3 Injected input (testing)
`G.input.inject = { steer, throttle, brake, drift, dash, ability, item }`: when any field is non-null, it overrides the real input. Used by `__game.input` (§14).

---

## 13. UI, HUD and flow (00_head.html + 08_ui.js)

### 13.1 HUD (DOM overlay, CSS transforms only; update text at most at 15 Hz except bars)
- **Top center:** boss name plate (italic 900) + title, a **HP bar** (520 px desktop / 60vw mobile; segmented at phase thresholds; a white delayed "chip" trail; color shifts per phase), **sub-target bars** (Boss 2 Tail Coil, Boss 3 crown hands as 8 small pips), the **gold Stagger bar** under it (it drains while staggered), the **cast bar** under that (purple border + "REDLINE TO INTERRUPT" when interruptible, grey otherwise, with the ability name in big type), the phase label, and the **enrage timer** on the right (red under 30 s).
- **Top left:** pause, **Pit Credits** (3 kart icons), the lap counter.
- **Bottom left** (above the stick zone; fades to 40% while the stick is active): a **speedometer** dial with the **Flux ring** around it (markers at 25/50/100), the hull bar (segmented by 10), and the drift tier indicator.
- **Kart-relative (projected):** the Brand timer ring above the kart, graze pops, the Boss 2 RANGE chevron, the Boss 3 ghost warnings.
- **Callouts:** `G.ui.callout(text, style)` styles: `break` (gold slam), `graze` (small white), `perfect` (cyan), `danger` (red), `phase` (banner with a subtitle), `enrage` (red pulsing), `lap` (cyan), `interrupt` (violet). Max 3 stacked; they last 0.8-1.5 s.
- **Off-screen threat arrows** (pooled 6) and the **pylon arrow** (gold).
- **Damage flash** vignette is done in post.
- `document.body.dataset.mode = G.flow.state` (for Playwright). Key element ids: `#btn-start`, `#hud`, `#boss-hp`, `#boss-name`, `#cast-bar`, `#stagger-bar`, `#flux`, `#hull`, `#btn-drift`, `#btn-dash`, `#btn-ability`, `#btn-item`, `#btn-pause`, `#screen-title`, `#screen-briefing`, `#screen-results`, `#screen-garage`, `#screen-defeat`, `#btn-retry`, `#btn-restart`, `#btn-next`, `#btn-quit`, `#settings`.

### 13.2 Flow states (`G.flow.go`)
`title → (tutorial, first run only, skippable) → briefing → intro → countdown → fight → (transition handled inside fight) → victory → results → garage → warp → briefing (next) ... → finale → credits`, plus `defeat` and `paused` overlays.

1. **title:** the kart idles on a turntable over a neon grid (sky `title`). The "DRIFTBREAKER" logo has a CSS chromatic glitch and the subtitle "REDLINE RAID". "TAP / PRESS ANY KEY" unlocks audio. Settings: quality (Auto/High/Med/Low), auto-throttle, drift assist, reduce shake, colorblind patterns (always on; this toggle makes them thicker), music and sfx volume, difficulty (**Story** 0.8× game speed and ×0.7 boss damage, **Raid** default, **Mythic** ×1.3 HP and enrage 20% sooner; unlocked after a clear).
2. **tutorial (40 s, skippable, remembered in localStorage):** a free lap on the Ember Bowl with the boss dormant and prompts: "Hold DRIFT through the curve" → "Release to fire" (a dummy target on the boss) → "Tap DRIFT to HOP the ring" (one slow shockwave) → "Skim the red edge to GRAZE" (one telegraph) → "DASH through" → then Brasshollow's eyes open.
3. **briefing:** the boss name card, a live render of the boss (the main camera orbiting it), 3 mechanic tips (§7.7, §8.8, §9.7), and a "FIGHT" button (any key or tap). The arena is already built.
4. **intro (4 s, skippable by tap):** a camera flyby around the boss, a name slam, the boss roar.
5. **countdown:** 3-2-1-GO with the launch boost window (§4.9). The music starts on GO's downbeat.
6. **fight.**
7. **victory:** the death cinematic (§7.6, §8.7, §9.6) → **results**: time, hits taken, grazes, Perfect Dashes, Comets landed, interrupts, credits used, grade **S/A/B/C** (S: under the target time with ≤ 3 hits and no checkpoint retry; checkpoint retries cap at B). Then the **garage**.
8. **garage (skippable after 2 s):** pick 1 of 3 random **Mods** from 6:
   - *Capacitor*: drift tiers charge 15% faster.
   - *Graze Magnet*: graze distance 2.5 m and graze Flux +14.
   - *Twin Comet*: Comet bounces for a second hit at 40%.
   - *Hot Start*: begin each fight with 50 Flux.
   - *Reinforced Hull*: +30 max hull, regen cap 75%.
   - *Bolt Storm*: +1 bolt on every tier.
9. **warp (8 s, skippable):** you drive through a tube with a scrolling hex/stars shader (the track is a straight 600 m ribbon, sky `warp`) and can practice drifting. This hides the next arena build. The fight resets hull, Flux (or 50 with Hot Start) and credits.
10. **defeat:** time slows, the screen desaturates (uMono 1), "RAID WIPED" with the boss HP percentage. Options: **Retry from Phase N** (default, R key), Restart fight, Quit. A retry needs no reload and takes under 1 s.
11. **finale + credits:** after Boss 3, a free-drive credits lap on the Event Horizon Circuit under the new star, with fireworks, total time, total grade, and the best per-boss time and grade saved to localStorage. "PLAY AGAIN" / "MYTHIC".

---

## 14. Testing hook `window.__game` (08_ui.js; must exist after `G.initAll`)

URL params: `?test=1` (skip title and audio, seed 1, fight starts immediately, intros skipped, tutorial skipped), `?boss=1..3`, `?phase=1..3`, `?god=1`, `?quality=low|med|high`, `?seed=N`, `?debug=1` (shows an FPS/DPR/draw-call overlay and debug keys: F1 god, F2 skip phase, F3 kill boss, 1/2/3 jump to boss, F4 full Flux, F5 stagger).

```js
window.__game = {
  version: '1.0',
  ready: Promise<void>,          // resolves after initAll + first arena built
  state() -> {
    mode,                         // G.flow.state
    boss, phase, phaseName, bossHP, bossMaxHP, bossHPFrac, stagger, staggered, enrage,
    fightTime, cast /* {name, t, dur, interruptible} | null */,
    subTargets /* [{id, hp, maxHp, alive}] */,
    kart: { s, d, h, speed, hp, maxHp, flux, credits, lap, item, drifting, driftTier,
            airborne, invuln, boosting, overclock, comet, brand, x, y, z },
    telegraphs /*count*/, obstacles /*count*/, zones /*count*/,
    fps, dpr, quality, drawCalls: renderer.info.render.calls, triangles,
    dps /*rolling 10 s*/, timeScale, paused, godMode
  },
  telegraphs() -> [{id, shape, kind, s, d, s0, s1, d0, d1, r, fill, state, dmg}],
  events(n=50) -> [{t, name, data}],      // from G.eventLog
  skipToBoss(n),                 // 1..3: builds arena, skips briefing/intro/countdown, starts fight
  startFight(n, {phase=1}={}),
  setPhase(p),                   // jumps boss to phase p (sets HP to that threshold)
  setBossHP(frac),               // 0..1 fraction of max; triggers phase changes/death as normal
  damageBoss(amount),
  killBoss(),
  forceStagger(dur=6),
  triggerAttack(name, params),   // names per boss (§7.8, §8.8, §9.7); returns false if unknown
  listAttacks() -> string[],
  godMode(on=true),              // player takes no damage, no wreck
  setHP(n), setFlux(n), giveItem(name /*'seeker'|'nitro'|'prism'|'jammer'|'repair'*/),
  setCredits(n),
  teleportKart(s, d=0),
  bot(on=true),                  // autopilot (§4.10)
  input: { set({steer, throttle, brake, drift, dash, ability, item}), clear(),
           tap(action, ms=80) },  // tap is driven by sim time
  setTimeScale(x),
  pause(), resume(), step(nFrames=1),   // step works while paused (sim only + one render)
  setQuality(tier),
  win(), lose(),                  // force victory/defeat flow for current fight
  goto(state, data),              // raw flow jump
  screenshotReady() -> Promise   // resolves after next rendered frame
};
```
Requirements: every cheat is safe to call in any state (it is a no-op with `console.warn` if it does not apply). `state()` returns plain JSON-serializable data. Errors in boss modules must be caught per tick (`try/catch` around boss.update, logged once to `G.errors[]`, exposed as `__game.state().errors` count), so one bug does not freeze the game.

**Playwright smoke tests the engineers should make pass:**
1. Load `?test=1&boss=1`, wait for `ready`, `state().mode === 'fight'`, fps > 0, there are no console errors and `drawCalls < 120`.
2. `bot(true)`, run 20 s → `bossHP < bossMaxHP` and `events()` contains `kart:release`.
3. For each boss: `listAttacks().forEach(a => triggerAttack(a))` with `step(120)` in between → there are no errors and telegraphs appear.
4. `setBossHP(0.59)` → phase 2 and the `boss:phase` event. `setBossHP(0.24)` → phase 3. `killBoss()` → mode becomes `victory`, then `results`.
5. `setFlux(100); forceStagger(); input.tap('ability')` → a `kart:comet` impact event, and the boss HP drops by ≥ 900.
6. `godMode(false); setHP(1); setCredits(0); triggerAttack('palm')` (with the kart standing still via `input.set({throttle:0, brake:true})`) → mode becomes `defeat`. Then `goto('fight')` via the retry button `#btn-retry` → the fight resets to the checkpoint.
7. `skipToBoss(2)`, `skipToBoss(3)` each build without errors. Boss 3 phase 2 spawns ghosts within 10 s.
8. Mobile emulation (Pixel 7 landscape): touch on the left half moves `steer`, `#btn-drift` hold sets `drifting`.

---

## 15. Build order and ownership notes

Vertical slice first. Each milestone must be playable.
1. CORE + TRACK + KART + INPUT: Ember Bowl driving, drifting, tiers, boost pads, camera, post FX. (Already fun.)
2. COMBAT + BOSS1 Phase 1 + bolts + HUD + telegraphs + graze + stagger + Comet.
3. AUDIO + full Boss 1 + flow (title → briefing → fight → results).
4. BOSS2, BOSS3 (in parallel, against the framework).
5. Garage, warp, tutorial, finale, settings, polish, perf tuning on low tier.

Engineers working in parallel should code against the §2.3 API. If a dependency is not ready, guard calls with `G.fx?.burst?.(...)`. Boss modules depend only on the combat, track, fx, audio and kart APIs, and must not touch other modules' internals. Each boss module ≤ ~700 lines. Total target ~5-6k lines.

---

## 16. Judge fixes applied (summary)
- Engine moved to track space (s, d), with hazard bands baked into the track shader, a fixed 60 Hz timestep and data rotations (all three judges).
- The Boss 2 figure-8 overpass was replaced with a single banked sky loop plus a gap-jump ramp. Pincer now happens at the ramp.
- The two-head split was simplified to a head plus a detached Tail Coil with its own bar.
- Flux drain was removed. You lose 10 Flux per hit instead.
- A guaranteed scripted stagger in every phase, so Comet always has a stage. Comet is auto-targeted.
- Interrupts are a core verb: a T3 crit bolt, an Arc Dash through the head, or the Jammer as backup, shown with a cast bar.
- CHECKERED is now skill-gated (Pit Box soak rings, Comet, Perfect Dash or Prism), not gated by RNG items.
- Tick-Tock is a pure freeze with no rewind. The Chain system was cut. There are 6 simple mods.
- Touch layout is capped at 4 buttons (Overclock and Comet share a slot). Drift assist, a free dash charge, the portrait overlay, safe areas and auto-pause are in.
- No shadow maps. Draw calls < 120.
- Grafts: soak rings and the Brand debuff (D3); Breach/Coil gates, a palm that becomes a ramp, the eclipse mono pass, shard finishers, the light-bridge finale and the warp tunnel (D2); bolt volleys, Mega Graze, the echo-ghost recorder, slipstream and pulls you drift against (D4).
