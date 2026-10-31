// =====================================================================
// 02_input.js: keyboard / mouse / gamepad -> a movement vector and semantic
// actions. Touch controls (joystick + buttons in 08_ui.js) call in through
// G.input.setStick / G.input.fire. Actions are queued and dispatched in
// G.input.update (first in the frame order) so they land inside the
// simulation step, also during fast-forward.
//
//   G.input.move            {x, z} unit-or-less vector, screen-relative (W = -z, D = +x)
//   G.input.held            {bulwark, attack}
//   G.input.on(action, fn)  actions: dash, bulwarkDown, bulwarkUp, rebuke, mend, verdict, attackDown, attackUp, pause, any
//   G.input.fire(action)    programmatic / touch
//   G.input.setStick(x, y)  touch joystick (-1..1, y down = +z); null/0,0 releases
//   G.input.enabled         false during menus; pause/bulwarkUp always pass
//   G.input.device          'keyboard' | 'touch' | 'pad'
// =====================================================================
(() => {
  const handlers = {};
  const queue = [];
  const held = { bulwark: false, attack: false };
  const keys = new Set();
  const CODE = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Space: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
    KeyQ: 'bulwark', Digit2: 'bulwark', Numpad2: 'bulwark',
    KeyE: 'rebuke', Digit3: 'rebuke', Numpad3: 'rebuke',
    KeyF: 'mend', Digit1: 'mend', Numpad1: 'mend',
    KeyR: 'verdict', Digit4: 'verdict', Numpad4: 'verdict',
    Escape: 'pause', KeyP: 'pause',
  };
  const KEY = { w: 'up', s: 'down', a: 'left', d: 'right', ' ': 'dash', shift: 'dash', q: 'bulwark', e: 'rebuke', f: 'mend', r: 'verdict', p: 'pause', escape: 'pause', '1': 'mend', '2': 'bulwark', '3': 'rebuke', '4': 'verdict' };
  const PREVENT = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  const typingTarget = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

  function dispatch(action, data) {
    const list = handlers[action];
    if (list) for (const fn of list.slice()) { try { fn(data, action); } catch (e) { G.log.error('input:' + action, e); } }
    const any = handlers.any;
    if (any && action !== 'any') for (const fn of any.slice()) { try { fn({ action, data }, 'any'); } catch (e) { G.log.error('input:any', e); } }
  }
  function push(action, data, immediate) {
    if (!I.enabled && action !== 'pause' && action !== 'bulwarkUp' && action !== 'attackUp' && action !== 'any') return;
    if (action === 'bulwarkDown') { if (held.bulwark) return; held.bulwark = true; I.bulwarkDownAt = G.now; }
    else if (action === 'bulwarkUp') { if (!held.bulwark) return; held.bulwark = false; }
    else if (action === 'attackDown') { if (held.attack) return; held.attack = true; }
    else if (action === 'attackUp') { if (!held.attack) return; held.attack = false; }
    I.lastAction = action; I.lastAt = G.now; I.count++;
    if (immediate) dispatch(action, data); else queue.push(action, data);
  }
  const keyAction = (e) => CODE[e.code] || KEY[(e.key || '').toLowerCase()] || null;
  const MOVE = { up: 1, down: 1, left: 1, right: 1 };

  function onKeyDown(e) {
    if (typingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = keyAction(e);
    if (PREVENT.has(e.code) || a) e.preventDefault();
    if (!a) { if (!e.repeat) push('any', { key: e.key }, true); return; }
    I.device = 'keyboard';
    if (MOVE[a]) { keys.add(a); return; }
    if (a === 'bulwark') { if (!e.repeat) push('bulwarkDown', { source: 'key' }); return; }
    if (e.repeat) return;
    push(a, { source: 'key' });
  }
  function onKeyUp(e) {
    const a = keyAction(e);
    if (!a) return;
    if (MOVE[a]) { keys.delete(a); return; }
    if (a === 'bulwark') push('bulwarkUp', { source: 'key' });
  }
  function releaseAll(reason) {
    keys.clear(); stick.x = 0; stick.y = 0; stick.on = false;
    if (held.bulwark) push('bulwarkUp', { source: reason || 'blur' });
    if (held.attack) push('attackUp', { source: reason || 'blur' });
  }

  // ---------- mouse: LMB = attack hold (on the canvas only); RMB = bulwark hold
  function onMouseDown(e) {
    if (e.target && e.target.id !== 'c') return;
    if (e.button === 0) { I.device = 'keyboard'; push('attackDown', { source: 'mouse' }); }
    if (e.button === 2) { push('bulwarkDown', { source: 'mouse' }); e.preventDefault(); }
  }
  function onMouseUp(e) {
    if (e.button === 0) push('attackUp', { source: 'mouse' });
    if (e.button === 2) push('bulwarkUp', { source: 'mouse' });
  }

  // ---------- touch stick (set by the UI)
  const stick = { x: 0, y: 0, on: false };

  // ---------- gamepad (standard mapping): left stick move, A dash, X bulwark (hold), B rebuke, Y mend, RB verdict, start pause
  const padPrev = {};
  const PAD = { 0: 'dash', 1: 'rebuke', 3: 'mend', 5: 'verdict', 7: 'verdict', 9: 'pause' };
  const pad = { x: 0, z: 0, on: false };
  function pollPad() {
    if (!navigator.getGamepads) return;
    let pads; try { pads = navigator.getGamepads(); } catch (e) { return; }
    const p = pads && [...pads].find(x => x && x.connected);
    if (!p) { pad.on = false; return; }
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0, dz = 0.22;
    const mag = Math.hypot(ax, ay);
    pad.on = mag > dz;
    if (pad.on) { const s = (mag - dz) / (1 - dz) / mag; pad.x = ax * s; pad.z = ay * s; I.device = 'pad'; } else { pad.x = 0; pad.z = 0; }
    // dpad
    if (p.buttons[12] && p.buttons[12].pressed) { pad.z = -1; pad.on = true; }
    if (p.buttons[13] && p.buttons[13].pressed) { pad.z = 1; pad.on = true; }
    if (p.buttons[14] && p.buttons[14].pressed) { pad.x = -1; pad.on = true; }
    if (p.buttons[15] && p.buttons[15].pressed) { pad.x = 1; pad.on = true; }
    for (const i in PAD) {
      const b = p.buttons[i]; const down = !!(b && (b.pressed || b.value > 0.5));
      if (down && !padPrev[i]) { I.device = 'pad'; push(PAD[i], { source: 'pad' }); }
      padPrev[i] = down;
    }
    const bw = p.buttons[2]; const bwDown = !!(bw && bw.pressed);
    if (bwDown && !padPrev.bw) push('bulwarkDown', { source: 'pad' });
    if (!bwDown && padPrev.bw) push('bulwarkUp', { source: 'pad' });
    padPrev.bw = bwDown;
  }

  const I = G.input = {
    enabled: true, device: G.isTouch ? 'touch' : 'keyboard', lastAction: null, lastAt: 0, count: 0, bulwarkDownAt: 0,
    move: { x: 0, z: 0, mag: 0 },
    held,
    on(action, fn) { (handlers[action] || (handlers[action] = [])).push(fn); return fn; },
    off(action, fn) { const l = handlers[action]; if (!l) return; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    fire(action, data) { push(action, Object.assign({ source: 'ui' }, data || {})); },
    fireNow(action, data) { push(action, Object.assign({ source: 'ui' }, data || {}), true); },
    setStick(x, y) {
      if (x == null) { stick.on = false; stick.x = 0; stick.y = 0; return; }
      stick.x = Math.max(-1, Math.min(1, x)); stick.y = Math.max(-1, Math.min(1, y)); stick.on = Math.hypot(stick.x, stick.y) > 0.08;
      if (stick.on) I.device = 'touch';
    },
    // the bot writes here (overrides keys while set)
    override: null,
    releaseAll,
    init() {
      addEventListener('keydown', onKeyDown);
      addEventListener('keyup', onKeyUp);
      addEventListener('mousedown', onMouseDown);
      addEventListener('mouseup', onMouseUp);
      addEventListener('contextmenu', (e) => { if (e.target && e.target.id === 'c') e.preventDefault(); });
      addEventListener('blur', () => releaseAll('blur'));
      document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll('hidden'); });
      G.on('stateChange', (d) => { if (d.to === 'paused' || d.to === 'menu' || d.to === 'draft' || d.to === 'dead' || d.to === 'victory') releaseAll('state'); });
    },
    update() {
      pollPad();
      // movement vector
      let x = 0, z = 0;
      if (I.override) { x = I.override.x || 0; z = I.override.z || 0; }
      else if (stick.on) { x = stick.x; z = stick.y; }
      else if (pad.on) { x = pad.x; z = pad.z; }
      else {
        if (keys.has('left')) x -= 1; if (keys.has('right')) x += 1;
        if (keys.has('up')) z -= 1; if (keys.has('down')) z += 1;
      }
      let m = Math.hypot(x, z);
      if (m > 1) { x /= m; z /= m; m = 1; }
      if (!I.enabled) { x = 0; z = 0; m = 0; }
      I.move.x = x; I.move.z = z; I.move.mag = m;
      // dispatch queued actions
      if (queue.length) { const q = queue.splice(0); for (let i = 0; i < q.length; i += 2) dispatch(q[i], q[i + 1]); }
    },
  };
})();
