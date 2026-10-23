// =====================================================================
// 02_input.js: keyboard (+ gamepad) -> semantic actions (spec section 3).
// Touch buttons live in the UI module and call G.input.fire / cometDown / cometUp.
// Actions are queued and dispatched in G.input.update (first in the frame order),
// so they land inside the simulation step, also during fast-forward.
// =====================================================================
(() => {
  const ACTIONS = ['reverse', 'shiftIn', 'shiftOut', 'anchor', 'cometDown', 'cometUp', 'eclipse', 'aegis', 'nova', 'pause'];
  const handlers = {};
  const queue = [];
  const held = { comet: false };
  const cometKeys = new Set();
  // e.code -> action (layout-independent); e.key fallback below
  const CODE = {
    KeyA: 'reverse', KeyD: 'reverse', ArrowLeft: 'reverse', ArrowRight: 'reverse',
    KeyW: 'shiftIn', ArrowUp: 'shiftIn', KeyS: 'shiftOut', ArrowDown: 'shiftOut',
    KeyQ: 'anchor', Digit1: 'anchor', Numpad1: 'anchor',
    Space: 'comet', Digit2: 'comet', Numpad2: 'comet',
    KeyE: 'eclipse', Digit3: 'eclipse', Numpad3: 'eclipse',
    KeyF: 'aegis', Digit4: 'aegis', Numpad4: 'aegis',
    KeyR: 'nova', Digit5: 'nova', Numpad5: 'nova',
    Escape: 'pause', KeyP: 'pause',
  };
  const KEY = { a: 'reverse', d: 'reverse', w: 'shiftIn', s: 'shiftOut', q: 'anchor', '1': 'anchor', ' ': 'comet', '2': 'comet', e: 'eclipse', '3': 'eclipse', f: 'aegis', '4': 'aegis', r: 'nova', '5': 'nova', p: 'pause', escape: 'pause' };
  const PREVENT = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

  const typingTarget = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

  function dispatch(action, data) {
    const list = handlers[action];
    if (list) for (const fn of list.slice()) { try { fn(data, action); } catch (e) { G.log.error('input:' + action, e); } }
    const any = handlers.any;
    if (any && action !== 'any') for (const fn of any.slice()) { try { fn({ action, data }, 'any'); } catch (e) { G.log.error('input:any', e); } }
  }

  function push(action, data, immediate) {
    if (!I.enabled && action !== 'pause' && action !== 'cometUp') return;
    // comet hold bookkeeping is immediate so G.input.held.comet is always current
    if (action === 'cometDown') { if (held.comet) return; held.comet = true; I.cometDownAt = G.now; }
    else if (action === 'cometUp') { if (!held.comet) return; held.comet = false; }
    I.lastAction = action; I.lastAt = G.now; I.count++;
    if (immediate) dispatch(action, data); else queue.push(action, data);
  }

  function keyAction(e) { return CODE[e.code] || KEY[(e.key || '').toLowerCase()] || null; }

  function onKeyDown(e) {
    if (typingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = keyAction(e);
    if (PREVENT.has(e.code) || a) e.preventDefault();
    if (!a) { if (!e.repeat) push('any', { key: e.key }); return; }
    if (a === 'comet') {
      cometKeys.add(e.code || e.key);
      if (!e.repeat) push('cometDown', { source: 'key' });
      return;
    }
    if (e.repeat) return;   // key repeat suppression
    I.device = 'keyboard';
    push(a, { source: 'key' });
  }
  function onKeyUp(e) {
    const a = keyAction(e);
    if (a === 'comet') {
      cometKeys.delete(e.code || e.key);
      if (cometKeys.size === 0) push('cometUp', { source: 'key' });
    }
  }
  function releaseAll(reason) {
    cometKeys.clear();
    if (held.comet) push('cometUp', { source: reason || 'blur' }, false);
  }

  // ---------- gamepad (bonus; standard mapping) ----------
  const padPrev = {};
  const PAD = { 14: 'reverse', 15: 'reverse', 12: 'shiftIn', 13: 'shiftOut', 2: 'anchor', 0: 'comet', 1: 'eclipse', 3: 'aegis', 5: 'nova', 4: 'reverse', 9: 'pause' };
  let padAxisPrev = 0, padAxisXPrev = 0;
  function pollPad() {
    if (!navigator.getGamepads) return;
    let pads; try { pads = navigator.getGamepads(); } catch (e) { return; }
    const p = pads && [...pads].find(x => x && x.connected);
    if (!p) return;
    for (const k in PAD) {
      const b = p.buttons[k]; const on = !!(b && (b.pressed || b.value > 0.5));
      const was = !!padPrev[k]; padPrev[k] = on;
      if (on === was) continue;
      const a = PAD[k];
      I.device = 'pad';
      if (a === 'comet') push(on ? 'cometDown' : 'cometUp', { source: 'pad' });
      else if (on) push(a, { source: 'pad' });
    }
    const ay = p.axes[1] || 0, ax = p.axes[0] || 0;
    const sy = ay < -0.6 ? -1 : ay > 0.6 ? 1 : 0, sx = Math.abs(ax) > 0.7 ? 1 : 0;
    if (sy !== padAxisPrev && sy !== 0) push(sy < 0 ? 'shiftIn' : 'shiftOut', { source: 'pad' });
    if (sx !== padAxisXPrev && sx !== 0) push('reverse', { source: 'pad' });
    padAxisPrev = sy; padAxisXPrev = sx;
  }

  const I = G.input = {
    ACTIONS, held, enabled: true, device: G.isTouch ? 'touch' : 'keyboard', lastAction: null, lastAt: 0, count: 0, cometDownAt: 0,
    on(action, fn) { (handlers[action] || (handlers[action] = [])).push(fn); return fn; },
    off(action, fn) { const l = handlers[action]; if (!l) return; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    // fire(action[, data]): queued, dispatched at the start of the next update. fire(a, d, true) dispatches now.
    fire(action, data, immediate) { if (action === 'comet') action = 'cometDown'; push(action, data || { source: 'fire' }, !!immediate); },
    cometDown(data) { push('cometDown', data || { source: 'button' }); },
    cometUp(data) { push('cometUp', data || { source: 'button' }); },
    releaseAll,
    clear() { queue.length = 0; },
    pending() { const out = []; for (let i = 0; i < queue.length; i += 2) out.push(queue[i]); return out; },
    init() {
      addEventListener('keydown', onKeyDown, { passive: false });
      addEventListener('keyup', onKeyUp);
      addEventListener('blur', () => releaseAll('blur'));
      document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll('hidden'); });
      // any pointer press anywhere counts as "any input" (intro skip etc.) and marks the device
      addEventListener('pointerdown', (e) => { I.device = e.pointerType === 'touch' ? 'touch' : 'mouse'; push('any', { pointer: e.pointerType }); }, { passive: true });
    },
    update() {
      pollPad();
      if (!queue.length) return;
      const items = queue.splice(0);
      for (let i = 0; i < items.length; i += 2) dispatch(items[i], items[i + 1]);
    },
  };
})();
