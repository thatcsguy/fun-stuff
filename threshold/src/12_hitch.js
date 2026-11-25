// Freeze log: always on and nearly free. Every frame that arrives late (more than 50 ms after the one before) while a
// fight is on screen is recorded with what the game was doing: how long the simulation and the draw calls took, and
// everything that happened just before it (phase changes, casts, adds, shaders compiled, shaders drawn for the first
// time, textures and geometry uploaded). So a freeze that slips past the warm-up names its own cause.
// Settings > Testing > Freeze log copies it; `__game.Hitch.log` holds it; tools/hitchscan.js plays whole fights and prints it.
// `?hitch=1` (or Hitch.deep = true) also walks the visible scene every frame to catch programs on their first real draw.
const Hitch = (() => {
  const LIM = 50, KEEP = 120, log = [], ev = [];
  const sync = QS.get('hitch') === '2'; // also wait for the graphics card each frame, so its work is timed inside `draw`
  let heap = 0;
  let deep = QS.has('hitch'), prev = null, quiet = 3, progs = 0, tex = 0, geo = 0, seen = new WeakSet(), drawn = new WeakSet(), t0 = performance.now();
  const count = { frames: 0, late: 0, worst: 0 };
  const matsOf = (o) => o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
  let tap = null; // a tool listening to every mark
  function mark(s) { if (tap) tap(s); ev.push([performance.now(), s]); if (ev.length > 80) ev.shift(); }
  function pathOf(o) { const p = []; for (let a = o; a && p.length < 4; a = a.parent) p.push(a.name || a.type); return p.join('<'); }
  function describe(o, m) { const g = o.geometry, c = m.color || (m.uniforms && ((m.uniforms.uC || m.uniforms.uCol || m.uniforms.uColor || {}).value)); return pathOf(o) + ' ' + (g ? g.type.replace('Geometry', '') + (g.attributes.position ? g.attributes.position.count : '') : '') + ' ' + m.type.replace('Material', '') + (m.name ? ':' + m.name : '') + (c && c.isColor ? '#' + c.getHexString() : '') + (o.isInstancedMesh ? ' inst' : '') + (o.isSkinnedMesh ? ' skin' : ''); }
  // Deep mode watches the graphics calls themselves: a program counts as drawn only once a draw call with something in it
  // has run with it bound (shadow passes and post effects included). Built-but-never-drawn programs are what stall on first use.
  const glDrawn = new WeakSet(); let fresh = [], hooked = false;
  function hook() {
    if (hooked) return; hooked = true; const gl = renderer.getContext(); let cur = null;
    const use = gl.useProgram.bind(gl); gl.useProgram = (p) => { cur = p; use(p); };
    const wrap = (name, ci, ii) => { const f = gl[name].bind(gl); gl[name] = function () { if (cur && arguments[ci] > 0 && (ii < 0 || arguments[ii] > 0) && !glDrawn.has(cur)) { glDrawn.add(cur); fresh.push(cur); } return f.apply(null, arguments); }; };
    wrap('drawArrays', 2, -1); wrap('drawElements', 1, -1); wrap('drawArraysInstanced', 2, 3); wrap('drawElementsInstanced', 1, 4);
  }
  function scanDrawn(tag) {
    if (!fresh.length) return; const list = fresh; fresh = []; if (!tag) return;
    const P = renderer.properties, who = new Map();
    scene.traverse((o) => { for (const m of matsOf(o)) { const ps = P.get(m).programs; if (ps) for (const p of ps.values()) if (!who.has(p.program)) who.set(p.program, describe(o, m)); } });
    for (const glp of list) { const p = renderer.info.programs.find((q) => q.program === glp); mark(tag + ' ' + (who.get(glp) || (p ? p.name + ' (no object: shadow or post pass)' : '?'))); }
  }
  function newPrograms() {
    const P = renderer.properties, fresh = renderer.info.programs.filter((p) => !seen.has(p)); if (!fresh.length) return;
    const who = new Map();
    scene.traverse((o) => { for (const m of matsOf(o)) { const p = P.get(m).currentProgram; if (p && !seen.has(p) && !who.has(p)) who.set(p, describe(o, m)); } });
    for (const p of fresh) { seen.add(p); mark('COMPILED ' + (who.get(p) || '?')); }
  }
  // gap: ms between this frame and the one before it; sim, draw: ms this frame spent in the simulation and in the draw calls
  function frame(gap, sim, draw) {
    const now = performance.now(), live = G.state === 'fight' || G.state === 'intro' || G.state === 'dead' || G.state === 'win';
    if (prev && quiet <= 0 && live && !document.hidden && gap > LIM && gap < 20000) {
      const from = now - gap - 400, e = { t: now, at: Math.round(now - t0), boss: Game.def ? Game.def.id : '', nm: !!G.nightmare, st: G.state, clock: new Date().toISOString().slice(11, 23), ft: +G.ft.toFixed(1), ph: G.boss ? G.boss.phase : -1,
        gap: Math.round(gap), sim: Math.round(prev.sim), draw: Math.round(prev.draw), ev: ev.filter((x) => x[0] >= from).map((x) => x[1]) };
      log.push(e); if (log.length > KEEP) log.shift(); count.late++; if (gap > count.worst) count.worst = gap;
      try { localStorage.setItem('th_hitch', JSON.stringify(log.slice(-60))); } catch (err) { }
    }
    if (quiet > 0) quiet--; if (live) count.frames++;
    const I = renderer.info;
    if (I.programs.length !== progs) { newPrograms(); progs = I.programs.length; }
    if (I.memory.textures > tex) mark('textures +' + (I.memory.textures - tex)); tex = I.memory.textures;
    if (I.memory.geometries > geo) mark('geometry +' + (I.memory.geometries - geo)); geo = I.memory.geometries;
    if (deep) scanDrawn('FIRST DRAW');
    if (sim > 12) mark('slow step ' + Math.round(sim) + 'ms');
    const mem = performance.memory; if (mem) { const h = mem.usedJSHeapSize / 1048576; if (heap - h > 6) mark('memory cleanup -' + Math.round(heap - h) + 'MB'); heap = h; }
    prev = { sim, draw };
  }
  // a fight is being built: everything up to and including the warm-up frame is loading, not a freeze
  function reset() {
    quiet = 4; prev = null; ev.length = 0; count.frames = count.late = count.worst = 0; t0 = performance.now();
    seen = new WeakSet(renderer.info.programs); progs = renderer.info.programs.length; tex = renderer.info.memory.textures; geo = renderer.info.memory.geometries;
  }
  addEventListener('visibilitychange', () => { quiet = 4; });
  function text() {
    const L = log.length ? log : (() => { try { return JSON.parse(localStorage.getItem('th_hitch') || '[]'); } catch (e) { return []; } })();
    return 'Threshold freeze log, ' + L.length + ' late frames\n' + L.map((e) => e.boss + (e.nm ? ' NM' : '') + ' ' + e.st + ' phase ' + (e.ph + 1) + ' at ' + e.ft + 's: ' + e.gap + ' ms late (step ' + e.sim + ', draw ' + e.draw + ')' + (e.ev.length ? ' after ' + e.ev.join('; ') : '')).join('\n');
  }
  if (deep) hook();
  // the browser reports every stretch the page itself kept busy for 50 ms or more; (script, cleanup, or waiting on the graphics card)
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { const end = e.startTime + e.duration, txt = 'main thread blocked ' + Math.round(e.duration) + 'ms', last = log[log.length - 1]; ev.push([end, txt]); if (last && end > last.t - last.gap - 100 && e.startTime < last.t + 20 && !last.ev.includes(txt)) last.ev.push(txt); } }).observe({ entryTypes: ['longtask'] }); } catch (e) { }
  return { sync, mark, frame, reset, scanDrawn, text, log, count, get deep() { return deep; }, set deep(v) { deep = !!v; if (deep) hook(); }, set tap(f) { tap = f; } };
})();
