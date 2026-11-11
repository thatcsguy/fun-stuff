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
      const labels = Input.device === 'pad' ? SLOT_LABEL_PAD : SLOT_LABEL_KBM;
      b.innerHTML = `<div class="cn">${c.name}</div><div class="cr">${c.role}</div><div class="sk">` + c.skills.map((s, i) => !s ? '' : `<div class="ic">${svg(s.icon, c.color)}</div><div><kbd>${labels[i]}</kbd><b>${s.name}</b> ${s.desc}</div>`).join('') + '</div>';
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
    if (name === 'menu') buildMenu();
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
  function deviceChanged() {
    const labels = Input.device === 'pad' ? SLOT_LABEL_PAD : SLOT_LABEL_KBM;
    slots.forEach((s, i) => { if (s) s.key.textContent = labels[i]; });
    if (cur === 'menu') buildMenu();
  }
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
  function openSettings(from) { settingsFrom = from; $('#set-vol').value = Settings.vol; $('#set-mus').value = Settings.mus; $('#set-sens').value = Settings.sens; $('#set-psens').value = Settings.psens; $('#set-inv').checked = Settings.inv; $('#set-q').value = Settings.q; show('settings'); }
  $('#btn-settings').onclick = () => openSettings('menu');
  $('#btn-fs').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => { }); };
  for (const [id, key] of [['set-vol', 'vol'], ['set-mus', 'mus'], ['set-sens', 'sens'], ['set-psens', 'psens']]) $('#' + id).oninput = (e) => { Settings[key] = +e.target.value; saveSettings(); Sound.applyVolume(); };
  $('#set-inv').onchange = (e) => { Settings.inv = e.target.checked; saveSettings(); };
  $('#set-q').onchange = (e) => { Settings.q = e.target.value; saveSettings(); Post.setQuality(Settings.q); };

  // ---- gamepad / keyboard focus navigation ----
  function navItems() { return cur ? [...el[cur].querySelectorAll('.nav')].filter((n) => n.offsetParent !== null) : []; }
  function moveFocus(d, absolute) {
    const items = navItems(); if (!items.length) return; items.forEach((n) => n.classList.remove('focus'));
    focusI = absolute ? 0 : ((focusI < 0 ? 0 : focusI + d) + items.length) % items.length;
    if (cur === 'menu' && absolute) focusI = Math.min(items.length - 1, G.classes.length);
    items[focusI].classList.add('focus'); items[focusI].scrollIntoView({ block: 'nearest' }); Sound.sfx('ui');
  }
  Input.onNav = (dir) => {
    if (!cur) return;
    if (dir === 'ok') { const items = navItems(); if (items[focusI]) items[focusI].click(); else moveFocus(0, true); }
    else if (dir === 'back') { if (cur === 'settings') show(settingsFrom); else if (cur === 'pause') Game.pause(false); }
    else moveFocus(dir === 'up' || dir === 'left' ? -1 : 1);
  };
  Hooks.frame.push((rdt, stage) => { if (stage === 1) update(rdt); });
  return { el, show, fade, titleCard, hideCard, buildHud, deviceChanged, slotFlash, hurtFlash, selectedClass, fmtT, ROMAN, hud(on) { el.hud.classList.toggle('on', on); }, get screen() { return cur; } };
})();
