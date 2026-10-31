// =====================================================================
// 09_run.js: run state machine (five courts in order), the Edict pool and
// draft, persistence (rg_run, rg_best, rg_unlock), single-court mode.
//   G.run.newRun(seed?) / continueRun() / single(floor, {edicts}) / practice()
//   G.run.draftPick(i) / retryCourt() / retryPhase() / abandon()
//   G.run.state: {active, single, floor, edicts, deaths, time, seed, draft: [ids] | null}
//   G.run.EDICTS: [{id, name, rarity, desc, icon, mods}], G.run.edict(id)
//   events: runStart, floorStart {floor}, draftOpen {choices}, draftPick {id}, runEnd {results}, runAbandon
// =====================================================================
(() => {
  const EDICTS = [
    // common
    { id: 'ironheart', name: 'Ironheart', rarity: 'common', icon: '♥', desc: '+30 max HP.', mods: { maxHp: 30 } },
    { id: 'whetstone', name: 'Whetstone', rarity: 'common', icon: '⚔', desc: '+15% damage dealt.', mods: { dmgMul: 1.15 } },
    { id: 'fleetfoot', name: 'Fleetfoot', rarity: 'common', icon: '➶', desc: '+12% movement speed.', mods: { speedMul: 1.12 } },
    { id: 'secondwind', name: 'Second Wind', rarity: 'common', icon: '✚', desc: 'Mend gains a third charge.', mods: { mendCharges: 1 } },
    { id: 'wraithstep', name: 'Wraithstep', rarity: 'common', icon: '⇶', desc: 'Dash gains a third charge.', mods: { dashCharges: 1 } },
    { id: 'quickrebuke', name: 'Quick Rebuke', rarity: 'common', icon: '◐', desc: 'Rebuke cooldown 9 s → 6 s.', mods: { rebukeCd: 6 / 9 } },
    { id: 'deepbreath', name: 'Deep Breath', rarity: 'common', icon: '❦', desc: 'Mend heals 35 → 55.', mods: { mendAmt: 55 / 35 } },
    { id: 'longguard', name: 'Long Guard', rarity: 'common', icon: '⛨', desc: 'Bulwark can be held 2.5 s → 3.5 s.', mods: { shieldHold: 1.0 } },
    { id: 'zeal', name: 'Zeal', rarity: 'common', icon: '☀', desc: 'Verdict charges 40% faster.', mods: { ultRate: 1.4 } },
    // rare
    { id: 'glasscrown', name: 'Glass Crown', rarity: 'rare', icon: '♛', desc: '+40% damage dealt, −30 max HP.', mods: { dmgMul: 1.4, maxHp: -30 } },
    { id: 'hubris', name: 'Hubris', rarity: 'rare', icon: '☠', desc: '+60% damage dealt, +40% damage taken.', mods: { dmgMul: 1.6, takenMul: 1.4 } },
    { id: 'bloodlet', name: 'Bloodlet', rarity: 'rare', icon: '⚕', desc: 'Every Rend hit heals 1.', mods: { lifesteal: 1 } },
    { id: 'thornwall', name: 'Thornwall', rarity: 'rare', icon: '✦', desc: 'A Riposte that absorbed damage also stuns the boss 1.5 s.', mods: { riposteStun: 1.5 } },
    { id: 'afterimage', name: 'Afterimage', rarity: 'rare', icon: '🔥', desc: 'Dash leaves a burning trail: 8 damage per second to a boss standing in it, for 3 s.', mods: { dashTrail: true } },
    { id: 'bladeoath', name: 'Blade Oath', rarity: 'rare', icon: '⚔', desc: 'Cleave (every third Rend) deals double damage.', mods: { cleaveMul: 2 } },
    { id: 'mirrorguard', name: 'Mirror Guard', rarity: 'rare', icon: '◈', desc: 'A Bulwark held to the end fires its Riposte at ×1.5 instead of ×1.', mods: { mirrorGuard: true } },
    { id: 'penance', name: 'Penance', rarity: 'rare', icon: '✟', desc: 'Rebuke also heals 15.', mods: { rebukeHeal: 15 } },
    { id: 'exposure', name: 'Exposure', rarity: 'rare', icon: '◎', desc: 'Exposed (after an interrupt) lasts 6 s → 10 s.', mods: { exposeDur: 10 } },
    // epic
    { id: 'lastrites', name: 'Last Rites', rarity: 'epic', icon: '☥', desc: 'Once per court: survive a killing blow at 1 HP and become invulnerable for 3 s.', mods: { lastRites: true } },
    { id: 'crownbreaker', name: 'Crownbreaker', rarity: 'epic', icon: '⚡', desc: 'Verdict deals double damage.', mods: { verdictMul: 2 } },
    { id: 'executioner', name: 'Executioner', rarity: 'epic', icon: '⚰', desc: '+50% damage to a boss below 30% HP.', mods: { executioner: 0.5 } },
    { id: 'juggernaut', name: 'Juggernaut', rarity: 'epic', icon: '⛊', desc: 'Dashes go twice as far.', mods: { juggernaut: true } },
    { id: 'ashenvow', name: 'Ashen Vow', rarity: 'epic', icon: '♜', desc: 'Heal 20 on every phase transition; +25 max HP.', mods: { phaseHeal: 20, maxHp: 25 } },
    { id: 'patience', name: "Regicide's Patience", rarity: 'epic', icon: '⌛', desc: 'Bulwark cooldown 14 s → 7 s.', mods: { bulwarkCd: 0.5 } },
  ];
  const byId = {}; for (const e of EDICTS) byId[e.id] = e;
  const WEIGHT = { common: 1.0, rare: 0.55, epic: 0.3 };
  const MULT_KEYS = { dmgMul: 1, speedMul: 1, takenMul: 1, mendAmt: 1, rebukeCd: 1, ultRate: 1, cleaveMul: 1, verdictMul: 1, bulwarkCd: 1, dashCd: 1, riposteMul: 1 };
  const MAX_KEYS = { exposeDur: 1 };

  function combine(ids) {
    const m = {};
    for (const id of ids || []) {
      const e = byId[id]; if (!e) continue;
      for (const k of Object.keys(e.mods)) {
        const v = e.mods[k];
        if (MULT_KEYS[k]) m[k] = (m[k] == null ? 1 : m[k]) * v;
        else if (MAX_KEYS[k]) m[k] = Math.max(m[k] == null ? 0 : m[k], v);
        else if (typeof v === 'number') m[k] = (m[k] || 0) + v;
        else m[k] = v;
      }
    }
    return m;
  }

  // ------------------------------------------------------- storage
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  // small local RNG for drafts (deterministic per run seed + floor)
  const rng = (n) => { let s = (n >>> 0) || 1; return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  const R = G.run = {
    EDICTS, edict: (id) => byId[id] || null, combine,
    state: { active: false, single: false, floor: 0, edicts: [], deaths: 0, time: 0, seed: 0, draft: null, startedAt: 0, floorTimes: [], flawless: true },
    best: load('rg_best', { runs: 0, bestTime: null, bestFlawless: null, courts: {} }),
    unlock: load('rg_unlock', { court: 0 }),
    FLOORS: 5,
    get saved() { return load('rg_run', null); },
    hasSave() { const s = load('rg_run', null); return !!(s && s.active); },
    persist() { const s = R.state; save('rg_run', s.active && !s.single ? { active: true, floor: s.floor, edicts: s.edicts.slice(), deaths: s.deaths, time: s.time, seed: s.seed, floorTimes: s.floorTimes.slice(), draft: s.draft } : null); },
    applyMods() { try { G.player.setMods(combine(R.state.edicts)); } catch (e) { G.log.error('run.applyMods', e); } },
    newRun(seed) {
      const s = R.state;
      s.active = true; s.single = false; s.floor = 0; s.edicts = []; s.deaths = 0; s.time = 0; s.seed = seed != null ? seed : ((Date.now() ^ (Math.random() * 1e9)) >>> 0); s.draft = null; s.floorTimes = []; s.flawless = true;
      R.applyMods(); R.persist();
      G.emit('runStart', { seed: s.seed });
      R.startFloor();
    },
    continueRun() {
      const sv = load('rg_run', null); if (!sv || !sv.active) return false;
      const s = R.state;
      s.active = true; s.single = false; s.floor = sv.floor | 0; s.edicts = (sv.edicts || []).filter(id => byId[id]); s.deaths = sv.deaths | 0; s.time = +sv.time || 0; s.seed = sv.seed >>> 0; s.floorTimes = sv.floorTimes || []; s.flawless = s.deaths === 0;
      R.applyMods();
      if (sv.draft && sv.draft.length) { s.draft = sv.draft; R.openDraft(sv.draft); return true; }
      R.startFloor();
      return true;
    },
    single(floor, opts = {}) {
      const s = R.state;
      s.active = true; s.single = true; s.floor = G.clamp(floor | 0, 0, R.FLOORS - 1); s.edicts = (opts.edicts || []).filter(id => byId[id]); s.deaths = 0; s.time = 0; s.seed = 0; s.draft = null; s.floorTimes = []; s.flawless = true;
      R.applyMods();
      R.startFloor(opts);
    },
    practice() {
      const s = R.state; s.active = false; s.single = true; s.edicts = s.edicts || [];
      R.applyMods();
      G.combat.startFight('practice', { practice: true });
    },
    startFloor(opts = {}) {
      const s = R.state;
      if (!G.bosses[s.floor]) { G.log.error('run.startFloor', new Error('no boss for floor ' + s.floor)); return false; }
      R.persist();
      G.emit('floorStart', { floor: s.floor, single: s.single });
      return G.combat.startFight(s.floor, { fromPhase: opts.fromPhase || 0, skipIntro: opts.skipIntro });
    },
    // called by the UI on victory of the current court
    onVictory(results) {
      const s = R.state; if (!s.active) return;
      const ft = results ? results.time : (G.combat.fightTime || 0);
      s.time += ft; s.floorTimes[s.floor] = ft;
      // records
      const b = R.best; b.courts = b.courts || {};
      const key = String(s.floor); const prev = b.courts[key] || { kills: 0, best: null };
      prev.kills++; if (prev.best == null || ft < prev.best) prev.best = ft; b.courts[key] = prev;
      if (!s.single) { R.unlock.court = Math.max(R.unlock.court | 0, Math.min(R.FLOORS - 1, s.floor + 1)); save('rg_unlock', R.unlock); }
      save('rg_best', b);
      if (s.single) { s.active = false; R.persist(); return 'single'; }
      if (s.floor >= R.FLOORS - 1) { return R.finishRun(); }
      // draft
      const choices = R.rollDraft(); s.draft = choices; R.persist();
      return 'draft';
    },
    rollDraft() {
      const s = R.state;
      const r = rng((s.seed + s.floor * 7919 + s.edicts.length * 131) >>> 0);
      const pool = EDICTS.filter(e => !s.edicts.includes(e.id));
      const out = [];
      // guarantee a spread: at most one epic, at least one common
      for (let k = 0; k < 3 && pool.length; k++) {
        let tot = 0; const ws = pool.map(e => { let w = WEIGHT[e.rarity] || 1; if (e.rarity === 'epic' && out.some(o => byId[o].rarity === 'epic')) w = 0; if (k === 2 && !out.some(o => byId[o].rarity === 'common') && e.rarity !== 'common') w = 0; tot += w; return w; });
        let x = r() * tot, i = 0; for (; i < pool.length - 1; i++) { x -= ws[i]; if (x <= 0) break; }
        out.push(pool[i].id); pool.splice(i, 1);
      }
      return out;
    },
    openDraft(choices) {
      const s = R.state; s.draft = choices;
      if (G.setState) G.setState('draft'); else G.state = 'draft';
      G.emit('draftOpen', { choices, floor: s.floor });
    },
    draftPick(i) {
      const s = R.state; if (!s.draft) return false;
      const id = typeof i === 'string' ? i : s.draft[i | 0]; if (!id || !byId[id]) return false;
      s.edicts.push(id); s.draft = null; s.floor++;
      R.applyMods(); R.persist();
      G.emit('draftPick', { id, floor: s.floor });
      return R.startFloor();
    },
    retryCourt() { const s = R.state; if (!s.active) return false; s.deaths++; s.flawless = false; R.persist(); return R.startFloor({ skipIntro: true }); },
    retryPhase() { const s = R.state; if (s.active) { s.deaths++; s.flawless = false; R.persist(); } return G.combat.retryPhase(); },
    abandon() { const s = R.state; s.active = false; s.draft = null; R.persist(); G.emit('runAbandon', {}); },
    finishRun() {
      const s = R.state;
      const res = { time: s.time, deaths: s.deaths, flawless: s.deaths === 0, edicts: s.edicts.slice(), floorTimes: s.floorTimes.slice() };
      const b = R.best; b.runs = (b.runs | 0) + 1;
      if (b.bestTime == null || s.time < b.bestTime) b.bestTime = s.time;
      if (res.flawless && (b.bestFlawless == null || s.time < b.bestFlawless)) b.bestFlawless = s.time;
      save('rg_best', b);
      R.unlock.court = R.FLOORS - 1; R.unlock.crowned = true; save('rg_unlock', R.unlock);
      s.active = false; R.persist();
      R.lastResults = res;
      G.emit('runEnd', { results: res });
      return 'end';
    },
    reset() { save('rg_run', null); },
    init() {
      // ?run=1 starts a run; ?boss=N a single court; ?edicts=a,b applies edicts to it
      G.on('booted', () => {
        const p = G.params;
        if (p.run) R.newRun(p.seed != null ? p.seed : undefined);
        else if (p.boss) R.single(p.boss - 1, { edicts: p.edicts, fromPhase: p.phase ? p.phase - 1 : 0 });
        else if (p.practice) R.practice();
      });
    },
  };
})();
