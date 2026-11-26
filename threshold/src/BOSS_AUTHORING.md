# Adding a boss

A boss is one file, `src/NN_boss_<id>.js` (use the next free two-digit number below 90; files load in filename order, which is also the order of the hall backdrop), wrapped in an IIFE that ends with `G.bosses.push({...})`. Run `./build.sh` and the new fight appears in the menu, under the group its id is listed in in `09_groups.js` (or the last group if it is in none). `20_boss_cathedral.js` is the best file to copy from; `24_boss_titan.js` shows a non-standard arena (ring floor around a giant boss) and `23_boss_engine.js` a floor that falls away.

House rules for these fights:

- No text explains a mechanic. Teach through shape, colour, sound and repetition. Cast-bar names are flavour only.
- Every damage source is telegraphed on the ground (`Hz`) or is a visible projectile (`Bul`). Give hazards a `name` so the death screen can say what killed the player.
- Each phase should add something and look bigger than the last: change the sky, lights, music intensity and post-processing in `enter`.
- Aim for a 4 to 5 minute kill. Player damage is about 110 to 140 per second for someone playing well, so 22,000 to 30,000 health.
- The world is the fight's own. No shared theme; surprise is the point.

## Definition

```js
(() => {
  function build(b) {
    // create everything under G.world (it is disposed for you on exit), build the boss mesh under b.group,
    // stash references on b.state, then return the arena
    return {
      edge: 'wall',                      // or 'fall': leaving contains() means falling to your death
      spawn: { x: 0, z: 12 }, bossStart: { x: 0, z: 0, face: 0 },
      contains: (x, z) => Math.hypot(x, z) < 18,
      clamp(p) { /* push p back inside (wall arenas) */ },
      // optional: solid(p, ox, oz) for pillars, camLimit(x, y, z) -> {x,y,z}, bulletBounds(x, z),
      // camDist / camPitch for the starting camera, floorY
      // fadeTargets(out): extra [x, y, z] points (a doll, the boss) that scenery flagged userData.fadeOcclude must not hide.
      // Big flat scenery (backdrops, wings, curtains) sets userData.fadeBox = { pad } as well: see Cam.fadeOccluders in
      // 05_world.js and occ() in 26_boss_theatre.js, where the camera may pull all the way out and the stage fades instead.
    };
  }
  G.bosses.push({
    id: 'myboss', name: 'NAME', title: 'The Something', hint: 'A two-word tease', color: '#66ccff', telegraph: 0x66ccff,
    hp: 26000, radius: 2, aimY: 3, enrage: 420,
    post: { bloom: 0.6, threshold: 0.85, exposure: 1.0, tint: [1, 1, 1] },
    music: { bpm: 110, root: 38, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 4], layers: [ /* see below */ ] },
    build,
    *intro(b) { yield* Cam.shot([0, 6, 30], [0, 3, 0], [0, 4, 16], [0, 3, 0], 4, 45); },
    phases: [
      { at: 1,    *run(b) { while (true) { /* rotation */ yield 1; } } },
      { at: 0.66, *enter(b) { /* transition, boss is briefly safe */ }, *run(b) { /* ... */ } },
      { at: 0.33, *enter(b) {}, *run(b) {} },
    ],
    update(b, dt) { /* per-frame animation */ },
    danger(b, x, z) { return Infinity; },   // optional: seconds until (x,z) hurts, for dangers Hz does not know about
    bot(b, p) { return {}; },               // optional autopilot hints: {x, z, w, avoid(x,z), holdFire, target, saveInterrupt}
  });
})();
```

Angles: angle `a` points along `(sin a, cos a)` on the XZ plane, the same as `rotation.y`.

A floor that turns under the player (carrying them with `player.push`) should also turn `Cam.yaw` and `player.facing` by the same angular velocity each frame, or the floor appears to spin around the player and camera-relative WASD drifts. See the "carry the player" block in `27_boss_wheel.js` `update()`, which also blends the rate when the player steps between rings and skips while `Cam.cine` is set.

## A nightmare version

A door can have a harder version, picked with the Difficulty toggle on the door page (or `?nm=1`). Add a `nightmare` block to the def;
`Game.start` lays it over the normal def (prototype chain), so anything not in it reads through to Normal, and Normal itself never changes:

```js
nightmare: {
  hp: NM_HP, post: { ... }, music: { ... },        // any def field can be overridden
  enrage: 355, enrageBase: 40, enrageGrow: 4,      // one overall enrage: a pulse every 2 s of 40, 48, 56 ... from 355 s
  lastBlow: lastPetal, lastBlowAt: 24,             // optional: the themed end, 24 s into the enrage (default 24)
  death: myKill,                                    // optional: a custom kill sequence
  phases: [
    { at: 1,    music: 1, *run(b) { ... } },
    { at: 0.66, *enter(b) { ... }, skipTo(b) { ... }, *run(b) { ... } },   // the last phase: 60-70% of health and time
  ],
},
```

- The enrage works on every def: from `enrage` seconds on, an unblockable pulse every 2 s of `enrageBase + enrageGrow * secondsOver` (defaults 120 and 14, what Normal fights use). Nightmare blocks set a softer creep. It never runs during the rehearsal.
- `lastBlow` (a coroutine) starts `lastBlowAt` seconds into the enrage: the phase coroutine is stopped, phase hazards, bullets and the cast are cleared, and it runs tagged `'phase'`. Phase changes stop from then on; the boss stays hittable until it lands and the pulses keep going. The killing blow should be `p.hurt(9999, { blockable: false, src: 'enrage', pierce: true })`: `'enrage'` makes the death screen say "Out of time", `pierce` gets through god mode and immunities (tests rely on it).
- There are no per-phase clocks. Pressure in the last phase comes from the boss file's own ramp (layers added on a timer or a mechanic count).
- `G.nightmare` is set before `build()` runs. Use it to build the nightmare-only things in `build()` (and hide them): nothing should be created mid-fight. `NM(normal, nightmare)` picks a number by difficulty.
- `Co.stopTag('phase')` skips a coroutine's cleanup. Every per-mechanic visual or flag a cut-off mechanic can leave behind (kneel, rings, a hidden or untargetable body, a grade, slow time) must be reset in the next phase's `enter` and in your `lastBlow`. `tools/nmphase.js` checks this.
- A bot hint's `avoid(x, z)` may return a number instead of `true`: that penalty is used in place of the usual 500 (Parallax uses 5000 for a walk over a hole).
- `ent.hpOwner = boss` makes a second body share the boss's health (hits on it land on the boss). `ent.onImmuneHit(info, ent)` is called when an immune body is hit; return true to hide the "IMMUNE" text.
- Give every nightmare phase after the first a `skipTo(b)` that puts the world in the look that phase starts from (its grade, its colour state), even when its `enter` plays the transition: `?phase=N`, the tools and the rehearsal start phases directly, and `skipTo` is all they get of the phases before.
- Phase results (`b.phaseLog`: each phase's live time and damage) need nothing from the boss file. For `tools/nmpace.js`, write `b.state.stepAt[step] = G.ft` when each ramp step of the last phase starts, and expose a way to force a step in `nmTest`.

Checklist (from `nightmare-design.md`):

1. Name the one twist that makes it Nightmare, and show it in the first teaching beat.
2. Teaching phases: 1 to 2 of them, about 30 to 60 s each, each showing one new rule. First appearance survivable.
3. Last phase: 60 to 70% of health and of the time. Say how the pressure rises: added layers, shrinking space, tighter timing, or a mix.
4. Damage gate: say exactly what the player must be doing for damage to land. Raw DPS on the wrong target or state must not progress the fight.
5. Mistake cost: each failed mechanic either deals about 300 to 400 or costs time (a lost window or opening), one punishment per failure. Heal the boss only when it fits the theme.
6. One overall enrage (`enrage`, a creeping pulse, an optional themed `lastBlow`). No clocks on phases.
7. Length: a clean run 4:30 to 5:30; the enrage starts about 5:30 to 6:00. Tune with `tools/nmpace.js`; lower Nightmare health before touching class numbers.
8. Normal stays exactly as it is.
9. Cinematic: an intro or transition shot into the last phase, and a custom `nightmare.death`.
10. Bot: `bot(b)` reads the gate, and a "wrong" bot that ignores the gate must fail.
11. Test with a full normal entry (with intro), not only `skipTo`.

Check it with `NM=1 node tools/smoke.js <id>`, `node tools/nmpace.js <id> all 6`, `node tools/nmphase.js <id>` (add a case for your mechanics), `NM=1 node tools/hitch.js <id>` and `NM=1 node tools/nanscan.js <id>`. A fight with its own rule can add a design check of its own (Parallax has `tools/polfuzz.js` for its colour patterns and `tools/engcast.js` for the Stormcaller cast budget).

## Scripting

Phases are generator coroutines. `yield 1.5` waits seconds, `yield` waits a frame, `yield () => cond` waits for a condition, `yield*` calls another generator. When health crosses the next phase's `at`, the running `run` is cancelled, hazards tagged `'phase'` are cleared, and `enter` then `run` of the next phase start. Use `Co.start(gen, 'fight')` for things that must survive a phase change.

Boss helpers: `yield* b.cast({ name, time, onTick })` returns `'done'` or `'dead'` (interrupts were removed: do not pass `interruptible`); `yield* b.turnTo(angle)`, `yield* b.moveTo(x, z, speed)`, `b.angToPlayer()`, `b.distToPlayer()`, `b.spawnAdd({ name, hp, x, z, radius, mesh, update, *run, onDeath })`, `b.immune`, `b.targetable`, `b.dmgTaken` (damage multiplier, for armour or vulnerable windows), `b.exposed`.

## Hazards (`Hz`)

All take a delay (the telegraph fills over that time) and a damage number.

- `Hz.circle(x, z, r, delay, dmg, o)`
- `Hz.donut(x, z, r0, r1, delay, dmg, o)`
- `Hz.cone(x, z, dir, arc, r, delay, dmg, { r0 })` (`arc` is the full angle)
- `Hz.rect(x, z, dir, len, w, delay, dmg, o)`
- `Hz.zone(shape, dur, dmgPerTick, { delay, every })` for lingering areas
- `Hz.mark(shape, dur, o)` for harmless markers such as safe spots

Options: `name`, `color`, `blockable` (false means Riposte and Aegis cannot stop it), `kb: { dir | x, z, dist }`, `track(shape, h)` with `lock` (follow the player until `lock` seconds before firing), `invert` (safe inside, hurts outside), `onFire`, `onHit`, `onMiss`, `tag`, `quiet`/`silent` (sound control).

## Bullets (`Bul`)

`Bul.fire({ x, z, dir, speed, r, dmg, color, life, turn, curve, accel, tag })`, `Bul.ring(x, z, n, speed, o, offset, gapAt, gapArc)`, `Bul.clear(tag)`. `turn` homes on the player, `curve` bends the path. Keep bullet sections short and leave readable gaps; this is not a bullet-hell game.

## Look and sound

- `W.sky({...})`, `W.env(sky, intensity)`, `W.sun`, `W.hemi`, `W.water`, `W.lava`, `W.motes` for the environment. `W.surface(kind, o)` and `W.bake(size, fn)` make tiling PBR textures procedurally; there are no image assets.
- `FX.burst / ring / pillar / beam / lightning / slash / dome / missile / explode / flash / shake` for effects. Skip purely cosmetic effects when `G.headless` is true.
- `Post.lerpTo({ bloom, exposure, tint, ... }, seconds)` as a coroutine for phase mood changes. Bloom above about 0.8 washes the screen out quickly, so check a screenshot.
- `Cam.shot(posFrom, lookFrom, posTo, lookTo, seconds, fov)` for cinematics, then control returns to the player.
- Any time `Cam.cine` is set (Cam.shot, or a hand-set `Cam.cine = {...}`) during the intro, the fight or the kill, the player is locked centrally (`G.cineLock`, 10_game.js): no movement, skills, jump, targeting or mouse look, a cast in progress is dropped, GCD/cooldowns/buffs/class gauge freeze, no hits land except `pierce` blows, and the HUD hides. A boss needs nothing extra; just `Cam.release()` when the shot ends. Ground that falls away under the frozen hero puts them on the nearest standing ground when the camera returns. `tools/cinelock.js` checks it.
- Music is a 16-step sequencer: each layer is `{ v: voice, pat: 'x...x...' or note digits, from: phaseIndex, to, oct, len, vol }`. Layers with `from: 1` join in phase two, and so on. Voices: kick snare hat tom taiko clap bass sub pad arp lead organ bell choir koto flute brass pulse.

## Loading and hitches (`11_warm.js`, `Game.rehearse`)

Starting a fight builds the arena, then plays every phase once, invisibly and headless, on a throwaway copy (god mode, autopilot, its own random stream), then draws one hidden frame with every object visible so all shaders and textures are ready before the fade lifts. A light keeper pads the scene with zero-intensity dummy lights so the number of each kind of light never changes mid-fight (three.js recompiles every lit material when it does). What this means for a boss file:

- Show and hide lights freely, but build them all in `build()`. Lights made mid-fight (on adds) share a spare pool of 6 point lights; a shadow-casting light created mid-fight will recompile everything once.
- Anything a phase creates (adds, props, swapped materials) is picked up by the rehearsal, as long as the phase reaches it within about 24 s of autopilot play. Make rare one-off objects in `build()` and hide them instead.
- The warm-up frame gives empty pools one instance to draw (an instanced mesh with count 0, an empty draw range, a hidden material), so nothing needs a "keep one instance alive" trick any more.
- Effects that outlive a fight (anything under `FX.root`) are re-keyed to each fight's lights during the warm-up. Unlit materials you create mid-fight are fine as long as one material with the same shader existed at load.
- Never repaint a whole 2D canvas in one frame mid-fight. Stamp new marks only; if old marks must change, rebuild on a CPU canvas a few milliseconds per frame and copy the result over (see `paint` in `38_boss_atelier.js`: flush each stroke with a 1-pixel read so the budget is real, and clip once at the copy, not per stroke).
- Check a whole fight with `node tools/hitchscan.js <other id>,<id>` (second in the session on purpose): it should list nothing compiled or first drawn after loading.
- Check with `node tools/hitch.js <id>`: it plays each phase in real frames and lists every shader compiled after the fight started. Aim for none.

## Before shipping a boss

1. `node tools/smoke.js <id>` must report `err=[]` for every phase and every class.
2. `node tools/matrix.js all 3 <id>` (or `tools/sim.js <id> <class> 3 3` for one class), then `GOD=1 node tools/matrix.js all 1 <id>` to confirm every class can finish before the enrage. The autopilot does not need to win, but look at what kills it with `tools/tank.js`: one mechanic dealing most of the damage usually means the telegraph is too short or there is no safe place.
3. Take screenshots of each phase with `tools/shot.js "boss=<id>&skipintro=1&god=1&bot=3&phase=N"`.
4. Check every class can do the fight (README, "What a class must be able to do"): the caster needs moments to stand still, the melee classes need the boss reachable, and autopilot hints should read `p.cls.melee`, never a class id.
5. `node tools/nanscan.js <id>` must print `ALL CLEAN`. A NaN pixel is invisible in the sandbox but shows as black squares on a real GPU (see README, Shader safety).
6. `node tools/hitch.js <id>` lists no shader compiles after the fight starts.
