/**
 * echoBoard.test.js - Unit Tests for Connected Echo Board System
 * 
 * Tests:
 * 1. Echo Energy reception and distribution
 * 2. Crystalline barrier unlocking at energy threshold
 * 3. Energy amplifier multiplier
 * 4. Barrier Breaker relic interaction
 * 5. Objective completion detection
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const EchoBoard = require('../client/js/engine/EchoBoard');

describe('EchoBoard Connected Puzzle System', () => {
  test('Initializes grid with locked barriers and energy requirements', () => {
    const echo = new EchoBoard({ rows: 4, cols: 4, targetGlyphs: 2 });
    assert.strictEqual(echo.grid.length, 4);
    assert.strictEqual(echo.grid[0].length, 4);
    assert.strictEqual(echo.unlockedGlyphsCount, 0);
    assert.strictEqual(echo.isObjectiveComplete(), false);
  });

  test('Receives Echo Energy and unlocks barrier when threshold is satisfied', () => {
    const customCells = [
      { row: 1, col: 1, state: 'locked', energyRequired: 40, currentEnergy: 0, isCompleted: false }
    ];
    const echo = new EchoBoard({ rows: 3, cols: 3, targetGlyphs: 1, initialCells: customCells });

    const cell = echo.getCell(1, 1);
    assert.strictEqual(cell.state, 'locked');
    assert.strictEqual(cell.isCompleted, false);

    // Apply partial energy (20 energy)
    echo.receiveEnergy(20);
    assert.strictEqual(cell.isCompleted, false, 'Should remain locked under threshold');

    // Apply surplus energy (200 energy) to ensure all locked barriers reach threshold
    const result = echo.receiveEnergy(200);
    assert.strictEqual(cell.state, 'unlocked', 'Cell should become unlocked');
    assert.strictEqual(cell.isCompleted, true);
    assert.ok(echo.unlockedGlyphsCount >= 1);
    assert.strictEqual(echo.isObjectiveComplete(), true, 'Objective should be met');
  });

  test('Barrier Breaker relic instantly shatters a targeted locked barrier', () => {
    const echo = new EchoBoard({ rows: 4, cols: 4, targetGlyphs: 1 });
    const cell = echo.getCell(1, 1);
    cell.state = 'locked';
    cell.energyRequired = 80;
    cell.currentEnergy = 0;
    cell.isCompleted = false;

    const broken = echo.breakBarrier(1, 1);
    assert.strictEqual(broken, true, 'Relic break must succeed');
    assert.strictEqual(cell.state, 'unlocked');
    assert.strictEqual(cell.isCompleted, true);
    assert.strictEqual(echo.unlockedGlyphsCount, 1);
  });

  test('Applies energy multiplier when Echo Amplifier is active', () => {
    const echo = new EchoBoard({ rows: 4, cols: 4 });
    echo.energyMultiplier = 2.5;

    const result = echo.receiveEnergy(20);
    assert.strictEqual(result.finalAmount, 50, '20 base energy * 2.5x multiplier should yield 50 energy');
  });
});
