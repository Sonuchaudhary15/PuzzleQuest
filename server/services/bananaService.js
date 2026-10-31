/**
 * bananaService.js - Banana API Proxy & Secure Verification Service
 * 
 * Interoperability with the University of Bedfordshire Banana API:
 * https://marcconrad.com/uob/banana/doc.php
 * 
 * Confirmed Contract:
 * - URL: https://marcconrad.com/uob/banana/api.php?out=json
 * - Method: GET
 * - Response: { question: "<image_url>", solution: <integer> }
 * 
 * Security & Anti-Cheat Architecture:
 * - The backend acts as a proxy to fetch the external challenge.
 * - The expected 'solution' is cached on the server with a unique challengeId.
 * - The 'solution' is NEVER exposed to client-side JavaScript or network payloads.
 * - Challenges are single-use; the challenge is deleted immediately upon submission
 *   to strictly prevent replay attacks and duplicate reward claims.
 */

const crypto = require('crypto');
const User = require('../models/User');
const { memoryStore, isUsingMemoryStore } = require('../config/db');

// In-memory cache for pending challenges: challengeId -> { solution, expiresAt }
const activeChallenges = new Map();

// Periodic cleanup of expired challenges (every 5 minutes)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, record] of activeChallenges.entries()) {
    if (record.expiresAt < now) {
      activeChallenges.delete(id);
    }
  }
}, 5 * 60 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

class BananaService {
  constructor() {
    this.apiUrl = process.env.BANANA_API_URL || 'https://marcconrad.com/uob/banana/api.php';
    this.timeoutMs = parseInt(process.env.BANANA_API_TIMEOUT_MS, 10) || 6000;
  }

  /**
   * Request an external puzzle from Banana API and create a secure session
   * @param {number} maxRetries - Number of retry attempts on transient network error
   * @returns {Promise<{success: boolean, challenge?: Object, error?: string}>}
   */
  async requestChallenge(maxRetries = 2) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.apiUrl}?out=json`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`External service responded with HTTP status ${response.status}`);
        }

        const data = await response.json();

        // Validate documented contract
        if (!data || typeof data.question !== 'string' || typeof data.solution === 'undefined') {
          throw new Error('Invalid response structure received from Banana API');
        }

        // Generate secure session ID
        const challengeId = crypto.randomUUID();
        const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes expiry

        // Cache solution server-side ONLY
        activeChallenges.set(challengeId, {
          solution: parseInt(data.solution, 10),
          questionUrl: data.question,
          expiresAt
        });

        // Return challenge to client WITHOUT the solution
        return {
          success: true,
          challenge: {
            challengeId,
            question: data.question,
            expiresInSeconds: 600
          }
        };
      } catch (err) {
        clearTimeout(timeout);
        lastError = err;
        if (attempt <= maxRetries) {
          // Exponential backoff delay
          await new Promise(r => setTimeout(r, attempt * 400));
        }
      }
    }

    const isTimeout = lastError?.name === 'AbortError';
    const message = isTimeout
      ? 'External University Banana API timed out after 6 seconds.'
      : `Banana API communication error: ${lastError?.message}`;

    console.warn(`[BananaService] ${message}`);

    return {
      success: false,
      error: 'The University Banana API service is temporarily unreachable. Mystery challenge is unavailable.'
    };
  }

  /**
   * Verify submitted answer, invalidate challenge, and award bonus rewards
   * @param {string} challengeId
   * @param {string|number} submittedAnswer
   * @param {string} [userId] - Optional authenticated user ID
   * @param {number} [levelId] - Current level ID for difficulty-scaled bonus
   * @returns {Promise<{success: boolean, isCorrect: boolean, pointsAwarded?: number, fragmentsAwarded?: number, movesAwarded?: number, error?: string}>}
   */
  async verifyAnswer(challengeId, submittedAnswer, userId = null, levelId = 1) {
    if (!challengeId || typeof submittedAnswer === 'undefined') {
      return { success: false, error: 'Challenge ID and answer are required.' };
    }

    const session = activeChallenges.get(challengeId);

    if (!session) {
      return {
        success: false,
        error: 'Challenge not found, expired, or already answered. Please summon a new mystery challenge.'
      };
    }

    // Immediately consume challenge to prevent duplicate rewards (Single-use token)
    activeChallenges.delete(challengeId);

    if (Date.now() > session.expiresAt) {
      return { success: false, error: 'Challenge has expired.' };
    }

    const playerAnswer = parseInt(submittedAnswer, 10);
    const isCorrect = playerAnswer === session.solution;

    if (!isCorrect) {
      return {
        success: true,
        isCorrect: false,
        message: 'Incorrect solution. The arcane seal remains locked.'
      };
    }

    // Award bonus resources scaled dynamically with level difficulty
    const lvl = Math.max(1, parseInt(levelId, 10) || 1);
    const pointsAwarded = 500 + Math.max(0, (lvl - 1) * 50);
    const fragmentsAwarded = 30 + Math.max(0, (lvl - 1) * 5);
    const movesAwarded = 2;

    // Persist rewards if user is authenticated
    if (userId) {
      await this.persistRewards(userId, pointsAwarded, fragmentsAwarded);
    }

    return {
      success: true,
      isCorrect: true,
      pointsAwarded,
      fragmentsAwarded,
      movesAwarded,
      message: `Magnificent! You solved the mystery equation and unlocked +${pointsAwarded} points, +${movesAwarded} extra moves, and +${fragmentsAwarded} relic fragments!`
    };
  }

  /**
   * Update authenticated player record in MongoDB or memory store
   */
  async persistRewards(userId, points, fragments) {
    try {
      const mongoose = require('mongoose');
      if (isUsingMemoryStore() || !mongoose.Types.ObjectId.isValid(userId)) {
        const user = await memoryStore.findUserById(userId);
        if (user) {
          user.totalScore = (user.totalScore || 0) + points;
          user.relicFragments = (user.relicFragments || 0) + fragments;
          user.bananaSolved = (user.bananaSolved || 0) + 1;
        }
      } else {
        await User.findByIdAndUpdate(userId, {
          $inc: { totalScore: points, relicFragments: fragments, bananaSolved: 1 }
        });
      }
    } catch (err) {
      console.error('[BananaService] Failed to persist rewards to database:', err);
    }
  }

  /**
   * Test-only helper: seed a known challenge into the active cache.
   * Allows unit tests to verify forge-trial logic without hitting the real API.
   * Only call this from test files — never from production routes.
   */
  _seedTestChallenge(challengeId, solution, ttlMs = 600000) {
    activeChallenges.set(challengeId, {
      solution,
      expiresAt: Date.now() + ttlMs,
      userId: null
    });
  }
}

module.exports = new BananaService();
