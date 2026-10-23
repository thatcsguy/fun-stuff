// =====================================================================
// 08_ui.js: all DOM. Settings (G.settings), screens, HUD binding, touch
// controls (pointer events -> G.input), fullscreen, results, best times.
// =====================================================================
(() => {
  const $ = (id) => document.getElementById(id);
  const logE = (w, e) => { try { G.log.error(w, e); } catch (_) { console.error(w, e); } };
  const sfx = (n, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(n, o); } catch (e) { } };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const PLACEHOLDER = [
    { name: 'GNOMON', title: 'the Brass Warden', accent: '#5fe3ff', blurb: 'A sundial knight. Learn every verb.' },
    { name: 'OUROS', title: 'the Aurora Coil', accent: '#3dffa2', blurb: 'A serpent of brass and aurora. Each phase transforms the sky.' },
    { name: 'HELIARCH', title: 'the Dying Sun', accent: '#a77bff', blurb: 'The rings themselves become the enemy.' },
  ];

  // ---------------------------------------------------------- settings
  const DEF = { master: 0.85, music: 0.55, sfx: 0.85, quality: 'auto', shake: true, ghost: true, numbers: true, haptics: true };
  const settings = { ...DEF };
  try { const s = JSON.parse(localStorage.getItem('ph_settings') || 'null'); if (s && typeof s === 'object') Object.assign(settings, s); } catch (e) { /* storage blocked */ }
  G.settings = settings;
  function saveSettings() { try { localStorage.setItem('ph_settings', JSON.stringify(settings)); } catch (e) { } }
  function applySettings(first) {
    try { G.audio && G.audio.volumes && G.audio.volumes({ master: settings.master, music: settings.music, sfx: settings.sfx }); } catch (e) { logE('ui.volumes', e); }
    try { if (G.quality && G.quality.set && !(first && G.params && G.params.quality && G.params.quality !== 'auto')) G.quality.set(settings.quality || 'auto'); } catch (e) { logE('ui.quality', e); }
    if (G.cam) G.cam.shakeEnabled = settings.shake !== false;
    if (G.fx) G.fx.showNumbers = settings.numbers !== false;
    G.emit && G.emit('settings', { ...settings });
  }
  const vibrate = (ms) => { if (settings.haptics === false || !navigator.vibrate) return; try { navigator.vibrate(ms); } catch (e) { } };

  // ---------------------------------------------------------- best times
  const loadBest = () => { try { return JSON.parse(localStorage.getItem('ph_best') || '{}') || {}; } catch (e) { return {}; } };
  const saveBest = (b) => { try { localStorage.setItem('ph_best', JSON.stringify(b)); } catch (e) { } };
  const fmt = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); };
  const fmtMs = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = (t % 60); return m + ':' + s.toFixed(1).padStart(4, '0'); };

  // ---------------------------------------------------------- screens
  const SCR = ['scrTitle', 'scrSelect', 'scrHow', 'scrSettings', 'scrPause', 'scrIntro', 'scrDefeat', 'scrVictory'];
  let settingsReturn = 'scrTitle';
  function show(id) { const el = $(id); if (!el) return; el.classList.remove('hidden', 'fade'); }
  function hide(id) { const el = $(id); if (el) el.classList.add('hidden'); }
  function only(id) { for (const s of SCR) if (s !== id) hide(s); if (id) show(id); $('fsTop').classList.toggle('hidden', !(id === 'scrTitle' || id === 'scrSelect' || id === 'scrHow')); }
  function toast(msg, dur = 2.2) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), dur * 1000);
  }

  // ---------------------------------------------------------- fullscreen
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const fsAvail = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  function toggleFs() {
    sfx('uiClick');
    try {
      if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      if (fsAvail()) {
        const de = document.documentElement;
        const p = de.requestFullscreen ? de.requestFullscreen({ navigationUI: 'hide' }) : de.webkitRequestFullscreen();
        if (p && p.then) p.then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => fsHint());
        return;
      }
    } catch (e) { /* fall through */ }
    fsHint();
  }
  function fsHint() {
    const h = $('fsHint');
    const standalone = window.navigator.standalone || (matchMedia && matchMedia('(display-mode: standalone)').matches);
    h.textContent = standalone ? 'Already running full screen from the Home Screen' : (G.isIOS ? 'Use Share › Add to Home Screen for full screen' : 'Full screen is not available in this browser');
    h.classList.add('on'); clearTimeout(fsHint.h); fsHint.h = setTimeout(() => h.classList.remove('on'), 3800);
  }

  // ---------------------------------------------------------- fight flow wrappers
  let lastBoss = 0;
  function startBoss(i, opts = {}) {
    let idx = i;
    if (!G.bosses[idx]) {
      if (G.bosses.test && G.params && G.params.debug) idx = 'test';
      else { toast((PLACEHOLDER[i] || {}).name + ' is still being forged'); return false; }
    }
    only(null);
    lastBoss = i;
    const ok = G.combat && G.combat.startFight && G.combat.startFight(idx, opts);
    if (!ok) { only('scrTitle'); toast('Could not start the fight'); }
    return ok;
  }
  function startPractice() { only(null); G.combat && G.combat.startFight('practice', { practice: true }); }
  function toMenu() {
    try { if (G.state === 'paused') G.core.pause(false); } catch (e) { }
    try { G.combat && G.combat.quit && G.combat.quit(); } catch (e) { logE('ui.quit', e); }
    if (G.state !== 'menu') { try { G.setState ? G.setState('menu') : (G.state = 'menu'); } catch (e) { } }
    hud(false);
    only('scrTitle');
    refreshCards();
  }
  function pause(on) {
    if (on) {
      if (!G.core || !G.core.pause) return;
      if (!G.core.pause(true)) return;
      try { G.input && G.input.releaseAll && G.input.releaseAll('pause'); } catch (e) { }
      const c = G.combat;
      $('pauseSub').textContent = c && c.def ? (c.practice ? 'Practice' : c.def.name + ', ' + (c.def.phases[c.boss ? c.boss.phase : 0] || {}).name) : '';
      $('bPRetry').classList.toggle('hidden', !!(c && (c.practice || !c.boss || c.boss.phase === 0)));
      only('scrPause');
      sfx('uiBack');
    } else {
      if (G.state !== 'paused') return;
      only(null);
      G.core.pause(false);
      sfx('uiConfirm');
    }
  }

  // ---------------------------------------------------------- HUD state
  let hudOn = false;
  function hud(on) {
    hudOn = on;
    $('hud').classList.toggle('on', on);
    $('controls').classList.toggle('on', on);
  }
  const H = { bossF: 1, bossChunk: 1, hpF: 1, hpChunk: 1, chunkHold: 0, hpHold: 0, sayT: 0, bannerT: 0, beginT: 0, castFlashT: 0, lastCast: null };
  let ticksFor = null;
  function setupBossBar() {
    const c = G.combat, def = c && c.def; if (!def) return;
    $('bossNameN').textContent = def.name || 'BOSS';
    $('bossNameT').textContent = def.title || '';
    const t = $('bossTicks'); t.innerHTML = '';
    if (!def.infinite) for (let i = 1; i < def.phases.length; i++) { const d = document.createElement('div'); d.className = 'tick'; d.style.left = (def.phases[i].hpStart * 100) + '%'; t.appendChild(d); }
    ticksFor = def;
    document.documentElement.style.setProperty('--accent', def.accent || '#5fe3ff');
    $('ui').style.setProperty('--accent', def.accent || '#5fe3ff');
    H.bossF = H.bossChunk = c.boss ? c.boss.hp / c.boss.maxHp : 1;
    $('hud').classList.toggle('practice', !!c.practice);
    $('timer').classList.toggle('ckpt', !!c.checkpointUsed);
  }
  const SK = {};
  function cdFrac(t, dur) { return dur > 0 ? clamp(t / dur, 0, 1) : 0; }
  function setSkill(el, frac, txt) {
    el.style.setProperty('--cd', frac.toFixed(3));
    const cdt = el.querySelector('.cdt'); if (cdt) { const s = txt || ''; if (cdt._t !== s) { cdt._t = s; cdt.textContent = s; } }
    el.classList.toggle('cool', frac > 0.001);
  }
  function updateHud(rdt) {
    const c = G.combat, b = c && c.boss, P = G.player && G.player.state, CD = G.player && G.player.cooldowns;
    if (!c || !c.def || !P) return;
    if (ticksFor !== c.def) setupBossBar();
    // timer
    const ft = c.fightTime || 0;
    const tt = $('timerT'); const ts = fmt(ft); if (tt._t !== ts) { tt._t = ts; tt.textContent = ts; }
    $('timer').querySelector('i').style.setProperty('--rot', ((ft % 60) * 6) + 'deg');
    // boss bar
    if (b) {
      const f = c.def.infinite ? 1 : clamp(b.hp / b.maxHp, 0, 1);
      H.bossF = f;
      if (f < H.bossChunk) { H.chunkHold -= rdt; if (H.chunkHold <= 0) H.bossChunk = Math.max(f, H.bossChunk - rdt * 0.25); } else { H.bossChunk = f; H.chunkHold = 0.5; }
      if (f < H.bossChunk - 0.0005 && H.chunkHold > 0.45) H.chunkHold = 0.5;
      $('bossFill').style.transform = 'scaleX(' + f.toFixed(4) + ')';
      $('bossChunk').style.transform = 'scaleX(' + H.bossChunk.toFixed(4) + ')';
      const pct = c.def.infinite ? '∞' : (f * 100).toFixed(f < 0.1 ? 1 : 0) + '%';
      const pe = $('bossPct'); if (pe._t !== pct) { pe._t = pct; pe.textContent = pct; }
      $('bossBar').classList.toggle('stag', !!b.staggered);
      $('bossBar').classList.toggle('immune', !!(b.invulnerable || c.transitioning));
      // cast
      const cw = $('castWrap');
      if (b.casting) {
        const cs = b.casting;
        if (H.lastCast !== cs) { H.lastCast = cs; $('castName').textContent = cs.name; }
        cw.classList.add('on'); cw.classList.toggle('int', !!cs.interruptible);
        $('castFill').style.transform = 'scaleX(' + (cs.progress || 0).toFixed(3) + ')';
        H.castFlashT = 0;
      } else if (H.castFlashT > 0) { H.castFlashT -= rdt; if (H.castFlashT <= 0) cw.classList.remove('on', 'int'); }
      else { cw.classList.remove('on', 'int'); H.lastCast = null; }
      $('chips').classList.toggle('cast', cw.classList.contains('on'));
    }
    // chips
    $('chipBehind').classList.toggle('on', !!P.behind && !!(b && b.alive));
    $('chipConst').classList.toggle('on', !!P.constellation);
    $('chipEmp').classList.toggle('on', !!P.empowered);
    $('chipStag').classList.toggle('on', !!(b && b.staggered));
    // player
    const hf = clamp(P.hp / P.maxHp, 0, 1);
    if (hf < H.hpChunk) { H.hpHold -= rdt; if (H.hpHold <= 0) H.hpChunk = Math.max(hf, H.hpChunk - rdt * 0.5); } else { H.hpChunk = hf; H.hpHold = 0.45; }
    $('hpFill').style.transform = 'scaleX(' + hf.toFixed(4) + ')';
    $('hpChunk').style.transform = 'scaleX(' + H.hpChunk.toFixed(4) + ')';
    const hpS = c.practice ? '∞' : String(Math.ceil(P.hp)); const he = $('hpText'); if (he._t !== hpS) { he._t = hpS; he.textContent = hpS; }
    $('hpBar').classList.toggle('low', hf < 0.3);
    const mf = clamp(P.meter / 100, 0, 1);
    $('novaFill').style.transform = 'scaleX(' + mf.toFixed(4) + ')';
    $('novaBar').classList.toggle('full', mf >= 1);
    const nl = mf >= 1 ? (G.isTouch ? 'SUPERNOVA READY' : 'SUPERNOVA READY · R') : P.novaActive ? 'SUPERNOVA' : '';
    const ne = $('novaLab'); if (ne._t !== nl) { ne._t = nl; ne.textContent = nl; }
    // skills
    if (CD) {
      const a = CD.anchor;
      setSkill(SK.anchor, a.charges > 0 ? 0 : cdFrac(a.t, a.dur), a.charges > 0 ? '' : Math.ceil(a.t) + '');
      SK.anchor.querySelectorAll('.pips i').forEach((p, i) => p.classList.toggle('on', i < a.charges));
      SK.anchor.style.setProperty('--cd', (a.charges > 0 ? (a.charges < a.max ? cdFrac(a.t, a.dur) * 0.35 : 0) : cdFrac(a.t, a.dur)).toFixed(3));
      const cm = CD.comet;
      setSkill(SK.comet, cdFrac(cm.t, cm.dur), cm.t > 0 ? Math.ceil(cm.t) + '' : '');
      SK.comet.style.setProperty('--ch', (cm.charge || 0).toFixed(3));
      SK.comet.classList.toggle('holding', !!cm.holding);
      SK.comet.classList.toggle('behind', !!cm.holding && !!P.behind);
      setSkill(SK.eclipse, cdFrac(CD.eclipse.t, CD.eclipse.dur), CD.eclipse.t > 0 ? Math.ceil(CD.eclipse.t) + '' : '');
      setSkill(SK.aegis, cdFrac(CD.aegis.t, CD.aegis.dur), CD.aegis.t > 0 ? Math.ceil(CD.aegis.t) + '' : '');
      SK.nova.style.setProperty('--m', mf.toFixed(3));
      SK.nova.classList.toggle('ready', mf >= 1);
      for (const k of ['anchor', 'comet', 'aegis', 'nova']) SK[k].classList.toggle('emp-on', !!P.empowered);
      // ready flashes
      for (const k of ['comet', 'eclipse', 'aegis']) {
        const on = CD[k].t <= 0; const el = SK[k];
        if (on && el._was === false) { el.classList.remove('ready-flash'); void el.offsetWidth; el.classList.add('ready-flash'); }
        el._was = on;
      }
    }
    $('tReverse').classList.toggle('ccw', P.dir > 0);
    // practice DPS
    if (c.practice) { const d = (c.dps ? c.dps() : 0); const s = 'DPS ' + Math.round(d); const el = $('practiceDps'); if (el._t !== s) { el._t = s; el.textContent = s; } }
    // banners
    if (H.sayT > 0) { H.sayT -= rdt; if (H.sayT <= 0) $('say').classList.remove('on'); }
    if (H.bannerT > 0) { H.bannerT -= rdt; if (H.bannerT <= 0) $('phaseBanner').classList.remove('on'); }
    if (H.beginT > 0) { H.beginT -= rdt; if (H.beginT <= 0) $('beginFlash').classList.remove('on'); }
  }

  // ---------------------------------------------------------- results
  function showDefeat(d) {
    const c = G.combat, b = c.boss, def = c.def || {};
    const st = (G.player && G.player.stats) || {};
    $('defSub').textContent = (def.name || '') + (def.title ? ', ' + def.title : '');
    const ph = (def.phases && def.phases[d.phase != null ? d.phase : (b ? b.phase : 0)]) || {};
    const rows = [
      ['Phase', (ROMAN[(d.phase || 0)] || '') + ' · ' + (ph.name || '')],
      ['Boss health', b ? Math.max(0, b.hp / b.maxHp * 100).toFixed(1) + '%' : '-'],
      ['Time', fmt(c.fightTime)],
      ['Hits taken', st.hitsTaken || 0],
    ];
    $('defGrid').innerHTML = rows.map(r => `<span>${r[0]}</span><b>${r[1]}</b>`).join('');
    $('bRetryPhase').classList.toggle('hidden', !((d.phase || 0) > 0));
    setTimeout(() => { if (G.state === 'dead') { only('scrDefeat'); } }, 350);
  }
  const SKILL_NAMES = { strike: 'Strike', anchor: 'Anchor', comet: 'Comet', aegis: 'Aegis', nova: 'Supernova' };
  function showVictory(r) {
    if (!r) return;
    const best = loadBest(); const key = String(r.bossIndex);
    const prev = best[key];
    const newBest = !prev || r.time < prev.time;
    if (typeof r.bossIndex === 'number' && r.bossIndex >= 0) {
      if (newBest) best[key] = { time: r.time, grade: r.grade, checkpoint: r.checkpoint };
      else best[key].cleared = true;
      best[key].cleared = true;
      saveBest(best);
    }
    $('vicSub').textContent = (r.name || '') + (r.title ? ', ' + r.title : '') + ' falls';
    $('vicGrade').textContent = r.grade;
    $('vicBest').innerHTML = newBest ? '<span class="newBest">NEW BEST TIME</span>' : (prev ? `<span style="font:12px var(--sans);color:#cdb98a">Best ${fmtMs(prev.time)}</span>` : '');
    const rows = [
      ['Time', fmtMs(r.time)], ['Damage taken', r.damageTaken], ['Hits taken', r.hitsTaken], ['Perfect Aegis', r.perfectAegis],
      ['Interrupts', r.interrupts], ['Checkpoint used', r.checkpoint ? 'Yes (' + r.deaths + ' fall' + (r.deaths === 1 ? '' : 's') + ')' : 'No'],
    ];
    $('vicGrid').innerHTML = rows.map(x => `<span>${x[0]}</span><b>${x[1]}</b>`).join('');
    const dm = r.damageBySkill || {}; const tot = Object.values(dm).reduce((a, b) => a + b, 0) || 1;
    const order = ['strike', 'anchor', 'comet', 'aegis', 'nova'].filter(k => dm[k]);
    for (const k of Object.keys(dm)) if (!order.includes(k)) order.push(k);
    $('vicBk').innerHTML = order.map(k => `<div class="r"><span>${(SKILL_NAMES[k] || k).toUpperCase()}</span><i style="width:${(dm[k] / tot * 100).toFixed(1)}%"></i><b>${Math.round(dm[k] / tot * 100)}%</b></div>`).join('');
    const nextOk = typeof r.bossIndex === 'number' && r.bossIndex < 2;
    $('bNext').classList.toggle('hidden', !nextOk);
    setTimeout(() => { if (G.state === 'victory') only('scrVictory'); }, 250);
  }

  // ---------------------------------------------------------- boss select
  const GLYPHS = [
    '<svg viewBox="-20 -20 40 40" class="glyph"><g fill="none" stroke="currentColor" stroke-width="1.4"><circle r="15"/><path d="M0 -15V12M-6 12H6"/><path d="M0 -8 L9 6" stroke-width="2.4"/></g></svg>',
    '<svg viewBox="-20 -20 40 40" class="glyph"><g fill="none" stroke="currentColor" stroke-width="1.6"><path d="M-14 6 Q-8 -10 0 0 T14 -6"/><path d="M-14 12 Q-8 -4 0 6 T14 0" opacity=".6"/><circle cx="14" cy="-6" r="2.4" fill="currentColor"/></g></svg>',
    '<svg viewBox="-20 -20 40 40" class="glyph"><g fill="none" stroke="currentColor" stroke-width="1.4"><circle r="8" fill="currentColor" fill-opacity=".25"/><circle r="14" stroke-dasharray="2 3"/><path d="M0 -19V-15M0 15V19M-19 0H-15M15 0H19"/></g></svg>',
  ];
  function refreshCards() {
    const best = loadBest();
    const el = $('cards'); el.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const def = G.bosses[i] || PLACEHOLDER[i];
      const ph = PLACEHOLDER[i];
      const b = best[String(i)];
      const card = document.createElement('button');
      card.className = 'card' + (b && b.cleared ? ' cleared' : '');
      card.style.setProperty('--c', def.accent || ph.accent);
      card.innerHTML = `<div class="num">BOSS ${ROMAN[i]}</div><div class="nm eng">${def.name || ph.name}</div><div class="ti">${def.title || ph.title}</div>
        <div class="sw"><i></i>${(def.phases ? def.phases.length : (i === 0 ? 3 : i === 1 ? 4 : 4))} PHASES</div>
        <div class="best">${b ? 'Best ' + fmtMs(b.time) + ' · ' + (b.grade || '') : (G.bosses[i] ? '' : '<span style="opacity:.6">Being forged</span>')}</div>
        <span class="clr">CLEARED</span><span style="color:${def.accent || ph.accent}">${GLYPHS[i]}</span>`;
      card.addEventListener('click', () => { sfx('uiConfirm'); startBoss(i); });
      el.appendChild(card);
    }
  }

  // ---------------------------------------------------------- how to play
  const SV = (inner) => `<svg viewBox="0 0 200 76">${inner}</svg>`;
  const RINGS3 = '<g fill="none" stroke="#b8893a" stroke-width="1.2" opacity=".7"><ellipse cx="100" cy="40" rx="30" ry="13"/><ellipse cx="100" cy="40" rx="55" ry="23"/><ellipse cx="100" cy="40" rx="80" ry="33"/></g><circle cx="100" cy="36" r="6" fill="#5fe3ff" opacity=".7"/>';
  const KN = (x, y, c = '#ffc94d') => `<g transform="translate(${x},${y})"><circle r="4.5" fill="${c}"/><circle r="8" fill="none" stroke="${c}" stroke-width="1" opacity=".6"/></g>`;
  const HOW = [
    { h: 'ORBIT', k: '', p: 'You always run around the boss on one of three brass rings. You never steer: you choose when to turn and when to hop.', s: RINGS3 + KN(100, 63) + '<path d="M120 62 Q140 58 150 52" stroke="#ffc94d" stroke-width="2" fill="none" stroke-dasharray="3 3"/><path d="M146 49 L152 51 L148 56" fill="none" stroke="#ffc94d" stroke-width="2"/>' },
    { h: 'REVERSE', k: 'A / D', p: 'Flip between clockwise and counter-clockwise. A short skid, then you run the other way. Dodges sweeps and lets you wait for gaps.', s: RINGS3 + KN(100, 63) + '<path d="M118 62 Q132 60 136 56" stroke="#ffc94d" stroke-width="2" fill="none"/><path d="M82 62 Q68 60 64 56" stroke="#fff1c2" stroke-width="2.4" fill="none"/><path d="M68 52 L62 56 L68 60" fill="none" stroke="#fff1c2" stroke-width="2.4"/>' },
    { h: 'SHIFT', k: 'W / S', p: 'Hop one ring in or out. A tiny window mid-hop is invulnerable. Inner ring hits harder (x1.35), outer is safer (x0.75).', s: RINGS3 + KN(100, 63) + '<path d="M100 58 Q96 52 100 47" stroke="#fff1c2" stroke-width="2.2" fill="none"/><path d="M96 49 L100 45 L104 49" fill="none" stroke="#fff1c2" stroke-width="2.2"/>' + KN(100, 63 - 10, '#fff1c2').replace('r="4.5"', 'r="3"') },
    { h: 'GHOST TRAIL', k: '', p: 'Gold dots show where you will be in 1.5 s. Dots turn the boss colour where that spot will be dangerous. Gold ghosts on other rings are safe.', s: RINGS3 + KN(70, 59) + '<g fill="#ffc94d">' + [0, 1, 2, 3].map(i => `<circle cx="${82 + i * 9}" cy="${62 - i * 0.4}" r="2"/>`).join('') + '</g><g fill="#5fe3ff">' + [4, 5, 6].map(i => `<circle cx="${82 + i * 9}" cy="${62 - i * 0.6}" r="2.4"/>`).join('') + '</g><path d="M115 52 L150 52 L150 70 L115 70Z" fill="#5fe3ff" opacity=".18"/>' },
    { h: 'BEHIND', k: '', p: 'The boss\'s back is its weak point: x1.5 damage inside the gold rear arc. The HUD shows BEHIND while it holds.', s: RINGS3 + '<path d="M100 36 L76 14 A40 22 0 0 1 124 14 Z" fill="#ffc94d" opacity=".22"/>' + KN(100, 10) + '<circle cx="100" cy="36" r="6" fill="#5fe3ff"/><path d="M100 42 L100 60" stroke="#5fe3ff" stroke-width="1.5" stroke-dasharray="2 2"/>' },
    { h: 'STRIKE', k: 'AUTO', p: 'Every 0.45 s you throw a starlight bolt at the nearest add ahead of you on your ring, otherwise at the boss.', s: RINGS3 + KN(60, 58) + '<path d="M64 54 Q80 30 96 36" stroke="#fff1c2" stroke-width="2" fill="none" stroke-dasharray="1 4"/><circle cx="92" cy="35" r="3" fill="#fff1c2"/>' },
    { h: 'ANCHOR', k: 'Q', p: 'Plant a star-anchor where you stand (2 charges, max 3). Running back over it pulses damage and heals 5. It is your only healing. Three anchors around the boss form a CONSTELLATION: +15% damage.', s: RINGS3 + '<path d="M60 58 L140 58 L100 14Z" fill="none" stroke="#ffd36b" stroke-width="1.6"/>' + ['60,58', '140,58', '100,14'].map(p => `<g transform="translate(${p})"><path d="M0 -6 L2 -2 L6 0 L2 2 L0 6 L-2 2 L-6 0 L-2 -2Z" fill="#ffd36b"/></g>`).join('') },
    { h: 'COMET', k: 'SPACE', p: 'Hold to charge (1.2 s), release to fire: 60 to 300 damage. The aim line turns bright gold while you are behind the boss. Release it there.', s: RINGS3 + KN(100, 10) + '<path d="M100 14 L100 32" stroke="#fff1c2" stroke-width="3"/><circle cx="100" cy="12" r="7" fill="none" stroke="#fff1c2" stroke-width="1.5" stroke-dasharray="3 2"/>' },
    { h: 'ECLIPSE', k: 'E', p: 'Halts your orbit for 1.5 s (Reverse or Shift ends it), interrupts casts framed in gold, and empowers your next skill within 6 s.', s: RINGS3 + '<circle cx="100" cy="63" r="8" fill="#05030c" stroke="#fff1c2" stroke-width="2"/><circle cx="100" cy="63" r="12" fill="none" stroke="#ffc94d" stroke-width="1" opacity=".6"/><rect x="70" y="2" width="60" height="6" fill="none" stroke="#fff1c2"/><rect x="70" y="2" width="38" height="6" fill="#ffd36b"/>' },
    { h: 'AEGIS', k: 'F', p: 'Blocks everything for 1 s and reflects each blocked hit as a gold lance (3x its damage). Block in the first 0.3 s for PERFECT (4.5x). Save it for the biggest hit.', s: RINGS3 + KN(100, 63) + '<circle cx="100" cy="60" r="11" fill="#ffc94d" fill-opacity=".15" stroke="#ffd36b" stroke-width="1.6"/><path d="M100 49 L100 40" stroke="#fff1c2" stroke-width="2.5"/>' },
    { h: 'SUPERNOVA', k: 'R', p: 'At a full meter: a 3 s set piece. Hazards slow, you rise and collapse a star into the boss for 900 damage, clearing adds and orbs.', s: RINGS3 + '<g stroke="#fff1c2" stroke-width="1.6"><path d="M100 4V14M100 58V68M70 36H80M120 36H130M80 16L86 22M114 50L120 56M120 16L114 22M86 50L80 56"/></g><circle cx="100" cy="36" r="9" fill="#fff1c2"/>' },
    { h: 'EMPOWERED', k: 'ECLIPSE →', p: 'Anchor becomes a Meridian (pulses on every ring, double heal). Comet is instantly full, x1.5 and pierces adds. Aegis lasts 1.8 s, x1.5. Supernova x1.5.', s: RINGS3 + '<path d="M100 36 L100 2" stroke="#ffd36b" stroke-width="2"/><circle cx="100" cy="20" r="5" fill="#05030c" stroke="#e6dcff" stroke-width="2"/>' },
  ];
  function buildHow() {
    $('howGrid').innerHTML = HOW.map(c => `<div class="how">${SV(c.s)}<h4>${c.h}${c.k ? `<kbd>${G.isTouch && c.k.length > 2 && c.k !== 'AUTO' && !c.k.includes('→') ? 'BUTTON' : c.k}</kbd>` : ''}</h4><p>${c.p}</p></div>`).join('');
  }

  // ---------------------------------------------------------- settings UI
  function bindSettings() {
    const rng = (id, key) => { const el = $(id); el.value = settings[key]; el.addEventListener('input', () => { settings[key] = +el.value; applySettings(); saveSettings(); }); };
    rng('setMaster', 'master'); rng('setMusic', 'music'); rng('setSfx', 'sfx');
    const seg = $('setQuality');
    const paintQ = () => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === (settings.quality || 'auto')));
    seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { settings.quality = b.dataset.v; paintQ(); applySettings(); saveSettings(); sfx('uiToggle'); }));
    paintQ();
    const tog = (id, key) => { const el = $(id); const paint = () => el.classList.toggle('on', settings[key] !== false); el.addEventListener('click', () => { settings[key] = settings[key] === false; paint(); applySettings(); saveSettings(); sfx('uiToggle'); }); paint(); };
    tog('setShake', 'shake'); tog('setGhost', 'ghost'); tog('setNumbers', 'numbers'); tog('setHaptics', 'haptics');
  }

  // ---------------------------------------------------------- controls
  const BTN_FOR = { reverse: 'tReverse', shiftIn: 'tIn', shiftOut: 'tOut', anchor: 'sAnchor', cometDown: 'sComet', eclipse: 'sEclipse', aegis: 'sAegis', nova: 'sNova' };
  function flashBtn(action) {
    const el = $(BTN_FOR[action]); if (!el) return;
    if (action === 'cometDown') { el.classList.add('down'); return; }
    el.classList.add('down'); clearTimeout(el._fh); el._fh = setTimeout(() => { if (!el._held) el.classList.remove('down'); }, 110);
  }
  function bindControls() {
    document.querySelectorAll('#controls [data-btn]').forEach(el => {
      const act = el.dataset.btn;
      const active = new Set();
      const down = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (active.has(e.pointerId)) return;
        active.add(e.pointerId);
        try { el.setPointerCapture && el.setPointerCapture(e.pointerId); } catch (er) { }
        el._held = true; el.classList.add('down');
        if (G.state === 'intro') { G.combat && G.combat.skipIntro && G.combat.skipIntro(); }
        if (act === 'comet') G.input.cometDown({ source: 'button' });
        else G.input.fire(act, { source: 'button' });
        vibrate(act === 'shiftIn' || act === 'shiftOut' ? 8 : 6);
      };
      const up = (e) => {
        if (!active.has(e.pointerId)) return;
        active.delete(e.pointerId);
        if (active.size) return;
        el._held = false; el.classList.remove('down');
        if (act === 'comet') G.input.cometUp({ source: 'button' });
      };
      el.addEventListener('pointerdown', down, { passive: false });
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('mousedown', (e) => e.preventDefault());   // never take keyboard focus (Space would re-click it)
    });
    // keyboard / bot feedback on the same buttons
    for (const a of Object.keys(BTN_FOR)) G.input.on(a, () => flashBtn(a));
    G.input.on('cometUp', () => { const el = $('sComet'); if (el && !el._held) el.classList.remove('down'); });
  }

  // ---------------------------------------------------------- events
  function bindEvents() {
    G.on('fightStart', (d) => {
      const c = G.combat, def = c.def || {};
      setupBossBar();
      H.lastCast = null; H.castFlashT = 0;
      hud(true);
      only(null);
      $('introK').textContent = d.practice ? 'TRAINING' : (typeof d.bossIndex === 'number' && d.bossIndex >= 0 ? 'BOSS ' + ROMAN[d.bossIndex] : 'TRIAL');
      $('introN').textContent = def.name || '';
      $('introT').textContent = def.title || '';
      $('scrIntro').querySelectorAll('.in').forEach(n => { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; });
      if (d.fromPhase > 0) { $('introK').textContent = 'PHASE ' + ROMAN[d.fromPhase] + ' · CHECKPOINT'; }
      show('scrIntro');
      $('practiceHelp').classList.toggle('min', !!(G.isTouch && innerHeight > innerWidth));
    });
    G.on('fightBegin', () => {
      hide('scrIntro');
      const bf = $('beginFlash'); bf.textContent = G.combat.practice ? 'PRACTICE' : 'BEGIN'; bf.classList.add('on'); H.beginT = 0.9;
      sfx('begin');
    });
    G.on('phaseStart', (d) => {
      const c = G.combat; if (!c || c.practice) return;
      $('phaseK').textContent = 'PHASE ' + (ROMAN[d.index] || d.index + 1);
      $('phaseN').textContent = d.name || '';
      const pb = $('phaseBanner'); pb.classList.remove('on'); void pb.offsetWidth; pb.classList.add('on');
      H.bannerT = d.index === 0 ? 2.0 : 2.8;
      $('timer').classList.toggle('ckpt', !!c.checkpointUsed);
    });
    G.on('say', (d) => { const s = $('say'); s.textContent = d.text || ''; s.classList.add('on'); H.sayT = d.dur || 2.5; });
    G.on('castEnd', (d) => {
      if (d.interrupted) { $('castName').textContent = 'INTERRUPTED'; $('castWrap').classList.add('on'); H.castFlashT = 0.9; }
    });
    G.on('playerDamaged', (d) => {
      if (d.blocked) { vibrate(15); return; }
      if (!(d.amount > 0)) return;
      const hb = $('hpBar'); hb.classList.remove('hit'); void hb.offsetWidth; hb.classList.add('hit');
      vibrate(d.practice ? 20 : 45);
    });
    G.on('shift', () => vibrate(8));
    G.on('interrupt', () => vibrate([20, 30, 20]));
    G.on('playerDied', () => vibrate([60, 40, 120]));
    G.on('fightEnd', (d) => {
      if (d.result === 'defeat') showDefeat(d);
      else if (d.result === 'victory') showVictory(d.results || G.combat.results);
    });
    G.on('stateChange', (d) => {
      if (d.to === 'menu') {
        hud(false);
        // back on the title: calm menu sky, untilted arena with no fight leftovers (glow, flood, rime, gaps)
        try { G.world && G.world.reset && G.world.reset(); G.world && G.world.setSky && G.world.setSky('menu', 0, 1.6); } catch (e) { logE('ui.menuSky', e); }
      }
    });
    // any input skips the intro card
    const skip = () => { if (G.state === 'intro') G.combat && G.combat.skipIntro && G.combat.skipIntro(); };
    for (const a of ['any', 'reverse', 'shiftIn', 'shiftOut', 'anchor', 'cometDown', 'eclipse', 'aegis', 'nova']) G.input.on(a, skip);
    $('scrIntro').addEventListener('pointerdown', skip);
    // pause
    G.input.on('pause', () => {
      if (G.state === 'paused') { if (!$('scrSettings').classList.contains('hidden')) { hide('scrSettings'); show('scrPause'); return; } pause(false); }
      else if (['fight', 'practice', 'cinematic', 'intro'].includes(G.state)) pause(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !(G.params && G.params.bot) && ['fight', 'practice', 'cinematic', 'intro'].includes(G.state)) pause(true);
    });
  }

  function bindButtons() {
    const on = (id, fn, snd = 'uiClick') => { const el = $(id); if (el) el.addEventListener('click', (e) => { e.stopPropagation(); sfx(snd); fn(e); }); };
    on('bFight', () => { refreshCards(); only('scrSelect'); }, 'uiConfirm');
    on('bPractice', () => startPractice(), 'uiConfirm');
    on('bHow', () => only('scrHow'));
    on('bSettings', () => { settingsReturn = 'scrTitle'; only('scrSettings'); });
    on('bSelBack', () => only('scrTitle'), 'uiBack');
    on('bHowBack', () => only('scrTitle'), 'uiBack');
    on('bSetBack', () => { if (G.state === 'paused') { hide('scrSettings'); show('scrPause'); } else only(settingsReturn); }, 'uiBack');
    on('fsTop', toggleFs); on('btnFs', toggleFs); on('bPFs', toggleFs);
    on('btnPause', () => { if (G.state === 'paused') pause(false); else pause(true); });
    on('bResume', () => pause(false), 'uiConfirm');
    on('bPRetry', () => { only(null); G.core.pause(false); G.combat.deathPhase = G.combat.boss ? G.combat.boss.phase : 0; G.combat.retryPhase(); }, 'uiConfirm');
    on('bPRestart', () => { only(null); G.core.pause(false); G.combat.restart(); }, 'uiConfirm');
    on('bPSettings', () => { settingsReturn = 'scrPause'; hide('scrPause'); show('scrSettings'); });
    on('bPQuit', () => toMenu(), 'uiBack');
    on('bRetryPhase', () => { only(null); G.combat.retryPhase(); }, 'uiConfirm');
    on('bRestart', () => { only(null); G.combat.restart(); }, 'uiConfirm');
    on('bDefMenu', () => toMenu(), 'uiBack');
    on('bNext', () => { const r = G.combat.results; const n = r && typeof r.bossIndex === 'number' ? r.bossIndex + 1 : lastBoss + 1; startBoss(n); }, 'uiConfirm');
    on('bVRetry', () => { only(null); G.combat.restart(); }, 'uiConfirm');
    on('bVMenu', () => toMenu(), 'uiBack');
    on('practiceX', () => $('practiceHelp').classList.toggle('min'));
    document.querySelectorAll('#ui .btn').forEach(b => b.addEventListener('pointerenter', () => sfx('uiHover')));
  }

  function layoutScale() {
    const w = innerWidth, h = innerHeight;
    const portrait = h > w;
    let s = G.isTouch ? clamp(Math.min(w, h) / 430, 0.74, 1.12) : 1;
    if (G.isTouch && portrait) s = Math.min(s, clamp(w / 470, 0.7, 1));
    $('ui').style.setProperty('--s', s.toFixed(3));
  }

  // ---------------------------------------------------------- module
  G.ui = {
    settings, show, hide, only, toast, toggleFs, startBoss, startPractice, toMenu, pause, refreshCards,
    init() {
      document.body.classList.toggle('touch', !!G.isTouch);
      document.body.classList.toggle('ios', !!G.isIOS);
      ['anchor', 'comet', 'eclipse', 'aegis', 'nova'].forEach(k => { SK[k] = $('s' + k[0].toUpperCase() + k.slice(1)); });
      applySettings(true);
      bindSettings(); bindButtons(); bindControls(); bindEvents();
      buildHow(); refreshCards();
      layoutScale(); addEventListener('resize', layoutScale);
      // route: ?practice=1 / ?boss=N skip the menu
      const p = G.params || {};
      const route = () => {
        if (p.practice) startPractice();
        else if (p.boss) { if (!startBoss(p.boss - 1, { fromPhase: p.phase ? p.phase - 1 : 0, skipIntro: !!p.bot })) { only('scrTitle'); try { G.audio.music('menu'); } catch (e) { } } }
        else { only('scrTitle'); try { G.audio && G.audio.music && G.audio.music('menu'); } catch (e) { } }
      };
      if (G.booted) route(); else G.once ? G.once('booted', route) : G.on('booted', route);
    },
    update(dt) {
      const rdt = G.rdt || dt || 0;
      if (hudOn) { try { updateHud(rdt); } catch (e) { logE('ui.hud', e); } }
    },
  };
})();
