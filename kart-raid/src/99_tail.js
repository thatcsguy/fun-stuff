// =====================================================================
// 99_tail.js — boot. Provides a minimal window.__game stub ONLY when the
// UI module (08_ui.js) is absent; the UI engineer owns the real one. (CORE)
// =====================================================================
{
  let readyResolve;
  const ready = new Promise(r => { readyResolve = r; });
  G.readyPromise = ready;   // UI's window.__game.ready reads this

  // ---- minimal test hook (spec §14 subset) when no UI module exists ----
  if (!G.mods.ui && !window.__game) {
    const K = () => G.kart;
    window.__game = {
      version: 'stub-0.1', ready,
      state() {
        const k = K(), b = G.boss;
        return {
          mode: document.body.dataset.mode || 'fight',
          boss: G.params.boss, phase: b ? b.phase + 1 : 0, bossHP: b ? b.hp : 0, bossMaxHP: b ? b.maxHp : 0,
          stagger: b ? b.stagger : 0, staggered: !!(b && b.staggered), fightTime: b ? b.t : G.time.now,
          kart: { s: +k.s.toFixed(2), d: +k.d.toFixed(2), h: +k.h.toFixed(2), speed: +k.speed.toFixed(2), hp: Math.round(k.hp), maxHp: k.maxHp,
            flux: Math.round(k.flux), credits: k.credits, lap: k.lap, item: k.item, drifting: k.drifting, driftTier: k.driftTier,
            airborne: k.airborne, invuln: k.isInvuln(), boosting: k.boosting, overclock: k.overclockT > 0, comet: k.cometActive, brand: k.brand,
            x: +k.worldPos.x.toFixed(2), y: +k.worldPos.y.toFixed(2), z: +k.worldPos.z.toFixed(2) },
          telegraphs: G.tele?.list?.().length || 0,
          fps: Math.round(G.perf.fps), dpr: G.quality.dpr, quality: G.quality.tier,
          drawCalls: G.perf.drawCalls, sceneCalls: G.perf.sceneCalls, triangles: G.perf.triangles,
          timeScale: G.time.scale, paused: G.time.paused, godMode: !!k.god, errors: G.errors.length, L: G.track.L,
        };
      },
      telegraphs: () => (G.tele?.list?.() || []).map(t => ({ id: t.id, shape: t.shape, kind: t.kind, s: t.s, d: t.d, fill: t.fill, state: t.state })),
      events: (n = 50) => G.eventLog.slice(-n).map(e => ({ t: e.t, name: e.name, data: JSON.parse(JSON.stringify(e.data || {}, (k, v) => (v && v.isObject3D) ? undefined : v)) })),
      bot(on = true) { K().bot = !!on; },
      godMode(on = true) { K().god = !!on; },
      setHP(n) { K().hp = n; }, setFlux(n) { K().flux = Math.max(0, Math.min(100, n)); }, setCredits(n) { K().credits = n; },
      teleportKart(s, d = 0) { K().teleport(s, d); },
      input: {
        set(o) { Object.assign(G.input.inject, o); },
        clear() { G.input.clearInject(); },
        tap(a, ms = 80) { G.input.tap(a, ms); },
      },
      setTimeScale(x) { G.time.scale = x; },
      pause() { G.time.paused = true; }, resume() { G.time.paused = false; },
      step(n = 1) { G.loop.step(n); },
      setQuality(t) { G.quality.set(t); },
      forceStagger(dur = 6) { if (G.boss?.startStagger) G.boss.startStagger(dur, true); else console.warn('no boss'); },
      listAttacks: () => [], triggerAttack: () => false,
      screenshotReady: () => G.nextFrame(),
      goto(state, data) { G.flow?.go?.(state, data); },
    };
  }

  (async () => {
    await G.initAll();
    const bossDef = G.bosses[(G.params.boss || 1) - 1];
    if (G.flow && G.flow.go) {
      G.flow.go(G.params.test ? 'fight' : 'title', { boss: G.params.boss || 1 });
    } else {
      // no flow (UI) module yet: build the arena and drop straight into driving
      G.track.buildArena(bossDef || G.track.defaultArena);
      G.kart.reset(true);
      document.body.dataset.mode = 'fight';
      if (!G.params.test) G.kart.startCountdown(3);
    }
    G.loop.start();
    await G.nextFrame();
    readyResolve();
  })();
}
</script>
</body>
</html>
