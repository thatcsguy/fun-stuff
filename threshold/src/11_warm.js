// Warm-up: make a fight's first phase transition as smooth as its first second.
// Three things used to compile shaders mid-fight, which on a real GPU means a multi-second freeze:
//  1. Objects that start hidden (pooled effects, later-phase props, adds) were never drawn before they first appeared,
//     so their shaders, shadow-depth shaders and textures were built on that frame.
//  2. Camera-occluder fading flips materials to transparent, a different shader variant.
//  3. three.js bakes the NUMBER of each kind of light into every lit shader. A phase that showed or hid a light changed
//     that number and recompiled every lit material in the arena at once.
// Warm.run() (called at the end of Game.build, under the black loading fade) draws one frame with everything visible
// and unculled, so every shader and texture is ready. The light keeper then pads the scene with zero-intensity dummy
// lights each frame so the per-kind light counts never change during the fight, whatever the boss shows or hides.
const Warm = (() => {
  const FAR = -5000, SPARE_POINT = 6; let need = {}; const dummies = {};
  const kindOf = (L) => L.type + (L.castShadow ? '+s' : '') + (L.map ? '+m' : '');
  function count(all) {
    const c = {};
    const f = (o) => { if (o.isLight && !o.isAmbientLight && !o.userData.warmDummy) { const k = kindOf(o); c[k] = (c[k] || 0) + 1; } };
    if (all) scene.traverse(f); else scene.traverseVisible(f);
    return c;
  }
  function makeDummy(k) {
    const [type, ...flags] = k.split('+'), shadow = flags.includes('s');
    let L;
    if (type === 'PointLight') L = new THREE.PointLight(0x000000, 0, 0.001);
    else if (type === 'SpotLight') L = new THREE.SpotLight(0x000000, 0, 0.001, 0.01);
    else if (type === 'DirectionalLight') L = new THREE.DirectionalLight(0x000000, 0);
    else if (type === 'HemisphereLight') L = new THREE.HemisphereLight(0x000000, 0x000000, 0);
    else if (type === 'RectAreaLight') L = new THREE.RectAreaLight(0x000000, 0, 0.001, 0.001);
    else return null;
    L.userData.warmDummy = true; L.position.set(0, FAR, 0);
    if (L.target) { L.target.position.set(0, FAR - 1, 0); scene.add(L.target); }
    if (shadow && L.shadow) {
      // a shadow map is required to keep the shadow count stable, but its camera sees nothing, so it costs almost nothing
      L.castShadow = true; L.shadow.mapSize.set(16, 16); const c = L.shadow.camera;
      if (c.isOrthographicCamera) { c.left = c.bottom = -0.01; c.right = c.top = 0.01; }
      c.near = 0.001; c.far = 0.002; c.updateProjectionMatrix();
    }
    if (flags.includes('m') && type === 'SpotLight') L.map = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    scene.add(L); return L;
  }
  // Show exactly enough dummies of each kind that the visible count of every kind equals the fight's maximum.
  function keep() {
    const c = count(false);
    for (const k in c) if (c[k] > (need[k] || 0)) need[k] = c[k]; // a light nobody saw at build time: one recompile, then stable
    for (const k in dummies) if (!(k in need)) need[k] = 0;
    for (const k in need) {
      const want = need[k] - (c[k] || 0), arr = dummies[k] || (dummies[k] = []);
      while (arr.length < want) { const d = makeDummy(k); if (!d) break; arr.push(d); }
      for (let i = 0; i < arr.length; i++) arr[i].visible = i < want;
    }
  }
  let retained = [];
  const matsOf = (o) => o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
  function freeMaterial(m) {
    delete m.userData.warmKeep; if (m.userData.shared) return;
    for (const k in m) { const v = m[k]; if (v && v.isTexture && !v.userData.shared) v.dispose(); }
    if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k].value; if (v && v.isTexture && !v.userData.shared) v.dispose(); }
    m.dispose();
  }
  // rh: what Game.rehearse found ({found: Map(material -> object it was on), kept: removed roots}), or null.
  function run(rh) {
    const t0 = performance.now();
    need = count(true); // every light in the arena, shown or not, is the target count for the whole fight
    // adds (choristers, drones, geodes) bring their own small point lights mid-fight: keep headroom for them
    need.PointLight = (need.PointLight || 0) + SPARE_POINT;
    Hz.warm(); // one telegraph decal, so the first telegraph does not compile its shader
    // stand-ins for everything the rehearsal created: same object type, geometry and material, drawn once beside the arena
    const holder = new THREE.Group(); holder.name = 'warm';
    if (rh) for (const [m, o] of rh.found) { let c; try { c = o.clone(false); } catch (e) { continue; } c.position.set(0, 0, 0); holder.add(c); }
    scene.add(holder);
    const shown = [], unculled = [];
    scene.traverse((o) => {
      if (!o.visible) { o.visible = true; shown.push(o); }
      if (o.frustumCulled && (o.isMesh || o.isPoints || o.isLine || o.isSprite)) { o.frustumCulled = false; unculled.push(o); }
    });
    keep();
    // three.js only compiles and uploads when it draws, so draw a real frame (scene, shadows, bloom, grade) under the loading fade
    const was = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = true; renderer.shadowMap.needsUpdate = true;
    try {
      Post.composer.render();
      // camera-occluder fading (Cam.fadeOccluders) switches those materials to transparent, which is another shader
      // variant: draw a second frame with them see-through so that variant is ready too (three keeps both per material)
      const fm = new Set(); scene.traverse((o) => { if (o.isMesh && o.userData.fadeOcclude) for (const m of matsOf(o)) if (!m.transparent) fm.add(m); });
      if (fm.size) {
        const dw = new Map(); for (const m of fm) { dw.set(m, m.depthWrite); m.transparent = true; m.depthWrite = false; m.needsUpdate = true; }
        try { Post.composer.render(); } finally { for (const m of fm) { m.transparent = false; m.depthWrite = dw.get(m); m.needsUpdate = true; } }
      }
    } catch (e) { reportError(e); }
    finally {
      renderer.shadowMap.autoUpdate = was;
      for (const o of shown) o.visible = false; for (const o of unculled) o.frustumCulled = true;
      scene.remove(holder);
      // the rehearsal's materials hold the compiled shaders until the next fight is warmed; everything else it made goes now
      const old = retained; retained = [];
      if (rh) {
        for (const m of rh.found.keys()) if (!m.userData.shared) { m.userData.warmKeep = true; retained.push(m); }
        for (const r of rh.kept) disposeTree(r);
      }
      for (const m of old) freeMaterial(m);
      keep();
    }
    if (G.warmStats) G.warmStats.warmMs = Math.round(performance.now() - t0);
  }
  Hooks.frame.push((rdt, stage) => { if (stage === 1 && !G.headless) keep(); });
  return { run, keep, get need() { return need; } };
})();
