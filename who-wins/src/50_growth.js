// ===================== E. Growth, gravity, stacking, chain reactions =====================

// ---------- 26. Multiply Escape ----------
SIMS.push({
  id: 'multiply', name: 'Multiply Escape', caption: 'Escape and split in two. First to 100', theme: 'night', GOAL: 100,
  init(rng) {
    const st = K.base(rng, 4, { ph: rng.ang(), w: rng.sign() * 0.7, half: 0.34, cnt: [1, 1, 1, 1], R: 235 });
    st.balls = [0, 1, 2, 3].map(i => K.ball(AX + (i - 1.5) * 20, AY, 6, rng.ang(), 260, i));
    return st;
  },
  step(st, dt) {
    const rng = st.rng, R = st.R, ga = st.ph + st.w * st.t, out = [], nb = [];
    for (const b of st.balls) {
      b.vy += 300 * dt; K.move(b, dt);
      const s = Math.hypot(b.vx, b.vy); if (s < 160) K.speed(b, 160); else if (s > 420) K.speed(b, 420);
      const dx = b.x - AX, dy = b.y - AY, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (Math.abs(K.angDiff(a, ga)) < st.half) {
        for (const e of [-st.half, st.half]) { const px = AX + Math.cos(ga + e) * R, py = AY + Math.sin(ga + e) * R; K.seg(b, px, py, px, py); }
        if (d - b.r > R) { out.push(b); }
      } else if (K.ringIn(b, AX, AY, R)) K.scatter(b, rng, 0.15);
    }
    if (out.length) {
      for (const b of out) {
        b.dead = true; st.cnt[b.ci]--;
        for (let k = 0; k < 2; k++) { nb.push(K.ball(AX + rng.range(-6, 6), AY + rng.range(-6, 6), 6, rng.ang(), 260, b.ci)); st.cnt[b.ci]++; }
        FX.burst(b.x, b.y, st.C[b.ci].c, 6, 120, 0.4, 2); AU.blip(Math.min(29, 4 + st.cnt[b.ci] / 4), 0.1);
      }
      st.balls = st.balls.filter(b => !b.dead).concat(nb);
    }
    if (st.balls.length <= 300) K.hashPairs(st.balls, 14, (a, b) => K.collide(a, b));
    const m = Math.max(...st.cnt);
    if (st.win == null && (m >= this.GOAL || st.balls.length >= 500)) st.win = this.lead(st);
  },
  draw(st, ctx) {
    const ga = st.ph + st.w * st.t;
    ctx.strokeStyle = '#6f84b8'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(AX, AY, st.R + 3, ga + st.half, ga - st.half + TAU); ctx.stroke(); ctx.lineCap = 'butt';
    D.glow(ctx, AX, AY, st.R * 1.3, '#3e63dd', 0.15);
    const many = st.balls.length > 120;
    for (const b of st.balls) { if (many) { ctx.fillStyle = st.C[b.ci].c; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); } else D.ball(ctx, b.x, b.y, b.r, st.C[b.ci].c, true); }
  },
  hud: st => st.cnt.slice(),
  lead: st => st.cnt.indexOf(Math.max(...st.cnt))
});

// ---------- 27. Merge Mania ----------
const MJ = { x0: 120, x1: 420, y0: 210, y1: 930, line: 300 };
SIMS.push({
  id: 'merge', name: 'Merge Mania', caption: 'Same colour, same number: merge!', theme: 'paper',
  init(rng) {
    const st = K.base(rng, 4, { bag: [], drop: 0.2, open: 0, over: 0, best: [2, 2, 2, 2] });
    st.balls = []; return st;
  },
  rad: v => 8 * Math.pow(1.22, Math.log2(v) - 1),
  target: st => st.t > 42 ? 32 : st.t > 30 ? 64 : 128,
  where: st => [0, 1, 2, 3].map(i => ({ i, x: 160 + i * 75, y: 180, r: 20 })),
  step(st, dt) {
    const rng = st.rng, B = st.balls;
    if ((st.drop -= dt) <= 0) {
      st.drop = 0.16; if (!st.bag.length) st.bag = rng.shuffle([0, 1, 2, 3]);
      const ci = st.bag.pop(), p = rng(), v = p < 0.4 ? 2 : p < 0.75 ? 4 : 8, b = K.ball(rng.range(MJ.x0 + 20, MJ.x1 - 20), MJ.y0 - 10, this.rad(v), Math.PI / 2, 120, ci); b.v = v; b.pz = 0; B.push(b);
    }
    for (const b of B) { b.vy += 1400 * dt; const f = Math.exp(-0.8 * dt); b.vx *= f; b.vy *= f; K.move(b, dt); b.pz = Math.max(0, b.pz - dt * 4); }
    for (let it = 0; it < 2; it++) {
      K.hashPairs(B, 70, (a, b) => {
        if (a.dead || b.dead) return;
        if (a.ci === b.ci && a.v === b.v && Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 0.5) {
          b.dead = true; a.x = (a.x + b.x) / 2; a.y = (a.y + b.y) / 2; a.vx = (a.vx + b.vx) / 2; a.vy = (a.vy + b.vy) / 2 - 120; a.v *= 2; a.r = this.rad(a.v); a.m = a.r * a.r; a.pz = 1;
          st.best[a.ci] = Math.max(st.best[a.ci], a.v); AU.blip(Math.log2(a.v) * 2 + 2, 0.12); FX.burst(a.x, a.y, st.C[a.ci].c, 4 + Math.log2(a.v) * 2, 140, 0.4, 2.5);
          for (const o of B) { if (o === a || o.dead) continue; const dx = o.x - a.x, dy = o.y - a.y, d = Math.hypot(dx, dy); if (d < a.r * 2.5 && d > 0) { o.vx += dx / d * 120; o.vy += dy / d * 120; } }
          if (a.v >= this.target(st) && st.win == null) st.win = a.ci;
          return;
        }
        K.collide(a, b, 0.15);
      });
      for (const b of B) if (!b.dead) { K.box(b, MJ.x0, -500, MJ.x1, st.open > 0 ? 5000 : MJ.y1, 0.2); }
    }
    for (let i = B.length - 1; i >= 0; i--) if (B[i].dead || B[i].y > MJ.y1 + 60) B.splice(i, 1);
    if (st.open > 0) st.open -= dt;
    else {
      const high = B.some(b => b.y - b.r < MJ.line && Math.abs(b.vy) < 40 && b.y > MJ.y0);
      st.over = high ? st.over + dt : 0;
      if (st.over > 0.8) { st.open = 0.35; st.over = 0; AU.thud(0.5); FX.shake(6); }
    }
  },
  draw(st, ctx) {
    ctx.fillStyle = '#fbf8f1'; ctx.fillRect(MJ.x0, MJ.y0, MJ.x1 - MJ.x0, MJ.y1 - MJ.y0);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(MJ.x0 - 3, MJ.y0 - 20); ctx.lineTo(MJ.x0 - 3, MJ.y1 + 3); if (st.open <= 0) ctx.lineTo(MJ.x1 + 3, MJ.y1 + 3); else ctx.moveTo(MJ.x1 + 3, MJ.y1 + 3); ctx.lineTo(MJ.x1 + 3, MJ.y0 - 20); ctx.stroke();
    ctx.setLineDash([8, 6]); D.line(ctx, MJ.x0, MJ.line, MJ.x1, MJ.line, st.over > 0 ? '#e5484d' : 'rgba(229,72,77,0.35)', 2); ctx.setLineDash([]);
    for (const b of st.balls) { const r = b.r * (1 + b.pz * 0.2); D.ball(ctx, b.x, b.y, r, st.C[b.ci].c, false); D.text(ctx, String(b.v), b.x, b.y + 1, Math.max(9, r * 0.8), '#fff', 'center', 900); }
    D.text(ctx, `Target ${this.target(st)}`, 470, 240, 15, '#8a7f6c', 'center', 800);
  },
  hud: st => st.best.slice(),
  lead: st => { const sc = st.best.map((b, i) => b * 1000 + st.balls.filter(x => x.ci === i).reduce((s, x) => s + x.v, 0)); return sc.indexOf(Math.max(...sc)); }
});

// ---------- 28. Pinball Race ----------
const PB = { cw: 125, x0: 20, top: 150, bot: 900 };
SIMS.push({
  id: 'pinball', name: 'Pinball Race', caption: 'First to 450 points', theme: 'night', GOAL: 450,
  init(rng) {
    const st = K.base(rng, 4, { sc: [0, 0, 0, 0], col: [] });
    for (let i = 0; i < 4; i++) { const b = K.ball(this.lx(i) + 105, PB.bot - 40, 7, 0, 0, i); b.wait = rng.range(0, 0.5); b.lf = 0; b.ramp = 0; st.col.push({ b, spin: 0, sa: 0, fl: [0, 0, 0] }); }
    st.balls = st.col.map(c => c.b);
    return st;
  },
  lx: i => PB.x0 + i * PB.cw,
  add(st, i, v) { st.sc[i] += v * (st.t > 30 ? 2 : 1); if (st.sc[i] >= this.GOAL && st.win == null) st.win = i; },
  step(st, dt) {
    const rng = st.rng;
    st.col.forEach((c, i) => {
      const b = c.b, lx = this.lx(i), L = lx + 6, Rr = lx + PB.cw - 6;
      c.spin *= Math.exp(-1.5 * dt); c.sa += c.spin * dt; c.fl = c.fl.map(f => Math.max(0, f - dt * 4));
      if (b.wait > 0) { b.wait -= dt; if (b.wait <= 0) { b.x = Rr - 12; b.y = 780; b.vx = -rng.range(60, 160); b.vy = -rng.range(850, 1000); } return; }
      b.vy += 900 * dt; K.move(b, dt);
      const s = Math.hypot(b.vx, b.vy); if (s > 950) K.speed(b, 950);
      if (b.x - b.r < L) { b.x = L + b.r; b.vx = Math.abs(b.vx) * 0.9; } if (b.x + b.r > Rr) { b.x = Rr - b.r; b.vx = -Math.abs(b.vx) * 0.9; }
      if (b.y - b.r < PB.top) { b.y = PB.top + b.r; b.vy = Math.abs(b.vy) * 0.8; }
      if (b.y < 200 && b.ramp <= 0) { b.ramp = 1; this.add(st, i, 50); AU.tone(1568, 0.15, 0.12, 'square', 1, 'ramp' + i); FX.burst(b.x, b.y, st.C[i].c, 10, 120); }
      if (b.y > 420) b.ramp = 0;
      [[lx + 34, 300], [lx + 91, 300], [lx + 62, 375]].forEach(([x, y], k) => {
        if (K.ringOut(b, x, y, 15, 1)) { const nx = b.x - x, ny = b.y - y, l = Math.hypot(nx, ny) || 1; const v = Math.max(560, Math.hypot(b.vx, b.vy)); b.vx = nx / l * v + rng.range(-40, 40); b.vy = ny / l * v; c.fl[k] = 1; this.add(st, i, 10); AU.tone(AU.hz(12 + k * 2), 0.08, 0.1, 'square', 0, 'bmp' + i); }
      });
      const gy = 520; if ((b.y - b.vy * dt - gy) * (b.y - gy) < 0 && Math.abs(b.x - (lx + 62)) < 24) { const turns = Math.max(1, Math.round(Math.abs(b.vy) / 160)); c.spin += turns * 12; this.add(st, i, 5 * turns); AU.tick(0.08); }
      for (const sg of [[L, 640, lx + 34, 700], [Rr, 640, lx + PB.cw - 34, 700]]) if (K.seg(b, sg[0], sg[1], sg[2], sg[3], 1.2, 3) > 60) { this.add(st, i, 2); AU.tone(700, 0.04, 0.08, 'triangle', 0, 'sl' + i); }
      for (const sg of [[L, 820, lx + 47, 858], [Rr, 820, lx + PB.cw - 47, 858]]) if (K.seg(b, sg[0], sg[1], sg[2], sg[3], 0.3, 4) > 1) {
        if (rng() < 0.82) { b.vy = -rng.range(650, 900); b.vx = rng.range(-180, 180); AU.thud(0.12); } }
      if (b.y > PB.bot + 20) { b.wait = 1.5; b.x = Rr - 10; b.y = PB.bot + 40; b.vx = b.vy = 0; AU.tone(160, 0.3, 0.12, 'sawtooth', 0.5, 'drain'); }
    });
  },
  draw(st, ctx) {
    const dbl = st.t > 30;
    st.col.forEach((c, i) => {
      const lx = this.lx(i), L = lx + 6, Rr = lx + PB.cw - 6, col = st.C[i].c;
      ctx.fillStyle = dbl && Math.sin(st.t * 10) > 0 ? rgba(col, 0.12) : 'rgba(255,255,255,0.03)'; ctx.fillRect(L, PB.top, Rr - L, PB.bot + 20 - PB.top);
      ctx.strokeStyle = rgba(col, 0.6); ctx.lineWidth = 2; ctx.strokeRect(L, PB.top, Rr - L, PB.bot + 20 - PB.top);
      D.line(ctx, L, 200, Rr, 200, rgba(col, 0.25), 1);
      [[lx + 34, 300], [lx + 91, 300], [lx + 62, 375]].forEach(([x, y], k) => { D.glow(ctx, x, y, 34, col, 0.4 + c.fl[k]); D.circle(ctx, x, y, 15, shade(col, 0.5), 3, c.fl[k] > 0 ? '#fff' : rgba(col, 0.5)); });
      const w = 22 * Math.cos(c.sa); D.line(ctx, lx + 62 - w, 520, lx + 62 + w, 520, '#ffe08a', 4);
      ctx.lineCap = 'round';
      D.line(ctx, L, 640, lx + 34, 700, col, 5); D.line(ctx, Rr, 640, lx + PB.cw - 34, 700, col, 5);
      D.line(ctx, L, 820, lx + 47, 858, '#e9e6df', 7); D.line(ctx, Rr, 820, lx + PB.cw - 47, 858, '#e9e6df', 7);
      ctx.lineCap = 'butt';
      if (c.b.wait <= 0) D.ball(ctx, c.b.x, c.b.y, c.b.r, '#dfe6f0', true);
      D.text(ctx, String(st.sc[i]), lx + PB.cw / 2, 175, 22, col, 'center', 900);
    });
    if (dbl) D.text(ctx, 'DOUBLE POINTS', W / 2, 935, 16, '#ffe08a', 'center', 900);
  },
  where: st => st.col.map((c, i) => ({ i, x: PB.x0 + i * PB.cw + 62, y: 400, r: 60 })),
  hud: st => st.sc.slice()
});

// ---------- 29. Last Planet ----------
SIMS.push({
  id: 'planet', name: 'Last Planet', caption: 'Last planet in orbit', theme: 'night',
  init(rng) {
    const st = K.base(rng, 8, { mu: 4e6, sr: 22, flare: 0 });
    const orb = rng.shuffle(Array.from({ length: 8 }, (_, k) => 80 + k * 21 + rng.range(-6, 6)));
    st.balls = orb.map((r, i) => { const a = rng.ang(), dir = rng() < 0.75 ? 1 : -1, v = Math.sqrt(st.mu / r) * rng.range(0.88, 1.1); const b = K.ball(AX + Math.cos(a) * r, AY + Math.sin(a) * r, 7, a + dir * Math.PI / 2, v, i); b.mass = 1; b.oob = 0; b.tr = []; return b; });
    st.ast = []; for (let k = 0; k < 50; k++) { const r = rng.range(90, 250), a = rng.ang(), v = Math.sqrt(st.mu / r); st.ast.push({ x: AX + Math.cos(a) * r, y: AY + Math.sin(a) * r, vx: -Math.sin(a) * v, vy: Math.cos(a) * v, on: true }); }
    return st;
  },
  step(st, dt) {
    const B = st.balls.filter(b => !b.dead), dying = [];
    if (st.t > 20) { st.mu *= Math.pow(1.045, dt); st.sr += 1.3 * dt; }
    const grav = (o, eps) => { const dx = AX - o.x, dy = AY - o.y, d2 = dx * dx + dy * dy + eps, f = st.mu / (d2 * Math.sqrt(d2)); o.vx += dx * f * dt; o.vy += dy * f * dt; };
    for (const b of B) {
      grav(b, 64);
      for (const o of B) if (o !== b) { const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy + 400, f = st.mu * 0.004 * o.mass / (d2 * Math.sqrt(d2)); b.vx += dx * f * dt; b.vy += dy * f * dt; }
      const s = Math.hypot(b.vx, b.vy); if (s > 900) K.speed(b, 900);
    }
    for (const b of B) { K.move(b, dt); b.tr.push(b.x, b.y); if (b.tr.length > 160) b.tr.splice(0, 2); }
    for (const a of st.ast) { if (!a.on) continue; grav(a, 64); a.x += a.vx * dt; a.y += a.vy * dt; if (Math.hypot(a.x - AX, a.y - AY) < st.sr) a.on = false; for (const b of B) if (Math.abs(a.x - b.x) < b.r + 2 && Math.abs(a.y - b.y) < b.r + 2) { a.on = false; b.mass += 0.15; b.r = 7 * Math.cbrt(b.mass); AU.blip(16, 0.05); break; } }
    K.pairs(B, (a, b) => {
      if (a.dead || b.dead || Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r) return;
      const big = a.mass > b.mass + 1e-9 ? a : b.mass > a.mass + 1e-9 ? b : (st.rng() < 0.5 ? a : b), sm = big === a ? b : a, M = big.mass + sm.mass;
      big.vx = (big.vx * big.mass + sm.vx * sm.mass) / M; big.vy = (big.vy * big.mass + sm.vy * sm.mass) / M; big.mass = M; big.r = 7 * Math.cbrt(M);
      sm.dead = true; dying.push(sm.ci); FX.burst(sm.x, sm.y, st.C[sm.ci].c, 26, 220); AU.thud(0.3);
    });
    for (const b of B) {
      if (b.dead) continue;
      if (Math.hypot(b.x - AX, b.y - AY) < st.sr + b.r * 0.5) { b.dead = true; dying.push(b.ci); st.flare = 1; FX.burst(b.x, b.y, '#ffd27a', 30, 260); AU.boom(0.3); continue; }
      if (b.x < -20 || b.x > W + 20 || b.y < 110 || b.y > H + 20) { if ((b.oob += dt) > 3) { b.dead = true; dying.push(b.ci); AU.whoosh(0.2); } } else b.oob = 0;
    }
    st.flare = Math.max(0, st.flare - dt * 2);
    if (dying.length) K.knock(st, dying, i => st.balls[i].mass);
  },
  draw(st, ctx) {
    if (!st._stars) { st._stars = []; for (let k = 0; k < 90; k++) st._stars.push([Math.random() * W, 120 + Math.random() * 840, Math.random()]); }
    for (const s of st._stars) { ctx.fillStyle = `rgba(255,255,255,${0.2 + s[2] * 0.5})`; ctx.fillRect(s[0], s[1], 1.5, 1.5); }
    for (const b of st.balls) { if (b.dead) continue; const t = b.tr; ctx.strokeStyle = rgba(st.C[b.ci].c, 0.35); ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 0; k < t.length; k += 2) k ? ctx.lineTo(t[k], t[k + 1]) : ctx.moveTo(t[k], t[k + 1]); ctx.stroke(); }
    D.glow(ctx, AX, AY, st.sr * 4, '#ffb347', 0.8 + st.flare); D.circle(ctx, AX, AY, st.sr, null, 0, '#ffd88a'); D.circle(ctx, AX, AY, st.sr * 0.7, null, 0, '#fff3cf');
    ctx.fillStyle = '#8a8f99'; for (const a of st.ast) if (a.on) ctx.fillRect(a.x - 1.5, a.y - 1.5, 3, 3);
    for (const b of st.balls) if (!b.dead) D.ball(ctx, b.x, b.y, b.r, st.C[b.ci].c, true);
  },
  hud: st => st.balls.map(b => b.dead ? 0 : b.mass.toFixed(1)),
  lead: st => K.aliveIdx(st).sort((a, b) => st.balls[b].mass - st.balls[a].mass)[0]
});

// ---------- 30. Chain Reaction ----------
const CR = { c: 6, r: 10, s: 78, ox: 36, oy: 152 };
SIMS.push({
  id: 'chain', name: 'Chain Reaction', caption: 'Last colour on the board', theme: 'night',
  init(rng) {
    const n = CR.c * CR.r, st = K.base(rng, 4, { cnt: new Int8Array(n), own: new Int8Array(n).fill(-1), turn: 0, moved: [0, 0, 0, 0], mt: 0.6, wave: null, wt: 0, fly: [], wn: 0 });
    st.cap = Array.from({ length: n }, (_, i) => { const x = i % CR.c, y = (i / CR.c) | 0; return 4 - (x === 0 || x === CR.c - 1) - (y === 0 || y === CR.r - 1); });
    return st;
  },
  nb(i) { const x = i % CR.c, y = (i / CR.c) | 0, r = []; if (x > 0) r.push(i - 1); if (x < CR.c - 1) r.push(i + 1); if (y > 0) r.push(i - CR.c); if (y < CR.r - 1) r.push(i + CR.c); return r; },
  ctr(i) { return [CR.ox + (i % CR.c + 0.5) * CR.s, CR.oy + (((i / CR.c) | 0) + 0.5) * CR.s]; },
  where(st) { return [0, 1, 2, 3].map(i => ({ i, x: 100 + i * 113, y: 540, r: 50 })); },
  check(st) {
    const has = [0, 0, 0, 0]; for (let i = 0; i < st.own.length; i++) if (st.own[i] >= 0) has[st.own[i]]++;
    const dying = []; for (let p = 0; p < 4; p++) if (!st.out[p] && st.moved[p] && has[p] === 0) dying.push(p);
    if (dying.length) { AU.tone(150, 0.4, 0.2, 'sawtooth', 0.5, 'elim'); K.knock(st, dying, p => has[p]); }
    if (st.win == null && st.moved.every((m, p) => m || st.out[p])) { const live = [0, 1, 2, 3].filter(p => has[p] > 0); if (live.length === 1) { [0, 1, 2, 3].forEach(p => { if (p !== live[0] && !st.out[p]) { st.out[p] = true; st.outT[p] = st.t; } }); st.win = live[0]; } }
  },
  step(st, dt) {
    const rng = st.rng;
    st.fly = st.fly.filter(f => st.t - f.t < 0.12);
    if (st.wave) {
      if ((st.wt -= dt) > 0) return;
      st.wt = 0.08; st.wn++;
      const next = new Set();
      for (const i of st.wave) {
        if (st.cnt[i] < st.cap[i]) continue;
        const p = st.own[i]; st.cnt[i] -= st.cap[i]; if (st.cnt[i] === 0) st.own[i] = -1;
        for (const j of this.nb(i)) { st.cnt[j]++; st.own[j] = p; st.fly.push({ a: i, b: j, p, t: st.t }); if (st.cnt[j] >= st.cap[j]) next.add(j); }
        const [x, y] = this.ctr(i); FX.burst(x, y, st.C[p].c, 6, 160, 0.35, 2.5);
      }
      AU.blip(Math.min(29, 6 + st.wn), 0.12);
      this.check(st);
      st.wave = next.size && st.win == null && st.wn < 300 ? [...next] : null;
      return;
    }
    if (st.win != null || (st.mt -= dt) > 0) return;
    st.mt = 1 / 6;
    let p = st.turn; for (let k = 0; k < 4 && st.out[p]; k++) p = (p + 1) % 4; st.turn = (p + 1) % 4;
    const opts = [], w = [];
    for (let i = 0; i < st.own.length; i++) if (st.own[i] === -1 || st.own[i] === p) { opts.push(i); w.push(st.own[i] === p ? 1 + 4 * Math.pow(st.cnt[i] / (st.cap[i] - 1 || 1), 2) : 1); }
    if (!opts.length) return;
    let r = rng() * w.reduce((a, b) => a + b, 0), k = 0; while (k < opts.length - 1 && (r -= w[k]) > 0) k++;
    const i = opts[k]; st.cnt[i]++; st.own[i] = p; st.moved[p] = 1; AU.tick(0.05);
    if (st.cnt[i] >= st.cap[i]) { st.wave = [i]; st.wt = 0.08; st.wn = 0; }
    this.check(st);
  },
  draw(st, ctx) {
    ctx.strokeStyle = '#2a3040'; ctx.lineWidth = 2;
    for (let x = 0; x <= CR.c; x++) D.line(ctx, CR.ox + x * CR.s, CR.oy, CR.ox + x * CR.s, CR.oy + CR.r * CR.s, '#2a3040', 2);
    for (let y = 0; y <= CR.r; y++) D.line(ctx, CR.ox, CR.oy + y * CR.s, CR.ox + CR.c * CR.s, CR.oy + y * CR.s, '#2a3040', 2);
    for (let i = 0; i < st.cnt.length; i++) {
      const n = st.cnt[i]; if (!n || st.own[i] < 0) continue;
      const [x, y] = this.ctr(i), c = st.C[st.own[i]].c, crit = n >= st.cap[i] - 1, j = crit ? 2.5 : 0.8, sp = crit ? 14 : 4;
      ctx.fillStyle = rgba(c, 0.12); ctx.fillRect(x - CR.s / 2 + 2, y - CR.s / 2 + 2, CR.s - 4, CR.s - 4);
      const pos = n === 1 ? [[0, 0]] : n === 2 ? [[-9, 0], [9, 0]] : [[-9, 6], [9, 6], [0, -9]];
      pos.slice(0, Math.min(3, n)).forEach(([ox, oy], k) => D.ball(ctx, x + ox + Math.sin(st.t * sp + k * 2 + i) * j, y + oy + Math.cos(st.t * sp * 1.3 + k + i) * j, 11, c, true));
    }
    for (const f of st.fly) { const [ax, ay] = this.ctr(f.a), [bx, by] = this.ctr(f.b), k = Math.min(1, (st.t - f.t) / 0.1); D.ball(ctx, ax + (bx - ax) * k, ay + (by - ay) * k, 9, st.C[f.p].c, true); }
  },
  hud(st) { const v = [0, 0, 0, 0]; for (let i = 0; i < st.own.length; i++) if (st.own[i] >= 0) v[st.own[i]] += st.cnt[i]; return v; }
});
