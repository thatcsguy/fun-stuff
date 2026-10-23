# PERIHELION boss authoring guide (as built)

This file describes the code as it is, not as SPEC.md planned it. Where the two disagree, this file is right.
Everything below was checked against `01_core.js` .. `12_bot.js` and exercised by a sample boss run with the bot in
fast-forward.

---------------------------------------------------------------------------------------------------------------
## 1. File skeleton and registration

`09_boss1.js`, `10_boss2.js`, `11_boss3.js` are concatenated after `08_ui.js` and before `12_bot.js` into one ES
module. Rules: wrap the file in an IIFE, declare your own locals, register at top level, do work only in callbacks.

```js
// 09_boss1.js
(() => {
  const T3 = G.THREE, PI = Math.PI, TAU = PI * 2;      // `THREE` is also in scope (imported by 01_core.js)
  const ACC = '#5fe3ff';
  G.bosses[0] = {                                     // 0 = boss 1, 1 = boss 2, 2 = boss 3
    name: 'GNOMON', title: 'the Brass Warden', accent: ACC, sky: 'night', music: 0,
    maxHp: 9000, parTime: 200, hitRadius: 1.2, hitHeight: 2.4,
    phases: [ /* see 3 */ ],
    build(b) { /* create b.model */ },
  };
})();
```

The boss select card, `?boss=1..3`, `__game.startFight(1..3)` and the UI all read `G.bosses[i]` at the moment the
fight starts, so a missing file just shows "Being forged".

---------------------------------------------------------------------------------------------------------------
## 2. Coordinates and conventions

- Boss at the origin, y up, arena plane y = 0. `G.RINGS = [5.5, 9.0, 12.5]`; ring index 0 = inner, 2 = outer.
- `G.polar(r, theta, y = 0, out?)` returns `(r cos theta, y, -r sin theta)`. Theta is counter-clockwise on screen,
  measured from +x toward -z. Always use it; `G.thetaOf(vec)` is the inverse.
- The camera sits on +z looking at the origin, so the hero starts at the bottom of the screen: `theta = -PI/2`,
  ring 1, `dir = +1` (counter-clockwise). Hero speed `G.OMEGA = 0.6` rad/s.
- Angle helpers: `G.wrap(a)` to (-PI, PI], `G.angDiff(a, b)`, `G.inArc(a, center, half)`, `G.lerpAngle`,
  `G.deg`. Math: `G.lerp, G.clamp, G.smooth, G.smoother, G.remap, G.damp`, plus easing helpers.
- **Boss model: local +x is its front.** The framework sets `b.root.rotation.y = b.facing + (def.facingOffset || 0)`
  each frame (when `b.autoFace`, the default). If your mesh faces another axis, set `facingOffset` and do not
  rotate the root yourself.
- The weak point ("behind") is `|angDiff(hero.theta, b.facing + PI)| < 60 deg`. The gold rear sigil on the floor
  shows it (hide it with `noSigil: true`).
- **Randomness:** gameplay uses `b.rand()` / `G.rand()` / `G.randRange` / `G.randInt` / `G.randPick`. These are
  seeded per fight from `?seed`. `Math.random` is only for visuals.
- Hazard, add, fx and boss meshes live in `G.layers.play` (fx, boss, arena, player). That group can tilt
  (`G.world.tilt`), and fx positions are local to it. The sky is separate and never tilts.

---------------------------------------------------------------------------------------------------------------
## 3. The boss definition

| field | meaning |
|---|---|
| `name`, `title` | boss card / HP bar / results text |
| `accent` | threat colour. At fight start it is copied to `G.colors.accent` and `G.world.setAccent`; every telegraph, cast ring and add defaults to it |
| `sky` | default sky preset: `'night'`, `'aurora'`, `'collapse'` (or `'menu'`) |
| `music` | track key: `0`, `1`, `2` (boss motifs), `'practice'`, `'menu'`. Default = boss index. Intensity layers follow the phase index automatically |
| `maxHp` | boss HP |
| `phases` | array, see below; `hpStart` must descend (1.0, 0.6, 0.3 ...) |
| `build(b)` | create the model and set `b.model = group` (it is parented to `b.root` for you). Store refs in `b.data` |
| `animate(b, dt)` | optional, every frame in every fight state (also during cinematics, the intro and victory). `dt` is scaled game time and **not** slowed by Supernova (the boss clock is) |
| `onTransition(b, from, to)` | optional cinematic. Return a Promise; it is raced against a 9 s timeout (combat clock). Default: flash, shockwave, a 2.6 s camera swoop |
| `onDeath(b)` | optional death cinematic. Return a Promise; there is an 11 s timeout. Default: slow-mo, bursts, a 6 s camera move, and the model is hidden |
| `teardown(b)` | optional. Runs on every reset (retry, restart, quit). Undo anything you did outside `b.root`, hazards and adds |
| `hitRadius`, `hitHeight` | where strikes and damage numbers land: `b.hitPoint(theta)` is `G.polar(hitRadius, theta, hitHeight)`. Defaults are 1.1 and 2.0 |
| `parTime` | seconds for an S grade (defaults are 200, 255 and 285 by index). S also needs at most 120 damage taken and no checkpoint |
| `facingOffset` | added to the root's y rotation |
| `fadeOpacity` | model opacity while the hero is hidden behind it (default 0.35). The framework makes the model's materials transparent for this |
| `noSigil` | hide the rear sigil |
| `infinite` | practice-dummy mode (HP never drops). Do not use for real bosses |

Each phase is `{ name, hpStart, enter?(b), update?(b, dt), script?(b), sky?, skyDur? }`:

- **`hpStart`** is a fraction of maxHp. When damage would push HP below the *next* phase's `hpStart * maxHp`, HP is
  clamped there and the transition starts. Damage never skips a phase.
- **`enter(b)`** runs synchronously when the phase begins. Reset `b.turnRate`, `b.trackPlayer` and `b.facingTarget`
  here.
- **`update(b, dt)`** runs every frame while the state is `fight` or `practice`. `dt` is the boss clock (Supernova
  slows it to 0.3).
- **`script(b)`** is an async function started once per phase; use `b.loop` / `b.wait` inside it (section 5).
- **`sky`** sets the sky for that phase:
  - omitted: `[def.sky, min(3, phaseIndex)]`
  - `'aurora'`: that preset at level = phase index
  - `['collapse', 2]` or `{ preset: 'collapse', level: 2 }`: exact preset and level
  - `false`: leave the sky alone

  The sky changes as the transition begins, over **`skyDur`** seconds (default 2.5). The fight's first phase is
  applied instantly.

**Transition order** (from `doTransition`):
1. abort scripts and casts;
2. clear hazards, kill adds;
3. state becomes `'cinematic'` (the hero is invulnerable, the fight timer stops, the boss is invulnerable);
4. `phaseTransition {from, to}`;
5. sky and music intensity advance;
6. `onTransition` runs and is awaited (9 s cap);
7. a 0.15 s pause;
8. state returns to `'fight'`;
9. `phaseStart {index, name}`, then `enter`, then `script`.

**Death:** abort, clear hazards, kill adds, then the `'cinematic'` state. `bossDefeated` fires, `onDeath` is
awaited (11 s cap), and then the results and victory screen show.

---------------------------------------------------------------------------------------------------------------
## 4. The runtime object `b`

Fields:

| field | meaning |
|---|---|
| `hp`, `maxHp`, `phase` (0-based), `alive` | basic state |
| `phaseT`, `clock` | boss-clock seconds, in the phase and in total; Supernova scales them by 0.3 |
| `facing` | radians, starts at `-PI/2`, facing the hero |
| `turnRate` | rad/s, default 0.42 |
| `trackPlayer` | default true. While true and `facingTarget` is null, the boss turns toward the hero at `turnRate` |
| `facingTarget` | null or theta; it overrides tracking |
| `autoFace` | when true, the framework writes `root.rotation.y` |
| `model`, `root`, `data` | `data` is your scratch object |
| `casting` | current cast or null |
| `staggerT`, `staggered` | stagger: x1.3 damage, set by an Eclipse interrupt |
| `invulnerable` | true during transitions |
| `hz`, `adds` | `G.hz`, `G.adds` |
| `R` | the ring radii |

Helpers:

```
b.wait(sec)                -> Promise; resolves after sec of boss clock. Rejects with Abort on phase change/death/reset
b.until(pred, step = 0.1)  -> Promise; polls pred with b.wait
b.loop(async fn)           -> runs fn again and again until the phase ends (an Abort inside it just ends the loop)
b.cast({ name, dur, interruptible = false, onDone(b), onInterrupt(b), telegraph(b) -> handle | handle[] })
                           -> Promise<'done' | 'interrupted'>; rejects with Abort if replaced or aborted
b.pick(arr), b.rand(), b.randRange(a, c)             seeded
b.playerTheta(), b.playerRing(), b.playerDir()       hero state now
b.playerAhead(sec)         -> hero theta predicted sec ahead on the current path (use for "in front of you")
b.behind()                 -> hero inside the rear arc
b.faceTo(theta)            sets facingTarget (turns at turnRate); b.faceTo(null) resumes tracking
b.turnToward(theta, dt, rate?)   manual turn step;   b.setFacing(theta) snap
b.say(text, dur = 2.5)     subtitle line
b.stagger(dur = 3)         stagger manually (e.g. a self-stun after a slam)
b.hitPoint(theta?)         Vector3 on the boss surface toward theta
b.damage(amount, info)     same as G.combat.dealDamage (rarely needed by bosses)
```

**Cast details:**
- The cast bar and the in-world cast ring show automatically. The ring is gold with chevrons when `interruptible`,
  and accent-coloured otherwise.
- It emits `castStart {name, dur, interruptible}`, then `castEnd {name, interrupted}`.
- Handles returned from `telegraph(b)` are cancelled when the cast is interrupted or aborted. They are **not**
  cancelled when it completes, so a hazard can carry on past the cast.
- A cast only completes in the `fight` or `practice` state. An Eclipse interrupt (any interruptible cast) staggers
  the boss for 3 s and calls `onInterrupt`.
- Raid damage on completion is done by hand: `onDone: () => G.player.damage(12, 'Noon Hymn')`. Keep it at 15 or
  less, because a perfect bot cannot avoid it.

---------------------------------------------------------------------------------------------------------------
## 5. Scripts: the pattern

```js
phases: [{
  name: 'Opening', hpStart: 1.0,
  enter(b) { b.turnRate = 0.42; b.trackPlayer = true; b.facingTarget = null; },
  async script(b) {
    b.loop(async () => {                         // attack rotation
      const r = b.playerRing();
      await b.hz.arc({ rings: [r], center: b.playerAhead(1.8), width: 0.8, warn: 1.8, dmg: 18, label: 'Gnomon Cut' });
      b.hz.ring({ ring: r, warn: 2.4, dmg: 30, gaps: [{ center: b.playerAhead(2.4) + Math.PI, width: 0.8 }] });
      await b.wait(3.2);
    });
    b.loop(async () => {                         // the ONLY loop that casts
      await b.wait(22);
      const res = await b.cast({ name: 'Noon Hymn', dur: 3, interruptible: true,
        onDone: () => G.player.damage(12, 'Noon Hymn') });
      if (res === 'interrupted') b.say('The Warden reels!');
    });
  },
}]
```

- **Awaiting a hazard handle** resolves `'done'` or `'cancelled'` when the hazard ends. If the phase is over by
  then, it rejects with `Abort` instead, so a follow-up line after the await never spawns into a cinematic or the
  next phase. `handle.done` is the raw promise: it always resolves and never aborts.
- Not awaiting a hazard is fine. Hazards run on their own, and all of them are cleared on a transition or death.
- Unhandled `Abort` rejections are swallowed globally, and `b.loop` and the phase script runner also ignore
  them. Do not wrap `b.wait` in try/catch unless you rethrow `Abort` (check it with `G.combat.isAbort(e)`).
- A script that keeps state across loops puts it in `b.data` or in closure variables in `script`.

---------------------------------------------------------------------------------------------------------------
## 6. Hazards (`G.hz.*`, also `b.hz.*`)

**The rules:**
- Hazards are the only thing that damages the hero (plus add contact, which is a hazard internally).
- Each hit calls `G.player.damage(dmg, label)` and lands at most once per activation, unless `tick` is set.
- Each hazard draws its own telegraph in `color` (default: the current `G.colors.accent`, read at creation).
- Times are seconds of boss clock. All hazards are slowed to 0.3 by Supernova through `G.hz.speed`.

**Common options:**

| option | meaning |
|---|---|
| `warn` | telegraph time before going live |
| `active` | how long it stays live (default 0.25) |
| `rings` | array of ring indices (default `[0, 1, 2]`) |
| `dmg` | damage per hit |
| `lethal` | hatched pulsing telegraph and deeper warning tone; use it for 70-100 damage |
| `label` | shown on death and in logs |
| `color` | telegraph colour |
| `tick` | seconds; repeat damage while inside |

A `warn` above 0.2 emits `telegraph {lethal, kind, warn}` and plays the warning tone. Orbs, gaps and add contact
do not emit it.

**The handle:**
- `id`, `kind`, `hazard` (the internal object)
- `cancel()`: quick fade-out
- `done`: Promise resolving `'done'` or `'cancelled'`
- `then`: awaitable, see section 5
- `fireAt`, `endAt`: `G.t` when it goes live / ends, estimated at the current speed

Damage guide (SPEC 2.4): ordinary 15-25, heavy 35-50, lethal 70-100, and lethal only with `warn` of at least 2.5 s
and a clear answer.

### arc: static wedge
```js
G.hz.arc({ rings: [1, 2], center: b.playerAhead(2), width: 0.8, warn: 2.0, active: 0.25, dmg: 20, label: 'Cut' });
```
- `center` (rad), `width` (rad, default 0.8), `active` 0.25, `tick` optional.
- The hero counts as inside up to about 0.15 world units past the edge.

### sweep: a beam travelling from `from` to `to`
```js
const th = b.playerTheta(), d = b.playerDir();
G.hz.sweep({ rings: [0, 1, 2], from: th - d * 1.2, to: th - d * 1.2 + d * Math.PI * 1.5, warn: 2.0, dur: 2.6, width: 0.22, dmg: 22 });
```
- `to` defaults to `from + PI`. It can exceed 2 PI, and its sign sets the direction.
- `dur` is the beam travel time (default 2) and replaces `active`.
- The preview shows the whole swept arc with an arrow. The hit test is sub-stepped, so a fast beam cannot skip the
  hero.

### ring: whole-ring detonation, with optional safe gaps
```js
G.hz.ring({ ring: 2, warn: 2.5, active: 0.4, dmg: 45, gaps: [{ center: b.playerAhead(2.5), width: 0.8 }], label: 'Hour Ring' });
```
- `ring` is a single index (default 1).
- `gaps` are `[{center, width}]`; inside a gap is safe, and gaps are drawn gold.
- It also glows the world ring during warn and active.

### rotor: slices rotating around the arena
```js
G.hz.rotor({ rings: [1, 2], slices: [{ center: 0, width: 0.6 }, { center: Math.PI, width: 0.6 }], omega: 0.4, warn: 1.8, dur: 6, tick: 0.5, dmg: 12 });
```
- `omega` is in rad/s, signed, and slice centres move as `center + omega * t`, measured from the hazard's own
  start (warn included).
- `dur` is the live time (default 8), and `tick` defaults to 0.5.

### wave: shockwave expanding from the boss or collapsing from the rim
```js
const h = G.hz.wave({ from: 'in', speed: 5, thickness: 0.9, gaps: [{ center: b.playerAhead(2.6), width: 0.8 }], warn: 2.6, dmg: 70, lethal: true });
// the hazard-local time it crosses ring k: h.hazard.crossTime(k)  (warn included)
```
- `from: 'in'` starts at r 1.6 and grows outward; `from: 'out'` starts at the rim (15.2) and shrinks.
- `speed` is in world units/s (default 6), and `thickness` defaults to 0.9.
- `gaps` are radial safe lanes through all rings. Shift i-frames also pass through it.

### orb: travelling projectile (no warn; its motion is the telegraph)
```js
G.hz.orb({ ring: 1, theta: b.playerTheta() + 2.4, omega: -0.4, dr: 0, life: 8, radius: 0.6, dmg: 15, onHit: (h, res) => {} });
```
- `omega` is in rad/s, and `dr` is in ring-index/s (it can move between rings; it ends past -0.7 or 2.7).
- `life` defaults to 6.
- `onHit(handle, {applied, blocked})` runs on contact, including an Aegis block.
- `h.hazard.pop()` destroys it with a burst.

### bolt: targeted strike at one spot
```js
G.hz.bolt({ from: new THREE.Vector3(0, 6, 0), ring: b.playerRing(), theta: b.playerAhead(1.5), warn: 1.6, radius: 1.0, dmg: 18 });
```
- `from` **must be a THREE.Vector3** (play-local; default `(0, 6, 0)`); it is where the lance comes from.
- `radius` is the arc length in world units (default 1.0). `active` is fixed at 0.18.

### soak: a star the hero must touch before `warn` runs out
```js
G.hz.soak({ ring: 0, theta: b.playerAhead(4), warn: 6, radius: 0.8, failDmg: 20, onSoak: (h) => b.say('Soaked'), onFail: (h) => {} });
```
- It is never "danger"; the bot steers toward it.
- It is touched when the hero is on that ring within `radius + 0.35` **and not mid-Shift**.
- If it is not touched, the hero takes `failDmg` and `onFail` runs.
- It emits `soak {ok, id}`.

### gap: broken track (lasts until cancelled)
```js
const g = G.hz.gap({ ring: 2, center: b.playerAhead(3), width: 0.6, dmg: 30, label: 'Shattered Track' });
await b.wait(8); g.cancel();
```
- It has no warn and is infinite: **cancel it yourself**. Transitions, death and reset clear it.
- Running into it costs `dmg`, then a forced fall to an adjacent intact ring (outer first). Aegis blocks the
  damage and the fall.
- A Shift across it is safe. The world ring is drawn broken through `G.world.setRingBroken`, handled for you.

### custom: escape hatch
```js
G.hz.custom({
  warn: 1.5, active: 0.4, dmg: 15, label: 'Spokes',
  test: (ring, theta, lt, pad) => ring === 2 && Math.abs(G.angDiff(theta, 0)) < 0.5 + pad / b.R[ring],
  draw: (group, handle) => {               // build meshes into group (fx layer); may return an update fn (lt, dt)
    group.add(G.combat.bandMesh(b.R[2] - 0.68, b.R[2] + 0.68, -0.5, 0.5, 0, G.colors.accent, {}));
  },
  onFire: (handle) => G.fx.ringFlash(2, { a0: -0.5, a1: 0.5 }),
});
```
- `test` is only consulted while live; `lt` is hazard-local time, warn included. Honour `pad`: the bot and the
  ghost trail ask with a pad of 0.22.
- Meshes in `group` are disposed for you. Telegraph materials found in `group` after `draw` (from `bandMesh` or
  `teleMaterial`) get the standard warn fill, fire flash and fade automatically.
- `G.combat.bandMesh(r0, r1, a0, a1, mode, color, {lethal, arrow, additive, y, order})` gives you the standard
  telegraph look; mode 0 is the sector fill. `G.combat.sectorGeometry(r0, r1, a0, a1, seg)` gives plain geometry.

### Queries and housekeeping
- `G.hz.dangerAt(ring, theta, tAhead)` returns 0 or 1.
- `G.hz.damageAt(ring, theta, tAhead)` returns the predicted damage.
- `G.hz.gapAt(ring, theta)`.
- `G.hz.list()` returns the live hazards; `G.hz.active` is the raw array.
- `G.hz.clear(filter?)` cancels all hazards, or the ones where `filter(h)` returns true, with `h` being the
  internal object (`h.kind`, `h.label`, ...). With no filter, **add contact hazards are kept** (kill adds with
  `G.adds`).

---------------------------------------------------------------------------------------------------------------
## 7. Adds (`G.adds`, also `b.adds`)

```js
const cog = b.adds.spawn({
  ring: b.playerRing(), theta: b.playerAhead(3), omega: 0, hp: 160, radius: 0.6, contactDmg: 18,
  blocks: true, dieOnContact: false, label: 'Cog', color: '#ff5f9e', barY: 2.0, data: {},
  model: (group, add) => { group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.5), G.mat.emissive('#ff5f9e', 1.5))); },
  update: (add, dt) => { add.theta += 0.2 * dt; /* or change add.ring */ },
  onContact: (add, res) => {}, onDeath: (add, reason) => {},
});
```

- Fields: `id, ring, theta, omega` (auto-advanced each frame), `hp, maxHp, alive, group, inner, pos, data, t`.
- Strike and Comet target adds automatically.
- On contact, a blocking add deals `contactDmg` and bounces the hero (forced Reverse), with a 1 s cooldown. A
  Shift to another ring passes through it.
- The add spawns dropping from y = 4 over 0.45 s and is harmless during the drop.
- Supernova and every transition or death kill all adds; `onDeath` runs with reason `'nova'`, `'transition'`,
  `'bossDeath'`, `'contact'` or a damage source.
- `G.adds.kill(add, reason)`, `G.adds.damage(add, base, info)`, `G.adds.killAll(reason)`, `G.adds.list`.
- `addDied {id, reason}` is emitted.

---------------------------------------------------------------------------------------------------------------
## 8. The hero (read-mostly)

- `G.player.state`: `hp, maxHp, ring, ringF, theta, dir, alive, shifting, iframes, halted, invuln, meter,
  empowered, behind, constellation, novaActive, pos`.
- `G.player.damage(amount, label)` returns `{applied, blocked}` and is the route for raid damage. It returns
  `applied: false` during the 0.8 s hit i-frames, Shift i-frames, Supernova and transitions. In practice mode it
  shows "HIT" and returns `applied: true` but takes no HP.
- `G.player.forceShift(delta, {fall})` and `G.player.forceReverse()` move the hero by force. Use them sparingly.
- `G.player.setSpeedMul(m, dur)` slows or hastes the hero.
- `G.player.anchors.list`, `.smash(a => pred)` and `.mark(pred, on)` work on anchor objects, which have `ring`,
  `theta` and `pos`. `mark` shows a warning ring, then you call smash, e.g. a slam that destroys anchors in a wedge.
- `G.player.predictTheta(sec)` and `predictRing(sec)`.
- Tuning lives in `G.player.K`: `omega 0.6, ringMul [1.35, 1, 0.75], behindMul 1.5, behindHalf 60 deg,
  staggerMul 1.3, staggerDur 3, hitIframes 0.8, meterScale 0.3`, and so on.

---------------------------------------------------------------------------------------------------------------
## 9. World, sky, fx, post, audio and camera

All of these are safe to call at any time, and an unknown name is ignored. Positions are play-local Vector3s
(`G.polar(...)` gives you one).

**Sky and world (`G.world`)**

- `setSky(preset, level 0-3, sec = 1.5)` sets the sky directly. Phases set it for you (section 3).
  - `night`: constellations appear at level 1+, a cyan nebula at 2+, a meteor shower at 3.
  - `aurora`: curtains, with a storm and lightning at 3.
  - `collapse`:
    - level 0: red sun
    - level 1: corona
    - level 2: violet collapse with a flash and bloom pulse
    - level 3: black hole
  - A set-piece plays when the level rises within the same preset.
- `setAccent(hex)`.
- `ringGlow(i | null | 'all', hex, amount, dur)`: `dur` 0 holds the glow until changed.
- `ringArrows(i, dir, show)` shows direction chevrons on a ring, e.g. to telegraph a forced reverse.
- `setRingRime(0..1)` frosts the rings. `flood(i, 0..1)` floods a ring with light.
- `tilt(xRad, zRad, dur, {spin})` tilts the whole play group. It is visual only: hit tests stay in ring and theta,
  and the camera refits to the tilted rings.
- `beat(strength)` gives a small world pulse.
- `meteor(color)` and `lightning(color)` are sky events.
- `setRingBroken` is driven by `hz.gap`; do not call it.
- `reset()` runs at every fight start and on menu; it clears glow, arrows, flood, rime, tilt and breaks.

**Fx (`G.fx`)**

| call | options |
|---|---|
| `burst(pos, o)` | `color, count, speed, size, life, gravity, drag, flat, up, star, intensity, flare` |
| `lance(from, to, o)` (alias `beam`) | `color, width, life, intensity, travel, tail, flare, onEnd` |
| `shockwave(pos, o)` (alias `ring`) | `color, radius, life, thickness, r0, lift, intensity` |
| `ringFlash(ringIndex, o)` | `color, a0, a1, life, intensity`; the whole ring if `a0`/`a1` are omitted |
| `flash(css, amt, dur)` | screen flash, amount capped at 0.55 |
| `number(pos, amount, o)` | `text, crit, color, size, life, rise`; `text(pos, str, o)` too |
| `spark(pos, color, o)` | |
| `starFall(pos, color, o)` | `dx, height, dz, dur, width, count, radius` |
| `shards(pos, o)` | `color, count, speed, size, life, gravity, floor` |
| `lightning(a, b, o)` | `color, segments, jag, width, life` |
| `flare(pos, o)` | |
| `glowSprite(color, size, o)` | returns a Sprite you add yourself |
| `trail(obj, o)` | `color, width, length, intensity, opacity`; returns `{remove, setColor, setVisible, clear}` and **you must `remove()` it in teardown** |

**Post (`G.post`)**

- `flash(color, amt, dur)`, `bloomPulse(add, dur)`, `shock(worldPos, amt, dur)` (screen ripple), `fade(amount,
  color, dur)`.
- `setTint(r, g, b)`, `setDesat(v)`, `setGrade([sr, sg, sb], [hr, hg, hb])`, `setVignette(v)`. All of these are
  restored by `G.post.reset()`, which runs at every fight start and quit.
- `setExposure` and `setBloom` are overwritten every frame by the sky, so use a sky level or `bloomPulse` instead.

**Audio (`G.audio`)**
- `sfx(name, {vol, pitch, delay, pos, gap, force})`. Boss-relevant names:
  - `crack, thunder, rumble, lance, meteor, retrograde, gravity`
  - `castStart, castDone, warn, telegraph, swell`
  - `bossHit, bossDeath, addSpawn, addDeath, bump, anchorWarn`
- Most cues fire automatically from events: casts, telegraphs, interrupts, transitions and hits.
- `duck(amount, dur)`. `setIntensity(0..3)` is automatic per phase. `music(key)` is automatic from `def.music`.

**Camera (`G.cam`)**

- `shake(amount ≤ 1.2, dur)`, `hitStop(dur ≤ 0.5, scale = 0.05)`, `slowMo(scale, dur)`, `clearTime()`.
- `cinematic(keys, {returnDur = 0.9, hold})` returns a Promise.
  - `keys` are `[{t, pos: [x, y, z], look: [x, y, z], fov?}]` in **world** space and **real seconds**.
  - If the first key's `t` is above 0, the current camera is prepended.
  - Afterwards it eases back to the gameplay camera over `returnDur`.
  - A new cinematic replaces the old one, whose promise resolves `'replaced'`.
  - `endCinematic()` skips to the end.
- The gameplay camera is fitted automatically; never move `G.camera` yourself outside a cinematic.
- `G.camera.position.toArray()` is a good "home" key.

---------------------------------------------------------------------------------------------------------------
## 10. Transition and death cinematics

```js
onTransition(b, from, to) {            // state is 'cinematic', hazards/adds already cleared, sky already moving
  G.fx.flash(ACC, 0.35, 0.5);
  G.cam.shake(0.6, 0.8);
  b.setFacing(-Math.PI / 2);           // face the camera for the pose
  const home = G.camera.position.toArray();
  return G.cam.cinematic([
    { t: 0,   pos: home,           look: [0, 0.5, 0] },
    { t: 1.4, pos: [3.5, 5, 12.5], look: [0, 3, 0] },
    { t: 3.0, pos: home,           look: [0, 0.5, 0] },
  ]);
},
async onDeath(b) {                     // b.alive is already false: b.wait() rejects here, use G.combat.wait()
  G.cam.slowMo(0.3, 1.2);
  const cin = G.cam.cinematic([{ t: 1.5, pos: [0, 4.5, 13], look: [0, 3, 0] },
                               { t: 4.5, pos: G.camera.position.toArray(), look: [0, 0.5, 0] }]);
  for (let i = 0; i < 6; i++) {
    G.fx.burst(new THREE.Vector3(0, 1 + i * 0.5, 0), { color: i % 2 ? ACC : '#fff1c2', count: 30, speed: 7 });
    G.cam.shake(0.4, 0.3); G.audio.sfx('crack');
    await G.combat.wait(0.35);
  }
  G.fx.flash('#fff6dd', 0.55, 1.2);
  b.root.visible = false;               // the default death hides the model; a custom one must do it itself
  return cin;
},
```

- `b.wait` works inside `onTransition`, because the boss is alive and the clock runs during the cinematic.
- `G.combat.wait(sec)` works in both and never rejects. It runs on the combat clock, which is game time.
- A cinematic outlives its 9 s or 11 s cap only visually; the fight moves on when the cap expires.
- Animate the model in `animate(b, dt)`, which runs during cinematics, keyed off `b.data` flags you set in
  `onTransition`.

---------------------------------------------------------------------------------------------------------------
## 11. Testing a boss with the bot in fast-forward

```js
// node test.js   (keep runs short, close the browser)
const { launch } = require(process.env.HARNESS);
(async () => {
  const { browser, page, url } = await launch({ mobile: false });
  await page.goto(url('perihelion') + '?debug=1&seed=1&quality=low');
  await page.waitForFunction(() => window.G && G.booted);
  const r = await page.evaluate(async () => {
    __game.startFight(1);              // 1-based boss number; opts {fromPhase: 0-based, skipIntro: true by default}
    __game.bot(3);                     // 1 sloppy .. 3 near perfect; 0 = off
    let s;
    for (let i = 0; i < 40; i++) {     // up to 400 s of game time
      s = await __game.fastForward(10);   // async! always await it
      if (s.state === 'victory' || s.state === 'dead') break;
    }
    return { s, stats: __game.stats(), errs: G.log.errors.slice(0, 5), logCount: G.log.count };
  });
  console.log(JSON.stringify(r));
  await browser.close();
})();
```

**Other hooks** (they need `?debug=1` or `?bot=N`):
- `__game.setPhase(n)` is 1-based and plays a real transition.
- `__game.killBoss()` plays the real death cinematic, then results.
- `__game.godMode(true)`, `__game.setHp(n)`, `__game.fillMeter()`.
- `__game.state()`, `__game.hazards()`, `__game.errors()`.
- `__game.dangerAt(ring, theta, t)`.

**URL options:**
- `?boss=1&phase=2` starts a fight directly.
- `?bot=3` turns the autopilot on.
- `?seed=N` makes the fight deterministic.
- `?skipintro=1`.
- `?debug=1&testboss=1` adds a reference boss (`G.bosses.test` in `12_bot.js`) that uses every primitive.

What to check:
- `G.log.count === 0`.
- Bot-3 wins.
- Fight length against the SPEC 9 targets: compare `results.time` across several seeds (`?seed=1..5`).
- No hit a bot-3 cannot avoid (`stats.player.hitsTaken`; unavoidable cast damage of 15 or less is fine).

---------------------------------------------------------------------------------------------------------------
## 12. Pitfalls (each of these was hit or verified while integrating)

- **Never use `setTimeout`, `setInterval` or `requestAnimationFrame` for gameplay.** Fast-forward does not advance
  them and pause does not stop them. Use `b.wait` in scripts and `G.combat.wait` in cinematics.
- **Only one loop should cast.** Starting a cast while another one runs aborts the first: its promise rejects with
  `Abort`, which silently ends the `b.loop` that was awaiting it. If two loops must cast, guard with
  `await b.until(() => !b.casting)`.
- **Waits reject on a phase change.** Code after an `await` never runs in the wrong phase. Do not catch `Abort` and
  carry on.
- **Hazard timing uses the boss clock** (slowed to 0.3 during Supernova). The camera and cinematic keys use real
  time, and transition caps use combat game time. At SwiftShader frame rates (5-20 fps, with dt clamped to 1/20)
  real-time playback is in slow motion, so judge timing in fast-forward.
- **`G.hz.clear()` without a filter keeps add contact hazards.** Use `G.adds.killAll()` or `G.adds.clear()` for
  adds.
- **`hz.gap` is infinite.** Keep the handle and cancel it.
- **A soak cannot be collected mid-Shift.** Place it so the hero arrives on the ring before the timer runs out.
- **`hz.bolt({from})` must be a `THREE.Vector3`**, not an array.
- **Use `G.polar` everywhere, and model the boss facing +x.** Hand-rolled `sin`/`cos` with +z produces mirrored
  attacks.
- **Hit i-frames last 0.8 s.** A second `G.player.damage` inside that window returns `applied: false`. Keep this in
  mind for raid damage right after a hazard, and in tests.
- **`G.combat.dealDamage` is ignored during transitions and while `b.invulnerable`.** HP is clamped at the next
  phase threshold.
- **Telegraph colour is read from `G.colors.accent` when the hazard is created.** To use a second threat colour
  (e.g. rose adds), pass `color`.
- **`G.world.setSky` does nothing when preset and level are unchanged.** The phase sky level defaults to the phase
  index, so a 3-phase boss on one preset goes 0 → 1 → 2. Use `sky: ['night', 3]` for the finale.
- **`G.post.setExposure` and `setBloom` are overwritten by the sky every frame** (section 9).
- **Dispose what you create outside `b.root`** in `teardown`, e.g. fx trails or objects added to other layers.
  Everything under `b.root`, every hazard and every add is disposed for you. Shared materials (`G.mat.brass()`
  without options, or anything with `material.userData.shared = true`) are skipped. Note that `G.mat.brass({...})`
  makes a new material each call; prefer one per boss.
- **`G.player.K.meterScale = 0.3`.** Nova meter gain is scaled down, so do not hand out meter as a reward
  expecting raw values.
- **Practice mode:** the hero takes no HP damage (only a "HIT" number), so test damage on a real boss index.
- **The boss model fades to 35% opacity** when the hero is behind it on screen, and its materials are switched to
  transparent for that. Do not rely on `transparent: false` sorting for model parts.
- **`b.cast({telegraph})` handles are not cancelled when the cast completes.** Cancel them in `onDone` if they
  should stop.
