# PRISMFALL: The Lightbreaker Raid — Implementation Spec

- **Directory:** `/home/claude/fun-stuff/prismfall/index.html` (one self-contained file. Do not create or touch `raid/` or any other raid directory.)
- **Live URL:** https://thatcsguy.github.io/fun-stuff/prismfall/
- **Target size:** about 4,500–6,500 lines. One `<script type="module">`, inline CSS, no other files.
- **Never git commit or push.**

---

## 0. Judging & Decision

Each concept was scored 1–10 on five criteria, then weighted. Visual wow and boss mechanics count double.

| Criterion | PRISMFALL | TIDEBREAK | TIDEGLASS |
|---|---|---|---|
| Visual wow (x2) | **10**: color-return arc, mirror hex floor, palette shockwaves, gravitational lens, eclipse | 8: underwater god rays and caustics (looks a lot like Tideglass) | 8: lantern pool in the dark is lovely but low-key |
| Class interest | **9**: graze → RGB charge → spend, with ability synergies | 9: the tide-swing Riptide is clever but abstract on mobile; clones are fragile | 7: one resource; Perfect Dodge is good |
| Boss variety + ramp (x2) | 9: bullet-hell plus shields, adds, arena loss, ultimate check | **9**: real MMO vocabulary (soak, spread, tether, cleave) | 8: clean grammar, darkness phase |
| Mobile readability | 7: bloom vs bullets is a risk (mitigated below) | 6: tide state plus clones plus Simon-says is a lot on a phone | **9**: one telegraph grammar, auto-attack |
| Buildability | 8: data-driven patterns and procedural geometry | 6: clone emitter, leviathan tube, 3–4 min fights | 8 |
| **Weighted total** | **79** | 70 | 72 |

**Winner: PRISMFALL.** It has the strongest single visual arc: the world starts monochrome and color returns as you win. One idea, "color", ties together the resource, the telegraph language and the spectacle, so it reads instantly even on a phone.

**Ideas grafted from the runners-up:**
1. **Tideglass, lantern light in the floor shader.** The player's glow is a pool of light computed in the floor shader from `uPlayerPos` and the player's charge color, at no light cost. The pool's color is the player's dominant charge, so resource state is visible without reading the UI.
2. **Tideglass, "would-hit" attack resolution.** Every hazard check returns `HIT | WOULD_HIT_IFRAMES | GRAZE | MISS`. Perfect Dash credit then works uniformly for projectiles, beams and ground telegraphs (dashing through a resolving telegraph counts too).
3. **Tideglass, one telegraph grammar with audio stings.** Shapes fill edge→center, resolve with a white flash and a ring. A synth "tell" plays 0.3 s before resolve. Wind-ups tighten per boss: 1.5 s → 1.1 s → 0.8 s.
4. **Tidebreak, MMO-style encounter vocabulary.** Named cast bars, a **soak tower** (Boss 2), a frontal **cleave cone** (Boss 1 P2, Boss 3), **adds that heal the boss** if ignored (Boss 2 saplings), a **tether** (Boss 3 P2), and a hard **enrage timer** on each boss.
5. **Tidebreak, between-boss upgrade pick ("Facets", 1 of 3).** Gives the run progression and replayability.
6. **Tidebreak/Tideglass, cinematic boss intros.** Letterbox bars, big letter-spaced serif title cards, a slow dolly.
7. **Tideglass, haptics.** `navigator.vibrate` on getting hit and on a perfect dash (Android).

---

## 1. Architecture (modules inside the single file)

The code is organized as plain sections, each a factory or object literal, in this order:

```
<head> meta viewport, CSS, importmap
<body> #c canvas, #hud overlay DOM, #title, #facet, #end screens, #touch layer
<script type="module">
  0  CONFIG        constants, tuning tables per boss, quality tiers
  1  UTIL          rng (mulberry32), clamp/lerp/damp, easing, temp vectors (preallocated), Pool class
  2  QUALITY       tier detect, FPS monitor, apply(tier)
  3  RENDER        renderer, scene, camera, composer (RenderPass, Bloom, LensFX ShaderPass, OutputPass)
  4  SHADERLIB     shared GLSL chunks: hash/noise/fbm, cosine palette, hexSDF, fresnel
  5  WORLD         starfield, floor (one ShaderMaterial, uniforms switch per arena), arena props per boss
  6  FX            Particles (GPU-analytic Points ring buffer), Rings (shockwave pool), Beams pool, Shards (shatter InstancedMesh), DamageNumbers (sprite pool)
  7  TELEGRAPH     pool of 40 decal meshes, one shared ShaderMaterial clone per slot (uniforms per slot)
  8  PROJECTILES   InstancedMesh pool (700), per-instance color; simulation arrays (SoA Float32Array)
  9  HAZARDS       generic resolver: circle/ring/cone/line/beam/projectile → HIT/IFRAME/GRAZE/MISS
 10  PLAYER        state, movement, abilities, spectrum, hp, visuals
 11  ENEMY BASE    Boss shell: hp, phases, cast bar, scheduler (timeline of attack calls), fracture meter, vuln state, shield
 12  PATTERNS      attack library: spiral, ring, aimedFan, lineLaser, sweepBeam, pinwheel, cone, groundCircles, homingSeed, pullWell, coronaPulse, thornRing, tether, soakTower
 13  BOSSES        Boss1 Lantern Choir, Boss2 Veyra, Boss3 Null Sun (visual build + script)
 14  DIRECTOR      cinematic timeline (camera keyframes, timeScale, bloom/aberration spikes, letterbox), hit-stop, trauma shake
 15  AUDIO         WebAudio graph, synth voices, music sequencer, SFX
 16  INPUT         keyboard/mouse, touch joystick, ability buttons
 17  UI            HUD binding (cached element refs; write only on value change), screens, localStorage stats
 18  GAME          state machine: TITLE → INTRO → FIGHT → TRANSITION → FACET → OUTRO/VICTORY/DEFEAT
 19  LOOP          rAF: dt clamp (max 1/20), timeScale, hitstop, update order, render
 20  DEBUG         window.__game
```

**State machine.** `game.state` takes one of: `'title' | 'intro' | 'fight' | 'cinematic' | 'facet' | 'defeat' | 'victory' | 'paused'`.

**Update order (each frame):**
1. input
2. director (it may override the camera and timeScale)
3. player
4. boss script and boss visuals
5. projectiles
6. hazards resolve
7. fx
8. camera
9. HUD (throttled to value changes)
10. composer.render

**Time.** `realDt` drives UI and audio. `simDt = realDt * timeScale * (hitstop>0 ? 0 : 1)` drives the game. Debug `timeScale` multiplies on top of that.

**Allocation rule.** Nothing is allocated in hot loops. Preallocate scratch `_v1.._v6` (Vector3), `_q`, `_m4`, `_col`. Pools for projectiles, telegraphs, rings, beams, damage numbers, particles. All materials are created at load. Before the title screen hides, call `renderer.compile(scene, camera)` with every boss's assets temporarily visible, so no shader compiles mid-fight.

---

## 2. Render Pipeline

### 2.1 Renderer
- `new WebGLRenderer({canvas, antialias: !isTouch, powerPreference:'high-performance', alpha:false})`
- `toneMapping = ACESFilmicToneMapping`, `toneMappingExposure = 1.0`, `outputColorSpace = SRGBColorSpace`.
- pixelRatio is `min(devicePixelRatio, tier.pr)`. Tiers: high 2.0, med 1.5, low 1.0.
  - Touch devices start at **med**; desktop starts at **high**.
- `scene.background` = black. The starfield draws the sky.
- No shadow maps. Blob shadows are drawn in the floor shader, as a dark disc under player and boss via uniforms.

### 2.2 Composer chain
1. `RenderPass(scene, camera)`
2. `UnrealBloomPass(res, strength, radius, threshold)`
   - Base values: strength 0.9, radius 0.55, threshold 0.6.
   - Resolution is half the drawing buffer on med and low. On low, strength 0.7.
   - `director.bloomBoost` is added to strength and decays at `exp(-4 dt)`. Spikes: 1.6 on transitions, 0.6 on Lance hits, 2.2 on White Nova.
3. `ShaderPass(LensFX)`, one merged pass. Uniforms:
   - `tDiffuse`, `uTime`, `uRes`
   - `uAberr` (base 0.0015, spike to 0.012; decays)
   - `uWarpCenter` (vec2 screen uv), `uWarpStrength` (Boss 3 lens: 0.0–0.08), `uWarpRadius`
   - `uShockCenter`, `uShockRadius`, `uShockStrength`: one ring distortion for big impacts. Radius grows 0→1.2 over 0.6 s.
   - `uSat`: world saturation. Starts 0.15. After boss 1 dies it is 0.45, after boss 2 0.75, at victory 1.0. During fights add `+0.25*phase` so later phases are more colorful. The player and projectiles are **exempt**: see the note at the end of this list.
   - `uWhite`: Nova whiteout 0→1. Mixes toward a luminance-thresholded white silhouette.
   - `uVignette` (0.35), `uLowHp` (0–1; tints the vignette edge red and pulses), `uGrain` (0.04), `uDark` (Boss 3 transition blackout 0–1)
   - Order inside the shader:
     1. warp uv (lens + shock)
     2. chromatic aberration (radial, 3 taps)
     3. saturation via luma mix
     4. whiteout
     5. dark
     6. vignette and low-HP tint
     7. grain
   - Low tier: `#define LOW` skips the warp and grain and does 1-tap CA.
   - **Saturation exemption.** Desaturation applies to the whole frame, so world and gameplay elements cannot be separated by post. Instead, gameplay-critical objects (projectiles, telegraphs, player core, charge ring) are authored with **over-saturated emissive colors** (×1.6 chroma) so they still read at uSat 0.15. The floor and props are authored normally. The effect is that the world looks gray while bullets glow in color: this is the intended look.
4. `OutputPass()` for tone mapping and color space.

### 2.3 Shared GLSL chunks (SHADERLIB)
- `hash12`, `noise2/3` (value noise), `fbm` (4 octaves; 3 on low)
- `palette(t)` cosine: a=.5, b=.5, c=1, d=(0,.33,.67)
- `hexDist(p)` returns `vec4(cellUV, cellId)`
- `fresnel(n, v, pow)`

### 2.4 Floor shader (one ShaderMaterial, a CircleGeometry of radius 22 with 96 segments)
**Uniforms:**
- `uTime`, `uArena` (0 = Ember Pond, 1 = Orchard, 2 = Event Horizon)
- `uWaveRadius`, `uWaveCenter`: rainbow hex glyph wave. Radius grows at 18 m/s, band width 2.5 m.
- `uPlayerPos`, `uPlayerColor`, `uPlayerGlow`: lantern pool. Radius 5 m, intensity 0.6 times charge-level scaling.
- `uLights[4]` (vec4 xyz + intensity), `uLightCol[4]`: light blobs pushed by bosses.
- `uBossPos`: blob shadow.
- `uPalA`, `uPalB`: arena palette lerp. `uPalT` animates during the 1.2 s palette shockwave. The shockwave is ring-shaped: `uPalRadius` grows from the boss and pixels inside it take the new palette.
- `uRipples[8]` (vec4 x, z, startTime, strength): water ripples for Boss 1.
- `uArenaRadius`: Boss 2 shrink, Boss 3 cracks via `uVoid[6]`.

**Base per arena:**
- **Ember Pond (0).** Near-black water (0.01, 0.012, 0.02).
  - Fake reflection: sample a procedural "void gradient" by reflected view direction, plus the light blobs stretched along view z (elongated streaks on water).
  - Fine fbm normal perturbation and ripple rings.
  - Hex grid lines are faint (0.03).
  - In Phase 2 the palette lerps to molten gold: emissive (1.0, 0.55, 0.12) times fbm flow.
- **Orchard (1).** The floor plane is hidden; hex columns are used instead (see Boss 2). Under them sits a dark violet void plane with fog sparkle.
- **Event Horizon (2).** Polar fbm accretion disk:
  - `angle + time*0.15*dir + 3.0/(r+0.5)` spiral, colored by a temperature ramp (deep red → orange → white near the inner radius 3 m).
  - The center (r < 2.6) is pure black, under the boss.
  - `uSwirlDir` flips at transition 1.
  - The void holes `uVoid[i]` (xz, radius, open 0–1) render black with a hot rim.

**Rainbow wave.** `hexEdge * smoothstep(band) * palette(cellId*0.13 + uTime*0.2)`, multiplied by 3.0 so it blooms.

**Lantern pool.** `uPlayerColor * uPlayerGlow * exp(-d²/9)`, added to the albedo-lit term.

### 2.5 Starfield / sky
- `Points`, 3,000 stars (1,500 on low), on a sphere shell of radius 120–200.
- The shader handles twinkle and per-star color temperature.
- **Intro streak mode.** A `uStreak` uniform stretches gl_PointSize and draws a line sprite along the camera velocity, giving the hyperspace fall.
- One additive **nebula dome**: a big inverted sphere with an fbm shader in arena-palette colors. Opacity 0.25, saturates with `uSat`.

### 2.6 Particle system (GPU-analytic)
- One `THREE.Points` with `BufferGeometry`. Capacity: 4,000 high, 2,500 med, 1,200 low.
- **Attributes** (all Float32, set once at creation):
  - `aStart` (vec3)
  - `aVel` (vec3)
  - `aCol` (vec3)
  - `aT0` (spawn time)
  - `aLife`
  - `aSize`
  - `aMode` (0 = ballistic with drag and gravity, 1 = attract to `uAttract` (player pos) for graze streaks, 2 = swirl around a center for the leaf vortex)
- **Emit** writes into the ring buffer index and marks the attribute `updateRanges` for only the written span (`addUpdateRange` in 0.170). At most one upload range per attribute per frame: track min/max dirty indices, and on wrap-around, flag the full buffer.
- **Vertex shader:**
  - `age = uTime - aT0`
  - if `age > aLife`, set size 0 and move off-screen
  - Ballistic position: `p = start + vel*(1-exp(-k*age))/k + 0.5*g*age²`, with drag k = 2.2 and g = (0, -4, 0) scaled by a mode flag.
  - Size attenuation: `size * (300 / -mvPos.z) * (1 - age/life)^0.5`.
- **Fragment.** Procedural soft dot `exp(-r²*6)` plus a 0.3 core, additive blending, `depthWrite=false`.
- **Emitter API:**
  - `fx.burst(pos, count, color, speed, life, size, spread)`
  - `fx.streakToPlayer(pos, color, n)`
  - `fx.trail(pos, color)`
  - All take numbers; no objects are allocated.

### 2.7 Other pooled FX
- **Rings.** 24 `RingGeometry` meshes, flat on the floor, with an additive shader: radius and thickness uniforms, fading out. Used for:
  - landing ring
  - telegraph resolve flash
  - graze ping
  - shockwaves
- **Beams.** 12 `CylinderGeometry(1,1,1,16,1,true)` with a shader:
  - Scrolling noise along v.
  - Fresnel core: core white, color at the edges.
  - Width and length are set via scale.
  - Used for the player Lance, boss lasers, the boss 3 tether, and the boss 1 "Hymn" beam.
- **Shards.** One `InstancedMesh` of 220 tetrahedra (`TetrahedronGeometry(0.35)`), per-instance color.
  - `shatter(center, color, radius, outward)`: positions are sampled on a sphere of the boss radius, velocities outward, then simulated on the CPU (SoA arrays, about 220, cheap).
  - `reform(target)`: lerp back with ease-in over 0.8 s.
  - Used for boss transitions, boss deaths, and the player death and respawn.
- **Damage numbers.** A pool of 40 `Sprite`s. Each uses a frame from a pre-rendered canvas atlas: digits 0–9 plus "!" and "GRAZE" and "PERFECT", in white, gold and colored variants.
  - Implementation: 40 sprites, each with its own small 128×48 CanvasTexture, redrawn only when the sprite is spawned (one `fillText` and `needsUpdate`, cheap at about 3–6 per second).
  - Damage numbers are coalesced: auto-bolt hits sum into one number every 0.35 s per target.
  - Movement: float up 1.2 m, scale pop 1.3→1.0, fade over 0.8 s. Crits are gold and 1.4× size.

### 2.8 Lighting
- `HemisphereLight(0x8899ff, 0x110814, 0.35)`
- `DirectionalLight(0xffffff, 0.6)` from (5, 10, 3), for shape on the boss meshes.
- No point lights. All glow comes from emissive materials, bloom, and the floor light blobs.
- Boss meshes use `MeshStandardMaterial` with `emissive` and `emissiveIntensity` animated, plus custom ShaderMaterials where noted.

### 2.9 Camera
- `PerspectiveCamera(fov, aspect, 0.1, 400)`. Framing is 3/4 top-down.
- **Landscape:** fov 50, offset from target (0, 17, 12.5), pitch about 54°.
- **Portrait (aspect < 1):** `fov = 50 + (1-aspect)*22`, clamped to 68. Offset scaled ×1.25 (height 21, back 15). The arena (r about 13–16 playable) must fit horizontally.
- Recompute on resize, lerped over 0.3 s.
- **Target** = `player.pos + lookAhead + bossBias`:
  - lookAhead = velocity × 0.35, damped.
  - bossBias = (boss − player) × 0.18, clamped to 3 m.
- **Follow:** critically damped spring (`damp(cur, target, 6, dt)` per component).
- **Screen shake (trauma model):**
  - `trauma` in 0–1. `shake = trauma²`.
  - Offsets come from 3 noise channels (sin-sum of 3 incommensurate frequencies; no allocation).
  - Positional amplitude 0.6 m, roll amplitude 0.03 rad.
  - Decay 1.6/s.
  - On touch devices amplitude ×0.7, and halved if the "reduce effects" setting is on.
  - Trauma added by event:

    | Event | Trauma |
    |---|---|
    | Player hit | +0.35 |
    | Lance fire | +0.15 |
    | Lance crit | +0.25 |
    | Boss slam | +0.4 |
    | Transition | +0.8 |
    | Nova | +0.9 |
- **Hit-stop.** `director.hitstop(sec)` freezes simDt (render continues).

  | Event | Freeze |
  |---|---|
  | Perfect dash | 0.08 s |
  | Lance hit | 0.05 s |
  | Lance crit | 0.07 s |
  | Phase break | 0.15 s |
  | Boss death | 0.25 s |
- **Director cinematics.** A timeline is an array of keyframes `{t, camPos, camLook, timeScale, bloom, aberr, letterbox, call}`, preallocated per cinematic. Interpolation is eased Catmull-like (cubic smoothstep per segment). During a cinematic the player is invulnerable, input is ignored, and all projectiles fade out (cleared with sparkle bursts).

---

## 3. Player: The Lightbreaker

### 3.1 Model
A group made of:
- **Torso.** `IcosahedronGeometry(0.55, 0)` stretched y ×1.5, with **CrystalShader**:
  - Fresnel rim iridescence: `palette(fresnel*1.2 + uTime*0.1)` × 1.4.
  - Inner core: an emissive glow of `uCoreColor` (dominant charge, or white in white state) using `pow(1-fresnel, 2)` and a noise flicker.
  - Partially transparent (0.85), so it looks like glass.
- **Head shard.** An octahedron of 0.28, floating 0.25 above the torso, bobbing.
- **Limbs.** 4 floating shard limbs (thin octahedra) that orbit the torso slowly and lean in the movement direction. They act as legs and arms procedurally, swinging with a sin of the distance travelled.
- **Spectrum ring.** On the floor around the player: radius 1.1, a flat ring mesh with a shader drawing 3 arcs (R, G, B), each filled by charge/100.
  - Unfilled arcs are drawn dim.
  - When all are ≥ 60, the whole ring turns white and pulses.
- **Graze ring.** A faint dashed circle at the graze radius (1.6 m). It brightens for 0.15 s on each graze. During Boss 1 phase 1, it shows strongly for the first 20 s (tutorial).
- **Facing.** The player faces the aim direction: the boss by default, or the mouse.

### 3.2 Stats
- **HP:** 100. No passive regen. Heal sources: Verdant Lattice, plus a "Facet" option.
- **Move speed:** 7.5 m/s. Acceleration is smooth: `vel = damp(vel, input*speed, 14, dt)`.
- **Hurtbox radius:** 0.45 m. It is visually smaller than the model, which is bullet-hell fair.
- **Graze radius:** 1.6 m (center distance minus projectile radius).
- **Arena bound:** clamp to `arenaRadius - 0.6`.
  - Boss 2: falling off is impossible. The clamp follows the current tile set.
  - Boss 3 void holes: walking in costs 15 dmg, and you are pushed out to the nearest rim with a 0.5 s stun.
- **Hurt i-frames:** 0.6 s after taking a hit. The model flickers.
- **Death:**
  1. The player shatters into shards.
  2. Defeat overlay after 1.2 s, with Retry (restart the current boss at full HP and 30/30/30 charge) and Quit to title.
  3. On Retry: reform animation, where shards fly in, over 0.8 s.

### 3.3 Spectrum resource
- **R, G, B:** each 0–100. Start each boss with R 30, G 30, B 30.
- **Graze:** a projectile whose closest approach this frame is inside graze radius but outside the hurtbox, while not hitting.
  - Each projectile can grant at most one graze (flag).
  - Grants +6 of the projectile's color channel.
  - Ground telegraph and beam grazes: being within 0.8 m of the edge of a resolving ground hazard, unhurt, gives +8 of its color (also once per hazard).
  - Feedback: chime by color, `fx.streakToPlayer` (6 particles), a small "+" pop on the ring arc.
  - A **graze combo** counter shows under the HP bar as "GRAZE ×N". It resets after 2 s without a graze. Each graze's chime pitch steps up the current musical scale by its combo index (mod 8), so chains play melodies.
- **Perfect graze (Refract Dash i-frame overlap):** any hazard that would hit during dash i-frames.
  - Effect: +12 to its color, hit-stop 0.08 s, aberration spike 0.008, "PERFECT" sprite, a +0.5 s refund on the dash cooldown, and vibrate(15).
  - Limit: max 3 perfect credits per dash.
- **Prism Bolt trickle:** each bolt hit gives +1.2 to the lowest channel (ties are broken R > G > B).
- **White projectiles** (some boss-3 patterns) grant +3 to all channels on graze.

### 3.4 Basic attack: Prism Bolt
- **Auto-fire:** always on during the fight (mobile and desktop). Interval 0.18 s.
- **Target:**
  - Desktop with the mouse inside the canvas: toward the mouse ground point. Use a raycast against the y=0 plane, recomputed only when the mouse moves.
  - Otherwise: auto-target the nearest valid target, in priority order:
    1. adds marked priority (saplings, moons, petals)
    2. then the boss
  - Range 20 m.
- **Damage:** 10 per bolt (about 55 DPS).
- **Projectile:** speed 38 m/s, a white elongated octahedron with a tiny trail. Pooled in a separate small player-projectile pool of 60, also an InstancedMesh.
- **Crits:** 10% chance for ×2 damage.
- **Vulnerable boss:** all damage ×2.

### 3.5 Abilities

Cooldowns tick in simDt. Every ability fires instantly; no ability locks movement except Nova.

**1. REFRACT DASH**
- **Keys:** Space or Shift. Touch: the biggest button.
- **Charges:** 2, each recharging in 3.5 s.
- **Movement:** 6.5 m over 0.16 s in the movement direction, or the facing direction if idle. Ease-out.
- **i-frames:** 0.35 s from dash start.
- **VFX:**
  - 4 afterimage ghosts: clones of the torso mesh in a small pool of 8, with a separate ghost material (fresnel only, additive, color of the dominant charge), fading over 0.35 s.
  - A line of particles along the path.
  - A ring at the destination.
- **SFX:** a filtered noise "whoosh" (bandpass sweeping 800→3000 Hz, 0.15 s) plus a glassy ping.

**2. CRIMSON LANCE**
- **Keys:** 1 / Q / J / LMB. Touch: button 2.
- **Cost:** 35 R. **Cooldown:** 1.5 s.
- **Shot:** an instant hitscan beam. Length 24 m, width 0.9 m, in the aim direction (auto-aim: priority target, else the boss).
- **Damage:** 140 to the first target, pierces. Crit 25% for ×1.6.
- **Special:**
  - Destroys shield objects (Boss 2 bloom petals, Boss 3 prism moons) instantly or with heavy damage, as specified per object.
  - Breaks saplings in 1 hit.
  - Destroys projectiles along the beam, converting them to sparkles. No charge from these.
- **Beam visual:** a red beam cylinder lasting 0.22 s, scale x pulsing from 1.4 to 0, plus a muzzle flash ring.
- **Hit effects:** a red burst of 40 particles on impact, bloom +0.6, trauma 0.15, hit-stop 0.05 s.
- **SFX:** a short charge zip (saw 200→60 Hz through a lowpass) plus a noise crack and sub thump.

**3. VERDANT LATTICE**
- **Keys:** 2 / K. Touch: button 3.
- **Cost:** 35 G. **Cooldown:** 8 s.
- **Field:** placed at the player position. Radius 4.5 m, lasts 6 s.
- **Visual:** a hex-pattern dome on the floor (flat disc decal with hex SDF, rising sparkle particles, a thin green ring wall).
- **Effects:**
  - Heals the player 4 HP/s while inside (24 max).
  - Enemy projectiles inside move at 40% speed, and their color becomes G: their instance color lerps to green, and graze grants G.
  - Standing inside protects from Boss 2's Shatterbloom.
  - Only one lattice at a time; recasting replaces it.
- **SFX:** a rising, airy chord (3 sine voices in a fifth stack with an attack of 0.3 s).

**4. AZURE MIRROR**
- **Keys:** 3 / E / L. Touch: button 4.
- **Cost:** 35 B. **Cooldown:** 10 s.
- **Shield:** a spinning hexagonal blue mirror (a flat hexagon, fresnel plus a scrolling glint), placed 1.2 m in front of the player along the aim direction. It follows the player's facing for 2.5 s.
- **Coverage:** an arc of 120° in front, radius 2.2 m.
- **Reflection:**
  - Enemy projectiles entering the arc are reflected: their owner flips to the player, color B, and they home on the boss (turn rate 6 rad/s) at speed ×1.4.
  - Each reflected hit deals 25 damage and adds **+4 Fracture**.
  - Reflected shots that hit adds deal 25.
- **Beams:** the mirror also blocks one beam hit in its arc (negated) and gives +20 Fracture.
- **SFX:** a shimmering bell (FM, ratio 3.5) and a "tink" on each reflect, with pitch rising per reflect within one cast.

**5. WHITE NOVA (ultimate)**
- **Keys:** 4, R or F. Touch: a center button that appears pulsing only when available.
- **Requirement:** R, G and B all ≥ 60. Consumes all charge, setting all channels to 0.
- **Sequence (total 1.1 s, player invulnerable):**
  1. Rise 1 m over 0.3 s.
  2. `uWhite` 0→1 over 0.15 s, held for 0.25 s.
  3. Burst at t = 0.4.
  4. `uWhite` fades.
  5. timeScale 0.35 for 0.4 s, then eased back.
- **Damage:** `300 + 6 × (R+G+B consumed)`, between 1380 and 2100. Doubled if the boss is vulnerable.
- **Projectiles:** clears every enemy projectile on screen. Each cleared projectile becomes a streak to the player, refunding +1 of its color (capped at +30 per channel).
- **Fracture:** if Fracture is at 100, triggers **VULNERABLE**:
  - Lasts 6 s, with ×2 damage taken.
  - The boss renders cracked: a shader uniform `uCrack` shows glowing fracture lines on the boss material via an onBeforeCompile-patched emissive Voronoi edge.
  - The boss interrupts its current cast.
- **VFX:**
  - A shockwave ring of radius 30.
  - 300 rainbow particles.
  - Bloom +2.2, the shock distortion ring, trauma 0.9.
  - The floor rainbow wave from the player.
- **SFX:** a reverse swell (noise through a rising highpass, 0.4 s) plus a huge chord stab (all 3 boss-key triads) plus a sub drop.

### 3.6 Fracture (boss stagger meter)
- Range 0–100. Shown as a thin white bar under the boss HP bar.
- **Gains:**

  | Source | Fracture |
  |---|---|
  | Reflected shot | +4 |
  | Mirror-blocked beam | +20 |
  | Lance hit | +3 |
  | Perfect graze | +2 |
- **Decay:** −2/s after 4 s without a gain.
- **At 100:** the bar glows and the boss shows a white crack shimmer, but nothing happens until a Nova hits.
- **Vulnerability:** only via Nova at full Fracture. After vulnerability, Fracture resets to 0.

### 3.7 Facets (upgrade: pick 1 of 3 after bosses 1 and 2)
Shown as three tall crystal cards; tap to choose. The run stores the picked facets. They persist when retrying that boss, and reset on a new run from the title.

The 3 offered are drawn from this pool of 8 without duplicates:
1. **Prism Echo:** Lance fires a second, weaker beam (50%) at +12° offset.
2. **Living Lattice:** Lattice radius +30%, heal 6/s.
3. **Polished Mirror:** Mirror lasts 4 s and reflected shots deal 40.
4. **Spectral Greed:** graze radius +0.4 m and graze charge +2.
5. **Third Refraction:** Dash gains a 3rd charge.
6. **Bright Core:** +30 max HP (130), and heal to full now.
7. **Afterglow:** after a Nova, all ability costs are halved for 5 s.
8. **Splinter Bolts:** Prism Bolt fires 2 bolts in a 6° spread at 0.22 s interval (DPS +20%).

---

## 4. Shared Combat Systems

### 4.1 Telegraph decals (pool of 40)
- **Mesh:** a `PlaneGeometry(1,1)` rotated flat at y = 0.03, `renderOrder` 5, `depthWrite=false`, additive with polygonOffset.
- **Material:** one ShaderMaterial per slot (40 clones share the program). Uniforms:
  - `uShape`: 0 circle, 1 ring/donut, 2 cone, 3 line (rectangle), 4 soak tower (circle with a white dashed outline), 5 safe zone (cyan)
  - `uFill` (0–1), `uColor`, `uInner` (ring inner radius ratio), `uAngle` (cone half-angle), `uTime`, `uAlpha`
  - The mesh is scaled to the shape bounds. Cone and line use local coordinates; cones are oriented by mesh rotation.
- **Look:**
  - A solid bright outline 0.06 units thick, **not** relying on bloom. It is drawn at an intensity so that even after tone mapping it is a crisp line.
  - Interior: a low alpha 0.12 tint, plus a fill region growing from the outer edge inward. For the cone, the fill grows from the apex outward instead, which reads better.
  - Fill alpha 0.35.
  - Edge pulse frequency rises as fill nears 1.
- **Colors:**
  - Red-coral `(1.0, 0.18, 0.25)` = damage.
  - Cyan `(0.2, 1.0, 0.95)` = safe pocket.
  - White = soak or interact.
  - Colored tint per damage color (an R/G/B hint) as an inner gradient, so a player knows which charge a graze will give.
- **Resolve:** a white flash for 0.1 s (`uFill` = 1 and alpha spike), a ring FX at the shape boundary, and the hazard check. The tell sting plays 0.3 s before resolve.
- **API:**
  ```
  tele.circle(x, z, r, windup, dmg, color, opts)
  tele.ring(x, z, rIn, rOut, ...)
  tele.cone(x, z, dirAngle, halfAngle, len, ...)
  tele.line(x0, z0, x1, z1, width, ...)
  tele.soak(x, z, r, windup, onSuccess, onFail)
  tele.safe(x, z, r, dur)
  ```
  Each returns a slot index. `opts.follow` = a boss part to track until lock time; the shape locks at 60% of the wind-up.

### 4.2 Enemy projectiles
- **Pool:** 700 on high and med, 450 on low. Capacity hard-caps patterns. If the pool is full, the oldest is reused.
- **Rendering:** an InstancedMesh of `IcosahedronGeometry(1,1)` with a custom shader:
  - A dark rim outline (computed via fresnel: dark at grazing angles).
  - A bright emissive core of the instance color ×2.2.
  - This keeps a readable silhouette against bloom.
  - Per-instance color goes in `instanceColor`. The matrix sets scale (radius).
  - Unused instances get scale 0. Use `mesh.count` = highest active index + 1.
- **SoA arrays:** `px, pz, vx, vz, r, color(0 = R, 1 = G, 2 = B, 3 = W), life, dmg, flags (grazed, reflected, homing, inLattice), accel, angVel` (curving shots).
- **Height:** projectiles fly at y = 0.9 (chest height).
- **Trails:** every 3rd frame per projectile emit 1 particle (med/low: every 6th) of the projectile's color, life 0.25 s.
- **Colors** (over-saturated, see §2.2):
  - R = `(1.0, 0.15, 0.25)`
  - G = `(0.25, 1.0, 0.35)`
  - B = `(0.25, 0.5, 1.0)`
  - W = `(1, 1, 1)`
- **Radii:**
  - small 0.22
  - medium 0.35
  - large 0.6, used for slow homing seeds and orbs

### 4.3 Hazard resolver
Every hazard (projectile step, ground shape at resolve, active beam per frame, sweep bodies) runs:
```
d = signedDistanceToPlayer(shape)  // <0 means overlapping hurtbox
if d < 0:
   if player.dashIframe > 0: perfectGraze(hazard)  // WOULD_HIT
   else if player.hurtIframe > 0: nothing
   else: damagePlayer(hazard.dmg)
else if d < grazeBand && !hazard.grazed: graze(hazard)
```
- **Projectiles:** the check uses swept distance (segment from previous to current position against the point) to avoid tunneling at low FPS.
- **Beams:** a damage tick every 0.25 s while overlapping. The first tick applies a 0.5 s slow (×0.7) as feedback.

### 4.4 Boss shell
Each boss defines:
- **Fields:** `name`, `title`, `maxHp`, `phases: [{until: 0.6, script}...]`, `enrage` (seconds), `arenaRadius`, `buildVisuals()`, `updateVisuals(dt)`, `onPhase(n)`, `onDeath()`.
- **Scheduler:** each phase script is a looping array of steps `{at: seconds, fn: patternCall}` with a loop length. It is a per-phase "rotation", like an MMO timeline.
  - Steps fire in order. The cursor resets at loop end.
  - Scripted steps are deterministic, seeded RNG per boss attempt, so tests are reproducible.
- **Cast bar:** `castBar(name, duration)`. The HUD shows the cast name and a fill. Interruptible casts show a white cast bar; uninterruptible ones show orange.
- **Damage taken:** `takeDamage(n, src)` subtracts HP, flashes the boss (emissive spike for 0.08 s), spawns a damage number, and checks phase thresholds.
  - Thresholds trigger a **transition cinematic**, with the boss invulnerable during it.
  - HP is clamped at the threshold until the transition completes. Overflow damage is discarded.
- **Enrage:** a timer shows as a small countdown next to the boss name (mm:ss). At 0 the boss casts an unavoidable wipe: 999 damage, a white-out, with a 3 s "ENRAGE" banner first.

### 4.5 Difficulty knobs (CONFIG.diff per boss)

| | Boss 1 | Boss 2 | Boss 3 |
|---|---|---|---|
| Telegraph wind-up | 1.5 s | 1.1 s | 0.8 s (P3: 0.7 s) |
| Projectile speed mult | 0.8 | 1.0 | 1.2 |
| Typical hit damage | 8–12 | 12–18 | 15–25 |
| Simultaneous mechanics | 1 | 2 | 3 |
| Enrage timer | 4:00 (lenient) | 4:30 | 5:00 (Supernova countdown in P3) |

Expected kill times with a reasonable player are about 2:00, 2:30–3:00 and 3:30–4:00.

### 4.6 DPS budget (for HP tuning)
- Bolts give about 55 DPS. With Splinter Bolts, about 66.
- Lance: about 1 per 4–5 s, limited by R income. 140 → about 30 DPS.
- Reflects: about 10–15 DPS average.
- Nova: about 1,600 per 40–60 s → about 30 DPS. Doubled during vulnerability windows.
- **Total sustained:** about 120–140 DPS, minus downtime for transitions and dodging.

---

## 5. Bosses

### BOSS 1: THE LANTERN CHOIR (easy; ~2:00; HP 11,000; enrage 4:00)
- **Charge it feeds:** mostly R. Its projectiles are R about 80% of the time, B 20% for variety.
- **Arena:** Ember Pond. Radius 15. Floor arena 0.

**Props:**
- 400 instanced candles (300 on low) at random radius between 15.5 and 21 outside the play circle, plus 60 floating on the pond inside the circle (decorative, no collision).
  - Instance geometry: a small cylinder plus a flame quad. The flame is an additive billboard in the shader, flickering by instance id.
  - In Phase 2 every candle's flame flares ×3 (a uniform).
- Light blobs: the heart (warm), plus the 3 nearest lanterns.
- Ripples on the floor where projectiles die or telegraphs resolve, using the `uRipples` ring buffer.

**Look:**
- **8 lantern masks.** Each lantern is a `LatheGeometry` (paper-lantern profile, 12 segments) with an emissive canvas-texture mask face:
  - One shared 256×256 canvas texture of a serene/eerie face (eyes, mouth drawn with arcs).
  - Flicker via an emissive intensity uniform per lantern (material clones, 8).
- **Ribbons.** Each lantern trails 2 silk ribbons: `PlaneGeometry(0.25, 3, 1, 12)` with a vertex shader sine-wave sway that hangs down and back.
- **Orbit.** The lanterns orbit a central **paper heart** (two merged spheres plus a cone, deformed, or a heart via LatheGeometry from a heart profile) at radius 4.5, height 2.5.
  - The heart beats: scale `1 + 0.08*pulse(t*1.2)`.
  - It has a red emissive core.
- **Hitbox:** the heart is the boss hitbox, radius 1.6 at (0, 2, 0). Lanterns are part of the visuals (no separate HP).

**Intro cinematic (5 s, also the game's opening).** See §6.2.

**Phase 1, "Vespers" (100%–60%).** Loop of 14 s.

1. **Spiral Hymn** at t = 0:
   - Lanterns fire a 2-armed spiral from the heart: 10 shots/s for 3 s, angular step 17°.
   - Color R, speed 6.5, radius 0.3, dmg 8.
   - Spirals are generous: there are always gaps of more than 2 m at 6 m distance.
2. **Lantern Gaze** at t = 4.5:
   - A random lantern brightens; cast bar "Lantern Gaze" 1.5 s.
   - Line telegraph from the lantern's ground projection through the player's position at lock time (60%), width 1.6, length 30.
   - Then a beam lasting 0.4 s, dmg 14, color R.
   - It repeats twice in sequence with different lanterns, 0.7 s apart.
3. **Ember Ring** at t = 8:
   - A ring of 24 B projectiles expands from the heart, speed 5, with a 3-projectile gap aimed at the player.
   - It fires again 1 s later, rotated.
   - Teaches grazing: a tutorial prompt appears on its first occurrence, "Brush past shots to GRAZE their color".
4. **Paper Rain** at t = 11:
   - 4 circle telegraphs, radius 2.2, wind-up 1.5 s.
   - One sits on the player and 3 are random within 8 m.
   - A lantern drops onto each: dmg 12, color R.

**Tutorial prompts** (P1 only, once each, as a small centered toast for 3 s):
- "Move: left stick / WASD"
- "Dash through attacks for PERFECT grazes"
- When R ≥ 35: "Crimson Lance ready: spend RED"
- When B ≥ 35: "Azure Mirror reflects shots"

**Transition 1 at 60%, "Kindling"** (2.2 s cinematic):
- The camera orbits 120° around the heart at low height. timeScale 0.25.
- The heart bursts into flames: shards shatter outward and reform into a burning heart, which now uses a fire shader (fbm flame billboard behind it).
- All candles flare. The floor palette shockwave goes black → molten gold from the heart (1.2 s).
- Bloom spike, then audio key change.
- Lanterns ignite: they turn into flame-wreathed versions, with particle emitters on each, 2 particles per frame on high.

**Phase 2, "Choir of Cinders" (60%–0%).** Loop of 16 s.

1. **Swoop** at t = 0:
   - 3 lanterns detach in sequence. Each shows a cone telegraph from its position toward the player: half-angle 25°, length 12, wind-up 1.5 s.
   - Then it dives along the cone (dmg 14), leaving a trail of 6 slow R projectiles that drift sideways.
   - Spacing 0.8 s.
2. **Chorus Pinwheel** at t = 5:
   - Cast bar "Chorus" for 2 s. All 8 lanterns align in a circle above the heart.
   - 8 line telegraphs radiate from the heart (length 16, width 1.4).
   - Then 8 beams lasting 4 s rotate at 22°/s (direction alternates each cast). dmg 10 per tick.
   - Gaps are 45° wide, so you must keep walking around.
   - Inside 3 m of the heart is beam-free. The safe cyan circle shows during the cast to hint at it.
3. **Candle Rain** at t = 10.5:
   - 7 circles, radius 1.8, appearing staggered 0.25 s apart: random positions, with one tracking the player at spawn.
   - Wind-up 1.5 s, dmg 12.
4. **Frontal Hymn (cleave)** at t = 13.5:
   - The heart turns toward the player. Cone half-angle 60°, length 14, wind-up 1.6 s, dmg 18.
   - Teaches getting behind or out to the side.

**Death:**
1. The heart's flame implodes and every lantern goes dark one by one (0.08 s apart, each a little chime descending).
2. Then the heart shatters (220 shards) and a big rainbow floor wave starts.
3. `uSat` lerps 0.15 → 0.45 over 2 s.
4. Paper ash particles float up.
5. "THE LANTERN CHOIR — SILENCED" title card.
6. Then the Facet pick, then the descent to boss 2 (§6.3).

### BOSS 2: VEYRA, THE GLASS ORCHARD (medium; ~2:45; HP 19,000; enrage 4:30)
- **Charge it feeds:** G and R.
- **Arena:** the Orchard, a hex column floor.

**Hex columns:**
- An InstancedMesh of hexagonal prisms (`CylinderGeometry(1,1,1,6)`), axial hex grid radius 9 rings → 271 tiles of hex size 1.0 (fits radius about 15). High tier only can afford 469 (r = 12) with smaller size; keep 271 on all tiers for consistent gameplay.
- **Column shader** (MeshStandard + onBeforeCompile, or a custom shader):
  - Top face: dark glass with a glowing edge (cylinder UV/normal test: top if normal.y > 0.5).
  - Per-instance attribute `aTile`: (axialQ, axialR, randomSeed).
  - Per-instance attribute `aOffset`: the y offset, updated on the CPU into an InstancedBufferAttribute (271 floats, cheap).
- **Animations:**
  - idle bob ±0.05
  - **eruption:** a tile shoots up to y = 2.2 for root lash lines
  - **spiral ripple** at transition
  - **drop:** falling tiles tumble. Falling tiles get CPU-simulated rotation and gravity via instance matrices. Only a subset at a time; the matrix is recomposed per frame for those 135.
- **Tile state array:** `alive`, `y`, `vy`, `rot`.
- **Collision:** the arena bound is the union of alive tiles. Implement as a per-boss `arenaRadius` plus a half-plane cut for Phase 3, rather than per-tile collision, to keep it simple.
- **Atmosphere:**
  - Fog: bioluminescent ground fog sparkle via particles in mode 0 with near-zero velocity and long life, 200 of them, re-emitted.
  - A `FogExp2(0x0a0614, 0.018)` for the arena.

**Look: the crystal tree.**
- A recursive L-system generated at load (depth 5). Branches are an instanced `CylinderGeometry` prism, 6 sided, tapered (about 120 instances) with a green crystal fresnel shader.
- At the trunk center sits a crystalline **dryad torso**:
  - stacked deformed icosahedra
  - long shard "hair"
  - arms of tapered prisms
  - a glowing green heart core
- **Hitbox:** sphere radius 2.2 at (0, 3, 0) on the torso.
- **Leaves:** an InstancedMesh of 1,500 shard quads (800 on low) at branch tips.
  - The vertex shader shimmers them: rotation by noise, and fresnel sparkle.
  - The leaf shader has a `uVortex` mode (0–1). At 1, leaves leave their rest positions and orbit the arena.
  - Orbit: `angle = rest + t*speed`, radius 6–13 and height 0.5–3, encoded per-instance as `aOrbit` (r, h, phase). The vertex shader mixes rest → orbit by `uVortex`, staggered per instance.
  - Leaf vortex gameplay is done separately with real projectiles (below). The visual vortex is decorative.

**Phase 1, "Grove" (100%–70%).** Loop of 15 s.

1. **Seedfall** at t = 0:
   - Cast 1.0 s. Launches 3 homing **seeds** (G, radius 0.5, speed 4, turn rate 1.2 rad/s, dmg 12, life 5 s).
   - Each seed that lands (life ends, or it reaches the ground at a target point) spawns a **Sapling** add at that point. The landing point is a circle telegraph radius 1.2 marked G.
   - **Sapling:**
     - HP 220 (one Lance kills; bolts take about 4 s). Visual: a small crystal spire that grows from 0 to 1 over 0.8 s.
     - Fires a **spore ring** of 10 G projectiles every 3.5 s (speed 4.5, dmg 8).
     - **Heals Veyra 1% max HP every 4 s while alive**, with a visible green beam from sapling to tree (the Tidebreak graft). It appears in the add-priority target list.
     - Auto-target prefers saplings.
     - Max 4 saplings alive.
2. **Root Lash** at t = 5:
   - 3 line telegraphs from Veyra toward the player ±20°, width 2.0, length 18, wind-up 1.1 s.
   - On resolve, tiles along each line erupt (y up to 2.2 and back over 0.6 s), with green-white root shards spraying. dmg 16.
3. **Thorn Volley** at t = 9:
   - Aimed fans: 5 shots, 40° spread, color R, speed 9, dmg 10.
   - 3 volleys 0.4 s apart.
4. **Petal Storm** at t = 12:
   - A slow spiral of G leaves: 3 arms, 2.5 s, speed 5.

**Transition 1 at 70%, "Autumn of Glass"** (2.4 s):
- Leaves (visual) burst into the vortex (`uVortex` 0→1 over 1.5 s).
- Floor tiles ripple in a spiral wave from the center (y offset = `sin(dist*1.2 - t*10)` envelope).
- The palette shifts green → violet.
- The camera cranes up and back.
- All saplings shatter.

**Phase 2, "Bloom" (70%–35%).** Loop of 22 s.

1. **Leaf Wall** (continuous through the phase):
   - Two rings of G projectiles that orbit the arena (not radial). They are implemented as projectiles with `angVel` around the center, at radius 9.5 and 6.
   - 14 per ring, with 2 gaps of 3 projectiles each. Rings rotate in opposite directions at 0.35 and −0.45 rad/s.
   - Re-armed every 10 s with a short "fade in": the first 1 s is harmless, rendered at alpha 0.4 with no collision.
   - dmg 10. Excellent graze farming.
2. **Bloom Shield → Shatterbloom** at t = 2:
   - Veyra encases in a crystal flower: 3 petal meshes around her, each with HP 300, a white soak outline, and marked priority targets. A Lance does 300 vs petals, so 1 Lance = 1 petal.
   - Cast bar "Shatterbloom" 10 s, uninterruptible except by breaking petals.
   - While the shield is up, boss damage is reduced ×0.25.
   - Breaking all 3 petals cancels the cast and staggers Veyra for 3 s, taking ×1.5 damage, and gives +30 Fracture.
   - If the cast completes: an arena-wide blast of 45 dmg, **except** inside the player's own Lattice (immune). A helper toast on the first cast says "Break the petals (Lance) — or shelter in your Lattice".
   - During the cast, the scheduler keeps running Leaf Wall plus a light **Root Lash** at t = 6 (1 line).
3. **Soak Tower ("Seed of Renewal")** at t = 14 (Tidebreak graft):
   - A white soak tower: radius 2, wind-up 4 s, at a random point 7–10 m from center.
   - The player must be inside during the last 1.0 s. Success gives +25 G and +25 R and a 2 s Veyra stagger.
   - Failure: Veyra heals 4% max HP and fires an all-direction G burst of 32 projectiles.
4. **Seedfall** at t = 17: 2 seeds.

**Transition 2 at 35%, "Uprooting"** (2.6 s):
- The flower inverts and Veyra tears free.
- The tree splits: half of the branch instances fly off (shard VFX).
- **The half of the arena opposite the player's current position** drops away. Tiles in that half fall with tumbling physics into the void (fog below), staggered by distance over 1.5 s.
- Veyra relocates to the center of the remaining half.
- The arena bound becomes the circle radius 15 intersected with the half-plane (stored as `arenaCut` normal and offset; the player clamp handles it).
- A violet → blood-rose palette.
- Camera shake 0.8.

**Phase 3, "Thornheart" (35%–0%, enrage).** Loop of 12 s.

1. **Thorn Ring** (continuous):
   - A ring of crystal thorn projectiles (static, R) at radius `ringR` that shrinks from 14 to 6 at 0.35 m/s.
   - Touching it does 15 dmg plus a knockback toward the center.
   - Visual: instanced spikes (60 instances, reusing the projectile shader on cone geometry, separate mesh).
   - **Resets to 14 when Veyra's Fracture reaches 100 or a vulnerability triggers** (encourages the Mirror/Nova play).
   - Also resets after each Shatterbloom-type stagger.
2. **Root Lash ×2** at t = 0 and t = 3: 4 lines each, wind-up 0.9 s.
3. **Seed Volley** at t = 6: 4 seeds (saplings heal still applies).
4. **Thorn Volley** at t = 8: 4 fans of 7.
5. **Bloom Shield** returns at t = 10, but only once every two loops (alternate loops), with a 7 s cast.

**Death:**
- Veyra crystallizes white, then shatters. The leaf vortex collapses into her and explodes outward as 1,500 sparkles (switch the leaf shader to a scatter mode).
- The remaining tiles light up in a rainbow wave.
- `uSat` lerps → 0.75.
- Title card "VEYRA — UNBOUND", then the Facet pick, then the descent.

### BOSS 3: THE NULL SUN, ECLIPSE SOVEREIGN (hard; ~3:45; HP 32,000; Supernova countdown in P3)
- **Charge it feeds:** all colors, especially B, plus some W shots.
- **Arena:** Event Horizon. Disc radius 15, floor arena 2. The starfield swirls (a starfield shader uniform rotates the stars around the y-axis faster near the horizon).

**Gravity:**
- A constant pull toward the center of 0.8 m/s (P1), 1.4 (P2), 2.0 (P3), added to player velocity (not to the dash).
- Within 2.6 m of the center (under the sun): 20 dmg per 0.5 s plus a push-out. The black center is lethal-ish.

**Look:**
- **The sun.** A black sphere (radius 2.4) at height 4.5 above center, with:
  - **Corona:** a camera-facing billboard plane of 14 × 14 with an fbm flame shader. Polar coordinates, `fbm(vec2(angle*3, r*4 - t))` flares, color ramp B → white (P1), white-hot (P2), red ring (P3).
  - **Rim:** a thin fresnel rim shell sphere (radius 2.5, additive).
- **Gravitational lens:** LensFX `uWarpCenter` = the sun's screen position (project each frame into a preallocated vector), `uWarpStrength` 0.04, `uWarpRadius` 0.18. Disabled on low.
- **3 Prism Moons:** octahedrons of radius 0.7 in R, G and B, orbiting at radius 4 around the sun with crystal shaders.
- **Hitbox:** the sun, sphere radius 2.6 at center height 4.5. Treat it as a cylinder for player bolts: horizontal distance < 2.6.

**Phase 1, "Corona" (100%–70%).** Loop of 14 s.

1. **Solar Flare** at t = 0:
   - Cast 1.0 s. A wide sweeping arc of B projectiles: a fan that rotates while emitting, 120° sweep in 2 s, 16 shots/s, speed 7.
   - It creates a curved "wave" wall. Great for Mirror (reflect).
   - Done twice from opposite directions, 2.5 s apart.
2. **Corona Pulse** at t = 5.5:
   - 3 expanding ring hazards from the sun's ground point, 0.6 s apart. Each ring is 0.9 m thick, expanding at 6 m/s to radius 16.
   - Ring telegraph: a ring decal shows the expansion path. Rings are rendered as ring FX meshes with a hazard check of `|dist - ringR| < 0.45 + hurt`.
   - They reach the arena edge, so they are designed as "dash through" checks: the only clean answer is a **dash through** (perfect graze).
   - Each ring gives a perfect graze when dashed (B color), dmg 14 if hit.
   - The first time, a toast says "DASH through the rings".
3. **Sunspot** at t = 9: 5 circle telegraphs, radius 2.4, wind-up 0.8 s, staggered 0.3 s, targeting the player's predicted position (pos + vel×0.8). dmg 18.
4. **Prism Shards** at t = 11.5: each moon fires an aimed burst of 5 in its own color (R/G/B) at the player, speed 9.

**Transition 1 at 70%, "Collapse"** (2.6 s):
1. The sun collapses to a pinpoint (scale → 0.05 over 0.5 s).
2. Total darkness for 0.6 s, where only the player's crystal core is visible. Implementation: set every non-player material's emissive to 0 and the hemisphere and directional intensity to 0, keeping the player's emissive core lit, and set LensFX `uDark` to 0.8 so the player's bloom still shows.
3. Then it reignites: bloom +2.5, aberration 0.015, the shock ring, and the sun becomes a white star (corona color white-cyan).
4. The floor swirl direction flips.
5. Sub boom.

**Phase 2, "Prism Court" (70%–40%).** Loop of 18 s.

1. **Moons Detach** at the phase start (once):
   - Moons orbit at radius 9 at floor level + 1.5 m, at 0.4 rad/s. Each has HP 1,400, so it takes 10 Lances or a lot of reflects/bolts.
   - Each moon fires a rotating 3-way stream of its color: 6 shots/s, speed 6.
   - **While any moon lives, the sun takes ×0.5 damage.** All 3 dead: the sun is stunned 4 s (×1.5 damage) and gains +50 Fracture.
   - Moons **don't respawn**: once dead, the remaining P2 is just the sun's attacks.
2. **Gravity Well** at t = 3:
   - Cast 2 s "Gravity Well". The pull becomes 6 m/s for 3 s.
   - A red center circle telegraph of radius 5 shows the danger.
   - **Cyan safe pockets:** 4 circles of radius 1.8 at radius 8–10. Standing inside a pocket negates the pull and the damage.
   - Anyone inside the red radius at resolve: 30 dmg.
3. **Tether ("Solar Chain")** at t = 8 (Tidebreak graft):
   - A blue beam tethers the player to the sun. Duration 6 s.
   - If the horizontal distance from the sun is < 8 m, the player takes 6 dmg every 0.5 s and the beam turns red. At ≥ 8 m it is blue and harmless.
   - Pairs with gravity: you must keep walking outward.
   - The tether can be cut early by Mirror (blocks the beam, +20 Fracture).
4. **Sunspot** at t = 12: 6 circles.
5. **Corona Pulse** at t = 15: 2 rings, faster at 7.5 m/s.

**Transition 2 at 40%, "Eclipse"** (3.0 s):
- The camera swoops to a dramatic low angle looking up at the sun (camPos (0, 1.5, 11), look (0, 4.5, 0)).
- A black moon (sphere 2.5) slides across in front of the sun.
- The corona morphs into a thin ring of fire with a "diamond ring" flare (a star-flare quad, a 4-point streak shader, at one edge).
- The arena palette flips: deep red and black with white highlights. The floor's temperature ramp goes red.
- `uSat` temporarily goes to 1.0 for the red/white only (the floor goes red). Music drops to a heartbeat sub pulse.

**Phase 3, "Supernova" (40%–0%).**
- **Supernova Countdown:** a 100 s soft-enrage timer, shown as a big ring on the HUD and visualized as the sun scale growing from 1.0 to 1.8. At 0: wipe.

Loop of 16 s:
1. **Singularity Cracks** at t = 0:
   - 3 line telegraphs (cracks) across the floor, wind-up 1.0 s.
   - On resolve they become **void holes**: circles of radius 2.0 at the line midpoints, which persist for 12 s (max 6 holes; the oldest closes). Rendered via floor `uVoid` uniforms.
   - Entering a hole: 15 dmg plus push-out.
2. **Eclipse Flare** at t = 2: Solar Flare at speed 8, twice, now mixing R/B colors alternately.
3. **Corona Pulse** at t = 6: 3 rings at 8 m/s.
4. **White Halo** at t = 8.5:
   - A slow white (W) dense ring of 36 shots, 3 times, rotated 5°.
   - Grazing a W shot gives +3 all, the key way to fuel Nova.
5. **Frontal Eclipse (cleave)** at t = 11:
   - Cone 70°, length 16, wind-up 0.8 s, aimed at the player, dmg 25.
   - It then repeats once rotated 180° (two-direction check).
6. **Gravity Well** at t = 13: a shorter 2 s pull at 5 m/s, with 3 pockets.

**"Last Light" (10% HP; scripted final check, once):**
1. The boss becomes immune and starts the cast "LAST LIGHT" (10 s, a huge cast bar in the center of the screen).
2. Fracture fills to 100 automatically.
3. A ring of W shots spirals continuously at low density (5 shots/s, slow) so the player can graze to top up Nova.
   - **Insurance for players who arrive without charge:** during Last Light, all grazes give ×2 charge, and bolts give +3 to all channels.
4. A large prompt shows above the abilities: "UNLEASH WHITE NOVA" with the Nova button pulsing.
5. **If Nova lands before the cast completes:**
   - The boss's remaining 10% is executed through a **cinematic kill** (§5.3 Death). A Nova during Last Light is lethal regardless of damage.
6. **If the cast completes:** an arena wipe of 999 dmg. Retry restarts boss 3 at phase 3 start (40% HP) as a checkpoint, with charge 40/40/40. This is the only mid-boss checkpoint, because boss 3 is long.

**Death, "Dawn" (8 s, the game's finale):**
1. The Nova white-out holds.
2. The sun cracks with white light rays: 12 additive long quads radiating, the "god rays" burst.
3. timeScale 0.15 for 1 s. The camera rises.
4. The sun shatters into 220 shards that become rainbow particles.
5. `uSat` 0.75 → 1.0.
6. The floor transitions to a **dawn reef**: the accretion disk shader becomes a calm iridescent mirror with a rainbow hex wave rippling out repeatedly.
7. An **aurora**: 3 large vertical ribbon planes far away, with an fbm aurora shader in green/violet/cyan, fading in.
8. The starfield brightens and becomes colorful.
9. The music resolves to a major chord with an arpeggio.
10. Then the Victory screen.

---

## 6. Game Flow, UI & HUD

### 6.1 Title screen
- **Background:** the live 3D scene: a slow orbit around an empty dark Ember Pond with the starfield and nebula, the floor hex wave pulsing every 4 s.
- **Title:** "PRISMFALL" in large letter-spaced type. No external fonts: use `Georgia, 'Times New Roman', serif`, letter-spacing 0.4em, weight 300.
  - A gradient text fill with an animated hue (`background-clip:text`).
- **Subtitle:** "THE LIGHTBREAKER RAID".
- **Prompt:** "Tap to descend" or "Click to descend", pulsing.
- **Small buttons:**
  - "Boss Select": unlocked bosses only. Progress is in localStorage. Bosses 2 and 3 unlock after first beating the previous one.
  - "Settings": Reduce effects toggle, Quality (Auto/High/Med/Low), Sound volume.
- **Stats line:** best clear times per boss and full run, plus deaths.
- **On tap:** unlock the AudioContext. The title text shatters into particles: an HTML title fade plus a 3D particle burst at screen center projected to world space. Then the intro.

### 6.2 Intro cinematic (5 s)
| Time | What happens |
|---|---|
| t 0–1.6 s | The camera falls from y = 80 to the arena, with starfield streak mode (`uStreak` 1→0), FOV 90 → 50. |
| t 1.6 s | The player crystal lands: shards reform at the center-south (0, 0, 7). Impact ring, floor rainbow hex wave from the landing point, bloom spike +1.5, trauma 0.5, sub boom. |
| t 2.2–4.2 s | The 8 lanterns ignite one by one around the circle (0.25 s apart), each with a chime ascending in pentatonic order. The camera pans up to the heart. |
| t 4.2 s | Letterbox bars, then the title card "THE LANTERN CHOIR" / "First Refraction". The music kicks in. |
| t 5.0 s | Control is given. The HUD fades in. |

- **Skip:** any tap after 1 s skips to t = 4.6.
- **Boss 2/3 intros:** a 3 s version showing the camera dolly toward the boss, the title card, then the fight.

### 6.3 Descent interstitial (between bosses, 3 s, after the Facet pick)
- The player is pulled **downward**, through the floor.
- The screen fades to a starfield streak with depth text "DEEPER INTO THE PRISM" and the next boss's subtitle.
- Swap the arena assets (show/hide groups), then the boss intro.
- Charge resets to 30/30/30 and HP to full.

### 6.4 HUD (HTML/CSS overlay, `pointer-events:none` except buttons)
All positions respect `env(safe-area-inset-*)`.

- **Top center: the boss frame.** Width min(560 px, 86 vw).
  - Boss name (small caps, letter-spaced) plus the enrage timer at right.
  - HP bar 14 px:
    - gradient fill in the boss color
    - a trailing "damage chunk" bar (white, lerps down after 0.4 s)
    - phase notch ticks at the thresholds
    - HP % at the right
  - Below: the Fracture bar (4 px, white; it glows when full) and the shield indicator ("×0.5 DMG" pill when shielded).
  - **Cast bar:** under the boss frame. Cast name plus a fill (orange = uninterruptible, white = breakable by mechanic). It fades out when idle.
- **Top left (desktop) / under the boss bar (mobile portrait): player HP.**
  - A slim bar, 200 px, with HP number.
  - The graze combo appears beside it ("GRAZE ×12", color-cycled).
- **Spectrum readout:** 3 small vertical pills R/G/B with numbers. On mobile they sit to the left of the ability arc, near the thumb. They are also drawn on the in-world ring around the player.
- **Center toasts:** tutorial prompts and mechanic warnings ("BREAK THE PETALS!", "DASH THROUGH!"). A pool of 1 element; a newer toast replaces it.
- **Big center cast bar** for Last Light.
- **Damage numbers:** in-world sprites (§2.7).
- **Low HP:** below 30%, LensFX `uLowHp` pulses red vignette and a heartbeat SFX plays.
- **Pause:** a button at the top right, at a 44 px hit target (and Esc/P on desktop).
  - The pause menu has Resume, Restart Boss, Settings, Quit.
  - Auto-pause on `visibilitychange` to hidden.

### 6.5 Ability buttons (touch)
- **Layout:** the bottom-right arc, inside the safe area. Sizes are in CSS px, scaled by `min(1, shortSide/400)`:
  - **Dash:** 84 px, closest to the bottom-right corner (right 22, bottom 22). It shows 2 charge pips.
  - **Lance:** 66 px, left of the dash.
  - **Lattice:** 66 px, diagonal upper-left of the dash.
  - **Mirror:** 66 px, directly above the dash.
  - **Nova:** 74 px, at the arc center (above-left, between lattice and mirror), hidden until available. When available it scales in, pulses white with a rainbow conic border, and "NOVA" text shows.
- **Portrait:** the same arc, scaled to 0.9.
- **Each button:**
  - A dark glass circle (backdrop-filter blur(6px) with a `-webkit-` prefix and an rgba fallback).
  - An icon drawn in inline SVG (dash = chevrons, lance = spear line, lattice = hexagon, mirror = shield hex, nova = 8-point star).
  - A **color fill showing affordability:** the inner glow of its channel color, with fill height equal to `min(1, charge/cost)`. When unaffordable the button is grey and desaturated.
  - **Cooldown sweep:** a `conic-gradient(rgba(0,0,0,.6) X%, transparent X%)` overlay, plus the remaining seconds as text (1 decimal under 1 s).
  - Pressed state: scale 0.92 and a flash.
- **Input:** buttons use `pointerdown` (touch included) with `preventDefault`. Multi-touch is tracked per pointerId, so movement and buttons work at the same time.

### 6.6 Joystick (touch)
- **Zone:** pointers starting in the left 55% of the screen, outside the button rects and HUD buttons.
- **Floating:** on touchstart, the base ring appears under the thumb (radius `R = clamp(shortSide*0.14, 48, 80)` px). The knob follows within R.
- **Dead zone** 0.12. Output magnitude is `(len - dz)/(1-dz)`, clamped to 1.
- **Release:** the base fades out over 150 ms and input is set to 0.
- **Re-anchor:** if the thumb drags beyond 1.6R, the base follows (drag base).
- **Visuals:** an SVG/CSS ring with a soft glow; the knob is a gradient circle.
- **Camera-relative movement:** the camera is fixed-yaw (looking −z), so screen-up maps to world −z.

### 6.7 Desktop controls
| Action | Input |
|---|---|
| Move | WASD / arrows (normalized diagonal) |
| Aim | mouse ground point (raycast y = 0). If the mouse hasn't moved for 3 s or is outside the canvas → auto-target. |
| Dash | Space, Shift, or right mouse button (in the direction of movement, or the mouse direction if idle) |
| Crimson Lance | 1 / Q / J / left click |
| Verdant Lattice | 2 / K (not W: W is movement) |
| Azure Mirror | 3 / E / L |
| White Nova | 4 / R / F |
| Pause | Esc / P |

Show the key hints on desktop buttons (the buttons are also visible and clickable on desktop, smaller at 56 px).
- **Prevent:** the context menu on the canvas, and default actions for Space/arrows.

### 6.8 Page / viewport hygiene
- `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">`
- Styles on `html, body`:
  - `margin:0; height:100%; overflow:hidden; background:#000; touch-action:none; overscroll-behavior:none; -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent`
- Listeners: `touchmove` / `gesturestart` / `dblclick` → preventDefault (passive:false).
- **Sizing:** use `window.innerWidth/innerHeight` (and `visualViewport` resize). The canvas is `position:fixed; inset:0`. Handle the `orientationchange` and `resize` events with a 100 ms debounce.
- `<meta name="theme-color" content="#000">` and `apple-mobile-web-app-capable`.

### 6.9 Facet screen
- Three tall cards of 30% width each (portrait: stacked vertically, each 80% width).
- Each card has an icon glyph, a name, and a one-line description.
- Selection effect: the card glows and shatters (CSS) and then the descent starts.

### 6.10 Victory / defeat
- **Defeat:** "SHATTERED", the boss HP remaining %, the time, and buttons Retry (default, big) and Title. Death counts are stored.
- **Victory (after boss 3):**
  - "THE PRISM RESTORED".
  - Total run time, per-boss times, total grazes, perfect dashes, deaths, and facets chosen.
  - A new-best highlight in gold.
  - Buttons: "Again" and "Title".
  - The background is the aurora dawn scene, slowly orbiting.
- **localStorage key `prismfall.v1`:** `{unlocked:1..3, best:{b1,b2,b3,run}, deaths, settings:{quality, reduceFx, volume}}`.
  - Wrap every access in try/catch; it is a plain object fallback.
  - Boss-select runs record per-boss bests only. A full run (from the title "Descend") records the run time.

---

## 7. Audio (WebAudio, all synthesized)

### 7.1 Graph and unlock
**Graph:**
- `ctx` → `master` gain (volume setting) → `DynamicsCompressor` (threshold −14, ratio 4) → destination.
- Buses: `musicBus` (0.5), `sfxBus` (0.8).
- A shared reverb: a `ConvolverNode` with a procedurally generated impulse (2.5 s of decaying stereo noise, rendered once at init into an AudioBuffer). Send from the music and chime buses at 0.3.

**Unlock:** create or resume the ctx on the first pointerdown/keydown (title tap). Play a silent buffer for iOS.

### 7.2 Music sequencer
- A lookahead scheduler: a 25 ms setInterval schedules notes 0.1 s ahead using `ctx.currentTime`. No per-note object churn beyond the oscillator nodes, which are unavoidable but cheap.
- **Layers:**
  - **Pad:** 3 detuned saws (±7 cents) per chord tone through a lowpass (cutoff 600–2,000 Hz, LFO 0.1 Hz). Chord changes every 2 bars. Implemented as persistent oscillators whose frequencies ramp on chord change (`setTargetAtTime`), so it creates no nodes.
  - **Arp:** a triangle/square pluck (osc + gain envelope 5 ms attack, 180 ms decay) through a delay (dotted 8th, feedback 0.35). 16th notes from the current scale.
  - **Bass:** a sine plus a soft sub pulse on beats 1 and 3. In Boss 3 P3 it becomes a heartbeat (two thumps).
  - **Percussion** (fight only): a noise hi-hat (highpass noise buffer 30 ms) on 8ths, and a kick (sine 120→40 Hz, 0.25 s) on beats. It is introduced in phase 2 of each boss for build-up.
- **Keys and scales per boss phase** (tempo in BPM):

  | Section | Key / scale | Tempo | Chords and notes |
  |---|---|---|---|
  | Title | D minor pentatonic | 70 | pad only, sparse arp |
  | B1 P1 | A minor (Aeolian) | 96 | i–VI–III–VII |
  | B1 P2 | A Phrygian dominant (exotic fire) | 112 | adds percussion |
  | B2 P1 | E Dorian | 104 | |
  | B2 P2 | E Lydian (eerie bright) | 110 | |
  | B2 P3 | E Phrygian | 124 | full percussion |
  | B3 P1 | C# minor | 100 | |
  | B3 P2 | C# whole-tone / Locrian flavors | 116 | |
  | B3 P3 | C# Phrygian, half-time heavy | 128 | the heartbeat bass gets faster as Supernova counts down |
  | Victory | D major Lydian | 84 | big pad and arpeggio, bells |

- **Phase change:** a key change is scheduled on the next bar, preceded by a riser (noise plus a rising bandpass, 1.2 s) and a sub boom (sine 55→30 Hz, 1.5 s).

### 7.3 SFX (each a function creating a few short-lived nodes)
| Sound | Recipe |
|---|---|
| Prism Bolt | very soft high sine blip (2,400→1,800 Hz, 40 ms, gain 0.04). Rate-limited to 1 per 0.09 s. |
| Graze chime | sine plus a 2× partial bell envelope (300 ms), pitch from the current scale. Register by color: R scale degrees in octave 4, G in octave 5, B in octave 6; W plays a 3-note chord. Combo index steps the degree. |
| Perfect | the graze chime plus a reverse "shhk" plus a shimmer (3 detuned high sines). |
| Player hurt | low noise burst plus a detuned square 110 Hz drop, 120 ms. |
| Lance | see §3.5. Lattice: airy chord. Mirror: FM bell. Nova: swell plus stab plus sub. |
| Telegraph tell | per shape: circle = soft "tok" (sine 600, 30 ms), line = rising zip, cone = low growl (saw 80 Hz through a lowpass), ring = whoosh. Plays at resolve −0.3 s. |
| Telegraph resolve | filtered noise impact, gain scaled by distance to the player. |
| Boss hit | a soft tick when Lance or reflects connect (no per-bolt sound). |
| Transition | riser plus boom plus glass shatter (a cluster of 12 random high sine pings with exponential decay over 0.4 s, plus noise). |
| Lantern chimes (B1 intro/death), boss death | huge glass shatter plus a sub drop plus a chord. |
| UI | button tick (sine 900, 15 ms). |
| Low HP | heartbeat thump every 0.8 s. |

### 7.4 Voice cap
Max 24 concurrent SFX voices, tracked via a counter that decrements on `onended`. Skip low-priority sounds (bolt, tick) when over the cap.

---

## 8. Performance Plan

### 8.1 Quality tiers (CONFIG.quality)
| Setting | High | Med | Low |
|---|---|---|---|
| pixelRatio cap | 2.0 | 1.5 | 1.0 |
| Bloom | full-res | half-res | half-res, lower strength |
| LensFX | full | full | LOW define: no warp, no grain |
| Particles cap | 4,000 | 2,500 | 1,200 |
| Projectile trails every N frames | 3 | 4 | 6 |
| Candles (B1) | 400 | 300 | 180 |
| Leaves (B2) | 1,500 | 1,200 | 600 |
| Stars | 3,000 | 2,000 | 1,200 |
| fbm octaves (floor/corona) | 4 | 4 | 3 |
| Antialias | on (desktop) | off | off |

- Instance counts are set by `mesh.count` (allocate at the high size, draw fewer), so changing tier needs no rebuild.
- The particle cap changes the ring-buffer wrap length.

### 8.2 Adaptive controller
- Rolling FPS over 2 s windows, ignoring windows that contain cinematics' first 0.5 s or a tab-hidden period.
- avg < 45 → drop a tier (at most one step per 3 s).
- avg > 58 for 6 consecutive seconds → step up, to at most high on desktop and at most **med** on touch devices (unless the user forces high).
- If at low and still < 30 fps: pixelRatio 0.75 as an emergency floor.
- Auto mode can be overridden in Settings, and via `__game.forceQuality(tier)` which disables auto.
- **Under SwiftShader tests** FPS will be terrible; tests should call `forceQuality('low')` and use timeScale stepping. Don't tune against it.

### 8.3 Hot-loop rules
- No `new` in update functions. No closures created per frame. No array `push`/`splice` in pools (use free-index stacks).
- HUD DOM writes only when the rounded value changes. Cooldown sweeps update at most 30 Hz.
- Projectile instance matrices are written directly into `instanceMatrix.array` (compose translation and uniform scale by hand: 16 floats), then set `needsUpdate` once per frame.
- Damage-number canvas redraws happen only on spawn.
- Boss-specific groups are `visible=false` when inactive, so their render cost is zero.
- `renderer.info` is exposed in debug.

---

## 9. Debug API: `window.__game`

Always present; harmless. Shape:
```js
window.__game = {
  get state(),            // 'title'|'intro'|'fight'|'cinematic'|'facet'|'defeat'|'victory'|'paused'
  get player(),           // {hp, maxHp, x, z, r, g, b, dashCharges, iframes}
  get boss(),             // {index, name, hp, maxHp, phase, fracture, vulnerable, shielded, cast, enrageLeft}
  get fps(), get quality(), get projectiles(),  // active count
  stats: {grazes, perfects, deaths, time},
  start(),                // skip title+intro → boss 1 fight
  setBoss(n),             // 1..3 → instantly start that boss's fight (skip intro cinematics; skipIntro default true)
  setPhase(p),            // jump current boss to phase p (0-based): sets hp to threshold, runs transition cinematic (pass {instant:true} to skip it)
  killBoss(),             // triggers death sequence of current boss
  damageBoss(n),
  godMode(on=true),       // player takes no damage
  fill(),                 // R=G=B=100, cooldowns reset
  timeScale: 1,           // settable multiplier
  forceQuality(t),        // 'high'|'med'|'low'|'auto'
  skipCinematic(),        // jump current cinematic to end
  setCam(x,y,z,lx,ly,lz), // optional: lock camera for screenshots; setCam(null) to release
  cast(name),             // force a named boss attack now (e.g. 'Chorus','Shatterbloom','GravityWell','LastLight') for screenshots
  facet(id), victory()    // pick a facet / jump to victory screen
};
```
- Also: `?debug=1` URL param shows an FPS/tier overlay. `?boss=2` starts directly at boss 2 (still requires the tap to unlock audio).

---

## 10. Implementation Order (for the builder)

1. **Skeleton.** HTML/CSS, importmap, renderer and composer, LensFX, resize/orientation, the quality system, the loop, the debug API stub.
2. **Floor and starfield.** Ember Pond floor shader, starfield and nebula. Verify screenshots.
3. **Player.** Model, movement, joystick and keyboard, camera, Prism Bolt, the particle system, dash with afterimages.
4. **Combat core.** Projectile pool, hazard resolver, graze and perfect, telegraph pool, HUD (HP, spectrum, boss frame, cast bar), damage numbers.
5. **Boss shell and scheduler.** Then Boss 1 fully, with transition and death. The director (cinematics, hit-stop, shake).
6. **Abilities.** Lance, Lattice, Mirror, Nova, Fracture/vulnerability, touch buttons with sweeps.
7. **Audio.** Graph, music sequencer, SFX.
8. **Boss 2.** Hex columns, tree, leaves, saplings, petals, soak tower, arena drop, thorn ring.
9. **Boss 3.** Accretion floor, corona, lens warp, moons, gravity, tether, rings, voids, eclipse, Last Light, dawn finale.
10. **Flow.** Title, intro, facets, descent, victory/defeat, localStorage, settings, pause.
11. **Polish and perf.** Precompile, tier tuning, readability pass in screenshots at each boss phase, portrait and landscape checks.

### Test checklist (Playwright via harness, mobile and desktop)
- No console errors on load, start, and setBoss(1..3).
- Screenshots:
  - title
  - intro landing
  - each boss P1
  - each transition mid-cinematic
  - each later phase
  - Nova whiteout
  - victory aurora
  - portrait 390×844 and landscape 844×390
- Touch drag on the left moves the player (`__game.player.x/z` changes). A tap on dash changes `dashCharges`.
- godMode plus timeScale 4: each boss can be killed via `damageBoss`, and phases advance in order with no exceptions.
- Last Light: with `fill()` then pressing Nova during the cast → victory.
