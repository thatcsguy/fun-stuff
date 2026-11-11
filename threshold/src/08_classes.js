// The playable classes. A class has up to seven skills, in hotbar slots 0-6 (keys 1 2 3 Q E R F); a slot may be null.
// Duskblade and Stormcaller fill all seven the same way (filler, spender, ultimate, mobility, defensive, interrupt, heal).
// Ashwarden and Hexslinger deliberately do not: see the class contract in README.md for what a class must be able to do.
// Skill fields: id, name, icon, desc, range, melee, cd, charges, limited, gcd (false = off the global cooldown), cast, moveCast(p),
// usable(p, t) -> true | reason (a reason starting with a capital letter is shown to the player), start(p, t), fire(p, t, wasCast),
// and for the HUD: rdy(p) (glow), act(p) (lit while active), interrupt (glow while the target casts something stoppable), view(p) (icon override).
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
  strike: 'M3 21 4.5 15.5 16 4 21 3 20 8 8.5 19.5Z',
  heavy: 'M10 1H14V13L17.5 16.5 12 23 6.5 16.5 10 13ZM3 9 7 11V14L3 12ZM21 9 17 11V14L21 12Z',
  kindle: 'M12 1C13 6 19 8.5 19 15A7 7 0 0 1 5 15C5 11.5 7.5 10 8.5 6.5 9.5 9 11 9.5 11 8 11 5.5 11 3 12 1ZM12 13C10 15 9.5 16 9.5 17.5A2.5 2.5 0 0 0 14.5 17.5C14.5 16 14 15 12 13Z',
  roll: 'M12 4A8 8 0 1 0 20 12H17A5 5 0 1 1 12 7V10.5L18 5.5 12 0.5Z',
  flask: 'M9 2H15V4.500H14V8.500L19 18A3 3 0 0 1 16.3 22H7.7A3 3 0 0 1 5 18L10 8.500V4.500H9ZM8.2 15 6.8 18.2A1.2 1.2 0 0 0 7.9 20H16.1A1.2 1.2 0 0 0 17.2 18.2L15.8 15Z',
  shot: 'M11 1H13V5.100A7 7 0 0 1 18.9 11H23V13H18.900A7 7 0 0 1 13 18.900V23H11V18.900A7 7 0 0 1 5.1 13H1V11H5.100A7 7 0 0 1 11 5.100ZM12 8A4 4 0 1 0 12 16 4 4 0 1 0 12 8Z',
  lead: 'M8.5 22V10C8.5 6 10.5 3 12 1.5 13.5 3 15.5 6 15.5 10V22Z',
  silver: 'M8.5 22V10C8.5 6 10.5 3 12 1.5 13.5 3 15.5 6 15.5 10V22ZM12 9.5 10 13.5 12 17.5 14 13.5ZM2 12.5 6 10.5V16.5L2 14.5ZM22 12.5 18 10.5V16.5L22 14.5Z',
  salve: 'M8.5 22V10C8.5 6 10.5 3 12 1.5 13.5 3 15.5 6 15.5 10V22ZM11 10V12.5H9.800V15H11V17.500H13V15H14.2V12.5H13V10Z',
  spin: 'M12 3A9 9 0 0 1 21 12H18A6 6 0 0 0 12 6V9L7 4.5 12 0ZM12 21A9 9 0 0 1 3 12H6A6 6 0 0 0 12 18V15L17 19.5 12 24Z',
};
const MELEE = 3.4;
function hitPoint(p, t, out) { const a = angTo(t.pos.x, t.pos.z, p.pos.x, p.pos.z), r = Math.min(t.radius, Math.hypot(p.pos.x - t.pos.x, p.pos.z - t.pos.z)); return out.set(t.pos.x + Math.sin(a) * r * 0.85, Math.min(t.pos.y + t.aimY, 1.4 + t.meleeY), t.pos.z + Math.cos(a) * r * 0.85); }
const _hp = new V3(), _h2 = new V3();

// ============================== DUSKBLADE ==============================
G.classes.push({
  id: 'duskblade', name: 'DUSKBLADE', role: 'Melee. Builds Momentum, lives on the counter.', color: '#b98cff', hp: 1000, gcd: 1.0, melee: true,
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
    { id: 'sever', name: 'Sever', icon: 'sever', range: MELEE, melee: true, desc: 'Spend all Momentum in one cut. Far stronger at five.', rdy: (p) => p.res >= p.resMax,
      usable: (p) => p.res >= 1 || 'res',
      fire(p, t) {
        const m = p.res, dmg = 45 * m + (m >= 5 ? 50 : 0); p.res = 0; p.model.swing(1, 0.34); Sound.sfx(m >= 5 ? 'crit' : 'slash');
        const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
        FX.slash(p.pos.x + fx, 1.3, p.pos.z + fz, p.facing, { r: 3.4, color: 0xff5a9c, tilt: 0.6, dur: 0.3 }); FX.slash(p.pos.x + fx, 1.3, p.pos.z + fz, p.facing, { r: 3.4, color: 0xb070ff, tilt: -0.6, flip: true, dur: 0.3 });
        if (t && t.alive) { t.damage(dmg, { src: 'player', crit: m >= 5 }); hitPoint(p, t, _hp); FX.burst(_hp.x, _hp.y, _hp.z, { n: 10 + m * 7, color: 0xff7ab0, color2: 0xa060ff, speed: [3, 12], life: [0.3, 0.7] }); if (m >= 5) { FX.light(_hp.x, _hp.y, _hp.z, 0xff5a9c, 60, 0.3); FX.shake(0.25); } }
      } },
    { id: 'storm', name: 'Bladestorm', icon: 'storm', cd: 80, gcd: false, act: (p) => p.hasBuff('storm'), desc: '10 s of frenzy: faster attacks, extra Momentum.',
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
    { id: 'riposte', name: 'Riposte', icon: 'riposte', cd: 10, gcd: false, act: (p) => p.parryT > 0, desc: 'Parry for a moment. A blocked hit deals no damage, fills Momentum and strikes back hard.',
      fire(p) { p.parryT = 0.85; Sound.sfx('sword', 0.7); FX.ring(p.pos.x, p.pos.z, { r0: 1.6, r1: 0.6, color: 0xffffff, dur: 0.25 }); } },
    { id: 'sunder', name: 'Sunder', icon: 'sunder', cd: 14, gcd: false, range: MELEE, melee: true, interrupt: true, desc: 'Interrupts a cast. Always leaves the target Exposed (takes more damage).',
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
    { id: 'bolt', name: 'Bolt', icon: 'bolt', range: 34, rdy: (p) => p.hasBuff('surge'), desc: 'Cast time. Heavy lightning that builds Static. You must stand still.',
      cast: (p) => p.hasBuff('surge') ? 0 : p.hasBuff('tempest') ? 0.7 : 1.5, moveCast: (p) => p.hasBuff('tempest'),
      fire(p, t, wasCast) {
        if (!wasCast) p.dropBuff('surge');
        p.model.swing(3, 0.25); Sound.sfx('bolt'); if (!t || !t.alive) return;
        const a = p.hand(_h2); t.aim(_hp); _hp.x += (vrand() - 0.5) * t.radius * 0.6; _hp.y += (vrand() - 0.5) * 1.2;
        FX.lightning(a, _hp, { color: 0x9fe6ff, width: 0.13 }); FX.light(_hp.x, _hp.y, _hp.z, 0x70d0ff, 40, 0.25); t.damage(148, { src: 'player' }); p.gain(1);
      } },
    { id: 'discharge', name: 'Discharge', icon: 'discharge', range: 34, rdy: (p) => p.res >= p.resMax, desc: 'Instant. Releases all Static at once. Usable on the move.',
      usable: (p) => p.res >= 1 || 'res',
      fire(p, t) {
        const m = p.res, dmg = 70 * m + (m >= 4 ? 55 : 0); p.res = 0; p.model.swing(0, 0.3); Sound.sfx('zap'); if (!t || !t.alive) return;
        const a = p.hand(_h2); for (let i = 0; i < 1 + m; i++) { t.aim(_hp); _hp.x += (vrand() - 0.5) * t.radius; _hp.y += (vrand() - 0.5) * 2; _hp.z += (vrand() - 0.5) * t.radius; FX.lightning(a, _hp, { color: i % 2 ? 0xfff0a0 : 0x9fe6ff, width: 0.1 + m * 0.03, jag: 1.4 }); }
        t.aim(_hp); FX.dome(_hp.x, _hp.y, _hp.z, { r: 1.5 + m * 0.6, color: 0x9fe6ff, dur: 0.35 }); t.damage(dmg, { src: 'player', crit: m >= 4 }); if (m >= 4) FX.shake(0.25);
      } },
    { id: 'tempest', name: 'Tempest', icon: 'tempest', cd: 80, gcd: false, act: (p) => p.hasBuff('tempest'), desc: '10 s of storm: Bolt casts in half the time and while moving.',
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
    { id: 'aegis', name: 'Aegis', icon: 'aegis', cd: 20, gcd: false, act: (p) => p.shield > 0, desc: 'A 5 s barrier. If it absorbs a hit, you are filled with Static and your next Bolt is instant.',
      fire(p) { p.shield = p.shieldMax = 450; p.shieldT = 5; p.addBuff('aegis', 5, 'aegis'); Sound.sfx('shield'); FX.dome(p.pos.x, 1.1, p.pos.z, { r: 1.6, r0: 2.6, color: 0x9fe6ff, dur: 0.4 }); } },
    { id: 'pulse', name: 'Null Pulse', icon: 'pulse', cd: 15, gcd: false, range: 34, interrupt: true, desc: 'Interrupts a cast. Also erases every projectile near you.',
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

// ============================== ASHWARDEN ==============================
// No cooldowns and no builder: one stamina bar pays for every swing and every roll, and refills on its own.
// Overdrawing it leaves you Winded (nothing but the flask) until it climbs back. The roll passes through blockable hits.
const AW = { STRIKE: 6, HEAVY: 34, ROLL: 24, REGEN: 20, WIND: 15, REACH: 9 };
function awSpend(p, n) { p.res -= n; if (p.res < 0 && !p.winded) { p.winded = true; p.say('Winded'); Sound.sfx('steam', 0.5, 1.4); } }
const awReady = (p) => p.winded ? 'Winded' : true;
G.classes.push({
  id: 'ashwarden', name: 'ASHWARDEN', role: 'Melee. No cooldowns: stamina pays for every swing and every roll.', color: '#ff9a4a', hp: 1000, gcd: 0.5, melee: true,
  gcdOf: (p, s) => s.id === 'heavy' ? (p.opening > 0 ? 0.55 : 0.95) : s.id === 'flask' ? 1.0 : 0.5,
  resource: { name: 'Stamina', max: 100, kind: 'bar' },
  look: { armor: 0x3a332c, cloth: 0x5a1e0c, glow: 0xff7a2a, hood: false, weapon: 'great' },
  init(p) { p.res = 100; p.winded = false; p.opening = 0; p.dodged = false; },
  skills: [
    { id: 'strike', name: 'Strike', icon: 'strike', range: MELEE, melee: true, desc: 'A quick cut. Cheap enough to swing forever.',
      usable: awReady,
      fire(p, t) {
        const k = p.combo++ % 2; awSpend(p, AW.STRIKE); p.model.swing(k, 0.3); Sound.sfx('slash', 0.9, 0.72 + k * 0.08);
        const fx = Math.sin(p.facing), fz = Math.cos(p.facing), hot = p.hasBuff('kindle');
        FX.slash(p.pos.x + fx * 0.9, 1.3, p.pos.z + fz * 0.9, p.facing, { r: 3.3, color: hot ? 0xffc040 : 0xff8a3a, tilt: k ? -0.3 : 0.4, flip: !!k, dur: 0.24 });
        if (t && t.alive) { t.damage(48, { src: 'player' }); hitPoint(p, t, _hp); FX.burst(_hp.x, _hp.y, _hp.z, { n: hot ? 16 : 9, color: 0xffb060, color2: 0xff5a20, speed: [2, 9], life: [0.2, 0.55], size: [0.12, 0.36], grav: 6 }); Sound.sfx('hit', 0.7, 0.8); }
      } },
    { id: 'heavy', name: 'Overhead', icon: 'heavy', range: MELEE + AW.REACH, interrupt: true, desc: 'Wind up, leap to the target, bring the blade down. Stops a cast, which refunds the stamina.',
      usable: awReady, rdy: (p) => p.opening > 0,
      cast: (p) => p.opening > 0 ? 0 : 0.5, moveCast: (p) => !p.dash && !p.kb,
      start(p) { p.model.swing(2, 0.5); if (!G.headless) FX.ring(p.pos.x, p.pos.z, { r0: 2.2, r1: 0.5, color: 0xff8a3a, dur: 0.45, y: p.pos.y + 0.08 }); },
      fire(p, t) {
        const open = p.opening > 0; if (open) { p.opening = 0; p.dropBuff('opening'); } else awSpend(p, AW.HEAVY);
        const land = (q) => {
          q.model.swing(3, 0.34); if (!t || !t.alive || t.distTo(q.pos.x, q.pos.z) > MELEE + 0.9) return;
          t.damage(open ? 260 : 172, { src: 'player', crit: open }); hitPoint(q, t, _hp); Sound.sfx(open ? 'crit' : 'hit', 1, 0.55);
          FX.impact(_hp.x, _hp.y, _hp.z, open ? 0xffe0a0 : 0xff8a3a, open ? 1.5 : 1.1); FX.pillar(_hp.x, _hp.z, { r: 0.7, h: 7, color: 0xff7a2a, dur: 0.4 }); FX.shake(open ? 0.4 : 0.25);
          if (t.interrupt()) { q.res = Math.min(q.resMax, q.res + AW.HEAVY); t.exposed = 6; }
        };
        if (!t || !t.alive) return land(p);
        const d = t.distTo(p.pos.x, p.pos.z);
        if (d <= MELEE - 0.6) return land(p);
        if (d > MELEE + AW.REACH + 2) { p.model.swing(3, 0.34); return; }
        const dir = angTo(p.pos.x, p.pos.z, t.pos.x, t.pos.z), A = G.arena; let dist = Math.max(0.3, Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) - t.radius - 1.6);
        if (A && A.edge === 'fall') { while (dist > 0.5 && !A.contains(p.pos.x + Math.sin(dir) * dist, p.pos.z + Math.cos(dir) * dist)) dist -= 0.5; if (!A.contains(p.pos.x + Math.sin(dir) * dist, p.pos.z + Math.cos(dir) * dist)) dist = 0.01; }
        const dur = clamp(dist / 36, 0.1, 0.26); p.facing = dir; p.dash = { vx: Math.sin(dir) * dist / dur, vz: Math.cos(dir) * dist / dur, t: dur, done: land }; Sound.sfx('dash', 0.7, 0.8);
        FX.burst(p.pos.x, 1, p.pos.z, { n: 14, color: 0xff8a3a, dir: [-Math.sin(dir), 0.1, -Math.cos(dir)], spread: 0.5, speed: [2, 8], life: [0.2, 0.5] });
      } },
    { id: 'kindle', name: 'Kindle', icon: 'kindle', gcd: false, desc: 'Pour a flask on the blade instead of drinking it: 15 s of heavier blows and faster stamina.',
      usable: (p) => p.hasBuff('kindle') ? 'no' : p.sk[6].uses > 0 || 'spent', act: (p) => p.hasBuff('kindle'),
      fire(p) { p.sk[6].uses--; p.addBuff('kindle', 15, 'kindle'); Sound.sfx('roar', 0.5, 1.6); Sound.sfx('steam', 0.6, 0.7); FX.pillar(p.pos.x, p.pos.z, { r: 1.1, h: 9, color: 0xff7a2a, dur: 0.7, y: p.pos.y }); FX.burst(p.pos.x, p.pos.y + 1, p.pos.z, { n: 50, color: 0xffb040, color2: 0xff4a10, speed: [2, 9], up: 3, life: [0.4, 1.1] }); FX.light(p.pos.x, p.pos.y + 1.5, p.pos.z, 0xff7a2a, 50, 0.5); } },
    { id: 'roll', name: 'Roll', icon: 'roll', gcd: false, desc: 'Tumble where you are moving. Hits pass through you mid-roll; dodging one makes your next Overhead instant, free and brutal.',
      usable: (p) => p.rooted > 0 ? 'no' : awReady(p), act: (p) => p.dodgeT > 0,
      fire(p) {
        awSpend(p, AW.ROLL); const step = !p.moving, dir = step ? p.facing + PI : Math.atan2(p.intentX, p.intentZ), A = G.arena; let dist = step ? 1.7 : 5.4; // no direction held: a short hop back
        if (A && A.edge === 'fall') { while (dist > 0.5 && !A.contains(p.pos.x + Math.sin(dir) * dist, p.pos.z + Math.cos(dir) * dist)) dist -= 0.5; if (!A.contains(p.pos.x + Math.sin(dir) * dist, p.pos.z + Math.cos(dir) * dist)) dist = 0.01; }
        const dur = 0.42; if (!step) p.facing = dir; p.casting = null; p.dash = { vx: Math.sin(dir) * dist / dur, vz: Math.cos(dir) * dist / dur, t: dur }; p.dodgeT = 0.46; p.rollT = dur; p.dodged = false;
        Sound.sfx('dash', 0.8, 0.7); FX.burst(p.pos.x, p.pos.y + 0.3, p.pos.z, { n: 12, smoke: true, color: 0x6a5a4a, color2: 0x2a2420, speed: [0.5, 2.5], life: [0.4, 0.9], size: [0.5, 1.2], alpha: 0.35 });
      } },
    null, null,
    { id: 'flask', name: 'Ember Flask', icon: 'flask', limited: 4, cast: 1.0, moveCast: (p) => !p.dash && !p.kb, desc: 'Drink on the move (1 s) to heal 30%. Four per fight, shared with Kindle.',
      fire(p) { p.heal(300); } },
  ],
  onParry() { },
  onDodge(p) {
    if (p.dodged) return; p.dodged = true; p.opening = 5; p.addBuff('opening', 5, 'heavy'); p.res = Math.min(p.resMax, Math.max(p.res, 0) + AW.ROLL); p.winded = false;
    Sound.sfx('parry', 0.7, 1.3); FX.num(p.aim(), 'DODGED', 'note'); FX.ring(p.pos.x, p.pos.z, { r0: 0.6, r1: 3.2, color: 0xffd9a0, dur: 0.3, y: p.pos.y + 0.08 }); FX.flash(0xffc080, 0.1, 6);
  },
  update(p, dt) {
    if (!p.dash) p.res = Math.min(p.resMax, p.res + AW.REGEN * (p.hasBuff('kindle') ? 1.5 : 1) * dt);
    if (p.winded && p.res >= AW.WIND) p.winded = false;
    if (p.opening > 0) p.opening -= dt;
    p.dmgMul = p.hasBuff('kindle') ? 1.4 : 1;
    if (!G.headless && p.hasBuff('kindle') && vrand() < dt * 30) { const h = p.hand(_h2); FX.burst(lerp(p.pos.x, h.x, vrand()), lerp(p.pos.y + 1, h.y, vrand()), lerp(p.pos.z, h.z, vrand()), { n: 1, color: 0xffb040, color2: 0xff4a10, speed: [0.3, 1.5], up: 2, life: [0.3, 0.7], size: [0.12, 0.3] }); }
  },
  bot(p, c) {
    const t = p.target; if (!t) return; const d = t.distTo(p.pos.x, p.pos.z), cs = t.castState, flasks = p.sk[6].uses, b = G.boss;
    if (c.danger && !c.zone && !p.dash && p.block(3) === '') return p.press(3); // rolling does nothing against ground that keeps burning
    if (c.wantInterrupt && cs && cs.int && cs.time - cs.t > 0.7 && d <= MELEE + AW.REACH && !p.winded) { if (!p.casting) p.press(1); return; } // queues behind a swing in progress
    if (c.hp < 0.45 && c.calm > 1.4 && !p.casting && p.block(6) === '') return p.press(6);
    if (c.holdFire) { if (p.casting && p.sk[p.casting.i].def.id === 'heavy' && p.block(3) === '') p.press(3); return; } // a blow already winding up has to be rolled out of
    if (p.casting) return;
    if (flasks > 0 && c.hp > 0.6 && t.isBoss && !t.immune && d <= MELEE && b.hp / b.maxHp < 0.24 * flasks - 0.12 && p.block(2) === '') p.press(2);
    if (d > MELEE + AW.REACH) return;
    if (d > MELEE - 0.6) { // leap only onto ground that stays safe
      const cd = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) || 1, k = (t.radius + 1.6) / cd, lx = t.pos.x + (p.pos.x - t.pos.x) * k, lz = t.pos.z + (p.pos.z - t.pos.z) * k;
      if (c.threat(lx, lz) < 2 || c.threat((lx + p.pos.x) / 2, (lz + p.pos.z) / 2) < 1 || !G.arena.contains(lx, lz)) { if (d <= MELEE && p.res > 8) p.press(0); return; }
    }
    if ((p.opening > 0 || (p.res >= 42 && !(cs && cs.int))) && p.block(1) === '') return p.press(1);
    if (p.res > 8) p.press(0);
  },
});

// ============================== HEXSLINGER ==============================
// No cooldowns, no resource, nothing to build: a six-chamber cylinder that you fill one round at a time, in the order you
// want to fire it. Everything the class can do (damage, the interrupt, the heal) is a round that has to be in the cylinder
// first. Fully mobile. p.cyl is the queue, front first: 'L' lead, 'S' silver, 'V' salve.
const HX = { RANGE: 34, NEAR: 6, FAR: 24, LEAD: [94, 66], SILVER: 55, SALVE: 185 };
const hxLoad = (r) => (p) => {
  p.cyl.push(r); p.loadT = 0.3; if (p.cyl.length >= 6) { p.armed = true; p.streak = 0; } else if (p.streak > 0) p.armed = false;
  Sound.sfx('tick', 0.8, r === 'L' ? 1.1 : r === 'S' ? 1.5 : 0.8); if (!G.headless) { const h = p.hand(_h2); FX.burst(h.x, h.y, h.z, { n: 4, color: HX_COL[r], speed: [0.5, 2], life: [0.15, 0.35], size: [0.08, 0.2] }); }
};
const HX_COL = { L: 0xffe2a8, S: 0xd9b0ff, V: 0x70ffa8 };
const hxRoom = (p) => p.cyl.length < 6 || 'Cylinder full';
G.classes.push({
  id: 'hexslinger', name: 'HEXSLINGER', role: 'Ranged, always moving. Six chambers, loaded by hand, fired in order.', color: '#ff7ad9', hp: 1000, gcd: 0.6,
  gcdOf: (p, s) => s.id === 'fire' ? 0.6 : s.id === 'spin' ? 0.2 : 0.32,
  resource: { name: 'Cylinder', max: 6, kind: 'cylinder' },
  look: { armor: 0x2e2630, cloth: 0x3a1230, glow: 0xff5fd0, hat: true, weapon: 'gun' },
  init(p) { p.cyl = ['L', 'L', 'L', 'L', 'L', 'L']; p.streak = 0; p.armed = true; },
  skills: [
    { id: 'fire', name: 'Fire', icon: 'shot', desc: 'Fire the next chamber. Lead hits harder up close. Empty a full cylinder without reloading and the sixth shot hits double.',
      view: (p) => p.cyl[0] === 'S' ? 'silver' : p.cyl[0] === 'V' ? 'salve' : 'shot',
      rdy: (p) => p.cyl[0] === 'S' && p.target && p.target.castState && p.target.castState.int,
      usable(p, t) { const r = p.cyl[0]; if (!r) return 'Empty'; if (r === 'V') return true; if (!t || !t.alive || !t.targetable) return 'target'; return t.distTo(p.pos.x, p.pos.z) <= HX.RANGE || 'range'; },
      fire(p, t) {
        const r = p.cyl.shift(); p.streak++; const last = p.armed && p.streak >= 6; if (last) p.armed = false; p.aimT = 0.75; p.model.swing(4, 0.2);
        if (r === 'V') { Sound.sfx('zap', 0.4, 1.8); p.heal(HX.SALVE); return; }
        p.attackFaceT = 0.5; Sound.sfx('boom', last ? 0.9 : 0.55, r === 'S' ? 2.3 : last ? 1.2 : 1.7); if (!t || !t.alive) return;
        const a = p.hand(_h2); t.aim(_hp); _hp.x += (vrand() - 0.5) * t.radius * 0.5; _hp.y += (vrand() - 0.5) * 0.9; const col = HX_COL[r];
        FX.beam(a, _hp, { color: col, width: last ? 0.2 : 0.09, dur: last ? 0.28 : 0.14 }); FX.light(a.x, a.y, a.z, col, last ? 40 : 18, 0.12, 12);
        FX.burst(a.x, a.y, a.z, { n: 6, color: col, dir: [Math.sin(p.facing), 0.05, Math.cos(p.facing)], spread: 0.35, speed: [4, 12], life: [0.08, 0.22], size: [0.1, 0.3] });
        const mul = last ? 2 : 1;
        if (r === 'L') { const d = t.distTo(p.pos.x, p.pos.z); t.damage(lerp(HX.LEAD[0], HX.LEAD[1], sat((d - HX.NEAR) / (HX.FAR - HX.NEAR))) * mul, { src: 'player', crit: last }); FX.burst(_hp.x, _hp.y, _hp.z, { n: last ? 22 : 7, color: col, speed: [2, last ? 14 : 8], life: [0.15, 0.45], size: [0.1, 0.32] }); }
        else { t.damage(HX.SILVER * mul, { src: 'player', crit: last }); t.exposed = 6; FX.dome(_hp.x, _hp.y, _hp.z, { r: 1.6 + t.radius * 0.4, color: col, dur: 0.35 }); FX.ring(t.pos.x, t.pos.z, { r0: t.radius + 2.5, r1: t.radius + 0.3, color: col, dur: 0.4, y: t.pos.y + 0.1 }); t.interrupt(); }
        if (last) { FX.shake(0.3); FX.impact(_hp.x, _hp.y, _hp.z, 0xffffff, 1.2); FX.num(_hp, 'LAST WORD', 'note'); }
      } },
    { id: 'lead', name: 'Load Lead', icon: 'lead', desc: 'Chamber a lead round: plain damage. Hold to keep loading.', usable: hxRoom, fire: hxLoad('L') },
    { id: 'silver', name: 'Load Silver', icon: 'silver', desc: 'Chamber a silver round: weak, but it stops a cast and leaves the target Exposed.', usable: hxRoom, fire: hxLoad('S'),
      rdy: (p) => p.cyl.length < 6 && p.cyl.indexOf('S') < 0 && p.target && p.target.castState && p.target.castState.int },
    { id: 'spin', name: 'Spin', icon: 'spin', desc: 'Send the next round to the back, unfired.',
      usable: (p) => p.cyl.length > 1 || 'no',
      fire(p) { p.cyl.push(p.cyl.shift()); p.loadT = 0.18; Sound.sfx('tick', 0.6, 2); } },
    null, null,
    { id: 'salve', name: 'Load Salve', icon: 'salve', limited: 6, desc: 'Chamber a salve round: on its turn it heals you instead of firing. Six per fight.', usable: hxRoom, fire: hxLoad('V') },
  ],
  onParry() { },
  bot(p, c) {
    const t = p.target; if (!t) return; const q = p.cyl, iS = q.indexOf('S'), iV = q.indexOf('V'), fire = () => { if (q[0] === 'V' || !c.holdFire) p.press(0); };
    if (c.wantInterrupt) { if (iS === 0) return p.press(0); if (iS > 0) return p.press(3); if (q.length < 6) return p.press(2); return fire(); }
    if (c.hp < 0.5 && (iV >= 0 || p.sk[6].uses > 0)) { if (iV === 0) return p.press(0); if (iV > 0) return p.press(3); if (q.length < 6) return p.press(6); return fire(); }
    if (!q.length) p.botLoad = true;
    if (p.botLoad) { if (q.length >= 6) p.botLoad = false; else return p.press(iS < 0 && t.exposed < 2 && !q.length ? 2 : 1); }
    if (q[0] === 'V' && c.hp > 0.8) { if (q.length > 1 && q.some((r) => r !== 'V')) return p.press(3); p.botLoad = true; return; }
    if (c.holdFire) { if (q.length < 6 && !p.armed) p.press(1); return; }
    fire();
  },
});
