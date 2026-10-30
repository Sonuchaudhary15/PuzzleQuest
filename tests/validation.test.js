/**
 * validation.test.js - Unit Tests for Anti-Tamper Score & Level Validation
 * 
 * Tests:
 * 1. Valid completion payloads
 * 2. Rejection of negative scores
 * 3. Rejection of impossible / manipulated scores
 * 4. Star rating evaluation based on level thresholds
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const validationService = require('../server/services/validationService');

describe('Server-Side Score & Integrity Validation', () => {
  test('Validates legitimate level completion and calculates correct stars', () => {
    // Level 1: thresholds [1500, 3000, 4500], moves: 25
    const payload = {
      levelId: 1,
      score: 4800,
      movesRemaining: 10,
      movesUsed: 15,
      durationSeconds: 45,
      validationToken: 'val_abc123'
    };

    const res = validationService.validateLevelResult(payload);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.verifiedStars, 3, 'Score 4800 meets 3-star threshold (>= 4500)');
  });

  test('Rejects negative or NaN scores', () => {
    const resNegative = validationService.validateLevelResult({
      levelId: 1,
      score: -500,
      movesRemaining: 5
    });
    assert.strictEqual(resNegative.isValid, false);

    const resNaN = validationService.validateLevelResult({
      levelId: 1,
      score: NaN,
      movesRemaining: 5
    });
    assert.strictEqual(resNaN.isValid, false);
  });

  test('Rejects absurd / manipulated score exceeding mathematical ceiling', () => {
    const resExploit = validationService.validateLevelResult({
      levelId: 1,
      score: 999999999, // Impossible hack
      movesRemaining: 20
    });
    assert.strictEqual(resExploit.isValid, false);
    assert.match(resExploit.reason, /exceeds mathematical ceiling/);
  });

  test('Rejects remaining moves exceeding level allowance', () => {
    const resMoves = validationService.validateLevelResult({
      levelId: 1, // Max moves is 25
      score: 2000,
      movesRemaining: 50
    });
    assert.strictEqual(resMoves.isValid, false);
    assert.match(resMoves.reason, /Remaining moves exceeds level allowance/);
  });
});
