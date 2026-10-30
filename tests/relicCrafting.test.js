/**
 * relicCrafting.test.js - Unit Tests for Relic Fusion & Battle Powers
 * 
 * Tests:
 * 1. Recipe costs and validation
 * 2. Fragment deduction and crafting success
 * 3. Rejection of craft attempt when fragments are insufficient
 * 4. Battle charge consumption
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const RelicManager = require('../client/js/engine/RelicManager');

describe('Relic Fusion & Inventory Mechanics', () => {
  test('Initializes with default starting fragments and starter relics', () => {
    const mgr = new RelicManager();
    assert.strictEqual(mgr.fragments, 50);
    assert.strictEqual(mgr.inventory.row_clear, 1);
    assert.strictEqual(mgr.inventory.barrier_breaker, 1);
  });

  test('Fuses Sunbeam Lance (row_clear) for 30 fragments', () => {
    const mgr = new RelicManager();
    mgr.fragments = 50;
    const initialCount = mgr.inventory.row_clear;

    const res = mgr.craftRelic('row_clear');
    assert.strictEqual(res.success, true);
    assert.strictEqual(mgr.fragments, 20, '50 - 30 cost = 20 remaining fragments');
    assert.strictEqual(mgr.inventory.row_clear, initialCount + 1);
  });

  test('Rejects relic crafting when fragment balance is insufficient', () => {
    const mgr = new RelicManager();
    mgr.fragments = 10; // Not enough for any relic (minimum is 25)

    const res = mgr.craftRelic('barrier_breaker'); // Cost is 40
    assert.strictEqual(res.success, false);
    assert.match(res.error, /Insufficient fragments/);
    assert.strictEqual(mgr.fragments, 10, 'Balance must remain unchanged on failure');
  });

  test('Consumes relic charge upon battle execution', () => {
    const mgr = new RelicManager();
    mgr.battleCharges.row_clear = 2;

    mgr.consumeRelic('row_clear');
    assert.strictEqual(mgr.battleCharges.row_clear, 1);
    assert.strictEqual(mgr.activeTargetingRelic, null, 'Targeting state should be cleared');
  });

  test('Rejects selection of relic with 0 battle charges', () => {
    const mgr = new RelicManager();
    mgr.battleCharges.crystal_burst = 0;

    const res = mgr.selectRelicForUse('crystal_burst');
    assert.strictEqual(res.success, false);
    assert.match(res.error, /No Astral Bomb charges remaining/);
  });
});
