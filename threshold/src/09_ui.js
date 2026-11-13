// UI: menu, HUD, screens, settings, gamepad/keyboard menu navigation.
const UI = (() => {
  const el = { hud: $('#hud'), menu: $('#menu'), pause: $('#pause'), death: $('#death'), victory: $('#victory'), settings: $('#settings'), fade: $('#fade'), card: $('#title-card'), hurt: $('#hurtv'), hint: $('#hint'), dbg: $('#dbg') };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
  const svg = (name, color) => `<svg viewBox="0 0 24 24"><path d="${ICON[name]}" fill="${color}" fill-rule="evenodd"/></svg>`;
  const fmtT = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  let slots = [], cur = null, settingsFrom = 'menu', focusI = -1, hurtA = 0;
  const cache = {};
  const setTxt = (key, node, v) => { if (cache[key] !== v) { cache[key] = v; node.textContent = v; } };
  const setCls = (key, node, cls, on) => { if (cache[key] !== on) { cache[key] = on; node.classList.toggle(cls, on); } };
  const setSx = (key, node, v, axis = 'X') => { v = Math.round(v * 500) / 500; if (cache[key] !== v) { cache[key] = v; node.style.transform = `scale${axis}(${v})`; } };

  function selectedClass() { return G.classes.find((c) => c.id === Settings.cls) || G.classes[0]; }
  function buildMenu() {
    const cw = $('#classes'); cw.innerHTML = '';
    for (const c of G.classes) {
      const b = document.createElement('button'); b.className = 'cls nav' + (c === selectedClass() ? ' sel' : ''); b.style.setProperty('--c', c.color);
      const kb = (i) => { const l = Binds.slotLabel(i); return `<kbd${l.c ? ` style="color:${l.c}"` : ''}>${l.t || '·'}</kbd>`; };
      b.innerHTML = `<div class="cn">${c.name}</div><div class="cr">${c.role}</div><div class="sk">` + c.skills.map((s, i) => !s ? '' : `<div class="ic">${svg(s.icon, c.color)}</div><div>${kb(i)}<b>${s.name}</b> ${s.desc}</div>`).join('') + '</div>';
      b.onclick = () => { Settings.cls = c.id; saveSettings(); Sound.sfx('uiok'); buildMenu(); };
      cw.appendChild(b);
    }
    const dw = $('#doors'); dw.innerHTML = '';
    G.bosses.forEach((d, i) => {
      const b = document.createElement('button'); b.className = 'door nav'; b.style.setProperty('--c', d.color || '#e8c77a');
      const seen = Save.seen && Save.seen[d.id], kills = (Save.kills && Save.kills[d.id]) || {};
      const best = Object.values(kills).length ? Math.min(...Object.values(kills)) : 0;
      b.innerHTML = `<div class="rn">${ROMAN[i]}</div>${best ? `<div class="dk">✓ ${fmtT(best)}</div>` : ''}<div class="dn">${seen ? d.name : '? ? ?'}</div><div class="dh">${seen ? d.title : (d.hint || '')}</div>`;
      b.onclick = () => { Sound.resume(); Sound.sfx('uiok'); Game.start(d.id); };
      dw.appendChild(b);
    });
    focusI = -1;
  }
  function show(name) {
    for (const k of ['menu', 'pause', 'death', 'victory', 'settings']) el[k].classList.toggle('hidden', k !== name);
    cur = name || null; focusI = -1;
    if (Input.capture) Input.endCapture();
    if (name === 'menu') buildMenu();
    if (name === 'settings') refreshSettings();
    if (name && Input.device === 'pad') moveFocus(0, true);
  }
  function fade(on) { el.fade.classList.toggle('clear', !on); }
  function titleCard(num, name, sub, color) {
    el.card.querySelector('.tnum').textContent = num; el.card.querySelector('.nm').textContent = name; el.card.querySelector('.sub').textContent = sub || '';
    document.documentElement.style.setProperty('--accent', color || '#e8c77a'); el.card.classList.add('show');
  }
  function hideCard() { el.card.classList.remove('show'); }

  function buildHud() {
    const p = G.player, c = p.cls, hb = $('#hotbar'); hb.innerHTML = ''; slots = [];
    document.documentElement.style.setProperty('--cls', c.color);
    for (const k of Object.keys(cache)) delete cache[k];
    let sepDone = false;
    c.skills.forEach((s, i) => {
      if (!s) { slots.push(null); return; }
      const gs = i >= 3 && !sepDone; if (gs) sepDone = true;
      const d = document.createElement('div'); d.className = 'slot' + (gs ? ' gsep' : ''); d.title = s.name + ': ' + s.desc;
      d.innerHTML = `<span class="ico">${svg(s.icon, c.color)}</span><span class="key"></span><div class="cdm"></div><div class="cdt"></div><span class="chg"></span>`;
      d.onmousedown = (e) => { e.stopPropagation(); if (G.state === 'fight') p.press(i); };
      hb.appendChild(d); slots.push({ d, ico: d.querySelector('.ico'), key: d.querySelector('.key'), cdm: d.querySelector('.cdm'), cdt: d.querySelector('.cdt'), chg: d.querySelector('.chg'), flash: 0 });
    });
    deviceChanged();
    // class resource: pips (default), one bar (stamina), or the six chambers of a cylinder
    const pips = $('#pips'), kind = c.resource.kind || 'pips'; pips.innerHTML = ''; pips.className = kind;
    if (kind === 'bar') pips.innerHTML = '<div class="stam"><b></b><u></u></div>';
    else for (let i = 0; i < c.resource.max; i++) pips.appendChild(document.createElement('i'));
    const b = G.boss, bar = $('#bbar'); bar.querySelectorAll('.tick').forEach((t) => t.remove());
    for (const ph of b.def.phases) if (ph.at < 1) { const t = document.createElement('div'); t.className = 'tick'; t.style.left = (ph.at * 100) + '%'; bar.appendChild(t); }
    $('#bname').textContent = b.def.name;
  }
  // Called whenever the controller toggle, prompt style, connected pad or a binding changes: every on-screen button label follows.
  function deviceChanged() {
    document.body.classList.toggle('dev-pad', Input.device === 'pad');
    slots.forEach((s, i) => { if (s) { const l = Binds.slotLabel(i); s.key.textContent = l.t; s.key.style.color = l.c; } });
    const f = focusI;
    if (cur === 'menu') { buildMenu(); if (f >= 0) setFocus(f); }
    if (cur === 'settings') refreshSettings();
  }
  function padWoke() { if (cur && focusI < 0) moveFocus(0, true); }
  function castBar(key, node, cs) {
    const on = !!cs; setCls(key + 'on', node, 'on', on);
    if (!on) return; setCls(key + 'int', node, 'int', !!cs.int); setSx(key + 'f', node.firstElementChild, sat(cs.t / cs.time)); setTxt(key + 'n', node.lastElementChild, cs.name);
  }
  function update(rdt) {
    if (hurtA > 0) { hurtA = Math.max(0, hurtA - rdt * 1.6); el.hurt.style.opacity = hurtA.toFixed(2); }
    const p = G.player, b = G.boss; if (!p || !b || !el.hud.classList.contains('on')) return;
    setSx('bhp', $('#bbar .fill'), b.hp / b.maxHp); setSx('bhpl', $('#bbar .lag'), b.hp / b.maxHp);
    setTxt('bhpt', $('#bhp'), (b.hp / b.maxHp * 100).toFixed(1) + '%');
    castBar('bc', $('#bcast'), b.castState);
    const t = p.target, showT = t && t !== b && t.alive; setCls('tf', $('#tgtframe'), 'on', !!showT);
    if (showT) { setTxt('tn', $('#tname'), t.name); setSx('thp', $('#tbar .fill'), t.hp / t.maxHp); castBar('tc', $('#tcast'), t.castState); }
    if (b.def.enrage) { const left = Math.max(0, b.def.enrage - G.ft); setTxt('enr', $('#enrage'), fmtT(G.ft)); setCls('enrh', $('#enrage'), 'hot', left < 30); }
    setSx('php', $('#pbar .fill'), p.hp / p.maxHp); setCls('plow', $('#pbar'), 'low', p.hp / p.maxHp < 0.35);
    setTxt('phpt', $('#pbar .hpt'), Math.ceil(p.hp) + ' / ' + p.maxHp);
    const sh = Math.round(sat(p.shield / p.maxHp) * 100); if (cache.sh !== sh) { cache.sh = sh; $('#pbar .shield').style.width = sh + '%'; }
    const pw = $('#pips'), pips = pw.children, rk = p.cls.resource.kind || 'pips';
    if (rk === 'bar') { const st = pips[0]; setSx('stam', st.firstElementChild, sat(p.res / p.resMax)); setCls('wind', st, 'wind', !!p.winded); setCls('open', st, 'open', p.opening > 0); }
    else if (rk === 'cylinder') { const lw = p.armed ? 5 - p.streak : -1; for (let i = 0; i < pips.length; i++) { const v = (p.cyl[i] || '') + (i === 0 && p.cyl.length ? ' next' : '') + (i === lw ? ' lw' : ''); if (cache['ch' + i + 'c'] !== v) { cache['ch' + i + 'c'] = v; pips[i].className = v; } } }
    else for (let i = 0; i < pips.length; i++) setCls('pip' + i, pips[i], 'on', i < p.res);
    const pc = $('#pcast'), c = p.casting; if (cache.pcon !== !!c) { cache.pcon = !!c; pc.style.opacity = c ? 1 : 0; }
    if (c) { setSx('pcf', pc.firstElementChild, sat(c.t / c.time)); setTxt('pcn', pc.lastElementChild, c.name); }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]; if (!s) continue; const st = p.sk[i], d = st.def, why = p.block(i);
      let frac = 0, txt = '';
      if (st.charges <= 0 && st.cd > 0) { frac = st.cd / d.cd; txt = st.cd > 9.5 ? String(Math.ceil(st.cd)) : st.cd.toFixed(st.cd < 3 ? 1 : 0); }
      else if (d.gcd !== false && p.gcd > 0) frac = p.gcd / p.gcdMax;
      setSx('cd' + i, s.cdm, sat(frac), 'Y'); setTxt('ct' + i, s.cdt, txt);
      setCls('off' + i, s.d, 'off', why === 'res' || why === 'range' || why === 'target' || why === 'spent' || why === 'no' || /^[A-Z]/.test(why) || (st.charges <= 0));
      setTxt('ch' + i, s.chg, d.limited ? String(st.uses) : (d.charges > 1 ? String(st.charges) : ''));
      const rdy = (d.rdy && d.rdy(p)) || (d.interrupt && p.target && p.target.castState && p.target.castState.int && why === '');
      setCls('rdy' + i, s.d, 'rdy', !!rdy);
      setCls('act' + i, s.d, 'act', !!(d.act && d.act(p)));
      if (d.view) { const ic = d.view(p); if (cache['ic' + i] !== ic) { cache['ic' + i] = ic; s.ico.innerHTML = svg(ic, p.cls.color); } }
      if (s.flash > 0) { s.flash -= rdt; if (s.flash <= 0) s.d.classList.remove('press'); }
    }
    const bw = $('#buffs'), sig = p.buffs.map((q) => q.id).join(',');
    if (cache.buffs !== sig) { cache.buffs = sig; bw.innerHTML = p.buffs.map((q) => `<div class="bf">${svg(q.icon, p.cls.color)}<span></span></div>`).join(''); }
    for (let i = 0; i < p.buffs.length && i < bw.children.length; i++) setTxt('bft' + i + sig, bw.children[i].lastElementChild, p.buffs[i].t.toFixed(0));
    setCls('hint', el.hint, 'on', p.hintT > 0); if (p.hintT > 0) setTxt('hintt', el.hint, p.hint);
    if (G.debug) el.dbg.textContent = `t ${G.ft.toFixed(1)}  phase ${b.phase}  boss ${Math.round(b.hp)}  dps ${(p.stats.dmg / Math.max(1, G.ft)).toFixed(0)}  hz ${Hz.list.length} bul ${Bul.list.length} co ${Co.list.length}\n${G.errors.slice(-3).join('\n')}`;
  }
  function slotFlash(i) { const s = slots[i]; if (s) { s.flash = 0.1; s.d.classList.add('press'); } }
  function hurtFlash(frac) { hurtA = Math.min(1, hurtA + 0.25 + frac * 1.6); }

  // ---- screen buttons ----
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return; Sound.sfx('uiok');
    const a = b.dataset.act;
    if (a === 'resume') Game.pause(false); else if (a === 'restart') Game.restart(); else if (a === 'quit') Game.quit();
    else if (a === 'settings') openSettings('pause'); else if (a === 'back') show(settingsFrom);
  });
  // ---- settings: general options, the controller toggle, and the binding table for the current device ----
  const RANGE = { vol: [0, 100, 5], mus: [0, 100, 5], sens: [10, 300, 10], psens: [10, 300, 10] };
  const segOf = (k) => $('#set-' + k);
  function segSet(k, v) { for (const n of segOf(k).children) n.classList.toggle('on', n.dataset.v === String(v)); }
  function openSettings(from) { settingsFrom = from; show('settings'); }
  function refreshSettings() {
    for (const k in RANGE) { const n = $('#set-' + k); n.value = Settings[k]; n.nextElementSibling.textContent = Settings[k]; }
    segSet('inv', Settings.inv ? 1 : 0); segSet('q', Settings.q); segSet('pad', Settings.pad ? 1 : 0); segSet('glyphs', Settings.glyphs || 'auto');
    buildBinds();
    const items = navItems(); if (focusI >= items.length) focusI = items.length - 1; if (focusI >= 0 && items[focusI]) items[focusI].classList.add('focus');
  }
  function setOpt(k, v) {
    if (k in RANGE) { const [lo, hi] = RANGE[k]; Settings[k] = clamp(Math.round(+v), lo, hi); Sound.applyVolume(); }
    else if (k === 'inv') Settings.inv = String(v) === '1';
    else if (k === 'q') { Settings.q = v; Post.setQuality(v); }
    else if (k === 'pad') { Input.setPad(String(v) === '1'); refreshSettings(); return; }
    else if (k === 'glyphs') Settings.glyphs = v;
    saveSettings(); if (k === 'glyphs') deviceChanged(); else refreshSettings();
  }
  function adjust(k, d) { // left / right on a focused row
    if (k in RANGE) { setOpt(k, Settings[k] + d * RANGE[k][2]); Sound.sfx('ui'); return; }
    const vals = [...segOf(k).children].map((n) => n.dataset.v), on = segOf(k).querySelector('.on');
    const i = on ? vals.indexOf(on.dataset.v) : 0, j = d === 0 ? (i + 1) % vals.length : clamp(i + d, 0, vals.length - 1);
    if (j !== i) { setOpt(k, vals[j]); Sound.sfx('ui'); }
  }
  for (const k in RANGE) $('#set-' + k).oninput = (e) => setOpt(k, e.target.value);
  $('#settings .set-wrap').addEventListener('click', (e) => {
    const sv = e.target.closest('.seg span'), row = e.target.closest('.srow');
    if (sv) { setOpt(row.dataset.adj, sv.dataset.v); Sound.sfx('uiok'); }
    else if (row && !e.target.closest('input') && !(row.dataset.adj in RANGE)) adjust(row.dataset.adj, 0);
  });
  function padLabel() {
    const gp = Input.padId ? Input.pickPad() : null; if (!gp) return 'No controller found. Press a button on it.';
    return gp.id.replace(/\s*\(.*$/, '').slice(0, 48) + (gp.mapping === 'standard' ? '' : ' (unusual layout: rebind anything that feels wrong)');
  }
  function bindCell(dev, id, i) {
    const c = Input.capture, waiting = c && c.dev === dev && c.id === id && c.idx === i;
    const v = dev === 'pad' ? Binds.get('pad', id) : Binds.get('kbm', id)[i];
    const t = waiting ? (dev === 'pad' ? 'press a button' : 'press a key') : (dev === 'pad' ? Binds.padName(v) : Binds.keyName(v)) || '—';
    const col = !waiting && dev === 'pad' ? Binds.padColor(v) : '';
    return `<button class="bk nav${waiting ? ' wait' : ''}${col ? ' face' : ''}${!waiting && (v === null || v === undefined) ? ' empty' : ''}" data-id="${id}" data-i="${i}" data-col="${i}"${col ? ` style="color:${col}"` : ''}>${t}</button>`;
  }
  function buildBinds() {
    const dev = Input.device, pad = dev === 'pad', w = $('#binds'), cls = selectedClass(), c = Input.capture;
    w.className = pad ? 'pad' : '';
    let h = '', grp = '';
    for (const a of Binds.acts(dev)) {
      const g = a.kbmOnly ? 'Movement' : a.slot !== undefined ? 'Skills' : 'Other';
      if (g !== grp) { grp = g; h += `<div class="bh grp">${g}</div>`; }
      const sk = a.slot !== undefined && cls.skills[a.slot];
      h += `<div class="bn">${a.slot !== undefined ? 'Skill ' + (a.slot + 1) + (sk ? `<small>${sk.name}</small>` : '') : a.name}</div>`;
      h += pad ? bindCell('pad', a.id, 0) : bindCell('kbm', a.id, 0) + bindCell('kbm', a.id, 1);
    }
    w.innerHTML = h;
    const k = (t) => `<kbd>${t}</kbd>`, P = (b) => Binds.padName(b);
    const fixed = pad ? [['Move', 'Left stick'], ['Camera', 'Right stick'], ['Pause', P(9)], ['Menus: confirm / back', P(0) + ' / ' + P(1)]]
      : [['Turn camera', 'Hold left mouse'], ['Turn camera and character', 'Hold right mouse'], ['Run forward', 'Both mouse buttons'], ['Zoom', 'Wheel'], ['Pick a target', 'Click it'], ['Pause', 'Esc']];
    $('#bind-fixed').innerHTML = fixed.map(([a, b]) => `<span>${a}</span>${k(b)}`).join('');
    $('#bind-hint').innerHTML = !c ? '' : c.dev === 'pad' ? `${k(P(9))} cancels` : `${k('Esc')} cancels &nbsp;${k('Backspace')} clears`;
    $('#bind-reset').classList.toggle('hidden', !!c);
    $('#padstat').textContent = pad ? padLabel() : '';
    $('#bind-reset').textContent = pad ? 'Reset buttons' : 'Reset keys';
  }
  $('#binds').addEventListener('click', (e) => {
    const b = e.target.closest('.bk'); if (!b) return;
    const c = Input.capture, dev = Input.device, id = b.dataset.id, i = +b.dataset.i;
    if (c && c.id === id && c.idx === i) { Input.endCapture(); return; }
    Input.beginCapture(dev, id, i); Sound.sfx('uiok'); buildBinds(); focusCell(id, i);
  });
  $('#bind-reset').onclick = () => { Binds.reset(Input.device); Sound.sfx('uiok'); deviceChanged(); };
  function focusCell(id, i) { const items = navItems(), j = items.findIndex((n) => n.dataset.id === id && +n.dataset.i === i); if (j >= 0 && (focusI >= 0 || Input.device === 'pad')) setFocus(j, true); }
  Input.onCapture = (c, value, swapped) => {
    deviceChanged(); focusCell(c.id, c.idx); Sound.sfx(value === undefined ? 'ui' : 'uiok');
    if (swapped) for (const n of $('#binds').querySelectorAll(`.bk[data-id="${swapped}"]`)) { n.classList.add('swap'); setTimeout(() => n.classList.remove('swap'), 1400); }
  };
  $('#btn-settings').onclick = () => openSettings('menu');
  $('#btn-fs').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => { }); };
  // buttons and sliders never keep browser focus, so Space / Enter in a fight cannot press a menu button again
  document.addEventListener('click', () => { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); });

  // ---- gamepad / keyboard focus navigation ----
  function navItems() { return cur ? [...el[cur].querySelectorAll('.nav')].filter((n) => n.offsetParent !== null) : []; }
  function setFocus(i, quiet) {
    const items = navItems(); if (!items.length) return; items.forEach((n) => n.classList.remove('focus'));
    focusI = clamp(i, 0, items.length - 1); items[focusI].classList.add('focus'); items[focusI].scrollIntoView({ block: 'nearest' }); if (!quiet) Sound.sfx('ui');
  }
  function moveFocus(d, absolute) {
    const items = navItems(); if (!items.length) return;
    let i = absolute ? 0 : ((focusI < 0 ? 0 : focusI + d) + items.length) % items.length;
    if (cur === 'menu' && absolute) i = Math.min(items.length - 1, G.classes.length);
    // in the binding table, up / down stay in the same column
    const f = items[focusI];
    if (!absolute && f && f.dataset.col !== undefined && Input.device === 'kbm') {
      for (let j = focusI + d; j >= 0 && j < items.length; j += d) { const n = items[j]; if (n.dataset.col === undefined || n.dataset.col === f.dataset.col) { i = j; break; } }
    }
    setFocus(i, absolute);
  }
  Input.onNav = (dir) => {
    if (!cur || Input.capture) return;
    const items = navItems(), f = items[focusI];
    if (dir === 'ok') { if (f) f.click(); else moveFocus(0, true); }
    else if (dir === 'back') { if (cur === 'settings') show(settingsFrom); else if (cur === 'pause') Game.pause(false); }
    else if ((dir === 'left' || dir === 'right') && f && f.dataset.adj) adjust(f.dataset.adj, dir === 'left' ? -1 : 1);
    else if ((dir === 'left' || dir === 'right') && f && f.dataset.col !== undefined) { if (Input.device === 'kbm' && f.dataset.col === (dir === 'left' ? '1' : '0')) setFocus(focusI + (dir === 'left' ? -1 : 1)); }
    else moveFocus(dir === 'up' || dir === 'left' ? -1 : 1);
  };
  document.body.classList.toggle('dev-pad', Input.device === 'pad');
  Hooks.frame.push((rdt, stage) => { if (stage === 1) update(rdt); });
  return { el, show, fade, titleCard, hideCard, buildHud, deviceChanged, padWoke, slotFlash, hurtFlash, selectedClass, fmtT, ROMAN, hud(on) { el.hud.classList.toggle('on', on); }, get screen() { return cur; } };
})();
