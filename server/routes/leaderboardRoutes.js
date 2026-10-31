/**
 * leaderboardRoutes.js - Online Global & Regional Leaderboard Endpoints
 * 
 * Provides rich, detailed rankings of realm champions with multi-category sorting:
 * - High score
 * - Star masters
 * - Levels cleared
 * - Banana puzzle solvers
 * Includes detailed adventurer dossiers, badges, and virtual identity rankings.
 */
const express = require('express');
const User = require('../models/User');
const { memoryStore, isUsingMemoryStore } = require('../config/db');

const router = express.Router();

// Seed realm champions with rich stats for demonstration
const SEED_CHAMPIONS = [
  {
    username: 'Aeloria_Starfire',
    title: 'Grand Arch-Mage',
    tier: 'Grand Master',
    avatar: '🧙‍♀️',
    totalScore: 42500,
    totalStars: 32,
    levelsCleared: 12,
    bananaSolved: 8,
    highestCombo: 7,
    relicFragments: 195,
    favoriteRelic: 'Sunbeam Lance',
    joinedAt: '2026-10-12'
  },
  {
    username: 'Thorne_Ironweaver',
    title: 'Rune Scholar',
    tier: 'Grand Master',
    avatar: '🛡️',
    totalScore: 31200,
    totalStars: 24,
    levelsCleared: 9,
    bananaSolved: 6,
    highestCombo: 6,
    relicFragments: 140,
    favoriteRelic: 'Rune Breaker',
    joinedAt: '2026-10-15'
  },
  {
    username: 'Zephyr_Stormcaller',
    title: 'Echo Master',
    tier: 'Adept Conjurer',
    avatar: '⚡',
    totalScore: 24800,
    totalStars: 19,
    levelsCleared: 7,
    bananaSolved: 5,
    highestCombo: 5,
    relicFragments: 110,
    favoriteRelic: 'Resonance Chalice',
    joinedAt: '2026-10-18'
  },
  {
    username: 'Lyra_Gemsinger',
    title: 'Arcane Weaver',
    tier: 'Adept Conjurer',
    avatar: '🧝‍♀️',
    totalScore: 18400,
    totalStars: 14,
    levelsCleared: 5,
    bananaSolved: 4,
    highestCombo: 4,
    relicFragments: 85,
    favoriteRelic: 'Astral Bomb',
    joinedAt: '2026-10-21'
  },
  {
    username: 'Kaelen_Voidwalker',
    title: 'Crystal Seeker',
    tier: 'Rune Scholar',
    avatar: '🔮',
    totalScore: 9800,
    totalStars: 8,
    levelsCleared: 3,
    bananaSolved: 2,
    highestCombo: 4,
    relicFragments: 60,
    favoriteRelic: 'Sunbeam Lance',
    joinedAt: '2026-10-25'
  }
];

function calculateTier(stars) {
  if (stars >= 12) return 'Grand Master';
  if (stars >= 8) return 'Adept Conjurer';
  if (stars >= 4) return 'Rune Scholar';
  return 'Apprentice Novice';
}

/**
 * GET /api/leaderboard
 * Query parameters:
 * - sortBy: 'score' (default) | 'stars' | 'levels' | 'banana'
 * - limit: number (default 25)
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 25);
    const sortBy = req.query.sortBy || 'score';

    let allAdventurers = [...SEED_CHAMPIONS];

    if (isUsingMemoryStore()) {
      const memUsers = Array.from(memoryStore.users.values()).map(u => ({
        username: u.username,
        title: u.adventurerTitle || 'Crystal Seeker',
        tier: calculateTier(u.totalStars || 0),
        avatar: '🧙‍♂️',
        totalScore: u.totalScore || 0,
        totalStars: u.totalStars || 0,
        levelsCleared: u.levelsCleared || 0,
        bananaSolved: typeof u.bananaSolved === 'number' ? u.bananaSolved : Math.max(0, Math.floor((u.totalScore || 0) / 2500)),
        highestCombo: Math.min(8, Math.max(3, Math.floor((u.totalStars || 0) / 2) + 2)),
        relicFragments: u.relicFragments || 50,
        favoriteRelic: 'Sunbeam Lance',
        joinedAt: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '2026-10-28'
      }));

      // Merge and deduplicate
      const seen = new Set(memUsers.map(u => u.username.toLowerCase()));
      allAdventurers = [
        ...memUsers,
        ...SEED_CHAMPIONS.filter(c => !seen.has(c.username.toLowerCase()))
      ];
    } else {
      // Fetch live MongoDB users
      const dbUsers = await User.find({})
        .select('username adventurerTitle totalScore totalStars levelsCleared relicFragments bananaSolved createdAt')
        .lean();

      if (dbUsers && dbUsers.length > 0) {
        const mappedDbUsers = dbUsers.map(u => ({
          username: u.username,
          title: u.adventurerTitle || 'Crystal Seeker',
          tier: calculateTier(u.totalStars || 0),
          avatar: '🧙‍♂️',
          totalScore: u.totalScore || 0,
          totalStars: u.totalStars || 0,
          levelsCleared: u.levelsCleared || 0,
          bananaSolved: typeof u.bananaSolved === 'number' ? u.bananaSolved : Math.max(0, Math.floor((u.totalScore || 0) / 2500)),
          highestCombo: Math.min(8, Math.max(3, Math.floor((u.totalStars || 0) / 2) + 2)),
          relicFragments: u.relicFragments || 50,
          favoriteRelic: 'Sunbeam Lance',
          joinedAt: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '2026-10-28'
        }));

        const seen = new Set(mappedDbUsers.map(u => u.username.toLowerCase()));
        allAdventurers = [
          ...mappedDbUsers,
          ...SEED_CHAMPIONS.filter(c => !seen.has(c.username.toLowerCase()))
        ];
      }
    }

    // Sort according to requested category
    allAdventurers.sort((a, b) => {
      if (sortBy === 'stars') return (b.totalStars || 0) - (a.totalStars || 0);
      if (sortBy === 'levels') return (b.levelsCleared || 0) - (a.levelsCleared || 0);
      if (sortBy === 'banana') return (b.bananaSolved || 0) - (a.bananaSolved || 0);
      return (b.totalScore || 0) - (a.totalScore || 0);
    });

    // Attach ranked metadata
    const ranked = allAdventurers.slice(0, limit).map((entry, idx) => ({
      ...entry,
      rank: idx + 1
    }));

    return res.json({
      success: true,
      sortBy,
      totalCount: allAdventurers.length,
      entries: ranked
    });
  } catch (err) {
    console.error('[Leaderboard Error]', err);
    return res.status(500).json({ error: 'Server error retrieving leaderboard.' });
  }
});

/**
 * GET /api/leaderboard/dossier/:username
 * Inspect full stats, achievements, and ranking details for a specific adventurer
 */
router.get('/dossier/:username', async (req, res) => {
  try {
    const username = req.params.username.trim().toLowerCase();
    let champion = SEED_CHAMPIONS.find(c => c.username.toLowerCase() === username);

    if (!champion) {
      if (isUsingMemoryStore()) {
        const memUser = await memoryStore.findUserByUsername(username);
        if (memUser) {
          champion = {
            username: memUser.username,
            title: memUser.adventurerTitle || 'Crystal Seeker',
            tier: calculateTier(memUser.totalStars || 0),
            avatar: '🧙‍♂️',
            totalScore: memUser.totalScore || 0,
            totalStars: memUser.totalStars || 0,
            levelsCleared: memUser.levelsCleared || 0,
            bananaSolved: typeof memUser.bananaSolved === 'number' ? memUser.bananaSolved : Math.max(0, Math.floor((memUser.totalScore || 0) / 2500)),
            highestCombo: 5,
            relicFragments: memUser.relicFragments || 50,
            favoriteRelic: 'Sunbeam Lance',
            joinedAt: memUser.createdAt ? new Date(memUser.createdAt).toISOString().split('T')[0] : '2026-10-28'
          };
        }
      } else {
        const dbUser = await User.findOne({ username }).lean();
        if (dbUser) {
          champion = {
            username: dbUser.username,
            title: dbUser.adventurerTitle || 'Crystal Seeker',
            tier: calculateTier(dbUser.totalStars || 0),
            avatar: '🧙‍♂️',
            totalScore: dbUser.totalScore || 0,
            totalStars: dbUser.totalStars || 0,
            levelsCleared: dbUser.levelsCleared || 0,
            bananaSolved: typeof dbUser.bananaSolved === 'number' ? dbUser.bananaSolved : Math.max(0, Math.floor((dbUser.totalScore || 0) / 2500)),
            highestCombo: 5,
            relicFragments: dbUser.relicFragments || 50,
            favoriteRelic: 'Sunbeam Lance',
            joinedAt: dbUser.createdAt ? new Date(dbUser.createdAt).toISOString().split('T')[0] : '2026-10-28'
          };
        }
      }
    }

    if (!champion) {
      return res.status(404).json({ error: 'Adventurer not found in realm annals.' });
    }

    return res.json({
      success: true,
      dossier: champion
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error retrieving adventurer dossier.' });
  }
});

module.exports = router;
