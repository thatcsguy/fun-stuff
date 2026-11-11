# Adding a boss

A boss is one file, `src/NN_boss_<id>.js` (use the next free number in the 20s), wrapped in an IIFE that ends with `G.bosses.push({...})`. Run `./build.sh` and a new door appears in the menu. Nothing else needs to change. `20_boss_cathedral.js` is the best file to copy from; `24_boss_titan.js` shows a non-standard arena (ring floor around a giant boss) and `23_boss_engine.js` a floor that falls away.

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

## Scripting

Phases are generator coroutines. `yield 1.5` waits seconds, `yield` waits a frame, `yield () => cond` waits for a condition, `yield*` calls another generator. When health crosses the next phase's `at`, the running `run` is cancelled, hazards tagged `'phase'` are cleared, and `enter` then `run` of the next phase start. Use `Co.start(gen, 'fight')` for things that must survive a phase change.

Boss helpers: `yield* b.cast({ name, time, interruptible, onTick })` returns `'done'`, `'interrupted'` or `'dead'`; `yield* b.turnTo(angle)`, `yield* b.moveTo(x, z, speed)`, `b.angToPlayer()`, `b.distToPlayer()`, `b.spawnAdd({ name, hp, x, z, radius, mesh, update, *run, onDeath })`, `b.immune`, `b.targetable`, `b.dmgTaken` (damage multiplier, for armour or vulnerable windows), `b.exposed`.

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
- Music is a 16-step sequencer: each layer is `{ v: voice, pat: 'x...x...' or note digits, from: phaseIndex, to, oct, len, vol }`. Layers with `from: 1` join in phase two, and so on. Voices: kick snare hat tom taiko clap bass sub pad arp lead organ bell choir koto flute brass pulse.

## Loading and hitches (`11_warm.js`, `Game.rehearse`)

Starting a fight builds the arena, then plays every phase once, invisibly and headless, on a throwaway copy (god mode, autopilot, its own random stream), then draws one hidden frame with every object visible so all shaders and textures are ready before the fade lifts. A light keeper pads the scene with zero-intensity dummy lights so the number of each kind of light never changes mid-fight (three.js recompiles every lit material when it does). What this means for a boss file:

- Show and hide lights freely, but build them all in `build()`. Lights made mid-fight (on adds) share a spare pool of 6 point lights; a shadow-casting light created mid-fight will recompile everything once.
- Anything a phase creates (adds, props, swapped materials) is picked up by the rehearsal, as long as the phase reaches it within about 24 s of autopilot play. Make rare one-off objects in `build()` and hide them instead.
- Check with `node tools/hitch.js <id>`: it plays each phase in real frames and lists every shader compiled after the fight started. Aim for none.

## Before shipping a boss

1. `node tools/smoke.js <id>` must report `err=[]` for every phase and both classes.
2. `node tools/sim.js <id> duskblade 3 3` and the same for `stormcaller`. The autopilot does not need to win, but look at what kills it with `tools/tank.js`: one mechanic dealing most of the damage usually means the telegraph is too short or there is no safe place.
3. Take screenshots of each phase with `tools/shot.js "boss=<id>&skipintro=1&god=1&bot=3&phase=N"`.
4. Check both classes can do the fight: the caster needs moments to stand still, the melee needs the boss reachable.
5. `node tools/nanscan.js <id>` must print `ALL CLEAN`. A NaN pixel is invisible in the sandbox but shows as black squares on a real GPU (see README, Shader safety).
6. `node tools/hitch.js <id>` lists no shader compiles after the fight starts.
