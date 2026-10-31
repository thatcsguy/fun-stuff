   9  HAZARD RESOLVER
   ===================================================================== */
const HZ_MISS = 0, HZ_GRAZE = 1, HZ_PERFECT = 2, HZ_IFRAME = 3, HZ_HIT = 4;
// d: signed distance (player hurtbox surface to hazard surface; <0 overlapping). band: graze band width beyond 0.
function resolveHazard(d, band, col, dmg, canGraze, amt = 8, sx = player.x, sz = player.z) {
  if (!player.alive) return HZ_MISS;
  if (d < 0) {
    if (player.dashI > 0) { if (canGraze && player.perfectsThisDash < 3) { onPerfect(col, sx, sz); return HZ_PERFECT; } return HZ_IFRAME; }
    if (player.hurtI > 0 || player.invuln > 0 || game.state !== 'fight' || debug.god) {
      if (debug.god && game.state === 'fight' && player.hurtI <= 0 && player.invuln <= 0 && player.dashI <= 0) { player.hurtI = 0.25; }
      return HZ_IFRAME;
    }
    damagePlayer(dmg, col); return HZ_HIT;
  }
  if (canGraze && d < band) { onGraze(col, amt, sx, sz); return HZ_GRAZE; }
  return HZ_MISS;
}

/* =====================================================================
   shared runtime state (game, settings, debug, director scalars)
   ===================================================================== */
const settings = { quality: 'auto', reduceFx: false, volume: 0.8 };
const debug = { god: false, timeScale: 1 };
const game = { state: 'title', prevState: 'title', bossIdx: 0, runMode: 'full', fightTime: 0, runTime: 0, bossTimes: [null, null, null], facets: [],
  stats: { grazes: 0, perfects: 0, deaths: 0, time: 0 }, sat: 0.15, satTarget: 0.15, tutorial: {}, defeatT: -1, arenaR: 15, gravity: 0, arenaCut: { on: false, nx: 0, nz: 1, off: 1 } };
game.sat = game.satTarget = SAT_TITLE;
const director = { trauma: 0, hitstopT: 0, bloomBoost: 0, aberr: 0, timeScale: 1, cine: null, ct: 0, evI: 0, camOverride: false,
  camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), fov: 0, shockT: -1, shockX: 0.5, shockY: 0.5, shockStr: 0.05 };
function addTrauma(t) { director.trauma = Math.min(1, director.trauma + t); }
function hitstop(t) { director.hitstopT = Math.max(director.hitstopT, t); }
function bloomSpike(v) { director.bloomBoost = Math.max(director.bloomBoost, v); }
function aberrSpike(v) { director.aberr = Math.max(director.aberr, v); }
function shockAt(x, y, z, str = 0.05) {
  _v1.set(x, y, z).project(camera); director.shockX = _v1.x * 0.5 + 0.5; director.shockY = _v1.y * 0.5 + 0.5; director.shockT = 0; director.shockStr = str;
}
function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }

/* =====================================================================
