# Prismfall sources

`index.html` is built by concatenating these files in name order (`00_head.html`, `01_core.js` … `11_game_loop.js`, `99_tail.html`).
Edit the files here, then run `./build.sh` from `prismfall/` (it also syntax-checks the module script). Never hand-edit `index.html`.

`SPEC.md` is the original design spec. Where it disagrees with the notes below, the notes win.

## Rework (Oct 2026, from playtest feedback)

**Resource model.** Grazing (near-miss charging of R/G/B) is gone. Now:
- Crimson Lance (5 s), Verdant Lattice (16 s) and Azure Mirror (9 s) are plain cooldowns. The ring under the player shows the three cooldowns as red/green/blue arcs.
- **Radiance** (0-100, the bar under the HP bar and the ring on the Nova button) fills from landing hits: Prism Bolt +0.2, Lance +3 per cast that hits, reflected shot +1, Perfect dodge +10, breaking adds. Full = White Nova (1400 dmg, ×2 on a Vulnerable boss).
- A Perfect dodge (dashing through an attack) also instantly recharges the Lance.
- Mirror is still the panic button that you can spend greedily for reflected damage.
- Facets: Spectral Greed became Radiant Soul (+50% Radiance); Afterglow now doubles cooldown speed for 6 s after a Nova.
- Boss 3 Last Light tops Radiance up to 60 and multiplies gains ×4, so the finishing Nova is always reachable.
- Constants live in `PLAYER` in `01_core.js`.

**Boss 1** (13000 HP, hits ×1.3 via `dmgMul`) has a third phase at 32%: **Requiem**. The flames turn blue. Two Cantor lanterns plant on the pond, tether to the heart (heart takes ×0.5 damage and heals while any Cantor lives; they are priority targets for auto-aim). The **Requiem** cast darkens the pond: stand in one of the two cyan lantern lights when it resolves or take 35 (×1.3). A lantern Gaze beam aims at you on the way. A Nova at full Fracture breaks the cast.

**Bosses 2 and 3** are unchanged apart from HP (22000 / 36000) so fights last about as long as before with the new kit.

## Testing

`window.__game` (open with `?debug=1`): `setBoss(n)`, `setPhase(p)`, `godMode()`, `autopilot()`, `fastForward(seconds)` (headless 30 Hz sim, no rendering: bot fights run in a second or two), `dbgExtra()` (damage by source, novas, perfects), `cast(name)`.
