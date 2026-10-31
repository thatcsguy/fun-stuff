// =============================================================================
//  SHATTERCLOCK — A Raid for One
//  §0/§1  Imports + CONFIG (every tunable number lives here) + HINTS
//  All NN-*.js modules are concatenated into ONE <script type="module"> and share
//  a single top-level scope. Only this file may contain `import` statements.
// =============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

window.__raidBooting = true;           // tells the classic-script watchdog the module started
const URLP = new URLSearchParams(location.search);

const CONFIG = {
  version: 'shatterclock-1',
  sim: { hz: 60, maxFrameDt: 0.1, maxSteps: 5 },

  // ---------------------------------------------------------------- player (§2.1)
  player: {
    maxHp: 1000, speed: 6.5, radius: 0.5, fullStick: 0.85,
    meleeRange: 4.5, rangedRange: 22,
    combo: { dmg: [60, 60, 120], cycle: 1.6, flux: 3 },
    needle: { dmg: 45, every: 0.8, speed: 30, flux: 2 },
    fluxMax: 100, overflowRate: 0.05,
    fractureMax: 5, fractureDecay: 8, fractureFlicker: 2,
    hourglassMax: 100,
    addTargetRange: 6, addTargetBossMin: 10,       // §2.2 targeting rule
    snapTime: 0.08,                                // facing snap when an ability fires
    seamBase: 0.4, seamGain: 1.2,                  // coat seams = 0.4 + 1.2 * flux/100
    historyHz: 30, historySeconds: 8,
    hitShake: 0.15,
  },

  // ---------------------------------------------------------------- abilities (§2.5)
  abilities: {
    dash: { cd: 6, charges: 2, dist: 8, dur: 0.16, iframes: 0.25, echoLife: 7, pdWindow: 0.20, hazardLook: 0.25,
            slip: { flux: 25, hourglass: 8, slowDur: 0.35, slowScale: 0.25, desat: 0.85, ca: 0.006, hitStop: 0.03 },
            fovKick: 4, ghosts: 5 },
    rend: { cd: 2.5, angle: 120, range: 6, dmg: 180, flux: 10, shardCount: 24, shardHold: 0.3 },
    // Shatter MENDS: every Fracture it spends heals healPer × max HP; a Grand Shatter adds grandHeal on top (5 × 2.5% + 5% = 17.5%).
    // (Healing used to come from Recall: 40% of the damage taken since your last dash. Playtest: "felt odd" → it now rides the
    //  button you already press for damage, shows as green numbers, and the HP bar previews it in green.)
    shatter: { cd: 1.0, cost: 50, base: 100, per: 150, grandMul: 1.5, healPer: 0.025, grandHeal: 0.05, grandHourglass: 10,
               hitStop: 0.04, grandHitStop: 0.07, trauma: 0.15, grandTrauma: 0.3, grandBloom: 0.8 },
    // Recall: rewind to your Echo. Untouchable while rewinding (+ invulnTail after landing); cleanses Entropy. No longer heals.
    recall: { cd: 14, dur: 0.15, invulnTail: 0.2 },
    // Stasis Lance has two modes, chosen when you throw it:
    //   INTERRUPT (a violet cast is up): unchanged — stops the cast, Flux + Hourglass + Borrowed Time, cooldown `cd`.
    //   PIERCE (no violet cast): pierceDmg to the target and every add on the line, +pierceFrac Fractures on the boss,
    //     TIME-LOCK (boss takes ×lockMul damage for lockDur s) — but the cooldown is the longer `pierceCd`.
    lance: { cd: 20, range: 25, speed: 60, dmg: 250, flux: 30, hourglass: 15, borrowed: 6, borrowedRate: 1.3, root: 3, freeze: 0.6,
             pierceCd: 32, pierceDmg: 700, pierceFrac: 2, lockDur: 5, lockMul: 1.2, pierceWidth: 1.4 },
    ult: { cost: 100, dur: 2.0, dmg: 4000, anchorDmg: 2400, timeScale: 0.2, hitStop: 0.12, trauma: 0.6, bloom: 0.7, converge: 360, slashes: 12 },
  },
  // keys shown on buttons + bindings (§6.1)
  keys: {
    dash: ['Space', 'ShiftLeft', 'ShiftRight'], rend: ['KeyQ', 'Digit1'], shatter: ['KeyE', 'Digit2'],
    recall: ['KeyR', 'Digit3'], lance: ['KeyF', 'Digit4'], ult: ['KeyT', 'Digit5'],
    pause: ['Escape', 'KeyP'], quality: ['Tab'], debug: ['Backquote'],
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  },

  // ---------------------------------------------------------------- difficulty (§5)
  difficulty: {
    story:  { id: 'story',  label: 'STORY',  hp: 0.85, dmg: 0.6,  windup: 1.3,  enrage: false },
    normal: { id: 'normal', label: 'NORMAL', hp: 1.0,  dmg: 1.0,  windup: 1.0,  enrage: true },
    heroic: { id: 'heroic', label: 'HEROIC', hp: 1.25, dmg: 1.25, windup: 0.85, enrage: true },
  },

  // ---------------------------------------------------------------- bosses (§4) — base Normal numbers
  // Boss modules (14-16) read these; difficulty multipliers are applied by the boss framework.
  bosses: [
    { key: 'pyrrha', name: 'PYRRHA', epithet: 'The Forge-Warden', hp: 46000, enrage: 225, radius: 1.8, height: 7, overlapCap: 1,
      minWindup: 1.4, tapDmg: 25, tapEvery: 2, arenaRadius: 22, expected: { expert: 125, average: 185 },
      exposure: 1.0, bloom: 0.7, grade: { lift: [0.02, 0, 0], gain: [1.05, 0.97, 0.9], gamma: [1, 1, 1], sat: 1.0 } },
    { key: 'nerith', name: 'NERITH', epithet: 'The Drowned Choir', hp: 58000, enrage: 255, radius: 1.5, height: 5, overlapCap: 2,
      minWindup: 1.2, tapDmg: 30, tapEvery: 2, arenaRadius: 20, expected: { expert: 160, average: 220 },
      exposure: 0.95, bloom: 0.9, grade: { lift: [0, 0.01, 0.03], gain: [0.92, 1.0, 1.08], gamma: [1, 1, 1], sat: 1.0 } },
    { key: 'auren', name: 'AUREN', epithet: 'The Unwound Hour', hp: 66000, enrage: 315, radius: 2.0, height: 9, overlapCap: 3,
      minWindup: 1.0, tapDmg: 35, tapEvery: 2, arenaRadius: 20, expected: { expert: 210, average: 255 },
      anchorHp: 2400, exposure: 1.0, bloom: 1.1, grade: { lift: [0, 0, 0.02], gain: [1.05, 1.0, 1.08], gamma: [1, 1, 1], sat: 0.85 } },
  ],
  boss: { walkSpeed: 2, walkRange: 5, tapRange: 5, flashDecay: 0.08, deathHitStop: 0.12, deathSlow: 0.2, deathSlowDur: 1.5,
          addExplodeRange: 5, addExplodeDmg: 1200, stokedMul: 0.10, overlapWindow: 0.8, overlapMaxDelay: 3 },

  // ---------------------------------------------------------------- talents (§2.8)
  talents: [
    [ { id: 'afterimage', name: 'AFTERIMAGE', desc: 'Your Echo detonates for 400 in a 4 m radius when you Recall.', dmg: 400, radius: 4 },
      { id: 'tripleStep', name: 'TRIPLE STEP', desc: '3 dash charges. A Perfect Dodge also adds +1 Fracture.', charges: 3 } ],
    [ { id: 'borrowedPlus', name: 'BORROWED TIME+', desc: 'Stasis Lance cooldown 14 s (Pierce 24 s); haste lasts 9 s.', lanceCd: 14, pierceCd: 24, borrowed: 9 },
      { id: 'kintsugi', name: 'KINTSUGI', desc: 'Grand Shatter heals 25% (not 17.5%) and grants a 300 golden shield for 6 s.', heal: 0.25, shield: 300, shieldDur: 6 } ],
  ],

  // ---------------------------------------------------------------- camera (§7)
  camera: {
    offset: [0, 10, 14], lookBias: 0.30, lookUp: 2.0, fov: 50, fovPortrait: 62, portraitPush: 1.15,
    // portrait: the horizontal FOV is only ~31°, so lean toward the boss far less sideways (player stays near centre),
    // and pull back a little when the boss is far to the side so both stay framed
    portraitLateralBias: 0.15, portraitWidePush: 0.25,
    // short portrait (Safari with toolbars, h/w < 1.9): the thumb cluster takes more of the height → frame the player higher
    portraitShortLookUp: 0.9,
    // landscape phone: the boss bar + cast bar block is ~74 px of a ~390 px screen → aim lower so the boss's head clears it
    lookUpCompact: 3.2,
    omega: 30,                 // critically damped spring ≈ 0.12 s settle
    zooms: [0.85, 1.0, 1.2], widen: 1.25, widenEase: 0.6,
    shake: { maxOffset: 0.6, maxRoll: 2, decay: 1.5, freq: 25 },
    maxDutch: 4,
  },

  // ---------------------------------------------------------------- post (§8.1)
  post: {
    bloom: { strength: 0.9, radius: 0.55, threshold: 0.82 },
    ca: 0.0015, caDecay: 0.25, grain: 0.03, vignette: 0.32,
    gradeLerp: 1.5,
  },

  // ---------------------------------------------------------------- telegraphs (§3)
  telegraph: {
    colors: { red: 0xff4a1c, gold: 0xffc845, violet: 0xb266ff, green: 0x5cff9b },
    halo: 0.6, rim: 0.25, rimIntensity: 1.6, gentleRim: 0.9, flash: 0.12, flashIntensity: 1.3,
    pulseLast: 0.3, y: 0.03, pool: 48, hazardPool: 32, pad: 0.15,
    tone: { f0: 220, f1: 660, vol: 0.06, voices: 3 },
  },

  pools: { projectiles: 64, adds: 12, dmgNumbers: 48, pointLights: 3, ghosts: 5, slashes: 16, groundRings: 16 },

  // ---------------------------------------------------------------- quality tiers (§12)
  quality: {
    high:   { id: 'high',   prMax: 1.75, prMin: 1.0,  bloomHalf: false, particles: 6000, shadows: true,  haze: true,  lensing: true,  godrays: true,  octaves: 4 },
    medium: { id: 'medium', prMax: 1.25, prMin: 0.85, bloomHalf: true,  particles: 4000, shadows: false, haze: false, lensing: true,  godrays: true,  octaves: 3 },
    low:    { id: 'low',    prMax: 1.0,  prMin: 0.6,  bloomHalf: true,  particles: 2000, shadows: false, haze: false, lensing: false, godrays: false, octaves: 2 },
    sampleWindow: 2, slowMs: 20, fastMs: 15, fastHold: 6, prStep: 0.15, minChangeGap: 2,
  },

  input: { deadzone: 0.12, joyBase: 120, joyKnob: 56, joyZone: 0.45, buffer: 0.2, ghostHint: 10 },
  audio: { master: 0.8 },
  debris: { shards: 400, rubble: 120 },
  ui: { dmgNumberLife: 0.9, grandLife: 1.4 },
};

// Hint strings shown on the death card (§9.1). Boss modules add their own keys.
const HINTS = {
  'Hammerfall': 'Step beside her, or dash through as the cone fills.',
  'Hymn of Stone': "Hide in a pillar's violet shadow.",
  'Fate — Converge': 'Stand on your Echo, or Recall to it.',
  'Burning': 'Interrupt the cast with Stasis Lance (keep it ready for violet casts), then Shatter to heal back up.',
  'Melee': 'Keep moving through telegraphs. Shatter heals you for every Fracture it spends: Rend, Rend, Shatter.',
  // Training Grounds
  'Pendulum Cleave': 'Step out of the cone to the side, or dash through it as it fills.',
  'Hail of Hours': 'Keep moving: one circle always lands on you. Do not fight in the pools.',
  'Gilded Toll': 'Gold means STAND IN. Soak the circle before it resolves.',
  'Inner Sanctum': 'Red donut: the safe spot is close to the boss.',
  'Outward Pulse': 'Red circle around the boss: get out.',
  'Meridian Line': 'Sidestep the line.',
  'Quarter Hours': 'Watch the order the wedges light up.',
  'Severance': 'Cross to the other half of the arena.',
  'Chime of Stasis': 'Interrupt the violet cast with Stasis Lance (F).',
  'Tremor': 'Walk into the green gap, or Phase Step when the circle at your feet closes on you.',
  'Sundial Gaze': 'Violet: stand outside the dotted circle when it resolves.',
  'Ember Pool': 'Do not stand in burning pools.',
  'Fall': 'Stay on the platform.',
};
