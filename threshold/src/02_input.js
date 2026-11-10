// Input: keyboard + mouse (MMO style) and gamepad. Produces a camera-space move vector, look deltas, slot presses and actions.
const SLOT_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, KeyQ: 3, KeyE: 4, KeyR: 5, KeyF: 6, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6 };
const SLOT_LABEL_KBM = ['1', '2', '3', 'Q', 'E', 'R', 'F'];
const SLOT_LABEL_PAD = ['RT', 'RB', 'Y', 'A', 'B', 'X', 'LB'];
const PAD_SLOT = { 7: 0, 5: 1, 3: 2, 0: 3, 1: 4, 2: 5, 4: 6 };

const Input = {
  device: 'kbm',
  keys: {}, slotHeld: [0, 0, 0, 0, 0, 0, 0],
  mouse: { l: false, r: false, dx: 0, dy: 0, wheel: 0, downX: 0, downY: 0, moved: 0, downAt: 0 },
  moveX: 0, moveZ: 0, lookX: 0, lookY: 0, zoom: 0, steer: false,
  padPrev: [], padNavT: 0,
  onSlot: null, onAction: null, onNav: null,   // set by the game/UI
  bot: null,                                    // when set, {moveX, moveZ} world-space override from the autopilot
  active() { return G.state === 'fight' || G.state === 'intro'; },
  setDevice(d) { if (this.device !== d) { this.device = d; if (typeof UI !== 'undefined') UI.deviceChanged(); } },
  fire(name, arg) { if (this.onAction) this.onAction(name, arg); },
  poll(rdt) {
    const k = this.keys, m = this.mouse;
    let mx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    let mz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    if (m.l && m.r) mz = 1;
    const sens = 0.0026 * Settings.sens / 100;
    let lx = 0, ly = 0;
    if (m.l || m.r) { lx = -m.dx * sens; ly = m.dy * sens * (Settings.inv ? -1 : 1); }
    m.dx = 0; m.dy = 0;
    this.zoom = m.wheel; m.wheel = 0;
    this.steer = m.r;
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null; for (const p of pads) if (p && p.connected && p.buttons.length >= 10) { gp = p; break; }
    if (gp) {
      const dz = (v) => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
      const ax = dz(gp.axes[0] || 0), ay = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      if (ax || ay || rx || ry) this.setDevice('pad');
      if (this.device === 'pad') {
        if (ax || ay) { mx = ax; mz = -ay; }
        const ps = 2.6 * Settings.psens / 100;
        lx += -rx * Math.abs(rx) * ps * rdt; ly += ry * Math.abs(ry) * ps * 0.7 * rdt * (Settings.inv ? -1 : 1);
      }
      const b = gp.buttons.map((x, i) => (i === 6 || i === 7) ? x.value > 0.4 : x.pressed);
      const prev = this.padPrev;
      for (let i = 0; i < b.length; i++) {
        const down = b[i] && !prev[i], up = !b[i] && prev[i];
        if (down) this.setDevice('pad');
        if (i in PAD_SLOT) { if (down) { this.slotHeld[PAD_SLOT[i]] = 1; if (this.active()) { if (this.onSlot) this.onSlot(PAD_SLOT[i]); } else if (i === 0) this.navFire('ok'); else if (i === 1) this.navFire('back'); } if (up) this.slotHeld[PAD_SLOT[i]] = 0; }
        else if (down) {
          if (i === 6) this.fire('jump'); else if (i === 9) this.fire('pause'); else if (i === 11) this.fire('camreset');
          else if (i === 15) this.fire('target-next'); else if (i === 14) this.fire('target-prev');
          if (!this.active()) { if (i === 12) this.navFire('up'); if (i === 13) this.navFire('down'); if (i === 14) this.navFire('left'); if (i === 15) this.navFire('right'); }
        }
      }
      this.padPrev = b;
      if (!this.active()) { // stick navigation in menus
        this.padNavT -= rdt;
        const sx = gp.axes[0] || 0, sy = gp.axes[1] || 0;
        if (this.padNavT <= 0 && (Math.abs(sx) > 0.6 || Math.abs(sy) > 0.6)) { this.navFire(Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : (sy > 0 ? 'down' : 'up')); this.padNavT = 0.22; }
      }
    }
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    this.moveX = mx; this.moveZ = mz; this.lookX = lx; this.lookY = ly;
  },
  navFire(dir) { if (this.onNav) this.onNav(dir); },
  clear() { this.keys = {}; this.slotHeld.fill(0); this.mouse.l = this.mouse.r = false; },
};

addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  Input.setDevice('kbm');
  const fight = Input.active();
  if (fight && (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'KeyF' || e.code === 'Quote' || e.code === 'Slash')) e.preventDefault();
  if (e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  Input.keys[e.code] = true;
  if (e.code === 'Escape') Input.fire('pause');
  else if (e.code === 'Tab') Input.fire(e.shiftKey ? 'target-prev' : 'target-next');
  else if (e.code === 'Space') { if (fight) Input.fire('jump'); }
  else if (e.code in SLOT_KEYS) { const s = SLOT_KEYS[e.code]; Input.slotHeld[s] = 1; if (fight && Input.onSlot) Input.onSlot(s); }
  if (!fight) {
    if (e.code === 'Enter') Input.navFire('ok');
    else if (e.code === 'ArrowUp') Input.navFire('up'); else if (e.code === 'ArrowDown') Input.navFire('down');
    else if (e.code === 'ArrowLeft') Input.navFire('left'); else if (e.code === 'ArrowRight') Input.navFire('right');
  }
});
addEventListener('keyup', (e) => { Input.keys[e.code] = false; if (e.code in SLOT_KEYS) Input.slotHeld[SLOT_KEYS[e.code]] = 0; });
addEventListener('blur', () => Input.clear());
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  Input.setDevice('kbm');
  const m = Input.mouse;
  if (e.button === 0) m.l = true; else if (e.button === 2) m.r = true; else return;
  m.downX = e.clientX; m.downY = e.clientY; m.moved = 0; m.downAt = performance.now();
  if (Input.active() && !G.paused && canvas.requestPointerLock && document.pointerLockElement !== canvas) {
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
Hooks.frame.push((rdt, stage) => { if (stage === 0) Input.poll(rdt); });
