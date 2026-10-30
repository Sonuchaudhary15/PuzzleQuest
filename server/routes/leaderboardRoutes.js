/**
 * leaderboardRoutes.js - Online Global & Regional Leaderboard Endpoints
 */
const express = require('express');
const LeaderboardScore = require('../models/LeaderboardScore');
const User = require('../models/User');
const { memoryStore, isUsingMemoryStore } = require('../config/db');

const router = express.Router();

// Fallback seed champions for empty databases to ensure demonstration is vibrant
const SEED_CHAMPIONS = [
  { username: 'Aeloria_Starfire', title: 'Grand Arch-Mage', totalScore: 42500, totalStars: 32, levelsCleared: 12 },
  { username: 'Thorne_Ironweaver', title: 'Rune Scholar', totalScore: 31200, totalStars: 24, levelsCleared: 9 },
  { username: 'Zephyr_Stormcaller', title: 'Echo Master', totalScore: 24800, totalStars: 19, levelsCleared: 7 },
  { username: 'Lyra_Gemsinger', title: 'Arcane Weaver', totalScore: 18400, totalStars: 14, levelsCleared: 5 },
  { username: 'Kaelen_Voidwalker', title: 'Crystal Seeker', totalScore: 9800, totalStars: 8, levelsCleared: 3 }
];

/**
 * GET /api/leaderboard
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

    if (isUsingMemoryStore()) {
      const memList = await memoryStore.getLeaderboard(limit);
      const combined = [...memList, ...SEED_CHAMPIONS];
      combined.sort((a, b) => b.totalScore - a.totalScore);
      return res.json({
        success: true,
        source: 'in-memory',
        entries: combined.slice(0, limit)
      });
    }

    // MongoDB query
    let entries = await LeaderboardScore.find({})
      .sort({ totalScore: -1 })
      .limit(limit)
      .lean();

    // If fresh database, supplement with seed champions
    if (!entries || entries.length === 0) {
      entries = SEED_CHAMPIONS.slice(0, limit);
    }

    return res.json({
      success: true,
      source: 'mongodb',
      entries
    });
  } catch (err) {
    console.error('[Leaderboard Error]', err);
    return res.status(500).json({ error: 'Server error retrieving leaderboard.' });
  }
});

module.exports = router;
