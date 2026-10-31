# Shatterclock sources

`raid/index.html` is built from `shell.html` + `NN-*.js` (sorted) by `python3 raid/build.py`. Edit these files and rebuild; never hand-edit index.html.
`SPEC.md` is the original design spec; the notes below override it.

## Rework (Oct 2026, from playtest feedback)
- **Pyrrha's Shockwave Stomp** (boss 1, phase III): each ring has a 60° gap shown as a green floor lane (opens beside you, never on you). A closing circle at your feet ticks and shows DASH when a Phase Step would clear the ring (0.5 s window, counts as a Perfect Dodge). First stomp is 2 slow rings with one gap, then 3 rings, then a gap that shifts 26° per ring. Warning 1.6 s, 180 damage per ring. The training dummy's Tremor uses the same system.
- **Healing**: Recall no longer heals. Shatter (E) heals 2.5% max HP per Fracture spent; a Grand Shatter heals 17.5%. The HP bar previews the next Shatter heal. Recall now grants invulnerability while rewinding and still cleanses Entropy (boss 3).
- **Stasis Lance (F)**: interrupting a violet cast is unchanged (14 s cooldown with Borrowed Time+). With no violet cast it fires a piercing lance: 700 damage to everything in line, +2 Fracture, boss Time-Locked (+20% damage taken) for 5 s, but a 24 s cooldown, so greed costs the next interrupt.
