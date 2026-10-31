#!/usr/bin/env bash
# Build prismfall/index.html by concatenating src/ in name order. Never hand-edit index.html; edit src/ and rebuild.
set -euo pipefail
cd "$(dirname "$0")"
cat src/00_head.html src/[0-9][0-9]_*.js src/99_tail.html > index.html
python3 - <<'PY'
s=open('index.html').read()
a=s.index('<script type="module">')+len('<script type="module">'); b=s.rindex('</script>')
open('/tmp/prismfall_check.mjs','w').write(s[a:b])
PY
node --check /tmp/prismfall_check.mjs && echo "built index.html ($(wc -c < index.html) bytes), syntax OK"
