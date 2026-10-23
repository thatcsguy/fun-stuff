#!/usr/bin/env bash
# Builds perihelion/index.html from the modular sources in this folder, then syntax-checks the module script.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../index.html
JS=(01_core.js 02_input.js 03_audio.js 04_fx.js 05_world.js 06_combat.js 07_player.js 08_ui.js
    09_boss1.js 10_boss2.js 11_boss3.js 12_bot.js 99_tail.js)
{
  cat 00_head.html 00_ui.html
  echo '<script type="module">'
  for f in "${JS[@]}"; do
    [ -f "$f" ] || continue
    printf '\n// ==== %s ====\n' "$f"
    cat "$f"
  done
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > "$OUT"
TMP=$(mktemp -d)
python3 - "$OUT" "$TMP/check.mjs" <<'PY'
import sys
s = open(sys.argv[1]).read()
a = s.index('<script type="module">') + len('<script type="module">')
b = s.rindex('</script>')
open(sys.argv[2], 'w').write(s[a:b])
PY
node --check "$TMP/check.mjs" && echo SYNTAX_OK
rm -rf "$TMP"
echo "built $(wc -c < "$OUT") bytes -> perihelion/index.html"
