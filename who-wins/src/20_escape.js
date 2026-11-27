// ===================== B. Escape and survival =====================
function trailPush(b, n = 14) { (b.tr = b.tr || []).push(b.x, b.y); if (b.tr.length > n * 2) b.tr.splice(0, 2); }
function drawTrail(ctx, b, col, w) { const t = b.tr; if (!t || t.length < 4) return; ctx.lineCap = 'round'; for (let i = 2; i < t.length; i += 2) { ctx.globalAlpha = i / t.length * 0.5; D.line(ctx, t[i - 2], t[i - 1], t[i], t[i + 1], col, w * i / t.length); } ctx.globalAlpha = 1; ctx.lineCap = 'butt'; }
function dirtyPush(st, v) { if (st.dirty.length > 6000) { st.dirty.length = 0; st.full = true; } else st.dirty.push(v); }

// ---------- 9. Ring Escape ----------
SIMS.push({
  id: 'rings', name: 'Ring Escape', caption: 'First ball out of all 8 rings', theme: 'night',
  init(rng) {
    const st = K.base(rng, 4);
    st.R = []; for (let k = 0; k < 8; k++) st.R.push({ r: 58 + k * 27, ph: rng.ang(), w: rng.sign() * rng.range(0.35, 1.1), fc: null, ft: -9 });
    st.balls = [0, 1, 2, 3].map(i => { const b = K.ball(AX + (i - 1.5) * 18, AY + rng.range(-10, 10), 7, rng.range(-2.6, -0.5), 260, i); b.k = 0; return b; });
    return st;
  },
  half(st, k) { return (16 + Math.max(0, st.t - 40) * 3) / st.R[k].r; },
  gapA(st, k) { const g = st.R[k]; return g.ph + g.w * st.t; },
  step(st, dt) {
    const B = st.balls;
    for (const b of B) {
      b.vy += 300 * dt; K.move(b, dt);
      const s = Math.hypot(b.vx, b.vy); if (s < 200) K.speed(b, 200); else if (s > 430) K.speed(b, 430);
      if (b.k >= 8) continue;
      const g = st.R[b.k], dx = b.x - AX, dy = b.y - AY, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), ga = this.gapA(st, b.k), h = this.half(st, b.k);
      if (b.k > 0 && K.ringOut(b, AX, AY, st.R[b.k - 1].r)) { K.scatter(b, st.rng, 0.1); AU.blip(b.k * 2 + 2, 0.06); }
      if (Math.abs(K.angDiff(a, ga)) < h) {
        for (const e of [-h, h]) { const px = AX + Math.cos(ga + e) * g.r, py = AY + Math.sin(ga + e) * g.r; if (K.seg(b, px, py, px, py) > 1) AU.blip(b.k * 2 + 4, 0.05); }
        if (d - b.r > g.r) { b.k++; g.fc = st.C[b.ci].c; g.ft = st.t; AU.blip(10 + b.k * 2, 0.2); FX.ring(AX, AY, st.C[b.ci].c, g.r * 0.7, 0.4); if (b.k >= 8 && st.win == null) { st.win = b.ci; FX.burst(b.x, b.y, st.C[b.ci].c, 40, 300); } }
      } else if (K.ringIn(b, AX, AY, g.r)) { K.scatter(b, st.rng, 0.12); AU.blip(b.k * 2 + 3, 0.06); }
      trailPush(b, 10);
    }
    K.pairs(B, (a, b) => { if (a.k === b.k) K.collide(a, b); });
    for (const b of B) if (b.k >= 8) K.box(b, 0, 0, W, H);
  },
  draw(st, ctx) {
    ctx.lineCap = 'round';
    st.R.forEach((g, k) => {
      const ga = this.gapA(st, k), h = this.half(st, k), f = Math.max(0, 1 - (st.t - g.ft) / 0.6);
      ctx.strokeStyle = f > 0 ? g.fc : `hsl(${200 + k * 12},60%,${38 + k * 3}%)`; ctx.lineWidth = 4 + f * 3;
      ctx.beginPath(); ctx.arc(AX, AY, g.r, ga + h, ga - h + TAU); ctx.stroke();
      if (f > 0) D.glow(ctx, AX, AY, g.r * 1.2, g.fc, f * 0.3);
    });
    ctx.lineCap = 'butt';
    for (const b of st.balls) drawTrail(ctx, b, st.C[b.ci].c, b.r * 1.2);
    drawBalls(st, ctx, true);
  },
  hud: st => st.balls.map(b => b.k)
});

// ---------- 10. Last One In ----------
SIMS.push({
  id: 'lastin', name: 'Last One In', caption: 'Last ball inside the ring wins', theme: 'paper',
  init(rng) {
    const st = K.base(rng, 8, { ph: rng.ang(), w: rng.sign() * 0.55, gaps: [0], half: 0.16, second: false });
    st.balls = spread(rng, 8, 150, 40).map((p, i) => { const b = K.ball(p[0], p[1], 12, rng.ang(), 255, i); b.gone = false; return b; });
    return st;
  },
  step(st, dt) {
    const B = st.balls, R = 230;
    if (!st.second && st.t > 30) { st.second = true; st.gaps.push(Math.PI); AU.whoosh(0.15); }
    const rot = st.ph + st.w * st.t, gone = [];
    for (const b of B) {
      K.move(b, dt);
      if (b.gone) continue;
      const dx = b.x - AX, dy = b.y - AY, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const inGap = st.gaps.some(g => Math.abs(K.angDiff(a, rot + g)) < st.half);
      if (inGap) {
        for (const g of st.gaps) for (const e of [-st.half, st.half]) { const px = AX + Math.cos(rot + g + e) * R, py = AY + Math.sin(rot + g + e) * R; if (K.seg(b, px, py, px, py) > 1) AU.blip(12, 0.1); }
        if (d - b.r > R) { b.gone = true; gone.push(b.ci); st.half += 0.03; AU.whoosh(); FX.burst(b.x, b.y, st.C[b.ci].c, 12, 150); }
      } else if (K.ringIn(b, AX, AY, R)) { K.scatter(b, st.rng); AU.blip(Math.min(24, 4 + Math.floor(st.t / 3)), 0.08); }
    }
    K.pairs(B.filter(b => !b.gone), (a, b) => K.collide(a, b));
    for (const b of B) if (!b.gone) K.speed(b, 255);
    if (gone.length) K.knock(st, gone, i => -Math.hypot(B[i].x - AX, B[i].y - AY));
  },
  draw(st, ctx) {
    const rot = st.ph + st.w * st.t;
    ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round';
    const gs = st.gaps.map(g => rot + g).sort((a, b) => a - b);
    if (gs.length === 1) { ctx.beginPath(); ctx.arc(AX, AY, 234, gs[0] + st.half, gs[0] - st.half + TAU); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(AX, AY, 234, gs[0] + st.half, gs[1] - st.half); ctx.stroke(); ctx.beginPath(); ctx.arc(AX, AY, 234, gs[1] + st.half, gs[0] - st.half + TAU); ctx.stroke(); }
    ctx.lineCap = 'butt';
    for (const b of st.balls) D.ball(ctx, b.x, b.y, b.r, st.C[b.ci].c, false);
  },
  hud: st => st.balls.map(b => b.gone ? 'out' : 'in'),
  lead: st => K.aliveIdx(st).sort((a, b) => Math.hypot(st.balls[a].x - AX, st.balls[a].y - AY) - Math.hypot(st.balls[b].x - AX, st.balls[b].y - AY))[0]
});

// ---------- 11. Closing Maze ----------
const MZ = { c: 9, r: 16, cw: 56, ch: 50, ox: 18, oy: 142 };
SIMS.push({
  id: 'maze', name: 'Closing Maze', caption: 'Reach the exit before the dark', theme: 'paper',
  init(rng) {
    const { c: C, r: Rr } = MZ, st = K.base(rng, 6, { top: 0, left: 0, right: 0, ev: 7, iv: 3.6, n: 0 });
    const hw = [], vw = []; for (let r = 0; r <= Rr; r++) { hw.push(new Array(C).fill(1)); vw.push(new Array(C + 1).fill(1)); }
    const seen = new Uint8Array(C * Rr), stack = [[rng.int(0, C - 1), 0]]; seen[stack[0][1] * C + stack[0][0]] = 1;
    while (stack.length) {
      const [x, y] = stack[stack.length - 1], nb = [];
      if (x > 0 && !seen[y * C + x - 1]) nb.push([x - 1, y, 'l']); if (x < C - 1 && !seen[y * C + x + 1]) nb.push([x + 1, y, 'r']);
      if (y > 0 && !seen[(y - 1) * C + x]) nb.push([x, y - 1, 'u']); if (y < Rr - 1 && !seen[(y + 1) * C + x]) nb.push([x, y + 1, 'd']);
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny, d] = rng.pick(nb); seen[ny * C + nx] = 1; stack.push([nx, ny]);
      if (d === 'l') vw[y][x] = 0; else if (d === 'r') vw[y][x + 1] = 0; else if (d === 'u') hw[y][x] = 0; else hw[y + 1][x] = 0;
    }
    for (let r = 0; r < Rr; r++) for (let x = 1; x < C; x++) if (vw[r][x] && rng() < 0.25) vw[r][x] = 0;
    for (let r = 1; r < Rr; r++) for (let x = 0; x < C; x++) if (hw[r][x] && rng() < 0.25) hw[r][x] = 0;
    st.exit = rng.int(3, 5); hw[Rr][st.exit] = 0;
    const segs = [], X = x => MZ.ox + x * MZ.cw, Y = y => MZ.oy + y * MZ.ch;
    for (let r = 0; r <= Rr; r++) for (let x = 0; x < C; x++) if (hw[r][x]) segs.push([X(x), Y(r), X(x + 1), Y(r), r, x, 'h']);
    for (let r = 0; r < Rr; r++) for (let x = 0; x <= C; x++) if (vw[r][x]) segs.push([X(x), Y(r), X(x), Y(r + 1), r, x, 'v']);
    // shortest-path distance to the exit, used as a weak hint (balls still bounce blindly)
    const dist = new Int16Array(C * Rr).fill(-1), q = [(Rr - 1) * C + st.exit]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % C, y = (i / C) | 0, d = dist[i];
      const go = (nx, ny, open) => { if (open && nx >= 0 && ny >= 0 && nx < C && ny < Rr && dist[ny * C + nx] < 0) { dist[ny * C + nx] = d + 1; q.push(ny * C + nx); } };
      go(x - 1, y, !vw[y][x]); go(x + 1, y, !vw[y][x + 1]); go(x, y - 1, !hw[y][x]); go(x, y + 1, !hw[y + 1][x]);
    }
    st.nxt = []; st.nb = []; const ctr = (x, y) => [MZ.ox + (x + 0.5) * MZ.cw, MZ.oy + (y + 0.5) * MZ.ch];
    for (let i = 0; i < C * Rr; i++) { const x = i % C, y = (i / C) | 0; let b = [x, y + 1]; const nb = [];
      for (const [nx, ny, open] of [[x - 1, y, !vw[y][x]], [x + 1, y, !vw[y][x + 1]], [x, y - 1, !hw[y][x]], [x, y + 1, !hw[y + 1][x]]]) if (open && ny < Rr && nx >= 0 && nx < C && ny >= 0) { nb.push(ctr(nx, ny)); if (dist[ny * C + nx] === dist[i] - 1) b = [nx, ny]; }
      st.nxt.push(ctr(b[0], b[1])); st.nb.push(nb); }
    st.segs = segs; st.cs = [];
    for (let r = 0; r < Rr; r++) for (let x = 0; x < C; x++) st.cs.push(segs.filter(s => s[4] >= r - 1 && s[4] <= r + 2 && s[5] >= x - 1 && s[5] <= x + 2));
    const cols = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 6);
    st.balls = cols.map((cx, i) => K.ball(X(cx) + MZ.cw / 2, Y(0) + MZ.ch / 2, 8, rng.range(0.3, 2.8), 215, i));
    return st;
  },
  cell(b) { return [Math.floor((b.y - MZ.oy) / MZ.ch), Math.floor((b.x - MZ.ox) / MZ.cw)]; },
  step(st, dt) {
    const B = st.balls, rng = st.rng;
    if (st.win == null && (st.ev -= dt) <= 0) {
      st.n++; st.iv = Math.max(0.9, st.iv * 0.94); st.ev = st.iv;
      const p = rng();
      if (st.n > 3 && p < 0.2 && st.left < 2) st.left++; else if (st.n > 3 && p < 0.4 && st.right < 2) st.right++; else st.top++;
      AU.tone(55, 0.5, 0.25, 'sawtooth', 0.7, 'rumble'); FX.shake(3);
    }
    const dying = [];
    K.pairs(B.filter(b => !b.dead && b.y < MZ.oy + MZ.r * MZ.ch), (a, b) => K.collide(a, b));
    for (const b of B) {
      if (b.dead) continue;
      const [r0, c0] = this.cell(b), ci = K.clamp(r0, 0, MZ.r - 1) * MZ.c + K.clamp(c0, 0, MZ.c - 1);
      if (ci !== b.cc) { b.cc = ci; const nb = st.nb[ci]; b.tg = rng() < 0.16 && nb.length ? rng.pick(nb) : st.nxt[ci]; }
      const gx = b.tg[0] - b.x, gy = b.tg[1] - b.y, gl = Math.hypot(gx, gy) || 1;
      b.vx += gx / gl * 650 * dt; b.vy += gy / gl * 650 * dt; K.speed(b, 215);
      K.move(b, dt);
      const [r, c] = this.cell(b);
      if (r >= MZ.r) { if (st.win == null) { st.win = b.ci; FX.burst(b.x, b.y, st.C[b.ci].c, 40, 280); AU.chime(); } continue; }
      const segs = st.cs[K.clamp(r, 0, MZ.r - 1) * MZ.c + K.clamp(c, 0, MZ.c - 1)];
      for (const s of segs) if (K.seg(b, s[0], s[1], s[2], s[3], 1, 2.5) > 1) { K.scatter(b, rng, 0.35); AU.tone(500 + 30 * (r % 8), 0.04, 0.06, 'triangle', 0, 'wood'); }
      K.nudge(b, 0.08);
      if (r < st.top || c < st.left || c >= MZ.c - st.right) { b.dead = true; b.fall = 1; dying.push(b.ci); FX.burst(b.x, b.y, st.C[b.ci].c, 16, 120); AU.pop(0.2); }
    }
    if (dying.length) K.knock(st, dying, i => B[i].y);
    fallTick(st, dt);
  },
  draw(st, ctx) {
    const L = D.layer(st, 'maze');
    if (!st._drawn) {
      st._drawn = 1; const g = L.getContext('2d'); g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath();
      for (const s of st.segs) { g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); } g.stroke();
      const ex = MZ.ox + st.exit * MZ.cw, ey = MZ.oy + MZ.r * MZ.ch; g.fillStyle = '#30a46c'; g.fillRect(ex + 6, ey + 2, MZ.cw - 12, 6);
    }
    ctx.drawImage(L, 0, 0);
    const x0 = MZ.ox, y0 = MZ.oy, x1 = MZ.ox + MZ.c * MZ.cw, y1 = MZ.oy + MZ.r * MZ.ch, wob = k => Math.sin(st.t * 3 + k * 0.08) * 4;
    ctx.fillStyle = '#111'; ctx.beginPath();
    const ty = y0 + st.top * MZ.ch, lx = x0 + st.left * MZ.cw, rx = x1 - st.right * MZ.cw;
    ctx.moveTo(x0 - 4, y0 - 4); ctx.lineTo(x1 + 4, y0 - 4); ctx.lineTo(x1 + 4, y1 + 4);
    for (let y = y1; y >= ty; y -= 20) ctx.lineTo(rx + (st.right ? wob(y) : 0), y);
    for (let x = rx; x >= lx; x -= 20) ctx.lineTo(x, ty + (st.top ? wob(x) : 0));
    for (let y = ty; y <= y1; y += 20) ctx.lineTo(lx + (st.left ? wob(y + 99) : 0), y);
    ctx.lineTo(x0 - 4, y1 + 4); ctx.closePath(); ctx.fill();
    D.text(ctx, 'EXIT', MZ.ox + (st.exit + 0.5) * MZ.cw, y1 + 12, 11, '#30a46c', 'center', 800);
    drawBalls(st, ctx, false);
  },
  hud: st => st.balls.map(b => b.dead ? 'out' : Math.max(0, Math.floor((b.y - MZ.oy) / MZ.ch)) + 1),
  lead: st => K.aliveIdx(st).sort((a, b) => st.balls[b].y - st.balls[a].y)[0]
});

// ---------- 12. Rising Lava ----------
SIMS.push({
  id: 'lava', name: 'Rising Lava', caption: 'Climb or melt', theme: 'night', Y0: 880,
  init(rng) {
    const st = K.base(rng, 6, { lava: 1000, cam: 0, led: [] });
    st.led.push({ x: 30, w: 480, y: this.Y0, t: 0 });
    let y = this.Y0 - 95, i = 0;
    while (y > -14000) {
      const h = this.Y0 - y, n = h < 5000 ? 2 : rng() < 0.6 ? 1 : 2, w0 = Math.max(70, 150 - h * 0.006);
      const xs = n === 2 ? [rng.range(40, 230 - w0 / 2), rng.range(270, 500 - w0)] : [rng.range(40, 500 - w0)];
      for (const x of xs) { const p = rng(); st.led.push({ x, w: rng.range(w0 * 0.8, w0 * 1.2), y, t: p < 0.12 ? 2 : p < 0.32 ? 1 : 0, gone: false, crT: -1 }); }
      y -= Math.min(150, 88 + h * 0.004) * rng.range(0.85, 1.15); i++;
    }
    st.balls = [0, 1, 2, 3, 4, 5].map(i => { const b = K.ball(70 + i * 80, this.Y0 - 10, 10, 0, 0, i); b.vy = -rng.range(300, 820); b.tx = b.x; b.top = b.y; return b; });
    return st;
  },
  pickTarget(st, b) {
    const rng = st.rng; let best = null, bs = 1e9;
    for (const l of st.led) { if (l.gone || l.y > b.y - 25 || l.y < b.y - 215) continue; const cx = l.x + l.w / 2, s = Math.abs(cx - b.x) + rng.range(0, 90); if (s < bs) { bs = s; best = l; } }
    b.tx = best ? best.x + best.w * rng.range(0.2, 0.8) : K.clamp(b.x + rng.range(-120, 120), 40, 500);
  },
  step(st, dt) {
    const B = st.balls, dying = [];
    st.lava -= (30 + 4.6 * st.t) * dt;
    for (const l of st.led) if (l.crT >= 0 && !l.gone && st.t > l.crT) { l.gone = true; FX.burst(l.x + l.w / 2, l.y - st.cam, '#a0703c', 8, 60, 0.6, 3, 200); }
    for (const b of B) {
      if (b.dead) continue;
      const py = b.y; b.vy += 1500 * dt;
      b.vx += K.clamp((b.tx - b.x) * 3 - b.vx, -1400 * dt, 1400 * dt); b.vx = K.clamp(b.vx, -280, 280);
      K.move(b, dt);
      if (b.x < 40) { b.x = 40; b.vx = Math.abs(b.vx); } if (b.x > 500) { b.x = 500; b.vx = -Math.abs(b.vx); }
      if (b.vy > 0) for (const l of st.led) {
        if (l.gone || py + b.r > l.y + 0.5 || b.y + b.r < l.y || b.x < l.x - 4 || b.x > l.x + l.w + 4) continue;
        b.y = l.y - b.r; b.vy = l.t === 2 ? -1230 : -830;
        if (l.t === 1 && l.crT < 0) l.crT = st.t + 0.25;
        AU.tone(AU.hz(Math.min(24, 4 + (this.Y0 - b.y) / 250)), 0.12, 0.08, l.t === 2 ? 'square' : 'sine', 1.6, 'boing' + b.ci);
        this.pickTarget(st, b); break;
      }
      b.top = Math.min(b.top, b.y);
      if (b.y > st.lava - 4) { b.dead = true; b.fall = 1; dying.push(b.ci); FX.burst(b.x, b.y - st.cam, '#ff7a1a', 26, 220, 0.7, 3, -200); AU.noise(0.4, 2500, 0.25, 'highpass', 1, 'sizzle'); }
    }
    if (dying.length) K.knock(st, dying, i => -B[i].y);
    fallTick(st, dt);
    const alive = B.filter(b => !b.dead); if (alive.length) { const hy = Math.min(...alive.map(b => b.y)); const tc = Math.min(0, Math.max(hy - 430, Math.min(st.lava - 860, hy - 250))); st.cam += (tc - st.cam) * Math.min(1, 3 * dt); }
  },
  draw(st, ctx) {
    const cam = st.cam;
    ctx.fillStyle = '#151a22'; ctx.fillRect(26, 0, 488, H);
    ctx.strokeStyle = '#2a3140'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(28, 0); ctx.lineTo(28, H); ctx.moveTo(512, 0); ctx.lineTo(512, H); ctx.stroke();
    for (const l of st.led) {
      const y = l.y - cam; if (l.gone || y < -20 || y > H + 20) continue;
      ctx.fillStyle = l.t === 2 ? '#3ddc84' : l.t === 1 ? (l.crT >= 0 ? '#5e4024' : '#8a6038') : '#5b6b86';
      ctx.fillRect(l.x, y, l.w, 8);
      if (l.t === 2) { ctx.fillStyle = '#9ff5c4'; ctx.fillRect(l.x + l.w / 2 - 10, y - 5, 20, 5); }
      if (l.t === 1) { ctx.fillStyle = '#151a22'; for (let x = l.x + 14; x < l.x + l.w; x += 22) ctx.fillRect(x, y, 2, 8); }
    }
    for (const b of st.balls) { if (b.dead && !(b.fall > 0)) continue; ctx.globalAlpha = b.dead ? b.fall : 1; D.ball(ctx, b.x, b.y - cam, b.r, st.C[b.ci].c, true); ctx.globalAlpha = 1; }
    const ly = st.lava - cam;
    if (ly < H) {
      const g = ctx.createLinearGradient(0, ly, 0, ly + 200); g.addColorStop(0, '#ffb23a'); g.addColorStop(0.15, '#ff5a1a'); g.addColorStop(1, '#7a1408');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 18) ctx.lineTo(x, ly + Math.sin(x * 0.04 + st.t * 3) * 5 + Math.sin(x * 0.11 - st.t * 2) * 3);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); D.glow(ctx, W / 2, ly, 300, '#ff6a1a', 0.35);
    }
    // height meter
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(524, 140, 6, 800);
    const top = Math.max(1, ...st.balls.map(b => this.Y0 - b.top));
    for (const b of st.balls) { const y = 940 - 800 * (this.Y0 - b.y) / Math.max(1200, top * 1.1); ctx.fillStyle = st.C[b.ci].c; ctx.globalAlpha = b.dead ? 0.3 : 1; ctx.fillRect(520, y - 2, 14, 4); ctx.globalAlpha = 1; }
  },
  hud(st) { return st.balls.map(b => Math.max(0, Math.round((this.Y0 - (b.dead ? b.top : b.y)) / 50)) + 'm'); },
  lead: st => K.aliveIdx(st).sort((a, b) => st.balls[a].y - st.balls[b].y)[0]
});

// ---------- 13. Crumbling Floor ----------
SIMS.push({
  id: 'crumble', name: 'Crumbling Floor', caption: 'Tiles break behind you', theme: 'paper', S: 19,
  init(rng) {
    const st = K.base(rng, 6, { tiles: new Map() }), s = this.S;
    for (let r = -14; r <= 14; r++) for (let q = -14; q <= 14; q++) {
      const x = AX + s * Math.sqrt(3) * (q + r / 2), y = AY + s * 1.5 * r;
      if (Math.hypot(x - AX, y - AY) < 236) st.tiles.set(q * 100 + r, { x, y, s: 3, f: 0, hue: rng.int(0, 3) });
    }
    st.balls = spread(rng, 6, 160, 50).map((p, i) => { const b = K.ball(p[0], p[1], 9, rng.ang(), 100, i); b.tile = this.key(b.x, b.y); b.hole = 0; return b; });
    return st;
  },
  key(x, y) {
    const s = this.S, px = x - AX, py = y - AY; let q = (Math.sqrt(3) / 3 * px - py / 3) / s, r = (2 / 3 * py) / s, z = -q - r;
    let rq = Math.round(q), rr = Math.round(r), rz = Math.round(z); const dq = Math.abs(rq - q), dr = Math.abs(rr - r), dz = Math.abs(rz - z);
    if (dq > dr && dq > dz) rq = -rr - rz; else if (dr > dz) rr = -rq - rz;
    return rq * 100 + rr;
  },
  step(st, dt) {
    const B = st.balls, dying = [];
    for (const b of B) {
      if (b.dead) continue;
      K.move(b, dt); if (K.ringIn(b, AX, AY, 248)) K.scatter(b, st.rng, 0.2);
      const k = this.key(b.x, b.y);
      if (k !== b.tile) { const old = st.tiles.get(b.tile); if (old && old.s > 0) { old.s = st.t > 30 ? 0 : old.s - 1; if (old.s === 0) { old.f = st.t; AU.tone(330, 0.12, 0.1, 'triangle', 0.5, 'clink'); } else AU.tone(1800, 0.03, 0.06, 'square', 0, 'crk'); } b.tile = k; }
      const t = st.tiles.get(k);
      if (!t || t.s === 0) { b.hole += dt; if (b.hole > 0.1) { b.dead = true; b.fall = 1; dying.push(b.ci); AU.tone(500, 0.5, 0.15, 'sine', 0.3, 'fall'); } } else b.hole = 0;
    }
    K.pairs(B, (a, b) => K.collide(a, b));
    for (const b of B) if (!b.dead) K.speed(b, 100);
    if (dying.length) K.knock(st, dying);
    for (const b of B) if (b.dead && b.fall > 0) b.fall -= dt * 1.6;
  },
  draw(st, ctx) {
    const s = this.S, hues = ['#f2c9b8', '#c9dcf0', '#cfe8cf', '#efe0b0'], hex = (x, y, k) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * s * k, y + Math.sin(a) * s * k); } ctx.closePath(); };
    D.circle(ctx, AX, AY, 250, '#cdbf9f', 3, '#2a2420');
    for (const t of st.tiles.values()) {
      if (t.s === 0) { const k = (st.t - t.f) / 0.4; if (k > 1 || t.f === 0) continue; ctx.globalAlpha = 1 - k; hex(t.x, t.y + k * 10, 0.94 * (1 - k * 0.5)); ctx.fillStyle = '#b8a890'; ctx.fill(); ctx.globalAlpha = 1; continue; }
      hex(t.x, t.y, 0.94); ctx.fillStyle = t.s === 3 ? hues[t.hue] : t.s === 2 ? shade(hues[t.hue].replace(/^#/, '#'), -0.12) : '#cbb894'; ctx.fill();
      if (t.s === 1) { ctx.strokeStyle = '#8a6c4a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(t.x - 8, t.y - 4); ctx.lineTo(t.x + 1, t.y + 2); ctx.lineTo(t.x + 7, t.y - 6); ctx.moveTo(t.x + 1, t.y + 2); ctx.lineTo(t.x - 2, t.y + 9); ctx.stroke(); }
    }
    drawBalls(st, ctx, false);
  },
  hud(st) { return st.balls.map(b => b.dead ? 'out' : 'on'); },
  lead: st => K.aliveIdx(st)[0]
});

// ---------- 14. Musical Sockets ----------
SIMS.push({
  id: 'sockets', name: 'Musical Sockets', caption: 'When the music stops, find a cup', theme: 'paper',
  init(rng) {
    const st = K.base(rng, 8, { mode: 'music', mt: rng.range(3, 6), round: 0, ph: rng.ang(), rot: 0, note: 0, nt: 0, socks: [] });
    st.balls = spread(rng, 8, 150, 45).map((p, i) => { const b = K.ball(p[0], p[1], 14, rng.ang(), 190, i); b.seat = -1; return b; });
    this.mkSocks(st); return st;
  },
  mkSocks(st) { const n = st.balls.filter(b => !b.dead).length - 1; st.socks = Array.from({ length: n }, (_, i) => ({ a: i * TAU / n, occ: -1 })); },
  sp(st, s) { const a = s.a + st.ph + st.rot; return [AX + Math.cos(a) * 214, AY + Math.sin(a) * 214]; },
  step(st, dt) {
    const B = st.balls, rng = st.rng, alive = B.filter(b => !b.dead);
    if (st.mode === 'music') {
      st.rot += 0.35 * dt;
      if ((st.nt -= dt) <= 0) { st.nt = 0.2; st.note = (st.note * 7 + 3) % 11; AU.pluck(8 + st.note, 0.1); }
      for (const b of alive) { K.move(b, dt); if (K.ringIn(b, AX, AY, 240)) K.scatter(b, rng); }
      K.pairs(alive, (a, b) => K.collide(a, b)); for (const b of alive) K.speed(b, 190);
      if ((st.mt -= dt) <= 0) { st.mode = 'race'; st.rt = 0; AU.thud(0.4); }
    } else if (st.mode === 'race') {
      st.rt += dt;
      for (const b of alive) {
        if (b.seat >= 0) continue;
        let best = null, bd = 1e9; for (const s of st.socks) { if (s.occ >= 0) continue; const [x, y] = this.sp(st, s), d = Math.hypot(x - b.x, y - b.y); if (d < bd) { bd = d; best = s; } }
        if (!best) continue;
        const [x, y] = this.sp(st, best), dx = x - b.x, dy = y - b.y, l = Math.hypot(dx, dy) || 1, k = Math.min(1, 6 * dt);
        b.vx += (dx / l * 360 - b.vx) * k; b.vy += (dy / l * 360 - b.vy) * k; K.move(b, dt); K.ringIn(b, AX, AY, 240, 0.3);
        if (l < 12) { best.occ = b.ci; b.seat = st.socks.indexOf(best); b.x = x; b.y = y; b.vx = b.vy = 0; AU.blip(14, 0.15); FX.ring(x, y, st.C[b.ci].c, 20); }
      }
      K.pairs(alive.filter(b => b.seat < 0), (a, b) => K.collide(a, b, 0.6));
      const free = st.socks.filter(s => s.occ < 0).length, lost = alive.filter(b => b.seat < 0);
      if (free === 0 || st.rt > 6) {
        let out = lost;
        if (free > 0) { lost.sort((a, b) => this.near(st, b) - this.near(st, a)); out = lost.slice(0, lost.length - free); }
        out.forEach(b => { b.dead = true; b.fall = 1; FX.burst(b.x, b.y, st.C[b.ci].c, 22, 200); });
        AU.boom(0.25); K.knock(st, out.map(b => b.ci)); st.mode = 'pause'; st.pt = 1.2;
      }
    } else if (st.mode === 'pause') {
      if ((st.pt -= dt) <= 0 && st.win == null) {
        st.round++; this.mkSocks(st); st.mode = 'music'; st.mt = Math.max(1.5, rng.range(3, 6) * Math.pow(0.85, st.round));
        for (const b of alive) { b.seat = -1; const a = Math.atan2(AY - b.y, AX - b.x) + rng.range(-0.8, 0.8); b.vx = Math.cos(a) * 190; b.vy = Math.sin(a) * 190; }
      }
    }
    fallTick(st, dt);
  },
  near(st, b) { let bd = 1e9; for (const s of st.socks) if (s.occ < 0) { const [x, y] = this.sp(st, s); bd = Math.min(bd, Math.hypot(x - b.x, y - b.y)); } return bd; },
  draw(st, ctx) {
    D.circle(ctx, AX, AY, 242, INK, 5, st.mode === 'music' ? '#fbf6ea' : '#e0d6c2');
    for (const s of st.socks) { const [x, y] = this.sp(st, s); D.circle(ctx, x, y, 17, st.mode === 'music' ? '#b9ab90' : INK, 3, s.occ >= 0 ? rgba(st.C[s.occ].c, 0.35) : (st.mode === 'music' ? '#efe6d2' : '#fff')); }
    drawBalls(st, ctx, false);
    D.text(ctx, st.mode === 'music' ? '♪ ♫ ♪' : st.mode === 'race' ? 'MUSIC STOPPED!' : '', W / 2, AY + 290, 20, st.mode === 'music' ? '#b9ab90' : '#e5484d', 'center', 900);
  },
  hud: st => st.balls.map(b => b.dead ? 'out' : b.seat >= 0 ? '✓' : '·'),
  lead: st => K.aliveIdx(st)[0]
});

// ---------- 15. Light Cycles ----------
const LC = { c: 60, r: 90, s: 8.5, ox: 15, oy: 168 };
SIMS.push({
  id: 'cycles', name: 'Light Cycles', caption: 'Don’t hit a trail', theme: 'night',
  init(rng) {
    const st = K.base(rng, 6, { g: new Int8Array(LC.c * LC.r), acc: 0, dirty: [], full: true, vis: new Int32Array(LC.c * LC.r), stamp: 0 });
    const starts = rng.shuffle([[3, 22, 1, 0], [3, 67, 1, 0], [56, 22, -1, 0], [56, 67, -1, 0], [30, 3, 0, 1], [30, 86, 0, -1]]);
    st.rd = starts.map((s, i) => ({ x: s[0], y: s[1], dx: s[2], dy: s[3], ci: i, dead: false, dt: 0, len: 1 }));
    st.rd.forEach(r => { st.g[r.y * LC.c + r.x] = r.ci + 1; });
    return st;
  },
  where: st => st.rd.map(r => ({ i: r.ci, x: LC.ox + (r.x + 0.5) * LC.s, y: LC.oy + (r.y + 0.5) * LC.s, r: 10 })),
  free(st, x, y) { return x >= 0 && y >= 0 && x < LC.c && y < LC.r && st.g[y * LC.c + x] === 0; },
  space(st, x, y) {
    if (!this.free(st, x, y)) return 0;
    const s = ++st.stamp, q = [y * LC.c + x]; st.vis[q[0]] = s; let n = 0;
    while (n < q.length && q.length < 350) { const i = q[n++], cx = i % LC.c, cy = (i / LC.c) | 0; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + ox, ny = cy + oy; if (this.free(st, nx, ny)) { const j = ny * LC.c + nx; if (st.vis[j] !== s) { st.vis[j] = s; q.push(j); } } } }
    return q.length;
  },
  step(st, dt) {
    const rng = st.rng; st.acc += dt * (15 + 0.7 * st.t);
    for (const r of st.rd) if (r.dead && r.dt && st.t - r.dt > 10 && !r.cl) { r.cl = 1; for (let i = 0; i < st.g.length; i++) if (st.g[i] === r.ci + 1) st.g[i] = 0; st.full = true; }
    while (st.acc >= 1) {
      st.acc -= 1;
      const order = rng.shuffle(st.rd.filter(r => !r.dead)), dying = [];
      for (const r of order) {
        const L = [r.dy, -r.dx], Rt = [-r.dy, r.dx];
        const ahead = this.free(st, r.x + r.dx, r.y + r.dy);
        let turn = null;
        if (!ahead || rng() < 0.035) {
          const sl = this.space(st, r.x + L[0], r.y + L[1]), sr = this.space(st, r.x + Rt[0], r.y + Rt[1]), sa = ahead ? this.space(st, r.x + r.dx, r.y + r.dy) : 0;
          const m = Math.max(sl, sr); if (m > 0 && (!ahead || m >= sa)) turn = sl > sr ? L : sr > sl ? Rt : rng() < 0.5 ? L : Rt;
        } else if (st.t % 0.5 < dt * 2) {
          const sa = this.space(st, r.x + r.dx, r.y + r.dy);
          if (sa < 120) { const sl = this.space(st, r.x + L[0], r.y + L[1]), sr = this.space(st, r.x + Rt[0], r.y + Rt[1]); if (Math.max(sl, sr) > sa * 1.5) turn = sl > sr ? L : Rt; }
        }
        if (turn) { r.dx = turn[0]; r.dy = turn[1]; }
        const nx = r.x + r.dx, ny = r.y + r.dy;
        if (!this.free(st, nx, ny)) { r.dead = true; r.dt = st.t || 0.001; dying.push(r.ci); FX.burst(LC.ox + (r.x + 0.5) * LC.s, LC.oy + (r.y + 0.5) * LC.s, st.C[r.ci].c, 30, 260); AU.zap(0.2); continue; }
        r.x = nx; r.y = ny; r.len++; st.g[ny * LC.c + nx] = r.ci + 1; dirtyPush(st, ny * LC.c + nx);
      }
      if (dying.length) K.knock(st, dying);
      if (st.win != null) break;
    }
  },
  draw(st, ctx) {
    const L = D.layer(st, 'lc', LC.c, LC.r), g = L.getContext('2d');
    const paint = i => { const v = st.g[i]; g.fillStyle = v ? st.C[v - 1].c : '#0c1016'; g.fillRect(i % LC.c, (i / LC.c) | 0, 1, 1); };
    if (st.full) { st.full = false; st.dirty.length = 0; for (let i = 0; i < st.g.length; i++) paint(i); } else { for (const i of st.dirty) paint(i); st.dirty.length = 0; }
    ctx.fillStyle = '#0c1016'; ctx.fillRect(LC.ox, LC.oy, LC.c * LC.s, LC.r * LC.s);
    ctx.strokeStyle = 'rgba(80,120,160,0.08)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= LC.c; x += 5) { ctx.moveTo(LC.ox + x * LC.s, LC.oy); ctx.lineTo(LC.ox + x * LC.s, LC.oy + LC.r * LC.s); }
    for (let y = 0; y <= LC.r; y += 5) { ctx.moveTo(LC.ox, LC.oy + y * LC.s); ctx.lineTo(LC.ox + LC.c * LC.s, LC.oy + y * LC.s); } ctx.stroke();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(L, LC.ox, LC.oy, LC.c * LC.s, LC.r * LC.s); ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = '#3a5a7a'; ctx.lineWidth = 2; ctx.strokeRect(LC.ox, LC.oy, LC.c * LC.s, LC.r * LC.s);
    for (const r of st.rd) if (!r.dead) { const x = LC.ox + (r.x + 0.5) * LC.s, y = LC.oy + (r.y + 0.5) * LC.s; D.glow(ctx, x, y, 22, st.C[r.ci].c); D.circle(ctx, x, y, 4, null, 0, '#fff'); }
  },
  hud: st => st.rd.map(r => r.dead ? 'out' : r.len),
  lead: st => K.aliveIdx(st).sort((a, b) => st.rd[b].len - st.rd[a].len)[0]
});
