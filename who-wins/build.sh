#!/bin/sh
# Builds who-wins/index.html from src/. Never hand-edit index.html.
cd "$(dirname "$0")"
cat src/00_head.html src/01_kit.js src/02_audio.js src/[1-8]*.js src/90_shell.js > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
