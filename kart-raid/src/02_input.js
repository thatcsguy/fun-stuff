// =====================================================================
// 02_input.js — unified actions from keyboard, touch, gamepad, injection (INPUT)
// Actions: steer (-1..1), throttle (0..1), brake, drift, dash, ability, item, pause
// Edge-triggered G.input.pressed[a] / released[a] are valid for one fixed step.
// =====================================================================
{
  const BTN = ['drift', 'dash', 'ability', 'item', 'pause', 'brake'];
  const inp = G.input = {
    steer: 0, steerRaw: 0, throttle: 1, brake: false, drift: false, dash: false, ability: false, item: false, pause: false,
    pressed: {}, released: {},
    inject: { steer: null, throttle: null, brake: null, drift: null, dash: null, ability: null, item: null },
    autoThrottle: true,
    driftAssist: G.isTouch,           // settings may toggle
    device: G.isTouch ? 'touch' : 'keyboard',
    stickActive: false,
    // tap(action, ms): hold an action for ms of (fixed-step) time. Used by __game.input.tap and the bot.
    tap(action, ms = 80) { taps.push({ a: action, t: ms / 1000 }); },
    clearInject() { for (const k in inp.inject) inp.inject[k] = null; taps.length = 0; },
    vibrate(p) { try { if (G.input.device === 'touch' && navigator.vibrate) navigator.vibrate(p); } catch (e) { } },
  };
  for (const b of BTN) { inp.pressed[b] = false; inp.released[b] = false; }
  const taps = [];
  const prev = { drift: false, dash: false, ability: false, item: false, pause: false, brake: false };

  // ------------------------------------------------------------------
  // Keyboard
  // ------------------------------------------------------------------
  const keys = new Set(), latch = new Set();
  const KEYMAP = {
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    KeyW: 'throttle', ArrowUp: 'throttle', KeyS: 'brake', ArrowDown: 'brake',
    Space: 'drift', ShiftLeft: 'drift', ShiftRight: 'drift',
    KeyJ: 'dash', KeyK: 'dash', KeyL: 'ability', KeyQ: 'ability', KeyE: 'item', KeyI: 'item',
    Escape: 'pause', KeyP: 'pause',
  };
  let keySteer = 0, unlocked = false;
  const unlock = () => { if (unlocked) return; unlocked = true; try { G.audio?.unlock?.(); } catch (e) { } };
  addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code]; unlock();
    if (!a) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!keys.has(a)) latch.add(a);
    keys.add(a); inp.device = 'keyboard';
  });
  addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) keys.delete(a); });

  // ------------------------------------------------------------------
  // Touch: floating stick (left 45%) + 4 buttons (right). DOM built if absent.
  // ------------------------------------------------------------------
  const touch = { stickId: -1, ox: 0, oy: 0, x: 0, y: 0, brakeT: 0, held: { drift: false, dash: false, ability: false, item: false } };
  // stick radius: a shorter throw on small landscape phones
  let STICK_R = 60;
  const stickR = () => (innerHeight < 420 ? 52 : 60);
  let els = null;
  function buildTouchDOM() {
    let root = document.getElementById('touch');
    if (!root) {
      root = document.createElement('div'); root.id = 'touch';
      root.innerHTML = `<div id="stick-zone"></div><div id="stick"><div id="stick-knob"></div></div>
        <button class="tbtn" id="btn-drift"><span class="ring"></span>DRIFT</button>
        <button class="tbtn" id="btn-dash"><span class="ring"></span><span class="pip"></span>DASH<span class="cost">25</span></button>
        <button class="tbtn" id="btn-ability"><span class="fring"></span><span class="ring"></span><span class="lbl">OVER<br>CLOCK</span><span class="cost">50</span></button>
        <button class="tbtn" id="btn-item"><span class="lbl">ITEM</span></button>`;
      document.body.appendChild(root);
    }
    els = {
      root, zone: document.getElementById('stick-zone'), stick: document.getElementById('stick'), knob: document.getElementById('stick-knob'),
      drift: document.getElementById('btn-drift'), dash: document.getElementById('btn-dash'),
      ability: document.getElementById('btn-ability'), item: document.getElementById('btn-item'),
    };
    if (G.isTouch) document.body.classList.add('touch');

    const zone = els.zone || root;
    zone.addEventListener('pointerdown', (e) => {
      unlock(); inp.device = 'touch'; document.body.classList.add('touch');
      if (touch.stickId !== -1) return;
      touch.stickId = e.pointerId; touch.ox = e.clientX; touch.oy = e.clientY; touch.x = 0; touch.y = 0; touch.brakeT = 0; STICK_R = stickR();
      try { zone.setPointerCapture(e.pointerId); } catch (err) { }
      if (els.stick) { els.stick.style.left = e.clientX + 'px'; els.stick.style.top = e.clientY + 'px'; els.stick.classList.add('on'); }
      inp.stickActive = true; e.preventDefault();
    });
    const move = (e) => {
      if (e.pointerId !== touch.stickId) return;
      let dx = (e.clientX - touch.ox) / STICK_R, dy = (e.clientY - touch.oy) / STICK_R;
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      touch.x = dx; touch.y = dy;
      if (els.knob) els.knob.style.transform = `translate(${dx * STICK_R}px,${dy * STICK_R}px)`;
    };
    const end = (e) => {
      if (e.pointerId !== touch.stickId) return;
      touch.stickId = -1; touch.x = 0; touch.y = 0; inp.stickActive = false;
      if (els.stick) els.stick.classList.remove('on');
      if (els.knob) els.knob.style.transform = '';
    };
    zone.addEventListener('pointermove', move); zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);

    for (const a of ['drift', 'dash', 'ability', 'item']) {
      const el = els[a]; if (!el) continue;
      let pid = -1;
      el.addEventListener('pointerdown', (e) => {
        unlock(); inp.device = 'touch'; pid = e.pointerId;
        try { el.setPointerCapture(e.pointerId); } catch (err) { }
        touch.held[a] = true; latch.add('t_' + a); el.classList.add('down'); e.preventDefault(); e.stopPropagation();
      });
      const up = (e) => { if (e.pointerId !== pid) return; pid = -1; touch.held[a] = false; el.classList.remove('down'); slideIn = false; };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
      // DRIFT thumb slid onto DASH: dash once (drift stays held, so the drift resumes after the dash)
      let slideIn = false;
      if (a === 'drift') el.addEventListener('pointermove', (e) => {
        if (e.pointerId !== pid || !els.dash) return;
        const r = els.dash.getBoundingClientRect(), pad = 10;
        const inside = e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad;
        if (inside && !slideIn) { latch.add('t_dash'); els.dash.classList.add('down'); setTimeout(() => { if (!touch.held.dash) els.dash.classList.remove('down'); }, 140); }
        slideIn = inside;
      });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  // ------------------------------------------------------------------
  // Portrait overlay + auto-pause
  // ------------------------------------------------------------------
  let rotEl = null, portrait = false;
  function checkPortrait() {
    const on = matchMedia('(pointer:coarse)').matches && innerHeight > innerWidth;
    if (on === portrait) return;
    portrait = on;
    if (!rotEl) { rotEl = document.createElement('div'); rotEl.id = 'rotate'; rotEl.innerHTML = '<div class="phone"></div><div>ROTATE YOUR DEVICE</div>'; document.body.appendChild(rotEl); }
    rotEl.classList.toggle('on', on);
    autoPause(on, 'portrait');
  }
  function autoPause(on, reason) {
    G.emit('input:autopause', { on, reason });          // UI flow should listen and enter 'paused'
    if (!G.mods.ui) G.time.paused = on && !G.params.test; // fallback when no UI module exists
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(true, 'hidden'); });
  addEventListener('blur', () => autoPause(true, 'blur'));
  addEventListener('focus', () => { if (!G.mods.ui && !portrait) G.time.paused = false; });
  addEventListener('resize', checkPortrait);

  // Haptics
  // visual pulses on the buttons too (navigator.vibrate does nothing on iOS)
  const pulse = (el, cls, ms) => { if (!el || !document.body.classList.contains('touch')) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); clearTimeout(el['_t' + cls]); el['_t' + cls] = setTimeout(() => el.classList.remove(cls), ms); };
  G.on('kart:tier', () => { inp.vibrate(10); pulse(els && els.drift, 'tierup', 320); });
  G.on('kart:hit', () => { inp.vibrate(25); if (els) { pulse(els.drift, 'hitp', 260); pulse(els.dash, 'hitp', 260); pulse(els.ability, 'hitp', 260); } });
  G.on('kart:comet', (d) => { if (d && d.phase === 'launch') inp.vibrate([40, 20, 40]); });
  G.on('kart:perfect', () => inp.vibrate(15));

  // ------------------------------------------------------------------
  // Gamepad
  // ------------------------------------------------------------------
  const pad = { steer: 0, throttle: 0, brake: false, drift: false, dash: false, ability: false, item: false, pause: false, on: false };
  function pollPad() {
    pad.on = false;
    let gps; try { gps = navigator.getGamepads ? navigator.getGamepads() : null; } catch (e) { gps = null; }
    if (!gps) return;
    for (const gp of gps) {
      if (!gp || !gp.connected) continue;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      let x = gp.axes[0] || 0; if (Math.abs(x) < 0.15) x = 0;
      pad.steer = x; pad.drift = b(0) || b(5); pad.item = b(1); pad.dash = b(2); pad.ability = b(3); pad.pause = b(9);
      pad.throttle = gp.buttons[7] ? gp.buttons[7].value : 0; pad.brake = b(6) || (gp.axes[1] || 0) > 0.7;
      pad.on = x !== 0 || pad.drift || pad.item || pad.dash || pad.ability || pad.pause || pad.throttle > 0.1 || pad.brake;
      if (pad.on) inp.device = 'pad';
      return;
    }
  }

  // ------------------------------------------------------------------
  // Per fixed step: combine sources -> held -> edges
  // ------------------------------------------------------------------
  const raw = { steer: 0, steerRaw: 0, throttle: 0, brake: false, drift: false, dash: false, ability: false, item: false, pause: false };
  const tapHeld = { steer: null, throttle: null, brake: false, drift: false, dash: false, ability: false, item: false };
  function update(dt) {
    pollPad();
    // keyboard steer ramps for smoothness
    const kt = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const rate = kt === 0 ? 10 : (Math.sign(kt) !== Math.sign(keySteer) && keySteer !== 0 ? 14 : 7);
    keySteer += Math.max(-rate * dt, Math.min(rate * dt, kt - keySteer));
    if (Math.abs(keySteer) < 1e-3 && kt === 0) keySteer = 0;

    // touch stick: deadzone 7%, curve |x|^1.25 (small corrections respond, full lock at the rim)
    let ts = 0, stickBrake = false;
    if (touch.stickId !== -1) {
      const ax = Math.abs(touch.x); const xx = ax < 0.07 ? 0 : (ax - 0.07) / 0.93;
      ts = Math.sign(touch.x) * Math.pow(xx, 1.25);
      // brake only on a deliberate pull mostly straight down, held 150 ms (thumbs drift down while steering)
      const pull = touch.y > 0.8 && Math.abs(touch.x) < 0.45;
      touch.brakeT = pull ? touch.brakeT + dt : 0;
      stickBrake = touch.brakeT >= 0.15;
    }
    const kd = (a) => keys.has(a) || latch.has(a);
    const td = (a) => touch.held[a] || latch.has('t_' + a);
    raw.steer = Math.max(-1, Math.min(1, keySteer + ts + pad.steer));
    raw.steerRaw = Math.max(-1, Math.min(1, kt + ts + pad.steer));       // undelayed digital direction
    raw.brake = kd('brake') || stickBrake || pad.brake;
    raw.throttle = raw.brake ? 0 : (inp.autoThrottle ? 1 : Math.max(kd('throttle') ? 1 : 0, pad.throttle));
    raw.drift = kd('drift') || td('drift') || pad.drift;
    raw.dash = kd('dash') || td('dash') || pad.dash;
    raw.ability = kd('ability') || td('ability') || pad.ability;
    raw.item = kd('item') || td('item') || pad.item;
    raw.pause = kd('pause') || pad.pause;
    latch.clear();

    // taps (time-driven)
    tapHeld.drift = tapHeld.dash = tapHeld.ability = tapHeld.item = tapHeld.brake = false;
    for (let i = taps.length - 1; i >= 0; i--) {
      const tp = taps[i];
      if (tp.a in tapHeld) tapHeld[tp.a] = true;
      tp.t -= dt; if (tp.t <= 0) taps.splice(i, 1);
    }

    const J = inp.inject;
    inp.steer = J.steer != null ? J.steer : raw.steer;
    inp.steerRaw = J.steer != null ? J.steer : raw.steerRaw;
    inp.brake = tapHeld.brake || (J.brake != null ? !!J.brake : raw.brake);
    inp.throttle = J.throttle != null ? J.throttle : (inp.brake ? 0 : raw.throttle);
    inp.drift = tapHeld.drift || (J.drift != null ? !!J.drift : raw.drift);
    inp.dash = tapHeld.dash || (J.dash != null ? !!J.dash : raw.dash);
    inp.ability = tapHeld.ability || (J.ability != null ? !!J.ability : raw.ability);
    inp.item = tapHeld.item || (J.item != null ? !!J.item : raw.item);
    inp.pause = raw.pause;

    for (const b of BTN) {
      const h = inp[b];
      inp.pressed[b] = h && !prev[b];
      inp.released[b] = !h && prev[b];
      prev[b] = h;
    }
  }

  // ------------------------------------------------------------------
  // Touch button visuals (cheap: only touches the DOM when values change)
  // ------------------------------------------------------------------
  const vis = { p: -1, tc: '', cur: '', dashCd: -1, pip: null, comet: null, item: null, abCd: -1, fl: -1, dAff: null };
  function render() {
    if (!els || !document.body.classList.contains('touch')) return;
    const k = G.kart; if (!k) return;
    // drift ring: charge progress within current tier
    const T = G.cfg.tierT;
    // ring = progress towards the next tier (in that tier's colour); border/glow = the tier you hold now
    let p = 0, tc = G.cfg.tierColor[0], cur = 'none';
    if (k.drifting) {
      const c = k.driftCharge || 0, tier = k.driftTier || 0;
      if (tier >= 3) { p = 1; tc = G.cfg.tierColor[2]; }
      else { const a = tier ? T[tier - 1] : 0, b = T[tier]; p = (c - a) / (b - a); tc = G.cfg.tierColor[tier]; }
      cur = tier ? G.cfg.tierColor[tier - 1] : 'none';
    }
    p = Math.round(p * 40) / 40;
    if (p !== vis.p) { els.drift.style.setProperty('--p', p); vis.p = p; }
    if (tc !== vis.tc) { els.drift.style.setProperty('--tc', tc); vis.tc = tc; }
    if (cur !== vis.cur) { if (cur === 'none') els.drift.style.removeProperty('--cur'); else els.drift.style.setProperty('--cur', cur); els.drift.classList.toggle('tier', cur !== 'none'); vis.cur = cur; }
    // dash cooldown sweep + free-charge pip
    const dcd = k.dashCD > 0 ? Math.round((k.dashCD / G.cfg.dashCD) * 20) / 20 : 0;
    if (dcd !== vis.dashCd) { els.dash.style.setProperty('--p', dcd); els.dash.style.setProperty('--tc', '#33f6ff'); els.dash.classList.toggle('cd', dcd > 0); vis.dashCd = dcd; }
    const pip = !!k.freeDash;
    if (pip !== vis.pip) { const el = els.dash.querySelector('.pip'); if (el) el.classList.toggle('on', pip); vis.pip = pip; }
    // cost badges light up when affordable; Flux mirrored as a thin ring on OVERCLOCK/COMET (notch at 50)
    const dAff = pip || k.flux >= G.cfg.dashCost;
    if (dAff !== vis.dAff) { els.dash.classList.toggle('afford', dAff); els.dash.classList.toggle('free', pip); vis.dAff = dAff; }
    const fl = Math.round(Math.max(0, Math.min(100, k.flux || 0)));
    if (fl !== vis.fl) { els.ability.style.setProperty('--f', fl / 100); els.ability.classList.toggle('afford', fl >= G.cfg.overclockCost); els.ability.classList.toggle('full', fl >= 100); vis.fl = fl; }
    // ability slot: Overclock, or big gold COMET when available
    const comet = !!(k.cometReady && k.cometReady());
    if (comet !== vis.comet) {
      els.ability.classList.toggle('comet', comet);
      const l = els.ability.querySelector('.lbl'); if (l) l.innerHTML = comet ? 'COMET' : 'OVER<br>CLOCK';
      const cst = els.ability.querySelector('.cost'); if (cst) cst.textContent = comet ? '100' : '50';
      vis.comet = comet;
    }
    const acd = k.overclockCD > 0 ? Math.round((k.overclockCD / G.cfg.overclockCD) * 20) / 20 : 0;
    if (acd !== vis.abCd) { els.ability.style.setProperty('--p', acd); els.ability.style.setProperty('--tc', '#c04bff'); els.ability.classList.toggle('cd', acd > 0 || (k.flux < G.cfg.overclockCost && !comet)); vis.abCd = acd; }
    const it = k.item || null;
    if (it !== vis.item) { const l = els.item.querySelector('.lbl'); if (l) l.textContent = it ? String(it).toUpperCase() : 'ITEM'; vis.item = it; }
  }

  G.register('input', {
    init() { buildTouchDOM(); checkPortrait(); },
    update, render,
    reset() { inp.clearInject(); keys.clear(); },
  });
}
