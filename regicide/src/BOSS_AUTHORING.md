# REGICIDE boss authoring guide (as built)

Read SPEC.md first (sections 2-8). This file is the API as it exists in `06_combat.js`, `07_player.js` and friends.
Where SPEC.md and this file disagree, this file is right. Everything here was exercised by the throwaway test boss
(`?testboss=1&debug=1`, see `15_bot.js`) with the bot in fast-forward.

---------------------------------------------------------------------------------------------------------------
## 1. File skeleton and registration

`10_boss1.js` .. `14_boss5.js` are concatenated after `09_run.js` and before `15_bot.js` into one ES module.
Wrap the file in an IIFE, declare your own locals, register at top level, do work only in callbacks.

```js
// 10_boss1.js
(() => {
  const T3 = G.THREE, PI = Math.PI, TAU = PI * 2;      // `THREE` is also in scope
  const ACC = '#ff7a2a';
  G.bosses[0] = {                                     // 0 = court 1 ... 4 = court 5 (the King)
    name: 'VARRAK', title: 'the Hearth Knight', court: 'The Court of Ash', accent: ACC, sky: 'ember', arena: 'ash', music: 0,
    maxHp: 8000, parTime: 210, hitRadius: 1.6, hitHeight: 2.2, bodyRadius: 1.3, speed: 3.5,
    intro: ['The hearth remembers every traitor.', 'Burn with it.'],
    phases: [ /* see 3 */ ],
    build(b) { /* create b.model */ },
  };
})();
```

The court select, `?boss=1..5`, the run and `__game.startFight(1..5)` read `G.bosses[i]` when the fight starts, so a
missing file shows "Being forged" on the card.

---------------------------------------------------------------------------------------------------------------
## 2. Coordinates and conventions

- Arena disc of radius `G.ARENA_R` (13) on y = 0, centre at the origin, y up. The live playable radius is
  `G.world.arenaR` (bosses shrink it with `G.world.setArenaR(r, dur)`); the player is clamped to `arenaR - 0.4`.
- `G.polar(r, theta, y = 0, out?)` returns `(r cos theta, y, -r sin theta)`. Theta is counter-clockwise on screen,
  measured from +x (right) toward -z (up the screen). `G.thetaOf(vec)` is the inverse. Angle helpers: `G.wrap`,
  `G.angDiff(a, b)`, `G.inArc`, `G.lerpAngle`, `G.deg`. Math: `G.lerp, G.clamp, G.smooth, G.remap, G.damp`, easings.
- The camera sits on +z looking at the origin (56 degrees pitch), fitted so the whole disc is visible. The player
  starts at `(0, 0, 8)` (bottom of the screen). The boss starts at the origin, facing the player.
- **Boss model: local +x is its front.** The framework sets `b.root.rotation.y = b.facing + (def.facingOffset || 0)`
  every frame (while `b.autoFace`, the default) and `b.root.position = b.pos`. Build the model so it faces +x.
- Randomness: gameplay uses `b.rand()` / `b.randRange` / `b.randInt` / `b.pick` (seeded per fight). `Math.random`
  is for visuals only.
- Hazard telegraphs, adds, fx and the boss live in `G.layers.play` children (`fx`, `boss`, `arena`, `player`).

---------------------------------------------------------------------------------------------------------------
## 3. The boss definition

| field | meaning |
|---|---|
| `name`, `title`, `court` | court card, HP bar, results |
| `accent` | threat colour, copied to `G.colors.accent` at fight start; every telegraph defaults to it |
| `sky` | preset: `night`, `aurora`, `collapse`, `ember`, `glass`, `storm` (see `05_world.js` header) |
| `arena` | skin: `ash`, `glass`, `tide`, `storm`, `throne`, `none` |
| `music` | track key 0-4 (default = court index) |
| `maxHp` | boss HP. The player does about 35-45 DPS with no Edicts, 55-70 with a mid-run build. Target 3-5 minutes: 8000 (court 1), 9500, 11000, 13000, 18000 (King) |
| `phases` | array, `hpStart` descending (1.0, 0.65, 0.3 ...) |
| `hitRadius`, `hitHeight` | where strikes land: `b.hitPoint(theta)` = boss pos + `polar(hitRadius, theta, hitHeight)`. Rend reaches the boss when `dist - hitRadius <= 7` |
| `bodyRadius` | the player is pushed out of this radius (default `hitRadius * 0.85`); `noBody: true` on `b` disables it |
| `speed` | default walking speed for `b.moveTo` (3) |
| `turnRate` | rad/s, default 2.4 |
| `parTime` | seconds for an S grade |
| `intro` | two short lines on the court card |
| `build(b)` | create the model, set `b.model = group` (parented to `b.root` for you). Store refs in `b.data` |
| `animate(b, dt)` | every frame in every fight state, including cinematics |
| `onTransition(b, from, to)` | optional cinematic, return a Promise (9 s cap). Default: flash, shockwave, 2.6 s camera swoop |
| `onDeath(b)` | optional death cinematic, return a Promise (11 s cap). Default: slow-mo, bursts, a 6 s camera move, model hidden |
| `teardown(b)` | runs on every reset. Undo anything you did outside `b.root`, hazards and adds (world calls, trails, extra meshes) |
| `fadeOpacity` | model opacity while the player is behind it on screen (default 0.35) |
| `facingOffset` | added to the root's y rotation |

Each phase: `{ name, hpStart, enter?(b), update?(b, dt), script?(b), sky?, skyDur?, intensity? }`.
- **`hpStart`**: fraction of maxHp. Damage never skips a phase: HP clamps at the next phase's threshold and the
  transition starts.
- **`enter(b)`** runs synchronously at phase start: reset `b.turnRate`, `b.trackPlayer`, `b.facingTarget` here.
- **`update(b, dt)`** every frame while the state is `fight`/`practice` (`dt` is the boss clock).
- **`script(b)`** async, started once per phase; use `b.loop` / `b.wait` inside.
- **`sky`**: omitted = `[def.sky, min(3, phaseIndex)]`; `['ember', 2]` exact; `false` leave it. Applied over
  `skyDur` seconds (default 2.5) as the transition begins.

Transition order: abort scripts and casts; clear hazards, kill adds; state `cinematic` (the player is
invulnerable, the fight timer stops); `phaseTransition {from, to, name}`; sky + music intensity advance; the
player's phase-heal Edict runs; `onTransition` awaited (9 s cap); 0.15 s; state `fight`; `phaseStart`, `enter`,
`script`. The phase banner shows 0.55 s into the cinematic. If the player dies during the cinematic the fight ends.

Death: abort, clear hazards, kill adds, `cinematic`, `bossDefeated`, `onDeath` (11 s cap), results, `victory`.

---------------------------------------------------------------------------------------------------------------
## 4. The runtime object `b`

Fields: `hp, maxHp, phase, alive, phaseT, clock, pos (Vector3, y 0), facing, turnRate, trackPlayer,
facingTarget, autoFace, model, root, data, casting, staggerT / staggered, exposedT / exposed, invulnerable,
speed, hitRadius, bodyRadius, noBody`.

```
b.wait(sec)                 Promise; rejects with Abort on phase change / death / reset
b.until(pred, step = 0.1)
b.loop(async fn)            runs fn until the phase ends
b.cast({ name, dur, interruptible = false, onDone(b), onInterrupt(b), telegraph(b) -> handle | handle[] })
                            -> Promise<'done' | 'interrupted'>; rejects with Abort if replaced or aborted
b.moveTo(x, z, speed?)      -> Promise ('done' | 'replaced' | 'stopped'; rejects with Abort on a phase change); the boss walks (not while staggered)
b.stopMove(), b.teleport(x, z)
b.faceTo(theta) / b.faceTo(null), b.turnToward(theta, dt, rate?), b.setFacing(theta)
b.playerPos()               Vector3 copy;  b.playerAhead(sec) predicted position (clamped to the arena)
b.playerTheta()             angle from the boss to the player;  b.playerDist()  (centre to centre)
b.say(text, dur = 2.5)      subtitle
b.stagger(dur = 2.5)        boss stunned: no turning, no moving (scripts keep running: pause them yourself if needed)
b.expose(dur = 6)           +30% damage taken (Rebuke interrupts do this for you)
b.hitPoint(theta?)          Vector3 on the boss surface
b.damage(amount, info)      G.combat.dealDamage (rarely needed)
b.pick(arr), b.rand(), b.randRange(a, c), b.randInt(a, c)
b.hz, b.adds                G.hz, G.adds
```

**Casts:** the cast bar and an in-world ring around the boss show automatically (purple with chevrons when
`interruptible`, accent otherwise). Emits `castStart {name, dur, interruptible}` and `castEnd {name, interrupted}`.
Handles returned by `telegraph(b)` are cancelled on interrupt/abort, not on completion. A Rebuke interrupt staggers
the boss 2.5 s, exposes it, and calls `onInterrupt`. Raid damage on completion is by hand:
`onDone: () => b.hz.wipe(12, 'War Horn')`. Keep it at 15 or less. **Every phase needs at least one interruptible
cast**, and interrupting it must matter (it prevents adds, a buff, raid damage or a nasty pattern).

---------------------------------------------------------------------------------------------------------------
## 5. Scripts: the pattern

```js
phases: [{
  name: 'Kindling', hpStart: 1.0,
  enter(b) { b.turnRate = 2.4; b.trackPlayer = true; b.facingTarget = null; },
  async script(b) {
    b.loop(async () => {                              // attack rotation
      const p = b.playerAhead(1.2);
      await b.hz.cone({ x: b.pos.x, z: b.pos.z, theta: b.playerTheta(), width: 1.0, r: 9, warn: 1.6, dmg: 18, label: 'Hearth Cleave' });
      await b.wait(1.0);
      await b.hz.circle({ x: p.x, z: p.z, r: 2.6, warn: 1.8, dmg: 22, label: 'Ember Slam' });
      await b.wait(2.5);
    });
    b.loop(async () => {                              // the ONLY loop that casts
      await b.wait(18);
      const r = await b.cast({ name: 'War Horn', dur: 3.2, interruptible: true, onDone: () => { b.hz.wipe(10, 'War Horn'); spawnHounds(b, 2); } });
      if (r === 'interrupted') b.say('The horn falls silent.');
    });
  },
}]
```

- Awaiting a hazard handle resolves `'done'` or `'cancelled'`; if the phase ended first it rejects with `Abort`,
  so follow-ups never leak into a cinematic or the next phase. `handle.done` is the raw promise.
- Not awaiting is fine. All hazards clear on transition / death.
- Unhandled `Abort` rejections are swallowed globally. Do not wrap `b.wait` in try/catch unless you rethrow Abort
  (`G.combat.isAbort(e)`).
- Keep cross-loop state in `b.data` or closure variables.

---------------------------------------------------------------------------------------------------------------
## 6. Hazards (`G.hz.*` / `b.hz.*`)

Common options: `warn` (telegraph seconds), `active` (live seconds, default 0.25), `dmg`, `label` (required,
shown on death), `color` (default accent), `lethal` (gold hatched look + klaxon), `unblockable` (gold look;
Bulwark does not stop it, Dash i-frames do), `tick` (repeat damage every n s while live and inside),
`liveStyle: 'soft' | 'flash'`, `onFire(handle)`, `onHit(handle, res)`, `onEnd(handle, how)`.
Positions are `x, z` numbers; angles in radians (theta convention above).

| call | shape | extras |
|---|---|---|
| `circle({x, z, r})` | disc; fill grows from the centre | `follow: 'player' \| 'boss'` keeps the centre on them until `lockAt` (0.35 s) before impact; `burst: false` |
| `ring({x, z, r0, r1, gaps})` | annulus; fill grows from r0 | `gaps: [{theta, width}]` drawn blue, safe |
| `cone({x, z, theta, width, r, r0?})` | wedge from a point; fill grows from the apex | `follow: 'player'` aims at the player until lockAt; `anchor: 'boss'` keeps the apex on the boss; `omega` (rad/s) + `dur` makes a rotor (live for `dur`, `tick` 0.5 default); `thetaAt(lt)` |
| `line({ax, az, bx, bz, width})` | rectangle A to B; fill grows from A | `arrow: true`; `sweep: {to: [x, z], dur}` moves the whole segment by (to - A) over `dur` while live (a faint preview of the swept area shows during warn) |
| `wave({x, z, r0, r1, speed, thickness, gaps})` | expanding (r1 > r0) or collapsing band | live time = travel time; `gaps` are radial blue lanes; `h.hazard.radiusAt(lt)`, `crossTime(r)` |
| `safe({x, z, r, dmg})` | blue disc; when the timer ends, everything OUTSIDE takes `dmg` | `follow: 'boss'`; `flashColor` |
| `soak({x, z, r, warn, failDmg, onSoak, onFail})` | green star; touch it (not mid-dash) before warn ends or take `failDmg` (unblockable) | emits `soak {ok}` |
| `orb({x, z, dir, speed \| vx, vz, r, life, dmg})` | projectile, no warn (its trail is the telegraph) | `homing` 0-1, `bounce` off the rim, `onHit`, `onPop(handle, hit)`, `h.hazard.pop()`; Rebuke and Verdict destroy orbs |
| `void({x, z, r, tick = 0.6, dmg})` | a persistent pit (purple lip), `active` infinite: **cancel it yourself** | the player standing in it takes `dmg` every tick |
| `custom({test(px, pz, lt, pad), draw(group, handle), onFire})` | escape hatch | `draw` may return an update fn `(lt, dtH, dtR)`; meshes from `G.hz.teleMesh` found in `group` get the standard fill |
| `wipe(dmg, label, {unblockable})` | raid damage now | goes through `G.player.damage` |

Handle: `{id, kind, hazard, cancel(), done, then, fireAt, endAt}`. `hazard` is the internal object (`x, z, t, warn,
live, ...`). `G.hz.list()`, `G.hz.clear(filter)` (keeps nothing: adds are separate), `G.hz.clearProjectiles()`,
`G.hz.dangerAt(x, z, tAhead, pad)`, `G.hz.safeAt(x, z)`, `G.hz.teleMesh(o)` (a standalone telegraph mesh for your
own visuals: `{shape: 'disc'|'ring'|'sector'|'rect', x, z, r, r0, r1, theta, width, len, rot, color, mode, y, order,
arrow}`; set `uniforms.uP/uLive/uAlpha` yourself and `G.combat.removeObj` it), `G.hz.COL` (`gold, safe, soak,
purple, void`).

Damage guide: ordinary 15-25, heavy 35-50 (give these `warn >= 1.8`), lethal 70-100 (`lethal: true`,
`warn >= 2.5`, always a clear answer). Unblockable things should be rare and gold. The player has 100 HP, two Mends
of 35, and a 0.5 s hit i-frame; the bot at level 3 must be able to beat the court.
Test positions against `G.world.arenaR` when the arena has been shrunk.

---------------------------------------------------------------------------------------------------------------
## 7. Adds (`G.adds` / `b.adds`)

```js
const hound = b.adds.spawn({
  x, z, hp: 180, radius: 0.6, contactDmg: 14, label: 'Cinder Hound', color: '#ff7a2a', barY: 1.8, data: {},
  model: (group, add) => { group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.5), G.mat.emissive('#ff7a2a', 1.5))); },
  update: (add, dt) => { /* move add.pos; not called while staggered or during the 0.45 s drop-in */ },
  onContact: (add) => {}, onDeath: (add, reason) => {},
});
```
Fields: `id, pos (Vector3), vel, hp, maxHp, alive, group, inner, data, t, staggerT, radius`. Contact: `contactDmg`
with a 1 s cooldown, the player is pushed out. Rend targets an add within 4 u when it is closer than the boss;
Rebuke staggers adds in its cone (x3 damage for 3 s, knocked back 2 u). Adds are clamped to the live arena and die
on every transition / death (`onDeath` reason `'transition'`, `'bossDeath'`, `'clear'`, or the killing skill: `'rend'`, `'cleave'`, `'riposte'`, `'verdict'`, else `'damage'`; test for "killed by the player" with `!['transition','bossDeath','clear'].includes(reason)`).
`G.adds.kill(add, reason)`, `damage(add, n, info)`, `stagger(add, dur)`, `killAll(reason)`, `nearest(x, z, maxD)`,
`list`. Emits `addSpawn`, `addDied`.

---------------------------------------------------------------------------------------------------------------
## 8. The player (read-mostly)

`G.player.state`: `hp, maxHp, pos (Vector3), vel, facing, alive, dashing, iframes, invuln, shield {up, absorbed},
ult (0-1), ultActive, burning, target`. `G.player.K` holds the tuning (speed 7.5, radius 0.45, ...).
- `G.player.damage(amount, label, {unblockable, dot})` -> `{applied, blocked, absorbed, amount}`. Hazards call it
  for you; call it yourself only for raid-wide hits (`b.hz.wipe` wraps it).
- `G.player.burn(dps, dur, label)` damage over time (Mend cleanses). `G.player.slow(mul, dur)`,
  `setSpeedMul(mul, dur)`, `pull(x, z, strength, dur)` (a whirlpool; strength is velocity added per 1/30 s, frame-rate independent), `knockback(theta, dist)`.
- `G.player.predictPos(sec)`, `G.player.mods` (the Edict build; e.g. `mods.exposeDur`).

---------------------------------------------------------------------------------------------------------------
## 9. World, fx, post, audio, camera

**World (`G.world`)**: `setSky(preset, level, sec)`, `setArena(skin)` (called for you from `def.arena`),
`setArenaR(r, dur)` and `arenaR`, `floorGlow(hex, amount, dur)`, `rimGlow(hex, amount, dur)`, `beat(strength)`,
`meteor(color)`, `lightning(color)`, `setAccent(hex)`, `reset()` (every fight start). Read the header comment of
`05_world.js` for the exact list; unknown names are ignored by the `world()` helper pattern
(`try { G.world.x && G.world.x(...) } catch {}`), so guard your calls the same way.

**Fx (`G.fx`)**: `burst(pos, {color, count, speed, size, life, gravity, drag, up, flareSize})`, `lance(from, to,
{color, width, life, intensity, travel, tail, flare})` (alias `beam`), `shockwave(pos, {color, radius, r0, life,
thickness, intensity})`, `flash(css, amt, dur)` (capped at 0.4 in play), `number(pos, amount, {text, crit, color,
size, life, rise})`, `text(pos, str, o)`, `spark(pos, color, o)`, `starFall(pos, color, o)`, `shards(pos, {color,
count, speed, size, life, gravity, floor})`, `lightning(a, b, {color, segments, jag, width, life})`, `flare(pos,
o)`, `glowSprite(color, size, o)` (add it yourself), `trail(obj, {color, width, length, intensity})` (returns
`{remove, setColor, setVisible, clear}`: **remove it in teardown**). Positions are play-local Vector3s.

**Post (`G.post`)**: `flash`, `bloomPulse(add, dur)`, `shock(worldPos, amt, dur)` (screen ripple), `fade(amount,
color, dur)`, `setTint(r, g, b)`, `setDesat(v)`, `setGrade(shadow, high)`, `setVignette(v)`; all restored by
`G.post.reset()` at every fight start. Bright flashes are capped in play; cinematics allow more. Big additive planes
above ~0.9 per channel turn into white slabs when several overlap: keep custom glows modest.

**Audio (`G.audio.sfx(name, {vol, pitch, delay, gap})`)**: `crack, thunder, rumble, lance, meteor, castStart,
castDone, warn, telegraph, swell, bossHit, bossDeath, addSpawn, addDeath, lethalWarn, arenaShrink, orbPop`.
Casts, telegraphs, interrupts, transitions, hits and deaths play automatically from events. Music intensity follows
the phase (`phase.intensity` or spread 0..3 over the phases).

**Camera (`G.cam`)**: `shake(amount <= 1.2, dur)`, `hitStop(dur <= 0.5)`, `slowMo(scale, dur)`,
`cinematic(keys, {returnDur, hold})` with keys `[{t, pos: [x, y, z], look: [x, y, z], fov?}]` in world space and real
seconds (returns a Promise; `endCinematic()` skips). Never move `G.camera` yourself.

---------------------------------------------------------------------------------------------------------------
## 10. Transition and death cinematics

```js
onTransition(b, from, to) {
  G.fx.flash(ACC, 0.35, 0.5); G.cam.shake(0.6, 0.8);
  const home = G.camera.position.toArray();
  return G.cam.cinematic([{ t: 0, pos: home, look: [0, 0.5, 0] }, { t: 1.4, pos: [b.pos.x + 3.5, 5, b.pos.z + 12.5], look: [b.pos.x, 3, b.pos.z] }, { t: 3.0, pos: home, look: [0, 0.5, 0] }]);
},
async onDeath(b) {              // b.alive is false here: b.wait() rejects, use G.combat.wait(sec)
  G.cam.slowMo(0.3, 1.2);
  const cin = G.cam.cinematic([{ t: 1.5, pos: [0, 4.5, 13], look: [0, 3, 0] }, { t: 4.5, pos: G.camera.position.toArray(), look: [0, 0.5, 0] }]);
  for (let i = 0; i < 6; i++) { G.fx.burst(new THREE.Vector3(0, 1 + i * 0.5, 0), { color: ACC, count: 30, speed: 7 }); G.cam.shake(0.4, 0.3); G.audio.sfx('crack'); await G.combat.wait(0.35); }
  G.fx.flash('#fff6dd', 0.55, 1.2); b.root.visible = false;
  return cin;
},
```

---------------------------------------------------------------------------------------------------------------
## 11. Testing with the bot in fast-forward

Scripts live in `/tmp/claude-0/-home-claude-fun-stuff/8456865f-5c89-5580-a6e4-e777b5b5ac12/scratchpad/tests/`:
`node sim.js <court 1-5> <botLevel 1-3> <seed> [maxSec] [edicts]` runs one bot fight headless and prints the
outcome, stats and the first errors; `node shot.js <desk|phone|land> <court> <fastForwardSeconds> <out.png>` renders
a screenshot (then LOOK at it with the Read tool). Copy them if you need variants. Hooks on `window.__game` (need
`?debug=1`): `startFight(court, {fromPhase, skipIntro, edicts})`, `setPhase(n)` (1-based, real transition),
`godMode`, `killBoss`, `setHp`, `fillUlt`, `setEdicts(ids)`, `fastForward(sec, dt)` (async, always await),
`state()`, `stats()`, `hazards()`, `errors()`, `bot(level)`, `dangerAt(x, z, t)`.

Rules: simulate, do not render (SwiftShader is 1-5 fps); every run must end with `errors: 0`; bot-3 beats the court
in most seeds, bot-2 sometimes, bot-1 rarely; use 8+ seeds before trusting a win rate; one Chromium per agent and
close it; the machine has 4 CPUs shared with four other boss builders, so expect slowness and keep sims short.

## 12. Lessons from the five courts (read before writing a new one)

- **Camera height.** The play camera fits the disc; keep models under ~6 u tall when they stand at `z <= -7`, and
  nothing seated beyond the rim (the world's throne at `z = -18.5`) is visible in a fight.
- **Death cinematics.** `fx.flash` above ~0.5 for more than ~0.6 s plus a radius-18 shockwave whites out the whole
  frame; keep the climax readable (flash 0.4-0.5, shockwave intensity <= 0.8).
- **Blue gap meshes.** A tele mesh built with `mode: 2`/`3` (safe/soak) inside a danger hazard keeps its mode;
  set `mesh.userData.keepMode = true` to protect any other mesh from the hazard-wide mode override.
- **Voids** live until `handle.end()` or the phase ends (`active: Infinity`).
- **`G.player.pull`** is a single slot; call it every frame with a short `dur` from a per-frame driver when two
  pulls could overlap. Strength is per 1/30 s, frame-rate independent.
- **Orbs vs. the bot.** The autopilot spends Rebuke on any cluster of 2+ orbs, so orbs fired within ~9 s before an
  interruptible cast guarantee the bot cannot interrupt it. Give the player the choice, not a trap.
- **Sweeping lines** have no `gaps`; build the lane with a `custom` hazard (see court III's Tide Line and court
  IV's Lightning Wall).
- **`b.moveTo`** rejects with `Abort` on a phase change (like `b.wait`), so `await b.moveTo(...)` is safe inside
  loop bodies; it resolves `'replaced'`/`'stopped'` when another move or `stopMove` supersedes it.
- **Phase banners** run on real time, so screenshots right after `setPhase` still show the banner.
