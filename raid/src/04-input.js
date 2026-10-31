// =============================================================================
//  §6  Input — keyboard + mouse, floating touch joystick, right-thumb ability
//       buttons (pointerdown, press-on-slide-in), 0.2 s input buffer lives in
//       the player (Player.press). Everything routes through Input.press(action).
// =============================================================================
const ACTIONS = ['dash', 'rend', 'shatter', 'recall', 'lance', 'ult'];

/** true if any key code in `list` is held (hoisted: Input.update runs every sim step) */
function anyKeyDown(keys, list) { for (let i = 0; i < list.length; i++) if (keys[list[i]]) return true; return false; }

const Input = {
  keys: Object.create(null),
  move: { x: 0, z: 0, mag: 0 },          // screen-relative stick: x right, z down(south). |v| ≤ 1
  virt: null,                             // __raid.setMove override {x,z}
  joy: { id: -1, ox: 0, oy: 0, x: 0, y: 0, mag: 0 },
  btnPtr: new Map(),                      // pointerId -> button element (slide-in tracking)
  buttons: {},                            // action -> element
  zoomIdx: 1,
  touchSeen: false,
  keyMap: Object.create(null),

  init() {
    for (const a in CONFIG.keys) for (const code of CONFIG.keys[a]) this.keyMap[code] = a;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    View.touch = !!(coarse || navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches);
    document.body.classList.toggle('touch', View.touch);
    // keyboard hints (key caps, "ENTER", "SPACE TO SKIP") follow the LAST input used: hidden after a touch, back on a key press
    this.setLastTouch(View.touch);
    window.addEventListener('pointerdown', (e) => this.setLastTouch(e.pointerType === 'touch' || e.pointerType === 'pen'), { capture: true, passive: true });

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.releaseJoy(); });

    // mouse on the canvas (LMB = Rend, RMB = Shatter, wheel = zoom)
    canvas.addEventListener('pointerdown', (e) => this.onCanvasDown(e));
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (Game.state !== 'fight' && Game.state !== 'transition') return;
      this.zoomIdx = clamp(this.zoomIdx + (e.deltaY > 0 ? 1 : -1), 0, CONFIG.camera.zooms.length - 1);
      CamRig.zoomTarget = CONFIG.camera.zooms[this.zoomIdx];
    }, { passive: false });

    // touch / pointer tracking
    window.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    // ability buttons
    document.querySelectorAll('#abilities .ab').forEach((el) => {
      const a = el.dataset.ab; this.buttons[a] = el;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        Audio.unlock();
        if (e.pointerType !== 'mouse') this.touchSeen = true;
        try { el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        this.btnPtr.set(e.pointerId, el);
        this.fireButton(el, e.pointerType !== 'mouse');
      });
    });
    // key labels from CONFIG
    const label = { dash: 'SPACE', rend: 'Q', shatter: 'E', recall: 'R', lance: 'F', ult: 'T' };
    for (const a in label) { const k = this.buttons[a] && this.buttons[a].querySelector('.key'); if (k) k.textContent = label[a]; }

    // page hardening (§6.2)
    document.addEventListener('touchmove', (e) => { if (!e.target.closest || !e.target.closest('.card')) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('selectstart', (e) => e.preventDefault());
    window.addEventListener('pointerdown', () => Audio.unlock(), { capture: true, passive: true });
  },

  lastTouch: false,
  /** ability name for hint text: 'Stasis Lance (F)' on keyboard, plain 'Stasis Lance' after a touch (no key caps on phones) */
  KEY_NAMES: { dash: ['Phase Step', 'Space'], rend: ['Temporal Rend', 'Q'], shatter: ['Shatter', 'E'], recall: ['Recall', 'R'], lance: ['Stasis Lance', 'F'], ult: ['Zero Hour', 'T'] },
  keyLabel(id) { const n = this.KEY_NAMES[id]; if (!n) return id; return this.lastTouch ? n[0] : n[0] + ' (' + n[1] + ')'; },
  setLastTouch(on) { if (this.lastTouch === on && this._ltInit) return; this._ltInit = true; this.lastTouch = on; document.body.classList.toggle('lasttouch', on); },

  onKey(e, down) {
    const a = this.keyMap[e.code];
    if (down) {
      this.setLastTouch(false);
      Audio.unlock();
      if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) { Quality.cycle(); HUD.showFps(true); HUD.toast('QUALITY: ' + Quality.label); } return; }
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) { this.keys[e.code] = true; return; }
      this.keys[e.code] = true;
      // cinematic skip
      if (Game.cinematic && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) { CamRig.skip(); return; }
      if (a === 'debug') { if (Game.debug) Debug.toggle(); return; }
      if (a === 'pause') { Game.togglePause(); return; }
      if (Game.state === 'defeat' && (e.code === 'Enter' || e.code === 'KeyR')) { Game.retry(); return; }
      if (Game.state === 'victory' && e.code === 'Enter') { Game.victoryContinue(); return; }
      if (ACTIONS.indexOf(a) >= 0) this.press(a);
    } else {
      delete this.keys[e.code];
    }
  },

  onCanvasDown(e) {
    Audio.unlock();
    if (Game.cinematic) { CamRig.skip(); return; }
    if (e.pointerType === 'mouse') {
      if (e.button === 0) this.press('rend');
      else if (e.button === 2) this.press('shatter');
      return;
    }
    // touch / pen → floating joystick in the left 45%
    this.touchSeen = true;
    if (this.joy.id === -1 && e.clientX < View.w * CONFIG.input.joyZone && (Game.state === 'fight' || Game.state === 'transition' || Game.state === 'intro')) {
      e.preventDefault();
      const r = CONFIG.input.joyBase / 2;
      const j = this.joy;
      j.id = e.pointerId;
      j.ox = clamp(e.clientX, r + 6, View.w - r - 6); j.oy = clamp(e.clientY, r + 6, View.h - r - 6);
      j.x = 0; j.y = 0; j.mag = 0;
      const el = $('joy'); el.style.transform = `translate3d(${j.ox}px,${j.oy}px,0)`; el.classList.add('on');
      $('joy-knob').style.transform = 'translate3d(0,0,0)';
      HUD.hideJoyGhost();
      this.onPointerMove(e);
    }
  },

  onPointerMove(e) {
    const j = this.joy;
    if (e.pointerId === j.id) {
      const r = CONFIG.input.joyBase / 2;
      let dx = e.clientX - j.ox, dy = e.clientY - j.oy;
      const len = Math.hypot(dx, dy);
      const d = Math.min(1, len / r);
      const dz = CONFIG.input.deadzone, full = CONFIG.player.fullStick;
      const mag = d < dz ? 0 : clamp((d - dz) / (full - dz), 0, 1);
      if (len > 0.0001) { j.x = dx / len * mag; j.y = dy / len * mag; } else { j.x = 0; j.y = 0; }
      j.mag = mag;
      if (len > r) { dx = dx / len * r; dy = dy / len * r; }
      $('joy-knob').style.transform = `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0)`;
      return;
    }
    // press-on-slide-in: a pointer that started on a button and slides onto another fires it
    const cur = this.btnPtr.get(e.pointerId);
    if (cur !== undefined) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const btn = el && el.closest ? el.closest('.ab') : null;
      if (btn && btn !== cur) {
        if (cur) cur.classList.remove('pressed');
        this.btnPtr.set(e.pointerId, btn);
        this.fireButton(btn, e.pointerType !== 'mouse');
      } else if (!btn && cur) { cur.classList.remove('pressed'); this.btnPtr.set(e.pointerId, null); }
    }
  },

  onPointerUp(e) {
    if (e.pointerId === this.joy.id) this.releaseJoy();
    const b = this.btnPtr.get(e.pointerId);
    if (b) b.classList.remove('pressed');
    this.btnPtr.delete(e.pointerId);
  },

  releaseJoy() {
    const j = this.joy; j.id = -1; j.x = 0; j.y = 0; j.mag = 0;
    $('joy').classList.remove('on');
  },

  fireButton(el, touch) {
    el.classList.add('pressed');
    if (touch) haptic(10);
    this.press(el.dataset.ab);
  },

  /** Single entry point for ability presses (keyboard, mouse, buttons, __raid.press). */
  press(action) {
    if (Game.cinematic) { CamRig.skip(); return; }
    if ((Game.state !== 'fight' && Game.state !== 'transition') || !Game.player) return;
    Game.player.press(action);
  },

  /** Recompute the move vector (called every sim step). */
  update() {
    const m = this.move;
    if (this.virt) { m.x = this.virt.x; m.z = this.virt.z; }
    else if (this.joy.id !== -1) { m.x = this.joy.x; m.z = this.joy.y; }
    else {
      const k = this.keys, km = CONFIG.keys;
      m.x = (anyKeyDown(k, km.right) ? 1 : 0) - (anyKeyDown(k, km.left) ? 1 : 0);
      m.z = (anyKeyDown(k, km.down) ? 1 : 0) - (anyKeyDown(k, km.up) ? 1 : 0);
    }
    let mag = Math.hypot(m.x, m.z);
    if (mag > 1) { m.x /= mag; m.z /= mag; mag = 1; }
    m.mag = mag;
  },
};
