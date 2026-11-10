#!/usr/bin/env bash
# Builds threshold/index.html from the modular sources in this folder, then syntax-checks the module script.
# Every *.js file here is concatenated in filename order, so adding a boss is just adding a 2x_boss_name.js file.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../index.html
{
  cat 00_head.html 00_ui.html
  echo '<script type="module">'
  for f in [0-9][0-9]_*.js; do
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
echo "built $(wc -c < "$OUT") bytes -> threshold/index.html"
