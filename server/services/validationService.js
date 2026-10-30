/**
 * validationService.js - Server-Side Gameplay & Score Integrity Validator
 * 
 * Verifies submitted level completions against level constraints,
 * plausible score boundaries, and move limits to prevent unauthorized score manipulation.
 */
const { LEVELS } = require('../data/levelDefinitions');

class ValidationService {
  /**
   * Validate level completion payload
   * @param {Object} data - { levelId, score, movesRemaining, movesUsed, durationSeconds, validationToken }
   * @returns {{isValid: boolean, reason?: string, verifiedStars?: number}}
   */
  validateLevelResult(data) {
    if (!data || typeof data.levelId === 'undefined' || typeof data.score === 'undefined') {
      return { isValid: false, reason: 'Missing essential completion parameters.' };
    }

    const levelDef = LEVELS.find(l => l.id === Number(data.levelId));
    if (!levelDef) {
      return { isValid: false, reason: 'Invalid or unrecognized level ID.' };
    }

    // 1. Check score positivity
    if (data.score < 0 || typeof data.score !== 'number' || isNaN(data.score)) {
      return { isValid: false, reason: 'Score must be a positive number.' };
    }

    // 2. Check moves accounting
    const totalMoves = levelDef.moves;
    if (data.movesRemaining < 0 || data.movesRemaining > totalMoves) {
      return { isValid: false, reason: 'Remaining moves exceeds level allowance.' };
    }

    // 3. Mathematical plausibility ceiling:
    // Maximum possible score per move in match-3 rarely exceeds 4,000 even with 5-combos.
    const maxPlausibleScore = (totalMoves * 4500) + 10000;
    if (data.score > maxPlausibleScore) {
      return { isValid: false, reason: 'Reported score exceeds mathematical ceiling for stage move limit.' };
    }

    // 4. Verify stars based on server-side thresholds
    let verifiedStars = 1;
    if (levelDef.starThresholds) {
      const [s1, s2, s3] = levelDef.starThresholds;
      if (data.score >= s3) verifiedStars = 3;
      else if (data.score >= s2) verifiedStars = 2;
      else if (data.score >= s1) verifiedStars = 1;
    }

    return {
      isValid: true,
      verifiedStars,
      levelDef
    };
  }
}

module.exports = new ValidationService();
