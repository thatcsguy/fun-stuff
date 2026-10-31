// =============================================================================
//  §3  Save — localStorage 'shatterclock.v1' (every access in try/catch,
//       in-memory defaults as a fallback).
// =============================================================================
const Save = {
  key: 'shatterclock.v1',
  data: null,
  defaults() {
    return {
      cleared: { story: [false, false, false], normal: [false, false, false], heroic: [false, false, false] },
      best: {},                       // "0_normal": {time, rank}
      talents: [0, 0],
      quality: 'auto',
      difficulty: 'normal',
      settings: { volume: CONFIG.audio.master, mute: false, shake: true, numbers: true },
      seenHints: {},
    };
  },
  load() {
    const d = this.defaults();
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          for (const k of ['story', 'normal', 'heroic']) if (s.cleared && Array.isArray(s.cleared[k])) d.cleared[k] = s.cleared[k].slice(0, 3).map(Boolean);
          if (s.best && typeof s.best === 'object') d.best = s.best;
          if (Array.isArray(s.talents)) d.talents = [s.talents[0] | 0, s.talents[1] | 0];
          if (typeof s.quality === 'string') d.quality = s.quality;
          if (typeof s.difficulty === 'string' && CONFIG.difficulty[s.difficulty]) d.difficulty = s.difficulty;
          if (s.settings && typeof s.settings === 'object') Object.assign(d.settings, s.settings);
          if (s.seenHints && typeof s.seenHints === 'object') d.seenHints = s.seenHints;
        }
      }
    } catch (e) { /* storage blocked: keep defaults */ }
    this.data = d;
    return d;
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
  get settings() { return this.data.settings; },
  /** Clearing on ANY difficulty unlocks the next boss on all difficulties (§11.2). */
  isUnlocked(i) {
    if (i <= 0) return true;
    const c = this.data.cleared;
    return !!(c.story[i - 1] || c.normal[i - 1] || c.heroic[i - 1]);
  },
  heroicUnlocked() { const n = this.data.cleared.normal; return !!(n[0] && n[1] && n[2]); },
  markCleared(i, diff, time, rank) {
    if (!this.data.cleared[diff]) return;
    this.data.cleared[diff][i] = true;
    const k = i + '_' + diff, prev = this.data.best[k];
    if (!prev || time < prev.time) this.data.best[k] = { time: +time.toFixed(1), rank };
    this.save();
  },
  seenHint(id) { if (this.data.seenHints[id]) return true; this.data.seenHints[id] = 1; this.save(); return false; },
};
Save.load();
Game.difficulty = Save.data.difficulty; Game.diff = CONFIG.difficulty[Game.difficulty];
Game.talents = Save.data.talents.slice();
