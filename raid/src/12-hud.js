// =============================================================================
//  §10 / §17  HUD — boss bar (chip, phase ticks, enrage, cast bar), player HP /
//       shield / Flux / Hourglass, status icons, ability buttons (conic sweep,
//       numbers, pips, grey-out, glows), fracture pips, off-screen arrows.
//       DOM writes are cached: an element is only touched when its value changes.
// =============================================================================
// precomputed cache keys (the HUD runs every frame; 'dp' + i would build a string each time)
const HUD_KEYS = { dp: [], dpv: [], pip: [], arw: [] };
for (let i = 0; i < 8; i++) { HUD_KEYS.dp.push('dp' + i); HUD_KEYS.dpv.push('dpv' + i); HUD_KEYS.pip.push('pip' + i); HUD_KEYS.arw.push('arw' + i); }

const HUD = {
  el: {}, cache: Object.create(null), btnState: {}, statusEls: [], arrows: [],
  bossChip: 1, bossChipDelay: 0, lastBossF: 1, hpChip: 1, hpChipDelay: 0, lastHpF: 1,
  boundBoss: null, visible: false, fpsOn: URLP.get('debug') === '1', ghostT: 0,
  _s: { x: 0, y: 0, z: 0 },

  init() {
    const ids = ['hud', 'bossbar', 'bb-name', 'bb-epithet', 'bb-frame', 'bb-chip', 'bb-fill', 'bb-ticks', 'bb-pct', 'bb-enrage', 'castbar', 'cb-fill', 'cb-name',
      'cb-shards', 'playerpanel', 'statuses', 'hpbar', 'hp-chip', 'hp-fill', 'hp-heal', 'hp-shield', 'hp-text', 'fluxbar', 'flux-fill', 'hg-fill', 'pips', 'arrows', 'fpsbadge', 'abilities', 'joy-ghost', 'pausebtn'];
    for (const id of ids) this.el[id] = $(id);
    this.pips = Array.from(this.el.pips.querySelectorAll('i'));
    for (let i = 0; i < 8; i++) {
      const d = document.createElement('div'); d.className = 'st'; d.style.display = 'none';
      d.innerHTML = '<span></span><b></b><s></s>'; this.el.statuses.appendChild(d);
      this.statusEls.push({ el: d, label: d.children[0], stacks: d.children[1], time: d.children[2], key: '' });
    }
    for (let i = 0; i < 4; i++) { const a = document.createElement('div'); a.className = 'offarrow' + (i ? ' add' : ''); this.el.arrows.appendChild(a); this.arrows.push(a); }
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('i');
      const ang = (i / 8) * TAU + 0.3, d = 90 + (i % 3) * 30;
      s.style.setProperty('--sx', ((i - 3.5) * 22).toFixed(0) + 'px');
      s.style.setProperty('--tx', ((i - 3.5) * 22 + Math.cos(ang) * d).toFixed(0) + 'px');
      s.style.setProperty('--ty', (Math.sin(ang) * d * 0.6 + 30).toFixed(0) + 'px');
      s.style.setProperty('--tr', ((i % 2 ? 1 : -1) * (120 + i * 30)) + 'deg');
      this.el['cb-shards'].appendChild(s);
    }
    document.querySelectorAll('#abilities .ab').forEach((b) => {
      const id = b.dataset.ab;
      this.btnState[id] = { el: b, cdn: b.querySelector('.cdn'), pips: b.querySelector('.pips') ? Array.from(b.querySelectorAll('.pips i')) : null, cd: -1, num: '', cls: '', ready: true, g: -1, e: -1, kcd: 'cd_' + id };
    });
    this.el.pausebtn.addEventListener('click', (e) => { e.stopPropagation(); Game.togglePause(); });
    this.el.fpsbadge.classList.toggle('on', this.fpsOn);
    Callouts.init();
  },

  // ---- small cached DOM setters
  setText(el, key, v) { if (this.cache[key] !== v) { this.cache[key] = v; el.textContent = v; } },
  setScale(el, key, f) { f = clamp01(f); const q = Math.round(f * 1000); if (this.cache[key] !== q) { this.cache[key] = q; el.style.transform = 'scaleX(' + (q / 1000) + ')'; } },
  setClass(el, key, cls, on) { const k = key + cls; if (this.cache[k] !== on) { this.cache[k] = on; el.classList.toggle(cls, on); } },
  setVar(el, key, name, v) { const q = Math.round(v * 500) / 500; if (this.cache[key] !== q) { this.cache[key] = q; el.style.setProperty(name, q); } },

  show(on) {
    this.visible = on;
    this.el.hud.classList.toggle('off', !on);
    this.el.abilities.classList.toggle('hide', !on);
    if (!on) { this.el.pips.classList.remove('on'); for (const a of this.arrows) a.classList.remove('on'); }
  },
  showFps(on) { this.fpsOn = on; this.el.fpsbadge.classList.toggle('on', on); },
  toast(msg) { Hint.show(msg, 1.6); },
  hideJoyGhost() { this.ghostT = 0; this.el['joy-ghost'].classList.remove('on'); },
  showJoyGhost() { if (!View.touch) return; this.ghostT = CONFIG.input.ghostHint; this.el['joy-ghost'].classList.add('on'); },
  flashButton(id) { const b = this.btnState[id]; if (!b) return; b.el.classList.remove('flashready'); void b.el.offsetWidth; b.el.classList.add('flashready'); },
  /** cast bar shatters into shards (interrupt) */
  shatterCast() {
    const s = this.el['cb-shards']; s.classList.remove('go'); void s.offsetWidth; s.classList.add('go');
    this.el.castbar.classList.remove('on'); this.cache.castOn = false;
  },

  /** bind a boss: name, epithet, phase tick marks */
  bindBoss(b) {
    this.boundBoss = b;
    // a cast bar left 'on' by the previous fight (quit mid-cast) must not flash at the start of this one
    this.el.castbar.classList.remove('on', 'int'); this.cache.castOn = false; this.cache.cbiint = false;
    const ticks = this.el['bb-ticks']; ticks.innerHTML = '';
    if (b) {
      this.setText(this.el['bb-name'], 'bbn', b.name); this.setText(this.el['bb-epithet'], 'bbe', b.epithet || '');
      for (const th of (b.phaseThresholds || [])) { const i = document.createElement('i'); i.style.left = (th * 100).toFixed(2) + '%'; ticks.appendChild(i); }
      this.bossChip = b.hp / b.maxHp; this.lastBossF = this.bossChip;
    }
    this.el.bossbar.classList.toggle('hide', !b);
  },

  update(dt) {
    Callouts.layout(false);
    if (this.ghostT > 0) { this.ghostT -= dt; if (this.ghostT <= 0 || CamRig.rail || !this.visible) this.hideJoyGhost(); }   // never over a cinematic or a result card
    if (this.fpsOn) this.setText(this.el.fpsbadge, 'fps', Game.fps + ' FPS · ' + Quality.label + ' · ' + Quality.pr.toFixed(2) + 'x');
    if (!this.visible) return;
    const b = Game.boss, p = Game.player;
    // ---------------- boss bar
    if (b !== this.boundBoss) this.bindBoss(b);
    if (b) {
      const f = b.hp / b.maxHp;
      if (f < this.lastBossF - 1e-5) this.bossChipDelay = 0.45;
      if (f > this.bossChip) this.bossChip = f;
      this.lastBossF = f;
      if (this.bossChipDelay > 0) this.bossChipDelay -= dt; else this.bossChip = damp(this.bossChip, f, 4, dt);
      this.setScale(this.el['bb-fill'], 'bbf', f);
      this.setScale(this.el['bb-chip'], 'bbc', this.bossChip);
      this.setText(this.el['bb-pct'], 'bbp', (Math.ceil(f * 1000) / 10).toFixed(1) + '%');
      this.setClass(this.el['bb-frame'], 'bbfr', 'shield', !!b.invuln);
      this.setClass(this.el.bossbar, 'bbl', 'locked', !!(b.hasStatus && b.hasStatus('timelocked')));
      this.setClass(this.el['bb-frame'], 'bbfr', 'overheat', !!(b.hasStatus && (b.hasStatus('overheat') || b.hasStatus('overexposed'))));
      if (b.enrageAt > 0 && Game.diff.enrage) {
        const rem = b.enrageAt - Game.fightTime;
        this.setText(this.el['bb-enrage'], 'bben', rem > 0 ? fmtTime(rem) : 'ENRAGE');
        this.setClass(this.el['bb-enrage'], 'bbenw', 'warn', rem < 30);
      } else this.setText(this.el['bb-enrage'], 'bben', '');
      const c = b.cast;
      const on = !!(c && b.alive);
      if (this.cache.castOn !== on) { this.cache.castOn = on; this.el.castbar.classList.toggle('on', on); }
      if (on) {
        this.setScale(this.el['cb-fill'], 'cbf', c.t / c.dur);
        this.setText(this.el['cb-name'], 'cbn', c.name);
        this.setClass(this.el.castbar, 'cbi', 'int', !!c.interruptible);
      }
    }
    // ---------------- player
    if (p) {
      const f = p.hp / p.maxHp;
      if (f < this.lastHpF - 1e-5) this.hpChipDelay = 0.5;
      if (f > this.hpChip) this.hpChip = f;
      this.lastHpF = f;
      if (this.hpChipDelay > 0) this.hpChipDelay -= dt; else this.hpChip = damp(this.hpChip, f, 4, dt);
      this.setScale(this.el['hp-fill'], 'hpf', f);
      this.setScale(this.el['hp-chip'], 'hpc', this.hpChip);
      this.setScale(this.el['hp-shield'], 'hps', p.shield / p.maxHp);
      // green ghost: what your next Shatter would heal (only when Shatter is ready to use)
      const ph = Math.min(1 - f, p.pendingShatterHeal() / p.maxHp), hq = ph > 0.002 ? Math.round(ph * 1000) : 0, hl = Math.round(f * 1000);
      if (this.cache.hph !== hq || (hq && this.cache.hphl !== hl)) {
        this.cache.hph = hq; this.cache.hphl = hl;
        const e = this.el['hp-heal']; e.style.left = (hl / 10) + '%'; e.style.width = (hq / 10) + '%'; e.style.display = hq ? '' : 'none';
      }
      this.setText(this.el['hp-text'], 'hpt', Math.ceil(p.hp) + (p.shield > 0 ? ' +' + Math.ceil(p.shield) : ''));
      this.setClass(this.el.hpbar, 'hpl', 'low', f < 0.3);
      this.setScale(this.el['flux-fill'], 'flx', p.flux / 100);
      this.setClass(this.el.fluxbar, 'flh', 'hot', p.flux >= 50);
      this.setScale(this.el['hg-fill'], 'hg', p.hourglass / 100);
      this.updateStatuses(p);
      this.updateButtons(p, b);
    }
    // ---------------- fracture pips over the boss
    const showPips = b && b.alive && p && Game.state !== 'victory' && !CamRig.rail;
    if (showPips && worldToScreen(_v4.set(b.vis.x, b.height + 0.9, b.vis.z), this._s) && this._s.y > 40) {
      this.setClass(this.el.pips, 'pipon', 'on', true);
      const s = this._s;
      const px = Math.round(s.x), py = Math.round(Math.max(s.y, 90));
      if (this.pipX !== px || this.pipY !== py) { this.pipX = px; this.pipY = py; this.el.pips.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0) translate(-50%,-50%)'; }
      for (let i = 0; i < 5; i++) this.setClass(this.pips[i], HUD_KEYS.pip[i], 'lit', i < p.fractures);
      this.setClass(this.el.pips, 'pipf', 'full', p.fractures >= 5);
      this.setClass(this.el.pips, 'pipfl', 'flick', p.fractures > 0 && p.fractureT < CONFIG.player.fractureFlicker);
    } else this.setClass(this.el.pips, 'pipon', 'on', false);
    // ---------------- off-screen arrows (boss + up to 3 adds)
    this.arrow(0, b && b.alive ? _v4.set(b.vis.x, 1.5, b.vis.z) : null);
    let k = 1;
    for (const a of Game.adds) { if (k > 3) break; if (a.alive) { this.arrow(k++, _v4.set(a.vis.x, 1, a.vis.z)); } }
    for (; k < 4; k++) this.arrow(k, null);
  },

  arrow(i, wp) {
    const el = this.arrows[i];
    if (!wp) { this.setClass(el, HUD_KEYS.arw[i], 'on', false); return; }
    _v8.copy(wp).project(camera);
    let x = _v8.x, y = _v8.y;
    const behind = _v8.z > 1;
    if (behind) { x = -x; y = -y; }
    const off = behind || Math.abs(x) > 0.96 || Math.abs(y) > 0.96;
    this.setClass(el, HUD_KEYS.arw[i], 'on', off);
    if (!off) return;
    const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
    x /= m; y /= m;
    const sx = (x * 0.5 + 0.5) * View.w, sy = (-y * 0.5 + 0.5) * View.h;
    const px = clamp(sx, 34, View.w - 34), py = clamp(sy, 70, View.h - 34);
    const ang = Math.atan2(x * View.w, y * View.h);
    el.style.transform = 'translate3d(' + px.toFixed(0) + 'px,' + py.toFixed(0) + 'px,0) translate(-50%,-50%) rotate(' + ang.toFixed(2) + 'rad)';
  },

  updateStatuses(p) {
    let n = 0;
    for (const s of p.statuses) {
      if (n >= this.statusEls.length) break;
      const def = STATUS_DEFS[s.id]; if (!def) continue;
      const e = this.statusEls[n++];
      if (e.key !== s.id) { e.key = s.id; e.el.style.display = ''; e.el.style.color = def.color; e.label.textContent = def.short; e.el.title = def.name; }
      const st = s.stacks > 1 ? '' + s.stacks : '';
      if (e.stacks.textContent !== st) e.stacks.textContent = st;
      const rem = s.dur - s.t, tt = isFinite(rem) && rem < 60 ? Math.ceil(rem) + '' : '';
      if (e.time.textContent !== tt) e.time.textContent = tt;
    }
    for (let i = n; i < this.statusEls.length; i++) { const e = this.statusEls[i]; if (e.key !== '') { e.key = ''; e.el.style.display = 'none'; } }
  },

  /** one ability button: cooldown sweep, number, grey-out, glow, ready flash (cached; no per-frame allocation) */
  setBtn(id, cdFrac, remain, grey, glow) {
      const s = this.btnState[id]; if (!s) return;
      this.setVar(s.el, s.kcd, '--cd', clamp01(cdFrac));
      const num = remain > 0.05 && remain < 3 ? (remain < 1 ? remain.toFixed(1) : Math.ceil(remain) + '') : '';
      if (s.num !== num) { s.num = num; s.cdn.textContent = num; }
      const cls = (grey ? ' grey' : '') + (glow ? ' ' + glow : '');
      if (s.cls !== cls) { s.el.classList.toggle('grey', !!grey); s.el.classList.toggle('glow-gold', glow === 'glow-gold'); s.el.classList.toggle('glow-violet', glow === 'glow-violet'); s.cls = cls; }
      const ready = cdFrac <= 0 && !grey;
      if (ready && !s.ready) this.flashButton(id);
      s.ready = ready;
  },
  updateButtons(p, b) {
    const A = CONFIG.abilities, act = p.canAct() || Game.state === 'transition';
    const cd = p.cds, rate = p.cdRate;
    // Phase Step: pips + sweep when empty
    const dc = cd.dash;
    this.setBtn('dash', dc.charges > 0 ? 0 : dc.t / A.dash.cd, dc.charges > 0 ? 0 : dc.t / rate, !act, null);
    const ds = this.btnState.dash;
    if (ds && ds.pips) for (let i = 0; i < ds.pips.length; i++) {
      this.setClass(ds.pips[i], HUD_KEYS.dp[i], 'on', i < dc.charges);
      const show = i < dc.max, kv = HUD_KEYS.dpv[i]; if (this.cache[kv] !== show) { this.cache[kv] = show; ds.pips[i].style.display = show ? '' : 'none'; }
    }
    this.setBtn('rend', cd.rend.t / A.rend.cd, cd.rend.t / rate, !act, null);
    const canShatter = p.flux >= A.shatter.cost;
    this.setBtn('shatter', cd.shatter.t / A.shatter.cd, cd.shatter.t, !canShatter || !act, canShatter && p.fractures >= 5 ? 'glow-gold' : null);
    this.setBtn('recall', cd.recall.t / A.recall.cd, cd.recall.t / rate, !p.echo.active || !act, null);
    const rs = this.btnState.recall; if (rs) this.setVar(rs.el, 'echoL', '--e', p.echo.active ? p.echo.life / p.echo.max : 0);
    // Stasis Lance: the button says which throw you would make right now (INTERRUPT glows violet; PIERCE = the long-cooldown damage mode)
    const lanceMax = p.lanceMax || p.lanceCd('interrupt'), lReady = cd.lance.t <= 0;
    const castInt = p.lanceModeNow() === 'interrupt';
    this.setBtn('lance', cd.lance.t / lanceMax, cd.lance.t, !act, castInt && lReady ? 'glow-violet' : null);
    const ls = this.btnState.lance;
    if (ls) {
      if (!ls.tag) ls.tag = ls.el.querySelector('.tag');
      const mode = !lReady || !act ? '' : castInt ? 'int' : 'pierce';
      if (ls.mode !== mode) {
        ls.mode = mode;
        if (ls.tag) { ls.tag.className = 'tag ' + mode; ls.tag.textContent = mode === 'int' ? 'INTERRUPT' : mode === 'pierce' ? 'PIERCE · ' + Math.round(p.lanceCd('pierce')) + 's' : ''; }
        ls.el.classList.toggle('mode-pierce', mode === 'pierce');
      }
    }
    const us = this.btnState.ult; if (us) this.setVar(us.el, 'ultG', '--g', p.hourglass / 100);
    this.setBtn('ult', 0, 0, p.hourglass < 100 || !act, p.hourglass >= 100 ? 'glow-gold' : null);
  },
};

// =============================================================================
//  Callouts — keeps banners, stamps, phase titles (and, in portrait, the tutorial hint) off the boss, the player
//  and the HUD. Each visible callout is placed every frame: just under the boss bar (spec: upper third) when that
//  spot is clear, otherwise beside the boss, above its head, or in the first free band below. Spots are sticky
//  (a callout only moves when its current spot becomes covered) so text does not jitter.
//  Obstacles: boss body + fracture pips, player body, the ability buttons / player panel / live joystick (cached per
//  screen size), the hint, and callouts already placed this frame. No per-frame allocation.
// =============================================================================
const Callouts = {
  items: null, _barBottom: 60, _bbW: -1, _bbH: -1, _bbHide: null,
  _pb: { l: 0, t: 0, r: 0, b: 0, on: false }, _pp: { l: 0, t: 0, r: 0, b: 0, on: false },
  _pips: { l: 0, t: 0, r: 0, b: 0, on: false }, _joy: { l: 0, t: 0, r: 0, b: 0, on: false },
  _ph: { l: 0, t: 0, r: 0, b: 0, on: false },               // the hint rect (static spot in landscape, solver-placed in portrait)
  _phW: -1, _phH: -1,
  _hud: [], _hudW: -1, _hudH: -1,                           // static HUD rects (buttons, player panel)
  _s: { x: 0, y: 0, z: 0 }, _obs: [], _cx: new Float32Array(96), _cy: new Float32Array(96), _cn: new Uint8Array(96), _nc: 0, _panelW: -1, _panelH: -1, _panelTop: 0,
  init() {
    const mk = (id, dur, base) => ({ id, el: $(id), until: 0, dur, base, w: 0, h: 0, x: -1, y: -1, rect: { l: 0, t: 0, r: 0, b: 0, on: false } });
    this.hintItem = mk('hint', 0, 0.2); this.hintItem.isHint = true;
    // the hint is placed first (banners then route around it); it is only solver-placed in portrait
    this.items = [this.hintItem, mk('phasetitle', 2.6, 0.36), mk('banner', 1.2, 0.16), mk('stamp', 1.1, 0.32), mk('countdown', 0.5, 0.4)];
    this.cd = this.items[4]; this.cdText = '';
    // wrap the 11-combat show() calls so we know when (and for how long) each callout is on screen
    const wrap = (obj, id, durOf) => { const f = obj.show; obj.show = function () { const r = f.apply(this, arguments); Callouts.kick(id, durOf(arguments)); return r; }; };
    wrap(Banner, 'banner', (a) => ((a[2] && a[2].dur) || 0.8) + 0.4);
    wrap(PhaseTitle, 'phasetitle', () => 2.6);
    wrap(Stamp, 'stamp', () => 1.1);
    wrap(Hint, 'hint', () => 0);
    resizeListeners.push(() => { this._hudW = -1; this._phW = -1; this._bbW = -1; this.hintItem.x = -1; this.hintItem.w = 0; });   // re-measure the hint (its CSS shape follows the orientation)
  },
  kick(id, dur) {
    if (!this.items) return;
    let it = null; for (const i of this.items) if (i.id === id) it = i;
    if (!it) return;
    if (it.isHint) { this.measureHint(); it.x = -1; it.y = -1; this._phW = -1; this.layout(true); return; }
    it.until = Game.realTime + dur; it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; it.x = -1; it.y = -1;
    this.layout(true);
  },
  /** the hint has two shapes in portrait: wide (≤360 px, 2 lines) and narrow (≤210 px, for the lower-left corner) */
  measureHint() {
    const it = this.hintItem, el = it.el, n = el.classList.contains('narrow');
    el.classList.add('narrow'); it.wn = el.offsetWidth; it.hn = el.offsetHeight;
    el.classList.remove('narrow'); it.w = el.offsetWidth; it.h = el.offsetHeight;
    if (n) el.classList.add('narrow');
  },
  /** bottom of the top HUD block (boss bar + cast bar), cached per screen size / bar visibility */
  barBottom() {
    const bb = HUD.el.bossbar; const hide = !bb || bb.classList.contains('hide');
    if (this._bbW !== View.w || this._bbH !== View.h || this._bbHide !== hide) {
      this._bbW = View.w; this._bbH = View.h; this._bbHide = hide;
      this._barBottom = hide ? 8 : bb.getBoundingClientRect().bottom;
    }
    return this._barBottom;
  },
  /** screen rect of a world-space vertical span (feet → head) with a width proportional to its projected height */
  span(x, z, y0, y1, wk, minW, out) {
    out.on = false;
    if (!worldToScreen(_v4.set(x, y0, z), this._s)) return out;
    const fx = this._s.x, fy = this._s.y;
    if (!worldToScreen(_v4.set(x, y1, z), this._s)) return out;
    const hy = this._s.y, h = Math.max(8, fy - hy), w = Math.max(minW, h * wk);
    const cx = (fx + this._s.x) * 0.5;
    out.l = cx - w / 2; out.r = cx + w / 2; out.t = Math.min(hy, fy) - 6; out.b = Math.max(hy, fy) + 4; out.on = true;
    return out;
  },
  /** ability buttons + player panel: they only move on resize, so read them once per screen size */
  hudRects() {
    if (this._hudW === View.w && this._hudH === View.h) return this._hud;
    this._hudW = View.w; this._hudH = View.h;
    const L = this._hud; L.length = 0;
    const add = (el, pad) => { if (!el) return; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; L.push({ l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad, on: true }); };
    document.querySelectorAll('#abilities .ab').forEach((b) => add(b, 6));
    add(HUD.el.playerpanel, 4);
    return L;
  },
  hit(o, l, t, r, b) { return o.on !== false && l < o.r && r > o.l && t < o.b && b > o.t; },
  free(l, t, r, b) {
    if (l < 6 || r > View.w - 6 || t < 4 || b > View.h - 4) return false;
    for (const o of this._obs) if (this.hit(o, l, t, r, b)) return false;
    return true;
  },
  fits(x, y, hw, hh, top0) { return y - hh >= top0 - 1 && this.free(x - hw, y - hh, x + hw, y + hh); },
  /** clear of every other callout, the hint and the HUD (boss / player overlap allowed): the fallback's hard rule */
  clearOfUI(it, x, y, hw, hh, top0) {
    const l = x - hw, r = x + hw, t = y - hh, b = y + hh;
    if (t < top0 - 1 || b > View.h - 4 || l < 6 || r > View.w - 6) return false;
    for (const o of this.items) if (o !== it && o.rect.on && this.hit(o.rect, l, t, r, b)) return false;
    if (!it.isHint && this._ph.on && this.hit(this._ph, l, t, r, b)) return false;
    for (const o of this._hud) if (this.hit(o, l, t, r, b)) return false;
    if (this._joy.on && this.hit(this._joy, l, t, r, b)) return false;
    return true;
  },
  ov(o, x, y, hw, hh) { return (o && o.on !== false) ? Math.max(0, Math.min(x + hw, o.r) - Math.max(x - hw, o.l)) * Math.max(0, Math.min(y + hh, o.b) - Math.max(y - hh, o.t)) : 0; },
  cand(x, y, narrow) { if (this._nc < this._cx.length) { this._cx[this._nc] = x; this._cy[this._nc] = y; this._cn[this._nc] = narrow ? 1 : 0; this._nc++; } },
  layout(force) {
    if (!this.items) return;
    const cdt = this.cd.el.textContent;                      // the 3-2-1-FIGHT countdown (18-game) is watched by its text
    if (cdt !== this.cdText) { this.cdText = cdt; if (cdt) this.kick('countdown', 0.5); }
    const hi = this.hintItem, hintOn = hi.el.classList.contains('on');
    const hintSolve = hintOn && (View.portrait || View.compact);   // phones: the hint is placed by the solver; desktop: fixed CSS spot
    if (!View.portrait && !View.compact && hi.x !== -2) { hi.x = -2; hi.el.style.left = ''; hi.el.style.top = ''; hi.el.classList.remove('narrow'); }
    let any = hintSolve; for (const it of this.items) if (!it.isHint && it.until > Game.realTime) any = true;
    if (!any) { if (!hintOn) this._ph.on = false; return; }
    const lb = Letterbox.on ? View.h * 0.11 : 0;
    const top0 = Math.max(this.barBottom(), lb) + 8;
    // ---- obstacles
    const obs = this._obs; obs.length = 0;
    const b = Game.boss, p = Game.player;
    if (b && b.alive && b.vis && b.group && b.group.visible !== false) obs.push(this.span(b.vis.x, b.vis.z, 0, (b.height || 5) + 0.5, 0.7, 70, this._pb)); else this._pb.on = false;
    if (p && p.vis && p.alive !== false && Game.state !== 'title') obs.push(this.span(p.vis.x, p.vis.z, 0, 2.2, 0.8, 44, this._pp)); else this._pp.on = false;
    const pr = this._pips; pr.on = !!(HUD.el.pips && HUD.el.pips.classList.contains('on') && HUD.pipX != null);
    if (pr.on) { pr.l = HUD.pipX - 50; pr.r = HUD.pipX + 50; pr.t = HUD.pipY - 14; pr.b = HUD.pipY + 14; obs.push(pr); }
    if (HUD.visible) { const L = this.hudRects(); for (let i = 0; i < L.length; i++) obs.push(L[i]); }
    else { this._hud.length = 0; this._hudW = -1; }
    const j = Input.joy, jr = this._joy; jr.on = !!j && j.id !== -1;
    if (jr.on) { const R = CONFIG.input.joyBase / 2 + 8; jr.l = j.ox - R; jr.r = j.ox + R; jr.t = j.oy - R; jr.b = j.oy + R; obs.push(jr); }
    // the hint on desktop: a fixed CSS spot, measured once per show / resize
    const ph = this._ph;
    if (hintOn && !hintSolve) {
      if (this._phW !== View.w || this._phH !== View.h) { this._phW = View.w; this._phH = View.h; const r = hi.el.getBoundingClientRect(); ph.l = r.left; ph.t = r.top; ph.r = r.right; ph.b = r.bottom; }
      ph.on = true; obs.push(ph);
    } else ph.on = false;
    for (const it of this.items) it.rect.on = false;          // placed in priority order this frame (hint first): ignore last frame's spots
    const cx = View.w / 2;
    for (const it of this.items) {
      if (it.isHint ? !hintSolve : it.until <= Game.realTime) continue;
      if (it.isHint && !it.w) this.measureHint();
      const W = it.w + 8, H = it.h + 6, hw = W / 2, hh = H / 2;
      const nW = it.isHint ? (it.wn || it.w) + 8 : W, nH = it.isHint ? (it.hn || it.h) + 6 : H;
      let x = -1, y = -1, nar = false;
      if (!force && it.x >= 0) {                              // sticky (re-checked: the bar, boss or joystick may have moved)
        const sw = it.narrow ? nW / 2 : hw, sh = it.narrow ? nH / 2 : hh;
        if (this.fits(it.x, it.y, sw, sh, top0)) { x = it.x; y = it.y; nar = !!it.narrow; }
      }
      if (x < 0) {
        const band = top0 + hh;
        this._nc = 0;
        const pb = this._pb, pp = this._pp;
        if (it.isHint && !View.portrait) {                     // landscape phone: a top corner under the bar block
          this.cand(14 + hw - 4, band); this.cand(View.w - 14 - hw + 4, band);
        }
        if (it.id === 'phasetitle' && Letterbox.on) this.cand(cx, View.h - lb - hh - 10);       // cinematic lower third
        if (it.id === 'stamp' || it.id === 'countdown') this.cand(cx, View.h * it.base);
        this.cand(cx, band);
        if (it.isHint && pb.on && pp.on && pp.t - pb.b > H + 8) this.cand(cx, (pb.b + pp.t) * 0.5);   // between the boss's feet and the player's head
        if (it.isHint && View.portrait) {                     // portrait: the lower-left corner above the player panel (narrow shape)
          const pt = HUD.el.playerpanel ? this.hudPanelTop() : View.h - 90;
          this.cand(12 + nW / 2, pt - 8 - nH / 2, true);
        }
        if (pb.on) {
          const right = pb.r + 16 + hw, left = pb.l - 16 - hw;
          if (View.w - pb.r > pb.l) { this.cand(right, band); this.cand(left, band); } else { this.cand(left, band); this.cand(right, band); }
          this.cand(cx, pb.t - 6 - hh);
        }
        if (!it.isHint && ph.on) this.cand(cx, ph.b + 6 + hh);                                     // directly under the hint
        for (let yy = band + 14; yy < View.h * 0.62; yy += 14) this.cand(cx, yy);
        for (let k = 0; k < this._nc; k++) {
          const n = this._cn[k] === 1;
          if (this.fits(this._cx[k], this._cy[k], n ? nW / 2 : hw, n ? nH / 2 : hh, top0)) { x = this._cx[k]; y = this._cy[k]; nar = n; break; }
        }
        if (x < 0) {
          // nothing clear of the boss/player (small screens): never on another callout, the hint or the HUD; among
          // those spots cover as little of the boss, its pips and (much more costly) the player as possible
          let best = Infinity;
          for (let k = 0; k < this._nc; k++) {
            const cx_ = this._cx[k], cy_ = this._cy[k], n = this._cn[k] === 1, w2 = n ? nW / 2 : hw, h2 = n ? nH / 2 : hh;
            if (!this.clearOfUI(it, cx_, cy_, w2, h2, top0)) continue;
            const sc = this.ov(this._pb, cx_, cy_, w2, h2) + this.ov(this._pips, cx_, cy_, w2, h2) * 2 + 4 * this.ov(this._pp, cx_, cy_, w2, h2) + (cy_ - band) * 0.5;
            if (sc < best) { best = sc; x = cx_; y = cy_; nar = n; }
          }
          if (x < 0) for (let yy = band; yy < View.h * 0.8; yy += 14) {
            if (!this.clearOfUI(it, cx, yy, hw, hh, top0)) continue;
            const sc = this.ov(this._pb, cx, yy, hw, hh) + 4 * this.ov(this._pp, cx, yy, hw, hh) + (yy - band) * 0.5;
            if (sc < best) { best = sc; x = cx; y = yy; nar = false; }
          }
          if (x < 0) { x = cx; y = band; nar = false; }
        }
      }
      if (it.isHint && nar !== !!it.narrow) { it.narrow = nar; it.el.classList.toggle('narrow', nar); }
      if (x !== it.x || y !== it.y) { it.x = x; it.y = y; it.el.style.left = Math.round(x) + 'px'; it.el.style.top = Math.round(y) + 'px'; }
      const w2 = nar ? nW / 2 : hw, h2 = nar ? nH / 2 : hh;
      const r = it.rect; r.l = x - w2; r.r = x + w2; r.t = y - h2; r.b = y + h2; r.on = true;
      obs.push(r);
      if (it.isHint) { ph.l = r.l; ph.r = r.r; ph.t = r.t; ph.b = r.b; ph.on = true; }
    }
  },
  /** top of the player panel (cached with the other HUD rects) */
  hudPanelTop() { if (this._panelW !== View.w || this._panelH !== View.h) { this._panelW = View.w; this._panelH = View.h; this._panelTop = HUD.el.playerpanel.getBoundingClientRect().top; } return this._panelTop; },
};
