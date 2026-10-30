/**
 * levelDefinitions.js - Adventure Regions, Branching Paths & Level Configs
 * 
 * Configures the 3 themed regions, branching routes, Main & Echo objectives,
 * moves limits, and star rating thresholds.
 */
const REGIONS = [
  {
    id: 'region_1',
    name: 'Whispering Crystal Woods',
    theme: 'nature',
    description: 'Ancient enchanted forest where the first Echo resonance was discovered.',
    accentColor: '#00e676',
    backgroundClass: 'bg-region-woods',
    unlockRequirement: null
  },
  {
    id: 'region_2',
    name: 'The Sunken Citadel',
    theme: 'abyssal',
    description: 'Submerged ruins charged with deep oceanic sapphire crystals.',
    accentColor: '#00d2ff',
    backgroundClass: 'bg-region-citadel',
    unlockRequirement: { completedLevel: 4 }
  },
  {
    id: 'region_3',
    name: 'Celestial Spire',
    theme: 'astral',
    description: 'Tower reaching above the clouds where ancient cosmic glyphs await.',
    accentColor: '#b388ff',
    backgroundClass: 'bg-region-spire',
    unlockRequirement: { completedLevel: 8 }
  }
];

const LEVELS = [
  // --- REGION 1: WHISPERING CRYSTAL WOODS ---
  {
    id: 1,
    regionId: 'region_1',
    name: 'The Resonant Clearing',
    isTutorial: true,
    tutorialMessage: 'Welcome to PuzzleQuest! Match 3 or more crystals. Match blue Sapphires to channel Echo Energy and awaken the Ancient Echo Board on the right!',
    moves: 25,
    rows: 7,
    cols: 7,
    starThresholds: [1500, 3000, 4500],
    mainObjective: {
      type: 'collect_gems',
      gemType: 'sapphire',
      required: 6,
      current: 0,
      description: 'Collect 6 Sapphire Crystals'
    },
    echoObjective: {
      targetGlyphs: 1,
      description: 'Unlock 1 Echo Rune'
    },
    nextLevels: [2, 3], // Branching paths!
    echoConfig: {
      rows: 3,
      cols: 3,
      targetGlyphs: 1,
      cells: [
        { row: 1, col: 1, type: 'barrier', state: 'locked', energyRequired: 40, runeGlyph: 'ᚠ' }
      ]
    }
  },
  {
    id: 2,
    regionId: 'region_1',
    name: 'Runic Grove (Route of Relics)',
    branch: 'A',
    description: 'Abundant in ancient relic fragments, but requires precision.',
    moves: 22,
    rows: 8,
    cols: 8,
    starThresholds: [2500, 4500, 7000],
    mainObjective: {
      type: 'collect_gems',
      gemType: 'sapphire',
      required: 10,
      current: 0,
      description: 'Collect 10 Sapphire Crystals'
    },
    echoObjective: {
      targetGlyphs: 2,
      description: 'Unlock 2 Echo Runes'
    },
    nextLevels: [4],
    rewardBonus: { fragments: 25 },
    echoConfig: {
      rows: 4,
      cols: 4,
      targetGlyphs: 2,
      cells: [
        { row: 1, col: 1, type: 'barrier', state: 'locked', energyRequired: 50, runeGlyph: 'ᚢ' },
        { row: 2, col: 2, type: 'barrier', state: 'locked', energyRequired: 50, runeGlyph: 'ᚦ' }
      ]
    }
  },
  {
    id: 3,
    regionId: 'region_1',
    name: 'Mossy Catacombs (Route of Arcana)',
    branch: 'B',
    description: 'Deeper underground caverns requiring mastery of Emerald harvesting.',
    moves: 20,
    rows: 8,
    cols: 8,
    starThresholds: [3000, 5000, 7500],
    mainObjective: {
      type: 'collect_gems',
      gemType: 'emerald',
      required: 12,
      current: 0,
      description: 'Harvest 12 Emerald Crystals'
    },
    echoObjective: {
      targetGlyphs: 2,
      description: 'Unlock 2 Echo Runes'
    },
    nextLevels: [4],
    rewardBonus: { fragments: 20 },
    echoConfig: {
      rows: 4,
      cols: 4,
      targetGlyphs: 2,
      cells: [
        { row: 0, col: 3, type: 'barrier', state: 'locked', energyRequired: 60, runeGlyph: 'ᚨ' },
        { row: 3, col: 0, type: 'barrier', state: 'locked', energyRequired: 60, runeGlyph: 'ᚱ' }
      ]
    }
  },
  {
    id: 4,
    regionId: 'region_1',
    name: 'Heart of the Sylvan Elder (Apex)',
    isBoss: true,
    moves: 20,
    rows: 8,
    cols: 8,
    starThresholds: [4000, 7000, 10000],
    mainObjective: {
      type: 'score_and_gems',
      gemType: 'sapphire',
      required: 12,
      targetScore: 4000,
      current: 0,
      description: 'Score 4,000 pts & Collect 12 Sapphires'
    },
    echoObjective: {
      targetGlyphs: 3,
      description: 'Unlock 3 Guardian Runes'
    },
    nextLevels: [5],
    echoConfig: {
      rows: 4,
      cols: 4,
      targetGlyphs: 3,
      cells: [
        { row: 0, col: 0, type: 'barrier', state: 'locked', energyRequired: 60, runeGlyph: 'ᚲ' },
        { row: 1, col: 2, type: 'barrier', state: 'locked', energyRequired: 70, runeGlyph: 'ᚷ' },
        { row: 3, col: 3, type: 'barrier', state: 'locked', energyRequired: 80, runeGlyph: 'ᚹ' }
      ]
    }
  },

  // --- REGION 2: THE SUNKEN CITADEL ---
  {
    id: 5,
    regionId: 'region_2',
    name: 'Drowned Courtyard',
    moves: 20,
    rows: 8,
    cols: 8,
    starThresholds: [3500, 6000, 9000],
    mainObjective: {
      type: 'collect_gems',
      gemType: 'sapphire',
      required: 14,
      current: 0,
      description: 'Collect 14 Sapphires from flooded depths'
    },
    echoObjective: {
      targetGlyphs: 2,
      description: 'Activate 2 Submerged Conduits'
    },
    nextLevels: [6, 7],
    echoConfig: {
      rows: 4,
      cols: 4,
      targetGlyphs: 2,
      cells: [
        { row: 1, col: 2, type: 'barrier', state: 'locked', energyRequired: 70, runeGlyph: 'ᚺ' },
        { row: 2, col: 1, type: 'barrier', state: 'locked', energyRequired: 70, runeGlyph: 'ᚾ' }
      ]
    }
  },
  {
    id: 6,
    regionId: 'region_2',
    name: 'Abyssal Vault (Volcanic Vent Path)',
    branch: 'A',
    moves: 18,
    rows: 8,
    cols: 8,
    starThresholds: [4500, 7500, 11000],
    mainObjective: {
      type: 'collect_gems',
      gemType: 'ruby',
      required: 16,
      current: 0,
      description: 'Channel 16 Ruby Fire Crystals'
    },
    echoObjective: {
      targetGlyphs: 3,
      description: 'Overload 3 Thermal Conduits'
    },
    nextLevels: [8],
    echoConfig: {
      rows: 4,
      cols: 4,
      targetGlyphs: 3,
      cells: [
        { row: 0, col: 1, type: 'barrier', state: 'locked', energyRequired: 75, runeGlyph: 'ᛁ' },
        { row: 2, col: 2, type: 'barrier', state: 'locked', energyRequired: 75, runeGlyph: 'ᛃ' },
        { row: 3, col: 0, type: 'barrier', state: 'locked', energyRequired: 80, runeGlyph: 'ᛈ' }
      ]
    }
  },
  {
    id: 7,
    regionId: 'region_2',
    name: 'Tidal Sanctum (Solar Coral Path)',
    branch: 'B',
    moves: 17,
    rows: 8,
    cols: 8,
    starThresholds: [4500, 7500, 11000],
    mainObjective: {
      type: 'collect_gems',
      gemType: 'topaz',
      required: 15,
      current: 0,
      description: 'Ignite 15 Solar Topaz Crystals'
    },
    echoObjective: {
      targetGlyphs: 3,
      description: 'Illuminate 3 Sunken Runes'
    },
    nextLevels: [8],
    echoConfig: {
      rows: 4,
      cols: 4,
      targetGlyphs: 3,
      cells: [
        { row: 1, col: 0, type: 'barrier', state: 'locked', energyRequired: 70, runeGlyph: 'ᛇ' },
        { row: 1, col: 3, type: 'barrier', state: 'locked', energyRequired: 75, runeGlyph: 'ᛉ' },
        { row: 3, col: 2, type: 'barrier', state: 'locked', energyRequired: 80, runeGlyph: 'ᛋ' }
      ]
    }
  },
  {
    id: 8,
    regionId: 'region_2',
    name: "Leviathan's Core (Abyssal Apex)",
    isBoss: true,
    moves: 18,
    rows: 8,
    cols: 8,
    starThresholds: [6000, 10000, 14000],
    mainObjective: {
      type: 'score_and_gems',
      gemType: 'sapphire',
      required: 18,
      targetScore: 6000,
      current: 0,
      description: 'Score 6,000 pts & Harvest 18 Sapphires'
    },
    echoObjective: {
      targetGlyphs: 4,
      description: 'Stabilize 4 Leviathan Runes'
    },
    nextLevels: [9],
    echoConfig: {
      rows: 4,
      cols: 4,
      targetGlyphs: 4,
      cells: [
        { row: 0, col: 0, type: 'barrier', state: 'locked', energyRequired: 80, runeGlyph: 'ᛏ' },
        { row: 0, col: 3, type: 'barrier', state: 'locked', energyRequired: 80, runeGlyph: 'ᛒ' },
        { row: 3, col: 0, type: 'barrier', state: 'locked', energyRequired: 85, runeGlyph: 'ᛖ' },
        { row: 3, col: 3, type: 'barrier', state: 'locked', energyRequired: 85, runeGlyph: 'ᛗ' }
      ]
    }
  },

  // --- REGION 3: CELESTIAL SPIRE ---
  {
    id: 9,
    regionId: 'region_3',
    name: 'Ascendant Stair',
    moves: 18,
    rows: 8,
    cols: 8,
    starThresholds: [5000, 8500, 12500],
    mainObjective: {
      type: 'collect_gems',
      gemType: 'amethyst',
      required: 16,
      current: 0,
      description: 'Harness 16 Mystic Amethysts'
    },
    echoObjective: {
      targetGlyphs: 3,
      description: 'Harmonize 3 Astral Seals'
    },
    nextLevels: [10, 11],
    echoConfig: {
      rows: 4,
      cols: 4,
      targetGlyphs: 3,
      cells: [
        { row: 1, col: 1, type: 'barrier', state: 'locked', energyRequired: 80, runeGlyph: 'ᛚ' },
        { row: 1, col: 2, type: 'barrier', state: 'locked', energyRequired: 80, runeGlyph: 'ᛜ' },
        { row: 2, col: 2, type: 'barrier', state: 'locked', energyRequired: 90, runeGlyph: 'ᛞ' }
      ]
    }
  },
  {
    id: 10,
    regionId: 'region_3',
    name: 'Nebula Rift (Chrono Path)',
    branch: 'A',
    moves: 16,
    rows: 8,
    cols: 8,
    starThresholds: [6500, 11000, 16000],
    mainObjective: {
      type: 'collect_gems',
      gemType: 'sapphire',
      required: 20,
      current: 0,
      description: 'Collect 20 High-Resonance Sapphires'
    },
    echoObjective: {
      targetGlyphs: 4,
      description: 'Seal 4 Temporal Faults'
    },
    nextLevels: [12],
    echoConfig: {
      rows: 4,
      cols: 4,
      targetGlyphs: 4,
      cells: [
        { row: 0, col: 2, type: 'barrier', state: 'locked', energyRequired: 85, runeGlyph: 'ᛟ' },
        { row: 1, col: 0, type: 'barrier', state: 'locked', energyRequired: 85, runeGlyph: 'ᚠ' },
        { row: 2, col: 3, type: 'barrier', state: 'locked', energyRequired: 90, runeGlyph: 'ᚢ' },
        { row: 3, col: 1, type: 'barrier', state: 'locked', energyRequired: 90, runeGlyph: 'ᚦ' }
      ]
    }
  },
  {
    id: 11,
    regionId: 'region_3',
    name: 'Astral Observatory (Starlight Path)',
    branch: 'B',
    moves: 16,
    rows: 8,
    cols: 8,
    starThresholds: [6500, 11000, 16000],
    mainObjective: {
      type: 'collect_gems',
      gemType: 'emerald',
      required: 18,
      current: 0,
      description: 'Align 18 Celestial Emeralds'
    },
    echoObjective: {
      targetGlyphs: 4,
      description: 'Focus 4 Cosmic Lenses'
    },
    nextLevels: [12],
    echoConfig: {
      rows: 4,
      cols: 4,
      targetGlyphs: 4,
      cells: [
        { row: 0, col: 0, type: 'barrier', state: 'locked', energyRequired: 85, runeGlyph: 'ᚨ' },
        { row: 1, col: 3, type: 'barrier', state: 'locked', energyRequired: 85, runeGlyph: 'ᚱ' },
        { row: 2, col: 0, type: 'barrier', state: 'locked', energyRequired: 90, runeGlyph: 'ᚲ' },
        { row: 3, col: 3, type: 'barrier', state: 'locked', energyRequired: 90, runeGlyph: 'ᚷ' }
      ]
    }
  },
  {
    id: 12,
    regionId: 'region_3',
    name: 'The Cosmos Gate (Grand Apex)',
    isBoss: true,
    moves: 15,
    rows: 8,
    cols: 8,
    starThresholds: [8000, 14000, 20000],
    mainObjective: {
      type: 'score_and_gems',
      gemType: 'sapphire',
      required: 22,
      targetScore: 8000,
      current: 0,
      description: 'Score 8,000 pts & Gather 22 Sapphires'
    },
    echoObjective: {
      targetGlyphs: 5,
      description: 'Awaken All 5 Primordial Seals'
    },
    nextLevels: [],
    echoConfig: {
      rows: 5,
      cols: 5,
      targetGlyphs: 5,
      cells: [
        { row: 0, col: 2, type: 'barrier', state: 'locked', energyRequired: 90, runeGlyph: 'ᚹ' },
        { row: 2, col: 0, type: 'barrier', state: 'locked', energyRequired: 90, runeGlyph: 'ᚺ' },
        { row: 2, col: 2, type: 'barrier', state: 'locked', energyRequired: 100, runeGlyph: 'ᚾ' },
        { row: 2, col: 4, type: 'barrier', state: 'locked', energyRequired: 90, runeGlyph: 'ᛁ' },
        { row: 4, col: 2, type: 'barrier', state: 'locked', energyRequired: 90, runeGlyph: 'ᛃ' }
      ]
    }
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REGIONS, LEVELS };
} else {
  window.REGIONS = REGIONS;
  window.LEVELS = LEVELS;
}
