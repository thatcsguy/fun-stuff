'use strict';
// ---------- constants, seeded rng, palette ----------
const W = 540, H = 960, TAU = Math.PI * 2, DT = 1 / 120, MAX_T = 75;
const SIMS = [];
const PAL = [
  { n: 'Red', c: '#e5484d' }, { n: 'Orange', c: '#f76b15' }, { n: 'Gold', c: '#e2a336' },
  { n: 'Green', c: '#30a46c' }, { n: 'Teal', c: '#12a594' }, { n: 'Blue', c: '#3e63dd' },
  { n: 'Purple', c: '#8e4ec6' }, { n: 'Pink', c: '#d6409f' }
];
function hexRgb(h) { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
function shade(h, k) { // k<0 darker, k>0 lighter
  const [r, g, b] = hexRgb(h), f = c => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
PAL.forEach(p => { p.d = shade(p.c, -0.35); p.l = shade(p.c, 0.45); p.rgb = hexRgb(p.c); });

function RNG(seed) {
  let a = seed >>> 0;
  const r = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  r.ang = () => r() * TAU;
  r.sign = () => r() < 0.5 ? -1 : 1;
  return r;
}

// ---------- physics kit ----------
const K = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; },
  cont(rng, n) { return rng.shuffle(PAL.slice()).slice(0, n); },
  ball(x, y, r, ang, spd, ci) { return { x, y, r, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, ci, m: r * r, dead: false }; },
  speed(b, s) { const v = Math.hypot(b.vx, b.vy); if (v < 1e-6) { b.vx = s; b.vy = 0; return; } b.vx *= s / v; b.vy *= s / v; },
  // keep a ball from bouncing perfectly horizontally/vertically forever
  nudge(b, minA = 0.14) {
    const s = Math.hypot(b.vx, b.vy); if (s < 1e-6) return;
    let a = Math.atan2(b.vy, b.vx);
    for (let k = -2; k <= 2; k++) {
      const ax = k * Math.PI / 2, d = a - ax;
      if (Math.abs(d) < minA) { a = ax + (d >= 0 ? minA : -minA); b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; return; }
    }
  },
  // small seeded rotation of a bounce, so circle billiards never settle into a fixed orbit
  scatter(b, rng, a = 0.15) { const r = rng.range(-a, a), c = Math.cos(r), s = Math.sin(r), vx = b.vx; b.vx = vx * c - b.vy * s; b.vy = vx * s + b.vy * c; },
  move(b, dt) { b.x += b.vx * dt; b.y += b.vy * dt; },
  // elastic circle-circle; returns impact speed (0 if no hit)
  collide(a, b, e = 1) {
    const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 < 1e-9) return 0;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ma = a.m || a.r * a.r, mb = b.m || b.r * b.r;
    const ia = 1 / ma, ib = 1 / mb, ov = (rr - d) / (ia + ib);
    a.x -= nx * ov * ia; a.y -= ny * ov * ia; b.x += nx * ov * ib; b.y += ny * ov * ib;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn >= 0) return 0.001;
    const j = -(1 + e) * vn / (ia + ib);
    a.vx -= j * ia * nx; a.vy -= j * ia * ny; b.vx += j * ib * nx; b.vy += j * ib * ny;
    return -vn;
  },
  // axis-aligned box walls (inside); returns bitmask 1=left 2=right 4=top 8=bottom
  box(b, x0, y0, x1, y1, e = 1) {
    let h = 0;
    if (b.x - b.r < x0) { b.x = x0 + b.r; if (b.vx < 0) b.vx = -b.vx * e; h |= 1; }
    if (b.x + b.r > x1) { b.x = x1 - b.r; if (b.vx > 0) b.vx = -b.vx * e; h |= 2; }
    if (b.y - b.r < y0) { b.y = y0 + b.r; if (b.vy < 0) b.vy = -b.vy * e; h |= 4; }
    if (b.y + b.r > y1) { b.y = y1 - b.r; if (b.vy > 0) b.vy = -b.vy * e; h |= 8; }
    return h;
  },
  // inside a circular wall; returns true on bounce
  ringIn(b, cx, cy, R, e = 1) {
    const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
    if (d + b.r <= R || d < 1e-6) return false;
    const nx = dx / d, ny = dy / d;
    b.x = cx + nx * (R - b.r); b.y = cy + ny * (R - b.r);
    const vn = b.vx * nx + b.vy * ny;
    if (vn > 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
    return true;
  },
  // outside of a circle (ball bounces off a round obstacle)
  ringOut(b, cx, cy, R, e = 1) {
    const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
    if (d - b.r >= R || d < 1e-6) return false;
    const nx = dx / d, ny = dy / d;
    b.x = cx + nx * (R + b.r); b.y = cy + ny * (R + b.r);
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
    return true;
  },
  // closest point on segment; returns [dist, t, cx, cy]
  segClosest(px, py, ax, ay, bx, by) {
    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    let t = l2 > 0 ? ((px - ax) * ex + (py - ay) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + ex * t, cy = ay + ey * t;
    return [Math.hypot(px - cx, py - cy), t, cx, cy];
  },
  // circle vs thick segment (capsule); returns impact speed or 0. svx/svy = segment velocity at contact (moving walls)
  seg(b, ax, ay, bx, by, e = 1, th = 0, svx = 0, svy = 0) {
    const [d, , cx, cy] = K.segClosest(b.x, b.y, ax, ay, bx, by), rr = b.r + th;
    if (d >= rr) return 0;
    let nx, ny;
    if (d > 1e-6) { nx = (b.x - cx) / d; ny = (b.y - cy) / d; } else { nx = -(by - ay); ny = bx - ax; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; }
    b.x = cx + nx * rr; b.y = cy + ny * rr;
    const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
    if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; return -vn; }
    return 0.001;
  },
  segX(ax, ay, bx, by, cx, cy, dx, dy) { // proper segment intersection -> [t,u] or null
    const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy, den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((cx - ax) * sy - (cy - ay) * sx) / den, u = ((cx - ax) * ry - (cy - ay) * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
  },
  // all-pairs helper
  pairs(arr, fn) { for (let i = 0; i < arr.length; i++) { const a = arr[i]; if (a.dead) continue; for (let j = i + 1; j < arr.length; j++) { const b = arr[j]; if (!b.dead) fn(a, b); } } },
  // uniform spatial hash for many bodies
  hashPairs(arr, cell, fn) {
    const m = new Map();
    for (const o of arr) { if (o.dead) continue; const k = (Math.floor(o.x / cell) + 64) * 4096 + Math.floor(o.y / cell) + 64; let l = m.get(k); if (!l) m.set(k, l = []); l.push(o); }
    for (const [k, l] of m) {
      const cx = Math.floor(k / 4096), cy = k % 4096;
      for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) fn(l[i], l[j]);
      for (const [ox, oy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const l2 = m.get((cx + ox) * 4096 + cy + oy); if (!l2) continue;
        for (const a of l) for (const b of l2) fn(a, b);
      }
    }
  },
  // the last of `ids` (all dying this step) to keep: deterministic by score fn, tie broken by rng
  pickOne(rng, ids, scoreFn) { let best = -Infinity, out = []; for (const i of ids) { const s = scoreFn ? scoreFn(i) : 0; if (s > best + 1e-9) { best = s; out = [i]; } else if (Math.abs(s - best) <= 1e-9) out.push(i); } return out.length === 1 ? out[0] : rng.pick(out); },
  aliveIdx(st) { const r = []; for (let i = 0; i < st.C.length; i++) if (!st.out[i]) r.push(i); return r; },
  // mark contestants out; settle a winner when one (or none) remains
  knock(st, ids, scoreFn) {
    if (!ids.length || st.win != null) { ids.forEach(i => st.out[i] = true); return; }
    const before = K.aliveIdx(st);
    ids.forEach(i => { if (!st.out[i]) { st.out[i] = true; st.outT[i] = st.t; } });
    const left = K.aliveIdx(st);
    if (left.length === 1) st.win = left[0];
    else if (left.length === 0) { const w = K.pickOne(st.rng, before, scoreFn); st.out[w] = false; st.outT[w] = 0; st.win = w; }
  },
  base(rng, n, extra) { const C = K.cont(rng, n); return Object.assign({ rng, C, out: C.map(() => false), outT: C.map(() => 0), t: 0, win: null }, extra || {}); }
};

// ---------- visual-only particles (Math.random is fine here: never affects outcomes) ----------
const FX = {
  P: [], off: false, sh: 0, flashA: 0, flashC: '#fff',
  burst(x, y, col, n = 14, spd = 180, life = 0.6, size = 3, g = 0) {
    if (this.off) return;
    for (let i = 0; i < n && this.P.length < 400; i++) {
      const a = Math.random() * TAU, s = spd * (0.3 + Math.random() * 0.8);
      this.P.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, col, size: size * (0.6 + Math.random() * 0.8), g, k: 0 });
    }
  },
  confetti(cols, n = 120) {
    if (this.off) return;
    for (let i = 0; i < n && this.P.length < 420; i++) this.P.push({ x: Math.random() * W, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 120, vy: 150 + Math.random() * 250, life: 3, max: 3, col: cols[i % cols.length], size: 5 + Math.random() * 4, g: 120, k: 1, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12 });
  },
  ring(x, y, col, r = 40, life = 0.5) { if (!this.off && this.P.length < 420) this.P.push({ x, y, vx: 0, vy: 0, life, max: life, col, size: r, g: 0, k: 2 }); },
  shake(a) { if (!this.off) this.sh = Math.max(this.sh, a); },
  flash(col, a = 0.35) { if (!this.off) { this.flashC = col; this.flashA = a; } },
  clear() { this.P.length = 0; this.sh = 0; this.flashA = 0; },
  update(dt) {
    for (let i = this.P.length - 1; i >= 0; i--) {
      const p = this.P[i]; p.life -= dt;
      if (p.life <= 0) { this.P.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 0) { p.vx *= 1 - 2 * dt; p.vy *= 1 - 2 * dt; }
      if (p.k === 1) p.rot += p.vr * dt;
    }
    this.sh *= Math.pow(0.02, dt); this.flashA *= Math.pow(0.05, dt);
  },
  draw(ctx) {
    for (const p of this.P) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = p.k === 1 ? Math.min(1, a * 2) : a;
      if (p.k === 2) { ctx.strokeStyle = p.col; ctx.lineWidth = 3 * a + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a), 0, TAU); ctx.stroke(); }
      else if (p.k === 1) { ctx.fillStyle = p.col; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
      else { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
};

// ---------- drawing kit ----------
const D = {
  cache: new Map(),
  mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
  sprite(col, night) {
    const key = col + night; let s = this.cache.get(key); if (s) return s;
    s = this.mk(128, 128); const g = s.getContext('2d');
    const gr = g.createRadialGradient(46, 42, 4, 64, 64, 62);
    gr.addColorStop(0, shade(col, 0.55)); gr.addColorStop(0.35, col); gr.addColorStop(1, shade(col, -0.3));
    g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill();
    if (!night) { g.strokeStyle = shade(col, -0.45); g.lineWidth = 5; g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(44, 38, 16, 10, -0.6, 0, TAU); g.fill();
    this.cache.set(key, s); return s;
  },
  glowS(col) {
    const key = 'g' + col; let s = this.cache.get(key); if (s) return s;
    s = this.mk(128, 128); const g = s.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(0.4, rgba(col, 0.18)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); this.cache.set(key, s); return s;
  },
  ball(ctx, x, y, r, col, night) {
    if (night) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(this.glowS(col), x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2); ctx.globalCompositeOperation = 'source-over'; }
    ctx.drawImage(this.sprite(col, night), x - r, y - r, r * 2, r * 2);
  },
  glow(ctx, x, y, r, col, a = 1) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(this.glowS(col), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; },
  text(ctx, s, x, y, size, col, align = 'center', weight = 800) {
    ctx.font = `${weight} ${size}px system-ui,-apple-system,Segoe UI,Roboto,sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, x, y);
  },
  circle(ctx, x, y, r, stroke, lw = 2, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } },
  line(ctx, ax, ay, bx, by, col, lw = 2) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); },
  // persistent offscreen layer kept on the state (not part of the simulation)
  layer(st, name, w = W, h = H) { st._lay = st._lay || {}; if (!st._lay[name]) st._lay[name] = this.mk(w, h); return st._lay[name]; }
};
const INK = '#2b2620', GOLD = '#c9a25a', PAPER = '#f3efe6', NIGHT = '#0e1116';

// ---------- one round without drawing (used by ?test=1 and the Node test) ----------
function tickSim(sim, st) { st.t += DT; sim.step(st, DT); }
function leadOf(sim, st) {
  if (sim.lead) return sim.lead(st);
  const v = sim.hud(st); let b = -Infinity, w = 0;
  v.forEach((x, i) => { const n = parseFloat(x); if (!st.out[i] && n > b) { b = n; w = i; } });
  return w;
}
function runRound(sim, seed, maxT = MAX_T) {
  const st = sim.init(RNG(seed));
  while (st.win == null && st.t < maxT) tickSim(sim, st);
  const capped = st.win == null; if (capped) st.win = leadOf(sim, st);
  return { win: st.win, t: st.t, capped, n: st.C.length };
}
