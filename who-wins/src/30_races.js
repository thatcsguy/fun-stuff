// ===================== C. Races =====================
function ordinal(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }

// ---------- 16. Marble Run ----------
const MR = { x0: 40, x1: 500, top: 60 };
const MODS = {
  zig(rng, y) { const S = []; let L = rng() < 0.5; for (let k = 0; k < 3; k++) { const yy = y + 40 + k * 125; if (L) S.push([MR.x0, yy, 440, yy + 70]); else S.push([MR.x1, yy, 100, yy + 70]); L = !L; } return { h: 420, S }; },
  pegs(rng, y) { const P = []; const off = rng.range(0, 26); for (let r = 0; r < 6; r++) for (let x = MR.x0 + 30 + (r % 2 ? 26 : 0) + off; x < MR.x1 - 15; x += 52) P.push([x, y + 40 + r * 46, 6]); return { h: 330, P }; },
  funnel(rng, y) { const g = 26, cx = rng.range(200, 340); return { h: 230, S: [[MR.x0, y + 20, cx - g, y + 170], [MR.x1, y + 20, cx + g, y + 170]] }; },
  spin(rng, y) { return { h: 300, SP: [[170, y + 140, 70, rng.sign() * rng.range(1.6, 2.6), rng.ang()], [370, y + 140, 70, rng.sign() * rng.range(1.6, 2.6), rng.ang()]], P: [[270, y + 60, 8], [270, y + 230, 8]] }; },
  split(rng, y) { const P = [], S = [[270, y + 30, 270, y + 290]]; for (let r = 0; r < 5; r++) for (let x = MR.x0 + 28 + (r % 2 ? 22 : 0); x < 250; x += 44) P.push([x, y + 60 + r * 48, 5]); const B = [[300, y + 90, 380, y + 120], [480, y + 170, 400, y + 200], [300, y + 250, 370, y + 270]]; return { h: 320, S, P, B }; },
  paddle(rng, y) { return { h: 300, PD: [[y + 90, 160, rng.range(1.2, 2), rng.ang()], [y + 210, 160, rng.range(1.2, 2), rng.ang()]] }; },
  pads(rng, y) { const B = []; for (let k = 0; k < 4; k++) { const yy = y + 50 + k * 70, x = rng.range(80, 400); B.push(k % 2 ? [x, yy, x + 80, yy + 30] : [x + 80, yy, x, yy + 30]); } return { h: 330, B }; }
};
SIMS.push({
  id: 'marbles', name: 'Marble Run', caption: 'First marble to the bottom', theme: 'paper', thumbSteps: 90,
  init(rng) {
    const st = K.base(rng, 8, { mods: [], cam: 0, fin: [] });
    const lib = ['zig', 'pegs', 'funnel', 'spin', 'split', 'paddle', 'pads'];
    const order = rng.shuffle(lib.slice()).concat(rng.shuffle(lib.slice())).slice(0, 10);
    let y = 120; order.push('funnel');
    for (const m of order) { const o = MODS[m](rng, y); o.y = y; o.kind = m; o.S = o.S || []; o.P = o.P || []; o.B = o.B || []; o.SP = o.SP || []; o.PD = o.PD || []; st.mods.push(o); y += o.h; }
    st.end = y + 40;
    st.balls = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).map((ci, k) => { const b = K.ball(80 + k * 54 + rng.range(-6, 6), MR.top + rng.range(-8, 8), 9, Math.PI / 2, 10, ci); b.best = b.y; b.bt = 0; b.done = 0; return b; }).sort((a, b) => a.ci - b.ci);
    return st;
  },
  where: st => st.balls.map(b => ({ i: b.ci, x: b.x, y: b.y - st.cam, r: b.r })),
  modAt(st, y) { for (let i = 0; i < st.mods.length; i++) if (y < st.mods[i].y + st.mods[i].h) return i; return st.mods.length - 1; },
  step(st, dt) {
    const B = st.balls.filter(b => !b.done), h = dt / 2, t = st.t;
    for (let sub = 0; sub < 2; sub++) {
      for (const b of B) { b.vy += 1100 * h; const s = Math.hypot(b.vx, b.vy); if (s > 750) K.speed(b, 750); K.move(b, h); }
      K.pairs(B, (a, b) => { const i = K.collide(a, b, 0.6); if (i > 80) AU.tone(900, 0.03, Math.min(0.12, i / 2000), 'triangle', 0, 'clack'); });
      for (const b of B) {
        K.box(b, MR.x0, -1e4, MR.x1, 1e6, 0.4);
        const mi = this.modAt(st, b.y);
        for (let j = Math.max(0, mi - 1); j <= Math.min(st.mods.length - 1, mi + 1); j++) {
          const m = st.mods[j];
          for (const s of m.S) K.seg(b, s[0], s[1], s[2], s[3], 0.35, 3);
          for (const p of m.P) if (K.ringOut(b, p[0], p[1], p[2], 0.5)) AU.tone(1200, 0.025, 0.05, 'triangle', 0, 'peg');
          for (const s of m.B) if (K.seg(b, s[0], s[1], s[2], s[3], 1.15, 3) > 50) AU.tone(400, 0.08, 0.1, 'sine', 1.8, 'pad');
          for (const p of m.SP) { const a = p[4] + p[3] * t; for (let k = 0; k < 2; k++) { const c = Math.cos(a + k * Math.PI / 2) * p[2], s = Math.sin(a + k * Math.PI / 2) * p[2]; const vx = -p[3] * (b.y - p[1]), vy = p[3] * (b.x - p[0]); K.seg(b, p[0] - c, p[1] - s, p[0] + c, p[1] + s, 0.5, 4, vx, vy); } }
          for (const p of m.PD) { const cx = 270 + Math.sin(t * p[2] + p[3]) * 140, vx = Math.cos(t * p[2] + p[3]) * 140 * p[2]; K.seg(b, cx - p[1] / 2, p[0], cx + p[1] / 2, p[0], 0.5, 4, vx, 0); }
        }
      }
    }
    for (const b of B) {
      if (b.y > b.best + 2) { b.best = b.y; b.bt = 0; } else if ((b.bt += dt) > 4) { b.bt = 0; b.vx = st.rng.range(-250, 250); b.vy = -st.rng.range(150, 300); }
      if (b.y > st.end) { b.done = st.fin.length + 1; st.fin.push(b.ci); if (st.win == null) { st.win = b.ci; FX.burst(b.x, b.y - st.cam, st.C[b.ci].c, 40, 300); } AU.blip(14 - st.fin.length, 0.2); }
    }
    const lead = Math.max(...st.balls.filter(b => !b.done).map(b => b.y), st.end - 300);
    const tc = K.clamp(lead - 420, 0, st.end - 700); st.cam += (tc - st.cam) * Math.min(1, 4 * dt);
  },
  draw(st, ctx) {
    const cam = st.cam, Y = y => y - cam + 0, vis = y => y - cam > -60 && y - cam < H + 60, t = st.t;
    ctx.fillStyle = '#efe4cf'; ctx.fillRect(MR.x0, 0, MR.x1 - MR.x0, H);
    ctx.lineCap = 'round';
    for (const m of st.mods) {
      if (m.y - cam > H || m.y + m.h - cam < 0) continue;
      for (const s of m.S) { D.line(ctx, s[0], Y(s[1]), s[2], Y(s[3]), '#7a4f26', 8); D.line(ctx, s[0], Y(s[1]) - 2, s[2], Y(s[3]) - 2, '#b07a44', 3); }
      for (const s of m.B) D.line(ctx, s[0], Y(s[1]), s[2], Y(s[3]), '#30a46c', 7);
      for (const p of m.P) D.circle(ctx, p[0], Y(p[1]), p[2], null, 0, '#5a3a1c');
      for (const p of m.SP) { const a = p[4] + p[3] * t; for (let k = 0; k < 2; k++) { const c = Math.cos(a + k * Math.PI / 2) * p[2], s = Math.sin(a + k * Math.PI / 2) * p[2]; D.line(ctx, p[0] - c, Y(p[1] - s), p[0] + c, Y(p[1] + s), '#c2410c', 8); } D.circle(ctx, p[0], Y(p[1]), 7, null, 0, '#7a2a08'); }
      for (const p of m.PD) { const cx = 270 + Math.sin(t * p[2] + p[3]) * 140; D.line(ctx, cx - p[1] / 2, Y(p[0]), cx + p[1] / 2, Y(p[0]), '#3e63dd', 8); }
    }
    ctx.lineCap = 'butt';
    if (vis(st.end)) { for (let x = MR.x0; x < MR.x1; x += 20) { ctx.fillStyle = ((x / 20) | 0) % 2 ? '#222' : '#fff'; ctx.fillRect(x, Y(st.end), 20, 10); } }
    ctx.fillStyle = '#7a4f26'; ctx.fillRect(MR.x0 - 8, 0, 8, H); ctx.fillRect(MR.x1, 0, 8, H);
    for (const b of st.balls) if (!b.done) { D.ball(ctx, b.x, Y(b.y), b.r, st.C[b.ci].c, false); D.text(ctx, String(b.ci + 1), b.x, Y(b.y) + 1, 10, '#fff', 'center', 900); }
    // minimap
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(520, 150, 10, 780);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(518, 150 + 780 * cam / st.end, 14, 780 * H / st.end);
    for (const b of st.balls) { ctx.fillStyle = st.C[b.ci].c; ctx.fillRect(518, 150 + 780 * Math.min(1, b.y / st.end) - 2, 14, 4); }
    // finish tray
    st.fin.forEach((ci, k) => { D.ball(ctx, 60 + k * 30, H - 40, 10, st.C[ci].c, false); });
  },
  hud(st) { const live = st.balls.filter(b => !b.done).sort((a, b) => b.y - a.y); return st.balls.map(b => ordinal(b.done || st.fin.length + live.indexOf(b) + 1)); },
  lead: st => st.balls.slice().sort((a, b) => b.y - a.y)[0].ci
});

// ---------- 17. Brick Drillers ----------
const BD = { lanes: 5, lw: 100, x0: 20, rows: 12, top: 250, bh: 36, by: 190 };
SIMS.push({
  id: 'drill', name: 'Brick Drillers', caption: 'First ball out the bottom', theme: 'night',
  init(rng) {
    const st = K.base(rng, BD.lanes);
    const hp = Array.from({ length: BD.rows * 3 }, () => rng.int(1, 5)), bonus = new Array(BD.rows * 3).fill(0); bonus[0] = bonus[1] = 1; bonus[2] = bonus[3] = 2;
    st.lanes = []; st.balls = [];
    for (let L = 0; L < BD.lanes; L++) {
      const h = rng.shuffle(hp.slice()), bo = rng.shuffle(bonus.slice()), bricks = [];
      for (let i = 0; i < h.length; i++) { const r = Math.floor(i / 3), c = i % 3; bricks.push({ x: BD.x0 + L * BD.lw + 3 + c * 31.3, y: BD.top + r * BD.bh, w: 29.5, h: BD.bh - 3, hp: h[i], max: h[i], bo: bo[i], fl: 0 }); }
      st.lanes.push({ bricks, x2: 0 });
      st.balls.push(this.mk(rng, L, BD.x0 + L * BD.lw + BD.lw / 2 + rng.range(-20, 20), BD.by));
    }
    return st;
  },
  mk(rng, L, x, y) { const b = K.ball(x, y, 8, 0, 0, L); b.vx = rng.range(-120, 120); b.vy = 0; b.cd = 0; return b; },
  step(st, dt) {
    const rng = st.rng, late = st.t > 40;
    for (const b of st.balls) {
      if (b.dead) continue;
      const ln = st.lanes[b.ci], lx = BD.x0 + b.ci * BD.lw;
      b.vy += 1600 * dt; K.move(b, dt); b.cd -= dt;
      if (b.x - b.r < lx + 2) { b.x = lx + 2 + b.r; b.vx = Math.abs(b.vx); } if (b.x + b.r > lx + BD.lw - 2) { b.x = lx + BD.lw - 2 - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y - b.r < 140) { b.y = 140 + b.r; b.vy = Math.abs(b.vy); }
      for (const k of ln.bricks) {
        if (k.hp <= 0) continue;
        const cx = K.clamp(b.x, k.x, k.x + k.w), cy = K.clamp(b.y, k.y, k.y + k.h), dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
        if (d >= b.r) continue;
        let nx, ny; if (d > 1e-6) { nx = dx / d; ny = dy / d; } else { nx = 0; ny = -1; }
        b.x = cx + nx * b.r; b.y = cy + ny * b.r;
        const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
        if (ny < -0.5) b.vy = -Math.max(Math.abs(b.vy) * 0.8, 430);
        b.vx = K.clamp(b.vx + rng.range(-70, 70), -260, 260);
        if (b.cd > 0) break;
        b.cd = 0.05; const dmg = (ln.x2 > st.t ? 2 : 1) * (late ? 2 : 1);
        k.hp -= dmg; k.fl = 1; AU.blip(Math.max(0, k.hp) * 2 + b.ci, 0.08);
        if (k.hp <= 0) {
          FX.burst(k.x + k.w / 2, k.y + k.h / 2, st.C[b.ci].c, 10, 120, 0.5, 2.5, 400);
          if (k.bo === 1) { ln.x2 = st.t + 3; AU.coin(0.15); } else if (k.bo === 2) { st.balls.push(this.mk(rng, b.ci, b.x, b.y - 10)); AU.coin(0.15); }
        }
        break;
      }
      if (b.y > 950 && st.win == null) { st.win = b.ci; FX.burst(b.x, 930, st.C[b.ci].c, 40, 300); }
    }
    for (const ln of st.lanes) for (const k of ln.bricks) if (k.fl > 0) k.fl -= dt * 5;
  },
  draw(st, ctx) {
    for (let L = 0; L < BD.lanes; L++) {
      const lx = BD.x0 + L * BD.lw, col = st.C[L].c, ln = st.lanes[L];
      ctx.fillStyle = ln.x2 > st.t ? rgba(col, 0.12) : 'rgba(255,255,255,0.03)'; ctx.fillRect(lx + 2, 140, BD.lw - 4, 810);
      for (const k of ln.bricks) {
        if (k.hp <= 0) continue; const a = 0.35 + 0.65 * k.hp / 5;
        ctx.fillStyle = rgba(col, a); ctx.fillRect(k.x, k.y, k.w, k.h);
        if (k.fl > 0) { ctx.fillStyle = `rgba(255,255,255,${k.fl * 0.6})`; ctx.fillRect(k.x, k.y, k.w, k.h); }
        D.text(ctx, k.bo === 1 ? '×2' : k.bo === 2 ? '+●' : String(k.hp), k.x + k.w / 2, k.y + k.h / 2 + 1, k.bo ? 12 : 15, '#fff', 'center', 800);
      }
    }
    ctx.fillStyle = '#2c3342'; for (let L = 0; L <= BD.lanes; L++) ctx.fillRect(BD.x0 + L * BD.lw - 2, 140, 4, 810);
    for (const b of st.balls) if (!b.dead && b.y < 990) D.ball(ctx, b.x, b.y, b.r, st.C[b.ci].c, true);
  },
  hud: st => st.lanes.map(l => l.bricks.reduce((s, k) => s + Math.max(0, k.hp), 0)),
  lead: st => { const v = st.lanes.map(l => l.bricks.reduce((s, k) => s + Math.max(0, k.hp), 0)); return v.indexOf(Math.min(...v)); }
});

// ---------- 18. Raindrop Race ----------
SIMS.push({
  id: 'rain', name: 'Raindrop Race', caption: 'First drop to the bottom', theme: 'night', FIN: 935,
  init(rng) {
    const st = K.base(rng, 6, { gust: false });
    st.dots = []; for (let i = 0; i < 380; i++) st.dots.push({ x: rng.range(25, 515), y: rng.range(200, 930), r: rng.range(1.2, 3.4), on: true });
    st.lights = []; for (let i = 0; i < 14; i++) st.lights.push([rng.range(0, W), rng.range(300, H), rng.range(40, 120), rng.pick(['#ffb347', '#ff6b6b', '#7ec8ff', '#ffe08a', '#c58bff'])]);
    const lane = rng.shuffle([0, 1, 2, 3, 4, 5]);
    st.balls = [0, 1, 2, 3, 4, 5].map(i => { const b = K.ball(60 + lane[i] * 84 + rng.range(-12, 12), 170, 7.5, 0, 0, i); b.ph = [rng.ang(), rng.ang()]; b.w = [rng.range(0.4, 0.9), rng.range(1.1, 1.9)]; b.stall = 0; b.sx = 0; return b; });
    return st;
  },
  step(st, dt) {
    const rng = st.rng;
    if (!st.gust && st.t > 30) { st.gust = true; for (const b of st.balls) b.stall = 0; AU.whoosh(0.3); }
    for (const b of st.balls) {
      const g = st.gust && st.t < 33 ? 1.8 : 1;
      if (b.stall > 0) { b.stall -= dt * g * g; b.vy = 0; }
      else {
        b.vy = 20 * Math.pow(b.r / 7.5, 1.6) * g;
        if (rng() < dt * 0.45 / Math.pow(b.r / 7.5, 1.2) && !(st.gust && st.t < 33)) b.stall = rng.range(0.4, 2.4);
      }
      b.vx = (Math.sin(st.t * b.w[0] + b.ph[0]) * 14 + Math.sin(st.t * b.w[1] + b.ph[1]) * 8) * (b.stall > 0 ? 0.1 : 1) + b.sx + (st.gust && st.t < 33 ? 30 : 0);
      b.sx *= Math.exp(-3 * dt);
      K.move(b, dt); b.x = K.clamp(b.x, 22, 518);
      for (const d of st.dots) if (d.on && Math.abs(d.y - b.y) < b.r + 4 && Math.abs(d.x - b.x) < b.r + 4 && Math.hypot(d.x - b.x, d.y - b.y) < b.r + d.r) { d.on = false; b.r = Math.min(16, Math.sqrt(b.r * b.r + d.r * d.r * 0.8)); AU.blip(18 - b.r, 0.05); if (b.stall > 0 && rng() < 0.5) b.stall = 0; }
      if (b.y >= this.FIN && st.win == null) { st.win = b.ci; FX.burst(b.x, b.y, st.C[b.ci].c, 30, 200); }
    }
    K.pairs(st.balls, (a, b) => { const dx = b.x - a.x, d = Math.hypot(dx, b.y - a.y); if (d < a.r + b.r + 2) { const s = dx >= 0 ? 1 : -1; a.sx -= 30 * s; b.sx += 30 * s; } });
  },
  draw(st, ctx) {
    for (const l of st.lights) D.glow(ctx, l[0], l[1], l[2], l[3], 0.35);
    ctx.fillStyle = 'rgba(170,200,230,0.06)'; ctx.fillRect(18, 150, 504, 790);
    const L = D.layer(st, 'wet'), g = L.getContext('2d');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.012)'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    for (const b of st.balls) { g.fillStyle = rgba(st.C[b.ci].c, 0.08); g.beginPath(); g.arc(b.x, b.y, b.r * 0.7, 0, TAU); g.fill(); }
    ctx.drawImage(L, 0, 0);
    ctx.fillStyle = 'rgba(220,235,255,0.35)'; for (const d of st.dots) if (d.on) { ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (const d of st.dots) if (d.on && d.r > 2.4) ctx.fillRect(d.x - d.r * 0.4, d.y - d.r * 0.5, 1.2, 1.2);
    for (const b of st.balls) {
      const c = st.C[b.ci].c; D.glow(ctx, b.x, b.y, b.r * 3, c, 0.5);
      ctx.fillStyle = rgba(c, 0.75); ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * 0.92, b.r * 1.08, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.28, b.r * 0.18, -0.6, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(18, this.FIN + 3, 504, 2);
    if (st.gust && st.t < 33) D.text(ctx, 'GUST!', W / 2, 180, 26, '#cfe6ff', 'center', 900);
  },
  hud(st) { return st.balls.map(b => Math.round(K.clamp((b.y - 170) / (this.FIN - 170), 0, 1) * 100) + '%'); },
  lead: st => st.balls.slice().sort((a, b) => b.y - a.y)[0].ci
});

// ---------- 19. Fuse Race ----------
SIMS.push({
  id: 'fuse', name: 'Fuse Race', caption: 'First firework to launch', theme: 'night', L: 1350,
  init(rng) {
    const st = K.base(rng, 5, { xs: [] }), N = 5, xs = Array.from({ length: N }, (_, i) => 70 + i * 100), xe = rng.shuffle(xs.slice());
    st.f = [];
    for (let i = 0; i < N; i++) {
      const ph = [rng.ang(), rng.ang(), rng.ang()], kk = [rng.range(1, 2.5), rng.range(2.5, 4.5), rng.range(4.5, 7)], wt = [1, rng.range(0.3, 0.7), rng.range(0.1, 0.3)];
      const lu = rng.range(0.25, 0.75), lr = rng.range(18, 28), ld = rng.sign();
      const build = amp => {
        const pts = [];
        for (let k = 0; k <= 160; k++) {
          const u = k / 160; let x = xs[i] + (xe[i] - xs[i]) * u, y = 915 - 705 * u;
          for (let j = 0; j < 3; j++) x += Math.sin(kk[j] * Math.PI * u + ph[j]) * amp * wt[j] * Math.sin(Math.PI * u);
          pts.push([K.clamp(x, 30, 510), y]);
          if (Math.abs(u - lu) < 0.5 / 160) for (let a = 1; a <= 24; a++) { const t = a / 24 * TAU; pts.push([K.clamp(x + ld * (lr - Math.cos(t) * lr), 30, 510), y - Math.sin(t) * lr]); }
        }
        return pts;
      };
      const len = p => { let s = 0; for (let k = 1; k < p.length; k++) s += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); return s; };
      let lo = 0, hi = 400, pts = build(0);
      for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (len(build(m)) < this.L) lo = m; else hi = m; }
      pts = build((lo + hi) / 2);
      const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      const sp = rng.shuffle([].concat(new Array(8).fill(1.5), new Array(6).fill(0.55), new Array(12).fill(1)));
      const br = []; for (let k = 0; k < 3; k++) { const j = rng.int(10, pts.length - 10), a = rng.ang(); br.push([pts[j][0], pts[j][1], pts[j][0] + Math.cos(a) * 26, pts[j][1] + Math.sin(a) * 26]); }
      st.f.push({ pts, cum, total: cum[cum.length - 1], sp, s: 0, max: 0, done: false, br, fw: 0 });
    }
    st.X = [];
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
      const A = st.f[a], B = st.f[b];
      for (let i = 1; i < A.pts.length; i++) for (let j = 1; j < B.pts.length; j++) {
        const p = A.pts[i - 1], q = A.pts[i], r = B.pts[j - 1], s = B.pts[j];
        if (Math.max(p[0], q[0]) < Math.min(r[0], s[0]) || Math.max(r[0], s[0]) < Math.min(p[0], q[0]) || Math.max(p[1], q[1]) < Math.min(r[1], s[1]) || Math.max(r[1], s[1]) < Math.min(p[1], q[1])) continue;
        const x = K.segX(p[0], p[1], q[0], q[1], r[0], r[1], s[0], s[1]);
        if (x) st.X.push({ a, b, sa: A.cum[i - 1] + (A.cum[i] - A.cum[i - 1]) * x[0], sb: B.cum[j - 1] + (B.cum[j] - B.cum[j - 1]) * x[1], x: p[0] + (q[0] - p[0]) * x[0], y: p[1] + (q[1] - p[1]) * x[0], used: false, jump: rng() < 0.5 });
      }
    }
    return st;
  },
  pos(f, s) { let k = 1; while (k < f.cum.length - 1 && f.cum[k] < s) k++; const a = f.pts[k - 1], b = f.pts[k], t = (s - f.cum[k - 1]) / Math.max(1e-6, f.cum[k] - f.cum[k - 1]); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; },
  where(st) { return st.f.map((f, i) => { const p = f.pts[0]; return { i, x: p[0], y: p[1], r: 14 }; }); },
  step(st, dt) {
    st.f.forEach((f, i) => {
      if (f.done) { f.fw += dt; return; }
      const chunk = Math.min(25, Math.floor(f.s / (f.total / 26))), v = 56 * f.sp[chunk], s0 = f.s;
      f.s += v * dt; f.max = Math.max(f.max, f.s);
      for (const x of st.X) {
        if (x.used) continue;
        const [me, other, sm, so] = x.a === i ? [x.a, x.b, x.sa, x.sb] : x.b === i ? [x.b, x.a, x.sb, x.sa] : [-1];
        if (me < 0 || !(s0 < sm && f.s >= sm)) continue;
        x.used = true; const o = st.f[other];
        if (x.jump && !o.done && o.s < so) { o.s = so; o.max = Math.max(o.max, so); FX.burst(x.x, x.y, '#ffd27a', 24, 220, 0.5, 2.5); AU.zap(0.15); }
      }
      if (Math.random() < 0.5) { const [x, y] = this.pos(f, f.s); FX.burst(x, y, Math.random() < 0.5 ? '#ffcf6a' : st.C[i].l, 1, 70, 0.35, 1.8, 120); }
      AU.noise(0.05, 4000, 0.03, 'highpass', 1, 'hiss');
      if (f.s >= f.total) { f.done = true; f.s = f.total; const e = f.pts[f.pts.length - 1]; FX.burst(e[0], e[1] - 30, st.C[i].c, 50, 330, 1, 3.5, 60); FX.burst(e[0], e[1] - 30, '#fff', 20, 200, 0.8, 2); AU.boom(0.3); if (st.win == null) st.win = i; }
    });
  },
  draw(st, ctx) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    st.f.forEach((f, i) => {
      for (const b of f.br) D.line(ctx, b[0], b[1], b[2], b[3], '#4a3a28', 3);
      const seg = f.total / 26;
      for (let c = 0; c < 26; c++) {
        ctx.strokeStyle = f.sp[c] < 1 ? '#3b3226' : f.sp[c] > 1 ? '#b5925a' : '#86704e'; ctx.lineWidth = 3.5; ctx.beginPath();
        let first = true; for (let k = 0; k < f.pts.length; k++) { if (f.cum[k] < c * seg - 3 || f.cum[k] > (c + 1) * seg + 3) continue; first ? ctx.moveTo(f.pts[k][0], f.pts[k][1]) : ctx.lineTo(f.pts[k][0], f.pts[k][1]); first = false; }
        ctx.stroke();
      }
      ctx.strokeStyle = '#5c5c5c'; ctx.lineWidth = 2.5; ctx.beginPath(); let first = true;
      for (let k = 0; k < f.pts.length && f.cum[k] <= f.max; k++) { first ? ctx.moveTo(f.pts[k][0], f.pts[k][1]) : ctx.lineTo(f.pts[k][0], f.pts[k][1]); first = false; }
      ctx.stroke();
      const e = f.pts[f.pts.length - 1], up = f.done ? Math.min(1, f.fw * 2) * 120 : 0, col = st.C[i].c;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(e[0], e[1] - 34 - up); ctx.lineTo(e[0] - 8, e[1] - 18 - up); ctx.lineTo(e[0] - 8, e[1] - up); ctx.lineTo(e[0] + 8, e[1] - up); ctx.lineTo(e[0] + 8, e[1] - 18 - up); ctx.closePath(); ctx.fill();
      if (!f.done) { const [x, y] = this.pos(f, f.s); D.glow(ctx, x, y, 26, '#ffb347'); D.circle(ctx, x, y, 3.5, null, 0, '#fff7d6'); }
      D.circle(ctx, f.pts[0][0], f.pts[0][1] + 10, 8, null, 0, col);
    });
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    for (const x of st.X) if (!x.used) D.circle(ctx, x.x, x.y, 3, 'rgba(255,220,150,0.35)', 1);
  },
  hud: st => st.f.map(f => Math.round(f.s / f.total * 100) + '%'),
  lead: st => st.f.map((f, i) => [f.s / f.total, i]).sort((a, b) => b[0] - a[0])[0][1]
});

// ---------- 20. Chaos Pendulums ----------
SIMS.push({
  id: 'pend', name: 'Chaos Pendulums', caption: 'First to 20 flips', theme: 'night', PX: 270, PY: 500, LEN: 112, GOAL: 20,
  init(rng) {
    const st = K.base(rng, 4), a1 = rng.range(2.1, 2.9) * rng.sign(), a2 = a1 + rng.range(-0.3, 0.6);
    st.p = [0, 1, 2, 3].map(i => ({ a1, a2: a2 + rng.range(-1, 1) * 1.5e-3, w1: 0, w2: 0, fl: 0, k: 0, tr: [] }));
    st.p.forEach(p => { p.k = Math.floor((p.a2 - Math.PI) / TAU); });
    return st;
  },
  acc(a1, a2, w1, w2) {
    const g = 9.81, d = a1 - a2, den = 3 - Math.cos(2 * d);
    return [(-3 * g * Math.sin(a1) - g * Math.sin(a1 - 2 * a2) - 2 * Math.sin(d) * (w2 * w2 + w1 * w1 * Math.cos(d))) / den,
      (2 * Math.sin(d) * (2 * w1 * w1 + 2 * g * Math.cos(a1) + w2 * w2 * Math.cos(d))) / den];
  },
  step(st, dt) {
    const h = dt * 1.3;
    st.p.forEach((p, i) => {
      const f = (a1, a2, w1, w2) => { const [x, y] = this.acc(a1, a2, w1, w2); return [w1, w2, x, y]; };
      const k1 = f(p.a1, p.a2, p.w1, p.w2), k2 = f(p.a1 + k1[0] * h / 2, p.a2 + k1[1] * h / 2, p.w1 + k1[2] * h / 2, p.w2 + k1[3] * h / 2);
      const k3 = f(p.a1 + k2[0] * h / 2, p.a2 + k2[1] * h / 2, p.w1 + k2[2] * h / 2, p.w2 + k2[3] * h / 2), k4 = f(p.a1 + k3[0] * h, p.a2 + k3[1] * h, p.w1 + k3[2] * h, p.w2 + k3[3] * h);
      p.a1 += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); p.a2 += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      p.w1 += h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]); p.w2 += h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
      const k = Math.floor((p.a2 - Math.PI) / TAU);
      if (k !== p.k) { p.k = k; p.fl++; AU.tone(AU.hz([10, 12, 14, 17][i] + Math.floor(p.fl / 5)), 0.3, 0.12, 'sine', 0, 'pf' + i); const [, , x, y] = this.pts(p); FX.burst(x, y, st.C[i].c, 8, 120); if (p.fl >= this.GOAL && st.win == null) st.win = i; }
      const [, , x, y] = this.pts(p); p.tr.push(x, y); if (p.tr.length > 440) p.tr.splice(0, 2);
    });
  },
  pts(p) { const L = this.LEN, x1 = this.PX + Math.sin(p.a1) * L, y1 = this.PY + Math.cos(p.a1) * L; return [x1, y1, x1 + Math.sin(p.a2) * L, y1 + Math.cos(p.a2) * L]; },
  where(st) { return st.p.map((p, i) => { const q = this.pts(p); return { i, x: q[2], y: q[3], r: 12 }; }); },
  draw(st, ctx) {
    ctx.lineCap = 'round';
    st.p.forEach((p, i) => {
      const t = p.tr, c = st.C[i].c;
      for (let k = 2; k < t.length; k += 2) { ctx.globalAlpha = (k / t.length) * 0.8; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(t[k - 2], t[k - 1]); ctx.lineTo(t[k], t[k + 1]); ctx.stroke(); }
    });
    ctx.globalAlpha = 1;
    st.p.forEach((p, i) => {
      const [x1, y1, x2, y2] = this.pts(p), c = st.C[i].c;
      D.line(ctx, this.PX, this.PY, x1, y1, rgba(c, 0.7), 3); D.line(ctx, x1, y1, x2, y2, rgba(c, 0.7), 3);
      D.circle(ctx, x1, y1, 5, null, 0, c); D.ball(ctx, x2, y2, 10, c, true);
    });
    ctx.lineCap = 'butt'; D.circle(ctx, this.PX, this.PY, 6, null, 0, '#ccc');
  },
  hud: st => st.p.map(p => p.fl)
});
