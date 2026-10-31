/**
 * gameRoutes.js - Level Definitions & Validated Level Completion Endpoints
 */
const express = require('express');
const { REGIONS, LEVELS } = require('../data/levelDefinitions');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const validationService = require('../services/validationService');
const User = require('../models/User');
const LevelProgress = require('../models/LevelProgress');
const LeaderboardScore = require('../models/LeaderboardScore');
const { memoryStore, isUsingMemoryStore } = require('../config/db');

const router = express.Router();

/**
 * GET /api/game/levels
 * Returns adventure regions and all 12 level definitions
 */
router.get('/levels', (req, res) => {
  res.json({
    regions: REGIONS,
    levels: LEVELS
  });
});

/**
 * POST /api/game/complete-level
 * Validates match-3 results server-side and saves progress
 */
router.post('/complete-level', optionalAuth, async (req, res) => {
  try {
    const { levelId, score, stars, movesRemaining, movesUsed, durationSeconds, validationToken } = req.body;

    // Payload sanity guard check
    if (!levelId || typeof score !== 'number' || score < 0) {
      return res.status(400).json({
        error: 'Invalid completion payload: valid levelId and non-negative numeric score are required.',
        code: 'INVALID_PAYLOAD'
      });
    }

    // 1. Server-side validation
    const valResult = validationService.validateLevelResult({
      levelId,
      score,
      movesRemaining,
      movesUsed,
      durationSeconds,
      validationToken
    });

    if (!valResult.isValid) {
      return res.status(400).json({
        error: `Game result validation rejected: ${valResult.reason}`,
        code: 'VALIDATION_FAILED'
      });
    }

    const verifiedStars = valResult.verifiedStars || stars || 1;
    const bonusFragments = 15 + (verifiedStars * 10);

    // If guest player, return validated result without persisting
    if (!req.user) {
      return res.json({
        message: 'Level completed as Guest. Validation passed!',
        verifiedStars,
        bonusFragments,
        savedToCloud: false
      });
    }

    // Persist authenticated progress
    const userId = req.user.userId;

    if (isUsingMemoryStore()) {
      const user = await memoryStore.findUserById(userId);
      if (user) {
        user.totalScore = (user.totalScore || 0) + score;
        user.totalStars = (user.totalStars || 0) + verifiedStars;
        user.levelsCleared = (user.levelsCleared || 0) + 1;
        user.relicFragments = (user.relicFragments || 0) + bonusFragments;
      }
      await memoryStore.saveLevelProgress(userId, levelId, verifiedStars, score);
    } else {
      // Upsert LevelProgress
      await LevelProgress.findOneAndUpdate(
        { userId, levelId },
        {
          $max: { highScore: score, stars: verifiedStars },
          $set: { completed: true, clearedAt: new Date() }
        },
        { upsert: true, new: true }
      );

      // Update User aggregate stats
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $inc: { totalScore: score, totalStars: verifiedStars, relicFragments: bonusFragments, levelsCleared: 1 }
        },
        { new: true }
      );

      // Upsert Leaderboard entry
      if (user) {
        await LeaderboardScore.findOneAndUpdate(
          { userId },
          {
            $set: {
              username: user.username,
              adventurerTitle: user.adventurerTitle,
              totalScore: user.totalScore,
              totalStars: user.totalStars,
              levelsCleared: user.levelsCleared,
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
      }
    }

    return res.json({
      message: 'Level completion verified and saved to database!',
      verifiedStars,
      bonusFragments,
      savedToCloud: true
    });
  } catch (err) {
    console.error('[Complete Level Error]', err);
    return res.status(500).json({ error: 'Server error saving level completion.' });
  }
});

/**
 * GET /api/game/progress
 */
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (isUsingMemoryStore()) {
      const progress = await memoryStore.getLevelProgress(userId);
      return res.json({ success: true, progress });
    }
    const progress = await LevelProgress.find({ userId }).lean();
    return res.json({ success: true, progress });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch player progress.' });
  }
});

module.exports = router;
