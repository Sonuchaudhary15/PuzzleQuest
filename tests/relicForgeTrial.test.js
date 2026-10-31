/**
 * relicForgeTrial.test.js
 * Tests for Relic Forge Trial — Banana API equation-gating & 2-per-day daily limit enforcement.
 * Tests the server-side logic directly (no HTTP layer needed).
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { memoryStore, isUsingMemoryStore } = require('../server/config/db');
const bananaService = require('../server/services/bananaService');

const TODAY = new Date().toISOString().split('T')[0];

// ── Replicate the server-side route logic from POST /api/relics/forge-trial ──
async function runForgeTrial({ user, relicType, challengeId, answer }) {
  const today = new Date().toISOString().split('T')[0];

  if (!user) return { status: 404, body: { error: 'User not found' } };

  if (user.dailyForgeDate !== today) {
    user.dailyForgeDate = today;
    user.dailyForgeCount = 0;
  }

  if ((user.dailyForgeCount || 0) >= 2) {
    return {
      status: 400,
      body: {
        error: 'Daily Forge limit reached.',
        dailyFusesRemaining: 0,
        dailyForgeCount: user.dailyForgeCount
      }
    };
  }

  const verifyResult = await bananaService.verifyAnswer(challengeId, answer, null);
  if (!verifyResult.success || !verifyResult.isCorrect) {
    return {
      status: 400,
      body: { success: false, isCorrect: false, error: verifyResult.error || 'Wrong answer' }
    };
  }

  user.dailyForgeCount = (user.dailyForgeCount || 0) + 1;
  return {
    status: 200,
    body: {
      success: true,
      relicType,
      dailyForgeCount: user.dailyForgeCount,
      dailyFusesRemaining: Math.max(0, 2 - user.dailyForgeCount)
    }
  };
}

describe('Relic Forge Trial — Daily Limit & Banana Equation Gating', () => {
  // Each test creates its own isolated user object — no shared state issues
  it('Blocks forge trial when daily limit of 2 is already reached', async () => {
    const user = { _id: 'ft1', dailyForgeDate: TODAY, dailyForgeCount: 2, relicFragments: 200 };

    const res = await runForgeTrial({
      user,
      relicType: 'row_clear',
      challengeId: 'dummy-challenge',
      answer: 5
    });

    assert.equal(res.status, 400, 'Should return 400 when daily limit is reached');
    assert.equal(res.body.dailyFusesRemaining, 0, 'dailyFusesRemaining should be 0');
    assert.ok(res.body.error.toLowerCase().includes('limit'), 'Error message should mention limit');
    assert.equal(user.dailyForgeCount, 2, 'Count should remain at 2 (not incremented)');
  });

  it('Resets daily count when date has changed (next day scenario)', async () => {
    const user = { _id: 'ft2', dailyForgeDate: '2000-01-01', dailyForgeCount: 2, relicFragments: 200 };

    // Even with old exhausted count, new day resets it
    // Will fail at bananaService verify (non-existent challengeId) but passes the limit gate
    const res = await runForgeTrial({
      user,
      relicType: 'row_clear',
      challengeId: 'nonexistent-id',
      answer: 0
    });

    // Should NOT be blocked by old day count — date reset happened
    assert.equal(user.dailyForgeDate, TODAY, 'dailyForgeDate should update to today');
    assert.equal(user.dailyForgeCount, 0, 'dailyForgeCount should have been reset to 0');
    // Verify it was blocked by wrong answer, not by limit
    assert.equal(res.status, 400, 'Wrong answer should return 400');
    assert.ok(!res.body.dailyFusesRemaining === false || res.body.dailyFusesRemaining !== 0,
      'Should not be a limit error — dailyFusesRemaining should not be 0 unless wrong');
  });

  it('Rejects an invalid / non-existent challengeId', async () => {
    const user = { _id: 'ft3', dailyForgeDate: TODAY, dailyForgeCount: 0, relicFragments: 200 };

    const res = await runForgeTrial({
      user,
      relicType: 'row_clear',
      challengeId: 'totally-fake-challenge-id-xyz-99999',
      answer: 5
    });

    assert.equal(res.status, 400, 'Non-existent challenge should return 400');
    assert.equal(res.body.isCorrect, false, 'isCorrect should be false');
    assert.equal(user.dailyForgeCount, 0, 'dailyForgeCount must NOT increment on failure');
  });

  it('Tracks dailyForgeCount correctly: first successful forge returns 1 remaining', async () => {
    const user = { _id: 'ft4', dailyForgeDate: TODAY, dailyForgeCount: 0, relicFragments: 200 };

    // Seed a live challenge via the test helper
    const challengeId = 'forge-unit-test-' + Date.now();
    const solution = 7;
    bananaService._seedTestChallenge(challengeId, solution);

    const res = await runForgeTrial({
      user,
      relicType: 'barrier_breaker',
      challengeId,
      answer: solution
    });

    assert.equal(res.status, 200, 'Correct answer with valid challenge should succeed');
    assert.equal(res.body.success, true, 'success should be true');
    assert.equal(res.body.dailyForgeCount, 1, 'dailyForgeCount should be 1 after first forge');
    assert.equal(res.body.dailyFusesRemaining, 1, 'One fusion remaining after first use');
    assert.equal(res.body.relicType, 'barrier_breaker', 'relicType should echo back');
  });

  it('Allows exactly 2 fusions per day then blocks the third', async () => {
    const user = { _id: 'ft5', dailyForgeDate: TODAY, dailyForgeCount: 0, relicFragments: 200 };

    // Fusion 1
    const cid1 = 'forge-limit-test-1-' + Date.now();
    bananaService._seedTestChallenge(cid1, 4);
    const res1 = await runForgeTrial({ user, relicType: 'row_clear', challengeId: cid1, answer: 4 });
    assert.equal(res1.status, 200, 'First fusion should succeed');
    assert.equal(res1.body.dailyForgeCount, 1, 'Count should be 1');

    // Fusion 2
    const cid2 = 'forge-limit-test-2-' + Date.now();
    bananaService._seedTestChallenge(cid2, 9);
    const res2 = await runForgeTrial({ user, relicType: 'echo_amplifier', challengeId: cid2, answer: 9 });
    assert.equal(res2.status, 200, 'Second fusion should succeed');
    assert.equal(res2.body.dailyForgeCount, 2, 'Count should be 2');
    assert.equal(res2.body.dailyFusesRemaining, 0, 'No fusions remaining after 2nd');

    // Fusion 3 — must be blocked
    const res3 = await runForgeTrial({
      user, relicType: 'row_clear', challengeId: 'any-challenge', answer: 5
    });
    assert.equal(res3.status, 400, 'Third fusion must be blocked by daily limit');
    assert.equal(res3.body.dailyFusesRemaining, 0, 'No fusions remaining');
    assert.ok(res3.body.error.toLowerCase().includes('limit'), 'Error should mention limit');
    assert.equal(user.dailyForgeCount, 2, 'Count stays at 2 after blocked attempt');
  });
});
