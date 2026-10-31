/**
 * adventureMapResume.test.js - Adventure Map Progression & Level Resume Test Suite
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { memoryStore } = require('../server/config/db');
const { LEVELS, REGIONS } = require('../client/data/levelDefinitions');

describe('Adventure Map Progression & Quest Resume Architecture', () => {
  const testUserId = 'user_adventure_resume_test';

  before(async () => {
    // Clear any previous progress for isolated test run
    memoryStore.progress.clear();
  });

  test('Adventure definitions contain 3 regions and 12 fully configured levels', () => {
    assert.strictEqual(REGIONS.length, 3, 'Should define exactly 3 themed regions');
    assert.strictEqual(LEVELS.length, 12, 'Should define 12 total adventure stages');

    // Level 1 branching paths
    const lvl1 = LEVELS.find(l => l.id === 1);
    assert.ok(lvl1, 'Level 1 must exist');
    assert.deepStrictEqual(lvl1.nextLevels, [2, 3], 'Level 1 must branch into levels 2 and 3');

    // Boss levels
    const bossLvl4 = LEVELS.find(l => l.id === 4);
    assert.ok(bossLvl4.isBoss, 'Level 4 must be Apex Boss of Region 1');
    const bossLvl12 = LEVELS.find(l => l.id === 12);
    assert.ok(bossLvl12.isBoss, 'Level 12 must be Grand Apex Boss of Region 3');
  });

  test('Saves level progress with stars and high score in database store', async () => {
    // Save completion of Level 1 with 3 stars and 3800 score
    const saved = await memoryStore.saveLevelProgress(testUserId, 1, 3, 3800);
    assert.strictEqual(saved.levelId, 1);
    assert.strictEqual(saved.stars, 3);
    assert.strictEqual(saved.highScore, 3800);
    assert.strictEqual(saved.completed, true);

    const progressList = await memoryStore.getLevelProgress(testUserId);
    assert.strictEqual(progressList.length, 1);
    assert.strictEqual(progressList[0].levelId, 1);
    assert.strictEqual(progressList[0].stars, 3);
  });

  test('Preserves maximum stars and highest score on level replay', async () => {
    // Replay with lower score
    await memoryStore.saveLevelProgress(testUserId, 1, 2, 2100);

    const progressList = await memoryStore.getLevelProgress(testUserId);
    const lvl1Progress = progressList.find(p => p.levelId === 1);
    assert.strictEqual(lvl1Progress.stars, 3, 'Should retain highest stars (3)');
    assert.strictEqual(lvl1Progress.highScore, 3800, 'Should retain highest score (3800)');

    // Replay with higher score
    await memoryStore.saveLevelProgress(testUserId, 1, 3, 5200);
    const updatedList = await memoryStore.getLevelProgress(testUserId);
    const updatedLvl1 = updatedList.find(p => p.levelId === 1);
    assert.strictEqual(updatedLvl1.highScore, 5200, 'Should update to higher score');
  });

  test('Calculates unlocked levels correctly across branching campaign routes', () => {
    const completedLevels = new Map();
    completedLevels.set(1, { stars: 3, score: 5200 });

    const computeUnlocked = (completedMap) => {
      const unlocked = new Set([1]);
      completedMap.forEach((val, levelId) => {
        const def = LEVELS.find(l => l.id === levelId);
        if (def && def.nextLevels) {
          def.nextLevels.forEach(nxt => unlocked.add(nxt));
        }
      });
      return Array.from(unlocked).sort((a, b) => a - b);
    };

    // After completing level 1, levels 1, 2, and 3 should be unlocked
    let unlocked = computeUnlocked(completedLevels);
    assert.deepStrictEqual(unlocked, [1, 2, 3]);

    // Complete Route A (Level 2)
    completedLevels.set(2, { stars: 2, score: 4500 });
    unlocked = computeUnlocked(completedLevels);
    assert.deepStrictEqual(unlocked, [1, 2, 3, 4], 'Completing Route A must unlock Level 4 (Boss)');
  });

  test('Correctly determines resume stage so players continue where they left off', () => {
    const completedLevels = new Map();
    completedLevels.set(1, { stars: 3, score: 5000 });
    completedLevels.set(2, { stars: 2, score: 4200 });

    const unlocked = [1, 2, 3, 4];

    const determineBestResume = (unlockedList, completedMap) => {
      for (const lvlId of unlockedList) {
        if (!completedMap.has(lvlId)) {
          return lvlId;
        }
      }
      return unlockedList[unlockedList.length - 1] || 1;
    };

    const resumeLevelId = determineBestResume(unlocked, completedLevels);
    assert.strictEqual(resumeLevelId, 3, 'Should resume at first uncompleted unlocked stage (Level 3 Route B)');

    // Complete Level 3 as well
    completedLevels.set(3, { stars: 3, score: 6000 });
    const nextResume = determineBestResume(unlocked, completedLevels);
    assert.strictEqual(nextResume, 4, 'Should now resume at Level 4 Apex Boss');
  });
});
