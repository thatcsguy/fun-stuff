#!/usr/bin/env python3
"""Assemble ai-guide/index.html from src/shell.html + src/content/g*.html.

Usage: python3 ai-guide/src/build.py
The shell contains the marker <!--CONTENT--> where the fragments go, and
<!--TOC--> where a generated JSON table of contents goes.
"""
import re, json, pathlib, html

SRC = pathlib.Path(__file__).parent
OUT = SRC.parent / "index.html"

frags = sorted((SRC / "content").glob("g*.html"))
if not frags:
    raise SystemExit("no content fragments")

body = []
toc = []
for f in frags:
    t = f.read_text(encoding="utf-8").strip()
    body.append(t)
    gm = re.search(r'<section class="group" id="(g\d+)" data-num="(\d+)">\s*<header class="ghead">\s*<h2><span class="gn">\d+</span>(.*?)</h2>', t, re.S)
    if not gm:
        raise SystemExit(f"{f.name}: group header not found")
    gid, gnum, gtitle = gm.group(1), gm.group(2), re.sub(r"<.*?>", "", gm.group(3)).strip()
    topics = []
    for tm in re.finditer(r'<article class="topic" id="(t[\d-]+)" data-num="([\d.]+)">\s*<h3><span class="tn">[\d.]+</span>(.*?)</h3>\s*<p class="tl">(.*?)</p>', t, re.S):
        topics.append({
            "id": tm.group(1), "n": tm.group(2),
            "t": html.unescape(re.sub(r"<.*?>", "", tm.group(3)).strip()),
            "l": html.unescape(re.sub(r"<.*?>", "", tm.group(4)).strip()),
        })
    if not topics:
        raise SystemExit(f"{f.name}: no topics found")
    toc.append({"id": gid, "n": gnum, "t": html.unescape(gtitle), "topics": topics})

shell = (SRC / "shell.html").read_text(encoding="utf-8")
out = shell.replace("<!--CONTENT-->", "\n".join(body)).replace("<!--TOC-->", json.dumps(toc, ensure_ascii=False))
OUT.write_text(out, encoding="utf-8")
words = len(re.sub(r"<.*?>", " ", "\n".join(body)).split())
print(f"wrote {OUT} ({OUT.stat().st_size//1024} KB, {len(toc)} groups, {sum(len(g['topics']) for g in toc)} topics, ~{words} words)")
