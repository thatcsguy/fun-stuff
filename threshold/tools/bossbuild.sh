#!/usr/bin/env bash
# bossbuild.sh <bossId> <outRoot> : private build holding the shared sources plus ONE boss file, written to
# <outRoot>/threshold/index.html. Lets several people (or agents) iterate on different bosses in one working tree
# without tripping over each other's half-edited files. Use it with TH_ROOT=<outRoot> for any script in tools/.
set -euo pipefail
ID=$1; OUT=$2
cd "$(dirname "$0")/../src"
mkdir -p "$OUT/threshold"
BF=$(ls [0-9][0-9]_boss_"$ID".js)
{
  cat 00_head.html 00_ui.html
  echo '<script type="module">'
  for f in [0-9][0-9]_*.js; do
    case "$f" in *_boss_*) [ "$f" = "$BF" ] || continue;; esac
    printf '\n// ==== %s ====\n' "$f"
    cat "$f"
  done
  echo '</script>'; echo '</body>'; echo '</html>'
} > "$OUT/threshold/index.html"
{
  for f in [0-9][0-9]_*.js; do
    case "$f" in *_boss_*) [ "$f" = "$BF" ] || continue;; esac
    cat "$f"
  done
} > "$OUT/check.mjs"
node --check "$OUT/check.mjs" && echo SYNTAX_OK
