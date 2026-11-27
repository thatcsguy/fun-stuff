// ===================== D. Territory =====================
function gridPaint(st, name, cw, ch, colorOf) { // offscreen 1px-per-cell canvas kept in sync via st.dirty / st.full
  const L = D.layer(st, name, cw, ch), g = L.getContext('2d');
  if (st.full || !st._img) { st._img = g.createImageData(cw, ch); }
  const img = st._img, px = img.data, put = i => { const c = colorOf(i); px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255; };
  if (st.full) { st.full = false; st.dirty.length = 0; for (let i = 0; i < cw * ch; i++) put(i); } else { for (const i of st.dirty) put(i); st.dirty.length = 0; }
  g.putImageData(img, 0, 0); return L;
}

// ---------- 21. Paint War ----------
const PW = { c: 30, r: 46, s: 17, ox: 15, oy: 158 };
SIMS.push({
  id: 'paint', name: 'Paint War', caption: 'Most paint at 45 s, or 60% wins', theme: 'paper',
  init(rng) {
    const st = K.base(rng, 4, { g: new Int8Array(PW.c * PW.r), dirty: [], full: true, n: [0, 0, 0, 0], two: false });
    for (let y = 0; y < PW.r; y++) for (let x = 0; x < PW.c; x++) { const o = (x >= 15 ? 1 : 0) + (y >= 23 ? 2 : 0); st.g[y * PW.c + x] = o; st.n[o]++; }
    st.balls = [0, 1, 2, 3].map(o => K.ball(PW.ox + ((o & 1) ? 22.5 : 7.5) * PW.s + rng.range(-40, 40), PW.oy + ((o & 2) ? 34.5 : 11.5) * PW.s + rng.range(-60, 60), 7, rng.ang(), 330, o));
    return st;
  },
  at(st, x, y) { const cx = Math.floor((x - PW.ox) / PW.s), cy = Math.floor((y - PW.oy) / PW.s); return cx < 0 || cy < 0 || cx >= PW.c || cy >= PW.r ? -1 : cy * PW.c + cx; },
  flip(st, i, o) { const p = st.g[i]; st.n[p]--; st.n[o]++; st.g[i] = o; dirtyPush(st, i); AU.tone(AU.hz([5, 7, 9, 12][o]), 0.12, 0.07, 'triangle', 0, 'mar' + o); },
  step(st, dt) {
    const rng = st.rng;
    if (!st.two && st.t > 30) {
      st.two = true;
      for (let o = 0; o < 4; o++) { const own = []; for (let i = 0; i < st.g.length; i++) if (st.g[i] === o) own.push(i); if (!own.length) continue; const i = rng.pick(own); st.balls.push(K.ball(PW.ox + (i % PW.c + 0.5) * PW.s, PW.oy + ((i / PW.c | 0) + 0.5) * PW.s, 7, rng.ang(), 330, o)); }
      AU.chime();
    }
    const x0 = PW.ox, y0 = PW.oy, x1 = PW.ox + PW.c * PW.s, y1 = PW.oy + PW.r * PW.s;
    for (const b of st.balls) {
      for (let sub = 0; sub < 2; sub++) {
        const h = dt / 2;
        b.x += b.vx * h; const ex = b.x + Math.sign(b.vx) * b.r, ix = this.at(st, ex, b.y);
        if (ix >= 0 && st.g[ix] !== b.ci) { this.flip(st, ix, b.ci); b.vx = -b.vx; b.x -= b.vx * -h; }
        b.y += b.vy * h; const ey = b.y + Math.sign(b.vy) * b.r, iy = this.at(st, b.x, ey);
        if (iy >= 0 && st.g[iy] !== b.ci) { this.flip(st, iy, b.ci); b.vy = -b.vy; b.y -= b.vy * -h; }
        if (K.box(b, x0, y0, x1, y1)) K.scatter(b, rng, 0.08);
      }
      K.nudge(b, 0.2);
    }
    const tot = PW.c * PW.r, m = Math.max(...st.n);
    if (st.win == null && (m >= tot * 0.6 || st.t >= 45)) st.win = st.n.indexOf(m);
  },
  draw(st, ctx) {
    const cols = st.C.map(c => c.rgb), L = gridPaint(st, 'pw', PW.c, PW.r, i => cols[st.g[i]]);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(L, PW.ox, PW.oy, PW.c * PW.s, PW.r * PW.s); ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 1; x < PW.c; x++) { ctx.moveTo(PW.ox + x * PW.s, PW.oy); ctx.lineTo(PW.ox + x * PW.s, PW.oy + PW.r * PW.s); }
    for (let y = 1; y < PW.r; y++) { ctx.moveTo(PW.ox, PW.oy + y * PW.s); ctx.lineTo(PW.ox + PW.c * PW.s, PW.oy + y * PW.s); } ctx.stroke();
    for (const b of st.balls) { D.circle(ctx, b.x, b.y, b.r + 2, null, 0, '#fff'); D.circle(ctx, b.x, b.y, b.r, null, 0, st.C[b.ci].d); }
    if (st.t < 45) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(PW.ox, 140, PW.c * PW.s * (1 - st.t / 45), 5); }
  },
  hud: st => st.n.map(n => Math.round(n / (PW.c * PW.r) * 100) + '%'),
  lead: st => st.n.indexOf(Math.max(...st.n))
});

// ---------- 22. Border War ----------
const BW = { c: 90, r: 140, s: 5.6, ox: 18, oy: 156 };
SIMS.push({
  id: 'border', name: 'Border War', caption: 'Last colour on the map', theme: 'night',
  init(rng) {
    const N = 6, st = K.base(rng, N, { g: new Int8Array(BW.c * BW.r), dirty: [], full: true, n: new Array(N + 1).fill(0), mor: [], cap: [], tick: 0 });
    const g = st.g, blob = (cx, cy, r, v) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < BW.c && y < BW.r && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) g[y * BW.c + x] = v; };
    for (let k = 0; k < 7; k++) blob(rng.int(5, 84), rng.int(5, 134), rng.int(2, 5), -1);
    const caps = []; while (caps.length < N) { const x = rng.int(8, 81), y = rng.int(8, 131); if (caps.every(c => Math.hypot(c[0] - x, c[1] - y) > 38)) caps.push([x, y]); if (caps.length < N && rng() < 0.001) caps.push([x, y]); }
    caps.forEach((c, i) => { blob(c[0], c[1], 3, i + 1); st.cap.push(c[1] * BW.c + c[0]); st.mor.push(1); });
    for (let i = 0; i < g.length; i++) if (g[i] > 0) st.n[g[i]]++;
    st.capLost = new Array(N).fill(false);
    return st;
  },
  where: st => st.cap.map((c, i) => ({ i, x: BW.ox + (c % BW.c + 0.5) * BW.s, y: BW.oy + ((c / BW.c | 0) + 0.5) * BW.s, r: 16 })),
  step(st, dt) {
    st.tick += dt * 12; if (st.tick < 1) return; st.tick -= 1;
    const rng = st.rng, g = st.g, C = BW.c, R = BW.r, N = st.C.length, tot = st.n.slice(1).reduce((a, b) => a + b, 0) || 1;
    const k = 0.6 + Math.max(0, st.t - 25) * 0.25;
    for (let i = 0; i < N; i++) st.mor[i] = K.clamp(st.mor[i] + rng.range(-0.06, 0.06) + (1 - st.mor[i]) * 0.01, 0.5, 1.6);
    const ch = [];
    for (let i = 0; i < g.length; i++) {
      const o = g[i]; if (o <= 0) continue;
      const x = i % C, y = (i / C) | 0, d = (rng() * 4) | 0, nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d];
      if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
      const j = ny * C + nx, t = g[j]; if (t === o || t < 0) continue;
      let p;
      if (t === 0) p = 0.22;
      else {
        let own = 0; if (nx > 0 && g[j - 1] === o) own++; if (nx < C - 1 && g[j + 1] === o) own++; if (ny > 0 && g[j - C] === o) own++; if (ny < R - 1 && g[j + C] === o) own++;
        p = 0.12 * own / 2 * Math.pow(st.n[o] / Math.max(1, st.n[t]), k) * st.mor[o - 1] / st.mor[t - 1] * (st.t > 30 && st.n[t] < 150 ? 3 : 1);
      }
      if (rng() < p) ch.push(j, o);
    }
    for (let q = 0; q < ch.length; q += 2) { const j = ch[q], o = ch[q + 1], t = g[j]; if (t === o) continue; if (t > 0) st.n[t]--; st.n[o]++; g[j] = o; dirtyPush(st, j); }
    if (ch.length) AU.noise(0.05, 1500, Math.min(0.08, ch.length / 4000), 'bandpass', 1, 'crack');
    const dying = [];
    for (let i = 0; i < N; i++) {
      if (st.out[i]) continue;
      if (!st.capLost[i] && g[st.cap[i]] !== i + 1) { st.capLost[i] = true; st.mor[i] *= 0.5; AU.thud(0.3); }
      if (st.n[i + 1] === 0) dying.push(i);
    }
    if (dying.length) { AU.tone(220, 0.6, 0.2, 'sawtooth', 0.5, 'horn'); K.knock(st, dying); }
  },
  draw(st, ctx) {
    const cols = [[44, 48, 58], ...st.C.map(c => c.rgb)], L = gridPaint(st, 'bw', BW.c, BW.r, i => st.g[i] < 0 ? [90, 96, 110] : cols[st.g[i]]);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(L, BW.ox, BW.oy, BW.c * BW.s, BW.r * BW.s); ctx.imageSmoothingEnabled = true;
    st.cap.forEach((c, i) => {
      const x = BW.ox + (c % BW.c + 0.5) * BW.s, y = BW.oy + ((c / BW.c | 0) + 0.5) * BW.s;
      D.text(ctx, '★', x, y, 18, st.capLost[i] ? 'rgba(0,0,0,0.4)' : '#fff');
    });
  },
  hud(st) { const tot = BW.c * BW.r; return st.C.map((c, i) => (st.n[i + 1] / tot * 100).toFixed(st.n[i + 1] / tot < 0.1 ? 1 : 0) + '%'); },
  lead: st => { const v = st.C.map((c, i) => st.n[i + 1]); return v.indexOf(Math.max(...v)); }
});

// ---------- 23. Fortress Breakers ----------
SIMS.push({
  id: 'fort', name: 'Fortress Breakers', caption: 'Last core standing', theme: 'night',
  init(rng) {
    const st = K.base(rng, 4, { br: [], lost: [0, 0, 0, 0], peel: 0 });
    st.F = [[BX0, BY0, 0], [BX1, BY0, Math.PI / 2], [BX1, BY1, Math.PI], [BX0, BY1, -Math.PI / 2]].map((f, i) => ({ x: f[0], y: f[1], a0: f[2], alive: true, i }));
    st.F.forEach((f, i) => [[66, 6], [96, 8], [126, 10]].forEach(([r, n], L) => { for (let k = 0; k < n; k++) st.br.push({ f: i, L, rIn: r - 8, rOut: r + 8, a0: f.a0 + k / n * Math.PI / 2, a1: f.a0 + (k + 1) / n * Math.PI / 2, on: true }); }));
    st.balls = []; for (let k = 0; k < 8; k++) { const b = K.ball(W / 2 + rng.range(-40, 40), (BY0 + BY1) / 2 + rng.range(-40, 40), 7, rng.ang(), 240, -1); b.col = -1; st.balls.push(b); }
    return st;
  },
  where: st => st.F.map((f, i) => ({ i, x: f.x + Math.cos(f.a0 + Math.PI / 4) * 40, y: f.y + Math.sin(f.a0 + Math.PI / 4) * 40, r: 40 })),
  step(st, dt) {
    const rng = st.rng, spd = 270 + st.t * 4;
    if (st.peel < 1 && st.t > 35) { st.peel = 1; for (const k of st.br) if (k.L > 0 && k.on) { k.on = false; const f = st.F[k.f]; FX.burst(f.x + Math.cos((k.a0 + k.a1) / 2) * k.rIn, f.y + Math.sin((k.a0 + k.a1) / 2) * k.rIn, st.C[k.f].c, 2, 100); } AU.boom(0.3); }
    if (st.peel < 2 && st.t > 48) { st.peel = 2; for (const k of st.br) k.on = false; }
    const dying = [];
    for (const b of st.balls) {
      K.move(b, dt); if (K.box(b, BX0, BY0, BX1, BY1)) { K.nudge(b); K.scatter(b, rng, 0.1); }
      for (const f of st.F) {
        if (!f.alive) continue;
        const dx = b.x - f.x, dy = b.y - f.y, d = Math.hypot(dx, dy);
        if (d < 22 + b.r) {
          if (b.col === f.i) { K.ringOut(b, f.x, f.y, 22); continue; }
          f.alive = false; dying.push(f.i); FX.burst(f.x, f.y, st.C[f.i].c, 60, 380, 1, 4); FX.shake(12); AU.boom(0.5);
          for (const k of st.br) if (k.f === f.i && k.on) { k.on = false; }
          for (const o of st.balls) if (o.col === f.i) o.col = -1;
          K.ringOut(b, f.x, f.y, 22); continue;
        }
        if (d > 140) continue;
        const a = Math.atan2(dy, dx);
        for (const k of st.br) {
          if (!k.on || k.f !== f.i || d < k.rIn - b.r || d > k.rOut + b.r) continue;
          const m = b.r / d, da = K.angDiff(k.a0, a), span = k.a1 - k.a0;
          if (da < -m || da > span + m) continue;
          const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny, out = d > (k.rIn + k.rOut) / 2;
          if (out ? vn < 0 : vn > 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
          const nd = out ? k.rOut + b.r : k.rIn - b.r; b.x = f.x + nx * nd; b.y = f.y + ny * nd;
          if (b.col !== k.f) {
            k.on = false; b.col = k.f; st.lost[k.f]++; AU.blip(4 + k.L * 4, 0.1);
            FX.burst(b.x, b.y, st.C[k.f].c, 8, 140, 0.5, 2.5);
            if (st.lost[k.f] % 10 === 0 && st.balls.length < 30) { const ang = f.a0 + Math.PI / 4 + rng.range(-0.4, 0.4), nb = K.ball(f.x + Math.cos(ang) * 30, f.y + Math.sin(ang) * 30, 7, ang, spd, k.f); nb.col = k.f; st.balls.push(nb); }
          } else AU.tick(0.05);
          break;
        }
      }
      K.speed(b, spd);
    }
    K.pairs(st.balls, (a, b) => K.collide(a, b));
    if (dying.length) K.knock(st, dying, i => st.br.filter(k => k.f === i && k.on).length);
  },
  draw(st, ctx) {
    ctx.strokeStyle = '#2c3342'; ctx.lineWidth = 3; ctx.strokeRect(BX0, BY0, BX1 - BX0, BY1 - BY0);
    for (const k of st.br) {
      if (!k.on) continue; const f = st.F[k.f], c = st.C[k.f].c;
      ctx.strokeStyle = rgba(c, 0.85 - k.L * 0.15); ctx.lineWidth = k.rOut - k.rIn - 3; ctx.beginPath(); ctx.arc(f.x, f.y, (k.rIn + k.rOut) / 2, k.a0 + 0.02, k.a1 - 0.02); ctx.stroke();
    }
    for (const f of st.F) {
      if (!f.alive) continue; const c = st.C[f.i].c, left = st.br.filter(k => k.f === f.i && k.on).length, pulse = 0.6 + 0.4 * Math.sin(st.t * (3 + (24 - left) * 0.6));
      D.glow(ctx, f.x, f.y, 60, c, pulse); D.circle(ctx, f.x, f.y, 22, null, 0, c); D.circle(ctx, f.x, f.y, 10, null, 0, '#fff');
    }
    for (const b of st.balls) D.ball(ctx, b.x, b.y, b.r, b.col < 0 ? '#e8e8e8' : st.C[b.col].c, true);
  },
  hud: st => st.F.map(f => f.alive ? st.br.filter(k => k.f === f.i && k.on).length : 0),
  lead: st => K.aliveIdx(st).sort((a, b) => st.br.filter(k => k.f === b && k.on).length - st.br.filter(k => k.f === a && k.on).length)[0]
});

// ---------- 24. Ball Soccer ----------
const SC = { x0: 20, y0: 290, x1: 520, y1: 790, gw: 82 };
SIMS.push({
  id: 'soccer', name: 'Ball Soccer', caption: 'Lose 3 goals and you’re out', theme: 'paper',
  init(rng) {
    const st = K.base(rng, 4, { lives: [3, 3, 3, 3], goals: 0, ball2: false });
    const cx = (SC.x0 + SC.x1) / 2, cy = (SC.y0 + SC.y1) / 2;
    st.G = [[cx, SC.y0, 0, 1], [SC.x1, cy, -1, 0], [cx, SC.y1, 0, -1], [SC.x0, cy, 1, 0]];
    st.pl = [];
    for (let i = 0; i < 4; i++) for (let r = 0; r < 2; r++) { const g = st.G[i], p = K.ball(g[0] + g[2] * (r ? 50 : 150) + rng.range(-30, 30) * Math.abs(g[3]), g[1] + g[3] * (r ? 50 : 150) + rng.range(-30, 30) * Math.abs(g[2]), 15, 0, 0, i); p.m = 6; p.role = r; p.aim = 0; p.at = 0; st.pl.push(p); }
    st.gb = [this.newBall(rng)];
    return st;
  },
  where: st => st.pl.map(p => ({ i: p.ci, x: p.x, y: p.y, r: p.r })),
  corners: [[SC.x0, SC.y0 + 60, SC.x0 + 60, SC.y0], [SC.x1 - 60, SC.y0, SC.x1, SC.y0 + 60], [SC.x1, SC.y1 - 60, SC.x1 - 60, SC.y1], [SC.x0 + 60, SC.y1, SC.x0, SC.y1 - 60]],
  newBall(rng) { const b = K.ball((SC.x0 + SC.x1) / 2, (SC.y0 + SC.y1) / 2, 10, rng.ang(), 220, -1); b.m = 1; b.idle = 0; return b; },
  step(st, dt) {
    const rng = st.rng;
    if (st.gb.length < 3 && st.t > (st.gb.length === 1 ? 20 : 40)) { st.gb.push(this.newBall(rng)); AU.tone(1800, 0.3, 0.15, 'square', 0.9, 'whistle'); }
    const alive = K.aliveIdx(st), maxS = 470 * (1 + 0.08 * st.goals);
    for (const p of st.pl) {
      if (p.dead) continue;
      if ((p.at -= dt) <= 0) { p.at = 1; p.aim = rng.range(-0.3, 0.3); }
      const g = st.G[p.ci]; let gb = st.gb[0], bd = 1e9; for (const b of st.gb) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < bd) { bd = d; gb = b; } }
      let tx, ty;
      if (p.role === 1) { const lat = g[2] === 0 ? K.clamp(gb.x - g[0], -55, 55) : K.clamp(gb.y - g[1], -55, 55); tx = g[0] + g[2] * 42 + (g[2] === 0 ? lat : 0); ty = g[1] + g[3] * 42 + (g[3] === 0 ? lat : 0); if (bd < 110) { tx = gb.x; ty = gb.y; } }
      else {
        let T = null, td = 1e9; for (const j of alive) { if (j === p.ci) continue; const d = Math.hypot(st.G[j][0] - gb.x, st.G[j][1] - gb.y); if (d < td) { td = d; T = st.G[j]; } }
        if (!T) T = [W / 2, 540];
        let dx = T[0] - gb.x, dy = T[1] - gb.y; const l = Math.hypot(dx, dy) || 1, c = Math.cos(p.aim), s = Math.sin(p.aim); [dx, dy] = [(dx * c - dy * s) / l, (dx * s + dy * c) / l];
        const bx = gb.x - dx * 26, by = gb.y - dy * 26, behind = ((p.x - gb.x) * -dx + (p.y - gb.y) * -dy) / Math.max(1, Math.hypot(p.x - gb.x, p.y - gb.y));
        if (behind > 0.6) { tx = gb.x + dx * 20; ty = gb.y + dy * 20; } else { tx = bx - dy * 30 * Math.sign(behind || 1); ty = by + dx * 30 * Math.sign(behind || 1); }
      }
      const dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy) || 1, vm = p.role ? 170 : 250;
      p.vx += (dx / l * vm * Math.min(1, l / 30) - p.vx) * Math.min(1, 5 * dt); p.vy += (dy / l * vm * Math.min(1, l / 30) - p.vy) * Math.min(1, 5 * dt);
      K.move(p, dt); K.box(p, SC.x0, SC.y0, SC.x1, SC.y1, 0.3); for (const c of this.corners) K.seg(p, c[0], c[1], c[2], c[3], 0.3, 3);
    }
    for (const b of st.gb) {
      const f = Math.exp(-0.35 * dt); b.vx *= f; b.vy *= f; K.move(b, dt);
      const s = Math.hypot(b.vx, b.vy); if (s > maxS) K.speed(b, maxS);
      for (const c of this.corners) K.seg(b, c[0], c[1], c[2], c[3], 0.9, 3);
      if (s < 90) b.slow = (b.slow || 0) + dt; else b.slow = 0;
      if ((b.idle += dt) > 5 || b.slow > 1.5) { b.idle = 0; b.slow = 0; const a = Math.atan2(540 - b.y, 270 - b.x); b.vx = Math.cos(a) * 250; b.vy = Math.sin(a) * 250; }
      let goal = -1;
      for (let i = 0; i < 4; i++) {
        const g = st.G[i], open = !st.out[i], lat = g[2] === 0 ? b.x - g[0] : b.y - g[1];
        const past = g[3] === 1 ? b.y < SC.y0 : g[3] === -1 ? b.y > SC.y1 : g[2] === 1 ? b.x < SC.x0 : b.x > SC.x1;
        if (open && past && Math.abs(lat) < SC.gw) goal = i;
      }
      if (goal >= 0) {
        st.lives[goal]--; st.goals++; FX.burst(b.x, b.y, st.C[goal].c, 30, 260); FX.flash(st.C[goal].c, 0.2); AU.noise(0.8, 700, 0.3, 'bandpass', 0.5, 'crowd'); AU.tone(1800, 0.3, 0.15, 'square', 0.9, 'whistle');
        Object.assign(b, this.newBall(rng));
        if (st.lives[goal] <= 0) { st.pl.forEach(p => { if (p.ci === goal) { p.dead = true; FX.burst(p.x, p.y, st.C[goal].c, 14, 150); } }); K.knock(st, [goal]); }
        continue;
      }
      for (let i = 0; i < 4; i++) {
        const g = st.G[i], lat = g[2] === 0 ? b.x - g[0] : b.y - g[1], open = !st.out[i] && Math.abs(lat) < SC.gw;
        if (open) continue;
        if (g[3] === 1 && b.y - b.r < SC.y0) { b.y = SC.y0 + b.r; b.vy = Math.abs(b.vy) * 0.9; AU.thud(0.08); }
        if (g[3] === -1 && b.y + b.r > SC.y1) { b.y = SC.y1 - b.r; b.vy = -Math.abs(b.vy) * 0.9; AU.thud(0.08); }
        if (g[2] === 1 && b.x - b.r < SC.x0) { b.x = SC.x0 + b.r; b.vx = Math.abs(b.vx) * 0.9; AU.thud(0.08); }
        if (g[2] === -1 && b.x + b.r > SC.x1) { b.x = SC.x1 - b.r; b.vx = -Math.abs(b.vx) * 0.9; AU.thud(0.08); }
      }
    }
    const all = st.pl.filter(p => !p.dead).concat(st.gb);
    K.pairs(all, (a, b) => { const i = K.collide(a, b, 0.9); if (i > 30 && (a.ci < 0 || b.ci < 0)) { AU.thud(0.06 + i / 3000); (a.ci < 0 ? a : b).idle = 0; } });
  },
  draw(st, ctx) {
    ctx.fillStyle = '#e8f0dc'; ctx.fillRect(SC.x0, SC.y0, SC.x1 - SC.x0, SC.y1 - SC.y0);
    ctx.strokeStyle = 'rgba(80,110,60,0.35)'; ctx.lineWidth = 2; D.circle(ctx, 270, 540, 60, 'rgba(80,110,60,0.35)', 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(SC.x0, SC.y0, SC.x1 - SC.x0, SC.y1 - SC.y0);
    for (const c of this.corners) { ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[2], c[3]); ctx.lineTo(c[0] === SC.x0 || c[2] === SC.x0 ? SC.x0 : SC.x1, c[1] === SC.y0 || c[3] === SC.y0 ? SC.y0 : SC.y1); ctx.fill(); }
    st.G.forEach((g, i) => {
      const c = st.C[i].c, horiz = g[2] === 0;
      if (st.out[i]) { ctx.strokeStyle = '#888'; ctx.lineWidth = 8; } else { ctx.strokeStyle = c; ctx.lineWidth = 8; }
      ctx.beginPath(); if (horiz) { ctx.moveTo(g[0] - SC.gw, g[1]); ctx.lineTo(g[0] + SC.gw, g[1]); } else { ctx.moveTo(g[0], g[1] - SC.gw); ctx.lineTo(g[0], g[1] + SC.gw); } ctx.stroke();
      for (let k = 0; k < 3; k++) { const px = horiz ? g[0] - 20 + k * 20 : g[0] - g[2] * 22, py = horiz ? g[1] - g[3] * 22 : g[1] - 20 + k * 20; D.circle(ctx, px, py, 6, c, 2, k < st.lives[i] ? c : 'transparent'); }
    });
    for (const p of st.pl) if (!p.dead) { D.ball(ctx, p.x, p.y, p.r, st.C[p.ci].c, false); if (p.role) D.circle(ctx, p.x, p.y, 5, null, 0, '#fff'); }
    for (const b of st.gb) { D.ball(ctx, b.x, b.y, b.r, '#ffffff', false); D.circle(ctx, b.x, b.y, b.r, INK, 1.5); }
  },
  hud: st => st.lives.map(l => '♥'.repeat(Math.max(0, l)) || 'out'),
  lead: st => K.aliveIdx(st).sort((a, b) => st.lives[b] - st.lives[a])[0]
});

// ---------- 25. Flood Fill ----------
const FF = { c: 60, r: 88, s: 8.4, ox: 18, oy: 170 };
SIMS.push({
  id: 'flood', name: 'Flood Fill', caption: 'Biggest share of the cave', theme: 'paper',
  init(rng) {
    const C = FF.c, R = FF.r, N = 4, st = K.base(rng, N, { g: new Int8Array(C * R), dirty: [], full: true, n: [0, 0, 0, 0], tick: 0, still: 0, rock: rng.range(3, 5) });
    const nw = 13, nh = 19, nz = Array.from({ length: nw * nh }, () => rng()), nz2 = Array.from({ length: 31 * 45 }, () => rng());
    const smp = (arr, w, x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, s = t => t * t * (3 - 2 * t), a = arr[iy * w + ix], b = arr[iy * w + ix + 1], c = arr[(iy + 1) * w + ix], d = arr[(iy + 1) * w + ix + 1]; return K.lerp(K.lerp(a, b, s(fx)), K.lerp(c, d, s(fx)), s(fy)); };
    const g = st.g;
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const v = smp(nz, nw, x / C * (nw - 1.01), y / R * (nh - 1.01)) * 0.75 + smp(nz2, 31, x / C * 29.9, y / R * 43.9) * 0.25; g[y * C + x] = v > 0.47 ? 0 : -1; }
    for (let it = 0; it < 3; it++) { const h = Int8Array.from(g); for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { let o = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < C && yy < R && h[yy * C + xx] === 0) o++; } g[y * C + x] = o >= 5 ? 0 : o <= 2 ? -1 : h[y * C + x]; } }
    const carve = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < C && y < R && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) g[y * C + x] = 0; };
    const qs = rng.shuffle([[14, 20], [45, 20], [14, 67], [45, 67]]);
    st.sp = qs.map(([x, y]) => [x + rng.int(-6, 6), y + rng.int(-8, 8)]);
    st.sp.forEach(([x, y]) => carve(x, y, 3));
    for (let i = 1; i < N; i++) { let [x, y] = st.sp[i]; const [tx, ty] = st.sp[(i + rng.int(0, 2)) % N === i ? 0 : (i + 1) % N]; while (Math.abs(x - tx) + Math.abs(y - ty) > 0) { if (rng() < 0.5 && x !== tx) x += Math.sign(tx - x); else if (y !== ty) y += Math.sign(ty - y); else x += Math.sign(tx - x); carve(x, y, 1); } }
    st.sp.forEach(([x, y], i) => { g[y * C + x] = i + 1; st.n[i]++; });
    this.dist(st); return st;
  },
  dist(st) {
    const C = FF.c, R = FF.r; st.d = st.sp.map(([sx, sy]) => {
      const d = new Int16Array(C * R).fill(-1), q = [sy * C + sx]; d[q[0]] = 0;
      for (let h = 0; h < q.length; h++) { const i = q[h], x = i % C, y = (i / C) | 0; for (const j of [x > 0 ? i - 1 : -1, x < C - 1 ? i + 1 : -1, y > 0 ? i - C : -1, y < R - 1 ? i + C : -1]) if (j >= 0 && d[j] < 0 && st.g[j] >= 0) { d[j] = d[i] + 1; q.push(j); } }
      return d;
    });
  },
  where: st => st.sp.map(([x, y], i) => ({ i, x: FF.ox + (x + 0.5) * FF.s, y: FF.oy + (y + 0.5) * FF.s, r: 18 })),
  step(st, dt) {
    st.tick += dt * 20; if (st.tick < 1) return; st.tick -= 1;
    const C = FF.c, R = FF.r, g = st.g, rng = st.rng, N = 4, amp = st.t > 30 ? 3 : 1;
    if (st.t < 30 && (st.rock -= 1 / 20) <= 0) {
      st.rock = rng.range(3, 5);
      for (let tries = 0; tries < 200; tries++) { const i = rng.int(0, C * R - 1); if (g[i] !== -1) continue; const x = i % C, y = (i / C) | 0; if (![i - 1, i + 1, i - C, i + C].some(j => j >= 0 && j < C * R && g[j] >= 0)) continue; const r = rng.int(2, 3); for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (xx >= 0 && yy >= 0 && xx < C && yy < R && (xx - x) ** 2 + (yy - y) ** 2 <= r * r && g[yy * C + xx] === -1) { g[yy * C + xx] = 0; dirtyPush(st, yy * C + xx); } FX.burst(FF.ox + x * FF.s, FF.oy + y * FF.s, '#6b5a48', 12, 80, 0.6, 3, 150); AU.noise(0.25, 300, 0.2, 'lowpass', 1, 'rock'); this.dist(st); break; }
    }
    const fr = [[], [], [], []], ct = [];
    for (let i = 0; i < g.length; i++) {
      const o = g[i]; if (o <= 0) continue; const x = i % C, y = (i / C) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < C - 1 ? i + 1 : -1, y > 0 ? i - C : -1, y < R - 1 ? i + C : -1]) { if (j < 0) continue; const t = g[j]; if (t === 0) fr[o - 1].push(j); else if (t > 0 && t !== o) ct.push(j, o); }
    }
    const P = (o, j) => (1 + fr[o].length * 0.01) * 40 / (40 + Math.max(0, st.d[o][j]));
    let changed = 0;
    for (let o = 0; o < N; o++) { const f = fr[o]; const k = Math.min(f.length, 2 + Math.floor(f.length * 0.12)); for (let m = 0; m < k; m++) { const j = f[(rng() * f.length) | 0]; if (g[j] === 0) { g[j] = o + 1; st.n[o]++; dirtyPush(st, j); changed++; } } }
    for (let q = 0; q < ct.length; q += 2) {
      const j = ct[q], a = ct[q + 1], b = g[j]; if (b <= 0 || b === a) continue;
      const r = P(a - 1, j) / P(b - 1, j); if (r > 1 && rng() < 0.12 * (r - 1) * amp) { g[j] = a; st.n[a - 1]++; st.n[b - 1]--; dirtyPush(st, j); changed++; }
    }
    if (changed) AU.noise(0.08, 900, Math.min(0.06, changed / 300), 'lowpass', 2, 'trickle');
    st.still = changed ? 0 : st.still + 1 / 20;
    if (st.win == null && (st.still > 3 || st.t >= 45)) st.win = this.lead(st);
  },
  draw(st, ctx) {
    const cols = st.C.map(c => c.rgb), L = gridPaint(st, 'ff', FF.c, FF.r, i => { const v = st.g[i]; return v < 0 ? [74, 64, 54] : v === 0 ? [239, 231, 214] : cols[v - 1]; });
    ctx.imageSmoothingEnabled = false; ctx.drawImage(L, FF.ox, FF.oy, FF.c * FF.s, FF.r * FF.s); ctx.imageSmoothingEnabled = true;
    st.sp.forEach(([x, y], i) => D.circle(ctx, FF.ox + (x + 0.5) * FF.s, FF.oy + (y + 0.5) * FF.s, 7, '#fff', 2, st.C[i].d));
  },
  hud(st) { const tot = st.g.reduce((s, v) => s + (v >= 0 ? 1 : 0), 0) || 1; return st.n.map(n => Math.round(n / tot * 100) + '%'); },
  lead: st => st.n.indexOf(Math.max(...st.n))
});
