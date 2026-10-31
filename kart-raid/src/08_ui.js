// =====================================================================
// 08_ui.js — HUD, callouts, flow state machine, menus, briefing, garage,
// results, settings, persistence, window.__game test hook.        (UI)
// The HUD DOM + CSS live in 00_head.html. HUD bars update every frame but
// only touch the DOM when a value changes; text updates run at 15 Hz.
// =====================================================================
{
  const { THREE } = G;
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const fmtT = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + pad2(Math.floor(s)) + '.' + Math.floor((s % 1) * 10); };
  const fmtT2 = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + pad2(Math.floor(s)) + '.' + pad2(Math.floor((s % 1) * 100)); };
  const fmtClock = (t) => { t = Math.max(0, Math.ceil(t || 0)); return Math.floor(t / 60) + ':' + pad2(t % 60); };
  const bold = (s) => String(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');   // tips are our own strings; <b> allowed
  const sfx = (n, o) => { try { G.audio?.sfx?.(n, o); } catch (e) { } };
  const TEST = !!G.params.test;
  const FORCE_HINTS = (() => { try { return new URLSearchParams(location.search).get('hints') === '1'; } catch (e) { return false; } })();

  // ------------------------------------------------------------------
  // Boss info (fallbacks when a boss module has not registered its def yet)
  // ------------------------------------------------------------------
  const INFO = [
    { name: 'BRASSHOLLOW', title: 'the Furnace Sumo', arena: 'EMBER BOWL', accent: '#ff6a1a', target: 135, soft: 210, hard: 255,
      tips: ['Release a drift to fire. **VIOLET** sparks deal the most and **interrupt** purple cast bars.', '**HOP** (tap DRIFT) over purple shockwaves.', 'Skim the edge of red zones to **GRAZE** for Flux. Full Flux + **BREAK** = **COMET**.'] },
    { name: 'QUICKSILVER LEVIATHAN', title: 'the Sky Serpent', arena: 'STRATOS RIBBON', accent: '#3fa9ff', target: 180, soft: 255, hard: 300,
      tips: ['Stay in **RANGE**. Bolts lock onto the gold tail nodes.', 'Head-on: switch lanes for a **MEGA GRAZE**, or **DASH** through the visor.', 'Branded? Race to the **GOLD PYLON** before the timer ends.'] },
    { name: 'VELOX', title: 'the Last Lap King', arena: 'EVENT HORIZON CIRCUIT', accent: '#8fd7ff', target: 210, soft: 300, hard: 345,
      tips: ['Your **GHOSTS** replay your path from 8 s ago. Change your line every lap.', 'When the clock hits zero, be in a cyan **PIT BOX** (or mid-**COMET**).', 'Break the 8 crown hands. Break all 4 of a set for a long **BREAK**.'] },
  ];
  function info(n) {
    const d = G.bosses[n - 1] || null, f = INFO[n - 1] || INFO[0], b = (d && d.boss) || {};
    return {
      n, def: d, name: d?.name || f.name, title: d?.title || f.title, arena: d?.arena?.name || f.arena,
      accent: d?.accent || f.accent, tips: d?.tips || d?.briefing || f.tips, target: d?.targetTime || f.target,
      soft: b.softEnrage ?? f.soft, hard: b.hardEnrage ?? f.hard, phases: b.phases || null, hp: b.hp,
    };
  }

  // ------------------------------------------------------------------
  // Persistence (every localStorage access wrapped)
  // ------------------------------------------------------------------
  const SAVE_KEY = 'db_save_v1';
  const save = {
    best: {}, unlocked: 1, cleared: false, tutorialDone: false, hints: {},
    settings: { quality: 'auto', assist: null, throttle: 1, shake: 0, patterns: 0, diff: 'raid', mute: 0 },
  };
  function loadSave() {
    if (TEST) return;
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (s && typeof s === 'object') {
        Object.assign(save.best, s.best || {});
        save.unlocked = clamp(s.unlocked | 0 || 1, 1, 3); save.cleared = !!s.cleared; save.tutorialDone = !!s.tutorialDone;
        if (s.hints && typeof s.hints === 'object') Object.assign(save.hints, s.hints);
        Object.assign(save.settings, s.settings || {});
      }
    } catch (e) { }
  }
  function persist() { if (TEST) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }

  // ------------------------------------------------------------------
  // Settings + difficulty
  // ------------------------------------------------------------------
  const DIFF = {
    story: { id: 'story', speed: 0.8, bossDmg: 0.7, hpMult: 1, enrageMult: 1 },
    raid: { id: 'raid', speed: 1, bossDmg: 1, hpMult: 1, enrageMult: 1 },
    mythic: { id: 'mythic', speed: 1, bossDmg: 1, hpMult: 1.3, enrageMult: 0.8 },
  };
  // G.difficulty is the id string ('story'|'raid'|'mythic', read by COMBAT); G.diffCfg holds the multipliers
  G.settings = { thickPatterns: false, reduceShake: false, difficulty: 'raid' };
  G.difficulty = 'raid'; G.diffCfg = DIFF.raid;
  function applyQuality() {
    // a ?quality= URL param wins over the saved setting
    try { if (G.params.quality === 'auto' || !G.params.quality) G.quality.set(save.settings.quality || 'auto'); } catch (e) { }
  }
  function applySettings() {
    const S = save.settings;
    if (G.input) { G.input.driftAssist = S.assist === null || S.assist === undefined ? G.isTouch : !!+S.assist; G.input.autoThrottle = !!+S.throttle; }
    G.cam.shakeMult = +S.shake ? 0.4 : 1; G.settings.reduceShake = !!+S.shake;
    G.settings.thickPatterns = !!+S.patterns;
    if (G.track && G.track.uniforms && G.track.uniforms.uThick) G.track.uniforms.uThick.value = G.settings.thickPatterns ? 1 : 0;
    try { G.audio?.mute?.(!!+S.mute); } catch (e) { }
    if (S.diff === 'mythic' && !save.cleared) S.diff = 'raid';
    G.diffCfg = DIFF[S.diff] || DIFF.raid; G.difficulty = G.diffCfg.id; G.settings.difficulty = G.difficulty;
  }
  function refreshSettingsUI() {
    const S = save.settings;
    const cur = { quality: S.quality || 'auto', mute: String(+S.mute || 0), assist: String(G.input?.driftAssist ? 1 : 0), throttle: String(+S.throttle ? 1 : 0), shake: String(+S.shake ? 1 : 0), patterns: String(+S.patterns ? 1 : 0) };
    document.querySelectorAll('[data-set]').forEach(g => { const k = g.dataset.set; g.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('on', b.dataset.v === cur[k])); });
    document.querySelectorAll('[data-range]').forEach(r => { try { const v = G.audio?.getVolume?.(r.dataset.range); r.value = v ?? 0.8; } catch (e) { } });
    document.querySelectorAll('[data-diff]').forEach(b => { b.classList.toggle('on', b.dataset.diff === (S.diff || 'raid')); if (b.dataset.diff === 'mythic') b.disabled = !save.cleared; });
  }
  function setSetting(k, v) {
    const S = save.settings;
    if (k === 'quality') { S.quality = v; applyQuality(); } else if (k === 'assist') S.assist = +v; else S[k] = +v;
    applySettings(); persist(); refreshSettingsUI(); sfx('uiClick');
  }

  // ------------------------------------------------------------------
  // Icons (inline SVG)
  // ------------------------------------------------------------------
  const ICON = {
    seeker: '<svg viewBox="0 0 24 24" color="#ff8a1f"><path d="M5 19l2.5-6.5L15 5c2-2 4.5-2 5-2 0 .5 0 3-2 5l-7.5 7.5z" fill="#ff8a1f"/><circle cx="15.5" cy="8.5" r="1.8" fill="#fff"/><path d="M6 18l-3 3M9 15.5L5 16l3 3 .5-4" stroke="#ffc93a" stroke-width="1.5" fill="none"/></svg>',
    nitro: '<svg viewBox="0 0 24 24" color="#33f6ff"><rect x="7" y="6" width="10" height="15" rx="2" fill="#33f6ff"/><rect x="9" y="3" width="6" height="3" fill="#bffcff"/><path d="M12 9l-2 4h2l-1 4 4-5h-2l1-3z" fill="#0a0d1a"/></svg>',
    prism: '<svg viewBox="0 0 24 24" color="#bffcff"><path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" fill="none" stroke="#bffcff" stroke-width="2"/><path d="M12 6l5 3v6l-5 3-5-3V9z" fill="#33f6ff" opacity=".6"/></svg>',
    jammer: '<svg viewBox="0 0 24 24" color="#c04bff"><circle cx="12" cy="12" r="9" fill="none" stroke="#c04bff" stroke-width="2"/><path d="M5 19L19 5" stroke="#c04bff" stroke-width="2"/><path d="M8 13l3-5 2 4 3-3" stroke="#f0c8ff" stroke-width="1.6" fill="none"/></svg>',
    repair: '<svg viewBox="0 0 24 24" color="#7dffb0"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#7dffb0" stroke-width="2"/><path d="M12 7v10M7 12h10" stroke="#7dffb0" stroke-width="3"/></svg>',
  };
  const ITEM_KEYS = Object.keys(ICON);
  const KART_SVG = '<svg viewBox="0 0 22 14"><path d="M2 9.5l3-5.5h8.5l4 3H20v3.5H2z" fill="#33f6ff"/><path d="M7 4h5l1.5 2.5H6z" fill="#0a0d1a"/><circle cx="6" cy="11" r="2.3" fill="#0a0d1a" stroke="#33f6ff" stroke-width="1.3"/><circle cx="16.5" cy="11" r="2.3" fill="#0a0d1a" stroke="#33f6ff" stroke-width="1.3"/></svg>';

  const MODS = [
    { id: 'capacitor', name: 'CAPACITOR', ic: '//', desc: 'Drift tiers charge 15% faster.' },
    { id: 'magnet', name: 'GRAZE MAGNET', ic: '((o))', desc: 'Graze distance 2.5 m and grazes pay +14 Flux.' },
    { id: 'twin', name: 'TWIN COMET', ic: '**', desc: 'Your Comet bounces for a second hit at 40%.' },
    { id: 'hotstart', name: 'HOT START', ic: '>>', desc: 'Begin every fight with 50 Flux.' },
    { id: 'hull', name: 'REINFORCED HULL', ic: '[+]', desc: '+30 max hull, regen cap raised to 75%.' },
    { id: 'storm', name: 'BOLT STORM', ic: '|||', desc: '+1 Spark Lance bolt on every tier.' },
  ];

  // ------------------------------------------------------------------
  // Special arenas: title attract loop + warp tunnel
  // ------------------------------------------------------------------
  const TITLE_ARENA = {
    id: 0, name: 'TITLE', title: '',
    arena: {
      name: 'NEON GRID', sky: 'title', palette: { base: '#0c0820', line: '#33f6ff', edge: '#ff3df2', accent: '#ffc93a' },
      shape: { type: 'stadium', straight: 150, radius: 52 }, width: 18, bankCurves: 10,
      pads: [{ s: 40, lane: 0, len: 8 }, { s: 100, lane: 1, len: 8 }, { s: 355, lane: -1, len: 8 }, { s: 420, lane: 0, len: 8 }],
      itemRows: [], surface: 'chrome', fog: { color: '#1a0a33', near: 140, far: 760 }, envTop: '#3a1066', hemiSky: '#c08bff',
    },
  };
  const WARP_ARENA = {
    id: 0, name: 'WARP', title: '',
    arena: {
      name: 'WARP', sky: 'warp', palette: { base: '#05061a', line: '#33f6ff', edge: '#ff3df2', accent: '#c04bff' },
      shape: { type: 'stadium', straight: 620, radius: 40 }, width: 16, bankCurves: 0,
      pads: [{ s: 60, lane: 0, len: 10 }, { s: 170, lane: -1, len: 10 }, { s: 280, lane: 1, len: 10 }, { s: 390, lane: 0, len: 10 }, { s: 500, lane: -1, len: 10 }],
      itemRows: [], surface: 'glass', fog: { color: '#03020c', near: 60, far: 520 }, envTop: '#10083a', hemiSky: '#8fd7ff',
    },
  };

  // ------------------------------------------------------------------
  // Scratch (no per-frame allocation)
  // ------------------------------------------------------------------
  const V = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), r: new THREE.Vector3(), p: new THREE.Vector3(), q: new THREE.Vector3(), t: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
  const proj = { x: 0, y: 0, behind: false, on: false };
  function project(w) {
    V.p.copy(w).project(G.camera);
    proj.behind = V.p.z > 1;
    let x = V.p.x, y = V.p.y;
    if (proj.behind) { x = -x; y = -y; }
    proj.x = (x * 0.5 + 0.5) * innerWidth; proj.y = (0.5 - y * 0.5) * innerHeight;
    proj.on = !proj.behind && Math.abs(V.p.x) < 0.95 && Math.abs(V.p.y) < 0.95;
    return proj;
  }

  // ------------------------------------------------------------------
  // DOM refs
  // ------------------------------------------------------------------
  let E = null;
  function grabDom() {
    E = {
      hudBoss: $('hud-boss'), bossName: $('boss-name'), bossTitle: $('boss-title'), phaseLbl: $('phase-label'),
      hp: $('boss-hp'), hpFill: document.querySelector('#boss-hp .fill'), hpChip: document.querySelector('#boss-hp .chip'), hpTicks: document.querySelector('#boss-hp .ticks'), hpPct: document.querySelector('#boss-hp .pct'),
      subs: $('subtargets'), stag: $('stagger-bar'), stagFill: document.querySelector('#stagger-bar .fill'),
      cast: $('cast-bar'), castName: document.querySelector('#cast-bar .name'), castFill: document.querySelector('#cast-bar .fill'), castHint: document.querySelector('#cast-bar .hint'),
      enr: $('enrage-timer'), enrL: document.querySelector('#enrage-timer .l'), enrV: document.querySelector('#enrage-timer .v'),
      credits: $('credits'), lap: $('lap'), ftime: $('ftime'),
      speedo: $('speedo'), spdNum: document.querySelector('#speedo .num'), spdArc: document.querySelector('#speedo .spdarc'), fluxRing: document.querySelector('#speedo .fluxring'), flux: $('flux'),
      fluxState: $('flux-state'), tier: $('drift-tier'), chev: document.querySelectorAll('#drift-tier .chev'), tierBar: document.querySelector('#drift-tier .bar i'), tierLbl: document.querySelector('#drift-tier .lbl'),
      hull: $('hull'), hullFill: document.querySelector('#hull .fill'), hullNum: document.querySelector('#hull-lbl b'),
      chipDash: $('chip-dash'), chipDashCd: document.querySelector('#chip-dash .cd'), chipDashPip: document.querySelector('#chip-dash .pip'),
      chipAb: $('chip-ab'), chipAbCd: document.querySelector('#chip-ab .cd'), chipAbT: document.querySelector('#chip-ab .t'),
      itemSlot: $('item-slot'), itemIco: document.querySelector('#item-slot .ico'), btnItem: $('btn-item'), btnItemIco: document.querySelector('#btn-item .ico'),
      callouts: $('callouts'), banner: $('banner'), bannerT: document.querySelector('#banner .t'), bannerS: document.querySelector('#banner .s'), toasts: $('toasts'),
      countdown: $('countdown'), cdHint: $('cd-hint'), arrows: $('arrows'), brandRing: $('brand-ring'), brandTxt: $('brand-txt'), range: $('range-chev'), prompt: $('prompt'),
      vigHit: document.querySelector('#vig .hit'), vigLow: document.querySelector('#vig .low'), vigStag: document.querySelector('#vig .stag'), vigOc: document.querySelector('#vig .oc'), vigBoost: document.querySelector('#vig .boost'),
      fade: $('fade'), debug: $('debug'), settings: $('settings'),
    };
    E.credits.innerHTML = KART_SVG + KART_SVG + KART_SVG;
    E.creditIcons = E.credits.querySelectorAll('svg');
    // pooled callouts (5) + threat arrows (6 + 1 pylon)
    E.co = [];
    for (let i = 0; i < 5; i++) { const d = document.createElement('div'); d.className = 'co'; E.callouts.appendChild(d); E.co.push({ el: d, end: 0, t0: 0 }); }
    E.arw = [];
    for (let i = 0; i < 7; i++) { const d = document.createElement('div'); d.className = 'arw' + (i === 6 ? ' p' : ''); E.arrows.appendChild(d); E.arw.push({ el: d, on: false, kind: '' }); }
  }

  // small helpers that only write when changed
  const cache = new Map();
  function setTx(el, key, v) { if (cache.get(key) === v) return; cache.set(key, v); el.style.transform = v; }
  function setText(el, key, v) { if (cache.get(key) === v) return; cache.set(key, v); el.textContent = v; }
  function setHTML(el, key, v) { if (cache.get(key) === v) return; cache.set(key, v); el.innerHTML = v; }
  function setCls(el, cls, on) { if (el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on); }
  function setAttr(el, key, a, v) { if (cache.get(key) === v) return; cache.set(key, v); el.setAttribute(a, v); }
  function setVar(el, key, name, v) { if (cache.get(key) === v) return; cache.set(key, v); el.style.setProperty(name, v); }

  // ------------------------------------------------------------------
  // Callouts / banner / toast (G.ui)
  // ------------------------------------------------------------------
  const CO_DUR = { break: 1.4, graze: 0.8, perfect: 1.1, danger: 1.2, enrage: 1.5, lap: 1.1, interrupt: 1.2, gold: 1.2, info: 1.5 };
  const recent = { text: '', t: -9 };
  function restartAnim(el) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  function callout(text, style = 'info') {
    if (!E || !text) return;
    if (style === 'phase') { banner(text, ''); return; }
    if (!CO_DUR[style]) style = 'info';
    const now = G.time.real;
    if (text === recent.text && now - recent.t < 0.6) return;   // dedupe (several modules may announce the same thing)
    recent.text = text; recent.t = now;
    // max 3 stacked: drop the oldest live one
    let live = 0, oldest = null, free = null;
    for (const c of E.co) { if (c.end > now) { live++; if (!oldest || c.t0 < oldest.t0) oldest = c; } else if (!free) free = c; }
    if (live >= 3 && oldest) { oldest.end = 0; oldest.el.className = 'co'; free = free || oldest; }
    const c = free || oldest; if (!c) return;
    c.el.textContent = text; c.el.className = 'co on s-' + style; restartAnim(c.el);
    E.callouts.appendChild(c.el);   // newest at the bottom of the stack
    c.t0 = now; c.end = now + CO_DUR[style];
  }
  let bannerEnd = 0;
  function banner(title, sub = '') {
    if (!E) return;
    E.bannerT.textContent = title; E.bannerS.textContent = sub || '';
    E.banner.classList.add('on'); restartAnim(E.banner); bannerEnd = G.time.real + 2.6;
  }
  function toast(text) {
    if (!E) return;
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = text;
    E.toasts.appendChild(d); while (E.toasts.children.length > 3) E.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 2700);
  }
  let promptEnd = 0;
  const promptQ = [];
  function showPrompt(text, sub, dur) {
    E.prompt.textContent = text;
    if (sub) { const sm = document.createElement('small'); sm.textContent = sub; E.prompt.appendChild(sm); }
    E.prompt.style.animationDuration = dur + 's';
    E.prompt.classList.add('on'); restartAnim(E.prompt); promptEnd = G.time.real + dur;
  }
  // prompt(text, dur) shows now; prompts that arrive while one is showing are queued (max 3)
  function prompt(text, dur = 4.5, sub = '') {
    if (!E) return;
    if (promptEnd && G.time.real < promptEnd - 0.2) { if (promptQ.length < 3) promptQ.push([text, sub, dur]); return; }
    showPrompt(text, sub, dur);
  }
  // one-shot onboarding hints (persisted; off in tests unless ?hints=1)
  function hint(id, text, sub, dur = 4.5) {
    if ((TEST && !FORCE_HINTS) || save.hints[id]) return false;
    save.hints[id] = 1; persist(); prompt(text, dur, sub); return true;
  }
  const touchUI = () => body.classList.contains('touch');

  G.ui = {
    callout, banner, toast, prompt, hint,
    setMode(m) { body.dataset.hud = m; },
    showBriefing(i) { flow.go('briefing', { boss: i }); },
    save, info,
  };
  G.on('ui:callout', (e) => { if (e) callout(e.text, e.style); });

  // ------------------------------------------------------------------
  // Fight bookkeeping
  // ------------------------------------------------------------------
  const fight = { n: 1, active: false, t0: 0, retries: 0, grazes: 0, megas: 0, interrupts: 0, creditsUsed: 0, staggerDur: 6, result: null, defeatAt: -1, firstCast: true, endTime: 0 };
  const run = { results: [] };      // per-boss results this run (for the finale)
  const dps = { t: new Float32Array(128), a: new Float32Array(128), i: 0 };
  let hudInfo = info(1);
  const K = () => G.kart;

  const curPhase0 = () => { const b = G.boss; if (!b) return 0; const p = b.phaseIndex ?? b.phase; return typeof p === 'number' ? p : 0; };
  const fightTime = () => G.boss && typeof G.boss.t === 'number' ? G.boss.t : (fight.active ? G.time.now - fight.t0 : 0);
  const bossPhases = () => G.boss?.phases || G.boss?.def?.boss?.phases || hudInfo.phases || [];

  function endCombat() {
    try { if (G.combat && G.combat.endFight) G.combat.endFight(); } catch (e) { G.logError('combat.endFight', e); }
    try { G.tele?.clear?.(); G.zones?.clear?.(); G.obstacles?.clear?.(); G.gates?.clear?.(); } catch (e) { }
    if (G.boss && !(G.combat && G.combat.endFight)) G.boss = null;
    fight.active = false;
    G.time.scale = 1; G.time.clearSlow();
    G.post?.setMono?.(0); G.post?.setDamage?.(0);
  }

  let arenaKey = '';
  function ensureArena(key, def) {
    if (arenaKey === key && G.track.built) return false;
    endCombat();
    try { G.track.buildArena(def); } catch (e) { G.logError('buildArena:' + key, e); }
    arenaKey = key;
    applySettings();
    G.kart.reset(true);
    return true;
  }
  function bossArena(n) {
    const d = G.bosses[n - 1] || G.track.defaultArena;
    ensureArena('boss' + n, d);
    hudInfo = info(n);
    body.style.setProperty('--accent', hudInfo.accent);
  }

  // Start combat for boss n (kart already placed). Combat listens to fight:start; startFight is a fallback.
  function beginCombat(n, phase = 1) {
    fight.active = true; fight.n = n; fight.t0 = G.time.now; fight.defeatAt = -1;
    G.emit('fight:start', { boss: n, phase });
    try { if (!G.boss && G.combat && G.combat.startFight) G.combat.startFight(n, { phase }); } catch (e) { G.logError('combat.startFight', e); }
    if (phase > 1) cheats.setPhase(phase);
    if (G.diffCfg.speed !== 1 && !TEST) G.time.scale = G.diffCfg.speed;
    setupBossHud();
  }
  function resetFightStats() {
    fight.retries = 0; fight.grazes = 0; fight.megas = 0; fight.interrupts = 0; fight.creditsUsed = 0; fight.result = null; fight.firstCast = true;
    dps.t.fill(-99); dps.a.fill(0);
  }
  // full (re)start of a fight for boss n, no countdown (tests, restart, skipToBoss)
  function setupFight(n, phase = 1) {
    n = clamp(n | 0 || 1, 1, 3);
    bossArena(n);
    endCombat();
    const k = K(); k.reset(true); k.bot = false; k.frozen = false;
    G.cam.setCinematic(null); G.cam.snap();
    resetFightStats();
    beginCombat(n, phase);
  }
  function retryCheckpoint() {
    const n = fight.n, ph = curPhase0() + 1;
    G.time.paused = false; G.time.clearSlow(); G.post?.setMono?.(0);
    let done = false;
    try { if (G.combat && G.combat.retryCheckpoint) { G.combat.retryCheckpoint(); done = true; } else if (G.boss && G.boss.retryCheckpoint) { G.boss.retryCheckpoint(); done = true; } } catch (e) { G.logError('retryCheckpoint', e); }
    if (!done) { endCombat(); fight.active = true; beginCombat(n, ph); }
    const k = K(); k.reset(false); k.frozen = false; k.bot = false; k.invulnT = 1.5;
    G.cam.setCinematic(null); G.cam.snap();
    fight.retries++; fight.active = true; fight.defeatAt = -1;
    if (G.diffCfg.speed !== 1 && !TEST) G.time.scale = G.diffCfg.speed;
    banner('RETRY', 'PHASE ' + ph + ' CHECKPOINT');
  }

  // ------------------------------------------------------------------
  // Boss HUD setup (ticks, name, sub targets)
  // ------------------------------------------------------------------
  let subSig = '', subEls = [], subMax = {};
  function setupBossHud() {
    if (!E) return;
    E.bossName.textContent = hudInfo.name; E.bossTitle.textContent = hudInfo.title;
    let ticks = '';
    for (const p of bossPhases()) if (p && p.at < 1 && p.at > 0) ticks += `<div class="tick" style="left:${(p.at * 100).toFixed(2)}%"></div>`;
    E.hpTicks.innerHTML = ticks;
    subSig = ''; subMax = {}; chip.v = 1; chip.hold = 0;
    cache.clear();
  }
  function subTargets(out) {
    out.length = 0;
    const b = G.boss; if (!b || !b.targets) return out;
    for (const t of b.targets) {
      if (!t || typeof t.hp !== 'number' || t.always) continue;
      const mx = t.maxHp || subMax[t.id] || (subMax[t.id] = Math.max(1, t.hp));
      out.push({ id: t.id, hp: Math.max(0, t.hp), maxHp: mx, alive: t.hp > 0 && t.alive !== false && !t.destroyed });
    }
    return out;
  }
  const subScratch = [];
  function updateSubs() {
    const list = subTargets(subScratch);
    const sig = list.length + ':' + list.map(t => t.id).join(',');
    if (sig !== subSig) {
      subSig = sig; E.subs.innerHTML = '';
      subEls = list.map(t => {
        const d = document.createElement('div'); d.className = list.length > 4 ? 'pip' : 'sub';
        d.innerHTML = '<div class="f"></div><span>' + String(t.id).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ') + '</span>';
        E.subs.appendChild(d); return { el: d, f: d.firstChild, k: 'sub' + t.id };
      });
    }
    for (let i = 0; i < list.length; i++) {
      const t = list[i], s = subEls[i]; if (!s) continue;
      const fr = clamp(t.hp / t.maxHp, 0, 1);
      setCls(s.el, 'dead', !t.alive);
      if (s.el.className.startsWith('pip')) setTx(s.f, s.k, 'scaleY(' + (1 - fr).toFixed(3) + ')');
      else setTx(s.f, s.k, 'scaleX(' + fr.toFixed(3) + ')');
    }
  }

  // ------------------------------------------------------------------
  // Flow state machine
  // ------------------------------------------------------------------
  const flow = G.flow = { state: 'boot', prev: null, data: {}, t: 0, pausedFrom: null, go, goFade };
  const FIGHTISH = { fight: 1, countdown: 1, warp: 1, tutorial: 1 };

  const savedData = {};
  function go(state, data = {}) {
    if (!ENTER[state]) { console.warn('[flow] unknown state', state); return false; }
    const prev = flow.state;
    savedData[prev] = flow.data;
    if (data && data.resume && savedData[state]) data = Object.assign({}, savedData[state], { resume: true });
    try { LEAVE[prev]?.(state); } catch (e) { G.logError('flow.leave.' + prev, e); }
    flow.prev = prev; flow.state = state; flow.data = data || {}; flow.t = 0;
    body.dataset.mode = state;
    G.emit('flow', { state, prev });
    try { ENTER[state](flow.data, prev); } catch (e) { G.logError('flow.enter.' + state, e); }
    return true;
  }
  let fading = false;
  function goFade(state, data, white) {
    if (TEST || fading) { if (!fading) go(state, data); return; }
    fading = true;
    E.fade.classList.toggle('white', !!white); E.fade.classList.add('on');
    setTimeout(() => {
      try { go(state, data); } finally {
        const done = () => { E.fade.classList.remove('on'); fading = false; };
        requestAnimationFrame(() => requestAnimationFrame(done));
        setTimeout(done, 700);   // fallback if frames are slow
      }
    }, 230);
  }

  // ---- cinematic cameras ----
  const camState = { shot: 0, shotT: 0, a0: 0 };
  function kartBasis() {
    const k = K();
    V.t.copy(k.camFwd); V.t.y = 0; if (V.t.lengthSq() < 1e-4) V.t.set(1, 0, 0); V.t.normalize();
    V.r.crossVectors(V.t, V.up).normalize();
    return k.renderPos;
  }
  // title / finale attract camera: cuts between 4 tracking shots
  function attractCam(t, cam) {
    const kp = kartBasis();
    const shot = Math.floor(t / 6.5) % 4, u = (t % 6.5) / 6.5;
    if (shot === 0) { cam.position.copy(kp).addScaledVector(V.t, 9 - u * 3).addScaledVector(V.r, 3.2).addScaledVector(V.up, 1.1); V.a.copy(kp).addScaledVector(V.up, 0.9); }
    else if (shot === 1) { cam.position.copy(kp).addScaledVector(V.r, -7.5).addScaledVector(V.up, 1.6).addScaledVector(V.t, -3 + u * 5); V.a.copy(kp).addScaledVector(V.t, 3).addScaledVector(V.up, 0.8); }
    else if (shot === 2) { cam.position.copy(kp).addScaledVector(V.t, -10).addScaledVector(V.up, 4.2 + u * 1.5); V.a.copy(kp).addScaledVector(V.t, 14).addScaledVector(V.up, 1); }
    else { const ang = u * 2.4 - 1.2; cam.position.copy(kp).addScaledVector(V.t, Math.cos(ang) * 8).addScaledVector(V.r, Math.sin(ang) * 8).addScaledVector(V.up, 2.4); V.a.copy(kp).addScaledVector(V.up, 0.8); }
    if (flow.state === 'title') {
      // shift the aim left of the kart (screen space) so the kart sits in the right third
      V.c.subVectors(V.a, cam.position); const dl = V.c.length(); V.c.normalize();
      V.b.crossVectors(V.c, V.up).normalize();
      V.a.addScaledVector(V.b, -dl * 0.3);
    }
    cam.up.set(0, 1, 0); cam.lookAt(V.a);
    if (Math.abs(cam.fov - 62) > 0.01) { cam.fov = 62; cam.updateProjectionMatrix(); }
  }
  function bossCenter(out) {
    const bc = hudInfo.def?.briefCam;
    if (bc && bc.target) out.set(bc.target[0], bc.target[1], bc.target[2]);
    else out.set(0, (hudInfo.def?.boss?.height || 20) * 0.5, 0);
    return out;
  }
  // briefing: slow orbit around the boss, framed to the right of the text panel
  function briefCam(t, cam) {
    const bc = hudInfo.def?.briefCam || {};
    bossCenter(V.b);
    const r = bc.r || 62, h = bc.h || 16, ang = camState.a0 + t * 0.12;
    cam.position.set(V.b.x + Math.cos(ang) * r, V.b.y + h, V.b.z + Math.sin(ang) * r);
    V.c.subVectors(V.b, cam.position).normalize(); V.r.crossVectors(V.c, V.up).normalize();
    V.a.copy(V.b).addScaledVector(V.r, -r * 0.32);
    cam.up.set(0, 1, 0); cam.lookAt(V.a);
    if (Math.abs(cam.fov - 55) > 0.01) { cam.fov = 55; cam.updateProjectionMatrix(); }
  }
  // intro: sweeping flyby around the boss that ends exactly at the chase position
  function introCam(t, cam) {
    const D = 3.6;
    bossCenter(V.b);
    const u = clamp(t / D, 0, 1), e = u * u * (3 - 2 * u);
    const ang = camState.a0 + e * 2.0, r = 120 - e * 70, h = 55 - e * 40;
    V.c.set(V.b.x + Math.cos(ang) * r, V.b.y + h, V.b.z + Math.sin(ang) * r);
    V.q.copy(V.b);
    const k = K(); const kp = kartBasis();
    const w = clamp((t - (D - 1.1)) / 1.1, 0, 1), we = w * w * (3 - 2 * w);
    if (we > 0) {   // blend into the chase camera behind the kart
      V.a.copy(kp).addScaledVector(V.t, -G.cam.dist).addScaledVector(V.up, G.cam.height);
      V.c.lerp(V.a, we);
      V.a.copy(kp).addScaledVector(V.t, G.cam.lookAhead).addScaledVector(V.up, 0.9);
      V.q.lerp(V.a, we);
    }
    cam.position.copy(V.c); cam.up.set(0, 1, 0); cam.lookAt(V.q);
    const f = 58 + we * (G.cam.fovBase - 58);
    if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.updateProjectionMatrix(); }
    if (k) k.bot = false;
  }

  // ---- state handlers ----
  const ENTER = {}, LEAVE = {}, TICK = {};

  ENTER.boot = () => { };

  ENTER.title = () => {
    endCombat();
    ensureArena('title', TITLE_ARENA);
    body.style.setProperty('--accent', '#ff3df2');
    const k = K(); k.reset(true); k.bot = true; k.frozen = false; k.god = true;
    camState.shot = 0; G.cam.setCinematic(attractCam);
    G.post?.setVignette?.(0.32);
    buildBossCards(); refreshSettingsUI();
    $('screen-title').classList.toggle('menu', titleMenu);
    if (!TEST) { try { G.audio?.music?.play?.('title'); } catch (e) { } }
  };
  LEAVE.title = () => { const k = K(); k.bot = false; k.god = !!G.params.god; G.post?.setVignette?.(0.25); };
  let titleMenu = false;
  function showTitleMenu() { if (titleMenu) return; titleMenu = true; $('screen-title').classList.add('menu'); sfx('uiConfirm'); setTimeout(() => $('btn-start')?.focus?.({ preventScroll: true }), 50); }

  function buildBossCards() {
    const host = $('boss-cards'); if (!host) return;
    let h = '';
    for (let n = 1; n <= 3; n++) {
      const I = info(n), b = save.best[n], locked = n > save.unlocked && !TEST && !G.params.debug;
      h += `<button class="bcard${locked ? ' locked' : ''}" data-boss="${n}" style="--c:${I.accent}"${locked ? ' aria-disabled="true"' : ''}>
        <div class="n">BOSS 0${n}</div><div class="nm">${locked ? '???' : I.name}</div><div class="ar">${I.arena}</div>
        <div class="best">${locked ? 'LOCKED' : b ? 'BEST ' + fmtT2(b.time) + '<b>' + b.grade + '</b>' : 'NOT CLEARED'}</div></button>`;
    }
    host.innerHTML = h;
  }

  ENTER.briefing = (d) => {
    const n = clamp(d.boss || fight.n || 1, 1, 3);
    fight.n = n;
    bossArena(n);
    const k = K(); k.reset(true); k.bot = false; k.startCountdown(1e9);   // frozen at the start line
    camState.a0 = -0.6; G.cam.setCinematic(briefCam);
    const I = hudInfo;
    $('br-tag').textContent = 'BOSS 0' + n + ' / 03  ·  ' + G.difficulty.toUpperCase();
    $('br-name').textContent = I.name; $('br-title').textContent = I.title;
    $('br-arena').innerHTML = 'ARENA <b>' + I.arena + '</b>';
    $('br-tips').innerHTML = (I.tips || []).slice(0, 3).map((t, i) => `<div class="tip"><div class="i">${i + 1}</div><div class="x">${bold(t)}</div></div>`).join('');
    const bc = $('br-ctl'); if (bc) bc.innerHTML = n === 1 || !save.tutorialDone ? controlsHTML() : '';
    const b = save.best[n];
    $('br-best').textContent = b ? 'BEST ' + fmtT2(b.time) + ' · ' + b.grade : '';
    $('br-stats').innerHTML = `HP <b>${(I.hp ? Math.round(I.hp * G.diffCfg.hpMult) : '—').toLocaleString()}</b><br>TARGET <b>${fmtClock(I.target)}</b><br>ENRAGE <b>${fmtClock(I.soft * G.diffCfg.enrageMult)}</b>`;
    setTimeout(() => $('btn-fight')?.focus?.({ preventScroll: true }), 60);
  };
  LEAVE.briefing = () => { };

  ENTER.intro = () => {
    if (TEST) { go('countdown'); return; }
    const I = hudInfo;
    $('in-tag').textContent = 'BOSS 0' + fight.n + '  ·  ' + I.arena;
    $('in-name').textContent = I.name; $('in-title').textContent = I.title;
    ['in-name', 'in-title'].forEach(id => restartAnim($(id)));
    camState.a0 = Math.atan2(K().renderPos.z, K().renderPos.x) + Math.PI * 0.9;
    G.cam.setCinematic(introCam);
    setTimeout(() => { if (flow.state === 'intro') { sfx('roar'); G.cam.shake(0.35); } }, 900);
  };
  TICK.intro = () => { if (flow.t > 3.7) go('countdown'); };

  const cd = { last: -1, savedT: 0 };
  ENTER.countdown = (d, prev) => {
    if (d.resume) { flow.t = cd.savedT; return; }
    if (prev !== 'intro' && prev !== 'briefing' && !d.restart) bossArena(fight.n);
    endCombat();
    const k = K(); k.reset(true); k.bot = false; k.startCountdown(3);
    G.cam.setCinematic(null); G.cam.snap();
    if (d.restart || prev === 'briefing' || prev === 'intro') resetFightStats();
    cd.last = -1;
  };
  LEAVE.countdown = () => { cd.savedT = flow.t; };
  TICK.countdown = () => {
    const t = flow.t, n = Math.floor(t);
    if (n !== cd.last && n <= 3) {
      cd.last = n;
      const el = E.countdown;
      el.textContent = n < 3 ? String(3 - n) : 'GO!';
      el.className = 'on' + (n === 3 ? ' go' : '');
      restartAnim(el);
      sfx('countdown', { n: n < 3 ? 3 - n : 0 });
      if (n === 3) { go('fight', { fromCountdown: true }); return; }
    }
    // launch window (kart: 1.0 s .. 0.5 s before GO)
    const win = t >= 2.0 && t < 2.5;
    setCls(E.countdown, 'win', win);
    setText(E.cdHint, 'cdh', win ? 'NOW!' : 'PRESS DRIFT JUST BEFORE GO FOR A PERFECT START');
  };

  ENTER.fight = (d, prev) => {
    G.time.paused = false;
    if (prev === 'paused' || d.resume) return;                  // resume
    if (prev === 'defeat' && !d.restart) { retryCheckpoint(); return; }
    if (prev === 'countdown' || d.fromCountdown) {              // GO!
      G.cam.setCinematic(null);
      beginCombat(fight.n, 1);
      if (fight.n === 1 && !save.tutorialDone && (!TEST || FORCE_HINTS)) prompt(touchUI() ? 'HOLD DRIFT THROUGH CURVES · RELEASE TO FIRE' : 'HOLD SPACE THROUGH CURVES · RELEASE TO FIRE', 4.5, touchUI() ? 'TAP DRIFT = HOP' : 'TAP SPACE = HOP');
      return;
    }
    // direct entry (test boot, skipToBoss, goto)
    setupFight(d.boss || G.params.boss || fight.n || 1, d.phase || (prev === 'boot' ? G.params.phase : 1) || 1);
  };
  TICK.fight = () => {
    // wipe -> defeat after the wreck explosion has played
    if (fight.defeatAt > 0 && G.time.real >= fight.defeatAt) { fight.defeatAt = -1; go('defeat'); }
  };

  // victory: death cinematic (boss module) + UI fallback shard finisher, then results
  ENTER.victory = () => {
    fight.endTime = fightTime();
    fight.active = false;
    const I = hudInfo;
    $('vi-n').textContent = I.name;
    $('vi-t').textContent = fight.n >= 3 ? 'CHECKMATE' : 'SHATTERED';
    $('vi-s').textContent = 'RAID CLEARED  ·  ' + fmtT2(fight.endTime);
    // the title waits for the death climax (lower third, smaller), and the results wait for the aftermath
    const deathDur = +(I.def && I.def.boss && I.def.boss.deathDur) || 3.2;
    vic.showAt = Math.max(1.5, deathDur - 1.0); vic.hold = Math.max(4.6, deathDur + 2.0); vic.shown = false;
    $('screen-victory').classList.remove('show');
    // clear stacked callouts / banner / prompts so nothing sits on top of the finisher
    for (const c of E.co) { c.end = 0; c.el.className = 'co'; }
    bannerEnd = 0; E.banner.classList.remove('on'); promptQ.length = 0; promptEnd = 0; E.prompt.classList.remove('on');
    const hasDeath = !!(I.def && I.def.boss && I.def.boss.death);
    if (!hasDeath) {
      try {
        bossCenter(V.b); if (G.boss?.root) G.boss.root.getWorldPosition(V.b), V.b.y += 8;
        G.time.slowmo(0.2, 1.0);
        G.fx?.shards?.(G.boss?.root || V.b, 400, I.accent);
        G.fx?.burst?.('explosion', V.b, { scale: 3 }); G.fx?.burst?.('gold', V.b, { count: 120, scale: 2 });
        G.fx?.shockwave?.(V.b, { color: 0xffc93a, radius: 60, dur: 1.2 });
        G.fx?.bloomPulse?.(1.6, 1.2); G.post?.flash?.('#fff3d6', 0.9, 1.2);
        G.cam.shake(0.7); if (G.boss?.root) G.boss.root.visible = false;
      } catch (e) { G.logError('ui.finisher', e); }
    }
    G.cam.lookAtBoss(0.65, 3.5);
    computeResult();
  };
  const vic = { showAt: 1.5, hold: 4.6, shown: false };
  TICK.victory = () => {
    if (flow.t > 1.2) K().bot = true;   // let the autopilot cruise behind the results
    if (!vic.shown && flow.t >= vic.showAt) { vic.shown = true; $('screen-victory').classList.add('show'); }
    if (flow.t > vic.hold) go('results');
  };

  function gradeFor(time, hits, retries, target) {
    let g = time <= target && hits <= 3 ? 'S' : time <= target * 1.3 && hits <= 10 ? 'A' : time <= target * 1.9 ? 'B' : 'C';
    if (retries > 0 && (g === 'S' || g === 'A')) g = 'B';
    return g;
  }
  const GRADE_ORDER = { S: 4, A: 3, B: 2, C: 1 };
  const GRADE_COL = { S: '#ffc93a', A: '#33f6ff', B: '#c04bff', C: '#9aa3c0' };
  function computeResult() {
    const k = K(), n = fight.n, I = hudInfo;
    const time = fight.endTime, hits = k.stats.hits | 0;
    const grade = gradeFor(time, hits, fight.retries, I.target);
    const prev = save.best[n];
    const newBest = !prev || time < prev.time;
    if (!TEST) {
      save.best[n] = { time: newBest ? time : prev.time, grade: prev && GRADE_ORDER[prev.grade] > GRADE_ORDER[grade] ? prev.grade : grade };
      save.unlocked = Math.max(save.unlocked, Math.min(3, n + 1));
      if (n === 3) save.cleared = true;
      if (n === 1) save.tutorialDone = true;
      persist();
    }
    fight.result = { boss: n, time, grade, hits, newBest, grazes: fight.grazes, megas: fight.megas, perfects: k.stats.perfects | 0, comets: k.stats.comets | 0,
      interrupts: fight.interrupts, credits: fight.creditsUsed, retries: fight.retries, releases: k.stats.releases | 0 };
    run.results[n - 1] = fight.result;
  }

  ENTER.results = () => {
    const r = fight.result || (computeResult(), fight.result);
    const I = hudInfo;
    $('res-kick').textContent = 'RAID CLEARED  ·  BOSS 0' + r.boss;
    $('res-name').textContent = I.name;
    const g = $('res-grade'); g.textContent = r.grade; g.style.setProperty('--gc', GRADE_COL[r.grade]); restartAnim(g);
    $('res-time').textContent = fmtT2(r.time);
    const best = save.best[r.boss];
    const rb = $('res-best'); rb.className = r.newBest ? 'new' : ''; rb.textContent = r.newBest ? 'NEW BEST TIME!' : best ? 'BEST ' + fmtT2(best.time) + ' · TARGET ' + fmtClock(I.target) : 'TARGET ' + fmtClock(I.target);
    const row = (l, v) => `<div>${l}<b>${v}</b></div>`;
    $('res-stats').innerHTML = row('HITS TAKEN', r.hits) + row('GRAZES', r.grazes) + row('PERFECT DASH', r.perfects) + row('COMETS', r.comets) + row('INTERRUPTS', r.interrupts) + row('CREDITS USED', r.credits)
      + (r.retries ? row('RETRIES', r.retries) : '') + (r.megas ? row('MEGA GRAZES', r.megas) : '') + row('VOLLEYS', r.releases);
    $('btn-next').querySelector('span').textContent = r.boss >= 3 ? 'FINALE' : 'CONTINUE';
    sfx('victory');
    setTimeout(() => $('btn-next')?.focus?.({ preventScroll: true }), 60);
  };
  function nextFromResults() {
    const n = fight.n;
    if (n >= 3) goFade('finale', {}, true);
    else goFade('garage', { next: n + 1 });
  }

  let garageMods = [];
  ENTER.garage = (d) => {
    const owned = K().mods || {};
    const pool = MODS.filter(m => !owned[m.id]);
    for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    garageMods = pool.slice(0, 3);
    $('mods').innerHTML = garageMods.length ? garageMods.map((m, i) => `<button class="mod" data-mod="${m.id}"><div class="ic">${m.ic}</div><div class="nm"><span class="kn">${i + 1} · </span>${m.name}</div><div class="ds">${m.desc}</div></button>`).join('')
      : '<div class="ds" style="opacity:.7">All mods installed. Your kart is maxed out.</div>';
    $('btn-skipmod').style.visibility = 'hidden';
    flow.data.next = d.next || Math.min(3, fight.n + 1);
    if (!garageMods.length) setTimeout(() => flow.state === 'garage' && goFade('warp', { next: flow.data.next }), 1200);
  };
  TICK.garage = () => { if (flow.t > 2) $('btn-skipmod').style.visibility = 'visible'; };
  function pickMod(id) {
    if (flow.state !== 'garage') return;
    const m = MODS.find(x => x.id === id); if (!m) return;
    K().mods[id] = true; sfx('uiConfirm'); toast('INSTALLED: ' + m.name);
    goFade('warp', { next: flow.data.next });
  }

  ENTER.warp = (d) => {
    if (d.resume) { flow.t = warpSavedT; return; }
    const next = clamp(d.next || fight.n + 1, 1, 3);
    flow.data.next = next;
    endCombat();
    ensureArena('warp', WARP_ARENA);
    try { G.sky?.set?.('warp', { axis: V.a.set(1, 0, 0) }); } catch (e) { }
    body.style.setProperty('--accent', '#33f6ff');
    const k = K(); k.reset(true); k.bot = false; k.frozen = false; k.speed = 30; k.boost?.(12, 1.2, 'launch');
    k.flux = Math.max(k.flux, 60);          // enough for the dash / overclock drill
    G.cam.setCinematic(null); G.cam.snap();
    $('wp-n').textContent = info(next).arena;
    hudInfo = info(next);
  };
  let warpSavedT = 0;
  LEAVE.warp = () => { warpSavedT = flow.t; };
  TICK.warp = () => {
    setTx(document.querySelector('#wp-bar i'), 'wpb', 'scaleX(' + clamp(flow.t / 8, 0, 1).toFixed(3) + ')');
    const t = touchUI(), drill = flow.t < 2.7 ? (t ? 'DRILL 1/3 · HOLD DRIFT, RELEASE AT ORANGE' : 'DRILL 1/3 · HOLD SPACE, RELEASE AT ORANGE')
      : flow.t < 5.4 ? (t ? 'DRILL 2/3 · TAP DASH (INVULNERABLE)' : 'DRILL 2/3 · PRESS J TO DASH (INVULNERABLE)')
      : (t ? 'DRILL 3/3 · OVERCLOCK = 2× CHARGE (50 FLUX)' : 'DRILL 3/3 · L = OVERCLOCK, 2× CHARGE (50 FLUX)');
    setText($('wp-hint'), 'wph', drill);
    if (flow.t > 8) goFade('briefing', { boss: flow.data.next }, true);
  };

  ENTER.defeat = (d, prev) => {
    fight.active = false; fight.defeatAt = -1;
    if (prev !== 'paused') G.time.slowmo(0.3, 1.3);
    const b = G.boss, frac = b && b.maxHp ? clamp(b.hp / b.maxHp, 0, 1) : 1;
    $('df-s').textContent = hudInfo.name + ' AT ' + Math.ceil(frac * 100) + '%  ·  ' + fmtT(fightTime());
    $('df-hp').firstChild.style.transform = 'scaleX(' + frac.toFixed(3) + ')';
    $('btn-retry').querySelector('span').innerHTML = 'RETRY FROM PHASE ' + (curPhase0() + 1) + ' <kbd>R</kbd>';
    setTimeout(() => $('btn-retry')?.focus?.({ preventScroll: true }), 60);
  };
  TICK.defeat = () => {
    G.post?.setMono?.(clamp(flow.t / 1.0, 0, 1));
    if (flow.t > 1.4 && !G.time.paused) G.time.paused = true;   // freeze the world behind the menu
  };
  LEAVE.defeat = () => { G.post?.setMono?.(0); G.time.paused = false; };

  // class kit / controls card (pause screen + Boss 1 briefing); fits a 360 px tall phone
  function controlsHTML() {
    const t = touchUI();
    const k = (lbl, col, txt) => `<div class="k" style="--bc:${col}"><span class="b">${lbl}</span><span class="d">${txt}</span></div>`;
    return `<div class="ctl-h">VOLT &middot; ARC RUNNER &middot; CLASS KIT</div><div class="ctl">`
      + k(t ? 'STICK' : 'A / D', '#33f6ff', t ? '<b>STEER</b><br>PULL DOWN = BRAKE' : '<b>STEER</b><br>S = BRAKE')
      + k(t ? 'DRIFT' : 'SPACE', '#3fa9ff', '<b>HOLD</b> = CHARGE &middot; <b>RELEASE</b> = FIRE<br><b>TAP</b> = HOP')
      + k(t ? 'DASH' : 'J', '#33f6ff', '<b>INVULNERABLE LUNGE</b> <i>25 FLUX</i><br>' + (t ? 'SLIDE DRIFT THUMB ONTO DASH' : 'KEEPS YOUR DRIFT CHARGE'))
      + k(t ? 'OVER<br>CLOCK' : 'L', '#c04bff', '<b>2&times; CHARGE</b> <i>50 FLUX</i><br><b>COMET</b>: BREAK + 100 FLUX')
      + `</div>`;
  }
  ENTER.paused = (d, prev) => {
    if (prev !== 'paused') flow.pausedFrom = FIGHTISH[prev] ? prev : 'fight';
    G.time.paused = true;
    $('pause-help').innerHTML = touchUI() ? '' : 'E ITEM &middot; ESC PAUSE &middot; GRAZE DANGER EDGES FOR FLUX';
    const pc = $('pause-ctl'); if (pc) pc.innerHTML = controlsHTML();
  };
  LEAVE.paused = (next) => { if (next !== 'defeat') G.time.paused = false; };
  function resume() { if (flow.state === 'paused') go(flow.pausedFrom || 'fight', { resume: true }); }
  function pauseGame() { if (FIGHTISH[flow.state]) { go('paused'); sfx('uiClick'); } }

  let fwT = 0;
  ENTER.finale = () => {
    const k = K(); k.bot = true; k.god = true;
    G.cam.setCinematic(attractCam);
    try { G.sky?.setDawn?.(1); } catch (e) { }
    let total = 0, gsum = 0, cnt = 0, rows = '';
    for (let n = 1; n <= 3; n++) {
      const r = run.results[n - 1], b = save.best[n], I = info(n);
      if (r) { total += r.time; gsum += GRADE_ORDER[r.grade]; cnt++; }
      rows += `<div>${I.name}</div><div>${r ? fmtT2(r.time) : '—'}</div><div>${r ? '<b>' + r.grade + '</b>' : ''} ${b ? '<span style="opacity:.6">BEST ' + fmtT2(b.time) + '</span>' : ''}</div>`;
    }
    const avg = cnt ? gsum / cnt : 0, tg = avg >= 3.67 ? 'S' : avg >= 2.67 ? 'A' : avg >= 1.67 ? 'B' : 'C';
    $('fn-table').innerHTML = rows;
    $('fn-total').innerHTML = cnt ? 'TOTAL ' + fmtT2(total) + ' &middot; GRADE <span style="color:' + GRADE_COL[tg] + '">' + tg + '</span>' : '';
    document.querySelector('[data-act="mythic"]').style.display = save.cleared || TEST ? '' : 'none';
    fwT = 0;
  };
  TICK.finale = (rdt) => {
    fwT -= rdt;
    if (fwT <= 0 && G.fx?.burst) {
      fwT = 0.35 + Math.random() * 0.5;
      const k = K(); kartBasis();
      V.c.copy(k.renderPos).addScaledVector(V.t, 30 + Math.random() * 40).addScaledVector(V.r, (Math.random() - 0.5) * 40).addScaledVector(V.up, 18 + Math.random() * 20);
      try { G.fx.burst('firework', V.c, { color: [0xffc93a, 0x33f6ff, 0xff3df2, 0xc04bff][(Math.random() * 4) | 0], scale: 1.5 }); } catch (e) { }
    }
  };
  LEAVE.finale = () => { const k = K(); k.bot = false; k.god = !!G.params.god; };
  ENTER.credits = (d) => ENTER.finale(d);
  TICK.credits = (rdt) => TICK.finale(rdt);
  LEAVE.credits = () => LEAVE.finale();
  ENTER.tutorial = () => go('briefing', { boss: 1 });   // tutorial is folded into Boss 1's first-run prompts

  // ------------------------------------------------------------------
  // Actions (buttons by id / data-act) and keyboard
  // ------------------------------------------------------------------
  function startBoss(n) {
    if (n > save.unlocked && !TEST && !G.params.debug) { toast('CLEAR BOSS 0' + (n - 1) + ' TO UNLOCK'); sfx('fizz'); return; }
    sfx('uiConfirm'); run.results = []; goFade('briefing', { boss: n });
  }
  function toFight() { if (flow.state !== 'briefing') return; sfx('uiConfirm'); goFade('intro', {}); }
  function restartFight() {
    if (TEST) { go('fight', { boss: fight.n, restart: true }); return; }
    goFade('countdown', { restart: true });
  }
  function quitToTitle() { sfx('uiClick'); goFade('title'); }
  function doRetry() { if (flow.state === 'defeat' || flow.state === 'paused') { if (flow.state === 'paused') { go('defeat'); } go('fight', {}); } }
  const ACT = {
    settings: () => { E.settings.classList.add('open'); refreshSettingsUI(); sfx('uiClick'); },
    closesettings: () => { E.settings.classList.remove('open'); sfx('uiClick'); },
    resume, retry: doRetry, restart: restartFight, quit: quitToTitle,
    skipmod: () => goFade('warp', { next: flow.data.next }),
    skipwarp: () => goFade('briefing', { boss: flow.data.next }, true),
    again: () => { run.results = []; goFade('briefing', { boss: 1 }); },
    mythic: () => { save.settings.diff = 'mythic'; applySettings(); persist(); run.results = []; goFade('briefing', { boss: 1 }); },
  };
  function onClick(e) {
    const t = e.target.closest && e.target.closest('button,[data-act]');
    if (!t) {
      if (flow.state === 'title' && !titleMenu) showTitleMenu();
      return;
    }
    const id = t.id;
    if (id === 'btn-start') return startBoss(1);
    if (id === 'btn-fight') return toFight();
    if (id === 'btn-next') return nextFromResults();
    if (id === 'btn-retry') return doRetry();
    if (id === 'btn-restart') return restartFight();
    if (id === 'btn-quit') return quitToTitle();
    if (id === 'btn-pause') return flow.state === 'paused' ? resume() : pauseGame();
    if (t.dataset.boss) return startBoss(+t.dataset.boss);
    if (t.dataset.mod) return pickMod(t.dataset.mod);
    if (t.dataset.diff) { if (t.disabled) return; save.settings.diff = t.dataset.diff; applySettings(); persist(); refreshSettingsUI(); sfx('uiClick'); return; }
    if (t.dataset.v !== undefined && t.parentElement?.dataset.set) return setSetting(t.parentElement.dataset.set, t.dataset.v);
    if (t.dataset.act && ACT[t.dataset.act]) return ACT[t.dataset.act]();
  }
  // Android Chrome: go fullscreen + lock landscape on the first touch; iOS Safari: one-time home-screen tip
  let fsTried = false;
  function tryFullscreen(e) {
    if (fsTried || TEST || e.pointerType !== 'touch') return;
    fsTried = true;
    const de = document.documentElement;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (de.requestFullscreen && !document.fullscreenElement && !standalone) {
      try {
        de.requestFullscreen({ navigationUI: 'hide' }).then(() => { try { return screen.orientation?.lock?.('landscape'); } catch (er) { } }).catch(() => { });
      } catch (er) { }
    } else if (/iP(hone|od|ad)/.test(navigator.userAgent) && !standalone && !save.hints.ios) {
      save.hints.ios = 1; persist();
      setTimeout(() => toast('TIP: SHARE → ADD TO HOME SCREEN FOR FULLSCREEN'), 600);
    }
  }
  function onPointerDown(e) {
    tryFullscreen(e);
    // tap-anywhere conveniences (not on buttons)
    if (e.target.closest && e.target.closest('button,input')) return;
    if (flow.state === 'title' && !titleMenu) showTitleMenu();
    else if (flow.state === 'intro' && flow.t > 0.3) go('countdown');
    else if (flow.state === 'briefing' && flow.t > 0.4 && e.target.closest('#screen-briefing')) toFight();
  }
  function onKey(e) {
    if (e.repeat) return;
    const c = e.code, st = flow.state;
    if (E.settings.classList.contains('open')) { if (c === 'Escape') ACT.closesettings(); return; }
    if (G.params.debug) debugKey(e);
    if (c === 'Escape' || c === 'KeyP') {
      if (st === 'paused') { resume(); e.preventDefault(); return; }
      if (FIGHTISH[st]) { pauseGame(); e.preventDefault(); return; }
      if (st === 'briefing') { quitToTitle(); return; }
    }
    const confirm = c === 'Enter' || c === 'NumpadEnter';
    const onBtn = document.activeElement && document.activeElement.tagName === 'BUTTON';
    if (st === 'title') {
      if (!titleMenu) { showTitleMenu(); e.preventDefault(); return; }
      if (confirm && !onBtn) { startBoss(1); e.preventDefault(); }
      else if (c === 'Digit1' || c === 'Digit2' || c === 'Digit3') startBoss(+c.slice(5));
    } else if (st === 'briefing') {
      if ((confirm && !onBtn) || c === 'Space' || c === 'KeyW' || c === 'ArrowUp') { toFight(); e.preventDefault(); }
    } else if (st === 'intro') { if (flow.t > 0.3) go('countdown'); }
    else if (st === 'results') { if (confirm && !onBtn) { nextFromResults(); e.preventDefault(); } }
    else if (st === 'garage') { const i = { Digit1: 0, Digit2: 1, Digit3: 2 }[c]; if (i !== undefined && garageMods[i]) pickMod(garageMods[i].id); }
    else if (st === 'warp') { if (confirm) ACT.skipwarp(); }
    else if (st === 'defeat') { if (c === 'KeyR') doRetry(); else if (confirm && !onBtn) doRetry(); }
    else if (st === 'fight' && c === 'KeyR' && !G.boss) { }
  }

  // debug keys (?debug=1): F1 god, F2 skip phase, F3 kill, F4 flux, F5 stagger, 1/2/3 jump to boss
  function debugKey(e) {
    const c = e.code;
    const map = {
      F1: () => { cheats.godMode(!K().god); toast('GOD ' + (K().god ? 'ON' : 'OFF')); },
      F2: () => cheats.setPhase(curPhase0() + 2), F3: () => cheats.killBoss(), F4: () => cheats.setFlux(100), F5: () => cheats.forceStagger(6),
    };
    if (map[c]) { e.preventDefault(); map[c](); return; }
    if ((c === 'Digit1' || c === 'Digit2' || c === 'Digit3') && FIGHTISH[flow.state]) cheats.skipToBoss(+c.slice(5));
  }

  // ------------------------------------------------------------------
  // Event wiring
  // ------------------------------------------------------------------
  let hitFlashT = 0, hpHitT = 0;
  function wire() {
    G.on('boss:phase', (e) => {
      // COMBAT shows the phase banner itself (G.ui.banner); just refresh the bar colour
      cache.delete('hpc');
    });
    G.on('boss:stagger', (e) => {
      if (e && e.on) {
        fight.staggerDur = e.dur || G.boss?.staggerDur || 6; callout('BREAK!', 'break');
        if (flow.state === 'fight') {
          if ((K().flux || 0) >= 100) hint('comet', touchUI() ? 'COMET READY · TAP COMET!' : 'COMET READY · PRESS L!', 'HUGE DAMAGE WHILE THE BOSS IS BROKEN', 4);
          else hint('break', 'BREAK! THE BOSS TAKES EXTRA DAMAGE', 'FILL FLUX TO 100 DURING A BREAK FOR A COMET', 4.5);
        }
      }
    });
    G.on('tele:spawn', (e) => {
      if (flow.state !== 'fight' || !e || (e.kind && e.kind !== 'damage' && e.kind !== 'knock')) return;
      hint('dash', touchUI() ? 'TAP DASH TO PHASE THROUGH ATTACKS' : 'PRESS J TO DASH THROUGH ATTACKS', 'ARC DASH = INVULNERABLE LUNGE · 25 FLUX · FIRST ONE FREE', 4.5);
    });
    G.on('boss:cast', (e) => {
      if (e && e.interruptible && fight.firstCast && fight.n === 1 && !save.tutorialDone && (!TEST || FORCE_HINTS)) { fight.firstCast = false; promptQ.length = 0; promptEnd = 0; prompt('RELEASE A VIOLET DRIFT TO INTERRUPT!', 4.5, touchUI() ? 'HOLD DRIFT ~2.3 S FOR VIOLET' : 'HOLD SPACE ~2.3 S FOR VIOLET'); }
    });
    G.on('boss:castEnd', (e) => { if (e && e.interrupted) { fight.interrupts++; callout('INTERRUPTED!', 'interrupt'); } });
    G.on('boss:enrage', (e) => { callout(e && e.level >= 2 ? 'HARD ENRAGE' : 'ENRAGE', 'enrage'); });
    G.on('boss:damaged', (e) => {
      hpHitT = 0.07;
      const a = (e && e.amount) || 0; if (a > 0) { dps.t[dps.i] = G.time.now; dps.a[dps.i] = a; dps.i = (dps.i + 1) % dps.t.length; }
    });
    G.on('kart:graze', (e) => { fight.grazes++; if (flow.state === 'fight') hint('graze', 'GRAZE! +FLUX', 'SKIM THE EDGE OF DANGER ZONES TO FILL FLUX', 3.5); if (e && e.mega) { fight.megas++; callout('MEGA GRAZE!', 'gold'); } });
    G.on('kart:hit', () => { hitFlashT = 0.12; });
    G.on('kart:wreck', (e) => {
      if (!fight.active) return;
      if (e && e.wipe) { callout('WIPED', 'danger'); fight.defeatAt = G.time.real + 1.1; }
      else { fight.creditsUsed++; callout('WRECKED', 'danger'); toast('PIT CREDIT USED · ' + ((e && e.credits) ?? K().credits) + ' LEFT'); }
    });
    G.on('boss:dead', () => { if (flow.state === 'fight' || flow.state === 'countdown') go('victory'); });
    G.on('fight:end', (e) => {
      if (!e) return;
      if (e.win) { if (flow.state === 'fight') go('victory'); }
      else if (flow.state === 'fight' && fight.defeatAt < 0) fight.defeatAt = G.time.real + 0.9;
    });
    G.on('input:autopause', (e) => { if (e && e.on && !TEST) pauseGame(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !TEST) pauseGame(); });
    addEventListener('click', onClick);
    addEventListener('pointerdown', onPointerDown);
    addEventListener('keydown', onKey);
    document.querySelectorAll('[data-range]').forEach(r => r.addEventListener('input', () => { try { G.audio?.setVolume?.(r.dataset.range, +r.value); } catch (e) { } }));
  }

  // ------------------------------------------------------------------
  // HUD update (real time, every rendered frame)
  // ------------------------------------------------------------------
  const chip = { v: 1, hold: 0 };
  const HPC = ['linear-gradient(90deg,#ff3a1a,#ff8a1f 60%,#ffc93a)', 'linear-gradient(90deg,#ff1a4a,#ff3a1a 55%,#ff8a1f)', 'linear-gradient(90deg,#c04bff,#ff2a3a 55%,#ff6a1a)', 'linear-gradient(90deg,#ffffff,#ff2a3a)'];
  const TIER_NAME = ['', 'BLUE', 'ORANGE', 'REDLINE'];
  let txtAcc = 0, itemShown = null, itemRollT = 0, itemRollIdx = 0, dbgAcc = 0;

  function updateHud(rdt) {
    const k = K(); if (!k) return;
    const st = flow.state;
    const txt = (txtAcc += rdt) >= 1 / 15; if (txt) txtAcc = 0;
    const inFight = st === 'fight' || st === 'countdown' || st === 'paused' || st === 'victory' || st === 'defeat';

    // ---- boss block ----
    const b = G.boss;
    const showBoss = !!(b && inFight);
    setCls(E.hudBoss, 'none', !showBoss);
    if (showBoss) {
      const frac = b.maxHp ? clamp(b.hp / b.maxHp, 0, 1) : 0;
      setTx(E.hpFill, 'hpf', 'scaleX(' + frac.toFixed(4) + ')');
      if (frac < chip.v) { chip.hold += rdt; if (chip.hold > 0.45) chip.v = Math.max(frac, chip.v - rdt * 0.35); } else { chip.v = frac; chip.hold = 0; }
      setTx(E.hpChip, 'hpc2', 'scaleX(' + chip.v.toFixed(4) + ')');
      if (hpHitT > 0) hpHitT -= rdt;
      setCls(E.hp, 'hit', hpHitT > 0);
      const ph = curPhase0();
      setVar(E.hp, 'hpc', '--hpc', HPC[Math.min(ph, HPC.length - 1)]);
      setCls(E.hp, 'stag', !!b.staggered);
      if (txt) {
        setText(E.hpPct, 'hpp', (frac * 100).toFixed(frac < 0.1 ? 1 : 0) + '%');
        const pn = b.phaseName || bossPhases()[ph]?.name || '';
        setText(E.phaseLbl, 'phl', 'P' + (ph + 1) + (pn ? ' · ' + pn : ''));
      }
      // stagger
      if (b.staggered) {
        const rem = typeof b.staggerT === 'number' ? b.staggerT : 0;
        setTx(E.stagFill, 'stf', 'scaleX(' + clamp(rem / (b.staggerDur || fight.staggerDur || 6), 0, 1).toFixed(3) + ')');
      } else setTx(E.stagFill, 'stf', 'scaleX(' + clamp(b.stagger || 0, 0, 1).toFixed(3) + ')');
      setCls(E.stag, 'on', !!b.staggered);
      // cast bar
      const c = b.cast;
      const castOn = !!(c && c.dur > 0 && (c.t ?? 0) <= c.dur + 0.05 && !c.done);
      setCls(E.cast, 'on', castOn);
      if (castOn) {
        setText(E.castName, 'cn', String(c.name || '').toUpperCase());
        setCls(E.cast, 'int', !!c.interruptible);
        setText(E.castHint, 'ch', c.label || (c.interruptible ? 'REDLINE TO INTERRUPT' : ''));
        setTx(E.castFill, 'cf', 'scaleX(' + clamp((c.t || 0) / c.dur, 0, 1).toFixed(3) + ')');
      }
      if (txt) updateSubs();
      // enrage timer
      if (txt) {
        const t = fightTime(), soft = b.softEnrage ?? hudInfo.soft * G.diffCfg.enrageMult, hard = b.hardEnrage ?? hudInfo.hard * G.diffCfg.enrageMult;
        setCls(E.enr, 'none', false);
        if (t < soft) { setText(E.enrL, 'el', 'ENRAGE'); setText(E.enrV, 'ev', fmtClock(soft - t)); setCls(E.enr, 'warn', soft - t < 30); setCls(E.enr, 'enr', false); }
        else if (t < hard) { setText(E.enrL, 'el', 'ENRAGED · WIPE IN'); setText(E.enrV, 'ev', fmtClock(hard - t)); setCls(E.enr, 'warn', true); setCls(E.enr, 'enr', true); }
        else { setText(E.enrL, 'el', 'WIPE'); setText(E.enrV, 'ev', '0:00'); }
      }
    } else setCls(E.enr, 'none', true);

    // ---- top left ----
    if (txt) {
      for (let i = 0; i < 3; i++) setCls(E.creditIcons[i], 'used', i >= k.credits);
      setHTML(E.lap, 'lap', '<small>LAP</small>' + ((k.lap | 0) + 1));
      setText(E.ftime, 'ft', fmtT(st === 'warp' ? flow.t : fightTime()));
    }

    // ---- speedo + flux ----
    const kmh = Math.max(0, Math.round((k.speed || 0) * 4));
    if (txt) setText(E.spdNum, 'spd', String(kmh));
    setAttr(E.spdArc, 'spda', 'stroke-dasharray', (clamp((k.speed || 0) / 52, 0, 1) * 320.4).toFixed(1) + ' 427.3');
    const fl = clamp(k.flux || 0, 0, 100);
    setAttr(E.fluxRing, 'flr', 'stroke-dasharray', (fl / 100 * 565.5).toFixed(1) + ' 565.5');
    if (txt) setText(E.flux, 'flx', 'FLUX ' + Math.floor(fl));
    setCls(E.speedo, 'full', fl >= 100);
    setCls(E.speedo, 'boost', !!k.boosting);
    const comet = !!(k.cometReady && k.cometReady());
    if (txt && st === 'fight' && fl >= G.cfg.overclockCost && !comet && k.overclockCD <= 0) hint('oc', touchUI() ? 'OVERCLOCK READY · TAP OVERCLOCK' : 'OVERCLOCK READY · PRESS L', '50 FLUX → DOUBLE DRIFT CHARGE + BIGGER VOLLEYS', 4.5);
    if (txt) {
      let fs = '', fc = false;
      if (comet) { fs = G.isTouch ? 'COMET READY · TAP COMET' : 'COMET READY · PRESS L'; fc = true; }
      else if (fl >= 100) fs = 'SUPERCELL · WAIT FOR BREAK';
      else if (k.overclockT > 0) fs = 'OVERCLOCK ' + k.overclockT.toFixed(1);
      else if (k.overchargedT > 0) fs = 'OVERCHARGED';
      setText(E.fluxState, 'fs', fs); setCls(E.fluxState, 'comet', fc);
    }

    // ---- drift tier ----
    const tier = k.drifting ? (k.driftTier | 0) : 0;
    for (let i = 0; i < 3; i++) setCls(E.chev[i], 'on', tier > i);
    setCls(E.tier, 'd', !!k.drifting);
    if (k.drifting) {
      const T = G.cfg.tierT, ch = k.driftCharge || 0;
      const p = tier >= 3 ? 1 : (ch - (tier ? T[tier - 1] : 0)) / (T[tier] - (tier ? T[tier - 1] : 0));
      setTx(E.tierBar, 'tb', 'scaleX(' + clamp(p, 0, 1).toFixed(2) + ')');
      setVar(E.tier, 'tc', '--tc', G.cfg.tierColor[Math.min(2, tier)]);
      if (txt) setText(E.tierLbl, 'tl', TIER_NAME[tier] || 'CHARGE');
    } else setTx(E.tierBar, 'tb', 'scaleX(0)');

    // ---- hull ----
    const hf = k.maxHp ? clamp(k.hp / k.maxHp, 0, 1) : 0;
    setTx(E.hullFill, 'hf', 'scaleX(' + hf.toFixed(3) + ')');
    setVar(E.hull, 'hc', '--hc', hf > 0.6 ? 'linear-gradient(90deg,#33f6ff,#bffcff)' : hf > 0.3 ? 'linear-gradient(90deg,#ff8a1f,#ffc93a)' : 'linear-gradient(90deg,#ff2a3a,#ff6a6a)');
    if (txt) setText(E.hullNum, 'hn', String(Math.ceil(Math.max(0, k.hp))));
    if (hitFlashT > 0) hitFlashT -= rdt;
    setCls(E.hull, 'hit', hitFlashT > 0);
    setCls(E.vigHit, 'on', hitFlashT > 0);
    const lowOn = inFight && hf < 0.3 && hf > 0;
    setCls(E.vigLow, 'on', lowOn);
    if (inFight && st !== 'defeat') G.post?.setDamage?.(lowOn ? 0.35 + (0.3 - hf) * 2 : 0);
    setCls(E.vigStag, 'on', !!(b && b.staggered && inFight));
    setCls(E.vigOc, 'on', k.overclockT > 0);
    setCls(E.vigBoost, 'on', !!k.boosting && (st === 'fight' || st === 'warp'));

    // ---- ability chips (keyboard) ----
    const cfg = G.cfg;
    setTx(E.chipDashCd, 'dcd', 'scaleY(' + clamp((k.dashCD || 0) / cfg.dashCD, 0, 1).toFixed(2) + ')');
    setCls(E.chipDashPip, 'on', !!k.freeDash);
    setCls(E.chipDash, 'dim', !k.freeDash && fl < cfg.dashCost);
    setCls(E.chipAb, 'comet', comet);
    if (txt) setText(E.chipAbT, 'abt', comet ? 'COMET' : 'OVERCLOCK');
    setTx(E.chipAbCd, 'acd', 'scaleY(' + clamp((k.overclockCD || 0) / cfg.overclockCD, 0, 1).toFixed(2) + ')');
    setCls(E.chipAb, 'dim', !comet && fl < cfg.overclockCost);

    // ---- item slot (with a short slot-machine roll when a new item arrives) ----
    const it = k.item || null;
    if (it !== itemShown) {
      if (it && !itemShown) { itemRollT = 0.6; sfx('itemRoll'); }
      itemShown = it;
      if (!it) { E.itemIco.innerHTML = ''; E.btnItemIco.innerHTML = ''; }
    }
    if (itemRollT > 0) {
      itemRollT -= rdt;
      if (itemRollT > 0) {
        const idx = Math.floor(G.time.real * 16) % ITEM_KEYS.length;
        if (idx !== itemRollIdx) { itemRollIdx = idx; E.itemIco.innerHTML = ICON[ITEM_KEYS[idx]]; E.btnItemIco.innerHTML = ICON[ITEM_KEYS[idx]]; }
        setCls(E.itemSlot, 'roll', true); setCls(E.btnItem, 'roll', true);
      } else {
        const ic = ICON[it] || ''; E.itemIco.innerHTML = ic; E.btnItemIco.innerHTML = ic;
        setCls(E.itemSlot, 'roll', false); setCls(E.btnItem, 'roll', false);
        E.itemSlot.classList.remove('got'); void E.itemSlot.offsetWidth; E.itemSlot.classList.add('got');
        E.btnItem.classList.remove('got'); void E.btnItem.offsetWidth; E.btnItem.classList.add('got');
      }
    }

    // ---- touch: fade bottom-left while steering ----
    setCls(body, 'stick-on', !!(G.input && G.input.stickActive));

    // ---- projected markers ----
    updateMarkers(inFight && st !== 'defeat');

    // ---- callouts / banner / prompt lifetime ----
    const now = G.time.real;
    for (const c of E.co) if (c.end && now > c.end) { c.end = 0; c.el.className = 'co'; }
    if (bannerEnd && now > bannerEnd) { bannerEnd = 0; E.banner.classList.remove('on'); }
    if (promptEnd && now > promptEnd) { promptEnd = 0; E.prompt.classList.remove('on'); }
    if (!promptEnd && promptQ.length && (st === 'fight' || st === 'warp')) { const q = promptQ.shift(); showPrompt(q[0], q[1], q[2]); }
    if (st !== 'fight' && st !== 'warp' && st !== 'paused' && (promptEnd || promptQ.length)) { promptQ.length = 0; promptEnd = 0; E.prompt.classList.remove('on'); }
    if (st !== 'countdown' && cd.last >= 0 && flow.t > 0.9 && E.countdown.className) { E.countdown.className = ''; }
  }

  // off-screen threat arrows (pool 6) + pylon arrow, brand ring, range chevron
  function edgeArrow(a, px, py, behind, cls) {
    const cx = innerWidth / 2, cy = innerHeight / 2;
    let dx = px - cx, dy = py - cy;
    if (behind && Math.abs(dy) < 1) dy = innerHeight;   // straight behind -> bottom edge
    const ang = Math.atan2(dy, dx);
    const mx = cx - 44, my = cy - 44;
    const s = Math.min(mx / Math.max(1e-3, Math.abs(dx)), my / Math.max(1e-3, Math.abs(dy)));
    const x = cx + dx * s, y = cy + dy * s;
    if (!a.on) { a.on = true; a.el.classList.add('on'); }
    if (a.kind !== cls) { a.kind = cls; a.el.className = 'arw on' + (cls ? ' ' + cls : '') + (a === E.arw[6] ? ' p' : ''); }
    a.el.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px) rotate(' + ang.toFixed(2) + 'rad)';
  }
  function hideArrow(a) { if (a.on) { a.on = false; a.el.classList.remove('on'); } }
  function updateMarkers(on) {
    let used = 0;
    const k = K();
    if (on && G.tele && G.tele.list && G.track.built) {
      let list = null; try { list = G.tele.list(); } catch (e) { }
      if (list) for (let i = 0; i < list.length && used < 6; i++) {
        const h = list[i]; if (!h || (h.kind !== 'damage' && h.kind !== 'knock')) continue;
        if (h.state && h.state !== 'fill' && h.state !== 'flash') continue;
        const wind = h.windup ?? h.opts?.windup ?? 1.6;
        const rem = (1 - (h.fill || 0)) * wind;
        if (rem > 2) continue;
        let s = h.s, d = h.d || 0;
        if (s === undefined && h.s0 !== undefined) { s = h.s0 + G.track.ds(h.s0, h.s1) * 0.5; d = ((h.d0 ?? 0) + (h.d1 ?? 0)) * 0.5; if (!isFinite(d) || Math.abs(d) > 20) d = 0; }
        if (typeof s !== 'number' || !isFinite(s)) continue;
        G.track.toWorld(s, d, 0.5, V.c);
        const p = project(V.c);
        if (p.on) continue;
        edgeArrow(E.arw[used++], p.x, p.y, p.behind, h.kind === 'knock' ? 'k' : '');
      }
    }
    for (let i = used; i < 6; i++) hideArrow(E.arw[i]);
    // pylon (gold) arrow
    let pyl = null;
    if (on && G.gates) { try { const gl = G.gates.list ? G.gates.list() : G.gates.items || G.gates.active; if (gl) for (const g of gl) if (g && g.kind === 'pylon' && !g.passed && !g.dead) { pyl = g; break; } } catch (e) { } }
    if (pyl && G.track.built) {
      G.track.toWorld(pyl.s, pyl.d || 0, 3, V.c); const p = project(V.c);
      if (!p.on) edgeArrow(E.arw[6], p.x, p.y, p.behind, 'p'); else hideArrow(E.arw[6]);
    } else hideArrow(E.arw[6]);
    // brand ring above the kart
    if (on && k.brand > 0) {
      if (!fight.brandMax || k.brand > fight.brandMax) fight.brandMax = Math.max(15, k.brand);
      V.c.copy(k.renderPos).addScaledVector(k.renderUp, 2.8); const p = project(V.c);
      setCls(E.brandRing, 'on', p.on); setCls(E.brandTxt, 'on', p.on);
      if (p.on) {
        const tr = 'translate(' + p.x.toFixed(0) + 'px,' + p.y.toFixed(0) + 'px)';
        E.brandRing.style.transform = tr; E.brandTxt.style.transform = tr;
        setVar(E.brandRing, 'brp', '--p', (k.brand / fight.brandMax).toFixed(3));
        setText(E.brandTxt, 'brt', Math.ceil(k.brand) + '');
      }
    } else { setCls(E.brandRing, 'on', false); setCls(E.brandTxt, 'on', false); fight.brandMax = 0; }
    // RANGE chevron (boss flag, or Boss 2 distance check)
    let out = false;
    if (on && G.boss) {
      if (typeof G.boss.outOfRange === 'boolean') out = G.boss.outOfRange;
      else if (fight.n === 2 && G.boss.root) { G.boss.root.getWorldPosition(V.c); out = V.c.distanceTo(k.worldPos) > 150; }
    }
    setCls(E.range, 'on', out);
  }

  function updateDebug(rdt) {
    if ((dbgAcc += rdt) < 0.25) return; dbgAcc = 0;
    const p = G.perf, k = K();
    E.debug.textContent = `FPS ${p.fps.toFixed(0)}  ${p.frameMs.toFixed(1)}ms  DPR ${G.quality.dpr.toFixed(2)}  ${G.quality.tier}\nCALLS ${p.drawCalls} (scene ${p.sceneCalls})  TRIS ${(p.triangles / 1000).toFixed(1)}k\n${flow.state}  t ${fightTime().toFixed(1)}  boss ${G.boss ? Math.round(G.boss.hp) + '/' + G.boss.maxHp + ' P' + (curPhase0() + 1) : '-'}\nkart s ${k.s.toFixed(0)} d ${k.d.toFixed(1)} v ${k.speed.toFixed(1)} flux ${k.flux.toFixed(0)}  errs ${G.errors.length}\nF1 god F2 phase F3 kill F4 flux F5 stagger 1-3 boss`;
  }

  // ------------------------------------------------------------------
  // Cheats / test hook (§14)
  // ------------------------------------------------------------------
  const warn = (m) => { console.warn('[__game] ' + m); return false; };
  const bossDefPhases = () => bossPhases();
  const cheats = {
    skipToBoss(n) { n = n | 0; if (n < 1 || n > 3) return warn('skipToBoss: 1..3'); G.time.paused = false; go('fight', { boss: n, direct: true }); return true; },
    startFight(n, { phase = 1 } = {}) { n = n | 0 || 1; G.time.paused = false; go('fight', { boss: clamp(n, 1, 3), phase, direct: true }); return true; },
    setPhase(p) {
      if (G.combat && G.combat.setPhase) return G.combat.setPhase(p);
      const b = G.boss; if (!b) return warn('setPhase: no boss');
      const phases = bossDefPhases(), i = (p | 0) - 1, ph = phases[i];
      if (!ph) return warn('setPhase: bad phase ' + p);
      if (curPhase0() === i) return true;
      if (b.setPhase && !b.setHP) { if (typeof ph.at === 'number') b.hp = Math.min(b.hp, b.maxHp * ph.at); b.setPhase(i); }
      else cheats.setBossHP(typeof ph.at === 'number' ? ph.at : 1);
      if (curPhase0() !== i && b.setPhase) { try { b.setPhase(i); } catch (e) { G.logError('setPhase', e); } }
      return true;
    },
    setBossHP(frac) {
      const b = G.boss; if (!b) return warn('setBossHP: no boss');
      frac = clamp(+frac || 0, 0, 1);
      if (G.combat && G.combat.setBossHP) return G.combat.setBossHP(frac);
      if (b.setHP) { b.setHP(frac); return true; }
      const target = frac * b.maxHp;
      if (target >= b.hp) { b.hp = target; return true; }
      // damage in steps: phase thresholds clamp overflow, so repeat (clearing invuln between)
      for (let i = 0; i < 10 && b.hp > target + 0.5 && b.alive !== false; i++) {
        b.invulnT = 0; const before = b.hp;
        try { b.damage(b.hp - target, { source: 'cheat', raw: true, targetId: 'body' }); } catch (e) { G.logError('cheat.damage', e); break; }
        if (b.hp >= before) break;
      }
      b.invulnT = 0;
      return true;
    },
    damageBoss(amount) {
      if (!G.boss) return warn('damageBoss: no boss');
      if (G.combat && G.combat.damageBoss) return G.combat.damageBoss(amount, { source: 'cheat' });
      return G.boss.damage ? G.boss.damage(amount, { source: 'cheat' }) : warn('damageBoss: no damage()');
    },
    killBoss() {
      const b = G.boss;
      if (!b) { if (flow.state === 'fight') { go('victory'); return true; } return warn('killBoss: no boss'); }
      if (G.combat && G.combat.killBoss) return G.combat.killBoss();
      if (b.kill) { b.kill(); return true; }
      cheats.setBossHP(0);
      if (b.hp > 0) { b.hp = 0; G.emit('boss:dead', { boss: fight.n }); }
      return true;
    },
    forceStagger(dur = 6) { if (G.combat && G.combat.forceStagger) return G.combat.forceStagger(dur); const b = G.boss; if (!b || !b.startStagger) return warn('forceStagger: no boss'); b.startStagger(dur, true); return true; },
    triggerAttack(name, params) {
      try {
        if (G.combat && G.combat.triggerAttack) return G.combat.triggerAttack(name, params) !== false;
        const atk = G.boss?.def?.attacks || hudInfo.def?.boss?.attacks;
        if (!G.boss || !atk || typeof atk[name] !== 'function') return false;
        atk[name](G.boss, params || {}); return true;
      } catch (e) { G.logError('triggerAttack:' + name, e); return false; }
    },
    listAttacks() {
      try { if (G.combat && G.combat.listAttacks) return G.combat.listAttacks(); } catch (e) { }
      const atk = G.boss?.def?.attacks || hudInfo.def?.boss?.attacks; return atk ? Object.keys(atk) : [];
    },
    godMode(on = true) { K().god = !!on; G.params.god = !!on; return true; },
    setHP(n) { const k = K(); k.hp = clamp(+n || 0, 0, k.maxHp); return true; },
    setFlux(n) { const k = K(); k.flux = clamp(+n || 0, 0, 100); return true; },
    giveItem(name) {
      if (!ICON[name]) return warn('giveItem: unknown ' + name);
      if (G.items && G.items.give) { G.items.give(name); return true; }
      K().item = name; return true;
    },
    setCredits(n) { K().credits = Math.max(0, n | 0); return true; },
    teleportKart(s, d = 0) { if (!G.track.built) return warn('teleportKart: no track'); K().teleport(s, d); return true; },
    bot(on = true) { K().bot = !!on; return true; },
  };

  const evSafe = (k, v) => (v && (v.isObject3D || v.isMaterial || v.isBufferGeometry)) ? undefined : (v && v.isVector3) ? { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) } : (typeof v === 'function' ? undefined : v);
  function plain(o) { try { return JSON.parse(JSON.stringify(o || {}, evSafe)); } catch (e) { return {}; } }
  const r2 = (v) => Math.round((v || 0) * 100) / 100;
  function count(sys) { if (!sys) return 0; try { const l = sys.list ? sys.list() : (sys.items || sys.active || sys.all); return l ? (l.length ?? l.size ?? 0) : 0; } catch (e) { return 0; } }
  function dpsNow() { const now = G.time.now; let s = 0; for (let i = 0; i < dps.t.length; i++) if (now - dps.t[i] <= 10) s += dps.a[i]; return Math.round(s / 10); }

  window.__game = {
    version: '1.0',
    get ready() { return G.readyPromise || Promise.resolve(); },
    state() {
      const k = K(), b = G.boss, c = b && b.cast;
      let cs = null; try { cs = G.combat && G.combat.state ? G.combat.state() : null; } catch (e) { }
      return {
        mode: flow.state, boss: fight.n, phase: b ? curPhase0() + 1 : 0, phaseName: b ? (b.phaseName || bossPhases()[curPhase0()]?.name || '') : '',
        bossHP: b ? Math.round(b.hp) : 0, bossMaxHP: b ? b.maxHp : 0, bossHPFrac: b && b.maxHp ? r2(b.hp / b.maxHp) : 0,
        stagger: b ? r2(b.stagger) : 0, staggered: !!(b && b.staggered), enrage: b ? (b.enrage | 0) : 0,
        fightTime: r2(fightTime()), cast: c && c.dur > 0 && !c.done ? { name: c.name, t: r2(c.t), dur: c.dur, interruptible: !!c.interruptible } : null,
        subTargets: subTargets([]).map(t => ({ id: t.id, hp: Math.round(t.hp), maxHp: t.maxHp, alive: t.alive })),
        kart: { s: r2(k.s), d: r2(k.d), h: r2(k.h), speed: r2(k.speed), hp: Math.round(k.hp), maxHp: k.maxHp, flux: Math.round(k.flux), credits: k.credits, lap: k.lap,
          item: k.item || null, drifting: !!k.drifting, driftTier: k.driftTier | 0, airborne: !!k.airborne, invuln: !!k.isInvuln(), boosting: !!k.boosting,
          overclock: k.overclockT > 0, comet: !!k.cometActive, brand: r2(k.brand), x: r2(k.worldPos.x), y: r2(k.worldPos.y), z: r2(k.worldPos.z) },
        telegraphs: cs ? cs.telegraphs : count(G.tele), obstacles: cs ? cs.obstacles : count(G.obstacles), zones: cs ? cs.zones : count(G.zones),
        dpsCombat: cs ? cs.dps : undefined, bossState: cs ? cs.bossState : undefined,
        fps: Math.round(G.perf.fps), dpr: G.quality.dpr, quality: G.quality.tier, drawCalls: G.perf.drawCalls, sceneCalls: G.perf.sceneCalls, triangles: G.perf.triangles,
        dps: dpsNow(), timeScale: G.time.scale, paused: !!G.time.paused, godMode: !!(k.god || G.params.god), errors: G.errors.length,
        difficulty: G.difficulty, retries: fight.retries, L: G.track.L,
      };
    },
    telegraphs() {
      if (G.combat && G.combat.telegraphs) { try { return G.combat.telegraphs(); } catch (e) { } }
      let l = []; try { l = G.tele?.list?.() || []; } catch (e) { }
      return l.map(t => ({ id: t.id, shape: t.shape, kind: t.kind, s: t.s, d: t.d, s0: t.s0, s1: t.s1, d0: t.d0, d1: t.d1, r: t.r, fill: r2(t.fill), state: t.state, dmg: t.dmg }));
    },
    events: (n = 50) => G.eventLog.slice(-n).map(e => ({ t: e.t, name: e.name, data: plain(e.data) })),
    ...cheats,
    input: {
      set(o) { if (o) for (const key in o) if (key in G.input.inject) G.input.inject[key] = o[key]; },
      clear() { G.input.clearInject(); },
      tap(a, ms = 80) { G.input.tap(a, ms); },
    },
    setTimeScale(x) { G.time.scale = Math.max(0, +x || 0); },
    pause() { G.time.paused = true; }, resume() { G.time.paused = false; },
    step(n = 1) { G.loop.step(Math.max(1, n | 0)); },
    setQuality(t) { G.quality.set(t); },
    win() { if (G.boss) return cheats.killBoss(); if (FIGHTISH[flow.state] || flow.state === 'paused') { go('victory'); return true; } return warn('win: not in a fight'); },
    lose() { if (flow.state === 'fight' || flow.state === 'paused' || flow.state === 'countdown') { go('defeat'); return true; } return warn('lose: not in a fight'); },
    goto(state, data) { return go(state, data || {}); },
    screenshotReady: () => G.nextFrame(),
    flow: () => ({ state: flow.state, prev: flow.prev, t: r2(flow.t) }),
    // extra (tests): advance the real-time flow timers without waiting for frames
    flowTick(sec = 1) { for (let t = 0; t < sec; t += 0.05) { flow.t += 0.05; try { TICK[flow.state]?.(0.05); } catch (e) { G.logError('flow.tick', e); } } return flow.state; },
  };

  // ------------------------------------------------------------------
  // Module
  // ------------------------------------------------------------------
  G.register('ui', {
    init() {
      grabDom(); loadSave(); if (!TEST) applyQuality(); applySettings(); wire(); refreshSettingsUI();
      if (G.params.debug) body.classList.add('debug');
      if (G.isTouch) body.classList.add('touch');
      if (TEST) titleMenu = true;
    },
    update() { },
    render(rdt) {
      flow.t += rdt;
      try { TICK[flow.state]?.(rdt); } catch (e) { G.logError('flow.tick.' + flow.state, e); }
      updateHud(rdt);
      if (G.params.debug) updateDebug(rdt);
    },
  });
}
