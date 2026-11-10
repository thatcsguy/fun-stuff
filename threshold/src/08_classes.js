// The two playable classes. Slot order is fixed: 0 filler, 1 spender, 2 ultimate, 3 mobility, 4 defensive, 5 interrupt, 6 heal.
const ICON = {
  slash: 'M4 20C7 9 13 4 21 3 17 9 12 15 4 20Z',
  sever: 'M3 5 9 3 21 19 19 21ZM21 5 15 3 3 19 5 21Z',
  storm: 'M12 12C12 6 16 3 21 4 17 5 15 8 15 12ZM12 12C18 12 21 16 20 21 19 17 16 15 12 15ZM12 12C12 18 8 21 3 20 7 19 9 16 9 12ZM12 12C6 12 3 8 4 3 5 7 8 9 12 9Z',
  lunge: 'M2 11H13V6L22 12 13 18V13H2ZM2 6H8V8H2ZM2 16H8V18H2Z',
  riposte: 'M12 2 20 5V12C20 17 16 20.5 12 22 8 20.5 4 17 4 12V5ZM12 6 7 8V12C7 15 9.5 17.5 12 18.5Z',
  sunder: 'M12 1 14.5 8.5 22 6 16.5 12 22 18 14.5 15.5 12 23 9.5 15.5 2 18 7.5 12 2 6 9.5 8.5Z',
  heal: 'M12 21C5 15.5 3 12 3 8.5A4.5 4.5 0 0 1 12 6.5 4.5 4.5 0 0 1 21 8.5C21 12 19 15.5 12 21Z',
  bolt: 'M14 1 4 13H11L9 23 20 10H13Z',
  discharge: 'M12 7A5 5 0 1 0 12 17 5 5 0 1 0 12 7ZM11 1H13V5H11ZM11 19H13V23H11ZM1 11H5V13H1ZM19 11H23V13H19ZM4 5.5 5.5 4 8 6.5 6.5 8ZM16 17.5 17.5 16 20 18.5 18.5 20ZM18.5 4 20 5.5 17.5 8 16 6.5ZM5.5 20 4 18.5 6.5 16 8 17.5Z',
  tempest: 'M7 9A5 5 0 0 1 17 8 4 4 0 0 1 18 16H6A3.5 3.5 0 0 1 7 9ZM11 17 8 22H11L10 24 14 19H11L12 17Z',
  blink: 'M2 11H5V13H2ZM7 11H10V13H7ZM12 11H15V7L22 12 15 17V13H12Z',
  pulse: 'M12 2A10 10 0 1 0 12 22 10 10 0 1 0 12 2ZM12 5A7 7 0 0 1 17.6 16.2L7.8 6.4A7 7 0 0 1 12 5ZM6.4 7.8 16.2 17.6A7 7 0 0 1 6.4 7.8Z',
  aegis: 'M12 2 21 7V17L12 22 3 17V7ZM12 5.5 6 9V15L12 18.5 18 15V9Z',
  mend: 'M9 3H15V9H21V15H15V21H9V15H3V9H9Z',
};
const MELEE = 3.4;
function hitPoint(p, t, out) { const a = angTo(t.pos.x, t.pos.z, p.pos.x, p.pos.z), r = Math.min(t.radius, Math.hypot(p.pos.x - t.pos.x, p.pos.z - t.pos.z)); return out.set(t.pos.x + Math.sin(a) * r * 0.85, Math.min(t.pos.y + t.aimY, 1.4 + t.meleeY), t.pos.z + Math.cos(a) * r * 0.85); }
const _hp = new V3(), _h2 = new V3();

// ============================== DUSKBLADE ==============================
G.classes.push({
  id: 'duskblade', name: 'DUSKBLADE', role: 'Melee. Builds Momentum, lives on the counter.', color: '#b98cff', hp: 1000, gcd: 1.0,
  gcdOf: (p) => p.hasBuff('storm') ? 0.6 : 1.0,
  resource: { name: 'Momentum', max: 5 },
  look: { armor: 0x2c2640, cloth: 0x3d1c58, glow: 0xa868ff, hood: false },
  skills: [
    { id: 'slash', name: 'Slash', icon: 'slash', range: MELEE, melee: true, desc: 'Three-hit combo. Each hit builds Momentum.',
      fire(p, t) {
        const step = p.combo % 3; p.combo++; const dmg = [45, 55, 78][step];
        p.model.swing(step, 0.26); Sound.sfx('slash', 1, 0.9 + step * 0.12);
        const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
        FX.slash(p.pos.x + fx * 0.8, 1.25, p.pos.z + fz * 0.8, p.facing, { r: 2.7, color: 0xb070ff, tilt: [0.5, -0.35, 0][step], pitch: step === 2 ? 1.2 : 0, flip: step === 1 });
        if (t && t.alive) { t.damage(dmg, { src: 'player' }); hitPoint(p, t, _hp); FX.burst(_hp.x, _hp.y, _hp.z, { n: 8 + step * 5, color: 0xc9a0ff, speed: [2, 8], life: [0.2, 0.5], size: [0.12, 0.35] }); Sound.sfx('hit', 0.7); }
        p.gain((step === 2 ? 2 : 1) + (p.hasBuff('storm') ? 1 : 0));
      } },
    { id: 'sever', name: 'Sever', icon: 'sever', range: MELEE, melee: true, desc: 'Spend all Momentum in one cut. Far stronger at five.',
      usable: (p) => p.res >= 1 || 'res',
      fire(p, t) {
        const m = p.res, dmg = 45 * m + (m >= 5 ? 50 : 0); p.res = 0; p.model.swing(1, 0.34); Sound.sfx(m >= 5 ? 'crit' : 'slash');
        const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
        FX.slash(p.pos.x + fx, 1.3, p.pos.z + fz, p.facing, { r: 3.4, color: 0xff5a9c, tilt: 0.6, dur: 0.3 }); FX.slash(p.pos.x + fx, 1.3, p.pos.z + fz, p.facing, { r: 3.4, color: 0xb070ff, tilt: -0.6, flip: true, dur: 0.3 });
        if (t && t.alive) { t.damage(dmg, { src: 'player', crit: m >= 5 }); hitPoint(p, t, _hp); FX.burst(_hp.x, _hp.y, _hp.z, { n: 10 + m * 7, color: 0xff7ab0, color2: 0xa060ff, speed: [3, 12], life: [0.3, 0.7] }); if (m >= 5) { FX.light(_hp.x, _hp.y, _hp.z, 0xff5a9c, 60, 0.3); FX.shake(0.25); } }
      } },
    { id: 'storm', name: 'Bladestorm', icon: 'storm', cd: 80, gcd: false, desc: '10 s of frenzy: faster attacks, extra Momentum.',
      fire(p) { p.addBuff('storm', 10, 'storm'); Sound.sfx('roar', 0.5, 2); FX.dome(p.pos.x, 1, p.pos.z, { r: 5, color: 0xb070ff }); FX.burst(p.pos.x, 1, p.pos.z, { n: 60, color: 0xb070ff, color2: 0xff5a9c, speed: [4, 12], life: [0.4, 1] }); } },
    { id: 'lunge', name: 'Lunge', icon: 'lunge', cd: 9, charges: 2, gcd: false, desc: 'Dash to your target. With no target in reach, dash where you are moving.',
      fire(p, t) {
        let dir, dist; const far = t && t.alive && t.distTo(p.pos.x, p.pos.z) > 2.2 && t.distTo(p.pos.x, p.pos.z) < 28 && !p.moving;
        const toT = t && t.alive && t.distTo(p.pos.x, p.pos.z) > 2.2 && t.distTo(p.pos.x, p.pos.z) < 28 && (!p.moving || Math.abs(angDiff(Math.atan2(p.intentX, p.intentZ), angTo(p.pos.x, p.pos.z, t.pos.x, t.pos.z))) < 0.9);
        if (far || toT) { dir = angTo(p.pos.x, p.pos.z, t.pos.x, t.pos.z); dist = Math.max(0.5, Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) - t.radius - 1.4); }
        else { dir = p.moving ? Math.atan2(p.intentX, p.intentZ) : p.facing; dist = 8; }
        { const A = G.arena; if (A && A.edge === 'fall') { while (dist > 0.5 && !A.contains(p.pos.x + Math.sin(dir) * dist, p.pos.z + Math.cos(dir) * dist)) dist -= 0.5; if (!A.contains(p.pos.x + Math.sin(dir) * dist, p.pos.z + Math.cos(dir) * dist)) dist = 0.01; } }
        const dur = clamp(dist / 46, 0.12, 0.42); p.facing = dir; p.casting = null;
        p.dash = { vx: Math.sin(dir) * dist / dur, vz: Math.cos(dir) * dist / dur, t: dur, done: (q) => { if ((far || toT) && t.alive && t.distTo(q.pos.x, q.pos.z) < MELEE + 0.6) { t.damage(40, { src: 'player' }); q.gain(1); q.model.swing(2, 0.2); hitPoint(q, t, _hp); FX.impact(_hp.x, _hp.y, _hp.z, 0xb070ff, 0.8); Sound.sfx('hit'); } } };
        Sound.sfx('dash'); FX.burst(p.pos.x, 1, p.pos.z, { n: 24, color: 0xb070ff, dir: [-Math.sin(dir), 0.1, -Math.cos(dir)], spread: 0.5, speed: [2, 9], life: [0.25, 0.6] });
      } },
    { id: 'riposte', name: 'Riposte', icon: 'riposte', cd: 10, gcd: false, desc: 'Parry for a moment. A blocked hit deals no damage, fills Momentum and strikes back hard.',
      fire(p) { p.parryT = 0.85; Sound.sfx('sword', 0.7); FX.ring(p.pos.x, p.pos.z, { r0: 1.6, r1: 0.6, color: 0xffffff, dur: 0.25 }); } },
    { id: 'sunder', name: 'Sunder', icon: 'sunder', cd: 14, gcd: false, range: MELEE, melee: true, desc: 'Interrupts a cast. Always leaves the target Exposed (takes more damage).',
      fire(p, t) {
        p.model.swing(3, 0.3); Sound.sfx('hit', 1, 0.6); if (!t || !t.alive) return;
        t.damage(70, { src: 'player' }); t.exposed = 6; hitPoint(p, t, _hp); FX.impact(_hp.x, _hp.y, _hp.z, 0xffd070, 1.1);
        if (t.interrupt()) p.gain(3);
      } },
    { id: 'wind', name: 'Second Wind', icon: 'heal', limited: 3, cd: 2, gcd: false, desc: 'Heal 35% of your health. Three uses per fight.',
      fire(p) { p.heal(350); } },
  ],
  onParry(p, o) {
    Sound.sfx('parry'); p.res = p.resMax; p.invuln = 0.35; FX.flash(0xffffff, 0.22, 5); FX.dome(p.pos.x, 1.2, p.pos.z, { r: 3.5, color: 0xffffff, dur: 0.3 }); FX.burst(p.pos.x, 1.2, p.pos.z, { n: 40, color: 0xffffff, color2: 0xb070ff, speed: [5, 16], life: [0.2, 0.6] });
    FX.num(p.aim(), 'PARRY', 'note'); const st = p.sk[4]; if (st.cd > 0) st.cd = Math.max(0.1, st.cd - 4);
    const t = p.target; if (t && t.alive && t.distTo(p.pos.x, p.pos.z) < 9) { p.model.swing(1, 0.3); t.damage(240, { src: 'player', crit: true }); hitPoint(p, t, _hp); FX.lightning(p.aim(_h2), _hp, { color: 0xd0a0ff, width: 0.2 }); FX.impact(_hp.x, _hp.y, _hp.z, 0xffffff, 1.4); Sound.sfx('crit'); }
    G.timeScale = 0.25; Co.start(function* () { let t0 = 0; while (t0 < 0.1) { t0 += G.rdt || 0.016; yield; } G.timeScale = 1; }, 'sys');
  },
  update(p, dt) { if (p.hasBuff('storm') && !G.headless && vrand() < dt * 30) FX.burst(p.pos.x, 0.2 + vrand() * 1.8, p.pos.z, { n: 1, color: 0xb070ff, speed: [0.5, 2], life: [0.3, 0.7], radius: 0.6 }); },
  bot(p, c) {
    const t = p.target; if (!t) return;
    if (c.wantInterrupt && p.block(5) === '') return p.press(5);
    if (c.danger && p.block(4) === '') return p.press(4);
    if (c.hp < 0.45 && p.block(6) === '') return p.press(6);
    if (c.holdFire) return;
    if (t.distTo(p.pos.x, p.pos.z) > MELEE + 1.5 && c.chase && p.block(3) === '') return p.press(3);
    if (t.isBoss && !t.immune && p.block(2) === '') p.press(2);
    if (p.res >= 5) p.press(1); else p.press(0);
  },
});

// ============================== STORMCALLER ==============================
G.classes.push({
  id: 'stormcaller', name: 'STORMCALLER', role: 'Ranged caster. Plants its feet to cast, spends Static on the move.', color: '#6fd8ff', hp: 1000, gcd: 1.5,
  gcdOf: (p, s) => (p.hasBuff('tempest') ? 0.75 : 1.5) * (s.id === 'discharge' ? 0.8 : 1),
  resource: { name: 'Static', max: 4 },
  look: { armor: 0x1c3344, cloth: 0x12344a, glow: 0x50d0ff, hood: true },
  skills: [
    { id: 'bolt', name: 'Bolt', icon: 'bolt', range: 34, desc: 'Cast time. Heavy lightning that builds Static. You must stand still.',
      cast: (p) => p.hasBuff('surge') ? 0 : p.hasBuff('tempest') ? 0.7 : 1.5, moveCast: (p) => p.hasBuff('tempest'),
      fire(p, t, wasCast) {
        if (!wasCast) p.dropBuff('surge');
        p.model.swing(3, 0.25); Sound.sfx('bolt'); if (!t || !t.alive) return;
        const a = p.hand(_h2); t.aim(_hp); _hp.x += (vrand() - 0.5) * t.radius * 0.6; _hp.y += (vrand() - 0.5) * 1.2;
        FX.lightning(a, _hp, { color: 0x9fe6ff, width: 0.13 }); FX.light(_hp.x, _hp.y, _hp.z, 0x70d0ff, 40, 0.25); t.damage(148, { src: 'player' }); p.gain(1);
      } },
    { id: 'discharge', name: 'Discharge', icon: 'discharge', range: 34, desc: 'Instant. Releases all Static at once. Usable on the move.',
      usable: (p) => p.res >= 1 || 'res',
      fire(p, t) {
        const m = p.res, dmg = 70 * m + (m >= 4 ? 55 : 0); p.res = 0; p.model.swing(0, 0.3); Sound.sfx('zap'); if (!t || !t.alive) return;
        const a = p.hand(_h2); for (let i = 0; i < 1 + m; i++) { t.aim(_hp); _hp.x += (vrand() - 0.5) * t.radius; _hp.y += (vrand() - 0.5) * 2; _hp.z += (vrand() - 0.5) * t.radius; FX.lightning(a, _hp, { color: i % 2 ? 0xfff0a0 : 0x9fe6ff, width: 0.1 + m * 0.03, jag: 1.4 }); }
        t.aim(_hp); FX.dome(_hp.x, _hp.y, _hp.z, { r: 1.5 + m * 0.6, color: 0x9fe6ff, dur: 0.35 }); t.damage(dmg, { src: 'player', crit: m >= 4 }); if (m >= 4) FX.shake(0.25);
      } },
    { id: 'tempest', name: 'Tempest', icon: 'tempest', cd: 80, gcd: false, desc: '10 s of storm: Bolt casts in half the time and while moving.',
      fire(p) { p.addBuff('tempest', 10, 'tempest'); Sound.sfx('thunder', 0.6); FX.pillar(p.pos.x, p.pos.z, { r: 0.9, h: 26, color: 0x70d0ff, dur: 0.7 }); FX.burst(p.pos.x, 1, p.pos.z, { n: 60, color: 0x9fe6ff, color2: 0xfff0a0, speed: [4, 12], life: [0.4, 1] }); } },
    { id: 'blink', name: 'Blink', icon: 'blink', cd: 11, charges: 2, gcd: false, desc: 'Teleport where you are moving. Your next Bolt is instant.',
      fire(p) {
        const dir = p.moving ? Math.atan2(p.intentX, p.intentZ) : p.facing, A = G.arena; let d = 11;
        FX.burst(p.pos.x, 1, p.pos.z, { n: 30, color: 0x9fe6ff, speed: [1, 5], life: [0.3, 0.7] }); const ox = p.pos.x, oz = p.pos.z;
        while (d > 0.5 && A && !A.contains(p.pos.x + Math.sin(dir) * d, p.pos.z + Math.cos(dir) * d)) d -= 0.5;
        if (A && !A.contains(p.pos.x + Math.sin(dir) * d, p.pos.z + Math.cos(dir) * d)) d = 0;
        p.pos.x += Math.sin(dir) * d; p.pos.z += Math.cos(dir) * d; if (A && A.edge !== 'fall') A.clamp(p.pos, ox, oz);
        p.casting = null; p.addBuff('surge', 6, 'bolt'); Sound.sfx('blink');
        FX.beam(_hp.set(ox, 1.1, oz), _h2.set(p.pos.x, 1.1, p.pos.z), { color: 0x70d0ff, width: 0.3, dur: 0.3 }); FX.burst(p.pos.x, 1, p.pos.z, { n: 30, color: 0xffffff, color2: 0x70d0ff, speed: [2, 7], life: [0.3, 0.6] });
      } },
    { id: 'aegis', name: 'Aegis', icon: 'aegis', cd: 20, gcd: false, desc: 'A 5 s barrier. If it absorbs a hit, you are filled with Static and your next Bolt is instant.',
      fire(p) { p.shield = p.shieldMax = 450; p.shieldT = 5; p.addBuff('aegis', 5, 'aegis'); Sound.sfx('shield'); FX.dome(p.pos.x, 1.1, p.pos.z, { r: 1.6, r0: 2.6, color: 0x9fe6ff, dur: 0.4 }); } },
    { id: 'pulse', name: 'Null Pulse', icon: 'pulse', cd: 15, gcd: false, range: 34, desc: 'Interrupts a cast. Also erases every projectile near you.',
      fire(p, t) {
        Sound.sfx('zap', 0.8, 0.6); const n = Bul.clearNear(p.pos.x, p.pos.z, 8); FX.ring(p.pos.x, p.pos.z, { r0: 0.5, r1: 8, color: 0xd0a0ff, dur: 0.4, width: 0.2 }); FX.dome(p.pos.x, 1, p.pos.z, { r: 8, color: 0xc090ff, dur: 0.35 });
        if (!t || !t.alive) return; t.aim(_hp); FX.beam(p.hand(_h2), _hp, { color: 0xd0a0ff, width: 0.22, dur: 0.3 }); t.damage(60, { src: 'player' });
        if (t.interrupt()) p.gain(2);
      } },
    { id: 'mend', name: 'Mend', icon: 'mend', limited: 3, cast: 2.0, gcd: true, desc: '2 s cast. Heal 40% of your health. Three uses per fight.',
      fire(p) { p.heal(400); } },
  ],
  onParry() { },
  onAbsorb(p) { if (p.res < p.resMax || !p.hasBuff('surge')) { p.res = p.resMax; p.addBuff('surge', 6, 'bolt'); FX.burst(p.pos.x, 1.2, p.pos.z, { n: 30, color: 0xfff0a0, speed: [3, 10], life: [0.3, 0.6] }); } },
  onBuffEnd(p, id) { if (id === 'aegis') { p.shield = 0; p.shieldT = 0; } },
  update(p, dt) {
    if (p.shield <= 0 && p.hasBuff('aegis')) p.dropBuff('aegis');
    if (G.headless) return;
    if (p.casting && vrand() < dt * 40) { const h = p.hand(_h2); FX.burst(h.x, h.y, h.z, { n: 1, color: 0x9fe6ff, speed: [0.5, 2.5], life: [0.2, 0.5], size: [0.1, 0.25] }); }
    if (p.hasBuff('tempest') && vrand() < dt * 25) FX.burst(p.pos.x, 0.2 + vrand() * 2, p.pos.z, { n: 1, color: 0xfff0a0, speed: [0.5, 2], life: [0.3, 0.7], radius: 0.7 });
  },
  bot(p, c) {
    const t = p.target; if (!t) return;
    if (c.wantInterrupt && p.block(5) === '') return p.press(5);
    if (c.danger && p.block(4) === '') return p.press(4);
    if (c.hp < 0.45 && c.calm > 2.3 && p.block(6) === '' && !p.casting) return p.press(6);
    if (c.holdFire) return;
    if (t.isBoss && !t.immune && p.block(2) === '' && c.calm > 1) p.press(2);
    if (p.casting) return;
    if (p.res >= 4 || (p.moving && p.res >= 1 && !p.hasBuff('tempest') && !p.hasBuff('surge'))) return p.press(1);
    if (!p.moving || p.hasBuff('tempest') || p.hasBuff('surge')) p.press(0);
  },
});
