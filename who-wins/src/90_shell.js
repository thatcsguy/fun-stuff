// ---------- shell: picker, loop, HUD, pre-roll, slow motion, banner, tallies ----------
(function () {
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const KEY = 'whowins_v1';
  let store = { tally: {}, played: {}, right: 0, total: 0 };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.tally) store = Object.assign(store, s); } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { } };
  const wide = () => window.matchMedia('(min-width: 900px)').matches;

  const R = { si: 0, sim: null, st: null, seed: 1, phase: 'pre', preT: 0, slowT: 0, doneT: 0, acc: 0, speed: 1, paused: false, back: -1, shuffle: false, scale: 1 };
  const PRE = 2.2, SLOW = 1.4, SHUF_WAIT = 4;

  // ----- canvas sizing -----
  function fit() {
    const wrap = $('stageWrap'), dpr = Math.min(2, window.devicePixelRatio || 1);
    let ah = wrap.clientHeight || window.innerHeight - 60, aw = wide() ? Math.max(300, window.innerWidth - 380) : window.innerWidth;
    let h = ah, w = h * W / H; if (w > aw) { w = aw; h = w * H / W; }
    cv.style.width = Math.floor(w) + 'px'; cv.style.height = Math.floor(h) + 'px';
    cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr); R.scale = cv.width / W;
  }
  window.addEventListener('resize', fit);

  // ----- rounds -----
  function newSeed() { return 1 + Math.floor(Math.random() * 999999); }
  function start(si, seed) {
    R.si = si; R.sim = SIMS[si]; R.seed = seed == null ? newSeed() : seed;
    R.st = R.sim.init(RNG(R.seed)); R.phase = 'pre'; R.preT = 0; R.acc = 0; R.paused = false; R.back = -1; R.slowT = 0; R.doneT = 0;
    FX.clear();
    document.body.classList.add('playing'); fit();
    try { history.replaceState(null, '', `?sim=${R.sim.id}&seed=${R.seed}`); } catch (e) { }
    document.querySelectorAll('.tile').forEach((t, i) => t.classList.toggle('cur', i === si));
    document.title = R.sim.name + ' · Who Wins?';
  }
  function pickNext() { let i; do { i = Math.floor(Math.random() * SIMS.length); } while (SIMS.length > 1 && i === R.si); return i; }

  function finish() {
    const st = R.st, sim = R.sim, w = st.win, nm = st.C[w].n;
    const t = store.tally[sim.id] = store.tally[sim.id] || {}; t[nm] = (t[nm] || 0) + 1;
    store.played[sim.id] = (store.played[sim.id] || 0) + 1;
    if (R.back >= 0) { store.total++; if (R.back === w) store.right++; }
    save(); updateRecord(); updateTile(R.si);
    FX.confetti([st.C[w].c, st.C[w].l || st.C[w].c, '#ffffff']); FX.flash(st.C[w].c, 0.25); AU.chime();
  }

  // ----- loop -----
  let last = 0;
  function frame(ts) {
    const dtr = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
    AU.frame();
    const sim = R.sim, st = R.st;
    if (sim && !R.paused) {
      if (R.phase === 'pre') { R.preT += dtr; if (R.preT >= PRE) R.phase = 'run'; }
      else {
        const rate = R.phase === 'slow' ? 0.25 : R.phase === 'done' ? 0.6 : R.speed;
        R.acc += dtr * rate; let n = 0; const cap = 12 * R.speed;
        while (R.acc >= DT && n < cap) {
          tickSim(sim, st); R.acc -= DT; n++;
          if (R.phase === 'run' && st.win == null && st.t >= MAX_T) st.win = leadOf(sim, st);
          if (R.phase === 'run' && st.win != null) { R.phase = 'slow'; R.slowT = 0; R.acc = 0; break; }
        }
        if (n >= cap) R.acc = 0;
        if (R.phase === 'slow') { R.slowT += dtr; if (R.slowT >= SLOW) { R.phase = 'done'; R.doneT = 0; finish(); } }
        else if (R.phase === 'done') { R.doneT += dtr; if (R.shuffle && R.doneT > SHUF_WAIT) start(pickNext()); }
      }
      FX.update(dtr * (R.phase === 'slow' ? 0.35 : 1));
    }
    if (sim) draw();
    requestAnimationFrame(frame);
  }

  // ----- drawing -----
  function chipRects(n) {
    const gap = 6, cw = Math.min(124, (W - 20 - gap * (n - 1)) / n), x0 = (W - (cw * n + gap * (n - 1))) / 2;
    return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (cw + gap), y: 76, w: cw, h: 38 }));
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function draw() {
    const sim = R.sim, st = R.st, night = sim.theme === 'night', ink = night ? '#e9e6df' : INK;
    ctx.setTransform(R.scale, 0, 0, R.scale, 0, 0);
    ctx.fillStyle = night ? NIGHT : PAPER; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (FX.sh > 0.3) ctx.translate((Math.random() - 0.5) * FX.sh, (Math.random() - 0.5) * FX.sh);
    sim.draw(st, ctx, night);
    FX.draw(ctx);
    ctx.restore();
    if (FX.flashA > 0.01) { ctx.globalAlpha = FX.flashA; ctx.fillStyle = FX.flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // HUD
    const g = ctx.createLinearGradient(0, 0, 0, 128); const bg = night ? '14,17,22' : '243,239,230';
    g.addColorStop(0, `rgba(${bg},0.96)`); g.addColorStop(0.8, `rgba(${bg},0.85)`); g.addColorStop(1, `rgba(${bg},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 128);
    D.text(ctx, sim.caption, W / 2, 26, 22, ink, 'center', 800);
    D.text(ctx, sim.name.toUpperCase(), W / 2, 54, 13, night ? '#8b93a3' : '#8a7f6c', 'center', 700);
    const vals = sim.hud(st), rects = chipRects(st.C.length);
    rects.forEach((r, i) => {
      const c = st.C[i], out = st.out[i];
      ctx.globalAlpha = out ? 0.35 : 1;
      rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = night ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; ctx.fill();
      if (R.back === i) { ctx.strokeStyle = c.c; ctx.lineWidth = 3; ctx.stroke(); }
      if (st.win === i && R.phase !== 'run') { ctx.fillStyle = rgba(c.c, 0.25); ctx.fill(); }
      const rad = Math.min(11, r.h / 2 - 6);
      D.ball(ctx, r.x + 6 + rad, r.y + r.h / 2, rad, c.c, false);
      const fs = r.w < 70 ? 15 : 19;
      D.text(ctx, String(vals[i]), r.x + 12 + rad * 2 + (r.w - 14 - rad * 2) / 2, r.y + r.h / 2 + 1, fs, out ? (night ? '#777' : '#999') : ink, 'center', 800);
      if (out) D.line(ctx, r.x + 6, r.y + r.h / 2, r.x + r.w - 6, r.y + r.h / 2, night ? '#888' : '#777', 2);
      if (R.back === i) D.text(ctx, '★', r.x + r.w - 8, r.y + 8, 12, c.c);
      ctx.globalAlpha = 1;
    });
    // footer: time + seed
    D.text(ctx, `${st.t.toFixed(1)}s`, 12, H - 14, 13, night ? '#6f7686' : '#9a8f7c', 'left', 700);
    D.text(ctx, `seed ${R.seed}`, W - 12, H - 14, 13, night ? '#6f7686' : '#9a8f7c', 'right', 600);
    if (R.speed > 1) D.text(ctx, `${R.speed}x`, W / 2, H - 14, 13, night ? '#6f7686' : '#9a8f7c', 'center', 800);

    if (R.phase === 'pre') {
      const k = R.preT / PRE;
      ctx.fillStyle = night ? 'rgba(8,10,14,0.72)' : 'rgba(40,34,26,0.62)'; rr(40, H / 2 - 80, W - 80, 150, 18); ctx.fill();
      D.text(ctx, sim.caption, W / 2, H / 2 - 38, 28, '#fff', 'center', 900);
      D.text(ctx, R.back >= 0 ? `You backed ${st.C[R.back].n}` : 'Tap a contestant to back it', W / 2, H / 2 + 4, 18, R.back >= 0 ? st.C[R.back].l : '#e8e2d6', 'center', 700);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(80, H / 2 + 36, W - 160, 8, 4); ctx.fill();
      ctx.fillStyle = '#fff'; rr(80, H / 2 + 36, (W - 160) * (1 - k), 8, 4); ctx.fill();
    }
    if (R.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
      D.text(ctx, '❚❚ paused', W / 2, H / 2, 34, '#fff');
    }
    if (R.phase === 'done') banner(night);
  }
  function banner(night) {
    const st = R.st, c = st.C[st.win], k = Math.min(1, R.doneT / 0.35), e = 1 - Math.pow(1 - k, 3);
    const y = H / 2 - 150 + (1 - e) * 60;
    ctx.globalAlpha = e;
    ctx.fillStyle = 'rgba(12,12,16,0.86)'; rr(30, y, W - 60, 300, 22); ctx.fill();
    ctx.strokeStyle = c.c; ctx.lineWidth = 4; ctx.stroke();
    D.ball(ctx, W / 2, y + 46, 24, c.c, true);
    D.text(ctx, `${c.n.toUpperCase()} WINS`, W / 2, y + 104, 46, c.l || c.c, 'center', 900);
    D.text(ctx, `in ${st.t.toFixed(1)} s`, W / 2, y + 142, 17, '#c9c4b8', 'center', 600);
    const t = store.tally[R.sim.id] || {};
    const list = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v]) => `${n} ${v}`).join('  ·  ');
    D.text(ctx, 'All-time here: ' + list, W / 2, y + 178, 15, '#a9a497', 'center', 600);
    if (R.back >= 0) {
      const ok = R.back === st.win;
      D.text(ctx, ok ? `✓ You called it! (${store.right} of ${store.total})` : `✗ You backed ${st.C[R.back].n} (${store.right} of ${store.total})`, W / 2, y + 214, 18, ok ? '#7ee2a8' : '#f0a0a0', 'center', 800);
    }
    D.text(ctx, R.shuffle ? 'Next sim in a moment…' : 'Tap for another round', W / 2, y + 260, 16, '#8f8a80', 'center', 600);
    ctx.globalAlpha = 1;
  }

  // ----- input -----
  cv.addEventListener('pointerdown', ev => {
    AU.init(); if (!AU.on && !R.userMuted) { AU.on = true; if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume(); syncButtons(); }
    const rect = cv.getBoundingClientRect(), x = (ev.clientX - rect.left) * W / rect.width, y = (ev.clientY - rect.top) * H / rect.height;
    const st = R.st, sim = R.sim; if (!st) return;
    if (R.phase === 'pre') {
      let hit = -1;
      chipRects(st.C.length).forEach((r, i) => { if (x >= r.x && x <= r.x + r.w && y >= r.y - 6 && y <= r.y + r.h + 6) hit = i; });
      if (hit < 0) {
        const pts = sim.where ? sim.where(st) : (st.balls || []).filter(b => !b.dead && b.ci != null).map(b => ({ i: b.ci, x: b.x, y: b.y, r: b.r }));
        let bd = 1e9; for (const p of pts) { const d = Math.hypot(p.x - x, p.y - y); if (d < Math.max(p.r + 24, 30) && d < bd) { bd = d; hit = p.i; } }
      }
      if (hit >= 0) { R.back = hit; AU.blip(10); }
      return;
    }
    if (R.phase === 'done') { start(R.si); return; }
    if (R.phase === 'run') R.paused = !R.paused;
  });
  window.addEventListener('keydown', e => {
    if (!R.sim) return;
    if (e.key === 'r' || e.key === 'R') start(R.si);
    else if (e.key === 'n' || e.key === 'N') start(pickNext());
    else if (e.key === ' ') { e.preventDefault(); if (R.phase === 'run') R.paused = !R.paused; }
  });
  function syncButtons() {
    $('bSpeed').textContent = R.speed + 'x';
    $('bSound').textContent = AU.on ? '🔊' : '🔇';
    $('bShuffle').classList.toggle('on', R.shuffle); $('bShuf2').classList.toggle('on', R.shuffle);
  }
  $('bRestart').onclick = () => start(R.si);
  $('bReplay').onclick = () => start(R.si, R.seed);
  $('bNext').onclick = () => start(pickNext());
  $('bSpeed').onclick = () => { R.speed = R.speed === 1 ? 2 : R.speed === 2 ? 4 : 1; syncButtons(); };
  $('bSound').onclick = () => { AU.init(); AU.on = !AU.on; R.userMuted = !AU.on; if (AU.on && AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume(); syncButtons(); };
  const toggleShuffle = () => { R.shuffle = !R.shuffle; syncButtons(); if (R.shuffle && (!R.sim || R.phase === 'done' || !document.body.classList.contains('playing'))) start(pickNext()); };
  $('bShuffle').onclick = toggleShuffle; $('bShuf2').onclick = toggleShuffle;
  $('bRandom').onclick = () => start(Math.floor(Math.random() * SIMS.length));
  $('bBack').onclick = () => { document.body.classList.remove('playing'); R.shuffle = false; syncButtons(); try { history.replaceState(null, '', location.pathname); } catch (e) { } };

  // ----- picker -----
  function updateRecord() { $('record').textContent = store.total ? `Your picks: ${store.right} of ${store.total} right` : ''; }
  function updateTile(i) { const el = document.querySelector(`.tile[data-i="${i}"] .pl`); if (el) { const n = store.played[SIMS[i].id] || 0; el.textContent = n ? `${n} played` : 'new'; } }
  function buildGrid() {
    const grid = $('grid');
    SIMS.forEach((s, i) => {
      const b = document.createElement('button'); b.className = 'tile'; b.dataset.i = i;
      b.innerHTML = `<canvas width="135" height="240"></canvas><span class="nm">${s.name}</span><span class="pl"></span>`;
      b.onclick = () => start(i); grid.appendChild(b); updateTile(i);
    });
    // thumbnails: the real opening frame of each sim, rendered one at a time
    const off = D.mk(W, H), oc = off.getContext('2d'); let i = 0;
    const next = () => {
      if (i >= SIMS.length) return;
      const s = SIMS[i], c = document.querySelector(`.tile[data-i="${i}"] canvas`);
      try {
        const st = s.init(RNG(1000 + i)); for (let k = 0; k < (s.thumbSteps || 60); k++) tickSim(s, st);
        oc.setTransform(1, 0, 0, 1, 0, 0); oc.fillStyle = s.theme === 'night' ? NIGHT : PAPER; oc.fillRect(0, 0, W, H);
        s.draw(st, oc, s.theme === 'night');
        c.getContext('2d').drawImage(off, 0, 0, W, H, 0, 0, c.width, c.height);
      } catch (e) { console.error('thumb', s.id, e); }
      i++; setTimeout(next, 16);
    };
    setTimeout(next, 50);
  }

  // ----- dev: headless fairness test (?test=1&n=200&sim=id) -----
  function runTests(n, only) {
    const out = $('testOut'); out.hidden = false; out.textContent = `Fairness test, ${n} seeds per sim\n`;
    const list = SIMS.filter(s => !only || s.id === only); let k = 0;
    const one = () => {
      if (k >= list.length) { out.textContent += '\nDONE'; window.__testDone = true; return; }
      const s = list[k++], wins = {}, ts = []; let capped = 0, slots = 0, err = '';
      try {
        for (let j = 0; j < n; j++) { const r = runRound(s, 7000 + j); slots = r.n; wins[r.win] = (wins[r.win] || 0) + 1; ts.push(r.t); if (r.capped) capped++; }
      } catch (e) { err = ' ERROR ' + e.message; }
      ts.sort((a, b) => a - b);
      const shares = Array.from({ length: slots }, (_, i) => ((wins[i] || 0) / n * slots).toFixed(2));
      out.textContent += `${s.id.padEnd(10)} med ${(ts[ts.length >> 1] || 0).toFixed(1)}s worst ${(ts[ts.length - 1] || 0).toFixed(1)}s capped ${capped}  slot share x fair: ${shares.join(' ')}${err}\n`;
      setTimeout(one, 0);
    };
    setTimeout(one, 0);
  }

  window.__ww = { R, start, SIMS };
  // ----- boot -----
  const q = new URLSearchParams(location.search);
  buildGrid(); updateRecord(); syncButtons();
  if (q.get('test')) { runTests(+q.get('n') || 200, q.get('sim')); return; }
  const qi = SIMS.findIndex(s => s.id === q.get('sim'));
  if (qi >= 0) start(qi, q.get('seed') ? (+q.get('seed') >>> 0) : null);
  else if (wide()) start(Math.floor(Math.random() * SIMS.length));
  fit();
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>
