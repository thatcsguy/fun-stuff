// ===================== A. Arena brawls =====================
const AX = 270, AY = 548, AR = 255; // shared circular arena
const BX0 = 22, BY0 = 140, BX1 = 518, BY1 = 938; // shared box arena
function spread(rng, n, R, minD, cx = AX, cy = AY) { // n non-overlapping points in a disc
  const pts = [];
  for (let k = 0; pts.length < n && k < 5000; k++) {
    const a = rng.ang(), r = R * Math.sqrt(rng()), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (pts.every(p => Math.hypot(p[0] - x, p[1] - y) > minD)) pts.push([x, y]);
  }
  while (pts.length < n) pts.push([cx + rng.range(-R, R) * 0.7, cy + rng.range(-R, R) * 0.7]);
  return pts;
}
function spreadBox(rng, n, minD, x0 = BX0 + 30, y0 = BY0 + 30, x1 = BX1 - 30, y1 = BY1 - 30) {
  const pts = [];
  for (let k = 0; pts.length < n && k < 5000; k++) { const x = rng.range(x0, x1), y = rng.range(y0, y1); if (pts.every(p => Math.hypot(p[0] - x, p[1] - y) > minD)) pts.push([x, y]); }
  while (pts.length < n) pts.push([rng.range(x0, x1), rng.range(y0, y1)]);
  return pts;
}
function drawBalls(st, ctx, night, extra) {
  for (const b of st.balls) {
    if (b.dead && !(b.fall > 0)) continue;
    const s = b.dead ? Math.max(0, b.fall) : 1;
    if (s <= 0) continue;
    ctx.globalAlpha = b.dead ? s : 1;
    D.ball(ctx, b.x, b.y, b.r * s, st.C[b.ci].c, night);
    if (extra) extra(b);
    ctx.globalAlpha = 1;
  }
}
function fallTick(st, dt, rate = 2) { for (const b of st.balls) if (b.dead && b.fall > 0) b.fall -= dt * rate; }

// ---------- 1. Tether Cutters ----------
SIMS.push({
  id: 'tether', name: 'Tether Cutters', caption: 'Last ball with a thread wins', theme: 'paper',
  init(rng) {
    const n = rng.int(3, 5), st = K.base(rng, n, { cuts: [], grey: false, cd: {} });
    const pts = spread(rng, n, 140, 90);
    st.balls = pts.map((p, i) => {
      const b = K.ball(p[0], p[1], 12, rng.ang(), 240, i); b.th = []; b.decay = 0;
      const a0 = Math.atan2(p[1] - AY, p[0] - AX);
      for (let k = 0; k < 16; k++) { const a = a0 + (k - 7.5) * 0.15; b.th.push({ x: AX + Math.cos(a) * AR, y: AY + Math.sin(a) * AR }); }
      return b;
    });
    return st;
  },
  step(st, dt) {
    const B = st.balls; st.grey = st.t > 30;
    for (const b of B) {
      if (b.dead) continue;
      K.move(b, dt);
      if (K.ringIn(b, AX, AY, AR)) {
        K.scatter(b, st.rng);
        if (!st.grey) { const a = Math.atan2(b.y - AY, b.x - AX); for (let k = -2; k <= 2 && b.th.length < 90; k++) b.th.push({ x: AX + Math.cos(a + k * 0.05) * AR, y: AY + Math.sin(a + k * 0.05) * AR }); AU.pluck(Math.min(24, 4 + b.th.length / 4)); }
      }
    }
    K.pairs(B, (a, b) => { if (K.collide(a, b) > 1) AU.blip(3, 0.1); });
    for (const b of B) if (!b.dead) K.speed(b, 240);
    // cutting: a ball's body crossing another ball's thread (away from that ball's hub)
    for (const a of B) {
      if (a.dead) continue;
      for (const o of B) {
        if (o === a || o.dead) continue;
        const hub = a.r + o.r + 5, key = a.ci * 8 + o.ci;
        if (st.cd[key] > st.t) continue;
        for (let k = o.th.length - 1; k >= 0; k--) {
          const th = o.th[k], [d, t, cx, cy] = K.segClosest(a.x, a.y, o.x, o.y, th.x, th.y);
          if (d < a.r && t > 0.3 && Math.hypot(cx - o.x, cy - o.y) > hub) {
            st.cd[key] = st.t + 0.03;
            st.cuts.push({ ax: th.x, ay: th.y, bx: cx, by: cy, ci: o.ci, t: st.t }); o.th.splice(k, 1); AU.snip(); break;
          }
        }
      }
    }
    // late game: threads decay so it always ends
    if (st.t > 50) for (const b of B) if (!b.dead && (b.decay -= dt) <= 0) { b.decay = 0.5; const th = b.th.shift(); if (th) st.cuts.push({ ax: th.x, ay: th.y, bx: b.x, by: b.y, ci: b.ci, t: st.t }); }
    const dying = [];
    for (const b of B) if (!b.dead && b.th.length === 0) { b.dead = true; b.fall = 1; dying.push(b.ci); FX.burst(b.x, b.y, st.C[b.ci].c, 20); AU.pop(); }
    if (dying.length) K.knock(st, dying);
    fallTick(st, dt);
    if (st.cuts.length && st.t - st.cuts[0].t > 0.7) st.cuts.shift();
  },
  draw(st, ctx) {
    D.circle(ctx, AX, AY, AR, st.grey ? '#a9a49a' : GOLD, 3);
    for (const b of st.balls) {
      if (b.dead) continue;
      ctx.strokeStyle = rgba(st.C[b.ci].c, 0.75); ctx.lineWidth = 1.2; ctx.beginPath();
      for (const th of b.th) { ctx.moveTo(b.x, b.y); ctx.lineTo(th.x, th.y); }
      ctx.stroke();
      ctx.fillStyle = st.C[b.ci].c; for (const th of b.th) ctx.fillRect(th.x - 1.5, th.y - 1.5, 3, 3);
    }
    ctx.setLineDash([4, 4]);
    for (const c of st.cuts) {
      const k = Math.min(1, (st.t - c.t) / 0.6); ctx.globalAlpha = 1 - k; ctx.strokeStyle = st.C[c.ci].c; ctx.lineWidth = 1.2;
      const s = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7; ctx.beginPath(); ctx.moveTo(c.ax, c.ay); ctx.lineTo(c.ax + (c.bx - c.ax) * s, c.ay + (c.by - c.ay) * s); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    drawBalls(st, ctx, false);
    if (st.grey) D.text(ctx, 'The wall stopped giving threads', W / 2, AY + AR + 40, 15, '#8a7f6c', 'center', 700);
  },
  hud: st => st.balls.map(b => b.th.length),
  lead: st => K.aliveIdx(st).sort((a, b) => st.balls[b].th.length - st.balls[a].th.length)[0]
});

// ---------- 2. Number Brawl ----------
SIMS.push({
  id: 'brawl', name: 'Number Brawl', caption: 'Bigger number steals. Last one wins', theme: 'night',
  init(rng) {
    const st = K.base(rng, 6, { cd: {} });
    st.balls = spreadBox(rng, 6, 90).map((p, i) => { const b = K.ball(p[0], p[1], 20, rng.ang(), 250, i); b.n = 10; b.pz = 0; return b; });
    st.balls.forEach(b => this.size(b));
    return st;
  },
  size(b) { b.r = 9 + 3.6 * Math.sqrt(Math.max(1, b.n)); b.m = b.r * b.r; b.spd = Math.max(140, 290 - 2.2 * b.n); },
  step(st, dt) {
    const late = st.t > 40, B = st.balls;
    for (const b of B) {
      if (b.dead) continue; K.move(b, dt);
      if (K.box(b, BX0, BY0, BX1, BY1)) { K.nudge(b); K.scatter(b, st.rng, 0.05); if (!late) { b.n++; b.pz = 1; this.size(b); AU.coin(0.06); } else if (st.t > 55) { b.n--; b.pz = 1; this.size(b); } }
      b.pz = Math.max(0, b.pz - dt * 4);
    }
    K.pairs(B, (a, b) => {
      if (K.collide(a, b) < 1) return;
      const key = a.ci * 8 + b.ci; if (st.cd[key] > st.t) return; st.cd[key] = st.t + 0.15;
      let big = a.n > b.n ? a : b, sm = big === a ? b : a;
      if (a.n === b.n) { if (!late) return; if (st.rng() < 0.5) [big, sm] = [sm, big]; }
      const amt = Math.min(sm.n, Math.max(1, Math.round((late ? 0.4 : 0.2) * big.n)));
      big.n += amt; sm.n -= amt; big.pz = sm.pz = 1; this.size(big); this.size(sm);
      AU.thud(0.15 + amt / 40); FX.burst((a.x + b.x) / 2, (a.y + b.y) / 2, st.C[big.ci].c, 6 + amt, 160);
    });
    const dying = [];
    for (const b of B) { if (b.dead) continue; K.speed(b, b.spd); if (b.n <= 0) { b.dead = true; b.fall = 1; dying.push(b.ci); FX.burst(b.x, b.y, st.C[b.ci].c, 26, 260); AU.pop(); } }
    if (dying.length) K.knock(st, dying);
    fallTick(st, dt);
  },
  draw(st, ctx) {
    ctx.strokeStyle = st.t > 40 ? '#5a2a2a' : '#2c3342'; ctx.lineWidth = 3; ctx.strokeRect(BX0, BY0, BX1 - BX0, BY1 - BY0);
    drawBalls(st, ctx, true, b => { if (!b.dead) D.text(ctx, String(b.n), b.x, b.y + 1, b.r * (0.85 + b.pz * 0.35), '#fff', 'center', 900); });
  },
  hud: st => st.balls.map(b => b.n)
});

// ---------- 3. Blade Dancers ----------
const BLADES = [
  { nm: 'Swords', bl: [{ o: 0, len: 60, w: 5 }], spin: 3.2, dmg: 9 },
  { nm: 'Twin daggers', bl: [{ o: 0, len: 34, w: 4 }, { o: Math.PI, len: 34, w: 4 }], spin: 5.5, dmg: 6 },
  { nm: 'Hammers', bl: [{ o: 0, len: 44, w: 13 }], spin: 2.3, dmg: 15 },
  { nm: 'Spiked shields', bl: [{ o: 0, len: 40, w: 6 }, { o: 2.1, len: 20, w: 12 }, { o: -2.1, len: 20, w: 12 }], spin: 4, dmg: 7 }
];
SIMS.push({
  id: 'blades', name: 'Blade Dancers', caption: 'Spinning blades. Last one alive', theme: 'night',
  init(rng) {
    const st = K.base(rng, 4, { wp: rng.pick(BLADES), cd: {} });
    st.balls = spread(rng, 4, 150, 120).map((p, i) => { const b = K.ball(p[0], p[1], 17, rng.ang(), 190, i); b.hp = 100; b.ang = rng.ang(); b.dir = rng.sign(); b.grow = 1; b.hit = 0; return b; });
    return st;
  },
  blades(st, b) { return st.wp.bl.map(q => { const a = b.ang + q.o, c = Math.cos(a), s = Math.sin(a), L = q.len * b.grow; return { ax: b.x + c * b.r * 0.8, ay: b.y + s * b.r * 0.8, bx: b.x + c * (b.r + L), by: b.y + s * (b.r + L), w: q.w }; }); },
  step(st, dt) {
    const B = st.balls, mult = st.t > 30 ? 1.5 : 1, dm = (st.t > 45 ? 4 : st.t > 30 ? 2 : 1) * 1.5;
    for (const b of B) { if (b.dead) continue; K.move(b, dt); if (K.ringIn(b, AX, AY, AR)) { K.scatter(b, st.rng); AU.blip(2, 0.06); } b.ang += st.wp.spin * b.dir * mult * dt; b.hit = Math.max(0, b.hit - dt * 4); }
    K.pairs(B, (a, b) => K.collide(a, b));
    const bl = B.map(b => b.dead ? null : this.blades(st, b));
    for (const a of B) {
      if (a.dead) continue;
      for (const o of B) {
        if (o === a || o.dead) continue;
        for (const s of bl[a.ci]) {
          const [d] = K.segClosest(o.x, o.y, s.ax, s.ay, s.bx, s.by);
          const key = a.ci * 8 + o.ci;
          if (d < o.r + s.w / 2 && !(st.cd[key] > st.t)) {
            st.cd[key] = st.t + 0.45; o.hp -= st.wp.dmg * dm; o.hit = 1; a.grow = Math.min(1.8, a.grow * 1.05);
            const nx = o.x - a.x, ny = o.y - a.y, l = Math.hypot(nx, ny) || 1; o.vx = nx / l * 190; o.vy = ny / l * 190;
            FX.burst(o.x, o.y, st.C[a.ci].c, 10, 220); AU.noise(0.08, 3000, 0.18, 'bandpass', 3, 'slice'); FX.shake(4);
          }
        }
      }
    }
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      if (!bl[i] || !bl[j]) continue; const key = 100 + i * 8 + j; if (st.cd[key] > st.t) continue;
      let hit = null;
      for (const s of bl[i]) for (const u of bl[j]) {
        if (K.segX(s.ax, s.ay, s.bx, s.by, u.ax, u.ay, u.bx, u.by)) hit = [(s.bx + u.bx) / 2, (s.by + u.by) / 2];
        else { const [d, , cx, cy] = K.segClosest(u.bx, u.by, s.ax, s.ay, s.bx, s.by); if (d < (s.w + u.w) / 2) hit = [cx, cy]; }
      }
      if (hit) { st.cd[key] = st.t + 0.3; B[i].dir *= -1; B[j].dir *= -1; FX.burst(hit[0], hit[1], '#ffe9a8', 12, 260, 0.35, 2); AU.ting(); }
    }
    const dying = [];
    for (const b of B) { if (b.dead) continue; K.speed(b, 190); if (b.hp <= 0) { b.dead = true; b.fall = 1; dying.push(b.ci); FX.burst(b.x, b.y, st.C[b.ci].c, 30, 280); AU.boom(0.3); } }
    if (dying.length) K.knock(st, dying, i => B[i].hp);
    fallTick(st, dt);
  },
  draw(st, ctx) {
    D.circle(ctx, AX, AY, AR, st.t > 30 ? '#7a3040' : '#3a4256', 3);
    for (const b of st.balls) {
      if (b.dead) continue; const col = st.C[b.ci].c;
      for (const s of this.blades(st, b)) { ctx.lineCap = 'round'; D.line(ctx, s.ax, s.ay, s.bx, s.by, rgba(col, 0.25), s.w + 6); D.line(ctx, s.ax, s.ay, s.bx, s.by, shade(col, 0.6), s.w); }
      ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, 0, TAU); ctx.stroke();
      ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, b.hp) / 100); ctx.stroke();
    }
    drawBalls(st, ctx, true, b => { if (b.hit > 0) D.circle(ctx, b.x, b.y, b.r, null, 0, `rgba(255,255,255,${b.hit * 0.7})`); });
    D.text(ctx, st.wp.nm + (st.t > 30 ? ' · FRENZY' : ''), W / 2, AY + AR + 40, 15, '#6f7686', 'center', 700);
  },
  hud: st => st.balls.map(b => Math.max(0, Math.ceil(b.hp)))
});

// ---------- 4. Spike Garden ----------
SIMS.push({
  id: 'spikes', name: 'Spike Garden', caption: 'Every bounce grows a spike', theme: 'paper',
  init(rng) {
    const st = K.base(rng, 6, { sp: [] });
    st.balls = spread(rng, 6, 150, 60).map((p, i) => K.ball(p[0], p[1], 9, rng.ang(), 175, i));
    return st;
  },
  step(st, dt) {
    const B = st.balls, L = st.t > 40 ? 30 : 18, dying = [];
    for (const b of B) { if (!b.dead) K.move(b, dt); }
    K.pairs(B, (a, b) => { if (K.collide(a, b) > 1) AU.blip(6, 0.08); });
    for (const b of B) {
      if (b.dead) continue;
      for (const s of st.sp) {
        if (s.o === b.ci && st.t - s.t < 0.15) continue;
        const [d, t] = K.segClosest(b.x, b.y, s.bx, s.by, s.tx, s.ty);
        if (d < b.r - 1 + 4 * (1 - t)) { b.dead = true; b.fall = 1; dying.push(b.ci); FX.burst(b.x, b.y, st.C[b.ci].c, 24, 240); AU.pop(0.3); break; }
      }
      if (b.dead) continue;
      if (K.ringIn(b, AX, AY, AR)) {
        K.scatter(b, st.rng);
        const a = Math.atan2(b.y - AY, b.x - AX), c = Math.cos(a), s = Math.sin(a);
        st.sp.push({ a, o: b.ci, t: st.t, bx: AX + c * AR, by: AY + s * AR, tx: AX + c * (AR - L), ty: AY + s * (AR - L), L });
        AU.tick(0.06);
      }
      K.speed(b, 175);
    }
    if (dying.length) K.knock(st, dying);
    fallTick(st, dt);
  },
  draw(st, ctx) {
    for (const s of st.sp) {
      const g = Math.min(1, (st.t - s.t) / 0.12), c = Math.cos(s.a), sn = Math.sin(s.a), px = -sn * 5, py = c * 5;
      const tx = s.bx + (s.tx - s.bx) * g, ty = s.by + (s.ty - s.by) * g;
      ctx.fillStyle = st.C[s.o].c; ctx.beginPath(); ctx.moveTo(s.bx + px, s.by + py); ctx.lineTo(tx, ty); ctx.lineTo(s.bx - px, s.by - py); ctx.closePath(); ctx.fill();
    }
    D.circle(ctx, AX, AY, AR + 2, INK, 5);
    drawBalls(st, ctx, false);
  },
  hud: st => st.balls.map(b => st.sp.filter(s => s.o === b.ci).length),
  lead: st => K.aliveIdx(st)[0]
});

// ---------- 5. Hot Potato ----------
SIMS.push({
  id: 'potato', name: 'Hot Potato', caption: 'Don’t be holding it when it blows', theme: 'night',
  init(rng) {
    const st = K.base(rng, 8, { hold: -1, fuse: 0, left: 0, prev: -1, passT: -9, next: 0.3, lastFuse: rng.range(6, 9), tk: 0 });
    st.balls = spreadBox(rng, 8, 80).map((p, i) => K.ball(p[0], p[1], 15, rng.ang(), 210, i));
    return st;
  },
  step(st, dt) {
    const B = st.balls;
    if (st.hold < 0 && st.win == null && (st.next -= dt) <= 0) {
      const alive = B.filter(b => !b.dead); const h = st.rng.pick(alive);
      st.hold = h.ci; st.fuse = st.left = st.lastFuse; st.lastFuse = Math.max(2.5, st.lastFuse * 0.85 + st.rng.range(-0.3, 0.3)); st.prev = -1;
      FX.ring(h.x, h.y, '#ff5a3c', 30); AU.zap(0.12);
    }
    for (const b of B) { if (b.dead) continue; K.move(b, dt); if (K.box(b, BX0, BY0, BX1, BY1)) { K.nudge(b); AU.blip(st.hold === b.ci ? 12 : 4, 0.05); } }
    K.pairs(B, (a, b) => {
      const imp = K.collide(a, b); if (imp < 0.5 || st.hold < 0) return;
      const h = a.ci === st.hold ? a : b.ci === st.hold ? b : null; if (!h) return;
      const o = h === a ? b : a;
      if (o.ci === st.prev && st.t - st.passT < 0.4) return;
      st.prev = h.ci; st.passT = st.t; st.hold = o.ci; AU.blip(14, 0.15); FX.burst(o.x, o.y, '#ff8a3c', 8, 150);
    });
    for (const b of B) if (!b.dead) { K.speed(b, b.ci === st.hold ? 262 : 210); if (b.ci === st.hold) FX.burst(b.x, b.y, Math.random() < 0.5 ? '#ff7a2a' : '#ffc04a', 1, 30, 0.5, 2.5); }
    if (st.hold >= 0) {
      st.left -= dt;
      const k = st.left / st.fuse; st.tk -= dt; if (st.tk <= 0) { st.tk = 0.08 + 0.45 * k; AU.tick(0.07); }
      if (st.left <= 0) {
        const h = B[st.hold]; h.dead = true; h.fall = 1; st.hold = -1; st.next = 1.0;
        FX.burst(h.x, h.y, '#ff6a2a', 40, 420, 0.8, 4); FX.burst(h.x, h.y, st.C[h.ci].c, 20, 300); FX.ring(h.x, h.y, '#ffb070', 70, 0.6); FX.shake(14); AU.boom();
        for (const o of B) { if (o.dead) continue; const dx = o.x - h.x, dy = o.y - h.y, d = Math.hypot(dx, dy); if (d < 150 && d > 0) { o.vx = dx / d * 210; o.vy = dy / d * 210; } }
        K.knock(st, [h.ci]);
      }
    }
    fallTick(st, dt);
  },
  draw(st, ctx) {
    ctx.strokeStyle = '#2c3342'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(BX0, BY0, BX1 - BX0, BY1 - BY0, 40) : ctx.rect(BX0, BY0, BX1 - BX0, BY1 - BY0); ctx.stroke();
    drawBalls(st, ctx, true, b => {
      if (b.ci !== st.hold || b.dead) return;
      const k = st.left / st.fuse, on = Math.sin(st.t * (6 + 60 * (1 - k) * (1 - k))) > 0;
      D.glow(ctx, b.x, b.y, b.r * 3, '#ff3b1f', on ? 1 : 0.4);
      D.circle(ctx, b.x, b.y, b.r * 0.45, null, 0, on ? '#ff3b1f' : '#8a1e10');
      ctx.strokeStyle = on ? '#ffb070' : 'rgba(255,176,112,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, 0, TAU); ctx.stroke();
    });
  },
  hud: st => st.balls.map(b => b.dead ? '💥' : b.ci === st.hold ? '💣' : '·'),
  lead: st => K.aliveIdx(st).find(i => i !== st.hold) ?? K.aliveIdx(st)[0]
});

// ---------- 6. Sumo Disc ----------
SIMS.push({
  id: 'sumo', name: 'Sumo Disc', caption: 'Last one on the disc', theme: 'paper',
  init(rng) {
    const st = K.base(rng, 6, { Rw: new Array(24).fill(235), brk: 0 });
    st.balls = spread(rng, 6, 140, 70).map((p, i) => { const b = K.ball(p[0], p[1], 19, rng.ang(), 40, i); b.cd = rng.range(1, 2.5); b.ph = rng.ang(); b.wob = rng.range(0.6, 1.4); return b; });
    return st;
  },
  rAt(st, x, y) { const a = Math.atan2(y - AY, x - AX); return st.Rw[((Math.floor((a + Math.PI) / TAU * 24) % 24) + 24) % 24]; },
  step(st, dt) {
    const B = st.balls, rng = st.rng;
    if (st.t > 20) {
      for (let i = 0; i < 24; i++) st.Rw[i] = Math.max(0, st.Rw[i] - 7 * dt);
      if ((st.brk -= dt) <= 0) { st.brk = rng.range(1, 2); const i = rng.int(0, 23); st.Rw[i] = Math.max(0, st.Rw[i] - 35); const a = (i + 0.5) / 24 * TAU - Math.PI; FX.burst(AX + Math.cos(a) * st.Rw[i], AY + Math.sin(a) * st.Rw[i], '#b98a5a', 14, 90, 0.8, 5, 300); AU.noise(0.2, 400, 0.15, 'lowpass', 1, 'crack'); }
    }
    const alive = B.filter(b => !b.dead);
    for (const b of alive) {
      let tg = null, bd = 1e9; for (const o of alive) if (o !== b) { const d = Math.hypot(o.x - b.x, o.y - b.y); if (d < bd) { bd = d; tg = o; } }
      let ax = 0, ay = 0;
      if (tg) { const dx = tg.x - b.x, dy = tg.y - b.y, l = Math.hypot(dx, dy) || 1, w = Math.sin(st.t * 2 * b.wob + b.ph) * 0.8; ax = (dx / l - dy / l * w) * 300; ay = (dy / l + dx / l * w) * 300; }
      const cx = AX - b.x, cy = AY - b.y, cd = Math.hypot(cx, cy) || 1, edge = this.rAt(st, b.x, b.y) - cd;
      if (edge < 70) { const k = (70 - edge) / 70 * 520; ax += cx / cd * k; ay += cy / cd * k; }
      b.vx += ax * dt; b.vy += ay * dt;
      if ((b.cd -= dt) <= 0 && tg) { b.cd = rng.range(1.5, 3); const dx = tg.x - b.x, dy = tg.y - b.y, l = Math.hypot(dx, dy) || 1; b.vx += dx / l * 330; b.vy += dy / l * 330; FX.burst(b.x, b.y, st.C[b.ci].l, 6, 80); }
      const f = Math.exp(-1.3 * dt); b.vx *= f; b.vy *= f;
      const s = Math.hypot(b.vx, b.vy); if (s > 430) { b.vx *= 430 / s; b.vy *= 430 / s; }
      K.move(b, dt);
    }
    K.pairs(B, (a, b) => { const i = K.collide(a, b, 1.35); if (i > 40) { AU.thud(i / 600); if (i > 150) FX.burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#fff', 5, 120); } });
    const dying = [];
    for (const b of alive) if (Math.hypot(b.x - AX, b.y - AY) > this.rAt(st, b.x, b.y)) { b.dead = true; b.fall = 1; dying.push(b.ci); AU.tone(700, 0.6, 0.15, 'sine', 0.3, 'fall'); }
    if (dying.length) K.knock(st, dying, i => -Math.hypot(B[i].x - AX, B[i].y - AY));
    for (const b of B) if (b.dead && b.fall > 0) { b.fall -= dt * 1.5; b.x += b.vx * dt * 0.5; b.y += b.vy * dt * 0.5; }
  },
  draw(st, ctx) {
    ctx.fillStyle = '#d9d0bf'; ctx.beginPath();
    for (let i = 0; i < 24; i++) { const a0 = i / 24 * TAU - Math.PI, a1 = (i + 1) / 24 * TAU - Math.PI, r = st.Rw[i]; ctx.moveTo(AX, AY); ctx.arc(AX, AY + 10, r, a0, a1); }
    ctx.fill();
    ctx.fillStyle = '#c8a77c'; ctx.beginPath();
    for (let i = 0; i < 24; i++) { const a0 = i / 24 * TAU - Math.PI, a1 = (i + 1) / 24 * TAU - Math.PI + 0.002; ctx.moveTo(AX, AY); ctx.arc(AX, AY, st.Rw[i], a0, a1); }
    ctx.fill();
    D.circle(ctx, AX, AY, Math.max(0, Math.min(...st.Rw) * 0.55), 'rgba(90,60,30,0.25)', 2);
    for (const b of st.balls) if (!b.dead) D.circle(ctx, b.x + 4, b.y + 6, b.r, null, 0, 'rgba(60,40,20,0.22)');
    drawBalls(st, ctx, false);
  },
  hud: st => st.balls.map(b => b.dead ? 'out' : Math.round(Math.max(0, 100 - 100 * Math.hypot(b.x - AX, b.y - AY) / Math.max(1, AR))) + ''),
  lead: st => K.aliveIdx(st).sort((a, b) => Math.hypot(st.balls[a].x - AX, st.balls[a].y - AY) - Math.hypot(st.balls[b].x - AX, st.balls[b].y - AY))[0]
});

// ---------- 7. Feeding Frenzy ----------
SIMS.push({
  id: 'frenzy', name: 'Feeding Frenzy', caption: 'Eat or be eaten', theme: 'night',
  init(rng) {
    const st = K.base(rng, 8, { food: [], sp: 0, box: [BX0, BY0, BX1, BY1], shed: {} });
    st.balls = spreadBox(rng, 8, 90).map((p, i) => { const b = K.ball(p[0], p[1], 11, rng.ang(), 60, i); b.mass = 80; b.th = 0; return b; });
    for (let i = 0; i < 150; i++) st.food.push({ x: rng.range(BX0 + 10, BX1 - 10), y: rng.range(BY0 + 10, BY1 - 10), m: 6 });
    st.balls.forEach(b => this.sz(b));
    return st;
  },
  sz(b) { b.r = Math.sqrt(b.mass) * 1.25; b.m = b.mass; b.vmax = 215 * Math.pow(11 / b.r, 0.5); },
  step(st, dt) {
    const B = st.balls, rng = st.rng, alive = B.filter(b => !b.dead);
    if (st.t > 28) { const k = K.clamp((st.t - 28) / 20, 0, 1) * 0.75, cx = W / 2, cy = (BY0 + BY1) / 2, hw = (BX1 - BX0) / 2 * (1 - k), hh = (BY1 - BY0) / 2 * (1 - k); st.box = [cx - hw, cy - hh, cx + hw, cy + hh]; }
    const [x0, y0, x1, y1] = st.box;
    if (st.t < 35 && st.food.length < 150 && (st.sp -= dt) <= 0) { st.sp = 0.12; st.food.push({ x: rng.range(x0 + 10, x1 - 10), y: rng.range(y0 + 10, y1 - 10), m: 6 }); }
    if (st.t > 35) st.food = st.food.filter(f => f.x > x0 && f.x < x1 && f.y > y0 && f.y < y1);
    for (const b of alive) {
      if ((b.th -= dt) <= 0) {
        b.th = 0.05; let tx = 0, ty = 0, mode = 0, bd = 1e9;
        for (const o of alive) {
          if (o === b) continue; const d = Math.hypot(o.x - b.x, o.y - b.y) - o.r - b.r;
          if (o.r > b.r * 1.15 && d < 110 && d < bd) { bd = d; mode = 1; tx = b.x - o.x; ty = b.y - o.y; }
        }
        if (!mode) {
          for (const o of alive) { if (o !== b && o.r * 1.15 < b.r) { const d = Math.hypot(o.x - b.x, o.y - b.y) - b.r; if (d < 160 && d < bd) { bd = d; mode = 2; tx = o.x - b.x; ty = o.y - b.y; } } }
          for (const f of st.food) { const d = Math.hypot(f.x - b.x, f.y - b.y) - b.r; if (d < bd * 0.8 || (mode !== 2 && d < bd)) { bd = d; mode = 3; tx = f.x - b.x; ty = f.y - b.y; } }
        }
        const l = Math.hypot(tx, ty) || 1; b.dx = mode ? tx / l : Math.cos(st.t + b.ci); b.dy = mode ? ty / l : Math.sin(st.t + b.ci);
      }
      const k = Math.min(1, 4 * dt); b.vx += (b.dx * b.vmax - b.vx) * k; b.vy += (b.dy * b.vmax - b.vy) * k;
      K.move(b, dt); K.box(b, x0, y0, x1, y1);
      for (let i = st.food.length - 1; i >= 0; i--) { const f = st.food[i]; if (Math.abs(f.x - b.x) < b.r && Math.abs(f.y - b.y) < b.r && Math.hypot(f.x - b.x, f.y - b.y) < b.r) { b.mass += f.m; st.food.splice(i, 1); this.sz(b); AU.blip(8 + Math.min(12, b.r / 5), 0.05); } }
      if (b.mass > 900) { st.shed[b.ci] = (st.shed[b.ci] || 0) + b.mass * 0.03 * dt; while (st.shed[b.ci] > 6) { st.shed[b.ci] -= 6; b.mass -= 6; const a = rng.ang(), d = b.r + rng.range(12, 40); st.food.push({ x: K.clamp(b.x + Math.cos(a) * d, x0 + 4, x1 - 4), y: K.clamp(b.y + Math.sin(a) * d, y0 + 4, y1 - 4), m: 6 }); } this.sz(b); }
    }
    const dying = [];
    K.pairs(alive, (a, b) => {
      if (a.dead || b.dead) return;
      const big = a.r > b.r ? a : b, sm = big === a ? b : a, d = Math.hypot(a.x - b.x, a.y - b.y);
      if (big.r > sm.r * 1.15 && d < big.r - sm.r * 0.3) { big.mass += sm.mass * 0.9; sm.dead = true; sm.fall = 0; dying.push(sm.ci); this.sz(big); AU.thud(0.35); FX.burst(sm.x, sm.y, st.C[sm.ci].c, 18, 160); }
      else K.collide(a, b, 0.5);
    });
    if (dying.length) K.knock(st, dying, i => B[i].mass);
    if (st.win == null && st.t >= 50) { st.win = this.lead(st); }
  },
  draw(st, ctx) {
    const [x0, y0, x1, y1] = st.box;
    ctx.strokeStyle = st.t > 35 ? '#6a3a3a' : '#2c3342'; ctx.lineWidth = 3; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = '#c8f0d8'; for (const f of st.food) { ctx.globalAlpha = 0.7; ctx.fillRect(f.x - 2, f.y - 2, 4, 4); } ctx.globalAlpha = 1;
    for (const b of st.balls) {
      if (b.dead) continue; const c = st.C[b.ci].c;
      D.glow(ctx, b.x, b.y, b.r * 2, c, 0.6);
      ctx.fillStyle = rgba(c, 0.45); ctx.strokeStyle = shade(c, 0.4); ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k <= 24; k++) { const a = k / 24 * TAU, r = b.r * (1 + 0.05 * Math.sin(a * 5 + st.t * 4 + b.ci)); const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.fill(); ctx.stroke();
      D.circle(ctx, b.x, b.y, Math.max(2, b.r * 0.22), null, 0, shade(c, 0.5));
      if (b.r > 16) D.text(ctx, String(Math.round(b.mass)), b.x, b.y + b.r * 0.45, Math.min(22, b.r * 0.45), '#fff', 'center', 800);
    }
  },
  hud: st => st.balls.map(b => b.dead ? 0 : Math.round(b.mass)),
  lead: st => K.aliveIdx(st).sort((a, b) => st.balls[b].mass - st.balls[a].mass)[0]
});

// ---------- 8. Rock Paper Scissors ----------
const RPS = [{ n: 'Rock', c: '#7c7f8a', g: '🪨' }, { n: 'Paper', c: '#3e63dd', g: '📄' }, { n: 'Scissors', c: '#e5484d', g: '✂️' }];
SIMS.push({
  id: 'rps', name: 'Rock Paper Scissors', caption: 'Catch your prey, flee your predator', theme: 'paper',
  init(rng) {
    const st = K.base(rng, 3); st.C = RPS.map(p => ({ n: p.n, c: p.c, l: shade(p.c, 0.45), d: shade(p.c, -0.35), g: p.g }));
    st.p = []; st.th = 0;
    for (let k = 0; k < 120; k++) { const t = k % 3; st.p.push({ x: rng.range(BX0 + 15, BX1 - 15), y: rng.range(BY0 + 15, BY1 - 15), vx: 0, vy: 0, r: 11, t, dx: 0, dy: 0 }); }
    st.cnt = [40, 40, 40]; return st;
  },
  where: st => st.p.map(p => ({ i: p.t, x: p.x, y: p.y, r: p.r })),
  step(st, dt) {
    const P = st.p, rng = st.rng, spd = 70 * (st.t > 30 ? Math.pow(1.03, st.t - 30) : 1);
    if ((st.th -= dt) <= 0) {
      st.th = 0.05;
      for (const p of P) {
        const prey = (p.t + 2) % 3, pred = (p.t + 1) % 3; let db = 1e9, dp = 1e9, bx = 0, by = 0, px = 0, py = 0;
        for (const q of P) { if (q.t === p.t) continue; const dx = q.x - p.x, dy = q.y - p.y, d = dx * dx + dy * dy; if (q.t === prey && d < db) { db = d; bx = dx; by = dy; } else if (q.t === pred && d < dp) { dp = d; px = dx; py = dy; } }
        let dx = 0, dy = 0; if (db < 1e9) { const l = Math.sqrt(db) || 1; dx += bx / l; dy += by / l; }
        if (dp < 1e9) { const l = Math.sqrt(dp) || 1, w = l < 90 ? 1.4 : 0.35; dx -= px / l * w; dy -= py / l * w; }
        dx += rng.range(-0.5, 0.5); dy += rng.range(-0.5, 0.5); const l = Math.hypot(dx, dy) || 1; p.dx = dx / l; p.dy = dy / l;
      }
    }
    for (const p of P) { const k = Math.min(1, 5 * dt); p.vx += (p.dx * spd - p.vx) * k; p.vy += (p.dy * spd - p.vy) * k; K.move(p, dt); K.box(p, BX0, BY0, BX1, BY1); }
    K.hashPairs(P, 24, (a, b) => {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= 22 || d < 1e-6) return;
      if (a.t !== b.t) {
        const w = (a.t + 2) % 3 === b.t ? a : b, l = w === a ? b : a; st.cnt[l.t]--; st.cnt[w.t]++; l.t = w.t;
        AU.tone([330, 440, 550][w.t], 0.05, 0.08, 'square', 0, 'rps' + w.t); FX.burst(l.x, l.y, st.C[w.t].c, 3, 60, 0.3, 2);
      }
      const o = (22 - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
    });
    const alive = st.cnt.filter(c => c > 0).length;
    st.cnt.forEach((c, i) => { if (c === 0 && !st.out[i]) { st.out[i] = true; st.outT[i] = st.t; } });
    if (alive === 1 && st.win == null) st.win = st.cnt.findIndex(c => c > 0);
    if (st.t >= 60 && st.win == null) st.win = this.lead(st);
  },
  draw(st, ctx) {
    ctx.strokeStyle = '#cdbf9f'; ctx.lineWidth = 2; ctx.strokeRect(BX0, BY0, BX1 - BX0, BY1 - BY0);
    let x = BX0; for (let i = 0; i < 3; i++) { const w = (BX1 - BX0) * st.cnt[i] / 120; ctx.fillStyle = st.C[i].c; ctx.fillRect(x, 128, w, 6); x += w; }
    if (!st._spr) st._spr = st.C.map(c => { const s = D.mk(48, 48), g = s.getContext('2d'); g.font = '34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.g, 24, 27); return s; });
    for (const p of st.p) { D.circle(ctx, p.x, p.y, 12, null, 0, rgba(st.C[p.t].c, 0.28)); ctx.drawImage(st._spr[p.t], p.x - 12, p.y - 12, 24, 24); }
  },
  hud: st => st.cnt.slice(),
  lead: st => st.cnt.indexOf(Math.max(...st.cnt))
});
