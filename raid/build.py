#!/usr/bin/env python3
"""Build raid/index.html by concatenating src/shell.html + src/NN-*.js (sorted).
shell.html must contain the line  //@@MODULES@@  inside its <script type="module">.
Usage: python3 raid/build.py [--out path]. Never hand-edit index.html; edit src/ and rebuild."""
import glob, os, sys
here = os.path.dirname(os.path.abspath(__file__))
shell = open(os.path.join(here, 'src', 'shell.html')).read()
parts = []
for f in sorted(glob.glob(os.path.join(here, 'src', '[0-9][0-9]-*.js'))):
    parts.append(f'// ===== {os.path.basename(f)} =====\n' + open(f).read().rstrip() + '\n')
assert '//@@MODULES@@' in shell, 'shell.html missing //@@MODULES@@ marker'
out = shell.replace('//@@MODULES@@', '\n'.join(parts))
dst = sys.argv[sys.argv.index('--out')+1] if '--out' in sys.argv else os.path.join(here, 'index.html')
open(dst, 'w').write(out)
print(f'built {dst}: {out.count(chr(10))} lines, {len(out)//1024} KB from {len(parts)} modules')
