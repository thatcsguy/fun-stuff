// =====================================================================
// 08_ui.js: all DOM. Settings (G.settings, rg_settings), screens, HUD
// binding, run screens (court card, draft, defeat, victory, results),
// touch controls (joystick + buttons), fullscreen, how-to-play.
// =====================================================================
(() => {
  const $ = (id) => document.getElementById(id);
  const logE = (w, e) => { try { G.log.error(w, e); } catch (_) { console.error(w, e); } };
  const sfx = (n, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(n, o); } catch (e) { } };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const SCR = ['scrTitle', 'scrSelect', 'scrHow', 'scrSettings', 'scrPause', 'scrIntro', 'scrDraft', 'scrDefeat', 'scrVictory', 'scrResults'];
  const COURTS = ['THE COURT OF ASH', 'THE COURT OF GLASS', 'THE COURT OF TIDES', 'THE COURT OF STORMS', 'THE THRONE'];

  // ---------------------------------------------------------- settings
  const settings = { master: 0.85, music: 0.55, sfx: 0.85, quality: 'auto', shake: true, numbers: true, haptics: true };
  try { const s = JSON.parse(localStorage.getItem('rg_settings') || 'null'); if (s && typeof s === 'object') Object.assign(settings, s); } catch (e) { }
  G.settings = settings;
  function saveSettings() { try { localStorage.setItem('rg_settings', JSON.stringify(settings)); } catch (e) { } }
  function applySettings() {
    try { G.audio && G.audio.volumes && G.audio.volumes({ master: settings.master, music: settings.music, sfx: settings.sfx }); } catch (e) { }
    try { if (G.quality && G.quality.set && !(G.params && G.params.quality && G.params.quality !== 'auto')) G.quality.set(settings.quality || 'auto'); } catch (e) { }
    if (G.cam) G.cam.shakeEnabled = settings.shake !== false;
    if (G.fx) G.fx.showNumbers = settings.numbers !== false;
  }
  const vibrate = (ms) => { if (settings.haptics === false || !navigator.vibrate) return; try { navigator.vibrate(ms); } catch (e) { } };
  const fmt = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); };
  const fmtMs = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = (t % 60); return m + ':' + s.toFixed(1).padStart(4, '0'); };

  // ---------------------------------------------------------- screens
  function show(id) { const el = $(id); if (el) el.classList.remove('hidden', 'fade'); }
  function hide(id) { const el = $(id); if (el) el.classList.add('hidden'); }
  function only(id) { for (const s of SCR) if (s !== id) hide(s); if (id) show(id); $('fsTop').classList.toggle('hidden', !(id === 'scrTitle' || id === 'scrSelect' || id === 'scrHow')); }
  function toast(msg, dur = 2.2) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), dur * 1000); }

  // ---------------------------------------------------------- fullscreen
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const fsAvail = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  function toggleFs() {
    sfx('uiClick');
    try {
      if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      if (fsAvail() && !/iPhone|iPod/.test(navigator.userAgent)) {
        const de = document.documentElement;
        const p = de.requestFullscreen ? de.requestFullscreen({ navigationUI: 'hide' }) : de.webkitRequestFullscreen();
        if (p && p.then) p.then(() => { try { screen.orientation && screen.orientation.lock && G.isTouch && screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => fsHint());
        return;
      }
    } catch (e) { }
    fsHint();
  }
  function fsHint() {
    const h = $('fsHint');
    const standalone = window.navigator.standalone || (matchMedia && matchMedia('(display-mode: standalone)').matches);
    h.textContent = standalone ? 'Already running full screen from the Home Screen' : (G.isIOS ? 'Use Share › Add to Home Screen for full screen' : 'Full screen is not available in this browser');
    h.classList.add('on'); clearTimeout(fsHint.h); fsHint.h = setTimeout(() => h.classList.remove('on'), 3800);
  }

  // ---------------------------------------------------------- flow
  function toMenu() {
    try { G.combat && G.combat.quit && G.combat.quit(); } catch (e) { logE('quit', e); }
    hud(false); only('scrTitle'); refreshTitle();
    try { G.world && G.world.setSky && G.world.setSky('menu', 0, 1.2); G.world && G.world.setArena && G.world.setArena('throne'); } catch (e) { }
    try { G.audio && G.audio.music && G.audio.music('menu'); } catch (e) { }
  }
  function refreshTitle() {
    const has = G.run && G.run.hasSave();
    $('bContinue').classList.toggle('hidden', !has);
    const sv = has ? G.run.saved : null;
    if (sv) $('bContinue').textContent = 'CONTINUE · COURT ' + (ROMAN[sv.floor] || sv.floor + 1);
    const b = G.run ? G.run.best : null;
    $('titleFoot').textContent = b && b.bestTime != null ? ('Best run ' + fmtMs(b.bestTime) + (b.bestFlawless != null ? ' · best Flawless ' + fmtMs(b.bestFlawless) : '') + ' · ' + (b.runs | 0) + ' crown' + (b.runs === 1 ? '' : 's') + ' taken') : 'Five bosses · draft an Edict after each · keyboard first';
  }
  function pause(on) {
    if (on) {
      if (!G.core || !G.core.pause) return;
      if (!G.core.pause(true)) return;
      try { G.input && G.input.releaseAll && G.input.releaseAll('pause'); } catch (e) { }
      const c = G.combat;
      $('pauseSub').textContent = c && c.def ? (c.practice ? 'The Yard' : c.def.name + ', ' + ((c.def.phases[c.boss ? c.boss.phase : 0] || {}).name || '')) : '';
      $('bPRetry').classList.toggle('hidden', !!(c && (c.practice || !c.boss || c.boss.phase === 0)));
      only('scrPause'); sfx('uiBack');
    } else {
      if (G.state !== 'paused') return;
      only(null); G.core.pause(false); sfx('uiClick');
    }
  }

  // ---------------------------------------------------------- HUD
  let hudOn = false;
  function hud(on) { hudOn = on; $('hud').classList.toggle('on', on); $('controls').classList.toggle('on', on); }
  const H = { bossF: 1, bossChunk: 1, hpF: 1, hpChunk: 1, chunkHold: 0, hpHold: 0, sayT: 0, bannerT: 0, beginT: 0, lastCast: null, bannerQ: null, cine: false, lastHp: 100, introK: '' };
  function showBanner(index, name, hold) {
    $('phaseK').textContent = 'PHASE ' + (ROMAN[index] || index + 1);
    $('phaseN').textContent = name || '';
    const pb = $('phaseBanner'); pb.classList.remove('on'); void pb.offsetWidth; pb.classList.add('on');
    H.bannerT = hold;
  }
  let ticksFor = null;
  function setupBossBar() {
    const c = G.combat, def = c && c.def; if (!def || ticksFor === def) return; ticksFor = def;
    $('bossNameN').textContent = def.name || ''; $('bossNameT').textContent = def.title || '';
    document.documentElement.style.setProperty('--accent', def.accent || '#ff7a2a');
    const t = $('bossTicks'); t.innerHTML = '';
    if (!def.infinite) for (let i = 1; i < def.phases.length; i++) { const d = document.createElement('i'); d.className = 'tick'; d.style.left = (def.phases[i].hpStart * 100) + '%'; t.appendChild(d); }
    $('hud').classList.toggle('practice', !!c.practice);
    H.bossF = H.bossChunk = 1;
  }
  const SK = {};
  function setSkill(el, frac, txt) {
    el.style.setProperty('--cd', frac.toFixed(3));
    const t = el.querySelector('.cdt'); if (t && t.textContent !== txt) t.textContent = txt;
    const cool = frac > 0.001; if (cool !== el._cool) { el.classList.toggle('cool', cool); if (!cool && el._cool) { el.classList.remove('ready-flash'); void el.offsetWidth; el.classList.add('ready-flash'); } el._cool = cool; }
  }
  function setPips(el, charges, max) {
    const ps = el.querySelectorAll('.pips i');
    ps.forEach((p, i) => { p.style.display = i < max ? '' : 'none'; p.classList.toggle('on', i < charges); });
  }
  function updateHud(rdt) {
    const c = G.combat, b = c && c.boss, def = c && c.def, pl = G.player, ps = pl && pl.state;
    if (!c || !def || !ps) return;
    setupBossBar();
    // boss bar
    const bf = def.infinite ? 1 : clamp(b ? b.hp / b.maxHp : 0, 0, 1);
    H.bossF = bf;
    if (bf < H.bossChunk) { H.chunkHold = Math.max(0, H.chunkHold - rdt); if (H.chunkHold <= 0) H.bossChunk = Math.max(bf, H.bossChunk - rdt * 0.6); } else { H.bossChunk = bf; H.chunkHold = 0.25; }
    $('bossFill').style.transform = 'scaleX(' + bf.toFixed(4) + ')';
    $('bossChunk').style.transform = 'scaleX(' + H.bossChunk.toFixed(4) + ')';
    $('bossPct').textContent = def.infinite ? (c.dps ? 'DPS ' + Math.round(c.dps()) : '') : (Math.ceil(bf * 100) + '%');
    const bb = $('bossBar'); bb.classList.toggle('exposed', !!(b && b.exposedT > 0)); bb.classList.toggle('immune', !!(b && b.invulnerable));
    // cast
    const cast = b && b.casting;
    const cw = $('castWrap');
    if (cast) {
      if (H.lastCast !== cast) { H.lastCast = cast; $('castName').textContent = cast.name; cw.classList.toggle('int', !!cast.interruptible); cw.classList.add('on'); }
      $('castFill').style.transform = 'scaleX(' + cast.progress.toFixed(4) + ')';
    } else if (H.lastCast) { H.lastCast = null; cw.classList.remove('on'); }
    $('chips').classList.toggle('cast', !!cast);
    SK.rebuke.classList.toggle('int', !!(cast && cast.interruptible && ps.cds.rebuke <= 0));
    // player
    const hf = clamp(ps.hp / ps.maxHp, 0, 1);
    if (hf < H.hpChunk) { H.hpHold = Math.max(0, H.hpHold - rdt); if (H.hpHold <= 0) H.hpChunk = Math.max(hf, H.hpChunk - rdt * 0.8); } else { H.hpChunk = hf; H.hpHold = 0.25; }
    $('hpFill').style.transform = 'scaleX(' + hf.toFixed(4) + ')';
    $('hpChunk').style.transform = 'scaleX(' + H.hpChunk.toFixed(4) + ')';
    $('hpText').textContent = Math.ceil(ps.hp) + ' / ' + ps.maxHp;
    const hb = $('hpBar'); hb.classList.toggle('low', hf < 0.3 && ps.alive); hb.classList.toggle('shield', !!ps.shield.up);
    if (ps.hp < H.lastHp - 0.5) { hb.classList.remove('hit'); void hb.offsetWidth; hb.classList.add('hit'); vibrate(20); }
    H.lastHp = ps.hp;
    const ub = $('ultBar'); ub.classList.toggle('full', ps.ult >= 1);
    $('ultFill').style.transform = 'scaleX(' + clamp(ps.ult, 0, 1).toFixed(4) + ')';
    $('ultLab').textContent = ps.ult >= 1 ? 'VERDICT READY' : 'VERDICT ' + Math.floor(ps.ult * 100) + '%';
    // skills
    const si = pl.skillInfo();
    setSkill(SK.dash, si.dash.charges > 0 ? 0 : 1 - si.dash.frac, si.dash.charges > 0 ? '' : ''); setPips(SK.dash, si.dash.charges, si.dash.max);
    setSkill(SK.mend, si.mend.charges > 0 ? 0 : 1 - si.mend.frac, ''); setPips(SK.mend, si.mend.charges, si.mend.max);
    setSkill(SK.rebuke, si.rebuke.cd > 0 ? si.rebuke.cd / si.rebuke.cdMax : 0, si.rebuke.cd > 0 ? Math.ceil(si.rebuke.cd) : '');
    setSkill(SK.bulwark, si.bulwark.cd > 0 ? si.bulwark.cd / si.bulwark.cdMax : 0, si.bulwark.cd > 0 ? Math.ceil(si.bulwark.cd) : '');
    SK.bulwark.classList.toggle('up', !!si.bulwark.up);
    if (si.bulwark.up) { SK.bulwark.style.setProperty('--h', clamp(si.bulwark.hold, 0, 1).toFixed(3)); SK.bulwark.querySelector('.mult').textContent = si.bulwark.absorbed > 0 ? 'x' + si.bulwark.mult.toFixed(1) + ' · ' + Math.round(si.bulwark.absorbed) : 'HOLD'; }
    SK.verdict.style.setProperty('--m', clamp(si.verdict.ult, 0, 1).toFixed(3)); SK.verdict.classList.toggle('ready', si.verdict.ready);
    // chips
    $('chipExposed').classList.toggle('on', !!(b && b.exposedT > 0));
    $('chipStag').classList.toggle('on', !!(b && b.staggerT > 0 && !(b.exposedT > 0)));
    const rip = $('chipRip'); const ripOn = !!(ps.shield.up && si.bulwark.absorbed > 0); rip.classList.toggle('on', ripOn); if (ripOn) rip.textContent = 'RIPOSTE x' + si.bulwark.mult.toFixed(1);
    $('chipBurn').classList.toggle('on', ps.burning > 0);
    $('chipRites').classList.toggle('on', !!ps.lastRitesUsed);
    // run strip
    const R = G.run && G.run.state;
    if (R) {
      $('rsCourt').textContent = c.practice ? 'THE YARD' : ('COURT ' + (ROMAN[c.bossIndex] || '') + (R.single ? ' · SINGLE' : ''));
      $('rsTime').textContent = fmt((R.active && !R.single ? R.time : 0) + (c.fightTime || 0));
      $('rsDeaths').textContent = R.deaths > 0 && R.active && !R.single ? '☠ ' + R.deaths : (R.active && !R.single ? 'FLAWLESS' : '');
      const eds = R.edicts || [], key = eds.join(',');
      if (H.edKey !== key) { H.edKey = key; const el = $('rsEdicts'); el.innerHTML = eds.map(id => { const e = G.run.edict(id); return e ? '<i class="' + e.rarity + '" title="' + e.name + ': ' + e.desc + '">' + e.icon + '</i>' : ''; }).join(''); }
    }
    // timers
    if (H.sayT > 0) { H.sayT -= rdt; if (H.sayT <= 0) $('say').classList.remove('on'); }
    if (H.bannerT > 0) { H.bannerT -= rdt; if (H.bannerT <= 0) $('phaseBanner').classList.remove('on'); }
    if (H.beginT > 0) { H.beginT -= rdt; if (H.beginT <= 0) { $('beginFlash').classList.remove('on'); if (H.bannerQ) { showBanner(H.bannerQ.index, H.bannerQ.name, 2.4); H.bannerQ = null; } } }
    if (c.practice) $('practiceDps').textContent = 'DPS ' + Math.round(c.dps ? c.dps() : 0);
  }

  // ---------------------------------------------------------- results
  function showDefeat(d) {
    const ps = G.player.state, c = G.combat, R = G.run.state;
    $('defSub').textContent = (ps.lastHitLabel ? 'Killed by ' + ps.lastHitLabel + '. ' : '') + (c.def ? c.def.name + ', phase ' + (ROMAN[(d && d.phase) | 0] || 1) : '');
    const st = G.player.stats;
    $('defGrid').innerHTML = `<span>Time</span><b>${fmt(c.fightTime)}</b><span>Damage taken</span><b>${Math.round(st.damageTaken)}</b><span>Damage dealt</span><b>${Math.round(st.damageDealt)}</b><span>Run deaths</span><b>${R.active && !R.single ? R.deaths + 1 : '–'}</b>`;
    $('bRetryPhase').classList.toggle('hidden', !((d && d.phase) > 0));
    $('bDefMenu').textContent = R.active && !R.single ? 'ABANDON RUN' : 'MENU';
    only('scrDefeat');
    $('deathNote').classList.remove('on');
  }
  let vicRoute = null;
  function showVictory(r) {
    const R = G.run, s = R.state, c = G.combat;
    const prevBest = (R.best.courts && R.best.courts[String(c.bossIndex)] && R.best.courts[String(c.bossIndex)].best);
    vicRoute = R.onVictory(r);
    $('vicH').textContent = c.bossIndex === 4 ? 'THE KING FALLS' : 'COURT CLEARED';
    $('vicSub').textContent = (r.name || '') + ' ' + (r.title || '') + ' · ' + (COURTS[c.bossIndex] || '');
    $('vicGrade').textContent = r.grade;
    $('vicGrid').innerHTML = `<span>Time</span><b>${fmtMs(r.time)}</b><span>Par</span><b>${fmt(r.par)}</b><span>Damage taken</span><b>${r.damageTaken}</b><span>Absorbed by Bulwark</span><b>${r.absorbed}</b><span>Interrupts</span><b>${r.interrupts}</b><span>Ripostes</span><b>${r.ripostes}</b>`;
    const bk = r.damageBySkill || {}; const tot = Object.values(bk).reduce((a, v) => a + v, 0) || 1;
    const order = ['rend', 'cleave', 'riposte', 'verdict', 'afterimage'];
    $('vicBk').innerHTML = order.filter(k => bk[k]).map(k => `<div class="r"><span>${k.toUpperCase()}</span><i style="width:${(bk[k] / tot * 100).toFixed(1)}%"></i><b>${Math.round(bk[k] / tot * 100)}%</b></div>`).join('');
    $('vicBest').innerHTML = (prevBest == null || r.time < prevBest) ? '<span class="newBest">NEW BEST</span>' : '';
    $('bVicNext').textContent = vicRoute === 'draft' ? 'CHOOSE AN EDICT' : vicRoute === 'end' ? 'THE CROWN' : 'MENU';
    only('scrVictory');
  }
  function victoryNext() {
    sfx('uiClick');
    const R = G.run;
    if (vicRoute === 'draft') { only(null); R.openDraft(R.state.draft); }
    else if (vicRoute === 'end') showResults(R.lastResults);
    else toMenu();
  }
  function showDraft(d) {
    const R = G.run;
    $('draftSub').textContent = (COURTS[d.floor] || '') + ' is yours. Take one decree with you.';
    const el = $('draftCards'); el.innerHTML = '';
    d.choices.forEach((id, i) => {
      const e = R.edict(id); if (!e) return;
      const card = document.createElement('button'); card.className = 'card edict ' + e.rarity; card.type = 'button';
      card.innerHTML = `<div class="ic">${e.icon}</div><div class="nm">${e.name}</div><div class="rar">${e.rarity.toUpperCase()}</div><div class="ds">${e.desc}</div>`;
      card.addEventListener('click', () => { sfx('draftPick'); only(null); hud(true); R.draftPick(i); });
      el.appendChild(card);
    });
    hud(false); only('scrDraft');
    try { G.world && G.world.setSky && G.world.setSky('menu', 1, 1.5); } catch (e) { }
  }
  function showResults(res) {
    const R = G.run;
    res = res || R.lastResults || { time: 0, deaths: 0, flawless: false, edicts: [], floorTimes: [] };
    $('resGrade').textContent = res.flawless ? 'FLAWLESS' : 'CROWNED';
    $('resGrid').innerHTML = `<span>Run time</span><b>${fmtMs(res.time)}</b><span>Deaths</span><b>${res.deaths}</b>` + (res.floorTimes || []).map((t, i) => `<span>Court ${ROMAN[i]}</span><b>${fmtMs(t || 0)}</b>`).join('');
    $('resEdicts').innerHTML = (res.edicts || []).map(id => { const e = R.edict(id); return e ? `<i>${e.icon} ${e.name}</i>` : ''; }).join('');
    $('resBest').innerHTML = (R.best.bestTime != null && res.time <= R.best.bestTime + 1e-6) ? '<span class="newBest">BEST RUN</span>' : '';
    hud(false); only('scrResults');
  }

  // ---------------------------------------------------------- court select
  function refreshCards() {
    const el = $('cards'); el.innerHTML = '';
    const R = G.run, un = (R.unlock && R.unlock.court) | 0, best = (R.best && R.best.courts) || {};
    const sv = R.saved;
    $('selSub').textContent = sv && sv.edicts && sv.edicts.length ? 'Fight one court with the Edicts of your saved run (' + sv.edicts.length + ').' : 'Fight one court, no Edicts. Courts unlock as a run reaches them.';
    for (let i = 0; i < 5; i++) {
      const def = G.bosses[i];
      const card = document.createElement('button'); card.type = 'button';
      const locked = i > un || !def;
      card.className = 'card' + (locked ? ' locked' : '') + (best[String(i)] && best[String(i)].kills ? ' cleared' : '');
      card.style.setProperty('--c', def ? def.accent : '#777');
      const b = best[String(i)];
      card.innerHTML = `<div class="num">COURT ${ROMAN[i]} · ${COURTS[i]}</div><div class="nm eng">${def ? def.name : 'Being forged'}</div><div class="ti">${def ? def.title : ''}</div><div class="sw"><i></i>${def ? def.phases.length + ' phases' : ''}</div><div class="best">${locked ? 'Locked: reach it in a run' : (b && b.best != null ? 'Best ' + fmtMs(b.best) + ' · ' + b.kills + ' kill' + (b.kills === 1 ? '' : 's') : 'Not yet cleared')}</div><span class="clr">CLEARED</span>`;
      if (!locked) card.addEventListener('click', () => { sfx('uiClick'); only(null); hud(true); R.single(i, { edicts: sv ? sv.edicts : [] }); });
      el.appendChild(card);
    }
  }

  // ---------------------------------------------------------- how to play
  function buildHow() {
    const H2 = [
      ['MOVE', 'WASD', 'Move freely on the court. The whole floor is visible: watch it, not the boss.'],
      ['REND', 'auto', 'Your blade whips at the boss whenever you are within 7. Every third hit is a Cleave. You never press a button to attack.'],
      ['DASH', 'Space', 'A short lunge with invulnerability, two charges. It even crosses gold "unblockable" shapes safely.'],
      ['BULWARK', 'Q hold', 'Hold to raise a shield that absorbs blockable damage, up to 2.5 s. Let go to RIPOSTE: the damage you absorbed comes back on the boss, up to x3 if you release right after the hit. Hold to the end for safety, release early for the burst.'],
      ['REBUKE', 'E', 'A shockwave cone toward the boss. Interrupts a purple cast (the boss is Exposed and takes +30%), and always destroys projectiles and staggers adds in the cone.'],
      ['MEND', 'F', 'Heals 35 over 2 s, two charges, and cleanses burning.'],
      ['VERDICT', 'R', 'Fills as you deal damage. Leap and impale the boss for huge damage, clearing every projectile. A burst or a panic button.'],
      ['RUN', '', 'Five courts in order. After each, choose one of three Edicts. Dying sends you back to the start of the court with your Edicts. No deaths: Flawless.'],
    ];
    const T = [
      ['#ff7a2a', 'ACCENT SHAPE', 'Damage when the fill reaches the edge. Move out or Bulwark it.'],
      ['#ffd36b', 'GOLD HATCHED', 'Lethal or unblockable: Bulwark does nothing. Move, or Dash through.'],
      ['#4fa8ff', 'BLUE DISC', 'Safe zone. Be inside when it fills.'],
      ['#5cff9a', 'GREEN STAR', 'Soak: stand on it before it expires.'],
      ['#c070ff', 'PURPLE CAST', 'Interruptible. Rebuke it.'],
    ];
    $('howGrid').innerHTML = H2.map(h => `<div class="how"><h4>${h[0]}${h[1] ? '<kbd>' + h[1] + '</kbd>' : ''}</h4><p>${h[2]}</p></div>`).join('') + T.map(t => `<div class="how"><h4><span class="sw" style="background:${t[0]};color:${t[0]}"></span>${t[1]}</h4><p>${t[2]}</p></div>`).join('');
  }

  // ---------------------------------------------------------- settings UI
  function bindSettings() {
    const sync = () => {
      $('setMaster').value = settings.master; $('setMusic').value = settings.music; $('setSfx').value = settings.sfx;
      $('setQuality').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === (settings.quality || 'auto')));
      $('setShake').classList.toggle('on', settings.shake !== false); $('setNumbers').classList.toggle('on', settings.numbers !== false); $('setHaptics').classList.toggle('on', settings.haptics !== false);
    };
    for (const k of ['Master', 'Music', 'Sfx']) $('set' + k).addEventListener('input', (e) => { settings[k.toLowerCase()] = +e.target.value; applySettings(); saveSettings(); });
    $('setQuality').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; settings.quality = b.dataset.v; applySettings(); saveSettings(); sync(); sfx('uiClick'); });
    for (const [id, k] of [['setShake', 'shake'], ['setNumbers', 'numbers'], ['setHaptics', 'haptics']]) $(id).addEventListener('click', () => { settings[k] = !(settings[k] !== false); applySettings(); saveSettings(); sync(); sfx('uiClick'); });
    G.ui._syncSettings = sync; sync();
  }

  // ---------------------------------------------------------- touch controls
  const BTN_FOR = { dash: 'sDash', bulwarkDown: 'sBulwark', rebuke: 'sRebuke', mend: 'sMend', verdict: 'sVerdict' };
  function flashBtn(action) {
    const el = $(BTN_FOR[action]); if (!el) return;
    if (action === 'bulwarkDown') { el.classList.add('down'); return; }
    el.classList.add('down'); clearTimeout(el._fh); el._fh = setTimeout(() => { if (!el._held) el.classList.remove('down'); }, 110);
  }
  function bindControls() {
    document.querySelectorAll('#controls [data-btn]').forEach(el => {
      const act = el.dataset.btn; const active = new Set();
      const down = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (active.has(e.pointerId)) return; active.add(e.pointerId);
        try { el.setPointerCapture && el.setPointerCapture(e.pointerId); } catch (er) { }
        el._held = true; el.classList.add('down');
        if (G.state === 'intro') { G.combat && G.combat.skipIntro && G.combat.skipIntro(); }
        if (act === 'bulwark') G.input.fire('bulwarkDown', { source: 'button' }); else G.input.fire(act, { source: 'button' });
        vibrate(6);
      };
      const up = (e) => {
        if (!active.has(e.pointerId)) return; active.delete(e.pointerId); if (active.size) return;
        el._held = false; el.classList.remove('down');
        if (act === 'bulwark') G.input.fire('bulwarkUp', { source: 'button' });
      };
      el.addEventListener('pointerdown', down, { passive: false });
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('mousedown', (e) => e.preventDefault());
    });
    for (const a of Object.keys(BTN_FOR)) G.input.on(a, () => flashBtn(a));
    G.input.on('bulwarkUp', () => { const el = $('sBulwark'); if (el && !el._held) el.classList.remove('down'); });
    // joystick
    const zone = $('stickZone'), stick = $('stick'), knob = stick.querySelector('.knob');
    let sid = null, ox = 0, oy = 0; const RAD = () => stick.offsetWidth / 2;
    const place = (x, y) => { stick.style.left = (x - RAD()) + 'px'; stick.style.top = (y - RAD()) + 'px'; stick.style.bottom = 'auto'; };
    zone.addEventListener('pointerdown', (e) => {
      if (sid != null) return; sid = e.pointerId; e.preventDefault();
      try { zone.setPointerCapture(e.pointerId); } catch (er) { }
      const r = zone.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top; place(ox, oy); stick.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
      if (G.state === 'intro') { G.combat && G.combat.skipIntro && G.combat.skipIntro(); }
    }, { passive: false });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== sid) return;
      const r = zone.getBoundingClientRect(); let dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy; const R = RAD() * 0.8, d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = 'translate(calc(-50% + ' + dx.toFixed(1) + 'px),calc(-50% + ' + dy.toFixed(1) + 'px))';
      G.input.setStick(dx / R, dy / R);
    });
    const end = (e) => { if (e.pointerId !== sid) return; sid = null; stick.classList.remove('on'); stick.style.left = ''; stick.style.top = ''; stick.style.bottom = ''; knob.style.transform = 'translate(-50%,-50%)'; G.input.setStick(null); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);
  }

  // ---------------------------------------------------------- events
  function bindEvents() {
    G.on('fightStart', (d) => {
      ticksFor = null; H.lastHp = 100; H.edKey = null;
      $('deathNote').classList.remove('on');
      if (d.practice || d.quick) { only(null); hud(true); return; }
      $('introK').textContent = 'COURT ' + (ROMAN[d.bossIndex] || '') + ' · ' + (COURTS[d.bossIndex] || d.court || '');
      $('introN').textContent = d.name || ''; $('introT').textContent = d.title || '';
      $('introQ').innerHTML = (d.intro || []).map(l => '<div>' + l + '</div>').join('');
      document.documentElement.style.setProperty('--accent', d.accent || '#ff7a2a');
      for (const el of $('scrIntro').querySelectorAll('.in')) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
      hud(false); only('scrIntro');
    });
    G.on('fightBegin', () => {
      only(null); hud(true);
      const bf = $('beginFlash'); bf.classList.add('on'); H.beginT = 0.9;
      const c = G.combat; if (c && c.boss && c.boss.phase > 0) H.bannerQ = { index: c.boss.phase, name: (c.def.phases[c.boss.phase] || {}).name };
    });
    G.on('phaseTransition', (d) => { setTimeout(() => showBanner(d.to, d.name || (G.combat.def.phases[d.to] || {}).name, 4.0), 550); });
    G.on('say', (d) => { $('say').textContent = d.text; $('say').classList.add('on'); H.sayT = d.dur || 2.5; });
    G.on('playerDeath', () => { const l = G.player.state.lastHitLabel; $('deathNote').textContent = l ? 'Killed by ' + l : 'Fallen'; $('deathNote').classList.add('on'); });
    G.on('fightEnd', (d) => {
      if (d.result === 'defeat') showDefeat(d);
      else if (d.result === 'victory') setTimeout(() => { if (G.state === 'victory') showVictory(d.results); }, 400);
    });
    G.on('draftOpen', showDraft);
    G.on('runEnd', () => { });
    G.on('stateChange', (d) => {
      if (d.to === 'paused') { if (!$('scrPause').classList.contains('hidden')) return; }
      if (d.from === 'paused' && d.to !== 'paused') hide('scrPause');
      if (d.to === 'menu') hud(false);
    });
    addEventListener('keydown', (e) => {
      if (G.state === 'intro' && !e.repeat) { G.combat.skipIntro(); return; }
      if ((e.key === 'Escape' || (e.key || '').toLowerCase() === 'p') && !$('scrSettings').classList.contains('hidden')) { settingsBack(); e.stopImmediatePropagation(); }
    });
    $('scrIntro').addEventListener('pointerdown', () => G.combat.skipIntro());
    document.addEventListener('visibilitychange', () => { if (document.hidden && (G.state === 'fight' || G.state === 'practice')) pause(true); });
    G.input.on('pause', () => {
      if (!$('scrSettings').classList.contains('hidden')) return;
      if (G.state === 'paused') pause(false); else if (G.state === 'fight' || G.state === 'practice' || G.state === 'cinematic') pause(true);
    });
  }
  let settingsFrom = null;
  function openSettings(from) { settingsFrom = from; G.ui._syncSettings && G.ui._syncSettings(); only('scrSettings'); sfx('uiClick'); }
  function settingsBack() { sfx('uiBack'); if (settingsFrom === 'pause') only('scrPause'); else if (settingsFrom === 'title') { only('scrTitle'); } else only(null); settingsFrom = null; }

  function bindButtons() {
    const on = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); fn(e); });
    on('bNewRun', () => { sfx('uiClick'); only(null); hud(true); G.run.newRun(); });
    on('bContinue', () => { sfx('uiClick'); only(null); hud(true); if (!G.run.continueRun()) toMenu(); });
    on('bSelect', () => { sfx('uiClick'); refreshCards(); only('scrSelect'); });
    on('bSelBack', () => { sfx('uiBack'); only('scrTitle'); });
    on('bPractice', () => { sfx('uiClick'); only(null); hud(true); G.run.practice(); });
    on('bHow', () => { sfx('uiClick'); only('scrHow'); });
    on('bHowBack', () => { sfx('uiBack'); only('scrTitle'); });
    on('bSettings', () => openSettings('title'));
    on('bSetBack', settingsBack);
    on('bResume', () => pause(false));
    on('bPRetry', () => { sfx('uiClick'); G.core.pause(false); only(null); G.run.retryPhase(); });
    on('bPRestart', () => { sfx('uiClick'); G.core.pause(false); only(null); if (G.combat.practice) G.combat.restart(); else G.run.retryCourt(); });
    on('bPSettings', () => openSettings('pause'));
    on('bPFs', toggleFs);
    on('bPQuit', () => { sfx('uiBack'); G.core.pause(false); toMenu(); });
    on('bRetryPhase', () => { sfx('uiClick'); only(null); hud(true); G.run.retryPhase(); });
    on('bRetryCourt', () => { sfx('uiClick'); only(null); hud(true); if (G.run.state.active) G.run.retryCourt(); else G.combat.restart({ skipIntro: true }); });
    on('bDefMenu', () => { sfx('uiBack'); if (G.run.state.active && !G.run.state.single) G.run.abandon(); toMenu(); });
    on('bVicNext', victoryNext);
    on('bVicMenu', () => { sfx('uiBack'); if (vicRoute === 'draft') { /* keep the saved draft for CONTINUE */ } toMenu(); });
    on('bResMenu', () => { sfx('uiBack'); toMenu(); });
    on('bResAgain', () => { sfx('uiClick'); only(null); hud(true); G.run.newRun(); });
    on('btnFs', toggleFs); on('fsTop', toggleFs);
    on('btnPause', () => { if (G.state === 'paused') pause(false); else pause(true); });
    on('practiceX', () => { const el = $('practiceHelp'); el.classList.toggle('min'); $('practiceX').textContent = el.classList.contains('min') ? '+' : '–'; });
  }
  function layoutScale() {
    const w = innerWidth, h = innerHeight, portrait = h > w;
    let s = G.isTouch ? clamp(Math.min(w, h) / 430, 0.74, 1.12) : 1;
    if (G.isTouch && portrait) s = Math.min(s, clamp(w / 470, 0.7, 1));
    $('ui').style.setProperty('--s', s.toFixed(3));
  }

  // ---------------------------------------------------------- module
  G.ui = {
    settings, show, hide, only, toast, toggleFs, toMenu, pause, refreshCards, showResults,
    init() {
      document.body.classList.toggle('touch', !!G.isTouch);
      document.body.classList.toggle('ios', !!G.isIOS);
      for (const k of ['dash', 'bulwark', 'rebuke', 'mend', 'verdict']) SK[k] = $('s' + k[0].toUpperCase() + k.slice(1));
      applySettings();
      bindSettings(); bindButtons(); bindControls(); bindEvents();
      buildHow();
      layoutScale(); addEventListener('resize', layoutScale);
      const p = G.params || {};
      const route = () => {
        if (p.practice || p.boss || p.run) { only(null); hud(true); return; }   // 09_run starts these on 'booted'
        only('scrTitle'); refreshTitle();
        try { G.world && G.world.setArena && G.world.setArena('throne'); } catch (e) { }
        try { G.audio && G.audio.music && G.audio.music('menu'); } catch (e) { }
      };
      if (G.booted) route(); else G.on('booted', route);
    },
    update(dt) {
      const rdt = G.rdt || dt || 0;
      if (hudOn) { try { updateHud(rdt); } catch (e) { logE('ui.hud', e); } }
      const cin = G.state === 'cinematic' || G.state === 'victory';
      if (cin !== H.cine) { H.cine = cin; $('controls').classList.toggle('cine', cin); $('hud').classList.toggle('cine', cin); }
    },
  };
})();
