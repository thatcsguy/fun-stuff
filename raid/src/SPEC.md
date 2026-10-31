# SHATTERCLOCK — A Raid for One
### Final Design Spec (implementation contract)

> **Base:** Concept 2 (Shatterclock / Chronoblade), which two of the three judges picked.
>
> **Grafted in:**
> - **From Concept 1:** god-scale background set pieces that are not part of collision, a cinematic ultimate, the "titan tears out the sun" moment, black-hole lensing, a fall-into-the-singularity transition, and a new-star epilogue.
> - **From Concept 4:** fixed-step simulation, pools everywhere, Shockwave Stomp rings, a dark telegraph halo, adds that damage the boss, a soak that causes a burn-window stun, and the 35% damage rule.
> - **From Concept 3:** a telegraph tone whose pitch rises as the hit approaches, a white rim flash in the last 0.3 s, a noise dissolve, the player's colours tracking their resources, and lerped colour grading.
>
> **Deliverable:** ONE file, `index.html`, about 4,500–6,000 lines. Three.js r170 is the only dependency. Fonts are Cinzel and Rajdhani from Google Fonts, and the game must still work if they fail to load.

---

## 0. Hard rules (non-negotiable)

1. **One file.** It contains an importmap and `<script type="module">`. No other assets. Every texture is generated procedurally (canvas or shader).
2. **Importmap:**
   ```json
   { "imports": {
       "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
       "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }
   ```
   Only these addons are used: `postprocessing/EffectComposer.js`, `RenderPass.js`, `UnrealBloomPass.js`, `ShaderPass.js`, `OutputPass.js`.
3. **Fixed-step 60 Hz simulation.**
   - Rendering interpolates between sim steps. Frame dt is clamped to 0.1 s and there are at most 5 sim steps per frame.
   - `timeScale` (hit-stop and slow-mo) scales sim dt only. UI, audio and camera shake run on real time.
   - The game auto-pauses on `visibilitychange`.
4. **Tone mapping:**
   - Set `renderer.toneMapping = ACESFilmicToneMapping` and the exposure on the renderer.
   - The composer ends with `OutputPass`, which applies tone mapping and sRGB exactly once.
   - Custom ShaderMaterials must not tone map themselves.
5. **No allocation in the hot loop.** Use scratch `Vector3`s and pools for telegraphs (48), hazards (32), projectiles (64), adds (12), damage numbers (48), particles (ring buffer) and point lights (3).
6. **Telegraph readability rule:**
   - Telegraph **interiors stay below the bloom threshold** (luminance ≤ 0.6). Only the rim and the resolve flash go above 1.0.
   - Every telegraph has a dark outer halo for contrast.
7. **Damage rule (Normal):**
   - An unavoidable hit is never more than 35% of max HP (350).
   - An avoidable hit can be up to 900.
   - Two stacked mistakes kill a full-HP player. One mistake never does, except for the enrage and the explicitly lethal mechanics, which are flagged.
8. **Error handling:**
   - A friendly error overlay appears if the module or WebGL fails ("Couldn't load the raid — check your connection").
   - On `webglcontextlost`, a "Tap to reload" overlay appears.
9. **All numbers live in one `CONFIG` object at the top of the script:** player, abilities, bosses per difficulty, quality tiers and talents.

---

## 1. Title & Premise

**SHATTERCLOCK — A Raid for One**

Time is breaking. Three Thrones hold the hours hostage, and each one sits under a horror older than the sky:
- a magma titan that eats suns,
- a moon-serpent that coils around the world,
- a black hole that swallows the last hour.

You are the **last Chronoblade**, a duelist in a long dark coat with glowing cyan seams. You carry one curved blade with a hollow hourglass in its hilt. *"I don't dodge attacks. I step out of the moment they happen in."*

You climb three thrones, and each fight lasts 2.5–4.5 minutes:

| # | Boss | Arena | Colossal backdrop | Palette arc |
|---|------|-------|-------------------|-------------|
| I | **PYRRHA, the Forge-Warden** | Obsidian disc over a magma sea | **VORATH**, a 60 m magma titan whose hands grip the arena rim. At 60% he tears the sun out of the horizon. | Warm: amber / blood-orange / gold |
| II | **NERITH, the Drowned Choir** | Sunken moonlit cathedral | **NYXARA**, a 400 m moon-serpent whose coils pass overhead and block the moon | Cold: teal / ice-cyan / violet |
| III | **AUREN, the Unwound Hour** | Shattered clock face at the edge of a black hole | **The Singularity**, a lensing black hole with a Doppler accretion disk | Inverted: black / white / magenta / gold |

The core feeling: **"I am tiny, the world is enormous, and I am conducting time."**

---

## 2. Player Class: THE CHRONOBLADE

### 2.1 Base stats
| Stat | Value |
|---|---|
| Max HP | 1000 |
| Move speed | 6.5 m/s (analog; full speed past 85% stick deflection) |
| Collision radius | 0.5 m |
| Regen | None. Healing comes only from Recall, Grand Shatter and the Kintsugi talent. |
| Melee range | 4.5 m (measured to the boss hit-cylinder surface) |
| Ranged auto range | 22 m |

### 2.2 Targeting & facing
- There is exactly one hostile target at a time: the boss by default.
- If an add is within 6 m **and** the boss is more than 10 m away, the nearest add becomes the target.
- **Abilities never miss because of aim.** Cones are aimed at the target when the ability fires.
- **Facing:**
  - While moving, the character faces the move direction.
  - While standing still, the character auto-faces the target.
  - When an ability fires, the character snaps to the target over 0.08 s, with a blade-trail arc so the snap looks intentional.

### 2.3 Resources (three, all readable without looking at the HUD)
1. **FLUX** (0–100, cyan arc).
   - Built by hitting things and by playing mechanics well. Spent on Shatter.
   - **Overflow:** Flux gained past 100 converts to Hourglass at a 5% rate (100 overflow = +5 Hourglass), so overcapping is never totally wasted but is still inefficient.
   - **Coat seams:** they glow at intensity 0.4 + 1.2 × Flux/100 (cyan). At ≥ 50 they also pulse.
2. **FRACTURES** (0–5 stacks, on the boss).
   - Shown as 5 crack pips above the boss's head and as cyan Voronoi cracks spreading over the boss mesh (`uFracture` 0..1 via onBeforeCompile).
   - All stacks fall off 8 s after the last Rend. The pips flicker during the final 2 s.
   - **Blade:** at 5 stacks the blade burns gold.
3. **HOURGLASS** (0–100, the ultimate meter; a gold ring around the Zero Hour button).
   - Gains:
     - Grand Shatter +10
     - Perfect Dodge +8
     - Successful interrupt +15
     - Flux overflow at 5%
   - The hilt's hourglass mesh fills with gold sand particles as it fills.

### 2.4 Auto-attack (no button)
| Range | Attack | Damage | Cadence | Flux |
|---|---|---|---|---|
| ≤ 4.5 m | 3-hit blade combo (slash, slash, spin) | 60 / 60 / 120 | 1.6 s cycle (about 150 DPS) | +3 per hit |
| 4.5–22 m | **Second Hands**: glass needle projectiles, homing, speed 30 m/s | 45 | every 0.8 s (about 56 DPS) | +2 |

Autos keep firing while moving. They pause only during Recall, Zero Hour and cinematics.

### 2.5 Abilities

| # | Ability | Desktop | Mobile | CD / Charges | Cost |
|---|---|---|---|---|---|
| 1 | **PHASE STEP** (dash) | Space / Shift | 72 px | 2 charges, 6 s each | — |
| 2 | **REND** (builder) | Q / LMB / 1 | 88 px (primary) | 2.5 s | — |
| 3 | **SHATTER** (spender) | E / RMB / 2 | 72 px | 1.0 s | 50 Flux |
| 4 | **RECALL** | R / 3 | 60 px | 14 s, needs an Echo | — |
| 5 | **STASIS LANCE** (interrupt) | F / 4 | 60 px | 20 s | — |
| 6 | **ZERO HOUR** (ultimate) | T / 5 | 64 px with gauge ring | needs 100 Hourglass | 100 Hourglass |

**1. PHASE STEP**
- Dashes 8 m over 0.16 s in the stick direction. With the stick neutral, it dashes straight away from the boss.
- **0.25 s of full invulnerability** from the start of the dash. Collision clamps the dash to the arena edge, so it never leaves the arena.
- **Leaves an ECHO** at the start point:
  - The Echo is a frozen cyan afterimage of the current pose (a cloned skinned-less mesh with a fresnel-only material, scanline flicker and particles drifting upward).
  - It lasts 7 s. A new dash replaces it.
  - A ground ring under the Echo shrinks to show its remaining life.
- **PERFECT DODGE, "SLIPSTREAM"** (at most once per dash). It triggers if either:
  - (a) any damage event is negated by the dash invulnerability, or
  - (b) a telegraph that contained the dash start position resolves within 0.20 s after the dash starts (the lookahead check runs at dash start over every active telegraph and hazard; see §9.6).
- **SLIPSTREAM rewards:**
  - +25 Flux, +8 Hourglass, and one dash charge refunded.
  - 0.35 s at timeScale 0.25. The world desaturates to 0.85 while the player stays in full colour (the player renders in a second pass after the post chain; see §8.1).
  - Chromatic aberration pulse 0.006, a high "tick" sound, and a "SLIPSTREAM" stamp.
  - 10 ms haptic pulse.
- **VFX:** the player mesh fades, a 5-ghost afterimage trail of pooled meshes with dithered alpha appears, a portal ring decal shows at both ends, FOV kicks by +4° and recovers over 0.3 s, and a whoosh plays.

**2. REND**
- A 120° cone, 6 m long, aimed at the target. Usable at any range; it whiffs if nothing is inside.
- 180 damage to everything in the cone (it cleaves adds).
- +10 Flux and +1 Fracture if it hits the boss.
- **VFX:** a crescent of 24 frozen glass shards (InstancedMesh) hangs in the air for 0.3 s and then shatters (particle burst plus a glass tink sound).

**3. SHATTER**
- Consumes all Fractures. Damage = 100 + 150 per Fracture.
- Usable at 0 stacks, where it does 100 damage, so it is a valid Flux dump.
- **At exactly 5 Fractures it becomes GRAND SHATTER:**
  - Damage = (100 + 750) × 1.5 = **1275**.
  - Heals the player for 6% of max HP (60).
  - +10 Hourglass.
  - 70 ms hit-stop and a camera punch (trauma 0.3).
  - The boss's crack network blazes white (`uFracture` flashes to 2.0, then drops to 0 over 0.4 s).
  - The boss sheds 300 glass particles plus 40 instanced shards.
  - Bloom strength spikes +0.8 for 0.25 s.
  - A sub-bass thump plays.
- **Normal Shatter (1–4 stacks):** 40 ms hit-stop and trauma 0.15.
- **Key decision:** cash in early because a mechanic will force you away (and the stacks would expire), or gamble on reaching 5.

**4. RECALL**
- Enabled only while an Echo exists. The button shows the Echo's remaining life as a shrinking ring.
- Teleports to the Echo over 0.15 s, leaving a reversed-particle streak and a radial zoom-blur pulse.
- Heals 40% of the damage taken since that Echo was created.
- Cleanses **Entropy** (Boss 3).
- Consumes the Echo.
- **Core loop:** dash out of the hit, let the hit resolve, Recall back into melee, and recover some of the chip damage.

**5. STASIS LANCE**
- Range 25 m. A thrown spear of frozen time that travels at 60 m/s.
- **On an interruptible cast:**
  - Interrupts the cast. +30 Flux and +15 Hourglass.
  - Grants **BORROWED TIME**: 6 s of +30% cooldown recovery (Rend, Phase Step, Recall) and +30% auto-attack speed.
  - The boss freezes for 0.6 s inside a grey frame-freeze bubble. The cast bar shatters into shards.
- **Otherwise:** 250 damage, and an add hit is rooted for 3 s.
- **Button:** pulses violet whenever an interruptible cast is active.

**6. ZERO HOUR** (the ultimate, grafted from Concept 1)
- Needs 100 Hourglass. The button pulses gold when it is ready.
- 2.0 s cinematic, and the player is invulnerable throughout:
  1. Sim timeScale drops to 0.2. The camera whips over 0.3 s to a low hero angle beside the player, with letterbox bars sliding in.
  2. Skybox stars streak toward the blade (`uStreak` uniform on the sky shader), and 600 particles converge on the hilt.
  3. The player raises the blade. Time "stops": the post chain desaturates to 1.0, except for gold.
  4. One horizontal cut produces a white-gold crescent beam (a stretched quad with a scrolling-noise shader), followed by 12 frozen afterimage slashes on the target.
- **Effects:**
  - 4000 damage to the boss.
  - Destroys all adds and projectiles, and clears every lingering hazard pool that you are not standing on. (Persistent arena mechanics, such as clock hands and the current, are unaffected.)
  - Deals 2400 to every **unshielded** Chrono Anchor (Boss 3 intermission).
  - **Does NOT consume Fractures.**
- Hit-stop 120 ms, trauma 0.6, bloom spike +1.5.
- Expected uses per fight: about 1 for an average player, 2–3 for an expert.

### 2.6 Rotation logic (why it's interesting)
- **Ideal loop:**
  - Rend ×5 takes 12.5 s and Grand Shatter follows.
  - The bosses' main cadence is 9–14 s, so you are always deciding whether to cash in early, or to dash, Recall and Rend fast enough to keep the stacks.
- **Interrupts give Borrowed Time,** which drops Rend's cooldown to 1.92 s. Line up the Fracture ramp so Grand Shatter lands inside the haste window.
- **Perfect Dodges turn defense into offense:** Flux, a dash charge back, and Hourglass.
- **Recall is your heal, your uptime tool and, in Boss 3, your only Entropy cleanse.** Spending it greedily has a real cost.

### 2.7 DPS model (drives boss HP)
| Source | Expert (about 80% melee uptime) | Average (about 55%) |
|---|---|---|
| Melee autos | 120 | 83 |
| Needles | 11 | 20 |
| Rend | 65 | 50 |
| Shatter / Grand | 87 | 60 |
| Zero Hour | 70 | 35 |
| Borrowed Time and talents | 15 | 5 |
| **Total** | **≈ 370** | **≈ 250** |

### 2.8 Talents (pick 1 of 2 after each kill; can be re-picked on the Raid Map)
- **After Boss 1:**
  - **AFTERIMAGE:** your Echo detonates for 400 in a 4 m radius when you Recall.
  - **TRIPLE STEP:** 3 dash charges, and a Perfect Dodge also adds +1 Fracture.
- **After Boss 2:**
  - **BORROWED TIME+:** Stasis Lance cooldown 14 s, and the haste lasts 9 s.
  - **KINTSUGI:** Grand Shatter heals 12% and grants a 300-point golden shield for 6 s. Gold seams appear on the coat.

If a boss is selected directly from the map without the prior talent picked, the default is the first option.

---

## 3. Global Telegraph Language (identical in all three fights)

**One `TelegraphMaterial`** (ShaderMaterial):
- **Mesh:** one flat quad per telegraph, sized to the shape bounds, at y = 0.03 above the floor.
- **Render state:** `polygonOffset` (-2, -2), `depthWrite: false`, `depthTest: true`, `renderOrder: 5`.
- **Blending:** premultiplied, `CustomBlending` with `src = ONE`, `dst = ONE_MINUS_SRC_ALPHA`. This lets the halo darken the floor while the rim adds light.

**Uniforms:**

| Uniform | Meaning |
|---|---|
| `uShape` | 0 circle, 1 donut, 2 cone, 3 rect, 4 sector-wedge, 5 half-plane |
| `uP` (vec4) | radius / innerR / angle / halfW / halfL / etc. |
| `uProgress` | 0..1 |
| `uColor` | colour |
| `uPattern` | 0 stripes, 1 rings, 2 dots |
| `uFlash` | 0..1 |
| `uTime` | time |
| `uFillMode` | 0 = edge to centre, 1 = origin outward |
| `uPips` | soak counter |

**Rendering:**
- SDF per shape, then:
  - **Dark halo:** a 0.6 m band just outside the edge, with colour 0 and alpha 0.35.
  - **Rim:** a 0.25 m band at intensity 1.6 (it blooms).
  - **Interior:** colour × 0.30, plus a pattern overlay at × 0.15, plus scrolling hash-noise "heat" at × 0.08.
  - **Fill front:**
    - Circles and donuts fill from the **edge inward**. When the fill reaches the centre, the hit lands.
    - Cones, rects and lines fill **outward from the origin**.
    - The filled region gets colour × 0.55. That is still below the bloom threshold.
- **Last 0.3 s:** the rim pulses to white at 8 Hz.
- **Resolve:** a 0.12 s `uFlash` frame at 2.5 intensity, then the attack's VFX.

**Colour meanings:**

| Colour | Hex | Meaning | Pattern (colourblind) |
|---|---|---|---|
| Red-orange | `#FF4A1C` | Get OUT | Diagonal stripes, scrolling toward the nearest exit |
| Gold | `#FFC845` | SOAK, stand IN | Concentric rings pulsing inward, plus a pip counter |
| Violet | `#B266FF` | Special rule (line of sight, fate, mark) | Dotted rim |
| Green | `#5CFF9B` | Safe-zone hint (**Story only**) | Solid soft fill |

**Other cues:**
- **Cast bar** (under the boss HP bar):
  - Interruptible casts have a violet **shimmering** border, an "INTERRUPT" tag, and the Lance button pulses.
  - Uninterruptible casts have a grey border.
- **Boss pose tell** plus a callout banner for every major mechanic. The banner shows the ability name, Cinzel 28 px, upper third of the screen, for 0.8 s, and never covers the player.
- **Audio:** every telegraph starts a sine tone whose pitch rises linearly from 220 Hz to 660 Hz as it approaches impact. Volume 0.06, at most 3 voices (the most imminent win). A bright click plays at resolve.

**Minimum windups (Normal):**
- Boss 1: 1.4 s
- Boss 2: 1.2 s
- Boss 3: 1.0 s

Story multiplies windups by 1.3. Heroic multiplies them by 0.85.

**Scheduler overlap cap:** Boss 1 allows 1 major telegraph resolving at a time, Boss 2 allows 2, and Boss 3 allows 3. When a newly scheduled ability would resolve within 0.8 s of an existing major one beyond the cap, it is delayed by up to 3 s (see §11.5).

---

## 4. Bosses

**Shared rules for all bosses:**
- **Hit-cylinder:** used for melee range and Rend.
- **Movement:** the boss walks or floats toward the player at 2 m/s if the player is more than 5 m away. It stops while casting.
- **Constant pressure:** a weak melee tap when the player is within 5 m (B1: 25 every 2 s, B2: 30, B3: 35).
- **Phase transitions:** the boss is invulnerable, the player is invulnerable, and input is frozen. Each is a 3–5 s camera-rail cinematic with letterbox bars. Every active telegraph and hazard is cleared.
- **Death:** 120 ms hit-stop, then timeScale 0.2 for 1.5 s. The camera orbits 40°. The boss **shatters into 400 instanced glass shards that are sucked into the player's hilt.** The colossal backdrop then plays its own death beat.

### 4.1 BOSS 1: PYRRHA, THE FORGE-WARDEN (teaches shapes, interrupts and adds)

**Numbers (Normal):**
- HP **46,000**. Hit-cylinder radius 1.8 m. Height 7 m.
- **Enrage 3:45, "MELTDOWN":** lava pours over the rim and covers the floor at 2000/s. Lethal.
- Expected kill: expert about 2:05, average about 3:05.

**Arena:**
- **Floor:** an obsidian disc, radius **22 m**. Floor shader:
  - Voronoi cells with emissive orange magma in the cell edges, pulsing at 0.5 Hz.
  - A distance-to-edge darkening.
  - `uHeat` brightens the veins in phase 2.
- **Pylons:** 4 basalt anvil pylons at the cardinal points, r = 17 m (cylinders with a cap, instanced). They block movement (circle colliders, r = 1.2 m).
- **Lava sea:** a 600 × 600 m plane at y = -6.
  - Domain-warped FBM with 3 octaves (4 on High).
  - Orange-to-white heat ramp with scrolling crust.
  - Emissive above the bloom threshold only at its brightest seams.
- **Sky dome** (inverted sphere, r = 400):
  - Gradient from ember-black at the zenith to blood orange at the horizon, with FBM smoke bands scrolling sideways.
  - A huge dim sun disc with a corona falloff near the north horizon. Uniforms: `uSunPos`, `uSunSize`, `uNoon` 0..1.
- **Lighting:**
  - Hemisphere light: sky `#ff8a4a`, ground `#200806`, 0.5.
  - Directional key light `#ffb070`, 1.6, from the sun direction.
  - A point light on Pyrrha's core, `#ff5a1f`, range 12.
  - Exposure 1.1.
- **Grade:** lift `(0.02, 0.0, 0.0)`, gain `(1.05, 0.97, 0.9)`.
- **Ambient particles:** 400 embers rising from the edge (static Points, animated in the shader). Heat-haze distortion near the rim on High.
- **Colossal backdrop: VORATH.**
  - A 60 m titan, waist-deep in magma, 70 m north of the arena centre.
  - Built from ~180 instanced rock plates around an emissive core (a sphere with fresnel and upward-moving emissive noise).
  - Crown horns are cones.
  - His two hands (instanced plate clusters, each about 25 m) **grip the north rim of the arena** and are visible in gameplay. The fingers flex slowly.
  - His chest glows at the top edge of the frame.
  - He does not collide and cannot be targeted.

**Boss look:**
- A 7 m basalt colossus of stacked plates (boxes plus an icosahedron torso), with a molten core visible through gaps in the ribs that flickers (emissive).
- A forge hammer (cylinder plus box). The hammer head's emissive goes from grey to white over each windup (`uHeatCast` = cast progress).
- Uses the Arcane material (§8.3) for hit-flash, fracture cracks and dissolve.

**Intro (5 s, tap to skip):**
1. The camera starts low on the platform, looking north over the magma.
2. The magma bulges, and Vorath rises with lava sheets (particles) streaming off him. His hands slam onto the rim, with trauma 0.5.
3. The camera tilts down to Pyrrha, who stands up from a kneel.
4. Name card: "PYRRHA — The Forge-Warden".

**PHASE 1 (100–60%): "Learn the shapes"**

| Mechanic | Cadence (first at) | Telegraph | Warning | Damage | Counterplay / Hint |
|---|---|---|---|---|---|
| **HAMMERFALL** | every 9 s (6 s) | Pose: hammer raised. A red **cone** 100°, 11 m, aimed at the player and locked at cast start. | 1.4 s | 450 + 4 m knockback | Step to the side or behind, or dash through it for SLIPSTREAM |
| **SLAG RAIN** | every 15 s (11 s) | 4 red **circles** r = 3.5: 3 random plus 1 on the player's position at cast time, staggered 0.3 s apart. Molten globs arc from the sky and land at resolve. | 2.0 s each | 300 each. Each leaves a **burning pool** r = 2.5, 80 per 0.5 s, for 6 s | Keep moving, and don't fight inside pools |
| **INCINERATE** | every 24 s (16 s) | **Interruptible**, 2.5 s cast. Pose: open palm with fire streaming inward. | 2.5 s | 300 to the player, plus Burning 40/s for 8 s | Stasis Lance. A one-time hint shows on the first cast. |

**TRANSITION at 60% (4.5 s): "The Stolen Sun"**
1. The camera pulls back and up past Pyrrha to frame Vorath.
2. Vorath releases the rim, reaches north and **tears the sun out of the horizon.** `uSunPos` is animated up to the zenith, `uNoon` goes 0 → 1, the sky shifts from dusk to white-hot noon, and the key light swings to overhead.
3. He holds the sun aloft. Bloom spikes. The floor veins brighten (`uHeat` = 1).
4. The anvil pylons ignite.
5. Banner: "PHASE II — PRIORITIES".

**PHASE 2 (60–25%): "Priorities"**
- **HAMMERFALL becomes TWIN HAMMERFALL:**
  - Two 100° cones: the second is rotated 180° and resolves 0.8 s after the first.
  - Counter: go to the side, or dash out and Recall back in.
- **SLAG RAIN** continues, every 15 s.
- **CINDERLINGS** (every 30 s, first at transition + 4 s):
  - 3 adds spawn at random pylons. Each has **2000 HP** and is a 1.2 m floating lava orb with a trail.
  - They walk toward the boss at 2.2 m/s and leave glowing footprints.
  - Each one that reaches the boss grants a permanent **STOKED** stack: +10% boss damage.
  - **An add killed within 5 m of the boss explodes for 1200 damage to the boss** (graft), which rewards cleaving them near him.
  - Counter: intercept and cleave with Rend, root one with the Lance, or drag the fight so they die beside him.
- **IN / OUT** (every 12 s, alternating, first at transition + 9 s), each with a 2.0 s windup:
  - **FORGE RING:** pose is arms crossed. A red donut from r = 6 to 22. Safe close to the boss. 450 damage.
  - **ERUPTION:** pose is arms raised. A red circle r = 7 centred on the boss. Get out. 450 damage.
- **INCINERATE** continues, every 24 s.

**PHASE 3 (25–0%): "Sunfall"**
- **TITAN'S PALM** (every 16 s):
  - Vorath brings the stolen sun down in one hand while the other hand slams.
  - A red **half-plane** (the east or west half of the arena) with the giant hand's **shadow darkening the area** as it fills.
  - 2.4 s windup, 600 damage, trauma 0.6. The floor glows white along the impact and cools.
  - Counter: cross the centre line, or dash through it on the last beat.
- **SHOCKWAVE STOMP** (every 16 s, offset by 8 s from the Palm):
  - Pyrrha stomps 3 times, 0.8 s apart. Each stomp releases an expanding red ring from the boss, 1.2 m thick, at 10 m/s, out to r = 22.
  - It **cannot be outrun.** Dash through each ring. This is the SLIPSTREAM showcase.
  - The telegraph is the ring itself (a donut shape updated each frame with `uProgress` = 1).
  - 250 per ring.
- **Hammerfall and Slag Rain** continue at 0.85× their intervals.
- **OVERHEAT at 10%:**
  - Pyrrha's core goes white and she takes **+25% damage for 6 s.**
  - Banner: "OVERHEAT — STRIKE NOW". This is the reward window for a banked Grand Shatter or Zero Hour.

**Death:**
- Pyrrha shatters into the hilt.
- Then Vorath's core cracks, with light pouring out. He sinks, and the sun he held drops into the magma behind him.
- The sea turns gold with a slow-motion shockwave ring.

**Why it is the easiest:** one danger colour, generous windups, one mechanic introduced at a time, and a 3:45 enrage.

---

### 4.2 BOSS 2: NERITH, THE DROWNED CHOIR (teaches soaks, line of sight, spatial resources and reading tells)

**Numbers (Normal):**
- HP **58,000**. Hit-cylinder radius 1.5 m. She floats 1.5 m off the floor.
- **Enrage 4:15, "ABYSSAL HYMN":** the water rises to chest height at 1500/s. Lethal.
- Expected kill: expert about 2:40, average about 3:40.

**Arena:**
- **Layout:** a sunken cathedral floor, circular, radius **20 m**. Flagstones sit under 25 cm of shallow water.
- **Floor shader** (one material):
  - Flagstone grid from a procedural mortar SDF.
  - Animated **caustics**: two scrolling Voronoi layers, min-combined, plus a teal tint.
  - A water sheen layer: fresnel toward a sky colour.
  - **Ripples** from a 16-entry uniform ring buffer `uRipples[16]` (x, z, t0) written on player footsteps (every 0.25 s while moving), dashes and impacts.
- **Pillars:** 6 coral-crusted pillars on a ring at r = 12 (instanced cylinders with capitals). They collide (r = 1.0) and **block line of sight.** Each has 2 "gaze charges" and crumbles with a dissolve plus rubble when spent.
- **North wall:** a giant rose window (a disc with a procedural radial tracery SDF, emissive teal) with **3 god-ray cones** (additive, noise-scrolled alpha; High and Med only).
- **Sky dome:**
  - An indigo-to-black gradient with a hashed star layer that twinkles.
  - A huge pale **moon** disc high in the north.
  - Faint aurora curtains (sine-folded FBM).
- **Lighting:**
  - Hemisphere light: `#3a6aa0` / `#05080f`, 0.45.
  - Directional "moonlight" `#bfe4ff`, 1.2.
  - A point light on Nerith, `#5ff2ff`, range 14.
  - Exposure 0.95.
- **Grade:** lift `(0, 0.01, 0.03)`, gain `(0.92, 1.0, 1.08)`.
- **Ambient particles:** 300 rising bubbles and 300 bioluminescent motes (static Points).
- **Colossal backdrop: NYXARA, the moon-serpent.**
  - 90 instanced segments (scaled spheres with a fin plane) following a `CatmullRomCurve3` that orbits the cathedral.
  - The curve is recomputed every frame from 8 control points on a precessing loop.
  - Iridescent thin-film fresnel scales, with a bioluminescent stripe pulse travelling from head to tail.
  - Every 20 s a coil **passes low overhead**: it blocks the moon (`uMoonOcclusion`), drops a large moving shadow decal across the floor, and plays a low rumble.

**Boss look:**
- A 5 m floating siren-oracle: a lathe-geometry body with a fresnel water shell.
- **Hair:** 12 ribbons of water, tube meshes with a vertex-shader sine flow.
- **Halo:** 7 choir-lights that brighten during casts.
- A forehead eye that opens for Hymn of Stone.

**Intro (5 s):**
1. The camera looks up through the water at the moon.
2. A shadow crosses the moon: Nyxara's coil.
3. The camera drops through the rose-window light onto Nerith rising from the water. Her hair unfurls.
4. Name card: "NERITH — The Drowned Choir".

**PHASE 1 (100–65%)**

| Mechanic | Cadence (first) | Telegraph | Warning | Damage | Counterplay |
|---|---|---|---|---|---|
| **TIDAL LASH** | every 7 s (4 s) | Red **rect**, 3 m wide × 30 m long, from the boss toward the player, locked at cast start | 1.2 s | 350 | Sidestep. A frequent SLIPSTREAM source. |
| **CHOIR TOWERS** | every 20 s (10 s) | 2 **gold soak circles** r = 2.5, 14 m apart, with ringed light pillars. Tower A resolves at 3.5 s, tower B at 6.0 s. | 3.5 s / 6.0 s | Unsoaked: 450 + **Drowning** (−30% healing for 15 s). Soaked: 60. | Stand in A, dash toward B as A resolves, soak B, then Recall to melee. **Soak both: HARMONIZED.** Nerith is stunned for 4 s and takes +20% damage (the burn window). |
| **HYMN OF STONE** | every 30 s (18 s) | Forehead eye opens. A violet 3.0 s cast. Each surviving pillar projects a **violet safe shadow wedge** on the floor, computed in the shader from the boss position (projected away from the boss, from the pillar to the arena edge). | 3.0 s | In line of sight: **Petrified** for 2 s (grey stone material swap) + 400 | Stand in a wedge. A ray-vs-circle line-of-sight check at resolve. The blocking pillar loses 1 gaze charge. |

**TRANSITION at 65% (4 s):**
1. Nyxara's coil descends into view, and the camera follows its shadow.
2. Nerith dives under the water.
3. Banner: "PHASE II — REFLECTIONS".

**PHASE 2 (65–30%)**
- **REFLECTIONS** (twice: right after the transition, and again at 45%):
  - Nerith submerges. **Two Sirens** rise on opposite sides, 16 m apart, and both cast **REQUIEM**: 4.0 s, with an interruptible bar shown for both.
  - **The real one has three tells:**
    1. a mirrored reflection mesh in the water (the fake has none);
    2. a halo that pulses **in sync** with the cast bar shimmer (the fake's halo flickers out of sync);
    3. real water droplets falling from her hair.
  - **Story:** the real one also gets a cyan droplet trail and a subtle green ring.
  - Lancing the real one shatters both Sirens. Lancing the fake wastes the cooldown, and Requiem then deals **700** plus 3 s of Drowning.
  - Both Sirens are untargetable except by the Lance. Nerith reappears at the real Siren's position.
- **UNDERTOW MARK** (every 18 s):
  - A violet ring locks onto the player for 5 s (a countdown ring shrinks around the player).
  - On expiry it drops a **whirlpool** at the player's feet: r = 4 m, 60 per 0.5 s, a light pull of 1 m/s toward its centre, lasting 30 s (a swirl decal shader).
  - Counter: carry it to the edge, or behind pillars you no longer need.
- **TIDAL LASH** every 7 s. **CHOIR TOWERS** every 22 s.
- **HYMN OF STONE** every 30 s.

**PHASE 3 (30–0%): "Maelstrom"**
- **Transition (3 s):** the coil slams down around the cathedral rim.
- **Current:** the whole floor current pushes the player **clockwise at 2 m/s** (tangential velocity added to movement). It is shown by streak particles and a scrolling flow pattern in the floor shader.
- **MOONBEAM** (every 16 s):
  - Two red beams 2.5 m wide, 180° apart, rotating around the boss at 30°/s for 6 s, 20 m long.
  - The telegraph shows the start lines for 1.5 s, then beam hazards that rotate continuously. 300 per hit, at most one hit per 0.5 s.
  - The current carries you into or away from the beams. Walk against the flow, or dash through for SLIPSTREAM.
- **COIL CRUSH** (every 16 s, offset by 8 s):
  - Nyxara's coil comes down across the arena as a red **band** 7 m wide through the centre, at a random angle, with the coil's huge shadow sliding over the floor.
  - 1.8 s, 500 damage, trauma 0.5.
- **CHOIR TOWERS** (every 20 s), now placed on opposite sides of the beam path.
- **TIDAL LASH** (every 9 s).

**Death:**
- Nerith shatters into the hilt.
- Then Nyxara's body **loses its glow segment by segment from tail to head**, a chain of lights going out. She dissolves into a stream of moonlight that pours into the sky and forms a new moon.

**Why it is harder than Boss 1:** stand-in mechanics that fight your instinct to flee, pillars as a resource you spend, persistent self-made hazards, an observation check on the interrupt, and overlapping telegraphs.

---

### 4.3 BOSS 3: AUREN, THE UNWOUND HOUR (uses your own kit against you)

**Numbers (Normal):**
- HP **66,000**, plus an intermission of 4 Chrono Anchors with **2400 HP each**.
- Hit-cylinder radius 2.0 m. Height 9 m.
- **Enrage 5:15, "HEAT DEATH":** every light in the scene goes out one by one over 3 s, the screen bleaches to white, and you die.
- Expected kill: expert about 3:30, average about 4:15 (including the 35 s intermission).

**Arena:**
- **Floor:** a shattered **clock face**, radius **20 m**.
  - Marble-glass floor shader: procedural veining (FBM).
  - Engraved radial tick marks and 12 Roman-numeral tiles around the edge, drawn as SDF segments in the shader.
  - Gold specular via a fake matcap term.
- **Clock hands:** a giant ornate **minute hand** and **hour hand** that sweep the floor. They are physical gold meshes with a red telegraph rim underneath.
- **Sky:**
  - A nebula FBM in two hues (magenta and deep blue) with a hashed starfield.
  - **The Singularity:** a huge black hole to the north, elevated so its lower half and its accretion disk sit in the top third of the gameplay frame.
    - A dark disc with a photon-ring rim, drawn in the sky shader.
    - A separate **accretion disk** torus (flattened) with an animated banded-noise shader and **Doppler brightening** on its approaching side.
    - On Medium and High, a **screen-space lensing** term in the FinalPass bends everything around the hole's projected screen position (UV offset ∝ 1/r, clamped). On Low, the lensing is applied to the sky shader's star lookup only.
- **Gears:** 24 drifting broken gears orbit the arena (instanced, slow rotation).
- **Lighting:**
  - Hemisphere light: `#a0a0ff` / `#000000`, 0.35.
  - Directional `#ffffff`, 1.0.
  - Accretion rim colour `#ffb36b`.
  - A point light on the boss heart, `#ff3bd4`.
  - Exposure 1.0.
- **Grade:** high contrast. Lift `(0, 0, 0.02)`, gain `(1.05, 1.0, 1.08)`, saturation 0.85 except magenta and gold.
- **Ambient particles:** 400 void motes spiralling toward the black hole.

**Boss look:**
- A 9 m crowned figure. Its body is a dark shell with an **inverted fresnel** (black centre, white-magenta rim).
- Its **face is a cracked mirror** (a reflective plane with crack SDF lines, tinted with the player's colour).
- **Three nested gyroscopic gold rings** rotate around it at different speeds, each with a scrolling glyph emissive generated on a canvas.
- It stands on the clock pivot at the centre and does not walk.

**Intro (6 s):**
1. The camera flies in from deep space toward the black hole. The starlight smears into rings (`uStreak`).
2. The camera nearly falls in, then pulls back as Auren steps out of the event horizon onto the clock face, and the rings spin up.
3. Name card: "AUREN — The Unwound Hour".

**PHASE 1 (100–70%): "Tick"**

| Mechanic | Cadence | Telegraph | Warning | Damage | Counterplay |
|---|---|---|---|---|---|
| **CLOCK HANDS** | Continuous | **Minute hand:** a red rect 2.5 m × 20 m, sweeping at 24°/s. **Hour hand:** 4 m wide at 8°/s. Both are pivoted at the centre. | Always visible | 250 + 3 m knockback on contact (0.5 s re-hit lock) | You can't outrun the minute hand forever, so you dash THROUGH it. A guaranteed SLIPSTREAM source if timed. |
| **NUMERAL SEQUENCE** | every 20 s (8 s) | The boss rings **3** numerals in order. Each lights for 0.6 s with its own chime pitch (C major scale degree = numeral index mod 7). Then the matching **30° sectors** (r 2–20) explode in that order, 1.0 s apart. | Reveal 1.8 s + 1.0 s, then each sector shows its red fill 1.0 s before resolve | 400 each | On Normal, faint red sector outlines stay visible after the reveal. On Heroic they vanish. |
| **REWIND** | every 28 s (14 s) | **Interruptible**, 3.0 s. A ghost marker shows **where you stood 5 s ago.** | 3.0 s | If it finishes, you are yanked to that spot (rewind distortion: sepia plus zoom blur) and take 300. | Lance it, or make sure your 5-seconds-ago spot is safe |

**PHASE 2 (70–40%): "Paradox"**
- **Transition (4 s):**
  1. Auren opens its arms and the black hole inhales. Loose scenery (gears, particles) streaks toward the singularity.
  2. The camera does a dolly-zoom (FOV 50 → 70 while pulling in).
  3. The floor's tint shifts warm, from accretion light.
- **YOUR SHADOW:**
  - A hostile violet-black Chronoblade (the Echo material, inverted) **replays your exact movement from 4 s ago**, from the 30 Hz position ring buffer.
  - It leaves a 1.2 m-wide damaging trail that lasts 3 s: 150 on touch, 0.5 s lock. The trail is a ribbon mesh on the floor.
  - You cannot target it. It forces you never to retrace your path.
- **FATE MARKS** (every 22 s): a violet debuff with an 8 s countdown on the player. The Echo is highlighted with a violet beam.
  - **CONVERGE:** be within 2 m of your Echo when the mark expires.
  - **DIVERGE:** be more than 12 m from your Echo when the mark expires.
  - If you have no Echo when the mark lands, one is **force-created** at your feet.
  - Fail: 600 + a 1 s stun.
  - Recall counts for Converge: you teleport onto the Echo. The Echo stays alive until the mark resolves.
- **CLOCK HANDS** continue. **NUMERAL SEQUENCE** now rings **4** numerals, every 20 s. **REWIND** continues every 28 s.
- **PARADOX BELL** (class-as-mechanic graft, every 26 s):
  - Auren rings a bell: a violet cast of 2.5 s. At resolve it hits **only if you are holding 5 Fractures** on it ("You hoard time"): 500 damage.
  - Banner: "PARADOX BELL — SPEND YOUR FRACTURES".
  - Counter: Shatter before it resolves, so the Bell forces your Grand Shatter timing.

**INTERMISSION at 40%: "Stopped Clock" (35 s)**
- Auren turns invulnerable inside a **hex-grid energy shield sphere**: a hex SDF in sphere UV, a fresnel rim, and hit ripples from a uniform array of the last 8 impacts.
- **4 CHRONO ANCHORS** (crystal obelisks, 2400 HP each) rise at the cardinal points, r = 10 m.
- **Linked pairs:**
  - North + South form one pair, East + West the other.
  - At any moment **one pair is vulnerable** (gold) and the other is **phased**: violet shield, 90% damage reduction.
  - The pairs swap every 7.5 s.
- **Zero Hour** deals 2400 to each vulnerable anchor, which kills the vulnerable pair instantly.
- The **minute hand** keeps sweeping.
- **Timer:** 35 s, a giant clock face appears above the arena. Any anchor left alive triggers **BIG CRUNCH** (a wipe; on Story, 500 damage and the intermission ends).

**TRANSITION to Phase 3 (5 s): "Fall into the hour"**
1. The shield breaks.
2. Auren collapses into its heart. The heart grows to supernova brightness, then shrinks to a pinprick.
3. The camera falls toward the singularity: radial zoom-blur, star streaks, tunnel vignette.
4. The player lands on the now-broken clock face. **The black hole now fills the upper half of the frame.**

**PHASE 3 (40–0%): "Collapse"**
- **Platform breaks:**
  - At **30%** the outer ring falls: radius 20 → 14.
  - At **20%** it falls again: 14 → 10.
  - Each break has 3 s of red ring telegraph first, then the ring of floor segments (an instanced arc-segment mesh) dissolves with a glowing edge and tumbles into the black hole with debris particles.
  - The numeral tiles fall away with it.
- **Falling off** is not instant death: you take 30% of max HP and respawn at the centre after a 1 s fade.
- **ENTROPY:**
  - +1 stack every 10 s. Each stack gives +6% damage taken.
  - The player model gets violet cracks (the `uFracture` shader on the player).
  - **Recall is the only cleanse,** so you must budget it against healing and uptime.
- **Prior mechanics return with 0.8× windups:**
  - Minute hand only.
  - A 3-numeral sequence every 18 s.
  - Fate Marks every 20 s.
  - No Shadow.
- **FINAL HOUR at 10%:**
  - Auren stops attacking and channels a **15 s** cast (not interruptible). A giant clock above the arena counts down.
  - During the channel Auren is **Overexposed** and takes +50% damage.
  - If the cast finishes, you wipe. On Story it deals 50% of max HP and restarts the channel instead.
  - This is the final DPS check, which rewards banked Flux, Fractures and Zero Hour.

**Death / epilogue (8 s, then credits):**
1. Auren shatters into the hilt.
2. **The singularity explodes into a new star.** The sky shader animates the black hole collapsing into a white-gold sun, and a time-lapse **dawn** spreads across the starfield over 6 s.
3. Credits roll over it with the run stats.

**Why it is the hardest:**
- Every mechanic interacts with your own tools: dashing through the hands, Echo-based Fates, the Bell that checks your Fractures, Recall as the cleanse, the Shadow made from your own path.
- Persistent hazards, memory and audio reads, a hard DPS check, stacking damage taken, and a shrinking arena.

**Difficulty curve summary:**

| | Boss 1 | Boss 2 | Boss 3 |
|---|---|---|---|
| Windups | 1.4–2.4 s | 1.2–3.5 s | 1.0–3.0 s (×0.8 in P3) |
| Concurrent telegraphs (avg) | about 1.2 | about 1.8 | about 2.5 |
| New skill taught | shapes, interrupt, adds | soak, line of sight, observation, terrain | memory, self-replay, resource checks, DPS check |

---

## 5. Difficulty Settings

| | Story | Normal | Heroic |
|---|---|---|---|
| Boss HP | ×0.85 | ×1 | ×1.25 |
| Boss damage | ×0.6 | ×1 | ×1.25 |
| Windups | ×1.3 | ×1 | ×0.85 |
| Enrage | Disabled | As listed | As listed |
| Extras | Green safe-zone hints, a real-Siren tint, phase checkpoints | — | B1: a 5th Slag circle. B2: a 3rd Choir Tower. B3: numeral outlines vanish. |
| Unlock | Always | Always | After all three bosses are cleared on Normal |

---

## 6. Controls

### 6.1 Desktop
| Action | Keys |
|---|---|
| Move | WASD / arrow keys (screen-relative; the camera yaw is fixed) |
| Phase Step | Space / Shift |
| Rend | Q / Left mouse / 1 |
| Shatter | E / Right mouse / 2 |
| Recall | R / 3 |
| Stasis Lance | F / 4 |
| Zero Hour | T / 5 |
| Pause | Esc / P |
| Cycle quality | Tab |
| Zoom (3 steps: 0.85 / 1.0 / 1.2) | Mouse wheel |
| Debug panel (only with `?debug=1`) | ` (backtick) |
| Retry on the death card | Enter / R |
| Skip cinematic | Space / click |

- The mouse is never needed for aiming.
- The on-screen buttons are clickable and show key labels.
- Right-click opens no context menu (`preventDefault`).

### 6.2 Mobile (landscape primary; portrait supported)
- **Floating joystick:**
  - Appears where the left thumb lands anywhere in the left 45% of the screen.
  - Base 120 px, knob 56 px, 12% deadzone. Speed scales with deflection and reaches full speed at 85%.
  - A faint ghost ring hint shows at the default spot for the first 10 s of each fight.
- **Right thumb cluster:** positions are the button centres, measured from the bottom-right safe-area corner (dx left, dy up).

  | Button | Size | Centre (dx, dy) |
  |---|---|---|
  | REND | 88 | (78, 78) |
  | PHASE STEP | 72 | (170, 52) |
  | SHATTER | 72 | (60, 180) |
  | RECALL | 60 | (150, 158) |
  | STASIS LANCE | 60 | (210, 240)... see note |
  | ZERO HOUR | 64 | (60, 280) |

  **Note:** keep at least 12 px between buttons and at least 20 px from the screen edges. In portrait, scale everything ×0.85. The implementer may nudge positions to keep the spacing, but must keep this arrangement: Rend at the thumb rest, Dash bottom-left of Rend, Shatter above Rend, Recall diagonal, Lance on the upper arc, and Zero Hour at the top.
- **Every button shows:**
  - a conic-gradient cooldown sweep (CSS `conic-gradient` driven by a custom property);
  - the remaining seconds as a number when under 3 s;
  - charge pips (Dash);
  - a grey-out when the resource is short (Shatter below 50 Flux, Recall with no Echo);
  - a glow when it is the "right" press: Shatter glows gold at 5 Fractures with ≥ 50 Flux, the Lance pulses violet during an interruptible cast, and Zero Hour pulses gold at 100.
- **Input handling:**
  - Pointer events, with every pointer tracked by `pointerId`.
  - Buttons fire on `pointerdown`.
  - **Press-on-slide-in:** a pointer that started on any button and slides onto another one fires that button.
  - **Input buffer:** a press up to 0.2 s before an ability is ready fires as soon as it is ready.
  - Haptics: `navigator.vibrate(10)` on a press, 30 on SLIPSTREAM, 20 on a hit taken (guarded).
- **Page setup:**
  - `touch-action: none` on everything, `user-scalable=no`, and `preventDefault` on `gesturestart` and `touchmove`.
  - No text selection.
  - Size from `visualViewport`, re-laid out on resize and orientation change.
- **Portrait:** shows a "Rotate for best experience" hint once and stays fully playable.

---

## 7. Camera

**Chase camera, fixed yaw (looking north, −Z):**
- The camera position is the follow target + offset (0, 10, 14) × zoom.
- **Look target** = lerp(player, boss, 0.30), raised 2.0 m.
- FOV 50 in landscape. In portrait the FOV is 62 and the offset is pushed back 15%.
- Pitch is about 30°, so the horizon and the colossal backdrops sit in the top band of the frame.
- Joystick-up is always screen-up (north).

**Follow:** a critically damped spring with about 0.12 s settle time.

**Auto-widen:** zoom × 1.25, eased over 0.6 s, while any arena-wide mechanic is active: donut, half-plane, Moonbeam, intermission, Shockwave Stomp, numeral sequence.

**Screen shake:**
- Trauma-based: offset and roll = trauma² × Perlin(t × 25). Max offset 0.6 m, max roll 2°. Trauma decays at 1.5/s.
- Values:
  - Hammerfall 0.4, Titan's Palm 0.6, Coil Crush 0.5
  - Grand Shatter 0.3, Zero Hour 0.6
  - floor collapse 0.7, a hit taken 0.15
- There is a settings toggle for screen shake.

**Hit-stop:** sim timeScale 0.05 for:
- normal Shatter 40 ms
- Grand Shatter 70 ms
- SLIPSTREAM (in addition to the slow-mo)
- Zero Hour release 120 ms
- boss kill 120 ms

**Cinematics:**
- Scripted camera rails: `CatmullRomCurve3` for the position and the target.
- Letterbox bars (CSS) and a slight dutch tilt (≤ 4°).
- Each rail is data: `{dur, pos:[...], tgt:[...], fov:[...], events:[{t, fn}]}`.
- Skippable by tap or Space (the outcome is applied instantly).

---

## 8. Rendering Techniques

### 8.1 Pipeline
1. `WebGLRenderer({antialias:false, powerPreference:'high-performance'})`, ACESFilmic, per-arena exposure, sRGB output.
2. **EffectComposer:**
   1. `RenderPass` (main scene, excluding the player layer during desaturation).
   2. `UnrealBloomPass`:
      - Strength 0.9 baseline per arena (B1 1.0, B2 0.9, B3 1.1), radius 0.55, threshold 0.82.
      - Runs at half resolution on Medium and Low.
      - Strength spikes via `bloomKick` decay.
   3. **FinalPass** (one `ShaderPass`, one fullscreen draw), which does:
      - radial chromatic aberration `uCA` (0.0015 baseline; spikes to 0.006 and decays over 0.25 s);
      - vignette, plus a red damage pulse on the screen edges (`uHurt`), plus a low-HP heartbeat pulse below 30%;
      - film grain 0.03;
      - desaturation `uDesat` with a gold-preserve mask (hue band) for Zero Hour;
      - radial zoom blur `uZoomBlur` (8 taps; Recall, Rewind, transitions);
      - B3 lensing: `uBHPos` (screen), `uBHStr`, a UV warp `offset = dir × str / max(r, 0.02)` that is clamped, with a dark core;
      - B1 heat haze: a noise UV offset masked to the bottom 25% of the screen (High only);
      - lift / gamma / gain grading, lerped over 1.5 s when arenas change;
      - a white-out mix (enrage, Heat Death).
   4. `OutputPass`.
3. **Player stays saturated:** while `uDesat` > 0, the player and Echo meshes are drawn on layer 1 in a second `renderer.render` call after the composer, with `autoClear=false` and depth cleared. This is a cheap rim-lit draw, so the player stays saturated. Otherwise the player renders in the main pass.

### 8.2 Custom shaders (all inline GLSL strings)
| Shader | Notes |
|---|---|
| `TelegraphMaterial` | §3. One program for every shape, so there is no compile hitch. |
| `SkyMaterial` ×3 | Inverted sphere. Forge (smoke FBM, sun, `uNoon`), Cathedral (stars, moon, aurora, `uMoonOcclusion`), Void (nebula, stars, black hole, photon ring, `uCollapse` 0..1 for the new-star epilogue). All have `uStreak` (star streaks for Zero Hour and intros). |
| `LavaSea` | Domain-warped FBM heat ramp, `uGold` for the death beat. |
| Floor ×3 | Magma veins (Voronoi), Cathedral water (caustics, ripples, current flow, mortar), Clock (marble FBM, SDF numerals and ticks, sector highlight `uSectorMask`, `uRadius` for collapse dissolve). |
| Arcane (onBeforeCompile on MeshStandardMaterial) | Injects: fresnel rim emission `uRim`; hit-flash `uFlash` (white, 0.08 s decay); fracture cracks `uFracture` (Voronoi edge in object space, cyan); dissolve `uDissolve` (noise threshold with a glowing edge). Used for bosses, adds, pillars, anchors and the player. |
| Echo / Shadow | Fresnel-only cyan, scanline flicker; the Shadow is inverted violet-black with edge distortion. |
| Hex shield | Hex SDF in sphere UV, fresnel, 8 ripple impacts `uHits[8]`. |
| Accretion disk | Banded noise, `cos(angle)` Doppler brightening, rotation over time. |
| Serpent segments | Thin-film iridescence (`cos(fresnel × k + phase)` palette), a stripe pulse over the instance index. |
| Beam | Scrolling noise, core-to-edge falloff (Zero Hour, Moonbeam, god rays). |
| Particles | §8.4 |

### 8.3 Characters (built from primitives)
- **Player:**
  - Capsule torso, sphere head, a long coat (a cone or cylinder split into 6 vertical panels, with a vertex-shader sway driven by velocity lag), and a curved blade (an extruded crescent shape) with an hourglass hilt (lathe glass plus gold sand).
  - Cyan seam emission tracks Flux.
  - A blob shadow decal at every quality level.
  - Simple procedural animations: a run bob, a three-swing auto combo with blade arcs, and a dash lean.
  - Blade trail: a ribbon of the last 16 blade-tip positions, additive cyan (gold at 5 Fractures).
- **Bosses:** groups of primitives with the Arcane material. Animation comes from code: breathing scale, pose lerps per cast (`poses = {idle, hammerUp, armsCrossed, armsRaised, palm, …}` as target rotations), and a bob.
- **Adds:** an emissive sphere, an Arcane rim and a trail.

### 8.4 GPU particle system
- One `THREE.Points` ring buffer: **6000 slots** on High, 4000 on Medium, 2000 on Low.
- **Attributes:** `aPos0`, `aVel`, `aT0`, `aLife`, `aSize` (start, end), `aColor` (start), `aColor2` (end), `aPhys` (gravity, drag).
- **Vertex shader:** computes the position analytically:
  ```
  t   = uTime - aT0
  p   = p0 + v * (1 - exp(-drag * t)) / drag
        + 0.5 * g * t²
  ```
  Particles past their life are culled with `gl_PointSize = 0`. The size is perspective-scaled and clamped to 48 px.
- **Fragment shader:** a soft round sprite with a hot white core, additive blending, `depthWrite:false`.
- **CPU work:** writes only newly spawned slots, using `addUpdateRange` per contiguous run.
- **Emitter presets:** `burst(pos, n, colA, colB, speed, life, size, gravity)`, `cone()`, `ring()`, `converge(target)` (inverted velocity for Zero Hour and Flux pickups), `trailPoint()`.
- **Ambient:** a separate static Points mesh per arena (embers, bubbles, motes, void dust), animated entirely in the shader with zero CPU cost.
- **InstancedMesh debris:** 400 glass shards (Rend crescents, Shatter, boss death), 120 rubble pieces (pillar collapse, floor breaks). Transforms are integrated on the CPU for active instances only.

### 8.5 Combat feedback
- **Damage numbers:** a pool of 48 DOM spans, positioned by projecting world positions, using `translate3d` and CSS keyframes (pop-scale and an upward arc).
  - White for autos.
  - Cyan for Rend and Shatter.
  - **Large gold with a pop for Grand Shatter and Zero Hour.**
  - Red for damage taken.
  - Green for heals.
- **Stamps:** "SLIPSTREAM", "INTERRUPTED", "GRAND SHATTER", "HARMONIZED", "OVERHEAT".
- **Boss hit-flash:** `uFlash`.
- **Low HP:** a red vignette pulse plus a heartbeat in the audio.

### 8.6 Audio (procedural WebAudio; the context is unlocked on the first title tap)
- **SFX:**
  - Noise-burst whooshes (dash).
  - Sine ticks (SLIPSTREAM).
  - A glass tink (Rend shards).
  - A sub-bass thump plus a noise crack (Grand Shatter).
  - A low-passed noise boom (slams).
  - Chimes (numerals; distinct pitches).
  - A cast sting at the start of each boss cast (a 2-note saw stab).
  - The rising telegraph tone (§3).
- **Music:** a per-boss drone pad from 3 detuned saws through a slow filter sweep, plus a simple percussion loop (a noise hat and a sine kick) whose tempo rises by phase.
  - B1 is in D minor, B2 in F# minor, and B3 is a tritone cluster.
- **Controls:** master volume and mute in settings.

---

## 9. Systems Detail

### 9.1 Damage & death attribution
- Every damage event carries `{amount, source:'Hammerfall', avoidable:bool}`. The player stores the last lethal source.
- **Damage taken = amount × difficulty multiplier × (1 + 0.06 × Entropy) × STOKED multiplier.** It is then reduced by any shield, and is zero while invulnerable.
- Each mechanic has a hint string in the `HINTS` table. Examples:
  - `Hammerfall: "Step beside her, or dash through as the cone fills."`
  - `Hymn of Stone: "Hide in a pillar's violet shadow."`
  - `Fate — Converge: "Stand on your Echo, or Recall to it."`

### 9.2 Status effects
These are simple objects on the player or boss: `{id, dur, stacks, onTick}`. Icons appear above the player HP bar.

| Target | Statuses |
|---|---|
| Player | Burning, Drowning, Petrified, Stunned, Entropy, Converge, Diverge, Undertow Mark, Borrowed Time, Kintsugi shield |
| Boss | Stoked, Harmonized, Overheat, Overexposed, Frozen |

### 9.3 Collision
Everything is 2D on the XZ plane:
- arena circle clamp (by radius, changing per phase);
- pillar circle push-out;
- boss cylinder push-out.

### 9.4 Hazards
- **Telegraph** (one-shot): `{shape, params, pos, rot, windup, t, dmg, onResolve, contains(x,z), major}`.
- **Persistent hazard:** `{shape, update(dt), contains(x,z), tickDmg, tickInterval, life, source}`.
  - Used for pools, trails, whirlpools, hands, Moonbeams, Shockwave rings and the current.
  - A persistent hazard reuses the same telegraph mesh with `uProgress = 1` and a gentler rim.

### 9.5 Ring buffer of player states
- Records 30 Hz × 8 s of `{x, z, hp, t}`.
- Used by:
  - Rewind (5 s ago),
  - Your Shadow (4 s delay),
  - the Rewind ghost marker.

### 9.6 Perfect Dodge lookahead
At dash start, for every active telegraph with `0 ≤ resolveTime − now ≤ 0.20` and `contains(startPos)`, set the pending PD flag; it is granted when that telegraph resolves.

For persistent moving hazards (hands, beams, rings), each exposes `willHit(x, z, Δt)`, which samples its state at 0.05 s steps over the next 0.25 s.

Any hit negated by dash invulnerability also grants a PD. The cap is 1 per dash.

---

## 10. HUD (DOM/CSS overlay, "arcane instrument" style)

**Style:**
- Semi-transparent dark glass panels (`backdrop-filter: blur(8px)`, with a fallback).
- 1 px cyan and gold borders, and small clock-tick ornaments.
- Cinzel for headings, Rajdhani for numbers.
- Minimum text size 14 px. Everything sits inside `env(safe-area-inset-*)` padding.

**Layout:**
- **Top centre (60% of the width):**
  - Boss name and epithet.
  - Boss HP bar, segmented, with tick marks at the phase thresholds. A delayed white "chip" bar trails behind it. HP % is shown as a number.
  - **Enrage timer** at the right of the bar (it turns red under 30 s).
  - Below the bar, the **cast bar**, shown only while casting, with the ability name and a violet shimmer border if it can be interrupted.
- **World space:**
  - 5 Fracture pips above the boss (sprites).
  - The Echo lifetime ring on the ground.
  - An off-screen arrow pointing to adds or the boss.
  - A Fate Mark countdown ring around the player.
- **Top left:** pause button (44 px), and an FPS / quality badge (debug mode or after Tab).
- **Bottom centre (between the thumbs):**
  - Player HP bar, 30% width, thin, with a shield overlay in gold. Debuff icons and stack counts sit above it.
  - The **Flux bar** directly below: a cyan segmented line with a marker at 50 (the Shatter cost).
  - The Hourglass shows as the ring on the Zero Hour button. On desktop it is also a small gold bar.
- **Bottom left:** the joystick zone.
- **Bottom right:** the ability cluster.
- **Centre and upper third:** callout banners, stamps and phase titles ("PHASE II — PRIORITIES", large letter-spaced text that fades in and out).

---

## 11. Menus & Flow

### 11.1 Title screen
- **3D hero shot:** a giant slowly turning hourglass (lathe glass with a fresnel material) whose sand is a particle stream, in front of the Boss 3 void sky with the black hole. The three throne silhouettes float behind it.
- Logo "SHATTERCLOCK" in Cinzel with a CSS shimmer gradient.
- "Tap to begin" also unlocks audio and requests fullscreen on mobile (guarded).
- **Buttons:** PLAY, DIFFICULTY (Story / Normal / Heroic), QUALITY (Auto / Low / Medium / High), SETTINGS (volume, mute, screen shake, damage numbers), HOW TO PLAY.
- **How to Play:** a 4-panel card covering the joystick and buttons, the telegraph colours (with live mini shader swatches, or CSS), the Echo/Recall loop, and Fractures plus Grand Shatter.

### 11.2 Raid Map (boss select)
- Three floating platform nodes joined by a light path, shown over the title scene with the camera moved to a new angle.
- Locked nodes are dark with a lock icon.
- Each node shows the boss name, the best time and rank per difficulty, and a ✓ when cleared.
- The talent selector sits under each cleared node.

**localStorage** (key `shatterclock.v1`, every read and write in try/catch, with in-memory defaults as a fallback):
```json
{ "cleared": {"normal":[true,false,false], "story":[...], "heroic":[...]},
  "best": {"0_normal": {"time":152.3, "rank":"A"}},
  "talents": [0, 1], "quality": "auto", "settings": {...} }
```
- Clearing a boss on **any** difficulty unlocks the next boss on all difficulties.

### 11.3 Fight flow
1. Intro cinematic (skippable).
2. "3, 2, 1, FIGHT" over 1.5 s.
3. The fight.
4. Victory or defeat.

### 11.4 Death and retry
1. At 0 HP: timeScale 0.1, desaturation to 1.0, and a slow camera orbit lasting 1.2 s.
2. The card **"THE HOUR IS UNWRITTEN"** shows:
   - boss HP % remaining, the phase reached and the time survived;
   - **Killed by: \<mechanic\>**, with its hint.
3. Buttons:
   - **RETRY** (Enter / R / tap): an instant reset from pools, with the intro skipped. Back in the fight within 1.5 s.
   - **RETRY FROM PHASE**: Story only. Restarts at the last phase threshold, with the boss HP set to it.
   - **RAID MAP**.

### 11.5 Victory
1. The death cinematic (§4).
2. A results card:
   - time, DPS, damage taken;
   - Perfect Dodges, interrupts n/m, Grand Shatters;
   - Fracture uptime %, healing from Recall.
3. **Rank** S/A/B/C:
   - The score is time-based (vs. the expected kill time) minus penalties for mechanics failed.
   - S ≥ 90, A ≥ 75, B ≥ 55, otherwise C.
4. Then the **talent pick** (bosses 1 and 2), and back to the Raid Map.
5. **After Boss 3:** the epilogue plus scrolling credits with the totals for the whole run.

### 11.6 Pause
Esc or the pause button. The menu offers Resume, Retry, Settings, Quality and Raid Map.

---

## 12. Performance Plan (mid-range phone target: 50–60 fps)

**Quality tiers:**

| Tier | Pixel ratio | Bloom | Particles | Shadows | Extras |
|---|---|---|---|---|---|
| High | min(dpr, 1.75) | Full res, 5 mips | 6000 | 1024 map, tight frustum around the arena | Heat haze, lensing pass, god rays, 4-octave FBM |
| Medium | min(dpr, 1.25) | Half res | 4000 | Off, blob decals | Lensing pass, god rays, 3 octaves |
| Low | 0.85–1.0 | Half res, 3 mips | 2000 | Off, blob decals | No haze, lensing only in the sky shader, no god rays, 2 octaves |

**Auto quality:**
- The starting tier comes from the screen and DPR: touch devices with a short side under 900 px start on Medium. Desktop starts on High.
- Frame time is sampled over rolling 2 s windows:
  - average > 20 ms (below 50 fps): step the pixel ratio down by 0.15; at the tier minimum, drop a tier;
  - average < 15 ms for 6 s: step back up by one notch.
- At most one change every 2 s.

**Budgets:**
- Under 120 draw calls and under 150k triangles.
- Instancing for pylons, pillars, plates, segments, gears, shards and floor arc segments.
- At most 3 dynamic point lights.

**Other measures:**
- **Prewarm:** a loading screen calls `renderer.compile(scene, camera)` for every arena's material set and a hidden telegraph of each shape. The first time each boss is entered, its arena is built once behind the loader. Arenas are disposed when you leave them.
- **Pools** for all transient objects. Scratch vectors. No closures created per frame.
- Static ambient particles cost zero CPU.
- `matrixAutoUpdate=false` on static scenery.
- Telegraph count is capped at 48 meshes and hazards at 32.

---

## 13. Implementation Architecture (one file, ordered sections, approximate line counts)

```
<head>  meta viewport (user-scalable=no, viewport-fit=cover), fonts, CSS (HUD, buttons, cards)   ~350
<body>  canvas, HUD DOM skeleton, overlays (title/map/pause/death/victory/error/loader)          ~150
<script type="importmap">
<script type="module">
 §1  CONFIG                (player, abilities, bosses×difficulty, quality, talents, HINTS)     ~250
 §2  Utils                 (math, rng(seed), pools, scratch vecs, easing, noise GLSL chunks)   ~200
 §3  Save                  (localStorage w/ try/catch)                                          ~50
 §4  Renderer & Post       (renderer, composer, FinalPass shader, bloom kicks, quality mgr)    ~300
 §5  Audio                 (AudioContext unlock, synth voices, telegraph tones, pads)          ~250
 §6  Input                 (keyboard/mouse, pointer joystick, buttons, slide-in, buffer)       ~250
 §7  Shaders & Materials   (Telegraph, Arcane onBeforeCompile, skies, floors, shield,
                            echo, beam, accretion, serpent, lava sea)                           ~800
 §8  Particles & Debris    (GPU Points ring buffer, presets, shard InstancedMesh, ribbons)     ~250
 §9  Camera                (chase spring, zoom, shake, rails, letterbox)                       ~180
 §10 Telegraph & Hazard    (pooled meshes, shape SDF contains(), resolve, PD lookahead)        ~300
 §11 Player                (mesh, anim, movement, abilities, resources, statuses, Echo,
                            ring buffer, damage intake)                                          ~550
 §12 Combat                (damage pipeline, numbers, stamps, hit-stop, adds, projectiles)     ~300
 §13 Boss framework        (Boss base class, scheduler, phases, cast bar, poses,
                            transitions, enrage, death sequence)                                ~300
 §14 Boss 1 Pyrrha + Arena + Vorath                                                             ~450
 §15 Boss 2 Nerith + Arena + Nyxara                                                             ~500
 §16 Boss 3 Auren + Arena + Singularity                                                         ~550
 §17 UI / HUD / Menus      (title, map, talents, results, death, pause, settings, how-to)      ~400
 §18 Game state machine & main loop (fixed step, interpolation, visibility, context loss)      ~150
 §19 Test hook window.__raid + debug panel                                                      ~100
```

### 13.1 Entity model
- Plain classes, kept in arrays inside `Game`. No ECS library.
- `Game = {state, time, fightTime, timeScale, player, boss, adds[], projectiles[], telegraphs[], hazards[], arena, difficulty}`.
- Each entity has `update(dt)` and `syncVisual(alpha)` (for render interpolation) and stores `prevPos` and `pos`.

### 13.2 Ability system
Each ability is a definition:
```
{id, key, cd, charges, cost:{flux}, canUse(p), use(p), gcd:false}
```
- Runtime state lives in `player.cds[id] = {t, charges}`.
- Cooldown recovery is multiplied by `player.cdRate` (1.3 under Borrowed Time).
- The input buffer stores `{id, tPressed}`. It is retried each sim step until `now - tPressed > 0.2`.
- The same definitions drive the HUD buttons (sweep, number, glow predicates).

### 13.3 Boss scripting (timeline / scheduler)
```js
BOSSES[0] = {
  name, epithet, cfg:{hp, enrage, radius, overlapCap:1},
  buildArena(scene), intro: railDef, onPhaseChange: {1: transitionRail+fn, 2: ...},
  phases: [
    { until: 0.60, abilities: [
        { id:'hammerfall', first:6, every:9,  major:true },
        { id:'slagRain',   first:11, every:15, major:true },
        { id:'incinerate', first:16, every:24, cast:2.5, interruptible:true } ] },
    { until: 0.25, abilities: [...] },
    { until: 0.00, abilities: [...], specials:[{atPct:0.10, fn:'overheat'}] } ],
  abilities: { hammerfall(ctx){ /* pose, banner, telegraph(cone,...).onResolve(...) */ }, ... },
  update(ctx, dt), onDeath(ctx)
}
```
- **Scheduler:** a per-ability countdown, with jitter of ±0.5 s on Normal (0 under seeded test mode).
  - When an ability's timer fires and it is `major`, the scheduler checks the overlap cap. If over the cap, it postpones in 0.5 s steps, up to 3 s.
  - Casts set `boss.cast = {name, t, dur, interruptible}`. An interrupt cancels the cast's resolution and calls `onInterrupt`.
- **Phase changes:** checked each step against `hp / maxHp`. A change clears the telegraphs, runs the transition rail (boss and player invulnerable), resets the ability timers to their `first` values, and updates the HUD.
- **Enrage:** at `fightTime ≥ enrage` (difficulty-scaled; disabled on Story) the boss runs the enrage sequence.
- **Seeded RNG:** `rng = mulberry32(seed)`. The seed is random by default and fixed via `?seed=` or a test hook, so tests are deterministic.

### 13.4 State machine
States: `loading → title → map → intro → fight ⇄ paused → transition (sub-state of fight) → victory | defeat → map`.

---

## 14. Test Hook (`window.__raid`) for automated Playwright testing

Installed at module start. `__raid.ready === true` once the loader finishes and the title is interactive.

```ts
window.__raid = {
  ready: boolean,
  version: 'shatterclock-1',
  get state(): 'loading'|'title'|'map'|'intro'|'fight'|'transition'|'paused'|'victory'|'defeat',
  startBoss(i: 0|1|2, opts?: {difficulty?:'story'|'normal'|'heroic', skipIntro?:boolean /*default true*/, seed?:number}): void,
      // works from any state; unlocks bypassed; audio init not required
  setGod(on: boolean): void,          // player takes no damage, cannot die (damage still logged)
  skipTo(seconds: number): number,    // fast-forward fight sim (fixed steps, no render) until fightTime >= seconds; returns fightTime. No-op outside 'fight'. Cinematics auto-skipped during fast-forward.
  setBossHp(pct: number): void,       // 0..1, triggers phase logic on next step
  press(action: 'dash'|'rend'|'shatter'|'recall'|'lance'|'ult', ): void,  // same path as input
  setMove(x: number, z: number): void,// virtual stick override (-1..1), (0,0) releases
  setQuality(t: 'low'|'medium'|'high'|'auto'): void,
  get player(): { x, z, hp, maxHp, flux, hourglass, fractures, alive, invuln, echo:{x,z}|null, cds:{[id]:number}, statuses:string[] },
  get boss():   { index, name, hp, maxHp, phase, casting:{name,t,dur,interruptible}|null, invuln, enrageAt, fightTime } | null,
  get telegraphs(): Array<{shape, x, z, progress, color}>,
  events: Array<{t, type, data}>,     // last 200: 'damage','perfectDodge','interrupt','phase','death','victory','grandShatter'
  get fps(): number,
};
```

**URL parameters:**
- `?boss=0|1|2` starts that fight directly.
- `&god=1`, `&seed=N`, `&debug=1`, `&quality=low`.
- `&nofx=1` disables post-processing, for headless CI.

**Debug panel** (backtick, only with `?debug=1`): shows the timeline list, phase-skip buttons, god mode and an HP slider.

---

## 15. Build Order & Cut List

**Build order:**
1. Renderer, post-processing, input, camera, player movement and dash on a test disc.
2. Telegraph system and particles.
3. The full class kit, with the HUD buttons.
4. Boss framework, then Boss 1 end to end, including the arena, Vorath, intro, transitions, death, menus, save, death card, and `__raid`.
5. Boss 2.
6. Boss 3.
7. Zero Hour cinematic and talents.
8. Audio.
9. Quality manager tuning.
10. Polish.

**Cut list if time runs short** (cut in this order):
1. Heroic extras.
2. The god-ray cones.
3. Heat haze.
4. Paradox Bell.
5. Phase-3 Shadow trail ribbon (replace it with damage circles left every 0.3 s).
6. Story phase checkpoints.
7. The epilogue time-lapse (keep the new star).

**Never cut:** three bosses with all phases, the class kit plus Zero Hour, bloom and FinalPass, the telegraph language, the colossal backdrops, the mobile controls, and `__raid`.