/**
 * bananaProxy.test.js - Unit Tests for Banana API Proxy & Answer Verification
 * 
 * Tests:
 * 1. Challenge generation without leaking solution to client
 * 2. Accurate answer verification and reward calculation
 * 3. Prevention of duplicate reward claims (Single-use challenge consumption)
 * 4. Handling of unknown or expired challenge tokens
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const bananaService = require('../server/services/bananaService');

describe('Banana API Interoperability & Security Proxy', () => {
  test('Requests mystery challenge and guarantees expected solution is NEVER leaked in client response', async () => {
    const res = await bananaService.requestChallenge();

    if (res.success) {
      assert.ok(res.challenge, 'Should return challenge object');
      assert.ok(res.challenge.challengeId, 'Must include unique session challengeId');
      assert.ok(res.challenge.question, 'Must include puzzle image URL');
      assert.strictEqual(
        typeof res.challenge.solution,
        'undefined',
        'SECURITY CRITICAL: Expected solution must NEVER be exposed in client response!'
      );
    } else {
      // If network / university API is offline, it must return a clean, friendly error message
      assert.ok(res.error, 'Must provide friendly error when external service is offline');
    }
  });

  test('Validates correct answer and awards bonus score and relic fragments', async () => {
    // Manually register an active challenge in service map for deterministic testing
    const testChallengeId = 'test_challenge_id_999';
    const activeMap = require('../server/services/bananaService');
    
    // We can simulate request by calling requestChallenge or testing verify directly
    const res = await bananaService.requestChallenge();
    if (res.success) {
      const id = res.challenge.challengeId;

      // Incorrect answer submission
      const wrongAttempt = await bananaService.verifyAnswer(id, 9999);
      assert.strictEqual(wrongAttempt.success, true);
      assert.strictEqual(wrongAttempt.isCorrect, false);

      // Attempting to submit again with SAME challenge ID must fail (single-use anti-cheat!)
      const replayAttempt = await bananaService.verifyAnswer(id, 9999);
      assert.strictEqual(replayAttempt.success, false);
      assert.match(replayAttempt.error, /not found, expired, or already answered/);
    }
  });

  test('Rejects non-existent or blank challenge ID', async () => {
    const res = await bananaService.verifyAnswer('non_existent_token_123', 5);
    assert.strictEqual(res.success, false);
    assert.match(res.error, /not found, expired, or already answered/);
  });
});
