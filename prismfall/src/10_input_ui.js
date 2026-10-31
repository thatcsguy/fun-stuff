   16  INPUT — keyboard/mouse, floating joystick, ability buttons
   ===================================================================== */
const input = { keys: Object.create(null), mx: 0, mz: 0, kx: 0, kz: 0, jx: 0, jz: 0, mouseIn: false, mouseAimT: 0, ndc: new THREE.Vector2(), groundX: 0, groundZ: 0, lastMouse: 0 };
const joy = { id: -1, bx: 0, by: 0, x: 0, y: 0, R: 64, el: document.getElementById('joy'), base: document.getElementById('joyBase'), knob: document.getElementById('joyKnob') };
joy.R = clamp(Math.min(innerWidth, innerHeight) * 0.14, 48, 80);
const raycaster = new THREE.Raycaster(); const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const _hit = new THREE.Vector3();
const KEYMAP = { Space: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', Digit1: 'lance', KeyQ: 'lance', KeyJ: 'lance', Digit2: 'lattice', KeyK: 'lattice', Digit3: 'mirror', KeyE: 'mirror', KeyL: 'mirror', Digit4: 'nova', KeyR: 'nova', KeyF: 'nova' };
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) { input.keys[e.code] = true; return; }
  input.keys[e.code] = true;
  audioInit();
  if (game.state === 'defeat' && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR')) { e.preventDefault(); sfx.ui(); retryBoss(); return; }
  if (game.state === 'victory' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); sfx.ui(); showScreen('victory', false); startRun(true, 0); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (game.state === 'intro' || game.state === 'cinematic') { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') skipCine(); return; }
  if (game.state === 'title' && (e.code === 'Enter' || e.code === 'Space') && !anyModal()) { titleStart(); return; }
  const ab = KEYMAP[e.code]; if (ab && game.state === 'fight') useAbility(ab);
});
addEventListener('keyup', (e) => { input.keys[e.code] = false; });
addEventListener('blur', () => { for (const k in input.keys) input.keys[k] = false; });
canvas.addEventListener('mousemove', (e) => { input.ndc.set(e.clientX / VW * 2 - 1, -(e.clientY / VH) * 2 + 1); input.mouseIn = true; input.mouseAimT = 3; });
canvas.addEventListener('mouseleave', () => { input.mouseIn = false; });
canvas.addEventListener('mousedown', (e) => {
  audioInit();
  if (game.state === 'intro' || game.state === 'cinematic') { skipCine(); return; }
  if (game.state !== 'fight') return;
  input.ndc.set(e.clientX / VW * 2 - 1, -(e.clientY / VH) * 2 + 1); input.mouseIn = true; input.mouseAimT = 3; updateMouseGround();
  if (e.button === 0) useAbility('lance'); else if (e.button === 2) useAbility('dash');
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
function updateMouseGround() {
  raycaster.setFromCamera(input.ndc, camera);
  if (raycaster.ray.intersectPlane(groundPlane, _hit)) { input.groundX = _hit.x; input.groundZ = _hit.z; }
}
// touch joystick (pointer events)
// fingers already down during a cinematic are remembered, and the first left-side one becomes the joystick when play resumes
const pendTouch = new Map();
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  audioInit();
  if (game.state === 'intro' || game.state === 'cinematic') {
    if (!(e.target && e.target.closest && e.target.closest('.ab,button,.screen'))) pendTouch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    skipCine(); return;
  }
  if (game.state !== 'fight') return;
  if (e.target && e.target.closest && e.target.closest('.ab,button,.screen')) return;
  if (joy.id < 0 && e.clientX < VW * 0.55) {
    joy.id = e.pointerId; joy.bx = e.clientX; joy.by = e.clientY; joy.x = e.clientX; joy.y = e.clientY;
    joy.base.style.width = joy.base.style.height = (joy.R * 2) + 'px';
    joyDraw(); joy.el.classList.add('on'); e.preventDefault();
  }
}, { passive: false });
addEventListener('pointermove', (e) => {
  if (e.pointerId !== joy.id) { const q = pendTouch.size ? pendTouch.get(e.pointerId) : null; if (q) { q.x = e.clientX; q.y = e.clientY; } return; }
  joy.x = e.clientX; joy.y = e.clientY;
  const dx = joy.x - joy.bx, dy = joy.y - joy.by, l = Math.hypot(dx, dy);
  if (l > joy.R * 1.6) { const k = (l - joy.R * 1.6) / l; joy.bx += dx * k; joy.by += dy * k; }
  joyDraw(); e.preventDefault();
}, { passive: false });
function joyRelease(e) { if (pendTouch.size) pendTouch.delete(e.pointerId); if (e.pointerId !== joy.id) return; joy.id = -1; input.jx = input.jz = 0; joy.el.classList.remove('on'); }
function joyAdopt() {
  for (const [id, q] of pendTouch) {
    if (q.x < VW * 0.55) { joy.id = id; joy.bx = joy.x = q.x; joy.by = joy.y = q.y; joy.base.style.width = joy.base.style.height = (joy.R * 2) + 'px'; joyDraw(); joy.el.classList.add('on'); pendTouch.delete(id); return; }
  }
}
addEventListener('pointerup', joyRelease); addEventListener('pointercancel', joyRelease);
function joyDraw() {
  let dx = joy.x - joy.bx, dy = joy.y - joy.by; const l = Math.hypot(dx, dy);
  const kl = Math.min(l, joy.R); const nx = l > 0 ? dx / l : 0, ny = l > 0 ? dy / l : 0;
  joy.base.style.left = joy.bx + 'px'; joy.base.style.top = joy.by + 'px';
  joy.knob.style.left = (joy.bx + nx * kl) + 'px'; joy.knob.style.top = (joy.by + ny * kl) + 'px';
  const m = l / joy.R, dz = 0.12; const out = m < dz ? 0 : Math.min(1, (m - dz) / (1 - dz));
  input.jx = nx * out; input.jz = ny * out;
}
// ability buttons
document.querySelectorAll('.ab').forEach((el) => {
  const name = el.dataset.ab;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); el.classList.add('pressed'); if (game.state === 'fight') useAbility(name); else if (game.state === 'intro' || game.state === 'cinematic') skipCine(); });
  const up = () => el.classList.remove('pressed');
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
});
function updateInput(realDt) {
  if (pendTouch.size && joy.id < 0 && game.state === 'fight') joyAdopt();
  const k = input.keys;
  let x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  let z = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
  const l = Math.hypot(x, z); if (l > 0) { x /= l; z /= l; }
  x += input.jx; z += input.jz; const l2 = Math.hypot(x, z); if (l2 > 1) { x /= l2; z /= l2; }
  input.mx = x; input.mz = z;
  if (debug.autopilot && game.state === 'fight' && player.alive) autopilot();
  if (input.mouseAimT > 0) input.mouseAimT -= realDt;
  if (input.mouseIn && !IS_TOUCH) updateMouseGround();
}

// test autopilot (debug only): hazard-aware dodging + ability use through the normal input path
function apDanger(cx, cz, horizon) {
  let s = 0;
  for (let i = 0; i < TELE_N; i++) { const o = tele[i]; if (!o.active || o.resolved || o.noHit || o.shape >= 4) continue; const sd = teleSD(o, cx, cz); if (sd < 1.0) s += (4 + 10 * (o.t / o.windup)) * (1 + Math.min(4, 1.0 - sd)); }
  for (let i = 0; i < HB_N; i++) { const o = hzBeams[i]; if (!o.active) continue; const d = segDist(cx, cz, o.x0, o.z0, o.x1, o.z1) - o.w / 2; if (d < 1.4) s += 12 + (1.4 - d) * 6; }
  for (let i = 0; i <= PJ.hi; i++) { if (!PJ.alive[i] || (PJ.fl[i] & (F_REFL | F_HARMLESS | F_NOHIT))) continue; const fx2 = PJ.x[i] + PJ.vx[i] * horizon, fz2 = PJ.z[i] + PJ.vz[i] * horizon; const d = segDist(cx, cz, PJ.x[i], PJ.z[i], fx2, fz2) - PJ.r[i]; if (d < 0.75) s += 4; else if (d < 1.3) s -= 0.4; }
  return s;
}
function autopilot() {
  const p = player; let best = -1e9, bx = 0, bz = 0;
  const here = apDanger(p.x, p.z, 0.25);
  for (let k = 0; k <= 16; k++) {
    const a = k / 16 * TAU, m = k === 16 ? 0 : 1; const dx = Math.cos(a) * m, dz = Math.sin(a) * m;
    const cx = p.x + dx * 2.4, cz = p.z + dz * 2.4; const rr = Math.hypot(cx, cz);
    let sc = -apDanger(cx, cz, 0.3) - apDanger(p.x + dx * 0.8, p.z + dz * 0.8, 0.15) * 0.7;
    sc -= Math.abs(rr - 8.5) * 0.35; if (rr > game.arenaR - 1) sc -= 20;
    if (bossRT.def && bossRT.def.apPenalty) sc -= bossRT.def.apPenalty(cx, cz);
    if (sc > best) { best = sc; bx = dx; bz = dz; }
  }
  input.mx = bx; input.mz = bz;
  if (here > 9 && player.dashT < 0) useAbility('dash');
  if (abilityReady('nova')) useAbility('nova');
  if (abilityReady('lance')) useAbility('lance');
  if (PJ.count > 12 && abilityReady('mirror')) useAbility('mirror');
  if (p.hp < 70 && abilityReady('lattice')) useAbility('lattice');
  if (bossRT.def && bossRT.def.apHook) bossRT.def.apHook();
}

/* =====================================================================
   17  UI — HUD binding, screens, persistence
   ===================================================================== */
const STORE_KEY = 'prismfall.v1';
let store = { unlocked: 1, best: {}, deaths: 0, settings: {} };
try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (s && typeof s === 'object') store = Object.assign(store, s); } catch (e) { }
if (!store.best) store.best = {};
function saveStore() { try { store.settings = { quality: settings.quality, reduceFx: settings.reduceFx, volume: settings.volume }; localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { } }
if (store.settings) { if (store.settings.quality) settings.quality = store.settings.quality; settings.reduceFx = !!store.settings.reduceFx; if (store.settings.volume != null) settings.volume = store.settings.volume; }

const $ = (id) => document.getElementById(id);
const ui = {
  el: {
    hud: $('hud'), bossNameT: $('bossNameT'), enrageT: $('enrageT'), bossHpFill: $('bossHpFill'), bossHpChunk: $('bossHpChunk'), bossPct: $('bossPct'), bossNotches: $('bossNotches'),
    fracWrap: $('fracWrap'), fracFill: $('fracFill'), bossTags: $('bossTags'), castBar: $('castBar'), castName: $('castName'), castFill: $('castFill'),
    hpFill: $('hpFill'), hpChunk: $('hpChunk'), hpNum: $('hpNum'), combo: $('combo'), radWrap: $('radWrap'), radFill: $('radFill'), radTxt: $('radTxt'),
    toast: $('toast'), letterbox: $('letterbox'), titleCard: $('titleCard'), tcBig: $('tcBig'), tcSub: $('tcSub'), bigCast: $('bigCast'), bigCastFill: $('bigCastFill'), bigCastName: $('bigCastName'), fade: $('fade'),
    ab: { dash: $('ab-dash'), lance: $('ab-lance'), lattice: $('ab-lattice'), mirror: $('ab-mirror'), nova: $('ab-nova') }, dbg: $('dbg'), descend: $('descendText'), descendSub: $('descendSub'),
  },
  c: {}, n: {}, tutQ: [], toastT: 0, tcT: 0, cdTick: 0, comboHueT: 0,
  setN(key, v) { if (this.n[key] === v) return false; this.n[key] = v; return true; }, bossChunk: 1, bossChunkHold: 0, hpChunk: 1, hpChunkHold: 0, lastBossHp: 1, lastHp: 1,
  set(key, el, prop, v) { if (this.c[key] === v) return; this.c[key] = v; if (prop === 'text') el.textContent = v; else if (prop === 'tf') el.style.transform = v; else if (prop === 'cls') el.className = v; else if (prop === 'bg') el.style.background = v; else if (prop === 'op') el.style.opacity = v; else if (prop === 'html') el.innerHTML = v; },
  hud(on) { this.el.hud.classList.toggle('on', !!on); },
  toast(text, dur = 2.5, warn = false) { const t = this.el.toast; t.textContent = text; t.classList.toggle('warn', !!warn); t.classList.add('on'); this.toastT = dur; },
  // tutorials queue up: never on top of a title card or another toast, only during live play
  tutorial(key, text) { if (game.tutorial[key]) return; game.tutorial[key] = true; if (this.tutQ.length < 4) this.tutQ.push(text); },
  lbOn: false, letterbox(on) { this.lbOn = !!on; this.el.letterbox.classList.toggle('on', !!on); },
  titleCard(big, sub, dur = 2.8) { this.el.tcBig.textContent = big; this.el.tcSub.textContent = sub || ''; this.el.titleCard.classList.add('on'); this.tcT = dur; },
  readyFlash(name) { const el = this.el.ab[name]; if (!el) return; el.classList.remove('rdy'); void el.offsetWidth; el.classList.add('rdy'); setTimeout(() => el.classList.remove('rdy'), 600); },
  pressFlash(name) { const el = this.el.ab[name]; if (!el) return; el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 110); },
  setupBossFrame(def) {
    this.el.bossNameT.textContent = def.name; this.el.bossHpFill.style.background = def.barGrad;
    let html = ''; for (let i = 0; i < def.phases.length - 1; i++) html += `<div class="notch" style="left:${(def.phases[i].until * 100).toFixed(1)}%"></div>`;
    this.el.bossNotches.innerHTML = html; this.bossChunk = 1; this.c = {}; this.n = {};
  },
  update(realDt) {
    const e = this.el;
    if (this.toastT > 0) { this.toastT -= realDt; if (this.toastT <= 0) e.toast.classList.remove('on'); }
    else if (this.tutQ.length && this.tcT <= 0 && game.state === 'fight' && this.toastGap <= 0) { this.toast(this.tutQ.shift(), 3.2); }
    if (this.toastT <= 0) this.toastGap = (this.toastGap || 0) - realDt; else this.toastGap = 0.6;
    if (this.tcT > 0) { this.tcT -= realDt; if (this.tcT <= 0) { e.titleCard.classList.remove('on'); if (game.state === 'fight') this.letterbox(false); } }
    else if (this.lbOn && game.state === 'fight') this.letterbox(false); // never leave the bars over live gameplay
    if (!bossRT.def) return;
    const b = bossRT;
    // boss frame
    const hpK = clamp(b.hp / b.maxHp, 0, 1);
    let q = Math.round(hpK * 4000); if (this.setN('bhp', q)) e.bossHpFill.style.transform = 'scaleX(' + (q / 4000) + ')';
    if (hpK < this.lastBossHp - 1e-5) this.bossChunkHold = 0.4; this.lastBossHp = hpK;
    if (this.bossChunkHold > 0) this.bossChunkHold -= realDt; else this.bossChunk = damp(this.bossChunk, hpK, 5, realDt);
    if (this.bossChunk < hpK) this.bossChunk = hpK;
    q = Math.round(this.bossChunk * 1000); if (this.setN('bchunk', q)) e.bossHpChunk.style.transform = 'scaleX(' + (q / 1000) + ')';
    q = hpK < 0.1 ? Math.round(hpK * 1000) : 10000 + Math.round(hpK * 100); if (this.setN('bpct', q)) e.bossPct.textContent = (hpK * 100).toFixed(hpK < 0.1 ? 1 : 0) + '%';
    q = Math.floor(Math.max(0, b.enrageLeft > 9000 ? 0 : b.enrageLeft)); if (this.setN('enr', q)) e.enrageT.textContent = fmtTime(q);
    this.set('enrc', e.enrageT, 'cls', b.enrageLeft < 30 ? 't warn' : 't');
    q = Math.round(b.fracture * 10); if (this.setN('frac', q)) e.fracFill.style.transform = 'scaleX(' + (q / 1000) + ')';
    this.set('fracc', e.fracWrap, 'cls', b.fracture >= 100 ? 'full' : '');
    const tags = (b.vuln > 0 ? '<span class="pill vuln">VULNERABLE ×2</span>' : '') + (b.shieldMul < 1 ? `<span class="pill">×${b.shieldMul} DMG</span>` : '') + (b.stagger > 0 ? '<span class="pill">STAGGERED</span>' : '');
    this.set('tags', e.bossTags, 'html', tags);
    const ca = b.cast.active && game.state === 'fight';
    this.set('castOn', e.castBar, 'cls', ca ? (b.cast.white ? 'on white' : 'on') : (b.cast.white ? 'white' : ''));
    if (ca) { this.set('castN', e.castName, 'text', b.cast.name); q = Math.round(clamp(b.cast.t / b.cast.dur, 0, 1) * 500); if (this.setN('castF', q)) e.castFill.style.transform = 'scaleX(' + (q / 500) + ')'; }
    // player
    const p = player; const pk = clamp(p.hp / p.maxHp, 0, 1);
    q = Math.round(pk * 1000); if (this.setN('php', q)) e.hpFill.style.transform = 'scaleX(' + (q / 1000) + ')';
    if (pk < this.lastHp - 1e-5) this.hpChunkHold = 0.4; this.lastHp = pk;
    if (this.hpChunkHold > 0) this.hpChunkHold -= realDt; else this.hpChunk = damp(this.hpChunk, pk, 5, realDt);
    if (this.hpChunk < pk) this.hpChunk = pk;
    q = Math.round(this.hpChunk * 1000); if (this.setN('pchunk', q)) e.hpChunk.style.transform = 'scaleX(' + (q / 1000) + ')';
    q = Math.ceil(p.hp); if (this.setN('phpn', q)) e.hpNum.textContent = String(q);
    this.set('phpc', e.hpFill, 'cls', pk < 0.3 ? 'fill low' : 'fill');
    const comboOn = p.comboN >= 2;
    this.set('combo', e.combo, 'cls', comboOn ? 'on' : '');
    if (comboOn) { if (this.setN('comboN', p.comboN)) e.combo.textContent = 'PERFECT ×' + p.comboN; this.comboHueT -= realDt; if (this.comboHueT <= 0) { this.comboHueT = 0.08; e.combo.style.color = 'hsl(' + Math.round((performance.now() / 6) % 360) + ',100%,72%)'; } }
    // Radiance bar (fills from landing hits; full = White Nova)
    q = Math.round(p.rad * 5); if (this.setN('rad', q)) { e.radFill.style.transform = 'scaleX(' + (q / 500) + ')'; e.ab.nova.style.setProperty('--k', (q / 5).toFixed(1) + '%'); }
    const full = p.rad >= 100;
    this.set('radc', e.radWrap, 'cls', full ? 'full' : '');
    q = full ? -1 : Math.floor(p.rad); if (this.setN('radt', q)) e.radTxt.textContent = full ? (IS_TOUCH ? 'NOVA READY' : 'NOVA READY  [4 / R]') : 'RADIANCE ' + q + '%';
    // abilities (≤30 Hz)
    this.cdTick -= realDt; if (this.cdTick > 0) return; this.cdTick = 1 / 30;
    this.abil('lance', 1, p.cdLance, PLAYER.lanceCd);
    this.abil('lattice', 1, p.cdLattice, PLAYER.latCd);
    this.abil('mirror', 1, p.cdMirror, PLAYER.mirCd);
    // dash
    const D = this.abEl('dash'); const dk = p.dashCharges >= p.dashMax ? 0 : 1 - p.dashRecharge / PLAYER.dashCd;
    q = p.dashCharges === 0 ? Math.round(dk * 200) : -1; if (this.setN('dashcd', q)) D.cd.style.background = q >= 0 ? 'conic-gradient(rgba(0,0,0,.62) ' + (q / 2) + '%, transparent 0)' : 'none';
    q = p.dashCharges === 0 ? Math.round((PLAYER.dashCd - p.dashRecharge) * 10) : -1; if (this.setN('dashcdt', q)) D.cdt.textContent = q >= 0 ? (q / 10).toFixed(1) : '';
    for (let i = 0; i < 3; i++) this.set('pip' + i, D.pips[i], 'cls', i >= p.dashMax ? 'hidden' : i < p.dashCharges ? 'on' : '');
    this.set('nova', e.ab.nova, 'cls', abilityReady('nova') && game.state === 'fight' ? 'ab ready' : 'ab');
    this.set('dashFill', D.fill, 'tf', p.dashCharges > 0 ? 'scaleY(1)' : 'scaleY(0.15)');
  },
  abEls: {},
  abEl(name) { let o = this.abEls[name]; if (!o) { const el = this.el.ab[name]; o = this.abEls[name] = { el, fill: el.querySelector('.fill'), cd: el.querySelector('.cd'), cdt: el.querySelector('.cdt'), pips: Array.from(el.querySelectorAll('.pips i')) }; } return o; },
  abil(name, afford, cd, cdMax) {
    const A = this.abEl(name); const a = clamp(afford, 0, 1);
    let q = Math.round(a * 100); if (this.setN(name + 'f', q)) A.fill.style.transform = 'scaleY(' + (q / 100) + ')';
    this.set(name + 'd', A.el, 'cls', afford >= 1 ? 'ab' : 'ab dim');
    const k = cd > 0 ? cd / cdMax : 0;
    q = k > 0 ? Math.round(k * 200) : -1; if (this.setN(name + 'c', q)) A.cd.style.background = q >= 0 ? 'conic-gradient(rgba(0,0,0,.62) ' + (q / 2) + '%, transparent 0)' : 'none';
    q = cd > 0 ? (cd < 1 ? Math.round(cd * 10) : 100 + Math.ceil(cd)) : -1; if (this.setN(name + 't', q)) A.cdt.textContent = q < 0 ? '' : q < 100 ? (q / 10).toFixed(1) : String(q - 100);
  },
};
function measureHud() {
  try {
    const bf = $('bossFrame').getBoundingClientRect(), pf = $('playerFrame').getBoundingClientRect();
    hudTopPx = Math.round(Math.max(bf.bottom, pf.bottom));
    document.documentElement.style.setProperty('--hudB', hudTopPx + 'px');
    const s = parseFloat(getComputedStyle(document.body).getPropertyValue('--s')) || 1;
    const dr = $('ab-dash').getBoundingClientRect();
    const sab = Math.max(0, VH - dr.bottom - 22 * s), sar = Math.max(0, VW - dr.right - 22 * s);
    camSafe.sab = sab; camSafe.clusterH = 235 * s + sab; camSafe.clusterW = 235 * s + sar;
  } catch (e) { }
}
function showScreen(id, on = true) { $(id).classList.toggle('hidden', !on); }
function anyModal() { return ['bossSel', 'settings', 'pause', 'facet', 'defeat', 'victory'].some((id) => !$(id).classList.contains('hidden')); }
function renderStats() {
  const b = store.best || {}; const parts = [];
  for (let i = 1; i <= 3; i++) parts.push(`${['I', 'II', 'III'][i - 1]} ${b['b' + i] != null ? fmtTimeMs(b['b' + i]) : '—'}`);
  $('stats').innerHTML = `BEST CLEARS · ${parts.join(' · ')}<br>FULL RUN ${b.run != null ? fmtTimeMs(b.run) : '—'} · SHATTERED ${store.deaths || 0}×`;
  $('prompt').textContent = (IS_TOUCH ? 'TAP' : 'CLICK') + ' TO DESCEND';
}
function renderBossSel() {
  const list = $('bossSelList'); list.innerHTML = '';
  BOSSES.forEach((d, i) => {
    const btn = document.createElement('button'); btn.className = 'gbtn'; const locked = i + 1 > (store.unlocked || 1) && !DEBUG;
    btn.textContent = `${['I', 'II', 'III'][i]} · ${d.name}${locked ? ' (LOCKED)' : ''}`; btn.disabled = locked;
    btn.addEventListener('click', () => { sfx.ui(); showScreen('bossSel', false); titleStart(i, false); });
    list.appendChild(btn);
  });
}
function renderSettings() {
  document.querySelectorAll('#segQuality button').forEach((b) => b.classList.toggle('on', b.dataset.q === settings.quality));
  document.querySelectorAll('#segReduce button').forEach((b) => b.classList.toggle('on', (b.dataset.v === '1') === settings.reduceFx));
  $('volume').value = Math.round(settings.volume * 100);
}
$('btnBossSel').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); sfx.ui(); renderBossSel(); showScreen('bossSel'); });
$('btnSettings').addEventListener('click', (e) => { e.stopPropagation(); audioInit(); sfx.ui(); renderSettings(); showScreen('settings'); });
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); sfx.ui(); showScreen(b.dataset.close, false); }));
document.querySelectorAll('#segQuality button').forEach((b) => b.addEventListener('click', () => { settings.quality = b.dataset.q; if (b.dataset.q === 'auto') { Q.auto = true; } else { Q.auto = false; applyQuality(b.dataset.q); } saveStore(); renderSettings(); sfx.ui(); }));
document.querySelectorAll('#segReduce button').forEach((b) => b.addEventListener('click', () => { settings.reduceFx = b.dataset.v === '1'; saveStore(); renderSettings(); sfx.ui(); }));
$('volume').addEventListener('input', (e) => { setVolume(e.target.value / 100); saveStore(); });
$('title').addEventListener('click', (e) => { if (e.target.closest('button')) return; titleStart(); });
$('btnResume').addEventListener('click', () => togglePause(false));
$('btnRestart').addEventListener('click', () => { showScreen('pause', false); game.state = 'fight'; retryBoss(); });
$('btnPauseSettings').addEventListener('click', () => { renderSettings(); showScreen('settings'); });
$('btnQuit').addEventListener('click', () => { showScreen('pause', false); toTitle(); });
$('pauseBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); togglePause(true); });
$('btnRetry').addEventListener('click', () => { sfx.ui(); retryBoss(); });
$('btnDefTitle').addEventListener('click', () => { sfx.ui(); toTitle(); });
$('btnAgain').addEventListener('click', () => { sfx.ui(); showScreen('victory', false); startRun(true, 0); });
$('btnVicTitle').addEventListener('click', () => { sfx.ui(); toTitle(); });
// background tabs: silence everything (the sequencer's setInterval gets throttled and stutters otherwise)
let auWasRunning = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game.state === 'fight') togglePause(true);
    if (AU.ctx && AU.ctx.state === 'running') { auWasRunning = true; try { AU.ctx.suspend(); } catch (e) { } }
  } else if (AU.ctx && auWasRunning) { auWasRunning = false; try { AU.ctx.resume(); } catch (e) { } }
});

/* =====================================================================
