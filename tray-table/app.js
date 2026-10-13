/* Tray Table: shell (seed, order, timing, saving, screens). Game content lives in games.js. */
(function () {
  'use strict';

  var CAP = 120000;
  var KEY = 'traytable.v1';
  var THEME_KEY = 'traytable.theme';
  var CATS = {
    reflex: 'Reflex', memory: 'Memory', math: 'Quick math', words: 'Words', logic: 'Logic',
    spatial: 'Spatial', touch: 'Dexterity', curve: 'Curveball', blind: 'Figure it out'
  };
  var BLIND_TEXT = 'No instructions for this one. Poke around and work out what to do.';

  var games = [];
  var byId = {};
  var pack = { hash: 'dev' };
  var S = null;           // saved state
  var cur = null;         // running game context
  var storageOk = true;
  var devSkew = 0;
  var devLast = null;

  /* ---------- seeded randomness ---------- */
  function cyrb128(str) {
    var h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (var i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }
  function sfc32(a, b, c, d) {
    return function () {
      a |= 0; b |= 0; c |= 0; d |= 0;
      var t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(str) {
    var s = cyrb128(str);
    var f = sfc32(s[0], s[1], s[2], s[3]);
    for (var i = 0; i < 12; i++) f();
    var r = function () { return f(); };
    r.int = function (lo, hi) { return lo + Math.floor(f() * (hi - lo + 1)); };
    r.range = function (lo, hi) { return lo + f() * (hi - lo); };
    r.pick = function (a) { return a[Math.floor(f() * a.length)]; };
    r.chance = function (p) { return f() < p; };
    r.shuffle = function (a) {
      a = a.slice();
      for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(f() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    };
    r.sample = function (a, k) { return r.shuffle(a).slice(0, k); };
    r.fork = function (tag) { return makeRng(str + '/' + tag); };
    return r;
  }
  function normSeed(s) {
    s = String(s || '');
    if (s.normalize) s = s.normalize('NFC');
    return s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
  }
  var CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function checkCode(seed) {
    var hs = cyrb128(normSeed(seed) + '|' + pack.hash + '|' + games.map(function (g) { return g.id; }).join(','));
    var n = hs[0], out = '';
    for (var i = 0; i < 4; i++) { out += CODE_ABC[n & 31]; n >>>= 5; }
    return out;
  }

  function makeOrder(seed) {
    var r = makeRng(seed + '|order');
    var ids = games.map(function (g) { return g.id; });
    for (var gap = 3; gap >= 1; gap--) {
      for (var attempt = 0; attempt < 300; attempt++) {
        var pool = r.shuffle(ids), out = [], ok = true;
        while (pool.length) {
          var pick = -1;
          for (var i = 0; i < pool.length; i++) {
            var c = byId[pool[i]].cat, bad = false;
            for (var j = Math.max(0, out.length - gap); j < out.length; j++) if (byId[out[j]].cat === c) bad = true;
            if (c === 'blind' && out.length < 4) bad = true;
            if (!bad) { pick = i; break; }
          }
          if (pick < 0) { ok = false; break; }
          out.push(pool.splice(pick, 1)[0]);
        }
        if (ok) return out;
      }
    }
    return r.shuffle(ids);
  }

  /* ---------- storage ---------- */
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1 && s.order) return s;
    } catch (e) { /* ignore */ }
    return null;
  }
  function save() {
    if (!S) return;
    try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; }
    catch (e) { storageOk = false; }
  }
  function testStorage() {
    try { localStorage.setItem('traytable.t', '1'); localStorage.removeItem('traytable.t'); return true; }
    catch (e) { return false; }
  }

  /* ---------- small helpers ---------- */
  function h(tag, a) {
    var e = document.createElement(tag);
    if (a) for (var k in a) {
      var v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') { for (var sk in v) e.style[sk] = v[sk]; }
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) addKid(e, arguments[i]);
    return e;
  }
  function addKid(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) addKid(e, c[i]); return; }
    e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, a) {
    var e = document.createElementNS(SVGNS, tag);
    if (a) for (var k in a) { if (a[k] != null) e.setAttribute(k, a[k]); }
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c) e.appendChild(c); }
    return e;
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtClock(ms) {
    var t = Math.floor(Math.max(0, ms) / 100);
    return Math.floor(t / 600) + ':' + pad2(Math.floor(t / 10) % 60) + '.' + (t % 10);
  }
  function fmt(ms) {
    var t = Math.floor(Math.max(0, ms) / 100);
    var m = Math.floor(t / 600), sec = Math.floor(t / 10) % 60, d = t % 10;
    return m ? m + ':' + pad2(sec) + '.' + d : sec + '.' + d + 's';
  }
  function fmtTotal(ms) {
    var t = Math.floor(Math.max(0, ms) / 100);
    var hh = Math.floor(t / 36000), m = Math.floor(t / 600) % 60, sec = Math.floor(t / 10) % 60, d = t % 10;
    return (hh ? hh + ':' + pad2(m) : m) + ':' + pad2(sec) + '.' + d;
  }
  function perfNow() { return performance.now() + devSkew; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var ICONS = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  function icon(name) { var sp = h('span', { style: { display: 'inline-flex' } }); sp.innerHTML = ICONS[name]; return sp; }

  function mount(node) {
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(node);
    window.scrollTo(0, 0);
  }

  /* ---------- theme ---------- */
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; } }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#f3f2ee' : '#101216');
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ }
  }
  function themeBtn() {
    var b = h('button', { class: 'iconbtn', 'aria-label': 'Switch light or dark' });
    function paint() { b.innerHTML = ''; b.appendChild(icon(getTheme() === 'dark' ? 'sun' : 'moon')); }
    b.addEventListener('click', function () { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); paint(); });
    paint();
    return b;
  }

  /* ---------- offline status ---------- */
  function offlineStatus(el) {
    function set(cls, text) { el.className = 'offline ' + cls; el.innerHTML = ''; el.appendChild(h('span', { class: 'dot' })); el.appendChild(h('span', { text: text })); }
    if (!('serviceWorker' in navigator) || !window.caches) { set('warn', 'This browser can’t save the page for offline use.'); return; }
    set('', 'Saving a copy for offline use…');
    var tries = 0;
    function check() {
      caches.keys().then(function (keys) {
        var k = keys.filter(function (x) { return x.indexOf('tt-') === 0; })[0];
        if (!k) return false;
        return caches.open(k).then(function (c) { return c.keys(); }).then(function (r) { return r.length >= 10; });
      }).then(function (ok) {
        if (ok && navigator.serviceWorker.controller) set('ok', 'Ready to play offline.');
        else if (ok) set('ok', 'Saved for offline. Reload once to be sure.');
        else if (++tries < 20) setTimeout(check, 700);
        else set('warn', 'Not saved for offline yet. Reload while online.');
      }).catch(function () { set('warn', 'Not saved for offline yet. Reload while online.'); });
    }
    check();
  }

  /* ---------- screens ---------- */
  function route() {
    if (cur) return;
    if (!S) return showStart();
    if (S.active) return showResume();
    if (S.idx >= S.order.length) return showFinal();
    showIntro();
  }

  function showStart() {
    var seedIn = h('input', { id: 'seed', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'next', maxlength: '40', placeholder: 'e.g. pineapple' });
    var nameIn = h('input', { id: 'pname', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'done', maxlength: '24', placeholder: 'optional' });
    var code = h('b', { text: '—' });
    var go = h('button', { class: 'btn pri big', disabled: true, text: 'Begin' });
    var off = h('div', { class: 'offline' });
    function upd() {
      var sd = normSeed(seedIn.value);
      code.textContent = sd ? checkCode(sd) : '—';
      go.disabled = !sd;
    }
    seedIn.addEventListener('input', upd);
    seedIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') nameIn.focus(); });
    nameIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') nameIn.blur(); });
    go.addEventListener('click', function () {
      var sd = normSeed(seedIn.value);
      if (!sd) return;
      S = { v: 1, seed: sd, name: nameIn.value.trim().slice(0, 24), pack: pack.hash, order: makeOrder(sd), idx: 0, results: {}, active: null, started: Date.now(), varn: 0 };
      save();
      if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { /* ignore */ } }
      route();
    });
    var warn = testStorage() ? null : h('div', { class: 'warnbox', text: 'This tab can’t save progress (private mode?). Open the page in a normal tab before you play.' });
    mount(h('div', { class: 'scr start' },
      h('div', { class: 'bar' }, h('span', { class: 'grow' }), themeBtn()),
      h('div', { class: 'hero' },
        h('h1', { text: 'Tray Table' }),
        h('p', { text: games.length + ' tiny timed games for the long flight. Everyone uses the same seed and gets the same puzzles. Lowest total time wins.' })
      ),
      warn,
      h('div', { class: 'field' }, h('label', { for: 'seed', text: 'Seed word (everyone types the same one)' }), seedIn),
      h('div', { class: 'codebox' }, h('span', { text: 'Check code: compare it with the others' }), code),
      h('div', { class: 'field' }, h('label', { for: 'pname', text: 'Your name' }), nameIn),
      go,
      h('ul', { class: 'notes' },
        h('li', { text: 'Use a normal browser tab, not private or incognito, and stay in this same browser for the whole trip.' }),
        h('li', { text: 'Don’t clear your browser data. Progress saves after every game.' }),
        h('li', { text: 'Each game: read the card, tap Start, play. The clock keeps running if you leave the page mid-game.' }),
        h('li', { text: 'Mistakes add seconds. Every game maxes out at 2:00, and giving up counts as 2:00.' })
      ),
      off
    ));
    offlineStatus(off);
  }

  function header(left) {
    var menu = h('button', { class: 'iconbtn', 'aria-label': 'Menu' });
    menu.appendChild(icon('menu'));
    menu.addEventListener('click', showMenu);
    return h('div', { class: 'bar' }, h('div', { class: 'grow' }, left), menu);
  }
  function totalSoFar() {
    var t = 0, n = 0;
    S.order.forEach(function (id) { var r = S.results[id]; if (r) { t += r.score; n++; } });
    return { t: t, n: n };
  }
  function progressBar(done) {
    var p = h('div', { class: 'progress' }, h('i', { style: { width: (100 * done / S.order.length).toFixed(1) + '%' } }));
    return p;
  }

  function showIntro() {
    var id = S.order[S.idx], g = byId[id];
    var tot = totalSoFar();
    var startBtn = h('button', { class: 'btn pri big', text: 'Start' });
    startBtn.addEventListener('click', function () { runGame(id, {}); });
    mount(h('div', { class: 'scr intro' },
      header(h('div', {}, h('div', { class: 'small muted tnum', text: 'Game ' + (S.idx + 1) + ' of ' + S.order.length }), progressBar(S.idx))),
      h('div', { style: { height: '8px' } }),
      h('span', { class: 'chip' + (g.cat === 'blind' ? ' blind' : ''), text: CATS[g.cat] || g.cat }),
      h('h1', { class: 'title', text: g.name }),
      h('p', { class: 'how' + (g.cat === 'blind' ? ' blind' : ''), text: g.cat === 'blind' ? BLIND_TEXT : g.how }),
      h('div', { class: 'spacer' }),
      tot.n ? h('div', { class: 'kv' }, h('span', { text: 'Total so far' }), h('b', { text: fmtTotal(tot.t) })) : null,
      startBtn
    ));
  }

  function showResume() {
    var a = S.active, g = byId[a.id];
    if (!g) { S.active = null; save(); return route(); }
    var spent = clamp(Date.now() - a.wall, 0, CAP) + a.pen;
    if (spent >= CAP) {
      // The clock ran out while away.
      record(a.id, { ms: CAP, pen: a.pen, n: a.n, score: CAP, out: 'cap' });
      return showResult(a.id, S.results[a.id], {});
    }
    var b = h('button', { class: 'btn pri big', text: 'Back to the game' });
    b.addEventListener('click', function () { runGame(a.id, { resume: a }); });
    mount(h('div', { class: 'scr' },
      header(h('div', { class: 'small muted tnum', text: 'Game ' + (S.idx + 1) + ' of ' + S.order.length })),
      h('span', { class: 'chip' + (g.cat === 'blind' ? ' blind' : ''), text: CATS[g.cat] || g.cat }),
      h('h1', { class: 'title', text: g.name }),
      h('p', { class: 'how', text: 'This game was in progress when the page closed. Its clock kept running (now ' + fmt(spent) + '). The puzzle starts over from the beginning, the same as before.' }),
      h('p', { class: 'how' + (g.cat === 'blind' ? ' blind' : ''), text: g.cat === 'blind' ? BLIND_TEXT : g.how }),
      h('div', { class: 'spacer' }),
      b
    ));
  }

  function record(id, res) {
    S.results[id] = res;
    S.active = null;
    var i = S.order.indexOf(id);
    if (i >= S.idx) S.idx = i + 1;
    save();
  }

  function outcomeText(r) {
    return r.out === 'win' ? 'Solved' : r.out === 'gave' ? 'Gave up' : 'Out of time';
  }

  function confetti() {
    var box = h('div', { class: 'confetti' });
    var cols = ['--acc', '--blue', '--green', '--pink', '--yellow', '--teal'];
    for (var i = 0; i < 22; i++) {
      var a = (i / 22) * Math.PI * 2 + (i % 3) * 0.2;
      var d = 90 + (i * 37 % 80);
      var el = h('i', { style: { background: 'var(' + cols[i % cols.length] + ')' } });
      el.style.setProperty('--x', Math.round(Math.cos(a) * d) + 'px');
      el.style.setProperty('--y', Math.round(Math.sin(a) * d * 0.8 + 70) + 'px');
      el.style.setProperty('--r', (i * 47 % 360) + 'deg');
      box.appendChild(el);
    }
    document.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 1300);
  }

  function showResult(id, r, opt) {
    var g = byId[id];
    var replay = !!opt.replay;
    var cont = h('button', { class: 'btn pri big', text: replay ? 'Back to the list' : (S.idx >= S.order.length ? 'See final results' : 'Continue') });
    cont.addEventListener('click', function () { if (replay) showReplayList(); else route(); });
    var tot = totalSoFar();
    var rows = [];
    if (r.out === 'win') {
      rows.push(h('div', { class: 'kv' }, h('span', { text: 'Clock' }), h('b', { text: fmt(r.ms) })));
      rows.push(h('div', { class: 'kv' }, h('span', { text: 'Mistakes' + (r.n ? ' (' + r.n + ')' : '') }), h('b', { text: '+' + fmt(r.pen) })));
    } else {
      rows.push(h('p', { class: 'muted', text: r.out === 'gave' ? 'Giving up scores the 2:00 maximum.' : 'Every game maxes out at 2:00.' }));
    }
    var extra = [];
    if (replay) {
      var again = h('button', { class: 'btn', text: 'Same puzzle again' });
      again.addEventListener('click', function () { runGame(id, { replay: true, variation: opt.variation }); });
      var vary = h('button', { class: 'btn', text: 'New variation' });
      vary.addEventListener('click', function () { S.varn = (S.varn || 0) + 1; save(); runGame(id, { replay: true, variation: S.varn }); });
      extra.push(again, vary);
    }
    mount(h('div', { class: 'scr result' },
      replay ? h('div', { class: 'bar' }, h('span', { class: 'small muted', text: 'Replay (not scored)' + (opt.variation ? ', new variation' : '') })) :
        header(h('div', {}, h('div', { class: 'small muted tnum', text: 'Game ' + (S.order.indexOf(id) + 1) + ' of ' + S.order.length + ' done' }), progressBar(S.idx))),
      h('span', { class: 'chip' + (g.cat === 'blind' ? ' blind' : ''), text: CATS[g.cat] || g.cat }),
      h('h1', { class: 'title', text: g.name }),
      h('div', { style: { height: '6px' } }),
      h('div', { class: 'outcome ' + (r.out === 'win' ? 'win' : 'lose'), text: outcomeText(r) }),
      h('div', { class: 'bigtime', text: fmt(r.score) }),
      h('div', { class: 'card', style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, rows,
        replay ? null : h('div', { class: 'kv' }, h('span', { text: 'Total so far (' + tot.n + (tot.n === 1 ? ' game)' : ' games)') }), h('b', { text: fmtTotal(tot.t) }))),
      h('div', { class: 'spacer' }),
      extra,
      cont
    ));
    if (r.out === 'win') confetti();
  }

  function resultRows(onTap) {
    var list = h('div', { class: 'list' });
    S.order.forEach(function (id, i) {
      var r = S.results[id];
      if (!r) return;
      var g = byId[id];
      var row = h(onTap ? 'button' : 'div', { class: 'row' },
        h('span', { class: 'n', text: i + 1 }),
        h('span', { class: 'nm', text: g ? g.name : id }),
        h('span', { class: 'tm' + (r.out !== 'win' ? ' capped' : ''), text: fmt(r.score) },
          r.out === 'win' && r.pen ? h('span', { class: 'pen', text: '(+' + Math.round(r.pen / 1000) + ')' }) : null)
      );
      if (onTap) row.addEventListener('click', function () { onTap(id); });
      list.appendChild(row);
    });
    return list;
  }

  function exportText() {
    var tot = totalSoFar();
    var lines = [];
    lines.push('Tray Table' + (S.name ? ' – ' + S.name : ''));
    lines.push('Seed: ' + S.seed + ' (check ' + checkCode(S.seed) + ')');
    lines.push('Total: ' + fmtTotal(tot.t) + ' over ' + tot.n + ' of ' + S.order.length + ' games');
    lines.push('');
    S.order.forEach(function (id, i) {
      var r = S.results[id];
      if (!r) return;
      var g = byId[id];
      var extra = r.out === 'gave' ? ' (gave up)' : r.out === 'cap' ? ' (out of time)' : r.pen ? ' (incl. +' + fmt(r.pen) + ' penalties)' : '';
      lines.push((i + 1) + '. ' + (g ? g.name : id) + ': ' + fmt(r.score) + extra);
    });
    return lines.join('\n');
  }

  function copyBlock() {
    var ta = h('textarea', { class: 'export', readonly: true });
    ta.value = exportText();
    var b = h('button', { class: 'btn', text: 'Copy results as text' });
    b.addEventListener('click', function () {
      ta.value = exportText();
      function done(ok) { b.textContent = ok ? 'Copied' : 'Select the text below and copy it'; setTimeout(function () { b.textContent = 'Copy results as text'; }, 2200); }
      function fallback() {
        ta.focus(); ta.select();
        try { ta.setSelectionRange(0, ta.value.length); } catch (e) { /* ignore */ }
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        done(ok);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { done(true); }, fallback);
      else fallback();
    });
    return [b, ta];
  }

  function showFinal() {
    var tot = totalSoFar();
    var wins = S.order.filter(function (id) { return S.results[id] && S.results[id].out === 'win'; }).length;
    var rp = h('button', { class: 'btn pri big', text: 'Replay any round' });
    rp.addEventListener('click', showReplayList);
    mount(h('div', { class: 'scr final' },
      header(h('span', { class: 'brand', text: 'Tray Table' })),
      h('div', { class: 'outcome win', text: 'All ' + S.order.length + ' games done' + (S.name ? ', ' + S.name : '') }),
      h('div', {}, h('div', { class: 'muted', text: 'Total time' }), h('div', { class: 'bigtime', text: fmtTotal(tot.t) })),
      h('div', { class: 'kv' }, h('span', { text: 'Seed' }), h('b', { text: S.seed + ' · ' + checkCode(S.seed) })),
      h('div', { class: 'kv' }, h('span', { text: 'Solved' }), h('b', { text: wins + ' of ' + S.order.length })),
      rp,
      resultRows(null),
      copyBlock()
    ));
  }

  function showReplayList() {
    var back = h('button', { class: 'btn', text: 'Back to final results' });
    back.addEventListener('click', showFinal);
    mount(h('div', { class: 'scr' },
      h('div', { class: 'bar' }, h('span', { class: 'brand grow', text: 'Replay a round' }), themeBtn()),
      h('p', { class: 'muted', text: 'Replays are not scored. "Same puzzle" gives you exactly the round you all played, so you can compare notes.' }),
      resultRows(showReplayIntro),
      back
    ));
  }

  function showReplayIntro(id) {
    var g = byId[id];
    var same = h('button', { class: 'btn pri big', text: 'Same puzzle' });
    same.addEventListener('click', function () { runGame(id, { replay: true }); });
    var vary = h('button', { class: 'btn big', text: 'New variation' });
    vary.addEventListener('click', function () { S.varn = (S.varn || 0) + 1; save(); runGame(id, { replay: true, variation: S.varn }); });
    var back = h('button', { class: 'btn ghost', text: 'Back to the list' });
    back.addEventListener('click', showReplayList);
    var r = S.results[id];
    mount(h('div', { class: 'scr intro' },
      h('div', { class: 'bar' }, h('span', { class: 'small muted', text: 'Replay (not scored)' })),
      h('span', { class: 'chip' + (g.cat === 'blind' ? ' blind' : ''), text: CATS[g.cat] || g.cat }),
      h('h1', { class: 'title', text: g.name }),
      h('p', { class: 'how' + (g.cat === 'blind' ? ' blind' : ''), text: g.cat === 'blind' ? BLIND_TEXT : g.how }),
      r ? h('div', { class: 'kv' }, h('span', { text: 'Your scored time' }), h('b', { text: fmt(r.score) })) : null,
      h('div', { class: 'spacer' }),
      same, vary, back
    ));
  }

  function showMenu() {
    var tot = totalSoFar();
    var closeB = h('button', { class: 'iconbtn', 'aria-label': 'Close' });
    closeB.appendChild(icon('close'));
    var reset = h('button', { class: 'btn danger', text: 'Reset everything' });
    var armed = false;
    reset.addEventListener('click', function () {
      if (!armed) { armed = true; reset.textContent = 'Tap again to erase all progress'; setTimeout(function () { armed = false; reset.textContent = 'Reset everything'; }, 3500); return; }
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      S = null; close(); route();
    });
    var back = h('div', { class: 'sheet-back' });
    function close() { if (back.parentNode) back.parentNode.removeChild(back); }
    closeB.addEventListener('click', close);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    var sheet = h('div', { class: 'sheet' },
      h('div', { class: 'bar' }, h('span', { class: 'brand grow', text: 'Tray Table' }), themeBtn(), closeB),
      h('div', { class: 'card', style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        S.name ? h('div', { class: 'kv' }, h('span', { text: 'Player' }), h('b', { text: S.name })) : null,
        h('div', { class: 'kv' }, h('span', { text: 'Seed' }), h('b', { text: S.seed })),
        h('div', { class: 'kv' }, h('span', { text: 'Check code' }), h('b', { text: checkCode(S.seed) })),
        h('div', { class: 'kv' }, h('span', { text: 'Done' }), h('b', { text: tot.n + ' of ' + S.order.length })),
        h('div', { class: 'kv' }, h('span', { text: 'Total so far' }), h('b', { text: fmtTotal(tot.t) }))
      ),
      tot.n ? resultRows(null) : h('p', { class: 'muted', text: 'Finished games will show up here.' }),
      copyBlock(),
      storageOk ? null : h('div', { class: 'warnbox', text: 'Saving failed in this tab. Copy your results as a backup.' }),
      reset
    );
    back.appendChild(sheet);
    document.body.appendChild(back);
  }

  /* ---------- running a game ---------- */
  function runGame(id, opt) {
    var g = byId[id];
    var replay = !!opt.replay;
    var seedStr = (opt.seed || S.seed) + '|' + id + (opt.variation ? '|v' + opt.variation : '');
    var st = { ended: false, pen: 0, n: 0 };
    var timers = [], intervals = [], rafs = {}, rafN = 0, unlisten = [];

    var clockEl = h('div', { class: 'clock', text: '0:00.0' });
    var give = h('button', { class: 'giveup', text: 'Give up' });
    var statusEl = h('div', { class: 'pstatus' });
    var stage = h('div', { class: 'stage' });
    var label = replay ? 'Replay' : (S.order.indexOf(id) + 1) + '/' + S.order.length;
    var root = h('div', { class: 'play' },
      h('div', { class: 'phead' }, h('div', { class: 'pn', text: label + ' · ' + g.name }), clockEl, h('div', { class: 'side' }, give)),
      statusEl,
      stage
    );
    mount(root);

    var startWall = Date.now(), t0 = perfNow(), extra = 0;
    if (opt.resume) {
      var prior = clamp(Date.now() - opt.resume.wall, 0, CAP);
      t0 = perfNow() - prior;
      st.pen = opt.resume.pen || 0;
      st.n = opt.resume.n || 0;
      startWall = opt.resume.wall;
    }
    if (!replay) { S.active = { id: id, wall: startWall, pen: st.pen, n: st.n }; save(); }

    function elapsed() { return perfNow() - t0 + extra; }
    function scoreClock() { return elapsed() + st.pen; }

    // Count real time spent away even if the browser paused its timers.
    var hidWall = 0, hidPerf = 0;
    function onVis() {
      if (document.hidden) { hidWall = Date.now(); hidPerf = perfNow(); }
      else if (hidWall) {
        var wg = Date.now() - hidWall, pg = perfNow() - hidPerf;
        if (wg - pg > 500 && wg < 12 * 3600e3) extra += wg - pg;
        hidWall = 0;
        tick();
      }
    }
    document.addEventListener('visibilitychange', onVis);

    function tick() {
      if (st.ended) return;
      var c = scoreClock();
      clockEl.firstChild ? (clockEl.firstChild.nodeValue = fmtClock(Math.min(c, CAP))) : (clockEl.textContent = fmtClock(Math.min(c, CAP)));
      if (c >= CAP) end('cap');
    }
    var tickIv = setInterval(tick, 100);

    var armed = 0;
    give.addEventListener('click', function () {
      if (st.ended) return;
      if (!armed) {
        give.textContent = 'Sure?'; give.classList.add('arm');
        armed = setTimeout(function () { armed = 0; give.textContent = 'Give up'; give.classList.remove('arm'); }, 2500);
        return;
      }
      clearTimeout(armed);
      end('gave');
    });

    function cleanup() {
      clearInterval(tickIv);
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      for (var k in rafs) cancelAnimationFrame(rafs[k]);
      rafs = {};
      unlisten.forEach(function (f) { f(); });
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('error', onErr);
    }

    function end(out) {
      if (st.ended) return;
      st.ended = true;
      var ms = elapsed();
      cleanup();
      if (trapped && history.state && history.state.ttGame) { try { history.back(); } catch (e) { /* ignore */ } }
      stage.classList.add('over');
      var raw = Math.round(ms / 100) * 100;
      var pen = Math.round(st.pen / 100) * 100;
      if (out === 'win' && raw + pen >= CAP) out = 'cap';
      var res = { ms: Math.min(raw, CAP), pen: pen, n: st.n, score: out === 'win' ? raw + pen : CAP, out: out };
      clockEl.textContent = fmtClock(res.score);
      devLast = res;
      if (!replay) record(id, res);
      cur = null;
      var ov = h('div', { class: 'doneov ' + (out === 'win' ? 'win' : 'lose') }, h('div', { text: out === 'win' ? 'Solved!' : out === 'gave' ? 'Gave up' : 'Time’s up' }));
      stage.appendChild(ov);
      setTimeout(function () { if (!cur) showResult(id, res, opt); }, out === 'win' ? 750 : 900);
    }

    function onErr(e) {
      if (st.ended) return;
      ctx.toast('Something glitched. Tap Give up if you’re stuck.', 'bad', 3000);
      if (window.console) console.error(e && (e.error || e.message));
    }
    window.addEventListener('error', onErr);

    var ctx = {
      id: id, stage: stage, replay: replay,
      rng: makeRng(seedStr),
      w: 0, h: 0,
      h_: h, s_: s,
      get ended() { return st.ended; },
      win: function () { end('win'); },
      finish: function (ms) {
        if (st.ended || st.finishing) return;
        st.finishing = true;
        stage.classList.add('over');
        ctx.after(ms || 0, function () { end('win'); });
      },
      penalty: function (sec, el) {
        if (st.ended) return;
        st.pen += sec * 1000; st.n++;
        if (!replay && S.active) { S.active.pen = st.pen; S.active.n = st.n; save(); }
        var fx = h('span', { class: 'penfx', text: '+' + (Math.round(sec * 10) / 10) + 's' });
        clockEl.appendChild(fx);
        clockEl.classList.add('hit');
        setTimeout(function () { if (fx.parentNode) fx.parentNode.removeChild(fx); clockEl.classList.remove('hit'); }, 900);
        if (el) ctx.flash(el, 'g-bad', 450);
        tick();
      },
      status: function (t) { statusEl.textContent = t || ''; },
      on: function (target, type, fn, o) {
        var wrapped = function (e) { if (!st.ended) fn(e); };
        target.addEventListener(type, wrapped, o || false);
        unlisten.push(function () { target.removeEventListener(type, wrapped, o || false); });
        return wrapped;
      },
      tap: function (el, fn) {
        return ctx.on(el, 'pointerdown', function (e) {
          if (e.button && e.button !== 0) return;
          e.preventDefault();
          fn(e);
        });
      },
      after: function (ms, fn) {
        var t = setTimeout(function () { if (!st.ended) fn(); }, ms);
        timers.push(t);
        return t;
      },
      every: function (ms, fn) {
        var t = setInterval(function () { if (!st.ended) fn(); }, ms);
        intervals.push(t);
        return t;
      },
      cancel: function (t) { clearTimeout(t); clearInterval(t); },
      loop: function (fn) {
        var key = ++rafN, last = performance.now();
        function step(now) {
          if (st.ended) return;
          var dt = Math.min(50, Math.max(0, now - last));
          last = now;
          if (fn(dt, now) === false) { delete rafs[key]; return; }
          rafs[key] = requestAnimationFrame(step);
        }
        rafs[key] = requestAnimationFrame(step);
        return function () { cancelAnimationFrame(rafs[key]); delete rafs[key]; };
      },
      time: function () { return elapsed(); },
      flash: function (el, cls, ms) {
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
        setTimeout(function () { el.classList.remove(cls); }, ms || 420);
      },
      shake: function (el) { ctx.flash(el, 'g-shake', 340); },
      toast: function (text, kind, ms) {
        var t = h('div', { class: 'toast' + (kind ? ' ' + kind : ''), text: text });
        stage.appendChild(t);
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, ms || 900);
        return t;
      },
      expose: function (o) { ctx.exposed = o; },
      exposed: null,
      _abort: function () { if (st.ended) return; st.ended = true; cleanup(); if (cur === ctx) cur = null; }
    };
    // Older iOS ignores touch-action, so stop the page from panning under a game.
    ctx.on(stage, 'touchmove', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
    // A stray Back swipe from the screen edge shouldn't leave the page mid-game.
    var trapped = false;
    try { history.pushState({ ttGame: 1 }, ''); trapped = true; } catch (e) { /* ignore */ }
    ctx.on(window, 'popstate', function () {
      try { history.pushState({ ttGame: 1 }, ''); } catch (e) { /* ignore */ }
      ctx.toast('Tap Give up to leave a game', '', 1600);
    });
    cur = ctx;
    ctx.w = stage.clientWidth;
    ctx.h = stage.clientHeight;
    try { g.start(ctx); }
    catch (e) { onErr({ error: e, message: String(e) }); }
    return ctx;
  }

  /* ---------- service worker ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(function () { /* ignore */ });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }
      if (cur) return;
      if (document.querySelector('.updbar')) return;
      var b = h('button', { class: 'btn pri sm updbar', text: 'New version ready: tap to reload' });
      b.addEventListener('click', function () { location.reload(); });
      document.body.appendChild(b);
    });
  }

  /* ---------- public ---------- */
  window.TT = {
    CAP: CAP,
    register: function (g) { if (!byId[g.id]) { games.push(g); byId[g.id] = g; } },
    setPack: function (p) { pack = p; },
    h: h, s: s, fmt: fmt,
    makeRng: makeRng,
    get games() { return games; },
    get state() { return S; },
    get cur() { return cur; },
    dev: {
      play: function (id, seed, variation) {
        if (!S) S = { v: 1, seed: 'test', name: '', pack: pack.hash, order: games.map(function (g) { return g.id; }), idx: 0, results: {}, active: null, varn: 0, dev: true };
        return runGame(id, { replay: true, variation: variation, seed: normSeed(seed || S.seed) });
      },
      skew: function (ms) { devSkew += ms; },
      abort: function () { if (cur) cur._abort(); },
      get last() { return devLast; },
      order: makeOrder,
      code: checkCode,
      route: route,
      reload: function () { S = load(); cur = null; route(); }
    }
  };

  function boot() {
    setTheme(getTheme());
    S = load();
    if (S) {
      // Keep only known games; add any that are missing at the end.
      var known = S.order.filter(function (id) { return byId[id]; });
      games.forEach(function (g) { if (known.indexOf(g.id) < 0) known.push(g.id); });
      if (known.length !== S.order.length || known.some(function (x, i) { return x !== S.order[i]; })) {
        S.order = known;
        S.idx = 0;
        while (S.idx < S.order.length && S.results[S.order[S.idx]]) S.idx++;
        save();
      }
    }
    route();
    registerSW();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
