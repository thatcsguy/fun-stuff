// Input: keyboard + mouse (MMO style) and gamepad, both remappable. Produces a camera-space move vector, look deltas, slot presses and actions.
// Settings.pad is the controller toggle: true = on (the gamepad is read and prompts show its buttons), false = off (gamepads are ignored),
// undefined = never chosen (the first controller button press turns it on). Bindings live in Settings.binds = { kbm: { action: [key, key] },
// pad: { action: button } }; anything missing falls back to BIND_DEFAULTS. Keys are KeyboardEvent.code strings, optionally 'Shift+' prefixed,
// or Mouse1/Mouse3/Mouse4 (middle and side buttons). Pad buttons are W3C standard-mapping indices (Xbox and PlayStation pads in Chrome).
// Fixed, not remappable: mouse camera (hold left/right), wheel zoom, click to target, Esc pause; sticks; Start/Options pause; menu A/B + d-pad.
const BIND_ACTIONS = [
  { id: 'up', name: 'Move forward', kbmOnly: true }, { id: 'down', name: 'Move back', kbmOnly: true },
  { id: 'left', name: 'Move left', kbmOnly: true }, { id: 'right', name: 'Move right', kbmOnly: true },
  { id: 's0', slot: 0 }, { id: 's1', slot: 1 }, { id: 's2', slot: 2 }, { id: 's3', slot: 3 }, { id: 's4', slot: 4 }, { id: 's5', slot: 5 }, { id: 's6', slot: 6 },
  { id: 'jump', name: 'Jump' }, { id: 'tnext', name: 'Next target' }, { id: 'tprev', name: 'Previous target' }, { id: 'camreset', name: 'Reset camera' },
];
const BIND_DEFAULTS = {
  kbm: {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    s0: ['Digit1', null], s1: ['Digit2', null], s2: ['Digit3', null], s3: ['KeyQ', 'Digit4'], s4: ['KeyE', 'Digit5'], s5: ['KeyR', 'Digit6'], s6: ['KeyF', 'Digit7'],
    jump: ['Space', null], tnext: ['Tab', null], tprev: ['Shift+Tab', null], camreset: [null, null],
  },
  pad: { s0: 7, s1: 5, s2: 3, s3: 0, s4: 1, s5: 2, s6: 4, jump: 6, tnext: 15, tprev: 14, camreset: 11 },
};
const PAD_START = 9; // pause, always; also cancels a rebind
const KEY_RESERVED = /^(Escape|F5|F11|F12|Control(Left|Right)|Alt(Left|Right)|Meta(Left|Right)|OS(Left|Right)|ContextMenu|Backspace|Delete)$/;

const Binds = (() => {
  const ACT = {}; for (const a of BIND_ACTIONS) ACT[a.id] = a;
  const acts = (dev) => BIND_ACTIONS.filter((a) => dev === 'kbm' || !a.kbmOnly);
  let keyMap = {}, padMap = {}, layout = null;
  function get(dev, id) {
    const s = Settings.binds && Settings.binds[dev], v = s && s[id] !== undefined ? s[id] : BIND_DEFAULTS[dev][id];
    return dev === 'kbm' ? (Array.isArray(v) ? [v[0] || null, v[1] || null] : [null, null]) : (typeof v === 'number' ? v : null);
  }
  function all(dev) { const o = {}; for (const a of acts(dev)) o[a.id] = get(dev, a.id); return o; }
  function rebuild() {
    keyMap = {}; padMap = {};
    for (const a of acts('kbm')) for (const k of get('kbm', a.id)) if (k) keyMap[k] = a.id;
    for (const a of acts('pad')) { const b = get('pad', a.id); if (b !== null) padMap[b] = a.id; }
  }
  function store(dev, o) { if (!Settings.binds) Settings.binds = {}; Settings.binds[dev] = o; saveSettings(); rebuild(); }
  // Put value v on (id, idx). Whatever action already had v gets this one's old value, so nothing silently ends up unbound.
  // Returns the id of the action that was swapped, if any.
  function assign(dev, id, idx, v) {
    const o = all(dev); let swapped = null;
    if (dev === 'kbm') {
      const old = o[id][idx];
      for (const a in o) for (let j = 0; j < 2; j++) if (o[a][j] === v && v !== null && !(a === id && j === idx)) { o[a][j] = old; swapped = a; }
      o[id][idx] = v;
      for (const a in o) if (!o[a][0] && o[a][1]) { o[a][0] = o[a][1]; o[a][1] = null; } // keep the primary column filled first
    } else {
      const old = o[id];
      for (const a in o) if (o[a] === v && a !== id) { o[a] = old; swapped = a; }
      o[id] = v;
    }
    store(dev, o); return swapped === id ? null : swapped;
  }
  function reset(dev) { if (Settings.binds) delete Settings.binds[dev]; saveSettings(); rebuild(); }
  // Lookups for input events.
  const keyAction = (e) => (e.shiftKey && !/^Shift/.test(e.code) && keyMap['Shift+' + e.code]) || keyMap[e.code] || null;
  const padAction = (b) => padMap[b] || null;
  function held(id, keys) {
    for (const k of get('kbm', id)) {
      if (!k) continue;
      if (k.startsWith('Shift+')) { if (keys[k.slice(6)] && (keys.ShiftLeft || keys.ShiftRight)) return true; }
      else if (keys[k]) return true;
    }
    return false;
  }
  // ---- names ----
  if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then((m) => { layout = m; if (typeof UI !== 'undefined') UI.deviceChanged(); }).catch(() => { });
  const KEYN = {
    Space: 'Space', Tab: 'Tab', Enter: 'Enter', CapsLock: 'Caps', ShiftLeft: 'LShift', ShiftRight: 'RShift', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Insert: 'Ins', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', NumpadEnter: 'NumEnt', NumpadAdd: 'Num+', NumpadSubtract: 'Num-', NumpadMultiply: 'Num*',
    NumpadDivide: 'Num/', NumpadDecimal: 'Num.', Mouse1: 'MMB', Mouse3: 'M4', Mouse4: 'M5',
  };
  const PUNCT = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', IntlBackslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' };
  function keyName(k) {
    if (!k) return '';
    let pre = ''; if (k.startsWith('Shift+')) { pre = '⇧'; k = k.slice(6); }
    if (KEYN[k]) return pre + KEYN[k];
    if (/^(Key[A-Z]|Digit\d)$/.test(k) || PUNCT[k]) { const l = layout && layout.get(k); return pre + (l ? l.toUpperCase() : PUNCT[k] || k.slice(-1)); }
    if (/^Numpad\d$/.test(k)) return pre + 'Num' + k.slice(6);
    return pre + k;
  }
  const PADN = {
    xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', 'D▲', 'D▼', 'D◀', 'D▶'],
    ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', 'D▲', 'D▼', 'D◀', 'D▶'],
  };
  const PADC = { xbox: ['#62c84a', '#e5483b', '#3f8ff0', '#f0c22c'], ps: ['#86a9ff', '#ff6a6a', '#ff8fd2', '#4fe0b4'] };
  function padStyle() { return Settings.glyphs === 'ps' || Settings.glyphs === 'xbox' ? Settings.glyphs : Input.padKind; }
  function padName(b) {
    if (b === null || b === undefined) return '';
    const s = padStyle(); if (s === 'ps' && b === 8 && Input.padDualSense) return 'Create';
    return PADN[s][b] || ('B' + b);
  }
  const padColor = (b) => (b !== null && b < 4) ? PADC[padStyle()][b] : '';
  // The short label shown on the hotbar and class cards for a slot, on the current device.
  function slotLabel(i) {
    const id = 's' + i;
    if (Input.device === 'pad') { const b = get('pad', id); return { t: padName(b), c: padColor(b) }; }
    const k = get('kbm', id); return { t: keyName(k[0] || k[1]), c: '' };
  }
  rebuild();
  return { ACT, acts, get, all, assign, reset, keyAction, padAction, held, keyName, padName, padColor, padStyle, slotLabel, capture: null };
})();

const Input = {
  device: 'kbm', padKind: 'xbox', padDualSense: false, padId: '',
  keys: {}, slotHeld: [0, 0, 0, 0, 0, 0, 0],
  mouse: { l: false, r: false, dx: 0, dy: 0, wheel: 0, downX: 0, downY: 0, moved: 0, downAt: 0 },
  moveX: 0, moveZ: 0, lookX: 0, lookY: 0, zoom: 0, steer: false,
  padPrev: [], padNavT: 0,
  onSlot: null, onAction: null, onNav: null, onCapture: null,   // set by the game/UI
  bot: null,                                    // when set, {moveX, moveZ} world-space override from the autopilot
  active() { return (G.state === 'fight' || G.state === 'intro') && !G.paused; },
  syncDevice() { const d = Settings.pad === true ? 'pad' : 'kbm'; if (this.device !== d) { this.device = d; if (typeof UI !== 'undefined') UI.deviceChanged(); } },
  setPad(on) { Settings.pad = !!on; saveSettings(); this.padPrev = []; this.syncDevice(); },
  fire(name, arg) { if (this.onAction) this.onAction(name, arg); },
  press(id) {
    const a = Binds.ACT[id]; if (!a) return;
    if (a.slot !== undefined) { this.slotHeld[a.slot] = 1; if (this.active() && this.onSlot) this.onSlot(a.slot); }
    else if (id === 'jump') { if (this.active()) this.fire('jump'); }
    else if (id === 'tnext') this.fire('target-next'); else if (id === 'tprev') this.fire('target-prev'); else if (id === 'camreset') this.fire('camreset');
  },
  // ---- rebinding: the settings screen calls beginCapture; the next key / mouse button / pad button becomes the binding ----
  beginCapture(dev, id, idx) { this.capture = { dev, id, idx, t: performance.now(), shift: null }; Binds.capture = this.capture; },
  endCapture(value) {
    const c = this.capture; this.capture = null; Binds.capture = null; if (!c) return;
    let swapped = null; if (value !== undefined) swapped = Binds.assign(c.dev, c.id, c.idx, value);
    if (this.onCapture) this.onCapture(c, value, swapped);
  },
  capture: null,
  pickPad() {
    if (Settings.pad === false || !navigator.getGamepads) return null;
    let gp = null, any = null;
    for (const p of navigator.getGamepads()) if (p && p.connected && p.buttons.length >= 10) { if (!any) any = p; if (!gp && p.mapping === 'standard') gp = p; }
    gp = gp || any;
    if (gp && gp.id !== this.padId) {
      this.padId = gp.id; this.padKind = /054c|playstation|dualshock|dualsense|wireless controller/i.test(gp.id) ? 'ps' : 'xbox';
      this.padDualSense = /0ce6|0df2|dualsense/i.test(gp.id); if (typeof UI !== 'undefined') UI.deviceChanged();
    }
    return gp;
  },
  poll(rdt) {
    const k = this.keys, m = this.mouse;
    if (this.capture && performance.now() - this.capture.t > 8000) this.endCapture();
    let mx = (Binds.held('right', k) ? 1 : 0) - (Binds.held('left', k) ? 1 : 0);
    let mz = (Binds.held('up', k) ? 1 : 0) - (Binds.held('down', k) ? 1 : 0);
    if (m.l && m.r) mz = 1;
    const sens = 0.0026 * Settings.sens / 100;
    let lx = 0, ly = 0;
    if (m.l || m.r) { lx = -m.dx * sens; ly = m.dy * sens * (Settings.inv ? -1 : 1); }
    m.dx = 0; m.dy = 0;
    this.zoom = m.wheel; m.wheel = 0;
    this.steer = m.r;
    // held state of each skill slot, from every source (a second key bound to the same slot cannot cancel the first)
    for (let i = 0; i < 7; i++) this.slotHeld[i] = Binds.held('s' + i, k) ? 1 : 0;
    // gamepad
    const gp = this.pickPad();
    if (gp) {
      const b = gp.buttons.map((x, i) => (i === 6 || i === 7) ? x.value > 0.4 : x.pressed);
      const prev = this.padPrev, edge = (i) => b[i] && !prev[i];
      if (Settings.pad === undefined) { // never chosen: the first button press switches the controller on
        if (b.some((x, i) => edge(i))) { this.padPrev = b; this.setPad(true); if (typeof UI !== 'undefined') UI.padWoke(); }
        else this.padPrev = b;
      } else if (this.capture) {
        for (let i = 0; i < b.length; i++) if (edge(i)) {
          if (i === PAD_START) { this.endCapture(); break; }
          if (this.capture.dev === 'pad' && i < 16) { this.endCapture(i); break; }
        }
        this.padPrev = b;
      } else {
        const dz = (v) => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
        const ax = dz(gp.axes[0] || 0), ay = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
        if (ax || ay) { mx = ax; mz = -ay; }
        const ps = 2.6 * Settings.psens / 100;
        lx += -rx * Math.abs(rx) * ps * rdt; ly += ry * Math.abs(ry) * ps * 0.7 * rdt * (Settings.inv ? -1 : 1);
        const fight = this.active();
        for (let i = 0; i < b.length; i++) {
          const act = this.padAction(i);
          if (act && b[i] && Binds.ACT[act].slot !== undefined) this.slotHeld[Binds.ACT[act].slot] = 1;
          if (!edge(i)) continue;
          if (i === PAD_START) { this.fire('pause'); continue; }
          if (fight) { if (act) this.press(act); }
          else if (i === 0) this.navFire('ok'); else if (i === 1) this.navFire('back');
          else if (i === 12) this.navFire('up'); else if (i === 13) this.navFire('down'); else if (i === 14) this.navFire('left'); else if (i === 15) this.navFire('right');
        }
        this.padPrev = b;
        if (!fight) { // stick navigation in menus
          this.padNavT -= rdt;
          const sx = gp.axes[0] || 0, sy = gp.axes[1] || 0;
          if (this.padNavT <= 0 && (Math.abs(sx) > 0.6 || Math.abs(sy) > 0.6)) { this.navFire(Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : (sy > 0 ? 'down' : 'up')); this.padNavT = 0.22; }
          else if (Math.abs(sx) < 0.3 && Math.abs(sy) < 0.3) this.padNavT = 0;
        }
      }
    }
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    this.moveX = mx; this.moveZ = mz; this.lookX = lx; this.lookY = ly;
  },
  padAction(i) { return Binds.padAction(i); },
  navFire(dir) { if (this.onNav) this.onNav(dir); },
  clear() { this.keys = {}; this.slotHeld.fill(0); this.mouse.l = this.mouse.r = false; },
};
Input.syncDevice();

// ---- keyboard ----
function captureKey(e) {
  const c = Input.capture;
  if (e.code === 'Escape') return Input.endCapture();
  if (e.code === 'Backspace' || e.code === 'Delete') return c.dev === 'kbm' ? Input.endCapture(null) : undefined;
  if (c.dev !== 'kbm' || e.repeat || KEY_RESERVED.test(e.code) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^Shift(Left|Right)$/.test(e.code)) { c.shift = e.code; return; } // a lone Shift binds on release; Shift + key binds the combo
  Input.endCapture((e.shiftKey ? 'Shift+' : '') + e.code);
}
addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.target.blur(); if (e.code.startsWith('Arrow')) e.preventDefault(); } // menus are driven by the nav focus, never by browser focus
  if (Input.capture) { e.preventDefault(); e.stopPropagation(); captureKey(e); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const fight = Input.active(), act = Binds.keyAction(e);
  if (fight && (act || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Quote' || e.code === 'Slash')) e.preventDefault();
  if (e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  Input.keys[e.code] = true;
  if (e.code === 'Escape') { Input.fire('pause'); return; }
  if (act) Input.press(act);
  if (!fight) {
    if (e.code === 'Enter') Input.navFire('ok');
    else if (e.code === 'ArrowUp') Input.navFire('up'); else if (e.code === 'ArrowDown') Input.navFire('down');
    else if (e.code === 'ArrowLeft') Input.navFire('left'); else if (e.code === 'ArrowRight') Input.navFire('right');
  }
}, true);
addEventListener('keyup', (e) => {
  Input.keys[e.code] = false;
  const c = Input.capture; if (c && c.shift === e.code) { e.preventDefault(); Input.endCapture(e.code); }
}, true);
addEventListener('blur', () => Input.clear());

// ---- mouse ----
// Left and right buttons drive the camera and are fixed; middle and the two side buttons (Mouse1, Mouse3, Mouse4) can be bound.
const BINDABLE_MOUSE = (b) => b === 1 || b === 3 || b === 4;
let swallowClick = false;
addEventListener('mousedown', (e) => {
  if (Input.capture) {
    e.preventDefault(); e.stopPropagation();
    if (Input.capture.dev === 'kbm' && BINDABLE_MOUSE(e.button)) Input.endCapture('Mouse' + e.button);
    else { swallowClick = e.button === 0; Input.endCapture(); }
    return;
  }
  if (!BINDABLE_MOUSE(e.button)) return;
  const code = 'Mouse' + e.button, act = Binds.keyAction({ code, shiftKey: e.shiftKey });
  if (act || Input.active()) e.preventDefault();
  Input.keys[code] = true; if (act) Input.press(act);
}, true);
addEventListener('click', (e) => { if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); } }, true);
addEventListener('mouseup', (e) => {
  if (!BINDABLE_MOUSE(e.button)) return;
  Input.keys['Mouse' + e.button] = false;
  if (Input.active() || Binds.keyAction({ code: 'Mouse' + e.button, shiftKey: false })) e.preventDefault(); // stop side buttons from going back/forward in history
}, true);
addEventListener('auxclick', (e) => { if (Input.active()) e.preventDefault(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  const m = Input.mouse;
  if (e.button === 0) m.l = true; else if (e.button === 2) m.r = true; else return;
  m.downX = e.clientX; m.downY = e.clientY; m.moved = 0; m.downAt = performance.now();
  if (Input.active() && canvas.requestPointerLock && document.pointerLockElement !== canvas) {
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (err) { /* lock is optional */ }
  }
  e.preventDefault();
});
addEventListener('mouseup', (e) => {
  const m = Input.mouse;
  if (e.button === 0) { if (m.l && m.moved < 6 && performance.now() - m.downAt < 350) Input.fire('click', { x: m.downX, y: m.downY }); m.l = false; }
  else if (e.button === 2) m.r = false;
  if (!m.l && !m.r && document.pointerLockElement === canvas) document.exitPointerLock();
});
addEventListener('mousemove', (e) => {
  const m = Input.mouse;
  if (m.l || m.r) { m.dx += e.movementX || 0; m.dy += e.movementY || 0; m.moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); }
});
canvas.addEventListener('wheel', (e) => { Input.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
addEventListener('gamepadconnected', () => { Input.padId = ''; });
addEventListener('gamepaddisconnected', () => { Input.padId = ''; if (typeof UI !== 'undefined') UI.deviceChanged(); });
Hooks.frame.push((rdt, stage) => { if (stage === 0) Input.poll(rdt); });
