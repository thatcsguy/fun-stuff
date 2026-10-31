#!/bin/sh
# Build kart-raid/index.html from src/ (concatenation in fixed order). Never hand-edit index.html.
# Usage: ./build.sh [out.html]   env STUB="09_boss1.js 10_boss2.js" replaces those files with empty blocks
cd "$(dirname "$0")"
OUT=${1:-index.html}
: > "$OUT"
for f in 00_head.html 01_core.js 02_input.js 03_audio.js 04_fx.js 05_track.js 06_combat.js 07_kart.js 08_ui.js 09_boss1.js 10_boss2.js 11_boss3.js 99_tail.js; do
  case " $STUB " in *" $f "*) echo "/* stub $f */" >> "$OUT"; continue;; esac
  if [ -f "src/$f" ]; then cat "src/$f" >> "$OUT"; echo >> "$OUT"; else echo "/* missing $f */" >> "$OUT"; fi
done
echo "built $OUT ($(wc -c < "$OUT") bytes)"
