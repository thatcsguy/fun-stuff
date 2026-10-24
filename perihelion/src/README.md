# PERIHELION: The Orrery Raid (sources)

A single-file Three.js boss rush. Your hero, the Orrery Knight, runs around the boss on one of three
brass rings and never steers. You have two movement verbs, **Reverse** and **Shift** in or out, plus
five skills: Strike (automatic), Anchor, Comet, Eclipse, Aegis and Supernova. There are three bosses:

| # | Boss | Phases | File |
|---|------|--------|------|
| 1 | GNOMON, the Brass Warden | 3 | `09_boss1.js` |
| 2 | OUROS, the Aurora Coil | 4 | `10_boss2.js` |
| 3 | HELIARCH, the Dying Sun | 3 + Event Horizon | `11_boss3.js` |

The game runs on desktop (keyboard, or mouse on the buttons) and on phones (touch buttons; iPhone
Chrome/Safari is WebKit).

- **Design (binding):** `SPEC.md`. The original brief is `/mnt/project-files/auto-raid/design.md`.
- **API as built:** `BOSS_AUTHORING.md`. It covers hazards, the boss framework, events, world/post,
  pitfalls, the readability layer and how the bot plays. Read it before touching a boss.

## Build

```
bash perihelion/src/build.sh      # must print SYNTAX_OK
```

The script concatenates the sources in order into `perihelion/index.html` and then runs `node --check`
on the module script. **Never edit `index.html` by hand.** Three.js 0.170.0 loads from jsDelivr
through an importmap in `00_head.html`.

## Where things live

| File | Contents |
|------|----------|
| `00_head.html` | Doctype, meta tags, base CSS, importmap, canvas, loading veil |
| `00_ui.html` | All HUD, menu and touch-control markup and CSS |
| `01_core.js` | `G` namespace, URL params, math, seeded RNG, event bus, renderer/post chain (bloom, auto-exposure, grade), black-screen watchdog (`ph_gfx_safe`), quality tiers, main loop, `G.core.step` |
| `02_input.js` | Keyboard and gamepad mapped to semantic actions (`G.input.on/fire`) |
| `03_audio.js` | Synthesised WebAudio music (per-boss motif, intensity 0-3) and SFX |
| `04_fx.js` | Particles, beams, lances, shockwaves, damage numbers, screen flash |
| `05_world.js` | Sky presets and per-phase escalation, star chart, rings (breaks, flood, rime, arrows, glow, tilt), `G.world.reset()` |
| `06_combat.js` | Hazards (`G.hz.*`) and telegraph shader, adds, damage, boss framework, fight flow (start, retry, restart, quit), practice dummy |
| `07_player.js` | Knight model, orbit motion, ghost trail, skills, anchors, constellation, stats, disabled rings |
| `08_ui.js` | Settings (`ph_settings`), screens, HUD binding, touch buttons, fullscreen, results, best times (`ph_best`) |
| `09`-`11` | The three bosses |
| `12_bot.js` | `window.__game` test hooks and the autopilot (levels 1-3); `?testboss=1` adds a throwaway test boss |
| `99_tail.js` | Boot order |

## URL parameters

| Param | Effect |
|-------|--------|
| `?boss=1\|2\|3` | Skip the menu and start that fight |
| `?phase=N` | With `?boss`, start at phase N (1-based) |
| `?practice=1` | Practice dummy |
| `?debug=1` | Enable the destructive `__game` helpers and console logging |
| `?bot=1..3` | Autopilot level; also enables the helpers and skips the intro |
| `?quality=high\|med\|low` | Quality tier (default `auto`) |
| `?safe=0..4` | Graphics safe level: 0 full, 1 no MSAA (the iOS default), 2 adds 8-bit targets, 3 adds no bloom, 4 no post chain |
| `?seed=N` | Deterministic `G.rand` |
| `?mute=1` | No audio |
| `?testboss=1` | With `?debug=1`, a throwaway boss for testing the primitives |

## Testing

The harness is Playwright with SwiftShader. It serves the repo at `http://game.local/` and maps the
three.js CDN to a local copy:

```
export HARNESS=/tmp/claude-0/-home-claude-fun-stuff/4372f285-f1ea-5a29-9e2e-71a4e8d3e316/scratchpad/h/harness.js   # session scratchpad
node -e "
const {launch} = require(process.env.HARNESS);
(async () => {
  const {browser, page, url} = await launch({mobile: false});   // mobile:true = Pixel 7
  await page.goto(url('perihelion') + '?debug=1&seed=3&mute=1');
  await page.waitForFunction(() => window.G && G.booted);
  console.log(await page.evaluate(async () => {
    __game.startFight(1); __game.bot(3);
    let s; for (let i = 0; i < 40; i++) { s = await __game.fastForward(10); if (s.state === 'victory' || s.state === 'dead') break; }
    return JSON.stringify(s);
  }));
  await browser.close();
})();"
```

`window.__game` provides these hooks. The destructive ones only work with `?debug=1` or `?bot`.

- `startFight(i, {fromPhase, skipIntro})`: `i` is 1-3 or `'practice'`.
- `setPhase(n)`: 1-based; runs the real transition.
- `godMode(bool)`, `killBoss()`, `fillMeter()`, `setHp(n)`.
- `fastForward(sec, dt=1/30)`: simulates without rendering and returns `state()`.
- `state()`: compact JSON of the state, time, boss, player and error count.
- `stats()`, `hazards()`, `errors()`, `dangerAt(ring, theta, t)`.
- `bot(level)`: 0 turns the bot off.

Rules of thumb:

- **Simulate, don't render.** SwiftShader renders at about 1-5 fps. Run long simulations with
  `fastForward` at a small viewport (320x180, `quality=low`), and render only for screenshots. A bot
  fight then takes about 10-20 s of wall time.
- **Every run must end with no errors:** `G.log.count === 0` and no page errors.
- **Expected bot results:** bot-3 beats every boss; bot-2 usually beats boss 1, sometimes boss 2
  and less often boss 3; bot-1 usually loses. Bot runs vary a lot between seeds, so use 12 or more seeds
  before trusting a win rate.
- **Screenshots:** take them at 1280x720, Pixel 7 portrait (412x915) and landscape (915x412), then
  open the PNG and look at it. Call `G.post.ae.snap = true` and wait two or three `G.nextFrame()`s
  first, so auto-exposure has settled.
- **Full-page landscape shots can drop HUD elements.** At device scale in headless SwiftShader, a
  full-page phone-landscape screenshot sometimes leaves out the REVERSE button and the HP frame. A
  clipped `scale:'css'` screenshot of the same frame shows them. This is a capture artifact, not a
  game bug.
- **Keep the machine light:** it has 4 CPUs. Run at most 2-3 Chromium instances at once, always
  close the browser, and leave no background processes.
- **Reusable test scripts** live in `/tmp/claude-0/-home-claude-fun-stuff/4372f285-f1ea-5a29-9e2e-71a4e8d3e316/scratchpad/tests/` (`qa/`, `fw/`, `balance/`,
  `vis/`, `boss1/`, `ouros/`, `heliarch/`):
  - `qa/flows.js [mobile]`: full menu and fight flow;
  - `qa/sim.js boss level seed`: one bot fight;
  - `qa/shots.js <desk|phone|land> boss scenes`: screenshots;
  - `qa/mt2.js`: multi-touch;
  - `qa/urls.js`: URL parameters.
