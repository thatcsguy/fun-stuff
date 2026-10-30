# AI Field Guide: sources

`index.html` one level up is generated. Do not hand-edit it.

- `shell.html`: page chrome (top bar, contents drawer, theme and font controls, reading position, copy buttons). Markers `<!--CONTENT-->` and `<!--TOC-->` are filled by the build.
- `content/gNN.html`: one HTML fragment per topic group, in reading order. Format is described in `CONTENT_SPEC.md`.
- `build.py`: assembles `../index.html` and prints a summary. Run `python3 ai-guide/src/build.py` from the repo root.

To change a topic, edit its fragment and rebuild. To add a topic, add an `<article class="topic" id="tG-N" data-num="G.N">` to the group fragment; the drawer, chips and group navigation are generated from the fragments.
