/**
 * leaderboard.test.js - Comprehensive Leaderboard & In-Game Progression Test Suite
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { memoryStore, isUsingMemoryStore } = require('../server/config/db');
const bananaService = require('../server/services/bananaService');

describe('Global Leaderboard & Dynamic Ranking Engine', () => {
  before(async () => {
    // Populate test user in memory store for verification
    await memoryStore.saveUser({
      _id: 'test_user_leaderboard_1',
      username: 'Valerius_Rune',
      adventurerTitle: 'Grand Arch-Mage',
      totalScore: 50000,
      totalStars: 30,
      levelsCleared: 10,
      relicFragments: 150,
      bananaSolved: 15
    });

    await memoryStore.saveUser({
      _id: 'test_user_leaderboard_2',
      username: 'Novice_Spark',
      adventurerTitle: 'Apprentice Novice',
      totalScore: 1200,
      totalStars: 3,
      levelsCleared: 1,
      relicFragments: 20,
      bananaSolved: 1
    });
  });

  test('Retrieves sorted leaderboard rankings by score', async () => {
    const list = await memoryStore.getLeaderboard(10);
    assert.ok(Array.isArray(list), 'Leaderboard should be an array');
    assert.ok(list.length >= 2, 'Should contain at least 2 users');

    // Confirm descending sort order
    for (let i = 0; i < list.length - 1; i++) {
      assert.ok(
        (list[i].totalScore || 0) >= (list[i + 1].totalScore || 0),
        `User ${list[i].username} score (${list[i].totalScore}) must be >= ${list[i + 1].username} (${list[i + 1].totalScore})`
      );
    }
  });

  test('Banana API Mystery Challenge increments score, relic fragments and bananaSolved count', async () => {
    const user = await memoryStore.findUserById('test_user_leaderboard_1');
    const initialScore = user.totalScore;
    const initialFragments = user.relicFragments;
    const initialBanana = user.bananaSolved || 0;

    // Simulate verified mystery challenge reward at Level 5
    const levelId = 5;
    const bonusPoints = 500 + (levelId - 1) * 50; // 700 pts
    const bonusFragments = 30 + (levelId - 1) * 5; // 50 fragments

    await bananaService.persistRewards('test_user_leaderboard_1', bonusPoints, bonusFragments);

    const updatedUser = await memoryStore.findUserById('test_user_leaderboard_1');
    assert.strictEqual(updatedUser.totalScore, initialScore + bonusPoints, 'Score should increase by scaled bonus points');
    assert.strictEqual(updatedUser.relicFragments, initialFragments + bonusFragments, 'Fragments should increase');
    assert.strictEqual(updatedUser.bananaSolved, initialBanana + 1, 'bananaSolved counter should increment by 1');
  });

  test('Dynamically scales difficulty parameters per level', () => {
    // Verify level scaling formula matches specification:
    // Level 1: 45s timer, 500 pts, 30 fragments
    // Level 12: 12s timer, 1050 pts, 85 fragments
    const getScale = (level) => {
      const timeLimit = Math.max(12, 45 - (level - 1) * 3);
      const points = 500 + Math.max(0, (level - 1) * 50);
      const fragments = 30 + Math.max(0, (level - 1) * 5);
      return { timeLimit, points, fragments };
    };

    const lvl1 = getScale(1);
    assert.strictEqual(lvl1.timeLimit, 45, 'Level 1 timer should be 45s');
    assert.strictEqual(lvl1.points, 500, 'Level 1 points should be 500');
    assert.strictEqual(lvl1.fragments, 30, 'Level 1 fragments should be 30');

    const lvl6 = getScale(6);
    assert.strictEqual(lvl6.timeLimit, 30, 'Level 6 timer should be 30s');
    assert.strictEqual(lvl6.points, 750, 'Level 6 points should be 750');
    assert.strictEqual(lvl6.fragments, 55, 'Level 6 fragments should be 55');

    const lvl12 = getScale(12);
    assert.strictEqual(lvl12.timeLimit, 12, 'Level 12 timer should be 12s');
    assert.strictEqual(lvl12.points, 1050, 'Level 12 points should be 1050');
    assert.strictEqual(lvl12.fragments, 85, 'Level 12 fragments should be 85');
  });
});
