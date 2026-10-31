// =====================================================================
// 99_tail.js: boot sequence (spec 8.2). Each module's init is optional and
// isolated: a failing init is logged into G.log and boot continues.
// =====================================================================
(() => {
  const ORDER = ['core', 'input', 'audio', 'fx', 'world', 'combat', 'player', 'run', 'ui', 'bot'];
  const boot = () => {
    for (const name of ORDER) {
      const m = G[name];
      if (!m || typeof m.init !== 'function') { if (name !== 'bot') G.log.info('boot: no ' + name + '.init'); continue; }
      try { m.init(); } catch (e) { G.log.error(name + '.init', e); if (name === 'core') { showErr(e); return; } }
    }
    // fallbacks while modules are missing (the UI normally drives menu / fight start)
    if (!G.ui) {
      try {
        G.world?.setSky?.('menu', 0, 0);
        G.audio?.music?.('menu');
        const b = G.params.boss;
        if (G.combat?.startFight && (b || G.params.practice)) G.combat.startFight(G.params.practice ? 'practice' : (b - 1), { practice: !!G.params.practice });
      } catch (e) { G.log.error('boot.fallback', e); }
    }
    try { G.core.start(); } catch (e) { G.log.error('core.start', e); showErr(e); }
    G.booted = true;
    G.emit('booted', {});
  };
  const showErr = (e) => {
    const el = document.getElementById('boot-err');
    if (el) { el.style.display = 'block'; el.textContent = 'Failed to start: ' + (e && e.message || e); }
  };
  window.addEventListener('error', (e) => { if (G.booted) G.log.error('window', e.error || e.message); });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    if (r && (r.name === 'Abort' || r.isAbort || r === G.combat?.Abort || (typeof G.combat?.Abort === 'function' && r instanceof G.combat.Abort))) { e.preventDefault(); return; }
    G.log.error('promise', r);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
